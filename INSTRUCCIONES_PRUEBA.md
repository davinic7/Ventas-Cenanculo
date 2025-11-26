# 🚀 Instrucciones para Probar la Aplicación

## ⚠️ Requisitos Previos

### 1. Base de Datos MySQL/MariaDB

Necesitas tener MySQL o MariaDB instalado y corriendo. Si no lo tienes:

**Opción A: Instalar MySQL localmente**
- Descarga MySQL desde: https://dev.mysql.com/downloads/mysql/
- O usa XAMPP/WAMP que incluye MySQL

**Opción B: Usar una base de datos remota**
- Railway, PlanetScale, o cualquier servicio MySQL/MariaDB

### 2. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con:

```env
# Base de Datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password_mysql
DB_NAME=CenaculoDB

# Puerto
PORT=3000
HOST=0.0.0.0

# Configuración
PALABRA_CLAVE_CIERRE=GraciasSanJose
VASOS_POR_BOTELLA=4
NOMBRE_NEGOCIO=Cenáculo
MONEDA=ARS
TIMEZONE=America/Argentina/Buenos_Aires

# Supabase (Opcional - solo si quieres subir comprobantes)
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_BUCKET=comprobantes
```

### 3. Crear la Base de Datos

Ejecuta en MySQL:

```sql
CREATE DATABASE IF NOT EXISTS CenaculoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 🏃 Pasos para Iniciar

1. **Instalar dependencias** (ya hecho):
   ```bash
   npm install
   ```

2. **Configurar el archivo .env** con tus credenciales de MySQL

3. **Iniciar el servidor**:
   ```bash
   npm start
   ```

   O en modo desarrollo:
   ```bash
   npm run dev
   ```

4. **Abrir en el navegador**:
   - http://localhost:3000

## 📝 Notas Importantes

- **Sin MySQL**: El servidor no iniciará. Necesitas MySQL configurado.
- **Sin Supabase**: Los comprobantes de transferencia no se guardarán, pero el resto funciona.
- **Primera vez**: El sistema creará automáticamente todas las tablas necesarias.

## 🔍 Verificar que Funciona

1. El servidor debería mostrar:
   ```
   ✅ Servidor corriendo en http://0.0.0.0:3000
   📅 Timezone: America/Argentina/Buenos_Aires
   🥤 Vasos por botella: 4
   ✅ Base de datos inicializada correctamente
   ```

2. En el navegador deberías ver la pantalla de selección de perfiles:
   - Atención
   - Producción
   - Despacho
   - Historial Ventas

## 🐛 Solución de Problemas

**Error: "Cannot connect to MySQL"**
- Verifica que MySQL esté corriendo
- Revisa las credenciales en `.env`
- Asegúrate de que la base de datos `CenaculoDB` exista

**Error: "Access denied"**
- Verifica usuario y contraseña de MySQL
- Asegúrate de que el usuario tenga permisos en la base de datos

**Puerto 3000 ocupado**
- Cambia `PORT=3000` a otro puerto en `.env`
- O cierra la aplicación que está usando el puerto 3000

