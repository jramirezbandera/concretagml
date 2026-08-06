// export/xlsx.js — F20 · T1.1. EL ESCRITOR DE LIBROS DE EXCEL.
//
// La cuarta salida de esta herramienta —después del GML (F04), el PDF (F09), el DXF
// y el listado de texto (F10)— y la segunda que se escribe byte a byte en casa.
//
// **Este módulo sabe de OOXML y de ZIP, y no sabe qué es una parcela.** Recibe hojas,
// filas y celdas; devuelve `Uint8Array`. Quien decide qué va en cada celda es
// `export/excel-coordenadas.js`, que a su vez no sabe una palabra de XML. Es el mismo
// reparto, y por el mismo motivo, que `report/pdf.js` (el formato) frente a
// `report/pdf-parcela.js` (la maqueta, que «no calcula ni una cifra»): un cambio de
// aspecto no debe poder romper el contenedor, y un arreglo del contenedor no debe
// obligar a releer la maqueta.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ POR QUÉ UN ESCRITOR PROPIO, Y POR QUÉ ESTO NO ES UNA TEMERIDAD
// ═══════════════════════════════════════════════════════════════════════════════
// Un `.xlsx` es un ZIP con seis ficherillos de XML dentro. Suena a librería y no lo
// es: **medido antes de escribir una línea de producción** (F20 · M1), un prototipo
// de ~120 líneas produce un libro que **openpyxl 3.1.5 abre con `testzip()` limpio**,
// con los números como números (`float`, no texto), el formato `0.00` intacto, los
// bordes, la negrita, el relleno y la tilde de «Vértice» exacta.
//
// El precedente es F09: se descartó jsPDF y `package.json` no cambió en toda la
// fase. Aquí igual — **ni una dependencia nueva**.
//
// ── EL ZIP VA SIN COMPRIMIR, Y ES DELIBERADO ────────────────────────────────
// Todas las entradas van en `STORE` (método 0). Es literalmente el argumento que
// `report/pdf.js:90-96` ya dejó escrito para los streams del PDF: *«un deflate
// escrito a mano sería justo el tipo de pieza que este fichero existe para no
// tener»*. Y aquí el precio está medido: **~4,3 kB fijos y ~90 B por vértice**, o sea
// que una parcela de 400 vértices ocupa unos 40 kB. Comprimir ahorraría bytes que
// nadie va a notar a cambio del algoritmo más delicado del formato.
//
// (`CompressionStream('deflate-raw')` existe en los navegadores modernos y **no se
// usa**: es asíncrono, obligaría a que toda esta capa —hoy pura y síncrona— devolviera
// promesas, y no existe en el proyecto Vitest `node` sin más ceremonia. Un cambio de
// arquitectura por unos kB que no se ven.)
//
// ── EL RELOJ NO SE LEE AQUÍ. TAMPOCO PARA EL ZIP ────────────────────────────
// Un ZIP guarda fecha y hora de modificación por entrada, así que el formato **pide**
// un reloj. No se le da: `fecha` entra por parámetro como en todo `gml/`, `report/` y
// `export/`, y por lo mismo — un fichero descargado es un snapshot y su prueba tiene
// que valer igual dentro de un año. Consecuencia buena: **el mismo libro produce los
// mismos bytes**, en CI y en el equipo de quien firma.
//
// ── LO QUE NO SE EMITE, Y POR QUÉ ───────────────────────────────────────────
//   · **`xl/sharedStrings.xml`.** Las cadenas van `inlineStr`, dentro de su celda.
//     La tabla de cadenas compartidas es una segunda contabilidad —índices que
//     apuntan a otro fichero— que puede desincronizarse, y en una tabla de
//     coordenadas casi no hay texto repetido que ahorrar.
//   · **`docProps/core.xml` y `docProps/app.xml`.** Son opcionales, y lo que llevan
//     dentro es sobre todo fechas y nombre de aplicación: dos cosas más que
//     mantener al día para que un lector enseñe un metadato que a nadie de este
//     recorrido le hace falta.
//   · **`xl/theme/theme1.xml`.** Opcional. Los colores se declaran en `styles.xml`
//     por su valor RGB, que es lo que hace que no dependan de un tema.
//
// ── ESTILOS: UN CATÁLOGO CERRADO, NO UN MOTOR DE FORMATO ───────────────────
// {@link ESTILO} tiene diez entradas y no admite formato arbitrario. Es a propósito:
// el día que la maqueta pueda pedir «negrita, 13pt, naranja» este módulo pasa a ser
// una librería de hojas de cálculo, que es lo que no queremos ser. Diez estilos
// cubren la tabla que se pidió; el undécimo se añade cuando haga falta y con nombre.

