// report/canvas.js — F09 · T3.1 · La COMPOSICIÓN DEL PLANO del informe a 300 ppp.
// **Contrato B** del plan de F09: consume el `Encuadre` de `report/encuadre.js`
// (T2.1) y produce los bytes JPEG que `report/pdf-parcela.js` (T3.2) pega en la
// página con `report/pdf.js#imagenJpeg`.
//
// Es la **Receta A** del dossier (§4.4) y de la spec: una `GetMap` al WMS del
// Catastro AL TAMAÑO EXACTO de salida —el servidor rasteriza a la resolución que
// se le pida, así que la cartografía sale nítida a 300 ppp sin ampliar teselas de
// 256 px— y el vector dibujado encima con el mismo mapeo UTM→px.
//
// **Nunca html2canvas** (regla de oro 7 de la spec): sobre el div de Leaflet
// produce el polígono flotando en un rectángulo gris, porque una sola imagen sin
// CORS contamina TODO el lienzo. Ese es el fallo visible del competidor y el
// motivo de que este módulo exista.
//
// ── ⚠️ EL HALLAZGO QUE DEFINE ESTE MÓDULO: EL WMS NO RECORTA, SUSTITUYE ──────
// MEDIDO contra el servicio real el 2026-08-02 (T0.1 de F09): pedidos `4200×100`
// y `5000×100`, el WMS del Catastro devolvió las dos veces **`4000×2000`** —
// ignorando AMBAS dimensiones y plantando un tamaño suyo—, con **HTTP 200** y sin
// una palabra de aviso. `4000×100` y `2126×1535` sí se sirven exactos.
//
// Por eso, **después del `load` se comparan `naturalWidth`/`naturalHeight` con lo
// que se pidió, y si no cuadran NO se dibuja**. Es el requisito número uno de este
// módulo, no una comprobación de cortesía:
//
//   · El `load` dispara igual. Una imagen sustituida es una imagen VÁLIDA: carga,
//     se decodifica y se dibuja tan campante.
//   · Estirada sobre el lienzo, deja toda la geometría descolocada **con la escala
//     correctamente rotulada al pie**, que es la peor combinación posible en un
//     documento firmable: el error no se ve, y lo que se ve dice que no lo hay.
//   · No hay excepción que capturar ni código de estado que mirar. Solo esta
//     comparación (regla de oro 1: ningún error silencioso).
//
// Y por eso `ctx.drawImage` se llama SIEMPRE con **tres argumentos** (imagen, x,
// y) y nunca con los cinco que aceptan un ancho y un alto de destino: la forma de
// cinco argumentos ESCALA la imagen hasta encajar, o sea que taparía exactamente
// el fallo que la comparación acaba de destapar.
//
// `report/pdf.js#imagenJpeg` hace la defensa simétrica al otro extremo,
// contrastando el `anchoPx`/`altoPx` declarado contra el `SOF` real del JPEG. Que
// haya dos redes no es redundancia: son dos sitios DISTINTOS por donde el mismo
// error entraría (aquí, el servicio; allí, el llamante).
//
// ── LA SEGUNDA SUSTITUCIÓN SILENCIOSA: `toDataURL` ──────────────────────────
// `HTMLCanvasElement.toDataURL(tipo, calidad)` **cae a PNG sin avisar** si el tipo
// pedido no está soportado (así lo manda la especificación HTML: «si el tipo no se
// soporta, se usa `image/png`»). Devolvería un data URL perfectamente válido cuyos
// bytes NO son un JPEG, y `imagenJpeg` los pegaría tras un filtro `/DCTDecode` que
// no sabe descomprimir PNG. Así que aquí se comprueba el prefijo
// `data:image/jpeg;base64,` antes de decodificar, y si no está, se lanza.
//
// ── POR QUÉ `toDataURL` Y NO `toBlob` ───────────────────────────────────────
// Los dos sirven. Se elige `toDataURL` por dos razones, y ninguna es la comodidad:
//   1. **Cómo fallan.** Con el lienzo contaminado, `toDataURL` lanza `SecurityError`
//      —un fallo que se ve y se puede explicar— mientras que `toBlob` entrega
//      `null` al callback, mudo, y el llamante se queda con un «no hay bytes» sin
//      causa. Entre una excepción con nombre y un `null`, la regla de oro 1 no deja
//      elegir.
//   2. **`toBlob` no ahorra el salto asíncrono que parece ahorrar**: devuelve un
//      `Blob`, y para llegar a los `Uint8Array` que el PDF necesita hay que esperar
//      además a `blob.arrayBuffer()`. `toDataURL` da el resultado en la misma
//      vuelta y solo cuesta un `atob` y un bucle.
// El peaje es el 33 % de sobrecoste del base64 en una cadena intermedia (~360 kB
// para el JPEG de 272 kB medido en T0.1), que vive lo que tarda el bucle.
//
// ── TODAS LAS DEPENDENCIAS DE NAVEGADOR SE INYECTAN ─────────────────────────
// `crearCanvas`, `CrearImagen` y `urlDeMapa` entran por parámetro, con valores por
// defecto de producción. **No es purismo: es la única forma de probar esto.** jsdom
// NO implementa el contexto 2D (`canvas.getContext('2d')` devuelve `null` sin el
// paquete `canvas`, que no está instalado y no se va a instalar), así que sin la
// costura no habría ni un test de dibujo. El mismo criterio por el que
// `report/pdf.js` recibe la fecha en vez de leer el reloj.
//
// **Consecuencia declarada:** el criterio de aceptación 1 de la spec —el lienzo
// compuesto exporta con `toDataURL` sin `SecurityError`, con control negativo
// TAINTED— **NO se puede medir en este proyecto de tests**. Se mide en el guion de
// navegador `11` (T6.2), contra el servicio real. Está escrito también en la
// cabecera de `test/report/canvas.dom.test.js`.
//
// ── EL COLOR: EL AMARILLO DEL VISOR NO VALE AQUÍ, Y ESTÁ MIRADO ─────────────
// `viewer/_comun.js#COLOR_USUARIO` es `#FFD600` y su propio JSDoc lo dice: ese
// valor es para el MAPA, sobre imagen aérea, y **no sirve sobre fondo blanco**
// (~1,4:1 de contraste). El plano del informe no va sobre ortofoto: va sobre la
// cartografía catastral del WMS, que es casi blanca (fondo claro, líneas rojas de
// parcelario, azul de hidrografía, rótulos negros). Un lindero amarillo ahí no se
// ve; y encima el informe se imprime, donde un trazo que no se ve no se puede ni
// levantar a contraluz.
//
// Decisión, y no se inventa un color nuevo: el **trazo, los vértices y los rótulos
// del usuario van en `#A16207`**, que es exactamente el ámbar oscuro que
// `estilos/app.css` ya tiene declarado como `--gml-color-usuario-sobre-claro`
// («~5,0:1 sobre fondo claro») para el nº de vértice de la tabla. Se lee como «el
// color de la geometría del usuario» y sobrevive a una impresora. **El RELLENO sí
// conserva el `#FFD600`**, al 18 % de alfa: un lavado de color no compite con las
// líneas rojas del parcelario y ata visualmente el plano con lo que se ve en
// pantalla. Es la misma dualidad —mismo color, dos valores según el fondo— que la
// hoja de estilos documenta desde la fase 5 de F03, aplicada al papel.
//
// El resto del cromo es neutro a propósito: la geometría OFICIAL en el gris
// `#6B7280` de `viewer/sincronizacion.js` (es la referencia, no lo editable) y los
// textos en gris muy oscuro. **Ni un color de mérito en ninguna parte** (regla de
// oro 9): en este plano no hay nada verde que diga «bien» ni nada rojo que diga
// «mal». Las cifras se leen; no se puntúan.
//
// ── LA BARRA DE ESCALA USA `sx`, Y NO SE RECALCULA ──────────────────────────
// `barra_px = N · encuadre.sx`. El `sx` viene hecho del encuadre y **no se
// promedia con `sy`**: la cabecera de `report/encuadre.js` explica por qué el WMS
// estira el BBOX con una escala independiente por eje y por qué forzar una sola
// separaría el vector de la imagen sobre la que se dibuja. Aquí solo se consume.
//
// ── LA FLECHA DE NORTE ES DE CUADRÍCULA ─────────────────────────────────────
// En UTM el norte de cuadrícula es el eje +Y, así que la flecha es VERTICAL y no
// hay nada que calcular. Pero el Norte geográfico está girado respecto a él la
// CONVERGENCIA DE MERIDIANOS, que en el borde del huso, en el norte peninsular,
// **pasa de 2°** (`geo/utm.js#convergencia` la calcula; `geo/rumbo.js` lleva la
// misma advertencia por escrito y explica por qué tampoco la aplica). Un plano que
// dibuja una flecha y la rotula «N» a secas está afirmando algo que no ha medido.
// Por eso la flecha se rotula con {@link TEXTO_NORTE} —«Norte de cuadrícula»—
// DIBUJADO en el plano, no solo comentado en el código: quien firme el documento
// tiene que poder leerlo en el papel.
//
// ── UNA CAPA QUE NO SIRVE SE APAGA Y SE DICE ────────────────────────────────
// Ruta normal (la medida): UNA `GetMap` por tesela con todas las capas juntas, en
// JPEG. Si esa petición falla, se hace un SONDEO capa a capa (en PNG con
// `TRANSPARENT=TRUE`, que es lo que permite superponerlas: el JPEG no tiene canal
// alfa y cada capa taparía a la anterior), se dibujan las que sirven y las que no
// caen a `capasCaidas` con su motivo. A partir de ahí la lista depurada sigue
// pidiéndose junta, así que el sondeo se paga una vez, no en cada tesela.
//
// **Un tamaño sustituido NO dispara el sondeo**, y es deliberado: no es culpa de
// ninguna capa —el servicio ignora `WIDTH`/`HEIGHT`, no `LAYERS`—, así que repetir
// la petición capa a capa devolvería el mismo tamaño equivocado N veces y además
// señalaría a un culpable falso. Esa tesela cae entera, a `teselasCaidas`, con el
// tamaño pedido y el recibido escritos en el motivo.
//
// El plano sale sin la capa que falte, nunca mal: el lienzo se pinta de BLANCO
// antes de nada (un lienzo transparente codificado a JPEG sale NEGRO, porque el
// JPEG no tiene alfa) y el vector se dibuja igual. Un plano sin cartografía de
// fondo es un plano pobre pero honrado; uno con la geometría descolocada, no.
//
// ── ESTE MÓDULO NO SALE POR EL BARREL RAÍZ ──────────────────────────────────
// Toca `document`, `Image` y `<canvas>`, y el barrel (`index.js`) lo carga el
// proyecto Vitest `node`, sin DOM: un `export * from './report/canvas.js'` rompería
// al CARGAR el barrel y se llevaría por delante la suite entera. Mismo criterio que
// `viewer/`, `services/`, `app/` y `gml/descargar.js`. Hay un test-guardián en
// `test/contrato.test.js`. Su test vive en `test/report/canvas.dom.test.js`
// (sufijo `.dom.test.js`, proyecto `dom`).

