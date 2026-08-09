/* -------------------------------------------------------------------------- *
 * test/viewer/candidatas.dom.test.js — F22 · T3.2                            *
 *                                                                            *
 * La capa que dibuja las N fincas de un dibujo entre las que hay que elegir,  *
 * y que RESALTA la que se está mirando. El resalte es la mitad que el plan de *
 * F22 dio por hecha y que medir refutó: el cajón de F08 no resaltaba nada.    *
 * -------------------------------------------------------------------------- */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  crearCapaCandidatas,
  textoEmergente,
  selectorCandidata,
  CLASE_CANDIDATA,
  CLASE_RESALTADA,
} from '../../viewer/candidatas.js'
import { PANE } from '../../viewer/_comun.js'
import { montarMapa, crearPanes } from './_ayuda-jsdom.js'

const X0 = 386100
const Y0 = 4064400
const rect = (dx, dy, ancho, alto) => [
  [X0 + dx, Y0 + dy],
  [X0 + dx + ancho, Y0 + dy],
  [X0 + dx + ancho, Y0 + dy + alto],
  [X0 + dx, Y0 + dy + alto],
]

/** Las tres candidatas de casi todos los casos, con sus nombres del fichero. */
const TRES = [
  { vertices: rect(0, 0, 20, 20), nombre: '6346726UF8664N', superficie: 400 },
  { vertices: rect(30, 0, 20, 20), nombre: '6346725UF8664N', superficie: 400 },
  { vertices: rect(60, 0, 20, 20), nombre: '6346714UF8664N', superficie: 400 },
]

let vivos = []
const montar = (opciones = {}) => {
  const { mapa, destruir } = montarMapa()
  crearPanes(mapa)
  const capa = crearCapaCandidatas({ mapa, zona: 30, ...opciones })
  vivos.push(() => {
    capa.destruir()
    destruir()
  })
  return { mapa, capa }
}

afterEach(() => {
  for (const soltar of vivos) soltar()
  vivos = []
})

/** Los polígonos de candidata que hay ahora mismo en el documento. */
const dibujadas = () => [...document.querySelectorAll(`.${CLASE_CANDIDATA}`)]

/**
 * La finca nº `i` de la LISTA, por su atributo.
 *
 * ⚠️ Nunca por posición en el DOM: `resaltar` llama a `bringToFront` y reordena
 * los `<path>`. Se descubrió aquí, con este test en rojo diciendo que el resalte
 * no se aplicaba cuando sí se aplicaba — a otra.
 */
const grosorDe = (i) => Number(document.querySelector(selectorCandidata(i)).getAttribute('stroke-width'))

describe('viewer/candidatas — dibujar', () => {
  it('pinta una por candidata, en el pane de contexto', () => {
    const { capa } = montar()
    capa.pintar(TRES)
    expect(dibujadas()).toHaveLength(3)
    // ⚠️ El pane es `colindantes` y no uno propio: estas fincas TODAVÍA no son la
    // parcela —no ha entrado nada en el store— y llamarlas de otra forma
    // adelantaría una decisión que el usuario no ha tomado.
    for (const el of dibujadas()) {
      expect(el.closest(`.leaflet-${PANE.COLINDANTES}-pane`)).not.toBeNull()
    }
  })

  it('es idempotente: pintar dos veces no acumula', () => {
    const { capa } = montar()
    capa.pintar(TRES)
    capa.pintar(TRES)
    expect(dibujadas()).toHaveLength(3)
  })

  it('`null` limpia, y deja el mapa sin nada', () => {
    const { capa } = montar()
    capa.pintar(TRES)
    capa.pintar(null)
    expect(dibujadas()).toHaveLength(0)
    expect(capa.resaltada()).toBeNull()
  })

  it('⛔ un recinto degenerado se salta, SE AVISA, y no descoloca los índices', () => {
    // Es el fallo silencioso que este hueco evita: sin el `null` de relleno,
    // resaltar la 3.ª resaltaría otra en cuanto una se saltara — y el usuario
    // señalaría mal una finca sin que nada lo dijera.
    const alAvisar = vi.fn()
    const { capa } = montar({ alAvisar })
    capa.pintar([
      TRES[0],
      { vertices: [[X0, Y0]], nombre: 'DEGENERADA', superficie: 0 },
      TRES[2],
    ])
    expect(dibujadas()).toHaveLength(2)
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toContain('1 de 3')

    capa.resaltar(2) // la TERCERA de la lista, no «la segunda dibujada»
    expect(capa.resaltada()).toBe(2)
  })

  it('lo que no es un array ni `null` LANZA: contrato del programador', () => {
    const { capa } = montar()
    expect(() => capa.pintar('tres fincas')).toThrow(TypeError)
  })
})

