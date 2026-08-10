// diagnostico/topologia.js — F07 · El SOLAPE y la INVASIÓN (único fichero de F07 con Turf).
//
// Contrato:
//   · `solape(recintosA, recintosB) → {area, piezas, nPiezas, saltados}`
//   · `invasiones(recintos, vecinas) → {invasiones, descartadas, saltados}`
//
// Es el ÚNICO módulo de la capa `diagnostico/` que importa Turf, igual que
// `validation/reglas-topologia.js` lo es de la capa de validación y por el mismo
// motivo (regla de oro 6: de Turf, SOLO lo topológico, y por SUBPAQUETE
// —`@turf/intersect`—, nunca el meta-paquete). Todo lo demás que F07 calcula
// —diferencias de superficie, centroides, desviación de linderos, las tres
// bandas— es aritmética propia y no pasa por aquí. Concentrar la dependencia en
// un fichero es lo que permite que el guardián de la capa sea una sola línea de
// regex en vez de una lista de excepciones.
//
// ── POR QUÉ `turf.area` ESTÁ PROHIBIDA, Y POR QUÉ AQUÍ IMPORTA MÁS QUE EN NINGÚN
//    OTRO SITIO ─────────────────────────────────────────────────────────────────
// La regla de oro 5 la prohíbe en todo el proyecto: `turf.area` mide sobre una
// ESFERA interpretando las coordenadas como grados de longitud/latitud, y aquí las
// coordenadas son metros UTM. Pero el motivo por el que la prohibición es CRÍTICA
// en este fichero es otro, y es el peor de los dos.
//
// Si alguien «arreglara» el desajuste reproyectando a lat/lon para poder llamar a
// `turf.area`, el número que saldría NO sería absurdo: sería el área GEODÉSICA de
// la parcela, y difiere del área sobre la PROYECCIÓN en el cuadrado del factor de
// escala k. Estimación de orden de magnitud para la parcela del fixture
// (x ≈ 439 281, o sea ~61 km al OESTE del meridiano central del huso 30):
// k ≈ k₀·(1 + x′²/2R²) ≈ 0,9996 · 1,000045 ≈ 0,99965, luego 1 − k² ≈ 7,1·10⁻⁴, que
// sobre 1 535,87 m² son **del orden de 1,1 m² de diferencia**. Esa cifra es
// exactamente del tamaño de las discrepancias que F07 existe para MEDIR: entraría
// en el informe como «diferencia con el parcelario» y nadie la distinguiría de una
// real. Un número plausible y equivocado es peor que una excepción, porque la
// excepción se arregla y el número se firma. (Y el Catastro define la superficie
// SOBRE LA PROYECCIÓN, sin corregir por k — lo dice `geo/area.js` en su cabecera:
// la geodésica no es «la buena», es OTRA magnitud.)
//
// De ahí el camino que sigue este módulo para medir, que es el único admisible:
// `intersect` devuelve GEOMETRÍA, esa geometría se traduce al modelo con
// `geo/poligono.js#recintosDeGeometriaTurf` y se mide con `geo/area.js#superficie`
// —el shoelace canónico del proyecto, con su traslación a origen local—. La
// aritmética del área no se reimplementa aquí ni se le pregunta a Turf.
//
// ── `MultiPolygon` ES EL CASO NORMAL, NO EL RARO ──────────────────────────────
// Dos linderos que se cruzan más de una vez dan varios solapes DISJUNTOS, y Turf
// los devuelve como `MultiPolygon`. No es una patología: es la forma habitual de
// una invasión cuando el lindero medido serpentea sobre el catastral. Por eso el
// área es la SUMA sobre todas las piezas (quedarse con una sería el error que
// `geo/poligono.js` documenta en su cabecera: 12 m² presentados como 7 m²), y por
// eso `nPiezas` viaja en el retorno aunque `piezas.length` esté ahí: una invasión
// de 6 m² en TRES trozos y una de 6 m² en uno solo son hechos distintos sobre el
// terreno —tres puntos de conflicto frente a uno— y el consumidor no debería tener
// que deducirlo contando.
//
// ── LOS HUECOS VAN COMO ANILLOS INTERIORES ───────────────────────────────────
// La región de una parcela con patio es EXTERIOR MENOS HUECO, así que el polígono
// que se le pasa a Turf lleva sus huecos como anillos interiores. Es lo mismo que
// afirma `geo/area.js#superficie` (S = |A_ext| − Σ|A_hueco|), y la alternativa
// —mandar solo el exterior— haría que un solape que cae íntegramente dentro del
// patio del vecino se contara como invasión de terreno que no es suyo.
//
// Esto es una ASIMETRÍA DELIBERADA con `geo/poligono.js#coordsPoligono`, que
// construye a propósito un polígono de UN solo anillo por recinto. No se
// contradicen: allí la pregunta es «¿este hueco concreto está mal?» y hay que
// poder NOMBRARLO (F02 comprueba cada hueco contra el exterior y contra los otros
// huecos); aquí la pregunta es «¿cuánta superficie comparten estas dos parcelas?»
// y el patio no es superficie de la parcela. Dos preguntas distintas, dos formas
// distintas del mismo dato; por eso los anillos se montan aquí con `anilloCerrado`
// en vez de reutilizar `coordsPoligono`.
//
// MEDIDO (2026-07-29, Turf 7.3.5): el motor de las booleanas trata los anillos 2ª
// y siguientes como HUECOS sea cual sea su sentido de giro —comprobado con el
// exterior HORARIO, que es como lo emite el WFS del Catastro (override O1)—, así
// que aquí NO se reorienta nada, coherente con `geo/poligono.js`. Y un polígono
// contenido ENTERAMENTE en el hueco del otro da `null`, que es la respuesta
// correcta.
//
// ── RECINTOS NO APTOS: SE SALTAN POR CONTEO, Y SE DICE ───────────────────────
// `polygon()` de @turf/helpers rechaza un anillo con menos de 4 posiciones
// cerradas, o sea menos de 3 vértices abiertos. Esos recintos se GUARDAN por
// CONTEO ESTRUCTURAL y se saltan, sin `try/catch`, exactamente como en
// `validation/reglas-topologia.js#esRecintoApto`: el guardado es estructural
// porque la condición se conoce antes de llamar, y un `try/catch` alrededor de
// Turf taparía además cualquier OTRO fallo suyo. Detectar la degeneración no es de
// esta tarea (es F02 `reglas-geometria`), medir el encaje sí.
//
// Lo que NO se hereda de allí es el silencio. En F02 saltarse un recinto es mudo
// porque otra regla de la MISMA llamada ya emite su Hallazgo; aquí no hay tal
// regla, y devolver `area: 0` cuando lo cierto es «no se ha podido medir» sería el
// error silencioso que prohíbe la regla de oro 1 —y el peor de todos, porque 0
// tranquiliza—. Así que todo recinto saltado sale en `saltados` con su sitio, su
// número de vértices y su motivo. Es un DESVÍO del contrato que fijó el plan
// (`{area, piezas, nPiezas}`), y está en el informe de la tarea.
//
// ── ESTA CAPA **NO** FILTRA LA PROPIA PARCELA ────────────────────────────────
// `invasiones` compara la geometría contra TODAS las vecinas que le pasen, sin
// mirar refcats. Filtrar es del llamante (el cableado de F07), y no por pereza:
// override **O15** (MEDIDO 2026-07-28) dice que la consulta `GetNeighbourParcel`
// del WFS **devuelve también la propia parcela, en 2.ª posición**. Quien construya
// las `Vecina[]` a partir de esa respuesta y no la quite obtendrá una «invasión»
// del 100 % de su superficie contra sí misma. Aquí no se filtra porque esta capa
// no sabe QUIÉN es la parcela propia —recibe `recintos`, que es geometría sin
// nombre, precisamente para poder diagnosticar también un GML que el usuario
// suelta encima (F08)—, y adivinarlo comparando geometrías sería inventar una
// heurística donde el llamante tiene el dato. `test/diagnostico/topologia.test.js`
// deja ese comportamiento FIJADO con un test, para que si alguien lo olvida el
// rojo caiga en el cableado y no aquí.
//
// ── LA GEOMETRÍA OFICIAL NO SE TOCA (regla de oro 2) ─────────────────────────
// MEDIDO en la fase 1: `polygon()` guarda el array de coordenadas que se le pasa
// **POR REFERENCIA**, sin copiarlo — `pol.geometry.coordinates[0] === anillo` es
// `true`. Pasarle vértices del modelo sin copia intermedia le daría a Turf una
// referencia VIVA a `geometriaOficial`. No ocurre porque todos los anillos se
// construyen con `geo/poligono.js#anilloCerrado`, que devuelve copia SIEMPRE
// (también cuando el anillo ya venía cerrado). Esa copia no es un gasto que
// ahorrar: es la regla de oro 2. Un test compara las entradas con un clon.
//
// ── ⚠️ Turf 7.3.5, VERIFICADO ────────────────────────────────────────────────
// `intersect` recibe un **FeatureCollection de DOS polígonos** →
// `intersect(featureCollection([polA, polB]))`. La forma de dos argumentos LANZA
// «Must specify at least 2 geometries» (ya escrito en
// `validation/reglas-topologia.js:13-16`). Devuelve un `Feature` o `null`, y las
// dos formas las digiere `recintosDeGeometriaTurf` sin adaptador.
//
// MEDIDO (2026-07-29): `intersect` devuelve **`null`** en los cuatro casos de
// «sin superficie común» —parcelas disjuntas, lindero ENTERO compartido, lindero
// PARCIALMENTE compartido y contacto en una sola ESQUINA—. Confirma lo que
// afirmaba `reglas-topologia.js` («tocarse en un borde da null»). Consecuencia
// para el diagnóstico: **dos parcelas que comparten lindero no producen hallazgo
// alguno**, que es lo que tiene que pasar.
//
// Y una advertencia que también es de la fase 1: `multiPolygon()` de Turf NO
// valida NADA (ni longitud de anillo ni cierre), al contrario que `polygon()`. Una
// geometría que sale de una booleana no ha pasado ninguna comprobación de forma,
// así que validarla al traducirla NO es redundante: `recintosDeGeometriaTurf`
// lanza ante un anillo degenerado y aquí se deja lanzar (contrato roto por el
// PROGRAMA, no dato del usuario).
//
// ── 🔻 HALLAZGO PARA LA SPEC (MEDIDO 2026-07-29) ─────────────────────────────
// Sobre el fixture REAL (`test/fixtures/catastro/wfs-neighbour-9398516VK3799G.xml`,
// la parcela oficial contra sus cuatro colindantes oficiales, sin editar nada) el
// reparto medido es:
//   · 9398517VK3799G y 9398515VK3799G → `null`: no comparten superficie.
//   · 9398501VK3799G → 1,2292·10⁻⁴ m² (≈ 1,23 cm²)
//   · 9398518VK3799G → 3,7708·10⁻⁴ m² (≈ 3,77 cm²)
// Las dos últimas son astillas de un lindero compartido, y su forma lo delata: un
// TRIÁNGULO de tres puntos casi colineales, de 1,7 m de base y 0,14 mm de altura,
// que aparece porque la vecina subdivide el lindero con un vértice más que la
// propia no tiene y que, redondeado a la rejilla de 1 cm del WFS (regla de oro 11),
// cae unas décimas de milímetro al otro lado de la recta.
//
// **Las dos SUPERABAN el `areaInvasionMinimaM2` (10⁻⁴ m² = 1 cm²) con el que nació
// esta fase, así que salían como INVASIÓN**: la parcela oficial «invadía» a dos de
// sus cuatro colindantes oficiales sin que nadie hubiera tocado un vértice. El
// falso positivo exacto que la clave existía para evitar, y en el único sitio donde
// la regla de oro 9 admite ámbar.
//
// La causa era la calibración, no la medida: aquella cifra suponía la astilla
// CUADRADA (el paso de cuantización al cuadrado, (10⁻² m)² = 10⁻⁴ m²), y la astilla
// es una AGUJA, con área `≈ ½·L·δ` — que crece con la LONGITUD del lindero
// compartido, así que ningún umbral de área vale para todos los linderos.
//
// **Cerrado el 2026-07-29 sustituyendo el filtro de ÁREA por uno de GROSOR**
// (`OPERATIVOS.grosorInvasionMinimoM`). El grosor no depende de `L`, que es lo que
// ningún umbral de área puede prometer. La estimación vive en
// **`geo/grosor.js#medirPieza`** desde F17 (aquí era privada), y el JSDoc de
// `config/operativos.js` explica por qué un umbral de área se acercaba a un
// veredicto y uno de grosor no.
//
// ── ⛔ EL CRITERIO ERA BUENO Y EL VALOR ESTABA MAL (MEDIDO 2026-08-10) ────────
// Aquel umbral se fijó en **1 mm** copiando `duplicadoMetros`, y la cabecera lo
// defendía así: «una pieza más delgada que la distancia a la que dos puntos son el
// mismo punto está entre dos linderos que son el mismo lindero». Suena bien y mezcla
// dos cosas que no tienen nada que ver: `duplicadoMetros` describe **nuestro
// modelo**, y lo que aquí hay que absorber es el ruido de **otro** —el redondeo al
// centímetro con el que el WFS publica—. Que los dos números coincidieran fue el
// accidente que impidió ver el error durante un año.
//
// La calibración venía además de UNA muestra: la aguja de 0,14 mm de altura del
// fixture de arriba. Remedido sobre **554 parcelas oficiales de diez provincias
// (15.501 pares, sin editar un vértice)**: 64 piezas de solape, de las cuales 41 son
// agujas de redondeo de entre 0,071 mm y 5 mm de grosor. **34 de ellas superaban el
// milímetro y salían anunciadas como «Invasión a colindantes».**
//
// La aguja no aparece solo cuando las dos parcelas discrepan: aparece cuando **la
// vecina SUBDIVIDE el lindero compartido con un vértice que la propia no tiene**.
// Los dos extremos del tramo son el mismo punto en las dos —medido: idénticos—, pero
// el vértice de en medio, redondeado a la celda de 1 cm, cae fuera de la recta que
// esos extremos definen. Ejemplo real (29050A01000124 × 29050A01000142): extremos
// `388656.22 4082370.60` y `388675.83 4082373.66` en las dos; la segunda añade
// `388669.14 4082372.62`, que sobre la recta valdría `4082372.61607`. **3,93 mm
// fuera** —dentro del medio centímetro que el redondeo permite—, y una aguja de
// 0,0385 m² y 1,94 mm de grosor. Está fijado en `test/diagnostico/topologia.test.js`
// con esas coordenadas, que no son un ejemplo: son las que publica el servicio.
//
// El techo del fenómeno no es una observación, es aritmética: redondear a la celda
// de 1 cm mueve un punto hasta media diagonal (√2/2 cm = 7,07 mm), las dos parcelas
// se redondean por separado ⇒ hasta 1,41 cm entre las dos versiones del lindero, y
// `2A/P` de una aguja vale `≈ h/2` ⇒ **7,07 mm de techo en la unidad con la que se
// compara**. Que es, exactamente, el `comprobacion/conjunto.js#GROSOR_REDONDEO_M`
// que F17 ya había derivado para el mismo redondeo, y que aquella cabecera declaró
// —por escrito y sin medirlo— que aquí no aplicaba. Sí aplicaba.
//
// ⛔ **Y el límite conocido que esta cabecera declaraba estaba AL REVÉS**, medido al
// extraer la función (F17): decía que una pieza anular se subestima y podría
// descartarse. Un anillo de grosor UNIFORME se mide **exactamente** (`2A/P = h`, sin
// aproximar y a cualquier grosor); lo que falla es el anillo NO uniforme, que
// **SOBREestima el lado fino** —medido: 25 m declarados con un lado de 1 m—. No
// descarta de más: **admite de más**. Detalle y cifras en `geo/grosor.js`.
//
// Módulo PURO: sin DOM, sin Leaflet, sin estado, sin reloj. No entra en el barrel.

