// diagnostico/desviacion.js — F07 · Desviación máxima de lindero, ATRIBUIDA A UN LADO.
//
// La métrica de la tabla §10.1 que la spec nombra pero no define: «Desviación
// máxima de lindero — máxima entre linderos homólogos». Este fichero la define, y
// **no como la spec la enunciaba**. La desviación está razonada abajo entera
// porque es una decisión de diseño, no una traducción.
//
// ── QUÉ SE CALCULA ──────────────────────────────────────────────────────────
// Para cada LADO del contorno MEDIDO:
//   1. Se muestrea el lado: sus dos extremos SIEMPRE, más un punto cada
//      `pasoMetros` (`config/operativos.json#pasoDesviacionMetros`, 0,3 m).
//   2. De cada muestra se toma la distancia MÍNIMA al contorno oficial COMPLETO
//      —todos los lados de todos sus recintos, huecos incluidos—, no al lado
//      «que le toca».
//   3. La desviación del lado es el MÁXIMO de esos mínimos.
// Y `maxima` es la mayor de todas, con el lado que la produce y los dos puntos
// (el medido y su homólogo oficial) que la materializan.
//
// Máximo de MÍNIMOS, no media: la media de un lindero desplazado en un extremo y
// pegado en el otro sale pequeña y tranquilizadora, y lo que el técnico necesita
// saber es cuánto se separa el lindero DONDE MÁS se separa. Es la cifra que
// después se acota sobre el dibujo (§10.5).
//
// ── POR QUÉ NO ES «ENTRE LINDEROS HOMÓLOGOS» (desviación del enunciado) ─────
// Emparejar lindero medido ↔ lindero oficial 1 a 1 —lo que la spec dice
// literalmente— **deja de existir en cuanto F06 toca la geometría**: insertar un
// vértice en un lindero lo parte en dos y borrar uno funde dos en uno, así que la
// parcela editada y la oficial no tienen el mismo número de lados ni el mismo
// reparto. El emparejamiento pasa a ser 1↔N, N↔1 y con huérfanos por los dos
// lados, y habría que inventar qué se hace con ellos: descartarlos (perder
// justo el lindero nuevo, que es el que el usuario acaba de mover) o repartirlos
// por proximidad (que es exactamente lo que hace el mínimo al contorno completo,
// pero decidido a mano y sin criterio publicado). La formulación de aquí NO
// necesita emparejar nada y da el mismo número cuando la correspondencia sí es
// 1 a 1: en un lindero desplazado en paralelo, el mínimo al contorno completo ES
// la distancia al lindero homólogo.
//
// La otra alternativa —la distancia de Hausdorff global entre los dos
// contornos— da UNA cifra y ningún culpable, y §10.5 exige **resaltar en el
// dibujo el lindero de máxima desviación**: sin lado atribuible no hay nada que
// resaltar ni a dónde apuntar la línea guía. De ahí que el resultado venga
// desglosado `porLado` y que `maxima` sea LA MISMA entrada de esa lista (por
// identidad, ver el `@returns`) y no una copia: la capa de dibujo compara con
// `===` y sabe qué lado va resaltado.
//
// Lo que sí es, dicho con precisión: la distancia de Hausdorff **DIRIGIDA** de
// medido → oficial, desglosada por lado. Es ASIMÉTRICA a propósito. Si el
// contorno oficial tiene un entrante que el medido no tiene, esta métrica no lo
// ve (todas las muestras del medido pueden estar pegadas al oficial mientras el
// entrante oficial queda lejos de todo lo medido). No es un descuido: la
// pregunta de §10.5 es «cuánto se aparta MI lindero», y el objeto que se resalta
// y se acota es un lado NUESTRO. Quien necesite la simétrica llama dos veces con
// los argumentos cambiados; la asimetría queda declarada, no escondida.
//
// ── COTA DEL MUESTREO (lo que el paso de 0,3 m cuesta en exactitud) ─────────
// La función d(P) = distancia de P al contorno oficial es **1-Lipschitz** (es una
// distancia a un conjunto), y sobre un lado dos muestras consecutivas distan
// ≤ `pasoMetros`, luego todo punto del lado tiene una muestra a ≤ `pasoMetros`/2.
// Por tanto el máximo muestreado SUBESTIMA el máximo continuo en **≤ paso/2 =
// 0,15 m** con el paso por defecto. La cota es de peor caso y solo se acerca
// cuando el máximo está en un pico agudo entre dos muestras; en un lindero
// desplazado en paralelo —el caso normal— d(·) es casi constante a lo largo del
// lado y el error de muestreo es despreciable. Se escribe porque 0,15 m no es
// despreciable frente al margen de identidad de 0,50 m de urbana
// (`diagnostico/margen.js`): quien compare las dos cifras tiene que saber que una
// lleva esa cola. Bajar `pasoDesviacionMetros` la reduce proporcionalmente, al
// precio lineal de más muestras.
//
// ── EL COSTE, Y QUÉ SE HIZO CON ÉL ──────────────────────────────────────────
// El cálculo ingenuo es cuadrático: cada muestra contra CADA segmento oficial.
// En el techo de `maxVertices` (500) con lados del orden de 30 m —el caso que
// razona el JSDoc de `config/operativos.js`— son ~50.000 muestras × ≤500
// segmentos ≈ **25 millones de proyecciones punto-segmento**, y cada una de ellas
// además ASIGNA un objeto y un array (`proyectarEnSegmento` devuelve `{punto,
// t, distancia, enExtremo}`), así que el precio real no es aritmético sino de
// memoria: el recolector de basura acaba dominando.
//
// Se resuelve con dos descartes, ninguno de los cuales cambia el resultado —solo
// el orden y el número de proyecciones que llegan a hacerse:
//
//   1. **Caja envolvente dilatada por el mínimo en curso.** Un segmento oficial
//      no puede batir el mínimo `m` ya conseguido si la muestra queda fuera de su
//      caja envolvente dilatada en `m`: todo el segmento está dentro de su caja,
//      y si `px < xmin − m` entonces la distancia a cualquier punto del segmento
//      es > m. Son cuatro restas y cuatro comparaciones frente a una proyección
//      completa con su asignación.
//   2. **Coherencia espacial entre muestras consecutivas.** Se evalúa PRIMERO el
//      segmento que ganó la muestra anterior. Dos muestras consecutivas distan
//      `pasoMetros` (0,3 m), así que casi siempre les gana el mismo segmento: el
//      mínimo arranca ya AJUSTADO y el descarte 1 elimina el resto desde el
//      primer segmento en vez de ir estrechándose poco a poco.
//
// MEDIDO — anillo sintético de `maxVertices` = 500 vértices con lados de 30 m
// (perímetro 15,00 km) contra otro igual desplazado 0,40 m, en UTM real
// (x ≈ 373.000, y ≈ 4.070.000): **50.760 muestras** con el paso por defecto.
//   · ingenuo (cada muestra × cada segmento):  **25.380.000** proyecciones, ~1.160 ms
//   · solo el descarte 1 (caja, sin semilla):   **7.582.511** proyecciones,   ~410 ms
//   · los dos descartes:                            **52.352** proyecciones,    ~67 ms
//   ⇒ **×485 menos proyecciones y ×17 menos tiempo**, con resultado IDÉNTICO al
//     ingenuo (0 de diferencia en los 500 lados; el test lo comprueba contra la
//     implementación ingenua, no solo cronometra).
//
// Los dos números que hay que leer juntos: **1,03 proyecciones por muestra** con
// los dos descartes frente a **149,4** con la caja sola. La caja por sí misma
// apenas rasca ×3,3 porque arranca con el mínimo en `Infinity`: la caja dilatada
// por un mínimo enorme contiene todo, así que hasta que el mínimo se estrecha ya
// se han proyectado decenas de segmentos. **El descarte que de verdad funciona es
// la semilla**, y la caja es lo que la explota. Se dice porque el encargo pedía
// «descarte previo por caja envolvente» y la caja sola no resuelve el problema.
//
// Lo que NO desaparece: la pasada sobre los 500 segmentos sigue haciéndose para
// cada muestra, así que quedan ~25 millones de comparaciones de caja (cuatro
// restas cada una, ~2,7 ns) y ÉSAS son las que dominan los 67 ms. Bajar de ahí
// exigiría un índice espacial (rejilla o R-tree) sobre el contorno oficial, que
// convertiría el barrido en logarítmico. No se hace: 67 ms para una acción bajo
// demanda —el botón «Diagnosticar», no un fotograma— no justifica meter una
// estructura de datos nueva en un módulo puro de 40 líneas de cálculo. Queda
// dicho por si algún día el caso de uso cambia.
//
// El coste que SÍ sigue siendo proporcional es el número de muestras =
// perímetro / `pasoMetros`, y no está acotado por `maxVertices`: un solo vértice
// mal capturado (uno en el origen local mientras el resto está en UTM) crea un
// lado de ~4·10⁶ m y con él ~13 millones de muestras. No se trunca —truncar el
// muestreo de un lado largo devolvería una desviación menor que la real, y una
// desviación menor que la real es la clase de mentira tranquilizadora que este
// fichero evita en los lados cortos (ver abajo)—, pero se deja escrito: si el
// diagnóstico tarda una eternidad, la geometría tiene un vértice imposible y eso
// es lo que hay que mirar. Señalarlo es de F02.
//
// ── REGLAS DE ORO (SPEC §2) ─────────────────────────────────────────────────
//   · Regla 2 — `recintosOficiales` es el término de comparación y aquí solo se
//     LEE. Ni un array de salida comparte referencia con él: `enOficial` sale de
//     `proyectarEnSegmento`, que construye punto nuevo.
//   · Regla 6 — `turf.nearestPointOnLine`, `turf.distance` y `turf.length` están
//     PROHIBIDAS (son esféricas sobre grados). La proyección punto→segmento es
//     `geo/segmento.js` y la distancia es `geo/metrica.js`; aquí no se reescribe
//     ninguna fórmula métrica. Ni una línea de este fichero calcula una raíz.
//   · Regla 3 — todo en UTM y en metros, entrada y salida.
//   · Regla 4 — anillos ABIERTOS: el lado de cierre v[n−1]→v[0] NO está
//     materializado y lo genera el `% n`, igual que `geo/metrica.js`.
//   · Regla 9 — esto devuelve METROS y nada más. Ni `ok`, ni `dentroDeTolerancia`,
//     ni comparación con el margen de identidad (que es de `diagnostico/margen.js`,
//     enuncia y no compara). La app mide; el colegiado interpreta y firma.
//   · Regla 1, con la frontera de `geo/segmento.js` y de `edit/snap.js`:
//       · Contrato roto por el PROGRAMADOR (`recintos` que no es array, `opciones`
//         que no es objeto, `pasoMetros` ≤ 0 u olvidar el segundo argumento) →
//         `TypeError` nombrando el argumento y lo recibido.
//       · Dato GEOMÉTRICO degenerado (un anillo de menos de 3 vértices, un vértice
//         con NaN en el store) → NO lanza: ese lado simplemente no se mide, con el
//         MISMO criterio con que `edit/snap.js` no mete esa diana en el catálogo.
//         Es dato posible del usuario y quien lo señala es la validación (F02); que
//         un vértice roto impidiera diagnosticar el resto de la parcela sería un
//         fallo desproporcionado respecto a la causa. No desaparece en silencio: el
//         lado no medido no aparece en `porLado` —cuyas entradas se identifican por
//         `{recinto, indice}` explícito, no por posición— y `nMuestras` deja
//         constancia de cuánto se ha mirado de verdad.
//
// Módulo PURO: sin DOM, sin Leaflet, sin Turf, sin estado y sin reloj.

