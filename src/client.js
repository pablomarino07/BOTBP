/* ============================================================
   client.js
   Cliente ÚNICO de WhatsApp para toda la aplicación.
   Lo importan whatsapp.js, server.js y cualquier módulo
   que necesite mandar o recibir mensajes.
   Un solo Chromium corriendo = mucho menos RAM.
   ============================================================ */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;  /* local auth supuestamente par aguardar la sesion de whatsapp*/

export const client = new Client({
    authStrategy: new LocalAuth(),   /* el auth strategy es para guardar la sesion de whatsapp*/
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

/* Estado global de conexión — cualquier módulo puede leerlo */
export let whatsappListo = false;

client.on('ready', () => {
    whatsappListo = true;
    console.log('✅ [WhatsApp] Conectado y listo');
});

client.on('disconnected', async (reason) => {
    whatsappListo = false;
    console.log(`⚠️  [WhatsApp] Desconectado: ${reason}`);
    console.log('🔄 [WhatsApp] Intentando reconectar en 10 segundos...');

    /* Reconexión automática — si se cae el celular o la red,
       el bot vuelve solo sin necesidad de intervención */
    setTimeout(async () => {
        try {
            await client.initialize();   /* await es para que espere a que se conecte*/
        } catch (e) {    /* catch para que agarre el error de reconexion*/
            console.error('❌ [WhatsApp] Error al reconectar:', e.message);
        }
    }, 10000);
});
