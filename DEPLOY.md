# 🚀 Guía de Despliegue - GitHub + Railway

Esta guía te ayudará a desplegar la aplicación Ventas Cenáculo primero en GitHub y luego en Railway.

## 📋 Requisitos Previos

1. ✅ Cuenta en [GitHub](https://github.com) - [Crear cuenta](https://github.com/signup)
2. ✅ Cuenta en [Railway](https://railway.app) - [Crear cuenta](https://railway.app/signup)
3. ✅ Git instalado localmente - [Descargar Git](https://git-scm.com/downloads)
4. ✅ Node.js instalado (para desarrollo local)

## 🔧 Pasos para Desplegar

### 📦 PASO 1: Preparar el Repositorio en GitHub

#### 1.1 Verificar el estado de Git

Primero, verifica si ya tienes Git inicializado:
```bash
git status
```

Si no está inicializado, verás un error. Si ya está inicializado, verás los archivos.

#### 1.2 Inicializar Git (si es necesario)

Si no está inicializado:
```bash
git init
```

#### 1.3 Verificar archivos a subir

Revisa qué archivos se van a subir (deberían excluirse node_modules, .db, etc.):
```bash
git status
```

#### 1.4 Agregar todos los archivos al staging

```bash
git add .
```

#### 1.5 Hacer commit inicial

```bash
git commit -m "Initial commit: Ventas Cenáculo app - Listo para despliegue"
```

#### 1.6 Crear repositorio en GitHub

1. Ve a https://github.com/new
2. **Nombre del repositorio**: `ventas-cenaculo` (o el nombre que prefieras)
3. **Descripción**: "Sistema de gestión de ventas para restaurante"
4. **Visibilidad**: Público o Privado (según prefieras)
5. ⚠️ **IMPORTANTE**: **NO** marques las opciones:
   - ❌ Add a README file
   - ❌ Add .gitignore
   - ❌ Choose a license
6. Click en **"Create repository"**

#### 1.7 Conectar repositorio local con GitHub

**Opción A: HTTPS (Recomendado para principiantes)**
```bash
git remote add origin https://github.com/TU-USUARIO/ventas-cenaculo.git
```

**Opción B: SSH (Si tienes SSH configurado)**
```bash
git remote add origin git@github.com:TU-USUARIO/ventas-cenaculo.git
```

⚠️ **Reemplaza `TU-USUARIO` con tu nombre de usuario de GitHub**

#### 1.8 Renombrar rama a main (si es necesario)

```bash
git branch -M main
```

#### 1.9 Subir código a GitHub

```bash
git push -u origin main
```

Si te pide credenciales:
- **Usuario**: Tu nombre de usuario de GitHub
- **Contraseña**: Usa un **Personal Access Token** (no tu contraseña normal)
  - Crea uno en: https://github.com/settings/tokens
  - Permisos: `repo` (acceso completo a repositorios)

#### 1.10 Verificar que se subió correctamente

Ve a tu repositorio en GitHub: `https://github.com/TU-USUARIO/ventas-cenaculo`

Deberías ver todos los archivos del proyecto.

---

### 🚂 PASO 2: Desplegar en Railway

#### 2.1 Iniciar sesión en Railway

1. Ve a https://railway.app
2. Click en **"Login"** o **"Start a New Project"**
3. Selecciona **"Login with GitHub"**
4. Autoriza Railway para acceder a tus repositorios de GitHub

#### 2.2 Crear nuevo proyecto desde GitHub

1. En el dashboard de Railway, click en **"New Project"**
2. Selecciona **"Deploy from GitHub repo"**
3. Si es la primera vez, autoriza Railway para acceder a tus repositorios
4. Busca y selecciona tu repositorio `ventas-cenaculo`
5. Railway comenzará a desplegar automáticamente

#### 2.3 Configuración automática

Railway detectará automáticamente:
- ✅ Que es un proyecto Node.js (por el `package.json`)
- ✅ El comando de build: `npm install`
- ✅ El comando de inicio: `npm start` (definido en `package.json`)
- ✅ El puerto: Usará `process.env.PORT` (ya configurado en `server.js`)

#### 2.4 Monitorear el despliegue

1. En el dashboard de Railway, verás el progreso del despliegue
2. Puedes ver los logs en tiempo real haciendo click en el servicio
3. Espera a que aparezca "✅ Deployed successfully"

#### 2.5 Obtener la URL de tu aplicación

1. En el dashboard de Railway, click en tu servicio
2. Ve a la pestaña **"Settings"**
3. En la sección **"Domains"**, verás la URL generada automáticamente
4. También puedes configurar un dominio personalizado aquí

#### 2.6 Verificar que funciona

1. Abre la URL en tu navegador
2. Deberías ver la pantalla de selección de perfiles
3. Prueba crear un pedido para verificar que todo funciona

### 🔄 PASO 3: Actualizar la Aplicación (Despliegue Continuo)

Una vez configurado, cada vez que hagas cambios:

1. **Hacer cambios en tu código local**

2. **Agregar cambios a Git**:
```bash
git add .
```

3. **Hacer commit**:
```bash
git commit -m "Descripción de los cambios realizados"
```

4. **Subir a GitHub**:
```bash
git push
```

5. **Railway desplegará automáticamente** la nueva versión
   - Puedes ver el progreso en el dashboard de Railway
   - Los logs te mostrarán si hay algún error

---

## 🛠️ Opción Alternativa: Railway CLI

Si prefieres usar la línea de comandos:

#### Instalar Railway CLI
```bash
npm i -g @railway/cli
```

#### Iniciar sesión
```bash
railway login
```

#### Inicializar proyecto
```bash
railway init
```

#### Desplegar
```bash
railway up
```

#### Obtener URL
```bash
railway domain
```

### ⚙️ PASO 4: Configurar Variables de Entorno (Opcional)

Por defecto, la aplicación funciona sin variables de entorno adicionales. Railway configura automáticamente:
- `PORT`: Puerto asignado por Railway
- `HOST`: 0.0.0.0 (ya configurado en el código)
- `NODE_ENV`: production

Si necesitas agregar variables personalizadas:

1. En Railway, ve a tu proyecto
2. Click en tu servicio
3. Ve a la pestaña **"Variables"**
4. Click en **"New Variable"**
5. Agrega las variables necesarias (consulta `env.example` para referencia)

**Variables disponibles** (no requeridas por defecto):
- `PORT`: Puerto del servidor (Railway lo asigna automáticamente)
- `HOST`: Host del servidor (por defecto: 0.0.0.0)
- `NODE_ENV`: Entorno (production/development)
- `DB_PATH`: Ruta de la base de datos (por defecto: ./ventas.db)

## 🔍 Solución de Problemas

### Error: "Cannot find module"
- Verifica que `package.json` tenga todas las dependencias
- Railway debería ejecutar `npm install` automáticamente

### Error: "Port already in use"
- Railway asigna el puerto automáticamente
- El código usa `process.env.PORT` que Railway proporciona

### La base de datos no funciona
- SQLite se crea automáticamente al iniciar
- En Railway, los archivos persisten en el sistema de archivos del contenedor
- Considera usar una base de datos externa para producción

### WebSocket no funciona
- Railway soporta WebSockets
- Si tienes problemas, verifica que el servidor esté escuchando en `0.0.0.0`

## 📝 Notas Importantes

### Base de Datos SQLite
- ✅ SQLite funciona perfectamente en Railway
- ⚠️ **IMPORTANTE**: Los datos se perderán si el contenedor se reinicia o se elimina
- 💡 **Recomendación para producción**: Considera usar PostgreSQL o MySQL para persistencia de datos
- 📦 Para desarrollo y pruebas, SQLite es suficiente

### Archivos de Configuración
- ✅ `Procfile`: Configuración para Heroku/Railway
- ✅ `railway.json`: Configuración específica de Railway
- ✅ `env.example`: Ejemplo de variables de entorno

### Características del Despliegue
- ✅ **Despliegue automático**: Cada push a GitHub despliega automáticamente
- ✅ **WebSockets**: Funcionan correctamente en Railway
- ✅ **Logs en tiempo real**: Disponibles en Railway Dashboard
- ✅ **Puerto dinámico**: El código usa `process.env.PORT` automáticamente

### Costos
- 💰 Railway ofrece un plan gratuito generoso
- 📊 Monitorea el uso en el dashboard
- 🔄 Los servicios gratuitos pueden "dormir" después de inactividad

## 📊 Verificar el Estado del Despliegue

### En Railway Dashboard:
- **Logs**: Ve los logs en tiempo real del servidor
- **Metrics**: Monitorea CPU, memoria y tráfico
- **Deployments**: Historial de despliegues
- **Settings**: Configuración del servicio

### Verificar que funciona:
1. ✅ Abre la URL de Railway en tu navegador
2. ✅ Deberías ver la pantalla de selección de perfiles
3. ✅ Prueba crear un pedido desde el perfil Vendedor
4. ✅ Verifica que las notificaciones funcionan entre perfiles

## 📞 Soporte

Si tienes problemas, revisa:
- Los logs en Railway Dashboard
- La consola del navegador
- El README.md del proyecto

---

**Desarrollado por DaviNic Developer**

