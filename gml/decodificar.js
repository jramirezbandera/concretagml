// gml/decodificar.js — F08 · BYTES → TEXTO. El escalón que falta debajo de
// `gml/parse.js`, que recibe un `string` ya hecho y nunca ha sabido de dónde sale.
//
// ── POR QUÉ EXISTE ESTE MÓDULO, Y POR QUÉ INVIERTE LO QUE HABÍA ──────────────
// Hasta F08 el único código del repo que convertía los bytes de un GML en texto
// era un helper de test, y hacía justo lo contrario de lo correcto: leía el
// `encoding=` del prólogo y SE FIABA. Sobre
// `test/fixtures/gml/cp_parcela_9398516VK3799G.gml` —la respuesta real del WFS
// del Catastro— eso decodifica bytes UTF-8 como latin-1 y produce mojibake:
// `0xC3 0xB3` sale como `Ã³` en la palabra «precisión». Nadie lo notó en dos
// features porque la única palabra no-ASCII de ese documento está dentro de un
// comentario XML, que el parser tira.
//
// El fichero MIENTE SOBRE SÍ MISMO: declara `ISO-8859-1` y sus bytes son UTF-8.
// Y no es un fichero cualquiera: es lo que devuelve el servicio oficial. El día
// que un GML ajeno traiga una `ñ` en el `cp:label` o en un topónimo, esa misma
// lógica mete el dato corrupto en el expediente y de ahí al informe, en verde y
// sin una sola queja.
//
// Así que aquí la regla se invierte, y es la regla de oro 8 (verdad numérica
// externa) aplicada al nivel del byte: **MANDAN LOS BYTES, no lo que el fichero
// dice de sí mismo**. UTF-8 en modo `fatal` no es una preferencia, es una
// PRUEBA: si los bytes se dejan decodificar como UTF-8 sin una sola secuencia
// inválida, es que son UTF-8, y da igual lo que declare el prólogo. Y la
// discrepancia no se traga: se reporta (`ENCODING_DESMENTIDO`), porque ningún
// error es silencioso (regla de oro 1) y el usuario tiene derecho a saber que el
// fichero que le pasaron está mal etiquetado.
//
// ── POR QUÉ NO SE USA EL DECODIFICADOR DEL NAVEGADOR ─────────────────────────
// Mismo razonamiento que la cabecera de `gml/xml.js` para el parser XML: la app
// es frontend puro, pero la suite `node` no tiene DOM, y el `DOMParser` del
// navegador tampoco resuelve esto — recibe un string, o sea que alguien ya ha
// tenido que decodificar antes. `TextDecoder` sí es global en los dos entornos
// (es WHATWG Encoding, no DOM), así que este módulo es PURO: corre igual en Node
// y en el bundle, y entra en el barrel.
//
// ── LO QUE ESTE MÓDULO NO PUEDE HACER, DICHO POR ESCRITO ─────────────────────
//   · UTF-16 SIN BOM es indetectable con este método, y está MEDIDO: los bytes
//     `41 00 42 00` («AB» en UTF-16LE) son UTF-8 perfectamente válido —el NUL es
//     un carácter legal— así que la prueba de UTF-8 estricto los acepta y el
//     texto sale con NULs intercalados. No se adivina: no hay ningún GML real
//     que llegue así, y un heurístico de «cuenta los ceros» sería justo la clase
//     de suposición callada que este fichero existe para evitar. Con BOM, que es
//     como los emite cualquier herramienta que use UTF-16, funciona.
//   · UTF-32 no se contempla. `TextDecoder` no lo soporta en absoluto (el
//     estándar Encoding lo retiró), así que no habría con qué decodificarlo
//     aunque se detectase el BOM.
//   · Un fichero MEZCLADO (parte UTF-8, parte latin-1) no existe como concepto:
//     o los bytes enteros pasan la prueba de UTF-8 o no la pasan.
//
// ── FRONTERA ERROR-DE-DATO / ERROR-DE-PROGRAMADOR (SPEC §2.1) ────────────────
// Igual que `gml/xml.js` y `gml/parse.js`: unos bytes que no son texto legible
// son DATO MALO DEL USUARIO y NO lanzan —se decodifican con la reserva y se
// anota `ENCODING_SUPUESTO`—. La excepción se reserva al contrato roto por el
// programador: pasarle un `string` a una función que pide bytes.
//
// Sin dependencias: ni Leaflet, ni Turf, ni nada. Y no lee el reloj.

