/* ============================================================
   server.js
   Backend completo. Responsabilidades:
   1. Expone API REST que usa el dashboard
   2. Supabase solo vive acá — el frontend no sabe que existe
   3. Scheduler de turnos automáticos
   4. QR de WhatsApp disponible como endpoint
   5. Cola espaciada para remarketing (evita ban)
   6. Logs detallados de errores de Gemini (429/503)
   7. Registro de turnos procesados en Supabase
   ============================================================ */

import express from 'express'; /* express es para crear el servidor*/
import cors from 'cors'; /* cors es para permitir la comunicacion entre el frontend y el backend*/
import path from 'path'; /* path es para manejar rutas de archivos*/
import { fileURLToPath } from 'url'; /* fileURLToPath es para obtener la ruta del archivo*/
import { createClient } from '@supabase/supabase-js'; /* createClient es para crear un cliente de supabase*/
import { procesarPedidoDesdeChat } from './procesador.js'; /* procesarPedidoDesdeChat es para procesar el pedido*/
import { client, whatsappListo } from './client.js'; /* client es para el cliente de whatsapp*/

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url)); /* __dirname es para obtener la ruta del archivo*/
const app = express(); /* app es para crear el servidor*/
const PORT = 3000; /* PORT es para definir el puerto*/

/* ── CORS: solo permitimos requests desde localhost ──
   En producción esto evita que cualquier sitio externo
   pueda llamar a nuestra API */
app.use(cors({ origin: ['http://localhost:3000', 'null'] }));
app.use(express.json());

