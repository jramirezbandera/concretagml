import { describe, it, expect } from 'vitest'
import ring from '../fixtures/geo/parcela-ring.json' with { type: 'json' }
import { metricas } from '../../edit/metricas.js'
import { superficie } from '../../geo/area.js'
import { perimetro } from '../../geo/metrica.js'

// F06 · edit/metricas.js — la retroalimentación numérica en vivo del arrastre.
// Se comprueban tres cosas y en este orden de importancia:
//   1. Que las cifras son las de `geo/` (no una segunda implementación).
//   2. Que `deltaCatastral` distingue «no hay discrepancia» de «no hay con qué
//      comparar» — media razón de ser de la app.
//   3. Que NO juzga (regla de oro 9) y NO redondea (regla de oro 11).

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Cuadrado de 10×10: superficie 100, perímetro 40. Números a mano, a propósito. */
const CUADRADO = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]

/** Hueco de 2×2 dentro del cuadrado: superficie 4, perímetro 8. */
const HUECO = [
  [2, 2],
  [4, 2],
  [4, 4],
  [2, 4],
]

const exterior = () => ({ vertices: structuredClone(CUADRADO), tipo: 'EXTERIOR' })
const hueco = () => ({ vertices: structuredClone(HUECO), tipo: 'HUECO' })

/** Congela en profundidad: cualquier mutación en sitio lanzaría (modo estricto). */
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

// ── Las cifras elementales ───────────────────────────────────────────────────

describe('edit/metricas.js · cuadrado de 10×10', () => {
  it('superficie 100, perímetro exterior 40, huecos 0, total 40, 4 vértices', () => {
    const m = metricas([exterior()])
    expect(m.superficie).toBeCloseTo(100, 12)
    expect(m.perimetro.exterior).toBeCloseTo(40, 12)
    expect(m.perimetro.huecos).toBe(0)
    expect(m.perimetro.total).toBeCloseTo(40, 12)
    expect(m.nVertices).toBe(4)
  })

  it('devuelve EXACTAMENTE las cuatro claves del contrato, ni una más', () => {
    const m = metricas([exterior()])
    expect(Object.keys(m).sort()).toEqual([
      'deltaCatastral',
      'nVertices',
      'perimetro',
      'superficie',
    ])
    expect(Object.keys(m.perimetro).sort()).toEqual(['exterior', 'huecos', 'total'])
  })

  it('las cifras son las de geo/, no una segunda implementación', () => {
    // Si algún día alguien reimplementara aquí el shoelace o la hipotenusa,
    // este test seguiría en verde solo mientras las dos versiones coincidieran
    // al último bit — que es exactamente la condición que no se puede sostener.
    const recintos = [exterior(), hueco()]
    const m = metricas(recintos)
    expect(m.superficie).toBe(superficie(recintos))
    expect(m.perimetro).toEqual(perimetro(recintos))
  })

  it('el anillo se toma ABIERTO: el lado de cierre cuenta (40, no 30)', () => {
    const m = metricas([exterior()])
    expect(m.perimetro.exterior).not.toBeCloseTo(30, 6)
  })
})

describe('edit/metricas.js · con hueco: la asimetría superficie/perímetro', () => {
  it('la superficie RESTA el hueco y el perímetro total lo SUMA', () => {
    const m = metricas([exterior(), hueco()])
    // Superficie NETA: 100 − 4 = 96. Un patio no es suelo de la parcela.
    expect(m.superficie).toBeCloseTo(96, 12)
    // Perímetro TOTAL: 40 + 8 = 48. Un patio AÑADE lindero, no lo quita.
    expect(m.perimetro.exterior).toBeCloseTo(40, 12)
    expect(m.perimetro.huecos).toBeCloseTo(8, 12)
    expect(m.perimetro.total).toBeCloseTo(48, 12)
    // Las dos trampas simétricas: ni la superficie suma (104) ni el perímetro
    // resta (32). Copiar la fórmula de una en la otra da números plausibles.
    expect(m.superficie).not.toBeCloseTo(104, 6)
    expect(m.perimetro.total).not.toBeCloseTo(32, 6)
  })

  it('nVertices suma los de TODOS los recintos, huecos incluidos', () => {
    expect(metricas([exterior(), hueco()]).nVertices).toBe(8)
    expect(metricas([exterior(), hueco(), hueco()]).nVertices).toBe(12)
  })

  it('el exterior sigue disponible aparte del total (la tolerancia oficial es del EXTERIOR)', () => {
    const m = metricas([exterior(), hueco()])
    expect(m.perimetro.exterior).not.toBe(m.perimetro.total)
  })
})

