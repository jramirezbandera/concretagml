// app/main.js — F03 · Fase 4, Tarea 4B.1. EL ARRANQUE DE LA APP.
//
// Sustituye la sonda de build de la tarea 4A.1. Es la ENTRADA de Vite y el
// ÚNICO sitio del proyecto que ensambla la aplicación completa: coge las cajas
// vacías que declara `index.html` y las convierte en la pantalla viva.
//
// ── QUÉ ENSAMBLA, Y EN QUÉ ORDEN (el orden importa, y aquí está el por qué) ──
//   1. DATOS      — `parcelaDemo()` (o `parcelaDemoConHueco()` con `?demo=hueco`)
//                   de `./demo-datos.js`. Un POJO de parcela, en UTM.
//   2. ESTADO     — `crearEstadoVista(parcela)`. **LO CREA LA APP, NO EL VISOR**
//                   (ver más abajo: es la razón de ser de la ficha del pie).
//   3. PANEL      — `crearPanelAvisos(...)` de `./avisos.js`. Va ANTES del visor
//                   porque el visor necesita su `avisar` como `alAvisar`: si se
//                   creara después, los avisos del PRIMER encuadre (una tesela
//                   del IGN que no carga, la imagen WMS que falla) se irían al
//                   `console.warn` por defecto y el usuario no vería nada.
//   4. VISOR      — `crearVisor(...)` de `../viewer/index.js`. Monta mapa +
//                   capas + tabla de vértices y encuadra sobre la geometría.
//   5. CATASTRO   — `cablearCatastro(...)` de `./cableado-catastro.js` (F05,
//                   tarea T4A), con las cuatro piezas que ese módulo exige ya
//                   hechas: transporte, base, caché y cliente. Va DESPUÉS del
//                   visor porque le pasa su `L.Map` (un clic en el mapa deduce
//                   la referencia), y ANTES del GML porque traer una parcela
//                   hace `estado.set` y de ese store sale el estado del botón
//                   «Generar GML».
//   6. FICHA      — `estado.subscribe(actualizarFicha)` y una primera llamada a
//                   mano (`subscribe` NO notifica al suscribirse).
//   7. GML        — `cablearGeneracionGml(...)` (F04, tarea T6.1). Va EL ÚLTIMO
//                   porque necesita las dos piezas anteriores: el store (de él
//                   sale la geometría que se serializa, y de sus notificaciones
//                   el estado del botón) y el panel (es donde se publican las
//                   detecciones del serializador). Como la ficha, se suscribe y
//                   además se llama a mano una primera vez.
//
// ── POR QUÉ EL STORE LO CREA ESTA FUNCIÓN Y NO `crearVisor` ─────────────────
// `viewer/index.js` documenta que recibe el store ya hecho y NO lo fabrica, para
// que el llamante pueda COMPARTIRLO con otras vistas. Hasta ahora eso era una
// promesa sobre F05/F06; la ficha del pie de este fichero lo convierte en un
// hecho comprobable en producción: es un SEGUNDO suscriptor del MISMO store que
// el mapa y la tabla, y por eso existe. Se edita una coordenada en la tabla →
// `sincronizar` hace `estado.set` → se repintan el polígono del mapa Y la
// superficie del pie, sin que ninguna de las dos vistas sepa de la otra.
//
// ── POR QUÉ SE IMPORTA `viewer/index.js` DIRECTAMENTE Y NUNCA EL BARREL RAÍZ ─
// El barrel raíz `index.js` NO exporta el visor A PROPÓSITO (hallazgo C1/T10):
// `viewer/` y `services/` importan Leaflet, que exige `window`, y el barrel lo
// carga el proyecto Vitest `node`, que corre sin DOM. `test/contrato.test.js`
// vigila ese invariante y su comentario nombra LITERALMENTE esta tarea (la
// entrada demo de la Fase 4) como el momento en que alguien va a querer
// «exportar el visor por el barrel para que la demo lo importe bonito». No se ha
// hecho: aquí se importa `../viewer/index.js`.
//
// La comprobación de cierre de esta tarea es un grep sobre `app/` buscando
// importaciones del barrel raíz, y tiene que salir VACÍO. Por eso este párrafo
// describe el patrón en vez de escribirlo: un comentario que cita el patrón
// literal se convierte él mismo en una coincidencia y convierte un «cero duro»
// en un «cero salvo este falso positivo que hay que leer cada vez».
//   @see test/contrato.test.js  →  describe('contrato F03 · el visor NO sale por
//                                  el barrel raíz (Leaflet exige window)')
//
// ── F04 · LO QUE ESTA CAPA DECIDE Y `gml/` NO PUEDE DECIDIR ─────────────────
// `gml/` es capa de DOMINIO: no importa `model/`, no toca el DOM y no consulta
// el reloj. Eso deja cuatro decisiones huérfanas que sólo pueden tomarse aquí, y
// las cuatro están tomadas en {@link cablearGeneracionGml}:
//
//   1. LA FECHA. El reloj se lee AQUÍ, en `ahora()`, y el MISMO instante va al
//      nombre del fichero. Lo que NO baja es un `beginLifespanVersion`: en el
//      perfil de entrega ese elemento sale con `xsi:nil`, como en la plantilla
//      oficial del Catastro, porque la vigencia de la versión del objeto la fija
//      el Catastro al inscribir, no el declarante al subir (ver
//      `gml/serialize-cp.js`, decisión 3). Que `gml/` no consulte el reloj sigue
//      siendo la regla, y es lo que permite que el test de ida y vuelta compare
//      un GML entero contra un snapshot.
//
//   2. LA IDENTIDAD. `serializarParcelaCp` EXIGE `refcat` y no se la inventa;
//      `model/parcela.js` tiene `refcat` (que puede ser `null`) y `idLocal` (que
//      nunca lo es). Resolver `refcat ?? idLocal` es de esta capa, y por eso
//      `gml/` no necesita importar `model/`.
//
//   3. LA IDENTIDAD INSPIRE — `namespaceInspire` + `nationalCadastralReference`.
//      ⚠️ CORREGIDO el 2026-07-27. Aquí se fijaba `ES.LOCAL.CP` SIEMPRE y
//      `nationalCadastralReference` vacío, razonando que rellenarlo «convertiría
//      un alta en una declaración falsa de inscripción». El razonamiento tenía
//      buena intención y la conclusión era incoherente: con una referencia
//      catastral real de `localId` bajo `ES.LOCAL.CP`, el fichero afirmaba a la
//      vez «esta es su referencia catastral» y «esta parcela no está en el
//      Catastro». La FAQ del Catastro empareja los dos campos y no los deja
//      elegir por separado. Ver {@link identidadInspireDe}.
//
//   4. EL PERFIL DEL FICHERO. `PERFIL.ENTREGA`, explícito. Es la decisión que
//      hace que la Sede acepte el fichero en vez de rechazarlo, y no puede
//      quedarse dependiendo del valor por omisión de otro módulo.
//
//   5. LA TRADUCCIÓN DE SEVERIDADES. `gml/` habla de tres (INFO/AVISO/ERROR) y
//      el panel de dos (ver {@link NIVEL_POR_SEVERIDAD}).
//
// ⚠️ `gml/descargar.js` se importa DIRECTAMENTE, igual que `viewer/index.js` y
// por el mismo motivo: necesita `Blob`/`URL`/`document`, así que está fuera del
// barrel `gml/index.js` (que sí carga el proyecto Vitest `node`, sin DOM). Los
// otros dos módulos de `gml/` también se importan uno a uno en vez de por el
// barrel: así el bundle no arrastra `gml/parse.js`, que hoy no usa nadie en la
// app (lo usará F08).
//
// ── F05 · LO QUE ESTA CAPA DECIDE AL ENCHUFAR EL CATASTRO ───────────────────
// `app/cableado-catastro.js` sabe hablar con el campo, los botones y el store,
// pero EXIGE el cliente ya hecho y sin valor por defecto: crearlo dentro
// decidiría por el llamante el transporte, la caché y el reloj (y en un test
// tocaría la red de verdad). Esta es la capa que puede decidirlo, y decide:
//
//   1. EL CANAL DE AVISOS ES UNO SOLO. El MISMO `panel.avisar` va al transporte,
//      a `abrirBd`, a la caché y al cliente. No se fabrica ningún avisador
//      extra, y el reparto ya está pensado para que el usuario no lea lo mismo
//      dos veces: `_red.js` avisa del fallo de RED, `services/catastro.js` NO
//      avisa por sus resultados (los devuelve, y el cableado los publica), y la
//      caché avisa de lo suyo, que es lo único que no cabe en ningún resultado.
//      `abrirBd` MEMOIZA su promesa, así que su `alAvisar` lo fija la primera
//      llamada: tiene que ser esta, la del arranque, o los fallos del almacén
//      acabarían en el `console.warn` por defecto.
//
//   2. NO SE ESPERA A INDEXEDDB. `abrirBd()` devuelve una promesa y se le pasa
//      SIN `await` a `crearCacheCatastro`, que la acepta tal cual a propósito y
//      la resuelve sola en su primera operación. Es lo que hace que una base
//      lenta —o un navegador con el almacenamiento denegado, o una pestaña
//      vieja bloqueando la versión— no retrase ni impida que se vea el mapa. La
//      caché es una OPTIMIZACIÓN: la app arranca y funciona aunque no haya base
//      nunca (entonces se comporta como `CACHE_NULA` y lo dice por el panel).
//
//   3. EL CATASTRO NO PUEDE TUMBAR EL ARRANQUE. Todo el bloque va en un `try`
//      cuyo `catch` NO relanza — la segunda excepción de este fichero, y por la
//      misma razón que la primera (ver el `catch` de `refrescar`): F05 añade una
//      VÍA DE ENTRADA, no sustituye la que hay, y si al preparar la conexión
//      revienta algo (el entorno sin `fetch`, un nodo del contrato que ya no
//      está en `index.html`), lo que no puede pasar es que se lleve por delante
//      el mapa, la tabla, la ficha y el botón «Generar GML» — que se cablea
//      DESPUÉS y con la geometría que ya está en el store. El defecto no se
//      tapa: va al panel como ERROR y a la consola, y los dos botones del bloque
//      se APAGAN, porque un botón vivo que no hace nada al pulsarlo es
//      exactamente el error silencioso que este proyecto no admite.
//      ⚠️ Ese `try` protege el CABLEADO, no el IMPORT: `cableado-catastro.js`
//      tiene un guardián de carga que lanza si el catálogo de motivos del
//      cliente crece y a él no le escriben el resumen. Es deliberadamente fatal
//      (su comentario explica por qué) y ocurre antes de que aquí se ejecute
//      nada; no se intenta neutralizar desde este fichero.
//
//   4. LA PROCEDENCIA DEL DATO NO SE MAQUILLA, y eso ahora incluye el eyebrow.
//      `index.html` nace diciendo «Parcela cargada», que hasta F05 era vago y a
//      partir de F05 sería FALSO: con un campo para traer parcelas del Catastro
//      al lado, ese rótulo se lee como «esta viene del Catastro» cuando lo que
//      hay en pantalla al abrir es el dataset de DEMOSTRACIÓN de
//      `./demo-datos.js`. Así que el rótulo pasa a escribirlo SIEMPRE la ficha
//      (ver {@link rotuloDelDato}), con los tres estados que de verdad existen.
//      Es la misma regla por la que `demo-datos.js` no le añade un patio a la
//      parcela real: un dato inventado no se presenta como uno del Catastro, y
//      uno del Catastro tampoco se presenta como una demostración.
//
// ── LO QUE NO SE HA CABLEADO (F05), Y POR QUÉ ───────────────────────────────
// `cablearCatastro` devuelve además `colindantes()`, y AQUÍ NO SE LLAMA. No es
// un olvido:
//   · la cáscara no tiene ningún gesto para pedirlos (`index.html` trae campo,
//     «Traer del Catastro» y «Deducir del mapa», y nada más), y
//   · dispararlos solos al cargar sería una SEGUNDA petición por cada parcela
//     que nadie ha pedido — justo lo que castiga la política de uso del servicio
//     (override O8) —, y además el store no distingue «parcela recién traída» de
//     «parcela editada», así que cualquier disparo automático desde el
//     suscriptor acabaría consultando el Catastro al mover un vértice.
//   · `cargar()` usa `GetParcel` y no `GetNeighbourParcel`: que las vecinas sean
//     una acción aparte es una decisión ya tomada en `cableado-catastro.js`, no
//     algo que esta capa deba deshacer por su cuenta.
// Consecuencia asumida: el `<dd data-ficha="colindantes">` dice la verdad —«Sin
// consultar»— en vez de un «0» que sería mentira. Quien enchufe la acción (F07:
// diagnóstico, invasión, snap) tiene el sitio marcado en {@link actualizarFicha}.
//
// ── POR QUÉ ESTE FICHERO EXPORTA UNA FUNCIÓN (y es la única que exporta) ────
// Un módulo de entrada normalmente no exporta nada. `cablearGeneracionGml` es la
// excepción, y la razón es que el resto de este fichero se comprueba SOLO (los
// datos, en `test/app/demo-datos.test.js`; el panel, en `avisos.dom.test.js`; el
// visor, en toda la suite de `test/viewer/`), mientras que el cableado del botón
// —validar, serializar, publicar detecciones, descargar y re-evaluar— no se
// comprueba en ningún otro sitio y es la parte de F04 que el usuario ve. Se
// extrae, por tanto, lo justo para poder ejercitarlo con un store y un panel de
// prueba; el resto del ensamblaje sigue siendo código de nivel superior.
//   @see test/app/main-gml.dom.test.js
//
// ── POR QUÉ EL CSS DE LEAFLET SE IMPORTA AQUÍ Y NO EN `viewer/` ─────────────
// `viewer/index.js` declara que NO importa `leaflet/dist/leaflet.css` a
// propósito: el visor es una LIBRERÍA y el CSS es responsabilidad de la ENTRADA
// de la aplicación, que es este fichero. Sin él, el mapa sale descuadrado
// (panes sin `position:absolute`, controles sin caja).
// La otra hoja, `estilos/app.css`, va por `<link>` en `index.html` y NO se
// importa aquí: así la cáscara está vestida en el primer pintado, sin fogonazo
// de HTML crudo en cada recarga de `npm run dev`. El orden entre las dos hojas
// es indiferente por diseño (ver la cabecera de `estilos/app.css`: sus reglas
// sobre cromo de Leaflet suben la especificidad a `.gml-app .gml-mapa`).
//
// ── POR QUÉ NO HAY `import.meta.hot.accept()` ───────────────────────────────
// Un `accept` volvería a ejecutar este módulo sobre un `#mapa` que ya tiene un
// `L.Map` montado, y Leaflet lanzaría «Map container is already initialized»
// (doble montaje). Sin `accept`, Vite hace RECARGA COMPLETA de la página ante
// cualquier cambio, que es exactamente lo que este arranque necesita. Si algún
// día se quiere HMR fino, la vía es `import.meta.hot.dispose(() => visor.destruir())`,
// no `accept` a secas.
//
// ── POR QUÉ NO HAY NINGÚN GLOBAL DE DEPURACIÓN (`window.__gml`) ─────────────
// La sonda de build sí colgaba un `globalThis.__visor`. Aquí no: la verificación
// de esta tarea conduce la UI REAL (se mira el mapa, se cuentan las filas, se
// arrastra el deslizador), y un asa global es una API accidental que alguien
// acabaría usando en serio. Lo que hacía falta comprobar por consola —el riesgo
// nº 1 de la fase, que `mapa.getSize().y > 0`— se lee del DOM sin ningún hook:
// `getSize()` ES `[#mapa.clientWidth, #mapa.clientHeight]` (`Map#getSize` lee el
// contenedor), así que se comprueba con
// `const e = document.getElementById('mapa'); [e.clientWidth, e.clientHeight]`.
//
// ── POR QUÉ NO HAY BOTÓN «DIAGNOSTICAR» ────────────────────────────────────
// La maqueta de diseño lleva un CTA que abre el diagnóstico de F07. F07 no
// existe todavía, y un botón deshabilitado es UI muerta: promete una función que
// nadie puede usar y hay que acordarse de encenderla. Cuando F07 exista, se
// añade entonces.

