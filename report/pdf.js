// report/pdf.js — F09 · UN ESCRITOR DE PDF PROPIO (contrato F del plan de F09).
//
// ── POR QUÉ NO ES jsPDF, Y POR QUÉ ESO NO ES CAPRICHO ───────────────────────
// jsPDF pesa ~350 kB sobre un bundle que hoy está en 554 kB: multiplicaría por
// 1,6 lo que se descarga quien abre la aplicación, para escribir un documento que
// solo necesita texto en Helvetica, líneas, rectángulos y UNA imagen JPEG. Este
// proyecto ya tomó exactamente la misma decisión una vez —`geo/utm.js` implementa
// la serie de Krüger a mano para no meter los 130 kB de proj4, y hay un plugin en
// `vite.config.js` que REVIENTA el build si alguien intenta resolverlo (regla de
// oro 7)—, así que aquí se toma otra vez y por el mismo motivo. El presupuesto de
// este fichero son decenas de kB, no cientos: el día que alguien se vea añadiendo
// fuentes incrustadas, compresión o formularios, lo correcto es PARAR y volver a
// discutir jsPDF, no seguir reimplementándolo a trozos.
//
// Lo que este escritor sabe hacer, y no piensa aprender más:
//   · Texto en Helvetica y Helvetica-Bold, en gris de 0 (negro) a 1 (blanco).
//   · Líneas y rectángulos.
//   · Imágenes JPEG **pegadas tal cual**, sin recodificar ni una muestra.
//   · Medir texto y partirlo en líneas que caben.
//
// ── EL API HABLA EN MILÍMETROS. TODO EL API ─────────────────────────────────
// Quien maqueta un documento piensa en milímetros y en «desde arriba»; el PDF
// piensa en puntos PostScript y en «desde abajo». Las dos traducciones son de este
// módulo y **no se asoman al API**:
//
//   · **Unidades**: milímetros. El ×72/25,4 es interno. Eso incluye el TAMAÑO DE
//     LETRA (ver {@link medirTexto}), que aquí va en mm de altura de em y no en
//     puntos: 3,5 mm ≈ 10 pt, 2,5 mm ≈ 7 pt, 5 mm ≈ 14 pt. Es además la unidad en
//     la que se rotula un plano técnico (ISO 3098), que es el documento que esta
//     herramienta produce. Quien quiera razonar en puntos tiene
//     {@link PUNTOS_POR_MM} exportado para dividir una vez y olvidarse.
//   · **Origen**: esquina SUPERIOR IZQUIERDA, Y hacia ABAJO. La `y` del texto es
//     su LÍNEA BASE (no el alto de la caja); la `(x, y)` de un rectángulo o de una
//     imagen es su esquina superior izquierda.
//
// ── LA TABLA xref ES LA PARTE QUE SE ROMPE ──────────────────────────────────
// Sus entradas son DESPLAZAMIENTOS DE BYTE ABSOLUTOS, en formato fijo de 10
// dígitos, y cada entrada mide exactamente 20 bytes contando el fin de línea. Un
// solo byte de más en cualquier punto del fichero desplaza todo lo que viene
// detrás y el lector no abre el documento —o peor, lo abre y no dice nada.
//
// Consecuencia práctica, y es la razón de que este módulo esté escrito como está:
// **el documento NO se puede construir como un string contando caracteres**. Hay
// bytes de JPEG por medio, y una `ñ` en WinAnsi es un byte pero en JavaScript es
// un carácter; contar `.length` sobre un string daría una cuenta que se parece a
// la buena. Aquí se acumulan `Uint8Array` desde la primera línea y la longitud se
// lleva en BYTES; el único camino que convierte texto a bytes sin pasar por la
// tabla CP1252 es {@link bytesAscii}, que **lanza** si le entra un carácter por
// encima de 0x7F. Esa guarda es lo que impide que el error se cometa por descuido.
//
// ── FUENTES ESTÁNDAR-14: NO SE INCRUSTA NADA ────────────────────────────────
// Helvetica y Helvetica-Bold son dos de las catorce fuentes que todo lector de PDF
// tiene obligación de traer puestas. No se incrusta ni un byte de tipografía —y
// por eso este escritor puede ser pequeño—; solo se declara
// `/Encoding /WinAnsiEncoding`, que es CP1252, que **cubre el español entero**: ñ,
// Ñ, las cinco vocales acentuadas en las dos cajas, ü, Ü, ¿, ¡, º, ª, «», · y €.
//
// Un carácter que NO esté en CP1252 —un emoji, una «ł», una flecha «→»— **se
// sustituye por «?» y SE DECLARA** (regla de oro 1: ningún error silencioso). Se
// declara por dos vías, y las dos a propósito: el `?` se VE en el papel, y la
// sustitución queda anotada en {@link crearDocumentoPdf}`#sustituciones()` con el
// carácter, su punto de código y dónde estaba, para que quien maqueta pueda
// avisar por escrito en vez de enterarse el colegiado al firmar.
//
// Antes de traducir, el texto se normaliza a NFC. Un «ñ» escrito como `n` + U+0303
// —que es como lo guarda macOS en los nombres de fichero— es la misma letra y
// tiene sitio en CP1252 una vez compuesta; sustituirlo sería declarar un problema
// que no existe.
//
// ── DE DÓNDE SALEN LOS ANCHOS AFM, Y CUÁNTO SE FÍAN ─────────────────────────
// {@link ANCHOS_AFM} son las métricas estándar-14 de Adobe, en milésimas de em.
// Sin ellas no hay salto de línea posible: `partirTexto` partiría donde no debe y
// el informe saldría con renglones desbordados fuera del papel.
//
// **Verificación**: la tabla se contrastó carácter a carácter contra los anchos de
// avance reales de `arial.ttf` y `arialbd.ttf` (Arial se diseñó METRIC-COMPATIBLE
// con Helvetica), leyendo su tabla `hmtx` y escalando a milésimas de em.
// **Coinciden 219 de los 224 códigos** de CP1252. Los cinco que no son
// `macron` (0xAF), `plusminus` (0xB1), `mu` (0xB5), `periodcentered` (0xB7) y
// `divide` (0xF7), que son glifos donde Arial y Helvetica sí divergen de verdad.
// Aquí manda el AFM de Adobe, que es la métrica que el lector aplica a una fuente
// estándar-14 sin `/Widths`. El contraste está congelado en
// `test/report/pdf.test.js`, con esas cinco divergencias enumeradas: si alguien
// «corrige» un ancho hacia Arial, el test lo dice y explica por qué no.
//
// Impacto de un ancho ligeramente mal: **solo estético**. El texto sigue siendo
// correcto y el lector lo dibuja con SU métrica; lo que se movería es dónde
// decidimos cortar la línea. Vale la pena saberlo antes de perseguir un fantasma.
//
// ── SIN COMPRIMIR, Y ES DELIBERADO ──────────────────────────────────────────
// Los streams van sin filtro. `zlib` no existe en el navegador sin traerse una
// librería, y el JPEG del plano —cientos de kB— domina el tamaño del fichero de
// tal manera que comprimir el texto ahorraría un porcentaje invisible. Un deflate
// escrito a mano sería justo el tipo de pieza que este fichero existe para no
// tener.
//
// ── PURO ────────────────────────────────────────────────────────────────────
// Sin DOM, sin red y **sin leer el reloj** (hay guardián por grep sobre este texto
// fuente, igual que en `report/contraste-texto.js` y por el mismo motivo: un
// informe descargado es un SNAPSHOT y su prueba tiene que valer igual dentro de un
// año). La fecha de creación de la metadata, si se quiere, **se inyecta**; y se
// rinde por componentes UTC para que el mismo instante dé los mismos bytes en CI y
// en el equipo de quien firma. Cero imports, como toda la capa `report/`.

