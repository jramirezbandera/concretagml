// gml/ids.js — F04 · Los identificadores XML (`gml:id`) del GML de parcela.
//
// UN SOLO SITIO decide cómo se llaman los cuatro objetos identificables de una
// parcela 4.0 (la feature, el `MultiSurface`, cada `Surface` y el `Point` del
// `referencePoint`), y ese sitio es este. El serializador pide los ids y los
// escribe; no los compone. El motivo es que la forma exacta de esos nombres no
// es un detalle cosmético: forma parte del round-trip (regla de oro 8) y una
// letra de más rompe la comparación contra el fichero real del Catastro.
//
// POR QUÉ ESTE MÓDULO EXISTE (regla de oro 10). `gml:id` es de tipo `xsd:ID`, y
// un `xsd:ID` es un NCName: NO puede empezar por dígito. La referencia catastral
// española empieza por dígito casi siempre (`9398516VK3799G`), así que escribir
// la RC desnuda en el atributo produce un documento inválido — y está en la
// lista de errores que producen RECHAZO de la spec de F04, literalmente
// «`gml:id` por dígito». La solución del propio Catastro es prefijar: el id de
// la parcela es `<namespace INSPIRE>.<RC>`, que empieza por `E` de `ES.`; los
// demás llevan además su prefijo de tipo. Aquí se fija esa composición y, por si
// alguna entrada se escapara del patrón, {@link toXmlId} sanea con red.
//
// DE DÓNDE SALEN LOS NOMBRES (regla de oro 8 — el GML real manda). De los cuatro
// `gml:id` de `test/fixtures/gml/cp_parcela_9398516VK3799G.gml`:
//
//     ES.SDGC.CP.9398516VK3799G                 ← cp:CadastralParcel
//     MultiSurface_ES.SDGC.CP.9398516VK3799G    ← gml:MultiSurface
//     Surface_ES.SDGC.CP.9398516VK3799G.1       ← gml:Surface
//     ReferencePoint_ES.SDGC.CP.9398516VK3799G  ← gml:Point del referencePoint
//
// ⚠️ LA ASIMETRÍA. Mírense la segunda y la tercera línea: el `MultiSurface` NO
// va numerado y el `Surface` SÍ, con un `.1` al final. Es tentador «arreglarlo»
// (numerar los dos, o ninguno) mientras se escribe el serializador, y el
// resultado sería un GML que valida contra el XSD pero que ya no reproduce el
// del Catastro: el test de ida y vuelta caería y no se sabría por qué. Por eso
// la asimetría vive aquí, declarada en {@link SUFIJO_MULTISURFACE} y
// {@link BASE_NUMERACION_SURFACE}, y el test la ata al fixture leyéndolo del
// disco. No se toca sin un fichero real que lo respalde.
//
// El `UTM_1.gml` (alta de un particular, CP 3.0) confirma el patrón por el otro
// lado y aporta los dos ejes de variación que este módulo parametriza: usa el
// namespace `ES.LOCAL.CP` en vez del `ES.SDGC.CP` del dato oficial, y su
// referencia trae cargo e inmueble (20 caracteres, `8703362TF9980S0001SH`)
// frente a los 14 del fixture 4.0. Ninguna de las dos cosas cambia la
// composición: la base es siempre `<namespaceInspire>.<refcat>`.
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 1 — ningún cambio silencioso. Si {@link toXmlId} tuvo que tocar la
//     cadena (recortar, sustituir un carácter, anteponer `_`), lo dice con una
//     {@link DeteccionGml} de tipo `ID_SANEADO`. Si no tocó nada, la lista de
//     detecciones va VACÍA — y ese es el caso normal del round-trip.
//   · Aquí no se decide CUÁNTAS superficies hay ni si eso es legal: `nSurfaces`
//     entra por parámetro. Que una parcela deba ser un único exterior con huecos
//     (y no un MultiPolygon) lo juzga el serializador, y el lector lo denuncia
//     con `TIPO_GML.MULTIPLES_CARAS`. Este módulo solo sabe numerar.
//   · Sin estado y sin entorno: funciones puras de sus argumentos. No se
//     consulta el reloj del sistema ni se instancian fechas — ni siquiera en un
//     comentario —, porque el snapshot del GML generado tiene que ser el mismo
//     en cada ejecución. Hay un test que lo comprueba con un grep sobre el TEXTO
//     de este fichero.
//   · Única dependencia: `gml/_comun.js`, del que salen el catálogo de tipos de
//     detección y la factoría. Nada de DOM: aquí se manejan cadenas.

