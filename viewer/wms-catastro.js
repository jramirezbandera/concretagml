// viewer/wms-catastro.js — F03 · Tarea 2B.2. Cartografía del Catastro POR ENCUADRE.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ POR QUÉ ESTE MÓDULO NO TESELA — la restricción más importante del        ║
// ║ proyecto. El WMS `ServidorWMS.aspx` RASTERIZA la imagen en cada          ║
// ║ petición (no sirve teselas pregeneradas) y la DGC desaconseja            ║
// ║ oficialmente el uso en mosaico: "un visor mal diseñado lanza hasta 30    ║
// ║ consultas por pantalla" (dossier §2.3/§2.5). La penalización por abuso   ║
// ║ es denegación de servicio ~10 días, con detección de rotación de IP/UA.  ║
// ║ Teselar este servicio es EL mayor riesgo de bloqueo del proyecto.        ║
// ║ Por eso aquí NO se usa `L.tileLayer.wms` NUNCA: se gestiona un único     ║
// ║ `L.ImageOverlay` = UNA imagen del viewport = UNA petición por encuadre   ║
// ║ (criterio de aceptación 2 de F03, medible en el nº de peticiones).       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// Decisiones deliberadas de este módulo (cada una con su razón; no cambiar sin
// leerlas):
//
// 1) WMS **1.1.1 con `SRS=`**, no 1.3.0 con `CRS=`. En 1.1.1 el orden de ejes de
//    un CRS proyectado es SIEMPRE X,Y, que es justo la garantía que se busca
//    (en 1.3.0 el orden depende del CRS y reaparece la trampa lat/lon).
//    VERIFICADO el 2026-07-26 contra el servicio real, y resulta ser
//    **OBLIGATORIO**, no una preferencia (ver hecho (a) más abajo).
//
// 2) Se escucha **`moveend` + `resize`, y NO `zoomend`**. El plan original decía
//    `moveend`+`zoomend`, pero Leaflet emite AMBOS en cada zoom
//    (`Map#_moveEnd(zoomChanged)`: `fire('zoomend')` y después `fire('moveend')`
//    — leaflet-src.js 1.9.4 ~línea 4357). `moveend` cubre pan y zoom por igual,
//    porque en ambos casos cambian centro/zoom y Leaflet pasa por `_moveEnd`.
//    Verificado empíricamente por partida doble en
//    `test/viewer/wms-catastro.dom.test.js`: (a) un solo `setZoom` deja la traza
//    `['zoomend','moveend']`; (b) por MUTACIÓN de este módulo (añadir
//    `eventos.zoomend` y desactivar la deduplicación del punto 3 a la vez), un
//    zoom pasa a emitir **2 peticiones** en vez de 1 → el criterio 2 se rompe.
//    Matiz honesto medido en esa misma mutación: con la deduplicación puesta,
//    suscribir también `zoomend` NO duplicaría (en `zoomend` el encuadre ya es el
//    nuevo, así que ambos eventos calculan la MISMA URL y la segunda se
//    deduplica). Son dos defensas independientes; suscribir solo `moveend` es la
//    primera y hace que el criterio no DEPENDA de la segunda.
//    `resize` se escucha porque `invalidateSize()` cambia el tamaño de la imagen
//    pedida; y como `invalidateSize` emite `moveend` Y `resize` (en ese orden, ya
//    con el tamaño nuevo), aquí sí es la deduplicación la que evita la doble.
//
// 3) **Deduplicación por URL:** si la URL recién calculada es idéntica a la
//    última pedida, no se lanza petición. Un `moveend` que no mueve el mapa
//    (Leaflet lo emite igual: `panBy` con desplazamiento 0 hace
//    `return this.fire('moveend')`) cuesta 0 peticiones.
//
// 4) **Token de secuencia anti-carrera** (hallazgo C9/T5 de la review): cada
//    petición captura un número de un contador monótono. Al resolverse una
//    carga, si su número no es el último emitido, se descarta para la imagen
//    (sí se contabiliza en `estado()`). Una respuesta lenta de un encuadre viejo
//    NUNCA puede pisar una imagen más nueva.
//
// 5) **La imagen previa se mantiene hasta que la nueva ha cargado.**
//    `ImageOverlay#setUrl` asigna `src` sobre la imagen VISIBLE y deja el hueco
//    en blanco mientras descarga. Por eso se precarga en un `new Image()`
//    desprendido (con `crossOrigin='anonymous'` ANTES de `src`, regla CORS del
//    dossier §4.4) y solo en su `load` se hace `setBounds`+`setUrl` sobre el
//    overlay visible: la imagen ya está en la caché del navegador, así que el
//    intercambio es inmediato y no genera una segunda petición de red.
//
// 6) **Error de carga → aviso, jamás silencio** (regla de oro 1; hallazgo T3 de
//    la review). Nivel `NIVEL.AVISO`, NO ERROR: es cartografía de FONDO que no
//    carga, el mismo suceso que un `tileerror` del IGN, y no bloquea la
//    generación del GML (la regla completa está junto al typedef `Avisar` de
//    `viewer/_comun.js`). Y se distingue en el mensaje "no hay cartografía
//    cargada" de "se sigue mostrando la del encuadre anterior (obsoleta)": para
//    el usuario son dos situaciones distintas. Excepción razonada: el fallo de una petición
//    ya SUPERADA por otra más nueva se contabiliza pero no se anuncia (avisar de
//    un encuadre que ya nadie está mirando sería una falsa alarma; la petición
//    vigente reportará su propio resultado).
//
// 7) `getMapUrl` es **agnóstica de CRS a propósito**: recibe el BBOX ya en las
//    unidades del CRS pedido y no proyecta nada. La capa la usa con
//    `EPSG:3857` (el CRS del mapa de Leaflet, para que la imagen encaje píxel a
//    píxel con el lienzo), y F09 reutilizará LA MISMA función con `EPSG:25830`
//    para el plano a 300 ppp del informe (dossier §4.4, receta A, paso 4).
//
// 8) **Una única constante base**, `CATASTRO_WMS` (dossier §2.4): si algún día
//    retiran CORS, se apunta a un proxy en un solo sitio y el resto del código
//    no se entera. Hoy CORS está VERIFICADO (`ACAO:*`, y la imagen con
//    `crossOrigin='anonymous'` NO contamina el canvas — dossier §0.6, override
//    O7), lo que además habilita el plano del informe.
//
// 9) **Doble uso con la misma factory:** base opaca (`pane:'tilePane'`,
//    opacidad 1, `transparente:false`) y superpuesta translúcida
//    (`pane:'overlayPane'`, opacidad regulable, `transparente:true`). El
//    criterio real es **1 petición por INSTANCIA VISIBLE**: con base y
//    superpuesta activas a la vez son 2 peticiones por encuadre, y eso es lo
//    esperado, no un fallo (son dos imágenes distintas: opaca y con
//    transparencia).
//
// HECHOS VERIFICADOS CONTRA EL SERVICIO REAL — banco de pruebas 2D.1, medido el
// **2026-07-26** en navegador real (`GetCapabilities` + `GetMap` reales). Lo que
// hasta esa fecha era una lista de SUPUESTOS es ahora una lista de hechos, con su
// evidencia. Los siete supuestos originales quedaron CONFIRMADOS y ninguno obligó
// a cambiar el diálogo con el servicio; el único cambio de código que salió del
// banco es la guarda de tamaño del punto (f):
//   a) **`VERSION=1.1.1` + `SRS=` es obligatorio, no una preferencia.** El
//      servidor declara `<WMT_MS_Capabilities version="1.1.1">`;
//      `VERSION=1.3.0&CRS=EPSG:3857` devuelve `ServiceException
//      code="InvalidFormat"` con `SRS () Invalido` — o sea que **no lee `CRS=` en
//      absoluto**; y `VERSION=1.3.0&SRS=…` sí sirve el PNG, o sea que **ignora
//      `VERSION`**. Pedirle el Capabilities en 1.3.0 devuelve el documento 1.1.1
//      byte a byte (28799 B en ambos casos). Lo que manda es `SRS=`.
//   b) **`EPSG:3857` está anunciado Y bien georreferenciado.** El `<Layer>` raíz
//      declara `<SRS>EPSG:3785</SRS>` y `<SRS>EPSG:3857</SRS>` más un
//      `<BoundingBox SRS="EPSG:3857" …>`; en 1.1.1 el SRS del Layer raíz se
//      HEREDA y las seis capas son hijas directas. Superponiendo la catastral
//      translúcida sobre la WMTS `ign-base` (rejilla `GoogleMapsCompatible`
//      canónica de 3857), los linderos trazan sobre las huellas de edificio, los
//      bordes de calzada y el cruce en Y del IGN con concordancia SUBMÉTRICA.
//   c) **`FORMAT=image/png`**: `Content-Type: image/png`, PNG 900×600 RGBA.
//   d) **`TRANSPARENT=TRUE|FALSE` se honra**: salidas distintas y comprobables
//      (RGBA de 77795 B vs colormap de 41703 B).
//   e) **Capas en minúscula y las seis en una sola petición.** El Capabilities
//      las declara con OTRA capitalización (`Catastro, CONSTRU, MASA, SUBPARCE,
//      TEXTOS, LIMITES`), pero el servidor es INSENSIBLE a mayúsculas: ambas
//      formas devuelven imágenes de 77795 B idénticos. Las seis combinan en una
//      sola petición, como se pide aquí.
//   f) **Techo silencioso de 4000 px por eje** (era el supuesto "MaxWidth/
//      MaxHeight"): ver {@link MAX_PIXELES_WMS}. El servicio NO declara esos
//      elementos (WMS 1.1.1 no los tiene) y recorta EN SILENCIO.
//   g) **El error es un `ServiceException` XML, nunca una imagen**:
//      `<ServiceExceptionReport version="1.1.1">` con `Content-Type: text/xml;
//      charset=iso-8859-1`, y en navegador real los cuatro casos de error
//      disparan el `onerror` del `<img>`. MATIZ IMPORTANTE Y NO OBVIO: el
//      servidor responde **HTTP 200**, no 4xx — el `error` salta porque un cuerpo
//      `text/xml` no es una imagen decodificable, NO por el código de estado. La
//      ruta de aviso del punto 6 funciona, pero depende de eso: si algún día el
//      servicio devolviera un PNG con el texto del error dentro, el `onerror` no
//      se dispararía y el aviso no llegaría nunca.
//   h) **Criterio de aceptación 2, verificado EN VIVO** (no solo en jsdom): 4
//      peticiones `GetMap` para 4 encuadres (carga, pan, dos zooms), todas con
//      `WIDTH=900&HEIGHT=600` y cuatro BBOX distintos; un pan nulo cuesta **0**
//      peticiones (deduplicación del punto 3); **cero** peticiones con
//      `WIDTH=256` (ni rastro de mosaico). Todas HTTP 200 con
//      `Access-Control-Allow-Origin: *`, y el canvas quedó **CLEAN**
//      (`toDataURL` y `getImageData` sin `SecurityError`): reconfirma el override
//      O7 en vivo y hace viable la receta del plano a 300 ppp de F09.
//
// Este módulo IMPORTA LEAFLET → es SOLO-NAVEGADOR: su test es `*.dom.test.js` y
// NO entra en el barrel raíz `index.js` (rompería la suite `node`; ver la nota
// de `viewer/_comun.js`). Tampoco importa `leaflet/dist/leaflet.css`.

