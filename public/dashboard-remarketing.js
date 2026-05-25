/* ============================================================
   MÓDULO: dashboard-remarketing.js
   Funcionalidad: Configuración y envío de campañas de remarketing,
   filtrado de segmentos de clientes inactivos, vistas previas
   del mensaje dinámico y control de spam/tiempos de envío.
   ============================================================ */

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
  } catch (e) { 
    document.getElementById('listaVencidos').innerHTML = `<div class="error-msg">Error: ${e.message}</div>`; 
    console.error("Error al actualizar vencidos:", e);
  }
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
  } catch (error) {
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar →'; }
    mostrarFeedback('Error de conexión.', 'error');
    console.error("Error al enviar remarketing individual:", error);
  }
}

/* ── Envío masivo ── */
async function enviarTodos() {
  const msg = document.getElementById('rmMensaje').value.trim();
  if (!msg) { mostrarFeedback('Escribí el mensaje.', 'error'); return; }

  /* ── Aplicar el mismo filtro de segmento que la lista visual ── */
  const selectedRadio = document.querySelector('input[name="rmFiltroEstadoRadio"]:checked');
  const filtro = selectedRadio ? selectedRadio.value : 'todos';

  let clientesFiltrados = clientesVencidos;
  if (filtro === 'nunca') clientesFiltrados = clientesVencidos.filter(c => !c.ultimo_remarketing);
  else if (filtro === 'recibieron') clientesFiltrados = clientesVencidos.filter(c => c.ultimo_remarketing);

  const ct = clientesFiltrados.filter(c => c.telefono);
  if (!ct.length) { mostrarFeedback('Ningún cliente en este segmento tiene número.', 'error'); return; }

  const hSolo = new Date(); hSolo.setHours(0, 0, 0, 0);
  const recientes = ct.filter(c => {
    if (!c.ultimo_remarketing) return false;
    const u = new Date(c.ultimo_remarketing); u.setHours(0, 0, 0, 0);
    return Math.round((hSolo - u) / (1000 * 60 * 60 * 24)) < 30;
  });

  /* Solo avisa si hay recientes Y estamos en modo 'todos' o 'recibieron' */
  if (recientes.length > 0 && filtro !== 'nunca') {
    const confirmMsg = `Vas a enviar a <strong>${ct.length} cliente${ct.length !== 1 ? 's' : ''}</strong>, de los cuales <strong>${recientes.length}</strong> ya recibieron remarketing hace menos de 30 días.\n\n¿Estás súper seguro?`;
    const seguro = await customConfirm('Múltiples Remarketings', confirmMsg, '🚨', 'Enviar a todos');
    if (!seguro) return;
  } else if (filtro === 'nunca' || recientes.length === 0) {
    /* Confirmar envío normal */
    const confirmMsg = `Vas a enviar el mensaje a <strong>${ct.length} cliente${ct.length !== 1 ? 's' : ''}</strong> del segmento seleccionado.\n\n¿Confirmás el envío?`;
    const seguro = await customConfirm('Confirmar envío masivo', confirmMsg, '📤', `Enviar a ${ct.length}`);
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
  } catch (error) { 
    mostrarFeedback('Error de conexión.', 'error');
    console.error("Error al enviar remarketing masivo:", error);
  } finally {
    setTimeout(() => {
      document.getElementById('btnEnviarTodos').disabled = false;
      document.getElementById('rmProgreso').style.display = 'none';
      document.getElementById('rmProgresoBar').style.width = '0%';
    }, 5000);
  }
}
