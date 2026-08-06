/* -------------------------------------------------------------------------- *
 * test/export/xlsx.test.js — F20 · T1.2 · El escritor de libros de Excel      *
 *                                                                            *
 * `export/xlsx.js` no calcula geometría ni sabe qué es una parcela: envuelve  *
 * celdas en XML y el XML en un ZIP. Así que lo que hay que probar es que el   *
 * CONTENEDOR está bien hecho, y eso tiene una trampa conocida en este         *
 * proyecto: **comprobar nuestro formato con nuestro propio lector es          *
 * preguntarle a un espejo**. Es la lección del DXF que colgaba ZWCAD mientras *
 * `parsers/dxf.js` lo aprobaba sin una queja (override O12).                  *
 *                                                                            *
 * Por eso aquí hay tres capas de verdad, y solo una es nuestra:               *
 *                                                                            *
 *   1. ⭐ **`node:zlib.crc32` como oráculo INDEPENDIENTE.** Cada entrada del   *
 *      ZIP se comprueba recalculando su CRC con el de Node, no con el         *
 *      nuestro. Y el nuestro se contrasta además contra el valor de           *
 *      comprobación canónico del algoritmo (`"123456789"` → `0xCBF43926`),    *
 *      que es una constante publicada y no una cifra de esta casa.            *
 *   2. Un lector de ZIP escrito **en el propio test**, que recorre el         *
 *      directorio central de verdad —no el array de partes que compusimos—    *
 *      y del que salen los bytes que se afirman.                              *
 *   3. Los `throw` del contrato, que son de esta casa y aquí sí mandan.       *
 *                                                                            *
 * ⚠️ **Lo que estas pruebas NO pueden firmar** es que Excel abra el fichero.  *
 * Eso lo mide `scripts/validar-xlsx.mjs` contra openpyxl (T4.1) y, en última  *
 * instancia, una persona con Excel delante — porque un lector tolerante       *
 * responde por su modelo y no por el fichero.                                 *
 *                                                                            *
 * Proyecto Vitest `node`: bytes y texto, sin DOM.                             *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { crc32 as crc32DeNode } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import {
  ESTILO,
  MAX_COLUMNAS,
  MAX_NOMBRE_HOJA,
  PROHIBIDOS_NOMBRE_HOJA,
  SUSTITUTO_NO_REPRESENTABLE,
  crc32,
  letraDeColumna,
  serializarLibroXlsx,
} from '../../export/xlsx.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const FUENTE_MODULO = readFileSync(join(RAIZ, 'export', 'xlsx.js'), 'utf8')

/** Instante fijo. El módulo no lee el reloj: la fecha entra por parámetro. */
const FECHA = new Date(Date.UTC(2026, 7, 6, 17, 42, 30))

const decodificador = new TextDecoder('utf-8')

/** Un libro mínimo, para cuando lo que se prueba no es el contenido. */
const libro = (hojas, fecha = FECHA) => serializarLibroXlsx({ hojas, fecha })

const hojaSimple = (extra = {}) => ({ nombre: 'Hoja', filas: [['a']], ...extra })

// ── Un lector de ZIP, escrito aquí ──────────────────────────────────────────
//
// Recorre el DIRECTORIO CENTRAL —que es por donde entra un lector de verdad— y
// no la lista de partes que compuso el escritor. Si el directorio apuntara mal,
// esto se enteraría; una comprobación sobre nuestras propias estructuras, no.

function leerZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // El EOCD son 22 bytes al final cuando no hay comentario, que es nuestro caso.
  const eocd = bytes.length - 22
  expect(dv.getUint32(eocd, true), 'firma del EOCD').toBe(0x06054b50)

  const total = dv.getUint16(eocd + 10, true)
  const tamanoDirectorio = dv.getUint32(eocd + 12, true)
  const inicioDirectorio = dv.getUint32(eocd + 16, true)
  expect(dv.getUint16(eocd + 8, true), 'entradas en este disco').toBe(total)
  expect(inicioDirectorio + tamanoDirectorio, 'el directorio acaba donde empieza el EOCD').toBe(eocd)

  const entradas = new Map()
  let p = inicioDirectorio
  for (let i = 0; i < total; i++) {
    expect(dv.getUint32(p, true), `firma de la entrada central ${i}`).toBe(0x02014b50)
    const metodo = dv.getUint16(p + 10, true)
    const hora = dv.getUint16(p + 12, true)
    const dia = dv.getUint16(p + 14, true)
    const crcDeclarado = dv.getUint32(p + 16, true)
    const comprimido = dv.getUint32(p + 20, true)
    const sinComprimir = dv.getUint32(p + 24, true)
    const largoNombre = dv.getUint16(p + 28, true)
    const largoExtra = dv.getUint16(p + 30, true)
    const largoComentario = dv.getUint16(p + 32, true)
    const desplazamiento = dv.getUint32(p + 42, true)
    const nombre = decodificador.decode(bytes.subarray(p + 46, p + 46 + largoNombre))

    // Cabecera local: se va a buscar por el desplazamiento que declara el central.
    const l = desplazamiento
    expect(dv.getUint32(l, true), `firma de la cabecera local de ${nombre}`).toBe(0x04034b50)
    const largoNombreLocal = dv.getUint16(l + 26, true)
    const largoExtraLocal = dv.getUint16(l + 28, true)
    const inicioDatos = l + 30 + largoNombreLocal + largoExtraLocal
    const datos = bytes.subarray(inicioDatos, inicioDatos + comprimido)

    entradas.set(nombre, {
      metodo,
      hora,
      dia,
      crcDeclarado,
      comprimido,
      sinComprimir,
      datos,
      texto: decodificador.decode(datos),
      nombreLocal: decodificador.decode(bytes.subarray(l + 30, l + 30 + largoNombreLocal)),
    })
    p += 46 + largoNombre + largoExtra + largoComentario
  }
  expect(p, 'el recorrido del directorio acaba justo en el EOCD').toBe(eocd)
  return entradas
}

const PARTES = [
  '[Content_Types].xml',
  '_rels/.rels',
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
  'xl/styles.xml',
  'xl/worksheets/sheet1.xml',
]