describe('viewer/candidatas — el resalte', () => {
  it('resalta una y devuelve las demás al estilo de contexto', () => {
    const { capa } = montar()
    capa.pintar(TRES)
    capa.resaltar(1)
    expect(capa.resaltada()).toBe(1)
    expect(grosorDe(1)).toBeGreaterThan(grosorDe(0))
    expect(grosorDe(0)).toBe(grosorDe(2))
  })

  it('cambiar de resalte no deja dos resaltadas', () => {
    const { capa } = montar()
    capa.pintar(TRES)
    capa.resaltar(0)
    const grueso = grosorDe(0)
    capa.resaltar(2)
    expect(grosorDe(0)).toBeLessThan(grueso)
    expect(grosorDe(2)).toBe(grueso)
  })

  it('`null` apaga el resalte sin borrar nada', () => {
    const { capa } = montar()
    capa.pintar(TRES)
    capa.resaltar(1)
    capa.resaltar(null)
    expect(capa.resaltada()).toBeNull()
    expect(dibujadas()).toHaveLength(3)
  })

  it('⚠️ la resaltada va AL FRENTE: en una manzana TODAS comparten lindero', () => {
    // Sin `bringToFront`, el trazo grueso queda por debajo del de la vecina justo
    // en el borde que hay que comparar, y el resalte se ve a medias.
    const { capa } = montar()
    capa.pintar(TRES)
    expect(dibujadas().at(-1).dataset.candidata).toBe('2') // orden de la lista
    capa.resaltar(0)
    expect(dibujadas().at(-1).dataset.candidata).toBe('0') // la resaltada, delante
  })

  it('⛔ y por eso el índice va en el NODO: el orden del DOM deja de ser el de la lista', () => {
    // La mitad no vacua del punto anterior, y el motivo de que exista
    // `selectorCandidata`. Este test estuvo en rojo diciendo que el resalte no se
    // aplicaba, cuando se aplicaba — a la finca que había ocupado esa posición.
    const { capa } = montar()
    capa.pintar(TRES)
    capa.resaltar(1)
    expect(dibujadas().map((el) => el.dataset.candidata)).toEqual(['0', '2', '1'])
    expect(grosorDe(1)).toBeGreaterThan(grosorDe(2))
  })

  it('⛔ la resaltada lleva `CLASE_RESALTADA`, que estuvo exportada y MUERTA', () => {
    // Un nombre exportado es un contrato: quien lo lea escribirá una regla en la
    // hoja o buscará por él. Hasta la fase 5 `resaltar` solo cambiaba el estilo en
    // línea y esta clase no la ponía nadie, así que esa regla no habría pintado
    // nunca y nadie habría sabido por qué. Lo destapó escribir el guion de humo.
    const { capa } = montar()
    capa.pintar(TRES)
    capa.resaltar(1)
    expect(document.querySelectorAll(`.${CLASE_RESALTADA}`)).toHaveLength(1)
    expect(document.querySelector(`.${CLASE_RESALTADA}`).dataset.candidata).toBe('1')

    // Y se QUITA al cambiar de resalte: dos clases puestas es el mismo desajuste
    // que el índice por posición, con otro disfraz.
    capa.resaltar(2)
    expect(document.querySelector(`.${CLASE_RESALTADA}`).dataset.candidata).toBe('2')
    capa.resaltar(null)
    expect(document.querySelectorAll(`.${CLASE_RESALTADA}`)).toHaveLength(0)
    // La de contexto sigue puesta: se AÑADE, no sustituye.
    expect(document.querySelectorAll(`.${CLASE_CANDIDATA}`)).toHaveLength(3)
  })
})