import intersect from '@turf/intersect'
import { featureCollection, polygon } from '@turf/helpers'

import { OPERATIVOS } from '../config/operativos.js'
import { superficie } from '../geo/area.js'
import { perimetro } from '../geo/metrica.js'
import { medirPieza } from '../geo/grosor.js'
import { MOTIVO_REGION, coordsRegion, recintosDeGeometriaTurf } from '../geo/poligono.js'
import { describir, exigirRecintos } from './_comun.js'

/** @typedef {import('./_comun.js').Recinto} Recinto */
/** @typedef {import('./_comun.js').Vecina} Vecina */

/**
 * Por qué un recinto se quedó fuera de la medición. Los tres valores posibles de
 * `saltados[i].motivo`, escritos aquí y no repartidos por el código:
 *   · `SIN_RECINTOS`     — la lista venía vacía: no hay región que intersecar.
 *   · `EXTERIOR_NO_APTO` — `recintos[0]` no forma anillo (< 3 vértices). Sin
 *     exterior no hay región: los huecos, solos, no la definen (tomar el primer
 *     hueco como exterior mediría el patio en vez de la parcela).
 *   · `HUECO_NO_APTO`    — un hueco no forma anillo. La región se mide SIN él, así
 *     que el área sale por EXCESO en la superficie de ese hueco.
 *
 * ⚠️ **Los tres valores y el conteo se mudaron a `geo/poligono.js` en F17** (tarea
 * 1.1): la derivación del sobrante necesita el mismo puente recintos → región y
 * duplicarlo habría dado dos definiciones de qué es la región de una parcela. Los
 * literales NO cambian —son contrato de esta capa desde F07— y este alias los
 * mantiene visibles con el nombre con el que este fichero los venía usando.
 */
