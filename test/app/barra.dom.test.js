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
  ATRIBUTO_BARRA,
  ATRIBUTO_DISPARADOR,
  ATRIBUTO_ESTADO,
  ATRIBUTO_EXPEDIENTE_ESTADO,
  ATRIBUTO_IR_A_PASO,
  CLASE,
  ESTADO_EXPEDIENTE,
  ESTADO,
  EXPEDIENTE_SIN_NOMBRE,
  EXPEDIENTE_VACIO,
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
  expediente = null,
  suscribirExpediente = null,
} = {}) {
  montarCascara()
  const panel = doblePanel()
  const navegacion = crearNavegacion({ rama, hechos, avisar: () => {} })
  vivo = cablearBarra({
    documento: document,
    navegacion,
    panel,
    alNavegar,
    expediente,
    suscribirExpediente,
  })
  return { rail: vivo, barra: vivo, navegacion, panel }
}

const peldanos = () => Array.from(document.querySelectorAll(`.${CLASE.PASO}`))
const boton = (paso) => document.querySelector(selectorPaso(paso))
const li = (paso) => boton(paso).closest(`.${CLASE.PASO}`)
const motivoDe = (paso) => li(paso).querySelector(`.${CLASE.MOTIVO}`).textContent
const estadoDe = (paso) => li(paso).getAttribute(ATRIBUTO_ESTADO)

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

/* ══════════════════════════════════════════════════════════════════════════ *
 * Topbar · rebanada 2 · LA ZONA DE EXPEDIENTE                                 *
 *                                                                             *
 * ⭐ EL DEFECTO, MEDIDO (auditoría del 2026-08-16). `pintarExpediente()` solo   *
 * corre desde `pintar()`, y a `pintar()` solo lo disparan `navegacion.subscribe`*
 * y `repintar()` —cuyo único llamante en producción es `refrescarHechos()`,     *
 * colgado de los dos stores—. Pero **guardar, renombrar y borrar un expediente  *
 * cambian la identidad SIN tocar ningún store ni la navegación**, así que la    *
 * zona se quedaba rancia: tras archivar «X» la barra seguía diciendo «Sin       *
 * guardar / Se autoguarda; archívalo para conservarlo», y tras borrar seguía    *
 * enseñando el nombre de un expediente que ya no existe. El comentario del      *
 * módulo («se lee en CADA pintada… una foto guardada se queda rancia») era      *
 * cierto en la lectura y falso en la práctica: las pintadas no ocurrían.        *
 * ══════════════════════════════════════════════════════════════════════════ */

