/* -------------------------------------------------------------------------- *
 * test/report/pdf.test.js — F09 · T2.4 · El escritor de PDF propio            *
 *                                                                            *
 * `report/pdf.js` escribe un formato binario a mano. Eso significa que la     *
 * pregunta «¿funciona?» no se contesta mirando lo que el módulo devuelve —él  *
 * siempre devuelve bytes, y unos bytes rotos tienen exactamente la misma      *
 * pinta que unos buenos—, sino RELEYENDO lo escrito con otro criterio. Este   *
 * fichero está montado en tres capas, y la del medio es la que de verdad      *
 * protege:                                                                    *
 *                                                                            *
 *  1. **Los anchos AFM contra un oráculo externo.** Las tablas de Helvetica y *
 *     Helvetica-Bold se contrastan contra los anchos de avance REALES de      *
 *     `arial.ttf` / `arialbd.ttf`, leídos de la tabla `hmtx` del fichero de   *
 *     fuente (Arial se diseñó metric-compatible con Helvetica). Es el mismo   *
 *     planteamiento de `test/geo/utm-control.factory.test.js` con proj4 y de  *
 *     `test/gml/xml-oraculo.test.js` con jsdom: una verdad medida por otra    *
 *     gente, con otro modelo mental, que no comparte ni una línea con lo que  *
 *     se está probando. Si esas tablas están mal, `partirTexto` corta donde   *
 *     no debe y el informe sale con renglones fuera del papel.                *
 *                                                                            *
 *  2. **Un oráculo propio que RELEE el PDF producido**: parsea la tabla       *
 *     `xref`, comprueba que cada desplazamiento cae exactamente sobre el      *
 *     «N 0 obj» del objeto que dice ser, que `startxref` apunta a la `xref`,  *
 *     y que el `/Length` declarado de cada stream enmarca los bytes reales.   *
 *     Eso es lo que convierte «he escrito bytes» en «he escrito un PDF». Y    *
 *     para que el oráculo no sea vacuo, se le enseña un documento SABOTEADO   *
 *     —un byte de más colado a media altura— y se exige que lo cace.          *
 *                                                                            *
 *  3. **El SNAPSHOT de bytes, y va al FINAL.** Un snapshot está a un `-u` de  *
 *     no significar nada; delante van las afirmaciones que sobreviven a una   *
 *     actualización distraída. Misma doctrina que                             *
 *     `test/report/contraste-texto.test.js`.                                  *
 *                                                                            *
 * ⚠️ VERIFICADO ADEMÁS FUERA DE LA SUITE, el 2026-08-02: el PDF de prueba se  *
 * cargó y se RENDERIZÓ con el motor de PDF de Windows (`Windows.Data.Pdf`, el *
 * mismo de Edge). Dos páginas, A4 exacto, y en el papel se leen la ñ, las     *
 * vocales acentuadas, la ü, ¿?, ±, ·, € y la raya —, con el JPEG derecho y en *
 * su sitio. Eso no se puede automatizar aquí (no hay motor de PDF en Node),   *
 * así que queda escrito: si alguien toca la estructura, toca repetirlo.       *
 *                                                                            *
 * Proyecto Vitest `node`: el módulo es puro. **Sin sufijo `.dom`.**           *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  A4_ALTO_MM,
  A4_ANCHO_MM,
  ANCHOS_AFM,
  PUNTOS_POR_MM,
  SUSTITUTO_NO_REPRESENTABLE,
  crearDocumentoPdf,
  sustitucionesDe,
} from '../../report/pdf.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const FUENTE_MODULO = readFileSync(join(RAIZ, 'report', 'pdf.js'), 'utf8')

/**
 * Un JPEG REAL de 24×16 px, producido por el codificador de GDI+ (calidad 85) y
 * guardado como fixture. No está dibujado a mano: trae su APP0/JFIF, sus tablas
 * de cuantización y de Huffman y su SOF0 de 3 componentes, que es exactamente la
 * forma que tiene lo que devuelve el WMS del Catastro (medido en F09/T0.1).
 */
const JPEG = Uint8Array.from(readFileSync(join(RAIZ, 'test', 'fixtures', 'report', 'plano-prueba.jpg')))

/** Instante FIJO: el módulo no consulta el reloj, la fecha entra por parámetro. */
const FECHA = new Date(Date.UTC(2026, 7, 2, 12, 30, 15))

// ═════════════════════════════════════════════════════════════════════════════
// Utilidades del oráculo
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Los bytes como texto latin-1. **El truco que hace todo lo demás posible**: en
 * latin-1 cada byte es exactamente un carácter, así que el índice de un string
 * ES el desplazamiento de byte. Con UTF-8 no lo sería, y precisamente por eso el
 * módulo no puede construirse contando caracteres.
 */
const aLatin1 = (bytes) => Buffer.from(bytes).toString('latin1')

/**
 * Relee un PDF y devuelve todo lo que le encuentra mal. **Devuelve problemas en
 * vez de lanzar** para poder afirmar `[]` sobre un documento bueno y, sobre uno
 * saboteado, exigir que la lista NO esté vacía: un oráculo que solo sabe pasar no
 * demuestra nada.
 *
 * @param {Uint8Array} bytes
 * @returns {{problemas: string[], nObjetos: number, desplazamientos: number[], streams: Array}}
 */
function revisarPdf(bytes) {
  const problemas = []
  const texto = aLatin1(bytes)
  const anota = (mensaje) => problemas.push(mensaje)

  // ── Cabecera ───────────────────────────────────────────────────────────────
  if (!texto.startsWith('%PDF-1.4\n')) anota('no empieza por «%PDF-1.4»')
  // La segunda línea tiene que ser un comentario con cuatro bytes por encima de
  // 127: es lo que marca el fichero como binario ante cualquier herramienta que
  // se sienta tentada de «arreglarle» los finales de línea.
  if (bytes[9] !== 0x25) anota('la segunda línea no es un comentario «%»')
  const altos = [...bytes.slice(10, 14)].filter((b) => b > 127)
  if (altos.length !== 4) {
    anota(`el comentario binario tiene ${altos.length} bytes altos y hacen falta 4`)
  }

  // ── startxref → xref ───────────────────────────────────────────────────────
  const iStartxref = texto.lastIndexOf('startxref')
  if (iStartxref < 0) {
    anota('no hay «startxref»')
    return { problemas, nObjetos: 0, desplazamientos: [], streams: [] }
  }
  const declarado = Number.parseInt(texto.slice(iStartxref + 'startxref\n'.length), 10)
  if (!Number.isInteger(declarado)) anota('el valor de «startxref» no es un entero')
  if (texto.slice(declarado, declarado + 5) !== 'xref\n') {
    anota(`«startxref» apunta al byte ${declarado} y ahí no empieza la tabla «xref»`)
    return { problemas, nObjetos: 0, desplazamientos: [], streams: [] }
  }
  if (!texto.trimEnd().endsWith('%%EOF')) anota('el fichero no termina en «%%EOF»')

  // ── La tabla xref ──────────────────────────────────────────────────────────
  const cabecera = /^xref\n(\d+) (\d+)\n/.exec(texto.slice(declarado))
  if (cabecera === null) {
    anota('la cabecera de la subsección «xref» no tiene la forma «primero cuantos»')
    return { problemas, nObjetos: 0, desplazamientos: [], streams: [] }
  }
  if (cabecera[1] !== '0') anota(`la subsección xref no empieza en el objeto 0 sino en ${cabecera[1]}`)
  const nObjetos = Number.parseInt(cabecera[2], 10)

  const inicioEntradas = declarado + cabecera[0].length
  const desplazamientos = []
  for (let n = 0; n < nObjetos; n++) {
    // 20 BYTES EXACTOS por entrada: 10 de desplazamiento, espacio, 5 de
    // generación, espacio, la marca y un fin de línea de dos caracteres. Se
    // rebana por posición y no por líneas, que es justo lo que exige el formato.
    const entrada = texto.slice(inicioEntradas + n * 20, inicioEntradas + n * 20 + 20)
    const casa = /^(\d{10}) (\d{5}) ([nf])\r\n$/.exec(entrada)
    if (casa === null) {
      anota(`la entrada xref del objeto ${n} no mide 20 bytes o está mal formada: ${JSON.stringify(entrada)}`)
      desplazamientos.push(-1)
      continue
    }
    if (n === 0) {
      if (casa[3] !== 'f' || casa[1] !== '0000000000' || casa[2] !== '65535') {
        anota('la entrada 0 de la xref no es la entrada libre «0000000000 65535 f»')
      }
      desplazamientos.push(0)
      continue
    }
    if (casa[3] !== 'n') anota(`el objeto ${n} está marcado como libre en la xref`)
    desplazamientos.push(Number.parseInt(casa[1], 10))
  }

  // ── LA comprobación: cada desplazamiento cae sobre «N 0 obj» ───────────────
  for (let n = 1; n < nObjetos; n++) {
    const esperado = `${n} 0 obj\n`
    const real = texto.slice(desplazamientos[n], desplazamientos[n] + esperado.length)
    if (real !== esperado) {
      anota(
        `la xref dice que el objeto ${n} empieza en el byte ${desplazamientos[n]}, ` +
          `y ahí pone ${JSON.stringify(real)} en vez de ${JSON.stringify(esperado)}`,
      )
    }
  }

  // ── Que no haya objetos fuera de la tabla ──────────────────────────────────
  const enElFichero = [...texto.matchAll(/(?:^|\n)(\d+) 0 obj\n/g)].map((m) => Number(m[1]))
  if (enElFichero.length !== nObjetos - 1) {
    anota(`el fichero tiene ${enElFichero.length} objetos y la xref declara ${nObjetos - 1}`)
  }

  // ── Trailer ────────────────────────────────────────────────────────────────
  const trailer = /trailer\n<< ([^\n]*) >>\n/.exec(texto.slice(declarado))
  if (trailer === null) anota('no hay diccionario «trailer»')
  else {
    if (!trailer[1].includes(`/Size ${nObjetos}`)) {
      anota(`el /Size del trailer no es ${nObjetos}: «${trailer[1]}»`)
    }
    if (!/\/Root 1 0 R/.test(trailer[1])) anota('el trailer no apunta al catálogo con /Root 1 0 R')
  }

  // ── /Length de cada stream ─────────────────────────────────────────────────
  // Se USA el /Length declarado para saltar, y se exige que el salto aterrice
  // justo en «\nendstream». Si la longitud estuviera mal —que es lo que pasa en
  // cuanto alguien cuenta caracteres en vez de bytes— no aterrizaría.
  const streams = []
  for (const casa of texto.matchAll(/\/Length (\d+) >>\nstream\n/g)) {
    const declarada = Number(casa[1])
    const inicio = casa.index + casa[0].length
    const cola = texto.slice(inicio + declarada, inicio + declarada + 11)
    if (cola !== '\nendstream\n') {
      anota(
        `un stream declara /Length ${declarada} y en el byte ${inicio + declarada} ` +
          `no empieza «endstream» sino ${JSON.stringify(cola)}`,
      )
    }
    streams.push({ inicio, longitud: declarada, bytes: bytes.slice(inicio, inicio + declarada) })
  }

  return { problemas, nObjetos, desplazamientos, streams }
}