import { TIPO_GML, SEVERIDAD, crearDeteccionGml } from './_comun.js'

// ── Namespaces INSPIRE y prefijos de los ids ─────────────────────────────────

/**
 * Namespace INSPIRE del ALTA de un particular, y valor por defecto de
 * {@link idsDeParcela}: la parcela que se está dando de alta todavía no existe
 * en las bases del Catastro, así que su identificador no puede decir que sea
 * suyo. Es el que usa `UTM_1.gml` y el que la spec (override O4) da por válido
 * para el RGA de particular.
 *
 * @readonly
 */
export const NAMESPACE_INSPIRE_DEFECTO = 'ES.LOCAL.CP'

/**
 * Namespace INSPIRE del dato OFICIAL: `SDGC` es la Subdirección General de
 * Catastro, y es lo que trae el GML del WFS. Se usa en el round-trip —volver a
 * serializar lo que vino del Catastro sin cambiarle la identidad— y es el que
 * hace falta para reproducir el fixture 4.0 clavado.
 *
 * @readonly
 */
export const NAMESPACE_INSPIRE_CATASTRO = 'ES.SDGC.CP'

/**
 * Prefijo de tipo de cada id, leído del fixture 4.0. Las claves son las mismas
 * que las de {@link IdsParcela} para que no haya que traducir entre ambos.
 *
 * La parcela NO tiene prefijo de tipo (su id es la base pelada): por eso no
 * aparece aquí. Lo que la salva del dígito inicial es el `ES.` del namespace.
 *
 * @readonly
 */
export const PREFIJO_ID = Object.freeze({
  multiSurface: 'MultiSurface_',
  surface: 'Surface_',
  puntoReferencia: 'ReferencePoint_',
})

/**
 * Separador entre el namespace INSPIRE y la referencia catastral, y también
 * entre el id de un `Surface` y su número de orden. Es el mismo carácter en los
 * dos sitios porque así lo escribe el Catastro (`ES.SDGC.CP.9398516VK3799G.1`).
 * El punto es un `NCNameChar` válido — lo que no puede es ir el primero.
 *
 * @readonly
 */
export const SEPARADOR_ID = '.'

/**
 * ⚠️ Mitad de la ASIMETRÍA (ver la cabecera): el `gml:MultiSurface` NO lleva
 * número de orden. Es una cadena vacía y no un `null` para que el sitio donde se
 * concatena no tenga que preguntar nada.
 *
 * @readonly
 */
export const SUFIJO_MULTISURFACE = ''

/**
 * ⚠️ La otra mitad: el `gml:Surface` SÍ lleva número, y empieza en UNO, no en
 * cero. El primero —el único que hoy emite este proyecto— es por tanto
 * `Surface_<base>.1`, exactamente como en el fixture.
 *
 * @readonly
 */
export const BASE_NUMERACION_SURFACE = 1

// ── NCName: el repertorio que `xsd:ID` admite ────────────────────────────────

/**
 * Carácter con el que se rellena o se prefija cuando hay que sanear. El guion
 * bajo es la elección obvia: es el ÚNICO carácter no alfabético que un NCName
 * admite como inicial, así que sirve igual para tapar un hueco en medio que para
 * salvar una cadena que empezaba por dígito.
 *
 * @readonly
 */
export const CARACTER_SUSTITUTO = '_'

/**
 * `NCNameStartChar` = `NameStartChar` de XML 1.0 (5ª ed.) MENOS los dos puntos.
 * Se escribe como clase de caracteres para poder componer con ella las dos
 * expresiones regulares de abajo sin repetir los rangos.
 *
 * Los dos puntos quedan fuera A PROPÓSITO y no por descuido: en un NCName el `:`
 * separaría prefijo de nombre local, es decir, convertiría el identificador en
 * un nombre cualificado. Un `xsd:ID` no admite eso.
 */
