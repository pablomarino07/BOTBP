/* ============================================================
   procesador.js — CEREBRO del bot
   Recibe un historial de chat, llama a Gemini y guarda el
   pedido en Supabase si la IA detecta que está cerrado.
   ============================================================ */

import { GoogleGenerativeAI } from "@google/generative-ai";  /* importamos la libreria de gemini*/
import { createClient } from '@supabase/supabase-js';  /* importamos la libreria de supabase*/
import * as dotenv from 'dotenv';   /* importamos la libreria de dotenv*/
import { SYSTEM_PROMPT } from './prompt.js';
dotenv.config();

// Definimos el orden de prioridad de los modelos (Fallback Strategy)
const MODELOS_DISPONIBLES = [
    "gemini-flash-latest", // Principal: rápido y estable, con cuota habilitada
    "gemini-2.5-flash",    // Plan B: versión 2.5
    "gemini-pro-latest"    // Plan C: versión pro
];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export async function procesarPedidoDesdeChat(telefono, historialChat) {
    try {
        console.log(`\n--- 🤖 Procesando [${telefono}] ---`);

        const promptCompleto = `${SYSTEM_PROMPT}\n\nChat a procesar:\n${historialChat}`;

        let result, response;
        const MAX_INTENTOS = 3;
        let procesamientoExitoso = false; // Bandera para saber si logramos obtener respuesta

        /* ── SISTEMA DE FALLBACK + REINTENTOS CON BACKOFF EXPONENCIAL ── */
        // Loop Externo: Recorre los modelos disponibles
        for (const modeloActual of MODELOS_DISPONIBLES) {
            console.log(`\n🔄 Intentando con el modelo: ${modeloActual}`);

            const model = genAI.getGenerativeModel({
                model: modeloActual,
                generationConfig: {
                    responseMimeType: "application/json",  /* le decimos a la ia que nos devuelva un json*/
                    temperature: 0.1  /* rate de creatividad */
                }
            });

            // Loop Interno: Maneja los reintentos por sobrecarga (503) o rate limit (429)
            // Espera: 2s → 4s → 8s entre intentos
            for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
                try {
                    console.log(`   🌐 Llamando a Gemini (intento ${intento}/${MAX_INTENTOS})...`);
                    result = await model.generateContent(promptCompleto);
                    response = await result.response;

                    console.log(`   ✅ ¡Gemini (${modeloActual}) respondió OK!`);
                    procesamientoExitoso = true;
                    break; // Rompe el loop de reintentos (Loop Interno)

                } catch (error) {
                    const es503 = error.message.includes('[503');
                    const es429 = error.message.includes('[429');
                    const esReintentable = es503 || es429;

                    if (esReintentable && intento < MAX_INTENTOS) {
                        const espera = Math.pow(2, intento) * 3000; /* 6s → 12s → 24s en vez de 2s → 4s */
                        const tipo = es429 ? '429 Rate Limit' : '503 Sobrecargado';

                        /* Log detallado para saber exactamente qué pasó */
                        console.warn(`   ⚠️  API Gemini [${tipo}] — intento ${intento}/${MAX_INTENTOS}`);
                        console.warn(`   ⏳ Esperando ${espera / 1000}s antes de reintentar...`);

                        await new Promise(r => setTimeout(r, espera));
                    } else {
                        /* Error no reintentable o se agotaron los intentos de ESTE modelo */
                        console.error(`   ❌ Falló el modelo ${modeloActual} después de ${intento} intentos: ${error.message}`);
                        break; // Rompe el loop interno para pasar al siguiente modelo de la lista
                    }
                }
            }

            // Si logramos respuesta con el modelo actual, salimos del loop de modelos
            if (procesamientoExitoso) {
                break;
            }
        }

        // Validación final de seguridad: si pasamos por todos los modelos y fallaron
        if (!procesamientoExitoso) {
            console.error("🚨 Error Fatal: Todos los modelos fallaron. Abortando procesamiento para este chat.");
            throw new Error("ALL_MODELS_FAILED");
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