// test/derivacion/vecino.test.js — F23 · el colindante recortado.
//
// Geometría sintética y rectangular a propósito: las áreas salen a mano y un
// número raro se ve de inmediato. Los rectángulos se colocan como se colocan de
// verdad en un parcelario —vecinos que comparten lindero, sin solaparse entre sí—,
// porque el caso que este módulo tiene que resolver depende de esa topología.
//
// ⭐ Los números del CASO REAL (expediente 29050A01000144, medidos contra el WFS el
// 2026-08-10) están al final, en su propio bloque, con la cifra al lado.

import { describe, expect, it } from 'vitest'

import { TIPO_DERIVACION } from '../../derivacion/_comun.js'
import { recortarVecinos } from '../../derivacion/vecino.js'

/** Un anillo rectangular ABIERTO, en sentido antihorario. */
const rect = (x0, y0, x1, y1) => [
  { vertices: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], tipo: 'EXTERIOR' },
]

/** Una pieza de `puerta.piezas` tal como la emite `derivacion/cesion.js`. */
const trozo = (orden, x0, y0, x1, y1) => ({
  orden,
  recintos: rect(x0, y0, x1, y1),
  area: (x1 - x0) * (y1 - y0),
})

const tipos = (r) => r.detecciones.map((d) => d.tipo)

describe('recortarVecinos · contratos', () => {
  it('sin opciones, o con `recintos` que no son recintos, LANZA', () => {
    expect(() => recortarVecinos()).toThrow(TypeError)
    expect(() => recortarVecinos({ recintos: 'no' })).toThrow(TypeError)
  })

  it('`vecinas` que no es array ni null LANZA, y el mensaje explica null vs []', () => {
    expect(() => recortarVecinos({ recintos: rect(0, 0, 10, 10), vecinas: 5 })).toThrow(
      /array VACÍO es otra cosa/,
    )
  })

  it('`umbralGrosorM` negativo LANZA RangeError', () => {
    expect(() =>
      recortarVecinos({ recintos: rect(0, 0, 10, 10), vecinas: [], umbralGrosorM: -1 }),
    ).toThrow(RangeError)
  })
})

describe('recortarVecinos · ⛔ null y [] NO significan lo mismo', () => {
  const recintos = rect(0, 0, 10, 10)

  it('con `null` NO afirma nada: avisa de que no se ha consultado', () => {
    const r = recortarVecinos({ recintos, vecinas: null, fuera: [trozo(1, 10, 0, 12, 10)] })
    expect(r.consultado).toBe(false)
    expect(tipos(r)).toContain(TIPO_DERIVACION.VECINAS_SIN_CONSULTAR)
    // ⛔ Y `sobreNadie` se queda en 0 SIN emitir FUERA_SOBRE_NADIE: decir que cae
    // sobre un vial es lo tranquilizador, y no se ha mirado.
    expect(r.sobreNadie).toBe(0)
    expect(tipos(r)).not.toContain(TIPO_DERIVACION.FUERA_SOBRE_NADIE)
  })

  it('con `[]` SÍ afirma: se preguntó, no hay nadie, el exceso es de vial', () => {
    const r = recortarVecinos({ recintos, vecinas: [], fuera: [trozo(1, 10, 0, 12, 10)] })
    expect(r.consultado).toBe(true)
    expect(r.sobreNadie).toBeCloseTo(20, 6)
    expect(tipos(r)).toContain(TIPO_DERIVACION.FUERA_SOBRE_NADIE)
    // ⚠️ AVISO y no ERROR: pisar un vial mal georreferenciado es un caso legítimo
    // (decisión del autor, 2026-08-10). Se declara, no se bloquea.
    const d = r.detecciones.find((x) => x.tipo === TIPO_DERIVACION.FUERA_SOBRE_NADIE)
    expect(d.severidad).toBe('AVISO')
  })
})

