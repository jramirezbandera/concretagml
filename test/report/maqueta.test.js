/* -------------------------------------------------------------------------- *
 * test/report/maqueta.test.js — Auditoría 2026-08 · tres defectos LATENTES    *
 * del motor de maqueta, cada uno con su test de regresión.                    *
 *                                                                            *
 *  · R2 — la cabecera de una tabla se PARTÍA midiendo Helvetica normal y se  *
 *    pintaba en negrita (~5–10 % más ancha): un rótulo justo al límite       *
 *    invadía la columna vecina o, alineado a la derecha, arrancaba a la      *
 *    izquierda de su columna. Se mide con la MISMA fuente con que se pinta.  *
 *                                                                            *
 *  · R3 — la «Nota de composición» se imprimía ANTES de estampar los pies,   *
 *    que también escriben texto: una sustitución ocurrida en el pie quedaba  *
 *    anotada en `sustituciones()` pero NO enumerada en el papel. Como el pie *
 *    se estampa el último (necesita el total de páginas), la nota PRE-ESCANEA *
 *    los textos del pie con el codificador real (`report/pdf.js#sustitucionesDe`) *
 *    y los declara; el orden nota→pies no cambia y la paginación es exacta.  *
 *                                                                            *
 *  · R4 — `exigirPlanoEncajable` solo comparaba la relación de aspecto: un   *
 *    plano de OTRO trabajo con las mismas dimensiones en píxeles pasaba, y   *
 *    el papel rotulaba la escala nueva bajo el mapa viejo («la peor avería   *
 *    posible», dice su propia cabecera). El plano ahora TRANSPORTA la        *
 *    identidad de su encuadre (bbox y escalaExacta, de report/canvas.js) y   *
 *    aquí se coteja con igualdad EXACTA de coma flotante: si son el mismo    *
 *    trabajo, son literalmente los mismos números.                           *
 *                                                                            *
 * Proyecto Vitest `node`: todo lo probado aquí es puro. Sin sufijo `.dom`.   *
 * -------------------------------------------------------------------------- */

import { describe, expect, it } from 'vitest'

import { encuadrar } from '../../report/encuadre.js'
import {
  AIRE_COLUMNA,
  TAM,
  bloqueSustituciones,
  crearMaqueta,
  estamparPies,
  exigirPlanoEncajable,
} from '../../report/maqueta.js'
import { A4_ALTO_MM, A4_ANCHO_MM, crearDocumentoPdf } from '../../report/pdf.js'

/** Bytes → latin1: cada byte es un carácter, el índice ES el desplazamiento. */
const aLatin1 = (bytes) => Buffer.from(bytes).toString('latin1')

/**
 * Un documento real con el método `texto` espiado: registra cada llamada con sus
 * opciones ANTES de delegarla intacta. Los métodos de `crearDocumentoPdf` son
 * cierres (no usan `this`), así que la copia por spread no rompe nada.
 */
function docEspiado() {
  const doc = crearDocumentoPdf({ anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM })
  const llamadas = []
  const espia = {
    ...doc,
    texto: (texto, opciones) => {
      llamadas.push({ texto, ...opciones })
      return doc.texto(texto, opciones)
    },
  }
  return { doc, espia, llamadas }
}

// ═════════════════════════════════════════════════════════════════════════════
// R2 · La cabecera de tabla se mide con la MISMA fuente con que se pinta
// ═════════════════════════════════════════════════════════════════════════════

