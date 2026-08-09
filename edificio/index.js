// edificio/index.js — F11 · T3.1. LA CARA PÚBLICA DE LA CAPA `edificio/`.
//
// Es lo que el resto del proyecto ve de la rama EDIFICIO: cómo un fichero del
// técnico, un GML de la Sede o la respuesta del `wfsBU` se convierten en el
// `Edificio` de `model/edificio.js`, y qué se le puede cambiar después sin volver
// a importarlo. Quien la consuma importa el espacio de nombres `entradaEdificio`
// del barrel raíz y no los módulos de dentro:
//
//   import { entradaEdificio } from './index.js'
//   const { edificio, detecciones, resumen } =
//     entradaEdificio.entradaDesdeTexto(textoDelDxf, { capa: 'Construccion' })
//   const { edificio: renombrado } =
//     entradaEdificio.conParteRenombrada(edificio, 0, 'vivienda')
//   const punto = entradaEdificio.puntoDeReferencia(edificio)  // para deducir la RC
//
// (Como en `gml/index.js`, `report/index.js` y `export/index.js`, el ejemplo no
// dice de dónde sale el texto del DXF porque no es asunto de esta capa: aquí no se
// lee un fichero, no se habla por la red y no se consulta el reloj. Lo que entra
// es texto o POJOs ya decodificados, y quien los trae es `app/`.)
//
// ═════════════════════════════════════════════════════════════════════════════
// POR QUÉ EL ESPACIO SE LLAMA `entradaEdificio` Y NO `edificio`
// ═════════════════════════════════════════════════════════════════════════════
// Porque `edificio` YA ESTÁ OCUPADO en el barrel raíz, desde F00, por
// `model/edificio.js` ([index.js:28](../index.js#L28)) — es la desviación 8 del
// plan de F11, declarada antes de escribir una línea. Y no es una colisión
// molesta: es la que dice la verdad sobre el reparto. `edificio` es el MODELO
// (qué **es** un Edificio: `crearEdificio`, `MODELO_EDIFICIO`, `TIPO_PARTE`,
// `ORIGEN_PARTE`, `ESTADO_CONSERVACION`), y `entradaEdificio` es CÓMO SE LLEGA
// hasta él y qué se le puede cambiar luego. Dos espacios, dos preguntas
// distintas, y la del modelo es la que lleva el nombre corto porque lleva ahí
// diez fases.
//
// ⚠️ El accidente que esto evita no es teórico, pero tampoco es silencioso:
// `export * as edificio from './model/edificio.js'` dos veces en el mismo fichero
// es un `SyntaxError` de nombre duplicado al cargar. Lo que sí sería silencioso es
// la otra tentación —fundir las dos capas en un solo espacio con un `export *`
// desde aquí—, y contra eso va la decisión 1 de más abajo.
//
// ── ESTA CAPA ENTRA EN EL BARREL RAÍZ, Y ES POR LA RAZÓN DE SIEMPRE ──────────
// **Todo lo de `edificio/` es puro.** Entran cadenas, anillos en UTM y POJOs;
// salen POJOs y detecciones. Ni `document`, ni Leaflet, ni `Blob`, ni `fetch`, ni
// `Date.now()`. Por eso este barrel se puede cargar tal cual desde el proyecto
// Vitest `node`, que corre sin `window` — y por eso entra, exactamente igual que
// `comprobacion/`, `report/` y `export/`, y al contrario que `viewer/`,
// `services/`, `app/` y `storage/`. Lo vigila `test/contrato.test.js` («contrato
// F11»), y no solo comprobando que las claves existen: la mitad anti-vacuidad
// recorre la cadena entera sobre el fixture real dentro del proyecto `node`.
//
// Conviene decir dónde cae la frontera DENTRO de la feature, porque F11 la cruza
// cuatro veces y las cuatro se quedan fuera del barrel:
//
//   · `viewer/partes.js` — pinta las huellas con Leaflet. Es el único de los
//     cuatro que se autoprotege (importarlo bajo `node` revienta con
//     `ReferenceError: window is not defined`; MEDIDO el 2026-08-03).
//   · `services/catastro-edificio.js` — habla por la red con el `wfsBU`.
//   · `app/rama.js` y `app/panel-edificio.js` — fabrican marcado.
//
// ⛔ **Y los tres últimos NO se autoprotegen: importados bajo `node` cargan sin
// lanzar** (medido el mismo día: solo nombran `document` DENTRO de sus funciones,
// y de `viewer/` solo tocan `_comun.js`, que no importa Leaflet). O sea que
// meterlos aquí dejaría la suite EN VERDE y la aplicación rota. Lo que lo impide
// es el guardián ESTÁTICO de `test/contrato.test.js`, que veta los cuatro
// directorios en bloque (`^\./(?:viewer|services|app|storage)\/`) leyendo el
// FUENTE del barrel raíz. Esa regla mira `index.js`; lo que este fichero tiene que
// cumplir por su cuenta es no ser la puerta de atrás — ver «QUÉ NO SALE».
//
// La asimetría es la misma que ya está escrita para `report/` y `export/`: **el
// impuro es el CONSUMIDOR del puro**, no al revés. `app/cableado-edificio.js`
// (T3.2) importa este barrel y también `viewer/partes.js`, cada uno por su vía, y
// la frontera aguanta sin tener que cruzarla desde dentro de esta capa.
//
// ── DECISIÓN 1 · SUPERFICIE CURADA, NO `export *` ───────────────────────────
// Se re-exporta POR NOMBRE, uno a uno, por los dos motivos que ya razonan
// `gml/index.js` (decisión 2), `report/index.js` y `export/index.js`:
//
//   1. `export * from …` NO da error cuando dos módulos exportan el mismo
//      identificador: **DESCARTA la clave ambigua EN SILENCIO** y el barrel deja
//      de exponerla. Un fallo silencioso, que es lo que la regla de oro 1 persigue
//      en todo este repo. Con nombres explícitos, un choque futuro es un
//      `SyntaxError` de duplicado en el instante de cargar.
//      ⚠️ Aquí el choque **está a una función de distancia**: `_comun.js` exporta
//      `SEVERIDAD` y `resumirDetecciones`, que son dos de los nombres más genéricos
//      del proyecto —los tienen también `gml/_comun.js` y `export/_comun.js`— y
//      `entrada.js` y `mutaciones.js` hablan las dos del mismo dominio. Hoy no
//      colisionan por suerte y no por decreto, que es literalmente lo que
//      `report/index.js` escribió de `literal.js` y `firma.js`.
//   2. `export *` publicaría COSAS QUE NO SON API (decisión 2).
//
// ── DECISIÓN 2 · `crearDeteccionEdificio` NO SALE ───────────────────────────
// `edificio/_comun.js` sí entra en el barrel —de él salen la severidad, el
// catálogo de tipos, los motivos de bloqueo y el recuento—, pero su FÁBRICA no. Es
// el calco del argumento con el que `export/index.js` deja fuera
// `crearDeteccionExport`, `report/index.js` deja fuera `crearDocumentoPdf` y
// `gml/index.js` deja fuera el escritor de XML: el vocabulario de
// {@link TIPO_EDIFICIO} es para **LEER** lo que esta capa ha detectado. Una
// interfaz que pudiera fabricar detecciones de la rama edificio estaría inventando
// hallazgos que la capa no ha hecho, y quedarían indistinguibles de los de verdad
// en la misma lista —que es justo la lista con la que el técnico decide si se fía
// de lo que ha importado—. Quien de verdad la necesite (hoy nadie fuera de
// `edificio/`) la importa directamente:
//
//   import { crearDeteccionEdificio } from '../edificio/_comun.js'
//
// ── QUÉ MÁS NO SALE, Y POR QUÉ ──────────────────────────────────────────────
//   · `CONDICION_A_ESTADO` y `REFERENCIA_SUPERFICIE_CONSTRUIDA` de `entrada.js` —
//     las dos tablas del mapeo INSPIRE → modelo (`functional → FUNCIONAL`,
//     `grossFloorArea → superficieConstruida`). Describen CÓMO se traduce, no cómo
//     se lee el resultado: lo que cruza esta frontera es el vocabulario del
//     MODELO, y ése ya sale por el espacio `edificio` (`ESTADO_CONSERVACION`).
//     Publicarlas invitaría a traducir INSPIRE a mano por fuera de las tres
//     fábricas, que es justo lo que este módulo existe para centralizar —y su
//     propio JSDoc avisa de que solo `functional` está MEDIDO; los otros tres son
//     mapeo razonado—. Mismo criterio que `NL` en `export/index.js` y que
//     `MM_POR_PULGADA` en `report/index.js`.
//   · Nada de `viewer/partes.js`, `services/catastro-edificio.js`, `app/rama.js`
//     ni `app/panel-edificio.js`, **ni siquiera por su nombre y desde aquí**. Este
//     fichero es el único punto de la feature desde el que se podrían colar sin que
//     el guardián estático del barrel raíz los viera —él lee `index.js`, no este
//     fichero— y sin que la suite se pusiera roja, porque tres de los cuatro
//     importan sin lanzar bajo `node`. Hay un `it` en `test/contrato.test.js` que
//     lo comprueba por los NOMBRES de sus cuatro fábricas —más `RAMA`, que es el
//     vocabulario que más tentación da de sacar «porque lo necesita la UI»—, y esa
//     es la razón de que exista. Verificado mutándolo: con
//     `export { RAMA, cablearRama } from '../app/rama.js'` añadido AQUÍ, ese `it`
//     es el ÚNICO de los 5.573 que se pone rojo.
//
// Lo que SÍ sale es, en una frase: las TRES fábricas de entrada, las CUATRO
// mutaciones, el punto del que se deduce la referencia catastral, y el vocabulario
// CERRADO con el que se leen sus resultados.

