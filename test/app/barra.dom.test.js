/* -------------------------------------------------------------------------- *
 * test/app/barra.dom.test.js — Rework de UI · T5 · el rail de navegación        *
 *                                                                              *
 * `app/barra.js` es un APLICADOR: se suscribe a `app/navegacion.js` y pinta. No  *
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
  MOTIVO_BREVE,
  MOTIVO_BREVE_EDIFICIO,
  MOTIVO_DATO,
  MOTIVO_DATO_EDIFICIO,
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
  SELECTOR_BARRA,
  cablearBarra,
  selectorPaso,
} from '../../app/barra.js'

const RAIZ = join(import.meta.dirname, '..', '..')

const INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body([^>]*)>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/barra.dom.test.js: no se ha encontrado el <body> de index.html. La cáscara de ' +
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

/** Monta la cáscara real y cablea la barra sobre una navegación de verdad. */
function cablear({
  hechos = {},
  rama = RAMA.PARCELA,
  alNavegar = null,
  motivoDeEntrega = null,
} = {}) {
  montarCascara()
  const panel = doblePanel()
  const navegacion = crearNavegacion({ rama, hechos, avisar: () => {} })
  vivo = cablearBarra({ documento: document, navegacion, panel, alNavegar, motivoDeEntrega })
  return { rail: vivo, barra: vivo, navegacion, panel }
}

const peldanos = () => Array.from(document.querySelectorAll(`.${CLASE.PASO}`))
const boton = (paso) => document.querySelector(selectorPaso(paso))
const li = (paso) => boton(paso).closest(`.${CLASE.PASO}`)
const motivoDe = (paso) => li(paso).querySelector(`.${CLASE.MOTIVO}`).textContent
const estadoDe = (paso) => li(paso).getAttribute(ATRIBUTO_ESTADO)
const renglon = () => document.querySelector(`.${CLASE.RENGLON}`)

/** Con todo cargado: los cinco pasos disponibles. */
const TODO = { geometria: true, oficial: true }

// ─────────────────────────────────────────────────────────────────────────────

