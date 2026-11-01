// app/conjunto.js — F25 · tarea 1.4 · LAS PARCELAS DEL EXPEDIENTE.
//
// El registro de las parcelas que tiene abiertas el expediente y de cuál está en
// edición. Es la pieza que hace posible la decisión D0 de F25: **el store sigue
// llevando UNA parcela** —sus 18 suscriptores no se enteran de que hay más— y las
// demás viven aquí. Cambiar de parcela es apartar la que sale, sacar de aquí la que
// entra y meterla en el store.
//
// ── QUÉ GUARDA ──────────────────────────────────────────────────────────────
//   · Las parcelas, EN ORDEN. La primera es la principal (`model/parcela.js#
//     parcelaPrincipal`): la que entró al abrir el expediente. Las demás se añaden
//     detrás.
//   · Cuál está en edición, por su `idLocal`.
//   · La historia de deshacer de cada una de las que NO están en edición, tal como
//     la devolvió `edit/historial.js#apartar`. Es opaca para este módulo: la guarda y
//     la devuelve, no la lee.
//   · La IDENTIDAD DEL EXPEDIENTE, un número que solo cambia al abrir otro. Es la
//     mitad de H1 de la ficha de F25: «¿ha entrado otra parcela?» se parte en dos
//     preguntas, y la que gobierna el contexto —las vecinas, el registro guardado,
//     el autoguardado— es «¿es otro expediente?». Cambiar de parcela NO la mueve.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
// **No toca el store ni el historial.** Ni importa `edit/` ni conoce `crearEstadoVista`:
// quien cambia de parcela (el cableado de la fase 2) aparta el historial, llama a
// {@link activar} y hace el `set`. Así este módulo se prueba en Node sin un visor
// detrás, como `app/colindantes.js`, que es su molde.
//
// **Tampoco se suscribe al store.** La copia de la parcela en edición la pone al día
// quien lo haga, con {@link actualizarActiva}. Suscribirse aquí ataría el orden de los
// suscriptores del store a este módulo, y ese orden ya decide cosas (ver
// `viewer/index.js`, el reencuadre).
//
// Módulo sin DOM, sin Leaflet, sin red y sin reloj.

import { crearExpediente, crearParcela } from '../model/parcela.js'

/**
 * Qué ha cambiado, para quien escuche. Un oyente que solo dibuja las OTRAS parcelas no
 * tiene nada que hacer con `EDITADA`, que llega con cada vértice arrastrado.
 *
 * @readonly
 */
export const MOTIVO_CAMBIO = Object.freeze({
  /** Ha entrado otro expediente entero. La identidad ha cambiado. */
  ABIERTO: 'ABIERTO',
  /** Se ha añadido una parcela al final. */
  AÑADIDA: 'AÑADIDA',
  /** Se ha quitado una parcela que no estaba en edición. */
  QUITADA: 'QUITADA',
  /** Otra parcela pasa a estar en edición. La identidad NO cambia. */
  ACTIVADA: 'ACTIVADA',
  /** La parcela en edición ha cambiado de forma (una edición, un deshacer). */
  EDITADA: 'EDITADA',
})

/**
 * @typedef {Object} Cambio
 * @property {string} motivo  Uno de {@link MOTIVO_CAMBIO}.
 * @property {number} identidad  La del expediente, después del cambio.
 * @property {string|null} activa  El `idLocal` en edición, después del cambio.
 */

/**
 * El registro de las parcelas del expediente.
 *
 * ```js
 * const conjunto = crearConjunto()
 * conjunto.abrir({ parcelas: [p] })            // otro expediente: identidad nueva
 * conjunto.añadir(vecina)                      // al final, sin activarla
 * const { parcela, apartado } = conjunto.activar(vecina.idLocal, apartar(historial))
 * apartado === null ? reiniciar(historial, parcela) : restaurar(historial, apartado)
 * estado.set(parcela)
 * ```
 *
 * @returns {object}
 */