import { longitudesDeLados } from '../geo/metrica.js'
import { textoDeLongitud } from '../viewer/acotaciones.js'
import { atribucionCombinada } from '../viewer/atribucion.js'
import { COLOR_USUARIO, NIVEL, resolverAvisar } from '../viewer/_comun.js'
import { CAPAS_DEFECTO, getMapUrl } from '../viewer/wms-catastro.js'

// ── Constantes ───────────────────────────────────────────────────────────────

/**
 * Calidad del JPEG de salida. 0,92 es el valor de la Receta A (dossier §4.4): por
 * encima el fichero crece deprisa sin ganancia visible en cartografía de líneas, y
 * por debajo aparecen anillos alrededor de los rótulos del WMS.
 */
export const CALIDAD_JPEG = 0.92

/**
 * SRS por defecto del plano. **MEDIDO el 2026-08-02**: el WMS del Catastro sirve
 * `EPSG:25830` y a `2126×1535` devuelve exactamente eso, HTTP 200, `image/jpeg`,
 * `Access-Control-Allow-Origin: *` y un JPEG de 3 componentes (YCbCr).
 *
 * Pedirlo en el SRS de la geometría —y no en `EPSG:3857`, que es el del visor—
 * evita reproyectar el vector: el mapeo UTM→px del encuadre vale tal cual.
 */
export const SRS_PLANO = 'EPSG:25830'

/** Formato de la petición normal (una sola `GetMap` con todas las capas). */
export const FORMATO_PLANO = 'image/jpeg'

/**
 * Formato del SONDEO capa a capa. PNG **con transparencia**, y no JPEG: cuando las
 * capas se piden por separado hay que superponerlas en el lienzo, y el JPEG no
 * tiene canal alfa (cada capa taparía entera a la anterior).
 */
export const FORMATO_SONDEO = 'image/png'

/** Claves de `viewer/atribucion.js#ATRIBUCION` que corresponden al fondo del plano. */
export const CLAVES_ATRIBUCION_DEFECTO = Object.freeze(['CATASTRO'])

/**
 * Lo que se rotula bajo la flecha, **en el plano**. Ver la cabecera: en UTM la
 * flecha apunta a +Y, que es el Norte de CUADRÍCULA, y el geográfico está girado
 * la convergencia de meridianos (>2° en el borde del huso). Rotularla «N» a secas
 * afirmaría algo que no se ha medido.
 */
export const TEXTO_NORTE = 'Norte de cuadrícula'

/** Letra del plano. Helvetica es también la del PDF (`report/pdf.js`, métricas AFM). */
export const FUENTE_PLANO = 'Helvetica, Arial, sans-serif'

/**
 * Alfa del relleno de la parcela, en hexadecimal de dos dígitos (`#RRGGBBAA`).
 * `0x2E` = 46/255 ≈ 18 %: se ve como un lavado de color sobre la cartografía clara
 * sin competir con las líneas rojas del parcelario que hay debajo.
 */
const ALFA_RELLENO = '2E'

/**
 * Colores del plano. Ver la cabecera para el porqué de que el trazo del usuario NO
 * sea el amarillo del visor. Se exportan para que T3.2 y los tests miren aquí en
 * vez de escribir literales.
 */
export const COLORES_PLANO = Object.freeze({
  /** Fondo del lienzo. Obligatorio pintarlo: un lienzo transparente sale NEGRO en JPEG. */
  FONDO: '#FFFFFF',
  /** Trazo, vértices y rótulos del usuario: `--gml-color-usuario-sobre-claro`. */
  USUARIO: '#A16207',
  /** Relleno de la parcela: el `#FFD600` del visor, al 18 %. */
  USUARIO_RELLENO: `${COLOR_USUARIO}${ALFA_RELLENO}`,
  /** Geometría oficial del Catastro: el gris de `viewer/sincronizacion.js` (la referencia). */
  OFICIAL: '#6B7280',
  /** Texto del cromo (escala, norte). */
  TEXTO: '#1F2937',
  /** Halo bajo los rótulos, para que se lean sobre la cartografía. */
  HALO: '#FFFFFF',
  /** Fondo translúcido del cartucho de escala y del de norte. */
  CARTUCHO: 'rgba(255,255,255,0.82)',
  /** Filete del cartucho. */
  CARTUCHO_BORDE: '#6B7280',
})