// ── Límites del formato ──────────────────────────────────────────────────────

/**
 * Filas y columnas que admite una hoja de Excel (desde 2007). Se comprueban porque
 * pasarse no da un fichero grande: da un fichero que **no abre**.
 *
 * @readonly
 */
export const MAX_FILAS = 1_048_576

/** @readonly */
export const MAX_COLUMNAS = 16_384

/**
 * Longitud máxima del nombre de una pestaña. Excel corta por aquí.
 *
 * @readonly
 */
export const MAX_NOMBRE_HOJA = 31

/**
 * Caracteres que Excel prohíbe en el nombre de una pestaña. Se comprueban en vez de
 * sanearse en silencio: los nombres de este proyecto los pone la maqueta con
 * literales suyos («Contorno exterior», «Hueco 1»), así que uno inválido es un error
 * del programador y no un dato del usuario — y ahí este proyecto lanza (SPEC §2.1).
 *
 * @readonly
 */
export const PROHIBIDOS_NOMBRE_HOJA = Object.freeze([':', '\\', '/', '?', '*', '[', ']'])

/**
 * Lo que se escribe donde había un carácter que XML no admite. Mismo criterio, y
 * mismo carácter, que `report/pdf.js#SUSTITUTO_NO_REPRESENTABLE`: se sustituye y se
 * puede afirmar en una prueba, en vez de recortar el texto sin decirlo.
 *
 * @readonly
 */
export const SUSTITUTO_NO_REPRESENTABLE = '?'

// ── El catálogo de estilos ───────────────────────────────────────────────────

/**
 * Los diez estilos que este escritor sabe aplicar. **Están nombrados por lo que
 * FORMATEAN, no por lo que significan** —`DECIMAL` y no `COORDENADA`, `METROS` y no
 * `PERIMETRO`—: en cuanto un estilo se llama como un concepto del dominio, este
 * módulo ha dejado de ser genérico.
 *
 * El orden **importa**: es el índice dentro de `cellXfs` en `styles.xml`, y cambiarlo
 * mueve el formato de todas las celdas ya escritas. Hay una prueba que lo ata.
 *
 * @readonly
 */
export const ESTILO = Object.freeze({
  /** Sin nada: texto plano, sin borde. */
  NORMAL: 'NORMAL',
  /** Título del documento: negrita mayor, centrado, con recuadro. */
  TITULO: 'TITULO',
  /**
   * Etiqueta de un dato dentro de un bloque recuadrado («Identificador:»): negrita
   * **con** recuadro. Es la que reproduce la caja de la imagen de partida, donde
   * todas las celdas del encabezado van enmarcadas.
   */
  ETIQUETA: 'ETIQUETA',
  /** Rótulo de una sección suelta («Medidas»): negrita **sin** recuadro. */
  ROTULO: 'ROTULO',
  /** Cabecera de columna: negrita, fondo gris y recuadro. */
  CABECERA: 'CABECERA',
  /** Celda de texto dentro de una tabla: recuadro. */
  TEXTO: 'TEXTO',
  /** Número entero dentro de una tabla. */
  ENTERO: 'ENTERO',
  /** Número con dos decimales dentro de una tabla. */
  DECIMAL: 'DECIMAL',
  /** Número con dos decimales y la unidad `m` pegada por el formato. */
  METROS: 'METROS',
  /** Número con dos decimales y la unidad `m²` pegada por el formato. */
  METROS_CUADRADOS: 'METROS_CUADRADOS',
  /** Nota al pie: cursiva y gris. */
  APUNTE: 'APUNTE',
})

/**
 * Índice de cada estilo dentro de `cellXfs`. Deriva de {@link ESTILO} para que no
 * puedan divergir: añadir un estilo al catálogo sin darle su `xf` sería una celda
 * apuntando a un formato que no existe.
 */
const INDICE_ESTILO = Object.freeze(
  Object.fromEntries(Object.values(ESTILO).map((nombre, i) => [nombre, i])),
)

