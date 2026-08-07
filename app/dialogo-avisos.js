// app/dialogo-avisos.js — 2026-08-07 · La lista de avisos SALE de la columna.
//
// ── QUÉ PROBLEMA CIERRA ─────────────────────────────────────────────────────
// Palabras del autor: «el panel de avisos ocupa demasiado espacio de las barras».
// Y era verdad, con las cifras del propio repositorio delante:
//
//   · el bloque cede hasta `--gml-avisos-alto-max` = **34vh** del panel — el
//     sitio más caro de la aplicación, el que comparten la tabla de vértices y
//     el pie donde vive «Generar GML»;
//   · a 1280×720 con cinco avisos **no cabía ni una tarjeta entera** y quedaban
//     394 px detrás de un scroll (medido en el rework de UI · T4);
//   · y el 95 % del tiempo gastaba ~60 px en decir «AVISOS / Sin avisos.», o sea
//     en no decir nada.
//
// Ese reparto llevaba desde F03 apuntalándose con notas en `estilos/app.css` que
// empiezan por «esta regla existe porque el pie se salía». Sacar la lista de la
// columna no es una mejora de estética: es quitar de en medio la única caja del
// panel cuyo alto lo decide el DATO y no el marcado.
//
// ── LO QUE SE CONSERVA, Y POR QUÉ IMPORTA MÁS QUE LO QUE SE QUITA ───────────
// La regla de oro 1 del proyecto es «ningún error silencioso», y un modal cerrado
// es, por definición, silencio. Se sostiene con tres cosas, ninguna opcional:
//
//   1. **Los chips no se van.** Siguen en la cabecera del panel, siempre a la
//      vista, diciendo «3 errores · 5 avisos» — y ahora son BOTONES. El marcador
//      permanente sigue siendo permanente; lo que se guarda es el detalle.
//   2. **El chip DESTELLA cuando su cuenta sube** (`app/avisos.js`). Un error
//      nuevo se nota sin abrir nada.
//   3. **Las tarjetas siguen en el DOM con el diálogo cerrado.** `#avisos` no se
//      vacía al cerrar: un `<dialog>` cerrado conserva sus hijos. Eso no es un
//      detalle de implementación, es lo que mantiene honestos a los doce guiones
//      de humo que cuentan `#avisos .gml-aviso` para medir «¿esta operación ha
//      dejado avisos?». Si al cerrar se vaciara la lista, esos guiones contarían
//      cero y **darían verde mintiendo**, que es el fallo que este proyecto lleva
//      cinco fases documentando.
//
// ── POR QUÉ EL FILTRO ABRE PUESTO Y NO EN «TODO» ────────────────────────────
// Se entra por un chip, y el chip que se pincha ES la pregunta: quien pincha el
// rojo quiere ver los errores, no scrollear entre cuarenta teselas del IGN que no
// cargaron. Pero las tres pestañas están siempre ahí y «Todo» está a un clic:
// entrar por la puerta de los avisos no puede esconder un bloqueante.
//
// ⚠️ **Al cerrar, el filtro vuelve a «Todo».** Es lo que garantiza que el estado
// EN REPOSO del `<div id="avisos">` sea la lista completa — ver el punto 3 de
// arriba. Un filtro que sobreviviera al cierre dejaría a los guiones de humo
// contando solo un nivel, otra vez en verde y otra vez mintiendo.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//   · **No se abre solo.** Decisión del autor (2026-08-07): un modal que salta
//     encima de una edición de vértices se aprende a cerrar sin leerlo. Avisa el
//     chip; entra quien quiere.
//   · **No agrupa, no cuenta y no ordena.** Todo eso es de `app/avisos.js`, que
//     no se enteró de la mudanza: sigue recibiendo un `contenedor` y pintando.

import { NIVEL } from '../viewer/_comun.js'
import { crearPanelAvisos } from './avisos.js'

// ── Textos ───────────────────────────────────────────────────────────────────

const TITULO = 'Avisos y errores'

/**
 * El apunte de debajo del título. Dice **dónde** están los avisos ahora, y es
 * deliberado: quien lleve usando la aplicación desde F03 va a buscarlos en la
 * columna. Se explica una vez, en el sitio donde han acabado.
 */
const APUNTE =
  'Todo lo que la aplicación ha tenido que decir en esta sesión. Los contadores de la cabecera ' +
  'abren esta lista.'

