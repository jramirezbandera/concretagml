/* -------------------------------------------------------------------------- *
 * test/derivacion/cesion.test.js — F17 · tarea 2.1                             *
 *                                                                              *
 * `derivarCesion` es quien INTERPRETA la resta: qué trozos suelta la parcela,   *
 * cuánto miden, en qué orden se numeran, y si de verdad se ha encogido.         *
 *                                                                              *
 * Lo que este fichero defiende, por orden de importancia:                       *
 *                                                                              *
 *   1. ⛔ **LA PUERTA `P_new ⊆ P_of`, Y QUE NO SE CALCULE CON VÉRTICES.** Se     *
 *      MIDE aquí, no se cita del plan: se importa `@turf/boolean-contains` y se *
 *      comprueba que sobre una parcela CÓNCAVA dice `true` mientras 20 m² están *
 *      por fuera. Si esa medición dejara de valer, este test lo diría.          *
 *   2. ⛔ **QUE EL ORDEN NO DEPENDA DEL ORDEN EN QUE TURF DEVUELVA LAS PIEZAS.** *
 *      El número de orden acaba siendo el `idLocal` de una finca en un fichero  *
 *      que se firma, y si bailara entre corridas **nadie lo vería**. Se dobla   *
 *      el motor para devolver las mismas piezas al revés.                       *
 *   3. Que una astilla se LISTE con sus cifras y no desaparezca, al revés que   *
 *      en F07: aquí no es ruido de un aviso, es un trozo de finca.              *
 *   4. Que `piezas: []` no signifique cuatro cosas: se mira `puedeEntregarse`.  *
 *   5. Los ocho caminos del plan, uno a uno.                                    *
 *                                                                              *
 * Proyecto Vitest `node`.                                                       *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, vi } from 'vitest'
import booleanContains from '@turf/boolean-contains'
import { polygon } from '@turf/helpers'

import { derivarCesion } from '../../derivacion/cesion.js'
import { SEVERIDAD, TIPO_DERIVACION } from '../../derivacion/_comun.js'
import { OPERATIVOS } from '../../config/operativos.js'
import { superficie } from '../../geo/area.js'

// ── Arnés ────────────────────────────────────────────────────────────────────

/** Rectángulo como `recintos` del modelo: anillo ABIERTO, antihorario. */
const rect = (x0, y0, x1, y1) => [
  {
    tipo: 'EXTERIOR',
    vertices: [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
  },
]

/** El mismo rectángulo con un hueco rectangular dentro. */
const conHueco = (ext, hueco) => [
  ext[0],
  { tipo: 'HUECO', vertices: hueco[0].vertices },
]

const tipos = (ds) => ds.map((d) => d.tipo)
const anillo = (a) => [...a, a[0]]

// ── 1 · Los ocho caminos del plan ────────────────────────────────────────────

describe('derivarCesion · los ocho caminos', () => {
  it('1 · SIN geometría oficial no se puede derivar, y se dice', () => {
    // El caso de una parcela dibujada, o venida de DXF/TXT. `piezas: []` aquí NO
    // significa «no hay sobrante»: significa que no hay contra qué restar.
    const c = derivarCesion({ recintos: rect(0, 0, 20, 10) })
    expect(c.piezas).toEqual([])
    expect(tipos(c.detecciones)).toEqual([TIPO_DERIVACION.SIN_GEOMETRIA_OFICIAL])
    expect(c.detecciones[0].severidad).toBe(SEVERIDAD.ERROR)
    expect(c.puedeEntregarse).toBe(false)
    expect(c.bloqueos).toEqual([TIPO_DERIVACION.SIN_GEOMETRIA_OFICIAL])
    // ⛔ Y la puerta se queda en `null`, no en `false`: no se ha podido mirar.
    expect(c.puerta.contenida).toBeNull()
    expect(Number.isNaN(c.areaOficial)).toBe(true)
  })

  it('2 · SIN sobrante: `piezas: []` que sí significa cero, y se puede entregar', () => {
    const misma = rect(0, 0, 20, 10)
    const c = derivarCesion({ recintos: misma, geometriaOficial: misma })
    expect(c.piezas).toEqual([])
    expect(tipos(c.detecciones)).toEqual([TIPO_DERIVACION.SIN_SOBRANTE])
    expect(c.detecciones[0].severidad).toBe(SEVERIDAD.INFO)
    // Un expediente de UNA parcela es legítimo: es una Subsanación.
    expect(c.puedeEntregarse).toBe(true)
    expect(c.puerta.contenida).toBe(true)
  })

  it('3 · UNA pieza, con su área y su grosor medidos por `geo/`', () => {
    const c = derivarCesion({
      recintos: rect(0, 0, 18, 10),
      geometriaOficial: rect(0, 0, 20, 10),
    })
    expect(c.piezas).toHaveLength(1)
    expect(c.piezas[0].orden).toBe(1)
    expect(c.piezas[0].area).toBeCloseTo(20, 9)
    // Franja de 2 × 10: perímetro 24, grosor 2·20/24 = 1,666…
    expect(c.piezas[0].grosor).toBeCloseTo((2 * 20) / 24, 9)
    expect(c.piezas[0].estrecha).toBe(false)
    expect(c.areaTotal).toBeCloseTo(20, 9)
    // El área la mide `geo/area.js`, nunca Turf (regla de oro 5).
    expect(superficie(c.piezas[0].recintos)).toBeCloseTo(c.piezas[0].area, 12)
    expect(c.areaOficial).toBeCloseTo(200, 9)
    expect(c.areaEditada).toBeCloseTo(180, 9)
  })

  it('4 · DOS o más piezas: cada componente conexa es una parcela aparte', () => {
    // Parcela que se encoge por los dos extremos: dos trozos que no se tocan.
    const c = derivarCesion({
      recintos: rect(2, 0, 18, 10),
      geometriaOficial: rect(0, 0, 20, 10),
    })
    expect(c.piezas).toHaveLength(2)
    expect(c.piezas.map((p) => p.orden)).toEqual([1, 2])
    // ⛔ Cada pieza cumple el invariante del modelo: UN exterior. Que sean dos
    // parcelas y no una con dos superficies es la decisión de fondo de la tarea.
    for (const p of c.piezas) {
      expect(p.recintos[0].tipo).toBe('EXTERIOR')
      expect(p.recintos.filter((r) => r.tipo === 'EXTERIOR')).toHaveLength(1)
    }
    expect(c.areaTotal).toBeCloseTo(40, 9)
  })

  it('5 · sobrante CON HUECO dentro: el hueco viaja como `recintos[1]`', () => {
    // Oficial con un patio; la parcela editada se encoge alrededor del patio, así
    // que el sobrante es un anillo CON el patio dentro.
    const oficial = conHueco(rect(0, 0, 40, 40), rect(18, 18, 22, 22))
    const editada = conHueco(rect(5, 5, 35, 35), rect(18, 18, 22, 22))
    const c = derivarCesion({ recintos: editada, geometriaOficial: oficial })
    expect(c.piezas).toHaveLength(1)
    const pieza = c.piezas[0]
    expect(pieza.recintos.length).toBeGreaterThan(1)
    expect(pieza.recintos[0].tipo).toBe('EXTERIOR')
    expect(pieza.recintos.slice(1).every((r) => r.tipo === 'HUECO')).toBe(true)
    // 40² − 30² = 700, y el patio NO se resta dos veces: está dentro de la parcela
    // editada, no del sobrante.
    expect(pieza.area).toBeCloseTo(700, 6)
  })

  it('6 · todas por debajo del umbral: se LISTAN con sus cifras, no se descartan', () => {
    // La parcela se encoge medio milímetro: el sobrante es ruido de captura.
    const c = derivarCesion({
      recintos: rect(0, 0, 19.9995, 10),
      geometriaOficial: rect(0, 0, 20, 10),
    })
    expect(c.piezas).toHaveLength(1)
    expect(c.nEstrechas).toBe(1)
    expect(c.piezas[0].estrecha).toBe(true)
    // ⛔ **Y ADEMÁS no se puede emitir, que es otra cosa.** Los dos bordes de esta
    // franja son `x = 19,9995` y `x = 20`: redondeados a los 2 decimales del fichero
    // caen los DOS en `20,00`, así que la pieza deja de encerrar superficie y
    // `gml/serialize-cp.js` no le encuentra punto de referencia. Este test afirmaba
    // hasta el 2026-08-10 que la única detección era `PIEZA_ESTRECHA`, y con eso el
    // caso real del autor —una astilla de 0,0251 m² del enganche de linderos—
    // tumbaba el expediente ENTERO con el conjunto cerrando. La segunda detección no
    // es ruido: es la que impide ofrecerla como finca.
    expect(c.piezas[0].emitible).toBe(false)
    expect(c.nNoEmitibles).toBe(1)
    expect(tipos(c.detecciones)).toEqual([
      TIPO_DERIVACION.PIEZA_ESTRECHA,
      TIPO_DERIVACION.PIEZA_NO_EMITIBLE,
    ])
    expect(c.detecciones[1].severidad).toBe(SEVERIDAD.AVISO)
    expect(c.detecciones[0].severidad).toBe(SEVERIDAD.AVISO)
    // ⛔ AVISO y no ERROR: una astilla no impide entregar, sólo pide mirarla.
    expect(c.puedeEntregarse).toBe(true)
    // Las cifras van en el mensaje Y sin tocar en `datos` (regla de oro 11).
    expect(c.detecciones[0].mensaje).toMatch(/0,5 mm de ancho/)
    expect(c.detecciones[0].datos.grosor).toBe(c.piezas[0].grosor)
    expect(c.detecciones[0].datos.umbralGrosorM).toBe(OPERATIVOS.grosorInvasionMinimoM)
    // ⛔ Y el área NO se imprime como «0 m²», que es lo que daría con 2 decimales.
    expect(c.detecciones[0].mensaje).toMatch(/0,005 m²/)
  })

  it('⭐ 6b · `emitible` y `estrecha` NO están anidados: hay franjas ANCHAS que no caben', () => {
    // ⛔ **La suposición con la que se escribió este test era falsa, y la refutó
    // medirla el mismo día (2026-08-10).** Se esperaba encontrar el par «estrecha
    // pero emitible» —una franja bajo el umbral de astilla que aun así sobrevive al
    // fichero— para probar que los dos campos no son el mismo con dos nombres. Ese
    // par NO EXISTE para una franja recta, y lo que existe es el contrario, que es
    // peor:
    //
    //   ancho de la franja   estrecha   emitible      (barrido de 0,5 mm a 3 cm
    //     0,5 mm …  7 mm       true      false         sobre rect(0,0,20−w,10))
    //       8 mm … 14 mm       FALSE     false        ← el hueco que nadie vigilaba
    //      15 mm en adelante   false      true
    //
    // El corte de `emitible` está **entre 14 y 15 mm** y no en el umbral de astilla,
    // porque el `cp:referencePoint` también se escribe con 2 decimales: en una
    // franja más fina que eso no queda ni un punto de la retícula ESTRICTAMENTE
    // dentro, y `gml/anillos.js#puntoInterior` los rechaza todos por caer en el
    // borde. Son ~2 × el desplazamiento máximo del redondeo (7,07 mm), o sea media
    // unidad a cada lado.
    //
    // ⭐ Lo que eso significa: entre 8 y 14 mm hay piezas que **no llevaban ni la
    // marca de estrechas** —o sea que ni el usuario ni la nota del bloque decían
    // nada de ellas— y tumbaban el fichero entero igual que la astilla del autor.
    // El campo `emitible` no es un sinónimo caro de `estrecha`: cubre un caso que
    // `estrecha` no veía.
    const ancha = derivarCesion({
      recintos: rect(0, 0, 19.99, 10),
      geometriaOficial: rect(0, 0, 20, 10),
    })
    expect(ancha.piezas[0].grosor).toBeGreaterThan(OPERATIVOS.grosorInvasionMinimoM)
    expect(ancha.piezas[0].estrecha).toBe(false)
    expect(ancha.piezas[0].emitible).toBe(false)
    expect(ancha.nEstrechas).toBe(0)
    expect(ancha.nNoEmitibles).toBe(1)
    expect(tipos(ancha.detecciones)).toEqual([TIPO_DERIVACION.PIEZA_NO_EMITIBLE])

    // Y el control del otro lado del corte: 2 cm de ancho, ni estrecha ni imposible.
    const cabe = derivarCesion({
      recintos: rect(0, 0, 19.98, 10),
      geometriaOficial: rect(0, 0, 20, 10),
    })
    expect(cabe.piezas[0].estrecha).toBe(false)
    expect(cabe.piezas[0].emitible).toBe(true)
    expect(cabe.nNoEmitibles).toBe(0)
    expect(tipos(cabe.detecciones)).toEqual([])
  })

  it('7 · 40 m² y 4 cm² en la misma corrida: el filtro es por GROSOR, no por área', () => {
    // Una franja grande y un cuadradito de 2 × 2 cm. El segundo tiene 400 veces
    // menos área que el umbral de F07 sugeriría, y NO es una astilla: mide 1 cm de
    // grosor, diez veces el umbral. Que no se descarte es el punto del test.
    const oficial = [
      { tipo: 'EXTERIOR', vertices: [[0, 0], [22, 0], [22, 10], [20, 10], [20, 10.02], [19.98, 10.02], [19.98, 10], [0, 10]] },
    ]
    const editada = rect(0, 0, 20, 10)
    const c = derivarCesion({ recintos: editada, geometriaOficial: oficial })
    const areas = c.piezas.map((p) => p.area).sort((a, b) => b - a)
    expect(areas[0]).toBeCloseTo(20, 6)
    expect(areas[1]).toBeCloseTo(0.0004, 9) // 4 cm²
    expect(c.nEstrechas).toBe(0)
    expect(c.piezas.every((p) => p.estrecha === false)).toBe(true)
  })

  it('8 · la parcela CRECE: se dice, se bloquea, y las piezas medidas siguen ahí', () => {
    const c = derivarCesion({
      recintos: rect(0, 0, 22, 10),
      geometriaOficial: rect(0, 0, 20, 10),
    })
    expect(c.puerta.contenida).toBe(false)
    expect(c.puerta.piezas).toHaveLength(1)
    expect(c.puerta.area).toBeCloseTo(20, 9)
    expect(c.puerta.grosorMaximo).toBeCloseTo((2 * 20) / 24, 9)
    expect(c.bloqueos).toEqual([TIPO_DERIVACION.CRECE_FUERA])
    expect(c.puedeEntregarse).toBe(false)
    const crece = c.detecciones.find((d) => d.tipo === TIPO_DERIVACION.CRECE_FUERA)
    expect(crece.severidad).toBe(SEVERIDAD.ERROR)
    expect(crece.mensaje).toMatch(/expediente INCOMPLETO/)
    expect(crece.datos).toMatchObject({ nPiezas: 1 })
  })
})

// ── 2 · ⛔ La puerta, MEDIDA y no citada ─────────────────────────────────────

describe('derivarCesion · la puerta `P_new ⊆ P_of` sobre una parcela CÓNCAVA', () => {
  // Una U: base ancha, dos brazos y una muesca en el centro. Cóncava, como lo es la
  // parcela de referencia de este proyecto (4 vértices reflejos de 11 medidos).
  const U = [[0, 0], [30, 0], [30, 20], [20, 20], [20, 8], [10, 8], [10, 20], [0, 20]]
  // Un cuadrilátero cuyos CUATRO vértices caen dentro de la U y cuyo lado superior
  // cruza la muesca POR EL AIRE.
  const Q = [[5, 10], [25, 10], [25, 4], [5, 4]]

  it('⛔ `@turf/boolean-contains` dice `true` con 20 m² por fuera — MEDIDO', () => {
    // Ésta es la medición que justifica la decisión 1A del plan, y está aquí para
    // que deje de ser una cita: si una versión futura de Turf lo arreglara, este
    // test se pondría rojo y la decisión podría revisarse CON el dato delante.
    // (Leído en `@turf/boolean-contains`: para dos polígonos comprueba que cada
    // VÉRTICE del uno caiga dentro del otro, no los lados.)
    expect(booleanContains(polygon([anillo(U)]), polygon([anillo(Q)]))).toBe(true)
  })

  it('⭐ la resta SÍ lo ve: 20 m² fuera, con su grosor', () => {
    const c = derivarCesion({
      recintos: [{ tipo: 'EXTERIOR', vertices: Q }],
      geometriaOficial: [{ tipo: 'EXTERIOR', vertices: U }],
    })
    expect(c.puerta.contenida).toBe(false)
    expect(c.puerta.area).toBeCloseTo(20, 6) // el trozo de Q que cruza la muesca
    expect(c.puerta.grosorMaximo).toBeGreaterThan(1)
    expect(c.puedeEntregarse).toBe(false)
  })

  it('un desbordamiento POR DEBAJO del umbral no cuenta como crecer', () => {
    // Medio milímetro por fuera es la misma línea escrita dos veces con 1 cm de
    // precisión, no superficie. Mismo criterio que F07 y mismo número.
    const c = derivarCesion({
      recintos: rect(0, 0, 20.0005, 10),
      geometriaOficial: rect(0, 0, 20, 10),
    })
    expect(c.puerta.contenida).toBe(true)
    expect(c.puerta.piezas).toEqual([])
    expect(c.puedeEntregarse).toBe(true)
  })

  it('⛔ si el motor no puede medir la puerta, `contenida` es `null` y NO `false`', async () => {
    // Doblado para que la PRIMERA resta funcione y la segunda —la de la puerta—
    // lance. Afirmar que la parcela crece sin haberlo medido sería exactamente el
    // número plausible y equivocado que esta capa persigue.
    vi.resetModules()
    let llamadas = 0
    const real = (await vi.importActual('@turf/difference')).default
    vi.doMock('@turf/difference', () => ({
      default: (fc) => {
        llamadas += 1
        if (llamadas > 1) throw new Error('Unable to complete output ring')
        return real(fc)
      },
    }))
    const { derivarCesion: derivar } = await import('../../derivacion/cesion.js')

    const c = derivar({ recintos: rect(0, 0, 18, 10), geometriaOficial: rect(0, 0, 20, 10) })
    expect(c.piezas).toHaveLength(1) // el sobrante SÍ se midió, y se conserva
    expect(c.puerta.contenida).toBeNull()
    expect(c.puedeEntregarse).toBe(false)
    expect(c.bloqueos).toEqual([TIPO_DERIVACION.RESTA_FALLIDA])

    vi.doUnmock('@turf/difference')
    vi.resetModules()
  })
})

// ── 3 · ⛔ El orden, que acaba siendo el `idLocal` de una finca ──────────────

describe('derivarCesion · el orden es determinista por construcción', () => {
  it('de NORTE a SUR y luego de OESTE a ESTE', () => {
    // Tres muescas: dos arriba (una a cada lado) y una abajo a la izquierda.
    const oficial = rect(0, 0, 30, 30)
    const editada = [
      {
        tipo: 'EXTERIOR',
        vertices: [
          [0, 0], [30, 0], [30, 25], [25, 25], [25, 30], [20, 30], [20, 25],
          [10, 25], [10, 30], [5, 30], [5, 25], [0, 25],
        ],
      },
    ]
    const c = derivarCesion({ recintos: editada, geometriaOficial: oficial })
    expect(c.piezas.length).toBeGreaterThan(1)
    const cs = c.piezas.map((p) => p.centroide)
    for (let i = 1; i < cs.length; i++) {
      const [xa, ya] = cs[i - 1]
      const [xb, yb] = cs[i]
      expect(ya > yb || (ya === yb && xa <= xb)).toBe(true)
    }
  })

  /**
   * Doble de `@turf/difference` que **distingue las dos restas**, como la de verdad.
   *
   * ⛔ `derivarCesion` llama a `restar` DOS veces con los argumentos cambiados de
   * sitio: el sobrante es `oficial − editada` y la puerta es `editada − oficial`. Un
   * doble que devuelve lo mismo a las dos hace que la puerta afirme que una parcela
   * de 1 m² se sale 200 m², que es aritméticamente imposible — y desde el guardián
   * de `cesion.js` ya no pasa desapercibido, sino que lanza.
   *
   * Estas pruebas van del ORDEN de las piezas y sus afirmaciones no cambian: lo
   * único que se afina es el doble, para que en la dirección de la puerta devuelva
   * lo que Turf devuelve de verdad cuando el minuendo cabe entero dentro del
   * sustraendo, que es `null`.
   *
   * @param {Array} piezas  Las coordenadas del `MultiPolygon` falso del sobrante.
   * @param {number} anchoEditada  Ancho en X de la geometría EDITADA, que es la que
   *   va de minuendo en la puerta y es cómo se reconoce la dirección.
   */
  const dobleDifference = (piezas, anchoEditada) => (coleccion) => {
    const anillo0 = coleccion.features[0].geometry.coordinates[0]
    const xs = anillo0.map(([x]) => x)
    const esLaEditada = Math.max(...xs) - Math.min(...xs) <= anchoEditada
    return esLaEditada ? null : { type: 'MultiPolygon', coordinates: piezas }
  }

  it('⛔ NO depende del orden en que Turf devuelva las piezas', async () => {
    // La prueba que de verdad importa, y la única forma de hacerla es doblar el
    // motor: `restar` devuelve lo que le da `@turf/difference`, y el orden de un
    // `MultiPolygon` es cosa de su barrido. Si el orden lo pusiera Turf, el
    // `idLocal` de una finca bailaría entre corridas **sin que nadie lo viera**.
    const A = anillo([[0, 20], [10, 20], [10, 30], [0, 30]]) // norte-oeste
    const B = anillo([[20, 0], [30, 0], [30, 10], [20, 10]]) // sur-este

    const conOrden = async (anillos) => {
      vi.resetModules()
      vi.doMock('@turf/difference', () => ({
        default: dobleDifference(anillos.map((a) => [a]), 1),
      }))
      const { derivarCesion: derivar } = await import('../../derivacion/cesion.js')
      const c = derivar({ recintos: rect(0, 0, 1, 1), geometriaOficial: rect(0, 0, 30, 30) })
      vi.doUnmock('@turf/difference')
      return c.piezas.map((p) => [p.orden, p.centroide])
    }

    const directo = await conOrden([A, B])
    const alReves = await conOrden([B, A])
    expect(directo).toEqual(alReves)
    // Y el orden es el de la lectura de un mapa: primero el del norte.
    expect(directo[0][1]).toEqual([5, 25])
    vi.resetModules()
  })

  it('⛔ desempata aun con el MISMO centroide y la MISMA área', async () => {
    // El caso que rompe de verdad: un anillo y un disco dentro de su hueco tienen
    // el mismo centroide, son disjuntos, y se les puede dar la misma área. Sin el
    // cuarto criterio —la firma canónica de los vértices— quedarían en el orden en
    // que Turf los devolvió, que es justo lo que no se puede consentir.
    const marco = [
      anillo([[-10, -10], [10, -10], [10, 10], [-10, 10]]),
      anillo([[-6, -6], [-6, 6], [6, 6], [6, -6]]), // hueco: área 400 − 144 = 256
    ]
    const cuadrado = [anillo([[-8, -8], [8, -8], [8, 8], [-8, 8]])] // 16² = 256 también

    const conOrden = async (piezas) => {
      vi.resetModules()
      vi.doMock('@turf/difference', () => ({
        default: dobleDifference(piezas, 1),
      }))
      const { derivarCesion: derivar } = await import('../../derivacion/cesion.js')
      const c = derivar({ recintos: rect(0, 0, 1, 1), geometriaOficial: rect(-20, -20, 20, 20) })
      vi.doUnmock('@turf/difference')
      return c.piezas
    }

    const directo = await conOrden([marco, cuadrado])
    const alReves = await conOrden([cuadrado, marco])

    // ⚠️ Mitad ANTI-VACUIDAD: sin esto el test pasaría aunque los tres primeros
    // criterios estuvieran decidiendo, y no estaríamos probando el cuarto.
    expect(directo[0].centroide).toEqual(directo[1].centroide)
    expect(directo[0].area).toBe(directo[1].area)

    expect(directo.map((p) => p.recintos[0].vertices)).toEqual(
      alReves.map((p) => p.recintos[0].vertices),
    )
    vi.resetModules()
  })

  it('⛔ la firma canónica NO se expone: el sobrante es una FOTO (decisión 3C)', () => {
    // Exponerla invitaría a repegarle el nombre que el usuario puso antes de
    // reeditar, y un nombre en la pieza equivocada es una finca mal nombrada en un
    // papel que se firma.
    const c = derivarCesion({
      recintos: rect(0, 0, 18, 10),
      geometriaOficial: rect(0, 0, 20, 10),
    })
    // `emitible` se añade el 2026-08-10 y es un HECHO MEDIDO de la pieza, como
    // `estrecha`: dice si sobrevive a escribirla con 2 decimales. No reabre lo que
    // este test defiende —la firma sigue sin salir— porque no identifica nada: dos
    // piezas distintas pueden ser las dos emitibles.
    expect(Object.keys(c.piezas[0]).sort()).toEqual([
      'area',
      'centroide',
      'emitible',
      'estrecha',
      'grosor',
      'orden',
      'recintos',
    ])
  })
})

// ── 4 · Contrato y regla de oro 2 ────────────────────────────────────────────

describe('derivarCesion · lo que LANZA es contrato roto, no dato malo', () => {
  it('lanza si no le pasan un objeto de opciones', () => {
    // El error natural: `derivarCesion(parcela.recintos)`. Sin la guarda,
    // `recintos` saldría `undefined` y todo se iría por «no hay geometría oficial»,
    // en verde y culpando al expediente del usuario.
    expect(() => derivarCesion(rect(0, 0, 1, 1))).toThrow(TypeError)
    expect(() => derivarCesion()).toThrow(TypeError)
    expect(() => derivarCesion(null)).toThrow(TypeError)
  })

  it('lanza si `recintos` o `geometriaOficial` no son arrays', () => {
    expect(() => derivarCesion({ recintos: 'nada' })).toThrow(/'recintos'/)
    expect(() =>
      derivarCesion({ recintos: rect(0, 0, 1, 1), geometriaOficial: 'nada' }),
    ).toThrow(/'geometriaOficial'/)
  })

  it('lanza `RangeError` con un umbral que no es un número finito ≥ 0', () => {
    const args = { recintos: rect(0, 0, 1, 1), geometriaOficial: rect(0, 0, 2, 2) }
    expect(() => derivarCesion({ ...args, umbralGrosorM: -1 })).toThrow(RangeError)
    expect(() => derivarCesion({ ...args, umbralGrosorM: NaN })).toThrow(RangeError)
    expect(() => derivarCesion({ ...args, umbralGrosorM: '1' })).toThrow(RangeError)
  })

  it('acepta una `Parcela` del modelo TAL CUAL, sin adaptador', () => {
    const parcela = {
      idLocal: 'p1',
      refcat: '7136910UF1473N',
      recintos: rect(0, 0, 18, 10),
      geometriaOficial: rect(0, 0, 20, 10),
      origen: 'WFS',
    }
    expect(derivarCesion(parcela).piezas).toHaveLength(1)
  })

  it('⛔ no toca la geometría de entrada (regla de oro 2)', () => {
    const oficial = rect(0, 0, 20, 10)
    const editada = rect(0, 0, 18, 10)
    const antes = JSON.stringify([oficial, editada])
    const c = derivarCesion({ recintos: editada, geometriaOficial: oficial })
    expect(JSON.stringify([oficial, editada])).toBe(antes)
    // Y lo que sale no comparte referencias con lo que entró.
    expect(c.piezas[0].recintos[0].vertices).not.toBe(oficial[0].vertices)
  })

  it('el umbral por defecto es el de F07, y se publica para poder auditarlo', () => {
    const c = derivarCesion({
      recintos: rect(0, 0, 18, 10),
      geometriaOficial: rect(0, 0, 20, 10),
    })
    expect(c.umbralGrosorM).toBe(OPERATIVOS.grosorInvasionMinimoM)
    expect(c.resumen.total).toBe(c.detecciones.length)
  })
})
