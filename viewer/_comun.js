// viewer/_comun.js — F03 · Visor. Contratos y utilidades COMPARTIDAS del visor.
//
// Keystone del visor: todo `viewer/*` y `services/*` importa de aquí. Fija el
// vocabulario común (descriptor de capa, panes, color), la FRONTERA DE VISTA
// (proyección UTM↔lat/lon, único punto del visor donde aparece lat/lon) y el
// STORE de estado del que la tabla y el mapa son vistas.
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 3 — El modelo va SIEMPRE en UTM. lat/lon SÓLO para pintar: la
//     desproyección vive aquí, en la capa de vista, y NUNCA se guarda en el
//     modelo. `geo/utm.js` es la maquinaria; este módulo es el adaptador de
//     vista (recinto/vértice UTM → [lat,lon] para Leaflet, y de vuelta).
//   · Regla 4 — POJO plano. El estado del store ES el POJO del DOCUMENTO DE LA
//     RAMA —una Parcela, o un Edificio desde F11, que estrena una segunda
//     instancia del mismo store— y es el que
//     `edit/historial.js#commit` fotografía con `structuredClone` (decisión de
//     review, hallazgo 1). Reparto real (corregido en 2D.2): el `commit` ya lo
//     hace F03 — `viewer/sincronizacion.js` commitea una instantánea por
//     operación acabada (celda editada, `dragend`). Lo que F06 enchufa SIN
//     reformar el estado son el UNDO y el REDO (los atajos, los botones y el
//     `estado.set` del snapshot que devuelven), porque la pila ya se está
//     llenando desde aquí.
//   · Regla 1 — Ningún error silencioso: contrato roto por el programador
//     (zona/estado inválidos) → throw; nunca se corrige callado.
//   · Regla 1 (canal de aviso) — `resolverAvisar`/`avisoPorDefecto` (al final de
//     este módulo) son el canal común con el que un módulo del visor cuenta al
//     usuario un fallo de red o de entrada SIN abortar el flujo ni tragárselo.
//
// IMPORTANTE (decisión de review, Codex C1): este módulo NO importa Leaflet
// (no usa `L.*`), por eso es seguro importarlo también bajo el proyecto Vitest
// `node`. Sus dos únicos imports son `geo/utm.js` y `validation/_comun.js` (de
// donde re-exporta `NIVEL`), ambos Leaflet-free — el segundo arrastra, a través
// de `config/operativos.js` (F06 extrajo ahí el cargador), un import de
// `config/operativos.json` con `with { type: 'json' }`, comprobado en verde en
// los dos proyectos. Los módulos que sí usan Leaflet (`services/ign`, `viewer/wms-catastro`,
// `viewer/mapa`, `viewer/sincronizacion`) son SOLO-navegador y jamás deben
// entrar por el barrel raíz `index.js` (rompería la suite node: Leaflet exige
// `window`).

import { forward, inverse } from '../geo/utm.js'

// ── Vocabulario común ─────────────────────────────────────────────────────────

/**
 * Nivel de un aviso del visor. **Re-exportado de `validation/_comun.js`, no
 * redefinido** (auditoría de coherencia 2C.2, hallazgo 2.4): F02 ya declaraba
 * `NIVEL` "para que la UI (F03) lo consuma", y el visor lo consume por aquí en
 * vez de escribir `'AVISO'`/`'ERROR'` como literales sueltos. Un solo objeto en
 * memoria para todo el proyecto ⇒ imposible que los dos vocabularios divergan.
 *
 * Es seguro importarlo bajo el proyecto Vitest `node`: `validation/_comun.js`
 * carga `config/operativos.json` con `with { type: 'json' }`, que Vite/Vitest y
 * Node 22+ resuelven sin problema (comprobado: el proyecto `dom` y el `node`
 * siguen en verde con esta re-exportación).
 *
 * @see {@link Avisar} para la REGLA de cuándo es AVISO y cuándo ERROR.
 */
