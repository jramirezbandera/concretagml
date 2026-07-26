// app/avisos.js — F03 · Fase 4, Tarea 4B.3. Panel de avisos: la PRIMERA UI de la
// regla de oro 1 del proyecto («ningún error silencioso»).
//
// Hasta esta tarea, `viewer/_comun.js#avisoPorDefecto` era el SUELO MÍNIMO del
// canal `Avisar`: un `console.warn` que nadie mira. Este módulo es el TECHO — el
// `alAvisar` de verdad que `app/main.js` cablea a `crearVisor`, a `services/ign.js`
// (teselas WMTS), a `viewer/wms-catastro.js` (imagen WMS) y a
// `viewer/sincronizacion.js` (celda de coordenada ilegible).
//
// ── POR QUÉ LA AGRUPACIÓN ES OBLIGATORIA (léelo antes de tocar `avisar`) ─────
// Un `L.TileLayer` que pierde la red no emite UN `tileerror`: emite uno POR
// TESELA — decenas en un solo encuadre. Si cada llamada a `avisar` plantara una
// tarjeta, el panel se convertiría en un muro de 200 tarjetas IDÉNTICAS
// («No se ha podido cargar la tesela del IGN.» × 200) justo en el momento en que
// el usuario más necesita ver qué ha pasado. Un panel inusable cuando algo va
// mal es peor que ningún panel: por eso `avisar` AGRUPA por la clave
// `${nivel}|${mensaje}` (misma pareja nivel+texto ⇒ mismo grupo, contador `×N`)
// y aplica un TOPE DURO de {@link TOPE_TARJETAS} tarjetas DISTINTAS, con una
// línea de cierre que dice cuántos avisos más quedan fuera. Ninguna
// implementación de este módulo sin ese tope es aceptable.
//
// ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
//   · No pinta `causa` (regla 2 de la tarea): puede ser un `Event` del DOM o un
//     `Error`, y volcarlo a la UI es ruido para un usuario que no es programador.
//   · No hace eco a consola: el smoke de cierre de esta fase exige consola
//     limpia, y el sitio del aviso es este panel, no `console.warn`.
//   · No importa Leaflet ni nada `viewer/*`: es cáscara de UI pura, consume
//     únicamente el vocabulario `NIVEL` de `viewer/_comun.js` (re-exportado de
//     `validation/_comun.js`) y el typedef `Avisar` que define ese mismo módulo.

import { NIVEL } from '../viewer/_comun.js'

/**
 * Tope DURO de tarjetas DISTINTAS visibles a la vez (regla de diseño 1 de la
 * tarea). Por encima de este número, el resto se resume en una sola línea de
 * texto («…y N avisos más.») en vez de seguir apilando tarjetas.
 */
const TOPE_TARJETAS = 12

/** Etiqueta de UI por nivel (regla de diseño 5 de la tarea). Claves DERIVADAS de
 * `NIVEL`, nunca literales `'ERROR'`/`'AVISO'` sueltos. */
const ETIQUETA_NIVEL = {
  [NIVEL.ERROR]: 'Bloqueante',
  [NIVEL.AVISO]: 'Aviso',
}

/**
 * ¿Sirve como elemento del DOM? DUCK TYPING deliberado, no `instanceof
 * HTMLElement` — mismo criterio que `viewer/mapa.js#esElementoDOM` y
 * `viewer/sincronizacion.js`: un elemento de otro realm (iframe) no pasa el
 * `instanceof`, y `HTMLElement` ni siquiera existe como global bajo el proyecto
 * Vitest `node`.
 *
 * @param {*} el
 * @returns {boolean}
 */
function esElementoDOM(el) {
  return (
    !!el &&
    typeof el === 'object' &&
    typeof el.appendChild === 'function' &&
    typeof el.addEventListener === 'function' &&
    el.nodeType === 1
  )
}

