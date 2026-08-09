// app/pantalla.js — Rework de UI · T6. EL SEGUNDO EJE: qué se ve en cada paso.
//
// ── QUÉ HACE, EN UNA FRASE ─────────────────────────────────────────────────
// Escribe `data-paso` en la raíz de la aplicación y pone el título de la pantalla.
// Nada más. Quién decide el paso es `app/navegacion.js`; quién oculta las
// secciones que no tocan es **el CSS**, con una regla por paso.
//
// ── ⛔ POR QUÉ ESTE EJE OCULTA POR CSS Y EL DE RAMA POR `hidden` ───────────
// Ésta es LA decisión de T6 y conviene entenderla antes de tocar nada.
//
// Desde F11 hay dos ejes que pueden querer ocultar la MISMA sección:
//   · RAMA  — `app/rama.js` pone `seccion.hidden = true` en las secciones de la
//     rama que no está activa.
//   · PASO  — este módulo, para las secciones que no son de la pantalla actual.
//
// Si los dos escribieran `hidden`, serían **dos dueños de la misma propiedad** y
// ganaría el que escribiera el último: bastaría conmutar de rama estando en
// Validación para que reapareciera el bloque de Entrada, o al revés. Ese fallo no
// avisa, se ve raro y cuesta media tarde encontrarlo.
//
// La salida no es arbitrar entre los dos: es que **cada eje use un mecanismo
// distinto que termine en `display: none`**, porque entonces la composición es la
// UNIÓN — un elemento está oculto si CUALQUIERA de los dos lo dice, que es
// exactamente la semántica que se quiere, y ninguno pisa al otro. Así que:
//
//   · rama → `hidden` (lo escribe `app/rama.js`, y `.gml-app [hidden]` lo aplica);
//   · paso → `.gml-app[data-paso='X'] [data-pantalla]:not([data-pantalla~='X'])`.
//
// **Ni una línea de JavaScript oculta nada aquí.** Este módulo solo dice en qué
// paso está la aplicación; lo demás es cascada.
//
// ── ⚠️ `data-pantalla` Y NO `data-paso` EN LAS SECCIONES, Y HAY MOTIVO ────
// `app/rail.js` ya pone `data-paso` en cada `<li>` del rail. Si las secciones del
// panel llevaran ese mismo atributo, la regla de arriba —que es un descendiente
// de `.gml-app`— **ocultaría cuatro de los cinco peldaños del rail**. Se probó, y
// pasa. Los dos atributos dicen cosas distintas y por eso se llaman distinto:
// `data-paso` identifica UN paso; `data-pantalla` dice a qué pantallas pertenece
// una sección, y admite VARIAS separadas por espacios (de ahí el `~=`).
//
// ── ⛔ Y LA REGLA DE SIEMPRE: NADA SE SACA DEL DOM ─────────────────────────
// `display: none` deja el nodo CONECTADO, con su valor, sus oyentes y su sitio en
// `querySelector`. Eso es lo que hace falta: `app/cableado-*.js` resuelve 30 nodos
// como valores por defecto de parámetro —una vez, al montar— y escribir en un nodo
// desconectado **no lanza**. Ver `app/rama.js:24-40`, donde está medido.
//
// Contrapartida conocida y declarada: un control dentro de una sección oculta
// SALE del orden de tabulación (eso lo hace `display:none` solo), pero **sigue
// encontrándose con `querySelector` y sigue oyendo los sucesos GLOBALES**. El
// contrato K.1 cubre lo primero; lo segundo —`app/zona-fichero.js` engancha el
// `drop` sobre la ventana entera— sigue abierto y anotado en la revisión.

import { PASO, PASOS, RAMA } from './navegacion.js'

// ── El contrato de marcado ──────────────────────────────────────────────────

/** La raíz de la aplicación: el `<body>`, que **es** `.gml-app`. */
export const SELECTOR_APP = '[data-app="cascara"]'

/** El `<h1>` del panel, que cambia con la pantalla. */
export const SELECTOR_TITULO = '[data-titulo="pantalla"]'

/**
 * `data-paso="entrada"` en la raíz. **Es el único gancho de CSS del paso activo**,
 * molde exacto del `data-rama` de `app/rama.js`.
 */
export const ATRIBUTO_PASO = 'data-paso'

/**
 * `data-pantalla="validacion edicion"` en cada sección del panel. Lista separada
 * por espacios: una sección puede pertenecer a varias pantallas, y el selector
 * `~=` es quien lo entiende. Una sección SIN este atributo se ve SIEMPRE — es lo
 * que hace que los avisos y el pie no desaparezcan al cambiar de paso.
 */
