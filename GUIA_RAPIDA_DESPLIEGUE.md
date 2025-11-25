# ⚡ Guía Rápida de Despliegue

## 🚀 Despliegue en 5 minutos

### 1️⃣ Subir a GitHub

```bash
# Si no tienes Git inicializado
git init
git add .
git commit -m "Initial commit: Ventas Cenáculo"

# Crear repositorio en GitHub (ve a github.com/new)
# Luego conectar:
git remote add origin https://github.com/TU-USUARIO/ventas-cenaculo.git
git branch -M main
git push -u origin main
```

### 2️⃣ Desplegar en Railway

1. Ve a https://railway.app
2. Login con GitHub
3. Click en "New Project" → "Deploy from GitHub repo"
4. Selecciona tu repositorio
5. ¡Listo! Railway desplegará automáticamente

### 3️⃣ Obtener URL

- En Railway Dashboard → Settings → Domains
- Copia la URL y ábrela en tu navegador

## ✅ Verificación

- [ ] Código subido a GitHub
- [ ] Proyecto creado en Railway
- [ ] Despliegue exitoso (ver logs)
- [ ] URL funciona en el navegador
- [ ] Puedes crear pedidos

## 🔄 Actualizar después de cambios

```bash
git add .
git commit -m "Descripción de cambios"
git push
# Railway desplegará automáticamente
```

## 🆘 Problemas Comunes

**Error al hacer push a GitHub:**
- Verifica tus credenciales
- Usa Personal Access Token en lugar de contraseña

**Railway no detecta el proyecto:**
- Verifica que `package.json` esté en la raíz
- Verifica que `server.js` exista

**La app no carga:**
- Revisa los logs en Railway Dashboard
- Verifica que el puerto sea correcto (Railway lo asigna automáticamente)

---

Para más detalles, consulta `DEPLOY.md`

