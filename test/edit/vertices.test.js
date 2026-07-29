import { describe, it, expect } from 'vitest'
import {
  insertarVertice,
  eliminarVertice,
  MINIMO_VERTICES,
  MOTIVO_VERTICE,
  MENSAJE_POR_MOTIVO,
} from '../../edit/vertices.js'

// ── Fixture ──────────────────────────────────────────────────────────────────
// Coordenadas UTM realistas (huso 30, Norte ≈ 4,48·10⁶) y anillos ABIERTOS: el
// vértice de cierre NO está, que es justo lo que hace interesante al «lado de
// cierre» (v[n-1] → v[0]).

/** Exterior de 5 vértices. */
const EXTERIOR = [
  [440000, 4480000],
  [440020, 4480000],
  [440020, 4480015],
  [440010, 4480022.5],
  [440000, 4480015],
]

/** Hueco de 4 vértices (uno más del mínimo: se le puede quitar exactamente uno). */
const HUECO = [
  [440005, 4480005],
  [440012, 4480005],
  [440012, 4480010],
  [440005, 4480010],
]

/** Recintos frescos en cada test: `recintos[0]` EXTERIOR, el resto HUECOS (§4.3). */
const base = () =>
  structuredClone([
    { vertices: EXTERIOR, tipo: 'EXTERIOR' },
    { vertices: HUECO, tipo: 'HUECO' },
  ])

/** Un solo recinto exterior con `n` vértices, para tocar el suelo del mínimo. */
const exteriorDe = (n) => [
  {
    vertices: Array.from({ length: n }, (_, i) => [440000 + i, 4480000 + i * 2]),
    tipo: 'EXTERIOR',
  },
]

/** Congela en profundidad: cualquier mutación en sitio lanzaría (modo estricto). */
function congelar(valor) {
  if (valor && typeof valor === 'object') {
    for (const v of Object.values(valor)) congelar(v)
    Object.freeze(valor)
  }
  return valor
}

/**
 * Recoge todos los objetos/arrays alcanzables desde `valor`. Sirve para afirmar
 * que dos estructuras no comparten NI UNA referencia.
 */
function referencias(valor, acc = new Set()) {
  if (valor && typeof valor === 'object') {
    acc.add(valor)
    for (const v of Object.values(valor)) referencias(v, acc)
  }
  return acc
}

/** Referencias compartidas entre dos estructuras (debe ser siempre vacío). */
function compartidas(a, b) {
  const refsB = referencias(b)
  return [...referencias(a)].filter((o) => refsB.has(o))
}

// ── Vocabulario ──────────────────────────────────────────────────────────────

describe('edit/vertices.js — vocabulario público', () => {
  it('MOTIVO_VERTICE está congelado y trae MINIMO_TRES_VERTICES', () => {
    expect(Object.isFrozen(MOTIVO_VERTICE)).toBe(true)
    expect(MOTIVO_VERTICE.MINIMO_TRES_VERTICES).toBe('MINIMO_TRES_VERTICES')
  })

  it('MENSAJE_POR_MOTIVO es TOTAL sobre MOTIVO_VERTICE, congelado y en español presentable', () => {
    expect(Object.isFrozen(MENSAJE_POR_MOTIVO)).toBe(true)
    expect(Object.keys(MENSAJE_POR_MOTIVO).sort()).toEqual(Object.values(MOTIVO_VERTICE).sort())
    for (const motivo of Object.values(MOTIVO_VERTICE)) {
      const texto = MENSAJE_POR_MOTIVO[motivo]
      expect(typeof texto, `${motivo} sin texto`).toBe('string')
      expect(texto.length).toBeGreaterThan(20)
    }
    // La UI no tiene que escribirlo: el texto ya nombra el mínimo.
    expect(MENSAJE_POR_MOTIVO[MOTIVO_VERTICE.MINIMO_TRES_VERTICES]).toContain(
      String(MINIMO_VERTICES),
    )
  })

  it('MINIMO_VERTICES es 3 (suelo geométrico, no preferencia)', () => {
    expect(MINIMO_VERTICES).toBe(3)
  })
})

