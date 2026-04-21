/* ============================================================
   dashboard.js — Lógica del Dashboard Big Pizza PARANA
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
    if (waLast) waLast.textContent = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

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
  if (tab === 'turnos') {
    cargarLogsTurnos();
    cargarDescartados();
  }
}

/* ── Filtros de métricas Avanzados ── */
function cambiarFiltroSelect() {
  const val = document.getElementById('filtroSelect').value;
  document.getElementById('rangoPersonalizado').style.display = val === 'personalizado' ? 'flex' : 'none';
  toggleComparar();
}

function toggleComparar() {
  const chk = document.getElementById('compararCheck').checked;
  const val = document.getElementById('filtroSelect').value;
  document.getElementById('compararPersonalizado').style.display = (chk && val === 'personalizado') ? 'flex' : 'none';
  cargarDatos();
}

function getFechas() {
  const select = document.getElementById('filtroSelect').value;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const finHoy = new Date(hoy);
  finHoy.setHours(23, 59, 59, 999);

  let desde, hasta, prevDesde, prevHasta;

  if (select === 'hoy') {
    desde = new Date(hoy); hasta = new Date(finHoy);
    prevDesde = new Date(hoy); prevDesde.setDate(prevDesde.getDate() - 1);
    prevHasta = new Date(finHoy); prevHasta.setDate(prevHasta.getDate() - 1);
  } else if (select === 'ayer') {
    desde = new Date(hoy); desde.setDate(desde.getDate() - 1);
    hasta = new Date(finHoy); hasta.setDate(hasta.getDate() - 1);
    prevDesde = new Date(desde); prevDesde.setDate(prevDesde.getDate() - 1);
    prevHasta = new Date(hasta); prevHasta.setDate(prevHasta.getDate() - 1);
  } else if (select === 'semana') {
    desde = new Date(hoy); desde.setDate(desde.getDate() - 6);
    hasta = new Date(finHoy);
    prevDesde = new Date(desde); prevDesde.setDate(prevDesde.getDate() - 7);
    prevHasta = new Date(hasta); prevHasta.setDate(prevHasta.getDate() - 7);
  } else if (select === 'semana_pasada') {
    const d = new Date(hoy);
    const day = d.getDay() === 0 ? 7 : d.getDay();
    hasta = new Date(hoy); hasta.setDate(hasta.getDate() - day);
    hasta.setHours(23, 59, 59, 999);
    desde = new Date(hasta); desde.setDate(desde.getDate() - 6);
    desde.setHours(0, 0, 0, 0);
    prevDesde = new Date(desde); prevDesde.setDate(prevDesde.getDate() - 7);
    prevHasta = new Date(hasta); prevHasta.setDate(prevHasta.getDate() - 7);
  } else if (select === 'mes') {
    desde = new Date(hoy); desde.setDate(desde.getDate() - 29);
    hasta = new Date(finHoy);
    prevDesde = new Date(desde); prevDesde.setDate(prevDesde.getDate() - 30);
    prevHasta = new Date(hasta); prevHasta.setDate(prevHasta.getDate() - 30);
  } else if (select === 'mes_calendario') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    hasta = new Date(finHoy);
    prevDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    prevHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999);
  } else if (select === 'mes_calendario_pasado') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999);
    prevDesde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
    prevHasta = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 0, 23, 59, 59, 999);
  } else if (select === 'personalizado') {
    desde = document.getElementById('fechaDesde').value ? new Date(document.getElementById('fechaDesde').value + 'T00:00:00') : new Date(hoy);
    hasta = document.getElementById('fechaHasta').value ? new Date(document.getElementById('fechaHasta').value + 'T23:59:59') : new Date(finHoy);
    prevDesde = document.getElementById('compDesde').value ? new Date(document.getElementById('compDesde').value + 'T00:00:00') : null;
    prevHasta = document.getElementById('compHasta').value ? new Date(document.getElementById('compHasta').value + 'T23:59:59') : null;
  } else if (select === 'todo') {
    return { desde: null, hasta: null, prevDesde: null, prevHasta: null };
  }

  return {
    desde: desde ? desde.toISOString() : null,
    hasta: hasta ? hasta.toISOString() : null,
    prevDesde: prevDesde ? prevDesde.toISOString() : null,
    prevHasta: prevHasta ? prevHasta.toISOString() : null
  };
}

