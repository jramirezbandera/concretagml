// export/index.js — F10 · T4.2. LA CARA PÚBLICA DE LA CAPA `export/`.
//
// Es lo que el resto del proyecto ve de la rama de SALIDA: de la geometría del modelo
// a los tres ficheros que no son el GML. Quien la consuma importa el espacio de
// nombres `exportar` del barrel raíz y no los módulos de dentro:
//
//   import { exportar } from './index.js'
//   const { dxf }     = exportar.serializarParcelaDxf({ recintosEditados, recintosOficiales })
//   const { texto }   = exportar.serializarCoordenadasTxt({ recintos, refcat, srs, fecha })
//   const proyecto    = exportar.aProyecto(expediente, { fecha, nombre })
//   const abierto     = exportar.deProyecto(await fichero.text())
//
// (Como en `gml/index.js` y en `report/index.js`, el ejemplo no dice de dónde sale
// `fecha`: aquí NO se consulta el reloj. Se inyecta, y por lo mismo de siempre — un
// fichero exportado es un snapshot y su prueba tiene que valer igual dentro de un año.)
//
// ── POR QUÉ EL ESPACIO SE LLAMA `exportar` Y NO `export` ────────────────────
// Porque `export` es palabra reservada de JavaScript y `export * as export from …` es
// un `SyntaxError`. Se elige el verbo en infinitivo, que es además como se llaman las
// acciones en la interfaz («Exportar DXF para CAD»). El DIRECTORIO sí se llama
// `export/`, que es el nombre que `spec/SPEC.md` §5 lleva reservado desde el día 1.
//
// ── `export/` SÍ ENTRA EN EL BARREL RAÍZ, Y `storage/` NO ──────────────────
// La diferencia no es de gusto: **todo lo de `export/` es puro**. Entra geometría del
// modelo en UTM, sale una cadena de texto o un POJO. Ni `Blob`, ni `document`, ni
// `URL.createObjectURL`, ni red, ni reloj. Por eso este barrel se puede cargar tal
// cual desde el proyecto Vitest `node`, que corre sin `window`, sin `document` y sin
// `Blob` — y por eso entra, exactamente igual que `report/` y por el mismo argumento.
//
// La ENTREGA del fichero es de `gml/descargar.js`, que sí es impuro y por eso está
// vetado en el barrel desde F04. Es la misma asimetría que ya está escrita para
// `report/`: **el impuro es el CONSUMIDOR del puro**, no al revés, así que la frontera
// aguanta sin tener que cruzarla dentro de esta capa.
//
// ── DECISIÓN 1 · SUPERFICIE CURADA, NO `export *` ──────────────────────────
// Se re-exporta POR NOMBRE, uno a uno, por los dos motivos que ya razonan
// `gml/index.js` y `report/index.js`:
//
//   1. `export * from …` NO da error cuando dos módulos exportan el mismo
//      identificador: **DESCARTA la clave ambigua EN SILENCIO** y el barrel deja de
//      exponerla. Con cuatro ficheros que hablan todos de lo mismo el choque no es
//      hipotético — `_comun.js` y `proyecto.js` tienen cada uno su vocabulario de
//      motivos, y `dxf.js` y `coordenadas.js` comparten la mitad de sus detecciones.
//      Con nombres explícitos, un choque futuro es un `SyntaxError` de duplicado al
//      cargar, que es donde debe saltar.
//   2. `export *` publicaría cosas que no son API (decisión 2).
//
// ── DECISIÓN 2 · `crearDeteccionExport` NO SALE ────────────────────────────
// `export/_comun.js` sí entra en el barrel —de él salen la severidad, el catálogo de
// tipos y el recuento—, pero su FÁBRICA no. El argumento es el mismo con el que
// `report/index.js` deja fuera `crearDocumentoPdf` y `gml/index.js` deja fuera el
// escritor de XML, y aquí además tiene una vuelta de tuerca: el vocabulario de
// {@link TIPO_EXPORT} es para LEER lo que esta capa ha detectado. Una interfaz que
// pudiera fabricar detecciones de la capa de salida estaría inventando hallazgos que
// la capa no ha hecho, y quedarían indistinguibles de los de verdad en la misma lista.
// Quien de verdad la necesite (hoy nadie fuera de `export/`) la importa directamente:
//
//   import { crearDeteccionExport } from '../export/_comun.js'
//
// ── QUÉ MÁS NO SALE, Y POR QUÉ ─────────────────────────────────────────────
//   · `NL` de `dxf.js` — el terminador de línea. Describe CÓMO se escribe el fichero,
//     no cómo se lee el resultado. Que sea CRLF es una decisión medida contra los DXF
//     reales del repo y está razonada en su cabecera; publicarla invitaría a componer
//     DXF a mano por fuera de `serializarParcelaDxf`, que es justo lo que ese módulo
//     existe para impedir —los dos marcadores de subclase y el handle de la tabla
//     están dentro de él, no en el terminador—.
//   · `CLAVES_SOBRE` y `CLAVES_EXPEDIENTE` de `proyecto.js` — son la DERIVACIÓN
//     interna con la que el lector decide qué clave no conoce. Publicarlas invitaría a
//     que alguien compusiera el sobre a mano concatenando claves, y para eso está
//     `aProyecto`.
//
// Lo que SÍ sale es, en una frase: las CUATRO funciones que escriben y leen los tres
// ficheros, y el vocabulario CERRADO con el que se leen sus resultados.

