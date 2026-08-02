// report/encuadre.js — F09 · T2.1 · El ENCUADRE del plano del informe: qué trozo
// de mundo sale en el papel, a qué escala, y en cuántas peticiones se pide la
// cartografía de fondo. Contrato A del plan de F09, y la pieza de la que cuelgan
// las dos siguientes: `report/canvas.js` (T3.1) dibuja lo que aquí se decide y
// `report/pdf-parcela.js` (T3.2) lo coloca en la página.
//
// Módulo PURO, igual que `geo/bbox.js` y que `report/contraste-texto.js`: sin DOM,
// sin red, sin reloj, sin Leaflet y sin Turf (regla de oro 6: esto es aritmética,
// no topología). Proyecto Vitest `node`.
//
// ── POR QUÉ EL ENCUADRE SE CALCULA UNA VEZ Y AQUÍ ───────────────────────────
// Es el mismo argumento que abre `geo/bbox.js`, un piso más arriba. Del encuadre
// cuelgan CUATRO cosas que tienen que decir lo mismo o el documento miente:
//   1. el `BBOX=` y el `WIDTH/HEIGHT` de cada `GetMap` al WMS del Catastro,
//   2. el mapeo UTM→px con el que se dibuja el vector ENCIMA de esa imagen,
//   3. la barra de escala gráfica (`barra_px = N · sx`),
//   4. la escala numérica que se rotula en el PDF (`1:N`).
// Si cada una calculara su caja, bastaría un metro de discrepancia para que el
// lindero saliera desplazado sobre una cartografía de aspecto impecable, o para
// que un documento firmable declarase una escala que no es la suya. Por eso este
// módulo devuelve `sx`/`sy` y `escalaExacta` ya calculados: no para ahorrar tres
// divisiones, sino para que no haya una segunda aritmética que pueda divergir.
//
// ── EL TROCEADO ES OBLIGATORIO, NO UNA OPTIMIZACIÓN ─────────────────────────
// MEDIDO contra el servicio real el 2026-08-02 (T0.1 de F09), y corrige tanto al
// dossier como a la nota de `viewer/wms-catastro.js#MAX_PIXELES_WMS`, que hablaba
// de «recorte»:
//
//   · `2126×1535` px (los 180×130 mm a 300 ppp de la Receta A) → HTTP 200,
//     `image/jpeg`, `Access-Control-Allow-Origin: *` y **el tamaño EXACTO pedido**.
//     La ruta normal del informe es UNA SOLA `GetMap`, sin trocear.
//   · `4000×100` también se sirve exacto: el techo es 4000 px POR DIMENSIÓN.
//   · ⚠️ **Pasarse no recorta: SUSTITUYE.** `4200×100` y `5000×100` devolvieron las
//     dos veces `4000×2000` — el servidor ignora AMBAS dimensiones y planta un
//     tamaño suyo, con HTTP 200 y sin una palabra de aviso.
//
// Ese último es el peor modo de fallo que puede tener un plano: la imagen llega,
// carga, se dibuja, y toda la geometría queda descolocada sobre una cartografía
// que parece correcta. No hay excepción que capturar ni código de estado que
// mirar. Así que el troceado de {@link encuadrar} **existe para que eso no pueda
// ocurrir**: ninguna tesela que salga de aquí pide más de `maxPx` en ninguna
// dimensión, y con el valor por defecto ({@link MAX_PIXELES_TESELA}) eso significa
// que nunca se cruza el techo medido. Comprobar que lo servido coincide con lo
// pedido (`naturalWidth`/`naturalHeight`) sigue siendo trabajo de T3.1 — dos
// defensas independientes, como en `viewer/wms-catastro.js`.
//
// ── EL BBOX DE CADA TESELA SE CALCULA EN UTM, NUNCA EN PÍXELES ──────────────
// Los cortes de la rejilla se calculan UNA vez como coordenadas UTM
// (`cortesX`/`cortesY`) y cada tesela toma su borde de ese array COMPARTIDO: el
// `maxX` de una tesela y el `minX` de su vecina son literalmente el mismo
// `number`, así que la costura es exacta por construcción y no por suerte de
// redondeo. Los dos extremos (`cortes[0]` y `cortes[n]`) se ASIGNAN en vez de
// calcularse, de modo que la unión de las teselas reconstruye el bbox completo
// bit a bit.
//
// Y conviene no exagerar el peligro, porque exagerarlo es la mejor manera de que
// alguien lo desmonte al descubrir que no era para tanto. La alternativa natural
// —que cada tesela deduzca su borde de su propio offset en píxeles— **casi
// siempre da el mismo double**. Barridas 90 configuraciones de papel que trocean
// sobre la parcela real, la variante `minX + off/sx` se separa del corte
// compartido en UNA (1.000×150 mm a 400 ppp) y por 5,8·10⁻¹¹ m, que es el ulp de
// una coordenada de 4,4·10⁵: 58 picómetros, que además desaparecerían al
// serializar el BBOX, porque `getMapUrl` lo recorta al milímetro. O sea que el
// troceado por píxeles no rompería ningún plano hoy.
//
// La razón de hacerlo así es otra, y es la que aguanta: con los cortes
// compartidos, «las teselas son contiguas» es una propiedad DEMOSTRABLE —el test
// la afirma con igualdad exacta de coma flotante, que o pasa o no pasa— en vez de
// una tolerancia que daría verde con cualquier implementación, incluida una que
// se rompiera de verdad al cambiar de tamaño de papel, de servicio o de fórmula.
// Una costura correcta por construcción sobrevive a la siguiente edición; una
// correcta por suerte, no.
//
// ── QUÉ SE HACE CON LA DIFERENCIA RESIDUAL ENTRE `sx` Y `sy` ────────────────
// Tras ajustar la caja al ratio `anchoPx/altoPx`, `anchoUtm/altoUtm` es —en
// aritmética real— exactamente `anchoPx/altoPx`, luego `sx` y `sy` son EL MISMO
// número real (para la parcela del expediente, `1535/69,90 = 21,9599… px/m`). En
// float64 no coinciden: MEDIDO sobre esa parcela, difieren en 3,9·10⁻¹³ relativo,
// que sobre los 2126 px del plano son 8·10⁻¹⁰ píxeles. Y el residuo no viene de la
// multiplicación por el ratio —eso serían dos o tres ulp— sino de RESTAR
// coordenadas UTM de magnitud 4,4·10⁶, donde el ulp ya vale ~10⁻⁹ m (es la misma
// aritmética que obliga a `geo/area.js` a trasladar a origen local y a
// `bboxAlRatio` a repartir el crecimiento en vez de recentrar).
//
// **Decisión: no se promedian, no se fuerza `sx === sy`, y se devuelven los dos.**
// El motivo no es la precisión sino el REGISTRO con el ráster: el WMS estira el
// BBOX sobre `WIDTH×HEIGHT` con una escala independiente por eje, exactamente
// `anchoPx/anchoUtm` y `altoPx/altoUtm`. Dibujar el vector con una escala única
// distinta de una de esas dos lo separaría de la imagen sobre la que se dibuja, y
// un lindero desplazado respecto a la cartografía de fondo es justo el error que
// el informe existe para no cometer. La isotropía se consigue eligiendo bien el
// ratio (que es lo que hace `bboxAlRatio`), no forzando las escalas después.
//
// El residuo que SÍ sobrevive —y que conviene no confundir con el anterior— es el
// que el redondeo a píxeles ENTEROS empuja al PAPEL: `2126 px / 180 mm` son
// 300,002 ppp y `1535 px / 130 mm` son 299,915 ppp, así que la escala impresa vale
// 1:537,85 a lo ancho y 1:537,69 a lo alto. Es un 0,029 % de anisotropía —0,05 mm
// sobre 180 mm, por debajo de lo que imprime cualquier equipo— pero no se absorbe
// en silencio (regla de oro 1): `sx`, `sy`, `pppReal` y `escalaExacta` viajan en el
// resultado para que quien rotula el PDF pueda verlo y decidir. `escalaDenominador`
// es el entero que se rotula, y `escalaExacta` dice de qué se redondeó.
//
// ── UNA CONSTANTE DUPLICADA A PROPÓSITO ─────────────────────────────────────
// {@link MAX_PIXELES_TESELA} vale lo mismo que `viewer/wms-catastro.js#MAX_PIXELES_WMS`
// y NO se importa de allí: ese módulo importa Leaflet, que exige `window`, y este
// tiene que correr en el proyecto `node`. Es la misma fórmula con la que
// `report/contraste-texto.js#OMISION_CONOCIDA` convive con `diagnostico/parcela.js`:
// literal aquí + **test-guarda estático** que compara las dos cifras leyendo el
// texto fuente del otro fichero. Un literal suelto sin guardián sería peor; arrastrar
// Leaflet a un módulo puro, también.

