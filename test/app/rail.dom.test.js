/* -------------------------------------------------------------------------- *
 * test/app/rail.dom.test.js — Rework de UI · T5 · el rail de navegación        *
 *                                                                              *
 * `app/rail.js` es un APLICADOR: se suscribe a `app/navegacion.js` y pinta. No  *
 * decide nada, y la mitad de lo que se vigila aquí es justamente eso — que no   *
 * decida. El motivo que sale en un paso apagado se compara contra la constante  *
 * de la AUTORIDAD, no contra un literal escrito aquí: si un día este módulo     *
 * empezara a redactar sus propios textos, esta suite lo caza.                    *
 *                                                                              *
 * ── LO QUE MÁS IMPORTA, Y NO ES LO QUE PARECE ──                               *
 * No es que pinte bonito: es que **NUNCA saque un peldaño del `<ol>`**. La      *
 * regla dura viene medida de `app/rama.js:24-40` y en este rail todavía no      *
 * duele —nadie cuelga cableado de los peldaños— pero se cumple desde el primer  *
 * día para que nadie «optimice» quitándolos el día que sí duela. Hay un `it`    *
 * que navega los cinco pasos en las dos ramas y exige que los cinco `<li>`      *
 * sigan siendo LOS MISMOS NODOS.                                                *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  MOTIVO_DATO,
  MOTIVO_RAMA,
  PASO,
  PASOS,
  RAMA,
  ROTULO_PASO,
  crearNavegacion,
} from '../../app/navegacion.js'
import {
  ATRIBUTO_ESTADO,
  ATRIBUTO_IR_A_PASO,
  CLASE,
  ESTADO,
  MENSAJE_NAVEGAR_ROTO,
  SELECTOR_PASOS,
  SELECTOR_RAIL,
  cablearRail,
  selectorPaso,
} from '../../app/rail.js'

const RAIZ = join(import.meta.dirname, '..', '..')

const INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body([^>]*)>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/rail.dom.test.js: no se ha encontrado el <body> de index.html. La cáscara de ' +
        'estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  const clase = /class\s*=\s*"([^"]*)"/i.exec(encontrado[1])
  return { clase: clase === null ? '' : clase[1], cuerpo: encontrado[2] }
})()

function montarCascara() {
  document.body.className = INDEX.clase
  document.body.innerHTML = INDEX.cuerpo
}

/** Un panel de avisos de mentira: lo único que este módulo le pide es `avisar`. */
const doblePanel = () => ({ avisar: vi.fn() })

let vivo = null
afterEach(() => {
  vivo?.destruir()
  vivo = null
})

/** Monta la cáscara real y cablea el rail sobre una navegación de verdad. */
function cablear({ hechos = {}, rama = RAMA.PARCELA, alNavegar = null } = {}) {
  montarCascara()
  const panel = doblePanel()
  const navegacion = crearNavegacion({ rama, hechos, avisar: () => {} })
  vivo = cablearRail({ documento: document, navegacion, panel, alNavegar })
  return { rail: vivo, navegacion, panel }
}

const peldanos = () => Array.from(document.querySelectorAll(`.${CLASE.PASO}`))
const boton = (paso) => document.querySelector(selectorPaso(paso))
const li = (paso) => boton(paso).closest(`.${CLASE.PASO}`)
const motivoDe = (paso) => li(paso).querySelector(`.${CLASE.MOTIVO}`).textContent
const estadoDe = (paso) => li(paso).getAttribute(ATRIBUTO_ESTADO)

/** Con todo cargado: los cinco pasos disponibles. */
const TODO = { geometria: true, oficial: true, diagnostico: true }

// ─────────────────────────────────────────────────────────────────────────────

