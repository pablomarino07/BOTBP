# 🤖 Bot BP (Bot Pedidos)

![Bot Status](https://img.shields.io/badge/Status-Activo-success) ![Version](https://img.shields.io/badge/Version-1.0.0-blue) ![Node.js](https://img.shields.io/badge/Node.js-Backend-green)

**Bot BP** es un bot de WhatsApp automatizado con Inteligencia Artificial (Gemini) diseñado puramente para la captura, procesamiento y organización de pedidos.

El ecosistema cuenta con dos componentes principales:
1. **🤖 Servidor/Bot (`Node.js`):** Escucha chats, acumula historiales, y coordina turnos para procesarlos a través de IA.
2. **💻 Dashboard Web (`HTML/CSS/JS`):** Panel privado seguro que permite gestionar los pedidos interpretados, configurar remarketing masivo, reconectar el WhatsApp (QR) y revisar métricas de impacto.

---

## 🚀 Características Principales

- **Gestión Automatizada de Pedidos:** Escucha mensajes y usa `Gemini-Flash` para estructurar la info en pedidos claros y organizados.
- **Sistema de Turnos:** Trabaja por intervalos para no saturar procesos, agrupando mensajes de los clientes de manera unificada.
- **Base de Datos en la Nube:** Integración total con **Supabase** para persistencia de historiales, clientes, y pedidos.
- **Dashboard Privado (JWT):** Acceso asegurado para dueños y administradores, protegido contra ataques de fuerza bruta.
- **Remarketing Inteligente:** Sistema espaciado de envío de mensajes masivos con *rate-limits*, evitando cierres de sesión por spam (bans).

---

## 🛠️ Tecnologías

- **Backend:** Node.js, Express
- **WhatsApp Web:** `whatsapp-web.js`, `qrcode-terminal`
- **Inteligencia Artificial:** `@google/generative-ai` (Gemini Flash)
- **Base de Datos:** `@supabase/supabase-js`
- **Seguridad:** `jsonwebtoken`, `express-rate-limit`, credenciales seguras vía `.env`.

---

## ⚙️ Instalación y Configuración

### 1. Clonar e Instalar
Ubicarse en el directorio del proyecto y correr:
```bash
npm install
```

### 2. Configurar el Entorno (`.env`)
Basarse en el archivo `.env.example` creado en el repositorio. Debes configurar:
- `GEMINI_API_KEY`: Clave del modelo de IA.
- `SUPABASE_URL` y `SUPABASE_KEY`: Credenciales de la base de datos de producción.
- `DASHBOARD_USER` y `DASHBOARD_PASSWORD`: Permisos de acceso locales.
- `JWT_SECRET`: Llave segura requerida para arrancar el servidor. *Cuidado: Si falta, el sistema no inicia.*

### 3. Ejecutar el Servidor
Cargar las funciones de Bot, Cliente de WhatsApp y Scheduler:
```bash
npm run start
```
> El QR aparecerá en consola y tu dashboard estará vivo en `http://localhost:3000`

---

## 🔐 Seguridad
La API ha sido optimizada para asegurar que ningún usuario pueda abusar de los endpoints. 
- Contiene **Rate Limiting** para proteger las rutas críticas de DDoS.
- Verifica exhaustivamente los **límites de tamaño** en logins para evitar corrupciones de memoria.
- Validación fuerte de contraseñas de entorno.

---
*Diseñado para agilizar ventas, mantener los clientes contentos y que no se escape ningún pedido.* 🚀