import { bbox, bboxAlRatio, bboxConMargen } from '../geo/bbox.js'

// ── Constantes ───────────────────────────────────────────────────────────────

/** Milímetros por pulgada. La conversión de la Receta A: `px = mm/25,4 · ppp`. */
export const MM_POR_PULGADA = 25.4

/** Resolución del plano del informe (dossier §4.4, Receta A). */
export const PPP_INFORME = 300

/**
 * Aire por defecto alrededor de la parcela, en METROS del terreno. No es estética:
 * un plano recortado al lindero no enseña con qué se linda, y el informe se lee
 * para saber precisamente eso.
 */
export const MARGEN_DEFECTO_M = 10

/**
 * **Techo de tamaño de imagen del WMS del Catastro: 4000 px POR DIMENSIÓN.**
 *
 * Mismo valor que `viewer/wms-catastro.js#MAX_PIXELES_WMS`, duplicado a propósito
 * (ver la cabecera) y protegido por un test-guarda estático que compara las dos.
 * Medido: `4000×100` se sirve exacto; `4200×100` y `5000×100` devuelven `4000×2000`
 * SUSTITUYENDO ambas dimensiones, con HTTP 200 y sin aviso.
 */
export const MAX_PIXELES_TESELA = 4000

// ── Guardas de contrato ──────────────────────────────────────────────────────
//
// Mismo criterio que fijó `geo/bbox.js`, y por el mismo motivo: aquí no hay dato
// de usuario que avisar, hay un bug del programador que tiene que verse.
//   · `TypeError`  → el TIPO no es el pactado.
//   · `RangeError` → el tipo es correcto pero el VALOR no puede serlo.