import L from 'leaflet'
import { ATRIBUCION } from './atribucion.js'
import { NIVEL, resolverAvisar } from './_comun.js'

// ── Constantes del servicio ───────────────────────────────────────────────────

/**
 * Endpoint ÚNICO del WMS por capas del Catastro (dossier §2.1). Punto único de
 * contingencia CORS (§2.4): nadie más debe escribir esta URL.
 */
export const CATASTRO_WMS = 'https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx'

/**
 * Versión de WMS que se pide. 1.1.1 → el parámetro del CRS se llama `SRS` y el
 * orden de ejes de un CRS proyectado es siempre X,Y (ver decisión 1 de la
 * cabecera). VERIFICADA el 2026-07-26 contra el servicio real: lo que el
 * servidor lee de verdad es `SRS=` (con `CRS=` responde `SRS () Invalido`), y
 * declara `<WMT_MS_Capabilities version="1.1.1">`. No es negociable; si algún
 * día lo fuera, se cambia aquí y solo aquí (la versión no está cableada en
 * ningún otro sitio).
 */
export const VERSION_WMS = '1.1.1'

/** CRS del mapa de Leaflet: el único que la CAPA sabe proyectar por sí sola. */
export const CRS_MAPA = 'EPSG:3857'

/** Capas del WMS catastral que pide el visor (spec F03 §"WMS del Catastro"). */
export const CAPAS_DEFECTO = Object.freeze([
  'catastro',
  'constru',
  'masa',
  'subparce',
  'textos',
  'limites',
])

/** Formato de imagen por defecto (PNG: admite transparencia para la superpuesta). */
export const FORMATO_DEFECTO = 'image/png'

/**
 * **Techo duro de tamaño de imagen del WMS del Catastro: 4000 px por eje.**
 *
 * MEDIDO el 2026-07-26 contra el servicio real (banco 2D.1): el servidor recorta
 * EN SILENCIO y devuelve siempre HTTP 200 con un PNG válido de otro tamaño.
 * `WIDTH=4001&HEIGHT=100` devolvió un PNG de **4000×2000** (¡recorta y además
 * reescala el otro eje!); `5000²`, `8000²` y `10000²` devolvieron todos
 * **4000×4000**. El servicio **no declara** el límite: WMS 1.1.1 no tiene los
 * elementos `MaxWidth`/`MaxHeight` del 1.3.0, así que no hay forma de leerlo del
 * Capabilities — solo midiéndolo.
 *
 * Por qué {@link getMapUrl} LANZA al superarlo (regla de oro 1): sin esta guarda,
 * `getMapUrl` construía sin objeción un `WIDTH=6000` y el llamante recibía una
 * imagen de otro tamaño **sin enterarse** — un boquete en la regla 1 (error
 * silencioso) y, peor, una imagen con otra escala de la que el llamante cree.
 * **F09 pide 2126 px de ancho para un plano de 180 mm a 300 ppp y podría pedir
 * más** en formatos grandes. Como ahí el tamaño lo ELIGE el programador (no el
 * usuario), la política del proyecto es `throw`: F09 debe trocear el plano en
 * varias peticiones o reducir el tamaño DELIBERADAMENTE, no descubrir el recorte
 * por accidente.
 *
 * ⛔ **Y en el visor SÍ se dispara** — aquí decía «no se dispara nunca (el tamaño
 * es el del lienzo)», y era falso: el lienzo lo elige el MONITOR del usuario, no
 * el programador. Un 8K son 7680 px de ancho, y un mapa embebido a lo ancho de un
 * escritorio grande pasa de 4000 sin esfuerzo. Con aquel supuesto, `_solicitar`
 * pasaba el tamaño del lienzo sin guarda y cada `moveend` lanzaba dentro del
 * `fire()` de Leaflet: la capa se quedaba muda para siempre y el canal de avisos
 * no se enteraba. La capa ya no le pide al servicio lo que no puede dar: recorta
 * al techo conservando la proporción y lo DICE una vez. Ver {@link
 * tamanoAlTecho} y {@link MENSAJES.LIENZO_SOBRE_EL_TECHO}.
 */
export const MAX_PIXELES_WMS = 4000

/** Opacidad por defecto de la instancia superpuesta (la Fase 3 la regula en vivo). */
export const OPACIDAD_SUPERPUESTA = 0.6