/**
 * Medidas del dibujo **en MILÍMETROS DE PAPEL**, no en píxeles.
 *
 * Es la única forma de que el plano se vea igual a 300 y a 600 ppp: a 300 ppp un
 * trazo de 1 px son 0,085 mm —invisible al imprimir— y a 600 ppp, la mitad. Los
 * tamaños de letra siguen la escala de la rotulación técnica (ISO 3098: 2,5 mm es
 * la altura normal de una cota).
 */
export const MEDIDAS_MM = Object.freeze({
  /** Trazo del lindero del usuario. */
  TRAZO_PARCELA: 0.5,
  /** Trazo de la geometría oficial (más fino: es la referencia). */
  TRAZO_OFICIAL: 0.25,
  /** Patrón de raya de la geometría oficial (`setLineDash`). */
  RAYA_OFICIAL: Object.freeze([1.5, 1]),
  /** Lado del cuadradito de vértice. */
  LADO_VERTICE: 1.2,
  /** Altura de letra de las cotas. */
  TEXTO_COTA: 2.5,
  /** Altura de letra del número de vértice. */
  TEXTO_VERTICE: 2,
  /** Altura de letra del rótulo de la barra de escala. */
  TEXTO_ESCALA: 2.5,
  /** Altura de letra del rótulo de norte. */
  TEXTO_NORTE: 2,
  /** Grosor del halo blanco bajo los rótulos. */
  HALO: 0.6,
  /** Aire entre el cromo (escala, norte) y el borde del plano. */
  MARGEN_CROMO: 5,
  /** Altura de la barra de escala. */
  ALTO_BARRA: 1.6,
  /** Longitud del asta de la flecha de norte. */
  FLECHA_NORTE: 12,
  /**
   * Lados más cortos que esto (**en el papel**) no se acotan: el rótulo mediría
   * más que el lado y se solaparía con sus vecinos. Es el mismo criterio del
   * filtro por píxeles de `viewer/acotaciones.js`, trasladado al papel.
   */
  COTA_MINIMA: 10,
})

/** Fracción del ancho del plano que puede ocupar, como mucho, la barra de escala. */
const FRACCION_BARRA = 0.25

// ── Guardas de contrato ──────────────────────────────────────────────────────
//
// Mismo criterio que `report/encuadre.js` y `geo/bbox.js`: aquí no hay dato de
// usuario que avisar, hay un bug del programador que tiene que verse.
//   · `TypeError`  → el TIPO no es el pactado.
//   · `RangeError` → el tipo es correcto pero el VALOR no puede serlo.
// Lo que SÍ es dato (un anillo degenerado, una capa que el servicio no sirve) no
// lanza: se avisa por `alAvisar` y se sigue.

/** Cómo nombrar lo que ha llegado cuando no es lo pactado (`typeof null` no vale). */
const describir = (v) => (v === null ? 'null' : Array.isArray(v) ? `un array de ${v.length}` : typeof v)

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Comprueba que lo recibido es un {@link Encuadre} de `report/encuadre.js`.
 *
 * @param {*} encuadre
 * @throws {TypeError|RangeError}
 */
function exigirEncuadre(encuadre) {
  if (!esObjeto(encuadre)) {
    throw new TypeError(
      `componerPlano: 'encuadre' debe ser el objeto que devuelve report/encuadre.js#encuadrar; ` +
        `recibido ${describir(encuadre)}.`,
    )
  }
  for (const clave of ['anchoPx', 'altoPx', 'sx', 'sy']) {
    if (typeof encuadre[clave] !== 'number' || !Number.isFinite(encuadre[clave])) {
      throw new TypeError(
        `componerPlano: 'encuadre.${clave}' debe ser un número finito; recibido ` +
          `${describir(encuadre[clave])}. ¿Se ha construido el encuadre a mano en vez de con ` +
          'report/encuadre.js#encuadrar?',
      )
    }
  }
  if (typeof encuadre.toPx !== 'function') {
    throw new TypeError(
      "componerPlano: 'encuadre.toPx' debe ser la función UTM→px del encuadre; recibido " +
        `${describir(encuadre.toPx)}.`,
    )
  }
  if (!Array.isArray(encuadre.teselas) || encuadre.teselas.length === 0) {
    throw new TypeError(
      "componerPlano: 'encuadre.teselas' debe ser un array NO vacío (encuadrar devuelve una " +
        `tesela cuando el plano cabe en una GetMap); recibido ${describir(encuadre.teselas)}.`,
    )
  }
  for (const clave of ['anchoPx', 'altoPx']) {
    if (!Number.isInteger(encuadre[clave]) || encuadre[clave] < 1) {
      throw new RangeError(
        `componerPlano: 'encuadre.${clave}' debe ser un entero ≥ 1 de píxeles; recibido ` +
          `${encuadre[clave]}.`,
      )
    }
  }
  // `anchoMm` es del contrato A y aquí NO es decorativo: es el divisor con el que
  // todo el cromo del plano pasa de milímetros de papel a píxeles (ver MEDIDAS_MM).
  // Sin él habría que suponer una resolución, y un plano con el trazo de otra
  // resolución es un plano mal rotulado.
  if (typeof encuadre.anchoMm !== 'number' || !(encuadre.anchoMm > 0)) {
    throw new TypeError(
      `componerPlano: 'encuadre.anchoMm' debe ser el ancho del plano en milímetros (> 0); ` +
        `recibido ${describir(encuadre.anchoMm)} (${encuadre.anchoMm}). Es de donde sale la ` +
        'conversión mm de papel → px con la que se dibuja todo el cromo.',
    )
  }
}

/**
 * @param {*} recintos
 * @param {string} nombre
 * @throws {TypeError}
 */
function exigirRecintos(recintos, nombre) {
  if (!Array.isArray(recintos)) {
    throw new TypeError(
      `componerPlano: '${nombre}' debe ser un array de recintos {vertices, tipo} (la forma de ` +
        `model/parcela.js); recibido ${describir(recintos)}.`,
    )
  }
  for (let i = 0; i < recintos.length; i++) {
    if (!esObjeto(recintos[i]) || !Array.isArray(recintos[i].vertices)) {
      throw new TypeError(
        `componerPlano: '${nombre}[${i}]' debe ser {vertices: [[x,y], …]}; recibido ` +
          `${describir(recintos[i])}.`,
      )
    }
  }
}

/**
 * @param {*} capas
 * @returns {string[]}  Copia defensiva.
 * @throws {TypeError}
 */
function exigirCapas(capas) {
  if (!Array.isArray(capas) || capas.length === 0) {
    throw new TypeError(
      `componerPlano: 'capas' debe ser un array NO vacío de nombres de capa del WMS; recibido ` +
        `${describir(capas)}.`,
    )
  }
  for (const capa of capas) {
    if (typeof capa !== 'string' || capa.trim() === '') {
      throw new TypeError(
        `componerPlano: cada capa debe ser un string no vacío; recibido ${JSON.stringify(capa)}.`,
      )
    }
  }
  return capas.slice()
}

// ── Valores por defecto de producción ────────────────────────────────────────

