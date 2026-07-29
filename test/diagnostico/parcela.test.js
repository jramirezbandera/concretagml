/* -------------------------------------------------------------------------- *
 * test/diagnostico/parcela.test.js — F07 · T3.1 · El orquestador             *
 *                                                                            *
 * `diagnostico/parcela.js` COMPONE; no calcula. Así que este fichero prueba   *
 * tres cosas y no una:                                                       *
 *                                                                            *
 *   1. Que compone BIEN: cada cifra coincide, al último bit, con la que da el *
 *      módulo del que sale. Si algún día alguien reimplementa aquí una        *
 *      superficie o un perímetro «para no llamar», estos tests lo cazan —     *
 *      porque una segunda implementación es una segunda verdad, y la que se   *
 *      pinta no puede discrepar de la que se serializa en el GML.            *
 *   2. Que los TRES sabores de «no hay» no se confunden entre ellos: sección  *
 *      a `null` + omisión, `invasion.consultado: false`, y un número a `null` *
 *      dentro de una sección.                                                *
 *   3. Que NO JUZGA (regla de oro 9), afirmado recorriendo el objeto REAL y   *
 *      no una lista de claves escrita a mano.                                *
 *                                                                            *
 * Los datos son los REALES: la parcela 9398516VK3799G y sus cuatro           *
 * colindantes del WFS, sin tocar un vértice. Las cifras esperadas están       *
 * medidas o calculadas a mano, nunca copiadas de la salida de la función.    *
 *                                                                            *
 * Proyecto Vitest `node`: aritmética, sin DOM.                               *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { OMISION, diagnosticar } from '../../diagnostico/parcela.js'
import { bandas } from '../../diagnostico/bandas.js'
import { desviacionPorLado } from '../../diagnostico/desviacion.js'
import { CLASE, ETIQUETA, claseDeducidaDe } from '../../diagnostico/margen.js'
import { invasiones, solape } from '../../diagnostico/topologia.js'
import { superficie } from '../../geo/area.js'
import { centroide } from '../../geo/centroide.js'
import { distancia, perimetro } from '../../geo/metrica.js'
import { parsearGml } from '../../gml/parse.js'

const RAIZ = join(import.meta.dirname, '..', '..')

/** Recintos de un rectángulo, anillo ABIERTO como los quiere el modelo. */
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

/** Clon profundo por JSON: vale porque el modelo es POJO plano (regla de oro 4). */
const clon = (v) => JSON.parse(JSON.stringify(v))

// ── El fixture REAL ─────────────────────────────────────────────────────────

const PARSEADO = parsearGml(
  readFileSync(
    join(RAIZ, 'test', 'fixtures', 'catastro', 'wfs-neighbour-9398516VK3799G.xml'),
    'utf8',
  ),
)

const REF_PROPIA = '9398516VK3799G'
const comoVecina = (p) => ({ refcat: p.refcat, recintos: p.recintos })
const TODAS = PARSEADO.parcelas.map(comoVecina)
const PROPIA = TODAS.find((v) => v.refcat === REF_PROPIA)
const VECINAS = TODAS.filter((v) => v.refcat !== REF_PROPIA)

/** La geometría OFICIAL de la parcela. Se clona en cada uso: regla de oro 2. */
const oficial = () => clon(PROPIA.recintos)

/**
 * La geometría EDITADA: la oficial con su primer vértice —el
 * `[439283.23, 4479671.27]` del fixture— movido **0,40 m al este**.
 *
 * Es una edición de UN vértice y produce las ocho métricas a la vez, lo que la hace
 * el caso completo ideal. Lo que no es obvio, y por eso está medido y escrito aquí:
 * **ese vértice tiene los dos lados contiguos largos**, así que moverlo 0,40 m barre
 * un triángulo de **3,124 m²** hacia FUERA del contorno oficial. Consecuencias, todas
 * comprobadas abajo:
 *   · la superficie sube de 1535,865 a **1538,989 m²**;
 *   · el contorno editado CONTIENE al oficial, así que el solape es el oficial
 *     entero y el relativo sale **0,99797** (no 1: la referencia es la mayor de las
 *     dos, y la mayor ahora es la editada);
 *   · el triángulo barrido entra en **TRES colindantes** —0,23, 0,25 y 2,64 m²—, o
 *     sea que este fixture produce **invasiones de verdad**, no astillas.
 *
 * Esto último contradice lo que este fichero suponía al escribirse («mover un
 * vértice 0,40 m no invade a nadie»). Se anota porque es el dato: en una parcela
 * real, con vecinas reales, cuatro decímetros en el vértice equivocado son un
 * expediente rechazado.
 */
