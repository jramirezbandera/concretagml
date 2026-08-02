import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ring from '../fixtures/geo/parcela-ring.json' with { type: 'json' }
import { azimut, cuadrante, nombreCardinal } from '../../geo/rumbo.js'

// F09 · geo/rumbo.js (tarea T1.2) — azimut TOPOGRÁFICO: desde el Norte y en
// sentido horario. Los valores de control son de trigonometría de bachillerato
// (los ejes, las diagonales, el triángulo 3-4-5), nunca copiados de la propia
// implementación: un control obtenido ejecutando el código que se quiere probar
// no distingue una fórmula correcta de una equivocada.
//
// El control importante son LOS EJES. La convención topográfica y la matemática
// (`atan2(dy, dx)`, desde el eje X y antihorario) COINCIDEN en 45° y en 225°, de
// modo que una batería de pruebas hecha solo con diagonales daría en verde con
// los argumentos de `atan2` cambiados. En los ejes se separan 90°, un cuadrante
// entero.

describe('geo/rumbo.js · azimut — los cuatro ejes, que es donde se ve la convención', () => {
  const O = [0, 0]

  it('Norte = 0°, Este = 90°, Sur = 180°, Oeste = 270°', () => {
    expect(azimut(O, [0, 10])).toBe(0) //  ↑  N
    expect(azimut(O, [10, 0])).toBe(90) //  →  E
    expect(azimut(O, [0, -10])).toBe(180) // ↓  S
    expect(azimut(O, [-10, 0])).toBe(270) // ←  O
  })

  it('el Norte NO da 90 ni el Este 0: si diera, `atan2` tendría los argumentos cambiados', () => {
    // El ángulo MATEMÁTICO (desde +X, antihorario) del vector que apunta al
    // Norte es 90°, y el del que apunta al Este es 0°. Son exactamente los dos
    // números que devolvería `Math.atan2(dNorte, dEste)`, y son el error que
    // pondría «linda al Este» en un lindero que da al Norte.
    expect(azimut(O, [0, 10])).not.toBe(90)
    expect(azimut(O, [10, 0])).not.toBe(0)
    // Y la relación entre las dos convenciones, comprobada: azimut = 90 − θ.
    const matematico = (b) => Math.atan2(b[1], b[0]) * (180 / Math.PI)
    for (const b of [[0, 10], [10, 0], [0, -10], [-10, 0], [3, 7], [-4, 1]]) {
      const esperado = ((90 - matematico(b)) % 360 + 360) % 360
      expect(azimut(O, b)).toBeCloseTo(esperado, 10)
    }
  })

  it('la magnitud del vector no cambia el rumbo: 1 mm y 4 km al Norte son 0°', () => {
    expect(azimut(O, [0, 0.001])).toBe(0)
    expect(azimut(O, [0, 4000])).toBe(0)
  })
})

describe('geo/rumbo.js · azimut — diagonales, el cebo de este módulo', () => {
  const O = [0, 0]

  it('las cuatro diagonales exactas: 45, 135, 225, 315', () => {
    expect(azimut(O, [10, 10])).toBe(45) //   ↗ NE
    expect(azimut(O, [10, -10])).toBe(135) //  ↘ SE
    expect(azimut(O, [-10, -10])).toBe(225) // ↙ SO
    expect(azimut(O, [-10, 10])).toBe(315) //  ↖ NO
  })

  it('en 45° y en 225° las DOS convenciones dan el mismo número (por eso no valen de control)', () => {
    // Este test no comprueba el módulo: documenta por qué el bloque de los ejes
    // es el que manda. azimut = 90 − θ, luego azimut = θ ⟺ θ = 45 o θ = 225.
    const matematico = (b) => ((Math.atan2(b[1], b[0]) * (180 / Math.PI)) % 360 + 360) % 360
    expect(matematico([10, 10])).toBe(45)
    expect(azimut(O, [10, 10])).toBe(45) // idénticos: la fórmula equivocada pasaría
    expect(matematico([-10, -10])).toBe(225)
    expect(azimut(O, [-10, -10])).toBe(225) // idénticos también
    // Y en el Norte, en cambio, se separan 90°.
    expect(matematico([0, 10])).toBe(90)
    expect(azimut(O, [0, 10])).toBe(0)
  })

  it('triángulo 3-4-5: arctan(3/4) = 36,8699° y arctan(4/3) = 53,1301°', () => {
    // Valores de tabla, no de este código. Nótese cuál es cuál: 3 al Este y 4 al
    // Norte es el rumbo MÁS cercano al Norte (36,87°), no al Este.
    expect(azimut([0, 0], [3, 4])).toBeCloseTo(36.86989764584402, 10)
    expect(azimut([0, 0], [4, 3])).toBeCloseTo(53.13010235415598, 10)
    expect(azimut([0, 0], [3, 4]) + azimut([0, 0], [4, 3])).toBeCloseTo(90, 10)
  })
})