import { SEVERIDAD, TIPO_GML, crearDeteccionGml } from './_comun.js'

/**
 * @typedef {import('./_comun.js').DeteccionGml} DeteccionGml
 */

// ── Constantes ───────────────────────────────────────────────────────────────

/**
 * Las tres marcas de orden de bytes que se reconocen, en el orden en que hay que
 * probarlas. El de UTF-8 va primero por ser el más largo, pero no colisiona con
 * ninguno de los otros dos; el orden entre UTF-16LE (`FF FE`) y UTF-16BE
 * (`FE FF`) sí importa cero, porque el primer byte ya los distingue.
 *
 * `encoding` es la etiqueta con la que se decodifica el CUERPO (el fichero sin
 * la marca), y coincide con el nombre canónico que devuelve `TextDecoder`.
 *
 * @readonly
 */
const BOMS = Object.freeze([
  Object.freeze({ etiqueta: 'UTF-8', bytes: Object.freeze([0xef, 0xbb, 0xbf]), encoding: 'utf-8' }),
  Object.freeze({ etiqueta: 'UTF-16LE', bytes: Object.freeze([0xff, 0xfe]), encoding: 'utf-16le' }),
  Object.freeze({ etiqueta: 'UTF-16BE', bytes: Object.freeze([0xfe, 0xff]), encoding: 'utf-16be' }),
])

/**
 * Cuántos bytes del principio se miran buscando el prólogo. Un prólogo que no
 * quepa aquí NO ES UN PRÓLOGO: la declaración XML tiene que ser lo primero del
 * documento, así que 256 bytes le sobran con holgura (la más larga de los
 * fixtures reales ocupa 43) y el tope evita recorrer un fichero entero para
 * nada. El helper de test que este módulo sustituye usaba 200; se sube a 256
 * porque una declaración con `standalone` y un encoding de nombre largo cabe
 * peor de lo que parece, y el coste es cero.
 */
const BYTES_PROLOGO = 256

/**
 * El encoding de reserva cuando no hay con qué decidir. `windows-1252` y no
 * `iso-8859-1` porque es su SUPERCONJUNTO: los 32 huecos de control C1 que
 * latin-1 deja sin asignar (0x80–0x9F) son en 1252 comillas tipográficas, guion
 * largo y el símbolo del euro, que es exactamente lo que escupe un Windows
 * español. Decodificar 1252 como latin-1 pierde esos caracteres; al revés no se
 * pierde nada, porque los códigos que sí comparten son idénticos.
 *
 * ⚠️ MEDIDO, y conviene saberlo antes de leer el resto del fichero: el estándar
 * WHATWG Encoding **mapea la etiqueta `ISO-8859-1` a windows-1252**, así que
 * `new TextDecoder('ISO-8859-1').encoding` devuelve literalmente
 * `'windows-1252'`. En la plataforma web latin-1 no existe como decodificador
 * propio. Por eso un fichero honesto que declare `ISO-8859-1` sale de aquí con
 * `encodingUsado: 'windows-1252'` y SIN detección de desmentido: no es una
 * discrepancia, es el mismo decodificador con otro nombre.
 */
const ENCODING_RESERVA = 'windows-1252'

/**
 * El `encoding=` de la declaración XML, tolerando las dos comillas.
 *
 * Imita la expresión del helper de test al que sustituye (`/encoding="([^"]+)"/i`)
 * pero acepta comilla simple, que el XSD de XML permite igual, y se aplica SOLO
 * dentro de la declaración —ver {@link leerEncodingDeclarado}— para que un
 * `encoding="…"` que apareciera dentro de un comentario o de un atributo no se
 * tome por el prólogo.
 */
const RE_ENCODING = /\bencoding\s*=\s*(?:"([^"]*)"|'([^']*)')/i

