// report/index.js — F09 · Tarea T5.2. LA CARA PÚBLICA DE LA CAPA `report/`.
//
// Es lo que el resto del proyecto ve de la rama del INFORME: de una medición ya
// diagnosticada al documento que alguien firma y entrega. Quien la consuma importa
// el espacio de nombres `report` del barrel raíz y no los módulos de dentro:
//
//   import { report } from './index.js'
//   const encuadre   = report.encuadrar({ recintos, anchoMm: 180, altoMm: 130 })
//   const literal    = report.describirLindero({ recintos, vecinas, clase })
//   const encabezado = report.componerEncabezado({ descriptivos, refcat, srs,
//     fecha: instanteQueDecideLaApp, idDocumento })
//   const { bytes }  = report.informePdfParcela({ diagnostico, encabezado, ... })
//
// (Como en `gml/index.js`, el ejemplo no dice de dónde sale
// `instanteQueDecideLaApp` porque no es asunto de esta capa: aquí NO se consulta
// el reloj. La fecha se inyecta, y por lo mismo que en `gml/`: un informe que
// dependa de `Date.now()` produce un snapshot que caduca y un documento que no se
// puede volver a emitir igual. Lo declaran las cabeceras de `contraste-texto.js`,
// `firma.js`, `encuadre.js`, `literal.js` y `pdf-parcela.js`.)
//
// ── POR QUÉ ESTE FICHERO EXISTE, Y POR QUÉ NO EXISTÍA ANTES ──────────────────
// Hasta F08 la capa entera era UN módulo, y el barrel raíz decía literalmente
// `export * as report from './report/contraste-texto.js'`: el espacio `report`
// ERA un fichero. Con F09 la capa pasa a seis módulos puros y ese atajo deja de
// sostenerse — habría obligado a elegir entre un segundo espacio de nombres por
// cada fichero nuevo (`report`, `encuadre`, `literal`, `firma`, `pdf`…, la capa
// desparramada por la raíz) o a que `report` siguiera nombrando a uno solo de los
// seis, en silencio y sin que nada lo dijera. El precedente del repo es
// `gml/index.js`, y se sigue entero, decisiones incluidas.
//
// `report/` es CAPA DE COMPOSICIÓN, un piso por encima de `geo/`, `validation/`,
// `diagnostico/` y `comprobacion/`: compone piezas puras de las capas de abajo y
// no conoce a nadie por encima suyo. No importa Leaflet, ni proj4 (regla de oro
// 7), ni nada de `viewer/`, `services/`, `storage/` o `app/`; de Turf usa solo lo
// topológico y por subpaquete (regla de oro 6, en `literal.js`). Por eso este
// barrel se puede cargar tal cual desde el proyecto Vitest `node`, que corre sin
// `window`, sin `document` y sin `Blob`, y por eso ENTRA en el barrel raíz
// `index.js` —al contrario que el visor—. Lo vigila `test/contrato.test.js`.
//
// ── DECISIÓN 1 · `report/canvas.js` SE QUEDA FUERA ───────────────────────────
// Es la misma decisión —y la misma frase— que `gml/index.js` escribió para
// `gml/descargar.js`. `componerPlano` crea un `<canvas>` con
// `document.createElement`, descarga las teselas del WMS con `Image` y saca el
// JPEG con `toBlob`: es código de NAVEGADOR, y además el único módulo de esta capa
// que habla por la RED. El barrel raíz lo carga el proyecto Vitest `node`
// —`test/contrato.test.js` lo importa—, así que meter aquí un módulo que nombra
// globales del DOM revienta la suite entera EN EL IMPORT, no en el uso: exactamente
// el fallo ya documentado para `viewer/index.js` y `services/*`.
//
// Conviene además no perder de vista la asimetría, porque es la que explica el
// reparto: `canvas.js` produce los BYTES DEL PLANO, y `pdf-parcela.js` los pega
// tal cual sin recodificar una muestra. Es decir, el impuro es un PROVEEDOR del
// puro, no al revés — igual que `descargar.js` es el consumidor del texto que
// produce `contraste-texto.js`. La frontera aguanta en los dos sentidos porque en
// ninguno de los dos hace falta cruzarla dentro de esta capa.
//
// La vía correcta —la que ya usa `app/main.js` con `viewer/index.js`— es importar
// el fichero DIRECTAMENTE desde la capa de aplicación:
//
//   import { componerPlano } from '../report/canvas.js'
//
// A quien venga a «completar el barrel» dentro de seis meses: eso deja la suite
// `node` entera en rojo, y el test que lo dice por escrito es
// `test/contrato.test.js` («contrato F09 · el informe sale por el barrel…»).
//
// ── DECISIÓN 2 · SUPERFICIE CURADA, NO `export *` ────────────────────────────
// Aquí se re-exporta POR NOMBRE, uno a uno, por los dos motivos de `gml/index.js`:
//
//   1. `export * from ...` NO da error cuando dos módulos exportan el mismo
//      identificador: DESCARTA la clave ambigua EN SILENCIO y el barrel deja de
//      exponerla. Con seis ficheros que hablan todos de lo mismo, el choque no es
//      hipotético — `literal.js` y `firma.js` ya tienen cada uno su vocabulario de
//      la clase de suelo ({@link CLASE_CONOCIDA} y {@link CLASES_ADMITIDAS}), que
//      hoy se llaman distinto por suerte y no por decreto. Con nombres explícitos,
//      un choque futuro es un `SyntaxError` de duplicado al cargar.
//   2. `export *` publicaría COSAS QUE NO SON API (decisión 3).
//
// ── DECISIÓN 3 · `crearDocumentoPdf` NO SALE: ES EL `gml/xml.js` DE ESTA CAPA ─
// `report/pdf.js` sí entra en el barrel —de él salen el tamaño del papel y el
// vocabulario de las sustituciones—, pero su ESCRITOR no. `crearDocumentoPdf`
// devuelve un documento con `.texto()`, `.rect()`, `.linea()`, `.imagenJpeg()` y
// `.medirTexto()`: es un escritor de PDF genérico, sin dominio, exactamente como
// `gml/xml.js` es un lector/escritor de XML genérico. Y el argumento que allí se
// escribió vale aquí letra por letra: publicarlo invita a COMPONER INFORMES A MANO
// por fuera de `informePdfParcela`, que es justo lo que ese módulo existe para
// impedir —el nombre legal del documento, la ausencia de siglas oficiales, la
// numeración de páginas, la atribución de la cartografía y la regla de oro 9 están
// todas dentro de él, no en el escritor—. Quien necesite el escritor crudo (hoy
// nadie fuera de `report/`, mañana quizá el informe de edificio de F10) lo importa
// directamente:
//
//   import { crearDocumentoPdf } from '../report/pdf.js'
//
// ── QUÉ NO SALE, Y POR QUÉ ───────────────────────────────────────────────────
//   · `report/canvas.js` ENTERO — decisión 1.
//   · `crearDocumentoPdf` — decisión 3.
//   · La fontanería de unidades y tipografía: `MM_POR_PULGADA`, `PUNTOS_POR_MM`
//     y `ANCHOS_AFM`. Describen CÓMO se escribe el fichero (la conversión interna
//     a puntos PostScript y las tablas de anchos AFM de Helvetica), no cómo se lee
//     el resultado. El API de `report/pdf.js` habla en MILÍMETROS y esa es la
//     unidad que cruza esta frontera; quien mide texto es el maquetador.
//   · `PREFIJO_ID_DOCUMENTO` y `SIN_REFCAT` — piezas internas de cómo se compone
//     un identificador de documento. Para componerlo está `componerIdDocumento` y
//     para reconocerlo `esIdDocumento`: publicar los trozos invita a fabricarlo
//     concatenando, y dos identificadores con formatos distintos en el mismo papel
//     es peor que no tener ninguno.
//
// Lo que SÍ sale es, en una frase: las CINCO funciones que componen el documento
// —encuadre, lindero, encabezado, informe en PDF e informe en texto—, las utilidades
// con las que se rellena y se imprime un dato que puede faltar, y el vocabulario
// CERRADO con el que se leen sus resultados.