/**
 * Duración del fundido con el que entra cada imagen nueva, en ms.
 *
 * ── EL PROBLEMA QUE RESUELVE (medido, Fase 5) ───────────────────────────────
 * Al hacer zoom, Leaflet ESCALA la imagen del encuadre anterior para mantenerla
 * en su sitio geográfico (`ImageOverlay._animateZoom`/`_reset`): de 1048x900
 * pasa a 2096x1800, correctamente centrada. Se queda así **entre 350 y 520 ms**
 * —lo que tarda el WMS en responder— y entonces la nueva la sustituye **de
 * golpe, en un solo frame**.
 *
 * Ese corte seco es lo que el ojo lee como «la cartografía se mueve y luego
 * vuelve a su sitio». Lo que salta es el CONTENIDO — el WMS re-rasteriza rótulos
 * y grosores a la escala nueva, así que los textos de la imagen ampliada no
 * están donde el servidor los pone en la imagen nueva.
 *
 * Un matiz medido, para que nadie persiga la pista equivocada: el
 * `setBounds`+`setUrl` de `_alCargar` SÍ deja un frame con la imagen vieja ya
 * colocada en la geometría nueva —el navegador reposiciona antes de pintar el
 * `src`—, pero es **UN solo frame** y no explica nada de un fenómeno que dura
 * 350-520 ms. (El reflow forzado de `_fundirEntrada` lo elimina de paso.)
 * `scripts/smoke-navegador/05-salto-zoom.js` lo sigue contando como regresión.
 *
 * ── POR QUÉ NO SE ARREGLA PIDIENDO ANTES ────────────────────────────────────
 * La causa de fondo es la restricción central del proyecto: UNA imagen por
 * encuadre, nunca teselas. Mientras no llega la nueva, lo único disponible es la
 * anterior estirada. Adelantar la petición a `zoomanim` ganaría esos ms, pero
 * pediría encuadres intermedios en cuanto alguien encadenara zooms — y el abuso
 * de este WMS se castiga con denegación de servicio (ver la cabecera). No se
 * hace: el criterio de aceptación 2 vale más que la suavidad.
 *
 * ── QUÉ SE HACE, ENTONCES ───────────────────────────────────────────────────
 * Repartir la discontinuidad en dos mitades suaves, SIN tocar ni una petición:
 * al empezar un zoom la imagen visible se ATENÚA (ya se sabe que es provisional,
 * y atenuada lo parece), y la nueva ENTRA fundida hasta la opacidad de la capa.
 * El cambio de escala sigue ocurriendo, pero ya no coincide con un frente de
 * opacidad plena, que es lo que lo hacía leer como salto.
 *
 * Es puramente visual: no cambia `urlVisible()`, ni `estado()`, ni el momento en
 * que la imagen se aplica. Un navegador que ignorase la transición CSS vería el
 * comportamiento anterior, no uno roto.
 */
export const MS_FUNDIDO = 180

/**
 * Fracción de la opacidad de la capa a la que se atenúa la imagen mientras es
 * PROVISIONAL (durante el zoom, y como punto de partida del fundido de entrada).
 *
 * No es 0 a propósito: a cero habría un instante SIN cartografía catastral
 * ninguna, que es peor que verla provisional — el usuario está calcando sobre
 * ella y perderla, aunque sea 180 ms, desorienta más que verla tenue.
 */
const FRACCION_PROVISIONAL = 0.35

/**
 * ⭐ **CUÁNTO SUELO PUEDE CUBRIR UN PÍXEL ANTES DE QUE PEDIR LA IMAGEN NO SIRVA
 * PARA NADA: 10 metros.** Por encima de esto, `_encuadre` devuelve `null` y **no
 * se emite ningún `GetMap`**.
 *
 * ── DE DÓNDE SALE EL 10, QUE ES LO ÚNICO QUE HAY QUE DEFENDER ──────────────
 * De lo que se está dibujando. Lo que esta capa pinta son PARCELAS, y la parcela
 * urbana pequeña de este país ronda los 100 m², o sea unos **10 m de lado**. Con un
 * píxel de más de 10 m, la parcela más pequeña que el servicio puede dibujar **no
 * ocupa ni un píxel entero**: la imagen que vuelve no es peor, es que no puede
 * contener la información que se le está pidiendo. No es un umbral de gusto ni de
 * rendimiento — es el punto por debajo del cual la pregunta no tiene respuesta
 * posible.
 *
 * ⚠️ **Es DELIBERADAMENTE flojo, y conviene saberlo.** A 10 m/px las parcelas
 * siguen sin verse de forma útil; para eso hacen falta 1 o 2 m/px. El suelo no está
 * puesto donde la capa empieza a SERVIR, sino donde deja de poder servir **en
 * absoluto**, porque lo que se está retirando es una petición inútil y no una
 * decisión de producto sobre a qué escala se enseña la cartografía. Apretar esta
 * cifra hacia 2 haría desaparecer la capa a escala de ciudad, y eso ya sí es una
 * decisión de producto con su propio dueño y su propia conversación.
 *
 * ── LO QUE ESTO NO ES ─────────────────────────────────────────────────────
 * NO es el umbral del clic que deduce la referencia catastral. Aquel vive en
 * `app/cableado-catastro.js` y es MUCHO más estricto (2 m/px), porque contesta a
 * otra pregunta: allí no se trata de si el servicio puede dibujar la parcela, sino
 * de si una persona puede APUNTARLE con el ratón. Dos preguntas distintas, dos
 * números distintos, y ninguno de los dos se copia del otro.
 *
 * ⛔ **Y no se declara aquí ningún número de zoom.** Ver la nota de `_encuadre`:
 * un zoom es una escala distinta en cada latitud, y este módulo se mide en metros.
 */
const METROS_POR_PIXEL_MAXIMO = 10

/**
 * Mensajes de usuario del módulo (español, mostrables tal cual). Exportados para
 * que la UI de avisos de Fase 3/4 y los tests los referencien en vez de
 * parafrasearlos. Distinguen las dos situaciones del punto 6 de la cabecera.
 */
export const MENSAJES = Object.freeze({
  SIN_CARTOGRAFIA:
    'No se ha podido cargar la cartografía catastral del Catastro; el mapa se muestra sin ella.',
  OBSOLETA:
    'No se ha podido actualizar la cartografía catastral del Catastro; se sigue mostrando ' +
    'la del encuadre anterior (obsoleta).',
  /**
   * El mapa es más grande de lo que el servicio sabe servir. **No es un fallo y
   * no se pierde nada geométrico**: la imagen se estira sobre el mismo encuadre,
   * así que sigue encajando con la geometría; lo único que baja es la nitidez. Se
   * dice igual (regla de oro 1) porque «hoy la cartografía se ve peor que ayer en
   * otro monitor» es exactamente el tipo de cosa que, sin explicación, se lee como
   * que la aplicación se ha estropeado.
   *
   * Las cifras concretas (lienzo, tamaño pedido, techo) van en el DETALLE, no en
   * el texto: el mensaje es constante para que la UI y los tests lo comparen por
   * identidad, como los otros dos.
   */
  LIENZO_SOBRE_EL_TECHO:
    'El mapa es más grande de lo que el servicio de cartografía del Catastro sabe servir ' +
    `(${MAX_PIXELES_WMS} px por lado), así que se pide a menor resolución y se ve menos ` +
    'nítida. Encaja igual con la geometría: no afecta a las medidas ni al GML.',
})

// Decimales con los que se serializan las coordenadas del BBOX. 3 decimales =
// 1 mm, muy por debajo de cualquier tamaño de píxel del visor (y del cm
// catastral): no se pierde nada y las URLs quedan legibles y comparables (lo que
// además favorece los aciertos de la caché HTTP del navegador → menos peticiones
// al Catastro, que es la misión de este módulo).
const DECIMALES_COORD = 3

// Placeholder de Leaflet para la imagen del overlay ANTES de la primera carga:
// un GIF 1×1 transparente embebido como `data:` URI → CERO peticiones de red.
// El overlay debe tener un `src` desde su creación (`ImageOverlay#_initImage`);
// con esto la primera imagen real no llega nunca de un `src` vacío (que en un
// navegador resolvería a la propia página y sí generaría una petición).
const IMAGEN_VACIA = L.Util.emptyImageUrl

// ── getMapUrl — función pura, agnóstica de CRS ────────────────────────────────

