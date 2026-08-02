// gml/_comun.js — F04 · Vocabulario COMPARTIDO del módulo gml/.
//
// Este módulo NO parsea ni serializa nada: fija el léxico que comparten
// `gml/xml.js`, `gml/parse.js` y `gml/serialize-cp.js` — namespaces, orden de
// elementos, dialectos reconocibles, tipos de detección y las dos traducciones
// que el resto del proyecto no sabe hacer (forma corta del `srs` ↔ `srsName` del
// GML, y `Date` → dateTime del Catastro). Es el análogo de `parsers/_comun.js`
// para la rama de generación de GML.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⚠️ LA CORRECCIÓN DEL 2026-07-27: HAY DOS SOBRES, Y NO SON INTERCAMBIABLES
// ═════════════════════════════════════════════════════════════════════════════
// F04 se construyó copiando `cp_parcela_9398516VK3799G.gml`, la DESCARGA del WFS
// del Catastro. La Sede rechazó el fichero resultante con «El archivo no cumple
// el esquema Inspire GML». El motivo, MEDIDO después contra los XSD oficiales
// (libxml2 resolviendo los imports de `inspire.ec.europa.eu`):
//
//   ┌───────────────────────────────────┬──────────────┬──────────────────────┐
//   │ fichero                           │ vs cp/4.0    │ vs cp/4.0 + wfs/2.0  │
//   ├───────────────────────────────────┼──────────────┼──────────────────────┤
//   │ cp_ejemplo_explicativo.gml        │   VÁLIDO     │  válido              │
//   │ cp_parcela_9398516VK3799G.gml     │   INVÁLIDO   │  válido              │
//   └───────────────────────────────────┴──────────────┴──────────────────────┘
//
// El error exacto del inválido: «Element '{http://www.opengis.net/wfs/2.0}
// FeatureCollection': No matching global declaration available for the
// validation root». El validador del IVG carga el esquema de PARCELA; la raíz
// `wfs:FeatureCollection` no está declarada ahí y el documento muere en la
// primera línea. No era un problema de contenido: el contenido estaba bien.
//
// La lección, escrita para que no se repita: **la descarga y la entrega son dos
// direcciones distintas del mismo formato**. El WFS responde envolviendo la
// parcela en su propio protocolo; el técnico que SUBE un fichero no está
// respondiendo a ninguna petición WFS y no debe traer ese envoltorio. De ahí
// {@link PERFIL}, que hace la diferencia explícita en vez de dejarla implícita
// en «de qué fichero copiamos».
//
// DE DÓNDE SALEN ESTAS CONSTANTES (regla de oro 8). De los ficheros reales de
// `test/fixtures/gml/`, no de la documentación ni de la memoria de nadie (ver
// `test/fixtures/gml/PROCEDENCIA.md`):
//   · `cp_ejemplo_explicativo.gml` — la PLANTILLA OFICIAL del Catastro, la que
//     sus propias instrucciones mandan usar para generar el fichero que se sube.
//     Es la fuente de verdad del SOBRE DE ENTREGA (perfil `ENTREGA`).
//   · `cp_parcela_9398516VK3799G.gml` — GML del WFS del Catastro, CP 4.0. Sigue
//     siendo la fuente de verdad de los NÚMEROS y del sobre de la DESCARGA
//     (perfil `WFS`), que es el que reproduce el round-trip.
//   · `UTM_1.gml` — CP 3.0 de otro generador. CONTRAEJEMPLO por partida doble:
//     dialecto viejo, y repite el `gml:id` entre raíz y parcela (`xs:ID` es
//     único: eso invalida el documento). Ver `PROCEDENCIA.md`.
//   · `bu_building_*.gml` / `bu_buildingpart_*.gml` — edificio (F13), otro
//     dialecto todavía, con `boundedBy`/`Envelope` que en 4.0 no emitimos.
// `test/gml/comun.test.js` ata cada constante de aquí a esos ficheros leyéndolos
// del disco: si el Catastro cambiara el fixture, el test cae y este módulo se
// corrige — nunca al revés.
//
// Overrides del dossier que VIVEN aquí (SPEC §3), con lo que la medición del
// 2026-07-27 corrigió de cada uno:
//   · O2 — `srsName`. El dossier decía «URI OGC, NUNCA la URN». **Falso como
//     regla general**: las dos formas son `xsd:anyURI` y las dos validan. Lo que
//     hay es una forma por perfil — URI en la descarga del WFS, **URN en la
//     entrega**, que es la que trae la plantilla oficial y la que emiten todos
//     los generadores que el Catastro acepta. Ver {@link PERFILES}.
//   · O3 — raíz. El dossier decía «WFS 2.0 + `member`, NUNCA
//     `gml:FeatureCollection`». **Exactamente al revés para la entrega**: la
//     plantilla oficial es `gml:FeatureCollection` + `gml:featureMember`, y la
//     raíz WFS es justo lo que provocó el rechazo. Cada perfil tiene la suya.
//   · O4 — `inspireId`. El dossier decía que el prefijo `base:` «produce rechazo
//     en 4.0». **Falso**: un prefijo no es información en XML, lo que cuenta es
//     la URI del namespace. La plantilla oficial usa `base:` sobre base **3.3** y
//     valida. Lo que sí importa es la VERSIÓN: base 3.2 es del CP 3.0.
//   · O5 — orden XSD de los hijos de `cp:CadastralParcel`: el validador lo exige.
//     Este sigue en pie tal cual.
//   · O13 — Canarias (huso 28 / EPSG:32628) DIFERIDA: gancho comentado abajo.
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 1 — NINGÚN error silencioso. Todo lo que este módulo o sus vecinos
//     decidan sobre un GML (dialecto rechazado, `srsName` en forma ajena, cierre
//     retirado, orientación normalizada) se materializa en una {@link DeteccionGml}.
//     El `throw` se reserva para el contrato roto por el PROGRAMADOR.
//   · Regla 3 — aquí no hay lat/lon: el `srsName` es una etiqueta de texto, no
//     una proyección. La aritmética de coordenadas vive en `geo/`.
//   · Sin dependencias: este módulo no importa nada. En particular NO importa
//     `model/parcela.js` (capa distinta) ni `gml/xml.js` (que es quien construye
//     el DOM); la duplicación de {@link SRS_SOPORTADOS} respecto de
//     `model/parcela.js#SRS_VALIDOS` es deliberada y la vigila un test-guarda,
//     misma fórmula que `geo/huso.js#HUSOS_VALIDOS`.
//
// EL RELOJ NO SE LEE AQUÍ. `dateTimeCatastro` recibe la fecha por parámetro y
// este módulo jamás instancia una fecha propia ni consulta la marca de tiempo
// del sistema: la reproducibilidad del test de ida y vuelta de F04 (snapshot de
// un GML entero) depende de que `gml/` sea una función pura de sus entradas. Hay
// un test que lo comprueba con un grep sobre el TEXTO de este fichero, así que
// esas dos llamadas no deben aparecer ni siquiera dentro de un comentario.

// ── Namespaces ────────────────────────────────────────────────────────────────

