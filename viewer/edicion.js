// viewer/edicion.js — F06 · La INTERACCIÓN de edición: gestos del mapa → modelo.
//
// `edit/snap.js`, `edit/offset.js` y `edit/vertices.js` son módulos PUROS: saben
// geometría y no saben que existe un ratón. `viewer/sincronizacion.js` sabe
// pintar y arrastrar, pero deliberadamente no inserta, no elimina y no engancha
// («Qué es de F06 y NO está aquí», en su cabecera). Este módulo es la bisagra
// entre las dos mitades: convierte gestos en operaciones y publica lo que esas
// operaciones cuentan.
//
// Es dueño de CUATRO cosas y de ninguna más:
//   1. la TECLA MODIFICADORA que apaga el snap,
//   2. el INDICADOR de enganche mientras dura el gesto,
//   3. el RESALTE del lado seleccionado,
//   4. las TRES operaciones que escriben en el modelo (insertar, eliminar,
//      desplazar lindero).
// No pinta la parcela, no pinta la tabla, no crea marcadores y no toca la
// `geometriaOficial` (regla de oro 2: aquí solo se lee, y solo como diana de
// snap). Quien dibuja sigue siendo `viewer/sincronizacion.js`.
//
// ── EL MAPA DE GESTOS (esto es lo que leerá quien escriba la ayuda) ──────────
//
//   · **Clic** en el mapa .......... SELECCIONA el lindero más cercano al punto
//     pinchado, si cae dentro de {@link UMBRAL_PUNTERIA_PX} píxeles. Si no cae
//     ninguno, DESELECCIONA. **Un clic no escribe NUNCA en el modelo**: cambia un
//     resalte, y nada más. Esa es la garantía; el resto de este apartado son
//     consecuencias de ella.
//   · **Doble clic** en el mapa .... INSERTA un vértice en el lindero más cercano
//     (proyectado sobre el lado, no en el punto crudo del clic). Es el ÚNICO
//     gesto del mapa que modifica la geometría.
//     ⚠️ Un doble clic contiene dos clics, y Leaflet los emite igualmente. O sea
//     que el gesto completo es: seleccionar ese lado (dos veces, idempotente) y
//     luego insertar en él. Es coherente —el vértice cae justo en el lado que
//     acaba de quedar resaltado— y sigue cumpliendo la regla: lo único que ha
//     escrito en el modelo es el DOBLE clic. Se descarta la alternativa de
//     retrasar la selección con un temporizador: metería latencia visible en el
//     gesto más frecuente (seleccionar) para arreglar algo que no está roto.
//     ⚠️ Además se DESACTIVA `doubleClickZoom` mientras este módulo vive (y se
//     restaura en `destruir`): insertar un vértice y ampliar el mapa con el mismo
//     gesto sí sería un efecto sorpresa.
//   · **Menú contextual** sobre un vértice ... lo ELIMINA. Se cablea desde
//     {@link crearEdicion} → `alCrearMarcador`, y se llama a
//     `L.DomEvent.preventDefault` para que no salga además el menú del navegador.
//   · **`Alt`** ..................... mientras está pulsada, el snap NO engancha.
//
// ── POR QUÉ `Alt` Y NO `Ctrl` NI `Shift` ────────────────────────────────────
// `Ctrl` colisiona con el zoom por rueda y con el pan de Leaflet; `Shift`, con su
// `boxZoom`. `Alt` es la única de las tres que Leaflet no usa. Y se lee por DOS
// caminos, porque ninguno de los dos basta solo:
//   · **Del evento real** (`eventoOriginal.altKey`) cuando lo hay. Es la verdad
//     del sistema operativo en el instante del gesto, y por eso TIENE PRIORIDAD.
//   · **De un seguimiento propio** de `keydown`/`keyup` sobre `document` cuando no
//     lo hay: un arrastre simulado por API (los tests, y cualquier automatismo
//     futuro) no trae evento original.
// El seguimiento se desincroniza si la ventana pierde el foco con la tecla
// pulsada —soltar `Alt` fuera de la pestaña no emite `keyup` aquí—, así que hay
// una guarda en el `blur` de la ventana que baja la bandera. Sin ella, el snap se
// quedaría apagado PARA SIEMPRE y EN SILENCIO: el error silencioso de manual.
// Y cuando llega un evento real, su `altKey` además RESINCRONIZA la bandera: la
// verdad del sistema corrige al seguimiento, nunca al revés.
//
// ── LA CACHÉ DE DIANAS, Y SU POLÍTICA DE INVALIDACIÓN ───────────────────────
// `dianasDe` recorre el parcelario oficial, las colindantes y la geometría
// editable, y copia cada par `[x,y]`: sobre un catálogo lleno cuesta del orden de
// milisegundos. `ajustar` cuesta una fracción de eso y se llama en CADA fotograma
// del arrastre. Reconstruir el catálogo por fotograma se come el cuadro; por eso
// se construye UNA VEZ POR GESTO y se cachea.
//
// El catálogo se invalida —y esto es donde se esconden los bugs de esta clase, así
// que va escrito— cuando cambia CUALQUIERA de sus tres entradas:
//   1. **El estado**. Se compara la IDENTIDAD del POJO (`estado.get() !== cache.parcela`)
//      en cada consulta, y además se invalida desde el suscriptor del store. Hacen
//      falta las dos: el suscriptor NO se dispara en un `set` reentrante (la guarda
//      anti-reentrada de `crearEstadoVista` corta la cascada), y la comparación de
//      identidad no vería un `set` con el MISMO objeto mutado en sitio. Cada una
//      tapa el agujero de la otra. (Que nadie mute el estado en sitio es la regla
//      de la casa —`sincronizacion.js#aplicarVertice` clona— pero una caché que
//      depende de que nadie se equivoque no es una caché, es una apuesta.)
//   2. **Las colindantes**, por {@link crearEdicion}#fijarColindantes: guarda una
//      COPIA superficial, así que cada llamada cambia la identidad del array y la
//      caché cae sola.
//   3. **El vértice excluido** (`excluir`), o sea la `RefVertice` del gesto. Cambia
//      al empezar a arrastrar otro vértice, que es exactamente «otro gesto».
// Lo que NO invalida: cambiar τ (`tolerancia(m)`) o encender/apagar el snap. El
// catálogo no depende de la tolerancia —τ solo se usa al comparar distancias—, y
// tirarlo por eso obligaría a reconstruirlo al soltar la tecla `Alt`, en mitad del
// arrastre. `destruir()` lo vacía.
//
// ── `excluir`: SE PASA SIEMPRE, Y LO PASA ESTE MÓDULO ───────────────────────
// `edit/snap.js` sabe quitar del catálogo el vértice arrastrado y sus dos lados,
// pero solo si alguien le dice cuál es. Ese alguien es este módulo: cada `ajustar`
// pasa la `RefVertice` del gesto como `excluir`. Sin eso el vértice se engancha a
// sí mismo (distancia 0, gana siempre) y queda CLAVADO en su sitio.
//
// ── CLASIFICACIÓN DE LOS AVISOS (la regla, no la intuición) ─────────────────
// Se aplica la REGLA DE CLASIFICACIÓN del typedef `Avisar` de `viewer/_comun.js`,
// con el precedente de `sincronizacion.js#aplicarVertice`:
//   · La operación que el usuario ha pedido **NO se aplica** → `NIVEL.ERROR`.
//     (Insertar demasiado lejos, insertar sobre un vértice que ya existe, eliminar
//     por debajo del mínimo de vértices, desplazar sin lado seleccionado, desplazar
//     0 m…)
//   · La operación **se aplica pero degradada** → `NIVEL.AVISO`. («Te lo he movido,
//     pero he biselado el pico»; «te lo he movido, pero no sé de qué lado está el
//     fuera de este anillo».)
// El nivel de las detecciones de `edit/offset.js` NO se decide con un catálogo de
// tipos —que quedaría desfasado en cuanto naciera un tipo nuevo— sino midiendo si
// el anillo cambió: si no cambió, la operación no se aplicó y TODO lo que cuenta
// es ERROR; si cambió, es AVISO. Un `TIPO_OFFSET` nuevo cae solo del lado correcto.
//
// **Los textos no se reescriben.** `edit/offset.js#MENSAJE_OFFSET` y
// `edit/vertices.js#MENSAJE_POR_MOTIVO` ya están redactados en español y son
// presentables tal cual: se publican VERBATIM. Dos textos para el mismo suceso
// divergen, y el que se queda viejo es siempre el de la UI.
//
// SOLO-NAVEGADOR: importa Leaflet, así que su test lleva sufijo `.dom` y este
// módulo NUNCA entra por el barrel raíz `index.js` (rompería la suite `node`:
// Leaflet exige `window`). Lo vigila `test/contrato.test.js`.
//
// NOTA DE DEUDA: `rotuloRecinto`, `describir`, `anillosDe` y `esHistorialUsable`
// son gemelas de las de `viewer/sincronizacion.js`, que las tiene privadas. Están
// duplicadas a propósito: extraerlas exigiría editar `_comun.js` o
// `sincronizacion.js`, y las dos tareas corren en paralelo con esta. La extracción
// queda pendiente para cuando la fase esté en un solo árbol.

import L from 'leaflet'