// ── deltaCatastral: null NO es cero ──────────────────────────────────────────

describe('edit/metricas.js · deltaCatastral cuando no hay superficie catastral', () => {
  it('sin `superficieCatastral` ⇒ deltaCatastral es null, NO {absoluto: 0}', () => {
    const m = metricas([exterior()])
    expect(m.deltaCatastral).toBeNull()
    // La distinción entera del campo: «no hay discrepancia» ≠ «no hay con qué
    // comparar». Un 0 aquí sería la afirmación falsa y tranquilizadora.
    expect(m.deltaCatastral).not.toEqual({ absoluto: 0, relativo: 0 })
    expect(m.deltaCatastral).not.toEqual({ absoluto: 0, relativo: null })
  })

  it('`superficieCatastral: null` explícito ⇒ igual de null', () => {
    expect(metricas([exterior()], { superficieCatastral: null }).deltaCatastral).toBeNull()
  })

  it('opciones ausentes, vacías o con el campo en undefined ⇒ null (no consta)', () => {
    expect(metricas([exterior()]).deltaCatastral).toBeNull()
    expect(metricas([exterior()], {}).deltaCatastral).toBeNull()
    expect(metricas([exterior()], { superficieCatastral: undefined }).deltaCatastral).toBeNull()
  })
})

describe('edit/metricas.js · deltaCatastral con signo', () => {
  it('medimos MÁS de lo inscrito ⇒ absoluto POSITIVO', () => {
    const m = metricas([exterior()], { superficieCatastral: 90 })
    expect(m.deltaCatastral.absoluto).toBeCloseTo(10, 12)
    expect(m.deltaCatastral.absoluto).toBeGreaterThan(0)
  })

  it('medimos MENOS de lo inscrito ⇒ absoluto NEGATIVO (el signo es información)', () => {
    const m = metricas([exterior()], { superficieCatastral: 110 })
    expect(m.deltaCatastral.absoluto).toBeCloseTo(-10, 12)
    expect(m.deltaCatastral.absoluto).toBeLessThan(0)
    // Y no el valor absoluto: quien pinta la ficha necesita saber hacia dónde.
    expect(m.deltaCatastral.absoluto).not.toBeCloseTo(10, 6)
  })

  it('coincidencia exacta ⇒ 0 y 0 (que aquí sí significa «no hay discrepancia»)', () => {
    const m = metricas([exterior()], { superficieCatastral: 100 })
    expect(m.deltaCatastral).toEqual({ absoluto: 0, relativo: 0 })
    expect(m.deltaCatastral).not.toBeNull() // ← el contraste con el bloque anterior
  })

  it('el delta se mide contra la superficie NETA, huecos ya descontados', () => {
    const m = metricas([exterior(), hueco()], { superficieCatastral: 100 })
    expect(m.deltaCatastral.absoluto).toBeCloseTo(-4, 12)
  })
})

