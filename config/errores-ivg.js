// config/errores-ivg.js — F15 · Cargador ÚNICO del diccionario de errores de la Sede.
//
// ── QUÉ ES ESTO, Y SOBRE TODO QUÉ NO ES ─────────────────────────────────────
// Es DOCUMENTACIÓN buscable, no un validador. Traduce lo que la Sede Electrónica
// del Catastro devuelve —el IVG en parcela, el ICUC en edificio— a algo que el
// técnico pueda hacer. No mira ningún fichero, no emite ningún veredicto y no
// tiene opinión sobre si tu GML está bien: eso es de `validation/` (antes de
// generar) y de `comprobacion/` (sobre un GML ya escrito).
//
// La regla de oro 9 (SPEC §2) queda intacta, y conviene decir por qué, porque a
// primera vista un campo llamado `comoCorregir` parece un juicio: **este módulo
// no juzga NADA de lo tuyo.** Describe el comportamiento de un sistema ajeno del
// que este proyecto ha ido midiendo cómo reacciona. La app sigue midiendo y
// señalando; quien interpreta y firma es el colegiado.
//
// ── POR QUÉ ES LA PIEZA QUE MÁS CRECE Y LA QUE MENOS SE COPIA ───────────────
// `spec/feature-15-diccionario-errores.md`: «es la única pieza cuyo valor crece
// con el uso — por eso no se copia de nadie: se construye a base de rechazos
// acumulados». Este repositorio lleva un año acumulándolos y hasta hoy vivían
// donde nadie los podía consultar a las once de la noche con un rechazo delante:
// repartidos entre la tabla de 21 overrides de `spec/SPEC.md`, las fichas de F04
// y F13, y los comentarios de `gml/`. **Diez de las 23 entradas son `MEDIDO`**,
// es decir, comprobadas contra el servicio real y con fecha.
//
// ── ⛔ Y POR ESO EL CATÁLOGO DE PARTIDA NO SE COPIÓ TAL CUAL ────────────────
// Las semillas que manda cargar el criterio 3 de la ficha salen del dossier §1.5.
// Al cotejarlas una a una contra lo que este proyecto MIDIÓ, **tres no se
// sostienen**, y la peor está invertida:
//
//   · §1.5 nº 1 dice que `gml:FeatureCollection`/`gml:featureMember` en parcela
//     «es 3.0, rechazado». Es al revés: ES la raíz de la ENTREGA en CP 4.0, la
//     que trae la plantilla oficial del Catastro, la que valida contra `cp/4.0`
//     sola y la que la Sede ha aceptado con IVG positivo. Lo que provocó el
//     rechazo del 2026-07-27 fue `wfs:FeatureCollection` (override O3).
//   · §1.5 nº 3 da la orientación de anillos por causa de rechazo. Medido: es
//     una convención, no un requisito — la plantilla oficial es antihoraria
//     (override O1), y F08 ya la rotula como nota informativa y jamás error.
//   · §1.5 nº 8 culpa al prefijo `base:` del `inspireId`. Lo que cuenta es el
//     NAMESPACE (base 3.3): un prefijo no es información en XML (override O4).
//
// Las tres se conservan en el diccionario **como entradas propias, con el campo
// `correccion` puesto**, en vez de borrarse. Y esa es la decisión de diseño de la
// fase: el técnico que llega aquí buscando «orientación» probablemente acaba de
// leer esa misma lista en un foro, y encontrarse el hueco no le sirve de nada —
// necesita leer que no es cierto y por qué. Un diccionario que solo dice lo que
// SÍ falla deja intacto todo lo que la gente cree que falla y no falla.
//
// ── POR QUÉ EL CARGADOR VIVE EN `config/` Y NO EN `validation/` ─────────────
// Molde exacto de `config/operativos.js`, y por el mismo motivo: este módulo NO
// importa nada del proyecto —su único import es el propio JSON— y debe seguir
// siendo una hoja del grafo. Quien lo consume hoy es `app/dialogo-errores.js`,
// que es UI; colgarlo de `validation/` haría que la pantalla dependiera de la
// capa de validación para leer un texto, que es la dependencia al revés que
// aquel fichero ya documenta.
//
// ── LA BÚSQUEDA VIVE AQUÍ, Y NO EN LA PANTALLA ─────────────────────────────
// `operativos.js` es un cargador puro porque leer una tolerancia es leer una
// propiedad. Aquí hay un paso más —normalizar y puntuar—, y podría haber ido a
// un módulo aparte. No va, por dos razones: (1) es la ÚNICA operación que se
// hace sobre este dato, así que un módulo propio sería un fichero para una
// función; (2) dejarla en la pantalla la haría inprobable sin jsdom y ataría el
// orden de los resultados —que es la mitad del valor— al proyecto `dom`.

