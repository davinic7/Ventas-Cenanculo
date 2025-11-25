# Instrucciones de Uso - Ventas Cenáculo

## 🚀 Inicio Rápido

1. **Instalar dependencias:**
```bash
npm install
```

2. **Iniciar el servidor:**
```bash
npm start
```

3. **Abrir en el navegador:**
   - Abre `http://localhost:3000` en tu navegador móvil o de escritorio

## 📱 Uso por Perfil

### 🛒 Perfil Vendedor

1. Selecciona "Vendedor" en la pantalla principal
2. Ingresa el nombre del cliente
3. Selecciona productos de las diferentes cocinas disponibles
4. Ajusta las cantidades con los botones +/-
5. Selecciona el medio de pago (Efectivo o Transferencia)
6. Haz clic en "Crear Pedido"
7. El sistema automáticamente enviará el pedido a la cocina correspondiente según el producto

### 🍴 Perfil Cocina

1. Selecciona "Cocina" en la pantalla principal
2. Elige tu cocina del selector (Parrilla, Horno, etc.)
3. **Pestaña Productos:**
   - Ver todos los productos de tu cocina
   - Crear nuevos productos con precio y stock
   - Editar productos existentes
4. **Pestaña Pedidos:**
   - Ver pedidos pendientes
   - Cambiar estado: "En Preparación" → "Marcar como Listo"
   - Cuando marcas como "Listo", se notifica automáticamente a Despacho

### 📦 Perfil Despacho

1. Selecciona "Despacho" en la pantalla principal
2. Verás todos los pedidos listos para entregar
3. Cada pedido muestra:
   - Nombre del cliente
   - Cocina de origen
   - Items del pedido
4. Haz clic en "Marcar como Entregado" cuando entregues el pedido al vendedor
5. Se notificará automáticamente al vendedor

### 📊 Historial de Ventas

1. Selecciona "Historial Ventas" en la pantalla principal
2. Verás:
   - Resumen total de pedidos y ventas
   - Lista detallada de todas las ventas
   - Información de cada venta: productos, cantidades, precios, medio de pago

## 🔔 Sistema de Notificaciones

- Las notificaciones aparecen automáticamente cuando hay cambios
- El badge rojo en el header muestra el número de notificaciones pendientes
- Las notificaciones se actualizan cada 5 segundos
- WebSocket proporciona actualizaciones en tiempo real

## 💾 Base de Datos

- La base de datos SQLite se crea automáticamente al iniciar el servidor
- Se guardan: cocinas, productos, pedidos, ventas y notificaciones
- Los datos persisten entre reinicios del servidor

## 🎨 Características

- ✅ Interfaz optimizada para móviles
- ✅ Diseño responsive y moderno
- ✅ Notificaciones en tiempo real
- ✅ Gestión de stock automática
- ✅ Historial completo de ventas
- ✅ Múltiples cocinas con productos específicos
- ✅ Flujo completo: Vendedor → Cocina → Despacho

## 🔧 Configuración

- Puerto por defecto: 3000
- Puedes cambiarlo con la variable de entorno `PORT`
- Ejemplo: `PORT=8080 npm start`

## 📝 Notas

- Los productos se agrupan automáticamente por cocina
- El stock se actualiza automáticamente al crear un pedido
- Cada pedido puede contener productos de múltiples cocinas
- El sistema crea un pedido separado por cada cocina involucrada

