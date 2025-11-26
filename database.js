const { Pool } = require('pg');
require('dotenv').config();

// Configuración de conexión a PostgreSQL
// Soporta DATABASE_URL (formato estándar de Render) o variables individuales
let dbConfig;

if (process.env.DATABASE_URL) {
  // Usar DATABASE_URL si está disponible (formato: postgresql://user:password@host:port/database)
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' || process.env.DATABASE_URL.includes('sslmode=require') 
      ? { rejectUnauthorized: false } 
      : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
} else {
  // Usar variables individuales como fallback
  dbConfig = {
    host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
    port: process.env.DB_PORT || process.env.PGPORT || 5432,
    user: process.env.DB_USER || process.env.PGUSER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
    database: process.env.DB_NAME || process.env.PGDATABASE || 'CenaculoDB',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

// Pool de conexiones
const pool = new Pool(dbConfig);

// Manejar errores del pool
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

// Función para verificar la conexión
const verificarConexion = async () => {
  try {
    const result = await pool.query('SELECT NOW() as tiempo');
    console.log('✅ Conexión a PostgreSQL verificada:', result.rows[0].tiempo);
    return true;
  } catch (error) {
    console.error('❌ Error verificando conexión a PostgreSQL:', error.message);
    console.error('Código de error:', error.code);
    return false;
  }
};

// Funciones helper para promesas
const dbRun = async (sql, params = []) => {
  const client = await pool.connect();
  try {
    // Convertir ? a $1, $2, etc. para PostgreSQL
    let pgSql = sql;
    let paramIndex = 1;
    const pgParams = [];
    
    // Detectar si es un INSERT y agregar RETURNING id si no está presente
    const isInsert = /^\s*INSERT\s+INTO/i.test(sql.trim());
    const hasReturning = /RETURNING/i.test(sql);
    
    if (isInsert && !hasReturning) {
      // Agregar RETURNING id al final del INSERT
      pgSql = pgSql.replace(/;?\s*$/, '') + ' RETURNING id';
    }
    
    for (let i = 0; i < params.length; i++) {
      pgSql = pgSql.replace('?', `$${paramIndex}`);
      pgParams.push(params[i]);
      paramIndex++;
    }
    
    const result = await client.query(pgSql, pgParams);
    const lastID = result.rows[0]?.id || 0;
    
    return { 
      lastID: lastID, 
      changes: result.rowCount || 0,
      insertId: lastID
    };
  } finally {
    client.release();
  }
};

const dbGet = async (sql, params = []) => {
  const client = await pool.connect();
  try {
    // Convertir ? a $1, $2, etc. para PostgreSQL
    let pgSql = sql;
    let paramIndex = 1;
    const pgParams = [];
    
    for (let i = 0; i < params.length; i++) {
      pgSql = pgSql.replace('?', `$${paramIndex}`);
      pgParams.push(params[i]);
      paramIndex++;
    }
    
    const result = await client.query(pgSql, pgParams);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

const dbAll = async (sql, params = []) => {
  const client = await pool.connect();
  try {
    // Convertir ? a $1, $2, etc. para PostgreSQL
    let pgSql = sql;
    let paramIndex = 1;
    const pgParams = [];
    
    for (let i = 0; i < params.length; i++) {
      pgSql = pgSql.replace('?', `$${paramIndex}`);
      pgParams.push(params[i]);
      paramIndex++;
    }
    
    const result = await client.query(pgSql, pgParams);
    return result.rows;
  } finally {
    client.release();
  }
};

// Función para ejecutar transacciones atómicas
const dbTransaction = async (callback) => {
  const client = await pool.connect();
  await client.query('BEGIN');
  
  try {
    // Crear funciones con la conexión de la transacción
    const transactionRun = async (sql, params = []) => {
      // Convertir ? a $1, $2, etc. para PostgreSQL
      let pgSql = sql;
      let paramIndex = 1;
      const pgParams = [];
      
      // Detectar si es un INSERT y agregar RETURNING id si no está presente
      const isInsert = /^\s*INSERT\s+INTO/i.test(sql.trim());
      const hasReturning = /RETURNING/i.test(sql);
      
      if (isInsert && !hasReturning) {
        // Agregar RETURNING id al final del INSERT
        pgSql = pgSql.replace(/;?\s*$/, '') + ' RETURNING id';
      }
      
      for (let i = 0; i < params.length; i++) {
        pgSql = pgSql.replace('?', `$${paramIndex}`);
        pgParams.push(params[i]);
        paramIndex++;
      }
      
      const result = await client.query(pgSql, pgParams);
      const lastID = result.rows[0]?.id || 0;
      
      return { 
        lastID: lastID, 
        changes: result.rowCount || 0,
        insertId: lastID
      };
    };
    
    const transactionGet = async (sql, params = []) => {
      // Convertir ? a $1, $2, etc. para PostgreSQL
      let pgSql = sql;
      let paramIndex = 1;
      const pgParams = [];
      
      for (let i = 0; i < params.length; i++) {
        pgSql = pgSql.replace('?', `$${paramIndex}`);
        pgParams.push(params[i]);
        paramIndex++;
      }
      
      const result = await client.query(pgSql, pgParams);
      return result.rows[0] || null;
    };
    
    const transactionAll = async (sql, params = []) => {
      // Convertir ? a $1, $2, etc. para PostgreSQL
      let pgSql = sql;
      let paramIndex = 1;
      const pgParams = [];
      
      for (let i = 0; i < params.length; i++) {
        pgSql = pgSql.replace('?', `$${paramIndex}`);
        pgParams.push(params[i]);
        paramIndex++;
      }
      
      const result = await client.query(pgSql, pgParams);
      return result.rows;
    };
    
    // Ejecutar el callback con las funciones de transacción
    const result = await callback({ run: transactionRun, get: transactionGet, all: transactionAll });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Inicializar base de datos (crear tablas si no existen)
const initDatabase = async () => {
  try {
    // Crear tipos ENUM si no existen
    await dbRun(`
      DO $$ BEGIN
        CREATE TYPE eslabon_tipo AS ENUM ('cocina', 'parrilla', 'horno', 'bebidas', 'postres');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await dbRun(`
      DO $$ BEGIN
        CREATE TYPE categoria_tipo AS ENUM ('comida', 'bebida', 'postre');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await dbRun(`
      DO $$ BEGIN
        CREATE TYPE tipo_venta AS ENUM ('unidad', 'docena', 'media_docena', 'botella', 'vaso');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await dbRun(`
      DO $$ BEGIN
        CREATE TYPE pedido_estado AS ENUM ('tomado', 'en_preparacion', 'listo', 'entregado', 'cancelado');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await dbRun(`
      DO $$ BEGIN
        CREATE TYPE medio_pago AS ENUM ('efectivo', 'transferencia');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Tabla de eslabones de producción
    await dbRun(`
      CREATE TABLE IF NOT EXISTS eslabones (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        tipo eslabon_tipo NOT NULL,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Trigger para actualizar updated_at
    await dbRun(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await dbRun(`
      DROP TRIGGER IF EXISTS update_eslabones_updated_at ON eslabones;
      CREATE TRIGGER update_eslabones_updated_at
        BEFORE UPDATE ON eslabones
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Tabla de categorías de productos
    await dbRun(`
      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        tipo categoria_tipo NOT NULL,
        activa BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de productos
    await dbRun(`
      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        eslabon_id INTEGER NOT NULL,
        categoria_id INTEGER,
        nombre VARCHAR(200) NOT NULL,
        descripcion TEXT,
        precio DECIMAL(10, 2) NOT NULL,
        stock DECIMAL(10, 2) DEFAULT 0,
        unidad_venta VARCHAR(50) DEFAULT 'unidad',
        tipo_venta tipo_venta DEFAULT 'unidad',
        producto_base_id INTEGER NULL,
        variantes JSONB NULL,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (eslabon_id) REFERENCES eslabones(id) ON DELETE RESTRICT,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
        FOREIGN KEY (producto_base_id) REFERENCES productos(id) ON DELETE SET NULL
      )
    `);

    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_productos_eslabon ON productos(eslabon_id);
      CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
      CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);
    `);

    await dbRun(`
      DROP TRIGGER IF EXISTS update_productos_updated_at ON productos;
      CREATE TRIGGER update_productos_updated_at
        BEFORE UPDATE ON productos
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Tabla de pedidos
    await dbRun(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        nombre_cliente VARCHAR(200) NOT NULL,
        rol_atencion VARCHAR(50),
        estado pedido_estado DEFAULT 'tomado',
        medio_pago medio_pago NOT NULL,
        comprobante_url TEXT,
        total DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        entregado_at TIMESTAMP NULL
      )
    `);

    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
      CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON pedidos(created_at);
    `);

    await dbRun(`
      DROP TRIGGER IF EXISTS update_pedidos_updated_at ON pedidos;
      CREATE TRIGGER update_pedidos_updated_at
        BEFORE UPDATE ON pedidos
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Tabla de items de pedido
    await dbRun(`
      CREATE TABLE IF NOT EXISTS pedido_items (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        eslabon_id INTEGER NOT NULL,
        cantidad DECIMAL(10, 2) NOT NULL,
        unidad VARCHAR(50) NOT NULL,
        precio_unitario DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
        FOREIGN KEY (eslabon_id) REFERENCES eslabones(id) ON DELETE RESTRICT
      )
    `);

    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);
      CREATE INDEX IF NOT EXISTS idx_pedido_items_eslabon ON pedido_items(eslabon_id);
    `);

    // Tabla de ventas (historial completo)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS ventas (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        producto_nombre VARCHAR(200) NOT NULL,
        cantidad DECIMAL(10, 2) NOT NULL,
        precio_unitario DECIMAL(10, 2) NOT NULL,
        total_producto DECIMAL(10, 2) NOT NULL,
        medio_pago medio_pago NOT NULL,
        total_venta DECIMAL(10, 2) NOT NULL,
        comprobante_url TEXT,
        es_promocion BOOLEAN DEFAULT false,
        promocion_nombre VARCHAR(200),
        promocion_precio DECIMAL(10, 2),
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
      )
    `);

    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_ventas_pedido ON ventas(pedido_id);
      CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
    `);

    // Tabla de notificaciones
    await dbRun(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL,
        rol_destino VARCHAR(50) NOT NULL,
        mensaje TEXT NOT NULL,
        pedido_id INTEGER,
        leida BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
      )
    `);

    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_notificaciones_rol_destino ON notificaciones(rol_destino, leida);
    `);

    // Tabla de promociones
    await dbRun(`
      CREATE TABLE IF NOT EXISTS promociones (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(200) NOT NULL,
        precio DECIMAL(10, 2) NOT NULL,
        descripcion TEXT,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de items de promoción
    await dbRun(`
      CREATE TABLE IF NOT EXISTS promocion_items (
        id SERIAL PRIMARY KEY,
        promocion_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad DECIMAL(10, 2) NOT NULL DEFAULT 1,
        FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
      )
    `);

    // Tabla de auditoría
    await dbRun(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id SERIAL PRIMARY KEY,
        rol VARCHAR(50) NOT NULL,
        accion VARCHAR(100) NOT NULL,
        tabla_afectada VARCHAR(100),
        registro_id INTEGER,
        datos_anteriores JSONB,
        datos_nuevos JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_auditoria_rol ON auditoria(rol);
      CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria(created_at);
    `);

    // Tabla de cierres de día
    await dbRun(`
      CREATE TABLE IF NOT EXISTS cierres_dia (
        id SERIAL PRIMARY KEY,
        fecha DATE NOT NULL UNIQUE,
        total_ventas DECIMAL(10, 2) NOT NULL,
        total_efectivo DECIMAL(10, 2) NOT NULL,
        total_transferencias DECIMAL(10, 2) NOT NULL,
        total_pedidos INTEGER NOT NULL,
        reporte_pdf_url TEXT,
        cerrado_por VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE INDEX IF NOT EXISTS idx_cierres_dia_fecha ON cierres_dia(fecha);
    `);

    // Tabla de configuración
    await dbRun(`
      CREATE TABLE IF NOT EXISTS configuracion (
        id SERIAL PRIMARY KEY,
        clave VARCHAR(100) NOT NULL UNIQUE,
        valor TEXT NOT NULL,
        tipo VARCHAR(50) DEFAULT 'string',
        descripcion TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      DROP TRIGGER IF EXISTS update_configuracion_updated_at ON configuracion;
      CREATE TRIGGER update_configuracion_updated_at
        BEFORE UPDATE ON configuracion
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Verificar conexión antes de continuar
    const conexionOk = await verificarConexion();
    if (!conexionOk) {
      throw new Error('No se pudo verificar la conexión a la base de datos');
    }

    // Insertar datos iniciales
    await insertarDatosIniciales();
    
    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    console.error('Detalles del error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    throw error;
  }
};

// Insertar datos iniciales
const insertarDatosIniciales = async () => {
  try {
    // Eslabones de producción
    await dbRun(`
      INSERT INTO eslabones (nombre, tipo) VALUES
      ('Cocina', 'cocina'),
      ('Parrilla', 'parrilla'),
      ('Horno', 'horno'),
      ('Bebidas', 'bebidas'),
      ('Postres', 'postres')
      ON CONFLICT (nombre) DO NOTHING
    `);

    // Categorías básicas
    await dbRun(`
      INSERT INTO categorias (nombre, tipo) VALUES
      ('Comida', 'comida'),
      ('Bebidas', 'bebida'),
      ('Postres', 'postre')
      ON CONFLICT (nombre) DO NOTHING
    `);

    // Configuración inicial
    await dbRun(`
      INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES
      ('vasos_por_botella', '4', 'number', 'Cantidad de vasos que se obtienen de una botella'),
      ('palabra_clave_cierre', 'GraciasSanJose', 'string', 'Palabra clave para realizar el cierre del día'),
      ('nombre_negocio', 'Cenáculo', 'string', 'Nombre del negocio'),
      ('moneda', 'ARS', 'string', 'Código de moneda')
      ON CONFLICT (clave) DO NOTHING
    `);
  } catch (error) {
    console.error('Error insertando datos iniciales:', error);
  }
};

// Inicializar al cargar el módulo
initDatabase().catch((error) => {
  console.error('❌ Error crítico inicializando base de datos:', error);
  console.error('Detalles:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
  // No lanzar el error para que el servidor pueda iniciar
  // pero los endpoints fallarán hasta que la BD esté lista
});

module.exports = { pool, dbRun, dbGet, dbAll, dbTransaction, initDatabase, verificarConexion };
