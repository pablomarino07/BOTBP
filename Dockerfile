FROM node:18-bullseye-slim

# 1. Instalamos Chromium y las dependencias necesarias de sistema operativo.
# Las bibliotecas son requeridas para whatsapp-web.js / Puppeteer bajo Linux.
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    libnss3 \
    libgbm1 \
    libasound2 \
    libxss1 \
    libxtst6 \
    libxshmfence1 \
    ca-certificates \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 2. Saltamos la descarga de Puppeteer de NPM para usar el Chromium que acabamos de instalar 
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 3. Establecemos el directorio de trabajo del contenedor
WORKDIR /app

# 4. Copiamos los archivos de NPM (esto permite usar la cache de docker en cada rebuild)
COPY package*.json ./

# 5. Instalamos paquetes
RUN npm install --omit=dev

# 6. Copiamos el resto de código fuente
COPY . .

# 7. El servidor de express usa un puerto, exponemos el puerto estándar 3000
EXPOSE 3000

# 8. Finalmente, ejecutamos el proyecto
CMD ["npm", "start"]
