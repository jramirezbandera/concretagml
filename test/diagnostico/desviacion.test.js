import { describe, expect, it, vi } from 'vitest'
import { OPERATIVOS } from '../../config/operativos.js'
import { proyectarEnSegmento } from '../../geo/segmento.js'
import { desviacionPorLado } from '../../diagnostico/desviacion.js'

// F07 · diagnostico/desviacion.js — la desviación máxima de lindero, por lado.
//
// Todos los valores esperados están CALCULADOS A MANO sobre fixtures de números
// redondos, y el porqué de cada uno va escrito al lado: un test cuyo valor
// esperado se copió de la salida del programa solo demuestra que el programa hace
// lo que hace.
//
// Lo que se comprueba, por orden de importancia:
//   1. Que el máximo se atribuye AL LADO correcto (§10.5 resalta un lindero, así
//      que equivocar el lado es peor que equivocar la cifra en un milímetro).
//   2. Que el caso del vértice insertado por F06 —dos lados medidos contra un solo
//      lado oficial— sale bien, que es la razón de no emparejar linderos homólogos.
//   3. Que un lado más corto que el paso SE MIDE (un 0 ahí sería una mentira
//      tranquilizadora) y que sin geometría oficial la respuesta es `null` y no 0.
//   4. Que los dos descartes de coste NO cambian el resultado, comparando contra
//      la implementación ingenua sobre 500 vértices.
//   5. Que no juzga (regla de oro 9) y que no toca las entradas (regla de oro 2).

// ── Contador de proyecciones ─────────────────────────────────────────────────
//
// `geo/segmento.js` se envuelve en un contador que llama al ORIGINAL: el
// comportamiento de todas las suites es idéntico y a cambio se puede CONTAR
// cuántas proyecciones punto-segmento llega a hacer el módulo, que es la única
// forma de demostrar que el descarte descarta — su efecto no se ve en el
// resultado (un descarte correcto devuelve exactamente lo mismo).
//
// Es un contador plano y NO un `vi.fn`: `vi.fn` guarda cada llamada en
// `mock.calls`, y la variante ingenua de este fichero hace 25 MILLONES de
// llamadas. Guardarlas reventaría la memoria del proceso antes de llegar al
// `expect`.
const espia = vi.hoisted(() => ({ proyecciones: 0 }))

vi.mock('../../geo/segmento.js', async (importarOriginal) => {
  const real = await importarOriginal()
  return {
    ...real,
    proyectarEnSegmento: (P, A, B) => {
      espia.proyecciones++
      return real.proyectarEnSegmento(P, A, B)
    },
  }
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Cuadrado oficial de 10×10 con esquina en el origen. Lados: sur, este, norte, oeste. */
const OFICIAL_CUADRADO = () => [
  {
    vertices: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    tipo: 'EXTERIOR',
  },
]

/**
 * El mismo cuadrado con el lado NORTE metido 0,40 m (de y=10 a y=9,6).
 *
 * La construcción no es arbitraria y es la única que ATRIBUYE el máximo sin
 * empate. Empujar un lado hacia FUERA no serviría: sus dos vecinos comparten con
 * él las esquinas, esas esquinas se van con él y los tres lados salen empatados a
 * 0,40 m — el desempate («gana el primero») elegiría un vecino y el test no
 * probaría nada. Metiéndolo hacia DENTRO, en cambio, los lados este y oeste
 * quedan ENCIMA de los oficiales (más cortos, pero sobre la misma recta) y miden
 * exactamente 0: el único lado con desviación es el que se ha movido.
 *
 * A mano, lado por lado:
 *   · 0 (0,0)→(10,0): sobre el lado sur oficial ⇒ 0.
 *   · 1 (10,0)→(10,9.6): sobre el lado este oficial (x=10, 0≤y≤10) ⇒ 0.
 *   · 2 (10,9.6)→(0,9.6): a 0,40 m del lado norte oficial. En sus EXTREMOS mide 0
 *     —tocan los lados este y oeste oficiales—, así que la MEDIA de este lado sale
 *     bastante menor que 0,40 y el MÁXIMO es 0,40. Ésta es la razón de que la
 *     métrica sea máximo de mínimos y no media.
 *   · 3 (0,9.6)→(0,0): sobre el lado oeste oficial ⇒ 0.
 */
const MEDIDO_NORTE_METIDO = () => [
  {
    vertices: [
      [0, 0],
      [10, 0],
      [10, 9.6],
      [0, 9.6],
    ],
    tipo: 'EXTERIOR',
  },
]

/** Congela en profundidad: cualquier escritura en sitio lanzaría (módulos ES = modo estricto). */
function congelar(valor) {
  if (valor && typeof valor === 'object') {
    for (const v of Object.values(valor)) congelar(v)
    Object.freeze(valor)
  }
  return valor
}

/** Todas las claves alcanzables en un objeto, en profundidad. */
function clavesProfundas(valor, acc = []) {
  if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      acc.push(k)
      clavesProfundas(v, acc)
    }
  }
  return acc
}

