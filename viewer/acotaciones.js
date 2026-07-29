// viewer/acotaciones.js — F06 · Tarea T3.2 (acotación de cada lado sobre el dibujo).
//
// La spec de F06 pide, como retroalimentación en vivo, «acotación de cada lado
// sobre el dibujo», SIEMPRE visible mientras se edita (criterio de aceptación 4).
// Este módulo es esa capa: un rótulo con la longitud, en el punto medio de cada
// lado, sobre el pane `acotaciones` (zIndex 425, entre la geometría editada y los
// vértices — el porqué está en `viewer/_comun.js#PANES`).
//
// ── El filtro es por PÍXELES, no por metros (y es la decisión central) ────────
// Un lado se rotula solo si mide más de `minimoPx` EN PANTALLA
// (`OPERATIVOS.acotacionMinimaPx` = 44 px por defecto). Lo que hace ilegible una
// cota no es que el lindero sea corto sobre el terreno, es que el número no quepa
// entre sus extremos, y eso depende del zoom. Consecuencia buscada: al ALEJAR el
// zoom las cotas desaparecen solas y al ACERCAR reaparecen, sin que nadie las
// apague. De ahí que este módulo se suscriba a `zoomend` y a `moveend` del mapa
// (y se dé de baja en `destruir()`: una fuga de listeners de mapa es justo lo que
// `viewer/index.js` desmonta en orden inverso).
//
// ── Por qué `latLngToLayerPoint` y no `containerPoint` ni `project` ──────────
// Las tres sirven para medir: las tres se diferencian de las otras en una
// TRASLACIÓN (origen de píxeles del pane, del contenedor o del CRS), y una
// traslación no cambia una distancia. Se elige `latLngToLayerPoint` porque es
// EXACTAMENTE el espacio en el que Leaflet coloca los marcadores (`Marker._setPos`
// usa `latLngToLayerPoint`): así el número de píxeles que medimos ES la distancia
// entre los dos iconos de vértice que el usuario ve, no una magnitud parecida.
// `latLngToContainerPoint` añade además el desplazamiento del contenedor, que bajo
// jsdom (sin layout) es justo la parte que puede no ser real; y `project` exige
// pasar el zoom a mano, con lo que se puede medir contra una vista que ya no es la
// actual. Se usa esta y solo esta, en todo el módulo.
//
// ── Por qué las cotas NO son interactivas ────────────────────────────────────
// `interactive: false`, sin excepción. En F06 el clic sobre un lado INSERTA un
// vértice; si la cota —que vive justo encima del punto medio del lado, que es
// donde más se pincha— interceptara el puntero, la función más usada de la fase
// dejaría de funcionar. Leaflet ya pone `pointer-events:none` a un
// `.leaflet-marker-icon` sin `.leaflet-interactive` (leaflet.css), pero el rótulo
// lo repite EN LÍNEA: `viewer/*` no importa la hoja de Leaflet (va solo en la
// entrada `app/main.js`), y una capa que se traga clics porque falta un CSS es
// una regresión invisible.
//
// ── Por qué `L.divIcon` y no `L.Icon` (hallazgo C8 de F03) ──────────────────
// `L.Icon` depende de los PNG que Leaflet trae en `dist/images`, y con Vite esas
// URLs se rompen si no se configuran los assets a mano. Un `divIcon` con estilo en
// línea no descarga nada: se ve igual en dev, en build y en jsdom.
//
// ── Frontera de vista (regla de oro 3) ──────────────────────────────────────
// Todo lo que entra es UTM y todo lo que se MIDE es UTM: la longitud sale de
// `geo/metrica.js#longitudesDeLados` (euclídea sobre metros) y el punto medio es
// la media aritmética de los dos extremos EN UTM. lat/lon aparece solo al final,
// para colocar el marcador, y solo por `vertUTMaLatLng`. `turf.length`,
// `turf.distance` y `turf.midpoint` están PROHIBIDAS (regla de oro 6): son
// geodésicas esféricas sobre grados y aquí las coordenadas son metros.
//
// SOLO-NAVEGADOR: este módulo importa Leaflet, así que su test lleva el sufijo
// `.dom` y JAMÁS entra en el barrel raíz `index.js` (rompería la suite `node`:
// Leaflet exige `window`). Lo vigila `test/contrato.test.js`.

