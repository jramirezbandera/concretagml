// gml/xml.js — F04 · Lector y escritor XML PROPIOS. El único módulo de `gml/`
// que NO sabe qué es una parcela: aquí no hay dominio, solo XML.
//
// POR QUÉ UN PARSER PROPIO Y NO `DOMParser`. La app es frontend puro y corre en
// navegador, donde `DOMParser` existe; pero el proyecto Vitest `node` NO lo tiene
// (Node 22 no expone `DOMParser` global) y la regla de oro 8 exige contrastar los
// serializadores contra fixtures REALES en la suite rápida. Un módulo propio (a)
// corre igual en los dos entornos, (b) da línea y columna de cada problema —que
// es lo que el usuario necesita cuando sube un GML ajeno (F08)—, y (c) permite
// RECHAZAR por escrito lo que no queremos leer. Lo que un parser propio no da es
// confianza: por eso `test/gml/xml-oraculo.test.js` lo contrasta contra jsdom
// sobre los cuatro GML reales, igual que `test/geo/utm-control.factory.test.js`
// contrasta el motor UTM propio contra proj4. Ese test es el que sostiene esto.
//
// ── SUBCONJUNTO DE XML SOPORTADO (declarado por escrito, a propósito) ─────────
// SÍ:  declaración XML · comentarios · instrucciones de proceso · CDATA ·
//      elementos con atributos (comilla doble y simple) · elementos autocerrados ·
//      texto con las CINCO entidades predefinidas (&amp; &lt; &gt; &quot; &apos;)
//      y referencias numéricas (&#NN; / &#xNN;) · namespaces con ámbito léxico
//      completo (declaración, herencia y REDECLARACIÓN, incluido el default).
// NO, y con ERROR EXPLÍCITO, nunca en silencio:
//      · `<!DOCTYPE …>` — se rechaza de plano. Motivo: el fichero lo sube un
//        TERCERO (F08) y una DTD interna abre la puerta a la expansión recursiva
//        de entidades («billion laughs»). No hay caso de uso legítimo: ni el WFS
//        del Catastro ni los generadores de la competencia emiten DOCTYPE.
//      · cualquier entidad que no sea una de las cinco predefinidas o numérica.
//      · secciones `<! … >` que no sean comentario ni CDATA.
//      · anidamiento por encima de PROFUNDIDAD_MAXIMA.
// Este es el precedente de `test/contrato.test.js` (su traductor glob→RegExp):
// un subconjunto diminuto que REVIENTA CON MENSAJE ante lo que no soporta, en vez
// de traducirlo mal calladamente. Si algún día hace falta más, se amplía aquí y
// se amplía la lista de arriba; lo que no se hace es «tragar y seguir».
//
// ── FRONTERA ERROR-DE-DATO / ERROR-DE-PROGRAMADOR (SPEC §2.1) ────────────────
// Un XML mal formado es DATO MALO DEL USUARIO: `parsearXml` NO lanza, devuelve
// `errores` (mensaje en castellano + línea + columna). La excepción se reserva al
// contrato roto por el programador (`texto` que no es string, `nivel` negativo…).
//
// ── LA TRAMPA QUE FALLA EL 80% DE LAS IMPLEMENTACIONES CASERAS ───────────────
// Un atributo SIN PREFIJO **no está en el namespace por defecto** (XML-NS 1.0
// §6.2): está SIN namespace, aunque el elemento declare `xmlns="…"`. En un GML de
// parcela eso es exactamente `srsName`, `count`, `srsDimension`, `uom` y
// `nilReason` (sin namespace) frente a `gml:id` y `xsi:nil` (con él). Quien lo
// implemente «heredando el default» buscará `srsName` en el namespace de wfs 2.0
// y no lo encontrará nunca. Está verificado contra jsdom y tiene test propio.
//
// ── POR QUÉ LA ESCRITURA ES UN ÁRBOL Y NO UNA PLANTILLA DE STRING ────────────
// El XSD de `cp:CadastralParcel` EXIGE un orden de hijos concreto (override O5:
// areaValue → beginLifespanVersion → endLifespanVersion → geometry → inspireId →
// label → nationalCadastralReference → referencePoint) y el validador rechaza el
// fichero si no se respeta. Con un árbol intermedio ese orden se impone
// ESTRUCTURALMENTE en un solo sitio (el array de hijos que construye
// `serialize-cp.js`), y se puede afirmar en un test. Con una plantilla de string
// el orden es un accidente de en qué línea escribiste cada trozo: cualquier
// edición futura —meter un condicional, extraer un helper, reordenar «para que se
// lea mejor»— lo rompe sin que nada chille, y el fallo aparece semanas después en
// la Sede, no en la suite. Por eso `render` NO acepta XML crudo: solo NodoSalida.
//
// Sin dependencias: ni Leaflet ni Turf ni nada. Es seguro importarlo desde el
// proyecto Vitest `node` y desde el bundle de navegador.

// ── Namespaces predefinidos y vocabulario ─────────────────────────────────────

/** Namespace del prefijo reservado `xml:` (siempre declarado, XML-NS 1.0 §3). */
export const NS_XML = 'http://www.w3.org/XML/1998/namespace'

/** Namespace del prefijo reservado `xmlns:` (declaraciones de namespace). */
export const NS_XMLNS = 'http://www.w3.org/2000/xmlns/'

/**
 * El namespace VACÍO. Se exporta con nombre propio porque es el argumento
 * correcto para leer `srsName`, `count`, `srsDimension`, `uom` o `nilReason`:
 * `atributo(nodo, SIN_NAMESPACE, 'srsName')`. Ver la trampa en la cabecera.
 */
export const SIN_NAMESPACE = ''

/**
 * Las CINCO entidades predefinidas de XML 1.0 §4.6. Es la lista COMPLETA de
 * entidades por nombre que este módulo reconoce; cualquier otra produce un error.
 * Se exporta para que los tests la deriven en vez de reescribirla a mano.
 * @readonly
 */
export const ENTIDADES_XML = Object.freeze({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
})

/**
 * Tope de anidamiento. Un GML de parcela real no pasa de ~10 niveles y el de
 * edificio de ~14; 256 deja margen de sobra y corta en seco un fichero hostil
 * que intente agotar la pila de llamadas. Exportado para que el test lo derive.
 */
export const PROFUNDIDAD_MAXIMA = 256

// ── Typedefs del contrato ─────────────────────────────────────────────────────