export { NIVEL } from '../validation/_comun.js'

/**
 * Descriptor de una capa del visor (base o superpuesta). POJO plano.
 *
 * @typedef {Object} DescriptorCapa
 * @property {string} id           Clave ESTABLE de la capa (p. ej. `'pnoa-ma'`).
 *   Es la clave con la que se indexa, se persiste "qué capa tenía activa el
 *   usuario" y se referencia desde el control de capas. NUNCA se usa `nombre`
 *   para eso: `nombre` es un rótulo de UI, traducible y retocable.
 * @property {string} nombre        Rótulo para el control de capas (español).
 * @property {'base'|'overlay'} rol Capa base (excluyente) o superpuesta.
 * @property {(opts?: object) => object} crear  Factory que devuelve la capa
 *   Leaflet, montada SIEMPRE con `crossOrigin:'anonymous'` (O7). Acepta las
 *   MISMAS opciones que la factory subyacente; en particular `alAvisar`, para
 *   que los fallos de red de la capa lleguen a la UI de avisos y no se queden
 *   en el `console.warn` por defecto (regla 1). Pasar `alAvisar` por el
 *   descriptor es el caso NORMAL, no la excepción.
 * @property {string} atribucion    Texto legal de atribución (obligatorio).
 *   Puede ser la CADENA VACÍA, y solo en un caso legítimo: una capa que no
 *   muestra datos de terceros y por tanto no tiene titular al que citar (la
 *   capa «Blanco» de `viewer/capas.js`, un lienzo generado en el cliente). Para
 *   cualquier capa que pinte cartografía ajena, vacía = incumplimiento de
 *   licencia.
 * @property {number} [maxNativeZoom]  Zoom nativo máximo de la capa, si lo
 *   tiene. OPCIONAL a propósito: hay capas SIN tope nativo —«Blanco» (no hay
 *   tesela que reescalar) y el WMS del Catastro (una imagen por encuadre, a la
 *   resolución del lienzo)— y `undefined` significa exactamente eso, no «cero».
 *   Lo declara `viewer/capas.js` (único constructor de descriptores del
 *   proyecto) leyéndolo de la config del módulo dueño (`WMTS_IGN`, `OSM`),
 *   nunca a mano. Existe porque `crearVisor` (F03, tarea 3C) debe comprobar que
 *   el `maxZoom` del mapa supera el tope nativo de las capas REALMENTE MONTADAS,
 *   y `viewer/mapa.js` dejó deliberadamente de conocer ese dato (hallazgo 2.7 de
 *   la auditoría de coherencia).
 */

/**
 * Un vértice de la tabla/mapa, referido a su recinto. Es EL MISMO tipo que el de
 * `validation/_comun.js` (alias, no una copia: hallazgo 2.10 de la auditoría de
 * coherencia), para que el resaltado de F02 case sin traducción (decisión de
 * review, hallazgo 8/C6).
 *
 * @typedef {import('../validation/_comun.js').RefVertice} RefVertice
 */

/**
 * Color de la geometría del usuario **sobre el mapa**: amarillo intenso.
 *
 * Elegido en la revisión visual de la Fase 5 (2026-07-27) comparando cuatro
 * candidatos sobre la ortofoto real, y sustituye al violeta `#7C3AED` que fijaba
 * el spec: el violeta **desaparecía sobre las sombras oscuras** (arbolado,
 * cubiertas en sombra), que es justo donde más falta hace ver el lindero.
 *
 * El criterio no es el gusto, son las tres cosas con las que este color NO puede
 * colisionar, porque conviven en el mismo lienzo:
 *   · el ROJO de la cartografía catastral superpuesta (descarta magenta/rosa:
 *     le resta contraste a las líneas sobre las que se calca);
 *   · el AZUL de la hidrografía catastral (descarta el azul de acento del DS —
 *     era la razón original del violeta);
 *   · el VERDE de la vegetación de la ortofoto (descarta el verde: el relleno
 *     se camufla con césped y arbolado).
 * El amarillo es el único que queda libre, y además es el que más contrasta
 * sobre las sombras.
 *
 * ⚠️ Este valor es para el MAPA, sobre imagen aérea. **No sirve sobre fondo
 * blanco**: amarillo sobre blanco da ~1,4:1 de contraste, ilegible. El nº de
 * vértice de la tabla usa por eso un ámbar oscuro de la misma familia
 * (`--gml-color-usuario-sobre-claro` en `estilos/app.css`), NO este valor.
 */