import { OPERATIVOS } from '../config/operativos.js'
import { distancia } from '../geo/metrica.js'
import { proyectarEnSegmento } from '../geo/segmento.js'
import { describir, exigirOpciones, exigirRecintos } from './_comun.js'

/**
 * @typedef {import('./_comun.js').Recinto} Recinto
 */

/**
 * Referencia a un LADO del modelo: `{recinto, indice}`, ambos 0-based.
 *
 * Tiene la misma FORMA que `RefVertice` (`validation/_comun.js`), y no es
 * casualidad: en un anillo ABIERTO el lado `i` va de `v[i]` a `v[(i+1) % n]`, así
 * que queda identificado sin ambigüedad por su vértice de arranque y las dos
 * referencias son intercambiables para la capa que resalta. Lo que cambia es qué
 * se resalta —un punto o un segmento—, y por eso se declara aparte en vez de
 * aliasar el typedef: un `{recinto: 0, indice: 14}` de aquí es el lado de cierre,
 * no el vértice 14.
 *
 * @typedef {Object} DesviacionDeLado
 * @property {number} recinto  Índice en `recintos` (0 = EXTERIOR, resto HUECOS).
 * @property {number} indice   Índice del lado: `v[indice]` → `v[(indice+1) % n]`.
 * @property {number} maxima   Desviación del lado en metros, ≥ 0. Máximo de los
 *   mínimos de sus muestras al contorno oficial completo.
 * @property {[number,number]} en  Punto del lado MEDIDO donde se alcanza, UTM.
 *   Es una muestra, así que puede caer entre dos vértices.
 * @property {[number,number]} enOficial  Su punto más próximo del contorno
 *   OFICIAL, UTM. El par `en`→`enOficial` ES el segmento que se acota en §10.5.
 */

