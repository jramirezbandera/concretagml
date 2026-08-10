// app/dialogo-expediente.js — F10 · T4.1. El DIÁLOGO «Expediente».
//
// Un solo sitio para todo lo que ENTRA y SALE del expediente: guardarlo en este
// navegador, recuperar uno guardado, duplicarlo, borrarlo, llevárselo a un fichero
// (DXF, listado de coordenadas o proyecto) y volver a abrir un proyecto. «Generar
// GML» **no está aquí** y se queda en el pie del panel: es la salida principal y el
// final del camino, no una salida lateral.
//
// ── POR QUÉ UN BOTÓN MENUDO Y UN `<dialog>`, Y NO UN BLOQUE EN EL PANEL ─────
// Es la quinta fase seguida que no puede permitirse un bloque fijo nuevo. El panel
// reparte una altura FIJA entre bloques fijos, así que cada fila a lo ancho cuesta
// ~36 px medidos y esos 36 px se los quita la CAJA DE VÉRTICES — que costó recuperar
// hasta 303 px sacando «Edición» al mapa en F06 y que F07 dejó en 267, con suelo
// declarado en 220. Un bloque «Expediente» con lista, campo de nombre y cuatro
// botones se comería el presupuesto entero. **Eso sigue siendo verdad dentro de
// cualquier pantalla**, así que el `<dialog>` se queda.
//
// ⚠️ **DÓNDE ESTÁ EL BOTÓN: YA NO EN LA FILA DEL RÓTULO (rework de UI · T6,
// 2026-08-04).** Aquí ponía que vivía a la derecha del `<h2>` de «Origen de la
// parcela», emparejado con «Abrir un GML…» dentro de un `.gml-rotulo-acciones`, y que
// la holgura de esa fila eran 12 px. **Esa fila ya no existe**: T6 reestructuró
// Entrada en tres vías y el botón se fue al PIE de esa pantalla, con el rótulo
// «Abrirlo» y la pregunta «¿Ya tenías un expediente?» delante. Va abajo a propósito
// —recuperar trabajo no es empezar—, y el selector de contrato
// (`SELECTOR_BOTON_EXPEDIENTE` en `app/cableado-expediente.js`) **no cambió**: es
// `[data-accion="abrir-expediente"]` y sigue casando un solo nodo.
//
// Lo que de aquel razonamiento sobrevive intacto: `.gml-boton--menudo` sigue
// dimensionado para caber DENTRO del alto de línea de un `<h2>` (15,2 px de botón
// contra 15,95 px de renglón), que es lo que hace que el pie de Entrada no crezca. La
// medida de los 267 px, en cambio, **caducó**: desde T6 la caja de vértices mide
// 385,67 px a 1440×900. El registro completo está en `index.html`, donde estaba el
// botón, y en la nota de `estilos/app.css`.
//
// ── POR QUÉ ES UN MODAL, Y NO UN CAJÓN SOBRE EL MAPA ───────────────────────
// Mismo reparto que F09, y por el mismo motivo: **el mapa no aporta nada mientras se
// elige un fichero o se teclea el nombre de un expediente**. Los cajones de F07 y F08
// viven sobre la cartografía porque ANOTAN el mapa; esto administra ficheros. Y las
// cuatro esquinas de Leaflet están ocupadas desde F08.
//
// El modal se paga con lo que cuesta un modal —foco al abrir, `Escape` que cierra,
// foco devuelto al cerrar—, y la vía de respaldo para jsdom está medida y razonada en
// `app/dialogo-informe.js`: `HTMLDialogElement` en jsdom tiene EXACTAMENTE una cosa,
// la propiedad `open`. Ni `showModal()`, ni `close()`, ni `cancel`, ni `::backdrop`.
// Aquí se repite la misma detección de capacidad y el mismo `Escape` propio, y no se
// factoriza a un módulo común a propósito: serían dos diálogos atados por una
// abstracción de cuarenta líneas cuando lo que comparten son seis.
//
// ── CUARTA APARICIÓN DE LA FAMILIA DE DEFECTOS DE COSTURA — Y CUESTA CERO ──
// Los clics dentro de un `<dialog>` burbujean hasta el `document` y llegan al
// guardián de clic-fuera que cierra los cajones del mapa. F09 lo arregló preguntando
// por el ELEMENTO `dialog` y no por su atributo `open`
// (`viewer/cajon-diagnostico.js#enDialogo`), porque en un `keydown` de `Escape` el
// diálogo ya se ha cerrado cuando el evento llega arriba. **Ese arreglo es genérico:
// un `<dialog>` más no cuesta una línea.** Hay una prueba que lo comprueba con ESTE
// diálogo, en vez de darlo por hecho — que es lo que separa «debería funcionar» de
// «funciona».
//
// ── QUÉ NO SE GUARDA SE ENUMERA AQUÍ, Y EL TEXTO NO ES DE AQUÍ ─────────────
// La lista sale de `storage/expedientes.js#NO_SE_GUARDA` y la advertencia de
// durabilidad de `AVISO_DURABILIDAD`, IMPORTADAS y no copiadas. Viven allí porque
// describen lo que hace AQUEL código, y una lista escrita lejos del código que la
// cumple se queda vieja sin que nadie lo note. Quien guarda tiene derecho a saber qué
// NO se está guardando, y a enterarse ANTES y no al recuperar (regla de oro 1).
//
// ── EL HUSO SE DICE ANTES DE PULSAR, NO DESPUÉS ────────────────────────────
// El visor no sabe cambiar de huso en caliente (deuda declarada de F10). Un
// expediente guardado en otro SRS no se puede abrir aquí, y esto se resuelve
// **enseñándolo en la fila y apagando su «Recuperar» con el motivo escrito en el
// mismo paso** — nunca dejando pulsar para fallar después. Duplicar y borrar siguen
// encendidos: ésos no necesitan el visor.
//
// ── ESTE MÓDULO ES UNA VISTA, Y NADA MÁS ──────────────────────────────────
// Fabrica nodos, los rellena, los abre y los cierra. **No sabe qué es IndexedDB, ni
// qué es un `Blob`, ni cómo se compone un DXF.** Recibe POJOs y emite intenciones
// (`alAccion`); quien encadene eso es `app/cableado-expediente.js` (T5.1).
//
// Corolario: **no sale por el barrel raíz** `index.js`. Toca `document`, y el barrel
// lo carga el proyecto Vitest `node`, que no tiene DOM. Lo vigila el guardián de
// `test/contrato.test.js`, que lo nombra por su fichero.
//
// ⚠️ **La edad («hace 6 días») llega REDACTADA desde fuera**, en `registro.edad`, y
// no se calcula aquí. `app/cableado-catastro.js#describirEdad` ya sabe decirlo —lo
// hace desde F05 para el renglón de procedencia— y una segunda implementación en una
// vista sería la segunda forma de decir la misma cosa, con sus dos maneras de
// redondear. Esta pantalla imprime lo que le den.