describe('geo/rumbo.js · azimut — el rango es [0, 360), con el 360 fuera', () => {
  it('un barrido completo cae siempre dentro, y ninguno devuelve 360', () => {
    for (let g = 0; g < 3600; g++) {
      const rad = (g / 10) * (Math.PI / 180)
      // Punto sobre la circunferencia unidad EN CONVENCIÓN TOPOGRÁFICA:
      // Este = sen(azimut), Norte = cos(azimut).
      const a = azimut([0, 0], [Math.sin(rad), Math.cos(rad)])
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThan(360) // el 360 queda FUERA: es el mismo rumbo que el 0
      // Y devuelve el azimut con el que se construyó el punto (ida y vuelta).
      const esperado = g / 10
      const desvio = Math.abs(((a - esperado + 540) % 360) - 180)
      expect(desvio).toBeLessThan(1e-9)
    }
  })

  it('un rumbo apenas al oeste del Norte es 359,99…, nunca −0,01 ni 360', () => {
    const a = azimut([0, 0], [-0.001, 100])
    expect(a).toBeGreaterThan(359.9)
    expect(a).toBeLessThan(360)
  })
})

describe('geo/rumbo.js · azimut — ida y vuelta difieren EXACTAMENTE 180°', () => {
  // El mismo lado recorrido al revés es el mismo lindero visto desde el otro
  // extremo: si esto no se cumpliera, la descripción literaria diría cosas
  // distintas según por dónde empezara a recorrer el anillo.
  const pares = [
    [[0, 0], [3, 4]],
    [[0, 0], [-7, 2]],
    [[0, 0], [0, 5]], // eje N/S: 0 ↔ 180
    [[0, 0], [-1, -1]], // diagonal SO ↔ NE
    [[1234.5, -6789.25], [0, 0]],
    [ring.anilloExterior[0], ring.anilloExterior[1]], // lado real, UTM
  ]

  it.each(pares)('azimut(a,b) y azimut(b,a) se llevan medio giro: %j → %j', (a, b) => {
    const ida = azimut(a, b)
    const vuelta = azimut(b, a)
    const diferencia = ((vuelta - ida) % 360 + 360) % 360
    // Exacto en matemáticas; en float64 el residuo es del orden de 1e-14 grados,
    // que sobre un lado de 20 m son 3·10⁻¹⁵ m.
    expect(diferencia).toBeCloseTo(180, 10)
    // Y los dos siguen dentro del rango.
    expect(vuelta).toBeGreaterThanOrEqual(0)
    expect(vuelta).toBeLessThan(360)
  })

  it('el cuadrante de la vuelta es el OPUESTO, no el mismo', () => {
    expect(cuadrante(azimut([0, 0], [0, 10]))).toBe('N')
    expect(cuadrante(azimut([0, 10], [0, 0]))).toBe('S')
    expect(cuadrante(azimut([0, 0], [10, 10]))).toBe('NE')
    expect(cuadrante(azimut([10, 10], [0, 0]))).toBe('SO')
  })
})

