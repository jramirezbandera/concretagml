// app/main.js — F03 · Fase 4, Tarea 4B.1. EL ARRANQUE DE LA APP.
//
// Sustituye la sonda de build de la tarea 4A.1. Es la ENTRADA de Vite y el
// ÚNICO sitio del proyecto que ensambla la aplicación completa: coge las cajas
// vacías que declara `index.html` y las convierte en la pantalla viva.
//
// ── QUÉ ENSAMBLA, Y EN QUÉ ORDEN (el orden importa, y aquí está el por qué) ──
//   1. DATOS      — `parcelaDemo()` (o `parcelaDemoConHueco()` con `?demo=hueco`)
//                   de `./demo-datos.js`. Un POJO de parcela, en UTM.
//   2. ESTADO     — `crearEstadoVista(parcela)`. **LO CREA LA APP, NO EL VISOR**
//                   (ver más abajo: es la razón de ser de la ficha del pie).
//   3. PANEL      — `crearPanelAvisos(...)` de `./avisos.js`. Va ANTES del visor
//                   porque el visor necesita su `avisar` como `alAvisar`: si se
//                   creara después, los avisos del PRIMER encuadre (una tesela
//                   del IGN que no carga, la imagen WMS que falla) se irían al
//                   `console.warn` por defecto y el usuario no vería nada.
//   4. VISOR      — `crearVisor(...)` de `../viewer/index.js`. Monta mapa +
//                   capas + tabla de vértices y encuadra sobre la geometría.
//   5. FICHA      — `estado.subscribe(actualizarFicha)` y una primera llamada a
//                   mano (`subscribe` NO notifica al suscribirse).
//   6. GML        — `cablearGeneracionGml(...)` (F04, tarea T6.1). Va EL ÚLTIMO
//                   porque necesita las dos piezas anteriores: el store (de él
//                   sale la geometría que se serializa, y de sus notificaciones
//                   el estado del botón) y el panel (es donde se publican las
//                   detecciones del serializador). Como la ficha, se suscribe y
//                   además se llama a mano una primera vez.
//
// ── POR QUÉ EL STORE LO CREA ESTA FUNCIÓN Y NO `crearVisor` ─────────────────
// `viewer/index.js` documenta que recibe el store ya hecho y NO lo fabrica, para
// que el llamante pueda COMPARTIRLO con otras vistas. Hasta ahora eso era una
// promesa sobre F05/F06; la ficha del pie de este fichero lo convierte en un
// hecho comprobable en producción: es un SEGUNDO suscriptor del MISMO store que
// el mapa y la tabla, y por eso existe. Se edita una coordenada en la tabla →
// `sincronizar` hace `estado.set` → se repintan el polígono del mapa Y la
// superficie del pie, sin que ninguna de las dos vistas sepa de la otra.
//
// ── POR QUÉ SE IMPORTA `viewer/index.js` DIRECTAMENTE Y NUNCA EL BARREL RAÍZ ─
// El barrel raíz `index.js` NO exporta el visor A PROPÓSITO (hallazgo C1/T10):
// `viewer/` y `services/` importan Leaflet, que exige `window`, y el barrel lo
// carga el proyecto Vitest `node`, que corre sin DOM. `test/contrato.test.js`
// vigila ese invariante y su comentario nombra LITERALMENTE esta tarea (la
// entrada demo de la Fase 4) como el momento en que alguien va a querer
// «exportar el visor por el barrel para que la demo lo importe bonito». No se ha
// hecho: aquí se importa `../viewer/index.js`.
//
// La comprobación de cierre de esta tarea es un grep sobre `app/` buscando
// importaciones del barrel raíz, y tiene que salir VACÍO. Por eso este párrafo
// describe el patrón en vez de escribirlo: un comentario que cita el patrón
// literal se convierte él mismo en una coincidencia y convierte un «cero duro»
// en un «cero salvo este falso positivo que hay que leer cada vez».
//   @see test/contrato.test.js  →  describe('contrato F03 · el visor NO sale por
//                                  el barrel raíz (Leaflet exige window)')
//
// ── F04 · LO QUE ESTA CAPA DECIDE Y `gml/` NO PUEDE DECIDIR ─────────────────
// `gml/` es capa de DOMINIO: no importa `model/`, no toca el DOM y no consulta
// el reloj. Eso deja cuatro decisiones huérfanas que sólo pueden tomarse aquí, y
// las cuatro están tomadas en {@link cablearGeneracionGml}:
//
//   1. LA FECHA. `dateTimeCatastro(new Date())` se llama AQUÍ y baja como
//      `beginLifespanVersion`. No es manía: es lo que permite que el test de ida
//      y vuelta de F04 compare un GML entero contra un snapshot — con el reloj
//      dentro del serializador, el fichero cambiaría en cada ejecución. El MISMO
//      instante va a `descargarGml`, para que la marca de tiempo del nombre del
//      fichero y la de su contenido no puedan discrepar.
//
//   2. LA IDENTIDAD. `serializarParcelaCp` EXIGE `refcat` y no se la inventa;
//      `model/parcela.js` tiene `refcat` (que puede ser `null`) y `idLocal` (que
//      nunca lo es). Resolver `refcat ?? idLocal` es de esta capa, y por eso
//      `gml/` no necesita importar `model/`.
//
//   3. EL NAMESPACE INSPIRE. Se deja el defecto `ES.LOCAL.CP` A PROPÓSITO, y no
//      se pone `ES.SDGC.CP` aunque la parcela de demostración venga del Catastro:
//      el fichero que genera el usuario es SU DECLARACIÓN de alta, no el dato
//      oficial de la Sede. `ES.SDGC.CP` es del round-trip (leer el GML del WFS y
//      volver a escribirlo), que es otro caso de uso y vive en los tests.
//      Por lo mismo `nationalCadastralReference` se deja VACÍO: rellenarlo con la
//      referencia convertiría un alta en una declaración falsa de inscripción.
//
//   4. LA TRADUCCIÓN DE SEVERIDADES. `gml/` habla de tres (INFO/AVISO/ERROR) y
//      el panel de dos (ver {@link NIVEL_POR_SEVERIDAD}).
//
// ⚠️ `gml/descargar.js` se importa DIRECTAMENTE, igual que `viewer/index.js` y
// por el mismo motivo: necesita `Blob`/`URL`/`document`, así que está fuera del
// barrel `gml/index.js` (que sí carga el proyecto Vitest `node`, sin DOM). Los
// otros dos módulos de `gml/` también se importan uno a uno en vez de por el
// barrel: así el bundle no arrastra `gml/parse.js`, que hoy no usa nadie en la
// app (lo usará F08).
//
// ── POR QUÉ ESTE FICHERO EXPORTA UNA FUNCIÓN (y es la única que exporta) ────
// Un módulo de entrada normalmente no exporta nada. `cablearGeneracionGml` es la
// excepción, y la razón es que el resto de este fichero se comprueba SOLO (los
// datos, en `test/app/demo-datos.test.js`; el panel, en `avisos.dom.test.js`; el
// visor, en toda la suite de `test/viewer/`), mientras que el cableado del botón
// —validar, serializar, publicar detecciones, descargar y re-evaluar— no se
// comprueba en ningún otro sitio y es la parte de F04 que el usuario ve. Se
// extrae, por tanto, lo justo para poder ejercitarlo con un store y un panel de
// prueba; el resto del ensamblaje sigue siendo código de nivel superior.
//   @see test/app/main-gml.dom.test.js
//
// ── POR QUÉ EL CSS DE LEAFLET SE IMPORTA AQUÍ Y NO EN `viewer/` ─────────────
// `viewer/index.js` declara que NO importa `leaflet/dist/leaflet.css` a
// propósito: el visor es una LIBRERÍA y el CSS es responsabilidad de la ENTRADA
// de la aplicación, que es este fichero. Sin él, el mapa sale descuadrado
// (panes sin `position:absolute`, controles sin caja).
// La otra hoja, `estilos/app.css`, va por `<link>` en `index.html` y NO se
// importa aquí: así la cáscara está vestida en el primer pintado, sin fogonazo
// de HTML crudo en cada recarga de `npm run dev`. El orden entre las dos hojas
// es indiferente por diseño (ver la cabecera de `estilos/app.css`: sus reglas
// sobre cromo de Leaflet suben la especificidad a `.gml-app .gml-mapa`).
//
// ── POR QUÉ NO HAY `import.meta.hot.accept()` ───────────────────────────────
// Un `accept` volvería a ejecutar este módulo sobre un `#mapa` que ya tiene un
// `L.Map` montado, y Leaflet lanzaría «Map container is already initialized»
// (doble montaje). Sin `accept`, Vite hace RECARGA COMPLETA de la página ante
// cualquier cambio, que es exactamente lo que este arranque necesita. Si algún
// día se quiere HMR fino, la vía es `import.meta.hot.dispose(() => visor.destruir())`,
// no `accept` a secas.
//
// ── POR QUÉ NO HAY NINGÚN GLOBAL DE DEPURACIÓN (`window.__gml`) ─────────────
// La sonda de build sí colgaba un `globalThis.__visor`. Aquí no: la verificación
// de esta tarea conduce la UI REAL (se mira el mapa, se cuentan las filas, se
// arrastra el deslizador), y un asa global es una API accidental que alguien
// acabaría usando en serio. Lo que hacía falta comprobar por consola —el riesgo
// nº 1 de la fase, que `mapa.getSize().y > 0`— se lee del DOM sin ningún hook:
// `getSize()` ES `[#mapa.clientWidth, #mapa.clientHeight]` (`Map#getSize` lee el
// contenedor), así que se comprueba con
// `const e = document.getElementById('mapa'); [e.clientWidth, e.clientHeight]`.
//
// ── POR QUÉ NO HAY BOTÓN «DIAGNOSTICAR» ────────────────────────────────────
// La maqueta de diseño lleva un CTA que abre el diagnóstico de F07. F07 no
// existe todavía, y un botón deshabilitado es UI muerta: promete una función que
// nadie puede usar y hay que acordarse de encenderla. Cuando F07 exista, se
// añade entonces.

