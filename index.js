import { procesarPedidoDesdeChat } from './procesador.js';

/**
 * index.js - Punto de entrada del Bot BP
 * Actualmente configurado para realizar una prueba de flujo completo.
 */

const CHAT_PRUEBA = `
Cliente: Hola, quiero una pizza de cheddar y bacon familiar al molde y 3 empanadas de jyw.
Empleado: Perfecto, necesitaria un nombre y una dirección para el envío.
Cliente: Pablo, calle falsa 123. Seria 20550 el total?
Empleado: nono, son  5000.
Cliente: Dale, gracias!`;

const TELEFONO_PRUEBA = "549343555666";

async function iniciarApp() {
    console.log("=== Bot BP - Sistema de Extracción de Pedidos ===");
    
    // Simulación de detección de mensaje de WhatsApp
    console.log("Simulando recepción de chat...");
    
    const resultado = await procesarPedidoDesdeChat(TELEFONO_PRUEBA, CHAT_PRUEBA);
    
    if (resultado.success) {
        if (resultado.cerrado) {
            console.log("\nResultado final: Pedido PROCESADO y GUARDADO.");
        } else {
            console.log("\nResultado final: Conversación activa (sin guardar).");
        }
    } else {
        console.log("\nResultado final: Hubo un error en el proceso.");
    }
}

iniciarApp();
