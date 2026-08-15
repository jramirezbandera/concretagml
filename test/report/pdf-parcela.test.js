/* -------------------------------------------------------------------------- *
 * test/report/pdf-parcela.test.js — F09 · T3.2 · La maqueta del informe       *
 *                                                                            *
 * `report/pdf-parcela.js` produce un binario. Eso significa que la pregunta   *
 * «¿está bien?» no se contesta mirando lo que devuelve —siempre devuelve      *
 * bytes, y unos bytes con el plano encima del texto tienen exactamente la     *
 * misma pinta que unos buenos—, sino RELEYENDO lo escrito con otro criterio.  *
 * Este fichero está montado en cuatro capas:                                  *
 *                                                                            *
 *  1. **Un oráculo que vuelve a leer el PDF y saca su TEXTO**, literal a      *
 *     literal, decodificando CP1252 al revés. Sobre ese texto se afirma que   *
 *     el documento DICE lo que tiene que decir —las seis secciones de         *
 *     `spec/feature-09-informe-parcela.md` §Contenido, el nombre correcto, la *
 *     escala, el identificador— y, sobre todo, que **NO dice lo prohibido**:  *
 *     el guardián de vocabulario de mérito de F08, copiado entero, y las      *
 *     siglas de los documentos oficiales del Catastro, que en un papel que se *
 *     firma no pueden aparecer ni dentro de una negación.                     *
 *                                                                            *
 *  2. **Un oráculo GEOMÉTRICO**, que es el que de verdad protege y el que un  *
 *     snapshot de bytes no puede dar: saca de los operadores `Tm` la posición *
 *     de cada renglón y del `cm`/`Do` el rectángulo del plano, y afirma que   *
 *     ningún texto cae dentro del plano, que ninguno se sale de la caja útil  *
 *     y que no hay dos renglones dibujados en el MISMO punto (que es como se  *
 *     ve una fila de tabla pintada dos veces). Un informe que compila y sale  *
 *     con el plano pisando el texto es un informe roto, y sin esto pasaría.   *
 *                                                                            *
 *  3. **Los datos son REALES.** `diagnosticar()` de verdad sobre los fixtures *
 *     del WFS, `describirLindero()` de verdad, `componerEncabezado()` sobre   *
 *     los dos fixtures de `Consulta_DNPRC` —urbana y rústica—, y el JPEG de   *
 *     `test/fixtures/report/plano-prueba.jpg`. **No se inventa un POJO**: un  *
 *     informe montado sobre datos de juguete demuestra que el maquetador      *
 *     compila, no que el documento sirva.                                     *
 *                                                                            *
 *  4. **El SNAPSHOT de bytes, y va el ÚLTIMO.** Un snapshot está a un `-u` de *
 *     no significar nada; delante van las afirmaciones que sobreviven a una   *
 *     actualización distraída. Misma doctrina que `test/report/pdf.test.js` y *
 *     `test/report/contraste-texto.test.js`.                                  *
 *                                                                            *
 * ⚠️ VERIFICADO ADEMÁS FUERA DE LA SUITE, el 2026-08-02: las dos variantes    *
 * del informe (urbana y rústica) se renderizaron a PNG con el motor de PDF de *
 * Windows (`Windows.Data.Pdf`, el de Edge) y se miraron página a página. A4   *
 * exacto (793,70 × 1122,52 DIP = 210 × 297 mm). Eso destapó tres cosas que    *
 * ningún test de bytes habría dicho, y las tres están corregidas: el epígrafe *
 * «FIRMA» se quedaba HUÉRFANO al pie de la página anterior, las columnas de   *
 * la tabla de tramos se tocaban («26,50 m 9398517VK3799G» se leía como un     *
 * solo dato) y el alto del plano salía como «129.9624» —punto inglés, cuatro  *
 * decimales— en un documento que escribe «163,79 m» dos páginas más allá.     *
 * Si alguien toca la maqueta, toca repetirlo.                                 *
 *                                                                            *
 * Proyecto Vitest `node`: el módulo es puro. **Sin sufijo `.dom`.**           *
 * -------------------------------------------------------------------------- */

import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { diagnosticar } from '../../diagnostico/parcela.js'
import { superficie } from '../../geo/area.js'
import { parsearGml } from '../../gml/parse.js'
import { encuadrar } from '../../report/encuadre.js'
import { componerEncabezado } from '../../report/firma.js'
import { describirLindero } from '../../report/literal.js'
import { A4_ALTO_MM, A4_ANCHO_MM, ANCHOS_AFM, PUNTOS_POR_MM } from '../../report/pdf.js'
import {
  NOMBRE_INFORME,
  PRESUNCION_CONOCIDA,
  informePdfParcela,
} from '../../report/pdf-parcela.js'
import { leerDnprc } from '../../services/_catastro-dnp.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const FUENTE_MODULO = readFileSync(join(RAIZ, 'report', 'pdf-parcela.js'), 'utf8')
const FUENTE_LITERAL = readFileSync(join(RAIZ, 'report', 'literal.js'), 'utf8')

/** Clon profundo por JSON: vale porque el modelo es POJO plano (regla de oro 4). */
const clon = (v) => JSON.parse(JSON.stringify(v))

// ═════════════════════════════════════════════════════════════════════════════
// Los fixtures REALES
// ═════════════════════════════════════════════════════════════════════════════

const REF = '9398516VK3799G'
const REF_RUSTICA = '13005A10900005'

const RUTA_GML_PARCELA = join(RAIZ, 'test', 'fixtures', 'gml', 'cp_parcela_9398516VK3799G.gml')

/** La parcela y sus cuatro colindantes, del WFS, sin tocar un vértice. */
const VECINDARIO = parsearGml(
  readFileSync(
    join(RAIZ, 'test', 'fixtures', 'catastro', 'wfs-neighbour-9398516VK3799G.xml'),
    'utf8',
  ),
)
const TODAS = VECINDARIO.parcelas.map((p) => ({
  refcat: p.refcat,
  label: p.label,
  recintos: p.recintos,
}))
const PROPIA = TODAS.find((v) => v.refcat === REF)
const VECINAS = TODAS.filter((v) => v.refcat !== REF)

/** El GML de UNA parcela: el fichero que el usuario soltaría en la ventana. */
const FICHERO = parsearGml(readFileSync(RUTA_GML_PARCELA, 'utf8'))
const DEL_FICHERO = FICHERO.parcelas[0]
const DECLARADA = DEL_FICHERO.areaValue

/** La geometría OFICIAL, intacta. Se clona en cada uso: regla de oro 2. */
const oficial = () => clon(PROPIA.recintos)

/**
 * La geometría EDITADA: la oficial con su primer vértice movido **0,40 m al
 * este**. Es el mismo caso de `test/diagnostico/parcela.test.js` y de
 * `test/report/contraste-texto.test.js`, elegido porque una sola edición produce
 * las ocho métricas a la vez — incluidas invasiones REALES a tres colindantes.
 */
function editada() {
  const r = clon(PROPIA.recintos)
  r[0].vertices[0] = [r[0].vertices[0][0] + 0.4, r[0].vertices[0][1]]
  return r
}

/** Instante FIJO. La fecha entra dentro del encabezado; el módulo no lee el reloj. */
const FECHA = new Date(Date.UTC(2026, 7, 2, 17, 4, 53))

/**
 * Un JPEG REAL de 24×16 px, el mismo fixture que usa `test/report/pdf.test.js`:
 * trae su APP0/JFIF, sus tablas de cuantización y de Huffman y su SOF0 de 3
 * componentes, que es la forma de lo que devuelve el WMS del Catastro.
 *
 * Es diminuto a propósito: aquí se prueba la MAQUETA, no la cartografía, y un
 * plano de 272 kB metería un cuarto de megabyte en cada snapshot.
 */
const JPEG = Uint8Array.from(
  readFileSync(join(RAIZ, 'test', 'fixtures', 'report', 'plano-prueba.jpg')),
)
const JPEG_ANCHO_PX = 24
const JPEG_ALTO_PX = 16