/**
 * Namespaces que este proyecto EMITE o RECONOCE en una parcela CP 4.0. La unión
 * de los declarados por los dos fixtures 4.0: la plantilla de entrega (`gml`,
 * `gmd`, `ogc`, `xlink`, `cp`, `xsi`, más `base` en el `inspireId`) y la descarga
 * del WFS (los mismos menos `ogc`, más `wfs` como `xmlns` por defecto).
 *
 * `gmd`, `ogc` y `xlink` van declarados aunque ningún elemento los use: se emiten
 * igual, por fidelidad a los ficheros reales (regla de oro 8 — el GML real manda,
 * también en lo que a nosotros nos parezca superfluo). Cuál se declara en cada
 * caso lo dice {@link PERFILES}, no esta tabla.
 *
 * Los namespaces de los dialectos que solo se LEEN (CP 3.0, edificio) no están
 * aquí: viven en {@link DIALECTOS}, porque son de reconocimiento, no de emisión.
 *
 * @readonly
 */
export const NS = Object.freeze({
  wfs: 'http://www.opengis.net/wfs/2.0',
  gml: 'http://www.opengis.net/gml/3.2',
  cp: 'http://inspire.ec.europa.eu/schemas/cp/4.0',
  base33: 'http://inspire.ec.europa.eu/schemas/base/3.3',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  xlink: 'http://www.w3.org/1999/xlink',
  gmd: 'http://www.isotc211.org/2005/gmd',
  ogc: 'http://www.opengis.net/ogc',
})

/**
 * `xsi:schemaLocation` de la ENTREGA: UN solo par `namespace espacio xsd`, el de
 * Cadastral Parcels 4.0. Copiado de la plantilla oficial.
 *
 * Que aquí NO aparezca el WFS es el corazón de la corrección del 2026-07-27: el
 * fichero que se sube no es una respuesta WFS y no debe declarar ese esquema. Ver
 * la cabecera del módulo.
 *
 * @readonly
 */
export const SCHEMA_LOCATION_ENTREGA =
  'http://inspire.ec.europa.eu/schemas/cp/4.0 ' +
  'http://inspire.ec.europa.eu/schemas/cp/4.0/CadastralParcels.xsd'

/**
 * `xsi:schemaLocation` de la DESCARGA del WFS: DOS pares, el del WFS 2.0 y el de
 * Cadastral Parcels 4.0, en ese orden. Copiado del fixture del WFS.
 *
 * @readonly
 */
export const SCHEMA_LOCATION_WFS =
  'http://www.opengis.net/wfs/2.0 http://schemas.opengis.net/wfs/2.0/wfs.xsd ' +
  'http://inspire.ec.europa.eu/schemas/cp/4.0 ' +
  'http://inspire.ec.europa.eu/schemas/cp/4.0/CadastralParcels.xsd'

// ── Formas del srsName ────────────────────────────────────────────────────────
// Se declaran AQUÍ ARRIBA, y no junto a sus patrones (que están al final del
// módulo), porque {@link PERFILES} y {@link DIALECTOS} las necesitan y en ESM un
// `const` no se puede leer antes de su línea: hacerlo sería un ReferenceError en
// tiempo de carga, no un aviso.

/**
 * Formas en las que un `srsName` puede venir escrito. Las tres primeras se han
 * visto en ficheros reales de este repo (URI en la descarga del WFS, URN en la
 * plantilla de entrega y en el 3.0 y el edificio, CORTA en el modelo interno);
 * `GML_SRS` es la forma heredada de GML 2/3.0 (`…/gml/srs/epsg.xml#25830`), que
 * se reconoce para poder nombrarla en el mensaje en vez de decir «desconocida».
 *
 * URI y URN son las DOS canónicas, cada una en su perfil: ninguna es «la mala».
 * Ver la corrección de O2 en la cabecera del módulo.
 *
 * @readonly
 */
export const FORMA_SRSNAME = Object.freeze({
  URI: 'URI',
  URN: 'URN',
  CORTA: 'CORTA',
  GML_SRS: 'GML_SRS',
  DESCONOCIDA: 'DESCONOCIDA',
})

/**
 * Prefijo de la URI OGC del `srsName` (`…/def/crs/EPSG/0/25830`). Leído de la
 * descarga del WFS, donde el valor completo aparece tres veces idénticas:
 * `MultiSurface`, `Surface` y el `gml:Point` del `referencePoint`.
 *
 * El `/0/` es la versión del registro de CRS de OGC, no un relleno: la forma con
 * otra versión sería una URI válida pero NO la que emite el Catastro.
 *
 * @readonly
 */
export const PREFIJO_SRSNAME_URI = 'http://www.opengis.net/def/crs/EPSG/0/'

/**
 * Prefijo de la URN OGC del `srsName` (`urn:ogc:def:crs:EPSG::25830`). Leído de
 * `cp_ejemplo_explicativo.gml`, la plantilla oficial de entrega, y confirmado en
 * `UTM_1.gml`, que es lo que genera una herramienta de terceros de uso real.
 *
 * Los DOS dos puntos seguidos no son una errata: el segmento intermedio es la
 * versión del registro EPSG y va VACÍO, que es la forma «sin versión fijada».
 *
 * @readonly
 */
export const PREFIJO_SRSNAME_URN = 'urn:ogc:def:crs:EPSG::'

// ── Perfiles de emisión: ENTREGA frente a DESCARGA ───────────────────────────

/**
 * Los dos sobres del mismo CP 4.0. Ver la cabecera del módulo: confundirlos es
 * lo que provocó el rechazo del IVG del 2026-07-27.
 *
 * @readonly
 */
export const PERFIL = Object.freeze({
  /** Lo que el técnico SUBE a la Sede. El que usa la app. */
  ENTREGA: 'ENTREGA',
  /** Lo que el WFS del Catastro DEVUELVE. Solo para reproducir su fichero. */
  WFS: 'WFS',
})

/**
 * Un perfil de emisión: todo lo que cambia entre la entrega y la descarga.
 *
 * @typedef {Object} PerfilEmision
 * @property {'ENTREGA'|'WFS'} id
 * @property {string} raiz      Nombre CUALIFICADO del elemento raíz tal como se
 *   escribe (`'gml:FeatureCollection'` / `'FeatureCollection'`).
 * @property {string} raizNs    URI del namespace de la raíz.
 * @property {string} miembro   Nombre cualificado del contenedor de cada feature.
 * @property {string} schemaLocation  Valor de `xsi:schemaLocation`.
 * @property {'URI'|'URN'} formaSrsName  Forma canónica del `srsName` aquí.
 * @property {boolean} raizLlevaGmlId  Si la raíz lleva `gml:id` propio. En la
 *   entrega SÍ (`gml:FeatureCollection` hereda de `gml:AbstractGML`, donde
 *   `gml:id` es obligatorio); en el WFS no (la raíz es de otro esquema).
 * @property {boolean} atributosWfs  Si se emiten `timeStamp`/`numberMatched`/
 *   `numberReturned`. Solo tienen sentido en una respuesta de servicio.
 * @property {boolean} emiteEndLifespan   Si se emite `cp:endLifespanVersion`.
 * @property {boolean} emiteReferencePoint  Si se emite `cp:referencePoint`.
 * @property {readonly string[]} prefijosRaiz  Prefijos de `NS` que se declaran en
 *   la raíz, en el orden en que los escribe el fichero real correspondiente.
 * @property {string} fixture  Fichero de `test/fixtures/gml/` del que sale este
 *   perfil. Lo lee el test para atar cada campo a su origen.
 */