import 'leaflet/dist/leaflet.css'

import { superficie } from '../geo/area.js'
import { PERFIL, SEVERIDAD } from '../gml/_comun.js'
import { descargarGml } from '../gml/descargar.js'
import { NAMESPACE_INSPIRE_CATASTRO, NAMESPACE_INSPIRE_DEFECTO } from '../gml/ids.js'
import { serializarParcelaCp } from '../gml/serialize-cp.js'
import { crearTransporte } from '../services/_red.js'
import { crearClienteCatastro } from '../services/catastro.js'
import { abrirBd } from '../storage/bd.js'
import { crearCacheCatastro } from '../storage/cache-catastro.js'
import { validarParcela } from '../validation/parcela.js'
import { crearEstadoVista, NIVEL } from '../viewer/_comun.js'
import { crearVisor } from '../viewer/index.js'
import { crearPanelAvisos } from './avisos.js'
import {
  SELECTOR_BOTON_CARGAR,
  SELECTOR_BOTON_DEDUCIR,
  SELECTOR_ESTADO_CATASTRO,
  cablearCatastro,
} from './cableado-catastro.js'
import {
  AVISO_DEMO_HUECO_SINTETICO,
  SRS_DEMO,
  parcelaDemo,
  parcelaDemoConHueco,
} from './demo-datos.js'