/** La declaración XML entera, que tiene que ser lo primero del documento. */
const RE_DECLARACION = /^\s*<\?xml\s[\s\S]*?\?>/

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Convierte los bytes de un GML en texto, decidiendo el encoding por PRUEBA y no
 * por lo que el fichero declare, y contando todo lo que ha decidido.
 *
 * El orden de las reglas es fijo y no admite excepciones:
 *
 *   1. **El BOM manda sobre el prólogo.** Si hay marca de orden de bytes, ella
 *      decide, se consume (no se queda en el texto) y se anota `BOM_PRESENTE`.
 *   2. Sin BOM, se prueba `TextDecoder('utf-8', {fatal: true})`. Si no lanza,
 *      **son UTF-8** y se usa.
 *   3. Si el prólogo declaraba otra cosa y los bytes resultaron ser UTF-8, se
 *      anota `ENCODING_DESMENTIDO` con las dos formas — pero solo cuando la
 *      diferencia es DEMOSTRABLE, que no es siempre: ver
 *      {@link pruebaDelDesmentido}.
 *   4. Si la prueba de UTF-8 falla, se decodifica con el encoding declarado. Si
 *      no hay declarado, o el estándar no lo reconoce, o declaraba UTF-8 (que ya
 *      se ha demostrado falso), se usa {@link ENCODING_RESERVA} y se anota
 *      `ENCODING_SUPUESTO`. Nunca se decodifica en silencio.
 *   5. El prólogo se lee sobre los primeros {@link BYTES_PROLOGO} bytes, ANTES
 *      de decidir nada. Uno que no quepa ahí no es un prólogo.
 *
 * @param {ArrayBuffer|Uint8Array} bytes  El fichero tal cual, sin decodificar.
 * @returns {{texto: string, encodingUsado: string, encodingDeclarado: string|null,
 *            detecciones: DeteccionGml[]}}
 *   `texto` es el documento sin BOM; `encodingUsado` es el nombre CANÓNICO del
 *   decodificador que se empleó de verdad (`utf-8`, `windows-1252`, `utf-16le`…),
 *   nunca la etiqueta que puso el fichero; `encodingDeclarado` es esa etiqueta
 *   TAL CUAL venía escrita (o `null` si no hay prólogo con encoding), para que se
 *   pueda enseñar al usuario sin traducir.
 * @throws {TypeError}  Si `bytes` no es un `ArrayBuffer` ni un `Uint8Array`. Un
 *   `string` es el error de programador que este módulo existe para impedir: si
 *   ya tienes texto, alguien decodificó antes y esa decisión se perdió.
 */
export function decodificarGml(bytes) {
  const datos = aBytes(bytes)
  /** @type {DeteccionGml[]} */
  const detecciones = []

  // 1 · El BOM, que manda sobre todo lo demás.
  const bom = detectarBom(datos)
  const cuerpo = bom === null ? datos : datos.subarray(bom.bytes.length)

  if (bom !== null) {
    detecciones.push(
      crearDeteccionGml(
        TIPO_GML.BOM_PRESENTE,
        `El fichero empieza con una marca de orden de bytes (BOM) de ${bom.etiqueta}. ` +
          `Manda sobre lo que declare el prólogo: se ha leído como ${bom.encoding}. La marca ` +
          'se ha retirado del texto, que es lo que exige XML.',
        SEVERIDAD.INFO,
        { bom: bom.etiqueta, longitudBom: bom.bytes.length, encodingUsado: bom.encoding },
      ),
    )
  }

  // 5 · El prólogo se lee siempre, antes de decidir nada.
  const encodingDeclarado = leerEncodingDeclarado(cuerpo, bom)
  if (encodingDeclarado !== null) {
    // Se sigue emitiendo aunque no haya nada que objetar (`gml/parse.js` lo
    // reporta por su lado, y solo cuando no es UTF-8): aquí es INFO y sale
    // SIEMPRE, porque «con qué se leyó este fichero» es información del
    // expediente, no una queja.
    detecciones.push(
      crearDeteccionGml(
        TIPO_GML.ENCODING_DECLARADO,
        `El prólogo del fichero declara «encoding=${JSON.stringify(encodingDeclarado)}».`,
        SEVERIDAD.INFO,
        { encodingDeclarado },
      ),
    )
  }

  const { texto, encodingUsado, supuesto } = decidirYDecodificar(cuerpo, bom, encodingDeclarado)

  if (supuesto !== null) {
    detecciones.push(
      crearDeteccionGml(
        TIPO_GML.ENCODING_SUPUESTO,
        `Los bytes del fichero no son UTF-8 válido y ${supuesto}. Se ha SUPUESTO ` +
          `${encodingUsado} (superconjunto de ISO-8859-1), que es lo más probable en un ` +
          'fichero de este tipo, pero es una suposición: si ves acentos o eñes raros, el ' +
          'fichero venía en otra codificación y habría que reexportarlo en UTF-8.',
        SEVERIDAD.AVISO,
        { encodingDeclarado, encodingUsado, motivo: supuesto },
      ),
    )
  }

  // 3 · Lo que el fichero dice de sí mismo, contrastado con lo que se ha medido.
  // Solo si NO hubo suposición: el mensaje de `ENCODING_SUPUESTO` ya nombra las
  // dos codificaciones y decir lo mismo dos veces con otras palabras es ruido.
  const prueba =
    supuesto === null ? pruebaDelDesmentido(cuerpo, encodingDeclarado, texto, bom) : null
  if (prueba !== null) {
    detecciones.push(
      crearDeteccionGml(
        TIPO_GML.ENCODING_DESMENTIDO,
        `El fichero declara «encoding=${JSON.stringify(encodingDeclarado)}» pero se ha leído ` +
          `como ${encodingUsado}: ${prueba}. Manda el contenido, no la etiqueta. El texto es ` +
          'correcto; lo que está mal es la declaración del fichero, y conviene saberlo antes ' +
          'de dárselo a otro programa que sí se fíe de ella.',
        SEVERIDAD.AVISO,
        { encodingDeclarado, encodingUsado, prueba },
      ),
    )
  }

  return { texto, encodingUsado, encodingDeclarado, detecciones }
}

