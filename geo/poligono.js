// geo/poligono.js — El puente entre el MODELO y el polígono de Turf, en los DOS
// sentidos: cerrar anillos para hablar con Turf, y reconstruir `recintos` con lo
// que Turf devuelve. Módulo PURO (sin DOM, sin Leaflet, sin turf) y HOJA del
// grafo de dependencias, igual que `geo/area.js` y `geo/metrica.js`.
//
// POR QUÉ EXISTE (F07, tarea T1.1). `anilloCerrado` y `coordsPoligono` vivían en
// `validation/_comun.js` porque F02 fue quien primero necesitó hablar con Turf.
// El diagnóstico de encaje (`diagnostico/`, F07) también lo necesita —el solape
// con la geometría oficial y la invasión a colindantes son `intersect`— y hacer
// que la capa de diagnóstico importe de la de VALIDACIÓN para cerrar un anillo es
// una dependencia al revés. Es exactamente la misma que resolvió `geo/metrica.js`
// bajando `distancia` (F06, T1.2): las funciones bajan aquí, a `geo/`, donde vive
// la aritmética del proyecto, y `validation/_comun.js` las RE-EXPORTA para no
// romper a sus consumidores (`validation/reglas-topologia.js` sigue importándolas
// de donde las importaba). **Una sola definición en todo el proyecto.**
//
// Este módulo NO importa turf, y eso no es un descuido: prepara coordenadas y LEE
// GeoJSON, que son estructuras de datos, no funciones de librería. Quien llama a
// `intersect`/`kinks` es `validation/reglas-topologia.js` hoy y `diagnostico/`
// mañana; la regla de oro 6 (de Turf, solo lo topológico) se cumple donde se
// invoca, no aquí. Sin imports, además, este fichero no puede arrastrar Turf a
// nadie: `geo/` sigue siendo aritmética pura y hoja del grafo.
//
// Convenciones (SPEC §2, no negociables):
//   · Regla 3 — Coordenadas SIEMPRE UTM `[x, y]` (Este, Norte), en metros. Aquí no
//     entra ni sale lat/lon; Turf corre directamente sobre UTM.
//   · Regla 4 — El modelo guarda los anillos ABIERTOS (sin repetir el vértice de
//     cierre) y como POJO plano. GeoJSON los quiere CERRADOS (RFC 7946 §3.1.6).
//     Todo el trasiego entre esas dos formas es este fichero: al ir se AÑADE el
//     vértice de cierre y al volver se QUITA, siempre de forma explícita.
//   · Regla 1 — Ver más abajo dónde está la frontera entre lanzar y no lanzar.
//   · Invariante de `recintos` (`model/parcela.js`): `recintos[0]` es el EXTERIOR
//     y el resto son HUECOS. ⚠️ El motivo ya NO es «multiparcela está fuera de
//     alcance» —caducó el 2026-08-03 con el override O18—: es que una `Parcela`
//     del modelo describe UNA finca, y N piezas disjuntas son N `Parcela`.
//
// POR QUÉ `recintosDeGeometriaTurf` DEVUELVE UNA LISTA DE `recintos` Y NO UN
// `recintos`. La intersección de dos parcelas puede salir en VARIAS PIEZAS
// DISJUNTAS —un lindero que cruza al vecino, se vuelve a salir y entra otra vez
// más adelante deja dos solapes separados— y Turf lo materializa como un
// `MultiPolygon`. El invariante del modelo, en cambio, admite UN SOLO exterior.
// Devolver un `recintos` obligaría a esta función a quedarse con una pieza
// —¿la mayor? ¿la primera?— y tirar las demás sin decírselo a nadie: un solape
// real de 12 m² presentado como 7 m² porque las otras dos piezas se perdieron por
// el camino, y con una cifra plausible que nadie revisaría. Eso es justo lo que
// prohíbe la regla de oro 1. Con una lista, el llamante VE cuántas piezas hay y
// decide: F07 suma las áreas para dar la invasión total, y el visor las dibuja
// todas.
//
// POR QUÉ NO SE USA `model/parcela.js#crearRecinto` para construir los recintos.
// Su contrato encaja casi entero (copia defensiva, exige pares de números
// finitos, normaliza el anillo cerrado a abierto) y aun así aquí estorba, por dos
// motivos:
//   1. La DIRECCIÓN de la dependencia, que es el motivo por el que este fichero
//      existe. Ningún módulo de `geo/` importa de `model/`: los únicos imports de
//      la carpeta son internos (`cierre.js → metrica.js`, `huso.js → utm.js`).
//      `geo/` es la aritmética que está DEBAJO del modelo, y el día que `model/`
//      quiera medir un área ya habría ciclo. Arreglar una dependencia al revés
//      introduciendo otra no es arreglarla.
//   2. Su normalización de anillo cerrado → abierto AVISA por `console.warn`, y
//      con razón: quien le pasa un anillo cerrado se ha saltado la regla de oro 4.
//      Pero TODO anillo de GeoJSON llega cerrado por definición, así que delegarle
//      el destripado imprimiría un aviso por anillo y por intersección. Un aviso
//      que salta siempre deja de ser una señal y enseña a ignorar la consola, que
//      es lo contrario de la regla de oro 1.
// Así que el POJO `{ vertices, tipo }` se construye aquí, con las MISMAS guardas
// que `crearRecinto` (par de números finitos, copia defensiva) y quitando el
// vértice de cierre de forma explícita. Los literales `'EXTERIOR'`/`'HUECO'` son
// los de `model/parcela.js#TIPO_RECINTO`; que no puedan divergir sin ponerse en
// rojo lo vigila `test/geo/poligono.test.js`, que compara los dos.
//
// ORIENTACIÓN: NO SE TOCA, ni al ir ni al volver. GeoJSON (RFC 7946 §3.1.6)
// *recomienda* exterior antihorario, pero ni las booleanas de Turf lo garantizan
// ni este proyecto tiene un sentido único: el WFS emite el exterior HORARIO, la
// plantilla oficial del Catastro lo trae ANTIHORARIO y el usuario dibuja como
// quiere (override O1, matizado el 2026-07-27: es una convención, no un
// requisito). La orientación es de quien SERIALIZA —F04 normaliza al emitir— y el
// signo lo MIDE `geo/area.js#orientacion`. Es la lección del override O17: el
// sentido de un anillo no se supone, se mide. Aquí los anillos pasan tal cual, en
// el orden en que llegan y empezando por el vértice por el que llegan.
//
// REGLA DE ORO 1, con la frontera bien puesta. Lo que entra por
// `recintosDeGeometriaTurf` NO es un dato del USUARIO: es la salida de
// `@turf/intersect` (o de otra booleana), es decir del PROGRAMA. Un anillo con
// menos de 4 posiciones, o sin cerrar, o con una coordenada no finita, no es «un
// dato malo que haya que reportar como Hallazgo»: o Turf está roto o el llamante
// está inventando GeoJSON a mano. Se LANZA `TypeError` nombrando la pieza, el
// anillo y lo recibido. La alternativa —saltar el anillo dejando constancia en el
// retorno— se descartó a propósito: obligaría a cada llamante a acordarse de
// mirar un campo, y el camino de quien no lo mira es un trozo de parcela
// desaparecido de un diagnóstico. La ÚNICA ausencia legítima es «no hay nada»:
// `null`/`undefined` y las coordenadas vacías, que son la respuesta NORMAL de
// `intersect` cuando dos parcelas no se tocan ⇒ `[]`, sin ruido.

