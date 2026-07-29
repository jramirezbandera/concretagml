// viewer/sincronizacion.js — F03 · Tarea 2B.4 (tabla de vértices ↔ dibujo).
//
// ── La idea central: DOS VISTAS DE UN MISMO ESTADO ───────────────────────────
// La tabla no "manda" al mapa, ni el mapa a la tabla. Los dos LEEN el mismo
// store (`viewer/_comun.js#crearEstadoVista`) y los dos ESCRIBEN en él. Un
// cambio —venga de una celda o de un marcador arrastrado— produce un `set`, el
// store notifica, y el render repinta ambas vistas desde el estado resultante.
// Por eso no hay bucle de realimentación (SPEC feature-03, Interacción: "Ambos
// son vistas del mismo estado (sin feedback loop)"): no existe un segundo store
// ni una copia del estado que haya que mantener en espejo. Cuando un suscriptor
// escribe durante la notificación, la GUARDA anti-reentrada del store corta la
// cascada; este módulo se apoya en ella y NO la duplica.
//
// ── Por qué `change` y no `input` (hallazgo C7) ──────────────────────────────
// Las celdas escuchan `change` (fin de edición: blur o Enter), nunca `input`.
// Con `input` se reaccionaría a cada tecla y se mutaría el modelo a media
// edición: al borrar un dígito para escribir otro, el valor intermedio es
// basura (`"43924"` mientras se pasa de `439240` a `439241`), y cada tecla
// generaría un snapshot de historial. `change` reacciona una vez, con el valor
// que el usuario ha dado por bueno.
//
// ── Por qué el render es IDEMPOTENTE ────────────────────────────────────────
// Si el número de recintos y de vértices por recinto no ha cambiado (la
// "forma"), el render actualiza posiciones EN SU SITIO y reutiliza las mismas
// instancias de `L.Marker` y las mismas `<tr>`. Solo reconstruye cuando cambia
// la forma. Esto no es una micro-optimización: es lo que hace posible el
// arrastre (hallazgo C8). Un arrastre son decenas de eventos `drag`; si cada
// uno recreara el marcador que el usuario tiene agarrado, el gesto se perdería
// a mitad. Además, reutilizar las filas conserva el foco y la selección de
// texto de la celda que se está editando.
//
// ── Por qué `L.divIcon` y no `L.Icon` (hallazgo C8) ─────────────────────────
// `L.Icon` depende de los PNG que Leaflet trae en `dist/images`; con Vite esas
// URLs se rompen si no se configuran los assets a mano. Un `divIcon` con estilo
// en línea no descarga nada, así que el vértice se ve igual en dev, en build y
// en jsdom. El color es `COLOR_USUARIO` (amarillo `#FFD600` desde la revisión
// visual de la Fase 5): la saturación se reserva a la geometría del usuario, y
// es el único tono que no colisiona ni con el rojo de la cartografía catastral,
// ni con el azul de la hidrografía, ni con el verde de la vegetación de la
// ortofoto. La razón completa está en `viewer/_comun.js#COLOR_USUARIO`.
// El borde blanco de 2 px del cuadradito no es adorno: es lo que sostiene el
// contraste cuando el amarillo cae sobre asfalto o cubierta clara.
//
// ── Qué es de F06, qué sigue sin estar aquí, y por dónde se enchufa ─────────
// Insertar o eliminar vértices, crear o borrar recintos, offset de lindero,
// CALCULAR el snap y MEDIR las acotaciones son EDICIÓN (F06) y siguen sin estar
// aquí: este módulo no sabe qué es una diana, ni una tolerancia, ni un metro
// cuadrado, y sigue sin tener ningún botón de "añadir vértice" (sería colar
// media feature ajena en el visor). Lo que sí hay desde F06 · T3.1 son TRES
// ENCHUFES OPCIONALES por los que la edición se cuelga encima sin que esta
// función cambie de responsabilidad:
//   · `ajustar` .......... se le da el UTM CRUDO de cada frame y devuelve el
//     punto que debe escribirse. Aquí no vive el snap; vive el sitio exacto
//     donde hay que llamarlo (cada `drag` y también el `dragend`).
//   · `alPrevisualizar` .. se le dan los anillos EN VUELO para que las vistas en
//     vivo (acotaciones, superficie/perímetro/Δcatastral) se pinten durante el
//     gesto sin que nadie tenga que tocar el store.
//   · `alCrearMarcador` .. se le entrega cada `L.Marker` recién creado para que
//     la interacción de edición le cuelgue sus propios manejadores.
// Los tres valen `null` por defecto, y con los tres a `null` el comportamiento
// es EXACTAMENTE el de F03. Lo que ninguno de ellos cambia es la regla que
// sostiene el criterio 5 de F06 («undo/redo revierten operaciones completas, no
// fotogramas del arrastre»): se llaman POR FRAME, pero ninguno escribe en el
// store ni commitea. El gesto sigue dejando UN `set` y UN `commit`, en `dragend`.
//
// ── Frontera de vista (regla 3) ─────────────────────────────────────────────
// El modelo va SIEMPRE en UTM. lat/lon aparece solo para pintar, y solo a
// través de `vertUTMaLatLng`/`recintoALatLng`/`latLngAUTM` de `_comun.js`.
// Nada de lat/lon se escribe nunca en el estado.
//
// SOLO-NAVEGADOR: este módulo importa Leaflet, así que su test es
// `*.dom.test.js` y NUNCA entra por el barrel raíz `index.js` (rompería la
// suite `node`: Leaflet exige `window`).

import L from 'leaflet'

import {
  COLOR_USUARIO,
  NIVEL,
  PANE,
  latLngAUTM,
  recintoALatLng,
  resolverAvisar,
  vertUTMaLatLng,
} from './_comun.js'
import { parsearCoordenada } from './celda.js'
import { commit as commitHistorial } from '../edit/historial.js'
import { HUSOS_VALIDOS } from '../geo/huso.js'

// ── Constantes ───────────────────────────────────────────────────────────────

/** Panes que este módulo necesita para colocar sus capas. */
const PANES_REQUERIDOS = Object.freeze([
  PANE.PARCELA_OFICIAL,
  PANE.PARCELA_EDITADA,
  PANE.VERTICES,
])

/**
 * Decimales con los que se MUESTRA una coordenada en la tabla (mm = 1 milímetro).
 *
 * ── Por qué esto NO incumple la regla de oro 11 (justificación explícita, para
 * que nadie lo "arregle" al revés) ───────────────────────────────────────────
 * La regla 11 dice: «modelo en float64 completo, **sin redondear entre
 * ediciones**; redondear a 2 decimales solo al serializar». Y aquí el valor que
 * la celda muestra ESTÁ redondeado a 3 decimales, de modo que al commitear una
 * edición de celda entra en el modelo el valor REDONDEADO — un redondeo entre
 * ediciones. Es DELIBERADO y defendible:
 *   · El valor que se commitea es el que **el usuario ha tecleado**, no un
 *     resultado calculado: no hay precisión previa que destruir, la hay que
 *     RESPETAR, y el usuario teclea a lo sumo milímetros.
 *   · La salida GML lleva **2 decimales** (centímetro, override O6), así que 3
 *     decimales van un orden de magnitud por debajo de lo publicable.
 *   · El texto que genera vuelve a entrar por `parsearCoordenada` **sin
 *     pérdida** (separador '.'), así que el ciclo mostrar→leer es estable y no
 *     va acumulando deriva edición tras edición.
 *   · Lo que la regla 11 prohíbe de verdad —redondear la geometría entre
 *     operaciones GEOMÉTRICAS (offset, snap, arrastre)— NO pasa aquí: el
 *     arrastre escribe el UTM completo que sale de `latLngAUTM`, sin pasar por
 *     `formatearCoordenada`. Solo la celda tecleada redondea.
 * Mostrar float64 crudo en la celda (`439240.00000000006`) sería ilegible y
 * empujaría al usuario a "corregirlo" a mano; sería peor, no más fiel.
 */