/**
 * Un atributo ya resuelto a su namespace. POJO plano.
 *
 * @typedef {Object} AtributoXml
 * @property {string} ns       URI del namespace, o `''` si NO tiene (el caso
 *   NORMAL de un atributo sin prefijo: ver la trampa de la cabecera).
 * @property {string} local    Nombre local, sin prefijo.
 * @property {string} prefijo  Prefijo tal como venía en el fichero, o `''`.
 * @property {string} valor    Valor ya normalizado (XML 1.0 §3.3.3) y con las
 *   referencias expandidas.
 */

/**
 * Un elemento del árbol leído. POJO plano y ACÍCLICO a propósito: no hay
 * puntero al padre, para que `structuredClone`/`JSON.stringify` funcionen y para
 * que nadie pueda «subir» desde un nodo y saltarse la navegación explícita.
 *
 * @typedef {Object} NodoXml
 * @property {string} ns        URI del namespace del elemento (`''` si ninguno).
 * @property {string} local     Nombre local del elemento.
 * @property {string} prefijo   Prefijo original (`''` si venía sin prefijo).
 * @property {AtributoXml[]} atributos  En ORDEN DE DOCUMENTO. Las declaraciones
 *   de namespace (`xmlns`, `xmlns:p`) NO aparecen aquí: son maquinaria, y su
 *   efecto ya está aplicado en el `ns` de este nodo y sus descendientes.
 * @property {NodoXml[]} hijos  SOLO elementos. Comentarios e instrucciones de
 *   proceso se descartan (no aportan al dominio y jsdom tampoco los cuenta como
 *   hijos-elemento, lo que mantiene comparable el oráculo).
 * @property {string} texto     Concatenación del texto DIRECTO del elemento
 *   (nodos de carácter y CDATA hijos suyos), SIN recursión y SIN recortar. Para
 *   leer un valor usa la función {@link texto}, que recorta.
 * @property {number} linea     Línea (1-based) del `<` de la etiqueta de apertura.
 * @property {number} columna   Columna (1-based) de ese mismo `<`.
 */

/**
 * Declaración XML del documento.
 *
 * @typedef {Object} DeclaracionXml
 * @property {string|null} version     Normalmente `'1.0'`.
 * @property {string|null} encoding    Lo DECLARADO, que no tiene por qué ser lo
 *   que hay en disco (los GML del Catastro declaran ISO-8859-1 y en realidad
 *   vienen en UTF-8). Este módulo recibe un string ya decodificado: no
 *   transcodifica nada, solo informa de lo que el fichero dice de sí mismo.
 * @property {string|null} standalone  `'yes'`/`'no'` si venía, `null` si no.
 */

/**
 * Un problema del DOCUMENTO (dato del usuario), no del programador.
 *
 * @typedef {Object} ErrorXml
 * @property {string} mensaje  En castellano, nombrando qué se esperaba.
 * @property {number} linea    1-based.
 * @property {number} columna  1-based.
 */

/**
 * Nodo del árbol de SALIDA (escritura). Deliberadamente distinto de `NodoXml`:
 * al escribir se manda el nombre CUALIFICADO literal (`'cp:areaValue'`) porque
 * los prefijos del documento de salida los fija el serializador de una vez en la
 * raíz, mientras que al leer lo que importa es el namespace resuelto.
 *
 * @typedef {Object} NodoSalida
 * @property {string} nombre     Nombre cualificado tal cual se escribirá.
 * @property {Array<[string, string]>} atributos  Pares `[nombre, valor]` EN EL
 *   ORDEN en que se escribirán (por eso es un array y no un objeto).
 * @property {string|NodoSalida[]|null} contenido  Texto, hijos, o nada.
 */

// ── Lectura · andamiaje interno ───────────────────────────────────────────────

// Sentinela de parada. Se LANZA internamente para desenrollar el parser cuando
// un error deja el documento irrecuperable (etiqueta sin cerrar, cierre que no
// casa, DOCTYPE…), y `parsearXml` lo captura y devuelve lo construido hasta ahí.
// Es un Symbol y no una subclase de Error a propósito: en este repo no hay
// clases (SPEC), y un Symbol no puede confundirse con una excepción real —si lo
// que sale del `try` no es este símbolo exacto, se re-lanza sin tocarlo.
const PARADA = Symbol('gml/xml.js: parada del parser')

// Clases de carácter de Name/NameStartChar (XML 1.0 §2.3). Se escriben enteras
// en vez de aproximar con /\w/: un nombre como `bu-core2d:informationSystem`
// —que está en los fixtures reales de edificio— lleva guion y dígitos, y una
// aproximación los rechazaría o, peor, cortaría el nombre por la mitad.
const CLASE_INICIO_NOMBRE =
  ':A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D' +
  '\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF' +
  '\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD'
const CLASE_RESTO_NOMBRE =
  `${CLASE_INICIO_NOMBRE}\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040`
const FUENTE_NOMBRE = `[${CLASE_INICIO_NOMBRE}][${CLASE_RESTO_NOMBRE}]*`

/** Espacio en blanco de XML (el `\r` ya no existe: se normaliza a la entrada). */
const ESPACIOS_XML = ' \t\n'

/**
 * Construye un localizador índice→{linea, columna} con búsqueda binaria sobre
 * los inicios de línea. Se precalcula una vez por documento: hacerlo contando
 * `\n` en cada error sería O(n) por error, y un fichero hostil puede tener
 * muchos.
 *
 * @param {string} t  Texto YA normalizado en finales de línea.
 * @returns {(indice: number) => {linea: number, columna: number}}
 */
function crearLocalizador(t) {
  const inicios = [0]
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\n') inicios.push(i + 1)
  }
  return (indice) => {
    let bajo = 0
    let alto = inicios.length - 1
    while (bajo < alto) {
      const medio = (bajo + alto + 1) >> 1
      if (inicios[medio] <= indice) bajo = medio
      else alto = medio - 1
    }
    return { linea: bajo + 1, columna: indice - inicios[bajo] + 1 }
  }
}

/** Registra un error de DOCUMENTO y sigue (el parser puede continuar). */
function anotar(ctx, indice, mensaje) {
  const { linea, columna } = ctx.localizar(indice)
  ctx.errores.push({ mensaje, linea, columna })
}

/** Registra un error de DOCUMENTO que deja el resto irrecuperable, y para. */
function abortar(ctx, indice, mensaje) {
  anotar(ctx, indice, mensaje)
  throw PARADA
}

/** Recorta el texto para citarlo en un mensaje de error sin volcar el fichero. */
function citar(ctx, indice) {
  const trozo = ctx.t.slice(indice, indice + 20)
  return JSON.stringify(trozo.length === 0 ? '(fin de fichero)' : trozo)
}