/** Tipos de recinto, literalmente los de `model/parcela.js#TIPO_RECINTO`. */
const EXTERIOR = 'EXTERIOR'
const HUECO = 'HUECO'

const esNumeroFinito = (n) => typeof n === 'number' && Number.isFinite(n)

// ── Modelo → Turf (añadir el vértice de cierre) ───────────────────────────────

/**
 * Cierra un anillo ABIERTO del modelo repitiendo el primer vértice al final, como
 * exige GeoJSON/Turf. Devuelve una COPIA (no muta la entrada, ni comparte los
 * pares `[x,y]` con ella).
 *
 * **Es IDEMPOTENTE a propósito:** si el anillo ya viniera cerrado se copia tal
 * cual, sin duplicar otra vez el primer vértice. `anilloCerrado(anilloCerrado(a))`
 * es `anilloCerrado(a)`. Cerrar dos veces daría un lado de longitud 0 que
 * `polygon()` acepta sin rechistar y que luego aparece como «vértice duplicado» en
 * la validación: un fallo lejos de su causa. Nótese la asimetría deliberada con
 * `model/parcela.js#crearRecinto`, que ante un anillo cerrado AVISA por consola:
 * allí un anillo cerrado significa que alguien se saltó la regla de oro 4 al
 * ENTRAR en el modelo; aquí es el destino normal de la función.
 *
 * **Anillos de menos de 3 vértices: se cierran igual, sin juzgar.** Esta función
 * cierra, no valida: con n < 3 el resultado tiene menos de 4 posiciones y
 * `polygon()` de @turf/helpers lo rechazará —correctamente— con «Each LinearRing
 * of a Polygon must have 4 or more Positions». Detectar la degeneración es de la
 * validación (F02 `reglas-geometria`), y saltarse esos recintos antes de llamar a
 * Turf es del llamante (`reglas-topologia.js#esRecintoApto`), igual que
 * `geo/area.js#areaFirmada` devuelve 0 y `geo/metrica.js#longitudesDeLados`
 * devuelve `[]` en vez de opinar. Casos frontera, por si alguien los da por
 * supuestos: `[]` → `[]`, y un anillo de UN vértice sale con esa única posición
 * —ya cumple primero === último—, no se le inventa un duplicado.
 *
 * El contenido de los pares no se valida aquí (un `[NaN, 1]` pasa): quien mete
 * vértices en el modelo es `model/parcela.js#crearRecinto`, que sí exige números
 * finitos, y quien los juzga después es F02. Lo que sí se comprueba es que el
 * argumento sea un array, porque equivocarse ahí es un bug del llamante.
 *
 * @param {Array<[number,number]>} anillo  Anillo ABIERTO en UTM [[x,y], …].
 * @returns {Array<[number,number]>}  Anillo CERRADO (primero === último), copia nueva.
 * @throws {TypeError} Si `anillo` no es un array.
 */