function editada() {
  const r = clon(PROPIA.recintos)
  r[0].vertices[0] = [r[0].vertices[0][0] + 0.4, r[0].vertices[0][1]]
  return r
}

// Cifras del expediente real. La DECLARADA es entera (override O6) y la que mide
// nuestra shoelace sobre las coordenadas del propio WFS no lo es: ésos son los
// −0,13 m² que prueban que la app mide en vez de repetir.
const DECLARADA = 1536
const OFICIAL_MEDIDA = 1535.865149996761
const REGISTRAL = 1500

// Medidas el 2026-07-29 sobre `editada()`, escritas aquí para que un cambio de
// comportamiento salga como un rojo y no como un número distinto.
const EDITADA_MEDIDA = 1538.989149996965
const BARRIDO = 3.1240000002044326 // el triángulo que barre el vértice al moverse

describe('diagnostico/parcela.js · el caso completo: parcela real editada', () => {
  const d = diagnosticar({
    recintos: editada(),
    geometriaOficial: oficial(),
    superficieCatastral: DECLARADA,
    superficieRegistral: REGISTRAL,
    vecinas: VECINAS,
    refcat: REF_PROPIA,
  })

  it('devuelve exactamente las once secciones del contrato, y ninguna más', () => {
    // Forma EXACTA y no «contiene»: es lo que hace que añadir una sección (o un
    // `{ok: true}`) salga rojo aquí en vez de pasar desapercibido.
    expect(Object.keys(d).sort()).toEqual([
      'bandas',
      'centroides',
      'desviacion',
      'diferencia',
      'invasion',
      'margen',
      'omisiones',
      'perimetro',
      'saltados',
      'solape',
      'superficie',
    ])
  })

  it('las cifras del caso completo, medidas', () => {
    // Todas juntas, para que se lean como el cuadro que el cajón va a pintar.
    expect(d.superficie.medida).toBeCloseTo(EDITADA_MEDIDA, 9)
    expect(d.solape.area).toBeCloseTo(OFICIAL_MEDIDA, 9)
    expect(d.solape.relativo).toBeCloseTo(0.9979700961503137, 12)
    expect(d.diferencia.area).toBeCloseTo(BARRIDO, 9)
    expect(d.centroides.distancia).toBeCloseTo(0.05811627599224666, 12)
    expect(d.desviacion.maxima.maxima).toBeCloseTo(0.4, 9)
    expect(d.desviacion.nMuestras).toBe(570)
  })

  it('la desviación máxima se atribuye AL LADO que se ha movido', () => {
    // §10.5 resalta un lindero en el dibujo, así que equivocar el lado es peor que
    // equivocar la cifra en un milímetro. El vértice movido es el 0, y el lado 0 es
    // el que arranca en él.
    expect(d.desviacion.maxima.recinto).toBe(0)
    expect(d.desviacion.maxima.indice).toBe(0)
  })

  it('el contorno editado CONTIENE al oficial, y por eso el relativo no es 1', () => {
    // El vértice se movió hacia fuera: el solape es el oficial ENTERO. El relativo
    // sale 0,998 porque la referencia es la MAYOR de las dos superficies, y la mayor
    // ya es la editada. Si la referencia fuera la menor saldría 1,000 — «encajan
    // perfectamente» — teniendo 3,12 m² de más. Ésa es la lectura que la elección
    // de «la mayor» (spec §10.1) evita.
    expect(d.solape.area).toBeCloseTo(OFICIAL_MEDIDA, 9)
    expect(d.solape.relativo).toBeLessThan(1)
    expect(d.solape.area / Math.min(d.superficie.medida, d.superficie.oficial)).toBeCloseTo(1, 9)
  })

  it('con todo el dato disponible NO hay ninguna omisión', () => {
    expect(d.omisiones).toEqual([])
    expect(d.saltados).toEqual([])
  })

  it('las DOS superficies del parcelario salen por separado y no coinciden', () => {
    // El punto de todo el feature: 1536 es lo que el Catastro DECLARA y
    // 1535,865… lo que NUESTRA fórmula mide sobre las coordenadas que él emite.
    // Confundirlas sería atribuir al Catastro una medición nuestra.
    expect(d.superficie.catastral).toBe(DECLARADA)
    expect(d.superficie.oficial).toBeCloseTo(OFICIAL_MEDIDA, 9)
    expect(d.superficie.catastral).not.toBe(d.superficie.oficial)
    expect(d.superficie.catastral - d.superficie.oficial).toBeCloseTo(0.134850003239, 9)
  })

  it('la superficie medida es la de `geo/area.js`, al último bit', () => {
    expect(d.superficie.medida).toBe(superficie(editada()))
  })

  it('la registral llega tal cual, sin tocarla', () => {
    expect(d.superficie.registral).toBe(REGISTRAL)
  })
})