describe('recortarVecinos · el recorte', () => {
  it('recorta al vecino invadido y deja fuera al que no se toca', () => {
    // La medida ocupa 0..12 en X; el vecino A vive en 10..20 (le entramos 2×10=20 m²)
    // y el vecino B en 30..40, que no tocamos.
    const r = recortarVecinos({
      recintos: rect(0, 0, 12, 10),
      vecinas: [
        { refcat: 'A', recintos: rect(10, 0, 20, 10) },
        { refcat: 'B', recintos: rect(30, 0, 40, 10) },
      ],
      fuera: [trozo(1, 10, 0, 12, 10)],
    })

    expect(r.vecinos).toHaveLength(1)
    const [a] = r.vecinos
    expect(a.refcat).toBe('A')
    expect(a.areaOficial).toBeCloseTo(100, 6)
    expect(a.areaNueva).toBeCloseTo(80, 6)
    expect(a.pierde).toBeCloseTo(20, 6)
    expect(a.seParte).toBe(false)
    expect(r.areaCedida).toBeCloseTo(20, 6)
    expect(r.sobreNadie).toBeCloseTo(0, 6)
  })

  it('⛔ un trozo puede caer sobre DOS vecinos, y se dice cuánto a cada uno', () => {
    // El trozo de fuera (10..12 × 0..10) pisa a A por la mitad de arriba y a B por
    // la de abajo. Es el caso real del expediente 29050A01000144.
    const r = recortarVecinos({
      recintos: rect(0, 0, 12, 10),
      vecinas: [
        { refcat: 'A', recintos: rect(10, 5, 20, 10) },
        { refcat: 'B', recintos: rect(10, 0, 20, 5) },
      ],
      fuera: [trozo(1, 10, 0, 12, 10)],
    })

    expect(r.atribucion).toHaveLength(1)
    const [at] = r.atribucion
    expect(at.orden).toBe(1)
    expect(at.porVecino).toHaveLength(2)
    // Ordenados de mayor a menor, y aquí empatan a 10 m² cada uno.
    expect(at.porVecino.map((v) => v.refcat).sort()).toEqual(['A', 'B'])
    for (const v of at.porVecino) expect(v.area).toBeCloseTo(10, 6)
    expect(at.sobreNadie).toBeCloseTo(0, 6)
  })

  it('⛔ lo que sobra tras atribuir sale como `sobreNadie`, no se reparte a la fuerza', () => {
    // El trozo mide 20 m² y solo la mitad cae sobre A; la otra mitad es vial.
    const r = recortarVecinos({
      recintos: rect(0, 0, 12, 10),
      vecinas: [{ refcat: 'A', recintos: rect(10, 5, 20, 10) }],
      fuera: [trozo(1, 10, 0, 12, 10)],
    })
    const [at] = r.atribucion
    expect(at.porVecino[0].area).toBeCloseTo(10, 6)
    expect(at.sobreNadie).toBeCloseTo(10, 6)
    expect(r.sobreNadie).toBeCloseTo(10, 6)
  })

  it('un vecino partido en DOS se marca, y el mayor va primero', () => {
    // La medición atraviesa al vecino de lado a lado, dejándole 2 m² arriba y 6
    // abajo. La mayor es la que conservará su referencia catastral (O19).
    const r = recortarVecinos({
      recintos: rect(0, 2, 30, 4),
      vecinas: [{ refcat: 'A', recintos: rect(10, 0, 20, 5) }],
      fuera: [trozo(1, 10, 2, 20, 4)],
    })

    expect(r.vecinos).toHaveLength(1)
    const [a] = r.vecinos
    expect(a.seParte).toBe(true)
    expect(a.trozos).toHaveLength(2)
    expect(a.trozos[0].area).toBeGreaterThan(a.trozos[1].area)
    expect(a.trozos[0].area).toBeCloseTo(20, 6) // 10 ancho × 2 alto (y 0..2)
    expect(a.trozos[1].area).toBeCloseTo(10, 6) // 10 ancho × 1 alto (y 4..5)
    expect(tipos(r)).toContain(TIPO_DERIVACION.VECINO_PARTIDO)
  })

  it('una vecina con huecos se recorta sin saltar nada', () => {
    // La `…146` del expediente real trae exterior + DOS huecos, y el motor la
    // digiere: es el caso que se comprobó primero al medir.
    const conHueco = [
      { vertices: [[10, 0], [20, 0], [20, 10], [10, 10]], tipo: 'EXTERIOR' },
      { vertices: [[13, 3], [13, 7], [17, 7], [17, 3]], tipo: 'HUECO' },
    ]
    const r = recortarVecinos({
      recintos: rect(0, 0, 12, 10),
      vecinas: [{ refcat: 'H', recintos: conHueco }],
      fuera: [trozo(1, 10, 0, 12, 10)],
    })
    expect(r.saltados).toHaveLength(0)
    expect(r.vecinos[0].areaOficial).toBeCloseTo(100 - 16, 6)
    expect(r.vecinos[0].pierde).toBeCloseTo(20, 6)
  })

  it('sin exceso no hay atribución, y nadie pierde nada', () => {
    const r = recortarVecinos({
      recintos: rect(0, 0, 10, 10),
      vecinas: [{ refcat: 'A', recintos: rect(10, 0, 20, 10) }],
      fuera: [],
    })
    expect(r.vecinos).toHaveLength(0)
    expect(r.atribucion).toHaveLength(0)
    expect(r.areaCedida).toBe(0)
  })
})