import 'leaflet/dist/leaflet.css'

import { superficie } from '../geo/area.js'
import { SEVERIDAD, dateTimeCatastro } from '../gml/_comun.js'
import { descargarGml } from '../gml/descargar.js'
import { serializarParcelaCp } from '../gml/serialize-cp.js'
import { validarParcela } from '../validation/parcela.js'
import { crearEstadoVista, NIVEL } from '../viewer/_comun.js'
import { crearVisor } from '../viewer/index.js'
import { crearPanelAvisos } from './avisos.js'
import {
  AVISO_DEMO_HUECO_SINTETICO,
  SRS_DEMO,
  parcelaDemo,
  parcelaDemoConHueco,
} from './demo-datos.js'

// ── Constantes de presentación ───────────────────────────────────────────────

/**
 * Valor de `?demo=` que selecciona el dataset SINTÉTICO con hueco. Es la única
 * vía para verlo: la parcela por defecto es la REAL del Catastro y nunca se le
 * añade un patio inventado encima (ver la cabecera de `./demo-datos.js`).
 */
const DEMO_HUECO = 'hueco'

/** Eyebrow de la cabecera cuando el dataset NO procede del Catastro. */
const EYEBROW_SINTETICA = 'Parcela sintética · demostración'

/** Texto de la ficha cuando la parcela no tiene referencia catastral. */
const SIN_REFCAT = 'Sin referencia'