/**
 * La implementación INGENUA: cada muestra contra CADA segmento oficial, sin
 * descarte de ningún tipo. Es la referencia contra la que se comprueba que los dos
 * descartes del módulo no cambian el resultado, y el término de comparación de la
 * medida de coste.
 *
 * Deliberadamente escrita a mano y no importada: si compartiera código con el
 * módulo, comparar uno con otro no demostraría nada.
 */
function ingenuo(recintos, recintosOficiales, pasoMetros = OPERATIVOS.pasoDesviacionMetros) {
  const segmentos = []
  for (const r of recintosOficiales) {
    const v = r.vertices
    for (let i = 0; i < v.length; i++) segmentos.push([v[i], v[(i + 1) % v.length]])
  }

  const porLado = []
  let maxima = null
  let nMuestras = 0

  for (let ir = 0; ir < recintos.length; ir++) {
    const v = recintos[ir].vertices
    for (let i = 0; i < v.length; i++) {
      const A = v[i]
      const B = v[(i + 1) % v.length]
      const dx = B[0] - A[0]
      const dy = B[1] - A[1]
      const nI = Math.max(1, Math.ceil(Math.hypot(dx, dy) / pasoMetros))
      let mejor = -Infinity
      let en = null
      let enOficial = null
      for (let k = 0; k <= nI; k++) {
        const t = k / nI
        const P = [A[0] + t * dx, A[1] + t * dy]
        nMuestras++
        let min = Infinity
        let punto = null
        for (const [SA, SB] of segmentos) {
          const pr = proyectarEnSegmento(P, SA, SB)
          if (pr.distancia < min) {
            min = pr.distancia
            punto = pr.punto
          }
        }
        if (min > mejor) {
          mejor = min
          en = P
          enOficial = punto
        }
      }
      const entrada = { recinto: ir, indice: i, maxima: mejor, en, enOficial }
      porLado.push(entrada)
      if (maxima === null || entrada.maxima > maxima.maxima) maxima = entrada
    }
  }
  return { porLado, maxima, nMuestras, nSegmentos: segmentos.length }
}

// ── El caso central: un lado movido 0,40 m ───────────────────────────────────

describe('diagnostico/desviacion.js · cuadrado con un lado metido 0,40 m', () => {
  it('la máxima es 0,40 m y el lado señalado es ÉSE (el 2), no un vecino', () => {
    const r = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO())

    expect(r.maxima).not.toBeNull()
    expect(r.maxima.maxima).toBeCloseTo(0.4, 12)
    expect(r.maxima.recinto).toBe(0)
    expect(r.maxima.indice).toBe(2)
  })

  it('los otros tres lados miden 0: están ENCIMA del contorno oficial', () => {
    const r = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO())

    expect(r.porLado).toHaveLength(4)
    expect(r.porLado.map((e) => e.indice)).toEqual([0, 1, 2, 3])
    expect(r.porLado[0].maxima).toBeCloseTo(0, 12)
    expect(r.porLado[1].maxima).toBeCloseTo(0, 12)
    expect(r.porLado[2].maxima).toBeCloseTo(0.4, 12)
    expect(r.porLado[3].maxima).toBeCloseTo(0, 12)
  })

  it('`en` y `enOficial` son el segmento que se acota: mismo x, 0,40 m de y', () => {
    const r = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO())

    // La muestra ganadora cae en el interior del lado (x ≈ 9,41: la tercera
    // muestra desde la esquina este), y su homóloga es el pie de la perpendicular
    // sobre el lado norte oficial, justo encima.
    expect(r.maxima.en[1]).toBeCloseTo(9.6, 12)
    expect(r.maxima.enOficial[1]).toBeCloseTo(10, 12)
    expect(r.maxima.enOficial[0]).toBeCloseTo(r.maxima.en[0], 12)
  })

  it('nMuestras es 136, contadas a mano: 35 + 33 + 35 + 35 − 2', () => {
    // Lados de 10 m: ceil(10 / 0,3) = 34 intervalos ⇒ 35 muestras (los dos
    // extremos incluidos). Lados de 9,6 m: 9,6 / 0,3 = 32 exacto ⇒ 33 muestras.
    // 35 + 33 + 35 + 33 = 136.
    const r = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO())
    expect(r.nMuestras).toBe(136)
  })

  it('`maxima` es LA MISMA entrada de `porLado`, no una copia', () => {
    // La capa de dibujo resalta con `lado === resultado.maxima`; si fuera una copia
    // habría dos cifras que podrían divergir y el resaltado no casaría con nada.
    const r = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO())
    expect(r.porLado).toContain(r.maxima)
    expect(r.maxima).toBe(r.porLado[2])
  })
})