describe('geo/rumbo.js · azimut — dos puntos coincidentes: la DECISIÓN', () => {
  it('devuelve null, y NO 0: el 0 es el Norte, un rumbo legítimo', () => {
    expect(azimut([0, 0], [0, 0])).toBeNull()
    expect(azimut([0, 0], [0, 0])).not.toBe(0)
    // Sobre UTM real, que es donde llega un vértice duplicado de verdad.
    const v = ring.anilloExterior[0]
    expect(azimut(v, [v[0], v[1]])).toBeNull()
    expect(azimut(v, [...v])).toBeNull()
  })

  it('NO lanza: un vértice duplicado es un dato posible del modelo, no un bug del programa', () => {
    // Llega así de un DXF o de un GML ajeno (F08). Señalarlo es de la validación
    // (F02); esta función pura solo dice que no hay rumbo. Mismo criterio que
    // `geo/segmento.js` con el segmento degenerado.
    expect(() => azimut([5, 5], [5, 5])).not.toThrow()
  })

  it('coincidentes significa IDÉNTICOS, no «casi»: un lado de 1 mm sí tiene rumbo', () => {
    expect(azimut([0, 0], [0, 0.001])).toBe(0)
    expect(azimut([0, 0], [1e-9, 0])).toBe(90)
    // No hay umbral aquí a propósito: eso sería una tolerancia, y las
    // tolerancias no se inventan en `geo/`.
  })

  it('el null obliga al llamante a tratarlo: `cuadrante(null)` lanza en vez de decir Norte', () => {
    const sinRumbo = azimut([0, 0], [0, 0])
    expect(() => cuadrante(sinRumbo)).toThrow(TypeError)
    expect(() => cuadrante(sinRumbo)).toThrow(/./) // con mensaje, no vacío
  })
})

describe('geo/rumbo.js · azimut — contrato roto por el programador (regla de oro 1)', () => {
  it('lanza TypeError nombrando el argumento y lo recibido', () => {
    expect(() => azimut(null, [0, 0])).toThrow(TypeError)
    expect(() => azimut(null, [0, 0])).toThrow(/azimut: a debe ser \[x,y\]/)
    expect(() => azimut([0, 0], undefined)).toThrow(/azimut: b debe ser \[x,y\]/)
    expect(() => azimut([0, 0], [0])).toThrow(/recibido \[0\]/)
    expect(() => azimut([0, 0], [1, 2, 3])).toThrow(TypeError)
    expect(() => azimut(['x', 0], [0, 0])).toThrow(TypeError)
  })

  it('lanza con NaN e Infinity, que son la vía por la que entra una coordenada sin parsear', () => {
    expect(() => azimut([0, 0], [NaN, 10])).toThrow(TypeError)
    expect(() => azimut([0, 0], [10, Infinity])).toThrow(TypeError)
    expect(() => azimut([undefined, 0], [0, 0])).toThrow(TypeError)
  })
})

describe('geo/rumbo.js · cuadrante — ocho sectores CENTRADOS en su rumbo', () => {
  it('el centro de cada sector da su propio cuadrante', () => {
    expect(cuadrante(0)).toBe('N')
    expect(cuadrante(45)).toBe('NE')
    expect(cuadrante(90)).toBe('E')
    expect(cuadrante(135)).toBe('SE')
    expect(cuadrante(180)).toBe('S')
    expect(cuadrante(225)).toBe('SO')
    expect(cuadrante(270)).toBe('O')
    expect(cuadrante(315)).toBe('NO')
  })

  it('un valor cualquiera dentro de cada sector da lo mismo que su centro', () => {
    expect(cuadrante(10)).toBe('N')
    expect(cuadrante(350)).toBe('N') // el sector N envuelve el 0
    expect(cuadrante(30)).toBe('NE')
    expect(cuadrante(100)).toBe('E')
    expect(cuadrante(150)).toBe('SE')
    expect(cuadrante(190)).toBe('S')
    expect(cuadrante(230)).toBe('SO')
    expect(cuadrante(280)).toBe('O')
    expect(cuadrante(300)).toBe('NO')
  })

  it('los sectores son de 45°, no de 90°: 80° es Este y no Noreste', () => {
    // Con cuatro cuadrantes de 90° (N/E/S/O «a lo bruto»), 80° caería en el
    // primero. Con ocho de 45° centrados, 80° está a 10° del Este.
    expect(cuadrante(80)).toBe('E')
    expect(cuadrante(40)).toBe('NE')
  })
})