/**
 * Lienzo de producción. Se separa para que el defecto del parámetro sea un nombre
 * y no una lambda incrustada, y para que quede claro qué se sustituye en el test.
 *
 * @param {number} anchoPx @param {number} altoPx
 * @returns {HTMLCanvasElement}
 */
function crearCanvasDom(anchoPx, altoPx) {
  const canvas = document.createElement('canvas')
  canvas.width = anchoPx
  canvas.height = altoPx
  return canvas
}

// ── La escala gráfica ────────────────────────────────────────────────────────

/**
 * Metros que representa la barra de escala: el valor más grande de la serie
 * 1-2-5·10ᵏ que quepa en `fraccionMaxima` del ancho del plano.
 *
 * Se rotula un número redondo porque una barra de «23,7 m» no se puede usar para
 * medir a ojo, que es para lo que existe una escala GRÁFICA (y, a diferencia de la
 * numérica, sobrevive a que alguien fotocopie el informe al 90 %).
 *
 * Pura y exportada: se puede probar sin lienzo.
 *
 * @param {number} anchoPx  Ancho del plano en píxeles (> 0).
 * @param {number} sx  Píxeles por metro en X, del encuadre (> 0). **No se recalcula
 *   aquí ni se promedia con `sy`**: ver la cabecera de `report/encuadre.js`.
 * @param {number} [fraccionMaxima=0.25]  Fracción del ancho que puede ocupar (0–1).
 * @returns {number}  Metros de la barra, de la serie 1-2-5·10ᵏ.
 * @throws {TypeError|RangeError}
 */
export function metrosDeBarra(anchoPx, sx, fraccionMaxima = FRACCION_BARRA) {
  for (const [valor, nombre] of [
    [anchoPx, 'anchoPx'],
    [sx, 'sx'],
    [fraccionMaxima, 'fraccionMaxima'],
  ]) {
    if (typeof valor !== 'number') {
      throw new TypeError(`metrosDeBarra: '${nombre}' debe ser un número; recibido ${describir(valor)}.`)
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new RangeError(`metrosDeBarra: '${nombre}' debe ser finito y > 0; recibido ${valor}.`)
    }
  }
  const metrosMaximos = (anchoPx * fraccionMaxima) / sx
  const exponente = Math.floor(Math.log10(metrosMaximos))
  const decada = 10 ** exponente
  for (const base of [5, 2, 1]) {
    if (base * decada <= metrosMaximos) return base * decada
  }
  // Inalcanzable: `decada ≤ metrosMaximos` por definición de `floor(log10())`. Se
  // deja por si la aritmética de coma flotante empuja el logaritmo justo al borde.
  return decada
}

// ── Dibujo ───────────────────────────────────────────────────────────────────

/**
 * Anillos de un conjunto de recintos que se PUEDEN dibujar, ya en píxeles.
 *
 * Filtra en vez de lanzar, y esa asimetría es la política del proyecto: un anillo
 * de menos de 3 vértices o con una coordenada no finita es **dato degenerado del
 * modelo** —señalarlo es trabajo de F02, no de una capa de dibujo—, así que se
 * avisa (regla de oro 1: no se traga) y se sigue con el resto. Lo que sí lanza es
 * que `recintos` no sea un array de recintos, que es un bug del programador.
 *
 * @param {Array<{vertices: Array<[number,number]>}>} recintos
 * @param {(p: [number,number]) => [number,number]} toPx
 * @param {import('../viewer/_comun.js').Avisar} avisar
 * @param {string} rotulo  Cómo llamar al conjunto en el aviso.
 * @returns {Array<{indice: number, vertices: Array<[number,number]>, px: Array<[number,number]>}>}
 */
function anillosDibujables(recintos, toPx, avisar, rotulo) {
  const salida = []
  for (let i = 0; i < recintos.length; i++) {
    const vertices = recintos[i].vertices
    if (vertices.length < 3) {
      avisar(
        `El ${rotulo} ${i === 0 ? 'exterior' : `hueco ${i}`} tiene ${vertices.length} vértices y ` +
          'no se puede dibujar como recinto: no sale en el plano.',
        { nivel: NIVEL.AVISO },
      )
      continue
    }
    const sano = vertices.every(
      (v) => Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1]),
    )
    if (!sano) {
      avisar(
        `El ${rotulo} ${i === 0 ? 'exterior' : `hueco ${i}`} tiene alguna coordenada no ` +
          'utilizable: no sale en el plano.',
        { nivel: NIVEL.AVISO },
      )
      continue
    }
    salida.push({ indice: i, vertices, px: vertices.map((v) => toPx(v)) })
  }
  return salida
}

/** Traza un anillo cerrado en el path actual (no rellena ni traza). */
function trazarAnillo(ctx, px) {
  ctx.moveTo(px[0][0], px[0][1])
  for (let i = 1; i < px.length; i++) ctx.lineTo(px[i][0], px[i][1])
  ctx.closePath()
}

/**
 * Rótulo con halo: primero el contorno blanco y encima el texto. Sin el halo, una
 * cota cae con frecuencia sobre una línea del parcelario y se vuelve ilegible.
 */
function textoConHalo(ctx, texto, x, y, { color, haloPx }) {
  ctx.lineWidth = haloPx
  ctx.lineJoin = 'round'
  ctx.strokeStyle = COLORES_PLANO.HALO
  ctx.strokeText(texto, x, y)
  ctx.fillStyle = color
  ctx.fillText(texto, x, y)
}

/**
 * (1) La parcela del usuario: relleno translúcido + trazo.
 *
 * Los huecos salen con `fill('evenodd')` en un ÚNICO path que incluye todos los
 * anillos: la regla par-impar deja sin rellenar lo que está dentro de un número
 * par de anillos, o sea el hueco, **sin depender de la orientación** de los
 * anillos y sin restar polígonos. Es la misma técnica que F07 usa en Leaflet
 * (`fillRule: 'evenodd'`), que allí ahorró la dependencia `@turf/difference`.
 */
function dibujarParcela(ctx, anillos, mm) {
  if (anillos.length === 0) return
  ctx.save()
  ctx.beginPath()
  for (const anillo of anillos) trazarAnillo(ctx, anillo.px)
  ctx.fillStyle = COLORES_PLANO.USUARIO_RELLENO
  ctx.fill('evenodd')
  ctx.strokeStyle = COLORES_PLANO.USUARIO
  ctx.lineWidth = mm(MEDIDAS_MM.TRAZO_PARCELA)
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()
}

/** (2) La geometría oficial del Catastro: fina, discontinua y sin relleno. */
function dibujarOficial(ctx, anillos, mm) {
  if (anillos.length === 0) return
  ctx.save()
  ctx.setLineDash(MEDIDAS_MM.RAYA_OFICIAL.map(mm))
  ctx.beginPath()
  for (const anillo of anillos) trazarAnillo(ctx, anillo.px)
  ctx.strokeStyle = COLORES_PLANO.OFICIAL
  ctx.lineWidth = mm(MEDIDAS_MM.TRAZO_OFICIAL)
  ctx.stroke()
  ctx.restore()
}

/**
 * (3) Las acotaciones: la longitud de cada lado, en su punto medio y girada con él.
 *
 * Las longitudes se miden **en UTM** con `geo/metrica.js#longitudesDeLados` (metros
 * de terreno), nunca en píxeles: el píxel ya lleva dentro el redondeo del papel. El
 * formato es `viewer/acotaciones.js#textoDeLongitud`, que existe precisamente para
 * que el informe no copie el formato.
 *
 * El texto nunca sale boca abajo: si el lado apunta al oeste, se le suma π al
 * ángulo (el rótulo se lee igual y el lado es el mismo segmento).
 */