/**
 * ⚠️ **Las unidades van en el FORMATO, no en el valor.** `1.535,87 m²` escrito como
 * texto es una celda que no se puede sumar; escrito como número con el formato
 * `0.00" m²"` se ve igual y sigue siendo un número. Es la misma decisión que hace
 * que las coordenadas no se conviertan a cadena.
 *
 * Los identificadores por debajo de 164 están reservados a los formatos que Excel
 * trae de fábrica, así que los propios empiezan ahí.
 */
const NUM_FMT = Object.freeze([
  { id: 164, codigo: '0.00' },
  { id: 165, codigo: '0.00" m"' },
  { id: 166, codigo: '0.00" m²"' },
])

/** `styles.xml` completo. Es constante: el catálogo de estilos es cerrado. */
function hojaDeEstilos() {
  const numFmts = NUM_FMT.map((f) => `<numFmt numFmtId="${f.id}" formatCode="${atributo(f.codigo)}"/>`)

  // 0 normal · 1 negrita 12 · 2 negrita 11 · 3 cursiva gris 10
  const fonts = [
    '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="12"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>',
    '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>',
    '<font><i/><sz val="10"/><color rgb="FF595959"/><name val="Calibri"/><family val="2"/></font>',
  ]

  // 0 y 1 son obligatorios y en este orden: Excel da por hecho que el relleno 0 es
  // «ninguno» y el 1 `gray125`. Un fichero que se los salte abre con los colores
  // corridos una posición.
  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>',
  ]

  const borders = [
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>',
  ]

  // El orden de este array ES {@link ESTILO}. Ver el comentario de INDICE_ESTILO.
  const xfs = [
    // NORMAL
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    // TITULO
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
    // ETIQUETA
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>',
    // ROTULO
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
    // CABECERA
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>',
    // TEXTO
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>',
    // ENTERO
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>',
    // DECIMAL
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>',
    // METROS
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>',
    // METROS_CUADRADOS
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>',
    // APUNTE
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1"/></xf>',
  ]

  return (
    `${DECLARACION_XML}<styleSheet xmlns="${NS_HOJA}">` +
    `<numFmts count="${numFmts.length}">${numFmts.join('')}</numFmts>` +
    `<fonts count="${fonts.length}">${fonts.join('')}</fonts>` +
    `<fills count="${fills.length}">${fills.join('')}</fills>` +
    `<borders count="${borders.length}">${borders.join('')}</borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  )
}

// ── XML ──────────────────────────────────────────────────────────────────────

const DECLARACION_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const NS_HOJA = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL_DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_TIPOS = 'http://schemas.openxmlformats.org/package/2006/content-types'
const NS_RELS = 'http://schemas.openxmlformats.org/package/2006/relationships'

/**
 * Los caracteres de control que XML 1.0 **no admite en ningún caso** —todo lo que
 * está por debajo de 0x20 salvo tabulador, salto de línea y retorno— más los dos
 * huecos de sustitutos sueltos que romperían el UTF-8. Se sustituyen por
 * {@link SUSTITUTO_NO_REPRESENTABLE}.
 *
 * Sin esto, un byte de control colado en un nombre de expediente produce un fichero
 * que Excel rechaza entero con un mensaje que no menciona el carácter: exactamente el
 * fallo que es imposible de diagnosticar desde el otro lado.
 *
 * ⚠️ **Va escrito con escapes `\u`, y no con los caracteres literales**, aunque
 * el motor de expresiones regulares admita las dos formas: escritos a pelo convierten
 * este fichero fuente en BINARIO a ojos de `git` y de `grep`, que es justo como se leen
 * y se auditan aquí los módulos. Medido al escribirlo: con los literales dentro, `grep`
 * contesta «Binary file export/xlsx.js matches» y deja de poder citar una línea.
 */
const NO_REPRESENTABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g

/** Escapa un texto para meterlo entre etiquetas. */
function texto(valor) {
  return String(valor)
    .replace(NO_REPRESENTABLE, SUSTITUTO_NO_REPRESENTABLE)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Escapa un texto para meterlo en un valor de atributo (comillas incluidas). */
function atributo(valor) {
  return texto(valor).replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/**
 * Índice de columna (1) → letra de columna (`A`), como las nombra Excel.
 *
 * @param {number} n  1-indexado.
 * @returns {string}
 */
export function letraDeColumna(n) {
  if (!Number.isInteger(n) || n < 1 || n > MAX_COLUMNAS) {
    throw new RangeError(
      `letraDeColumna: la columna debe ser un entero entre 1 y ${MAX_COLUMNAS}; recibido ${JSON.stringify(n)}.`,
    )
  }
  let resto = n
  let letras = ''
  while (resto > 0) {
    const modulo = (resto - 1) % 26
    letras = String.fromCharCode(65 + modulo) + letras
    resto = Math.floor((resto - modulo) / 26)
  }
  return letras
}

// ── CRC-32 ───────────────────────────────────────────────────────────────────

/**
 * Tabla del CRC-32 de ZIP (polinomio invertido `0xEDB88320`). Se construye una vez
 * al cargar el módulo: son 256 entradas y sale más barato que calcularlo bit a bit
 * por cada byte de cada entrada del fichero.
 */
const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabla[n] = c >>> 0
  }
  return tabla
})()

/**
 * CRC-32 de un bloque de bytes, el mismo que exige el ZIP.
 *
 * **No sale del barrel**: es la pieza más delicada del contenedor y publicarla
 * invitaría a componer ZIPs por fuera de este módulo, que es justo lo que existe para
 * impedir. Se exporta aquí para que su prueba pueda contrastarla contra los vectores
 * conocidos del algoritmo, no para que la use nadie más.
 *
 * @param {Uint8Array} bytes
 * @returns {number}  Entero sin signo de 32 bits.
 */
export function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ── ZIP ──────────────────────────────────────────────────────────────────────

const codificador = new TextEncoder()

const u16 = (n) => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff)
const u32 = (n) => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff)

function unir(bloques) {
  let total = 0
  for (const b of bloques) total += b.length
  const salida = new Uint8Array(total)
  let p = 0
  for (const b of bloques) {
    salida.set(b, p)
    p += b.length
  }
  return salida
}

/**
 * Fecha y hora al formato MS-DOS que guarda el ZIP: dos palabras de 16 bits, con la
 * hora en pasos de **dos segundos** y el año contado desde **1980**.
 *
 * Se rinde por componentes UTC, igual que `gml/_comun.js#dateTimeCatastro` y que el
 * pie del listado de texto, para que el mismo instante dé los mismos bytes en
 * cualquier equipo. Una fecha anterior a 1980 **no cabe en el formato** y se sujeta
 * a su primer instante representable, en vez de emitir un año negativo que deja el
 * fichero ilegible.
 *
 * @param {Date} fecha
 * @returns {{hora: number, dia: number}}
 */
function fechaDos(fecha) {
  const anio = fecha.getUTCFullYear()
  if (anio < 1980) return { hora: 0, dia: (1 << 5) | 1 }
  const hora =
    (fecha.getUTCHours() << 11) | (fecha.getUTCMinutes() << 5) | (fecha.getUTCSeconds() >> 1)
  const dia = ((anio - 1980) << 9) | ((fecha.getUTCMonth() + 1) << 5) | fecha.getUTCDate()
  return { hora, dia }
}

/**
 * Empaqueta las entradas en un ZIP con todo en `STORE`.
 *
 * @param {Array<{nombre: string, contenido: string}>} entradas
 * @param {Date} fecha
 * @returns {Uint8Array}
 */
function empaquetar(entradas, fecha) {
  const { hora, dia } = fechaDos(fecha)
  const locales = []
  const central = []
  let desplazamiento = 0

  for (const { nombre, contenido } of entradas) {
    const datos = codificador.encode(contenido)
    const nom = codificador.encode(nombre)
    const crc = crc32(datos)

    // Bandera 0x0800: el nombre de la entrada va en UTF-8. Los nuestros son ASCII,
    // pero declararlo es gratis y es lo que impide que un lector lo interprete con
    // la página de códigos del sistema el día que deje de serlo.
    const cabecera = [u16(20), u16(0x0800), u16(0), u16(hora), u16(dia)]
    const tamanos = [u32(crc), u32(datos.length), u32(datos.length)]

    const local = unir([
      u32(0x04034b50),
      ...cabecera,
      ...tamanos,
      u16(nom.length),
      u16(0),
      nom,
      datos,
    ])
    locales.push(local)

    central.push(
      unir([
        u32(0x02014b50),
        u16(20), // versión con la que se creó
        ...cabecera,
        ...tamanos,
        u16(nom.length),
        u16(0), // extra
        u16(0), // comentario
        u16(0), // disco
        u16(0), // atributos internos
        u32(0), // atributos externos
        u32(desplazamiento),
        nom,
      ]),
    )
    desplazamiento += local.length
  }

  const directorio = unir(central)
  const fin = unir([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entradas.length),
    u16(entradas.length),
    u32(directorio.length),
    u32(desplazamiento),
    u16(0),
  ])

  return unir([...locales, directorio, fin])
}