// ── Constantes de presentación ───────────────────────────────────────────────

/**
 * Valor de `?demo=` que selecciona el dataset SINTÉTICO con hueco. Es la única
 * vía para verlo: la parcela por defecto es la REAL del Catastro y nunca se le
 * añade un patio inventado encima (ver la cabecera de `./demo-datos.js`).
 */
const DEMO_HUECO = 'hueco'

/**
 * Los TRES eyebrows de la cabecera, que son los tres estados de PROCEDENCIA que
 * la app sabe distinguir de verdad (ver {@link rotuloDelDato}). `index.html`
 * nace con «Parcela cargada» y a partir de F05 el rótulo lo escribe siempre la
 * ficha: con un campo para traer parcelas del Catastro al lado, «cargada» se lee
 * como «traída de la Sede», y al abrir la app lo que hay es una demostración.
 */
const EYEBROW_SINTETICA = 'Parcela sintética · demostración'
const EYEBROW_DEMOSTRACION = 'Parcela de demostración'
const EYEBROW_CATASTRO = 'Parcela del Catastro'

/** Texto de la ficha cuando la parcela no tiene referencia catastral. */
const SIN_REFCAT = 'Sin referencia'

/**
 * Ficha: el Catastro no ha declarado ninguna superficie para esta parcela. Es lo
 * normal en todo lo que no viene del WFS (la demo, un DXF, un contorno dibujado)
 * y se DICE, en vez de dejar el guion del HTML, que se lee como «esto no ha
 * cargado», o un «0 m²», que sería afirmar una superficie que nadie declaró.
 */
const SIN_SUPERFICIE_CATASTRAL = 'No consta'

/**
 * Ficha: nadie ha pedido las parcelas colindantes. Ver la cabecera («LO QUE NO
 * SE HA CABLEADO»): traerlas es una consulta aparte y hoy no hay ningún gesto
 * que la dispare. El texto dice eso y no «0», que sería contar unas vecinas que
 * no se han buscado.
 */
const SIN_COLINDANTES = 'Sin consultar'

/**
 * Superficie con dos decimales y separadores españoles (1.019,17). Dos
 * decimales porque es la precisión con la que el Catastro expresa la superficie
 * de parcela; el redondeo es de PRESENTACIÓN y jamás toca el modelo.
 */
const FORMATO_SUPERFICIE = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * La superficie que el Catastro DECLARA, escrita como él la declara: sin
 * decimales forzados. Es toda la diferencia con {@link FORMATO_SUPERFICIE}, y no
 * es un capricho de formato — el Catastro publica un ENTERO de metros cuadrados
 * (`<cp:areaValue uom="m2">1536</cp:areaValue>`), así que pintar «1.536,00» le
 * añadiría dos cifras de precisión que nadie ha afirmado. La superficie MEDIDA
 * de la línea de arriba sí lleva sus dos decimales, porque esa la calcula la app
 * y sabe hasta dónde llega. Que las dos cifras no coincidan ES el dato (F07).
 */
const FORMATO_DECLARADO = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })

/** Enteros con separador de millares español (para el recuento de vértices). */
const FORMATO_ENTERO = new Intl.NumberFormat('es-ES')

// ── Constantes del cableado de F04 ───────────────────────────────────────────

/**
 * Botón «Generar GML» del pie del panel. Es CONTRATO con `index.html` (nace
 * `disabled` allí a propósito: hasta que no se valida la geometría no se sabe si
 * se puede generar). Se exporta para que el test construya su cáscara con el
 * mismo literal en vez de con una copia que pueda divergir.
 */
export const SELECTOR_BOTON_GML = '[data-accion="generar-gml"]'

/**
 * Renglón `role="status"` que va debajo del botón. El lector de pantalla anuncia
 * lo que se escriba aquí sin robar el foco, y su CSS lo colapsa cuando está
 * vacío (`.gml-accion-estado:empty{display:none}`), así que «sin estado» no deja
 * un hueco en el pie. También es contrato con `index.html`.
 */
export const SELECTOR_ESTADO_GML = '[data-estado="generar-gml"]'

/** Modificador de `.gml-accion-estado` para el estado BLOQUEADO (rojo). */
const CLASE_ESTADO_ERROR = 'gml-accion-estado--error'

/**
 * Cuántos motivos DISTINTOS caben en el renglón antes de resumir el resto. El
 * renglón es una línea de 11 px debajo del botón, no un panel: con más de dos
 * mensajes deja de leerse. No es un tope de información —el recuento completo va
 * SIEMPRE delante («3 errores bloquean…»)—, es un tope de longitud.
 */
const MOTIVOS_EN_RENGLON = 2

/**
 * Identidad de último recurso cuando la parcela no tiene NI referencia catastral
 * NI `idLocal`. Con una parcela construida por `model/parcela.js#crearParcela`
 * no puede ocurrir (`idLocal` es obligatorio allí), pero el store admite
 * cualquier POJO y `serializarParcelaCp` LANZA con una `refcat` en blanco: más
 * vale un `<localId>` que dice la verdad que una excepción en un `click`.
 */
const IDENTIDAD_SIN_REFERENCIA = 'SIN-REFERENCIA'

/**
 * Lo que se le dice al usuario cuando la generación revienta por un defecto de
 * programación (contrato roto en `gml/`: SRS no soportado, coordenada no
 * publicable…). No intenta explicar la causa técnica —no le sirve de nada— pero
 * tampoco la esconde: dice qué ha pasado, que NO tiene fichero, y que el detalle
 * está en la consola, que es donde puede copiarlo para reportarlo.
 */
export const MENSAJE_FALLO_INESPERADO =
  'No se ha podido generar el GML por un fallo interno; no se ha descargado ningún ' +
  'fichero. El detalle técnico está en la consola del navegador.'

/**
 * Gemelo del anterior para el momento de la ENTREGA. Se distingue a propósito:
 * aquí el GML SÍ se ha generado bien y lo que ha fallado es la descarga, así que
 * la acción que le toca al usuario es otra (reintentar, mirar los permisos del
 * navegador) y no «tu parcela tiene algo raro».
 */
export const MENSAJE_FALLO_ENTREGA =
  'El GML se ha generado, pero el navegador no ha podido descargarlo. ' +
  'El detalle técnico está en la consola del navegador.'

/**
 * Los dos tramos del recorrido de generación, a efectos de elegir el mensaje
 * cuando algo revienta. No es una máquina de estados: es el mínimo que hace
 * falta para no contarle al usuario que «falló la generación» cuando el GML se
 * generó bien y lo que falló fue la descarga.
 */
const FASE = Object.freeze({ GENERACION: 'GENERACION', ENTREGA: 'ENTREGA' })

