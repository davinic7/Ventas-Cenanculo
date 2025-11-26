// Estado global
let estado = {
    perfilActual: null,
    eslabonActual: null,
    eslabonTipo: null,
    productos: [],
    pedidoActual: {},
    ws: null
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    inicializarWebSocket();
    cargarCocinas();
    setInterval(actualizarNotificaciones, 5000);
});

// WebSocket para notificaciones en tiempo real
function inicializarWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    const wsUrl = `${protocol}//${host}:${port}`;
    
    try {
        estado.ws = new WebSocket(wsUrl);
        
        estado.ws.onopen = () => {
            console.log('WebSocket conectado');
        };
        
        estado.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                manejarNotificacion(data);
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
            }
        };
        
        estado.ws.onerror = (error) => {
            console.error('Error WebSocket:', error);
            // Reintentar conexión después de 5 segundos
            setTimeout(inicializarWebSocket, 5000);
        };
        
        estado.ws.onclose = () => {
            console.log('WebSocket desconectado, reintentando...');
            setTimeout(inicializarWebSocket, 3000);
        };
    } catch (error) {
        console.error('Error inicializando WebSocket:', error);
        // Reintentar después de 5 segundos
        setTimeout(inicializarWebSocket, 5000);
    }
}

function registrarWebSocket(perfil) {
    if (estado.ws && estado.ws.readyState === WebSocket.OPEN) {
        estado.ws.send(JSON.stringify({ type: 'register', perfil }));
    }
}

function manejarNotificacion(data) {
    // Manejar cierre de actividad primero (afecta a todos los perfiles)
    if (data.type === 'cierre_actividad') {
        console.log('Cierre de actividad recibido, limpiando estado...');
        
        // Cerrar el modal si está abierto
        cerrarModalCierreActividad();
        
        // Limpiar estado global
        estado.perfilActual = null;
        estado.cocinaActual = null;
        estado.productos = [];
        estado.pedidoActual = {};
        
        // Limpiar estado del vendedor
        if (typeof estadoVendedor !== 'undefined') {
            estadoVendedor = {
                rubroActual: null,
                carrito: {},
                medioPago: null,
                fotoComprobante: null,
                nombreCliente: null,
                stream: null,
                filtrosBebidas: {
                    presentacion: null,
                    tipo: null,
                    sabor: null
                },
                promosPersonalizadas: {}
            };
        }
        
        // Cerrar todas las pantallas
        const screens = document.querySelectorAll('.screen');
        if (screens && screens.length > 0) {
            screens.forEach(s => {
                if (s) {
                    s.classList.remove('active');
                }
            });
        }
        
        // Mostrar selector de perfil
        const perfilSelector = document.getElementById('perfil-selector');
        if (perfilSelector) {
            perfilSelector.classList.add('active');
        }
        
        // Mostrar mensaje y recargar después de un momento
        mostrarMensaje('✅ Sistema reiniciado. Todos los datos han sido limpiados.', 'success');
        
        // Recargar la página para reflejar los cambios
        setTimeout(() => {
            window.location.reload(true);
        }, 2000);
        
        return; // No procesar otras notificaciones
    }
    
    actualizarNotificaciones();
    
    if (data.type === 'nuevo_pedido' && estado.perfilActual === 'produccion') {
        if (estado.eslabonActual) {
            cargarPedidosEslabon(estado.eslabonActual);
        }
    } else if (data.type === 'pedido_listo' && estado.perfilActual === 'despacho') {
        cargarPedidosDespacho();
    } else if (data.type === 'pedido_entregado' && estado.perfilActual === 'atencion') {
        // Notificación visual
        mostrarMensaje('Pedido entregado', 'success');
    } else if (data.type === 'alerta_stock') {
        mostrarMensaje(data.mensaje || '⚠️ Alerta de stock bajo', 'warning');
    } else if (data.type === 'cierre_dia') {
        mostrarMensaje('📅 Cierre de día realizado', 'success');
    }
}

// Navegación
function seleccionarPerfil(perfil) {
    try {
        console.log('Seleccionando perfil:', perfil);
        estado.perfilActual = perfil;
        
        // Obtener todas las pantallas
        const todasLasPantallas = document.querySelectorAll('.screen');
        console.log('Pantallas encontradas:', todasLasPantallas.length);
        
        // Remover active de todas las pantallas
        todasLasPantallas.forEach(s => {
            s.classList.remove('active');
            console.log('Removido active de:', s.id || s.className);
        });
        
        // Obtener la pantalla objetivo
        let pantallaObjetivo = null;
        switch(perfil) {
            case 'atencion':
                pantallaObjetivo = document.getElementById('atencion-screen');
                // Resetear estado del vendedor
                estadoVendedor = {
                    rubroActual: null,
                    carrito: {},
                    medioPago: null,
                    fotoComprobante: null,
                    nombreCliente: null,
                    stream: null,
                    filtrosBebidas: {
                        presentacion: null,
                        tipo: null,
                        sabor: null
                    },
                    promosPersonalizadas: {}
                };
                const rubrosView = document.getElementById('vendedor-rubros-view');
                const productosView = document.getElementById('vendedor-productos-view');
                const carritoView = document.getElementById('vendedor-carrito-view');
                const pagoView = document.getElementById('vendedor-pago-view');
                
                if (rubrosView) rubrosView.style.display = 'block';
                if (productosView) productosView.style.display = 'none';
                if (carritoView) carritoView.style.display = 'none';
                if (pagoView) pagoView.style.display = 'none';
                
                actualizarBotonCarrito();
                break;
            case 'produccion':
                pantallaObjetivo = document.getElementById('produccion-screen');
                // Resetear selección de eslabón al entrar
                estado.eslabonActual = null;
                const produccionContent = document.getElementById('produccion-content');
                const produccionSeleccion = document.getElementById('produccion-seleccion');
                if (produccionContent) produccionContent.style.display = 'none';
                if (produccionSeleccion) produccionSeleccion.style.display = 'block';
                break;
            case 'despacho':
                pantallaObjetivo = document.getElementById('despacho-screen');
                break;
            case 'ventas':
                pantallaObjetivo = document.getElementById('ventas-screen');
                break;
            default:
                console.error('Perfil no reconocido:', perfil);
                return;
        }
        
        if (!pantallaObjetivo) {
            console.error('No se encontró la pantalla para:', perfil);
            alert('Error: No se encontró la pantalla para ' + perfil);
            return;
        }
        
        console.log('Pantalla objetivo encontrada:', pantallaObjetivo.id);
        pantallaObjetivo.classList.add('active');
        console.log('Clase active agregada. Pantalla visible:', pantallaObjetivo.classList.contains('active'));
        
        // Verificar que el selector de perfil esté oculto
        const selector = document.getElementById('perfil-selector');
        if (selector) {
            selector.classList.remove('active');
            console.log('Selector de perfil ocultado');
        }
        
        // Ejecutar funciones específicas del perfil
        switch(perfil) {
            case 'atencion':
                // No cargar productos aquí, se cargan al seleccionar rubro
                registrarWebSocket('atencion');
                break;
            case 'produccion':
                cargarEslabones();
                registrarWebSocket('produccion');
                break;
            case 'despacho':
                cargarPedidosDespacho();
                registrarWebSocket('despacho');
                break;
            case 'ventas':
                cargarHistorialVentas();
                break;
        }
        
        actualizarNotificaciones();
    } catch (error) {
        console.error('Error en seleccionarPerfil:', error);
        console.error('Stack trace:', error.stack);
        alert('Error al cambiar de perfil: ' + error.message);
    }
}

// Asegurar que la función esté disponible globalmente
window.seleccionarPerfil = seleccionarPerfil;

// Función para volver atrás dentro del perfil actual
function volverAtras() {
    const perfil = estado.perfilActual;
    if (!perfil) return;
    
    switch(perfil) {
        case 'vendedor':
            // Si está en productos, carrito o pago, volver a rubros
            const productosView = document.getElementById('vendedor-productos-view');
            const carritoView = document.getElementById('vendedor-carrito-view');
            const pagoView = document.getElementById('vendedor-pago-view');
            const rubrosView = document.getElementById('vendedor-rubros-view');
            
            if (pagoView && pagoView.style.display !== 'none') {
                volverCarrito();
            } else if (carritoView && carritoView.style.display !== 'none') {
                volverRubros();
            } else if (productosView && productosView.style.display !== 'none') {
                volverRubros();
            }
            // Si ya está en rubros, no hacer nada
            break;
            
        case 'cocina':
            // Si está en gestión de productos, volver a pedidos
            const gestionView = document.getElementById('cocina-productos-view');
            const pedidosView = document.getElementById('cocina-pedidos-view');
            
            if (gestionView && gestionView.style.display !== 'none') {
                ocultarGestionProductos();
            }
            // Si ya está en pedidos, no hacer nada
            break;
            
        case 'despacho':
            // Si está en historial, volver a pedidos listos
            const historialView = document.getElementById('despacho-historial-view');
            const pedidosDespachoView = document.getElementById('despacho-pedidos-view');
            
            if (historialView && historialView.style.display !== 'none') {
                ocultarHistorialDespacho();
            }
            // Si ya está en pedidos, no hacer nada
            break;
            
        case 'ventas':
            // En ventas no hay navegación interna, no hacer nada
            break;
    }
}

// Función para cerrar sesión y volver al selector de perfiles
function cerrarSesion() {
    estado.perfilActual = null;
    estado.cocinaActual = null;
    
    // Resetear estado del vendedor
    estadoVendedor = {
        rubroActual: null,
        carrito: {},
        medioPago: null,
        fotoComprobante: null,
        nombreCliente: null,
        stream: null,
        filtrosBebidas: {
            presentacion: null,
            tipo: null,
            sabor: null
        },
        promosPersonalizadas: {}
    };
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const selector = document.getElementById('perfil-selector');
    if (selector) {
        selector.classList.add('active');
    }
    
    // Cerrar conexión WebSocket si existe
    if (estado.ws && estado.ws.readyState === WebSocket.OPEN) {
        estado.ws.close();
    }
    
    mostrarMensaje('Sesión cerrada', 'success');
}

// ========== CIERRE DE ACTIVIDAD ==========
// Función para abrir el modal de cierre de actividad
function abrirModalCierreActividad() {
    const modal = document.getElementById('modal-cierre-actividad');
    const input = document.getElementById('palabra-clave-cierre');
    
    if (!modal) {
        console.error('Modal de cierre de actividad no encontrado');
        mostrarMensaje('Error: Modal no encontrado', 'error');
        return;
    }
    
    // Limpiar el input
    if (input) {
        input.value = '';
        // Agregar event listener para Enter
        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmarCierreActividad();
            }
        };
    }
    
    // Mostrar el modal
    modal.classList.add('active');
    
    // Enfocar el input después de un pequeño delay
    setTimeout(() => {
        if (input) {
            input.focus();
        }
    }, 100);
}

// Función para cerrar el modal de cierre de actividad
function cerrarModalCierreActividad() {
    const modal = document.getElementById('modal-cierre-actividad');
    const input = document.getElementById('palabra-clave-cierre');
    
    if (modal) {
        modal.classList.remove('active');
    }
    
    if (input) {
        input.value = '';
    }
}

// Variable para almacenar la palabra clave validada
let palabraClaveValidada = null;

// Función para validar la palabra clave y mostrar modal de confirmación
function validarPalabraClave() {
    const input = document.getElementById('palabra-clave-cierre');
    
    if (!input) {
        mostrarMensaje('Error: Campo de palabra clave no encontrado', 'error');
        return;
    }
    
    const palabraClave = input.value.trim();
    const palabraCorrecta = 'MadreElvira';
    
    if (!palabraClave) {
        mostrarMensaje('Por favor ingresa la palabra clave', 'error');
        input.focus();
        return;
    }
    
    if (palabraClave !== palabraCorrecta) {
        mostrarMensaje('Palabra clave incorrecta', 'error');
        input.value = '';
        input.focus();
        return;
    }
    
    // Guardar la palabra clave validada
    palabraClaveValidada = palabraClave;
    
    // Cerrar el modal de palabra clave y abrir el modal de confirmación final
    cerrarModalCierreActividad();
    abrirModalConfirmacionFinal();
}

// Función para abrir el modal de confirmación final
function abrirModalConfirmacionFinal() {
    const modal = document.getElementById('modal-confirmacion-final');
    if (modal) {
        modal.classList.add('active');
    }
}

// Función para cerrar el modal de confirmación final
function cerrarModalConfirmacionFinal() {
    const modal = document.getElementById('modal-confirmacion-final');
    if (modal) {
        modal.classList.remove('active');
    }
    // Si el usuario cancela manualmente (no desde procesarCierreActividad), 
    // volver al modal de palabra clave y limpiar
    // La palabra clave solo se limpia aquí si es cancelación manual
    if (palabraClaveValidada) {
        // El usuario canceló, volver al modal de palabra clave después de un momento
        setTimeout(() => {
            abrirModalCierreActividad();
            palabraClaveValidada = null;
        }, 300);
    }
}

// Función para procesar el cierre de actividad (llamada desde el modal de confirmación final)
async function procesarCierreActividad() {
    try {
        if (!palabraClaveValidada) {
            mostrarMensaje('Error: Palabra clave no validada', 'error');
            cerrarModalConfirmacionFinal();
            return;
        }
        
        // Guardar la palabra clave antes de cerrar el modal
        const palabraClaveParaEnviar = palabraClaveValidada;
        
        // Cerrar el modal de confirmación (sin limpiar la palabra clave todavía)
        const modal = document.getElementById('modal-confirmacion-final');
        if (modal) {
            modal.classList.remove('active');
        }
        
        // Mostrar indicador de carga
        mostrarMensaje('Procesando cierre de actividad...', 'success');
        
        // Enviar solicitud al servidor con la palabra clave guardada
        const response = await fetch('/api/reset', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-rol': 'sistema'
            },
            body: JSON.stringify({ palabra_clave: palabraClaveParaEnviar })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Mostrar mensaje de éxito
            mostrarMensaje('✅ Cierre de actividad realizado exitosamente!\n\nSistema reiniciado a cero. Recargando...', 'success');
            
            // Limpiar estado
            estado.perfilActual = null;
            estado.eslabonActual = null;
            
            // Limpiar estado del vendedor si existe
            if (typeof estadoVendedor !== 'undefined') {
                estadoVendedor = {
                    rubroActual: null,
                    carrito: {},
                    medioPago: null,
                    fotoComprobante: null,
                    nombreCliente: null,
                    stream: null,
                    filtrosBebidas: {
                        presentacion: null,
                        tipo: null,
                        sabor: null
                    },
                    promosPersonalizadas: {}
                };
            }
            
            // Ocultar todas las pantallas y mostrar el selector de perfil
            try {
                const screens = document.querySelectorAll('.screen');
                if (screens && screens.length > 0) {
                    Array.from(screens).forEach(s => {
                        if (s && s.classList) {
                            s.classList.remove('active');
                        }
                    });
                }
            } catch (screenError) {
                console.warn('Error al ocultar pantallas:', screenError);
            }
            
            const perfilSelector = document.getElementById('perfil-selector');
            if (perfilSelector) {
                perfilSelector.classList.add('active');
            }
            
            // Limpiar palabra clave
            palabraClaveValidada = null;
            
            // Recargar la página después de 2 segundos
            setTimeout(() => {
                window.location.reload(true);
            }, 2000);
        } else {
            let errorMessage = 'Error al cerrar la actividad';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (jsonError) {
                console.error('Error al parsear respuesta de error:', jsonError);
                errorMessage = `Error del servidor (${response.status}): ${response.statusText}`;
            }
            
            // Limpiar palabra clave en caso de error
            palabraClaveValidada = null;
            
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('Error en procesarCierreActividad:', error);
        mostrarMensaje(error.message || 'Error al cerrar la actividad. Por favor intenta nuevamente.', 'error');
        
        // Limpiar palabra clave en caso de error
        palabraClaveValidada = null;
        
        // Volver a abrir el modal de cierre de actividad para que el usuario pueda intentar de nuevo
        setTimeout(() => {
            abrirModalCierreActividad();
        }, 1500);
    }
}

