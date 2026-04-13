# 🚀 Guía de Despliegue de 0 a 100: DigitalOcean + Dominio Propio

Para esto solo necesitas 3 herramientas: **GitHub** (para mover el código), **DigitalOcean** (Servidor/VPS) y tu registrador de dominio.

---

## FASE 1: Preparar tu código y subirlo a GitHub
Antes de tocar el servidor, tenemos que asegurar que tu código pueda descargarse allá fácilmente.

1. Hemos actualizado tu servidor para soportar dominios. Ahora en tu entorno debe existir la variable `DASHBOARD_URL`.
2. Sube todo tu código a un repositorio **Privado** en GitHub usando la terminal de tu PC local:
   ```bash
   git add .
   git commit -m "Preparando versión para VPS"
   git branch -M main
   git remote add origin https://github.com/tu-usuario/tu-repo.git
   git push -u origin main
   ```
*(Nota: .gitignore asegurará que no se suban ni las contraseñas ni la sesión de WhatsApp, ¡esto es correcto!)*

---

## FASE 2: Crear el Servidor en DigitalOcean
1. Entra a tu cuenta de **DigitalOcean** y dale a **Create > Droplets**.
2. En la sección **"Choose an Image"**, selecciona la pestaña **Marketplace** y busca **"Docker"** (elige "Docker on Ubuntu"). Esto te ahorrará instalar Docker manualmente.
3. Elige el servidor más económico ($4 a $6 al mes está perfecto para tu bot). 
4. Elige una región cercana (ej. New York).
5. En Autenticación, ponle una contraseña (Password) que recuerdes bien para conectarte más tarde.
6. Dale al botón verde de **Create Droplet**. 
7. Cuando termine, te mostrará la **IP Pública** de tu servidor (ej. `192.168.1.50`).

---

## FASE 3: Conectar tu Dominio
1. Entra donde compraste tu dominio (GoDaddy, Namecheap, Nic.ar, etc.).
2. Ve a la gestión de **DNS**.
3. Crea un **Registro tipo A** (A Record):
   - **Nombre (Host):** `@` (o el subdominio si quieres `dashboard.midominio.com`)
   - **Valor (Points to):** Pega aquí la **IP Pública** que te dio DigitalOcean.
   - Guarda los cambios (los dominios pueden tardar hasta 1-2 horas en reconocer el cambio en todo el mundo).

---

## FASE 4: Entrar al Servidor (VPS)
Abre la consola en tu computadora y conéctate usando SSH:
```bash
ssh root@<IP_DE_TU_SERVIDOR>
```
*Sustituye `<IP_DE_TU_SERVIDOR>` con el número real. Te pedirá tu contraseña.*

Una vez dentro (sabrás que estás dentro porque tu terminal dirá `root@ubuntu...`):
1. **Descarga tu código de GitHub**:
   Como el repo es privado, github te pedirá tu usuario y un "Personal Access Token" (que creas en Github Developer Settings) como contraseña.
   ```bash
   git clone https://github.com/tu-usuario/tu-repo.git mi-bot
   cd mi-bot
   ```

2. **Crea tu archivo `.env`**:
   Como GitHub no guardó las contraseñas, debemos crear el archivo de variables secreto directamente aquí:
   ```bash
   nano .env
   ```
   Allí adentro, pega tus variables e incluye tu dominio nuevo (usa HTTP si aún no activas seguridad extra, o HTTPS si usas algo como Cloudflare):
   ```plaintext
   SUPABASE_URL=tu_url_aqui
   SUPABASE_KEY=tu_key_aqui
   DASHBOARD_USER=admin
   DASHBOARD_PASSWORD=1234
   JWT_SECRET=una_clave_larga_rara
   DASHBOARD_URL=http://tudominio.com
   ```
   *(Presiona `Ctrl+O`, luego `Enter` para guardar, y `Ctrl+X` para salir).*

3. **Crea la carpeta de Sesión para WhatsApp (vacía)**:
   ```bash
   mkdir .wwebjs_auth
   ```

---

## FASE 5: ¡Encender el Bot con Docker!
Estando en la carpeta `mi-bot`, le decimos a Docker que arme el programa y lo corra usando el **puerto 80** para que responda a las visitas web estándar del dominio.

1. **Empacar todo (Build):**
   ```bash
   docker build -t app-bot .
   ```

2. **Correr el Bot:**
   ```bash
   docker run -d --name bot_produccion -p 80:3000 --env-file .env -v "$PWD/.wwebjs_auth:/app/.wwebjs_auth" app-bot
   ```

¡Ya está! 
Si entras desde tu celular a `http://tudominio.com/dashboard.html`, deberías ver tu panel, pedirá el Login, ¡y luego verás el código QR de WhatsApp listo para que lo escanees por primera y única vez!

> 💡 **Tip:** Si el día de mañana modificas el código de tu web, los únicos comandos que tienes que ejecutar en el servidor son: `git pull` para bajar los cambios, el `docker build` y finalmente volver a correrlo.