/**
 * Traducción de las TRES severidades de `gml/` a los DOS niveles del panel.
 *
 * `INFO` y `AVISO` caen los dos en `NIVEL.AVISO`, y `ERROR` en `NIVEL.ERROR`.
 * Justificación, que es lo que importa aquí:
 *
 *   · `NIVEL.ERROR` significa BLOQUEANTE en toda la app —el panel lo rotula
 *     literalmente «Bloqueante» y el chip rojo cuenta esos—, y en `gml/` una
 *     detección `ERROR` bloquea de verdad: `serializarParcelaCp` devuelve
 *     `xml: null` en cuanto hay una. Los dos vocabularios coinciden en ese punto.
 *   · Un `INFO` de `gml/` NO es «ruido de depuración»: son `ORIENTACION_NORMALIZADA`
 *     (se ha invertido un anillo) y `PUNTO_REFERENCIA_RECALCULADO` (se ha
 *     descartado el punto propuesto). El fichero que baja NO es el dibujo que el
 *     usuario tenía en pantalla, y la regla de oro 1 dice que se entera. Mapearlo
 *     a un tercer nivel «informativo» que el panel no sabe pintar equivaldría a
 *     tirarlo; mapearlo a `ERROR` sería mentir diciendo que algo bloquea.
 *     `AVISO` es el único nivel que dice la verdad: «pasó algo, mira».
 *
 * Derivado de los dos vocabularios, sin literales sueltos: si `SEVERIDAD`
 * creciera, la clave nueva daría `undefined` y {@link cablearGeneracionGml} cae
 * a `NIVEL.AVISO`, que es el suelo seguro (nunca inventa un bloqueo).
 */
const NIVEL_POR_SEVERIDAD = Object.freeze({
  [SEVERIDAD.INFO]: NIVEL.AVISO,
  [SEVERIDAD.AVISO]: NIVEL.AVISO,
  [SEVERIDAD.ERROR]: NIVEL.ERROR,
})

// ── Constantes del cableado del Catastro (F05) ───────────────────────────────

/**
 * Lo que se le dice al usuario cuando el bloque «Origen de la parcela» no ha
 * llegado a cablearse (ver la decisión 3 de la cabecera). Dice las tres cosas
 * que le hacen falta: qué se ha perdido, qué SIGUE funcionando —que es casi
 * todo, y es la diferencia entre una app rota y una app sin una vía de entrada—
 * y dónde está el detalle para poder reportarlo.
 */
const MENSAJE_SIN_CATASTRO =
  'No se ha podido preparar la conexión con el Catastro: el bloque «Origen de la parcela» queda ' +
  'deshabilitado durante esta sesión. Todo lo demás sigue funcionando —el mapa, la tabla de ' +
  'vértices, la validación y la generación del GML—. El detalle técnico está en la consola del ' +
  'navegador.'

// ── Nodos de la cáscara ──────────────────────────────────────────────────────

/**
 * Nodo de `index.html`, o `throw`. El marcado de la cáscara es CONTRATO (ver la
 * cabecera de `index.html`), así que un selector que no encuentra nada es un bug
 * del programador, no un dato malo: regla de oro 1, se lanza y se nombra el
 * selector. La alternativa —seguir con un `null` y morir cien líneas más allá
 * con «cannot set properties of null»— es justo el fallo ilegible que el
 * proyecto no admite.
 *
 * @param {string} selector
 * @returns {HTMLElement}
 * @throws {Error} Si la cáscara no tiene ese nodo.
 */
function nodo(selector) {
  const encontrado = document.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `app/main.js: la cáscara no tiene ningún nodo '${selector}'. El marcado de ` +
        `index.html es contrato de esta entrada (y de estilos/app.css): si se ha ` +
        `renombrado o movido ese nodo, hay que arreglarlo en index.html, no aquí.`,
    )
  }
  return /** @type {HTMLElement} */ (encontrado)
}

// ── 1 · Datos ────────────────────────────────────────────────────────────────

// `?demo=hueco` es la vía explícita para ver en pantalla un hueco interior, su
// rótulo «HUECO 1» y el recorte de anillos anidados. Cualquier otro valor (o
// ninguno) carga la parcela REAL del Catastro.
const esSintetica = new URLSearchParams(window.location.search).get('demo') === DEMO_HUECO
const parcela = esSintetica ? parcelaDemoConHueco() : parcelaDemo()

/**
 * El `idLocal` del dataset de DEMOSTRACIÓN con el que arranca la app. Es lo que
 * permite saber, más tarde y sin adivinar, si lo que hay en el store SIGUE
 * siendo la demostración o si el usuario ya ha traído una parcela de verdad (ver
 * {@link rotuloDelDato}).
 *
 * Se DERIVA del dataset en vez de escribir el literal `'demo-…'`, para que no
 * puedan divergir. Y se usa `idLocal` y no `refcat`, `origen` ni la identidad
 * del objeto, porque es el único de los cuatro que distingue de verdad:
 *   · `refcat` NO sirve — la parcela de demostración es la REAL 9398516VK3799G,
 *     así que traerla del Catastro deja la misma referencia en el store;
 *   · `origen` NO sirve — la demo ya es `WFS` (ese anillo salió del WFS, y
 *     `demo-datos.js` lo dice donde toca);
 *   · la identidad del POJO NO sirve — editar una coordenada en la tabla
 *     construye un objeto nuevo y la parcela seguiría siendo la de demostración.
 * `idLocal` en cambio viaja con el dato: sobrevive a las ediciones y solo cambia
 * cuando ENTRA otra parcela, que es exactamente la pregunta que se hace.
 */
const ID_LOCAL_DEMO = parcela.idLocal

// El eyebrow ya no se escribe aquí. Lo escribe SIEMPRE la ficha (paso 6), que es
// el único suscriptor que ve entrar y salir parcelas del store y por tanto el
// único que puede decir la verdad sobre su procedencia también DESPUÉS del
// arranque. Ver {@link rotuloDelDato} y la decisión 4 de la cabecera.
const eyebrow = nodo('[data-eyebrow]')

// ── 2 · Estado ───────────────────────────────────────────────────────────────

// UN solo store para las TRES vistas: el dibujo del mapa, la tabla de vértices
// y la ficha del pie (ver la cabecera).
const estado = crearEstadoVista(parcela)

// ── 3 · Panel de avisos ──────────────────────────────────────────────────────

// Los dos chips del contador se localizan por `data-contador`, que es el
// contrato de `index.html`: nacen NEUTROS («0 errores» / «0 avisos») y es
// `app/avisos.js` quien pone y quita los modificadores de color.
const panel = crearPanelAvisos({
  contenedor: nodo('#avisos'),
  chipError: nodo('.gml-chip[data-contador="ERROR"]'),
  chipAviso: nodo('.gml-chip[data-contador="AVISO"]'),
})

// El dataset sintético lo dice también EN LA LISTA de avisos, no solo en el
// eyebrow: el eyebrow se lee una vez al abrir y la lista queda.
if (esSintetica) panel.avisar(AVISO_DEMO_HUECO_SINTETICO, { nivel: NIVEL.AVISO })

// ── 4 · Visor ────────────────────────────────────────────────────────────────

// El retorno SÍ se recoge desde F05: de él sale el `L.Map` que el cableado del
// Catastro necesita para la deducción por clic (paso 5). Del resto de la app
// sigue sin depender nadie: el visor se comunica por el store, no por su asa.
const visor = crearVisor(nodo('#mapa'), {
  estado,
  // `<div>`, no `<table>`: es la caja con `overflow:auto` contra la que scrollea
  // la cabecera pegajosa. `sincronizar` crea la `<table>` dentro.
  tablaEl: nodo('#tabla-vertices'),
  srs: SRS_DEMO,
  // El ÚNICO camino para que un fallo de red de la cartografía o una celda
  // ilegible acaben en el panel en vez de en el `console.warn` por defecto.
  alAvisar: panel.avisar,
  // Ortofoto PNOA. Coincide con `capas.js#BASE_POR_DEFECTO`, y se pasa igual de
  // forma explícita: es LA capa sobre la que se calca, y que la app diga en voz
  // alta con qué base arranca vale más que ahorrar una línea.
  baseInicial: 'pnoa-ma',
  // ⚠️ DECISIÓN, y va CONTRA el defecto de `montarCapas` (que es `false`). Con
  // `false` la cartografía catastral arranca apagada y, sobre todo, el control
  // de opacidad arranca DESHABILITADO: quien abre la app por primera vez ve un
  // deslizador gris que no se mueve y lo lee como un fallo del programa. Además
  // catastral-en-transparencia-sobre-ortofoto ES la vista que da sentido al
  // producto (calcar), y encenderla cuesta exactamente 1 `GetMap` por encuadre
  // — la capa WMS pide una imagen por encuadre, no un mosaico de teselas.
  superpuestaInicial: true,
  // F06 enchufa aquí `crearHistorial()` de `edit/historial.js`. Hoy `null`
  // EXPLÍCITO (que es también el defecto) para que se vea que el hueco existe y
  // que no está sin decidir: `sincronizar` ya sabe commitear una instantánea por
  // operación acabada, lo que falta es la pila y los atajos de undo/redo.
  historial: null,
})

