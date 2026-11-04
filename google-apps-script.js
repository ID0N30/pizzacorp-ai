// ============================================================================
// PUENTE GOOGLE SHEETS <-> WEB IA (PIZZA MODEL - PROF. TAMAYO)
// Pega este código en Extensiones -> Apps Script y dale a:
// Implementar -> Nueva implementación -> Aplicación web -> Acceso: "Cualquier persona"
// ============================================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("fact_ventas");
    var data = JSON.parse(e.postData.contents);
    var rows = data.rows || [data];
    var colA = sheet.getRange("A:A").getValues();
    var nextRow = 1;
    for (var i = colA.length - 1; i >= 0; i--) {
      if (colA[i][0] !== "" && colA[i][0] !== null) { nextRow = i + 2; break; }
    }
    var values = rows.map(function(r) {
      return [r.order_id, r.date, r.time, r.city_id, r.salechannel_id, r.quantity, r.pizza_id];
    });
    sheet.getRange(nextRow, 1, values.length, 7).setValues(values);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, insertedAtRow: nextRow, count: values.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("fact_ventas");
  return ContentService.createTextOutput(JSON.stringify({ ok: true, sheet: sheet ? "fact_ventas conectada" : "No encontrada" }))
    .setMimeType(ContentService.MimeType.JSON);
}
