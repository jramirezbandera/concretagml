// app/cableado-edificio.js — F11 · T3.2. EL CABLE de la SEGUNDA rama.
//
// Once fases después, esta aplicación solo sabía de parcelas. La fase 2 dejó
// hechas las cinco piezas de la rama EDIFICIO y **ninguna conoce a las otras**:
// `edificio/entrada.js` convierte un volcado o un GML en un `Edificio` y no sabe
// qué es un `File`; `services/catastro-edificio.js` habla con el `wfsBU` y no
// sabe qué es un panel; `app/panel-edificio.js` fabrica el panel y **no sabe qué
// es un DXF**; `viewer/partes.js` pinta huellas y no sabe de dónde salen;
// `app/rama.js` conmuta secciones que otro monta. Este fichero es lo que las une
// y lo que las conecta con el segundo store. Mientras no existiera, F11 entera
// era código muerto.
//
// El recorrido, entero:
//
//   File → ArrayBuffer → decodificarGml → entradaDesdeTexto | entradaDesdeGmlBu
//        → (si es un DXF de varias capas: diálogo de reparto) → estado.set
//        → panel + huellas en el mapa + encuadre
//
//   RC → clienteEdificio.edificioPorRefcat → entradaDesdeWfsBu → el mismo final
//
// Su anatomía es la de `app/cableado-catastro.js` y la de
// `app/cableado-comprobacion.js` a propósito —selectores y motivos exportados,
// dependencias inyectables, token de secuencia + `AbortController`, `destruir()`
// idempotente—: quien llegue después reconoce el patrón sin leerlo entero.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔⛔ LA COSTURA QUE NINGÚN CONTRATO ASIGNÓ: QUIÉN SELLA `data-rama-panel`
// ═════════════════════════════════════════════════════════════════════════════
// `app/rama.js` **descubre** las secciones de edificio por `data-rama-panel` en
// cada conmutación (`:700`) y **marca él mismo** las de parcela (`:535-537`),
// porque `index.html` no las trae. Pero `app/panel-edificio.js` **no escribe ese
// atributo**: expone `seccionOrigen`, `seccionPartes` y `raices()` para que lo
// selle quien las monte. Verificado por `grep`: **cero menciones de
// `data-rama-panel` fuera de `app/rama.js`**.
//
// Nadie marcaba las de EDIFICIO ⇒ **la rama edificio no se mostraría nunca**, y
// `rama.js` habría contado el hueco con `MENSAJE_SIN_PANEL_EDIFICIO` en cada
// conmutación. No es un defecto de ninguno de los dos módulos: es una
// responsabilidad que ningún contrato repartió. **La asume este fichero, al
// montar el panel** ({@link cablearEdificio}), y hay un `it` que la vigila.
//
// ⚠️ Se sellan **las dos `<section>`, y NADA MÁS**. Los dos `<dialog>` que
// `panel-edificio.js` cuelga del `<body>` NO se marcan: su visibilidad la
// gobierna `open`, y ponerles `data-rama-panel` haría que `rama.js` les
// escribiera `hidden` — un `<dialog open hidden>` es un diálogo que se abre y no
// se ve, que es la peor combinación posible.
//
// ⚠️ Y se les fija el `hidden` **al montar**, según la rama que ya esté puesta:
// `rama.js` solo reparte visibilidad **al conmutar**, así que un panel montado
// después de `cablearRama` se quedaría VISIBLE encima del de parcela hasta la
// primera pulsación del conmutador. La rama activa se lee del `data-rama` del
// `<body>` —el único gancho publicado, contrato K.1— o del objeto `rama` si se
// inyecta; si no hay ninguno de los dos, no se toca (montaje sin conmutador).
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ EL ENCUADRE: `visor.encuadrar()` NO SIRVE AQUÍ
// ═════════════════════════════════════════════════════════════════════════════
// Un edificio traído por referencia catastral o soltado como GML puede caer a
// **cientos de kilómetros** de lo que se está mirando, y `visor.encuadrar()`
// ejecuta su cascada sobre el store de **parcela**, que en esta rama es contexto
// y puede estar vacío o hablar de otro municipio. Es exactamente el defecto que
// la firma humana encontró en F03 y que `README.md:58-63` documenta: «se traía
// una parcela de Sevilla y el mapa seguía mirando la de demostración».
//
// Se usa `viewer/index.js#encuadrarSobreRecintos`, que T1.5 hizo público para
// esto, con **el HUSO y no el `srs`** (`geo/huso.js#husoPorSrs`) y con
// `sujeto: 'El edificio'`. Devuelve `false` si no había ni un vértice utilizable
// y **entonces no toca la vista** — que es justo el caso del store recién
// nacido, y hay un `it` que lo mide contando llamadas a `setView`/`fitBounds`.
//
// ⭐ **Este módulo es el PRIMER llamante de la historia que puede ver el aviso de
// «vértices no numéricos»** de aquella función: por la rama de parcela es
// inalcanzable desde F03 (`viewer/sincronizacion.js` proyecta cada vértice antes
// y `geo/utm.js#inverse` **lanza** con un `NaN`, así que `crearVisor` revienta
// antes de llegar al encuadre). Por aquí no hay `sincronizar` de por medio.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔⛔ EL ORDEN DE APAGADO, QUE NO SE ARREGLA DESDE AQUÍ Y POR ESO SE DICE
// ═════════════════════════════════════════════════════════════════════════════
// `services/catastro.js#destruir` **aborta el transporte**, y el transporte es
// COMPARTIDO con el cliente de edificio (override O8: la cola de concurrencia,
// los reintentos y el ritmo son de toda la aplicación). Consecuencia MEDIDA y
// anclada en sendos `it` de T2.2:
//
//   · `crearClienteEdificio.destruir()` **solo se apaga a sí mismo**;
//   · `crearClienteCatastro.destruir()` **sí** aborta el transporte compartido, y
//     a partir de ahí el cliente de edificio devuelve `CANCELADA` **sin que nadie
//     lo haya destruido**.
//
// **El orden importa**, y quien lo decide es `app/main.js` (T4.1), no este
// fichero: aquí los clientes entran INYECTADOS y no se destruyen —quien crea,
// destruye—, exactamente como en `app/cableado-catastro.js`.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ EL 404 DEL `wfsBU` LLEGA CON UN AVISO DEL TRANSPORTE QUE DICE OTRA COSA
// ═════════════════════════════════════════════════════════════════════════════
// `services/_red.js#fallar` emite «el servidor dice que **esa dirección no
// existe**»: habla de una dirección web cuando el usuario ha escrito una
// referencia catastral. No se arregla sin tocar `_red.js`, que es de otra fase.
// Por eso **el renglón bueno es `resultado.mensaje`** —que T2.2 compone
// nombrando la consulta y diciendo que el 404 de este servicio es MUDO— y no el
// canal de avisos del transporte. Este módulo publica siempre `resultado.mensaje`.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ `datos.srs` PUEDE SER `null` EN UN RESULTADO BUENO
// ═════════════════════════════════════════════════════════════════════════════
// La colección vacía —la parcela que existe y no tiene nada construido, que es
// **el punto de partida de la obra nueva**— llega con `ok: true`, `srs: null` y
// `srsName: null`. Así que aquí **no se asume el huso que se pidió**: el SRS de
// la respuesta solo se compara con el del expediente **cuando la respuesta trae
// uno**, y el encuadre usa siempre el del expediente, que es el único que este
// módulo puede afirmar.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ EL DIÁLOGO DE CAPAS OFRECE N Y `entradaDesdeTexto` ACEPTA UNA
// ═════════════════════════════════════════════════════════════════════════════
// **Hueco de contrato encontrado al coser, y es de los que salen mal en
// silencio.** `app/panel-edificio.js` pinta una CASILLA por capa —su
// `INTRO_CAPAS` dice, en plural, «cada polilínea de las capas que se marquen»— y
// `capasElegidas()` devuelve un array. Pero `edificio/entrada.js#entradaDesdeTexto`
// y `parsers/importar.js` aceptan `opts.capa`: **un string**, y con otra cosa
// LANZAN. Quedarse con la primera marcada habría sido cargar menos partes de las
// pedidas sin decirlo (regla de oro 1 en su forma más pura).
//
// Se resuelve en {@link entradaPorCapas}, y con dos caminos porque los mensajes
// mandan:
//
//   · **UNA capa marcada ⇒ delegación pura**: `entradaDesdeTexto(texto, {capa})`.
//     Es el caso frecuente y el del fixture real, y sus detecciones son exactas.
//   · **VARIAS ⇒ una pasada por capa, fundidas.** Y entonces hay que corregir dos
//     familias de detecciones que, juntas, MENTIRÍAN:
//       (a) el reparto de `importar` dice «se importa SOLO la capa «A»», que es
//           falso en el conjunto;
//       (b) un `CAPA_DXF_DESCARTADA` de la capa «B» emitido por la pasada de «A»
//           anunciaría como descartada una capa que sí ha entrado.
//     Las dos se retiran y se sustituyen por UNA `CAPA_DXF_DESCARTADA` propia por
//     cada capa que de verdad se queda fuera, construida con el reparto completo
//     que `importar` publica en `datos.capas`. El resto se concatena
//     DEDUPLICADO por `(tipo, mensaje)`: el huso detectado o una entidad no
//     soportada salen idénticos en las N pasadas, y repetirlos N veces es ruido,
//     no información.
//
// Las partes se **renumeran** con `nombreParteGenerico`, que es lo que hace la
// vía de una sola capa: sin eso, dos capas darían dos «Parte 1».
//
// ═════════════════════════════════════════════════════════════════════════════
// LA DEGRADACIÓN HONRADA: ESTA RAMA NO SE AUTOGUARDA, Y SE DICE
// ═════════════════════════════════════════════════════════════════════════════
// Desviación 7 del plan de F11. El autoguardado es suscriptor del store de
// PARCELA (`app/cableado-expediente.js:1339`) y el borrador es un registro único
// de clave reservada; suscribirlo también al de edificio haría que el borrador de
// edificio **pisara el de parcela**, y darle identidad a un `Edificio` obliga a
// tocar `model/edificio.js`, que es la desviación 2. Así que en F11 **no se
// guarda nada de esta rama**, y eso se cuenta por dos canales, como
// `MENSAJE_AUTOGUARDADO_EN_ESPERA` hace en la otra:
//
//   · el renglón `[data-procedencia="edificio"]`, que lo lleva SIEMPRE (es una
//     propiedad de esta versión, no un suceso), y
//   · el panel de avisos, **una sola vez**: cuando entra el primer edificio, que
//     es cuando pasa a haber trabajo que se puede perder.
//
// ═════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE MÓDULO **NO** HACE
// ═════════════════════════════════════════════════════════════════════════════
//   · **No fabrica marcado.** El panel lo fabrica `app/panel-edificio.js`; aquí
//     solo se monta, se sella y se le habla por sus métodos.
//   · **No conmuta la rama.** Quién enruta un `.dxf` según la rama activa es
//     `app/main.js` (paso 9, resolución tardía). Aquí `alFichero` enruta por
//     CONTENIDO, no por extensión, y por eso sabe leer también un GML de edificio
//     aunque hoy `.gml`/`.xml` los reclame `app/cableado-comprobacion.js`.
//   · **No construye URL ni sabe qué es una *stored query*.** Recibe los clientes
//     hechos y consume su vocabulario (`MOTIVO_CATASTRO`, `NIVEL_POR_MOTIVO`,
//     `ORIGEN`, `normalizarRefcat`).
//   · **No emite ni un veredicto** (regla de oro 9): traslada lo que midieron
//     `edificio/entrada.js` y `services/catastro-edificio.js`.
//   · **No genera el GML de edificio** (F13) ni lo contrasta (F14). Los dos CTA
//     del pie los apaga `app/rama.js`, con el motivo escrito al lado.
//
// Su test es `test/app/edificio.dom.test.js`, **con sufijo `.dom`**: toca el DOM.

import {
  MOTIVO_ENTRADA,
  SEVERIDAD,
  TIPO_EDIFICIO,
  crearDeteccionEdificio,
  nombreParteGenerico,
} from '../edificio/_comun.js'
import {
  VIA,
  entradaDesdeGmlBu,
  entradaDesdeTexto,
  entradaDesdeWfsBu,
  puntoDeReferencia,
} from '../edificio/entrada.js'
import { envolventeDe } from '../edificio/envolvente.js'
import {
  conAtributos,
  conIdLocal,
  conModelo,
  conParteAnadida,
  conParteEliminada,
  conParteRenombrada,
  conPlantas,
  conTipoParte,
} from '../edificio/mutaciones.js'
import { crearVistaParteActiva } from '../edificio/parte-activa.js'
import { metricas } from '../edit/metricas.js'
// ⚠️ `conRefcat` NO se importa, y es una decisión: la referencia que el usuario
// teclea NO entra en el modelo por el hecho de teclearla. Viaja como `opts.refcat`
// de la fábrica cuando entra un documento nuevo (ver {@link comunes}), que es la
// misma doctrina que `app/cableado-catastro.js`: `edificio.refcat` significa
// SIEMPRE «esto lo afirma el usuario al cargar», nunca «esto estaba a medio
// teclear». Aplicarla a un edificio ya cargado es una acción que el panel de F11
// no ofrece; queda para F12, que es quien la necesita.
import { husoPorSrs } from '../geo/huso.js'
import { decodificarGml } from '../gml/decodificar.js'
import { MODELO_EDIFICIO, crearEdificio } from '../model/edificio.js'
import { MOTIVO_CATASTRO, NIVEL_POR_MOTIVO, ORIGEN, normalizarRefcat } from '../services/catastro.js'
import { NIVEL } from '../viewer/_comun.js'
import { crearDibujo } from '../viewer/dibujo.js'
import { crearEdicion } from '../viewer/edicion.js'
import { encuadrarSobreRecintos } from '../viewer/index.js'
import { crearCapaPartes } from '../viewer/partes.js'
import { sincronizar } from '../viewer/sincronizacion.js'
import { textoProcedencia } from './cableado-catastro.js'
// F14 · El aviso del cotejo de superficie, REUTILIZADO de la rama de parcela y no
// reescrito: nació de un caso real (una LISTA copiada a medias) y lleva dentro la
// sospecha por el signo de la diferencia. Dos redacciones del mismo aviso acabarían
// divergiendo, y la de esta rama sería la peor porque se usa menos.
import { avisoDeSuperficie } from './cableado-medicion.js'
import { ACCION, DIALOGO, SIN_MEDIDA } from './panel-edificio.js'
import { ATRIBUTO_PANEL, ATRIBUTO_RAMA, RAMA } from './rama.js'

