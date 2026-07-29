/* -------------------------------------------------------------------------- *
 * test/diagnostico/topologia.test.js — F07 · T2.1 · Solape e invasión         *
 *                                                                             *
 * `diagnostico/topologia.js` es el ÚNICO fichero de F07 que importa Turf, y    *
 * el sitio donde la regla de oro 5 se cumple o se rompe: el área NO la da      *
 * Turf, la da `geo/area.js#superficie` sobre la geometría que la booleana      *
 * devuelve, traducida al modelo con `geo/poligono.js`.                        *
 *                                                                             *
 * Cómo está montado este fichero:                                             *
 *   1. DATOS REALES primero. La parcela del fixture del WFS contra sus        *
 *      colindantes DE VERDAD, parseadas con `gml/parse.js`. Lo que se afirma   *
 *      es el reparto MEDIDO, no el que uno esperaría — y no coincide con lo    *
 *      que suponía el plan de la tarea (ver el bloque «astillas del lindero»). *
 *   2. Casos a mano con el área CALCULADA A MANO, para que un test pueda       *
 *      contradecir al código y no solo repetirlo.                             *
 *   3. Los invariantes que no se rompen con un fallo visible: la geometría     *
 *      oficial intacta (regla de oro 2), el silencio prohibido (regla 1) y     *
 *      que esta capa NO filtra la propia parcela (override O15).              *
 *                                                                             *
 * Proyecto Vitest `node`: aritmética y Turf, sin DOM.                         *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { polygon } from '@turf/helpers'

import { invasiones, solape } from '../../diagnostico/topologia.js'
import { parsearGml } from '../../gml/parse.js'
import { superficie } from '../../geo/area.js'
import { anilloCerrado } from '../../geo/poligono.js'
import { OPERATIVOS } from '../../config/operativos.js'

// ── Utilidades del fichero ───────────────────────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')

/** Recintos de un rectángulo ANTIHORARIO, como los quiere el modelo (ABIERTOS). */
const rect = (x0, y0, x1, y1) => [
  {
    vertices: [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    tipo: 'EXTERIOR',
  },
]

/** Un recinto EXTERIOR con el anillo dado. */
const ext = (vertices) => ({ vertices, tipo: 'EXTERIOR' })

/** Un recinto HUECO con el anillo dado. */
const hueco = (vertices) => ({ vertices, tipo: 'HUECO' })

/** Clon profundo por JSON: sirve porque el modelo es POJO plano (regla de oro 4). */
const clon = (v) => JSON.parse(JSON.stringify(v))

// ── El fixture REAL: la parcela y sus colindantes del WFS ────────────────────
// `GetNeighbourParcel` de verdad, capturado el 2026-07-28
// (`test/fixtures/catastro/PROCEDENCIA.md`). No se toca ni un vértice: lo que se
// mide aquí es la geometría OFICIAL contra la geometría OFICIAL de sus vecinas.

const VECINDAD = readFileSync(
  join(RAIZ, 'test', 'fixtures', 'catastro', 'wfs-neighbour-9398516VK3799G.xml'),
  'utf8',
)

const REF_PROPIA = '9398516VK3799G'

const PARSEADO = parsearGml(VECINDAD)

/** `Vecina` de esta capa a partir de una `ParcelaGml`: la traducción de frontera. */
const comoVecina = (parcela) => ({ refcat: parcela.refcat, recintos: parcela.recintos })

const TODAS = PARSEADO.parcelas.map(comoVecina)
const PROPIA = TODAS.find((v) => v.refcat === REF_PROPIA)
const SOLO_VECINAS = TODAS.filter((v) => v.refcat !== REF_PROPIA)

// Áreas MEDIDAS el 2026-07-29 con este mismo módulo, escritas aquí para que un
// cambio de comportamiento se vea como un rojo y no como un número distinto.
const AREA_PROPIA = 1535.865149996761 // shoelace de `geo/area.js`
const ASTILLA_501 = 0.00012291656283026318 // ≈ 1,23 cm²
const ASTILLA_518 = 0.0003770849824586975 // ≈ 3,77 cm²

describe('diagnostico/topologia.js · el fixture real: cómo VIENE la vecindad (override O15)', () => {
  it('el WFS devuelve 5 parcelas y la PROPIA va en 2.ª posición', () => {
    // Override O15, MEDIDO el 2026-07-28: `GetNeighbourParcel` incluye a la propia
    // parcela. Si esto cambiara, todos los tests de abajo estarían midiendo otra
    // cosa, así que se afirma antes de usar el fixture para nada más.
    expect(PARSEADO.dialecto).toBe('CP_4_0_WFS')
    expect(PARSEADO.parcelas).toHaveLength(5)
    expect(PARSEADO.parcelas.map((p) => p.refcat)).toEqual([
      '9398501VK3799G',
      REF_PROPIA, // ← 2.ª posición
      '9398518VK3799G',
      '9398517VK3799G',
      '9398515VK3799G',
    ])
  })

  it('las cinco traen UN solo recinto (ningún patio) y su superficie shoelace', () => {
    expect(PARSEADO.parcelas.map((p) => p.recintos.length)).toEqual([1, 1, 1, 1, 1])
    expect(superficie(PROPIA.recintos)).toBeCloseTo(AREA_PROPIA, 9)
    // La declarada en el fichero es ENTERA (override O6): 1536 frente a 1535,865.
    expect(PARSEADO.parcelas[1].areaValue).toBe(1536)
  })
})

describe('diagnostico/topologia.js · invasiones() sobre la vecindad REAL', () => {
  const medido = invasiones(PROPIA.recintos, SOLO_VECINAS)

  it('las cuatro colindantes se reparten en DOS que comparten superficie y DOS que no', () => {
    // 9398517VK3799G y 9398515VK3799G no dan intersección (`intersect` → null): no
    // aparecen en NINGUNA de las dos listas, porque compartir lindero no es un
    // hallazgo — es el caso normal entre colindantes.
    const nombradas = [...medido.invasiones, ...medido.descartadas].map((h) => h.refcat)
    expect(nombradas.sort()).toEqual(['9398501VK3799G', '9398518VK3799G'])
    expect(medido.saltados).toEqual([])
  })

  it('🔻 la parcela oficial NO invade a ninguna de sus colindantes oficiales', () => {
    // ÉSTE ES EL TEST QUE JUSTIFICA EL FILTRO DE GROSOR, y su historia importa
    // porque estuvo en rojo lógico durante media hora del 2026-07-29.
    //
    // Con el `areaInvasionMinimaM2` (10⁻⁴ m² = 1 cm²) con el que nació la fase, las
    // dos astillas del lindero compartido —1,23 cm² y 3,77 cm² MEDIDOS sobre este
    // fixture, sin editar un solo vértice— SUPERABAN el umbral y salían como
    // INVASIÓN. La app habría dicho que la parcela oficial del Catastro invade a dos
    // de sus cuatro colindantes oficiales: el falso positivo exacto que la clave
    // existía para evitar, y en el ÚNICO punto donde la regla de oro 9 admite ámbar.
    //
    // La causa era la calibración: aquella cifra suponía la astilla CUADRADA (el
    // paso de cuantización al cuadrado) y la astilla es una AGUJA, de área ≈ ½·L·δ
    // — que crece con la LONGITUD del lindero compartido, así que NINGÚN umbral de
    // área sirve para todos los linderos. El filtro pasó a ser de GROSOR, que no
    // depende de L. Ver el JSDoc de `config/operativos.js#grosorInvasionMinimoM`.
    expect(medido.invasiones).toEqual([])
    expect(medido.descartadas).toHaveLength(2)
  })

  it('…y las dos astillas salen en `descartadas`, con su área y su grosor (regla de oro 1)', () => {
    // No desaparecen: quien desconfíe del umbral tiene las dos cifras para
    // comprobarlo él mismo, que es la diferencia entre filtrar y ocultar.
    const [d501, d518] = medido.descartadas

    expect(d501.refcat).toBe('9398501VK3799G')
    expect(d501.area).toBeCloseTo(ASTILLA_501, 9)
    expect(d501.nPiezas).toBe(1)
    expect(d518.refcat).toBe('9398518VK3799G')
    expect(d518.area).toBeCloseTo(ASTILLA_518, 9)

    // El grosor es LA cifra del hallazgo: décimas de milímetro. Y la separación con
    // el umbral (1 mm) no está apretada por ningún lado — es lo que hace que este
    // filtro no sea un ajuste fino sino una distinción de naturaleza.
    for (const d of medido.descartadas) {
      expect(d.grosor).toBeLessThan(OPERATIVOS.grosorInvasionMinimoM)
      expect(d.grosor).toBeLessThan(2e-4) // < 0,2 mm, medido
      expect(d.grosor).toBeGreaterThan(0)
    }
  })

  it('cada astilla es UNA pieza, y su forma delata que es una aguja de tres puntos', () => {
    // Se remide la geometría por la vía del `solape`, porque `descartadas` ya no
    // lleva las piezas: son las que NO cuentan, y devolver su geometría invitaría a
    // dibujarlas.
    const vecina501 = TODAS.find((v) => v.refcat === '9398501VK3799G')
    const s = solape(PROPIA.recintos, vecina501.recintos)

    expect(s.nPiezas).toBe(1)
    expect(s.piezas[0]).toHaveLength(1) // un solo recinto: sin huecos
    expect(s.piezas[0][0].tipo).toBe('EXTERIOR')
    // Tres vértices casi colineales: la vecina subdivide el lindero con un vértice
    // que la propia no tiene, y redondeado a la rejilla de 1 cm cae al otro lado.
    expect(s.piezas[0][0].vertices).toHaveLength(3)
    expect(superficie(s.piezas[0])).toBeCloseTo(ASTILLA_501, 9)
  })

  it('las salidas no llevan veredicto: solo refcat, área y geometría', () => {
    // Criterio de aceptación 4 del feature (regla de oro 9): ninguna cifra lleva
    // juicio y no hay campo de «apta/no apta». Se afirma sobre las CLAVES, que es
    // lo que un día alguien ampliaría con un `nivel: 'AMBAR'` sin darse cuenta.
    for (const h of medido.invasiones) {
      expect(Object.keys(h).sort()).toEqual(['area', 'piezas', 'refcat'])
    }
    for (const d of medido.descartadas) {
      expect(Object.keys(d).sort()).toEqual(['area', 'grosor', 'nPiezas', 'refcat'])
    }
    expect(Object.keys(medido).sort()).toEqual(['descartadas', 'invasiones', 'saltados'])
  })

  it('solape() con las dos colindantes que NO tocan da 0, sin piezas', () => {
    for (const refcat of ['9398517VK3799G', '9398515VK3799G']) {
      const vecina = TODAS.find((v) => v.refcat === refcat)
      const s = solape(PROPIA.recintos, vecina.recintos)
      expect(s).toEqual({ area: 0, piezas: [], nPiezas: 0, saltados: [] })
    }
  })

  it('solape() de la propia contra sí misma devuelve su superficie ENTERA', () => {
    const s = solape(PROPIA.recintos, PROPIA.recintos)
    expect(s.nPiezas).toBe(1)
    // El shoelace de la salida de la booleana coincide con el de la entrada hasta
    // el ruido de float64 de la propia booleana (~10⁻¹² sobre 1.535 m²).
    expect(s.area).toBeCloseTo(AREA_PROPIA, 9)
  })
})

describe('diagnostico/topologia.js · O15: esta capa NO filtra la propia parcela', () => {
  it('con la lista TAL COMO LLEGA del WFS, la parcela se «invade a sí misma» al 100 %', () => {
    // Éste NO es un bug del módulo: es el comportamiento fijado a propósito.
    // `GetNeighbourParcel` devuelve la propia parcela en 2.ª posición (override
    // O15), y quien construya las `Vecina[]` sin quitarla obtendrá esto. Se
    // documenta con un test para que, si el cableado de F07 (T4.3) se olvida del
    // filtro, el rojo caiga ALLÍ y con un síntoma reconocible, en vez de que el
    // diagnóstico afirme una invasión del 100 % con toda naturalidad.
    //
    // Aquí no se filtra porque esta capa recibe `recintos` —geometría SIN nombre,
    // para poder diagnosticar también un GML que el usuario suelte encima (F08)— y
    // no puede saber cuál de las vecinas es «ella misma» sin inventar una
    // heurística que el llamante no necesita: él tiene la referencia catastral.
    const conLaPropia = invasiones(PROPIA.recintos, TODAS)

    const propiaComoInvasora = conLaPropia.invasiones.find((h) => h.refcat === REF_PROPIA)
    expect(propiaComoInvasora).toBeDefined()
    expect(propiaComoInvasora.area).toBeCloseTo(AREA_PROPIA, 9)
    // El 100 % de su propia superficie, que es la firma inconfundible del olvido.
    expect(propiaComoInvasora.area / superficie(PROPIA.recintos)).toBeCloseTo(1, 12)

    // Y las otras cuatro salen igual que sin ella: la entrada de más no altera nada.
    // La propia es la ÚNICA invasión, porque las dos astillas de los linderos
    // compartidos las descarta el filtro de grosor — o sea que el síntoma del olvido
    // es limpio y de lectura inmediata: una invasión, del 100 %, con su propia
    // referencia catastral al lado.
    expect(conLaPropia.invasiones.map((h) => h.refcat)).toEqual([REF_PROPIA])
    expect(conLaPropia.descartadas.map((d) => d.refcat)).toEqual([
      '9398501VK3799G',
      '9398518VK3799G',
    ])
  })
})

describe('diagnostico/topologia.js · solape(): casos a mano, área calculada a mano', () => {
  it('solape PARCIAL de dos cuadrados: 10×10 y 10×10 desplazados 5 ⇒ 5×5 = 25 m²', () => {
    const s = solape(rect(0, 0, 10, 10), rect(5, 5, 15, 15))
    expect(s.area).toBeCloseTo(25, 10)
    expect(s.nPiezas).toBe(1)
    expect(s.piezas[0][0].tipo).toBe('EXTERIOR')
    // La pieza ES el cuadrado 5..10 × 5..10, con sus cuatro vértices y ABIERTA.
    expect(s.piezas[0][0].vertices).toHaveLength(4)
    expect(superficie(s.piezas[0])).toBeCloseTo(25, 10)
  })

  it('es SIMÉTRICO: solape(a, b) mide lo mismo que solape(b, a)', () => {
    const ab = solape(rect(0, 0, 10, 10), rect(5, 5, 15, 15))
    const ba = solape(rect(5, 5, 15, 15), rect(0, 0, 10, 10))
    expect(ba.area).toBeCloseTo(ab.area, 10)
    expect(ba.nPiezas).toBe(ab.nPiezas)
  })

  it('CONTENCIÓN total: el pequeño dentro del grande ⇒ el área del pequeño (36 m²)', () => {
    const s = solape(rect(0, 0, 10, 10), rect(2, 2, 8, 8))
    expect(s.area).toBeCloseTo(36, 10) // 6 × 6
    expect(s.nPiezas).toBe(1)
    // Y al revés, que es el caso «la parcela medida cabe entera en la catastral».
    expect(solape(rect(2, 2, 8, 8), rect(0, 0, 10, 10)).area).toBeCloseTo(36, 10)
  })

  it('DISJUNTAS: sin superficie común ⇒ 0 y ninguna pieza', () => {
    const s = solape(rect(0, 0, 10, 10), rect(20, 0, 30, 10))
    expect(s).toEqual({ area: 0, piezas: [], nPiezas: 0, saltados: [] })
  })

  it('MEDIDO: el CONTACTO POR EL BORDE no es solape — `intersect` devuelve null', () => {
    // `validation/reglas-topologia.js` lo afirmaba («tocarse en un borde da null»);
    // aquí se verifica en las cuatro formas de tocarse sin compartir superficie,
    // porque es EL caso normal entre dos colindantes y un falso positivo aquí
    // convertiría cada lindero del parcelario en una invasión.
    const cuadrado = rect(0, 0, 10, 10)
    const casos = {
      'lindero ENTERO compartido': rect(10, 0, 20, 10),
      'lindero PARCIAL compartido': rect(10, 2, 20, 8),
      'una sola ESQUINA': rect(10, 10, 20, 20),
    }
    for (const [nombre, otra] of Object.entries(casos)) {
      const s = solape(cuadrado, otra)
      expect(s, nombre).toEqual({ area: 0, piezas: [], nPiezas: 0, saltados: [] })
    }
  })

  it('MULTIPOLYGON, que es el caso NORMAL: un peine cruzado por una banda ⇒ 2 piezas', () => {
    // Peine de dos dientes: el hueco entre ellos (x ∈ [2,4]) parte en dos la banda
    // horizontal y = [4,6]. A mano: 2×2 + 2×2 = 8 m², en DOS piezas disjuntas.
    const peine = [
      ext([
        [0, 0],
        [2, 0],
        [2, 10],
        [4, 10],
        [4, 0],
        [6, 0],
        [6, 20],
        [0, 20],
      ]),
    ]
    const banda = rect(-1, 4, 7, 6)
    const s = solape(peine, banda)
    expect(s.nPiezas).toBe(2)
    expect(s.piezas).toHaveLength(2)
    expect(s.area).toBeCloseTo(8, 10)
    // Y las piezas se miden UNA A UNA: 4 m² cada una. Quedarse con la mayor daría
    // 4 —la mitad del solape real— con toda naturalidad.
    expect(s.piezas.map((p) => superficie(p))).toEqual([4, 4])
  })
})

describe('diagnostico/topologia.js · huecos: la región es EXTERIOR MENOS HUECO', () => {
  // Parcela con patio: 20×20 con un patio de 10×10 centrado ⇒ 400 − 100 = 300 m².
  const conPatio = [
    ext([
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
    ]),
    hueco([
      [5, 5],
      [15, 5],
      [15, 15],
      [5, 15],
    ]),
  ]

  it('el patio NO cuenta como superficie de la parcela', () => {
    expect(superficie(conPatio)).toBe(300)
    // La mitad inferior (y ≤ 10) del solar son 20×10 = 200 m², de los que el patio
    // ocupa 10×5 = 50 ⇒ el solape es 150 m². Con el patio ignorado saldrían 200.
    const s = solape(conPatio, rect(0, 0, 20, 10))
    expect(s.area).toBeCloseTo(150, 10)
    expect(s.nPiezas).toBe(1)
  })

  it('un polígono ENTERAMENTE dentro del patio no solapa NADA', () => {
    const s = solape(conPatio, rect(7, 7, 13, 13))
    expect(s).toEqual({ area: 0, piezas: [], nPiezas: 0, saltados: [] })
  })

  it('el solape puede SALIR con hueco, y `superficie` lo resta', () => {
    // La parcela con patio contra su propio solar completo: sale ella misma, y la
    // pieza trae DOS recintos (EXTERIOR + HUECO) porque el patio no toca el corte.
    const s = solape(conPatio, rect(0, 0, 20, 20))
    expect(s.nPiezas).toBe(1)
    expect(s.piezas[0]).toHaveLength(2)
    expect(s.piezas[0].map((r) => r.tipo)).toEqual(['EXTERIOR', 'HUECO'])
    expect(s.area).toBeCloseTo(300, 10)
  })

  it('MEDIDO: el sentido de giro de los anillos NO altera el resultado', () => {
    // Importa porque el WFS emite el exterior HORARIO (override O1) y aquí no se
    // reorienta nada, coherente con `geo/poligono.js`. Mismo solar y mismo patio,
    // los dos anillos al revés: mismos 150 m².
    const alReves = [
      ext([
        [0, 0],
        [0, 20],
        [20, 20],
        [20, 0],
      ]),
      hueco([
        [5, 5],
        [5, 15],
        [15, 15],
        [15, 5],
      ]),
    ]
    expect(solape(alReves, rect(0, 0, 20, 10)).area).toBeCloseTo(150, 10)
  })
})

describe('diagnostico/topologia.js · invasiones(): la astilla y el grosor mínimo', () => {
  /**
   * Franja de solape a mano: la vecina baja `fondoM` dentro de la propia (de 100 m
   * de ancho), así que la pieza es un rectángulo de 100 × `fondoM`. Su grosor
   * estimado (`2A/P`) es ≈ `fondoM/2` para fondos pequeños.
   */
  const franja = (refcat, fondoM) => ({ refcat, recintos: rect(0, 100 - fondoM, 100, 200) })
  const PROPIA_100 = () => rect(0, 0, 100, 100)

  it('por DEBAJO de `grosorInvasionMinimoM` va a `descartadas`, con área Y grosor', () => {
    // Una franja de 0,1 mm de fondo sobre un lindero de 100 m: el caso real, con la
    // longitud llevada al extremo. Su ÁREA es 0,01 m² = 100 cm², CIEN VECES el
    // umbral de área que se descartó — y aun así no es una invasión, porque la
    // superficie es un artefacto del redondeo. Es exactamente la razón de ser del
    // filtro de grosor, y este test la demuestra con números.
    const r = invasiones(PROPIA_100(), [franja('ASTILLA000000A', 1e-4)])

    expect(r.invasiones).toEqual([])
    expect(r.descartadas).toHaveLength(1)
    expect(r.descartadas[0].refcat).toBe('ASTILLA000000A')
    expect(r.descartadas[0].area).toBeCloseTo(0.01, 9) // 100 cm² de «invasión»
    expect(r.descartadas[0].grosor).toBeLessThan(OPERATIVOS.grosorInvasionMinimoM)
    expect(r.descartadas[0].nPiezas).toBe(1)
    expect(Object.keys(r.descartadas[0]).sort()).toEqual(['area', 'grosor', 'nPiezas', 'refcat'])
  })

  it('el ÁREA ya no decide: la misma área pasa o no pasa según su forma', () => {
    // Las dos piezas miden 0,01 m². La franja de 100 m × 0,1 mm es redondeo; el
    // cuadrado de 10 × 10 cm es una esquina invadida de verdad. Un umbral de área no
    // podía distinguirlas —era el fallo— y el de grosor las separa por tres órdenes
    // de magnitud.
    const comoFranja = invasiones(PROPIA_100(), [franja('ASTILLA000000A', 1e-4)])
    const comoCuadrado = invasiones(PROPIA_100(), [
      { refcat: 'ESQUINA00000A', recintos: rect(99.9, 99.9, 110, 110) },
    ])

    expect(comoFranja.descartadas[0].area).toBeCloseTo(comoCuadrado.invasiones[0].area, 9)
    expect(comoFranja.invasiones).toEqual([])
    expect(comoCuadrado.descartadas).toEqual([])
    expect(comoCuadrado.invasiones[0].area).toBeCloseTo(0.01, 9)
  })

  it('el grosor NO depende de la longitud del lindero, que era el fallo del umbral de área', () => {
    // La misma franja de 0,1 mm de fondo sobre linderos de 1 m y de 100 m: el área
    // se multiplica por cien y el grosor se queda igual. Ésa es la propiedad por la
    // que este filtro sirve para todos los linderos y el de área no servía para
    // ninguno.
    const corta = invasiones(rect(0, 0, 1, 100), [
      { refcat: 'CORTA000000A', recintos: rect(0, 100 - 1e-4, 1, 200) },
    ])
    const larga = invasiones(PROPIA_100(), [franja('LARGA000000A', 1e-4)])

    // El área se multiplica por CIEN…
    expect(larga.descartadas[0].area / corta.descartadas[0].area).toBeCloseTo(100, 3)

    // …y el grosor se queda igual, con una diferencia RELATIVA por debajo del 0,1 %.
    // No es exactamente igual, y la razón está en la estimación (ver
    // `medirPieza`): `2A/P` con `P = 2L + 2h` da `h/2 · 1/(1 + h/L)`, así que
    // depende de `L` a través de `h/L` — 10⁻⁴ en la franja corta y 10⁻⁶ en la
    // larga. Es un residuo de cuarto orden, cinco órdenes de magnitud por debajo
    // del factor 100 que se lleva el área: comparar en relativo es lo que dice la
    // verdad aquí, y una tolerancia absoluta apretada solo estaría fingiendo una
    // independencia exacta que la fórmula no tiene.
    const relativa =
      Math.abs(larga.descartadas[0].grosor - corta.descartadas[0].grosor) /
      corta.descartadas[0].grosor
    expect(relativa).toBeLessThan(1e-3)

    expect(larga.invasiones).toEqual([])
    expect(corta.invasiones).toEqual([])
  })

  it('por ENCIMA del grosor mínimo va a `invasiones`, con sus piezas', () => {
    // El otro lado de la frontera, para que el filtro no pueda estar al revés: una
    // franja de 5 cm de fondo, que es una invasión que un técnico mediría con cinta.
    const r = invasiones(PROPIA_100(), [franja('FRANJA000000A', 0.05)])

    expect(r.descartadas).toEqual([])
    expect(r.invasiones).toHaveLength(1)
    expect(r.invasiones[0].area).toBeCloseTo(5, 6) // 100 m × 0,05 m
    expect(r.invasiones[0].piezas).toHaveLength(1)
  })

  it('una MISMA vecina puede salir en las dos listas: invasión en un tramo, astilla en otro', () => {
    // El caso que obligó a filtrar por PIEZA y no por vecina. Sumando primero y
    // filtrando después, la astilla se habría colado dentro del área del hallazgo
    // real, inflándolo con superficie que no existe sobre el terreno.
    const propia = rect(0, 0, 100, 100)
    const vecina = {
      refcat: 'MIXTA0000000A',
      recintos: [
        {
          // Franja de redondeo (0,1 mm) a lo largo de todo el lindero norte, MÁS un
          // diente de 2 m × 0,5 m que entra de verdad.
          vertices: [
            [0, 100 - 1e-4],
            [100, 100 - 1e-4],
            [100, 200],
            [0, 200],
          ],
          tipo: 'EXTERIOR',
        },
      ],
    }
    const diente = { refcat: 'MIXTA0000000A', recintos: rect(10, 99.5, 12, 105) }
    const r = invasiones(propia, [vecina, diente])

    // Como entradas separadas se ve la clasificación de cada forma; la franja va a
    // descartadas y el diente a invasiones, con la MISMA referencia catastral.
    expect(r.descartadas.map((d) => d.refcat)).toEqual(['MIXTA0000000A'])
    expect(r.invasiones.map((h) => h.refcat)).toEqual(['MIXTA0000000A'])
    expect(r.invasiones[0].area).toBeCloseTo(1, 6) // 2 m × 0,5 m
  })

  it('una vecina que solo comparte lindero no entra en NINGUNA de las dos listas', () => {
    const r = invasiones(rect(0, 0, 10, 10), [
      { refcat: 'PEGADA000000A', recintos: rect(10, 0, 20, 10) },
      { refcat: 'LEJANA000000A', recintos: rect(40, 40, 50, 50) },
    ])
    expect(r).toEqual({ invasiones: [], descartadas: [], saltados: [] })
  })

  it('`refcat: null` (no consta) no revienta y llega TAL CUAL al hallazgo', () => {
    // `null` no es cadena vacía y no se convierte en una: quien presente dirá
    // «parcela sin referencia», y eso solo puede hacerlo si el dato llega intacto.
    const r = invasiones(rect(0, 0, 10, 10), [{ refcat: null, recintos: rect(5, 5, 15, 15) }])
    expect(r.invasiones).toHaveLength(1)
    expect(r.invasiones[0].refcat).toBeNull()
    expect(r.invasiones[0].area).toBeCloseTo(25, 10)
  })

  it('varias vecinas: se devuelven en el ORDEN de entrada, no por área', () => {
    // Ordenar es de quien presenta. Aquí el orden de `vecinas` es el del WFS, y
    // reordenar por área haría imposible casar el hallazgo con la fila de origen.
    const r = invasiones(rect(0, 0, 10, 10), [
      { refcat: 'PEQUENA00000A', recintos: rect(9, 9, 19, 19) }, // 1 m²
      { refcat: 'GRANDE000000A', recintos: rect(5, 0, 15, 10) }, // 50 m²
    ])
    expect(r.invasiones.map((h) => h.refcat)).toEqual(['PEQUENA00000A', 'GRANDE000000A'])
    expect(r.invasiones.map((h) => h.area)).toEqual([1, 50])
  })

  it('la parcela invadida en VARIOS trozos: `piezas` los trae todos', () => {
    // Una invasión en tres trozos no es lo mismo que en uno: son tres puntos de
    // conflicto sobre el terreno, y el área sola no lo dice.
    const peine = [
      ext([
        [0, 0],
        [2, 0],
        [2, 10],
        [4, 10],
        [4, 0],
        [6, 0],
        [6, 20],
        [0, 20],
      ]),
    ]
    const r = invasiones(peine, [{ refcat: 'BANDA0000000A', recintos: rect(-1, 4, 7, 6) }])
    expect(r.invasiones).toHaveLength(1)
    expect(r.invasiones[0].piezas).toHaveLength(2)
    expect(r.invasiones[0].area).toBeCloseTo(8, 10)
  })
})

describe('diagnostico/topologia.js · regla de oro 2: nada de lo que entra se toca', () => {
  it('solape() no muta `recintosA` ni `recintosB`', () => {
    // MEDIDO en la fase 1: `polygon()` de Turf guarda el array de coordenadas POR
    // REFERENCIA. Si los vértices se le pasaran sin copia, Turf tendría una
    // referencia VIVA a `geometriaOficial`, que es el término de comparación de
    // todo el diagnóstico. No ocurre porque los anillos se cierran con
    // `anilloCerrado`, que copia SIEMPRE.
    const a = rect(0, 0, 10, 10)
    const b = [...rect(0, 0, 20, 20), hueco([[5, 5], [15, 5], [15, 15], [5, 15]])]
    const antesA = clon(a)
    const antesB = clon(b)
    solape(a, b)
    expect(a).toEqual(antesA)
    expect(b).toEqual(antesB)
  })

  it('invasiones() no muta ni `recintos` ni `vecinas`', () => {
    const propia = rect(0, 0, 10, 10)
    const vecinas = [
      { refcat: 'UNA000000000A', recintos: rect(5, 5, 15, 15) },
      { refcat: null, recintos: rect(-5, -5, 1, 1) },
    ]
    const antesPropia = clon(propia)
    const antesVecinas = clon(vecinas)
    invasiones(propia, vecinas)
    expect(propia).toEqual(antesPropia)
    expect(vecinas).toEqual(antesVecinas)
  })

  it('la geometría OFICIAL del fixture sigue intacta después de medirla entera', () => {
    // El caso de verdad: el fixture real, el mismo objeto que usan todos los tests
    // de arriba. Si algo lo hubiera mutado, este test lo delata al final.
    const antes = clon(PARSEADO.parcelas.map((p) => p.recintos))
    solape(PROPIA.recintos, TODAS[0].recintos)
    invasiones(PROPIA.recintos, TODAS)
    expect(PARSEADO.parcelas.map((p) => p.recintos)).toEqual(antes)
  })

  it('las piezas devueltas son geometría NUEVA: tocarlas no toca la entrada', () => {
    const a = rect(0, 0, 10, 10)
    const s = solape(a, rect(5, 5, 15, 15))
    s.piezas[0][0].vertices[0][0] = 999
    expect(a[0].vertices[0]).toEqual([0, 0])
  })

  it('el PELIGRO, medido: `polygon()` guarda el array por REFERENCIA', () => {
    // No se puede observar desde fuera del módulo con qué array se llamó a Turf, así
    // que lo que se fija aquí es la PREMISA: el peligro existe y la copia lo corta.
    // Si algún día `anilloCerrado` dejara de copiar, este test se pone rojo aquí
    // —donde está explicado— en vez de convertirse en un `geometriaOficial` mutado
    // tres capas más arriba. El guardián de abajo comprueba que este módulo cierra
    // sus anillos con esa función y no a mano.
    const anillo = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ]
    expect(polygon([anillo]).geometry.coordinates[0]).toBe(anillo) // ⚠️ por REFERENCIA
    const copia = anilloCerrado(anillo)
    expect(polygon([copia]).geometry.coordinates[0]).not.toBe(anillo)
    expect(copia[0]).not.toBe(anillo[0]) // ni se comparten los pares [x,y]
  })
})