describe('geo/rumbo.js · cuadrante — los bordes, que es donde se rompen estas funciones', () => {
  // Criterio declarado: [centro − 22,5°, centro + 22,5°). El borde pertenece
  // SIEMPRE al sector que empieza, o sea al siguiente en sentido horario.
  const bordes = [
    [22.5, 'NE', 'N'],
    [67.5, 'E', 'NE'],
    [112.5, 'SE', 'E'],
    [157.5, 'S', 'SE'],
    [202.5, 'SO', 'S'],
    [247.5, 'O', 'SO'],
    [292.5, 'NO', 'O'],
    [337.5, 'N', 'NO'],
  ]

  it.each(bordes)('en %s° exactos manda el sector que EMPIEZA: %s (y no %s)', (g, abre, cierra) => {
    expect(cuadrante(g)).toBe(abre)
    expect(cuadrante(g)).not.toBe(cierra)
  })

  it.each(bordes)('justo por debajo de %s° sigue mandando el sector anterior (%s → %s)', (g, abre, cierra) => {
    expect(cuadrante(g - 1e-9)).toBe(cierra)
    expect(cuadrante(g - 0.001)).toBe(cierra)
    expect(cuadrante(g + 1e-9)).toBe(abre)
  })

  it('los ocho sectores PARTEN la circunferencia: ningún rumbo cae fuera ni en dos', () => {
    // Control independiente de la implementación: sea cual sea el cuadrante que
    // devuelve, el rumbo que ese cuadrante NOMBRA tiene que estar a 22,5° o
    // menos. Si un sector se hubiera desplazado medio ancho (el error clásico:
    // hacerlos EMPEZAR en su rumbo en vez de centrarlos), aquí saldrían 45°.
    const centro = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315 }
    for (let g = 0; g < 3600; g++) {
      const az = g / 10
      const c = cuadrante(az)
      const desvio = Math.abs(((az - centro[c] + 540) % 360) - 180)
      expect(desvio, `${az}° cayó en ${c}, cuyo rumbo está a ${desvio}°`).toBeLessThanOrEqual(22.5)
    }
  })

  it('el sector N es el único que envuelve el 0, y lo cubre por los dos lados', () => {
    expect(cuadrante(337.5)).toBe('N')
    expect(cuadrante(359.999)).toBe('N')
    expect(cuadrante(0)).toBe('N')
    expect(cuadrante(22.499)).toBe('N')
    expect(cuadrante(22.5)).toBe('NE')
    expect(cuadrante(337.499)).toBe('NO')
  })
})

describe('geo/rumbo.js · cuadrante — entradas imposibles (regla de oro 1)', () => {
  it('null lanza TypeError, y el mensaje explica que es el «no hay rumbo» de azimut()', () => {
    expect(() => cuadrante(null)).toThrow(TypeError)
    expect(() => cuadrante(null)).toThrow(/null cuando los dos puntos coinciden/)
    // Lo que NO puede pasar: que null se cuele como 0 y salga «Norte».
    expect(cuadrante(0)).toBe('N') // 0 sí es Norte: por eso null no puede serlo
  })

  it('undefined, NaN y un string lanzan TypeError', () => {
    expect(() => cuadrante(undefined)).toThrow(TypeError)
    expect(() => cuadrante(NaN)).toThrow(TypeError)
    expect(() => cuadrante('90')).toThrow(TypeError)
    expect(() => cuadrante([90])).toThrow(TypeError)
  })

  it('fuera de [0, 360) lanza RangeError: 360 y −1 incluidos', () => {
    expect(() => cuadrante(360)).toThrow(RangeError)
    expect(() => cuadrante(-1)).toThrow(RangeError)
    expect(() => cuadrante(-0.000001)).toThrow(RangeError)
    expect(() => cuadrante(720)).toThrow(RangeError)
    expect(() => cuadrante(Infinity)).toThrow(TypeError) // no finito: falla antes
  })

  it('el RangeError apunta al error típico: sumar 180° y no normalizar', () => {
    // Rumbo inverso mal calculado: 210 + 180 = 390.
    expect(() => cuadrante(210 + 180)).toThrow(/sumó 180°/)
    expect(() => cuadrante(210 + 180)).toThrow(/recibido 390/)
    // Bien calculado: normalizado, y sale el cuadrante OPUESTO.
    expect(cuadrante(210)).toBe('SO')
    expect(cuadrante(((210 + 180) % 360 + 360) % 360)).toBe('NE')
  })

  it('los extremos del rango: 0 entra, 359,999… entra, 360 no', () => {
    expect(cuadrante(0)).toBe('N')
    expect(cuadrante(359.9999999)).toBe('N')
    expect(() => cuadrante(360)).toThrow(RangeError)
  })
})