// ── Medidas y constantes ─────────────────────────────────────────────────────

/**
 * Puntos PostScript por milímetro (72 por pulgada / 25,4 mm por pulgada).
 * Exportado para que quien piense en puntos pueda dividir una vez: el API de este
 * módulo habla SIEMPRE en milímetros, tamaño de letra incluido.
 */
export const PUNTOS_POR_MM = 72 / 25.4

/** A4 en milímetros, que es el papel de todos los informes de esta herramienta. */
export const A4_ANCHO_MM = 210
export const A4_ALTO_MM = 297

/**
 * Lo que se dibuja donde había un carácter sin sitio en CP1252. Es un `?` y no un
 * espacio ni un carácter parecido a propósito: tiene que **verse** en el papel.
 * La sustitución se anota además en `sustituciones()` (regla de oro 1).
 */
export const SUSTITUTO_NO_REPRESENTABLE = '?'

/** El byte de ese sustituto en CP1252. */
const BYTE_SUSTITUTO = 0x3f

/** Las dos únicas fuentes. Más de dos empezaría a ser una librería de tipografía. */
const FUENTES = Object.freeze({
  normal: 'Helvetica',
  negrita: 'Helvetica-Bold',
})

/** Nombre del recurso de cada fuente dentro del PDF. */
const RECURSO_FUENTE = Object.freeze({ normal: '/F1', negrita: '/F2' })

// ── CP1252 (= WinAnsiEncoding) ───────────────────────────────────────────────
//
// Latin-1 (0x20–0x7E y 0xA0–0xFF) es identidad: el punto de código ES el byte.
// Lo único que hay que tabular son los 27 huecos de 0x80–0x9F, donde Windows metió
// las comillas tipográficas, la raya, el euro y compañía. Los seis códigos que
// WinAnsiEncoding deja SIN glifo (0x81, 0x8D, 0x8F, 0x90, 0x9D) no están aquí, y
// por tanto nada se traduce a ellos.

/** Punto de código Unicode → byte, para los 27 caracteres de la franja 0x80–0x9F. */
const ALTOS_CP1252 = Object.freeze({
  0x20ac: 0x80, // €  euro
  0x201a: 0x82, // ‚  quotesinglbase
  0x0192: 0x83, // ƒ  florin
  0x201e: 0x84, // „  quotedblbase
  0x2026: 0x85, // …  ellipsis
  0x2020: 0x86, // †  dagger
  0x2021: 0x87, // ‡  daggerdbl
  0x02c6: 0x88, // ˆ  circumflex
  0x2030: 0x89, // ‰  perthousand
  0x0160: 0x8a, // Š  Scaron
  0x2039: 0x8b, // ‹  guilsinglleft
  0x0152: 0x8c, // Œ  OE
  0x017d: 0x8e, // Ž  Zcaron
  0x2018: 0x91, // '  quoteleft
  0x2019: 0x92, // '  quoteright
  0x201c: 0x93, // "  quotedblleft
  0x201d: 0x94, // "  quotedblright
  0x2022: 0x95, // •  bullet
  0x2013: 0x96, // –  endash
  0x2014: 0x97, // —  emdash
  0x02dc: 0x98, // ˜  tilde
  0x2122: 0x99, // ™  trademark
  0x0161: 0x9a, // š  scaron
  0x203a: 0x9b, // ›  guilsinglright
  0x0153: 0x9c, // œ  oe
  0x017e: 0x9e, // ž  zcaron
  0x0178: 0x9f, // Ÿ  Ydieresis
})

/**
 * Byte CP1252 de un punto de código Unicode, o `-1` si no tiene sitio.
 *
 * Los controles (0x00–0x1F y 0x7F) devuelven `-1` **a propósito**: WinAnsiEncoding
 * no les da glifo, así que un `\n` colado dentro de una llamada a `texto()` es un
 * carácter no representable como cualquier otro y se declara como tal. El salto de
 * línea de verdad lo hace {@link crearDocumentoPdf}`#partirTexto`, que sí los
 * entiende.
 */
function byteCp1252(punto) {
  if (punto >= 0x20 && punto <= 0x7e) return punto
  if (punto >= 0xa0 && punto <= 0xff) return punto
  return ALTOS_CP1252[punto] ?? -1
}

// ── Tablas de anchos AFM (milésimas de em) ───────────────────────────────────
//
// Indexadas por BYTE CP1252, no por punto Unicode. Un 0 significa «ese código no
// tiene glifo», y nunca se consulta porque `byteCp1252` no traduce nada ahí.
// Procedencia y verificación: ver la cabecera del fichero.

/** @type {Readonly<Record<'normal'|'negrita', readonly number[]>>} */
export const ANCHOS_AFM = Object.freeze({
  // Helvetica
  normal: Object.freeze([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 00
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 10
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // 20
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 30
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // 40
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // 50
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // 60
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0, // 70
    556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, // 80
    0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667, // 90
    278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, // a0
    400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, // b0
    667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, // c0
    722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, // d0
    556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, // e0
    556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500, // f0
  ]),
  // Helvetica-Bold
  negrita: Object.freeze([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 00
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 10
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, // 20
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, // 30
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, // 40
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, // 50
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, // 60
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 0, // 70
    556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, // 80
    0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667, // 90
    278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, // a0
    400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, // b0
    722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, // c0
    722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, // d0
    556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, // e0
    611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556, // f0
  ]),
})

// ── Guardas de contrato ──────────────────────────────────────────────────────

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Describe un valor para un mensaje de error, sin reventar con los cíclicos. */
function describir(valor) {
  if (typeof valor === 'string') return JSON.stringify(valor)
  if (valor === null) return 'null'
  if (valor instanceof Uint8Array) return `un Uint8Array de ${valor.length} bytes`
  if (Array.isArray(valor)) return `un array de ${valor.length}`
  if (typeof valor === 'object') return 'un objeto'
  return `${typeof valor} (${String(valor)})`
}

/** Un número finito, o `TypeError`/`RangeError` diciendo cuál y qué se esperaba. */
function exigirNumero(valor, quien, campo) {
  if (typeof valor !== 'number') {
    throw new TypeError(`${quien}: '${campo}' debe ser un número en mm; recibido ${describir(valor)}.`)
  }
  if (!Number.isFinite(valor)) {
    throw new RangeError(`${quien}: '${campo}' no es finito (${String(valor)}).`)
  }
  return valor
}