export function anilloCerrado(anillo) {
  if (!Array.isArray(anillo)) {
    throw new TypeError(
      `anilloCerrado: 'anillo' debe ser un array de pares UTM [x,y]; recibido ${JSON.stringify(anillo)}.`,
    )
  }
  const n = anillo.length
  if (n === 0) return []
  const copia = anillo.map((p) => [p[0], p[1]])
  const [fx, fy] = copia[0]
  const [lx, ly] = copia[n - 1]
  if (fx === lx && fy === ly) return copia
  copia.push([fx, fy])
  return copia
}

/**
 * Coordenadas GeoJSON de un recinto como polígono de UN solo anillo:
 * `[ anilloCerrado(recinto.vertices) ]`. Listo para `polygon(coordsPoligono(r))`
 * de @turf/helpers. Turf corre directamente sobre UTM (regla 3).
 *
 * Es un anillo por polígono a propósito: un recinto del modelo ES un anillo. Los
 * huecos NO se meten aquí como anillos interiores del exterior, porque las reglas
 * y las métricas que consumen esto los tratan por separado —el hueco se comprueba
 * CONTRA el exterior (`difference` + medición del área que queda fuera, más el
 * solape de frontera de la regla «hueco apoyado en el lindero», con aritmética
 * propia) y contra los otros huecos— y un polígono con agujeros no permitiría
 * nombrar cuál de ellos falla.
 *
 * @param {{vertices: Array<[number,number]>}} recinto  Recinto del modelo (anillo ABIERTO).
 * @returns {Array<Array<[number,number]>>}  `coordinates` de un `Polygon` GeoJSON.
 * @throws {TypeError} Si `recinto` no es un objeto con `vertices` array.
 */
