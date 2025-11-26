const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de conexión a MySQL/MariaDB
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'CenaculoDB',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '-03:00', // Timezone Argentina
  charset: 'utf8mb4'
};

// Pool de conexiones
const pool = mysql.createPool(dbConfig);

// Funciones helper para promesas
const dbRun = async (sql, params = []) => {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute(sql, params);
    return { 
      lastID: result.insertId || 0, 
      changes: result.affectedRows || 0 
    };
  } finally {
    connection.release();
  }
};

const dbGet = async (sql, params = []) => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows[0] || null;
  } finally {
    connection.release();
  }
};

const dbAll = async (sql, params = []) => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    connection.release();
  }
};

// Función para ejecutar transacciones atómicas
const dbTransaction = async (callback) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    // Crear funciones con la conexión de la transacción
    const transactionRun = async (sql, params = []) => {
      const [result] = await connection.execute(sql, params);
      return { 
        lastID: result.insertId || 0, 
        changes: result.affectedRows || 0 
      };
    };
    
    const transactionGet = async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows[0] || null;
    };
    
    const transactionAll = async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    };
    
    // Ejecutar el callback con las funciones de transacción
    const result = await callback({ run: transactionRun, get: transactionGet, all: transactionAll });
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Inicializar base de datos (crear tablas si no existen)
const initDatabase = async () => {
  try {
    // Tabla de eslabones de producción
    await dbRun(`
      CREATE TABLE IF NOT EXISTS eslabones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        tipo ENUM('cocina', 'parrilla', 'horno', 'bebidas', 'postres') NOT NULL,
        activo TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla de categorías de productos
    await dbRun(`
      CREATE TABLE IF NOT EXISTS categorias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        tipo ENUM('comida', 'bebida', 'postre') NOT NULL,
        activa TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla de productos
    await dbRun(`
      CREATE TABLE IF NOT EXISTS productos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        eslabon_id INT NOT NULL,
        categoria_id INT,
        nombre VARCHAR(200) NOT NULL,
        descripcion TEXT,
        precio DECIMAL(10, 2) NOT NULL,
        stock DECIMAL(10, 2) DEFAULT 0,
        unidad_venta VARCHAR(50) DEFAULT 'unidad',
        tipo_venta ENUM('unidad', 'docena', 'media_docena', 'botella', 'vaso') DEFAULT 'unidad',
        producto_base_id INT NULL,
        variantes JSON NULL,
        activo TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (eslabon_id) REFERENCES eslabones(id) ON DELETE RESTRICT,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
        FOREIGN KEY (producto_base_id) REFERENCES productos(id) ON DELETE SET NULL,
        INDEX idx_eslabon (eslabon_id),
        INDEX idx_categoria (categoria_id),
        INDEX idx_activo (activo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla de pedidos
    await dbRun(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre_cliente VARCHAR(200) NOT NULL,
        rol_atencion VARCHAR(50),
        estado ENUM('tomado', 'en_preparacion', 'listo', 'entregado', 'cancelado') DEFAULT 'tomado',
        medio_pago ENUM('efectivo', 'transferencia') NOT NULL,
        comprobante_url TEXT,
        total DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        entregado_at TIMESTAMP NULL,
        INDEX idx_estado (estado),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla de items de pedido
    await dbRun(`
      CREATE TABLE IF NOT EXISTS pedido_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pedido_id INT NOT NULL,
        producto_id INT NOT NULL,
        eslabon_id INT NOT NULL,
        cantidad DECIMAL(10, 2) NOT NULL,
        unidad VARCHAR(50) NOT NULL,
        precio_unitario DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
        FOREIGN KEY (eslabon_id) REFERENCES eslabones(id) ON DELETE RESTRICT,
        INDEX idx_pedido (pedido_id),
        INDEX idx_eslabon (eslabon_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla de ventas (historial completo)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS ventas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pedido_id INT NOT NULL,
        producto_id INT NOT NULL,
        producto_nombre VARCHAR(200) NOT NULL,
        cantidad DECIMAL(10, 2) NOT NULL,
        precio_unitario DECIMAL(10, 2) NOT NULL,
        total_producto DECIMAL(10, 2) NOT NULL,
        medio_pago ENUM('efectivo', 'transferencia') NOT NULL,
        total_venta DECIMAL(10, 2) NOT NULL,
        comprobante_url TEXT,
        es_promocion TINYINT(1) DEFAULT 0,
        promocion_nombre VARCHAR(200),
        promocion_precio DECIMAL(10, 2),
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE RESTRICT,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
        INDEX idx_pedido (pedido_id),
        INDEX idx_fecha (fecha)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla de notificaciones
    await dbRun(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL,
        rol_destino VARCHAR(50) NOT NULL,
        mensaje TEXT NOT NULL,
        pedido_id INT,
        leida TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
        INDEX idx_rol_destino (rol_destino, leida)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla de promociones
    await dbRun(`
      CREATE TABLE IF NOT EXISTS promociones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(200) NOT NULL,
        precio DECIMAL(10, 2) NOT NULL,
        descripcion TEXT,
        activo TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla de items de promoción
    await dbRun(`
      CREATE TABLE IF NOT EXISTS promocion_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        promocion_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad DECIMAL(10, 2) NOT NULL DEFAULT 1,
        FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla de auditoría
    await dbRun(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rol VARCHAR(50) NOT NULL,
        accion VARCHAR(100) NOT NULL,
        tabla_afectada VARCHAR(100),
        registro_id INT,
        datos_anteriores JSON,
        datos_nuevos JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_rol (rol),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla de cierres de día
    await dbRun(`
      CREATE TABLE IF NOT EXISTS cierres_dia (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fecha DATE NOT NULL UNIQUE,
        total_ventas DECIMAL(10, 2) NOT NULL,
        total_efectivo DECIMAL(10, 2) NOT NULL,
        total_transferencias DECIMAL(10, 2) NOT NULL,
        total_pedidos INT NOT NULL,
        reporte_pdf_url TEXT,
        cerrado_por VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fecha (fecha)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabla de configuración
    await dbRun(`
      CREATE TABLE IF NOT EXISTS configuracion (
        id INT AUTO_INCREMENT PRIMARY KEY,
        clave VARCHAR(100) NOT NULL UNIQUE,
        valor TEXT NOT NULL,
        tipo VARCHAR(50) DEFAULT 'string',
        descripcion TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Insertar datos iniciales
    await insertarDatosIniciales();
    
    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
};

// Insertar datos iniciales
const insertarDatosIniciales = async () => {
  try {
    // Eslabones de producción
    await dbRun(`
      INSERT IGNORE INTO eslabones (nombre, tipo) VALUES
      ('Cocina', 'cocina'),
      ('Parrilla', 'parrilla'),
      ('Horno', 'horno'),
      ('Bebidas', 'bebidas'),
      ('Postres', 'postres')
    `);

    // Categorías básicas
    await dbRun(`
      INSERT IGNORE INTO categorias (nombre, tipo) VALUES
      ('Comida', 'comida'),
      ('Bebidas', 'bebida'),
      ('Postres', 'postre')
    `);

    // Configuración inicial
    await dbRun(`
      INSERT IGNORE INTO configuracion (clave, valor, tipo, descripcion) VALUES
      ('vasos_por_botella', '4', 'number', 'Cantidad de vasos que se obtienen de una botella'),
      ('palabra_clave_cierre', 'GraciasSanJose', 'string', 'Palabra clave para realizar el cierre del día'),
      ('nombre_negocio', 'Cenáculo', 'string', 'Nombre del negocio'),
      ('moneda', 'ARS', 'string', 'Código de moneda')
    `);
  } catch (error) {
    console.error('Error insertando datos iniciales:', error);
  }
};

// Inicializar al cargar el módulo
initDatabase().catch(console.error);

module.exports = { pool, dbRun, dbGet, dbAll, dbTransaction, initDatabase };