// ── 5 · El Catastro en vivo (F05 · T4A) ──────────────────────────────────────

try {
  // El transporte es el único que toca la red: cola de 2, timeout, backoff con
  // jitter. Su `alAvisar` es EL MISMO panel que todo lo demás (decisión 1).
  const transporte = crearTransporte({ alAvisar: panel.avisar })

  // ⚠️ SIN `await`, y es la decisión 2 de la cabecera: `abrirBd` devuelve una
  // promesa y `crearCacheCatastro` la acepta tal cual a propósito, resolviéndola
  // sola en su primera operación. Esperarla aquí ataría el primer pintado del
  // mapa a IndexedDB —a una base lenta, a otra pestaña que bloquea la versión, a
  // un navegador que niega el almacenamiento—, y la caché es una optimización:
  // sin base, se comporta como `CACHE_NULA` y la app funciona igual.
  const cache = crearCacheCatastro({
    bd: abrirBd({ alAvisar: panel.avisar }),
    alAvisar: panel.avisar,
  })

  const cliente = crearClienteCatastro({
    transporte,
    cache,
    // EXPLÍCITO aunque hoy coincida con el `SRS_DEFAULT` del cliente: el sistema
    // de referencia es del EXPEDIENTE (el mismo que se le da al visor y el mismo
    // que se pinta en la ficha), no del servicio. El día que el expediente
    // trabaje en otro huso, el cliente lo sigue sin que haya que acordarse.
    srs: SRS_DEMO,
    // El cliente NO avisa por sus resultados —los devuelve, y el cableado los
    // publica—; este canal es solo para los fallos de la CACHÉ, que son lo único
    // suyo que no cabe en ningún resultado. Ver la decisión 1 de la cabecera.
    alAvisar: panel.avisar,
  })

  cablearCatastro({
    // El MISMO store que el mapa, la tabla y la ficha. `viewer/index.js`
    // documenta que recibe el store ya hecho para que F05 pudiera compartirlo;
    // esta línea es esa promesa cobrada.
    estado,
    panel,
    cliente,
    srs: SRS_DEMO,
    // El `L.Map` del visor, para la segunda vía de la deducción: clic en el mapa
    // → geocodificación inversa (spec F05 §7.3). El cableado lo consume por duck
    // typing (`on`/`off`) y solo actúa cuando tiene sentido deducir, así que un
    // clic normal del mapa no consulta nada.
    mapa: visor.mapa,
    // Los seis nodos del bloque los localiza él con los selectores de su
    // contrato, y LANZA nombrándolos si `index.html` ha dejado de traerlos.
  })
} catch (causa) {
  // ── Aquí NO se relanza (decisión 3 de la cabecera) ─────────────────────────
  // Relanzar mataría el arranque entero: sin `app/main.js` no habría ficha ni
  // botón «Generar GML», que se cablea DESPUÉS, y el usuario perdería la app
  // completa por no poder usar UNA de sus vías de entrada. El defecto no se
  // tapa —panel como ERROR y consola— y el bloque muerto se apaga.
  console.error('[catastro] no se ha podido cablear la entrada del Catastro:', causa)
  panel.avisar(MENSAJE_SIN_CATASTRO, { nivel: NIVEL.ERROR, causa })

  // `document.querySelector` a pelo y no `nodo()`: `nodo` LANZA cuando no
  // encuentra, y lanzar DENTRO del catch de arranque volvería a tumbar la app
  // por el mismo sitio que se acaba de proteger. Aquí un nodo que falta es,
  // además, la causa más probable de haber llegado hasta este catch.
  for (const selector of [SELECTOR_BOTON_CARGAR, SELECTOR_BOTON_DEDUCIR]) {
    const boton = document.querySelector(selector)
    if (boton !== null) boton.disabled = true
  }
  const renglonCatastro = document.querySelector(SELECTOR_ESTADO_CATASTRO)
  if (renglonCatastro !== null) renglonCatastro.textContent = MENSAJE_SIN_CATASTRO
}

// ── 6 · Ficha del pie: el SEGUNDO suscriptor del mismo store ─────────────────

const fichaSrs = nodo('[data-ficha="srs"]')
const fichaRefcat = nodo('[data-ficha="refcat"]')
const fichaVertices = nodo('[data-ficha="vertices"]')
const fichaSuperficie = nodo('[data-ficha="superficie"]')
const fichaSuperficieCatastral = nodo('[data-ficha="superficie-catastral"]')
const fichaColindantes = nodo('[data-ficha="colindantes"]')

/**
 * El rótulo de PROCEDENCIA de la cabecera (`data-eyebrow`): qué es, exactamente,
 * lo que hay en pantalla. Tres estados, que son los tres que la app distingue:
 *
 *   · **{@link EYEBROW_CATASTRO}** — la parcela ha ENTRADO en el store después
 *     del arranque, o sea que la ha traído el cableado del Catastro. Vale
 *     también cuando ha salido de la copia local: sigue siendo un dato del
 *     Catastro, y de si se ha consultado el servicio o la caché —y de cuándo se
 *     guardó— habla el renglón `data-procedencia`, que es su sitio.
 *   · **{@link EYEBROW_SINTETICA}** — `?demo=hueco`: una parcela INVENTADA.
 *   · **{@link EYEBROW_DEMOSTRACION}** — el dataset por defecto: la geometría
 *     real de 9398516VK3799G, pero copiada dentro del código (ver la cabecera de
 *     `./demo-datos.js`), no traída del Catastro ahora. Decirle «Parcela
 *     cargada» —lo que trae `index.html`— sería, con el campo del Catastro al
 *     lado, hacerla pasar por una consulta que no se ha hecho.
 *
 * Sin parcela (`null`, que el store admite) se cae al lado conservador: el de la
 * demostración. Nunca se afirma «del Catastro» sin una parcela que lo respalde.
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {string}
 */
function rotuloDelDato(parcelaActual) {
  const hayParcela = parcelaActual !== null && parcelaActual !== undefined
  if (hayParcela && parcelaActual.idLocal !== ID_LOCAL_DEMO) return EYEBROW_CATASTRO
  return esSintetica ? EYEBROW_SINTETICA : EYEBROW_DEMOSTRACION
}

/**
 * La superficie que el Catastro DECLARA para esta parcela, o {@link
 * SIN_SUPERFICIE_CATASTRAL}. No se calcula NADA aquí: se pinta lo que el
 * servicio dijo, tal cual entró en el modelo (`cp:areaValue`). Si esta línea
 * cayera alguna vez en `superficie(recintos)`, la ficha compararía la medición
 * consigo misma y la discrepancia —que es media razón de ser de la app— saldría
 * siempre en cero.
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {string}
 */
function superficieCatastralDe(parcelaActual) {
  const declarada =
    parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.superficieCatastral
  return Number.isFinite(declarada)
    ? `${FORMATO_DECLARADO.format(declarada)} m²`
    : SIN_SUPERFICIE_CATASTRAL
}

/**
 * Repinta la ficha del pie desde el POJO de parcela. Suscriptor del store: se
 * llama en CADA `estado.set` (una coordenada editada en la tabla, un vértice
 * arrastrado en el mapa) y la superficie se recalcula sola.
 *
 * `superficie` (geo/area.js) es la ÚNICA fuente de la cifra: exterior menos
 * huecos, por la fórmula del polígono sobre UTM. No se cachea y no se reimplementa
 * aquí. Si el modelo llegara con el invariante roto (`recintos[0]` que no es
 * EXTERIOR), `superficie` LANZA a propósito y este suscriptor deja que el error
 * suba: es un bug del programa y tiene que sonar (regla de oro 1), no quedarse en
 * un guion en el pie.
 *
 * El SRS no sale de la parcela: `crearParcela` no porta `srs` (vive en el
 * Expediente), así que se pinta el del dataset, el mismo que se le da al visor.
 *
 * Desde F05 escribe también el EYEBROW de la cabecera, que es una afirmación
 * sobre la procedencia del dato y por tanto cambia cuando cambia el dato: ver
 * {@link rotuloDelDato} y la decisión 4 de la cabecera del módulo.
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {void}
 */
