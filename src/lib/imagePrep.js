/**
 * Preparación de las gráficas antes de mandarlas a la IA.
 *
 * El coste en tokens de una imagen depende de sus dimensiones, no de su peso en
 * disco. Las capturas de pantalla de un monitor grande pueden superar los
 * 2000 px y disparan el consumo sin aportar legibilidad: los modelos de visión
 * reescalan internamente por encima de cierto tamaño. Recortarlas aquí ahorra
 * tokens (y por tanto esperas por límite de peticiones) sin perder detalle útil.
 */

/** Lado máximo que enviamos al proveedor. */
export const MAX_LADO = 1568

/** Convierte un File en data URL sin tocarlo. */
function fileToDataUrlRaw(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(`No se pudo leer la imagen ${file.name}`))
    reader.readAsDataURL(file)
  })
}

function cargarImagen(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen'))
    img.src = url
  })
}

/**
 * Devuelve la data URL lista para enviar. Si la imagen ya cabe en MAX_LADO se
 * devuelve intacta; si no, se reescala manteniendo la proporción.
 *
 * Se mantiene PNG para no introducir artefactos de compresión sobre las líneas
 * finas y los números de las gráficas.
 *
 * @returns {Promise<{dataUrl: string, mime: string, redimensionada: boolean}>}
 */
export async function prepararImagen(file) {
  const original = await fileToDataUrlRaw(file)

  let img
  try {
    img = await cargarImagen(original)
  } catch {
    // Si el navegador no puede decodificarla, que decida el proveedor.
    return { dataUrl: original, mime: file.type || 'image/png', redimensionada: false }
  }

  const ladoMayor = Math.max(img.naturalWidth, img.naturalHeight)
  if (ladoMayor <= MAX_LADO) {
    return { dataUrl: original, mime: file.type || 'image/png', redimensionada: false }
  }

  const escala = MAX_LADO / ladoMayor
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * escala)
  canvas.height = Math.round(img.naturalHeight * escala)

  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return {
    dataUrl: canvas.toDataURL('image/png'),
    mime: 'image/png',
    redimensionada: true,
  }
}