/** True si `v` es un par `[x, y]` de números finitos. */
function esPar(v) {
  return Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1])
}

/**
 * Aplana los recintos en la lista de sus lados medibles, en orden de recinto y
 * dentro de cada recinto en orden de vértice (el último es el lado de cierre).
 *
 * **Los huecos entran igual que el exterior**: un patio también tiene lindero, y
 * un patio que se ha movido respecto al oficial es exactamente el tipo de
 * discrepancia que se diagnostica. Aquí no se distingue `tipo`, solo se anota de
 * qué recinto viene cada lado.
 *
 * Anillos de menos de 3 vértices: NINGÚN lado, mismo criterio que
 * `geo/metrica.js#longitudesDeLados` («un segmento no encierra nada» y el `% n`
 * recorrería el mismo tramo dos veces). Vértices no finitos: el lado que los toca
 * no entra (regla 1, ver cabecera).
 *
 * @param {Recinto[]} recintos
 * @returns {Array<{recinto: number, indice: number, A: [number,number], B: [number,number]}>}
 */
function ladosMedibles(recintos) {
  const lados = []
  for (let r = 0; r < recintos.length; r++) {
    const v = recintos[r] === null || typeof recintos[r] !== 'object' ? null : recintos[r].vertices
    if (!Array.isArray(v) || v.length < 3) continue
    const n = v.length
    for (let i = 0; i < n; i++) {
      const A = v[i]
      const B = v[(i + 1) % n]
      if (!esPar(A) || !esPar(B)) continue
      lados.push({ recinto: r, indice: i, A, B })
    }
  }
  return lados
}