export const COLOR_USUARIO = '#FFD600'

/** Densidad tipográfica base del cromo del visor, en px. */
export const DENSIDAD_BASE_PX = 13

/** Nombres canónicos de los panes del visor. */
export const PANE = Object.freeze({
  COLINDANTES: 'colindantes',
  PARCELA_OFICIAL: 'parcelaOficial',
  PARCELA_EDITADA: 'parcelaEditada',
  PARTES: 'partes',
  ACOTACIONES: 'acotaciones',
  DIAGNOSTICO: 'diagnostico',
  VERTICES: 'vertices',
})

/**
 * Panes del visor con zIndex CRECIENTE (SPEC feature-03, Interacción): la
 * geometría editada va sobre la oficial y los vértices SIEMPRE encima. Los
 * valores caen entre `overlayPane` (400) y `markerPane` (600) de Leaflet.
 *
 * `acotaciones` (F06, T3.2) se intercala en **425**, y el sitio no es arbitrario:
 *   · por ENCIMA de `parcelaEditada` (420) porque una cota es un rótulo SOBRE el
 *     dibujo — debajo del relleno del polígono no se leería;
 *   · por DEBAJO de `vertices` (430) porque el vértice es lo que se agarra. Si la
 *     cota tapara al vértice, el usuario apuntaría a una etiqueta en vez de a la
 *     esquina que quiere mover. (La cota además va `interactive:false`, así que
 *     ni siquiera intercepta el puntero: el zIndex es la segunda línea de
 *     defensa, no la única.)
 *
 * `diagnostico` (F07, T1.3) se intercala en **428**, entre `acotaciones` (425) y
 * `vertices` (430), con el mismo razonamiento que `acotaciones` un peldaño más
 * arriba:
 *   · por ENCIMA de `parcelaEditada` (420) Y de `acotaciones` (425): todo lo que
 *     F07 dibuja —la diferencia sombreada entre la parcela medida y la oficial,
 *     las piezas de invasión con colindantes, la cota de la desviación máxima
 *     con su línea guía, la banda del margen de identidad (§10.5,
 *     `diagnostico/margen.js`)— es una ANOTACIÓN que EXPLICA esas dos
 *     geometrías. Debajo del relleno del polígono que pretende explicar no se
 *     vería, exactamente el motivo por el que `acotaciones` va sobre
 *     `parcelaEditada`.
 *   · por DEBAJO de `vertices` (430): el vértice sigue siendo lo que se agarra,
 *     y F06 SIGUE ACTIVO con el diagnóstico abierto — el flujo real es
 *     diagnosticar, corregir el lindero señalado, volver a diagnosticar. Si la
 *     sombra de la diferencia o una pieza de invasión taparan al vértice, el
 *     usuario apuntaría a la explicación en vez de a la esquina que quiere
 *     mover. Como en `acotaciones`, la capa de diagnóstico va además
 *     `interactive:false`: el zIndex es la SEGUNDA línea de defensa, no la
 *     única.
 *
 * `colindantes` (`viewer/colindantes.js`) se intercala en **405**, y es el ÚNICO
 * pane del visor que va por DEBAJO de la geometría de la parcela. Los tres
 * porqués, con el mismo detalle que los dos de arriba:
 *   · por DEBAJO de `parcelaOficial` (410) y de `parcelaEditada` (420) porque una
 *     vecina es **contexto de la parcela que se está mirando**, y el contexto
 *     jamás debe tapar a su asunto. El caso que lo decide no es raro, es el
 *     normal: una colindante COMPARTE lindero con la propia. Si el contorno gris
 *     de la vecina se dibujara encima, el lado compartido se vería con el gris de
 *     la vecina y no con el amarillo del usuario, y el técnico creería estar
 *     mirando su lindero mientras mira el de al lado. Con el pane debajo, el
 *     amarillo gana siempre.
 *   · por ENCIMA del `overlayPane` de Leaflet (400), donde viven la ortofoto y la
 *     cartografía catastral superpuesta: el contorno de la vecina tiene que
 *     leerse SOBRE la imagen, que es exactamente para lo que sirve.
 *   · y aquí el zIndex es la PRIMERA línea de defensa del puntero, no la segunda.
 *     `acotaciones` y `diagnostico` van además `interactive:false`; esta capa NO
 *     puede —el título emergente con la referencia catastral exige interacción—,
 *     así que lo único que la separa del arrastre de un vértice o del clic sobre
 *     el polígono editado es el apilado. Estando debajo de todo, el navegador
 *     entrega el puntero a lo de arriba y la vecina solo recoge lo que cae fuera
 *     de la parcela propia. Y lo que recoge lo BURBUJEA al mapa
 *     (`bubblingMouseEvents:true`, el defecto de `L.Path`), que es lo que
 *     mantiene vivo el clic de «Deducir del mapa» de F05: medido en
 *     `test/viewer/colindantes.dom.test.js`, no supuesto.
 *
 * `partes` (F11, T1.5 — las HUELLAS de las partes de construcción, que pinta
 * `viewer/partes.js`) se intercala en **422**, en el único hueco que quedaba entre
 * `parcelaEditada` (420) y `acotaciones` (425). Los tres porqués, con el mismo
 * detalle que los de arriba:
 *   · por ENCIMA de `parcelaEditada` (420) porque en la rama EDIFICIO el ASUNTO es
 *     el edificio y la parcela es CONTEXTO — la relación es exactamente la inversa
 *     de la de `colindantes`, y por eso este pane cae al otro lado de la geometría
 *     de la parcela. Y no es una preferencia estética: la huella de una parte se
 *     RELLENA (es el asunto, no una anotación que lo comente), y por debajo de 420
 *     el relleno amarillo de la parcela editada la TAPARÍA — el técnico creería
 *     estar mirando su edificio mientras mira el solar.
 *   · por DEBAJO de `acotaciones` (425) y de `diagnostico` (428), que son
 *     ANOTACIONES sobre una geometría: una cota o una sombra explicativa debajo del
 *     relleno del polígono que pretende explicar no se lee. La huella es geometría;
 *     la cota, no. Es el mismo criterio con el que esos dos panes se colocaron
 *     sobre `parcelaEditada`, aplicado ahora a un tercer polígono relleno.
 *   · por DEBAJO de `vertices` (430) porque el vértice sigue siendo LO QUE SE
 *     AGARRA, y en F12 lo que se agarrará son los vértices de la parte. Una huella
 *     rellena por encima del marcador dejaría al usuario apuntando al polígono en
 *     vez de a la esquina que quiere mover.
 * Con la rama PARCELA activa este pane existe y está VACÍO, exactamente igual que
 * `diagnostico` mientras nadie diagnostica: el pane lo crea el mapa, no la opción.
 *
 * `viewer/mapa.js#crearMapa` ITERA esta lista para crear los panes, así que
 * añadir una entrada aquí es todo lo que hace falta: ni ese módulo ni el arnés
 * de test (`test/viewer/_ayuda-jsdom.js#crearPanes`) llevan nombres a mano.
 *
 * @type {ReadonlyArray<{nombre:string, zIndex:number}>}
 */
