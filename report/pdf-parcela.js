// report/pdf-parcela.js — F09 · T3.2 · LA MAQUETA DEL INFORME FIRMABLE.
//
// Es la pieza que junta lo que las ocho tareas anteriores produjeron: el encuadre
// (contrato A, `report/encuadre.js`), el plano compuesto (contrato B,
// `report/canvas.js`), la descripción literaria del lindero (contrato C,
// `report/literal.js`), la firma y el encabezado (contrato D, `report/firma.js`) y
// el escritor de PDF (contrato F, `report/pdf.js`). Aquí no se mide nada nuevo:
// **se coloca**.
//
// ── EL NOMBRE ES LEGAL, NO DECORATIVO, Y ESTE ES EL DOCUMENTO QUE SE FIRMA ───
// **«Informe de contraste con el parcelario catastral»** ({@link NOMBRE_INFORME}),
// y jamás un nombre parecido al del documento oficial que emite la Sede
// Electrónica del Catastro con código seguro de verificación. Un nombre casi
// homónimo en la portada de un PDF que el cliente se lleva hace creer que su
// expediente ya se ha presentado, y esa confusión no la deshace ninguna letra
// pequeña. Está razonado en `spec/feature-09-informe-parcela.md` §Nombre y en la
// cabecera de `report/contraste-texto.js`.
//
// ⚠️ **Divergencia deliberada con `report/contraste-texto.js`, y conviene leerla.**
// Aquel informe —un `.txt` que se descarga, se mira y se tira— NOMBRA los
// documentos oficiales del Catastro por sus siglas para poder negar ser ellos.
// Este NO los nombra, y no es un descuido: es un papel con pie de firma, pensado
// para presentarse, fotocopiarse y archivarse. Cualquiera de esas siglas impresa
// en él —aunque sea dentro de una negación— acaba siendo la sigla que alguien lee
// por encima en la portada de un documento firmado. La advertencia se da entera
// ({@link AVISO_NO_OFICIAL}) diciendo lo que este documento NO es y quién sí emite
// los oficiales, sin escribir sus nombres. Hay un test que afirma que no aparecen.
//
// ── LA REGLA DE ORO 9 SE EXAMINA AQUÍ ───────────────────────────────────────
// «La aplicación mide; el colegiado interpreta y firma. Ninguna cifra lleva juicio
// de valor: sin semáforos, sin válido/no válido» (SPEC §2). En un PDF eso son DOS
// prohibiciones, no una:
//
//   1. **De vocabulario.** Ni «correcto», ni «apto», ni «cumple», ni «dentro de
//      tolerancia», ni «conforme». El guardián de `test/report/contraste-texto.js`
//      se copia entero sobre el texto que este módulo produce.
//   2. **De TINTA.** Un PDF puede hacer lo que un `.txt` no podía: pintar en
//      verde. Aquí no hay color —el escritor solo sabe grises— y tampoco hay
//      grises de mérito: el gris se usa para JERARQUÍA (rótulo más claro que
//      dato, nota técnica más clara que lindero) y nunca para puntuar una cifra.
//      Ni una marca ✓ ni ⚠ sobre ningún número.
//
// El margen del BOE viaja con su etiqueta —«margen de identidad del Catastro»,
// que llega dentro del propio diagnóstico justo para que no se pueda escribir la
// cifra sin ella— y se ENUNCIA sin enfrentarlo a nada. La única excepción de todo
// el proyecto sigue siendo la invasión a colindante, hecho topológico binario, y
// aquí sale como superficie y referencia catastral, sin adjetivos.
//
// ── LA MARCA DE PRESUNCIÓN TIENE QUE SOBREVIVIR AL PAPEL ────────────────────
// `report/literal.js` propone una sola cosa en todo el proyecto: que un frente
// urbano al que ninguna parcela catastral alcanza es, presumiblemente, vía
// pública. La marca viaja en el DATO (`tramos[].presuncionNoVerificada`) y no solo
// en la prosa, precisamente para que quien maquete no la pierda. Así que aquí sale
// TRES veces y por tres caminos que no se pisan:
//
//   · en la **tabla de tramos**, en una columna propia («Atribución»), que es un
//     dato tabulado y no una frase que se pueda recortar;
//   · en un **recuadro** con la advertencia entera, tramo a tramo;
//   · y en el propio párrafo del lindero, que ya la trae escrita de origen.
//
// Si un día `literal.js` añade otra presunción, {@link PRESUNCION_CONOCIDA} tiene
// que crecer con ella; lo impide divergir un test-guarda que lee el texto fuente
// de aquel módulo, no la disciplina.
//
// ── «NO CONSTA» SE IMPRIME, Y EL HUECO MUDO NO EXISTE ───────────────────────
// Doctrina de `diagnostico/parcela.js` (F07), conservada por
// `report/contraste-texto.js` (F08) y por `report/firma.js`: un dato ausente NUNCA
// es un espacio en blanco. `lineasFirma` y `lineasEncabezado` ya devuelven el
// sustituto resuelto —«No consta», «No se ha consultado», «No se ha podido
// consultar»—, así que aquí no se decide nada: se imprime lo que traen. Las cifras
// del diagnóstico pasan por los formateadores de abajo, que devuelven
// {@link NO_CONSTA} ante un `null` y jamás un `0,00 m²`.
//
// ── LO QUE FALTA SE DECLARA EN EL SITIO DONDE FALTA ─────────────────────────
// Regla de oro 1, y en un documento firmable es lo más caro de incumplir:
//
//   · **Una capa de cartografía caída se dice DEBAJO DEL PLANO**, no en una nota
//     final. Un plano al que le falta la capa de construcciones no es el mismo
//     plano, y el motivo leído tres páginas después ya no significa nada.
//   · **Una tesela caída**, igual: el plano lleva un trozo sin cartografía y eso
//     se lee al pie de la imagen.
//   · **Un carácter que no cabe en CP1252** se dibuja como `?` (lo hace
//     `report/pdf.js`) y además se enumera en un bloque de cierre, con su punto de
//     código y su página. Ese bloque va DESPUÉS del pie de firma porque solo
//     entonces se sabe lo que hubo: `sustituciones()` no puede consultarse antes
//     de escribir el último renglón, y componer el documento dos veces para
//     adelantarlo sería peor.
//
// ── «PÁGINA N DE M»: SE COMPONE UNA VEZ Y SE VUELVE ─────────────────────────
// «Página 1 de 5» no se puede escribir hasta saber que son cinco. `report/pdf.js`
// trae `irAPagina(n)` justo para esto: se compone el cuerpo entero, se pregunta
// `nPaginas()` y se estampan los pies recorriendo las páginas hacia atrás. El
// documento **no se compone dos veces**; si alguien lo hiciera, las dos pasadas
// podrían divergir y el PDF diría en el pie una cosa y en el cuerpo otra.
//
// ── EL PLANO NO SE REESCALA PARA QUE QUEPA. SE LANZA ────────────────────────
// La escala rotulada (`1:N`) sale del encuadre, que la calculó a partir de un
// tamaño de papel concreto. Si ese tamaño no cabe en la caja útil del A4, lo
// tentador es encogerlo un 3 % y seguir: eso dejaría un plano con una escala
// rotulada FALSA, que es el error silencioso más caro que este documento puede
// cometer (el mismo que `report/canvas.js` persigue cuando el WMS sustituye el
// tamaño). Aquí se lanza `RangeError` y se dice cuánto sobra.
//
// Por el mismo motivo se contrasta la relación de aspecto del plano —milímetros
// contra píxeles— antes de pegarlo: si no cuadran, la imagen saldría estirada. Es
// la tercera red del mismo pez, después de la de `report/canvas.js`
// (`naturalWidth`) y la de `report/pdf.js` (`SOF` del JPEG); tres sitios distintos
// por donde el mismo error entra.
//
// ── PURO ────────────────────────────────────────────────────────────────────
// Sin DOM, sin red y **sin leer el reloj**: la fecha y el identificador de
// documento entran dentro del `encabezado` (contrato D), que los compone quien
// tiene el expediente delante. Hay guardián por grep sobre el texto fuente, igual
// que en `report/pdf.js`, `report/firma.js` y `report/contraste-texto.js`, y por
// el mismo motivo: un informe firmado es un SNAPSHOT y su prueba tiene que valer
// igual dentro de un año.
//
// Tres imports, y los tres son puros: `./pdf.js` (cero imports), `./firma.js`
// (cero imports) y `./contraste-texto.js` (cero imports), del que se toma
// `OMISION_CONOCIDA` para no escribir una TERCERA copia del vocabulario de
// omisiones. `report/literal.js` NO se importa —arrastra Turf— y de él solo se
// necesitaba una constante: ver {@link PRESUNCION_CONOCIDA}.
//
// ── QUÉ NO HACE ─────────────────────────────────────────────────────────────
//   · **No calcula ni una cifra.** Todas llegan medidas de `diagnostico/`; aquí
//     solo se formatean. Una segunda aritmética sería una segunda verdad.
//   · **No compone el plano** (toca el DOM: es de `report/canvas.js`) ni redacta
//     el lindero (es de `report/literal.js`, y además el usuario lo puede haber
//     editado antes de exportar: la spec lo exige).
//   · **No descarga nada.** Devuelve bytes; el fichero y el enlace de descarga
//     son de `gml/descargar.js`.
//   · **No traduce los mensajes de otras capas.** Llegan en español, redactados
//     por quien sabe por qué, y se copian literales (regla de oro 1).
//   · **No redondea el modelo** (regla 11): el redondeo es de SALIDA.

import { OMISION_CONOCIDA } from './contraste-texto.js'
import { NO_CONSTA, TITULO_FIRMA, lineasEncabezado, lineasFirma } from './firma.js'
import { A4_ALTO_MM, A4_ANCHO_MM, crearDocumentoPdf } from './pdf.js'

// ── El nombre, que es lo primero que mira un revisor ─────────────────────────

/**
 * El nombre del documento. **No se cambia sin volver a leer §11.1 de la spec.**
 *
 * @readonly
 */
export const NOMBRE_INFORME = 'Informe de contraste con el parcelario catastral'

/**
 * Quién produce el documento. Va al `/Producer` del PDF y al pie de página, para
 * que un fichero suelto se pueda rastrear hasta la herramienta que lo escribió.
 *
 * @readonly
 */
export const PRODUCTOR = 'Concreta GML'

/**
 * La advertencia de portada. Dice lo que este documento **no es** y quién sí emite
 * los documentos oficiales, **sin escribir sus nombres ni sus siglas** (ver la
 * cabecera: en un papel que se firma, la sigla se lee y la negación no).
 *
 * @readonly
 */
export const AVISO_NO_OFICIAL =
  'Este documento no es un documento oficial del Catastro y no lleva código seguro de ' +
  'verificación: los documentos oficiales los emite la Sede Electrónica del Catastro, y ' +
  'descargar este fichero no presenta nada ante nadie. Es una medición contrastada con el ' +
  'parcelario catastral publicado, para que quien firma la interprete.'

/**
 * La frase de la regla de oro 9, escrita en el propio documento. No basta con
 * cumplirla en el código: quien recibe el papel tiene que saber por qué no
 * encuentra en él una sola conclusión.
 *
 * @readonly
 */
export const AVISO_REGLA_9 =
  'La aplicación mide; el colegiado interpreta y firma. Las cifras de este informe no llevan ' +
  'juicio de valor y no hay en él una sola conclusión: leerlas es trabajo de quien firma.'

// ── Vocabularios espejo ──────────────────────────────────────────────────────

/**
 * Códigos de `tramos[].presuncionNoVerificada`, espejo de
 * `report/literal.js#PRESUNCION`.
 *
 * No se importa de allí porque aquel módulo arrastra `@turf/boolean-point-in-polygon`
 * y `@turf/helpers` al grafo de dependencias de un maquetador, que además tiene que
 * poder probarse sin red ni geometría. Es la misma decisión —y la misma red de
 * seguridad— que tomó `report/contraste-texto.js` con `OMISION_CONOCIDA` y
 * `report/literal.js` con `CLASE_CONOCIDA`: literal aquí + **test-guarda** que
 * compara las dos listas leyendo el texto fuente del otro fichero.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const PRESUNCION_CONOCIDA = Object.freeze({
  VIA_PUBLICA: 'VIA_PUBLICA',
})

/**
 * Cómo se escribe cada presunción en la tabla de tramos. Un código desconocido se
 * imprime CRUDO y marcado como presunción: antes un código feo en el papel que un
 * renglón que parezca medido sin serlo (regla de oro 1).
 */