/**
 * Los segmentos del contorno oficial COMPLETO, cada uno con su caja envolvente
 * ya calculada (el descarte 1 de la cabecera la consulta una vez por muestra y
 * por segmento; calcularla ahí serían cuatro `Math.min/max` por comparación).
 *
 * Los pares `[x,y]` se referencian, no se copian: de `recintosOficiales` solo se
 * lee (regla 2) y copiar 500 pares para leerlos sería trabajo inútil. Nada de lo
 * que sale de esta función acaba en el valor de retorno público.
 *
 * @param {Recinto[]} recintos
 * @returns {Array<{A: [number,number], B: [number,number], xmin: number, xmax: number, ymin: number, ymax: number}>}
 */
function segmentosDeContorno(recintos) {
  const segmentos = []
  for (const lado of ladosMedibles(recintos)) {
    const { A, B } = lado
    segmentos.push({
      A,
      B,
      xmin: A[0] < B[0] ? A[0] : B[0],
      xmax: A[0] > B[0] ? A[0] : B[0],
      ymin: A[1] < B[1] ? A[1] : B[1],
      ymax: A[1] > B[1] ? A[1] : B[1],
    })
  }
  return segmentos
}

/**
 * Punto más próximo del contorno oficial a la muestra `P`, con los dos descartes
 * de la cabecera. Devuelve TAMBIÉN el índice del segmento ganador, que es la
 * semilla del descarte 2 para la muestra siguiente.
 *
 * @param {[number,number]} P  Muestra, UTM.
 * @param {Array<{A: [number,number], B: [number,number], xmin: number, xmax: number, ymin: number, ymax: number}>} segmentos
 *   No vacío (lo garantiza el llamante).
 * @param {number} semilla  Índice del segmento que ganó la muestra anterior.
 * @returns {{distancia: number, punto: [number,number], indice: number}}
 */
