/* ============================================================
   MÓDULO: dashboard-ia.js
   Funcionalidad: Gestión de la inteligencia artificial, turnos,
   procesamiento manual de conversaciones y visualización de logs
   e historiales de chats descartados.
   ============================================================ */

/* ── Turnos ── */
async function guardarTurnos() {
  const t1 = document.getElementById('turno1Input').value;
  const t2 = document.getElementById('turno2Input').value;
  const fb = document.getElementById('turnosFeedback');
  try {
    const data = await api('POST', '/configurar-turnos', { turno1: t1, turno2: t2 });
    fb.className = data.ok ? 'success-msg' : 'error-msg';
    fb.textContent = data.ok ? `✅ Guardado: ${t1} y ${t2}` : data.error;
    fb.style.display = 'block'; 
    setTimeout(() => fb.style.display = 'none', 4000);
  } catch (error) { 
    fb.className = 'error-msg'; 
    fb.textContent = 'Error de conexión.'; 
    fb.style.display = 'block'; 
    console.error("Error al guardar turnos:", error);
  }
}

async function procesarAhora() {
  const btn = document.getElementById('btnProcesarAhora');
  btn.disabled = true; 
  btn.textContent = 'Procesando...';
  try {
    const data = await api('POST', '/procesar-ahora');
    document.getElementById('resTotal').textContent = data.procesados ?? '—';
    document.getElementById('resPedidos').textContent = data.pedidos ?? '—';
    document.getElementById('resDescartados').textContent = data.descartados ?? '—';
    document.getElementById('resErrores').textContent = data.errores ?? '—';
    document.getElementById('resultadoProceso').style.display = 'block';
    await cargarDatos(); 
    await cargarLogsTurnos();
  } catch (error) { 
    alert('No se pudo conectar. Asegurate que el servidor esté corriendo.'); 
    console.error("Error en procesamiento manual:", error);
  } finally { 
    btn.disabled = false; 
    btn.textContent = 'Procesar ahora'; 
  }
}

async function cargarLogsTurnos() {
  const el = document.getElementById('logsTurnos');
  if (!el) return;
  try {
    const data = await api('GET', '/logs-turnos');
    if (!data.ok || !data.logs?.length) { 
      el.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:12px">Sin historial aún.</div>'; 
      return; 
    }
    el.innerHTML = data.logs.map(l => `<div class="log-item"><div class="log-fecha">${new Date(l.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div><span class="badge-yellow" style="font-size:.72rem">${l.origen}</span><div class="log-stats"><span class="badge">${l.conversaciones || 0} Conv. Totales</span><span class="badge-green">${l.pedidos_guardados} pedidos</span>${l.errores > 0 ? `<span class="badge-red">${l.errores} err</span>` : ''}</div></div>`).join('');
  } catch (error) { 
    el.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:12px">Error cargando logs.</div>'; 
    console.error("Error cargando logs de turnos:", error);
  }
}

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
    console.error("Error al cargar chats descartados:", e);
  }
}