/* Servimos el dashboard desde la carpeta public/ */
app.use(express.static(path.join(__dirname, '..', 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/* ── AUTENTICACIÓN CON JWT PROPIO ──
   Usuario y contraseña se definen en el .env:
     DASHBOARD_USER=pablo
     DASHBOARD_PASSWORD=mi_contraseña
     JWT_SECRET=clave_larga_y_aleatoria */

/* Compara strings con tiempo constante para evitar timing attacks */
function igualdadSegura(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function verificarCredenciales(usuario, password) {
    const userValido = process.env.DASHBOARD_USER || '';
    const passValida = process.env.DASHBOARD_PASSWORD || '';
    return igualdadSegura(usuario, userValido) && igualdadSegura(password, passValida);
}

/* Middleware — verifica el JWT en todos los endpoints /api/* excepto /api/login */
const requireAuth = (req, res, next) => {
    if (req.path === '/login') return next();

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado. Iniciá sesión.' });
    }

    const token = authHeader.substring(7);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_inseguro');
        req.usuario = payload.usuario;
        next();
    } catch (e) {
        const msg = e.name === 'TokenExpiredError'
            ? 'Sesión expirada. Volvé a iniciar sesión.'
            : 'Token inválido. Iniciá sesión nuevamente.';
        return res.status(401).json({ error: msg });
    }
};

/* ── CONFIGURACIÓN DE TURNOS ── */
let horaTurno1 = '12:00';
let horaTurno2 = '23:00';

/* ── QR EN MEMORIA ──
   Cuando WhatsApp genera el QR lo guardamos acá.
   El dashboard lo pide con GET /qr y lo muestra. */
let qrActual = null;
let estadoConexion = 'desconectado'; /* 'desconectado' | 'esperando_qr' | 'conectado' */

client.on('qr', (qr) => {
    qrActual = qr;
    estadoConexion = 'esperando_qr';
    console.log('📱 [QR] Nuevo QR generado — disponible en el dashboard');
});

client.on('ready', () => {
    qrActual = null;
    estadoConexion = 'conectado';
});

client.on('disconnected', () => {
    estadoConexion = 'desconectado';
    qrActual = null;
});

/* ── COLA DE MENSAJES ESPACIADA ──
   En vez de mandar N mensajes en un loop directo,
   los metemos en una cola y los procesamos de a uno
   con más tiempo entre cada uno.
   Máximo 50 mensajes por lote para no arriesgar ban. */
const MAX_POR_LOTE = 50;
const DELAY_ENTRE_MENSAJES = 10000; /* 10 segundos entre cada mensaje */

async function enviarConCola(destinatarios, getMensaje) {
    const lote = destinatarios.slice(0, MAX_POR_LOTE);
    const omitidos = destinatarios.length - lote.length;

    if (omitidos > 0) {
        console.warn(`⚠️  [Cola] Se omitieron ${omitidos} destinatarios (límite de ${MAX_POR_LOTE} por lote)`);
    }

    let enviados = 0, fallidos = 0;

    for (let i = 0; i < lote.length; i++) {
        const dest = lote[i];
        try {
            const mensaje = getMensaje(dest);
            const numero = (dest.telefono || dest).replace(/\D/g, '') + '@c.us';
            await client.sendMessage(numero, mensaje);
            enviados++;
            console.log(`   [${i + 1}/${lote.length}] ✅ Enviado a ${dest.nombre || numero}`);
        } catch (e) {
            fallidos++;
            console.error(`   [${i + 1}/${lote.length}] ❌ Falló ${dest.nombre || dest}:`, e.message);
        }

        /* Esperamos entre mensajes excepto después del último */
        if (i < lote.length - 1) {
            await new Promise(r => setTimeout(r, DELAY_ENTRE_MENSAJES));
        }
    }

    return { enviados, fallidos, omitidos };
}


/* ============================================================
   FUNCIÓN PRINCIPAL: PROCESAR TURNO
   Toma todos los historiales, los manda a Gemini,
   guarda los pedidos y registra el resultado en Supabase.
   ============================================================ */
async function procesarTurno(origen = 'automático') {
    const inicio = new Date();
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`🔄 Procesando turno (${origen}) — ${inicio.toLocaleString('es-AR')}`);
    console.log(`${'═'.repeat(50)}`);

    const { data: historiales, error } = await supabase
        .from('historial_chats')
        .select('*');

    if (error) {
        console.error('❌ Error al traer historiales:', error.message);
        return { ok: false, error: error.message };
    }

    if (!historiales.length) {
        console.log('ℹ️  Sin conversaciones acumuladas.');
        return { ok: true, procesados: 0, pedidos: 0, descartados: 0 };
    }

    console.log(`📋 ${historiales.length} conversación(es) para analizar\n`);

    let pedidosGuardados = 0;
    let descartados = 0;
    let errores = 0;
    const detalles = [];

    for (const h of historiales) {
        const historialTexto = h.mensajes.join('\n');
        console.log(`\n── [${h.telefono}] ${h.mensajes.length} mensajes ──`);

        try {
            const resultado = await procesarPedidoDesdeChat(h.telefono, historialTexto);

            if (resultado.success && resultado.cerrado) {
                console.log(`   ✅ Pedido guardado`);
                pedidosGuardados++;
                detalles.push({ telefono: h.telefono, estado: 'pedido_guardado' });
            } else if (resultado.success && !resultado.cerrado) {
                console.log(`   ⏭️  Sin pedido — descartado`);
                descartados++;
                detalles.push({ telefono: h.telefono, estado: 'descartado' });
            } else {
                /* Logueamos el tipo de error de Gemini con detalle */
                const errorMsg = resultado.error || 'desconocido';
                if (errorMsg.includes('429')) {
                    console.error(`   ⚠️  RATE LIMIT (429) para ${h.telefono} — cuota de Gemini agotada`);
                } else if (errorMsg.includes('503')) {
                    console.error(`   ⚠️  SERVICIO NO DISPONIBLE (503) para ${h.telefono} — Gemini sobrecargado`);
                } else {
                    console.error(`   ❌ Error: ${errorMsg}`);
                }
                errores++;
                detalles.push({ telefono: h.telefono, estado: 'error', error: errorMsg });
            }
        } catch (e) {
            console.error(`   ❌ Excepción inesperada:`, e.message);
            errores++;
            detalles.push({ telefono: h.telefono, estado: 'error', error: e.message });
        }

        /* Siempre borramos el historial — pedido o no */
        await supabase.from('historial_chats').delete().eq('chat_id', h.chat_id);

        /* 1.5 segundos entre llamadas a Gemini */
        await new Promise(r => setTimeout(r, 1500));
    }

    const fin = new Date();
    const duracionSeg = Math.round((fin - inicio) / 1000);

    /* ── GUARDAR LOG DEL TURNO EN SUPABASE ──
       Así el jefe puede ver en el dashboard cuándo se procesó
       y cuántos pedidos salieron de cada turno */
    try {
        await supabase.from('logs_turnos').insert({
            origen,
            fecha: inicio.toISOString(),
            duracion_segundos: duracionSeg,
            conversaciones: historiales.length,
            pedidos_guardados: pedidosGuardados,
            descartados,
            errores,
            detalles
        });
    } catch (e) {
        /* Si falla el log no es crítico — solo lo avisamos */
        console.warn('⚠️  No se pudo guardar el log del turno (¿existe la tabla logs_turnos?)');
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`✅ Turno completado en ${duracionSeg}s`);
    console.log(`   Pedidos: ${pedidosGuardados} | Descartados: ${descartados} | Errores: ${errores}`);
    console.log(`${'═'.repeat(50)}\n`);

    return { ok: true, procesados: historiales.length, pedidos: pedidosGuardados, descartados, errores };
}


/* ============================================================
   SCHEDULER
   ============================================================ */
export function iniciarScheduler() {
    console.log(`⏰ Scheduler activo — Turno 1: ${horaTurno1} | Turno 2: ${horaTurno2}`);

    setInterval(async () => {
        const ahora = new Date();
        const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
        if (horaActual === horaTurno1 || horaActual === horaTurno2) {
            await procesarTurno('automático');
        }
    }, 60000);
}


/* ============================================================
   ENDPOINTS HTTP
   El dashboard solo habla con estos endpoints.
   Nunca toca Supabase directamente.
   ============================================================ */

/* POST /api/login — recibe { usuario, password }, devuelve JWT si son correctos */
app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
        return res.status(400).json({ ok: false, error: 'Faltan datos.' });
    }
    if (!verificarCredenciales(usuario, password)) {
        console.warn(`🔐 [Auth] Intento de login fallido para usuario: "${usuario}"`);
        return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos.' });
    }
    const token = jwt.sign(
        { usuario },
        process.env.JWT_SECRET || 'fallback_secret_inseguro',
        { expiresIn: '12h' }
    );
    console.log(`✅ [Auth] Login exitoso: "${usuario}"`);
    res.json({ ok: true, token, usuario });
});

