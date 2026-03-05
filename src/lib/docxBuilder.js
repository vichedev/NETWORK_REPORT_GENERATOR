import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, LevelFormat,
} from 'docx'

const CONTENT_W = 9360;

// ─── Helper: ArrayBuffer ────────────────────────────────────────────────────
async function fileToArrayBuffer(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(file);
  });
}

// ─── Helper: Image Dimensions ───────────────────────────────────────────────
async function getImageDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

// ─── Helper: Page Break ─────────────────────────────────────────────────────
function pageBreak() {
  return new Paragraph({
    children: [new TextRun({ break: 1 })],
    pageBreakBefore: true,
  });
}

// ─── Helper: H1 ─────────────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    spacing: { before: 320, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '003366', space: 4 },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 32,
        color: '003366',
        font: 'Arial',
      }),
    ],
  });
}

// ─── Helper: H2 ─────────────────────────────────────────────────────────────
function h2(text) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 26,
        color: '1a4a7a',
        font: 'Arial',
      }),
    ],
  });
}

// ─── Helper: H3 ─────────────────────────────────────────────────────────────
function h3(text) {
  return new Paragraph({
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: '2c6fa8',
        font: 'Arial',
      }),
    ],
  });
}

// ─── Helper: Body Paragraph ─────────────────────────────────────────────────
function body(text, opts = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: opts.spaceBefore ?? 80, after: opts.spaceAfter ?? 80 },
    children: [
      new TextRun({
        text,
        bold: opts.bold ?? false,
        italics: opts.italic ?? false,
        size: opts.size ?? 22,
        color: opts.color ?? '000000',
        font: 'Arial',
      }),
    ],
  });
}

// ─── Helper: Bullet Point ───────────────────────────────────────────────────
function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text, size: 22, font: 'Arial' }),
    ],
  });
}

