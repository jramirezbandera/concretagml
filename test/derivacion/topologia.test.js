/* -------------------------------------------------------------------------- *
 * test/derivacion/topologia.test.js — F17 · tarea 1.2                          *
 *                                                                              *
 * `derivacion/topologia.js` es el ÚNICO fichero de F17 que importa Turf, y el   *
 * sitio donde nace el SOBRANTE: `restar(oficial, editada)` da los trozos que la *
 * parcela suelta al encogerse, que son las parcelas que el expediente tiene que *
 * aportar además de la propia.                                                  *
 *                                                                              *
 * Lo que este fichero defiende, por orden de importancia:                       *
 *                                                                              *
 *   1. ⛔ **QUE `[]` NO SIGNIFIQUE DOS COSAS.** «No hay sobrante» y «no se pudo  *
 *      medir» son respuestas OPUESTAS, y devolver una lista vacía en las dos    *
 *      sería el error silencioso peor de todos, porque **el 0 tranquiliza**: el *
 *      usuario leería «no hay que ceder nada» donde lo cierto es «no lo         *
 *      sabemos». Es el mismo contrato que `diagnostico/topologia.js` fijó en    *
 *      F07 y ésta es su segunda aplicación.                                     *
 *   2. ⛔ **QUE UN FALLO DEL MOTOR SALGA POR `saltados`, NO POR LA CONSOLA.**    *
 *      Se comprueba con `@turf/difference` DOBLADO para que lance, porque       *
 *      esperar a encontrar una geometría que lo tumbe sería no comprobarlo.     *
 *   3. Que las piezas salgan SEPARADAS: el sobrante de una parcela editada casi *
 *      nunca es un trozo, y quedarse con uno es el error que `geo/poligono.js`  *
 *      documenta en su cabecera (12 m² presentados como 7).                     *
 *   4. Que la geometría de entrada no se toque (regla de oro 2) y que el área   *
 *      la mida `geo/area.js`, nunca Turf (regla de oro 5).                      *
 *   5. El guardián de la capa: de Turf, SOLO lo topológico y por subpaquete.    *
 *                                                                              *
 * Proyecto Vitest `node`: aritmética y Turf, sin DOM.                           *
 * -------------------------------------------------------------------------- */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'

import { restar } from '../../derivacion/topologia.js'
import { MOTIVO_RESTA, SEVERIDAD, TIPO_DERIVACION } from '../../derivacion/_comun.js'
import { superficie } from '../../geo/area.js'
import { medirPieza } from '../../geo/grosor.js'
import { MOTIVO_REGION } from '../../geo/poligono.js'
import { TIPO_RECINTO } from '../../model/parcela.js'

const RAIZ = join(import.meta.dirname, '..', '..')