describe('diagnostico/parcela.js · compone, no calcula', () => {
  const entrada = {
    recintos: editada(),
    geometriaOficial: oficial(),
    superficieCatastral: DECLARADA,
    superficieRegistral: REGISTRAL,
    vecinas: VECINAS,
    refcat: REF_PROPIA,
  }
  const d = diagnosticar(entrada)

  it('los perímetros son los de `geo/metrica.js#perimetro`, desglosados', () => {
    expect(d.perimetro.medido).toEqual(perimetro(editada()))
    expect(d.perimetro.oficial).toEqual(perimetro(oficial()))
    // Desglosados en tres y no un número: la tolerancia oficial de identidad se
    // refiere al EXTERIOR (SPEC §3), y elegir en silencio cuál de los tres es «el
    // perímetro» sería acertar la mitad de las veces.
    expect(Object.keys(d.perimetro.medido).sort()).toEqual(['exterior', 'huecos', 'total'])
  })

  it('las tres bandas son las de `diagnostico/bandas.js`, con la superficie DECLARADA', () => {
    expect(d.bandas).toEqual(
      bandas({
        medida: superficie(editada()),
        catastral: DECLARADA,
        registral: REGISTRAL,
      }),
    )
    // Y no con la que medimos sobre la geometría oficial: la que consta en el
    // expediente, y contra la que se rectifica, es la declarada.
    expect(d.bandas.valores.catastral).toBe(DECLARADA)
    expect(d.bandas.valores.catastral).not.toBe(d.superficie.oficial)
  })

  it('el área de solape es la de `diagnostico/topologia.js#solape`, al último bit', () => {
    expect(d.solape.area).toBe(solape(editada(), oficial()).area)
    expect(d.solape.nPiezas).toBe(1)
  })

  it('la desviación es la de `desviacionPorLado`, con su máxima y sus muestras', () => {
    const esperada = desviacionPorLado(editada(), oficial())
    expect(d.desviacion.nMuestras).toBe(esperada.nMuestras)
    expect(d.desviacion.porLado).toHaveLength(esperada.porLado.length)
    expect(d.desviacion.maxima.maxima).toBe(esperada.maxima.maxima)
  })

  it('`maxima` es la MISMA entrada de `porLado`, no una copia', () => {
    // Identidad de referencia: la capa de dibujo hace `lado === d.desviacion.maxima`
    // para saber cuál resalta, y así no hay dos cifras que puedan divergir.
    expect(d.desviacion.porLado).toContain(d.desviacion.maxima)
  })

  it('la invasión es la de `diagnostico/topologia.js#invasiones`', () => {
    const esperada = invasiones(editada(), VECINAS)
    expect(d.invasion.invasiones).toEqual(esperada.invasiones)
    expect(d.invasion.descartadas).toEqual(esperada.descartadas)
  })

  it('los centroides son los de `geo/centroide.js` y la distancia la euclídea propia', () => {
    const cMedido = centroide(editada())
    const cOficial = centroide(oficial())
    expect(d.centroides.medido).toEqual(cMedido)
    expect(d.centroides.oficial).toEqual(cOficial)
    expect(d.centroides.distancia).toBe(distancia(cMedido, cOficial))
  })
})