// Exportar funciones globalmente
window.abrirModalCierreActividad = abrirModalCierreActividad;
window.cerrarModalCierreActividad = cerrarModalCierreActividad;
window.validarPalabraClave = validarPalabraClave;
window.abrirModalConfirmacionFinal = abrirModalConfirmacionFinal;
window.cerrarModalConfirmacionFinal = cerrarModalConfirmacionFinal;
window.procesarCierreActividad = procesarCierreActividad;

// Asegurar que las funciones estén disponibles globalmente
window.volverAtras = volverAtras;
window.cerrarSesion = cerrarSesion;

// ========== VENDEDOR ==========
let estadoVendedor = {
    rubroActual: null,
    carrito: {},
    medioPago: null,
    fotoComprobante: null,
    nombreCliente: null,
    stream: null,
    filtrosBebidas: {
        presentacion: null, // 'vaso' o 'botella'
        tipo: null, // 'gaseosa', 'agua_saborizada', 'agua'
        sabor: null // 'con_gas' o 'sin_gas' (solo para agua)
    },
    promosPersonalizadas: {}
};

let cacheProductosPromo = [];
let promoTemporal = {
    items: {}
};

function seleccionarRubro(rubro) {
    estadoVendedor.rubroActual = rubro;
    
    // Resetear filtros de bebidas si cambia de rubro
    if (rubro !== 'bebidas') {
        estadoVendedor.filtrosBebidas = {
            presentacion: null,
            tipo: null,
            sabor: null
        };
    }
    
    const rubrosView = document.getElementById('vendedor-rubros-view');
    const productosView = document.getElementById('vendedor-productos-view');
    const carritoView = document.getElementById('vendedor-carrito-view');
    const pagoView = document.getElementById('vendedor-pago-view');
    
    if (rubrosView) rubrosView.style.display = 'none';
    if (productosView) productosView.style.display = 'block';
    if (carritoView) carritoView.style.display = 'none';
    if (pagoView) pagoView.style.display = 'none';
    
    const titulos = {
        comida: '🍽️ Comida',
        bebidas: '🥤 Bebidas',
        postres: '🍰 Postres'
    };
    
    const rubroTitulo = document.getElementById('rubro-titulo');
    if (rubroTitulo) {
        rubroTitulo.textContent = titulos[rubro] || 'Productos';
    }
    
    if (rubro === 'bebidas') {
        mostrarFiltrosBebidas();
    } else {
        cargarProductosPorRubro(rubro);
    }
    actualizarBotonCarrito();
}

function volverRubros() {
    estadoVendedor.rubroActual = null;
    // Resetear filtros de bebidas
    estadoVendedor.filtrosBebidas = {
        presentacion: null,
        tipo: null,
        sabor: null
    };
    
    const rubrosView = document.getElementById('vendedor-rubros-view');
    const productosView = document.getElementById('vendedor-productos-view');
    const carritoView = document.getElementById('vendedor-carrito-view');
    const pagoView = document.getElementById('vendedor-pago-view');
    const breadcrumb = document.getElementById('bebidas-breadcrumb');
    
    if (rubrosView) rubrosView.style.display = 'block';
    if (productosView) productosView.style.display = 'none';
    if (carritoView) carritoView.style.display = 'none';
    if (pagoView) pagoView.style.display = 'none';
    if (breadcrumb) breadcrumb.style.display = 'none';
    
    actualizarBotonCarrito();
}

function mostrarFiltrosBebidas() {
    const filtrosContainer = document.getElementById('filtros-bebidas-container');
    const lista = document.getElementById('productos-rubro-lista');
    const breadcrumb = document.getElementById('bebidas-breadcrumb');
    
    if (filtrosContainer) filtrosContainer.style.display = 'block';
    if (lista) lista.innerHTML = '';
    if (breadcrumb) {
        breadcrumb.style.display = 'block';
        actualizarBreadcrumb();
    }
    
    // Mostrar solo el primer filtro (presentación)
    document.getElementById('filtro-presentacion').style.display = 'block';
    document.getElementById('filtro-tipo').style.display = 'none';
    document.getElementById('filtro-sabor').style.display = 'none';
}

function actualizarBreadcrumb() {
    const breadcrumbText = document.getElementById('breadcrumb-text');
    if (!breadcrumbText) return;
    
    const filtros = estadoVendedor.filtrosBebidas;
    const partes = [];
    
    if (filtros.presentacion) {
        const presentacionText = filtros.presentacion === 'vaso' ? '🥤 Vaso' : '🍾 Botella';
        partes.push(presentacionText);
    }
    
    if (filtros.tipo) {
        let tipoText = '';
        if (filtros.tipo === 'gaseosa') tipoText = '🥤 Gaseosa';
        else if (filtros.tipo === 'agua_saborizada') tipoText = '🧃 Agua Saborizada';
        else if (filtros.tipo === 'agua') tipoText = '💧 Agua';
        partes.push(tipoText);
    }
    
    if (filtros.sabor) {
        const saborText = filtros.sabor === 'con_gas' ? '💨 Con Gas' : '💧 Sin Gas';
        partes.push(saborText);
    }
    
    if (partes.length > 0) {
        breadcrumbText.textContent = partes.join(' > ');
    } else {
        breadcrumbText.textContent = 'Selecciona las opciones';
    }
}

function seleccionarPresentacionBebida(presentacion) {
    estadoVendedor.filtrosBebidas.presentacion = presentacion;
    actualizarBreadcrumb();
    document.getElementById('filtro-presentacion').style.display = 'none';
    document.getElementById('filtro-tipo').style.display = 'block';
}

function volverFiltroPresentacion() {
    estadoVendedor.filtrosBebidas.presentacion = null;
    estadoVendedor.filtrosBebidas.tipo = null;
    estadoVendedor.filtrosBebidas.sabor = null;
    actualizarBreadcrumb();
    document.getElementById('filtro-presentacion').style.display = 'block';
    document.getElementById('filtro-tipo').style.display = 'none';
    document.getElementById('filtro-sabor').style.display = 'none';
}

function seleccionarTipoBebida(tipo) {
    estadoVendedor.filtrosBebidas.tipo = tipo;
    actualizarBreadcrumb();
    
    if (tipo === 'agua') {
        // Si es agua, mostrar filtro de sabor
        document.getElementById('filtro-tipo').style.display = 'none';
        document.getElementById('filtro-sabor').style.display = 'block';
    } else {
        // Si no es agua, cargar productos directamente
        document.getElementById('filtros-bebidas-container').style.display = 'none';
        cargarProductosBebidasFiltrados();
    }
}

function volverFiltroTipo() {
    estadoVendedor.filtrosBebidas.tipo = null;
    estadoVendedor.filtrosBebidas.sabor = null;
    actualizarBreadcrumb();
    document.getElementById('filtro-tipo').style.display = 'block';
    document.getElementById('filtro-sabor').style.display = 'none';
}

function seleccionarSaborBebida(sabor) {
    estadoVendedor.filtrosBebidas.sabor = sabor;
    actualizarBreadcrumb();
    document.getElementById('filtros-bebidas-container').style.display = 'none';
    cargarProductosBebidasFiltrados();
}

async function cargarProductosBebidasFiltrados() {
    const filtros = estadoVendedor.filtrosBebidas;
    await cargarProductosPorRubro('bebidas', filtros);
}

function mostrarModalPromoEspecial() {
    promoTemporal = { items: {} };
    document.getElementById('promo-especial-precio').value = '';
    const lista = document.getElementById('promo-especial-lista');
    if (lista) {
        lista.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">Cargando productos...</p>';
    }
    document.getElementById('modal-promo-especial').classList.add('active');
    cargarProductosModalPromo();
}

function ocultarModalPromoEspecial() {
    document.getElementById('modal-promo-especial').classList.remove('active');
}

async function cargarProductosModalPromo() {
    try {
        if (cacheProductosPromo.length === 0) {
            const cocinas = await fetch('/api/cocinas').then(r => r.json());
            for (const cocina of cocinas) {
                const productos = await fetch(`/api/cocinas/${cocina.id}/productos`).then(r => r.json());
                productos.forEach(producto => {
                    cacheProductosPromo.push({
                        ...producto,
                        cocina: cocina.nombre
                    });
                });
            }
        }
        renderProductosPromo();
    } catch (error) {
        console.error('Error cargando productos para promo:', error);
        const lista = document.getElementById('promo-especial-lista');
        if (lista) {
            lista.innerHTML = '<p style="text-align: center; color: var(--danger); padding: 20px;">No se pudieron cargar los productos</p>';
        }
    }
}

