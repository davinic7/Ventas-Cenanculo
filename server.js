const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const moment = require('moment-timezone');
require('dotenv').config();

const { dbRun, dbGet, dbAll, dbTransaction } = require('./database');
const { subirComprobante } = require('./config/supabase');
const { registrarAuditoria } = require('./config/auditoria');
const { generarCierreDia, generarReporteVentas } = require('./config/pdf');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuración
const TIMEZONE = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';
const VASOS_POR_BOTELLA = parseInt(process.env.VASOS_POR_BOTELLA) || 4;
const PALABRA_CLAVE_CIERRE = process.env.PALABRA_CLAVE_CIERRE || 'GraciasSanJose';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configurar multer para subida de imágenes
const upload = multer({ storage: multer.memoryStorage() });

// Clientes WebSocket conectados por rol
const clients = {
  atencion: new Set(),
  cocina: new Set(),
  parrilla: new Set(),
  horno: new Set(),
  bebidas: new Set(),
  postres: new Set(),
  despacho: new Set()
};

// Broadcast a todos los clientes de un rol
function broadcastToRol(rol, data) {
  const message = JSON.stringify(data);
  if (clients[rol]) {
    clients[rol].forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

// Broadcast a todos los eslabones de producción
function broadcastToProduccion(data) {
  ['cocina', 'parrilla', 'horno', 'bebidas', 'postres'].forEach(rol => {
    broadcastToRol(rol, data);
  });
}

// WebSocket connection
wss.on('connection', (ws, req) => {
  let rol = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'register') {
        rol = data.rol;
        if (clients[rol]) {
          clients[rol].add(ws);
        }
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    if (rol && clients[rol]) {
      clients[rol].delete(ws);
    }
  });
});