/**
 * Normaliza el `mensaje` que llega por `avisar`. Un `mensaje` que no es un
 * string no es motivo para tumbar la app (este módulo ES el canal de avisos:
 * no puede ser él quien lance) — se sustituye por un texto de relleno visible,
 * o se intenta `String(...)` para no perder del todo un dato raro pero con
 * forma (un número, por ejemplo).
 *
 * @param {*} mensaje
 * @returns {string}
 */
function normalizarMensaje(mensaje) {
  if (typeof mensaje === 'string' && mensaje.length > 0) return mensaje
  if (mensaje === null || mensaje === undefined) return 'Aviso sin mensaje.'
  try {
    const texto = String(mensaje)
    return texto.length > 0 ? texto : 'Aviso sin mensaje.'
  } catch {
    return 'Aviso sin mensaje.'
  }
}

/** Conjunto de valores válidos de {@link NIVEL}, para detectar un nivel
 * desconocido sin tener que enumerar `'ERROR'`/`'AVISO'` a mano. */
const NIVELES_VALIDOS = new Set(Object.values(NIVEL))

/**
 * Normaliza el `nivel` que llega por `detalle.nivel`. `detalle` puede faltar,
 * ser `null` o traer un nivel que no está en {@link NIVEL} (typo del llamante,
 * literal suelto colado por error): en los tres casos cae a `NIVEL.AVISO`, el
 * mismo suelo que ya usa `viewer/_comun.js#avisoPorDefecto` para "sin nivel
 * declarado". Nunca lanza: un dato raro de ENTRADA no es un contrato roto por
 * el programador, es exactamente lo que este canal existe para absorber.
 *
 * @param {*} detalle
 * @returns {'ERROR'|'AVISO'}
 */
function normalizarNivel(detalle) {
  const nivel = detalle && typeof detalle === 'object' ? detalle.nivel : undefined
  return NIVELES_VALIDOS.has(nivel) ? nivel : NIVEL.AVISO
}

/**
 * @typedef {Object} ResumenAvisos
 * @property {number} ERROR  Nº de mensajes DISTINTOS de nivel `NIVEL.ERROR`
 *   agrupados (no la suma de sus repeticiones).
 * @property {number} AVISO  Nº de mensajes DISTINTOS de nivel `NIVEL.AVISO`
 *   agrupados (no la suma de sus repeticiones).
 */

/**
 * @typedef {Object} PanelAvisos
 * @property {import('../viewer/_comun.js').Avisar} avisar  El canal que se
 *   pasa tal cual como `alAvisar` a `crearVisor` y al resto de módulos del
 *   visor que puedan fallar por red o por entrada del usuario.
 * @property {() => void} limpiar  Vacía todos los avisos acumulados y vuelve
 *   al estado vacío («Sin avisos.»).
 * @property {() => ResumenAvisos} resumen  Recuento de mensajes DISTINTOS por
 *   nivel, el mismo dato que pintan los chips.
 * @property {() => void} destruir  Desmonta el panel. IDEMPOTENTE.
 */

/**
 * Crea el panel de avisos del visor: la lista agrupada de tarjetas dentro de
 * `contenedor` y los dos chips-resumen (`chipError`, `chipAviso`). Devuelve el
 * canal `avisar` que el resto de la app inyecta como `alAvisar`.
 *
 * Contrato roto por el PROGRAMADOR (falta `contenedor`, o cualquiera de los
 * tres elementos no es un nodo del DOM) → `TypeError`, igual que el resto del
 * proyecto (`viewer/mapa.js`, `viewer/sincronizacion.js`). Un dato raro que
 * llegue DESPUÉS por `avisar` (mensaje no string, `detalle` nulo, nivel
 * desconocido) nunca lanza: ver {@link normalizarMensaje} y
 * {@link normalizarNivel}.
 *
 * @param {Object} opciones
 * @param {HTMLElement} opciones.contenedor  Elemento donde se monta la lista
 *   de tarjetas (`.gml-avisos` en `estilos/app.css`; su scroll y su tope de
 *   `34vh` son cosa del CSS, independientes del tope de 12 tarjetas de aquí).
 * @param {HTMLElement} opciones.chipError  Chip-resumen de nivel `NIVEL.ERROR`.
 * @param {HTMLElement} opciones.chipAviso  Chip-resumen de nivel `NIVEL.AVISO`.
 * @returns {PanelAvisos}
 * @throws {TypeError}  Si `contenedor`, `chipError` o `chipAviso` no son
 *   elementos del DOM.
 */