const TEXTO_PRESUNCION = Object.freeze({
  [PRESUNCION_CONOCIDA.VIA_PUBLICA]: 'PRESUNCIÓN no verificada: vía pública',
})

/**
 * La advertencia entera del recuadro de presunciones. Las mismas tres marcas que
 * `report/literal.js` mete en la frase que el lector copia —«presumiblemente»,
 * «dato NO verificado» y «confirme antes de firmar»— repetidas aquí porque este
 * bloque existe para que la advertencia no dependa de que nadie toque esa cadena.
 */
const AVISO_PRESUNCION =
  'Los tramos siguientes se describen por PRESUNCIÓN y no por medición. Los viales urbanos no ' +
  'tienen referencia catastral, así que un frente que ninguna parcela colindante alcanza suele ' +
  'ser la calle; esta aplicación no ha consultado el callejero ni el inventario de bienes de ' +
  'dominio público. Dato NO verificado: confirme antes de firmar.'

/** Rótulo humano de cada sección del diagnóstico que puede quedar sin medir. */
const ROTULO_OMISION = Object.freeze({
  [OMISION_CONOCIDA.SOLAPE]: 'Solape con el contorno oficial',
  [OMISION_CONOCIDA.DIFERENCIA]: 'Diferencia con el contorno oficial',
  [OMISION_CONOCIDA.CENTROIDES]: 'Desplazamiento de centroides',
  [OMISION_CONOCIDA.DESVIACION]: 'Desviación de lindero',
  [OMISION_CONOCIDA.MARGEN]: 'Margen oficial de identidad',
})

/** Rótulo humano de cada banda de la tabla a tres bandas. */
const ROTULO_BANDA = Object.freeze({
  medida: 'Medición',
  catastral: 'Catastro',
  registral: 'Registro',
})

/**
 * Procedencia de la geometría, espejo de `model/parcela.js#ORIGEN_PARCELA` y con
 * las mismas palabras que `report/contraste-texto.js`. Un origen que no esté aquí
 * se imprime tal cual.
 */
const ROTULO_ORIGEN = Object.freeze({
  WFS: 'Descarga del Catastro (servicio WFS)',
  LIST: 'Fichero de listado de coordenadas (LIST) aportado',
  TXT: 'Fichero de texto de coordenadas (TXT) aportado',
  DXF: 'Fichero de CAD (DXF) aportado',
  GML_EXISTENTE: 'Fichero GML aportado por el usuario',
})

/**
 * Los códigos de `saltados[].motivo` de `diagnostico/topologia.js`, con las mismas
 * frases que el informe de texto: dos documentos del mismo expediente no pueden
 * explicar el mismo suceso con palabras distintas.
 */
const MOTIVO_SALTADO = Object.freeze({
  SIN_RECINTOS: 'la lista de recintos venía vacía: no hay región que medir',
  EXTERIOR_NO_APTO: 'el contorno exterior no forma anillo (menos de 3 vértices)',
  HUECO_NO_APTO:
    'un hueco no forma anillo (menos de 3 vértices); la región se ha medido sin él, así que la ' +
    'superficie sale por exceso en ese hueco',
})

// ── Medidas del papel, en milímetros ─────────────────────────────────────────
//
// TODO lo de este módulo va en milímetros, tamaños de letra incluidos: es el API
// de `report/pdf.js` y es además la unidad en la que se rotula un plano técnico
// (ISO 3098). 3,5 mm ≈ 10 pt.

/** Márgenes de la caja de texto. Los 15 mm laterales dejan 180 mm útiles, que es
 * exactamente el ancho del plano de la Receta A: el plano entra sin encogerse. */
const MARGEN = Object.freeze({
  IZQUIERDA: 15,
  DERECHA: 15,
  SUPERIOR: 15,
})

/** Ancho útil de la caja de texto y del plano. */
const ANCHO_UTIL = A4_ANCHO_MM - MARGEN.IZQUIERDA - MARGEN.DERECHA

/** Ordenada del filete del pie de página. Nada del cuerpo baja de aquí. */
const Y_FILETE_PIE = A4_ALTO_MM - 16

/** Última ordenada utilizable por el cuerpo (queda un respiro sobre el filete). */
const Y_LIMITE = Y_FILETE_PIE - 4

/** Alto útil de una página entera de cuerpo. Es el techo de un bloque indivisible. */
const ALTO_PAGINA_UTIL = Y_LIMITE - MARGEN.SUPERIOR

/**
 * Tamaños de letra, **en milímetros de altura de em**. La escala sigue la de la
 * rotulación técnica: 2,5 mm es la altura normal de una cota (ISO 3098), y de ahí
 * hacia arriba y hacia abajo.
 */
const TAM = Object.freeze({
  TITULO: 5,
  SECCION: 3.6,
  APARTADO: 3,
  CUERPO: 3,
  TABLA: 2.6,
  MENOR: 2.4,
  PIE: 2.2,
})

/**
 * Grises. **Ninguno es de mérito** (regla de oro 9): marcan JERARQUÍA —el rótulo
 * de un campo pesa menos que su valor, la nota técnica menos que el lindero— y
 * nunca puntúan una cifra.
 */
const GRIS = Object.freeze({
  TEXTO: 0,
  ROTULO: 0.4,
  SECUNDARIO: 0.3,
  FILETE: 0.55,
  PIE: 0.4,
})

/** Interlineado como múltiplo del tamaño de letra. */
const INTERLINEA = 1.42

/** Ancho de la columna de rótulos en un campo «rótulo → valor». */
const ANCHO_ROTULO = 55

/**
 * Canal entre columnas de una tabla, en milímetros. Se descuenta del ancho de cada
 * columna POR LA DERECHA. Sin él, una columna alineada a la derecha queda pegada al
 * rótulo de la siguiente y las dos se leen como un solo dato.
 */
const AIRE_COLUMNA = 3

/** Aire antes y después de un epígrafe de sección. */
const AIRE = Object.freeze({
  ANTES_SECCION: 6,
  DESPUES_SECCION: 2.5,
  ANTES_APARTADO: 3.5,
  DESPUES_APARTADO: 1.5,
  PARRAFO: 2,
})

// ── Formato de números, en español ───────────────────────────────────────────
//
// Los mismos criterios, exactamente, que `report/contraste-texto.js`: `es-ES`,
// coma decimal, dos decimales de SALIDA (regla 11) y separador de millar en
// superficies y longitudes, que ahí se leen como magnitudes. Las **coordenadas van
// sin separador de millar** (`439283,23`, no `439.283,23`), que es la convención de
// cualquier listado topográfico y evita que un punto de millar y una coma decimal
// compartan columna en la tabla de vértices. Lo que no puede pasar es que el
// informe de texto y el PDF del mismo expediente escriban la misma cifra distinto.

const nf = (decimales, agrupar = true) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: agrupar,
  })

/** Superficies y longitudes: 2 decimales, que es lo que la app sabe medir. */
const FORMATO_2 = nf(2)
/** La superficie DECLARADA por el Catastro es un ENTERO (override O6). */
const FORMATO_0 = nf(0)
/** Coordenadas: 2 decimales y sin agrupar. */
const FORMATO_COORD = nf(2, false)
/** Rumbos: un decimal de grado sexagesimal basta para leer un lindero. */
const FORMATO_1 = nf(1)

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v)

const m2 = (v) => (esNumero(v) ? `${FORMATO_2.format(v)} m²` : NO_CONSTA)
const m2Entero = (v) => (esNumero(v) ? `${FORMATO_0.format(v)} m²` : NO_CONSTA)
const metros = (v) => (esNumero(v) ? `${FORMATO_2.format(v)} m` : NO_CONSTA)
const cuenta = (v) => (esNumero(v) ? FORMATO_0.format(v) : NO_CONSTA)
const grados = (v) => (esNumero(v) ? `${FORMATO_1.format(v)}°` : NO_CONSTA)
const coordenada = (v) => (esNumero(v) ? FORMATO_COORD.format(v) : NO_CONSTA)

/**
 * Un `relativo` (FRACCIÓN, 0,05 = 5 %) como porcentaje. **El × 100 vive aquí**, en
 * la capa de presentación, no en `diagnostico/bandas.js`: es la confusión clásica
 * de este campo y por eso el modelo devuelve fracción.
 */
const porcentaje = (v) => (esNumero(v) ? `${FORMATO_2.format(v * 100)} %` : NO_CONSTA)

/** Con signo explícito: el signo de una diferencia es información, no adorno. */
function conSigno(v, formatear) {
  if (!esNumero(v)) return NO_CONSTA
  const texto = formatear(Math.abs(v))
  if (v > 0) return `+${texto}`
  if (v < 0) return `-${texto}`
  return texto
}

/** Un par UTM `[x, y]` como `439283,23 ; 4479671,27`. */
const punto = (p) =>
  Array.isArray(p) && p.length >= 2 ? `${coordenada(p[0])} ; ${coordenada(p[1])}` : NO_CONSTA

/** Rótulo de un recinto: el 0 es el exterior, el resto huecos (1-based para leer). */
const rotuloRecinto = (i) => (i === 0 ? 'Exterior' : `Hueco ${i}`)

/** Singular o plural según la cuenta, para no escribir «1 recinto(s)». */
const plural = (n, singular, pluralizado) => `${cuenta(n)} ${n === 1 ? singular : pluralizado}`

// ── Guardas de contrato ──────────────────────────────────────────────────────
//
// Misma frontera de siempre en este repo: *el entorno degrada, el programador
// revienta*. Un dato que falta se imprime «No consta»; un TIPO imposible lanza.

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Describe un valor para un mensaje de error, sin reventar con los cíclicos. */
function describir(valor) {
  if (typeof valor === 'string') return JSON.stringify(valor)
  if (valor === null) return 'null'
  if (valor === undefined) return 'undefined'
  if (valor instanceof Uint8Array) return `un Uint8Array de ${valor.length} bytes`
  if (Array.isArray(valor)) return `un array de ${valor.length}`
  if (typeof valor === 'object') return 'un objeto'
  return `${typeof valor} (${String(valor)})`
}

const lista = (v) => (Array.isArray(v) ? v : [])

/** Un string no vacío, o `null`. Evita que un `''` pase por dato. */
const textoONulo = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null)

// ── El maquetador ────────────────────────────────────────────────────────────

/**
 * Un cursor sobre el documento que sabe cuándo saltar de página.
 *
 * `y` es **el borde SUPERIOR del siguiente renglón**, no su línea base: quien
 * maqueta piensa en «cuánto llevo bajado», y la línea base la calcula esta capa
 * (`base = y + tam · 0,8`, que es aproximadamente el ascendente de Helvetica).
 *
 * Todo lo que escribe pasa por {@link Maqueta#necesita}, así que **ningún renglón
 * puede caer sobre el pie de página**: el salto no depende de que quien maqueta se
 * acuerde de pedirlo.
 *
 * @param {ReturnType<typeof crearDocumentoPdf>} doc
 */
