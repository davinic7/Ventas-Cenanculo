# 🍽️ Ventas Cenáculo

Aplicación web optimizada para móviles que gestiona un servicio de ventas con múltiples perfiles: Vendedor, Cocina, Despacho e Historial de Ventas.

## 🚀 Características Principales

### 👤 Perfil Vendedor
- Selección de productos por categorías (Comida, Bebidas, Postres)
- Creación de promociones personalizadas con precio especial
- Gestión de carrito de compras
- Registro de pagos (efectivo/transferencia)
- Captura de comprobantes de transferencia
- Gestión especial para empanadas (por docenas)
- Selección de bebidas por presentación (vaso/botella)

### 🍴 Perfil Cocina
- Gestión de múltiples cocinas
- CRUD completo de productos (crear, editar, eliminar)
- Control de stock y precios
- Visualización de pedidos pendientes
- Actualización de estado de pedidos (pendiente → en preparación → listo)
- Descuento manual de botellas para ventas por vaso
- Notificaciones en tiempo real

### 📦 Perfil Despacho
- Recepción de pedidos listos desde cocina
- Marcado de pedidos como entregados
- Historial de pedidos entregados
- Notificaciones en tiempo real

### 📊 Historial de Ventas
- Visualización de ventas por pedidos
- Visualización de ventas por productos
- Separación por medio de pago (efectivo/transferencia)
- Galería de comprobantes de transferencia
- Generación de reportes PDF
- Estadísticas detalladas de ventas
- Exportación de estadísticas a PDF

### 🔒 Cierre de Actividad
- Función de cierre con confirmación por palabra clave
- Reseteo completo de ventas, pedidos y stocks
- Acceso restringido con palabra clave: "MadreElvira"

## 📋 Requisitos

- Node.js 14 o superior
- npm o yarn

## 🔧 Instalación Local

1. Clonar el repositorio:
```bash
git clone <url-del-repositorio>
cd VentasCenaculo
```

2. Instalar dependencias:
```bash
npm install
```

3. Iniciar el servidor:
```bash
npm start
```

Para desarrollo con recarga automática:
```bash
npm run dev
```

4. Acceder a la aplicación:
- Abrir navegador en: `http://localhost:3000`

## 🚀 Despliegue en Render

### Opción 1: Desde GitHub (Recomendado)

1. Sube el proyecto a GitHub
2. Ve a [Render Dashboard](https://dashboard.render.com)
3. Click en "New +" → "Web Service"
4. Conecta tu repositorio de GitHub
5. Render detectará automáticamente el archivo `render.yaml`
6. El despliegue se realizará automáticamente

### Configuración en Render

- **Build Command**: `npm install` (automático desde render.yaml)
- **Start Command**: `npm start` (automático desde render.yaml)
- **Port**: Render asigna automáticamente el puerto (el código usa `process.env.PORT`)
- **Node Version**: Se detecta automáticamente desde `package.json`

## 🗄️ Base de Datos

La aplicación utiliza SQLite para almacenar:
- Cocinas y productos
- Pedidos y su estado
- Historial de ventas completo
- Stock y precios
- Promociones
- Notificaciones

**Nota**: En Render, la base de datos se crea automáticamente al iniciar la aplicación.

## 📱 Uso

1. Seleccionar perfil al iniciar (Vendedor, Cocina, Despacho o Historial Ventas)
2. Seguir el flujo de trabajo según el perfil seleccionado
3. Las notificaciones se actualizan automáticamente entre perfiles vía WebSocket

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, Express.js
- **Base de Datos**: SQLite3
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **WebSocket**: ws (para notificaciones en tiempo real)
- **PDF**: jsPDF (para generación de reportes)

## 📝 Estructura del Proyecto

```
VentasCenaculo/
├── server.js          # Servidor Express y API
├── database.js        # Configuración de SQLite
├── package.json       # Dependencias del proyecto
├── public/            # Archivos estáticos
│   ├── index.html     # HTML principal
│   ├── app.js         # Lógica del frontend
│   ├── styles.css     # Estilos CSS
│   └── images/        # Imágenes (logos)
└── README.md          # Este archivo
```

## 🔐 Seguridad

- El cierre de actividad requiere palabra clave: `MadreElvira`
- Validación de stock en frontend y backend
- Validación de datos en todas las operaciones

## 👨‍💻 Desarrollado por

**DaviNic Developer**

## 📄 Licencia

ISC

---

Para más información sobre el uso detallado, consulta `INSTRUCCIONES.md` y `VERIFICACION_PERFILES.md`

