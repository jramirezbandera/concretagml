// gml/index.js — F04 · Tarea T4.2. LA CARA PÚBLICA DEL MÓDULO `gml/`.
//
// Es lo que el resto del proyecto ve de la rama GML: leer un GML de parcela y
// escribir el que se sube a la Sede Electrónica. Quien lo consuma importa el
// espacio de nombres `gml` del barrel raíz y no los módulos de dentro:
//
//   import { gml } from './index.js'
//   const { parcelas, detecciones } = gml.parsearGml(texto)
//   const fecha = gml.dateTimeCatastro(instanteQueDecideLaApp)
//   const { xml, resumen } = gml.serializarParcelaCp({ recintos, srs, refcat,
//     beginLifespanVersion: fecha })
//
// (El ejemplo no escribe de dónde sale `instanteQueDecideLaApp` porque no es
// asunto de `gml/`: aquí no se consulta el reloj NI SIQUIERA EN UN COMENTARIO
// —el guardián mira el texto entero del fichero, no solo el código—, que es la
// misma regla que declaran las cabeceras de `_comun.js`, `parse.js`,
// `serialize-cp.js` y `descargar.js`.)
//
// `gml/` es CAPA DE DOMINIO: no importa Leaflet, ni proj4 (regla de oro 7), ni
// nada de `viewer/`, `services/` o `app/`. De Turf usa solo lo topológico y por
// subpaquete (regla de oro 6). Por eso este barrel se puede cargar tal cual
// desde el proyecto Vitest `node`, que corre sin `window`, y por eso ENTRA en el
// barrel raíz `index.js` —al contrario que el visor—. `test/gml/contrato-gml.test.js`
// vigila las cuatro cosas.
//
// ── DECISIÓN 1 · `gml/descargar.js` SE QUEDA FUERA ───────────────────────────
// `descargarGml` necesita `Blob`, `URL.createObjectURL` y `document`: es código
// de NAVEGADOR, no de dominio. El barrel raíz lo carga el proyecto Vitest `node`
// —`test/contrato.test.js` lo importa—, así que meter aquí un módulo que nombra
// globales del DOM es exactamente el fallo que ya está documentado para el
// visor: `viewer/index.js` y `services/*` están fuera del barrel porque importan
// Leaflet, que exige `window`. Mismo motivo, misma decisión.
//
// La vía correcta —la que ya usa `app/main.js` con `viewer/index.js`— es
// importar el fichero DIRECTAMENTE desde la capa de aplicación:
//
//   import { descargarGml, nombreFicheroGml } from '../gml/descargar.js'
//
// A quien venga a «completar el barrel» dentro de seis meses: eso rompe la suite
// entera de `node`, y el test que lo dice por escrito es
// `test/gml/contrato-gml.test.js` («el barrel NO expone la entrega al usuario»).
//
// ── DECISIÓN 2 · SUPERFICIE CURADA, NO `export *` ────────────────────────────
// Aquí se re-exporta POR NOMBRE, uno a uno. `export * from ...` habría sido más
// corto y es la trampa: cuando dos módulos exportan el mismo identificador,
// `export *` NO da error — DESCARTA la clave ambigua EN SILENCIO y el barrel
// simplemente deja de exponerla. Un fallo silencioso, que es lo que la regla de
// oro 1 persigue en todo este repo. Con nombres explícitos, un choque futuro es
// un `SyntaxError` de duplicado en el instante de cargarlo.
//
// El segundo motivo es que `export *` publicaría COSAS QUE NO SON API. `gml/xml.js`
// exporta `texto`, `hijo`, `hijos`, `atributo`, `elem`, `render` y `ruta`:
// fontanería XML con nombres genéricos que no significan nada fuera de su módulo
// y que colisionarían con lo primero que se llame igual. La API pública del
// proyecto son TRES funciones y el vocabulario para interpretar lo que devuelven.
//
// ── QUÉ NO SALE, Y POR QUÉ ───────────────────────────────────────────────────
//   · `gml/xml.js` ENTERO — lector/escritor XML genérico, sin dominio. Quien
//     necesite XML crudo (hoy nadie fuera de `gml/`) lo importa directamente.
//   · `gml/descargar.js` ENTERO — decisión 1.
//   · Las constantes de fontanería del resto de módulos (`NS`,
//     `SCHEMA_LOCATION_*`, `ORDEN_CADASTRAL_PARCEL`, `PREFIJO_ID`,
//     `DECLARACION_XML`, `LIMITE_MAGNITUD_COORD`…): describen CÓMO se escribe el
//     fichero, no cómo se lee el resultado. Publicarlas invita a componer GML a
//     mano por fuera del serializador, que es justo lo que este módulo existe
//     para impedir. Si alguna hace falta de verdad, se añade aquí con su motivo.
//
// Lo que SÍ sale es, en una frase: las tres funciones de entrada y salida, más el
// vocabulario CERRADO con el que se leen sus `detecciones` y su `resumen`
// (severidades, tipos, dialectos, orientaciones, orígenes del punto, motivos de
// saneado) y la única función que la capa de aplicación necesita para meter el
// reloj —`dateTimeCatastro`—, porque `gml/` no lo lee por su cuenta.