// ─── Helper: Table Cell ─────────────────────────────────────────────────────
function cell(text, opts = {}) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  return new TableCell({
    borders: { top: border, bottom: border, left: border, right: border },
    width: { size: opts.width ?? Math.floor(CONTENT_W / (opts.cols ?? 2)), type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts.bold ?? false,
            size: opts.size ?? 20,
            color: opts.color ?? '000000',
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

// ─── Helper: Stats Table ────────────────────────────────────────────────────
function statsTable(stats = {}) {
  const colW = Math.floor(CONTENT_W / 4);
  const headerShading = 'D5E8F0';
  const altShading = 'F5F9FC';

  const headerRow = new TableRow({
    children: [
      cell('Métrica', { width: colW, shading: headerShading, bold: true, center: true }),
      cell('Máximo', { width: colW, shading: headerShading, bold: true, center: true }),
      cell('Promedio', { width: colW, shading: headerShading, bold: true, center: true }),
      cell('Último', { width: colW, shading: headerShading, bold: true, center: true }),
    ],
    tableHeader: true,
  });

  const metrics = [
    { label: 'Entrada (bps)', key: 'entrada' },
    { label: 'Salida (bps)', key: 'salida' },
    { label: 'Utilización (%)', key: 'utilizacion' },
  ];

  const dataRows = metrics.map((m, idx) => {
    const s = stats[m.key] || {};
    const shade = idx % 2 === 0 ? 'FFFFFF' : altShading;
    return new TableRow({
      children: [
        cell(m.label, { width: colW, shading: shade, bold: true }),
        cell(s.max ?? '-', { width: colW, shading: shade, center: true }),
        cell(s.avg ?? '-', { width: colW, shading: shade, center: true }),
        cell(s.last ?? '-', { width: colW, shading: shade, center: true }),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [colW, colW, colW, colW],
    rows: [headerRow, ...dataRows],
  });
}

// ─── Helper: Summary Table ──────────────────────────────────────────────────
function summaryTable(sections = []) {
  const col1 = Math.floor(CONTENT_W * 0.35);
  const col2 = Math.floor(CONTENT_W * 0.35);
  const col3 = CONTENT_W - col1 - col2;
  const headerShading = '003366';

  const headerRow = new TableRow({
    children: [
      cell('Nodo', { width: col1, shading: headerShading, bold: true, center: true, color: 'FFFFFF' }),
      cell('Interfaz', { width: col2, shading: headerShading, bold: true, center: true, color: 'FFFFFF' }),
      cell('Período', { width: col3, shading: headerShading, bold: true, center: true, color: 'FFFFFF' }),
    ],
    tableHeader: true,
  });

  const dataRows = sections.map((sec, idx) => {
    const shade = idx % 2 === 0 ? 'FFFFFF' : 'EEF4FB';
    return new TableRow({
      children: [
        cell(sec.nodo ?? '-', { width: col1, shading: shade }),
        cell(sec.interfaz ?? '-', { width: col2, shading: shade }),
        cell(sec.periodo ?? '-', { width: col3, shading: shade, center: true }),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [col1, col2, col3],
    rows: [headerRow, ...dataRows],
  });
}

// ─── Main Builder ───────────────────────────────────────────────────────────
export async function buildDocx({ empresa, generadoPor, periodo, analysis, imgFiles }) {
  const today = new Date().toLocaleDateString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const children = [];

  // ── Portada ──
  children.push(new Paragraph({ spacing: { before: 2880 } }));
  children.push(body('INFORME TÉCNICO DE INFRAESTRUCTURA', { center: true, bold: true, color: '003366', size: 50 }));
  children.push(body(empresa.toUpperCase(), { center: true, color: '1a4a7a', size: 40 }));
  children.push(body(`Fecha: ${today}`, { center: true, size: 24 }));
  if (generadoPor) children.push(body(`Generado por: ${generadoPor}`, { center: true, size: 22, color: '555555' }));
  children.push(pageBreak());

  // ── Resumen Ejecutivo ──
  children.push(h1('1. RESUMEN EJECUTIVO'));
  children.push(body(analysis.resumen));
  children.push(new Paragraph({ spacing: { before: 160 } }));
  children.push(summaryTable(analysis.sections));
  children.push(pageBreak());

  // ── Secciones Detalladas ──
  for (let i = 0; i < analysis.sections.length; i++) {
    const sec = analysis.sections[i];
    const f = imgFiles[i];

    children.push(h1(`SECCIÓN ${i + 1}: ${sec.nodo.toUpperCase()}`));
    children.push(body(`Interfaz: ${sec.interfaz} | Período: ${sec.periodo}`, { italic: true, color: '666666' }));

    // Imagen
    if (f?.file) {
      try {
        const dims = await getImageDimensions(f.file);
        const buffer = await fileToArrayBuffer(f.file);
        const ratio = dims.height / dims.width;
        const imgW = 600;
        const imgH = Math.round(imgW * ratio);

        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [
            new ImageRun({
              data: buffer,
              transformation: { width: imgW, height: imgH },
              type: f.file.type.includes('png') ? 'png' : 'jpg',
            }),
          ],
        }));
      } catch (e) {
        console.error('Error insertando imagen:', e);
      }
    }

    children.push(h2('Estadísticas de Tráfico'));
    children.push(statsTable(sec.stats));
    children.push(new Paragraph({ spacing: { before: 120 } }));

    children.push(h2('Análisis del Especialista'));
    children.push(body(sec.analisis));

    if (sec.observaciones?.length) {
      children.push(h3('Observaciones'));
      sec.observaciones.forEach(o => children.push(bullet(o)));
    }

    if (sec.recomendaciones?.length) {
      children.push(h3('Recomendaciones'));
      sec.recomendaciones.forEach(r => children.push(bullet(r)));
    }

    if (i < analysis.sections.length - 1) children.push(pageBreak());
  }

  // ── Conclusiones ──
  children.push(pageBreak());
  children.push(h1('CONCLUSIONES FINALES'));
  analysis.conclusiones.forEach((c, idx) =>
    children.push(body(`${idx + 1}. ${c}`, { spaceAfter: 120 }))
  );

  // ── Documento ──
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{
            level: 0,
            format: LevelFormat.BULLET,
            text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  return Packer.toBlob(doc);
}