/** Cómo nombrar lo que ha llegado cuando no es lo pactado (`typeof null` no vale). */
const describir = (v) => (v === null ? 'null' : Array.isArray(v) ? `un array de ${v.length}` : typeof v)

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Exige un número finito y estrictamente positivo. Milímetros de papel, puntos por
 * pulgada y píxeles: ninguno de los tres admite el 0 (un plano de ancho 0 no es un
 * plano pequeño, es que no hay plano) ni el negativo.
 */
function exigirPositivo(valor, nombre, quien) {
  if (typeof valor !== 'number') {
    throw new TypeError(`${quien}: '${nombre}' debe ser un número; recibido ${describir(valor)}.`)
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new RangeError(
      `${quien}: '${nombre}' debe ser finito y mayor que 0; recibido ${valor}.`,
    )
  }
}

// ── Milímetros de papel → píxeles de imagen ──────────────────────────────────

/**
 * Píxeles que ocupan `mm` de papel a `ppp` puntos por pulgada, redondeados al
 * ENTERO: `round(mm / 25,4 · ppp)`. Es el paso 2 de la Receta A y el único sitio
 * del proyecto donde se escribe esa fórmula.
 *
 * **El redondeo es inevitable y tiene consecuencia**: WMS exige `WIDTH`/`HEIGHT`
 * enteros y un canvas no tiene fracciones de píxel, así que 180 mm a 300 ppp no
 * son 2125,98 px sino 2126, y la resolución REAL sube a 300,003 ppp. Quien llama a
 * {@link encuadrar} recibe esa resolución real en `pppReal` en vez de tener que
 * suponerla (regla de oro 1).
 *
 * @param {number} mm  Medida del papel en milímetros, finita y > 0.
 * @param {number} [ppp=PPP_INFORME]  Puntos por pulgada, finito y > 0.
 * @returns {number}  Píxeles, entero ≥ 1.
 * @throws {TypeError}  Si `mm` o `ppp` no son números.
 * @throws {RangeError}  Si no son finitos o no son > 0, o si el resultado se
 *   queda en 0 píxeles (una imagen sin píxeles no se puede pedir ni dibujar).
 */