/**
 * Superficie con dos decimales y separadores españoles (1.019,17). Dos
 * decimales porque es la precisión con la que el Catastro expresa la superficie
 * de parcela; el redondeo es de PRESENTACIÓN y jamás toca el modelo.
 */
const FORMATO_SUPERFICIE = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Enteros con separador de millares español (para el recuento de vértices). */
const FORMATO_ENTERO = new Intl.NumberFormat('es-ES')

// ── Constantes del cableado de F04 ───────────────────────────────────────────

/**
 * Botón «Generar GML» del pie del panel. Es CONTRATO con `index.html` (nace
 * `disabled` allí a propósito: hasta que no se valida la geometría no se sabe si
 * se puede generar). Se exporta para que el test construya su cáscara con el
 * mismo literal en vez de con una copia que pueda divergir.
 */
export const SELECTOR_BOTON_GML = '[data-accion="generar-gml"]'

/**
 * Renglón `role="status"` que va debajo del botón. El lector de pantalla anuncia
 * lo que se escriba aquí sin robar el foco, y su CSS lo colapsa cuando está
 * vacío (`.gml-accion-estado:empty{display:none}`), así que «sin estado» no deja
 * un hueco en el pie. También es contrato con `index.html`.
 */
export const SELECTOR_ESTADO_GML = '[data-estado="generar-gml"]'

/** Modificador de `.gml-accion-estado` para el estado BLOQUEADO (rojo). */
const CLASE_ESTADO_ERROR = 'gml-accion-estado--error'

/**
 * Cuántos motivos DISTINTOS caben en el renglón antes de resumir el resto. El
 * renglón es una línea de 11 px debajo del botón, no un panel: con más de dos
 * mensajes deja de leerse. No es un tope de información —el recuento completo va
 * SIEMPRE delante («3 errores bloquean…»)—, es un tope de longitud.
 */
const MOTIVOS_EN_RENGLON = 2

/**
 * Identidad de último recurso cuando la parcela no tiene NI referencia catastral
 * NI `idLocal`. Con una parcela construida por `model/parcela.js#crearParcela`
 * no puede ocurrir (`idLocal` es obligatorio allí), pero el store admite
 * cualquier POJO y `serializarParcelaCp` LANZA con una `refcat` en blanco: más
 * vale un `<localId>` que dice la verdad que una excepción en un `click`.
 */
const IDENTIDAD_SIN_REFERENCIA = 'SIN-REFERENCIA'

/**
 * Lo que se le dice al usuario cuando la generación revienta por un defecto de
 * programación (contrato roto en `gml/`: SRS no soportado, coordenada no
 * publicable…). No intenta explicar la causa técnica —no le sirve de nada— pero
 * tampoco la esconde: dice qué ha pasado, que NO tiene fichero, y que el detalle
 * está en la consola, que es donde puede copiarlo para reportarlo.
 */
export const MENSAJE_FALLO_INESPERADO =
  'No se ha podido generar el GML por un fallo interno; no se ha descargado ningún ' +
  'fichero. El detalle técnico está en la consola del navegador.'

/**
 * Gemelo del anterior para el momento de la ENTREGA. Se distingue a propósito:
 * aquí el GML SÍ se ha generado bien y lo que ha fallado es la descarga, así que
 * la acción que le toca al usuario es otra (reintentar, mirar los permisos del
 * navegador) y no «tu parcela tiene algo raro».
 */
export const MENSAJE_FALLO_ENTREGA =
  'El GML se ha generado, pero el navegador no ha podido descargarlo. ' +
  'El detalle técnico está en la consola del navegador.'

/**
 * Los dos tramos del recorrido de generación, a efectos de elegir el mensaje
 * cuando algo revienta. No es una máquina de estados: es el mínimo que hace
 * falta para no contarle al usuario que «falló la generación» cuando el GML se
 * generó bien y lo que falló fue la descarga.
 */
const FASE = Object.freeze({ GENERACION: 'GENERACION', ENTREGA: 'ENTREGA' })

/**
 * Traducción de las TRES severidades de `gml/` a los DOS niveles del panel.
 *
 * `INFO` y `AVISO` caen los dos en `NIVEL.AVISO`, y `ERROR` en `NIVEL.ERROR`.
 * Justificación, que es lo que importa aquí:
 *
 *   · `NIVEL.ERROR` significa BLOQUEANTE en toda la app —el panel lo rotula
 *     literalmente «Bloqueante» y el chip rojo cuenta esos—, y en `gml/` una
 *     detección `ERROR` bloquea de verdad: `serializarParcelaCp` devuelve
 *     `xml: null` en cuanto hay una. Los dos vocabularios coinciden en ese punto.
 *   · Un `INFO` de `gml/` NO es «ruido de depuración»: son `ORIENTACION_NORMALIZADA`
 *     (se ha invertido un anillo) y `PUNTO_REFERENCIA_RECALCULADO` (se ha
 *     descartado el punto propuesto). El fichero que baja NO es el dibujo que el
 *     usuario tenía en pantalla, y la regla de oro 1 dice que se entera. Mapearlo
 *     a un tercer nivel «informativo» que el panel no sabe pintar equivaldría a
 *     tirarlo; mapearlo a `ERROR` sería mentir diciendo que algo bloquea.
 *     `AVISO` es el único nivel que dice la verdad: «pasó algo, mira».
 *
 * Derivado de los dos vocabularios, sin literales sueltos: si `SEVERIDAD`
 * creciera, la clave nueva daría `undefined` y {@link cablearGeneracionGml} cae
 * a `NIVEL.AVISO`, que es el suelo seguro (nunca inventa un bloqueo).
 */