const MOTIVO = MOTIVO_REGION

/**
 * Un recinto saltado, con su sitio para que se pueda NOMBRAR en la interfaz.
 * Definido en `geo/poligono.js` desde F17; el tipo se reexporta aquí para que los
 * JSDoc de este módulo sigan leyéndose solos.
 *
 * @typedef {import('../geo/poligono.js').RecintoSaltado} RecintoSaltado
 */

/**
 * La REGIÓN de unos recintos como polígono de Turf: exterior más sus huecos como
 * anillos interiores (ver «los huecos van como anillos interiores» en la
 * cabecera). Los anillos se cierran con `anilloCerrado`, que copia siempre ⇒ Turf
 * nunca recibe una referencia viva a la geometría del modelo (regla de oro 2).
 *
 * @param {Recinto[]} recintos  Recintos del modelo, anillos ABIERTOS en UTM.
 * @param {string} donde  Nombre del argumento, para poblar `saltados`.
 * @param {RecintoSaltado[]} saltados  Acumulador; se le AÑADE lo que se salte.
 * @returns {object|null}  `Feature<Polygon>` de Turf, o `null` si no hay región
 *   medible (y entonces el motivo ya está en `saltados`).
 */
function poligonoDeRegion(recintos, donde, saltados) {
  // Las coordenadas y el conteo de lo saltado los pone `geo/poligono.js`; lo único
  // que queda aquí es el `polygon(...)`, que es el import de Turf de esta capa y no
  // baja a `geo/` (su cabecera lo dice: prepara coordenadas, no llama a la librería).
  const { anillos, saltados: nuevos } = coordsRegion(recintos, donde)
  saltados.push(...nuevos)
  return anillos === null ? null : polygon(anillos)
}