export function pxDesdeMm(mm, ppp = PPP_INFORME) {
  exigirPositivo(mm, 'mm', 'pxDesdeMm')
  exigirPositivo(ppp, 'ppp', 'pxDesdeMm')
  const px = Math.round((mm / MM_POR_PULGADA) * ppp)
  if (px < 1) {
    throw new RangeError(
      `pxDesdeMm: ${mm} mm a ${ppp} ppp dan ${px} píxeles, y una imagen sin píxeles no se ` +
        'puede pedir al WMS ni dibujar en un canvas. Sube el tamaño del papel o la resolución.',
    )
  }
  return px
}

// ── La rejilla de teselas ────────────────────────────────────────────────────

/**
 * Reparte `total` píxeles en `n` tramos contiguos que suman EXACTAMENTE `total`.
 *
 * Devuelve los `n+1` offsets acumulados (`[0, …, total]`), no los anchos: los
 * offsets son lo que de verdad hace falta —cada tesela toma el suyo y el del
 * vecino— y así el «suman el total» deja de ser una propiedad que hay que
 * comprobar y pasa a ser el último elemento del array.
 *
 * `floor(i·total/n)` reparte el resto de la división entre los primeros tramos sin
 * acumular error: los anchos difieren como mucho en 1 px y ninguno supera
 * `ceil(total/n)`, que con `n = ceil(total/maxPx)` es ≤ `maxPx`. Es lo que
 * garantiza que ninguna tesela cruza el techo del servicio.
 *
 * @param {number} total  Píxeles a repartir, entero ≥ 1.
 * @param {number} n  Número de tramos, entero ≥ 1 y ≤ `total`.
 * @returns {number[]}  `n+1` offsets crecientes; el primero 0 y el último `total`.
 */
function offsetsDeRejilla(total, n) {
  const offsets = []
  for (let i = 0; i <= n; i++) offsets.push(Math.floor((i * total) / n))
  return offsets
}

/**
 * Los cortes de la rejilla EN UTM: `n+1` coordenadas, una por frontera, con los dos
 * extremos ASIGNADOS (no calculados) para que la unión de las teselas reconstruya
 * el bbox bit a bit.
 *
 * `signo` vale +1 en X (el píxel 0 está en `minX` y se crece hacia el este) y −1 en
 * Y (el píxel 0 está arriba, en `maxY`, y se baja hacia el sur: la y va invertida).
 *
 * @param {number} desde  Coordenada UTM del píxel 0 (`minX` en X, `maxY` en Y).
 * @param {number} hasta  Coordenada UTM del último píxel (`maxX` en X, `minY` en Y).
 * @param {number} longitud  Longitud UTM del eje completo, en metros (> 0).
 * @param {number} totalPx  Píxeles del eje completo.
 * @param {number[]} offsets  Los `n+1` offsets en píxeles de {@link offsetsDeRejilla}.
 * @param {1|-1} signo  Sentido del eje respecto al UTM.
 * @returns {number[]}  `n+1` coordenadas UTM, monótonas, con los extremos exactos.
 */
function cortesEnUtm(desde, hasta, longitud, totalPx, offsets, signo) {
  const ultimo = offsets.length - 1
  return offsets.map((off, i) => {
    if (i === 0) return desde
    if (i === ultimo) return hasta
    return desde + signo * longitud * (off / totalPx)
  })
}

// ── El encuadre ──────────────────────────────────────────────────────────────

/**
 * Caja envolvente en UTM, en metros.
 * @typedef {{minX: number, minY: number, maxX: number, maxY: number}} Bbox
 */

/**
 * Un trozo del plano que se pide al WMS en una sola `GetMap` y se dibuja en el
 * canvas en `(offsetX, offsetY)`.
 *
 * @typedef {Object} Tesela
 * @property {Bbox} bbox  Su trozo de mundo, en UTM. Comparte borde EXACTO con sus vecinas.
 * @property {number} anchoPx  `WIDTH` de su `GetMap`. Nunca supera `maxPx`.
 * @property {number} altoPx   `HEIGHT` de su `GetMap`. Nunca supera `maxPx`.
 * @property {number} offsetX  Columna del canvas donde va su borde izquierdo.
 * @property {number} offsetY  Fila del canvas donde va su borde superior.
 */