/** Un número finito y estrictamente positivo. */
function exigirPositivo(valor, quien, campo) {
  exigirNumero(valor, quien, campo)
  if (valor <= 0) {
    throw new RangeError(`${quien}: '${campo}' debe ser mayor que cero; recibido ${valor}.`)
  }
  return valor
}

/** Un gris de 0 (negro) a 1 (blanco), que es la convención del operador `g` del PDF. */
function exigirGris(valor, quien, campo) {
  exigirNumero(valor, quien, campo)
  if (valor < 0 || valor > 1) {
    throw new RangeError(
      `${quien}: '${campo}' es un gris de 0 (negro) a 1 (blanco); recibido ${valor}.`,
    )
  }
  return valor
}

/** Una de las dos fuentes, por su nombre en español. */
function exigirFuente(valor, quien) {
  if (valor !== 'normal' && valor !== 'negrita') {
    throw new RangeError(
      `${quien}: 'fuente' debe ser 'normal' o 'negrita' (Helvetica o Helvetica-Bold); ` +
        `recibido ${describir(valor)}.`,
    )
  }
  return valor
}

// ── Bytes ────────────────────────────────────────────────────────────────────

/**
 * Un string **de ASCII puro** a bytes.
 *
 * El `throw` no es paranoia: es la guarda que hace imposible el error caro de este
 * fichero. Todo lo que se escribe por aquí —nombres de objeto, diccionarios,
 * números, la propia tabla `xref`— es ASCII por construcción; el texto del usuario
 * pasa SIEMPRE por {@link codificarWinAnsi} (content streams) o por
 * {@link codificarUtf16Be} (las cadenas del diccionario `/Info`). Si un día
 * alguien mete una `ñ` en un literal de este módulo, revienta aquí y no en una
 * `xref` desplazada un byte.
 */
function bytesAscii(texto) {
  const salida = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) {
    const codigo = texto.charCodeAt(i)
    if (codigo > 0x7f) {
      throw new RangeError(
        `bytesAscii: el carácter ${JSON.stringify(texto[i])} (U+${codigo
          .toString(16)
          .toUpperCase()
          .padStart(4, '0')}) no es ASCII. La estructura del PDF se escribe en ASCII; ` +
          'el texto del documento va por codificarWinAnsi().',
      )
    }
    salida[i] = codigo
  }
  return salida
}

/**
 * Las sustituciones que PRODUCIRÍA un texto al codificarse a CP1252, **sin
 * escribir nada**.
 *
 * Existe por la nota de composición (`report/maqueta.js#bloqueSustituciones`,
 * auditoría R3): el pie de página se estampa el ÚLTIMO —necesita saber el total
 * de páginas— y la nota se imprime antes, así que sin esta consulta una
 * sustitución ocurrida en el pie quedaría anotada en `sustituciones()` pero no
 * enumerada en el papel. Usa el MISMO codificador que `texto()`: no hay una
 * segunda tabla CP1252 que pueda divergir.
 *
 * @param {string} texto
 * @returns {ReadonlyArray<{caracter: string, punto: number, indice: number}>}
 * @throws {TypeError} Si `texto` no es un string.
 */
export function sustitucionesDe(texto) {
  if (typeof texto !== 'string') {
    throw new TypeError(`sustitucionesDe: se espera un string; recibido ${describir(texto)}.`)
  }
  return Object.freeze(codificarWinAnsi(texto).sustituciones.map((s) => Object.freeze({ ...s })))
}

/**
 * Un texto a bytes CP1252, con la lista de lo que no cupo.
 *
 * @param {string} texto
 * @returns {{bytes: number[], sustituciones: Array<{caracter: string, punto: number, indice: number}>}}
 */
function codificarWinAnsi(texto) {
  const bytes = []
  const sustituciones = []
  // `for…of` sobre un string recorre PUNTOS DE CÓDIGO, no unidades UTF-16: un
  // emoji (par subrogado) sale como un solo carácter y produce un solo `?`, no dos.
  for (const caracter of String(texto).normalize('NFC')) {
    const punto = caracter.codePointAt(0)
    const byte = byteCp1252(punto)
    if (byte >= 0) {
      bytes.push(byte)
      continue
    }
    sustituciones.push({ caracter, punto, indice: bytes.length })
    bytes.push(BYTE_SUSTITUTO)
  }
  return { bytes, sustituciones }
}

/**
 * Un acumulador de bytes que lleva la cuenta de la longitud **en bytes**. Es lo
 * que hace posible la `xref`: `longitud` es el desplazamiento exacto del siguiente
 * byte que se escriba, en cualquier momento.
 */
function crearAcumulador() {
  const trozos = []
  let longitud = 0
  return {
    get longitud() {
      return longitud
    },
    ascii(texto) {
      const b = bytesAscii(texto)
      trozos.push(b)
      longitud += b.length
    },
    crudos(b) {
      trozos.push(b)
      longitud += b.length
    },
    fin() {
      const salida = new Uint8Array(longitud)
      let i = 0
      for (const t of trozos) {
        salida.set(t, i)
        i += t.length
      }
      return salida
    },
  }
}

// ── Números y cadenas dentro del PDF ─────────────────────────────────────────

/**
 * Un número real como lo escribe el PDF: **nunca en notación exponencial**, que la
 * sintaxis del PDF no admite (`1e-7` no es un número para un lector, es basura).
 * Tres decimales sobre puntos son 0,35 µm: sobra para cualquier papel.
 */
function pdfNum(valor) {
  if (!Number.isFinite(valor)) {
    throw new RangeError(`pdfNum: no se puede escribir ${String(valor)} en un PDF.`)
  }
  const texto = valor.toFixed(3).replace(/\.?0+$/, '')
  return texto === '-0' || texto === '' ? '0' : texto
}

/**
 * Los bytes de una cadena literal PDF `(...)`, con `\(`, `\)` y `\\` escapados,
 * y los fines de línea (0x0A, 0x0D) como `\n` y `\r`.
 *
 * Un paréntesis sin escapar desequilibra la cadena, el lector se pierde y el
 * mensaje que da no señala dónde. Los bytes ≥ 0x80 van CRUDOS: son legales dentro
 * de un literal y ahorran tres cuartas partes del espacio frente a un escape octal.
 *
 * Los fines de línea se escapan porque un CR/LF CRUDO dentro de un literal lo
 * normaliza el lector a LF (tratamiento de EOL del PDF) y cambiaría los bytes
 * leídos. En los content streams no pueden aparecer —los controles no tienen
 * glifo en CP1252 y {@link codificarWinAnsi} los sustituye—, pero en el `/Info`
 * en UTF-16BE sí: cualquier punto de código `U+xx0A`/`U+0Axx` mete un 0x0A en
 * mitad de la cadena. El escape es byte-neutral para todo lo que ya se escribía.
 */
function literalPdf(bytesTexto) {
  const salida = [0x28] // '('
  for (const b of bytesTexto) {
    if (b === 0x0a) {
      salida.push(0x5c, 0x6e) // '\n'
      continue
    }
    if (b === 0x0d) {
      salida.push(0x5c, 0x72) // '\r'
      continue
    }
    if (b === 0x28 || b === 0x29 || b === 0x5c) salida.push(0x5c) // '\'
    salida.push(b)
  }
  salida.push(0x29) // ')'
  return Uint8Array.from(salida)
}

