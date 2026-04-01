# 🍕 Bot BP - Extractor de Pedidos Inteligente

Sistema de automatización para pizzerías que utiliza IA para transformar conversaciones de WhatsApp en datos estructurados. El bot actúa como un **observador silencioso** que procesa las ventas cerradas por humanos.

## 🏗️ Arquitectura del Sistema

El sistema se divide en tres capas principales:

1.  **Acumulador (`whatsapp.js`)**: Escucha todos los mensajes (entrantes y salientes) en tiempo real y los guarda en una tabla de historiales en Supabase. No responde mensajes para evitar interferir con la atención humana.
2.  **Procesador de Turnos (`server.js` + `procesador.js`)**: Un scheduler ejecuta procesos automáticos (ej: 12:00 y 23:00) que envían los historiales acumulados a **Gemini 1.5 Flash**. La IA detecta si el pedido se cerró, extrae los productos, precios, datos del cliente y lo guarda en la base de datos final.
3.  **Remarketing Inteligente (`remarketing.js`)**: Una vez al día, el sistema busca clientes que no compran hace más de 30 días y genera mensajes personalizados con IA basados en su último pedido para invitarlos a volver.

## 🚀 Funcionalidades
- **Extracción con IA**: Entiende lenguaje natural y normaliza términos (ej. "muzza" -> "muzzarella").
- **Detección de Cierre**: Solo guarda el pedido cuando detecta que el empleado confirmó el envío o retiro.
- **Dashboard en Tiempo Real**: Interfaz web para ver métricas, pedidos recientes y estado de la conexión.
- **Remarketing Personalizado**: Mensajes automáticos con tono argentino y referencias a compras previas.
- **Gestión de Turnos**: Procesamiento automático de mensajes acumulados por franjas horarias.

## 🛠️ Stack Tecnológico
- **Node.js** (Módulos ES6)
- **Google Generative AI** (Gemini 1.5 Flash)
- **Supabase** (PostgreSQL)
- **whatsapp-web.js** (Motor de WhatsApp)
- **Express** (API para el Dashboard)

## ⚙️ Configuración

1.  **Instalar dependencias**:
    ```bash
    npm install
    ```

2.  **Configurar variables de entorno**:
    Crea un archivo `.env` en la raíz con:
    ```env
    SUPABASE_URL=tu_url_de_supabase
    SUPABASE_KEY=tu_anon_key_de_supabase
    GEMINI_API_KEY=tu_api_key_de_google
    ```

3.  **Base de Datos (Tablas Necesarias)**:
    Debes crear las siguientes tablas en Supabase:
    - `clientes`: `id`, `telefono`, `nombre`, `direccion_frecuente`, `ultima_compra`, `ultimo_remarketing`.
    - `pedidos`: `id`, `cliente_id`, `monto_total`, `items_json`, `fecha`, `necesita_revision` (boolean), `notas_internas` (text).
    - `historial_chats`: `chat_id` (PK), `telefono`, `mensajes` (JSONB/Text Array), `actualizado_at`.
    - `logs_turnos`: `id`, `fecha`, `pedidos_guardados`, `conversaciones`, `detalles` (JSONB).
    - `configuracion`: `id`, `clave` (text, PK), `valor` (text). (Crea una fila con clave 'menu_oficial' para manejar los precios desde la DB).

## 🖥️ Uso y Dashboard

- **Iniciar Sistema Completo**:
  ```bash
  node whatsapp.js
  ```
  Esto inicia el bot de WhatsApp, el servidor de la API y el scheduler.

- **Acceder al Dashboard**:
  Abre `http://localhost:3000/dashboard.html` en tu navegador. Desde allí podrás:
  - Ver el QR para vincular WhatsApp.
  - Ver estadísticas de ventas y clientes.
  - Configurar las horas de procesamiento de los turnos.
  - Ejecutar un procesamiento manual de mensajes acumulados.

## 🧪 Pruebas
- **Prueba de Extracción (Simulada)**: `node index.js`
- **Scripts de utilidad**: En `scripts-prueba/` encontrarás tests para la base de datos y la IA.

## 📝 Notas
Este bot está diseñado para ser un **observador**. No responde mensajes automáticamente, excepto en el módulo de remarketing una vez al día.