import L from 'leaflet'

import { COLOR_USUARIO, NIVEL, PANE, resolverAvisar, vertUTMaLatLng } from './_comun.js'
import { OPERATIVOS } from '../config/operativos.js'
import { HUSOS_VALIDOS } from '../geo/huso.js'
import { longitudesDeLados } from '../geo/metrica.js'

// ── Constantes ───────────────────────────────────────────────────────────────

/**
 * Clase CSS del rótulo de una cota. ESTABLE: `estilos/app.css` afina sobre ella
 * (cursor, tipografía fina, ajustes de impresión…) sin que este módulo tenga que
 * importar CSS. Lo imprescindible para que la cota se LEA va en línea, igual que
 * en el vértice de `viewer/sincronizacion.js`.
 */
export const CLASE_ACOTACION = 'gml-acotacion'

/**
 * Decimales de la longitud rotulada: 2 = **centímetro**.
 *
 * Esto SÍ lo permite la regla de oro 11 explícitamente («redondear solo al
 * serializar»; aquí no se serializa nada, se PRESENTA). El modelo no se toca: el
 * número redondeado nace en esta función y muere en un `textContent`. Y son 2 y no
 * 3 porque 2 es la precisión con la que sale el GML (override O6) y con la que el
 * resto de la app expresa metros: rotular milímetros sobre una ortofoto sería
 * fingir una precisión que ni el dato ni la pantalla tienen.
 */
const DECIMALES_LONGITUD = 2

/**
 * Formateador español. `Intl.NumberFormat('es-ES')` y no
 * `toFixed().replace('.', ',')`, igual que en `app/main.js`: el separador decimal
 * español es la COMA y el de millares el punto, y eso lo sabe el ICU, no nosotros.
 *
 * Y no es una formalidad. El español **no agrupa los números de cuatro cifras**
 * (`minimumGroupingDigits: 2`): un lado de 1.234,5 m se escribe `1234,50 m` y uno
 * de 12.345,5 m, `12.345,50 m`. Un `replace` casero habría puesto el punto en los
 * dos casos, y habría estado mal en el primero sin que nadie lo notara. Está fijado
 * en `test/viewer/acotaciones.dom.test.js`.
 */
const FORMATO_LONGITUD = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: DECIMALES_LONGITUD,
  maximumFractionDigits: DECIMALES_LONGITUD,
})

/**
 * Estilo EN LÍNEA del rótulo. Tres decisiones, y ninguna es cosmética:
 *
 * 1. **Píldora oscura semitransparente detrás del texto.** Una cota es TEXTO
 *    sobre una ortofoto, y una ortofoto cambia de asfalto casi blanco a arbolado
 *    en sombra dentro del MISMO encuadre. Ningún color de texto aguanta los dos
 *    fondos: el amarillo `COLOR_USUARIO` da ~1,4:1 sobre claro (ilegible — lo
 *    avisa su propio JSDoc en `_comun.js`) y el ámbar oscuro
 *    `--gml-color-usuario-sobre-claro` (#A16207) se hunde sobre sombra. La
 *    solución no es acertar el color del texto, es **dejar de depender del
 *    fondo**: se pinta uno propio. Contra la píldora `#111827`, el amarillo del
 *    usuario da ~12:1 — y el mismo 12:1 sobre asfalto que sobre arbolado.
 * 2. **El texto conserva `COLOR_USUARIO`.** La cota mide la geometría DEL
 *    USUARIO, y en este lienzo el amarillo es lo que significa «esto es tuyo»
 *    (frente al rojo catastral, el azul de la hidrografía y el verde de la
 *    vegetación). Cambiarlo a blanco rompería esa lectura; lo que había que
 *    arreglar era el contraste, no la identidad.
 * 3. **`transform: translate(-50%,-50%)` en el rótulo INTERIOR, nunca en el
 *    elemento del icono.** Leaflet posiciona cada marcador con un
 *    `transform: translate3d(...)` sobre el elemento raíz del icono; declarar ahí
 *    otro transform lo pisaría y mandaría la cota a otro sitio (es la advertencia
 *    que `estilos/app.css` ya deja escrita para `.gml-vertice`). Como el icono se
 *    monta con `iconSize: null`, su caja mide 0×0 y su esquina cae justo en el
 *    punto medio del lado: un hijo `inline-block` arranca ahí y el translate del
 *    50% lo centra, sin necesidad de `position:absolute` ni de que la hoja de
 *    Leaflet esté cargada.
 */