/**
 * La intersección de dos regiones ya en forma de polígono de Turf, medida con la
 * aritmética del proyecto. Aquí es donde se cumple —o se rompe— la regla de oro 5:
 * el área NO la da Turf, la da `geo/area.js#superficie` sobre cada pieza
 * traducida, y se SUMAN.
 *
 * @param {object} polA
 * @param {object} polB
 * @returns {{area: number, piezas: Array<Recinto[]>, nPiezas: number}}
 */
function interseccionMedida(polA, polB) {
  // La forma de DOS ARGUMENTOS lanza: `intersect` quiere un FeatureCollection.
  const resultado = intersect(featureCollection([polA, polB]))
  // `null` (no se tocan) y `Feature` los digiere igual; un anillo degenerado en la
  // salida de la booleana LANZA, y se deja lanzar (contrato roto por el PROGRAMA).
  const piezas = recintosDeGeometriaTurf(resultado)
  let total = 0
  for (const pieza of piezas) total += superficie(pieza)
  return { area: total, piezas, nPiezas: piezas.length }
}

/**
 * ⭐ `medirPieza` VIVE EN `geo/grosor.js` DESDE F17 (tarea 1.1), y no es un
 * traslado de conveniencia: la derivación del sobrante necesita exactamente la
 * misma aritmética para decidir si un trozo es una cesión o una astilla, y dos
 * copias serían dos definiciones de «astilla» libres de divergir en el primer
 * ajuste. Allí está también el razonamiento completo de por qué `2A/P` y cuál es
 * su límite conocido — que con F17 deja de ser hipotético, porque el sobrante
 * ANULAR es un caso normal (y sale medido bien: para un anillo delgado `2A/P = h`
 * exactamente).
 *
 * El umbral con el que se compara sigue siendo de esta capa
 * (`OPERATIVOS.grosorInvasionMinimoM`): `geo/` mide, quien descarta es el llamante.
 */