function renderProductosPromo() {
    const lista = document.getElementById('promo-especial-lista');
    if (!lista) return;
    
    if (cacheProductosPromo.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">No hay productos disponibles</p>';
        return;
    }
    
    const productosPorCocina = {};
    cacheProductosPromo.forEach(producto => {
        if (!productosPorCocina[producto.cocina]) {
            productosPorCocina[producto.cocina] = [];
        }
        productosPorCocina[producto.cocina].push(producto);
    });
    
    let html = '';
    Object.keys(productosPorCocina).forEach(cocina => {
        html += `<div style="margin-bottom: 18px;"><h4 style="margin-bottom: 10px;">${cocina}</h4>`;
        productosPorCocina[cocina].forEach(producto => {
            const cantidad = promoTemporal.items[producto.id]?.cantidad || 0;
            html += `
                <div class="promo-producto-item">
                    <div>
                        <div style="font-weight: 600;">${producto.nombre}</div>
                        <div style="font-size: 0.85rem; color: var(--text-light);">$${producto.precio.toFixed(2)}</div>
                    </div>
                    <div class="cantidad-control">
                        <button class="cantidad-btn" onclick="modificarProductoPromo(${producto.id}, -1)">-</button>
                        <span class="cantidad-display" id="promo-prod-${producto.id}">${cantidad}</span>
                        <button class="cantidad-btn" onclick="modificarProductoPromo(${producto.id}, 1)">+</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    });
    
    lista.innerHTML = html;
}

function modificarProductoPromo(productoId, cambio) {
    if (!promoTemporal.items[productoId]) {
        const producto = cacheProductosPromo.find(p => p.id === productoId);
        if (!producto) return;
        promoTemporal.items[productoId] = {
            producto_id: productoId,
            nombre: producto.nombre,
            cantidad: 0
        };
    }
    
    const nuevaCantidad = Math.max(0, (promoTemporal.items[productoId].cantidad || 0) + cambio);
    if (nuevaCantidad === 0) {
        delete promoTemporal.items[productoId];
    } else {
        promoTemporal.items[productoId].cantidad = nuevaCantidad;
    }
    
    const display = document.getElementById(`promo-prod-${productoId}`);
    if (display) {
        display.textContent = nuevaCantidad;
    }
}

function guardarPromoEspecial() {
    const precioInput = document.getElementById('promo-especial-precio');
    const precio = parseFloat(precioInput.value);
    
    const itemsSeleccionados = Object.values(promoTemporal.items || {}).filter(item => item.cantidad > 0);
    
    if (itemsSeleccionados.length === 0) {
        mostrarMensaje('Selecciona al menos un producto', 'error');
        return;
    }
    
    if (!precio || precio <= 0) {
        mostrarMensaje('Ingresa un precio válido', 'error');
        return;
    }
    
    const promoId = `promo-custom-${Date.now()}`;
    estadoVendedor.promosPersonalizadas[promoId] = {
        nombre: 'Promo', // Nombre fijo "Promo"
        precio,
        items: itemsSeleccionados
    };
    estadoVendedor.carrito[promoId] = (estadoVendedor.carrito[promoId] || 0) + 1;
    
    ocultarModalPromoEspecial();
    actualizarBotonCarrito();
    actualizarCarrito();
    mostrarMensaje('Promoción agregada al carrito', 'success');
}

async function cargarProductosPorRubro(rubro, filtrosBebidas = null) {
    try {
        const cocinas = await fetch('/api/cocinas').then(r => r.json());
        const lista = document.getElementById('productos-rubro-lista');
        
        if (!lista) {
            console.error('No se encontró el elemento productos-rubro-lista');
            mostrarMensaje('Error: No se pudo cargar la lista de productos', 'error');
            return;
        }
        
        lista.innerHTML = '';
        
        // Mapeo de rubros a cocinas/productos
        const rubroCocinas = {
            comida: ['Parrilla', 'Horno'],
            bebidas: ['Cocina Principal'],
            postres: [] // Se pueden agregar después
        };
        
        const cocinasFiltradas = cocinas.filter(c => rubroCocinas[rubro]?.includes(c.nombre));
        
        for (const cocina of cocinasFiltradas) {
            const productos = await fetch(`/api/cocinas/${cocina.id}/productos`).then(r => r.json());
            
            // Filtrar productos si es bebidas y hay filtros
            let productosFiltrados = productos;
            if (rubro === 'bebidas' && filtrosBebidas) {
                productosFiltrados = productos.filter(producto => {
                    const nombre = producto.nombre.toLowerCase();
                    
                    // Filtrar por presentación
                    if (filtrosBebidas.presentacion === 'vaso' && !nombre.includes('vaso')) return false;
                    if (filtrosBebidas.presentacion === 'botella' && !nombre.includes('botella')) return false;
                    
                    // Filtrar por tipo
                    if (filtrosBebidas.tipo === 'gaseosa') {
                        const esGaseosa = nombre.includes('coca') || nombre.includes('fanta') || nombre.includes('sprite');
                        if (!esGaseosa) return false;
                    } else if (filtrosBebidas.tipo === 'agua_saborizada') {
                        const esAguaSaborizada = (nombre.includes('agua') && (nombre.includes('naranja') || nombre.includes('pomelo') || nombre.includes('pera'))) && !nombre.includes('natural');
                        if (!esAguaSaborizada) return false;
                    } else if (filtrosBebidas.tipo === 'agua') {
                        const esAgua = nombre.includes('agua') && !nombre.includes('naranja') && !nombre.includes('pomelo') && !nombre.includes('pera');
                        if (!esAgua) return false;
                        
                        // Filtrar por sabor (con gas o sin gas)
                        if (filtrosBebidas.sabor === 'con_gas' && !nombre.includes('gas')) return false;
                        if (filtrosBebidas.sabor === 'sin_gas' && nombre.includes('gas')) return false;
                    }
                    
                    return true;
                });
            }
            
            if (productosFiltrados.length > 0) {
                const cocinaDiv = document.createElement('div');
                cocinaDiv.className = 'cocina-section';
                cocinaDiv.innerHTML = `<h5 style="margin: 15px 0 10px 0; color: var(--text-light);">${cocina.nombre}</h5>`;
                
                productosFiltrados.forEach(producto => {
                    const productoDiv = document.createElement('div');
                    productoDiv.className = 'producto-item';
                    const sinStock = producto.stock === 0;
                    const esEmpanada = producto.nombre.toLowerCase().includes('empanada');
                    
                    // Mostrar stock en docenas si es empanada
                    let stockDisplay = producto.stock;
                    if (esEmpanada) {
                        const docenas = (producto.stock / 12).toFixed(1);
                        stockDisplay = `${docenas} docenas (${producto.stock} unidades)`;
                    }
                    
                    if (esEmpanada) {
                        // Calcular precio por docena
                        const precioPorDocena = producto.precio * 12;
                        // Calcular cantidad en carrito
                        const cantidadEnCarrito = estadoVendedor.carrito[producto.id] || 0;
                        const docenasEnCarrito = cantidadEnCarrito > 0 ? (cantidadEnCarrito / 12).toFixed(1) + ' docenas' : '0 docenas';
                        // Interfaz para empanadas (docenas/medias docenas)
                        productoDiv.innerHTML = `
                            <div class="producto-info">
                                <div class="producto-nombre">${producto.nombre} 📦</div>
                                <div class="producto-precio">$${precioPorDocena.toFixed(2)} por docena</div>
                                <div class="producto-stock ${producto.stock <= 5 ? 'stock-bajo' : ''} ${sinStock ? 'stock-bajo' : ''}">
                                    Stock: ${stockDisplay} ${sinStock ? '(Sin stock)' : ''}
                                </div>
                            </div>
                            <div class="cantidad-control-empanadas">
                                <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
                                    <div style="display: flex; gap: 5px; align-items: center;">
                                        <button class="cantidad-btn" onclick="modificarCantidadEmpanadas(${producto.id}, -0.5)" ${sinStock ? 'disabled style="opacity: 0.5;"' : ''} title="Menos media docena">-½</button>
                                        <button class="cantidad-btn" onclick="modificarCantidadEmpanadas(${producto.id}, -1)" ${sinStock ? 'disabled style="opacity: 0.5;"' : ''} title="Menos una docena">-1</button>
                                        <span class="cantidad-display" id="cant-${producto.id}" style="min-width: 80px; text-align: center;">${docenasEnCarrito}</span>
                                        <button class="cantidad-btn" onclick="modificarCantidadEmpanadas(${producto.id}, 1)" ${sinStock ? 'disabled style="opacity: 0.5;"' : ''} title="Más una docena">+1</button>
                                        <button class="cantidad-btn" onclick="modificarCantidadEmpanadas(${producto.id}, 0.5)" ${sinStock ? 'disabled style="opacity: 0.5;"' : ''} title="Más media docena">+½</button>
                                    </div>
                                    <div style="font-size: 0.75rem; color: var(--text-light);" id="unidades-${producto.id}">${cantidadEnCarrito} unidades</div>
                                </div>
                            </div>
                        `;
                    } else {
                        // Detectar si es bebida
                        const esBebida = producto.nombre.toLowerCase().includes('coca') || 
                                        producto.nombre.toLowerCase().includes('fanta') || 
                                        producto.nombre.toLowerCase().includes('sprite') || 
                                        producto.nombre.toLowerCase().includes('agua') ||
                                        producto.nombre.toLowerCase().includes('bebida');
                        
                        const iconoBebida = esBebida ? '🥤' : '';
                        const esVaso = producto.nombre.toLowerCase().includes('vaso');
                        const esBotella = producto.nombre.toLowerCase().includes('botella');
                        let presentacion = '';
                        if (esVaso) presentacion = '🥤 Vaso';
                        if (esBotella) presentacion = '🍾 Botella';
                        
                        // Construir el HTML de presentación antes del template string
                        const presentacionHTML = presentacion ? ' <span style="font-size: 0.85rem; color: var(--text-light);">(' + presentacion + ')</span>' : '';
                        
                        // Para bebidas por vaso, el stock se mostrará basado en botellas
                        // Por ahora mostrar el stock del producto (se actualizará dinámicamente si es necesario)
                        let stockDisplayFinal = stockDisplay;
                        let sinStockFinal = sinStock;
                        
                        // Interfaz normal para otros productos
                        productoDiv.innerHTML = `
                            <div class="producto-info">
                                <div class="producto-nombre">${iconoBebida} ${producto.nombre}${presentacionHTML}</div>
                                <div class="producto-precio">$${producto.precio.toFixed(2)}</div>
                                <div class="producto-stock ${producto.stock <= 5 ? 'stock-bajo' : ''} ${sinStockFinal ? 'stock-bajo' : ''}" id="stock-${producto.id}">
                                    Stock: ${stockDisplayFinal} ${sinStockFinal ? '(Sin stock)' : ''}
                                </div>
                            </div>
                            <div class="cantidad-control">
                                <button class="cantidad-btn" onclick="agregarAlCarrito(${producto.id}, -1)" ${sinStockFinal ? 'disabled style="opacity: 0.5;"' : ''}>-</button>
                                <span class="cantidad-display" id="cant-${producto.id}">${estadoVendedor.carrito[producto.id] || 0}</span>
                                <button class="cantidad-btn" onclick="agregarAlCarrito(${producto.id}, 1)" ${sinStockFinal ? 'disabled style="opacity: 0.5;"' : ''}>+</button>
                            </div>
                        `;
                        
                        // Para bebidas por vaso, no mostrar stock (no existe stock de vasos)
                        if (esVaso && esBebida) {
                            const stockElement = document.getElementById(`stock-${producto.id}`);
                            if (stockElement) {
                                stockElement.innerHTML = `Stock: No aplica (se descuenta botella en cocina)`;
                                stockElement.style.color = 'var(--text-light)';
                                stockElement.style.fontSize = '0.85rem';
                            }
                        }
                    }
                    cocinaDiv.appendChild(productoDiv);
                });
                
                lista.appendChild(cocinaDiv);
            }
        }
        
        // Actualizar botón de carrito en el header
        actualizarBotonCarrito();
    } catch (error) {
        console.error('Error cargando productos:', error);
        mostrarMensaje('Error al cargar productos', 'error');
    }
}

// Constante: vasos por botella
const VASOS_POR_BOTELLA = 4;

// Función auxiliar para obtener el nombre base de una bebida
function obtenerNombreBaseBebida(nombre) {
  return nombre.replace(/\s*-\s*(vaso|botella)/i, '').replace(/\s+(vaso|botella)/i, '').trim();
}

// Función para encontrar el producto botella correspondiente a un producto vaso
async function encontrarProductoBotella(nombreVaso) {
  const nombreBase = obtenerNombreBaseBebida(nombreVaso);
  try {
    const cocinas = await fetch('/api/cocinas').then(r => r.json());
    for (const cocina of cocinas) {
      const productos = await fetch(`/api/cocinas/${cocina.id}/productos`).then(r => r.json());
      const productoBotella = productos.find(p => {
        const nombre = p.nombre.toLowerCase();
        return (nombre.includes('botella') && nombre.includes(nombreBase.toLowerCase()));
      });
      if (productoBotella) return productoBotella;
    }
  } catch (error) {
    console.error('Error buscando producto botella:', error);
  }
  return null;
}

async function agregarAlCarrito(productoId, cambio) {
    if (!estadoVendedor.carrito[productoId]) {
        estadoVendedor.carrito[productoId] = 0;
    }
    
    const nuevaCantidad = estadoVendedor.carrito[productoId] + cambio;
    
    // Validar stock disponible (solo para productos que NO son vasos)
    if (nuevaCantidad > 0) {
        try {
            const producto = await fetch(`/api/productos/${productoId}`).then(r => r.json());
            const esVaso = producto.nombre.toLowerCase().includes('vaso');
            
            // No validar stock para vasos (no existe stock de vasos)
            if (!esVaso) {
                // Si es botella u otro producto, validar normalmente
                if (nuevaCantidad > producto.stock) {
                    mostrarMensaje(`Stock insuficiente. Disponible: ${producto.stock}`, 'error');
                    return;
                }
            }
        } catch (error) {
            console.error('Error validando stock:', error);
        }
    }
    
    estadoVendedor.carrito[productoId] = Math.max(0, nuevaCantidad);
    
    if (estadoVendedor.carrito[productoId] === 0) {
        delete estadoVendedor.carrito[productoId];
    }
    
    // Actualizar display
    const display = document.getElementById(`cant-${productoId}`);
    if (display) {
        display.textContent = estadoVendedor.carrito[productoId] || 0;
    }
    
    // Actualizar botón de carrito
    actualizarBotonCarrito();
}

function actualizarBotonCarrito() {
    // Calcular total de items en el carrito
    const totalItems = Object.values(estadoVendedor.carrito).reduce((a, b) => a + b, 0);
    const btnCarrito = document.getElementById('btn-carrito-header');
    const carritoCount = document.getElementById('carrito-count');
    
    if (totalItems > 0) {
        if (btnCarrito) btnCarrito.style.display = 'flex';
        if (carritoCount) carritoCount.textContent = totalItems;
    } else {
        if (btnCarrito) btnCarrito.style.display = 'none';
        if (carritoCount) carritoCount.textContent = '0';
    }
}

function mostrarCarrito() {
    document.getElementById('vendedor-productos-view').style.display = 'none';
    document.getElementById('vendedor-carrito-view').style.display = 'block';
    actualizarCarrito();
}

function actualizarCarrito() {
    const lista = document.getElementById('carrito-items-lista');
    lista.innerHTML = '';
    
    const items = Object.keys(estadoVendedor.carrito).filter(id => estadoVendedor.carrito[id] > 0);
    
    if (items.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">El carrito está vacío</p>';
        document.getElementById('total-pedido').textContent = '0.00';
        return;
    }
    
    let total = 0;
    const productosCache = {};
    
    const productosIds = items.filter(id => !id.toString().startsWith('promo-custom-'));
    const promocionesIds = items.filter(id => id.toString().startsWith('promo-custom-'));
    
    const promesas = productosIds.map(id => 
        fetch(`/api/productos/${id}`).then(r => r.json()).then(p => {
            productosCache[id] = p;
        })
    );
    
    Promise.all(promesas).then(() => {
        // Mostrar productos normales
        productosIds.forEach(productoId => {
            const producto = productosCache[productoId];
            if (!producto) return;
            
            const cantidad = estadoVendedor.carrito[productoId];
            const esEmpanada = producto.nombre.toLowerCase().includes('empanada');
            
            let subtotal = producto.precio * cantidad;
            let cantidadDisplay = cantidad;
            
            if (esEmpanada && cantidad > 0) {
                const docenas = cantidad / 12;
                const precioPorDocena = producto.precio * 12;
                subtotal = precioPorDocena * docenas;
                cantidadDisplay = `${docenas.toFixed(1)} docenas`;
            }
            
            total += subtotal;
            
            const div = document.createElement('div');
            div.className = 'items-lista-item';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${producto.nombre} x${cantidadDisplay}</span>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span>$${subtotal.toFixed(2)}</span>
                        <button class="btn-secondary" onclick="eliminarDelCarrito('${productoId}')" style="padding: 5px 10px; font-size: 0.8rem;">✕</button>
                    </div>
                </div>
            `;
            lista.appendChild(div);
        });
        
        // Mostrar promociones personalizadas
        promocionesIds.forEach(promoKey => {
            const promocion = estadoVendedor.promosPersonalizadas[promoKey];
            if (!promocion) return;
            
            const cantidad = estadoVendedor.carrito[promoKey];
            const subtotal = promocion.precio * cantidad;
            total += subtotal;
            
            const div = document.createElement('div');
            div.className = 'items-lista-item';
            div.style.borderLeft = '3px solid var(--primary)';
            div.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600;">🎁 ${promocion.nombre} x${cantidad}</span>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <span>$${subtotal.toFixed(2)}</span>
                            <button class="btn-secondary" onclick="eliminarDelCarrito('${promoKey}')" style="padding: 5px 10px; font-size: 0.8rem;">✕</button>
                        </div>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">
                        Incluye: ${promocion.items.map(item => `${item.nombre} x${item.cantidad}`).join(', ')}
                    </div>
                </div>
            `;
            lista.appendChild(div);
        });
        
        document.getElementById('total-pedido').textContent = total.toFixed(2);
    });
}

function eliminarDelCarrito(productoId) {
    delete estadoVendedor.carrito[productoId];
    if (productoId.toString().startsWith('promo-custom-')) {
        delete estadoVendedor.promosPersonalizadas[productoId];
    }
    actualizarCarrito();
    // Volver a productos si estamos ahí
    if (estadoVendedor.rubroActual) {
        cargarProductosPorRubro(estadoVendedor.rubroActual);
    }
}

function mostrarPago() {
    const items = Object.keys(estadoVendedor.carrito).filter(id => estadoVendedor.carrito[id] > 0);
    if (items.length === 0) {
        mostrarMensaje('El carrito está vacío', 'error');
        return;
    }
    
    document.getElementById('vendedor-carrito-view').style.display = 'none';
    document.getElementById('vendedor-pago-view').style.display = 'block';
    // Limpiar el campo de nombre al mostrar la vista de pago
    document.getElementById('nombre-cliente-pago').value = '';
    document.getElementById('nombre-cliente-pago').disabled = false;
    document.getElementById('nombre-cliente-pago').focus();
    // Ocultar sección de foto y resetear botones
    document.getElementById('seccion-foto-transferencia').style.display = 'none';
    document.querySelectorAll('.btn-pago').forEach(btn => {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    });
    // Resetear estado de foto
    estadoVendedor.fotoComprobante = null;
    estadoVendedor.medioPago = null;
    document.getElementById('foto-preview').innerHTML = '';
    document.getElementById('btn-camara').style.display = 'inline-block';
    document.getElementById('btn-capturar').style.display = 'none';
    document.getElementById('btn-repetir').style.display = 'none';
    document.getElementById('btn-omitir').style.display = 'none';
    document.getElementById('btn-finalizar-transferencia').style.display = 'none';
}

function seleccionarPago(medio) {
    const nombreCliente = document.getElementById('nombre-cliente-pago').value.trim();
    if (!nombreCliente) {
        mostrarMensaje('Ingresa el nombre del cliente', 'error');
        return;
    }
    
    estadoVendedor.medioPago = medio;
    estadoVendedor.nombreCliente = nombreCliente;
    
    if (medio === 'transferencia') {
        // Mostrar sección de foto en la misma vista
        document.getElementById('seccion-foto-transferencia').style.display = 'block';
        // Deshabilitar el campo de nombre y los botones de pago
        document.getElementById('nombre-cliente-pago').disabled = true;
        document.querySelectorAll('.btn-pago').forEach(btn => {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        });
    } else {
        // Efectivo: finalizar directamente
        finalizarPedido();
    }
}

function volverCarrito() {
    document.getElementById('vendedor-pago-view').style.display = 'none';
    document.getElementById('vendedor-carrito-view').style.display = 'block';
    // Resetear estado de foto
    document.getElementById('seccion-foto-transferencia').style.display = 'none';
    document.getElementById('nombre-cliente-pago').disabled = false;
    document.querySelectorAll('.btn-pago').forEach(btn => {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    });
    // Detener cámara si está activa
    if (estadoVendedor.stream) {
        estadoVendedor.stream.getTracks().forEach(track => track.stop());
        estadoVendedor.stream = null;
    }
    document.getElementById('video').style.display = 'none';
    document.getElementById('btn-camara').style.display = 'inline-block';
    document.getElementById('btn-capturar').style.display = 'none';
    document.getElementById('btn-repetir').style.display = 'none';
    document.getElementById('btn-omitir').style.display = 'none';
    document.getElementById('btn-finalizar-transferencia').style.display = 'none';
    document.getElementById('foto-preview').innerHTML = '';
}

function iniciarCamara() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            estadoVendedor.stream = stream;
            const video = document.getElementById('video');
            video.srcObject = stream;
            video.style.display = 'block';
            document.getElementById('btn-camara').style.display = 'none';
            document.getElementById('btn-capturar').style.display = 'inline-block';
        })
        .catch(err => {
            console.error('Error accediendo a la cámara:', err);
            mostrarMensaje('No se pudo acceder a la cámara', 'error');
        });
}

function capturarFoto() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    // Detener stream
    if (estadoVendedor.stream) {
        estadoVendedor.stream.getTracks().forEach(track => track.stop());
        estadoVendedor.stream = null;
    }
    
    video.style.display = 'none';
    document.getElementById('btn-capturar').style.display = 'none';
    document.getElementById('btn-repetir').style.display = 'inline-block';
    document.getElementById('btn-omitir').style.display = 'inline-block';
    document.getElementById('btn-finalizar-transferencia').style.display = 'block';
    
    // Mostrar preview
    const fotoData = canvas.toDataURL('image/jpeg', 0.8);
    estadoVendedor.fotoComprobante = fotoData;
    document.getElementById('foto-preview').innerHTML = `
        <img src="${fotoData}" style="max-width: 100%; border-radius: 8px; border: 2px solid var(--border);" alt="Comprobante">
    `;
}

function repetirFoto() {
    estadoVendedor.fotoComprobante = null;
    document.getElementById('foto-preview').innerHTML = '';
    document.getElementById('btn-repetir').style.display = 'none';
    document.getElementById('btn-omitir').style.display = 'none';
    document.getElementById('btn-finalizar-transferencia').style.display = 'none';
    iniciarCamara();
}

function omitirFoto() {
    estadoVendedor.fotoComprobante = null;
    document.getElementById('foto-preview').innerHTML = '';
    document.getElementById('btn-repetir').style.display = 'none';
    document.getElementById('btn-omitir').style.display = 'none';
    document.getElementById('btn-finalizar-transferencia').style.display = 'block';
}

async function finalizarPedido() {
    const nombreCliente = estadoVendedor.nombreCliente || document.getElementById('nombre-cliente-pago').value.trim();
    if (!nombreCliente) {
        mostrarMensaje('Ingresa el nombre del cliente', 'error');
        return;
    }
    
    // Expandir promociones en sus productos individuales para el pedido
    // Pero también guardar información de promociones para las ventas
    const items = [];
    const promociones = [];
    const carritoItems = Object.keys(estadoVendedor.carrito).filter(id => estadoVendedor.carrito[id] > 0);
    
    for (const id of carritoItems) {
        const cantidad = estadoVendedor.carrito[id];
        if (id.toString().startsWith('promo-custom-')) {
            const promocion = estadoVendedor.promosPersonalizadas[id];
            if (!promocion) continue;
            
            // Guardar información de la promoción
            promociones.push({
                nombre: promocion.nombre,
                precio: promocion.precio,
                cantidad: cantidad,
                items: promocion.items.map(item => ({
                    producto_id: item.producto_id,
                    cantidad: item.cantidad * cantidad
                }))
            });
            
            // Expandir productos para el pedido (para que cocina vea qué preparar)
            promocion.items.forEach(item => {
                items.push({
                    producto_id: item.producto_id,
                    cantidad: item.cantidad * cantidad
                });
            });
        } else {
            // Es un producto normal
            items.push({
                producto_id: parseInt(id),
                cantidad
            });
        }
    }
    
    try {
        // Si hay comprobante, usar FormData, sino JSON
        let response;
        if (estadoVendedor.medioPago === 'transferencia' && estadoVendedor.fotoComprobante) {
            const formData = new FormData();
            formData.append('nombre_cliente', nombreCliente);
            formData.append('items', JSON.stringify(items));
            formData.append('promociones', JSON.stringify(promociones));
            formData.append('medio_pago', estadoVendedor.medioPago);
            formData.append('rol_atencion', 'atencion');
            
            // Si fotoComprobante es un File, agregarlo directamente
            if (estadoVendedor.fotoComprobante instanceof File || estadoVendedor.fotoComprobante instanceof Blob) {
                formData.append('comprobante', estadoVendedor.fotoComprobante, 'comprobante.jpg');
            }
            
            response = await fetch('/api/pedidos', {
                method: 'POST',
                body: formData
            });
        } else {
            response = await fetch('/api/pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre_cliente: nombreCliente,
                    items: items,
                    promociones: promociones,
                    medio_pago: estadoVendedor.medioPago,
                    rol_atencion: 'atencion'
                })
            });
        }
        
        if (response.ok) {
            mostrarMensaje('Pedido creado exitosamente', 'success');
            // Resetear estado
            estadoVendedor.carrito = {};
            estadoVendedor.medioPago = null;
            estadoVendedor.fotoComprobante = null;
            estadoVendedor.nombreCliente = null;
            estadoVendedor.promosPersonalizadas = {};
            document.getElementById('nombre-cliente-pago').value = '';
            volverRubros();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al crear pedido');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje(error.message || 'Error al crear el pedido', 'error');
    }
}

async function modificarCantidadEmpanadas(productoId, cambioDocenas) {
    if (!estadoVendedor.carrito[productoId]) {
        estadoVendedor.carrito[productoId] = 0;
    }
    
    // Cambio en docenas, convertir a unidades
    const cambioUnidades = Math.round(cambioDocenas * 12);
    const nuevaCantidad = estadoVendedor.carrito[productoId] + cambioUnidades;
    
    // Validar stock disponible
    if (nuevaCantidad > 0) {
        try {
            const producto = await fetch(`/api/productos/${productoId}`).then(r => r.json());
            if (nuevaCantidad > producto.stock) {
                const docenasDisponibles = (producto.stock / 12).toFixed(1);
                mostrarMensaje(`Stock insuficiente. Disponible: ${docenasDisponibles} docenas (${producto.stock} unidades)`, 'error');
                return;
            }
        } catch (error) {
            console.error('Error validando stock:', error);
        }
    }
    
    estadoVendedor.carrito[productoId] = Math.max(0, nuevaCantidad);
    
    if (estadoVendedor.carrito[productoId] === 0) {
        delete estadoVendedor.carrito[productoId];
        const cantDisplay = document.getElementById(`cant-${productoId}`);
        const unidadesDisplay = document.getElementById(`unidades-${productoId}`);
        if (cantDisplay) cantDisplay.textContent = '0 docenas';
        if (unidadesDisplay) unidadesDisplay.textContent = '0 unidades';
    } else {
        const docenas = (estadoVendedor.carrito[productoId] / 12).toFixed(1);
        const cantDisplay = document.getElementById(`cant-${productoId}`);
        const unidadesDisplay = document.getElementById(`unidades-${productoId}`);
        if (cantDisplay) cantDisplay.textContent = `${docenas} docenas`;
        if (unidadesDisplay) unidadesDisplay.textContent = `${estadoVendedor.carrito[productoId]} unidades`;
    }
    
    actualizarBotonCarrito();
}

// Funciones antiguas eliminadas - ahora se usa el sistema de carrito

// ========== COCINA ==========
async function cargarEslabones() {
    try {
        const eslabones = await fetch('/api/eslabones').then(r => r.json());
        const grid = document.getElementById('eslabones-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        const iconos = {
            'cocina': '🍳',
            'parrilla': '🔥',
            'horno': '🔥',
            'bebidas': '🥤',
            'postres': '🍰'
        };
        
        eslabones.forEach(eslabon => {
            const btn = document.createElement('button');
            btn.className = 'perfil-btn';
            btn.style.cssText = 'padding: 20px; text-align: center; border-radius: 12px; border: 2px solid var(--border); background: var(--card-bg); cursor: pointer; transition: all 0.3s;';
            btn.innerHTML = `
                <span style="font-size: 3rem; display: block; margin-bottom: 10px;">${iconos[eslabon.tipo] || '🍴'}</span>
                <span style="font-weight: 600; font-size: 1.1rem;">${eslabon.nombre}</span>
            `;
            btn.onclick = () => confirmarEslabon(eslabon.id, eslabon.nombre, eslabon.tipo);
            grid.appendChild(btn);
        });
    } catch (error) {
        console.error('Error cargando eslabones:', error);
        mostrarMensaje('Error cargando eslabones', 'error');
    }
}

function confirmarEslabon(eslabonId, eslabonNombre, eslabonTipo) {
    estado.eslabonActual = eslabonId;
    estado.eslabonTipo = eslabonTipo;
    
    // Ocultar selección y mostrar contenido
    const produccionSeleccion = document.getElementById('produccion-seleccion');
    const produccionContent = document.getElementById('produccion-content');
    const eslabonNombreActual = document.getElementById('eslabon-nombre-actual');
    
    if (produccionSeleccion) produccionSeleccion.style.display = 'none';
    if (produccionContent) produccionContent.style.display = 'block';
    if (eslabonNombreActual) eslabonNombreActual.textContent = eslabonNombre;
    
    // Mostrar vista de pedidos (principal) y ocultar productos
    const pedidosView = document.getElementById('produccion-pedidos-view');
    const productosView = document.getElementById('produccion-productos-view');
    if (pedidosView) pedidosView.style.display = 'block';
    if (productosView) productosView.style.display = 'none';
    
    // Cargar datos del eslabón (pedidos primero)
    cargarPedidosEslabon(eslabonId);
    cargarProductosEslabon(eslabonId);
    
    // Registrar WebSocket con el tipo de eslabón
    registrarWebSocket(eslabonTipo);
    
    mostrarMensaje(`Eslabón ${eslabonNombre} seleccionado`, 'success');
}

function mostrarGestionProductos() {
    const pedidosView = document.getElementById('produccion-pedidos-view');
    const productosView = document.getElementById('produccion-productos-view');
    if (pedidosView) pedidosView.style.display = 'none';
    if (productosView) productosView.style.display = 'block';
    // Asegurar que los productos estén cargados
    if (estado.eslabonActual) {
        cargarProductosEslabon(estado.eslabonActual);
    }
}

function ocultarGestionProductos() {
    const pedidosView = document.getElementById('produccion-pedidos-view');
    const productosView = document.getElementById('produccion-productos-view');
    if (pedidosView) pedidosView.style.display = 'block';
    if (productosView) productosView.style.display = 'none';
    // Recargar pedidos al volver
    if (estado.eslabonActual) {
        cargarPedidosEslabon(estado.eslabonActual);
    }
}

function cambiarEslabon() {
    estado.eslabonActual = null;
    estado.eslabonTipo = null;
    const produccionContent = document.getElementById('produccion-content');
    const produccionSeleccion = document.getElementById('produccion-seleccion');
    if (produccionContent) produccionContent.style.display = 'none';
    if (produccionSeleccion) produccionSeleccion.style.display = 'block';
    // Resetear vistas
    const pedidosView = document.getElementById('produccion-pedidos-view');
    const productosView = document.getElementById('produccion-productos-view');
    if (pedidosView) pedidosView.style.display = 'block';
    if (productosView) productosView.style.display = 'none';
}

async function cargarProductosEslabon(eslabonId) {
    try {
        const productos = await fetch(`/api/eslabones/${eslabonId}/productos`).then(r => r.json());
        const lista = document.getElementById('productos-lista');
        if (!lista) return;
        lista.innerHTML = '';
        
        productos.forEach(producto => {
            const div = document.createElement('div');
            div.className = 'producto-gestion';
            
            // Mostrar stock según tipo de venta
            let stockDisplay = producto.stock;
            if (producto.tipo_venta === 'docena') {
                const docenas = (producto.stock / 12).toFixed(1);
                stockDisplay = `${docenas} docenas (${producto.stock} unidades)`;
            } else if (producto.tipo_venta === 'media_docena') {
                const mediaDocenas = (producto.stock / 6).toFixed(1);
                stockDisplay = `${mediaDocenas} media docenas (${producto.stock} unidades)`;
            }
            
            div.innerHTML = `
                <div class="producto-gestion-info">
                    <div class="producto-nombre">${producto.nombre}</div>
                    <div class="producto-precio">$${producto.precio.toFixed(2)}</div>
                    <div class="producto-stock">Stock: ${stockDisplay}</div>
                </div>
                <div class="producto-gestion-actions">
                    <button class="btn-edit" onclick="editarProducto(${producto.id}, '${producto.nombre.replace(/'/g, "\\'")}', ${producto.precio}, ${producto.stock})">Editar</button>
                </div>
            `;
            lista.appendChild(div);
        });
    } catch (error) {
        console.error('Error cargando productos:', error);
    }
}

async function cargarPedidosEslabon(eslabonId) {
    try {
        const pedidos = await fetch(`/api/eslabones/${eslabonId}/pedidos`).then(r => r.json());
        const lista = document.getElementById('pedidos-lista');
        lista.innerHTML = '';
        
        if (pedidos.length === 0) {
            lista.innerHTML = '<p style="text-align: center; color: var(--text-light);">No hay pedidos pendientes</p>';
            return;
        }
        
        pedidos.forEach(pedido => {
            // Detectar si hay bebidas por vaso en el pedido
            // Usar es_vaso si está disponible, sino buscar por nombre
            const tieneBebidasVaso = pedido.items.some(item => 
                item.es_vaso === true || 
                (item.categoria === 'bebida' && (item.producto_base_id || item.nombre.toLowerCase().includes('vaso')))
            );
            const itemsVaso = pedido.items.filter(item => 
                item.es_vaso === true || 
                (item.categoria === 'bebida' && (item.producto_base_id || item.nombre.toLowerCase().includes('vaso')))
            );
            
            const div = document.createElement('div');
            div.className = 'pedido-card';
            div.innerHTML = `
                <div class="pedido-header">
                    <span class="pedido-nombre">${pedido.nombre_cliente}</span>
                    <span class="pedido-estado estado-${pedido.estado}">${pedido.estado.replace('_', ' ')}</span>
                </div>
                <div class="pedido-items">
                    ${pedido.items.map(item => `
                        <div class="pedido-item">
                            <span>${item.nombre} x${item.cantidad}</span>
                            <span>$${item.total.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                ${tieneBebidasVaso ? `
                <div style="margin: 10px 0; padding: 12px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <div style="font-size: 0.9rem; color: #856404; margin-bottom: 10px; font-weight: 600;">
                        🥤 Bebidas por vaso - Descontar botellas:
                    </div>
                    ${itemsVaso.map(item => {
                        const botellasNecesarias = Math.ceil(item.cantidad / 4); // 4 vasos por botella
                        return `
                        <div style="margin: 8px 0; padding: 8px; background: white; border-radius: 6px; border: 1px solid #ffc107;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <div>
                                    <strong>${item.nombre}</strong>
                                    <div style="font-size: 0.8rem; color: #856404;">
                                        ${item.cantidad} vaso(s) = ${botellasNecesarias} botella(s) necesaria(s)
                                    </div>
                                </div>
                                <button class="btn-secondary" onclick="descontarBotella(${pedido.id}, ${item.producto_id}, ${item.cantidad})" 
                                        style="background: #ffc107; color: #856404; border-color: #ffc107; font-weight: 600; padding: 8px 16px;">
                                    Descontar ${botellasNecesarias} Botella(s)
                                </button>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
                ` : ''}
                <div class="pedido-actions">
                    ${pedido.estado === 'pendiente' ? `
                        <button class="btn-estado" onclick="actualizarEstadoPedido(${pedido.id}, 'en_preparacion')">
                            En Preparación
                        </button>
                    ` : ''}
                    ${pedido.estado === 'en_preparacion' ? `
                        <button class="btn-estado estado-listo" onclick="actualizarEstadoPedido(${pedido.id}, 'listo')">
                            Marcar como Listo
                        </button>
                    ` : ''}
                </div>
            `;
            lista.appendChild(div);
        });
    } catch (error) {
        console.error('Error cargando pedidos:', error);
    }
}

async function actualizarEstadoPedido(pedidoId, nuevoEstado) {
    try {
        await fetch(`/api/pedidos/${pedidoId}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        
        if (estado.eslabonActual) {
            cargarPedidosEslabon(estado.eslabonActual);
        }
        mostrarMensaje('Estado actualizado', 'success');
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al actualizar estado', 'error');
    }
}

async function descontarBotella(pedidoId, productoVasoId, cantidadVasos) {
    if (!confirm(`¿Deseas descontar la(s) botella(s) necesaria(s) para ${cantidadVasos} vaso(s)?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/pedidos/${pedidoId}/descontar-botella`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                producto_vaso_id: productoVasoId,
                cantidad_vasos: cantidadVasos
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            mostrarMensaje(data.error || 'Error al descontar botella', 'error');
            return;
        }
        
        mostrarMensaje(
            `✅ Se descontaron ${data.botellas_descontadas} botella(s) de "${data.botella_nombre}". Stock restante: ${data.stock_restante} botellas`, 
            'success'
        );
        
        // Recargar pedidos y productos para actualizar la vista
        if (estado.eslabonActual) {
            cargarPedidosEslabon(estado.eslabonActual);
            cargarProductosEslabon(estado.eslabonActual);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al descontar botella: ' + error.message, 'error');
    }
}

function mostrarTab(tab, eventElement) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (eventElement && eventElement.target) {
        eventElement.target.classList.add('active');
    } else {
        // Si no hay event, buscar el botón correspondiente
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.textContent.toLowerCase().includes(tab)) {
                btn.classList.add('active');
            }
        });
    }
    document.getElementById(`tab-${tab}`).classList.add('active');
}

function mostrarFormProducto() {
    document.getElementById('producto-nombre').value = '';
    document.getElementById('producto-precio').value = '';
    document.getElementById('producto-stock').value = '';
    document.getElementById('producto-stock').step = '1';
    document.getElementById('stock-label').textContent = 'Unidades';
    document.getElementById('modal-producto').classList.add('active');
}

function actualizarTipoStock() {
    const nombre = document.getElementById('producto-nombre').value.toLowerCase();
    const stockInput = document.getElementById('producto-stock');
    const stockLabel = document.getElementById('stock-label');
    
    if (nombre.includes('empanada')) {
        stockInput.placeholder = 'Docenas';
        stockInput.step = '0.5';
        stockLabel.textContent = 'Docenas (1 docena = 12 unidades)';
    } else {
        stockInput.placeholder = 'Stock inicial';
        stockInput.step = '1';
        stockLabel.textContent = 'Unidades';
    }
}

function cerrarModal() {
    document.getElementById('modal-producto').classList.remove('active');
}

async function guardarProducto() {
    const nombre = document.getElementById('producto-nombre').value.trim();
    const precio = parseFloat(document.getElementById('producto-precio').value);
    let stockInput = parseFloat(document.getElementById('producto-stock').value) || 0;
    const productoId = document.getElementById('modal-producto').dataset.productoId;
    
    if (!nombre || !precio) {
        mostrarMensaje('Completa todos los campos', 'error');
        return;
    }
    
    // Convertir docenas a unidades si es empanada
    let stock = stockInput;
    const esEmpanada = nombre.toLowerCase().includes('empanada');
    if (esEmpanada) {
        stock = Math.round(stockInput * 12); // Convertir docenas a unidades
    } else {
        stock = Math.round(stockInput);
    }
    
    try {
        if (productoId) {
            // Editar producto existente
            await fetch(`/api/productos/${productoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, precio, stock })
            });
            mostrarMensaje('Producto actualizado', 'success');
        } else {
            // Crear nuevo producto
            await fetch(`/api/eslabones/${estado.eslabonActual}/productos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, precio, stock })
            });
            mostrarMensaje('Producto creado', 'success');
        }
        
        cerrarModal();
        delete document.getElementById('modal-producto').dataset.productoId;
        cargarProductosEslabon(estado.eslabonActual);
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al guardar producto', 'error');
    }
}