function dibujarAcotaciones(ctx, anillos, mm) {
  const tamPx = mm(MEDIDAS_MM.TEXTO_COTA)
  const minimoPx = mm(MEDIDAS_MM.COTA_MINIMA)
  ctx.save()
  ctx.font = `${tamPx}px ${FUENTE_PLANO}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  for (const anillo of anillos) {
    const metros = longitudesDeLados(anillo.vertices)
    const n = anillo.px.length
    for (let i = 0; i < n; i++) {
      const [ax, ay] = anillo.px[i]
      const [bx, by] = anillo.px[(i + 1) % n]
      const largoPx = Math.hypot(bx - ax, by - ay)
      if (largoPx < minimoPx) continue
      // El rótulo se lleva el ángulo del lado NORMALIZADO a (−π/2, π/2]: los lados
      // que apuntan al oeste se giran media vuelta para que el texto no salga boca
      // abajo. Se RESTA o se SUMA π según el lado, en vez de sumar siempre: sumar
      // π a un ángulo de π daría 2π, que dibuja igual pero deja de ser un ángulo
      // acotado, y entonces «la cota nunca sale invertida» ya no es comprobable.
      let angulo = Math.atan2(by - ay, bx - ax)
      if (angulo > Math.PI / 2) angulo -= Math.PI
      else if (angulo < -Math.PI / 2) angulo += Math.PI
      ctx.save()
      ctx.translate((ax + bx) / 2, (ay + by) / 2)
      ctx.rotate(angulo)
      textoConHalo(ctx, textoDeLongitud(metros[i]), 0, -mm(0.8), {
        color: COLORES_PLANO.USUARIO,
        haloPx: mm(MEDIDAS_MM.HALO),
      })
      ctx.restore()
    }
  }
  ctx.restore()
}

/**
 * (4) Los vértices, numerados **desde 1 dentro de cada recinto**, que es como los
 * numera la tabla del visor (`viewer/sincronizacion.js`: el exterior va 1…n y el
 * primer hueco vuelve a empezar por 1). Si el plano numerara de corrido, la tabla
 * del informe y el plano del informe hablarían de vértices distintos.
 */
function dibujarVertices(ctx, anillos, mm) {
  const lado = mm(MEDIDAS_MM.LADO_VERTICE)
  const tamPx = mm(MEDIDAS_MM.TEXTO_VERTICE)
  ctx.save()
  ctx.font = `${tamPx}px ${FUENTE_PLANO}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  for (const anillo of anillos) {
    for (let i = 0; i < anillo.px.length; i++) {
      const [x, y] = anillo.px[i]
      ctx.fillStyle = COLORES_PLANO.HALO
      ctx.fillRect(x - lado / 2 - mm(0.2), y - lado / 2 - mm(0.2), lado + mm(0.4), lado + mm(0.4))
      ctx.fillStyle = COLORES_PLANO.USUARIO
      ctx.fillRect(x - lado / 2, y - lado / 2, lado, lado)
      textoConHalo(ctx, String(i + 1), x + lado, y - lado, {
        color: COLORES_PLANO.USUARIO,
        haloPx: mm(MEDIDAS_MM.HALO),
      })
    }
  }
  ctx.restore()
}

/**
 * (5) La barra de escala gráfica, abajo a la izquierda: `barra_px = N · sx`.
 *
 * Se rotula con `textoDeLongitud`, el mismo formato que las cotas: un documento
 * con dos formatos de metro invita a preguntarse cuál de los dos es el bueno.
 *
 * @returns {number}  Los metros que representa (van al resultado, no se recalculan).
 */
function dibujarBarraEscala(ctx, encuadre, mm) {
  const metros = metrosDeBarra(encuadre.anchoPx, encuadre.sx)
  const largo = metros * encuadre.sx
  const alto = mm(MEDIDAS_MM.ALTO_BARRA)
  const tamPx = mm(MEDIDAS_MM.TEXTO_ESCALA)
  const aire = mm(3)
  const anchoCartucho = largo + 2 * aire
  const altoCartucho = alto + tamPx + 3 * aire
  const x0 = mm(MEDIDAS_MM.MARGEN_CROMO)
  const y0 = encuadre.altoPx - mm(MEDIDAS_MM.MARGEN_CROMO) - altoCartucho

  ctx.save()
  ctx.fillStyle = COLORES_PLANO.CARTUCHO
  ctx.fillRect(x0, y0, anchoCartucho, altoCartucho)
  ctx.strokeStyle = COLORES_PLANO.CARTUCHO_BORDE
  ctx.lineWidth = mm(MEDIDAS_MM.TRAZO_OFICIAL)
  ctx.setLineDash([])
  ctx.strokeRect(x0, y0, anchoCartucho, altoCartucho)

  const xBarra = x0 + aire
  const yBarra = y0 + altoCartucho - aire - alto
  // Dos mitades alternadas: es lo que permite estimar fracciones a ojo.
  ctx.fillStyle = COLORES_PLANO.TEXTO
  ctx.fillRect(xBarra, yBarra, largo / 2, alto)
  ctx.fillStyle = COLORES_PLANO.HALO
  ctx.fillRect(xBarra + largo / 2, yBarra, largo / 2, alto)
  ctx.strokeStyle = COLORES_PLANO.TEXTO
  ctx.strokeRect(xBarra, yBarra, largo, alto)

  ctx.font = `${tamPx}px ${FUENTE_PLANO}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  textoConHalo(ctx, textoDeLongitud(metros), xBarra + largo / 2, yBarra - aire / 2, {
    color: COLORES_PLANO.TEXTO,
    haloPx: mm(MEDIDAS_MM.HALO),
  })
  ctx.restore()
  return metros
}

/**
 * (6) La flecha de norte, arriba a la derecha. **Vertical, porque en UTM el norte
 * de cuadrícula es +Y**, y rotulada {@link TEXTO_NORTE} por lo que explica la
 * cabecera: la convergencia de meridianos no está aplicada y eso tiene que poder
 * leerse en el papel, no solo en el código.
 */
function dibujarNorte(ctx, encuadre, mm) {
  const tamN = mm(MEDIDAS_MM.TEXTO_ESCALA)
  const tamPie = mm(MEDIDAS_MM.TEXTO_NORTE)
  const anchoCartucho = mm(30)
  const altoCartucho = mm(MEDIDAS_MM.FLECHA_NORTE) + tamN + tamPie + mm(6)
  const x0 = encuadre.anchoPx - mm(MEDIDAS_MM.MARGEN_CROMO) - anchoCartucho
  const y0 = mm(MEDIDAS_MM.MARGEN_CROMO)
  const cx = x0 + anchoCartucho / 2

  ctx.save()
  ctx.fillStyle = COLORES_PLANO.CARTUCHO
  ctx.fillRect(x0, y0, anchoCartucho, altoCartucho)
  ctx.strokeStyle = COLORES_PLANO.CARTUCHO_BORDE
  ctx.lineWidth = mm(MEDIDAS_MM.TRAZO_OFICIAL)
  ctx.setLineDash([])
  ctx.strokeRect(x0, y0, anchoCartucho, altoCartucho)

  const yPunta = y0 + mm(2) + tamN
  const yBase = yPunta + mm(MEDIDAS_MM.FLECHA_NORTE)
  ctx.strokeStyle = COLORES_PLANO.TEXTO
  ctx.lineWidth = mm(MEDIDAS_MM.TRAZO_PARCELA)
  ctx.beginPath()
  ctx.moveTo(cx, yBase)
  ctx.lineTo(cx, yPunta)
  ctx.stroke()
  ctx.fillStyle = COLORES_PLANO.TEXTO
  ctx.beginPath()
  ctx.moveTo(cx, yPunta)
  ctx.lineTo(cx - mm(1.6), yPunta + mm(3.4))
  ctx.lineTo(cx + mm(1.6), yPunta + mm(3.4))
  ctx.closePath()
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.font = `${tamN}px ${FUENTE_PLANO}`
  textoConHalo(ctx, 'N', cx, yPunta - mm(1), {
    color: COLORES_PLANO.TEXTO,
    haloPx: mm(MEDIDAS_MM.HALO),
  })
  ctx.font = `${tamPie}px ${FUENTE_PLANO}`
  textoConHalo(ctx, TEXTO_NORTE, cx, y0 + altoCartucho - mm(2), {
    color: COLORES_PLANO.TEXTO,
    haloPx: mm(MEDIDAS_MM.HALO),
  })
  ctx.restore()
}

// ── La cartografía de fondo ──────────────────────────────────────────────────

/**
 * Pide UNA imagen y la devuelve **solo si su tamaño es el que se pidió**.
 *
 * Los tres pasos que importan, en este orden y no en otro:
 *   1. `crossOrigin = 'anonymous'` **ANTES** de `src`. Es el orden que manda MDN y
 *      el dossier §4.4: asignarlo después NO surte efecto —la carga ya ha empezado
 *      con el modo por defecto— y el lienzo queda contaminado aunque el servidor
 *      emita `Access-Control-Allow-Origin`. El fallo es invisible hasta que
 *      `toDataURL` lanza `SecurityError`, que es al final del todo.
 *   2. Esperar el `load`.
 *   3. **Comparar `naturalWidth`/`naturalHeight` con lo pedido.** Ver la cabecera:
 *      el WMS del Catastro sustituye el tamaño en silencio y con HTTP 200. Si la
 *      imagen no trae dimensiones (`undefined`), tampoco se dibuja: lo que no se
 *      puede verificar no entra en un documento firmable.
 *
 * No lanza: devuelve el motivo. Una tesela o una capa que no llega es un suceso de
 * RED, no un bug (mismo criterio que `viewer/wms-catastro.js#_alFallar`, que lo
 * clasifica como `NIVEL.AVISO`).
 *
 * **Sin plazo propio**, igual que la precarga del visor: se espera al `load` o al
 * `error` del navegador, que es quien sabe cuándo una petición está muerta. Añadir
 * aquí un cronómetro daría una tercera política de espera —la del navegador, la del
 * servicio y la nuestra— y la más corta de las tres mandaría siempre.
 *
 * @returns {Promise<{ok: true, img: *}|{ok: false, motivo: string, porTamano: boolean}>}
 */