// ── Tipos re-exportados para el consumidor ───────────────────────────────────
// No generan nada en tiempo de ejecución: permiten escribir
// `import('./gml/index.js').ResultadoParseGml` sin bajar al módulo concreto, que
// es la misma frontera que impone el resto del fichero.

/**
 * @typedef {import('./_comun.js').DeteccionGml} DeteccionGml
 * @typedef {import('./_comun.js').Dialecto} Dialecto
 * @typedef {import('./_comun.js').AnalisisSrs} AnalisisSrs
 * @typedef {import('./parse.js').RecintoGml} RecintoGml
 * @typedef {import('./parse.js').ParcelaGml} ParcelaGml
 * @typedef {import('./parse.js').ResumenParseGml} ResumenParseGml
 * @typedef {import('./parse.js').ResultadoParseGml} ResultadoParseGml
 * @typedef {import('./serialize-cp.js').OpcionesParcelaCp} OpcionesParcelaCp
 * @typedef {import('./serialize-cp.js').ResumenSerializacion} ResumenSerializacion
 * @typedef {import('./serialize-cp.js').ResultadoSerializacion} ResultadoSerializacion
 * @typedef {import('./ids.js').IdsParcela} IdsParcela
 */

// ── Entrada y salida ─────────────────────────────────────────────────────────
// Las únicas funciones que hacen trabajo: leer un GML, escribirlo, y —desde
// F08— convertir los bytes de un fichero ajeno en el texto que lee la primera.
// Todo lo demás de este fichero existe para poder leer lo que devuelven.

export { parsearGml } from './parse.js'
export { serializarParcelaCp } from './serialize-cp.js'

// ── F11: el segundo lector, y por qué es PÚBLICO ─────────────────────────────
// `parsearGmlBu` lee el dialecto BU (edificio), que `parsearGml` se niega a leer
// a propósito y con un mensaje bueno (`TIPO_GML.DIALECTO_OTRO_TEMA`). Sale por
// aquí porque lo consumen DOS capas de fuera de `gml/`: `edificio/entrada.js`
// (un fichero que suelta el usuario) y `services/catastro-edificio.js` (la
// respuesta del `wfsBU`). Un lector que solo usara `gml/` sería privado.
//
// Lo decidió el guardián de `test/gml/contrato-gml.test.js`, que existe para
// esto y lo dice en su propio comentario: «si mañana aparece `gml/serialize-bu.js`
// y nadie decide si es público, este test lo dice». Apareció `parse-bu.js` y lo
// dijo el mismo día.
export { parsearGmlBu } from './parse-bu.js'

// ── El escalón de debajo: bytes → texto (F08) ────────────────────────────────
// `parsearGml` recibe un `string` y nunca ha sabido de dónde salía. Cuando el
// fichero lo trae el usuario —que es F08— alguien tiene que decidir con qué
// codificación se leen sus bytes, y esa decisión NO puede ser «lo que diga el
// prólogo»: el GML real del WFS declara `ISO-8859-1` y sus bytes son UTF-8.
// `decodificarGml` lo decide por prueba y lo cuenta. Sale por el barrel porque
// es puro —`TextDecoder` es WHATWG Encoding, no DOM: existe igual en Node y en
// el navegador— y porque su salida es la ENTRADA de `parsearGml`: publicar una
// sin la otra dejaría al consumidor obligado a improvisar el paso que este
// módulo existe para hacer bien.