/**
 * BBOX ya expresado en las unidades del CRS que se va a pedir, en orden X,Y.
 * @typedef {Object} BBoxProyectado
 * @property {number} minX  Xmin (Este mínimo).
 * @property {number} minY  Ymin (Norte mínimo).
 * @property {number} maxX  Xmax (Este máximo).
 * @property {number} maxY  Ymax (Norte máximo).
 */

/**
 * @typedef {Object} TamanoImagen
 * @property {number} ancho  Ancho de la imagen en píxeles (> 0).
 * @property {number} alto   Alto de la imagen en píxeles (> 0).
 */

/**
 * Construye la URL de un `GetMap` del WMS del Catastro. **No proyecta nada** y
 * **nunca reordena ejes**: el `bbox` llega ya en las unidades del CRS pedido y
 * en orden X,Y (dossier §2.5: 25830/25829/25831/3857 → `Xmin,Ymin,Xmax,Ymax`,
 * sin invertir; 4326/4258 van lat,lon y quien los use debe invertir ANTES de
 * llamar aquí — por eso este módulo no los admite: `validarCRS` no lo impide,
 * pero la responsabilidad del orden es del llamante).
 *
 * Los valores se concatenan SIN percent-encoding en `:` `,` y `/` (caracteres
 * legales en un query string, RFC 3986) para que la URL sea literalmente de la
 * misma forma que el único ejemplo verificado del dossier §2.2.
 *
 * @param {BBoxProyectado} bbox   BBOX YA en unidades del CRS pedido.
 * @param {TamanoImagen} tamano   Tamaño de la imagen en píxeles. Ningún eje puede
 *   superar {@link MAX_PIXELES_WMS} (techo silencioso del servicio: se lanza en
 *   vez de recibir una imagen de otro tamaño sin saberlo).
 * @param {object} [opts]
 * @param {string} [opts.crs='EPSG:3857']       CRS pedido (forma WMS `EPSG:nnnnn`).
 * @param {string[]} [opts.capas=CAPAS_DEFECTO] Capas del WMS, en orden de dibujo.
 * @param {string} [opts.formato='image/png']   `FORMAT` del GetMap.
 * @param {boolean} [opts.transparente=false]   `TRANSPARENT=TRUE|FALSE`.
 * @returns {string}  URL absoluta lista para `img.src`.
 * @throws {TypeError|RangeError}  Contrato roto por el programador (regla de oro
 *   1: aquí no hay dato de usuario que avisar, hay un bug que hay que ver).
 */
export function getMapUrl(bbox, tamano, opts = {}) {
  if (opts === null || typeof opts !== 'object') {
    throw new TypeError(`getMapUrl: 'opts' debe ser un objeto; recibido ${typeof opts}.`)
  }
  const {
    crs = CRS_MAPA,
    capas = CAPAS_DEFECTO,
    formato = FORMATO_DEFECTO,
    transparente = false,
  } = opts

  const { minX, minY, maxX, maxY } = validarBBox(bbox)
  const { ancho, alto } = validarTamano(tamano)
  validarCRS(crs)
  const capasValidas = validarCapas(capas)
  validarFormato(formato)

  const partes = [
    'SERVICE=WMS',
    `VERSION=${VERSION_WMS}`,
    'REQUEST=GetMap',
    `SRS=${crs}`,
    `BBOX=${[minX, minY, maxX, maxY].map(formatearCoord).join(',')}`,
    `WIDTH=${ancho}`,
    `HEIGHT=${alto}`,
    `FORMAT=${formato}`,
    `TRANSPARENT=${transparente ? 'TRUE' : 'FALSE'}`,
    `LAYERS=${capasValidas.join(',')}`,
    // STYLES es OBLIGATORIO en WMS aunque vaya vacío (= estilo por defecto de
    // cada capa). Omitirlo es una de las causas clásicas de ServiceException.
    'STYLES=',
  ]

  return `${CATASTRO_WMS}?${partes.join('&')}`
}

/** Coordenada → texto: recorta a 1 mm y quita ceros/exponentes innecesarios. */
function formatearCoord(valor) {
  const redondeado = Number(valor.toFixed(DECIMALES_COORD))
  return String(Object.is(redondeado, -0) ? 0 : redondeado)
}

/**
 * @param {*} bbox
 * @returns {BBoxProyectado}
 * @throws {TypeError|RangeError}
 */
function validarBBox(bbox) {
  if (bbox === null || typeof bbox !== 'object') {
    throw new TypeError(
      `getMapUrl: 'bbox' debe ser {minX,minY,maxX,maxY}; recibido ${typeof bbox}.`,
    )
  }
  for (const clave of ['minX', 'minY', 'maxX', 'maxY']) {
    if (typeof bbox[clave] !== 'number' || !Number.isFinite(bbox[clave])) {
      throw new TypeError(
        `getMapUrl: 'bbox.${clave}' debe ser un número finito; recibido ` +
          `${JSON.stringify(bbox[clave])}. BBOX completo: ${JSON.stringify(bbox)}.`,
      )
    }
  }
  if (bbox.minX >= bbox.maxX) {
    throw new RangeError(
      `getMapUrl: BBOX degenerado o invertido en X (minX=${bbox.minX} >= maxX=${bbox.maxX}). ` +
        'El BBOX va en orden Xmin,Ymin,Xmax,Ymax y en unidades del CRS (dossier §2.5).',
    )
  }
  if (bbox.minY >= bbox.maxY) {
    throw new RangeError(
      `getMapUrl: BBOX degenerado o invertido en Y (minY=${bbox.minY} >= maxY=${bbox.maxY}). ` +
        'El BBOX va en orden Xmin,Ymin,Xmax,Ymax y en unidades del CRS (dossier §2.5).',
    )
  }
  return { minX: bbox.minX, minY: bbox.minY, maxX: bbox.maxX, maxY: bbox.maxY }
}

/**
 * @param {*} tamano
 * @returns {{ancho:number, alto:number}}  Píxeles ENTEROS (WMS exige enteros en
 *   WIDTH/HEIGHT; redondear un contador de píxeles no altera ningún dato).
 * @throws {TypeError|RangeError}
 */
function validarTamano(tamano) {
  if (tamano === null || typeof tamano !== 'object') {
    throw new TypeError(
      `getMapUrl: 'tamano' debe ser {ancho,alto} en píxeles; recibido ${typeof tamano}.`,
    )
  }
  for (const clave of ['ancho', 'alto']) {
    if (typeof tamano[clave] !== 'number' || !Number.isFinite(tamano[clave])) {
      throw new TypeError(
        `getMapUrl: 'tamano.${clave}' debe ser un número finito; recibido ` +
          `${JSON.stringify(tamano[clave])}.`,
      )
    }
    if (tamano[clave] <= 0) {
      throw new RangeError(
        `getMapUrl: 'tamano.${clave}' debe ser > 0 píxeles; recibido ${tamano[clave]}.`,
      )
    }
    // Se compara el valor YA REDONDEADO: es el que va a viajar en WIDTH/HEIGHT,
    // y un 4000.4 no debe rechazarse por su parte decimal.
    if (Math.round(tamano[clave]) > MAX_PIXELES_WMS) {
      throw new RangeError(
        `getMapUrl: 'tamano.${clave}' = ${tamano[clave]} px supera el techo del servicio ` +
          `(${MAX_PIXELES_WMS} px por eje, medido el 2026-07-26). El WMS del Catastro NO ` +
          `declara ese límite y lo aplica EN SILENCIO: devolvería HTTP 200 con un PNG de ` +
          `otro tamaño y el llamante trabajaría con una escala equivocada sin enterarse ` +
          `(regla de oro 1). Trocea la imagen en varias peticiones o reduce el tamaño ` +
          `deliberadamente (F09, plano a 300 ppp).`,
      )
    }
  }
  return { ancho: Math.round(tamano.ancho), alto: Math.round(tamano.alto) }
}