describe('diagnostico/parcela.js · solape relativo y diferencia simétrica', () => {
  it('el relativo va sobre la MAYOR de las dos superficies (spec §10.1)', () => {
    // A mano: 10×10 (100 m²) contra 20×20 (400 m²), encajado en la esquina. El
    // solape es 100 m². Sobre la MAYOR es 0,25; sobre la menor sería 1,00 — o sea
    // «solapan al 100 %», que es exactamente la lectura tranquilizadora que la
    // elección de «la mayor» evita.
    const d = diagnosticar({ recintos: rect(0, 0, 10, 10), geometriaOficial: rect(0, 0, 20, 20) })
    expect(d.solape.area).toBeCloseTo(100, 9)
    expect(d.solape.relativo).toBeCloseTo(0.25, 12)
  })

  it('la diferencia simétrica es |A| + |B| − 2·|A∩B|, exacta y sin geometría booleana', () => {
    // Mismo caso: 100 + 400 − 200 = 300 m², que es el marco de 20×20 menos el
    // cuadrado de 10×10. Se calcula así y no con `@turf/difference` —que no está en
    // `package.json`— y el resultado no es una aproximación.
    const d = diagnosticar({ recintos: rect(0, 0, 10, 10), geometriaOficial: rect(0, 0, 20, 20) })
    expect(d.diferencia.area).toBeCloseTo(300, 9)
  })

  it('dos contornos idénticos: solape del 100 % y diferencia 0', () => {
    const d = diagnosticar({ recintos: oficial(), geometriaOficial: oficial() })
    expect(d.solape.relativo).toBeCloseTo(1, 9)
    expect(d.diferencia.area).toBeCloseTo(0, 6)
  })

  it('sin solape: área 0, relativo 0 y la diferencia es la SUMA de las dos', () => {
    const d = diagnosticar({ recintos: rect(0, 0, 10, 10), geometriaOficial: rect(50, 50, 60, 60) })
    expect(d.solape.area).toBe(0)
    expect(d.solape.relativo).toBe(0)
    expect(d.solape.piezas).toEqual([])
    expect(d.diferencia.area).toBeCloseTo(200, 9)
  })

  it('dos contornos SIN superficie: el relativo es null, ni 0 ni NaN', () => {
    // Un 0 % diría «no solapan nada»; lo cierto es que la pregunta no tiene
    // respuesta. Y un NaN se pintaría como «NaN», que es el error silencioso de
    // siempre: un número que nadie ha calculado presentado como si alguien lo
    // hubiera calculado.
    const linea = [{ vertices: [[0, 0], [10, 0], [20, 0]], tipo: 'EXTERIOR' }]
    const d = diagnosticar({ recintos: linea, geometriaOficial: linea })
    expect(d.solape.relativo).toBeNull()
    expect(Number.isNaN(d.solape.relativo)).toBe(false)
  })
})

describe('diagnostico/parcela.js · sin geometría oficial: cuatro secciones omitidas', () => {
  // El caso de un DXF, un TXT o un contorno dibujado a mano: se mide, pero no hay
  // parcelario contra el que contrastar. Se pasa `refcat` para que el margen SÍ se
  // resuelva y este bloque hable solo de las cuatro secciones que dependen del
  // oficial; la omisión del margen tiene su propio bloque más abajo.
  const d = diagnosticar({ recintos: rect(0, 0, 10, 10), refcat: REF_PROPIA })

  it('las cuatro secciones que la necesitan son `null`', () => {
    expect(d.solape).toBeNull()
    expect(d.diferencia).toBeNull()
    expect(d.centroides).toBeNull()
    expect(d.desviacion).toBeNull()
  })

  it('…y cada una deja su omisión, con el motivo en español', () => {
    // La razón de que exista `omisiones`: sin ella la vista tendría que adivinar si
    // un `null` significa «no aplica» o «algo ha fallado», y son cosas distintas.
    expect(d.omisiones.map((o) => o.que).sort()).toEqual([
      OMISION.CENTROIDES,
      OMISION.DESVIACION,
      OMISION.DIFERENCIA,
      OMISION.SOLAPE,
    ])
    for (const o of d.omisiones) {
      expect(o.motivo).toMatch(/geometría oficial/i)
      expect(o.motivo.length).toBeGreaterThan(30)
    }
  })

  it('lo que SÍ se puede medir se mide: superficie y perímetro propios', () => {
    // Una omisión no contagia al resto. Media pantalla de diagnóstico sigue siendo
    // útil, y apagarla entera porque falta el parcelario sería tirar dato bueno.
    expect(d.superficie.medida).toBeCloseTo(100, 9)
    expect(d.perimetro.medido.exterior).toBeCloseTo(40, 9)
  })

  it('el perímetro oficial es `null`, NO `{0,0,0}`', () => {
    // `geo/metrica.js#perimetro` devuelve ceros ante una lista vacía, y para él es
    // correcto. Aquí sería falso: «el parcelario dice que esta parcela no tiene
    // lindero» en vez de «no hay parcelario».
    expect(d.perimetro.oficial).toBeNull()
  })

  it('la superficie oficial también es `null` y no 0', () => {
    expect(d.superficie.oficial).toBeNull()
  })
})

