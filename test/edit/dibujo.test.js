/* -------------------------------------------------------------------------- *
 * test/edit/dibujo.test.js — Dibujar un recinto desde cero (F12 · T2.1)       *
 *                                                                            *
 * Es la deuda declarada 1 de F06, escrita once fases después. Lo que se       *
 * defiende aquí, por orden de importancia:                                    *
 *   1. NADA muta el trazo de entrada, y una operación RECHAZADA devuelve el   *
 *      MISMO objeto (identidad `===`): así el llamante distingue «no ha       *
 *      pasado nada» sin comparar contenidos.                                  *
 *   2. Los cuatro motivos son datos del USUARIO y NINGUNO lanza. Lo que lanza *
 *      es el contrato roto por el programador, y solo eso.                    *
 *   3. Cerrar deja el anillo ABIERTO —como el modelo—, y produce siempre un   *
 *      EXTERIOR: una parte no admite huecos (criterio de aceptación 4).       *
 *   4. Cerrar un contorno que se cruza consigo mismo NO se impide, y es       *
 *      deliberado: eso es un hallazgo de `validation/`, no un fallo de la     *
 *      herramienta.                                                           *
 * -------------------------------------------------------------------------- */

import { describe, expect, it } from 'vitest'

import {
  MENSAJE_POR_MOTIVO_DIBUJO,
  MOTIVO_DIBUJO,
  anadirPunto,
  cancelar,
  cerrar,
  deshacerUltimo,
  iniciar,
  recintoDe,
  sePuedeCerrar,
} from '../../edit/dibujo.js'
import { MINIMO_VERTICES } from '../../edit/vertices.js'

// ── Andamiaje ─────────────────────────────────────────────────────────────────

/** Un trazo con `n` puntos distintos, sin cerrar. */
const conPuntos = (n) => {
  let t = iniciar()
  for (let i = 0; i < n; i += 1) t = anadirPunto(t, [440000 + i * 10, 4100000 + i * 5]).trazo
  return t
}

/** Un triángulo cerrado, que es el recinto más pequeño que existe. */
const triangulo = () => cerrar(conPuntos(3)).trazo

// ── El vocabulario ───────────────────────────────────────────────────────────

describe('edit/dibujo · el vocabulario', () => {
  it('los cuatro motivos tienen texto, y el mapa es TOTAL', () => {
    for (const motivo of Object.values(MOTIVO_DIBUJO)) {
      expect(MENSAJE_POR_MOTIVO_DIBUJO[motivo], `sin texto: ${motivo}`).toBeTruthy()
      expect(typeof MENSAJE_POR_MOTIVO_DIBUJO[motivo]).toBe('string')
    }
    expect(Object.keys(MENSAJE_POR_MOTIVO_DIBUJO).sort()).toEqual(
      Object.values(MOTIVO_DIBUJO).sort(),
    )
  })

  it('el suelo de vértices es el MISMO que el de `edit/vertices.js`, no una copia', () => {
    // Si divergieran, se podría cerrar un recinto que después no se puede editar
    // sin romperlo, o al revés.
    expect(MINIMO_VERTICES).toBe(3)
    expect(MENSAJE_POR_MOTIVO_DIBUJO[MOTIVO_DIBUJO.MINIMO_TRES_VERTICES]).toContain(
      String(MINIMO_VERTICES),
    )
  })
})

// ── iniciar / anadirPunto ────────────────────────────────────────────────────

