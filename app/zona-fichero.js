// app/zona-fichero.js — F08 · T3.2. LA PRIMERA ENTRADA POR FICHERO DE LA APP.
//
// Hasta esta tarea la aplicación no tenía NINGUNA: ni un `<input type="file">`,
// ni un `FileReader`, ni un `drop`. Los parsers de F01 (DXF/LIST/TXT) llevan
// desde la fase 1 en verde y nadie los llama porque no había por dónde meterles
// un fichero. Este módulo es ese «por dónde».
//
// ── GENÉRICO A PROPÓSITO (Decisión 2 del plan de F08) ────────────────────────
// ESTE MÓDULO NO SABE QUÉ ES UN GML. Recibe una lista de extensiones y entrega
// un `File`. No lo lee, no lo decodifica y no lo parsea: de los bytes al texto
// se encarga `gml/decodificar.js` y del texto al modelo `gml/parse.js` +
// `comprobacion/gml.js`. Ése es el punto entero de la decisión: el día que F01
// cablee DXF/LIST/TXT —`parsers/importar.js` ya espera un `string` y un
// `opts.formato`— basta con pasarle otras `extensiones` y otro `alFichero`. La
// interfaz de arrastrar-y-soltar no se rehace.
//
// ── LO QUE HAY QUE HACER BIEN AQUÍ ES LO ABURRIDO ────────────────────────────
// Ninguna de estas cuatro cosas se ve en una captura de pantalla y las cuatro
// son la diferencia entre una zona de fichero que funciona y una que parece
// rota:
//
//   1. **`preventDefault` en `dragover` Y en `drop`.** Sin el primero el
//      navegador aplica su comportamiento por defecto —abrir el fichero en la
//      pestaña— y **se pierde la aplicación entera** con todo lo que el usuario
//      llevara editado: la parcela, el historial de undo/redo, el expediente.
//      Es el fallo más caro del módulo y el que más fácil se olvida, porque en
//      desarrollo uno suelta el fichero encima y «funciona» hasta el día que
//      falla la comprobación de tipos y el `drop` no se cancela.
//   2. **Contador de `dragenter`/`dragleave`.** Los eventos de arrastre burbujean
//      y se disparan POR NODO: cruzar de un `<div>` a su hijo emite un
//      `dragenter` (nuevo destino) y un `dragleave` (destino anterior). Sin
//      contador, la superposición se apagaría y encendería en cada frontera de
//      elemento — un parpadeo epiléptico sobre un panel lleno de celdas.
//      El orden que fija el modelo de proceso del HTML es `dragenter` ANTES que
//      `dragleave`, así que el contador nunca baja a cero a mitad del cruce.
//   3. **`input.value = ''` después de CADA carga**, aceptada o rechazada. Un
//      `<input type="file">` no emite `change` si se vuelve a elegir el fichero
//      que ya tenía: el valor no ha cambiado. El recorrido real de esta app es
//      exactamente ése —abrir un GML, ver que le falta algo, corregirlo FUERA y
//      volver a abrirlo— y sin este reseteo el segundo intento no hace nada y
//      parece que la aplicación se ha colgado.
//   4. **El botón es un `<button>` de verdad** que delega en el input oculto. Un
//      `<div onclick>` no recibe foco, no responde a Enter ni a Espacio y no se
//      anuncia como botón: por eso aquí se escucha `click` y NO `mousedown`
//      —Enter y Espacio sobre un `<button>` producen un `click` sintético, no un
//      `mousedown`— y por eso el input fabricado sale del orden de tabulación
//      (`tabIndex = -1`, `aria-hidden`), para no ser un segundo parador mudo.
//
// ── REGLA DE ORO 1 (SPEC §2): elegir en silencio es un error silencioso ──────
// Soltar tres ficheros de golpe es un gesto perfectamente natural y esta zona
// solo abre uno. Coger el primero es una decisión razonable; cogerlo sin
// decirlo es mentir por omisión — el usuario se queda mirando el resultado de
// UN fichero creyendo que ha metido tres. Igual con una extensión ajena: se
// avisa nombrando las que sí se aceptan, y NO se llama a `alFichero`. Un dato
// malo del usuario nunca lanza; los `throw` de este módulo se reservan al
// contrato roto por el PROGRAMADOR (falta el botón, falta la ventana), igual
// que en `app/avisos.js` y `viewer/sincronizacion.js`.
//
// ── FRONTERA CON T3.3 (el cromo) ─────────────────────────────────────────────
// Este módulo NO escribe ni una regla CSS. Marca el estado y ya: la clase
// {@link CLASE_SUPERPOSICION} en el velo y `data-arrastrando="si"` en el
// `<body>`. Todo lo visual —color, `position: fixed`, `inset: 0`, la
// transición— es de `estilos/app.css`, que escribe T3.3 en paralelo. La única
// propiedad que sí se fija desde JS es `pointer-events: none` en el velo, y no
// es cromo: es un SUELO DE SEGURIDAD. Un velo a pantalla completa que capturase
// el ratón dejaría la aplicación entera inservible si el contador se quedara
// alto por un `dragleave` perdido, y ese fallo no tiene síntoma («no me
// responde a nada»). El plan pide `pointer-events: none` para el velo, así que
// no hay conflicto: la línea inline solo garantiza que la propiedad no puede
// faltar.

