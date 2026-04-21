/* ============================================================
   Este script tiene la funcionalidad de gestionar la seguridad 
   y autenticación en el lado del cliente (Frontend) mediante el 
   uso de JSON Web Tokens (JWT).

   Funciones:
   - guardarToken, obtenerToken, decodificarToken: manipulación 
     del LocalStorage para la persistencia de la sesión.
   - verificarSesion: control de acceso en las vistas protegidas,
     redirección automática al login si está expirado o no existe.
   - iniciarSesion, cerrarSesion: llamadas a la API del backend.
   
   Utilizando las herramientas:
   - Fetch API nativa
   - LocalStorage Web API
   ============================================================ */

const AUTH_TOKEN_KEY = 'bp_auth_token';

/* ── Guarda el token JWT en localStorage ── */
function guardarToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/* ── Obtiene el token guardado ── */
function obtenerToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

/* ── Decodifica el payload del JWT (la firma la verifica el backend) ── */
function decodificarToken(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch {
        return null;
    }
}

/* ── Verifica si hay sesión activa y no expiró ──
   Si NO hay sesión o expiró: redirige a /login.html
   Si HAY sesión: devuelve { usuario } */
function verificarSesion() {
    const token = obtenerToken();
    const isLoginPage = window.location.pathname.includes('login.html') || window.location.href.includes('login.html');

    if (!token) {
        if (!isLoginPage) window.location.replace('login.html');
        return null;
    }

    const payload = decodificarToken(token);
    if (!payload) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        if (!isLoginPage) window.location.replace('login.html');
        return null;
    }

    /* Verificar expiración */
    if (payload.exp && Date.now() / 1000 > payload.exp) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        if (!isLoginPage) window.location.replace('login.html');
        return null;
    }

    return { usuario: payload.usuario };
}

/* ── Login con usuario y contraseña ── */
async function iniciarSesion(usuario, password) {
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, password })
        });
        const data = await res.json();

        if (data.ok && data.token) {
            guardarToken(data.token);
            return { ok: true, usuario: data.usuario };
        }
        return { ok: false, error: data.error || 'Credenciales incorrectas.' };
    } catch (e) {
        return { ok: false, error: 'No se pudo conectar con el servidor.' };
    }
}

/* ── Cierra sesión y redirige a login ── */
function cerrarSesion() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    window.location.replace('login.html');
}
