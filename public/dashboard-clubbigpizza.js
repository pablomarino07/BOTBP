/* ============================================================
   MÓDULO: dashboard-clubbigpizza.js
   Funcionalidad: Club Big Pizza — filtra clientes por cantidad
   de pedidos acumulados en el período de tiempo seleccionado
   (el mismo selector de la página de Métricas) y permite
   enviarles un mensaje masivo o individual.
   ============================================================ */

/* Variable global para los miembros del club */
let miembrosClub = [];

/* ── Umbral mínimo de pedidos ── */
function actualizarClub() {
  const minPedidos = parseInt(document.getElementById('cbpMinPedidos').value) || 3;
  document.getElementById('cbpMinLabel').textContent = minPedidos;
  document.getElementById('cbpMinLabel2').textContent = minPedidos;
  cargarMiembrosClub();
}

/* ── Carga los clientes que cumplen el umbral en el período actual ── */
async function cargarMiembrosClub() {
  const minPedidos = parseInt(document.getElementById('cbpMinPedidos').value) || 3;
  document.getElementById('cbpLista').innerHTML = '<div class="loading"><div class="spinner"></div> Cargando...</div>';

  /* Obtener las fechas del filtro global de métricas */
  const { desde, hasta } = obtenerRangoFiltro();

  try {
    let url = `/clientes-club?minPedidos=${minPedidos}`;
    if (desde) url += `&desde=${desde}`;
    if (hasta) url += `&hasta=${hasta}`;

    const data = await api('GET', url);
    miembrosClub = data.clientes || [];
    renderMiembrosClub(miembrosClub);
  } catch (e) {
    document.getElementById('cbpLista').innerHTML = `<div class="error-msg">Error: ${e.message}</div>`;
    console.error('Error al cargar club big pizza:', e);
  }
}

/* ── Manejo del selector de período propio del Club ── */
function cbpCambiarFiltro() {
  const sel = document.getElementById('cbpFiltroSelect')?.value;
  document.getElementById('cbpRangoPersonalizado').style.display =
    sel === 'personalizado' ? 'block' : 'none';
  cargarMiembrosClub();
}

/* ── Obtiene el rango de fechas del selector propio del Club ── */
function obtenerRangoFiltro() {
  const sel = document.getElementById('cbpFiltroSelect')?.value || 'mes';
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  let desde = null, hasta = hoy.toISOString();

  switch (sel) {
    case 'hoy': {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      desde = d.toISOString(); break;
    }
    case 'ayer': {
      const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0);
      const h = new Date(d); h.setHours(23, 59, 59, 999);
      desde = d.toISOString(); hasta = h.toISOString(); break;
    }
    case 'semana': {
      const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0);
      desde = d.toISOString(); break;
    }
    case 'semana_pasada': {
      const lunes = new Date();
      lunes.setDate(lunes.getDate() - lunes.getDay() - 6);
      lunes.setHours(0, 0, 0, 0);
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6); domingo.setHours(23, 59, 59, 999);
      desde = lunes.toISOString(); hasta = domingo.toISOString(); break;
    }
    case 'mes': {
      const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0);
      desde = d.toISOString(); break;
    }
    case 'mes_calendario': {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      desde = d.toISOString(); break;
    }
    case 'mes_calendario_pasado': {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); d.setHours(0, 0, 0, 0);
      const h = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      desde = d.toISOString(); hasta = h.toISOString(); break;
    }
    case 'personalizado': {
      const dEl = document.getElementById('cbpFechaDesde')?.value;
      const hEl = document.getElementById('cbpFechaHasta')?.value;
      if (dEl) desde = new Date(dEl + 'T00:00:00').toISOString();
      if (hEl) hasta = new Date(hEl + 'T23:59:59').toISOString();
      break;
    }
    case 'todo':
    default:
      desde = null; hasta = null; break;
  }

  return { desde, hasta };
}

/* ── Descripción legible del período activo del Club ── */
function descripcionPeriodo() {
  const sel = document.getElementById('cbpFiltroSelect')?.value || 'mes';
  const labels = {
    hoy: 'hoy',
    ayer: 'ayer',
    semana: 'los últimos 7 días',
    semana_pasada: 'la semana pasada',
    mes: 'los últimos 30 días',
    mes_calendario: 'este mes',
    mes_calendario_pasado: 'el mes pasado',
    todo: 'todo el historial',
    personalizado: 'el rango personalizado'
  };
  return labels[sel] || 'el período seleccionado';
}