/**
 * Todo lo que el plano del informe necesita saber de sí mismo. **Contrato A** del
 * plan de F09; los campos que van más allá del contrato son ADITIVOS y están
 * marcados abajo.
 *
 * @typedef {Object} Encuadre
 * @property {Bbox} bbox  El trozo de mundo que sale en el plano: la caja de la
 *   geometría, con margen y YA ajustada al ratio del papel. Nunca recorta.
 * @property {number} anchoPx  Ancho del canvas de salida, en píxeles enteros.
 * @property {number} altoPx   Alto del canvas de salida, en píxeles enteros.
 * @property {number} anchoMm  Ancho del plano en el PDF, en milímetros (eco).
 * @property {number} altoMm   Alto del plano en el PDF, en milímetros (eco).
 * @property {number} ppp  Resolución PEDIDA (eco). La conseguida está en `pppReal`.
 * @property {number} escalaDenominador  La escala que se rotula: entero, `1:N`.
 * @property {(punto: [number, number]) => [number, number]} toPx  UTM → píxel del
 *   canvas, con la y invertida. Devuelve flotantes, sin redondear.
 * @property {Tesela[]} teselas  Una si el canvas cabe en una `GetMap`; N contiguas
 *   si no. Cubren el bbox entero, no se solapan y sus tamaños suman los del canvas.
 * @property {number} sx  *(aditivo)* Píxeles por metro en X. Lo necesita la barra
 *   de escala gráfica (`barra_px = N · sx`); calcularlo aparte sería una segunda verdad.
 * @property {number} sy  *(aditivo)* Píxeles por metro en Y.
 * @property {number} escalaExacta  *(aditivo)* La escala SIN redondear, de la que
 *   sale `escalaDenominador` (regla de oro 1: el redondeo se dice).
 * @property {{x: number, y: number}} pppReal  *(aditivo)* Resolución realmente
 *   conseguida en cada eje tras redondear los píxeles a enteros.
 * @property {{columnas: number, filas: number}} rejilla  *(aditivo)* Forma del
 *   troceado. `{1,1}` es la ruta normal.
 */

/**
 * Decide el encuadre del plano del informe: de unos recintos y un tamaño de papel,
 * a la caja de mundo, la escala, el mapeo UTM→px y las peticiones de cartografía.
 *
 * ```js
 * const e = encuadrar({ recintos: parcela.recintos, anchoMm: 180, altoMm: 130 })
 * e.escalaDenominador   // 538  → se rotula «1:538»
 * e.toPx([439283.23, 4479687.38])
 * for (const t of e.teselas) urlDeMapa(t.bbox, { ancho: t.anchoPx, alto: t.altoPx })
 * ```
 *
 * Los pasos, que son los 1–3 de la Receta A (dossier §4.4):
 *   1. `anchoPx = round(anchoMm/25,4 · ppp)`, y lo mismo en alto.
 *   2. Caja de los recintos con `geo/bbox.js#bbox`, más `margenM` metros de aire
 *      por los cuatro lados, ajustada al ratio `anchoPx/altoPx` **creciendo**: ni
 *      recorta ni deforma, y la caja de la geometría queda siempre CONTENIDA.
 *   3. `sx = anchoPx/(maxX−minX)`, `sy = altoPx/(maxY−minY)`, y
 *      `toPx([x,y]) = [(x−minX)·sx, (maxY−y)·sy]` (y invertida: el norte arriba).
 *
 * **Qué NO hace.** No pide nada al WMS (compone la geometría de las peticiones, no
 * las lanza), no dibuja, no redondea las coordenadas del modelo (regla 11: el
 * redondeo es de salida) y no consulta el reloj.
 *
 * @param {Object} entrada
 * @param {Array<{vertices: Array<[number, number]>, tipo: 'EXTERIOR'|'HUECO'}>} entrada.recintos
 *   La geometría que tiene que salir en el plano. `recintos[0]` es el EXTERIOR y el
 *   resto HUECOS (invariante de `model/parcela.js`, exigido por `geo/bbox.js#bbox`).
 * @param {Array<Array<{vertices: Array<[number, number]>, tipo: string}>>} [entrada.otrosRecintos=[]]
 *   Otros conjuntos de recintos que TAMBIÉN tienen que caber en el plano —el
 *   contorno oficial del Catastro, típicamente—. Cada uno se encuadra con las mismas
 *   reglas y su caja se une a la principal. Existe porque el plano del informe
 *   dibuja al menos dos geometrías y encuadrar solo por una dejaría la otra fuera en
 *   silencio; en el caso normal el oficial cae dentro y esto no cambia nada.
 * @param {number} entrada.anchoMm  Ancho del plano en el PDF, en mm (> 0).
 * @param {number} entrada.altoMm   Alto del plano en el PDF, en mm (> 0).
 * @param {number} [entrada.ppp=PPP_INFORME]  Resolución pedida (> 0).
 * @param {number} [entrada.margenM=MARGEN_DEFECTO_M]  Aire alrededor de la
 *   geometría, en METROS del terreno (≥ 0; el 0 es legítimo y no da margen).
 * @param {number} [entrada.maxPx=MAX_PIXELES_TESELA]  Máximo de píxeles por
 *   dimensión de UNA petición. Por encima se trocea. El valor por defecto es el
 *   techo medido del WMS del Catastro; se puede bajar (otro servicio, o un test),
 *   pero subirlo por encima de 4000 contra el Catastro es exactamente el fallo
 *   silencioso que este módulo existe para impedir.
 * @returns {Encuadre}
 * @throws {TypeError}  Si `entrada` no es un objeto, si `otrosRecintos` no es un
 *   array de arrays, o si alguna medida no es un número. Los recintos los valida
 *   `geo/bbox.js#bbox`, cuyos mensajes se dejan pasar tal cual (dicen QUÉ anillo
 *   viene roto y con qué prefijo, que es más útil que envolverlos).
 * @throws {RangeError}  Si alguna medida no es finita o no es positiva, si `maxPx`
 *   no es un entero ≥ 1, si el papel se queda en 0 píxeles, si la geometría es un
 *   punto (no hay lado del que deducir el otro) o si la escala saldría `1:0`.
 */