/** Consume espacios en blanco. Devuelve si consumió alguno. */
function saltarEspacios(ctx) {
  const inicio = ctx.i
  while (ctx.i < ctx.t.length && ESPACIOS_XML.includes(ctx.t[ctx.i])) ctx.i++
  return ctx.i > inicio
}

/**
 * Lee un Name de XML en la posición actual.
 *
 * @param {object} ctx
 * @param {string} que  Qué se esperaba, para el mensaje de error.
 * @returns {string}
 */
function leerNombre(ctx, que) {
  ctx.reNombre.lastIndex = ctx.i
  const m = ctx.reNombre.exec(ctx.t)
  if (m === null) {
    abortar(ctx, ctx.i, `se esperaba un ${que} y se encontró ${citar(ctx, ctx.i)}.`)
  }
  ctx.i += m[0].length
  return m[0]
}

/** ¿Es `cp` un punto de código válido en un documento XML 1.0 (§2.2)? */
function esCaracterXml(cp) {
  return (
    cp === 0x9 ||
    cp === 0xa ||
    cp === 0xd ||
    (cp >= 0x20 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) ||
    (cp >= 0x10000 && cp <= 0x10ffff)
  )
}

/**
 * Expande la referencia (`&…;`) que empieza en la posición actual. Deja `ctx.i`
 * detrás del `;`. Ante una referencia que este módulo no soporta ANOTA el error
 * y devuelve el texto crudo: es dato del usuario y el parser puede seguir
 * leyendo el resto del fichero, así que se recogen todos los casos de una vez en
 * vez de parar en el primero.
 *
 * @returns {string}  El texto sustituido (o el crudo si no se pudo expandir).
 */
function leerReferencia(ctx) {
  const inicio = ctx.i
  const fin = ctx.t.indexOf(';', inicio + 1)
  // 32 caracteres es holgadísimo para `&#x10FFFF;` (10) o `&quot;` (6): si no
  // hay `;` cerca, lo que hay es un «&» suelto, no una referencia truncada.
  if (fin === -1 || fin - inicio > 32) {
    anotar(
      ctx,
      inicio,
      'un «&» suelto no es válido en XML: escríbelo como «&amp;» ' +
        '(este módulo NO lo corrige por su cuenta).',
    )
    ctx.i = inicio + 1
    return '&'
  }
  const cuerpo = ctx.t.slice(inicio + 1, fin)
  ctx.i = fin + 1
  if (cuerpo.startsWith('#')) {
    const hex = cuerpo[1] === 'x' || cuerpo[1] === 'X'
    const digitos = hex ? cuerpo.slice(2) : cuerpo.slice(1)
    const validos = hex ? /^[0-9A-Fa-f]+$/ : /^[0-9]+$/
    if (!validos.test(digitos)) {
      anotar(ctx, inicio, `«&${cuerpo};» no es una referencia numérica válida (&#NN; o &#xNN;).`)
      return `&${cuerpo};`
    }
    const cp = Number.parseInt(digitos, hex ? 16 : 10)
    if (!esCaracterXml(cp)) {
      anotar(
        ctx,
        inicio,
        `«&${cuerpo};» apunta al punto de código ${cp}, que no es un carácter válido en XML 1.0.`,
      )
      return `&${cuerpo};`
    }
    return String.fromCodePoint(cp)
  }
  if (Object.hasOwn(ENTIDADES_XML, cuerpo)) return ENTIDADES_XML[cuerpo]
  anotar(
    ctx,
    inicio,
    `la entidad «&${cuerpo};» está fuera del subconjunto soportado. Solo se admiten ` +
      `las cinco predefinidas (${Object.keys(ENTIDADES_XML)
        .map((n) => `&${n};`)
        .join(' ')}) y las numéricas (&#NN; / &#xNN;).`,
  )
  return `&${cuerpo};`
}

/** Lee texto de contenido hasta el siguiente `<`, expandiendo referencias. */
function leerTexto(ctx) {
  let salida = ''
  for (;;) {
    let j = ctx.i
    while (j < ctx.t.length && ctx.t[j] !== '<' && ctx.t[j] !== '&') j++
    salida += ctx.t.slice(ctx.i, j)
    ctx.i = j
    if (j >= ctx.t.length || ctx.t[j] === '<') return salida
    salida += leerReferencia(ctx)
  }
}

/**
 * Lee un valor de atributo hasta la comilla de cierre, aplicando la
 * NORMALIZACIÓN de XML 1.0 §3.3.3: un espacio, tabulador o salto de línea
 * LITERAL se sustituye por un espacio, pero el mismo carácter escrito como
 * referencia (`&#10;`) se conserva tal cual. Esa asimetría es justo el motivo de
 * que {@link escaparAtributo} escape `\r \n \t` como referencias numéricas: es
 * la única forma de que un valor con saltos de línea sobreviva a la ida y vuelta.
 */
function leerValorAtributo(ctx, comilla, nombreAtr) {
  const inicio = ctx.i
  let salida = ''
  for (;;) {
    if (ctx.i >= ctx.t.length) {
      abortar(ctx, inicio, `el valor del atributo «${nombreAtr}» no se cierra con ${comilla}.`)
    }
    const c = ctx.t[ctx.i]
    if (c === comilla) {
      ctx.i++
      return salida
    }
    if (c === '&') {
      salida += leerReferencia(ctx)
      continue
    }
    if (c === '<') {
      anotar(
        ctx,
        ctx.i,
        `un «<» literal no es válido dentro del valor del atributo «${nombreAtr}»: usa «&lt;».`,
      )
    }
    salida += c === '\n' || c === '\t' ? ' ' : c
    ctx.i++
  }
}

/** Salta un comentario `<!-- … -->`. */
function saltarComentario(ctx) {
  const inicio = ctx.i
  const fin = ctx.t.indexOf('-->', ctx.i + 4)
  if (fin === -1) abortar(ctx, inicio, 'un comentario abierto con «<!--» no se cierra con «-->».')
  ctx.i = fin + 3
}

/** Salta una instrucción de proceso `<? … ?>`. */
function saltarInstruccion(ctx) {
  const inicio = ctx.i
  const fin = ctx.t.indexOf('?>', ctx.i + 2)
  if (fin === -1) {
    abortar(ctx, inicio, 'una instrucción de proceso abierta con «<?» no se cierra con «?>».')
  }
  ctx.i = fin + 2
}

