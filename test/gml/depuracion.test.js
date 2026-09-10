/* -------------------------------------------------------------------------- *
 * test/gml/depuracion.test.js — El vértice que no cabe en el fichero.          *
 *                                                                              *
 * Cubre las dos mitades de un mismo arreglo (2026-09-09), que son opuestas y    *
 * conviene leerlas juntas para que nadie las funda:                             *
 *                                                                              *
 *   1. **La geometría del USUARIO no se toca por debajo del redondeo.** Lo      *
 *      único que se retira es la REPETICIÓN que crea el propio `toFixed(2)`:    *
 *      dos posiciones consecutivas iguales no son un dato, son un               *
 *      `gml:LinearRing` mal formado. Antes se emitían, y el `posList` salía con *
 *      un segmento de longitud cero mientras la detección lo anunciaba sin que  *
 *      nadie lo impidiera.                                                      *
 *   2. **La geometría que CALCULA la aplicación sí se depura**, con             *
 *      `depurarAnillo` y el suelo `SEPARACION_INDISTINGUIBLE_M`, porque ahí no  *
 *      hay levantamiento de nadie que preservar — sólo dónde cortó el motor     *
 *      booleano. El caso que lo hizo necesario vive en                          *
 *      `test/derivacion/recorte-submilimetrico.test.js`.                        *
 *                                                                              *
 * ⚠️ La prueba que separa las dos es «un par a 5 mm que redondea a DOS          *
 * centímetros distintos»: `depurarAnillo` lo colapsa y `prepararRecintos` NO.   *
 * Si algún día alguien mete la depuración dentro del serializador, esa prueba   *
 * es la que lo caza.                                                            *
 *                                                                              *
 * Proyecto Vitest `node`: aritmética pura, sin DOM.                             *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import {
  DECIMALES_COORD,
  SEPARACION_INDISTINGUIBLE_M,
  depurarAnillo,
  depurarRecintos,
  prepararRecintos,
} from '../../gml/anillos.js'
import { TIPO_GML, SEVERIDAD } from '../../gml/_comun.js'
import { serializarParcelaCp } from '../../gml/serialize-cp.js'
import { superficie } from '../../geo/area.js'
import { TIPO_RECINTO } from '../../model/parcela.js'
import { OPERATIVOS } from '../../config/operativos.js'

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

/**
 * Los desplazamientos X respecto al origen local, redondeados al 0,1 mm.
 *
 * ⚠️ Se redondea a propósito: `439050.01 − 439000` no da `50.01` en float64, y
 * comparar el crudo convertiría una prueba sobre la DEPURACIÓN en una prueba
 * sobre el último bit de la resta.
 */
const desplazamientosX = (vertices) => vertices.map(([x]) => Number((x - X0).toFixed(4)))

/** El `posList` del GML como lista de pares numéricos. */
function posListDe(xml) {
  const bruto = /<gml:posList[^>]*>([^<]*)</.exec(xml)
  const numeros = bruto[1].trim().split(/\s+/).map(Number)
  const pares = []
  for (let i = 0; i < numeros.length; i += 2) pares.push([numeros[i], numeros[i + 1]])
  return pares
}

// ── La constante ────────────────────────────────────────────────────────────

describe('gml/anillos · SEPARACION_INDISTINGUIBLE_M', () => {
  it('se DERIVA de DECIMALES_COORD, no es una cifra escrita a mano', () => {
    expect(SEPARACION_INDISTINGUIBLE_M).toBe(0.5 * 10 ** -DECIMALES_COORD * Math.SQRT2)
    // Con D = 2 son 7,0711 mm. Si esto cambiara, es que cambió el formato.
    expect(DECIMALES_COORD).toBe(2)
    expect(SEPARACION_INDISTINGUIBLE_M).toBeCloseTo(0.0070711, 7)
  })

  it('NO es `duplicadoMetros`: son afirmaciones distintas y hoy dan cifras distintas', () => {
    // `duplicadoMetros` (1 mm) habla del MODELO; ésta, del FICHERO. Que coincidan
    // en valor sería la coincidencia sin sentido físico que `config/operativos.js`
    // documenta haber sufrido una vez.
    expect(SEPARACION_INDISTINGUIBLE_M).not.toBe(OPERATIVOS.duplicadoMetros)
    expect(SEPARACION_INDISTINGUIBLE_M).toBeGreaterThan(OPERATIVOS.duplicadoMetros)
  })
})

// ── depurarAnillo ───────────────────────────────────────────────────────────