/**
 * Superficie COMÚN a dos regiones (la métrica «Solape» de la spec, §10.1).
 *
 * Simétrica: `solape(a, b)` y `solape(b, a)` miden lo mismo (salvo el ruido de
 * float64 de la propia booleana, del orden de 10⁻¹² sobre miles de m²). El
 * porcentaje de solape —sobre la MAYOR de las dos superficies— no se calcula aquí:
 * es una razón entre magnitudes que el llamante ya tiene medidas, y devolverla
 * obligaría a este módulo a saber cuál es «la mayor», que es una decisión de
 * presentación.
 *
 * Sin superficie común devuelve `{area: 0, piezas: [], nPiezas: 0}` — el caso
 * NORMAL entre dos vecinas que solo comparten lindero, medido: `intersect` da
 * `null` tanto si son disjuntas como si el lindero coincide entero, en parte o en
 * una esquina.
 *
 * @param {Recinto[]} recintosA  Región A (p. ej. la parcela medida). Anillos
 *   ABIERTOS en UTM; `recintosA[0]` es el EXTERIOR y el resto HUECOS.
 * @param {Recinto[]} recintosB  Región B (p. ej. `geometriaOficial`). No se muta.
 * @returns {{area: number, piezas: Array<Recinto[]>, nPiezas: number,
 *   saltados: RecintoSaltado[]}}
 *   `area` en m² por `geo/area.js#superficie`, sumada sobre TODAS las piezas.
 *   `piezas` es una lista de `recintos` del modelo, una por pieza disjunta (ver
 *   `geo/poligono.js`), lista para pintarse. `saltados` va vacío en el caso normal.
 * @throws {TypeError} Si `recintosA`/`recintosB` no son arrays (bug del llamante),
 *   o si la geometría que devuelve la booleana viene mal formada.
 */