// ── Validación de la entrada ─────────────────────────────────────────────────

const describir = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v))

function validarNombreHoja(nombre, i) {
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new TypeError(
      `serializarLibroXlsx: la hoja ${i} necesita un 'nombre' de texto no vacío; recibido ` +
        `${describir(nombre)}.`,
    )
  }
  if (nombre.length > MAX_NOMBRE_HOJA) {
    throw new RangeError(
      `serializarLibroXlsx: el nombre de la hoja ${i} tiene ${nombre.length} caracteres y Excel ` +
        `admite ${MAX_NOMBRE_HOJA}: ${describir(nombre)}. Los nombres los pone la maqueta con ` +
        'literales suyos, así que esto es un contrato roto y no un dato del usuario.',
    )
  }
  const malo = PROHIBIDOS_NOMBRE_HOJA.find((c) => nombre.includes(c))
  if (malo !== undefined) {
    throw new RangeError(
      `serializarLibroXlsx: el nombre de la hoja ${i} lleva el carácter ${describir(malo)}, que ` +
        `Excel prohíbe en una pestaña (${PROHIBIDOS_NOMBRE_HOJA.join(' ')}): ${describir(nombre)}.`,
    )
  }
  if (nombre.startsWith("'") || nombre.endsWith("'")) {
    throw new RangeError(
      `serializarLibroXlsx: el nombre de la hoja ${i} no puede empezar ni acabar en apóstrofo, ` +
        `que es como Excel entrecomilla las referencias entre hojas: ${describir(nombre)}.`,
    )
  }
}