// ═══════════════════════════════════════════════════════════════════════════
describe('crc32 — contra un oráculo que no es nuestro', () => {
  it('da el valor de comprobación canónico del algoritmo', () => {
    // 0xCBF43926 sobre "123456789" es LA constante con la que se verifica una
    // implementación de CRC-32/ISO-HDLC. No sale de este proyecto.
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('coincide con `node:zlib.crc32` en el vacío, en ASCII y en UTF-8', () => {
    for (const cadena of ['', 'a', 'Vértice', 'Coordenadas Parcela', 'm²', '\u0000ÿ']) {
      const bytes = new TextEncoder().encode(cadena)
      expect(crc32(bytes), `crc de ${JSON.stringify(cadena)}`).toBe(crc32DeNode(bytes))
    }
  })

  it('coincide con `node:zlib.crc32` sobre un bloque largo con todos los bytes', () => {
    const bytes = new Uint8Array(4096)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) % 256
    expect(crc32(bytes)).toBe(crc32DeNode(bytes))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('letraDeColumna', () => {
  it('nombra las columnas como Excel', () => {
    expect(letraDeColumna(1)).toBe('A')
    expect(letraDeColumna(26)).toBe('Z')
    expect(letraDeColumna(27)).toBe('AA')
    expect(letraDeColumna(28)).toBe('AB')
    expect(letraDeColumna(52)).toBe('AZ')
    expect(letraDeColumna(702)).toBe('ZZ')
    expect(letraDeColumna(703)).toBe('AAA')
  })

  it('llega justo hasta la última columna que existe en Excel', () => {
    // XFD es la 16.384 y última. Que la cuenta cuadre en el extremo es lo que
    // demuestra que el acarreo no pierde una posición por el camino.
    expect(letraDeColumna(MAX_COLUMNAS)).toBe('XFD')
  })

  it('lanza fuera de rango y con un valor que no es un entero', () => {
    for (const malo of [0, -1, 1.5, MAX_COLUMNAS + 1, '3', null]) {
      expect(() => letraDeColumna(malo), `columna ${JSON.stringify(malo)}`).toThrow(RangeError)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('el contenedor ZIP', () => {
  const bytes = libro([hojaSimple()])
  const entradas = leerZip(bytes)

  it('empieza por la firma de un ZIP', () => {
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
  })

  it('devuelve Uint8Array y no una cadena', () => {
    expect(bytes).toBeInstanceOf(Uint8Array)
  })

  it('trae las seis partes, y ni una más', () => {
    expect([...entradas.keys()].sort()).toEqual([...PARTES].sort())
  })

  it('tiene TODAS las entradas sin comprimir (STORE), que es la decisión de la fase', () => {
    for (const [nombre, e] of entradas) {
      expect(e.metodo, `método de ${nombre}`).toBe(0)
      expect(e.comprimido, `tamaño comprimido de ${nombre}`).toBe(e.sinComprimir)
    }
  })

  it('⭐ declara un CRC que `node:zlib` confirma, entrada por entrada', () => {
    for (const [nombre, e] of entradas) {
      expect(e.crcDeclarado, `CRC declarado de ${nombre}`).toBe(crc32DeNode(e.datos))
    }
  })

  it('dice el mismo nombre en la cabecera local y en el directorio central', () => {
    for (const [nombre, e] of entradas) expect(e.nombreLocal).toBe(nombre)
  })

  it('escribe XML bien formado en las seis partes', () => {
    for (const [nombre, e] of entradas) {
      expect(e.texto.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'), nombre).toBe(
        true,
      )
    }
  })

  it('⭐ es determinista: el mismo libro y la misma fecha dan los mismos bytes', () => {
    const a = libro([hojaSimple()])
    const b = libro([hojaSimple()])
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('la fecha, que entra por parámetro y no del reloj', () => {
  /** Deshace la codificación MS-DOS del ZIP. */
  const deDos = (hora, dia) => ({
    anio: ((dia >> 9) & 0x7f) + 1980,
    mes: (dia >> 5) & 0x0f,
    dia: dia & 0x1f,
    horas: (hora >> 11) & 0x1f,
    minutos: (hora >> 5) & 0x3f,
    segundos: (hora & 0x1f) * 2,
  })

  it('estampa en el ZIP la fecha que se le da, por componentes UTC', () => {
    const e = leerZip(libro([hojaSimple()])).get('xl/workbook.xml')
    expect(deDos(e.hora, e.dia)).toEqual({
      anio: 2026,
      mes: 8,
      dia: 6,
      horas: 17,
      minutos: 42,
      segundos: 30,
    })
  })

  it('una fecha distinta cambia los bytes, así que la marca no es decorativa', () => {
    const a = libro([hojaSimple()], new Date(Date.UTC(2026, 7, 6, 17, 42, 30)))
    const b = libro([hojaSimple()], new Date(Date.UTC(2020, 0, 1, 0, 0, 0)))
    expect(Array.from(a)).not.toEqual(Array.from(b))
  })

  it('sujeta una fecha anterior a 1980, que no cabe en el formato', () => {
    // Sin esto el año saldría negativo y el fichero quedaría ilegible. Se prefiere
    // una fecha falsa y representable a un ZIP roto.
    const e = leerZip(libro([hojaSimple()], new Date(Date.UTC(1969, 6, 20)))).get('xl/workbook.xml')
    expect(deDos(e.hora, e.dia)).toEqual({
      anio: 1980,
      mes: 1,
      dia: 1,
      horas: 0,
      minutos: 0,
      segundos: 0,
    })
  })

  it('no lee el reloj: su texto fuente no nombra `Date.now` ni construye fechas', () => {
    // Mismo guardián, y por el mismo motivo, que `export/coordenadas.js` y
    // `report/pdf.js`: un fichero descargado es un snapshot.
    expect(FUENTE_MODULO).not.toMatch(/Date\.now\(/)
    expect(FUENTE_MODULO).not.toMatch(/new Date\(/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('las celdas', () => {
  const hoja = (filas, extra = {}) => leerZip(libro([{ nombre: 'H', filas, ...extra }]))
  const sheet1 = (filas, extra = {}) => hoja(filas, extra).get('xl/worksheets/sheet1.xml').texto

  it('⭐ escribe los números como NÚMERO y no como texto', () => {
    // Es la mitad del entregable de la fase: una coordenada convertida a cadena no
    // se puede sumar ni ordenar, y es exactamente lo que el `.txt` ya no permitía.
    const xml = sheet1([[372516.02]])
    expect(xml).toContain('<c r="A1"><v>372516.02</v></c>')
    expect(xml).not.toContain('inlineStr')
  })

  it('escribe el texto como cadena en línea, conservando los espacios', () => {
    const xml = sheet1([['  Coordenadas  ']])
    expect(xml).toContain('t="inlineStr"')
    expect(xml).toContain('xml:space="preserve"')
    expect(xml).toContain('>  Coordenadas  <')
  })

  it('respeta el cero y no lo confunde con una celda vacía', () => {
    // `0` es falsy: el fallo clásico de este tipo de normalización.
    expect(sheet1([[0]])).toContain('<c r="A1"><v>0</v></c>')
  })

  it('trata `null`, `undefined` y la cadena vacía como celda ausente', () => {
    const xml = sheet1([[null, undefined, '', 'D']])
    expect(xml).toContain('<c r="D1"')
    expect(xml).not.toContain('r="A1"')
    expect(xml).not.toContain('r="B1"')
    expect(xml).not.toContain('r="C1"')
  })

  it('no emite la fila que se queda entera vacía', () => {
    const xml = sheet1([['A'], [], [null, null], ['D']])
    expect(xml).toContain('<row r="1">')
    expect(xml).not.toContain('<row r="2">')
    expect(xml).not.toContain('<row r="3">')
    expect(xml).toContain('<row r="4">')
  })

  it('numera las referencias de celda como Excel, también pasada la Z', () => {
    const fila = Array.from({ length: 28 }, (_, i) => i + 1)
    const xml = sheet1([fila])
    expect(xml).toContain('<c r="Z1">')
    expect(xml).toContain('<c r="AA1">')
    expect(xml).toContain('<c r="AB1">')
  })

  it('escapa lo que XML no admite entre etiquetas', () => {
    const xml = sheet1([['Fulano & Cía. <hijos> "S.L."']])
    expect(xml).toContain('Fulano &amp; Cía. &lt;hijos&gt; "S.L."')
    expect(xml).toContain('&lt;hijos&gt;')
    expect(xml).not.toMatch(/<t[^>]*>[^<]*<hijos>/)
  })

  it('sustituye los caracteres que XML no admite EN NINGÚN CASO, y no los borra', () => {
    // Un byte de control colado en un nombre de expediente hace que Excel rechace el
    // fichero entero con un mensaje que no menciona el carácter.
    const xml = sheet1([['ANTES\u0000\u0007DESPUÉS']])
    expect(xml).toContain(`ANTES${SUSTITUTO_NO_REPRESENTABLE}${SUSTITUTO_NO_REPRESENTABLE}DESPUÉS`)
  })

  it('conserva tabulador, salto de línea y retorno, que XML sí admite', () => {
    const xml = sheet1([['a\tb\nc']])
    expect(xml).toContain('a\tb\nc')
  })

  it('acepta el atajo de un valor suelto y la forma larga con estilo', () => {
    expect(sheet1([['x']])).toContain('<c r="A1" t="inlineStr">')
    expect(sheet1([[{ valor: 'x' }]])).toContain('<c r="A1" t="inlineStr">')
    expect(sheet1([[{ valor: 'x', estilo: ESTILO.TITULO }]])).toContain('<c r="A1" s="1"')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('los estilos', () => {
  const sheet1 = (filas) => leerZip(libro([{ nombre: 'H', filas }])).get('xl/worksheets/sheet1.xml').texto
  const styles = () => leerZip(libro([hojaSimple()])).get('xl/styles.xml').texto

  it('⭐ el ORDEN del catálogo es el índice del formato, y queda fijado aquí', () => {
    // Reordenar ESTILO mueve el formato de todas las celdas ya escritas sin que
    // ningún otro test se entere: por eso el orden se afirma explícitamente.
    expect(Object.keys(ESTILO)).toEqual([
      'NORMAL',
      'TITULO',
      'ETIQUETA',
      'ROTULO',
      'CABECERA',
      'TEXTO',
      'ENTERO',
      'DECIMAL',
      'METROS',
      'METROS_CUADRADOS',
      'APUNTE',
    ])
  })

  it('cada estilo del catálogo tiene su `xf`, y el número cuadra', () => {
    const xml = styles()
    const declarados = Number(xml.match(/<cellXfs count="(\d+)"/)[1])
    expect(declarados).toBe(Object.keys(ESTILO).length)
    expect(xml.match(/<xf [^>]*xfId="0"/g)).toHaveLength(declarados)
  })

  it('NORMAL no escribe atributo de estilo, que es el índice 0', () => {
    expect(sheet1([[{ valor: 'x', estilo: ESTILO.NORMAL }]])).toContain('<c r="A1" t="inlineStr">')
  })

  it('cada estilo escribe el índice que le toca', () => {
    Object.values(ESTILO).forEach((nombre, i) => {
      const xml = sheet1([[{ valor: 1, estilo: nombre }]])
      expect(xml, `estilo ${nombre}`).toContain(i === 0 ? '<c r="A1">' : `<c r="A1" s="${i}">`)
    })
  })

  it('los rellenos 0 y 1 son los que Excel da por hechos, en su orden', () => {
    // Un fichero que se salte `none` y `gray125` abre con los colores corridos.
    const xml = styles()
    const rellenos = xml.match(/<fill>.*?<\/fill>/g)
    expect(rellenos[0]).toContain('patternType="none"')
    expect(rellenos[1]).toContain('patternType="gray125"')
    expect(rellenos[2]).toContain('FFD9D9D9')
  })

  it('⭐ las unidades van en el FORMATO y no en el valor', () => {
    // Es lo que permite que `1.535,87 m²` siga siendo un número que se puede sumar.
    const xml = styles()
    expect(xml).toContain('formatCode="0.00"')
    expect(xml).toContain('formatCode="0.00&quot; m&quot;"')
    expect(xml).toContain('formatCode="0.00&quot; m²&quot;"')
  })

  it('una celda con unidad sigue llevando un número dentro', () => {
    const xml = sheet1([[{ valor: 1535.87, estilo: ESTILO.METROS_CUADRADOS }]])
    expect(xml).toContain('<v>1535.87</v>')
    expect(xml).not.toContain('m²')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('la hoja', () => {
  it('declara `dimension` sobre lo REALMENTE escrito', () => {
    const xml = leerZip(libro([{ nombre: 'H', filas: [['a', 'b', 'c'], ['d']] }])).get(
      'xl/worksheets/sheet1.xml',
    ).texto
    expect(xml).toContain('<dimension ref="A1:C2"/>')
  })

  it('⛔ y no cuenta los renglones en blanco del final (regresión)', () => {
    // La primera versión usaba `filas.length`, así que una maqueta que deje un
    // renglón suelto al final —cosa que la de F20 hace— declaraba un rango mayor
    // que su última celda y `dimension` dejaba de decir la verdad.
    const xml = leerZip(libro([{ nombre: 'H', filas: [['a'], [], [], []] }])).get(
      'xl/worksheets/sheet1.xml',
    ).texto
    expect(xml).toContain('<dimension ref="A1:A1"/>')
  })

  it('emite los anchos de columna que se le piden', () => {
    const xml = leerZip(libro([{ nombre: 'H', filas: [['a']], columnas: [{ ancho: 9 }, { ancho: 16.5 }] }])).get(
      'xl/worksheets/sheet1.xml',
    ).texto
    expect(xml).toContain('<col min="1" max="1" width="9" customWidth="1"/>')
    expect(xml).toContain('<col min="2" max="2" width="16.5" customWidth="1"/>')
  })

  it('emite las combinaciones DESPUÉS de `sheetData`, que es lo que exige el esquema', () => {
    const xml = leerZip(
      libro([{ nombre: 'H', filas: [['t']], combinaciones: ['A1:C1'] }]),
    ).get('xl/worksheets/sheet1.xml').texto
    expect(xml).toContain('<mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells>')
    expect(xml.indexOf('</sheetData>')).toBeLessThan(xml.indexOf('<mergeCells'))
  })

  it('no emite `cols` ni `mergeCells` cuando no hay ninguno', () => {
    const xml = leerZip(libro([hojaSimple()])).get('xl/worksheets/sheet1.xml').texto
    expect(xml).not.toContain('<cols>')
    expect(xml).not.toContain('<mergeCells')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('varias hojas', () => {
  const tres = libro([
    { nombre: 'Contorno exterior', filas: [['a']] },
    { nombre: 'Hueco 1', filas: [['b']] },
    { nombre: 'Hueco 2', filas: [['c']] },
  ])
  const entradas = leerZip(tres)

  it('crea una parte por hoja', () => {
    for (const n of [1, 2, 3]) expect(entradas.has(`xl/worksheets/sheet${n}.xml`)).toBe(true)
  })

  it('las declara en el libro con su nombre y en orden', () => {
    const xml = entradas.get('xl/workbook.xml').texto
    expect(xml).toContain('<sheet name="Contorno exterior" sheetId="1" r:id="rId1"/>')
    expect(xml).toContain('<sheet name="Hueco 1" sheetId="2" r:id="rId2"/>')
    expect(xml).toContain('<sheet name="Hueco 2" sheetId="3" r:id="rId3"/>')
  })

  it('⭐ los `rId` de las relaciones casan con los del libro, y los estilos van al final', () => {
    // Si esto se descoloca, Excel abre la hoja equivocada bajo cada pestaña: es el
    // tipo de fallo que no rompe el fichero, solo lo vuelve mentira.
    const rels = entradas.get('xl/_rels/workbook.xml.rels').texto
    expect(rels).toContain('Id="rId1"')
    expect(rels).toContain('Target="worksheets/sheet1.xml"')
    expect(rels).toContain('Id="rId3"')
    expect(rels).toContain('Target="worksheets/sheet3.xml"')
    expect(rels).toContain('Id="rId4"')
    expect(rels).toContain('Target="styles.xml"')
  })

  it('declara cada parte en `[Content_Types].xml`', () => {
    const tipos = entradas.get('[Content_Types].xml').texto
    for (const n of [1, 2, 3]) expect(tipos).toContain(`PartName="/xl/worksheets/sheet${n}.xml"`)
    expect(tipos).toContain('PartName="/xl/styles.xml"')
    expect(tipos).toContain('PartName="/xl/workbook.xml"')
  })

  it('escapa el nombre de la pestaña en el atributo', () => {
    const xml = leerZip(libro([{ nombre: 'A & B "c"', filas: [['x']] }])).get('xl/workbook.xml').texto
    expect(xml).toContain('name="A &amp; B &quot;c&quot;"')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('lo que LANZA — contrato del programador, no dato del usuario', () => {
  it('opciones que no son un objeto', () => {
    for (const malo of [null, 'x', 42, []]) {
      expect(() => serializarLibroXlsx(malo)).toThrow(TypeError)
    }
  })

  it('`hojas` que no es un array', () => {
    expect(() => serializarLibroXlsx({ hojas: 'x', fecha: FECHA })).toThrow(TypeError)
  })

  it('⭐ un libro sin hojas: Excel no lo abre, así que no se entregan bytes', () => {
    expect(() => serializarLibroXlsx({ hojas: [], fecha: FECHA })).toThrow(RangeError)
  })

  it('una hoja que no es un objeto', () => {
    expect(() => libro(['x'])).toThrow(TypeError)
    expect(() => libro([null])).toThrow(TypeError)
  })

  it('una fecha ausente, de otro tipo o inválida', () => {
    expect(() => serializarLibroXlsx({ hojas: [hojaSimple()] })).toThrow(TypeError)
    expect(() => serializarLibroXlsx({ hojas: [hojaSimple()], fecha: 1_754_000_000_000 })).toThrow(
      TypeError,
    )
    expect(() => serializarLibroXlsx({ hojas: [hojaSimple()], fecha: new Date('nada') })).toThrow(
      RangeError,
    )
  })

  it('un nombre de pestaña vacío, ausente o que no es texto', () => {
    for (const malo of [undefined, null, '', '   ', 42]) {
      expect(() => libro([{ nombre: malo, filas: [['a']] }]), JSON.stringify(malo)).toThrow(TypeError)
    }
  })

  it('un nombre de pestaña más largo de lo que Excel admite', () => {
    expect(() => libro([{ nombre: 'x'.repeat(MAX_NOMBRE_HOJA + 1), filas: [['a']] }])).toThrow(RangeError)
    expect(() => libro([{ nombre: 'x'.repeat(MAX_NOMBRE_HOJA), filas: [['a']] }])).not.toThrow()
  })

  it('cada uno de los caracteres que Excel prohíbe en una pestaña', () => {
    for (const c of PROHIBIDOS_NOMBRE_HOJA) {
      expect(() => libro([{ nombre: `Hoja${c}1`, filas: [['a']] }]), `carácter ${c}`).toThrow(RangeError)
    }
  })

  it('un nombre de pestaña entrecomillado con apóstrofo', () => {
    expect(() => libro([{ nombre: "'Hoja", filas: [['a']] }])).toThrow(RangeError)
    expect(() => libro([{ nombre: "Hoja'", filas: [['a']] }])).toThrow(RangeError)
    expect(() => libro([{ nombre: "De Juan's parcela", filas: [['a']] }])).not.toThrow()
  })

  it('⭐ dos pestañas con el mismo nombre, aunque cambie la caja', () => {
    // Excel no distingue mayúsculas en los nombres de hoja: el libro abriría dañado.
    expect(() => libro([{ nombre: 'Hueco 1', filas: [['a']] }, { nombre: 'HUECO 1', filas: [['b']] }])).toThrow(
      RangeError,
    )
  })

  it('un estilo que no está en el catálogo', () => {
    expect(() => libro([{ nombre: 'H', filas: [[{ valor: 'x', estilo: 'ROJO' }]] }])).toThrow(RangeError)
  })

  it('un valor que no es texto ni número', () => {
    for (const malo of [true, {}, [], new Date()]) {
      expect(() => libro([{ nombre: 'H', filas: [[{ valor: malo }]] }])).toThrow(TypeError)
    }
  })

  it('⭐ un número que no se puede escribir en una hoja', () => {
    // `NaN` es el resultado natural de dividir por cero al calcular una media, y
    // colarlo produce un fichero que Excel abre con la celda en blanco: silencio.
    for (const malo of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => libro([{ nombre: 'H', filas: [[{ valor: malo }]] }]), String(malo)).toThrow(RangeError)
    }
  })

  it('una fila que no es un array', () => {
    expect(() => libro([{ nombre: 'H', filas: ['abc'] }])).toThrow(TypeError)
    expect(() => libro([{ nombre: 'H', filas: 'abc' }])).toThrow(TypeError)
  })

  it('un ancho de columna que no es un número positivo', () => {
    for (const malo of [0, -3, 'ancho', null, Number.NaN]) {
      expect(() => libro([{ nombre: 'H', filas: [['a']], columnas: [{ ancho: malo }] }])).toThrow(RangeError)
    }
  })

  it('el mensaje del error dice QUÉ celda es', () => {
    expect(() => libro([{ nombre: 'H', filas: [['a'], ['b', { valor: Number.NaN }]] }])).toThrow(/B2/)
  })
})
