# 📦 Sistema de Categorización de Productos

## 🔄 ¿Por qué se borraron los productos al desplegar en Render?

**Respuesta corta:** En Render (plan gratuito), la base de datos SQLite se almacena en el sistema de archivos efímero. Cada vez que el servicio se reinicia o se despliega, se crea una nueva base de datos desde cero.

**Solución:** Esto es normal y esperado. Los productos deben crearse nuevamente usando el nuevo sistema de categorías.

---

## ✨ Nuevas Funcionalidades

### 1. **Categorías de Productos**

Ahora todos los productos deben tener una categoría:
- **Comida**: Productos de comida (hamburguesas, empanadas, etc.)
- **Bebida**: Bebidas (gaseosas, aguas, etc.)
- **Postre**: Postres y dulces

### 2. **Tipo de Venta (Solo para Comida)**

Para productos de comida, puedes elegir cómo se venden:
- **Unidades**: Se vende por unidades individuales (ej: 1 hamburguesa, 2 hamburguesas)
- **Docenas**: Se vende por docenas (ej: 1 docena = 12 unidades, 0.5 docenas = 6 unidades)

**Ejemplo:** Las empanadas se pueden vender por docenas, mientras que las hamburguesas por unidades.

### 3. **Sistema de Bebidas con Variantes**

#### Bebidas Base (Botellas)
- Son las botellas que tienen stock
- Se crean como categoría "Bebida"
- Tienen stock en botellas
- **NO** tienen `producto_base_id` (son la base)

#### Bebidas por Vasos
- Son variantes que se venden por vasos
- Se crean como categoría "Bebida"
- **SÍ** tienen `producto_base_id` (referencia a la botella base)
- Stock = 0 (no tienen stock propio)
- El stock se descuenta de la botella base cuando cocina lo decide

#### Variantes de Bebidas
Al crear una bebida, puedes agregar variantes separadas por comas:
- **Ejemplo 1 (Sabores):** `Coca, Fanta, Sprite`
- **Ejemplo 2 (Versiones):** `Con gas, Sin gas`
- **Ejemplo 3 (Tamaños):** `500ml, 1L, 2L`

Las variantes se almacenan como JSON y pueden usarse para filtrar o mostrar opciones al vendedor.

---

## 📝 Cómo Crear Productos

### Crear una Comida (por Unidades)
1. Categoría: **Comida**
2. Tipo de Venta: **Unidades**
3. Nombre: "Hamburguesa Clásica"
4. Precio: 5000
5. Stock: 50 (unidades)

### Crear una Comida (por Docenas)
1. Categoría: **Comida**
2. Tipo de Venta: **Docenas**
3. Nombre: "Empanadas"
4. Precio: 12000 (precio por docena)
5. Stock: 10 (docenas = 120 unidades internamente)

### Crear una Bebida Base (Botella)
1. Categoría: **Bebida**
2. Producto Base: **Dejar vacío** (es la base)
3. Variantes: "Coca, Fanta, Sprite" (opcional)
4. Nombre: "Gaseosa 2L"
5. Precio: 3000
6. Stock: 20 (botellas)

### Crear una Bebida por Vasos
1. Categoría: **Bebida**
2. Producto Base: **Seleccionar la botella base** (ej: "Gaseosa 2L")
3. Variantes: "Coca, Fanta, Sprite" (opcional, puede ser diferente a la base)
4. Nombre: "Gaseosa - Vaso"
5. Precio: 800 (precio por vaso)
6. Stock: **0** (no tiene stock, usa el de la botella base)

### Crear un Postre
1. Categoría: **Postre**
2. Nombre: "Torta de Chocolate"
3. Precio: 8000
4. Stock: 5 (unidades)

---

## 🔄 Flujo de Trabajo

### Para Vendedor
- Ve todos los productos organizados por categoría
- Al seleccionar comida por docenas, puede pedir 0.5, 1, 1.5 docenas, etc.
- Al seleccionar bebida por vasos, puede pedir vasos individuales

### Para Cocina
- Ve los pedidos normalmente
- Para bebidas por vasos: cuando recibe un pedido, decide si descontar una botella del stock base
- Puede usar el botón "Descontar Botella" para descontar manualmente

### Sistema de Stock
- **Comida (unidades)**: Se descuenta automáticamente al crear pedido
- **Comida (docenas)**: Se convierte a unidades y se descuenta automáticamente
- **Bebida (botella)**: Se descuenta automáticamente al crear pedido
- **Bebida (vaso)**: NO se descuenta automáticamente. Cocina decide cuándo descontar la botella base
- **Postre**: Se descuenta automáticamente al crear pedido

---

## ⚠️ Notas Importantes

1. **Al desplegar en Render**: Los productos se borran porque la base de datos es efímera. Esto es normal.

2. **Productos antiguos**: Los productos creados antes de esta actualización tendrán:
   - Categoría: `comida` (por defecto)
   - Tipo de venta: `unidades` (por defecto)
   - Puedes editarlos para actualizar su categoría

3. **Bebidas por vasos**: Siempre deben tener un `producto_base_id` que apunte a una botella base. Si no existe la botella base, créala primero.

4. **Variantes**: Son opcionales pero recomendadas para bebidas. Ayudan a organizar y filtrar productos.

---

## 🚀 Próximos Pasos

1. Crear las botellas base primero (ej: "Coca Cola 2L", "Agua 500ml")
2. Luego crear las variantes por vasos (ej: "Coca Cola - Vaso")
3. Asignar el producto base a cada variante de vaso
4. Configurar el stock inicial de las botellas base

---

**Desarrollado por DaviNic Developer**