// ── El caso que obliga a NO emparejar linderos homólogos ─────────────────────

describe('diagnostico/desviacion.js · vértice insertado (F06)', () => {
  /**
   * El cuadrado medido con un vértice INSERTADO en el punto medio del lado norte y
   * empujado 0,25 m hacia fuera. El contorno oficial sigue teniendo 4 lados y el
   * medido tiene 5: el emparejamiento 1 a 1 que la spec enunciaba literalmente ya
   * no existe —los lados 2 y 3 del medido comparten UN solo lado oficial, y el
   * lado 4 del medido (oeste) se emparejaría por índice con el lado 3 oficial
   * (oeste)… en este caso por suerte, y con cualquier borrado ya no—.
   *
   * A mano: todo punto de los lados 2 y 3 tiene y ∈ [10, 10.25], así que su
   * distancia al lado norte oficial (y=10) es y − 10 ≤ 0,25, con el máximo
   * exactamente 0,25 en el vértice insertado (5, 10.25) — que es extremo de los
   * dos lados y por tanto muestra de los dos.
   */
  const MEDIDO = () => [
    {
      vertices: [
        [0, 0],
        [10, 0],
        [10, 10],
        [5, 10.25],
        [0, 10],
      ],
      tipo: 'EXTERIOR',
    },
  ]

  it('los DOS lados nuevos miden 0,25 m contra el MISMO lado oficial', () => {
    const r = desviacionPorLado(MEDIDO(), OFICIAL_CUADRADO())

    expect(r.porLado).toHaveLength(5)
    expect(r.porLado[2].maxima).toBeCloseTo(0.25, 12)
    expect(r.porLado[3].maxima).toBeCloseTo(0.25, 12)
    // Los dos alcanzan su máximo en el vértice insertado y proyectan sobre el
    // mismo punto del lado norte oficial: la prueba de que un lado oficial puede
    // servir a dos lados medidos sin que haya que repartirlo ni desempatarlo.
    expect(r.porLado[2].en).toEqual([5, 10.25])
    expect(r.porLado[3].en).toEqual([5, 10.25])
    expect(r.porLado[2].enOficial[1]).toBeCloseTo(10, 12)
    expect(r.porLado[3].enOficial[1]).toBeCloseTo(10, 12)
  })

  it('los tres lados que no se han tocado siguen midiendo 0', () => {
    const r = desviacionPorLado(MEDIDO(), OFICIAL_CUADRADO())
    expect(r.porLado[0].maxima).toBeCloseTo(0, 12)
    expect(r.porLado[1].maxima).toBeCloseTo(0, 12)
    expect(r.porLado[4].maxima).toBeCloseTo(0, 12)
  })

  it('en un EMPATE gana el primero en orden de recinto y de vértice', () => {
    // Documentado en el `@returns`: es lo que hace el resultado reproducible.
    const r = desviacionPorLado(MEDIDO(), OFICIAL_CUADRADO())
    expect(r.maxima).toBe(r.porLado[2])
  })
})

// ── Un lado más corto que el paso ────────────────────────────────────────────