import { OPERATIVOS } from '../config/operativos.js'
import { commit as commitHistorial } from '../edit/historial.js'
import { desplazarLado } from '../edit/offset.js'
import { TIPO_ENGANCHE, ajustar as engancharPunto, dianasDe } from '../edit/snap.js'
import { MENSAJE_POR_MOTIVO, eliminarVertice, insertarVertice } from '../edit/vertices.js'
import { HUSOS_VALIDOS } from '../geo/huso.js'
import { distancia as distanciaEntre } from '../geo/metrica.js'
import { LONGITUD_NULA_METROS, proyectarEnSegmento } from '../geo/segmento.js'
import { COLOR_USUARIO, NIVEL, PANE, latLngAUTM, resolverAvisar, vertUTMaLatLng } from './_comun.js'

// ── Constantes ───────────────────────────────────────────────────────────────

/**
 * Radio de PUNTERÍA, **en píxeles de pantalla**, para el clic que selecciona un
 * lindero y para el doble clic que inserta un vértice: si el lindero más cercano
 * queda a más de esto del punto pinchado, no se selecciona ni se inserta nada.
 *
 * ── Por qué en píxeles y no en metros ──
 * Esto no es una tolerancia de TERRENO (esa es τ, `OPERATIVOS.snapMetros`, y va en
 * metros porque mide la precisión del parcelario). Es una tolerancia de PUNTERÍA:
 * mide cuánto se desvía la mano de quien apunta con un ratón, y eso se mide en
 * pantalla. Un umbral en metros acertaría en un zoom y mentiría en todos los
 * demás: 20 cm son varios píxeles a escala de parcela y una centésima de píxel en
 * la vista general, así que a poco que el usuario se alejara no habría forma
 * humana de insertar un vértice, sin que nada explicara por qué. Es la misma razón
 * por la que `OPERATIVOS.acotacionMinimaPx` va en píxeles, y está escrita en
 * `config/operativos.js`.
 *
 * ── Por qué 12 ──
 * Es algo mayor que el lado del cuadradito de vértice de
 * `viewer/sincronizacion.js` (10 px), de modo que cualquier clic que TOQUE
 * visualmente la línea cuenta, y del mismo orden que la tolerancia de clic que
 * Leaflet usa por defecto en su renderizador de canvas (10 px). No vive en
 * `config/operativos.json` porque no es una tolerancia de ingeniería del dato: es
 * el tamaño de la diana de un gesto, y solo lo usa este módulo.
 */
export const UMBRAL_PUNTERIA_PX = 12

/**
 * Clases CSS de las dos capas que este módulo pinta. **Estables**: `estilos/app.css`
 * y los tests apuntan a estos literales, no a copias.
 *
 * @readonly
 */
export const CLASE_EDICION = Object.freeze({
  /** Indicador de enganche (común a los dos tipos). */
  INDICADOR: 'gml-snap',
  /** Modificador: el enganche ha capturado un VÉRTICE. */
  INDICADOR_VERTICE: 'gml-snap--vertice',
  /** Modificador: el enganche ha capturado un punto de un LINDERO. */
  INDICADOR_LINDERO: 'gml-snap--lindero',
  /** Resalte del lado seleccionado. */
  RESALTE: 'gml-lado-seleccionado',
})

/**
 * Estilo del resalte del lado seleccionado: un TRAZO GRUESO Y TRASLÚCIDO del color
 * del usuario, por debajo de la línea de 2 px que ya pinta `sincronizacion.js`. El
 * efecto es un halo alrededor del lindero elegido.
 *
 * No se usa un color distinto a propósito: los tres tonos que quedaban libres en el
 * lienzo ya están razonados en `viewer/_comun.js#COLOR_USUARIO` (ni rojo, que es la
 * cartografía catastral; ni azul, que es la hidrografía; ni verde, que es la
 * vegetación de la ortofoto), así que inventar un cuarto color para el resalte sería
 * volver a pelearse con la misma imagen. Un halo del MISMO color dice «este lindero,
 * el tuyo» sin competir con nada.
 *
 * `interactive: false` es obligatorio: el resalte cubre justo el lindero, y si
 * capturara clics haría imposible volver a pinchar en él.
 */
const ESTILO_RESALTE = Object.freeze({
  color: COLOR_USUARIO,
  weight: 7,
  opacity: 0.55,
  lineCap: 'round',
  interactive: false,
  className: CLASE_EDICION.RESALTE,
})

/**
 * Lienzo del indicador de enganche, en px CSS.
 *
 * Los 10 px del cuadradito de vértice de `sincronizacion.js` mandan aquí: la silueta
 * tiene que RODEAR al vértice **con holgura visible**, que es como se lee «he
 * capturado ESTE punto» y no «aquí hay otro punto más». Medido en navegador
 * (2026-07-28): con la silueta a 11 px sobre un vértice de 10 px el resultado era un
 * cuadrado dentro de otro cuadrado, prácticamente del mismo tamaño, y no se
 * distinguía cuál era cuál. El cuadrado va ahora a **18 px**, o sea 4 px de aire por
 * cada lado, y el lienzo a 26 para que quepa el halo sin recortarse.
 */
const LADO_INDICADOR_PX = 26

/**
 * Halo oscuro que va DEBAJO del trazo de color en las dos siluetas. No es adorno:
 * es lo que hace que un dibujo de líneas se lea igual sobre asfalto claro que sobre
 * arbolado en sombra, que es el mismo problema que `viewer/acotaciones.js` resuelve
 * con una píldora detrás del texto. Un trazo amarillo suelto sobre hormigón claro da
 * ~1,4:1 (ver el JSDoc de `viewer/_comun.js#COLOR_USUARIO`) y desaparece.
 */
const HALO_INDICADOR = 'rgba(15,23,42,.85)'

/**
 * Silueta del indicador de enganche, POR TIPO — **la convención OSNAP de AutoCAD**.
 *
 * ── POR QUÉ LA FORMA Y NO EL RELLENO (esto es la decisión, no el dibujo) ─────
 * Antes los dos tipos eran DOS CÍRCULOS del mismo tamaño, uno macizo y otro hueco.
 * Es una distinción que sobre el papel se entiende y en pantalla no existe: ocurre a
 * mitad de un arrastre, a 20 px del puntero, sobre una ortofoto de contraste
 * arbitrario y con el cuadradito amarillo del vértice justo debajo. Relleno y tamaño
 * son justo los dos canales que esa situación destruye.
 *
 * AutoCAD lleva décadas resolviéndolo con **siluetas**, y por eso se copia la suya:
 * la forma se reconoce de reojo, sobrevive al contraste malo y no depende del color
 * —que aquí, además, está ocupado (ni rojo, ni azul, ni verde: ver `COLOR_USUARIO`)—.
 *
 *   · **VÉRTICE → CUADRADO** = el *Punto final* (Endpoint) de AutoCAD. El enganche
 *     hace coincidir dos puntos EXACTAMENTE, y el cuadrado rodea el vértice
 *     capturado. La misma figura que el vértice, un punto discreto.
 *   · **LINDERO → RELOJ DE ARENA** = el *Cercano* (Nearest) de AutoCAD, y la
 *     equivalencia es literal, no una analogía: el punto puede caer en CUALQUIER
 *     sitio del segmento (`0 ≤ t ≤ 1`), deslizando sobre la línea. Las dos aspas
 *     dibujan esa línea que se cruza.
 *
 * `TIPO_ENGANCHE` es el código estable que `edit/snap.js` publica justamente para que
 * la UI decida sin leer ningún texto; las clases CSS viajan con la silueta para que
 * el estilo no pueda divergir del tipo que representa.
 *
 * ⚠️ `L.divIcon` y no `L.circleMarker`, y no es una preferencia: un `circleMarker`
 * **solo sabe dibujar círculos**. El precedente y su razón están en
 * `viewer/sincronizacion.js` (hallazgo C8): un `divIcon` con SVG en línea no descarga
 * nada, así que se ve igual en dev, en el build y en jsdom, mientras que `L.Icon`
 * depende de PNG cuyas URL rompe Vite.
 *
 * @param {string} interior  Figura SVG, SIN trazo: se pinta dos veces (halo + color).
 * @returns {string}  El `html` del `divIcon`.
 */
function svgIndicador(interior) {
  const lienzo = `0 0 ${LADO_INDICADOR_PX} ${LADO_INDICADOR_PX}`
  // La MISMA figura dos veces: primero gruesa y oscura (el halo), después fina y del
  // color del usuario. Es la técnica estándar de trazo doble; dibujarla dos veces sale
  // más barato y más nítido que un `filter: drop-shadow`, que además Leaflet reescala.
  const trazo = (color, ancho) =>
    interior.replace(
      '/>',
      ` fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linejoin="round" stroke-linecap="round"/>`,
    )
  return (
    `<svg width="${LADO_INDICADOR_PX}" height="${LADO_INDICADOR_PX}" viewBox="${lienzo}" ` +
    `aria-hidden="true" focusable="false" style="display:block;pointer-events:none;overflow:visible">` +
    `${trazo(HALO_INDICADOR, 4.5)}${trazo(COLOR_USUARIO, 2)}` +
    `</svg>`
  )
}

/**
 * Los dos iconos, construidos UNA vez por módulo. Compartirlos es seguro: Leaflet
 * fabrica un elemento nuevo en cada `createIcon()` (mismo razonamiento que el
 * `iconoVertice` de `viewer/sincronizacion.js`).
 *
 * @type {Readonly<Record<string, object>>}
 */