describe('edit/metricas.js · `relativo` es FRACCIÓN, no porcentaje', () => {
  it('105 medidos contra 100 declarados ⇒ 0,05 y NO 5', () => {
    const m = metricas([{ vertices: [[0, 0], [10.5, 0], [10.5, 10], [0, 10]], tipo: 'EXTERIOR' }], {
      superficieCatastral: 100,
    })
    expect(m.superficie).toBeCloseTo(105, 12)
    expect(m.deltaCatastral.relativo).toBeCloseTo(0.05, 12)
    expect(m.deltaCatastral.relativo).not.toBeCloseTo(5, 6)
    // El × 100 es de PRESENTACIÓN y vive en la capa que pinta.
    expect(m.deltaCatastral.relativo * 100).toBeCloseTo(5, 10)
  })

  it('relativo = absoluto / declarada, con el mismo signo que el absoluto', () => {
    const m = metricas([exterior()], { superficieCatastral: 125 })
    expect(m.deltaCatastral.relativo).toBeCloseTo(m.deltaCatastral.absoluto / 125, 12)
    expect(m.deltaCatastral.relativo).toBeCloseTo(-0.2, 12)
  })

  it('no redondea: conserva los decimales completos de float64 (regla de oro 11)', () => {
    const m = metricas([{ vertices: [[0, 0], [3, 0], [3, 1.234567891], [0, 1.234567891]], tipo: 'EXTERIOR' }], {
      superficieCatastral: 4,
    })
    expect(m.superficie).toBeCloseTo(3.703703673, 9)
    expect(m.superficie).not.toBe(Math.round(m.superficie * 100) / 100)
    expect(m.deltaCatastral.absoluto).toBeCloseTo(-0.296296327, 9)
  })
})

describe('edit/metricas.js · superficieCatastral 0: ni Infinity ni NaN', () => {
  it('declarada 0 ⇒ absoluto calculable, relativo null', () => {
    const m = metricas([exterior()], { superficieCatastral: 0 })
    expect(m.deltaCatastral).not.toBeNull() // cero SÍ es un dato declarado
    expect(m.deltaCatastral.absoluto).toBeCloseTo(100, 12)
    expect(m.deltaCatastral.relativo).toBeNull()
  })

  it('nada de Infinity ni NaN en ninguna cifra', () => {
    const m = metricas([exterior()], { superficieCatastral: 0 })
    expect(Number.isFinite(m.deltaCatastral.absoluto)).toBe(true)
    expect(m.deltaCatastral.relativo).not.toBe(Infinity)
    expect(Number.isNaN(m.deltaCatastral.relativo)).toBe(false)
  })

  it('0 con geometría vacía tampoco produce NaN (0/0)', () => {
    const m = metricas([], { superficieCatastral: 0 })
    expect(m.deltaCatastral.absoluto).toBe(0)
    expect(m.deltaCatastral.relativo).toBeNull()
  })

  it('−0 se trata como 0 (mismo corte, mismo resultado)', () => {
    const m = metricas([exterior()], { superficieCatastral: -0 })
    expect(m.deltaCatastral.relativo).toBeNull()
  })
})

// ── El caso real del proyecto ────────────────────────────────────────────────