export const PANES = Object.freeze([
  { nombre: PANE.COLINDANTES, zIndex: 405 },
  { nombre: PANE.PARCELA_OFICIAL, zIndex: 410 },
  { nombre: PANE.PARCELA_EDITADA, zIndex: 420 },
  { nombre: PANE.PARTES, zIndex: 422 },
  { nombre: PANE.ACOTACIONES, zIndex: 425 },
  { nombre: PANE.DIAGNOSTICO, zIndex: 428 },
  { nombre: PANE.VERTICES, zIndex: 430 },
])

// ── Contratos compartidos del visor ──────────────────────────────────────────

/**
 * Vista explícita de arranque del mapa: dónde mirar y con cuánto zoom.
 *
 * @typedef {Object} VistaInicial
 * @property {[number, number]} centro  `[lat, lon]` en grados.
 * @property {number} zoom              Nivel de zoom de Leaflet.
 */

/**
 * Valida la forma de una `vistaInicial`. **ÚNICA definición del contrato**, la
 * consumen `viewer/mapa.js#crearMapa` y `viewer/index.js#crearVisor`.
 *
 * Por qué vive aquí (auditoría de cierre de la fase 3, punto 4): los dos módulos
 * tenían su propia copia y ya habían DIVERGIDO — `mapa.js` validaba las
 * componentes del centro con `typeof === 'number'` y `index.js` con
 * `Number.isFinite`, así que un `{centro:[NaN,NaN], zoom:10}` pasaba por
 * `crearMapa` y reventaba dentro de `L.LatLng` con un error de Leaflet ilegible,
 * mientras que el MISMO dato por `crearVisor` se rechazaba limpiamente. La razón
 * por la que `crearVisor` no puede delegar la opción en `crearMapa` (el encuadre
 * va DESPUÉS de montar las capas, y `crearMapa` la aplicaría de inmediato)
 * justifica no delegar la APLICACIÓN, no duplicar la VALIDACIÓN. Es la misma
 * solución que el proyecto ya aplicó a `PANES`/`crearPanes` en la fase 2.
 *
 * Contrato roto por el PROGRAMADOR (la `vistaInicial` la construye otro módulo,
 * nunca teclea el usuario un objeto) → `throw`, igual que el resto del proyecto.
 * `Number.isFinite` en las TRES componentes: un `NaN` no es una vista.
 *
 * @param {*} vistaInicial
 * @param {string} [contexto='vistaInicial']  Prefijo del mensaje de error, para
 *   que el `throw` nombre la función y la opción del llamante (p. ej.
 *   `"crearVisor: 'opciones.vistaInicial'"`).
 * @returns {void}
 * @throws {TypeError}
 */