const NIVEL_POR_SEVERIDAD = Object.freeze({
  [SEVERIDAD.INFO]: NIVEL.AVISO,
  [SEVERIDAD.AVISO]: NIVEL.AVISO,
  [SEVERIDAD.ERROR]: NIVEL.ERROR,
})

// ── Nodos de la cáscara ──────────────────────────────────────────────────────

/**
 * Nodo de `index.html`, o `throw`. El marcado de la cáscara es CONTRATO (ver la
 * cabecera de `index.html`), así que un selector que no encuentra nada es un bug
 * del programador, no un dato malo: regla de oro 1, se lanza y se nombra el
 * selector. La alternativa —seguir con un `null` y morir cien líneas más allá
 * con «cannot set properties of null»— es justo el fallo ilegible que el
 * proyecto no admite.
 *
 * @param {string} selector
 * @returns {HTMLElement}
 * @throws {Error} Si la cáscara no tiene ese nodo.
 */
function nodo(selector) {
  const encontrado = document.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `app/main.js: la cáscara no tiene ningún nodo '${selector}'. El marcado de ` +
        `index.html es contrato de esta entrada (y de estilos/app.css): si se ha ` +
        `renombrado o movido ese nodo, hay que arreglarlo en index.html, no aquí.`,
    )
  }
  return /** @type {HTMLElement} */ (encontrado)
}

// ── 1 · Datos ────────────────────────────────────────────────────────────────

// `?demo=hueco` es la vía explícita para ver en pantalla un hueco interior, su
// rótulo «HUECO 1» y el recorte de anillos anidados. Cualquier otro valor (o
// ninguno) carga la parcela REAL del Catastro.
const esSintetica = new URLSearchParams(window.location.search).get('demo') === DEMO_HUECO
const parcela = esSintetica ? parcelaDemoConHueco() : parcelaDemo()

// El eyebrow tiene que DECIR que el dato es inventado. Presentar una parcela
// sintética bajo el rótulo «Parcela cargada» sería hacerla pasar por un dato del
// Catastro, y eso el spec no lo permite (nada de maquillar la procedencia).
if (esSintetica) nodo('[data-eyebrow]').textContent = EYEBROW_SINTETICA

// ── 2 · Estado ───────────────────────────────────────────────────────────────

// UN solo store para las TRES vistas: el dibujo del mapa, la tabla de vértices
// y la ficha del pie (ver la cabecera).
const estado = crearEstadoVista(parcela)

// ── 3 · Panel de avisos ──────────────────────────────────────────────────────

// Los dos chips del contador se localizan por `data-contador`, que es el
// contrato de `index.html`: nacen NEUTROS («0 errores» / «0 avisos») y es
// `app/avisos.js` quien pone y quita los modificadores de color.
const panel = crearPanelAvisos({
  contenedor: nodo('#avisos'),
  chipError: nodo('.gml-chip[data-contador="ERROR"]'),
  chipAviso: nodo('.gml-chip[data-contador="AVISO"]'),
})

// El dataset sintético lo dice también EN LA LISTA de avisos, no solo en el
// eyebrow: el eyebrow se lee una vez al abrir y la lista queda.
if (esSintetica) panel.avisar(AVISO_DEMO_HUECO_SINTETICO, { nivel: NIVEL.AVISO })

// ── 4 · Visor ────────────────────────────────────────────────────────────────

crearVisor(nodo('#mapa'), {
  estado,
  // `<div>`, no `<table>`: es la caja con `overflow:auto` contra la que scrollea
  // la cabecera pegajosa. `sincronizar` crea la `<table>` dentro.
  tablaEl: nodo('#tabla-vertices'),
  srs: SRS_DEMO,
  // El ÚNICO camino para que un fallo de red de la cartografía o una celda
  // ilegible acaben en el panel en vez de en el `console.warn` por defecto.
  alAvisar: panel.avisar,
  // Ortofoto PNOA. Coincide con `capas.js#BASE_POR_DEFECTO`, y se pasa igual de
  // forma explícita: es LA capa sobre la que se calca, y que la app diga en voz
  // alta con qué base arranca vale más que ahorrar una línea.
  baseInicial: 'pnoa-ma',
  // ⚠️ DECISIÓN, y va CONTRA el defecto de `montarCapas` (que es `false`). Con
  // `false` la cartografía catastral arranca apagada y, sobre todo, el control
  // de opacidad arranca DESHABILITADO: quien abre la app por primera vez ve un
  // deslizador gris que no se mueve y lo lee como un fallo del programa. Además
  // catastral-en-transparencia-sobre-ortofoto ES la vista que da sentido al
  // producto (calcar), y encenderla cuesta exactamente 1 `GetMap` por encuadre
  // — la capa WMS pide una imagen por encuadre, no un mosaico de teselas.
  superpuestaInicial: true,
  // F06 enchufa aquí `crearHistorial()` de `edit/historial.js`. Hoy `null`
  // EXPLÍCITO (que es también el defecto) para que se vea que el hueco existe y
  // que no está sin decidir: `sincronizar` ya sabe commitear una instantánea por
  // operación acabada, lo que falta es la pila y los atajos de undo/redo.
  historial: null,
})