/* Aplicar autenticación JWT a todos los endpoints /api/* (excepto /api/login) */
app.use('/api', requireAuth);

/* GET /api/estado — estado general del sistema */
app.get('/api/estado', (req, res) => {
    res.json({
        whatsapp: estadoConexion,
        turno1: horaTurno1,
        turno2: horaTurno2,
        hayQr: !!qrActual
    });
});

/* GET /api/qr — devuelve el string del QR para mostrarlo en el dashboard */
app.get('/api/qr', (req, res) => {
    if (!qrActual) {
        return res.json({ ok: false, mensaje: estadoConexion === 'conectado' ? 'Ya conectado' : 'QR no disponible aún' });
    }
    res.json({ ok: true, qr: qrActual });
});

/* POST /api/configurar-turnos */
app.post('/api/configurar-turnos', (req, res) => {
    const { turno1, turno2 } = req.body;
    const re = /^\d{2}:\d{2}$/;
    if (!re.test(turno1) || !re.test(turno2)) {
        return res.status(400).json({ ok: false, error: 'Formato inválido. Usá HH:MM' });
    }
    horaTurno1 = turno1;
    horaTurno2 = turno2;
    console.log(`⏰ Turnos actualizados: ${turno1} y ${turno2}`);
    res.json({ ok: true });
});