describe('diagnostico/topologia.js · regla de oro 1: nada se salta en silencio', () => {
  it('un EXTERIOR de menos de 3 vértices no se mide, y `saltados` dice por qué', () => {
    // `polygon()` de Turf rechazaría el anillo (menos de 4 posiciones cerradas), y
    // el recinto se guarda por CONTEO estructural, sin `try/catch`, igual que en
    // `validation/reglas-topologia.js`. Pero devolver 0 a secas sería afirmar «no
    // se solapan» cuando lo cierto es «no se ha podido medir», y 0 tranquiliza.
    const s = solape([ext([[0, 0], [1, 1]])], rect(0, 0, 10, 10))
    expect(s.area).toBe(0)
    expect(s.piezas).toEqual([])
    expect(s.saltados).toEqual([
      { donde: 'recintosA', indice: 0, nVertices: 2, motivo: 'EXTERIOR_NO_APTO' },
    ])
  })

  it('una lista de recintos VACÍA sale como `SIN_RECINTOS`', () => {
    const s = solape([], rect(0, 0, 10, 10))
    expect(s.saltados).toEqual([
      { donde: 'recintosA', indice: null, nVertices: 0, motivo: 'SIN_RECINTOS' },
    ])
    // Y nombra el argumento correcto: si el degenerado es el SEGUNDO, lo dice.
    expect(solape(rect(0, 0, 10, 10), []).saltados[0].donde).toBe('recintosB')
  })

  it('un HUECO degenerado se salta y el área sale por EXCESO — dicho, no supuesto', () => {
    // El solar entero contra sí mismo son 400 m²; con el patio de 100 el solape
    // serían 300. El patio degenerado no se puede restar, así que salen 400: la
    // cifra está inflada en la superficie del hueco, y `saltados` lo declara.
    const patioRoto = [ext([[0, 0], [20, 0], [20, 20], [0, 20]]), hueco([[5, 5], [15, 15]])]
    const s = solape(patioRoto, rect(0, 0, 20, 20))
    expect(s.area).toBeCloseTo(400, 9)
    expect(s.saltados).toEqual([
      { donde: 'recintosA', indice: 1, nVertices: 2, motivo: 'HUECO_NO_APTO' },
    ])
  })

  it('invasiones(): el recinto saltado se sitúa con el índice de SU vecina', () => {
    const r = invasiones(rect(0, 0, 10, 10), [
      { refcat: 'BUENA0000000A', recintos: rect(5, 5, 15, 15) },
      { refcat: 'ROTA00000000A', recintos: [ext([[0, 0]])] },
    ])
    expect(r.invasiones.map((h) => h.refcat)).toEqual(['BUENA0000000A'])
    expect(r.saltados).toEqual([
      { donde: 'vecinas[1].recintos', indice: 0, nVertices: 1, motivo: 'EXTERIOR_NO_APTO' },
    ])
  })
})