// ── Tipos re-exportados para el consumidor ───────────────────────────────────
// No generan nada en tiempo de ejecución: permiten escribir
// `import('./report/index.js').Encuadre` sin bajar al módulo concreto, que es la
// misma frontera que impone el resto del fichero.

/**
 * @typedef {import('./encuadre.js').Bbox} Bbox
 * @typedef {import('./encuadre.js').Tesela} Tesela
 * @typedef {import('./encuadre.js').Encuadre} Encuadre
 * @typedef {import('./literal.js').VecinaLiteral} VecinaLiteral
 * @typedef {import('./literal.js').TramoLindero} TramoLindero
 * @typedef {import('./firma.js').Firma} Firma
 * @typedef {import('./firma.js').Encabezado} Encabezado
 * @typedef {import('./firma.js').ProcedenciaDescriptivos} ProcedenciaDescriptivos
 * @typedef {import('./firma.js').LineaImpresa} LineaImpresa
 */

// ── Contrato A · el encuadre del plano ───────────────────────────────────────
// De unos recintos y un tamaño de papel a la caja de mundo, la escala, el mapeo
// UTM→px y las peticiones de cartografía. Sale entero porque de él cuelgan CUATRO
// cifras que tienen que decir lo mismo o el documento miente (su cabecera las
// enumera), y `MAX_PIXELES_TESELA` es el techo MEDIDO del WMS del Catastro:
// pasarse no recorta, SUSTITUYE el tamaño en silencio.

export {
  MARGEN_DEFECTO_M,
  MAX_PIXELES_TESELA,
  PPP_INFORME,
  encuadrar,
  pxDesdeMm,
} from './encuadre.js'