describe('diagnostico/desviacion.js · lado más corto que el paso de muestreo', () => {
  /**
   * El lado norte metido 0,40 m y partido en tres, con el tramo central de 0,10 m
   * (de x=5,05 a x=4,95): un TERCIO del paso por defecto (0,3 m). Sin la regla de
   * «los dos extremos siempre», ese lado no recibiría ni una muestra y saldría con
   * desviación 0 — que no es «no se desvía» sino «no se ha mirado».
   */
  const MEDIDO = () => [
    {
      vertices: [
        [0, 0],
        [10, 0],
        [10, 9.6],
        [5.05, 9.6],
        [4.95, 9.6],
        [0, 9.6],
      ],
      tipo: 'EXTERIOR',
    },
  ]

  it('el lado de 0,10 m se mide igual: 0,40 m, no 0', () => {
    const r = desviacionPorLado(MEDIDO(), OFICIAL_CUADRADO())

    const corto = r.porLado.find((e) => e.indice === 3)
    expect(corto).toBeDefined()
    expect(corto.maxima).toBeCloseTo(0.4, 12)
    // Su máximo cae en uno de sus dos extremos, que son las únicas muestras que
    // tiene (1 intervalo ⇒ 2 muestras).
    expect([5.05, 4.95]).toContain(corto.en[0])
  })

  it('el paso NO se reduce para ese lado: dos muestras, ni una más', () => {
    // 139 = 35 (sur, 10 m) + 33 (este, 9,6 m) + 18 (4,95 m) + 2 (0,10 m)
    //     + 18 (4,95 m) + 33 (oeste, 9,6 m).
    const r = desviacionPorLado(MEDIDO(), OFICIAL_CUADRADO())
    expect(r.nMuestras).toBe(139)
  })
})

// ── Huecos ───────────────────────────────────────────────────────────────────

describe('diagnostico/desviacion.js · un patio también tiene lindero', () => {
  const OFICIAL = () => [
    ...OFICIAL_CUADRADO(),
    {
      vertices: [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
      ],
      tipo: 'HUECO',
    },
  ]

  /** Exterior IDÉNTICO al oficial; el patio, con su lado norte bajado 0,50 m. */
  const MEDIDO = () => [
    ...OFICIAL_CUADRADO(),
    {
      vertices: [
        [4, 4],
        [6, 4],
        [6, 5.5],
        [4, 5.5],
      ],
      tipo: 'HUECO',
    },
  ]

  it('la desviación máxima puede estar en un HUECO, y se atribuye a él', () => {
    const r = desviacionPorLado(MEDIDO(), OFICIAL())

    // 8 lados: 4 del exterior + 4 del patio. Los huecos no se saltan.
    expect(r.porLado).toHaveLength(8)
    expect(r.maxima.recinto).toBe(1)
    expect(r.maxima.indice).toBe(2)
    expect(r.maxima.maxima).toBeCloseTo(0.5, 12)
  })

  it('el exterior, que no se ha tocado, mide 0 en sus cuatro lados', () => {
    const r = desviacionPorLado(MEDIDO(), OFICIAL())
    for (const e of r.porLado.filter((x) => x.recinto === 0)) {
      expect(e.maxima).toBeCloseTo(0, 12)
    }
  })

  it('los lindes del patio que siguen sobre el oficial miden 0', () => {
    const r = desviacionPorLado(MEDIDO(), OFICIAL())
    const patio = r.porLado.filter((e) => e.recinto === 1)
    expect(patio.map((e) => e.maxima.toFixed(9))).toEqual([
      '0.000000000',
      '0.000000000',
      '0.500000000',
      '0.000000000',
    ])
  })

  it('el mínimo se toma contra el contorno COMPLETO: el hueco medido no se compara solo con el hueco oficial', () => {
    // Prueba indirecta y fuerte: los EXTREMOS del lado 2 del patio medido tocan
    // los lados este y oeste del patio OFICIAL, así que su mínimo es 0 y el
    // máximo del lado (0,50) se alcanza en el centro. Si el mínimo se tomara solo
    // contra el lado norte oficial del patio, los extremos también medirían 0,50 y
    // el punto `en` sería un extremo, no el centro.
    const r = desviacionPorLado(MEDIDO(), OFICIAL())
    expect(r.maxima.en[0]).toBeGreaterThan(4.5)
    expect(r.maxima.en[0]).toBeLessThan(5.5)
  })
})

// ── Sin geometría oficial: `null`, que no es 0 ───────────────────────────────

