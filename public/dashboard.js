/* ============================================================
   dashboard.js — Lógica del Dashboard Big Pizza PARANA
   ============================================================ */

const API = 'http://localhost:3000/api';
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
    if (data.whatsapp === 'conectado') { dot.className = 'dot conectado'; txt.textContent = 'WhatsApp conectado'; }
    else if (data.whatsapp === 'esperando_qr') { dot.className = 'dot esperando'; txt.textContent = 'Esperando escaneo QR'; }
    else { dot.className = 'dot desconectado'; txt.textContent = 'WhatsApp desconectado'; }

    // Sincronizar estado en página WhatsApp
    const waBadge = document.getElementById('waBotStatus');
    if (waBadge) {
      if (data.whatsapp === 'conectado') { waBadge.textContent = '● Bot Online'; waBadge.className = 'wa-status-badge wa-online'; }
      else if (data.whatsapp === 'esperando_qr') { waBadge.textContent = '● Esperando QR'; waBadge.className = 'wa-status-badge wa-waiting'; }
      else { waBadge.textContent = '● Offline'; waBadge.className = 'wa-status-badge wa-offline'; }
    }
    const waLast = document.getElementById('waLastUpdate');
    if (waLast) waLast.textContent = document.getElementById('lastUpdate').textContent;

    if (data.turno1) document.getElementById('turno1Input').value = data.turno1;
    if (data.turno2) document.getElementById('turno2Input').value = data.turno2;
    const alerta = document.getElementById('rmAlerta');
    if (alerta) alerta.style.display = data.whatsapp === 'conectado' ? 'none' : 'block';
  } catch {
    document.getElementById('serverDot').className = 'dot desconectado';
    document.getElementById('serverEstado').textContent = 'Servidor offline';
  }
}

/* ── QR ── */
async function cargarQR() {
  const area = document.getElementById('qrArea');
  if (estadoWA === 'conectado') { area.innerHTML = '<div class="qr-conectado">WhatsApp ya está conectado</div>'; return; }
  area.innerHTML = '<div class="loading"><div class="spinner"></div> Cargando QR...</div>';
  try {
    const data = await api('GET', '/qr');
    if (!data.ok) { area.innerHTML = `<div style="color:var(--muted);font-size:.85rem;padding:20px">${data.mensaje || 'QR no disponible aún. Esperá y actualizá.'}</div>`; return; }
    area.innerHTML = '<div id="qrCanvas"></div>';
    qrInstance = new QRCode(document.getElementById('qrCanvas'), {
      text: data.qr,
      width: 240,
      height: 240,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.L // Nivel L es vital para WhatsApp QRs largos
    });
  } catch (e) {
    area.innerHTML = `<div class="error-msg">Error: ${e.message}</div>`;
    console.error("Error cargando QR:", e);
  }
}

/* ── Tabs ── */
function cambiarTab(tab, btn) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('page-' + tab).classList.add('active');
  document.getElementById('filters').style.display = tab === 'metricas' ? 'flex' : 'none';
  if (tab === 'whatsapp') cargarQR();
  if (tab === 'remarketing') actualizarVencidos();
  if (tab === 'turnos') cargarLogsTurnos();
}

/* ── Filtros de métricas ── */
function setFiltro(filtro, btn) {
  filtroActual = filtro;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cargarDatos();
}

function getFechaDesde() {
  const now = new Date();
  if (filtroActual === 'hoy') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  if (filtroActual === 'semana') { const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString(); }
  if (filtroActual === 'mes') { const d = new Date(now); d.setDate(d.getDate() - 30); return d.toISOString(); }
  return null;
}