/* POST /api/procesar-ahora */
app.post('/api/procesar-ahora', async (req, res) => {
    const resultado = await procesarTurno('manual');
    res.json(resultado);
});

/* GET /api/metricas — métricas para el dashboard (Supabase solo desde acá) */
app.get('/api/metricas', async (req, res) => {
    const { desde } = req.query;
    try {
        let q = supabase.from('pedidos').select('id,monto_total,items_json,fecha,cliente_id').order('fecha', { ascending: false });
        if (desde) q = q.gte('fecha', desde);
        const { data: pedidos, error: errP } = await q;
        const { data: clientes, error: errC } = await supabase.from('clientes').select('id,nombre,telefono,ultima_compra');
        if (errP || errC) throw new Error(errP?.message || errC?.message);
        res.json({ ok: true, pedidos, clientes });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

/* GET /api/clientes-vencidos — para remarketing */
app.get('/api/clientes-vencidos', async (req, res) => {
    const dias = parseInt(req.query.dias) || 30;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('id,nombre,telefono,ultima_compra,ultimo_remarketing')
            .lte('ultima_compra', fechaLimite.toISOString())
            .order('ultima_compra', { ascending: true });
        if (error) throw error;
        res.json({ ok: true, clientes: data });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

/* GET /api/logs-turnos — historial de turnos procesados */
app.get('/api/logs-turnos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('logs_turnos')
            .select('*')
            .order('fecha', { ascending: false })
            .limit(20);
        if (error) throw error;
        res.json({ ok: true, logs: data });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

/* POST /api/enviar-uno — remarketing individual */
app.post('/api/enviar-uno', async (req, res) => {
    const { telefono, mensaje, clienteId } = req.body;
    if (!telefono || !mensaje) return res.status(400).json({ ok: false, error: 'Faltan datos.' });
    if (estadoConexion !== 'conectado') return res.status(503).json({ ok: false, error: 'WhatsApp no conectado.' });
    try {
        const numero = telefono.replace(/\D/g, '') + '@c.us';
        await client.sendMessage(numero, mensaje);
        if (clienteId) {
            await supabase.from('clientes').update({ ultimo_remarketing: new Date().toISOString() }).eq('id', clienteId);
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

/* POST /api/enviar-todos — remarketing masivo con cola espaciada */
app.post('/api/enviar-todos', async (req, res) => {
    const { clientes, mensaje } = req.body;
    if (!clientes?.length || !mensaje) return res.status(400).json({ ok: false, error: 'Faltan datos.' });
    if (estadoConexion !== 'conectado') return res.status(503).json({ ok: false, error: 'WhatsApp no conectado.' });

    try {
        const clientesAEnviar = clientes.filter(c => c.telefono);
        const resultado = await enviarConCola(
            clientesAEnviar,
            (c) => mensaje.replace(/{nombre}/gi, c.nombre || 'cliente')
        );
        
        /* Actualizamos la fecha a los que se les envio, omitiendo los fallidos si quisieramos, 
           pero promediamos aca guardandolos a todos los que entraron en la cola */
        const lote = clientesAEnviar.slice(0, MAX_POR_LOTE);
        if (lote.length > 0) {
            const ids = lote.map(c => c.id);
            await supabase.from('clientes').update({ ultimo_remarketing: new Date().toISOString() }).in('id', ids);
        }
        
        res.json({ ok: true, ...resultado });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});


/* ── ARRANQUE ── */
export function arrancarServidor() {
    const instance = app.listen(PORT, () => {
        console.log(`🚀 [Servidor] Corriendo en http://localhost:${PORT}`);
        console.log(`   Dashboard: http://localhost:${PORT}/dashboard.html`);
    });

    instance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ Puerto ${PORT} ocupado. Reintentando en 10s...`);
            setTimeout(arrancarServidor, 10000);
        }
    });
}
