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
//     adelantarlo sería peor. Los pies de página se estampan DESPUÉS del bloque
//     —necesitan el total de páginas—, así que sus textos se PRE-ESCANEAN y la
//     nota los declara también (auditoría R3; ver
//     `report/maqueta.js#bloqueSustituciones`).
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

// ⚠️ Éste SÍ se importa, al revés que `report/literal.js#PRESUNCION` —del que este
// mismo fichero guarda una copia literal unas líneas más abajo—, y la diferencia es
// medible: aquel módulo arrastra `@turf/boolean-point-in-polygon` y `@turf/helpers`
// al grafo de un maquetador que tiene que poder probarse sin geometría.
// `derivacion/operacion.js` no arrastra nada: solo importa `derivacion/identidad.js`,
// que no importa nada. Copiar aquí las dos palabras del desplegable habría dado
// TRES sitios donde escribir «Subsanación» —éste, el informe de texto y la
// derivación— para un dato que ya tiene redundancia cero. Hay un guardián que
// comprueba que ese módulo sigue sin arrastrar nada, para que el motivo no caduque.
import { AVISO_DECLARATIVO, ROTULO_OPERACION } from '../derivacion/operacion.js'
import { OMISION_CONOCIDA } from './contraste-texto.js'
import { NO_CONSTA, lineasEncabezado } from './firma.js'
import { A4_ALTO_MM, A4_ANCHO_MM, crearDocumentoPdf } from './pdf.js'
// ⭐ F14 · El motor de maqueta salió de AQUÍ a `report/maqueta.js` para que el
// informe de construcción no se lleve una copia. Es un MOVIMIENTO, no una
// reescritura: el criterio de aceptación de aquella tarea fue que este PDF no
// cambiara **ni un byte**, y su snapshot es quien lo firma. Lo que quedó en este
// fichero es lo que habla de la PARCELA; lo que se fue es lo que habla del PAPEL.
import {
  AIRE,
  ANCHO_ROTULO,
  ANCHO_UTIL,
  FORMATO_0,
  FORMATO_1,
  FORMATO_2,
  FORMATO_COORD,
  GRIS,
  INTERLINEA,
  MARGEN,
  TAM,
  bloqueSustituciones,
  conSigno,
  coordenada,
  crearMaqueta,
  crearNumerador,
  cuenta,
  describir,
  epigrafe,
  esNumero,
  esObjeto,
  estamparPies,
  exigirEncabezado,
  exigirPlano,
  grados,
  lista,
  m2,
  m2Entero,
  metros,
  plural,
  porcentaje,
  portada,
  punto,
  rotuloRecinto,
  seccionFirma,
  seccionPlano,
  subepigrafe,
  textoONulo,
} from './maqueta.js'

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
/**
 * ⭐ EL ALCANCE DEL EXPEDIENTE (F17 · 8A y T12), y por qué va la SEGUNDA.
 *
 * Este informe describe **una** parcela: una geometría, una tabla de vértices, un
 * literal de lindero. Cuando el expediente lleva varias —lo que F17 hace posible—,
 * un papel que no lo dijera se leería como si abarcara el envío entero. Y con el
 * «Tipo de operación» impreso encima, diría «Segregación» enseñando una sola finca.
 *
 * Va justo después de «Identificación» y no al final por un motivo de lectura: el
 * alcance condiciona TODO lo que viene detrás. Puesto en la última página llegaría
 * cuando el lector ya ha interpretado las cifras.
 *
 * ⛔ **El tipo de operación se imprime como lo que es: declarativo.** No lo
 * comprueba la Sede —cuando se elige, ya ha validado—, no viaja dentro del `.gml` y
 * hasta hoy este informe no lo nombraba. Es la única pieza del expediente con
 * redundancia cero, así que lleva las tres marcas de F09 dentro de la frase que el
 * lector copia, y no en una nota al pie que se quede atrás al recortar.
 *
 * @returns {string[]} Incidencias para el bloque final. Vacío si no hay nada raro.
 */