// ── insertarVertice ──────────────────────────────────────────────────────────

describe('edit/vertices.js — insertarVertice', () => {
  it('inserta en un lado INTERIOR: el vértice nuevo queda en indice+1', () => {
    const recintos = base()
    const punto = [440020, 4480007.5] // punto medio del lado 1→2
    const salida = insertarVertice(recintos, { recinto: 0, indice: 1 }, punto)

    expect(salida[0].vertices).toHaveLength(EXTERIOR.length + 1)
    expect(salida[0].vertices[2]).toEqual(punto)
    // El resto del anillo conserva su orden, desplazado a partir de indice+1.
    expect(salida[0].vertices).toEqual([
      EXTERIOR[0],
      EXTERIOR[1],
      punto,
      EXTERIOR[2],
      EXTERIOR[3],
      EXTERIOR[4],
    ])
  })

  it('inserta en el lado de CIERRE (último índice): el vértice nuevo va AL FINAL', () => {
    const recintos = base()
    const ultimo = EXTERIOR.length - 1
    const punto = [440000, 4480007.5] // punto medio del lado v[n-1] → v[0]
    const salida = insertarVertice(recintos, { recinto: 0, indice: ultimo }, punto)

    // El anillo sigue ABIERTO: nada se ha metido delante de v[0] ni se ha cerrado.
    expect(salida[0].vertices).toEqual([...EXTERIOR, punto])
    expect(salida[0].vertices.at(-1)).toEqual(punto)
    expect(salida[0].vertices[0]).toEqual(EXTERIOR[0])
  })

  it('inserta en el lado 0→1 con el índice 0 (primer lado materializado)', () => {
    const salida = insertarVertice(base(), { recinto: 0, indice: 0 }, [440010, 4480000])
    expect(salida[0].vertices[1]).toEqual([440010, 4480000])
    expect(salida[0].vertices[0]).toEqual(EXTERIOR[0])
  })

  it('NO muta la entrada (ni el array, ni los recintos, ni los vértices)', () => {
    const recintos = base()
    const antes = structuredClone(recintos)

    insertarVertice(recintos, { recinto: 0, indice: 1 }, [440020, 4480007.5])
    insertarVertice(recintos, { recinto: 1, indice: 3 }, [440005, 4480007.5])

    expect(recintos).toEqual(antes)
    expect(recintos[0].vertices).toHaveLength(EXTERIOR.length)
    expect(recintos[1].vertices).toHaveLength(HUECO.length)
  })

  it('con la entrada CONGELADA en profundidad no lanza: no intenta mutar nada', () => {
    const recintos = congelar(base())
    expect(() => insertarVertice(recintos, { recinto: 0, indice: 2 }, [1, 2])).not.toThrow()
    const salida = insertarVertice(recintos, { recinto: 0, indice: 2 }, [440015, 4480018])
    expect(salida[0].vertices).toHaveLength(EXTERIOR.length + 1)
    // Y la salida sí es editable (structuredClone no propaga el congelado).
    expect(Object.isFrozen(salida[0].vertices)).toBe(false)
  })

  it('los recintos devueltos NO comparten ninguna referencia con la entrada', () => {
    const recintos = base()
    const salida = insertarVertice(recintos, { recinto: 0, indice: 1 }, [440020, 4480007.5])

    expect(salida).not.toBe(recintos)
    expect(salida[0]).not.toBe(recintos[0])
    expect(salida[0].vertices).not.toBe(recintos[0].vertices)
    expect(salida[0].vertices[0]).not.toBe(recintos[0].vertices[0])
    // También el recinto NO tocado: nadie debe poder mutar «lo que no cambió».
    expect(salida[1]).not.toBe(recintos[1])
    expect(salida[1].vertices).not.toBe(recintos[1].vertices)
    expect(salida[1].vertices[0]).not.toBe(recintos[1].vertices[0])
    // Barrido exhaustivo: cero objetos en común.
    expect(compartidas(recintos, salida)).toEqual([])

    // Mutar la salida no toca la entrada, y al revés.
    salida[1].vertices[0][0] = -1
    expect(recintos[1].vertices[0][0]).toBe(HUECO[0][0])
  })

  it('el `punto` recibido no se aliasa: mutarlo después no cambia el modelo', () => {
    const punto = [440020, 4480007.5]
    const salida = insertarVertice(base(), { recinto: 0, indice: 1 }, punto)
    punto[0] = 999
    expect(salida[0].vertices[2]).toEqual([440020, 4480007.5])
    expect(salida[0].vertices[2]).not.toBe(punto)
  })

  it('inserta en un HUECO (recinto 1) sin tocar el EXTERIOR', () => {
    const recintos = base()
    const punto = [440012, 4480007.5]
    const salida = insertarVertice(recintos, { recinto: 1, indice: 1 }, punto)

    expect(salida[1].vertices).toHaveLength(HUECO.length + 1)
    expect(salida[1].vertices[2]).toEqual(punto)
    expect(salida[0].vertices).toEqual(EXTERIOR) // exterior intacto
  })

  it('no cambia el tipo ni el orden de ningún recinto (invariante EXTERIOR/HUECOS)', () => {
    const recintos = [
      { vertices: structuredClone(EXTERIOR), tipo: 'EXTERIOR' },
      { vertices: structuredClone(HUECO), tipo: 'HUECO' },
      { vertices: structuredClone(HUECO), tipo: 'HUECO' },
    ]
    const salida = insertarVertice(recintos, { recinto: 2, indice: 0 }, [440006, 4480006])
    expect(salida.map((r) => r.tipo)).toEqual(['EXTERIOR', 'HUECO', 'HUECO'])
    expect(salida).toHaveLength(3)
    expect(salida[0].tipo).toBe('EXTERIOR')
  })

  it('conserva las propiedades del recinto que no son la geometría', () => {
    const recintos = [{ vertices: structuredClone(EXTERIOR), tipo: 'EXTERIOR', origen: 'WFS' }]
    const salida = insertarVertice(recintos, { recinto: 0, indice: 0 }, [1, 2])
    expect(salida[0].origen).toBe('WFS')
  })

  it('acepta un anillo de 3 vértices (mínimo) y lo deja en 4', () => {
    const salida = insertarVertice(exteriorDe(3), { recinto: 0, indice: 2 }, [7, 8])
    expect(salida[0].vertices).toHaveLength(4)
    expect(salida[0].vertices.at(-1)).toEqual([7, 8])
  })

  // ── Contrato roto por el PROGRAMADOR → throw (regla 1) ─────────────────────

  it('LANZA TypeError si `recintos` no es un array', () => {
    for (const malo of [null, undefined, 42, 'recintos', { 0: {} }]) {
      expect(() => insertarVertice(malo, { recinto: 0, indice: 0 }, [1, 2])).toThrow(TypeError)
    }
    expect(() => insertarVertice(null, { recinto: 0, indice: 0 }, [1, 2])).toThrow(
      /insertarVertice: 'recintos'/,
    )
  })

  it('LANZA TypeError si la referencia no tiene la forma {recinto, indice}', () => {
    const r = base()
    for (const mala of [null, undefined, 3, 'r0', [0, 0]]) {
      expect(() => insertarVertice(r, mala, [1, 2])).toThrow(TypeError)
    }
    expect(() => insertarVertice(r, { recinto: 0.5, indice: 0 }, [1, 2])).toThrow(/'recinto'/)
    expect(() => insertarVertice(r, { recinto: 0, indice: '1' }, [1, 2])).toThrow(/'indice'/)
    expect(() => insertarVertice(r, { recinto: 0, indice: NaN }, [1, 2])).toThrow(TypeError)
  })

  it('LANZA RangeError si `recinto` o `indice` se salen del rango real', () => {
    const r = base()
    expect(() => insertarVertice(r, { recinto: 2, indice: 0 }, [1, 2])).toThrow(RangeError)
    expect(() => insertarVertice(r, { recinto: -1, indice: 0 }, [1, 2])).toThrow(RangeError)
    expect(() => insertarVertice(r, { recinto: 0, indice: 5 }, [1, 2])).toThrow(RangeError)
    expect(() => insertarVertice(r, { recinto: 0, indice: -1 }, [1, 2])).toThrow(RangeError)
    // El mensaje dice lo recibido y el rango válido.
    expect(() => insertarVertice(r, { recinto: 0, indice: 9 }, [1, 2])).toThrow(/9/)
    expect(() => insertarVertice(r, { recinto: 0, indice: 9 }, [1, 2])).toThrow(/0\.\.4/)
    // Un anillo vacío no tiene ningún índice válido.
    expect(() =>
      insertarVertice([{ vertices: [], tipo: 'EXTERIOR' }], { recinto: 0, indice: 0 }, [1, 2]),
    ).toThrow(RangeError)
  })

  it('LANZA TypeError si el recinto señalado no tiene `vertices` array', () => {
    expect(() => insertarVertice([{ tipo: 'EXTERIOR' }], { recinto: 0, indice: 0 }, [1, 2])).toThrow(
      TypeError,
    )
    expect(() => insertarVertice([null], { recinto: 0, indice: 0 }, [1, 2])).toThrow(TypeError)
  })

  it('LANZA TypeError si `punto` no es un par UTM de números finitos', () => {
    const r = base()
    for (const malo of [null, undefined, [1], [NaN, 2], [1, Infinity], ['1', '2'], { x: 1, y: 2 }, 5]) {
      expect(() => insertarVertice(r, { recinto: 0, indice: 0 }, malo)).toThrow(TypeError)
    }
    expect(() => insertarVertice(r, { recinto: 0, indice: 0 }, [1, NaN])).toThrow(
      /insertarVertice: 'punto'/,
    )
  })
})