// ── Composición de una hoja ──────────────────────────────────────────────────

/**
 * Una celda ya normalizada, o `null` si no hay que emitirla.
 *
 * ⭐ **Una celda puede estar VACÍA Y EXISTIR**, y la diferencia no es sutil: una
 * celda combinada (`A1:C1`) solo dibuja el borde de las celdas que están de verdad en
 * el fichero, así que un recuadro que abarque tres columnas necesita las tres, con
 * estilo y sin contenido. Es lo que Excel escribe cuando tú combinas a mano.
 *
 * La regla, entonces:
 *
 *   · `null`, `undefined` o `''` **sueltos** → la celda no se emite.
 *   · `{estilo: X}` sin valor, con `X` distinto de `NORMAL` → **se emite vacía con su
 *     estilo**. Pedir un formato para una celda es afirmar que esa celda existe.
 *   · `{estilo: 'NORMAL'}` sin valor → no se emite: una celda vacía sin formato no
 *     aporta nada al fichero y solo lo engorda.
 *
 * @param {*} celda
 * @param {string} donde  Para el mensaje de error.
 * @returns {{valor: string|number|null, estilo: string}|null}
 */
function normalizarCelda(celda, donde) {
  if (celda === null || celda === undefined || celda === '') return null

  // Atajo cómodo y sin ambigüedad: un texto o un número sueltos son una celda sin
  // estilo. Lo usa media maqueta, y evita `{valor: 'x', estilo: 'NORMAL'}` por
  // triplicado en cada fila.
  const objeto =
    typeof celda === 'object' && !Array.isArray(celda) ? celda : { valor: celda, estilo: ESTILO.NORMAL }

  const { valor = null, estilo = ESTILO.NORMAL } = objeto

  if (!(estilo in INDICE_ESTILO)) {
    throw new RangeError(
      `serializarLibroXlsx: ${donde} pide el estilo ${describir(estilo)}, que no está en el ` +
        `catálogo. Válidos: ${Object.keys(INDICE_ESTILO).join(', ')}.`,
    )
  }
  if (valor === null || valor === undefined || valor === '') {
    return estilo === ESTILO.NORMAL ? null : { valor: null, estilo }
  }

  if (typeof valor !== 'string' && typeof valor !== 'number') {
    throw new TypeError(
      `serializarLibroXlsx: ${donde} tiene un valor que no es texto ni número: ${describir(valor)}. ` +
        'Una celda vacía se escribe como null o como cadena vacía.',
    )
  }
  if (typeof valor === 'number' && !Number.isFinite(valor)) {
    throw new RangeError(
      `serializarLibroXlsx: ${donde} tiene el número ${String(valor)}, que no se puede escribir en ` +
        'una hoja de cálculo. Un dato que no consta se escribe como texto.',
    )
  }
  return { valor, estilo }
}