function actualizarFicha(parcelaActual) {
  const recintos = (parcelaActual && parcelaActual.recintos) || []
  const nVertices = recintos.reduce((total, recinto) => total + recinto.vertices.length, 0)

  eyebrow.textContent = rotuloDelDato(parcelaActual)

  fichaSrs.textContent = SRS_DEMO
  // `refcat` es `null` en el dataset sintético, y se DICE («Sin referencia») en
  // vez de dejar un guion: un guion se lee como «esto no ha cargado».
  fichaRefcat.textContent = (parcelaActual && parcelaActual.refcat) || SIN_REFCAT
  fichaVertices.textContent = FORMATO_ENTERO.format(nVertices)
  fichaSuperficie.textContent = `${FORMATO_SUPERFICIE.format(superficie(recintos))} m²`
  // Las dos líneas de F05. La de arriba es la MEDIDA (la calcula la app); esta
  // es la DECLARADA (la dice el Catastro), y van juntas para poder compararlas
  // de un vistazo.
  fichaSuperficieCatastral.textContent = superficieCatastralDe(parcelaActual)
  // Constante HOY, y a propósito: nadie pide las colindantes (ver «LO QUE NO SE
  // HA CABLEADO» en la cabecera), así que lo único cierto que se puede escribir
  // es que no se han consultado. ESTE es el sitio donde poner su recuento el día
  // que alguien —F07— llame a `colindantes()` del cableado; escribirlo desde
  // aquí, y no desde el cableado, es lo que mantiene la ficha con un solo dueño.
  fichaColindantes.textContent = SIN_COLINDANTES
}

estado.subscribe(actualizarFicha)
// `subscribe` NO notifica al suscribirse (ver `crearEstadoVista`): el primer
// pintado se hace a mano, o la ficha se quedaría con los guiones del HTML hasta
// la primera edición.
actualizarFicha(estado.get())

// ── 7 · Generación del GML (F04 · T6.1) ──────────────────────────────────────

/**
 * Referencia catastral REAL de una parcela, o `null` si no tiene.
 *
 * Se comprueba el CONTENIDO y no sólo la presencia: una `refcat` de espacios en
 * blanco no es una referencia, y colarla haría que el nombre del fichero llevara
 * un segmento vacío en vez de decir «sin referencia».
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {string|null}
 */
function referenciaCatastralDe(parcelaActual) {
  const refcat = parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.refcat
  return typeof refcat === 'string' && refcat.trim().length > 0 ? refcat : null
}

/**
 * IDENTIDAD de la parcela para `serializarParcelaCp`: `refcat ?? idLocal ??`
 * {@link IDENTIDAD_SIN_REFERENCIA}. De ella salen el `<localId>` del `inspireId`
 * y la base de los cuatro `gml:id`.
 *
 * NO es lo mismo que la referencia catastral, y por eso son dos funciones:
 *   · la IDENTIDAD nunca puede faltar (el serializador lanza con ella en blanco)
 *     y en un alta de particular es legítimo que sea el `idLocal` del modelo —es
 *     justo el patrón de `UTM_1.gml`, el alta real de un particular;
 *   · la REFERENCIA sí puede faltar, y cuando falta hay que DECIRLO en vez de
 *     rellenar el hueco con la identidad interna. `nombreFicheroGml` ya tiene el
 *     texto para eso («sin-referencia»); dárselo hecho sería tapárselo.
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {string}  Siempre un string no vacío.
 */
function identidadDe(parcelaActual) {
  const idLocal =
    parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.idLocal
  const local = typeof idLocal === 'string' && idLocal.trim().length > 0 ? idLocal : null
  return referenciaCatastralDe(parcelaActual) ?? local ?? IDENTIDAD_SIN_REFERENCIA
}

/**
 * La pareja `localId` ↔ `namespace` del `inspireId`, que la FAQ del Catastro fija
 * y que hasta el 2026-07-27 esta app incumplía.
 *
 * La regla, literal («¿Cómo nombrar las parcelas dentro de un GML de parcela
 * catastral?»):
 *
 *   · «Si la parcela está inscrita en las bases de datos de catastro, o se desea
 *     conservar la referencia catastral […], el valor del atributo identificativo
 *     localId será la referencia catastral y el valor del atributo namespace
 *     empleado será ES.SDGC.CP.»
 *   · «Si la parcela no existe en la base de datos de catastro se deberá emplear
 *     el valor del atributo namespace ES.LOCAL.CP y un identificador unívoco
 *     dentro del negocio jurídico.»
 *
 * O sea: los dos campos son UNA sola afirmación, no dos ajustes independientes.
 * La app venía poniendo la referencia catastral real como `localId` bajo
 * `ES.LOCAL.CP`, que dice a la vez «esta es su referencia catastral» y «esta
 * parcela no existe en el Catastro». Eso no era una preferencia discutible: era
 * una contradicción dentro del mismo elemento.
 *
 * `nationalCadastralReference` acompaña al namespace y no se decide aparte,
 * porque afirma exactamente lo mismo que `ES.SDGC.CP`: que la finca está inscrita
 * con esa referencia. Dejarlo vacío junto a `ES.SDGC.CP` sería volver a partir en
 * dos una única afirmación.
 *
 * El caso normal de esta herramienta es el segundo párrafo de arriba y a la vez
 * el primero: una RGA **alternativa** sobre una parcela que SÍ existe —el técnico
 * descarga su cartografía, corrige el lindero y vuelve a subirlo—, y ahí la
 * referencia se conserva. Sin referencia, es un alta y va todo a `ES.LOCAL.CP`.
 *
 * `cp:label` se queda VACÍO en los dos casos: es el número de orden de la parcela
 * dentro de un polígono y esta app no lo conoce. Vacío valida (su tipo no tiene
 * `minLength`, comprobado contra el XSD).
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {{namespaceInspire: string, nationalCadastralReference: string}}
 */
function identidadInspireDe(parcelaActual) {
  const refcat = referenciaCatastralDe(parcelaActual)
  return refcat === null
    ? { namespaceInspire: NAMESPACE_INSPIRE_DEFECTO, nationalCadastralReference: '' }
    : { namespaceInspire: NAMESPACE_INSPIRE_CATASTRO, nationalCadastralReference: refcat }
}

/**
 * Texto del renglón cuando la VALIDACIÓN bloquea: cuántos errores son y cuáles.
 *
 * El recuento va delante y completo; lo que se recorta es la enumeración (ver
 * {@link MOTIVOS_EN_RENGLON}). Un «no se puede generar» a secas —o, peor, un
 * botón gris y mudo— es un error silencioso de manual: el usuario ve apagado lo
 * único que la pantalla le ofrece hacer y no tiene forma de saber por qué.
 *
 * @param {import('../validation/_comun.js').Hallazgo[]} errores  Lista NO vacía.
 * @returns {string}
 */
function motivoDeBloqueo(errores) {
  const distintos = [...new Set(errores.map((e) => e.mensaje))]
  const visibles = distintos.slice(0, MOTIVOS_EN_RENGLON)
  const resto = distintos.length - visibles.length
  const recuento =
    errores.length === 1
      ? '1 error bloquea la generación del GML'
      : `${errores.length} errores bloquean la generación del GML`
  return (
    `${recuento}: ${visibles.join(' ')}` + (resto > 0 ? ` (…y ${resto} motivo(s) más.)` : '')
  )
}

/**
 * Texto del renglón cuando es el SERIALIZADOR el que no emite fichero. Es un
 * caso distinto del anterior y por eso tiene su propio texto: aquí la validación
 * de F02 dio el visto bueno y lo que ha aparecido es algo que sólo se ve al
 * redondear y al escribir (dos vértices que se funden, un punto de referencia
 * imposible). Decir «hay errores en la parcela» sería confuso; lo que hay es un
 * GML que no se puede escribir bien, y el detalle acaba de entrar en el panel.
 *
 * @param {string[]} bloqueos  `resumen.bloqueos` del serializador (tipos, sin repetir).
 * @returns {string}
 */