describe('topbar · rebanada 2 · la zona de expediente', () => {
  /**
   * Un productor de `estado()` con su canal, que es lo que publica
   * `app/cableado-expediente.js`. `ponerCallando` es el mundo de antes del canal:
   * la identidad cambia y nadie se entera.
   */
  function productor(inicial = null) {
    let foto = inicial
    const oyentes = new Set()
    return {
      estado: () => foto,
      suscribir(fn) {
        oyentes.add(fn)
        return () => oyentes.delete(fn)
      },
      cuantos: () => oyentes.size,
      ponerCallando(nueva) {
        foto = nueva
      },
      poner(nueva) {
        foto = nueva
        for (const fn of [...oyentes]) fn()
      },
    }
  }

  const zona = (cual) => document.querySelector(`[${ATRIBUTO_BARRA}="${cual}"]`).textContent.trim()
  const nombre = () => zona('expediente-nombre')
  const apunte = () => zona('expediente-apunte')

  const SIN_ARCHIVAR = { idAbierto: null, nombreAbierto: null, puedeGuardar: true }
  const ARCHIVADO = { idAbierto: 'e1', nombreAbierto: 'Linde norte', puedeGuardar: true }

  it('sin productor no revienta y dice que no hay nada, que es la verdad', () => {
    cablear({ hechos: TODO })
    expect(nombre()).toBe(EXPEDIENTE_VACIO.nombre)
    expect(apunte()).toBe(EXPEDIENTE_VACIO.apunte)
  })

  it('con trabajo sin archivar lo distingue de «no hay nada»', () => {
    const p = productor(SIN_ARCHIVAR)
    cablear({ hechos: TODO, expediente: p.estado, suscribirExpediente: p.suscribir })
    expect(nombre()).toBe(EXPEDIENTE_SIN_NOMBRE.nombre)
    expect(apunte()).toBe(EXPEDIENTE_SIN_NOMBRE.apunte)
  })

  it('⭐ ARCHIVAR se ve en la barra sin cambiar de paso ni tocar ningún store', () => {
    const p = productor(SIN_ARCHIVAR)
    cablear({ hechos: TODO, expediente: p.estado, suscribirExpediente: p.suscribir })
    expect(nombre()).toBe(EXPEDIENTE_SIN_NOMBRE.nombre)

    // Exactamente lo que hace «Guardar» del diálogo: cambia la identidad y avisa.
    p.poner(ARCHIVADO)

    expect(nombre()).toBe('Linde norte')
    expect(apunte()).toBe('Guardado en este navegador')
  })

  it('⭐ RENOMBRAR también: el nombre de la barra es el del registro, no el de antes', () => {
    const p = productor(ARCHIVADO)
    cablear({ hechos: TODO, expediente: p.estado, suscribirExpediente: p.suscribir })
    expect(nombre()).toBe('Linde norte')

    p.poner({ ...ARCHIVADO, nombreAbierto: 'Linde norte (revisado)' })

    expect(nombre()).toBe('Linde norte (revisado)')
  })

  it('⛔ BORRAR el expediente abierto no deja su nombre puesto en la barra', () => {
    // Es el caso al revés y el más caro de los dos: la barra enseñando el nombre de
    // un expediente que ya no existe le dice a quien firma que su trabajo sigue
    // archivado.
    const p = productor(ARCHIVADO)
    cablear({ hechos: TODO, expediente: p.estado, suscribirExpediente: p.suscribir })
    p.poner(SIN_ARCHIVAR)
    expect(nombre()).toBe(EXPEDIENTE_SIN_NOMBRE.nombre)
    expect(nombre()).not.toBe('Linde norte')
  })

  /* ──────────────────────────────────────────────────────────────────────── *
   * EL PUNTO DE ESTADO (2026-08-20)                                          *
   *                                                                          *
   * El rediseño de la zona le pone al nombre un punto de color delante, y el  *
   * color lo elige `[data-expediente-estado]`. El riesgo que estos tres `it`  *
   * cierran es el de siempre con dos canales para un mismo hecho: que el      *
   * atributo y las palabras se separen y el punto acabe diciendo verde sobre  *
   * un expediente sin archivar — que es la mentira cara de las dos, porque    *
   * afirma que el trabajo está guardado. Por eso cada aserción mira el        *
   * atributo Y la frase en el mismo `expect`.                                 *
   * ──────────────────────────────────────────────────────────────────────── */

  const marcaDeEstado = () =>
    document
      .querySelector(`[${ATRIBUTO_DISPARADOR}="expediente"]`)
      .getAttribute(ATRIBUTO_EXPEDIENTE_ESTADO)

  it('el punto dice VACÍO cuando la frase dice que no hay nada', () => {
    cablear({ hechos: TODO })
    expect(nombre()).toBe(EXPEDIENTE_VACIO.nombre)
    expect(marcaDeEstado()).toBe(ESTADO_EXPEDIENTE.VACIO)
  })

  it('el punto dice SIN ARCHIVAR cuando la frase dice que hay trabajo suelto', () => {
    const p = productor(SIN_ARCHIVAR)
    cablear({ hechos: TODO, expediente: p.estado, suscribirExpediente: p.suscribir })
    expect(nombre()).toBe(EXPEDIENTE_SIN_NOMBRE.nombre)
    expect(marcaDeEstado()).toBe(ESTADO_EXPEDIENTE.SIN_ARCHIVAR)
  })

  it('⭐ y el punto viaja CON el nombre: archivar lo pone verde, borrar lo devuelve', () => {
    const p = productor(SIN_ARCHIVAR)
    cablear({ hechos: TODO, expediente: p.estado, suscribirExpediente: p.suscribir })
    expect(marcaDeEstado()).toBe(ESTADO_EXPEDIENTE.SIN_ARCHIVAR)

    p.poner(ARCHIVADO)
    expect(nombre()).toBe('Linde norte')
    expect(marcaDeEstado()).toBe(ESTADO_EXPEDIENTE.ARCHIVADO)

    // ⛔ La vuelta es la mitad que importa: si el atributo se quedara en
    // «archivado» tras borrar, el punto seguiría verde junto a «Sin guardar».
    p.poner(SIN_ARCHIVAR)
    expect(nombre()).toBe(EXPEDIENTE_SIN_NOMBRE.nombre)
    expect(marcaDeEstado()).toBe(ESTADO_EXPEDIENTE.SIN_ARCHIVAR)
  })

  it('⛔ MITAD ANTI-VACUIDAD: sin el aviso del canal, la barra se queda rancia', () => {
    // Si esto pasara igual, los cuatro `it` de arriba estarían midiendo el
    // `expediente()` de cada pintada y no el canal.
    const p = productor(SIN_ARCHIVAR)
    cablear({ hechos: TODO, expediente: p.estado, suscribirExpediente: p.suscribir })
    p.ponerCallando(ARCHIVADO)
    expect(nombre()).toBe(EXPEDIENTE_SIN_NOMBRE.nombre)
    // Y en cuanto algo repinta, se pone al día: el canal es un aviso, no una
    // segunda fuente de verdad.
    vivo.repintar()
    expect(nombre()).toBe('Linde norte')
  })

  it('`destruir()` se da de baja del canal, y avisar después no repinta nada', () => {
    const p = productor(SIN_ARCHIVAR)
    const { barra } = cablear({
      hechos: TODO,
      expediente: p.estado,
      suscribirExpediente: p.suscribir,
    })
    expect(p.cuantos()).toBe(1)
    barra.destruir()
    vivo = null
    expect(p.cuantos()).toBe(0)
    expect(() => p.poner(ARCHIVADO)).not.toThrow()
    expect(nombre()).toBe(EXPEDIENTE_SIN_NOMBRE.nombre)
  })

  it('un `suscribirExpediente` que no es función es CONTRATO ROTO, y lanza', () => {
    montarCascara()
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() =>
      cablearBarra({ documento: document, navegacion, suscribirExpediente: 'no' }),
    ).toThrow(TypeError)
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
    expect(() => navegacion.navegarAPaso(PASO.EDICION)).not.toThrow()
    expect(peldanos()).toHaveLength(0)
  })
})