const ESTILO_ROTULO =
  'display:inline-block;transform:translate(-50%,-50%);' +
  'white-space:nowrap;pointer-events:none;' +
  'font:600 11px/1.35 ui-sans-serif,system-ui,sans-serif;font-variant-numeric:tabular-nums;' +
  `color:${COLOR_USUARIO};background:rgba(17,24,39,.82);` +
  'padding:1px 5px;border-radius:3px;'

/**
 * Un ÚNICO `L.divIcon` para todas las cotas: `createIcon()` fabrica un elemento
 * nuevo en cada uso, así que compartirlo es seguro y más barato (mismo patrón que
 * `viewer/sincronizacion.js#iconoVertice`). El rótulo nace vacío y el texto se
 * escribe después sobre el DOM, para no fabricar un icono por cada cambio de cifra
 * durante un arrastre.
 *
 * `iconSize: null` es deliberado y no un olvido: `L.DivIcon` trae `[12,12]` por
 * defecto, y una cota no tiene ancho fijo — lo fija su texto. Con `null`, Leaflet
 * no escribe `width`/`height` ni márgenes de anclaje y la caja del icono queda en
 * 0×0 sobre el punto medio, que es exactamente el ancla que queremos.
 * `className` sustituye a `leaflet-div-icon`, con lo que también nos quitamos su
 * recuadro blanco por defecto.
 */
const ICONO_ACOTACION = L.divIcon({
  className: CLASE_ACOTACION,
  iconSize: null,
  html: `<span style="${ESTILO_ROTULO}"></span>`,
})

// ── Helpers de módulo (puros) ────────────────────────────────────────────────

/** Describe un valor para un mensaje de contrato roto. */
function describir(valor) {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/** ¿Es un par UTM `[x,y]` utilizable (finito en las dos componentes)? */
function esParUTM(v) {
  return Array.isArray(v) && v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1])
}

/**
 * Rótulo legible del recinto `i`, solo para los mensajes de aviso. Misma
 * convención que `viewer/sincronizacion.js` (donde el helper es privado y no se
 * puede importar): `recintos[0]` es SIEMPRE el EXTERIOR y el resto son huecos,
 * numerados desde 1 para el humano.
 */
function rotuloRecinto(i) {
  return i === 0 ? 'EXTERIOR' : `HUECO ${i}`
}

/** ¿Misma forma? (mismo nº de recintos y mismo nº de LADOS en cada uno). */
function mismaForma(a, b) {
  if (a === null || b === null) return false
  return a.length === b.length && a.every((n, i) => n === b[i])
}

/**
 * Texto con el que se rotula una longitud: metros con 2 decimales y separadores
 * españoles. Exportada para que los tests (y F09, que acotará también en el
 * informe) comparen contra ESTA función y no contra una copia del formato.
 *
 * @param {number} metros
 * @returns {string}  P. ej. `'20,00 m'`, `'1.234,56 m'`.
 */
export function textoDeLongitud(metros) {
  return `${FORMATO_LONGITUD.format(metros)} m`
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('./_comun.js').RefVertice} RefVertice
 */

