/* -------------------------------------------------------------------------- *
 * test/export/_leer-xlsx.js — F20 · un lector de `.xlsx` PARA LAS PRUEBAS     *
 *                                                                            *
 * No es un módulo de la aplicación y no entra en ningún barrel: vive aquí     *
 * para que las pruebas de la MAQUETA puedan preguntar «¿qué hay en B7 de la   *
 * hoja Hueco 1?» sin repetir cincuenta líneas de descompresión en cada        *
 * fichero de test.                                                           *
 *                                                                            *
 * ⚠️ **Y conviene tener claro qué NO demuestra.** Leer nuestro propio         *
 * fichero con nuestro propio lector es un espejo, que es la lección del DXF   *
 * (override O12). Este lector sirve para afirmar sobre el CONTENIDO —qué      *
 * valor, en qué celda, con qué estilo—, que es lo que la maqueta decide. Que  *
 * el CONTENEDOR esté bien hecho lo establecen otras dos cosas, y ninguna es   *
 * esta: `test/export/xlsx.test.js` contrasta cada CRC contra `node:zlib`, y   *
 * `scripts/validar-xlsx.mjs` le da el fichero a openpyxl.                    *
 *                                                                            *
 * Solo entiende lo que este proyecto escribe: entradas ZIP sin comprimir y    *
 * cadenas en línea. Con un `.xlsx` de Excel de verdad no serviría, y no       *
 * tiene por qué.                                                             *
 * -------------------------------------------------------------------------- */

const decodificador = new TextDecoder('utf-8')

/**
 * Descomprime un ZIP con todas las entradas en `STORE`.
 *
 * @param {Uint8Array} bytes
 * @returns {Map<string, string>}  nombre de la parte → su texto.
 */
export function partesDelZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = bytes.length - 22
  if (dv.getUint32(eocd, true) !== 0x06054b50) {
    throw new Error('_leer-xlsx: no encuentro el fin del directorio central (¿hay comentario?).')
  }
  const total = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)

  const partes = new Map()
  for (let i = 0; i < total; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) {
      throw new Error(`_leer-xlsx: entrada central ${i} con firma inesperada.`)
    }
    const metodo = dv.getUint16(p + 10, true)
    if (metodo !== 0) throw new Error(`_leer-xlsx: la entrada ${i} está comprimida (método ${metodo}).`)
    const tamano = dv.getUint32(p + 20, true)
    const largoNombre = dv.getUint16(p + 28, true)
    const largoExtra = dv.getUint16(p + 30, true)
    const largoComentario = dv.getUint16(p + 32, true)
    const desplazamiento = dv.getUint32(p + 42, true)
    const nombre = decodificador.decode(bytes.subarray(p + 46, p + 46 + largoNombre))

    const l = desplazamiento
    const inicio = l + 30 + dv.getUint16(l + 26, true) + dv.getUint16(l + 28, true)
    partes.set(nombre, decodificador.decode(bytes.subarray(inicio, inicio + tamano)))

    p += 46 + largoNombre + largoExtra + largoComentario
  }
  return partes
}

/** Deshace el escapado de XML. Solo las cinco entidades que este proyecto emite. */
const desescapar = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

/**
 * Una hoja leída.
 *
 * @typedef {Object} HojaLeida
 * @property {string} nombre
 * @property {Map<string, {valor: string|number|null, estilo: number, esNumero: boolean}>} celdas
 *   Indexada por referencia (`'B7'`).
 * @property {string[]} combinaciones
 * @property {string} xml  Por si una prueba necesita afirmar sobre el crudo.
 */

/**
 * Lee un libro escrito por `export/xlsx.js`.
 *
 * @param {Uint8Array} bytes
 * @returns {{hojas: HojaLeida[], porNombre: Map<string, HojaLeida>, partes: Map<string, string>}}
 */
export function leerLibro(bytes) {
  const partes = partesDelZip(bytes)
  const libro = partes.get('xl/workbook.xml')
  if (libro === undefined) throw new Error('_leer-xlsx: el paquete no trae xl/workbook.xml.')

  const hojas = []
  // El orden de aparición en `<sheets>` es el orden de las pestañas, y el `sheetN`
  // se deriva de él porque es como los numera el escritor.
  const nombres = [...libro.matchAll(/<sheet name="([^"]*)"/g)].map((m) => desescapar(m[1]))

  nombres.forEach((nombre, i) => {
    const xml = partes.get(`xl/worksheets/sheet${i + 1}.xml`)
    if (xml === undefined) throw new Error(`_leer-xlsx: falta la parte de la hoja «${nombre}».`)

    const celdas = new Map()
    for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"(?: s="(\d+)")?(?: t="inlineStr")?(?:\/>|>(.*?)<\/c>)/g)) {
      const [, ref, estilo, cuerpo] = m
      let valor = null
      let esNumero = false
      if (cuerpo !== undefined) {
        const numero = cuerpo.match(/^<v>(.*)<\/v>$/)
        if (numero !== null) {
          valor = Number(numero[1])
          esNumero = true
        } else {
          const cadena = cuerpo.match(/<t[^>]*>(.*)<\/t>/)
          valor = cadena === null ? null : desescapar(cadena[1])
        }
      }
      celdas.set(ref, { valor, estilo: estilo === undefined ? 0 : Number(estilo), esNumero })
    }

    hojas.push({
      nombre,
      celdas,
      combinaciones: [...xml.matchAll(/<mergeCell ref="([^"]*)"/g)].map((m) => m[1]),
      xml,
    })
  })

  return { hojas, porNombre: new Map(hojas.map((h) => [h.nombre, h])), partes }
}

/**
 * Todo el texto de una hoja, seguido. Para los guardianes de vocabulario, que
 * preguntan si una palabra aparece en alguna parte del documento.
 *
 * @param {HojaLeida} hoja
 * @returns {string}
 */
export const textoDe = (hoja) =>
  [...hoja.celdas.values()]
    .filter((c) => typeof c.valor === 'string')
    .map((c) => c.valor)
    .join('\n')

/**
 * El valor de una celda, o `undefined` si no existe. Azúcar para no escribir
 * `hoja.celdas.get('B7')?.valor` cincuenta veces.
 *
 * @param {HojaLeida} hoja
 * @param {string} ref
 */
export const valor = (hoja, ref) => hoja.celdas.get(ref)?.valor