export function validarVistaInicial(vistaInicial, contexto = 'vistaInicial') {
  const centro = vistaInicial && vistaInicial.centro
  const zoom = vistaInicial && vistaInicial.zoom
  const centroValido =
    Array.isArray(centro) &&
    centro.length === 2 &&
    Number.isFinite(centro[0]) &&
    Number.isFinite(centro[1])

  if (!vistaInicial || typeof vistaInicial !== 'object' || !centroValido || !Number.isFinite(zoom)) {
    throw new TypeError(
      `${contexto} debe ser {centro:[lat,lon], zoom:number} con los tres valores ` +
        `numéricos finitos; recibido ${JSON.stringify(vistaInicial)}.`,
    )
  }
}

// ── Frontera de vista: proyección UTM ↔ lat/lon (regla 3) ─────────────────────

/**
 * Un vértice UTM `[x, y]` → `[lat, lon]` para Leaflet (que espera `[lat, lng]`).
 * Único sentido de desproyección del visor; delega en `geo/utm.js#inverse`.
 *
 * @param {[number, number]} vertice  Par UTM `[x, y]` (Este, Norte).
 * @param {number} zona               Huso UTM (29, 30 o 31).
 * @returns {[number, number]}        `[lat, lon]` en grados.
 */
export function vertUTMaLatLng(vertice, zona) {
  if (!Array.isArray(vertice) || vertice.length < 2) {
    throw new TypeError(
      `vertUTMaLatLng: 'vertice' debe ser un par UTM [x,y]; recibido ${JSON.stringify(vertice)}.`,
    )
  }
  const { lat, lon } = inverse(vertice[0], vertice[1], zona)
  return [lat, lon]
}