describe('recortarVecinos · el caso REAL, con las cifras medidas', () => {
  // ⭐ Expediente 29050A01000144 (Málaga), medido contra el WFS del Catastro el
  // 2026-08-10 con la geometría del autor (287,5910 m², 10 vértices).
  //
  // No se reproduce aquí la geometría real —serían cuatro contornos de 8 a 33
  // vértices en un test unitario—, pero sí la PROPIEDAD que hace que el expediente
  // cierre, que es lo que de verdad hay que defender: **lo que se le quita a los
  // vecinos es exactamente el exceso**, ni más ni menos. Sobre el caso real:
  //
  //     exceso    25,4865 m²
  //     …143      20,2925 m²   ┐
  //     …121       5,1941 m²   ┘ suma 25,4866 · residuo 0,0001 m²
  //     sobre nadie    0 m²
  it('⭐ la suma de lo que pierden los vecinos ES el exceso (residuo 0)', () => {
    const areaExceso = 2 * 10
    const r = recortarVecinos({
      recintos: rect(0, 0, 12, 10),
      vecinas: [
        { refcat: '…143', recintos: rect(10, 4, 20, 10) },
        { refcat: '…121', recintos: rect(10, 0, 20, 4) },
      ],
      fuera: [trozo(1, 10, 0, 12, 10)],
    })

    expect(r.areaCedida + r.sobreNadie).toBeCloseTo(areaExceso, 9)
    expect(r.sobreNadie).toBeCloseTo(0, 9)
    // Y el reparto respeta la proporción de cada uno: 6/10 y 4/10 del trozo.
    const porRc = Object.fromEntries(r.vecinos.map((v) => [v.refcat, v.pierde]))
    expect(porRc['…143']).toBeCloseTo(12, 6)
    expect(porRc['…121']).toBeCloseTo(8, 6)
    // De mayor a menor pérdida: el que más pierde encabeza la lista.
    expect(r.vecinos[0].refcat).toBe('…143')
  })
})