// ── El contrato con `index.html` ─────────────────────────────────────────────
//
// Solo DOS selectores, y los dos son ANCLAS: dónde se meten las secciones que
// fabrica `app/panel-edificio.js`. Todo lo demás de esta rama son nodos suyos, y
// se piden por su API en vez de por `querySelector` — que es lo que impide que
// este módulo dependa de un marcado que no escribe.

/**
 * Detrás de qué va la sección «Origen del edificio». Es el bloque «Origen de la
 * parcela», al que SUSTITUYE: las dos ocupan el mismo sitio del panel porque el
 * intercambio de rama es por visibilidad, no por añadido (decisión 1).
 */
export const ANCLA_ORIGEN = '.gml-bloque--catastro'

/**
 * Detrás de qué va la sección «Partes». Es la caja de vértices, a la que
 * sustituye **como estirador** del panel: `.gml-bloque--partes` es
 * `flex: 1 1 auto` igual que `.gml-bloque--vertices`, y **dos estiradores a la
 * vez descosen el panel** (medido por T2.4). El orden no es comodidad: si la
 * lista de partes se colocara antes del bloque de avisos, absorbería la altura
 * por encima de ellos y el reparto dejaría de parecerse al de la otra rama.
 */
export const ANCLA_PARTES = '.gml-bloque--vertices'

/**
 * Extensiones que esta rama aporta a la zona de fichero (contrato J). **No las
 * enchufa este módulo**: las monta `app/main.js` en el paso 9 con resolución
 * tardía, porque el destino de un `.dxf` depende de la rama activa y la rama se
 * cablea después. Se exportan aquí para que allí no se copie el literal.
 *
 * ⛔ **`.gml` y `.xml` NO están, y no es un olvido**: las reclama
 * `app/cableado-comprobacion.js` (F08) y `entradasExtra` **lanza** si se intenta
 * tomar una extensión ya tomada (`:609`). La vía «soltar un GML de edificio»
 * existe y funciona —{@link cablearEdificio}.alFichero enruta por CONTENIDO—,
 * pero hoy **solo se alcanza si alguien le entrega el fichero**; por arrastre no,
 * mientras esa extensión tenga otro dueño. Queda declarado.
 *
 * @type {readonly string[]}
 */
export const EXTENSIONES = Object.freeze(['.dxf', '.txt'])

// ── Lo que se le dice al usuario ─────────────────────────────────────────────

/**
 * Sujeto de la frase del aviso de vértices no numéricos de
 * `encuadrarSobreRecintos`. Su defecto es «La parcela», y usarlo aquí le contaría
 * al usuario un fallo REAL sobre el objeto equivocado. Se exporta para que su
 * test lo afirme sin copiar el literal.
 */
export const SUJETO_ENCUADRE = 'El edificio'

/**
 * Metros cuadrados MEDIDOS por la aplicación, con sus dos decimales (F12 · T4.2).
 *
 * ⚠️ **Es una SEGUNDA declaración del mismo formato**, y hay que decirlo: la
 * primera es `FORMATO_SUPERFICIE` de `app/main.js`, cuya cabecera avisa de que un
 * segundo formateador con las mismas opciones «solo añade un sitio desde el que
 * divergir». Aquí no se puede importar —`app/main.js` es el punto de entrada y se
 * ejecuta al cargarse—, así que la duplicación se declara en vez de disimularse.
 *
 * Lo que **no** está duplicado es lo que importa: el NÚMERO sale de
 * `edit/metricas.js`, que es el único sitio de la aplicación que mide. Esto solo
 * lo escribe.
 */
export const FORMATO_SUPERFICIE = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Los m² de una cifra ya medida, en español. */
const formatearM2 = (n) => FORMATO_SUPERFICIE.format(n)

/** Lo que se enseña cuando no hay superficie que enseñar. La del panel, no otra. */
const SIN_MEDIDA_EDIFICIO = SIN_MEDIDA

/**
 * Lo que se dice cuando la envolvente no se ha podido calcular con todas las
 * partes. Sale **una vez por cambio**, no una por repintado: `repintar` corre en
 * cada `set` del store —y arrastrar un vértice son sesenta al segundo—, así que
 * avisar en cada uno convertiría el panel en un contador.
 *
 * @param {number} n
 * @returns {string}
 */
/**
 * Lo que se dice si un recinto dibujado se cierra sin parte a la que asignarlo.
 * No debería ocurrir —la palabra de la barra solo aparece con una parte elegida—,
 * pero si ocurre, tirar treinta clics en silencio es lo que la regla de oro 1
 * prohíbe.
 */
export const MENSAJE_DIBUJO_SIN_PARTE =
  'El recinto se ha cerrado, pero no había ninguna parte elegida a la que asignárselo, así que no ' +
  'se ha guardado. Elige una parte en la lista y vuelve a dibujarlo.'

export const mensajeEnvolventeSaltada = (n) =>
  `${n} contorno${n === 1 ? '' : 's'} de parte no ${n === 1 ? 'ha' : 'han'} podido entrar en la ` +
  'envolvente calculada: la línea que se dibuja rodea al resto. Suele ser un contorno que se ' +
  'cruza consigo mismo; la validación de la parte lo señala.'

/**
 * Con qué nombre entra un edificio cuando no consta ninguno. Ver {@link idLocalDe}:
 * es el respaldo, no el caso normal.
 *
 * @readonly
 */
export const IDENTIDAD_SIN_NOMBRE = 'edificio-sin-nombre'

/**
 * Con qué nombre nace un edificio que se empieza **desde cero**, añadiendo una parte
 * sin haber cargado nada. No hay fichero ni referencia de la que sacarlo, y el
 * respaldo es literal —el mismo `'medicion-propia'` de `componerParcelaMedida` en la
 * otra rama—: un identificador inventado que acierta a veces sería peor.
 *
 * @readonly
 */
export const IDENTIDAD_DIBUJADO = 'edificio-dibujado'

/**
 * ⛔ **F12 · T4.3 · ESTA FRASE SE REESCRIBIÓ ENTERA, y el motivo es esta misma
 * fase.** Lo que decía era verdad y dejó de serlo:
 *
 * > «Esta rama no se guarda sola: el autoguardado y los expedientes de esta versión
 * > son de la rama Parcela… exporta el dibujo desde tu CAD o vuelve a soltar el
 * > fichero.»
 *
 * Las dos mitades caducaron el mismo día. La primera porque T4.3 le da al edificio
 * su identidad y su propia clave de borrador (`storage/expedientes.js#ID_BORRADOR_EDIFICIO`),
 * así que **esta rama SÍ se guarda sola** desde ahora. Y la segunda porque a partir
 * de F12 se puede dibujar un recinto a mano: mandar al usuario a «exportarlo desde
 * su CAD» es mandarlo a un sitio donde ese dibujo no ha estado nunca.
 *
 * Se retira **con la misma honradez con la que se puso**, que era la condición: lo
 * que sigue sin poderse hacer se dice, y por su nombre. Sigue sin poderse **archivar
 * como expediente con nombre** ({@link MOTIVO_GUARDAR_EN_EDIFICIO} de
 * `app/cableado-expediente.js` lo razona), y el borrador es UNO por rama: cargar
 * otro edificio pisa el anterior.
 */
export const MENSAJE_SIN_AUTOGUARDADO =
  'Esta rama se guarda sola en este navegador, pero todavía no se archiva: el trabajo en curso se ' +
  'recupera al volver, y «Guardar» —la lista de expedientes con nombre— sigue siendo de la rama ' +
  'Parcela. Y el trabajo en curso es UNO: si cargas otro edificio, el anterior se pierde. Para ' +
  'conservar éste, guarda un fichero de proyecto (.json) desde «Expediente».'

/**
 * La misma advertencia, **en un renglón**, para el sitio donde tiene que estar
 * SIEMPRE: el de procedencia.
 *
 * ⛔ **Existe porque el mensaje de arriba se estaba enseñando DOS VECES A LA VEZ**
 * (2026-08-04; lo midió el guion de humo 13, no la suite): entero y permanente
 * concatenado en el renglón de procedencia, **y** entero otra vez como tarjeta del
 * panel de avisos en cuanto se cargaba algo. Decir dos veces lo mismo no es el
 * doble de honrado, y aquí además costaba: el renglón medía **89,06 px** en un
 * panel al que le faltaban 32,70 px para que la lista de partes y los avisos
 * cupieran con una fila cada uno.
 *
 * El reparto queda así, y cada mitad hace lo suyo:
 *   · **Aquí, permanente y en una línea** — porque no archivar es una PROPIEDAD de
 *     esta versión y no un suceso, que es el argumento con el que se puso en el
 *     renglón y sigue siendo bueno.
 *   · **La tarjeta entera, en el panel de avisos y UNA vez** — cuando pasa a haber
 *     algo que perder, que es cuando la advertencia se puede accionar. Ahí caben
 *     las tres cosas (qué no pasa, por qué, y qué hacer) sin quitarle sitio a nada.
 *
 * ⚠️ La versión larga **no se borra y sigue exportada**: es la que se dice cuando
 * importa y la que la suite afirma entera.
 *
 * ⛔ **F12 · T4.3: también se reescribió, y por lo mismo que la larga.** «No se
 * guarda sola» pasó a ser falso el día que el autoguardado llegó a esta rama, y
 * «exporta el dibujo desde tu CAD» pasó a ser falso el día que se puede dibujar uno
 * aquí. Lo que queda es lo que sigue siendo cierto, en un renglón: se guarda el
 * trabajo en curso, no se archiva con nombre.
 */
export const MENSAJE_SIN_AUTOGUARDADO_BREVE =
  'Esta rama guarda el trabajo en curso, pero todavía no lo archiva con nombre.'

/**
 * Lo que se le dice al usuario cuando el navegador no ha podido leer los bytes
 * del fichero. Mismo texto y mismo motivo que en `app/cableado-comprobacion.js`:
 * el `File` que entrega el sistema es un puntero a algo que puede haberse
 * movido, renombrado o desmontado entre que se eligió y que se leyó.
 */
export const MENSAJE_FICHERO_NO_LEIDO =
  'No se ha podido leer el contenido del fichero. Suele pasar cuando se ha movido, renombrado o ' +
  'desconectado la unidad desde que se eligió: vuelve a abrirlo. No se ha cambiado nada.'

/**
 * Lo que se le dice al usuario cuando algo revienta por un defecto de
 * programación. Mismas tres piezas que sus cuatro gemelos de `app/`: qué ha
 * pasado, que no se ha cambiado nada, y dónde está el detalle para copiarlo.
 */
export const MENSAJE_FALLO_INESPERADO =
  'La operación sobre el edificio se ha interrumpido por un fallo interno de la aplicación; no se ' +
  'ha cambiado nada. El detalle técnico está en la consola del navegador.'

/** F19 · El campo del pegado, vacío. No es un error: es el estado de partida. */
export const PEGADO_VACIO_EDIFICIO =
  'Pega aquí las coordenadas de las huellas del edificio: el resultado del comando LISTA de ' +
  'AutoCAD, o dos columnas por vértice.'

/** F19 · Se ha pegado algo y no hay dentro ni una huella que leer. */
export const PEGADO_SIN_GEOMETRIA_EDIFICIO =
  'En ese texto no hay ningún par de coordenadas que pueda ser la huella de una parte. Del ' +
  'comando LISTA hay que copiar el bloque entero, con las líneas «Ubicación: X= … Y= …».'

/**
 * No hay a quién pedirle el edificio. **No es un fallo**: es una pantalla montada
 * sin el cliente del servicio, que es un montaje legítimo (y es lo que queda si el
 * cliente no se pudo construir al arrancar). Gemelo de `MOTIVO_SIN_CLIENTE` de
 * `app/cableado-comprobacion.js`.
 */
export const MENSAJE_SIN_CLIENTE =
  'Esta pantalla no tiene conectado el servicio de edificios del Catastro, así que «Traer del ' +
  'Catastro» está apagado. Las huellas se pueden cargar igual desde un DXF, un listado o un GML ' +
  'de edificio.'

/** No hay referencia escrita y tampoco de dónde deducirla. */
export const MENSAJE_SIN_REFERENCIA =
  'No se ha consultado nada: el campo de la referencia catastral está vacío y no hay ninguna ' +
  'huella cargada de la que deducirla. Escribe la referencia, o carga antes el dibujo.'

/**
 * Hay huella pero no hay quien pregunte por ella. Se distingue de
 * {@link MENSAJE_SIN_REFERENCIA} a propósito: ahí falta el dato y aquí falta el
 * servicio, y decirle al usuario que escriba algo que ya tiene sería mandarle a
 * arreglar lo que no está roto.
 */
export const MENSAJE_SIN_DEDUCCION =
  'No se ha podido deducir la referencia catastral desde la huella: esta pantalla no tiene ' +
  'conectado el servicio de consulta por coordenada del Catastro. Escribe la referencia a mano.'

/**
 * `puntoDeReferencia` no ha encontrado ningún punto dentro de ninguna parte. El
 * texto es PROPIO, igual que en `app/cableado-catastro.js`: el de las detecciones
 * de `puntoInterior` habla del `cp:referencePoint` y de lo que el Catastro
 * rechaza al inscribir, y aquí no se está serializando nada.
 */
export const MENSAJE_SIN_PUNTO_INTERIOR =
  'No se ha podido encontrar ningún punto dentro de las huellas desde el que preguntarle al ' +
  'Catastro qué parcela hay ahí: la geometría es degenerada (área nula, anillo colapsado o menos ' +
  'de tres vértices). No se ha llegado a consultar nada.'

/**
 * Varias parcelas en el punto de la huella. **No se rellena ninguna a ciegas**:
 * es la misma regla de la spec §7.3 que aplica `app/cableado-catastro.js`, y no
 * es prudencia — elegir una de dos en un lindero es meterle al usuario la parcela
 * del vecino en el expediente sin que él haya dicho nada.
 *
 * @param {readonly {refcat: string}[]} lista
 * @returns {string}
 */