/**
 * Un texto a bytes **UTF-16BE con BOM** (`FE FF` + unidades UTF-16 en big-endian),
 * que es la codificación de las cadenas de texto del diccionario `/Info`.
 *
 * ⭐ **Por qué no CP1252 (auditoría R1).** Fuera de los content streams —donde
 * mandan las fuentes y su `/WinAnsiEncoding`— el estándar solo admite
 * PDFDocEncoding o UTF-16BE con BOM. CP1252 y PDFDocEncoding coinciden en
 * 0xA0–0xFF (tildes, ñ, º…) pero DIVERGEN en 0x80–0x9F: un `’` (U+2019, byte
 * 0x92 en CP1252) en el `/Author` se mostraba como `™` en las propiedades del
 * documento. Se elige UTF-16BE y no «PDFDocEncoding real» por dos motivos de
 * estilo de este escritor: (1) no necesita una SEGUNDA tabla de codificación que
 * mantener junto a la de CP1252, y (2) representa CUALQUIER carácter, así que la
 * metadata nunca degrada a `?` aunque el cuerpo sí tenga que sustituir. Las
 * unidades UTF-16 del propio string de JavaScript YA SON la codificación: los
 * pares subrogados viajan tal cual, que es exactamente UTF-16.
 *
 * El cuerpo del documento no cambia: las fuentes siguen con `/WinAnsiEncoding`.
 *
 * @param {string} texto
 * @returns {number[]}  Bytes, BOM incluido.
 */
function codificarUtf16Be(texto) {
  const bytes = [0xfe, 0xff]
  const normalizado = String(texto).normalize('NFC')
  for (let i = 0; i < normalizado.length; i++) {
    const unidad = normalizado.charCodeAt(i)
    bytes.push(unidad >> 8, unidad & 0xff)
  }
  return bytes
}

/**
 * Una fecha en el formato de fecha del PDF: `D:AAAAMMDDhhmmssZ00'00'`.
 *
 * Se rinde por **componentes UTC** —nunca por un formateador dependiente del
 * entorno— por el mismo motivo que `report/contraste-texto.js#fechaLarga`: el
 * mismo instante tiene que producir los mismos bytes en CI y en el equipo de quien
 * firma, o el snapshot de bytes de este módulo no afirmaría nada.
 */
function fechaPdf(fecha) {
  const dos = (n) => String(n).padStart(2, '0')
  return (
    `D:${fecha.getUTCFullYear()}${dos(fecha.getUTCMonth() + 1)}${dos(fecha.getUTCDate())}` +
    `${dos(fecha.getUTCHours())}${dos(fecha.getUTCMinutes())}${dos(fecha.getUTCSeconds())}Z00'00'`
  )
}

// ── El JPEG: se inspecciona, no se recodifica ────────────────────────────────

/** Marcadores SOF con Huffman, que es lo que `/DCTDecode` sabe descomprimir. */
const SOF_HUFFMAN = new Set([0xc0, 0xc1, 0xc2])
/** Los demás SOF: sin pérdida, jerárquicos o con codificación aritmética. */
const SOF_AJENOS = new Set([0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

/**
 * Lee del propio JPEG su tamaño real y su número de componentes.
 *
 * Existe por una razón MEDIDA (F09/T0.1): al WMS del Catastro se le pueden pedir
 * 4200×100 px y devuelve 4000×2000, con HTTP 200 y sin una palabra. Un escritor
 * que se creyera el tamaño que le declaran pondría en el papel un plano con toda
 * la geometría descolocada y nadie se enteraría; eso es error silencioso de manual
 * (regla de oro 1). Así que el tamaño se LEE del fichero y lo declarado se
 * contrasta contra él.
 *
 * @param {Uint8Array} bytes
 * @returns {{anchoPx: number, altoPx: number, componentes: number}}
 */
function inspeccionarJpeg(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new RangeError(
      'imagenJpeg: los bytes no empiezan por el marcador SOI (FF D8) de un JPEG. ' +
        'Se pegan tal cual en el PDF, así que tienen que ser un JPEG de verdad.',
    )
  }
  let i = 2
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) {
      throw new RangeError(
        `imagenJpeg: se esperaba un marcador (FF) en el byte ${i} y hay ` +
          `0x${bytes[i].toString(16).padStart(2, '0')}: el JPEG está truncado o corrupto.`,
      )
    }
    let marcador = bytes[i + 1]
    // Un marcador puede venir precedido de tantos FF de relleno como quiera.
    while (marcador === 0xff && i + 2 < bytes.length) {
      i += 1
      marcador = bytes[i + 1]
    }
    i += 2
    // Marcadores sin carga útil.
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd8)) continue
    // SOS (inicio del barrido) y EOI: a partir de aquí ya no hay cabeceras.
    if (marcador === 0xda || marcador === 0xd9) break
    const longitud = (bytes[i] << 8) | bytes[i + 1]
    if (SOF_AJENOS.has(marcador)) {
      throw new RangeError(
        `imagenJpeg: el JPEG usa el marcador SOF 0x${marcador.toString(16)} (sin pérdida, ` +
          'jerárquico o con codificación aritmética). El filtro /DCTDecode del PDF descomprime ' +
          'DCT con Huffman; hay que recodificar la imagen como JPEG normal.',
      )
    }
    if (SOF_HUFFMAN.has(marcador)) {
      return {
        altoPx: (bytes[i + 3] << 8) | bytes[i + 4],
        anchoPx: (bytes[i + 5] << 8) | bytes[i + 6],
        componentes: bytes[i + 7],
      }
    }
    if (longitud < 2) {
      throw new RangeError(`imagenJpeg: segmento de longitud ${longitud} en el byte ${i}.`)
    }
    i += longitud
  }
  throw new RangeError(
    'imagenJpeg: el JPEG no trae marcador SOF: no se puede saber ni su tamaño ni si es en color.',
  )
}

/** Espacio de color del PDF según los componentes que declare el propio JPEG. */
function espacioDeColor(componentes) {
  if (componentes === 3) return '/DeviceRGB'
  if (componentes === 1) return '/DeviceGray'
  throw new RangeError(
    `imagenJpeg: el JPEG trae ${componentes} componentes. Se admiten 3 (color, que es lo que ` +
      'devuelve el WMS del Catastro) y 1 (gris); un JPEG CMYK de 4 necesita además el vector ' +
      '/Decode invertido de Adobe y queda fuera del alcance de este escritor.',
  )
}

// ── El documento ─────────────────────────────────────────────────────────────

