/* ============================================================
   whatsapp.js
   PUNTO DE ENTRADA ÚNICO del sistema.
   Arranca todo: WhatsApp, servidor, scheduler.
   Solo acumula mensajes — no llama a la IA en tiempo real.
   ============================================================ */

import qrcode from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { client } from './client.js';
import { arrancarServidor, iniciarScheduler } from './server.js';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/* ── HISTORIAL ── */

async function cargarHistorial(chatId) {
    try {
        const { data } = await supabase
            .from('historial_chats')
            .select('mensajes')
            .eq('chat_id', chatId)
            .single();
        return data?.mensajes || [];
    } catch (e) {
        console.error(`❌ [Historial] Error cargando ${chatId}:`, e.message);
        return [];
    }
}

async function guardarHistorial(chatId, telefono, mensajes) {
    await supabase
        .from('historial_chats')
        .upsert({ chat_id: chatId, telefono, mensajes, actualizado_at: new Date() });
}

/* ── ACUMULADOR DE MENSAJES ── */

async function procesarMensaje(msg) {
    try {
        /* Ignoramos los estados de WhatsApp para que no rompa el getChat ni se acumulen */
        if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') return;

        /* Ignoramos los canales / newsletters de WhatsApp */
        const isChannel = msg.from?.includes('@newsletter') || msg.to?.includes('@newsletter');
        if (isChannel) return;

        const chat = await msg.getChat();
        if (chat.isGroup) return;
        if (!msg.body || msg.body.trim() === '') return;

        const chatId = msg.fromMe ? msg.to : msg.from;
        const telefono = chatId.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
        const rol = msg.fromMe ? 'Empleado' : 'Cliente';
        const texto = `${rol}: ${msg.body}`;

        console.log(`\n📩 [${telefono}] ${texto}`);

        const mensajes = await cargarHistorial(chatId);  /* leo el historial de whatsapp*/
        mensajes.push(texto);  /* agrego el mensaje al historial*/
        await guardarHistorial(chatId, telefono, mensajes);  /* guardo el historial de whatsapp*/

        console.log(`   ✅ Acumulado (${mensajes.length} mensajes)`);
    } catch (e) {
        /* Si falla porque es un canal/newsletter interno de WP, lo ignoramos en silencio */
        if (e.stack && e.stack.includes('Channel.')) return;
        console.error('❌ Error acumulando:', e.stack);
    }
}

/* ── EVENTOS ── */

client.on('qr', (qr) => {
    /* El QR también lo mostramos en consola como fallback */
    console.log('\n📱 QR disponible en http://localhost:3000/dashboard.html');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ [Bot] Acumulador activo — esperando mensajes');
});

/* message = entrantes del cliente */
client.on('message', async (msg) => {
    await procesarMensaje(msg);
});

/* message_create = mensajes que manda el empleado desde el celular */
client.on('message_create', async (msg) => {
    if (!msg.fromMe) return;
    await procesarMensaje(msg);
});

/* ── ARRANQUE ── */

console.log('\n🛠️  Iniciando Bot BP...');

/* Eliminar bloqueos residuales de Chromium por si el servidor se reinició abruptamente */
const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
lockFiles.forEach(file => {
    const lockPath = path.join(process.cwd(), '.wwebjs_auth', 'session', file);
    if (fs.existsSync(lockPath)) {
        try { fs.unlinkSync(lockPath); console.log(`✅ [Clean] Eliminado bloqueo residual: ${file}`); }
        catch (e) { console.error(`⚠️ [Clean] No se pudo eliminar ${file}:`, e.message); }
    }
});

client.initialize();
arrancarServidor();
iniciarScheduler();

/* Capturamos crashes para que no tire todo abajo */
process.on('uncaughtException', (e) => console.error('🔥 [Crash evitado]:', e.message));
process.on('unhandledRejection', (r) => console.error('🔥 [Promise rechazada]:', r));
