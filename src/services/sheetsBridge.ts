import { FactVentaRow } from '../types';

/**
 * Convierte una fecha JS al número de serie de Excel (donde 2024-01-01 = 45292, compatible con dim_fecha)
 */
export function getExcelSerialDate(date: Date = new Date()): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const excelEpoch = Date.UTC(1899, 11, 30);
  return Math.floor((utc - excelEpoch) / (1000 * 60 * 60 * 24));
}

/**
 * Formatea la hora exactamente como en fact_ventas de pizza model.xlsx: "7:45:12 p. m."
 */
export function getFormattedExcelTime(date: Date = new Date()): string {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const isPM = hours >= 12;
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes}:${seconds} ${isPM ? 'p. m.' : 'a. m.'}`;
}

/**
 * Envía una o varias filas a la hoja fact_ventas en Google Sheets mediante el Google Apps Script Web App
 */
export async function syncRowsToGoogleSheets(
  scriptUrl: string,
  rows: FactVentaRow[]
): Promise<{ ok: boolean; message: string; insertedAtRow?: number }> {
  if (!scriptUrl || !scriptUrl.trim().startsWith('https://script.google.com')) {
    return {
      ok: false,
      message: 'URL de Google Apps Script no configurada aún (guardado en memoria local y listo para exportar).'
    };
  }

  try {
    const payload = {
      rows: rows.map((r) => ({
        order_id: r.order_id,
        date: r.date,
        time: r.time,
        city_id: r.city_id,
        salechannel_id: r.salechannel_id,
        quantity: r.quantity,
        pizza_id: r.pizza_id
      }))
    };

    // Usamos text/plain para evitar que el navegador dispare un preflight OPTIONS bloqueado por CORS en Apps Script
    const response = await fetch(scriptUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data && data.ok) {
      return {
        ok: true,
        message: `¡Sincronizado en Google Sheets (fact_ventas fila ${data.insertedAtRow})!`,
        insertedAtRow: data.insertedAtRow
      };
    }
    return {
      ok: false,
      message: data?.error || 'Respuesta inesperada del script.'
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `Error de red al conectar con Apps Script: ${err?.message || String(err)}`
    };
  }
}

/**
 * Descarga las filas como archivo CSV con las 7 columnas exactas de fact_ventas
 */
export function downloadFactVentasCSV(rows: FactVentaRow[], filename = 'fact_ventas_nuevos_pedidos.csv') {
  const headers = ['order_id', 'date', 'time', 'city_id', 'salechannel_id', 'quantity', 'pizza_id'];
  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      [r.order_id, r.date, `"${r.time}"`, r.city_id, r.salechannel_id, r.quantity, r.pizza_id].join(',')
    )
  ];
  const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