// ── 5 · Ficha del pie: el SEGUNDO suscriptor del mismo store ─────────────────

const fichaSrs = nodo('[data-ficha="srs"]')
const fichaRefcat = nodo('[data-ficha="refcat"]')
const fichaVertices = nodo('[data-ficha="vertices"]')
const fichaSuperficie = nodo('[data-ficha="superficie"]')

/**
 * Repinta la ficha del pie desde el POJO de parcela. Suscriptor del store: se
 * llama en CADA `estado.set` (una coordenada editada en la tabla, un vértice
 * arrastrado en el mapa) y la superficie se recalcula sola.
 *
 * `superficie` (geo/area.js) es la ÚNICA fuente de la cifra: exterior menos
 * huecos, por la fórmula del polígono sobre UTM. No se cachea y no se reimplementa
 * aquí. Si el modelo llegara con el invariante roto (`recintos[0]` que no es
 * EXTERIOR), `superficie` LANZA a propósito y este suscriptor deja que el error
 * suba: es un bug del programa y tiene que sonar (regla de oro 1), no quedarse en
 * un guion en el pie.
 *
 * El SRS no sale de la parcela: `crearParcela` no porta `srs` (vive en el
 * Expediente), así que se pinta el del dataset, el mismo que se le da al visor.
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {void}
 */
function actualizarFicha(parcelaActual) {
  const recintos = (parcelaActual && parcelaActual.recintos) || []
  const nVertices = recintos.reduce((total, recinto) => total + recinto.vertices.length, 0)

  fichaSrs.textContent = SRS_DEMO
  // `refcat` es `null` en el dataset sintético, y se DICE («Sin referencia») en
  // vez de dejar un guion: un guion se lee como «esto no ha cargado».
  fichaRefcat.textContent = (parcelaActual && parcelaActual.refcat) || SIN_REFCAT
  fichaVertices.textContent = FORMATO_ENTERO.format(nVertices)
  fichaSuperficie.textContent = `${FORMATO_SUPERFICIE.format(superficie(recintos))} m²`
}

estado.subscribe(actualizarFicha)
// `subscribe` NO notifica al suscribirse (ver `crearEstadoVista`): el primer
// pintado se hace a mano, o la ficha se quedaría con los guiones del HTML hasta
// la primera edición.
actualizarFicha(estado.get())

// ── 6 · Generación del GML (F04 · T6.1) ──────────────────────────────────────

/**
 * Referencia catastral REAL de una parcela, o `null` si no tiene.
 *
 * Se comprueba el CONTENIDO y no sólo la presencia: una `refcat` de espacios en
 * blanco no es una referencia, y colarla haría que el nombre del fichero llevara
 * un segmento vacío en vez de decir «sin referencia».
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {string|null}
 */
function referenciaCatastralDe(parcelaActual) {
  const refcat = parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.refcat
  return typeof refcat === 'string' && refcat.trim().length > 0 ? refcat : null
}

/**
 * IDENTIDAD de la parcela para `serializarParcelaCp`: `refcat ?? idLocal ??`
 * {@link IDENTIDAD_SIN_REFERENCIA}. De ella salen el `<localId>` del `inspireId`
 * y la base de los cuatro `gml:id`.
 *
 * NO es lo mismo que la referencia catastral, y por eso son dos funciones:
 *   · la IDENTIDAD nunca puede faltar (el serializador lanza con ella en blanco)
 *     y en un alta de particular es legítimo que sea el `idLocal` del modelo —es
 *     justo el patrón de `UTM_1.gml`, el alta real de un particular;
 *   · la REFERENCIA sí puede faltar, y cuando falta hay que DECIRLO en vez de
 *     rellenar el hueco con la identidad interna. `nombreFicheroGml` ya tiene el
 *     texto para eso («sin-referencia»); dárselo hecho sería tapárselo.
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {string}  Siempre un string no vacío.
 */
function identidadDe(parcelaActual) {
  const idLocal =
    parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.idLocal
  const local = typeof idLocal === 'string' && idLocal.trim().length > 0 ? idLocal : null
  return referenciaCatastralDe(parcelaActual) ?? local ?? IDENTIDAD_SIN_REFERENCIA
}

/**
 * Texto del renglón cuando la VALIDACIÓN bloquea: cuántos errores son y cuáles.
 *
 * El recuento va delante y completo; lo que se recorta es la enumeración (ver
 * {@link MOTIVOS_EN_RENGLON}). Un «no se puede generar» a secas —o, peor, un
 * botón gris y mudo— es un error silencioso de manual: el usuario ve apagado lo
 * único que la pantalla le ofrece hacer y no tiene forma de saber por qué.
 *
 * @param {import('../validation/_comun.js').Hallazgo[]} errores  Lista NO vacía.
 * @returns {string}
 */
function motivoDeBloqueo(errores) {
  const distintos = [...new Set(errores.map((e) => e.mensaje))]
  const visibles = distintos.slice(0, MOTIVOS_EN_RENGLON)
  const resto = distintos.length - visibles.length
  const recuento =
    errores.length === 1
      ? '1 error bloquea la generación del GML'
      : `${errores.length} errores bloquean la generación del GML`
  return (
    `${recuento}: ${visibles.join(' ')}` + (resto > 0 ? ` (…y ${resto} motivo(s) más.)` : '')
  )
}