/** Lee una sección CDATA y devuelve su contenido crudo (sin expandir nada). */
function leerCdata(ctx) {
  const inicio = ctx.i
  const fin = ctx.t.indexOf(']]>', ctx.i + 9)
  if (fin === -1) {
    abortar(ctx, inicio, 'una sección CDATA abierta con «<![CDATA[» no se cierra con «]]>».')
  }
  const contenido = ctx.t.slice(ctx.i + 9, fin)
  ctx.i = fin + 3
  return contenido
}

/** Mensaje único del rechazo de DOCTYPE (se emite en prólogo, contenido y epílogo). */
const MENSAJE_DOCTYPE =
  '«<!DOCTYPE …>» no está soportado y se rechaza a propósito: el fichero puede venir ' +
  'de un tercero y una DTD interna permite expansión recursiva de entidades ' +
  '(«billion laughs»). Ni el WFS del Catastro ni los generadores conocidos emiten ' +
  'DOCTYPE: elimínalo del fichero.'

/**
 * Salta el «misceláneo» del prólogo o del epílogo: espacios, comentarios e
 * instrucciones de proceso. Para en cuanto ve algo que no es ninguno de ellos.
 */
function saltarMiscelanea(ctx) {
  for (;;) {
    saltarEspacios(ctx)
    if (ctx.i >= ctx.t.length) return
    if (ctx.t.startsWith('<!--', ctx.i)) {
      saltarComentario(ctx)
      continue
    }
    if (ctx.t.startsWith('<?', ctx.i)) {
      saltarInstruccion(ctx)
      continue
    }
    if (ctx.t.startsWith('<!DOCTYPE', ctx.i)) abortar(ctx, ctx.i, MENSAJE_DOCTYPE)
    if (ctx.t.startsWith('<!', ctx.i)) {
      abortar(
        ctx,
        ctx.i,
        `la sección ${citar(ctx, ctx.i)} está fuera del subconjunto soportado ` +
          '(solo comentarios «<!--…-->» y secciones CDATA «<![CDATA[…]]>»).',
      )
    }
    return
  }
}

/** Lee la declaración XML si está al principio del documento. */
function leerDeclaracion(ctx) {
  if (!ctx.t.startsWith('<?xml', ctx.i)) return null
  // `<?xml-stylesheet …?>` es una instrucción de proceso corriente, no la
  // declaración: solo lo es si tras `<?xml` viene un espacio.
  if (!ESPACIOS_XML.includes(ctx.t[ctx.i + 5] ?? '')) return null
  const inicio = ctx.i
  const fin = ctx.t.indexOf('?>', ctx.i)
  if (fin === -1) abortar(ctx, inicio, 'la declaración XML no se cierra con «?>».')
  const cuerpo = ctx.t.slice(inicio + 5, fin)
  ctx.i = fin + 2
  const pseudo = (clave) => {
    const m = cuerpo.match(new RegExp(`\\b${clave}\\s*=\\s*("[^"]*"|'[^']*')`))
    return m === null ? null : m[1].slice(1, -1)
  }
  const version = pseudo('version')
  if (version === null) {
    anotar(ctx, inicio, 'la declaración XML no indica «version» (se esperaba version="1.0").')
  }
  return { version, encoding: pseudo('encoding'), standalone: pseudo('standalone') }
}

/** Parte un QName en `{prefijo, local}`; anota si no es un QName válido. */
function partirQName(ctx, nombre, indice) {
  const partes = nombre.split(':')
  if (partes.length === 1) return { prefijo: '', local: nombre }
  if (partes.length === 2 && partes[0] !== '' && partes[1] !== '') {
    return { prefijo: partes[0], local: partes[1] }
  }
  anotar(
    ctx,
    indice,
    `«${nombre}» no es un nombre cualificado válido: se admite «local» o «prefijo:local», ` +
      'con un único «:» y ninguna de las dos partes vacía.',
  )
  return { prefijo: '', local: nombre }
}

/** Resuelve un prefijo contra el ámbito vigente; anota si no está declarado. */
function resolverPrefijo(ctx, ambito, prefijo, nombre, indice) {
  if (ambito.has(prefijo)) return ambito.get(prefijo)
  anotar(
    ctx,
    indice,
    `el prefijo «${prefijo}» de «${nombre}» no está declarado: falta un ` +
      `xmlns:${prefijo}="…" en este elemento o en alguno de sus antecesores.`,
  )
  return SIN_NAMESPACE
}

/**
 * Calcula el ámbito de namespaces vigente DENTRO de este elemento a partir de
 * sus declaraciones. Devuelve el mismo mapa heredado si no declara ninguna
 * (caso mayoritario: solo la raíz declara, y la copia costaría en cada nodo).
 */
function ambitoDe(ctx, heredado, crudos) {
  const declaraciones = crudos.filter(
    (a) => a.nombre === 'xmlns' || a.nombre.startsWith('xmlns:'),
  )
  if (declaraciones.length === 0) return heredado
  const ambito = new Map(heredado)
  for (const d of declaraciones) {
    const prefijo = d.nombre === 'xmlns' ? '' : d.nombre.slice(6)
    if (prefijo === 'xmlns') {
      anotar(ctx, d.indice, 'el prefijo «xmlns» está reservado y no se puede declarar.')
      continue
    }
    if (prefijo === 'xml' && d.valor !== NS_XML) {
      anotar(
        ctx,
        d.indice,
        `el prefijo «xml» solo puede declararse como "${NS_XML}"; recibido "${d.valor}".`,
      )
      continue
    }
    if (prefijo !== '' && d.valor === '') {
      anotar(
        ctx,
        d.indice,
        `xmlns:${prefijo}="" (des-declarar un prefijo) es de XML 1.1 y no se admite aquí.`,
      )
      continue
    }
    ambito.set(prefijo, d.valor)
  }
  return ambito
}

/**
 * Resuelve los atributos NO-declarativos de un elemento.
 *
 * AQUÍ VIVE LA TRAMPA de la cabecera: un atributo sin prefijo se queda en
 * `SIN_NAMESPACE`, NO hereda el default. No lo «simplifiques» a
 * `prefijo === '' ? ambito.get('') : …`: es XML-NS 1.0 §6.2 y romperlo hace que
 * `srsName`, `count`, `srsDimension`, `uom` y `nilReason` dejen de encontrarse.
 */