/**
 * Compone `xl/worksheets/sheetN.xml`.
 *
 * @param {{nombre: string, filas: Array<Array<*>>, columnas?: Array<{ancho: number}>, combinaciones?: string[]}} hoja
 * @param {number} indice
 * @returns {string}
 */
function componerHoja(hoja, indice) {
  const { filas = [], columnas = [], combinaciones = [] } = hoja

  if (!Array.isArray(filas)) {
    throw new TypeError(
      `serializarLibroXlsx: 'filas' de la hoja ${indice} debe ser un array; recibido ${describir(filas)}.`,
    )
  }
  if (filas.length > MAX_FILAS) {
    throw new RangeError(
      `serializarLibroXlsx: la hoja ${indice} tiene ${filas.length} filas y Excel admite ` +
        `${MAX_FILAS}. Un fichero que se pasa no es un fichero grande: es un fichero que no abre.`,
    )
  }

  let maxColumnas = 0
  let maxFila = 0
  const xmlFilas = []

  filas.forEach((fila, f) => {
    if (fila === null || fila === undefined) return
    if (!Array.isArray(fila)) {
      throw new TypeError(
        `serializarLibroXlsx: la fila ${f + 1} de la hoja ${indice} debe ser un array de celdas; ` +
          `recibido ${describir(fila)}.`,
      )
    }
    if (fila.length > MAX_COLUMNAS) {
      throw new RangeError(
        `serializarLibroXlsx: la fila ${f + 1} de la hoja ${indice} tiene ${fila.length} columnas y ` +
          `Excel admite ${MAX_COLUMNAS}.`,
      )
    }

    const numeroFila = f + 1
    const celdas = []
    fila.forEach((celda, c) => {
      const normal = normalizarCelda(celda, `la celda ${letraDeColumna(c + 1)}${numeroFila} de la hoja ${indice}`)
      if (normal === null) return
      if (c + 1 > maxColumnas) maxColumnas = c + 1

      const ref = `${letraDeColumna(c + 1)}${numeroFila}`
      const s = INDICE_ESTILO[normal.estilo]
      const atrEstilo = s === 0 ? '' : ` s="${s}"`
      if (normal.valor === null) {
        // Existe y no lleva nada: es la celda que completa un recuadro combinado.
        celdas.push(`<c r="${ref}"${atrEstilo}/>`)
      } else if (typeof normal.valor === 'number') {
        celdas.push(`<c r="${ref}"${atrEstilo}><v>${normal.valor}</v></c>`)
      } else {
        celdas.push(
          `<c r="${ref}"${atrEstilo} t="inlineStr"><is><t xml:space="preserve">${texto(normal.valor)}</t></is></c>`,
        )
      }
    })

    // Una fila entera vacía no se emite: el XML de una hoja con huecos es más corto
    // y Excel la sigue enseñando en blanco, que es lo que se quería.
    if (celdas.length > 0) {
      xmlFilas.push(`<row r="${numeroFila}">${celdas.join('')}</row>`)
      maxFila = numeroFila
    }
  })

  const cols =
    columnas.length === 0
      ? ''
      : `<cols>${columnas
          .map((col, i) => {
            const ancho = col?.ancho
            if (!Number.isFinite(ancho) || ancho <= 0) {
              throw new RangeError(
                `serializarLibroXlsx: el ancho de la columna ${i + 1} de la hoja ${indice} debe ser ` +
                  `un número positivo; recibido ${describir(ancho)}.`,
              )
            }
            return `<col min="${i + 1}" max="${i + 1}" width="${ancho}" customWidth="1"/>`
          })
          .join('')}</cols>`

  const merges =
    combinaciones.length === 0
      ? ''
      : `<mergeCells count="${combinaciones.length}">${combinaciones
          .map((ref) => `<mergeCell ref="${atributo(ref)}"/>`)
          .join('')}</mergeCells>`

  // `dimension` es opcional en el esquema y se emite igualmente: es lo que llevan los
  // ficheros que escribe Excel, y un lector que la use para reservar memoria no tiene
  // por qué recorrer el documento entero para averiguarla.
  // ⚠️ Se mide sobre lo REALMENTE escrito y no sobre `filas.length`: una maqueta que
  // deje renglones en blanco al final —cosa que la de F20 hace— declararía un rango
  // más alto que su última celda, y `dimension` dejaría de decir la verdad.
  const dimension = `<dimension ref="A1:${letraDeColumna(Math.max(maxColumnas, 1))}${Math.max(maxFila, 1)}"/>`

  return (
    `${DECLARACION_XML}<worksheet xmlns="${NS_HOJA}">${dimension}` +
    `<sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>${cols}` +
    `<sheetData>${xmlFilas.join('')}</sheetData>${merges}</worksheet>`
  )
}

