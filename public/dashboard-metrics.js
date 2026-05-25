/* ============================================================
   MÓDULO: dashboard-metrics.js
   Funcionalidad: Gestión de filtros temporales, renderizado de KPIs,
   carga de datos y generación de gráficos interactivos (Chart.js)
   para la sección de Métricas.
   ============================================================ */

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
  } catch (error) { 
    document.getElementById('lastUpdate').textContent = '❌ Error';
    console.error("Error al cargar datos:", error);
  }
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
