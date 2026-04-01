/* 
   CONFIGURACIÓN INICIAL 
   Importamos las librerías necesarias:
   - supabase-js: Para interactuar con la base de datos.
   - dotenv: Para leer las variables sensibles del archivo .env.
*/
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

/* 
   CARGA DE VARIABLES 
   Leemos el archivo .env para que process.env tenga la URL y la KEY.
*/
dotenv.config();

/* 
   CONEXIÓN AL CLIENTE 
   Creamos la instancia de conexión con Supabase. 
   Sin esto, no podemos enviar ni recibir datos.
*/
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function probarConexion() {
    console.log("--- 🔍 Probando conexión con Supabase ---");
    
    /* 
       OBJETO DE PRUEBA 
       Simulamos un pedido real para ver cómo se guarda en las tablas.
    */
    const pedidoSimulado = {
        telefono: "549343000322",
        nombre: "Juan Test (Prueba)",
        direccion: "Calle Falsa 133",
        total: 12900,
        items: [{ producto: "Muzzarella Familiar Molde (Test)", cantidad: 1 }]
    };

    try {
        let cliente;
        
        /* 
           OPERACIÓN: REGISTRO DE CLIENTE (UPSERT)
           El comando 'upsert' hace dos cosas:
           1. Si el teléfono NO existe, crea el cliente.
           2. Si el teléfono YA existe, actualiza su nombre y dirección.
           Esto evita errores por registros duplicados.
        */
        const { data: clienteData, error: errC } = await supabase
            .from('clientes')
            .upsert({ 
                telefono: pedidoSimulado.telefono, 
                nombre: pedidoSimulado.nombre,
                direccion_frecuente: pedidoSimulado.direccion,
                ultima_compra: new Date(Date.now() - 30*24*60*60*1000)
            })
            .select().single();

        /* 
           MANEJO DE ERRORES DEL CLIENTE
           Si hay un error (que no sea por duplicado), detenemos el proceso.
        */
        if (errC) {
            if (errC.message.includes("duplicate key")) {
                /* Si falla por duplicado manual, intentamos obtenerlo con un 'select' */
                const { data: clienteExistente } = await supabase
                    .from('clientes')
                    .select()
                    .eq('telefono', pedidoSimulado.telefono)
                    .single();
                cliente = clienteExistente;
            } else {
                throw errC;
            }
        } else {
            cliente = clienteData;
        }

        /* 
           OPERACIÓN: REGISTRO DE PEDIDO
           Insertamos una nueva fila en la tabla 'pedidos'.
           Usamos 'cliente_id' para que la base de datos sepa de quién es este pedido.
        */
        const { error: errP } = await supabase
            .from('pedidos')
            .insert({
                cliente_id: cliente.id,
                monto_total: pedidoSimulado.total,
                items_json: pedidoSimulado.items
            });

        if (errP) throw errP;
        
        console.log("✅ Todo funciona: Cliente y Pedido guardados correctamente.");

    } catch (error) {
        /* 
           CAPTURA DE ERRORES GENERALES
           Muestra qué falló específicamente para que podamos arreglarlo.
        */
        console.error("❌ Error detectado:", error.message);
    }
}

probarConexion();