function masCercanoDelContorno(P, segmentos, semilla) {
  const px = P[0]
  const py = P[1]

  // Descarte 2: el segmento heredado se proyecta SIN condición, para entrar en el
  // bucle con un mínimo ya ajustado. Con `mejor = Infinity` la caja dilatada no
  // descartaría nada hasta la primera proyección, y esa primera sería la del
  // segmento que la lista tenga en la posición 0 — que no tiene por qué estar
  // cerca de nada.
  const heredado = proyectarEnSegmento(P, segmentos[semilla].A, segmentos[semilla].B)
  let mejor = heredado.distancia
  let punto = heredado.punto
  let indice = semilla

  for (let j = 0; j < segmentos.length; j++) {
    if (j === semilla) continue
    const s = segmentos[j]
    // Descarte 1: fuera de la caja envolvente dilatada en `mejor` ⇒ imposible
    // batirlo. Cuatro restas contra una proyección con su asignación.
    if (px < s.xmin - mejor || px > s.xmax + mejor || py < s.ymin - mejor || py > s.ymax + mejor) {
      continue
    }
    const pr = proyectarEnSegmento(P, s.A, s.B)
    // `<` estricto: en un empate gana el PRIMERO, así el resultado no depende del
    // orden de recorrido más allá de lo que ya fija la lista de segmentos.
    if (pr.distancia < mejor) {
      mejor = pr.distancia
      punto = pr.punto
      indice = j
    }
  }

  return { distancia: mejor, punto, indice }
}

/**
 * Desviación máxima de lindero, lado a lado, entre el contorno MEDIDO y el
 * contorno OFICIAL (spec §10.1, «Desviación máxima de lindero»).
 *
 * La definición completa, con el porqué de cada decisión —máximo de mínimos, por
 * qué no se emparejan linderos homólogos, la asimetría, la cota `paso/2` del
 * muestreo y el coste— está en la cabecera de este fichero. Lo imprescindible
 * para llamarla:
 *
 *   · Se muestrea el lado MEDIDO, no el oficial, y **los dos extremos entran
 *     siempre**, aunque el lado sea más corto que `pasoMetros`. Un lado corto sin
 *     muestrear devolvería desviación 0, que no es «no se desvía» sino «no se ha
 *     mirado» — la mentira tranquilizadora que prohíbe la regla 1.
 *   · Los HUECOS cuentan como lados: un patio también tiene lindero.
 *   · Sin geometría oficial (`null`, `[]` o sin ningún anillo medible) no hay
 *     nada contra lo que medir: `maxima: null`, `porLado: []` y `nMuestras: 0`.
 *     `null` significa «no consta» y NUNCA «coinciden» — un 0 ahí diría que la
 *     parcela encaja perfectamente cuando lo cierto es que no hay parcelario con
 *     el que compararla (misma doctrina que `edit/metricas.js#deltaCatastral` y
 *     que `_comun.js#exigirNumeroONulo`).
 *
 * @param {Recinto[]} recintos  Contorno MEDIDO (la geometría editable). Se
 *   muestrean sus lados. `recintos[0]` es el EXTERIOR y el resto HUECOS, pero
 *   aquí ese invariante no se comprueba ni se usa: se miden todos igual.
 * @param {Recinto[]|null} recintosOficiales  Contorno OFICIAL intacto del WFS
 *   (regla 2: se LEE, no se toca). `null` = no consta —lo normal en un DXF, un
 *   TXT o un contorno dibujado a mano—. OMITIRLO, en cambio, es un bug y lanza:
 *   «no hay oficial» hay que decirlo, no dejarlo en blanco.
 * @param {{pasoMetros?: number}} [opciones]
 * @param {number} [opciones.pasoMetros=OPERATIVOS.pasoDesviacionMetros]  Paso de
 *   muestreo en METROS SOBRE EL TERRENO, > 0. Por defecto
 *   `config/operativos.json#pasoDesviacionMetros` (0,3 m); el 0,3 no se escribe a
 *   mano en ninguna línea de este fichero.
 * @returns {{
 *   porLado: DesviacionDeLado[],
 *   maxima: DesviacionDeLado|null,
 *   nMuestras: number,
 * }}
 *   `porLado` en orden de recinto y de vértice, solo con los lados que se han
 *   podido medir. `maxima` es **la misma entrada** de `porLado` (identidad, no
 *   copia): la capa de dibujo puede hacer `lado === resultado.maxima` para saber
 *   cuál resalta, y no hay dos cifras que puedan divergir. En un empate gana el
 *   primero en ese orden. `nMuestras` es el total de muestras tomadas: la
 *   constancia de cuánto se ha mirado de verdad.
 * @throws {TypeError} Si `recintos` o `recintosOficiales` no son un array (ni
 *   `null` el segundo), si `opciones` no es un objeto, o si `pasoMetros` no es un
 *   número finito > 0.
 */