describe('diagnostico/desviacion.js · sin contorno oficial', () => {
  const VACIO = { porLado: [], maxima: null, nMuestras: 0 }

  it('`null` (no consta: un DXF, un TXT, un contorno dibujado) ⇒ maxima null', () => {
    expect(desviacionPorLado(MEDIDO_NORTE_METIDO(), null)).toEqual(VACIO)
  })

  it('array vacío ⇒ maxima null', () => {
    expect(desviacionPorLado(MEDIDO_NORTE_METIDO(), [])).toEqual(VACIO)
  })

  it('un anillo oficial de menos de 3 vértices no es contorno ⇒ maxima null', () => {
    // Mismo criterio que `geo/metrica.js#longitudesDeLados`: un segmento no
    // encierra nada y el `% n` recorrería el mismo tramo dos veces.
    const degenerado = [{ vertices: [[0, 0], [1, 1]], tipo: 'EXTERIOR' }]
    expect(desviacionPorLado(MEDIDO_NORTE_METIDO(), degenerado)).toEqual(VACIO)
  })

  it('nMuestras es 0: no se muestrea para no comparar con nada', () => {
    // `nMuestras` es la constancia de cuánto se ha mirado. Un 136 aquí diría que
    // se midió algo, y no se midió nada.
    expect(desviacionPorLado(MEDIDO_NORTE_METIDO(), null).nMuestras).toBe(0)
  })

  it('`maxima: null` NO es `maxima: 0` — no hay con qué comparar ≠ encaja perfecto', () => {
    const r = desviacionPorLado(MEDIDO_NORTE_METIDO(), null)
    expect(r.maxima).toBeNull()
    expect(r.maxima).not.toBe(0)
  })
})

// ── Coordenadas UTM reales ───────────────────────────────────────────────────

describe('diagnostico/desviacion.js · la precisión aguanta en UTM real', () => {
  const ESTE = 373000
  const NORTE = 4070000

  const trasladar = (recintos) =>
    recintos.map((r) => ({
      ...r,
      vertices: r.vertices.map(([x, y]) => [x + ESTE, y + NORTE]),
    }))

  it('el mismo caso a x ≈ 373.000, y ≈ 4.070.000 da 0,40 m con 10 decimales', () => {
    // El ulp de float64 a Norte ≈ 4,07·10⁶ es ≈ 4,7·10⁻¹⁰ m. Que la desviación
    // salga a menos de 10⁻¹⁰ del valor exacto es la prueba de que
    // `geo/segmento.js` traslada a origen local antes de multiplicar (regla 5):
    // sin la traslación, los productos valdrían ≈ 1,7·10¹³ y la cancelación se
    // comería los milímetros del levantamiento.
    const r = desviacionPorLado(trasladar(MEDIDO_NORTE_METIDO()), trasladar(OFICIAL_CUADRADO()))

    expect(r.maxima.indice).toBe(2)
    expect(r.maxima.maxima).toBeCloseTo(0.4, 9)
    expect(Math.abs(r.maxima.maxima - 0.4)).toBeLessThan(1e-9)
  })

  it('los puntos devueltos son UTM absolutos, no locales', () => {
    const r = desviacionPorLado(trasladar(MEDIDO_NORTE_METIDO()), trasladar(OFICIAL_CUADRADO()))
    expect(r.maxima.en[0]).toBeGreaterThan(ESTE)
    expect(r.maxima.en[1]).toBeCloseTo(NORTE + 9.6, 6)
    expect(r.maxima.enOficial[1]).toBeCloseTo(NORTE + 10, 6)
  })

  it('el nº de muestras puede variar en ±1 por lado al trasladar, y es correcto', () => {
    // 138 y no 136: en UTM, (4070009,6 − 4070000) = 9,600000000093132 en float64,
    // de modo que 9,6/0,3 pasa de 32 exacto a 32,00000000031 y `ceil` da 33
    // intervalos en vez de 32. Es la aritmética honesta de un `ceil` sobre un
    // cociente de doubles: una muestra MÁS, nunca una menos, y la desviación
    // medida no cambia. Se afirma para que nadie lo lea como un fallo.
    const r = desviacionPorLado(trasladar(MEDIDO_NORTE_METIDO()), trasladar(OFICIAL_CUADRADO()))
    expect(r.nMuestras).toBe(138)
  })
})

// ── El paso de muestreo y su cota ────────────────────────────────────────────