describe('diagnostico/parcela.js · centroide degenerado: otra causa, otro motivo', () => {
  it('un contorno sin área omite `centroides` con un motivo DISTINTO', () => {
    // Aquí sí hay oficial, así que el motivo no puede ser «no hay parcelario»: son
    // dos causas distintas y la vista dice cosas distintas de cada una.
    const linea = [{ vertices: [[0, 0], [10, 0], [20, 0]], tipo: 'EXTERIOR' }]
    const d = diagnosticar({ recintos: linea, geometriaOficial: rect(0, 0, 10, 10) })

    const omision = d.omisiones.find((o) => o.que === OMISION.CENTROIDES)
    expect(omision).toBeDefined()
    expect(omision.motivo).toMatch(/no encierra superficie/i)
    expect(omision.motivo).not.toMatch(/no se ha traído/i)
    expect(d.centroides).toBeNull()
    // Y el solape SÍ se ha podido intentar: la omisión es solo de centroides.
    expect(d.solape).not.toBeNull()
  })
})

describe('diagnostico/parcela.js · `vecinas: null` ≠ `vecinas: []`', () => {
  it('`null` = no se ha consultado', () => {
    const d = diagnosticar({ recintos: editada(), geometriaOficial: oficial() })
    expect(d.invasion.consultado).toBe(false)
    expect(d.invasion.invasiones).toEqual([])
    expect(d.invasion.descartadas).toEqual([])
  })

  it('`[]` = se consultó y no hay ninguna', () => {
    const d = diagnosticar({ recintos: editada(), geometriaOficial: oficial(), vecinas: [] })
    expect(d.invasion.consultado).toBe(true)
    expect(d.invasion.invasiones).toEqual([])
  })

  it('la diferencia entre las dos es la diferencia entre «no se sabe» y «no hay»', () => {
    // Las dos tienen `invasiones: []`. Lo único que las distingue es `consultado`, y
    // sin ese campo la vista escribiría «no hay invasión» en los dos casos — una
    // afirmación tranquilizadora que en uno de ellos es falsa.
    const sinConsultar = diagnosticar({ recintos: editada(), geometriaOficial: oficial() })
    const consultado = diagnosticar({
      recintos: editada(),
      geometriaOficial: oficial(),
      vecinas: [],
    })
    expect(sinConsultar.invasion.invasiones).toEqual(consultado.invasion.invasiones)
    expect(sinConsultar.invasion.consultado).not.toBe(consultado.invasion.consultado)
  })

  it('la invasión NO deja entrada en `omisiones`: su estado va dentro de ella', () => {
    // Dos sitios afirmando lo mismo son dos sitios que pueden divergir.
    const d = diagnosticar({ recintos: editada(), geometriaOficial: oficial() })
    expect(d.omisiones.map((o) => o.que)).not.toContain('invasion')
  })

  it('un `vecinas` que no es array ni null LANZA, nombrando la distinción', () => {
    expect(() => diagnosticar({ recintos: editada(), vecinas: 4 })).toThrow(
      /no se ha consultado.*no hay ninguna/s,
    )
  })
})