// ── Tipos re-exportados para el consumidor ───────────────────────────────────
// No generan nada en tiempo de ejecución: permiten escribir
// `import('./edificio/index.js').EntradaEdificio` sin bajar al módulo concreto, que
// es la misma frontera que impone el resto del fichero.

/**
 * @typedef {import('./_comun.js').DeteccionEdificio} DeteccionEdificio
 * @typedef {import('./entrada.js').ResumenEntrada} ResumenEntrada
 * @typedef {import('./entrada.js').EntradaEdificio} EntradaEdificio
 * @typedef {import('./mutaciones.js').ResultadoMutacion} ResultadoMutacion
 */

// ── Contrato D · las tres fábricas de entrada ────────────────────────────────
// Las únicas funciones de la capa que hacen trabajo de verdad: de un volcado de
// texto (DXF/LIST/TXT), de un GML de edificio ajeno o de lo que devuelve el
// `wfsBU` al `Edificio` del modelo. Las tres devuelven la MISMA forma
// {@link EntradaEdificio} —`{edificio, detecciones, resumen}`—, que es el espejo
// deliberado de `ResumenImportacion` de `parsers/importar.js` con `nAnillos →
// nPartes` y `construida → construido`: quien sabe leer uno sabe leer el otro, y
// `app/` los pinta con el mismo componente.
//
// Ninguna lanza por el CONTENIDO (la lección de F08 entera): un XML roto, un GML
// de parcela o una parcela sin nada construido salen por `resumen.bloqueos`. El
// `throw` se reserva para el contrato roto por el programador.