describe('edit/metricas.js · parcela real 9398516VK3799G (la diferencia ES el dato)', () => {
  const recintosReales = () => [
    { vertices: structuredClone(ring.anilloExterior), tipo: 'EXTERIOR' },
  ]

  it('el shoelace de las coordenadas del Catastro da ≈ 1535,87 m², no los 1536 declarados', () => {
    const m = metricas(recintosReales(), { superficieCatastral: ring.areaValue })
    expect(ring.areaValue).toBe(1536) // `cp:areaValue`, ENTERO (override O6)
    expect(m.superficie).toBeCloseTo(1535.865149996761, 9)
    expect(m.superficie).toBeCloseTo(1535.87, 2)
    // Lo que demuestra que la app MIDE en vez de repetir lo que le dieron:
    expect(m.superficie).not.toBe(1536)
    expect(m.nVertices).toBe(15) // anillo ABIERTO: 15, no los 16 del GML cerrado
  })

  it('Δ absoluto ≈ −0,13 m²: medimos algo MENOS que lo inscrito', () => {
    const m = metricas(recintosReales(), { superficieCatastral: ring.areaValue })
    expect(m.deltaCatastral.absoluto).toBeCloseTo(-0.134850003239, 9)
    expect(m.deltaCatastral.absoluto).toBeLessThan(0)
    expect(m.deltaCatastral.absoluto).toBeGreaterThan(-0.14)
    expect(m.deltaCatastral.absoluto).toBeLessThan(-0.13)
  })

  it('Δ relativo ≈ −8,8·10⁻⁵ (o sea −0,0088%), fracción y no porcentaje', () => {
    const m = metricas(recintosReales(), { superficieCatastral: ring.areaValue })
    expect(m.deltaCatastral.relativo).toBeCloseTo(-0.0000877930, 10)
    expect(Math.abs(m.deltaCatastral.relativo)).toBeLessThan(0.0001)
    expect(m.deltaCatastral.relativo * 100).toBeCloseTo(-0.0087793, 6)
  })

  it('la misma parcela SIN dato declarado ⇒ deltaCatastral null (un DXF, un dibujo)', () => {
    // El mismo polígono, distinta procedencia: sin `cp:areaValue` no hay nada
    // que comparar, y eso NO es una discrepancia de cero.
    const m = metricas(recintosReales())
    expect(m.superficie).toBeCloseTo(1535.865149996761, 9)
    expect(m.deltaCatastral).toBeNull()
  })

  it('el perímetro del anillo real es coherente con su superficie', () => {
    const m = metricas(recintosReales())
    expect(m.perimetro.exterior).toBeGreaterThan(100)
    expect(m.perimetro.exterior).toBeLessThan(400)
    expect(m.perimetro.total).toBe(m.perimetro.exterior) // sin huecos
    // Desigualdad isoperimétrica: P² ≥ 4π·A para cualquier polígono simple.
    expect(m.perimetro.exterior ** 2).toBeGreaterThan(4 * Math.PI * m.superficie)
  })
})

// ── Degenerados y POJOs incompletos ──────────────────────────────────────────

describe('edit/metricas.js · geometría vacía o incompleta (el store admite cualquier POJO)', () => {
  it('recintos vacío ⇒ todo a 0 y deltaCatastral null, sin lanzar', () => {
    const m = metricas([])
    expect(m.superficie).toBe(0)
    expect(m.perimetro).toEqual({ exterior: 0, huecos: 0, total: 0 })
    expect(m.nVertices).toBe(0)
    expect(m.deltaCatastral).toBeNull()
  })

  it('recintos vacío CON superficie declarada ⇒ Δ = −declarada, relativo −1', () => {
    const m = metricas([], { superficieCatastral: 1536 })
    expect(m.deltaCatastral.absoluto).toBe(-1536)
    expect(m.deltaCatastral.relativo).toBeCloseTo(-1, 12)
  })

  it('un recinto SIN `vertices` no tumba el cálculo: cuenta como 0', () => {
    const m = metricas([{ tipo: 'EXTERIOR' }])
    expect(m.superficie).toBe(0)
    expect(m.perimetro).toEqual({ exterior: 0, huecos: 0, total: 0 })
    expect(m.nVertices).toBe(0)
  })

  it('un HUECO sin `vertices` junto a un exterior válido no resta nada', () => {
    const m = metricas([exterior(), { tipo: 'HUECO' }, { tipo: 'HUECO', vertices: null }])
    expect(m.superficie).toBeCloseTo(100, 12)
    expect(m.perimetro.total).toBeCloseTo(40, 12)
    expect(m.nVertices).toBe(4)
  })

  it('anillos degenerados (0, 1 o 2 vértices) miden 0, no lanzan y no doblan nada', () => {
    // Mismo criterio que geo/area.js y geo/metrica.js: con n < 3 no hay anillo.
    expect(metricas([{ tipo: 'EXTERIOR', vertices: [] }]).superficie).toBe(0)
    expect(metricas([{ tipo: 'EXTERIOR', vertices: [[0, 0]] }]).perimetro.exterior).toBe(0)
    const segmento = metricas([{ tipo: 'EXTERIOR', vertices: [[0, 0], [3, 4]] }])
    expect(segmento.perimetro.exterior).toBe(0) // y no 10 (ida y vuelta)
    expect(segmento.nVertices).toBe(2) // los vértices SÍ se cuentan: están ahí
  })
})