function crearMaqueta(doc) {
  const x0 = MARGEN.IZQUIERDA
  const xFin = x0 + ANCHO_UTIL
  let y = MARGEN.SUPERIOR

  const altoDe = (tam) => tam * INTERLINEA

  const maqueta = {
    get y() {
      return y
    },
    set y(valor) {
      y = valor
    },
    x0,
    xFin,
    ancho: ANCHO_UTIL,
    /**
     * El documento, a mano. Lo necesitan las dos primitivas que este maquetador no
     * envuelve —la imagen y algún rectángulo suelto—, y son la misma pieza: pasarlo
     * además por parámetro a cada sección solo daría dos nombres para lo mismo.
     */
    doc,

    /** Abre una página nueva y se planta arriba del todo. */
    nuevaPagina() {
      doc.pagina()
      y = MARGEN.SUPERIOR
      return maqueta
    },

    /**
     * Reserva `alto` milímetros: si no caben, salta de página.
     *
     * @param {number} alto  Milímetros que el siguiente bloque necesita SEGUIDOS.
     * @returns {boolean}  `true` si hubo salto (lo usan las tablas para repetir
     *   su cabecera).
     */
    necesita(alto) {
      if (y + alto <= Y_LIMITE) return false
      // Un bloque más alto que una página entera no cabe en ninguna: saltar sería
      // gastar una hoja en blanco y volver a no caber. Se escribe donde está y se
      // deja que el siguiente `necesita` lo parta.
      if (alto > ALTO_PAGINA_UTIL && y === MARGEN.SUPERIOR) return false
      maqueta.nuevaPagina()
      return true
    },

    /** Aire vertical. No provoca salto: un hueco al principio de una página sobra. */
    hueco(mm) {
      if (y > MARGEN.SUPERIOR) y = Math.min(y + mm, Y_LIMITE)
      return maqueta
    },

    /** Un filete horizontal de ancho completo. */
    filete({ grosor = 0.25, gris = GRIS.FILETE, desde = x0, hasta = xFin } = {}) {
      maqueta.necesita(grosor + 1)
      doc.linea(desde, y, hasta, y, { grosor, gris })
      y += grosor + 1
      return maqueta
    },

    /**
     * Un renglón suelto, sin envolver. Devuelve el ancho ocupado.
     *
     * @param {string} texto
     * @param {object} [opciones]
     */
    renglon(texto, { x = x0, tam = TAM.CUERPO, fuente = 'normal', gris = GRIS.TEXTO } = {}) {
      maqueta.necesita(altoDe(tam))
      const { ancho } = doc.texto(texto, { x, y: y + tam * 0.8, tam, fuente, gris })
      y += altoDe(tam)
      return ancho
    },

    /** Un renglón alineado a la DERECHA de la caja útil. */
    renglonDerecha(texto, { tam = TAM.CUERPO, fuente = 'normal', gris = GRIS.TEXTO } = {}) {
      const ancho = doc.medirTexto(texto, { tam, fuente })
      return maqueta.renglon(texto, { x: xFin - ancho, tam, fuente, gris })
    },

    /**
     * Un párrafo envuelto al ancho útil. Cada línea pide su sitio por separado, así
     * que un párrafo largo se parte entre páginas sin perder nada.
     */
    parrafo(
      texto,
      { tam = TAM.CUERPO, fuente = 'normal', gris = GRIS.TEXTO, sangria = 0 } = {},
    ) {
      const anchoUtil = ANCHO_UTIL - sangria
      for (const linea of doc.partirTexto(texto, anchoUtil, { tam, fuente })) {
        maqueta.renglon(linea, { x: x0 + sangria, tam, fuente, gris })
      }
      return maqueta
    },

    /**
     * Un campo «rótulo → valor», con el valor colgado a la altura de su columna.
     *
     * Si el rótulo no cabe en su columna, el valor baja a la línea siguiente en vez
     * de solaparse con él: un renglón ilegible es peor que un renglón de más.
     */
    campo(rotulo, valor, { tam = TAM.CUERPO, sangria = 0, grisValor = GRIS.TEXTO } = {}) {
      const xRotulo = x0 + sangria
      const anchoRotulo = ANCHO_ROTULO - sangria
      const cabe = doc.medirTexto(rotulo, { tam }) <= anchoRotulo - 2
      const xValor = cabe ? xRotulo + anchoRotulo : xRotulo + 3
      const lineas = doc.partirTexto(valor, xFin - xValor, { tam })

      maqueta.necesita(altoDe(tam) * (cabe ? 1 : 2))
      const yRotulo = y
      doc.texto(rotulo, { x: xRotulo, y: yRotulo + tam * 0.8, tam, gris: GRIS.ROTULO })
      if (!cabe) y += altoDe(tam)
      for (const linea of lineas) {
        maqueta.renglon(linea, { x: xValor, tam, gris: grisValor })
      }
      return maqueta
    },

    /**
     * Una tabla con cabecera **que se repite en cada página**. Las celdas se
     * envuelven dentro de su columna, así que una fila puede medir varias líneas.
     *
     * @param {string[]} cabeceras
     * @param {Array<string[]>} filas
     * @param {object} opciones
     * @param {number[]} opciones.anchos  Milímetros de cada columna.
     * @param {number[]} [opciones.izquierda=[0]]  Columnas alineadas a la izquierda;
     *   el resto van a la derecha, porque las cifras se comparan por su última
     *   posición. `[]` alinea todas a la derecha (la tabla de vértices: allí la
     *   primera columna también es un número).
     * @param {number} [opciones.sangria=0]
     * @param {number} [opciones.tam=TAM.TABLA]
     */
    tabla(cabeceras, filas, { anchos, izquierda = [0], sangria = 0, tam = TAM.TABLA } = {}) {
      const xInicio = x0 + sangria
      const total = anchos.reduce((s, a) => s + a, 0)
      const alto = altoDe(tam)

      /**
       * Las celdas de una fila, ya envueltas dentro de su columna. **Se mide antes
       * de pintar** —y no al revés— porque una fila puede ocupar varias líneas y el
       * salto de página tiene que decidirse con el alto REAL en la mano: pintar
       * primero y reparar después dibujaría la fila dos veces, una de ellas debajo
       * de la cabecera repetida.
       */
      const medirFila = (valores) => {
        let xCol = xInicio
        const celdas = valores.map((v, c) => {
          const celda = {
            lineas: doc.partirTexto(String(v ?? ''), anchos[c] - AIRE_COLUMNA, { tam }),
            xCol,
          }
          xCol += anchos[c]
          return celda
        })
        const nLineas = Math.max(...celdas.map((c) => c.lineas.length))
        return { celdas, alto: nLineas * alto }
      }

      const pintarFila = ({ celdas, alto: altoFila }, fuente) => {
        const yFila = y
        celdas.forEach((c, i) => {
          c.lineas.forEach((linea, k) => {
            const anchoTexto = doc.medirTexto(linea, { tam, fuente })
            // El canal de {@link AIRE_COLUMNA} se descuenta SIEMPRE por la derecha:
            // así una columna de cifras a la derecha nunca queda pegada al rótulo de
            // la siguiente (MEDIDO: «26,50 m 9398517VK3799G» se leía como un solo
            // dato en la tabla de tramos).
            const x = izquierda.includes(i)
              ? c.xCol
              : c.xCol + anchos[i] - AIRE_COLUMNA - anchoTexto
            doc.texto(linea, { x, y: yFila + k * alto + tam * 0.8, tam, fuente })
          })
        })
        y = yFila + altoFila
      }

      const cabecera = medirFila(cabeceras)
      const pintarCabecera = () => {
        pintarFila(cabecera, 'negrita')
        doc.linea(xInicio, y - alto * 0.15, xInicio + total, y - alto * 0.15, {
          grosor: 0.25,
          gris: GRIS.FILETE,
        })
        y += 0.6
      }

      // La cabecera y al menos una fila van juntas: una cabecera sola al pie de una
      // página es una cabecera que no encabeza nada.
      maqueta.necesita(cabecera.alto + alto * 2)
      pintarCabecera()
      for (const fila of filas) {
        const medida = medirFila(fila)
        // Una fila más alta que una página entera no cabe en ninguna: saltar sería
        // gastar una hoja en blanco para volver a no caber.
        if (
          y + medida.alto > Y_LIMITE &&
          medida.alto + cabecera.alto <= ALTO_PAGINA_UTIL
        ) {
          maqueta.nuevaPagina()
          pintarCabecera()
        }
        pintarFila(medida, 'normal')
      }
      doc.linea(xInicio, y + 0.4, xInicio + total, y + 0.4, { grosor: 0.25, gris: GRIS.FILETE })
      y += 1.6
      return maqueta
    },

    /**
     * Un recuadro con texto dentro. Mide primero y dibuja después, porque el
     * rectángulo necesita su alto antes de existir; y **no se parte entre páginas**:
     * medio recuadro en cada hoja se lee como dos avisos distintos.
     */
    recuadro(parrafos, { tam = TAM.MENOR, sangria = 0 } = {}) {
      const aire = 2.5
      const anchoCaja = ANCHO_UTIL - sangria
      const anchoTexto = anchoCaja - 2 * aire
      const bloques = parrafos.map((p) => doc.partirTexto(p, anchoTexto, { tam }))
      const nLineas = bloques.reduce((s, b) => s + b.length, 0)
      const alto = nLineas * altoDe(tam) + 2 * aire + (bloques.length - 1) * 1

      maqueta.necesita(alto)
      doc.rect(x0 + sangria, y, anchoCaja, alto, { trazo: GRIS.FILETE, grosor: 0.3 })
      y += aire
      bloques.forEach((bloque, i) => {
        if (i > 0) y += 1
        for (const linea of bloque) maqueta.renglon(linea, { x: x0 + sangria + aire, tam })
      })
      y += aire
      return maqueta
    },
  }

  return maqueta
}

/**
 * Numerador de secciones y apartados.
 *
 * Existe por lo mismo que el de `report/contraste-texto.js`: **el informe no
 * siempre tiene las mismas secciones**. Cuando la parcela llegó por referencia
 * catastral no hay fichero que leer y esa sección desaparece — y tiene que
 * desaparecer del todo, sin dejar un hueco en la numeración que haga pensar que
 * falta una página.
 */
function crearNumerador() {
  let seccion = 0
  let apartado = 0
  return {
    seccion() {
      seccion += 1
      apartado = 0
      return String(seccion)
    },
    apartado() {
      apartado += 1
      return `${seccion}.${apartado}`
    },
  }
}

/**
 * Un epígrafe de sección: número, título en versalitas y filete.
 *
 * `altoMinimo` es lo que tiene que caber DEBAJO del epígrafe para que valga la
 * pena escribirlo aquí. Sin él, un epígrafe cabe casi siempre —mide 15 mm— y su
 * contenido salta a la hoja siguiente: eso es el **título huérfano** al pie de la
 * página, y MEDIDO se daba en la sección de firma, que necesita 50 mm seguidos.
 * Un rótulo sin nada debajo se lee como una sección vacía.
 */
function epigrafe(maqueta, num, titulo, { altoMinimo = 0 } = {}) {
  maqueta.hueco(AIRE.ANTES_SECCION)
  maqueta.necesita(TAM.SECCION * INTERLINEA * 3 + altoMinimo)
  maqueta.renglon(`${num.seccion()}.  ${titulo.toUpperCase()}`, {
    tam: TAM.SECCION,
    fuente: 'negrita',
  })
  maqueta.filete({ grosor: 0.4, gris: GRIS.SECUNDARIO })
  maqueta.hueco(AIRE.DESPUES_SECCION)
}

/** Un epígrafe de apartado dentro de una sección. */
function subepigrafe(maqueta, num, titulo) {
  maqueta.hueco(AIRE.ANTES_APARTADO)
  maqueta.necesita(TAM.APARTADO * INTERLINEA * 3)
  maqueta.renglon(`${num.apartado()}  ${titulo}`, { tam: TAM.APARTADO, fuente: 'negrita' })
  maqueta.hueco(AIRE.DESPUES_APARTADO)
}

// ── Portada ──────────────────────────────────────────────────────────────────

/**
 * El bloque de portada: el nombre legal, la advertencia de lo que este documento
 * NO es y la frase de la regla de oro 9. Va ARRIBA, antes de cualquier cifra,
 * porque quien abre el PDF y lee cinco líneas tiene que haberse enterado ya.
 */
function portada(maqueta) {
  maqueta.renglon(NOMBRE_INFORME.toUpperCase(), { tam: TAM.TITULO, fuente: 'negrita' })
  maqueta.filete({ grosor: 0.6, gris: GRIS.TEXTO })
  maqueta.hueco(2)
  maqueta.parrafo(AVISO_NO_OFICIAL, { tam: TAM.MENOR, gris: GRIS.SECUNDARIO })
  maqueta.hueco(AIRE.PARRAFO)
  maqueta.parrafo(AVISO_REGLA_9, { tam: TAM.MENOR, gris: GRIS.SECUNDARIO })
}

// ── 1 · Encabezado ───────────────────────────────────────────────────────────