describe('T5 · el contrato de marcado con index.html', () => {
  it('`index.html` trae la cáscara del rail, y el `<ol>` nace VACÍO', () => {
    montarCascara()
    expect(document.querySelector(SELECTOR_BARRA)).not.toBeNull()
    const lista = document.querySelector(SELECTOR_PASOS)
    expect(lista).not.toBeNull()
    // Vacío a propósito: un `<ol>` con peldaños escritos en el HTML saldría en
    // pantalla durante el instante anterior al montaje, y con los rótulos que
    // tuviera ese fichero en vez de los que tenga el código.
    expect(lista.children).toHaveLength(0)
  })

  it('los dos selectores del contrato casan exactamente un nodo', () => {
    montarCascara()
    for (const selector of [SELECTOR_BARRA, SELECTOR_PASOS]) {
      expect(document.querySelectorAll(selector)).toHaveLength(1)
    }
  })

  it('sin el `<ol>`, cablear LANZA nombrando el selector', () => {
    montarCascara()
    document.querySelector(SELECTOR_PASOS).remove()
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() => cablearBarra({ documento: document, navegacion })).toThrow(/data-rail="pasos"/)
  })

  it('sin documento o sin navegación, cablear LANZA', () => {
    montarCascara()
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() => cablearBarra({ navegacion })).toThrow(TypeError)
    expect(() => cablearBarra({ documento: document })).toThrow(TypeError)
    expect(() => cablearBarra({ documento: document, navegacion, alNavegar: 'no' })).toThrow(TypeError)
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
    // Se compara contra las constantes exportadas por `app/navegacion.js`, no
    // contra literales copiados aquí. Si la barra empezara a redactar sus propios
    // textos —o a RECORTAR los ajenos, que es la tentación desde que el hueco es
    // estrecho— este `it` sale rojo.
    //
    // ⭐ **Y desde el 2026-08-10 son DOS redacciones en DOS sitios**: en el peldaño
    // la breve (qué falta), en el `title` del mismo botón la larga (cómo se
    // consigue). Ver la escalera de tres de la cabecera de `app/barra.js`.
    expect(motivoDe(PASO.EDICION)).toBe(MOTIVO_BREVE.geometria)
    expect(boton(PASO.EDICION).getAttribute('title')).toBe(MOTIVO_DATO.geometria)
    // Diagnóstico pide DOS hechos y falta el primero: se dice el primero de la
    // lista, que es el que el usuario puede resolver antes.
    expect(motivoDe(PASO.DIAGNOSTICO)).toBe(MOTIVO_BREVE.geometria)
    expect(boton(PASO.DIAGNOSTICO).getAttribute('title')).toBe(MOTIVO_DATO.geometria)
  })

  it('⭐ F14 · en la rama EDIFICIO el rail ya no apaga NADA por rama', () => {
    // ⛔ **Hasta el 2026-08-07 este `it` esperaba los dos motivos de RAMA** en
    // Diagnóstico e Informe. F14 los retira —y con ellos la última compuerta de
    // rama viva—, así que con un edificio cargado el recorrido está entero.
    //
    // Es el tercer peldaño que esta rama recupera: Validación en F11, Edición en
    // F12, y ahora los dos últimos.
    cablear({ rama: RAMA.EDIFICIO, hechos: { [RAMA.EDIFICIO]: { geometria: true } } })
    for (const paso of PASOS) {
      expect(motivoDe(paso), `el motivo de ${paso}`).toBe('')
      if (paso !== PASO.ENTRADA) {
        expect(estadoDe(paso), `el estado de ${paso}`).toBe(ESTADO.LIBRE)
      }
    }
  })

  it('⛔ F14 · y sin edificio los cuatro se apagan por DATO, no por rama', () => {
    // El otro lado: que ya no haya compuerta de rama no significa que el recorrido
    // esté abierto de par en par. Con la rama vacía, los cuatro peldaños
    // posteriores a Entrada siguen bloqueados —por el DATO— y el motivo que se lee
    // es el de EDIFICIO («trae antes un edificio»), no el de parcela.
    cablear({ rama: RAMA.EDIFICIO, hechos: { [RAMA.EDIFICIO]: { geometria: false } } })
    for (const paso of [PASO.EDICION, PASO.DIAGNOSTICO]) {
      expect(estadoDe(paso), `el estado de ${paso}`).toBe(ESTADO.BLOQUEADO)
      expect(motivoDe(paso), `el motivo de ${paso}`).toMatch(/edificio/i)
    }
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
    expect(boton(PASO.EDICION).disabled).toBe(false)
    expect(boton(PASO.DIAGNOSTICO).disabled).toBe(true)
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
    boton(PASO.EDICION).click()
    expect(alNavegar).toHaveBeenCalledTimes(1)
    expect(alNavegar).toHaveBeenCalledWith(PASO.EDICION)
  })

  it('un paso bloqueado no navega ni aunque se le despache el suceso a mano', () => {
    const { navegacion } = cablear({ hechos: { geometria: true } })
    // `.click()` sobre un `disabled` no dispara; se fuerza el suceso para probar
    // que la guarda no depende solo del atributo.
    boton(PASO.DIAGNOSTICO).dispatchEvent(new Event('click', { bubbles: true }))
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
    vivo = cablearBarra({ documento: document, navegacion: navegacionRota, panel })

    expect(() => boton(PASO.EDICION).click()).not.toThrow()

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
    expect(estadoDe(PASO.EDICION)).toBe(ESTADO.BLOQUEADO)

    navegacion.actualizarHechos({ geometria: true })
    rail.repintar()

    expect(estadoDe(PASO.EDICION)).toBe(ESTADO.LIBRE)
    expect(motivoDe(PASO.EDICION)).toBe('')
    // Y el usuario sigue donde estaba: abrir un paso no te empuja a él.
    expect(navegacion.get().paso).toBe(PASO.ENTRADA)
  })
})

describe('T5 · destruir', () => {
  it('vacía el `<ol>`, se da de baja y es IDEMPOTENTE', () => {
    const { rail, navegacion } = cablear({ hechos: TODO })
    expect(peldanos()).toHaveLength(PASOS.length)
    expect(renglon()).not.toBeNull()

    rail.destruir()
    rail.destruir()
    vivo = null

    expect(document.querySelector(SELECTOR_PASOS).children).toHaveLength(0)
    // Y no se queda escuchando: navegar después no revienta ni repinta nada.
    expect(() => navegacion.navegarAPaso(PASO.EDICION)).not.toThrow()
    expect(peldanos()).toHaveLength(0)
    // Lo que pone, lo quita: el renglón también es suyo.
    expect(renglon()).toBeNull()
  })
})

/* ══════════════════════════════════════════════════════════════════════════ *
 * Topbar · rebanada 1 · EL RENGLÓN DE MOTIVO                                 *
 *                                                                            *
 * El giro a horizontal le quitó al motivo los tres renglones de 210 px que    *
 * tenía (40,5 px MEDIDOS el 2026-08-09 con la aplicación vacía). Lo que       *
 * queda en el peldaño es la forma breve; la larga baja aquí.                  *
 *                                                                            *
 * ⛔ Lo que se vigila con más ganas NO es que pinte: es la PRIORIDAD y el     *
 * hecho de que haya UN SOLO escritor (decisión A1). Dos módulos escribiendo   *
 * este nodo serían una carrera que gana el último, y el síntoma sería un      *
 * motivo rancio — que no lanza, no se ve en los tests y solo lo sufre quien   *
 * está delante de la pantalla.                                               *
 * ══════════════════════════════════════════════════════════════════════════ */

