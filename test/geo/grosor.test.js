/* -------------------------------------------------------------------------- *
 * test/geo/grosor.test.js — F17 · tarea 1.1                                    *
 *                                                                              *
 * `geo/grosor.js#medirPieza` es la aritmética con la que este proyecto decide   *
 * si un trozo de geometría es una cesión de verdad o una astilla de redondeo.   *
 * Vivía privada dentro de `diagnostico/topologia.js` desde F07 y sube a `geo/`  *
 * porque F17 necesita EXACTAMENTE la misma: dos copias serían dos definiciones  *
 * de «astilla» libres de divergir.                                             *
 *                                                                              *
 * Lo que este fichero comprueba, y por qué cada cosa:                          *
 *                                                                              *
 *   1. LA FÓRMULA, contra números calculados a mano. Un test que repita la      *
 *      implementación no puede contradecirla.                                   *
 *   2. ⭐ QUE EL GROSOR NO DEPENDA DE LA LONGITUD. Es la propiedad ENTERA por    *
 *      la que F07 cambió un umbral de área por uno de grosor: el área de una    *
 *      astilla crece con el lindero y el grosor no. Si esto dejara de ser       *
 *      cierto, el filtro volvería a fallar en linderos largos.                  *
 *   3. ⭐ LA AFIRMACIÓN DEL ANILLO, que con F17 deja de ser hipotética. La        *
 *      cabecera del módulo dice que para un anillo DELGADO `2A/P = h`           *
 *      EXACTAMENTE, y de eso depende que un sobrante anular —encoger la parcela *
 *      por todos sus lados— no se descarte como astilla. Es la clase de         *
 *      afirmación que se escribe en un comentario y nadie vuelve a comprobar.   *
 *   4. La separación real medida en F07: 0,071 mm frente a 4,9 cm, tres órdenes *
 *      de magnitud.                                                            *
 *   5. Los casos frontera que dejan la pieza siempre descartada en vez de       *
 *      colarla (`Infinity`, `NaN`).                                            *
 *                                                                              *
 * Proyecto Vitest `node`: aritmética pura, sin DOM y sin Turf.                  *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import { medirPieza } from '../../geo/grosor.js'
import { superficie } from '../../geo/area.js'
import { perimetro } from '../../geo/metrica.js'
import { OPERATIVOS } from '../../config/operativos.js'

// ── Utilidades ───────────────────────────────────────────────────────────────

/** Rectángulo ANTIHORARIO como recinto EXTERIOR, con el anillo ABIERTO. */
const rect = (x0, y0, x1, y1, tipo = 'EXTERIOR') => ({
  vertices: [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ],
  tipo,
})

/** Un anillo rectangular: marco exterior con un hueco concéntrico de grosor `h`. */
const anilloRect = (lado, h) => [
  rect(0, 0, lado, lado),
  rect(h, h, lado - h, lado - h, 'HUECO'),
]

// ── 1 · La fórmula ───────────────────────────────────────────────────────────

describe('geo/grosor · medirPieza mide 2·área / perímetro', () => {
  it('un cuadrado de lado 10 da área 100, perímetro 40 y grosor 5', () => {
    // A mano: 2·100/40 = 5. Y ojo a la lectura, que está en la cabecera del
    // módulo: para un cuadrado de lado `s` la cifra es `s/2`, NO `s`. No es el
    // grosor de nadie; es una magnitud que separa poblaciones.
    const m = medirPieza([rect(0, 0, 10, 10)])
    expect(m.area).toBeCloseTo(100, 10)
    expect(m.grosor).toBeCloseTo(5, 10)
  })

  it('devuelve la pieza que se le pasó, sin copiarla ni tocarla', () => {
    // El llamante necesita seguir teniendo la geometría al lado de sus cifras
    // (F07 la usa para pintar la mancha; F17, para emitir la parcela).
    const pieza = [rect(0, 0, 4, 1)]
    const m = medirPieza(pieza)
    expect(m.pieza).toBe(pieza)
    expect(pieza[0].vertices).toHaveLength(4)
  })

  it('las dos magnitudes son las canónicas del proyecto, no otras', () => {
    // Regla de oro 5: el área es el shoelace de `geo/area.js`, jamás `turf.area`.
    const pieza = [rect(3, 3, 9, 5)]
    const m = medirPieza(pieza)
    expect(m.area).toBe(superficie(pieza))
    expect(m.grosor).toBe((2 * superficie(pieza)) / perimetro(pieza).total)
  })
})