/**
 * Sección 1 · el encabezado del contrato D: municipio, clase de finca, domicilio o
 * paraje/polígono/parcela, referencia catastral, SRS, fecha e **identificador
 * único de documento**.
 *
 * ⚠️ **El número de líneas NO es fijo**, y de ahí que este bloque se recorra
 * genéricamente y fluya en vez de reservarse un alto. `lineasEncabezado` emite
 * **8 líneas en una finca urbana y 11 en una rústica**: paraje, polígono y parcela
 * son el sistema de identificación de la RÚSTICA, y una urbana no los tiene, así
 * que allí no se imprimen —imprimir «Polígono: No se ha consultado» en un piso es
 * afirmar algo falso—. Su sitio lo ocupan la clase de finca (que sale SIEMPRE,
 * también cuando no se sabe cuál es: ocultar no puede ser callar) y el domicilio.
 * Reservar aquí el alto de nueve renglones dejaría la rústica solapada con lo que
 * viniera debajo, y eso el snapshot de bytes no lo ve.
 *
 * El **domicilio de una rústica puede pasar de 85 caracteres**, así que es la
 * primera línea del encabezado que necesita partirse: lo hace {@link crearMaqueta}
 * en `campo()`, con `partirTexto`, colgando las líneas siguientes a la altura de
 * su columna.
 *
 * Cada línea llega con el sustituto ya resuelto por `report/firma.js`: aquí no se
 * decide si un dato falta ni con qué palabra se dice. El `detalle` —el mensaje del
 * servicio cuando la consulta falló— se imprime debajo, en cuerpo menor, porque un
 * «No se ha podido consultar» sin el porqué obliga a llamar por teléfono.
 */
function seccionEncabezado(maqueta, num, { encabezado, procedencia, parcela, comprobacion }) {
  epigrafe(maqueta, num, 'Identificación')

  for (const linea of lineasEncabezado(encabezado, { procedencia })) {
    maqueta.campo(linea.etiqueta, linea.valor, {
      // Un sustituto se escribe en el mismo negro que un dato: aclararlo lo
      // convertiría en letra pequeña, y un dato que falta no es letra pequeña.
      grisValor: GRIS.TEXTO,
    })
    const detalle = textoONulo(linea.detalle)
    if (detalle !== null) {
      maqueta.parrafo(detalle, { tam: TAM.MENOR, gris: GRIS.SECUNDARIO, sangria: ANCHO_ROTULO })
    }
  }

  // La procedencia es DOBLE cuando hay contraste, y decirlo importa: la geometría
  // es del usuario y el parcelario es del Catastro. Un renglón que dijera «del
  // Catastro» a secas convertiría el fichero de un tercero en un dato oficial.
  const origen = textoONulo(parcela?.origen)
  maqueta.campo(
    'Procedencia de la geometría',
    origen === null ? 'No consta la procedencia de la geometría.' : (ROTULO_ORIGEN[origen] ?? origen),
  )
  const fichero = esObjeto(comprobacion?.fichero) ? comprobacion.fichero : null
  if (fichero !== null) {
    const bytes = esNumero(fichero.bytes) ? ` (${cuenta(fichero.bytes)} bytes)` : ''
    maqueta.campo('Fichero de origen', `${textoONulo(fichero.nombre) ?? NO_CONSTA}${bytes}`)
  }
}

// ── 2 · Plano de situación ───────────────────────────────────────────────────

/**
 * Comprueba que el plano cabe en el papel **sin reescalarlo**, y que la imagen no
 * se va a estirar. Ver la cabecera: encoger el plano falsificaría la escala
 * rotulada, que es la peor avería posible de este documento.
 *
 * @throws {RangeError}
 */
function exigirPlanoEncajable(anchoMm, altoMm, plano) {
  if (anchoMm > ANCHO_UTIL + 1e-9) {
    throw new RangeError(
      `informePdfParcela: el plano mide ${anchoMm} mm de ancho y en A4 con márgenes de ` +
        `${MARGEN.IZQUIERDA} mm caben ${ANCHO_UTIL} mm. NO se reescala: la escala «1:N» que ` +
        'rotula este informe la calculó el encuadre para ese tamaño de papel, y encoger la ' +
        'imagen dejaría el plano con una escala declarada que no es la suya. Recomponga el ' +
        `encuadre con anchoMm ≤ ${ANCHO_UTIL}.`,
    )
  }
  if (altoMm > ALTO_PAGINA_UTIL + 1e-9) {
    throw new RangeError(
      `informePdfParcela: el plano mide ${altoMm} mm de alto y en una página de A4 caben ` +
        `${ALTO_PAGINA_UTIL.toFixed(1)} mm de cuerpo. Un plano partido entre dos hojas no es un ` +
        'plano: recomponga el encuadre con un alto menor.',
    )
  }
  // Relación de aspecto: milímetros contra píxeles. El encuadre los deja iguales
  // salvo el 0,03 % que el redondeo a píxeles enteros empuja al papel; una
  // diferencia mayor significa que el plano y el encuadre no son del mismo trabajo,
  // y la imagen saldría estirada con la geometría fuera de sitio.
  const ratioMm = anchoMm / altoMm
  const ratioPx = plano.anchoPx / plano.altoPx
  const desvio = Math.abs(ratioMm - ratioPx) / ratioPx
  if (desvio > 0.01) {
    throw new RangeError(
      `informePdfParcela: el plano se imprimiría estirado. La caja de papel es ${anchoMm}×` +
        `${altoMm} mm (relación ${ratioMm.toFixed(4)}) y la imagen es ${plano.anchoPx}×` +
        `${plano.altoPx} px (relación ${ratioPx.toFixed(4)}): un ${(desvio * 100).toFixed(2)} % ` +
        'de diferencia. ¿Son el encuadre y el plano del mismo trabajo?',
    )
  }
}

/**
 * Sección 2 · el plano de situación, a escala declarada.
 *
 * El JPEG llega dibujado por `report/canvas.js` con la flecha de norte, la barra
 * de escala gráfica y la cartografía de fondo YA dentro; aquí solo se pega y se
 * rotula. **La escala NUMÉRICA la pone el PDF** —en pantalla va solo la barra
 * gráfica (dossier §4.4)—, y sale del encuadre, nunca de una segunda división.
 */
function seccionPlano(maqueta, num, { plano, encuadre, srs }) {
  epigrafe(maqueta, num, 'Plano de situación')

  if (plano === null) {
    maqueta.parrafo(
      'No se ha podido componer el plano de situación, así que este informe sale SIN plano. ' +
        'No es un informe equivalente al que lo lleva: la relación de vértices y las cifras del ' +
        'contraste siguen siendo las mismas, pero aquí falta la comprobación visual del encaje.',
    )
    return { anchoMm: 0, altoMm: 0 }
  }

  const anchoMm = encuadre.anchoMm
  const altoMm = encuadre.altoMm
  exigirPlanoEncajable(anchoMm, altoMm, plano)

  // El plano entero en una hoja: si no cabe donde estamos, se salta antes de pegar.
  maqueta.necesita(altoMm + TAM.MENOR * INTERLINEA * 2)
  maqueta.doc.imagenJpeg(plano.jpeg, {
    x: maqueta.x0,
    y: maqueta.y,
    anchoMm,
    altoMm,
    // Los píxeles DECLARADOS se contrastan contra el `SOF` real del JPEG dentro de
    // `imagenJpeg`. Es la defensa contra el hallazgo medido: el WMS del Catastro
    // sustituye el tamaño sin avisar cuando se pasa de 4000 px.
    anchoPx: plano.anchoPx,
    altoPx: plano.altoPx,
  })
  maqueta.y += altoMm
  maqueta.doc.rect(maqueta.x0, maqueta.y - altoMm, anchoMm, altoMm, {
    trazo: GRIS.FILETE,
    grosor: 0.25,
  })
  maqueta.hueco(1.5)

  // Las medidas del papel pasan por el MISMO formateador que el resto del informe:
  // un `${altoMm}` crudo saldría «129.9624», con punto decimal inglés y cuatro
  // decimales, en un documento que escribe «163,12 m» dos páginas más allá.
  // (163,12 m es el perímetro MEDIDO del exterior de la parcela de referencia;
  // sale de `geo/metrica.js#perimetro` y coincide con la suma de tramos de
  // `report/literal.js`. Antes aquí ponía «163,79», que no es ninguna cifra de
  // este informe: el ejemplo del comentario tiene que poder comprobarse.)
  maqueta.renglon(
    `Escala 1:${cuenta(encuadre.escalaDenominador)}  ·  ${FORMATO_2.format(anchoMm)} × ` +
      `${FORMATO_2.format(altoMm)} mm sobre el papel  ·  ${cuenta(encuadre.ppp)} ppp  ·  ${srs}`,
    { tam: TAM.MENOR, fuente: 'negrita' },
  )
  maqueta.parrafo(
    'El norte del plano es el de CUADRÍCULA (el eje +Y de la proyección UTM), no el geográfico; ' +
      'la flecha y la barra de escala gráfica van dibujadas dentro de la imagen. La escala ' +
      'numérica de arriba es la del papel a tamaño original: una fotocopia reducida deja de ' +
      'estar a esa escala, y por eso el plano lleva además la barra gráfica.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO },
  )

  const atribucion = textoONulo(plano.atribucion)
  if (atribucion !== null) {
    maqueta.renglon(`Cartografía de fondo: ${atribucion}`, {
      tam: TAM.MENOR,
      gris: GRIS.SECUNDARIO,
    })
  }

  // ── Lo que le falta al plano se dice DEBAJO DEL PLANO ──────────────────────
  const caidas = lista(plano.capasCaidas)
  const teselas = lista(plano.teselasCaidas)
  if (caidas.length > 0 || teselas.length > 0) {
    const parrafos = [
      'Este plano no lleva toda la cartografía de fondo que se le pidió. No es el mismo plano ' +
        'que si la llevara, y por eso se dice aquí y no en una nota final:',
    ]
    for (const c of caidas) {
      parrafos.push(
        `· Capa «${textoONulo(c?.capa) ?? NO_CONSTA}»: ${textoONulo(c?.motivo) ?? NO_CONSTA}`,
      )
    }
    for (const t of teselas) {
      parrafos.push(
        `· Trozo de cartografía nº ${cuenta(esNumero(t?.indice) ? t.indice + 1 : null)}: ` +
          `${textoONulo(t?.motivo) ?? NO_CONSTA}`,
      )
    }
    maqueta.hueco(1.5)
    maqueta.recuadro(parrafos)
  }

  return { anchoMm, altoMm }
}

// ── 3 · Relación de vértices ─────────────────────────────────────────────────

/**
 * De dónde salen los vértices: del modelo si lo hay, y si no, de la geometría que
 * leyó la comprobación. Las dos son la MISMA geometría en el recorrido de F08 y
 * F09; se admiten las dos para que el informe se pueda emitir también cuando la
 * parcela todavía no ha entrado en el store.
 */
function recintosDe(parcela, comprobacion) {
  const delModelo = lista(parcela?.recintos)
  if (delModelo.length > 0) return delModelo
  return lista(comprobacion?.geometria?.recintos)
}

/** Sección 3 · la relación de vértices, con superficie y perímetro. */
function seccionVertices(maqueta, num, { parcela, comprobacion, diagnostico, srs }) {
  epigrafe(maqueta, num, 'Relación de vértices')

  const recintos = recintosDe(parcela, comprobacion)
  const s = esObjeto(diagnostico.superficie) ? diagnostico.superficie : {}
  const p = esObjeto(diagnostico.perimetro?.medido) ? diagnostico.perimetro.medido : {}

  maqueta.campo('Superficie medida', m2(s.medida))
  maqueta.campo('Perímetro exterior', metros(p.exterior))
  maqueta.campo('Perímetro de huecos', metros(p.huecos))
  maqueta.campo('Perímetro total', metros(p.total))
  maqueta.hueco(AIRE.PARRAFO)

  if (recintos.length === 0) {
    maqueta.parrafo('No consta la geometría de la parcela: no hay vértices que relacionar.')
    return
  }

  const total = recintos.reduce((suma, r) => suma + lista(r?.vertices).length, 0)
  maqueta.parrafo(
    `Coordenadas en ${srs}, en metros, con dos decimales. Los anillos van ABIERTOS: el último ` +
      'vértice no repite el primero, que es como los guarda el modelo y como se numeran aquí. ' +
      `Los vértices se numeran desde 1 DENTRO DE CADA RECINTO, igual que en el plano. Total: ` +
      `${plural(total, 'vértice', 'vértices')} en ${plural(recintos.length, 'recinto', 'recintos')}.`,
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO },
  )
  maqueta.hueco(AIRE.PARRAFO)

  recintos.forEach((r, i) => {
    const vertices = lista(r?.vertices)
    maqueta.hueco(AIRE.ANTES_APARTADO)
    maqueta.renglon(`${rotuloRecinto(i)} — ${plural(vertices.length, 'vértice', 'vértices')}`, {
      tam: TAM.APARTADO,
      fuente: 'negrita',
    })
    maqueta.hueco(AIRE.DESPUES_APARTADO)
    if (vertices.length === 0) {
      maqueta.parrafo('Este recinto no tiene vértices.', { sangria: 4 })
      return
    }
    maqueta.tabla(
      ['Nº', 'X (m)', 'Y (m)'],
      vertices.map((v, k) => [String(k + 1), coordenada(v?.[0]), coordenada(v?.[1])]),
      // Todas a la derecha: aquí la primera columna también es un número.
      { anchos: [14, 34, 38], izquierda: [], sangria: 4 },
    )
  })
}