// ── Contrato roto por el programador ─────────────────────────────────────────

describe('edit/metricas.js · contrato: lo que LANZA (bug del programador, no dato)', () => {
  it('`recintos` que no es array ⇒ TypeError nombrando el argumento', () => {
    for (const malo of [null, undefined, 42, 'recintos', { vertices: [] }]) {
      expect(() => metricas(malo)).toThrow(TypeError)
      expect(() => metricas(malo)).toThrow(/metricas: 'recintos' debe ser un array/)
    }
  })

  it('`superficieCatastral` que no es número finito ni null ⇒ TypeError', () => {
    for (const malo of [NaN, Infinity, -Infinity, '1536', {}, [], true]) {
      expect(() => metricas([exterior()], { superficieCatastral: malo })).toThrow(TypeError)
      expect(() => metricas([exterior()], { superficieCatastral: malo })).toThrow(
        /'superficieCatastral' debe ser número finito o null/,
      )
    }
  })

  it('el número suelto en vez del objeto de opciones LANZA en vez de perder el dato', () => {
    // `metricas(recintos, 1536)` devolvería deltaCatastral null en silencio: la
    // ficha diría «No consta» teniendo el 1536 delante (regla de oro 1).
    expect(() => metricas([exterior()], 1536)).toThrow(/las opciones deben ser un objeto/)
    expect(() => metricas([exterior()], null)).toThrow(TypeError)
    expect(() => metricas([exterior()], [1536])).toThrow(TypeError)
  })

  it('una superficie declarada NEGATIVA se acepta: es finita, y aquí no se juzga', () => {
    // Rara, pero es un número. Señalar lo absurdo es de la validación, no de una
    // función de medida (regla de oro 9).
    const m = metricas([exterior()], { superficieCatastral: -100 })
    expect(m.deltaCatastral.absoluto).toBeCloseTo(200, 12)
    expect(m.deltaCatastral.relativo).toBeCloseTo(-2, 12)
  })
})

describe('edit/metricas.js · el TypeError del invariante roto SUBE sin capturar', () => {
  it('recintos[0] que no es EXTERIOR ⇒ lanza geo/area.js, y no se absorbe aquí', () => {
    expect(() => metricas([hueco()])).toThrow(TypeError)
    expect(() => metricas([hueco()])).toThrow(/recintos\[0\] debe ser el EXTERIOR/)
  })

  it('un recinto posterior que no es HUECO ⇒ lanza nombrando el índice', () => {
    expect(() => metricas([exterior(), exterior()])).toThrow(/recintos\[1\] debe ser HUECO/)
    expect(() => metricas([exterior(), hueco(), exterior()])).toThrow(
      /recintos\[2\] debe ser HUECO/,
    )
  })

  it('un recinto sin `tipo` también lanza: el saneo NO inventa el invariante', () => {
    // `vertices` ausente se sustituye por [] (dato incompleto del store), pero
    // `tipo` pasa tal cual: un EXTERIOR que no lo dice es un bug del programa y
    // tiene que sonar, no medirse como si nada.
    expect(() => metricas([{ vertices: CUADRADO }])).toThrow(/recintos\[0\] debe ser el EXTERIOR/)
    expect(() => metricas([null])).toThrow(TypeError)
  })
})

// ── Regla de oro 9: mide y señala, no juzga ──────────────────────────────────

