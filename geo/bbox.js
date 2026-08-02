// geo/bbox.js — Caja envolvente en UTM, y las dos operaciones que el plano del
// informe hace con ella: darle margen y ajustarla al ratio del papel (F09,
// tarea T1.1). Módulo PURO y hoja del grafo de dependencias, igual que
// `geo/area.js` y `geo/metrica.js`: sin DOM, sin red, sin reloj, sin Leaflet y
// sin Turf — esto es aritmética de mínimos y máximos, no topología (regla de
// oro 6, que ni siquiera llega a rozarse).
//
// POR QUÉ EXISTE (spec/feature-09-informe-parcela.md, «Composición del plano»).
// El plano a 300 ppp se compone a mano (regla de oro 7: nada de html2canvas) y
// TRES cosas distintas leen la misma caja: el `BBOX=` de la `GetMap` que se le
// pide al WMS del Catastro, el mapeo UTM→px que dibuja el vector encima
// (`sx = W_px/(maxX−minX)`) y la escala numérica que se rotula en el PDF
// (`1:(maxX−minX)·1000/W_mm`). Si las tres calcularan su propia caja, bastaría
// que una discrepara en un metro para que el vector saliera desplazado sobre
// una cartografía que parece correcta, o para que un documento firmable
// declarase una escala que no es la suya. La caja se calcula una vez, aquí.
//
// LA REGLA DURA — `bboxAlRatio` CRECE, NUNCA RECORTA Y NUNCA DEFORMA. Ajustar
// una caja al ratio del papel admite dos soluciones: agrandar el lado que se
// queda corto o recortar el que sobra. Recortar dejaría parcela FUERA del plano
// sin decírselo a nadie —un lindero que no aparece en un documento que se firma
// es precisamente el error silencioso que prohíbe la regla de oro 1— y estirar
// un solo eje daría un plano con escala distinta en X y en Y, es decir, una
// escala rotulada que miente. Así que solo se crece, y se crece centrado.
//
// YA EXISTE UN CÁLCULO EQUIVALENTE Y SE DEJA DONDE ESTÁ. `segmentosDeContorno`
// (`diagnostico/desviacion.js:241`) calcula, en privado y sin exportarlo, el
// `xmin/xmax/ymin/ymax` de CADA SEGMENTO del contorno oficial para descartar
// candidatos lejanos antes de proyectar. Es la misma aritmética a otra escala
// (por lado, no por anillo) y con otro fin (podar un bucle caliente, no
// encuadrar un papel), y su forma —cuatro comparaciones en línea, sin objeto
// intermedio ni validación— está elegida para ese bucle. F09 no reabre F07: se
// anota para que quien venga detrás sepa que existe y decida a sabiendas, no
// para unificarlo hoy.
//
// Convenciones (F00, no negociables):
//   · Regla de oro 3 — Todo en UTM (x = Este, y = Norte), metros. Ninguna
//     función de aquí acepta ni devuelve lat/lon.
//   · Regla de oro 4 — Anillos ABIERTOS: [[x,y], …] SIN repetir el vértice de
//     cierre. A la envolvente le da igual (el vértice repetido no movería un
//     mínimo ni un máximo), pero el invariante se exige igual: aceptar en
//     silencio un anillo cerrado aquí normalizaría la excepción para el resto
//     del proyecto, donde sí importa.
//   · Regla de oro 1 — El invariante de `recintos` (el 0 es el EXTERIOR, el
//     resto HUECOS) lo impone `model/parcela.js`. Si llega roto hasta aquí es un
//     bug del PROGRAMA, no un dato del usuario: se lanza, no se absorbe.
//
// LOS CONTRATOS ROTOS LANZAN, Y AQUÍ MÁS QUE EN SUS HERMANAS. `geo/area.js#superficie`
// devuelve 0 ante `recintos` vacío y `geo/metrica.js#perimetro` devuelve
// `{0,0,0}`: para una MEDIDA, el cero es una respuesta cierta sobre una figura
// vacía. Una CAJA no tiene equivalente — la envolvente de la nada no es un
// rectángulo pequeño, es que no hay rectángulo—, y cualquier valor de cortesía
// que se devolviera acabaría dividido para sacar la escala. Por eso este módulo
// exige y lanza: `TypeError` cuando el TIPO no es el pactado, `RangeError`
// cuando el tipo es correcto pero el VALOR no puede serlo.
//
// PRECISIÓN (regla de oro 5). Aquí NO hace falta trasladar a origen local, y
// conviene decir por qué en vez de dejar la duda: la traslación de
// `geo/area.js` existe porque el shoelace MULTIPLICA coordenadas absolutas
// entre sí (con Norte ≈ 4·10⁶ eso mezcla términos de orden 10¹³ y se lleva por
// delante los metros), y aquí no hay un solo producto de coordenadas: solo
// comparaciones, sumas y restas de una coordenada con una LONGITUD (un margen,
// medio crecimiento), que son de órdenes muy distintos y no cancelan. Lo que sí
// depende del redondeo es la CONTENCIÓN, y por eso el crecimiento se reparte en
// vez de recentrarse: ver la nota de {@link bboxAlRatio}.