/**
 * El CRS se escribe en la forma WMS `EPSG:nnnnn`. NO se acepta la forma URN/URI
 * del WFS (`urn:ogc:def:crs:EPSG::25830`, `http://www.opengis.net/def/crs/...`):
 * confundirlas es un error real y fácil, porque en este mismo proyecto el WFS y
 * el GML sí usan esas formas (overrides O2/O10).
 *
 * @param {*} crs
 * @throws {TypeError}
 */
function validarCRS(crs) {
  if (typeof crs !== 'string' || !/^EPSG:\d{4,6}$/.test(crs)) {
    throw new TypeError(
      `getMapUrl: 'crs' debe tener la forma WMS 'EPSG:nnnnn' (p. ej. 'EPSG:3857' o ` +
        `'EPSG:25830'); recibido ${JSON.stringify(crs)}. La forma URN/URI ` +
        `('urn:ogc:def:crs:EPSG::25830') es del WFS/GML, no del WMS.`,
    )
  }
}

/**
 * @param {*} capas
 * @returns {string[]}
 * @throws {TypeError}
 */
function validarCapas(capas) {
  if (!Array.isArray(capas) || capas.length === 0) {
    throw new TypeError(
      `getMapUrl: 'capas' debe ser un array NO vacío de nombres de capa; recibido ` +
        `${JSON.stringify(capas)}.`,
    )
  }
  for (const capa of capas) {
    if (typeof capa !== 'string' || capa.trim() === '' || capa.includes(',')) {
      throw new TypeError(
        `getMapUrl: cada capa debe ser un string no vacío y sin comas (la coma separa ` +
          `capas en LAYERS); recibido ${JSON.stringify(capa)}.`,
      )
    }
  }
  return capas.slice()
}

/**
 * @param {*} formato
 * @throws {TypeError}
 */
function validarFormato(formato) {
  if (typeof formato !== 'string' || formato.trim() === '') {
    throw new TypeError(
      `getMapUrl: 'formato' debe ser un string no vacío (p. ej. 'image/png'); recibido ` +
        `${JSON.stringify(formato)}.`,
    )
  }
}

/**
 * ⛔ **El tamaño que de verdad se le puede pedir al servicio** (auditoría V3,
 * 2026-08-16). Devuelve el mismo tamaño si cabe, y si no, el mayor que cabe **con
 * la MISMA proporción**.
 *
 * ── Por qué recortar y no rendirse ──────────────────────────────────────────
 * La capa coloca la imagen con `setBounds(bounds)`: se ESTIRA sobre el encuadre,
 * pase lo que pase con su número de píxeles. Así que pedir 4000 px para un lienzo
 * de 5000 no miente en nada geométrico —la cartografía cae exactamente donde
 * tiene que caer, que es lo que importa cuando se está calcando encima—; lo único
 * que baja es la nitidez. Quedarse sin cartografía sería mucho peor, y es lo que
 * hacía de hecho el defecto que esto cierra.
 *
 * ── Por qué la proporción se conserva ───────────────────────────────────────
 * Recortar SOLO el eje que se pasa (5000×3000 → 4000×3000) sí sería deshonesto:
 * al estirar esa imagen sobre un encuadre de otra proporción, la cartografía
 * saldría DEFORMADA, y una imagen deformada sobre la que se calca es un error que
 * se paga en metros. Se escala por el mismo factor en los dos ejes. (Es además lo
 * que hace el propio servicio cuando se le pasa uno: medido el 2026-07-26,
 * `4001×100` devolvió `4000×2000` — recorta un eje y reescala el otro por su
 * cuenta, sin decirlo.)
 *
 * `Math.floor` y no `round`: redondear hacia arriba podría devolver 4001 y volver
 * a lanzar, que es justo lo que no puede pasar. El `Math.max(1, …)` cubre el caso
 * degenerado de un lienzo larguísimo y de 1 px de alto.
 *
 * @param {number} ancho  Ancho del lienzo en píxeles enteros (> 0).
 * @param {number} alto   Alto del lienzo en píxeles enteros (> 0).
 * @returns {{ancho:number, alto:number, recortado:boolean}}
 */
function tamanoAlTecho(ancho, alto) {
  if (ancho <= MAX_PIXELES_WMS && alto <= MAX_PIXELES_WMS) {
    return { ancho, alto, recortado: false }
  }
  const factor = Math.min(MAX_PIXELES_WMS / ancho, MAX_PIXELES_WMS / alto)
  return {
    ancho: Math.max(1, Math.floor(ancho * factor)),
    alto: Math.max(1, Math.floor(alto * factor)),
    recortado: true,
  }
}

// ── La capa: un único L.ImageOverlay gestionado por encuadre ──────────────────

/**
 * Contadores y estado de la capa, para la UI (Fase 3: rótulo "cartografía
 * obsoleta") y para los tests del criterio de aceptación 2.
 *
 * @typedef {Object} EstadoCapaWMS
 * @property {'base'|'overlay'} rol
 * @property {number} peticiones   Peticiones EMITIDAS (= imágenes precargadas).
 * @property {number} aplicadas    Cargas que llegaron a la imagen visible.
 * @property {number} cargadas     Cargas resueltas con éxito (aplicadas o no).
 * @property {number} descartadas  Resoluciones descartadas por el token de secuencia.
 * @property {number} fallidas     Cargas resueltas con error.
 * @property {boolean} hayCartografia  Hay al menos una imagen real visible.
 * @property {boolean} obsoleta    La imagen visible NO es del encuadre actual
 *   (última petición fallida con imagen previa en pantalla).
 */