/** Los dos fixtures de `Consulta_DNPRC`, medidos en vivo en F09/T0.2. */
const DNP_URBANA = leerDnprc(
  readFileSync(
    join(RAIZ, 'test', 'fixtures', 'catastro', 'ovc-dnprc-urbana-9398516VK3799G.json'),
    'utf8',
  ),
)
const DNP_RUSTICA = leerDnprc(
  readFileSync(
    join(RAIZ, 'test', 'fixtures', 'catastro', 'ovc-dnprc-rustica-13005A10900005.json'),
    'utf8',
  ),
)

// ═════════════════════════════════════════════════════════════════════════════
// Las piezas, todas producidas de verdad
// ═════════════════════════════════════════════════════════════════════════════

const recintos = editada()

const diagnostico = diagnosticar({
  recintos: editada(),
  geometriaOficial: oficial(),
  superficieCatastral: DECLARADA,
  superficieRegistral: null,
  vecinas: VECINAS,
  refcat: REF,
})

const literal = describirLindero({ recintos: editada(), vecinas: VECINAS, clase: 'URBANA' })

/**
 * El encuadre del plano. **El alto se deriva del JPEG**, no al revés: el módulo
 * contrasta la relación de aspecto del papel contra la de la imagen y lanza si no
 * cuadran, así que un encuadre inventado a mano reventaría — que es justo lo que
 * se quiere de esa guarda.
 */
const ANCHO_PLANO_MM = 180
const ALTO_PLANO_MM = (ANCHO_PLANO_MM * JPEG_ALTO_PX) / JPEG_ANCHO_PX
const encuadre = encuadrar({
  recintos: editada(),
  otrosRecintos: [oficial()],
  anchoMm: ANCHO_PLANO_MM,
  altoMm: ALTO_PLANO_MM,
})

/** El contrato B, con la FORMA que devuelve `report/canvas.js#componerPlano`. */
function planoDe(cambios = {}) {
  return {
    jpeg: JPEG,
    anchoPx: JPEG_ANCHO_PX,
    altoPx: JPEG_ALTO_PX,
    teselasPedidas: 1,
    capasUsadas: ['Catastro'],
    capasCaidas: [],
    atribucion: '© Dirección General del Catastro',
    teselasCaidas: [],
    ...cambios,
  }
}

/** La `Comprobacion` (contrato B de F08), con los números de los ficheros reales. */
function comprobacionDe(cambios = {}) {
  return {
    fichero: {
      nombre: 'cp_parcela_9398516VK3799G.gml',
      bytes: statSync(RUTA_GML_PARCELA).size,
      encodingDeclarado: FICHERO.resumen.encodingDeclarado,
      encodingUsado: 'utf-8',
    },
    dialecto: {
      id: FICHERO.dialecto,
      soportado: FICHERO.soportado,
      etiqueta: 'Parcela catastral INSPIRE CP 4.0 (descarga del WFS)',
      queSignifica:
        'Es el fichero que devuelve el servicio WFS del Catastro cuando se le pide una parcela.',
    },
    miembros: [
      {
        indice: 0,
        refcat: DEL_FICHERO.refcat,
        localId: DEL_FICHERO.localId,
        etiqueta: `${DEL_FICHERO.refcat} (cp:label ${DEL_FICHERO.label})`,
        nVertices: recintos[0].vertices.length,
        nHuecos: recintos.length - 1,
        superficieDeclarada: DECLARADA,
        superficieMedida: superficie(recintos),
        srs: DEL_FICHERO.srs,
        orientacionExterior: DEL_FICHERO.orientacion[0],
      },
    ],
    elegido: 0,
    geometria: { recintos: editada(), srs: DEL_FICHERO.srs },
    hallazgos: [],
    notas: [],
    bloqueos: [],
    puedeContinuar: true,
    motivoNoContinua: null,
    ...cambios,
  }
}

/** La parcela del modelo (POJO plano). */
function parcelaDe(cambios = {}) {
  return {
    idLocal: 'parcela-1',
    refcat: REF,
    srs: 'EPSG:25830',
    recintos: editada(),
    geometriaOficial: oficial(),
    superficieRegistral: null,
    superficieCatastral: DECLARADA,
    origen: 'GML_EXISTENTE',
    ...cambios,
  }
}

const FIRMA = Object.freeze({
  nombre: 'Javier Ramírez Bandera',
  numeroColegiado: '04321',
  colegio: 'Colegio Oficial de Arquitectos de Málaga',
  contacto: 'jramirezbandera@gmail.com',
})

const encabezadoUrbano = () =>
  componerEncabezado({
    descriptivos: DNP_URBANA,
    refcat: REF,
    srs: 'EPSG:25830',
    fecha: FECHA,
    idDocumento: null,
  })

const encabezadoRustico = () =>
  componerEncabezado({
    descriptivos: DNP_RUSTICA,
    refcat: REF_RUSTICA,
    srs: 'EPSG:25830',
    fecha: FECHA,
    idDocumento: null,
  })