describe('viewer/candidatas — el encuadre', () => {
  it('⛔ lleva el mapa hasta las fincas, que salían a 0 × 0 px', () => {
    // Lo destapó el guion 24 midiendo en Chrome: las candidatas NO pasan por el
    // store, que es quien reencuadra, así que con la aplicación recién abierta
    // —mirando a España entera— la manzana ocupaba menos de un píxel. El cajón
    // decía «marca la tuya, se resalta en el mapa» y no había nada que mirar.
    const { mapa, capa } = montar()
    const encuadres = []
    mapa.fitBounds = (limites, opciones) => encuadres.push({ limites, opciones })

    capa.pintar(TRES)
    expect(capa.encuadrar()).toBe(true)
    expect(encuadres).toHaveLength(1)

    // ⭐ Y encuadra las TRES, no la primera. La mitad no vacua: con una sola finca
    // los límites son casi cuatro veces más estrechos (las tres van de 0 a 80 m en
    // X y cada una mide 20). Sin esto, «encuadra» y «encuadra la primera» pasarían
    // igual, y el usuario tendría dos candidatas fuera de la pantalla.
    const anchoDeTres = encuadres[0].limites.getEast() - encuadres[0].limites.getWest()
    capa.pintar([TRES[0]])
    capa.encuadrar()
    const anchoDeUna = encuadres[1].limites.getEast() - encuadres[1].limites.getWest()
    expect(anchoDeTres).toBeGreaterThan(anchoDeUna * 3)

    // El margen va, o las fincas del borde quedan pegadas al marco.
    expect(encuadres[0].opciones.paddingTopLeft).toEqual([24, 24])
    expect(encuadres[0].opciones.paddingBottomRight).toEqual([24, 24])
  })

  it('⛔ y ESQUIVA el cajón: el guion midió CINCO de ocho tapadas al 100 %', () => {
    // Meterlas todas en el mapa y ponerles encima el panel que hace la pregunta es
    // pedir que se elija a ciegas. ⚠️ jsdom no maqueta, así que las cajas hay que
    // ponerlas a mano: lo que se prueba aquí es la ARITMÉTICA del reparto, y que
    // sirva en pantalla lo mide el guion 24.
    const { mapa, capa } = montar()
    const encuadres = []
    mapa.fitBounds = (limites, opciones) => encuadres.push(opciones)
    mapa.getContainer().getBoundingClientRect = () => ({
      left: 0, top: 0, right: 600, bottom: 700, width: 600, height: 700,
    })
    capa.pintar(TRES)

    // Un cajón pegado abajo a la izquierda, 200 × 300.
    capa.encuadrar({
      evitar: { left: 0, top: 400, right: 200, bottom: 700, width: 200, height: 300 },
    })
    // Margen por la IZQUIERDA (200 + los 24 de base) y por ABAJO (300 + 24): la
    // geometría se va al hueco de arriba a la derecha.
    expect(encuadres[0].paddingTopLeft).toEqual([224, 24])
    expect(encuadres[0].paddingBottomRight).toEqual([24, 324])

    // Y el mismo cajón arriba a la derecha reparte al revés, o el criterio sería
    // «siempre abajo a la izquierda» disfrazado de cálculo.
    capa.encuadrar({
      evitar: { left: 400, top: 0, right: 600, bottom: 300, width: 200, height: 300 },
    })
    expect(encuadres[1].paddingTopLeft).toEqual([24, 324])
    expect(encuadres[1].paddingBottomRight).toEqual([224, 24])
  })

  it('⚠️ el margen del cajón tiene TOPE: sin él el mapa quedaría en una rendija', () => {
    // Un cajón de 420 px sobre un mapa de 600 se comería el 70 % del ancho, y las
    // fincas volverían a no verse: el defecto de partida con otra causa. Se cede
    // como mucho el 45 % de cada eje.
    const { mapa, capa } = montar()
    const encuadres = []
    mapa.fitBounds = (limites, opciones) => encuadres.push(opciones)
    mapa.getContainer().getBoundingClientRect = () => ({
      left: 0, top: 0, right: 600, bottom: 700, width: 600, height: 700,
    })
    capa.pintar(TRES)
    capa.encuadrar({
      evitar: { left: 0, top: 20, right: 420, bottom: 700, width: 420, height: 680 },
    })
    expect(encuadres[0].paddingTopLeft[0]).toBe(24 + Math.round(600 * 0.45))
    expect(encuadres[0].paddingBottomRight[1]).toBe(24 + Math.round(700 * 0.45))
  })

  it('un cajón FUERA del mapa (o cerrado) no mueve el encuadre', () => {
    // Añadirle margen a un estorbo que no estorba desplazaría la vista sin motivo.
    const { mapa, capa } = montar()
    const encuadres = []
    mapa.fitBounds = (limites, opciones) => encuadres.push(opciones)
    mapa.getContainer().getBoundingClientRect = () => ({
      left: 0, top: 0, right: 600, bottom: 700, width: 600, height: 700,
    })
    capa.pintar(TRES)
    capa.encuadrar({ evitar: null })
    capa.encuadrar({ evitar: { left: 900, top: 0, right: 1100, bottom: 300 } })
    expect(encuadres[0].paddingTopLeft).toEqual([24, 24])
    expect(encuadres[1].paddingTopLeft).toEqual([24, 24])
  })

  it('sin nada dibujado NO mueve el mapa, y lo dice devolviendo `false`', () => {
    // Mover el encuadre «por si acaso» dejaría al usuario en otro sitio sin que
    // nada hubiera aparecido: peor que no moverlo.
    const { mapa, capa } = montar()
    let movido = 0
    mapa.fitBounds = () => (movido += 1)
    expect(capa.encuadrar()).toBe(false)
    capa.pintar([])
    expect(capa.encuadrar()).toBe(false)
    expect(movido).toBe(0)
  })

  it('⚠️ NO se encuadra desde `pintar`: mover el mapa es del recorrido', () => {
    // Esconderlo dentro del pintado lo haría inevitable también para quien solo
    // quiera dibujar sin secuestrar la vista.
    const { mapa, capa } = montar()
    let movido = 0
    mapa.fitBounds = () => (movido += 1)
    capa.pintar(TRES)
    expect(movido).toBe(0)
  })

  it('tras `destruir` no mueve el mapa ni lanza', () => {
    const { mapa, capa } = montar()
    let movido = 0
    mapa.fitBounds = () => (movido += 1)
    capa.pintar(TRES)
    capa.destruir()
    expect(capa.encuadrar()).toBe(false)
    expect(movido).toBe(0)
  })
})