export const mensajeVariosCandidatos = (lista) =>
  `En el punto de la huella hay ${lista.length} parcelas (${lista.map((c) => c.refcat).join(', ')}) ` +
  'y no se rellena ninguna a ciegas. Escribe en el campo la que sea la tuya y vuelve a pulsar.'

/**
 * El usuario ha cerrado la elección de capas sin cargar nada. **No se calla**: ha
 * soltado un fichero y no ha pasado nada visible, y «no ha pasado nada» es lo
 * único que no se puede interpretar (regla de oro 1). Dice además cómo volver.
 *
 * @param {string} nombre
 * @returns {string}
 */
export const mensajeCapasCanceladas = (nombre) =>
  `No se ha cargado nada de «${nombre}»: se ha cerrado la elección de capas sin aplicarla. ` +
  'Vuelve a soltar el fichero para elegirlas.'

/** El DXF trae varias capas y el reparto se OFRECE, no se impone (decisión 5). */
export const MENSAJE_ELIGE_CAPAS =
  'El dibujo trae sus polilíneas repartidas en varias capas. Marca en la ventana cuáles entran ' +
  'como partes: la aplicación no elige por el nombre, porque en los planos reales la capa que se ' +
  'llama «PARCELA» no siempre es la que lleva la parcela.'

/** Cola común de los renglones cuyo detalle íntegro acaba de entrar en el panel. */
const COLA_DETALLE = 'El detalle está en el panel de avisos.'

/**
 * Resumen de UNA LÍNEA por motivo del cliente, para el renglón del panel. **Mapa
 * explícito y TOTAL sobre {@link MOTIVO_CATASTRO}**, con guardián de carga más
 * abajo: un `default` es exactamente lo que hace que un motivo nuevo herede un
 * texto que nadie ha escrito.
 *
 * No sustituye al `mensaje` del cliente —que es largo, nombra la consulta y va
 * ÍNTEGRO al panel—: lo resume para una línea de 11 px. Y **no se reutiliza el de
 * `app/cableado-catastro.js`**, que es privado allí y además habla de parcelas:
 * el `NO_ENCONTRADO` de este servicio significa otra cosa (no hay construcción
 * registrada), y decirlo con las palabras de la otra rama sería el error que la
 * regla de oro 1 prohíbe.
 *
 * @type {Readonly<Record<string, string>>}
 */
const RESUMEN_POR_MOTIVO = Object.freeze({
  [MOTIVO_CATASTRO.ENTRADA_INVALIDA]:
    'No se ha consultado nada: lo escrito no tiene forma de referencia catastral de parcela.',
  [MOTIVO_CATASTRO.NO_ENCONTRADO]:
    'El Catastro no ha localizado esa referencia en su servicio de edificios.',
  [MOTIVO_CATASTRO.BBOX_DEMASIADO_GRANDE]:
    'El encuadre pedido es más grande de lo que el servicio admite.',
  [MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE]:
    'El Catastro ha contestado algo que esta aplicación no sabe usar.',
  [MOTIVO_CATASTRO.ESTADO_HTTP]: 'El servicio de edificios del Catastro ha respondido con un error.',
  [MOTIVO_CATASTRO.TIEMPO_AGOTADO]: 'El Catastro ha tardado demasiado en contestar.',
  [MOTIVO_CATASTRO.SIN_RED]: 'No se ha podido contactar con el Catastro.',
  [MOTIVO_CATASTRO.CANCELADA]: 'La consulta al Catastro se ha cancelado.',
})

/**
 * Guardián de carga: {@link RESUMEN_POR_MOTIVO} tiene que ser TOTAL sobre el
 * catálogo del cliente. Ruidoso a propósito, y por la misma razón que su gemelo
 * de `app/cableado-catastro.js`: un módulo que no carga se arregla en cinco
 * minutos; un renglón en blanco no lo ve nadie.
 */
for (const motivo of Object.values(MOTIVO_CATASTRO)) {
  /* c8 ignore next 6 -- solo se alcanza si el catálogo del cliente crece y este no */
  if (RESUMEN_POR_MOTIVO[motivo] === undefined) {
    throw new Error(
      `app/cableado-edificio: falta el resumen de renglón de MOTIVO_CATASTRO.${motivo}. Un motivo ` +
        `nuevo del cliente tiene que llegar a la pantalla con un texto decidido por alguien, no ` +
        `con un renglón en blanco.`,
    )
  }
}

/**
 * Resumen de UNA LÍNEA por bloqueo de la entrada, para el renglón. Mismo criterio
 * —mapa TOTAL sobre {@link MOTIVO_ENTRADA} y guardián de carga— que el de arriba.
 *
 * ⚠️ `SIN_CONSTRUCCION` **no se redacta como un fallo**, y esa es la mitad que se
 * olvida: la colección vacía del `wfsBU` es `200 OK` y significa que la parcela
 * existe y no tiene nada construido. Es el **punto de partida de una obra
 * nueva**, o sea justo lo que el técnico venía a hacer.
 *
 * @type {Readonly<Record<string, string>>}
 */
const RESUMEN_POR_BLOQUEO = Object.freeze({
  [MOTIVO_ENTRADA.SIN_GEOMETRIA]: 'El fichero no trae ni un contorno que cargar como parte.',
  [MOTIVO_ENTRADA.COORDENADAS_EN_GRADOS]:
    'Las coordenadas vienen en grados y aquí se esperan metros UTM.',
  [MOTIVO_ENTRADA.HUSO_NO_RESUELTO]:
    'No se ha podido saber en qué huso están las coordenadas, así que no se sitúan.',
  [MOTIVO_ENTRADA.SIN_CONSTRUCCION]:
    'No hay ninguna construcción registrada: ese es el punto de partida de una obra nueva.',
  [MOTIVO_ENTRADA.DIALECTO_NO_BU]: 'Ese GML no es de edificio; esta rama solo lee los de edificio.',
})

for (const motivo of Object.values(MOTIVO_ENTRADA)) {
  /* c8 ignore next 6 -- solo se alcanza si el catálogo de la entrada crece y este no */
  if (RESUMEN_POR_BLOQUEO[motivo] === undefined) {
    throw new Error(
      `app/cableado-edificio: falta el resumen de renglón de MOTIVO_ENTRADA.${motivo}. Un bloqueo ` +
        `nuevo de edificio/entrada.js tiene que llegar a la pantalla con un texto decidido por ` +
        `alguien, no con un renglón en blanco.`,
    )
  }
}

/** Suelo de los dos mapas, para un código que no está en su catálogo. */
const RESUMEN_DESCONOCIDO = 'No se ha podido cargar el edificio.'

/** Lo que se dice cuando una consulta ha sido superada por otra más nueva. */
const MENSAJE_SUPERADA =
  'Esta consulta al Catastro quedó superada por otra más nueva, así que su respuesta se ha ' +
  'descartado sin usarla.'

// ── Utilidades ───────────────────────────────────────────────────────────────

/** ¿Es un texto con contenido? Se mira el CONTENIDO, no la mera presencia. */
const textoNoVacio = (v) => (typeof v === 'string' && v.trim().length > 0 ? v : null)

/**
 * ¿El texto tiene pinta de documento XML? Es el discriminante de {@link alFichero}
 * para enrutar por CONTENIDO y no por extensión — que es lo que hace que un GML de
 * edificio guardado como `.txt` entre bien y un DXF renombrado a `.gml` también.
 *
 * Deliberadamente TOSCO: decidir de verdad si es un GML de edificio es de
 * `gml/parse-bu.js`, que ya devuelve `{ok:false}` sin lanzar. Lo único que se
 * decide aquí es a cuál de los dos lectores se le entrega.
 *
 * @param {string} texto
 * @returns {boolean}
 */
function pareceXml(texto) {
  return /^\s*(?:﻿)?</.test(texto)
}

/**
 * Nodo del documento, o `throw` nombrando el selector. Mismo criterio —y casi el
 * mismo texto— que el `nodo()` de `app/cableado-catastro.js`: el marcado de
 * `index.html` es CONTRATO, así que un selector que no encuentra nada es un bug
 * del programador y se descubre al montar la pantalla, no media hora después.
 *
 * @param {Document} documento
 * @param {string} selector
 * @returns {HTMLElement}
 * @throws {Error}
 */
function nodo(documento, selector) {
  const encontrado = documento.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `cablearEdificio: la cáscara no tiene ningún nodo '${selector}'. Es el ancla detrás de la ` +
        `que se monta el panel de edificio, y es parte del contrato de marcado con index.html: ` +
        `si se ha renombrado o movido ese bloque, hay que arreglarlo allí, no aquí.`,
    )
  }
  return /** @type {HTMLElement} */ (encontrado)
}

/**
 * Los recintos dibujables de un edificio, en el orden de sus partes. Las partes
 * sin contorno —un estado NORMAL del modelo: «pendiente de dibujar»— viajan como
 * `null` y `encuadrarSobreRecintos` las salta solas.
 *
 * @param {object|null} edificio
 * @returns {Array<{vertices: Array<[number, number]>}|null>}
 */
function recintosDe(edificio) {
  const partes = edificio === null || edificio === undefined ? null : edificio.partes
  return Array.isArray(partes) ? partes.map((p) => p?.recinto ?? null) : []
}

/** ¿Hay al menos un contorno con vértices? Es la condición de «se puede deducir». */
function tieneGeometria(edificio) {
  return recintosDe(edificio).some((r) => Array.isArray(r?.vertices) && r.vertices.length > 0)
}

/**
 * El reparto `{capa: nºanillos}` de un DXF, a partir de la lista de capas 1:1 con
 * las partes que publica el contrato D (`resumen.capas`). Conserva el ORDEN DE
 * APARICIÓN: el usuario coteja la lista del diálogo contra su CAD, y reordenarla
 * por cantidad le obligaría a buscar.
 *
 * @param {readonly string[]} capas
 * @returns {{nombre: string, anillos: number}[]}
 */
function repartoDeCapas(capas) {
  const cuenta = new Map()
  for (const capa of capas) cuenta.set(capa, (cuenta.get(capa) ?? 0) + 1)
  return [...cuenta].map(([nombre, anillos]) => ({ nombre, anillos }))
}

/**
 * Lo que este módulo consume de una entrada, venga de donde venga. Es un
 * SUBCONJUNTO del contrato D: las tres claves que se usan de verdad, ni una más.
 * Existe para que {@link entradaPorCapas} —que funde N pasadas y no puede
 * fabricar un `ResumenEntrada` honrado, porque `nVertices` y `capas` dejarían de
 * ser 1:1 con nada— pueda devolver lo mismo que las otras cuatro vías sin fingir
 * una forma que no tiene.
 *
 * @typedef {Object} EntradaNormalizada
 * @property {object|null} edificio
 * @property {Array<object>} detecciones
 * @property {string[]} bloqueos
 */

/**
 * Un {@link EntradaNormalizada} a partir de un {@link EntradaEdificio} del
 * contrato D.
 *
 * @param {{edificio: object|null, detecciones: Array, resumen: {bloqueos: string[]}}} entrada
 * @returns {EntradaNormalizada}
 */
const normalizar = (entrada) => ({
  edificio: entrada.edificio,
  detecciones: entrada.detecciones,
  bloqueos: entrada.resumen.bloqueos,
})

/**
 * La entrada de un DXF con las capas que el usuario ha marcado. Ver el apartado
 * «El diálogo de capas ofrece N y `entradaDesdeTexto` acepta una» de la cabecera:
 * aquí vive esa costura, y es la única de este fichero que compone un `Edificio`
 * en vez de delegarlo entero.
 *
 * @param {string} texto  El volcado, ya decodificado.
 * @param {readonly string[]} elegidas  Nombres LITERALES de capa, ≥ 1.
 * @param {object} comunes  `{modelo, parcelaContexto}` para las fábricas.
 * @returns {EntradaNormalizada}
 */
export function entradaPorCapas(texto, elegidas, comunes = {}) {
  // Una sola capa: DELEGACIÓN PURA. Es el caso frecuente, el del fixture real, y
  // el único cuyas detecciones salen exactas sin tocar nada.
  if (elegidas.length === 1) {
    return normalizar(entradaDesdeTexto(texto, { ...comunes, capa: elegidas[0] }))
  }

  const pases = elegidas.map((capa) => entradaDesdeTexto(texto, { ...comunes, capa }))
  const entraron = new Set(elegidas)

  // El reparto COMPLETO del fichero. `parsers/importar.js#resolverCapas` lo
  // publica en `datos.capas` de su detección de reparto (contrato publicado, no
  // una interioridad), y es lo que permite nombrar lo que se queda fuera sin
  // volver a parsear.
  const reparto =
    pases[0].detecciones.find((d) => d?.datos?.aplicado === 'FILTRADO' && d?.datos?.capas)?.datos
      ?.capas ?? {}

  // Las partes, en el orden de las capas marcadas, RENUMERADAS: sin esto dos
  // capas darían dos «Parte 1» y la lista del panel sería indistinguible.
  const partes = pases
    .flatMap((p) => (p.edificio === null ? [] : p.edificio.partes))
    .map((parte, i) => ({ ...parte, nombre: nombreParteGenerico(i) }))

  const detecciones = []
  const vistas = new Set()
  for (const pase of pases) {
    for (const d of pase.detecciones) {
      // (a) «se importa SOLO la capa «A»» es falso en el conjunto.
      if (d?.datos?.aplicado === 'FILTRADO') continue
      // (b) una capa descartada por una pasada puede haber entrado por otra.
      if (d.tipo === TIPO_EDIFICIO.CAPA_DXF_DESCARTADA) continue
      const clave = `${d.tipo}|${d.mensaje}`
      if (vistas.has(clave)) continue
      vistas.add(clave)
      detecciones.push(d)
    }
  }

  // Y lo que de verdad se queda fuera, capa a capa y con el nombre LITERAL.
  const fuera = Object.entries(reparto).filter(([nombre]) => !entraron.has(nombre))
  const total = fuera.reduce((n, [, cuantos]) => n + cuantos, 0)
  for (const [nombre, cuantos] of fuera) {
    detecciones.push(
      crearDeteccionEdificio(
        TIPO_EDIFICIO.CAPA_DXF_DESCARTADA,
        `La capa «${nombre}» aporta ${cuantos} polilínea(s) del dibujo y NO entra como parte: se ` +
          `han pedido las capas ${elegidas.map((c) => `«${c}»`).join(', ')}. En total quedan ` +
          `fuera ${total} polilínea(s) de ${fuera.length} capa(s).`,
        SEVERIDAD.INFO,
        { capa: nombre, anillos: cuantos, capasElegidas: [...elegidas], capasFuera: fuera.length, total },
      ),
    )
  }

  const bloqueos = [...new Set(pases.flatMap((p) => p.resumen.bloqueos))]
  if (bloqueos.length === 0 && partes.length === 0) bloqueos.push(MOTIVO_ENTRADA.SIN_GEOMETRIA)

  return {
    edificio:
      bloqueos.length === 0
        ? crearEdificio({
            refcat: comunes.refcat ?? null,
            modelo: comunes.modelo ?? MODELO_EDIFICIO.SIMPLIFICADO,
            partes,
            parcelaContexto: comunes.parcelaContexto ?? null,
            // Un volcado de CAD es la MEDICIÓN del técnico, no la geometría
            // oficial del Catastro: misma decisión que `entradaDesdeTexto`.
            construccionOficial: null,
          })
        : null,
    detecciones,
    bloqueos,
  }
}