export function coordsPoligono(recinto) {
  if (!recinto || typeof recinto !== 'object' || !Array.isArray(recinto.vertices)) {
    throw new TypeError(
      `coordsPoligono: 'recinto' debe ser un objeto {vertices:[[x,y],…]}; recibido ${JSON.stringify(recinto)}.`,
    )
  }
  return [anilloCerrado(recinto.vertices)]
}

/**
 * ¿El recinto tiene vértices suficientes para formar un anillo que Turf acepte?
 *
 * El modelo guarda los anillos ABIERTOS: n vértices → n+1 posiciones al cerrar, y
 * `polygon()` de @turf/helpers exige ≥ 4 posiciones cerradas ⇒ **n ≥ 3**.
 *
 * ⚠️ Estaba escrita TRES veces con el mismo razonamiento —`validation/reglas-topologia.js`,
 * `diagnostico/topologia.js` y, al escribir F17, habría hecho falta una cuarta en
 * `derivacion/`—. Baja aquí por el mismo motivo que bajaron `anilloCerrado` y
 * `coordsPoligono` en F07: la definición de «apto para Turf» depende del formato
 * del anillo, que es de esta capa, y tres copias son tres sitios donde envejecer.
 *
 * @param {unknown} recinto
 * @returns {boolean}
 */
export const esRecintoApto = (recinto) =>
  !!recinto &&
  typeof recinto === 'object' &&
  Array.isArray(recinto.vertices) &&
  recinto.vertices.length >= 3

/** Cuántos vértices declara un recinto, tolerando que no sea ni un objeto. */
export const nVerticesDe = (recinto) =>
  recinto && typeof recinto === 'object' && Array.isArray(recinto.vertices)
    ? recinto.vertices.length
    : 0

/**
 * Por qué un recinto se quedó fuera al construir una REGIÓN. Los tres valores
 * posibles de `saltados[i].motivo`, escritos aquí y no repartidos por el código:
 *   · `SIN_RECINTOS`     — la lista venía vacía: no hay región que construir.
 *   · `EXTERIOR_NO_APTO` — `recintos[0]` no forma anillo (< 3 vértices). Sin
 *     exterior no hay región: los huecos, solos, no la definen.
 *   · `HUECO_NO_APTO`    — un hueco no forma anillo. La región SÍ sale, sin él, y
 *     por eso sale un poco MAYOR de lo que debería: se dice.
 *
 * ⚠️ Los tres literales son los que `diagnostico/topologia.js` viene publicando en
 * sus `saltados` desde F07: **son contrato con quien lee esa capa**, así que se
 * mueven de sitio sin cambiar de valor.
 *
 * @readonly
 */
export const MOTIVO_REGION = Object.freeze({
  SIN_RECINTOS: 'SIN_RECINTOS',
  EXTERIOR_NO_APTO: 'EXTERIOR_NO_APTO',
  HUECO_NO_APTO: 'HUECO_NO_APTO',
})

/**
 * @typedef {Object} RecintoSaltado
 * @property {string} donde  Nombre del argumento donde estaba (`'recintosA'`,
 *   `` `vecinas[2].recintos` ``…), tal como lo diría un mensaje de error.
 * @property {number|null} indice  Índice dentro de esa lista; `null` si el motivo
 *   es que la lista estaba vacía.
 * @property {number} nVertices  Cuántos vértices tenía (0 si no tenía anillo).
 * @property {'SIN_RECINTOS'|'EXTERIOR_NO_APTO'|'HUECO_NO_APTO'} motivo
 */