export function crearPanelAvisos({ contenedor, chipError, chipAviso } = {}) {
  if (!esElementoDOM(contenedor)) {
    throw new TypeError(
      `crearPanelAvisos: 'contenedor' debe ser un elemento del DOM; recibido ${JSON.stringify(contenedor)}.`,
    )
  }
  if (!esElementoDOM(chipError)) {
    throw new TypeError(
      `crearPanelAvisos: 'chipError' debe ser un elemento del DOM; recibido ${JSON.stringify(chipError)}.`,
    )
  }
  if (!esElementoDOM(chipAviso)) {
    throw new TypeError(
      `crearPanelAvisos: 'chipAviso' debe ser un elemento del DOM; recibido ${JSON.stringify(chipAviso)}.`,
    )
  }

  const doc = contenedor.ownerDocument

  /** Grupos vivos, indexados por `${nivel}|${mensaje}`.
   * @type {Map<string, {nivel:'ERROR'|'AVISO', mensaje:string, veces:number, orden:number}>} */
  let grupos = new Map()

  // Contador de "recencia": cada llamada a `avisar` (nueva o repetida) lo
  // incrementa y lo guarda en su grupo, para poder ordenar "los más recientes
  // arriba" (regla de diseño 6) incluyendo el caso de un mensaje YA VISTO que
  // vuelve a ocurrir — sigue siendo la actividad más reciente del panel.
  let secuencia = 0

  let destruido = false

  /** @returns {ResumenAvisos} */
  function resumen() {
    let cuentaError = 0
    let cuentaAviso = 0
    for (const grupo of grupos.values()) {
      if (grupo.nivel === NIVEL.ERROR) cuentaError += 1
      else cuentaAviso += 1
    }
    return { [NIVEL.ERROR]: cuentaError, [NIVEL.AVISO]: cuentaAviso }
  }

  /**
   * Pone el texto y el color de un chip. El estado BASE del chip (`.gml-chip`
   * a secas) es el NEUTRO de la maqueta — así se ve un «0 errores» sin mentir
   * en rojo (avisos del CSS de esta tarea). Por eso el modificador de color
   * (`.gml-chip--error` / `.gml-chip--aviso`) se AÑADE solo cuando la cuenta es
   * > 0 y se QUITA a cero, en vez de ocultar el chip con `hidden`: así la fila
   * de chips no "salta" de tamaño según el estado del expediente, y el usuario
   * ve confirmación explícita de "cero errores" en vez de la ausencia del chip.
   * El punto de color lo sigue pintando el `::before` del CSS: aquí solo se
   * toca `textContent` (que reemplaza los HIJOS, no el `::before`) y la clase.
   *
   * @param {HTMLElement} chip
   * @param {'ERROR'|'AVISO'} nivel
   * @param {number} cuenta
   * @param {string} claseModificador
   */
  function pintarChip(chip, nivel, cuenta, claseModificador) {
    chip.classList.toggle(claseModificador, cuenta > 0)
    chip.hidden = false
    chip.textContent =
      nivel === NIVEL.ERROR
        ? `${cuenta} ${cuenta === 1 ? 'error' : 'errores'}`
        : `${cuenta} ${cuenta === 1 ? 'aviso' : 'avisos'}`
  }

  /** Construye una tarjeta `.gml-aviso` (contrato de DOM de la tarea). */
  function construirTarjeta(grupo) {
    const articulo = doc.createElement('article')
    articulo.className = 'gml-aviso'
    articulo.dataset.nivel = grupo.nivel

    const cabecera = doc.createElement('div')
    cabecera.className = 'gml-aviso-cabecera'

    const etiqueta = doc.createElement('span')
    etiqueta.className = 'gml-aviso-etiqueta'
    etiqueta.textContent = ETIQUETA_NIVEL[grupo.nivel]
    cabecera.appendChild(etiqueta)

    // `.gml-aviso-veces` AUSENTE cuando `veces === 1` (contrato de DOM de la
    // tarea): no es `hidden`, es no crear el nodo.
    if (grupo.veces > 1) {
      const veces = doc.createElement('span')
      veces.className = 'gml-aviso-veces'
      veces.textContent = `×${grupo.veces}`
      cabecera.appendChild(veces)
    }
    articulo.appendChild(cabecera)

    const texto = doc.createElement('p')
    texto.className = 'gml-aviso-texto'
    texto.textContent = grupo.mensaje
    articulo.appendChild(texto)

    return articulo
  }

  /** Repinta la lista completa y los dos chips a partir de `grupos`. */
  function render() {
    contenedor.replaceChildren()

    if (grupos.size === 0) {
      const vacio = doc.createElement('p')
      vacio.className = 'gml-avisos-vacio'
      vacio.textContent = 'Sin avisos.'
      contenedor.appendChild(vacio)
    } else {
      // Más recientes arriba (regla de diseño 6): orden descendente por la
      // última vez que CADA grupo tuvo actividad (alta o repetición).
      const ordenados = Array.from(grupos.values()).sort((a, b) => b.orden - a.orden)
      const visibles = ordenados.slice(0, TOPE_TARJETAS)
      const resto = ordenados.length - visibles.length

      for (const grupo of visibles) contenedor.appendChild(construirTarjeta(grupo))

      // Tope duro (regla de diseño 1): el resto se resume en una línea, nunca
      // en más tarjetas.
      if (resto > 0) {
        const linea = doc.createElement('p')
        linea.className = 'gml-avisos-resto'
        linea.textContent = `…y ${resto} aviso${resto === 1 ? '' : 's'} más.`
        contenedor.appendChild(linea)
      }
    }

    const { [NIVEL.ERROR]: cuentaError, [NIVEL.AVISO]: cuentaAviso } = resumen()
    pintarChip(chipError, NIVEL.ERROR, cuentaError, 'gml-chip--error')
    pintarChip(chipAviso, NIVEL.AVISO, cuentaAviso, 'gml-chip--aviso')
  }

  /**
   * El canal `Avisar` (ver `viewer/_comun.js`). AGRUPA por `${nivel}|${mensaje}`
   * (regla de diseño 1): una llamada nueva crea el grupo con `veces:1`; una
   * llamada con el MISMO nivel y el MISMO texto incrementa `veces` en el grupo
   * existente en vez de crear una tarjeta más. `detalle.causa`, si llega, se
   * ignora a propósito (regla de diseño 2: no se pinta).
   *
   * @type {import('../viewer/_comun.js').Avisar}
   */
  function avisar(mensaje, detalle) {
    if (destruido) return

    const texto = normalizarMensaje(mensaje)
    const nivel = normalizarNivel(detalle)
    const clave = `${nivel}|${texto}`

    secuencia += 1
    const existente = grupos.get(clave)
    if (existente) {
      existente.veces += 1
      existente.orden = secuencia
    } else {
      grupos.set(clave, { nivel, mensaje: texto, veces: 1, orden: secuencia })
    }

    render()
  }

  /** Vacía todos los avisos acumulados y vuelve al estado vacío. */
  function limpiar() {
    if (destruido) return
    grupos = new Map()
    secuencia = 0
    render()
  }

  /** Desmonta el panel. IDEMPOTENTE: la segunda llamada no hace nada. */
  function destruir() {
    if (destruido) return
    destruido = true
    grupos = new Map()
    contenedor.replaceChildren()
  }

  render() // Estado inicial: «Sin avisos.» y los dos chips a cero.

  return { avisar, limpiar, resumen, destruir }
}
