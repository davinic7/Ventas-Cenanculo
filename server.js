const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { db, dbRun, dbGet, dbAll, dbTransaction } = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Clientes WebSocket conectados por perfil
const clients = {
  vendedor: new Set(),
  cocina: new Set(),
  despacho: new Set()
};

// Broadcast a todos los clientes de un perfil
function broadcastToPerfil(perfil, data) {
  const message = JSON.stringify(data);
  clients[perfil].forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// WebSocket connection
wss.on('connection', (ws, req) => {
  let perfil = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'register') {
        perfil = data.perfil;
        if (clients[perfil]) {
          clients[perfil].add(ws);
        }
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    if (perfil && clients[perfil]) {
      clients[perfil].delete(ws);
    }
  });
});

// ========== API COCINAS ==========
// Obtener todas las cocinas
app.get('/api/cocinas', async (req, res) => {
  try {
    const cocinas = await dbAll('SELECT * FROM cocinas WHERE activa = 1');
    res.json(cocinas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener productos de una cocina
app.get('/api/cocinas/:id/productos', async (req, res) => {
  try {
    const productos = await dbAll(
      'SELECT * FROM productos WHERE cocina_id = ? AND activo = 1',
      [req.params.id]
    );
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear producto
app.post('/api/cocinas/:id/productos', async (req, res) => {
  try {
    const { nombre, precio, stock } = req.body;
    const result = await dbRun(
      'INSERT INTO productos (cocina_id, nombre, precio, stock) VALUES (?, ?, ?, ?)',
      [req.params.id, nombre, precio, stock || 0]
    );
    res.json({ id: result.lastID, nombre, precio, stock: stock || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un producto
app.get('/api/productos/:id', async (req, res) => {
  try {
    const producto = await dbGet('SELECT * FROM productos WHERE id = ?', [req.params.id]);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar producto
app.put('/api/productos/:id', async (req, res) => {
  try {
    const { nombre, precio, stock } = req.body;
    await dbRun(
      'UPDATE productos SET nombre = ?, precio = ?, stock = ? WHERE id = ?',
      [nombre, precio, stock, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API PEDIDOS ==========
// Crear pedido (Vendedor)
// Constante: vasos por botella
const VASOS_POR_BOTELLA = 4;

// Función auxiliar para obtener el nombre base de una bebida
function obtenerNombreBaseBebida(nombre) {
  // Remover " - Vaso", " - Botella", " Vaso", " Botella"
  return nombre.replace(/\s*-\s*(vaso|botella)/i, '').replace(/\s+(vaso|botella)/i, '').trim();
}

// Función para encontrar el producto botella correspondiente a un producto vaso
async function encontrarProductoBotella(productoVaso) {
  const nombreBase = obtenerNombreBaseBebida(productoVaso.nombre);
  // Buscar producto botella con el mismo nombre base
  const productoBotella = await dbGet(
    `SELECT id, stock, nombre FROM productos 
     WHERE nombre LIKE ? AND (nombre LIKE '%botella%' OR nombre LIKE '%Botella%')
     LIMIT 1`,
    [`%${nombreBase}%`]
  );
  return productoBotella;
}

app.post('/api/pedidos', async (req, res) => {
  try {
    const { nombre_cliente, items, promociones, medio_pago, vendedor_id, foto_comprobante } = req.body;
    
    // Validar stock antes de procesar (solo para productos que NO son vasos)
    for (const item of items) {
      const producto = await dbGet('SELECT stock, nombre, id FROM productos WHERE id = ?', [item.producto_id]);
      if (!producto) {
        return res.status(400).json({ error: `Producto con ID ${item.producto_id} no encontrado` });
      }
      
      const esVaso = producto.nombre.toLowerCase().includes('vaso');
      
      // No validar stock para vasos (no existe stock de vasos, solo de botellas)
      if (!esVaso) {
        // Si es botella u otro producto, validar normalmente
        if (producto.stock < item.cantidad) {
          return res.status(400).json({ 
            error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}, Solicitado: ${item.cantidad}` 
          });
        }
      }
    }
    
    // Agrupar items por cocina
    const itemsPorCocina = {};
    for (const item of items) {
      const producto = await dbGet('SELECT cocina_id FROM productos WHERE id = ?', [item.producto_id]);
      if (!producto) continue;
      
      if (!itemsPorCocina[producto.cocina_id]) {
        itemsPorCocina[producto.cocina_id] = [];
      }
      itemsPorCocina[producto.cocina_id].push(item);
    }

    // Crear un pedido por cada cocina
    const pedidosCreados = [];
    for (const [cocina_id, itemsCocina] of Object.entries(itemsPorCocina)) {
      const pedidoResult = await dbRun(
        'INSERT INTO pedidos (nombre_cliente, vendedor_id, cocina_id, estado) VALUES (?, ?, ?, ?)',
        [nombre_cliente, vendedor_id || 'vendedor1', cocina_id, 'pendiente']
      );
      
      let totalPedido = 0;
      for (const item of itemsCocina) {
        const producto = await dbGet('SELECT precio, nombre, id FROM productos WHERE id = ?', [item.producto_id]);
        const totalItem = producto.precio * item.cantidad;
        totalPedido += totalItem;
        
        await dbRun(
          'INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, total) VALUES (?, ?, ?, ?, ?)',
          [pedidoResult.lastID, item.producto_id, item.cantidad, producto.precio, totalItem]
        );
        
        // Actualizar stock (solo para productos que NO son vasos)
        const esVaso = producto.nombre.toLowerCase().includes('vaso');
        if (!esVaso) {
          // Si es botella u otro producto, descontar normalmente
          await dbRun('UPDATE productos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.producto_id]);
        }
        // Los vasos NO descuentan stock automáticamente - se descuenta manualmente desde cocina
      }

      // Registrar ventas
      // Primero, identificar qué items pertenecen a promociones
      const itemsEnPromociones = new Set();
      let totalPromociones = 0;
      
      if (promociones && promociones.length > 0) {
        for (const promo of promociones) {
          // Verificar si esta promoción tiene items en esta cocina
          const itemsPromoEnCocina = [];
          for (const promoItem of promo.items) {
            const productoPromo = await dbGet('SELECT cocina_id FROM productos WHERE id = ?', [promoItem.producto_id]);
            if (productoPromo && productoPromo.cocina_id == cocina_id) {
              itemsPromoEnCocina.push(promoItem);
              itemsEnPromociones.add(promoItem.producto_id);
            }
          }
          
          // Si hay items de esta promoción en esta cocina, registrar la promoción
          if (itemsPromoEnCocina.length > 0) {
            const totalPromo = promo.precio * promo.cantidad;
            totalPromociones += totalPromo;
            
            // Registrar la promoción como una venta especial
            // Usar el primer producto_id como referencia, pero marcar como promoción
            const primerProductoId = itemsPromoEnCocina[0].producto_id;
            await dbRun(
              `INSERT INTO ventas (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, total_producto, medio_pago, total_venta, foto_comprobante, es_promocion, promocion_nombre, promocion_precio)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [pedidoResult.lastID, primerProductoId, promo.nombre, promo.cantidad, promo.precio, totalPromo, medio_pago, totalPromo, foto_comprobante || null, 1, promo.nombre, promo.precio]
            );
          }
        }
      }
      
      // Registrar ventas de productos normales (que no están en promociones)
      for (const item of itemsCocina) {
        // Solo registrar si no está en una promoción
        if (!itemsEnPromociones.has(item.producto_id)) {
          const producto = await dbGet('SELECT nombre, precio FROM productos WHERE id = ?', [item.producto_id]);
          const totalProducto = producto.precio * item.cantidad;
          
          await dbRun(
            `INSERT INTO ventas (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, total_producto, medio_pago, total_venta, foto_comprobante, es_promocion, promocion_nombre, promocion_precio)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedidoResult.lastID, item.producto_id, producto.nombre, item.cantidad, producto.precio, totalProducto, medio_pago, totalPedido, foto_comprobante || null, 0, null, null]
          );
        }
      }

      // Crear notificación para cocina
      const cocina = await dbGet('SELECT nombre FROM cocinas WHERE id = ?', [cocina_id]);
      await dbRun(
        'INSERT INTO notificaciones (tipo, perfil_destino, mensaje, pedido_id) VALUES (?, ?, ?, ?)',
        ['nuevo_pedido', 'cocina', `Nuevo pedido de ${nombre_cliente} para ${cocina.nombre}`, pedidoResult.lastID]
      );

      pedidosCreados.push(pedidoResult.lastID);
    }

    // Notificar a cocinas
    broadcastToPerfil('cocina', { type: 'nuevo_pedido', pedidos: pedidosCreados });

    res.json({ success: true, pedidos: pedidosCreados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener pedidos por cocina
app.get('/api/cocinas/:id/pedidos', async (req, res) => {
  try {
    const pedidos = await dbAll(`
      SELECT p.*, 
             GROUP_CONCAT(pi.producto_id || ':' || pi.cantidad || ':' || pr.nombre || ':' || pi.total) as items
      FROM pedidos p
      LEFT JOIN pedido_items pi ON p.id = pi.pedido_id
      LEFT JOIN productos pr ON pi.producto_id = pr.id
      WHERE p.cocina_id = ? AND p.estado IN ('pendiente', 'en_preparacion')
      GROUP BY p.id
      ORDER BY p.created_at ASC
    `, [req.params.id]);
    
    // Formatear items
    const pedidosFormateados = pedidos.map(p => ({
      ...p,
      items: p.items ? p.items.split(',').map(item => {
        const [producto_id, cantidad, nombre, total] = item.split(':');
        return { producto_id, cantidad: parseInt(cantidad), nombre, total: parseFloat(total) };
      }) : []
    }));
    
    res.json(pedidosFormateados);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar estado de pedido (Cocina)
app.put('/api/pedidos/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    await dbRun(
      'UPDATE pedidos SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [estado, req.params.id]
    );

    if (estado === 'listo') {
      // Notificar a despacho
      const pedido = await dbGet('SELECT nombre_cliente FROM pedidos WHERE id = ?', [req.params.id]);
      await dbRun(
        'INSERT INTO notificaciones (tipo, perfil_destino, mensaje, pedido_id) VALUES (?, ?, ?, ?)',
        ['pedido_listo', 'despacho', `Pedido de ${pedido.nombre_cliente} listo para despacho`, req.params.id]
      );
      
      broadcastToPerfil('despacho', { type: 'pedido_listo', pedido_id: req.params.id });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Descontar botella para vasos (Cocina)
app.post('/api/pedidos/:id/descontar-botella', async (req, res) => {
  try {
    const { producto_vaso_id, cantidad_vasos } = req.body;
    
    // Obtener el producto vaso
    const productoVaso = await dbGet('SELECT nombre FROM productos WHERE id = ?', [producto_vaso_id]);
    if (!productoVaso) {
      return res.status(400).json({ error: 'Producto vaso no encontrado' });
    }
    
    // Encontrar el producto botella correspondiente
    const productoBotella = await encontrarProductoBotella(productoVaso);
    if (!productoBotella) {
      return res.status(400).json({ error: 'No se encontró el producto botella correspondiente' });
    }
    
    // Calcular botellas necesarias (redondear hacia arriba)
    const botellasNecesarias = Math.ceil(cantidad_vasos / VASOS_POR_BOTELLA);
    
    // Validar stock
    if (productoBotella.stock < botellasNecesarias) {
      return res.status(400).json({ 
        error: `Stock insuficiente. Disponible: ${productoBotella.stock} botellas, Necesario: ${botellasNecesarias} botellas` 
      });
    }
    
    // Descontar botellas
    await dbRun('UPDATE productos SET stock = stock - ? WHERE id = ?', [botellasNecesarias, productoBotella.id]);
    
    res.json({ 
      success: true, 
      botellas_descontadas: botellasNecesarias,
      stock_restante: productoBotella.stock - botellasNecesarias
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener pedidos listos (Despacho)
app.get('/api/pedidos/listos', async (req, res) => {
  try {
    const pedidos = await dbAll(`
      SELECT p.*, c.nombre as cocina_nombre,
             GROUP_CONCAT(pi.producto_id || ':' || pi.cantidad || ':' || pr.nombre || ':' || pi.total) as items
      FROM pedidos p
      LEFT JOIN cocinas c ON p.cocina_id = c.id
      LEFT JOIN pedido_items pi ON p.id = pi.pedido_id
      LEFT JOIN productos pr ON pi.producto_id = pr.id
      WHERE p.estado = 'listo'
      GROUP BY p.id
      ORDER BY p.updated_at ASC
    `);
    
    const pedidosFormateados = pedidos.map(p => ({
      ...p,
      items: p.items ? p.items.split(',').map(item => {
        const [producto_id, cantidad, nombre, total] = item.split(':');
        return { producto_id, cantidad: parseInt(cantidad), nombre, total: parseFloat(total) };
      }) : []
    }));
    
    res.json(pedidosFormateados);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener pedidos entregados (Historial Despacho)
app.get('/api/pedidos/entregados', async (req, res) => {
  try {
    const { limite = 50 } = req.query;
    const pedidos = await dbAll(`
      SELECT p.*, c.nombre as cocina_nombre,
             GROUP_CONCAT(pi.producto_id || ':' || pi.cantidad || ':' || pr.nombre || ':' || pi.total) as items
      FROM pedidos p
      LEFT JOIN cocinas c ON p.cocina_id = c.id
      LEFT JOIN pedido_items pi ON p.id = pi.pedido_id
      LEFT JOIN productos pr ON pi.producto_id = pr.id
      WHERE p.estado = 'entregado'
      GROUP BY p.id
      ORDER BY p.updated_at DESC
      LIMIT ?
    `, [limite]);
    
    const pedidosFormateados = pedidos.map(p => ({
      ...p,
      items: p.items ? p.items.split(',').map(item => {
        const [producto_id, cantidad, nombre, total] = item.split(':');
        return { producto_id, cantidad: parseInt(cantidad), nombre, total: parseFloat(total) };
      }) : []
    }));
    
    res.json(pedidosFormateados);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Marcar pedido como entregado (Despacho)
app.put('/api/pedidos/:id/entregado', async (req, res) => {
  try {
    await dbRun(
      'UPDATE pedidos SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['entregado', req.params.id]
    );

    // Notificar a vendedor
    const pedido = await dbGet('SELECT nombre_cliente FROM pedidos WHERE id = ?', [req.params.id]);
    await dbRun(
      'INSERT INTO notificaciones (tipo, perfil_destino, mensaje, pedido_id) VALUES (?, ?, ?, ?)',
      ['pedido_entregado', 'vendedor', `Pedido de ${pedido.nombre_cliente} entregado`, req.params.id]
    );
    
    broadcastToPerfil('vendedor', { type: 'pedido_entregado', pedido_id: req.params.id });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API NOTIFICACIONES ==========
app.get('/api/notificaciones/:perfil', async (req, res) => {
  try {
    const notificaciones = await dbAll(
      'SELECT * FROM notificaciones WHERE perfil_destino = ? AND leida = 0 ORDER BY created_at DESC LIMIT 20',
      [req.params.perfil]
    );
    res.json(notificaciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notificaciones/:id/leida', async (req, res) => {
  try {
    await dbRun('UPDATE notificaciones SET leida = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API VENTAS (Historial) ==========
app.get('/api/ventas', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    let query = `
      SELECT v.*, p.nombre_cliente, p.created_at as pedido_fecha, v.foto_comprobante
      FROM ventas v
      LEFT JOIN pedidos p ON v.pedido_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (fecha_inicio) {
      query += ' AND v.fecha >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      query += ' AND v.fecha <= ?';
      params.push(fecha_fin);
    }

    query += ' ORDER BY v.fecha DESC, p.nombre_cliente ASC LIMIT 500';
    
    const ventas = await dbAll(query, params);
    res.json(ventas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API PROMOCIONES ==========
// Obtener todas las promociones activas
app.get('/api/promociones', async (req, res) => {
  try {
    const promociones = await dbAll(`
      SELECT p.*, 
             GROUP_CONCAT(pi.producto_id || ':' || pi.cantidad || ':' || pr.nombre) as items
      FROM promociones p
      LEFT JOIN promocion_items pi ON p.id = pi.promocion_id
      LEFT JOIN productos pr ON pi.producto_id = pr.id
      WHERE p.activo = 1
      GROUP BY p.id
      ORDER BY p.nombre
    `);
    
    const promocionesFormateadas = promociones.map(p => ({
      ...p,
      items: p.items ? p.items.split(',').map(item => {
        const [producto_id, cantidad, nombre] = item.split(':');
        return { producto_id: parseInt(producto_id), cantidad: parseInt(cantidad), nombre };
      }) : []
    }));
    
    res.json(promocionesFormateadas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una promoción específica
app.get('/api/promociones/:id', async (req, res) => {
  try {
    const promocion = await dbGet('SELECT * FROM promociones WHERE id = ?', [req.params.id]);
    if (!promocion) {
      return res.status(404).json({ error: 'Promoción no encontrada' });
    }
    
    const items = await dbAll(`
      SELECT pi.*, pr.nombre, pr.precio
      FROM promocion_items pi
      LEFT JOIN productos pr ON pi.producto_id = pr.id
      WHERE pi.promocion_id = ?
    `, [req.params.id]);
    
    res.json({ ...promocion, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear promoción
app.post('/api/promociones', async (req, res) => {
  try {
    const { nombre, precio, descripcion, items } = req.body;
    
    const result = await dbRun(
      'INSERT INTO promociones (nombre, precio, descripcion) VALUES (?, ?, ?)',
      [nombre, precio, descripcion || '']
    );
    
    // Insertar items de la promoción
    if (items && items.length > 0) {
      for (const item of items) {
        await dbRun(
          'INSERT INTO promocion_items (promocion_id, producto_id, cantidad) VALUES (?, ?, ?)',
          [result.lastID, item.producto_id, item.cantidad || 1]
        );
      }
    }
    
    res.json({ id: result.lastID, nombre, precio, descripcion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar promoción
app.put('/api/promociones/:id', async (req, res) => {
  try {
    const { nombre, precio, descripcion, items, activo } = req.body;
    
    await dbRun(
      'UPDATE promociones SET nombre = ?, precio = ?, descripcion = ?, activo = ? WHERE id = ?',
      [nombre, precio, descripcion || '', activo !== undefined ? activo : 1, req.params.id]
    );
    
    // Eliminar items existentes y crear nuevos
    await dbRun('DELETE FROM promocion_items WHERE promocion_id = ?', [req.params.id]);
    
    if (items && items.length > 0) {
      for (const item of items) {
        await dbRun(
          'INSERT INTO promocion_items (promocion_id, producto_id, cantidad) VALUES (?, ?, ?)',
          [req.params.id, item.producto_id, item.cantidad || 1]
        );
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar promoción
app.delete('/api/promociones/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM promociones WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resumen de ventas
app.get('/api/ventas/resumen', async (req, res) => {
  try {
    const resumen = await dbAll(`
      SELECT 
        medio_pago,
        COUNT(DISTINCT pedido_id) as total_pedidos,
        SUM(total_producto) as total_ventas,
        SUM(cantidad) as total_productos_vendidos
      FROM ventas
      GROUP BY medio_pago
    `);
    
    const total = await dbGet(`
      SELECT 
        COUNT(DISTINCT pedido_id) as total_pedidos,
        SUM(total_producto) as total_ventas
      FROM ventas
    `);
    
    res.json({ por_medio_pago: resumen, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ventas agrupadas por productos
app.get('/api/ventas/por-productos', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    let query = `
      SELECT 
        producto_id,
        CASE 
          WHEN es_promocion = 1 THEN promocion_nombre
          ELSE producto_nombre
        END as producto_nombre,
        medio_pago,
        SUM(cantidad) as cantidad_total,
        CASE 
          WHEN es_promocion = 1 THEN promocion_precio
          ELSE precio_unitario
        END as precio_unitario,
        SUM(total_producto) as total_venta_producto,
        COUNT(DISTINCT pedido_id) as veces_vendido,
        es_promocion,
        promocion_nombre
      FROM ventas
      WHERE 1=1
    `;
    const params = [];

    if (fecha_inicio) {
      query += ' AND fecha >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      query += ' AND fecha <= ?';
      params.push(fecha_fin);
    }

    query += `
      GROUP BY 
        CASE 
          WHEN es_promocion = 1 THEN promocion_nombre
          ELSE producto_id || '|' || producto_nombre
        END,
        medio_pago,
        CASE 
          WHEN es_promocion = 1 THEN promocion_precio
          ELSE precio_unitario
        END
      ORDER BY cantidad_total DESC, producto_nombre ASC
    `;
    
    const productos = await dbAll(query, params);
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CIERRE DE ACTIVIDAD ==========
app.post('/api/cierre-actividad', async (req, res) => {
  try {
    console.log('Endpoint /api/cierre-actividad llamado');
    const { palabra_clave } = req.body;
    const palabraCorrecta = 'MadreElvira';
    
    console.log('Palabra clave recibida:', palabra_clave ? '***' : '(vacía)');
    
    if (!palabra_clave) {
      return res.status(400).json({ error: 'Palabra clave requerida' });
    }
    
    if (palabra_clave !== palabraCorrecta) {
      console.log('Palabra clave incorrecta');
      return res.status(400).json({ error: 'Palabra clave incorrecta' });
    }
    
    console.log('Palabra clave correcta, iniciando cierre de actividad...');
    
    // Verificar que dbTransaction esté disponible
    if (!dbTransaction) {
      console.error('dbTransaction no está disponible');
      return res.status(500).json({ error: 'Error: Función de transacción no disponible' });
    }
    
    // Realizar el cierre de actividad en una transacción atómica
    let resultado;
    try {
      resultado = await dbTransaction(async () => {
        const resultados = {};
        
        // 1. Eliminar todas las ventas (historial de ventas)
        console.log('Eliminando historial de ventas...');
        resultados.ventas = await dbRun('DELETE FROM ventas');
        console.log('Ventas eliminadas. Registros:', resultados.ventas.changes);
        
        // 2. Eliminar todos los items de pedidos (relaciones)
        console.log('Eliminando items de pedidos...');
        resultados.pedidoItems = await dbRun('DELETE FROM pedido_items');
        console.log('Pedido_items eliminados. Registros:', resultados.pedidoItems.changes);
        
        // 3. Eliminar todos los pedidos (actividades/movimientos)
        console.log('Eliminando pedidos (movimientos)...');
        resultados.pedidos = await dbRun('DELETE FROM pedidos');
        console.log('Pedidos eliminados. Registros:', resultados.pedidos.changes);
        
        // 4. Eliminar todas las notificaciones
        console.log('Eliminando notificaciones...');
        resultados.notificaciones = await dbRun('DELETE FROM notificaciones');
        console.log('Notificaciones eliminadas. Registros:', resultados.notificaciones.changes);
        
        // 5. Resetear todos los stocks a cero (mantener productos pero sin stock)
        console.log('Reseteando stocks a cero...');
        resultados.stocks = await dbRun('UPDATE productos SET stock = 0');
        console.log('Stocks reseteados. Productos actualizados:', resultados.stocks.changes);
        
        return resultados;
      });
    } catch (transactionError) {
      console.error('Error en la transacción:', transactionError);
      throw new Error(`Error en la transacción de cierre de actividad: ${transactionError.message}`);
    }
    
    // Verificar que se eliminaron todos los datos
    console.log('Verificando limpieza completa...');
    const ventasRestantes = await dbAll('SELECT COUNT(*) as count FROM ventas');
    const pedidosRestantes = await dbAll('SELECT COUNT(*) as count FROM pedidos');
    const pedidoItemsRestantes = await dbAll('SELECT COUNT(*) as count FROM pedido_items');
    const notifRestantes = await dbAll('SELECT COUNT(*) as count FROM notificaciones');
    const stockVerificado = await dbAll('SELECT SUM(stock) as total FROM productos');
    
    console.log('Verificación final:');
    console.log('- Ventas restantes:', ventasRestantes[0]?.count || 0);
    console.log('- Pedidos restantes:', pedidosRestantes[0]?.count || 0);
    console.log('- Items de pedidos restantes:', pedidoItemsRestantes[0]?.count || 0);
    console.log('- Notificaciones restantes:', notifRestantes[0]?.count || 0);
    console.log('- Stock total:', stockVerificado[0]?.total || 0);
    
    // Validar que todo se limpió correctamente
    if (ventasRestantes[0]?.count > 0 || pedidosRestantes[0]?.count > 0 || 
        pedidoItemsRestantes[0]?.count > 0 || notifRestantes[0]?.count > 0) {
      throw new Error('Error: No se eliminaron todos los datos correctamente');
    }
    
    if (stockVerificado[0]?.total !== null && stockVerificado[0]?.total !== 0) {
      throw new Error('Error: Los stocks no se resetearon correctamente a cero');
    }
    
    console.log('✅ Cierre de actividad completado exitosamente. Sistema reiniciado a cero.');
    
    // Notificar a todos los perfiles
    broadcastToPerfil('cocina', { type: 'cierre_actividad' });
    broadcastToPerfil('despacho', { type: 'cierre_actividad' });
    broadcastToPerfil('vendedor', { type: 'cierre_actividad' });
    broadcastToPerfil('ventas', { type: 'cierre_actividad' });
    
    res.json({ 
      success: true, 
      mensaje: '✅ Cierre de actividad realizado exitosamente. Sistema reiniciado a cero:\n' +
               '• Historial de ventas eliminado\n' +
               '• Todos los movimientos y registros eliminados\n' +
               '• Notificaciones eliminadas\n' +
               '• Stocks de productos reseteados a cero\n' +
               'El sistema está listo para un nuevo comienzo.'
    });
  } catch (error) {
    console.error('Error en cierre de actividad:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.log('🚂 Desplegado en Railway');
  }
});