export function crearConjunto() {
  let vivo = true
  /** @type {object[]} */
  let parcelas = []
  /** @type {string|null} */
  let activa = null
  /** @type {Map<string, object>} `idLocal` → la historia apartada de esa parcela. */
  const apartados = new Map()
  let identidad = 0
  /** @type {Set<(cambio: Cambio) => void>} */
  const oyentes = new Set()

  /** Avisa a los oyentes. Uno roto no puede tumbar a los demás (molde de colindantes). */
  function emitir(motivo) {
    const cambio = { motivo, identidad, activa }
    for (const fn of oyentes) {
      try {
        fn(cambio)
      } catch (causa) {
        console.error('app/conjunto.js: un oyente del conjunto ha fallado', causa)
      }
    }
  }

  const indiceDe = (idLocal) => parcelas.findIndex((p) => p.idLocal === idLocal)

  function exigirVivo(fn) {
    if (!vivo) throw new Error(`conjunto.${fn}: el conjunto está destruido.`)
  }

  return {
    /**
     * Abre OTRO expediente: sustituye las parcelas, olvida todas las historias
     * apartadas y estrena identidad. Valida con `crearExpediente`, así que lanza
     * exactamente con lo mismo que el modelo: `idLocal` repetido, o `activa` que no es
     * de ninguna con dos o más. Las parcelas se guardan como las deja el modelo
     * (copias).
     *
     * @param {{parcelas?: object[], activa?: string|null}} [contenido]  Sin nada,
     *   un expediente vacío.
     * @returns {void}
     */
    abrir({ parcelas: nuevas = [], activa: nuevaActiva } = {}) {
      exigirVivo('abrir')
      const expediente = crearExpediente({ parcelas: nuevas, activa: nuevaActiva })
      parcelas = expediente.parcelas
      activa = expediente.activa
      apartados.clear()
      identidad += 1
      emitir(MOTIVO_CAMBIO.ABIERTO)
    },

    /** Las parcelas en orden. Lista nueva; los objetos son los del registro. */
    parcelas: () => parcelas.slice(),

    /** El `idLocal` de la parcela en edición, o `null` si no hay ninguna. */
    activa: () => activa,

    /** La parcela en edición, o `null`. */
    parcelaActiva: () => (activa === null ? null : parcelas[indiceDe(activa)]),

    /** La identidad del EXPEDIENTE. Solo cambia con {@link abrir}. */
    identidad: () => identidad,

    /**
     * Pone al día la copia de la parcela en edición con lo que hay en el store.
     *
     * Devuelve `false` —y no toca nada— si lo que llega **no es la parcela en
     * edición**. No lanza, a propósito: se llamará desde un suscriptor del store, y
     * `crearEstadoVista` no aísla a sus suscriptores, así que un `throw` aquí dejaría
     * sin notificar a los que vienen detrás. Un `false` significa que alguien ha
     * metido en el store otro documento sin pasar por {@link abrir} ni por
     * {@link activar}, y quien llama tiene que decirlo.
     *
     * @param {object|null} parcela
     * @returns {boolean}  `true` si se ha aplicado.
     */
    actualizarActiva(parcela) {
      if (!vivo || activa === null || parcela?.idLocal !== activa) return false
      const i = indiceDe(activa)
      if (parcelas[i] === parcela) return true
      parcelas = parcelas.slice()
      parcelas[i] = parcela
      emitir(MOTIVO_CAMBIO.EDITADA)
      return true
    },

    /**
     * Añade una parcela AL FINAL, sin activarla. Se valida y se copia con
     * `crearParcela`. Si el expediente estaba vacío, pasa a ser la principal y la que
     * está en edición, porque no hay otra.
     *
     * @param {object} parcela
     * @returns {object}  La copia que ha quedado en el registro.
     * @throws {Error}  Si su `idLocal` ya está en el expediente.
     */
    añadir(parcela) {
      exigirVivo('añadir')
      const copia = crearParcela(parcela)
      if (indiceDe(copia.idLocal) !== -1) {
        throw new Error(
          `conjunto.añadir: el expediente ya tiene una parcela con idLocal ` +
            `${JSON.stringify(copia.idLocal)}. Cada parcela necesita el suyo.`,
        )
      }
      parcelas = [...parcelas, copia]
      if (activa === null) activa = copia.idLocal
      emitir(MOTIVO_CAMBIO.AÑADIDA)
      return copia
    },

    /**
     * Quita una parcela que NO está en edición, con su historia apartada.
     *
     * ⛔ La que está en edición no se quita: hay que activar otra antes. Quitarla
     * dejaría el store con una parcela que ya no es del expediente, y el siguiente
     * «Guardar» la perdería o la duplicaría según quién llegara antes.
     *
     * @param {string} idLocal
     * @returns {void}
     * @throws {Error}  Si no existe o está en edición.
     */
    quitar(idLocal) {
      exigirVivo('quitar')
      const i = indiceDe(idLocal)
      if (i === -1) {
        throw new Error(`conjunto.quitar: no hay ninguna parcela con idLocal ${JSON.stringify(idLocal)}.`)
      }
      if (idLocal === activa) {
        throw new Error(
          `conjunto.quitar: ${JSON.stringify(idLocal)} es la parcela en edición. Activa otra antes ` +
            `de quitarla.`,
        )
      }
      parcelas = parcelas.filter((_, j) => j !== i)
      apartados.delete(idLocal)
      emitir(MOTIVO_CAMBIO.QUITADA)
    },

    /**
     * Pone otra parcela en edición. Guarda la historia de la que sale y devuelve la de
     * la que entra.
     *
     * @param {string} idLocal  La que entra.
     * @param {object|null} apartadoSaliente  La historia de la que sale, de
     *   `edit/historial.js#apartar`. Con `null` no se guarda nada y, al volver a ella,
     *   empezará sin deshacer.
     * @returns {{parcela: object, apartado: object|null, cambiado: boolean}}
     *   `apartado` es la historia de la que entra, o `null` si nunca se apartó (es la
     *   primera vez que se edita): quien llama siembra entonces con `reiniciar`.
     *   `cambiado` es `false` si ya era ésa, y entonces no se ha tocado nada.
     * @throws {Error}  Si no hay ninguna con ese `idLocal`.
     */
    activar(idLocal, apartadoSaliente = null) {
      exigirVivo('activar')
      const i = indiceDe(idLocal)
      if (i === -1) {
        throw new Error(`conjunto.activar: no hay ninguna parcela con idLocal ${JSON.stringify(idLocal)}.`)
      }
      if (idLocal === activa) return { parcela: parcelas[i], apartado: null, cambiado: false }
      if (activa !== null && apartadoSaliente !== null) apartados.set(activa, apartadoSaliente)
      const apartado = apartados.get(idLocal) ?? null
      apartados.delete(idLocal)
      activa = idLocal
      emitir(MOTIVO_CAMBIO.ACTIVADA)
      return { parcela: parcelas[i], apartado, cambiado: true }
    },

    /**
     * @param {(cambio: Cambio) => void} fn
     * @returns {() => void}  La baja.
     */
    subscribe(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`conjunto.subscribe: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      oyentes.add(fn)
      return () => oyentes.delete(fn)
    },

    /** Deja el registro inerte y suelta a los oyentes. IDEMPOTENTE. */
    destruir() {
      vivo = false
      oyentes.clear()
      apartados.clear()
    },
  }
}

export default crearConjunto