/** Rectángulo ANTIHORARIO como `recintos` del modelo (anillo ABIERTO). */
const rect = (x0, y0, x1, y1) => [
  {
    vertices: [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    tipo: TIPO_RECINTO.EXTERIOR,
  },
]

/** Recinto suelto (para componer regiones con huecos). */
const anillo = (x0, y0, x1, y1, tipo) => ({
  vertices: [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ],
  tipo,
})

const clon = (v) => JSON.parse(JSON.stringify(v))
const tipos = (dets) => dets.map((d) => d.tipo)

// ── 1 · La resta que da el sobrante ──────────────────────────────────────────

describe('derivacion/topologia · restar() produce el sobrante', () => {
  it('un lindero movido hacia dentro deja UNA franja, con su superficie exacta', () => {
    // Parcela de 20×10 que pierde una franja de 2 m en su lado derecho.
    const oficial = rect(0, 0, 20, 10)
    const editada = rect(0, 0, 18, 10)
    const { piezas, saltados, detecciones } = restar(oficial, editada)

    expect(piezas).toHaveLength(1)
    expect(saltados).toEqual([])
    expect(detecciones).toEqual([])
    // 2 × 10 = 20 m², calculado a mano y medido con el shoelace del proyecto.
    expect(superficie(piezas[0])).toBeCloseTo(20, 9)
    expect(medirPieza(piezas[0]).grosor).toBeCloseTo((2 * 20) / 24, 9)
  })

  it('⭐ dos linderos opuestos dejan DOS piezas separadas, no una suma', () => {
    // Es el caso normal, no el raro: quedarse con una sola pieza presentaría 20 m²
    // donde hay 40 repartidos en dos sitios del terreno, que es el error que
    // `geo/poligono.js` documenta en su cabecera.
    const { piezas } = restar(rect(0, 0, 20, 10), rect(2, 0, 18, 10))
    expect(piezas).toHaveLength(2)
    const areas = piezas.map((p) => superficie(p)).sort((a, b) => a - b)
    expect(areas[0]).toBeCloseTo(20, 9)
    expect(areas[1]).toBeCloseTo(20, 9)
  })

  it('⭐ encoger por los CUATRO lados deja UNA pieza con hueco: el sobrante anular', () => {
    // El caso que F17 convierte en normal y que F07 daba por patológico. La pieza
    // sale con su hueco dentro, y `geo/grosor.js` la mide bien: `2A/P = h` exacto.
    const { piezas } = restar(rect(0, 0, 100, 100), rect(1, 1, 99, 99))
    expect(piezas).toHaveLength(1)
    expect(piezas[0].length).toBe(2)
    expect(piezas[0][0].tipo).toBe(TIPO_RECINTO.EXTERIOR)
    expect(piezas[0][1].tipo).toBe(TIPO_RECINTO.HUECO)
    expect(superficie(piezas[0])).toBeCloseTo(100 * 100 - 98 * 98, 6)
    expect(medirPieza(piezas[0]).grosor).toBeCloseTo(1, 9)
  })

  it('respeta los HUECOS del minuendo: un patio no es superficie que se ceda', () => {
    // La región es EXTERIOR menos HUECOS. Si el patio no contara, el sobrante
    // incluiría terreno que la parcela no tiene.
    const conPatio = [
      anillo(0, 0, 20, 10, TIPO_RECINTO.EXTERIOR),
      anillo(18.5, 4, 19.5, 6, TIPO_RECINTO.HUECO),
    ]
    const { piezas } = restar(conPatio, rect(0, 0, 18, 10))
    // La franja de 2×10 menos el trozo de patio que cae dentro (1×2).
    expect(superficie(piezas.flatMap((p) => [p]).reduce((a, b) => a.concat(b), []))).toBeGreaterThan(
      0,
    )
    const total = piezas.reduce((s, p) => s + superficie(p), 0)
    expect(total).toBeCloseTo(20 - 2, 6)
  })

  it('⛔ la geometría de entrada NO se toca (regla de oro 2)', () => {
    // `polygon()` de Turf guarda el array POR REFERENCIA; lo que corta la referencia
    // viva es `anilloCerrado`, que copia siempre. Aquí se comprueba con un clon.
    const oficial = rect(0, 0, 20, 10)
    const editada = rect(0, 0, 18, 10)
    const antesA = clon(oficial)
    const antesB = clon(editada)
    restar(oficial, editada)
    expect(oficial).toEqual(antesA)
    expect(editada).toEqual(antesB)
  })
})

// ── 2 · ⛔ `[]` no puede significar dos cosas ─────────────────────────────────

describe('derivacion/topologia · ⛔ el 0 tranquiliza, así que no puede ser ambiguo', () => {
  it('SIN SOBRANTE: piezas vacías, saltados vacíos, y una detección que lo DICE', () => {
    // La parcela editada coincide con la oficial. Es la respuesta correcta y
    // tranquilizadora, y viene ETIQUETADA para no confundirse con la otra.
    const { piezas, saltados, detecciones } = restar(rect(0, 0, 10, 10), rect(0, 0, 10, 10))
    expect(piezas).toEqual([])
    expect(saltados).toEqual([])
    expect(tipos(detecciones)).toEqual([TIPO_DERIVACION.SIN_SOBRANTE])
    expect(detecciones[0].severidad).toBe(SEVERIDAD.INFO)
  })

  it('NO SE PUDO MEDIR (minuendo degenerado): piezas vacías pero con ERROR y motivo', () => {
    // Un exterior de dos vértices no forma anillo. Devolver `[]` a secas diría «no
    // hay que ceder nada» donde lo cierto es «no se ha podido mirar».
    const degenerada = [{ vertices: [[0, 0], [1, 1]], tipo: TIPO_RECINTO.EXTERIOR }]
    const { piezas, saltados, detecciones } = restar(degenerada, rect(0, 0, 10, 10))
    expect(piezas).toEqual([])
    expect(saltados).toHaveLength(1)
    expect(saltados[0]).toMatchObject({
      donde: 'recintosA',
      indice: 0,
      nVertices: 2,
      motivo: MOTIVO_REGION.EXTERIOR_NO_APTO,
    })
    expect(tipos(detecciones)).toEqual([TIPO_DERIVACION.REGION_NO_APTA])
    expect(detecciones[0].severidad).toBe(SEVERIDAD.ERROR)
    expect(detecciones[0].mensaje).toMatch(/no se ha podido medir/i)
  })

  it('⛔ y el SUSTRAENDO degenerado se para en vez de devolver la parcela entera', () => {
    // Sin sustraendo la resta daría como sobrante TODA la parcela: una cifra falsa
    // y alarmante que el usuario leería como un dato. Se para y se dice.
    const degenerada = [{ vertices: [[0, 0], [1, 1]], tipo: TIPO_RECINTO.EXTERIOR }]
    const { piezas, saltados, detecciones } = restar(rect(0, 0, 10, 10), degenerada)
    expect(piezas).toEqual([])
    expect(saltados[0].donde).toBe('recintosB')
    expect(tipos(detecciones)).toEqual([TIPO_DERIVACION.REGION_NO_APTA])
    expect(detecciones[0].mensaje).toMatch(/parcela entera/i)
  })

  it('una lista vacía de recintos también sale por `saltados`, no por silencio', () => {
    const { piezas, saltados } = restar([], rect(0, 0, 10, 10))
    expect(piezas).toEqual([])
    expect(saltados[0]).toMatchObject({ donde: 'recintosA', motivo: MOTIVO_REGION.SIN_RECINTOS })
  })

  it('un HUECO no apto no impide la resta, pero se dice que la región salió mayor', () => {
    // La región SÍ se puede construir sin ese hueco; lo que no se puede es callarlo,
    // porque el sobrante sale por exceso en la superficie del hueco perdido.
    const conHuecoRoto = [
      anillo(0, 0, 20, 10, TIPO_RECINTO.EXTERIOR),
      { vertices: [[5, 5], [6, 6]], tipo: TIPO_RECINTO.HUECO },
    ]
    const { piezas, saltados } = restar(conHuecoRoto, rect(0, 0, 18, 10))
    expect(piezas).toHaveLength(1)
    expect(saltados).toHaveLength(1)
    expect(saltados[0].motivo).toBe(MOTIVO_REGION.HUECO_NO_APTO)
  })

  it('⛔ LANZA solo si el llamante pasa algo que no es una lista: eso es un bug', () => {
    // La frontera entre «dato malo del usuario» (detección) y «contrato roto»
    // (excepción), que es la misma que traza `geo/poligono.js`.
    expect(() => restar(null, rect(0, 0, 1, 1))).toThrow(TypeError)
    expect(() => restar(rect(0, 0, 1, 1), 'nada')).toThrow(TypeError)
  })
})

// ── 3 · ⛔ El motor booleano puede lanzar, y no puede tumbar la aplicación ────

describe('derivacion/topologia · un fallo de Turf sale por `saltados`', () => {
  it('⛔ si `@turf/difference` LANZA, se recoge con su motivo y su mensaje', async () => {
    // Se DOBLA el motor para que lance: esperar a encontrar la geometría que lo
    // tumbe sería no comprobarlo nunca. `polyclip-ts` —el motor de barrido que hay
    // debajo— puede caerse con anillos que pasan el conteo de vértices y se cruzan
    // consigo mismos, y eso tiene que salir por el canal del usuario y no por la
    // consola, donde no mira nadie.
    vi.resetModules()
    vi.doMock('@turf/difference', () => ({
      default: () => {
        throw new Error('Unable to complete output ring')
      },
    }))
    const { restar: restarConMotorRoto } = await import('../../derivacion/topologia.js')

    const { piezas, saltados, detecciones } = restarConMotorRoto(
      rect(0, 0, 20, 10),
      rect(0, 0, 18, 10),
    )
    expect(piezas).toEqual([])
    expect(saltados).toHaveLength(1)
    expect(saltados[0]).toMatchObject({ donde: 'restar', motivo: MOTIVO_RESTA.MOTOR_BOOLEANO })
    expect(tipos(detecciones)).toEqual([TIPO_DERIVACION.RESTA_FALLIDA])
    expect(detecciones[0].severidad).toBe(SEVERIDAD.ERROR)
    // El mensaje del motor viaja en `datos`, para poder investigarlo; el que lee el
    // usuario habla de su parcela, no de anillos de salida.
    expect(detecciones[0].datos.error).toContain('Unable to complete output ring')
    expect(detecciones[0].mensaje).toMatch(/contorno que se cruza consigo mismo/i)

    vi.doUnmock('@turf/difference')
    vi.resetModules()
  })
})

// ── 4 · El guardián de la capa ───────────────────────────────────────────────

describe('derivacion/topologia.js · guardián: de Turf, SOLO lo topológico (regla 6)', () => {
  const FUENTE = readFileSync(join(RAIZ, 'derivacion', 'topologia.js'), 'utf8')

  /** Subpaquetes de Turf importados por un texto fuente, en orden y sin repetir. */
  const turfImportado = (texto) => [
    ...new Set([...texto.matchAll(/from\s+'(@turf\/[\w-]+|turf)'/g)].map((m) => m[1])),
  ]

  it('importa EXACTAMENTE `@turf/difference` y `@turf/helpers`, por subpaquete', () => {
    expect(turfImportado(FUENTE).sort()).toEqual(['@turf/difference', '@turf/helpers'])
  })

  it('el detector SÍ dispara (mitad anti-vacuidad del guardián)', () => {
    expect(turfImportado("import area from '@turf/area'\n")).toEqual(['@turf/area'])
    expect(turfImportado("import * as t from 'turf'\n")).toEqual(['turf'])
  })

  it('⛔ no mide NADA: el área la da `geo/area.js`, nunca Turf (regla de oro 5)', () => {
    // Sobre coordenadas UTM, `turf.area` daría el área GEODÉSICA: un número
    // plausible y distinto justo del tamaño de lo que esta fase mide.
    expect(FUENTE).not.toMatch(/@turf\/(area|length|distance|centroid|center)/)
    expect(FUENTE).not.toMatch(/\barea\s*\(/)
  })

  it('es el ÚNICO fichero de `derivacion/` que importa Turf', () => {
    // Lo que permite que este guardián sea una línea de regex y no una lista de
    // excepciones. ⚠️ La lista NO se escribe a mano: se LEE del directorio, porque
    // una lista escrita se queda corta en cuanto la capa crece —pasó en la fase 2,
    // que le añadió `cesion.js` e `identidad.js`— y quedarse corta aquí significa
    // dar verde sobre un fichero que nadie mira.
    const hermanos = readdirSync(join(RAIZ, 'derivacion')).filter(
      (n) => n.endsWith('.js') && n !== 'topologia.js',
    )
    expect(hermanos.length, 'la capa tiene que tener más ficheros que topologia.js').toBeGreaterThan(
      1,
    )
    for (const nombre of hermanos) {
      const otro = readFileSync(join(RAIZ, 'derivacion', nombre), 'utf8')
      expect(turfImportado(otro), `derivacion/${nombre} importa Turf`).toEqual([])
    }
  })

  it('⛔ NO sale por el barrel de la capa, igual que su hermano de F07', () => {
    // `restar()` devuelve geometría SIN interpretar. Quien sabe qué significa es
    // `cesion.js`; exportarla invitaría a repartir esa interpretación por la
    // interfaz, que es lo que esta capa existe para concentrar.
    // ⚠️ Se miran los `export`, NO las menciones: el barrel NOMBRA a `topologia.js`
    // en su cabecera precisamente para explicar por qué lo deja fuera, y un
    // detector que acusara por citarlo obligaría a borrar la explicación para pasar
    // el test. Es el mismo defecto que tenía el guardián de `geo/poligono.js` —que
    // acusaba a cualquier línea con `export` y una comilla— y se arregla igual:
    // mirando lo que la línea HACE.
    const barrel = readFileSync(join(RAIZ, 'derivacion', 'index.js'), 'utf8')
    // El `export { … } from '…'` de este barrel ocupa VARIAS líneas, así que el
    // detector no puede parar en el primer salto: la primera versión de esta prueba
    // daba «cero reexports» sobre un fichero que tiene uno, o sea verde por ciega.
    const exportaDe = (texto) => [
      ...texto.matchAll(/(?:^|\n)[ \t]*export[\s\S]*?\bfrom[ \t]+['"]([^'"]+)['"]/g),
    ].map((m) => m[1])
    // Lo que importa NO es la lista exacta —la capa crece— sino que `topologia.js`
    // no esté en ella y que la lista no esté vacía.
    expect(exportaDe(barrel).length).toBeGreaterThan(0)
    expect(exportaDe(barrel)).not.toContain('./topologia.js')
    // Anti-vacuidad: el detector ve un reexport si lo hay.
    expect(exportaDe("export { restar } from './topologia.js'\n")).toEqual(['./topologia.js'])
    // Y `restar` no se nombra como símbolo exportado por ninguna vía.
    expect(barrel).not.toMatch(/export[^\n]*\brestar\b/)
  })
})