const ICONO_INDICADOR = Object.freeze({
  // Cuadrado de 18 px de lado dentro del lienzo de 26: 4 px de aire por cada lado
  // alrededor del vértice de 10 px (ver {@link LADO_INDICADOR_PX}).
  [TIPO_ENGANCHE.VERTICE]: L.divIcon({
    className: `${CLASE_EDICION.INDICADOR} ${CLASE_EDICION.INDICADOR_VERTICE}`,
    iconSize: [LADO_INDICADOR_PX, LADO_INDICADOR_PX],
    iconAnchor: [LADO_INDICADOR_PX / 2, LADO_INDICADOR_PX / 2],
    html: svgIndicador('<rect x="4" y="4" width="18" height="18"/>'),
  }),
  // Pajarita de 16 px: el polígono se cierra solo de (21,21) a (5,5), y ese cierre
  // ES la segunda aspa. Cuatro puntos dibujan la figura entera. Va algo más pequeña
  // que el cuadrado porque su silueta ocupa las dos diagonales del hueco y a igual
  // lado pesaría bastante más en el lienzo.
  [TIPO_ENGANCHE.LINDERO]: L.divIcon({
    className: `${CLASE_EDICION.INDICADOR} ${CLASE_EDICION.INDICADOR_LINDERO}`,
    iconSize: [LADO_INDICADOR_PX, LADO_INDICADOR_PX],
    iconAnchor: [LADO_INDICADOR_PX / 2, LADO_INDICADOR_PX / 2],
    html: svgIndicador('<polygon points="5,5 21,5 5,21 21,21"/>'),
  }),
})

// ── Mensajes propios ─────────────────────────────────────────────────────────
//
// Solo los que NO tienen dueño en `edit/`. Todo lo que `edit/offset.js` y
// `edit/vertices.js` ya redactan se publica verbatim (ver la cabecera).

/** No hay geometría editable en el store: no hay dónde insertar. */
const MSG_SIN_GEOMETRIA =
  'No se ha insertado ningún vértice: no hay ninguna geometría cargada en la que insertarlo. ' +
  'Carga una parcela o dibuja el contorno primero.'

/** No hay ni un lado utilizable (anillos de un punto, vértices no finitos…). */
const MSG_SIN_LADOS =
  'No se ha insertado ningún vértice: la geometría cargada no tiene ningún lindero sobre el que ' +
  'insertar (hacen falta al menos dos vértices distintos en algún recinto).'

/** No hay lado seleccionado y se ha pedido desplazarlo. */
const MSG_SIN_SELECCION =
  'No se ha desplazado ningún lindero: no hay ningún lado seleccionado. Pincha primero sobre el ' +
  'lindero que quieras mover y vuelve a intentarlo.'

// ── Helpers de módulo (puros) ────────────────────────────────────────────────

/** Describe un valor para el mensaje de un contrato roto. */
function describir(valor) {
  if (valor === null) return 'null'
  if (valor === undefined) return 'undefined'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/**
 * Rótulo legible del recinto `i`. `recintos[0]` es SIEMPRE el EXTERIOR (invariante
 * de `model/parcela.js`); los siguientes son huecos, numerados desde 1 para el
 * usuario. Gemela de la de `viewer/sincronizacion.js` (ver la nota de deuda).
 *
 * @param {number} i
 * @returns {string}
 */
const rotuloRecinto = (i) => (i === 0 ? 'EXTERIOR' : `HUECO ${i}`)

/** True si `p` es un par `[x, y]` de números finitos. */
const esPar = (p) =>
  Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])

/**
 * Anillos UTM (abiertos) del estado, como array por recinto. Un estado nulo o sin
 * recintos da `[]`; un recinto sin `vertices` cuenta como anillo VACÍO y NO se
 * filtra: filtrarlo desplazaría los índices y `RefVertice` dejaría de casar.
 *
 * @param {object|null} parcela
 * @returns {Array<Array<[number, number]>>}
 */
function anillosDe(parcela) {
  const recintos = parcela && Array.isArray(parcela.recintos) ? parcela.recintos : []
  return recintos.map((r) => (r && Array.isArray(r.vertices) ? r.vertices : []))
}

/**
 * Nº de LADOS de un anillo abierto de `n` vértices. Es la misma regla —y por los
 * mismos motivos— que `edit/snap.js#acumularAnillo`: con `n ≥ 3` hay `n` lados
 * (el último es el de CIERRE, que no está materializado); con `n === 2` hay UNO
 * (emitir `v0→v1` y `v1→v0` sería la misma línea dos veces); con `n < 2`, ninguno.
 *
 * @param {number} n
 * @returns {number}
 */
const numeroDeLados = (n) => (n < 2 ? 0 : n === 2 ? 1 : n)

/** ¿Los dos anillos tienen los MISMOS vértices, uno a uno? */
function mismosVertices(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false
  }
  return true
}

/**
 * ¿El objeto es el historial de `edit/historial.js` (`{pila, indice, limite}`)?
 * Una SOLA forma admitida, la real: la API de ese módulo es FUNCIONAL
 * (`commit(historial, estado)`), no un objeto con método. Mismo criterio —y misma
 * comprobación— que `viewer/sincronizacion.js`.
 */
const esHistorialUsable = (h) => !!h && typeof h === 'object' && Array.isArray(h.pila)

/**
 * Contrato del llamante: la {@link RefVertice} tiene la FORMA del typedef. Solo la
 * forma; que APUNTE a algo existente se comprueba aparte y no se trata igual (ver
 * `crearEdicion`).
 *
 * @param {unknown} ref
 * @param {string} fn
 * @returns {{recinto: number, indice: number}}
 * @throws {TypeError}
 */
function exigirFormaRef(ref, fn) {
  if (ref === null || typeof ref !== 'object' || Array.isArray(ref)) {
    throw new TypeError(
      `${fn}: la referencia debe ser una RefVertice {recinto, indice}; recibido ${describir(ref)}.`,
    )
  }
  const { recinto, indice } = ref
  if (!Number.isInteger(recinto) || recinto < 0) {
    throw new TypeError(
      `${fn}: 'recinto' debe ser un entero ≥ 0 (índice en recintos); recibido ${describir(recinto)}.`,
    )
  }
  if (!Number.isInteger(indice) || indice < 0) {
    throw new TypeError(
      `${fn}: 'indice' debe ser un entero ≥ 0 (índice en el anillo ABIERTO); ` +
        `recibido ${describir(indice)}.`,
    )
  }
  return { recinto, indice }
}

/**
 * Contrato del llamante sobre una tolerancia en METROS. `0` es válido y significa
 * «snap apagado» (es la semántica de `edit/snap.js#ajustar`, τ ≤ 0). NEGATIVA no:
 * una distancia negativa no es una tolerancia, es un error de tecleo del
 * programador que apagaría el snap sin decirlo.
 *
 * @param {unknown} valor
 * @param {string} fn
 * @returns {number}
 */
function exigirTolerancia(valor, fn) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new TypeError(
      `${fn}: 'tolerancia' debe ser un número finito de METROS; recibido ${describir(valor)}.`,
    )
  }
  if (valor < 0) {
    throw new RangeError(
      `${fn}: 'tolerancia' debe ser ≥ 0 metros (0 = snap apagado); recibido ${valor}.`,
    )
  }
  return valor
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('./_comun.js').RefVertice} RefVertice
 */

/**
 * @typedef {Object} Enganche  Lo que devuelve `ajustar`. `punto` SIEMPRE es
 *   utilizable: si no hubo enganche, es una copia del punto de entrada.
 * @property {[number, number]} punto
 * @property {boolean} enganchado
 * @property {'VERTICE'|'LINDERO'|null} tipo  Clave de `edit/snap.js#TIPO_ENGANCHE`.
 */

/**
 * Crea la capa de INTERACCIÓN de edición sobre un mapa ya montado.
 *
 * Devuelve, entre otras cosas, los DOS GANCHOS que `viewer/sincronizacion.js`
 * acepta para sus marcadores (`ajustar` y `alCrearMarcador`). Este módulo **no
 * edita `sincronizacion.js`**: produce las funciones y quien compone el visor se
 * las pasa. Por eso las firmas están congeladas.
 *
 * ```js
 * const edicion = crearEdicion({ mapa, estado, zona, historial, alAvisar })
 * sincronizar({ …, ajustar: edicion.ajustar, alCrearMarcador: edicion.alCrearMarcador })
 * // … al cerrar la pantalla, en orden inverso al montaje:
 * edicion.destruir()
 * ```
 *
 * Política de errores (SPEC §2 regla 1), con la frontera de siempre:
 *   · Contrato roto por el PROGRAMADOR (`mapa` que no es un `L.Map`, `estado` que no
 *     es el store, `zona` fuera de `HUSOS_VALIDOS`, `historial` que no es el POJO de
 *     `crearHistorial`, una `RefVertice` sin forma, una `distancia` no finita) →
 *     `throw` nombrando el argumento y lo recibido.
 *   · Gesto del USUARIO que no se puede atender (pinchar lejos, eliminar el vértice
 *     que dejaría el anillo en dos, desplazar 0 m) → NUNCA `throw`: se devuelve
 *     `aplicado: false` y se cuenta por `avisar` con el nivel que fija la regla de
 *     clasificación (ver la cabecera del módulo).
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa  Mapa ya creado (`viewer/mapa.js`).
 * @param {import('./_comun.js').EstadoVista} args.estado  El MISMO store que la tabla
 *   y el mapa. NO se crea otro: todo son vistas del mismo estado.
 * @param {number} args.zona  Huso UTM (29, 30 o 31).
 * @param {import('../edit/historial.js').Historial|null} [args.historial=null]  El
 *   POJO de `crearHistorial`, o `null` (defecto: entonces solo se hace `set`).
 * @param {number} [args.tolerancia=OPERATIVOS.snapMetros]  τ del snap, en METROS.
 * @param {import('./_comun.js').Avisar} [args.alAvisar]  Canal de aviso.
 * @returns {{
 *   ajustar: (utm: [number,number], refVertice: RefVertice, eventoOriginal?: object|null) => (Enganche|null),
 *   alCrearMarcador: (marcador: object, refVertice: RefVertice) => void,
 *   snapActivo: (valor?: boolean) => boolean,
 *   tolerancia: (metros?: number) => number,
 *   seleccionarLado: (ref: RefVertice|null) => (RefVertice|null),
 *   ladoSeleccionado: () => (RefVertice|null),
 *   desplazarSeleccion: (distancia: number) => {aplicado: boolean, modo: string|null, detecciones: Array<object>},
 *   insertarEn: (latlng: object|[number,number]) => {aplicado: boolean, ref: RefVertice|null},
 *   eliminar: (refVertice: RefVertice) => {aplicado: boolean, motivo: string|null},
 *   fijarColindantes: (recintos: Array<object>) => void,
 *   alCambiarSeleccion: (fn: (ref: RefVertice|null) => void) => (() => void),
 *   destruir: () => void,
 * }}
 * @throws {TypeError|RangeError}
 */