describe('diagnostico/parcela.js · invasión: astillas descartadas y metros de verdad', () => {
  it('SIN editar, la parcela oficial no invade a nadie y sus dos astillas van a `descartadas`', () => {
    // Son la constancia de lo que se descartó (regla de oro 1). Con el umbral de
    // ÁREA con el que nació esta fase salían como INVASIÓN, y la parcela oficial
    // «invadía» a dos colindantes oficiales sin que nadie tocara un vértice. Este
    // test es el que vigila que eso siga sin pasar desde el orquestador, no solo
    // desde `topologia.js`.
    const d = diagnosticar({
      recintos: oficial(),
      geometriaOficial: oficial(),
      vecinas: VECINAS,
    })

    expect(d.invasion.invasiones).toEqual([])
    expect(d.invasion.descartadas).toHaveLength(2)
    for (const desc of d.invasion.descartadas) {
      expect(desc.area).toBeGreaterThan(0)
      expect(desc.grosor).toBeCloseTo(7.143e-5, 8) // 0,07 mm, medido
      expect(Object.keys(desc).sort()).toEqual(['area', 'grosor', 'nPiezas', 'refcat'])
    }
  })

  it('🔻 mover UN vértice 0,40 m invade a TRES colindantes, con metros cuadrados de verdad', () => {
    // MEDIDO, y contradice lo que suponía el encargo de esta tarea. El vértice tiene
    // los dos lados contiguos largos, así que 0,40 m barren un triángulo de 3,124 m²
    // hacia fuera, y ese triángulo cruza tres linderos. En una parcela real, cuatro
    // decímetros en el vértice equivocado son un expediente rechazado — que es
    // exactamente para lo que sirve esta sección del diagnóstico.
    const d = diagnosticar({
      recintos: editada(),
      geometriaOficial: oficial(),
      vecinas: VECINAS,
    })

    expect(d.invasion.consultado).toBe(true)
    expect(d.invasion.invasiones.map((h) => h.refcat)).toEqual([
      '9398501VK3799G',
      '9398518VK3799G',
      '9398515VK3799G',
    ])
    expect(d.invasion.invasiones.map((h) => h.area)).toEqual([
      expect.closeTo(0.230839, 5),
      expect.closeTo(0.252273, 5),
      expect.closeTo(2.641388, 5),
    ])

    // Y las astillas DESAPARECEN de `descartadas`: al invadir de verdad esos mismos
    // linderos, cada astilla queda absorbida dentro de una pieza que sí cuenta. No
    // es que se hayan perdido — es que ya no son piezas aparte.
    expect(d.invasion.descartadas).toEqual([])
  })

  it('el orden de las invasiones es el de `vecinas`, no por área', () => {
    // La de 2,64 m² es la última porque su vecina es la última de la lista del WFS.
    // Ordenar es de quien presenta: reordenar aquí haría imposible casar el hallazgo
    // con la fila de origen.
    const d = diagnosticar({
      recintos: editada(),
      geometriaOficial: oficial(),
      vecinas: VECINAS,
    })
    const areas = d.invasion.invasiones.map((h) => h.area)
    expect(areas).not.toEqual([...areas].sort((a, b) => b - a))
  })

  it('con la lista TAL COMO LLEGA del WFS, la propia se cuela y se ve enseguida', () => {
    // Override O15: `GetNeighbourParcel` incluye a la propia parcela. Filtrar es del
    // cableado (T4.3); aquí se documenta el síntoma del olvido para que, si se
    // olvida, el rojo caiga allí con una firma reconocible.
    const d = diagnosticar({ recintos: oficial(), geometriaOficial: oficial(), vecinas: TODAS })
    expect(d.invasion.invasiones.map((h) => h.refcat)).toEqual([REF_PROPIA])
    expect(d.invasion.invasiones[0].area / d.superficie.medida).toBeCloseTo(1, 9)
  })
})

