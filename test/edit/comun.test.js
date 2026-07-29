import { describe, it, expect } from 'vitest'
import { describir, exigirRecintos, exigirRef } from '../../edit/_comun.js'

// F06/T3.4 — edit/_comun.js: los tres guardianes que `edit/vertices.js` y
// `edit/offset.js` tenían duplicados (y `describir`, que además usan
// `edit/snap.js` y `edit/metricas.js`). Esta suite prueba los helpers YA
// UNIFICADOS; las 206 pruebas de `test/edit/vertices.test.js`,
// `test/edit/offset.test.js`, `test/edit/snap.test.js` y
// `test/edit/metricas.test.js` siguen ejerciendo el mismo contrato a través de
// los cuatro módulos públicos, sin tocar ni una.

/** Recintos de prueba: un EXTERIOR de 4 vértices y un HUECO de 3. */
const recintos = () => [
  { vertices: [[0, 0], [10, 0], [10, 10], [0, 10]], tipo: 'EXTERIOR' },
  { vertices: [[2, 2], [4, 2], [4, 4]], tipo: 'HUECO' },
]

// ── describir ────────────────────────────────────────────────────────────────

describe('edit/_comun.js — describir: redacta el valor recibido para un throw', () => {
  it('undefined da el literal "undefined" (no "undefined undefined")', () => {
    expect(describir(undefined)).toBe('undefined')
  })

  it('una función da el literal "function", sin intentar serializarla', () => {
    expect(describir(() => {})).toBe('function')
    expect(describir(function nombrada() {})).toBe('function')
  })

  it('valores serializables llevan el tipo Y el JSON', () => {
    expect(describir(42)).toBe('number 42')
    expect(describir('hola')).toBe('string "hola"')
    expect(describir(true)).toBe('boolean true')
    expect(describir([1, 2])).toBe('object [1,2]')
    expect(describir({ recinto: 0, indice: 1 })).toBe('object {"recinto":0,"indice":1}')
  })

  it('null es serializable (JSON.stringify(null) === "null")', () => {
    expect(describir(null)).toBe('object null')
  })

  it('NaN e Infinity no son JSON válido: JSON.stringify los convierte en "null"', () => {
    // No es un caso de "no serializable" (eso lanzaría o devolvería undefined):
    // JSON.stringify(NaN) da la CADENA "null", así que el texto sale igual que
    // el de null, con el tipo correcto delante.
    expect(describir(NaN)).toBe('number null')
    expect(describir(Infinity)).toBe('number null')
  })

  it('un objeto con referencia CIRCULAR no es serializable: cae al catch', () => {
    const circular = {}
    circular.self = circular
    expect(describir(circular)).toBe('object (no serializable)')
  })

  it('un BigInt tampoco es serializable (JSON.stringify lo lanza)', () => {
    expect(describir(10n)).toBe('bigint (no serializable)')
  })

  it('un Symbol: JSON.stringify(symbol) devuelve undefined (no lanza), y se usa String(valor)', () => {
    const s = Symbol('x')
    expect(describir(s)).toBe(String(s))
  })
})

// ── exigirRecintos ───────────────────────────────────────────────────────────

describe('edit/_comun.js — exigirRecintos: contrato del llamante', () => {
  it('no lanza si `recintos` es un array, vacío o no', () => {
    expect(() => exigirRecintos([], 'fnDePrueba')).not.toThrow()
    expect(() => exigirRecintos(recintos(), 'fnDePrueba')).not.toThrow()
  })

  it('LANZA TypeError nombrando la función y lo recibido si no es un array', () => {
    for (const malo of [null, undefined, 42, 'recintos', { 0: {} }]) {
      expect(() => exigirRecintos(malo, 'fnDePrueba')).toThrow(TypeError)
    }
    expect(() => exigirRecintos(null, 'fnDePrueba')).toThrow(
      /fnDePrueba: 'recintos' debe ser un array de recintos; recibido/,
    )
    expect(() => exigirRecintos(undefined, 'otraFn')).toThrow(/otraFn: 'recintos'/)
  })

  it('no devuelve nada (es una guarda, no un adaptador)', () => {
    expect(exigirRecintos(recintos(), 'fnDePrueba')).toBeUndefined()
  })
})