describe('report/maqueta · R2 · la cabecera se parte midiendo en negrita', () => {
  // Una etiqueta de puras «l», que es donde normal (222‰) y negrita (278‰) más
  // divergen: cabe en la columna medida en normal y NO cabe pintada en negrita.
  const ETIQUETA = 'l'.repeat(12)
  const ANCHO_COL = 10.6
  const X_COL = 15 + 30 // MARGEN.IZQUIERDA + ancho de la primera columna

  it('el caso NO es vacuo: la etiqueta cabe en normal y no cabe en negrita', () => {
    const { doc } = docEspiado()
    const util = ANCHO_COL - AIRE_COLUMNA
    expect(doc.medirTexto(ETIQUETA, { tam: TAM.TABLA, fuente: 'normal' })).toBeLessThanOrEqual(util)
    expect(doc.medirTexto(ETIQUETA, { tam: TAM.TABLA, fuente: 'negrita' })).toBeGreaterThan(util)
  })

  it('ninguna línea de la cabecera pintada en negrita excede su columna ni arranca a la izquierda de ella', () => {
    const { doc, espia, llamadas } = docEspiado()
    const maqueta = crearMaqueta(espia)
    // Segunda columna SIN alinear a la izquierda (el defecto se veía como un
    // rótulo que arrancaba a la izquierda de xCol).
    maqueta.tabla(['A', ETIQUETA], [['x', '1']], { anchos: [30, ANCHO_COL] })

    const deCabecera = llamadas.filter((l) => l.fuente === 'negrita' && l.texto.startsWith('l'))
    expect(deCabecera.length, 'la cabecera no se ha pintado').toBeGreaterThan(0)
    // Con la medición en negrita, la etiqueta ya no cabe en una línea: se parte.
    expect(deCabecera.length).toBeGreaterThanOrEqual(2)
    for (const l of deCabecera) {
      expect(
        doc.medirTexto(l.texto, { tam: TAM.TABLA, fuente: 'negrita' }),
        `«${l.texto}» pintada en negrita excede el ancho útil de su columna`,
      ).toBeLessThanOrEqual(ANCHO_COL - AIRE_COLUMNA + 1e-9)
      expect(
        l.x,
        `«${l.texto}» arranca a la izquierda de su columna (xCol = ${X_COL})`,
      ).toBeGreaterThanOrEqual(X_COL - 1e-9)
    }
  })

  it('las filas del cuerpo siguen midiéndose y pintándose en normal', () => {
    const { doc, espia, llamadas } = docEspiado()
    const maqueta = crearMaqueta(espia)
    maqueta.tabla(['A', ETIQUETA], [['x', ETIQUETA]], { anchos: [30, ANCHO_COL] })
    // La MISMA etiqueta en el cuerpo cabe en una línea: en normal mide menos.
    const delCuerpo = llamadas.filter((l) => l.fuente === 'normal' && l.texto.startsWith('l'))
    expect(delCuerpo).toHaveLength(1)
    expect(doc.medirTexto(delCuerpo[0].texto, { tam: TAM.TABLA })).toBeLessThanOrEqual(
      ANCHO_COL - AIRE_COLUMNA,
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// R3 · Una sustitución del pie de página queda enumerada en la nota
// ═════════════════════════════════════════════════════════════════════════════

describe('report/maqueta · R3 · el pie se pre-escanea antes de imprimir la nota', () => {
  const componer = (pie, cuerpo = 'Cuerpo limpio en español, con eñes y acentos: año, medición.') => {
    const doc = crearDocumentoPdf({ anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM })
    const maqueta = crearMaqueta(doc)
    maqueta.renglon(cuerpo)
    const incidencias = bloqueSustituciones(maqueta, doc, pie)
    const total = estamparPies(doc, pie)
    return { doc, incidencias, total, texto: aLatin1(doc.bytes()) }
  }

  it('un carácter fuera de CP1252 en la atribución del pie SÍ queda enumerado en el papel', () => {
    const { doc, incidencias, total, texto } = componer({
      nombre: 'Informe de prueba',
      idDocumento: 'ID-01',
      atribucion: 'Cartografía → Catastro', // U+2192, sin sitio en CP1252
    })
    // El papel declara la sustitución del pie: la nota existe y cita el punto.
    expect(texto).toContain('NOTA DE COMPOSICI')
    expect(texto).toContain('U+2192')
    expect(texto).toContain('pie de p')
    // Y el retorno lo dice también, para el valor `incidencias` del informe.
    expect(incidencias.some((i) => /pie de página/.test(i))).toBe(true)
    // Tras estampar, el dato del documento coincide con lo declarado: el U+2192
    // se sustituyó una vez por página.
    const delPie = doc.sustituciones().filter((s) => s.punto === 0x2192)
    expect(delPie).toHaveLength(total)
  })

  it('la paginación sigue siendo exacta: la nota va ANTES de los pies y todas las páginas llevan «Página N de M»', () => {
    const { doc, total, texto } = componer({
      nombre: 'Informe de prueba',
      idDocumento: 'ID-01',
      atribucion: 'Cartografía → Catastro',
    })
    expect(total).toBe(doc.nPaginas())
    const pies = [...texto.matchAll(/P\xe1gina (\d+) de (\d+)/g)]
    expect(pies.length).toBe(total)
    expect(pies.every((m) => Number(m[2]) === total)).toBe(true)
    expect(pies.map((m) => Number(m[1]))).toEqual(Array.from({ length: total }, (_, i) => i + 1))
  })

  it('con el pie limpio, pasar el pie no cambia NI UN byte respecto a no pasarlo', () => {
    // La garantía de compatibilidad: el pre-escaneo solo se nota cuando hay algo
    // que declarar. El snapshot de los informes reales depende de esto.
    const pie = { nombre: 'Informe de prueba', idDocumento: 'ID-01', atribucion: '© Catastro' }
    const conPie = componer(pie)
    const docSin = crearDocumentoPdf({ anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM })
    const maquetaSin = crearMaqueta(docSin)
    maquetaSin.renglon('Cuerpo limpio en español, con eñes y acentos: año, medición.')
    const sinPie = bloqueSustituciones(maquetaSin, docSin) // forma antigua, sin pie
    estamparPies(docSin, pie)
    expect(sinPie).toEqual([])
    expect(conPie.incidencias).toEqual([])
    expect(Buffer.from(conPie.doc.bytes())).toEqual(Buffer.from(docSin.bytes()))
  })

  it('una sustitución del CUERPO se sigue declarando igual que siempre', () => {
    const { texto, incidencias } = componer(
      { nombre: 'Informe de prueba', idDocumento: 'ID-01', atribucion: '© Catastro' },
      'Cuerpo con flecha ← fuera de CP1252',
    )
    expect(texto).toContain('U+2190')
    expect(incidencias.some((i) => /sustituido/.test(i))).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// R4 · El plano transporta la identidad de su encuadre y se coteja
// ═════════════════════════════════════════════════════════════════════════════

describe('report/maqueta · R4 · un plano de OTRO encuadre con las mismas dimensiones LANZA', () => {
  const RECTANGULO = (dx = 0) => [
    {
      vertices: [
        [439240 + dx, 4479655],
        [439260 + dx, 4479655],
        [439260 + dx, 4479670],
        [439240 + dx, 4479670],
      ],
      tipo: 'EXTERIOR',
    },
  ]

  // Dos encuadres del MISMO papel (180×130 mm a 300 ppp) sobre trabajos
  // distintos: la misma caja de píxeles, otro trozo de mundo.
  const encuadreA = encuadrar({ recintos: RECTANGULO(0), anchoMm: 180, altoMm: 130 })
  const encuadreB = encuadrar({ recintos: RECTANGULO(1000), anchoMm: 180, altoMm: 130 })

  /** Un plano CON identidad, como lo devuelve `report/canvas.js#componerPlano`. */
  const planoDe = (encuadre, cambios = {}) => ({
    anchoPx: encuadre.anchoPx,
    altoPx: encuadre.altoPx,
    bbox: { ...encuadre.bbox },
    escalaExacta: encuadre.escalaExacta,
    ...cambios,
  })

  it('el escenario NO es vacuo: mismas dimensiones en píxeles, otro bbox y la MISMA escala', () => {
    expect(encuadreB.anchoPx).toBe(encuadreA.anchoPx)
    expect(encuadreB.altoPx).toBe(encuadreA.altoPx)
    expect(encuadreB.bbox.minX).not.toBe(encuadreA.bbox.minX)
    // La geometría desplazada mide lo mismo → la escala coincide: la escala NO
    // basta como identidad, y por eso el cotejo es sobre el bbox.
    expect(encuadreB.escalaExacta).toBe(encuadreA.escalaExacta)
  })

  it('la comprobación de aspecto NO lo detecta (el defecto auditado), el cotejo de identidad SÍ', () => {
    const plano = planoDe(encuadreA)
    // Mismo trabajo: pasa.
    expect(() =>
      exigirPlanoEncajable(encuadreA.anchoMm, encuadreA.altoMm, plano, 'prueba', encuadreA),
    ).not.toThrow()
    // Otro trabajo, mismas dimensiones: la relación de aspecto es idéntica y aun
    // así tiene que LANZAR, porque el papel rotularía la escala del encuadre B
    // bajo el mapa del encuadre A.
    expect(() =>
      exigirPlanoEncajable(encuadreB.anchoMm, encuadreB.altoMm, plano, 'prueba', encuadreB),
    ).toThrow(RangeError)
    expect(() =>
      exigirPlanoEncajable(encuadreB.anchoMm, encuadreB.altoMm, plano, 'prueba', encuadreB),
    ).toThrow(/mismo trabajo/)
  })

  it('una escala exacta que no coincide también lanza, aunque el bbox cuadre', () => {
    const doctorado = planoDe(encuadreA, { escalaExacta: encuadreA.escalaExacta * 1.01 })
    expect(() =>
      exigirPlanoEncajable(encuadreA.anchoMm, encuadreA.altoMm, doctorado, 'prueba', encuadreA),
    ).toThrow(RangeError)
  })

  it('el mensaje nombra a quien lanza, como el resto de guardas parametrizadas', () => {
    expect(() =>
      exigirPlanoEncajable(
        encuadreB.anchoMm,
        encuadreB.altoMm,
        planoDe(encuadreA),
        'informePdfEdificio',
        encuadreB,
      ),
    ).toThrow(/^informePdfEdificio:/)
  })

  it('compatibilidad: un plano SIN identidad (llamante que aún no la pasa) no coteja y no lanza', () => {
    const sinIdentidad = { anchoPx: encuadreA.anchoPx, altoPx: encuadreA.altoPx }
    expect(() =>
      exigirPlanoEncajable(encuadreB.anchoMm, encuadreB.altoMm, sinIdentidad, 'prueba', encuadreB),
    ).not.toThrow()
    // Y sin encuadre (llamada con la firma antigua de 4 argumentos) tampoco.
    expect(() =>
      exigirPlanoEncajable(encuadreA.anchoMm, encuadreA.altoMm, planoDe(encuadreA), 'prueba'),
    ).not.toThrow()
  })
})