/**
 * Los dos perfiles, cada uno derivado de SU fichero real.
 *
 * ¿Por qué `emiteEndLifespan` y `emiteReferencePoint` son `false` en la entrega,
 * si los dos VALIDAN contra el XSD (medido)? Porque la plantilla oficial no los
 * trae, y acabamos de aprender —caro— que añadir al fichero de subida cosas que
 * la plantilla no tiene es exactamente el riesgo que no hay motivo para correr.
 * El punto de referencia se sigue CALCULANDO y verificando: sale en `resumen`,
 * que es donde la UI lo necesita. Simplemente no se escribe.
 *
 * @readonly
 * @type {Readonly<Record<'ENTREGA'|'WFS', PerfilEmision>>}
 */
export const PERFILES = Object.freeze({
  [PERFIL.ENTREGA]: Object.freeze({
    id: PERFIL.ENTREGA,
    raiz: 'gml:FeatureCollection',
    raizNs: NS.gml,
    miembro: 'gml:featureMember',
    schemaLocation: SCHEMA_LOCATION_ENTREGA,
    formaSrsName: FORMA_SRSNAME.URN,
    raizLlevaGmlId: true,
    atributosWfs: false,
    emiteEndLifespan: false,
    emiteReferencePoint: false,
    prefijosRaiz: Object.freeze(['gml', 'gmd', 'ogc', 'xlink', 'cp', 'xsi']),
    fixture: 'cp_ejemplo_explicativo.gml',
  }),
  [PERFIL.WFS]: Object.freeze({
    id: PERFIL.WFS,
    raiz: 'FeatureCollection',
    raizNs: NS.wfs,
    miembro: 'member',
    schemaLocation: SCHEMA_LOCATION_WFS,
    formaSrsName: FORMA_SRSNAME.URI,
    raizLlevaGmlId: false,
    atributosWfs: true,
    emiteEndLifespan: true,
    emiteReferencePoint: true,
    prefijosRaiz: Object.freeze(['xsi', 'gml', 'xlink', 'cp', 'gmd']),
    fixture: 'cp_parcela_9398516VK3799G.gml',
  }),
})

/**
 * Resuelve un identificador de perfil a su {@link PerfilEmision}.
 *
 * @param {'ENTREGA'|'WFS'} id
 * @returns {PerfilEmision}
 * @throws {RangeError}  Si `id` no es un perfil conocido. No hay valor por
 *   defecto silencioso: elegir sobre equivocado es el fallo que este módulo
 *   existe para impedir.
 */
export function perfilPorId(id) {
  const perfil = Object.prototype.hasOwnProperty.call(PERFILES, id) ? PERFILES[id] : undefined
  if (perfil === undefined) {
    throw new RangeError(
      `perfilPorId: perfil ${JSON.stringify(id)} desconocido. ` +
        `Válidos: ${Object.keys(PERFILES).join(', ')}. ` +
        `${PERFIL.ENTREGA} es el fichero que se SUBE a la Sede; ${PERFIL.WFS} es el que ` +
        `DEVUELVE el servicio del Catastro, y no se puede subir.`,
    )
  }
  return perfil
}

// ── Orden XSD y elementos proscritos ─────────────────────────────────────────

/**
 * Override O5 — orden EXACTO de los hijos de `cp:CadastralParcel`. El validador
 * del IVG lo exige: la misma información en otro orden es un rechazo. Verificado
 * contra el fixture del WFS, cuyos ocho hijos aparecen justo en esta secuencia.
 *
 * No todos son obligatorios (el GML 3.0 de `UTM_1.gml` trae seis de los ocho),
 * pero los que se emitan van en este orden relativo.
 *
 * ⚠️ ESTO ES UN PREFIJO, NO LA SECUENCIA COMPLETA. Comprobado contra el XSD
 * oficial (`inspire.ec.europa.eu/schemas/cp/4.0/CadastralParcels.xsd`,
 * `CadastralParcelType`): la secuencia real tiene TRECE elementos — estos ocho
 * y, detrás, `validFrom`, `validTo`, `basicPropertyUnit`, `administrativeUnit` y
 * `zoning`, todos con `minOccurs="0"`. Este proyecto emite solo los ocho
 * primeros (los otros cinco están en {@link ELEMENTOS_PROSCRITOS_CP40} o
 * sencillamente no aplican a una parcela suelta), así que como ORDEN DE EMISIÓN
 * la lista es correcta y completa. Pero quien la use para VALIDAR un GML ajeno
 * (F08) no debe concluir que un fichero con `validFrom` está mal ordenado: está
 * fuera de nuestro alcance de emisión, que es otra cosa.
 *
 * Del mismo XSD, dos datos que fijan el contrato del serializador: `label`,
 * `nationalCadastralReference`, `geometry`, `inspireId` y `beginLifespanVersion`
 * NO llevan `minOccurs`, luego son OBLIGATORIOS; `areaValue`,
 * `endLifespanVersion` y `referencePoint` son `minOccurs="0"` (se emiten igual,
 * porque el fixture real los trae).
 *
 * @readonly
 * @type {readonly string[]}
 */
export const ORDEN_CADASTRAL_PARCEL = Object.freeze([
  'areaValue',
  'beginLifespanVersion',
  'endLifespanVersion',
  'geometry',
  'inspireId',
  'label',
  'nationalCadastralReference',
  'referencePoint',
])

/**
 * La ÚNICA lista escrita a mano de este módulo: los elementos que este proyecto
 * NO emite jamás en una parcela 4.0. No se pueden derivar de un fixture porque su
 * fuente de verdad es justo la ausencia — no están en el GML 4.0 del WFS. Por
 * eso cada entrada lleva su motivo escrito al lado, y el test comprueba las dos
 * mitades: que ninguno aparece en el fixture 4.0 y que `boundedBy`/`Envelope` SÍ
 * aparecen en el de edificio (para que la lista no sea vacua).
 *
 * ⚠️ CORRECCIÓN IMPORTANTE, comprobada contra el XSD oficial de INSPIRE
 * (`cp/4.0/CadastralParcels.xsd`, tipo `CadastralParcelType`): **el esquema los
 * ADMITE**. `validFrom`, `validTo` y `zoning` siguen estando en la secuencia de
 * `CadastralParcelType` con `minOccurs="0"`, y `boundedBy`/`Envelope` se heredan
 * de `gml:AbstractFeatureType`, que es la base del tipo. O sea: un GML con
 * cualquiera de ellos **valida contra el XSD sin protestar**.
 *
 * El motivo de proscribirlos NO es la validación de esquema, entonces, sino:
 *   (a) el WFS del Catastro no los emite en parcela 4.0 — y el fichero real
 *       manda (regla de oro 8); y
 *   (b) están en el checklist de rechazos del IVG (dossier §1.5), que es una
 *       regla de NEGOCIO del validador de la Sede, no del esquema.
 * La distinción no es académica: quien ejecute `npm run validar:xsd` sobre un
 * GML con `gml:boundedBy` lo verá pasar en verde, y si aquí pusiera «invalida
 * contra el XSD» concluiría que el guardián está roto. Está escrito para que no
 * llegue a esa conclusión. Es también la semilla exacta de F15 (diccionario de
 * errores), que necesita saber QUIÉN rechaza cada cosa.
 *
 * @readonly
 * @type {ReadonlyArray<{local: string, motivo: string}>}
 */