describe('diagnostico/topologia.js · contrato del llamante (LANZA: es un bug, no un dato)', () => {
  it('solape() exige dos arrays, y NOMBRA cuál falla', () => {
    expect(() => solape(null, rect(0, 0, 1, 1))).toThrow(/'recintosA'/)
    expect(() => solape(rect(0, 0, 1, 1), 'x')).toThrow(/'recintosB'/)
    expect(() => solape(rect(0, 0, 1, 1), { vertices: [] })).toThrow(TypeError)
  })

  it('invasiones() exige `recintos` y `vecinas` arrays', () => {
    expect(() => invasiones(null, [])).toThrow(/'recintos'/)
    expect(() => invasiones(rect(0, 0, 1, 1), null)).toThrow(/'vecinas'/)
    expect(() => invasiones(rect(0, 0, 1, 1), {})).toThrow(TypeError)
  })

  it('una vecina mal formada se nombra con su ÍNDICE', () => {
    const propia = rect(0, 0, 10, 10)
    const buena = { refcat: 'BUENA0000000A', recintos: rect(5, 5, 15, 15) }
    expect(() => invasiones(propia, [buena, null])).toThrow(/'vecinas\[1\]'/)
    expect(() => invasiones(propia, [buena, { refcat: 'X', recintos: 'no' }])).toThrow(
      /'vecinas\[1\]\.recintos'/,
    )
    expect(() => invasiones(propia, [{ refcat: 7, recintos: [] }])).toThrow(
      /'vecinas\[0\]\.refcat'/,
    )
  })

  it('se validan TODAS las vecinas ANTES de medir ninguna', () => {
    // Un resultado a medias con una excepción encima es peor que una excepción
    // limpia: el llamante no puede saber cuántas vecinas se llegaron a comparar.
    const solapa = { refcat: 'SOLAPA000000A', recintos: rect(5, 5, 15, 15) }
    expect(() => invasiones(rect(0, 0, 10, 10), [solapa, solapa, 42])).toThrow(
      /'vecinas\[2\]'/,
    )
  })

  it('`refcat: null` es legítimo y `refcat: undefined` NO (undefined no es «no consta»)', () => {
    const propia = rect(0, 0, 10, 10)
    const recintos = rect(5, 5, 15, 15)
    expect(() => invasiones(propia, [{ refcat: null, recintos }])).not.toThrow()
    expect(() => invasiones(propia, [{ recintos }])).toThrow(/'vecinas\[0\]\.refcat'/)
  })
})