import { TIPO_EXPEDIENTE } from '../model/parcela.js'
import { AVISO_DURABILIDAD, NO_SE_GUARDA } from '../storage/expedientes.js'
import { NIVEL, resolverAvisar } from '../viewer/_comun.js'

// ── El contrato de marcado con `estilos/app.css` y con el cableado ───────────

/**
 * Clases CSS que pone este módulo. **Congeladas y son contrato**: la sección «El
 * diálogo Expediente» de `estilos/app.css` se escribe contra estos literales.
 *
 * Ninguna lleva juicio: no hay `--ok`, ni `--error`, ni `--exito`. Es la regla de oro
 * 9 aplicada al gancho de CSS, y hay un guardián que lo afirma.
 *
 * @readonly
 */
export const CLASE = Object.freeze({
  DIALOGO: 'gml-dialogo-expediente',
  CUERPO: 'gml-dialogo-expediente-cuerpo',
  TITULO: 'gml-dialogo-expediente-titulo',
  INTRO: 'gml-dialogo-expediente-intro',
  GRUPO: 'gml-dialogo-expediente-grupo',
  LEYENDA: 'gml-dialogo-expediente-leyenda',
  CAMPO: 'gml-dialogo-expediente-campo',
  ROTULO: 'gml-dialogo-expediente-rotulo',
  APUNTE: 'gml-dialogo-expediente-apunte',
  LISTA: 'gml-dialogo-expediente-lista',
  FILA: 'gml-dialogo-expediente-fila',
  FILA_DATOS: 'gml-dialogo-expediente-fila-datos',
  FILA_NOMBRE: 'gml-dialogo-expediente-fila-nombre',
  FILA_META: 'gml-dialogo-expediente-fila-meta',
  FILA_NOTA: 'gml-dialogo-expediente-fila-nota',
  FILA_ACCIONES: 'gml-dialogo-expediente-fila-acciones',
  BORRADOR: 'gml-dialogo-expediente-borrador',
  AVISO: 'gml-dialogo-expediente-aviso',
  PIE: 'gml-dialogo-expediente-pie',
  ESTADO: 'gml-dialogo-expediente-estado',
})

/**
 * Clases de la aplicación que este módulo REUTILIZA en vez de inventar equivalentes.
 * Se declaran —y el guardián de clases las cuenta— porque si no, un test que exigiera
 * «solo las de {@link CLASE}» saldría rojo y la reacción natural sería duplicar el
 * cromo, que es justo lo que no se quiere. Mismo criterio, y casi la misma lista, que
 * `app/dialogo-informe.js#CLASE_REUTILIZADA`.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CLASE_REUTILIZADA = Object.freeze([
  'gml-boton',
  'gml-boton--primario',
  'gml-boton--secundario',
  'gml-boton--menudo',
  'gml-entrada',
  'gml-mono',
])

/**
 * Las intenciones que este diálogo emite. **Son el vocabulario con el que habla con
 * el cableado**, y valen además como `data-accion` en el marcado: una sola cadena por
 * concepto, así que un botón no puede quedar enganchado a una acción que nadie
 * atiende.
 *
 * @readonly
 */
export const ACCION = Object.freeze({
  GUARDAR: 'guardar-expediente',
  RECUPERAR: 'recuperar-expediente',
  DUPLICAR: 'duplicar-expediente',
  BORRAR: 'borrar-expediente',
  RECUPERAR_BORRADOR: 'recuperar-borrador',
  DESCARTAR_BORRADOR: 'descartar-borrador',
  EXPORTAR_DXF: 'exportar-dxf',
  EXPORTAR_COORDENADAS: 'exportar-coordenadas',
  EXPORTAR_EXCEL: 'exportar-excel',
  EXPORTAR_PROYECTO: 'exportar-proyecto',
  ABRIR_PROYECTO: 'abrir-proyecto',
})

/**
 * Los `data-*` que este módulo produce. **Son el CONTRATO con el cableado de T5.1**,
 * que localiza los nodos por selector y lanza si falta alguno.
 *
 * ⚠️ `ESTADO` vale `dialogo-expediente`, **nombrado por el COMPONENTE y no por la
 * acción**. Es la lección M8 de F07, que ya costó dos veces: `querySelector` se queda
 * con el PRIMERO del documento, así que un `[data-estado="guardar"]` chocaría con
 * cualquier renglón homónimo del panel y dejaría a uno de los dos mudo.
 *
 * @readonly
 */
export const SELECTOR = Object.freeze({
  TITULO: '[data-expediente="titulo"]',
  INTRO: '[data-expediente="intro"]',
  NOMBRE: '[data-expediente="nombre"]',
  NO_SE_GUARDA: '[data-expediente="no-se-guarda"]',
  DURABILIDAD: '[data-expediente="durabilidad"]',
  BORRADOR: '[data-expediente="borrador"]',
  BORRADOR_TEXTO: '[data-expediente="borrador-texto"]',
  LISTA: '[data-expediente="lista"]',
  VACIO: '[data-expediente="vacio"]',
  GUARDAR: `[data-accion="${ACCION.GUARDAR}"]`,
  ABRIR_PROYECTO: `[data-accion="${ACCION.ABRIR_PROYECTO}"]`,
  // ⛔ **AQUÍ HABÍA TRES MÁS —`EXPORTAR_DXF`, `EXPORTAR_COORDENADAS` y
  // `EXPORTAR_EXCEL`— Y SE FUERON EL 2026-08-11 CON SUS BOTONES**, al desplegable
  // de salidas de la barra. Este mapa es el contrato de MARCADO de ESTE diálogo:
  // dejar aquí un selector que ya no casa ningún nodo suyo es exactamente la clase
  // de regla muerta que la rebanada 0 del topbar tuvo que ir a limpiar. Sus
  // `ACCION` siguen intactos —son el vocabulario del embudo, no del marcado— y sus
  // selectores viven ahora en `app/cableado-expediente.js#SELECTORES_SALIDA`.
  EXPORTAR_PROYECTO: `[data-accion="${ACCION.EXPORTAR_PROYECTO}"]`,
  CERRAR: '[data-accion="cerrar-expediente"]',
  ESTADO: '[data-estado="dialogo-expediente"]',
})