/**
 * Los vértices de un recinto (anillo ABIERTO en UTM) → array de `[lat, lon]`
 * para dibujar el anillo en Leaflet. NO cierra el anillo (Leaflet lo cierra al
 * pintar un `L.polygon`).
 *
 * @param {{vertices: [number, number][]}} recinto  Recinto del modelo.
 * @param {number} zona                             Huso UTM (29/30/31).
 * @returns {[number, number][]}                    Anillo en `[lat, lon]`.
 */
export function recintoALatLng(recinto, zona) {
  if (!recinto || !Array.isArray(recinto.vertices)) {
    throw new TypeError(
      `recintoALatLng: 'recinto' debe tener 'vertices' (array de pares [x,y]); ` +
        `recibido ${JSON.stringify(recinto)}.`,
    )
  }
  return recinto.vertices.map((v) => vertUTMaLatLng(v, zona))
}

/**
 * Posición de Leaflet (`{lat, lng}` o `[lat, lng]`) → vértice UTM `[x, y]` para
 * escribir en el modelo. Único sentido de proyección del visor; delega en
 * `geo/utm.js#forward`. Es la mitad de vuelta del arrastre: `drag → aquí → set`.
 *
 * @param {{lat:number, lng:number} | [number, number]} latlng
 * @param {number} zona  Huso UTM (29/30/31).
 * @returns {[number, number]}  Par UTM `[x, y]`.
 */
export function latLngAUTM(latlng, zona) {
  let lat, lng
  if (Array.isArray(latlng)) {
    ;[lat, lng] = latlng
  } else if (latlng && typeof latlng === 'object') {
    lat = latlng.lat
    lng = latlng.lng
  }
  // `Number.isFinite` y NO `typeof === 'number'` (auditoría de cierre de la fase
  // 3, punto 4): con `typeof`, un `{lat: NaN, lng: NaN}` pasaba el guardián y
  // escribía `[NaN, NaN]` EN EL MODELO — un dato corrupto colado en silencio, que
  // es exactamente lo que la regla de oro 1 prohíbe. Hoy el riesgo real es bajo
  // (el único llamante es el `drag`, y `L.LatLng` ya rechaza NaN antes de llegar
  // aquí), pero un guardián que no guarda no sirve de nada.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new TypeError(
      `latLngAUTM: 'latlng' debe ser {lat,lng} o [lat,lng] numérico; recibido ${JSON.stringify(latlng)}.`,
    )
  }
  const { x, y } = forward(lat, lng, zona)
  return [x, y]
}

// ── Store de estado de vista ──────────────────────────────────────────────────

/**
 * Un suscriptor del store: se le notifica con el estado actual tras cada `set`.
 * @callback Suscriptor
 * @param {object|null} estado  El POJO del documento de la rama activa —una
 *   Parcela o un Edificio— actual (o null). Ver {@link crearEstadoVista}.
 * @returns {void}
 */

/**
 * @typedef {Object} EstadoVista
 * @property {() => (object|null)} get                 Devuelve el estado actual.
 * @property {(documento: object|null) => void} set    Reemplaza el estado y notifica.
 * @property {(fn: Suscriptor) => (() => void)} subscribe  Registra un suscriptor;
 *   devuelve una función para darse de baja.
 */