function resolverAtributos(ctx, ambito, crudos, nombreElemento) {
  const atributos = []
  const vistos = new Set()
  for (const a of crudos) {
    if (a.nombre === 'xmlns' || a.nombre.startsWith('xmlns:')) continue
    const { prefijo, local } = partirQName(ctx, a.nombre, a.indice)
    const ns =
      prefijo === ''
        ? SIN_NAMESPACE
        : resolverPrefijo(ctx, ambito, prefijo, a.nombre, a.indice)
    // Separador NUL, escrito como ESCAPE para que el fichero siga siendo texto
    // plano (un NUL literal haría que grep y los diffs trataran esto como
    // binario): ni un URI de namespace ni un nombre local pueden contener un
    // NUL, así que `ns + NUL + local` es una clave sin colisiones posibles.
    const clave = `${ns}\u0000${local}`
    if (vistos.has(clave)) {
      anotar(
        ctx,
        a.indice,
        `el atributo «${a.nombre}» está repetido en «<${nombreElemento}>»: XML lo prohíbe ` +
          '(dos atributos no pueden tener el mismo nombre expandido). Se conserva el primero.',
      )
      continue
    }
    vistos.add(clave)
    atributos.push({ ns, local, prefijo, valor: a.valor })
  }
  return atributos
}

/** Lee el contenido de un elemento hasta su etiqueta de cierre. */
function leerContenido(ctx, nodo, nombreApertura, inicioApertura, profundidad) {
  for (;;) {
    if (ctx.i >= ctx.t.length) {
      const { linea } = ctx.localizar(inicioApertura)
      abortar(
        ctx,
        inicioApertura,
        `el elemento «<${nombreApertura}>» abierto en la línea ${linea} no se cierra ` +
          `con «</${nombreApertura}>».`,
      )
    }
    if (ctx.t[ctx.i] !== '<') {
      nodo.texto += leerTexto(ctx)
      continue
    }
    if (ctx.t.startsWith('</', ctx.i)) {
      const inicioCierre = ctx.i
      ctx.i += 2
      const nombreCierre = leerNombre(ctx, 'nombre en la etiqueta de cierre')
      saltarEspacios(ctx)
      if (ctx.t[ctx.i] !== '>') {
        abortar(ctx, ctx.i, `la etiqueta «</${nombreCierre}» no termina en «>».`)
      }
      ctx.i++
      if (nombreCierre !== nombreApertura) {
        const { linea } = ctx.localizar(inicioApertura)
        abortar(
          ctx,
          inicioCierre,
          `la etiqueta de cierre «</${nombreCierre}>» no casa con la de apertura ` +
            `«<${nombreApertura}>» de la línea ${linea}.`,
        )
      }
      return
    }
    if (ctx.t.startsWith('<!--', ctx.i)) {
      saltarComentario(ctx)
      continue
    }
    if (ctx.t.startsWith('<![CDATA[', ctx.i)) {
      nodo.texto += leerCdata(ctx)
      continue
    }
    if (ctx.t.startsWith('<!DOCTYPE', ctx.i)) abortar(ctx, ctx.i, MENSAJE_DOCTYPE)
    if (ctx.t.startsWith('<!', ctx.i)) {
      abortar(
        ctx,
        ctx.i,
        `la sección ${citar(ctx, ctx.i)} está fuera del subconjunto soportado ` +
          '(solo comentarios «<!--…-->» y secciones CDATA «<![CDATA[…]]>»).',
      )
    }
    if (ctx.t.startsWith('<?', ctx.i)) {
      saltarInstruccion(ctx)
      continue
    }
    nodo.hijos.push(leerElemento(ctx, profundidad + 1))
  }
}

/** Lee un elemento completo (apertura, atributos, contenido y cierre). */
function leerElemento(ctx, profundidad) {
  if (profundidad > PROFUNDIDAD_MAXIMA) {
    abortar(
      ctx,
      ctx.i,
      `el documento anida elementos más de ${PROFUNDIDAD_MAXIMA} niveles; se corta aquí ` +
        'para no agotar la pila de llamadas (defensa ante un fichero hostil).',
    )
  }
  const inicio = ctx.i
  const { linea, columna } = ctx.localizar(inicio)
  ctx.i++ // el '<'
  const nombre = leerNombre(ctx, 'nombre de elemento')

  const crudos = []
  let vacio = false
  for (;;) {
    const huboEspacio = saltarEspacios(ctx)
    if (ctx.i >= ctx.t.length) {
      abortar(ctx, inicio, `la etiqueta de apertura «<${nombre}» no se cierra con «>» ni «/>».`)
    }
    if (ctx.t.startsWith('/>', ctx.i)) {
      ctx.i += 2
      vacio = true
      break
    }
    if (ctx.t[ctx.i] === '>') {
      ctx.i++
      break
    }
    if (!huboEspacio) {
      abortar(
        ctx,
        ctx.i,
        `falta un espacio antes del siguiente atributo de «<${nombre}>»: se encontró ` +
          `${citar(ctx, ctx.i)}.`,
      )
    }
    const indiceAtr = ctx.i
    const nombreAtr = leerNombre(ctx, `nombre de atributo de «<${nombre}>»`)
    saltarEspacios(ctx)
    if (ctx.t[ctx.i] !== '=') {
      abortar(
        ctx,
        ctx.i,
        `el atributo «${nombreAtr}» de «<${nombre}>» no lleva «=»: en XML todo atributo ` +
          'tiene valor entrecomillado.',
      )
    }
    ctx.i++
    saltarEspacios(ctx)
    const comilla = ctx.t[ctx.i]
    if (comilla !== '"' && comilla !== "'") {
      abortar(
        ctx,
        ctx.i,
        `el valor del atributo «${nombreAtr}» de «<${nombre}>» debe ir entre comillas ` +
          `dobles o simples; se encontró ${citar(ctx, ctx.i)}.`,
      )
    }
    ctx.i++
    crudos.push({
      nombre: nombreAtr,
      valor: leerValorAtributo(ctx, comilla, nombreAtr),
      indice: indiceAtr,
    })
  }

  const ambito = ambitoDe(ctx, ctx.pila[ctx.pila.length - 1], crudos)
  ctx.pila.push(ambito)
  const { prefijo, local } = partirQName(ctx, nombre, inicio)
  const ns =
    prefijo === '' ? ambito.get('') : resolverPrefijo(ctx, ambito, prefijo, nombre, inicio)
  const nodo = {
    ns,
    local,
    prefijo,
    atributos: resolverAtributos(ctx, ambito, crudos, nombre),
    hijos: [],
    texto: '',
    linea,
    columna,
  }
  if (!vacio) leerContenido(ctx, nodo, nombre, inicio, profundidad)
  ctx.pila.pop()
  return nodo
}