export function solape(recintosA, recintosB) {
  exigirRecintos(recintosA, 'solape', 'recintosA')
  exigirRecintos(recintosB, 'solape', 'recintosB')

  /** @type {RecintoSaltado[]} */
  const saltados = []
  const polA = poligonoDeRegion(recintosA, 'recintosA', saltados)
  const polB = poligonoDeRegion(recintosB, 'recintosB', saltados)

  // Sin una de las dos regiones no hay nada que intersecar. Se devuelve 0 —no hay
  // otro número honesto— pero `saltados` dice POR QUÉ, que es la diferencia entre
  // «no se solapan» y «no se ha podido medir» (regla de oro 1).
  if (polA === null || polB === null) return { area: 0, piezas: [], nPiezas: 0, saltados }

  return { ...interseccionMedida(polA, polB), saltados }
}

/**
 * Contrato del llamante para UNA vecina. LANZA: una `Vecina` mal formada es un bug
 * del cableado, no un dato del usuario.
 *
 * **Un `ParcelaGml` crudo PASARÍA estas guardas**, y se dice en vez de fingir lo
 * contrario: tiene `refcat` y `recintos`, así que es un superconjunto estructural
 * de `Vecina` y ninguna comprobación razonable lo distingue (rechazar objetos con
 * campos de más sería hostil y frágil). La regla «vecinas nunca son `ParcelaGml`
 * crudo» es ARQUITECTÓNICA —traducir en la frontera es lo que mantiene
 * `diagnostico/` ciego a si el dato vino del WFS (F07) o de un fichero que el
 * usuario soltó encima (F08)—, y se sostiene en la revisión del cableado, no aquí.
 *
 * @param {unknown} vecina
 * @param {number} i  Su índice, para el mensaje.
 */
