import { describe, expect, it } from 'vitest'
import { CLAVE_BANDA, bandas } from '../../diagnostico/bandas.js'

// F07 · diagnostico/bandas.js — la comparación a TRES bandas (spec §10.2).
//
// Todos los valores esperados están CALCULADOS A MANO. Las cifras de referencia
// son las REALES de la parcela 9398516VK3799G, que es la que el proyecto tiene
// medida de punta a punta: el Catastro DECLARA 1536 m² (`cp:areaValue`, entero) y
// la shoelace de las coordenadas que él mismo emite da 1535,865149996761 m². Esos
// −0,13 m² son la prueba de que la app mide de verdad en vez de repetir lo que le
// dieron, y son el ejemplo con el que está escrito el JSDoc del módulo.
//
// Lo que se comprueba, por orden de importancia:
//   1. Que los TRES pares salen siempre y en el orden documentado. Una fila
//      ausente se lee «esto no hacía falta mirarlo» y una fila con `null` se lee
//      «esto no se ha podido mirar»; solo la segunda es verdad, así que el módulo
//      no puede omitir filas.
//   2. Que `null` NO se convierte en 0 en ningún camino (la mentira
//      tranquilizadora: «no hay discrepancia» cuando lo cierto es «no hay con qué
//      comparar»).
//   3. Que `relativo` es FRACCIÓN y nunca `Infinity` ni `NaN`.
//   4. Que NO JUZGA: ni una clave de veredicto en el retorno (regla de oro 9).

// Las tres superficies reales del expediente de la parcela 9398516VK3799G.
const MEDIDA = 1535.865149996761
const CATASTRAL = 1536
// Registral inventada pero verosímil: una escritura antigua con 1.500 m² redondos
// es el caso típico que trae a un técnico a rectificar.
const REGISTRAL = 1500

describe('diagnostico/bandas.js · vocabulario', () => {
  it('CLAVE_BANDA está congelado y son exactamente tres bandas', () => {
    expect(Object.isFrozen(CLAVE_BANDA)).toBe(true)
    expect(CLAVE_BANDA).toEqual({
      MEDIDA: 'medida',
      CATASTRAL: 'catastral',
      REGISTRAL: 'registral',
    })
  })
})

describe('diagnostico/bandas.js · los tres pares, en orden', () => {
  it('devuelve SIEMPRE tres cruces, en el orden documentado', () => {
    const { cruces } = bandas({ medida: MEDIDA, catastral: CATASTRAL, registral: REGISTRAL })

    expect(cruces).toHaveLength(3)
    expect(cruces.map((c) => [c.a, c.b])).toEqual([
      ['medida', 'catastral'],
      ['medida', 'registral'],
      ['catastral', 'registral'],
    ])
  })

  it('los tres pares salen también cuando NO hay con qué calcularlos', () => {
    // El caso de un DXF recién importado: se mide, pero no hay ni catastral ni
    // registral. Las tres filas siguen ahí, las dos últimas con `null`.
    const { cruces } = bandas({ medida: MEDIDA })

    expect(cruces).toHaveLength(3)
    expect(cruces.map((c) => [c.a, c.b])).toEqual([
      ['medida', 'catastral'],
      ['medida', 'registral'],
      ['catastral', 'registral'],
    ])
  })

  it('`valores` devuelve las tres bandas tal cual, para que la tabla no las guarde aparte', () => {
    const { valores } = bandas({ medida: MEDIDA, catastral: CATASTRAL, registral: REGISTRAL })
    expect(valores).toEqual({ medida: MEDIDA, catastral: CATASTRAL, registral: REGISTRAL })
  })
})