/**
 * Un documento PDF que se dibuja en milímetros y se entrega en bytes.
 *
 * ```js
 * const doc = crearDocumentoPdf({anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM})
 * doc.texto('INFORME DE CONTRASTE', {x: 20, y: 25, tam: 5, fuente: 'negrita'})
 * doc.linea(20, 28, 190, 28, {grosor: 0.4})
 * for (const linea of doc.partirTexto(parrafo, 170, {tam: 3.2})) { … }
 * doc.pagina()
 * const bytes = doc.bytes()
 * ```
 *
 * ### Lo que hay que tener presente
 *
 *   · **Milímetros en todo**, tamaño de letra incluido (3,5 mm ≈ 10 pt).
 *   · **Origen arriba a la izquierda, Y hacia abajo.** La `y` de un texto es su
 *     línea base; la de un rectángulo o una imagen, su borde superior.
 *   · **El documento nace con UNA página ya abierta.** Un PDF sin páginas no es un
 *     PDF válido, así que aquí no se puede construir uno por descuido: `pagina()`
 *     significa «salta a una hoja nueva», y `nPaginas()` nunca devuelve 0.
 *   · **Se dibuja siempre en la página actual**, que es la última creada salvo que
 *     se haya movido con `irAPagina()`.
 *   · Un carácter fuera de CP1252 se dibuja como `?` **y queda anotado** en
 *     `sustituciones()` (regla de oro 1).
 *
 * @param {Object} opciones
 * @param {number} opciones.anchoMm  Ancho del papel, en milímetros.
 * @param {number} opciones.altoMm   Alto del papel, en milímetros.
 * @param {string|null} [opciones.titulo=null]  `/Title` de la metadata.
 * @param {string|null} [opciones.autor=null]   `/Author` de la metadata.
 * @param {string|null} [opciones.productor='Concreta GML']  `/Producer`.
 * @param {Date|null} [opciones.fecha=null]  `/CreationDate`. **Se inyecta**: este
 *   módulo no consulta el reloj (ver la cabecera del fichero). Con `null` —el
 *   valor por defecto— el documento sale sin fecha de creación, que es más honrado
 *   que inventarla.
 * @returns {Object} El documento.
 * @throws {TypeError} Si `opciones` no es un objeto o las medidas no son números.
 * @throws {RangeError} Si las medidas no son finitas y positivas, o si `fecha` es
 *   una fecha inválida.
 */
