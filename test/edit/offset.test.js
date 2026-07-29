import { describe, it, expect } from 'vitest'
import ring from '../fixtures/geo/parcela-ring.json' with { type: 'json' }
import {
  desplazarLado,
  MODO_OFFSET,
  TIPO_OFFSET,
  MENSAJE_OFFSET,
} from '../../edit/offset.js'
import { area, superficie, orientacion } from '../../geo/area.js'
import { distancia } from '../../geo/metrica.js'
import { OPERATIVOS } from '../../config/operativos.js'

// edit/offset.js — desplazamiento de un lindero en paralelo.
//
// Qué vigila esta suite, en orden de importancia:
//
//   1. EL SIGNO. `distancia > 0` tiene que alejar el lado del interior de su
//      anillo EN LOS DOS SENTIDOS DE GIRO. El test que lo cierra invierte el
//      anillo (`[...anillo].reverse()`) y exige que la superficie crezca IGUAL:
//      con el signo mal resuelto, uno de los dos encogería. Se repite sobre los
//      15 lados de la parcela real.
//   2. EL FALLBACK. Con una esquina de 1° un offset de 0,50 m lanzaría el vértice
//      a 28,66 m. Hay dos tests gemelos: uno afirma que con el miter-limit por
//      defecto NINGÚN vértice se aleja más de 0,50 m, y el otro que SIN el límite
//      (`miterLimite: Infinity`) ese mismo caso da 28,66 m. El segundo es el que
//      impide desactivar el guardián en silencio: si alguien lo quita, el primero
//      sale rojo y el segundo explica por qué importaba.
//   3. NADA EN SILENCIO. Cada caída al fallback y cada operación no aplicable sale
//      en `detecciones` con un texto en español presentable tal cual.
//
// Las cifras de los casos «a mano» (cuadrado, triángulo, pico) están calculadas a
// mano y comprobadas contra el módulo; las de la parcela real son PROPIEDADES
// (crece, coincide con el anillo invertido, ningún vértice se dispara), no
// números copiados de una ejecución.

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Cuadrado 10×10 ANTIHORARIO. Área 100 m². Todo se puede verificar a mano. */
const CUADRADO = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]

/** El mismo cuadrado con el recorrido INVERTIDO (horario). Misma forma, otro signo. */
const CUADRADO_INVERTIDO = [...CUADRADO].reverse()

/** Triángulo rectángulo antihorario. Área 50 m². */
const TRIANGULO = [
  [0, 0],
  [10, 0],
  [0, 10],
]

/**
 * Cuadrado con un vértice DE PASO en mitad del lado inferior: `v0`, `v1` y `v2`
 * están alineados, así que la recta contigua a `v1` por la izquierda es la MISMA
 * recta que el lado `v1→v2`. Es el caso de paralelismo real.
 */