// ── Fontanería ───────────────────────────────────────────────────────────────

/**
 * Normaliza la entrada a `Uint8Array` o LANZA. Es la única excepción del módulo
 * y es de contrato: no se decodifica lo que ya es texto.
 *
 * Nunca se toca `.buffer`: un `Buffer` de `readFileSync` es una vista sobre un
 * pool compartido con `byteOffset` distinto de cero, y `new Uint8Array(b.buffer)`
 * devolvería el pool entero —kilobytes de otros ficheros— en vez del nuestro. La
 * vista se pasa tal cual, y `subarray` conserva el desplazamiento.
 *
 * @param {unknown} bytes
 * @returns {Uint8Array}
 * @throws {TypeError}
 */
function aBytes(bytes) {
  if (bytes instanceof Uint8Array) return bytes
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes)
  const visto = typeof bytes === 'string' ? `un string de ${bytes.length} caracteres` : typeof bytes
  throw new TypeError(
    `decodificarGml: se esperaba ArrayBuffer o Uint8Array y ha llegado ${visto}. ` +
      'Esta función decide CON QUÉ encoding leer el fichero, así que necesita los bytes ' +
      'sin tocar; si ya tienes texto, alguien decodificó antes y esa decisión se perdió.',
  )
}

/**
 * La marca de orden de bytes del principio, si la hay.
 *
 * @param {Uint8Array} datos
 * @returns {{etiqueta: string, bytes: readonly number[], encoding: string}|null}
 */
function detectarBom(datos) {
  for (const bom of BOMS) {
    if (datos.length < bom.bytes.length) continue
    if (bom.bytes.every((b, i) => datos[i] === b)) return bom
  }
  return null
}

/**
 * El `encoding=` de la declaración XML, leído sobre los primeros
 * {@link BYTES_PROLOGO} bytes del cuerpo (el fichero ya sin BOM).
 *
 * Si hay BOM se decodifica esa cabecera con la codificación que el BOM dicta, y
 * no «como ASCII»: en un fichero UTF-16 el prólogo lleva un `00` entre cada
 * letra y leerlo como ASCII devolvería basura, con lo que un fichero que declara
 * su encoding correctamente saldría de aquí como si no declarase nada. No es
 * saltarse la regla 1 —el BOM sigue mandando y ya ha decidido—: es leer el
 * prólogo con el alfabeto que el propio BOM acaba de fijar.
 *
 * @param {Uint8Array} cuerpo  El fichero SIN la marca de orden de bytes.
 * @param {{encoding: string}|null} bom
 * @returns {string|null}  La etiqueta TAL CUAL viene escrita, recortada, o `null`.
 */