const CLASE_INICIO_NCNAME =
  '_A-Za-z' +
  '\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF' +
  '\\u0370-\\u037D\\u037F-\\u1FFF' +
  '\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF' +
  '\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD' +
  '\\u{10000}-\\u{EFFFF}'

/**
 * Lo que un `NCNameChar` añade al repertorio inicial: dígitos, guion, punto y
 * los combinadores. Todos ellos valen a partir del segundo carácter y ninguno
 * vale como primero — de ahí que sean dos clases y no una.
 */
const CLASE_RESTO_NCNAME = '\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040'

/** ¿Empieza la cadena por un carácter que `xsd:ID` admite como inicial? */
const RE_INICIO_NCNAME = new RegExp(`^[${CLASE_INICIO_NCNAME}]`, 'u')

/**
 * Cualquier carácter que NO cabe en un NCName. La bandera `u` es necesaria para
 * que los rangos por encima del plano básico se traten como un solo carácter y
 * no como dos mitades sueltas de un par suplente.
 */
const RE_FUERA_DE_NCNAME = new RegExp(`[^${CLASE_INICIO_NCNAME}${CLASE_RESTO_NCNAME}]`, 'gu')

// ── Saneado de un identificador ──────────────────────────────────────────────

/**
 * Motivos por los que {@link toXmlId} tuvo que intervenir. Van en
 * `deteccion.datos.motivos` como claves estables, para que la UI pueda agrupar o
 * traducir sin analizar el texto del mensaje.
 *
 * @readonly
 */
export const MOTIVO_SANEADO = Object.freeze({
  RECORTADO: 'RECORTADO', // sobraban espacios en los extremos
  SUSTITUIDO: 'SUSTITUIDO', // había caracteres fuera del repertorio NCName
  PREFIJADO: 'PREFIJADO', // empezaba por un carácter no admitido como inicial
  VACIO: 'VACIO', // no quedaba nada, y un `xsd:ID` no puede ser vacío
})

/** Texto legible de cada motivo. Se concatenan en el orden en que ocurrieron. */
const TEXTO_MOTIVO = Object.freeze({
  RECORTADO: 'se recortaron los espacios de los extremos',
  SUSTITUIDO: `se sustituyeron los caracteres que un NCName no admite por «${CARACTER_SUSTITUTO}»`,
  PREFIJADO:
    `se antepuso «${CARACTER_SUSTITUTO}» porque empezaba por un carácter que un ` +
    'xsd:ID no admite como inicial (un dígito, típicamente: la referencia catastral ' +
    'empieza por dígito)',
  VACIO: `no quedaba ningún carácter utilizable y se dejó «${CARACTER_SUSTITUTO}»`,
})

/**
 * Resultado de sanear una cadena para usarla como `gml:id`.
 *
 * @typedef {Object} IdSaneado
 * @property {string} id  Un NCName válido, siempre no vacío.
 * @property {import('./_comun.js').DeteccionGml[]} detecciones  VACÍA si la
 *   cadena ya era un NCName y no se tocó nada; con una única detección
 *   `ID_SANEADO` si hubo que intervenir (regla de oro 1).
 */

/**
 * Convierte una cadena cualquiera en un NCName válido, que es lo que el tipo
 * `xsd:ID` del atributo `gml:id` exige.
 *
 * Qué hace, en este orden (y cada paso deja su motivo):
 *   1. Recorta los espacios de los extremos. Un `xsd:ID` no los admite y, en la
 *      práctica, casi siempre vienen de un copiar-y-pegar.
 *   2. Sustituye por `_` todo carácter fuera del repertorio NCName. Ahí entran
 *      el espacio interior, la barra, el acento suelto… y también los dos
 *      puntos, que un NCName prohíbe aunque el resto de XML los admita.
 *   3. Si lo que queda no empieza por letra ni por `_`, antepone `_`. Este es el
 *      paso que impide el error de rechazo «`gml:id` por dígito».
 *   4. Si no quedó nada, devuelve `_`: un identificador vacío no es un
 *      identificador.
 *
 * NO lanza por una cadena rara: eso es dato del usuario y se resuelve con una
 * detección (regla de oro 1). Solo lanza si no le dan un string, que es contrato
 * roto por el programador.
 *
 * @param {string} bruto  Cadena de partida (base del id, ya prefijada o no).
 * @returns {IdSaneado}
 * @throws {TypeError}  Si `bruto` no es un string.
 */