/**
 * El selector de una fila de la lista. **Fuera de {@link SELECTOR} a propósito**,
 * igual que `selectorEncabezado` en el diálogo de F09: los de ahí existen siempre y
 * éstos dependen de qué haya guardado.
 *
 * @param {string} id
 * @returns {string}
 */
export const selectorFila = (id) => `[data-id="${CSS_ESCAPE(id)}"]`

/**
 * Escapa un identificador para meterlo en un selector de atributo. `CSS.escape` no
 * existe en jsdom ni en Node, así que se entrecomilla y se escapan las comillas: un
 * `[data-id="…"]` con comillas dentro es un selector inválido y `querySelector`
 * LANZA, que sería una excepción a diez módulos de su causa.
 *
 * @param {string} id
 * @returns {string}
 */
function CSS_ESCAPE(id) {
  return String(id).replace(/(["\\])/g, '\\$1')
}

// ── Vocabulario ──────────────────────────────────────────────────────────────

/** Lo que rotula el diálogo. */
const TITULO = 'Expediente'

/**
 * Qué es esta pantalla, arriba del todo. Dice las dos cosas que hay que saber antes
 * de pulsar nada: dónde se guarda (aquí, en este navegador) y que «Generar GML» está
 * en otro sitio, para que nadie lo busque entre estos botones.
 */
const INTRO =
  'Aquí se guarda el trabajo en este navegador, se recupera lo guardado y se lleva a un fichero. ' +
  'El GML que se presenta en la Sede no sale de aquí: se genera con «Generar GML», al pie del panel.'

/** Lo que dice el renglón de estado al nacer, y tras `fijar(null)`. */
export const SIN_DATOS = 'Todavía no se ha mirado si hay expedientes guardados en este navegador.'

/**
 * Cómo se nombra **en una frase** el documento de cada rama (F12 · T4.3).
 *
 * ⚠️ No es el `ROTULO` de `app/rama.js`, que son los rótulos de los dos botones del
 * conmutador («Parcela», «Edificio») y van en mayúscula y sueltos. Éstos van dentro
 * de una oración, con artículo. Son dos usos distintos de la misma palabra, y por eso
 * son dos constantes y no un `toLowerCase()` sobre aquélla, que ataría el texto de
 * este diálogo a la mayúscula de un botón.
 *
 * Vive **aquí y no en el cableado** porque quien lo consume son textos —el bloque del
 * borrador de este diálogo y los acuses del cableado—, y el cableado ya importa de
 * aquí `motivoOtroHuso` por exactamente el mismo motivo. Al revés habría cerrado un
 * ciclo: este módulo no importa nada del cableado, a propósito.
 *
 * Las claves son las de `TIPO_EXPEDIENTE` (`model/parcela.js`).
 *
 * @readonly
 */
export const ROTULO_RAMA = Object.freeze({
  [TIPO_EXPEDIENTE.PARCELA]: 'la parcela',
  [TIPO_EXPEDIENTE.EDIFICIO]: 'el edificio',
})

/**
 * Enumera lo que hay autoguardado: «de la parcela 9398516VK3799G», «del edificio», «de
 * la parcela 9398516VK3799G y del edificio». Devuelve `''` cuando no hay nada que
 * nombrar, que es lo que permite componer la frase sin un `if` en cada llamante.
 *
 * @param {Array<{tipo: string, refcat: string|null}>} borradores
 * @returns {string}
 */
export const enumerarBorradores = (borradores) => {
  const piezas = (Array.isArray(borradores) ? borradores : []).map((b) => {
    const rotulo = ROTULO_RAMA[b?.tipo] ?? 'el trabajo'
    // «de el edificio» no lo dice nadie. La contracción se hace pieza a pieza y no con
    // un reemplazo sobre la frase entera, que acabaría tocando un «de el…» ajeno —por
    // ejemplo dentro de una referencia catastral con esas letras.
    const con = rotulo.startsWith('el ') ? `del ${rotulo.slice(3)}` : `de ${rotulo}`
    const refcat = textoONulo(b?.refcat)
    return refcat === null ? con : `${con} ${refcat}`
  })
  if (piezas.length === 0) return ''
  return piezas.length === 1 ? piezas[0] : `${piezas.slice(0, -1).join(', ')} y ${piezas.at(-1)}`
}

/**
 * Por qué está apagado «Guardar» cuando no hay nada que guardar. Regla de oro 1: el
 * botón se apaga y el porqué se escribe **en el mismo paso**, nunca en dos.
 */
export const MOTIVO_SIN_GEOMETRIA =
  'El botón «Guardar» está apagado: todavía no hay ninguna parcela en pantalla que guardar.'

/**
 * Por qué está apagado «Recuperar» en una fila de otro huso. Se exporta para que el
 * test y el cableado lo afirmen sin copiar el literal.
 *
 * @param {string} srs
 * @returns {string}
 */
export const motivoOtroHuso = (srs) =>
  `Este expediente está en ${srs} y la pantalla está trabajando en otro sistema de referencia. ` +
  'Esta versión de la aplicación no sabe cambiar de huso sin recargar, así que no se abre: ' +
  'abrirlo dejaría la geometría en el sitio equivocado sin que nada lo indicara.'

/**
 * Lo que se le dice al usuario cuando revienta un oyente suyo. Gemelo de
 * `app/dialogo-informe.js#MENSAJE_OYENTE_ROTO`, y por el mismo motivo MEDIDO: **una
 * excepción lanzada dentro de un oyente del DOM no sale por `dispatchEvent`**, ni en
 * jsdom ni en el navegador, así que dejarla propagar es un error silencioso de
 * manual — la pantalla se queda como estaba y el único rastro está en una consola que
 * nadie abre.
 */
export const MENSAJE_OYENTE_ROTO =
  'La orden ha llegado bien, pero lo que la aplicación tenía que hacer con ella se ha ' +
  'interrumpido por un fallo interno; no se ha cambiado nada. El detalle técnico está en la ' +
  'consola del navegador.'

/**
 * Motivos con los que se cierra el diálogo. Mismo vocabulario, y mismo reparto, que
 * `app/dialogo-informe.js#MOTIVO_CIERRE`.
 *
 * @readonly
 */
export const MOTIVO_CIERRE = Object.freeze({
  BOTON: 'BOTON',
  ESCAPE: 'ESCAPE',
  NATIVO: 'NATIVO',
  PROGRAMATICO: 'PROGRAMATICO',
})

// ── Utilidades ───────────────────────────────────────────────────────────────

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Describe un valor para el mensaje de un `throw`, sin reventar con los cíclicos. */
function describir(valor) {
  if (valor === null) return 'null'
  if (valor === undefined) return 'undefined'
  if (Array.isArray(valor)) return `un array de ${valor.length}`
  if (typeof valor === 'string') return JSON.stringify(valor)
  if (typeof valor === 'object') return 'un objeto'
  return `${typeof valor} (${String(valor)})`
}

/**
 * ¿Sirve como documento? DUCK TYPING deliberado, no `instanceof Document` — mismo
 * criterio (y mismo motivo) que `app/dialogo-informe.js#esDocumento`: un documento de
 * otro realm no pasa el `instanceof`, y `Document` ni siquiera existe como global
 * bajo el proyecto Vitest `node`.
 *
 * @param {*} d
 * @returns {boolean}
 */
function esDocumento(d) {
  return (
    !!d &&
    typeof d === 'object' &&
    typeof d.createElement === 'function' &&
    typeof d.createTextNode === 'function' &&
    !!d.body
  )
}

/** Un texto utilizable, o `null`. */
const textoONulo = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/**
 * Sello incremental para los `id` del marcado. Dos diálogos en el mismo documento
 * compartirían los `id` de sus `<label for>`, y un `for` que apunta al campo de otro
 * diálogo es un fallo que no se ve. Mismo recurso que en el diálogo de F09.
 */
let sello = 0

// ── Typedefs ─────────────────────────────────────────────────────────────────

/**
 * Una fila de la lista. Es {@link import('../storage/expedientes.js').RegistroExpediente}
 * **sin el expediente** y **con la edad ya redactada**: esta pantalla no rehidrata
 * nada y no calcula fechas.
 *
 * @typedef {Object} FilaExpediente
 * @property {string} id
 * @property {string} nombre
 * @property {string|null} refcat
 * @property {string} srs
 * @property {string|null} edad  «hace 6 días», ya redactado. `null` ⇒ no se escribe.
 */

/**
 * @typedef {Object} ValoresExpediente
 * @property {string|null} nombre  Lo que haya en el campo, recortado. `null` si está
 *   en blanco: el almacén ya sabe componer un rótulo por defecto y mandarle una
 *   cadena vacía le haría guardar un nombre vacío.
 */

/**
 * @typedef {Object} AccionExpediente
 * @property {string} accion  Una de {@link ACCION}.
 * @property {string|null} id  El expediente sobre el que se actúa, si la acción es de
 *   una fila. `null` en las globales.
 * @property {string|null} nombre  Lo que hubiera en el campo al pulsar. Viaja con la
 *   acción para que el cableado no tenga que acordarse de leerlo.
 */

// ── La vista ─────────────────────────────────────────────────────────────────

/**
 * El diálogo «Expediente».
 *
 * ```js
 * const dialogo = crearDialogoExpediente({ documento: document, alAvisar: panel.avisar })
 * dialogo.fijar({ registros, borrador, srsActual: 'EPSG:25830', puedeGuardar: true })
 * dialogo.alAccion(({ accion, id }) => cableado.atender(accion, id))
 * dialogo.abrir()
 * ```
 *
 * Contrato roto por el PROGRAMADOR (falta `documento`, un `alAlgo` que no recibe
 * función, un `fijar` con la forma equivocada) → `TypeError`. Un dato malo del
 * USUARIO —un nombre en blanco, una lista vacía— **nunca lanza**.
 *
 * @param {Object} opciones
 * @param {Document} opciones.documento  Se inyecta —en vez de tomar el global— para
 *   que el test pueda medirlo y para que el diálogo funcione dentro de un iframe.
 * @param {import('../viewer/_comun.js').Avisar} [opciones.alAvisar]
 * @returns {object}
 * @throws {TypeError}
 */
export function crearDialogoExpediente({ documento, alAvisar } = {}) {
  if (!esDocumento(documento)) {
    throw new TypeError(
      `crearDialogoExpediente: 'documento' debe ser un Document (o un objeto con createElement, ` +
        `createTextNode y body); recibido ${describir(documento)}.`,
    )
  }
  const avisar = resolverAvisar(alAvisar)

  const doc = documento
  const marca = (sello += 1)
  const id = (sufijo) => `gml-dialogo-expediente-${marca}-${sufijo}`

  const crear = (etiqueta, clase, texto) => {
    const el = doc.createElement(etiqueta)
    if (clase) el.className = clase
    if (texto !== undefined) el.textContent = texto
    return el
  }

  // ── Estado ────────────────────────────────────────────────────────────────

  let destruido = false
  let estaAbierto = false
  /** Lo último que se pasó a `fijar`, ya normalizado. `null` = nada mirado todavía. */
  let datos = null
  /** Quién tenía el foco antes de abrir, para devolvérselo al cerrar. */
  let focoPrevio = null

  const oyentes = { accion: new Set(), cerrar: new Set() }

  /** Registro de escuchadores: cero fugas por construcción. */
  const escuchados = []
  function escuchar(diana, tipo, fn) {
    diana.addEventListener(tipo, fn)
    escuchados.push({ diana, tipo, fn })
  }

  // ── El marcado ────────────────────────────────────────────────────────────

  const dialogo = crear('dialog', CLASE.DIALOGO)
  // ⚠️ NI `font` NI NINGUNA `fontFamily` EN LÍNEA, aquí ni en ningún hijo: un estilo
  // en línea GANA a la hoja, así que un `font: 'inherit'` de conveniencia deja muertas
  // las reglas de `estilos/app.css` sin que nada se queje, y en jsdom no hay cascada
  // que lo delate. Es la lección MEDIDA de F08 (guion 10). Todo el cromo es de la hoja.
  dialogo.setAttribute('aria-labelledby', id('titulo'))
  dialogo.setAttribute('aria-modal', 'true')
  // Suelo del foco: sin un control enfocable, `abrir()` dejaría el foco fuera y
  // `Escape` no llegaría nunca.
  dialogo.tabIndex = -1

  const cuerpo = crear('div', CLASE.CUERPO)
  dialogo.append(cuerpo)

  const titulo = crear('h2', CLASE.TITULO, TITULO)
  titulo.id = id('titulo')
  titulo.dataset.expediente = 'titulo'

  const intro = crear('p', CLASE.INTRO, INTRO)
  intro.dataset.expediente = 'intro'

  // ── Grupo 1 · guardar ─────────────────────────────────────────────────────
  // `<fieldset>`/`<legend>` y no un `<div>` con un `<p>`: es un GRUPO de controles
  // relacionados, que es literalmente lo que ese par significa, y es lo que hace que
  // un lector de pantalla anuncie el grupo antes del primer campo.
  const grupoGuardar = crear('fieldset', CLASE.GRUPO)
  grupoGuardar.dataset.expediente = 'guardar'
  grupoGuardar.append(crear('legend', CLASE.LEYENDA, 'Guardar el trabajo en este navegador'))

  const campoNombre = crear('div', CLASE.CAMPO)
  const rotuloNombre = crear('label', CLASE.ROTULO, 'Nombre del expediente')
  rotuloNombre.htmlFor = id('nombre')
  const entradaNombre = crear('input', 'gml-entrada')
  entradaNombre.type = 'text'
  entradaNombre.id = id('nombre')
  entradaNombre.dataset.expediente = 'nombre'
  entradaNombre.setAttribute('placeholder', 'Si se deja en blanco, se usa la referencia catastral')
  campoNombre.append(rotuloNombre, entradaNombre)
  grupoGuardar.append(campoNombre)

  const guardar = crear('button', 'gml-boton gml-boton--primario', 'Guardar')
  guardar.type = 'button'
  guardar.dataset.accion = ACCION.GUARDAR
  // El renglón de estado es donde se escribe POR QUÉ está apagado, así que se enlaza:
  // un lector de pantalla que anuncie el botón anuncia también el motivo.
  guardar.setAttribute('aria-describedby', id('estado'))
  // NACE APAGADO: sin parcela no hay nada que guardar. A partir de aquí lo gobierna
  // `repintarGate`, y nunca sin escribir el motivo.
  guardar.disabled = true
  const pieGuardar = crear('div', CLASE.PIE)
  pieGuardar.append(guardar)
  grupoGuardar.append(pieGuardar)

  // Lo que NO se guarda. Va DENTRO del grupo de guardar y encima de la lista, no al
  // pie del diálogo: un aviso al pie se lee después de haber pulsado, o no se lee.
  const noSeGuarda = crear('section', CLASE.AVISO)
  noSeGuarda.dataset.expediente = 'no-se-guarda'
  noSeGuarda.append(crear('h3', CLASE.ROTULO, 'Lo que NO se guarda'))
  const listaNoSeGuarda = crear('ul', CLASE.LISTA)
  for (const linea of NO_SE_GUARDA) listaNoSeGuarda.append(crear('li', null, linea))
  noSeGuarda.append(listaNoSeGuarda)
  const durabilidad = crear('p', CLASE.APUNTE, AVISO_DURABILIDAD)
  durabilidad.dataset.expediente = 'durabilidad'
  noSeGuarda.append(durabilidad)
  grupoGuardar.append(noSeGuarda)

  // ── Grupo 2 · lo guardado ─────────────────────────────────────────────────
  const grupoLista = crear('fieldset', CLASE.GRUPO)
  grupoLista.dataset.expediente = 'guardados'
  grupoLista.append(crear('legend', CLASE.LEYENDA, 'Guardados en este navegador'))

  // El borrador del autoguardado. OFRECE, no impone (decisión 2 de la entrevista): la
  // aplicación arranca como siempre y esto aparece si hay trabajo sin terminar.
  // Existe SIEMPRE en el DOM y se enseña con `hidden`, no creándolo al vuelo: si solo
  // apareciera al pintar, el `nodo()` del cableado lanzaría al arrancar.
  const bloqueBorrador = crear('section', CLASE.BORRADOR)
  bloqueBorrador.dataset.expediente = 'borrador'
  bloqueBorrador.hidden = true
  const textoBorrador = crear('p', CLASE.APUNTE)
  textoBorrador.dataset.expediente = 'borrador-texto'
  const accionesBorrador = crear('div', CLASE.FILA_ACCIONES)
  const recuperarBorrador = crear('button', 'gml-boton gml-boton--menudo', 'Recuperar')
  recuperarBorrador.type = 'button'
  recuperarBorrador.dataset.accion = ACCION.RECUPERAR_BORRADOR
  const descartarBorrador = crear('button', 'gml-boton gml-boton--menudo', 'Descartar')
  descartarBorrador.type = 'button'
  descartarBorrador.dataset.accion = ACCION.DESCARTAR_BORRADOR
  accionesBorrador.append(recuperarBorrador, descartarBorrador)
  bloqueBorrador.append(textoBorrador, accionesBorrador)
  grupoLista.append(bloqueBorrador)

  const vacio = crear('p', CLASE.APUNTE, SIN_DATOS)
  vacio.dataset.expediente = 'vacio'
  grupoLista.append(vacio)

  const lista = crear('ul', CLASE.LISTA)
  lista.dataset.expediente = 'lista'
  grupoLista.append(lista)

  // ── Grupo 3 · entrar y salir por fichero ──────────────────────────────────
  const grupoFicheros = crear('fieldset', CLASE.GRUPO)
  grupoFicheros.dataset.expediente = 'ficheros'
  grupoFicheros.append(crear('legend', CLASE.LEYENDA, 'Guardar el expediente en un fichero'))
  grupoFicheros.append(
    crear(
      'p',
      CLASE.APUNTE,
      'El fichero de proyecto guarda el expediente entero y es el único que se puede volver a ' +
        'abrir aquí. Para llevar la geometría a otro programa —DXF o listado de coordenadas— ' +
        'usa el desplegable que hay junto a «Generar GML», arriba.',
    ),
  )
  const pieFicheros = crear('div', CLASE.PIE)
  /**
   * Los botones de fichero, en el orden en el que se ofrecen.
   *
   * ⛔ **ERAN CINCO HASTA EL 2026-08-11 Y AHORA SON DOS.** Las tres exportaciones de
   * geometría —`EXPORTAR_DXF`, `EXPORTAR_COORDENADAS` y `EXPORTAR_EXCEL`— se han
   * mudado al desplegable de salidas de la barra de arriba, por petición del autor:
   * «no tiene sentido que la exportación esté dentro del menú de expediente».
   *
   * ⚠️ **Se RETIRAN de aquí en vez de repetirse arriba, y eso es obligatorio, no
   * una preferencia**: `app/cableado-expediente.js` y los guiones de humo resuelven
   * esos `data-accion` con `document.querySelector`, que se queda con el PRIMERO del
   * documento. Con un botón en `index.html` y otro fabricado aquí, el diálogo
   * quedaría cableado a un nodo que no es el suyo. Es la trampa K.1, y estaba
   * anticipada por escrito en el hueco de `index.html` desde la rebanada 2 del topbar.
   *
   * Las dos que se quedan no son exportaciones: son **el expediente entrando y
   * saliendo de la propia aplicación**, que es de lo que va este diálogo. El
   * `ACCION` de las tres mudadas NO se toca —sigue siendo el vocabulario del
   * embudo, y quien las emite ahora es la barra—.
   */
  const BOTONES_FICHERO = [
    [ACCION.EXPORTAR_PROYECTO, 'Guardar proyecto (.json)'],
    [ACCION.ABRIR_PROYECTO, 'Abrir un proyecto…'],
  ]
  for (const [accion, rotulo] of BOTONES_FICHERO) {
    const boton = crear('button', 'gml-boton gml-boton--secundario', rotulo)
    boton.type = 'button'
    boton.dataset.accion = accion
    pieFicheros.append(boton)
  }
  grupoFicheros.append(pieFicheros)

  // ── Pie ───────────────────────────────────────────────────────────────────
  const pie = crear('div', CLASE.PIE)
  const cerrarBoton = crear('button', 'gml-boton gml-boton--secundario', 'Cerrar')
  cerrarBoton.type = 'button'
  cerrarBoton.dataset.accion = 'cerrar-expediente'
  pie.append(cerrarBoton)

  // `role="status"` para que el lector de pantalla lo anuncie SIN robar el foco,
  // igual que el de «Generar GML» y los de los dos cajones.
  const estadoNodo = crear('p', CLASE.ESTADO, SIN_DATOS)
  estadoNodo.id = id('estado')
  estadoNodo.dataset.estado = 'dialogo-expediente'
  estadoNodo.setAttribute('role', 'status')

  cuerpo.append(titulo, intro, grupoGuardar, grupoLista, grupoFicheros, pie, estadoNodo)
  doc.body.appendChild(dialogo)

  // ── Pintado ───────────────────────────────────────────────────────────────

  /**
   * Una fila de la lista.
   *
   * El huso se enseña SIEMPRE y no solo cuando estorba: es el dato que decide si la
   * geometría cae donde debe, y enseñarlo únicamente en el caso malo obligaría a
   * deducir el bueno por ausencia.
   *
   * @param {FilaExpediente} r
   * @param {string|null} srsActual
   * @returns {HTMLElement}
   */
  function pintarFila(r, srsActual) {
    const li = crear('li', CLASE.FILA)
    li.dataset.id = r.id

    const bloque = crear('div', CLASE.FILA_DATOS)
    bloque.append(crear('p', CLASE.FILA_NOMBRE, r.nombre))
    const meta = [r.refcat ?? 'Sin referencia catastral', r.srs]
    if (r.edad !== null) meta.push(r.edad)
    bloque.append(crear('p', `${CLASE.FILA_META} gml-mono`, meta.join(' · ')))

    const otroHuso = srsActual !== null && r.srs !== srsActual
    if (otroHuso) {
      // El motivo se escribe EN EL MISMO PASO en que se apaga el botón. Separarlos es
      // exactamente como se llega a tener un botón gris y mudo (regla de oro 1).
      const nota = crear('p', CLASE.FILA_NOTA, motivoOtroHuso(r.srs))
      nota.id = `${id('huso')}-${lista.children.length}`
      bloque.append(nota)
      li.dataset.nota = nota.id
    }

    const acciones = crear('div', CLASE.FILA_ACCIONES)
    for (const [accion, rotulo] of [
      [ACCION.RECUPERAR, 'Recuperar'],
      [ACCION.DUPLICAR, 'Duplicar'],
      [ACCION.BORRAR, 'Borrar'],
    ]) {
      const boton = crear('button', 'gml-boton gml-boton--menudo', rotulo)
      boton.type = 'button'
      boton.dataset.accion = accion
      // Solo «Recuperar» necesita el visor; duplicar y borrar no tocan la pantalla.
      if (accion === ACCION.RECUPERAR && otroHuso) {
        boton.disabled = true
        boton.setAttribute('aria-describedby', li.dataset.nota)
      }
      acciones.append(boton)
    }

    li.append(bloque, acciones)
    return li
  }

  /** La lista entera, y el renglón de «no hay nada» cuando toca. */
  function pintarLista() {
    lista.replaceChildren()
    if (datos === null) {
      vacio.hidden = false
      vacio.textContent = SIN_DATOS
      return
    }
    const registros = datos.registros
    vacio.hidden = registros.length > 0
    if (registros.length === 0) {
      vacio.textContent =
        'No hay ningún expediente guardado en este navegador. Con «Guardar» se crea el primero.'
      return
    }
    for (const r of registros) lista.append(pintarFila(r, datos.srsActual))
  }

  /**
   * El bloque del borrador: OFRECE, no impone.
   *
   * ⚠️ **Enumera todas las ramas que tengan trabajo** (F12 · T4.3), y la edad que
   * dice es la primera que consta. Nombrar solo una habría dejado la otra escondida
   * detrás de un botón que la recupera igual: el usuario pulsaría «Recuperar»
   * creyendo que abre una cosa y le vendrían dos.
   */
  function pintarBorrador() {
    const b = datos?.borrador ?? null
    bloqueBorrador.hidden = b === null || b.length === 0
    if (b === null || b.length === 0) {
      textoBorrador.textContent = ''
      return
    }
    const edad = b.map((x) => x.edad).find((e) => e !== null) ?? null
    const partes = ['Hay trabajo sin terminar que la aplicación guardó sola']
    if (edad !== null) partes.push(edad)
    const referencia = enumerarBorradores(b)
    textoBorrador.textContent =
      `${partes.join(', ')}${referencia === '' ? '' : `, ${referencia}`}. ` +
      'Recupéralo para seguir donde lo dejaste, o descártalo para empezar de cero. Mientras no ' +
      'hagas ninguna de las dos cosas, se queda donde está.'
  }

  /**
   * El botón primario y su porqué, **SIEMPRE en el mismo paso** (regla de oro 1).
   *
   * Cuando sí se puede guardar, el renglón se VACÍA: es un repintado, y dejar ahí el
   * motivo anterior sería peor que no decir nada. Quien quiera escribir algo después
   * tiene {@link estado}.
   */
  function repintarGate() {
    const motivo =
      datos === null ? SIN_DATOS : datos.puedeGuardar ? null : MOTIVO_SIN_GEOMETRIA
    guardar.disabled = motivo !== null
    estadoNodo.textContent = motivo ?? ''
  }

  // ── Oyentes ───────────────────────────────────────────────────────────────

  /**
   * Reparte un suceso entre sus oyentes **atrapando lo que revienten**. Ver
   * {@link MENSAJE_OYENTE_ROTO}: una excepción dentro de un oyente del DOM no sale
   * por `dispatchEvent`. El `try` alcanza a CADA oyente por separado: uno roto no
   * puede dejar sin enterarse a los demás.
   *
   * @param {Set<Function>} conjunto
   * @param {*} [carga]
   */
  function repartir(conjunto, carga) {
    for (const fn of conjunto) {
      try {
        fn(carga)
      } catch (causa) {
        avisar(MENSAJE_OYENTE_ROTO, { nivel: NIVEL.ERROR, causa })
        console.error('[dialogo-expediente] un oyente ha fallado de forma inesperada:', causa)
      }
    }
  }

  /** Alta de un oyente, con su baja. Mismo patrón —y misma guarda— que los cajones. */
  function suscribir(conjunto, fn, quien) {
    if (typeof fn !== 'function') {
      throw new TypeError(`${quien}: 'fn' debe ser una función; recibido ${describir(fn)}.`)
    }
    conjunto.add(fn)
    return () => conjunto.delete(fn)
  }

  const ACCIONES = new Set(Object.values(ACCION))

  /**
   * UN solo oyente para todo el diálogo, por DELEGACIÓN.
   *
   * Las filas se repintan enteras en cada `fijar`, así que enganchar un oyente por
   * botón obligaría a darlos de baja en cada repintado — y el que se olvide es una
   * fuga que no se ve. Con delegación, los botones nacen y mueren sin que nadie tenga
   * que acordarse de nada.
   *
   * @param {Event} evento
   */
  function alPulsar(evento) {
    const boton = evento.target?.closest?.('[data-accion]')
    if (!boton || !dialogo.contains(boton)) return

    const accion = boton.dataset.accion
    if (accion === 'cerrar-expediente') {
      cerrarInterno(MOTIVO_CIERRE.BOTON, true)
      return
    }
    if (!ACCIONES.has(accion)) return
    // Guarda de cinturón: un `click()` sintético sobre un botón deshabilitado no
    // dispara en el navegador, pero sí podría llegar aquí por otras vías. Recuperar un
    // expediente de otro huso es justo lo que el apagado existe para impedir.
    if (boton.disabled) return

    repartir(oyentes.accion, {
      accion,
      id: boton.closest('[data-id]')?.dataset.id ?? null,
      nombre: textoONulo(entradaNombre.value),
    })
  }

  /**
   * `Escape`.
   *
   * **No se hace `preventDefault`**: en un navegador de verdad el propio `<dialog>` ya
   * atiende la petición de cierre (evento `cancel`), y cancelar el gesto aquí dejaría
   * esa mitad muerta sin ganar nada. Las dos vías convergen porque
   * {@link cerrarInterno} es idempotente. En jsdom ésta es la ÚNICA vía.
   */
  function alTecla(evento) {
    if (evento.key !== 'Escape') return
    cerrarInterno(MOTIVO_CIERRE.ESCAPE, true)
  }

  /** La vía nativa, cuando existe. En jsdom no llega nunca. */
  function alCancelNativo() {
    cerrarInterno(MOTIVO_CIERRE.ESCAPE, true)
  }

  /**
   * Red de seguridad: el `<dialog>` se ha cerrado sin pasar por aquí. La guarda de
   * `dialogo.open` es para un `close` RANCIO: el navegador encola ese evento, así que
   * un `cerrar()` seguido de un `abrir()` en el mismo tick lo entregaría con el
   * diálogo ya reabierto y esto lo volvería a cerrar sin que nadie lo pidiera.
   */
  function alCerrarNativo() {
    if (dialogo.open) return
    cerrarInterno(MOTIVO_CIERRE.NATIVO, true)
  }

  escuchar(dialogo, 'click', alPulsar)
  escuchar(dialogo, 'keydown', alTecla)
  escuchar(dialogo, 'cancel', alCancelNativo)
  escuchar(dialogo, 'close', alCerrarNativo)

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  /**
   * El primer control al que se puede ir. Se enfoca **un campo** y no el diálogo:
   * esto se abre para hacer algo, y aterrizar en el primer control es lo que deja
   * empezar.
   *
   * La visibilidad se comprueba por el `hidden` del ancestro y **no** por
   * `offsetParent`, que es la forma habitual y aquí sería una trampa doble: en jsdom
   * vale `null` siempre (no hay maquetado) y en un navegador vale `null` para todo lo
   * que cuelga de un `position: fixed` — que es justo lo que este diálogo es.
   *
   * @returns {HTMLElement}
   */
  function primerFoco() {
    for (const el of dialogo.querySelectorAll('input, button')) {
      if (!el.disabled && el.closest('[hidden]') === null) return el
    }
    return dialogo
  }

  function abrir() {
    if (destruido || estaAbierto) return
    focoPrevio = doc.activeElement ?? null
    estaAbierto = true

    // Detección de capacidad, no de navegador: en jsdom `showModal` no existe y
    // llamarlo a pelo lanzaría `TypeError`.
    if (typeof dialogo.showModal === 'function') {
      try {
        dialogo.showModal()
      } catch {
        dialogo.setAttribute('open', '')
      }
    } else {
      dialogo.setAttribute('open', '')
    }

    primerFoco().focus()
  }

  /**
   * Cierra y, si toca, avisa. IDEMPOTENTE por construcción: `estaAbierto` se baja
   * ANTES de tocar el DOM, así que el `close` que emita el navegador vuelve a entrar
   * aquí y sale por la primera línea.
   *
   * @param {string} motivo  Uno de {@link MOTIVO_CIERRE}.
   * @param {boolean} notificar  `false` cuando lo cierra el programa.
   */
  function cerrarInterno(motivo, notificar) {
    if (!estaAbierto) return
    estaAbierto = false

    if (typeof dialogo.close === 'function') {
      try {
        dialogo.close()
      } catch {
        dialogo.removeAttribute('open')
      }
    } else {
      dialogo.removeAttribute('open')
    }

    const previo = focoPrevio
    focoPrevio = null
    if (previo && typeof previo.focus === 'function' && previo.isConnected) previo.focus()

    if (notificar) repartir(oyentes.cerrar, motivo)
  }

  // ── API pública ───────────────────────────────────────────────────────────

  return {
    nodo: dialogo,

    /**
     * Carga lo que hay que enseñar. **No abre el diálogo**: quien decide cuándo se
     * abre es el cableado.
     *
     * `null` deja la pantalla como recién nacida —lista vacía, sin borrador, botón
     * apagado con su motivo— sin cerrarla.
     *
     * @param {Object|null} entrada
     * @param {FilaExpediente[]} [entrada.registros=[]]  Del más reciente al más
     *   antiguo, como los devuelve `storage/expedientes.js#listar`.
     * @param {Array<{tipo?: string, refcat: string|null, edad: string|null}>|{refcat: string|null, edad: string|null}|null} [entrada.borrador=null]
     *   El trabajo autoguardado, si lo hay: **una lista, una por rama**. Un objeto
     *   suelto se admite y se envuelve, por compatibilidad con F10.
     * @param {string|null} [entrada.srsActual=null]  El huso en el que trabaja la
     *   pantalla. Con `null` no se marca ninguna fila: es «todavía no se sabe», que no
     *   es lo mismo que «coinciden todas».
     * @param {boolean} [entrada.puedeGuardar=false]
     * @param {string} [entrada.nombre]  Qué poner en el campo. **Si se omite, lo que
     *   haya escrito el usuario NO se toca**: un repintado de la lista no puede
     *   borrarle el nombre a medio teclear.
     * @throws {TypeError}  Contrato del programador.
     */
    fijar(entrada) {
      if (destruido) return

      if (entrada === null || entrada === undefined) {
        datos = null
        entradaNombre.value = ''
        pintarBorrador()
        pintarLista()
        repintarGate()
        return
      }
      if (!esObjeto(entrada)) {
        throw new TypeError(
          `fijar: se espera un objeto {registros, borrador, srsActual, puedeGuardar, nombre} o ` +
            `null; recibido ${describir(entrada)}.`,
        )
      }
      const {
        registros = [],
        borrador = null,
        srsActual = null,
        puedeGuardar = false,
        nombre,
      } = entrada
      if (!Array.isArray(registros)) {
        throw new TypeError(`fijar: 'registros' debe ser un array; recibido ${describir(registros)}.`)
      }

      // Se normaliza ANTES de tocar un solo nodo: si algo va a lanzar, tiene que
      // lanzar con el diálogo EXACTAMENTE como estaba.
      const filas = registros.map((r, i) => {
        if (!esObjeto(r) || typeof r.id !== 'string' || r.id === '') {
          throw new TypeError(
            `fijar: registros[${i}] debe tener un 'id' de texto no vacío; recibido ${describir(r)}.`,
          )
        }
        return {
          id: r.id,
          nombre: textoONulo(r.nombre) ?? r.id,
          refcat: textoONulo(r.refcat),
          srs: textoONulo(r.srs) ?? 'Sistema de referencia desconocido',
          edad: textoONulo(r.edad),
        }
      })

      datos = {
        registros: filas,
        // ⛔ F12 · T4.3 · es una LISTA. Un objeto suelto entra igual y se envuelve —hay
        // un `fijar({borrador: {refcat, edad}})` en las pruebas de F10 y en el guion 12,
        // y romperlos por un cambio de forma interno no le arregla nada a nadie—, pero
        // lo que se guarda y se pinta es siempre una lista.
        borrador:
          borrador === null || borrador === undefined
            ? null
            : (Array.isArray(borrador) ? borrador : [borrador]).map((b) => ({
                tipo: textoONulo(b?.tipo) ?? TIPO_EXPEDIENTE.PARCELA,
                refcat: textoONulo(b?.refcat),
                edad: textoONulo(b?.edad),
              })),
        srsActual: textoONulo(srsActual),
        puedeGuardar: puedeGuardar === true,
      }
      if (nombre !== undefined) entradaNombre.value = typeof nombre === 'string' ? nombre : ''

      pintarBorrador()
      pintarLista()
      repintarGate()
    },

    abrir,

    /**
     * Cierra el diálogo **sin borrar nada** y sin avisar a los oyentes de
     * {@link alCerrar} (eso es para los gestos del usuario). Volver a `abrir()`
     * devuelve la pantalla como estaba, con el nombre a medio teclear dentro.
     */
    cerrar() {
      cerrarInterno(MOTIVO_CIERRE.PROGRAMATICO, false)
    },

    abierto() {
      return !destruido && estaAbierto === true
    },

    /** @returns {ValoresExpediente} */
    valores() {
      return { nombre: destruido ? null : textoONulo(entradaNombre.value) }
    },

    /**
     * ¿Está encendido «Guardar»? Se expone para que el cableado y sus pruebas no
     * tengan que espiar el `disabled` de un nodo por selector. Gemelo de
     * `puedeComponer()` en el diálogo de F09.
     */
    puedeGuardar() {
      return !destruido && guardar.disabled === false
    },

    /**
     * Escribe el renglón de estado (`role="status"`).
     *
     * ⚠️ Lo que se escriba aquí vale **hasta el siguiente `fijar`**, que vuelve a
     * escribir ahí el motivo del gate o lo vacía. Es el orden correcto —el motivo de
     * un botón apagado manda sobre el mensaje de la operación anterior— y es el mismo
     * aviso que llevan el cajón de F08 y el diálogo de F09.
     *
     * @param {string} texto
     */
    estado(texto) {
      if (!destruido) estadoNodo.textContent = typeof texto === 'string' ? texto : ''
    },

    /**
     * Se suscribe a TODAS las intenciones del diálogo. El oyente recibe
     * {@link AccionExpediente}. Devuelve la BAJA.
     *
     * Un solo punto de suscripción y no diez: las diez acciones van al mismo sitio
     * —el cableado— y diez `alAlgo` serían diez bajas que dar y diez oportunidades de
     * olvidar una.
     */
    alAccion(fn) {
      return suscribir(oyentes.accion, fn, 'alAccion')
    },

    /**
     * Se suscribe al cierre POR GESTO DEL USUARIO —«Cerrar» o `Escape`—, nunca al
     * `cerrar()` del programa. El oyente recibe el motivo ({@link MOTIVO_CIERRE}).
     */
    alCerrar(fn) {
      return suscribir(oyentes.cerrar, fn, 'alCerrar')
    },

    /**
     * Retira los escuchadores, saca el `<dialog>` del documento y deja el módulo
     * inerte. **IDEMPOTENTE** y deja el DOM como estaba.
     */
    destruir() {
      if (destruido) return
      cerrarInterno(MOTIVO_CIERRE.PROGRAMATICO, false)
      destruido = true

      for (const { diana, tipo, fn } of escuchados) diana.removeEventListener(tipo, fn)
      escuchados.length = 0

      oyentes.accion.clear()
      oyentes.cerrar.clear()

      if (dialogo.parentNode) dialogo.parentNode.removeChild(dialogo)
    },
  }
}

export default crearDialogoExpediente