// ── 4 · Diagnóstico de encaje ────────────────────────────────────────────────

/** El motivo de una sección que no se pudo medir, tal como lo redactó el modelo. */
function motivoOmision(diagnostico, que) {
  const omision = lista(diagnostico?.omisiones).find((o) => o?.que === que)
  return textoONulo(omision?.motivo) ?? 'No se ha medido, y el diagnóstico no dice por qué.'
}

/**
 * Sección 4 · el contraste con el parcelario: las once secciones de
 * `diagnosticar()`, en el orden que fijó `report/contraste-texto.js` — **el mismo
 * expediente no puede tener dos informes que ordenen las cifras distinto**.
 *
 * Ni una valoración: las cifras se ponen unas al lado de otras y ahí se quedan.
 */
function seccionDiagnostico(maqueta, num, { diagnostico }) {
  const d = diagnostico
  epigrafe(maqueta, num, 'Diagnóstico de encaje y comparación a tres bandas')

  // ── 1 · Superficies ────────────────────────────────────────────────────────
  const s = esObjeto(d.superficie) ? d.superficie : {}
  subepigrafe(maqueta, num, 'Superficies')
  maqueta.tabla(
    ['Concepto', 'Superficie'],
    [
      ['Medida sobre la geometría de la parcela', m2(s.medida)],
      ['Declarada por el Catastro (cp:areaValue)', m2Entero(s.catastral)],
      ['Medida sobre el contorno oficial del Catastro', m2(s.oficial)],
      ['Registral, de la escritura', m2(s.registral)],
    ],
    { anchos: [120, 40], sangria: 4 },
  )
  maqueta.parrafo(
    'Las dos cifras del Catastro no son la misma y no deben confundirse: la DECLARADA es el ' +
      'cp:areaValue que publica el parcelario, y la MEDIDA SOBRE EL CONTORNO OFICIAL es lo que ' +
      'esta aplicación mide sobre las coordenadas que emite ese mismo parcelario. Que difieran ' +
      'es el dato, no un fallo.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO, sangria: 4 },
  )

  // ── 2 · Perímetros ─────────────────────────────────────────────────────────
  const per = esObjeto(d.perimetro) ? d.perimetro : {}
  subepigrafe(maqueta, num, 'Perímetros')
  maqueta.tabla(
    ['', 'Exterior', 'Huecos', 'Total'],
    [
      ['Medición', per.medido],
      ['Contorno oficial', per.oficial],
    ].map(([rotulo, v]) => [
      rotulo,
      v == null ? NO_CONSTA : metros(v.exterior),
      v == null ? NO_CONSTA : metros(v.huecos),
      v == null ? NO_CONSTA : metros(v.total),
    ]),
    { anchos: [60, 34, 34, 34], sangria: 4 },
  )

  // ── 3 · Comparación a tres bandas ──────────────────────────────────────────
  subepigrafe(maqueta, num, 'Comparación a tres bandas')
  maqueta.parrafo(
    'Los tres pares salen siempre y en orden fijo, aunque falte con qué calcularlos: una fila ' +
      'ausente se leería como «esto no hacía falta mirarlo» y una fila con «No consta» dice lo ' +
      'que de verdad pasa. El signo es información: «Medición - Catastro» negativo significa ' +
      'que se ha medido menos de lo que declara el Catastro.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO, sangria: 4 },
  )
  maqueta.hueco(1.5)
  const cruces = lista(d.bandas?.cruces)
  if (cruces.length === 0) {
    maqueta.parrafo('No hay comparación a tres bandas que mostrar.', { sangria: 4 })
  } else {
    maqueta.tabla(
      ['Par', 'Diferencia', 'Relativa'],
      cruces.map((c) => [
        `${ROTULO_BANDA[c?.a] ?? c?.a} - ${ROTULO_BANDA[c?.b] ?? c?.b}`,
        conSigno(c?.absoluto, m2),
        conSigno(c?.relativo, porcentaje),
      ]),
      { anchos: [80, 44, 38], sangria: 4 },
    )
  }

  // ── 4 · Solape ─────────────────────────────────────────────────────────────
  subepigrafe(maqueta, num, 'Solape con el contorno oficial')
  if (!esObjeto(d.solape)) {
    maqueta.parrafo(motivoOmision(d, OMISION_CONOCIDA.SOLAPE), { sangria: 4 })
  } else {
    maqueta.campo('Superficie común', m2(d.solape.area), { sangria: 4 })
    maqueta.campo('Sobre la mayor de las dos', porcentaje(d.solape.relativo), { sangria: 4 })
    maqueta.campo('Piezas disjuntas', cuenta(d.solape.nPiezas), { sangria: 4 })
  }

  // ── 5 · Diferencia ─────────────────────────────────────────────────────────
  subepigrafe(maqueta, num, 'Diferencia con el contorno oficial')
  if (!esObjeto(d.diferencia)) {
    maqueta.parrafo(motivoOmision(d, OMISION_CONOCIDA.DIFERENCIA), { sangria: 4 })
  } else {
    maqueta.campo('Superficie no común', m2(d.diferencia.area), { sangria: 4 })
    maqueta.parrafo(
      'Diferencia simétrica: la superficie que está en uno de los dos contornos y no en el ' +
        'otro, sumando los dos sentidos.',
      { tam: TAM.MENOR, gris: GRIS.SECUNDARIO, sangria: 4 },
    )
  }

  // ── 6 · Centroides ─────────────────────────────────────────────────────────
  subepigrafe(maqueta, num, 'Desplazamiento de centroides')
  if (!esObjeto(d.centroides)) {
    maqueta.parrafo(motivoOmision(d, OMISION_CONOCIDA.CENTROIDES), { sangria: 4 })
  } else {
    maqueta.campo('Centroide de la medición', punto(d.centroides.medido), { sangria: 4 })
    maqueta.campo('Centroide del oficial', punto(d.centroides.oficial), { sangria: 4 })
    maqueta.campo('Distancia entre ambos', metros(d.centroides.distancia), { sangria: 4 })
  }

  // ── 7 · Desviación de lindero ──────────────────────────────────────────────
  subepigrafe(maqueta, num, 'Desviación de lindero, lado a lado')
  bloqueDesviacion(maqueta, d)

  // ── 8 · Invasión ───────────────────────────────────────────────────────────
  subepigrafe(maqueta, num, 'Invasión a colindantes')
  bloqueInvasion(maqueta, d.invasion)

  // ── 9 · Margen oficial ─────────────────────────────────────────────────────
  subepigrafe(maqueta, num, 'Margen oficial de identidad')
  bloqueMargen(maqueta, d)

  // ── 10 · Omisiones ─────────────────────────────────────────────────────────
  subepigrafe(maqueta, num, 'Lo que no se ha podido medir')
  const omisiones = lista(d.omisiones)
  if (omisiones.length === 0) {
    maqueta.parrafo('Se ha podido medir todo lo que este informe recoge.', { sangria: 4 })
  } else {
    maqueta.parrafo(
      'Las secciones siguientes no se han medido. El motivo de cada una va escrito en su ' +
        'propio apartado, en el sitio de la cifra que falta.',
      { tam: TAM.MENOR, gris: GRIS.SECUNDARIO, sangria: 4 },
    )
    for (const o of omisiones) {
      const que = textoONulo(o?.que) ?? '(sin identificar)'
      maqueta.parrafo(`·  ${ROTULO_OMISION[que] ?? que}`, { sangria: 6 })
    }
  }

  // ── 11 · Saltados ──────────────────────────────────────────────────────────
  subepigrafe(maqueta, num, 'Recintos que no se han podido medir')
  const saltados = lista(d.saltados)
  if (saltados.length === 0) {
    maqueta.parrafo('Se han medido todos los recintos.', { sangria: 4 })
  } else {
    maqueta.parrafo(
      'Estos recintos han quedado fuera de alguna medición. No desaparecen en silencio: aquí ' +
        'están, con su sitio y su motivo.',
      { tam: TAM.MENOR, gris: GRIS.SECUNDARIO, sangria: 4 },
    )
    for (const x of saltados) {
      const donde = textoONulo(x?.donde) ?? '(sin sitio)'
      const indice = esNumero(x?.indice) ? `[${x.indice}]` : ''
      const motivo = MOTIVO_SALTADO[x?.motivo] ?? `motivo ${textoONulo(x?.motivo) ?? NO_CONSTA}`
      maqueta.parrafo(`·  ${donde}${indice}, ${cuenta(x?.nVertices)} vértices: ${motivo}.`, {
        sangria: 6,
      })
    }
  }
}

/**
 * La desviación de lindero, **con el lado señalado**. Va desglosada lado a lado y
 * no como una cifra única a propósito: la máxima sin culpable no se puede acotar
 * sobre un plano ni corregir sobre el terreno.
 */
function bloqueDesviacion(maqueta, d) {
  if (!esObjeto(d.desviacion)) {
    maqueta.parrafo(motivoOmision(d, OMISION_CONOCIDA.DESVIACION), { sangria: 4 })
    return
  }
  const { porLado, maxima, nMuestras } = d.desviacion
  const lados = lista(porLado)

  if (!esObjeto(maxima)) {
    maqueta.parrafo(
      'La desviación máxima no se ha podido atribuir a un lado concreto: o no hay lados ' +
        'medibles, o no hay contorno oficial contra el que medirlos.',
      { sangria: 4 },
    )
  } else {
    maqueta.campo('Desviación máxima', metros(maxima.maxima), { sangria: 4 })
    maqueta.campo(
      'Lado que la produce',
      `lado ${cuenta(maxima.indice + 1)} del ${rotuloRecinto(maxima.recinto).toLowerCase()}`,
      { sangria: 4 },
    )
    maqueta.campo('Punto de la medición', punto(maxima.en), { sangria: 4 })
    maqueta.campo('Su homólogo del oficial', punto(maxima.enOficial), { sangria: 4 })
  }
  maqueta.campo('Muestras tomadas', cuenta(nMuestras), { sangria: 4 })
  maqueta.parrafo(
    'Es el máximo, lado a lado, de la distancia mínima de cada muestra al contorno oficial ' +
      'completo. Se muestrea cada 0,30 m sobre el terreno y los dos extremos de cada lado entran ' +
      'siempre, así que la cifra puede quedarse hasta 0,15 m por debajo del máximo continuo. La ' +
      'medida es dirigida (de la medición al oficial) y por tanto asimétrica.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO, sangria: 4 },
  )

  if (lados.length > 0) {
    maqueta.hueco(AIRE.PARRAFO)
    maqueta.tabla(
      ['Lado', 'Desviación', ''],
      lados.map((l) => [
        `${rotuloRecinto(l.recinto)}, lado ${cuenta(l.indice + 1)}`,
        metros(l.maxima),
        // Marca de IDENTIDAD, no de mérito: dice cuál es el máximo, no si está bien.
        l === maxima ? 'máxima' : '',
      ]),
      { anchos: [70, 40, 30], sangria: 4 },
    )
  }
}