// ========== API ESLABONES ==========
// Obtener todos los eslabones
app.get('/api/eslabones', async (req, res) => {
  try {
    const eslabones = await dbAll('SELECT * FROM eslabones WHERE activo = 1 ORDER BY nombre');
    res.json(eslabones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener productos de un eslabón
app.get('/api/eslabones/:id/productos', async (req, res) => {
  try {
    const productos = await dbAll(
      `SELECT p.*, c.nombre as categoria_nombre, e.nombre as eslabon_nombre
       FROM productos p
       LEFT JOIN categorias c ON p.categoria_id = c.id
       LEFT JOIN eslabones e ON p.eslabon_id = e.id
       WHERE p.eslabon_id = ? AND p.activo = 1
       ORDER BY p.nombre`,
      [req.params.id]
    );
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear producto en eslabón
app.post('/api/eslabones/:id/productos', async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock, categoria_id, unidad_venta, tipo_venta, producto_base_id, variantes } = req.body;
    const rol = req.headers['x-rol'] || 'sistema';
    
    const result = await dbRun(
      `INSERT INTO productos (eslabon_id, categoria_id, nombre, descripcion, precio, stock, unidad_venta, tipo_venta, producto_base_id, variantes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.id,
        categoria_id || null,
        nombre,
        descripcion || null,
        precio,
        stock || 0,
        unidad_venta || 'unidad',
        tipo_venta || 'unidad',
        producto_base_id || null,
        variantes ? JSON.stringify(variantes) : null
      ]
    );
    
    await registrarAuditoria(rol, 'CREAR_PRODUCTO', 'productos', result.lastID, null, { nombre, precio, stock });
    
    const producto = await dbGet('SELECT * FROM productos WHERE id = ?', [result.lastID]);
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar producto
app.put('/api/productos/:id', async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock, categoria_id, unidad_venta, tipo_venta, producto_base_id, variantes } = req.body;
    const rol = req.headers['x-rol'] || 'sistema';
    
    // Obtener datos anteriores para auditoría
    const productoAnterior = await dbGet('SELECT * FROM productos WHERE id = ?', [req.params.id]);
    if (!productoAnterior) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    const updates = [];
    const params = [];
    
    if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
    if (descripcion !== undefined) { updates.push('descripcion = ?'); params.push(descripcion); }
    if (precio !== undefined) { updates.push('precio = ?'); params.push(precio); }
    if (stock !== undefined) { updates.push('stock = ?'); params.push(stock); }
    if (categoria_id !== undefined) { updates.push('categoria_id = ?'); params.push(categoria_id); }
    if (unidad_venta !== undefined) { updates.push('unidad_venta = ?'); params.push(unidad_venta); }
    if (tipo_venta !== undefined) { updates.push('tipo_venta = ?'); params.push(tipo_venta); }
    if (producto_base_id !== undefined) { updates.push('producto_base_id = ?'); params.push(producto_base_id); }
    if (variantes !== undefined) { updates.push('variantes = ?'); params.push(variantes ? JSON.stringify(variantes) : null); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }
    
    params.push(req.params.id);
    await dbRun(`UPDATE productos SET ${updates.join(', ')} WHERE id = ?`, params);
    
    const productoNuevo = await dbGet('SELECT * FROM productos WHERE id = ?', [req.params.id]);
    await registrarAuditoria(rol, 'ACTUALIZAR_PRODUCTO', 'productos', req.params.id, productoAnterior, productoNuevo);
    
    res.json({ success: true, producto: productoNuevo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar producto (soft delete)
app.delete('/api/productos/:id', async (req, res) => {
  try {
    const rol = req.headers['x-rol'] || 'sistema';
    const producto = await dbGet('SELECT * FROM productos WHERE id = ?', [req.params.id]);
    
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    await dbRun('UPDATE productos SET activo = 0 WHERE id = ?', [req.params.id]);
    await registrarAuditoria(rol, 'ELIMINAR_PRODUCTO', 'productos', req.params.id, producto, null);
    
    res.json({ success: true, message: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un producto
app.get('/api/productos/:id', async (req, res) => {
  try {
    const producto = await dbGet(
      `SELECT p.*, c.nombre as categoria_nombre, e.nombre as eslabon_nombre
       FROM productos p
       LEFT JOIN categorias c ON p.categoria_id = c.id
       LEFT JOIN eslabones e ON p.eslabon_id = e.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    if (producto.variantes) {
      producto.variantes = JSON.parse(producto.variantes);
    }
    
    res.json(producto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API CATEGORÍAS ==========
app.get('/api/categorias', async (req, res) => {
  try {
    const categorias = await dbAll('SELECT * FROM categorias WHERE activa = 1 ORDER BY nombre');
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API PEDIDOS ==========
// Crear pedido (Atención)
app.post('/api/pedidos', upload.single('comprobante'), async (req, res) => {
  try {
    const { nombre_cliente, items, promociones, medio_pago, rol_atencion } = req.body;
    
    // Subir comprobante si existe
    let comprobanteUrl = null;
    if (req.file && medio_pago === 'transferencia') {
      try {
        comprobanteUrl = await subirComprobante(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
      } catch (error) {
        console.error('Error subiendo comprobante:', error);
        return res.status(500).json({ error: 'Error al subir el comprobante' });
      }
    }
    
    // Validar stock antes de procesar
    for (const item of items) {
      const producto = await dbGet(
        'SELECT stock, nombre, id, tipo_venta, producto_base_id, eslabon_id FROM productos WHERE id = ?',
        [item.producto_id]
      );
      
      if (!producto) {
        return res.status(400).json({ error: `Producto con ID ${item.producto_id} no encontrado` });
      }
      
      // No validar stock para vasos (tienen producto_base_id)
      const esVaso = producto.producto_base_id !== null || producto.tipo_venta === 'vaso';
      
      if (!esVaso) {
        let cantidadRequerida = parseFloat(item.cantidad);
        
        // Convertir según tipo de venta
        if (producto.tipo_venta === 'docena') {
          cantidadRequerida = cantidadRequerida * 12;
        } else if (producto.tipo_venta === 'media_docena') {
          cantidadRequerida = cantidadRequerida * 6;
        }
        
        if (parseFloat(producto.stock) < cantidadRequerida) {
          return res.status(400).json({
            error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}, Solicitado: ${cantidadRequerida}`
          });
        }
      }
    }
    
    // Calcular total del pedido
    let totalPedido = 0;
    
    // Calcular total de promociones si hay
    if (promociones && promociones.length > 0) {
      for (const promo of promociones) {
        totalPedido += parseFloat(promo.precio) * parseInt(promo.cantidad);
      }
    } else {
      // Calcular total de items normales
      for (const item of items) {
        const producto = await dbGet('SELECT precio FROM productos WHERE id = ?', [item.producto_id]);
        totalPedido += parseFloat(producto.precio) * parseFloat(item.cantidad);
      }
    }
    
    // Crear pedido único (no por eslabón, todos los items en un solo pedido)
    const pedidoResult = await dbRun(
      `INSERT INTO pedidos (nombre_cliente, rol_atencion, estado, medio_pago, comprobante_url, total)
       VALUES (?, ?, 'tomado', ?, ?, ?)`,
      [nombre_cliente, rol_atencion || 'atencion', medio_pago, comprobanteUrl, totalPedido]
    );
    
    const pedidoId = pedidoResult.lastID;
    
    // Agrupar items por eslabón para notificaciones
    const itemsPorEslabon = {};
    
    // Insertar items del pedido
    for (const item of items) {
      const producto = await dbGet(
        'SELECT precio, nombre, id, eslabon_id, tipo_venta FROM productos WHERE id = ?',
        [item.producto_id]
      );
      
      const precioUnitario = parseFloat(producto.precio);
      const cantidad = parseFloat(item.cantidad);
      const totalItem = precioUnitario * cantidad;
      
      await dbRun(
        `INSERT INTO pedido_items (pedido_id, producto_id, eslabon_id, cantidad, unidad, precio_unitario, total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          pedidoId,
          item.producto_id,
          producto.eslabon_id,
          cantidad,
          item.unidad || producto.tipo_venta || 'unidad',
          precioUnitario,
          totalItem
        ]
      );
      
      // Agrupar por eslabón
      if (!itemsPorEslabon[producto.eslabon_id]) {
        itemsPorEslabon[producto.eslabon_id] = [];
      }
      itemsPorEslabon[producto.eslabon_id].push(producto);
      
      // Actualizar stock (excepto vasos)
      const esVaso = producto.producto_base_id !== null || producto.tipo_venta === 'vaso';
      if (!esVaso) {
        let cantidadADescontar = cantidad;
        
        if (producto.tipo_venta === 'docena') {
          cantidadADescontar = cantidad * 12;
        } else if (producto.tipo_venta === 'media_docena') {
          cantidadADescontar = cantidad * 6;
        }
        
        await dbRun('UPDATE productos SET stock = stock - ? WHERE id = ?', [cantidadADescontar, item.producto_id]);
      }
    }
    
    // Registrar ventas
    if (promociones && promociones.length > 0) {
      // Si hay promociones, TODO el pedido se cobra con precio de promoción
      for (const promo of promociones) {
        const primerItem = items[0];
        await dbRun(
          `INSERT INTO ventas (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, total_producto, medio_pago, total_venta, comprobante_url, es_promocion, promocion_nombre, promocion_precio)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pedidoId,
            primerItem.producto_id,
            promo.nombre,
            promo.cantidad,
            promo.precio,
            promo.precio * promo.cantidad,
            medio_pago,
            totalPedido,
            comprobanteUrl,
            1,
            promo.nombre,
            promo.precio
          ]
        );
      }
    } else {
      // Registrar cada item como venta
      for (const item of items) {
        const producto = await dbGet('SELECT nombre, precio FROM productos WHERE id = ?', [item.producto_id]);
        const totalProducto = parseFloat(producto.precio) * parseFloat(item.cantidad);
        
        await dbRun(
          `INSERT INTO ventas (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, total_producto, medio_pago, total_venta, comprobante_url, es_promocion)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pedidoId,
            item.producto_id,
            producto.nombre,
            item.cantidad,
            producto.precio,
            totalProducto,
            medio_pago,
            totalPedido,
            comprobanteUrl,
            0
          ]
        );
      }
    }
    
    // Crear notificaciones para cada eslabón
    for (const [eslabonId, productosEslabon] of Object.entries(itemsPorEslabon)) {
      const eslabon = await dbGet('SELECT nombre, tipo FROM eslabones WHERE id = ?', [eslabonId]);
      if (eslabon) {
        const rolEslabon = eslabon.tipo; // cocina, parrilla, horno, bebidas, postres
        
        await dbRun(
          'INSERT INTO notificaciones (tipo, rol_destino, mensaje, pedido_id) VALUES (?, ?, ?, ?)',
          [
            'nuevo_pedido',
            rolEslabon,
            `Nuevo pedido de ${nombre_cliente} para ${eslabon.nombre}`,
            pedidoId
          ]
        );
        
        broadcastToRol(rolEslabon, { type: 'nuevo_pedido', pedido_id: pedidoId });
      }
    }
    
    await registrarAuditoria(rol_atencion || 'atencion', 'CREAR_PEDIDO', 'pedidos', pedidoId, null, { nombre_cliente, total: totalPedido });
    
    res.json({ success: true, pedido_id: pedidoId });
  } catch (error) {
    console.error('Error creando pedido:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener pedidos por eslabón
app.get('/api/eslabones/:id/pedidos', async (req, res) => {
  try {
    const pedidos = await dbAll(`
      SELECT p.*,
             STRING_AGG(
               pi.producto_id::text || ':' || pi.cantidad::text || ':' || pi.unidad || ':' || 
               pr.nombre || ':' || pi.total::text || ':' || COALESCE(pr.producto_base_id::text, '') || ':' || 
               COALESCE(pr.tipo_venta::text, ''),
               ','
             ) as items
      FROM pedidos p
      INNER JOIN pedido_items pi ON p.id = pi.pedido_id
      INNER JOIN productos pr ON pi.producto_id = pr.id
      WHERE pi.eslabon_id = ? AND p.estado IN ('tomado', 'en_preparacion')
      GROUP BY p.id
      ORDER BY p.created_at ASC
    `, [req.params.id]);
    
    const pedidosFormateados = pedidos.map(p => {
      const items = p.items ? p.items.split(',').map(item => {
        const [producto_id, cantidad, unidad, nombre, total, producto_base_id, tipo_venta] = item.split(':');
        const esVaso = producto_base_id !== '' || tipo_venta === 'vaso';
        return {
          producto_id: parseInt(producto_id),
          cantidad: parseFloat(cantidad),
          unidad,
          nombre,
          total: parseFloat(total),
          producto_base_id: producto_base_id || null,
          tipo_venta: tipo_venta || null,
          es_vaso: esVaso
        };
      }) : [];
      
      return {
        ...p,
        items
      };
    });
    
    res.json(pedidosFormateados);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar estado de pedido (Producción)
app.put('/api/pedidos/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    const rol = req.headers['x-rol'] || 'sistema';
    
    const estadosValidos = ['tomado', 'en_preparacion', 'listo', 'entregado', 'cancelado'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    
    const pedidoAnterior = await dbGet('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
    if (!pedidoAnterior) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    
    await dbRun(
      'UPDATE pedidos SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [estado, req.params.id]
    );
    
    await registrarAuditoria(rol, 'ACTUALIZAR_ESTADO_PEDIDO', 'pedidos', req.params.id, pedidoAnterior, { estado });
    
    if (estado === 'listo') {
      // Notificar a despacho
      await dbRun(
        'INSERT INTO notificaciones (tipo, rol_destino, mensaje, pedido_id) VALUES (?, ?, ?, ?)',
        ['pedido_listo', 'despacho', `Pedido de ${pedidoAnterior.nombre_cliente} listo para despacho`, req.params.id]
      );
      
      broadcastToRol('despacho', { type: 'pedido_listo', pedido_id: req.params.id });
    } else if (estado === 'entregado') {
      await dbRun(
        'UPDATE pedidos SET entregado_at = CURRENT_TIMESTAMP WHERE id = ?',
        [req.params.id]
      );
      
      // Notificar a atención
      await dbRun(
        'INSERT INTO notificaciones (tipo, rol_destino, mensaje, pedido_id) VALUES (?, ?, ?, ?)',
        ['pedido_entregado', 'atencion', `Pedido de ${pedidoAnterior.nombre_cliente} entregado`, req.params.id]
      );
      
      broadcastToRol('atencion', { type: 'pedido_entregado', pedido_id: req.params.id });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Descontar botella para vasos (Producción)
app.post('/api/pedidos/:id/descontar-botella', async (req, res) => {
  try {
    const { producto_vaso_id, cantidad_vasos } = req.body;
    const rol = req.headers['x-rol'] || 'sistema';
    
    const productoVaso = await dbGet('SELECT id, nombre, producto_base_id, tipo_venta FROM productos WHERE id = ?', [producto_vaso_id]);
    if (!productoVaso) {
      return res.status(400).json({ error: 'Producto vaso no encontrado' });
    }
    
    // Buscar botella base
    let productoBotella = null;
    if (productoVaso.producto_base_id) {
      productoBotella = await dbGet('SELECT id, stock, nombre FROM productos WHERE id = ? AND activo = 1', [productoVaso.producto_base_id]);
    }
    
    if (!productoBotella) {
      return res.status(400).json({ error: 'No se encontró la botella base para este vaso' });
    }
    
    const botellasNecesarias = Math.ceil(cantidad_vasos / VASOS_POR_BOTELLA);
    
    if (parseFloat(productoBotella.stock) < botellasNecesarias) {
      return res.status(400).json({
        error: `Stock insuficiente. Disponible: ${productoBotella.stock} botellas, Necesario: ${botellasNecesarias} botellas`
      });
    }
    
    await dbRun('UPDATE productos SET stock = stock - ? WHERE id = ?', [botellasNecesarias, productoBotella.id]);
    
    const productoBotellaActualizado = await dbGet('SELECT stock FROM productos WHERE id = ?', [productoBotella.id]);
    
    // Avisar si queda 1 botella
    if (parseFloat(productoBotellaActualizado.stock) <= 1) {
      broadcastToRol('bebidas', {
        type: 'alerta_stock',
        mensaje: `⚠️ Alerta: Queda ${productoBotellaActualizado.stock} botella(s) de ${productoBotella.nombre}`,
        producto_id: productoBotella.id
      });
    }
    
    await registrarAuditoria(rol, 'DESCONTAR_BOTELLA', 'productos', productoBotella.id, 
      { stock: productoBotella.stock }, 
      { stock: productoBotellaActualizado.stock });
    
    res.json({
      success: true,
      botellas_descontadas: botellasNecesarias,
      stock_restante: productoBotellaActualizado.stock,
      botella_nombre: productoBotella.nombre,
      alerta: parseFloat(productoBotellaActualizado.stock) <= 1
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener pedidos listos (Despacho)
app.get('/api/pedidos/listos', async (req, res) => {
  try {
    const pedidos = await dbAll(`
      SELECT p.*,
             STRING_AGG(
               pi.producto_id::text || ':' || pi.cantidad::text || ':' || pi.unidad || ':' || pr.nombre || ':' || pi.total::text,
               ','
             ) as items
      FROM pedidos p
      LEFT JOIN pedido_items pi ON p.id = pi.pedido_id
      LEFT JOIN productos pr ON pi.producto_id = pr.id
      WHERE p.estado = 'listo'
      GROUP BY p.id
      ORDER BY p.updated_at ASC
    `);
    
    const pedidosFormateados = pedidos.map(p => ({
      ...p,
      items: p.items ? p.items.split(',').map(item => {
        const [producto_id, cantidad, unidad, nombre, total] = item.split(':');
        return {
          producto_id: parseInt(producto_id),
          cantidad: parseFloat(cantidad),
          unidad,
          nombre,
          total: parseFloat(total)
        };
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
    const rol = req.headers['x-rol'] || 'despacho';
    
    await dbRun(
      'UPDATE pedidos SET estado = ?, entregado_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['entregado', req.params.id]
    );
    
    const pedido = await dbGet('SELECT nombre_cliente FROM pedidos WHERE id = ?', [req.params.id]);
    await registrarAuditoria(rol, 'ENTREGAR_PEDIDO', 'pedidos', req.params.id, null, { estado: 'entregado' });
    
    broadcastToRol('atencion', { type: 'pedido_entregado', pedido_id: req.params.id });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API NOTIFICACIONES ==========
app.get('/api/notificaciones/:rol', async (req, res) => {
  try {
    const notificaciones = await dbAll(
      'SELECT * FROM notificaciones WHERE rol_destino = ? AND leida = 0 ORDER BY created_at DESC LIMIT 20',
      [req.params.rol]
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

// ========== API VENTAS ==========
app.get('/api/ventas', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    let query = `
      SELECT v.*, p.nombre_cliente, p.created_at as pedido_fecha, p.comprobante_url
      FROM ventas v
      LEFT JOIN pedidos p ON v.pedido_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (fecha_inicio) {
      query += ' AND DATE(v.fecha) >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      query += ' AND DATE(v.fecha) <= ?';
      params.push(fecha_fin);
    }

    query += ' ORDER BY v.fecha DESC LIMIT 500';
    
    const ventas = await dbAll(query, params);
    res.json(ventas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API CIERRE DE DÍA ==========
app.post('/api/cierre-dia', async (req, res) => {
  try {
    const { palabra_clave } = req.body;
    const rol = req.headers['x-rol'] || 'sistema';
    
    if (palabra_clave !== PALABRA_CLAVE_CIERRE) {
      return res.status(400).json({ error: 'Palabra clave incorrecta' });
    }
    
    const fecha = moment().tz(TIMEZONE).format('YYYY-MM-DD');
    
    // Verificar si ya existe un cierre para hoy
    const cierreExistente = await dbGet('SELECT * FROM cierres_dia WHERE fecha = ?', [fecha]);
    if (cierreExistente) {
      return res.status(400).json({ error: 'Ya existe un cierre de día para la fecha de hoy' });
    }
    
    // Calcular totales del día
    const ventasDia = await dbAll(`
      SELECT 
        SUM(total_venta) as total_ventas,
        SUM(CASE WHEN medio_pago = 'efectivo' THEN total_venta ELSE 0 END) as total_efectivo,
        SUM(CASE WHEN medio_pago = 'transferencia' THEN total_venta ELSE 0 END) as total_transferencias,
        COUNT(DISTINCT pedido_id) as total_pedidos
      FROM ventas
      WHERE DATE(fecha) = ?
    `, [fecha]);
    
    const totales = ventasDia[0] || {
      total_ventas: 0,
      total_efectivo: 0,
      total_transferencias: 0,
      total_pedidos: 0
    };
    
    // Obtener pedidos del día
    const pedidosDia = await dbAll(`
      SELECT id, nombre_cliente, total, medio_pago
      FROM pedidos
      WHERE DATE(created_at) = ? AND estado != 'cancelado'
      ORDER BY created_at
    `, [fecha]);
    
    // Obtener stock final
    const stockFinal = await dbAll(`
      SELECT id, nombre, stock, unidad_venta, eslabon_id
      FROM productos
      WHERE activo = 1
      ORDER BY nombre
    `);
    
    // Generar PDF
    const datosPDF = {
      fecha,
      total_ventas: parseFloat(totales.total_ventas || 0),
      total_efectivo: parseFloat(totales.total_efectivo || 0),
      total_transferencias: parseFloat(totales.total_transferencias || 0),
      total_pedidos: parseInt(totales.total_pedidos || 0),
      pedidos: pedidosDia,
      stock_final: stockFinal,
      cerrado_por: rol
    };
    
    const pdfBuffer = await generarCierreDia(datosPDF);
    
    // Subir PDF a Supabase (opcional)
    let pdfUrl = null;
    try {
      const { subirComprobante } = require('./config/supabase');
      pdfUrl = await subirComprobante(
        pdfBuffer,
        `cierre_${fecha}.pdf`,
        'application/pdf'
      );
    } catch (error) {
      console.error('Error subiendo PDF:', error);
    }
    
    // Guardar cierre en base de datos
    await dbRun(
      `INSERT INTO cierres_dia (fecha, total_ventas, total_efectivo, total_transferencias, total_pedidos, reporte_pdf_url, cerrado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fecha,
        datosPDF.total_ventas,
        datosPDF.total_efectivo,
        datosPDF.total_transferencias,
        datosPDF.total_pedidos,
        pdfUrl,
        rol
      ]
    );
    
    await registrarAuditoria(rol, 'CIERRE_DIA', 'cierres_dia', null, null, datosPDF);
    
    // Notificar a todos
    broadcastToRol('atencion', { type: 'cierre_dia', fecha });
    broadcastToProduccion({ type: 'cierre_dia', fecha });
    broadcastToRol('despacho', { type: 'cierre_dia', fecha });
    
    res.json({
      success: true,
      mensaje: 'Cierre de día realizado exitosamente',
      fecha,
      totales: datosPDF,
      pdf_url: pdfUrl
    });
  } catch (error) {
    console.error('Error en cierre de día:', error);
    res.status(500).json({ error: error.message });
  }
});

// Descargar PDF de cierre
app.get('/api/cierre-dia/:fecha/pdf', async (req, res) => {
  try {
    const cierre = await dbGet('SELECT * FROM cierres_dia WHERE fecha = ?', [req.params.fecha]);
    if (!cierre) {
      return res.status(404).json({ error: 'Cierre no encontrado' });
    }
    
    // Si hay URL de Supabase, redirigir
    if (cierre.reporte_pdf_url) {
      return res.redirect(cierre.reporte_pdf_url);
    }
    
    // Generar PDF on-the-fly
    const datosPDF = {
      fecha: cierre.fecha,
      total_ventas: parseFloat(cierre.total_ventas),
      total_efectivo: parseFloat(cierre.total_efectivo),
      total_transferencias: parseFloat(cierre.total_transferencias),
      total_pedidos: cierre.total_pedidos,
      cerrado_por: cierre.cerrado_por
    };
    
    const pdfBuffer = await generarCierreDia(datosPDF);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=cierre_${req.params.fecha}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API RESET (Auditoría) ==========
app.post('/api/reset', async (req, res) => {
  try {
    const { palabra_clave } = req.body;
    const rol = req.headers['x-rol'] || 'sistema';
    
    if (palabra_clave !== PALABRA_CLAVE_CIERRE) {
      return res.status(400).json({ error: 'Palabra clave incorrecta' });
    }
    
    await dbTransaction(async (tx) => {
      // Eliminar historiales y movimientos, pero mantener catálogo
      await tx.run('DELETE FROM ventas', []);
      await tx.run('DELETE FROM pedido_items', []);
      await tx.run('DELETE FROM pedidos', []);
      await tx.run('DELETE FROM notificaciones', []);
      await tx.run('DELETE FROM cierres_dia', []);
      await tx.run('UPDATE productos SET stock = 0', []);
    });
    
    await registrarAuditoria(rol, 'RESET_SISTEMA', 'sistema', null, null, { accion: 'reset_completo' });
    
    broadcastToRol('atencion', { type: 'reset_sistema' });
    broadcastToProduccion({ type: 'reset_sistema' });
    broadcastToRol('despacho', { type: 'reset_sistema' });
    
    res.json({ success: true, mensaje: 'Sistema reseteado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API CONFIGURACIÓN ==========
app.get('/api/configuracion', async (req, res) => {
  try {
    const config = await dbAll('SELECT * FROM configuracion');
    const configObj = {};
    config.forEach(item => {
      if (item.tipo === 'number') {
        configObj[item.clave] = parseFloat(item.valor);
      } else if (item.tipo === 'boolean') {
        configObj[item.clave] = item.valor === '1' || item.valor === 'true';
      } else {
        configObj[item.clave] = item.valor;
      }
    });
    res.json(configObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== API AUDITORÍA ==========
app.get('/api/auditoria', async (req, res) => {
  try {
    const { rol, tabla, fecha_inicio, fecha_fin, limite } = req.query;
    const { obtenerAuditoria } = require('./config/auditoria');
    
    const auditoria = await obtenerAuditoria({
      rol,
      tabla,
      fecha_inicio,
      fecha_fin,
      limite: limite ? parseInt(limite) : 100
    });
    
    res.json(auditoria);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`✅ Servidor corriendo en http://${HOST}:${PORT}`);
  console.log(`📅 Timezone: ${TIMEZONE}`);
  console.log(`🥤 Vasos por botella: ${VASOS_POR_BOTELLA}`);
});