describe('recortarVecinos · EL REPARTO del sobrante (F23 · fase 4)', () => {
  // La medición se corre 2 m al este dentro de un oficial de 0..10: suelta una
  // franja por el oeste y se come otra del vecino del este.
  const OFICIAL_W = rect(0, 0, 2, 10) // la franja que la parcela suelta
  const MEDIDA = rect(2, 0, 12, 10)
  const VECINA_E = { refcat: 'E', recintos: rect(10, 0, 20, 10) } // se la comemos
  const VECINA_W = { refcat: 'W', recintos: rect(-10, 0, 0, 10) } // linda con lo soltado
  const VECINA_LEJOS = { refcat: 'L', recintos: rect(50, 50, 60, 60) }
  const SOBRANTE = [{ orden: 1, recintos: OFICIAL_W, area: 20 }]
  const base = {
    recintos: MEDIDA,
    vecinas: [VECINA_E, VECINA_W, VECINA_LEJOS],
    fuera: [trozo(1, 10, 0, 12, 10)],
    sobrante: SOBRANTE,
  }

  it('dice con QUIÉN linda cada trozo, y no con quién está cerca', () => {
    const r = recortarVecinos(base)
    expect(r.lindes).toHaveLength(1)
    expect(r.lindes[0].orden).toBe(1)
    // Solo `W`: `E` está al otro lado de la parcela y `L` a 50 m.
    expect(r.lindes[0].refcats).toEqual(['W'])
  })

  it('⭐ asignado a quien linda, el vecino CRECE y la pieza deja de ser finca aparte', () => {
    const r = recortarVecinos({ ...base, asignadas: { 1: 'W' } })
    const w = r.vecinos.find((v) => v.refcat === 'W')
    expect(w).toBeDefined()
    expect(w.areaOficial).toBeCloseTo(100, 6)
    expect(w.pierde).toBeCloseTo(0, 6)
    expect(w.recibe).toBeCloseTo(20, 6)
    expect(w.areaNueva).toBeCloseTo(120, 6)
    // ⛔ Y sigue siendo UNA finca, no dos pegadas.
    expect(w.trozos).toHaveLength(1)
    expect(r.areaRepartida).toBeCloseTo(20, 6)
  })

  it('⛔ un vecino que solo RECIBE entra igual en el expediente', () => {
    // Medido sobre el real: el sobrante linda 18,42 m con `…145`, que no pierde ni
    // un metro. Dejarlo fuera emitiría un expediente donde una finca crece sin que
    // su titular aparezca.
    const r = recortarVecinos({ ...base, asignadas: { 1: 'W' } })
    expect(r.vecinos.map((v) => v.refcat).sort()).toEqual(['E', 'W'])
  })

  it('⛔ asignarlo a quien NO linda se RECHAZA, no se obedece', () => {
    // Obedecerlo crearía una finca en dos pedazos separados. No es una preferencia
    // del usuario que haya que respetar: es una finca imposible.
    const r = recortarVecinos({ ...base, asignadas: { 1: 'L' } })
    expect(tipos(r)).toContain(TIPO_DERIVACION.ASIGNACION_IMPOSIBLE)
    expect(r.vecinos.find((v) => v.refcat === 'L')).toBeUndefined()
    expect(r.areaRepartida).toBeCloseTo(0, 6)
  })

  it('⛔ `pierde` sigue siendo la pérdida BRUTA aunque el vecino reciba', () => {
    // Es el invariante que hace cerrar al expediente: `Σ pierde === exceso`.
    // Mezclarlo con el reparto lo rompería, porque el sobrante ya estaba dentro de
    // lo oficial y no viene de fuera.
    const r = recortarVecinos({ ...base, asignadas: { 1: 'W' } })
    expect(r.areaCedida).toBeCloseTo(20, 6) // solo lo que se le quita a `E`
    const e = r.vecinos.find((v) => v.refcat === 'E')
    expect(e.pierde).toBeCloseTo(20, 6)
    expect(e.recibe).toBeCloseTo(0, 6)
  })

  it('sin asignar nada, nadie recibe y el sobrante queda para darse de alta', () => {
    const r = recortarVecinos(base)
    expect(r.areaRepartida).toBeCloseTo(0, 6)
    for (const v of r.vecinos) expect(v.recibe).toBeCloseTo(0, 6)
  })
})

// ── ⛔ El filtro comparaba m² contra METROS ──────────────────────────────────