/**
 * Coordenadas GeoJSON de una REGIÓN: el exterior más sus huecos como anillos
 * INTERIORES del mismo polígono. Listo para `polygon(anillos)` de @turf/helpers.
 *
 * ⭐ ES LA OTRA MITAD DE `coordsPoligono`, Y LA ASIMETRÍA ES DELIBERADA. Allí un
 * recinto es UN polígono de un anillo porque la pregunta es «¿este hueco concreto
 * está mal?» y hay que poder NOMBRARLO; aquí la pregunta es «¿cuánta superficie
 * ocupa esta parcela?», y **el patio no es superficie de la parcela**. Dos
 * preguntas distintas, dos formas del mismo dato. Ninguna de las dos sirve para lo
 * de la otra: pasar un recinto con huecos por `coordsPoligono` mide de más, y
 * partir una región en polígonos sueltos impide nombrar el hueco que falla.
 *
 * ⚠️ **Existía desde F07 y era PRIVADA** (`diagnostico/topologia.js#poligonoDeRegion`).
 * F17 necesita exactamente el mismo puente para restar dos parcelas, y duplicarlo
 * habría dado dos definiciones de qué es la región de una parcela. Sube aquí la
 * parte que no toca Turf —las coordenadas y el conteo de lo saltado— y cada capa
 * pone su `polygon(...)`, que es donde vive su import de Turf.
 *
 * Los anillos se cierran con `anilloCerrado`, que **copia siempre** ⇒ quien reciba
 * esto nunca tiene una referencia viva a la geometría del modelo (regla de oro 2).
 *
 * NO LANZA por un recinto degenerado, y es a propósito: devolver `anillos: null`
 * con su motivo deja que el llamante decida —F07 lo cuenta en `saltados`, F17 lo
 * enseña—, mientras que lanzar convertiría un dato malo del usuario en un fallo del
 * programa. Sí lanza si `recintos` no es un array: eso es un bug del llamante.
 *
 * @param {Array<{vertices: Array<[number,number]>}>} recintos  Recintos del modelo,
 *   anillos ABIERTOS en UTM. `recintos[0]` es el exterior; el resto, huecos.
 * @param {string} [donde='recintos']  Nombre del argumento, para poblar `saltados`.
 * @returns {{anillos: Array<Array<[number,number]>>|null, saltados: RecintoSaltado[]}}
 *   `anillos` es `null` si no hay región medible, y entonces el motivo está en
 *   `saltados`. `saltados` puede traer entradas aunque `anillos` NO sea nulo: son
 *   los huecos que no se han podido restar.
 * @throws {TypeError} Si `recintos` no es un array.
 */
export function coordsRegion(recintos, donde = 'recintos') {
  if (!Array.isArray(recintos)) {
    throw new TypeError(
      `coordsRegion: 'recintos' debe ser un array de recintos; recibido ${JSON.stringify(recintos)}.`,
    )
  }

  const saltados = []
  if (recintos.length === 0) {
    saltados.push({ donde, indice: null, nVertices: 0, motivo: MOTIVO_REGION.SIN_RECINTOS })
    return { anillos: null, saltados }
  }
  if (!esRecintoApto(recintos[0])) {
    saltados.push({
      donde,
      indice: 0,
      nVertices: nVerticesDe(recintos[0]),
      motivo: MOTIVO_REGION.EXTERIOR_NO_APTO,
    })
    return { anillos: null, saltados }
  }

  const anillos = [anilloCerrado(recintos[0].vertices)]
  for (let i = 1; i < recintos.length; i++) {
    if (esRecintoApto(recintos[i])) {
      anillos.push(anilloCerrado(recintos[i].vertices))
      continue
    }
    saltados.push({
      donde,
      indice: i,
      nVertices: nVerticesDe(recintos[i]),
      motivo: MOTIVO_REGION.HUECO_NO_APTO,
    })
  }
  return { anillos, saltados }
}

// ── Turf → Modelo (quitar el vértice de cierre) ───────────────────────────────

/**
 * Vértices ABIERTOS del modelo a partir de un anillo CERRADO de GeoJSON.
 * `donde` sitúa el anillo en la geometría de entrada para que el mensaje de error
 * diga cuál es (regla 1: el error nombra el argumento y el valor recibido).
 *
 * @param {unknown} anillo  Anillo GeoJSON (lista de posiciones, cerrada).
 * @param {string} donde    Etiqueta de situación, p. ej. `MultiPolygon.pieza[1].anillo[0]`.
 * @returns {Array<[number,number]>}  Anillo ABIERTO, copia nueva.
 * @throws {TypeError} Si el anillo no es un array, tiene menos de 4 posiciones,
 *   no está cerrado, o alguna posición no es un par de números finitos.
 */
