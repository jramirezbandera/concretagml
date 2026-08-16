// derivacion/entrega.js — F17 · tarea 3.1 · EL EXPEDIENTE ENTERO: qué se entrega,
// si vale, y qué acto jurídico dice ser.
//
// Es el orquestador de la fase. No mide nada por su cuenta: encadena lo que ya
// existe y **se para en cuanto algo no cuadra**, que es todo su trabajo.
//
//     derivar  → `derivacion/cesion.js`      (el sobrante, medido y ordenado)
//     validar  → `validation/parcela.js`     CADA pieza, entera
//     cerrar   → `comprobacion/conjunto.js`  las tres afirmaciones
//     nombrar  → `derivacion/identidad.js`   la pareja localId ↔ namespace
//     declarar → `derivacion/operacion.js`   el «Tipo de operación» propuesto
//     escribir → `gml/serialize-cp.js`       UN fichero con N gml:featureMember
//
// Módulo PURO: sin DOM, sin Leaflet, sin red, sin estado y sin reloj.
//
// ── ⚠️ NO DESCARGA, Y ES DELIBERADO (desviación del plan, escrita) ──────────
// El plan de F17 decía «→ un solo fichero por `descargarTexto`». Aquí no se llama:
// `gml/descargar.js` necesita `Blob`, `URL.createObjectURL` y un `<a download>`, y
// meterlo en esta capa la sacaría del barrel raíz —que carga el proyecto Vitest
// `node`, sin DOM— y rompería la suite entera en el import. Es exactamente la misma
// asimetría que `report/`: **el impuro es el CONSUMIDOR del puro**, no al revés.
// Por lo mismo esta función tampoco compone el NOMBRE del fichero: quien lo hace es
// `gml/descargar.js#nombreFicheroGml`, y para llamarlo basta con `refcat` y
// `nMiembros`, que salen aquí.
//
// El motivo por el que existía el ZIP —el navegador **bloquea la segunda descarga
// automática y eso NO se puede detectar desde JavaScript**, sin callback y sin
// excepción— queda satisfecho igual, y por diseño: una sola descarga no tiene
// segunda que bloquear.
//
// ── ⛔ CADA PIEZA PASA LA VALIDACIÓN ENTERA, NO UNA VERSIÓN LIGERA ───────────
// La tentación es validar solo la parcela propia «porque las cesiones las ha
// calculado el programa». Justo al revés: una pieza del sobrante es geometría que
// NADIE ha mirado —sale de un motor booleano sobre dos contornos del usuario— y
// puede traer vértices duplicados por el redondeo, o un anillo de tres puntos
// casi colineales. Si eso llega al fichero, lo caza la Sede y no aquí.
//
// ── ⛔ UNA PIEZA EXCLUIDA SE DICE SIEMPRE ───────────────────────────────────
// El usuario puede dejar fuera un trozo del sobrante, y es legítimo: quizá ese
// trozo no se cede. Lo que no es legítimo es que el expediente salga sin decirlo.
// Cada exclusión emite su detección con la superficie que se queda fuera, y si lo
// excluido rompe el cierre, `comprobarConjunto` lo dice con las tres afirmaciones y
// **la entrega se bloquea**. Un expediente que no cierra vuelve con IVG negativo:
// dejarlo salir «porque el usuario lo ha pedido» sería el error silencioso más caro
// de la aplicación.
//
// ── ⛔ UN COLINDANTE SIN REFERENCIA CATASTRAL NO ENTRA, Y SE DICE ───────────
// `Vecina.refcat` es `string|null` por contrato y `app/colindantes.js` produce el
// `null` A PROPÓSITO cuando el WFS no trae la referencia. Hasta el 2026-08-16 ese
// estado legítimo hacía LANZAR a esta función —`identidadDeParcela` recibía el
// mismo campo como referencia y como respaldo— y la pantalla enseñaba el contrato
// interno («identidadDeParcela: hace falta refcat o idLocal…»). Ahora ese vecino se
// queda fuera del fichero y de la diana del cierre, y la entrega se bloquea con una
// detección `PIEZA_INVALIDA` que dice la superficie, el porqué y qué hacer. El
// razonamiento completo —y por qué la identidad NO se puede derivar de otra cosa—
// está donde se implementa, en el paso 1.
//
// ── EL NOMBRE QUE EL USUARIO LE PONE A UNA PIEZA **NO** VA AL `.gml` ────────
// ⚠️ Otra desviación del plan, y ésta importa. El plan mandaba que «el nombre
// escrito llegue al `localId` del fichero». No puede: el `localId` de una cesión
// está MEDIDO (override O19, IVG positivo del 2026-08-03) y es la referencia del
// padre con el ordinal detrás —`7136910UF1473N.1`—. Meter ahí un texto libre
// cambiaría el único identificador de finca que este proyecto ha visto aceptar. Y
// `cp:label` tampoco vale: significa el número de orden de la parcela dentro del
// polígono, no un apodo.
//
// Así que el nombre viaja al INFORME y a la pantalla, que es donde le sirve a una
// persona, y el fichero lleva el identificador que la Sede reconoce. Queda anotado
// en la ficha de F17 para que el guion 16 no busque en el `.gml` algo que por
// decisión no está ahí.