import ERRORES_RAW from './errores-ivg.json' with { type: 'json' }

/**
 * De dónde sale lo que dice una entrada. **Es el campo más importante del
 * fichero**, porque un diccionario de errores sin procedencia es un rumor con
 * formato: quien lo lee no puede distinguir «esto lo hemos visto rechazar» de
 * «esto lo dice un foro».
 *
 * @readonly
 * @enum {string}
 */
export const PROCEDENCIA = Object.freeze({
  /** Comprobado contra el servicio real de la Sede por este proyecto, con fecha. */
  MEDIDO: 'MEDIDO',
  /** Lo dice una publicación de la D.G. del Catastro (plantilla, PDF, ayuda, FAQ). */
  DOCUMENTADO: 'DOCUMENTADO',
  /** Visto en un fichero real o en un mensaje real, sin experimento que lo aísle. */
  OBSERVADO: 'OBSERVADO',
  /** Lo dicen otros generadores o foros. **Nadie de aquí lo ha comprobado.** */
  COMUNIDAD: 'COMUNIDAD',
  /** Se deduce de la norma XML o del XSD. **Nadie lo ha visto rechazar aquí.** */
  INFERIDO: 'INFERIDO',
})

/**
 * A qué validador de la Sede se refiere la entrada. Son dos trámites distintos,
 * con dos formularios y dos esquemas: el IVG valida la parcela y el ICUC la
 * construcción. Que este fichero se llame `errores-ivg.json` es herencia del
 * nombre que fija la ficha de F15, no una afirmación de que solo cubra el IVG —
 * de hecho el segundo rechazo real de este proyecto fue del ICUC.
 *
 * @readonly
 * @enum {string}
 */
export const VALIDADOR = Object.freeze({
  /** Informe de validación gráfica. Parcela. */
  IVG: 'IVG',
  /** Informe catastral de ubicación de construcciones. Edificio. */
  ICUC: 'ICUC',
  /** Aplica a los dos trámites. */
  AMBOS: 'AMBOS',
})

/**
 * Por qué una entrada ha salido en una búsqueda. Lo consume la pantalla para
 * poder decir «esto casa con el mensaje LITERAL que devuelve la Sede», que es
 * una afirmación mucho más fuerte que «casa por palabras sueltas» y que el
 * usuario merece poder distinguir.
 *
 * @readonly
 * @enum {string}
 */
export const MOTIVO = Object.freeze({
  /** Uno de los `mensajes` literales de la entrada aparece en lo pegado. */
  MENSAJE: 'MENSAJE',
  /** La clave de la entrada aparece en lo pegado. */
  CLAVE: 'CLAVE',
  /** Coincidencia por palabras sueltas en el texto de la entrada. */
  TEXTO: 'TEXTO',
})

/**
 * Una entrada del diccionario, ya normalizada a objeto con su clave dentro.
 *
 * Los cuatro primeros campos son los que fija `spec/feature-15-…md`. Los cuatro
 * siguientes son de esta fase, y cada uno tiene su motivo escrito arriba.
 *
 * @typedef {Object} EntradaError
 * @property {string} clave  El «código o fragmento» que la nombra: la clave del
 *   JSON. Es además material de búsqueda.
 * @property {string} traduccion    Qué ha querido decir la Sede, en cristiano.
 * @property {string} causaProbable Qué suele haber pasado para llegar ahí.
 * @property {string} comoCorregir  Qué hacer. En las entradas con `correccion`,
 *   lo que dice muchas veces es **«no corrijas nada»**.
 * @property {string} fecha  `AAAA-MM-DD` en que se estableció lo que dice la
 *   entrada — no en que se escribió el fichero. En las `MEDIDO` es la fecha de
 *   la medición, que es el dato que le da valor.
 * @property {'IVG'|'ICUC'|'AMBOS'} validador  Ver {@link VALIDADOR}.
 * @property {'MEDIDO'|'DOCUMENTADO'|'OBSERVADO'|'COMUNIDAD'|'INFERIDO'} procedencia
 *   Ver {@link PROCEDENCIA}.
 * @property {readonly string[]} mensajes  Textos LITERALES que la Sede devuelve
 *   y que apuntan a esta entrada. Es lo que hace que pegar el mensaje funcione:
 *   sin ellos el técnico tendría que adivinar por qué palabra buscar.
 * @property {string} verMas  Dónde está el detalle largo, dentro de este repo.
 * @property {string} [correccion]  Presente SOLO en las entradas que enmiendan
 *   un catálogo de errores de terceros. Dice qué daba por cierto y no lo es.
 */