describe('geo/rumbo.js · nombreCardinal — el texto que firma el colegiado', () => {
  it('los ocho nombres, en la forma en que se redacta un lindero', () => {
    expect(nombreCardinal('N')).toBe('Norte')
    expect(nombreCardinal('NE')).toBe('Noreste')
    expect(nombreCardinal('E')).toBe('Este')
    expect(nombreCardinal('SE')).toBe('Sudeste')
    expect(nombreCardinal('S')).toBe('Sur')
    expect(nombreCardinal('SO')).toBe('Sudoeste')
    expect(nombreCardinal('O')).toBe('Oeste')
    expect(nombreCardinal('NO')).toBe('Noroeste')
  })

  it('la grafía elegida es UNA y está fijada: «Sudeste», no «Sureste»', () => {
    // Las dos son correctas en español; lo que no puede hacer un documento es
    // alternarlas. La decisión (formas etimológicas con -d-, tradicionales en
    // prosa registral) está escrita en el JSDoc de la función.
    expect(nombreCardinal('SE')).not.toBe('Sureste')
    expect(nombreCardinal('SO')).not.toBe('Suroeste')
    // Y el par norte se queda sin -d-, porque «nordoeste» no existe.
    expect(nombreCardinal('NE')).not.toBe('Nordeste')
    expect(nombreCardinal('NO')).toBe('Noroeste')
  })

  it('la frase del informe se compone sin retoques (spec/feature-09)', () => {
    const c = cuadrante(azimut([0, 0], [0, 12.45]))
    expect(`Linda al ${nombreCardinal(c)}, en línea recta de 12,45 m, con…`).toBe(
      'Linda al Norte, en línea recta de 12,45 m, con…',
    )
  })

  it('un código desconocido LANZA en vez de devolver hueco (regla de oro 1)', () => {
    // Si devolviera '' o undefined, la frase saldría «Linda al , en línea recta
    // de 12,45 m» y nadie sabría de dónde vino.
    expect(() => nombreCardinal('W')).toThrow(TypeError) // la 'W' inglesa no es la 'O'
    expect(() => nombreCardinal('ONO')).toThrow(TypeError) // 16 rumbos: aquí no
    expect(() => nombreCardinal('')).toThrow(TypeError)
    expect(() => nombreCardinal('n')).toThrow(TypeError) // sin minúsculas toleradas
    expect(() => nombreCardinal(null)).toThrow(TypeError)
    expect(() => nombreCardinal(0)).toThrow(TypeError) // el azimut no es un cuadrante
    expect(() => nombreCardinal('N')).not.toThrow()
  })

  it('las claves heredadas de Object.prototype tampoco pasan', () => {
    // Con una búsqueda directa en el objeto, `NOMBRES['toString']` devolvería una
    // FUNCIÓN y el informe imprimiría el código fuente de `toString`.
    expect(() => nombreCardinal('toString')).toThrow(TypeError)
    expect(() => nombreCardinal('constructor')).toThrow(TypeError)
    expect(() => nombreCardinal('hasOwnProperty')).toThrow(TypeError)
  })

  it('el mensaje enumera los ocho códigos válidos', () => {
    expect(() => nombreCardinal('W')).toThrow(/N, NE, E, SE, S, SO, O, NO/)
  })
})