describe('diagnostico/bandas.js · la aritmética, a mano', () => {
  it('medida ↔ catastral: los −0,13 m² reales de la parcela 9398516VK3799G', () => {
    const [medidaCatastral] = bandas({ medida: MEDIDA, catastral: CATASTRAL }).cruces

    // 1535,865149996761 − 1536 = −0,134850003239
    expect(medidaCatastral.absoluto).toBeCloseTo(-0.134850003239, 9)
    // −0,134850003239 / 1536 = −8,7793·10⁻⁵ → o sea −0,0088 %. NO −0,0088.
    expect(medidaCatastral.relativo).toBeCloseTo(-8.779297085e-5, 12)
  })

  it('el signo es información y no se pierde: negativo = medimos MENOS que lo declarado', () => {
    const { cruces } = bandas({ medida: 1500, catastral: 1536, registral: 1400 })
    const [medidaCatastral, medidaRegistral] = cruces

    // Medimos menos que el Catastro (−36) y más que el Registro (+100). Las dos
    // cosas a la vez son el caso normal de un expediente y el valor absoluto las
    // haría indistinguibles.
    expect(medidaCatastral.absoluto).toBe(-36)
    expect(medidaRegistral.absoluto).toBe(100)
  })

  it('`b` es el denominador: el relativo se calcula sobre la fuente AJENA, no sobre la medición', () => {
    // 100 − 80 = 20. Sobre b=80 son 0,25; sobre a=100 serían 0,20. Que el
    // denominador sea `b` es contrato, y es lo que hace comparable el relativo con
    // el ≤5 % de la norma, que se refiere a la superficie inscrita.
    const [cruce] = bandas({ medida: 100, catastral: 80 }).cruces
    expect(cruce.absoluto).toBe(20)
    expect(cruce.relativo).toBe(0.25)
  })

  it('catastral ↔ registral no involucra la medición: es la discrepancia entre las dos fuentes oficiales', () => {
    const cruces = bandas({ medida: 999_999, catastral: CATASTRAL, registral: REGISTRAL }).cruces
    const catastralRegistral = cruces[2]

    // 1536 − 1500 = 36, y la medición absurda de 999.999 no lo altera: es el dato
    // que ABSUELVE a la medición cuando las otras dos filas salen grandes.
    expect(catastralRegistral.absoluto).toBe(36)
    expect(catastralRegistral.relativo).toBeCloseTo(0.024, 12)
  })

  it('`relativo` es FRACCIÓN, no porcentaje: un 5 % sale como 0,05', () => {
    // 1050 − 1000 = 50; 50/1000 = 0,05. Si algún día alguien mete el ×100 aquí,
    // este test lo caza: es la confusión clásica de este campo.
    const [cruce] = bandas({ medida: 1050, catastral: 1000 }).cruces
    expect(cruce.relativo).toBe(0.05)
    expect(cruce.relativo).not.toBe(5)
  })
})

describe('diagnostico/bandas.js · `null` NO es 0', () => {
  it('sin catastral ni registral, solo hay valores en el par que se puede calcular', () => {
    const { cruces } = bandas({ medida: MEDIDA })

    for (const cruce of cruces) {
      expect(cruce.absoluto).toBeNull()
      expect(cruce.relativo).toBeNull()
    }
  })

  it('con catastral pero sin registral, el primer par calcula y los otros dos no', () => {
    const [medidaCatastral, medidaRegistral, catastralRegistral] = bandas({
      medida: MEDIDA,
      catastral: CATASTRAL,
    }).cruces

    expect(medidaCatastral.absoluto).not.toBeNull()
    expect(medidaRegistral.absoluto).toBeNull()
    expect(catastralRegistral.absoluto).toBeNull()
  })

  it('con registral pero sin catastral, calcula el segundo par y no el primero ni el tercero', () => {
    const [medidaCatastral, medidaRegistral, catastralRegistral] = bandas({
      medida: MEDIDA,
      registral: REGISTRAL,
    }).cruces

    expect(medidaCatastral.absoluto).toBeNull()
    expect(medidaRegistral.absoluto).not.toBeNull()
    expect(catastralRegistral.absoluto).toBeNull()
  })

  it('`medida: null` es legítimo (todavía no hay geometría) y anula sus dos pares', () => {
    const [medidaCatastral, medidaRegistral, catastralRegistral] = bandas({
      medida: null,
      catastral: CATASTRAL,
      registral: REGISTRAL,
    }).cruces

    expect(medidaCatastral.absoluto).toBeNull()
    expect(medidaRegistral.absoluto).toBeNull()
    // El tercero SÍ se puede calcular sin medición: no depende de ella.
    expect(catastralRegistral.absoluto).toBe(36)
  })

  it('un `null` NUNCA se cuela como 0: la resta no se hace con cero', () => {
    // El fallo que este test persigue: si `null` se tratara como 0, el par
    // medida↔registral daría absoluto = 1535,86 («la parcela mide 1535 m² más que
    // lo inscrito»), una cifra enorme, plausible y completamente falsa.
    const [, medidaRegistral] = bandas({ medida: MEDIDA, registral: null }).cruces

    expect(medidaRegistral.absoluto).toBeNull()
    expect(medidaRegistral.absoluto).not.toBe(MEDIDA)
    expect(medidaRegistral.absoluto).not.toBe(0)
  })
})

describe('diagnostico/bandas.js · denominador cero', () => {
  it('`catastral: 0` es un dato declarado: el absoluto SÍ se calcula', () => {
    const [cruce] = bandas({ medida: 1536, catastral: 0 }).cruces
    expect(cruce.absoluto).toBe(1536)
  })

  it('…pero el cociente no está definido: `relativo` es null, ni Infinity ni NaN', () => {
    const [cruce] = bandas({ medida: 1536, catastral: 0 }).cruces

    expect(cruce.relativo).toBeNull()
    expect(cruce.relativo).not.toBe(Infinity)
    expect(Number.isNaN(cruce.relativo)).toBe(false)
  })

  it('0 contra 0 tampoco da NaN', () => {
    // Sin el corte, `0/0` daría NaN, que se pinta como «NaN» en la tabla: un número
    // que nadie ha calculado presentado como si lo hubiera calculado alguien.
    const [cruce] = bandas({ medida: 0, catastral: 0 }).cruces

    expect(cruce.absoluto).toBe(0)
    expect(cruce.relativo).toBeNull()
  })

  it('`-0` como denominador se corta igual que `0`', () => {
    const [cruce] = bandas({ medida: 5, catastral: -0 }).cruces
    expect(cruce.relativo).toBeNull()
  })
})