// ── 2 · ⭐ El grosor NO depende de la longitud ────────────────────────────────

describe('geo/grosor · la propiedad por la que este filtro sustituyó al de área', () => {
  it('⭐ una franja de altura fija da CASI el mismo grosor mida 1 m o 1 km de largo', () => {
    // El área de la astilla crece con la longitud del lindero; el grosor no. Es
    // la razón entera del cambio de F07, y aquí está medida: el área se multiplica
    // por 1.000 y el grosor se queda donde estaba.
    const h = 0.05
    const corta = medirPieza([rect(0, 0, 1, h)])
    const larga = medirPieza([rect(0, 0, 1000, h)])

    expect(larga.area / corta.area).toBeCloseTo(1000, 6)
    // Para una franja `L × h` el valor exacto es `L·h/(L+h)`, que tiende a `h`.
    expect(corta.grosor).toBeCloseTo((1 * h) / (1 + h), 12)
    expect(larga.grosor).toBeCloseTo((1000 * h) / (1000 + h), 12)
    // Y las dos caen del mismo lado de cualquier umbral razonable: eso es lo que
    // se le pide. Un umbral de ÁREA las habría separado.
    expect(larga.grosor / corta.grosor).toBeLessThan(1.06)
  })

  it('⛔ el umbral NO vive aquí: `geo/` mide y quien descarta es el llamante', () => {
    // Regla de oro 9. Si este módulo comparase, una medida se habría convertido
    // en un veredicto. Se afirma que la clave existe donde tiene que existir.
    expect(OPERATIVOS.grosorInvasionMinimoM).toBeGreaterThan(0)
    expect(Object.keys(medirPieza([rect(0, 0, 1, 1)]))).toEqual(['pieza', 'area', 'grosor'])
  })
})

// ── 3 · ⭐ El anillo: el límite conocido, medido ──────────────────────────────

describe('geo/grosor · el sobrante ANULAR, que con F17 es un caso normal', () => {
  it('⭐ para un anillo UNIFORME el grosor sale EXACTAMENTE h, a cualquier grosor', () => {
    // Es la buena noticia que F17 necesitaba: el sobrante de un encogimiento
    // uniforme se mide BIEN. Sale de la propia álgebra —para un marco L×W de grosor
    // h, `A = 2h(L+W) − 4h²` y `P = 4(L+W) − 8h`, luego `2A/P = h` sin aproximar—,
    // y la afirmación de F07 («solo si es delgado») se queda corta.
    for (const h of [0.001, 0.01, 0.05, 1, 20, 25]) {
      const m = medirPieza(anilloRect(100, h))
      expect(m.area).toBeCloseTo(400 * h - 4 * h * h, 9)
      expect(m.grosor).toBeCloseTo(h, 12)
    }
    // Y no depende de que el marco sea cuadrado.
    const rectangular = [rect(0, 0, 200, 50), rect(2, 2, 198, 48, 'HUECO')]
    expect(medirPieza(rectangular).grosor).toBeCloseTo(2, 12)
  })

  it('el hueco RESTA área y SUMA perímetro: es lo que hace que la cuenta salga', () => {
    // Si el hueco no contara, un anillo de 100×100 con h=1 mediría 10.000 m² y su
    // grosor daría 50 m. Con el hueco: 396 m² y 1 m clavado. Dos órdenes de
    // magnitud de diferencia en la decisión.
    const anillo = anilloRect(100, 1)
    const soloMarco = medirPieza([anillo[0]])
    const conHueco = medirPieza(anillo)
    expect(soloMarco.area).toBeCloseTo(10_000, 6)
    expect(conHueco.area).toBeCloseTo(396, 6)
    expect(soloMarco.grosor).toBeCloseTo(50, 6)
    expect(conHueco.grosor).toBeCloseTo(1, 12)
  })

  it('⛔ el riesgo real es el CONTRARIO del que F07 escribió: SOBREestima el lado fino', () => {
    // Un anillo NO uniforme da una especie de promedio. Medido: marco de 100×100
    // con el hueco descentrado —1 m de grosor en un lado, 49 en el opuesto— da 25.
    // Un sobrante con un lado de milímetros pasaría el filtro anunciando 25 m.
    //
    // No descarta de más: ADMITE de más, y en esta aplicación ése es el error que
    // importa, porque una astilla admitida se emite y se firma. Está escrito en la
    // cabecera del módulo, y aquí queda medido para que nadie lea `grosor` como
    // «el ancho mínimo de la pieza».
    const descentrado = [rect(0, 0, 100, 100), rect(1, 1, 51, 51, 'HUECO')]
    const m = medirPieza(descentrado)
    expect(m.grosor).toBeCloseTo(25, 9)
    expect(m.grosor).toBeGreaterThan(1) // el lado fino mide 1 m, y dice 25
    // El área y el perímetro no dependen de DÓNDE esté el hueco, solo de su tamaño:
    // por eso la cifra no puede distinguir un anillo uniforme de uno que no lo es.
    const centrado = [rect(0, 0, 100, 100), rect(25, 25, 75, 75, 'HUECO')]
    expect(medirPieza(centrado).grosor).toBeCloseTo(m.grosor, 9)
  })
})

