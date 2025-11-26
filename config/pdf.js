const PDFDocument = require('pdfkit');
const moment = require('moment-timezone');
require('dotenv').config();

// Configuración
const TIMEZONE = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';
const NOMBRE_NEGOCIO = process.env.NOMBRE_NEGOCIO || 'Cenáculo';
const MONEDA = process.env.MONEDA || 'ARS';

// Generar PDF de reporte de ventas
async function generarReporteVentas(datos) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Encabezado
      doc.fontSize(20).text(NOMBRE_NEGOCIO, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).text('Reporte de Ventas', { align: 'center' });
      doc.moveDown(0.5);
      
      const fecha = moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm');
      doc.fontSize(10).text(`Fecha: ${fecha}`, { align: 'center' });
      doc.moveDown(1);

      // Resumen general
      doc.fontSize(12).text('RESUMEN GENERAL', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10);
      doc.text(`Total de Ventas: $${datos.total_ventas.toFixed(2)}`, { continued: false });
      doc.text(`Total Efectivo: $${datos.total_efectivo.toFixed(2)}`, { continued: false });
      doc.text(`Total Transferencias: $${datos.total_transferencias.toFixed(2)}`, { continued: false });
      doc.text(`Total de Pedidos: ${datos.total_pedidos}`, { continued: false });
      doc.moveDown(1);

      // Ventas por producto
      if (datos.ventas_por_producto && datos.ventas_por_producto.length > 0) {
        doc.fontSize(12).text('VENTAS POR PRODUCTO', { underline: true });
        doc.moveDown(0.3);
        
        // Encabezado de tabla
        doc.fontSize(9);
        const tableTop = doc.y;
        doc.text('Producto', 50, tableTop);
        doc.text('Cantidad', 250, tableTop);
        doc.text('Total', 350, tableTop, { width: 100, align: 'right' });
        
        let y = tableTop + 20;
        datos.ventas_por_producto.forEach(item => {
          if (y > 700) {
            doc.addPage();
            y = 50;
          }
          doc.text(item.producto_nombre, 50, y, { width: 200 });
          doc.text(item.cantidad.toString(), 250, y);
          doc.text(`$${item.total.toFixed(2)}`, 350, y, { width: 100, align: 'right' });
          y += 15;
        });
        doc.moveDown(1);
      }

      // Stock final
      if (datos.stock_final && datos.stock_final.length > 0) {
        doc.addPage();
        doc.fontSize(12).text('STOCK FINAL POR PRODUCTO', { underline: true });
        doc.moveDown(0.3);
        
        const tableTop = doc.y;
        doc.fontSize(9);
        doc.text('Producto', 50, tableTop);
        doc.text('Stock Final', 250, tableTop);
        doc.text('Unidad', 350, tableTop);
        
        let y = tableTop + 20;
        datos.stock_final.forEach(item => {
          if (y > 700) {
            doc.addPage();
            y = 50;
          }
          doc.text(item.nombre, 50, y, { width: 200 });
          doc.text(item.stock.toString(), 250, y);
          doc.text(item.unidad_venta || 'unidad', 350, y);
          y += 15;
        });
      }

      // Pie de página
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
          .text(
            `Página ${i + 1} de ${totalPages} - Generado el ${fecha}`,
            50,
            doc.page.height - 30,
            { align: 'center' }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Generar PDF de cierre de día
async function generarCierreDia(datos) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Encabezado
      doc.fontSize(20).text(NOMBRE_NEGOCIO, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).text('CIERRE DEL DÍA', { align: 'center' });
      doc.moveDown(0.5);
      
      const fecha = moment(datos.fecha).tz(TIMEZONE).format('DD/MM/YYYY');
      doc.fontSize(12).text(`Fecha: ${fecha}`, { align: 'center' });
      doc.moveDown(1);

      // Resumen financiero
      doc.fontSize(14).text('RESUMEN FINANCIERO', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`Total de Ventas: $${datos.total_ventas.toFixed(2)}`, { continued: false });
      doc.text(`Total Efectivo: $${datos.total_efectivo.toFixed(2)}`, { continued: false });
      doc.text(`Total Transferencias: $${datos.total_transferencias.toFixed(2)}`, { continued: false });
      doc.text(`Total de Pedidos: ${datos.total_pedidos}`, { continued: false });
      doc.moveDown(1);

      // Detalle de pedidos
      if (datos.pedidos && datos.pedidos.length > 0) {
        doc.fontSize(12).text('DETALLE DE PEDIDOS', { underline: true });
        doc.moveDown(0.3);
        
        datos.pedidos.forEach((pedido, index) => {
          if (doc.y > 700) {
            doc.addPage();
          }
          doc.fontSize(10);
          doc.text(`${index + 1}. ${pedido.nombre_cliente} - $${pedido.total.toFixed(2)} (${pedido.medio_pago})`, {
            continued: false
          });
        });
        doc.moveDown(1);
      }

      // Stock final y sobrantes
      if (datos.stock_final) {
        doc.addPage();
        doc.fontSize(12).text('STOCK FINAL Y SOBRANTES', { underline: true });
        doc.moveDown(0.3);
        
        const tableTop = doc.y;
        doc.fontSize(9);
        doc.text('Producto', 50, tableTop);
        doc.text('Stock Final', 250, tableTop);
        doc.text('Unidad', 350, tableTop);
        
        let y = tableTop + 20;
        datos.stock_final.forEach(item => {
          if (y > 700) {
            doc.addPage();
            y = 50;
          }
          doc.text(item.nombre, 50, y, { width: 200 });
          doc.text(item.stock.toString(), 250, y);
          doc.text(item.unidad_venta || 'unidad', 350, y);
          y += 15;
        });
      }

      // Pie de página
      const fechaCierre = moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm');
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fontSize(8)
          .text(
            `Página ${i + 1} de ${totalPages} - Cerrado el ${fechaCierre} por ${datos.cerrado_por || 'Sistema'}`,
            50,
            doc.page.height - 30,
            { align: 'center' }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generarReporteVentas,
  generarCierreDia
};