describe('diagnostico/bandas.js · NO juzga (regla de oro 9)', () => {
  // La frontera de la regla 9 pasa por el TIPO DE RETORNO: si este módulo no puede
  // devolver un booleano de mérito, ninguna vista puede pintar un semáforo a partir
  // de él. Por eso el guardián se hace sobre el objeto real y no sobre una lista de
  // claves escrita a mano.
  const PROHIBIDAS = /^(ok|valido|válido|apto|aprobado|dentro|cumple|semaforo|semáforo|umbral|tolerancia|nivel|color|estado|veredicto)/i

  it('ni el retorno ni ningún cruce llevan una clave de veredicto', () => {
    const resultado = bandas({ medida: MEDIDA, catastral: CATASTRAL, registral: REGISTRAL })

    for (const clave of Object.keys(resultado)) {
      expect(clave).not.toMatch(PROHIBIDAS)
    }
    for (const cruce of resultado.cruces) {
      for (const clave of Object.keys(cruce)) {
        expect(clave).not.toMatch(PROHIBIDAS)
      }
    }
  })

  it('el retorno tiene exactamente dos claves y cada cruce exactamente cuatro', () => {
    // Un test de forma EXACTA y no de «contiene»: es lo que hace que añadir un
    // `{ok: true}` en el futuro salga rojo aquí en vez de pasar desapercibido.
    const resultado = bandas({ medida: MEDIDA, catastral: CATASTRAL, registral: REGISTRAL })

    expect(Object.keys(resultado).sort()).toEqual(['cruces', 'valores'])
    for (const cruce of resultado.cruces) {
      expect(Object.keys(cruce).sort()).toEqual(['a', 'absoluto', 'b', 'relativo'])
    }
  })

  it('no compara con el ≤5 % de la norma ni con nada: dos entradas muy distintas dan la misma FORMA', () => {
    // Una discrepancia del 0,009 % y otra del 300 % producen estructuras idénticas.
    // Que el módulo no distinga «pequeña» de «enorme» es la propiedad, no una
    // carencia: quien interpreta y firma es el colegiado.
    const minuscula = bandas({ medida: MEDIDA, catastral: CATASTRAL })
    const enorme = bandas({ medida: 6000, catastral: CATASTRAL })

    expect(Object.keys(enorme)).toEqual(Object.keys(minuscula))
    expect(Object.keys(enorme.cruces[0])).toEqual(Object.keys(minuscula.cruces[0]))
  })
})

describe('diagnostico/bandas.js · contrato del programador', () => {
  it('olvidar `medida` LANZA, y es distinto de `medida: null`', () => {
    // `medida: null` es una afirmación («todavía no hay geometría»); omitirla es un
    // bug. Las dos cosas se escriben distinto porque son distintas, así que el
    // módulo no puede tratarlas igual.
    expect(() => bandas({ catastral: CATASTRAL })).toThrow(TypeError)
    expect(() => bandas({ medida: null, catastral: CATASTRAL })).not.toThrow()
  })

  it('un número en vez del objeto de entrada LANZA', () => {
    // Sin esta guarda, `bandas(1536)` desestructuraría el número, las tres bandas
    // saldrían con su valor por defecto y la superficie se perdería por el camino:
    // la tabla diría «No consta» teniendo el dato delante.
    expect(() => bandas(1536)).toThrow(TypeError)
    expect(() => bandas(null)).toThrow(TypeError)
    expect(() => bandas([MEDIDA])).toThrow(TypeError)
  })

  it('el mensaje del throw nombra la banda y el valor recibido', () => {
    expect(() => bandas({ medida: '1536' })).toThrow(/'medida'.*string/s)
    expect(() => bandas({ medida: MEDIDA, catastral: NaN })).toThrow(/'catastral'/)
    expect(() => bandas({ medida: MEDIDA, registral: Infinity })).toThrow(/'registral'/)
  })

  it('no muta la entrada', () => {
    const entrada = { medida: MEDIDA, catastral: CATASTRAL, registral: REGISTRAL }
    const antes = JSON.stringify(entrada)
    bandas(entrada)
    expect(JSON.stringify(entrada)).toBe(antes)
  })

  it('`valores` no es la MISMA referencia que la entrada', () => {
    // Devolver la entrada dejaría al llamante mutando el resultado sin saberlo.
    const entrada = { medida: MEDIDA, catastral: CATASTRAL, registral: REGISTRAL }
    const { valores } = bandas(entrada)
    expect(valores).not.toBe(entrada)
    expect(valores).toEqual(entrada)
  })
})