// ── eliminarVertice ──────────────────────────────────────────────────────────

describe('edit/vertices.js — eliminarVertice', () => {
  it('de 5 a 4 vértices: elimina el señalado y devuelve motivo null', () => {
    const recintos = base()
    const { recintos: salida, motivo } = eliminarVertice(recintos, { recinto: 0, indice: 2 })

    expect(motivo).toBe(null)
    expect(salida[0].vertices).toHaveLength(4)
    expect(salida[0].vertices).toEqual([EXTERIOR[0], EXTERIOR[1], EXTERIOR[3], EXTERIOR[4]])
  })

  it('elimina el PRIMER y el ÚLTIMO vértice sin casos especiales', () => {
    const primero = eliminarVertice(base(), { recinto: 0, indice: 0 })
    expect(primero.motivo).toBe(null)
    expect(primero.recintos[0].vertices).toEqual(EXTERIOR.slice(1))

    const ultimo = eliminarVertice(base(), { recinto: 0, indice: EXTERIOR.length - 1 })
    expect(ultimo.motivo).toBe(null)
    expect(ultimo.recintos[0].vertices).toEqual(EXTERIOR.slice(0, -1))
  })

  it('de 4 a 3 sí se puede: el mínimo es un suelo, no un margen', () => {
    const { recintos: salida, motivo } = eliminarVertice(exteriorDe(4), { recinto: 0, indice: 1 })
    expect(motivo).toBe(null)
    expect(salida[0].vertices).toHaveLength(MINIMO_VERTICES)
  })

  it('de 3 a 2 NO se hace: devuelve motivo MINIMO_TRES_VERTICES y recintos null, SIN lanzar', () => {
    const recintos = exteriorDe(3)
    let resultado
    expect(() => {
      resultado = eliminarVertice(recintos, { recinto: 0, indice: 1 })
    }).not.toThrow() // es dato del USUARIO: se describe, no se lanza (regla 1)

    expect(resultado).toEqual({ recintos: null, motivo: 'MINIMO_TRES_VERTICES' })
    expect(resultado.motivo).toBe(MOTIVO_VERTICE.MINIMO_TRES_VERTICES)
    // Y la UI tiene el texto sin escribirlo a mano.
    expect(typeof MENSAJE_POR_MOTIVO[resultado.motivo]).toBe('string')
    // La entrada sigue exactamente igual: no se ha tocado nada.
    expect(recintos[0].vertices).toHaveLength(3)
  })

  it('el rechazo por mínimo se aplica a CUALQUIER índice del anillo de 3', () => {
    const recintos = exteriorDe(3)
    for (const indice of [0, 1, 2]) {
      const r = eliminarVertice(recintos, { recinto: 0, indice })
      expect(r.recintos).toBe(null)
      expect(r.motivo).toBe(MOTIVO_VERTICE.MINIMO_TRES_VERTICES)
    }
  })

  it('NO muta la entrada', () => {
    const recintos = base()
    const antes = structuredClone(recintos)

    eliminarVertice(recintos, { recinto: 0, indice: 0 })
    eliminarVertice(recintos, { recinto: 1, indice: 3 })

    expect(recintos).toEqual(antes)
    expect(recintos[0].vertices).toHaveLength(EXTERIOR.length)
    expect(recintos[1].vertices).toHaveLength(HUECO.length)
  })

  it('con la entrada CONGELADA en profundidad no lanza', () => {
    const recintos = congelar(base())
    expect(() => eliminarVertice(recintos, { recinto: 0, indice: 0 })).not.toThrow()
    expect(eliminarVertice(recintos, { recinto: 0, indice: 0 }).recintos[0].vertices).toHaveLength(4)
  })

  it('los recintos devueltos NO comparten ninguna referencia con la entrada', () => {
    const recintos = base()
    const { recintos: salida } = eliminarVertice(recintos, { recinto: 0, indice: 2 })

    expect(salida).not.toBe(recintos)
    expect(salida[0].vertices).not.toBe(recintos[0].vertices)
    expect(salida[1].vertices).not.toBe(recintos[1].vertices)
    expect(compartidas(recintos, salida)).toEqual([])

    salida[1].vertices[0][1] = -1
    expect(recintos[1].vertices[0][1]).toBe(HUECO[0][1])
  })

  it('elimina en un HUECO (recinto 1) sin tocar el EXTERIOR', () => {
    const recintos = base()
    const { recintos: salida, motivo } = eliminarVertice(recintos, { recinto: 1, indice: 2 })

    expect(motivo).toBe(null)
    expect(salida[1].vertices).toEqual([HUECO[0], HUECO[1], HUECO[3]])
    expect(salida[0].vertices).toEqual(EXTERIOR) // exterior intacto
  })

  it('un HUECO en el mínimo se rechaza sin arrastrar al exterior', () => {
    const recintos = [
      { vertices: structuredClone(EXTERIOR), tipo: 'EXTERIOR' },
      { vertices: structuredClone(HUECO).slice(0, 3), tipo: 'HUECO' },
    ]
    const r = eliminarVertice(recintos, { recinto: 1, indice: 0 })
    expect(r.recintos).toBe(null)
    expect(r.motivo).toBe(MOTIVO_VERTICE.MINIMO_TRES_VERTICES)
    expect(recintos[0].vertices).toHaveLength(EXTERIOR.length)
  })

  it('no cambia el tipo ni el orden de ningún recinto (invariante EXTERIOR/HUECOS)', () => {
    const recintos = [
      { vertices: structuredClone(EXTERIOR), tipo: 'EXTERIOR' },
      { vertices: structuredClone(HUECO), tipo: 'HUECO' },
      { vertices: structuredClone(HUECO), tipo: 'HUECO' },
    ]
    const { recintos: salida } = eliminarVertice(recintos, { recinto: 1, indice: 0 })
    expect(salida).toHaveLength(3)
    expect(salida.map((r) => r.tipo)).toEqual(['EXTERIOR', 'HUECO', 'HUECO'])
  })

  // ── Contrato roto por el PROGRAMADOR → throw (regla 1) ─────────────────────

  it('LANZA TypeError si `recintos` no es un array', () => {
    for (const malo of [null, undefined, 42, 'recintos', { length: 1 }]) {
      expect(() => eliminarVertice(malo, { recinto: 0, indice: 0 })).toThrow(TypeError)
    }
    expect(() => eliminarVertice(undefined, { recinto: 0, indice: 0 })).toThrow(
      /eliminarVertice: 'recintos'/,
    )
  })

  it('LANZA TypeError si la referencia no tiene la forma {recinto, indice}', () => {
    const r = base()
    for (const mala of [null, undefined, 0, 'r0', [0, 0]]) {
      expect(() => eliminarVertice(r, mala)).toThrow(TypeError)
    }
    expect(() => eliminarVertice(r, { recinto: '0', indice: 0 })).toThrow(/'recinto'/)
    expect(() => eliminarVertice(r, { recinto: 0, indice: 1.5 })).toThrow(/'indice'/)
  })

  it('LANZA RangeError si `recinto` o `indice` se salen del rango real', () => {
    const r = base()
    expect(() => eliminarVertice(r, { recinto: 2, indice: 0 })).toThrow(RangeError)
    expect(() => eliminarVertice(r, { recinto: -1, indice: 0 })).toThrow(RangeError)
    expect(() => eliminarVertice(r, { recinto: 0, indice: 5 })).toThrow(RangeError)
    expect(() => eliminarVertice(r, { recinto: 1, indice: 4 })).toThrow(RangeError)
    expect(() => eliminarVertice([], { recinto: 0, indice: 0 })).toThrow(RangeError)
  })

  it('el rango se comprueba ANTES que el mínimo: un índice inválido es un bug, no un dato', () => {
    // Anillo de 3 (rechazable por mínimo) con un índice imposible: manda el throw.
    expect(() => eliminarVertice(exteriorDe(3), { recinto: 0, indice: 7 })).toThrow(RangeError)
  })

  it('LANZA TypeError si el recinto señalado no tiene `vertices` array', () => {
    expect(() => eliminarVertice([{ tipo: 'EXTERIOR' }], { recinto: 0, indice: 0 })).toThrow(
      TypeError,
    )
  })
})

// ── Composición ──────────────────────────────────────────────────────────────

describe('edit/vertices.js — insertar y eliminar componen', () => {
  it('insertar y luego eliminar el vértice insertado devuelve la geometría original', () => {
    const recintos = base()
    const conNuevo = insertarVertice(recintos, { recinto: 0, indice: 1 }, [440020, 4480007.5])
    const { recintos: vuelta, motivo } = eliminarVertice(conNuevo, { recinto: 0, indice: 2 })

    expect(motivo).toBe(null)
    expect(vuelta).toEqual(recintos)
    expect(vuelta).not.toBe(recintos)
  })

  it('insertar en el lado de cierre y eliminar el último deshace la operación', () => {
    const recintos = base()
    const conNuevo = insertarVertice(
      recintos,
      { recinto: 0, indice: EXTERIOR.length - 1 },
      [440000, 4480007.5],
    )
    const { recintos: vuelta } = eliminarVertice(conNuevo, { recinto: 0, indice: EXTERIOR.length })
    expect(vuelta).toEqual(recintos)
  })
})