/* ── Render de la lista de miembros ── */
function renderMiembrosClub(clientes) {
  const minPedidos = parseInt(document.getElementById('cbpMinPedidos').value) || 3;
  const count = clientes.length;

  /* Actualizar labels del banner de info */
  const periodoEl = document.getElementById('cbpPeriodoTexto');
  if (periodoEl) periodoEl.textContent = descripcionPeriodo();
  const minLabel2 = document.getElementById('cbpMinLabel2');
  if (minLabel2) minLabel2.textContent = minPedidos;

  document.getElementById('cbpContador').textContent = count;
  document.getElementById('cbpTitulo').textContent =
    `${count} cliente${count !== 1 ? 's' : ''} con ${minPedidos}+ pedidos en ${descripcionPeriodo()}`;

  if (!clientes.length) {
    document.getElementById('cbpLista').innerHTML =
      `<div class="empty-state"><div class="emoji">🍕</div><p>Ningún cliente cumple este criterio en el período.<br><span style="font-size:.75rem;color:var(--muted)">Probá bajando el mínimo de pedidos o ampliando el período en Métricas.</span></p></div>`;
    return;
  }

  document.getElementById('cbpLista').innerHTML = clientes.map(c => {
    const esClub = c.total_pedidos >= minPedidos;
    const badgeClass = esClub ? 'badge-green' : 'badge-yellow';
    const badgeText = esClub ? '🏆 Club Big Pizza' : '🍕 Frecuente';
    const inicial = (c.nombre || '?')[0].toUpperCase();
    const ne = (c.nombre || '').replace(/'/g, "\\'");
    const te = (c.telefono || '').replace(/'/g, "\\'");

    return `<div class="cliente-vencido" id="cbp-${c.id}">
      <div class="client-avatar" style="background:var(--orange)">${inicial}</div>
      <div class="cv-info">
        <div class="cv-nombre">${c.nombre || 'Sin nombre'}</div>
        <div class="cv-detalle">📱 ${c.telefono || 'Sin número'} · Pedidos en el período: <strong style="color:var(--orange)">${c.total_pedidos}</strong></div>
        <div style="margin-top:6px"><span class="${badgeClass}">${badgeText}</span></div>
      </div>
      <div class="cv-dias" style="color:var(--orange);text-shadow:0 0 12px var(--orange-glow)">${c.total_pedidos}<small>pedidos</small></div>
      <button class="btn-ghost" style="font-size:.75rem;white-space:nowrap;padding:6px 12px" id="btn-cbp-${c.id}" onclick="cbpEnviarUno('${te}','${ne}','${c.id}')">Enviar →</button>
    </div>`;
  }).join('');
}

/* ── Vista previa del mensaje (Club) ── */
function actualizarPreviewClub() {
  const msg = document.getElementById('cbpMensaje').value;
  document.getElementById('cbpPreview').textContent = msg
    ? msg.replace(/{nombre}/gi, 'Juan')
    : 'Escribí el mensaje arriba...';
}

/* ── Envío individual (Club) ── */
async function cbpEnviarUno(telefono, nombre, clienteId) {
  const msg = document.getElementById('cbpMensaje').value.trim().replace(/{nombre}/gi, nombre || 'cliente');
  if (!msg) { mostrarFeedbackClub('Escribí el mensaje.', 'error'); return; }
  if (!telefono) { mostrarFeedbackClub('Sin número.', 'error'); return; }

  const btn = document.getElementById(`btn-cbp-${clienteId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
  try {
    const data = await api('POST', '/enviar-uno', { telefono, mensaje: msg, clienteId });
    if (data.ok) {
      document.getElementById(`cbp-${clienteId}`)?.classList.add('enviado');
      if (btn) { btn.textContent = '✅ Enviado'; btn.style.color = 'var(--green)'; }
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Enviar →'; }
      mostrarFeedbackClub(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar →'; }
    mostrarFeedbackClub('Error de conexión.', 'error');
    console.error('Error al enviar mensaje club:', error);
  }
}

/* ── Envío masivo (Club) ── */
async function cbpEnviarTodos() {
  const msg = document.getElementById('cbpMensaje').value.trim();
  if (!msg) { mostrarFeedbackClub('Escribí el mensaje.', 'error'); return; }

  const ct = miembrosClub.filter(c => c.telefono);
  if (!ct.length) { mostrarFeedbackClub('Ningún miembro tiene número.', 'error'); return; }

  const minPedidos = document.getElementById('cbpMinPedidos').value || 3;
  const confirmMsg = `Vas a enviar el mensaje a <strong>${ct.length} miembro${ct.length !== 1 ? 's' : ''}</strong> del Club Big Pizza (${minPedidos}+ pedidos en ${descripcionPeriodo()}).\n\n¿Confirmás el envío?`;
  const seguro = await customConfirm('Envío Club Big Pizza', confirmMsg, '🏆', `Enviar a ${ct.length}`);
  if (!seguro) return;

  document.getElementById('cbpProgreso').style.display = 'block';
  document.getElementById('cbpBtnEnviarTodos').disabled = true;
  document.getElementById('cbpProgresoTexto').textContent = `Enviando a ${ct.length} miembros del club...`;

  try {
    const data = await api('POST', '/enviar-todos', { clientes: ct, mensaje: msg });
    document.getElementById('cbpProgresoBar').style.width = '100%';
    document.getElementById('cbpProgresoDetalle').textContent =
      `✅ ${data.enviados} enviados · ❌ ${data.fallidos} fallidos${data.omitidos ? ` · ⚠️ ${data.omitidos} omitidos` : ''}`;
    mostrarFeedbackClub(`${data.enviados} mensajes enviados.`, 'success');
    cargarMiembrosClub();
  } catch (error) {
    mostrarFeedbackClub('Error de conexión.', 'error');
    console.error('Error al enviar masivo club:', error);
  } finally {
    setTimeout(() => {
      document.getElementById('cbpBtnEnviarTodos').disabled = false;
      document.getElementById('cbpProgreso').style.display = 'none';
      document.getElementById('cbpProgresoBar').style.width = '0%';
    }, 5000);
  }
}

/* ── Feedback para la sección club ── */
function mostrarFeedbackClub(msg, tipo) {
  const el = document.getElementById('cbpFeedback');
  if (!el) return;
  el.className = tipo === 'error' ? 'error-msg' : 'success-msg';
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}
