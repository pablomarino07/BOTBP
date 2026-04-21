/* ============================================================
   Este script tiene la funcionalidad de inicializar y exportar
   la conexión global a la base de datos de origen.

   Funciones:
   - Instancia y exporta el cliente de BD.
   
   Utilizando las herramientas:
   - @supabase/supabase-js
   - dotenv/config
   ============================================================ */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

export const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_KEY
);