// ── Duck typing de las inyecciones ───────────────────────────────────────────

/** ¿Sirve como store? Las tres operaciones de `crearEstadoVista`, y nada más. */
const esStore = (s) =>
  !!s &&
  typeof s === 'object' &&
  typeof s.get === 'function' &&
  typeof s.set === 'function' &&
  typeof s.subscribe === 'function'

/**
 * ¿Sirve como panel de edificio? Se comprueban las TRECE cosas que este módulo le
 * pide de verdad —mismo criterio que `viewer/colindantes.js` y que el `esCliente`
 * de `app/cableado-catastro.js`—: un guardián que solo mirase `montar` dejaría
 * pasar dobles de test que revientan doscientas líneas después.
 */
const esPanelEdificio = (p) =>
  !!p &&
  typeof p === 'object' &&
  ['montar', 'fijar', 'fijarCapas', 'abrirCapas', 'cerrarCapas', 'cerrarAtributos', 'valores',
    'alAccion', 'alCerrar', 'estado', 'procedencia'].every((m) => typeof p[m] === 'function') &&
  !!p.seccionOrigen &&
  !!p.seccionPartes

// ── El cableado ──────────────────────────────────────────────────────────────

/**
 * @typedef {import('../services/catastro-edificio.js').ResultadoEdificioCatastro} ResultadoEdificioCatastro
 */

/**
 * Cablea la rama EDIFICIO entera: monta y **sella** el panel, escucha sus ocho
 * intenciones, cose las cinco vías de entrada con el segundo store, pinta las
 * huellas en el mapa y encuadra sobre ellas.
 *
 * ```js
 * const edificio = cablearEdificio({
 *   estado: estadoEdificio,          // crearEstadoVista(null) — el SEGUNDO store
 *   panel, panelEdificio, srs: 'EPSG:25830',
 *   cliente: clienteEdificio,        // services/catastro-edificio.js
 *   clienteParcela: clienteCatastro, // services/catastro.js, solo para deducir la RC
 *   mapa: visor.mapa, estadoParcela, rama,
 * })
 * // … en el paso 9 de `app/main.js`:
 * entradasExtra: [{ extensiones: EXTENSIONES, alFichero: edificio.alFichero }]
 * // … al cerrar la pantalla, y ⛔ ANTES de destruir el cliente de parcela:
 * edificio.destruir()
 * ```
 *
 * Contrato roto por el PROGRAMADOR (falta un ancla, un store que no lo es, un
 * `srs` que no es un huso soportado) → `Error`/`TypeError`/`RangeError`. Lo que
 * puede pasarle a un USUARIO —un fichero ilegible, un GML de otro tema, un
 * servicio que no contesta— **nunca lanza**: cada tramo tiene su `catch` con su
 * renglón, su mensaje en español y su detalle en consola.
 *
 * @param {object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El SEGUNDO
 *   store (contrato H): `crearEstadoVista(null)`, y su estado **ES el POJO
 *   `Edificio` o `null`**. Obligatorio y sin defecto: crearlo aquí impediría
 *   compartirlo, que es justo para lo que `app/main.js` lo crea.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos ya
 *   montado: por él sale, íntegro, lo que le pasa al dato.
 * @param {object} opciones.panelEdificio  El de
 *   `app/panel-edificio.js#crearPanelEdificio`, **ya creado y sin montar**.
 *   Obligatorio y sin defecto, por lo mismo que el `cliente` de
 *   `cablearCatastro`: crearlo aquí decidiría por el llamante el documento y el
 *   canal de avisos de una vista.
 * @param {string} opciones.srs  SRS del expediente. Se valida al cablear, no en
 *   la primera consulta.
 * @param {{edificioPorRefcat: Function}|null} [opciones.cliente=null]  El de
 *   `services/catastro-edificio.js#crearClienteEdificio`. `null` es un montaje
 *   legítimo (pantalla sin servicio) y **se dice en pantalla**: ver
 *   {@link MENSAJE_SIN_CLIENTE}. ⛔ **No se destruye aquí**: ver el apartado del
 *   orden de apagado en la cabecera.
 * @param {{refcatPorCoordenada: Function}|null} [opciones.clienteParcela=null]  El
 *   de `services/catastro.js`, **solo** para deducir la referencia desde la
 *   huella (§14.3 de la ficha). `null` ⇒ no se deduce, y se dice.
 * @param {object|null} [opciones.mapa=null]  El `L.Map` del visor. `null` ⇒ ni
 *   huellas ni encuadre, que es un montaje legítimo (una pantalla sin mapa).
 * @param {import('../viewer/_comun.js').EstadoVista|null} [opciones.estadoParcela=null]
 *   El store de PARCELA. Solo se LEE, y solo para que la parcela que hubiera en
 *   pantalla viaje como `edificio.parcelaContexto` (desviación 9 del plan):
 *   **nunca** como rama `parcela` de un expediente.
 * @param {{get: Function}|null} [opciones.rama=null]  El conmutador de
 *   `app/rama.js`, **solo** para saber con qué rama nace la pantalla y dejar las
 *   secciones nuevas con el `hidden` correcto. Si no se pasa, se lee el
 *   `data-rama` del documento; si tampoco lo hay, no se toca.
 * @param {object|null} [opciones.historial=null]  El de `edit/historial.js`, para
 *   que deshacer/rehacer alcance también a la geometría de una parte (F12 · T4.2).
 *   `null` ⇒ la edición de la parte activa funciona **sin deshacer**, que es un
 *   montaje legítimo y no se disimula.
 * @param {object|null} [opciones.barraEdicion=null]  La barra sobre el mapa
 *   (`visor.barraEdicion`), **solo** para encender la palabra «Dibujar recinto» y
 *   cambiarla a «Cancelar dibujo» mientras dura. `null` ⇒ no hay barra que tocar
 *   (montaje con `edicion:{barra:false}`, que T1.5 de F11 midió que existe), y
 *   entonces el dibujo sigue siendo alcanzable por teclado pero no por botón.
 * @param {Document} [opciones.documento=document]
 * @param {HTMLElement} [opciones.trasOrigen]  Ídem {@link ANCLA_ORIGEN}.
 * @param {HTMLElement} [opciones.trasPartes]  Ídem {@link ANCLA_PARTES}.
 * @param {Function} [opciones.crearCapa=crearCapaPartes]  Inyectable para el test.
 * @param {Function} [opciones.encuadrar=encuadrarSobreRecintos]  Ídem.
 * @param {() => Date} [opciones.ahora]  De dónde sale «ahora». Se inyecta porque
 *   la hora sale POR PANTALLA en el renglón de procedencia.
 * @returns {{alFichero: (f: File) => Promise<void>,
 *            cargar: () => Promise<ResultadoEdificioCatastro|null>,
 *            secciones: () => HTMLElement[],
 *            destruir: () => void}}
 * @throws {Error|TypeError|RangeError}
 */