describe('gml/anillos · depurarAnillo', () => {
  const LIMPIO = [p(0, 0), p(50, 0), p(50, 40), p(0, 40)]

  it('un anillo sin ruido sale igual', () => {
    expect(depurarAnillo(LIMPIO)).toEqual(LIMPIO)
  })

  it('quita el vértice que no se puede separar del anterior', () => {
    const conRuido = [p(0, 0), p(50, 0), p(50.003, 0.002), p(50, 40), p(0, 40)]
    const salida = depurarAnillo(conRuido)
    expect(salida).toHaveLength(4)
    expect(salida).toEqual([p(0, 0), p(50, 0), p(50, 40), p(0, 40)])
  })

  it('quita el ÚLTIMO cuando es el que no se separa del primero: el pivote no se mueve', () => {
    // Es el caso que produce el recorte de un colindante: el motor cierra la
    // pieza a 0,3 mm del vértice con el que empezó.
    const conRuido = [p(0, 0), p(50, 0), p(50, 40), p(0, 40), p(0, 0.0003)]
    const salida = depurarAnillo(conRuido)
    expect(salida[0], 'el primer vértice tiene que seguir siendo el mismo').toEqual(p(0, 0))
    expect(salida).toEqual(LIMPIO)
  })

  it('NO se derrumba en cadena: compara contra el último conservado, no contra el vecino', () => {
    // Cinco vértices a 5 mm cada uno recorren 2 cm en total. Si se comparase
    // contra el vecino inmediato, se irían los cuatro y el lindero se movería
    // 2 cm; comparando contra el conservado, sobreviven los que hacen falta.
    const tira = [p(0, 0), p(50, 0), p(50.005, 0), p(50.01, 0), p(50.015, 0), p(50.02, 0), p(50, 40)]
    const salida = depurarAnillo(tira)
    const xs = desplazamientosX(salida)
    expect(xs).toContain(50)
    expect(xs).toContain(50.01)
    expect(xs).toContain(50.02)
    for (let i = 0; i + 1 < salida.length; i++) {
      const d = Math.hypot(salida[i + 1][0] - salida[i][0], salida[i + 1][1] - salida[i][1])
      expect(d, `par ${i} demasiado junto`).toBeGreaterThanOrEqual(SEPARACION_INDISTINGUIBLE_M)
    }
  })

  it('NO puede crear una degeneración: si dejara menos de 3 vértices, devuelve la entrada', () => {
    // Una astilla entera más fina que la retícula. Quien tiene que decir que no
    // es una parcela es quien la mida, no este paso.
    const astilla = [p(0, 0), p(0.002, 0), p(0.002, 0.002), p(0, 0.002)]
    expect(depurarAnillo(astilla)).toEqual(astilla)
  })

  it('no toca la entrada (regla de oro 2)', () => {
    const entrada = [p(0, 0), p(50, 0), p(50.003, 0.002), p(50, 40), p(0, 40)]
    const copia = entrada.map((v) => [...v])
    depurarAnillo(entrada)
    expect(entrada).toEqual(copia)
  })

  it('lanza con lo que no es un array (contrato del programador)', () => {
    expect(() => depurarAnillo(null)).toThrow(TypeError)
  })

  it('depurarRecintos hace lo mismo con cada anillo, huecos incluidos', () => {
    const recintos = [
      { vertices: [p(0, 0), p(50, 0), p(50.003, 0.002), p(50, 40), p(0, 40)], tipo: TIPO_RECINTO.EXTERIOR },
      { vertices: [p(10, 10), p(20, 10), p(20.002, 10.001), p(20, 20), p(10, 20)], tipo: TIPO_RECINTO.HUECO },
    ]
    const salida = depurarRecintos(recintos)
    expect(salida[0].vertices).toHaveLength(4)
    expect(salida[1].vertices).toHaveLength(4)
    expect(salida[0].tipo).toBe(TIPO_RECINTO.EXTERIOR)
    expect(salida[1].tipo).toBe(TIPO_RECINTO.HUECO)
    expect(recintos[0].vertices, 'la entrada no se toca').toHaveLength(5)
  })
})

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

  it('⛔ NO depura la geometría del usuario: un par a 5 mm que cae en DOS centímetros se conserva', () => {
    // 5 mm está por debajo de SEPARACION_INDISTINGUIBLE_M, así que `depurarAnillo`
    // lo colapsaría. `prepararRecintos` NO: es dato del usuario y los dos puntos
    // se escriben distintos (…50.00 y …50.01). Esta prueba es la que separa las
    // dos mitades del arreglo.
    const anillo = [p(0, 0), p(50.004, 0), p(50.009, 0), p(50, 40), p(0, 40)]
    expect(depurarAnillo(anillo)).toHaveLength(4)

    const { recintos } = prepararRecintos(ext(anillo))
    expect(recintos[0].vertices).toHaveLength(5)
    const xs = desplazamientosX(recintos[0].vertices)
    expect(xs).toContain(50)
    expect(xs).toContain(50.01)
  })
})
