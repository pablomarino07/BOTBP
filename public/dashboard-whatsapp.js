/* ============================================================
   MÓDULO: dashboard-whatsapp.js
   Funcionalidad: Gestión de la conexión a WhatsApp, consulta
   de código QR mediante la API y renderizado del canvas del QR.
   ============================================================ */

/* ── QR ── */
async function cargarQR() {
  const area = document.getElementById('qrArea');
  if (estadoWA === 'conectado') { 
    area.innerHTML = '<div class="qr-conectado">WhatsApp ya está conectado</div>'; 
    return; 
  }
  area.innerHTML = '<div class="loading"><div class="spinner"></div> Cargando QR...</div>';
  try {
    const data = await api('GET', '/qr');
    if (!data.ok) { 
      area.innerHTML = `<div style="color:var(--muted);font-size:.85rem;padding:20px">${data.mensaje || 'QR no disponible aún. Esperá y actualizá.'}</div>`; 
      return; 
    }
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