// ── Contrato C · la descripción literaria del lindero ────────────────────────
// `describirLindero` es uno de los cuatro diferenciadores del producto. Su
// vocabulario sale con ella y no es adorno: `PRESUNCION` es cómo la UI reconoce un
// tramo que se describe por presunción y no por medición —el nombre del campo lleva
// la advertencia dentro, `presuncionNoVerificada`— y `MOTIVO_SALTADO` es por qué un
// lado no se ha descrito. Sin las tablas, la UI tendría que decidir mirando el
// TEXTO del mensaje, que es lo único que sí puede cambiar (regla de oro 1).

export { CLASE_CONOCIDA, MOTIVO_SALTADO, PRESUNCION, describirLindero } from './literal.js'

// ── Contrato D · el pie de firma y el encabezado ─────────────────────────────
// El punto que «sostiene toda la propuesta de valor» (spec F09 §21). Sale casi
// entero a propósito, porque su valor está justo en las piezas pequeñas:
//
//   · `componerEncabezado` y `procedenciaDescriptivos` convierten el sobre del
//     servicio (contrato E) en algo imprimible SIN completarlo de ningún otro sitio.
//   · `normalizarFirma`, `hayAlgunDato` y `FIRMA_VACIA` son la única definición de
//     qué es una firma vacía; `storage/pie-firma.js` ya normaliza con ellas al
//     escribir y al leer, para que un `''` guardado y un `null` guardado no puedan
//     imprimirse distinto.
//   · `paraImprimir`, `NO_CONSTA`, `NO_CONSULTADO` y `NO_SE_HA_PODIDO_CONSULTAR`
//     son LOS TRES SABORES DE «NO HAY», que este proyecto lleva distinguiendo desde
//     F07. Quien no los tenga a mano acabará escribiendo un hueco en blanco o un
//     «No consta» donde nadie preguntó, que son dos afirmaciones falsas distintas.
//   · `CLASE_URBANA`/`CLASE_RUSTICA`/`CLASES_ADMITIDAS` son la clase de suelo tal
//     como la produce `services/_catastro-dnp.js`. Ojo: `literal.js` tiene la SUYA
//     ({@link CLASE_CONOCIDA}) para habilitar la presunción de vía pública. Son dos
//     vocabularios con los mismos valores y propósitos distintos; se dejan separados
//     porque unificarlos ataría la presunción al servicio descriptivo.
//   · `textoFecha` da el formato de fecha del documento — recibiéndola, nunca
//     leyéndola del reloj.

export {
  CAMPOS_DEL_SERVICIO,
  CAMPOS_ENCABEZADO,
  CAMPOS_FIRMA,
  CAMPOS_SOLO_RUSTICA,
  CLASES_ADMITIDAS,
  CLASE_RUSTICA,
  CLASE_URBANA,
  FIRMA_VACIA,
  NO_CONSTA,
  NO_CONSULTADO,
  NO_SE_HA_PODIDO_CONSULTAR,
  ROTULO_ENCABEZADO,
  ROTULO_FIRMA,
  TITULO_FIRMA,
  componerEncabezado,
  componerIdDocumento,
  esIdDocumento,
  hayAlgunDato,
  lineasEncabezado,
  lineasFirma,
  normalizarFirma,
  paraImprimir,
  procedenciaDescriptivos,
  textoFecha,
} from './firma.js'

// ── Contrato F · el papel ────────────────────────────────────────────────────
// Del escritor de PDF salen SOLO el tamaño del papel —que es lo que necesita quien
// decide cuánto plano cabe— y el sustituto de los caracteres que CP1252 no puede
// escribir, que es vocabulario de salida: acompaña a las `sustituciones` que
// devuelve `informePdfParcela` y hace legible por qué hay un «?» en el papel.
// El escritor en sí no sale: decisión 3.

export { A4_ALTO_MM, A4_ANCHO_MM, SUSTITUTO_NO_REPRESENTABLE } from './pdf.js'

// ── El informe en PDF ────────────────────────────────────────────────────────
// La función que junta todo lo anterior, y las cuatro cadenas que fijan qué ES el
// documento: `NOMBRE_INFORME` es su nombre legal —ni una sigla de los documentos
// oficiales del Catastro—, `PRODUCTOR` quién lo emite, y los dos avisos son las
// frases que impiden que se lea como un documento oficial o como un dictamen
// (regla de oro 9). Salen por el barrel para que la UI pueda anunciar lo mismo que
// dice el papel en vez de una segunda redacción parecida.
// `PRESUNCION_CONOCIDA` es el eco impreso de `PRESUNCION` de `literal.js`.

export {
  AVISO_NO_OFICIAL,
  AVISO_REGLA_9,
  NOMBRE_INFORME,
  PRESUNCION_CONOCIDA,
  PRODUCTOR,
  informePdfParcela,
} from './pdf-parcela.js'

// ── El informe en TEXTO (F08) ────────────────────────────────────────────────
// El que ya salía por el barrel raíz cuando el espacio `report` era este fichero.
// Sigue siendo la salida del caso «Comprobar un GML» y no lo sustituye el PDF:
// aquel se pega en un correo o en una instancia, este se firma. `OMISION_CONOCIDA`
// es el vocabulario de lo que el informe no ha podido decir.

export { OMISION_CONOCIDA, informeContrasteTexto } from './contraste-texto.js'