/**
 * Caja envolvente en UTM, en metros. Invariantes: `minX ≤ maxX`, `minY ≤ maxY`.
 *
 * @typedef {{minX: number, minY: number, maxX: number, maxY: number}} Bbox
 */

/** Cómo nombrar lo que ha llegado cuando no es lo pactado (`typeof null` no vale). */
const describir = (v) => (v === null ? 'null' : Array.isArray(v) ? `un array de ${v.length}` : typeof v)

/**
 * La caja de un anillo, con la etiqueta de quién lo pidió para que el mensaje de
 * error diga QUÉ anillo venía roto y no solo que alguno lo estaba.
 *
 * @param {Array<[number, number]>} anillo
 * @param {string} quien  Prefijo del mensaje (p. ej. `bbox → recintos[1].vertices`).
 * @returns {Bbox}
 */
function cajaDeAnillo(anillo, quien) {
  if (!Array.isArray(anillo)) {
    throw new TypeError(
      `${quien}: se esperaba un anillo ABIERTO Array<[x,y]> en UTM; recibido ${describir(anillo)}.`,
    )
  }
  if (anillo.length < 3) {
    throw new RangeError(
      `${quien}: se esperaban al menos 3 vértices y han llegado ${anillo.length}. ` +
        'Con menos no hay anillo, y a diferencia de una medida —donde 0 es la respuesta cierta ' +
        'para una figura degenerada (geo/area.js#areaFirmada, geo/metrica.js#longitudesDeLados)— ' +
        'la caja de un segmento no se distingue de la de una parcela: el plano saldría compuesto, ' +
        'rotulado y a escala sobre algo que no existe.',
    )
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < anillo.length; i++) {
    const v = anillo[i]
    const x = v === null || v === undefined ? undefined : v[0]
    const y = v === null || v === undefined ? undefined : v[1]
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError(
        `${quien}: el vértice ${i} debe ser un par [x,y] de números FINITOS en UTM; ` +
          `recibido ${describir(v)} (${String(v)}). Un NaN se propaga por Math.min/Math.max sin ` +
          'quejarse y la caja acabaría en la URL del WMS como BBOX=NaN,NaN,NaN,NaN.',
      )
    }
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Caja envolvente de un anillo ABIERTO en UTM.
 *
 * @param {Array<[number, number]>} anillo  Anillo ABIERTO en UTM [[x,y], …], ≥ 3 vértices.
 * @returns {Bbox}  Metros UTM.
 * @throws {TypeError}  Si `anillo` no es un array, o si algún vértice no es un
 *   par de números finitos.
 * @throws {RangeError}  Si el anillo tiene menos de 3 vértices.
 */
export function bboxAnillo(anillo) {
  return cajaDeAnillo(anillo, 'bboxAnillo')
}

/**
 * Exige el invariante EXTERIOR/HUECO de `recintos`, con el mismo texto que
 * `geo/area.js#superficie` y `geo/metrica.js#perimetro`: quien lea el mensaje en
 * cualquiera de los tres sitios debe reconocerlo.
 *
 * @param {unknown} recinto
 * @param {number} i
 */
function exigirRecinto(recinto, i) {
  if (recinto === null || typeof recinto !== 'object') {
    throw new TypeError(
      `bbox: recintos[${i}] debe ser un objeto {vertices, tipo}; recibido ${describir(recinto)}.`,
    )
  }
  if (i === 0) {
    if (recinto.tipo !== 'EXTERIOR') {
      throw new TypeError(`bbox: recintos[0] debe ser el EXTERIOR; recibido tipo='${recinto.tipo}'.`)
    }
    return
  }
  if (recinto.tipo !== 'HUECO') {
    throw new TypeError(
      `bbox: recintos[${i}] debe ser HUECO; recibido tipo='${recinto.tipo}'. ` +
        '(El invariante lo impone model/parcela.js — regla de oro 1.)',
    )
  }
}

/**
 * Caja envolvente de un conjunto de recintos: la UNIÓN de las cajas de TODOS
 * sus anillos, exterior y huecos.
 *
 * **Y no la del exterior a secas, aunque geométricamente debería bastar.** Un
 * hueco vive dentro del exterior, luego no puede ampliar su caja: cuando el
 * invariante geométrico se cumple —el caso normal, y el único que produce
 * `model/parcela.js`— esta unión devuelve EXACTAMENTE la caja del exterior, y
 * las tres comparaciones extra por hueco no cuestan nada medible. La diferencia
 * está en el caso que no se cumple. Desde F08 esta app lee GML que no ha escrito
 * ella, y un hueco que se sale del exterior es un fichero ajeno defectuoso, no
 * una imposibilidad: encuadrar solo por el exterior dejaría ese trozo fuera del
 * plano, en silencio y con la escala perfectamente rotulada. Como la unión no
 * puede dar un resultado peor que la alternativa en NINGÚN caso, no hay motivo
 * para dar por hecho lo que se puede comprobar gratis. Señalar que el hueco se
 * sale es trabajo de la validación (F02), no de esta función pura.
 *
 * @param {Array<{vertices: Array<[number, number]>, tipo: 'EXTERIOR'|'HUECO'}>} recintos
 *   No vacío; `recintos[0]` es el EXTERIOR y el resto HUECOS.
 * @returns {Bbox}  Metros UTM.
 * @throws {TypeError}  Si `recintos` no es un array, si algún recinto no es un
 *   objeto, si `recintos[0]` no es EXTERIOR, si algún `recintos[i≥1]` no es
 *   HUECO, o si algún anillo trae un vértice que no es un par finito.
 * @throws {RangeError}  Si `recintos` está vacío, o si algún anillo tiene menos
 *   de 3 vértices.
 */
export function bbox(recintos) {
  if (!Array.isArray(recintos)) {
    throw new TypeError(
      `bbox: se esperaba un array de recintos {vertices, tipo} en UTM; recibido ` +
        `${describir(recintos)}. Aquí no se devuelve el valor neutro que sí devuelven ` +
        'geo/area.js#superficie (0) o geo/metrica.js#perimetro ({0,0,0}): la envolvente de la ' +
        'nada no existe, y lo que se devolviera se acabaría dividiendo para sacar la escala.',
    )
  }
  if (recintos.length === 0) {
    throw new RangeError(
      'bbox: se esperaba al menos un recinto (el EXTERIOR) y ha llegado la lista vacía. ' +
        'Sobre el vacío no hay nada que encuadrar.',
    )
  }

  let caja = null
  for (let i = 0; i < recintos.length; i++) {
    exigirRecinto(recintos[i], i)
    const c = cajaDeAnillo(recintos[i].vertices, `bbox → recintos[${i}].vertices`)
    caja =
      caja === null
        ? c
        : {
            minX: Math.min(caja.minX, c.minX),
            minY: Math.min(caja.minY, c.minY),
            maxX: Math.max(caja.maxX, c.maxX),
            maxY: Math.max(caja.maxY, c.maxY),
          }
  }
  return caja
}

/**
 * Exige que `caja` sea una {@link Bbox} utilizable.
 *
 * @param {unknown} caja
 * @param {string} quien  Nombre de la función pública, para el mensaje.
 */
function exigirBbox(caja, quien) {
  if (caja === null || typeof caja !== 'object') {
    throw new TypeError(
      `${quien}: se esperaba una caja {minX, minY, maxX, maxY} en UTM, como la que devuelven ` +
        `bboxAnillo()/bbox(); recibido ${describir(caja)}.`,
    )
  }
  for (const clave of ['minX', 'minY', 'maxX', 'maxY']) {
    if (!Number.isFinite(caja[clave])) {
      throw new TypeError(
        `${quien}: 'bbox.${clave}' debe ser un número finito en metros UTM; recibido ` +
          `${String(caja[clave])}.`,
      )
    }
  }
  if (caja.minX > caja.maxX) {
    throw new RangeError(
      `${quien}: la caja viene INVERTIDA en X (minX=${caja.minX} > maxX=${caja.maxX}); se ` +
        'esperaba minX ≤ maxX. Una caja invertida dibuja el plano en espejo.',
    )
  }
  if (caja.minY > caja.maxY) {
    throw new RangeError(
      `${quien}: la caja viene INVERTIDA en Y (minY=${caja.minY} > maxY=${caja.maxY}); se ` +
        'esperaba minY ≤ maxY. Una caja invertida dibuja el plano en espejo.',
    )
  }
}

/**
 * La misma caja, crecida `metros` por los CUATRO lados: el aire que separa la
 * parcela del borde del papel para que se vea con qué linda.
 *
 * **`metros` no puede ser negativo.** Un margen negativo encoge la caja, y eso
 * es un recorte con otro nombre: dejaría lindero fuera del plano exactamente
 * igual que lo haría ajustar el ratio recortando, que es lo que este módulo
 * existe para no hacer. Para no dar margen se pasa `0`, que devuelve una caja
 * idéntica a la de entrada.
 *
 * @param {Bbox} caja  Caja de partida, en metros UTM.
 * @param {number} metros  Margen en METROS del terreno (no píxeles), ≥ 0.
 * @returns {Bbox}  Caja nueva; la de entrada no se toca.
 * @throws {TypeError}  Si `caja` no es una caja válida o `metros` no es un número.
 * @throws {RangeError}  Si la caja viene invertida, o si `metros` no es finito o es negativo.
 */
export function bboxConMargen(caja, metros) {
  exigirBbox(caja, 'bboxConMargen')
  if (typeof metros !== 'number') {
    throw new TypeError(
      `bboxConMargen: 'metros' debe ser un número de metros; recibido ${describir(metros)}.`,
    )
  }
  if (!Number.isFinite(metros)) {
    throw new RangeError(`bboxConMargen: 'metros' debe ser finito; recibido ${metros}.`)
  }
  if (metros < 0) {
    throw new RangeError(
      `bboxConMargen: 'metros' no puede ser negativo (recibido ${metros}): un margen negativo ` +
        'es un RECORTE con otro nombre y dejaría parcela fuera del plano. Para no dar margen, 0.',
    )
  }

  return {
    minX: caja.minX - metros,
    minY: caja.minY - metros,
    maxX: caja.maxX + metros,
    maxY: caja.maxY + metros,
  }
}

/**
 * La misma caja llevada al `ratio` pedido (`ancho/alto`, el del papel), CRECIENDO
 * el lado que se queda corto y dejando el otro como está. Nunca recorta, nunca
 * deforma, y el resultado queda centrado sobre la caja de entrada — de modo que
 * la caja original está siempre CONTENIDA en la devuelta.
 *
 * Las dos dimensiones se resuelven con `Math.max` y no con un `if/else`, y eso es
 * deliberado: `Math.max(ancho, alto·ratio)` y `Math.max(alto, ancho/ratio)`
 * seleccionan solas la única de las dos soluciones que crece (la otra encogería,
 * y perder es lo que `Math.max` no sabe hacer), así que «nunca recorta» deja de
 * ser una rama que hay que acertar y pasa a ser una propiedad de la expresión.
 * En el caso frontera —la caja YA tiene el ratio pedido— las dos expresiones
 * devuelven el lado original salvo por el ulp que se lleve el redondeo de
 * `alto·ratio`, y el `Math.max` lo absorbe en vez de recortar un nanómetro.
 *
 * PRECISIÓN — se reparte el CRECIMIENTO, no se recentra sobre el punto medio.
 * Lo natural sería `cx = (minX+maxX)/2` y devolver `cx ± ancho/2`, pero con
 * Norte ≈ 4·10⁶ ese camino pasa por dos redondeos y `cx − ancho/2` puede caer
 * unos ulp POR ENCIMA de `minX`: la caja de salida recortaría un nanómetro de
 * parcela y la aserción de contención fallaría por motivos que no tienen nada
 * que ver con la geometría. Restando el semicrecimiento (`minX − crecerX` con
 * `crecerX ≥ 0`) la contención está garantizada por IEEE-754 —restar una
 * cantidad no negativa nunca da un resultado mayor— y no por suerte.
 *
 * @param {Bbox} caja  Caja de partida, en metros UTM.
 * @param {number} ratio  `ancho/alto` del papel (p. ej. `W_px/H_px`), finito y > 0.
 * @returns {Bbox}  Caja nueva del ratio pedido; la de entrada no se toca.
 * @throws {TypeError}  Si `caja` no es una caja válida o `ratio` no es un número.
 * @throws {RangeError}  Si la caja viene invertida, si `ratio` no es finito o no
 *   es > 0, o si la caja no tiene NI ancho NI alto (es un punto).
 */
export function bboxAlRatio(caja, ratio) {
  exigirBbox(caja, 'bboxAlRatio')
  if (typeof ratio !== 'number') {
    throw new TypeError(
      `bboxAlRatio: 'ratio' debe ser un número (ancho/alto del papel); recibido ${describir(ratio)}.`,
    )
  }
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new RangeError(
      `bboxAlRatio: 'ratio' (= ancho/alto del papel) debe ser finito y mayor que 0; recibido ${ratio}.`,
    )
  }

  const ancho = caja.maxX - caja.minX
  const alto = caja.maxY - caja.minY
  if (ancho === 0 && alto === 0) {
    // Una caja con ancho 0 (o alto 0) sí se resuelve: se crece el lado nulo y
    // ya. Pero un PUNTO no tiene ningún lado del que deducir el otro, y darle
    // un tamaño sería inventárselo: el plano saldría a una escala que no viene
    // de la parcela. Que la parcela se haya quedado en un punto es una
    // degeneración que señala la validación (F02), no esta función.
    throw new RangeError(
      'bboxAlRatio: la caja no tiene ancho NI alto (es un punto), así que no hay lado del que ' +
        'deducir el otro. Crecer al ratio exigiría inventarse un tamaño y con él una escala.',
    )
  }

  const anchoFinal = Math.max(ancho, alto * ratio)
  const altoFinal = Math.max(alto, ancho / ratio)
  const crecerX = (anchoFinal - ancho) / 2
  const crecerY = (altoFinal - alto) / 2

  return {
    minX: caja.minX - crecerX,
    minY: caja.minY - crecerY,
    maxX: caja.maxX + crecerX,
    maxY: caja.maxY + crecerY,
  }
}
