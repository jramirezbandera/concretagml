// test/parsers/topologia.test.js — F22 · T1.1.
//
// El detector NO decide nada: contesta si el reparto «uno exterior y el resto
// huecos» se sostiene, y si lo que hay en su lugar son N fincas separadas. Quien
// decide es `parsers/importar.js`, y eso se prueba en su fichero.
//
// ⚠️ Todas las coordenadas son UTM plausibles de la España peninsular (huso 30,
// Málaga). No es cosmética: con cuadrados en el origen (0,0)–(100,100) los
// detectores defensivos de `importar.js` los leen como GRADOS y el caso de prueba
// deja de ejercitar lo que dice ejercitar. Se descubrió midiendo, no razonando.

import { describe, it, expect } from 'vitest'
import {
  analizarReparto,
  rotularRecintos,
  TOL_SOLAPE_M2,
  FRACCION_SOLAPE,
} from '../../parsers/topologia.js'

/** Esquina de referencia: la manzana real del fichero de F22. */
const X0 = 386100
const Y0 = 4064400

/** Rectángulo con esquina inferior izquierda en (X0+dx, Y0+dy). Anillo ABIERTO. */
const rect = (dx, dy, ancho, alto) => [
  [X0 + dx, Y0 + dy],
  [X0 + dx + ancho, Y0 + dy],
  [X0 + dx + ancho, Y0 + dy + alto],
  [X0 + dx, Y0 + dy + alto],
]

describe('parsers/topologia — la lectura «contorno + huecos»', () => {
  it('un contorno con su patio NO es disjunto, y el patio sale en `dentro`', () => {
    const r = analizarReparto([rect(0, 0, 100, 100), rect(40, 40, 20, 20)])
    expect(r.disjuntos).toBe(false)
    expect(r.dentro).toEqual([1])
    expect(r.fuera).toEqual([])
    expect(r.solapes).toEqual([])
  })

  it('varios patios: todos dentro, y sigue sin ser disjunto', () => {
    const r = analizarReparto([rect(0, 0, 100, 100), rect(10, 10, 20, 20), rect(60, 60, 20, 20)])
    expect(r.disjuntos).toBe(false)
    expect(r.dentro).toEqual([1, 2])
  })

  it('un anillo solo no es «N recintos»: hace falta un par para poder afirmarlo', () => {
    const r = analizarReparto([rect(0, 0, 100, 100)])
    expect(r.disjuntos).toBe(false)
    expect(r.pares).toBe(0)
  })

  it('sin anillos no afirma nada y no lanza', () => {
    expect(analizarReparto([])).toMatchObject({ disjuntos: false, pares: 0, saltados: [] })
  })
})

describe('parsers/topologia — N fincas separadas', () => {
  it('dos rectángulos apartados son DISJUNTOS', () => {
    const r = analizarReparto([rect(0, 0, 100, 100), rect(200, 0, 100, 100)])
    expect(r.disjuntos).toBe(true)
    expect(r.dentro).toEqual([])
    expect(r.fuera).toEqual([1])
  })

  it('⭐ dos fincas que COMPARTEN LINDERO también son disjuntas', () => {
    // Es el caso NORMAL de una manzana y el que decide si esta fase sirve para
    // algo: ocho parcelas de una manzana se tocan todas. `diagnostico/topologia.js`
    // ya lo dejó medido —«intersect da null tanto si son disjuntas como si el
    // lindero coincide entero, en parte o en una esquina»— y aquí se ata.
    const r = analizarReparto([rect(0, 0, 100, 100), rect(100, 0, 100, 100)])
    expect(r.disjuntos).toBe(true)
    expect(r.solapes).toEqual([])
    // ⚠️ Y el prefiltro por caja NO las descarta: sus cajas se tocan, así que el
    // par llega a la comprobación fina. Si esto bajara a 0 el prefiltro estaría
    // ahorrando en el único sitio donde puede equivocarse.
    expect(r.pares).toBe(1)
  })

  it('tocarse solo por una esquina también es disjunto', () => {
    const r = analizarReparto([rect(0, 0, 100, 100), rect(100, 100, 100, 100)])
    expect(r.disjuntos).toBe(true)
  })
})

describe('parsers/topologia — un dato ROTO no es N fincas', () => {
  it('dos anillos que se pisan de verdad NO son disjuntos, y el solape sale con su cifra', () => {
    const r = analizarReparto([rect(0, 0, 100, 100), rect(50, 50, 100, 100)])
    expect(r.disjuntos).toBe(false)
    expect(r.solapes).toHaveLength(1)
    expect(r.solapes[0]).toMatchObject({ a: 0, b: 1 })
    expect(r.solapes[0].area).toBeCloseTo(2500, 6)
    // El umbral viaja con el hallazgo: «2500 m² comunes» no se juzga sin saber
    // contra qué. 1 % del menor de los dos, que aquí miden 10.000 m² los dos.
    expect(r.solapes[0].umbral).toBeCloseTo(100, 6)
  })
})

