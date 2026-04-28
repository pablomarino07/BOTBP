<div align="center">
  <h1>🍕 Bot BP · Automatización & IA para Pizzerías 🚀</h1>
  <p><i>Un ecosistema inteligente desarrollado en Node.js para revolucionar la toma de pedidos a través de WhatsApp.</i></p>

  ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
  ![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
  ![Google Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
  ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
  ![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
</div>

---

## 📝 Descripción Breve

**Bot BP** es un bot de WhatsApp vitaminado con Inteligencia Artificial diseñado exclusivamente para la gastronomía. Se encarga de la captura, análisis, procesamiento y organización automática del 100% de las ventas generadas por chat.

El sistema se divide en un "Motor" silencioso que acumula e interpreta los mensajes usando Gemini IA, y un "Dashboard Web" privado donde los administradores pueden auditar pedidos, visualizar métricas de negocio y ejecutar campañas de remarketing.

### ❓ Qué problema resuelve
Los negocios gastronómicos con alto volumen de pedidos vía WhatsApp pierden horas valiosas leyendo, interpretando y transcribiendo mensajes manuales, lo que genera errores humanos, demoras en la respuesta y un estrés operativo constante. Bot BP automatiza toda esta carga.

### 🎯 Para quién está pensado
Diseñado para pizzerías, casas de comida rápida y restaurantes que utilicen WhatsApp como su canal principal de ventas y necesiten escalar su atención sin contratar más personal dedicado exclusivamente a leer chats.

### 💎 Valor diferencial
A diferencia de los chatbots tradicionales de "opciones numéricas" (ej. presione 1 para menú), Bot BP permite que el cliente hable de forma **100% natural**. La IA comprende lenguaje coloquial, audios (si aplica), correcciones sobre la marcha ("mejor sacale la cebolla") y extrae un JSON estructurado para la cocina, además de procesar la información en "ventanas de tiempo" para ahorrar costos de API y evitar bloqueos de Meta.

---

## 📑 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Tecnologías Utilizadas](#-tecnologías-utilizadas)
- [Instalación](#-instalación)
- [Uso](#-uso)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Configuración](#-configuración)
- [API](#-api)
- [Despliegue](#-despliegue)
- [Roadmap](#-roadmap)
- [Licencia](#-licencia)

---

## ✨ Características Principales

- **🧠 Análisis Estructurado con IA**: Utiliza Gemini-Flash para transformar lenguaje natural (por más caótico que sea el cliente) en un formato de datos ordenado (JSON) listo para producción.
- **🕒 Sistema de Turnos Inteligente**: No procesa mensaje a mensaje. Acumula el historial de chats y los envía a la IA en intervalos de tiempo (ej. 14:00 y 23:30) reduciendo costos y evitando el *Rate Limit* de la API.
- **📣 Remarketing Seguro**: Permite recuperar carritos abandonados o clientes inactivos con envíos masivos o individuales, aplicando retrasos (*delays*) de 10 segundos y lotes máximos para esquivar el Ban de WhatsApp.
- **💳 Dashboard Blindado**: Interfaz web protegida mediante JWT, *Rate-Limiting* contra ataques de fuerza bruta y mitigación de *Timing Attacks*.
- **☁️ Base de Datos Concurrente**: Almacenamiento en la nube (Supabase / PostgreSQL) para un registro instantáneo de métricas, clientes y facturación.
- **🛠️ Reconexión Autónoma**: Capacidad de auto-recuperarse si la sesión de WhatsApp o el navegador Chromium (Puppeteer) fallan.

---

## 🛠️ Tecnologías Utilizadas

- **Lenguaje Core:** JavaScript (Node.js ES Modules)
- **Framework Web:** Express.js
- **Conectividad WhatsApp:** `whatsapp-web.js` + `qrcode-terminal`
- **Inteligencia Artificial:** `@google/generative-ai` (Gemini Flash & Gemini Pro)
- **Base de Datos:** Supabase (PostgreSQL) + `@supabase/supabase-js`
- **Seguridad:** `jsonwebtoken` (JWT), `express-rate-limit`, `crypto` nativo.

---

## ⚙️ Instalación

### Requisitos Previos
- Node.js (v18 o superior recomendado)
- Cuenta y Proyecto creado en [Supabase](https://supabase.com/)
- API Key de [Google AI Studio](https://aistudio.google.com/) (Gemini)
- Un número de WhatsApp de pruebas/negocio (no usar línea personal principal al desarrollar).

### Paso a paso desde cero

1. **Clonar el repositorio:**
   ```bash
   git clone [COMPLETAR: URL_DEL_REPOSITORIO]
   cd bot-bp
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar el entorno:**
   Copiá el archivo de ejemplo y completá tus credenciales reales:
   ```bash
   cp .env.example .env
   ```

4. **Arrancar la aplicación:**
   ```bash
   npm run start
   ```

---

## 🚀 Uso

### Casos de uso comunes
1. **Atención 24/7:** El bot queda corriendo en el servidor. Los clientes escriben sus pedidos y dudas a lo largo de la tarde.
2. **Procesamiento de Turnos:** Llegadas las 20:00 hs (o la hora configurada), el *Scheduler* toma todos los chats sin leer, los procesa con Gemini y los inserta en la base de datos como "Pedidos listos".
3. **Auditoría UI:** El dueño entra al Dashboard (`http://localhost:3000`), revisa las ventas del día, métricas y ve la lista de clientes inactivos hace 30 días.
4. **Remarketing:** Desde el panel, hace clic en "Enviar a todos" para mandar una promoción a los inactivos de forma escalonada.

### Ejemplo Práctico (Log de Consola)
```bash
📱 [QR] Nuevo QR generado — disponible en el dashboard
✅ [WhatsApp] Conectado exitosamente.

==================================================
🔄 Procesando turno (automático) — 26/4/2026, 23:30:00
==================================================
📋 1 conversación(es) para analizar

── [5491122334455@c.us] 3 mensajes ──
   ✅ Pedido guardado
📝 Log del turno guardado en Supabase.
✅ Turno completado en 2s
```

---

## 📁 Estructura del Proyecto

```text
├── src/
│   ├── client.js       # Inicialización y gestión de la sesión de WhatsApp Web
│   ├── procesador.js   # Lógica central para interactuar con la IA (Gemini)
│   ├── prompt.js       # Instrucciones de sistema (System Prompts) para la IA
│   ├── server.js       # Servidor Backend (Express, API REST, Scheduler y Seguridad)
│   ├── whatsapp.js     # Punto de entrada principal (Bootstrap de servicios)
│   └── remarketing.js  # Script independiente para ejecutar envíos masivos por CLI
├── public/             # Archivos estáticos del Frontend (Dashboard Web)
│   ├── dashboard.html
│   ├── dashboard.js
│   ├── login.html
│   └── index.css
├── scratch/            # Scripts temporales de prueba o debugging
├── .env                # Variables de entorno (NO subido al repo)
├── package.json        # Dependencias y scripts de NPM
└── Dockerfile          # Instrucciones para contenedorización
```

---

## 🔧 Configuración

Toda la configuración sensible vive en el archivo `.env`.

### Variables de Entorno Clave
```properties
# Inteligencia Artificial
GEMINI_API_KEY=tu_api_key_de_google_aqui

# Base de Datos (Supabase)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_anon_key_o_service_key

# Credenciales del Dashboard
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=password_super_seguro

# Seguridad
JWT_SECRET=tu_llave_secreta_super_larga_de_256_o_mas_caracteres
```

---

## 🌐 API

El frontend se comunica con el backend a través de endpoints seguros en `src/server.js`. Todas las rutas bajo `/api/` (excepto `/login`) requieren un header `Authorization: Bearer <token>`.

### Endpoints Principales

- `POST /api/login`: Recibe `{ usuario, password }`. Devuelve un JWT de acceso.
- `GET /api/qr`: Devuelve el string del código QR actual de WhatsApp para mostrar en la interfaz.
- `GET /api/metricas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`: Retorna las ventas y cruza datos con clientes.
- `POST /api/configurar-turnos`: Actualiza las horas de ejecución del scheduler. **Request:** `{ turno1: "14:00", turno2: "23:30" }`
- `POST /api/enviar-todos`: Lanza la campaña de remarketing masivo con retrasos de 10s. **Request:** `{ clientes: [...], mensaje: "Hola {nombre}..." }`
- `POST /api/procesar-ahora`: Fuerza el inicio del procesador de IA saltándose el reloj.



---

## 🛳️ Despliegue (Producción)

El proyecto está diseñado para ser empaquetado en un contenedor de Docker y subido a un VPS (ej. DigitalOcean, Linode).

1. Construir la imagen:
   ```bash
   docker build -t bot-bp:latest .
   ```
2. Correr el contenedor (pasando las variables de entorno):
   ```bash
   docker run -d \
     --name bot-produccion \
     -p 3000:3000 \
     --env-file .env \
     -v wwebjs_auth:/app/.wwebjs_auth \
     bot-bp:latest
   ```

> 💡 **Nota:** Para instrucciones detalladas sobre el VPS, consultar el archivo `DESPLIEGUE_VPS.md` incluido en el repositorio.

---

## 🗺️ Roadmap (Opcional)

- [ ] Integración con pasarelas de pago (MercadoPago).
- [ ] Soporte para audios y transcripción usando Whisper.
- [ ] Panel multi-sucursal para franquicias.
- [ ] Gráficos interactivos de barra/líneas en el Dashboard con Chart.js.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **ISC**. Podés modificarlo y distribuirlo libremente, pero se provee "tal cual" sin ninguna garantía explícita.

---