function leerEncodingDeclarado(cuerpo, bom) {
  // `ascii` es una etiqueta que el estándar Encoding mapea a windows-1252, así
  // que nunca lanza ni mete U+FFFD: cualquier byte da un carácter. Da igual cuál
  // sea ese carácter, porque lo único que se busca aquí son letras ASCII.
  const decodificador = new TextDecoder(bom === null ? 'ascii' : bom.encoding)
  const cabecera = decodificador.decode(cuerpo.subarray(0, BYTES_PROLOGO))

  const declaracion = RE_DECLARACION.exec(cabecera)
  if (declaracion === null) return null

  const m = RE_ENCODING.exec(declaracion[0])
  if (m === null) return null

  const etiqueta = (m[1] ?? m[2]).trim()
  return etiqueta.length === 0 ? null : etiqueta
}

/**
 * Aplica las reglas 1, 2 y 4 y devuelve el texto con el nombre canónico del
 * decodificador que se ha usado de verdad.
 *
 * @param {Uint8Array} cuerpo
 * @param {{etiqueta: string, encoding: string}|null} bom
 * @param {string|null} encodingDeclarado
 * @returns {{texto: string, encodingUsado: string, supuesto: string|null}}
 *   `supuesto` es `null` salvo cuando hubo que recurrir a {@link ENCODING_RESERVA};
 *   entonces lleva el motivo, en castellano, listo para el mensaje.
 */
function decidirYDecodificar(cuerpo, bom, encodingDeclarado) {
  // 1 · El BOM manda. Se decodifica con `ignoreBOM` porque la marca ya se ha
  // retirado a mano: si el documento trajera DOS seguidas, la segunda es un
  // carácter de verdad (U+FEFF) y no un adorno que este módulo deba comerse.
  if (bom !== null) {
    return {
      texto: new TextDecoder(bom.encoding, { ignoreBOM: true }).decode(cuerpo),
      encodingUsado: bom.encoding,
      supuesto: null,
    }
  }

  // 2 · La PRUEBA: UTF-8 estricto. Si no lanza, son UTF-8 y se acabó la discusión.
  try {
    return {
      texto: new TextDecoder('utf-8', { fatal: true }).decode(cuerpo),
      encodingUsado: 'utf-8',
      supuesto: null,
    }
  } catch {
    // No son UTF-8. Sigue la regla 4; el detalle del error de `TextDecoder` no
    // aporta nada al usuario («The encoded data was not valid for encoding utf-8»).
  }

  // 4 · Con lo que declare el fichero, si es que declara algo utilizable.
  const canonico = canonizar(encodingDeclarado)
  if (canonico !== null && canonico !== 'utf-8') {
    return {
      texto: new TextDecoder(canonico).decode(cuerpo),
      encodingUsado: canonico,
      supuesto: null,
    }
  }

  const supuesto =
    encodingDeclarado === null
      ? 'su prólogo no declara ninguna codificación'
      : canonico === null
        ? `el estándar Encoding no reconoce la codificación ${JSON.stringify(encodingDeclarado)} ` +
          'que declara'
        : // Declara UTF-8 y acaba de demostrarse que no lo es: volver a usar UTF-8
          // aquí (ya sin `fatal`) sembraría el texto de U+FFFD en silencio, que es
          // el fallo que este módulo existe para no cometer.
          'su prólogo declara UTF-8, que la prueba de arriba acaba de descartar'

  return {
    texto: new TextDecoder(ENCODING_RESERVA).decode(cuerpo),
    encodingUsado: ENCODING_RESERVA,
    supuesto,
  }
}

/**
 * El nombre canónico de una etiqueta de encoding según el estándar Encoding, o
 * `null` si no la reconoce. Se le pregunta al propio `TextDecoder` en vez de
 * mantener una tabla: la tabla de alias tiene cientos de entradas y una copia
 * parcial acabaría discrepando del decodificador que de verdad se usa.
 *
 * @param {string|null} etiqueta
 * @returns {string|null}
 */