/**
 * La invasión a colindantes: la ÚNICA excepción de la regla de oro 9 en todo el
 * proyecto, porque es un hecho topológico binario con consecuencia fija.
 *
 * ⛔ Con `consultado: false` **jamás** se escribe «ninguna». «No se ha consultado» y
 * «no hay invasión» son afirmaciones opuestas, y la falsa es la que tranquiliza:
 * es el error silencioso más caro que este informe podría cometer, porque acabaría
 * firmado.
 */
function bloqueInvasion(maqueta, invasion) {
  if (!esObjeto(invasion)) {
    maqueta.parrafo('El diagnóstico no trae la sección de invasión a colindantes.', { sangria: 4 })
    return
  }
  if (invasion.consultado !== true) {
    maqueta.parrafo(
      'No se ha consultado. Este informe no dice nada sobre si la parcela invade a sus ' +
        'colindantes: para saberlo hay que traer del Catastro las parcelas vecinas y volver a ' +
        'diagnosticar.',
      { sangria: 4 },
    )
    return
  }

  const hallazgos = lista(invasion.invasiones)
  if (hallazgos.length === 0) {
    maqueta.parrafo(
      'Se han consultado las parcelas colindantes y no comparte superficie con ninguna.',
      { sangria: 4 },
    )
  } else {
    maqueta.parrafo('Se ha consultado. La parcela comparte superficie con:', { sangria: 4 })
    maqueta.hueco(1.5)
    maqueta.tabla(
      ['Referencia catastral', 'Superficie compartida'],
      hallazgos.map((h) => [
        textoONulo(h?.refcat) ?? 'parcela sin referencia',
        m2(h?.area),
      ]),
      { anchos: [90, 50], sangria: 4 },
    )
  }

  const descartadas = lista(invasion.descartadas)
  if (descartadas.length > 0) {
    const total = descartadas.reduce((s, x) => s + (esNumero(x?.area) ? x.area : 0), 0)
    const grosor = Math.max(...descartadas.map((x) => (esNumero(x?.grosor) ? x.grosor : 0)))
    maqueta.parrafo(
      `Se han descartado ${plural(descartadas.length, 'solape', 'solapes')} que suman ` +
        `${m2(total)}, el más grueso de ${FORMATO_COORD.format(grosor * 1000)} mm: son astillas ` +
        'de redondeo del lindero compartido, no superficie. Se dejan escritas para que el ' +
        'criterio se pueda auditar.',
      { tam: TAM.MENOR, gris: GRIS.SECUNDARIO, sangria: 4 },
    )
  }
}

/**
 * El margen del BOE, que se ENUNCIA. Aquí está la línea más fácil de cruzar de
 * todo el informe: bastaría poner la cifra de arriba al lado de ésta para
 * convertir una capa informativa en el veredicto que la spec prohíbe. No se hace,
 * y el propio texto dice que no se hace.
 */
function bloqueMargen(maqueta, d) {
  if (!esObjeto(d.margen)) {
    maqueta.parrafo(motivoOmision(d, OMISION_CONOCIDA.MARGEN), { sangria: 4 })
    return
  }
  const m = d.margen
  const clase = textoONulo(m.clase) ?? NO_CONSTA
  // La ETIQUETA llega dentro del propio diagnóstico —viaja con la cifra justo para
  // que no se pueda escribir la una sin la otra— y se ENUNCIA en una frase, no como
  // el rótulo de un campo: un rótulo invita a poner al lado el valor con el que se
  // compara, y aquí no se compara con nada.
  const etiqueta = textoONulo(m.etiqueta) ?? 'margen de identidad del Catastro'
  maqueta.parrafo(
    `${etiqueta.charAt(0).toUpperCase()}${etiqueta.slice(1)} en clase ${clase}: ` +
      `±${metros(m.perimetroM)} de perímetro y ${porcentaje(m.superficieRelativo)} de superficie.`,
    { sangria: 4 },
  )
  maqueta.hueco(1.5)
  maqueta.campo(
    'Clase de suelo',
    `${clase}${m.deducida ? ' (propuesta por la aplicación, no elegida por una persona)' : ' (elegida)'}`,
    { sangria: 4 },
  )
  if (textoONulo(m.criterio) !== null) {
    maqueta.campo('Criterio de la propuesta', m.criterio, { sangria: 4 })
  }
  maqueta.parrafo(
    'Fuente: BOE-A-2020-12111. Es un criterio de IDENTIDAD —si se está hablando de la misma ' +
      'finca— y no una calificación del levantamiento. Este informe lo ENUNCIA y no lo enfrenta ' +
      'a las cifras de arriba: esa lectura es del colegiado que firma. Una discrepancia grande ' +
      'significa a menudo que la geometría catastral está mal, y ése suele ser el motivo por el ' +
      'que se abre el expediente.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO, sangria: 4 },
  )
}

// ── 5 · Descripción literaria del lindero ────────────────────────────────────

/**
 * Sección 5 · el lindero redactado.
 *
 * `lindero` y `notaTecnica` llegan SEPARADOS de `report/literal.js` precisamente
 * para esto: el lindero va en cuerpo normal —es lo que se copia a una escritura o
 * a una instancia— y la nota técnica en **cuerpo menor**, entera y sin perder una
 * palabra, para que quien lea el documento sepa contra qué norte y con qué método
 * está escrito sin que eso se cuele en el portapapeles.
 */
function seccionLindero(maqueta, num, { literal }) {
  epigrafe(maqueta, num, 'Descripción literaria del lindero')

  if (literal === null) {
    maqueta.parrafo(
      'No se ha compuesto la descripción literaria del lindero, así que este informe no la ' +
        'lleva. No significa que la parcela no tenga lindero descriptible: significa que no se ' +
        'ha pedido o no se ha podido redactar.',
    )
    return []
  }

  for (const parrafo of lista(literal.lindero)) {
    maqueta.parrafo(parrafo)
    maqueta.hueco(AIRE.PARRAFO)
  }

  // ── La tabla de tramos: la presunción, TABULADA ────────────────────────────
  const tramos = lista(literal.tramos)
  const conPresuncion = tramos.filter((t) => textoONulo(t?.presuncionNoVerificada) !== null)
  if (tramos.length > 0) {
    maqueta.hueco(AIRE.ANTES_APARTADO)
    maqueta.renglon('Relación de tramos', { tam: TAM.APARTADO, fuente: 'negrita' })
    maqueta.hueco(AIRE.DESPUES_APARTADO)
    maqueta.tabla(
      ['Nº', 'Cardinal', 'Rumbo', 'Lados', 'Longitud', 'Linda con', 'Atribución'],
      tramos.map((t, i) => [
        String(i + 1),
        textoONulo(t?.cardinal) ?? NO_CONSTA,
        grados(t?.azimut),
        cuenta(t?.nLados),
        metros(t?.longitud),
        textoONulo(t?.refcat) ??
          (textoONulo(t?.label) === null
            ? 'Sin referencia catastral'
            : `Rotulada «${t.label}»`),
        textoPresuncion(t?.presuncionNoVerificada),
      ]),
      { anchos: [10, 25, 17, 13, 22, 44, 49], izquierda: [1, 5, 6], sangria: 0 },
    )
  }

  if (conPresuncion.length > 0) {
    maqueta.hueco(AIRE.PARRAFO)
    maqueta.recuadro([
      AVISO_PRESUNCION,
      // Se cita el tramo por su NÚMERO en la tabla de arriba y por su cardinal y
      // longitud: quien lo busque tiene que poder encontrarlo sin contar renglones.
      ...conPresuncion.map(
        (t) =>
          `· Tramo ${cuenta(tramos.indexOf(t) + 1)} (${textoONulo(t?.cardinal) ?? NO_CONSTA}, ` +
          `${metros(t?.longitud)}): ${textoPresuncion(t?.presuncionNoVerificada)}.`,
      ),
    ])
  }

  const nota = lista(literal.notaTecnica)
  if (nota.length > 0) {
    maqueta.hueco(AIRE.ANTES_APARTADO)
    for (const parrafo of nota) {
      maqueta.parrafo(parrafo, { tam: TAM.MENOR, gris: GRIS.SECUNDARIO })
      maqueta.hueco(1.2)
    }
  }

  return conPresuncion
}

/**
 * Cómo se escribe la atribución de un tramo. **Un código desconocido se imprime
 * crudo y marcado**, nunca como si fuera una medición: antes un código feo que un
 * renglón que parezca medido sin serlo (regla de oro 1).
 */
function textoPresuncion(codigo) {
  const clave = textoONulo(codigo)
  if (clave === null) return 'Medida'
  return TEXTO_PRESUNCION[clave] ?? `PRESUNCIÓN no verificada: ${clave}`
}

// ── 6 · Lectura del fichero aportado (opcional) ──────────────────────────────

/**
 * Sección opcional · qué se leyó del fichero.
 *
 * **Solo existe si hubo fichero**: cuando la parcela llegó por referencia
 * catastral, `comprobacion` es `null` y esta sección no se emite —ni como epígrafe
 * vacío: un epígrafe con «no procede» debajo es un hueco raro con otro nombre— y
 * las demás se renumeran sin dejar salto.
 *
 * Va DESPUÉS de la descripción del lindero y antes de la firma porque es
 * procedencia, no argumento: quien lee el informe quiere primero las cifras y el
 * lindero, y quien lo audita quiere esto.
 */
function seccionFichero(maqueta, num, { comprobacion }) {
  epigrafe(maqueta, num, 'Procedencia y lectura del fichero aportado')

  const dialecto = esObjeto(comprobacion.dialecto) ? comprobacion.dialecto : {}
  const fichero = esObjeto(comprobacion.fichero) ? comprobacion.fichero : {}
  const miembros = lista(comprobacion.miembros)
  const elegido = esNumero(comprobacion.elegido) ? miembros[comprobacion.elegido] : null

  maqueta.campo('Nombre del fichero', textoONulo(fichero.nombre) ?? NO_CONSTA)
  maqueta.campo('Dialecto', textoONulo(dialecto.etiqueta) ?? textoONulo(dialecto.id) ?? NO_CONSTA)
  if (textoONulo(dialecto.queSignifica) !== null) {
    maqueta.campo('Qué significa', dialecto.queSignifica)
  }
  if (typeof dialecto.soportado === 'boolean') {
    // CAPACIDAD, no mérito, y por eso se redacta en primera persona de la
    // herramienta: un GML 3.0 no soportado sí enseña su parcela y uno de edificio
    // no, así que la frase que valdría para el uno mentiría sobre el otro.
    maqueta.campo(
      'Soporte de la aplicación',
      dialecto.soportado
        ? 'La aplicación soporta este dialecto.'
        : 'La aplicación no soporta este dialecto.',
    )
  }
  maqueta.campo('Codificación declarada', textoONulo(fichero.encodingDeclarado) ?? NO_CONSTA)
  maqueta.campo('Codificación empleada', textoONulo(fichero.encodingUsado) ?? NO_CONSTA)
  if (typeof comprobacion.puedeContinuar === 'boolean') {
    maqueta.campo(
      'Continuación',
      comprobacion.puedeContinuar
        ? 'La aplicación puede contrastar esta parcela con el parcelario.'
        : 'La aplicación no puede contrastar esta parcela: ' +
            `${textoONulo(comprobacion.motivoNoContinua) ?? 'no se ha indicado el motivo.'}`,
    )
  }

  // ── Las parcelas del fichero ───────────────────────────────────────────────
  // Multiparcela está fuera de alcance (SPEC §1): se ELIGE una, nunca se unen. Las
  // demás se listan porque quedan en el fichero y quien firma tiene derecho a saber
  // que están ahí y que no entran en este informe.
  maqueta.hueco(AIRE.ANTES_APARTADO)
  maqueta.renglon(`Parcelas que trae el fichero: ${plural(miembros.length, 'parcela', 'parcelas')}`, {
    tam: TAM.APARTADO,
    fuente: 'negrita',
  })
  maqueta.hueco(AIRE.DESPUES_APARTADO)
  if (miembros.length === 0) {
    maqueta.parrafo('El fichero no trae parcelas legibles.', { sangria: 4 })
  } else {
    maqueta.tabla(
      ['Nº', 'Identificación', 'Vértices', 'Huecos', 'Declarada', 'Medida', 'En este informe'],
      miembros.map((m, i) => [
        String((esNumero(m?.indice) ? m.indice : i) + 1),
        textoONulo(m?.etiqueta) ?? textoONulo(m?.refcat) ?? textoONulo(m?.localId) ?? 'Sin etiqueta',
        cuenta(m?.nVertices),
        cuenta(m?.nHuecos),
        m2Entero(m?.superficieDeclarada),
        m2(m?.superficieMedida),
        elegido === m ? 'Sí' : 'No',
      ]),
      { anchos: [8, 52, 16, 14, 26, 30, 34], izquierda: [1] },
    )
  }

  // ── Notas, bloqueos y geometría ────────────────────────────────────────────
  bloqueDetecciones(maqueta, num, 'Notas de la lectura', comprobacion.notas, 'Sin notas.')
  bloqueDetecciones(maqueta, num, 'Bloqueos', comprobacion.bloqueos, 'Sin bloqueos.')

  maqueta.hueco(AIRE.ANTES_APARTADO)
  maqueta.renglon('Geometría de la parcela elegida', { tam: TAM.APARTADO, fuente: 'negrita' })
  maqueta.hueco(AIRE.DESPUES_APARTADO)
  if (comprobacion.hallazgos === null || comprobacion.hallazgos === undefined) {
    maqueta.parrafo('No se ha revisado la geometría.', { sangria: 4 })
  } else {
    listaDetecciones(maqueta, comprobacion.hallazgos, 'Sin hallazgos que reseñar.')
  }
}