/**
 * Crea el store observable del visor. El estado ES **el POJO del documento de la
 * rama** (o null): una Parcela (`model/parcela.js`) en la rama PARCELA, un
 * Edificio (`model/edificio.js`) en la rama EDIFICIO de F11. En los dos casos es
 * un POJO plano (regla de oro 4) y la MISMA forma que `edit/historial.js#commit`
 * fotografía con `structuredClone` (decisión de review, hallazgo 1): F06 enchufó
 * undo/redo haciendo `commit(historial, estado.get())` sin reformar nada.
 *
 * ⚠️ **Hasta F10 esta documentación decía «el POJO de parcela», y desde F11 hay
 * DOS instancias vivas a la vez** —la de parcela, con sus once suscriptores en
 * producción, y la de edificio, que nace en `null`— porque la rama EDIFICIO
 * SUSTITUYE al panel de parcela en vez de sumarse a él. Que eso funcione **sin
 * tocar ni una línea de este cuerpo** no es suerte ni una suposición: esto es un
 * CLOSURE, así que `estado`, el `Set` de `suscriptores` y la guarda
 * anti-reentrada `notificando` son **por instancia**. Dos `crearEstadoVista()` no
 * comparten estado, no comparten suscriptores y no se pisan la guarda; hay un
 * `it` que lo atesta en `test/viewer/comun.dom.test.js`. Lo que este módulo NO
 * hace —y sigue sin hacer— es saber qué rama está activa: eso es de `app/rama.js`.
 *
 * Tabla y mapa son AMBOS vistas del mismo estado: se suscriben, y cuando uno
 * edita llama a `set`, que reemplaza el estado y notifica a todos. Una GUARDA
 * anti-reentrada evita el bucle de realimentación (SPEC feature-03: "sin feedback
 * loop"): si un suscriptor llama a `set` durante la notificación, el estado se
 * actualiza pero NO se relanza la notificación en cascada.
 *
 * @param {object|null} [documentoInicial=null]  POJO inicial del documento de la
 *   rama (Parcela o Edificio), o null para nacer vacío.
 * @returns {EstadoVista}
 */
