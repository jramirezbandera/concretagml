/* -------------------------------------------------------------------------- *
 * test/gml/depuracion.test.js — El vértice que el redondeo funde y el fichero  *
 * escribía dos veces.                                                          *
 *                                                                              *
 * Hasta el 2026-09-09 `gml/anillos.js` DETECTABA el colapso por redondeo y no   *
 * hacía nada con él, así que el vértice fundido se quedaba en el `posList` y el *
 * GML salía —sin bloqueos— con dos posiciones consecutivas iguales, o sea un    *
 * `gml:LinearRing` mal formado. La detección lo anunciaba palabra por palabra   *
 * («el GML llevaría un segmento de longitud cero») y nadie lo impedía.          *
 *                                                                              *
 * ⛔ **Esto NO es depurar la geometría del usuario**, y la diferencia es exacta: *
 * los dos puntos que se retiran ya son el MISMO NÚMERO tras `toFixed(2)`, así   *
 * que escribirlos las dos veces no añade un dato, añade un segmento de longitud *
 * cero. La depuración de verdad —la de las piezas que CALCULA la aplicación—    *
 * vive en `geo/poligono.js` y se prueba en `test/geo/depuracion.test.js`, que   *
 * además clava que el serializador no la aplica.                                *
 *                                                                              *
 * Proyecto Vitest `node`: aritmética pura, sin DOM.                             *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import { prepararRecintos } from '../../gml/anillos.js'
import { TIPO_GML, SEVERIDAD } from '../../gml/_comun.js'
import { serializarParcelaCp } from '../../gml/serialize-cp.js'
import { superficie } from '../../geo/area.js'
import { TIPO_RECINTO } from '../../model/parcela.js'

// ── Utillaje ────────────────────────────────────────────────────────────────

const X0 = 439000
const Y0 = 4479000
const p = (dx, dy) => [X0 + dx, Y0 + dy]
const ext = (vertices) => [{ vertices, tipo: TIPO_RECINTO.EXTERIOR }]

/** Los pares consecutivos IGUALES de un anillo ya cerrado, sin contar el cierre. */
function repeticionesInternas(posiciones) {
  const repes = []
  for (let i = 0; i + 1 < posiciones.length; i++) {
    const [a, b] = [posiciones[i], posiciones[i + 1]]
    if (a[0] === b[0] && a[1] === b[1]) repes.push(i)
  }
  return repes
}

/** El `posList` del GML como lista de pares numéricos. */
function posListDe(xml) {
  const bruto = /<gml:posList[^>]*>([^<]*)</.exec(xml)
  const numeros = bruto[1].trim().split(/\s+/).map(Number)
  const pares = []
  for (let i = 0; i < numeros.length; i += 2) pares.push([numeros[i], numeros[i + 1]])
  return pares
}

// ── prepararRecintos: la repetición que crea el redondeo ────────────────────

describe('gml/anillos · prepararRecintos no deja posiciones repetidas', () => {
  // Dos vértices a 4 mm: LEGALES para F02 (por encima de `duplicadoMetros`) y
  // fundidos por `toFixed(2)` en el mismo punto. Es el caso medido.
  const CON_COLAPSO = ext([p(0, 0), p(50, 0), p(50.004, 0.001), p(50, 40), p(0, 40)])

  it('el anillo preparado no lleva dos posiciones consecutivas iguales', () => {
    const { recintos } = prepararRecintos(CON_COLAPSO)
    expect(repeticionesInternas(recintos[0].vertices)).toEqual([])
    expect(recintos[0].vertices).toHaveLength(4)
  })

  it('el HECHO se sigue diciendo: la detección de colapso no desaparece', () => {
    const { detecciones } = prepararRecintos(CON_COLAPSO)
    const colapsos = detecciones.filter((d) => d.tipo === TIPO_GML.COLAPSO_POR_REDONDEO)
    expect(colapsos).toHaveLength(1)
    expect(colapsos[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(colapsos[0].mensaje, 'hypot(4 mm, 1 mm) = 4,1 mm').toMatch(/4[.,]1 mm/)
  })

  it('quitar la repetición NO cambia el área: los dos puntos ya eran el mismo número', () => {
    const { recintos, superficieRedondeada } = prepararRecintos(CON_COLAPSO)
    expect(superficie(recintos)).toBeCloseTo(superficieRedondeada, 10)
    expect(superficieRedondeada).toBeCloseTo(2000, 6)
  })

  it('el `posList` emitido no lleva el segmento de longitud cero', () => {
    const { xml, resumen } = serializarParcelaCp({
      recintos: CON_COLAPSO,
      refcat: '18111A00400806',
      idLocal: '18111A00400806',
      srs: 'EPSG:25830',
    })
    expect(resumen.emitido).toBe(true)
    const pares = posListDe(xml)
    expect(repeticionesInternas(pares)).toEqual([])
    // Y sigue cerrando: la última posición repite la primera, que es el paso 4.
    expect(pares.at(-1)).toEqual(pares[0])
  })

  it('un anillo LIMPIO no pierde ningún vértice', () => {
    const limpio = ext([p(0, 0), p(50, 0), p(50, 40), p(0, 40)])
    const { recintos, detecciones } = prepararRecintos(limpio)
    expect(recintos[0].vertices).toHaveLength(4)
    expect(detecciones.filter((d) => d.tipo === TIPO_GML.COLAPSO_POR_REDONDEO)).toEqual([])
  })
})