describe('diagnostico/topologia.js · guardián: de Turf, SOLO lo topológico (regla de oro 6)', () => {
  const FUENTE = readFileSync(join(RAIZ, 'diagnostico', 'topologia.js'), 'utf8')

  /** Subpaquetes de Turf importados por un texto fuente, en orden y sin repetir. */
  const turfImportado = (texto) => [
    ...new Set([...texto.matchAll(/from\s+'(@turf\/[\w-]+|turf)'/g)].map((m) => m[1])),
  ]

  it('importa EXACTAMENTE `@turf/intersect` y `@turf/helpers`, por subpaquete', () => {
    expect(turfImportado(FUENTE).sort()).toEqual(['@turf/helpers', '@turf/intersect'])
  })

  it('el detector SÍ dispara (mitad anti-vacuidad del guardián)', () => {
    // Un guardián que no puede fallar nunca es un test verde de adorno, y este repo
    // ya tuvo uno (el plugin `gmlSinProj4` de `vite.config.js`).
    expect(turfImportado("import area from '@turf/area'\n")).toEqual(['@turf/area'])
    expect(turfImportado("import * as t from 'turf'\n")).toEqual(['turf'])
  })

  it('no importa NINGUNA de las funciones prohibidas por la regla de oro 6', () => {
    // `turf.area` es la que importa aquí: sobre lat/lon daría el área GEODÉSICA,
    // que difiere de la proyectada en k² —del orden de 1 m² en esta parcela—, o sea
    // un número PLAUSIBLE y distinto justo del tamaño de lo que F07 mide.
    const PROHIBIDAS = [
      'area',
      'distance',
      'length',
      'buffer',
      'along',
      'midpoint',
      'bearing',
      'nearest-point-on-line',
    ]
    for (const nombre of PROHIBIDAS) {
      expect(turfImportado(FUENTE)).not.toContain(`@turf/${nombre}`)
    }
    // Y no aparece ninguna llamada a `area(` de Turf: la del proyecto se llama
    // `superficie` y viene de `geo/area.js`.
    expect(FUENTE).toMatch(/from '\.\.\/geo\/area\.js'/)
  })

  it('los anillos se cierran con `anilloCerrado`, nunca a mano', () => {
    // Es lo que corta la referencia viva a `geometriaOficial` (regla de oro 2, y el
    // test de arriba mide el peligro). Un `[...vertices, vertices[0]]` escrito a
    // mano funcionaría igual de bien... hasta el día que alguien lo optimice.
    expect(FUENTE).toMatch(/anilloCerrado\(recintos\[0\]\.vertices\)/)
    expect(FUENTE).toMatch(/from '\.\.\/geo\/poligono\.js'/)
    // Ningún cierre artesanal: ni concatenar el primer vértice ni empujarlo.
    expect(FUENTE).not.toMatch(/vertices\[0\]\s*\]/)
  })

  it('el área de CADA pieza la mide `geo/area.js#superficie`, no Turf', () => {
    // La comprobación de verdad no es un regex: es que el número coincida con el
    // shoelace del proyecto sobre la MISMA geometría devuelta, pieza a pieza.
    const s = solape(rect(0, 0, 10, 10), rect(3, 3, 20, 20))
    const aMano = s.piezas.reduce((acc, p) => acc + superficie(p), 0)
    expect(s.area).toBe(aMano)
    expect(s.area).toBeCloseTo(49, 10) // 7 × 7
  })
})