describe('geo/rumbo.js · sobre coordenadas UTM reales (Norte ≈ 4,48·10⁶)', () => {
  // El uso real: vértices del anillo del WFS (`test/fixtures/geo/parcela-ring.json`),
  // no números de una cifra. Es donde se vería una pérdida de precisión por
  // operar con coordenadas absolutas — y no la hay, porque `atan2` recibe
  // DIFERENCIAS (el mismo motivo por el que `geo/metrica.js` tampoco traslada a
  // origen local).
  const base = ring.anilloExterior[0] // [439283.23, 4479671.27]

  it('los cuatro ejes salen exactos también a 4,48 millones de metros del ecuador', () => {
    expect(azimut(base, [base[0], base[1] + 12.45])).toBe(0)
    expect(azimut(base, [base[0] + 12.45, base[1]])).toBe(90)
    expect(azimut(base, [base[0], base[1] - 12.45])).toBe(180)
    expect(azimut(base, [base[0] - 12.45, base[1]])).toBe(270)
    // Y el nombre que acaba en el informe.
    expect(nombreCardinal(cuadrante(azimut(base, [base[0], base[1] + 12.45])))).toBe('Norte')
    expect(nombreCardinal(cuadrante(azimut(base, [base[0] - 12.45, base[1]])))).toBe('Oeste')
  })

  it('el primer lado real del anillo da al Sudoeste: 227,50°, calculado a mano', () => {
    // Incrementos del lado (los mismos que verifica `test/geo/metrica.test.js`):
    //   ΔEste = −14,47 m   ΔNorte = −13,26 m   → tercer cuadrante (SO)
    // A mano: 180° + arctan(14,47 / 13,26) = 180 + 47,4985° = 227,4985°.
    const a = ring.anilloExterior[0]
    const b = ring.anilloExterior[1]
    const esperado = 180 + Math.atan(14.47 / 13.26) * (180 / Math.PI)
    expect(esperado).toBeCloseTo(227.4985194, 7) // el valor de tabla, sin tocar el módulo

    const az = azimut(a, b)
    // Residuo de ~4·10⁻¹⁰ grados: no es del cálculo, es de RESTAR dos
    // coordenadas de magnitud 4,4·10⁶ en float64 (la diferencia guardada es
    // −14,46999999997 y no −14,47 exacto). Sobre un lado de 19,6 m son 0,1 nm.
    expect(az).toBeCloseTo(esperado, 7)
    expect(az).toBeCloseTo(227.4985194, 7)
    expect(cuadrante(az)).toBe('SO')
    expect(nombreCardinal(cuadrante(az))).toBe('Sudoeste')
  })

  it('y el mismo lado al revés da al Noreste: 47,50°', () => {
    const az = azimut(ring.anilloExterior[1], ring.anilloExterior[0])
    expect(az).toBeCloseTo(47.4985194, 7)
    expect(cuadrante(az)).toBe('NE')
    expect(nombreCardinal(cuadrante(az))).toBe('Noreste')
  })

  it('todos los lados del anillo real tienen rumbo y cuadrante (ninguno degenerado)', () => {
    const anillo = ring.anilloExterior
    const n = anillo.length
    expect(n).toBeGreaterThan(3)
    for (let i = 0; i < n; i++) {
      const az = azimut(anillo[i], anillo[(i + 1) % n]) // anillo ABIERTO: el último lado cierra
      expect(az).not.toBeNull()
      expect(az).toBeGreaterThanOrEqual(0)
      expect(az).toBeLessThan(360)
      expect(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']).toContain(cuadrante(az))
      expect(typeof nombreCardinal(cuadrante(az))).toBe('string')
    }
  })
})

describe('geo/rumbo.js · el módulo es HOJA y PURO (F09, T1.2)', () => {
  const RUTA = fileURLToPath(new URL('../../geo/rumbo.js', import.meta.url))
  const FUENTE = readFileSync(RUTA, 'utf8')
  const IMPORTA = /(?:^|\n)[ \t]*(?:import|export)[^\n]*['"]|(?:import|require)\([ \t]*['"]/

  it('no importa NADA: ni turf, ni proj4, ni el resto de `geo/`', () => {
    // Cierra la regla de oro 6 (`turf.bearing` está PROHIBIDA) y la 7 (proj4) por
    // la vía fuerte: sin imports no hay nada que colar. Y deja claro que la
    // convergencia de meridianos NO se aplica — si algún día se aplicara, este
    // test se pondría rojo y obligaría a documentarlo.
    expect(IMPORTA.test(FUENTE), 'geo/rumbo.js debe seguir sin dependencias').toBe(false)
  })

  it('el detector de imports no es vacuo: dispara sobre un módulo que sí importa', () => {
    const conImports = readFileSync(
      fileURLToPath(new URL('../../geo/centroide.js', import.meta.url)),
      'utf8',
    )
    expect(IMPORTA.test(conImports)).toBe(true)
  })

  it('la advertencia del Norte de cuadrícula está escrita y nombra la función que corregiría', () => {
    // No es decoración: es la única señal de que el rumbo no es geográfico. Si
    // alguien reescribe la cabecera y se la lleva por delante, esto suena.
    expect(FUENTE).toMatch(/NORTE DE CUADRÍCULA, NO NORTE GEOGRÁFICO/)
    expect(FUENTE).toMatch(/convergencia\(lat, lon, zona\)/)
    expect(FUENTE).toMatch(/geo\/utm\.js/)
  })
})
