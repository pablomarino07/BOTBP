/* ============================================================
   Este script tiene la funcionalidad de ser el punto de entrada 
   (entrypoint) principal de la aplicación. Inicializa los servicios 
   core y actúa como un recolector base de mensajes.

   Funciones:
   - Arrancar y coordinar todos los módulos: WhatsApp web client, 
     servidor Express, y Scheduler de turnos.
   - Event Listeners ('qr', 'ready', 'message') para capturar
     y guardar historiales de chat en la base de datos sin invocar 
     a la IA en tiempo real, garantizando rápida respuesta.
     
   Utilizando las herramientas:
   - whatsapp-web.js (vía client exportado)
   - qrcode-terminal
   - @supabase/supabase-js
   - modulos nativos: fs, path
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

/* Devuelve la hora actual en zona Argentina (UTC-3) como string ISO */
function ahoraArgentina() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
}

async function guardarHistorial(chatId, telefono, mensajes) {
    const ahora = ahoraArgentina();
    await supabase
        .from('historial_chats')
        .upsert({ chat_id: chatId, telefono, mensajes, actualizado_at: ahora });
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

        /* Si el chatId usa @lid (ID interno de WhatsApp para algunos números argentinos),
           obtenemos el número real desde el contacto para no guardar IDs largos e inútiles */
        let telefono;
        if (chatId.includes('@lid')) {
            try {
                const contact = await msg.getContact();
                
                // 1. Intentamos obtener y limpiar el número estándar
                const rawNumber = contact.number ? contact.number.replace(/\D/g, '') : '';
                
                if (rawNumber.length === 13) {
                    telefono = rawNumber;
                } else {
                    // 2. Fallback: Si no viene un número de 13 dígitos, buscamos en chat.name o contact.pushname.
                    // Limpiamos todo lo que no sea dígitos.
                    const chatName = chat.name;
                    const pushName = contact.pushname;
                    
                    const numFromChat = chatName ? chatName.replace(/\D/g, '') : '';
                    const numFromPush = pushName ? pushName.replace(/\D/g, '') : '';
                    
                    if (numFromChat.length === 13) {
                        telefono = numFromChat;
                        console.log(`💡 [LID Fallback] Número de 13 dígitos extraído de chat.name: ${telefono}`);
                    } else if (numFromPush.length === 13) {
                        telefono = numFromPush;
                        console.log(`💡 [LID Fallback] Número de 13 dígitos extraído de pushname: ${telefono}`);
                    } else {
                        // Si no pudimos encontrar un número de 13 dígitos, guardamos el chatId completo (con @lid) tal cual
                        telefono = chatId;
                        console.log(`⚠️ [LID Fallback] No se halló número de 13 dígitos. Guardando chatId original: ${telefono}`);
                    }
                }
            } catch (err) {
                console.error(`⚠️ [LID Error] Falló getContact para ${chatId}:`, err.message);
                telefono = chatId;
            }
        } else {
            telefono = chatId.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
        }
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

/* ── LOG DE HORA ARGENTINA ──
   Verificamos en consola que el servidor interpreta bien la zona horaria */
function logHoraArgentina() {
    const ahora = ahoraArgentina();
    const str = ahora.toLocaleString('es-AR', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    console.log(`🕐 [Hora Argentina] ${str}`);
}
logHoraArgentina();
setInterval(logHoraArgentina, 60 * 60 * 1000); /* cada 1 hora */

/* Capturamos crashes para que no tire todo abajo */
process.on('uncaughtException', (e) => console.error('🔥 [Crash evitado]:', e.message));
process.on('unhandledRejection', (r) => console.error('🔥 [Promise rechazada]:', r));