export function toXmlId(bruto) {
  if (typeof bruto !== 'string') {
    throw new TypeError(`toXmlId: 'bruto' debe ser un string; recibido ${JSON.stringify(bruto)}.`)
  }

  const motivos = []

  const recortado = bruto.trim()
  if (recortado !== bruto) motivos.push(MOTIVO_SANEADO.RECORTADO)

  const sustituido = recortado.replace(RE_FUERA_DE_NCNAME, CARACTER_SUSTITUTO)
  if (sustituido !== recortado) motivos.push(MOTIVO_SANEADO.SUSTITUIDO)

  let id = sustituido
  if (id.length === 0) {
    id = CARACTER_SUSTITUTO
    motivos.push(MOTIVO_SANEADO.VACIO)
  } else if (!RE_INICIO_NCNAME.test(id)) {
    id = CARACTER_SUSTITUTO + id
    motivos.push(MOTIVO_SANEADO.PREFIJADO)
  }

  if (motivos.length === 0) return { id, detecciones: [] }

  const porques = motivos.map((m) => TEXTO_MOTIVO[m]).join('; ')
  return {
    id,
    detecciones: [
      crearDeteccionGml(
        TIPO_GML.ID_SANEADO,
        `El identificador «${bruto}» no es un NCName válido y se saneó a «${id}»: ` +
          `${porques}. Un gml:id es de tipo xsd:ID: no admite espacios ni dos puntos, ` +
          'y no puede empezar por dígito.',
        SEVERIDAD.AVISO,
        { bruto, id, motivos },
      ),
    ],
  }
}

// ── Los cuatro ids de una parcela ────────────────────────────────────────────

/**
 * Los `gml:id` de un documento de parcela. Todos son NCName válidos y todos son
 * distintos entre sí, que es lo que `xsd:ID` exige (único en TODO el documento).
 *
 * @typedef {Object} IdsParcela
 * @property {string} parcela          Id de `cp:CadastralParcel`. Es la base.
 * @property {string} multiSurface     Id de `gml:MultiSurface`. SIN numerar.
 * @property {string[]} surfaces       Id de cada `gml:Surface`, en orden. CON
 *   número, empezando por `.1`. Hoy tiene siempre un elemento.
 * @property {string} puntoReferencia  Id del `gml:Point` de `cp:referencePoint`.
 */

/**
 * Compone los `gml:id` de una parcela a partir de su identidad INSPIRE.
 *
 * La base de todos ellos es `<namespaceInspire>.<refcat>`; sobre ella se montan
 * los prefijos de tipo de {@link PREFIJO_ID} y la numeración asimétrica descrita
 * en la cabecera. Cada id pasa por {@link toXmlId} de forma independiente: los
 * tres prefijados nunca necesitan saneado (empiezan por `M`, `S` y `R`), así que
 * en el caso interesante —namespace vacío, base = referencia catastral desnuda—
 * la única detección que sale es la del id de la parcela, que es justo el que
 * habría empezado por dígito.
 *
 * Con `{namespaceInspire: 'ES.SDGC.CP', refcat: '9398516VK3799G', nSurfaces: 1}`
 * el resultado es, carácter a carácter, el del fixture del WFS. El test lo
 * comprueba leyendo los cuatro `gml:id` del fichero, no de una copia.
 *
 * @param {object} args
 * @param {string} [args.namespaceInspire=NAMESPACE_INSPIRE_DEFECTO]  Namespace
 *   INSPIRE: {@link NAMESPACE_INSPIRE_CATASTRO} para el dato oficial (round-trip)
 *   o {@link NAMESPACE_INSPIRE_DEFECTO} para un alta de particular. Se admite la
 *   cadena vacía —la base pasa a ser la referencia pelada— pero entonces el id de
 *   la parcela empieza por dígito y hay que salvarlo: sale con `_` delante y con
 *   su detección `ID_SANEADO`, porque callarlo sería cambiar la identidad de la
 *   parcela a espaldas del usuario.
 * @param {string} args.refcat  Referencia catastral. Sirven tanto los 14
 *   caracteres de la parcela (`9398516VK3799G`) como los 20 con cargo e inmueble
 *   (`8703362TF9980S0001SH`): aquí no se interpreta, solo se concatena.
 * @param {number} [args.nSurfaces=1]  Cuántos `gml:Surface` numerar. Hoy vale
 *   siempre 1 —la parcela es un único exterior con huecos, y varias caras son
 *   error de rechazo—, pero la numeración queda definida para cuando F08 lea un
 *   fichero ajeno que traiga más de una.
 * @returns {{ids: IdsParcela, detecciones: import('./_comun.js').DeteccionGml[]}}
 *   Las detecciones de todos los ids, en el orden en que se compusieron.
 * @throws {TypeError}   Si `namespaceInspire` o `refcat` no son string, o si
 *   `nSurfaces` no es un entero.
 * @throws {RangeError}  Si `refcat` está vacía (sin referencia no hay identidad
 *   que componer: eso no es un dato raro del usuario, es una llamada mal hecha)
 *   o si `nSurfaces` es menor que 1 (una parcela sin superficie no es parcela).
 */