// ── Lectura · API pública ─────────────────────────────────────────────────────

/**
 * Parsea un documento XML del subconjunto declarado en la cabecera.
 *
 * NO LANZA ante un XML mal formado: eso es dato del usuario y sale por
 * `errores`. La única excepción es el contrato roto por el programador.
 *
 * Normalización de finales de línea: `\r\n` y `\r` sueltos se convierten a `\n`
 * ANTES de parsear (XML 1.0 §2.11), igual que hace cualquier parser conforme —y
 * que jsdom, con quien se contrasta este módulo. Consecuencia: las columnas que
 * se reportan son las del texto ya normalizado, lo que solo cambia algo en la
 * última columna de una línea que terminaba en CRLF.
 *
 * @param {string} texto  Documento XML COMPLETO, ya decodificado a string. Este
 *   módulo no transcodifica: si el fichero venía en ISO-8859-1, decodifícalo tú.
 * @returns {{raiz: NodoXml|null, declaracion: DeclaracionXml|null, errores: ErrorXml[]}}
 *   `raiz` es `null` si el documento no llegó a tener elemento raíz utilizable.
 *   Un documento correcto devuelve `errores: []`.
 * @throws {TypeError}  Si `texto` no es un string.
 */
export function parsearXml(texto) {
  if (typeof texto !== 'string') {
    throw new TypeError(
      `parsearXml: 'texto' debe ser el documento XML como string; recibido ${typeof texto}. ` +
        'Un XML MAL FORMADO no se señala con excepción: se devuelve en la lista `errores`.',
    )
  }
  const t = texto.replace(/\r\n?/g, '\n')
  const ctx = {
    t,
    // El BOM no se recorta del texto: se salta. Así los índices —y por tanto
    // las líneas y columnas de los errores— siguen refiriéndose al string que
    // el llamante pasó, y no a una copia recortada que él no tiene.
    i: t.charCodeAt(0) === 0xfeff ? 1 : 0,
    errores: [],
    localizar: crearLocalizador(t),
    // La RegExp se crea POR LLAMADA: lleva la bandera `y` (sticky), que guarda
    // estado en `lastIndex`. Una constante de módulo compartida haría que dos
    // parseos anidados se pisaran; así `parsearXml` es reentrante.
    reNombre: new RegExp(FUENTE_NOMBRE, 'y'),
    pila: [
      new Map([
        ['', SIN_NAMESPACE],
        ['xml', NS_XML],
        ['xmlns', NS_XMLNS],
      ]),
    ],
  }

  let declaracion = null
  let raiz = null
  try {
    declaracion = leerDeclaracion(ctx)
    saltarMiscelanea(ctx)
    if (ctx.i >= t.length) {
      abortar(ctx, ctx.i, 'el documento no contiene ningún elemento raíz.')
    }
    if (t[ctx.i] !== '<') {
      abortar(
        ctx,
        ctx.i,
        `se esperaba el elemento raíz («<…>») y se encontró ${citar(ctx, ctx.i)}.`,
      )
    }
    raiz = leerElemento(ctx, 0)
    saltarMiscelanea(ctx)
    if (ctx.i < t.length) {
      anotar(
        ctx,
        ctx.i,
        `hay contenido después del elemento raíz («</${raiz.prefijo ? `${raiz.prefijo}:` : ''}` +
          `${raiz.local}>»): un documento XML tiene un único elemento raíz.`,
      )
    }
  } catch (e) {
    if (e !== PARADA) throw e
  }
  return { raiz, declaracion, errores: ctx.errores }
}

// ── Lectura · consultas de conveniencia ───────────────────────────────────────

/** Valida que `nodo` parece un NodoXml (contrato del programador, no del dato). */
function exigirNodo(nodo, funcion) {
  if (nodo === null || typeof nodo !== 'object' || !Array.isArray(nodo.hijos)) {
    throw new TypeError(
      `${funcion}: 'nodo' debe ser un NodoXml (el devuelto por parsearXml().raiz o por ` +
        `hijo/hijos/ruta); recibido ${JSON.stringify(nodo)}. Si el elemento puede faltar, ` +
        'comprueba antes que no es null en vez de encadenar la llamada.',
    )
  }
}

/** Valida un par (ns, local) de consulta. */
function exigirNombre(ns, local, funcion) {
  if (typeof ns !== 'string') {
    throw new TypeError(
      `${funcion}: 'ns' debe ser el URI del namespace como string (usa SIN_NAMESPACE, que ` +
        `es '', para los atributos sin prefijo); recibido ${typeof ns}.`,
    )
  }
  if (typeof local !== 'string' || local.length === 0) {
    throw new TypeError(
      `${funcion}: 'local' debe ser el nombre local como string no vacío; recibido ` +
        `${JSON.stringify(local)}.`,
    )
  }
}

/**
 * TODOS los hijos-elemento de `nodo` con ese `(ns, local)`, en orden de documento.
 *
 * @param {NodoXml} nodo
 * @param {string} ns     URI del namespace (`SIN_NAMESPACE` si ninguno).
 * @param {string} local  Nombre local.
 * @returns {NodoXml[]}   Vacío si no hay ninguno.
 * @throws {TypeError}    Si los argumentos rompen el contrato.
 */
export function hijos(nodo, ns, local) {
  exigirNodo(nodo, 'hijos')
  exigirNombre(ns, local, 'hijos')
  return nodo.hijos.filter((h) => h.ns === ns && h.local === local)
}

/**
 * El PRIMER hijo-elemento con ese `(ns, local)`, o `null`.
 *
 * @param {NodoXml} nodo
 * @param {string} ns
 * @param {string} local
 * @returns {NodoXml|null}
 * @throws {TypeError}  Si los argumentos rompen el contrato.
 */
export function hijo(nodo, ns, local) {
  exigirNodo(nodo, 'hijo')
  exigirNombre(ns, local, 'hijo')
  return nodo.hijos.find((h) => h.ns === ns && h.local === local) ?? null
}

/**
 * El hijo-elemento con ese `(ns, local)` **si hay exactamente uno**.
 *
 * Devuelve `null` tanto si no hay ninguno como si hay varios: «no existe un
 * hijo único» es la misma respuesta en los dos casos, y devolver el primero
 * cuando hay tres sería precisamente el error silencioso que la regla de oro 1
 * prohíbe. Para DISTINGUIR los dos casos pasa `errores`: la duplicidad se anota
 * ahí (con línea y columna del segundo), mientras que la ausencia NO se anota
 * —un elemento opcional del XSD puede faltar legítimamente—.
 *
 * @param {NodoXml} nodo
 * @param {string} ns
 * @param {string} local
 * @param {ErrorXml[]} [errores]  Lista donde anotar la duplicidad, si la hay.
 * @returns {NodoXml|null}
 * @throws {TypeError}  Si los argumentos rompen el contrato.
 */
