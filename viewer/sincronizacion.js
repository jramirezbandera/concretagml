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
// ── Qué es de F06 y NO está aquí ────────────────────────────────────────────
// Insertar o eliminar vértices, crear o borrar recintos, offset de lindero,
// snap y acotaciones en vivo son EDICIÓN (F06). Aquí solo hay: render de lo que
// el estado ya contiene, arrastre de un vértice EXISTENTE y edición de su
// valor. Deliberadamente no hay ningún botón de "añadir vértice": añadirlo aquí
// sería colar media feature ajena en el visor.
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
  /** `marcadores[recinto][indice]` → L.Marker. */
  let marcadores = []
  /** `filas[recinto][indice]` → `{fila, inputX, inputY}`. */
  let filas = []
  let poligonoEditado = null
  let poligonoOficial = null

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

    const alMover = () => {
      // `dragstart` no llega cuando el gesto se simula por API (tests), así que
      // la bandera se levanta también aquí: es la que impide que el suscriptor
      // re-renderice —y por tanto recree filas— en medio del gesto.
      arrastrando = true
      const pos = marcador.getLatLng()
      const utm = latLngAUTM(pos, zona)
      if (anillosLatLng[r]) anillosLatLng[r][i] = [pos.lat, pos.lng]
      if (poligonoEditado) poligonoEditado.setLatLngs(anillosLatLng)
      escribirFila(r, i, utm)
    }

    marcador.on('dragstart', () => {
      arrastrando = true
    })
    marcador.on('drag', alMover)
    marcador.on('dragend', () => {
      arrastrando = false
      const pos = marcador.getLatLng()
      const utm = latLngAUTM(pos, zona)
      if (anillosLatLng[r]) anillosLatLng[r][i] = [pos.lat, pos.lng]
      // Único punto del gesto que toca el store y el historial.
      if (!aplicarVertice(r, i, utm)) {
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
    const anillosUTM = anillosDe(parcela)
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
    const anillosUTM = anillosDe(parcela)
    anillosUTM.forEach((anillo, r) => {
      anillo.forEach((vertice, i) => {
        const latlng = vertUTMaLatLng(vertice, zona)
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
      forma = null
      arrastrando = false
      renderPendiente = false
      tablaEl.replaceChildren()
    },
  }
}