// ── exigirRef ────────────────────────────────────────────────────────────────

describe('edit/_comun.js — exigirRef: la referencia {recinto, indice} apunta a un vértice que EXISTE', () => {
  it('con una referencia válida devuelve {recinto, indice, vertices} del recinto señalado', () => {
    const r = recintos()
    const resultado = exigirRef(r, { recinto: 1, indice: 2 }, 'fnDePrueba')
    expect(resultado).toEqual({ recinto: 1, indice: 2, vertices: r[1].vertices })
    // `vertices` es el array REAL del recinto (por referencia): el llamante lo
    // usa para leer y para construir la salida, no es una copia.
    expect(resultado.vertices).toBe(r[1].vertices)
  })

  it('acepta el ÚLTIMO índice del anillo (el que abre el lado de CIERRE)', () => {
    const r = recintos()
    expect(() => exigirRef(r, { recinto: 0, indice: 3 }, 'fnDePrueba')).not.toThrow()
  })

  // ── Forma de la referencia → TypeError ──────────────────────────────────────

  it('LANZA TypeError si la referencia no es un objeto {recinto, indice}', () => {
    const r = recintos()
    for (const mala of [null, undefined, 3, 'r0', [0, 0], true]) {
      expect(() => exigirRef(r, mala, 'fnDePrueba')).toThrow(TypeError)
    }
    expect(() => exigirRef(r, null, 'fnDePrueba')).toThrow(
      /fnDePrueba: la referencia debe ser \{recinto, indice\}; recibido/,
    )
  })

  it('LANZA TypeError si `recinto` no es un entero', () => {
    const r = recintos()
    for (const recinto of [0.5, '0', NaN, null, undefined, [0]]) {
      expect(() => exigirRef(r, { recinto, indice: 0 }, 'fnDePrueba')).toThrow(TypeError)
    }
    expect(() => exigirRef(r, { recinto: 0.5, indice: 0 }, 'fnDePrueba')).toThrow(
      /fnDePrueba: 'recinto' debe ser un entero/,
    )
  })

  it('LANZA TypeError si `indice` no es un entero', () => {
    const r = recintos()
    for (const indice of [1.5, '1', NaN, null, undefined]) {
      expect(() => exigirRef(r, { recinto: 0, indice }, 'fnDePrueba')).toThrow(TypeError)
    }
    expect(() => exigirRef(r, { recinto: 0, indice: '1' }, 'fnDePrueba')).toThrow(
      /fnDePrueba: 'indice' debe ser un entero/,
    )
  })

  it('el entero de `recinto` se comprueba ANTES que su rango: un `recinto` no-entero es TypeError, no RangeError', () => {
    expect(() => exigirRef(recintos(), { recinto: 0.5, indice: 0 }, 'fnDePrueba')).toThrow(TypeError)
  })

  // ── Rango real de la estructura → RangeError ────────────────────────────────

  it('LANZA RangeError si `recinto` está fuera de rango, y dice el rango válido', () => {
    const r = recintos()
    expect(() => exigirRef(r, { recinto: 2, indice: 0 }, 'fnDePrueba')).toThrow(RangeError)
    expect(() => exigirRef(r, { recinto: -1, indice: 0 }, 'fnDePrueba')).toThrow(RangeError)
    expect(() => exigirRef(r, { recinto: 2, indice: 0 }, 'fnDePrueba')).toThrow(/Válidos 0\.\.1/)
  })

  it('con `recintos` vacío, el mensaje de `recinto` fuera de rango dice que no hay ninguno', () => {
    expect(() => exigirRef([], { recinto: 0, indice: 0 }, 'fnDePrueba')).toThrow(
      /No hay ningún recinto/,
    )
  })

  it('LANZA TypeError si el recinto señalado no tiene `vertices` array', () => {
    expect(() => exigirRef([{ tipo: 'EXTERIOR' }], { recinto: 0, indice: 0 }, 'fnDePrueba')).toThrow(
      TypeError,
    )
    expect(() => exigirRef([null], { recinto: 0, indice: 0 }, 'fnDePrueba')).toThrow(TypeError)
    expect(() =>
      exigirRef([{ vertices: 'no soy un array', tipo: 'EXTERIOR' }], { recinto: 0, indice: 0 }, 'fnDePrueba'),
    ).toThrow(/recintos\[0\] debe ser un recinto con 'vertices' array/)
  })

  it('LANZA RangeError si `indice` está fuera de rango, con el nº de vértices y el rango válido', () => {
    const r = recintos()
    expect(() => exigirRef(r, { recinto: 0, indice: 4 }, 'fnDePrueba')).toThrow(RangeError)
    expect(() => exigirRef(r, { recinto: 0, indice: -1 }, 'fnDePrueba')).toThrow(RangeError)
    expect(() => exigirRef(r, { recinto: 0, indice: 9 }, 'fnDePrueba')).toThrow(/9/)
    expect(() => exigirRef(r, { recinto: 0, indice: 9 }, 'fnDePrueba')).toThrow(/0\.\.3/)
    expect(() => exigirRef(r, { recinto: 0, indice: 9 }, 'fnDePrueba')).toThrow(/4 vértice/)
  })

  it('con un anillo vacío, el mensaje de `indice` fuera de rango dice que no hay ningún vértice', () => {
    expect(() =>
      exigirRef([{ vertices: [], tipo: 'EXTERIOR' }], { recinto: 0, indice: 0 }, 'fnDePrueba'),
    ).toThrow(/no tiene ningún vértice/)
  })

  it('el `RangeError` de `indice` NOMBRA el lado de CIERRE (n−1) — la versión más informativa de las dos copias', () => {
    // Divergencia real entre `edit/offset.js` y `edit/vertices.js` (ver la
    // cabecera de `edit/_comun.js`): solo la de `offset.js` incluía esta
    // cláusula. Se adopta para las dos procedencias porque es estrictamente
    // más informativa y ningún test de `vertices.test.js` fija el texto
    // contrario.
    const r = recintos() // recintos[0] tiene 4 vértices: el lado de cierre es el 3
    expect(() => exigirRef(r, { recinto: 0, indice: 9 }, 'fnDePrueba')).toThrow(
      /el lado 3 es el de CIERRE/,
    )
  })

  it('el rango se comprueba ANTES que la forma del recinto: un `recinto` inexistente es RangeError', () => {
    expect(() => exigirRef([], { recinto: 0, indice: 0 }, 'fnDePrueba')).toThrow(RangeError)
  })

  it('el nombre de función (`fn`) aparece en TODOS los mensajes, cualquiera que sea la rama', () => {
    const r = recintos()
    const casos = [
      () => exigirRef(r, null, 'miFuncionUnica'),
      () => exigirRef(r, { recinto: 0.5, indice: 0 }, 'miFuncionUnica'),
      () => exigirRef(r, { recinto: 0, indice: 0.5 }, 'miFuncionUnica'),
      () => exigirRef(r, { recinto: 5, indice: 0 }, 'miFuncionUnica'),
      () => exigirRef(r, { recinto: 0, indice: 99 }, 'miFuncionUnica'),
      () => exigirRef([{ tipo: 'X' }], { recinto: 0, indice: 0 }, 'miFuncionUnica'),
    ]
    for (const caso of casos) {
      expect(caso).toThrow(/^miFuncionUnica:/)
    }
  })

  it('no muta `recintos` ni la referencia recibida', () => {
    const r = recintos()
    const antes = structuredClone(r)
    const ref = { recinto: 0, indice: 1 }
    const antesRef = structuredClone(ref)

    exigirRef(r, ref, 'fnDePrueba')

    expect(r).toEqual(antes)
    expect(ref).toEqual(antesRef)
  })
})