const BOTON_VACIAR = 'Vaciar la lista'
const BOTON_CERRAR = 'Cerrar'

/** Rótulo base de cada pestaña. La cuenta se le añade al pintar. */
const ROTULO_FILTRO = Object.freeze({
  TODO: 'Todo',
  [NIVEL.ERROR]: 'Errores',
  [NIVEL.AVISO]: 'Avisos',
})

/** Valor de `data-filtro` que significa «no filtres». No es un `NIVEL`, y por eso
 * es una cadena propia y no `null`: el atributo de un botón no puede ser `null`. */
const FILTRO_TODO = 'TODO'

// ── Clases y ganchos, contrato con `estilos/app.css` y con los guiones ───────

const CLASE = Object.freeze({
  DIALOGO: 'gml-dialogo-avisos',
  CUERPO: 'gml-dialogo-avisos-cuerpo',
  TITULO: 'gml-dialogo-avisos-titulo',
  APUNTE: 'gml-dialogo-avisos-apunte',
  FILTROS: 'gml-dialogo-avisos-filtros',
  FILTRO: 'gml-filtro-avisos',
  PIE: 'gml-dialogo-avisos-pie',
})

const ACCION = Object.freeze({ VACIAR: 'vaciar-avisos', CERRAR: 'cerrar-avisos' })

/**
 * El `id` del contenedor de la lista. **Es el mismo que tenía en `index.html`**,
 * y se conserva a propósito: `#avisos .gml-aviso` es el selector con el que
 * miden doce guiones de humo y una docena de pruebas. La lista se ha mudado de
 * sitio; su nombre, no.
 */
const ID_LISTA = 'avisos'

/** Selector de cada chip de la cabecera, por si no llegan por parámetro. */
const selectorChip = (nivel) => `.gml-chip[data-contador="${nivel}"]`

/** El mismo duck typing del resto de la casa (`app/avisos.js`, `viewer/mapa.js`). */
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
 * @typedef {Object} DialogoAvisos
 * @property {HTMLElement} nodo  El `<dialog>`.
 * @property {HTMLElement} lista  El `<div id="avisos">` de dentro, que es el
 *   `contenedor` del panel. Se expone para las pruebas y los guiones.
 * @property {import('./avisos.js').PanelAvisos} panel  El panel de dentro.
 * @property {import('../viewer/_comun.js').Avisar} avisar  Reexportado del panel
 *   — es lo que la aplicación entera inyecta como `alAvisar`, así que este
 *   objeto sirve tal cual donde antes iba el panel.
 * @property {() => void} limpiar
 * @property {() => import('./avisos.js').ResumenAvisos} resumen
 * @property {(nivel?: 'ERROR'|'AVISO'|null) => void} abrir  Enseña el diálogo
 *   con el filtro puesto en ese nivel (o sin filtro).
 * @property {() => void} cerrar  IDEMPOTENTE. Devuelve el filtro a «Todo».
 * @property {() => boolean} estaAbierto
 * @property {() => void} destruir  IDEMPOTENTE.
 */

/**
 * Fabrica el diálogo de avisos y el panel que vive dentro, y cablea los dos
 * chips de la cabecera para que lo abran.
 *
 * ```js
 * const avisos = crearDialogoAvisos({ documento: document })
 * crearVisor({ alAvisar: avisos.avisar, ... })
 * ```
 *
 * Fabrica su propio DOM, como los diálogos de F09, F10, F11, F18 y F19:
 * `index.html` solo aporta los dos chips.
 *
 * @param {object} [opciones]
 * @param {Document} [opciones.documento=document]
 * @param {HTMLElement} [opciones.chipError]  El chip de errores. Si no llega, se
 *   busca por `[data-contador="ERROR"]`, que es el contrato de `index.html`.
 * @param {HTMLElement} [opciones.chipAviso]  Ídem con `[data-contador="AVISO"]`.
 * @returns {DialogoAvisos}
 * @throws {TypeError}  Si falta el documento o cualquiera de los dos chips. Un
 *   chip que falta no es un dato raro: es la cabecera rota, y con ella el único
 *   rastro permanente de los avisos. Callarlo sería el fallo silencioso más caro
 *   que esta aplicación puede tener.
 */