export const ELEMENTOS_PROSCRITOS_CP40 = Object.freeze([
  Object.freeze({
    local: 'boundedBy',
    motivo:
      'Heredado de `gml:AbstractFeatureType`, así que el XSD lo admite; pero el WFS ' +
      'del Catastro NO lo emite en parcela 4.0 (sí en el GML de edificio, que es 3.0) ' +
      'y está en el checklist de rechazos del IVG. Es envolvente redundante: se ' +
      'deduce del propio `posList`, y una que no cuadre es una contradicción interna.',
  }),
  Object.freeze({
    local: 'Envelope',
    motivo:
      'Contenido de `gml:boundedBy`: cae con él. Además obligaría a declarar un ' +
      '`srsName` más, con el riesgo de que discrepe del de la geometría — que es ' +
      'justo la incoherencia que `SRS_INCOHERENTE` persigue.',
  }),
  Object.freeze({
    local: 'validFrom',
    motivo:
      'SIGUE en la secuencia del XSD 4.0 con `minOccurs="0"` (no desapareció), pero ' +
      'es vigencia JURÍDICA de la parcela y este proyecto no la conoce: inventarla ' +
      'sería afirmar una fecha de efectos legales. La vida del OBJETO la llevan ' +
      '`beginLifespanVersion`/`endLifespanVersion`, que son otra cosa y sí se emiten.',
  }),
  Object.freeze({
    local: 'validTo',
    motivo:
      'Pareja de `validFrom`: mismo motivo. Además, emitirlo con valor significaría ' +
      'declarar que la parcela ha dejado de existir, que es lo contrario de un alta.',
  }),
  Object.freeze({
    local: 'zoning',
    motivo:
      'SIGUE en el XSD 4.0 (`minOccurs="0"`, `gml:ReferenceType`), pero es una ' +
      'REFERENCIA a una `cp:CadastralZoning` externa que este proyecto no genera ni ' +
      'resuelve. Emitir un xlink a un objeto que no acompaña al fichero es dejar una ' +
      'referencia colgando, y está en el checklist de rechazos del IVG.',
  }),
])

// ── Dialectos ─────────────────────────────────────────────────────────────────

/**
 * Identificadores de dialecto. `CP_4_0` es el único que este proyecto genera y
 * el único que el Catastro admite hoy en parcela; los demás se reconocen para
 * poder RECHAZARLOS con un mensaje que diga qué es lo que se ha abierto (regla
 * de oro 1: «esto no vale» a secas no es una respuesta).
 *
 * @readonly
 */
export const DIALECTO = Object.freeze({
  /** CP 4.0 en sobre de ENTREGA: `gml:FeatureCollection` + `gml:featureMember`. */
  CP_4_0_ENTREGA: 'CP_4_0_ENTREGA',
  /** CP 4.0 en sobre de DESCARGA: `wfs:FeatureCollection` + `member`. */
  CP_4_0_WFS: 'CP_4_0_WFS',
  CP_3_0: 'CP_3_0',
  BU: 'BU',
  DESCONOCIDO: 'DESCONOCIDO',
})

/**
 * ¿Es un dialecto de parcela CP 4.0, venga en el sobre que venga? Los dos son
 * soportados y comparten TODO el interior del `cp:CadastralParcel`: lo que
 * cambia es el envoltorio. Existe como función para que nadie escriba
 * `id === 'CP_4_0_ENTREGA' || id === 'CP_4_0_WFS'` en dos sitios y se le olvide
 * uno el día que haya un tercero.
 *
 * @param {string} id  Clave de {@link DIALECTO}.
 * @returns {boolean}
 */
export const esCp40 = (id) => id === DIALECTO.CP_4_0_ENTREGA || id === DIALECTO.CP_4_0_WFS

/**
 * Un dialecto de GML reconocible. POJO plano y congelado.
 *
 * @typedef {Object} Dialecto
 * @property {string} id  Clave de {@link DIALECTO}.
 * @property {boolean} soportado   `true` en los dos CP 4.0: son los que se leen y
 *   se escriben. En los demás el llamante emite `DIALECTO_RECHAZADO` (parcela
 *   3.0) o `DIALECTO_OTRO_TEMA` (edificio) y no sigue.
 * @property {'PARCELA'|'EDIFICIO'|null} tema  De qué habla el fichero.
 * @property {{ns: string|null, local: string}} raiz     Elemento raíz.
 * @property {{ns: string|null, local: string}} miembro  Contenedor de cada feature.
 * @property {string|null} featureNs  Namespace del elemento de feature. Es el
 *   DISCRIMINANTE real (ver {@link DIALECTOS}).
 * @property {'URI'|'URN'} formaSrsName  Forma en la que ESE dialecto escribe el
 *   `srsName`. Se lee de su fichero de referencia; es lo que hace que leer una
 *   URN en una entrega NO produzca un aviso y leerla en una descarga del WFS sí.
 * @property {string} motivo  Por qué está soportado o por qué no. Va al mensaje.
 */

/**
 * Tabla de dialectos, derivada de los cuatro fixtures del disco.
 *
 * ⚠️ HALLAZGO sobre los ficheros reales, y por qué esta tabla no se indexa solo
 * por la raíz: `cp_ejemplo_explicativo.gml` (parcela 4.0 de ENTREGA), `UTM_1.gml`
 * (parcela 3.0) y los dos `bu_*.gml` (edificio) tienen EXACTAMENTE la misma raíz
 * — `gml:FeatureCollection` en el namespace GML 3.2 — y el mismo contenedor
 * `gml:featureMember`. Lo único que los separa es el namespace del elemento de
 * feature: `…/schemas/cp/4.0`, `urn:x-inspire:…:CadastralParcels:3.0` y
 * `…/bu-ext2d/2.0`. La raíz sola, por tanto, NO clasifica. De ahí `featureNs`.
 *
 * Ese diseño es justo lo que ha permitido que reconocer el sobre de entrega —el
 * fallo del 2026-07-27— sea una FILA MÁS en esta tabla y no una reescritura del
 * lector: `gml/parse.js` no pregunta por ningún dialecto concreto, lee de aquí.
 *
 * Los namespaces ajenos (3.0 y edificio) están escritos aquí y no en {@link NS}
 * a propósito: son de RECONOCIMIENTO, jamás se emiten. Salen de los fixtures y
 * el test los ata a ellos clasificando los cinco ficheros del disco.
 *
 * @readonly
 * @type {ReadonlyArray<Dialecto>}
 */