/**
 * Texto del renglón cuando es el SERIALIZADOR el que no emite fichero. Es un
 * caso distinto del anterior y por eso tiene su propio texto: aquí la validación
 * de F02 dio el visto bueno y lo que ha aparecido es algo que sólo se ve al
 * redondear y al escribir (dos vértices que se funden, un punto de referencia
 * imposible). Decir «hay errores en la parcela» sería confuso; lo que hay es un
 * GML que no se puede escribir bien, y el detalle acaba de entrar en el panel.
 *
 * @param {string[]} bloqueos  `resumen.bloqueos` del serializador (tipos, sin repetir).
 * @returns {string}
 */
function motivoSinFichero(bloqueos) {
  const cuantos =
    bloqueos.length === 1
      ? 'ha aparecido un problema bloqueante'
      : `han aparecido ${bloqueos.length} problemas bloqueantes`
  return (
    `No se ha descargado ningún fichero: al escribir el GML ${cuantos} ` +
    `(${bloqueos.join(', ')}). El detalle está en el panel de avisos.`
  )
}

/**
 * Cablea el botón «Generar GML» del pie: el último metro de F04 y lo único de
 * toda la feature que el usuario llega a ver.
 *
 * ── QUÉ HACE AL PULSAR, EN ORDEN ──
 *   1. VALIDA con `validation/parcela.js`. Si `puedeGenerar` es `false` no se
 *      genera NADA y cada error entra por el panel con su mensaje.
 *   2. SERIALIZA con `gml/serialize-cp.js`.
 *   3. PUBLICA EN EL PANEL **TODAS** las detecciones del serializador. Este paso
 *      no es cosmético: es la regla de oro 1 viviendo aquí. Es la ÚNICA
 *      superficie de la aplicación donde el usuario se entera de que se le ha
 *      redondeado una coordenada, invertido un anillo o recalculado el punto de
 *      referencia — cosas que ocurren en silencio dentro de `gml/` y que hacen
 *      que el fichero que baja NO sea exactamente el dibujo que tenía delante.
 *      La severidad se traduce con {@link NIVEL_POR_SEVERIDAD}.
 *   4. DESCARGA si hay `xml`. Si es `null` lo dice en el renglón y no descarga:
 *      `descargarGml` tampoco bajaría nada (devolvería `SIN_CONTENIDO`), pero
 *      llamarlo para que diga que no puede sería pedirle que rediagnostique algo
 *      que ya sabemos.
 *
 * ── EL ESTADO DEL BOTÓN SE RE-EVALÚA, NO SE FIJA UNA VEZ ──
 * Va por `estado.subscribe`, igual que la ficha del pie, y no sólo al arrancar.
 * F06 permite mover vértices: un botón evaluado una única vez seguiría diciendo
 * «se puede generar» después de que el usuario cruzara el contorno consigo mismo,
 * y esa mentira acabaría en un GML rechazado por la Sede. `subscribe` NO notifica
 * al suscribirse, así que la primera evaluación se hace a mano.
 *
 * ⚠️ CADENCIA. Se valida en CADA `set`. Hoy es correcto (el store sólo cambia al
 * editar una celda de la tabla) y `validation/parcela.js` ya advierte en su
 * cabecera de que en parcelas grandes las reglas topológicas son O(n²) y de que
 * la cadencia de la validación en vivo es responsabilidad de la capa de arriba.
 * El sitio donde eso se resolverá —con un debounce— es F06, cuando el arrastre de
 * un vértice dispare un `set` por movimiento del ratón; hoy un debounce sería
 * complejidad sin caso de uso.
 *
 * ── POR QUÉ EL MANEJADOR NO SE FÍA DE `boton.disabled` ──
 * Vuelve a validar antes de generar. `disabled` es estado de PRESENTACIÓN: lo
 * escribe este mismo módulo a partir de una validación anterior, y entre una y
 * otra puede haber pasado cualquier cosa. Confiar en él sería hacer que la
 * corrección del fichero dependiera de que un atributo del DOM esté al día.
 *
 * @param {object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El MISMO
 *   store que el mapa, la tabla y la ficha.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos ya
 *   montado: por él salen los errores de validación y las detecciones de `gml/`.
 * @param {string} opciones.srs  SRS del expediente (`'EPSG:25830'`…).
 * @param {HTMLElement} [opciones.boton]  Por defecto, el nodo
 *   {@link SELECTOR_BOTON_GML} de la cáscara; si falta, `nodo` LANZA.
 * @param {HTMLElement} [opciones.renglon]  Ídem con {@link SELECTOR_ESTADO_GML}.
 * @param {() => Date} [opciones.ahora]  De dónde sale «ahora». Por defecto el
 *   reloj del sistema. Es un parámetro y no una llamada directa porque la fecha
 *   entra en el GML *y* en el nombre del fichero: poder fijarla es lo que permite
 *   afirmar algo exacto sobre los dos en una prueba. `gml/` no lo puede hacer por
 *   su cuenta (no consulta el reloj, por contrato).
 * @param {typeof descargarGml} [opciones.descargar]  La entrega del fichero.
 * @returns {{generar: () => (object|null), destruir: () => void}}  `generar`
 *   ejecuta el recorrido completo y devuelve el `ResultadoDescarga` (o `null` si
 *   no se llegó a descargar); `destruir` retira el oyente y la suscripción.
 * @throws {TypeError}  Si falta el botón o el renglón en la cáscara (contrato
 *   con `index.html`), vía {@link nodo}.
 */