export function crearDocumentoPdf(opciones) {
  if (!esObjeto(opciones)) {
    throw new TypeError(
      `crearDocumentoPdf: se espera un objeto {anchoMm, altoMm}; recibido ${describir(opciones)}.`,
    )
  }
  const {
    anchoMm,
    altoMm,
    titulo = null,
    autor = null,
    productor = 'Concreta GML',
    fecha = null,
  } = opciones
  exigirPositivo(anchoMm, 'crearDocumentoPdf', 'anchoMm')
  exigirPositivo(altoMm, 'crearDocumentoPdf', 'altoMm')
  if (fecha !== null) {
    if (!(fecha instanceof Date)) {
      throw new TypeError(
        `crearDocumentoPdf: 'fecha' debe ser una fecha o null; recibido ${describir(fecha)}. ` +
          'Este módulo no consulta el reloj: la fecha de creación entra por parámetro.',
      )
    }
    if (!Number.isFinite(fecha.getTime())) {
      throw new RangeError("crearDocumentoPdf: 'fecha' es inválida (tiempo no finito).")
    }
  }

  const anchoPt = anchoMm * PUNTOS_POR_MM
  const altoPt = altoMm * PUNTOS_POR_MM

  /** Cada página es una lista de trozos de su content stream. */
  const paginas = [{ trozos: [] }]
  let actual = 0

  /** Fuentes que se han llegado a usar: solo esas se declaran como objeto. */
  const fuentesUsadas = new Set()

  /** Las imágenes, en orden de incrustación. `/Im0`, `/Im1`… */
  const imagenes = []

  /** Todo lo que no cupo en CP1252, de todo el documento. */
  const sustituciones = []

  const emitir = (texto) => paginas[actual].trozos.push(bytesAscii(texto))
  const emitirCrudos = (b) => paginas[actual].trozos.push(b)

  /** Milímetro del API (Y hacia abajo) → punto del PDF (Y hacia arriba). */
  const aY = (mm) => (altoMm - mm) * PUNTOS_POR_MM
  const aX = (mm) => mm * PUNTOS_POR_MM

  /**
   * Ancho de un texto en milésimas de em. Los caracteres sin sitio en CP1252 se
   * miden **con el ancho del sustituto**, que es lo que de verdad se va a dibujar:
   * medir una cosa y pintar otra sería un desbordamiento garantizado.
   */
  function milesimas(texto, fuente) {
    const tabla = ANCHOS_AFM[fuente]
    let suma = 0
    for (const caracter of String(texto).normalize('NFC')) {
      const byte = byteCp1252(caracter.codePointAt(0))
      suma += tabla[byte >= 0 ? byte : BYTE_SUSTITUTO]
    }
    return suma
  }

  const documento = {
    /** Ancho del papel en milímetros, tal como se pidió. */
    anchoMm,
    /** Alto del papel en milímetros, tal como se pidió. */
    altoMm,

    /**
     * Abre una página nueva **al final** y se planta en ella.
     * @returns {number} El número (1-based) de la página recién abierta.
     */
    pagina() {
      paginas.push({ trozos: [] })
      actual = paginas.length - 1
      return paginas.length
    },

    /** Cuántas páginas tiene el documento. Nunca 0. */
    nPaginas() {
      return paginas.length
    },

    /** En qué página se está dibujando ahora mismo (1-based). */
    paginaActual() {
      return actual + 1
    },

    /**
     * Se planta en una página ya existente, para volver a ella.
     *
     * No está en el contrato original y se añade por una necesidad concreta de la
     * maqueta: **«Página 1 de 5» no se puede escribir hasta saber que son cinco**.
     * Sin esto, quien maqueta tendría que componer el documento entero dos veces.
     *
     * @param {number} n  Número de página, 1-based.
     */
    irAPagina(n) {
      exigirNumero(n, 'irAPagina', 'n')
      if (!Number.isInteger(n) || n < 1 || n > paginas.length) {
        throw new RangeError(
          `irAPagina: la página ${n} no existe; el documento tiene ${paginas.length}.`,
        )
      }
      actual = n - 1
      return n
    },

    /**
     * Ancho que ocuparía un texto, en milímetros.
     *
     * @param {string} texto
     * @param {Object} opciones
     * @param {number} opciones.tam  Altura de em **en milímetros** (3,5 ≈ 10 pt).
     * @param {'normal'|'negrita'} [opciones.fuente='normal']
     * @returns {number} Milímetros.
     */
    medirTexto(texto, opciones) {
      if (typeof texto !== 'string') {
        throw new TypeError(`medirTexto: se espera un string; recibido ${describir(texto)}.`)
      }
      if (!esObjeto(opciones)) {
        throw new TypeError(
          `medirTexto: se espera un objeto {tam, fuente}; recibido ${describir(opciones)}.`,
        )
      }
      const { tam, fuente = 'normal' } = opciones
      exigirPositivo(tam, 'medirTexto', 'tam')
      exigirFuente(fuente, 'medirTexto')
      return (milesimas(texto, fuente) / 1000) * tam
    },

    /**
     * Parte un texto en líneas que **caben** en `anchoMm`.
     *
     * Reglas, y las dos primeras divergen de `report/contraste-texto.js#envolver`
     * a propósito:
     *
     *   1. **Ninguna línea devuelta excede el ancho pedido.** En un fichero de
     *      texto una línea larga la reajusta el editor; en un papel se sale de la
     *      hoja y se pierde. Es la aserción que atrapa una tabla AFM mal copiada.
     *   2. Una palabra más larga que el ancho —una referencia catastral pegada a
     *      una URL— **se parte por donde toque**. Única excepción posible: si ni
     *      un solo carácter cabe, ese carácter sale solo (no hay unidad menor).
     *   3. Los saltos de línea del texto de entrada **se respetan** como saltos
     *      forzados; el resto de espacios en blanco son oportunidades de corte.
     *   4. Un texto sin ni una palabra devuelve `['']`, no `[]`: una línea en
     *      blanco mantiene el ritmo vertical de quien la estaba componiendo.
     *
     * @param {string} texto
     * @param {number} anchoMm  Ancho útil de la caja, en milímetros.
     * @param {Object} opciones
     * @param {number} opciones.tam
     * @param {'normal'|'negrita'} [opciones.fuente='normal']
     * @returns {string[]}  Al menos una línea.
     */
    partirTexto(texto, anchoUtilMm, opciones) {
      if (typeof texto !== 'string') {
        throw new TypeError(`partirTexto: se espera un string; recibido ${describir(texto)}.`)
      }
      exigirPositivo(anchoUtilMm, 'partirTexto', 'anchoMm')
      if (!esObjeto(opciones)) {
        throw new TypeError(
          `partirTexto: se espera un objeto {tam, fuente}; recibido ${describir(opciones)}.`,
        )
      }
      const { tam, fuente = 'normal' } = opciones
      exigirPositivo(tam, 'partirTexto', 'tam')
      exigirFuente(fuente, 'partirTexto')

      // Se trabaja en milésimas de em enteras y se compara contra el ancho
      // convertido a esa misma escala: así el corte no depende de acumular
      // décimas de milímetro en coma flotante.
      const tope = (anchoUtilMm / tam) * 1000
      const tabla = ANCHOS_AFM[fuente]
      const anchoDe = (caracter) => {
        const byte = byteCp1252(caracter.codePointAt(0))
        return tabla[byte >= 0 ? byte : BYTE_SUSTITUTO]
      }
      const espacio = anchoDe(' ')

      /** Trocea una palabra que no cabe entera. Devuelve al menos un trozo. */
      const trocear = (palabra) => {
        const trozos = []
        let acumulado = ''
        let ancho = 0
        for (const caracter of palabra) {
          const w = anchoDe(caracter)
          if (acumulado !== '' && ancho + w > tope) {
            trozos.push(acumulado)
            acumulado = ''
            ancho = 0
          }
          acumulado += caracter
          ancho += w
        }
        trozos.push(acumulado)
        return trozos
      }

      const salida = []
      for (const bloque of String(texto).normalize('NFC').split(/\r\n|\r|\n/)) {
        const palabras = bloque.split(/\s+/).filter((p) => p !== '')
        let linea = ''
        let ancho = 0
        for (const palabra of palabras) {
          const anchoPalabra = milesimas(palabra, fuente)
          if (linea !== '' && ancho + espacio + anchoPalabra <= tope) {
            linea += ` ${palabra}`
            ancho += espacio + anchoPalabra
            continue
          }
          if (linea !== '') {
            salida.push(linea)
            linea = ''
            ancho = 0
          }
          if (anchoPalabra <= tope) {
            linea = palabra
            ancho = anchoPalabra
            continue
          }
          const trozos = trocear(palabra)
          for (const t of trozos.slice(0, -1)) salida.push(t)
          linea = trozos[trozos.length - 1]
          ancho = milesimas(linea, fuente)
        }
        salida.push(linea)
      }
      return salida
    },

    /**
     * Escribe una línea de texto. **`y` es la LÍNEA BASE**, no el alto de la caja.
     *
     * @param {string} texto  Una sola línea; el salto lo hace {@link partirTexto}.
     * @param {Object} opciones
     * @param {number} opciones.x  Milímetros desde el borde izquierdo.
     * @param {number} opciones.y  Milímetros desde el borde SUPERIOR, hasta la base.
     * @param {number} opciones.tam  Altura de em en milímetros.
     * @param {'normal'|'negrita'} [opciones.fuente='normal']
     * @param {number} [opciones.gris=0]  0 negro … 1 blanco.
     * @returns {{ancho: number, sustituciones: Array}}  El ancho real ocupado en
     *   mm y **lo que no cupo en CP1252 en esta llamada**, que quien maqueta tiene
     *   que poder ver sin buscarlo (regla de oro 1).
     */
    texto(texto, opciones) {
      if (typeof texto !== 'string') {
        throw new TypeError(`texto: se espera un string; recibido ${describir(texto)}.`)
      }
      if (!esObjeto(opciones)) {
        throw new TypeError(
          `texto: se espera un objeto {x, y, tam, fuente, gris}; recibido ${describir(opciones)}.`,
        )
      }
      const { x, y, tam, fuente = 'normal', gris = 0 } = opciones
      exigirNumero(x, 'texto', 'x')
      exigirNumero(y, 'texto', 'y')
      exigirPositivo(tam, 'texto', 'tam')
      exigirFuente(fuente, 'texto')
      exigirGris(gris, 'texto', 'gris')

      fuentesUsadas.add(fuente)
      const { bytes: bytesTexto, sustituciones: nuevas } = codificarWinAnsi(texto)
      for (const s of nuevas) {
        sustituciones.push(
          Object.freeze({
            ...s,
            sustituto: SUSTITUTO_NO_REPRESENTABLE,
            pagina: actual + 1,
            x,
            y,
            texto,
          }),
        )
      }

      // `q`/`Q` aísla el color: sin ellos, un gris se quedaría puesto para todo lo
      // que se dibujara después y el fallo aparecería tres funciones más allá.
      emitir(
        `q\n${pdfNum(gris)} g\nBT\n${RECURSO_FUENTE[fuente]} ${pdfNum(tam * PUNTOS_POR_MM)} Tf\n` +
          `1 0 0 1 ${pdfNum(aX(x))} ${pdfNum(aY(y))} Tm\n`,
      )
      emitirCrudos(literalPdf(bytesTexto))
      emitir(' Tj\nET\nQ\n')

      return {
        ancho: (milesimas(texto, fuente) / 1000) * tam,
        sustituciones: Object.freeze(nuevas.map((s) => Object.freeze({ ...s }))),
      }
    },

    /**
     * Una línea recta.
     *
     * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
     * @param {Object} [opciones]
     * @param {number} [opciones.grosor=0.2]  Milímetros.
     * @param {number} [opciones.gris=0]
     */
    linea(x1, y1, x2, y2, opciones = {}) {
      if (!esObjeto(opciones)) {
        throw new TypeError(`linea: se espera un objeto {grosor, gris}; recibido ${describir(opciones)}.`)
      }
      exigirNumero(x1, 'linea', 'x1')
      exigirNumero(y1, 'linea', 'y1')
      exigirNumero(x2, 'linea', 'x2')
      exigirNumero(y2, 'linea', 'y2')
      const { grosor = 0.2, gris = 0 } = opciones
      exigirPositivo(grosor, 'linea', 'grosor')
      exigirGris(gris, 'linea', 'gris')

      emitir(
        `q\n${pdfNum(gris)} G\n${pdfNum(grosor * PUNTOS_POR_MM)} w\n` +
          `${pdfNum(aX(x1))} ${pdfNum(aY(y1))} m\n${pdfNum(aX(x2))} ${pdfNum(aY(y2))} l\nS\nQ\n`,
      )
    },

    /**
     * Un rectángulo. `(x, y)` es su esquina **superior izquierda**.
     *
     * @param {number} x @param {number} y @param {number} w @param {number} h
     * @param {Object} [opciones]
     * @param {number|null} [opciones.relleno=null]  Gris del relleno, o `null`.
     * @param {number|null} [opciones.trazo=null]    Gris del borde, o `null`.
     * @param {number} [opciones.grosor=0.2]
     * @throws {RangeError} Si no se pide ni relleno ni trazo: un rectángulo
     *   invisible es una llamada que no hace nada, y eso no se traga en silencio.
     */
    rect(x, y, w, h, opciones = {}) {
      if (!esObjeto(opciones)) {
        throw new TypeError(
          `rect: se espera un objeto {relleno, trazo, grosor}; recibido ${describir(opciones)}.`,
        )
      }
      exigirNumero(x, 'rect', 'x')
      exigirNumero(y, 'rect', 'y')
      exigirNumero(w, 'rect', 'w')
      exigirNumero(h, 'rect', 'h')
      const { relleno = null, trazo = null, grosor = 0.2 } = opciones
      if (relleno === null && trazo === null) {
        throw new RangeError(
          "rect: hay que pedir 'relleno', 'trazo' o los dos; un rectángulo sin ninguno no " +
            'dibujaría nada y la llamada se perdería sin decirlo.',
        )
      }
      if (relleno !== null) exigirGris(relleno, 'rect', 'relleno')
      if (trazo !== null) {
        exigirGris(trazo, 'rect', 'trazo')
        exigirPositivo(grosor, 'rect', 'grosor')
      }

      let ops = 'q\n'
      if (relleno !== null) ops += `${pdfNum(relleno)} g\n`
      if (trazo !== null) ops += `${pdfNum(trazo)} G\n${pdfNum(grosor * PUNTOS_POR_MM)} w\n`
      // El `re` del PDF toma la esquina INFERIOR izquierda: hay que bajar por el alto.
      ops += `${pdfNum(aX(x))} ${pdfNum(aY(y + h))} ${pdfNum(w * PUNTOS_POR_MM)} ${pdfNum(
        h * PUNTOS_POR_MM,
      )} re\n`
      ops += relleno !== null && trazo !== null ? 'B\n' : relleno !== null ? 'f\n' : 'S\n'
      emitir(`${ops}Q\n`)
    },

    /**
     * Incrusta un JPEG **sin recodificarlo**. `(x, y)` es su esquina superior
     * izquierda; `anchoMm`/`altoMm` es el tamaño con el que se imprime.
     *
     * Los `anchoPx`/`altoPx` son opcionales y **son lo DECLARADO**: si se pasan,
     * se contrastan contra lo que dice el propio JPEG y no cuadrar es un error
     * (ver {@link inspeccionarJpeg} para por qué eso importa tanto aquí).
     *
     * @param {Uint8Array} bytesJpeg
     * @param {Object} opciones
     * @param {number} opciones.x @param {number} opciones.y
     * @param {number} opciones.anchoMm @param {number} opciones.altoMm
     * @param {number} [opciones.anchoPx] @param {number} [opciones.altoPx]
     * @returns {{nombre: string, anchoPx: number, altoPx: number, componentes: number, ppp: number}}
     */
    imagenJpeg(bytesJpeg, opciones) {
      if (!(bytesJpeg instanceof Uint8Array)) {
        throw new TypeError(
          `imagenJpeg: se espera un Uint8Array con los bytes del JPEG; recibido ${describir(
            bytesJpeg,
          )}.`,
        )
      }
      if (!esObjeto(opciones)) {
        throw new TypeError(
          `imagenJpeg: se espera un objeto {x, y, anchoMm, altoMm}; recibido ${describir(opciones)}.`,
        )
      }
      const { x, y, anchoMm: anchoCaja, altoMm: altoCaja, anchoPx, altoPx } = opciones
      exigirNumero(x, 'imagenJpeg', 'x')
      exigirNumero(y, 'imagenJpeg', 'y')
      exigirPositivo(anchoCaja, 'imagenJpeg', 'anchoMm')
      exigirPositivo(altoCaja, 'imagenJpeg', 'altoMm')

      const real = inspeccionarJpeg(bytesJpeg)
      const colorspace = espacioDeColor(real.componentes)
      if (anchoPx !== undefined && anchoPx !== real.anchoPx) {
        throw new RangeError(
          `imagenJpeg: se declaran ${anchoPx} px de ancho y el JPEG trae ${real.anchoPx}. ` +
            'Está MEDIDO que el WMS del Catastro sustituye el tamaño pedido sin avisar: si ' +
            'no cuadran, el plano saldría con la geometría descolocada.',
        )
      }
      if (altoPx !== undefined && altoPx !== real.altoPx) {
        throw new RangeError(
          `imagenJpeg: se declaran ${altoPx} px de alto y el JPEG trae ${real.altoPx}. ` +
            'Está MEDIDO que el WMS del Catastro sustituye el tamaño pedido sin avisar: si ' +
            'no cuadran, el plano saldría con la geometría descolocada.',
        )
      }

      const nombre = `/Im${imagenes.length}`
      imagenes.push({ nombre, bytes: bytesJpeg, ...real, colorspace })

      emitir(
        `q\n${pdfNum(anchoCaja * PUNTOS_POR_MM)} 0 0 ${pdfNum(altoCaja * PUNTOS_POR_MM)} ` +
          `${pdfNum(aX(x))} ${pdfNum(aY(y + altoCaja))} cm\n${nombre} Do\nQ\n`,
      )

      return {
        nombre,
        anchoPx: real.anchoPx,
        altoPx: real.altoPx,
        componentes: real.componentes,
        // Resolución efectiva sobre el papel: el dato que dice si el plano sale a
        // 300 ppp de verdad o si se está estirando una imagen pequeña.
        ppp: real.anchoPx / (anchoCaja / 25.4),
      }
    },

    /**
     * Todo lo que no cupo en CP1252 en todo el documento, en orden de escritura.
     * Vacío es la respuesta normal; que no lo esté es una nota que quien maqueta
     * tiene que poder poner por escrito.
     */
    sustituciones() {
      return Object.freeze([...sustituciones])
    },

    /**
     * El documento entero, en bytes.
     *
     * Se puede llamar más de una vez y con el documento a medias: no consume ni
     * cierra nada. Los objetos se numeran aquí, en el orden en que se escriben, y
     * cada desplazamiento se toma del acumulador **justo antes** de escribir el
     * objeto: la `xref` no se calcula, se observa.
     *
     * @returns {Uint8Array}
     */
    bytes() {
      const buf = crearAcumulador()

      // ── Numeración de objetos ──────────────────────────────────────────────
      // 1 Catalog · 2 Pages · 3 Resources · luego las fuentes que se hayan usado,
      // las imágenes, y por cada página su objeto Page y su stream de contenido.
      const orden = ['normal', 'negrita'].filter((f) => fuentesUsadas.has(f))
      let siguiente = 4
      const numFuente = new Map()
      for (const f of orden) numFuente.set(f, siguiente++)
      const numImagen = imagenes.map(() => siguiente++)
      const numPagina = []
      const numContenido = []
      for (let i = 0; i < paginas.length; i++) {
        numPagina.push(siguiente++)
        numContenido.push(siguiente++)
      }
      const hayInfo = titulo !== null || autor !== null || productor !== null || fecha !== null
      const numInfo = hayInfo ? siguiente++ : 0
      const nObjetos = siguiente // los objetos son 1 … nObjetos-1

      const desplazamientos = new Array(nObjetos).fill(0)
      const abrir = (num) => {
        desplazamientos[num] = buf.longitud
        buf.ascii(`${num} 0 obj\n`)
      }
      const cerrar = () => buf.ascii('endobj\n')

      // ── Cabecera ───────────────────────────────────────────────────────────
      buf.ascii('%PDF-1.4\n')
      // La línea de comentario con cuatro bytes por encima de 127 es lo que hace
      // que cualquier herramienta que transporte el fichero lo trate como BINARIO
      // y no le «arregle» los finales de línea, que es la forma clásica de destruir
      // un PDF sin tocarlo.
      buf.crudos(Uint8Array.of(0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a))

      // ── 1 · Catalog ────────────────────────────────────────────────────────
      abrir(1)
      buf.ascii('<< /Type /Catalog /Pages 2 0 R >>\n')
      cerrar()

      // ── 2 · Pages ──────────────────────────────────────────────────────────
      abrir(2)
      buf.ascii(
        `<< /Type /Pages /Count ${paginas.length} /Kids [${numPagina
          .map((n) => `${n} 0 R`)
          .join(' ')}] >>\n`,
      )
      cerrar()

      // ── 3 · Resources, compartido por todas las páginas ────────────────────
      // Uno solo y referenciado desde cada Page. Colgarlo del nodo Pages y confiar
      // en la herencia también sería legal, pero cada página que lo declara es un
      // lector menos que puede tener una opinión distinta.
      abrir(3)
      const fuenteEntradas = orden.map((f) => `${RECURSO_FUENTE[f]} ${numFuente.get(f)} 0 R`)
      const imagenEntradas = imagenes.map((im, i) => `${im.nombre} ${numImagen[i]} 0 R`)
      buf.ascii(
        `<< /ProcSet [/PDF /Text /ImageC]${
          fuenteEntradas.length > 0 ? ` /Font << ${fuenteEntradas.join(' ')} >>` : ''
        }${imagenEntradas.length > 0 ? ` /XObject << ${imagenEntradas.join(' ')} >>` : ''} >>\n`,
      )
      cerrar()

      // ── Fuentes ────────────────────────────────────────────────────────────
      for (const f of orden) {
        abrir(numFuente.get(f))
        buf.ascii(
          `<< /Type /Font /Subtype /Type1 /BaseFont /${FUENTES[f]} ` +
            '/Encoding /WinAnsiEncoding >>\n',
        )
        cerrar()
      }

      // ── Imágenes ───────────────────────────────────────────────────────────
      for (let i = 0; i < imagenes.length; i++) {
        const im = imagenes[i]
        abrir(numImagen[i])
        buf.ascii(
          `<< /Type /XObject /Subtype /Image /Width ${im.anchoPx} /Height ${im.altoPx} ` +
            `/ColorSpace ${im.colorspace} /BitsPerComponent 8 /Filter /DCTDecode ` +
            `/Length ${im.bytes.length} >>\nstream\n`,
        )
        buf.crudos(im.bytes)
        buf.ascii('\nendstream\n')
        cerrar()
      }

      // ── Páginas y contenidos ───────────────────────────────────────────────
      for (let i = 0; i < paginas.length; i++) {
        abrir(numPagina[i])
        buf.ascii(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfNum(anchoPt)} ${pdfNum(altoPt)}] ` +
            `/Resources 3 0 R /Contents ${numContenido[i]} 0 R >>\n`,
        )
        cerrar()

        const contenido = paginas[i].trozos
        const largo = contenido.reduce((s, t) => s + t.length, 0)
        abrir(numContenido[i])
        buf.ascii(`<< /Length ${largo} >>\nstream\n`)
        for (const t of contenido) buf.crudos(t)
        buf.ascii('\nendstream\n')
        cerrar()
      }

      // ── Info ───────────────────────────────────────────────────────────────
      // Las cadenas de TEXTO van en UTF-16BE con BOM y no en CP1252: fuera de los
      // content streams el estándar exige PDFDocEncoding o UTF-16BE, y CP1252
      // diverge de PDFDocEncoding justo en 0x80–0x9F (€, comillas tipográficas,
      // – y —). Ver {@link codificarUtf16Be} para la decisión entera (R1).
      // La fecha NO: `fechaPdf` produce ASCII puro y el formato `D:…` del PDF es
      // una cadena de bytes, no de texto.
      if (hayInfo) {
        abrir(numInfo)
        buf.ascii('<< ')
        const campo = (clave, valor) => {
          buf.ascii(`/${clave} `)
          buf.crudos(literalPdf(codificarUtf16Be(valor)))
          buf.ascii(' ')
        }
        if (titulo !== null) campo('Title', titulo)
        if (autor !== null) campo('Author', autor)
        if (productor !== null) campo('Producer', productor)
        if (fecha !== null) {
          buf.ascii('/CreationDate ')
          buf.crudos(literalPdf(bytesAscii(fechaPdf(fecha))))
          buf.ascii(' ')
        }
        buf.ascii('>>\n')
        cerrar()
      }

      // ── xref ───────────────────────────────────────────────────────────────
      // Cada entrada mide EXACTAMENTE 20 bytes: 10 de desplazamiento, espacio, 5 de
      // generación, espacio, la marca, y un fin de línea de dos caracteres. Aquí es
      // donde un byte de más en cualquier sitio anterior sale a la luz.
      const desplazamientoXref = buf.longitud
      buf.ascii(`xref\n0 ${nObjetos}\n`)
      buf.ascii('0000000000 65535 f\r\n')
      for (let n = 1; n < nObjetos; n++) {
        buf.ascii(`${String(desplazamientos[n]).padStart(10, '0')} 00000 n\r\n`)
      }

      // ── trailer ────────────────────────────────────────────────────────────
      buf.ascii(
        `trailer\n<< /Size ${nObjetos} /Root 1 0 R${hayInfo ? ` /Info ${numInfo} 0 R` : ''} >>\n` +
          `startxref\n${desplazamientoXref}\n%%EOF\n`,
      )

      return buf.fin()
    },
  }

  return documento
}