export function desviacionPorLado(recintos, recintosOficiales, opciones = {}) {
  exigirRecintos(recintos, 'desviacionPorLado')
  if (recintosOficiales !== null) {
    exigirRecintos(recintosOficiales, 'desviacionPorLado', 'recintosOficiales')
  }
  exigirOpciones(opciones, 'desviacionPorLado', 'un objeto de opciones {pasoMetros}')

  const { pasoMetros = OPERATIVOS.pasoDesviacionMetros } = opciones
  if (!Number.isFinite(pasoMetros) || pasoMetros <= 0) {
    throw new TypeError(
      `desviacionPorLado: 'pasoMetros' debe ser un número finito > 0 (metros sobre ` +
        `el terreno); recibido ${describir(pasoMetros)}.`,
    )
  }

  const oficiales = recintosOficiales === null ? [] : segmentosDeContorno(recintosOficiales)
  // Sin contorno oficial no hay medida posible, y la respuesta honesta es «no
  // consta», no un cero. Se sale antes de muestrear: muestrear para no comparar
  // con nada sería trabajo tirado y `nMuestras` mentiría diciendo que se miró.
  if (oficiales.length === 0) return { porLado: [], maxima: null, nMuestras: 0 }

  const porLado = []
  let maxima = null
  let nMuestras = 0
  // Semilla del descarte 2. Arranca en 0 y a partir de la segunda muestra es
  // siempre el segmento que ganó la anterior — incluso cruzando de un lado al
  // siguiente, que empieza donde acabó el anterior.
  let semilla = 0

  for (const lado of ladosMedibles(recintos)) {
    const { A, B } = lado
    const dx = B[0] - A[0]
    const dy = B[1] - A[1]

    // `Math.max(1, …)`: garantiza los DOS extremos aunque el lado sea más corto
    // que el paso (con 1 intervalo salen las muestras t=0 y t=1). Un lado
    // degenerado (A ≡ B) da también dos muestras, ambas en A: cuesta una
    // proyección de más y mantiene la regla «los extremos siempre» sin excepción.
    const nIntervalos = Math.max(1, Math.ceil(distancia(A, B) / pasoMetros))

    let mejor = -Infinity
    let en = null
    let enOficial = null

    for (let k = 0; k <= nIntervalos; k++) {
      const t = k / nIntervalos
      // Interpolación sobre las DIFERENCIAS dx, dy (metros), no sobre las
      // coordenadas absolutas: es el mismo motivo por el que `geo/metrica.js` no
      // necesita trasladar a origen local (regla 5). t ∈ [0,1] exacto en los
      // extremos, así que la muestra k=0 es A y la k=nIntervalos es B, bit a bit.
      const P = [A[0] + t * dx, A[1] + t * dy]
      nMuestras++

      const cerca = masCercanoDelContorno(P, oficiales, semilla)
      semilla = cerca.indice
      if (cerca.distancia > mejor) {
        mejor = cerca.distancia
        en = P
        enOficial = cerca.punto
      }
    }

    const entrada = { recinto: lado.recinto, indice: lado.indice, maxima: mejor, en, enOficial }
    porLado.push(entrada)
    if (maxima === null || entrada.maxima > maxima.maxima) maxima = entrada
  }

  return { porLado, maxima, nMuestras }
}