export function cablearGeneracionGml({
  estado,
  panel,
  srs,
  boton = nodo(SELECTOR_BOTON_GML),
  renglon = nodo(SELECTOR_ESTADO_GML),
  ahora = () => new Date(),
  descargar = descargarGml,
} = {}) {
  /**
   * Escribe el renglón `role="status"`. Vacío + sin modificador es el estado
   * «todo en orden»: el CSS lo colapsa y el pie no da un salto de layout.
   *
   * @param {string} texto
   * @param {boolean} esError
   */
  function decir(texto, esError) {
    renglon.textContent = texto
    renglon.classList.toggle(CLASE_ESTADO_ERROR, esError)
  }

  /**
   * Valida el POJO que haya en el store. El `|| []` no es paranoia: el store
   * admite `null` (es su valor inicial documentado) y `validarParcela` LANZA si
   * no le dan un array — y lo hace con razón, porque para él eso es contrato
   * roto. Aquí «no hay parcela» es un estado legítimo de la app, y la respuesta
   * correcta es un array vacío, que la primera regla traduce a «falta el
   * contorno exterior»: un error del expediente, no una excepción.
   *
   * @param {object|null} parcelaActual
   * @returns {{errores: object[], avisos: object[], puedeGenerar: boolean}}
   */
  function validar(parcelaActual) {
    const recintos = (parcelaActual && parcelaActual.recintos) || []
    return validarParcela(recintos, { srs })
  }

  /** Deja el botón apagado y el renglón diciendo por qué. */
  function bloquear(errores) {
    boton.disabled = true
    decir(motivoDeBloqueo(errores), true)
  }

  /**
   * Suscriptor del store: re-evalúa si se puede generar y lo refleja en el par
   * botón + renglón. Los dos SIEMPRE a la vez — un botón apagado sin motivo al
   * lado es lo que este cableado existe para no producir.
   *
   * @param {object|null} parcelaActual
   */
  function refrescar(parcelaActual) {
    let errores
    let puedeGenerar
    try {
      ;({ errores, puedeGenerar } = validar(parcelaActual))
    } catch (causa) {
      // ── Aquí NO se relanza, y es la única excepción de este módulo ────────
      // `refrescar` corre en dos sitios donde relanzar hace más daño que bien:
      // al CABLEAR (dentro del ensamblaje de `app/main.js`) y desde un
      // `estado.subscribe`. Que `validarParcela` reviente por un dato corrupto
      // —comprobado: con una coordenada no finita lanza desde
      // `geo/huso.js#detectarHuso`— no es hipotético, porque el store admite
      // cualquier POJO sin validarlo.
      //
      // Si esto relanzara, la app entera dejaría de arrancar: no habría mapa, ni
      // tabla, ni ficha, ni panel de avisos. Y el usuario perdería justamente lo
      // que necesita para entender qué tiene mal. Apagar el botón y decirlo
      // conserva todo lo demás en pie, que es lo útil.
      //
      // El defecto NO se tapa: va a la consola por `console.error` y al panel
      // como ERROR. Lo que no hace es llevarse por delante la aplicación.
      boton.disabled = true
      decir(MENSAJE_FALLO_INESPERADO, true)
      panel.avisar(MENSAJE_FALLO_INESPERADO, { nivel: NIVEL.ERROR, causa })
      console.error('[gml] no se ha podido evaluar si la parcela puede generarse:', causa)
      return
    }
    if (puedeGenerar) {
      boton.disabled = false
      decir('', false)
      return
    }
    bloquear(errores)
  }

  /**
   * El recorrido completo. Ver la cabecera de {@link cablearGeneracionGml}.
   *
   * @returns {object|null}  El `ResultadoDescarga` de `gml/descargar.js`, o
   *   `null` si no se llegó a intentar la descarga.
   */
  function generar() {
    // En qué punto del recorrido estamos. Sirve para una sola cosa: elegir el
    // mensaje del `catch`. Se usa un marcador de fase en vez de un `try` anidado
    // alrededor de la entrega porque el anidado NO funciona —lo comprobé
    // rompiéndolo—: el `catch` interior escribe su mensaje, relanza, y el
    // exterior vuelve a capturar la MISMA excepción y pisa el renglón con el
    // mensaje genérico. El usuario acababa leyendo «fallo interno» cuando lo que
    // había fallado era la descarga de un GML perfectamente generado.
    let fase = FASE.GENERACION
    try {
      return recorrido(() => {
        fase = FASE.ENTREGA
      })
    } catch (causa) {
      const mensaje = fase === FASE.ENTREGA ? MENSAJE_FALLO_ENTREGA : MENSAJE_FALLO_INESPERADO
      // ── La red de la regla de oro 1 ───────────────────────────────────────
      // Un CONTRATO ROTO en las capas de abajo no llega como hallazgo: llega
      // como excepción. Y hay un camino MEDIDO, no hipotético, para que ocurra:
      // el store admite cualquier POJO (`crearEstadoVista` no valida nada) y
      // `crearRecinto` sólo protege a quien pase por él, así que una parcela con
      // una coordenada no finita puede acabar dentro. Comprobado ejecutándolo:
      // con un `NaN` en un vértice, `validarParcela` LANZA —no lo deja pasar en
      // silencio— desde `geo/huso.js#detectarHuso` («coordenada no finita»).
      // `serializarParcelaCp` lanza por su cuenta ante un `srs` no soportado o
      // una coordenada no publicable (`|v| >= 1e15`).
      //
      // Sin este `catch`, cualquiera de esas excepciones sube desde un manejador
      // de `click` y el usuario ve un botón que NO HACE NADA: pulsa, no baja
      // ningún fichero y nada le dice por qué. Eso es un error silencioso de
      // manual, y la regla de oro 1 dice que el usuario se entera.
      //
      // Por eso envuelve al recorrido ENTERO y no sólo a la serialización: el
      // primer camino real que encontré entra por la validación, que es el paso
      // 1. Un `catch` alrededor del paso 2 habría sido una red colocada justo
      // donde no está el agujero.
      //
      // Y se RELANZA a propósito: esto es un defecto de programación, así que
      // sigue teniendo que aparecer en la consola y en cualquier recogida de
      // errores. Decirlo al usuario Y relanzarlo atiende a los dos destinatarios;
      // tragárselo sería el otro error de la misma familia.
      decir(mensaje, true)
      panel.avisar(mensaje, { nivel: NIVEL.ERROR, causa })
      throw causa
    }
  }

  /**
   * El recorrido propiamente dicho, sin la red de {@link generar}.
   *
   * @param {() => void} entrandoEnEntrega  Se llama justo antes de intentar la
   *   descarga, para que {@link generar} sepa qué mensaje toca si algo revienta
   *   a partir de ahí. Ver el comentario del `catch`.
   * @returns {object|null}  El `ResultadoDescarga` de `gml/descargar.js`, o
   *   `null` si no se llegó a intentar la descarga.
   */
  function recorrido(entrandoEnEntrega) {
    const parcelaActual = estado.get()

    // ── 1 · Validación ──────────────────────────────────────────────────────
    const { errores, puedeGenerar } = validar(parcelaActual)
    if (!puedeGenerar) {
      // Al panel, uno por uno y con su mensaje: es donde el usuario puede leerlos
      // enteros (el renglón sólo cabe resumir). `e.nivel` ya es `NIVEL.ERROR` —se
      // pasa el del hallazgo en vez de escribirlo, para que las dos capas no
      // puedan divergir.
      for (const e of errores) panel.avisar(e.mensaje, { nivel: e.nivel })
      bloquear(errores)
      return null
    }

    // ── 2 · Serialización ───────────────────────────────────────────────────
    // Un solo instante para el fichero y para su nombre (ver la cabecera del
    // módulo, decisión 1).
    const fecha = ahora()
    const { xml, resumen, detecciones } = serializarParcelaCp({
      recintos: parcelaActual.recintos,
      srs,
      refcat: identidadDe(parcelaActual),
      beginLifespanVersion: dateTimeCatastro(fecha),
      // `namespaceInspire` (ES.LOCAL.CP), `label`, `nationalCadastralReference`
      // (vacío), `puntoReferencia` y `timeStamp` se dejan en su defecto A
      // PROPÓSITO: ver la decisión 3 de la cabecera del módulo.
    })

    // ── 3 · Regla de oro 1: TODO lo que decidió el serializador, al panel ────
    for (const d of detecciones) {
      panel.avisar(d.mensaje, { nivel: NIVEL_POR_SEVERIDAD[d.severidad] ?? NIVEL.AVISO })
    }

    // ── 4 · Entrega ─────────────────────────────────────────────────────────
    if (xml === null) {
      decir(motivoSinFichero(resumen.bloqueos), true)
      return null
    }

    // A partir de aquí el fallo se cuenta con un mensaje DISTINTO: el GML ya está
    // generado y sus detecciones ya están publicadas, así que lo que puede fallar
    // es la descarga (el navegador niega `createObjectURL`, la pestaña se está
    // cerrando). Para el usuario «tu dato no se puede escribir» y «el fichero está
    // bien pero no ha bajado» son cosas distintas y llevan a acciones distintas;
    // un solo mensaje para las dos le haría buscar el problema donde no está.
    entrandoEnEntrega()

    // La REFERENCIA (no la identidad) es lo que va en el nombre del fichero, y
    // la MISMA `fecha` que lleva dentro el `beginLifespanVersion`.
    const entrega = descargar(xml, { refcat: referenciaCatastralDe(parcelaActual), fecha })
    // El desenlace se dice SIEMPRE, salga bien o mal. Cuando falla, `descargarGml`
    // trae un `mensaje` en castellano ya presentable: se muestra tal cual y no se
    // duplica en el panel, porque el panel es para lo que le pasa al DATO y esto
    // es lo que le ha pasado a la ENTREGA.
    decir(
      entrega.descargado ? `Descargado «${entrega.nombre}».` : entrega.mensaje,
      !entrega.descargado,
    )
    return entrega
  }

  boton.addEventListener('click', generar)
  const desuscribir = estado.subscribe(refrescar)
  // Igual que la ficha: `subscribe` NO notifica al suscribirse, así que el primer
  // estado del botón se calcula a mano. Sin esta línea el botón se quedaría en el
  // `disabled` con el que nace en `index.html` —y con el renglón vacío— hasta la
  // primera edición: exactamente el botón gris y mudo que no se admite.
  refrescar(estado.get())

  return {
    generar,
    destruir() {
      boton.removeEventListener('click', generar)
      desuscribir()
    },
  }
}

// Sin nodos explícitos: los localiza `cablearGeneracionGml` con los selectores
// del contrato, y LANZA nombrándolos si `index.html` ha dejado de traerlos.
cablearGeneracionGml({ estado, panel, srs: SRS_DEMO })