function canonizar(etiqueta) {
  if (etiqueta === null) return null
  try {
    return new TextDecoder(etiqueta).encoding
  } catch {
    return null
  }
}

/**
 * ¿Hay PRUEBA de que el prólogo desmiente a los bytes? Devuelve esa prueba, en
 * castellano y lista para el mensaje, o `null` si no la hay.
 *
 * Acusar a un fichero de mentir sobre sí mismo es una afirmación fuerte y aquí
 * se exige demostrarla. Hay TRES EXCEPCIONES que la desactivan, y las tres
 * salieron de MEDIR los fixtures reales del repo:
 *
 *   1. **Nombres distintos, decodificador idéntico.** El estándar Encoding mapea
 *      `ISO-8859-1`, `latin1` y `windows-1252` al MISMO decodificador. Comparar
 *      cadenas de texto acusaría a un fichero honesto por escribir uno de los
 *      tres alias; se compara el nombre canónico.
 *   2. **`UTF-16` a secas con BOM.** El estándar canoniza esa etiqueta a
 *      `utf-16le`, así que un fichero UTF-16BE que declare `UTF-16` —que es lo
 *      correcto: el BOM es justamente lo que dice cuál de las dos es— parecería
 *      estar mintiendo. No lo está.
 *   3. **Y la importante: un documento ÍNTEGRAMENTE ASCII no miente nunca**,
 *      declare lo que declare, porque los dos decodificadores producen el mismo
 *      texto carácter por carácter. No hay prueba, así que no hay acusación.
 *      Esto no es teórico: `bu_building_9398516VK3799G.gml` y
 *      `bu_buildingpart_9398516VK3799G.gml` declaran `ISO-8859-1` y no tienen ni
 *      un byte por encima de 0x7F. Sin esta regla, dos ficheros reales del
 *      Catastro saldrían marcados con un aviso que no se puede sostener —
 *      mientras que `cp_parcela_9398516VK3799G.gml`, con sus `C3 B3` en
 *      «precisión», sí se sostiene y es el caso que da nombre a la detección.
 *
 * La prueba del 3 es directa y no admite discusión: se decodifica otra vez con
 * lo que declara el fichero y se comparan los dos textos. Si salen iguales, la
 * etiqueta era indistinguible de la verdad.
 *
 * @param {Uint8Array} cuerpo
 * @param {string|null} encodingDeclarado
 * @param {string} texto  El que ya se ha producido, con `encodingUsado`.
 * @param {{etiqueta: string, encoding: string}|null} bom
 * @returns {string|null}
 */
function pruebaDelDesmentido(cuerpo, encodingDeclarado, texto, bom) {
  if (encodingDeclarado === null) return null

  // La prueba, en una frase, para reutilizarla en los dos desenlaces.
  const laPrueba =
    bom !== null
      ? `lo demuestra la marca de orden de bytes de ${bom.etiqueta}, que manda sobre el prólogo`
      : 'lo demuestra que sus bytes se decodifican como UTF-8 sin una sola secuencia inválida, ' +
        'cosa que no pasa por casualidad'

  // Ni siquiera es un nombre de codificación: no hay nada con que compararlo, y
  // eso ya es la discrepancia. (Cuando además los bytes eran ilegibles, este
  // camino no se recorre: lo cuenta `ENCODING_SUPUESTO`, que es más específico.)
  const canonico = canonizar(encodingDeclarado)
  if (canonico === null) {
    return `el estándar Encoding no reconoce siquiera ese nombre de codificación, y ${laPrueba}`
  }

  // Excepción 1: el mismo decodificador escrito con otro de sus alias.
  if (canonico === (bom === null ? 'utf-8' : bom.encoding)) return null

  // Excepción 2: `UTF-16` a secas es correcto para las dos variantes si hay BOM.
  const esFamiliaUtf16 = bom !== null && bom.encoding.startsWith('utf-16')
  if (esFamiliaUtf16 && encodingDeclarado.trim().toLowerCase() === 'utf-16') return null

  // Excepción 3, la que salvó a los dos `bu_*.gml`: sin diferencia observable en
  // el texto no hay mentira que demostrar, y sin prueba no se acusa.
  if (new TextDecoder(canonico, { ignoreBOM: true }).decode(cuerpo) === texto) return null

  return laPrueba
}
