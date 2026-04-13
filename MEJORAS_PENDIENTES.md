# ⏳ Mejoras Técnicas Pendientes (Deuda Técnica)

Durante la última auditoría de código junto con las sugerencias de la IA (Claude), aplicamos múltiples correcciones de seguridad, lógica y diseño de arquitectura. Sin embargo, **elegimos conscientemente dejar pendientes** algunas mejoras sugeridas.

Este documento explica cuáles son, por qué no las aplicamos aún, y cómo implementarlas a futuro cuando el proyecto escale más.

---



### 2. Actualización Dinámica Inmediata del Dashboard (WebSockets)

**Explicación:**
El actual **Panel Web (Dashboard)** se comunica con el servidor refrescando la información en intervalos o a través manual de las métricas. (Polling).

**Mejora Propuesta:**
El código puede optimizarse sumando conexiones en vivo vía **WebSockets (ej. con `socket.io`)** para lograr un "Tiempo Real absoluto" (apenas envía un cliente algo, parpadea en el monitor y refresca automáticamente todo en milisegundos).

**¿Por qué lo salteamos?**
Fue explícitamente mencionado por la IA como un *Upgrade a futuro*. Cambiar de llamadas HTTP standard a WebSockets implicaba reescribir integralmente varios pasajes vitales en `server.js` y todo el motor de refresco del Frontend. Resulta una tecnología sofisticada y ligeramente más pesada para los servidores chicos, un upgrade drástico para ganar apenas unos segundos de visualización contra la arquitectura actual.

---

### 3. Compresión HTTP (`compression`)

**Explicación:**
`compression` es un paquete de Node.js que comprime los payloads (HTML, CSS y JSON) antes de mandarlos desde el backend hacia la computadora que está abriendo el navegador.

**Mejora Propuesta:**
Añadir el paquete como un *middleware* en express para minimizar lo que pesan las solicitudes.

**¿Por qué lo salteamos?**
La web actual es extremadamente ligera, no carga grandes assets mediáticos crudos en las peticiones y está armada mayormente por una pequeña intranet. El ahorro son unos diminutos *kilobytes* en los endpoints. No ameritaba instalar la librería de compresión. 

---

### 4. Versionado Rígido de la API (`/v1`)

**Explicación:**
El esquema actual expone los endpoints en plano: `/api/login`, `/api/estado`, `/api/procesar-ahora`.

**Mejora Propuesta:**
Se recomendaba incrustar `/v1/` a todas las interacciones `/api/v1/login`. Esto se estila para prever si a varios años cambia toda la app a `/v2/` y se evita destruir paneles antiguos.

**¿Por qué lo salteamos?**
Significaba entrar a operar intensamente los cimientos del Front (el `dashboard.js`, la validación de `auth.js`) donde está hardcodeado `/api/...`. Semejante reestructuración rompe fácilmente la comunicación si escapaba una ruta. Al ser este un producto naciente exclusivo de único plano operativo, el versionado a 5 años no es de vital importancia ahora.