describe('parsers/topologia — ⛔ el umbral que refutó medir', () => {
  // Con solo el suelo absoluto de 1 mm², la capa «Construccion» del fichero real
  // salía `disjuntos: false` por DOS solapes de 0,0012 m² entre medianeras que
  // comparten muro. Eso no es un dato roto: es cómo se digitaliza la cartografía.
  // El criterio de milímetro cuadrado es correcto contra el ruido de la máquina y
  // FALSO contra el ruido del mundo.

  it('una astilla de 12 cm² entre dos fincas grandes NO cuenta como solape', () => {
    // 100 m de lindero pisados 1,2 mm ⇒ ~0,0012 m², la cifra medida en el fichero.
    const r = analizarReparto([rect(0, 0, 100, 100), rect(100 - 0.000012, 0, 100, 100)])
    expect(r.solapes).toEqual([])
    expect(r.disjuntos).toBe(true)
  })

  it('esa MISMA astilla sí cuenta si los recintos son diminutos', () => {
    // La mitad relativa es una fracción del MENOR, así que la misma superficie
    // común significa cosas distintas según con qué se compare. Aquí el segundo
    // recinto mide 0,01 m² y la astilla es una parte gruesa de él.
    const r = analizarReparto([rect(0, 0, 100, 100), rect(99.95, 0, 0.1, 0.1)], {
      fraccion: FRACCION_SOLAPE,
    })
    expect(r.disjuntos).toBe(false)
    expect(r.solapes).toHaveLength(1)
  })

  it('los dos umbrales son parametrizables, y con `fraccion: 0` manda el suelo absoluto', () => {
    const anillos = [rect(0, 0, 100, 100), rect(100 - 0.000012, 0, 100, 100)]
    expect(analizarReparto(anillos, { fraccion: 0 }).solapes).toHaveLength(1)
    expect(analizarReparto(anillos).solapes).toHaveLength(0)
    expect(TOL_SOLAPE_M2).toBe(1e-6)
    expect(FRACCION_SOLAPE).toBe(0.01)
  })
})

describe('parsers/topologia — degenerados y contratos', () => {
  it('un anillo de menos de 3 vértices se SALTA y se nombra, sin lanzar', () => {
    const r = analizarReparto([rect(0, 0, 100, 100), [[X0 + 5, Y0 + 5], [X0 + 6, Y0 + 6]]])
    expect(r.saltados).toEqual([1])
    expect(r.dentro).toEqual([])
    // No se afirma «son disjuntos» sobre un conjunto del que solo se ha medido uno.
    expect(r.disjuntos).toBe(false)
  })

  it('los vértices no finitos se filtran antes de medir', () => {
    const conBasura = [...rect(0, 0, 100, 100), [NaN, NaN], [Infinity, 0]]
    const r = analizarReparto([conBasura, rect(200, 0, 100, 100)])
    expect(r.saltados).toEqual([])
    expect(r.disjuntos).toBe(true)
  })

  it('un anillo entero de basura acaba en `saltados`, no en una excepción', () => {
    const r = analizarReparto([rect(0, 0, 100, 100), [[NaN, 1], [2, Infinity]]])
    expect(r.saltados).toEqual([1])
  })

  it('lanza si no le dan un array: eso es un error de PROGRAMACIÓN, no un dato', () => {
    expect(() => analizarReparto(null)).toThrow(TypeError)
    expect(() => analizarReparto('386100 4064400')).toThrow(TypeError)
  })
})

