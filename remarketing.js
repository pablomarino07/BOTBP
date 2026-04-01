/* ============================================================
   remarketing.js
   MÓDULO PURO — ya no crea su propio cliente de WhatsApp.
   Exporta funciones que server.js llama usando el cliente
   único de client.js. Así evitamos dos Chromium en RAM.
   ============================================================ */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const DIAS_SIN_COMPRA = 30;
const MODEL_NAME = "gemini-flash-latest";

/* ── GENERADOR DE MENSAJE CON IA ── */

async function generarMensaje(cliente, ultimoPedido) {
    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { temperature: 0.8 }
    });

    const itemsTexto = ultimoPedido.items_json
        ?.map(i => `${i.cantidad}x ${i.producto_oficial}`)
        .join(', ') || 'pizzas y empanadas';

    const prompt = `
Sos el community manager de BP Pizza, una pizzería argentina informal y simpática.
Tenés que escribir un mensaje de WhatsApp corto para reactivar a un cliente que no compra hace 30 días.

Datos del cliente:
- Nombre: ${cliente.nombre}
- Última compra: ${itemsTexto}
- Fecha última compra: ${new Date(ultimoPedido.fecha).toLocaleDateString('es-AR')}

Reglas:
1. Usá un tono argentino, cálido y natural. Nada de "Estimado cliente".
2. Mencioná algo específico de lo que pidió la última vez.
3. Ofrecé una promo o simplemente invitalo a volver.
4. Máximo 3 oraciones. Sin emojis en exceso (máximo 2).
5. No uses asteriscos ni formato markdown.
6. Terminá con algo que invite a responder.

Devolvé solo el texto del mensaje, sin comillas ni explicaciones.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}

function generarMensajeFijo(cliente) {
    return `Hola ${cliente.nombre}! Hace un tiempo que no te vemos por acá 🍕 ¿Se te antoja algo rico hoy? Escribinos y pedimos juntos.`;
}

/* ── FUNCIÓN PRINCIPAL DE REMARKETING ──
   Recibe el cliente de WhatsApp ya autenticado como parámetro.
   Lo llama server.js pasándole el cliente único. */
export async function ejecutarRemarketing(whatsappClient) {
    console.log('\n🔔 [Remarketing] Iniciando ciclo...');

    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - DIAS_SIN_COMPRA);

    const { data: clientes, error } = await supabase
        .from('clientes')
        .select('*')
        .lte('ultima_compra', hace30Dias.toISOString())
        .or(`ultimo_remarketing.is.null,ultimo_remarketing.lte.${hace30Dias.toISOString()}`);

    if (error) {
        console.error('❌ [Remarketing] Error buscando clientes:', error.message);
        return { ok: false, error: error.message };
    }

    if (!clientes.length) {
        console.log('✅ [Remarketing] No hay clientes para contactar hoy.');
        return { ok: true, enviados: 0 };
    }

    console.log(`📋 [Remarketing] ${clientes.length} cliente(s) para contactar.`);

    let enviados = 0;

    for (const cliente of clientes) {
        try {
            const { data: pedidos } = await supabase
                .from('pedidos')
                .select('*')
                .eq('cliente_id', cliente.id)
                .order('fecha', { ascending: false })
                .limit(1);

            const ultimoPedido = pedidos?.[0];

            let mensaje;
            if (ultimoPedido) {
                try {
                    mensaje = await generarMensaje(cliente, ultimoPedido);
                } catch (e) {
                    console.warn(`⚠️  [Remarketing] IA falló para ${cliente.nombre}, usando mensaje fijo`);
                    mensaje = generarMensajeFijo(cliente);
                }
            } else {
                mensaje = generarMensajeFijo(cliente);
            }

            if (!cliente.telefono) {
                console.warn(`⚠️  [Remarketing] Sin número para ${cliente.nombre}`);
                continue;
            }

            const numero = cliente.telefono.replace(/\D/g, '') + '@c.us';
            await whatsappClient.sendMessage(numero, mensaje);
            console.log(`✅ [Remarketing] Enviado a ${cliente.nombre}`);

            await supabase
                .from('clientes')
                .update({ ultimo_remarketing: new Date().toISOString() })
                .eq('id', cliente.id);

            /* 5 segundos entre mensajes para evitar ban */
            await new Promise(r => setTimeout(r, 5000));
            enviados++;

        } catch (e) {
            console.error(`❌ [Remarketing] Error con ${cliente.nombre}:`, e.message);
        }
    }

    console.log(`✅ [Remarketing] Completado. Enviados: ${enviados}`);
    return { ok: true, enviados };
}

/* ── PROGRAMADOR DIARIO ──
   Se llama una vez desde server.js al arrancar */
export function programarRemarketing(whatsappClient) {
    const maniana = new Date();
    maniana.setDate(maniana.getDate() + 1);
    maniana.setHours(0, 0, 0, 0);

    const msHasta = maniana - new Date();
    console.log(`⏰ [Remarketing] Próxima ejecución: ${maniana.toLocaleString('es-AR')}`);

    setTimeout(async () => {
        await ejecutarRemarketing(whatsappClient);
        setInterval(() => ejecutarRemarketing(whatsappClient), 24 * 60 * 60 * 1000);
    }, msHasta);
}