/**
 * @typedef {Object} Acotaciones
 * @property {(anillosUTM: Array<Array<[number,number]>>, opciones?: {soloRef?: RefVertice|null}) => void} pintar
 * @property {() => void} destruir
 */

/**
 * Crea la capa de acotaciones: un rótulo con la longitud de CADA lado, en su
 * punto medio, filtrado por longitud en pantalla.
 *
 * Política de errores (SPEC §2, regla 1):
 *   · Contrato roto por el PROGRAMADOR → `throw`. `mapa` que no es un `L.Map`,
 *     `zona` fuera de 29/30/31, `minimoPx` no finito, falta el pane, `alAvisar`
 *     que no es función, `anillosUTM` que no es un array, `soloRef` con forma
 *     inválida.
 *   · Dato DEGENERADO del modelo → **no lanza**. Un anillo de menos de 3 vértices
 *     no tiene lados que acotar (`longitudesDeLados` devuelve `[]`, y señalar esa
 *     degeneración es trabajo de F02, no de una capa de dibujo): se ignora en
 *     silencio. Un vértice no finito sí se AVISA —`NIVEL.AVISO`, porque no impide
 *     generar el GML— una sola vez por llamada, y los lados sanos se siguen
 *     acotando.
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa  Mapa ya creado (`viewer/mapa.js`), con
 *   el pane `PANE.ACOTACIONES` ya montado (lo crea `crearMapa` iterando `PANES`).
 * @param {number} args.zona  Huso UTM (29, 30 o 31).
 * @param {number} [args.minimoPx=OPERATIVOS.acotacionMinimaPx]  Longitud MÍNIMA
 *   en píxeles de pantalla para que un lado se rotule. El defecto es la cifra de
 *   `config/operativos.json`; se admite otro valor porque el umbral es una
 *   decisión de legibilidad, no una ley (regla de oro 9).
 * @param {import('./_comun.js').Avisar} [args.alAvisar]  Canal de aviso.
 * @returns {Acotaciones}
 */