export function cablearEdificio({
  estado,
  panel,
  panelEdificio,
  srs,
  cliente = null,
  clienteParcela = null,
  mapa = null,
  estadoParcela = null,
  rama = null,
  historial = null,
  barraEdicion = null,
  documento = typeof document === 'undefined' ? undefined : document,
  trasOrigen,
  trasPartes,
  crearCapa = crearCapaPartes,
  encuadrar = encuadrarSobreRecintos,
  ahora = () => new Date(),
} = {}) {
  if (!esStore(estado)) {
    throw new TypeError(
      `cablearEdificio: 'estado' debe ser el SEGUNDO store (crearEstadoVista(null), contrato H), ` +
        `con get/set/subscribe; recibido ${typeof estado}. No se crea uno por defecto a ` +
        `propósito: un store que nadie más ve no lo puede leer ni el expediente ni el guion de humo.`,
    )
  }
  if (typeof panel?.avisar !== 'function') {
    throw new TypeError(
      `cablearEdificio: 'panel' debe ser el de app/avisos.js#crearPanelAvisos (con 'avisar'); ` +
        `recibido ${typeof panel}.`,
    )
  }
  if (!esPanelEdificio(panelEdificio)) {
    throw new TypeError(
      `cablearEdificio: 'panelEdificio' debe ser el de app/panel-edificio.js#crearPanelEdificio ` +
        `(con montar, fijar, fijarCapas, abrirCapas, capasElegidas, valores, alAccion, estado, ` +
        `procedencia y raices); recibido ${typeof panelEdificio}.`,
    )
  }
  if (estadoParcela !== null && !esStore(estadoParcela)) {
    throw new TypeError(
      `cablearEdificio: 'estadoParcela' debe ser el store de parcela o null; recibido ` +
        `${typeof estadoParcela}. Solo se LEE, para que la parcela en pantalla viaje como ` +
        `edificio.parcelaContexto.`,
    )
  }
  if (typeof crearCapa !== 'function' || typeof encuadrar !== 'function') {
    throw new TypeError(
      `cablearEdificio: 'crearCapa' y 'encuadrar' deben ser funciones; recibidos ` +
        `${typeof crearCapa} y ${typeof encuadrar}.`,
    )
  }
  if (!documento || typeof documento.querySelector !== 'function') {
    throw new TypeError(
      `cablearEdificio: 'documento' debe ser un Document (o un objeto con querySelector); ` +
        `recibido ${typeof documento}.`,
    )
  }
  // Delegado: `husoPorSrs` es el único sitio del proyecto que sabe qué husos están
  // implementados y cuál está diferido (Canarias, override O13). Lanza solo.
  const huso = husoPorSrs(srs)

  const anclaOrigen = trasOrigen ?? nodo(documento, ANCLA_ORIGEN)
  const anclaPartes = trasPartes ?? nodo(documento, ANCLA_PARTES)

  let destruido = false

  /** Contador monótono de consultas: ver «las dos defensas» de `cableado-catastro`. */
  let secuencia = 0
  /** El `AbortController` de la consulta en curso, o `null`. */
  let enVuelo = null

  /** El DXF que espera a que el usuario elija capas. `null` = no hay ninguno. */
  let pendiente = null

  /** Lo que hay que escribir en el campo de la RC en el PRÓXIMO repintado. */
  let refcatPendiente = null

  /** De dónde salió lo que hay en pantalla. Se compone con el renglón permanente. */
  let procedenciaDato = ''

  /** El aviso de «esta rama no se guarda» se da UNA vez, y cuando toca. */
  let dichoAutoguardado = false

  /** Qué parte se está editando, por su índice. `null` = ninguna. F12 · T4.2. */
  let activa = null

  /**
   * Cuántos contornos se quedaron fuera de la envolvente la última vez que se
   * dijo. Sirve para decirlo **una vez por cambio** y no una por repintado.
   */
  let saltadasDichas = 0

  /**
   * ¿Tiene esta rama el mando de la edición? Lo dice {@link edicion}, y lo decide
   * `app/main.js` cruzando los dos ejes (qué rama y qué paso). Nace en `false`
   * porque la pantalla nace con la rama de parcela puesta.
   */
  let mandoMio = false

  /**
   * ⭐ **F14 · Los índices de las partes SEÑALADAS por la validación.**
   *
   * Vive aquí y no se recalcula en cada repintado a propósito: quien valida es
   * `app/cableado-edificio-gml.js` —**una sola validación por cambio del modelo**,
   * la misma que gobierna el botón «Generar GML»— y este módulo solo la pinta. Dos
   * validaciones serían dos verdades sobre el mismo edificio, y el día que una
   * divergiera el mapa señalaría una parte y el renglón hablaría de otra.
   *
   * Nace VACÍO, que es lo correcto: hasta que alguien valide no hay nada que
   * señalar, y `[]` dice exactamente eso.
   *
   * @type {number[]}
   */
  let senaladas = []

  // ── El panel: montar, SELLAR y dejarlo con la visibilidad correcta ──────────
  //
  // Ver el apartado ⛔⛔ de la cabecera. Se anota qué marcas ha puesto ESTE módulo
  // para que `destruir()` devuelva el documento a como estaba, exactamente como
  // hace `app/rama.js` con las secciones de parcela.

  panelEdificio.montar({ trasOrigen: anclaOrigen, trasPartes: anclaPartes })

  /**
   * Las `<section>` de esta rama: las que se intercambian, y nada más.
   *
   * ⛔ **Se le PREGUNTAN al panel, ya no se nombran de una en una.** Hasta F12
   * aquí había una lista literal de dos —`seccionOrigen` y `seccionPartes`—, y
   * cuando T4.1 añadió la tercera («Parte activa») esa lista se quedó corta: la
   * sección nueva nacía **sin `data-rama-panel`**, o sea fuera del intercambio, o
   * sea VISIBLE encima del panel de parcela. Y la suite entera seguía en verde,
   * porque ninguna prueba puede echar de menos una sección que no sabe que
   * existe. Con `secciones()` el panel es quien dice cuántas tiene, que es quien
   * lo sabe. La lista literal queda de respaldo para los dobles de test de F11,
   * que no tienen ese método.
   */
  const secciones = (
    typeof panelEdificio.secciones === 'function'
      ? panelEdificio.secciones()
      : [panelEdificio.seccionOrigen, panelEdificio.seccionPartes]
  ).filter((s) => !!s && s.nodeType === 1)

  /** @type {{seccion: Element, marcada: boolean}[]} */
  const marcas = []
  for (const seccion of secciones) {
    const yaMarcada = seccion.hasAttribute(ATRIBUTO_PANEL)
    marcas.push({ seccion, marcada: !yaMarcada })
    if (!yaMarcada) seccion.setAttribute(ATRIBUTO_PANEL, RAMA.EDIFICIO)
  }

  // La rama que YA está puesta. `rama.get()` si se ha inyectado el conmutador;
  // si no, el `data-rama` del documento, que es el gancho publicado (K.1). Sin
  // ninguno de los dos no se toca `hidden`: es un montaje sin conmutador y
  // esconder el panel dejaría la pantalla muda.
  const ramaActiva =
    typeof rama?.get === 'function'
      ? rama.get()
      : (documento.querySelector(`[${ATRIBUTO_RAMA}]`)?.getAttribute(ATRIBUTO_RAMA) ?? null)
  if (ramaActiva !== null) {
    for (const seccion of secciones) seccion.hidden = ramaActiva !== RAMA.EDIFICIO
  }

  // ── La capa de huellas ─────────────────────────────────────────────────────
  // ⚠️ `zona` es el HUSO (29/30/31), NO el `srs`: equivocarlo no da error, pone
  // las huellas a cientos de kilómetros y en silencio.
  const capa =
    mapa === null
      ? null
      : crearCapa({ mapa, zona: huso, alAvisar: (m, o) => panel.avisar(m, o) })

  // ══ F12 · T4.2 · EL MOTOR DE EDICIÓN DE LA PARTE ACTIVA ═══════════════════
  //
  // Aquí se estrena todo lo que las fases 1 a 3 dejaron sin llamante: el store
  // adaptador, `edit/dibujo.js`, `viewer/dibujo.js` y la envolvente derivada.
  //
  // ── ⛔ POR QUÉ HAY DOS `crearEdicion` VIVAS SOBRE EL MISMO `L.Map` ─────────
  // Porque la de parcela no se puede reutilizar: lee `estado.get().recintos` del
  // store de PARCELA. Lo que se reutiliza —entero y sin tocar— es el MOTOR, a
  // través de `edificio/parte-activa.js`, que le presenta la parte elegida con
  // forma de parcela.
  //
  // Que convivan dos costó un arreglo quirúrgico, y está MEDIDO (F12 · M4,
  // 2026-08-06): antes de él, `activa(false)` en una apagaba **los 8** marcadores
  // del mapa —los suyos y los de la otra— porque `marcadoresDeVertice()` barría
  // el mapa con `eachLayer`; y la segunda capturaba el `doubleClickZoom` ya
  // apagado, así que apagar la primera se lo devolvía al mapa mientras la otra
  // seguía editando. Las dos mitades se arreglaron en `viewer/edicion.js` y
  // `viewer/_comun.js`, con guardián y verificadas por mutación.
  //
  // ── ⛔ Y NUNCA ESTÁN LAS DOS ENCENDIDAS A LA VEZ ──────────────────────────
  // Eso NO lo decide este módulo: lo decide `app/main.js`, que es quien tiene los
  // dos ejes (qué rama y qué paso). Aquí solo se publica {@link edicion} para que
  // allí haya **un solo sitio** donde se diga quién edita — y el interruptor nace
  // APAGADO, porque el montaje ocurre con la rama de parcela puesta.

  /**
   * La parte activa vista como una parcela. Es la fachada de F12 · T3.1, y quien
   * la mueve es {@link seleccionarParte} — nunca este cableado a mano.
   */
  const vistaActiva = crearVistaParteActiva(estado, {
    // Las detecciones de `conParteRedibujada` («el recinto quedó con N vértices»)
    // salen por el mismo canal que las de todas las mutaciones. La fachada las
    // DEVUELVE en vez de aplicarlas: decidir si se avisa es de aquí.
    alDetectar: (detecciones) => publicarDetecciones(detecciones),
  })

  /** @type {object|null} La segunda edición: gestos sobre la parte activa. */
  let edicionActiva = null
  /** @type {object|null} La segunda sincronización: su tabla de coordenadas. */
  let sincronizacionActiva = null
  /** @type {object|null} El dibujo vértice a vértice de un recinto nuevo. */
  let dibujoActivo = null

  // ⚠️ El montaje entero depende de DOS cosas que pueden faltar en un montaje
  // legítimo: el mapa (una pantalla sin visor) y la caja de la tabla (un doble de
  // test de F11, que no la tiene). Sin ellas la rama sigue cargando y etiquetando
  // como en F11 —no se rompe nada—, pero no se puede editar, y eso **se dice**
  // en vez de dejar una barra que promete gestos que no ocurren.
  const tablaActiva =
    typeof panelEdificio.tablaParteActiva === 'object' ? panelEdificio.tablaParteActiva : null

  if (mapa !== null && tablaActiva !== null) {
    edicionActiva = crearEdicion({
      mapa,
      estado: vistaActiva,
      zona: huso,
      historial,
      alAvisar: (m, o) => panel.avisar(m, o),
    })
    // ⛔ APAGADA de nacimiento: `crearEdicion` nace en `true` y la pantalla nace
    // en la rama de parcela. Sin esto, los gestos de las dos ediciones estarían
    // vivos a la vez desde el primer fotograma.
    edicionActiva.activa(false)

    sincronizacionActiva = sincronizar({
      mapa,
      estado: vistaActiva,
      tablaEl: tablaActiva,
      zona: huso,
      historial,
      alAvisar: (m, o) => panel.avisar(m, o),
      // Los dos ganchos que `crearEdicion` entrega y que hay que pasar AQUÍ: no
      // hay ninguna vía para enchufarlos después (contrato de `sincronizar`).
      ajustar: edicionActiva.ajustar,
      alCrearMarcador: edicionActiva.alCrearMarcador,
      // ⚠️ `alPrevisualizar: null` a propósito. En la rama de parcela ese gancho
      // alimenta las acotaciones en vivo; aquí no hay acotaciones montadas, y
      // pasarle un gancho que no pinta nada sería pagar el coste de sesenta
      // llamadas por segundo a cambio de nada. Las cotas de la parte activa, si
      // se piden, son de otra fase.
      alPrevisualizar: null,
    })

    dibujoActivo = crearDibujo({
      mapa,
      zona: huso,
      // El MISMO enganche que la edición: el dibujo no reimplementa el snap, que
      // es lo que `edit/dibujo.js` dejó escrito al nacer.
      ajustar: edicionActiva.ajustar,
      alCerrar: (recinto) => cerrarDibujo(recinto),
      alAvisar: (m, o) => panel.avisar(m, o),
    })
  }

  // ── Los fallos, cada uno contado donde ocurre ──────────────────────────────

  /**
   * Cuenta un fallo INESPERADO por los dos canales de la casa y **no lo deja
   * subir**: casi todos estos caminos se alcanzan desde un oyente del DOM, donde
   * una excepción no llega a ninguna parte (medido en F08).
   *
   * @param {string} donde  Para la consola, no para el usuario.
   * @param {*} causa
   */
  function reventar(donde, causa) {
    panelEdificio.estado(MENSAJE_FALLO_INESPERADO)
    panel.avisar(MENSAJE_FALLO_INESPERADO, { nivel: NIVEL.ERROR, causa })
    console.error(`[edificio] ${donde}:`, causa)
  }

  /**
   * Publica al panel de avisos lo que le ha pasado al DATO. Solo `AVISO` y
   * `ERROR`: las `INFO` de estas capas son el diario de decisiones del parser
   * —huso detectado, separador de polígono, reparto por capas— y mandarlas todas
   * al panel lo convertiría en un registro que nadie lee. **No se pierden**: se
   * cuentan en el renglón, que es donde el usuario mira después de una acción.
   *
   * @param {readonly {mensaje: string, severidad: string}[]} detecciones
   * @returns {number}  Cuántas notas informativas quedaron sin publicar.
   */
  function publicarDetecciones(detecciones) {
    let informativas = 0
    for (const d of detecciones) {
      if (d.severidad === SEVERIDAD.ERROR) panel.avisar(d.mensaje, { nivel: NIVEL.ERROR })
      else if (d.severidad === SEVERIDAD.AVISO) panel.avisar(d.mensaje, { nivel: NIVEL.AVISO })
      else informativas += 1
    }
    return informativas
  }

  // ── Escritura en el panel ──────────────────────────────────────────────────

  /**
   * El renglón de procedencia, que dice DOS cosas y las dice siempre en el mismo
   * orden: de dónde salió el dato (si salió de algún sitio) y que esta rama no se
   * guarda. La segunda mitad es permanente porque es una propiedad de esta
   * versión, no un suceso.
   *
   * ⛔ **La segunda mitad va en su forma BREVE** desde el 2026-08-04, y no es un
   * recorte de honradez: la versión entera se seguía diciendo —entera— por el
   * panel de avisos en cuanto había algo que perder, así que aquí se estaba
   * repitiendo palabra por palabra. Ver {@link MENSAJE_SIN_AUTOGUARDADO_BREVE},
   * donde están los 89,06 px que costaba la repetición y el panel al que le
   * faltaban 32,70.
   */
  function escribirProcedencia() {
    panelEdificio.procedencia(
      procedenciaDato === ''
        ? MENSAJE_SIN_AUTOGUARDADO_BREVE
        : `${procedenciaDato} ${MENSAJE_SIN_AUTOGUARDADO_BREVE}`,
    )
  }

  /**
   * Repinta el panel y el mapa desde el store. Es el SUSCRIPTOR del segundo
   * store, así que corre en cada `set` — incluidas las mutaciones (renombrar,
   * atributos, modelo).
   *
   * ⚠️ **`refcat` solo viaja cuando hay uno PENDIENTE.** `fijar` documenta que si
   * se omite no toca el campo, y eso es exactamente lo que hace falta: un
   * repintado no puede borrarle al usuario la referencia que está tecleando.
   *
   * @param {object|null} edificio
   */
  function repintar(edificio) {
    if (destruido) return
    const entrada = {
      edificio,
      // «Traer del Catastro» sigue la doctrina de la otra rama: disponible en
      // reposo siempre que haya con quién hablar. El campo vacío o mal escrito lo
      // resuelve el cliente con `ENTRADA_INVALIDA` sin tocar la red, y un botón
      // apagado sin motivo al lado es lo que no se admite.
      puedeConsultarCatastro: cliente !== null,
    }
    if (refcatPendiente !== null) {
      entrada.refcat = refcatPendiente
      refcatPendiente = null
    }

    // ── F12 · T4.2 · La parte activa, la envolvente y las dos medidas ────────
    //
    // ⚠️ El índice se REVALIDA contra la lista de ahora antes de nada: eliminar
    // la parte 2 de tres deja el índice 2 fuera de rango, y un adaptador
    // apuntando a una parte que ya no existe editaría el aire.
    const partes = edificio === null || !Array.isArray(edificio.partes) ? [] : edificio.partes
    if (activa !== null && activa >= partes.length) seleccionarParte(null)
    entrada.activa = activa

    panelEdificio.fijar(entrada)
    if (cliente === null) panelEdificio.estado(MENSAJE_SIN_CLIENTE)

    // La envolvente se DERIVA en cada repintado, no se guarda. Es el criterio de
    // aceptación 3 de la ficha, y su forma comprobable: cambiar las plantas de
    // una parte la recalcula porque el criterio de «sobre rasante» se evalúa aquí
    // mismo, sobre el edificio que acaba de entrar.
    const derivada = partes.length === 0 ? null : envolventeDe(partes)
    capa?.pintar(edificio === null ? null : partes, {
      activa,
      envolvente: derivada === null ? null : derivada.recintos,
      // ⭐ F14 · El resalte por parte. Ver {@link resaltar}, donde está por qué el
      // índice se filtra contra la lista de AHORA.
      senaladas,
    })
    avisarSaltadas(derivada?.saltados?.length ?? 0)

    panelEdificio.medidas({
      activa: textoSuperficie(vistaActiva.get()?.recintos ?? null),
      huella: textoHuella(derivada),
    })
    escribirProcedencia()
  }

  /**
   * Cuántos metros cuadrados mide una geometría, redactados.
   *
   * ⛔ **La cifra la calcula `edit/metricas.js`, que es quien mide en toda la
   * aplicación**, y no una suma escrita aquí: dos implementaciones del área son
   * dos maneras de redondear el mismo número, y un informe firmable no se lo
   * puede permitir. Este módulo solo pone las palabras.
   *
   * @param {Array|null} recintos
   * @returns {string}  {@link SIN_MEDIDA_EDIFICIO} si no hay nada que medir.
   */
  function textoSuperficie(recintos) {
    if (!Array.isArray(recintos) || recintos.length === 0) return SIN_MEDIDA_EDIFICIO
    try {
      return `${formatearM2(metricas(recintos).superficie)} m²`
    } catch (causa) {
      // No se deja subir: esto corre dentro de un repintado, que a su vez corre
      // dentro de un oyente del store. Y no se inventa una cifra (regla 9).
      console.error('[edificio] la superficie de la parte activa ha fallado:', causa)
      return SIN_MEDIDA_EDIFICIO
    }
  }

  /**
   * La suma de huella sobre rasante, redactada — **y con lo que se ha quedado
   * fuera, si es que ha quedado algo**.
   *
   * ⚠️ Decirlo importa, y lo midió la fase 0: en el fixture real de trece partes
   * la MAYOR (245,90 m² contra 126,87) tiene 0 plantas sobre rasante, o sea que es
   * un sótano, o sea que la envolvente **excluye la parte más grande** y baja de
   * 568,03 a 322,13 m² (−43,3 %). Un número que se come el 43 % del edificio sin
   * decir por qué es un número que nadie va a poder defender.
   *
   * ⛔ **Se mide PIEZA A PIEZA y se suma, jamás de una pasada.** `envolventeDe`
   * devuelve un array de PIEZAS y cada pieza es una lista de recintos; el
   * invariante de `edit/metricas.js` es que `recintos[0]` es el EXTERIOR y el
   * resto HUECOS, así que aplanar dos piezas haría que el exterior de la segunda
   * se leyera como un hueco de la primera **y se restara**. Dos cuerpos separados
   * de 100 m² darían 0. Lo destapó una prueba de T4.2, no un usuario.
   *
   * @param {{recintos: Array<Array>, excluidas: Array}|null} derivada
   * @returns {string}
   */
  function textoHuella(derivada) {
    if (derivada === null || derivada.recintos.length === 0) return ''
    let m2 = 0
    try {
      for (const pieza of derivada.recintos) m2 += metricas(pieza).superficie
    } catch (causa) {
      console.error('[edificio] la superficie de la envolvente ha fallado:', causa)
      return ''
    }
    const fuera = derivada.excluidas.length
    return (
      `${formatearM2(m2)} m² de huella` +
      (fuera === 0 ? '' : ` · ${fuera} parte${fuera === 1 ? '' : 's'} fuera`)
    )
  }

  /**
   * Dice, UNA vez por cambio, cuántos contornos no entraron en la envolvente.
   *
   * `repintar` corre en cada `set` del store y arrastrar un vértice son sesenta
   * por segundo: avisar en todos convertiría el panel de avisos en un contador.
   * Y callarlo del todo sería peor — la línea que se dibuja rodearía menos
   * edificio del que hay, sin decirlo (regla de oro 1).
   *
   * @param {number} n
   */
  function avisarSaltadas(n) {
    if (n === saltadasDichas) return
    saltadasDichas = n
    if (n > 0) panel.avisar(mensajeEnvolventeSaltada(n), { nivel: NIVEL.AVISO })
  }

  /**
   * Elige la parte que se edita — **en los DOS sitios a la vez**, que es todo el
   * asunto de esta función: el índice que pinta el panel y el que proyecta el
   * adaptador tienen que ser el mismo, siempre. Dos fuentes de «cuál es la parte
   * activa» es exactamente la clase de estado duplicado que el rework de UI
   * existió para quitar.
   *
   * Un índice que no cae dentro de la lista se trata como `null` **sin lanzar**:
   * es lo que pasa al eliminar la parte que estaba puesta, y eso es un uso normal.
   *
   * @param {number|null} i
   * @returns {number|null}  Lo que ha quedado elegido de verdad.
   */
  function seleccionarParte(i) {
    const edificio = estado.get()
    const partes = Array.isArray(edificio?.partes) ? edificio.partes : []
    const valido = Number.isInteger(i) && i >= 0 && i < partes.length ? i : null
    activa = valido
    vistaActiva.seleccionar(valido)
    // El dibujo en curso es de UNA parte: cambiar de parte lo cancela, o el
    // recinto acabaría en la que no era. `cancelar` es idempotente.
    if (dibujoActivo?.dibujando()) cancelarDibujo()
    refrescarBarra()
    return valido
  }

  /**
   * Pone la palabra «Dibujar recinto» de la barra acorde con lo que se puede
   * hacer ahora mismo.
   *
   * ⚠️ Se ESCONDE, no se apaga, y es la decisión de T3.5: un botón gris
   * permanente cuyo motivo hable de otra rama dice menos que su ausencia. Aparece
   * cuando hay una parte elegida y esta rama tiene el mando.
   */
  function refrescarBarra() {
    if (barraEdicion === null) return
    const puede = mandoMio && activa !== null && dibujoActivo !== null
    barraEdicion.dibujoVisible?.(puede)
    barraEdicion.dibujoEnCurso?.(dibujoActivo?.dibujando() === true)
  }

  /**
   * El usuario ha cerrado un recinto dibujado. Entra por
   * `conParteRedibujada` a través del adaptador —que es quien reconstruye el
   * `Edificio`—, así que el recorrido es el mismo que el de arrastrar un vértice
   * y el historial lo ve igual.
   *
   * @param {{vertices: Array<[number, number]>, tipo?: string}} recinto
   */
  function cerrarDibujo(recinto) {
    if (destruido) return
    if (activa === null) {
      // No debería llegar —la palabra solo aparece con una parte elegida—, pero
      // si llega, tirar el recinto en silencio sería perder el trabajo de treinta
      // clics sin decir nada.
      panelEdificio.estadoParteActiva(MENSAJE_DIBUJO_SIN_PARTE)
      refrescarBarra()
      return
    }
    const anterior = vistaActiva.get()
    vistaActiva.set({ ...(anterior ?? {}), recintos: [recinto] })
    refrescarBarra()
  }

  /** Cancela el dibujo en curso y deja la barra diciendo la verdad. */
  function cancelarDibujo() {
    dibujoActivo?.cancelar()
    refrescarBarra()
  }

  /**
   * Encuadra el mapa sobre las huellas. Ver el apartado del encuadre en la
   * cabecera: `visor.encuadrar()` **no sirve** aquí.
   *
   * @param {object} edificio
   * @returns {boolean}  `false` si no había ni un vértice, y entonces la vista no
   *   se ha tocado.
   */
  function encuadrarSobre(edificio) {
    if (mapa === null) return false
    return encuadrar({
      mapa,
      recintos: recintosDe(edificio),
      // ⚠️ el HUSO, no el srs.
      zona: huso,
      alAvisar: (m, o) => panel.avisar(m, o),
      // ⭐ Y este es el primer llamante que puede ver ese aviso: ver la cabecera.
      sujeto: SUJETO_ENCUADRE,
    })
  }

  /** Los recintos de la parcela que hubiera en pantalla (desviación 9). */
  function parcelaContexto() {
    const parcela = estadoParcela === null ? null : estadoParcela.get()
    const recintos = parcela === null || parcela === undefined ? null : parcela.recintos
    return Array.isArray(recintos) && recintos.length > 0 ? recintos : null
  }

  /**
   * Con qué nombre entra un documento en esta rama (F12 · T4.3).
   *
   * **Es el mismo último recurso que la rama de parcela**, no un criterio nuevo:
   * `app/cableado-medicion.js#componerParcelaMedida` usa el nombre del fichero y
   * `parsers/importar.js` cae en `'parcela-importada'` cuando no consta ninguno.
   * Aquí el nombre es el del fichero, el de la referencia catastral cuando viene del
   * Catastro, o «coordenadas pegadas» cuando viene del pegado — que es lo único que
   * consta en cada caso, y nada de eso está inventado.
   *
   * ⚠️ El respaldo NO es adorno: `crearEdificio` **lanza** con un texto en blanco, y
   * lanzar aquí convertiría un fichero con nombre raro en un fallo interno.
   *
   * @param {*} texto
   * @returns {string}
   */
  const idLocalDe = (texto) => textoNoVacio(texto) ?? IDENTIDAD_SIN_NOMBRE

  /**
   * Las opciones comunes de las cinco fábricas de entrada.
   *
   * `refcat` sale del CAMPO: quien haya escrito una referencia antes de soltar el
   * dibujo espera que el edificio la lleve. Es dato del usuario, así que no se
   * normaliza aquí (`conRefcat` de T1.3 dejó escrito por qué: corregir por su
   * cuenta lo que alguien tecleó es la regla de oro 1 al revés).
   *
   * ⚠️ **`idLocal` NO va aquí, y es a propósito**: lo estampa {@link aplicar}, que es
   * el único sitio por el que entra un documento nuevo. Ver el comentario de allí.
   */
  function comunes() {
    return {
      modelo: panelEdificio.valores().modelo,
      refcat: textoNoVacio(panelEdificio.valores().refcat),
      parcelaContexto: parcelaContexto(),
    }
  }

  /**
   * Mete en el store lo que ha producido una vía de entrada, o cuenta por qué no.
   * **Es el único sitio de este módulo que llama a `estado.set` con un documento
   * nuevo**, y el único que encuadra.
   *
   * @param {EntradaNormalizada} entrada
   * @param {string} rotulo  De dónde viene, para el renglón («el fichero X», «el
   *   Catastro»). Va en la frase, así que se escribe en minúscula.
   * @param {string} procedencia  Qué escribir en el renglón de procedencia. **Solo
   *   se aplica si el edificio ENTRA**: si no entra, el store sigue con lo que
   *   tuviera y su procedencia sigue siendo la de antes. Pisarla sería mentir
   *   sobre de dónde salió lo que se está viendo.
   * @param {string} identidad  Con qué nombre entra este documento. Ver
   *   {@link idLocalDe}: es lo que permite distinguir «otro edificio» de «una
   *   edición del mismo», y sin ello no hay autoguardado posible (F12 · T4.3).
   * @returns {boolean}  `true` si el edificio ha entrado en el store.
   */
  function aplicar(entrada, rotulo, procedencia, identidad) {
    const informativas = publicarDetecciones(entrada.detecciones)
    const cola = informativas === 0 ? '' : ` ${informativas} nota(s) más en el detalle del fichero.`

    if (entrada.edificio === null) {
      // ⚠️ No se toca el store: medio edificio es peor que ninguno, porque se
      // dibuja y parece bueno.
      const motivos = entrada.bloqueos
        .map((b) => RESUMEN_POR_BLOQUEO[b] ?? RESUMEN_DESCONOCIDO)
        .join(' ')
      panelEdificio.estado(
        `No se han cargado partes de ${rotulo}. ${motivos === '' ? RESUMEN_DESCONOCIDO : motivos} ` +
          COLA_DETALLE,
      )
      return false
    }

    // El aviso de lo que esta rama NO archiva, UNA vez y cuando pasa a haber algo
    // que perder. Ya no dice «no se guarda sola» —desde T4.3 se guarda—: dice lo que
    // sigue sin poderse hacer, que es archivarlo como expediente con nombre.
    if (!dichoAutoguardado) {
      dichoAutoguardado = true
      panel.avisar(MENSAJE_SIN_AUTOGUARDADO, { nivel: NIVEL.AVISO })
    }

    // ⛔ LA IDENTIDAD SE ESTAMPA AQUÍ, y aquí es el único sitio (T4.3). Éste es el
    // único punto del módulo por el que un documento NUEVO entra en el store, así
    // que es donde se sabe que lo es. Estamparla en las cinco fábricas de entrada
    // habría sido pasar el nombre del fichero por una capa pura que no lo necesita
    // para nada más — y dejar `entradaPorCapas`, que compone su propio `Edificio`,
    // como el sexto sitio que hay que acordarse de tocar.
    const conNombre = conIdLocal(entrada.edificio, identidad).edificio

    procedenciaDato = procedencia
    refcatPendiente = conNombre.refcat ?? ''
    estado.set(conNombre)
    encuadrarSobre(conNombre)

    const n = conNombre.partes.length
    const vertices = conNombre.partes.reduce(
      (total, p) => total + (p.recinto?.vertices?.length ?? 0),
      0,
    )
    panelEdificio.estado(
      `Cargad${n === 1 ? 'a' : 'as'} ${n} parte${n === 1 ? '' : 's'} de ${rotulo}: ` +
        `${vertices} vértices en total.${cola}`,
    )

    // ── ⭐ F14 · EL COTEJO DE SUPERFICIE, TAMBIÉN EN ESTA RAMA (deuda de F19) ──
    //
    // **EL ÚLTIMO EN EMITIRSE PARA QUEDAR EL PRIMERO EN LEERSE.** El panel ordena
    // el más reciente arriba y enseña 12 tarjetas como mucho (regla de diseño 6),
    // así que si el dibujo declara una superficie y no es la que ha entrado, eso es
    // LA cosa que hay que leer. Es literalmente el mismo razonamiento —y el mismo
    // sitio dentro de la función— que `app/cableado-medicion.js` en la otra rama.
    //
    // ⚠️ **Se REUTILIZA `avisoDeSuperficie` y no se reescribe.** Aquel texto nació
    // de un caso real del 2026-08-06 (una LISTA copiada a medias: 168,59 m² donde
    // el dibujo decía 276,50) y lleva dentro la sospecha por el signo de la
    // diferencia. Dos redacciones del mismo aviso divergirían, y la de aquí sería
    // la peor porque este camino se usa menos.
    const cotejo = avisoDeSuperficie(entrada.resumen?.superficie ?? null)
    if (cotejo !== null) panel.avisar(cotejo, { nivel: NIVEL.AVISO })
    return true
  }

  // ── 1 · Del fichero al store ───────────────────────────────────────────────

  /**
   * Lee un `File` y lo mete en la rama. **Enruta por CONTENIDO, no por
   * extensión** (ver la cabecera): un texto que empieza por `<` va al lector de
   * GML de edificio y todo lo demás al de volcados, que ya autodetecta DXF, LIST
   * y TXT. Así un GML guardado como `.txt` entra bien y un DXF renombrado a
   * `.gml` también.
   *
   * **No lanza nunca**: cada tramo tiene su `catch` con su mensaje.
   *
   * @param {File} fichero
   * @returns {Promise<void>}
   */
  async function alFichero(fichero) {
    if (destruido) return
    const nombre = textoNoVacio(fichero?.name) ?? 'fichero sin nombre'

    /** @type {ArrayBuffer} */
    let crudo
    try {
      crudo = await fichero.arrayBuffer()
    } catch (causa) {
      panel.avisar(MENSAJE_FICHERO_NO_LEIDO, { nivel: NIVEL.ERROR, causa })
      console.error(`[edificio] no se han podido leer los bytes de «${nombre}»:`, causa)
      return
    }
    if (destruido) return

    let texto
    let deteccionesTexto = []
    try {
      // ⚠️ `new Uint8Array(...)` y no el búfer a pelo: la vista se construye con
      // el `Uint8Array` de ESTE realm, que es el mismo del `instanceof` de
      // `gml/decodificar.js#aBytes`. Uno de otro realm —jsdom, un iframe— haría
      // lanzar a aquella función. Está medido en F08.
      const datos = new Uint8Array(crudo)
      // ⚠️ Los cinco ficheros BU reales declaran `ISO-8859-1` en su prólogo y
      // mienten: `entradaDesdeGmlBu` espera el XML YA DECODIFICADO, y decidir el
      // encoding por PRUEBA es de este módulo, igual que en la comprobación.
      ;({ texto, detecciones: deteccionesTexto } = decodificarGml(datos))
    } catch (causa) {
      reventar(`la lectura de «${nombre}» ha fallado`, causa)
      return
    }

    alTexto(texto, nombre, deteccionesTexto)
  }

  /**
   * Un volcado YA EN TEXTO con la rama EDIFICIO puesta: de un fichero (arriba) o
   * del pegado de coordenadas (F19, `app/dialogo-pegado.js`).
   *
   * ⚠️ **La rama decide, y por eso el pegado también entra por aquí**: el mismo
   * gesto que con PARCELA carga una medición, con EDIFICIO carga partes. Que un
   * gesto valga en una rama y no en la otra es la asimetría que F11 dejó «cerrada
   * a medias» y que F18 borró para el fichero; F19 no la vuelve a abrir.
   *
   * **No lanza nunca.**
   *
   * @param {string} texto
   * @param {string} [nombre]
   * @param {Array<object>} [deteccionesTexto]  Las de la decodificación, si venía
   *   de un fichero. Un pegado ya es texto y no tiene ninguna.
   * @param {boolean} [deFichero=true]  Solo cambia CÓMO SE NOMBRA la procedencia:
   *   llamar «fichero» a lo que el usuario acaba de pegar es una afirmación falsa
   *   sobre el origen del dato, que es justo lo que este renglón existe para decir.
   * @returns {void}
   */
  function alTexto(texto, nombre = 'coordenadas pegadas', deteccionesTexto = [], deFichero = true) {
    if (destruido) return
    const deDonde = deFichero ? `Del fichero «${nombre}»` : `De ${nombre}`
    try {
      if (pareceXml(texto)) {
        const entrada = normalizar(entradaDesdeGmlBu(texto, comunes()))
        entrada.detecciones = [...deteccionesTexto, ...entrada.detecciones]
        aplicar(
          entrada,
          `«${nombre}»`,
          deFichero
            ? `Del GML de edificio «${nombre}», leído en esta pantalla.`
            : 'Del GML de edificio pegado en esta pantalla.',
          idLocalDe(nombre),
        )
        return
      }

      // Una primera pasada SIN capa: es lo que dice qué formato es (contrato D,
      // `resumen.via`) y cuál es el reparto. Para LIST, TXT y un DXF de una sola
      // capa vale ya como resultado; para un DXF de varias se descarta y se
      // pregunta, que es la decisión 5 de la fase.
      const previa = entradaDesdeTexto(texto, comunes())
      const capas = previa.resumen.via === VIA.DXF ? (previa.resumen.capas ?? []) : []
      const reparto = repartoDeCapas(capas)

      if (reparto.length > 1) {
        pendiente = { texto, nombre, detecciones: deteccionesTexto }
        panelEdificio.fijarCapas(reparto)
        panelEdificio.abrirCapas()
        panelEdificio.estado(MENSAJE_ELIGE_CAPAS)
        return
      }

      const entrada = normalizar(previa)
      entrada.detecciones = [...deteccionesTexto, ...entrada.detecciones]
      aplicar(entrada, `«${nombre}»`, `${deDonde}, medido por el técnico.`, idLocalDe(nombre))
    } catch (causa) {
      pendiente = null
      reventar(`la lectura de «${nombre}» ha fallado`, causa)
    }
  }

  /**
   * «Cargar las partes» del diálogo de reparto. Ver el apartado de las capas en
   * la cabecera: aquí es donde N capas marcadas se convierten en un solo
   * `Edificio`.
   *
   * @param {readonly string[]} elegidas
   */
  function aplicarCapas(elegidas) {
    if (destruido || pendiente === null) return
    const { texto, nombre, detecciones } = pendiente
    try {
      const entrada = entradaPorCapas(texto, elegidas, comunes())
      entrada.detecciones = [...detecciones, ...entrada.detecciones]
      panelEdificio.cerrarCapas()
      pendiente = null
      aplicar(
        entrada,
        `«${nombre}»`,
        `Del fichero «${nombre}», medido por el técnico · capas ${elegidas.map((c) => `«${c}»`).join(', ')}.`,
        idLocalDe(nombre),
      )
    } catch (causa) {
      pendiente = null
      panelEdificio.cerrarCapas()
      reventar(`el reparto por capas de «${nombre}» ha fallado`, causa)
    }
  }

  // ── 2 · Del Catastro al store ──────────────────────────────────────────────

  /**
   * Envuelve UNA consulta con las dos defensas de la casa: `AbortController`
   * (corta la red) y token de secuencia (impide ESCRIBIR). Hacen falta las dos:
   * abortar no impide que una respuesta ya en vuelo llegue TARDE y pise el store
   * con un edificio que el usuario ya no pidió.
   *
   * @param {(senal: AbortSignal) => Promise<ResultadoEdificioCatastro>} consultar
   * @returns {Promise<{resultado: ResultadoEdificioCatastro, vigente: boolean}>}
   */
  async function operar(consultar) {
    if (enVuelo !== null) enVuelo.abort()
    const controlador = new AbortController()
    enVuelo = controlador
    const token = ++secuencia
    try {
      const resultado = await consultar(controlador.signal)
      return { resultado, vigente: token === secuencia }
    } finally {
      if (enVuelo === controlador) enVuelo = null
    }
  }

  /**
   * Reparto de superficies para un resultado que NO trae dato: el mensaje ÍNTEGRO
   * del cliente al panel —con su nivel, que sale de `NIVEL_POR_MOTIVO` y nunca de
   * una clasificación inventada aquí— y el RESUMEN al renglón.
   *
   * ⛔ Se publica `resultado.mensaje` y no lo que dijo el transporte: ver el
   * apartado del 404 mudo en la cabecera.
   *
   * @param {ResultadoEdificioCatastro} resultado
   */
  function contarFallo(resultado) {
    panel.avisar(resultado.mensaje, { nivel: NIVEL_POR_MOTIVO[resultado.motivo] ?? NIVEL.AVISO })
    panelEdificio.estado(
      `${RESUMEN_POR_MOTIVO[resultado.motivo] ?? RESUMEN_DESCONOCIDO} ${COLA_DETALLE}`,
    )
  }

  /**
   * La referencia con la que consultar: la escrita en el campo, o la DEDUCIDA de
   * la huella. `null` si no hay ninguna de las dos, y entonces ya se ha dicho por
   * qué.
   *
   * ⛔ La deducción NO usa el centroide: `puntoDeReferencia` va al punto
   * estrictamente interior de la parte de MAYOR superficie, porque el centroide
   * aritmético de una figura en L cae fuera del polígono y el Catastro contestaría
   * tan tranquilo con la referencia de la parcela vecina, en silencio.
   *
   * @returns {Promise<string|null>}
   */
  async function referenciaAConsultar() {
    const escrita = textoNoVacio(panelEdificio.valores().refcat)
    if (escrita !== null) return escrita

    const edificio = estado.get()
    if (!tieneGeometria(edificio)) {
      panel.avisar(MENSAJE_SIN_REFERENCIA, { nivel: NIVEL.AVISO })
      panelEdificio.estado(`No se ha consultado nada. ${COLA_DETALLE}`)
      return null
    }
    if (clienteParcela === null || typeof clienteParcela.refcatPorCoordenada !== 'function') {
      panel.avisar(MENSAJE_SIN_DEDUCCION, { nivel: NIVEL.AVISO })
      panelEdificio.estado(`No se ha consultado nada. ${COLA_DETALLE}`)
      return null
    }

    const punto = puntoDeReferencia(edificio)
    if (punto === null) {
      panel.avisar(MENSAJE_SIN_PUNTO_INTERIOR, { nivel: NIVEL.AVISO })
      panelEdificio.estado(`No se ha podido deducir la referencia. ${COLA_DETALLE}`)
      return null
    }

    const { resultado, vigente } = await operar((senal) =>
      clienteParcela.refcatPorCoordenada(punto[0], punto[1], { srs, senal }),
    )
    if (!vigente || destruido) return null
    if (!resultado.ok) {
      contarFallo(resultado)
      return null
    }
    const { candidatos, unico } = resultado.datos
    if (!unico) {
      panel.avisar(mensajeVariosCandidatos(candidatos), { nivel: NIVEL.AVISO })
      panelEdificio.estado(`No se ha rellenado ninguna referencia. ${COLA_DETALLE}`)
      return null
    }
    // El campo se rellena con lo deducido ANTES de consultar: si la segunda
    // consulta falla, el usuario se queda al menos con la referencia en pantalla.
    refcatPendiente = candidatos[0].refcat
    repintar(estado.get())
    return candidatos[0].refcat
  }

  /**
   * Trae el edificio oficial de la referencia que haya (escrita o deducida) y lo
   * mete en el store. Cuesta 2 peticiones, o 1 si la referencia no existe, o 0
   * desde la caché — la cuenta exacta viaja en `resultado.procedencia`.
   *
   * ⚠️ **`ok: true` con `datos.sinConstrucciones` NO es un fallo**: es la parcela
   * que existe y no tiene nada construido, o sea el punto de partida de una obra
   * nueva. Sale como bloqueo `SIN_CONSTRUCCION` de la entrada y se cuenta con esas
   * palabras.
   *
   * @returns {Promise<ResultadoEdificioCatastro|null>}
   */
  async function cargar() {
    if (destruido) return null
    if (cliente === null) {
      panel.avisar(MENSAJE_SIN_CLIENTE, { nivel: NIVEL.AVISO })
      panelEdificio.estado(MENSAJE_SIN_CLIENTE)
      return null
    }

    try {
      const refcat = await referenciaAConsultar()
      if (refcat === null || destruido) return null

      const { resultado, vigente } = await operar((senal) =>
        cliente.edificioPorRefcat(refcat, { srs, senal }),
      )
      if (destruido) return null
      if (!vigente) {
        // Una consulta SUPERADA no escribe nada y no se anuncia: avisar de algo
        // que el propio usuario ha sustituido es ruido sobre lo que ya sabe.
        return { ...resultado, ok: false, datos: null, motivo: MOTIVO_CATASTRO.CANCELADA, mensaje: MENSAJE_SUPERADA }
      }
      if (!resultado.ok) {
        contarFallo(resultado)
        return resultado
      }

      const datos = resultado.datos
      // ⛔ `datos.srs` puede ser `null` en un resultado BUENO (la colección vacía
      // lo devuelve así), así que solo se compara cuando la respuesta trae uno.
      if (datos.srs !== null && datos.srs !== srs) {
        const estorbo =
          `El Catastro ha devuelto la geometría en ${datos.srs} y este expediente trabaja en ` +
          `${srs}. No se carga: mezclar dos sistemas de referencia colocaría el edificio a ` +
          `kilómetros de donde está, y sin dar ningún error.`
        panel.avisar(estorbo, { nivel: NIVEL.AVISO })
        panelEdificio.estado(`No se ha cargado el edificio. ${COLA_DETALLE}`)
        return resultado
      }

      const entrada = normalizar(
        entradaDesdeWfsBu(datos, {
          ...comunes(),
          // La RC la manda quien la pidió, y en su forma CANÓNICA: «9398516 vk3799g»
          // y «9398516VK3799G» son la misma parcela, y dejar en pantalla una forma
          // distinta de la que hay en el modelo invita a dudar de cuál se ha cargado.
          refcat: normalizarRefcat(refcat) ?? refcat,
        }),
      )
      const procedencia = textoProcedencia(resultado.procedencia, ahora())
      // La identidad es la RC canónica, no el nombre de ningún fichero: es lo que
      // consta, y es la misma con la que la rama de parcela nombra lo que trae del
      // Catastro. Se coge de lo que el edificio LLEVA —ya normalizado arriba—, no de
      // lo que se tecleó, para que las dos digan lo mismo.
      aplicar(entrada, 'el Catastro', procedencia, idLocalDe(entrada.edificio?.refcat ?? refcat))

      if (resultado.procedencia.origen === ORIGEN.CACHE) {
        // Al panel además del renglón de procedencia: ese renglón es gris de 11 px
        // y trabajar sobre una copia local de hace semanas conviene que salte a la
        // vista. Mismo criterio que la rama de parcela.
        panel.avisar(
          `El edificio de ${refcat} no se ha traído del Catastro: sale de la copia local de esta ` +
            `aplicación (${procedencia}). Si el Catastro lo ha rectificado desde entonces, esto ` +
            `no lo refleja.`,
          { nivel: NIVEL.AVISO },
        )
      }
      return resultado
    } catch (causa) {
      reventar('la consulta al servicio de edificios ha fallado', causa)
      return null
    }
  }

  // ── 3 · Las intenciones del panel ──────────────────────────────────────────

  /**
   * Aplica una mutación de `edificio/mutaciones.js` al store. Las cuatro
   * devuelven **`{edificio, detecciones}`, no un `Edificio` pelado**, y las
   * detecciones son justo lo que hay que enseñar: `conModelo` lleva la lista de
   * los siete atributos que se pierden al pasar a SIMPLIFICADO.
   *
   * @param {(edificio: object) => {edificio: object, detecciones: Array}} mutacion
   * @param {string} donde  Para la consola.
   */
  function aplicarMutacion(mutacion, donde) {
    const edificio = estado.get()
    if (edificio === null) return
    try {
      const { edificio: nuevo, detecciones } = mutacion(edificio)
      estado.set(nuevo)
      publicarDetecciones(detecciones)
    } catch (causa) {
      reventar(donde, causa)
    }
  }

  /**
   * El único oyente del panel. Ocho intenciones, y **tres no llegan nunca**:
   * `ABRIR_ATRIBUTOS`, `CANCELAR_ATRIBUTOS` y `CANCELAR_CAPAS` las atiende el
   * propio panel abriendo o cerrando su `<dialog>` y no las emite. Se dejan sin
   * rama a propósito, y el `else` final lo dice.
   *
   * @param {{accion: string, indice: number|null, nombre: string|null,
   *          capas: string[]|null, atributos: object|null,
   *          valores: {modelo: string, refcat: string|null}}} intencion
   */
  function atender({ accion, indice, nombre, capas, atributos, tipo, plantas, valores }) {
    if (destruido) return

    if (accion === ACCION.CARGAR_CATASTRO) {
      // La promesa se suelta a propósito: `cargar` no lanza y cuenta por el panel
      // todo lo que decide. Es la lección de F08 entera.
      void cargar()
      return
    }
    if (accion === ACCION.APLICAR_CAPAS) {
      aplicarCapas(capas ?? [])
      return
    }
    if (accion === ACCION.CAMBIAR_MODELO) {
      // Sin edificio no hay nada que mutar: el modelo elegido lo lee `comunes()`
      // del propio panel cuando entre el primero, que es lo que la ficha describe
      // (elegir el modelo ANTES de cargar nada).
      aplicarMutacion((e) => conModelo(e, valores.modelo), 'el cambio de modelo ha fallado')
      return
    }
    if (accion === ACCION.RENOMBRAR_PARTE) {
      aplicarMutacion(
        (e) => conParteRenombrada(e, indice, nombre ?? ''),
        `el renombrado de la parte ${indice} ha fallado`,
      )
      return
    }
    if (accion === ACCION.APLICAR_ATRIBUTOS) {
      aplicarMutacion(
        (e) => conAtributos(e, atributos ?? {}),
        'la escritura de los atributos ha fallado',
      )
      panelEdificio.cerrarAtributos()
      return
    }

    // ── F12 · T4.2 · las cinco de la parte activa ────────────────────────────

    if (accion === ACCION.SELECCIONAR_PARTE) {
      seleccionarParte(indice)
      // Se repinta a mano: elegir no muta el `Edificio`, así que el store no
      // notifica y sin esto el panel se quedaría con la fila anterior marcada.
      repintar(estado.get())
      return
    }
    if (accion === ACCION.ANADIR_PARTE) {
      // ⛔ Sin edificio NO se sale por la puerta de atrás, al revés que las
      // mutaciones de arriba: «Añadir parte» es la vía por la que se empieza un
      // edificio DESDE CERO —el caso del encargo real: declarar el porche que no
      // estaba— y exigir que ya hubiera uno cargado la dejaría muerta justo
      // cuando hace falta. Se crea el edificio vacío con el modelo que el panel
      // tiene elegido, que es la misma doctrina que `comunes()`.
      //
      // Y nace CON IDENTIDAD (T4.3): sin ella el autoguardado no sabría distinguir
      // este edificio del siguiente, y lo que se dibujara aquí no se recuperaría al
      // volver. `IDENTIDAD_DIBUJADO` es un literal y no un nombre inventado por
      // cada uno, por el mismo motivo que en la otra rama: ver su JSDoc.
      const base =
        estado.get() ??
        crearEdificio({ modelo: panelEdificio.valores().modelo, idLocal: IDENTIDAD_DIBUJADO })
      try {
        const { edificio: nuevo, detecciones } = conParteAnadida(base)
        estado.set(nuevo)
        publicarDetecciones(detecciones)
        // Y se queda elegida: quien añade una parte lo hace para dibujarla, y
        // obligarle a pulsarla después sería un paso que no aporta nada.
        seleccionarParte(nuevo.partes.length - 1)
        repintar(estado.get())
      } catch (causa) {
        reventar('añadir una parte ha fallado', causa)
      }
      return
    }
    if (accion === ACCION.ELIMINAR_PARTE) {
      aplicarMutacion(
        (e) => conParteEliminada(e, indice),
        `la eliminación de la parte ${indice} ha fallado`,
      )
      return
    }
    if (accion === ACCION.CAMBIAR_TIPO_PARTE) {
      aplicarMutacion(
        (e) => conTipoParte(e, indice, tipo),
        `el cambio de tipo de la parte ${indice} ha fallado`,
      )
      return
    }
    if (accion === ACCION.CAMBIAR_PLANTAS) {
      aplicarMutacion(
        (e) => conPlantas(e, indice, plantas ?? {}),
        `la asignación de plantas de la parte ${indice} ha fallado`,
      )
      return
    }

    // Las tres restantes las resuelve el panel por dentro y no las emite. Si
    // alguna vez lo hiciera, callarlo sería un botón mudo: se dice por consola.
    console.warn(`[edificio] intención sin destino en el cableado: ${accion}`)
  }

  /**
   * El usuario ha cerrado la elección de capas —«Cancelar» o `Escape`— con un DXF
   * esperando. Soltar un fichero y que no pase nada visible es el error silencioso
   * de manual: se suelta el fichero pendiente y **se dice**, con cómo volver.
   *
   * ⚠️ `alCerrar` NO se dispara con `cerrarCapas()`, que es lo que llama
   * {@link aplicarCapas} tras cargar: ese cierre es del programa y ahí sí ha
   * pasado algo. El contrato de `app/panel-edificio.js` lo garantiza.
   */
  const bajaCierre = panelEdificio.alCerrar(({ dialogo }) => {
    if (destruido || dialogo !== DIALOGO.CAPAS || pendiente === null) return
    const { nombre } = pendiente
    pendiente = null
    panelEdificio.estado(mensajeCapasCanceladas(nombre))
  })
  const bajaPanel = panelEdificio.alAccion(atender)
  const bajaStore = estado.subscribe(repintar)

  // `subscribe` no notifica al suscribirse (contrato de `crearEstadoVista`), así
  // que la primera pintura va a mano: es la que deja el panel coherente con un
  // store que puede nacer vacío o venir con algo puesto.
  repintar(estado.get())

  /**
   * F19 · La vista previa del pegado con la rama EDIFICIO puesta. Mismo contrato
   * que `app/cableado-medicion.js#inspeccionarTexto` —lo consume el mismo
   * `<dialog>`— y por eso devuelve exactamente la misma forma.
   *
   * ⚠️ **No hay cotejo de superficie aquí y no es un olvido**: ese renglón sale
   * del «Área:» que declara la LISTA de AutoCAD, y en un edificio lo que se pega
   * son las huellas de las partes, cuya superficie no la declara nadie. Enseñar un
   * renglón vacío o un cero afirmaría algo falso.
   *
   * @param {string} texto
   * @returns {{ok: boolean, titular: string, renglones: string[], motivo: string|null}}
   */
  function inspeccionarTexto(texto) {
    if (typeof texto !== 'string' || texto.trim() === '') {
      return { ok: false, titular: '', renglones: [], motivo: PEGADO_VACIO_EDIFICIO }
    }
    if (pareceXml(texto)) {
      // Un GML pegado entra por la otra rama del `alTexto`, y se dice: la vista
      // previa no puede callar que va a leerlo como un documento y no como una
      // lista de coordenadas.
      return {
        ok: true,
        titular: 'Documento XML · se leerá como un GML de edificio',
        renglones: [],
        motivo: null,
      }
    }
    let previa
    try {
      previa = entradaDesdeTexto(texto, comunes())
    } catch (causa) {
      console.error('[edificio] la vista previa del pegado ha fallado:', causa)
      return { ok: false, titular: '', renglones: [], motivo: MENSAJE_FALLO_INESPERADO }
    }
    const { resumen } = previa
    if (resumen.nPartes === 0) {
      return { ok: false, titular: '', renglones: [], motivo: PEGADO_SIN_GEOMETRIA_EDIFICIO }
    }
    const vertices = resumen.nVertices.reduce((suma, n) => suma + n, 0)
    const renglones = []
    if (resumen.huso) renglones.push(`Cae en el huso ${resumen.huso.zona} (${resumen.huso.srs}).`)
    return {
      ok: true,
      titular:
        `${resumen.nPartes} parte${resumen.nPartes === 1 ? '' : 's'} · ` +
        `${vertices} vértice${vertices === 1 ? '' : 's'} · ${resumen.via}`,
      renglones,
      motivo: null,
    }
  }

  return {
    alFichero,
    alTexto,
    inspeccionarTexto,
    cargar,

    /** Las `<section>` que este módulo ha sellado. Para el test y para T4.1. */
    secciones: () => [...secciones],

    /**
     * Enciende o apaga la edición de la parte activa (F12 · T4.2).
     *
     * ⛔ **Este módulo no decide cuándo.** Lo decide `app/main.js`, que es el
     * único que tiene los DOS ejes: qué rama está puesta y qué paso. Tenerlo
     * publicado es lo que permite que allí exista **un solo sitio** donde se diga
     * quién edita, con las dos ediciones nombradas en la misma línea — que es lo
     * que impide que se queden las dos encendidas y los gestos se pisen.
     *
     * Apagar cancela un dibujo en curso: irse de la pantalla con medio recinto
     * hecho y volver más tarde con los vértices todavía puestos sería encontrarse
     * un trabajo a medias que uno ya no recuerda haber empezado.
     *
     * **Sin argumento LEE** en vez de escribir, igual que `activa()` en
     * `viewer/edicion.js` y por el mismo motivo: sin eso, «¿está encendida?» solo
     * se puede responder mirando si un marcador se deja arrastrar, y una
     * afirmación que solo se puede comprobar por sus efectos secundarios es una
     * afirmación que ninguna prueba vigila. (Lo destapó una mutación de T4.2 que
     * salió VERDE: quitar el apagado de nacimiento no ponía roja ni una prueba.)
     *
     * ⛔ **Y lo que lee es la EDICIÓN, no la bandera de este módulo.** La primera
     * versión devolvía `mandoMio`, y la mutación siguió saliendo verde: dos
     * estados que dicen lo mismo son dos estados que pueden discrepar, y el que
     * importa es el del motor. `mandoMio` solo responde cuando no hay motor —una
     * pantalla sin mapa—, que es el único caso en que no hay a quién preguntar.
     *
     * @param {boolean} [encendida]
     * @returns {boolean}  Si edita esta rama ahora mismo.
     */
    edicion(encendida) {
      if (destruido) return false
      if (encendida === undefined) {
        return edicionActiva === null ? mandoMio : edicionActiva.activa() === true
      }
      mandoMio = encendida === true
      edicionActiva?.activa(mandoMio)
      if (!mandoMio) dibujoActivo?.cancelar()
      refrescarBarra()
      return mandoMio
    },

    /**
     * ⭐ **F14 · Señala en el mapa las partes de las que habla la validación.**
     *
     * Es el llamante que `validation/edificio.js#porParte` llevaba sin tener desde
     * F13: la ficha pedía que «el resalte del aviso rodee **la parte que se sale**,
     * no otra» (§16.1), el canal se construyó, se probó… y nadie lo enchufó. Es la
     * tercera vez en este proyecto (F11, F12, F13), y por eso este método existe
     * en la API pública y no como un detalle interno: lo que no se puede llamar
     * desde fuera no está entregado.
     *
     * ⚠️ **Los índices se FILTRAN contra la lista de ahora.** Eliminar la parte 2
     * de tres deja el índice 2 fuera de rango, y `viewer/partes.js` simplemente no
     * lo encontraría —el resalte desaparecería sin decir nada—. Se filtra aquí, que
     * es donde se sabe cuántas partes hay, y no en la vista, que solo dibuja.
     *
     * ⚠️ **Repinta SOLO la capa**, no el panel. Un repintado entero volvería a
     * llamar a `panelEdificio.fijar`, y este método puede correr en mitad de la
     * edición: no es sitio para tocar campos que el usuario está rellenando.
     *
     * @param {number[]|null} indices  Los de
     *   `app/cableado-edificio-gml.js#partesSenaladas`. `null` o `[]` retiran el
     *   resalte, que es lo correcto cuando no hay validación: unas huellas
     *   señaladas por una validación que ya no está señalan lo que no se sabe.
     * @returns {number[]}  Los que se han aplicado de verdad, ya filtrados.
     */
    resaltar(indices) {
      if (destruido) return []
      const partes = Array.isArray(estado.get()?.partes) ? estado.get().partes : []
      senaladas = (Array.isArray(indices) ? indices : []).filter(
        (i) => Number.isInteger(i) && i >= 0 && i < partes.length,
      )
      const derivada = partes.length === 0 ? null : envolventeDe(partes)
      capa?.pintar(partes.length === 0 ? null : partes, {
        activa,
        envolvente: derivada === null ? null : derivada.recintos,
        senaladas,
      })
      return senaladas
    },

    /** Empieza a dibujar el recinto de la parte activa, o lo cancela si ya iba. */
    alternarDibujo() {
      if (destruido || dibujoActivo === null) return
      if (dibujoActivo.dibujando()) cancelarDibujo()
      else if (activa !== null) dibujoActivo.empezar()
      refrescarBarra()
    },

    /** Qué parte se está editando. Para el guion de humo y para el test. */
    parteActiva: () => activa,

    /**
     * Retira los oyentes, apaga la capa de huellas y quita las marcas que puso.
     *
     * ⚠️ **Ni destruye el `panelEdificio` ni destruye los clientes**: los tres
     * entran inyectados y quien crea, destruye. Lo que sí hace es dejar sus
     * secciones OCULTAS junto con la marca retirada: sin marca, `app/rama.js` ya
     * no las gobierna, y dejarlas visibles las apilaría para siempre encima del
     * panel de parcela.
     *
     * ⛔ Y el ORDEN importa, pero no aquí: ver el apartado del apagado en la
     * cabecera. Lo decide `app/main.js`.
     *
     * IDEMPOTENTE.
     */
    destruir() {
      if (destruido) return
      destruido = true
      // Incrementar la secuencia deja SUPERADA a cualquier consulta en vuelo, así
      // que ninguna respuesta tardía escribe en una pantalla que ya no está.
      secuencia += 1
      if (enVuelo !== null) enVuelo.abort()
      enVuelo = null
      pendiente = null

      bajaCierre()
      bajaPanel()
      bajaStore()
      capa?.destruir()

      // ⚠️ El motor de la parte activa se apaga en el ORDEN INVERSO al montaje:
      // `sincronizar` consume los ganchos de `crearEdicion`, así que destruir la
      // edición primero le dejaría la tabla cableada a funciones de un módulo ya
      // muerto. Y el dibujo va el primero de todos: es el único que puede tener
      // capas a medio poner en el mapa.
      dibujoActivo?.destruir()
      sincronizacionActiva?.destruir()
      edicionActiva?.destruir()
      vistaActiva.destruir()
      dibujoActivo = null
      sincronizacionActiva = null
      edicionActiva = null
      barraEdicion?.dibujoVisible?.(false)

      for (const { seccion, marcada } of marcas) {
        if (marcada) seccion.removeAttribute(ATRIBUTO_PANEL)
        seccion.hidden = true
      }
      marcas.length = 0
    },
  }
}

export default cablearEdificio
