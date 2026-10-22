const encoder = new TextEncoder();

function xml(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

function columnName(number) {
  let name = '';
  while (number > 0) { const remainder = (number - 1) % 26; name = String.fromCharCode(65 + remainder) + name; number = Math.floor((number - 1) / 26); }
  return name;
}

function excelDate(value) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const part = Object.fromEntries(parts.map(item => [item.type, item.value]));
  return Date.UTC(+part.year, +part.month - 1, +part.day, +part.hour, +part.minute, +part.second) / 86400000 + 25569;
}

function cellXml(value, reference, style = 0) {
  if (value === null || value === undefined || value === '') return `<c r="${reference}" s="${style}"/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function worksheet(rows, { widths = [], freeze = false, filter = false, merges = [] } = {}) {
  const maxColumns = Math.max(1, ...rows.map(row => row.length));
  const lastCell = `${columnName(maxColumns)}${Math.max(1, rows.length)}`;
  const colXml = widths.length ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>` : '';
  const viewXml = freeze ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const rowXml = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="30" customHeight="1"' : ''}>${row.map((cell, index) => cellXml(cell.value, `${columnName(index + 1)}${rowIndex + 1}`, cell.style || 0)).join('')}</row>`).join('');
  const mergeXml = merges.length ? `<mergeCells count="${merges.length}">${merges.map(range => `<mergeCell ref="${range}"/>`).join('')}</mergeCells>` : '';
  const filterXml = filter && rows.length > 1 ? `<autoFilter ref="A1:${lastCell.split(/\d/)[0]}${rows.length}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCell}"/>${viewXml}<sheetFormatPr defaultRowHeight="22"/>${colXml}<sheetData>${rowXml}</sheetData>${filterXml}${mergeXml}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;EGP&quot;"/><numFmt numFmtId="165" formatCode="dd mmm yyyy hh:mm"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Aptos"/><family val="2"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="18"/><name val="Aptos Display"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFB8342B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8F1E8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE9DED2"/></left><right style="thin"><color rgb="FFE9DED2"/></right><top style="thin"><color rgb="FFE9DED2"/></top><bottom style="thin"><color rgb="FFE9DED2"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bytes(size, setup) {
  const value = new Uint8Array(size), view = new DataView(value.buffer);
  setup(view);
  return value;
}

function zip(files) {
  const localParts = [], centralParts = [];
  let offset = 0;
  for (const [name, contents] of Object.entries(files)) {
    const filename = encoder.encode(name), data = encoder.encode(contents), checksum = crc32(data);
    const local = bytes(30, view => {
      view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true); view.setUint16(10, 0, true); view.setUint16(12, 33, true);
      view.setUint32(14, checksum, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, filename.length, true);
    });
    localParts.push(local, filename, data);
    const central = bytes(46, view => {
      view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true); view.setUint16(12, 0, true); view.setUint16(14, 33, true);
      view.setUint32(16, checksum, true); view.setUint32(20, data.length, true); view.setUint32(24, data.length, true); view.setUint16(28, filename.length, true);
      view.setUint32(38, 0, true); view.setUint32(42, offset, true);
    });
    centralParts.push(central, filename);
    offset += local.length + filename.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = bytes(22, view => {
    view.setUint32(0, 0x06054b50, true); view.setUint16(8, Object.keys(files).length, true); view.setUint16(10, Object.keys(files).length, true);
    view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
  });
  return new Blob([...localParts, ...centralParts, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function buildSalesWorkbook({ orders, columns, from, to, statusLabel, summary, labels }) {
  const summaryRows = [
    [{ value: labels.title, style: 2 }],
    [{ value: labels.period, style: 7 }, { value: `${from} – ${to}`, style: 3 }],
    [{ value: labels.status, style: 7 }, { value: statusLabel, style: 3 }],
    [],
    [{ value: labels.metric, style: 1 }, { value: labels.value, style: 1 }, { value: labels.metric, style: 1 }, { value: labels.value, style: 1 }],
    [{ value: labels.orders, style: 7 }, { value: summary.orders, style: 3 }, { value: labels.revenue, style: 7 }, { value: summary.revenue, style: 5 }],
    [{ value: labels.cancelled, style: 7 }, { value: summary.cancelled, style: 3 }, { value: labels.exportedRows, style: 7 }, { value: orders.length, style: 3 }],
    []
  ];
  const orderRows = [[...columns.map(column => ({ value: column.label, style: 1 }))], ...orders.map(order => columns.map(column => {
    const currency = ['subtotal_egp', 'delivery_fee_egp', 'total_egp', 'amount_received_egp', 'change_due_egp'].includes(column.key);
    const value = column.key === 'receipt_number' ? (order.receipt_number == null ? '' : '#' + String(order.receipt_number)) : column.key === 'created_at' ? excelDate(order[column.key]) : currency && order[column.key] != null ? Number(order[column.key]) : order[column.key];
    const style = column.key === 'created_at' ? 6 : currency ? 5 : 3;
    return { value, style };
  }))];
  const widthByKey = { order_number: 19, created_at: 23, customer_name: 27, customer_phone: 19, status: 23, fulfillment_type: 18, payment_method: 22, subtotal_egp: 19, delivery_fee_egp: 21, total_egp: 19, notes: 42 };
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="1"/></bookViews><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/><sheet name="Orders" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029"/></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': styles,
    'xl/worksheets/sheet1.xml': worksheet(summaryRows, { widths: [24, 30, 25, 28], merges: ['A1:D1'] }),
    'xl/worksheets/sheet2.xml': worksheet(orderRows, { widths: columns.map(column => widthByKey[column.key] || 22), freeze: true, filter: true })
  };
  return zip(files);
}