import { validarParcela } from '../validation/parcela.js'
import { comprobarConjunto } from '../comprobacion/conjunto.js'
import { serializarExpedienteCp } from '../gml/serialize-cp.js'

import {
  SEVERIDAD,
  TIPO_DERIVACION,
  crearDeteccionDerivacion,
  describir,
  exigirOpciones,
  exigirRecintos,
  numero,
  resumirDetecciones,
} from './_comun.js'
import { derivarCesion } from './cesion.js'
import { identidadDeCesion, identidadDeParcela } from './identidad.js'
import { tipoDeOperacion } from './operacion.js'

/** @typedef {import('./_comun.js').DeteccionDerivacion} DeteccionDerivacion */
/** @typedef {import('./identidad.js').IdentidadInspire} IdentidadInspire */
/** @typedef {{vertices: Array<[number,number]>, tipo: 'EXTERIOR'|'HUECO'}} Recinto */

/**
 * Un miembro del expediente, ya nombrado y ya validado.
 *
 * @typedef {Object} MiembroEntrega
 * @property {number} orden  `0` la parcela propia; `1…N` las cesiones, en el orden
 *   determinista de `derivacion/cesion.js`.
 * @property {boolean} esCesion
 * @property {string} etiqueta  Cómo se llama en los mensajes y en el informe: el
 *   nombre que le haya puesto el usuario, o su `localId`.
 * @property {string|null} nombre  Lo que escribió el usuario, o `null`. **No va al
 *   `.gml`** (ver la cabecera).
 * @property {IdentidadInspire} identidad
 * @property {Recinto[]} recintos
 * @property {{errores: object[], avisos: object[], puedeGenerar: boolean}} validacion
 */

/**
 * Lo que devuelve {@link prepararEntrega}.
 *
 * @typedef {Object} Entrega
 * @property {boolean} puedeEntregarse  `false` en cuanto hay una detección ERROR.
 *   **Es lo que hay que mirar antes de descargar**, no `xml !== null`.
 * @property {string[]} bloqueos  Tipos de las detecciones ERROR, sin repetir.
 * @property {string|null} xml  El documento con N `gml:featureMember`, o `null` si
 *   algo bloquea.
 * @property {number} nMiembros  Para `gml/descargar.js#nombreFicheroGml`.
 * @property {string|null} refcat  La de la finca de partida, para lo mismo.
 * @property {MiembroEntrega[]} miembros
 * @property {import('./operacion.js').OperacionPropuesta} operacion
 * @property {import('../comprobacion/conjunto.js').ComprobacionConjunto|null} cierre
 * @property {import('./cesion.js').Cesion} cesion  La FOTO de la que sale todo.
 * @property {object|null} resumenGml  El `resumen` de `serializarExpedienteCp`.
 * @property {DeteccionDerivacion[]} detecciones
 * @property {{total: number, porTipo: Object<string,number>,
 *   porSeveridad: Object<string,number>}} resumen
 */