// ── Tipos re-exportados para el consumidor ───────────────────────────────────
// No generan nada en tiempo de ejecución: permiten escribir
// `import('./export/index.js').DeteccionExport` sin bajar al módulo concreto, que es
// la misma frontera que impone el resto del fichero.

/**
 * @typedef {import('./_comun.js').DeteccionExport} DeteccionExport
 * @typedef {import('./coordenadas.js').ResultadoCoordenadas} ResultadoCoordenadas
 * @typedef {import('./proyecto.js').Proyecto} Proyecto
 * @typedef {import('./proyecto.js').ResultadoProyecto} ResultadoProyecto
 */

// ── El vocabulario común de la capa ──────────────────────────────────────────
// La forma `{tipo, mensaje, severidad, datos?}` es la MISMA que la de `parsers/` y la
// de `gml/`, a propósito y no por casualidad: es lo que permite que un solo componente
// de la interfaz pinte las detecciones de las tres capas sin adaptador. Lo que cambia
// es el catálogo, y por eso sale entero: sin él, la UI tendría que decidir mirando el
// TEXTO del mensaje, que es lo único que sí puede cambiar (regla de oro 1).

export { SEVERIDAD, TIPO_EXPORT, resumirDetecciones } from './_comun.js'

// ── Contrato D · el DXF para el CAD ──────────────────────────────────────────
// Lleva la parcela oficial junto a la editada, en capas SEPARADAS, que es lo que el
// perito abre para comparar las dos con las herramientas que ya sabe usar.
//
// `CAPAS` sale porque es el contrato de lo que el usuario va a ver en el árbol de
// capas de su CAD, y `ACADVER` porque es la versión del formato: el guion de humo
// comprueba que el fichero descargado empieza por esa cabecera, y no puede escribir
// `'AC1015'` a mano sin que las dos cadenas puedan divergir.

export { ACADVER, CAPAS, serializarParcelaDxf } from './dxf.js'

// ── Contrato E · el listado de coordenadas ───────────────────────────────────
// El fichero que se lleva quien va a replantear. `AVISO_NO_REIMPORTABLE` sale con él
// porque no es letra pequeña: es el hecho MEDIDO de que este listado no lo puede
// releer nuestro propio parser (la primera columna es el número de vértice, no la X),
// y la interfaz tiene que poder decir lo mismo que dice el fichero en vez de una
// segunda redacción parecida.

export { AVISO_NO_REIMPORTABLE, serializarCoordenadasTxt } from './coordenadas.js'

// ── Contrato F · el fichero de proyecto ──────────────────────────────────────
// La única puerta de esta caja fuerte: sin backend y sin cuentas, es la única forma de
// llevarse un expediente a otro equipo o a una copia de seguridad.
//
// `MOTIVO_PROYECTO` sale porque `deProyecto` NUNCA lanza por el contenido de un
// fichero ajeno —es la lección de F08 entera— y quien lo llama tiene que poder
// distinguir «esto es un GML» de «esto es de otro huso» sin leerle el texto al
// mensaje. `FORMATO_PROYECTO` y `VERSION_PROYECTO`, para que la interfaz pueda
// nombrar el formato y su versión sin escribir las cadenas otra vez.

export {
  FORMATO_PROYECTO,
  MOTIVO_PROYECTO,
  VERSION_PROYECTO,
  aProyecto,
  deProyecto,
} from './proyecto.js'