export const DIALECTOS = Object.freeze([
  Object.freeze({
    id: DIALECTO.CP_4_0_ENTREGA,
    soportado: true,
    tema: 'PARCELA',
    raiz: Object.freeze({ ns: NS.gml, local: 'FeatureCollection' }),
    miembro: Object.freeze({ ns: NS.gml, local: 'featureMember' }),
    featureNs: NS.cp,
    formaSrsName: FORMA_SRSNAME.URN,
    motivo:
      'INSPIRE Cadastral Parcels 4.0 en el sobre de ENTREGA (raíz ' +
      '`gml:FeatureCollection`, `gml:featureMember`, srsName en URN): el fichero que ' +
      'el técnico SUBE a la Sede, y el que produce la plantilla oficial del Catastro.',
  }),
  Object.freeze({
    id: DIALECTO.CP_4_0_WFS,
    soportado: true,
    tema: 'PARCELA',
    raiz: Object.freeze({ ns: NS.wfs, local: 'FeatureCollection' }),
    miembro: Object.freeze({ ns: NS.wfs, local: 'member' }),
    featureNs: NS.cp,
    formaSrsName: FORMA_SRSNAME.URI,
    motivo:
      'INSPIRE Cadastral Parcels 4.0 en el sobre de DESCARGA (raíz ' +
      '`wfs:FeatureCollection`, `member`, srsName en URI): lo que DEVUELVE el servicio ' +
      'del Catastro. Se lee perfectamente, pero NO se puede subir: el validador de la ' +
      'Sede no carga el esquema de WFS y la raíz le resulta desconocida.',
  }),
  Object.freeze({
    id: DIALECTO.CP_3_0,
    soportado: false,
    tema: 'PARCELA',
    raiz: Object.freeze({ ns: NS.gml, local: 'FeatureCollection' }),
    miembro: Object.freeze({ ns: NS.gml, local: 'featureMember' }),
    featureNs: 'urn:x-inspire:specification:gmlas:CadastralParcels:3.0',
    formaSrsName: FORMA_SRSNAME.URN,
    motivo:
      'Parcela en CP 3.0 (namespaces `urn:x-inspire:…:CadastralParcels:3.0` y ' +
      'BaseTypes 3.2). Es el dialecto de 2015; el esquema que la Sede valida hoy es ' +
      'el 4.0. La conversión 3.0 → 4.0 está fuera de alcance (SPEC §1).',
  }),
  Object.freeze({
    id: DIALECTO.BU,
    soportado: false,
    tema: 'EDIFICIO',
    raiz: Object.freeze({ ns: NS.gml, local: 'FeatureCollection' }),
    miembro: Object.freeze({ ns: NS.gml, local: 'featureMember' }),
    featureNs: 'http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0',
    formaSrsName: FORMA_SRSNAME.URN,
    motivo:
      'GML de EDIFICIO (Building/BuildingPart, namespaces draft de la JRC y ' +
      'srsName en URN, override O10). No es un fichero equivocado: es otro tema, ' +
      'y su serializador es F13.',
  }),
])

/**
 * Respuesta de {@link clasificarDialecto} cuando nada casa. Es un
 * {@link Dialecto} de pleno derecho (no `null`) para que el llamante pueda
 * escribir siempre `d.soportado`/`d.motivo` sin comprobar antes si hay objeto.
 *
 * @readonly
 * @type {Dialecto}
 */
export const DIALECTO_DESCONOCIDO = Object.freeze({
  id: DIALECTO.DESCONOCIDO,
  soportado: false,
  tema: null,
  raiz: Object.freeze({ ns: null, local: '' }),
  miembro: Object.freeze({ ns: null, local: '' }),
  featureNs: null,
  // No se sabe qué forma esperaría este fichero; se pone la de la ENTREGA para
  // que el campo exista siempre y el llamante no tenga que comprobar nada. Da
  // igual: con dialecto DESCONOCIDO no se llega a leer ninguna geometría.
  formaSrsName: FORMA_SRSNAME.URN,
  motivo:
    'El fichero es XML bien formado pero su raíz (o su primer elemento de feature) ' +
    'no corresponde a ningún GML de parcela ni de edificio conocido.',
})

/**
 * Clasifica un documento por su raíz y, cuando hace falta, por el namespace de
 * su elemento de feature. Función PURA sobre datos planos: no toca el DOM (eso
 * es de `gml/xml.js`), así que el llamante extrae los tres datos y los pasa.
 *
 * `featureNs` es opcional porque hay un momento —justo tras leer la raíz— en el
 * que aún no se ha bajado al feature y ya se quiere decir algo: con la raíz WFS
 * 2.0 basta (solo hay un dialecto ahí), y con la raíz `gml:FeatureCollection` se
 * devuelve DESCONOCIDO porque ese dato NO distingue 3.0 de edificio y afirmar
 * uno de los dos sería inventárselo (regla de oro 1). En ambos casos el llamante
 * ya sabe que `soportado` es `false`, que es lo que necesita para parar.
 *
 * @param {object} args
 * @param {string|null} [args.ns]        `namespaceURI` de la raíz (`null` si el
 *   documento no declara namespaces, cosa que ocurre en XML tecleado a mano).
 * @param {string} args.local            `localName` de la raíz.
 * @param {string|null} [args.featureNs] `namespaceURI` del elemento de feature.
 * @returns {Dialecto}  Una entrada de {@link DIALECTOS} o {@link DIALECTO_DESCONOCIDO}.
 * @throws {TypeError}  Si `local` no es un string o `ns`/`featureNs` no son
 *   string ni nulos (contrato roto por el programador, no dato del usuario).
 */
export function clasificarDialecto({ ns = null, local, featureNs = null } = {}) {
  if (typeof local !== 'string') {
    throw new TypeError(
      `clasificarDialecto: 'local' debe ser un string; recibido ${JSON.stringify(local)}.`,
    )
  }
  for (const [nombre, valor] of [['ns', ns], ['featureNs', featureNs]]) {
    if (valor !== null && valor !== undefined && typeof valor !== 'string') {
      throw new TypeError(
        `clasificarDialecto: '${nombre}' debe ser un string o nulo; ` +
          `recibido ${JSON.stringify(valor)}.`,
      )
    }
  }

  const nsRaiz = ns ?? null
  const candidatos = DIALECTOS.filter((d) => d.raiz.ns === nsRaiz && d.raiz.local === local)
  if (candidatos.length === 0) return DIALECTO_DESCONOCIDO
  if (featureNs === null || featureNs === undefined) {
    // Sin feature solo se puede responder si la raíz ya era inequívoca.
    return candidatos.length === 1 ? candidatos[0] : DIALECTO_DESCONOCIDO
  }
  return candidatos.find((d) => d.featureNs === featureNs) ?? DIALECTO_DESCONOCIDO
}

// ── Vocabulario de detecciones ────────────────────────────────────────────────

/**
 * Severidades de una {@link DeteccionGml}.
 *
 * DUPLICADO A PROPÓSITO de `parsers/_comun.js#SEVERIDAD`, no importado, y con un
 * test-guarda que prohíbe que las dos listas diverjan (misma fórmula que
 * `geo/huso.js#HUSOS_VALIDOS` frente a `model/parcela.js#SRS_VALIDOS`). El
 * motivo: importarlo metería `parsers/_comun.js` —con su `TIPO_DETECCION` lleno
 * de `ARCO_DISCRETIZADO`/`SEPARADOR_DECIMAL` y con el tokenizador LIST/TXT— en
 * el grafo de dependencias del serializador de GML, que no tiene nada que ver
 * con leer ficheros de CAD. Son tres cadenas de texto; el acoplo costaría más.
 *
 * @readonly
 */
export const SEVERIDAD = Object.freeze({
  INFO: 'INFO',
  AVISO: 'AVISO',
  ERROR: 'ERROR',
})

/**
 * Tipos de detección de la rama `gml/`. Vocabulario COMPLETO desde ya (aunque
 * cada tarea de F04 emita solo unos pocos) para que `parse.js`, `serialize-cp.js`
 * y la UI de F08 hablen el mismo idioma, igual que hizo `parsers/_comun.js`.
 *
 * Es un léxico SEPARADO del de los parsers de CAD: un `TIPO_DETECCION` de allí
 * no cuela en {@link crearDeteccionGml} ni al revés, y eso es deliberado.
 *
 * @readonly
 */