/* ── Datos / KPIs ── */
async function cargarDatos() {
  try {
    document.getElementById('lastUpdate').textContent = 'Actualizando...';
    const desde = getFechaDesde();
    const data = await api('GET', '/metricas' + (desde ? `?desde=${desde}` : ''));
    if (!data.ok) throw new Error(data.error);
    renderKPIs(data.pedidos, data.clientes);
    renderChartVentas(data.pedidos);
    renderChartProductos(data.pedidos);
    renderChartHoras(data.pedidos);
    renderTablaClientes(data.pedidos, data.clientes);
    document.getElementById('lastUpdate').textContent = `Actualizado ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { document.getElementById('lastUpdate').textContent = '❌ Error'; }
}

function fmt(n) { return '$' + Math.round(n).toLocaleString('es-AR'); }

function renderKPIs(pedidos, clientes) {
  const total = pedidos.reduce((s, p) => s + (p.monto_total || 0), 0);
  const ticket = pedidos.length ? total / pedidos.length : 0;
  const cu = new Set(pedidos.map(p => p.cliente_id)).size;
  const hs = {}; pedidos.forEach(p => { const h = new Date(p.fecha).getHours(); hs[h] = (hs[h] || 0) + 1; });
  const hp = Object.entries(hs).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('kpiVentas').textContent = fmt(total);
  document.getElementById('kpiVentasSub').textContent = filtroActual === 'hoy' ? 'hoy' : filtroActual === 'semana' ? 'últimos 7 días' : filtroActual === 'mes' ? 'últimos 30 días' : 'total histórico';
  document.getElementById('kpiPedidos').textContent = pedidos.length;
  document.getElementById('kpiTicket').textContent = fmt(ticket);
  document.getElementById('kpiClientes').textContent = cu;
  document.getElementById('kpiClientesSub').textContent = `de ${clientes.length} totales`;
  document.getElementById('kpiHora').textContent = hp ? `${hp[0]}hs` : '—';
}

/* ── Charts ── */
function renderChartVentas(pedidos) {
  const pd = {}; pedidos.forEach(p => { const d = new Date(p.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }); pd[d] = (pd[d] || 0) + (p.monto_total || 0); });
  const labels = Object.keys(pd).slice(-14);
  if (charts.ventas) charts.ventas.destroy();
  charts.ventas = new Chart(document.getElementById('chartVentas'), { type: 'bar', data: { labels, datasets: [{ data: labels.map(l => pd[l]), backgroundColor: '#f5631a99', borderColor: '#f5631a', borderWidth: 1, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#7a7568', font: { size: 10 } }, grid: { color: '#2e2c26' } }, y: { ticks: { color: '#7a7568', font: { size: 10 }, callback: v => '$' + v.toLocaleString('es-AR') }, grid: { color: '#2e2c26' } } } } });
}

function renderChartProductos(pedidos) {
  const c = {}; pedidos.forEach(p => (p.items_json || []).forEach(i => { const n = i.producto_oficial || i.producto || 'Desconocido'; c[n] = (c[n] || 0) + (i.cantidad || 1); }));
  const s = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const colors = ['#f5631a', '#f5c518', '#e8562f', '#f0a830', '#c94d1a', '#d4b020', '#b84416', '#c09a18'];
  if (charts.productos) charts.productos.destroy();
  charts.productos = new Chart(document.getElementById('chartProductos'), { type: 'doughnut', data: { labels: s.map(([k]) => k.length > 22 ? k.slice(0, 20) + '…' : k), datasets: [{ data: s.map(([, v]) => v), backgroundColor: colors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#f0ede6', font: { size: 10 }, boxWidth: 10, padding: 8 } } } } });
}

function renderChartHoras(pedidos) {
  const hs = Array(24).fill(0); pedidos.forEach(p => { hs[new Date(p.fecha).getHours()]++; });
  if (charts.horas) charts.horas.destroy();
  charts.horas = new Chart(document.getElementById('chartHoras'), { type: 'line', data: { labels: Array.from({ length: 24 }, (_, i) => `${i}hs`), datasets: [{ data: hs, borderColor: '#f5c518', backgroundColor: '#f5c51820', fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#f5c518' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#7a7568', font: { size: 9 }, maxTicksLimit: 12 }, grid: { color: '#2e2c26' } }, y: { ticks: { color: '#7a7568', font: { size: 10 }, stepSize: 1 }, grid: { color: '#2e2c26' } } } } });
}

function renderTablaClientes(pedidos, clientes) {
  const por = {}, tot = {};
  pedidos.forEach(p => { por[p.cliente_id] = (por[p.cliente_id] || 0) + 1; tot[p.cliente_id] = (tot[p.cliente_id] || 0) + (p.monto_total || 0); });
  const lista = clientes.filter(c => por[c.id]).map(c => ({ ...c, cant: por[c.id] || 0, total: tot[c.id] || 0 })).sort((a, b) => b.cant - a.cant).slice(0, 8);
  if (!lista.length) { document.getElementById('tablaClientes').innerHTML = '<div class="loading" style="color:#7a7568">Sin datos</div>'; return; }
  document.getElementById('tablaClientes').innerHTML = `<table><thead><tr><th>Cliente</th><th>Teléfono</th><th>Pedidos</th><th>Total</th></tr></thead><tbody>${lista.map(c => `<tr><td>${c.nombre || 'Sin nombre'}</td><td style="color:#7a7568;font-size:.75rem">${c.telefono || '—'}</td><td><span class="badge">${c.cant} pedido${c.cant > 1 ? 's' : ''}</span></td><td style="color:#f5c518">${fmt(c.total)}</td></tr>`).join('')}</tbody></table>`;
}

/* ── Turnos ── */
async function guardarTurnos() {
  const t1 = document.getElementById('turno1Input').value;
  const t2 = document.getElementById('turno2Input').value;
  const fb = document.getElementById('turnosFeedback');
  try {
    const data = await api('POST', '/configurar-turnos', { turno1: t1, turno2: t2 });
    fb.className = data.ok ? 'success-msg' : 'error-msg';
    fb.textContent = data.ok ? `✅ Guardado: ${t1} y ${t2}` : data.error;
    fb.style.display = 'block'; setTimeout(() => fb.style.display = 'none', 4000);
  } catch { fb.className = 'error-msg'; fb.textContent = 'Error de conexión.'; fb.style.display = 'block'; }
}

async function procesarAhora() {
  const btn = document.getElementById('btnProcesarAhora');
  btn.disabled = true; btn.textContent = 'Procesando...';
  try {
    const data = await api('POST', '/procesar-ahora');
    document.getElementById('resTotal').textContent = data.procesados ?? '—';
    document.getElementById('resPedidos').textContent = data.pedidos ?? '—';
    document.getElementById('resDescartados').textContent = data.descartados ?? '—';
    document.getElementById('resErrores').textContent = data.errores ?? '—';
    document.getElementById('resultadoProceso').style.display = 'block';
    await cargarDatos(); await cargarLogsTurnos();
  } catch { alert('No se pudo conectar. Asegurate que npm start esté corriendo.'); }
  finally { btn.disabled = false; btn.textContent = 'Procesar ahora'; }
}

async function cargarLogsTurnos() {
  const el = document.getElementById('logsTurnos');
  if (!el) return;
  try {
    const data = await api('GET', '/logs-turnos');
    if (!data.ok || !data.logs?.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:12px">Sin historial aún.</div>'; return; }
    el.innerHTML = data.logs.map(l => `<div class="log-item"><div class="log-fecha">${new Date(l.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div><span class="badge-yellow" style="font-size:.72rem">${l.origen}</span><div class="log-stats"><span class="badge">${l.conversaciones} conv.</span><span class="badge-green">${l.pedidos_guardados} pedidos</span>${l.errores > 0 ? `<span class="badge-red">${l.errores} err</span>` : ''}</div></div>`).join('');
  } catch { el.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:12px">Error cargando logs.</div>'; }
}

/* ── Remarketing: filtro chips ── */
function seleccionarFiltroChip(valor) {
  ['todos', 'nunca', 'recibieron'].forEach(v => {
    const chip = document.getElementById(`chip-${v}`);
    const radio = chip?.querySelector('input[type="radio"]');
    if (chip) chip.classList.toggle('selected', v === valor);
    if (radio) radio.checked = v === valor;
  });
  renderListaVencidos(clientesVencidos, document.getElementById('rmDias').value);
}

async function actualizarVencidos() {
  const dias = parseInt(document.getElementById('rmDias').value) || 30;
  document.getElementById('rmDiasLabel').textContent = dias;
  document.getElementById('listaVencidos').innerHTML = '<div class="loading"><div class="spinner"></div> Cargando...</div>';
  try {
    const data = await api('GET', `/clientes-vencidos?dias=${dias}`);
    clientesVencidos = data.clientes || [];
    renderListaVencidos(clientesVencidos, dias);
  } catch (e) { document.getElementById('listaVencidos').innerHTML = `<div class="error-msg">Error: ${e.message}</div>`; }
}

function renderListaVencidos(clientes, dias) {
  const selectedRadio = document.querySelector('input[name="rmFiltroEstadoRadio"]:checked');
  const filtro = selectedRadio ? selectedRadio.value : 'todos';

  let clientesFiltrados = clientes;
  if (filtro === 'nunca') clientesFiltrados = clientes.filter(c => !c.ultimo_remarketing);
  else if (filtro === 'recibieron') clientesFiltrados = clientes.filter(c => c.ultimo_remarketing);

  const count = clientesFiltrados.length;
  document.getElementById('rmContador').textContent = count;
  document.getElementById('vencidosTitulo').textContent = `${count} cliente${count !== 1 ? 's' : ''} sin comprar hace +${dias} días`;

  if (!clientesFiltrados.length) {
    document.getElementById('listaVencidos').innerHTML = `<div class="empty-state"><div class="emoji">🎉</div><p>No hay clientes que coincidan con este filtro.</p></div>`;
    return;
  }

  const hoy = new Date();
  document.getElementById('listaVencidos').innerHTML = clientesFiltrados.map(c => {
    const uComp = new Date(c.ultima_compra); uComp.setHours(0, 0, 0, 0);
    const hoySolo = new Date(hoy); hoySolo.setHours(0, 0, 0, 0);
    const ds = Math.round((hoySolo - uComp) / (1000 * 60 * 60 * 24));
    const ult = new Date(c.ultima_compra).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const bc = ds > 60 ? 'badge-red' : 'badge-yellow';
    const ne = (c.nombre || '').replace(/'/g, "\\'");
    const te = (c.telefono || '').replace(/'/g, "\\'");
    const inicial = (c.nombre || '?')[0].toUpperCase();

    let infoRm = '';
    if (c.ultimo_remarketing) {
      const udRm = new Date(c.ultimo_remarketing); udRm.setHours(0, 0, 0, 0);
      const diasRm = Math.round((hoySolo - udRm) / (1000 * 60 * 60 * 24));
      const color = diasRm < 30 ? 'color:var(--orange)' : 'color:var(--green)';
      const textoTiempo = diasRm === 0 ? 'hoy' : (diasRm === 1 ? 'ayer' : `hace ${diasRm} días`);
      infoRm = ` · <span style="${color}">📣 Enviado ${textoTiempo}</span>`;
    }

    return `<div class="cliente-vencido" id="cv-${c.id}"><div class="client-avatar">${inicial}</div><div class="cv-info"><div class="cv-nombre">${c.nombre || 'Sin nombre'}</div><div class="cv-detalle">📱 ${c.telefono || 'Sin número'} · Última compra: ${ult}${infoRm}</div><div style="margin-top:6px"><span class="${bc}">${ds} días sin comprar</span></div></div><div class="cv-dias">${ds}<small>días</small></div><button class="btn-ghost" style="font-size:.75rem;white-space:nowrap;padding:6px 12px" id="btn-cv-${c.id}" onclick="enviarUno('${te}','${ne}','${c.id}')">Enviar →</button></div>`;
  }).join('');
}

function actualizarPreview() {
  const msg = document.getElementById('rmMensaje').value;
  document.getElementById('rmPreview').textContent = msg ? msg.replace(/{nombre}/gi, 'Juan') : 'Escribí el mensaje arriba...';
}

/* ── Envío individual ── */
async function enviarUno(telefono, nombre, clienteId) {
  const msg = document.getElementById('rmMensaje').value.trim().replace(/{nombre}/gi, nombre || 'cliente');
  if (!msg) { mostrarFeedback('Escribí el mensaje.', 'error'); return; }
  if (!telefono) { mostrarFeedback('Sin número.', 'error'); return; }

  const cliente = clientesVencidos.find(c => c.id == clienteId);
  if (cliente && cliente.ultimo_remarketing) {
    const hSolo = new Date(); hSolo.setHours(0, 0, 0, 0);
    const udRm = new Date(cliente.ultimo_remarketing); udRm.setHours(0, 0, 0, 0);
    const diasRm = Math.round((hSolo - udRm) / (1000 * 60 * 60 * 24));
    if (diasRm < 30) {
      const textoTiempo = diasRm === 0 ? 'hoy' : (diasRm === 1 ? 'ayer' : `hace ${diasRm} días`);
      const confirmMsg = `Le enviaste un remarketing a este cliente <strong>${textoTiempo}</strong>.\n\n¿Estás seguro de que querés volver a mandarle un mensaje?`;
      const seguro = await customConfirm('Cuidado con el spam', confirmMsg, '⚠️');
      if (!seguro) return;
    }
  }

  const btn = document.getElementById(`btn-cv-${clienteId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
  try {
    const data = await api('POST', '/enviar-uno', { telefono, mensaje: msg, clienteId });
    if (data.ok) {
      document.getElementById(`cv-${clienteId}`)?.classList.add('enviado');
      if (btn) { btn.textContent = '✅ Enviado'; btn.style.color = 'var(--green)'; }
      setTimeout(actualizarVencidos, 1000);
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Enviar →'; }
      mostrarFeedback(`Error: ${data.error}`, 'error');
    }
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar →'; }
    mostrarFeedback('Error de conexión.', 'error');
  }
}

/* ── Envío masivo ── */
async function enviarTodos() {
  const msg = document.getElementById('rmMensaje').value.trim();
  if (!msg) { mostrarFeedback('Escribí el mensaje.', 'error'); return; }
  const ct = clientesVencidos.filter(c => c.telefono);
  if (!ct.length) { mostrarFeedback('Ningún cliente tiene número.', 'error'); return; }

  const hSolo = new Date(); hSolo.setHours(0, 0, 0, 0);
  const recientes = ct.filter(c => {
    if (!c.ultimo_remarketing) return false;
    const u = new Date(c.ultimo_remarketing); u.setHours(0, 0, 0, 0);
    return Math.round((hSolo - u) / (1000 * 60 * 60 * 24)) < 30;
  });

  if (recientes.length > 0) {
    const confirmMsg = `Hay <strong>${recientes.length} clientes</strong> en esta lista que recibieron remarketing hace menos de 30 días.\n\n¿Estás súper seguro de que querés enviarles el mensaje a TODOS de todos modos?`;
    const seguro = await customConfirm('Múltiples Remarketings', confirmMsg, '🚨', 'Enviar a todos');
    if (!seguro) return;
  }

  document.getElementById('rmProgreso').style.display = 'block';
  document.getElementById('btnEnviarTodos').disabled = true;
  document.getElementById('rmProgresoTexto').textContent = `Enviando a ${ct.length} clientes...`;
  try {
    const data = await api('POST', '/enviar-todos', { clientes: ct, mensaje: msg });
    document.getElementById('rmProgresoBar').style.width = '100%';
    document.getElementById('rmProgresoDetalle').textContent = `✅ ${data.enviados} enviados · ❌ ${data.fallidos} fallidos${data.omitidos ? ` · ⚠️ ${data.omitidos} omitidos` : ''}`;
    mostrarFeedback(`${data.enviados} mensajes enviados.`, 'success');
    actualizarVencidos();
  } catch { mostrarFeedback('Error de conexión.', 'error'); }
  finally {
    setTimeout(() => {
      document.getElementById('btnEnviarTodos').disabled = false;
      document.getElementById('rmProgreso').style.display = 'none';
      document.getElementById('rmProgresoBar').style.width = '0%';
    }, 5000);
  }
}

function mostrarFeedback(msg, tipo) {
  const el = document.getElementById('rmFeedback');
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
}, 120000);