/** Un apartado con una lista de detecciones. */
function bloqueDetecciones(maqueta, num, titulo, detecciones, vacio) {
  maqueta.hueco(AIRE.ANTES_APARTADO)
  maqueta.renglon(titulo, { tam: TAM.APARTADO, fuente: 'negrita' })
  maqueta.hueco(AIRE.DESPUES_APARTADO)
  listaDetecciones(maqueta, detecciones, vacio)
}

/**
 * Detecciones o hallazgos, con su severidad DELANTE. Digiere las dos formas que
 * llegan a este informe sin adaptador, porque son dos vocabularios distintos que
 * dicen lo mismo: `DeteccionGml` (`{tipo, mensaje, severidad}`, de `gml/`) y
 * `Hallazgo` (`{nivel, mensaje, verticesAfectados, correccion}`, de `validation/`).
 * La severidad va delante porque una nota sin severidad se lee con el tono de quien
 * la lee, no con el de quien la escribió.
 *
 * El `mensaje` se copia LITERAL: es de otra capa, lo redactó quien sabe por qué, y
 * reescribirlo aquí crearía una segunda versión que puede divergir.
 */
function listaDetecciones(maqueta, detecciones, vacio) {
  const items = lista(detecciones)
  if (items.length === 0) {
    maqueta.parrafo(vacio, { sangria: 4 })
    return
  }
  for (const d of items) {
    const severidad = textoONulo(d?.severidad) ?? textoONulo(d?.nivel) ?? 'INFO'
    const partes = [textoONulo(d?.mensaje) ?? 'Detección sin mensaje.']
    const donde = refsVertices(d?.verticesAfectados)
    if (donde !== '') partes.push(`— ${donde}`)
    // `correccion` solo viene en los ERROR de F02, y lleva el VERBO de la acción
    // («Eliminar vértice duplicado», no «Corregir»). En un informe que alguien va a
    // leer lejos de la pantalla es la mitad útil del hallazgo.
    const correccion = textoONulo(d?.correccion)
    if (correccion !== null) partes.push(`— ${correccion}`)
    const tipo = textoONulo(d?.tipo)
    if (tipo !== null) partes.push(`(${tipo})`)
    maqueta.parrafo(`[${severidad}]  ${partes.join(' ')}`, { tam: TAM.MENOR, sangria: 4 })
    maqueta.hueco(1)
  }
}

/** Cuántas referencias de vértice se enumeran antes de resumir el resto. */
const MAX_VERTICES_CITADOS = 12

/**
 * Las referencias `{recinto, indice}` de un Hallazgo, en texto y **1-based**, que
 * es como se numeran los vértices para el humano en toda la aplicación.
 *
 * Existe porque los mensajes de `validation/` NO nombran los vértices: dicen
 * «Vértices consecutivos duplicados» y ponen el CUÁL en `verticesAfectados`, para
 * que el visor los resalte. En un papel no hay nada que resaltar, así que si esa
 * lista no se imprime el dato se pierde — y con él, el único modo que tiene quien
 * firma de ir a corregirlo.
 */
function refsVertices(refs) {
  const porRecinto = new Map()
  for (const r of lista(refs)) {
    if (!esNumero(r?.recinto) || !esNumero(r?.indice)) continue
    if (!porRecinto.has(r.recinto)) porRecinto.set(r.recinto, [])
    porRecinto.get(r.recinto).push(r.indice + 1)
  }
  const partes = []
  for (const [recinto, indices] of porRecinto) {
    const citados = indices.slice(0, MAX_VERTICES_CITADOS)
    const resto = indices.length - citados.length
    partes.push(
      `${rotuloRecinto(recinto).toLowerCase()}, ` +
        `${citados.length === 1 ? 'vértice' : 'vértices'} ${citados.join(', ')}` +
        (resto > 0 ? ` y ${cuenta(resto)} más` : ''),
    )
  }
  return partes.join(' · ')
}

// ── 7 · Pie de firma ─────────────────────────────────────────────────────────

/**
 * La última sección, y **la que sostiene toda la propuesta de valor**
 * (`spec/feature-09-informe-parcela.md:21`).
 *
 * Neutral por obligación, no por estilo: quién puede firmar qué está en disputa
 * jurídica, así que el bloque no presupone titulación, no la insinúa y no ofrece
 * una lista de la que elegirla. Los rótulos y el título los pone
 * `report/firma.js`, que lleva su propio guardián de vocabulario; aquí solo se
 * colocan.
 *
 * Las cuatro líneas salen SIEMPRE, aunque no haya ni un dato: una línea que
 * desaparece se lee como «este documento no necesitaba ese dato», y lo que pasa es
 * que falta.
 */
function seccionFirma(maqueta, num, { firma }) {
  // El bloque entero junto, **y el epígrafe con él**: una firma partida entre dos
  // hojas es una firma que hay que explicar, y un «FIRMA» solo al pie de la
  // anterior es peor todavía.
  const altoBloque = TAM.CUERPO * INTERLINEA * 4 + 34
  epigrafe(maqueta, num, TITULO_FIRMA, { altoMinimo: altoBloque })

  for (const linea of lineasFirma(firma)) {
    maqueta.campo(linea.etiqueta, linea.valor)
  }

  maqueta.hueco(22)
  maqueta.doc.linea(maqueta.x0, maqueta.y, maqueta.x0 + 80, maqueta.y, {
    grosor: 0.3,
    gris: GRIS.TEXTO,
  })
  maqueta.y += 1.5
  maqueta.renglon('Firma', { tam: TAM.MENOR, gris: GRIS.ROTULO })
  maqueta.hueco(AIRE.PARRAFO)
  maqueta.parrafo(
    'Este documento no lleva firma electrónica ni código seguro de verificación: la firma es ' +
      'la que estampe quien suscribe, con los medios que su colegio y el destinatario admitan. ' +
      'El identificador que consta en el encabezado lo emite esta aplicación y sirve para ' +
      'rastrear el documento, no para verificarlo ante ningún organismo.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO },
  )
}

// ── Cierre · lo que le pasó a la composición ─────────────────────────────────

/**
 * Las sustituciones de caracteres, si las hubo. **Va al final y solo se puede
 * escribir aquí**: `sustituciones()` no sabe lo que hubo hasta que se ha escrito
 * el último renglón (ver la cabecera).
 *
 * Se enumeran por su PUNTO DE CÓDIGO y no reimprimiendo el carácter: el carácter
 * volvería a sustituirse y el aviso diría «se ha sustituido ? por ?».
 *
 * @returns {string[]}  Las incidencias, en español, para el valor de retorno.
 */
function bloqueSustituciones(maqueta, doc) {
  const sustituciones = doc.sustituciones()
  if (sustituciones.length === 0) return []

  const porPunto = new Map()
  for (const s of sustituciones) {
    const clave = s.punto
    if (!porPunto.has(clave)) porPunto.set(clave, { punto: clave, veces: 0, paginas: new Set() })
    const entrada = porPunto.get(clave)
    entrada.veces += 1
    entrada.paginas.add(s.pagina)
  }

  const lineas = [...porPunto.values()].map(
    (e) =>
      `· U+${e.punto.toString(16).toUpperCase().padStart(4, '0')}: ` +
      `${plural(e.veces, 'vez', 'veces')}, en ` +
      `${plural(e.paginas.size, 'página', 'páginas')} (${[...e.paginas].sort((a, b) => a - b).join(', ')}).`,
  )

  maqueta.hueco(AIRE.ANTES_SECCION)
  maqueta.necesita(TAM.SECCION * INTERLINEA * 3)
  maqueta.renglon('NOTA DE COMPOSICIÓN', { tam: TAM.SECCION, fuente: 'negrita' })
  maqueta.filete({ grosor: 0.4, gris: GRIS.SECUNDARIO })
  maqueta.hueco(AIRE.DESPUES_SECCION)
  maqueta.parrafo(
    'Algunos caracteres del texto no tienen representación en la codificación de este documento ' +
      'y se han dibujado como «?». No se han perdido en silencio: aquí van, por su punto de ' +
      'código Unicode, para que quien firma pueda corregirlos en el origen antes de entregar.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO },
  )
  maqueta.hueco(1.5)
  for (const linea of lineas) maqueta.parrafo(linea, { tam: TAM.MENOR, sangria: 4 })

  return [
    `Se han sustituido ${plural(sustituciones.length, 'carácter', 'caracteres')} sin ` +
      'representación en la codificación del documento; el informe lo declara en su nota de ' +
      'composición.',
  ]
}

// ── El pie de página ─────────────────────────────────────────────────────────

/**
 * Estampa el pie en TODAS las páginas, ya sabiendo cuántas son.
 *
 * Es la segunda pasada de la que habla la cabecera: el cuerpo se compone una vez,
 * se pregunta `nPaginas()` y se vuelve con `irAPagina`. El documento no se compone
 * dos veces, así que el pie no puede decir una cosa y el cuerpo otra.
 */
function estamparPies(doc, { idDocumento, atribucion }) {
  const total = doc.nPaginas()
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.irAPagina(pagina)
    doc.linea(MARGEN.IZQUIERDA, Y_FILETE_PIE, MARGEN.IZQUIERDA + ANCHO_UTIL, Y_FILETE_PIE, {
      grosor: 0.25,
      gris: GRIS.FILETE,
    })

    const izquierda = `${NOMBRE_INFORME} · ${idDocumento}`
    doc.texto(izquierda, {
      x: MARGEN.IZQUIERDA,
      y: Y_FILETE_PIE + 3.4,
      tam: TAM.PIE,
      gris: GRIS.PIE,
    })

    const numeracion = `Página ${cuenta(pagina)} de ${cuenta(total)}`
    const anchoNumeracion = doc.medirTexto(numeracion, { tam: TAM.PIE })
    doc.texto(numeracion, {
      x: MARGEN.IZQUIERDA + ANCHO_UTIL - anchoNumeracion,
      y: Y_FILETE_PIE + 3.4,
      tam: TAM.PIE,
      gris: GRIS.PIE,
    })

    if (atribucion !== '') {
      doc.texto(atribucion, {
        x: MARGEN.IZQUIERDA,
        y: Y_FILETE_PIE + 7,
        tam: TAM.PIE,
        gris: GRIS.PIE,
      })
    }
  }
  return total
}

// ── Guardas de la entrada pública ────────────────────────────────────────────