function seccionExpediente(maqueta, num, { expediente }) {
  epigrafe(maqueta, num, 'Alcance de este informe')

  const miembros = lista(expediente?.miembros)
  const tipo = textoONulo(expediente?.tipoOperacion)
  const propuesto = expediente?.propuesto !== false
  const incidencias = []

  maqueta.campo(
    'Tipo de operación',
    tipo === null ? 'SIN DECLARAR' : (ROTULO_OPERACION[tipo] ?? tipo),
    { grisValor: GRIS.TEXTO },
  )
  maqueta.campo(
    'Quién lo declara',
    propuesto
      ? 'Lo propone la aplicación a partir de la forma del fichero; no se ha cambiado.'
      : 'Lo ha elegido quien presenta el expediente.',
  )
  const porQue = textoONulo(expediente?.porQue)
  if (porQue !== null) {
    maqueta.parrafo(porQue, { tam: TAM.MENOR, gris: GRIS.SECUNDARIO, sangria: ANCHO_ROTULO })
  }

  maqueta.hueco(AIRE.PARRAFO)
  maqueta.recuadro([AVISO_DECLARATIVO])

  if (tipo === null) {
    incidencias.push(
      'El expediente se ha compuesto sin declarar el tipo de operación: la Sede lo exige en un ' +
        'desplegable antes de emitir, y este informe no puede decir cuál se eligió.',
    )
  }

  // ── Las parcelas del expediente ────────────────────────────────────────────
  // El patrón del `<-- ELEGIDA` de `report/contraste-texto.js`, trasladado al papel
  // firmable: se listan TODAS y se marca la que este informe describe. Sin la
  // marca, la lista sería peor que no ponerla — parecería que el informe las cubre.
  maqueta.hueco(AIRE.ANTES_APARTADO)
  maqueta.renglon('Parcelas que lleva el expediente', { tam: TAM.APARTADO, fuente: 'negrita' })
  maqueta.hueco(AIRE.DESPUES_APARTADO)

  if (miembros.length === 0) {
    maqueta.parrafo(
      'No se ha indicado qué parcelas lleva el expediente, así que este informe no puede ' +
        'declarar su alcance. Léalo como lo que es: la descripción de una sola parcela.',
    )
    incidencias.push('El informe no ha recibido la relación de parcelas del expediente.')
    return incidencias
  }

  maqueta.tabla(
    ['Nº', 'Identificador', 'Espacio de nombres', 'Superficie', 'En este informe'],
    miembros.map((m, i) => [
      String(i + 1),
      textoONulo(m?.localId) ?? textoONulo(m?.etiqueta) ?? NO_CONSTA,
      textoONulo(m?.namespace) ?? NO_CONSTA,
      esNumero(m?.areaValue) ? `${cuenta(m.areaValue)} m²` : NO_CONSTA,
      m?.descrita === true ? 'SÍ — es la que se describe' : 'no',
    ]),
    { anchos: [10, 52, 34, 26, 58], izquierda: [1, 2, 4], sangria: 0 },
  )

  const descritas = miembros.filter((m) => m?.descrita === true).length
  maqueta.hueco(AIRE.PARRAFO)
  maqueta.parrafo(
    miembros.length === 1
      ? 'El expediente lleva una sola parcela y es la que describe este informe.'
      : `El expediente lleva ${cuenta(miembros.length)} parcelas y este informe describe UNA de ` +
        'ellas: la marcada arriba. Las demás forman parte del mismo envío y no están medidas en ' +
        'estas páginas.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO },
  )

  // Ni cero ni dos: la marca existe para señalar a UNA, y si no lo hace, el papel
  // dice algo que no es. Se declara como incidencia en vez de corregirse sola.
  if (descritas !== 1) {
    incidencias.push(
      `La relación de parcelas del expediente marca ${cuenta(descritas)} como descrita en este ` +
        'informe, y tiene que marcar exactamente una.',
    )
  }
  return incidencias
}

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
  // Se ELIGE una, nunca se unen. Las demás se listan porque quedan en el fichero y
  // quien firma tiene derecho a saber que están ahí y que no entran en este informe.
  //
  // ⚠️ El motivo ya NO es «multiparcela está fuera de alcance (SPEC §1)»: caducó el
  // 2026-08-03 con el override O18. Es que **este informe describe UNA parcela**, y
  // en un papel que se firma esa lista con su columna «En este informe» es lo único
  // que impide leerlo como si abarcara el fichero entero.
  //
  // ⭐ Y ojo al alcance de lo que ya existe: esta tabla la pinta HOY el camino de
  // COMPROBACIÓN (un GML ajeno con varios miembros). El informe del camino propio
  // —el que F17 va a emitir con N parcelas derivadas— todavía no la tiene.
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
 * @param {Object|null} [entrada.expediente=null]  ⭐ F17 · el ALCANCE:
 *   `{tipoOperacion, propuesto, porQue, miembros: [{localId, namespace, areaValue,
 *   descrita}]}`. El `tipoOperacion` es una clave de
 *   `derivacion/operacion.js#TIPO_OPERACION`, o `null` si no se ha declarado.
 *   ⚠️ **`expediente: null` NO imprime la sección**, y es deliberado: un informe sin
 *   ella dice lo mismo que decían todos los de F09 —describe una parcela—, mientras
 *   que imprimir «Subsanación» por defecto declararía un acto jurídico que nadie ha
 *   elegido. Ver {@link seccionExpediente}.
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
    expediente = null,
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
  exigirEncabezado(encabezado, 'informePdfParcela')
  exigirPlano(plano, encuadre, 'informePdfParcela')

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

  portada(maqueta, { nombre: NOMBRE_INFORME, avisos: [AVISO_NO_OFICIAL, AVISO_REGLA_9] })
  seccionEncabezado(maqueta, num, { encabezado, procedencia, parcela, comprobacion })
  // ⚠️ `null` = el llamante no ha dicho nada del expediente, y entonces la sección
  // NO se imprime. Es deliberado y tiene su límite escrito: un informe sin ella se
  // lee exactamente como se leían todos los de F09 —la descripción de una parcela—,
  // que es la verdad mientras nadie declare otra cosa. Imprimir «Subsanación» por
  // defecto sería declarar un acto jurídico que nadie ha elegido, y eso es
  // justamente lo que el override O20 prohíbe.
  const incidenciasExpediente =
    expediente === null ? [] : seccionExpediente(maqueta, num, { expediente })
  seccionPlano(maqueta, num, { plano, encuadre, srs, quien: 'informePdfParcela' })
  seccionVertices(maqueta, num, { parcela, comprobacion, diagnostico, srs })
  seccionDiagnostico(maqueta, num, { diagnostico })
  seccionLindero(maqueta, num, { literal })
  if (comprobacion !== null) seccionFichero(maqueta, num, { comprobacion })
  seccionFirma(maqueta, num, { firma })

  // ── Lo que hubo que declarar ───────────────────────────────────────────────
  incidencias.push(...incidenciasExpediente)
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
  // ⭐ El MISMO objeto `pie` va a la nota de composición y a los pies (R3): la
  // nota se imprime ANTES de estampar los pies —que necesitan el total de
  // páginas— y pre-escanea sus textos para que una sustitución ocurrida en el
  // pie quede enumerada en el papel. Ver report/maqueta.js#bloqueSustituciones.
  const pie = {
    nombre: NOMBRE_INFORME,
    idDocumento,
    atribucion: textoONulo(plano?.atribucion) ?? '',
  }
  incidencias.push(...bloqueSustituciones(maqueta, doc, pie))

  const nPaginas = estamparPies(doc, pie)

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