export function crearDialogoAvisos({ documento = document, chipError, chipAviso } = {}) {
  const doc = documento
  if (!doc || typeof doc.createElement !== 'function') {
    throw new TypeError(
      `crearDialogoAvisos: 'documento' debe ser un Document; recibido ${typeof doc}.`,
    )
  }

  const chips = {
    [NIVEL.ERROR]: chipError ?? doc.querySelector(selectorChip(NIVEL.ERROR)),
    [NIVEL.AVISO]: chipAviso ?? doc.querySelector(selectorChip(NIVEL.AVISO)),
  }
  for (const nivel of [NIVEL.ERROR, NIVEL.AVISO]) {
    if (!esElementoDOM(chips[nivel])) {
      throw new TypeError(
        `crearDialogoAvisos: no hay chip de nivel ${nivel}. Se busca por ` +
          `'${selectorChip(nivel)}', que es contrato de index.html: si se ha renombrado o movido ` +
          `ese nodo, hay que arreglarlo allí. Sin chip no hay forma de abrir esta lista ni de ` +
          `saber que hay algo dentro.`,
      )
    }
  }

  const crear = (etiqueta, clase, texto) => {
    const el = doc.createElement(etiqueta)
    if (clase) el.className = clase
    if (texto !== undefined) el.textContent = texto
    return el
  }

  // ── El DOM ────────────────────────────────────────────────────────────────

  const dialogo = crear('dialog', CLASE.DIALOGO)
  dialogo.setAttribute('aria-modal', 'true')
  dialogo.tabIndex = -1

  const cuerpo = crear('div', CLASE.CUERPO)
  const titulo = crear('h2', CLASE.TITULO, TITULO)
  titulo.id = 'gml-dialogo-avisos-titulo'
  dialogo.setAttribute('aria-labelledby', titulo.id)
  const apunte = crear('p', CLASE.APUNTE, APUNTE)

  const filtros = crear('div', CLASE.FILTROS)
  filtros.setAttribute('role', 'group')
  filtros.setAttribute('aria-label', 'Filtrar por nivel')

  /** @type {Map<string, HTMLElement>} */
  const botonesFiltro = new Map()
  for (const clave of [FILTRO_TODO, NIVEL.ERROR, NIVEL.AVISO]) {
    const boton = crear('button', CLASE.FILTRO)
    boton.type = 'button'
    boton.dataset.filtro = clave
    // `aria-pressed` y no `role="tab"`: esto son tres botones de alternancia
    // sobre UNA lista, no tres paneles. Un `tablist` de mentira obliga al lector
    // de pantalla a anunciar paneles que no existen.
    boton.setAttribute('aria-pressed', String(clave === FILTRO_TODO))
    botonesFiltro.set(clave, boton)
    filtros.appendChild(boton)
  }

  // ⭐ El `id` y la clase son LOS DE ANTES (ver `ID_LISTA`). Este nodo es el que
  // buscan `#avisos .gml-aviso` los guiones de humo; que ahora esté dentro de un
  // `<dialog>` no les cambia nada mientras siga poblado con el diálogo cerrado.
  const lista = crear('div', 'gml-avisos')
  lista.id = ID_LISTA

  const pie = crear('div', CLASE.PIE)
  const botonVaciar = crear('button', 'gml-boton gml-boton--secundario', BOTON_VACIAR)
  botonVaciar.type = 'button'
  botonVaciar.dataset.accion = ACCION.VACIAR
  const botonCerrar = crear('button', 'gml-boton gml-boton--primario', BOTON_CERRAR)
  botonCerrar.type = 'button'
  botonCerrar.dataset.accion = ACCION.CERRAR
  pie.append(botonVaciar, botonCerrar)

  cuerpo.append(titulo, apunte, filtros, lista, pie)
  dialogo.append(cuerpo)
  doc.body.appendChild(dialogo)

  // ── El panel, que es quien pinta de verdad ────────────────────────────────

  let destruido = false
  let abierto = false
  let focoPrevio = null

  /**
   * Qué pestaña está puesta, en el vocabulario de los botones.
   *
   * ⚠️ **Es un espejo de `panel.filtroActual()`, y tiene que serlo.** No se lee
   * del panel porque `crearPanelAvisos` pinta —y por tanto llama a `alCambiar`,
   * y por tanto a `pintarFiltros`— DENTRO de su propia llamada, cuando la
   * constante `panel` de aquí abajo todavía está en su zona muerta. Leer el
   * panel desde `pintarFiltros` reventaba con un `ReferenceError` en el primer
   * pintado, antes de que la aplicación llegara a arrancar.
   *
   * Quien lo mantiene sincronizado es {@link ponerFiltro}, único sitio que toca
   * `panel.filtro`.
   */
  let clavePuesta = FILTRO_TODO

  const panel = crearPanelAvisos({
    contenedor: lista,
    chipError: chips[NIVEL.ERROR],
    chipAviso: chips[NIVEL.AVISO],
    alCambiar: (conteo) => pintarFiltros(conteo),
  })

  /**
   * Pone al día los rótulos y el estado de las tres pestañas. Las cuentas son
   * las del TOTAL, no las de lo que se ve: la pestaña «Errores» dice cuántos
   * errores hay, aunque ahora mismo esté puesta la de avisos.
   *
   * `Vaciar` se apaga con la lista vacía, con su motivo implícito a la vista (el
   * «Sin avisos.» que hay justo encima): un botón que no hace nada y no dice por
   * qué es la trampa que este proyecto persigue desde F08.
   *
   * @param {import('./avisos.js').ResumenAvisos} conteo
   */
  function pintarFiltros(conteo) {
    const cuentas = {
      [FILTRO_TODO]: conteo[NIVEL.ERROR] + conteo[NIVEL.AVISO],
      [NIVEL.ERROR]: conteo[NIVEL.ERROR],
      [NIVEL.AVISO]: conteo[NIVEL.AVISO],
    }
    for (const [clave, boton] of botonesFiltro) {
      boton.textContent = `${ROTULO_FILTRO[clave]} ${cuentas[clave]}`
      boton.setAttribute('aria-pressed', String(clave === clavePuesta))
      boton.classList.toggle('gml-filtro-avisos--puesto', clave === clavePuesta)
    }
    botonVaciar.disabled = cuentas[FILTRO_TODO] === 0
  }

  /**
   * Cambia el filtro y repinta las pestañas. El repintado llega solo por
   * `alCambiar` **si el filtro cambió de verdad**; cuando se vuelve a pinchar la
   * pestaña que ya estaba puesta, `panel.filtro` sale por su guarda de igualdad
   * sin repintar, así que aquí se pinta a mano. Sin esta línea, pinchar dos
   * veces la misma pestaña la dejaba con el rótulo desactualizado si entre
   * medias había entrado un aviso.
   *
   * @param {string} clave  Una de `FILTRO_TODO`, `NIVEL.ERROR`, `NIVEL.AVISO`.
   *   Cualquier otra cosa cae en «Todo», por lo mismo que en `app/avisos.js`:
   *   un filtro raro no puede esconderle avisos a nadie.
   */
  function ponerFiltro(clave) {
    const nivel = clave === NIVEL.ERROR || clave === NIVEL.AVISO ? clave : null
    clavePuesta = nivel ?? FILTRO_TODO
    panel.filtro(nivel)
    pintarFiltros(panel.resumen())
  }

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  function cerrarNodo() {
    if (typeof dialogo.close === 'function') {
      try {
        dialogo.close()
      } catch {
        dialogo.removeAttribute('open')
      }
    } else {
      dialogo.removeAttribute('open')
    }
  }

  /**
   * Único punto por el que sale este diálogo. IDEMPOTENTE, como los de F18 y
   * F19: el `close` que emite el navegador vuelve a entrar aquí.
   *
   * ⚠️ **Devuelve el filtro a «Todo»**, y no es cosmética: es lo que deja el
   * `<div id="avisos">` con la lista COMPLETA en reposo, que es lo que leen los
   * guiones de humo. Ver la cabecera del fichero.
   */
  function cerrar() {
    if (!abierto) return
    abierto = false
    cerrarNodo()
    ponerFiltro(FILTRO_TODO)

    const previo = focoPrevio
    focoPrevio = null
    if (previo && typeof previo.focus === 'function' && previo.isConnected) previo.focus()
  }

  /**
   * Enseña el diálogo. `nivel` decide con qué pestaña abre.
   *
   * @param {'ERROR'|'AVISO'|null} [nivel=null]
   */
  function abrir(nivel = null) {
    if (destruido) return
    // Antes de la guarda de «ya está abierto» a propósito: pinchar el otro chip
    // con el diálogo ya abierto tiene que cambiar de pestaña, no ser un no-op.
    ponerFiltro(nivel)

    if (abierto) return
    focoPrevio = doc.activeElement ?? null
    abierto = true
    if (typeof dialogo.showModal === 'function') {
      try {
        dialogo.showModal()
      } catch {
        dialogo.setAttribute('open', '')
      }
    } else {
      dialogo.setAttribute('open', '')
    }
    // El foco a la pestaña con la que se abre, no al primer nodo enfocable: así
    // el lector de pantalla anuncia «Errores 3, pulsado» —que es la respuesta a
    // lo que se acaba de pinchar— en vez de leer el título y callarse.
    const pestana = botonesFiltro.get(clavePuesta)
    if (pestana && typeof pestana.focus === 'function') pestana.focus()
  }

  // ── Oyentes ───────────────────────────────────────────────────────────────

  /** Los dos chips de la cabecera. Cada uno abre con SU nivel. */
  const alChip = (nivel) => (evento) => {
    evento.preventDefault?.()
    abrir(nivel)
  }
  const oyentesChip = new Map()
  for (const nivel of [NIVEL.ERROR, NIVEL.AVISO]) {
    const oyente = alChip(nivel)
    oyentesChip.set(nivel, oyente)
    chips[nivel].addEventListener('click', oyente)
    // El chip es un `<button>` en `index.html`, pero esto lo pueden montar
    // pruebas y guiones contra un `<span>` heredado: sin `aria-haspopup` un
    // lector de pantalla no anunciaría que abre algo.
    chips[nivel].setAttribute('aria-haspopup', 'dialog')
  }

  function alClic(evento) {
    // Clic en el velo: el `<dialog>` ocupa toda la pantalla y el contenido vive
    // en `.gml-dialogo-avisos-cuerpo`, así que un `target` que sea el propio
    // `<dialog>` es un clic FUERA de la caja. Cerrar ahí es lo que espera
    // cualquiera; y aquí no se pierde nada al cerrar, que es lo que lo hace
    // seguro (en el diálogo de pegar coordenadas no lo sería).
    if (evento.target === dialogo) {
      cerrar()
      return
    }

    const filtro = evento.target?.closest?.(`[data-filtro]`)
    if (filtro && dialogo.contains(filtro)) {
      ponerFiltro(filtro.dataset.filtro)
      return
    }

    const boton = evento.target?.closest?.('[data-accion]')
    if (!boton || !dialogo.contains(boton)) return
    if (boton.dataset.accion === ACCION.CERRAR) cerrar()
    if (boton.dataset.accion === ACCION.VACIAR) {
      panel.limpiar()
      // El foco se queda donde estaba, pero «Vaciar» acaba de apagarse: se lleva
      // a «Cerrar», que es lo único que queda por hacer aquí.
      if (typeof botonCerrar.focus === 'function') botonCerrar.focus()
    }
  }

  function alCancelar(evento) {
    evento.preventDefault?.()
    cerrar()
  }

  function alTecla(evento) {
    if (evento.key === 'Escape' && abierto) {
      evento.preventDefault?.()
      cerrar()
    }
  }

  dialogo.addEventListener('click', alClic)
  dialogo.addEventListener('cancel', alCancelar)
  dialogo.addEventListener('keydown', alTecla)

  pintarFiltros(panel.resumen())

  return {
    nodo: dialogo,
    lista,
    panel,
    avisar: panel.avisar,
    limpiar: panel.limpiar,
    resumen: panel.resumen,
    abrir,
    cerrar,
    estaAbierto: () => abierto,

    /** Cierra lo que hubiera, suelta los oyentes de los chips y se quita del DOM. */
    destruir() {
      if (destruido) return
      cerrar()
      destruido = true
      for (const [nivel, oyente] of oyentesChip) {
        chips[nivel].removeEventListener('click', oyente)
        chips[nivel].removeAttribute('aria-haspopup')
      }
      oyentesChip.clear()
      dialogo.removeEventListener('click', alClic)
      dialogo.removeEventListener('cancel', alCancelar)
      dialogo.removeEventListener('keydown', alTecla)
      panel.destruir()
      dialogo.remove()
    },
  }
}