describe('diagnostico/desviacion.js · el paso de muestreo', () => {
  it('por defecto es `config/operativos.json#pasoDesviacionMetros`, no un 0,3 escrito a mano', () => {
    const porDefecto = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO())
    const explicito = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO(), {
      pasoMetros: OPERATIVOS.pasoDesviacionMetros,
    })
    expect(porDefecto).toEqual(explicito)
  })

  it('un paso más fino cuesta más muestras y da el mismo máximo', () => {
    const fino = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO(), { pasoMetros: 0.05 })
    expect(fino.nMuestras).toBeGreaterThan(136)
    expect(fino.maxima.maxima).toBeCloseTo(0.4, 12)
    expect(fino.maxima.indice).toBe(2)
  })

  it('un paso GROSERO SUBESTIMA el máximo: es la cota paso/2 de la cabecera', () => {
    // Con paso 20 m, ningún lado de 10 m recibe más que sus dos extremos — y en
    // este fixture los extremos del lado movido están sobre el contorno oficial,
    // así que la desviación medida cae a 0 aunque el lado esté a 0,40 m. No es un
    // fallo, es el precio del muestreo, y está acotado: d(·) es 1-Lipschitz, así
    // que el máximo muestreado nunca subestima el continuo en más de paso/2.
    // Documentarlo con un test es lo que impide que alguien «optimice» el paso.
    const grosero = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO(), { pasoMetros: 20 })
    expect(grosero.nMuestras).toBe(8) // 2 muestras × 4 lados
    expect(grosero.maxima.maxima).toBeCloseTo(0, 12)

    // Con paso 5 m ya hay una muestra en el centro del lado y el 0,40 aparece.
    const medio = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO(), { pasoMetros: 5 })
    expect(medio.maxima.maxima).toBeCloseTo(0.4, 12)
    expect(medio.maxima.indice).toBe(2)
  })
})

// ── Datos degenerados: se describen, no revientan ────────────────────────────

describe('diagnostico/desviacion.js · geometría degenerada del usuario', () => {
  it('un recinto medido de menos de 3 vértices no aporta lados y no lanza', () => {
    const medido = [
      ...MEDIDO_NORTE_METIDO(),
      { vertices: [[1, 1], [2, 2]], tipo: 'HUECO' },
    ]
    const r = desviacionPorLado(medido, OFICIAL_CUADRADO())
    expect(r.porLado.map((e) => e.recinto)).toEqual([0, 0, 0, 0])
    expect(r.nMuestras).toBe(136)
  })

  it('un vértice con NaN quita SUS DOS lados y deja medir el resto', () => {
    // Mismo criterio que `edit/snap.js`: un vértice roto en el store es dato
    // posible del usuario (lo señala F02), y no puede impedir diagnosticar el
    // resto de la parcela. El anillo [3,3] [NaN,3] [3,4] pierde los lados 0 y 1 y
    // conserva el 2 ([3,4]→[3,3], de 1 m).
    const medido = [
      ...MEDIDO_NORTE_METIDO(),
      { vertices: [[3, 3], [NaN, 3], [3, 4]], tipo: 'HUECO' },
    ]
    const r = desviacionPorLado(medido, OFICIAL_CUADRADO())
    expect(r.porLado.filter((e) => e.recinto === 1).map((e) => e.indice)).toEqual([2])
    expect(r.nMuestras).toBe(141) // 136 + 5 muestras del lado de 1 m
  })

  it('un lado degenerado (dos vértices coincidentes) se mide sin dividir por cero', () => {
    const medido = [
      {
        vertices: [
          [0, 0],
          [10, 0],
          [10, 9.6],
          [10, 9.6], // duplicado
          [0, 9.6],
        ],
        tipo: 'EXTERIOR',
      },
    ]
    const r = desviacionPorLado(medido, OFICIAL_CUADRADO())
    expect(r.porLado).toHaveLength(5)
    for (const e of r.porLado) expect(Number.isFinite(e.maxima)).toBe(true)
    // El lado de longitud 0 recibe sus «dos extremos», que son el mismo punto.
    expect(r.porLado[2].maxima).toBeCloseTo(0, 12)
  })
})

// ── Contrato: lo que lanza y lo que no ───────────────────────────────────────

