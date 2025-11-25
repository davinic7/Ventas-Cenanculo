const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ventas.db');
const db = new sqlite3.Database(dbPath);

// Inicializar base de datos
db.serialize(() => {
  // Tabla de cocinas
  db.run(`CREATE TABLE IF NOT EXISTS cocinas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL,
    activa INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabla de productos
  db.run(`CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cocina_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    precio REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cocina_id) REFERENCES cocinas(id)
  )`);

  // Tabla de pedidos
  db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_cliente TEXT NOT NULL,
    vendedor_id TEXT,
    estado TEXT DEFAULT 'pendiente',
    cocina_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cocina_id) REFERENCES cocinas(id)
  )`);

  // Tabla de items de pedido
  db.run(`CREATE TABLE IF NOT EXISTS pedido_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  )`);

  // Tabla de ventas (historial completo)
  db.run(`CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    producto_nombre TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    total_producto REAL NOT NULL,
    medio_pago TEXT NOT NULL,
    total_venta REAL NOT NULL,
    foto_comprobante TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  )`);
  
  // Agregar columna foto_comprobante si no existe (para bases de datos existentes)
  db.run(`ALTER TABLE ventas ADD COLUMN foto_comprobante TEXT`, (err) => {
    // Ignorar error si la columna ya existe
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error agregando columna foto_comprobante:', err);
    }
  });

  // Agregar columnas de promoción si no existen
  db.run(`ALTER TABLE ventas ADD COLUMN es_promocion INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error agregando columna es_promocion:', err);
    }
  });
  
  db.run(`ALTER TABLE ventas ADD COLUMN promocion_nombre TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error agregando columna promocion_nombre:', err);
    }
  });
  
  db.run(`ALTER TABLE ventas ADD COLUMN promocion_precio REAL`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error agregando columna promocion_precio:', err);
    }
  });

  // Tabla de notificaciones
  db.run(`CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    perfil_destino TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    pedido_id INTEGER,
    leida INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
  )`);

  // Tabla de promociones
  db.run(`CREATE TABLE IF NOT EXISTS promociones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    precio REAL NOT NULL,
    descripcion TEXT,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabla de items de promoción
  db.run(`CREATE TABLE IF NOT EXISTS promocion_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    promocion_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  )`);

  // Insertar cocinas de ejemplo
  db.run(`INSERT OR IGNORE INTO cocinas (nombre, categoria) VALUES 
    ('Parrilla', 'parrilla'),
    ('Horno', 'horno'),
    ('Cocina Principal', 'general')`);
});

// Funciones helper para promesas
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Función para ejecutar transacciones atómicas
const dbTransaction = async (callback) => {
  return new Promise((resolve, reject) => {
    // Iniciar transacción
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Ejecutar el callback que contiene las operaciones
      callback()
        .then((result) => {
          // Si todo salió bien, hacer commit
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              // Si el commit falla, hacer rollback
              db.run('ROLLBACK', (rollbackErr) => {
                if (rollbackErr) {
                  reject(new Error(`Error en rollback: ${rollbackErr.message}. Error en commit: ${commitErr.message}`));
                } else {
                  reject(commitErr);
                }
              });
            } else {
              resolve(result);
            }
          });
        })
        .catch((error) => {
          // Si hubo un error, hacer rollback
          db.run('ROLLBACK', (rollbackErr) => {
            if (rollbackErr) {
              reject(new Error(`Error en rollback: ${rollbackErr.message}. Error original: ${error.message}`));
            } else {
              reject(error);
            }
          });
        });
    });
  });
};

module.exports = { db, dbRun, dbGet, dbAll, dbTransaction };