/* ══════════════════════════════════════════════════════════════════════════ *
 * ⛔ AQUÍ VIVÍAN LOS DIEZ TESTS DEL RENGLÓN DE MOTIVO, y se retiraron con él   *
 * el 2026-08-10 a petición del autor.                                         *
 *                                                                             *
 * Se anota en vez de borrarse porque lo que vigilaban sigue importando y ahora *
 * lo vigila otra cosa:                                                         *
 *                                                                             *
 *   · que el motivo LARGO se lea → el `title` del peldaño, que ya tiene test   *
 *     propio en «los tres estados, y ninguno en silencio».                     *
 *   · que el acuse de la entrega se vea en los tres pasos → ya no se COPIA     *
 *     arriba, se mudó el nodo: `[data-estado="generar-gml"]` cuelga del        *
 *     `<footer>` y no de `.gml-acciones[data-pantalla="edicion"]`. Quien lo    *
 *     vigila es `test/app/pantalla.dom.test.js`.                               *
 *                                                                             *
 * Lo que NO hay que reponer si alguien vuelve a intentar un renglón: era un    *
 * SEGUNDO sitio para frases que ya tenían el suyo, y con un GML descargado se  *
 * veía la misma frase dos veces en pantalla a la vez.                          *
 * ══════════════════════════════════════════════════════════════════════════ */