describe('edit/dibujo · empezar y poner vértices', () => {
  it('`iniciar` da un trazo vacío y abierto', () => {
    expect(iniciar()).toEqual({ puntos: [], cerrado: false })
  })

  it('cada punto se añade AL FINAL y el trazo de entrada no se toca', () => {
    const t0 = iniciar()
    const r1 = anadirPunto(t0, [440000, 4100000])
    expect(t0.puntos).toEqual([]) // intacto
    expect(r1.trazo.puntos).toEqual([[440000, 4100000]])
    expect(r1.motivo).toBeNull()

    const r2 = anadirPunto(r1.trazo, [440010, 4100000])
    expect(r1.trazo.puntos).toHaveLength(1) // intacto
    expect(r2.trazo.puntos).toHaveLength(2)
  })

  it('⛔ un punto ENCIMA del anterior se ignora, y el trazo devuelto es el MISMO', () => {
    // Pasa más de lo que parece con el enganche puesto: dos clics cerca del mismo
    // vértice del parcelario se ajustan los dos a ese vértice.
    const t = conPuntos(2)
    const ultimo = t.puntos[t.puntos.length - 1]
    const r = anadirPunto(t, [...ultimo])
    expect(r.motivo).toBe(MOTIVO_DIBUJO.PUNTO_REPETIDO)
    expect(r.trazo).toBe(t) // identidad, no solo contenido
  })

  it('un punto igual al PRIMERO sí entra: cerrar es otra cosa', () => {
    const t = conPuntos(3)
    const r = anadirPunto(t, [...t.puntos[0]])
    expect(r.motivo).toBeNull()
    expect(r.trazo.puntos).toHaveLength(4)
  })

  it('no comparte arrays con la entrada: mutar el punto de fuera no cambia el trazo', () => {
    const vivo = [440000, 4100000]
    const r = anadirPunto(iniciar(), vivo)
    vivo[0] = 999
    expect(r.trazo.puntos[0][0]).toBe(440000)
  })

  it('LANZA con un punto que no es un par de números finitos (bug del llamante)', () => {
    for (const malo of [null, [1], ['a', 2], [NaN, 0], [Infinity, 0], 'x']) {
      expect(() => anadirPunto(iniciar(), malo)).toThrow(TypeError)
    }
  })

  it('LANZA con algo que no es un trazo', () => {
    for (const malo of [null, undefined, [], { puntos: [] }, { cerrado: false }]) {
      expect(() => anadirPunto(malo, [0, 0])).toThrow(TypeError)
    }
  })
})

// ── deshacerUltimo ───────────────────────────────────────────────────────────

describe('edit/dibujo · deshacer el último vértice', () => {
  it('quita el último y deja el resto', () => {
    const t = conPuntos(3)
    const r = deshacerUltimo(t)
    expect(r.motivo).toBeNull()
    expect(r.trazo.puntos).toEqual(t.puntos.slice(0, 2))
    expect(t.puntos).toHaveLength(3) // intacto
  })

  it('sobre un trazo vacío no hay nada que deshacer, y se dice', () => {
    const t = iniciar()
    const r = deshacerUltimo(t)
    expect(r.motivo).toBe(MOTIVO_DIBUJO.TRAZO_VACIO)
    expect(r.trazo).toBe(t)
  })

  it('sobre un trazo CERRADO no se deshace: el resultado no se retoca por aquí', () => {
    const t = triangulo()
    const r = deshacerUltimo(t)
    expect(r.motivo).toBe(MOTIVO_DIBUJO.TRAZO_CERRADO)
    expect(r.trazo).toBe(t)
  })
})

// ── cerrar ───────────────────────────────────────────────────────────────────

describe('edit/dibujo · cerrar el recinto', () => {
  it('⛔ con dos vértices NO se cierra: eso es un segmento, no un recinto', () => {
    const t = conPuntos(2)
    const r = cerrar(t)
    expect(r.motivo).toBe(MOTIVO_DIBUJO.MINIMO_TRES_VERTICES)
    expect(r.trazo).toBe(t)
    expect(r.trazo.cerrado).toBe(false)
  })

  it('con tres sí, y el trazo queda cerrado', () => {
    const r = cerrar(conPuntos(3))
    expect(r.motivo).toBeNull()
    expect(r.trazo.cerrado).toBe(true)
    expect(r.trazo.puntos).toHaveLength(3)
  })

  it('⭐ cerrar NO repite el primer punto al final: el anillo queda ABIERTO', () => {
    // Es como el modelo guarda la geometría en todo el proyecto. Repetirlo aquí
    // metería un vértice duplicado que habría que quitar en el sitio equivocado.
    const r = cerrar(conPuntos(4))
    expect(r.trazo.puntos).toHaveLength(4)
    expect(r.trazo.puntos[0]).not.toEqual(r.trazo.puntos[3])
  })

  it('cerrar dos veces no hace nada, y lo dice', () => {
    const t = triangulo()
    const r = cerrar(t)
    expect(r.motivo).toBe(MOTIVO_DIBUJO.TRAZO_CERRADO)
    expect(r.trazo).toBe(t)
  })

  it('⛔ un contorno que SE CRUZA consigo mismo se cierra igual, y es deliberado', () => {
    // Un lazo: eso es un hallazgo de `validation/reglas-topologia.js` (`kinks`),
    // no un fallo de la herramienta. Quien dibuja tiene derecho a cerrar y ver
    // dónde está el nudo, en vez de que se le niegue el gesto sin poder mirarlo.
    let t = iniciar()
    for (const p of [
      [0, 0],
      [10, 10],
      [10, 0],
      [0, 10],
    ]) {
      t = anadirPunto(t, p).trazo
    }
    const r = cerrar(t)
    expect(r.motivo).toBeNull()
    expect(r.trazo.cerrado).toBe(true)
  })
})

