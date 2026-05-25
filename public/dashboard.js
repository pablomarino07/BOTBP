/* ============================================================
   Este script tiene la funcionalidad de controlar el flujo 
   principal e inicialización del panel de administración (Dashboard Frontend),
   gestionando variables globales, navegación de pestañas y
   ayudantes comunes para la API del servidor.

   Utilizando las herramientas:
   - Fetch API nativa (consultas asíncronas)
   ============================================================ */

const API = '/api';
let filtroActual = 'hoy', charts = {}, clientesVencidos = [], estadoWA = 'desconectado', qrInstance = null;

window.onload = async () => {
  /* Verificar sesión primero — redirige a login si no hay sesión activa */
  const session = await verificarSesion();
  if (!session) return;

  /* Mostrar el email del usuario en el header */
  const emailEl = document.getElementById('userEmail');
  if (emailEl) emailEl.textContent = session.usuario;

  verificarEstado();
  setInterval(verificarEstado, 5000);  // ← Polling cada 5s
  cargarDatos();
  cargarLogsTurnos();
};

/* ── API helper ── */
async function api(method, endpoint, body = null) {
  const token = await obtenerToken();
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + endpoint, opts);
  if (res.status === 401) {
    /* Sesión expirada — redirigir a login */
    window.location.replace('/login.html');
    return {};
  }
  return res.json();
}

/* ── Modal personalizado ── */
function customConfirm(title, desc, icon = '⚠️', confirmText = 'Sí, enviar') {
  return new Promise(resolve => {
    const overlay = document.getElementById('customModal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalDesc').innerHTML = desc.replace(/\n/g, '<br>');
    document.getElementById('modalIcon').textContent = icon;

    const btnCancel = document.getElementById('modalBtnCancel');
    const btnConfirm = document.getElementById('modalBtnConfirm');
    btnConfirm.textContent = confirmText;

    const newCancel = btnCancel.cloneNode(true);
    const newConfirm = btnConfirm.cloneNode(true);
    btnCancel.replaceWith(newCancel);
    btnConfirm.replaceWith(newConfirm);

    newCancel.onclick = () => { overlay.classList.remove('active'); resolve(false); };
    newConfirm.onclick = () => { overlay.classList.remove('active'); resolve(true); };
    overlay.classList.add('active');
  });
}

/* ── Estado del servidor ── */
async function verificarEstado() {
  try {
    const data = await api('GET', '/estado');
    estadoWA = data.whatsapp;
    const dot = document.getElementById('serverDot');
    const txt = document.getElementById('serverEstado');
    if (data.whatsapp === 'conectado') { 
      dot.className = 'dot conectado'; 
      txt.textContent = 'WhatsApp conectado'; 
    } else if (data.whatsapp === 'esperando_qr') { 
      dot.className = 'dot esperando'; 
      txt.textContent = 'Esperando escaneo QR'; 
    } else { 
      dot.className = 'dot desconectado'; 
      txt.textContent = 'WhatsApp desconectado'; 
    }

    // Sincronizar estado en página WhatsApp
    const waBadge = document.getElementById('waBotStatus');
    if (waBadge) {
      if (data.whatsapp === 'conectado') { 
        waBadge.textContent = '● Bot Online'; 
        waBadge.className = 'wa-status-badge wa-online'; 
      } else if (data.whatsapp === 'esperando_qr') { 
        waBadge.textContent = '● Esperando QR'; 
        waBadge.className = 'wa-status-badge wa-waiting'; 
      } else { 
        waBadge.textContent = '● Offline'; 
        waBadge.className = 'wa-status-badge wa-offline'; 
      }
    }
    const waLast = document.getElementById('waLastUpdate');
    if (waLast) waLast.textContent = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    if (data.turno1) document.getElementById('turno1Input').value = data.turno1;
    if (data.turno2) document.getElementById('turno2Input').value = data.turno2;
    const alerta = document.getElementById('rmAlerta');
    if (alerta) alerta.style.display = data.whatsapp === 'conectado' ? 'none' : 'block';
    const cbpAlerta = document.getElementById('cbpAlerta');
    if (cbpAlerta) cbpAlerta.style.display = data.whatsapp === 'conectado' ? 'none' : 'block';
  } catch (error) {
    const serverDot = document.getElementById('serverDot');
    const serverEstado = document.getElementById('serverEstado');
    if (serverDot) serverDot.className = 'dot desconectado';
    if (serverEstado) serverEstado.textContent = 'Servidor offline';
    console.error("Error al verificar estado:", error);
  }
}

/* ── Navegación de Pestañas ── */
function cambiarTab(tab, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`page-${tab}`).classList.add('active');
  btn.classList.add('active');

  document.getElementById('filters').style.display = tab === 'metricas' ? 'flex' : 'none';

  // Apagar fondo ámbar si salimos de métricas
  if (tab === 'metricas' && document.getElementById('compararCheck').checked) {
    document.body.classList.add('comparativa-mode');
  } else {
    document.body.classList.remove('comparativa-mode');
  }

  if (tab === 'whatsapp') cargarQR();
  if (tab === 'remarketing') actualizarVencidos();
  if (tab === 'clubbigpizza') cargarMiembrosClub();
  if (tab === 'turnos') {
    cargarLogsTurnos();
    cargarDescartados();
  }
}

/* ── Helpers de Formato y UI ── */
function fmt(n) { return '$' + Math.round(n).toLocaleString('es-AR'); }

function formatoCorta(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function mostrarFeedback(msg, tipo) {
  const el = document.getElementById('rmFeedback');
  if (!el) return;
  el.className = tipo === 'error' ? 'error-msg' : 'success-msg';
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}

/* ── Auto-refresh cada 2 minutos ── */
setInterval(() => {
  cargarDatos();
  if (document.getElementById('page-remarketing').classList.contains('active')) {
    actualizarVencidos();
  }
  if (document.getElementById('page-clubbigpizza').classList.contains('active')) {
    cargarMiembrosClub();
  }
  if (document.getElementById('page-turnos').classList.contains('active')) {
    cargarDescartados();
  }
}, 120000);
