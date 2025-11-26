const { dbRun } = require('../database');

// Registrar acción en auditoría
async function registrarAuditoria(rol, accion, tablaAfectada = null, registroId = null, datosAnteriores = null, datosNuevos = null) {
  try {
    await dbRun(
      `INSERT INTO auditoria (rol, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        rol,
        accion,
        tablaAfectada,
        registroId,
        datosAnteriores ? JSON.stringify(datosAnteriores) : null,
        datosNuevos ? JSON.stringify(datosNuevos) : null
      ]
    );
  } catch (error) {
    console.error('Error registrando auditoría:', error);
    // No lanzar error para no interrumpir el flujo principal
  }
}

// Obtener historial de auditoría
async function obtenerAuditoria(filtros = {}) {
  const { dbAll } = require('../database');
  
  let query = 'SELECT * FROM auditoria WHERE 1=1';
  const params = [];

  if (filtros.rol) {
    query += ' AND rol = ?';
    params.push(filtros.rol);
  }

  if (filtros.tabla) {
    query += ' AND tabla_afectada = ?';
    params.push(filtros.tabla);
  }

  if (filtros.fecha_inicio) {
    query += ' AND DATE(created_at) >= ?';
    params.push(filtros.fecha_inicio);
  }

  if (filtros.fecha_fin) {
    query += ' AND DATE(created_at) <= ?';
    params.push(filtros.fecha_fin);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(filtros.limite || 100);

  return await dbAll(query, params);
}

module.exports = {
  registrarAuditoria,
  obtenerAuditoria
};