/** Texto de usuario recortado, o `null` si no queda nada. */
const textoONulo = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/**
 * Arma el expediente completo a partir de una parcela editada: deriva el sobrante,
 * valida cada pieza, comprueba que el conjunto CIERRE, propone el tipo de operación
 * y escribe **un** `.gml` con N `gml:featureMember`.
 *
 * ⛔ **Mirar `xml !== null` no basta.** El campo que dice si esto se puede
 * presentar es `puedeEntregarse`: el documento puede salir escrito y el conjunto no
 * cerrar, que es precisamente el caso que el IVG devuelve negativo.
 *
 * @param {object} entrada
 * @param {object} entrada.parcela  La `Parcela` del modelo: se leen `recintos`,
 *   `geometriaOficial`, `refcat` e `idLocal`. No se muta.
 * @param {string} entrada.srs  Forma corta (`'EPSG:25830'`…). Va a la validación de
 *   huso de cada pieza y al serializador.
 * @param {import('./cesion.js').Cesion|null} [entrada.cesion=null]  La FOTO del
 *   sobrante. Se pasa cuando la pantalla ya la tiene —para no derivar dos veces y,
 *   sobre todo, para que lo que se entrega sea EXACTAMENTE lo que el usuario ha
 *   revisado—. `null` = se deriva aquí.
 * @param {number[]|null} [entrada.incluidas=null]  Los `orden` de las piezas que
 *   entran. `null` = **todas**, que es el único defecto honesto: dejar fuera algo
 *   por omisión sería decidir por el usuario.
 * @param {Object<number,string>|null} [entrada.nombres=null]  `{orden: 'texto'}`.
 *   Va al informe y a la pantalla, **nunca al `.gml`** (ver la cabecera).
 * @param {string|string[]|null} [entrada.comentario=null]  Comentario del prólogo.
 * @param {number} [entrada.umbralGrosorM]  Solo se usa si hay que derivar.
 * @returns {Entrega}
 * @throws {TypeError}  Si el contrato del llamante está roto: `entrada` no es un
 *   objeto, `parcela` no lo es, `srs` no es texto, `incluidas` trae un `orden` que
 *   no existe en la cesión (eso es un bug de la pantalla, no una elección).
 */