/** El informe del caso completo, con todo real. */
function informe(entrada = {}) {
  return informePdfParcela({
    diagnostico,
    encabezado: encabezadoUrbano(),
    parcela: parcelaDe(),
    comprobacion: comprobacionDe(),
    plano: planoDe(),
    encuadre,
    literal,
    firma: FIRMA,
    procedencia: DNP_URBANA,
    ...entrada,
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// Oráculo 1 · releer el PDF y sacar su texto
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Reverso de la franja 0x80–0x9F de CP1252, la única que no es Latin-1. Sin ella,
 * una raya «—» (0x97) volvería como un carácter de control y las aserciones sobre
 * frases con raya no casarían nunca.
 */
const ALTOS_CP1252 = Object.freeze({
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
})

/** Bytes CP1252 → string. */
const deCp1252 = (bytes) =>
  bytes.map((b) => ALTOS_CP1252[b] ?? String.fromCharCode(b)).join('')

/**
 * Ancho en milímetros de una tira de bytes CP1252, con las tablas AFM del propio
 * escritor. Indexadas por BYTE, que es como las guarda `report/pdf.js` y por lo
 * que aquí se conservan los bytes en vez del string.
 */
const anchoAfm = (bytes, tam, negrita) => {
  const tabla = ANCHOS_AFM[negrita ? 'negrita' : 'normal']
  return (bytes.reduce((s, b) => s + tabla[b], 0) / 1000) * tam
}

/**
 * Los bytes como texto latin-1. **El truco que hace posible todo lo demás**: en
 * latin-1 cada byte es exactamente un carácter, así que el índice de un string ES
 * el desplazamiento de byte y las expresiones regulares no se comen los bytes
 * altos del JPEG.
 */
const aLatin1 = (bytes) => Buffer.from(bytes).toString('latin1')

/**
 * Los streams de CONTENIDO del PDF, uno por página y en orden.
 *
 * Se descartan los streams de imagen mirando el diccionario que los precede: los
 * bytes de un JPEG pueden contener por casualidad cualquier secuencia, `Tj`
 * incluida, y tomarlos por texto llenaría las aserciones de basura.
 */
function streamsDeContenido(bytes) {
  const texto = aLatin1(bytes)
  const salida = []
  const re = /stream\n([\s\S]*?)\nendstream/g
  let m
  while ((m = re.exec(texto)) !== null) {
    const dicc = texto.slice(Math.max(0, m.index - 240), m.index)
    if (dicc.includes('/Subtype /Image')) continue
    salida.push(m[1])
  }
  return salida
}

/**
 * Los renglones de un stream de contenido, con su posición.
 *
 * De cada bloque `BT … Tm … (…) Tj … ET` se saca el texto, el punto de la línea
 * base y el tamaño de letra. Las coordenadas se devuelven **en milímetros desde
 * arriba**, que es como piensa la maqueta: el PDF las escribe en puntos y con la
 * Y desde abajo, y comparar en esa otra convención es cómo se cuela un error de
 * signo en un test que luego da verde.
 */
function renglonesDe(stream) {
  const salida = []
  const re = /\/F(\d) ([\d.]+) Tf\n1 0 0 1 ([-\d.]+) ([-\d.]+) Tm\n\(/g
  let m
  while ((m = re.exec(stream)) !== null) {
    const desde = re.lastIndex
    const bytesTexto = []
    let i = desde
    while (i < stream.length) {
      const c = stream[i]
      if (c === '\\') {
        bytesTexto.push(stream.charCodeAt(i + 1))
        i += 2
        continue
      }
      if (c === ')') break
      bytesTexto.push(stream.charCodeAt(i))
      i += 1
    }
    const negrita = m[1] === '2'
    const tam = Number(m[2]) / PUNTOS_POR_MM
    salida.push({
      texto: deCp1252(bytesTexto),
      negrita,
      tam,
      x: Number(m[3]) / PUNTOS_POR_MM,
      // Y del PDF (desde abajo) → milímetros desde el borde superior.
      y: A4_ALTO_MM - Number(m[4]) / PUNTOS_POR_MM,
      // El ancho REAL sobre el papel, con las mismas métricas AFM que usó el
      // escritor —contrastadas contra `arial.ttf` en `test/report/pdf.test.js`—
      // y sobre los BYTES, no sobre el string: es la única cuenta que dice si
      // un renglón se sale de la hoja.
      anchoMm: anchoAfm(bytesTexto, tam, negrita),
    })
  }
  return salida
}

/**
 * El rectángulo de cada imagen incrustada, en milímetros desde arriba. Sale del
 * `cm` que precede al `Do`: `w 0 0 h x y cm` coloca la imagen con `(x, y)` en su
 * esquina INFERIOR izquierda.
 */
function imagenesDe(stream) {
  const salida = []
  const re = /([\d.]+) 0 0 ([\d.]+) ([-\d.]+) ([-\d.]+) cm\n\/Im\d+ Do/g
  let m
  while ((m = re.exec(stream)) !== null) {
    const ancho = Number(m[1]) / PUNTOS_POR_MM
    const alto = Number(m[2]) / PUNTOS_POR_MM
    const x = Number(m[3]) / PUNTOS_POR_MM
    const yAbajo = Number(m[4]) / PUNTOS_POR_MM
    salida.push({ x, ancho, alto, y: A4_ALTO_MM - yAbajo - alto })
  }
  return salida
}

/** Todo el documento, ya leído: renglones e imágenes por página. */
function leerInforme(bytes) {
  const paginas = streamsDeContenido(bytes).map((s) => ({
    renglones: renglonesDe(s),
    imagenes: imagenesDe(s),
  }))
  return {
    paginas,
    /** Todos los renglones sueltos, en orden de escritura. */
    lineas: paginas.flatMap((p) => p.renglones.map((r) => r.texto)),
    /**
     * El documento como una sola cadena con los renglones unidos por espacio. Es
     * lo que permite afirmar frases enteras: `partirTexto` las parte en varios
     * `Tj` y buscarlas en una línea suelta no encontraría nunca nada.
     */
    corrido: paginas
      .flatMap((p) => p.renglones.map((r) => r.texto))
      .join(' ')
      .replace(/\s+/g, ' '),
  }
}

/** El `/Count` que declara el nodo Pages, que es la otra cuenta de páginas. */
function paginasDeclaradas(bytes) {
  const m = /\/Type \/Pages \/Count (\d+)/.exec(aLatin1(bytes))
  return m === null ? 0 : Number(m[1])
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · El documento existe, es un PDF y es A4
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-parcela · el documento', () => {
  const r = informe()

  it('devuelve bytes de un PDF, con su cabecera y su %%EOF', () => {
    expect(r.bytes).toBeInstanceOf(Uint8Array)
    const texto = aLatin1(r.bytes)
    expect(texto.startsWith('%PDF-1.4\n')).toBe(true)
    expect(texto.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('es A4 exacto, en todas sus páginas', () => {
    const esperado = `[0 ${0} ${(A4_ANCHO_MM * PUNTOS_POR_MM).toFixed(3).replace(/\.?0+$/, '')} ${(
      A4_ALTO_MM * PUNTOS_POR_MM
    )
      .toFixed(3)
      .replace(/\.?0+$/, '')}]`
    const cajas = aLatin1(r.bytes).match(/\/MediaBox \[[^\]]+\]/g) ?? []
    expect(cajas.length).toBe(r.nPaginas)
    for (const caja of cajas) expect(caja).toBe(`/MediaBox ${esperado}`)
  })

  it('la cuenta de páginas que devuelve es la que declara el PDF', () => {
    expect(r.nPaginas).toBeGreaterThan(1)
    expect(paginasDeclaradas(r.bytes)).toBe(r.nPaginas)
    expect(leerInforme(r.bytes).paginas.length).toBe(r.nPaginas)
  })

  it('devuelve el identificador, el título y un nombre de fichero rastreable', () => {
    expect(r.idDocumento).toBe('CG-9398516VK3799G-20260802-170453Z')
    expect(r.titulo).toBe(NOMBRE_INFORME)
    expect(r.nombreFichero).toBe(`informe-contraste-${r.idDocumento}.pdf`)
    expect(r.nombreFichero.endsWith('.pdf')).toBe(true)
  })

  it('el mismo instante produce los mismos bytes, dos veces seguidas', () => {
    expect(Buffer.from(informe().bytes).equals(Buffer.from(informe().bytes))).toBe(true)
  })

  it('metadatos: título con el nombre legal, productor y fecha INYECTADA', () => {
    const texto = aLatin1(r.bytes)
    // Las cadenas de TEXTO del /Info van en UTF-16BE con BOM (auditoría R1:
    // fuera de los content streams el estándar exige PDFDocEncoding o UTF-16BE,
    // y CP1252 diverge de PDFDocEncoding en 0x80–0x9F). En latin-1, cada
    // carácter del título es «byte alto + byte bajo».
    const utf16 = (s) =>
      '\xfe\xff' +
      [...s]
        .map(
          (c) =>
            String.fromCharCode(c.charCodeAt(0) >> 8) +
            String.fromCharCode(c.charCodeAt(0) & 0xff),
        )
        .join('')
    expect(texto).toContain(`/Title (${utf16(`${NOMBRE_INFORME} · ${r.idDocumento}`)})`)
    expect(texto).toContain(`/Producer (${utf16('Concreta GML')})`)
    // La fecha sigue en ASCII: el formato `D:…` es una cadena de bytes.
    expect(texto).toContain("/CreationDate (D:20260802170453Z00'00')")
    // Y el pie de página repite el título en CP1252, dentro del content stream.
    expect(texto).toContain(`(${NOMBRE_INFORME} · ${r.idDocumento})`)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · El documento DICE lo que tiene que decir
// ═════════════════════════════════════════════════════════════════════════════

/** Los epígrafes de sección: `4.  DIAGNÓSTICO DE ENCAJE…`. */
const seccionesDe = (leido) =>
  leido.lineas
    .map((l) => /^(\d+)\.\s\s(.+)$/.exec(l))
    .filter((m) => m !== null)
    .map((m) => ({ n: Number(m[1]), titulo: m[2] }))

describe('report/pdf-parcela · las secciones del §Contenido de la spec', () => {
  const leido = leerInforme(informe().bytes)
  const secciones = seccionesDe(leido)

  it('salen las siete, en el orden de la spec y sin hueco en la numeración', () => {
    expect(secciones.map((s) => s.titulo)).toEqual([
      'IDENTIFICACIÓN',
      'PLANO DE SITUACIÓN',
      'RELACIÓN DE VÉRTICES',
      'DIAGNÓSTICO DE ENCAJE Y COMPARACIÓN A TRES BANDAS',
      'DESCRIPCIÓN LITERARIA DEL LINDERO',
      'PROCEDENCIA Y LECTURA DEL FICHERO APORTADO',
      'FIRMA',
    ])
    expect(secciones.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('sin fichero, la sección de procedencia DESAPARECE y no deja hueco', () => {
    const sin = seccionesDe(leerInforme(informe({ comprobacion: null }).bytes))
    expect(sin.map((s) => s.titulo)).toEqual([
      'IDENTIFICACIÓN',
      'PLANO DE SITUACIÓN',
      'RELACIÓN DE VÉRTICES',
      'DIAGNÓSTICO DE ENCAJE Y COMPARACIÓN A TRES BANDAS',
      'DESCRIPCIÓN LITERARIA DEL LINDERO',
      'FIRMA',
    ])
    // Las SEIS de la spec, numeradas 1…6, exactamente como las enumera §Contenido.
    expect(sin.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('1 · el encabezado trae municipio, SRS, fecha e identificador de documento', () => {
    expect(leido.corrido).toContain('Municipio MADRID')
    expect(leido.corrido).toContain('Referencia catastral 9398516VK3799G')
    expect(leido.corrido).toContain('Sistema de referencia EPSG:25830')
    expect(leido.corrido).toContain('Fecha del informe 02/08/2026 17:04 (UTC)')
    expect(leido.corrido).toContain(
      'Identificador del documento CG-9398516VK3799G-20260802-170453Z',
    )
  })

  it('2 · el plano rotula la escala NUMÉRICA que calculó el encuadre', () => {
    expect(encuadre.escalaDenominador).toBeGreaterThan(0)
    expect(leido.corrido).toContain(`Escala 1:${encuadre.escalaDenominador}`)
    // Y el JPEG está de verdad incrustado, con su tamaño declarado.
    expect(leido.paginas[0].imagenes.length).toBe(1)
    expect(aLatin1(informe().bytes)).toContain(
      `/Width ${JPEG_ANCHO_PX} /Height ${JPEG_ALTO_PX}`,
    )
    // El norte y la barra gráfica van DENTRO del JPEG; lo que el papel tiene que
    // decir es contra qué norte está dibujado.
    expect(leido.corrido).toContain('norte del plano es el de CUADRÍCULA')
  })

  it('3 · la relación de vértices trae superficie, perímetro y las 15 coordenadas', () => {
    expect(leido.corrido).toContain('Superficie medida 1.538,99 m²')
    expect(leido.corrido).toContain('Perímetro total 163,79 m')
    expect(leido.corrido).toContain('Exterior — 15 vértices')
    // Un vértice cualquiera, con sus dos decimales y sin separador de millar.
    expect(leido.corrido).toContain('439222,47 4479678,13')
  })

  it('4 · el diagnóstico trae las CUATRO superficies y los TRES pares cruzados', () => {
    expect(leido.corrido).toContain('Medida sobre la geometría de la parcela 1.538,99 m²')
    expect(leido.corrido).toContain('Declarada por el Catastro (cp:areaValue) 1.536 m²')
    expect(leido.corrido).toContain('Medida sobre el contorno oficial del Catastro 1.535,87 m²')
    expect(leido.corrido).toContain('Medición - Catastro')
    expect(leido.corrido).toContain('Medición - Registro')
    expect(leido.corrido).toContain('Catastro - Registro')
  })

  it('5 · el lindero sale en cuerpo NORMAL y la nota técnica en cuerpo MENOR', () => {
    const renglones = leido.paginas.flatMap((p) => p.renglones)
    const delLindero = renglones.find((r) => r.texto.startsWith('Linda al Este,'))
    const deLaNota = renglones.find((r) => r.texto.startsWith('Nota técnica.'))
    expect(delLindero, 'no está el primer párrafo del lindero').toBeDefined()
    expect(deLaNota, 'no está la nota técnica').toBeDefined()
    // Por eso `literal.js` los devuelve SEPARADOS: para poder darles cuerpos
    // distintos sin trocear una cadena.
    expect(deLaNota.tam).toBeLessThan(delLindero.tam)
  })

  it('7 · el pie de firma imprime los cuatro campos', () => {
    expect(leido.corrido).toContain('Nombre y apellidos Javier Ramírez Bandera')
    expect(leido.corrido).toContain('Número de colegiado 04321')
    expect(leido.corrido).toContain('Colegio profesional Colegio Oficial de Arquitectos de Málaga')
    expect(leido.corrido).toContain('Contacto jramirezbandera@gmail.com')
  })

  it('la atribución legal de la cartografía va al pie de TODAS las páginas', () => {
    for (const pagina of leido.paginas) {
      const textos = pagina.renglones.map((r) => r.texto)
      expect(textos).toContain('© Dirección General del Catastro')
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · «Página N de M», que es para lo que existe `irAPagina`
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-parcela · numeración de páginas', () => {
  it('cada página lleva la suya, y M es el total REAL', () => {
    const r = informe()
    const leido = leerInforme(r.bytes)
    expect(leido.paginas.length).toBe(r.nPaginas)
    leido.paginas.forEach((pagina, i) => {
      const esperado = `Página ${i + 1} de ${r.nPaginas}`
      const encontrados = pagina.renglones.filter((x) => /^Página \d+ de \d+$/.test(x.texto))
      expect(encontrados.map((x) => x.texto), `pie de la página ${i + 1}`).toEqual([esperado])
    })
  })

  it('el identificador del documento va también en el pie de cada página', () => {
    const r = informe()
    for (const pagina of leerInforme(r.bytes).paginas) {
      expect(pagina.renglones.map((x) => x.texto)).toContain(
        `${NOMBRE_INFORME} · ${r.idDocumento}`,
      )
    }
  })

  it('un informe más largo sube la M en TODAS las páginas, no solo en la última', () => {
    // Se alarga de verdad —cien hallazgos reales de la comprobación— en vez de
    // fingirlo: lo que se prueba es que el pie se estampa DESPUÉS de saber cuántas
    // páginas hay, y eso solo se ve cuando el número cambia.
    const largo = informe({
      comprobacion: comprobacionDe({
        hallazgos: Array.from({ length: 100 }, (_, i) => ({
          nivel: 'AVISO',
          mensaje: `Hallazgo de prueba número ${i + 1} sobre la geometría de la parcela.`,
        })),
      }),
    })
    expect(largo.nPaginas).toBeGreaterThan(informe().nPaginas)
    const primera = leerInforme(largo.bytes).paginas[0]
    expect(primera.renglones.map((x) => x.texto)).toContain(`Página 1 de ${largo.nPaginas}`)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Oráculo geométrico — lo que un snapshot de bytes NO puede decir
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-parcela · el papel, medido', () => {
  const leido = leerInforme(informe().bytes)

  it('ningún renglón cae DENTRO del plano', () => {
    // Es el fallo que el encargo nombra: «un informe que compila y sale con el
    // plano pisando el texto es un informe roto, y ningún test de bytes te lo va a
    // decir». Aquí sí lo dice.
    for (const [i, pagina] of leido.paginas.entries()) {
      for (const imagen of pagina.imagenes) {
        for (const r of pagina.renglones) {
          // Intersección de rectángulos de verdad: la caja del renglón es su
          // línea base con el ancho REAL que le dan las métricas AFM.
          const pisaEnX = r.x < imagen.x + imagen.ancho && r.x + r.anchoMm > imagen.x
          const pisaEnY = r.y > imagen.y + 0.5 && r.y < imagen.y + imagen.alto - 0.5
          expect(
            pisaEnX && pisaEnY,
            `página ${i + 1}: «${r.texto}» cae dentro del plano (${imagen.x}, ${imagen.y})`,
          ).toBe(false)
        }
      }
    }
  })

  it('ningún renglón se sale de la caja útil de la hoja', () => {
    for (const [i, pagina] of leido.paginas.entries()) {
      for (const r of pagina.renglones) {
        expect(r.x, `página ${i + 1}: «${r.texto}» se sale por la izquierda`).toBeGreaterThanOrEqual(
          14.9,
        )
        expect(r.y, `página ${i + 1}: «${r.texto}» sube por encima del margen`).toBeGreaterThan(15)
        expect(r.y, `página ${i + 1}: «${r.texto}» se cae de la hoja`).toBeLessThan(A4_ALTO_MM - 5)
      }
    }
  })

  it('ningún renglón termina fuera del papel por la derecha', () => {
    // `partirTexto` promete que ninguna línea excede el ancho que se le pidió;
    // esto lo comprueba sobre lo que de VERDAD se ha dibujado, midiéndolo con las
    // mismas tablas AFM. Es la aserción que caza una columna mal dimensionada o un
    // renglón puesto a mano fuera de la caja.
    for (const [i, pagina] of leido.paginas.entries()) {
      for (const r of pagina.renglones) {
        expect(
          r.x + r.anchoMm,
          `página ${i + 1}: «${r.texto}» termina en ${(r.x + r.anchoMm).toFixed(1)} mm`,
        ).toBeLessThanOrEqual(A4_ANCHO_MM - 15 + 0.5)
      }
    }
  })

  it('no hay dos renglones dibujados en el MISMO punto', () => {
    // Es como se ve una fila de tabla pintada dos veces, que es el fallo que tuvo
    // la primera versión del salto de página de las tablas: la fila se dibujaba,
    // saltaba de hoja y se repintaba encima de la cabecera repetida.
    for (const [i, pagina] of leido.paginas.entries()) {
      const vistos = new Set()
      for (const r of pagina.renglones) {
        const clave = `${r.x.toFixed(2)}|${r.y.toFixed(2)}`
        expect(vistos.has(clave), `página ${i + 1}: dos renglones en (${clave}) — «${r.texto}»`).toBe(
          false,
        )
        vistos.add(clave)
      }
    }
  })

  it('ningún epígrafe de sección se queda HUÉRFANO al pie de una página', () => {
    // MEDIDO al renderizar: «7. FIRMA» salía solo al final de la página 4 y su
    // contenido empezaba en la 5. Un rótulo sin nada debajo se lee como una
    // sección vacía.
    for (const [i, pagina] of leido.paginas.entries()) {
      const renglones = pagina.renglones
      renglones.forEach((r, k) => {
        if (!/^\d+\.\s\s[A-ZÁÉÍÓÚÑ]/.test(r.texto)) return
        const debajo = renglones.slice(k + 1).filter((x) => x.y > r.y && x.y < A4_ALTO_MM - 20)
        expect(
          debajo.length,
          `página ${i + 1}: el epígrafe «${r.texto}» se queda sin contenido debajo`,
        ).toBeGreaterThan(0)
      })
    }
  })

  it('el plano se imprime al tamaño que declaró el encuadre, sin reescalar', () => {
    const imagen = leido.paginas[0].imagenes[0]
    expect(imagen.ancho).toBeCloseTo(ANCHO_PLANO_MM, 3)
    expect(imagen.alto).toBeCloseTo(ALTO_PLANO_MM, 3)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Lo que el informe tiene PROHIBIDO decir
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Vocabulario de VEREDICTO, copiado de `test/report/contraste-texto.test.js`.
 * Ninguna de estas palabras puede salir del informe: «la aplicación mide; el
 * colegiado interpreta y firma» (SPEC §2, regla 9).
 */
const VEREDICTO = Object.freeze([
  /\bválid[oa]s?\b/i,
  /\binválid[oa]s?\b/i,
  /\bcorrect[oa]s?\b/i,
  /\bincorrect[oa]s?\b/i,
  /\bapt[oa]s?\b/i,
  /\bcumple[n]?\b/i,
  /\bincumple[n]?\b/i,
  /\bconforme[s]?\b/i,
  /\btoleranci[ao]s?\b/i,
  /\bsemáforos?\b/i,
  /\bumbral(es)?\b/i,
  /\baprobad[oa]s?\b/i,
  /\bsuspens[oa]s?\b/i,
  /\bacept(able|ables|ado|ada)\b/i,
])

const veredictosEn = (texto) =>
  VEREDICTO.flatMap((re) => {
    const m = re.exec(texto)
    return m === null ? [] : [`${m[0]} (${re})`]
  })

describe('report/pdf-parcela · guardián de la regla de oro 9', () => {
  const leido = leerInforme(informe().bytes)

  it('no hay una sola palabra de veredicto en todo el papel', () => {
    expect(
      veredictosEn(leido.corrido),
      'la aplicación mide y el colegiado firma: ninguna cifra puede llevar juicio de valor',
    ).toEqual([])
  })

  it('el guardián DISPARA si alguien mete una palabra de veredicto', () => {
    // La mitad anti-vacuidad: un guardián que nunca puede fallar no protege nada.
    expect(veredictosEn(`${leido.corrido} La geometría es correcta.`)).not.toEqual([])
    expect(veredictosEn('la parcela es válida')).not.toEqual([])
    const cebos = [
      'válido', 'inválido', 'correcto', 'incorrecto', 'apto', 'cumple', 'incumple',
      'conforme', 'tolerancia', 'semáforo', 'umbral', 'aprobado', 'suspenso', 'aceptable',
    ]
    for (const re of VEREDICTO) {
      expect(
        cebos.some((c) => re.test(c)),
        `la regex ${re} no caza ninguno de los cebos: está muerta`,
      ).toBe(true)
    }
  })

  it('el margen del BOE se ENUNCIA y no se enfrenta a ninguna medida', () => {
    const desde = leido.lineas.findIndex((l) => /Margen oficial de identidad/.test(l))
    const hasta = leido.lineas.findIndex((l) => /Lo que no se ha podido medir/.test(l))
    expect(desde).toBeGreaterThan(-1)
    expect(hasta).toBeGreaterThan(desde)
    const bloque = leido.lineas.slice(desde, hasta).join(' ').replace(/\s+/g, ' ')
    expect(bloque).toContain('ENUNCIA')
    // La etiqueta viaja DENTRO del diagnóstico, justo para que no se pueda escribir
    // la cifra sin ella; sale con inicial mayúscula por ir a principio de frase.
    expect(/margen de identidad del Catastro/i.test(bloque)).toBe(true)
    for (const prohibido of [/dentro de/i, /por debajo de/i, /supera/i, /excede/i, /se ajusta/i]) {
      expect(prohibido.test(bloque), `el margen se está comparando: ${prohibido}`).toBe(false)
    }
  })

  it('el nombre es el legal, y las siglas de los documentos oficiales NO aparecen', () => {
    expect(leido.lineas).toContain(NOMBRE_INFORME.toUpperCase())
    // JAMÁS «informe de validación gráfica», ni IVG, ni VGA: son documento y
    // servicio OFICIALES del Catastro, con CSV. En un `.txt` que se mira y se tira
    // se pueden nombrar para negarlos; en un papel que se firma, la sigla se lee y
    // la negación no (ver la cabecera del módulo).
    for (const prohibido of [
      /validaci[óo]n gr[áa]fica/i,
      /\bIVG\b/,
      /\bVGA\b/,
      /identidad de la parcela/i,
    ]) {
      expect(prohibido.test(leido.corrido), `el informe dice ${prohibido}`).toBe(false)
    }
    // Y sin embargo la advertencia SÍ está: se dice lo que no es sin nombrarlo.
    expect(leido.corrido).toContain('no es un documento oficial del Catastro')
    expect(leido.corrido).toContain('descargar este fichero no presenta nada ante nadie')
    expect(leido.corrido).toContain('La aplicación mide; el colegiado interpreta y firma')
  })

  it('los mensajes de OTRAS capas se copian tal cual, y eso no es una infracción', () => {
    // Mismo hecho medido que en F08: `validation/` emite «El primer recinto no es
    // un contorno EXTERIOR válido», que habla de un anillo roto y no del encaje de
    // la parcela. Reescribirlo aquí crearía una segunda redacción que puede
    // divergir de la del módulo que la sabe (regla de oro 1).
    const ajeno = 'El primer recinto no es un contorno EXTERIOR válido.'
    const conHallazgo = leerInforme(
      informe({
        comprobacion: comprobacionDe({ hallazgos: [{ nivel: 'ERROR', mensaje: ajeno }] }),
      }).bytes,
    )
    expect(conHallazgo.corrido).toContain(ajeno)
    expect(conHallazgo.corrido).toContain('[ERROR]')
    expect(veredictosEn(conHallazgo.corrido.replace(ajeno, '(mensaje ajeno)'))).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · «No consta» se imprime: el hueco mudo no existe
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-parcela · un dato que falta se escribe, no se deja en blanco', () => {
  it('una superficie registral ausente sale «No consta», nunca «0,00 m²»', () => {
    const leido = leerInforme(informe().bytes)
    expect(leido.corrido).toContain('Registral, de la escritura No consta')
    // Un «0,00 m²» donde falta la superficie registral diría que la escritura
    // declara cero metros cuadrados.
    expect(leido.corrido).not.toContain('Registral, de la escritura 0,00 m²')
  })

  it('los tres pares de la tabla a tres bandas salen SIEMPRE, con «No consta» si falta', () => {
    const leido = leerInforme(informe().bytes)
    expect(leido.corrido).toContain('Medición - Registro No consta No consta')
    expect(leido.corrido).toContain('Catastro - Registro No consta No consta')
  })

  it('una firma en blanco imprime los CUATRO campos con «No consta»', () => {
    const leido = leerInforme(informe({ firma: null }).bytes)
    for (const etiqueta of [
      'Nombre y apellidos',
      'Número de colegiado',
      'Colegio profesional',
      'Contacto',
    ]) {
      expect(leido.corrido).toContain(`${etiqueta} No consta`)
    }
  })

  it('«no se ha consultado» NUNCA se escribe «ninguna»', () => {
    const sinVecinas = diagnosticar({
      recintos: editada(),
      geometriaOficial: oficial(),
      superficieCatastral: DECLARADA,
      superficieRegistral: null,
      vecinas: null,
      refcat: REF,
    })
    const leido = leerInforme(informe({ diagnostico: sinVecinas }).bytes)
    const desde = leido.lineas.findIndex((l) => /Invasión a colindantes/.test(l))
    const hasta = leido.lineas.findIndex((l) => /Margen oficial de identidad/.test(l))
    const bloque = leido.lineas.slice(desde, hasta).join(' ')
    expect(bloque).toContain('No se ha consultado')
    expect(bloque).not.toContain('ninguna')
  })

  it('una sección sin medir imprime SU MOTIVO en el sitio de la cifra que falta', () => {
    const sinOficial = diagnosticar({
      recintos: editada(),
      geometriaOficial: null,
      superficieCatastral: DECLARADA,
      superficieRegistral: null,
      vecinas: null,
      refcat: REF,
    })
    const leido = leerInforme(informe({ diagnostico: sinOficial }).bytes)
    expect(leido.corrido).toContain('No hay geometría oficial con la que contrastar')
    expect(leido.corrido).toContain('Solape con el contorno oficial')
    expect(leido.corrido).toContain('Desviación de lindero')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · La marca de presunción sobrevive al papel
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-parcela · la presunción de vía pública', () => {
  const leido = leerInforme(informe().bytes)

  it('el fixture real trae exactamente un tramo por presunción', () => {
    const conPresuncion = literal.tramos.filter((t) => t.presuncionNoVerificada !== null)
    expect(conPresuncion.length).toBe(1)
    expect(conPresuncion[0].presuncionNoVerificada).toBe(PRESUNCION_CONOCIDA.VIA_PUBLICA)
  })

  it('sale TABULADA, en su propia columna, y no solo dentro de una frase', () => {
    // Es lo que pedía el encargo: que se vea en el PDF, no solo en la cadena de
    // texto que `literal.js` compone. Una advertencia que solo viviera en la prosa
    // se pierde en el primer `replace` de quien edite el borrador.
    expect(leido.lineas).toContain('Atribución')
    expect(leido.lineas).toContain('PRESUNCIÓN no verificada: vía')
    expect(leido.lineas).toContain('Medida')
  })

  it('sale además en un recuadro, con las tres advertencias juntas', () => {
    const dentro = leido.corrido
    expect(dentro).toContain('se describen por PRESUNCIÓN y no por medición')
    expect(dentro).toContain('Dato NO verificado: confirme antes de firmar')
    expect(dentro).toContain('Tramo 4 (Noroeste, 47,21 m)')
  })

  it('un tramo con un código de presunción DESCONOCIDO no pasa por medido', () => {
    // Regla de oro 1: antes un código feo en el papel que un renglón que parezca
    // medido sin serlo.
    const inventado = {
      ...literal,
      tramos: literal.tramos.map((t, i) =>
        i === 0 ? { ...t, presuncionNoVerificada: 'CAUCE_PUBLICO' } : t,
      ),
    }
    const raro = leerInforme(informe({ literal: inventado }).bytes)
    expect(raro.corrido).toContain('PRESUNCIÓN no verificada: CAUCE_PUBLICO')
  })

  it('sin presunción no hay recuadro ni advertencia: la excepción no se usa sola', () => {
    const rustico = describirLindero({ recintos: editada(), vecinas: VECINAS, clase: 'RUSTICA' })
    expect(rustico.tramos.every((t) => t.presuncionNoVerificada === null)).toBe(true)
    const leidoRustico = leerInforme(informe({ literal: rustico }).bytes)
    expect(leidoRustico.corrido).not.toContain('se describen por PRESUNCIÓN')
    expect(leidoRustico.corrido).toContain('Atribución')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Lo que le falta al plano se dice DEBAJO del plano
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-parcela · las capas caídas se declaran', () => {
  const CAIDA = {
    capa: 'Catastro.Building',
    motivo: 'la petición de cartografía no llegó a cargarse (red, CORS o el servicio).',
  }

  it('una capa caída sale en el papel, con su motivo, y en el valor de retorno', () => {
    const r = informe({ plano: planoDe({ capasCaidas: [CAIDA] }) })
    const leido = leerInforme(r.bytes)
    expect(leido.corrido).toContain('Este plano no lleva toda la cartografía de fondo')
    expect(leido.corrido).toContain('Capa «Catastro.Building»')
    expect(leido.corrido).toContain(CAIDA.motivo)
    expect(r.incidencias.length).toBe(1)
    expect(r.incidencias[0]).toContain('Catastro.Building')
  })

  it('se declara DEBAJO del plano, no en una nota final', () => {
    // Regla de oro 1, aplicada al sitio: un motivo leído tres páginas después ya
    // no significa nada. Es la misma doctrina de `viewer/cajon-diagnostico.js`.
    const leido = leerInforme(informe({ plano: planoDe({ capasCaidas: [CAIDA] }) }).bytes)
    const iPlano = leido.lineas.findIndex((l) => /^2\.\s\sPLANO DE SITUACIÓN$/.test(l))
    const iAviso = leido.lineas.findIndex((l) =>
      /Este plano no lleva toda la cartografía/.test(l),
    )
    const iSiguiente = leido.lineas.findIndex((l) => /^3\.\s\sRELACIÓN DE VÉRTICES$/.test(l))
    expect(iPlano).toBeGreaterThan(-1)
    expect(iAviso).toBeGreaterThan(iPlano)
    expect(iAviso).toBeLessThan(iSiguiente)
  })

  it('una tesela caída también se declara, y sin culpar a ninguna capa', () => {
    const r = informe({
      plano: planoDe({
        teselasCaidas: [
          { indice: 0, motivo: 'el servicio devolvió una imagen de 4000×2000 px donde se pidieron 2126×1535 px.' },
        ],
      }),
    })
    const leido = leerInforme(r.bytes)
    expect(leido.corrido).toContain('Trozo de cartografía nº 1')
    expect(leido.corrido).toContain('4000×2000 px')
    expect(r.incidencias.length).toBe(1)
  })

  it('sin capas caídas no hay aviso, y el retorno viene vacío', () => {
    const r = informe()
    expect(r.incidencias).toEqual([])
    expect(leerInforme(r.bytes).corrido).not.toContain('Este plano no lleva toda la cartografía')
  })

  it('sin plano, el informe lo dice en vez de callárselo', () => {
    const leido = leerInforme(informe({ plano: null, encuadre: null }).bytes)
    expect(leido.corrido).toContain('No se ha podido componer el plano de situación')
    expect(leido.corrido).toContain('sale SIN plano')
  })

  it('un carácter sin sitio en la codificación se dibuja «?» Y se enumera al final', () => {
    const r = informe({ firma: { ...FIRMA, colegio: 'Colegio 🏛 de prueba' } })
    const leido = leerInforme(r.bytes)
    expect(leido.corrido).toContain('Colegio ? de prueba')
    expect(leido.corrido).toContain('NOTA DE COMPOSICIÓN')
    // Por su punto de código, no reimprimiendo el carácter: volvería a sustituirse
    // y el aviso diría «se ha sustituido ? por ?».
    expect(leido.corrido).toContain('U+1F3DB')
    expect(r.sustituciones.length).toBeGreaterThan(0)
    expect(r.incidencias.some((i) => /sustituido/.test(i))).toBe(true)
  })

  it('R3 · una sustitución que ocurre en el PIE queda enumerada en la nota, aunque el pie se estampe después', () => {
    // La atribución se imprime bajo el plano (cuerpo) Y en el pie de todas las
    // páginas. Antes, la nota se imprimía con lo que había ANTES de estampar los
    // pies: declaraba la del cuerpo y callaba las del pie — papel y dato
    // divergían. Ahora el pie se pre-escanea y la nota lo dice.
    const r = informe({ plano: planoDe({ atribucion: '© Catastro → IGN' }) })
    const leido = leerInforme(r.bytes)
    expect(leido.corrido).toContain('NOTA DE COMPOSICIÓN')
    expect(leido.corrido).toContain('U+2192')
    expect(leido.corrido).toContain('en el pie de página, que se repite en todas las páginas')
    expect(r.incidencias.some((i) => /pie de página/.test(i))).toBe(true)
    // El dato coincide con lo declarado: el U+2192 del pie se sustituyó en TODAS
    // las páginas (más la aparición del cuerpo, bajo el plano).
    const flechas = r.sustituciones.filter((s) => s.punto === 0x2192)
    expect(flechas.length).toBe(r.nPaginas + 1)
    // Y la paginación sigue exacta: todas las páginas llevan su «Página N de M».
    const leidas = leerInforme(r.bytes).paginas
    leidas.forEach((pagina, i) => {
      expect(pagina.renglones.map((x) => x.texto)).toContain(`Página ${i + 1} de ${r.nPaginas}`)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · Urbana y RÚSTICA: el encabezado no tiene un número fijo de filas
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-parcela · las dos clases de finca', () => {
  it('en URBANA no se imprimen paraje, polígono ni parcela: no es que falten, es que no existen', () => {
    const leido = leerInforme(informe().bytes)
    expect(leido.corrido).toContain('Clase de finca URBANA')
    expect(leido.corrido).toContain('Domicilio')
    expect(leido.lineas).not.toContain('Paraje')
    expect(leido.lineas).not.toContain('Polígono')
    expect(leido.lineas).not.toContain('Parcela (nº en el polígono)')
  })

  it('en RÚSTICA salen las once filas, paraje y polígono incluidos', () => {
    const leido = leerInforme(
      informe({ encabezado: encabezadoRustico(), procedencia: DNP_RUSTICA }).bytes,
    )
    expect(leido.corrido).toContain('Clase de finca RUSTICA')
    expect(leido.corrido).toContain('Paraje C.BOLSA')
    expect(leido.corrido).toContain('Polígono 109')
    expect(leido.corrido).toContain('Parcela (nº en el polígono) 5')
    expect(leido.corrido).toContain('Municipio ALCAZAR DE SAN JUAN')
  })

  it('el domicilio largo de la rústica se PARTE y no desborda ni pisa lo de debajo', () => {
    // 89 caracteres: es la primera línea del encabezado que necesita partirse, y
    // el motivo de que este bloque fluya en vez de reservarse un alto fijo.
    const domicilio = DNP_RUSTICA.datos.domicilio
    expect(domicilio.length).toBeGreaterThan(80)
    const r = informe({ encabezado: encabezadoRustico(), procedencia: DNP_RUSTICA })
    const leido = leerInforme(r.bytes)
    // El texto entero está, aunque repartido en varios renglones.
    expect(leido.corrido.replace(/\s+/g, ' ')).toContain(domicilio.replace(/\s+/g, ' '))

    // Y el bloque FLUYE: la fila siguiente («Paraje») baja lo que ocupan las DOS
    // líneas del domicilio, en vez de escribirse encima. Es la comprobación que
    // pedía el aviso de `report/firma.js`: si el encabezado reservara un alto fijo
    // de nueve renglones, aquí se vería el solape — y el snapshot de bytes no.
    const renglones = leido.paginas[0].renglones
    const yDe = (etiqueta) => renglones.find((r) => r.texto === etiqueta)?.y
    const yDomicilio = yDe('Domicilio')
    const yParaje = yDe('Paraje')
    expect(yDomicilio, 'falta la fila del domicilio').toBeDefined()
    expect(yParaje, 'falta la fila del paraje').toBeDefined()
    // Un renglón mide `tam · 1,42`; dos líneas de domicilio son más de un renglón.
    const unRenglon = renglones.find((r) => r.texto === 'Provincia').tam * 1.42
    expect(yParaje - yDomicilio).toBeGreaterThan(unRenglon * 1.5)

    // Y ninguna línea del domicilio se sale de la caja útil.
    for (const r of renglones) {
      expect(r.x + r.anchoMm).toBeLessThanOrEqual(A4_ANCHO_MM - 15 + 0.5)
    }
  })

  it('con la clase sin determinar, el encabezado se imprime como siempre', () => {
    const sinClase = componerEncabezado({
      descriptivos: {
        ok: true,
        motivo: null,
        mensaje: null,
        procedencia: 'RED',
        datos: {
          municipio: 'MADRID',
          provincia: 'MADRID',
          paraje: null,
          poligono: null,
          parcela: null,
          domicilio: null,
          clase: null,
        },
      },
      refcat: REF,
      srs: 'EPSG:25830',
      fecha: FECHA,
      idDocumento: null,
    })
    const leido = leerInforme(informe({ encabezado: sinClase }).bytes)
    // «Clase de finca» se imprime SIEMPRE, también cuando no se sabe cuál es:
    // ocultar no puede ser callar.
    expect(leido.corrido).toContain('Clase de finca No consta')
    expect(leido.lineas).toContain('Paraje')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · Contrato: qué revienta y qué degrada
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-parcela · el contrato del programador', () => {
  it('sin entrada, sin diagnóstico o sin encabezado, lanza TypeError', () => {
    expect(() => informePdfParcela()).toThrow(TypeError)
    expect(() => informePdfParcela(null)).toThrow(TypeError)
    expect(() => informePdfParcela({ encabezado: encabezadoUrbano() })).toThrow(/diagnostico/)
    expect(() => informePdfParcela({ diagnostico })).toThrow(/encabezado/)
  })

  it('un encabezado sin fecha o sin identificador lanza, y dice por qué', () => {
    expect(() =>
      informePdfParcela({ diagnostico, encabezado: { ...encabezadoUrbano(), fecha: '2026-08-02' } }),
    ).toThrow(/no consulta el reloj|fecha/)
    expect(() =>
      informePdfParcela({ diagnostico, encabezado: { ...encabezadoUrbano(), idDocumento: '' } }),
    ).toThrow(/inservible/)
  })

  it('un plano sin encuadre lanza: la escala no se recalcula aquí', () => {
    expect(() =>
      informePdfParcela({
        diagnostico,
        encabezado: encabezadoUrbano(),
        plano: planoDe(),
        encuadre: null,
      }),
    ).toThrow(/encuadre/)
  })

  it('un plano que no cabe en el papel LANZA en vez de encogerse', () => {
    // Encogerlo un 3 % dejaría el plano con una escala rotulada FALSA, que es el
    // error silencioso más caro que este documento puede cometer.
    expect(() =>
      informePdfParcela({
        diagnostico,
        encabezado: encabezadoUrbano(),
        plano: planoDe(),
        encuadre: { ...encuadre, anchoMm: 200, altoMm: 133.333 },
      }),
    ).toThrow(/NO se reescala/)
  })

  it('un plano que se imprimiría ESTIRADO lanza: es la tercera red del mismo pez', () => {
    expect(() =>
      informePdfParcela({
        diagnostico,
        encabezado: encabezadoUrbano(),
        plano: planoDe(),
        encuadre: { ...encuadre, anchoMm: 180, altoMm: 60 },
      }),
    ).toThrow(/estirado/)
  })

  it('R4 · un plano compuesto con OTRO encuadre de idénticas dimensiones LANZA: la cuarta red', () => {
    // El escenario que la relación de aspecto NO detecta: el cableado recompone
    // el encuadre sobre otro trozo de mundo (misma caja de milímetros → los
    // mismos píxeles) y pega el plano viejo. El plano transporta la identidad de
    // su encuadre (bbox y escalaExacta, de report/canvas.js#componerPlano) y el
    // maquetador la coteja.
    const desplazada = () =>
      editada().map((r) => ({
        ...r,
        vertices: r.vertices.map(([x, y]) => [x + 1000, y]),
      }))
    const otro = encuadrar({
      recintos: desplazada(),
      anchoMm: ANCHO_PLANO_MM,
      altoMm: ALTO_PLANO_MM,
    })
    // Mismo papel → mismos píxeles: el aspecto no puede distinguirlos.
    expect(otro.anchoPx).toBe(encuadre.anchoPx)
    expect(otro.altoPx).toBe(encuadre.altoPx)

    // El plano viejo (identidad del encuadre de OTRO trabajo) bajo el encuadre
    // del fixture: lanza nombrando el problema.
    expect(() =>
      informe({ plano: planoDe({ bbox: { ...otro.bbox }, escalaExacta: otro.escalaExacta }) }),
    ).toThrow(/mismo trabajo/)

    // Con la identidad del encuadre BUENO, no lanza: es el caso normal del
    // cableado real (el plano sale de componerPlano con el mismo encuadre).
    expect(() =>
      informe({
        plano: planoDe({ bbox: { ...encuadre.bbox }, escalaExacta: encuadre.escalaExacta }),
      }),
    ).not.toThrow()

    // Y un plano SIN identidad (fixture antiguo, llamante que aún no la pasa) no
    // coteja: compatibilidad documentada en exigirPlanoEncajable.
    expect(() => informe({ plano: planoDe() })).not.toThrow()
  })

  it('unos píxeles declarados que no cuadran con el JPEG lanzan (defensa de report/pdf.js)', () => {
    // El WMS del Catastro SUSTITUYE el tamaño sin avisar cuando se pasa de 4000 px.
    expect(() =>
      informePdfParcela({
        diagnostico,
        encabezado: encabezadoUrbano(),
        plano: planoDe({ anchoPx: 4000, altoPx: 2000 }),
        encuadre: { ...encuadre, anchoMm: 180, altoMm: 90 },
      }),
    ).toThrow(RangeError)
  })

  it('sin parcela, sin literal y sin comprobación sigue habiendo informe', () => {
    // El entorno degrada; el programador revienta. Que falte una pieza opcional no
    // puede dejar al usuario sin documento.
    const r = informePdfParcela({
      diagnostico,
      encabezado: encabezadoUrbano(),
      comprobacion: comprobacionDe(),
    })
    expect(r.nPaginas).toBeGreaterThan(0)
    const leido = leerInforme(r.bytes)
    // Los vértices salen de la geometría de la comprobación cuando no hay parcela.
    expect(leido.corrido).toContain('Exterior — 15 vértices')
    expect(leido.corrido).toContain('No se ha compuesto la descripción literaria')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 11 · Guardianes de capa: el reloj y el vocabulario espejo
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf-parcela · no lee el reloj del sistema', () => {
  // Mismo guardián, con las mismas palabras, que `report/pdf.js`,
  // `report/firma.js` y `report/contraste-texto.js`. El motivo es el mismo: un
  // informe firmado es un SNAPSHOT y tiene que valer lo mismo dentro de un año.
  const INSTANCIA_FECHA = /\bnew\s+Date\b/
  const RELOJ = /\bDate\s*\.\s*now\b/
  const FORMATO_LOCAL = /toLocale(Date|Time)?String\b/

  it('no instancia una fecha propia ni consulta la marca de tiempo', () => {
    expect(INSTANCIA_FECHA.test(FUENTE_MODULO), 'instancia una fecha propia').toBe(false)
    expect(RELOJ.test(FUENTE_MODULO), 'consulta el reloj del sistema').toBe(false)
    expect(FORMATO_LOCAL.test(FUENTE_MODULO)).toBe(false)
  })

  it('tampoco toca el DOM ni la red', () => {
    for (const prohibido of [
      /\bdocument\b/,
      /\bwindow\b/,
      /\bfetch\b/,
      /\bXMLHttpRequest\b/,
      /\bnavigator\b/,
      /\bBlob\b/,
      /\blocalStorage\b/,
    ]) {
      expect(prohibido.test(FUENTE_MODULO), `el módulo nombra ${prohibido}`).toBe(false)
    }
  })

  it('los detectores no son vacuos', () => {
    expect(INSTANCIA_FECHA.test('const x = new Date()')).toBe(true)
    expect(RELOJ.test('const t = Date . now()')).toBe(true)
    expect(INSTANCIA_FECHA.test('if (fecha instanceof Date) return')).toBe(false)
    expect(/\bdocument\b/.test('const documento = {}')).toBe(false)
  })
})

describe('report/pdf-parcela · PRESUNCION_CONOCIDA no puede divergir de report/literal.js', () => {
  // Misma fórmula que `OMISION_CONOCIDA` en F08: literal aquí + test-guarda que
  // compara leyendo el TEXTO fuente del otro fichero. Importarlo de verdad
  // arrastraría Turf al grafo de dependencias de un maquetador puro.
  const clavesDeLiteral = () => {
    const bloque = /export const PRESUNCION = Object\.freeze\(\{([\s\S]*?)\n\}\)/.exec(
      FUENTE_LITERAL,
    )
    expect(bloque, 'no se encuentra PRESUNCION en report/literal.js').not.toBeNull()
    return [...bloque[1].matchAll(/^\s{2}([A-Z_]+):\s*'([^']+)'/gm)].map((m) => [m[1], m[2]])
  }

  it('las dos listas tienen las mismas claves y los mismos valores', () => {
    const deAlla = clavesDeLiteral()
    expect(deAlla.length).toBeGreaterThan(0)
    expect(Object.entries(PRESUNCION_CONOCIDA).sort()).toEqual(deAlla.sort())
  })

  it('el extractor no es vacuo', () => {
    expect(clavesDeLiteral()).toContainEqual(['VIA_PUBLICA', 'VIA_PUBLICA'])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 12 · El SNAPSHOT de bytes — y va el último, a propósito
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Los bytes como texto auditable: lo imprimible tal cual, los saltos de línea como
 * saltos, y todo lo demás en hexadecimal entre guillemets. Mismo volcado que
 * `test/report/pdf.test.js`, para que el snapshot se pueda LEER —incluidos los
 * desplazamientos de la `xref`, que es lo que de verdad se quiere congelar— en vez
 * de ser una cadena base64 que nadie revisa.
 */
function volcado(bytes) {
  let salida = ''
  for (const b of bytes) {
    if (b === 0x0a) salida += '\n'
    else if (b >= 0x20 && b <= 0x7e) salida += String.fromCharCode(b)
    else salida += `«${b.toString(16).padStart(2, '0')}»`
  }
  return salida
}

describe('report/pdf-parcela · snapshot', () => {
  /**
   * El informe MÍNIMO: sin plano, sin literal y sin fichero. Se congela éste y no
   * el completo porque los 841 bytes del JPEG saldrían como 2,5 kB de hexadecimal
   * que nadie va a revisar nunca, y lo que interesa congelar es la ESTRUCTURA del
   * documento: la `xref`, los objetos, los operadores de texto.
   */
  const minimo = () =>
    informePdfParcela({
      diagnostico,
      encabezado: encabezadoUrbano(),
      parcela: parcelaDe(),
    })

  it('el informe mínimo, byte a byte', () => {
    expect(volcado(minimo().bytes)).toMatchSnapshot()
  })

  it('y las medidas del informe COMPLETO sobre la parcela real', () => {
    const r = informe()
    expect({ paginas: r.nPaginas, bytes: r.bytes.length }).toMatchSnapshot()
  })
})