import { NIVEL, resolverAvisar } from '../viewer/_comun.js'

// ── El contrato de marcado con T3.3 y con quien cablee esto ──────────────────

/**
 * Clase del velo de arrastre. Lo pinta `estilos/app.css` (T3.3); aquí solo se
 * crea el nodo y se marca el estado en el `<body>`. Se exporta para que ni el
 * test ni el CSS tengan que copiar el literal.
 */
export const CLASE_SUPERPOSICION = 'gml-soltar-superposicion'

/** Clase del renglón de texto DENTRO del velo («Suelta aquí el fichero…»). El
 *  texto se DERIVA de `extensiones`, que es un dato que el CSS no tiene. */
export const CLASE_SUPERPOSICION_TEXTO = 'gml-soltar-superposicion-texto'

/**
 * Clase del `<input type="file">` que fabrica este módulo. **T3.3 no lo pone en
 * `index.html`**: lo crea `crearZonaFichero` y lo retira `destruir()`, para que
 * la cáscara no tenga un control huérfano el día que nadie cablee la zona.
 */
export const CLASE_INPUT = 'gml-zona-fichero-input'

/**
 * Nombre del `data-*` de estado en el `<body>` (`dataset.arrastrando`, o sea
 * `data-arrastrando` en el marcado). Se pone a {@link VALOR_ARRASTRANDO}
 * mientras hay un arrastre de ficheros vivo y se **QUITA** —no se pone a
 * `'no'`— cuando termina, para que el selector del CSS pueda ser el directo
 * `body[data-arrastrando="si"]` sin un segundo valor que mantener.
 */
export const DATO_ARRASTRANDO = 'arrastrando'

/** Único valor de {@link DATO_ARRASTRANDO}. */
export const VALOR_ARRASTRANDO = 'si'

/**
 * Tope de nombres de fichero que se enumeran en el aviso de «has soltado
 * varios». Mismo criterio que el `TOPE_TARJETAS` de `app/avisos.js`: soltar una
 * carpeta con 200 ficheros no puede producir un aviso de 200 líneas, que es un
 * aviso que nadie lee.
 */
const TOPE_NOMBRES = 5

/**
 * Lo que se le dice al usuario cuando revienta `alFichero`, o sea lo que estaba
 * PENDIENTE del fichero. Gemelo de `MENSAJE_SUSCRIPTOR_ROTO` de
 * `app/cableado-catastro.js`, y por el mismo motivo: la entrada no ha fallado
 * —el fichero llegó— y decir «no se ha podido abrir el fichero» culparía al
 * fichero de un defecto de esta casa.
 *
 * ⛔ **MEDIDO (2026-07-30, T3.2): una excepción lanzada dentro de un oyente del
 * DOM NO sale por `dispatchEvent`.** Ni en jsdom ni en el navegador: se reporta
 * como error no capturado en `window` y el llamante no se entera. Este módulo
 * empezó dejándola propagar («es un fallo del llamante, que lo vea él») y eso
 * resultó ser, medido, un error SILENCIOSO para el usuario —regla de oro 1—:
 * la aplicación se queda como estaba, sin decir nada, y el único rastro está en
 * una consola que un técnico del Catastro no abre nunca. Así que se atrapa y se
 * cuenta por los dos canales de la casa: el panel de avisos (en español) y
 * `console.error` (el detalle, para quien depura).
 *
 * Se exporta para que su test lo afirme sin copiar el literal.
 */