function exigirVecina(vecina, i) {
  if (vecina === null || typeof vecina !== 'object' || Array.isArray(vecina)) {
    throw new TypeError(
      `invasiones: 'vecinas[${i}]' debe ser un objeto {refcat, recintos}; ` +
        `recibido ${describir(vecina)}.`,
    )
  }
  if (vecina.refcat !== null && typeof vecina.refcat !== 'string') {
    throw new TypeError(
      `invasiones: 'vecinas[${i}].refcat' debe ser una referencia catastral (string) o null ` +
        `(null = no consta); recibido ${describir(vecina.refcat)}.`,
    )
  }
  exigirRecintos(vecina.recintos, 'invasiones', `vecinas[${i}].recintos`)
}

/**
 * Invasión a colindantes (spec §10.4): con qué vecinas comparte superficie la
 * región dada, y cuánta.
 *
 * Es la ÚNICA comprobación de F07 de naturaleza binaria —hay invasión o no la
 * hay—, y la única excepción a la regla de oro 9: aquí sí cabe el ámbar, porque la
 * consecuencia es fija (el expediente se rechaza salvo que se modifique la
 * vecina). Aun así este módulo **no valora nada**: devuelve superficies y piezas.
 *
 * **No filtra la propia parcela** (override O15) — ver la cabecera del fichero.
 *
 * Una vecina que no comparte superficie NO genera entrada en ninguna de las dos
 * listas: no es un hallazgo, es el caso normal entre colindantes.
 *
 * @param {Recinto[]} recintos  La región cuya invasión se busca (la parcela
 *   medida). No se muta.
 * @param {Vecina[]} vecinas  `[{refcat, recintos}]`. **Nunca `ParcelaGml` crudo**
 *   (ver `exigirVecina`). No se mutan.
 * @returns {{invasiones: Array<{refcat: string|null, area: number,
 *   piezas: Array<Recinto[]>}>, descartadas: Array<{refcat: string|null,
 *   area: number, grosor: number, nPiezas: number}>, saltados: RecintoSaltado[]}}
 *   `invasiones`: las vecinas con al menos una pieza de grosor
 *   `≥ OPERATIVOS.grosorInvasionMinimoM`, en el ORDEN de `vecinas` (no ordenadas por
 *   área: ordenar es de quien presenta). `area` suma **solo las piezas que cuentan**.
 *   `descartadas`: las vecinas con al menos una pieza por debajo de ese grosor, con
 *   el área sumada de esas piezas, el grosor de la MAYOR de ellas y cuántas son. No
 *   se tiran en silencio (regla de oro 1): son astillas de redondeo en un lindero
 *   compartido, y quien desconfíe del umbral tiene las dos cifras para comprobarlo.
 *   **Una misma vecina puede aparecer en las DOS listas** —una invasión real en un
 *   tramo y una astilla en otro del mismo lindero— y es información, no un error:
 *   por eso el filtro es por pieza y no por vecina.
 * @throws {TypeError} Si `recintos` o `vecinas` no son arrays, o si alguna vecina
 *   está mal formada. Se validan TODAS las vecinas ANTES de medir ninguna: un
 *   resultado a medias con una excepción encima es peor que una excepción limpia.
 */