describe('T5 · el contrato de marcado con index.html', () => {
  it('`index.html` trae la cáscara del rail, y el `<ol>` nace VACÍO', () => {
    montarCascara()
    expect(document.querySelector(SELECTOR_RAIL)).not.toBeNull()
    const lista = document.querySelector(SELECTOR_PASOS)
    expect(lista).not.toBeNull()
    // Vacío a propósito: un `<ol>` con peldaños escritos en el HTML saldría en
    // pantalla durante el instante anterior al montaje, y con los rótulos que
    // tuviera ese fichero en vez de los que tenga el código.
    expect(lista.children).toHaveLength(0)
  })

  it('los dos selectores del contrato casan exactamente un nodo', () => {
    montarCascara()
    for (const selector of [SELECTOR_RAIL, SELECTOR_PASOS]) {
      expect(document.querySelectorAll(selector)).toHaveLength(1)
    }
  })

  it('sin el `<ol>`, cablear LANZA nombrando el selector', () => {
    montarCascara()
    document.querySelector(SELECTOR_PASOS).remove()
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() => cablearRail({ documento: document, navegacion })).toThrow(/data-rail="pasos"/)
  })

  it('sin documento o sin navegación, cablear LANZA', () => {
    montarCascara()
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() => cablearRail({ navegacion })).toThrow(TypeError)
    expect(() => cablearRail({ documento: document })).toThrow(TypeError)
    expect(() => cablearRail({ documento: document, navegacion, alNavegar: 'no' })).toThrow(TypeError)
  })
})