export const MENSAJE_ALFICHERO_ROTO =
  'El fichero ha llegado bien, pero lo que la aplicación tenía que hacer con él se ha ' +
  'interrumpido por un fallo interno; no se ha cambiado nada. El detalle técnico está en la ' +
  'consola del navegador.'

// ── Utilidades ────────────────────────────────────────────────────────────────

/**
 * ¿Sirve como elemento del DOM? DUCK TYPING deliberado, no `instanceof
 * HTMLElement` — mismo criterio (y mismo motivo) que `app/avisos.js`: un
 * elemento de otro realm (iframe) no pasa el `instanceof`, y `HTMLElement` ni
 * siquiera existe como global bajo el proyecto Vitest `node`.
 *
 * @param {*} el
 * @returns {boolean}
 */
function esElementoDOM(el) {
  return (
    !!el &&
    typeof el === 'object' &&
    typeof el.addEventListener === 'function' &&
    typeof el.removeEventListener === 'function' &&
    el.nodeType === 1
  )
}

/**
 * ¿Sirve como ventana? Se piden solo las tres capacidades que este módulo usa
 * (escuchar, dejar de escuchar y tener documento), no `instanceof Window`: así
 * un test puede inyectar un doble y así funcionaría también dentro de un
 * iframe.
 *
 * @param {*} v
 * @returns {boolean}
 */
function esVentana(v) {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof v.addEventListener === 'function' &&
    typeof v.removeEventListener === 'function' &&
    !!v.document &&
    typeof v.document.createElement === 'function'
  )
}

/**
 * Valida y normaliza la lista de extensiones aceptadas. Es un parámetro de
 * PROGRAMADOR, no un dato de usuario: una extensión mal escrita se caza aquí y
 * se nombra, en vez de convertirse en una zona que rechaza todo en silencio.
 *
 * @param {*} extensiones
 * @returns {string[]}  Las mismas, en minúsculas.
 * @throws {TypeError|RangeError}
 */
function normalizarExtensiones(extensiones) {
  if (!Array.isArray(extensiones) || extensiones.length === 0) {
    throw new TypeError(
      `crearZonaFichero: 'extensiones' debe ser un array con al menos una extensión; ` +
        `recibido ${JSON.stringify(extensiones)}.`,
    )
  }
  return extensiones.map((ext) => {
    if (typeof ext !== 'string' || ext.length < 2 || !ext.startsWith('.')) {
      throw new RangeError(
        `crearZonaFichero: extensión inválida ${JSON.stringify(ext)}. Se espera un string con ` +
          `punto inicial, p. ej. '.gml'.`,
      )
    }
    return ext.toLowerCase()
  })
}

/**
 * Extensión de un nombre de fichero, en minúsculas y CON el punto, o `''` si no
 * tiene. `plano.tar.gz` → `.gz`; `LISTADO` → `''`; `PARCELA.GML` → `.gml`.
 *
 * @param {string} nombre
 * @returns {string}
 */
function extensionDe(nombre) {
  const texto = typeof nombre === 'string' ? nombre : ''
  const punto = texto.lastIndexOf('.')
  return punto < 0 ? '' : texto.slice(punto).toLowerCase()
}

/**
 * Enumera en español: `['.gml']` → «.gml»; `['.gml','.xml']` → «.gml o .xml»;
 * `['a','b','c']` → «a, b o c». Con la conjunción como parámetro porque una
 * lista de lo que SÍ se acepta va con «o» y una de lo que NO se ha abierto va
 * con «y».
 *
 * @param {string[]} lista
 * @param {string} [conjuncion='o']
 * @returns {string}
 */
function enumerar(lista, conjuncion = 'o') {
  if (lista.length === 0) return ''
  if (lista.length === 1) return lista[0]
  return `${lista.slice(0, -1).join(', ')} ${conjuncion} ${lista[lista.length - 1]}`
}