function verticesDeAnilloGeoJSON(anillo, donde) {
  if (!Array.isArray(anillo)) {
    throw new TypeError(
      `recintosDeGeometriaTurf: ${donde} debe ser un array de posiciones GeoJSON; ` +
        `recibido ${JSON.stringify(anillo)}.`,
    )
  }
  if (anillo.length < 4) {
    throw new TypeError(
      `recintosDeGeometriaTurf: ${donde} tiene ${anillo.length} posiciones y un anillo ` +
        `GeoJSON cerrado necesita al menos 4 (RFC 7946 §3.1.6). Esta geometría la produce ` +
        `el PROGRAMA (@turf/intersect y compañía), no el usuario: es un contrato roto, no ` +
        `un dato que reportar (regla de oro 1).`,
    )
  }

  // Copia defensiva con las mismas guardas que `model/parcela.js#crearRecinto`.
  // Una tercera componente (altitud) se descarta: el modelo es 2D en UTM
  // (regla de oro 3), y `crearRecinto` hace lo mismo con lo que le sobra.
  const posiciones = anillo.map((p, i) => {
    if (!Array.isArray(p) || p.length < 2 || !esNumeroFinito(p[0]) || !esNumeroFinito(p[1])) {
      throw new TypeError(
        `recintosDeGeometriaTurf: ${donde}[${i}] no es una posición UTM [x,y] de números ` +
          `finitos: ${JSON.stringify(p)}.`,
      )
    }
    return [p[0], p[1]]
  })

  const primero = posiciones[0]
  const ultimo = posiciones[posiciones.length - 1]
  if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) {
    throw new TypeError(
      `recintosDeGeometriaTurf: ${donde} NO está cerrado: primera posición ` +
        `${JSON.stringify(primero)} ≠ última ${JSON.stringify(ultimo)}. Quitarle la última ` +
        `perdería un vértice en silencio (regla de oro 1); un anillo GeoJSON sin cerrar no ` +
        `es un anillo (RFC 7946 §3.1.6).`,
    )
  }

  posiciones.pop() // el vértice de cierre NO se guarda en el modelo (regla de oro 4)
  return posiciones
}

/**
 * Un `recintos` del modelo a partir de la lista de anillos de UN polígono GeoJSON.
 * El anillo 0 es el EXTERIOR y los demás HUECOS, que es la misma convención que
 * usan GeoJSON y el modelo, así que no hay nada que reordenar.
 *
 * @param {unknown} anillos  `coordinates` de un `Polygon` (lista de anillos).
 * @param {string} donde     Etiqueta de situación para los mensajes de error.
 * @returns {Array<{vertices: Array<[number,number]>, tipo: 'EXTERIOR'|'HUECO'}>|null}
 *   `null` si el polígono no trae ningún anillo (polígono vacío = «no hay nada»).
 * @throws {TypeError} Si `anillos` no es un array o algún anillo está mal formado.
 */
function recintosDePoligonoGeoJSON(anillos, donde) {
  if (!Array.isArray(anillos)) {
    throw new TypeError(
      `recintosDeGeometriaTurf: ${donde}.coordinates debe ser un array de anillos; ` +
        `recibido ${JSON.stringify(anillos)}.`,
    )
  }
  if (anillos.length === 0) return null
  return anillos.map((anillo, i) => ({
    vertices: verticesDeAnilloGeoJSON(anillo, `${donde}.anillo[${i}]`),
    tipo: i === 0 ? EXTERIOR : HUECO,
  }))
}