describe('Topbar · el renglón de motivo', () => {
  it('lo fabrica la barra, cuelga del `<nav>` y NUNCA del `<ol>`', () => {
    cablear({ hechos: TODO })
    const nodo = renglon()
    expect(nodo).not.toBeNull()
    // Dentro del `<ol>` sería un `<li>` fantasma que el lector de pantalla
    // contaría como un cuarto peldaño.
    expect(document.querySelector(SELECTOR_PASOS).contains(nodo)).toBe(false)
    expect(document.querySelector(SELECTOR_BARRA).contains(nodo)).toBe(true)
  })

  it('⛔ ocupa su sitio aunque esté vacío: `textContent` sí, `hidden` NO', () => {
    // Ocultarlo haría saltar la barra —y con ella el alto del mapa— cada vez que
    // se resuelve un motivo. Un temblor de maquetación a cambio de nada, y encima
    // uno que obligaría a llamar a `invalidateSize()` desde un sitio nuevo.
    cablear({ hechos: TODO })
    expect(renglon().textContent).toBe('')
    expect(renglon().hidden).toBe(false)
  })

  it('enseña el motivo LARGO del primer paso bloqueado, no el breve', () => {
    cablear() // sin datos: Edición y Diagnóstico bloqueados por `geometria`
    expect(renglon().textContent).toBe(MOTIVO_DATO.geometria)
    // Y el peldaño sigue diciendo la forma corta: son dos huecos, dos redacciones.
    expect(motivoDe(PASO.EDICION)).toBe(MOTIVO_BREVE.geometria)
  })

  it('⭐ el obstáculo MÁS CERCANO, que es el primero en el orden de PASOS', () => {
    // Con geometría pero sin parcelario, Edición se abre y Diagnóstico no. El
    // renglón tiene que hablar del que queda, no del que ya se resolvió.
    cablear({ hechos: { geometria: true } })
    expect(estadoDe(PASO.EDICION)).toBe(ESTADO.LIBRE)
    expect(estadoDe(PASO.DIAGNOSTICO)).toBe(ESTADO.BLOQUEADO)
    expect(renglon().textContent).toBe(MOTIVO_DATO.oficial)
  })

  it('en la rama EDIFICIO dice el motivo de EDIFICIO, no el de parcela', () => {
    cablear({ rama: RAMA.EDIFICIO, hechos: { [RAMA.EDIFICIO]: { geometria: false } } })
    expect(renglon().textContent).toBe(MOTIVO_DATO_EDIFICIO.geometria)
    expect(motivoDe(PASO.EDICION)).toBe(MOTIVO_BREVE_EDIFICIO.geometria)
  })

  it('⭐ GANA LA ENTREGA, y por eso el motivo del recorrido se calla', () => {
    // La razón, del diseño: si el usuario ve «Generar GML» y no puede pulsarlo,
    // ÉSA es la frase que necesita. Que un paso esté bloqueado se lo dice además
    // el propio peldaño apagado, con su breve y su `title`.
    cablear({ motivoDeEntrega: () => 'No se puede generar: falta el municipio.' })
    expect(renglon().textContent).toBe('No se puede generar: falta el municipio.')
    // Y el del recorrido sigue existiendo donde siempre: no se ha perdido, se ha
    // cedido el renglón.
    expect(motivoDe(PASO.EDICION)).toBe(MOTIVO_BREVE.geometria)
    expect(boton(PASO.EDICION).getAttribute('title')).toBe(MOTIVO_DATO.geometria)
  })

  it('sin motivo de entrega vuelve el del recorrido, sin repintar de más', () => {
    let entrega = 'Ahora mismo no.'
    const { barra } = cablear({ motivoDeEntrega: () => entrega })
    expect(renglon().textContent).toBe('Ahora mismo no.')
    entrega = ''
    barra.repintar()
    expect(renglon().textContent).toBe(MOTIVO_DATO.geometria)
  })

  it('⛔ el productor se lee en CADA pintada: un valor cacheado sería el motivo rancio', () => {
    const productor = vi.fn(() => '')
    const { barra } = cablear({ motivoDeEntrega: productor })
    const primeras = productor.mock.calls.length
    expect(primeras).toBeGreaterThan(0)
    barra.repintar()
    expect(productor.mock.calls.length).toBeGreaterThan(primeras)
  })

  it('un productor que devuelve basura no escribe «undefined» en la barra', () => {
    // El productor es de OTRO módulo. `undefined`, `null` y un objeto se tratan
    // como «no hay motivo de entrega», no como texto.
    for (const basura of [undefined, null, 42, {}]) {
      cablear({ hechos: TODO, motivoDeEntrega: () => basura })
      expect(renglon().textContent).toBe('')
      vivo.destruir()
      vivo = null
    }
  })

  it('`motivoDeEntrega` que no es función LANZA: es contrato de programador', () => {
    montarCascara()
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() =>
      cablearBarra({ documento: document, navegacion, motivoDeEntrega: 'un texto' }),
    ).toThrow(TypeError)
  })
})
