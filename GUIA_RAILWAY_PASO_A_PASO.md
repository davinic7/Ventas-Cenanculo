# 🚂 Guía Detallada: Despliegue en Railway - Paso a Paso

Esta guía te ayudará a desplegar tu aplicación en Railway sin errores.

## 📋 ANTES DE EMPEZAR - Verificaciones

### ✅ Verificar que el código esté en GitHub

1. Ve a: https://github.com/davinic7/Ventas-Cenanculo
2. Verifica que veas todos los archivos:
   - ✅ `package.json`
   - ✅ `server.js`
   - ✅ `railway.json`
   - ✅ `Procfile`
   - ✅ Carpeta `public/`

Si falta algo, vuelve a hacer push:
```bash
git add .
git commit -m "Asegurar todos los archivos"
git push
```

---

## 🚀 PASO 1: Crear Cuenta en Railway

1. Ve a: **https://railway.app**
2. Click en **"Start a New Project"** o **"Login"**
3. Selecciona **"Login with GitHub"**
4. Autoriza Railway para acceder a tus repositorios
   - ✅ Marca "All repositories" o solo selecciona "Ventas-Cenanculo"
5. Click en **"Authorize railway"**

---

## 📦 PASO 2: Crear Nuevo Proyecto

### Opción A: Desde el Dashboard Principal

1. En el dashboard de Railway, click en **"New Project"** (botón verde)
2. Selecciona **"Deploy from GitHub repo"**
3. Si es la primera vez, verás una pantalla de autorización
   - Click en **"Configure GitHub App"**
   - Selecciona los repositorios que quieres conectar
   - Click en **"Install"**
4. En la lista de repositorios, busca y selecciona: **"Ventas-Cenanculo"**
5. Railway comenzará automáticamente a desplegar

### Opción B: Si no aparece el repositorio

1. Ve a: https://railway.app/new
2. Click en **"Deploy from GitHub repo"**
3. Si no ves tu repositorio:
   - Ve a: https://github.com/settings/installations
   - Busca "Railway" en las aplicaciones instaladas
   - Click en "Configure"
   - Asegúrate de que "Ventas-Cenanculo" esté seleccionado
   - Vuelve a Railway y refresca la página

---

## ⏳ PASO 3: Monitorear el Despliegue

### Ver el Progreso

1. Después de seleccionar el repositorio, verás una pantalla de "Deploying"
2. Click en el servicio que se creó (normalmente se llama "Ventas-Cenanculo" o similar)
3. Ve a la pestaña **"Deployments"** o **"Logs"**

### Qué Buscar en los Logs

**✅ Logs Exitosos:**
```
> ventas-cenaculo@1.0.0 start
> node server.js

Servidor corriendo en http://0.0.0.0:XXXX
🚂 Desplegado en Railway
```

**❌ Errores Comunes:**

1. **"Cannot find module"**
   - **Solución**: Railway debería instalar dependencias automáticamente
   - Si persiste, verifica que `package.json` tenga todas las dependencias

2. **"Port already in use"**
   - **Solución**: El código ya usa `process.env.PORT`, esto no debería pasar
   - Verifica que Railway esté asignando el puerto correctamente

3. **"sqlite3 build failed"**
   - **Solución**: Railway debería compilar sqlite3 automáticamente
   - Si falla, puede ser un problema temporal, intenta redespelgar

4. **"Build timeout"**
   - **Solución**: El build puede tardar, espera unos minutos
   - Si persiste, verifica que no haya dependencias problemáticas

---

## 🔧 PASO 4: Configurar el Servicio (Si es Necesario)

### Verificar Configuración Automática

Railway debería detectar automáticamente:
- ✅ **Build Command**: `npm install` (desde railway.json)
- ✅ **Start Command**: `npm start` (desde railway.json)
- ✅ **Puerto**: Asignado automáticamente

### Si Necesitas Configurar Manualmente

1. Click en tu servicio
2. Ve a **"Settings"**
3. En **"Build & Deploy"**:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Guarda los cambios

---

## 🌐 PASO 5: Obtener la URL

### Obtener URL Automática

1. En el dashboard de Railway, click en tu servicio
2. Ve a la pestaña **"Settings"**
3. Scroll hasta **"Domains"**
4. Verás una URL como: `ventas-cenanculo-production.up.railway.app`
5. Click en la URL o cópiala

### Configurar Dominio Personalizado (Opcional)

1. En la misma sección **"Domains"**
2. Click en **"Generate Domain"** si no hay uno
3. O agrega un dominio personalizado con **"Custom Domain"**

---

## ✅ PASO 6: Verificar que Funciona

1. **Abre la URL en tu navegador**
   - Deberías ver la pantalla de selección de perfiles

2. **Prueba la funcionalidad básica:**
   - Selecciona el perfil "Vendedor"
   - Verifica que carguen las cocinas
   - Intenta crear un pedido de prueba

3. **Revisa los logs en Railway:**
   - Ve a **"Logs"** en el dashboard
   - Deberías ver las peticiones HTTP cuando uses la app