const DECIMALES_VISIBLES = 3

/** Lado del cuadradito de vértice, en px CSS. */
const LADO_VERTICE_PX = 10

/** Neutro sobrio para la geometría OFICIAL: es la referencia, no lo editable. */
const COLOR_OFICIAL = '#6B7280'

/** Clases CSS del cromo de la tabla (estables: Fase 3 y F06 estilan sobre ellas). */
const CLASE = Object.freeze({
  TABLA: 'gml-tabla-vertices',
  GRUPO: 'gml-grupo-recinto',
  FILA_RECINTO: 'gml-fila-recinto',
  FILA_VERTICE: 'gml-fila-vertice',
  FILA_VACIA: 'gml-fila-vacia',
  CELDA_INDICE: 'gml-celda-indice',
  CELDA_X: 'gml-celda-x',
  CELDA_Y: 'gml-celda-y',
  INPUT: 'gml-input-coordenada',
  VERTICE: 'gml-vertice',
})

// ── Helpers de módulo (puros) ────────────────────────────────────────────────

/** Describe un valor para un mensaje de contrato roto. */
function describir(valor) {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/**
 * Rótulo legible del recinto `i`. `recintos[0]` es SIEMPRE el EXTERIOR
 * (invariante de `model/parcela.js`); los siguientes son huecos, numerados
 * desde 1 para el usuario.
 *
 * @param {number} i
 * @returns {string}
 */
function rotuloRecinto(i) {
  return i === 0 ? 'EXTERIOR' : `HUECO ${i}`
}

/**
 * Anillos UTM (abiertos) del estado, como array por recinto. Un estado nulo o
 * sin recintos da `[]`; un recinto sin `vertices` cuenta como anillo vacío (NO
 * se filtra: filtrarlo desplazaría los índices y `RefVertice` dejaría de casar).
 *
 * @param {object|null} parcela
 * @returns {Array<Array<[number, number]>>}
 */
function anillosDe(parcela) {
  const recintos = parcela && Array.isArray(parcela.recintos) ? parcela.recintos : []
  return recintos.map((r) => (r && Array.isArray(r.vertices) ? r.vertices : []))
}

/**
 * Copia PROPIA de unos anillos UTM: array nuevo por recinto y par `[x,y]` nuevo
 * por vértice. Existe por dos motivos distintos, y los dos importan:
 *
 *   · **El espejo interno.** `anillosDe` devuelve los MISMOS arrays `vertices`
 *     del estado (solo el array exterior es nuevo). El espejo UTM que este módulo
 *     muta punto a punto durante el `drag` no puede ser eso: mutarlo escribiría en
 *     el POJO del store a espaldas de `set`, y el arrastre dejaría de ser "sin
 *     tocar el modelo hasta soltar" sin que ningún `set` lo delatara.
 *   · **Lo que se entrega a `alPrevisualizar`.** Tampoco puede ser el espejo vivo:
 *     un consumidor que lo mutara (o que se lo guardara) movería el polígono que
 *     se está pintando, desde fuera y sin pasar por aquí.
 *
 * El coste asumido es una copia POR FRAME de decenas de pares —una parcela son
 * decenas de vértices, no millones—, despreciable al lado de la reproyección y
 * del repintado de Leaflet que ya ocurren en ese mismo frame. La alternativa
 * (entregar la referencia interna y confiar) cambia un coste medible por un fallo
 * imposible de depurar.
 *
 * @param {Array<Array<[number, number]>>} anillos
 * @returns {Array<Array<[number, number]>>}
 */
function copiaAnillos(anillos) {
  return anillos.map((anillo) => anillo.map((v) => [v[0], v[1]]))
}

/**
 * El `originalEvent` de un evento de Leaflet, o `null`.
 *
 * Leaflet lo trae en `drag` (sale del `mousemove`/`touchmove` real), pero NO en
 * `dragend`, y tampoco cuando el gesto se simula por API (`marcador.fire('drag')`,
 * que es como lo prueban los tests: jsdom no tiene hit-testing). El consumidor
 * lee de ahí la tecla que desactiva el snap, así que `null` significa exactamente
 * «no hay teclado que consultar», y nunca debe confundirse con «sin modificador
 * pulsado»: por eso se normaliza aquí a `null` en vez de dejar pasar `undefined`.
 *
 * @param {object} [evento]  Evento de Leaflet.
 * @returns {Event|null}
 */
function eventoOriginalDe(evento) {
  return (evento && evento.originalEvent) || null
}

/** Forma del estado: nº de vértices por recinto. `[4, 4]` para exterior + 1 hueco. */
function formaDe(parcela) {
  return anillosDe(parcela).map((a) => a.length)
}

/** ¿Misma forma? (mismo nº de recintos y mismo nº de vértices en cada uno). */
function mismaForma(a, b) {
  if (a === null || b === null) return false
  return a.length === b.length && a.every((n, i) => n === b[i])
}

/**
 * Texto con el que una coordenada se muestra en la celda: hasta
 * {@link DECIMALES_VISIBLES} decimales, sin ceros de relleno.
 *
 * @param {number} valor
 * @returns {string}
 */
function formatearCoordenada(valor) {
  if (!Number.isFinite(valor)) return ''
  return String(Number(valor.toFixed(DECIMALES_VISIBLES)))
}

/**
 * ¿El objeto es el historial de `edit/historial.js` (`{pila, indice, limite}`)?
 *
 * Una SOLA forma admitida, la real (hallazgo 2.13 de la auditoría de coherencia).
 * Antes se aceptaba además "un objeto con método `commit(estado)`" como
 * adaptador: una unión de tipos que `edit/historial.js` no conoce (su API es
 * FUNCIONAL: `commit(historial, estado)`) y cuya rama de objeto-con-método **no
 * tenía ningún productor en todo el repo** — solo el doble de un test. Rama
 * muerta eliminada: menos superficie que mantener y un contrato que coincide con
 * el módulo que lo produce.
 *
 * @param {*} h
 * @returns {boolean}
 */
function esHistorialUsable(h) {
  return !!h && typeof h === 'object' && Array.isArray(h.pila)
}

// ── API ──────────────────────────────────────────────────────────────────────

/** @typedef {import('./_comun.js').RefVertice} RefVertice */

/**
 * Gancho de AJUSTE (el snap de F06, visto desde aquí).
 *
 * Se llama en CADA `drag` y también en `dragend`, SIEMPRE antes de escribir nada
 * —ni en el dibujo, ni en la tabla, ni en el modelo—, con el par UTM crudo que
 * sale del cursor. Devuelve el punto que debe usarse en su lugar.
 *
 * Que se llame **también en `dragend`** no es simetría decorativa: `dragend`
 * recalcula el UTM desde `marcador.getLatLng()`, así que si solo se ajustara en
 * `drag`, lo que acabaría en el modelo sería el punto CRUDO del último
 * movimiento y el vértice **se despegaría justo al soltar** — el enganche se
 * vería durante todo el gesto y se perdería en el instante de confirmarlo.
 *
 * Si lanza, el arrastre NO se cae: se avisa (una vez por gesto) y se sigue con
 * el punto crudo. Si devuelve un `punto` que no es un par UTM finito, se ignora
 * con aviso: un `NaN` colado por aquí acabaría en el modelo en el `dragend`.
 *
 * @callback Ajustar
 * @param {[number, number]} utm  Punto crudo del cursor, en UTM.
 * @param {RefVertice} refVertice  Vértice que se está moviendo.
 * @param {Event|null} eventoOriginal  `e.originalEvent` de Leaflet cuando lo hay
 *   (de ahí lee el consumidor `altKey`, la tecla que desactiva el snap), o `null`
 *   cuando el gesto se simula por API y Leaflet no lo trae (ver
 *   {@link eventoOriginalDe}).
 * @returns {{punto: [number, number], enganchado: boolean, tipo?: string|null}|null}
 *   `null`, o `enganchado:false`, ⇒ se usa el `utm` CRUDO.
 */

/**
 * Gancho de PREVISUALIZACIÓN: las vistas en vivo de F06 (acotación de cada lado,
 * superficie, perímetro, Δ respecto a la catastral).
 *
 * Se llama en dos momentos, y la diferencia la marca `refVertice`:
 *   · en cada `drag`, con los anillos EN VUELO —los que aún no han pasado por el
 *     store— y el vértice que se está moviendo;
 *   · al final de cada `render()`, con los anillos DEL ESTADO y `refVertice:null`,
 *     para que las vistas arranquen pintadas y se re-sincronicen tras un `set`
 *     venga de donde venga.
 *
 * Recibe UTM (`[[ [x,y], … ], … ]`, un array por recinto), no lat/lng: la
 * frontera de vista no se mueve (regla 3). Los anillos son una COPIA (ver
 * {@link copiaAnillos}); mutarlos no afecta a nada.
 *
 * @callback AlPrevisualizar
 * @param {Array<Array<[number, number]>>} anillosUTM
 * @param {RefVertice|null} refVertice
 * @returns {void}
 */

/**
 * Gancho de CREACIÓN DE MARCADOR: la interacción de edición de F06 (menú de
 * vértice, insertar/eliminar, selección de lado) le cuelga sus manejadores.
 *
 * Se llama una vez por `L.Marker`, dentro de `crearMarcador` y por tanto solo
 * cuando se RECONSTRUYE (el render en sitio reutiliza las instancias a
 * propósito: hallazgo C8). El `refVertice` que recibe es el mismo objeto que
 * cuelga del marcador.
 *
 * @callback AlCrearMarcador
 * @param {import('leaflet').Marker} marcador
 * @param {RefVertice} refVertice
 * @returns {void}
 */

/**
 * Cablea la tabla de vértices con el dibujo del mapa: ambos como vistas del
 * mismo `estado` (ver cabecera del módulo).
 *
 * Pinta, en los panes del visor:
 *   · `parcelaEditada` — UN `L.polygon` con anillos anidados
 *     `[exterior, ...huecos]`. Leaflet recorta el segundo anillo y siguientes
 *     como HUECOS: eso es exactamente el modelo de `recintos[]`.
 *   · `parcelaOficial` — si el estado trae `geometriaOficial` (la del Catastro,
 *     congelada por `model/parcela.js`), otro polígono más sobrio, sin
 *     marcadores: es la referencia, no lo editable. Nunca se muta.
 *   · `vertices` — un `L.Marker` `draggable` con `L.divIcon` por vértice de
 *     CADA recinto.
 *
 * Y es dueña de TODO el interior de `tablaEl` (cabecera incluida). Estructura
 * del DOM que genera —contrato estable para la Fase 3 y F06—:
 *
 * ```html
 * <table class="gml-tabla-vertices">        <!-- si tablaEl ya es <table>, es él mismo -->
 *   <thead><tr><th>Nº</th><th>X (m)</th><th>Y (m)</th></tr></thead>
 *   <tbody class="gml-grupo-recinto" data-recinto="0">
 *     <tr class="gml-fila-recinto"><th colspan="3">EXTERIOR</th></tr>
 *     <tr class="gml-fila-vertice" data-recinto="0" data-indice="0">
 *       <th class="gml-celda-indice" scope="row">1</th>
 *       <td class="gml-celda-x"><input type="text" data-eje="x" …></td>
 *       <td class="gml-celda-y"><input type="text" data-eje="y" …></td>
 *     </tr>
 *     …
 *   </tbody>
 *   <tbody class="gml-grupo-recinto" data-recinto="1">
 *     <tr class="gml-fila-recinto"><th colspan="3">HUECO 1</th></tr> …
 *   </tbody>
 * </table>
 * ```
 *
 * Selectores que el resto del proyecto debe usar (SIEMPRE con raíz en `tablaEl`,
 * así da igual que `tablaEl` sea el `<table>` o un contenedor):
 *   · grupos por recinto ....... `tbody[data-recinto]`
 *   · filas de vértice ......... `tr[data-indice]`  (o `tr[data-recinto][data-indice]`)
 *   · celda X / Y de una fila .. `input[data-eje="x"]` / `input[data-eje="y"]`
 *
 * La pareja `data-recinto` / `data-indice` de cada fila ES la `RefVertice`
 * `{recinto, indice}` de `validation/_comun.js` (índice 0-based en el anillo
 * ABIERTO): la misma clave con la que F02 señala vértices con problemas, para
 * que el resaltado case sin traducción. OJO: la columna "Nº" muestra
 * `indice + 1` (los humanos cuentan desde 1); `data-indice` es 0-based.
 *
 * Política de errores (SPEC §2 regla 1):
 *   · Dato malo del USUARIO (celda ilegible) → `avisar(motivo)`, se revierte el
 *     input al valor del modelo y el estado NO se toca. Nunca `throw`, nunca
 *     un `NaN` en el modelo.
 *   · Contrato roto por el PROGRAMADOR (falta `mapa`, `tablaEl` no es un
 *     elemento, `zona` fuera de 29/30/31, falta un pane) → `throw`.
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa  Mapa ya creado (`viewer/mapa.js`).
 * @param {Record<string, HTMLElement>} args.panes  Panes del visor por nombre.
 *   Se admite también que los panes existan solo en el mapa (`mapa.getPane`).
 * @param {import('./_comun.js').EstadoVista} args.estado  Store de
 *   `crearEstadoVista`. Compartido con el resto de vistas: NO se crea otro.
 * @param {HTMLElement} args.tablaEl  El `<table>` de vértices, o el contenedor
 *   donde crearlo. Su interior pertenece por completo a esta función.
 * @param {number} args.zona  Huso UTM (29, 30 o 31).
 * @param {import('../edit/historial.js').Historial|null} [args.historial=null]
 *   El historial de `edit/historial.js` (`{pila, indice, limite}`, el POJO que
 *   devuelve `crearHistorial`), o `null`. Se registra con la función libre
 *   `commit(historial, estado)` — la API de ese módulo es funcional. Un `commit`
 *   por OPERACIÓN ACABADA, nunca por frame de arrastre.
 * @param {import('./_comun.js').Avisar} [args.alAvisar]  Canal de aviso (ver
 *   `resolverAvisar`).
 * @param {Ajustar|null} [args.ajustar=null]  Gancho de ajuste/snap (F06). Ver
 *   {@link Ajustar}. `null` = el punto del cursor entra crudo, como en F03.
 * @param {AlPrevisualizar|null} [args.alPrevisualizar=null]  Gancho de vistas en
 *   vivo (F06). Ver {@link AlPrevisualizar}.
 * @param {AlCrearMarcador|null} [args.alCrearMarcador=null]  Gancho de creación
 *   de marcador (F06). Ver {@link AlCrearMarcador}.
 * @returns {{ destruir: () => void, refrescar: () => void }}
 */
export function sincronizar({
  mapa,
  panes,
  estado,
  tablaEl,
  zona,
  historial = null,
  alAvisar,
  ajustar = null,
  alPrevisualizar = null,
  alCrearMarcador = null,
} = {}) {
  // ── Contratos del programador: throw, nunca corrección callada ────────────
  if (!mapa || typeof mapa.addLayer !== 'function' || typeof mapa.removeLayer !== 'function') {
    throw new TypeError(
      `sincronizar: 'mapa' debe ser un L.Map (con addLayer/removeLayer); recibido ${describir(mapa)}.`,
    )
  }
  if (
    !estado ||
    typeof estado.get !== 'function' ||
    typeof estado.set !== 'function' ||
    typeof estado.subscribe !== 'function'
  ) {
    throw new TypeError(
      `sincronizar: 'estado' debe ser el store de crearEstadoVista ({get,set,subscribe}); ` +
        `recibido ${describir(estado)}.`,
    )
  }
  if (
    !tablaEl ||
    typeof tablaEl !== 'object' ||
    typeof tablaEl.appendChild !== 'function' ||
    typeof tablaEl.addEventListener !== 'function'
  ) {
    throw new TypeError(
      `sincronizar: 'tablaEl' debe ser un elemento del DOM; recibido ${describir(tablaEl)}.`,
    )
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `sincronizar: 'zona' inválida: ${JSON.stringify(zona)}. Válidas: ${HUSOS_VALIDOS.join(', ')}.`,
    )
  }
  for (const nombre of PANES_REQUERIDOS) {
    const enArgumento = panes && typeof panes === 'object' ? panes[nombre] : null
    const enMapa = typeof mapa.getPane === 'function' ? mapa.getPane(nombre) : null
    if (!enArgumento && !enMapa) {
      // TypeError (no un `Error` desnudo, hallazgo 2.10): es la MISMA clase de
      // fallo que los tres de arriba —un argumento del programador que no tiene
      // la forma requerida—, no un valor fuera de un dominio enumerado (eso es
      // `zona`, y por eso `zona` sí es RangeError). Era el único `throw` sin
      // tipo de los siete módulos de la fase.
      throw new TypeError(
        `sincronizar: falta el pane '${nombre}'. Créalos con los nombres de ` +
          `viewer/_comun.js#PANES antes de sincronizar (los vértices deben quedar ` +
          `SIEMPRE sobre la geometría, y la editada sobre la oficial).`,
      )
    }
  }
  if (historial !== null && historial !== undefined && !esHistorialUsable(historial)) {
    throw new TypeError(
      `sincronizar: 'historial' debe ser el POJO de crearHistorial ` +
        `({pila, indice, limite}) o null; recibido ${describir(historial)}.`,
    )
  }
  // Los ganchos de F06: misma política que `resolverAvisar`. "No me han pasado
  // gancho" es un caso legítimo (F03 no tiene ninguno) y cae al `null` por
  // defecto; "me han pasado basura donde iba una función" es un contrato roto
  // por el PROGRAMADOR, y eso en este proyecto es `throw`, nunca corrección
  // callada (regla de oro 1).
  for (const [nombre, gancho] of [
    ['ajustar', ajustar],
    ['alPrevisualizar', alPrevisualizar],
    ['alCrearMarcador', alCrearMarcador],
  ]) {
    if (gancho !== null && typeof gancho !== 'function') {
      throw new TypeError(
        `sincronizar: '${nombre}' debe ser una función, o null/undefined para no ` +
          `enchufar nada; recibido ${describir(gancho)}.`,
      )
    }
  }

  const avisar = resolverAvisar(alAvisar)
  const doc = tablaEl.ownerDocument || document

  // ── Estilos (una instancia por sincronización) ────────────────────────────
  const estiloEditada = {
    pane: PANE.PARCELA_EDITADA,
    color: COLOR_USUARIO,
    weight: 2,
    opacity: 1,
    fillColor: COLOR_USUARIO,
    fillOpacity: 0.12,
  }
  const estiloOficial = {
    pane: PANE.PARCELA_OFICIAL,
    color: COLOR_OFICIAL,
    weight: 1,
    opacity: 0.9,
    dashArray: '4 3',
    fill: false,
    interactive: false,
  }
  // Un solo divIcon compartido por todos los marcadores: `createIcon()` fabrica
  // un elemento nuevo en cada uso, así que compartirlo es seguro y más barato.
  const iconoVertice = L.divIcon({
    className: CLASE.VERTICE,
    iconSize: [LADO_VERTICE_PX, LADO_VERTICE_PX],
    iconAnchor: [LADO_VERTICE_PX / 2, LADO_VERTICE_PX / 2],
    html:
      `<span style="display:block;box-sizing:border-box;` +
      `width:${LADO_VERTICE_PX}px;height:${LADO_VERTICE_PX}px;` +
      `background:${COLOR_USUARIO};border:2px solid #fff;border-radius:2px;` +
      `box-shadow:0 0 0 1px rgba(0,0,0,.35);"></span>`,
  })

  // ── Estado interno de la vista ────────────────────────────────────────────
  let vivo = true
  /** Gesto de arrastre en curso: el suscriptor NO debe re-renderizar en medio. */
  let arrastrando = false
  /**
   * Notificación del store IGNORADA durante un gesto, pendiente de drenar.
   *
   * Hallazgo 2.11 de la auditoría de coherencia: el suscriptor DIFIERE el render
   * en vez de DESCARTARLO. Con el descarte, si un gesto nunca terminaba (`drag`
   * sin `dragend` —p. ej. el puntero sale de la ventana y el navegador no emite
   * `dragend`—) la bandera `arrastrando` se quedaba alta y esta vista dejaba de
   * repintar **para siempre y en silencio**: un `set` de otra vista no se veía
   * nunca más. Ahora lo ignorado queda apuntado y se drena en `dragend`, así que
   * lo peor que puede pasar es un repintado tardío, no una vista muerta.
   */
  let renderPendiente = false
  /** Forma del último render (`null` = aún no se ha renderizado nada). */
  let forma = null
  /** Anillos en `[lat,lng]`, espejo de lo que hay pintado. Se muta punto a punto en `drag`. */
  let anillosLatLng = []
  /**
   * Anillos en UTM `[x,y]`, el MISMO espejo que `anillosLatLng` pero del lado del
   * modelo. Se muta punto a punto en `drag`, en paralelo con él.
   *
   * Por qué un segundo espejo y no reproyectar los anillos en cada frame para
   * `alPrevisualizar`: reproyectar el anillo entero por frame es caro (una serie
   * de Krüger por vértice y por frame, con decenas de vértices) y además IMPRECISO
   * —el viaje UTM→lat/lon→UTM de los vértices quietos les mete ruido en los
   * últimos decimales, y las acotaciones en vivo son justo lo que lo notaría—.
   * La otra alternativa, partir de los anillos del estado y sustituir solo el
   * vértice en vuelo, es exacta pero copia el estado entero por frame y obliga a
   * recordar que el estado va con un frame de retraso durante el gesto. Un espejo
   * mantenido en O(1) por frame, hermano del que ya existía para lat/lng, es lo
   * barato y lo exacto a la vez. Es COPIA PROPIA, nunca los arrays del estado
   * (ver {@link copiaAnillos}).
   */
  let anillosUTM = []
  /** `marcadores[recinto][indice]` → L.Marker. */
  let marcadores = []
  /** `filas[recinto][indice]` → `{fila, inputX, inputY}`. */
  let filas = []
  let poligonoEditado = null
  let poligonoOficial = null

  // ── Ganchos opcionales de F06 (ver cabecera del módulo) ───────────────────
  //
  // Los tres son CONSEJOS o VISTAS colgadas del gesto, nunca el gesto: ninguno
  // escribe en el store ni commitea, así que ninguno puede añadir un snapshot al
  // historial (criterio 5 de F06). Y ninguno puede tumbar un arrastre a medias:
  // las tres llamadas van envueltas en `try/catch`, se AVISA (regla de oro 1:
  // nada en silencio) y el gesto continúa con el dato crudo.
  //
  // El aviso es UNA VEZ POR EPISODIO, no por frame: un `ajustar` roto se llama
  // decenas de veces en un solo arrastre, y cien mensajes idénticos dejarían el
  // panel de avisos inservible — que es otra forma de silencio. Episodio =
  //   · el GESTO de arrastre, para `ajustar` y `alPrevisualizar` (se reinicia al
  //     arrancar el gesto siguiente, así que un fallo que persiste se vuelve a
  //     contar: no se enmudece para siempre);
  //   · la RECONSTRUCCIÓN completa, para `alCrearMarcador` (su bucle es por
  //     vértice: ocho marcadores no pueden dar ocho avisos idénticos).

  /** Ganchos que ya han avisado dentro del episodio en curso. */
  const yaAvisado = { ajustar: false, previsualizar: false, crearMarcador: false }

  /**
   * Avisa por el canal del visor SOLO la primera vez del episodio.
   *
   * Siempre `NIVEL.AVISO` y nunca `NIVEL.ERROR`: la regla junto al typedef
   * `Avisar` de `_comun.js` reserva ERROR a lo que impide seguir, y aquí se sigue
   * —con el punto crudo, o sin la vista en vivo—; el modelo queda intacto y el
   * GML se puede generar igual.
   *
   * @param {'ajustar'|'previsualizar'|'crearMarcador'} clave
   * @param {string} mensaje
   * @param {*} [causa]
   */
  function avisarUnaVez(clave, mensaje, causa) {
    if (yaAvisado[clave]) return
    yaAvisado[clave] = true
    if (causa === undefined) avisar(mensaje, { nivel: NIVEL.AVISO })
    else avisar(mensaje, { nivel: NIVEL.AVISO, causa })
  }

  /** Abre un episodio de avisos de gancho nuevo (uno por gesto de arrastre). */
  function abrirEpisodioDeGesto() {
    yaAvisado.ajustar = false
    yaAvisado.previsualizar = false
  }

  /**
   * Levanta la bandera de gesto y, si el gesto es NUEVO, le abre su episodio de
   * avisos.
   *
   * Se llama desde el primer `drag` además de desde `dragstart`, porque
   * `dragstart` no llega cuando el arrastre se simula por API (los tests) y sin
   * esto los contadores de aviso se quedarían con los del gesto anterior.
   */
  function iniciarGesto() {
    if (!arrastrando) abrirEpisodioDeGesto()
    arrastrando = true
  }

  /**
   * El punto que debe acabar en el dibujo y en el modelo para este frame: el que
   * devuelva `ajustar` si ha enganchado, o el CRUDO en todos los demás casos
   * (sin gancho, `null`, `enganchado:false`, excepción, o punto no finito).
   *
   * @param {[number, number]} utm  Par UTM crudo, recién salido de `latLngAUTM`.
   * @param {RefVertice} refVertice
   * @param {Event|null} eventoOriginal
   * @returns {{punto: [number, number], enganchado: boolean}}
   */
  function ajustarPunto(utm, refVertice, eventoOriginal) {
    if (!ajustar) return { punto: utm, enganchado: false }

    let resultado = null
    try {
      resultado = ajustar(utm, refVertice, eventoOriginal)
    } catch (causa) {
      avisarUnaVez(
        'ajustar',
        'El ajuste automático (snap) ha fallado: el vértice se está moviendo a la ' +
          'posición exacta del cursor, sin engancharse a nada.',
        causa,
      )
      return { punto: utm, enganchado: false }
    }

    if (!resultado || resultado.enganchado !== true) return { punto: utm, enganchado: false }

    const punto = resultado.punto
    if (!Array.isArray(punto) || !Number.isFinite(punto[0]) || !Number.isFinite(punto[1])) {
      // Un guardián que no guarda no sirve de nada (misma razón, y mismo estilo,
      // que en `_comun.js#latLngAUTM`): sin esta comprobación un
      // `{enganchado:true, punto:[NaN,NaN]}` entraría TAL CUAL en el modelo en el
      // `dragend`, que es exactamente lo que la regla de oro 1 prohíbe.
      avisarUnaVez(
        'ajustar',
        'El ajuste automático (snap) ha devuelto un punto que no es un par UTM ' +
          `finito (${JSON.stringify(punto)}): se usa la posición del cursor.`,
      )
      return { punto: utm, enganchado: false }
    }
    return { punto: [punto[0], punto[1]], enganchado: true }
  }

  /**
   * Ofrece unos anillos a las vistas en vivo. Siempre una COPIA (ver
   * {@link copiaAnillos}); el `refVertice` va tal cual, porque es el mismo objeto
   * que ya cuelga públicamente del marcador.
   *
   * @param {Array<Array<[number, number]>>} anillos
   * @param {RefVertice|null} refVertice
   */
  function previsualizar(anillos, refVertice) {
    if (!alPrevisualizar) return
    try {
      alPrevisualizar(copiaAnillos(anillos), refVertice)
    } catch (causa) {
      avisarUnaVez(
        'previsualizar',
        'Las medidas en vivo del dibujo (acotaciones, superficie, perímetro) han ' +
          'fallado: la geometría es correcta, pero lo que se muestra sobre el mapa ' +
          'puede estar desactualizado.',
        causa,
      )
    }
  }

  /**
   * Entrega un marcador recién creado a la interacción de edición.
   * @param {import('leaflet').Marker} marcador
   */
  function notificarMarcador(marcador) {
    if (!alCrearMarcador) return
    try {
      alCrearMarcador(marcador, marcador.refVertice)
    } catch (causa) {
      avisarUnaVez(
        'crearMarcador',
        'No se ha podido activar la edición sobre los vértices: se pueden arrastrar ' +
          'y se puede teclear su coordenada en la tabla, pero pueden faltarles ' +
          'acciones de edición.',
        causa,
      )
    }
  }

  // ── Historial: un commit por operación acabada ────────────────────────────
  /**
   * @param {object} instantanea  Estado ya aplicado al store.
   * @returns {void}
   */
  function registrarEnHistorial(instantanea) {
    if (!historial) return
    commitHistorial(historial, instantanea)
  }

  // ── Escritura en el modelo ────────────────────────────────────────────────

  /**
   * Vértice `[x,y]` del estado actual, o `null` si la referencia no existe.
   * @param {number} recinto
   * @param {number} indice
   * @returns {[number, number]|null}
   */
  function verticeDelModelo(recinto, indice) {
    const anillos = anillosDe(estado.get())
    const v = anillos[recinto] && anillos[recinto][indice]
    return Array.isArray(v) && v.length >= 2 ? [v[0], v[1]] : null
  }

  /**
   * Aplica un vértice al modelo: CLON del estado (`structuredClone`) → mutar el
   * vértice en el clon → `estado.set(clon)` → un `commit`. Se clona en vez de
   * mutar en sitio para que los snapshots del historial sean independientes
   * (`commit` fotografía con `structuredClone`, y el estado ES el POJO de
   * parcela: ver `edit/historial.js`).
   *
   * Nota: `structuredClone` no preserva `Object.freeze`, así que la
   * `geometriaOficial` del clon deja de estar congelada. Es el mismo
   * comportamiento que ya tiene `edit/historial.js#commit`/`undo`, y este
   * módulo nunca la escribe: solo la lee para pintarla.
   *
   * @param {number} recinto
   * @param {number} indice
   * @param {[number, number]} utm  Par UTM ya validado (finito).
   * @returns {boolean}  true si se aplicó.
   */
  function aplicarVertice(recinto, indice, utm) {
    const actual = estado.get()
    if (!verticeDelModelo(recinto, indice)) {
      avisar(
        `No se ha podido aplicar el cambio: el vértice ${indice + 1} de ` +
          `${rotuloRecinto(recinto)} ya no existe en la parcela.`,
        // NIVEL.ERROR es correcto aquí: el cambio que el usuario acaba de hacer
        // NO se aplica (ver la regla junto al typedef `Avisar` de `_comun.js`).
        { nivel: NIVEL.ERROR },
      )
      return false
    }
    const siguiente = structuredClone(actual)
    siguiente.recintos[recinto].vertices[indice] = [utm[0], utm[1]]
    estado.set(siguiente)
    registrarEnHistorial(siguiente)
    return true
  }

  // ── Tabla: construcción y actualización ───────────────────────────────────

  /**
   * Vacía `tablaEl` y devuelve el `<table>` raíz. Si `tablaEl` ya es un
   * `<table>` se usa él mismo (no se anidan tablas); si es un contenedor, se
   * crea el `<table>` dentro. En ambos casos los selectores documentados
   * funcionan con raíz en `tablaEl`.
   */
  function prepararRaizTabla() {
    tablaEl.replaceChildren()
    if (tablaEl.tagName === 'TABLE') {
      tablaEl.classList.add(CLASE.TABLA)
      return tablaEl
    }
    const tabla = doc.createElement('table')
    tabla.className = CLASE.TABLA
    tablaEl.appendChild(tabla)
    return tabla
  }

  /** Cabecera de la tabla. Es de esta función, como el resto del interior. */
  function construirCabecera(tabla) {
    const thead = doc.createElement('thead')
    const tr = doc.createElement('tr')
    for (const [texto, clase] of [
      ['Nº', CLASE.CELDA_INDICE],
      ['X (m)', CLASE.CELDA_X],
      ['Y (m)', CLASE.CELDA_Y],
    ]) {
      const th = doc.createElement('th')
      th.scope = 'col'
      th.className = clase
      th.textContent = texto
      tr.appendChild(th)
    }
    thead.appendChild(tr)
    tabla.appendChild(thead)
  }

  /**
   * Una celda editable de coordenada.
   * @param {'x'|'y'} eje
   * @param {number} valor
   * @param {string} etiqueta
   * @returns {{celda: HTMLElement, input: HTMLInputElement}}
   */
  function construirCelda(eje, valor, etiqueta) {
    const celda = doc.createElement('td')
    celda.className = eje === 'x' ? CLASE.CELDA_X : CLASE.CELDA_Y
    const input = doc.createElement('input')
    // type="text", NO "number": el usuario teclea con coma o con punto y la
    // interpretación es de `celda.js#parsearCoordenada`, no del navegador
    // (un input number vacía su `.value` ante texto no numérico y perderíamos
    // lo que el usuario escribió, imposibilitando el aviso con su motivo).
    input.type = 'text'
    input.inputMode = 'decimal'
    input.autocomplete = 'off'
    input.spellcheck = false
    input.className = CLASE.INPUT
    input.dataset.eje = eje
    input.setAttribute('aria-label', etiqueta)
    input.value = formatearCoordenada(valor)
    celda.appendChild(input)
    return { celda, input }
  }

  /**
   * Reconstruye la tabla entera desde los anillos UTM. Solo se llama cuando la
   * FORMA ha cambiado (ver cabecera del módulo).
   * @param {Array<Array<[number, number]>>} anillosUTM
   */
  function construirTabla(anillosUTM) {
    const tabla = prepararRaizTabla()
    construirCabecera(tabla)
    filas = []

    if (anillosUTM.length === 0) {
      const tbody = doc.createElement('tbody')
      const tr = doc.createElement('tr')
      tr.className = CLASE.FILA_VACIA
      const td = doc.createElement('td')
      td.colSpan = 3
      td.textContent = 'Sin vértices.'
      tr.appendChild(td)
      tbody.appendChild(tr)
      tabla.appendChild(tbody)
      return
    }

    anillosUTM.forEach((anillo, r) => {
      const rotulo = rotuloRecinto(r)
      // Un <tbody> por recinto: es la agrupación semántica de HTML para "grupo
      // de filas", y da a la Fase 3 un ancla por recinto sin clases inventadas.
      const tbody = doc.createElement('tbody')
      tbody.className = CLASE.GRUPO
      tbody.dataset.recinto = String(r)

      const filaRecinto = doc.createElement('tr')
      filaRecinto.className = CLASE.FILA_RECINTO
      const thRecinto = doc.createElement('th')
      thRecinto.scope = 'colgroup'
      thRecinto.colSpan = 3
      thRecinto.textContent = rotulo
      filaRecinto.appendChild(thRecinto)
      tbody.appendChild(filaRecinto)

      filas[r] = []
      anillo.forEach((vertice, i) => {
        const tr = doc.createElement('tr')
        tr.className = CLASE.FILA_VERTICE
        // RefVertice {recinto, indice} de validation/_comun.js, tal cual.
        tr.dataset.recinto = String(r)
        tr.dataset.indice = String(i)

        const thIndice = doc.createElement('th')
        thIndice.scope = 'row'
        thIndice.className = CLASE.CELDA_INDICE
        thIndice.textContent = String(i + 1) // 1-based solo para el humano
        tr.appendChild(thIndice)

        const x = construirCelda('x', vertice[0], `X del vértice ${i + 1} de ${rotulo}`)
        const y = construirCelda('y', vertice[1], `Y del vértice ${i + 1} de ${rotulo}`)
        tr.appendChild(x.celda)
        tr.appendChild(y.celda)

        tbody.appendChild(tr)
        filas[r][i] = { fila: tr, inputX: x.input, inputY: y.input }
      })

      tabla.appendChild(tbody)
    })
  }

  /**
   * Escribe un valor en un input SIN pisar lo que el usuario está teclando: si
   * el input tiene el foco se deja como está (su propio `change` lo reconcilia).
   * @param {HTMLInputElement} input
   * @param {number} valor
   */
  function escribirInput(input, valor) {
    const texto = formatearCoordenada(valor)
    if (input.value === texto) return
    if (doc.activeElement === input) return
    input.value = texto
  }

  /** Fuerza el texto del input al valor del modelo (revertir una celda ilegible). */
  function revertirInput(input, valor) {
    input.value = formatearCoordenada(valor)
  }

  /**
   * Refleja un vértice en su fila (solo esa fila).
   * @param {number} r
   * @param {number} i
   * @param {[number, number]} utm
   */
  function escribirFila(r, i, utm) {
    const celdas = filas[r] && filas[r][i]
    if (!celdas) return
    escribirInput(celdas.inputX, utm[0])
    escribirInput(celdas.inputY, utm[1])
  }

  // ── Marcadores ───────────────────────────────────────────────────────────

  /**
   * Un marcador de vértice, con su arrastre INCREMENTAL cableado.
   *
   * `drag` (decenas de eventos por gesto): convierte SOLO el vértice movido,
   * repinta SOLO su punto del polígono y SOLO su fila. No pasa por el store y
   * NO hace commit — un commit por frame reventaría el historial (100
   * snapshots de un solo arrastre). `dragend` (una vez): UN `estado.set` y UN
   * `commit`.
   *
   * @param {number} r
   * @param {number} i
   * @param {[number, number]} latlng
   * @returns {import('leaflet').Marker}
   */
  function crearMarcador(r, i, latlng) {
    const marcador = L.marker(latlng, {
      draggable: true,
      pane: PANE.VERTICES,
      icon: iconoVertice,
      // El teclado edita por la TABLA, no por el marcador: dejar los vértices
      // fuera del orden de tabulación evita 60 paradas antes de llegar a ella.
      keyboard: false,
      title: `${rotuloRecinto(r)} · vértice ${i + 1}`,
    })
    marcador.addTo(mapa)

    // Expuesto a propósito: la RefVertice del marcador, para que los tests y
    // F06 puedan localizarlo sin depender del orden de `mapa.eachLayer`.
    marcador.refVertice = { recinto: r, indice: i }

    /**
     * Coloca el vértice en `punto` (UTM) en TODO lo que no es el modelo: el
     * espejo UTM, el espejo lat/lng, el polígono, la fila y —solo si el punto
     * viene de un enganche— el propio marcador.
     *
     * Reposicionar el marcador SOLO cuando `enganchado` no es una optimización:
     * durante un arrastre real `L.Draggable` está moviendo el icono por CSS
     * frame a frame, y llamarle `setLatLng` con la posición que él mismo acaba
     * de fijar es pelearse con él para nada. Cuando el snap SÍ ha movido el
     * punto hay que hacerlo, porque si no el vértice se dibujaría donde está el
     * ratón en vez de donde ha enganchado.
     *
     * @param {[number, number]} punto  UTM ya definitivo para este frame.
     * @param {{lat:number, lng:number}} pos  Posición cruda del marcador.
     * @param {boolean} enganchado
     * @returns {void}
     */
    function colocar(punto, pos, enganchado) {
      // Reproyectar el punto ajustado es OBLIGATORIO: `ajustar` habla UTM (la
      // frontera de vista no se mueve, regla 3) y Leaflet habla lat/lng.
      const latlng = enganchado ? vertUTMaLatLng(punto, zona) : [pos.lat, pos.lng]
      if (enganchado) marcador.setLatLng(latlng)
      if (anillosUTM[r]) anillosUTM[r][i] = [punto[0], punto[1]]
      if (anillosLatLng[r]) anillosLatLng[r][i] = latlng
      if (poligonoEditado) poligonoEditado.setLatLngs(anillosLatLng)
      escribirFila(r, i, punto)
    }

    const alMover = (evento) => {
      // `dragstart` no llega cuando el gesto se simula por API (tests), así que
      // la bandera se levanta también aquí: es la que impide que el suscriptor
      // re-renderice —y por tanto recree filas— en medio del gesto.
      iniciarGesto()
      const pos = marcador.getLatLng()
      const crudo = latLngAUTM(pos, zona)
      // `ajustar` por frame, pero SIN tocar el store: el snap es un consejo sobre
      // dónde dibujar, no una operación acabada. Un `set` aquí metería un
      // snapshot por fotograma y rompería el criterio 5 de F06.
      const { punto, enganchado } = ajustarPunto(
        crudo,
        marcador.refVertice,
        eventoOriginalDe(evento),
      )
      colocar(punto, pos, enganchado)
      previsualizar(anillosUTM, marcador.refVertice)
    }

    marcador.on('dragstart', () => {
      // `dragstart` es inequívoco: empieza un gesto NUEVO. Por eso reabre el
      // episodio de avisos SIN condiciones, incluso si la bandera hubiera quedado
      // alta de un gesto que nunca recibió su `dragend` (el mismo escenario del
      // hallazgo 2.11: el puntero sale de la ventana). Si no, un gancho roto se
      // quedaría mudo para siempre a partir de ese gesto huérfano.
      abrirEpisodioDeGesto()
      arrastrando = true
    })
    marcador.on('drag', alMover)
    marcador.on('dragend', (evento) => {
      arrastrando = false
      const pos = marcador.getLatLng()
      const crudo = latLngAUTM(pos, zona)
      // Se ajusta TAMBIÉN aquí, y no por simetría: `dragend` recalcula el UTM
      // desde `marcador.getLatLng()`, así que sin esta llamada lo que entraría en
      // el modelo sería el punto crudo del último movimiento y el vértice se
      // despegaría del enganche justo al soltarlo (ver el typedef `Ajustar`).
      const { punto, enganchado } = ajustarPunto(
        crudo,
        marcador.refVertice,
        eventoOriginalDe(evento),
      )
      colocar(punto, pos, enganchado)
      // Único punto del gesto que toca el store y el historial.
      if (!aplicarVertice(r, i, punto)) {
        // El modelo ya no admite el cambio: se re-renderiza desde el estado
        // para que el dibujo no quede mintiendo (regla 1: nada silencioso).
        render()
      }
      // Drenaje de lo que el gesto hizo ignorar (ver `renderPendiente`). En el
      // camino normal `aplicarVertice` ya ha hecho `set` → el suscriptor ha
      // renderizado (con `arrastrando` ya en false) → `render()` ha bajado la
      // bandera, y aquí no queda nada por hacer: CERO renders redundantes. Esta
      // línea es la red de seguridad para cuando `dragend` NO acabe en un
      // render —hoy no ocurre, pero F06 añadirá casos de "no ha cambiado nada,
      // no commiteo"— y para que la notificación ignorada no se pierda jamás.
      if (renderPendiente) render()
    })

    // Al FINAL, no nada más construirlo: así la edición de F06 recibe un marcador
    // ya cableado, y sus manejadores quedan registrados DESPUÉS de los de aquí
    // (Leaflet los dispara en orden de registro), que es el orden correcto —
    // primero se actualiza el dibujo, luego reacciona quien lo observa.
    notificarMarcador(marcador)

    return marcador
  }

  function quitarMarcadores() {
    for (const anillo of marcadores) {
      if (!anillo) continue
      for (const m of anillo) {
        if (!m) continue
        m.off()
        mapa.removeLayer(m)
      }
    }
    marcadores = []
  }

  // ── Render ───────────────────────────────────────────────────────────────

  /** Reconstruye polígono editado, marcadores y tabla desde cero. */
  function reconstruir(parcela) {
    quitarMarcadores()
    // Episodio de avisos nuevo para `alCrearMarcador`: el bucle de abajo lo llama
    // una vez por vértice, y un gancho roto daría un aviso por vértice.
    yaAvisado.crearMarcador = false
    // COPIA propia: `anillosDe` devuelve los arrays `vertices` DEL ESTADO, y este
    // espejo se muta punto a punto en `drag` (ver `copiaAnillos`).
    anillosUTM = copiaAnillos(anillosDe(parcela))
    anillosLatLng = anillosUTM.map((anillo) => anillo.map((v) => vertUTMaLatLng(v, zona)))

    const hayGeometria = anillosLatLng.some((a) => a.length > 0)
    if (!hayGeometria) {
      if (poligonoEditado) {
        mapa.removeLayer(poligonoEditado)
        poligonoEditado = null
      }
    } else if (poligonoEditado) {
      poligonoEditado.setLatLngs(anillosLatLng)
    } else {
      // Anillos anidados: [exterior, ...huecos]. Leaflet recorta del segundo en
      // adelante, que es justo la semántica de `recintos[]`.
      poligonoEditado = L.polygon(anillosLatLng, estiloEditada).addTo(mapa)
    }

    marcadores = anillosLatLng.map((anillo, r) => anillo.map((ll, i) => crearMarcador(r, i, ll)))
    construirTabla(anillosUTM)
  }

  /**
   * Misma forma: se actualizan posiciones EN SU SITIO. Ni un marcador ni una
   * fila se destruyen (requisito del arrastre, hallazgo C8).
   */
  function actualizarEnSitio(parcela) {
    anillosDe(parcela).forEach((anillo, r) => {
      anillo.forEach((vertice, i) => {
        const latlng = vertUTMaLatLng(vertice, zona)
        // Los dos espejos vuelven a la verdad del estado a la vez. El UTM no se
        // reproyecta de vuelta desde lat/lng: se copia del modelo, que es el que
        // manda (y así el viaje de ida y vuelta no le mete ruido).
        anillosUTM[r][i] = [vertice[0], vertice[1]]
        anillosLatLng[r][i] = latlng
        const m = marcadores[r] && marcadores[r][i]
        if (m) m.setLatLng(latlng)
        escribirFila(r, i, [vertice[0], vertice[1]])
      })
    })
    if (poligonoEditado) poligonoEditado.setLatLngs(anillosLatLng)
  }

  /**
   * La geometría OFICIAL del Catastro: se dibuja aparte, más sobria, sin
   * marcadores y sin interacción. Congelada en el modelo (regla 2): aquí solo
   * se lee.
   */
  function sincronizarOficial(parcela) {
    const oficial =
      parcela && Array.isArray(parcela.geometriaOficial) ? parcela.geometriaOficial : null
    const anillos =
      oficial && oficial.length > 0
        ? oficial
            .filter((r) => r && Array.isArray(r.vertices) && r.vertices.length > 0)
            .map((r) => recintoALatLng(r, zona))
        : []

    if (anillos.length === 0) {
      if (poligonoOficial) {
        mapa.removeLayer(poligonoOficial)
        poligonoOficial = null
      }
      return
    }
    if (poligonoOficial) poligonoOficial.setLatLngs(anillos)
    else poligonoOficial = L.polygon(anillos, estiloOficial).addTo(mapa)
  }

  /** Un ciclo de render completo (idempotente: reconstruye solo si cambia la forma). */
  function render() {
    if (!vivo) return
    // Un render pinta desde el estado ACTUAL, así que subsume cualquier
    // notificación que se hubiera quedado pendiente: la bandera baja aquí.
    renderPendiente = false
    const parcela = estado.get()
    const nuevaForma = formaDe(parcela)
    if (mismaForma(forma, nuevaForma)) actualizarEnSitio(parcela)
    else reconstruir(parcela)
    forma = nuevaForma
    sincronizarOficial(parcela)
    // Las vistas en vivo se re-sincronizan con el ESTADO al cerrar cada ciclo
    // (`refVertice:null` = "esto no es un frame de arrastre, es la verdad"): así
    // arrancan pintadas en el primer render y vuelven a cuadrar tras cualquier
    // `set`, venga de la tabla, de otra vista o de un undo, sin que nadie tenga
    // que acordarse de refrescarlas.
    previsualizar(anillosUTM, null)
  }

  // ── Edición de celda (hallazgo C7/T8) ────────────────────────────────────

  /**
   * Handler DELEGADO de `change` en `tablaEl`: sobrevive a las
   * reconstrucciones de la tabla, así que solo hay un listener que instalar y
   * uno que quitar en `destruir`.
   *
   * @param {Event} evento
   */
  function alCambiarCelda(evento) {
    if (!vivo) return
    const input = /** @type {HTMLInputElement} */ (evento.target)
    if (!input || input.tagName !== 'INPUT') return
    const eje = input.dataset && input.dataset.eje
    if (eje !== 'x' && eje !== 'y') return
    const fila = typeof input.closest === 'function' ? input.closest('tr[data-indice]') : null
    if (!fila) return

    const recinto = Number(fila.dataset.recinto)
    const indice = Number(fila.dataset.indice)
    const vertice = verticeDelModelo(recinto, indice)
    if (!vertice) {
      avisar(
        `La fila editada ya no corresponde a ningún vértice de la parcela ` +
          `(recinto ${recinto}, vértice ${indice + 1}).`,
        { nivel: NIVEL.ERROR },
      )
      return
    }

    const anterior = eje === 'x' ? vertice[0] : vertice[1]
    const resultado = parsearCoordenada(input.value)

    if (!resultado.ok) {
      // Dato malo del USUARIO: aviso + revertir. Ni se aplica el cambio, ni se
      // inyecta NaN, ni se muta el modelo a medias.
      avisar(
        `${rotuloRecinto(recinto)}, vértice ${indice + 1}, ${eje.toUpperCase()}: ${resultado.motivo}`,
        // NIVEL.AVISO: el input se revierte y el modelo queda intacto y generable.
        { nivel: NIVEL.AVISO },
      )
      revertirInput(input, anterior)
      return
    }

    if (resultado.valor === anterior) {
      // Sin cambio real (típico al tabular por la tabla): ni `set` ni `commit`,
      // que ensuciarían el historial con snapshots idénticos.
      escribirInput(input, anterior)
      return
    }

    // OJO: si el valor del modelo tuviera MÁS de DECIMALES_VISIBLES decimales,
    // este camino no se toma (el texto mostrado está redondeado y ya no es igual
    // al valor del modelo) y lo que se commitea es el valor REDONDEADO. Es el
    // redondeo entre ediciones que la regla de oro 11 desaconseja, asumido a
    // propósito: la justificación completa está en {@link DECIMALES_VISIBLES}.
    // No lo "arregles" al revés sin leerla.

    const utm = eje === 'x' ? [resultado.valor, vertice[1]] : [vertice[0], resultado.valor]
    aplicarVertice(recinto, indice, /** @type {[number, number]} */ (utm))
  }

  // ── Arranque ─────────────────────────────────────────────────────────────

  tablaEl.addEventListener('change', alCambiarCelda)

  // Un ÚNICO suscriptor: el render. La guarda `arrastrando` evita repintar en
  // medio de un gesto (recrear la fila que se está actualizando o pisar la
  // posición del marcador agarrado). Pero NO se descarta la notificación: se
  // DIFIERE (`renderPendiente`), y se drena en `dragend` — ver hallazgo 2.11 en
  // la declaración de la bandera.
  const bajaDelStore = estado.subscribe(() => {
    if (arrastrando) {
      renderPendiente = true
      return
    }
    render()
  })

  render()

  return {
    /**
     * Fuerza un ciclo de render desde el estado actual (útil si el estado se
     * ha modificado sin pasar por `set`, o tras montar capas alrededor).
     */
    refrescar() {
      render()
    },

    /**
     * Deshace todo: marcadores, polígonos, listeners del mapa y del DOM, baja
     * del store y vacía `tablaEl`. Idempotente.
     */
    destruir() {
      if (!vivo) return
      vivo = false
      bajaDelStore()
      tablaEl.removeEventListener('change', alCambiarCelda)
      quitarMarcadores()
      if (poligonoEditado) {
        mapa.removeLayer(poligonoEditado)
        poligonoEditado = null
      }
      if (poligonoOficial) {
        mapa.removeLayer(poligonoOficial)
        poligonoOficial = null
      }
      filas = []
      anillosLatLng = []
      anillosUTM = []
      forma = null
      arrastrando = false
      renderPendiente = false
      tablaEl.replaceChildren()
    },
  }
}