export function crearEdicion({
  mapa,
  estado,
  zona,
  historial = null,
  tolerancia = OPERATIVOS.snapMetros,
  alAvisar,
} = {}) {
  // ── Contratos del programador: throw, nunca corrección callada ────────────
  if (
    !mapa ||
    typeof mapa.addLayer !== 'function' ||
    typeof mapa.removeLayer !== 'function' ||
    typeof mapa.on !== 'function' ||
    typeof mapa.off !== 'function' ||
    typeof mapa.latLngToLayerPoint !== 'function'
  ) {
    throw new TypeError(
      `crearEdicion: 'mapa' debe ser un L.Map (con addLayer/removeLayer/on/off y ` +
        `latLngToLayerPoint, que es lo que mide la puntería en píxeles); recibido ${describir(mapa)}.`,
    )
  }
  if (
    !estado ||
    typeof estado.get !== 'function' ||
    typeof estado.set !== 'function' ||
    typeof estado.subscribe !== 'function'
  ) {
    throw new TypeError(
      `crearEdicion: 'estado' debe ser el store de crearEstadoVista ({get,set,subscribe}); ` +
        `recibido ${describir(estado)}.`,
    )
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `crearEdicion: 'zona' inválida: ${JSON.stringify(zona)}. Válidas: ${HUSOS_VALIDOS.join(', ')}.`,
    )
  }
  if (historial !== null && historial !== undefined && !esHistorialUsable(historial)) {
    throw new TypeError(
      `crearEdicion: 'historial' debe ser el POJO de crearHistorial ({pila, indice, limite}) ` +
        `o null; recibido ${describir(historial)}.`,
    )
  }
  const avisar = resolverAvisar(alAvisar)

  // ── Estado interno ────────────────────────────────────────────────────────

  let vivo = true
  /**
   * ── Rework de UI · rebanada 3 (Edición), 2026-08-04 ────────────────────────
   * Si los CUATRO gestos de edición del mapa están vivos.
   *
   * **No es lo mismo que `vivo`**: aquél dice si el módulo existe (lo apaga
   * `destruir()` y no se enciende de vuelta); éste dice si la pantalla activa es
   * la de Edición, y se conmuta tantas veces como haga falta.
   *
   * ⛔ **LO QUE ESTO ARREGLA, MEDIDO.** Hasta hoy se podía arrastrar un vértice
   * —y borrarlo con el botón derecho, e insertar otro con doble clic— desde
   * CUALQUIERA de las cuatro pantallas: 15 de 15 marcadores arrastrables en
   * Validación, exactamente los mismos que en Edición. O sea que el peldaño
   * «Edición» del rail no cambiaba nada de lo que se podía hacer: era
   * decorativo, que es justo el síntoma que este rework existe para curar.
   *
   * Nace en `true` a propósito: `crearEdicion` es de `viewer/` y no sabe nada de
   * navegación (criterio 1 del plan). Quien lo conmuta es el aplicador de
   * `app/main.js`, suscrito a `app/navegacion.js`. Un visor montado sin
   * aplicador —los tests de este módulo, un mapa pelado— se comporta como antes.
   */
  let edicionActiva = true
  let toleranciaM = exigirTolerancia(tolerancia, 'crearEdicion')
  let snapEncendido = true
  /** Seguimiento propio de `Alt` (ver la cabecera: es el camino sin evento real). */
  let altPulsado = false

  /** Recintos de las parcelas vecinas (F05). COPIA superficial de lo que dan. */
  let colindantes = []
  /**
   * Lo mismo, con la forma que `dianasDe` espera para `colindantes`: una lista de
   * PARCELAS con su array `recintos`. El contrato público de `fijarColindantes` es
   * una lista de RECINTOS (más simple para el llamante y sin exigirle el POJO de
   * parcela entero), así que la adaptación se hace aquí, una vez por llamada, en
   * vez de en cada consulta del catálogo.
   */
  let vecinasParaDianas = []

  /** Caché del catálogo de dianas. Ver la política de invalidación en la cabecera. */
  let cacheDianas = null

  /** Lado seleccionado: `{recinto, indice}` = el lado `indice → indice+1`, o `null`. */
  let seleccion = null
  const oyentesSeleccion = new Set()

  let indicador = null
  /** Tipo del indicador VIVO, para no recrearlo en cada fotograma. */
  let tipoIndicador = null
  let resalte = null

  // ── Los dos apilados de este módulo, que NO son el mismo ──────────────────
  //
  // El RESALTE del lado va en el pane de la geometría editada (420), por DEBAJO del
  // de vértices (430): es un trazo GRUESO y traslúcido, y si subiera taparía los
  // vértices sobre los que el usuario tiene que seguir pinchando. Sin los panes del
  // visor (un mapa pelado, un test) cae al `overlayPane` de Leaflet (400), que sigue
  // por debajo del `markerPane` (600): la invariante se cumple igual, así que no es
  // una corrección callada de un contrato roto, es el otro caso legítimo.
  const panePropio =
    typeof mapa.getPane === 'function' && mapa.getPane(PANE.PARCELA_EDITADA)
      ? { pane: PANE.PARCELA_EDITADA }
      : {}

  // El INDICADOR va ARRIBA DEL TODO, y es lo contrario que el resalte a propósito.
  // Medido en navegador (2026-07-28): con el indicador en el pane de la geometría
  // editada (420), un enganche a LINDERO cerca del centro de un lado quedaba TAPADO
  // por su acotación —que vive en el pane 425 y se pinta justo en el punto medio del
  // lado, es decir, exactamente donde más cae este enganche—. El usuario veía la
  // cota y no veía a qué se estaba pegando: el indicador dejaba de hacer su único
  // trabajo justo en su caso más frecuente.
  //
  // El criterio es el de AutoCAD y se sostiene solo: la marca de referencia a objetos
  // es la respuesta al gesto EN CURSO y se dibuja encima de todo, porque dura lo que
  // dura el gesto. Lo ambiental (cotas, resalte) cede. Y no tapa el vértice que
  // rodea: la silueta es HUECA, así que el cuadradito amarillo se ve por dentro.
  const paneIndicador =
    typeof mapa.getPane === 'function' && mapa.getPane(PANE.VERTICES)
      ? { pane: PANE.VERTICES }
      : {} // sin panes del visor, un L.Marker cae al `markerPane` (600): también arriba

  const contenedor = typeof mapa.getContainer === 'function' ? mapa.getContainer() : null
  const doc = (contenedor && contenedor.ownerDocument) || globalThis.document || null
  const ventana = (doc && doc.defaultView) || globalThis.window || null

  // ── Lecturas del estado ───────────────────────────────────────────────────

  /** Anillo `r` del estado actual, o `null` si no existe. */
  function anilloDe(parcela, r) {
    const anillos = anillosDe(parcela)
    return Array.isArray(anillos[r]) ? anillos[r] : null
  }

  /** ¿Existe el vértice `(r, i)` en el estado, y es un par finito? */
  function verticeExiste(parcela, r, i) {
    const anillo = anilloDe(parcela, r)
    return anillo !== null && i < anillo.length && esPar(anillo[i])
  }

  // ── Tecla modificadora ────────────────────────────────────────────────────

  /**
   * `altKey` del evento recibido, o `null` si el evento no lo trae. Se admiten las
   * dos formas con las que puede llegar: un evento del DOM (`altKey` propio) y un
   * evento de Leaflet (que lo lleva dentro de `originalEvent`).
   */
  function altDelEvento(evento) {
    if (!evento || typeof evento !== 'object') return null
    if (typeof evento.altKey === 'boolean') return evento.altKey
    const original = evento.originalEvent
    if (original && typeof original.altKey === 'boolean') return original.altKey
    return null
  }

  /**
   * ¿Está `Alt` pulsada AHORA? El evento real manda sobre el seguimiento —y además
   * lo RESINCRONIZA—, porque el seguimiento es el que se puede haber quedado atrás.
   */
  function altVigente(evento) {
    const real = altDelEvento(evento)
    if (real === null) return altPulsado
    altPulsado = real
    return real
  }

  /** τ efectiva del gesto: 0 = snap apagado (semántica de `edit/snap.js#ajustar`). */
  function toleranciaEfectiva(evento) {
    return snapEncendido && !altVigente(evento) ? toleranciaM : 0
  }

  /**
   * Un `keydown` o un `keyup` cualquiera: la verdad está en `altKey`, no en `key`.
   * Leerlo así en vez de comparar `key === 'Alt'` resincroniza también cuando el
   * usuario pulsa cualquier OTRA tecla, que es información gratis sobre el estado
   * real del modificador.
   */
  const alTeclear = (evento) => {
    altPulsado = !!(evento && evento.altKey === true)
  }

  /**
   * La ventana pierde el foco: se baja la bandera. Sin esto, soltar `Alt` en OTRA
   * aplicación no emite `keyup` aquí y el snap se quedaría apagado para siempre y
   * en silencio.
   */
  const alPerderFoco = () => {
    altPulsado = false
  }

  // ── Catálogo de dianas (una vez por gesto) ────────────────────────────────

  /**
   * El catálogo vigente para este gesto. Ver la POLÍTICA DE INVALIDACIÓN en la
   * cabecera del módulo: las tres entradas se comparan por identidad y no se copia
   * nada.
   *
   * @param {object} parcela  `estado.get()` leído por el llamante.
   * @param {{recinto: number, indice: number}} ref
   * @returns {import('../edit/snap.js').Dianas}
   */
  function dianasVigentes(parcela, ref) {
    if (
      cacheDianas !== null &&
      cacheDianas.parcela === parcela &&
      cacheDianas.vecinas === vecinasParaDianas &&
      cacheDianas.recinto === ref.recinto &&
      cacheDianas.indice === ref.indice
    ) {
      return cacheDianas.dianas
    }
    const dianas = dianasDe({ parcela, colindantes: vecinasParaDianas, excluir: ref })
    cacheDianas = {
      parcela,
      vecinas: vecinasParaDianas,
      recinto: ref.recinto,
      indice: ref.indice,
      dianas,
    }
    return dianas
  }

  // ── Indicador de enganche ─────────────────────────────────────────────────

  function ocultarIndicador() {
    if (indicador === null) return
    mapa.removeLayer(indicador)
    indicador = null
    tipoIndicador = null
  }

  /**
   * Marca visual sobre el punto enganchado, con la silueta que le toca a su tipo
   * (ver {@link ICONO_INDICADOR}). Se RECREA cuando cambia el tipo —para que la
   * silueta y la clase CSS no puedan divergir del tipo que representan— y se limita
   * a moverse mientras el tipo no cambia, que es el caso de cada fotograma.
   *
   * `interactive:false` y `keyboard:false` son obligatorios: el indicador aparece
   * ENCIMA del punto que el usuario está arrastrando, así que un clic capturado
   * rompería el gesto que está adornando, y una parada de tabulación por vértice
   * arruinaría el recorrido por teclado (mismo criterio que los marcadores de
   * `viewer/sincronizacion.js`).
   *
   * @param {[number, number]} puntoUTM
   * @param {'VERTICE'|'LINDERO'} tipo
   */
  function mostrarIndicador(puntoUTM, tipo) {
    const latlng = vertUTMaLatLng(puntoUTM, zona)
    if (indicador !== null && tipoIndicador === tipo) {
      indicador.setLatLng(latlng)
      return
    }
    ocultarIndicador()
    const icono = ICONO_INDICADOR[tipo]
    /* c8 ignore next -- `tipo` sale de TIPO_ENGANCHE; la guarda es por si crece */
    if (!icono) return
    indicador = L.marker(latlng, {
      icon: icono,
      interactive: false,
      keyboard: false,
      ...paneIndicador,
    }).addTo(mapa)
    tipoIndicador = tipo
  }

  // ── Resalte del lado seleccionado ─────────────────────────────────────────

  function quitarResalte() {
    if (resalte === null) return
    mapa.removeLayer(resalte)
    resalte = null
  }

  /**
   * Los dos extremos del lado seleccionado, en `[lat, lng]`, o `null` si el lado ya
   * no existe en el estado.
   */
  function extremosDelLado(sel) {
    const anillo = anilloDe(estado.get(), sel.recinto)
    if (anillo === null) return null
    const n = anillo.length
    if (numeroDeLados(n) === 0 || sel.indice >= n) return null
    const A = anillo[sel.indice]
    const B = anillo[(sel.indice + 1) % n]
    if (!esPar(A) || !esPar(B)) return null
    return [vertUTMaLatLng(A, zona), vertUTMaLatLng(B, zona)]
  }

  /**
   * Repinta el resalte desde el ESTADO.
   *
   * `arrastrado` es la excepción, y existe para que el resalte siga al vértice
   * durante el gesto: el arrastre NO escribe en el store hasta el `dragend` (así lo
   * decidió `sincronizacion.js`, y con razón: un `set` por fotograma reventaría el
   * historial), de modo que entre `dragstart` y `dragend` el estado aún dice que el
   * vértice está donde estaba. Si el vértice arrastrado es uno de los dos extremos
   * del lado resaltado, se sustituye SOLO ese extremo por su posición en vivo.
   *
   * @param {{recinto: number, indice: number, latlng: object}|null} [arrastrado]
   */
  function pintarSeleccion(arrastrado = null) {
    if (!vivo || seleccion === null) {
      quitarResalte()
      return
    }
    const par = extremosDelLado(seleccion)
    if (par === null) {
      quitarResalte()
      return
    }
    if (arrastrado !== null && arrastrado.recinto === seleccion.recinto) {
      const anillo = anilloDe(estado.get(), seleccion.recinto)
      const n = anillo === null ? 0 : anillo.length
      if (arrastrado.indice === seleccion.indice) par[0] = arrastrado.latlng
      else if (n > 0 && arrastrado.indice === (seleccion.indice + 1) % n) par[1] = arrastrado.latlng
    }
    if (resalte === null) resalte = L.polyline(par, { ...ESTILO_RESALTE, ...panePropio }).addTo(mapa)
    else resalte.setLatLngs(par)
  }

  const mismaRef = (a, b) =>
    (a === null && b === null) ||
    (a !== null && b !== null && a.recinto === b.recinto && a.indice === b.indice)

  function anunciarSeleccion() {
    const copia = seleccion === null ? null : { ...seleccion }
    for (const fn of oyentesSeleccion) fn(copia)
  }

  /** Fija la selección, repinta y anuncia SOLO si ha cambiado de verdad. */
  function fijarSeleccion(ref) {
    if (mismaRef(seleccion, ref)) {
      pintarSeleccion()
      return
    }
    seleccion = ref
    pintarSeleccion()
    anunciarSeleccion()
  }

  /**
   * Reubica la selección tras INSERTAR un vértice: si el vértice nuevo entra por
   * delante del lado resaltado (en el mismo anillo), ese lado pasa a tener un índice
   * más. Sin esto el resalte se quedaría señalando el lado de al lado, en silencio.
   *
   * Va por `fijarSeleccion`, así que el cambio de índice **se anuncia**: quien
   * llevara apuntada la `RefVertice` (un panel de offset, un rótulo) trabajaría si
   * no sobre un índice que ya significa otra cosa.
   */
  function reubicarPorInsercion(r, i) {
    if (seleccion === null || seleccion.recinto !== r) return
    if (i < seleccion.indice) fijarSeleccion({ recinto: r, indice: seleccion.indice + 1 })
  }

  /**
   * Reubica la selección tras ELIMINAR un vértice:
   *   · si se ha borrado el vértice que ABRE el lado resaltado, ese lado ya no
   *     existe como tal → se suelta la selección;
   *   · si se ha borrado uno anterior, el lado baja un índice;
   *   · si se ha borrado el que lo CIERRA, el lado sigue existiendo (ahora llega al
   *     siguiente vértice) y conserva su índice.
   * Como en la inserción, todo cambio pasa por `fijarSeleccion` y se anuncia.
   */
  function reubicarPorEliminacion(r, i) {
    if (seleccion === null || seleccion.recinto !== r) return
    if (i === seleccion.indice) fijarSeleccion(null)
    else if (i < seleccion.indice) fijarSeleccion({ recinto: r, indice: seleccion.indice - 1 })
  }

  // ── Escritura en el modelo: CLON → set → un commit ────────────────────────

  /**
   * Aplica unos `recintos` nuevos al estado. Es el MISMO patrón de
   * `sincronizacion.js#aplicarVertice`, y el clon no es cosmético: `commit`
   * fotografía con `structuredClone`, así que mutar en sitio dejaría al presente y a
   * su snapshot compartiendo memoria y el undo dejaría de deshacer.
   *
   * `geometriaOficial` se arrastra en el clon y NO se toca jamás (regla de oro 2):
   * las tres operaciones trabajan sobre `recintos` y solo sobre `recintos`.
   *
   * @param {object} actual  El estado leído por el llamante.
   * @param {Array<object>} nuevos  Recintos ya independientes (los de `edit/`).
   * @returns {object}  El estado nuevo, ya aplicado.
   */
  function aplicarRecintos(actual, nuevos) {
    const siguiente = structuredClone(actual)
    siguiente.recintos = nuevos
    estado.set(siguiente)
    // UN commit por operación acabada, y DESPUÉS del set. `historial` puede ser
    // null (es el defecto): entonces solo hay `set`.
    if (historial) commitHistorial(historial, siguiente)
    return siguiente
  }

  // ── Geometría de los gestos ───────────────────────────────────────────────

  /**
   * El lado más cercano al punto UTM `P`, con su proyección. Recorre TODOS los
   * recintos (exterior y huecos) y usa `geo/segmento.js#proyectarEnSegmento`, que es
   * la proyección punto→segmento propia del proyecto (regla de oro 6:
   * `turf.nearestPointOnLine` está prohibida sobre UTM).
   *
   * @param {object|null} parcela
   * @param {[number, number]} P
   * @returns {{recinto: number, indice: number, proy: object}|null}
   */
  function ladoMasCercano(parcela, P) {
    const anillos = anillosDe(parcela)
    let mejor = null
    for (let r = 0; r < anillos.length; r++) {
      const anillo = anillos[r]
      const n = anillo.length
      const lados = numeroDeLados(n)
      for (let i = 0; i < lados; i++) {
        const A = anillo[i]
        const B = anillo[(i + 1) % n]
        // Vértices no finitos o lados de longitud nula: dato posible del usuario
        // (lo señala F02), no un lindero. Se saltan sin lanzar, igual que en
        // `edit/snap.js`.
        if (!esPar(A) || !esPar(B)) continue
        if (distanciaEntre(A, B) <= LONGITUD_NULA_METROS) continue
        const proy = proyectarEnSegmento([P[0], P[1]], [A[0], A[1]], [B[0], B[1]])
        if (mejor === null || proy.distancia < mejor.proy.distancia) {
          mejor = { recinto: r, indice: i, proy }
        }
      }
    }
    return mejor
  }

  /**
   * Distancia EN PÍXELES DE PANTALLA entre dos puntos UTM. Se convierte solo el
   * candidato ganador (no los n lados): elegir el más cercano se hace en METROS,
   * que es una hipotenusa y no cuesta nada, y el orden de los dos criterios coincide
   * porque el factor de escala de la proyección es constante a la escala de una
   * parcela. Convertir n lados a píxeles sería pagar n desproyecciones para obtener
   * el mismo ganador.
   */
  function pixelesEntre(unUTM, otroUTM) {
    const a = mapa.latLngToLayerPoint(vertUTMaLatLng(unUTM, zona))
    const b = mapa.latLngToLayerPoint(vertUTMaLatLng(otroUTM, zona))
    return a.distanceTo(b)
  }

  // ── Las tres operaciones que escriben ─────────────────────────────────────

  /**
   * Inserta un vértice en el lindero más cercano al punto pinchado.
   *
   * **Se inserta el PIE de la proyección sobre el lado, no el punto crudo del
   * clic.** Insertar el punto crudo dejaría un pico en el lindero en cuanto el
   * usuario pinchara dos píxeles fuera de la línea — y nadie pincha dentro de la
   * línea.
   *
   * @param {object|[number, number]} latlng  Posición de Leaflet (`{lat,lng}` o par).
   * @returns {{aplicado: boolean, ref: RefVertice|null}}  `ref` es la del vértice
   *   NUEVO (`indice + 1` sobre el lado en el que ha entrado).
   */
  function insertarEn(latlng) {
    // Tras `destruir()` no se revienta y no se escribe: mismo precedente que
    // `app/cableado-catastro.js`, cuyas tres acciones devuelven sin hacer nada.
    if (!vivo) return { aplicado: false, ref: null }

    const parcela = estado.get()
    const recintos = parcela && Array.isArray(parcela.recintos) ? parcela.recintos : null
    if (recintos === null || recintos.length === 0) {
      // ERROR y no AVISO: la operación que el usuario acaba de pedir NO se aplica
      // (regla de clasificación del typedef `Avisar`, precedente `aplicarVertice`).
      avisar(MSG_SIN_GEOMETRIA, { nivel: NIVEL.ERROR })
      return { aplicado: false, ref: null }
    }

    const P = latLngAUTM(latlng, zona)
    const mejor = ladoMasCercano(parcela, P)
    if (mejor === null) {
      avisar(MSG_SIN_LADOS, { nivel: NIVEL.ERROR })
      return { aplicado: false, ref: null }
    }

    const px = pixelesEntre(P, mejor.proy.punto)
    if (px > UMBRAL_PUNTERIA_PX) {
      avisar(
        `No se ha insertado ningún vértice: has pinchado a ${Math.round(px)} px del lindero más ` +
          `cercano y el límite de puntería son ${UMBRAL_PUNTERIA_PX} px. Pincha sobre el lindero, ` +
          `o amplía el mapa para tener más sitio.`,
        { nivel: NIVEL.ERROR },
      )
      return { aplicado: false, ref: null }
    }

    // El pie cae en un EXTREMO (t = 0 o t = 1): ahí ya hay un vértice, e insertar
    // otro dejaría dos vértices en la misma coordenada — el «vértice duplicado» que
    // luego F02 señala y que rompe el snap (un lado de longitud cero no es un
    // lindero). Se rechaza y se dice cuál es el vértice que ya está.
    if (mejor.proy.enExtremo !== null) {
      const n = anilloDe(parcela, mejor.recinto).length
      const existente = mejor.proy.enExtremo === 'A' ? mejor.indice : (mejor.indice + 1) % n
      avisar(
        `No se ha insertado ningún vértice: el punto cae justo sobre el vértice ${existente + 1} ` +
          `de ${rotuloRecinto(mejor.recinto)}, donde ya hay uno. Pincha en un punto intermedio del ` +
          `lindero, no en su extremo.`,
        { nivel: NIVEL.ERROR },
      )
      return { aplicado: false, ref: null }
    }

    const ref = { recinto: mejor.recinto, indice: mejor.indice }
    const nuevos = insertarVertice(recintos, ref, mejor.proy.punto)
    // Antes del `set`: el suscriptor repinta el resalte, y debe encontrarse ya la
    // selección reubicada.
    reubicarPorInsercion(ref.recinto, ref.indice)
    aplicarRecintos(parcela, nuevos)
    return { aplicado: true, ref: { recinto: ref.recinto, indice: ref.indice + 1 } }
  }

  /**
   * Elimina un vértice.
   *
   * @param {RefVertice} refVertice
   * @returns {{aplicado: boolean, motivo: string|null}}  `motivo` es una clave de
   *   `edit/vertices.js#MOTIVO_VERTICE` cuando ese módulo se ha negado; `null`
   *   también cuando no se ha aplicado por una razón que no está en su catálogo (el
   *   vértice ya no existe), que aquí se cuenta con texto propio.
   */
  function eliminar(refVertice) {
    if (!vivo) return { aplicado: false, motivo: null }
    const ref = exigirFormaRef(refVertice, 'eliminar')

    const parcela = estado.get()
    if (!verticeExiste(parcela, ref.recinto, ref.indice)) {
      // No se lanza aunque la referencia esté fuera de rango (y `eliminarVertice`
      // sí lanzaría): esto llega de un menú contextual sobre un marcador que puede
      // haberse quedado viejo, o sea de un GESTO, no de un bug. Y es ERROR porque
      // la operación no se aplica — es el mismo caso, y el mismo texto, que
      // `sincronizacion.js#aplicarVertice`.
      avisar(
        `No se ha eliminado nada: el vértice ${ref.indice + 1} de ${rotuloRecinto(ref.recinto)} ` +
          `ya no existe en la parcela.`,
        { nivel: NIVEL.ERROR },
      )
      return { aplicado: false, motivo: null }
    }

    const { recintos: nuevos, motivo } = eliminarVertice(parcela.recintos, ref)
    if (motivo !== null) {
      // Texto de `edit/vertices.js`, VERBATIM: quien escribió la regla escribió el
      // mensaje. ERROR porque no se ha eliminado nada.
      avisar(MENSAJE_POR_MOTIVO[motivo], { nivel: NIVEL.ERROR })
      return { aplicado: false, motivo }
    }

    reubicarPorEliminacion(ref.recinto, ref.indice)
    aplicarRecintos(parcela, nuevos)
    return { aplicado: true, motivo: null }
  }

  /**
   * Desplaza el lado SELECCIONADO en paralelo a sí mismo (offset perpendicular).
   *
   * `distancia > 0` aleja el lindero del interior de su propio anillo; el signo lo
   * resuelve `edit/offset.js` midiendo la orientación, no por convención.
   *
   * **La `distancia` es contrato del PROGRAMADOR**: si no es un número finito,
   * `desplazarLado` lanza y aquí no se intercepta. Lo que el usuario teclea lo
   * convierte antes quien cablee el campo (igual que la celda de coordenada pasa por
   * `viewer/celda.js#parsearCoordenada`); un `NaN` que llegara hasta aquí sería un
   * parseo que falta, no un dato.
   *
   * @param {number} distancia  Metros.
   * @returns {{aplicado: boolean, modo: string|null, detecciones: Array<object>}}
   */
  function desplazarSeleccion(distancia) {
    const nada = { aplicado: false, modo: null, detecciones: [] }
    if (!vivo) return nada

    if (seleccion === null) {
      avisar(MSG_SIN_SELECCION, { nivel: NIVEL.ERROR })
      return nada
    }
    const parcela = estado.get()
    if (!verticeExiste(parcela, seleccion.recinto, seleccion.indice)) {
      avisar(
        `No se ha desplazado ningún lindero: el lado que estaba seleccionado (vértice ` +
          `${seleccion.indice + 1} de ${rotuloRecinto(seleccion.recinto)}) ya no existe en la ` +
          `parcela. Vuelve a seleccionar el lindero.`,
        { nivel: NIVEL.ERROR },
      )
      fijarSeleccion(null)
      return nada
    }

    const antes = parcela.recintos[seleccion.recinto].vertices
    const resultado = desplazarLado(parcela.recintos, seleccion, distancia)
    const despues = resultado.recintos[seleccion.recinto].vertices

    // El nivel de TODAS las detecciones sale de UN hecho medido —¿cambió el
    // anillo?— y no de un catálogo por tipo, que quedaría desfasado en cuanto
    // `edit/offset.js` publicara un `TIPO_OFFSET` nuevo. Ver la cabecera.
    const aplicado = !mismosVertices(antes, despues)
    const nivel = aplicado ? NIVEL.AVISO : NIVEL.ERROR
    for (const deteccion of resultado.detecciones) avisar(deteccion.mensaje, { nivel })

    if (!aplicado) {
      return { aplicado: false, modo: resultado.modo, detecciones: resultado.detecciones }
    }

    // Un BEVEL añade vértices al anillo, así que el índice del lado deja de
    // significar lo mismo — y `edit/offset.js` no publica en qué extremo biseló
    // (solo lo cuenta en el TEXTO de la detección, que es para el humano). En vez de
    // dejar el resalte señalando OTRO lado, se suelta la selección: el resalte
    // desaparece a la vista y los suscriptores se enteran, que es lo contrario de
    // hacerlo en silencio.
    if (antes.length !== despues.length) fijarSeleccion(null)

    aplicarRecintos(parcela, resultado.recintos)
    return { aplicado: true, modo: resultado.modo, detecciones: resultado.detecciones }
  }

  // ── Selección ─────────────────────────────────────────────────────────────

  /**
   * Selecciona el lado `indice → indice+1` del recinto indicado, o suelta la
   * selección con `null`.
   *
   * @param {RefVertice|null} ref
   * @returns {RefVertice|null}  La selección resultante (copia).
   */
  function seleccionarLado(ref) {
    if (!vivo) return null
    if (ref === null || ref === undefined) {
      fijarSeleccion(null)
      return null
    }
    const r = exigirFormaRef(ref, 'seleccionarLado')
    const parcela = estado.get()
    if (!verticeExiste(parcela, r.recinto, r.indice)) {
      avisar(
        `No se ha podido seleccionar ese lindero: el vértice ${r.indice + 1} de ` +
          `${rotuloRecinto(r.recinto)} no existe en la parcela.`,
        { nivel: NIVEL.ERROR },
      )
      fijarSeleccion(null)
      return null
    }
    fijarSeleccion({ recinto: r.recinto, indice: r.indice })
    return { ...seleccion }
  }

  /** La selección actual, en COPIA: un suscriptor no puede mutarnos el estado. */
  const ladoSeleccionado = () => (seleccion === null ? null : { ...seleccion })

  // ── Los dos ganchos de `viewer/sincronizacion.js` ─────────────────────────

  /**
   * Engancha el punto del gesto a la diana más cercana dentro de τ.
   *
   * Se llama en CADA FOTOGRAMA del arrastre, así que aquí no se construye nada que
   * se pueda reutilizar (ver la caché de dianas) y no se toca el store.
   *
   * @param {[number, number]} utm  Posición actual del vértice, UTM (m).
   * @param {RefVertice} refVertice  El vértice que se está moviendo. Se pasa a
   *   `dianasDe` como `excluir`: sin eso el vértice se engancha a sí mismo.
   * @param {object|null} [eventoOriginal]  El evento del gesto, si lo hay. Solo se
   *   le mira `altKey` (directo o en `originalEvent`).
   * @returns {Enganche|null}  `null` significa **«no tengo opinión: usa tu punto tal
   *   cual»**, y ocurre con el snap apagado (tecla o `snapActivo(false)`), sin estado,
   *   con una referencia que ya no señala ningún vértice, o tras `destruir()`. Con
   *   objeto, `punto` es SIEMPRE utilizable (copia del de entrada si no enganchó).
   */
  function ajustar(utm, refVertice, eventoOriginal = null) {
    if (!vivo) return null
    const ref = exigirFormaRef(refVertice, 'ajustar')

    const tau = toleranciaEfectiva(eventoOriginal)
    if (tau <= 0) {
      // Snap apagado: ni se construye el catálogo ni queda indicador colgando.
      ocultarIndicador()
      return null
    }

    const parcela = estado.get()
    // Referencia que ya no señala nada: NO se lanza en mitad de un arrastre y no se
    // engancha. Y no es un error tragado: mover un vértice que ya no existe lo
    // detecta y lo cuenta `sincronizacion.js#aplicarVertice` en el `dragend`, que es
    // su dueño. Aquí solo se renuncia a opinar.
    if (!verticeExiste(parcela, ref.recinto, ref.indice)) {
      ocultarIndicador()
      return null
    }

    const enganche = engancharPunto(utm, dianasVigentes(parcela, ref), { tolerancia: tau })
    if (enganche.enganchado) mostrarIndicador(enganche.punto, enganche.tipo)
    else ocultarIndicador()

    return { punto: enganche.punto, enganchado: enganche.enganchado, tipo: enganche.tipo }
  }

  /**
   * Cablea un marcador de vértice recién creado por `viewer/sincronizacion.js`.
   *
   * Añade TRES oyentes al marcador y **no lleva ninguna lista paralela**:
   * `quitarMarcadores` hace `m.off()` en cada reconstrucción, así que estos oyentes
   * se retiran solos. Una lista propia se quedaría obsoleta en la primera
   * reconstrucción y apuntaría a marcadores que ya no están en el mapa.
   *
   * @param {import('leaflet').Marker} marcador
   * @param {RefVertice} refVertice
   * @returns {void}
   */
  function alCrearMarcador(marcador, refVertice) {
    if (!vivo) return
    if (!marcador || typeof marcador.on !== 'function' || typeof marcador.getLatLng !== 'function') {
      throw new TypeError(
        `alCrearMarcador: 'marcador' debe ser un L.Marker (con on/getLatLng); ` +
          `recibido ${describir(marcador)}.`,
      )
    }
    const ref = exigirFormaRef(refVertice, 'alCrearMarcador')

    // Los marcadores se REHACEN en cada `sincronizar`, así que el estado de la
    // pantalla hay que aplicarlo también aquí: sin esto, cargar una parcela
    // estando en Validación devolvería 15 vértices arrastrables.
    aplicarArrastre(marcador)

    marcador.on('contextmenu', (evento) => {
      if (!vivo || !edicionActiva) return
      // Sin esto saldría ADEMÁS el menú del navegador encima del vértice.
      const dom = evento && evento.originalEvent ? evento.originalEvent : evento
      if (dom && typeof dom.preventDefault === 'function') L.DomEvent.preventDefault(dom)
      eliminar(ref)
    })

    marcador.on('drag', () => {
      if (!vivo || seleccion === null) return
      pintarSeleccion({ recinto: ref.recinto, indice: ref.indice, latlng: marcador.getLatLng() })
    })

    marcador.on('dragend', () => {
      if (!vivo) return
      // El indicador es del GESTO: se va con él, enganchara o no.
      ocultarIndicador()
      pintarSeleccion()
    })
  }

  // ── Gestos del mapa ───────────────────────────────────────────────────────

  /** Clic: selecciona el lindero más cercano, o deselecciona. NUNCA escribe. */
  /**
   * Pone el arrastre de UN marcador en lo que diga `edicionActiva`.
   *
   * `marcador.dragging` es el `L.Handler` que Leaflet monta cuando el marcador se
   * crea con `draggable: true` (`viewer/sincronizacion.js:958`, cableado en duro).
   * Apagar el oyente de `drag` NO bastaría: quien mueve el icono es `L.Draggable`
   * por CSS, así que el vértice se movería en pantalla aunque el modelo no se
   * enterara — el peor de los dos mundos.
   */
  function aplicarArrastre(marcador) {
    if (!marcador || !marcador.dragging) return
    if (edicionActiva) marcador.dragging.enable()
    else marcador.dragging.disable()
  }

  /** Los marcadores de vértice VIVOS en el mapa. Se reconocen por `refVertice`,
   *  que `viewer/sincronizacion.js` les cuelga a propósito para esto. */
  function marcadoresDeVertice() {
    const encontrados = []
    if (typeof mapa.eachLayer !== 'function') return encontrados
    mapa.eachLayer((capa) => {
      if (capa && capa.refVertice && typeof capa.getLatLng === 'function') encontrados.push(capa)
    })
    return encontrados
  }

  const alClicMapa = (evento) => {
    if (!vivo || !edicionActiva || !evento || !evento.latlng) return
    const parcela = estado.get()
    const mejor = ladoMasCercano(parcela, latLngAUTM(evento.latlng, zona))
    if (mejor === null) {
      fijarSeleccion(null)
      return
    }
    const px = pixelesEntre(latLngAUTM(evento.latlng, zona), mejor.proy.punto)
    // Fuera de la diana: se DESELECCIONA. Es lo que un usuario espera de un clic en
    // el vacío, y deja una forma evidente de soltar la selección sin buscar un botón.
    // Y no se avisa de nada: no ha fallado nada, el usuario ha pinchado fuera.
    fijarSeleccion(px > UMBRAL_PUNTERIA_PX ? null : { recinto: mejor.recinto, indice: mejor.indice })
  }

  /** Doble clic: inserta. Es el único gesto del MAPA que escribe en el modelo. */
  const alDobleClicMapa = (evento) => {
    if (!vivo || !edicionActiva || !evento || !evento.latlng) return
    const dom = evento.originalEvent
    if (dom && typeof dom.preventDefault === 'function') L.DomEvent.preventDefault(dom)
    insertarEn(evento.latlng)
  }

  // ── Arranque ──────────────────────────────────────────────────────────────

  mapa.on('click', alClicMapa)
  mapa.on('dblclick', alDobleClicMapa)

  // Insertar un vértice y ampliar el mapa con el MISMO gesto sería un efecto
  // sorpresa. Se apaga el zoom por doble clic mientras este módulo vive, y se
  // restaura tal como estaba en `destruir()` (dejar el mapa como se encontró es la
  // regla del visor).
  const zoomDobleClic = mapa.doubleClickZoom
  const zoomDobleClicEstaba =
    zoomDobleClic && typeof zoomDobleClic.enabled === 'function' ? zoomDobleClic.enabled() : false
  if (zoomDobleClicEstaba) zoomDobleClic.disable()

  if (doc) {
    doc.addEventListener('keydown', alTeclear)
    doc.addEventListener('keyup', alTeclear)
  }
  if (ventana) ventana.addEventListener('blur', alPerderFoco)

  const bajaDelStore = estado.subscribe(() => {
    if (!vivo) return
    // Invalidación de la caché por el camino del suscriptor (ver la política en la
    // cabecera: hace falta ADEMÁS de la comparación por identidad).
    cacheDianas = null
    // Una operación puede haber dejado la selección fuera de rango (otra vista ha
    // cargado una parcela distinta, un undo…). Se suelta y se anuncia: el resalte
    // desaparece a la vista, que es lo contrario de hacerlo en silencio.
    if (seleccion !== null && !verticeExiste(estado.get(), seleccion.recinto, seleccion.indice)) {
      fijarSeleccion(null)
      return
    }
    pintarSeleccion()
  })

  return {
    ajustar,
    alCrearMarcador,

    /**
     * Getter/setter de los CUATRO gestos de edición del mapa (rebanada 3).
     *
     * Sin argumento lee; con un booleano escribe y devuelve el valor ya escrito,
     * igual que {@link snapActivo}.
     *
     * Apagarla hace tres cosas, y las tres hacen falta:
     *   1. **desactiva el arrastre** de todos los marcadores vivos (y de los que
     *      nazcan después, por `alCrearMarcador`);
     *   2. **suelta la selección de lindero**, porque el resalte se quedaría
     *      pintado señalando algo que ya no se puede desplazar;
     *   3. **devuelve el zoom por doble clic** que este módulo le quita al mapa
     *      mientras edita — si no, en las otras pantallas el doble clic no haría
     *      NI insertar NI ampliar, que es un gesto muerto sin decirlo.
     *
     * Lo que NO apaga, a propósito: la API pública (`insertarEn`, `eliminar`,
     * `desplazarSeleccion`…). Esas las conduce la barra, la barra solo se ve en
     * Edición, y apagarlas aquí además dejaría a los tests de este módulo sin
     * forma de ejercitar el motor. La frontera es **el gesto del mapa**.
     *
     * @param {boolean} [valor]
     * @returns {boolean}
     */
    activa(valor) {
      if (valor === undefined) return edicionActiva
      if (typeof valor !== 'boolean') {
        throw new TypeError(
          `activa: 'valor' debe ser un booleano (o nada, para leer); recibido ${describir(valor)}.`,
        )
      }
      if (valor === edicionActiva) return edicionActiva
      edicionActiva = valor
      for (const marcador of marcadoresDeVertice()) aplicarArrastre(marcador)
      if (!edicionActiva) {
        fijarSeleccion(null)
        ocultarIndicador()
      }
      // Simétrico con el arranque: el módulo apaga el zoom por doble clic para
      // que insertar un vértice no amplíe además el mapa. Si no se está
      // editando, ese motivo no existe y el zoom vuelve.
      if (zoomDobleClicEstaba && zoomDobleClic) {
        if (edicionActiva) zoomDobleClic.disable()
        else zoomDobleClic.enable()
      }
      return edicionActiva
    },
    seleccionarLado,
    ladoSeleccionado,
    desplazarSeleccion,
    insertarEn,
    eliminar,

    /**
     * Getter/setter del snap. Sin argumento lee; con un booleano escribe y devuelve
     * el valor ya escrito. Es INDEPENDIENTE de la tecla `Alt`: esto es la
     * preferencia del usuario, `Alt` es el momentáneo.
     *
     * @param {boolean} [valor]
     * @returns {boolean}
     */
    snapActivo(valor) {
      if (valor === undefined) return snapEncendido
      if (typeof valor !== 'boolean') {
        throw new TypeError(
          `snapActivo: 'valor' debe ser un booleano (o nada, para leer); ` +
            `recibido ${describir(valor)}.`,
        )
      }
      snapEncendido = valor
      if (!snapEncendido) ocultarIndicador()
      return snapEncendido
    },

    /**
     * Getter/setter de τ, **en METROS**. Sin argumento lee. `0` es válido y apaga el
     * enganche (semántica de `edit/snap.js`). Cambiar τ NO invalida el catálogo de
     * dianas: el catálogo no depende de la tolerancia.
     *
     * @param {number} [metros]
     * @returns {number}
     */
    tolerancia(metros) {
      if (metros === undefined) return toleranciaM
      toleranciaM = exigirTolerancia(metros, 'tolerancia')
      return toleranciaM
    },

    /**
     * Fija los recintos de las parcelas VECINAS contra los que también se engancha
     * (los de F05). Array VACÍO = solo se engancha a la parcela propia y a la
     * oficial, que es el estado de partida: traer colindantes cuesta una petición al
     * WFS y no se hace a espaldas de nadie.
     *
     * ⚠️ Recibe RECINTOS (`{vertices, tipo}`), no parcelas. Lo que devuelve
     * `services/catastro.js#parcelaYColindantes` son PARCELAS, así que quien cablee
     * aplana: `edicion.fijarColindantes(resultado.datos.colindantes.flatMap((p) => p.recintos))`.
     * Pasar parcelas sin aplanar NO se acepta en silencio (no aportarían ni una
     * diana y el snap parecería roto sin motivo): se lanza diciendo qué hacer.
     *
     * @param {Array<{vertices: Array<[number,number]>}>} recintos
     * @returns {void}
     */
    fijarColindantes(recintos) {
      if (!vivo) return
      if (!Array.isArray(recintos)) {
        throw new TypeError(
          `fijarColindantes: se espera un array de recintos ({vertices, tipo}) de las parcelas ` +
            `vecinas, o [] si no hay ninguna; recibido ${describir(recintos)}.`,
        )
      }
      for (const rec of recintos) {
        if (rec && typeof rec === 'object' && Array.isArray(rec.recintos)) {
          throw new TypeError(
            `fijarColindantes: se espera un array de RECINTOS y ha llegado uno de PARCELAS (los ` +
              `elementos traen 'recintos'). Aplana lo que devuelve F05: ` +
              `colindantes.flatMap((p) => p.recintos).`,
          )
        }
      }
      // Copia superficial: cambia la identidad en cada llamada (que es lo que tira
      // la caché) y no queda atada a un array que el llamante pueda seguir mutando.
      colindantes = [...recintos]
      vecinasParaDianas = colindantes.length === 0 ? [] : [{ recintos: colindantes }]
      cacheDianas = null
    },

    /**
     * Se suscribe a los cambios de selección. Devuelve la función de BAJA.
     * El suscriptor recibe una COPIA de la `RefVertice`, o `null`.
     *
     * @param {(ref: RefVertice|null) => void} fn
     * @returns {() => void}
     */
    alCambiarSeleccion(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(
          `alCambiarSeleccion: 'fn' debe ser una función; recibido ${describir(fn)}.`,
        )
      }
      oyentesSeleccion.add(fn)
      return () => oyentesSeleccion.delete(fn)
    },

    /**
     * Deja el módulo inerte y el mapa como estaba: capas fuera, oyentes del mapa, del
     * documento y de la ventana retirados, baja del store y `doubleClickZoom`
     * restaurado. IDEMPOTENTE.
     *
     * Se desmonta en orden inverso al montaje (la regla del visor, `viewer/index.js`):
     * primero se deja de escuchar, después se retira lo pintado.
     *
     * No anuncia la selección a `null` al soltarla: los oyentes se están yendo con la
     * pantalla, y notificar a quien se desmonta es la clase de aviso que acaba
     * escribiendo en un DOM que ya no existe.
     */
    destruir() {
      if (!vivo) return
      vivo = false
      bajaDelStore()
      mapa.off('click', alClicMapa)
      mapa.off('dblclick', alDobleClicMapa)
      if (doc) {
        doc.removeEventListener('keydown', alTeclear)
        doc.removeEventListener('keyup', alTeclear)
      }
      if (ventana) ventana.removeEventListener('blur', alPerderFoco)
      if (zoomDobleClicEstaba && zoomDobleClic && typeof zoomDobleClic.enable === 'function') {
        zoomDobleClic.enable()
      }
      ocultarIndicador()
      quitarResalte()
      oyentesSeleccion.clear()
      seleccion = null
      cacheDianas = null
      colindantes = []
      vecinasParaDianas = []
      altPulsado = false
    },
  }
}