function pedirImagen(CrearImagen, url, anchoPx, altoPx) {
  return new Promise((resolve) => {
    const img = new CrearImagen()
    // ORDEN OBLIGATORIO: crossOrigin ANTES de src (ver el JSDoc de arriba).
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const ancho = img.naturalWidth
      const alto = img.naturalHeight
      if (ancho !== anchoPx || alto !== altoPx) {
        resolve({
          ok: false,
          porTamano: true,
          motivo:
            `el servicio devolvió una imagen de ${ancho}×${alto} px donde se pidieron ` +
            `${anchoPx}×${altoPx} px. El WMS del Catastro SUSTITUYE el tamaño en silencio ` +
            '(HTTP 200) cuando no puede servir el pedido; dibujarla dejaría toda la geometría ' +
            'descolocada bajo una escala correctamente rotulada.',
        })
        return
      }
      resolve({ ok: true, img })
    }
    img.onerror = () => {
      resolve({
        ok: false,
        porTamano: false,
        motivo: 'la petición de cartografía no llegó a cargarse (red, CORS o el servicio).',
      })
    }
    img.src = url
  })
}

// ── La composición ───────────────────────────────────────────────────────────

/**
 * El plano compuesto. **Contrato B** del plan de F09; los campos que van más allá
 * del contrato son ADITIVOS y están marcados.
 *
 * @typedef {Object} Plano
 * @property {Uint8Array} jpeg  Los bytes del JPEG, listos para el filtro `/DCTDecode`
 *   de `report/pdf.js#imagenJpeg`, **sin recodificar**.
 * @property {number} anchoPx  Ancho real del lienzo.
 * @property {number} altoPx   Alto real del lienzo.
 * @property {number} teselasPedidas  Teselas para las que se emitió al menos una `GetMap`.
 * @property {string[]} capasUsadas  Capas que llegaron a dibujarse, en orden.
 * @property {Array<{capa: string, motivo: string}>} capasCaidas  Las que se apagaron
 *   y por qué (regla de oro 1: no se cae ninguna en silencio).
 * @property {string} atribucion  Pie legal, de `viewer/atribucion.js#atribucionCombinada`.
 *   **`''` si no se dibujó NADA de cartografía**: atribuir un fondo que no está sería
 *   una atribución falsa.
 * @property {Array<{indice: number, motivo: string}>} teselasCaidas  *(aditivo)* Teselas
 *   que no se dibujaron **por causa no atribuible a una capa** — el caso del tamaño
 *   sustituido. Ver la cabecera: meterlas en `capasCaidas` señalaría a un culpable falso.
 * @property {number} peticiones  *(aditivo)* `GetMap` emitidas en total (teselas +
 *   sondeo capa a capa). En la ruta normal coincide con `teselasPedidas`.
 * @property {number} teselasDibujadas  *(aditivo)* Cuántas llevaron cartografía al lienzo.
 * @property {number} metrosBarra  *(aditivo)* Metros que representa la barra de escala.
 * @property {number} calidad  *(aditivo)* Calidad con la que se codificó el JPEG.
 * @property {import('./encuadre.js').Bbox|null} bbox  *(aditivo, auditoría R4)* La
 *   IDENTIDAD del encuadre con el que se compuso este plano: su trozo de mundo,
 *   copiado tal cual. `report/maqueta.js#exigirPlanoEncajable` lo coteja contra el
 *   encuadre con el que se maqueta —con igualdad exacta— para que un plano de OTRO
 *   trabajo con las mismas dimensiones en píxeles no pueda acabar bajo una escala
 *   que no es la suya. `null` solo si el encuadre no traía `bbox` (uno construido
 *   a mano; `encuadrar` lo trae siempre).
 * @property {number|null} escalaExacta  *(aditivo, auditoría R4)* La escala exacta
 *   del encuadre con el que se compuso, por lo mismo.
 */