export function crearAcotaciones({ mapa, zona, minimoPx = OPERATIVOS.acotacionMinimaPx, alAvisar } = {}) {
  // ── Contratos del programador: throw, nunca corrección callada ─────────────
  if (
    !mapa ||
    typeof mapa.addLayer !== 'function' ||
    typeof mapa.removeLayer !== 'function' ||
    typeof mapa.latLngToLayerPoint !== 'function' ||
    typeof mapa.on !== 'function' ||
    typeof mapa.off !== 'function'
  ) {
    // Se comprueban las CINCO que este módulo usa de verdad (incluida
    // `latLngToLayerPoint`, que es con la que mide): un guardián que solo mira
    // `addLayer` deja pasar dobles de test que después revientan dentro.
    throw new TypeError(
      `crearAcotaciones: 'mapa' debe ser un L.Map (con addLayer/removeLayer/` +
        `latLngToLayerPoint/on/off); recibido ${describir(mapa)}.`,
    )
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `crearAcotaciones: 'zona' inválida: ${JSON.stringify(zona)}. Válidas: ${HUSOS_VALIDOS.join(', ')}.`,
    )
  }
  if (!Number.isFinite(minimoPx) || minimoPx < 0) {
    throw new TypeError(
      `crearAcotaciones: 'minimoPx' debe ser un número finito ≥ 0 (píxeles de ` +
        `pantalla); recibido ${JSON.stringify(minimoPx)}.`,
    )
  }
  if (typeof mapa.getPane !== 'function' || !mapa.getPane(PANE.ACOTACIONES)) {
    throw new TypeError(
      `crearAcotaciones: falta el pane '${PANE.ACOTACIONES}'. Créalo con los ` +
        `nombres de viewer/_comun.js#PANES antes de acotar (la cota debe quedar ` +
        `sobre la geometría editada y bajo los vértices).`,
    )
  }

  const avisar = resolverAvisar(alAvisar)

  // ── Estado interno ────────────────────────────────────────────────────────
  let vivo = true
  /**
   * `entradas[recinto][lado]` → una cota. Se REUTILIZAN (ver `pintar`): cada
   * entrada guarda su marcador, su rótulo del DOM y lo último que se pintó, para
   * no reescribir el DOM cuando nada ha cambiado.
   *
   * @type {Array<Array<{marcador: import('leaflet').Marker|null, elemento: HTMLElement|null,
   *   rotulo: Element|null, a: [number,number]|null, b: [number,number]|null,
   *   texto: string|null, visible: boolean|null}>>}
   */
  let entradas = []
  /** Nº de LADOS por recinto del último pintado. `null` = aún no se ha pintado. */
  let forma = null
  /** Un solo aviso de dato degenerado por llamada a `pintar` (no 500). */
  let avisadoDegenerado = false

  // ── Medida en pantalla ────────────────────────────────────────────────────

  /**
   * Longitud del lado EN PÍXELES de pantalla, entre sus dos extremos ya
   * proyectados. Ver la cabecera para por qué `latLngToLayerPoint`.
   *
   * @param {[number,number]} aLatLng
   * @param {[number,number]} bLatLng
   * @returns {number}
   */
  function longitudEnPx(aLatLng, bLatLng) {
    const pa = mapa.latLngToLayerPoint(aLatLng)
    const pb = mapa.latLngToLayerPoint(bLatLng)
    return Math.hypot(pa.x - pb.x, pa.y - pb.y)
  }

  /**
   * Aplica (o revisa) la visibilidad de una cota según su longitud EN PANTALLA.
   * No proyecta nada nuevo: reutiliza los extremos ya guardados, que es lo que
   * permite que `zoomend`/`moveend` no vuelvan a desproyectar 500 puntos.
   *
   * Se oculta con `display:none` en vez de sacar el marcador del mapa: el gesto
   * caro es crear/destruir capas, no dejar un nodo oculto (que ni pinta ni
   * maqueta). `viewer/sincronizacion.js` ya mantiene un marcador por vértice en el
   * mapa de forma permanente; esto es el mismo orden de magnitud.
   *
   * @param {object} entrada
   */
  function aplicarVisibilidad(entrada) {
    if (!entrada.marcador || !entrada.a || !entrada.b) return
    const visible = longitudEnPx(entrada.a, entrada.b) > minimoPx
    if (entrada.visible === visible) return
    entrada.visible = visible
    const el = elementoDe(entrada)
    if (el) el.style.display = visible ? '' : 'none'
  }

  /** Revisa TODAS las cotas tras un cambio de vista (el zoom cambia los píxeles). */
  function revisarVisibilidad() {
    if (!vivo) return
    for (const fila of entradas) {
      if (!fila) continue
      for (const entrada of fila) if (entrada) aplicarVisibilidad(entrada)
    }
  }

  // ── Marcadores ────────────────────────────────────────────────────────────

  /** El elemento del icono, re-derivado si la referencia cacheada se perdió. */
  function elementoDe(entrada) {
    if (entrada.elemento) return entrada.elemento
    const el = entrada.marcador ? entrada.marcador.getElement() : null
    entrada.elemento = el || null
    entrada.rotulo = el ? el.firstElementChild : null
    return entrada.elemento
  }

  /** El `<span>` del rótulo (el que lleva el texto), re-derivado si hace falta. */
  function rotuloDe(entrada) {
    if (entrada.rotulo) return entrada.rotulo
    const el = elementoDe(entrada)
    entrada.rotulo = el ? el.firstElementChild : null
    return entrada.rotulo
  }

  /**
   * Crea el marcador de una cota. Nace OCULTO (`visible: null` fuerza el primer
   * `aplicarVisibilidad` a escribir el `display` que toque), sin interacción y sin
   * entrar en el orden de tabulación: al teclado se llega por la tabla de
   * vértices, y 500 paradas de tabulador en rótulos no accionables serían una
   * trampa de accesibilidad, no una ayuda.
   *
   * @param {object} entrada
   * @param {number} r  Índice de recinto.
   * @param {number} i  Índice de lado (`v[i] → v[(i+1)%n]`).
   * @param {[number,number]} latlng  Punto medio ya proyectado.
   */
  function crearMarcador(entrada, r, i, latlng) {
    const marcador = L.marker(latlng, {
      pane: PANE.ACOTACIONES,
      icon: ICONO_ACOTACION,
      interactive: false,
      keyboard: false,
    })
    marcador.addTo(mapa)
    entrada.marcador = marcador
    entrada.elemento = null
    entrada.rotulo = null

    const el = elementoDe(entrada)
    if (el) {
      // Segunda línea de defensa del clic: leaflet.css ya deja en
      // `pointer-events:none` a todo `.leaflet-marker-icon` sin
      // `.leaflet-interactive`, pero `viewer/*` no importa esa hoja (va en
      // `app/main.js`), así que la cota no puede depender de que esté cargada.
      el.style.pointerEvents = 'none'
      // Contrato de inspección: `data-recinto`/`data-lado` son la dirección del
      // lado (`v[lado] → v[(lado+1)%n]`), igual que `data-recinto`/`data-indice`
      // ES la RefVertice en la tabla de `viewer/sincronizacion.js`.
      el.dataset.recinto = String(r)
      el.dataset.lado = String(i)
    }
  }

  /** Quita del mapa el marcador de una entrada y suelta sus referencias al DOM. */
  function quitarEntrada(entrada) {
    if (!entrada || !entrada.marcador) return
    mapa.removeLayer(entrada.marcador)
    entrada.marcador = null
    entrada.elemento = null
    entrada.rotulo = null
  }

  /** Entrada vacía: aún sin marcador (se crea al tener un punto medio real). */
  function entradaNueva() {
    return { marcador: null, elemento: null, rotulo: null, a: null, b: null, texto: null, visible: null }
  }

  /**
   * Ajusta la estructura de `entradas` a una forma nueva creando o destruyendo
   * SOLO la diferencia. Insertar un vértice cambia `n` en 1: reconstruirlo todo
   * tiraría 500 marcadores para volver a crear 501.
   *
   * @param {number[]} nuevaForma  Nº de lados por recinto.
   */
  function ajustarForma(nuevaForma) {
    for (let r = nuevaForma.length; r < entradas.length; r++) {
      for (const entrada of entradas[r] || []) quitarEntrada(entrada)
    }
    entradas.length = nuevaForma.length

    for (let r = 0; r < nuevaForma.length; r++) {
      const n = nuevaForma[r]
      if (!entradas[r]) entradas[r] = []
      const fila = entradas[r]
      for (let i = n; i < fila.length; i++) quitarEntrada(fila[i])
      fila.length = n
      for (let i = 0; i < n; i++) if (!fila[i]) fila[i] = entradaNueva()
    }
  }

  // ── Pintado ───────────────────────────────────────────────────────────────

  /**
   * Un vértice del modelo no es finito: se avisa UNA vez por llamada (un arrastre
   * sobre una geometría rota generaría si no un aviso por lado y por frame).
   */
  function avisarDegenerado(r, i) {
    if (avisadoDegenerado) return
    avisadoDegenerado = true
    avisar(
      `No se ha podido acotar el lado ${i + 1} de ${rotuloRecinto(r)}: alguno de ` +
        `sus extremos no tiene coordenadas numéricas. El resto de lados sí se acota.`,
      // AVISO y no ERROR: no se bloquea nada (ver la regla de clasificación junto
      // al typedef `Avisar` de `viewer/_comun.js`); solo falta un rótulo.
      { nivel: NIVEL.AVISO },
    )
  }

  /**
   * Repinta UN lado: proyecta sus extremos y su punto medio, escribe el texto si
   * ha cambiado y decide si se ve.
   *
   * @param {number} r        Índice de recinto.
   * @param {number} i        Índice de lado.
   * @param {Array<[number,number]>} anillo  Anillo ABIERTO en UTM.
   * @param {number[]} longitudes            Longitudes de ESE anillo (metros).
   */
  function actualizarLado(r, i, anillo, longitudes) {
    const entrada = entradas[r] && entradas[r][i]
    if (!entrada) return

    const n = anillo.length
    const a = anillo[i]
    const b = anillo[(i + 1) % n] // `% n` ⇒ el último lado es el de CIERRE
    const longitud = longitudes[i]

    if (!esParUTM(a) || !esParUTM(b) || !Number.isFinite(longitud)) {
      // Dato degenerado: no se lanza, se oculta la cota y se avisa una vez.
      avisarDegenerado(r, i)
      entrada.a = null
      entrada.b = null
      if (entrada.marcador && entrada.visible !== false) {
        entrada.visible = false
        const el = elementoDe(entrada)
        if (el) el.style.display = 'none'
      }
      return
    }

    // Punto medio EN UTM (media aritmética) y solo después se proyecta: el modelo
    // es UTM (regla 3) y `turf.midpoint` está prohibida (regla 6).
    const medio = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    entrada.a = vertUTMaLatLng(a, zona)
    entrada.b = vertUTMaLatLng(b, zona)
    const medioLatLng = vertUTMaLatLng(medio, zona)

    if (entrada.marcador) entrada.marcador.setLatLng(medioLatLng)
    else crearMarcador(entrada, r, i, medioLatLng)

    const texto = textoDeLongitud(longitud)
    if (entrada.texto !== texto) {
      entrada.texto = texto
      const rotulo = rotuloDe(entrada)
      if (rotulo) rotulo.textContent = texto
    }

    aplicarVisibilidad(entrada)
  }

  /**
   * Pinta las acotaciones de una geometría.
   *
   * ── Rendimiento: por qué existe `soloRef` ─────────────────────────────────
   * Un pintado completo es O(nº de lados) y, con el techo de 500 vértices, son
   * 500 desproyecciones de Krüger + 500 escrituras al DOM. Repetir eso en cada
   * frame de un arrastre es lo que hay que evitar: con `soloRef` se repintan
   * ÚNICAMENTE los dos lados que tocan el vértice movido (`indice−1 → indice` e
   * `indice → indice+1`, con el módulo del anillo, así que el vértice 0 arrastra
   * el lado de CIERRE). Los marcadores se reutilizan siempre que la forma no
   * cambie —ni se destruyen ni se recrean—, exactamente como hace
   * `viewer/sincronizacion.js` con los vértices y por el mismo motivo.
   *
   * Las LONGITUDES sí se recalculan enteras en cada llamada, a propósito: son
   * `Math.hypot` sobre metros (microsegundos para 500 lados) y salen de una sola
   * función, `geo/metrica.js#longitudesDeLados`. Tener aquí una segunda fórmula
   * "para el caso rápido" es justo como dos capas acaban midiendo distinto.
   *
   * @param {Array<Array<[number,number]>>} anillosUTM  Un array por recinto, en
   *   UTM y con los anillos ABIERTOS (el último lado es el de cierre).
   * @param {object} [opciones]
   * @param {RefVertice|null} [opciones.soloRef=null]  Si viene, se repintan solo
   *   los dos lados que tocan ese vértice. Con `null`, repintado completo.
   * @returns {void}
   */
  function pintar(anillosUTM, { soloRef = null } = {}) {
    // Tras `destruir()` esto es un no-op y no un throw: el desmontaje del visor va
    // en orden inverso (`viewer/index.js`) y una notificación en vuelo puede llegar
    // después. Mismo criterio que la guarda `vivo` de `viewer/sincronizacion.js`.
    if (!vivo) return

    if (!Array.isArray(anillosUTM)) {
      throw new TypeError(
        `pintar: 'anillosUTM' debe ser un array de anillos UTM abiertos ` +
          `([[[x,y],…],…]); recibido ${describir(anillosUTM)}.`,
      )
    }
    const hayRef = soloRef !== null && soloRef !== undefined
    if (
      hayRef &&
      (typeof soloRef !== 'object' ||
        !Number.isInteger(soloRef.recinto) ||
        !Number.isInteger(soloRef.indice))
    ) {
      throw new TypeError(
        `pintar: 'soloRef' debe ser una RefVertice {recinto:number, indice:number} ` +
          `o null; recibido ${JSON.stringify(soloRef)}.`,
      )
    }

    avisadoDegenerado = false

    // UNA sola fuente para las longitudes, siempre (ver JSDoc de arriba).
    const longitudes = anillosUTM.map((anillo) =>
      longitudesDeLados(Array.isArray(anillo) ? anillo : []),
    )
    const nuevaForma = longitudes.map((l) => l.length)
    const formaIgual = mismaForma(forma, nuevaForma)

    if (!formaIgual) {
      ajustarForma(nuevaForma)
      forma = nuevaForma
    }

    // Repintado PARCIAL: solo si la forma no ha cambiado. Si ha cambiado, los
    // índices de `soloRef` se refieren a un anillo que ya no es el pintado y
    // repintar dos lados dejaría los otros 498 mintiendo: se pinta entero.
    if (hayRef && formaIgual) {
      const { recinto: r, indice } = soloRef
      const anillo = anillosUTM[r]
      if (!Array.isArray(anillo)) {
        avisar(
          `No se han podido actualizar las acotaciones: el recinto ${r} ya no ` +
            `existe en la parcela.`,
          { nivel: NIVEL.AVISO },
        )
        return
      }
      const n = nuevaForma[r] || 0
      // Anillo de menos de 3 vértices: no tiene lados que acotar. Es el contrato
      // documentado de `longitudesDeLados` (`[]`), no una anomalía, y señalar la
      // degeneración es trabajo de F02: aquí no hay nada que pintar ni que avisar.
      if (n === 0) return
      if (indice < 0 || indice >= n) {
        avisar(
          `No se han podido actualizar las acotaciones: ${rotuloRecinto(r)} ya no ` +
            `tiene un vértice ${indice + 1}.`,
          { nivel: NIVEL.AVISO },
        )
        return
      }
      // Los DOS lados que TOCAN el vértice: el que llega y el que sale. Con el
      // módulo del anillo, el vértice 0 arrastra el lado de cierre (n−1).
      actualizarLado(r, (indice - 1 + n) % n, anillo, longitudes[r])
      actualizarLado(r, indice, anillo, longitudes[r])
      return
    }

    for (let r = 0; r < nuevaForma.length; r++) {
      const anillo = anillosUTM[r]
      if (!Array.isArray(anillo)) continue
      for (let i = 0; i < nuevaForma[r]; i++) actualizarLado(r, i, anillo, longitudes[r])
    }
  }

  // ── Arranque ──────────────────────────────────────────────────────────────

  // El umbral es en PÍXELES, así que la respuesta cambia con el zoom aunque la
  // geometría no se mueva: hay que revisar en `zoomend` y en `moveend`. Se
  // registra el MISMO handler para los dos tipos (forma admitida por Leaflet:
  // `on('a b', fn)`), lo que garantiza que la baja de `destruir()` sea simétrica.
  mapa.on('zoomend moveend', revisarVisibilidad)

  return {
    pintar,

    /**
     * Deshace todo: marcadores, referencias al DOM y los listeners del MAPA.
     * Idempotente, como todo desmontaje del visor.
     */
    destruir() {
      if (!vivo) return
      vivo = false
      mapa.off('zoomend moveend', revisarVisibilidad)
      for (const fila of entradas) {
        if (!fila) continue
        for (const entrada of fila) quitarEntrada(entrada)
      }
      entradas = []
      forma = null
      avisadoDegenerado = false
    },
  }
}