/** Un documento pequeño pero completo: texto en las dos fuentes, línea, marco. */
function documentoDePrueba(extra = () => {}) {
  const doc = crearDocumentoPdf({
    anchoMm: A4_ANCHO_MM,
    altoMm: A4_ALTO_MM,
    titulo: 'Informe de contraste con el parcelario catastral',
    fecha: FECHA,
  })
  doc.texto('INFORME DE CONTRASTE CON EL PARCELARIO CATASTRAL', {
    x: 20,
    y: 25,
    tam: 4,
    fuente: 'negrita',
  })
  doc.linea(20, 28, 190, 28, { grosor: 0.4 })
  doc.texto('Parcela 9398516VK3799G · señalización de linderos, ±0,50 m', {
    x: 20,
    y: 35,
    tam: 3,
    gris: 0.25,
  })
  doc.rect(20, 40, 170, 30, { relleno: 0.94, trazo: 0.6 })
  extra(doc)
  return doc
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Los anchos AFM contra arial.ttf (ORÁCULO EXTERNO)
// ═════════════════════════════════════════════════════════════════════════════
//
// Cómo se obtuvieron estas dos tablas, para que se pueda repetir: se leyó la
// tabla `hmtx` de `C:\Windows\Fonts\arial.ttf` (1.045.720 bytes) y de
// `arialbd.ttf` (989.780 bytes) resolviendo cada código CP1252 a su glifo por el
// `cmap` formato 4, y se escaló el avance a milésimas de em
// (`avance · 1000 / unitsPerEm`, con unitsPerEm = 2048), redondeando.
//
// Arial se diseñó METRIC-COMPATIBLE con Helvetica: es una tipografía distinta,
// dibujada por otra gente y con otro propósito, cuyos anchos coinciden con los de
// Helvetica por requisito de diseño. Eso la convierte en el oráculo que hacía
// falta: si las tablas del módulo se hubieran «recordado» mal, aquí saltaría.

const ANCHOS_ARIAL = Object.freeze({
  normal: [
       0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0, // 00
       0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0, // 10
     278,  278,  355,  556,  556,  889,  667,  191,  333,  333,  389,  584,  278,  333,  278,  278, // 20
     556,  556,  556,  556,  556,  556,  556,  556,  556,  556,  278,  278,  584,  584,  584,  556, // 30
    1015,  667,  667,  722,  722,  667,  611,  778,  722,  278,  500,  667,  556,  833,  722,  778, // 40
     667,  778,  722,  667,  611,  722,  667,  944,  667,  667,  611,  278,  278,  278,  469,  556, // 50
     333,  556,  556,  500,  556,  556,  278,  556,  556,  222,  222,  500,  222,  833,  556,  556, // 60
     556,  556,  333,  500,  278,  556,  500,  722,  500,  500,  500,  334,  260,  334,  584,    0, // 70
     556,    0,  222,  556,  333, 1000,  556,  556,  333, 1000,  667,  333, 1000,    0,  611,    0, // 80
       0,  222,  222,  333,  333,  350,  556, 1000,  333, 1000,  500,  333,  944,    0,  500,  667, // 90
     278,  333,  556,  556,  556,  556,  260,  556,  333,  737,  370,  556,  584,  333,  737,  552, // a0
     400,  549,  333,  333,  333,  576,  537,  333,  333,  333,  365,  556,  834,  834,  834,  611, // b0
     667,  667,  667,  667,  667,  667, 1000,  722,  667,  667,  667,  667,  278,  278,  278,  278, // c0
     722,  722,  778,  778,  778,  778,  778,  584,  778,  722,  722,  722,  722,  667,  667,  611, // d0
     556,  556,  556,  556,  556,  556,  889,  500,  556,  556,  556,  556,  278,  278,  278,  278, // e0
     556,  556,  556,  556,  556,  556,  556,  549,  611,  556,  556,  556,  556,  500,  556,  500, // f0
  ],
  negrita: [
       0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0, // 00
       0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0, // 10
     278,  333,  474,  556,  556,  889,  722,  238,  333,  333,  389,  584,  278,  333,  278,  278, // 20
     556,  556,  556,  556,  556,  556,  556,  556,  556,  556,  333,  333,  584,  584,  584,  611, // 30
     975,  722,  722,  722,  722,  667,  611,  778,  722,  278,  556,  722,  611,  833,  722,  778, // 40
     667,  778,  722,  667,  611,  722,  667,  944,  667,  667,  611,  333,  278,  333,  584,  556, // 50
     333,  556,  611,  556,  611,  556,  333,  611,  611,  278,  278,  556,  278,  889,  611,  611, // 60
     611,  611,  389,  556,  333,  611,  556,  778,  556,  556,  500,  389,  280,  389,  584,    0, // 70
     556,    0,  278,  556,  500, 1000,  556,  556,  333, 1000,  667,  333, 1000,    0,  611,    0, // 80
       0,  278,  278,  500,  500,  350,  556, 1000,  333, 1000,  556,  333,  944,    0,  500,  667, // 90
     278,  333,  556,  556,  556,  556,  280,  556,  333,  737,  370,  556,  584,  333,  737,  552, // a0
     400,  549,  333,  333,  333,  576,  556,  333,  333,  333,  365,  556,  834,  834,  834,  611, // b0
     722,  722,  722,  722,  722,  722, 1000,  722,  667,  667,  667,  667,  278,  278,  278,  278, // c0
     722,  722,  778,  778,  778,  778,  778,  584,  778,  722,  722,  722,  722,  667,  667,  611, // d0
     556,  556,  556,  556,  556,  556,  889,  556,  556,  556,  556,  556,  278,  278,  278,  278, // e0
     611,  611,  611,  611,  611,  611,  611,  549,  611,  611,  611,  611,  611,  556,  611,  556, // f0
  ],
})

/**
 * Los CINCO códigos donde Arial y Helvetica divergen de verdad. No son un margen
 * de error: son glifos que las dos tipografías dibujan con anchos distintos, y
 * aquí manda el AFM de Adobe, que es la métrica que el lector aplica a una fuente
 * estándar-14 sin `/Widths`. Se enumeran para que quien vea la diferencia sepa que
 * está vista y que «corregirla» hacia Arial sería el error.
 */
const DIVERGENCIAS_ARIAL = Object.freeze({
  0xaf: 'macron (¯)',
  0xb1: 'plusminus (±)',
  0xb5: 'mu (µ)',
  0xb7: 'periodcentered (·)',
  0xf7: 'divide (÷)',
})

describe('report/pdf · las tablas AFM contra los anchos reales de Arial', () => {
  for (const fuente of ['normal', 'negrita']) {
    it(`${fuente}: coincide con Arial en todo salvo en las cinco divergencias conocidas`, () => {
      const propia = ANCHOS_AFM[fuente]
      const oraculo = ANCHOS_ARIAL[fuente]
      const distintos = []
      for (let c = 0; c < 256; c++) {
        if (propia[c] !== oraculo[c]) distintos.push(c)
      }
      expect(
        distintos.map((c) => `0x${c.toString(16)} (AFM ${propia[c]} / Arial ${oraculo[c]})`),
        'divergencias con el oráculo que no estaban previstas',
      ).toEqual(
        Object.keys(DIVERGENCIAS_ARIAL).map(
          (c) => `0x${Number(c).toString(16)} (AFM ${propia[c]} / Arial ${oraculo[c]})`,
        ),
      )
    })

    it(`${fuente}: el contraste NO es vacuo (más de 200 códigos comparados y con ancho)`, () => {
      // Sin esto, dos tablas de ceros pasarían el test de arriba tan ricamente.
      const conAncho = ANCHOS_AFM[fuente].filter((w, c) => w > 0 && ANCHOS_ARIAL[fuente][c] > 0)
      expect(conAncho.length).toBeGreaterThan(200)
      expect(ANCHOS_AFM[fuente]).toHaveLength(256)
      expect(ANCHOS_AFM[fuente].every((w) => Number.isInteger(w) && w >= 0)).toBe(true)
    })

    it(`${fuente}: los códigos SIN glifo son exactamente los que WinAnsiEncoding deja vacíos`, () => {
      // 0x00–0x1F y 0x7F son controles; 0x81, 0x8D, 0x8F, 0x90 y 0x9D son los
      // cinco huecos que Windows nunca llenó. Ningún otro código puede valer 0:
      // un 0 de más sería un carácter español midiendo nada.
      const sinGlifo = []
      for (let c = 0; c < 256; c++) if (ANCHOS_AFM[fuente][c] === 0) sinGlifo.push(c)
      const esperados = [
        ...Array.from({ length: 32 }, (_, i) => i),
        0x7f, 0x81, 0x8d, 0x8f, 0x90, 0x9d,
      ]
      expect(sinGlifo).toEqual(esperados)
    })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · medirTexto y partirTexto
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf · medirTexto', () => {
  const doc = () => crearDocumentoPdf({ anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM })

  it('mide sumando anchos AFM: «Hola» a 3,5 mm son 7,196 mm, a mano', () => {
    // H 722 + o 556 + l 222 + a 556 = 2.056 milésimas de em.
    // 2,056 em × 3,5 mm = 7,196 mm. Calculado aquí, no copiado del módulo.
    expect(doc().medirTexto('Hola', { tam: 3.5 })).toBeCloseTo(7.196, 10)
  })

  it('el tamaño va en MILÍMETROS de altura de em, no en puntos', () => {
    // La consecuencia práctica: 3,5 mm son los 10 pt de toda la vida. Si alguien
    // «arregla» el módulo para que `tam` sean puntos, esta cuenta se cae.
    const uno = doc().medirTexto('mmmm', { tam: 1 })
    expect(doc().medirTexto('mmmm', { tam: 3.5 })).toBeCloseTo(uno * 3.5, 12)
    expect(3.5 * PUNTOS_POR_MM).toBeCloseTo(9.921, 3)
  })

  it('la negrita es más ancha que la normal en el mismo texto', () => {
    const texto = 'Referencia catastral'
    expect(doc().medirTexto(texto, { tam: 3, fuente: 'negrita' })).toBeGreaterThan(
      doc().medirTexto(texto, { tam: 3, fuente: 'normal' }),
    )
  })

  it('mide la ñ y las vocales acentuadas como sus letras base (no como el sustituto)', () => {
    // El error clásico sería que «ñ» cayera al `?`: mediría 556, que es justo lo
    // que mide la ñ, y no se notaría. Se usan letras cuyo ancho NO es 556.
    const d = doc()
    expect(d.medirTexto('Ñ', { tam: 3 })).toBeCloseTo(d.medirTexto('N', { tam: 3 }), 12)
    expect(d.medirTexto('Á', { tam: 3 })).toBeCloseTo(d.medirTexto('A', { tam: 3 }), 12)
    expect(d.medirTexto('í', { tam: 3 })).toBeCloseTo((278 / 1000) * 3, 12)
    expect(d.medirTexto('Œ', { tam: 3 })).toBeCloseTo((1000 / 1000) * 3, 12)
    expect(d.medirTexto('•', { tam: 3 })).toBeCloseTo((350 / 1000) * 3, 12)
  })

  it('compone: la suma de las partes es la medida del todo', () => {
    const d = doc()
    const frase = 'Desviación máxima de lindero'
    const suma = [...frase].reduce((s, c) => s + d.medirTexto(c, { tam: 2.8 }), 0)
    expect(d.medirTexto(frase, { tam: 2.8 })).toBeCloseTo(suma, 9)
  })

  it('un carácter fuera de CP1252 se MIDE como el sustituto que se va a dibujar', () => {
    // Medir una cosa y pintar otra es un desbordamiento garantizado.
    const d = doc()
    expect(d.medirTexto('ł', { tam: 3 })).toBeCloseTo(
      d.medirTexto(SUSTITUTO_NO_REPRESENTABLE, { tam: 3 }),
      12,
    )
    expect(d.medirTexto('🙂', { tam: 3 })).toBeCloseTo(
      d.medirTexto(SUSTITUTO_NO_REPRESENTABLE, { tam: 3 }),
      12,
    )
  })

  it('normaliza a NFC: una ñ descompuesta es una ñ', () => {
    const d = doc()
    expect(d.medirTexto('n\u0303', { tam: 3 })).toBeCloseTo(d.medirTexto('ñ', { tam: 3 }), 12)
  })
})

describe('report/pdf · partirTexto', () => {
  const doc = crearDocumentoPdf({ anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM })

  /** Prosa REAL del proyecto: es la que va a partirse en el informe de verdad. */
  const CORPUS = [
    'La aplicación mide; el colegiado interpreta y firma. Ninguna cifra lleva juicio de valor.',
    'Es el máximo, lado a lado, de la distancia mínima de cada muestra al contorno oficial ' +
      'completo. Se muestrea cada 0,30 m sobre el terreno y los dos extremos de cada lado ' +
      'entran siempre, así que la cifra puede quedarse hasta 0,15 m por debajo del máximo.',
    'Referencia catastral 9398516VK3799G, señalización ±0,50 m, superficie 1.535,87 m², ' +
      'perímetro 158,42 m, huso 30 (EPSG:25830).',
    'Lindero NORTE, de 12,34 m: linda con la parcela 9398516VK3799G del polígono 8; ' +
      'continúa en dirección noreste hasta el vértice nº 4.',
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'ñÑáéíóúüÜ¿?¡!ªº«»·€±',
  ]

  it('NINGUNA línea excede el ancho pedido, en todo el corpus y con muchos anchos', () => {
    // La aserción que atrapa una tabla AFM mal copiada. Se barren anchos y
    // tamaños de verdad: no hay un solo caso feliz, hay cientos.
    let lineasComprobadas = 0
    for (const fuente of ['normal', 'negrita']) {
      for (const tam of [2, 2.5, 3, 3.5, 5]) {
        for (const ancho of [15, 25, 40, 60, 90, 120, 170]) {
          for (const texto of CORPUS) {
            for (const linea of doc.partirTexto(texto, ancho, { tam, fuente })) {
              const medida = doc.medirTexto(linea, { tam, fuente })
              expect(
                medida,
                `«${linea}» mide ${medida} mm y el ancho pedido era ${ancho} mm ` +
                  `(${fuente}, ${tam} mm)`,
              ).toBeLessThanOrEqual(ancho + 1e-9)
              lineasComprobadas += 1
            }
          }
        }
      }
    }
    expect(lineasComprobadas, 'el barrido no ha comprobado ni una línea').toBeGreaterThan(1000)
  })

  it('no pierde ni una palabra ni cambia su orden', () => {
    for (const texto of CORPUS) {
      const partido = doc.partirTexto(texto, 60, { tam: 3 })
      expect(partido.join('').replace(/\s+/g, '')).toBe(texto.replace(/\s+/g, ''))
    }
  })

  it('llena la línea: cada línea, con la primera palabra de la siguiente, ya no cabría', () => {
    // Sin esto, un `partirTexto` que devolviera una palabra por línea pasaría el
    // test de «no excede» con nota, y el informe saldría con cuatro veces más
    // páginas de las que hacen falta.
    const lineas = doc.partirTexto(CORPUS[1], 70, { tam: 3 })
    expect(lineas.length).toBeGreaterThan(3)
    for (let i = 0; i < lineas.length - 1; i++) {
      const siguiente = lineas[i + 1].split(' ')[0]
      expect(doc.medirTexto(`${lineas[i]} ${siguiente}`, { tam: 3 })).toBeGreaterThan(70)
    }
  })

  it('parte una palabra más larga que la caja, y los trozos reconstruyen la palabra', () => {
    const palabra = 'ES.SDGC.CP.9398516VK3799G0001WX-abcdefghijklmnopqrstuvwxyz'
    const trozos = doc.partirTexto(palabra, 20, { tam: 3 })
    expect(trozos.length).toBeGreaterThan(1)
    expect(trozos.join('')).toBe(palabra)
    for (const t of trozos) expect(doc.medirTexto(t, { tam: 3 })).toBeLessThanOrEqual(20 + 1e-9)
  })

  it('respeta los saltos de línea del texto de entrada como saltos forzados', () => {
    expect(doc.partirTexto('uno\ndos\r\ntres', 100, { tam: 3 })).toEqual(['uno', 'dos', 'tres'])
  })

  it('un texto sin palabras devuelve [""], que mantiene el ritmo vertical', () => {
    expect(doc.partirTexto('', 50, { tam: 3 })).toEqual([''])
    expect(doc.partirTexto('   ', 50, { tam: 3 })).toEqual([''])
  })

  it('caso degenerado: si no cabe ni un carácter, sale uno por línea y se sabe por qué', () => {
    // Documentado como la ÚNICA excepción a «ninguna línea excede»: no hay unidad
    // más pequeña que un carácter, así que se emite y se dice.
    const lineas = doc.partirTexto('WWW', 0.5, { tam: 3 })
    expect(lineas).toEqual(['W', 'W', 'W'])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · EL ORÁCULO: releer el PDF y comprobar la xref byte a byte
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf · el oráculo relee el PDF producido', () => {
  it('un documento mínimo pasa la revisión entera', () => {
    const doc = crearDocumentoPdf({ anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM })
    doc.texto('Hola', { x: 20, y: 20, tam: 3.5 })
    const { problemas, nObjetos } = revisarPdf(doc.bytes())
    expect(problemas).toEqual([])
    // Catalog + Pages + Resources + Helvetica + Page + Contents + Info = 7. El
    // Info sale siempre porque el /Producer se estampa siempre: un documento que
    // alguien va a firmar tiene que decir con qué se hizo.
    expect(nObjetos - 1).toBe(7)
  })

  it('un documento con acentos, imagen JPEG y varias páginas también', () => {
    // El caso que de verdad importa: hay bytes de JPEG por medio y hay acentos,
    // así que «longitud en caracteres» y «longitud en bytes» ya NO coinciden. Si
    // el módulo contara caracteres en algún punto, la xref caería fuera de sitio
    // y esta revisión lo diría con el número de objeto y el byte exactos.
    const doc = documentoDePrueba((d) => {
      d.imagenJpeg(JPEG, { x: 20, y: 80, anchoMm: 120, altoMm: 80 })
      d.pagina()
      d.texto('Página 2 · descripción del lindero: «señalización» a ±0,50 m', {
        x: 20,
        y: 25,
        tam: 3,
      })
      d.pagina()
      d.texto('Página 3', { x: 20, y: 25, tam: 3, fuente: 'negrita' })
    })
    const bytes = doc.bytes()
    const { problemas, nObjetos } = revisarPdf(bytes)
    expect(problemas).toEqual([])
    // 3 fijos + 2 fuentes + 1 imagen + 3×(Page+Contents) + Info = 13.
    expect(nObjetos - 1).toBe(13)
    expect(doc.nPaginas()).toBe(3)
  })

  it('EL ORÁCULO NO ES VACUO (1): un solo byte colado a media altura lo tumba', () => {
    // Sin esta prueba, `revisarPdf` podría estar devolviendo `[]` porque no mira
    // nada. Se sabotea el documento metiendo un byte inocente detrás de la
    // cabecera —exactamente lo que pasaría si alguien contase caracteres en vez
    // de bytes al llegar a una `ñ`— y se exige que el oráculo lo cace.
    const buenos = documentoDePrueba().bytes()
    expect(revisarPdf(buenos).problemas).toEqual([])

    const saboteados = new Uint8Array(buenos.length + 1)
    saboteados.set(buenos.slice(0, 16), 0)
    saboteados[16] = 0x20
    saboteados.set(buenos.slice(16), 17)

    const { problemas } = revisarPdf(saboteados)
    expect(problemas.length, 'el oráculo se ha tragado un PDF desplazado un byte').toBeGreaterThan(0)
    // Un byte de más delante corre TODO lo que viene detrás, así que lo primero
    // que deja de cuadrar es el propio `startxref`. Ese es el síntoma, y decirlo
    // así es más útil que exigir un mensaje concreto.
    expect(problemas.join(' | ')).toMatch(/startxref/)
  })

  it('EL ORÁCULO NO ES VACUO (2): un desplazamiento torcido en la xref lo tumba', () => {
    // El sabotaje que apunta a LA comprobación central, sin tocar ninguna otra
    // cosa: se le suma 1 a un desplazamiento de la tabla, conservando sus diez
    // dígitos y por tanto los 20 bytes de la entrada. El fichero sigue midiendo
    // lo mismo y `startxref` sigue siendo correcto; lo único que falla es que ese
    // desplazamiento ya no cae sobre su «N 0 obj».
    const buenos = documentoDePrueba().bytes()
    const texto = aLatin1(buenos)
    const inicioXref = texto.lastIndexOf('xref\n0 ')
    const inicioEntradas = texto.indexOf('\n', texto.indexOf('\n', inicioXref) + 1) + 1
    const objetoTorcido = 4
    const posicion = inicioEntradas + objetoTorcido * 20
    const original = Number(texto.slice(posicion, posicion + 10))

    const saboteados = Uint8Array.from(buenos)
    saboteados.set(
      Uint8Array.from(String(original + 1).padStart(10, '0'), (c) => c.charCodeAt(0)),
      posicion,
    )

    const { problemas } = revisarPdf(saboteados)
    expect(problemas.join(' | ')).toMatch(
      new RegExp(`el objeto ${objetoTorcido} empieza en el byte ${original + 1}`),
    )
    // Y solo ese: el sabotaje es quirúrgico y el oráculo no dispara de más.
    expect(problemas).toHaveLength(1)
  })

  it('el oráculo también caza un /Length mentiroso', () => {
    const buenos = documentoDePrueba().bytes()
    const texto = aLatin1(buenos)
    // Se le suma 1 a la primera longitud de stream que aparezca, sin tocar nada
    // más: los desplazamientos siguen siendo correctos y solo falla el enmarcado.
    const i = texto.indexOf('/Length ')
    const fin = texto.indexOf(' ', i + 8)
    const original = Number(texto.slice(i + 8, fin))
    const mentiroso = Buffer.from(
      texto.slice(0, i + 8) + String(original + 1) + texto.slice(fin),
      'latin1',
    )
    const { problemas } = revisarPdf(new Uint8Array(mentiroso))
    expect(problemas.join(' | ')).toMatch(/no empieza «endstream»/)
  })

  it('startxref apunta a la xref, y la xref al primer objeto real', () => {
    const bytes = documentoDePrueba().bytes()
    const texto = aLatin1(bytes)
    const { desplazamientos } = revisarPdf(bytes)
    // El objeto 1 es el catálogo y va justo detrás de la cabecera: 9 bytes de
    // «%PDF-1.4\n» + 6 del comentario binario = 15.
    expect(desplazamientos[1]).toBe(15)
    expect(texto.slice(15, 24)).toBe('1 0 obj\n<')
    // Y los desplazamientos van estrictamente a más: los objetos no se solapan.
    for (let n = 2; n < desplazamientos.length; n++) {
      expect(desplazamientos[n]).toBeGreaterThan(desplazamientos[n - 1])
    }
  })

  it('la estructura declara lo que el documento tiene: páginas, fuentes y catálogo', () => {
    const doc = documentoDePrueba((d) => {
      d.pagina()
      d.texto('otra', { x: 10, y: 10, tam: 3 })
    })
    const texto = aLatin1(doc.bytes())
    expect(texto).toContain('/Type /Catalog /Pages 2 0 R')
    expect(texto).toContain('/Type /Pages /Count 2 /Kids [')
    expect(texto).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding')
    expect(texto).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding')
    // A4 en puntos, que es lo único que el PDF entiende: el mm no se asoma.
    expect(texto).toContain(`/MediaBox [0 0 595.276 841.89]`)
    expect(A4_ANCHO_MM * PUNTOS_POR_MM).toBeCloseTo(595.276, 3)
  })

  it('solo se declaran las fuentes que se han usado', () => {
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    doc.texto('solo normal', { x: 10, y: 10, tam: 3 })
    const texto = aLatin1(doc.bytes())
    expect(texto).toContain('/BaseFont /Helvetica ')
    expect(texto).not.toContain('Helvetica-Bold')
    expect(revisarPdf(doc.bytes()).problemas).toEqual([])
  })

  it('un documento sin dibujar nada sigue siendo un PDF válido de una página', () => {
    // Un PDF con cero páginas NO es un PDF, así que el documento nace con una
    // abierta y `nPaginas()` nunca puede devolver 0.
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    expect(doc.nPaginas()).toBe(1)
    const { problemas } = revisarPdf(doc.bytes())
    expect(problemas).toEqual([])
  })

  it('bytes() no consume el documento: llamarlo dos veces da lo mismo', () => {
    const doc = documentoDePrueba()
    expect(Buffer.from(doc.bytes())).toEqual(Buffer.from(doc.bytes()))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · El texto dentro del PDF: WinAnsi, escapes y sustituciones
// ═════════════════════════════════════════════════════════════════════════════

/** Los bytes de la primera cadena literal `(...)` del content stream. */
function primerLiteral(bytes) {
  const texto = aLatin1(bytes)
  const inicio = texto.indexOf('Tm\n(') + 3
  let i = inicio + 1
  const salida = []
  while (i < texto.length) {
    const b = bytes[i]
    if (b === 0x5c) {
      salida.push(bytes[i + 1])
      i += 2
      continue
    }
    if (b === 0x29) break
    salida.push(b)
    i += 1
  }
  return { crudos: bytes.slice(inicio, i + 1), desescapados: salida }
}

describe('report/pdf · el texto se codifica en CP1252 y se escapa', () => {
  const conTexto = (t) => {
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    doc.texto(t, { x: 10, y: 10, tam: 3 })
    return doc
  }

  // La tabla que de verdad demuestra que la codificación es correcta: se comparan
  // BYTES, no anchos. Latin-1 es identidad y los 27 huecos de la franja 0x80–0x9F
  // van uno a uno. Los de la franja alta se escriben con `\u` A PROPÓSITO: una
  // comilla tipográfica pegada en el fuente es indistinguible de un apóstrofo, y
  // aquí lo que se está afirmando es precisamente cuál de los dos es.
  const CP1252_ESPERADO = [
    ['ñÑáéíóúÁÉÍÓÚüÜ', [0xf1, 0xd1, 0xe1, 0xe9, 0xed, 0xf3, 0xfa, 0xc1, 0xc9, 0xcd, 0xd3, 0xda, 0xfc, 0xdc]],
    ['¿¡ªº«»·±°²§¦©®µ¼½', [0xbf, 0xa1, 0xaa, 0xba, 0xab, 0xbb, 0xb7, 0xb1, 0xb0, 0xb2, 0xa7, 0xa6, 0xa9, 0xae, 0xb5, 0xbc, 0xbd]],
    ['€–—•…', [0x80, 0x96, 0x97, 0x95, 0x85]],
    ['œŒšŠžŽŸƒ', [0x9c, 0x8c, 0x9a, 0x8a, 0x9e, 0x8e, 0x9f, 0x83]],
    ['†‡‰‹›', [0x86, 0x87, 0x89, 0x8b, 0x9b]],
    ['„“”‚‘’', [0x84, 0x93, 0x94, 0x82, 0x91, 0x92]],
    ['˜™ˆ', [0x98, 0x99, 0x88]],
  ]

  it.each(CP1252_ESPERADO)('«%s» viaja como un byte por letra, con el valor de CP1252', (cadena, bytes) => {
    expect(primerLiteral(conTexto(cadena).bytes()).desescapados).toEqual(bytes)
  })

  it('la tabla de contraste cubre los 27 huecos de la franja 0x80–0x9F', () => {
    // Si mañana alguien quitara un caso de la tabla, el contraste se volvería
    // parcial sin que nadie se enterase. Aquí se afirma que están todos.
    const cubiertos = new Set(CP1252_ESPERADO.flatMap(([, bytes]) => bytes).filter((b) => b < 0xa0))
    expect(cubiertos.size).toBe(27)
  })

  it('escapa los paréntesis y la barra invertida (si no, el PDF no abre)', () => {
    const { crudos, desescapados } = primerLiteral(conTexto('a(b)c\\d').bytes())
    expect(aLatin1(crudos)).toBe('(a\\(b\\)c\\\\d)')
    expect(String.fromCharCode(...desescapados)).toBe('a(b)c\\d')
  })

  it('un carácter fuera de CP1252 se sustituye Y SE DECLARA (regla de oro 1)', () => {
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    doc.texto('límite ł y flecha →', { x: 10, y: 10, tam: 3 })
    doc.pagina()
    const resultado = doc.texto('emoji 🙂', { x: 10, y: 10, tam: 3 })

    // (a) se ve en el papel…
    expect(String.fromCharCode(...primerLiteral(doc.bytes()).desescapados)).toContain('?')
    // (b) …y la llamada lo devuelve…
    expect(resultado.sustituciones).toHaveLength(1)
    expect(resultado.sustituciones[0].caracter).toBe('🙂')
    // Un par subrogado es UN carácter y produce UN sustituto, no dos.
    expect(resultado.sustituciones[0].punto).toBe(0x1f642)
    // (c) …y queda anotado en el documento, con página y sitio.
    const todas = doc.sustituciones()
    expect(todas.map((s) => s.caracter)).toEqual(['ł', '→', '🙂'])
    expect(todas.map((s) => s.pagina)).toEqual([1, 1, 2])
    expect(todas.every((s) => s.sustituto === SUSTITUTO_NO_REPRESENTABLE)).toBe(true)
    expect(todas[0].texto).toBe('límite ł y flecha →')
  })

  it('un documento en español correcto no declara NI UNA sustitución', () => {
    // La otra mitad: si `sustituciones()` estuviera siempre lleno, la nota que
    // produzca la maqueta sería ruido y nadie la leería.
    const doc = documentoDePrueba()
    expect(doc.sustituciones()).toEqual([])
  })

  it('los controles no tienen glifo en WinAnsi: un \\n colado en texto() se declara', () => {
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    const r = doc.texto('dos\nlíneas', { x: 10, y: 10, tam: 3 })
    expect(r.sustituciones.map((s) => s.punto)).toEqual([0x0a])
    // Y el literal no lleva un salto de línea crudo, que además desharía la cuenta
    // de bytes de quien leyera el content stream por líneas.
    expect(aLatin1(primerLiteral(doc.bytes()).crudos)).not.toContain('\n')
  })

  it('normaliza a NFC antes de codificar: una ñ descompuesta no se pierde', () => {
    const doc = conTexto('An\u0303o')
    expect(primerLiteral(doc.bytes()).desescapados).toEqual([0x41, 0xf1, 0x6f])
    expect(doc.sustituciones()).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4bis · El diccionario /Info va en UTF-16BE con BOM (auditoría R1)
// ═════════════════════════════════════════════════════════════════════════════
//
// Fuera de los content streams el estándar solo admite PDFDocEncoding o UTF-16BE
// con BOM. CP1252 coincide con PDFDocEncoding en 0xA0–0xFF pero diverge en
// 0x80–0x9F: un «’» (U+2019) codificado 0x92 se mostraba con otro glifo en las
// propiedades del documento. El escritor codifica Title/Author/Producer en
// UTF-16BE; la fecha sigue en ASCII (el formato `D:…` es una cadena de bytes).

/** Los bytes del literal `(...)` de una clave del /Info, con los escapes deshechos. */
function literalDeInfo(bytes, clave) {
  const texto = aLatin1(bytes)
  const i = texto.indexOf(`/${clave} (`)
  if (i < 0) return null
  let j = i + clave.length + 3
  const salida = []
  while (j < bytes.length) {
    const b = bytes[j]
    if (b === 0x5c) {
      const siguiente = bytes[j + 1]
      salida.push(siguiente === 0x6e ? 0x0a : siguiente === 0x72 ? 0x0d : siguiente)
      j += 2
      continue
    }
    if (b === 0x29) break
    salida.push(b)
    j += 1
  }
  return { desescapados: salida, crudos: bytes.slice(i + clave.length + 3, j) }
}

/** UTF-16BE con BOM → string, afirmando el BOM por el camino. */
function decodificarUtf16Be(bytes) {
  expect(bytes.slice(0, 2), 'la cadena del /Info no empieza por el BOM FE FF').toEqual([0xfe, 0xff])
  let salida = ''
  for (let i = 2; i < bytes.length; i += 2) {
    salida += String.fromCharCode((bytes[i] << 8) | bytes[i + 1])
  }
  return salida
}

describe('report/pdf · el /Info se codifica en UTF-16BE con BOM, no en CP1252', () => {
  const docCon = (opciones) =>
    crearDocumentoPdf({ anchoMm: 100, altoMm: 100, productor: null, ...opciones })

  it('el caso de la auditoría: «José O’Hara» viaja con su U+2019, sin el byte 0x92 de CP1252', () => {
    const autor = 'José O’Hara'
    const bytes = docCon({ autor }).bytes()
    const literal = literalDeInfo(bytes, 'Author')
    expect(literal).not.toBeNull()
    // Se decodifica ENTERO desde los bytes: BOM + UTF-16BE, y vuelve el original.
    expect(decodificarUtf16Be(literal.desescapados)).toBe(autor)
    // El apóstrofo tipográfico son los bytes 20 19, no el 92 de CP1252 que un
    // lector interpretaría con otro glifo en PDFDocEncoding.
    const sinBom = literal.desescapados.slice(2)
    const pares = []
    for (let i = 0; i < sinBom.length; i += 2) pares.push([sinBom[i], sinBom[i + 1]])
    expect(pares).toContainEqual([0x20, 0x19])
    expect(pares).not.toContainEqual([0x00, 0x92])
  })

  it('el español entero del título sobrevive al viaje de ida y vuelta', () => {
    const titulo = 'Medición de la parcela nº 5 — año 2026 · ±0,50 m — ¿encaja?'
    const bytes = docCon({ titulo }).bytes()
    expect(decodificarUtf16Be(literalDeInfo(bytes, 'Title').desescapados)).toBe(titulo)
  })

  it('lo que CP1252 no puede escribir, el /Info sí: ł, → y un emoji, sin «?» y sin sustitución', () => {
    const titulo = 'Załącznik → informe 🙂'
    const doc = docCon({ titulo })
    const bytes = doc.bytes()
    const vuelto = decodificarUtf16Be(literalDeInfo(bytes, 'Title').desescapados)
    // El par subrogado del emoji viaja como dos unidades UTF-16, que ES UTF-16.
    expect(vuelto).toBe(titulo)
    expect(vuelto).not.toContain('?')
    expect(doc.sustituciones()).toEqual([])
  })

  it('paréntesis y barra invertida del título van escapados y se recuperan', () => {
    const titulo = 'Informe (borrador) \\ v2'
    const bytes = docCon({ titulo }).bytes()
    expect(decodificarUtf16Be(literalDeInfo(bytes, 'Title').desescapados)).toBe(titulo)
    expect(revisarPdf(bytes).problemas).toEqual([])
  })

  it('un punto de código con 0x0A o 0x0D entre sus bytes no mete un fin de línea crudo en el literal', () => {
    // «Ċ» es U+010A: su byte bajo es un LF. Sin el escape de literalPdf, el lector
    // lo normalizaría (tratamiento de EOL del PDF) y la cadena cambiaría. «ഠ» es
    // U+0D20: su byte ALTO es un CR, el otro lado del mismo peligro.
    const titulo = 'CĊDഠE'
    const bytes = docCon({ titulo }).bytes()
    const literal = literalDeInfo(bytes, 'Title')
    expect([...literal.crudos]).not.toContain(0x0a)
    expect([...literal.crudos]).not.toContain(0x0d)
    expect(decodificarUtf16Be(literal.desescapados)).toBe(titulo)
  })

  it('la fecha de creación sigue en ASCII: el formato D:… es una cadena de bytes', () => {
    const bytes = docCon({ titulo: 'x', fecha: FECHA }).bytes()
    expect(aLatin1(bytes)).toContain("/CreationDate (D:20260802123015Z00'00')")
  })

  it('el CUERPO no cambia: las fuentes siguen en WinAnsi y el texto en CP1252', () => {
    const doc = docCon({ titulo: 'Título con euro €' })
    doc.texto('cuerpo con € y ñ', { x: 10, y: 10, tam: 3 })
    const bytes = doc.bytes()
    expect(aLatin1(bytes)).toContain('/Encoding /WinAnsiEncoding')
    // En el content stream el € sigue siendo el byte 0x80 de CP1252…
    expect(primerLiteral(bytes).desescapados).toContain(0x80)
    // …y en el /Info son los bytes UTF-16 20 AC.
    const sinBom = literalDeInfo(bytes, 'Title').desescapados.slice(2)
    const pares = []
    for (let i = 0; i < sinBom.length; i += 2) pares.push([sinBom[i], sinBom[i + 1]])
    expect(pares).toContainEqual([0x20, 0xac])
  })

  it('el oráculo estructural sigue en paz con la metadata UTF-16', () => {
    expect(revisarPdf(documentoDePrueba().bytes()).problemas).toEqual([])
  })
})

describe('report/pdf · sustitucionesDe (la consulta pura que usa la nota de composición, R3)', () => {
  it('devuelve lo que codificaría el escritor, sin escribir nada', () => {
    expect(sustitucionesDe('todo en español: año, medición, ±0,50 m')).toEqual([])
    const flecha = sustitucionesDe('ida → vuelta')
    expect(flecha).toHaveLength(1)
    expect(flecha[0].punto).toBe(0x2192)
    expect(flecha[0].caracter).toBe('→')
  })

  it('coincide con lo que texto() declara al escribir de verdad (misma tabla, ninguna segunda verdad)', () => {
    const cadena = 'pie con ł y 🙂'
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    const escritas = doc.texto(cadena, { x: 10, y: 10, tam: 3 }).sustituciones
    const consultadas = sustitucionesDe(cadena)
    expect(consultadas.map((s) => [s.caracter, s.punto, s.indice])).toEqual(
      escritas.map((s) => [s.caracter, s.punto, s.indice]),
    )
  })

  it('exige un string, como todo el contrato del módulo', () => {
    expect(() => sustitucionesDe(42)).toThrow(TypeError)
    expect(() => sustitucionesDe(null)).toThrow(/se espera un string/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · La imagen JPEG
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf · imagenJpeg', () => {
  const conImagen = (bytes = JPEG, extra = {}) => {
    const doc = crearDocumentoPdf({ anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM })
    const info = doc.imagenJpeg(bytes, { x: 20, y: 40, anchoMm: 120, altoMm: 80, ...extra })
    return { doc, info }
  }

  it('lee del propio JPEG su tamaño y sus componentes', () => {
    const { info } = conImagen()
    expect(info).toMatchObject({ anchoPx: 24, altoPx: 16, componentes: 3, nombre: '/Im0' })
    // La resolución efectiva sobre el papel, que es el dato que dice si el plano
    // sale a 300 ppp de verdad o si se está estirando una imagen pequeña.
    expect(info.ppp).toBeCloseTo(24 / (120 / 25.4), 9)
  })

  it('los bytes del JPEG van PEGADOS TAL CUAL, sin recodificar ni una muestra', () => {
    const { doc } = conImagen()
    const { streams } = revisarPdf(doc.bytes())
    const delJpeg = streams.find((s) => s.longitud === JPEG.length)
    expect(delJpeg, 'no hay ningún stream con la longitud exacta del JPEG').toBeDefined()
    expect(Buffer.from(delJpeg.bytes)).toEqual(Buffer.from(JPEG))
  })

  it('lo declara como XObject DCTDecode en DeviceRGB, con el tamaño real', () => {
    const texto = aLatin1(conImagen().doc.bytes())
    expect(texto).toContain(
      '/Type /XObject /Subtype /Image /Width 24 /Height 16 /ColorSpace /DeviceRGB ' +
        '/BitsPerComponent 8 /Filter /DCTDecode',
    )
    // Y se coloca con `cm` en puntos, dentro de su q…Q.
    expect(texto).toMatch(/q\n340\.157 0 0 226\.772 \d+(\.\d+)? \d+(\.\d+)? cm\n\/Im0 Do\nQ/)
  })

  it('un tamaño DECLARADO que no case con el del JPEG es un error, no una nota', () => {
    // Está MEDIDO (F09/T0.1) que el WMS del Catastro, pedido por encima de sus
    // 4.000 px, no recorta: SUSTITUYE, con HTTP 200 y sin decir nada. Un escritor
    // que se creyera lo declarado pondría el plano descolocado y nadie se
    // enteraría: error silencioso de manual.
    expect(() => conImagen(JPEG, { anchoPx: 2126, altoPx: 16 })).toThrow(RangeError)
    expect(() => conImagen(JPEG, { anchoPx: 2126, altoPx: 16 })).toThrow(/2126 px de ancho.*trae 24/s)
    // Y declarar lo correcto no molesta.
    expect(() => conImagen(JPEG, { anchoPx: 24, altoPx: 16 })).not.toThrow()
  })

  it('un JPEG en escala de grises se declara /DeviceGray', () => {
    // Fixture DERIVADO del JPEG real: se le cambia a 1 el byte de «número de
    // componentes» del SOF0. No decodificaría, pero lo que se está probando es la
    // lectura de la cabecera y la elección del espacio de color, y para eso una
    // mutación del fichero real es mejor prueba que un fichero inventado.
    const gris = mutarComponentes(JPEG, 1)
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    expect(doc.imagenJpeg(gris, { x: 0, y: 0, anchoMm: 50, altoMm: 30 }).componentes).toBe(1)
    expect(aLatin1(doc.bytes())).toContain('/ColorSpace /DeviceGray')
  })

  it('un JPEG CMYK se rechaza DICIENDO por qué, en vez de salir con los colores al revés', () => {
    expect(() => {
      crearDocumentoPdf({ anchoMm: 100, altoMm: 100 }).imagenJpeg(mutarComponentes(JPEG, 4), {
        x: 0,
        y: 0,
        anchoMm: 50,
        altoMm: 30,
      })
    }).toThrow(/4 componentes.*\/Decode/s)
  })

  it('lo que no es un JPEG se rechaza en la primera comprobación', () => {
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    const caja = { x: 0, y: 0, anchoMm: 10, altoMm: 10 }
    // Un PNG: empieza por 89 50 4E 47 y no por el SOI de un JPEG.
    expect(() => doc.imagenJpeg(Uint8Array.of(0x89, 0x50, 0x4e, 0x47), caja)).toThrow(/SOI/)
    // Un JPEG truncado antes del SOF: no se puede saber ni su tamaño.
    expect(() => doc.imagenJpeg(JPEG.slice(0, 20), caja)).toThrow(RangeError)
    // Y lo que no es un Uint8Array, aunque se le parezca.
    expect(() => doc.imagenJpeg([...JPEG], caja)).toThrow(TypeError)
    expect(() => doc.imagenJpeg(JPEG.buffer, caja)).toThrow(TypeError)
    // Un `Buffer` de Node SÍ vale: es un Uint8Array, y rechazarlo sería exigir
    // una conversión que no aporta nada.
    expect(() => doc.imagenJpeg(Buffer.from(JPEG), caja)).not.toThrow()
  })

  it('dos imágenes en el mismo documento son dos XObjects distintos', () => {
    const doc = crearDocumentoPdf({ anchoMm: 200, altoMm: 200 })
    expect(doc.imagenJpeg(JPEG, { x: 0, y: 0, anchoMm: 50, altoMm: 30 }).nombre).toBe('/Im0')
    expect(doc.imagenJpeg(JPEG, { x: 0, y: 60, anchoMm: 50, altoMm: 30 }).nombre).toBe('/Im1')
    expect(revisarPdf(doc.bytes()).problemas).toEqual([])
  })
})

/** Cambia el número de componentes del SOF0 de un JPEG real. Ver el test que lo usa. */
function mutarComponentes(jpeg, n) {
  const copia = Uint8Array.from(jpeg)
  for (let i = 2; i < copia.length - 9; i++) {
    if (copia[i] === 0xff && copia[i + 1] === 0xc0) {
      copia[i + 9] = n
      return copia
    }
  }
  throw new Error('el fixture no tiene SOF0: el mutador no sirve')
}

// ═════════════════════════════════════════════════════════════════════════════
// 6 · Geometría: milímetros fuera, puntos y Y invertida dentro
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf · el API habla en mm desde arriba; el PDF, en puntos desde abajo', () => {
  it('la Y se invierte: 25 mm desde arriba en A4 son 272 mm desde abajo, en puntos', () => {
    const doc = crearDocumentoPdf({ anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM })
    doc.texto('x', { x: 20, y: 25, tam: 3 })
    const texto = aLatin1(doc.bytes())
    const esperadoY = (A4_ALTO_MM - 25) * PUNTOS_POR_MM
    expect(texto).toContain(`1 0 0 1 ${(20 * PUNTOS_POR_MM).toFixed(3)} ${esperadoY.toFixed(3)} Tm`)
  })

  it('el rectángulo se da por su esquina SUPERIOR izquierda y baja por el alto', () => {
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    doc.rect(10, 20, 30, 40, { relleno: 0.5 })
    // 100 − (20 + 40) = 40 mm desde abajo hasta el borde inferior del rectángulo.
    const texto = aLatin1(doc.bytes())
    expect(texto).toContain(
      `${(10 * PUNTOS_POR_MM).toFixed(3)} ${(40 * PUNTOS_POR_MM).toFixed(3)} ` +
        `${(30 * PUNTOS_POR_MM).toFixed(3)} ${(40 * PUNTOS_POR_MM).toFixed(3)} re`,
    )
  })

  it('relleno, trazo o los dos: cada combinación emite su operador', () => {
    const de = (opciones) => {
      const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
      doc.rect(10, 10, 10, 10, opciones)
      return aLatin1(doc.bytes())
    }
    expect(de({ relleno: 0 })).toMatch(/re\nf\n/)
    expect(de({ trazo: 0 })).toMatch(/re\nS\n/)
    expect(de({ relleno: 0.9, trazo: 0 })).toMatch(/re\nB\n/)
  })

  it('los números nunca salen en notación exponencial (el PDF no la entiende)', () => {
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    doc.linea(0.0000001, 0.0000001, 99.9999999, 50, { grosor: 0.0001 })
    doc.texto('x', { x: 1e-7, y: 1e-7, tam: 0.001 })
    expect(aLatin1(doc.bytes())).not.toMatch(/\de[+-]\d/)
  })

  it('el gris se aísla con q…Q: un color no se queda puesto para lo que venga detrás', () => {
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    doc.texto('claro', { x: 10, y: 10, tam: 3, gris: 0.6 })
    doc.texto('negro', { x: 10, y: 20, tam: 3 })
    const texto = aLatin1(doc.bytes())
    expect(texto).toContain('q\n0.6 g\nBT')
    expect(texto).toContain('q\n0 g\nBT')
    expect((texto.match(/\bQ\n/g) ?? []).length).toBe((texto.match(/\bq\n/g) ?? []).length)
  })

  it('irAPagina permite volver atrás a escribir «Página N de M»', () => {
    // No estaba en el contrato original: se añadió porque «de M» no se puede
    // escribir hasta saber cuántas son, y sin esto habría que componer el
    // documento entero dos veces.
    const doc = crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })
    doc.pagina()
    doc.pagina()
    expect(doc.nPaginas()).toBe(3)
    for (let n = 1; n <= doc.nPaginas(); n++) {
      doc.irAPagina(n)
      expect(doc.paginaActual()).toBe(n)
      doc.texto(`Página ${n} de ${doc.nPaginas()}`, { x: 10, y: 90, tam: 2.5 })
    }
    const texto = aLatin1(doc.bytes())
    for (let n = 1; n <= 3; n++) expect(texto).toContain(`(P\xe1gina ${n} de 3)`)
    expect(revisarPdf(doc.bytes()).problemas).toEqual([])
    expect(() => doc.irAPagina(4)).toThrow(/la página 4 no existe/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · Contrato roto por el programador
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf · el contrato roto se dice en español y con lo que se esperaba', () => {
  const doc = () => crearDocumentoPdf({ anchoMm: 100, altoMm: 100 })

  it('crearDocumentoPdf exige un objeto con dos medidas positivas', () => {
    expect(() => crearDocumentoPdf()).toThrow(TypeError)
    expect(() => crearDocumentoPdf()).toThrow(/\{anchoMm, altoMm\}/)
    expect(() => crearDocumentoPdf({ anchoMm: '210', altoMm: 297 })).toThrow(TypeError)
    expect(() => crearDocumentoPdf({ anchoMm: 0, altoMm: 297 })).toThrow(RangeError)
    expect(() => crearDocumentoPdf({ anchoMm: NaN, altoMm: 297 })).toThrow(RangeError)
    expect(() => crearDocumentoPdf({ anchoMm: -1, altoMm: 297 })).toThrow(/mayor que cero/)
  })

  it('la fecha se INYECTA y se valida; null es legítimo', () => {
    expect(() => crearDocumentoPdf({ anchoMm: 10, altoMm: 10, fecha: '2026-08-02' })).toThrow(
      /no consulta el reloj/,
    )
    expect(() =>
      crearDocumentoPdf({ anchoMm: 10, altoMm: 10, fecha: new Date('no es una fecha') }),
    ).toThrow(RangeError)
    expect(() => crearDocumentoPdf({ anchoMm: 10, altoMm: 10, fecha: null })).not.toThrow()
  })

  it('texto exige string, medidas finitas, tamaño positivo, fuente conocida y gris de 0 a 1', () => {
    expect(() => doc().texto(42, { x: 0, y: 0, tam: 3 })).toThrow(TypeError)
    expect(() => doc().texto('a', { x: Infinity, y: 0, tam: 3 })).toThrow(/no es finito/)
    expect(() => doc().texto('a', { x: 0, y: 0, tam: 0 })).toThrow(RangeError)
    expect(() => doc().texto('a', { x: 0, y: 0, tam: 3, fuente: 'cursiva' })).toThrow(
      /'normal' o 'negrita'/,
    )
    expect(() => doc().texto('a', { x: 0, y: 0, tam: 3, gris: 2 })).toThrow(
      /0 \(negro\) a 1 \(blanco\)/,
    )
  })

  it('un rectángulo sin relleno ni trazo no se traga en silencio', () => {
    // Dibujar nada y no decirlo es exactamente la clase de error que la regla de
    // oro 1 prohíbe: la llamada se perdería y la maqueta saldría sin el marco.
    expect(() => doc().rect(0, 0, 10, 10)).toThrow(RangeError)
    expect(() => doc().rect(0, 0, 10, 10)).toThrow(/no dibujaría nada/)
  })

  it('medirTexto y partirTexto exigen sus opciones', () => {
    expect(() => doc().medirTexto('a')).toThrow(/\{tam, fuente\}/)
    expect(() => doc().medirTexto(1, { tam: 3 })).toThrow(TypeError)
    expect(() => doc().partirTexto('a', 0, { tam: 3 })).toThrow(/mayor que cero/)
    expect(() => doc().partirTexto('a', 10, { tam: 3, fuente: 'redonda' })).toThrow(RangeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Guardianes: el reloj, la pureza y el peso
// ═════════════════════════════════════════════════════════════════════════════

describe('report/pdf · no lee el reloj del sistema', () => {
  // Mismo guardián, con las mismas palabras, que `report/contraste-texto.js` y
  // que `gml/`. Un PDF descargado es un SNAPSHOT: si el módulo consultara la
  // marca de tiempo, el snapshot del final de este fichero cambiaría en cada
  // ejecución y dejaría de afirmar nada. Se mira el TEXTO ENTERO del fuente,
  // comentarios incluidos.
  const INSTANCIA_FECHA = /\bnew\s+Date\b/
  const RELOJ = /\bDate\s*\.\s*now\b/
  const FORMATO_LOCAL = /toLocale(Date|Time)?String\b/

  it('no instancia una fecha propia ni consulta la marca de tiempo', () => {
    expect(INSTANCIA_FECHA.test(FUENTE_MODULO), 'instancia una fecha propia').toBe(false)
    expect(RELOJ.test(FUENTE_MODULO), 'consulta el reloj del sistema').toBe(false)
  })

  it('no usa formateadores de fecha dependientes del entorno', () => {
    expect(FORMATO_LOCAL.test(FUENTE_MODULO)).toBe(false)
    expect(FUENTE_MODULO).toContain('getUTCFullYear')
  })

  it('los detectores no son vacuos', () => {
    expect(INSTANCIA_FECHA.test('const x = new Date()')).toBe(true)
    expect(RELOJ.test('const t = Date . now()')).toBe(true)
    expect(FORMATO_LOCAL.test('f.toLocaleDateString("es-ES")')).toBe(true)
    expect(INSTANCIA_FECHA.test('if (fecha instanceof Date) return')).toBe(false)
  })

  it('el mismo documento produce los mismos bytes, dos veces seguidas', () => {
    expect(Buffer.from(documentoDePrueba().bytes())).toEqual(
      Buffer.from(documentoDePrueba().bytes()),
    )
  })

  it('la fecha inyectada se rinde en UTC, y sin ella el documento sale sin fecha', () => {
    expect(aLatin1(documentoDePrueba().bytes())).toContain("/CreationDate (D:20260802123015Z00'00')")
    const sinFecha = crearDocumentoPdf({ anchoMm: 10, altoMm: 10 })
    expect(aLatin1(sinFecha.bytes())).not.toContain('/CreationDate')
  })
})

describe('report/pdf · puro y sin dependencias', () => {
  it('no importa nada: es la regla de la capa report/', () => {
    expect(FUENTE_MODULO).not.toMatch(/(?:^|\n)[ \t]*import[^\n]*from\s*['"]/)
    expect(FUENTE_MODULO).not.toMatch(/\brequire\s*\(/)
  })

  it('no toca el DOM, ni la red, ni el almacenamiento', () => {
    for (const prohibido of [
      /\bdocument\b/,
      /\bwindow\b/,
      /\bfetch\s*\(/,
      /\bBlob\b/,
      /\bnavigator\b/,
      /\blocalStorage\b/,
      /\batob\b/,
      /\bbtoa\b/,
    ]) {
      expect(prohibido.test(FUENTE_MODULO), `el módulo nombra ${prohibido}`).toBe(false)
    }
    // El detector no es vacuo: sabe distinguir «documento» de `document`.
    expect(/\bdocument\b/.test('const documento = {}')).toBe(false)
    expect(/\bdocument\b/.test('document.title')).toBe(true)
  })

  it('cabe en el presupuesto: decenas de kB de CÓDIGO, no cientos', () => {
    // El escritor existe para NO meter los ~350 kB de jsPDF. Si un día esto se
    // acerca a ese orden de magnitud, es que se está reimplementando jsPDF a
    // trozos, y lo acordado entonces es PARAR y volver a discutirlo.
    //
    // Se miden los bytes SIN comentarios, que es lo que de verdad se empaqueta:
    // medir el fichero entero castigaría a quien documente y no detectaría a
    // quien meta mil líneas de código apretado. Referencia medida el 2026-08-02:
    // 24,7 kB de código, 6,8 kB en gzip.
    const codigo = FUENTE_MODULO.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n')
    const kB = Buffer.byteLength(codigo, 'utf8') / 1024
    expect(kB, `report/pdf.js son ${kB.toFixed(1)} kB de código sin comentarios`).toBeLessThan(40)
    // Y la otra mitad: que el fichero siga estando EXPLICADO. Esta capa se
    // escribe así a propósito (ver `report/contraste-texto.js`).
    expect(Buffer.byteLength(FUENTE_MODULO, 'utf8') - Buffer.byteLength(codigo, 'utf8')).toBeGreaterThan(
      10 * 1024,
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · El SNAPSHOT de bytes — y va el último, a propósito
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Los bytes como texto auditable: lo imprimible tal cual, los saltos de línea
 * como saltos, y todo lo demás en hexadecimal entre guillemets. Así el snapshot
 * se puede LEER —incluidos los desplazamientos de la xref, que es lo que de
 * verdad se quiere congelar— en vez de ser una cadena base64 que nadie revisa.
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

describe('report/pdf · snapshot de bytes de un documento mínimo', () => {
  const minimo = () => {
    const doc = crearDocumentoPdf({
      anchoMm: A4_ANCHO_MM,
      altoMm: A4_ALTO_MM,
      titulo: 'Informe de contraste con el parcelario catastral',
      fecha: FECHA,
    })
    doc.texto('Parcela 9398516VK3799G', { x: 20, y: 25, tam: 4, fuente: 'negrita' })
    doc.texto('Señalización de linderos · ±0,50 m', { x: 20, y: 32, tam: 3, gris: 0.25 })
    doc.linea(20, 35, 190, 35, { grosor: 0.4 })
    return doc
  }

  it('el documento mínimo, byte a byte', () => {
    expect(volcado(minimo().bytes())).toMatchSnapshot()
  })

  it('y su tamaño, que es el argumento de todo esto', () => {
    // Un informe de una página con texto pesa menos de 2 kB. jsPDF pesa 350 kB
    // ANTES de escribir el primer carácter.
    const n = minimo().bytes().length
    expect(n).toBeLessThan(2048)
    expect(n).toMatchSnapshot()
  })
})