/**
 * Compone el plano del informe: cartografía del WMS al tamaño exacto de salida +
 * el vector encima, y devuelve los bytes JPEG.
 *
 * ```js
 * const encuadre = encuadrar({ recintos, anchoMm: 180, altoMm: 130 })
 * const plano = await componerPlano({ encuadre, recintos })
 * doc.imagenJpeg(plano.jpeg, { x: 15, y: 40, anchoMm: 180, altoMm: 130,
 *                              anchoPx: plano.anchoPx, altoPx: plano.altoPx })
 * ```
 *
 * Orden de dibujo (dossier §4.4 y spec §Composición del plano), y no es negociable
 * porque cada capa tapa a la anterior: (0) fondo blanco, (1) cartografía, (2)
 * parcela con relleno translúcido y trazo, (3) geometría oficial, (4) acotaciones,
 * (5) vértices numerados, (6) barra de escala, (7) norte.
 *
 * **Qué NO hace.** No calcula el encuadre (lo recibe: una segunda aritmética podría
 * divergir de la que rotula la escala), no consulta el reloj, no importa proj4 —no
 * proyecta nada: el plano se pide en el SRS de la geometría— y no maqueta la
 * página, que es de T3.2.
 *
 * @param {Object} entrada
 * @param {import('./encuadre.js').Encuadre} entrada.encuadre  De `encuadrar`.
 * @param {Array<{vertices: Array<[number,number]>, tipo: string}>} entrada.recintos
 *   La geometría del usuario. `recintos[0]` es el EXTERIOR y el resto HUECOS.
 * @param {Array<{vertices: Array<[number,number]>, tipo: string}>|null} [entrada.recintosOficiales=null]
 *   La geometría oficial del Catastro, si la hay. `null` = no se dibuja (y no es lo
 *   mismo que `[]`, que es «se miró y no hay»: los dos salen igual en el papel, pero
 *   el llamante sabe cuál pasó).
 * @param {string} [entrada.srs=SRS_PLANO]  SRS de la petición, forma WMS `EPSG:nnnnn`.
 * @param {string[]} [entrada.capas=CAPAS_DEFECTO]  Capas del WMS, en orden de dibujo.
 * @param {string[]} [entrada.clavesAtribucion=CLAVES_ATRIBUCION_DEFECTO]  Claves de
 *   `viewer/atribucion.js#ATRIBUCION` para el pie.
 * @param {number} [entrada.calidad=CALIDAD_JPEG]  Calidad del JPEG, en (0, 1].
 * @param {(anchoPx: number, altoPx: number) => *} [entrada.crearCanvas]  Fábrica de
 *   lienzo. Por defecto `document.createElement('canvas')`.
 * @param {Function} [entrada.CrearImagen]  Constructor de imagen. Por defecto `Image`.
 * @param {Function} [entrada.urlDeMapa]  Constructor de URL. Por defecto
 *   `viewer/wms-catastro.js#getMapUrl`.
 * @param {import('../viewer/_comun.js').Avisar|null} [entrada.alAvisar=null]
 * @returns {Promise<Plano>}
 * @throws {TypeError}  Si `entrada` no es un objeto, si el encuadre no es un
 *   encuadre, si los recintos no son recintos, si `capas` no es un array no vacío de
 *   strings, o si alguna dependencia inyectada no es del tipo pactado.
 * @throws {RangeError}  Si `calidad` no está en (0, 1], si el lienzo no admite el
 *   tamaño pedido, o si `toDataURL` no devolvió un JPEG.
 * @throws {Error}  Si el lienzo no da contexto 2D, o si `toDataURL` lanzó
 *   `SecurityError` (lienzo contaminado): se re-lanza con la causa a la vista.
 */