export { entradaDesdeGmlBu, entradaDesdeTexto, entradaDesdeWfsBu } from './entrada.js'

// ── El punto del que se deduce la referencia catastral ───────────────────────
// Sale con las fábricas porque es el paso siguiente inmediato: cargado el
// edificio, `app/` le pide al Catastro la RC de este punto. Y sale por su nombre,
// y no como un campo más del resultado, porque es una decisión con historia
// MEDIDA: **no es el centroide**. `app/cableado-catastro.js:133-141` dejó escrito
// que el centroide aritmético de una figura en L cae FUERA del polígono y que el
// Catastro contesta entonces con la referencia de la parcela VECINA, en silencio.
// Aquí se usa `gml/anillos.js#puntoInterior` sobre la parte de MAYOR superficie, y
// se VERIFICA el punto en vez de confiar.

export { puntoDeReferencia } from './entrada.js'

// ── Vocabulario de la entrada ────────────────────────────────────────────────
// `resumen.via` es una clave de {@link VIA} y `resumen.bloqueos` una lista de
// {@link MOTIVO_ENTRADA}. Salen los dos porque sin ellos la interfaz tendría que
// decidir mirando el TEXTO del mensaje, que es lo único que sí puede cambiar
// (regla de oro 1).
//
// `MOTIVO_ENTRADA` es además el catálogo que hace comprobable una de las
// mediciones caras de esta fase: son CINCO y CERRADOS, y **`ANILLOS_EN_VARIAS_CAPAS`,
// `SUPERFICIE_NO_POSITIVA` y `VARIOS_RECINTOS_DISJUNTOS` no están** — esos tres son
// de PARCELA, los emite `parsers/importar.js` y `entradaDesdeTexto` los filtra,
// porque un DXF de vivienda + porche + piscina (el caso NORMAL de esta rama) viene
// por definición de varias capas y saldría bloqueado por el arreglo que protege a
// la otra rama. ⭐ El tercero lo añadió F22 y agrava el caso: esas tres piezas son
// además **disjuntas entre sí**, así que sin el filtro ni siquiera haría falta que
// el DXF trajera varias capas para que la rama quedara muerta.