/**
 * ¿El arrastre trae FICHEROS? Filtro imprescindible, no un adorno: este módulo
 * escucha en la VENTANA, así que sin él haría `preventDefault` sobre cualquier
 * arrastre de la página —el texto que el usuario arrastra de una celda de
 * coordenada a otra, por ejemplo— y rompería el soltar-texto de los `<input>`
 * del panel, que es comportamiento nativo del navegador.
 *
 * Se mira primero `files` y luego `types`, y hacen falta los dos: durante
 * `dragover` el navegador **oculta** `files` por seguridad y solo publica
 * `types` (que contiene `'Files'`); en `drop` es al revés y `files` ya trae los
 * ficheros de verdad. `types` puede ser un array o una `DOMStringList` según el
 * navegador, de ahí el `Array.from`.
 *
 * @param {DataTransfer|null|undefined} dt
 * @returns {boolean}
 */
function traeFicheros(dt) {
  if (!dt || typeof dt !== 'object') return false
  if (dt.files && dt.files.length > 0) return true
  const tipos = dt.types
  if (!tipos) return false
  try {
    return Array.from(tipos).includes('Files')
  } catch {
    return false
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ZonaFichero
 * @property {() => void} elegir  Abre el selector de ficheros del sistema, igual
 *   que si el usuario hubiera pulsado el botón. **Añadido en F10 · T5.1**: el
 *   diálogo «Expediente» tiene su propio «Abrir un proyecto…», y las dos vías
 *   tienen que desembocar en ESTA zona — instanciar una segunda engancharía por
 *   segunda vez el `drop` de la ventana entera y las dos se pisarían (lo dice el
 *   plan de F10 y lo razona la cabecera de `app/cableado-comprobacion.js`).
 *   Se expone el gesto en vez de dejar que el llamante haga `boton.click()` sobre
 *   el botón de otro módulo: un `click()` sintético sobre un nodo ajeno funciona
 *   hasta el día que ese otro módulo cambia de gesto o de nodo, y entonces falla
 *   sin que nada lo relacione con esta zona.
 * @property {() => void} destruir  Retira TODOS los escuchadores (incluidos los
 *   de la ventana), el `<input type="file">` fabricado, el velo si lo creó este
 *   módulo, y el `data-arrastrando` del `<body>`. IDEMPOTENTE.
 */

/**
 * Cablea la entrada por fichero de la aplicación: el botón del rótulo abre un
 * `<input type="file">` oculto, y **la ventana entera** acepta que se le suelte
 * un fichero encima. Entrega el `File` por `alFichero` y cuenta por `alAviso`
 * todo lo que decida por su cuenta (regla de oro 1).
 *
 * No sabe qué es un GML: ver la cabecera de este fichero.
 *
 * Contrato roto por el PROGRAMADOR (falta `boton`, falta `ventana`, `alFichero`
 * no es función, una extensión mal escrita) → `TypeError`/`RangeError`, igual
 * que el resto del proyecto. Un dato malo del USUARIO (tres ficheros a la vez,
 * un `.dwg`) nunca lanza: produce un aviso y el recorrido sigue.
 *
 * @param {Object} opciones
 * @param {HTMLElement} opciones.boton  El `<button>` que ya existe en
 *   `index.html` (T3.3). **El `<input type="file">` lo fabrica este módulo**, no
 *   la cáscara.
 * @param {Window} opciones.ventana  La ventana sobre la que se puede soltar. Se
 *   inyecta —en vez de tomar el `window` global— para que el test pueda medirla
 *   y para que la zona funcione dentro de un iframe.
 * @param {string[]} [opciones.extensiones=['.gml', '.xml']]  Extensiones
 *   aceptadas, con punto. Case-insensitive.
 * @param {(fichero: File) => void} opciones.alFichero  Recibe EL fichero
 *   elegido. Si lanza, se cuenta por el panel y por `console.error` (ver
 *   {@link MENSAJE_ALFICHERO_ROTO}) y el estado propio de este módulo queda
 *   limpio igualmente.
 * @param {import('../viewer/_comun.js').Avisar} [opciones.alAviso]  El canal de
 *   `app/avisos.js`. Si no se pasa, cae al `console.warn` de
 *   `viewer/_comun.js#avisoPorDefecto` — nunca al silencio.
 * @returns {ZonaFichero}
 * @throws {TypeError|RangeError}
 */
export function crearZonaFichero({
  boton,
  ventana,
  extensiones = ['.gml', '.xml'],
  alFichero,
  alAviso,
} = {}) {
  if (!esElementoDOM(boton)) {
    throw new TypeError(
      `crearZonaFichero: 'boton' debe ser un elemento del DOM (el <button> del rótulo); ` +
        `recibido ${JSON.stringify(boton)}.`,
    )
  }
  if (!esVentana(ventana)) {
    throw new TypeError(
      `crearZonaFichero: 'ventana' debe ser un Window (o un objeto con addEventListener, ` +
        `removeEventListener y document); recibido ${typeof ventana}.`,
    )
  }
  if (typeof alFichero !== 'function') {
    throw new TypeError(
      `crearZonaFichero: 'alFichero' debe ser una función (File) => void; recibido ${typeof alFichero}.`,
    )
  }

  const aceptadas = normalizarExtensiones(extensiones)
  const avisar = resolverAvisar(alAviso)

  const docVentana = ventana.document
  // El input se crea con el documento DEL BOTÓN y se inserta a su lado: si
  // alguna vez botón y ventana viviesen en documentos distintos (iframe), un
  // nodo creado por el documento equivocado no se podría insertar.
  const docBoton = boton.ownerDocument || docVentana

  // ── El <input type="file"> oculto ──────────────────────────────────────────
  const input = docBoton.createElement('input')
  input.type = 'file'
  input.className = CLASE_INPUT
  input.accept = aceptadas.join(',')
  // El selector del sistema deja elegir UNO. Que un `drop` sí pueda traer
  // varios es exactamente el motivo de que la guarda de «varios ficheros» siga
  // haciendo falta aunque aquí ponga `false`.
  input.multiple = false
  // Fuera del orden de tabulación y del árbol de accesibilidad: quien navega
  // con teclado o con lector llega al `<button>`, que es lo que se anuncia.
  input.tabIndex = -1
  input.setAttribute('aria-hidden', 'true')
  // Ocultación por ESTILO EN LÍNEA y no por la clase, a propósito: `estilos/
  // app.css` lo escribe T3.3 en paralelo y este control no puede depender de
  // que esa hoja llegue. Se usa el patrón «visually hidden» (1×1 px recortado)
  // y NO `display: none` ni el atributo `hidden`, porque hay navegadores que se
  // niegan a abrir el selector de ficheros de un input que no se renderiza.
  input.style.position = 'absolute'
  input.style.width = '1px'
  input.style.height = '1px'
  input.style.padding = '0'
  input.style.margin = '-1px'
  input.style.border = '0'
  input.style.overflow = 'hidden'
  input.style.clip = 'rect(0, 0, 0, 0)'
  input.style.whiteSpace = 'nowrap'

  if (boton.parentNode) boton.insertAdjacentElement('afterend', input)
  else if (docBoton.body) docBoton.body.appendChild(input)

  // ── El velo de arrastre ────────────────────────────────────────────────────
  // Si la cáscara ya trae uno (T3.3 podría ponerlo en `index.html`), se REUSA y
  // no se toca al destruir. Si no, se fabrica aquí y se retira al destruir. Las
  // dos formas son válidas y ninguna deja basura.
  let velo = docVentana.querySelector(`.${CLASE_SUPERPOSICION}`)
  const veloEsNuestro = velo === null
  if (veloEsNuestro) {
    velo = docVentana.createElement('div')
    velo.className = CLASE_SUPERPOSICION
    velo.setAttribute('aria-hidden', 'true')
    // Suelo de seguridad, no cromo: ver la cabecera del fichero.
    velo.style.pointerEvents = 'none'
    const texto = docVentana.createElement('p')
    texto.className = CLASE_SUPERPOSICION_TEXTO
    texto.textContent = `Suelta aquí el fichero (${enumerar(aceptadas)}).`
    velo.appendChild(texto)
    if (docVentana.body) docVentana.body.appendChild(velo)
  }

  // ── Registro de escuchadores: cero fugas por construcción ──────────────────
  // Todo escuchador se da de alta por aquí y queda anotado con su diana y su
  // IDENTIDAD de función. `destruir()` recorre la lista: es imposible añadir uno
  // y olvidarse de quitarlo, que es la fuga que no se ve —un oyente vivo en
  // `window` sobrevive al módulo y sigue haciendo `preventDefault` sobre los
  // arrastres de una pantalla que ya no existe.
  /** @type {{diana: EventTarget, tipo: string, fn: Function}[]} */
  const oyentes = []
  function escuchar(diana, tipo, fn) {
    diana.addEventListener(tipo, fn)
    oyentes.push({ diana, tipo, fn })
  }

  let destruido = false

  // ── Estado del arrastre ────────────────────────────────────────────────────
  // El contador de la nota 2 de la cabecera. Nunca baja de 0: un `dragleave`
  // suelto (los hay, cuando el puntero sale de la ventana por una esquina) no
  // puede dejarlo en negativo, porque entonces el siguiente `dragenter` no
  // volvería a encender el velo.
  let profundidad = 0

  function marcarArrastre(activo) {
    const cuerpo = docVentana.body
    if (!cuerpo) return
    if (activo) cuerpo.dataset[DATO_ARRASTRANDO] = VALOR_ARRASTRANDO
    else delete cuerpo.dataset[DATO_ARRASTRANDO]
  }

  function reiniciarArrastre() {
    profundidad = 0
    marcarArrastre(false)
  }

  // ── Entrega del fichero ────────────────────────────────────────────────────

  /**
   * Decide qué fichero entrar (o ninguno) y lo CUENTA. Punto único: lo comparten
   * el `drop` y el `change` del input, para que soltar y elegir se comporten
   * exactamente igual y no haya dos verdades sobre «varios ficheros».
   *
   * @param {File[]} ficheros
   */
  function entregar(ficheros) {
    if (ficheros.length === 0) {
      avisar('No se ha abierto nada: no ha llegado ningún fichero.', { nivel: NIVEL.AVISO })
      return
    }

    const elegido = ficheros[0]

    // Varios a la vez: se coge el primero **y se dice** (regla de oro 1). Se
    // coge el PRIMERO y no «el primero que valga»: buscar el primero aceptable
    // sería una segunda elección silenciosa encima de la primera, y el usuario
    // no tendría forma de saber cuál de los tres se ha abierto.
    if (ficheros.length > 1) {
      const otros = ficheros.slice(1).map((f) => `«${f.name}»`)
      const visibles = otros.slice(0, TOPE_NOMBRES)
      const resto = otros.length - visibles.length
      const cola = resto > 0 ? `${visibles.join(', ')} y ${resto} más` : enumerar(visibles, 'y')
      avisar(
        `Se han recibido ${ficheros.length} ficheros a la vez y esta zona solo abre uno: se ha ` +
          `cogido el primero, «${elegido.name}». No se han abierto ${cola}.`,
        { nivel: NIVEL.AVISO },
      )
    }

    const extension = extensionDe(elegido.name)
    if (!aceptadas.includes(extension)) {
      avisar(
        `No se ha abierto «${elegido.name}»: esta zona acepta ficheros ${enumerar(aceptadas)}, y ` +
          `ese ${extension === '' ? 'no tiene extensión' : `es ${extension}`}.`,
        { nivel: NIVEL.AVISO },
      )
      return
    }

    // El `try` alcanza SOLO a `alFichero`, no a los avisos de arriba: si el que
    // estuviera roto fuese el canal de avisos, taparlo aquí sería taparse el
    // único ojo que queda. Ver {@link MENSAJE_ALFICHERO_ROTO} para por qué esto
    // se atrapa en vez de dejarlo propagar.
    try {
      alFichero(elegido)
    } catch (causa) {
      avisar(MENSAJE_ALFICHERO_ROTO, { nivel: NIVEL.ERROR, causa })
      console.error('[zona-fichero] la entrega del fichero ha fallado de forma inesperada:', causa)
    }
  }

  // ── Escuchadores de arrastre, en la VENTANA ────────────────────────────────

  function alEntrar(evento) {
    if (!traeFicheros(evento.dataTransfer)) return
    // El modelo de proceso del HTML pide cancelar `dragenter` y `dragover` para
    // declararse destino de soltado válido. En la práctica basta con
    // `dragover`, pero cancelar los dos es lo que dice la especificación y no
    // cuesta nada.
    evento.preventDefault()
    profundidad += 1
    marcarArrastre(true)
  }

  function alSobrevolar(evento) {
    if (!traeFicheros(evento.dataTransfer)) return
    // ⚠️ LA LÍNEA MÁS IMPORTANTE DEL MÓDULO. Sin ella el navegador abre el
    // fichero en la pestaña y la aplicación —con la parcela y el historial
    // dentro— desaparece. Ver la nota 1 de la cabecera.
    evento.preventDefault()
    // Que el cursor diga «copiar» y no «mover»: no nos llevamos nada de donde
    // estaba el fichero. Defensivo porque `dropEffect` es de solo lectura en
    // algunos contextos y un doble de test puede no traerlo.
    try {
      evento.dataTransfer.dropEffect = 'copy'
    } catch {
      /* el cursor es cosmético; no puede tumbar el soltado */
    }
    // Red de seguridad del contador: si el puntero está sobrevolando, hay
    // arrastre vivo, aunque se hubiera perdido el `dragenter` inicial (pasa al
    // entrar en la ventana desde fuera del área del documento).
    if (profundidad === 0) {
      profundidad = 1
      marcarArrastre(true)
    }
  }

  function alSalir(evento) {
    if (!traeFicheros(evento.dataTransfer)) return
    profundidad = Math.max(0, profundidad - 1)
    if (profundidad === 0) marcarArrastre(false)
  }

  function alSoltar(evento) {
    if (!traeFicheros(evento.dataTransfer)) return
    // Segundo `preventDefault` obligatorio: cancelar el `dragover` habilita el
    // soltado, pero es ESTE el que impide que el navegador navegue al fichero.
    evento.preventDefault()
    // El velo se apaga ANTES de entregar: si `alFichero` tarda (o lanza), la
    // pantalla no se queda con el velo puesto.
    reiniciarArrastre()
    const dt = evento.dataTransfer
    entregar(dt && dt.files ? Array.from(dt.files) : [])
  }

  // ── Botón e input ──────────────────────────────────────────────────────────

  function alPulsar(evento) {
    // Un `<button>` sin `type` dentro de un `<form>` es un botón de envío. La
    // cáscara de esta app no tiene formularios, pero cancelar aquí cuesta una
    // línea y evita que meter esta zona en uno recargue la página.
    evento.preventDefault()
    // Por `elegir()` y no por `input.click()` a pelo: el botón del rótulo y el
    // «Abrir un proyecto…» del diálogo tienen que abrir EL MISMO selector, y dos
    // llamadas al mismo primitivo no pueden divergir.
    elegir()
  }

  function alCambiar() {
    const ficheros = input.files ? Array.from(input.files) : []
    try {
      entregar(ficheros)
    } finally {
      // Nota 3 de la cabecera, y va en `finally` a propósito: pase lo que pase
      // ahí dentro, el input tiene que quedar vacío o el usuario no podrá
      // reintentar con el MISMO fichero. Es el reintento más probable que hay.
      input.value = ''
    }
  }

  escuchar(ventana, 'dragenter', alEntrar)
  escuchar(ventana, 'dragover', alSobrevolar)
  escuchar(ventana, 'dragleave', alSalir)
  escuchar(ventana, 'drop', alSoltar)
  escuchar(boton, 'click', alPulsar)
  escuchar(input, 'change', alCambiar)

  /** Ver {@link ZonaFichero.destruir}. IDEMPOTENTE. */
  function destruir() {
    if (destruido) return
    destruido = true

    for (const { diana, tipo, fn } of oyentes) diana.removeEventListener(tipo, fn)
    oyentes.length = 0

    reiniciarArrastre()

    if (input.parentNode) input.parentNode.removeChild(input)
    if (veloEsNuestro && velo && velo.parentNode) velo.parentNode.removeChild(velo)
  }

  /**
   * Ver {@link ZonaFichero.elegir}. Después de `destruir()` no hace nada: el input
   * ya no está en el documento y abrir un selector cuyo `change` no escucha nadie
   * sería justo el gesto que no lleva a ninguna parte (regla de oro 1).
   */
  function elegir() {
    if (!destruido) input.click()
  }

  return { elegir, destruir }
}

export default crearZonaFichero