// ── cancelar ─────────────────────────────────────────────────────────────────

describe('edit/dibujo · cancelar', () => {
  it('devuelve un trazo vacío, y NUNCA falla — ni sobre uno cerrado', () => {
    // Cancelar es la salida, y una salida que a veces no funciona no es una salida.
    expect(cancelar()).toEqual({ puntos: [], cerrado: false })
    expect(cancelar(triangulo())).toEqual({ puntos: [], cerrado: false })
  })

  it('no devuelve `ResultadoDibujo`: no hay motivo posible que contar', () => {
    expect('motivo' in cancelar()).toBe(false)
  })
})

// ── sePuedeCerrar ────────────────────────────────────────────────────────────

describe('edit/dibujo · sePuedeCerrar', () => {
  it('⭐ dice exactamente lo que `cerrar` acepta, sin copiar el número tres', () => {
    // La regla de oro 1 aplicada a un botón: si está encendido, funciona.
    for (let n = 0; n <= 5; n += 1) {
      const t = conPuntos(n)
      expect(sePuedeCerrar(t), `con ${n} puntos`).toBe(cerrar(t).motivo === null)
    }
  })

  it('un trazo ya cerrado no se puede volver a cerrar', () => {
    expect(sePuedeCerrar(triangulo())).toBe(false)
  })
})

// ── recintoDe ────────────────────────────────────────────────────────────────

describe('edit/dibujo · el trazo como Recinto del modelo', () => {
  it('mientras no está cerrado devuelve `null`, y NO lanza', () => {
    // «Aún no hay recinto» es el estado NORMAL de un dibujo a medias.
    expect(recintoDe(iniciar())).toBeNull()
    expect(recintoDe(conPuntos(2))).toBeNull()
    expect(recintoDe(conPuntos(5))).toBeNull()
  })

  it('cerrado devuelve un EXTERIOR con sus vértices', () => {
    const r = recintoDe(triangulo())
    expect(r.tipo).toBe('EXTERIOR')
    expect(r.vertices).toHaveLength(3)
  })

  it('⛔ SIEMPRE es EXTERIOR: un trazo no puede producir un hueco (criterio 4)', () => {
    for (const n of [3, 4, 8]) {
      expect(recintoDe(cerrar(conPuntos(n)).trazo).tipo).toBe('EXTERIOR')
    }
  })

  it('el recinto no comparte arrays con el trazo', () => {
    const t = triangulo()
    const r = recintoDe(t)
    r.vertices[0][0] = 999
    expect(t.puntos[0][0]).not.toBe(999)
  })
})

// ── El recorrido entero ──────────────────────────────────────────────────────

describe('edit/dibujo · el recorrido de un porche, de principio a fin', () => {
  it('cuatro clics, un error deshecho, y el recinto sale para el modelo', () => {
    let t = iniciar()
    t = anadirPunto(t, [440000, 4100000]).trazo
    t = anadirPunto(t, [440010, 4100000]).trazo
    t = anadirPunto(t, [440010, 4100003]).trazo
    // Un clic de más, en el sitio equivocado…
    t = anadirPunto(t, [440500, 4100500]).trazo
    expect(t.puntos).toHaveLength(4)
    // …que se deshace sin perder los tres buenos.
    t = deshacerUltimo(t).trazo
    expect(t.puntos).toHaveLength(3)
    t = anadirPunto(t, [440000, 4100003]).trazo

    expect(sePuedeCerrar(t)).toBe(true)
    const cerrado = cerrar(t)
    expect(cerrado.motivo).toBeNull()

    const recinto = recintoDe(cerrado.trazo)
    expect(recinto).toEqual({
      tipo: 'EXTERIOR',
      vertices: [
        [440000, 4100000],
        [440010, 4100000],
        [440010, 4100003],
        [440000, 4100003],
      ],
    })
  })

  it('el trazo sobrevive a `structuredClone`: es un POJO plano y sirve de foto', () => {
    const t = conPuntos(4)
    const copia = structuredClone(t)
    expect(copia).toEqual(t)
    expect(copia).not.toBe(t)
    // Y sigue funcionando como trazo tras el viaje.
    expect(cerrar(copia).motivo).toBeNull()
  })
})
