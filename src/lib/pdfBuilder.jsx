import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

// Estilos similares a tu DOCX (Colores azul institucional)
const styles = StyleSheet.create({
  page: { padding: 50, fontFamily: 'Helvetica', fontSize: 10 },
  title: { fontSize: 24, textAlign: 'center', color: '#003366', marginBottom: 10, fontWeight: 'bold' },
  subtitle: { fontSize: 18, textAlign: 'center', color: '#1a4a7a', marginBottom: 30 },
  h1: { fontSize: 16, color: '#003366', borderBottom: 1, borderBottomColor: '#003366', marginBottom: 10, marginTop: 20, paddingBottom: 5, fontWeight: 'bold' },
  h2: { fontSize: 14, color: '#1a4a7a', marginTop: 15, marginBottom: 8, fontWeight: 'bold' },
  body: { marginBottom: 8, textAlign: 'justify', lineHeight: 1.5 },
  bullet: { marginLeft: 15, marginBottom: 4 },
  image: { width: 450, height: 'auto', alignSelf: 'center', marginVertical: 15 },
  // Estilos de Tabla
  table: { display: 'table', width: 'auto', borderStyle: 'solid', borderWidth: 1, borderColor: '#CCCCCC', marginVertical: 10 },
  tableRow: { flexDirection: 'row' },
  tableHeader: { backgroundColor: '#D5E8F0', fontWeight: 'bold' },
  tableCol: { width: '25%', borderStyle: 'solid', borderWidth: 1, borderColor: '#CCCCCC', padding: 5 },
  cellText: { textAlign: 'center', fontSize: 9 }
});

export const ReportPDF = ({ empresa, generadoBy, analysis, imgFiles }) => (
  <Document>
    {/* Portada */}
    <Page style={styles.page}>
      <View style={{ marginTop: 200 }}>
        <Text style={styles.title}>INFORME TÉCNICO DE INFRAESTRUCTURA</Text>
        <Text style={styles.subtitle}>{empresa.toUpperCase()}</Text>
        <Text style={{ textAlign: 'center', marginTop: 20 }}>Generado por: {generadoBy || 'MAAT'}</Text>
        <Text style={{ textAlign: 'center' }}>Fecha: {new Date().toLocaleDateString('es-EC')}</Text>
      </View>
    </Page>

    {/* Resumen Ejecutivo */}
    <Page style={styles.page}>
      <Text style={styles.h1}>1. RESUMEN EJECUTIVO</Text>
      <Text style={styles.body}>{analysis.resumen}</Text>
      
      <Text style={styles.h1}>CONCLUSIONES GENERALES</Text>
      {analysis.conclusiones.map((c, i) => (
        <Text key={i} style={styles.body}>{i + 1}. {c}</Text>
      ))}
    </Page>

    {/* Secciones Detalladas */}
    {analysis.sections.map((sec, i) => (
      <Page key={i} style={styles.page}>
        <Text style={styles.h1}>SECCIÓN {i + 1}: {sec.nodo.toUpperCase()}</Text>
        <Text style={[styles.body, { color: '#666666' }]}>Interfaz: {sec.interfaz} | Período: {sec.periodo}</Text>

        {/* Imagen del Nodo */}
        {imgFiles[i]?.file && (
          <Image style={styles.image} src={URL.createObjectURL(imgFiles[i].file)} />
        )}

        <Text style={styles.h2}>Estadísticas de Tráfico</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.tableCol}><Text style={styles.cellText}>Métrica</Text></View>
            <View style={styles.tableCol}><Text style={styles.cellText}>Máximo</Text></View>
            <View style={styles.tableCol}><Text style={styles.cellText}>Promedio</Text></View>
            <View style={styles.tableCol}><Text style={styles.cellText}>Último</Text></View>
          </View>
          {['entrada', 'salida', 'utilizacion'].map((m) => (
            <View style={styles.tableRow} key={m}>
              <View style={styles.tableCol}><Text style={styles.cellText}>{m.toUpperCase()}</Text></View>
              <View style={styles.tableCol}><Text style={styles.cellText}>{sec.stats[m]?.max || '-'}</Text></View>
              <View style={styles.tableCol}><Text style={styles.cellText}>{sec.stats[m]?.avg || '-'}</Text></View>
              <View style={styles.tableCol}><Text style={styles.cellText}>{sec.stats[m]?.last || '-'}</Text></View>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Análisis del Especialista</Text>
        <Text style={styles.body}>{sec.analisis}</Text>

        {sec.observaciones?.length > 0 && (
          <>
            <Text style={styles.h2}>Observaciones</Text>
            {sec.observaciones.map((o, idx) => <Text key={idx} style={styles.bullet}>• {o}</Text>)}
          </>
        )}
      </Page>
    ))}
  </Document>
);