function editarProducto(id, nombre, precio, stock) {
    document.getElementById('producto-nombre').value = nombre;
    document.getElementById('producto-precio').value = precio;
    
    // Convertir unidades a docenas si es empanada
    const esEmpanada = nombre.toLowerCase().includes('empanada');
    let stockDisplay = stock;
    if (esEmpanada) {
        stockDisplay = (stock / 12).toFixed(1);
        document.getElementById('producto-stock').placeholder = 'Docenas';
        document.getElementById('producto-stock').step = '0.5';
        document.getElementById('stock-label').textContent = 'Docenas (1 docena = 12 unidades)';
    } else {
        document.getElementById('producto-stock').placeholder = 'Stock inicial';
        document.getElementById('producto-stock').step = '1';
        document.getElementById('stock-label').textContent = 'Unidades';
    }
    
    document.getElementById('producto-stock').value = stockDisplay;
    document.getElementById('modal-producto').classList.add('active');
    
    // Guardar ID para edición
    document.getElementById('modal-producto').dataset.productoId = id;
}

// ========== DESPACHO ==========
async function cargarPedidosDespacho() {
    try {
        const pedidos = await fetch('/api/pedidos/listos').then(r => r.json());
        const lista = document.getElementById('pedidos-despacho-lista');
        lista.innerHTML = '';
        
        if (pedidos.length === 0) {
            lista.innerHTML = '<p style="text-align: center; color: var(--text-light);">No hay pedidos listos</p>';
            return;
        }
        
        pedidos.forEach(pedido => {
            const div = document.createElement('div');
            div.className = 'pedido-card';
            div.innerHTML = `
                <div class="pedido-header">
                    <span class="pedido-nombre">${pedido.nombre_cliente}</span>
                    <span class="pedido-estado estado-listo">Listo</span>
                </div>
                <div style="margin: 10px 0; color: var(--text-light); font-size: 0.9rem;">
                    Cocina: ${pedido.cocina_nombre}
                </div>
                <div class="pedido-items">
                    ${pedido.items.map(item => `
                        <div class="pedido-item">
                            <span>${item.nombre} x${item.cantidad}</span>
                            <span>$${item.total.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="pedido-actions">
                    <button class="btn-estado estado-entregado" onclick="marcarEntregado(${pedido.id})">
                        Marcar como Entregado
                    </button>
                </div>
            `;
            lista.appendChild(div);
        });
    } catch (error) {
        console.error('Error cargando pedidos:', error);
    }
}

async function marcarEntregado(pedidoId) {
    try {
        await fetch(`/api/pedidos/${pedidoId}/entregado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        
        cargarPedidosDespacho();
        mostrarMensaje('Pedido marcado como entregado', 'success');
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al marcar pedido', 'error');
    }
}

function mostrarHistorialDespacho() {
    document.getElementById('despacho-pedidos-view').style.display = 'none';
    document.getElementById('despacho-historial-view').style.display = 'block';
    cargarHistorialDespacho();
}

function ocultarHistorialDespacho() {
    document.getElementById('despacho-pedidos-view').style.display = 'block';
    document.getElementById('despacho-historial-view').style.display = 'none';
    cargarPedidosDespacho();
}

async function cargarHistorialDespacho() {
    try {
        const pedidos = await fetch('/api/pedidos/entregados?limite=100').then(r => r.json());
        const lista = document.getElementById('historial-despacho-lista');
        lista.innerHTML = '';
        
        if (pedidos.length === 0) {
            lista.innerHTML = '<p style="text-align: center; color: var(--text-light);">No hay pedidos entregados</p>';
            return;
        }
        
        pedidos.forEach(pedido => {
            const div = document.createElement('div');
            div.className = 'pedido-card';
            const fechaEntregado = new Date(pedido.updated_at).toLocaleString('es-ES');
            div.innerHTML = `
                <div class="pedido-header">
                    <span class="pedido-nombre">${pedido.nombre_cliente}</span>
                    <span class="pedido-estado estado-listo" style="background: #d1fae5; color: #065f46;">Entregado</span>
                </div>
                <div style="margin: 10px 0; color: var(--text-light); font-size: 0.9rem;">
                    <div>Cocina: ${pedido.cocina_nombre}</div>
                    <div>Entregado: ${fechaEntregado}</div>
                    <div>Pedido #${pedido.id}</div>
                </div>
                <div class="pedido-items">
                    ${pedido.items.map(item => `
                        <div class="pedido-item">
                            <span>${item.nombre} x${item.cantidad}</span>
                            <span>$${item.total.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            lista.appendChild(div);
        });
    } catch (error) {
        console.error('Error cargando historial:', error);
        mostrarMensaje('Error al cargar historial de pedidos', 'error');
    }
}

// ========== HISTORIAL VENTAS ==========
function mostrarTabVentas(tab, eventElement) {
    document.querySelectorAll('#ventas-screen .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#ventas-screen .tab-content').forEach(content => content.classList.remove('active'));
    
    if (eventElement && eventElement.target) {
        eventElement.target.classList.add('active');
    } else {
        document.querySelectorAll('#ventas-screen .tab-btn').forEach(btn => {
            if (btn.textContent.toLowerCase().includes(tab)) {
                btn.classList.add('active');
            }
        });
    }
    
    const contentId = `tab-ventas-${tab}`;
    const content = document.getElementById(contentId);
    if (content) {
        content.classList.add('active');
    }
    
    // Cargar datos según la pestaña
    if (tab === 'pedidos') {
        cargarVentasPorPedidos();
    } else if (tab === 'productos') {
        cargarVentasPorProductos();
    } else if (tab === 'comprobantes') {
        cargarComprobantes();
    } else if (tab === 'pdf') {
        // Mostrar la vista de PDF y generar automáticamente
        setTimeout(() => {
            generarVistaPreviaPDF();
        }, 100);
    } else if (tab === 'estadisticas') {
        // Mostrar la vista de estadísticas y generar automáticamente
        setTimeout(() => {
            generarVistaPreviaEstadisticas();
        }, 100);
    }
}

function calcularEstadisticas(resumen, ventas, productos) {
    try {
        const totalEfectivo = resumen.por_medio_pago?.find(r => r.medio_pago === 'efectivo')?.total_ventas || 0;
        const totalTransferencia = resumen.por_medio_pago?.find(r => r.medio_pago === 'transferencia')?.total_ventas || 0;
        const totalGeneral = resumen.total?.total_ventas || 0;
        const totalPedidos = resumen.total?.total_pedidos || 0;
        
        // Calcular estadísticas
        const totalProductosVendidos = ventas.reduce((sum, v) => sum + v.cantidad, 0);
        const promedioVentaPorPedido = totalPedidos > 0 ? totalGeneral / totalPedidos : 0;
        const promedioProductosPorPedido = totalPedidos > 0 ? totalProductosVendidos / totalPedidos : 0;
        const porcentajeEfectivo = totalGeneral > 0 ? (totalEfectivo / totalGeneral * 100) : 0;
        const porcentajeTransferencia = totalGeneral > 0 ? (totalTransferencia / totalGeneral * 100) : 0;
        
        // Producto más vendido (por cantidad)
        const productosAgrupados = {};
        productos.forEach(p => {
            if (!productosAgrupados[p.producto_id]) {
                productosAgrupados[p.producto_id] = {
                    producto_nombre: p.producto_nombre,
                    cantidad_total: 0,
                    total_venta: 0
                };
            }
            productosAgrupados[p.producto_id].cantidad_total += p.cantidad_total;
            productosAgrupados[p.producto_id].total_venta += p.total_venta_producto;
        });
        
        const productosArray = Object.values(productosAgrupados);
        const productoMasVendido = productosArray.length > 0 
            ? productosArray.reduce((max, p) => p.cantidad_total > max.cantidad_total ? p : max, productosArray[0])
            : null;
        
        const productoMasIngresos = productosArray.length > 0
            ? productosArray.reduce((max, p) => p.total_venta > max.total_venta ? p : max, productosArray[0])
            : null;
        
        // Productos más vendidos por medio de pago
        const productosEfectivo = productos.filter(p => p.medio_pago === 'efectivo');
        const productosTransferencia = productos.filter(p => p.medio_pago === 'transferencia');
        
        const productosEfectivoAgrupados = {};
        productosEfectivo.forEach(p => {
            if (!productosEfectivoAgrupados[p.producto_id]) {
                productosEfectivoAgrupados[p.producto_id] = {
                    producto_nombre: p.producto_nombre,
                    cantidad_total: 0
                };
            }
            productosEfectivoAgrupados[p.producto_id].cantidad_total += p.cantidad_total;
        });
        
        const productosTransferenciaAgrupados = {};
        productosTransferencia.forEach(p => {
            if (!productosTransferenciaAgrupados[p.producto_id]) {
                productosTransferenciaAgrupados[p.producto_id] = {
                    producto_nombre: p.producto_nombre,
                    cantidad_total: 0
                };
            }
            productosTransferenciaAgrupados[p.producto_id].cantidad_total += p.cantidad_total;
        });
        
        const productoMasVendidoEfectivo = Object.values(productosEfectivoAgrupados).length > 0
            ? Object.values(productosEfectivoAgrupados).reduce((max, p) => p.cantidad_total > max.cantidad_total ? p : max, Object.values(productosEfectivoAgrupados)[0])
            : null;
        
        const productoMasVendidoTransferencia = Object.values(productosTransferenciaAgrupados).length > 0
            ? Object.values(productosTransferenciaAgrupados).reduce((max, p) => p.cantidad_total > max.cantidad_total ? p : max, Object.values(productosTransferenciaAgrupados)[0])
            : null;
        
        // Guardar estadísticas para el PDF
        window.estadisticasPDF = {
            totalProductosVendidos,
            promedioVentaPorPedido,
            promedioProductosPorPedido,
            porcentajeEfectivo,
            porcentajeTransferencia,
            productoMasVendido,
            productoMasIngresos,
            productoMasVendidoEfectivo,
            productoMasVendidoTransferencia
        };
    } catch (error) {
        console.error('Error calculando estadísticas:', error);
    }
}

async function cargarHistorialVentas() {
    try {
        const resumen = await fetch('/api/ventas/resumen').then(r => r.json());
        const ventas = await fetch('/api/ventas').then(r => r.json());
        
        // Calcular totales por medio de pago
        const totalEfectivo = resumen.por_medio_pago?.find(r => r.medio_pago === 'efectivo')?.total_ventas || 0;
        const totalTransferencia = resumen.por_medio_pago?.find(r => r.medio_pago === 'transferencia')?.total_ventas || 0;
        const totalGeneral = resumen.total?.total_ventas || 0;
        
        // Mostrar resumen
        const resumenDiv = document.getElementById('resumen-ventas');
        resumenDiv.innerHTML = `
            <div class="resumen-card resumen-card-total">
                <div class="resumen-card-header">
                    <h4>TOTAL VENTAS</h4>
                </div>
                <div class="resumen-card-body">
                    <div class="valor valor-total">$${totalGeneral.toFixed(2)}</div>
                </div>
            </div>
            <div class="resumen-card resumen-card-pedidos">
                <div class="resumen-card-header">
                    <h4>TOTAL PEDIDOS</h4>
                </div>
                <div class="resumen-card-body">
                    <div class="valor valor-pedidos">${resumen.total?.total_pedidos || 0}</div>
                </div>
            </div>
            <div class="resumen-card resumen-card-efectivo">
                <div class="resumen-card-header">
                    <span class="resumen-icon">💰</span>
                    <h4>EFECTIVO</h4>
                </div>
                <div class="resumen-card-body">
                    <div class="valor">$${totalEfectivo.toFixed(2)}</div>
                </div>
            </div>
            <div class="resumen-card resumen-card-transferencia">
                <div class="resumen-card-header">
                    <span class="resumen-icon">💳</span>
                    <h4>TRANSFERENCIA</h4>
                </div>
                <div class="resumen-card-body">
                    <div class="valor">$${totalTransferencia.toFixed(2)}</div>
                </div>
            </div>
        `;
        
        // Agrupar ventas por nombre de cliente y fecha (sin importar cocina o pedido_id)
        const ventasPorCliente = {};
        ventas.forEach(venta => {
            const clave = `${venta.nombre_cliente}_${venta.pedido_fecha || venta.fecha}_${venta.medio_pago}`;
            if (!ventasPorCliente[clave]) {
                ventasPorCliente[clave] = {
                    nombre_cliente: venta.nombre_cliente,
                    pedidos_ids: new Set(),
                    items: [],
                    medio_pago: venta.medio_pago,
                    total: 0,
                    fecha: venta.pedido_fecha || venta.fecha,
                    foto_comprobante: venta.foto_comprobante
                };
            }
            ventasPorCliente[clave].items.push(venta);
            ventasPorCliente[clave].total += venta.total_producto;
            ventasPorCliente[clave].pedidos_ids.add(venta.pedido_id);
            // Guardar foto si existe
            if (venta.foto_comprobante && !ventasPorCliente[clave].foto_comprobante) {
                ventasPorCliente[clave].foto_comprobante = venta.foto_comprobante;
            }
        });
        
        // Separar por medio de pago
        const ventasEfectivo = [];
        const ventasTransferencia = [];
        
        Object.values(ventasPorCliente).forEach(venta => {
            if (venta.medio_pago === 'efectivo') {
                ventasEfectivo.push(venta);
            } else if (venta.medio_pago === 'transferencia') {
                ventasTransferencia.push(venta);
            }
        });
        
        // Ordenar por fecha (más recientes primero)
        ventasEfectivo.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        ventasTransferencia.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        // Mostrar ventas en efectivo
        const listaEfectivo = document.getElementById('ventas-efectivo-lista');
        listaEfectivo.innerHTML = '';
        
        if (ventasEfectivo.length === 0) {
            listaEfectivo.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">No hay ventas en efectivo</p>';
        } else {
            ventasEfectivo.slice(0, 100).forEach(venta => {
                const div = document.createElement('div');
                div.className = 'venta-item';
                const pedidosIds = Array.from(venta.pedidos_ids).join(', #');
                div.innerHTML = `
                    <div class="venta-header">
                        <span>${venta.nombre_cliente}</span>
                        <span>$${venta.total.toFixed(2)}</span>
                    </div>
                    <div class="venta-detalle">Fecha: ${new Date(venta.fecha).toLocaleString('es-ES')}</div>
                    <div class="venta-detalle">Pedido(s): #${pedidosIds}</div>
                    <div class="venta-detalle">💰 Efectivo</div>
                    <div style="margin-top: 10px;">
                        ${venta.items.map(item => `
                            <div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 0.9rem;">
                                <span>${item.es_promocion ? '🎁 ' : ''}${item.producto_nombre}${item.es_promocion ? '' : ` x${item.cantidad}`}</span>
                                <span>$${item.total_producto.toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
                listaEfectivo.appendChild(div);
            });
        }
        
        // Mostrar ventas por transferencia
        const listaTransferencia = document.getElementById('ventas-transferencia-lista');
        listaTransferencia.innerHTML = '';
        
        if (ventasTransferencia.length === 0) {
            listaTransferencia.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">No hay ventas por transferencia</p>';
        } else {
            ventasTransferencia.slice(0, 100).forEach(venta => {
                const div = document.createElement('div');
                div.className = 'venta-item';
                const pedidosIds = Array.from(venta.pedidos_ids).join(', #');
                div.innerHTML = `
                    <div class="venta-header">
                        <span>${venta.nombre_cliente}</span>
                        <span>$${venta.total.toFixed(2)}</span>
                    </div>
                <div class="venta-detalle">Fecha: ${new Date(venta.fecha).toLocaleString('es-ES')}</div>
                <div class="venta-detalle">Pedido(s): #${pedidosIds}</div>
                <div class="venta-detalle">💳 Transferencia</div>
                ${venta.items[0]?.foto_comprobante ? `
                    <div style="margin: 10px 0;">
                        <button class="btn-secondary" onclick="ampliarImagen('${venta.items[0].foto_comprobante}')" style="display: flex; align-items: center; gap: 8px; padding: 10px 16px;">
                            <span>📷</span>
                            <span>Ver Comprobante</span>
                        </button>
                    </div>
                ` : ''}
                <div style="margin-top: 10px;">
                    ${venta.items.map(item => `
                        <div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 0.9rem;">
                            <span>${item.es_promocion ? '🎁 ' : ''}${item.producto_nombre}${item.es_promocion ? '' : ` x${item.cantidad}`}</span>
                            <span>$${item.total_producto.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            listaTransferencia.appendChild(div);
            });
        }
        
        // Cargar también la vista de productos
        cargarVentasPorProductos();
    } catch (error) {
        console.error('Error cargando ventas:', error);
        mostrarMensaje('Error al cargar historial de ventas', 'error');
    }
}

async function cargarVentasPorProductos() {
    try {
        const productos = await fetch('/api/ventas/por-productos').then(r => r.json());
        
        // Separar productos por medio de pago
        const productosEfectivo = productos.filter(p => p.medio_pago === 'efectivo');
        const productosTransferencia = productos.filter(p => p.medio_pago === 'transferencia');
        
        // Agrupar por nombre de producto/promoción para sumar cantidades
        // Usar nombre como clave para que las promociones se agrupen correctamente
        const productosEfectivoAgrupados = {};
        productosEfectivo.forEach(p => {
            const clave = p.producto_nombre; // Usar nombre como clave única
            if (!productosEfectivoAgrupados[clave]) {
                productosEfectivoAgrupados[clave] = {
                    producto_id: p.producto_id,
                    producto_nombre: p.producto_nombre,
                    cantidad_total: 0,
                    precio_unitario: p.precio_unitario,
                    total_venta_producto: 0,
                    veces_vendido: 0,
                    es_promocion: p.es_promocion || 0
                };
            }
            productosEfectivoAgrupados[clave].cantidad_total += p.cantidad_total;
            productosEfectivoAgrupados[clave].total_venta_producto += p.total_venta_producto;
            productosEfectivoAgrupados[clave].veces_vendido += p.veces_vendido;
        });
        
        const productosTransferenciaAgrupados = {};
        productosTransferencia.forEach(p => {
            const clave = p.producto_nombre; // Usar nombre como clave única
            if (!productosTransferenciaAgrupados[clave]) {
                productosTransferenciaAgrupados[clave] = {
                    producto_id: p.producto_id,
                    producto_nombre: p.producto_nombre,
                    cantidad_total: 0,
                    precio_unitario: p.precio_unitario,
                    total_venta_producto: 0,
                    veces_vendido: 0,
                    es_promocion: p.es_promocion || 0
                };
            }
            productosTransferenciaAgrupados[clave].cantidad_total += p.cantidad_total;
            productosTransferenciaAgrupados[clave].total_venta_producto += p.total_venta_producto;
            productosTransferenciaAgrupados[clave].veces_vendido += p.veces_vendido;
        });
        
        // Ordenar por cantidad total
        const efectivoOrdenados = Object.values(productosEfectivoAgrupados).sort((a, b) => b.cantidad_total - a.cantidad_total);
        const transferenciaOrdenados = Object.values(productosTransferenciaAgrupados).sort((a, b) => b.cantidad_total - a.cantidad_total);
        
        // Mostrar productos en efectivo
        const listaEfectivo = document.getElementById('ventas-productos-efectivo-lista');
        listaEfectivo.innerHTML = '';
        
        if (efectivoOrdenados.length === 0) {
            listaEfectivo.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">No hay productos vendidos en efectivo</p>';
        } else {
            efectivoOrdenados.forEach(producto => {
                const div = document.createElement('div');
                div.className = 'venta-item';
                div.innerHTML = `
                    <div class="venta-header">
                        <span>${producto.es_promocion ? '🎁 ' : ''}${producto.producto_nombre}</span>
                        <span>$${producto.total_venta_producto.toFixed(2)}</span>
                    </div>
                    <div class="venta-detalle">${producto.es_promocion ? 'Cantidad: ' : 'Cantidad total: '}${producto.cantidad_total}${producto.es_promocion ? ' promociones' : ' unidades'}</div>
                    <div class="venta-detalle">Precio ${producto.es_promocion ? 'de promoción' : 'unitario'}: $${producto.precio_unitario.toFixed(2)}</div>
                    <div class="venta-detalle">Vendido en ${producto.veces_vendido} pedido(s)</div>
                `;
                listaEfectivo.appendChild(div);
            });
        }
        
        // Mostrar productos por transferencia
        const listaTransferencia = document.getElementById('ventas-productos-transferencia-lista');
        listaTransferencia.innerHTML = '';
        
        if (transferenciaOrdenados.length === 0) {
            listaTransferencia.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">No hay productos vendidos por transferencia</p>';
        } else {
            transferenciaOrdenados.forEach(producto => {
                const div = document.createElement('div');
                div.className = 'venta-item';
                div.innerHTML = `
                    <div class="venta-header">
                        <span>${producto.es_promocion ? '🎁 ' : ''}${producto.producto_nombre}</span>
                        <span>$${producto.total_venta_producto.toFixed(2)}</span>
                    </div>
                    <div class="venta-detalle">${producto.es_promocion ? 'Cantidad: ' : 'Cantidad total: '}${producto.cantidad_total}${producto.es_promocion ? ' promociones' : ' unidades'}</div>
                    <div class="venta-detalle">Precio ${producto.es_promocion ? 'de promoción' : 'unitario'}: $${producto.precio_unitario.toFixed(2)}</div>
                    <div class="venta-detalle">Vendido en ${producto.veces_vendido} pedido(s)</div>
                `;
                listaTransferencia.appendChild(div);
            });
        }
    } catch (error) {
        console.error('Error cargando ventas por productos:', error);
        mostrarMensaje('Error al cargar ventas por productos', 'error');
    }
}

async function cargarComprobantes() {
    try {
        const ventas = await fetch('/api/ventas').then(r => r.json());
        
        // Filtrar solo las ventas con foto de comprobante
        const ventasConFoto = ventas.filter(v => v.foto_comprobante && v.medio_pago === 'transferencia');
        
        // Agrupar por pedido para evitar duplicados
        const comprobantesUnicos = {};
        ventasConFoto.forEach(venta => {
            const clave = `${venta.pedido_id}_${venta.foto_comprobante}`;
            if (!comprobantesUnicos[clave]) {
                comprobantesUnicos[clave] = {
                    pedido_id: venta.pedido_id,
                    nombre_cliente: venta.nombre_cliente,
                    fecha: venta.fecha || venta.pedido_fecha,
                    foto_comprobante: venta.foto_comprobante,
                    total_venta: venta.total_venta
                };
            }
        });
        
        const lista = document.getElementById('comprobantes-lista');
        if (!lista) {
            console.error('No se encontró el elemento comprobantes-lista');
            return;
        }
        
        lista.innerHTML = '';
        
        if (Object.keys(comprobantesUnicos).length === 0) {
            lista.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 40px; grid-column: 1 / -1;">No hay comprobantes registrados</p>';
            return;
        }
        
        // Ordenar por fecha (más recientes primero)
        const comprobantesOrdenados = Object.values(comprobantesUnicos).sort((a, b) => 
            new Date(b.fecha) - new Date(a.fecha)
        );
        
        comprobantesOrdenados.forEach(comprobante => {
            const div = document.createElement('div');
            div.className = 'comprobante-card';
            div.style.cssText = 'background: var(--card-bg); border: 2px solid var(--border); border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.3s; box-shadow: var(--shadow-sm);';
            div.onclick = () => ampliarImagen(comprobante.foto_comprobante);
            div.onmouseenter = function() {
                this.style.transform = 'translateY(-4px)';
                this.style.boxShadow = 'var(--shadow-md)';
                this.style.borderColor = 'var(--primary-light)';
            };
            div.onmouseleave = function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'var(--shadow-sm)';
                this.style.borderColor = 'var(--border)';
            };
            
            div.innerHTML = `
                <div style="margin-bottom: 12px; border-radius: 8px; overflow: hidden; aspect-ratio: 1; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center;">
                    <img src="${comprobante.foto_comprobante}" alt="Comprobante" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 4px;">
                    ${new Date(comprobante.fecha).toLocaleDateString('es-ES')}
                </div>
                <div style="font-weight: 600; font-size: 0.95rem; color: var(--text); margin-bottom: 4px;">
                    ${comprobante.nombre_cliente}
                </div>
                <div style="font-size: 0.85rem; color: var(--primary); font-weight: 600;">
                    $${comprobante.total_venta.toFixed(2)}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 8px; text-align: center; padding-top: 8px; border-top: 1px solid var(--border);">
                    Pedido #${comprobante.pedido_id}
                </div>
            `;
            lista.appendChild(div);
        });
    } catch (error) {
        console.error('Error cargando comprobantes:', error);
        mostrarMensaje('Error al cargar comprobantes', 'error');
    }
}

// ========== GENERADOR PDF ==========
let datosVentasPDF = null;

async function generarVistaPreviaPDF() {
    try {
        const resumen = await fetch('/api/ventas/resumen').then(r => r.json());
        const ventas = await fetch('/api/ventas').then(r => r.json());
        const productos = await fetch('/api/ventas/por-productos').then(r => r.json());
        
        // Guardar datos para el PDF
        datosVentasPDF = { resumen, ventas, productos };
        
        // Generar vista previa HTML
        const preview = document.getElementById('pdf-preview');
        const previewContainer = document.getElementById('pdf-preview-container');
        
        const totalEfectivo = resumen.por_medio_pago?.find(r => r.medio_pago === 'efectivo')?.total_ventas || 0;
        const totalTransferencia = resumen.por_medio_pago?.find(r => r.medio_pago === 'transferencia')?.total_ventas || 0;
        const totalGeneral = resumen.total?.total_ventas || 0;
        
        // Agrupar ventas por pedido
        const ventasPorCliente = {};
        ventas.forEach(venta => {
            const clave = `${venta.nombre_cliente}_${venta.pedido_fecha || venta.fecha}_${venta.medio_pago}`;
            if (!ventasPorCliente[clave]) {
                ventasPorCliente[clave] = {
                    nombre_cliente: venta.nombre_cliente,
                    pedidos_ids: new Set(),
                    items: [],
                    medio_pago: venta.medio_pago,
                    total: 0,
                    fecha: venta.pedido_fecha || venta.fecha
                };
            }
            ventasPorCliente[clave].items.push(venta);
            ventasPorCliente[clave].total += venta.total_producto;
            ventasPorCliente[clave].pedidos_ids.add(venta.pedido_id);
        });
        
        const ventasArray = Object.values(ventasPorCliente).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        // Separar productos por medio de pago
        const productosEfectivo = productos.filter(p => p.medio_pago === 'efectivo');
        const productosTransferencia = productos.filter(p => p.medio_pago === 'transferencia');
        
        // Agrupar por nombre de producto/promoción para sumar cantidades
        // Usar nombre como clave para que las promociones se agrupen correctamente
        const productosEfectivoAgrupados = {};
        productosEfectivo.forEach(p => {
            const clave = p.producto_nombre; // Usar nombre como clave única
            if (!productosEfectivoAgrupados[clave]) {
                productosEfectivoAgrupados[clave] = {
                    producto_id: p.producto_id,
                    producto_nombre: p.producto_nombre,
                    cantidad_total: 0,
                    precio_unitario: p.precio_unitario,
                    total_venta_producto: 0,
                    es_promocion: p.es_promocion || 0
                };
            }
            productosEfectivoAgrupados[clave].cantidad_total += p.cantidad_total;
            productosEfectivoAgrupados[clave].total_venta_producto += p.total_venta_producto;
        });
        
        const productosTransferenciaAgrupados = {};
        productosTransferencia.forEach(p => {
            const clave = p.producto_nombre; // Usar nombre como clave única
            if (!productosTransferenciaAgrupados[clave]) {
                productosTransferenciaAgrupados[clave] = {
                    producto_id: p.producto_id,
                    producto_nombre: p.producto_nombre,
                    cantidad_total: 0,
                    precio_unitario: p.precio_unitario,
                    total_venta_producto: 0,
                    es_promocion: p.es_promocion || 0
                };
            }
            productosTransferenciaAgrupados[clave].cantidad_total += p.cantidad_total;
            productosTransferenciaAgrupados[clave].total_venta_producto += p.total_venta_producto;
        });
        
        const efectivoOrdenados = Object.values(productosEfectivoAgrupados).sort((a, b) => b.cantidad_total - a.cantidad_total);
        const transferenciaOrdenados = Object.values(productosTransferenciaAgrupados).sort((a, b) => b.cantidad_total - a.cantidad_total);
        
        let html = `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #4f46e5; padding-bottom: 20px;">
                    <h1 style="color: #4f46e5; margin: 0; font-size: 28px; font-weight: 700;">Ventas Cenáculo</h1>
                    <p style="color: #666; margin: 5px 0; font-size: 14px; font-weight: 600;">Reporte de Ventas</p>
                    <p style="color: #999; font-size: 12px; margin: 5px 0;">Generado: ${new Date().toLocaleString('es-ES')}</p>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <h2 style="color: #4f46e5; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-weight: 700;">Resumen General</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <tr style="background: #f8fafc;">
                            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600;">Total Pedidos</td>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${resumen.total?.total_pedidos || 0}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600;">Total Ventas</td>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700; font-size: 18px;">$${totalGeneral.toFixed(2)}</td>
                        </tr>
                        <tr style="background: #f8fafc;">
                            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600;">Efectivo</td>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700;">$${totalEfectivo.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600;">Transferencia</td>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700;">$${totalTransferencia.toFixed(2)}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <h2 style="color: #4f46e5; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-weight: 700;">Ventas por Producto - Efectivo</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background: #4f46e5; color: white;">
                                <th style="padding: 10px; border: 1px solid #4338ca; text-align: left; font-weight: 700;">Producto</th>
                                <th style="padding: 10px; border: 1px solid #4338ca; text-align: right; font-weight: 700;">Cantidad</th>
                                <th style="padding: 10px; border: 1px solid #4338ca; text-align: right; font-weight: 700;">Precio Unit.</th>
                                <th style="padding: 10px; border: 1px solid #4338ca; text-align: right; font-weight: 700;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        efectivoOrdenados.forEach((producto, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            const nombreDisplay = producto.es_promocion ? `🎁 ${producto.producto_nombre}` : producto.producto_nombre;
            const cantidadDisplay = producto.es_promocion ? `${producto.cantidad_total} promociones` : `${producto.cantidad_total} unidades`;
            const precioLabel = producto.es_promocion ? 'Precio Promo' : 'Precio Unit.';
            html += `
                <tr style="background: ${bgColor};">
                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;">${nombreDisplay}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">${cantidadDisplay}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">$${producto.precio_unitario.toFixed(2)}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">$${producto.total_venta_producto.toFixed(2)}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                    ${efectivoOrdenados.length === 0 ? '<p style="text-align: center; color: #999; padding: 20px;">No hay productos vendidos en efectivo</p>' : ''}
                </div>
                
                <div style="margin-bottom: 30px;">
                    <h2 style="color: #4f46e5; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-weight: 700;">Ventas por Producto - Transferencia</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background: #4f46e5; color: white;">
                                <th style="padding: 10px; border: 1px solid #4338ca; text-align: left; font-weight: 700;">Producto</th>
                                <th style="padding: 10px; border: 1px solid #4338ca; text-align: right; font-weight: 700;">Cantidad</th>
                                <th style="padding: 10px; border: 1px solid #4338ca; text-align: right; font-weight: 700;">Precio Unit.</th>
                                <th style="padding: 10px; border: 1px solid #4338ca; text-align: right; font-weight: 700;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        transferenciaOrdenados.forEach((producto, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            const nombreDisplay = producto.es_promocion ? `🎁 ${producto.producto_nombre}` : producto.producto_nombre;
            const cantidadDisplay = producto.es_promocion ? `${producto.cantidad_total} promociones` : `${producto.cantidad_total} unidades`;
            const precioLabel = producto.es_promocion ? 'Precio Promo' : 'Precio Unit.';
            html += `
                <tr style="background: ${bgColor};">
                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;">${nombreDisplay}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">${cantidadDisplay}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">$${producto.precio_unitario.toFixed(2)}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">$${producto.total_venta_producto.toFixed(2)}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                    ${transferenciaOrdenados.length === 0 ? '<p style="text-align: center; color: #999; padding: 20px;">No hay productos vendidos por transferencia</p>' : ''}
                </div>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; color: #999; font-size: 11px;">
                    <p>Reporte generado el ${new Date().toLocaleString('es-ES')}</p>
                    <p>Ventas Cenáculo - Sistema de Gestión de Ventas</p>
                </div>
            </div>
        `;
        
        preview.innerHTML = html;
        previewContainer.style.display = 'block';
        
        mostrarMensaje('Vista previa generada', 'success');
    } catch (error) {
        console.error('Error generando vista previa:', error);
        mostrarMensaje('Error al generar vista previa', 'error');
    }
}

function descargarPDF() {
    if (!datosVentasPDF) {
        mostrarMensaje('Primero genera la vista previa', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const { resumen, ventas, productos } = datosVentasPDF;
        
        const totalEfectivo = resumen.por_medio_pago?.find(r => r.medio_pago === 'efectivo')?.total_ventas || 0;
        const totalTransferencia = resumen.por_medio_pago?.find(r => r.medio_pago === 'transferencia')?.total_ventas || 0;
        const totalGeneral = resumen.total?.total_ventas || 0;
        
        // Título
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229);
        doc.text('Ventas Cenáculo', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text('Reporte de Ventas', 105, 28, { align: 'center' });
        doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 105, 34, { align: 'center' });
        
        let yPos = 45;
        
        // Resumen
        doc.setFontSize(16);
        doc.setTextColor(79, 70, 229);
        doc.text('Resumen General', 14, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        const resumenData = [
            ['Total Pedidos', `${resumen.total?.total_pedidos || 0}`],
            ['Total Ventas', `$${totalGeneral.toFixed(2)}`],
            ['Efectivo', `$${totalEfectivo.toFixed(2)}`],
            ['Transferencia', `$${totalTransferencia.toFixed(2)}`]
        ];
        
        doc.autoTable({
            startY: yPos,
            head: [['Concepto', 'Valor']],
            body: resumenData,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 },
            styles: { fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
        });
        
        yPos = doc.lastAutoTable.finalY + 15;
        
        // Separar productos por medio de pago
        const productosEfectivo = productos.filter(p => p.medio_pago === 'efectivo');
        const productosTransferencia = productos.filter(p => p.medio_pago === 'transferencia');
        
        // Agrupar por nombre de producto
        const productosEfectivoAgrupados = {};
        productosEfectivo.forEach(p => {
            if (!productosEfectivoAgrupados[p.producto_id]) {
                productosEfectivoAgrupados[p.producto_id] = {
                    producto_id: p.producto_id,
                    producto_nombre: p.producto_nombre,
                    cantidad_total: 0,
                    precio_unitario: p.precio_unitario,
                    total_venta_producto: 0
                };
            }
            productosEfectivoAgrupados[p.producto_id].cantidad_total += p.cantidad_total;
            productosEfectivoAgrupados[p.producto_id].total_venta_producto += p.total_venta_producto;
        });
        
        const productosTransferenciaAgrupados = {};
        productosTransferencia.forEach(p => {
            if (!productosTransferenciaAgrupados[p.producto_id]) {
                productosTransferenciaAgrupados[p.producto_id] = {
                    producto_id: p.producto_id,
                    producto_nombre: p.producto_nombre,
                    cantidad_total: 0,
                    precio_unitario: p.precio_unitario,
                    total_venta_producto: 0
                };
            }
            productosTransferenciaAgrupados[p.producto_id].cantidad_total += p.cantidad_total;
            productosTransferenciaAgrupados[p.producto_id].total_venta_producto += p.total_venta_producto;
        });
        
        const efectivoOrdenados = Object.values(productosEfectivoAgrupados).sort((a, b) => b.cantidad_total - a.cantidad_total);
        const transferenciaOrdenados = Object.values(productosTransferenciaAgrupados).sort((a, b) => b.cantidad_total - a.cantidad_total);
        
        // Ventas por Producto - Efectivo
        doc.setFontSize(16);
        doc.setTextColor(79, 70, 229);
        doc.text('Ventas por Producto - Efectivo', 14, yPos);
        yPos += 10;
        
        const efectivoTableData = efectivoOrdenados.map(producto => [
            producto.producto_nombre,
            producto.cantidad_total.toString(),
            `$${producto.precio_unitario.toFixed(2)}`,
            `$${producto.total_venta_producto.toFixed(2)}`
        ]);
        
        doc.autoTable({
            startY: yPos,
            head: [['Producto', 'Cantidad', 'Precio Unit.', 'Total']],
            body: efectivoTableData,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 },
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 30, halign: 'right' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
            }
        });
        
        yPos = doc.lastAutoTable.finalY + 15;
        
        // Nueva página si es necesario
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        
        // Ventas por Producto - Transferencia
        doc.setFontSize(16);
        doc.setTextColor(79, 70, 229);
        doc.text('Ventas por Producto - Transferencia', 14, yPos);
        yPos += 10;
        
        const transferenciaTableData = transferenciaOrdenados.map(producto => [
            producto.producto_nombre,
            producto.cantidad_total.toString(),
            `$${producto.precio_unitario.toFixed(2)}`,
            `$${producto.total_venta_producto.toFixed(2)}`
        ]);
        
        doc.autoTable({
            startY: yPos,
            head: [['Producto', 'Cantidad', 'Precio Unit.', 'Total']],
            body: transferenciaTableData,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 },
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 30, halign: 'right' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
            }
        });
        
        // Pie de página
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
            doc.text('Ventas Cenáculo - Sistema de Gestión de Ventas', 105, 290, { align: 'center' });
        }
        
        // Descargar
        const fecha = new Date().toISOString().split('T')[0];
        doc.save(`Reporte_Ventas_${fecha}.pdf`);
        
        mostrarMensaje('PDF descargado exitosamente', 'success');
    } catch (error) {
        console.error('Error generando PDF:', error);
        mostrarMensaje('Error al generar PDF', 'error');
    }
}

async function generarVistaPreviaEstadisticas() {
    try {
        const resumen = await fetch('/api/ventas/resumen').then(r => r.json());
        const ventas = await fetch('/api/ventas').then(r => r.json());
        const productos = await fetch('/api/ventas/por-productos').then(r => r.json());
        
        // Calcular estadísticas
        calcularEstadisticas(resumen, ventas, productos);
        
        if (!window.estadisticasPDF) {
            mostrarMensaje('Error calculando estadísticas', 'error');
            return;
        }
        
        const stats = window.estadisticasPDF;
        const totalEfectivo = resumen.por_medio_pago?.find(r => r.medio_pago === 'efectivo')?.total_ventas || 0;
        const totalTransferencia = resumen.por_medio_pago?.find(r => r.medio_pago === 'transferencia')?.total_ventas || 0;
        const totalGeneral = resumen.total?.total_ventas || 0;
        const totalPedidos = resumen.total?.total_pedidos || 0;
        
        const preview = document.getElementById('estadisticas-preview');
        const previewContainer = document.getElementById('estadisticas-preview-container');
        
        if (!preview || !previewContainer) return;
        
        preview.innerHTML = `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #8b5cf6; padding-bottom: 20px;">
                    <h1 style="color: #8b5cf6; margin: 0; font-size: 28px; font-weight: 700;">Ventas Cenáculo</h1>
                    <p style="color: #666; margin: 5px 0; font-size: 14px; font-weight: 600;">Reporte de Estadísticas</p>
                    <p style="color: #999; font-size: 12px; margin: 5px 0;">Generado: ${new Date().toLocaleString('es-ES')}</p>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <h2 style="color: #8b5cf6; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-weight: 700;">Resumen General</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <tr style="background: #f8fafc;">
                            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600;">Total Pedidos</td>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${totalPedidos}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600;">Total Ventas</td>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700; font-size: 18px;">$${totalGeneral.toFixed(2)}</td>
                        </tr>
                        <tr style="background: #f8fafc;">
                            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600;">Efectivo</td>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700;">$${totalEfectivo.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: 600;">Transferencia</td>
                            <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: 700;">$${totalTransferencia.toFixed(2)}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <h2 style="color: #8b5cf6; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-weight: 700;">Estadísticas de Ventas</h2>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 15px;">
                        <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Total Productos Vendidos</div>
                            <div style="font-size: 1.3rem; font-weight: 700; color: #8b5cf6;">${stats.totalProductosVendidos}</div>
                        </div>
                        <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Promedio por Pedido</div>
                            <div style="font-size: 1.3rem; font-weight: 700; color: #10b981;">$${stats.promedioVentaPorPedido.toFixed(2)}</div>
                        </div>
                        <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Promedio Productos/Pedido</div>
                            <div style="font-size: 1.3rem; font-weight: 700; color: #8b5cf6;">${stats.promedioProductosPorPedido.toFixed(1)}</div>
                        </div>
                        <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">% Efectivo / Transferencia</div>
                            <div style="font-size: 1.1rem; font-weight: 700; color: #f59e0b;">${stats.porcentajeEfectivo.toFixed(1)}% / ${stats.porcentajeTransferencia.toFixed(1)}%</div>
                        </div>
                    </div>
                    ${stats.productoMasVendido ? `
                    <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
                        <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Producto Más Vendido</div>
                        <div style="font-size: 1rem; font-weight: 600; color: #0f172a;">${stats.productoMasVendido.producto_nombre}</div>
                        <div style="font-size: 0.9rem; color: #64748b;">${stats.productoMasVendido.cantidad_total} unidades</div>
                    </div>
                    ` : ''}
                    ${stats.productoMasIngresos ? `
                    <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
                        <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Producto Más Ingresos</div>
                        <div style="font-size: 1rem; font-weight: 600; color: #0f172a;">${stats.productoMasIngresos.producto_nombre}</div>
                        <div style="font-size: 0.9rem; color: #64748b;">$${stats.productoMasIngresos.total_venta.toFixed(2)}</div>
                    </div>
                    ` : ''}
                    ${stats.productoMasVendidoEfectivo ? `
                    <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
                        <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Más Vendido (Efectivo)</div>
                        <div style="font-size: 1rem; font-weight: 600; color: #0f172a;">${stats.productoMasVendidoEfectivo.producto_nombre}</div>
                        <div style="font-size: 0.9rem; color: #64748b;">${stats.productoMasVendidoEfectivo.cantidad_total} unidades</div>
                    </div>
                    ` : ''}
                    ${stats.productoMasVendidoTransferencia ? `
                    <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Más Vendido (Transferencia)</div>
                        <div style="font-size: 1rem; font-weight: 600; color: #0f172a;">${stats.productoMasVendidoTransferencia.producto_nombre}</div>
                        <div style="font-size: 0.9rem; color: #64748b;">${stats.productoMasVendidoTransferencia.cantidad_total} unidades</div>
                    </div>
                    ` : ''}
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0; color: #999; font-size: 12px;">
                    <p>Reporte generado el ${new Date().toLocaleString('es-ES')}</p>
                    <p>Ventas Cenáculo - Sistema de Gestión de Ventas</p>
                </div>
            </div>
        `;
        
        previewContainer.style.display = 'block';
    } catch (error) {
        console.error('Error generando vista previa de estadísticas:', error);
        mostrarMensaje('Error al generar vista previa de estadísticas', 'error');
    }
}

async function descargarEstadisticasPDF() {
    try {
        const resumen = await fetch('/api/ventas/resumen').then(r => r.json());
        const ventas = await fetch('/api/ventas').then(r => r.json());
        const productos = await fetch('/api/ventas/por-productos').then(r => r.json());
        
        // Calcular estadísticas
        calcularEstadisticas(resumen, ventas, productos);
        
        if (!window.estadisticasPDF) {
            mostrarMensaje('Error calculando estadísticas', 'error');
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const stats = window.estadisticasPDF;
        
        const totalEfectivo = resumen.por_medio_pago?.find(r => r.medio_pago === 'efectivo')?.total_ventas || 0;
        const totalTransferencia = resumen.por_medio_pago?.find(r => r.medio_pago === 'transferencia')?.total_ventas || 0;
        const totalGeneral = resumen.total?.total_ventas || 0;
        const totalPedidos = resumen.total?.total_pedidos || 0;
        
        // Título
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229);
        doc.text('Ventas Cenáculo', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text('Reporte de Estadísticas', 105, 28, { align: 'center' });
        doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 105, 34, { align: 'center' });
        
        let yPos = 45;
        
        // Resumen General
        doc.setFontSize(16);
        doc.setTextColor(79, 70, 229);
        doc.text('Resumen General', 14, yPos);
        yPos += 10;
        
        const resumenData = [
            ['Total Pedidos', `${totalPedidos}`],
            ['Total Ventas', `$${totalGeneral.toFixed(2)}`],
            ['Efectivo', `$${totalEfectivo.toFixed(2)}`],
            ['Transferencia', `$${totalTransferencia.toFixed(2)}`]
        ];
        
        doc.autoTable({
            startY: yPos,
            head: [['Concepto', 'Valor']],
            body: resumenData,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 },
            styles: { fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
        });
        
        yPos = doc.lastAutoTable.finalY + 15;
        
        // Estadísticas
        doc.setFontSize(16);
        doc.setTextColor(79, 70, 229);
        doc.text('Estadísticas de Ventas', 14, yPos);
        yPos += 10;
        
        const estadisticasData = [
            ['Total Productos Vendidos', `${stats.totalProductosVendidos}`],
            ['Promedio de Venta por Pedido', `$${stats.promedioVentaPorPedido.toFixed(2)}`],
            ['Promedio Productos por Pedido', `${stats.promedioProductosPorPedido.toFixed(1)}`],
            ['Porcentaje Efectivo', `${stats.porcentajeEfectivo.toFixed(1)}%`],
            ['Porcentaje Transferencia', `${stats.porcentajeTransferencia.toFixed(1)}%`]
        ];
        
        if (stats.productoMasVendido) {
            estadisticasData.push(['Producto Más Vendido', `${stats.productoMasVendido.producto_nombre} (${stats.productoMasVendido.cantidad_total} unidades)`]);
        }
        
        if (stats.productoMasIngresos) {
            estadisticasData.push(['Producto Más Ingresos', `${stats.productoMasIngresos.producto_nombre} ($${stats.productoMasIngresos.total_venta.toFixed(2)})`]);
        }
        
        if (stats.productoMasVendidoEfectivo) {
            estadisticasData.push(['Más Vendido (Efectivo)', `${stats.productoMasVendidoEfectivo.producto_nombre} (${stats.productoMasVendidoEfectivo.cantidad_total} unidades)`]);
        }
        
        if (stats.productoMasVendidoTransferencia) {
            estadisticasData.push(['Más Vendido (Transferencia)', `${stats.productoMasVendidoTransferencia.producto_nombre} (${stats.productoMasVendidoTransferencia.cantidad_total} unidades)`]);
        }
        
        doc.autoTable({
            startY: yPos,
            head: [['Indicador', 'Valor']],
            body: estadisticasData,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 },
            styles: { fontSize: 9 },
            columnStyles: { 
                0: { fontStyle: 'bold', cellWidth: 80 }, 
                1: { halign: 'left', cellWidth: 100 } 
            }
        });
        
        // Pie de página
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
            doc.text('Ventas Cenáculo - Sistema de Gestión de Ventas', 105, 290, { align: 'center' });
        }
        
        // Descargar
        const fecha = new Date().toISOString().split('T')[0];
        doc.save(`Estadisticas_Ventas_${fecha}.pdf`);
        
        mostrarMensaje('Estadísticas descargadas exitosamente', 'success');
    } catch (error) {
        console.error('Error generando estadísticas PDF:', error);
        mostrarMensaje('Error al generar estadísticas', 'error');
    }
}