// ── 4 · La separación medida en F07 ──────────────────────────────────────────

describe('geo/grosor · separa las dos poblaciones que F07 midió', () => {
  it('la astilla de lindero y la franja invadida están a tres órdenes de magnitud', () => {
    // Astilla real del fixture: un TRIÁNGULO de 1,7 m de base y 0,14 mm de altura.
    // Franja invadida: 2 m × 5 cm. Las cifras de referencia están en la cabecera
    // de `diagnostico/topologia.js`.
    const astilla = medirPieza([
      {
        vertices: [
          [0, 0],
          [1.7, 0],
          [0.85, 0.00014],
        ],
        tipo: 'EXTERIOR',
      },
    ])
    const franja = medirPieza([rect(0, 0, 2, 0.05)])

    expect(astilla.grosor).toBeLessThan(OPERATIVOS.grosorInvasionMinimoM)
    expect(franja.grosor).toBeGreaterThan(OPERATIVOS.grosorInvasionMinimoM)
    expect(franja.grosor / astilla.grosor).toBeGreaterThan(500)
  })
})

// ── 5 · Frontera: nada que pueda colarse ─────────────────────────────────────

describe('geo/grosor · una pieza degenerada queda descartada, no colada', () => {
  it('perímetro 0 da grosor 0, no Infinity ni NaN', () => {
    // Todos los vértices en el mismo punto: área 0 y perímetro 0. `2·0/0` sería
    // `NaN`, y un `NaN` NO es menor que el umbral: la pieza pasaría el filtro.
    const degenerada = [
      {
        vertices: [
          [5, 5],
          [5, 5],
          [5, 5],
        ],
        tipo: 'EXTERIOR',
      },
    ]
    const m = medirPieza(degenerada)
    expect(m.grosor).toBe(0)
    expect(Number.isNaN(m.grosor)).toBe(false)
    expect(m.grosor < OPERATIVOS.grosorInvasionMinimoM).toBe(true)
  })

  it('un anillo de área nula pero con perímetro da grosor 0 y tampoco se cuela', () => {
    // Tres puntos colineales: perímetro > 0, área 0. La división es legítima y da
    // 0, que es lo correcto — no hay nada que ceder.
    const m = medirPieza([
      {
        vertices: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
        tipo: 'EXTERIOR',
      },
    ])
    expect(m.area).toBeCloseTo(0, 12)
    expect(m.grosor).toBeCloseTo(0, 12)
  })

  it('la pieza VACÍA no lanza: mide 0 y queda descartada', () => {
    // `geo/area.js#superficie` devuelve 0 para `[]` en vez de lanzar, y aquí eso es
    // lo correcto: «no hay pieza» y «la pieza no cede nada» llevan a la misma
    // decisión. Lanzar obligaría a todos los llamantes a un guardia previo.
    expect(medirPieza([])).toEqual({ pieza: [], area: 0, grosor: 0 })
  })

  it('propaga los errores de `geo/` cuando el invariante SÍ está roto', () => {
    // Un `recintos` cuyo primer elemento es un HUECO es un bug del llamante, y el
    // mensaje de `superficie` lo dice mejor que uno intermedio.
    expect(() => medirPieza([rect(0, 0, 1, 1, 'HUECO')])).toThrow(/EXTERIOR/)
  })
})