describe('diagnostico/parcela.js · el margen: elegido, propuesto o ninguno', () => {
  it('`clase` ELEGIDA manda y sale con `deducida: false`', () => {
    const d = diagnosticar({ recintos: rect(0, 0, 10, 10), clase: CLASE.RUSTICA })
    expect(d.margen.clase).toBe(CLASE.RUSTICA)
    expect(d.margen.deducida).toBe(false)
    expect(d.margen.criterio).toBeNull()
    expect(d.margen.perimetroM).toBe(2)
    expect(d.margen.superficieRelativo).toBe(0.05)
    expect(d.margen.etiqueta).toBe(ETIQUETA)
  })

  it('la clase elegida GANA a la que se deduciría de la referencia', () => {
    // La clase de suelo la sabe el técnico, no una expresión regular. Si la
    // propuesta pisara la elección, el `<select>` de la fase 4 no serviría de nada.
    const d = diagnosticar({
      recintos: rect(0, 0, 10, 10),
      clase: CLASE.RUSTICA,
      refcat: REF_PROPIA, // urbana
    })
    expect(claseDeducidaDe(REF_PROPIA).clase).toBe(CLASE.URBANA)
    expect(d.margen.clase).toBe(CLASE.RUSTICA)
    expect(d.margen.deducida).toBe(false)
  })

  it('sin clase pero con referencia, se PROPONE y se rotula como deducida', () => {
    const d = diagnosticar({ recintos: rect(0, 0, 10, 10), refcat: REF_PROPIA })
    expect(d.margen.clase).toBe(CLASE.URBANA)
    expect(d.margen.deducida).toBe(true)
    expect(d.margen.perimetroM).toBe(0.5)
    // `criterio` es el texto que la vista enseña para que el usuario sepa de dónde
    // sale la propuesta: sin él, una deducción se presentaría como un dato.
    expect(d.margen.criterio).toContain(REF_PROPIA)
  })

  it('sin clase y sin referencia, `margen` es null con su omisión', () => {
    // No existe «el margen por defecto»: elegir uno en silencio sería inventarse
    // media norma. Lo que corresponde es preguntar.
    const d = diagnosticar({ recintos: rect(0, 0, 10, 10) })
    expect(d.margen).toBeNull()
    const omision = d.omisiones.find((o) => o.que === OMISION.MARGEN)
    expect(omision).toBeDefined()
    expect(omision.motivo).toMatch(/urbana o rústica/i)
  })

  it('una referencia irreconocible se trata como si no hubiera ninguna', () => {
    const d = diagnosticar({ recintos: rect(0, 0, 10, 10), refcat: 'BUENOS DIAS' })
    expect(d.margen).toBeNull()
    expect(d.omisiones.some((o) => o.que === OMISION.MARGEN)).toBe(true)
  })

  it('una clase inventada LANZA: es contrato del programador', () => {
    expect(() => diagnosticar({ recintos: rect(0, 0, 10, 10), clase: 'MIXTA' })).toThrow(TypeError)
  })
})

describe('diagnostico/parcela.js · NO juzga (regla de oro 9)', () => {
  // La frontera de la regla 9 pasa por el TIPO DE RETORNO: si esta función no puede
  // devolver un booleano de mérito, ninguna vista puede pintar un semáforo a partir
  // de ella. Por eso el guardián recorre el objeto REAL —recursivamente— y no una
  // lista de claves escrita a mano, que se quedaría corta en cuanto crezca el
  // contrato.
  const PROHIBIDAS =
    /^(ok|valido|válido|apto|aprobado|aceptable|dentro|cumple|supera|excede|semaforo|semáforo|umbral|tolerancia|nivel|color|estado|veredicto|correcto|conforme)/i

  /** Todas las claves del objeto, a cualquier profundidad. */
  function clavesProfundas(valor, acc = []) {
    if (Array.isArray(valor)) {
      for (const v of valor) clavesProfundas(v, acc)
    } else if (valor !== null && typeof valor === 'object') {
      for (const [k, v] of Object.entries(valor)) {
        acc.push(k)
        clavesProfundas(v, acc)
      }
    }
    return acc
  }

  it('ninguna clave del resultado, a ninguna profundidad, es de veredicto', () => {
    const d = diagnosticar({
      recintos: editada(),
      geometriaOficial: oficial(),
      superficieCatastral: DECLARADA,
      superficieRegistral: REGISTRAL,
      vecinas: VECINAS,
      refcat: REF_PROPIA,
    })

    const claves = clavesProfundas(d)
    expect(claves.length).toBeGreaterThan(30) // el guardián mira algo, no un objeto vacío
    for (const clave of claves) {
      expect(clave, `la clave '${clave}' parece un veredicto`).not.toMatch(PROHIBIDAS)
    }
  })

  it('el margen viaja SIEMPRE con su etiqueta y sin comparar nada', () => {
    // La etiqueta es lo que impide que la cifra se lea como un aprobado, y va dentro
    // del objeto para que no haya forma de pintar el número sin tenerla a mano.
    const d = diagnosticar({ recintos: editada(), geometriaOficial: oficial(), clase: CLASE.URBANA })
    expect(d.margen.etiqueta).toBe(ETIQUETA)
    // Y no hay ningún campo que enfrente el margen con lo medido: eso lo hace el
    // colegiado que firma, no esta función.
    expect(Object.keys(d.margen).sort()).toEqual([
      'clase',
      'criterio',
      'deducida',
      'etiqueta',
      'perimetroM',
      'superficieRelativo',
    ])
  })

  it('una discrepancia minúscula y otra enorme dan la MISMA forma', () => {
    // Que la función no distinga «pequeña» de «grande» es la propiedad, no una
    // carencia. La razón está en la spec: una discrepancia grande a menudo significa
    // que la geometría CATASTRAL está mal, y ése es el motivo del expediente.
    const casi = diagnosticar({ recintos: oficial(), geometriaOficial: oficial() })
    const enorme = diagnosticar({ recintos: rect(0, 0, 1, 1), geometriaOficial: oficial() })
    expect(Object.keys(enorme).sort()).toEqual(Object.keys(casi).sort())
  })
})

