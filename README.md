<div align="center">
  <h1>🍕 Bot BP · Automatización & IA para Pizzerías 🚀</h1>
  <p><i>Un ecosistema inteligente desarrollado en Node.js para revolucionar la toma de pedidos a través de WhatsApp.</i></p>

  ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
  ![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
  ![Gemini Flash](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
  ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
  ![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
</div>

<br>

**Bot BP** es un bot de WhatsApp vitaminado con Inteligencia Artificial diseñado exclusivamente para la gastronomía (específicamente, pedidos de pizzerías). Se encarga de la **captura, análisis, procesamiento y organización** del 100% de las ventas por chat.

El ecosistema está dividido en dos grandes cerebros:
1. 🤖 **El Motor (Node.js):** Se conecta a WhatsApp Web en la nube, escucha mensajes 24/7 de tus clientes, acumula los historiales y en turnos predefinidos los envía a **Gemini IA** para extraer pedidos estructurados.
2. 💻 **El Dashboard Web (UI):** Un panel de control privado para auditar los pedidos, revisar métricas de negocio, ver el status de la conexión y lanzar campañas de *remarketing* hiper-segmentado a clientes inactivos.

---

## ✨ Características Principales

| Función | Descripción |
| :--- | :--- |
| **🧠 Análisis Estructurado** | Identifica intenciones de compra (y descarta consultas libres) usando `Gemini-Flash` para transformar lenguaje natural caótico en un JSON perfectamente estructurado. |
| **🕒 Sistema de Turnos** | Procesa los historiales acumulados en "ventanas de tiempo" (ej: 14:00 y 23:30) ahorrando recursos (Tokens) y evitando penalizaciones completas por parte de la API de IA. |
| **📣 Remarketing Seguro** | Envío de mensajes de retorno masivos programados con cola de espera y *rate-limiting* nativo para nunca sufrir bloqueos por Spam (Anti-Ban en Meta). |
| **💳 Dashboard Blindado** | Protegido con **JWT (JSON Web Tokens)** y detectores de *Fuerza Bruta*, garantizando que tus métricas e ingresos sólo los veas vos a través de un panel limpio. |
| **☁️ DB Concurrente** | Respaldo en la nube instantáneo con **Supabase**, registrando nuevos clientes, sus pedidos, fechas de compras y creando perfiles de retención en escasos milisegundos. |
| **🛠️ Reconexión Autónoma** | Si WhatsApp cierra su sesión o el navegador Chromium falla, el core de reconexión inteligente entra y levanta el servicio de forma pasiva, enviando un nuevo código QR al Dashboard. |

---

## 🛠️ Stack Tecnológico

🔹 **Backend / Core:** Node.js, Express.js, Puppeteer Core.  
🔹 **Conectividad:** `whatsapp-web.js`, `qrcode-terminal`.  
🔹 **Brain IA:** `@google/generative-ai` (Basado en Gemini Flash Mongoose & Gemini Pro Fallback).  
🔹 **Almacenamiento:** `@supabase/supabase-js` (PostgreSQL / REST).  
🔹 **Seguridad:** `jsonwebtoken` (JWT Sessions), `express-rate-limit` (Anti DDoS).  

---

## ⚙️🚀 Empezando / Instalación

Para desplegar a servidor o levantar el entorno local, seguí estos pasos:

### 1. Clonar e Instalar Dependencias
Ubicarse en el directorio del proyecto y correr:
```bash
npm install
```

### 2. Variables de Entorno (`.env`)
Duplicá el archivo `.env.example` y nombralo `.env`.
Asegurate de completar todas las variables críticas:
```properties
# IA & DB
GEMINI_API_KEY=AIzaSy...
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=eyJhbG...

# CREDENCIALES DEL DASHBOARD ADMIN
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=super_secreto

# SEGURIDAD (Obligatorio)
JWT_SECRET=tu_llave_secreta_super_larga_de_256_o_mas_caracteres
```

### 3. ¡Arrancar la Máquina!
Levantá el cliente de WhatsApp, el Servidor Frontend Express y el Scheduler de IA de un solo golpe.
```bash
npm run start
```
> **Nota Mágica:** ✅ Escaneá el **Código QR** renderizado en tu consola (o en el login del Panel Web) con tu dispositivo móvil para enlazar WhatsApp Negocios. El Dashboard estará disponible al instante en `http://localhost:3000`.

---

## 🔒 Postura de Seguridad

Este entorno ha sido verificado y diseñado para repeler accesos no deseados.
- **Vigilancia de IP (Rate Limiter):** Limita rígidamente las solicitudes al Endpoint de inicio de sesión evitando el craqueo de contraseñas masivo.
- **Timing Safe Controls:** Verificación criptográfica con `crypto.timingSafeEqual` mitigando totalmente las intrusiones por vectores de Timing Attacks.
- **Ocultamiento Total de DB:** Las APIs de backend y la capa Auth JWT evitan inherentemente que el Front-End tenga algún tipo de credencial o exposición a la Base de Datos. El Dashboard consume sólo la información necesaria vía Endpoints.

---
<div align="center">
  <i>Construido para despachar más cajas de pizzas, perder menos tiempo procesando dudas y potenciar las ventas de manera autómata.</i> 🍕📊
</div>