describe('diagnostico/desviacion.js · contrato del llamante (regla de oro 1)', () => {
  it('`recintos` que no es array ⇒ TypeError que lo nombra', () => {
    expect(() => desviacionPorLado(null, OFICIAL_CUADRADO())).toThrow(TypeError)
    expect(() => desviacionPorLado(null, OFICIAL_CUADRADO())).toThrow(/'recintos'/)
  })

  it('OLVIDAR el contorno oficial lanza; decir `null` no', () => {
    // La distinción es el módulo entero: «no hay oficial» hay que decirlo.
    expect(() => desviacionPorLado(MEDIDO_NORTE_METIDO())).toThrow(/'recintosOficiales'/)
    expect(() => desviacionPorLado(MEDIDO_NORTE_METIDO(), null)).not.toThrow()
  })

  it('`opciones` que no es objeto ⇒ TypeError (el paso se perdería en silencio)', () => {
    expect(() => desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO(), 0.5)).toThrow(
      TypeError,
    )
  })

  it('`pasoMetros` no positivo o no finito ⇒ TypeError', () => {
    for (const malo of [0, -1, NaN, Infinity, '0.3', null]) {
      expect(() =>
        desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO(), { pasoMetros: malo }),
      ).toThrow(/pasoMetros/)
    }
  })
})

// ── Regla de oro 9 y regla de oro 2 ──────────────────────────────────────────

describe('diagnostico/desviacion.js · mide y no juzga, lee y no toca', () => {
  it('devuelve EXACTAMENTE tres claves y ninguna es un veredicto', () => {
    const r = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO())
    expect(Object.keys(r).sort()).toEqual(['maxima', 'nMuestras', 'porLado'])
    expect(Object.keys(r.porLado[0]).sort()).toEqual([
      'en',
      'enOficial',
      'indice',
      'maxima',
      'recinto',
    ])
  })

  it('en NINGUNA clave, a ninguna profundidad, aparece un juicio de valor', () => {
    const r = desviacionPorLado(MEDIDO_NORTE_METIDO(), OFICIAL_CUADRADO())
    const claves = clavesProfundas(r)
    for (const prohibida of [
      'ok',
      'valido',
      'válido',
      'dentroDeTolerancia',
      'dentroDeMargen',
      'tolerancia',
      'umbral',
      'nivel',
      'color',
      'semaforo',
      'apta',
      'veredicto',
    ]) {
      expect(claves).not.toContain(prohibida)
    }
  })

  it('no muta las entradas: con los dos argumentos CONGELADOS en profundidad, mide igual', () => {
    // Regla de oro 2: `geometriaOficial` es el término de comparación y se
    // conserva intacta. Congelado en profundidad, cualquier escritura lanzaría.
    const medido = congelar(MEDIDO_NORTE_METIDO())
    const oficial = congelar(OFICIAL_CUADRADO())
    const antes = JSON.stringify([medido, oficial])

    const r = desviacionPorLado(medido, oficial)

    expect(r.maxima.maxima).toBeCloseTo(0.4, 12)
    expect(JSON.stringify([medido, oficial])).toBe(antes)
  })

  it('ningún punto devuelto comparte referencia con un vértice de la entrada', () => {
    const medido = MEDIDO_NORTE_METIDO()
    const oficial = OFICIAL_CUADRADO()
    const r = desviacionPorLado(medido, oficial)
    const entrada = [...medido[0].vertices, ...oficial[0].vertices]
    for (const e of r.porLado) {
      expect(entrada).not.toContain(e.en)
      expect(entrada).not.toContain(e.enOficial)
    }
  })
})

// ── Coste: se MIDE, y el descarte no cambia el resultado ─────────────────────