export function hijoUnico(nodo, ns, local, errores) {
  exigirNodo(nodo, 'hijoUnico')
  exigirNombre(ns, local, 'hijoUnico')
  if (errores !== undefined && !Array.isArray(errores)) {
    throw new TypeError(
      `hijoUnico: 'errores' debe ser un array donde anotar la duplicidad, o estar ausente; ` +
        `recibido ${typeof errores}.`,
    )
  }
  const encontrados = hijos(nodo, ns, local)
  if (encontrados.length === 1) return encontrados[0]
  if (encontrados.length > 1 && errores !== undefined) {
    const segundo = encontrados[1]
    errores.push({
      mensaje:
        `se esperaba un único «${local}» dentro de «${nodo.local}» y hay ` +
        `${encontrados.length} (namespace ${ns === '' ? '(ninguno)' : ns}).`,
      linea: segundo.linea,
      columna: segundo.columna,
    })
  }
  return null
}

/**
 * El texto del elemento, RECORTADO. Es la forma normal de leer un valor
 * (`texto(hijo(parcela, NS_CP, 'areaValue'))` → `'1536'`): los GML vienen
 * sangrados y el salto de línea que rodea al valor nunca forma parte del dato.
 * El texto crudo, sin recortar, está en `nodo.texto`.
 *
 * NO acepta `null`: si el elemento puede faltar, compruébalo antes. Devolver
 * `''` para un elemento ausente confundiría «no está» con «está vacío», que en
 * un GML son cosas distintas (`<cp:label/>` es un dato, su ausencia es otro).
 *
 * @param {NodoXml} nodo
 * @returns {string}
 * @throws {TypeError}  Si `nodo` no es un NodoXml.
 */
export function texto(nodo) {
  exigirNodo(nodo, 'texto')
  return nodo.texto.trim()
}

/**
 * El valor del atributo `(ns, local)`, o `null` si el elemento no lo lleva.
 *
 * RECUERDA la trampa: `srsName`, `count`, `srsDimension`, `uom` y `nilReason`
 * van SIN namespace aunque el documento declare un default, así que se piden con
 * `SIN_NAMESPACE`. Con namespace van `gml:id` y `xsi:nil`.
 *
 * @param {NodoXml} nodo
 * @param {string} ns
 * @param {string} local
 * @returns {string|null}
 * @throws {TypeError}  Si los argumentos rompen el contrato.
 */
export function atributo(nodo, ns, local) {
  exigirNodo(nodo, 'atributo')
  exigirNombre(ns, local, 'atributo')
  const a = nodo.atributos.find((x) => x.ns === ns && x.local === local)
  return a === undefined ? null : a.valor
}

/**
 * Desciende por una ruta de pares `[ns, local]`, tomando el PRIMER hijo que casa
 * en cada paso. Devuelve `null` en cuanto un paso no existe.
 *
 * @param {NodoXml} nodo
 * @param {Array<[string, string]>} pasos  Ruta a recorrer; `[]` devuelve `nodo`.
 * @returns {NodoXml|null}
 * @throws {TypeError}  Si `pasos` no es un array de pares `[string, string]`.
 */
export function ruta(nodo, pasos) {
  exigirNodo(nodo, 'ruta')
  if (!Array.isArray(pasos)) {
    throw new TypeError(
      `ruta: 'pasos' debe ser un array de pares [ns, local]; recibido ${typeof pasos}.`,
    )
  }
  let actual = nodo
  for (const [indice, paso] of pasos.entries()) {
    if (!Array.isArray(paso) || paso.length !== 2) {
      throw new TypeError(
        `ruta: el paso ${indice} debe ser un par [ns, local]; recibido ${JSON.stringify(paso)}.`,
      )
    }
    actual = hijo(actual, paso[0], paso[1])
    if (actual === null) return null
  }
  return actual
}

// ── Escritura · escapado ──────────────────────────────────────────────────────

const ESCAPES_TEXTO = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '\r': '&#13;',
})

const ESCAPES_ATRIBUTO = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\r': '&#13;',
  '\n': '&#10;',
  '\t': '&#9;',
})

/**
 * Escapa un texto de CONTENIDO.
 *
 * `&` y `<` son obligatorios. `>` no lo sería salvo tras `]]`, pero se escapa
 * siempre: así ninguna concatenación futura puede formar un `]]>` accidental.
 * `\r` se escapa como `&#13;` porque el parser (cualquiera, no solo este)
 * normaliza los `\r` LITERALES a `\n` al leer: sin la referencia numérica, el
 * carácter no sobrevive a la ida y vuelta.
 *
 * @param {string} s
 * @returns {string}
 * @throws {TypeError}  Si `s` no es un string.
 */
export function escaparTexto(s) {
  if (typeof s !== 'string') {
    throw new TypeError(`escaparTexto: se esperaba un string; recibido ${typeof s}.`)
  }
  return s.replace(/[&<>\r]/g, (c) => ESCAPES_TEXTO[c])
}

/**
 * Escapa un valor de ATRIBUTO (que este módulo escribe siempre entre comillas
 * dobles, por eso `'` no necesita escaparse y `"` sí).
 *
 * Además de `& < > "`, escapa `\r \n \t` como referencias numéricas: un
 * espacio en blanco LITERAL dentro de un valor de atributo lo convierte el
 * parser en un espacio normal (normalización de XML 1.0 §3.3.3), así que la
 * referencia es la única forma de que el carácter llegue intacto al otro lado.
 *
 * @param {string} s
 * @returns {string}
 * @throws {TypeError}  Si `s` no es un string.
 */