export function prepararEntrega(entrada) {
  exigirOpciones(entrada, 'prepararEntrega', 'un objeto {parcela, srs, …}')

  const {
    parcela,
    srs,
    cesion: cesionDada = null,
    recorte = null,
    incluidas = null,
    nombres = null,
    comentario = null,
    umbralGrosorM,
  } = entrada

  exigirOpciones(parcela, 'prepararEntrega', 'una Parcela del modelo en `parcela`')
  exigirRecintos(parcela.recintos, 'prepararEntrega', 'parcela.recintos')
  if (typeof srs !== 'string' || srs.trim() === '') {
    throw new TypeError(
      `prepararEntrega: 'srs' debe ser la forma corta del SRS (p. ej. 'EPSG:25830'); recibido ` +
        `${describir(srs)}. La validación de huso y el serializador lo necesitan, y adivinarlo ` +
        'sería emitir coordenadas bajo un sistema que nadie ha declarado.',
    )
  }

  /** @type {DeteccionDerivacion[]} */
  const detecciones = []

  // ── 1 · La FOTO del sobrante ──────────────────────────────────────────────
  const cesion =
    cesionDada ??
    derivarCesion({
      recintos: parcela.recintos,
      geometriaOficial: parcela.geometriaOficial ?? null,
      ...(umbralGrosorM === undefined ? {} : { umbralGrosorM }),
    })
  detecciones.push(...cesion.detecciones)

  // ── ⛔ EL COLINDANTE QUE NO SE PUEDE NOMBRAR (auditoría del 2026-08-16) ────
  //
  // `Vecina.refcat` es `string|null` por CONTRATO de la capa, y el `null` no es un
  // descuido: `app/colindantes.js` lo produce a propósito cuando el WFS no devuelve
  // la referencia («no se inventa nada»). O sea que es un estado legítimo y
  // alcanzable — y hasta hoy **tumbaba esta función**: la identidad del primer trozo
  // se componía con `identidadDeParcela({refcat: v.refcat, idLocal: v.refcat})`, los
  // dos argumentos del MISMO campo, así que sin referencia no había respaldo posible
  // y `derivacion/identidad.js` lanzaba. La pantalla enseñaba el `TypeError` tal
  // cual —«identidadDeParcela: hace falta refcat o idLocal…»—, que es un contrato
  // interno y no le dice al técnico ni qué pasa ni qué hacer, y ese expediente no
  // podía salir NUNCA.
  //
  // ⛔ **La identidad no se puede derivar de otra cosa, y se buscó.** El `<localId>`
  // del `inspireId` no admite vacío (el XSD lo rechaza, y además es la base de los
  // cuatro `gml:id`); el `label` del parcelario es el número de orden de la parcela
  // dentro del polígono —se repite y no identifica una finca—; y el `idLocal` es del
  // modelo de ESTA aplicación, así que estamparlo en la finca de otro titular sería
  // decir «se llama así» de un identificador recién inventado aquí. Nombrar mal la
  // finca de un tercero en un documento que se firma es peor que no entregarlo.
  //
  // Así que el vecino **se queda fuera y se DICE**: sus trozos no entran como
  // miembros, su contorno oficial no entra en la diana del cierre, y la entrega se
  // bloquea con una detección que se lee. No es un bloqueo nuevo escondido: es
  // exactamente lo que ya impedía entregar, contado con palabras del usuario.
  //
  // ⚠️ **Reutiliza `PIEZA_INVALIDA` en vez de estrenar `VECINO_SIN_REFERENCIA`.** Su
  // definición —«una pieza incluida NO puede ir al fichero»— es literalmente lo que
  // pasa, y la frase que `app/cableado-derivacion.js` ya le tiene puesta a ese tipo
  // («una de las parcelas del expediente no se puede escribir en el fichero») es la
  // correcta aquí. Un tipo propio habría que darlo de alta en `derivacion/_comun.js`
  // y darle su frase en aquel mapa, dos ficheros que este cambio no toca.
  const vecinosDelRecorte = recorte === null ? [] : recorte.vecinos
  const sinReferencia = vecinosDelRecorte.filter((v) => textoONulo(v.refcat) === null)
  const nombrables = vecinosDelRecorte.filter((v) => textoONulo(v.refcat) !== null)

  if (sinReferencia.length > 0) {
    const perdida = sinReferencia.reduce((s, v) => s + (Number.isFinite(v.pierde) ? v.pierde : 0), 0)
    const una = sinReferencia.length === 1
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.PIEZA_INVALIDA,
        `La geometría medida le quita ${numero(perdida, 4)} m² a ` +
          `${una ? 'una parcela colindante' : `${sinReferencia.length} parcelas colindantes`} de ` +
          `${una ? 'la que' : 'las que'} el Catastro no ha devuelto la referencia catastral. Sin ` +
          `ella no se ${una ? 'la' : 'las'} puede nombrar en el fichero —el «localId» del ` +
          'inspireId no admite quedarse vacío y esta aplicación no se inventa el identificador de ' +
          `la finca de otro titular—, así que no ${una ? 'entra' : 'entran'} en el expediente y el ` +
          'expediente no sale: presentarlo así dejaría un solape con parcela inscrita y el informe ' +
          'de validación volvería negativo. Vuelve a traer las colindantes del Catastro; si la ' +
          'referencia sigue sin llegar, esa finca no se puede modificar desde aquí.',
        SEVERIDAD.ERROR,
        { sinReferencia: sinReferencia.length, area: perdida },
      ),
    )
  }

  // ── ⛔ LA PUERTA `CRECE_FUERA`, Y CUÁNDO DEJA DE SER UNA PUERTA ───────────
  //
  // `derivacion/cesion.js` marca `CRECE_FUERA` como ERROR, y hace bien: mirando SOLO
  // la parcela propia, que se salga del contorno oficial significa que hay vecinos
  // afectados que no están en el fichero, y eso es un expediente incompleto emitido
  // con total confianza.
  //
  // Pero `recortarVecinos` puede haber contestado justo esa pregunta. Con las
  // colindantes consultadas, cada metro que la medición se sale está o bien
  // atribuido a un vecino —que entra recortado unas líneas más abajo— o bien
  // declarado en `sobreNadie` (vial, dominio público, hueco del parcelario), que el
  // autor decidió el 2026-08-10 que es un caso legítimo: un vial mal
  // georreferenciado se pisa para colocar bien la finca.
  //
  // ⚠️ **La condición es `consultado`, no `vecinos.length > 0`.** Con las vecinas
  // traídas y CERO afectadas, el exceso entero es `sobreNadie` y sigue estando
  // explicado. Sin traerlas no se sabe nada y la puerta se queda cerrada — que es la
  // diferencia entre «no le quito a nadie» y «no he mirado».
  //
  // ⚠️ **Y un vecino SIN REFERENCIA la vuelve a cerrar**, porque rompe la premisa:
  // «atribuido a un vecino que entra recortado unas líneas más abajo» deja de ser
  // cierto en cuanto uno de ellos no puede entrar. Ese exceso vuelve a ser
  // superficie que se le quita a alguien que el fichero no declara.
  const recorteResuelve =
    recorte !== null && recorte.consultado === true && sinReferencia.length === 0

  /**
   * ⛔ **Qué cuenta como BLOQUEO, en UN solo sitio.**
   *
   * Una detección ERROR bloquea, salvo `CRECE_FUERA` cuando el recorte lo ha
   * explicado. La detección NO se borra —sigue en la lista y el usuario tiene
   * derecho a leer que su medición se sale— pero deja de impedir la entrega, porque
   * el fichero que se va a escribir SÍ incluye a quien pierde ese terreno.
   *
   * ⚠️ Está escrito UNA vez porque la primera versión lo repartió en tres, y el
   * tercero se olvidó: la puerta se abría, los cuatro miembros se componían… y el
   * `if` previo al cierre seguía mirando `severidad === ERROR` en crudo, así que
   * devolvía antes de comprobar nada y `xml` salía `null` con `puedeEntregarse:
   * true`. Un expediente que se declara entregable y no trae fichero es peor que uno
   * bloqueado. Cazado midiendo sobre el expediente real, no razonando.
   */
  const esBloqueo = (d) =>
    d.severidad === SEVERIDAD.ERROR &&
    !(recorteResuelve && d.tipo === TIPO_DERIVACION.CRECE_FUERA)

  const cerrar = (extra) => {
    const bloqueos = [...new Set(detecciones.filter(esBloqueo).map((d) => d.tipo))]
    return {
      puedeEntregarse: bloqueos.length === 0,
      bloqueos,
      xml: null,
      nMiembros: 0,
      refcat: textoONulo(parcela.refcat),
      miembros: [],
      operacion: null,
      cierre: null,
      cesion,
      resumenGml: null,
      detecciones,
      resumen: resumirDetecciones(detecciones),
      ...extra,
    }
  }

  // ── ⛔ LA PUERTA `CRECE_FUERA`, Y CUÁNDO DEJA DE SER UNA PUERTA ───────────
  //
  // `derivacion/cesion.js` marca `CRECE_FUERA` como ERROR, y hace bien: mirando
  // SOLO la parcela propia, que se salga del contorno oficial significa que hay
  // vecinos afectados que no están en el fichero, y eso es un expediente incompleto
  // emitido con total confianza.
  //
  // Pero `recortarVecinos` puede haber contestado justo esa pregunta. Si se han
  // consultado las colindantes, cada metro que la medición se sale está o bien
  // atribuido a un vecino —que entra en el expediente recortado, unas líneas más
  // abajo— o bien declarado en `sobreNadie` (vial, dominio público, hueco del
  // parcelario), que el autor decidió el 2026-08-10 que es un caso legítimo: un vial
  // mal georreferenciado se pisa para colocar bien la finca.
  //
  // ⚠️ **La condición es `consultado`, no `vecinos.length > 0`.** Con las vecinas
  // traídas y CERO afectadas, el exceso entero es `sobreNadie` y sigue estando
  // explicado. Sin traerlas, no se sabe nada y la puerta se queda cerrada — que es
  // la diferencia entre «no le quito a nadie» y «no he mirado».
  // Si la derivación no se pudo hacer, todo lo de abajo mentiría: el cierre se
  // mediría contra un sobrante que no existe y el tipo de operación se deduciría
  // de un fichero que no se va a escribir.
  if (cesion.detecciones.some(esBloqueo)) return cerrar({})

  // ── 2 · Qué piezas entran ─────────────────────────────────────────────────
  const porOrden = new Map(cesion.piezas.map((p) => [p.orden, p]))
  const pedidas = incluidas === null ? cesion.piezas.map((p) => p.orden) : [...new Set(incluidas)]
  const desconocidas = pedidas.filter((o) => !porOrden.has(o))
  if (desconocidas.length > 0) {
    throw new TypeError(
      `prepararEntrega: 'incluidas' pide las piezas ${desconocidas.join(', ')} y esta cesión ` +
        `solo tiene ${cesion.piezas.length}. Eso no es una elección del usuario: es que la ` +
        'pantalla está mirando una FOTO distinta de la que se va a entregar (decisión 3C: ' +
        'editar la parcela invalida el sobrante entero).',
    )
  }
  // ── ⛔ LO QUE NO SE PUEDE ESCRIBIR NO ENTRA, LO PIDA QUIEN LO PIDA ─────────
  // Una pieza con `emitible: false` deja de encerrar superficie al redondearla a los
  // 2 decimales del fichero (ver la cabecera de `cesion.js`), así que el serializador
  // se negaría a emitir **el documento entero**: `xml === null` y el expediente
  // completo caído por una astilla del enganche de linderos. Medido el 2026-08-10
  // sobre `6346726UF8664N`, con el conjunto CERRANDO.
  //
  // Se filtra aquí y no solo en la pantalla porque esta función es pública y la
  // llaman los tests y podría llamarla otro cable: la misma doctrina que le hace a
  // `app/cableado-derivacion.js` repetir la puerta dentro de `entregar()`.
  //
  // ⚠️ `=== false` y no `!p.emitible`: una `Cesion` armada a mano —un doble de
  // prueba, un POJO guardado por una versión anterior— no trae el campo, y tratar
  // `undefined` como «no emitible» vaciaría expedientes correctos en silencio.
  const noEmitibles = pedidas.filter((o) => porOrden.get(o).emitible === false)
  const entran = pedidas
    .filter((o) => porOrden.get(o).emitible !== false)
    .sort((a, b) => a - b)
    .map((o) => porOrden.get(o))

  // Solo si ALGUIEN la pidió expresamente. Con `incluidas === null` no la ha pedido
  // nadie y `cesion.js` ya emitió su `PIEZA_NO_EMITIBLE` al derivar —y esas
  // detecciones están en esta misma lista, unas líneas más arriba—, así que
  // repetirlo llenaría el panel de avisos con el mismo hecho dos veces.
  if (incluidas !== null) {
    for (const orden of noEmitibles) {
      const p = porOrden.get(orden)
      detecciones.push(
        crearDeteccionDerivacion(
          TIPO_DERIVACION.PIEZA_NO_EMITIBLE,
          `La pieza nº ${p.orden} (${numero(p.area, 4)} m²) se ha pedido para el expediente, pero ` +
            'no entra: escrita con los 2 decimales del fichero deja de ser un recinto, así que no ' +
            'puede declararse como parcela. El resto del expediente sale igual.',
          SEVERIDAD.AVISO,
          { orden: p.orden, area: p.area, grosor: p.grosor },
        ),
      )
    }
  }

  for (const p of cesion.piezas) {
    // Las no emitibles ya han dicho lo suyo: llamarlas «excluidas» diría que el
    // usuario las dejó fuera, y no las dejó fuera nadie — no cabían.
    if (pedidas.includes(p.orden) || p.emitible === false) continue
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.PIEZA_EXCLUIDA,
        `La pieza nº ${p.orden} (${numero(p.area, 4)} m²) se queda FUERA del expediente. Si esa ` +
          'superficie sigue siendo de la finca, el conjunto no cubrirá el contorno oficial y el ' +
          'informe de validación volverá negativo.',
        SEVERIDAD.AVISO,
        { orden: p.orden, area: p.area, grosor: p.grosor },
      ),
    )
  }

  // ── 3 · Identidad y validación, miembro a miembro ─────────────────────────
  const refcat = textoONulo(parcela.refcat)
  const idLocal = textoONulo(parcela.idLocal)
  const nombreDe = (orden) => (nombres === null ? null : textoONulo(nombres[orden]))

  // ── Los VECINOS RECORTADOS (F23) ──────────────────────────────────────────
  // Cada trozo en que queda un colindante es un miembro más del fichero. La regla
  // de identidad la fijó el autor el 2026-08-10 y cae sobre terreno YA MEDIDO:
  //
  //   · el trozo MAYOR conserva la referencia catastral real → `ES.SDGC.CP`
  //   · los demás llevan el sufijo del padre (`…145.1`)      → `ES.LOCAL.CP`
  //
  // Lo segundo es exactamente el patrón del override O19, presentado y aceptado con
  // IVG positivo (CSV XMWPXCN9J8DB9J89). Aquí no se inventa nada: se reutilizan las
  // dos funciones de `derivacion/identidad.js` que ya existían para la matriz y para
  // sus cesiones, porque la pregunta es la misma.
  //
  // ⚠️ El sufijo NO colisiona con el de las cesiones propias aunque los dos empiecen
  // en 1: los PADRES son distintos (`…144.1` es una cesión mía y `…145.1` un trozo
  // del vecino), y el `gml:id` se compone sobre el localId entero.
  //
  // ⛔ **Solo los NOMBRABLES.** Los que no traen referencia catastral ya han dicho lo
  // suyo con severidad ERROR unas líneas más arriba y no llegan aquí: componerles una
  // identidad exigiría inventarla, que es justo lo que aquella detección explica que
  // no se hace.
  const deVecinos = nombrables.flatMap((v) =>
    v.trozos.map((t, i) => ({
      orden: 0,
      esCesion: false,
      esVecino: true,
      // ⛔ Sin nombre de usuario: la finca de otro titular no se bautiza. El campo
      // de nombre de la lista es para las piezas del sobrante propio.
      nombre: null,
      identidad:
        i === 0
          ? identidadDeParcela({ refcat: v.refcat, idLocal: v.refcat })
          : identidadDeCesion({ refcatPadre: v.refcat, idLocalPadre: v.refcat, orden: i }),
      recintos: t.recintos,
    })),
  )

  const miembros = [
    {
      orden: 0,
      esCesion: false,
      nombre: nombreDe(0),
      identidad: identidadDeParcela({ refcat, idLocal }),
      recintos: parcela.recintos,
    },
    ...entran.map((p) => ({
      orden: p.orden,
      esCesion: true,
      nombre: nombreDe(p.orden),
      identidad: identidadDeCesion({ refcatPadre: refcat, idLocalPadre: idLocal, orden: p.orden }),
      recintos: p.recintos,
    })),
    ...deVecinos,
  ].map((m) => {
    const validacion = validarParcela(m.recintos, { srs })
    return { ...m, validacion, etiqueta: m.nombre ?? m.identidad.refcat }
  })

  for (const m of miembros) {
    if (m.validacion.puedeGenerar) continue
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.PIEZA_INVALIDA,
        `«${m.etiqueta}» no pasa la validación geométrica: ` +
          `${m.validacion.errores.map((e) => e.mensaje).join(' ')} ` +
          (m.esCesion
            ? 'Es una pieza que ha calculado la aplicación, así que esto es un problema de la ' +
              'geometría de partida: revisa el lindero que has movido.'
            : 'Corrige la parcela antes de entregar.'),
        SEVERIDAD.ERROR,
        { orden: m.orden, esCesion: m.esCesion, errores: m.validacion.errores },
      ),
    )
  }

  const operacion = tipoDeOperacion(miembros.map((m) => m.identidad))

  const salida = { nMiembros: miembros.length, refcat, miembros, operacion, cesion }
  if (detecciones.some(esBloqueo)) return cerrar(salida)

  // ── 4 · ¿CIERRA el conjunto? ──────────────────────────────────────────────
  // Sobre las coordenadas YA REDONDEADAS, que es lo que juzga el IVG. Se hace
  // ANTES de escribir: un fichero escrito invita a subirlo.
  const cierre =
    parcela.geometriaOficial === null || parcela.geometriaOficial === undefined
      ? null
      : comprobarConjunto({
          geometriaOficial: parcela.geometriaOficial,
          // ⭐ LA DIANA CAMBIA (F23). Si el expediente recorta a un colindante, lo
          // que tiene que cubrir no es «mi contorno oficial» sino **todo lo oficial
          // que este expediente modifica**. Sin esta línea, un vecino recortado
          // saldría como 1.670 m² de superficie que sobra y la suma no cuadraría
          // jamás: el expediente correcto se bloquearía a sí mismo.
          //
          // ⚠️ Los NOMBRABLES, los mismos que están en `miembros`. Meter aquí el
          // contorno de un colindante que no ha podido entrar en el fichero pondría
          // en la diana una superficie que ningún miembro cubre, y el cierre saldría
          // culpando a la geometría de un hueco que en realidad es una identidad que
          // falta. (Hoy no se llega aquí con ninguno —su detección bloquea antes—,
          // pero las dos listas tienen que decir lo mismo o divergen.)
          oficialesExtra: nombrables.map((v) => ({
            etiqueta: v.refcat,
            recintos: v.recintosOficiales,
          })),
          // Y lo que se reclama FUERA de todo contorno oficial —el vial mal
          // georreferenciado— se declara aquí en vez de salir como discrepancia.
          // Está medido por `derivacion/vecino.js`, no estimado.
          residuoEsperadoM2: recorte === null ? 0 : recorte.sobreNadie,
          miembros: miembros.map((m) => ({ etiqueta: m.etiqueta, recintos: m.recintos })),
        })

  if (cierre !== null && cierre.cierra !== true) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.CONJUNTO_NO_CIERRA,
        cierre.cierra === null
          ? 'No se ha podido comprobar que las parcelas del expediente cubran el contorno ' +
            'oficial. Eso NO es que cierre: es que no se sabe, y presentarlo así sería firmarlo ' +
            'a ciegas.'
          : 'Las parcelas del expediente no cubren exactamente el contorno oficial: ' +
            cierre.detecciones
              .filter((d) => d.severidad === 'ERROR')
              .map((d) => d.mensaje)
              .join(' '),
        SEVERIDAD.ERROR,
        { cierra: cierre.cierra, suma: cierre.suma, cobertura: { area: cierre.cobertura.area } },
      ),
    )
    return cerrar({ ...salida, cierre })
  }

  // ── 5 · El fichero ────────────────────────────────────────────────────────
  const { xml, detecciones: detGml, resumen: resumenGml } = serializarExpedienteCp({
    parcelas: miembros.map((m) => ({ ...m.identidad, recintos: m.recintos, srs })),
    comentario,
  })
  // ⚠️ Las detecciones del serializador son de OTRO léxico (`gml/_comun.js`) y no
  // se mezclan con las de aquí: tienen sus propios tipos y la interfaz las pinta
  // igual pero las cuenta aparte. Lo que sí sube es el BLOQUEO, traducido.
  if (xml === null) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.PIEZA_INVALIDA,
        'El escritor de GML no ha podido emitir el fichero: ' +
          resumenGml.bloqueos.join(', ') +
          '. El detalle está en las detecciones del serializador.',
        SEVERIDAD.ERROR,
        { bloqueos: resumenGml.bloqueos },
      ),
    )
    return cerrar({ ...salida, cierre, resumenGml, deteccionesGml: detGml })
  }

  detecciones.push(
    crearDeteccionDerivacion(
      TIPO_DERIVACION.ENTREGA_LISTA,
      `El expediente sale con ${miembros.length} ` +
        `${miembros.length === 1 ? 'parcela' : 'parcelas'}: cada una pasa la validación ` +
        'geométrica' +
        (cierre === null
          ? '.'
          : ` y entre todas cubren los ${numero(cierre.suma.areaOficial)} m² del contorno ` +
            'oficial.'),
      SEVERIDAD.INFO,
      { nMiembros: miembros.length, tipoOperacion: operacion.tipo },
    ),
  )

  return cerrar({ ...salida, cierre, resumenGml, deteccionesGml: detGml, xml })
}
