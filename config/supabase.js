const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase no configurado. Las imágenes de comprobantes no se guardarán.');
}

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Función para subir imagen a Supabase Storage
async function subirComprobante(fileBuffer, fileName, mimeType = 'image/jpeg') {
  if (!supabase) {
    throw new Error('Supabase no está configurado');
  }

  const bucket = process.env.SUPABASE_BUCKET || 'comprobantes';
  const timestamp = Date.now();
  const filePath = `${timestamp}_${fileName}`;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: false
      });

    if (error) {
      throw error;
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error subiendo imagen a Supabase:', error);
    throw error;
  }
}

// Función para eliminar imagen de Supabase Storage
async function eliminarComprobante(filePath) {
  if (!supabase) {
    return;
  }

  const bucket = process.env.SUPABASE_BUCKET || 'comprobantes';
  const fileName = filePath.split('/').pop();

  try {
    await supabase.storage
      .from(bucket)
      .remove([fileName]);
  } catch (error) {
    console.error('Error eliminando imagen de Supabase:', error);
  }
}

module.exports = {
  supabase,
  subirComprobante,
  eliminarComprobante
};