describe('viewer/candidatas — señalar en el mapa', () => {
  it('el clic sobre una finca avisa con su índice', () => {
    const { capa } = montar()
    const visto = []
    capa.alSenalar((i) => visto.push(i))
    capa.pintar(TRES)
    dibujadas()[2].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(visto).toEqual([2])
  })

  it('la baja de la suscripción funciona', () => {
    const { capa } = montar()
    const visto = []
    const baja = capa.alSenalar((i) => visto.push(i))
    capa.pintar(TRES)
    baja()
    dibujadas()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(visto).toEqual([])
  })

  it('un suscriptor roto se cuenta y NO tumba a los demás', () => {
    const alAvisar = vi.fn()
    const { capa } = montar({ alAvisar })
    const visto = []
    capa.alSenalar(() => {
      throw new Error('roto')
    })
    capa.alSenalar((i) => visto.push(i))
    capa.pintar(TRES)
    dibujadas()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(visto).toEqual([1])
    expect(alAvisar).toHaveBeenCalled()
  })
})

describe('viewer/candidatas — el rótulo del emergente', () => {
  it('con nombre, lo dice; con superficie, la formatea en español', () => {
    expect(textoEmergente('6346726UF8664N', 1, 548.05)).toBe('6346726UF8664N · 548,05 m²')
  })

  it('⚠️ SIN nombre no se inventa «Parcela 3»: se dice el sitio en la lista', () => {
    // Llamar «Parcela 3» a un recinto del que no sabemos el nombre afirma algo que
    // nadie ha dicho. Y el orden empieza en 1, que es como cuenta el usuario.
    expect(textoEmergente(null, 3, 655.7)).toBe('Recinto 3 · 655,70 m²')
    // ⚠️ Y el español NO agrupa millares de cuatro cifras (`minimumGroupingDigits`
    // vale 2 en CLDR para es-ES): son «1098,85» y no «1.098,85». Medido, no
    // supuesto — la expectativa contraria puso este test en rojo.
    expect(textoEmergente('', 1, 1098.85)).toBe('Recinto 1 · 1098,85 m²')
    expect(textoEmergente(null, 6, 15165.36)).toBe('Recinto 6 · 15.165,36 m²')
  })
})

describe('viewer/candidatas — contratos y desmontaje', () => {
  it('sin mapa, sin huso válido o sin el pane, LANZA', () => {
    const { mapa, destruir } = montarMapa()
    vivos.push(destruir)
    expect(() => crearCapaCandidatas({ mapa: null, zona: 30 })).toThrow(TypeError)
    expect(() => crearCapaCandidatas({ mapa, zona: 99 })).toThrow(RangeError)
    // El pane no está creado en este mapa: es el fallo que dejaría las candidatas
    // dibujadas por encima de todo lo demás sin que nada lo dijera.
    expect(() => crearCapaCandidatas({ mapa, zona: 30 })).toThrow(/pane/)
  })

  it('tras `destruir`, pintar y resaltar son no-ops y no lanzan', () => {
    const { mapa, destruir } = montarMapa()
    crearPanes(mapa)
    const capa = crearCapaCandidatas({ mapa, zona: 30 })
    vivos.push(destruir)
    capa.pintar(TRES)
    capa.destruir()
    expect(dibujadas()).toHaveLength(0)
    expect(() => capa.pintar(TRES)).not.toThrow()
    expect(() => capa.resaltar(0)).not.toThrow()
    expect(dibujadas()).toHaveLength(0)
    capa.destruir() // idempotente
  })
})
