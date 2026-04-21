/* ============================================================
   Este script tiene la funcionalidad de inicializar y mantener 
   un único cliente de WhatsApp (Puppeteer/Chromium) para toda 
   la aplicación. Actúa como el punto central de conexión y 
   reconexión automática.

   Funciones (eventos config):
   - Configuración inicial de puppeteer
   - Eventos 'ready' y 'disconnected'
   - Reconexión con backoff/timeout
   
   Utilizando las herramientas:
   - whatsapp-web.js (Client, LocalAuth)
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