export const TIPO_GML = Object.freeze({
  // ── Bytes: con qué se decodificó el fichero (gml/decodificar.js, F08) ──
  // Van los primeros porque ocurren los primeros: cuando `parse.js` empieza a
  // trabajar, el texto que recibe YA es el resultado de estas tres decisiones.
  // `ENCODING_DECLARADO` —el de abajo, que ya existía— lo emiten los dos.
  BOM_PRESENTE: 'BOM_PRESENTE', // marca de orden de bytes: manda, se consume y no queda en el texto
  ENCODING_DESMENTIDO: 'ENCODING_DESMENTIDO', // el prólogo declara uno y los bytes son otro (mandan los bytes)
  ENCODING_SUPUESTO: 'ENCODING_SUPUESTO', // ni BOM ni prólogo utilizable: se decodificó con el de reserva
  // ── Lectura: qué es este fichero (gml/parse.js) ──
  XML_MAL_FORMADO: 'XML_MAL_FORMADO', // ni siquiera es XML: el parser se plantó
  ENCODING_DECLARADO: 'ENCODING_DECLARADO', // el `encoding=` del prólogo y con qué se decodificó
  RAIZ_INESPERADA: 'RAIZ_INESPERADA', // la raíz no es ninguna FeatureCollection conocida
  DIALECTO_RECHAZADO: 'DIALECTO_RECHAZADO', // es parcela, pero en 3.0 (la Sede lo rechaza)
  DIALECTO_OTRO_TEMA: 'DIALECTO_OTRO_TEMA', // es GML de EDIFICIO, no de parcela
  SIN_MIEMBROS: 'SIN_MIEMBROS', // FeatureCollection sin ninguna feature dentro
  VARIOS_MIEMBROS: 'VARIOS_MIEMBROS', // más de una parcela: multiparcela está fuera de alcance
  // ── Lectura: sistema de referencia ──
  SRS_AUSENTE: 'SRS_AUSENTE', // la geometría no declara `srsName`
  SRS_FORMA_INESPERADA: 'SRS_FORMA_INESPERADA', // URN/corta/legado donde 4.0 pide URI (O2)
  SRS_NO_SOPORTADO: 'SRS_NO_SOPORTADO', // EPSG fuera de 25829/30/31 (Canarias DIFERIDA, O13)
  SRS_INCOHERENTE: 'SRS_INCOHERENTE', // dos `srsName` del mismo fichero no coinciden entre sí
  SRS_DIMENSION_INESPERADA: 'SRS_DIMENSION_INESPERADA', // `srsDimension` distinto de 2
  // ── Lectura: geometría ──
  MULTIPLES_CARAS: 'MULTIPLES_CARAS', // varios `surfaceMember`: la parcela es UN exterior + huecos
  POSLIST_INVALIDA: 'POSLIST_INVALIDA', // nº impar de valores, o algún token no numérico
  COUNT_DISCREPANTE: 'COUNT_DISCREPANTE', // el atributo `count` no cuadra con los pares leídos
  ANILLO_NO_CERRADO: 'ANILLO_NO_CERRADO', // el GML entrante no repite el primer vértice al final
  CIERRE_RETIRADO: 'CIERRE_RETIRADO', // venía cerrado; el modelo guarda el anillo ABIERTO (regla 4)
  AREA_DECLARADA_DISCREPANTE: 'AREA_DECLARADA_DISCREPANTE', // `areaValue` ≠ shoelace de las coords
  // ── Lectura: estructura del feature (lo que hace rechazar un GML ajeno, F08) ──
  ELEMENTO_PROSCRITO: 'ELEMENTO_PROSCRITO', // `boundedBy`/`zoning`/… en una parcela 4.0
  ORDEN_INESPERADO: 'ORDEN_INESPERADO', // hijos fuera del orden XSD (O5)
  // el `Identifier` del `inspireId` está en base 3.2 (del CP 3.0) y no en base 3.3.
  // OJO: es el NAMESPACE lo que se juzga, nunca el prefijo — ver `gml/parse.js`.
  INSPIREID_NS_INESPERADO: 'INSPIREID_NS_INESPERADO',
  // ── Escritura (gml/serialize-cp.js) ──
  ORIENTACION_NORMALIZADA: 'ORIENTACION_NORMALIZADA', // anillo invertido (O1: exterior horario)
  COLAPSO_POR_REDONDEO: 'COLAPSO_POR_REDONDEO', // dos vértices se funden al redondear a 2 decimales
  // el punto de referencia no caía dentro del polígono y se recalculó:
  PUNTO_REFERENCIA_RECALCULADO: 'PUNTO_REFERENCIA_RECALCULADO',
  ID_SANEADO: 'ID_SANEADO', // `gml:id` prefijado para que empiece por letra (regla de oro 10)
})

/**
 * Una detección de la rama `gml/`: algo que se decidió, se descartó o se corrigió
 * y que el usuario TIENE que poder ver (regla de oro 1). POJO plano.
 *
 * Misma FORMA que `parsers/_comun.js#Deteccion` (mismas cuatro claves, con
 * `datos` opcional) a propósito: la UI de F03/F08 pinta las dos con el mismo
 * componente sin adaptador de por medio. Lo que cambia es el catálogo de `tipo`.
 *
 * @typedef {Object} DeteccionGml
 * @property {string} tipo      Una de las claves de {@link TIPO_GML}.
 * @property {string} mensaje   Texto legible (en español) para la UI.
 * @property {'INFO'|'AVISO'|'ERROR'} severidad  Ver {@link SEVERIDAD}.
 * @property {object} [datos]   Datos estructurados opcionales. Solo presente si
 *                              se aportó: el contrato es `datos?`.
 */

/**
 * Crea una {@link DeteccionGml} validando `tipo` y `severidad`. LANZA si
 * cualquiera es inválido: no se fabrican detecciones mudas ni con un tipo que la
 * UI no sepa interpretar (regla de oro 1). Gemela de `parsers/#crearDeteccion`.
 *
 * @param {string} tipo  Debe ser un valor de {@link TIPO_GML}.
 * @param {string} mensaje  Texto no vacío para el usuario.
 * @param {'INFO'|'AVISO'|'ERROR'} severidad  Debe ser un valor de {@link SEVERIDAD}.
 * @param {object} [datos]  Datos estructurados opcionales (objeto plano).
 * @returns {DeteccionGml}  POJO plano `{ tipo, mensaje, severidad[, datos] }`.
 * @throws {RangeError}  Si `tipo` o `severidad` no están en su catálogo.
 * @throws {TypeError}   Si `mensaje` no es string no vacío o `datos` no es objeto plano.
 */
export function crearDeteccionGml(tipo, mensaje, severidad, datos) {
  const tiposValidos = Object.values(TIPO_GML)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `crearDeteccionGml: 'tipo' inválido: ${JSON.stringify(tipo)}. ` +
        `Válidos: ${tiposValidos.join(', ')}.`,
    )
  }
  const sevsValidas = Object.values(SEVERIDAD)
  if (!sevsValidas.includes(severidad)) {
    throw new RangeError(
      `crearDeteccionGml: 'severidad' inválida: ${JSON.stringify(severidad)}. ` +
        `Válidas: ${sevsValidas.join(', ')}.`,
    )
  }
  if (typeof mensaje !== 'string' || mensaje.length === 0) {
    throw new TypeError(
      `crearDeteccionGml: 'mensaje' debe ser un string no vacío; ` +
        `recibido ${JSON.stringify(mensaje)}.`,
    )
  }

  const det = { tipo, mensaje, severidad }
  if (datos !== undefined) {
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new TypeError(
        `crearDeteccionGml: 'datos' debe ser un objeto plano o estar ausente; ` +
          `recibido ${JSON.stringify(datos)}.`,
      )
    }
    det.datos = datos
  }
  return det
}

// ── srsName: las cuatro formas y la traducción canónica (override O2) ────────