/** Claves de servicio del JSON (metadatos, no entradas). */
const ES_META = (clave) => clave.startsWith('_')

/**
 * El diccionario entero, CONGELADO en profundidad y en el orden del fichero.
 *
 * Congelado por el mismo motivo que `OPERATIVOS`: es la única copia en memoria y
 * un consumidor que reescribiera un `comoCorregir` en caliente dejaría a la
 * pantalla enseñando una corrección que no está en el repositorio, es decir, sin
 * procedencia y sin fecha — justo lo que este fichero existe para evitar.
 *
 * @readonly
 * @type {readonly EntradaError[]}
 */
export const ERRORES_IVG = Object.freeze(
  Object.entries(ERRORES_RAW)
    .filter(([clave]) => !ES_META(clave))
    .map(([clave, cuerpo]) =>
      Object.freeze({
        clave,
        ...cuerpo,
        mensajes: Object.freeze([...(cuerpo.mensajes ?? [])]),
      }),
    ),
)

/** La nota de cabecera del JSON, para quien quiera enseñarla. */
export const NOTA = ERRORES_RAW._nota

// ── La búsqueda ──────────────────────────────────────────────────────────────

/**
 * Palabras que aparecen en cualquier frase en español y no discriminan nada. Sin
 * esta lista, pegar un mensaje largo de la Sede casa con las 23 entradas por
 * culpa de «el», «de» y «que», y el orden por puntuación deja de significar algo.
 *
 * Es corta a propósito: solo estructura gramatical. Ni «archivo», ni «esquema»,
 * ni «válido» — esas SÍ discriminan, y son precisamente las que trae un mensaje
 * de rechazo.
 */
const VACIAS = new Set(
  ('a al ante bajo cabe con contra de del desde durante en entre hacia hasta mediante ' +
    'para por segun sin so sobre tras versus via el la los las lo un una unos unas ' +
    'y e ni o u que se su sus le les me te nos os mi tu ya no si es son era eran ha han ' +
    'hay fue fueron ser sido esta este esto estos estas ese esa eso esos esas como mas ' +
    'pero aunque cuando donde cual cuales quien quienes muy tan tanto todo toda todos todas'
  ).split(' '),
)

/**
 * Baja a minúsculas, quita tildes y deja solo lo que puede formar parte de un
 * identificador técnico o de una palabra. Se conservan `:`, `.`, `-` y `_`
 * porque el material de este diccionario son cosas como `gml:id`,
 * `wfs:FeatureCollection` o `xmlns:xlink`: partirlas por el `:` haría que
 * «gml» casara con media docena de entradas que no vienen a cuento.
 *
 * @param {string} texto
 * @returns {string}
 */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    // El rango de marcas combinantes se escribe con escapes y NO con los propios
    // caracteres: pegados a pelo son bytes invisibles que cualquier paso por otro
    // editor o codificación puede mutilar, dejando la regex sintácticamente viva
    // y semánticamente rota — un fallo silencioso perfecto.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Trocea una consulta en las palabras que de verdad discriminan.
 *
 * @param {string} texto
 * @returns {string[]} Sin repetidos, sin vacías, sin fragmentos de una letra.
 */
function palabras(texto) {
  const vistas = new Set()
  for (const p of normalizar(texto).split(' ')) {
    // Los signos que `normalizar` conserva pueden quedar sueltos en los bordes
    // («-», «.»): un token que no tenga ni una letra ni un dígito no es palabra.
    if (p.length < 2 || !/[a-z0-9]/.test(p) || VACIAS.has(p)) continue
    vistas.add(p)
  }
  return [...vistas]
}

/**
 * Longitud mínima para que un `mensaje` literal cuente como casamiento fuerte al
 * buscarlo DENTRO de lo pegado. Un literal corto («funtional» mide 9) es una
 * señal buenísima; uno de tres letras casaría por accidente dentro de cualquier
 * palabra larga y convertiría el motivo `MENSAJE` en ruido.
 */
const MINIMO_LITERAL = 6

/**
 * Todo el texto de una entrada, para el casamiento por palabras.
 *
 * @param {EntradaError} e
 * @returns {string}
 */
const pajar = (e) =>
  normalizar(
    [e.clave, ...e.mensajes, e.traduccion, e.causaProbable, e.comoCorregir, e.correccion ?? '']
      .join(' '),
  )