// ── Typedefs ─────────────────────────────────────────────────────────────────

/**
 * Una celda. Un texto o un número sueltos valen como atajo de
 * `{valor, estilo: 'NORMAL'}`; `null` y `''` son la celda vacía.
 *
 * @typedef {string|number|null|{valor: string|number, estilo?: string}} Celda
 */

/**
 * @typedef {Object} Hoja
 * @property {string} nombre  Rótulo de la pestaña. Ver {@link MAX_NOMBRE_HOJA} y
 *   {@link PROHIBIDOS_NOMBRE_HOJA}: se valida, no se sanea.
 * @property {Array<Array<Celda>>} filas  Filas de arriba abajo; dentro, celdas de
 *   izquierda a derecha. Una fila `null` deja el renglón en blanco.
 * @property {Array<{ancho: number}>} [columnas]  Anchos, en el «número de caracteres»
 *   que usa Excel. La columna sin entrada se queda con el ancho por defecto.
 * @property {string[]} [combinaciones]  Rangos combinados, p. ej. `'A1:C1'`.
 */

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Serializa un libro de Excel (`.xlsx`) a bytes.
 *
 * ```js
 * const bytes = serializarLibroXlsx({
 *   hojas: [{
 *     nombre: 'Contorno exterior',
 *     columnas: [{ ancho: 9 }, { ancho: 16 }, { ancho: 16 }],
 *     combinaciones: ['A1:C1'],
 *     filas: [
 *       [{ valor: 'Coordenadas Parcela', estilo: ESTILO.TITULO }],
 *       [{ valor: 'Vértice', estilo: ESTILO.CABECERA }, …],
 *       [{ valor: 1, estilo: ESTILO.ENTERO }, { valor: 372516.02, estilo: ESTILO.DECIMAL }, …],
 *     ],
 *   }],
 *   fecha,   // INYECTADA: aquí no se lee el reloj, ni para la marca del ZIP
 * })
 * ```
 *
 * **Devuelve `Uint8Array` y no una cadena**, al contrario que las otras tres salidas
 * de esta capa: un `.xlsx` es un contenedor binario y pasarlo por una cadena lo
 * corrompería en silencio (es la misma razón por la que F09 tuvo que escribir
 * `descargarBinario` para el PDF).
 *
 * **Es determinista**: el mismo libro y la misma fecha producen exactamente los
 * mismos bytes.
 *
 * **No lanza por un dato del usuario** —un texto raro se escapa, un carácter que XML
 * no admite se sustituye por {@link SUSTITUTO_NO_REPRESENTABLE}—. El `throw` se
 * reserva al contrato roto por el programador (SPEC §2.1): un estilo que no existe,
 * un nombre de pestaña que Excel no admite, un `NaN` en una celda.
 *
 * @param {object} opciones
 * @param {Hoja[]} opciones.hojas  Al menos una: un libro sin hojas no lo abre Excel.
 * @param {Date} opciones.fecha  Instante que se estampa en las entradas del ZIP.
 *   **Obligatorio y por parámetro**: ver la cabecera del módulo.
 * @returns {Uint8Array}
 * @throws {TypeError}   `opciones` que no es objeto, `hojas` que no es un array,
 *   `fecha` que no es una fecha, celdas con un valor que no es texto ni número.
 * @throws {RangeError}  `fecha` inválida, libro sin hojas, nombre de pestaña que
 *   Excel no admite, estilo fuera del catálogo, número no finito, o pasarse de los
 *   límites de filas/columnas del formato.
 */