export function invasiones(recintos, vecinas) {
  exigirRecintos(recintos, 'invasiones')
  if (!Array.isArray(vecinas)) {
    throw new TypeError(
      `invasiones: 'vecinas' debe ser un array de {refcat, recintos}; ` +
        `recibido ${describir(vecinas)}.`,
    )
  }
  vecinas.forEach(exigirVecina)

  /** @type {RecintoSaltado[]} */
  const saltados = []
  const hallazgos = []
  const descartadas = []

  const polPropia = poligonoDeRegion(recintos, 'recintos', saltados)

  vecinas.forEach((vecina, i) => {
    const polVecina = poligonoDeRegion(vecina.recintos, `vecinas[${i}].recintos`, saltados)
    // Sin una de las dos regiones no se mide ESTA vecina, pero se siguen midiendo
    // las demás: la que falta ya consta en `saltados` con su sitio y su motivo.
    if (polPropia === null || polVecina === null) return

    const { piezas, nPiezas } = interseccionMedida(polPropia, polVecina)
    if (nPiezas === 0) return

    // El filtro es POR PIEZA y no por vecina, y no es un detalle: una vecina puede
    // traer a la vez una invasión de verdad y una aguja de redondeo en otro tramo
    // del mismo lindero compartido. Sumando primero y filtrando después, la aguja
    // se colaría dentro del área del hallazgo real (inflándolo) o —si el hallazgo
    // real fuera pequeño— el conjunto podría irse entero a `descartadas`.
    const reales = []
    const astillas = []
    for (const pieza of piezas) {
      const medida = medirPieza(pieza)
      ;(medida.grosor < OPERATIVOS.grosorInvasionMinimoM ? astillas : reales).push(medida)
    }

    if (astillas.length > 0) {
      descartadas.push({
        refcat: vecina.refcat,
        area: astillas.reduce((s, p) => s + p.area, 0),
        // El grosor MÁS GRANDE de las descartadas: es la que estuvo más cerca de
        // contar, y por tanto la cifra con la que se audita el umbral.
        grosor: Math.max(...astillas.map((p) => p.grosor)),
        nPiezas: astillas.length,
      })
    }
    if (reales.length > 0) {
      hallazgos.push({
        refcat: vecina.refcat,
        area: reales.reduce((s, p) => s + p.area, 0),
        piezas: reales.map((p) => p.pieza),
      })
    }
  })

  return { invasiones: hallazgos, descartadas, saltados }
}