/**
 * La dirección INVERSA del puente: convierte la geometría GeoJSON que devuelven
 * las booleanas de Turf (`intersect`, `union`, `difference`) en recintos del
 * MODELO, con los anillos ABIERTOS y `recintos[0]` marcado EXTERIOR.
 *
 * Devuelve una **lista de `recintos`**, una entrada por pieza disjunta —el porqué
 * está en la cabecera del módulo y es la razón de ser de esta firma—:
 *   · `Polygon`      → 1 entrada.
 *   · `MultiPolygon` → n entradas, una por polígono, en el orden en que vienen.
 *   · `null` / vacío → `[]`.
 *
 * Se admite tanto la GEOMETRÍA pelada como el `Feature` que la envuelve, porque
 * `intersect` devuelve un `Feature` y `polygon(...).geometry` es la geometría:
 * exigir una de las dos formas obligaría a todos los llamantes a recordar cuál, y
 * el error de recordarlo mal es mudo (`undefined.type`). Una `FeatureCollection`
 * NO se admite: mezclaría los resultados de comparaciones distintas y se perdería
 * de quién es cada pieza, que en un diagnóstico de invasión es el dato.
 *
 * `undefined` se trata como `null` («no hay nada»), igual que
 * `geo/metrica.js#perimetro` acepta los dos: el llamante típico escribe
 * `recintosDeGeometriaTurf(resultado?.geometry)` y ahí las dos ausencias
 * significan lo mismo.
 *
 * NO reorienta ni reordena nada (ver cabecera): los anillos salen en el sentido y
 * empezando por el vértice con que Turf los devuelva. Quien necesite el signo lo
 * mide con `geo/area.js#orientacion`.
 *
 * @param {object|null|undefined} geometria  `Polygon`, `MultiPolygon`, un `Feature`
 *   que envuelva a una de las dos, o `null`/`undefined`. Coordenadas en UTM.
 * @returns {Array<Array<{vertices: Array<[number,number]>, tipo: 'EXTERIOR'|'HUECO'}>>}
 *   Una lista de `recintos` válidos del modelo (POJO planos, anillos ABIERTOS).
 * @throws {TypeError} Si `geometria` no es de un tipo admitido, o si algún anillo
 *   viene con menos de 4 posiciones, sin cerrar o con coordenadas no finitas
 *   (contrato roto por el PROGRAMA, regla de oro 1).
 */
export function recintosDeGeometriaTurf(geometria) {
  if (geometria === null || geometria === undefined) return []
  if (typeof geometria !== 'object') {
    throw new TypeError(
      `recintosDeGeometriaTurf: 'geometria' debe ser una geometría GeoJSON (Polygon o ` +
        `MultiPolygon), un Feature que la envuelva, o null; recibido ${JSON.stringify(geometria)}.`,
    )
  }

  // Un `Feature` se desenvuelve UNA vez: GeoJSON no anida Features (RFC 7946
  // §3.2), y `geometry: null` es un Feature legítimo sin geometría ⇒ no hay nada.
  const geom = geometria.type === 'Feature' ? geometria.geometry : geometria
  if (geom === null || geom === undefined) return []

  if (geom.type === 'Polygon') {
    const recintos = recintosDePoligonoGeoJSON(geom.coordinates, 'Polygon')
    return recintos === null ? [] : [recintos]
  }

  if (geom.type === 'MultiPolygon') {
    if (!Array.isArray(geom.coordinates)) {
      throw new TypeError(
        `recintosDeGeometriaTurf: MultiPolygon.coordinates debe ser un array de polígonos; ` +
          `recibido ${JSON.stringify(geom.coordinates)}.`,
      )
    }
    const piezas = []
    geom.coordinates.forEach((anillos, i) => {
      // Una pieza sin anillos es la misma afirmación que `null`: no hay nada. No
      // genera entrada, y no se cuela como un `recintos` vacío que rompería el
      // invariante «recintos[0] es el EXTERIOR» en cuanto alguien lo mida.
      const recintos = recintosDePoligonoGeoJSON(anillos, `MultiPolygon.pieza[${i}]`)
      if (recintos !== null) piezas.push(recintos)
    })
    return piezas
  }

  throw new TypeError(
    `recintosDeGeometriaTurf: tipo de geometría no admitido: ${JSON.stringify(geom.type)}. ` +
      `Se admiten 'Polygon' y 'MultiPolygon' —las dos formas que devuelven las booleanas de ` +
      `Turf—, envueltas o no en un 'Feature'. Una 'FeatureCollection' no: agrupa resultados ` +
      `de comparaciones distintas y aplanarla perdería de quién es cada pieza; ` +
      `desenvuélvela el llamante.`,
  )
}