function motivoSinFichero(bloqueos) {
  const cuantos =
    bloqueos.length === 1
      ? 'ha aparecido un problema bloqueante'
      : `han aparecido ${bloqueos.length} problemas bloqueantes`
  return (
    `No se ha descargado ningún fichero: al escribir el GML ${cuantos} ` +
    `(${bloqueos.join(', ')}). El detalle está en el panel de avisos.`
  )
}

/**
 * Cablea el botón «Generar GML» del pie: el último metro de F04 y lo único de
 * toda la feature que el usuario llega a ver.
 *
 * ── QUÉ HACE AL PULSAR, EN ORDEN ──
 *   1. VALIDA con `validation/parcela.js`. Si `puedeGenerar` es `false` no se
 *      genera NADA y cada error entra por el panel con su mensaje.
 *   2. SERIALIZA con `gml/serialize-cp.js`.
 *   3. PUBLICA EN EL PANEL **TODAS** las detecciones del serializador. Este paso
 *      no es cosmético: es la regla de oro 1 viviendo aquí. Es la ÚNICA
 *      superficie de la aplicación donde el usuario se entera de que se le ha
 *      redondeado una coordenada, invertido un anillo o recalculado el punto de
 *      referencia — cosas que ocurren en silencio dentro de `gml/` y que hacen
 *      que el fichero que baja NO sea exactamente el dibujo que tenía delante.
 *      La severidad se traduce con {@link NIVEL_POR_SEVERIDAD}.
 *   4. DESCARGA si hay `xml`. Si es `null` lo dice en el renglón y no descarga:
 *      `descargarGml` tampoco bajaría nada (devolvería `SIN_CONTENIDO`), pero
 *      llamarlo para que diga que no puede sería pedirle que rediagnostique algo
 *      que ya sabemos.
 *
 * ── EL ESTADO DEL BOTÓN SE RE-EVALÚA, NO SE FIJA UNA VEZ ──
 * Va por `estado.subscribe`, igual que la ficha del pie, y no sólo al arrancar.
 * F06 permite mover vértices: un botón evaluado una única vez seguiría diciendo
 * «se puede generar» después de que el usuario cruzara el contorno consigo mismo,
 * y esa mentira acabaría en un GML rechazado por la Sede. `subscribe` NO notifica
 * al suscribirse, así que la primera evaluación se hace a mano.
 *
 * ⚠️ CADENCIA. Se valida en CADA `set`. Hoy es correcto (el store sólo cambia al
 * editar una celda de la tabla) y `validation/parcela.js` ya advierte en su
 * cabecera de que en parcelas grandes las reglas topológicas son O(n²) y de que
 * la cadencia de la validación en vivo es responsabilidad de la capa de arriba.
 * El sitio donde eso se resolverá —con un debounce— es F06, cuando el arrastre de
 * un vértice dispare un `set` por movimiento del ratón; hoy un debounce sería
 * complejidad sin caso de uso.
 *
 * ── POR QUÉ EL MANEJADOR NO SE FÍA DE `boton.disabled` ──
 * Vuelve a validar antes de generar. `disabled` es estado de PRESENTACIÓN: lo
 * escribe este mismo módulo a partir de una validación anterior, y entre una y
 * otra puede haber pasado cualquier cosa. Confiar en él sería hacer que la
 * corrección del fichero dependiera de que un atributo del DOM esté al día.
 *
 * @param {object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El MISMO
 *   store que el mapa, la tabla y la ficha.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos ya
 *   montado: por él salen los errores de validación y las detecciones de `gml/`.
 * @param {string} opciones.srs  SRS del expediente (`'EPSG:25830'`…).
 * @param {HTMLElement} [opciones.boton]  Por defecto, el nodo
 *   {@link SELECTOR_BOTON_GML} de la cáscara; si falta, `nodo` LANZA.
 * @param {HTMLElement} [opciones.renglon]  Ídem con {@link SELECTOR_ESTADO_GML}.
 * @param {() => Date} [opciones.ahora]  De dónde sale «ahora». Por defecto el
 *   reloj del sistema. Es un parámetro y no una llamada directa porque la fecha
 *   entra en el GML *y* en el nombre del fichero: poder fijarla es lo que permite
 *   afirmar algo exacto sobre los dos en una prueba. `gml/` no lo puede hacer por
 *   su cuenta (no consulta el reloj, por contrato).
 * @param {typeof descargarGml} [opciones.descargar]  La entrega del fichero.
 * @returns {{generar: () => (object|null), destruir: () => void}}  `generar`
 *   ejecuta el recorrido completo y devuelve el `ResultadoDescarga` (o `null` si
 *   no se llegó a descargar); `destruir` retira el oyente y la suscripción.
 * @throws {TypeError}  Si falta el botón o el renglón en la cáscara (contrato
 *   con `index.html`), vía {@link nodo}.
 */