describe('recortarVecinos · ⛔ a un vecino se le recorta por GROSOR, no por área', () => {
  // ⭐ EL DEFECTO (2026-08-10, medido sobre `6346726UF8664N`). La línea decía
  // `if (pierde <= umbralGrosorM) continue`: una SUPERFICIE contra una LONGITUD. La
  // comparación no significaba nada, y su efecto era que **la parcela de un tercero
  // entraba en el expediente recortada** porque el enganche de linderos le rozaba
  // 0,018 m² en una franja de 1,5 mm. Eso es modificar la finca de otro titular por
  // el ruido del redondeo, en un fichero que se firma y se presenta.
  //
  // El propio proyecto ya sabía que no: el diagnóstico de encaje descarta esos
  // mismos solapes por grosor y lo dice en pantalla. Había dos respuestas a la misma
  // pregunta dentro del mismo programa.
  const VECINA = { refcat: 'V-1', recintos: rect(10, 0, 20, 10) }

  it('una franja de 1,5 mm NO recorta al vecino: sale por `soloRedondeo`, con sus cifras', () => {
    const r = recortarVecinos({
      recintos: rect(0, 0, 10.0015, 10),
      vecinas: [VECINA],
      fuera: [trozo(1, 10, 0, 10.0015, 10)],
    })
    expect(r.vecinos).toHaveLength(0)
    expect(r.areaCedida).toBe(0)
    // ⛔ Pero NO desaparece: la superficie que se deja de contar sale medida.
    expect(r.soloRedondeo).toHaveLength(1)
    expect(r.soloRedondeo[0].refcat).toBe('V-1')
    expect(r.soloRedondeo[0].area).toBeCloseTo(0.015, 6)
    expect(r.soloRedondeo[0].grosor).toBeCloseTo(0.0015, 5)
    expect(tipos(r)).toContain(TIPO_DERIVACION.VECINO_SOLO_REDONDEO)
    // AVISO: no es un fallo del expediente, es una parcela que no entra.
    const d = r.detecciones.find((x) => x.tipo === TIPO_DERIVACION.VECINO_SOLO_REDONDEO)
    expect(d.severidad).toBe('AVISO')
    expect(d.mensaje).toMatch(/1,5 mm de ancho/)
  })

  it('⭐ y 5 cm SÍ lo recortan: el arreglo no ha apagado el caso que la fase existe para hacer', () => {
    const r = recortarVecinos({
      recintos: rect(0, 0, 10.05, 10),
      vecinas: [VECINA],
      fuera: [trozo(1, 10, 0, 10.05, 10)],
    })
    expect(r.vecinos).toHaveLength(1)
    expect(r.vecinos[0].refcat).toBe('V-1')
    expect(r.vecinos[0].pierde).toBeCloseTo(0.5, 6)
    // La cifra con la que se audita el filtro, para no tener que recalcularla.
    // ⚠️ 0,049751 y no 0,05: `geo/grosor.js` da `2·área/perímetro`, y el perímetro
    // de la franja incluye los dos lados cortos — `2·0,5 / (2·(0,05+10))`. Es el
    // grosor MEDIO, no el ancho mínimo, y su cabecera lo dice.
    expect(r.vecinos[0].grosorPerdido).toBeCloseTo(0.049751, 6)
    expect(r.soloRedondeo).toHaveLength(0)
    expect(tipos(r)).not.toContain(TIPO_DERIVACION.VECINO_SOLO_REDONDEO)
  })

  it('⛔ un vecino al que no se le toca NADA no aparece en ninguna de las dos listas', () => {
    // El silencio correcto: `soloRedondeo` es para lo que se DESCARTA, no para
    // enumerar a todo el vecindario. Un aviso que nombra a quien no participa se
    // lee como que participa.
    const r = recortarVecinos({
      recintos: rect(0, 0, 10, 10),
      vecinas: [VECINA],
      fuera: [],
    })
    expect(r.vecinos).toHaveLength(0)
    expect(r.soloRedondeo).toHaveLength(0)
    expect(tipos(r)).not.toContain(TIPO_DERIVACION.VECINO_SOLO_REDONDEO)
  })
})