/**
 * SRS admitidos, en forma CORTA — la que circula por el campo `srs` del modelo y
 * la que entiende `geo/huso.js#husoPorSrs`.
 *
 * Duplicado a propósito de `model/parcela.js#SRS_VALIDOS`, con test-guarda que
 * prohíbe divergir: es el mismo dominio visto desde otra rama del código, y
 * `gml/` no arrastra el modelo entero (con su validación de expedientes) solo
 * para conocer tres cadenas. Misma fórmula que `geo/huso.js`.
 *
 * Canarias (huso 28 → `EPSG:32628`) está DIFERIDA (override O13): cuando se
 * aborde, entra aquí y {@link srsNameUri} la traducirá sin más cambios, porque
 * la URI se DERIVA del código y no hay una segunda tabla que actualizar.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const SRS_SOPORTADOS = Object.freeze(['EPSG:25829', 'EPSG:25830', 'EPSG:25831'])

/**
 * Patrones de cada forma, en orden de comprobación. El grupo 1 es SIEMPRE el
 * código EPSG. Se admite el segmento de versión vacío o cualquiera (`/0/`,
 * `EPSG::`) porque el fixture 4.0 usa `/0/` y el 3.0 usa `EPSG::`, y clasificar
 * es distinto de aprobar: la canonicidad la decide `coherente`, no el patrón.
 */
const PATRONES_SRSNAME = Object.freeze([
  Object.freeze({
    forma: FORMA_SRSNAME.URI,
    re: /^https?:\/\/www\.opengis\.net\/def\/crs\/EPSG\/[^/]*\/(\d+)$/i,
  }),
  Object.freeze({
    forma: FORMA_SRSNAME.URN,
    re: /^urn:(?:x-)?ogc:def:crs:EPSG:[^:]*:(\d+)$/i,
  }),
  Object.freeze({
    forma: FORMA_SRSNAME.GML_SRS,
    re: /^https?:\/\/www\.opengis\.net\/gml\/srs\/epsg\.xml#(\d+)$/i,
  }),
  Object.freeze({ forma: FORMA_SRSNAME.CORTA, re: /^EPSG:(\d+)$/i }),
])

/** Código EPSG (número) de una forma corta soportada. `null` si no lo es. */
function codigoDeSrsCorto(srs) {
  if (!SRS_SOPORTADOS.includes(srs)) return null
  return Number(srs.slice('EPSG:'.length))
}

/**
 * Código EPSG de una forma corta soportada, o el `RangeError` con el mensaje
 * común a las dos traducciones. Existe para que `srsNameUri` y `srsNameUrn` no
 * puedan divergir en qué aceptan.
 *
 * @param {string} srs
 * @param {string} quien  Nombre de la función que llama, para el mensaje.
 * @returns {number}
 */
function exigirCodigoSrs(srs, quien) {
  if (typeof srs !== 'string') {
    throw new TypeError(`${quien}: 'srs' debe ser un string; recibido ${JSON.stringify(srs)}.`)
  }
  const codigo = codigoDeSrsCorto(srs)
  if (codigo === null) {
    throw new RangeError(
      `${quien}: srs ${JSON.stringify(srs)} no soportado ` +
        `(válidos: ${SRS_SOPORTADOS.join(', ')}). ` +
        `Canarias (EPSG:32628) está DIFERIDA (override O13).`,
    )
  }
  return codigo
}

/**
 * Forma corta del modelo → `srsName` en URI OGC.
 * `'EPSG:25830'` → `'http://www.opengis.net/def/crs/EPSG/0/25830'`.
 *
 * Es la forma canónica del perfil {@link PERFIL.WFS}. Para la ENTREGA se usa
 * {@link srsNameUrn}; quien no quiera elegir a mano llama a
 * {@link srsNamePorForma}, que despacha por perfil.
 *
 * Es la traducción que `geo/huso.js` se negó explícitamente a hacer («el
 * dialecto srsName del GML lo decide F04, NO aquí»): aquí está.
 *
 * @param {string} srs  Forma corta, una de {@link SRS_SOPORTADOS}.
 * @returns {string}  El `srsName` completo en URI OGC.
 * @throws {TypeError}   Si `srs` no es un string.
 * @throws {RangeError}  Si no es uno de los SRS soportados (Canarias `EPSG:32628`
 *   está DIFERIDA, override O13; regla de oro 1: sin error silencioso).
 */
export function srsNameUri(srs) {
  return `${PREFIJO_SRSNAME_URI}${exigirCodigoSrs(srs, 'srsNameUri')}`
}

/**
 * Forma corta del modelo → `srsName` en URN OGC.
 * `'EPSG:25830'` → `'urn:ogc:def:crs:EPSG::25830'`.
 *
 * Es la forma canónica del perfil {@link PERFIL.ENTREGA}: la que trae la
 * plantilla oficial del Catastro y la que emiten los generadores de terceros
 * cuyos ficheros la Sede acepta. Ver la corrección de O2 en la cabecera.
 *
 * @param {string} srs  Forma corta, una de {@link SRS_SOPORTADOS}.
 * @returns {string}  El `srsName` completo en URN OGC.
 * @throws {TypeError}   Si `srs` no es un string.
 * @throws {RangeError}  Si no es uno de los SRS soportados.
 */
export function srsNameUrn(srs) {
  return `${PREFIJO_SRSNAME_URN}${exigirCodigoSrs(srs, 'srsNameUrn')}`
}

/**
 * Despachador: forma corta + forma canónica pedida → `srsName`. Es lo que llama
 * el serializador, con el `formaSrsName` de su {@link PerfilEmision}, para que la
 * elección URI/URN esté en UN sitio y no repartida por `if`s.
 *
 * @param {string} srs   Forma corta, una de {@link SRS_SOPORTADOS}.
 * @param {'URI'|'URN'} forma  Una de {@link FORMA_SRSNAME} (solo URI o URN son
 *   emitibles: CORTA y GML_SRS se reconocen al leer, no se escriben nunca).
 * @returns {string}
 * @throws {RangeError}  Si `forma` no es URI ni URN, o si el `srs` no se soporta.
 */
export function srsNamePorForma(srs, forma) {
  if (forma === FORMA_SRSNAME.URI) return srsNameUri(srs)
  if (forma === FORMA_SRSNAME.URN) return srsNameUrn(srs)
  throw new RangeError(
    `srsNamePorForma: forma ${JSON.stringify(forma)} no es emitible. ` +
      `Solo ${FORMA_SRSNAME.URI} y ${FORMA_SRSNAME.URN} se escriben; ` +
      `${FORMA_SRSNAME.CORTA} y ${FORMA_SRSNAME.GML_SRS} solo se reconocen al leer.`,
  )
}

/**
 * Inversa de {@link srsNameUri} sobre el CÓDIGO: `25830` → `'EPSG:25830'`. Existe
 * porque `geo/huso.js#husoPorSrs` solo acepta la forma corta y su JSDoc pide
 * explícitamente que F04 normalice ANTES de llamarlo; sin esto, cada llamante
 * construiría la cadena a mano, que es justo lo que este módulo evita.
 *
 * @param {number} codigo  Código EPSG (p. ej. `25830`).
 * @returns {string}  Forma corta, una de {@link SRS_SOPORTADOS}.
 * @throws {TypeError}   Si `codigo` no es un entero.
 * @throws {RangeError}  Si el código no corresponde a un SRS soportado.
 */