/** @throws {TypeError} */
function exigirEncabezado(encabezado) {
  if (!esObjeto(encabezado)) {
    throw new TypeError(
      "informePdfParcela: 'encabezado' debe ser el objeto de report/firma.js#componerEncabezado " +
        `(contrato D); recibido ${describir(encabezado)}. De él salen la fecha y el identificador ` +
        'del documento: este módulo no consulta el reloj.',
    )
  }
  if (!(encabezado.fecha instanceof Date) || !Number.isFinite(encabezado.fecha.getTime())) {
    throw new TypeError(
      "informePdfParcela: 'encabezado.fecha' debe ser una fecha utilizable; recibido " +
        `${describir(encabezado.fecha)}. Compón el encabezado con componerEncabezado en vez de a ` +
        'mano.',
    )
  }
  if (textoONulo(encabezado.idDocumento) === null) {
    throw new TypeError(
      "informePdfParcela: 'encabezado.idDocumento' no puede faltar. Un documento cuyo " +
        'identificador dice «No consta» no es honrado, es inservible: componerEncabezado lo ' +
        'compone cuando el expediente no trae uno.',
    )
  }
}

/** @throws {TypeError|RangeError} */
function exigirPlano(plano, encuadre) {
  if (plano === null) return
  if (!esObjeto(plano)) {
    throw new TypeError(
      "informePdfParcela: 'plano' debe ser el objeto de report/canvas.js#componerPlano " +
        `(contrato B) o null si no se ha podido componer; recibido ${describir(plano)}.`,
    )
  }
  if (!(plano.jpeg instanceof Uint8Array)) {
    throw new TypeError(
      `informePdfParcela: 'plano.jpeg' debe ser un Uint8Array con los bytes del JPEG; recibido ` +
        `${describir(plano.jpeg)}.`,
    )
  }
  for (const clave of ['anchoPx', 'altoPx']) {
    if (!Number.isInteger(plano[clave]) || plano[clave] < 1) {
      throw new RangeError(
        `informePdfParcela: 'plano.${clave}' debe ser un entero ≥ 1 de píxeles; recibido ` +
          `${describir(plano[clave])}. Son los que se contrastan contra el SOF real del JPEG.`,
      )
    }
  }
  if (!esObjeto(encuadre)) {
    throw new TypeError(
      "informePdfParcela: con un 'plano' hace falta el 'encuadre' que lo produjo " +
        `(report/encuadre.js#encuadrar, contrato A); recibido ${describir(encuadre)}. De él sale ` +
        'la escala que se rotula, y calcularla aquí sería una segunda verdad.',
    )
  }
  for (const clave of ['anchoMm', 'altoMm', 'escalaDenominador']) {
    if (typeof encuadre[clave] !== 'number' || !(encuadre[clave] > 0)) {
      throw new TypeError(
        `informePdfParcela: 'encuadre.${clave}' debe ser un número > 0; recibido ` +
          `${describir(encuadre[clave])}. ¿Se ha construido el encuadre a mano en vez de con ` +
          'report/encuadre.js#encuadrar?',
      )
    }
  }
}

// ── La función pública ───────────────────────────────────────────────────────

/**
 * El informe de contraste con el parcelario catastral, en PDF firmable.
 *
 * ```js
 * const encuadre = encuadrar({ recintos: parcela.recintos, anchoMm: 180, altoMm: 130 })
 * const plano = await componerPlano({ encuadre, recintos: parcela.recintos })
 * const literal = describirLindero({ recintos: parcela.recintos, vecinas, clase })
 * const encabezado = componerEncabezado({ descriptivos, refcat, srs, fecha, idDocumento })
 *
 * const { bytes, nPaginas } = informePdfParcela({
 *   diagnostico, parcela, comprobacion, plano, encuadre, literal, encabezado, firma,
 * })
 * descargarBytes(bytes, 'informe.pdf')   // la descarga es de gml/descargar.js
 * ```
 *
 * ### El contenido, en el orden de `spec/feature-09-informe-parcela.md` §Contenido
 *
 *   1. **Encabezado** con municipio, paraje, polígono/parcela, referencia
 *      catastral, SRS, fecha e identificador único de documento.
 *   2. **Plano de situación** a escala declarada, con norte, escala gráfica y
 *      cartografía de fondo (van dibujados dentro del JPEG del contrato B; la
 *      escala NUMÉRICA la rotula el PDF).
 *   3. **Relación de vértices** con coordenadas, superficie y perímetro.
 *   4. **Diagnóstico de encaje y comparación a tres bandas**: las cifras, SIN
 *      valoración.
 *   5. **Descripción literaria del lindero**, con la nota técnica en cuerpo menor.
 *   6. **Procedencia y lectura del fichero** — *solo si hubo fichero*; si no, esta
 *      sección no existe y la numeración no deja hueco.
 *   7. **Pie de firma**.
 *
 * Más numeración «Página N de M» en todas las páginas y la atribución legal de la
 * cartografía al pie.
 *
 * ### Qué garantiza
 *
 *   · **Nombre legal.** {@link NOMBRE_INFORME}, y ni una sigla de los documentos
 *     oficiales del Catastro en todo el papel (ver la cabecera).
 *   · **Ninguna cifra con juicio de valor** (SPEC §2, regla 9), ni en las palabras
 *     ni en la tinta. El margen del BOE se enuncia y no se compara.
 *   · **`null` es «No consta», nunca 0**, y «no se ha consultado» nunca es
 *     «ninguna».
 *   · **La presunción de vía pública se ve en el papel** —tabulada y en recuadro—,
 *     no solo dentro de una cadena de texto.
 *   · **Lo que le falta al plano se dice debajo del plano**, y los caracteres
 *     sustituidos se enumeran al final.
 *
 * @param {Object} entrada
 * @param {Object} entrada.diagnostico  Lo que devuelve
 *   `diagnostico/parcela.js#diagnosticar`. **Obligatorio**: sin él no hay informe.
 * @param {Object} entrada.encabezado  El de `report/firma.js#componerEncabezado`
 *   (contrato D). **Obligatorio**: trae la fecha y el identificador del documento,
 *   que este módulo no puede inventarse porque no lee el reloj.
 * @param {Object|null} [entrada.parcela=null]  El POJO de `model/parcela.js`
 *   (`refcat`, `origen`, `recintos`…). `null` es legítimo: entonces los vértices
 *   salen de `comprobacion.geometria`.
 * @param {Object|null} [entrada.comprobacion=null]  La `Comprobacion` de
 *   `comprobacion/gml.js`. **`null` es un caso frecuente**: la parcela llegó por
 *   referencia catastral y no hubo fichero. Entonces la sección de procedencia no
 *   se emite y las demás se renumeran, sin dejar hueco.
 * @param {Object|null} [entrada.plano=null]  El del contrato B
 *   (`report/canvas.js#componerPlano`). `null` = no se pudo componer, y el informe
 *   sale diciéndolo.
 * @param {Object|null} [entrada.encuadre=null]  El del contrato A. Obligatorio si
 *   hay `plano`: de él salen la escala rotulada y el tamaño impreso.
 * @param {Object|null} [entrada.literal=null]  El de
 *   `report/literal.js#describirLindero` (contrato C), **posiblemente editado por
 *   el usuario antes de exportar**, que es lo que exige la spec. `null` = no hay
 *   descripción y el informe lo dice.
 * @param {Object|null} [entrada.firma=null]  El pie de firma (contrato D). `null`
 *   imprime los cuatro campos con «No consta», que es lo correcto y no un hueco.
 * @param {Object|null} [entrada.procedencia=null]  La de
 *   `report/firma.js#procedenciaDescriptivos`, o el sobre del contrato E tal cual.
 *   `null` significa **no se ha consultado**, que se imprime distinto de «no
 *   consta».
 * @returns {{bytes: Uint8Array, nPaginas: number, idDocumento: string, titulo: string,
 *   nombreFichero: string, sustituciones: ReadonlyArray<Object>, incidencias: string[]}}
 *   `incidencias` son, en español, las cosas que el informe ha tenido que declarar
 *   de sí mismo (capas de cartografía caídas, trozos sin cartografía, caracteres
 *   sustituidos). Vacío es la respuesta normal.
 * @throws {TypeError}  Contrato del programador: `entrada` que no es objeto,
 *   `diagnostico` o `encabezado` ausentes o mal formados, `plano` sin `encuadre`,
 *   o cualquier pieza con un tipo imposible.
 * @throws {RangeError}  Si el plano no cabe en el papel sin reescalarlo, si se
 *   imprimiría estirado, o lo que lance `report/pdf.js#imagenJpeg` cuando los
 *   píxeles declarados no cuadran con el `SOF` real del JPEG.
 */
export function informePdfParcela(entrada) {
  if (!esObjeto(entrada)) {
    throw new TypeError(
      'informePdfParcela: se espera un objeto {diagnostico, encabezado, parcela, comprobacion, ' +
        `plano, encuadre, literal, firma}; recibido ${describir(entrada)}.`,
    )
  }

  const {
    diagnostico,
    encabezado,
    parcela = null,
    comprobacion = null,
    plano = null,
    encuadre = null,
    literal = null,
    firma = null,
    procedencia = null,
  } = entrada

  if (!esObjeto(diagnostico)) {
    throw new TypeError(
      "informePdfParcela: 'diagnostico' debe ser el objeto que devuelve diagnosticar(); " +
        `recibido ${describir(diagnostico)}.`,
    )
  }
  if (comprobacion !== null && !esObjeto(comprobacion)) {
    throw new TypeError(
      "informePdfParcela: 'comprobacion' debe ser una Comprobacion o null (null = la parcela no " +
        `vino de un fichero); recibido ${describir(comprobacion)}.`,
    )
  }
  if (parcela !== null && !esObjeto(parcela)) {
    throw new TypeError(
      `informePdfParcela: 'parcela' debe ser el POJO del modelo o null; recibido ${describir(parcela)}.`,
    )
  }
  if (literal !== null && !esObjeto(literal)) {
    throw new TypeError(
      "informePdfParcela: 'literal' debe ser el objeto de describirLindero() o null; recibido " +
        `${describir(literal)}.`,
    )
  }
  exigirEncabezado(encabezado)
  exigirPlano(plano, encuadre)

  const idDocumento = encabezado.idDocumento.trim()
  const srs =
    textoONulo(encabezado.srs) ??
    textoONulo(parcela?.srs) ??
    textoONulo(comprobacion?.geometria?.srs) ??
    NO_CONSTA

  const doc = crearDocumentoPdf({
    anchoMm: A4_ANCHO_MM,
    altoMm: A4_ALTO_MM,
    titulo: `${NOMBRE_INFORME} · ${idDocumento}`,
    autor: textoONulo(firma?.nombre),
    productor: PRODUCTOR,
    // INYECTADA dentro del encabezado: este módulo no consulta el reloj.
    fecha: encabezado.fecha,
  })

  const maqueta = crearMaqueta(doc)
  const num = crearNumerador()
  const incidencias = []

  portada(maqueta)
  seccionEncabezado(maqueta, num, { encabezado, procedencia, parcela, comprobacion })
  seccionPlano(maqueta, num, { plano, encuadre, srs })
  seccionVertices(maqueta, num, { parcela, comprobacion, diagnostico, srs })
  seccionDiagnostico(maqueta, num, { diagnostico })
  seccionLindero(maqueta, num, { literal })
  if (comprobacion !== null) seccionFichero(maqueta, num, { comprobacion })
  seccionFirma(maqueta, num, { firma })

  // ── Lo que hubo que declarar ───────────────────────────────────────────────
  for (const c of lista(plano?.capasCaidas)) {
    incidencias.push(
      `La capa de cartografía «${textoONulo(c?.capa) ?? NO_CONSTA}» no se ha dibujado en el ` +
        `plano: ${textoONulo(c?.motivo) ?? NO_CONSTA}`,
    )
  }
  for (const t of lista(plano?.teselasCaidas)) {
    incidencias.push(
      `Un trozo del plano ha quedado sin cartografía de fondo: ${textoONulo(t?.motivo) ?? NO_CONSTA}`,
    )
  }
  incidencias.push(...bloqueSustituciones(maqueta, doc))

  const nPaginas = estamparPies(doc, {
    idDocumento,
    atribucion: textoONulo(plano?.atribucion) ?? '',
  })

  return {
    bytes: doc.bytes(),
    nPaginas,
    idDocumento,
    titulo: NOMBRE_INFORME,
    // Nombre SUGERIDO para la descarga. Quien descarga es `gml/descargar.js`; aquí
    // solo se propone, y se propone con el identificador dentro para que dos
    // informes del mismo día no se pisen en la carpeta de descargas.
    nombreFichero: `informe-contraste-${idDocumento}.pdf`,
    sustituciones: doc.sustituciones(),
    incidencias,
  }
}