export function cablearGeneracionGml({
  estado,
  panel,
  srs,
  boton = nodo(SELECTOR_BOTON_GML),
  renglon = nodo(SELECTOR_ESTADO_GML),
  ahora = () => new Date(),
  descargar = descargarGml,
} = {}) {
  /**
   * Escribe el renglón `role="status"`. Vacío + sin modificador es el estado
   * «todo en orden»: el CSS lo colapsa y el pie no da un salto de layout.
   *
   * @param {string} texto
   * @param {boolean} esError
   */
  function decir(texto, esError) {
    renglon.textContent = texto
    renglon.classList.toggle(CLASE_ESTADO_ERROR, esError)
  }

  /**
   * Valida el POJO que haya en el store. El `|| []` no es paranoia: el store
   * admite `null` (es su valor inicial documentado) y `validarParcela` LANZA si
   * no le dan un array — y lo hace con razón, porque para él eso es contrato
   * roto. Aquí «no hay parcela» es un estado legítimo de la app, y la respuesta
   * correcta es un array vacío, que la primera regla traduce a «falta el
   * contorno exterior»: un error del expediente, no una excepción.
   *
   * @param {object|null} parcelaActual
   * @returns {{errores: object[], avisos: object[], puedeGenerar: boolean}}
   */
  function validar(parcelaActual) {
    const recintos = (parcelaActual && parcelaActual.recintos) || []
    return validarParcela(recintos, { srs })
  }

  /** Deja el botón apagado y el renglón diciendo por qué. */
  function bloquear(errores) {
    boton.disabled = true
    decir(motivoDeBloqueo(errores), true)
  }

  /**
   * Suscriptor del store: re-evalúa si se puede generar y lo refleja en el par
   * botón + renglón. Los dos SIEMPRE a la vez — un botón apagado sin motivo al
   * lado es lo que este cableado existe para no producir.
   *
   * @param {object|null} parcelaActual
   */
  function refrescar(parcelaActual) {
    let errores
    let puedeGenerar
    try {
      ;({ errores, puedeGenerar } = validar(parcelaActual))
    } catch (causa) {
      // ── Aquí NO se relanza, y es la única excepción de este módulo ────────
      // `refrescar` corre en dos sitios donde relanzar hace más daño que bien:
      // al CABLEAR (dentro del ensamblaje de `app/main.js`) y desde un
      // `estado.subscribe`. Que `validarParcela` reviente por un dato corrupto
      // —comprobado: con una coordenada no finita lanza desde
      // `geo/huso.js#detectarHuso`— no es hipotético, porque el store admite
      // cualquier POJO sin validarlo.
      //
      // Si esto relanzara, la app entera dejaría de arrancar: no habría mapa, ni
      // tabla, ni ficha, ni panel de avisos. Y el usuario perdería justamente lo
      // que necesita para entender qué tiene mal. Apagar el botón y decirlo
      // conserva todo lo demás en pie, que es lo útil.
      //
      // El defecto NO se tapa: va a la consola por `console.error` y al panel
      // como ERROR. Lo que no hace es llevarse por delante la aplicación.
      boton.disabled = true
      decir(MENSAJE_FALLO_INESPERADO, true)
      panel.avisar(MENSAJE_FALLO_INESPERADO, { nivel: NIVEL.ERROR, causa })
      console.error('[gml] no se ha podido evaluar si la parcela puede generarse:', causa)
      return
    }
    if (puedeGenerar) {
      boton.disabled = false
      decir('', false)
      return
    }
    bloquear(errores)
  }

  /**
   * El recorrido completo. Ver la cabecera de {@link cablearGeneracionGml}.
   *
   * @returns {object|null}  El `ResultadoDescarga` de `gml/descargar.js`, o
   *   `null` si no se llegó a intentar la descarga.
   */
  function generar() {
    // En qué punto del recorrido estamos. Sirve para una sola cosa: elegir el
    // mensaje del `catch`. Se usa un marcador de fase en vez de un `try` anidado
    // alrededor de la entrega porque el anidado NO funciona —lo comprobé
    // rompiéndolo—: el `catch` interior escribe su mensaje, relanza, y el
    // exterior vuelve a capturar la MISMA excepción y pisa el renglón con el
    // mensaje genérico. El usuario acababa leyendo «fallo interno» cuando lo que
    // había fallado era la descarga de un GML perfectamente generado.
    let fase = FASE.GENERACION
    try {
      return recorrido(() => {
        fase = FASE.ENTREGA
      })
    } catch (causa) {
      const mensaje = fase === FASE.ENTREGA ? MENSAJE_FALLO_ENTREGA : MENSAJE_FALLO_INESPERADO
      // ── La red de la regla de oro 1 ───────────────────────────────────────
      // Un CONTRATO ROTO en las capas de abajo no llega como hallazgo: llega
      // como excepción. Y hay un camino MEDIDO, no hipotético, para que ocurra:
      // el store admite cualquier POJO (`crearEstadoVista` no valida nada) y
      // `crearRecinto` sólo protege a quien pase por él, así que una parcela con
      // una coordenada no finita puede acabar dentro. Comprobado ejecutándolo:
      // con un `NaN` en un vértice, `validarParcela` LANZA —no lo deja pasar en
      // silencio— desde `geo/huso.js#detectarHuso` («coordenada no finita»).
      // `serializarParcelaCp` lanza por su cuenta ante un `srs` no soportado o
      // una coordenada no publicable (`|v| >= 1e15`).
      //
      // Sin este `catch`, cualquiera de esas excepciones sube desde un manejador
      // de `click` y el usuario ve un botón que NO HACE NADA: pulsa, no baja
      // ningún fichero y nada le dice por qué. Eso es un error silencioso de
      // manual, y la regla de oro 1 dice que el usuario se entera.
      //
      // Por eso envuelve al recorrido ENTERO y no sólo a la serialización: el
      // primer camino real que encontré entra por la validación, que es el paso
      // 1. Un `catch` alrededor del paso 2 habría sido una red colocada justo
      // donde no está el agujero.
      //
      // Y se RELANZA a propósito: esto es un defecto de programación, así que
      // sigue teniendo que aparecer en la consola y en cualquier recogida de
      // errores. Decirlo al usuario Y relanzarlo atiende a los dos destinatarios;
      // tragárselo sería el otro error de la misma familia.
      decir(mensaje, true)
      panel.avisar(mensaje, { nivel: NIVEL.ERROR, causa })
      throw causa
    }
  }

  /**
   * El recorrido propiamente dicho, sin la red de {@link generar}.
   *
   * @param {() => void} entrandoEnEntrega  Se llama justo antes de intentar la
   *   descarga, para que {@link generar} sepa qué mensaje toca si algo revienta
   *   a partir de ahí. Ver el comentario del `catch`.
   * @returns {object|null}  El `ResultadoDescarga` de `gml/descargar.js`, o
   *   `null` si no se llegó a intentar la descarga.
   */
  function recorrido(entrandoEnEntrega) {
    const parcelaActual = estado.get()

    // ── 1 · Validación ──────────────────────────────────────────────────────
    const { errores, puedeGenerar } = validar(parcelaActual)
    if (!puedeGenerar) {
      // Al panel, uno por uno y con su mensaje: es donde el usuario puede leerlos
      // enteros (el renglón sólo cabe resumir). `e.nivel` ya es `NIVEL.ERROR` —se
      // pasa el del hallazgo en vez de escribirlo, para que las dos capas no
      // puedan divergir.
      for (const e of errores) panel.avisar(e.mensaje, { nivel: e.nivel })
      bloquear(errores)
      return null
    }

    // ── 2 · Serialización ───────────────────────────────────────────────────
    // Un solo instante para el fichero y para su nombre (ver la cabecera del
    // módulo, decisión 1).
    const fecha = ahora()
    const { xml, resumen, detecciones } = serializarParcelaCp({
      recintos: parcelaActual.recintos,
      srs,
      refcat: identidadDe(parcelaActual),
      // El PERFIL va EXPLÍCITO aunque hoy sea el defecto del serializador: es la
      // diferencia entre un fichero que la Sede admite y uno que rechaza, y no
      // puede quedar colgando de un valor por omisión de otro módulo.
      perfil: PERFIL.ENTREGA,
      // `namespaceInspire` y `nationalCadastralReference` son UNA sola decisión y
      // salen juntos de un solo sitio: ver {@link identidadInspireDe}.
      ...identidadInspireDe(parcelaActual),
      // `beginLifespanVersion` NO se pasa a propósito: en el perfil de entrega su
      // ausencia emite `xsi:nil="true" nilReason="other:unpopulated"`, que es lo
      // que trae la plantilla oficial y lo único honesto en un alta — desde
      // cuándo rige esa versión del objeto lo fija el Catastro al inscribirla, no
      // el declarante al subir el fichero. La `fecha` se sigue necesitando, pero
      // para el NOMBRE del fichero, que es lo de abajo.
      //
      // `label`, `puntoReferencia` y `timeStamp` se dejan en su defecto: el
      // primero porque esta app no conoce el número de orden de la parcela, y los
      // otros dos porque el perfil de entrega no los escribe.
    })

    // ── 3 · Regla de oro 1: TODO lo que decidió el serializador, al panel ────
    for (const d of detecciones) {
      panel.avisar(d.mensaje, { nivel: NIVEL_POR_SEVERIDAD[d.severidad] ?? NIVEL.AVISO })
    }

    // ── 4 · Entrega ─────────────────────────────────────────────────────────
    if (xml === null) {
      decir(motivoSinFichero(resumen.bloqueos), true)
      return null
    }

    // A partir de aquí el fallo se cuenta con un mensaje DISTINTO: el GML ya está
    // generado y sus detecciones ya están publicadas, así que lo que puede fallar
    // es la descarga (el navegador niega `createObjectURL`, la pestaña se está
    // cerrando). Para el usuario «tu dato no se puede escribir» y «el fichero está
    // bien pero no ha bajado» son cosas distintas y llevan a acciones distintas;
    // un solo mensaje para las dos le haría buscar el problema donde no está.
    entrandoEnEntrega()

    // La REFERENCIA (no la identidad) es lo que va en el nombre del fichero, y
    // la MISMA `fecha` que lleva dentro el `beginLifespanVersion`.
    const entrega = descargar(xml, { refcat: referenciaCatastralDe(parcelaActual), fecha })
    // El desenlace se dice SIEMPRE, salga bien o mal. Cuando falla, `descargarGml`
    // trae un `mensaje` en castellano ya presentable: se muestra tal cual y no se
    // duplica en el panel, porque el panel es para lo que le pasa al DATO y esto
    // es lo que le ha pasado a la ENTREGA.
    decir(
      entrega.descargado ? `Descargado «${entrega.nombre}».` : entrega.mensaje,
      !entrega.descargado,
    )
    return entrega
  }

  boton.addEventListener('click', generar)
  const desuscribir = estado.subscribe(refrescar)
  // Igual que la ficha: `subscribe` NO notifica al suscribirse, así que el primer
  // estado del botón se calcula a mano. Sin esta línea el botón se quedaría en el
  // `disabled` con el que nace en `index.html` —y con el renglón vacío— hasta la
  // primera edición: exactamente el botón gris y mudo que no se admite.
  refrescar(estado.get())

  return {
    generar,
    destruir() {
      boton.removeEventListener('click', generar)
      desuscribir()
    },
  }
}

// Sin nodos explícitos: los localiza `cablearGeneracionGml` con los selectores
// del contrato, y LANZA nombrándolos si `index.html` ha dejado de traerlos.
cablearGeneracionGml({ estado, panel, srs: SRS_DEMO })