// ========== NOTIFICACIONES ==========
async function actualizarNotificaciones() {
    if (!estado.perfilActual || estado.perfilActual === 'ventas') return;
    
    try {
        const notificaciones = await fetch(`/api/notificaciones/${estado.perfilActual}`).then(r => r.json());
        const badge = document.getElementById(`${estado.perfilActual}-notif-badge`);
        
        if (badge) {
            if (notificaciones.length > 0) {
                badge.textContent = notificaciones.length;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error actualizando notificaciones:', error);
    }
}

// ========== UTILIDADES ==========
function mostrarMensaje(mensaje, tipo) {
    // Crear elemento de mensaje
    const mensajeDiv = document.createElement('div');
    mensajeDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${tipo === 'success' ? 'var(--success)' : 'var(--danger)'};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 20000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
        max-width: 90%;
        text-align: center;
        white-space: pre-line;
        font-weight: 500;
        line-height: 1.5;
    `;
    mensajeDiv.textContent = mensaje;
    
    document.body.appendChild(mensajeDiv);
    
    // Duración más larga para mensajes importantes
    const duracion = mensaje.includes('✅') || mensaje.includes('Cierre') ? 5000 : 3000;
    
    setTimeout(() => {
        mensajeDiv.style.opacity = '0';
        mensajeDiv.style.transition = 'opacity 0.3s';
        setTimeout(() => mensajeDiv.remove(), 300);
    }, duracion);
}

// Asegurar que todas las funciones estén disponibles globalmente
// Funciones eliminadas - ahora se usa el sistema de carrito
window.mostrarTab = mostrarTab;
window.mostrarFormProducto = mostrarFormProducto;
window.cerrarModal = cerrarModal;
window.guardarProducto = guardarProducto;
window.editarProducto = editarProducto;
window.actualizarEstadoPedido = actualizarEstadoPedido;
window.descontarBotella = descontarBotella;
window.marcarEntregado = marcarEntregado;
window.mostrarTabVentas = mostrarTabVentas;
window.confirmarCocina = confirmarCocina;
window.cambiarCocina = cambiarCocina;
window.mostrarGestionProductos = mostrarGestionProductos;
window.ocultarGestionProductos = ocultarGestionProductos;
window.mostrarHistorialDespacho = mostrarHistorialDespacho;
window.ocultarHistorialDespacho = ocultarHistorialDespacho;
window.actualizarTipoStock = actualizarTipoStock;
window.modificarCantidadEmpanadas = modificarCantidadEmpanadas;
window.seleccionarRubro = seleccionarRubro;
window.volverRubros = volverRubros;
window.seleccionarPresentacionBebida = seleccionarPresentacionBebida;
window.seleccionarTipoBebida = seleccionarTipoBebida;
window.seleccionarSaborBebida = seleccionarSaborBebida;
window.volverFiltroPresentacion = volverFiltroPresentacion;
window.volverFiltroTipo = volverFiltroTipo;
window.agregarAlCarrito = agregarAlCarrito;
window.mostrarCarrito = mostrarCarrito;
window.eliminarDelCarrito = eliminarDelCarrito;
// agregarPromoAlCarrito ya no se usa - las promos se agregan desde el modal
window.mostrarPago = mostrarPago;
window.seleccionarPago = seleccionarPago;
window.volverCarrito = volverCarrito;
// Función volverPago eliminada - ya no se necesita vista separada
window.iniciarCamara = iniciarCamara;
window.capturarFoto = capturarFoto;
window.repetirFoto = repetirFoto;
window.omitirFoto = omitirFoto;
window.finalizarPedido = finalizarPedido;
window.mostrarModalPromoEspecial = mostrarModalPromoEspecial;
window.ocultarModalPromoEspecial = ocultarModalPromoEspecial;
window.guardarPromoEspecial = guardarPromoEspecial;
window.modificarProductoPromo = modificarProductoPromo;

function ampliarImagen(src) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 2000; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%;">
            <img src="${src}" style="max-width: 100%; max-height: 100%; border-radius: 8px;">
            <button onclick="this.parentElement.parentElement.remove()" style="position: absolute; top: -40px; right: 0; background: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-size: 1.5rem; cursor: pointer;">×</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

window.ampliarImagen = ampliarImagen;
window.generarVistaPreviaPDF = generarVistaPreviaPDF;
window.descargarPDF = descargarPDF;
window.descargarEstadisticasPDF = descargarEstadisticasPDF;
window.generarVistaPreviaEstadisticas = generarVistaPreviaEstadisticas;

// Verificar que el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM cargado, funciones disponibles');
    });
} else {
    console.log('DOM ya cargado, funciones disponibles');
}

// ========== FUNCIONES DE CIERRE DE DÍA ==========
function abrirModalCierreDia() {
    const modal = document.getElementById('modal-cierre-dia');
    const input = document.getElementById('palabra-clave-cierre-dia');
    
    if (!modal) {
        console.error('Modal de cierre de día no encontrado');
        mostrarMensaje('Error: Modal no encontrado', 'error');
        return;
    }
    
    if (input) {
        input.value = '';
        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                procesarCierreDia();
            }
        };
    }
    
    modal.classList.add('active');
    setTimeout(() => {
        if (input) input.focus();
    }, 100);
}

function cerrarModalCierreDia() {
    const modal = document.getElementById('modal-cierre-dia');
    const input = document.getElementById('palabra-clave-cierre-dia');
    
    if (modal) modal.classList.remove('active');
    if (input) input.value = '';
}

async function procesarCierreDia() {
    try {
        const input = document.getElementById('palabra-clave-cierre-dia');
        if (!input) {
            mostrarMensaje('Error: Campo no encontrado', 'error');
            return;
        }
        
        const palabraClave = input.value.trim();
        if (!palabraClave) {
            mostrarMensaje('Por favor ingresa la palabra clave', 'error');
            input.focus();
            return;
        }
        
        mostrarMensaje('Generando cierre de día...', 'success');
        
        const response = await fetch('/api/cierre-dia', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-rol': 'atencion'
            },
            body: JSON.stringify({ palabra_clave: palabraClave })
        });
        
        if (response.ok) {
            const data = await response.json();
            cerrarModalCierreDia();
            
            if (data.pdf_url) {
                mostrarMensaje('✅ Cierre de día realizado. Descargando PDF...', 'success');
                window.open(data.pdf_url, '_blank');
            } else {
                mostrarMensaje('✅ Cierre de día realizado exitosamente', 'success');
            }
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al procesar cierre de día');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje(error.message || 'Error al procesar el cierre de día', 'error');
    }
}

// ========== FUNCIONES DE MANEJO DE ARCHIVOS ==========
function manejarArchivoComprobante(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        mostrarMensaje('Por favor selecciona una imagen', 'error');
        return;
    }
    
    estadoVendedor.fotoComprobante = file;
    
    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('foto-preview');
        if (preview) {
            preview.innerHTML = `
                <img src="${e.target.result}" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 2px solid var(--border);">
                <p style="margin-top: 10px; color: var(--text-secondary);">Foto seleccionada</p>
            `;
        }
        document.getElementById('btn-finalizar-transferencia').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// Exportar funciones globalmente
window.abrirModalCierreDia = abrirModalCierreDia;
window.cerrarModalCierreDia = cerrarModalCierreDia;
window.procesarCierreDia = procesarCierreDia;
window.manejarArchivoComprobante = manejarArchivoComprobante;