describe('diagnostico/desviacion.js · coste en el techo de maxVertices', () => {
  /** Anillo de `n` vértices y radio `r`: lado ≈ 2·r·sin(π/n). */
  const anillo = (cx, cy, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
    })

  // El peor caso que razona el JSDoc de `config/operativos.js`: un recinto en el
  // techo de `maxVertices` (500) con lados del orden de 30 m ⇒ perímetro ≈ 15 km,
  // ~50.760 muestras contra 500 segmentos oficiales. En UTM real, para que la
  // medida se tome sobre las coordenadas que el programa va a ver de verdad.
  const N = OPERATIVOS.maxVertices
  const R = 15 / Math.sin(Math.PI / N) // ⇒ lado = 30 m exactos
  const MEDIDO = () => [{ vertices: anillo(373000, 4070000, R, N), tipo: 'EXTERIOR' }]
  const OFICIAL = () => [{ vertices: anillo(373000, 4070000, R - 0.4, N), tipo: 'EXTERIOR' }]

  // ⏱️ TIMEOUT EXPLÍCITO, y es una decisión. Este test hace las 25.380.000
  // proyecciones del camino ingenuo a propósito, así que tarda ~7 s y se pasaba de
  // los 5 s por defecto de Vitest. Las tres salidas posibles eran: bajar `N` (y
  // entonces el descarte se demuestra donde no aprieta), medirlo una vez y dejar
  // la cifra en un comentario (una afirmación que nadie vuelve a comprobar: lo que
  // este proyecto llama un guardián que no dispara), o pagar los 7 s. Se pagan:
  // que el descarte por caja envolvente no se salte el mínimo verdadero es la
  // propiedad de la que depende TODA la métrica de desviación, y es exactamente el
  // tipo de fallo que sale plausible —un máximo un poco menor del real— y no
  // reventando. El coste está acotado y va una vez por `npm test`.
  it('el resultado es IDÉNTICO al del cálculo ingenuo, lado por lado', () => {
    // Ésta es la prueba que de verdad importa del descarte: no que sea rápido,
    // sino que descartar por caja envolvente no se salte el mínimo verdadero.
    const conDescarte = desviacionPorLado(MEDIDO(), OFICIAL())
    const sinDescarte = ingenuo(MEDIDO(), OFICIAL())

    expect(conDescarte.nMuestras).toBe(sinDescarte.nMuestras)
    expect(conDescarte.porLado).toHaveLength(N)
    for (let i = 0; i < N; i++) {
      expect(conDescarte.porLado[i].maxima).toBe(sinDescarte.porLado[i].maxima)
      expect(conDescarte.porLado[i].en).toEqual(sinDescarte.porLado[i].en)
    }
    expect(conDescarte.maxima.maxima).toBe(sinDescarte.maxima.maxima)
    // Anillo desplazado 0,40 m en radio: la desviación es 0,40 en todo el contorno.
    expect(conDescarte.maxima.maxima).toBeCloseTo(0.4, 6)
  }, 30_000)

  it('el descarte deja el coste en ~1 proyección por muestra en vez de 500', () => {
    espia.proyecciones = 0
    const r = desviacionPorLado(MEDIDO(), OFICIAL())
    const proyecciones = espia.proyecciones

    expect(r.nMuestras).toBe(50760)

    // Sin descarte serían nMuestras × 500 = 25.380.000 proyecciones. Medido con
    // los dos descartes: 52.352, o sea 1,03 por muestra. Se exige < 3 por muestra
    // —no la cifra exacta— porque el recuento depende del último bit de
    // `Math.cos`, que no está garantizado idéntico entre versiones del motor; el
    // margen sigue descartando cualquier vuelta al bucle cuadrático, que daría 500.
    expect(proyecciones).toBeGreaterThanOrEqual(r.nMuestras) // al menos la semilla
    expect(proyecciones).toBeLessThan(3 * r.nMuestras)
    expect(proyecciones).toBeLessThan(r.nMuestras * 500 / 100)
  })

  it('y en tiempo: el ingenuo tarda más de 5 veces lo que el módulo', () => {
    // Medido sin el contador de este fichero: 1.160 ms el ingenuo contra 67 ms el
    // módulo (×17). Se exige ×5 y un techo absoluto generoso para que el test no
    // sea un cronómetro caprichoso pero siga cayendo si vuelve el bucle
    // cuadrático. El diagnóstico se dispara UNA vez por acción, no por fotograma.
    const t0 = performance.now()
    desviacionPorLado(MEDIDO(), OFICIAL())
    const msModulo = performance.now() - t0

    const t1 = performance.now()
    ingenuo(MEDIDO(), OFICIAL())
    const msIngenuo = performance.now() - t1

    expect(msModulo).toBeLessThan(2000)
    expect(msIngenuo).toBeGreaterThan(5 * msModulo)
    // Mismo timeout explícito y misma razón que el test de equivalencia de arriba:
    // este test EJECUTA el camino ingenuo a propósito, así que su coste es el que
    // está midiendo. La cifra del comentario (1.160 ms) se midió en una máquina
    // descargada; con la suite en paralelo sube, y el test sigue valiendo porque lo
    // que exige es una RAZÓN entre los dos, no un cronómetro absoluto.
  }, 30_000)
})