describe('parsers/topologia — el prefiltro por caja envolvente', () => {
  // ⛔ El coste es cuadrático y el peor caso está en el mismo fichero que abre la
  // fase: la capa «Construccion» trae 168 polilíneas, o sea 14.028 pares. El
  // prefiltro es lo que hace que eso no sean segundos de pantalla congelada.

  it('anillos apartados no llegan a la comprobación fina', () => {
    const lejanos = Array.from({ length: 10 }, (_, i) => rect(i * 1000, 0, 100, 100))
    const r = analizarReparto(lejanos)
    expect(r.disjuntos).toBe(true)
    expect(r.pares).toBe(0) // 45 posibles, 0 finos
  })

  it('pero DESCARTA, nunca afirma: cajas que se solapan sí llegan al par fino', () => {
    // Dos «L» encajadas: sus cajas se pisan y los recintos no. Si el prefiltro
    // afirmara por la caja, esto saldría como un solape que no existe.
    const ele = [
      [X0, Y0],
      [X0 + 100, Y0],
      [X0 + 100, Y0 + 20],
      [X0 + 20, Y0 + 20],
      [X0 + 20, Y0 + 100],
      [X0, Y0 + 100],
    ]
    const otra = [
      [X0 + 30, Y0 + 30],
      [X0 + 100, Y0 + 30],
      [X0 + 100, Y0 + 100],
      [X0 + 30, Y0 + 100],
    ]
    const r = analizarReparto([ele, otra])
    expect(r.pares).toBe(1)
    expect(r.disjuntos).toBe(true)
    expect(r.solapes).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// F22 · T2.3 · EMPAREJAR RÓTULOS Y RECINTOS, SIN ADIVINAR
// ═══════════════════════════════════════════════════════════════════════════

/** Rótulo en el centro del rectángulo `rect(dx, dy, w, h)`. */
const rotulo = (texto, dx, dy, w, h) => ({
  texto,
  capa: 'RefCatastral',
  x: X0 + dx + w / 2,
  y: Y0 + dy + h / 2,
})

describe('parsers/topologia — rotularRecintos', () => {
  it('el caso limpio: un rótulo dentro de cada recinto', () => {
    const r = rotularRecintos(
      [rect(0, 0, 100, 100), rect(200, 0, 100, 100)],
      [rotulo('A', 0, 0, 100, 100), rotulo('B', 200, 0, 100, 100)],
    )
    expect(r.nombres).toEqual(['A', 'B'])
    expect(r.limpia).toBe(true)
    expect(r.huerfanos).toEqual([])
    expect(r.compartidos).toEqual([])
    expect(r.ambiguos).toEqual([])
  })

  it('`nombres` mide SIEMPRE lo que `anillos`, aunque no haya ni un rótulo', () => {
    const r = rotularRecintos([rect(0, 0, 100, 100), rect(200, 0, 100, 100)], [])
    expect(r.nombres).toEqual([null, null])
    expect(r.limpia).toBe(false)
  })

  it('⛔ un rótulo que no cae en ningún recinto es HUÉRFANO, no se aproxima al más cercano', () => {
    const r = rotularRecintos(
      [rect(0, 0, 100, 100)],
      [rotulo('A', 0, 0, 100, 100), { texto: 'SUELTO', capa: 'x', x: X0 + 500, y: Y0 + 500 }],
    )
    expect(r.nombres).toEqual(['A'])
    expect(r.huerfanos).toEqual([{ texto: 'SUELTO', x: X0 + 500, y: Y0 + 500 }])
    expect(r.limpia).toBe(false) // sobra algo ⇒ el fichero no nombra limpiamente
  })

  it('⛔ dos rótulos dentro del mismo recinto lo dejan SIN nombre, no gana el primero', () => {
    // `report/literal.js` resolvió un caso parecido dejando ganar al primero y lo
    // declaró como límite. Aquí sería el nombre con el que el usuario identifica su
    // parcela antes de firmarla, así que no se elige: se dice.
    const r = rotularRecintos(
      [rect(0, 0, 100, 100)],
      [rotulo('A', 0, 0, 50, 50), rotulo('B', 50, 50, 50, 50)],
    )
    expect(r.nombres).toEqual([null])
    expect(r.ambiguos).toEqual([{ indice: 0, textos: ['A', 'B'] }])
    expect(r.limpia).toBe(false)
  })

  it('⛔ un rótulo dentro de DOS recintos anidados no nombra a ninguno', () => {
    const grande = rect(0, 0, 100, 100)
    const pequeno = rect(40, 40, 20, 20)
    const r = rotularRecintos([grande, pequeno], [rotulo('X', 40, 40, 20, 20)])
    expect(r.nombres).toEqual([null, null])
    expect(r.compartidos).toEqual([{ texto: 'X', indices: [0, 1] }])
    expect(r.limpia).toBe(false)
  })

  it('un recinto degenerado no participa, y deja la rotulación en NO limpia', () => {
    const r = rotularRecintos(
      [rect(0, 0, 100, 100), [[X0, Y0], [X0 + 1, Y0 + 1]]],
      [rotulo('A', 0, 0, 100, 100)],
    )
    expect(r.nombres).toEqual(['A', null])
    expect(r.limpia).toBe(false)
  })

  it('los rótulos con coordenadas no finitas se descartan sin lanzar', () => {
    const r = rotularRecintos(
      [rect(0, 0, 100, 100)],
      [rotulo('A', 0, 0, 100, 100), { texto: 'B', capa: 'x', x: NaN, y: 0 }],
    )
    expect(r.nombres).toEqual(['A'])
    expect(r.huerfanos).toEqual([])
    expect(r.limpia).toBe(true) // el descartado no cuenta como sobra
  })

  it('sin rótulos y sin anillos no afirma nada, y con `anillos` mal LANZA', () => {
    expect(rotularRecintos([], []).limpia).toBe(false)
    expect(() => rotularRecintos(null, [])).toThrow(TypeError)
  })
})