const CON_VERTICE_DE_PASO = [
  [0, 0],
  [5, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]

/** Exterior 20×20 antihorario (400 m²) con un hueco 10×10 horario (100 m²): neto 300 m². */
const EXTERIOR_CON_HUECO = () => [
  {
    vertices: [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
    ],
    tipo: 'EXTERIOR',
  },
  {
    vertices: [
      [5, 5],
      [5, 15],
      [15, 15],
      [15, 5],
    ],
    tipo: 'HUECO',
  },
]

/**
 * Anillo con un PICO de 1,00° en `v1`: el lado `v0→v1` corre por el eje X y el
 * lindero contiguo vuelve casi sobre él (`atan(1.71/98) = 1,00°`).
 *
 * Con `|sin θ| = 0,017446` la razón del miter vale `1/|sin θ| = 57,3`: desplazar
 * el lado 0,50 m llevaría `v1` a 28,66 m. Ese es exactamente el pico agudo de una
 * parcela real que convierte el recinto en un rayo si nadie lo para.
 */
const PICO_AGUDO = [
  [0, 0],
  [100, 0],
  [2, 1.71],
  [0, 10],
]

/** Anillo exterior de la parcela real 9398516VK3799G (15 vértices, HORARIO). */
const PARCELA_REAL = ring.anilloExterior.map(([x, y]) => [x, y])

/** Envuelve un anillo suelto como `recintos` de un solo EXTERIOR. */
const comoExterior = (vertices) => [{ vertices: vertices.map(([x, y]) => [x, y]), tipo: 'EXTERIOR' }]

/**
 * Anillo cuya esquina en `v1` tiene EXACTAMENTE la razón de miter pedida.
 *
 * El lado `v0→v1` va por el eje X; el lindero contiguo sale de `v1` con seno
 * `1/razon` respecto de él, de modo que la razón `|v1_new − v1| / |d|`, que vale
 * `1/|sin θ|`, es la pedida. Sirve para pinchar los DOS umbrales justo por encima
 * y justo por debajo **derivándolos de `config/operativos.json`**, no de una cifra
 * copiada aquí: si mañana cambia el JSON, estos tests siguen midiendo el umbral
 * real y no el que alguien recuerda.
 */
function anilloConRazonDeMiter(razon) {
  const sen = 1 / razon
  const cos = Math.sqrt(1 - sen * sen)
  return [
    [0, 0],
    [100, 0],
    [100 - 50 * cos, 50 * sen],
    [0, 30],
  ]
}

// ── Utilidades del arnés ─────────────────────────────────────────────────────

/** Congela en profundidad: cualquier mutación en sitio lanzaría (modo estricto). */
function congelar(valor) {
  if (valor && typeof valor === 'object') {
    for (const v of Object.values(valor)) congelar(v)
    Object.freeze(valor)
  }
  return valor
}

/** Todos los objetos/arrays alcanzables desde `valor`. */
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

/** Distancia del punto `p` al vértice ORIGINAL más próximo del anillo `anillo`. */
function saltoRespectoA(p, anillo) {
  let minimo = Infinity
  for (const q of anillo) minimo = Math.min(minimo, distancia(p, q))
  return minimo
}

/** Lo más que se ha movido cualquier vértice del resultado respecto del anillo original. */
const maxSalto = (resultado, anillo) =>
  Math.max(...resultado.map((p) => saltoRespectoA(p, anillo)))

/** Tipos de las detecciones, en orden. */
const tipos = (resultado) => resultado.detecciones.map((d) => d.tipo)

/**
 * Índice del lado GEOMÉTRICAMENTE equivalente en el anillo invertido.
 * En `[...anillo].reverse()` el lado `i` (de `v[i]` a `v[i+1]`) pasa a recorrerse
 * al revés, y su vértice de apertura pasa a ser `n − 2 − i` (módulo `n`).
 */
const ladoEnInvertido = (i, n) => (n - 2 - i + n) % n

// ── Vocabulario público ──────────────────────────────────────────────────────

describe('edit/offset.js — vocabulario público', () => {
  it('MODO_OFFSET está congelado y trae los tres modos del contrato', () => {
    expect(Object.isFrozen(MODO_OFFSET)).toBe(true)
    expect(MODO_OFFSET).toEqual({ MITER: 'MITER', BEVEL: 'BEVEL', TRASLACION: 'TRASLACION' })
  })

  it('TIPO_OFFSET está congelado y cada clave es igual a su valor (códigos estables)', () => {
    expect(Object.isFrozen(TIPO_OFFSET)).toBe(true)
    for (const [clave, valor] of Object.entries(TIPO_OFFSET)) expect(valor).toBe(clave)
  })

  it('MENSAJE_OFFSET es TOTAL sobre TIPO_OFFSET (el guardián de carga no es decorativo)', () => {
    expect(Object.isFrozen(MENSAJE_OFFSET)).toBe(true)
    for (const tipo of Object.values(TIPO_OFFSET)) {
      expect(typeof MENSAJE_OFFSET[tipo]).toBe('function')
    }
    expect(Object.keys(MENSAJE_OFFSET).sort()).toEqual(Object.values(TIPO_OFFSET).sort())
  })
})

// ── 1 · Caso recto, comprobable a mano ───────────────────────────────────────

describe('edit/offset.js — el cuadrado: los cuatro vértices, uno a uno', () => {
  it('desplazar el lado inferior 1 m hacia fuera da (0,−1) (10,−1) y deja los otros dos', () => {
    const r = desplazarLado(comoExterior(CUADRADO), { recinto: 0, indice: 0 }, 1)

    expect(r.recintos[0].vertices).toEqual([
      [0, -1],
      [10, -1],
      [10, 10],
      [0, 10],
    ])
    expect(r.modo).toBe(MODO_OFFSET.MITER)
    expect(r.detecciones).toEqual([])
  })

  it('la superficie pasa de 100 a 110 m² (un rectángulo 10×11)', () => {
    const r = desplazarLado(comoExterior(CUADRADO), { recinto: 0, indice: 0 }, 1)
    expect(area(CUADRADO)).toBe(100)
    expect(area(r.recintos[0].vertices)).toBe(110)
  })

  it('el tipo y el orden de los recintos no se tocan', () => {
    const r = desplazarLado(EXTERIOR_CON_HUECO(), { recinto: 0, indice: 0 }, 1)
    expect(r.recintos.map((x) => x.tipo)).toEqual(['EXTERIOR', 'HUECO'])
    expect(r.recintos[1].vertices).toEqual(EXTERIOR_CON_HUECO()[1].vertices)
  })
})

// ── 2 · EL SIGNO: el test que cierra la tarea ────────────────────────────────

describe('edit/offset.js — el signo: «hacia fuera» no depende del sentido de giro', () => {
  it('el cuadrado y su inverso tienen orientaciones OPUESTAS (el fixture es el que se cree)', () => {
    expect(orientacion(CUADRADO)).toBe(1)
    expect(orientacion(CUADRADO_INVERTIDO)).toBe(-1)
  })

  it('distancia > 0 hace CRECER la superficie, y crecer IGUAL con el anillo invertido', () => {
    const directo = desplazarLado(comoExterior(CUADRADO), { recinto: 0, indice: 0 }, 1)
    // Mismo lado GEOMÉTRICO (el inferior) en el anillo del revés: índice 2.
    const inverso = desplazarLado(comoExterior(CUADRADO_INVERTIDO), { recinto: 0, indice: 2 }, 1)

    expect(area(directo.recintos[0].vertices)).toBe(110)
    expect(area(inverso.recintos[0].vertices)).toBe(110)
    // Y no es que «crezca parecido»: es literalmente la misma forma recorrida al revés.
    expect(inverso.recintos[0].vertices).toEqual([
      [0, 10],
      [10, 10],
      [10, -1],
      [0, -1],
    ])
  })

  it('distancia < 0 hace MENGUAR la superficie, y menguar igual con el anillo invertido', () => {
    const directo = desplazarLado(comoExterior(CUADRADO), { recinto: 0, indice: 0 }, -1)
    const inverso = desplazarLado(comoExterior(CUADRADO_INVERTIDO), { recinto: 0, indice: 2 }, -1)

    expect(area(directo.recintos[0].vertices)).toBe(90)
    expect(area(inverso.recintos[0].vertices)).toBe(90)
    expect(directo.recintos[0].vertices).toEqual([
      [0, 1],
      [10, 1],
      [10, 10],
      [0, 10],
    ])
  })

  it('el signo se resuelve para TODOS los lados, no solo para el primero', () => {
    for (let i = 0; i < CUADRADO.length; i++) {
      const r = desplazarLado(comoExterior(CUADRADO), { recinto: 0, indice: i }, 1)
      expect(area(r.recintos[0].vertices)).toBe(110)
      const iInv = ladoEnInvertido(i, CUADRADO.length)
      const rInv = desplazarLado(comoExterior(CUADRADO_INVERTIDO), { recinto: 0, indice: iInv }, 1)
      expect(area(rInv.recintos[0].vertices)).toBe(110)
    }
  })
})

// ── 3 · El lado de CIERRE ────────────────────────────────────────────────────

describe('edit/offset.js — el lado de CIERRE (último índice del anillo abierto)', () => {
  it('el lado 3 del cuadrado es v[3]→v[0] y se desplaza hacia la izquierda', () => {
    const r = desplazarLado(comoExterior(CUADRADO), { recinto: 0, indice: 3 }, 1)

    expect(r.recintos[0].vertices).toEqual([
      [-1, 0],
      [10, 0],
      [10, 10],
      [-1, 10],
    ])
    expect(area(r.recintos[0].vertices)).toBe(110)
    expect(r.modo).toBe(MODO_OFFSET.MITER)
  })

  it('el anillo no cambia de longitud ni rota: el vértice 0 sigue siendo el vértice 0', () => {
    const r = desplazarLado(comoExterior(CUADRADO), { recinto: 0, indice: 3 }, 1)
    expect(r.recintos[0].vertices).toHaveLength(CUADRADO.length)
    expect(r.recintos[0].vertices[1]).toEqual(CUADRADO[1])
    expect(r.recintos[0].vertices[2]).toEqual(CUADRADO[2])
  })
})

// ── 4 · EL FALLBACK: el ángulo agudo, con números ────────────────────────────

describe('edit/offset.js — el ángulo agudo NO puede lanzar el vértice al infinito', () => {
  const D = 0.5

  it('con el miter-limit por defecto, NINGÚN vértice se aleja más de 0,50 m del original', () => {
    const r = desplazarLado(comoExterior(PICO_AGUDO), { recinto: 0, indice: 0 }, D)

    expect(r.modo).toBe(MODO_OFFSET.BEVEL)
    expect(maxSalto(r.recintos[0].vertices, PICO_AGUDO)).toBeCloseTo(D, 10)
    // El bisel CONSERVA el vértice original y añade uno: 4 vértices pasan a 5.
    expect(r.recintos[0].vertices).toHaveLength(PICO_AGUDO.length + 1)
    expect(r.recintos[0].vertices).toEqual([
      [0, -D],
      [100, -D],
      [100, 0], // el pico original, intacto
      [2, 1.71],
      [0, 10],
    ])
  })

  it('SIN el miter-limit el MISMO caso manda el vértice a 28,66 m (por eso existe la guarda)', () => {
    const r = desplazarLado(comoExterior(PICO_AGUDO), { recinto: 0, indice: 0 }, D, {
      miterLimite: Infinity,
    })

    expect(r.modo).toBe(MODO_OFFSET.MITER)
    const salto = distancia(r.recintos[0].vertices[1], PICO_AGUDO[1])
    expect(salto).toBeCloseTo(28.6593, 3)
    expect(salto).toBeGreaterThan(25)
    // 57 veces el desplazamiento pedido: eso es 1/|sin 1,00°|.
    expect(salto / D).toBeCloseTo(57.3187, 3)
  })

  it('la detección del bisel dice el vértice, el ángulo, los metros y el factor', () => {
    const r = desplazarLado(comoExterior(PICO_AGUDO), { recinto: 0, indice: 0 }, D)

    expect(tipos(r)).toEqual([TIPO_OFFSET.EXTREMO_BISELADO])
    const { mensaje } = r.detecciones[0]
    expect(mensaje).toContain('vértice 1')
    expect(mensaje).toContain('1.00°')
    expect(mensaje).toContain('28.66 m')
    expect(mensaje).toContain('57 veces')
    expect(mensaje).toContain('0.50 m')
  })

  it('el umbral del bisel es el de config/operativos.json, no una cifra escrita a mano', () => {
    const factor = OPERATIVOS.miterLimiteFactor
    const justoDebajo = comoExterior(anilloConRazonDeMiter(factor * 0.9))
    const justoEncima = comoExterior(anilloConRazonDeMiter(factor * 1.1))

    expect(desplazarLado(justoDebajo, { recinto: 0, indice: 0 }, 1).modo).toBe(MODO_OFFSET.MITER)
    expect(desplazarLado(justoEncima, { recinto: 0, indice: 0 }, 1).modo).toBe(MODO_OFFSET.BEVEL)
  })

  it('con el bisel, el salto está acotado por |d| sea cual sea lo aguda que sea la esquina', () => {
    for (const razon of [5, 10, 30, 57, 99]) {
      const anillo = anilloConRazonDeMiter(razon)
      const r = desplazarLado(comoExterior(anillo), { recinto: 0, indice: 0 }, D)
      expect(r.modo).toBe(MODO_OFFSET.BEVEL)
      expect(maxSalto(r.recintos[0].vertices, anillo)).toBeLessThanOrEqual(D + 1e-9)
    }
  })
})

// ── 5 · El otro fallback: paralelismo real ───────────────────────────────────

describe('edit/offset.js — paralelismo: el lindero vecino es prolongación del desplazado', () => {
  it('el extremo sin esquina se TRASLADA y el otro se corta normalmente', () => {
    const r = desplazarLado(comoExterior(CON_VERTICE_DE_PASO), { recinto: 0, indice: 1 }, 1)

    expect(r.modo).toBe(MODO_OFFSET.TRASLACION)
    expect(r.recintos[0].vertices).toEqual([
      [0, 0],
      [5, -1], // trasladado: no había esquina donde apoyarlo
      [10, -1], // cortado contra el lado vertical x = 10
      [10, 10],
      [0, 10],
    ])
    expect(area(r.recintos[0].vertices)).toBe(107.5)
  })

  it('lo cuenta con una detección que nombra el vértice y avisa del colindante', () => {
    const r = desplazarLado(comoExterior(CON_VERTICE_DE_PASO), { recinto: 0, indice: 1 }, 1)

    expect(tipos(r)).toEqual([TIPO_OFFSET.EXTREMO_TRASLADADO])
    expect(r.detecciones[0].mensaje).toContain('vértice 1')
    expect(r.detecciones[0].mensaje).toContain('0.00°')
    expect(r.detecciones[0].mensaje).toContain('colindante')
  })

  it('el umbral de paralelismo es el de config/operativos.json (por debajo TRASLACION, por encima BEVEL)', () => {
    const seno = OPERATIVOS.senoMinimoOffset
    const casiParalelo = comoExterior(anilloConRazonDeMiter(1 / (seno * 0.9)))
    const yaNoParalelo = comoExterior(anilloConRazonDeMiter(1 / (seno * 1.1)))

    expect(desplazarLado(casiParalelo, { recinto: 0, indice: 0 }, 1).modo).toBe(
      MODO_OFFSET.TRASLACION,
    )
    expect(desplazarLado(yaNoParalelo, { recinto: 0, indice: 0 }, 1).modo).toBe(MODO_OFFSET.BEVEL)
  })

  it('la precedencia de `modo` es TRASLACION > BEVEL > MITER cuando los extremos difieren', () => {
    // v0: esquina recta (MITER). v1: colineal (TRASLACION). Gana TRASLACION.
    const unoYOtro = desplazarLado(comoExterior(CON_VERTICE_DE_PASO), { recinto: 0, indice: 1 }, 1)
    expect(unoYOtro.modo).toBe(MODO_OFFSET.TRASLACION)

    // v0: esquina recta (MITER). v1: pico de 1° (BEVEL). Gana BEVEL.
    const conPico = desplazarLado(comoExterior(PICO_AGUDO), { recinto: 0, indice: 0 }, 0.5)
    expect(conPico.modo).toBe(MODO_OFFSET.BEVEL)
  })
})

// ── 6 · Huecos ───────────────────────────────────────────────────────────────

describe('edit/offset.js — huecos: «fuera del anillo del hueco» es «hacia el material»', () => {
  it('distancia > 0 AGRANDA el hueco y por tanto MENGUA la superficie neta', () => {
    const recintos = EXTERIOR_CON_HUECO()
    expect(superficie(recintos)).toBe(300)

    const r = desplazarLado(recintos, { recinto: 1, indice: 0 }, 1)

    expect(r.recintos[1].vertices).toEqual([
      [4, 5],
      [4, 15],
      [15, 15],
      [15, 5],
    ])
    expect(area(r.recintos[1].vertices)).toBe(110) // el ANILLO del hueco crece
    expect(superficie(r.recintos)).toBe(290) // la parcela NETA mengua
  })

  it('distancia < 0 encoge el hueco y hace crecer la superficie neta', () => {
    const r = desplazarLado(EXTERIOR_CON_HUECO(), { recinto: 1, indice: 0 }, -1)
    expect(area(r.recintos[1].vertices)).toBe(90)
    expect(superficie(r.recintos)).toBe(310)
  })

  it('el anillo EXTERIOR no se entera de que se ha editado un hueco', () => {
    const r = desplazarLado(EXTERIOR_CON_HUECO(), { recinto: 1, indice: 0 }, 1)
    expect(r.recintos[0].vertices).toEqual(EXTERIOR_CON_HUECO()[0].vertices)
  })

  it('el sentido de giro del hueco tampoco importa: invertido da el mismo resultado', () => {
    const recintos = EXTERIOR_CON_HUECO()
    const hueco = recintos[1].vertices
    const invertidos = EXTERIOR_CON_HUECO()
    invertidos[1].vertices = [...hueco].reverse()

    const directo = desplazarLado(recintos, { recinto: 1, indice: 0 }, 1)
    const inverso = desplazarLado(invertidos, { recinto: 1, indice: ladoEnInvertido(0, 4) }, 1)

    expect(superficie(directo.recintos)).toBe(290)
    expect(superficie(inverso.recintos)).toBe(290)
  })
})

// ── 7 · Triángulo (el vecino por los dos lados es el MISMO vértice) ──────────

describe('edit/offset.js — triángulo: n = 3, donde los dos vecinos coinciden', () => {
  it('desplazar el lado 0 recalcula los dos vértices contra las rectas de v2', () => {
    const r = desplazarLado(comoExterior(TRIANGULO), { recinto: 0, indice: 0 }, 1)

    expect(r.recintos[0].vertices).toEqual([
      [0, -1],
      [11, -1],
      [0, 10],
    ])
    expect(r.modo).toBe(MODO_OFFSET.MITER)
    expect(area(TRIANGULO)).toBe(50)
    expect(area(r.recintos[0].vertices)).toBe(60.5)
  })

  it('también en el lado de CIERRE del triángulo (indice 2)', () => {
    const r = desplazarLado(comoExterior(TRIANGULO), { recinto: 0, indice: 2 }, 1)
    expect(r.recintos[0].vertices).toEqual([
      [-1, 0],
      [10, 0],
      [-1, 11],
    ])
    expect(area(r.recintos[0].vertices)).toBe(60.5)
  })

  it('el triángulo invertido crece exactamente igual (el signo también vale con n = 3)', () => {
    const invertido = [...TRIANGULO].reverse()
    const r = desplazarLado(comoExterior(invertido), { recinto: 0, indice: ladoEnInvertido(0, 3) }, 1)
    expect(area(r.recintos[0].vertices)).toBe(60.5)
  })
})

// ── 8 · Casos que NO se pueden aplicar: se cuentan, no se lanzan ─────────────

describe('edit/offset.js — lo que el usuario pide y no se puede hacer (regla de oro 1)', () => {
  it('distancia 0: devuelve la geometría igual, modo MITER y una detección', () => {
    const entrada = comoExterior(CUADRADO)
    const r = desplazarLado(entrada, { recinto: 0, indice: 0 }, 0)

    expect(r.recintos).toEqual(entrada)
    expect(r.recintos).not.toBe(entrada)
    expect(r.modo).toBe(MODO_OFFSET.MITER)
    expect(tipos(r)).toEqual([TIPO_OFFSET.SIN_DESPLAZAMIENTO])
    expect(r.detecciones[0].mensaje).toContain('0 m')
  })

  it('anillo de 2 vértices: no hay lados; geometría intacta y detección', () => {
    const entrada = comoExterior([
      [0, 0],
      [10, 0],
    ])
    const r = desplazarLado(entrada, { recinto: 0, indice: 0 }, 1)

    expect(r.recintos).toEqual(entrada)
    expect(tipos(r)).toEqual([TIPO_OFFSET.ANILLO_INSUFICIENTE])
    expect(r.detecciones[0].mensaje).toContain('2 vértice')
  })

  it('lado de longitud cero (vértice duplicado): geometría intacta y detección', () => {
    const entrada = comoExterior([
      [0, 0],
      [10, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ])
    const r = desplazarLado(entrada, { recinto: 0, indice: 1 }, 1)

    expect(r.recintos).toEqual(entrada)
    expect(tipos(r)).toEqual([TIPO_OFFSET.LADO_DEGENERADO])
    expect(r.detecciones[0].mensaje).toContain('vértice 1 al 2')
  })

  it('anillo de área nula (vértices alineados): avisa de que «fuera» es indeterminado', () => {
    const entrada = comoExterior([
      [0, 0],
      [1, 0],
      [2, 0],
    ])
    const r = desplazarLado(entrada, { recinto: 0, indice: 0 }, 1)

    expect(tipos(r)).toContain(TIPO_OFFSET.ORIENTACION_INDETERMINADA)
    expect(r.detecciones[0].mensaje).toContain('antihorario')
    // No hay esquina en ningún extremo: los dos se trasladan.
    expect(r.modo).toBe(MODO_OFFSET.TRASLACION)
  })

  it('ninguno de estos casos lanza', () => {
    expect(() => desplazarLado(comoExterior(CUADRADO), { recinto: 0, indice: 0 }, 0)).not.toThrow()
    expect(() =>
      desplazarLado(
        comoExterior([
          [0, 0],
          [1, 1],
        ]),
        { recinto: 0, indice: 1 },
        1,
      ),
    ).not.toThrow()
  })

  it('toda detección tiene EXACTAMENTE {tipo, mensaje}, con texto no vacío y en español', () => {
    const casos = [
      desplazarLado(comoExterior(CUADRADO), { recinto: 0, indice: 0 }, 0),
      desplazarLado(comoExterior(PICO_AGUDO), { recinto: 0, indice: 0 }, 0.5),
      desplazarLado(comoExterior(CON_VERTICE_DE_PASO), { recinto: 0, indice: 1 }, 1),
    ]
    for (const r of casos) {
      for (const d of r.detecciones) {
        expect(Object.keys(d).sort()).toEqual(['mensaje', 'tipo'])
        expect(Object.values(TIPO_OFFSET)).toContain(d.tipo)
        expect(d.mensaje.length).toBeGreaterThan(20)
        expect(d.mensaje).toMatch(/[áéíóúñ¿¡]/i) // es castellano, no un código ni inglés
      }
    }
  })
})

// ── 9 · Inmutabilidad ────────────────────────────────────────────────────────

describe('edit/offset.js — inmutabilidad (el undo depende de ella)', () => {
  it('no muta la entrada ni siquiera congelada en profundidad', () => {
    const entrada = congelar(EXTERIOR_CON_HUECO())
    const copia = structuredClone(EXTERIOR_CON_HUECO())

    expect(() => desplazarLado(entrada, { recinto: 0, indice: 0 }, 2.5)).not.toThrow()
    expect(entrada).toEqual(copia)
  })

  it('la salida no comparte NI UNA referencia con la entrada', () => {
    const entrada = EXTERIOR_CON_HUECO()
    const r = desplazarLado(entrada, { recinto: 0, indice: 0 }, 1)
    expect(compartidas(entrada, r.recintos)).toEqual([])
  })

  it('tampoco en los casos que no aplican nada (distancia 0, anillo insuficiente)', () => {
    const entrada = EXTERIOR_CON_HUECO()
    expect(compartidas(entrada, desplazarLado(entrada, { recinto: 0, indice: 0 }, 0).recintos)).toEqual([])

    const corto = comoExterior([
      [0, 0],
      [1, 1],
    ])
    expect(compartidas(corto, desplazarLado(corto, { recinto: 0, indice: 0 }, 1).recintos)).toEqual([])
  })

  it('los pares [x,y] de la salida son arrays nuevos, incluso los que no cambian', () => {
    const entrada = comoExterior(CUADRADO)
    const r = desplazarLado(entrada, { recinto: 0, indice: 0 }, 1)
    expect(r.recintos[0].vertices[2]).toEqual(entrada[0].vertices[2])
    expect(r.recintos[0].vertices[2]).not.toBe(entrada[0].vertices[2])
  })
})

// ── 10 · Contrato roto por el programador → throw ────────────────────────────

describe('edit/offset.js — contrato roto por el PROGRAMADOR: lanza nombrando el argumento', () => {
  const REC = () => comoExterior(CUADRADO)

  it('recintos que no es array → TypeError', () => {
    expect(() => desplazarLado(null, { recinto: 0, indice: 0 }, 1)).toThrow(TypeError)
    expect(() => desplazarLado('recintos', { recinto: 0, indice: 0 }, 1)).toThrow(/'recintos'/)
    expect(() => desplazarLado(undefined, { recinto: 0, indice: 0 }, 1)).toThrow(/recibido undefined/)
  })

  it('referencia que no es {recinto, indice} → TypeError', () => {
    expect(() => desplazarLado(REC(), null, 1)).toThrow(TypeError)
    expect(() => desplazarLado(REC(), [0, 0], 1)).toThrow(/\{recinto, indice\}/)
    expect(() => desplazarLado(REC(), { recinto: 0.5, indice: 0 }, 1)).toThrow(/'recinto'/)
    expect(() => desplazarLado(REC(), { recinto: 0, indice: '0' }, 1)).toThrow(/'indice'/)
  })

  it('recinto o indice fuera de rango → RangeError que dice el rango válido', () => {
    expect(() => desplazarLado(REC(), { recinto: 1, indice: 0 }, 1)).toThrow(RangeError)
    expect(() => desplazarLado(REC(), { recinto: -1, indice: 0 }, 1)).toThrow(/Válidos 0\.\.0/)
    expect(() => desplazarLado(REC(), { recinto: 0, indice: 4 }, 1)).toThrow(RangeError)
    expect(() => desplazarLado(REC(), { recinto: 0, indice: 4 }, 1)).toThrow(/lado 3 es el de CIERRE/)
    expect(() => desplazarLado([], { recinto: 0, indice: 0 }, 1)).toThrow(/No hay ningún recinto/)
  })

  it('distancia no finita → TypeError', () => {
    for (const mala of [NaN, Infinity, -Infinity, '1', null, undefined]) {
      expect(() => desplazarLado(REC(), { recinto: 0, indice: 0 }, mala)).toThrow(TypeError)
    }
    expect(() => desplazarLado(REC(), { recinto: 0, indice: 0 }, NaN)).toThrow(/'distancia'/)
  })

  it('opciones fuera de dominio → TypeError (forma) o RangeError (rango)', () => {
    const ref = { recinto: 0, indice: 0 }
    expect(() => desplazarLado(REC(), ref, 1, null)).toThrow(TypeError)
    expect(() => desplazarLado(REC(), ref, 1, { senoMinimo: 'x' })).toThrow(/senoMinimo/)
    expect(() => desplazarLado(REC(), ref, 1, { senoMinimo: 1 })).toThrow(RangeError)
    expect(() => desplazarLado(REC(), ref, 1, { senoMinimo: -0.1 })).toThrow(RangeError)
    expect(() => desplazarLado(REC(), ref, 1, { miterLimite: NaN })).toThrow(TypeError)
    expect(() => desplazarLado(REC(), ref, 1, { miterLimite: 0.5 })).toThrow(RangeError)
    expect(() => desplazarLado(REC(), ref, 1, { miterLimite: 0.5 })).toThrow(/nunca baja de 1/)
  })

  it('Infinity SÍ vale como miterLimite: es la forma documentada de pedir «sin bisel»', () => {
    expect(() =>
      desplazarLado(REC(), { recinto: 0, indice: 0 }, 1, { miterLimite: Infinity }),
    ).not.toThrow()
  })

  it('sin `opciones` usa los valores de config/operativos.json', () => {
    const conDefectos = desplazarLado(comoExterior(PICO_AGUDO), { recinto: 0, indice: 0 }, 0.5)
    const explicito = desplazarLado(comoExterior(PICO_AGUDO), { recinto: 0, indice: 0 }, 0.5, {
      senoMinimo: OPERATIVOS.senoMinimoOffset,
      miterLimite: OPERATIVOS.miterLimiteFactor,
    })
    expect(conDefectos).toEqual(explicito)
  })
})

// ── 11 · La parcela REAL del proyecto ────────────────────────────────────────

describe('edit/offset.js — parcela real 9398516VK3799G (EPSG:25830, 15 vértices)', () => {
  const D = 0.1
  const INVERTIDA = [...PARCELA_REAL].reverse()

  it('el fixture es el que se cree: 15 vértices, HORARIO, 1535,87 m²', () => {
    expect(PARCELA_REAL).toHaveLength(15)
    expect(orientacion(PARCELA_REAL)).toBe(-1)
    expect(area(PARCELA_REAL)).toBeCloseTo(1535.865149996761, 9)
    // Norte ≈ 4,48·10⁶: si la aritmética no trasladara a origen local, aquí se vería.
    expect(PARCELA_REAL[0][0]).toBeGreaterThan(439222)
    expect(PARCELA_REAL[0][1]).toBeGreaterThan(4479637)
  })

  it('desplazar CUALQUIERA de los 15 lados 10 cm hacia fuera hace crecer la superficie', () => {
    for (let i = 0; i < PARCELA_REAL.length; i++) {
      const r = desplazarLado(comoExterior(PARCELA_REAL), { recinto: 0, indice: i }, D)
      expect(area(r.recintos[0].vertices)).toBeGreaterThan(area(PARCELA_REAL))
    }
  })

  it('y hacia dentro la hace menguar, en los 15 lados', () => {
    for (let i = 0; i < PARCELA_REAL.length; i++) {
      const r = desplazarLado(comoExterior(PARCELA_REAL), { recinto: 0, indice: i }, -D)
      expect(area(r.recintos[0].vertices)).toBeLessThan(area(PARCELA_REAL))
    }
  })

  it('EL SIGNO sobre dato real: el anillo invertido da EXACTAMENTE la misma superficie', () => {
    const n = PARCELA_REAL.length
    for (let i = 0; i < n; i++) {
      const directo = desplazarLado(comoExterior(PARCELA_REAL), { recinto: 0, indice: i }, D)
      const inverso = desplazarLado(
        comoExterior(INVERTIDA),
        { recinto: 0, indice: ladoEnInvertido(i, n) },
        D,
      )
      expect(area(inverso.recintos[0].vertices)).toBeCloseTo(area(directo.recintos[0].vertices), 9)
    }
  })

  it('ningún vértice se dispara: el salto está acotado por miterLimite · |d| en los 15 lados', () => {
    const tope = OPERATIVOS.miterLimiteFactor * D
    for (let i = 0; i < PARCELA_REAL.length; i++) {
      const r = desplazarLado(comoExterior(PARCELA_REAL), { recinto: 0, indice: i }, D)
      expect(maxSalto(r.recintos[0].vertices, PARCELA_REAL)).toBeLessThanOrEqual(tope + 1e-9)
    }
  })

  it('el dato real TRAE los dos fallbacks: hay lados que biselan y lados que trasladan', () => {
    const modos = new Set()
    for (let i = 0; i < PARCELA_REAL.length; i++) {
      modos.add(desplazarLado(comoExterior(PARCELA_REAL), { recinto: 0, indice: i }, D).modo)
    }
    // No es un caso de laboratorio: los tres modos salen de una parcela del Catastro.
    expect(modos).toEqual(new Set([MODO_OFFSET.MITER, MODO_OFFSET.BEVEL, MODO_OFFSET.TRASLACION]))
  })

  it('el lado 0 cae a TRASLACION porque v0, v1 y v2 son casi colineales en el dato real', () => {
    const r = desplazarLado(comoExterior(PARCELA_REAL), { recinto: 0, indice: 0 }, D)
    expect(r.modo).toBe(MODO_OFFSET.TRASLACION)
    expect(tipos(r)).toContain(TIPO_OFFSET.EXTREMO_TRASLADADO)
  })

  it('el resultado sigue siendo un anillo abierto de POJOs con pares [x,y] finitos', () => {
    const r = desplazarLado(comoExterior(PARCELA_REAL), { recinto: 0, indice: 7 }, D)
    for (const v of r.recintos[0].vertices) {
      expect(Array.isArray(v)).toBe(true)
      expect(v).toHaveLength(2)
      expect(Number.isFinite(v[0])).toBe(true)
      expect(Number.isFinite(v[1])).toBe(true)
    }
    // Anillo ABIERTO: el último vértice no repite al primero.
    const vs = r.recintos[0].vertices
    expect(vs[vs.length - 1]).not.toEqual(vs[0])
  })

  it('desplazar 0,25 m y volver a desplazar −0,25 m devuelve casi el anillo de partida', () => {
    // Solo es exacto donde no hubo fallback (los fallbacks añaden o giran vértices);
    // se elige el lado 12, el único que resuelve en MITER puro sobre este dato.
    const ida = desplazarLado(comoExterior(PARCELA_REAL), { recinto: 0, indice: 12 }, 0.25)
    expect(ida.modo).toBe(MODO_OFFSET.MITER)
    const vuelta = desplazarLado(ida.recintos, { recinto: 0, indice: 12 }, -0.25)

    expect(vuelta.recintos[0].vertices).toHaveLength(PARCELA_REAL.length)
    for (let k = 0; k < PARCELA_REAL.length; k++) {
      expect(distancia(vuelta.recintos[0].vertices[k], PARCELA_REAL[k])).toBeLessThan(1e-9)
    }
  })
})