/* ── Datos / KPIs ── */
async function cargarDatos() {
  try {
    document.getElementById('lastUpdate').textContent = 'Sincronizando...';

    const { desde, hasta, prevDesde, prevHasta } = getFechas();
    const comparar = document.getElementById('compararCheck').checked;

    let url = '/metricas?';
    if (desde) url += `desde=${desde}&`;
    if (hasta) url += `hasta=${hasta}&`;

    const p1 = api('GET', url);
    let p2 = null;

    if (comparar && prevDesde && prevHasta) {
      let prevUrl = `/metricas?desde=${prevDesde}&hasta=${prevHasta}`;
      p2 = api('GET', prevUrl);

      const txt = document.getElementById('filtroSelect').options[document.getElementById('filtroSelect').selectedIndex].text;
      const b = document.getElementById('comparativaBanner');
      if (b) {
        b.style.display = 'block';
        b.innerHTML = `<strong>Modo Comparativo:</strong> Analizando ${txt} (${formatoCorta(desde)} - ${formatoCorta(hasta)}) vs. Anterior (${formatoCorta(prevDesde)} - ${formatoCorta(prevHasta)}).`;
      }
    } else {
      if (document.getElementById('comparativaBanner')) document.getElementById('comparativaBanner').style.display = 'none';
    }

    if (comparar) {
        document.body.classList.add('comparativa-mode');
    } else {
        document.body.classList.remove('comparativa-mode');
    }

    const [data1, data2] = p2 ? await Promise.all([p1, p2]) : [await p1, null];

    if (!data1.ok) throw new Error(data1.error);

    renderKPIs(data1.pedidos, data1.clientes, data2 ? data2.pedidos : null);
    renderChartVentas(data1.pedidos);
    renderChartProductos(data1.pedidos);
    renderChartHoras(data1.pedidos);
    renderTablaClientes(data1.pedidos, data1.clientes);
    document.getElementById('lastUpdate').textContent = `Métricas sincronizadas: ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { document.getElementById('lastUpdate').textContent = '❌ Error'; }
}

function renderTendencia(elementId, actual, anterior, esDinero = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (anterior === null || anterior === undefined || anterior === 0) {
    el.style.display = 'none';
    return;
  }

  const dif = actual - anterior;
  const poc = (dif / anterior) * 100;

  el.style.display = 'inline-flex';
  el.className = 'kpi-trend ' + (poc > 0 ? 'trend-up' : (poc < 0 ? 'trend-down' : 'trend-neutral'));

  const txt = Math.abs(poc).toFixed(1) + '%';
  const numDelta = esDinero ? fmt(Math.abs(dif)) : Math.abs(dif);

  if (poc > 0) el.innerHTML = `▲ ${txt} (+${numDelta})`;
  else if (poc < 0) el.innerHTML = `▼ ${txt} (-${numDelta})`;
  else el.innerHTML = `— 0%`;
}

function fmt(n) { return '$' + Math.round(n).toLocaleString('es-AR'); }

function formatoCorta(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function renderKPIs(pedidos, clientes, pedidosAnteriores = null) {
  const total = pedidos.reduce((s, p) => s + (p.monto_total || 0), 0);
  const ticket = pedidos.length ? total / pedidos.length : 0;
  const cu = new Set(pedidos.map(p => p.cliente_id)).size;

  if (pedidosAnteriores && document.getElementById('compararCheck').checked) {
    const totalPrev = pedidosAnteriores.reduce((s, p) => s + (p.monto_total || 0), 0);
    const ticketPrev = pedidosAnteriores.length ? totalPrev / pedidosAnteriores.length : 0;
    renderTendencia('trendVentas', total, totalPrev, true);
    renderTendencia('trendPedidos', pedidos.length, pedidosAnteriores.length, false);
    renderTendencia('trendTicket', ticket, ticketPrev, true);
  } else {
    ['trendVentas', 'trendPedidos', 'trendTicket'].forEach(id => {
      if (document.getElementById(id)) document.getElementById(id).style.display = 'none';
    });
  }

  const mediodia = pedidos.filter(p => {
    const h = new Date(p.fecha).getUTCHours();
    return h >= 11 && h <= 15;
  });

  const noche = pedidos.filter(p => {
    const d = new Date(p.fecha);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    return (h >= 20 && h <= 22) || (h === 23 && m <= 30);
  });

  const getPromedio = (arr) => {
    if (!arr.length) return '—';
    const totalMins = arr.reduce((sum, p) => {
      const d = new Date(p.fecha);
      return sum + (d.getUTCHours() * 60 + d.getUTCMinutes());
    }, 0);
    const avg = Math.round(totalMins / arr.length);
    const h = Math.floor(avg / 60);
    const m = (avg % 60).toString().padStart(2, '0');
    return `${h}:${m}hs`;
  };

  const hpMediodia = getPromedio(mediodia);
  const hpNoche = getPromedio(noche);

  const txtPeriodo = document.getElementById('filtroSelect').options[document.getElementById('filtroSelect').selectedIndex].text.toLowerCase();

  document.getElementById('kpiVentas').textContent = fmt(total);
  document.getElementById('kpiVentasSub').textContent = txtPeriodo;
  document.getElementById('kpiPedidos').textContent = pedidos.length;
  document.getElementById('kpiTicket').textContent = fmt(ticket);
  document.getElementById('kpiClientes').textContent = cu;
  document.getElementById('kpiClientesSub').textContent = `de ${clientes.length} totales`;
  document.getElementById('kpiHora').textContent = hpMediodia === '—' && hpNoche === '—' ? '—' : `${hpMediodia} | ${hpNoche}`;
  document.getElementById('kpiHora').style.fontSize = '1.3rem';
  document.getElementById('kpiHora').nextElementSibling.textContent = 'promedio mediodía | noche';
}

/* ── Charts ── */
function renderChartVentas(pedidos) {
  const pd = {}; pedidos.forEach(p => { const dObj = new Date(p.fecha); const dia = dObj.getUTCDate().toString().padStart(2, '0'); const mes = (dObj.getUTCMonth() + 1).toString().padStart(2, '0'); const d = `${dia}/${mes}`; pd[d] = (pd[d] || 0) + (p.monto_total || 0); });
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
  const hs = Array(24).fill(0); pedidos.forEach(p => { hs[new Date(p.fecha).getUTCHours()]++; });
  if (charts.horas) charts.horas.destroy();
  charts.horas = new Chart(document.getElementById('chartHoras'), {
    type: 'line', data: {
      labels: Array.from({ length: 24 },
        (_, i) => `${i}hs`), datasets: [{
          data: hs, borderColor: '#f5c518', backgroundColor: '#f5c51820',
          fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#f5c518'
        }]
    }, options: {
      responsive: true, maintainAspectRatio: false, plugins:
        { legend: { display: false } }, scales: {
          x: { ticks: { color: '#7a7568', font: { size: 9 }, maxTicksLimit: 12 }, grid: { color: '#2e2c26' } }
          , y: { ticks: { color: '#7a7568', font: { size: 10 }, stepSize: 1 }, grid: { color: '#2e2c26' } }
        }
    }
  });
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
    el.innerHTML = data.logs.map(l => `<div class="log-item"><div class="log-fecha">${new Date(l.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div><span class="badge-yellow" style="font-size:.72rem">${l.origen}</span><div class="log-stats"><span class="badge">${l.conversaciones || 0} Conv. Totales</span><span class="badge-green">${l.pedidos_guardados} pedidos</span>${l.errores > 0 ? `<span class="badge-red">${l.errores} err</span>` : ''}</div></div>`).join('');
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
  if (document.getElementById('page-turnos').classList.contains('active')) {
    cargarDescartados();
  }
}, 120000);

/* ── Chats Descartados ── */
async function cargarDescartados() {
  const el = document.getElementById('listaDescartados');
  if (!el) return;
  el.innerHTML = '<div class="loading" style="padding: 20px;"><div class="spinner"></div> Cargando...</div>';
  try {
    const data = await api('GET', '/chats-descartados');
    if (!data.ok || !data.descartados?.length) {
      el.innerHTML = '<div style="padding:40px 20px; text-align:center; color:var(--muted);">No hay chats descartados en los últimos 7 días.</div>';
      return;
    }

    el.innerHTML = data.descartados.map(c => {
      // Intentamos procesar el formato del historial que suele venir como arreglo de strings
      const msgsData = Array.isArray(c.mensajes) ? c.mensajes : (typeof c.mensajes === 'string' ? c.mensajes.split('\\n') : []);
      let msgsHtml = '';
      if (msgsData.length > 0) {
        msgsHtml = msgsData.map(m => {
          if (!m.trim()) return '';
          const isBot = m.toLowerCase().includes('==>');
          return `<div style="margin-bottom: 8px; padding: 8px 12px; border-radius: 8px; background: ${isBot ? 'var(--dark-lighter)' : '#f5631a1a'}; border: 1px solid var(--glass-border); width: fit-content; max-width: 85%; ${!isBot ? 'margin-left: auto; border-color: #f5631a40;' : ''}">${m.replace(/==>|\\*\\*Usuario\\*\\*:/i, '').trim()}</div>`;
        }).join('');
      } else {
        msgsHtml = `<div style="color:var(--muted)">Sin registro de mensajes</div>`;
      }

      return `
      <div class="cliente-vencido" style="flex-direction: column; align-items: stretch; padding: 15px; border-bottom: 1px solid var(--glass-border); background: transparent;">
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer" onclick="document.getElementById('msg-${c.id}').style.display = document.getElementById('msg-${c.id}').style.display === 'none' ? 'block' : 'none'">
            <div style="display: flex; align-items: center; gap: 12px">
                <div class="client-avatar" style="background: var(--dark-lighter)">💬</div>
                <div>
                   <div class="cv-nombre">${c.telefono}</div>
                   <div class="cv-detalle">📅 ${new Date(c.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            </div>
            <button class="btn-ghost btn-sm" style="pointer-events: none;">Ver Chat ↓</button>
        </div>
        <div id="msg-${c.id}" style="display: none; margin-top: 15px; padding: 15px; background: var(--dark-bg); border-radius: 8px; font-size: 0.9rem;">
           ${msgsHtml}
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div class="error-msg" style="margin: 20px;">Error cargando descartados: ${e.message}</div>`;
  }
}