describe('T5 · los peldaños salen de PASOS, no de una lista escrita a mano', () => {
  it('fabrica exactamente los cinco, en el orden del rail y con sus rótulos', () => {
    cablear({ hechos: TODO })
    expect(peldanos().map((el) => el.getAttribute('data-paso'))).toEqual([...PASOS])
    for (const paso of PASOS) {
      expect(li(paso).querySelector(`.${CLASE.ROTULO}`).textContent).toBe(ROTULO_PASO[paso])
      expect(boton(paso).getAttribute(ATRIBUTO_IR_A_PASO)).toBe(paso)
      expect(boton(paso).type).toBe('button')
    }
  })

  it('el punto es decorativo y no le habla al lector de pantalla', () => {
    cablear({ hechos: TODO })
    const punto = li(PASO.ENTRADA).querySelector(`.${CLASE.PUNTO}`)
    expect(punto.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('T5 · los tres estados, y ninguno en silencio', () => {
  it('sin datos: Entrada activa y los otros cuatro apagados CON MOTIVO', () => {
    cablear() // sin ningún hecho
    expect(estadoDe(PASO.ENTRADA)).toBe(ESTADO.ACTIVO)
    for (const paso of PASOS.filter((p) => p !== PASO.ENTRADA)) {
      expect(estadoDe(paso), `«${paso}» debería estar bloqueado`).toBe(ESTADO.BLOQUEADO)
      expect(boton(paso).disabled).toBe(true)
      expect(motivoDe(paso).trim().length, `«${paso}» está apagado EN SILENCIO`).toBeGreaterThan(0)
    }
  })

  it('⭐ el motivo lo REDACTA la autoridad: este módulo no escribe ni una palabra', () => {
    cablear() // sin datos
    // Se compara contra la constante exportada por `app/navegacion.js`, no contra
    // un literal copiado aquí. Si el rail empezara a redactar sus propios textos,
    // este `it` sale rojo.
    expect(motivoDe(PASO.VALIDACION)).toBe(MOTIVO_DATO.geometria)
    expect(motivoDe(PASO.INFORME)).toBe(MOTIVO_DATO.diagnostico)
  })

  it('en la rama EDIFICIO el motivo es el de RAMA, que es otro texto', () => {
    cablear({ rama: RAMA.EDIFICIO, hechos: { [RAMA.EDIFICIO]: { geometria: true } } })
    expect(motivoDe(PASO.DIAGNOSTICO)).toBe(MOTIVO_RAMA[PASO.DIAGNOSTICO])
    expect(motivoDe(PASO.INFORME)).toBe(MOTIVO_RAMA[PASO.INFORME])
    // Y Validación SÍ está: un edificio cargado se puede mirar.
    expect(estadoDe(PASO.VALIDACION)).toBe(ESTADO.LIBRE)
    // ⭐ Y Edición TAMBIÉN, desde F12: con un edificio cargado se edita. Hasta el
    // 2026-08-06 este peldaño estaba apagado en esta rama, y con él apagado todo
    // el motor de edición de la parte activa era inalcanzable.
    expect(estadoDe(PASO.EDICION)).toBe(ESTADO.LIBRE)
    expect(motivoDe(PASO.EDICION)).toBe('')
  })

  it('un paso disponible no arrastra motivo, y su hueco está oculto', () => {
    cablear({ hechos: TODO })
    for (const paso of PASOS) {
      expect(motivoDe(paso)).toBe('')
      expect(li(paso).querySelector(`.${CLASE.MOTIVO}`).hidden).toBe(true)
    }
  })

  it('exactamente UN paso activo, y es el único con `aria-current`', () => {
    const { navegacion } = cablear({ hechos: TODO })
    const activos = () => document.querySelectorAll(`[${ATRIBUTO_ESTADO}="${ESTADO.ACTIVO}"]`)
    expect(activos()).toHaveLength(1)
    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1)

    navegacion.navegarAPaso(PASO.DIAGNOSTICO)

    expect(activos()).toHaveLength(1)
    expect(estadoDe(PASO.DIAGNOSTICO)).toBe(ESTADO.ACTIVO)
    expect(boton(PASO.DIAGNOSTICO).getAttribute('aria-current')).toBe('step')
    expect(boton(PASO.ENTRADA).hasAttribute('aria-current')).toBe(false)
  })

  it('`disabled` es lo que impide que el tabulador se pare donde no se puede ir', () => {
    cablear({ hechos: { geometria: true } })
    expect(boton(PASO.VALIDACION).disabled).toBe(false)
    expect(boton(PASO.DIAGNOSTICO).disabled).toBe(true)
    expect(boton(PASO.INFORME).disabled).toBe(true)
  })
})

describe('T5 · pulsar', () => {
  it('pulsar un paso disponible navega y repinta', () => {
    const { navegacion } = cablear({ hechos: TODO })
    boton(PASO.EDICION).click()
    expect(navegacion.get().paso).toBe(PASO.EDICION)
    expect(estadoDe(PASO.EDICION)).toBe(ESTADO.ACTIVO)
  })

  it('avisa al llamante con el paso, que es por donde entra el `invalidateSize`', () => {
    const alNavegar = vi.fn()
    cablear({ hechos: TODO, alNavegar })
    boton(PASO.VALIDACION).click()
    expect(alNavegar).toHaveBeenCalledTimes(1)
    expect(alNavegar).toHaveBeenCalledWith(PASO.VALIDACION)
  })

  it('un paso bloqueado no navega ni aunque se le despache el suceso a mano', () => {
    const { navegacion } = cablear({ hechos: { geometria: true } })
    // `.click()` sobre un `disabled` no dispara; se fuerza el suceso para probar
    // que la guarda no depende solo del atributo.
    boton(PASO.INFORME).dispatchEvent(new Event('click', { bubbles: true }))
    expect(navegacion.get().paso).toBe(PASO.ENTRADA)
  })

  it('si la navegación revienta, se cuenta por el panel y NO se propaga', () => {
    // Una excepción lanzada dentro de un oyente del DOM no sale por
    // `dispatchEvent` —ni en jsdom ni en el navegador—, así que dejarla propagar
    // sería un error silencioso para el usuario.
    montarCascara()
    const panel = doblePanel()
    const causa = new Error('boom')
    const navegacionRota = {
      get: () => ({ rama: RAMA.PARCELA, paso: PASO.ENTRADA, modo: 'NORMAL', hechos: {} }),
      subscribe: () => () => {},
      rail: () => PASOS.map((p) => ({ paso: p, rotulo: ROTULO_PASO[p], activo: p === PASO.ENTRADA, disponible: true, causa: null, motivo: null })),
      navegarAPaso: () => {
        throw causa
      },
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vivo = cablearRail({ documento: document, navegacion: navegacionRota, panel })

    expect(() => boton(PASO.VALIDACION).click()).not.toThrow()

    expect(panel.avisar).toHaveBeenCalledWith(MENSAJE_NAVEGAR_ROTO, expect.objectContaining({ causa }))
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('T5 · ⛔ los peldaños NUNCA salen del documento', () => {
  it('tras recorrer los cinco pasos y las dos ramas, son LOS MISMOS cinco nodos', () => {
    const { navegacion } = cablear({
      hechos: { [RAMA.PARCELA]: TODO, [RAMA.EDIFICIO]: { geometria: true } },
    })
    const antes = peldanos()
    expect(antes).toHaveLength(PASOS.length)

    for (const paso of PASOS) navegacion.navegarAPaso(paso)
    navegacion.cambiarRama(RAMA.EDIFICIO)
    for (const paso of PASOS) navegacion.navegarAPaso(paso)
    navegacion.cambiarRama(RAMA.PARCELA)

    const despues = peldanos()
    expect(despues).toHaveLength(PASOS.length)
    for (const [i, nodo] of antes.entries()) {
      // `toBe` sobre el NODO: un peldaño con el mismo texto lo produce también un
      // nodo NUEVO, y un nodo nuevo es exactamente lo que la regla dura prohíbe.
      expect(despues[i], `el peldaño ${i} ya no es el mismo nodo`).toBe(nodo)
      expect(nodo.isConnected).toBe(true)
    }
  })

  it('un paso bloqueado sigue CONECTADO y visible, solo que apagado', () => {
    cablear() // sin datos: cuatro bloqueados
    for (const paso of PASOS.filter((p) => p !== PASO.ENTRADA)) {
      expect(li(paso).isConnected).toBe(true)
      expect(li(paso).hidden).toBe(false)
      expect(document.querySelector(selectorPaso(paso))).not.toBeNull()
    }
  })

  it('repintar no crea ni destruye nodos', () => {
    const { rail } = cablear({ hechos: TODO })
    const antes = peldanos()
    rail.repintar()
    rail.repintar()
    expect(peldanos()).toEqual(antes)
  })
})

describe('T5 · el rail se entera de los hechos aunque no cambie el paso', () => {
  it('cargar una parcela abre pasos sin moverte de sitio (tras `repintar`)', () => {
    const { navegacion, rail } = cablear()
    expect(estadoDe(PASO.VALIDACION)).toBe(ESTADO.BLOQUEADO)

    navegacion.actualizarHechos({ geometria: true })
    rail.repintar()

    expect(estadoDe(PASO.VALIDACION)).toBe(ESTADO.LIBRE)
    expect(motivoDe(PASO.VALIDACION)).toBe('')
    // Y el usuario sigue donde estaba: abrir un paso no te empuja a él.
    expect(navegacion.get().paso).toBe(PASO.ENTRADA)
  })
})

describe('T5 · destruir', () => {
  it('vacía el `<ol>`, se da de baja y es IDEMPOTENTE', () => {
    const { rail, navegacion } = cablear({ hechos: TODO })
    expect(peldanos()).toHaveLength(PASOS.length)

    rail.destruir()
    rail.destruir()
    vivo = null

    expect(document.querySelector(SELECTOR_PASOS).children).toHaveLength(0)
    // Y no se queda escuchando: navegar después no revienta ni repinta nada.
    expect(() => navegacion.navegarAPaso(PASO.VALIDACION)).not.toThrow()
    expect(peldanos()).toHaveLength(0)
  })
})
