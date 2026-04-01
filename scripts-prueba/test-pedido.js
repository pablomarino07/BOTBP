/* ============================================================
   test-pedido.js
   Script para probar el bot de pizza sin usar WhatsApp.
   Simula un chat completo y llama a procesarPedidoDesdeChat.
   ============================================================ */

import { procesarPedidoDesdeChat } from '../procesador.js';

// Simulamos una conversación de WhatsApp
const historialSimulado = `
Cliente: Hola, ¿tienen pizza de pepperoni?
Bot: Hola! Sí, tenemos la pizza de pepperoni a $12.000. ¿Deseas pedir una?
Cliente: Sí, una pepperoni grande y una Coca Cola de 1.5L.
Bot: Perfecto! Sería una Pizza Pepperoni ($12.000) y una Coca Cola ($2.500). Total: $14.500. ¿A qué dirección la enviamos?
Cliente: Calle Falsa 123.
Bot: ¡Entendido! El pedido sale para Calle Falsa 123 en unos 30 minutos.
Empleado: Pedido confirmado y enviado.
`;

const numeroTelefono = "123456789";

async function probarBot() {
    console.log("🚀 Iniciando prueba de simulación...");
    
    try {
        const resultado = await procesarPedidoDesdeChat(numeroTelefono, historialSimulado);
        
        if (resultado.success) {
            if (resultado.cerrado) {
                console.log("✅ ¡ÉXITO! El bot detectó el pedido cerrado y lo procesó.");
                console.log("Datos capturados:", JSON.stringify(resultado.data, null, 2));
            } else {
                console.log("ℹ️ El bot procesó el chat, pero dice que el pedido sigue ABIERTO.");
                console.log("Asegúrate de que en el historial alguien diga algo como 'pedido confirmado' o 'enviado' si así lo configuraste en el prompt.");
            }
        } else {
            console.error("❌ ERROR en el procesamiento:", resultado.error);
        }
    } catch (err) {
        console.error("💥 ERROR CRÍTICO en el script de prueba:", err);
    }
}

probarBot();