export { MOTIVO_ENTRADA } from './_comun.js'
export { VIA } from './entrada.js'

// ── Vocabulario de las detecciones ───────────────────────────────────────────
// La forma `{tipo, mensaje, severidad, datos?}` es la MISMA que la de `parsers/`,
// `gml/` y `export/`, a propósito y no por casualidad: es lo que permite que un
// solo componente de la interfaz pinte las detecciones de las cuatro capas sin
// adaptador, y que `resumirDetecciones` cuente una lista MIXTA —las de aguas
// arriba llegan tal cual— sin preguntar de dónde viene cada una.
//
// {@link SEVERIDAD} es la cuarta copia de las mismas tres cadenas, y la
// duplicación es deliberada y está razonada en la cabecera de `_comun.js`; un
// test-guarda prohíbe que las cuatro listas diverjan.

export { SEVERIDAD, TIPO_EDIFICIO, resumirDetecciones } from './_comun.js'

// ── El nombre genérico de una parte ──────────────────────────────────────────
// `nombreParteGenerico(i)` → `'Parte 1'`, `'Parte 2'`… Sale por el barrel, y no es
// una utilidad suelta: es la ÚNICA definición de cómo se llama una parte que
// todavía no ha nombrado nadie. Las tres fábricas la usan al importar, y quien
// cree una parte por otra vía —el dibujo a mano de F12— tiene que usar la misma o
// la aplicación acabará con dos convenciones de nombre para el mismo objeto en la
// misma lista. Deliberadamente NEUTRO: ni «vivienda» ni «porche», porque un nombre
// inventado que acierta a veces se queda sin revisar (regla de oro 9).

export { nombreParteGenerico } from './_comun.js'

// ── Las cuatro mutaciones ────────────────────────────────────────────────────
// Lo que el usuario puede cambiar de un edificio ya cargado sin volver a
// importarlo: el modelo, la referencia catastral, el rótulo de una parte y los
// siete atributos semánticos. Las cuatro construyen un `Edificio` NUEVO con
// `crearEdificio` y devuelven {@link ResultadoMutacion} —`{edificio, detecciones}`,
// **no un Edificio pelado**—: el POJO del store no se muta jamás, que es lo que
// hace que `structuredClone` sirva de historial (regla de oro 4).
//
// ⚠️ La que obliga a esa firma es `conModelo`: pasar de COMPLETO a SIMPLIFICADO
// **borra los siete atributos semánticos**, y hay que poder enseñar la lista de lo
// que se pierde ANTES de escribir el resultado en el store. Es la regla de oro 1
// aplicada a una acción destructiva.
//
// `ROTULO_ATRIBUTO` sale con ellas para que la interfaz etiquete su diálogo con
// LAS MISMAS palabras que usa el mensaje de `conModelo`: dos redacciones distintas
// de «nº de viviendas» en la misma pantalla son dos campos distintos para quien lee.