const CapaWMSCatastro = L.ImageOverlay.extend({
  options: {
    // OJO con la precedencia: `options` del prototipo es la precedencia MÁS BAJA
    // de Leaflet. `crossOrigin` y `attribution` se re-afirman al final de
    // `initialize` con un `L.setOptions` explícito (hallazgo 2.3 de la auditoría
    // de coherencia); aquí están solo como valor de partida. Lo que se declare
    // aquí y no allí es negociable por el llamante.
    // Override O7 / criterio de aceptación 4: SIEMPRE anónimo, para que la
    // imagen no contamine el canvas del informe (F09).
    crossOrigin: 'anonymous',
    // Criterio de aceptación 5: el texto legal viene de viewer/atribucion.js,
    // nunca escrito a mano aquí.
    attribution: ATRIBUCION.CATASTRO,
    alt: 'Cartografía catastral del encuadre actual',
    interactive: false,
  },

  /**
   * @param {object} [opciones]  Ver {@link crearCapaWMSCatastro}.
   */
  initialize(opciones = {}) {
    if (opciones === null || typeof opciones !== 'object') {
      throw new TypeError(
        `crearCapaWMSCatastro: 'opts' debe ser un objeto; recibido ${typeof opciones}.`,
      )
    }
    const {
      rol = 'overlay',
      pane,
      opacidad,
      capas = CAPAS_DEFECTO,
      formato = FORMATO_DEFECTO,
      transparente,
      crs = CRS_MAPA,
      alAvisar,
    } = opciones

    if (rol !== 'base' && rol !== 'overlay') {
      throw new RangeError(
        `crearCapaWMSCatastro: 'rol' debe ser 'base' o 'overlay'; recibido ${JSON.stringify(rol)}.`,
      )
    }
    validarCRS(crs)
    if (crs !== CRS_MAPA) {
      // Camino abierto, no implementado (a propósito). La capa deriva su BBOX de
      // `mapa.getBounds()` proyectando con `L.CRS.EPSG3857.project`, así que solo
      // puede pedir el CRS del mapa. Para otro CRS (F09 necesita `EPSG:25830`
      // para el plano a 300 ppp) la proyección de las esquinas la hace quien
      // corresponda — `geo/utm.js#forward` — y se llama a `getMapUrl`
      // directamente, que es agnóstica de CRS justo para eso.
      //
      // ⚠️ Y como CAMINO DE CONTINGENCIA («si 3857 fallara, pedir 25830 y
      // proyectar las esquinas») es PEOR de lo que se creía. Medido en 2D.1: el
      // desajuste de una imagen 25830 sobre el lienzo 3857 sería de **~7,25 px a
      // CUALQUIER escala** — lo domina la convergencia de meridianos
      // (γ = Δλ·sin φ), que es una ROTACIÓN y por tanto invariante en píxeles, no
      // un error que se disimule al alejarse. A escala de parcela eso son
      // **4,33 m**, muy por encima de la tolerancia catastral urbana de ±0,5 m.
      // O sea: el plan B NO es equivalente al plan A. Quien lo lea no debe
      // tomarlo por un intercambio inocuo. Por suerte 3857 está verificado
      // (hecho (b) de la cabecera) y esta contingencia no hace falta.
      throw new RangeError(
        `crearCapaWMSCatastro: la capa solo sabe proyectar el CRS del mapa (${CRS_MAPA}); ` +
          `recibido ${JSON.stringify(crs)}. Para otro CRS proyecta tú las esquinas ` +
          `(geo/utm.js#forward) y llama a getMapUrl directamente (F09, plano a 300 ppp).`,
      )
    }
    if (opacidad !== undefined) {
      if (typeof opacidad !== 'number' || !Number.isFinite(opacidad)) {
        throw new TypeError(
          `crearCapaWMSCatastro: 'opacidad' debe ser un número; recibido ${typeof opacidad}.`,
        )
      }
      if (opacidad < 0 || opacidad > 1) {
        throw new RangeError(
          `crearCapaWMSCatastro: 'opacidad' debe estar en [0,1]; recibido ${opacidad}.`,
        )
      }
    }
    if (pane !== undefined && (typeof pane !== 'string' || pane.trim() === '')) {
      throw new TypeError(
        `crearCapaWMSCatastro: 'pane' debe ser el nombre de un pane de Leaflet; recibido ` +
          `${JSON.stringify(pane)}.`,
      )
    }

    // Defectos por rol (punto 9 de la cabecera): base opaca vs superpuesta
    // translúcida. Cualquier opción explícita gana sobre el defecto del rol.
    const porRol =
      rol === 'base'
        ? { pane: 'tilePane', opacidad: 1, transparente: false }
        : { pane: 'overlayPane', opacidad: OPACIDAD_SUPERPUESTA, transparente: true }

    this._avisar = resolverAvisar(alAvisar)
    this._rol = rol
    this._crs = crs
    this._capas = validarCapas(capas)
    this._formato = formato
    this._transparente = transparente === undefined ? porRol.transparente : Boolean(transparente)
    validarFormato(formato)

    // Estado de la gestión por encuadre.
    this._secuencia = 0 // contador monótono: token anti-carrera
    this._urlPedida = null // última URL EMITIDA (base de la deduplicación)
    this._urlVisible = null // última URL aplicada a la imagen visible
    this._precarga = null // <img> desprendido en vuelo (si hay)
    this._obsoleta = false
    this._atenuada = false // la imagen visible se muestra como PROVISIONAL
    this._avisadoDelTecho = false // ya se dijo que el lienzo no cabe (una vez, no por encuadre)
    this._temporizadorFundido = null
    this._cuenta = { peticiones: 0, aplicadas: 0, cargadas: 0, descartadas: 0, fallidas: 0 }

    // El overlay nace con el GIF 1×1 y unos bounds degenerados: `onAdd` pone los
    // bounds reales ANTES de que Leaflet posicione la imagen, y la primera
    // imagen real entra por precarga.
    L.ImageOverlay.prototype.initialize.call(this, IMAGEN_VACIA, [
      [0, 0],
      [0, 0],
    ])
    L.setOptions(this, {
      pane: pane === undefined ? porRol.pane : pane,
      opacity: opacidad === undefined ? porRol.opacidad : opacidad,
    })
    // Invariantes NO negociables (misma disciplina que `services/ign.js`, que los
    // pone DESPUÉS del spread de `opts`): se re-afirman AL FINAL, en la
    // precedencia más alta. Hoy `initialize` solo reenvía `{pane, opacity}` y el
    // invariante se sostendría igual por el `options` del prototipo, pero eso es
    // un accidente: en cuanto alguien añada un pass-through de `...resto` —la
    // petición natural de la Fase 3 para `className`/`zIndex`— `crossOrigin` y
    // `attribution` se debilitarían sin que nada avisara. Con esto, no.
    L.setOptions(this, {
      crossOrigin: 'anonymous',
      attribution: ATRIBUCION.CATASTRO,
    })
  },

  /**
   * Eventos del mapa a los que la capa reacciona. Leaflet los registra y los
   * DA DE BAJA solo (`Layer#_layerAdd`), así que no hay `off` que olvidar.
   * `zoom`/`viewreset` los hereda de `ImageOverlay` (reposicionan la imagen
   * actual mientras llega la nueva). Ver decisión 2 de la cabecera: `moveend`
   * sí, `zoomend` NO.
   */
  getEvents() {
    const eventos = L.ImageOverlay.prototype.getEvents.call(this)
    eventos.moveend = this._alCambiarEncuadre
    eventos.resize = this._alCambiarEncuadre
    // `zoomstart` NO pide nada: solo marca la imagen visible como provisional
    // (ver {@link MS_FUNDIDO}). El zoom es el único gesto que la DEFORMA —el pan
    // la desplaza pero la deja a su escala—, y por eso es el único que atenúa:
    // hacerlo también en cada pan sería un parpadeo constante.
    eventos.zoomstart = this._alEmpezarZoom
    return eventos
  },

  onAdd(mapa) {
    // Bounds reales antes de que `ImageOverlay.onAdd` → `_reset()` posicione la
    // imagen (si no, la posicionaría en [[0,0],[0,0]]).
    const encuadre = this._encuadre()
    if (encuadre) this._bounds = encuadre.bounds

    L.ImageOverlay.prototype.onAdd.call(this, mapa)

    // Una petición al añadirse. Si el mapa aún no tuviera vista, Leaflet no
    // habría llamado a `onAdd` todavía (`Map#addLayer` → `whenReady`), así que
    // aquí `getBounds()` siempre es válido.
    this._solicitar()
  },

  onRemove(mapa) {
    // Al salir del mapa, la precarga en vuelo deja de interesar: se desconectan
    // sus handlers y se invalida su token (nada podrá tocar una capa retirada).
    this._cancelarPrecarga()
    // Y el fundido tampoco: un temporizador vivo sobre una capa retirada es
    // exactamente la fuga que `destruir()` existe para no dejar.
    this._cancelarFundido()
    this._atenuada = false
    L.ImageOverlay.prototype.onRemove.call(this, mapa)
  },

  /**
   * El deslizador de opacidad MANDA sobre el fundido: cualquier transición en
   * curso se corta y el valor pedido se aplica al instante. Con la transición
   * puesta, arrastrar el deslizador se sentiría pegajoso — la imagen iría
   * {@link MS_FUNDIDO} ms por detrás del control.
   *
   * @param {number} opacidad
   * @returns {this}
   */
  setOpacity(opacidad) {
    this._cancelarFundido()
    this._atenuada = false
    return L.ImageOverlay.prototype.setOpacity.call(this, opacidad)
  },

  /** @returns {string|null} URL de la imagen VISIBLE (null si no hay ninguna real). */
  urlVisible() {
    return this._urlVisible
  },

  /** @returns {string|null} Última URL EMITIDA (la que dedupe compara). */
  urlPedida() {
    return this._urlPedida
  },

  /** @returns {EstadoCapaWMS} */
  estado() {
    return {
      rol: this._rol,
      ...this._cuenta,
      hayCartografia: this._urlVisible !== null,
      obsoleta: this._obsoleta,
    }
  },

  // ── Interno ────────────────────────────────────────────────────────────────

  _alCambiarEncuadre() {
    const emitida = this._solicitar()
    // Red de seguridad del fundido: si el encuadre NO generó petición (URL
    // deduplicada, o mapa sin superficie visible) no va a llegar ninguna imagen
    // que devuelva la opacidad a su sitio, y la capa se quedaría atenuada para
    // siempre. Pasa de verdad: un zoom que no cambia la URL —o un zoom sobre un
    // mapa recién ocultado— atenúa en `zoomstart` y no pide nada.
    if (!emitida && this._atenuada) this._fundirHasta(this._opacidadDeLaCapa())
  },

  _alEmpezarZoom() {
    // La escala está a punto de cambiar: lo que se ve pasa a ser provisional.
    this._fundirHasta(this._opacidadDeLaCapa() * FRACCION_PROVISIONAL)
    this._atenuada = true
  },

  // ── Fundido (solo presentación; ver {@link MS_FUNDIDO}) ────────────────────

  /** Opacidad que la capa debe tener cuando su imagen es la del encuadre actual. */
  _opacidadDeLaCapa() {
    const declarada = this.options.opacity
    return typeof declarada === 'number' && Number.isFinite(declarada) ? declarada : 1
  },

  /** Corta cualquier transición en curso y deja el elemento sin `transition`. */
  _cancelarFundido() {
    if (this._temporizadorFundido !== null) {
      clearTimeout(this._temporizadorFundido)
      this._temporizadorFundido = null
    }
    if (this._image) this._image.style.transition = ''
  },

  /**
   * Lleva la opacidad de la imagen visible a `destino` con una transición CSS.
   * Es SOLO presentación: no toca el estado de la capa ni su `options.opacity`,
   * así que `setOpacity` y `estado()` siguen diciendo la verdad durante el
   * fundido.
   *
   * @param {number} destino
   */
  _fundirHasta(destino) {
    if (!this._image) return
    this._cancelarFundido()
    this._image.style.transition = `opacity ${MS_FUNDIDO}ms linear`
    this._image.style.opacity = String(destino)
    // Se limpia la `transition` al acabar para no dejarla puesta: si se quedara,
    // el siguiente `setOpacity` del deslizador se animaría (ver `setOpacity`).
    this._temporizadorFundido = setTimeout(() => {
      this._temporizadorFundido = null
      if (this._image) this._image.style.transition = ''
    }, MS_FUNDIDO + 20)
  },

  /**
   * Fundido de ENTRADA de una imagen recién aplicada: arranca en la fracción
   * provisional y sube a la opacidad de la capa.
   *
   * El punto de partida se fija con `transition:none` y se fuerza una lectura de
   * layout entre los dos cambios de estilo. Sin esa lectura el navegador funde
   * ambos en un solo recálculo y **la transición no arranca**: no habría estado
   * inicial que animar y el cambio volvería a ser seco, que es justo el defecto
   * que esto corrige.
   */
  _fundirEntrada() {
    if (!this._image) return
    const objetivo = this._opacidadDeLaCapa()
    this._cancelarFundido()
    this._image.style.transition = 'none'
    this._image.style.opacity = String(objetivo * FRACCION_PROVISIONAL)
    void this._image.offsetWidth
    this._fundirHasta(objetivo)
    this._atenuada = false
  },

  /**
   * Encuadre actual del mapa → BBOX en metros Web Mercator + tamaño en píxeles.
   * `null` si el mapa no tiene superficie visible (contenedor 0×0, p. ej. un
   * panel oculto) o si el encuadre degenera: no hay nada que pedir, y no es un
   * error que contar al usuario.
   *
   * El `tamano` que devuelve es el **pedible**, no el del lienzo: por encima del
   * techo del servicio va recortado ({@link tamanoAlTecho}). Los dos viajan, y el
   * del lienzo con ellos, porque quien avisa necesita las tres cifras.
   *
   * @returns {{bounds: import('leaflet').LatLngBounds, bbox: BBoxProyectado,
   *   tamano: TamanoImagen, lienzo: TamanoImagen, recortado: boolean}|null}
   */
  _encuadre() {
    const mapa = this._map
    if (!mapa || mapa.getZoom() === undefined) return null

    const tam = mapa.getSize()
    const ancho = Math.round(tam.x)
    const alto = Math.round(tam.y)
    if (!(ancho > 0) || !(alto > 0)) return null
    const pedible = tamanoAlTecho(ancho, alto)

    const bounds = mapa.getBounds()

    // ── ⭐ EL SUELO DE ESCALA (2026-08-18) ────────────────────────────────────
    //
    // ⛔ **EL DEFECTO, MEDIDO POR EL GUION 22 EL 2026-08-18:** con la aplicación
    // recién abierta —que desde el 2026-08-07 arranca mirando a España entera— esta
    // capa pedía un `GetMap` con un BBOX de **2.172 × 1.641 km**. En cada apertura,
    // a un servicio de una administración pública, para una imagen en la que no se
    // distingue ni una parcela. No rompía nada, y por eso llevaba un año sin que
    // nadie lo mirara: los fallos que no rompen nada son los que más duran.
    //
    // ── EL CRITERIO, Y POR QUÉ NO ES UN ZOOM ────────────────────────────────
    // Un número de zoom mentiría: los metros que cubre un píxel dependen de la
    // LATITUD (en Web Mercator, del `cos` de la latitud), así que el mismo zoom es
    // una escala distinta en Canarias y en Gerona. Se pregunta lo que de verdad
    // importa —**cuánto suelo cubre un píxel**— y se le pregunta a Leaflet, que lo
    // sabe exacto.
    //
    // ⚠️ **La distancia se saca de `mapa.distance` y NO del BBOX de 3857**, aunque
    // el BBOX ya esté aquí abajo y fuera gratis. En Web Mercator el metro está
    // inflado por 1/cos(latitud) —a 40° un 30 % de más—, así que dividir el BBOX
    // entre los píxeles daría una escala optimista y el suelo se aplicaría torcido,
    // y más torcido cuanto más al norte. `distance` devuelve metros de los de
    // andar.
    const anchoRealM = mapa.distance(bounds.getSouthWest(), bounds.getSouthEast())
    if (anchoRealM / ancho > METROS_POR_PIXEL_MAXIMO) return null
    // Proyección de las DOS esquinas del encuadre a metros Web Mercator. En 3857
    // el orden es X,Y y NO se invierte nada (dossier §2.5).
    const so = L.CRS.EPSG3857.project(bounds.getSouthWest())
    const ne = L.CRS.EPSG3857.project(bounds.getNorthEast())
    const bbox = {
      minX: Math.min(so.x, ne.x),
      minY: Math.min(so.y, ne.y),
      maxX: Math.max(so.x, ne.x),
      maxY: Math.max(so.y, ne.y),
    }
    if (!(bbox.maxX > bbox.minX) || !(bbox.maxY > bbox.minY)) return null

    return {
      bounds,
      bbox,
      tamano: { ancho: pedible.ancho, alto: pedible.alto },
      lienzo: { ancho, alto },
      recortado: pedible.recortado,
    }
  },

  /**
   * UNA petición por encuadre: calcula la URL, deduplica y precarga.
   *
   * ⛔ **Nunca lanza, y eso es una obligación, no una descripción**: esto corre
   * dentro del `fire()` de Leaflet (`moveend`, `resize`, `onAdd`), donde una
   * excepción se lleva por delante a los demás oyentes, deja la capa muda para
   * siempre y no pasa por `alAvisar` — el error silencioso más caro del módulo.
   * Estuvo rota hasta la auditoría V3 (2026-08-16): le pasaba a `getMapUrl` el
   * tamaño del lienzo sin guarda y un monitor de más de 4000 px la reventaba en
   * cada encuadre.
   *
   * La promesa se sostiene sobre lo que `getMapUrl` puede rechazar, y está TODO
   * cubierto aguas arriba: el `crs`, las `capas` y el `formato` se validan en el
   * `initialize` (una capa mal construida no llega a existir); el BBOX degenerado
   * o no finito lo descarta `_encuadre` devolviendo `null`; un lienzo de 0 px,
   * también; y el techo de {@link MAX_PIXELES_WMS} lo respeta {@link
   * tamanoAlTecho}. Quien añada una opción nueva a `getMapUrl` tiene que volver a
   * mirar esta lista.
   *
   * @returns {boolean} `true` si se EMITIÓ una petición nueva. Lo consume la red
   *   de seguridad del fundido en `_alCambiarEncuadre`: un encuadre que no pide
   *   nada tampoco va a recibir nada que restaure la opacidad.
   */
  _solicitar() {
    if (!this._map) return false
    const encuadre = this._encuadre()
    if (!encuadre) return false

    // El lienzo no cabe en el servicio: se pide recortado (misma proporción, mismo
    // encuadre) y se DICE. Una sola vez por episodio y no en cada `moveend`: un
    // mapa grande dispara decenas de encuadres y repetirlo enterraría los avisos
    // que sí piden algo del usuario. La bandera se rearma cuando el lienzo vuelve
    // a caber, para que un segundo episodio —redimensionar la ventana— se cuente.
    if (!encuadre.recortado) this._avisadoDelTecho = false
    else if (!this._avisadoDelTecho) {
      this._avisadoDelTecho = true
      this._avisar(MENSAJES.LIENZO_SOBRE_EL_TECHO, {
        nivel: NIVEL.AVISO,
        lienzo: encuadre.lienzo,
        pedido: encuadre.tamano,
        techo: MAX_PIXELES_WMS,
      })
    }

    const url = getMapUrl(encuadre.bbox, encuadre.tamano, {
      crs: this._crs,
      capas: this._capas,
      formato: this._formato,
      transparente: this._transparente,
    })

    // Deduplicación (decisión 3): mismo encuadre ⇒ 0 peticiones.
    if (url === this._urlPedida) return false
    this._urlPedida = url

    const secuencia = ++this._secuencia
    this._cuenta.peticiones++

    const img = new Image()
    // ORDEN OBLIGATORIO (dossier §4.4): crossOrigin ANTES de src, o la imagen
    // contamina el canvas del informe aunque el servidor emita ACAO.
    img.crossOrigin = 'anonymous'
    img.onload = () => this._alCargar(secuencia, url, encuadre.bounds)
    img.onerror = (evento) => this._alFallar(secuencia, evento)
    img.src = url
    this._precarga = img
    return true
  },

  /**
   * @param {number} secuencia
   * @param {string} url
   * @param {import('leaflet').LatLngBounds} bounds
   */
  _alCargar(secuencia, url, bounds) {
    this._cuenta.cargadas++
    // Token anti-carrera (decisión 4): una respuesta de un encuadre ya superado
    // se descarta para la imagen, pero SÍ se contabiliza.
    if (secuencia !== this._secuencia || !this._map) {
      this._cuenta.descartadas++
      return
    }
    this._precarga = null
    // La imagen ya está en la caché del navegador: `setUrl` la intercambia sin
    // una segunda petición de red y sin dejar el hueco en blanco (decisión 5).
    this.setBounds(bounds)
    this.setUrl(url)
    this._urlVisible = url
    this._obsoleta = false
    this._cuenta.aplicadas++
    // El estado ya está aplicado ARRIBA, a propósito: el fundido es lo último y
    // solo toca `style`. Así `urlVisible()` y `estado()` son ciertos desde el
    // instante de la carga, pase lo que pase con la animación.
    this._fundirEntrada()
  },

  /**
   * @param {number} secuencia
   * @param {*} causa  El evento `error` de la imagen (no lleva detalle útil por
   *   diseño del navegador; se pasa igual como `causa` para la consola).
   */
  _alFallar(secuencia, causa) {
    this._cuenta.fallidas++
    // Fallo de una petición ya superada: se cuenta y se calla (ver decisión 6).
    if (secuencia !== this._secuencia || !this._map) {
      this._cuenta.descartadas++
      return
    }
    this._precarga = null
    // Se libera la deduplicación para que el MISMO encuadre pueda reintentarse
    // en el próximo `moveend`/`resize`: si no, una URL fallida quedaría vetada
    // para siempre y el usuario no podría recuperar la cartografía sin recargar.
    this._urlPedida = null
    // Y la opacidad vuelve a su sitio: lo que se ve es la cartografía anterior,
    // que se queda ahí. Dejarla atenuada indefinidamente sería un segundo
    // síntoma del mismo fallo, y el aviso de «obsoleta» ya lo cuenta con
    // palabras (decisión 6) en vez de con un color que hay que adivinar.
    if (this._atenuada) this._fundirHasta(this._opacidadDeLaCapa())
    this._atenuada = false

    // NIVEL.AVISO, no ERROR (hallazgo 2.5 de la auditoría de coherencia): esto es
    // cartografía DE FONDO que falla por red, exactamente el mismo suceso que un
    // `tileerror` del IGN — y `validation/_comun.js#NIVEL` fija que ERROR es lo
    // que BLOQUEA la generación del GML. Un fondo que no carga no bloquea nada:
    // la geometría del usuario está en el modelo, no en la imagen. La regla
    // completa está escrita junto al typedef `Avisar` de `viewer/_comun.js`.
    if (this._urlVisible !== null) {
      this._obsoleta = true
      this._avisar(MENSAJES.OBSOLETA, { nivel: NIVEL.AVISO, causa })
    } else {
      this._avisar(MENSAJES.SIN_CARTOGRAFIA, { nivel: NIVEL.AVISO, causa })
    }
  },

  _cancelarPrecarga() {
    this._secuencia++ // invalida cualquier resolución pendiente
    if (this._precarga) {
      this._precarga.onload = null
      this._precarga.onerror = null
      this._precarga = null
    }
    // La deduplicación vuelve a "lo que de verdad se ve": si la capa se retira
    // con una petición en vuelo y luego se vuelve a añadir al mismo encuadre, la
    // petición abortada NO debe quedar deduplicada (o el encuadre nunca cargaría);
    // y si lo visible ya era correcto, el re-añadido sigue costando 0 peticiones.
    this._urlPedida = this._urlVisible
  },
})