export function crearEstadoVista(documentoInicial = null) {
  let estado = documentoInicial
  const suscriptores = new Set()
  let notificando = false

  return {
    get: () => estado,

    set(documento) {
      estado = documento
      // Guarda anti-reentrada: si el set ocurre DENTRO de una notificación
      // (un suscriptor que reacciona escribiendo), no relanzamos la cascada.
      if (notificando) return
      notificando = true
      try {
        for (const fn of suscriptores) fn(estado)
      } finally {
        notificando = false
      }
    },

    subscribe(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`subscribe: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      suscriptores.add(fn)
      return () => suscriptores.delete(fn)
    },
  }
}

// ── Canal de aviso del visor (regla 1: ningún error silencioso) ───────────────

/**
 * Canal de aviso del visor: cómo un módulo cuenta al usuario que algo ha ido mal
 * SIN abortar el flujo. El vocabulario ES el `NIVEL` de `validation/_comun.js`
 * (F02), re-exportado arriba: se usa `NIVEL.AVISO`/`NIVEL.ERROR`, nunca los
 * literales sueltos y nunca `'warn'`/`'fatal'` ni ningún otro término.
 *
 * ── REGLA DE CLASIFICACIÓN (no la adivines: está fijada) ─────────────────────
 * `validation/_comun.js#NIVEL` fija la semántica: **ERROR bloquea la generación
 * del GML; AVISO no.** De ahí se deriva mecánicamente, para todo el visor:
 *
 *   · **Cartografía DE FONDO que no carga → `NIVEL.AVISO`, siempre.** Da igual
 *     el proveedor: una tesela WMTS del IGN que falla y la imagen WMS del
 *     Catastro que falla son EL MISMO suceso (un fallo de red en cartografía de
 *     referencia) y ninguno impide generar el GML — la geometría del usuario
 *     está en el modelo, no en la imagen de fondo. Antes de la auditoría de
 *     coherencia 2C.2 (hallazgo 2.5) el IGN avisaba con AVISO y el Catastro con
 *     ERROR: la misma cosa clasificada de dos maneras. Unificado a AVISO.
 *   · **`NIVEL.ERROR` se reserva a lo que sí impide seguir**: el estado del
 *     modelo no admite la operación que el usuario acaba de hacer (p. ej. mover
 *     un vértice que ya no existe: el cambio NO se aplica).
 *   · Un dato ilegible teclado por el usuario (celda de coordenada) es
 *     `NIVEL.AVISO`: se revierte el input y el modelo sigue intacto y generable.
 *
 * Patrón de uso (cópialo tal cual en todo módulo del visor que pueda fallar por
 * red o por entrada del usuario — `services/ign.js` (tileerror de las teselas),
 * `viewer/wms-catastro.js` (fallo de carga de la imagen WMS),
 * `viewer/sincronizacion.js` (celda de coordenada inválida), …):
 *
 * ```js
 * import { NIVEL, resolverAvisar } from './_comun.js' // (o la ruta que toque)
 *
 * export function crearAlgo({ alAvisar, ...resto } = {}) {
 *   const avisar = resolverAvisar(alAvisar)
 *   // ...
 *   avisar('No se ha podido cargar la tesela del IGN.', { nivel: NIVEL.AVISO, causa: error })
 * }
 * ```
 *
 * @callback Avisar
 * @param {string} mensaje  Texto en español, mostrable tal cual.
 * @param {{nivel?: 'AVISO'|'ERROR', causa?: *}} [detalle]
 * @returns {void}
 */

/**
 * Aviso por defecto cuando el llamante no proporciona uno (caso legítimo: la UI
 * de avisos de Fase 3/4 aún no existe). Es el SUELO MÍNIMO de la regla 1: nunca
 * silencioso. Escribe por `console.warn` con el prefijo `'[visor]'`, el nivel
 * (`detalle.nivel`, por defecto `'AVISO'`) y, si viene, la `causa` como argumento
 * adicional (para que la consola la expanda, en vez de aplanarla a texto). Nunca
 * lanza y nunca se traga el mensaje.
 *
 * @type {Avisar}
 * @param {string} mensaje
 * @param {{nivel?: 'AVISO'|'ERROR', causa?: *}} [detalle]
 * @returns {void}
 */
export function avisoPorDefecto(mensaje, detalle) {
  const nivel = (detalle && detalle.nivel) || 'AVISO'
  if (detalle && 'causa' in detalle) {
    console.warn(`[visor] ${nivel}: ${mensaje}`, detalle.causa)
  } else {
    console.warn(`[visor] ${nivel}: ${mensaje}`)
  }
}

/**
 * Resuelve el avisador que un módulo del visor debe usar: el que le ha pasado el
 * llamante, o {@link avisoPorDefecto} si no le han pasado ninguno.
 *
 * Asimetría deliberada entre "no me han pasado avisador" y "me han pasado basura
 * donde iba una función": lo primero es un caso legítimo del llamante (aún no hay
 * UI de avisos cableada) y se resuelve en silencio al valor por defecto; lo
 * segundo es un contrato roto por el PROGRAMADOR (regla 1) y aquí la política del
 * proyecto es `throw`, igual que en `crearEstadoVista#subscribe`.
 *
 * @param {Avisar|null|undefined} fn
 * @returns {Avisar}
 * @throws {TypeError}  Si `fn` no es función ni `null`/`undefined`.
 */
export function resolverAvisar(fn) {
  if (typeof fn === 'function') return fn
  if (fn === null || fn === undefined) return avisoPorDefecto
  throw new TypeError(
    `resolverAvisar: 'fn' debe ser una función, o null/undefined para el aviso ` +
      `por defecto; recibido ${typeof fn} (${JSON.stringify(fn)}).`,
  )
}