export function encuadrar(entrada) {
  if (!esObjeto(entrada)) {
    throw new TypeError(
      'encuadrar: se espera un objeto {recintos, anchoMm, altoMm, ppp, margenM}; ' +
        `recibido ${describir(entrada)}.`,
    )
  }

  const {
    recintos,
    otrosRecintos = [],
    anchoMm,
    altoMm,
    ppp = PPP_INFORME,
    margenM = MARGEN_DEFECTO_M,
    maxPx = MAX_PIXELES_TESELA,
  } = entrada

  exigirPositivo(anchoMm, 'anchoMm', 'encuadrar')
  exigirPositivo(altoMm, 'altoMm', 'encuadrar')
  exigirPositivo(ppp, 'ppp', 'encuadrar')
  exigirPositivo(maxPx, 'maxPx', 'encuadrar')
  if (!Number.isInteger(maxPx)) {
    throw new RangeError(
      `encuadrar: 'maxPx' debe ser un ENTERO de píxeles (WMS exige WIDTH/HEIGHT enteros); ` +
        `recibido ${maxPx}.`,
    )
  }
  if (!Array.isArray(otrosRecintos)) {
    throw new TypeError(
      `encuadrar: 'otrosRecintos' debe ser un array de conjuntos de recintos (p. ej. ` +
        `[geometriaOficial]); recibido ${describir(otrosRecintos)}.`,
    )
  }

  // ── 1 · El papel, en píxeles ───────────────────────────────────────────────
  const anchoPx = pxDesdeMm(anchoMm, ppp)
  const altoPx = pxDesdeMm(altoMm, ppp)

  // ── 2 · La caja: geometría + margen, ajustada al ratio ─────────────────────
  let caja = bbox(recintos)
  for (let i = 0; i < otrosRecintos.length; i++) {
    const otra = bbox(otrosRecintos[i])
    caja = {
      minX: Math.min(caja.minX, otra.minX),
      minY: Math.min(caja.minY, otra.minY),
      maxX: Math.max(caja.maxX, otra.maxX),
      maxY: Math.max(caja.maxY, otra.maxY),
    }
  }
  // El ratio es el del PÍXEL, no el del milímetro (spec F09, «ajustado al ratio
  // W_px/H_px»): así la caja calza con la rejilla de píxeles que el WMS va a
  // rasterizar y `sx`/`sy` coinciden. La diferencia entre los dos ratios —2126/1535
  // frente a 180/130— es la anisotropía de 0,029 % que la cabecera desmenuza.
  const cajaFinal = bboxAlRatio(bboxConMargen(caja, margenM), anchoPx / altoPx)

  const anchoUtm = cajaFinal.maxX - cajaFinal.minX
  const altoUtm = cajaFinal.maxY - cajaFinal.minY

  // ── 3 · Escalas y mapeo ────────────────────────────────────────────────────
  const sx = anchoPx / anchoUtm
  const sy = altoPx / altoUtm
  const { minX, maxY } = cajaFinal

  /**
   * UTM → píxel del canvas, con la y INVERTIDA (en la imagen el 0 está arriba y el
   * norte también, así que a más Norte, menos fila).
   *
   * Devuelve flotantes a propósito: redondear aquí tiraría el subpíxel con el que
   * el canvas antialias los trazos, y a 300 ppp medio píxel son 42 µm de papel.
   * Valida sus dos números aunque se llame una vez por vértice: un `NaN` no lanza
   * nada, se propaga a `ctx.lineTo` y produce un trazo que simplemente no aparece
   * —error silencioso de manual (regla de oro 1)— y el coste de dos
   * `Number.isFinite` es despreciable al lado de una operación de canvas.
   *
   * @param {[number, number]} punto  Par UTM `[x, y]` en metros.
   * @returns {[number, number]}  `[px, py]`, sin redondear y sin recortar al lienzo:
   *   un punto fuera del encuadre devuelve coordenadas fuera del canvas, que es la
   *   respuesta correcta y además se ve.
   */
  const toPx = (punto) => {
    const x = punto === null || punto === undefined ? undefined : punto[0]
    const y = punto === null || punto === undefined ? undefined : punto[1]
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError(
        `encuadre.toPx: se esperaba un par [x,y] de números finitos en UTM; recibido ` +
          `${describir(punto)} (${String(punto)}).`,
      )
    }
    return [(x - minX) * sx, (maxY - y) * sy]
  }

  // ── 4 · La escala numérica que se rotula en el PDF ─────────────────────────
  const escalaExacta = (anchoUtm * 1000) / anchoMm
  const escalaDenominador = Math.round(escalaExacta)
  if (escalaDenominador < 1) {
    throw new RangeError(
      `encuadrar: la escala saldría 1:${escalaDenominador} (exacta ${escalaExacta}), y eso no ` +
        `es una escala: ${anchoUtm} m de terreno no caben en ${anchoMm} mm de papel a menos ` +
        'de 1:1. Revisa el tamaño del plano o la geometría.',
    )
  }

  // ── 5 · El troceado ────────────────────────────────────────────────────────
  const columnas = Math.ceil(anchoPx / maxPx)
  const filas = Math.ceil(altoPx / maxPx)
  const offsetsX = offsetsDeRejilla(anchoPx, columnas)
  const offsetsY = offsetsDeRejilla(altoPx, filas)
  // Los cortes se calculan EN UTM y se COMPARTEN entre vecinas: ver la cabecera.
  const cortesX = cortesEnUtm(minX, cajaFinal.maxX, anchoUtm, anchoPx, offsetsX, 1)
  const cortesY = cortesEnUtm(maxY, cajaFinal.minY, altoUtm, altoPx, offsetsY, -1)

  const teselas = []
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      teselas.push({
        // `cortesY[f]` es el borde SUPERIOR de la fila (más al norte) y `cortesY[f+1]`
        // el inferior: la rejilla se recorre en el sentido del canvas, no en el del UTM.
        bbox: {
          minX: cortesX[c],
          minY: cortesY[f + 1],
          maxX: cortesX[c + 1],
          maxY: cortesY[f],
        },
        anchoPx: offsetsX[c + 1] - offsetsX[c],
        altoPx: offsetsY[f + 1] - offsetsY[f],
        offsetX: offsetsX[c],
        offsetY: offsetsY[f],
      })
    }
  }

  return {
    bbox: cajaFinal,
    anchoPx,
    altoPx,
    anchoMm,
    altoMm,
    ppp,
    escalaDenominador,
    toPx,
    teselas,
    // Aditivos al contrato A (ver el typedef): existen para que nadie recalcule
    // por su cuenta lo que aquí ya está decidido, y para que los redondeos se vean.
    sx,
    sy,
    escalaExacta,
    pppReal: {
      x: anchoPx / (anchoMm / MM_POR_PULGADA),
      y: altoPx / (altoMm / MM_POR_PULGADA),
    },
    rejilla: { columnas, filas },
  }
}