describe('diagnostico/parcela.js · regla de oro 2: la geometría oficial no se toca', () => {
  it('`geometriaOficial` sale con el mismo contenido con el que entró', () => {
    // F07 es el PRIMER lector de `geometriaOficial` en todo el proyecto —hasta ahora
    // era un campo que se guardaba y no se leía—, así que es la primera fase que
    // puede romper esta regla.
    const original = oficial()
    const antes = JSON.stringify(original)
    diagnosticar({
      recintos: editada(),
      geometriaOficial: original,
      vecinas: VECINAS,
      refcat: REF_PROPIA,
    })
    expect(JSON.stringify(original)).toBe(antes)
  })

  it('tampoco se tocan `recintos` ni `vecinas`', () => {
    const r = editada()
    const v = clon(VECINAS)
    const antes = JSON.stringify([r, v])
    diagnosticar({ recintos: r, geometriaOficial: oficial(), vecinas: v })
    expect(JSON.stringify([r, v])).toBe(antes)
  })
})

describe('diagnostico/parcela.js · contrato del programador', () => {
  it('sin `recintos` LANZA', () => {
    expect(() => diagnosticar({})).toThrow(TypeError)
  })

  it('un array en vez del objeto de entrada LANZA', () => {
    // Sin la guarda, `diagnosticar(recintos)` desestructuraría el array, `recintos`
    // saldría `undefined` y el error llegaría desde el fondo de `geo/area.js` con un
    // mensaje que no nombra al culpable.
    expect(() => diagnosticar(editada())).toThrow(TypeError)
    expect(() => diagnosticar(null)).toThrow(TypeError)
  })

  it('una superficie que no es número ni null LANZA nombrando el argumento', () => {
    expect(() =>
      diagnosticar({ recintos: editada(), superficieCatastral: '1536' }),
    ).toThrow(/'superficieCatastral'/)
    expect(() =>
      diagnosticar({ recintos: editada(), superficieRegistral: NaN }),
    ).toThrow(/'superficieRegistral'/)
  })

  it('el invariante EXTERIOR/HUECO roto se deja SUBIR sin capturar', () => {
    // Es un bug del programa, no un dato del usuario: tiene que sonar, no acabar en
    // un renglón del pie. Lo lanzan `geo/area.js` y `geo/metrica.js`.
    const alReves = [{ vertices: rect(0, 0, 10, 10)[0].vertices, tipo: 'HUECO' }]
    expect(() => diagnosticar({ recintos: alReves })).toThrow(TypeError)
  })

  it('`OMISION` está congelado: la vista no escribe estas claves a mano', () => {
    expect(Object.isFrozen(OMISION)).toBe(true)
    expect(Object.values(OMISION)).toContain('solape')
  })
})