export function srsCorto(codigo) {
  if (!Number.isInteger(codigo)) {
    throw new TypeError(
      `srsCorto: 'codigo' debe ser un entero; recibido ${JSON.stringify(codigo)}.`,
    )
  }
  const corto = `EPSG:${codigo}`
  if (!SRS_SOPORTADOS.includes(corto)) {
    throw new RangeError(
      `srsCorto: código EPSG ${codigo} no soportado ` +
        `(válidos: ${SRS_SOPORTADOS.join(', ')}). ` +
        `Canarias (32628) está DIFERIDA (override O13).`,
    )
  }
  return corto
}

/**
 * Análisis de un `srsName` leído de un GML cualquiera.
 *
 * @typedef {Object} AnalisisSrs
 * @property {string} valor    El texto recibido, recortado de espacios.
 * @property {'URI'|'URN'|'CORTA'|'GML_SRS'|'DESCONOCIDA'} forma  Ver {@link FORMA_SRSNAME}.
 * @property {number|null} codigo  Código EPSG, o `null` si no se pudo extraer.
 * @property {'URI'|'URN'} formaCanonica  Contra qué forma se ha juzgado
 *   `coherente`. Va en el resultado para que el llamante pueda decir en el
 *   mensaje QUÉ esperaba, en vez de dejar al usuario adivinándolo.
 * @property {boolean} coherente  `true` solo si `valor` es EXACTAMENTE el
 *   `srsName` que este proyecto emitiría para ese código EN LA FORMA CANÓNICA
 *   PEDIDA. Una forma distinta, una URI con otra versión de registro o un EPSG
 *   fuera de los tres → `false`: el dato se puede aprovechar (el código es
 *   válido) pero el fichero no está en la forma de su perfil, y eso hay que
 *   decirlo (`SRS_FORMA_INESPERADA`).
 *
 *   ⚠️ `coherente: false` NO significa «el esquema lo rechaza». Medido el
 *   2026-07-27: URI y URN son las dos `xsd:anyURI` y las dos validan. Significa
 *   «no es la forma que trae el fichero de referencia de este perfil», que es un
 *   aviso, no un bloqueo.
 *
 *   OJO: no confundir con `SRS_INCOHERENTE`, que es otra cosa —dos `srsName`
 *   del mismo documento que no coinciden entre sí— y la juzga `gml/parse.js`,
 *   porque aquí solo se ve una cadena cada vez.
 */

/**
 * Clasifica un `srsName` crudo sin juzgar nada más: qué forma tiene, qué código
 * EPSG lleva dentro y si es la forma canónica del perfil que se le indique.
 *
 * NO lanza por un `srsName` raro (eso es dato del usuario: se devuelve
 * `DESCONOCIDA` y el llamante emite la detección). Sí lanza si no le dan un
 * string, porque la AUSENCIA del atributo es un suceso distinto —el DOM devuelve
 * `null`— y merece su propia detección (`SRS_AUSENTE`), no colarse como «forma
 * desconocida».
 *
 * @param {string} crudo  El valor del atributo `srsName` tal cual venía.
 * @param {object} [opciones]
 * @param {'URI'|'URN'} [opciones.formaCanonica='URN']  Forma contra la que se
 *   juzga `coherente`. Por defecto la de la ENTREGA, que es el caso principal;
 *   el lector la pasa explícita según el dialecto que haya reconocido.
 * @returns {AnalisisSrs}
 * @throws {TypeError}   Si `crudo` no es un string (ver arriba: `null` NO vale).
 * @throws {RangeError}  Si `formaCanonica` no es URI ni URN.
 */
export function normalizarSrsName(crudo, { formaCanonica = FORMA_SRSNAME.URN } = {}) {
  if (typeof crudo !== 'string') {
    throw new TypeError(
      `normalizarSrsName: 'crudo' debe ser un string; recibido ${JSON.stringify(crudo)}. ` +
        `Un srsName AUSENTE es otro suceso: emite ${TIPO_GML.SRS_AUSENTE}.`,
    )
  }
  if (formaCanonica !== FORMA_SRSNAME.URI && formaCanonica !== FORMA_SRSNAME.URN) {
    throw new RangeError(
      `normalizarSrsName: 'formaCanonica' debe ser ${FORMA_SRSNAME.URI} o ${FORMA_SRSNAME.URN}; ` +
        `recibido ${JSON.stringify(formaCanonica)}.`,
    )
  }
  const valor = crudo.trim()

  let forma = FORMA_SRSNAME.DESCONOCIDA
  let codigo = null
  for (const patron of PATRONES_SRSNAME) {
    const m = patron.re.exec(valor)
    if (m) {
      forma = patron.forma
      codigo = Number(m[1])
      break
    }
  }

  // «Coherente» se define por IGUALDAD con lo que emitiríamos, no por la forma:
  // así una URI con otra versión de registro (`…/EPSG/9.9.1/25830`) sale como
  // URI —que es lo que es— pero no como canónica, sin necesidad de una segunda
  // regla que pudiera divergir de `srsNamePorForma`.
  let coherente = false
  if (codigo !== null && SRS_SOPORTADOS.includes(`EPSG:${codigo}`)) {
    coherente = valor === srsNamePorForma(`EPSG:${codigo}`, formaCanonica)
  }

  return { valor, forma, codigo, formaCanonica, coherente }
}

// ── Fechas ────────────────────────────────────────────────────────────────────

/** Dos dígitos con cero a la izquierda. */
const dos = (n) => String(n).padStart(2, '0')

/**
 * Fecha → dateTime en el formato EXACTO que traen los GML del Catastro:
 * `'YYYY-MM-DDTHH:mm:ss'`, sin fracción de segundo y SIN indicador de zona
 * (así aparecen `cp:beginLifespanVersion` y el `timeStamp` de la raíz en el
 * fixture del WFS).
 *
 * PURA por contrato: la fecha entra por parámetro. Ni este módulo ni ningún otro
 * de `gml/` consultan el reloj del sistema — si lo hicieran, el snapshot del GML
 * generado cambiaría en cada ejecución y el test de ida y vuelta de F04 dejaría
 * de poder afirmar nada. Quien necesite «ahora» lo obtiene en la capa de
 * aplicación y lo pasa hacia abajo.
 *
 * Se usan los componentes UTC y no los locales, también por reproducibilidad: el
 * mismo instante produce el mismo texto en CI y en el equipo del autor, estén en
 * la zona que estén. Como el formato no lleva offset, quien quiera hora de pared
 * española pasa una fecha ya desplazada; la diferencia es irrelevante para el
 * IVG, que solo compara fechas de vigencia.
 *
 * @param {Date} fecha  Instante a formatear.
 * @returns {string}  P. ej. `'2005-11-21T00:00:00'`.
 * @throws {TypeError}   Si `fecha` no es una fecha.
 * @throws {RangeError}  Si la fecha es inválida (tiempo no finito).
 */
export function dateTimeCatastro(fecha) {
  if (!(fecha instanceof Date)) {
    throw new TypeError(
      `dateTimeCatastro: se esperaba una fecha; recibido ${JSON.stringify(fecha)}.`,
    )
  }
  if (!Number.isFinite(fecha.getTime())) {
    throw new RangeError('dateTimeCatastro: la fecha recibida es inválida (tiempo no finito).')
  }
  const anio = String(fecha.getUTCFullYear()).padStart(4, '0')
  const dia = `${anio}-${dos(fecha.getUTCMonth() + 1)}-${dos(fecha.getUTCDate())}`
  const hh = dos(fecha.getUTCHours())
  const mm = dos(fecha.getUTCMinutes())
  const ss = dos(fecha.getUTCSeconds())
  return `${dia}T${hh}:${mm}:${ss}`
}