export function idsDeParcela({
  namespaceInspire = NAMESPACE_INSPIRE_DEFECTO,
  refcat,
  nSurfaces = 1,
} = {}) {
  if (typeof namespaceInspire !== 'string') {
    throw new TypeError(
      `idsDeParcela: 'namespaceInspire' debe ser un string; ` +
        `recibido ${JSON.stringify(namespaceInspire)}.`,
    )
  }
  if (typeof refcat !== 'string') {
    throw new TypeError(
      `idsDeParcela: 'refcat' debe ser un string; recibido ${JSON.stringify(refcat)}.`,
    )
  }
  if (refcat.trim().length === 0) {
    throw new RangeError(
      'idsDeParcela: `refcat` no puede estar vacía: el gml:id de la parcela es su ' +
        'identidad, y no se inventa una aquí.',
    )
  }
  if (!Number.isInteger(nSurfaces)) {
    throw new TypeError(
      `idsDeParcela: 'nSurfaces' debe ser un entero; recibido ${JSON.stringify(nSurfaces)}.`,
    )
  }
  if (nSurfaces < 1) {
    throw new RangeError(
      `idsDeParcela: 'nSurfaces' debe ser al menos 1; recibido ${nSurfaces}.`,
    )
  }

  // El namespace vacío (o en blanco, que es lo mismo) no se rellena con nada: la
  // base pasa a ser la referencia pelada y es `toXmlId` quien la salva, dejando
  // constancia. Ni el namespace ni la referencia se recortan AQUÍ: si vinieran
  // con espacios pegados, recortarlos en silencio sería justo el cambio callado
  // que la regla de oro 1 prohíbe. Se pasan tal cual y `toXmlId` —que es el único
  // sitio que sanea— informa de lo que haya tenido que tocar.
  const namespaceVacio = namespaceInspire.trim().length === 0
  const base = namespaceVacio ? refcat : `${namespaceInspire}${SEPARADOR_ID}${refcat}`

  const detecciones = []
  /** Sanea, acumula lo que haya salido y devuelve el id ya limpio. */
  const componer = (crudo) => {
    const { id, detecciones: dets } = toXmlId(crudo)
    detecciones.push(...dets)
    return id
  }

  const parcela = componer(base)
  const multiSurface = componer(`${PREFIJO_ID.multiSurface}${base}${SUFIJO_MULTISURFACE}`)
  const surfaces = []
  for (let i = 0; i < nSurfaces; i++) {
    const numero = BASE_NUMERACION_SURFACE + i
    surfaces.push(componer(`${PREFIJO_ID.surface}${base}${SEPARADOR_ID}${numero}`))
  }
  const puntoReferencia = componer(`${PREFIJO_ID.puntoReferencia}${base}`)

  return { ids: { parcela, multiSurface, surfaces, puntoReferencia }, detecciones }
}