describe('edit/metricas.js · no juzga (regla de oro 9)', () => {
  const VOCABULARIO_DE_JUICIO = /^(ok|valido|válido|invalido|inválido|correcto|semaforo|semáforo|nivel|estado|tolerancia|dentroDeTolerancia|conforme|alerta|aviso|error|grado|color)$/i

  it('ninguna clave del resultado emite un veredicto', () => {
    const m = metricas([exterior(), hueco()], { superficieCatastral: 1536 })
    const juicios = clavesProfundas(m).filter((k) => VOCABULARIO_DE_JUICIO.test(k))
    expect(juicios).toEqual([])
  })

  it('el detector no es vacuo: dispara sobre un resultado que sí juzgara', () => {
    // Sin esto, el test de arriba daría verde para siempre aunque el regex
    // estuviera roto.
    const inventado = { superficie: 100, deltaCatastral: { absoluto: 1, dentroDeTolerancia: true } }
    expect(clavesProfundas(inventado).filter((k) => VOCABULARIO_DE_JUICIO.test(k))).toEqual([
      'dentroDeTolerancia',
    ])
  })

  it('un Δ del 4,9% y otro del 5,1% se devuelven igual de desnudos (≤5% es capa informativa)', () => {
    // La tolerancia oficial de superficie (SPEC §3) NO se aplica aquí: cruzarla
    // no cambia ni la forma ni el contenido del resultado. Interpretar y firmar
    // es del técnico colegiado.
    const dentro = metricas([exterior()], { superficieCatastral: 100 / 1.049 })
    const fuera = metricas([exterior()], { superficieCatastral: 100 / 1.051 })
    expect(Object.keys(dentro.deltaCatastral).sort()).toEqual(['absoluto', 'relativo'])
    expect(Object.keys(fuera.deltaCatastral).sort()).toEqual(['absoluto', 'relativo'])
    expect(dentro.deltaCatastral.relativo).toBeCloseTo(0.049, 3)
    expect(fuera.deltaCatastral.relativo).toBeCloseTo(0.051, 3)
  })

  it('los valores son números crudos: nada de strings formateados ni unidades', () => {
    const m = metricas([exterior()], { superficieCatastral: 90 })
    expect(typeof m.superficie).toBe('number')
    expect(typeof m.perimetro.exterior).toBe('number')
    expect(typeof m.nVertices).toBe('number')
    expect(typeof m.deltaCatastral.absoluto).toBe('number')
    expect(typeof m.deltaCatastral.relativo).toBe('number')
  })
})

// ── Pureza ───────────────────────────────────────────────────────────────────

describe('edit/metricas.js · función pura', () => {
  it('no muta la entrada (ni los recintos ni sus vértices)', () => {
    const recintos = [exterior(), hueco()]
    const antes = structuredClone(recintos)
    metricas(recintos, { superficieCatastral: 1536 })
    expect(recintos).toEqual(antes)
  })

  it('funciona sobre una entrada CONGELADA en profundidad', () => {
    // Si en algún punto se escribiera sobre los recintos recibidos, en modo
    // estricto esto lanzaría. Se llama en cada `mousemove` sobre el estado del
    // store: escribirlo sería corromper el modelo mientras se dibuja.
    const recintos = congelar([exterior(), hueco()])
    const m = metricas(recintos, { superficieCatastral: 96 })
    expect(m.superficie).toBeCloseTo(96, 12)
    expect(m.deltaCatastral.absoluto).toBeCloseTo(0, 12)
  })

  it('no muta el objeto de opciones', () => {
    const opciones = { superficieCatastral: 1536 }
    metricas([exterior()], opciones)
    expect(opciones).toEqual({ superficieCatastral: 1536 })
  })

  it('llamarla mil veces (un arrastre) da siempre lo mismo: no hay caché ni estado', () => {
    const recintos = [exterior(), hueco()]
    const primera = metricas(recintos, { superficieCatastral: 96 })
    for (let i = 0; i < 1000; i++) {
      expect(metricas(recintos, { superficieCatastral: 96 })).toEqual(primera)
    }
  })

  it('devuelve una estructura NUEVA en cada llamada (nadie comparte el objeto)', () => {
    const recintos = [exterior()]
    const a = metricas(recintos)
    const b = metricas(recintos)
    expect(a).not.toBe(b)
    expect(a.perimetro).not.toBe(b.perimetro)
    expect(a).toEqual(b)
  })
})
