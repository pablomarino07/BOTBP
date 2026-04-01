/* ============================================================
   procesador.js — CEREBRO del bot
   Recibe un historial de chat, llama a Gemini y guarda el
   pedido en Supabase si la IA detecta que está cerrado.
   ============================================================ */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { SYSTEM_PROMPT } from './prompt.js';
dotenv.config();

const MODEL_NAME = "gemini-flash-latest";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export async function procesarPedidoDesdeChat(telefono, historialChat) {
    try {
        console.log(`\n--- 🤖 Procesando [${telefono}] ---`);

        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1
            }
        });

        const promptCompleto = `${SYSTEM_PROMPT}\n\nChat a procesar:\n${historialChat}`;

        /* ── SISTEMA DE REINTENTOS CON BACKOFF EXPONENCIAL ──
           Maneja tanto 503 (sobrecargado) como 429 (rate limit).
           Espera: 2s → 4s → 8s entre intentos */
        let result, response;
        const MAX_INTENTOS = 3;

        for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
            try {
                console.log(`   🌐 Llamando a Gemini (intento ${intento}/${MAX_INTENTOS})...`);
                result = await model.generateContent(promptCompleto);
                response = await result.response;
                console.log(`   ✅ Gemini respondió OK`);
                break;

            } catch (error) {
                const es503 = error.message.includes('[503');
                const es429 = error.message.includes('[429');
                const esReintentable = es503 || es429;

                if (esReintentable && intento < MAX_INTENTOS) {
                    const espera = Math.pow(2, intento) * 1000;
                    const tipo = es429 ? '429 Rate Limit' : '503 Sobrecargado';

                    /* Log detallado para saber exactamente qué pasó */
                    console.warn(`   ⚠️  API Gemini [${tipo}] — intento ${intento}/${MAX_INTENTOS}`);
                    console.warn(`   ⏳ Esperando ${espera / 1000}s antes de reintentar...`);

                    await new Promise(r => setTimeout(r, espera));
                } else {
                    /* Error no reintentable o se agotaron los intentos */
                    if (intento === MAX_INTENTOS) {
                        console.error(`   ❌ Gemini falló después de ${MAX_INTENTOS} intentos: ${error.message}`);
                    }
                    throw error;
                }
            }
        }

        const textResponse = response.text();

        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            console.error("❌ Respuesta de IA no es JSON válido:", textResponse.slice(0, 200));
            return { success: false, error: "JSON_PARSE_ERROR" };
        }

        if (!data.pedido_cerrado) {
            console.log("ℹ️  Sin pedido detectable en esta conversación.");
            return { success: true, cerrado: false };
        }

        console.log("✅ Pedido cerrado. Guardando en Supabase...");
        console.log("   Datos:", JSON.stringify(data, null, 2));

        /* ── UPSERT CLIENTE ── */
        const { data: clienteData, error: errC } = await supabase
            .from('clientes')
            .upsert({
                telefono,
                nombre: data.cliente?.nombre || "Cliente WhatsApp",
                direccion_frecuente: data.cliente?.direccion || "Sin dirección",
                ultima_compra: new Date()
            })
            .select()
            .single();

        let cliente;
        if (errC) {
            if (errC.message.includes("duplicate key")) {
                const { data: existente } = await supabase
                    .from('clientes').select().eq('telefono', telefono).single();
                cliente = existente;
            } else {
                console.error("❌ Error guardando cliente:", errC.message);
                throw errC;
            }
        } else {
            cliente = clienteData;
        }

        /* ── INSERT PEDIDO ── */
        const { error: errP } = await supabase
            .from('pedidos')
            .insert({
                cliente_id: cliente.id,
                monto_total: data.total_inferido || 0,
                items_json: data.items,
                fecha: new Date()
            });

        if (errP) {
            console.error("❌ Error guardando pedido:", errP.message);
            throw errP;
        }

        console.log("🚀 ¡Pedido guardado exitosamente!");
        return { success: true, cerrado: true, data };

    } catch (error) {
        console.error("❌ Error en procesador:", error.message);
        return { success: false, error: error.message };
    }
}