export async function componerPlano(entrada) {
  if (!esObjeto(entrada)) {
    throw new TypeError(
      `componerPlano: se espera un objeto {encuadre, recintos, …}; recibido ${describir(entrada)}.`,
    )
  }
  const {
    encuadre,
    recintos,
    recintosOficiales = null,
    srs = SRS_PLANO,
    capas = CAPAS_DEFECTO,
    clavesAtribucion = CLAVES_ATRIBUCION_DEFECTO,
    calidad = CALIDAD_JPEG,
    crearCanvas = crearCanvasDom,
    CrearImagen = globalThis.Image,
    urlDeMapa = getMapUrl,
    alAvisar = null,
  } = entrada

  const avisar = resolverAvisar(alAvisar)
  exigirEncuadre(encuadre)
  exigirRecintos(recintos, 'recintos')
  if (recintosOficiales !== null) exigirRecintos(recintosOficiales, 'recintosOficiales')
  const capasVivas = exigirCapas(capas)
  if (typeof calidad !== 'number' || !Number.isFinite(calidad)) {
    throw new TypeError(`componerPlano: 'calidad' debe ser un número; recibido ${describir(calidad)}.`)
  }
  if (calidad <= 0 || calidad > 1) {
    throw new RangeError(`componerPlano: 'calidad' debe estar en (0, 1]; recibida ${calidad}.`)
  }
  for (const [fn, nombre, pista] of [
    [crearCanvas, 'crearCanvas', 'una función (anchoPx, altoPx) => lienzo'],
    [CrearImagen, 'CrearImagen', 'un constructor de imagen (por defecto `Image`)'],
    [urlDeMapa, 'urlDeMapa', 'una función (bbox, tamano, opts) => URL'],
  ]) {
    if (typeof fn !== 'function') {
      throw new TypeError(
        `componerPlano: '${nombre}' debe ser ${pista}; recibido ${describir(fn)}. Todas las ` +
          'dependencias de navegador se inyectan (jsdom no tiene contexto 2D); en Node no hay ' +
          'valor por defecto que valga.',
      )
    }
  }

  // El pie legal se compone AHORA, antes de tocar la red, aunque no se use hasta el
  // final: `atribucionCombinada` lanza con una clave desconocida, y eso es un bug del
  // programador que tiene que verse SIEMPRE. Calculado abajo, solo reventaría en las
  // composiciones en las que además llegó cartografía — un contrato que se comprueba
  // según el tiempo que haga en el servidor no es un contrato.
  const pieLegal = atribucionCombinada(clavesAtribucion)

  const { anchoPx, altoPx } = encuadre

  // ── El lienzo ──────────────────────────────────────────────────────────────
  const canvas = crearCanvas(anchoPx, altoPx)
  if (canvas === null || typeof canvas !== 'object') {
    throw new TypeError(
      `componerPlano: 'crearCanvas' debe devolver un lienzo; devolvió ${describir(canvas)}.`,
    )
  }
  // Se asigna aunque la fábrica ya lo haya hecho (es idempotente y ocurre antes de
  // dibujar nada) y **se vuelve a leer**: los navegadores tienen un techo de área de
  // lienzo y, al superarlo, dejan un lienzo de otro tamaño o en blanco. Es el mismo
  // modo de fallo que el del WMS, un piso más abajo.
  canvas.width = anchoPx
  canvas.height = altoPx
  if (canvas.width !== anchoPx || canvas.height !== altoPx) {
    throw new RangeError(
      `componerPlano: el lienzo quedó en ${canvas.width}×${canvas.height} px tras pedirle ` +
        `${anchoPx}×${altoPx}. Casi siempre es el techo de área de lienzo del navegador: el ` +
        'plano saldría con otra escala de la que se va a rotular.',
    )
  }
  const ctx = canvas.getContext('2d')
  if (ctx === null || typeof ctx !== 'object') {
    throw new Error(
      'componerPlano: el lienzo no da contexto 2D. En un navegador esto no pasa; bajo jsdom sí, ' +
        'porque el paquete `canvas` no está instalado (por eso `crearCanvas` se inyecta).',
    )
  }

  // Milímetros de PAPEL → píxeles del lienzo (ver MEDIDAS_MM). Se deriva del
  // encuadre —no de `PPP_INFORME`— para que el cromo siga a la resolución REAL:
  // 2126 px / 180 mm son 300,002 ppp, no 300 clavados, y el encuadre ya lo dice.
  const pxPorMm = anchoPx / encuadre.anchoMm
  const mm = (valor) => valor * pxPorMm

  // Fondo blanco ANTES que nada: un lienzo transparente codificado a JPEG sale
  // NEGRO (el JPEG no tiene canal alfa). Es lo que se ve si no llega cartografía.
  ctx.fillStyle = COLORES_PLANO.FONDO
  ctx.fillRect(0, 0, anchoPx, altoPx)

  // ── La cartografía ─────────────────────────────────────────────────────────
  const capasCaidas = []
  const teselasCaidas = []
  let peticiones = 0
  let teselasPedidas = 0
  let teselasDibujadas = 0

  const url = (tesela, capasPeticion, formato) =>
    urlDeMapa(
      tesela.bbox,
      { ancho: tesela.anchoPx, alto: tesela.altoPx },
      { crs: srs, capas: capasPeticion, formato, transparente: formato === FORMATO_SONDEO },
    )

  for (let t = 0; t < encuadre.teselas.length; t++) {
    const tesela = encuadre.teselas[t]
    if (capasVivas.length === 0) break
    teselasPedidas++

    // Ruta normal: UNA GetMap con todas las capas vivas.
    peticiones++
    const junta = await pedirImagen(
      CrearImagen,
      url(tesela, capasVivas, FORMATO_PLANO),
      tesela.anchoPx,
      tesela.altoPx,
    )
    if (junta.ok) {
      // TRES argumentos a propósito: pasar ancho/alto ESCALARÍA una imagen del
      // tamaño equivocado hasta encajar, tapando el fallo que se acaba de descartar.
      ctx.drawImage(junta.img, tesela.offsetX, tesela.offsetY)
      teselasDibujadas++
      continue
    }

    if (junta.porTamano) {
      // No es culpa de ninguna capa: el servicio ignoró WIDTH/HEIGHT, no LAYERS.
      // Sondear capa a capa repetiría la sustitución y culparía a un inocente.
      teselasCaidas.push({ indice: t, motivo: junta.motivo })
      avisar(`No se ha dibujado un trozo de la cartografía del plano: ${junta.motivo}`, {
        nivel: NIVEL.AVISO,
      })
      continue
    }

    // Sondeo capa a capa, en PNG transparente para poder superponerlas.
    avisar(
      'La cartografía del plano no ha llegado en una sola petición; se prueba capa a capa para ' +
        'dejar fuera solo la que no sirva.',
      { nivel: NIVEL.AVISO },
    )
    let algunaDibujada = false
    for (const capa of capasVivas.slice()) {
      peticiones++
      const suelta = await pedirImagen(
        CrearImagen,
        url(tesela, [capa], FORMATO_SONDEO),
        tesela.anchoPx,
        tesela.altoPx,
      )
      if (suelta.ok) {
        ctx.drawImage(suelta.img, tesela.offsetX, tesela.offsetY)
        algunaDibujada = true
        continue
      }
      capasVivas.splice(capasVivas.indexOf(capa), 1)
      capasCaidas.push({ capa, motivo: suelta.motivo })
      avisar(`La capa «${capa}» no se ha dibujado en el plano: ${suelta.motivo}`, {
        nivel: NIVEL.AVISO,
      })
    }
    if (algunaDibujada) teselasDibujadas++
  }

  if (teselasDibujadas === 0) {
    avisar(
      'El plano sale sin cartografía de fondo: la geometría se dibuja sobre blanco y el pie no ' +
        'atribuye ninguna fuente cartográfica.',
      { nivel: NIVEL.AVISO },
    )
  }

  // ── El vector ──────────────────────────────────────────────────────────────
  const anillos = anillosDibujables(recintos, encuadre.toPx, avisar, 'recinto')
  const anillosOficiales =
    recintosOficiales === null
      ? []
      : anillosDibujables(recintosOficiales, encuadre.toPx, avisar, 'recinto oficial')

  dibujarParcela(ctx, anillos, mm)
  dibujarOficial(ctx, anillosOficiales, mm)
  dibujarAcotaciones(ctx, anillos, mm)
  dibujarVertices(ctx, anillos, mm)
  const metrosBarra = dibujarBarraEscala(ctx, encuadre, mm)
  dibujarNorte(ctx, encuadre, mm)

  // ── Los bytes ──────────────────────────────────────────────────────────────
  const jpeg = bytesDeLienzo(canvas, calidad)

  return {
    jpeg,
    anchoPx,
    altoPx,
    teselasPedidas,
    // Si NO se dibujó ni un trozo de cartografía, ninguna capa se «usó» y no hay
    // fuente que atribuir: declarar lo contrario sería exactamente la clase de
    // afirmación cómoda que la regla de oro 1 prohíbe, y encima en el pie legal.
    capasUsadas: teselasDibujadas === 0 ? [] : capasVivas.slice(),
    capasCaidas,
    atribucion: teselasDibujadas === 0 ? '' : pieLegal,
    // Aditivos al contrato B (ver el typedef).
    teselasCaidas,
    peticiones,
    teselasDibujadas,
    metrosBarra,
    calidad,
    // ⭐ La IDENTIDAD del encuadre con el que se compuso (auditoría R4): viaja
    // CON el plano para que `report/maqueta.js#exigirPlanoEncajable` pueda
    // cotejar que plano y encuadre son del mismo trabajo — la relación de
    // aspecto no distingue dos encuadres con las mismas dimensiones en píxeles,
    // y pegar el plano de otro rotularía una escala que no es la del mapa. Se
    // COPIA (no se referencia) para que el plano siga siendo un POJO plano.
    bbox: esObjeto(encuadre.bbox) ? { ...encuadre.bbox } : null,
    escalaExacta: typeof encuadre.escalaExacta === 'number' ? encuadre.escalaExacta : null,
  }
}

/**
 * Lienzo → bytes JPEG, con las dos comprobaciones que `toDataURL` necesita y no
 * hace (ver la cabecera: la caída silenciosa a PNG y el `SecurityError`).
 *
 * @param {*} canvas
 * @param {number} calidad
 * @returns {Uint8Array}
 */
function bytesDeLienzo(canvas, calidad) {
  if (typeof canvas.toDataURL !== 'function') {
    throw new TypeError(
      'componerPlano: el lienzo no tiene `toDataURL`, que es de donde salen los bytes del JPEG.',
    )
  }
  let dataUrl
  try {
    dataUrl = canvas.toDataURL(FORMATO_PLANO, calidad)
  } catch (causa) {
    // El caso clásico: alguna imagen entró SIN `crossOrigin` (o con él asignado
    // DESPUÉS de `src`, que es lo mismo) y contaminó el lienzo.
    throw new Error(
      'componerPlano: el lienzo no se ha podido exportar. Si es un `SecurityError`, alguna ' +
        'imagen entró sin CORS —o con `crossOrigin` asignado después de `src`, que no surte ' +
        'efecto— y contaminó el lienzo entero.',
      { cause: causa },
    )
  }
  const prefijo = `data:${FORMATO_PLANO};base64,`
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefijo)) {
    throw new RangeError(
      `componerPlano: 'toDataURL' no devolvió un JPEG en base64 sino ` +
        `${JSON.stringify(String(dataUrl).slice(0, 40))}…. La especificación HTML manda CAER A ` +
        'PNG en silencio cuando el formato pedido no está soportado, y esos bytes no los ' +
        'descomprime el filtro /DCTDecode del PDF.',
    )
  }
  return bytesDesdeBase64(dataUrl.slice(prefijo.length))
}

/**
 * base64 → `Uint8Array`. Con `atob`, que es lo que hay en el navegador y en jsdom
 * (`Buffer` es de Node y este módulo no corre en Node).
 *
 * @param {string} base64
 * @returns {Uint8Array}
 */
function bytesDesdeBase64(base64) {
  const decodificar = globalThis.atob
  if (typeof decodificar !== 'function') {
    throw new Error(
      'componerPlano: no hay `atob` para decodificar el data URL del lienzo. Este módulo es de ' +
        'navegador (ver la cabecera).',
    )
  }
  const binario = decodificar(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}