export { decodificarGml } from './decodificar.js'

// ── Vocabulario de las detecciones ───────────────────────────────────────────
// Las tres funciones devuelven `detecciones` (regla de oro 1: ningún error
// silencioso). Sin estas dos tablas, la UI tendría que decidir mirando el TEXTO
// del mensaje, que es lo único que sí puede cambiar.

export { SEVERIDAD, TIPO_GML } from './_comun.js'

// ── Vocabulario del documento leído ──────────────────────────────────────────
// `resumen.dialecto` es una clave de `DIALECTO`; `DIALECTOS` y
// `DIALECTO_DESCONOCIDO` llevan el `motivo` en castellano de por qué un fichero
// está soportado o no, que es lo que F08 enseña al usuario cuando abre un CP 3.0
// o un GML de edificio. `SRS_SOPORTADOS` es la lista con la que se construye el
// selector de sistema de referencia y con la que se explica un rechazo.

export { DIALECTO, DIALECTOS, DIALECTO_DESCONOCIDO, SRS_SOPORTADOS, esCp40 } from './_comun.js'

// ── El SOBRE: entrega frente a descarga ──────────────────────────────────────
// Sale por el barrel, y no es fontanería, porque es una decisión de PRODUCTO que
// la capa de aplicación tiene que poder tomar y explicar: `PERFIL.ENTREGA` es el
// fichero que se sube a la Sede y `PERFIL.WFS` el que devuelve el servicio del
// Catastro — válido, legible y NO subible. Confundirlos es lo que provocó el
// rechazo del IVG del 2026-07-27 (ver la cabecera de `gml/_comun.js`), así que la
// distinción tiene que estar a la vista de quien construye la UI, no escondida.
//
// `PERFILES` acompaña a `PERFIL` porque lleva el `motivo` de cada campo y el
// nombre del fixture del que sale, que es lo que permite explicar la diferencia
// sin repetirla.

export { PERFIL, PERFILES } from './_comun.js'

// ── El reloj, que `gml/` no lee ──────────────────────────────────────────────
// `serializarParcelaCp` exige `beginLifespanVersion` y NUNCA consulta la marca
// de tiempo del sistema: si lo hiciera, el snapshot del test de ida y vuelta
// cambiaría en cada ejecución y dejaría de afirmar nada. «Ahora» lo pone la capa
// de aplicación, y esta es la función que le da el formato que quiere el
// Catastro. Por eso sale por el barrel: es la contrapartida obligatoria de esa
// frontera, no una utilidad suelta.

export { dateTimeCatastro } from './_comun.js'

// ── Vocabulario del fichero escrito ──────────────────────────────────────────
// `resumen.orientacionOriginal` e `invertidos` se leen con
// `ORIENTACION_ESPERADA` (override O1: exterior HORARIO = −1, huecos +1);
// `resumen.puntoReferencia.origen` con `ORIGEN_PUNTO`; y `DECIMALES_COORD`
// es lo que explica la distancia entre `superficieModelo` y
// `superficieRedondeada` (regla de oro 11).

export { DECIMALES_COORD, ORIENTACION_ESPERADA, ORIGEN_PUNTO } from './anillos.js'

// ── Identidad INSPIRE ────────────────────────────────────────────────────────
// Los dos namespaces son las dos respuestas legítimas a «¿quién declara esta
// parcela?»: `ES.LOCAL.CP` un particular (el defecto de `serializarParcelaCp`) y
// `ES.SDGC.CP` el propio Catastro, que es lo que trae un GML descargado del WFS.
// `MOTIVO_SANEADO` es el vocabulario del `datos.motivos` de una detección
// `ID_SANEADO`: por qué hubo que tocar un `gml:id` (regla de oro 10).

export {
  MOTIVO_SANEADO,
  NAMESPACE_INSPIRE_CATASTRO,
  NAMESPACE_INSPIRE_DEFECTO,
} from './ids.js'