/**
 * Crea la capa de cartografía catastral por encuadre: UN `L.ImageOverlay`
 * gestionado, UNA petición `GetMap` por encuadre (criterio de aceptación 2 de
 * F03). Se añade con `mapa.addLayer(capa)` o `capa.addTo(mapa)`.
 *
 * La misma factory sirve para los dos usos de la spec (punto 9 de la cabecera):
 *
 * ```js
 * const base = crearCapaWMSCatastro({ rol: 'base', alAvisar })          // opaca, tilePane
 * const encima = crearCapaWMSCatastro({ rol: 'overlay', alAvisar })     // translúcida, overlayPane
 * encima.setOpacity(0.35)   // la Fase 3 cablea aquí un <input type="range">
 * ```
 *
 * @param {object} [opts]
 * @param {'base'|'overlay'} [opts.rol='overlay']  Fija los defectos de `pane`,
 *   `opacidad` y `transparente` del doble uso. Cualquier opción explícita gana.
 * @param {string} [opts.pane]           Pane de Leaflet (defecto por rol:
 *   `'tilePane'` para base, `'overlayPane'` para superpuesta).
 * @param {number} [opts.opacidad]       Opacidad inicial en [0,1] (defecto por
 *   rol: 1 / {@link OPACIDAD_SUPERPUESTA}). Regulable después con `setOpacity`.
 * @param {string[]} [opts.capas=CAPAS_DEFECTO]  Capas del WMS.
 * @param {string} [opts.formato='image/png']    `FORMAT` del GetMap.
 * @param {boolean} [opts.transparente]  `TRANSPARENT` (defecto por rol:
 *   `false` para base, `true` para superpuesta).
 * @param {string} [opts.crs='EPSG:3857']  Solo el CRS del mapa; ver la nota de
 *   `initialize` (para otro CRS, `getMapUrl` directamente).
 * @param {import('./_comun.js').Avisar} [opts.alAvisar]  Canal de aviso (regla
 *   de oro 1). Si no se pasa, `avisoPorDefecto` de `viewer/_comun.js`.
 * @returns {import('leaflet').ImageOverlay & {
 *   urlVisible: () => (string|null),
 *   urlPedida: () => (string|null),
 *   estado: () => EstadoCapaWMS,
 * }}
 * @throws {TypeError|RangeError}  Opciones inválidas (contrato del programador).
 */
export function crearCapaWMSCatastro(opts = {}) {
  return new CapaWMSCatastro(opts)
}
