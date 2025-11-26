# 🔄 Guía de Migración - Ventas Cenáculo

## Cambios Principales

### 1. Base de Datos
- **Antes**: SQLite (archivo local)
- **Ahora**: MySQL/MariaDB remota (CenaculoDB)

### 2. Estructura de Roles
- **Antes**: Vendedor, Cocina, Despacho
- **Ahora**: 
  - **Atención**: Toma pedidos y cobra
  - **Producción**: 
    - Cocina
    - Parrilla
    - Horno
    - Bebidas
    - Postres
  - **Despacho**: Entrega pedidos

### 3. Eslabones de Producción
- Cada eslabón tiene su propio CRUD de productos
- Los productos están asociados a un eslabón específico
- Cada eslabón ve solo sus pedidos

### 4. Almacenamiento de Imágenes
- **Antes**: Base64 en base de datos
- **Ahora**: Supabase Storage (URLs)

### 5. Nuevas Funcionalidades
- Sistema de cierre de día con PDF
- Auditoría completa de acciones
- Exportación de reportes en PDF
- Alertas de stock bajo (1 botella restante)

## Pasos de Migración

### 1. Configurar Variables de Entorno

Copia `env.example` a `.env` y configura:

```env
# Base de Datos MySQL
DB_HOST=tu-host-mysql
DB_USER=tu-usuario
DB_PASSWORD=tu-password
DB_NAME=CenaculoDB

# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-key
SUPABASE_BUCKET=comprobantes

# Configuración
PALABRA_CLAVE_CIERRE=GraciasSanJose
VASOS_POR_BOTELLA=4
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Crear Base de Datos

La base de datos se crea automáticamente al iniciar el servidor. Asegúrate de que:
- MySQL/MariaDB esté corriendo
- Tengas permisos para crear tablas
- La base de datos `CenaculoDB` exista (o se creará automáticamente)

### 4. Configurar Supabase

1. Crea un proyecto en Supabase
2. Crea un bucket llamado `comprobantes`
3. Configura políticas de acceso (público para lectura, autenticado para escritura)
4. Copia la URL y la key anónima a `.env`

### 5. Iniciar Servidor

```bash
npm start
```

El servidor creará automáticamente todas las tablas necesarias.

## Cambios en el Frontend

El frontend necesita actualizarse para:
- Usar nuevos roles (atencion, cocina, parrilla, horno, bebidas, postres, despacho)
- Llamar a endpoints de eslabones en lugar de cocinas
- Manejar la nueva estructura de pedidos
- Mostrar alertas de stock bajo

## Notas Importantes

- Los productos antiguos necesitan ser recreados con la nueva estructura
- Los pedidos antiguos no son compatibles con la nueva estructura
- Se recomienda hacer un backup antes de migrar