---

## 🐛 SOLUCIÓN DE PROBLEMAS DETALLADA

### Problema 1: El despliegue falla inmediatamente

**Síntomas:**
- El build falla en menos de 1 minuto
- Error: "Build failed"

**Soluciones:**
1. Revisa los logs completos en Railway
2. Verifica que `package.json` esté en la raíz del proyecto
3. Verifica que `server.js` exista
4. Asegúrate de que no haya errores de sintaxis en el código

**Comando para verificar localmente:**
```bash
npm install
npm start
```

### Problema 2: El servicio se despliega pero no responde

**Síntomas:**
- El build es exitoso
- Pero la URL muestra error o no carga

**Soluciones:**
1. **Verifica los logs:**
   - Ve a "Logs" en Railway
   - Busca errores después de "Servidor corriendo"

2. **Verifica el puerto:**
   - El código debe usar `process.env.PORT`
   - Ya está configurado en `server.js` línea 820

3. **Verifica que el servidor esté escuchando:**
   - Los logs deben mostrar: "Servidor corriendo en http://0.0.0.0:XXXX"

### Problema 3: La base de datos no funciona

**Síntomas:**
- La app carga pero no se guardan datos
- Errores relacionados con SQLite

**Soluciones:**
1. **SQLite funciona en Railway**, pero los datos pueden perderse si el servicio se reinicia
2. **Verifica los permisos:**
   - Railway debería tener permisos de escritura automáticamente
3. **Revisa los logs:**
   - Busca errores relacionados con la base de datos

### Problema 4: WebSockets no funcionan

**Síntomas:**
- Las notificaciones no aparecen en tiempo real
- Errores en la consola del navegador sobre WebSocket

**Soluciones:**
1. **Railway soporta WebSockets**, pero verifica:
   - Que el servidor esté escuchando en `0.0.0.0` (ya configurado)
   - Que uses la URL de Railway (no localhost)

### Problema 5: El servicio se "duerme" después de inactividad

**Síntomas:**
- La app funciona pero después de un tiempo deja de responder
- La primera petición tarda mucho

**Explicación:**
- En el plan gratuito, Railway puede poner servicios en "sleep" después de inactividad
- La primera petición después del sleep puede tardar unos segundos

**Soluciones:**
1. **Es normal en el plan gratuito**
2. **Considera actualizar a un plan de pago** si necesitas que esté siempre activo
3. **O usa un servicio de "ping"** para mantenerlo activo

---

## 🔄 ACTUALIZAR DESPUÉS DE CAMBIOS

### Proceso de Actualización

1. **Haz cambios en tu código local**

2. **Agrega y commitea:**
```bash
git add .
git commit -m "Descripción de los cambios"
```

3. **Sube a GitHub:**
```bash
git push
```

4. **Railway detectará automáticamente** el cambio y desplegará la nueva versión
   - Verás un nuevo deployment en el dashboard
   - Los logs mostrarán el progreso

5. **Espera a que termine el despliegue**
   - Normalmente toma 1-3 minutos

---

## 📊 MONITOREO Y LOGS

### Ver Logs en Tiempo Real

1. En Railway Dashboard → Tu Servicio → **"Logs"**
2. Verás todos los logs del servidor
3. Útil para debuggear problemas

### Métricas

1. En Railway Dashboard → Tu Servicio → **"Metrics"**
2. Verás:
   - CPU usage
   - Memory usage
   - Network traffic

---

## 💰 COSTOS Y LÍMITES

### Plan Gratuito de Railway

- ✅ $5 de crédito gratis al mes
- ✅ Despliegue ilimitado
- ✅ 500 horas de uso al mes
- ⚠️ Los servicios pueden "dormir" después de inactividad

### Monitorear Uso

1. Ve a: https://railway.app/account/usage
2. Verás tu uso actual y créditos restantes

---

## 🆘 SI NADA FUNCIONA

### Opción 1: Contactar Soporte de Railway

1. Ve a: https://railway.app/help
2. O envía un email a: support@railway.app

### Opción 2: Verificar Todo Localmente

```bash
# Instalar dependencias
npm install

# Verificar que no haya errores
npm start

# Si funciona localmente, el problema es de configuración en Railway
```

### Opción 3: Revisar Documentación

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

---

## ✅ CHECKLIST FINAL

Antes de considerar que está todo listo:

- [ ] Código subido a GitHub
- [ ] Proyecto creado en Railway
- [ ] Servicio desplegado exitosamente (ver logs)
- [ ] URL obtenida y funcionando
- [ ] Puedo acceder a la aplicación en el navegador
- [ ] Puedo crear un pedido de prueba
- [ ] Las notificaciones funcionan (WebSocket)
- [ ] Los logs no muestran errores

---

**¿Todavía tienes problemas?** 

Comparte:
1. Los logs completos de Railway
2. El error específico que ves
3. Qué pasos ya intentaste

¡Buena suerte con tu despliegue! 🚀