export {
  ROTULO_ATRIBUTO,
  conAtributos,
  conModelo,
  conParteRenombrada,
  conRefcat,
} from './mutaciones.js'

// ── Y las SEIS de F12: cinco que hacen que la lista sea una lista, y la identidad ─
// Las cuatro de arriba tratan al edificio como algo que ya está: se le cambia el
// modelo, la referencia y el rótulo de sus partes, pero la lista es la que trajo
// el fichero. Éstas la abren: se añade, se quita, se clasifica, se le ponen
// plantas y se le cambia el contorno.
//
// Salen con las otras cuatro, y no en un espacio aparte, porque para el llamante
// son la misma pregunta —«qué le puedo cambiar a un edificio ya cargado»— y
// tienen el mismo contrato: `{edificio, detecciones}`, `crearEdificio` como
// único constructor, y el POJO del store intacto.
//
// ⚠️ `conParteRedibujada` es la ÚNICA puerta por la que el mapa escribe en la
// geometría de una parte: por ella entra tanto lo que dibuja `edit/dibujo.js`
// desde cero como lo que devuelve la edición de F06. Una sola puerta es lo que
// permite que el store se reconstruya siempre igual, y por eso no hay una
// segunda para «mover un vértice».
//
// Y la sexta es `conIdLocal` (T4.3), que no toca la lista: le pone al edificio la
// identidad con la que se le puede archivar y autoguardar. Sale por aquí porque
// quien la estampa es el cableado de la rama —es él quien sabe de qué fichero o de
// qué referencia viene el documento—, no el modelo.

export {
  conIdLocal,
  conParteAnadida,
  conParteEliminada,
  conParteRedibujada,
  conPlantas,
  conTipoParte,
} from './mutaciones.js'

// ── Y la de F21: la precisión del trabajo profesional ────────────────────────
// `conPrecision` no toca ni la lista ni el modelo: le pone al edificio el metro
// que el ICUC exige declarar en su paso 1, y que `gml/serialize-bu.js` sabe emitir
// desde F13 sin que nadie se lo pasara nunca. Sale por aquí por lo mismo que
// `conIdLocal`: quien lo estampa es la interfaz —es el técnico quien conoce su
// levantamiento—, no el modelo.

export { conPrecision } from './mutaciones.js'

// ── La envolvente, que se DERIVA y no se guarda ──────────────────────────────
// Criterio de aceptación 3 de F12. Sale por aquí porque quien la necesita es la
// interfaz —para pintarla y para poder decir qué partes se han quedado fuera—, y
// `MOTIVO_FUERA` sale con ella por lo de siempre: sin el vocabulario, la pantalla
// tendría que decidir mirando el texto.
//
// ⚠️ **Vive en `edificio/envolvente.js` y NO en `model/edificio.js`**, que es lo
// que la ficha de la fase escribe en «Ficheros». Desviación declarada: el modelo
// es el sitio de lo que SE GUARDA, y esto es exactamente lo que no se guarda.

export { MOTIVO_FUERA, envolventeDe } from './envolvente.js'

// ── La vista editable de la parte activa ─────────────────────────────────────
// El adaptador que hace que `viewer/edicion.js` —atado al store de PARCELA desde
// F06— sirva para editar la huella de una parte sin tocar una línea suya. Sale
// por el barrel porque su llamante es `app/`, y entra en esta capa PURA porque no
// sabe nada de mapas: es una fachada `{get,set,subscribe}` sobre POJOs.

export { crearVistaParteActiva } from './parte-activa.js'
