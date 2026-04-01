/* 
   LIBRERÍAS 
   Cargamos dotenv para poder acceder a la API KEY de Gemini.
*/
import * as dotenv from 'dotenv';

/* 
   INICIALIZACIÓN 
   Cargamos el entorno.
*/
dotenv.config();

async function listModels() {
    /* 
       VARIABLE DE ACCESO 
       Extraemos la clave de la IA. Si no existe, el script no puede seguir.
    */
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.error("❌ Error: No se encontró GEMINI_API_KEY en .env");
        return;
    }

    try {
        /* 
           PETICIÓN A GOOGLE 
           Llamamos a la API oficial para que nos devuelva la lista de modelos.
           Usamos 'fetch' que es la forma estándar de pedir datos a internet.
        */
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        const data = await response.json();

        /* 
           VERIFICACIÓN DE RESPUESTA 
           Si la API nos responde con un error (ej. clave expirada), lo mostramos.
        */
        if (data.error) {
            console.error("❌ Error de Google:", data.error.message);
            return;
        }

        /* 
           FILTRADO DE MODELOS 
           No todos los modelos de Google sirven para chatear.
           Filtramos aquellos que aceptan el método 'generateContent'.
        */
        const modelos = data.models
            .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
            .map(m => m.name);

        console.log("✅ Modelos detectados en tu cuenta:");
        modelos.forEach(m => console.log(" -", m));
        
    } catch (error) {
        /* 
           ERROR DE CONEXIÓN 
           Esto ocurre si no hay internet o el servidor de Google está caído.
        */
        console.error("❌ Error de red:", error.message);
    }
}

listModels();