export const ATRIBUTO_PANTALLA = 'data-pantalla'

/**
 * El título de cada pantalla. **No es `ROTULO_PASO`**: aquél es lo que se lee en
 * el rail (una palabra, porque hay 210 px) y esto es el `<h1>` del panel, que
 * puede decir una frase. Separarlos permite que el rail diga «Entrada» y la
 * pantalla diga «Empieza tu expediente», que es la respuesta directa a «no sé por
 * dónde empezar».
 *
 * @readonly
 */
export const TITULO_PANTALLA = Object.freeze({
  [PASO.ENTRADA]: 'Empieza tu expediente',
  // ⭐ 2026-08-08 · Esta pantalla se comió a «Validación del recinto», que hasta
  // hoy tenía su propio peldaño y enseñaba EXACTAMENTE la misma `<section>` con
  // el arrastre apagado. El título no se fusiona —sigue diciendo «Edición»—
  // porque lo que se hace aquí es editar; lo que se ha ganado es que además se
  // pueda generar, diagnosticar, derivar y entregar sin cambiar de pantalla.
  [PASO.EDICION]: 'Edición del recinto',
  [PASO.DIAGNOSTICO]: 'Diagnóstico de encaje',
})

/**
 * ⭐ **F14 · Los títulos que la rama EDIFICIO dice DISTINTO.**
 *
 * Es una tabla de EXCEPCIONES y no un segundo juego completo, y esa forma es
 * deliberada: lo que no está aquí cae en {@link TITULO_PANTALLA}, así que un paso
 * nuevo no puede quedarse sin título en una rama y con él en la otra. Solo se
 * escribe lo que de verdad se llama de otra manera.
 *
 * ⛔ **El defecto que esto cierra está MEDIDO** (fase 4a, 2026-08-07): con los
 * peldaños recién abiertos, `#/edificio/informe` ponía «Informe de contraste» —el
 * título de la PARCELA— sobre un informe de construcción, y `#/edificio/edicion`
 * decía «Edición del recinto» sobre trece partes. Un `<h1>` que nombra otra cosa
 * de la que hay debajo es la clase de error que nadie reporta y todo el mundo
 * nota.
 *
 * Las dos que cambian, y por qué:
 *   · **Edición** — no se edita «el recinto»: se editan las PARTES, cada una con
 *     su tabla de coordenadas y sus plantas.
 *   · **Diagnóstico** — no se encaja con el parcelario: se contrasta con la
 *     construcción que el Catastro publica, que es otra pregunta.
 *
 * `Entrada` NO cambia: «Empieza tu expediente» vale igual para las dos ramas, y
 * darle un título propio sería ruido.
 *
 * ⛔ **ERAN TRES HASTA EL 2026-08-08**: había un `[PASO.INFORME]: 'Informe de
 * construcción'` que resolvía el mismo defecto en aquel peldaño. Se va con él.
 * El nombre legal del documento —que cambia según haya habido contraste o no,
 * criterio de aceptación 4 de F14— **no se pierde**: lo escribe el propio
 * `<dialog>` del informe, que es quien sabe si hubo contraste. Aquí solo estaba
 * el `<h1>` de una pantalla que ya no existe.
 *
 * @readonly
 */
export const TITULO_EN_EDIFICIO = Object.freeze({
  [PASO.EDICION]: 'Edición de las partes',
  [PASO.DIAGNOSTICO]: 'Contraste con la construcción catastral',
})

/**
 * El título que le toca a una situación. **FUNCIÓN PURA**, y exportada para que
 * el test recorra los cinco pasos por las dos ramas sin escribir la lista.
 *
 * Devuelve `undefined` —y no una cadena inventada— cuando el paso no tiene título
 * declarado: quien la usa deja entonces el que hubiera, porque inventar uno sería
 * peor que no cambiarlo.
 *
 * @param {string} paso
 * @param {string} [rama=RAMA.PARCELA]
 * @returns {string|undefined}
 */
export function tituloDe(paso, rama = RAMA.PARCELA) {
  if (rama === RAMA.EDIFICIO && typeof TITULO_EN_EDIFICIO[paso] === 'string') {
    return TITULO_EN_EDIFICIO[paso]
  }
  return TITULO_PANTALLA[paso]
}

// ── Utilidades ──────────────────────────────────────────────────────────────

/** ¿Sirve como documento? DUCK TYPING, igual que `app/rama.js` y `app/rail.js`. */
const esDocumento = (d) =>
  !!d && typeof d === 'object' && typeof d.querySelector === 'function'