export function serializarLibroXlsx(opciones = {}) {
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(
      `serializarLibroXlsx: se esperaba un objeto de opciones; recibido ${describir(opciones)}.`,
    )
  }
  const { hojas, fecha } = opciones

  if (!Array.isArray(hojas)) {
    throw new TypeError(
      `serializarLibroXlsx: 'hojas' debe ser un array de hojas; recibido ${describir(hojas)}.`,
    )
  }
  if (hojas.length === 0) {
    throw new RangeError(
      'serializarLibroXlsx: un libro necesita al menos una hoja. Excel no abre un libro vacío, ' +
        'así que devolver bytes aquí sería entregar un fichero roto.',
    )
  }
  if (!(fecha instanceof Date)) {
    throw new TypeError(
      `serializarLibroXlsx: 'fecha' debe ser una fecha; recibido ${describir(fecha)}. El libro no ` +
        'consulta el reloj: la fecha entra por parámetro.',
    )
  }
  if (!Number.isFinite(fecha.getTime())) {
    throw new RangeError("serializarLibroXlsx: 'fecha' es inválida (tiempo no finito).")
  }

  const vistos = new Set()
  hojas.forEach((hoja, i) => {
    if (hoja === null || typeof hoja !== 'object' || Array.isArray(hoja)) {
      throw new TypeError(
        `serializarLibroXlsx: la hoja ${i} debe ser un objeto {nombre, filas}; recibido ${describir(hoja)}.`,
      )
    }
    validarNombreHoja(hoja.nombre, i)
    // Excel no distingue mayúsculas en el nombre de una pestaña, así que dos hojas
    // que solo se diferencien en eso son el mismo nombre repetido: el libro abre con
    // un aviso de fichero dañado.
    const clave = hoja.nombre.toLowerCase()
    if (vistos.has(clave)) {
      throw new RangeError(
        `serializarLibroXlsx: el nombre de pestaña ${describir(hoja.nombre)} está repetido. Excel no ` +
          'distingue mayúsculas en los nombres de hoja y un libro con dos iguales abre dañado.',
      )
    }
    vistos.add(clave)
  })

  // ── Las seis partes ───────────────────────────────────────────────────────
  const partesHoja = hojas.map((hoja, i) => ({
    nombre: `xl/worksheets/sheet${i + 1}.xml`,
    contenido: componerHoja(hoja, i),
  }))

  const contentTypes =
    `${DECLARACION_XML}<Types xmlns="${NS_TIPOS}">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    partesHoja
      .map(
        (p) =>
          `<Override PartName="/${p.nombre}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>'

  const rels =
    `${DECLARACION_XML}<Relationships xmlns="${NS_RELS}">` +
    `<Relationship Id="rId1" Type="${NS_REL_DOC}/officeDocument" Target="xl/workbook.xml"/>` +
    '</Relationships>'

  const workbook =
    `${DECLARACION_XML}<workbook xmlns="${NS_HOJA}" xmlns:r="${NS_REL_DOC}"><sheets>` +
    hojas
      .map((hoja, i) => `<sheet name="${atributo(hoja.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('') +
    '</sheets></workbook>'

  // Los `rId` de las hojas van del 1 al N y el de los estilos es el N+1: el orden lo
  // fija este fichero y por eso las dos listas se generan juntas.
  const workbookRels =
    `${DECLARACION_XML}<Relationships xmlns="${NS_RELS}">` +
    partesHoja
      .map(
        (p, i) =>
          `<Relationship Id="rId${i + 1}" Type="${NS_REL_DOC}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    `<Relationship Id="rId${partesHoja.length + 1}" Type="${NS_REL_DOC}/styles" Target="styles.xml"/>` +
    '</Relationships>'

  return empaquetar(
    [
      { nombre: '[Content_Types].xml', contenido: contentTypes },
      { nombre: '_rels/.rels', contenido: rels },
      { nombre: 'xl/workbook.xml', contenido: workbook },
      { nombre: 'xl/_rels/workbook.xml.rels', contenido: workbookRels },
      { nombre: 'xl/styles.xml', contenido: hojaDeEstilos() },
      ...partesHoja,
    ],
    fecha,
  )
}

export default serializarLibroXlsx