export function escaparAtributo(s) {
  if (typeof s !== 'string') {
    throw new TypeError(`escaparAtributo: se esperaba un string; recibido ${typeof s}.`)
  }
  return s.replace(/[&<>"\r\n\t]/g, (c) => ESCAPES_ATRIBUTO[c])
}

// ── Escritura · árbol de salida ───────────────────────────────────────────────

/** ¿Es `v` un NodoSalida construido por {@link elem}? */
function esNodoSalida(v) {
  return (
    v !== null &&
    typeof v === 'object' &&
    typeof v.nombre === 'string' &&
    Array.isArray(v.atributos)
  )
}

/**
 * Construye un nodo del árbol de salida.
 *
 * Los valores de atributo tienen que ser STRING, nunca números: convertir un
 * número a texto en un GML es una DECISIÓN (cuántos decimales, redondeo hacia
 * dónde) y la regla de oro 11 dice dónde se toma —al serializar, a 2 decimales
 * las coordenadas y entero el `areaValue`—. `elem` no la toma por ti: si le
 * pasas un número, se para y te obliga a escribir el `toFixed(2)` a la vista.
 *
 * @param {string} nombre  Nombre cualificado literal, p. ej. `'cp:areaValue'`.
 * @param {Array<[string, string]>} [atributos=[]]  Pares `[nombre, valor]` en el
 *   ORDEN en que se escribirán.
 * @param {string|NodoSalida[]|null} [contenido=null]  Texto, hijos, o nada.
 * @returns {NodoSalida}
 * @throws {TypeError}  Si algún argumento rompe el contrato.
 */
export function elem(nombre, atributos = [], contenido = null) {
  if (typeof nombre !== 'string' || nombre.length === 0) {
    throw new TypeError(
      `elem: 'nombre' debe ser el nombre cualificado como string no vacío (p. ej. ` +
        `'cp:areaValue'); recibido ${JSON.stringify(nombre)}.`,
    )
  }
  if (!Array.isArray(atributos)) {
    throw new TypeError(
      `elem: 'atributos' debe ser un array de pares [nombre, valor] (array para preservar ` +
        `el ORDEN de escritura); recibido ${typeof atributos}.`,
    )
  }
  const pares = atributos.map((par, i) => {
    if (!Array.isArray(par) || par.length !== 2) {
      throw new TypeError(
        `elem: el atributo ${i} de «${nombre}» debe ser un par [nombre, valor]; recibido ` +
          `${JSON.stringify(par)}.`,
      )
    }
    const [n, v] = par
    if (typeof n !== 'string' || n.length === 0) {
      throw new TypeError(
        `elem: el nombre del atributo ${i} de «${nombre}» debe ser un string no vacío; ` +
          `recibido ${JSON.stringify(n)}.`,
      )
    }
    if (typeof v !== 'string') {
      throw new TypeError(
        `elem: el valor del atributo «${n}» de «${nombre}» debe ser un string; recibido ` +
          `${typeof v}. Convierte tú el número (p. ej. \`x.toFixed(2)\` o ` +
          '`String(Math.round(a))`): cuántos decimales lleva un GML es una decisión del ' +
          'serializador, no de elem.',
      )
    }
    return [n, v]
  })
  if (contenido !== null && typeof contenido !== 'string') {
    if (!Array.isArray(contenido)) {
      throw new TypeError(
        `elem: 'contenido' de «${nombre}» debe ser un string (texto), un array de NodoSalida ` +
          `(hijos) o null; recibido ${typeof contenido}.`,
      )
    }
    contenido.forEach((h, i) => {
      if (!esNodoSalida(h)) {
        throw new TypeError(
          `elem: el hijo ${i} de «${nombre}» no es un NodoSalida (constrúyelo con elem); ` +
            `recibido ${JSON.stringify(h)}.`,
        )
      }
    })
  }
  return { nombre, atributos: pares, contenido }
}

/**
 * Serializa un {@link NodoSalida} a XML con sangrado.
 *
 * Reglas de forma:
 *   · Sin contenido (`null`, `''` o `[]`) → AUTOCERRADO: `<cp:label/>`. `<a></a>`
 *     y `<a/>` son el mismo infoset, y el autocerrado es lo que emite el
 *     generador de referencia para `cp:label` y `cp:nationalCadastralReference`.
 *   · Contenido de texto → una sola línea: `<cp:areaValue uom="m2">1536</cp:areaValue>`.
 *     Nunca se sangra el texto: en `gml:posList` un salto de línea añadido
 *     cambiaría el dato que lee el validador.
 *   · Contenido de hijos → un hijo por línea, sangrado un nivel más.
 *
 * NO emite la declaración XML: la pone el serializador de dominio, que es quien
 * sabe con qué encoding se va a escribir realmente el fichero.
 *
 * @param {NodoSalida} nodo
 * @param {object} [opciones]
 * @param {string} [opciones.indentacion='  ']  Sangrado por nivel. Debe ser solo
 *   espacios/tabuladores: cualquier otra cosa inyectaría texto en el documento.
 * @param {number} [opciones.nivel=0]  Nivel inicial (entero ≥ 0).
 * @returns {string}  XML sin salto de línea final.
 * @throws {TypeError}   Si `nodo` no es un NodoSalida o `indentacion` no es blanco.
 * @throws {RangeError}  Si `nivel` no es un entero ≥ 0.
 */
export function render(nodo, opciones = {}) {
  if (!esNodoSalida(nodo)) {
    throw new TypeError(
      `render: 'nodo' debe ser un NodoSalida construido con elem(); recibido ` +
        `${JSON.stringify(nodo)}.`,
    )
  }
  const { indentacion = '  ', nivel = 0 } = opciones
  if (typeof indentacion !== 'string' || !/^[ \t]*$/.test(indentacion)) {
    throw new TypeError(
      `render: 'opciones.indentacion' debe ser una cadena de espacios o tabuladores; ` +
        `recibido ${JSON.stringify(indentacion)}. Cualquier otro carácter se colaría como ` +
        'texto dentro del XML.',
    )
  }
  if (!Number.isInteger(nivel) || nivel < 0) {
    throw new RangeError(
      `render: 'opciones.nivel' debe ser un entero ≥ 0; recibido ${JSON.stringify(nivel)}.`,
    )
  }

  const sangria = indentacion.repeat(nivel)
  const atr = nodo.atributos
    .map(([n, v]) => ` ${n}="${escaparAtributo(v)}"`)
    .join('')
  const apertura = `<${nodo.nombre}${atr}`
  const c = nodo.contenido

  if (c === null || c === '' || (Array.isArray(c) && c.length === 0)) {
    return `${sangria}${apertura}/>`
  }
  if (typeof c === 'string') {
    return `${sangria}${apertura}>${escaparTexto(c)}</${nodo.nombre}>`
  }
  const dentro = c.map((h) => render(h, { indentacion, nivel: nivel + 1 })).join('\n')
  return `${sangria}${apertura}>\n${dentro}\n${sangria}</${nodo.nombre}>`
}