/**
 * Un resultado de {@link buscar}.
 *
 * @typedef {Object} Resultado
 * @property {EntradaError} entrada
 * @property {number} puntuacion  Mayor = casa mejor. No tiene unidades ni techo:
 *   solo sirve para ordenar, nunca para enseñarla ni para decidir un umbral.
 * @property {'MENSAJE'|'CLAVE'|'TEXTO'} motivo  Ver {@link MOTIVO}. El más fuerte
 *   de los que hayan disparado.
 */

/**
 * Busca en el diccionario el texto que el técnico ha pegado.
 *
 * **Con la consulta vacía devuelve el diccionario ENTERO**, en el orden del
 * fichero, y no una lista vacía. Es la decisión 6 de la entrevista del
 * 2026-08-11 y no es un detalle de comodidad: el mensaje real que este proyecto
 * recibió del IVG fue «El archivo no cumple el esquema Inspire GML», que es
 * genérico y compatible con media docena de causas, y el del ICUC no nombra
 * ninguna. Una pantalla que solo sabe contestar a una consulta precisa no sirve
 * para los dos únicos mensajes que se han medido de verdad.
 *
 * Cómo puntúa, de más fuerte a más flojo:
 *
 *   1. **`MENSAJE`** — uno de los literales de la entrada aparece dentro de lo
 *      pegado (o lo pegado, si es corto, aparece dentro del literal). Es el caso
 *      de oro: pegar el mensaje tal cual y que salga su causa.
 *   2. **`CLAVE`** — la clave de la entrada aparece en lo pegado.
 *   3. **`TEXTO`** — palabras sueltas. Valen el triple si casan en la clave o en
 *      un mensaje literal que en la prosa de la entrada.
 *
 * A igualdad de puntuación se conserva el orden del fichero, que empieza por las
 * `MEDIDO`. Empatar y desempatar por algo arbitrario haría que dos búsquedas
 * iguales pudieran salir en orden distinto entre versiones.
 *
 * @param {string} texto  Lo pegado. Puede ser un mensaje entero de varias líneas.
 * @param {Object} [opciones]
 * @param {readonly EntradaError[]} [opciones.entradas]  Para las pruebas.
 * @param {'IVG'|'ICUC'|'AMBOS'} [opciones.validador]  Si se pasa `IVG` o `ICUC`,
 *   se descartan las entradas del otro trámite. Las `AMBOS` nunca se descartan.
 * @returns {Resultado[]} Ordenados por puntuación descendente. Con consulta no
 *   vacía, solo los que casan: **una lista vacía es una respuesta legítima** y
 *   la pantalla la dice, en vez de rellenarla con lo que sea.
 */
export function buscar(texto, { entradas = ERRORES_IVG, validador } = {}) {
  const universo =
    validador === undefined || validador === VALIDADOR.AMBOS
      ? entradas
      : entradas.filter((e) => e.validador === validador || e.validador === VALIDADOR.AMBOS)

  const consulta = normalizar(texto)
  if (consulta === '') {
    return universo.map((entrada) => ({ entrada, puntuacion: 0, motivo: MOTIVO.TEXTO }))
  }

  const tokens = palabras(consulta)
  const resultados = []

  for (const entrada of universo) {
    let puntuacion = 0
    let motivo = null

    for (const mensaje of entrada.mensajes) {
      const m = normalizar(mensaje)
      if (m.length < MINIMO_LITERAL) continue
      // En los dos sentidos: el técnico puede pegar el mensaje entero (el literal
      // cae dentro) o solo el trozo que le ha llamado la atención (cae dentro del
      // literal). Los dos casos son el mismo acierto.
      if (consulta.includes(m) || (consulta.length >= MINIMO_LITERAL && m.includes(consulta))) {
        puntuacion += 100
        motivo = MOTIVO.MENSAJE
      }
    }

    const clave = normalizar(entrada.clave)
    if (clave.length >= MINIMO_LITERAL && consulta.includes(clave)) {
      puntuacion += 50
      if (motivo === null) motivo = MOTIVO.CLAVE
    }

    const heno = pajar(entrada)
    const fuerte = normalizar([entrada.clave, ...entrada.mensajes].join(' '))
    for (const t of tokens) {
      if (fuerte.includes(t)) puntuacion += 3
      else if (heno.includes(t)) puntuacion += 1
    }

    if (puntuacion > 0) {
      resultados.push({ entrada, puntuacion, motivo: motivo ?? MOTIVO.TEXTO })
    }
  }

  // `sort` es estable en todos los motores desde ES2019, así que a igualdad de
  // puntuación sobrevive el orden del fichero sin tener que llevar el índice.
  return resultados.sort((a, b) => b.puntuacion - a.puntuacion)
}