/** ¿Sirve como elemento del DOM? @param {*} el */
const esElementoDOM = (el) => !!el && typeof el === 'object' && el.nodeType === 1

/** ¿Sirve como la navegación de `app/navegacion.js`? Solo las dos capacidades
 *  que este módulo usa. @param {*} n */
const esNavegacion = (n) =>
  !!n && typeof n === 'object' && typeof n.get === 'function' && typeof n.subscribe === 'function'

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Pantalla
 * @property {() => string} get  El paso que está escrito en la raíz.
 * @property {() => void} destruir  Quita `data-paso`, repone el título que había
 *   y se da de baja. IDEMPOTENTE.
 */

/**
 * Cablea el eje PASO de la cáscara.
 *
 * @param {Object} opciones
 * @param {Document} opciones.documento
 * @param {object} opciones.navegacion  La de `app/navegacion.js`.
 * @param {Element} [opciones.app]  La raíz; se busca si no se da.
 * @param {Element|null} [opciones.titulo]  El `<h1>`; se busca si no se da. `null`
 *   explícito = esta pantalla no tiene título que escribir, y no es un error.
 * @returns {Pantalla}
 */
export function cablearPantalla({ documento, navegacion, app, titulo } = {}) {
  if (!esDocumento(documento)) {
    throw new TypeError(
      `cablearPantalla: 'documento' debe ser un Document (o un objeto con querySelector); ` +
        `recibido ${typeof documento}. No se toma el global a propósito.`,
    )
  }
  if (!esNavegacion(navegacion)) {
    throw new TypeError(
      `cablearPantalla: 'navegacion' debe ser la autoridad de app/navegacion.js (con get y ` +
        `subscribe); recibido ${typeof navegacion}.`,
    )
  }

  const raiz = app ?? documento.querySelector(SELECTOR_APP)
  if (!esElementoDOM(raiz)) {
    throw new Error(
      `cablearPantalla: no se encuentra «${SELECTOR_APP}» en el documento. Es parte del contrato ` +
        `de marcado con index.html; sin él ninguna regla de pantalla del CSS dispara y el panel ` +
        `enseñaría las cinco a la vez.`,
    )
  }

  // `undefined` = búscalo; `null` = no hay, y es una respuesta prevista.
  const nodoTitulo = titulo === undefined ? documento.querySelector(SELECTOR_TITULO) : titulo
  const tituloOriginal = esElementoDOM(nodoTitulo) ? nodoTitulo.textContent : null

  let destruido = false

  /** @param {{paso: string, rama: string}} situacion */
  function aplicar({ paso, rama }) {
    if (destruido) return
    raiz.setAttribute(ATRIBUTO_PASO, paso)
    // El título es lo ÚNICO que este módulo escribe además del atributo. Si el
    // paso no tiene título declarado se deja el que hubiera: inventar uno sería
    // peor que no cambiarlo.
    //
    // ⭐ F14 · Y depende de la RAMA, no solo del paso: ver {@link TITULO_EN_EDIFICIO},
    // donde está medido lo que pasaba sin esto («Informe de contraste» sobre un
    // informe de construcción).
    const nuevo = tituloDe(paso, rama)
    if (esElementoDOM(nodoTitulo) && typeof nuevo === 'string') nodoTitulo.textContent = nuevo
  }

  const baja = navegacion.subscribe(aplicar)
  // `subscribe` no notifica al suscribirse (contrato de `crearEstadoVista`), así
  // que la primera aplicación va a mano. Es también la que deja `data-paso`
  // escrito desde el arranque, para que el CSS no enseñe las cinco pantallas
  // durante el primer fotograma.
  aplicar(navegacion.get())

  return {
    get: () => raiz.getAttribute(ATRIBUTO_PASO),

    destruir() {
      if (destruido) return
      destruido = true
      baja()
      raiz.removeAttribute(ATRIBUTO_PASO)
      if (esElementoDOM(nodoTitulo) && tituloOriginal !== null) {
        nodoTitulo.textContent = tituloOriginal
      }
    },
  }
}

/**
 * Los pasos que este módulo sabe titular. Se exporta para que el test recorra los
 * cinco sin escribir la lista, y para que un paso nuevo sin título salga rojo en
 * vez de aparecer con el título del anterior.
 *
 * @returns {readonly string[]}
 */
export const pasosConTitulo = () => PASOS.filter((p) => typeof TITULO_PANTALLA[p] === 'string')

export default cablearPantalla
