// viewer/edicion.js — F06 · La INTERACCIÓN de edición: gestos del mapa → modelo.
//
// `edit/snap.js`, `edit/offset.js` y `edit/vertices.js` son módulos PUROS: saben
// geometría y no saben que existe un ratón. `viewer/sincronizacion.js` sabe
// pintar y arrastrar, pero deliberadamente no inserta, no elimina y no engancha
// («Qué es de F06 y NO está aquí», en su cabecera). Este módulo es la bisagra
// entre las dos mitades: convierte gestos en operaciones y publica lo que esas
// operaciones cuentan.
//
// Es dueño de CUATRO cosas y de ninguna más:
//   1. la TECLA MODIFICADORA que apaga el snap,
//   2. el INDICADOR de enganche mientras dura el gesto,
//   3. el RESALTE del lado seleccionado,
//   4. las TRES operaciones que escriben en el modelo (insertar, eliminar,
//      desplazar lindero).
// No pinta la parcela, no pinta la tabla, no crea marcadores y no toca la
// `geometriaOficial` (regla de oro 2: aquí solo se lee, y solo como diana de
// snap). Quien dibuja sigue siendo `viewer/sincronizacion.js`.
//
// ── EL MAPA DE GESTOS (esto es lo que leerá quien escriba la ayuda) ──────────
//
//   · **Clic** en el mapa .......... SELECCIONA el lindero más cercano al punto
//     pinchado, si cae dentro de {@link UMBRAL_PUNTERIA_PX} píxeles. Si no cae
//     ninguno, DESELECCIONA. **Un clic no escribe NUNCA en el modelo**: cambia un
//     resalte, y nada más. Esa es la garantía; el resto de este apartado son
//     consecuencias de ella.
//   · **Doble clic** en el mapa .... INSERTA un vértice en el lindero más cercano
//     (proyectado sobre el lado, no en el punto crudo del clic). Es el ÚNICO
//     gesto del mapa que modifica la geometría.
//     ⚠️ Un doble clic contiene dos clics, y Leaflet los emite igualmente. O sea
//     que el gesto completo es: seleccionar ese lado (dos veces, idempotente) y
//     luego insertar en él. Es coherente —el vértice cae justo en el lado que
//     acaba de quedar resaltado— y sigue cumpliendo la regla: lo único que ha
//     escrito en el modelo es el DOBLE clic. Se descarta la alternativa de
//     retrasar la selección con un temporizador: metería latencia visible en el
//     gesto más frecuente (seleccionar) para arreglar algo que no está roto.
//     ⚠️ Además se DESACTIVA `doubleClickZoom` mientras este módulo vive (y se
//     restaura en `destruir`): insertar un vértice y ampliar el mapa con el mismo
//     gesto sí sería un efecto sorpresa.
//   · **Menú contextual** sobre un vértice ... lo ELIMINA. Se cablea desde
//     {@link crearEdicion} → `alCrearMarcador`, y se llama a
//     `L.DomEvent.preventDefault` para que no salga además el menú del navegador.
//   · **`Alt`** ..................... mientras está pulsada, el snap NO engancha.
//   · **MODO BORRAR** (`modoBorrar(true)`) ... mientras está encendido, el CLIC
//     del mapa **borra** el vértice que tenga a menos de {@link UMBRAL_PUNTERIA_PX}
//     px en vez de seleccionar el lindero, y el doble clic **no inserta**. Hay que
//     ARMARLO a propósito, se ve en el cursor, y se apaga con `Escape`, al salir de
//     Edición y al destruir. Todo el razonamiento está junto a la variable
//     `borrando` de {@link crearEdicion}.
//   · **MODO INSERTAR** (`modoInsertar(true)`) ... mientras está encendido, el CLIC
//     del mapa **inserta** un vértice en el lindero más cercano, por el mismo
//     `insertarEn` que el doble clic —que sigue funcionando—, y el doble clic deja
//     de insertar para no escribir tres veces con un gesto. Mismas tres formas de
//     apagarlo, y **EXCLUYENTE con el modo borrar**: los dos secuestran el clic
//     sencillo, así que armar uno apaga el otro. Razonamiento junto a `insertando`.
//
//   ⚠️ Esos dos modos son los ÚNICOS sitios donde un clic sencillo escribe en el
//   modelo, o sea la única excepción a la garantía de dos puntos más arriba.
//
// ── POR QUÉ `Alt` Y NO `Ctrl` NI `Shift` ────────────────────────────────────
// `Ctrl` colisiona con el zoom por rueda y con el pan de Leaflet; `Shift`, con su
// `boxZoom`. `Alt` es la única de las tres que Leaflet no usa. Y se lee por DOS
// caminos, porque ninguno de los dos basta solo:
//   · **Del evento real** (`eventoOriginal.altKey`) cuando lo hay. Es la verdad
//     del sistema operativo en el instante del gesto, y por eso TIENE PRIORIDAD.
//   · **De un seguimiento propio** de `keydown`/`keyup` sobre `document` cuando no
//     lo hay: un arrastre simulado por API (los tests, y cualquier automatismo
//     futuro) no trae evento original.
// El seguimiento se desincroniza si la ventana pierde el foco con la tecla
// pulsada —soltar `Alt` fuera de la pestaña no emite `keyup` aquí—, así que hay
// una guarda en el `blur` de la ventana que baja la bandera. Sin ella, el snap se
// quedaría apagado PARA SIEMPRE y EN SILENCIO: el error silencioso de manual.
// Y cuando llega un evento real, su `altKey` además RESINCRONIZA la bandera: la
// verdad del sistema corrige al seguimiento, nunca al revés.
//
// ── LA CACHÉ DE DIANAS, Y SU POLÍTICA DE INVALIDACIÓN ───────────────────────
// `dianasDe` recorre los puntos importados, el parcelario oficial, las colindantes
// y la geometría editable, y copia cada par `[x,y]`: sobre un catálogo lleno cuesta del orden de
// milisegundos. `ajustar` cuesta una fracción de eso y se llama en CADA fotograma
// del arrastre. Reconstruir el catálogo por fotograma se come el cuadro; por eso
// se construye UNA VEZ POR GESTO y se cachea.
//
// El catálogo se invalida —y esto es donde se esconden los bugs de esta clase, así
// que va escrito— cuando cambia CUALQUIERA de sus cuatro entradas:
//   1. **El estado**. Se compara la IDENTIDAD del POJO (`estado.get() !== cache.parcela`)
//      en cada consulta, y además se invalida desde el suscriptor del store. Hacen
//      falta las dos: el suscriptor NO se dispara en un `set` reentrante (la guarda
//      anti-reentrada de `crearEstadoVista` corta la cascada), y la comparación de
//      identidad no vería un `set` con el MISMO objeto mutado en sitio. Cada una
//      tapa el agujero de la otra. (Que nadie mute el estado en sitio es la regla
//      de la casa —`sincronizacion.js#aplicarVertice` clona— pero una caché que
//      depende de que nadie se equivoque no es una caché, es una apuesta.)
//   2. **Las colindantes**, por {@link crearEdicion}#fijarColindantes: guarda una
//      COPIA superficial, así que cada llamada cambia la identidad del array y la
//      caché cae sola.
//   3. **Los puntos importados** (2026-08-18), por {@link crearEdicion}#fijarPuntos,
//      con el mismo mecanismo que las colindantes: copia superficial, identidad
//      nueva, caché caída.
//      ⛔ **Y por eso la CLAVE de la caché los compara, además de la invalidación
//      explícita.** Una fuente nueva de `dianasDe` que no entra en la clave no
//      rompe nada ruidosamente —el snap sigue enganchando, no lanza, no pinta
//      nada raro—: engancha al catálogo VIEJO, el de antes de importar, y nadie
//      se queja. Es el fallo silencioso de manual, y la defensa estructural es que
//      la clave tenga TANTOS CAMPOS COMO FUENTES tiene `dianasDe`. Quien añada la
//      quinta fuente, que añada la quinta clave.
//      ⚠️ **Las dos guardas son REDUNDANTES entre sí, y está medido**: quitando
//      solo la clave, o solo el `cacheDianas = null` de `fijarPuntos`, la suite
//      sigue verde; quitando las dos caen tres pruebas. Ninguna prueba puede
//      distinguirlas desde fuera porque `puntos` no tiene otra vía de cambio, así
//      que no se escribió una que finja hacerlo. Lo que protege el comportamiento
//      es el test de «importar OTROS puntos cambia lo que engancha»; la clave está
//      por lo que venga después. Exactamente la misma situación que `vecinas`.
//   4. **El vértice excluido** (`excluir`), o sea la `RefVertice` del gesto. Cambia
//      al empezar a arrastrar otro vértice, que es exactamente «otro gesto».
// Lo que NO invalida: cambiar τ (`tolerancia(m)`) o encender/apagar el snap. El
// catálogo no depende de la tolerancia —τ solo se usa al comparar distancias—, y
// tirarlo por eso obligaría a reconstruirlo al soltar la tecla `Alt`, en mitad del
// arrastre. `destruir()` lo vacía.
//
// ── `excluir`: SE PASA SIEMPRE, Y LO PASA ESTE MÓDULO ───────────────────────
// `edit/snap.js` sabe quitar del catálogo el vértice arrastrado y sus dos lados,
// pero solo si alguien le dice cuál es. Ese alguien es este módulo: cada `ajustar`
// pasa la `RefVertice` del gesto como `excluir`. Sin eso el vértice se engancha a
// sí mismo (distancia 0, gana siempre) y queda CLAVADO en su sitio.
//
// ── CLASIFICACIÓN DE LOS AVISOS (la regla, no la intuición) ─────────────────
// Se aplica la REGLA DE CLASIFICACIÓN del typedef `Avisar` de `viewer/_comun.js`,
// con el precedente de `sincronizacion.js#aplicarVertice`:
//   · La operación que el usuario ha pedido **NO se aplica** → `NIVEL.ERROR`.
//     (Insertar demasiado lejos, insertar sobre un vértice que ya existe, eliminar
//     por debajo del mínimo de vértices, desplazar sin lado seleccionado, desplazar
//     0 m…)
//   · La operación **se aplica pero degradada** → `NIVEL.AVISO`. («Te lo he movido,
//     pero he biselado el pico»; «te lo he movido, pero no sé de qué lado está el
//     fuera de este anillo».)
// El nivel de las detecciones de `edit/offset.js` NO se decide con un catálogo de
// tipos —que quedaría desfasado en cuanto naciera un tipo nuevo— sino midiendo si
// el anillo cambió: si no cambió, la operación no se aplicó y TODO lo que cuenta
// es ERROR; si cambió, es AVISO. Un `TIPO_OFFSET` nuevo cae solo del lado correcto.
//
// **Los textos no se reescriben.** `edit/offset.js#MENSAJE_OFFSET` y
// `edit/vertices.js#MENSAJE_POR_MOTIVO` ya están redactados en español y son
// presentables tal cual: se publican VERBATIM. Dos textos para el mismo suceso
// divergen, y el que se queda viejo es siempre el de la UI.
//
// SOLO-NAVEGADOR: importa Leaflet, así que su test lleva sufijo `.dom` y este
// módulo NUNCA entra por el barrel raíz `index.js` (rompería la suite `node`:
// Leaflet exige `window`). Lo vigila `test/contrato.test.js`.
//
// NOTA DE DEUDA: `rotuloRecinto`, `describir`, `anillosDe` y `esHistorialUsable`
// son gemelas de las de `viewer/sincronizacion.js`, que las tiene privadas. Están
// duplicadas a propósito: extraerlas exigiría editar `_comun.js` o
// `sincronizacion.js`, y las dos tareas corren en paralelo con esta. La extracción
// queda pendiente para cuando la fase esté en un solo árbol.

import L from 'leaflet'

import { OPERATIVOS } from '../config/operativos.js'
import { commit as commitHistorial } from '../edit/historial.js'
import { desplazarLado } from '../edit/offset.js'
import { TIPO_ENGANCHE, ajustar as engancharPunto, dianasDe } from '../edit/snap.js'
import { MENSAJE_POR_MOTIVO, eliminarVertice, insertarVertice } from '../edit/vertices.js'
import { HUSOS_VALIDOS } from '../geo/huso.js'
import { distancia as distanciaEntre } from '../geo/metrica.js'
import { LONGITUD_NULA_METROS, proyectarEnSegmento } from '../geo/segmento.js'
import {
  COLOR_USUARIO,
  NIVEL,
  PANE,
  latLngAUTM,
  pedirZoomDobleClicApagado,
  resolverAvisar,
  soltarZoomDobleClicApagado,
  vertUTMaLatLng,
  UMBRAL_PUNTERIA_PX,
} from './_comun.js'

// ── Constantes ───────────────────────────────────────────────────────────────

/**
 * Clases CSS de las dos capas que este módulo pinta. **Estables**: `estilos/app.css`
 * y los tests apuntan a estos literales, no a copias.
 *
 * @readonly
 */
export const CLASE_EDICION = Object.freeze({
  /** Indicador de enganche (común a los dos tipos). */
  INDICADOR: 'gml-snap',
  /** Modificador: el enganche ha capturado un VÉRTICE. */
  INDICADOR_VERTICE: 'gml-snap--vertice',
  /** Modificador: el enganche ha capturado un punto de un LINDERO. */
  INDICADOR_LINDERO: 'gml-snap--lindero',
  /** Resalte del lado seleccionado. */
  RESALTE: 'gml-lado-seleccionado',
  /**
   * En el CONTENEDOR del mapa mientras el modo borrar está encendido. De ella
   * cuelga el único aviso permanente que ese modo tiene: el cursor. Un modo que
   * cambia lo que hace el clic y no cambia nada de lo que se ve es la definición
   * de trampa silenciosa — y aquí el clic pasa de «resaltar» a «destruir».
   *
   * Va en el contenedor y no en cada marcador a propósito: el gesto se atiende
   * en el `click` del MAPA (ver {@link crearEdicion}#alClicMapa), así que el modo
   * es del mapa entero, no de quince iconos.
   */
  MODO_BORRAR: 'gml-modo-borrar',
  /**
   * Ídem para el MODO INSERTAR (2026-08-18). Gemela de {@link MODO_BORRAR} y por
   * el mismo motivo, con una precisión que decide su existencia:
   *
   * ⚠️ **Cuelga de ella un cursor DISTINTO —`copy`, no `crosshair`—, y eso no es
   * cosmética.** Los dos modos son excluyentes y los dos secuestran el clic, así
   * que con el mismo cursor serían indistinguibles con la mano puesta sobre el
   * mapa. El único otro aviso es el botón pulsado de la barra, y de ése ya dice
   * `estilos/app.css` —donde vive la regla del cursor de borrar— que «vive abajo
   * del todo, a 400 px de donde está el ratón; el cursor viaja con la mano». Dos
   * modos armados que se ven igual es exactamente la trampa silenciosa que esa
   * regla existe para cerrar, con el agravante de que uno de los dos destruye.
   */
  MODO_INSERTAR: 'gml-modo-insertar',
})

/**
 * Estilo del resalte del lado seleccionado: un TRAZO GRUESO Y TRASLÚCIDO del color
 * del usuario, por debajo de la línea de 2 px que ya pinta `sincronizacion.js`. El
 * efecto es un halo alrededor del lindero elegido.
 *
 * No se usa un color distinto a propósito: los tres tonos que quedaban libres en el
 * lienzo ya están razonados en `viewer/_comun.js#COLOR_USUARIO` (ni rojo, que es la
 * cartografía catastral; ni azul, que es la hidrografía; ni verde, que es la
 * vegetación de la ortofoto), así que inventar un cuarto color para el resalte sería
 * volver a pelearse con la misma imagen. Un halo del MISMO color dice «este lindero,
 * el tuyo» sin competir con nada.
 *
 * `interactive: false` es obligatorio: el resalte cubre justo el lindero, y si
 * capturara clics haría imposible volver a pinchar en él.
 */
const ESTILO_RESALTE = Object.freeze({
  color: COLOR_USUARIO,
  weight: 7,
  opacity: 0.55,
  lineCap: 'round',
  interactive: false,
  className: CLASE_EDICION.RESALTE,
})

/**
 * Lienzo del indicador de enganche, en px CSS.
 *
 * Los 10 px del cuadradito de vértice de `sincronizacion.js` mandan aquí: la silueta
 * tiene que RODEAR al vértice **con holgura visible**, que es como se lee «he
 * capturado ESTE punto» y no «aquí hay otro punto más». Medido en navegador
 * (2026-07-28): con la silueta a 11 px sobre un vértice de 10 px el resultado era un
 * cuadrado dentro de otro cuadrado, prácticamente del mismo tamaño, y no se
 * distinguía cuál era cuál. El cuadrado va ahora a **18 px**, o sea 4 px de aire por
 * cada lado, y el lienzo a 26 para que quepa el halo sin recortarse.
 */
const LADO_INDICADOR_PX = 26

/**
 * Halo oscuro que va DEBAJO del trazo de color en las dos siluetas. No es adorno:
 * es lo que hace que un dibujo de líneas se lea igual sobre asfalto claro que sobre
 * arbolado en sombra, que es el mismo problema que `viewer/acotaciones.js` resuelve
 * con una píldora detrás del texto. Un trazo amarillo suelto sobre hormigón claro da
 * ~1,4:1 (ver el JSDoc de `viewer/_comun.js#COLOR_USUARIO`) y desaparece.
 */
const HALO_INDICADOR = 'rgba(15,23,42,.85)'

/**
 * Silueta del indicador de enganche, POR TIPO — **la convención OSNAP de AutoCAD**.
 *
 * ── POR QUÉ LA FORMA Y NO EL RELLENO (esto es la decisión, no el dibujo) ─────
 * Antes los dos tipos eran DOS CÍRCULOS del mismo tamaño, uno macizo y otro hueco.
 * Es una distinción que sobre el papel se entiende y en pantalla no existe: ocurre a
 * mitad de un arrastre, a 20 px del puntero, sobre una ortofoto de contraste
 * arbitrario y con el cuadradito amarillo del vértice justo debajo. Relleno y tamaño
 * son justo los dos canales que esa situación destruye.
 *
 * AutoCAD lleva décadas resolviéndolo con **siluetas**, y por eso se copia la suya:
 * la forma se reconoce de reojo, sobrevive al contraste malo y no depende del color
 * —que aquí, además, está ocupado (ni rojo, ni azul, ni verde: ver `COLOR_USUARIO`)—.
 *
 *   · **VÉRTICE → CUADRADO** = el *Punto final* (Endpoint) de AutoCAD. El enganche
 *     hace coincidir dos puntos EXACTAMENTE, y el cuadrado rodea el vértice
 *     capturado. La misma figura que el vértice, un punto discreto.
 *   · **LINDERO → RELOJ DE ARENA** = el *Cercano* (Nearest) de AutoCAD, y la
 *     equivalencia es literal, no una analogía: el punto puede caer en CUALQUIER
 *     sitio del segmento (`0 ≤ t ≤ 1`), deslizando sobre la línea. Las dos aspas
 *     dibujan esa línea que se cruza.
 *
 * `TIPO_ENGANCHE` es el código estable que `edit/snap.js` publica justamente para que
 * la UI decida sin leer ningún texto; las clases CSS viajan con la silueta para que
 * el estilo no pueda divergir del tipo que representa.
 *
 * ⚠️ `L.divIcon` y no `L.circleMarker`, y no es una preferencia: un `circleMarker`
 * **solo sabe dibujar círculos**. El precedente y su razón están en
 * `viewer/sincronizacion.js` (hallazgo C8): un `divIcon` con SVG en línea no descarga
 * nada, así que se ve igual en dev, en el build y en jsdom, mientras que `L.Icon`
 * depende de PNG cuyas URL rompe Vite.
 *
 * @param {string} interior  Figura SVG, SIN trazo: se pinta dos veces (halo + color).
 * @returns {string}  El `html` del `divIcon`.
 */
function svgIndicador(interior) {
  const lienzo = `0 0 ${LADO_INDICADOR_PX} ${LADO_INDICADOR_PX}`
  // La MISMA figura dos veces: primero gruesa y oscura (el halo), después fina y del
  // color del usuario. Es la técnica estándar de trazo doble; dibujarla dos veces sale
  // más barato y más nítido que un `filter: drop-shadow`, que además Leaflet reescala.
  const trazo = (color, ancho) =>
    interior.replace(
      '/>',
      ` fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linejoin="round" stroke-linecap="round"/>`,
    )
  return (
    `<svg width="${LADO_INDICADOR_PX}" height="${LADO_INDICADOR_PX}" viewBox="${lienzo}" ` +
    `aria-hidden="true" focusable="false" style="display:block;pointer-events:none;overflow:visible">` +
    `${trazo(HALO_INDICADOR, 4.5)}${trazo(COLOR_USUARIO, 2)}` +
    `</svg>`
  )
}

/**
 * Los dos iconos, construidos UNA vez por módulo. Compartirlos es seguro: Leaflet
 * fabrica un elemento nuevo en cada `createIcon()` (mismo razonamiento que el
 * `iconoVertice` de `viewer/sincronizacion.js`).
 *
 * @type {Readonly<Record<string, object>>}
 */
const ICONO_INDICADOR = Object.freeze({
  // Cuadrado de 18 px de lado dentro del lienzo de 26: 4 px de aire por cada lado
  // alrededor del vértice de 10 px (ver {@link LADO_INDICADOR_PX}).
  [TIPO_ENGANCHE.VERTICE]: L.divIcon({
    className: `${CLASE_EDICION.INDICADOR} ${CLASE_EDICION.INDICADOR_VERTICE}`,
    iconSize: [LADO_INDICADOR_PX, LADO_INDICADOR_PX],
    iconAnchor: [LADO_INDICADOR_PX / 2, LADO_INDICADOR_PX / 2],
    html: svgIndicador('<rect x="4" y="4" width="18" height="18"/>'),
  }),
  // Pajarita de 16 px: el polígono se cierra solo de (21,21) a (5,5), y ese cierre
  // ES la segunda aspa. Cuatro puntos dibujan la figura entera. Va algo más pequeña
  // que el cuadrado porque su silueta ocupa las dos diagonales del hueco y a igual
  // lado pesaría bastante más en el lienzo.
  [TIPO_ENGANCHE.LINDERO]: L.divIcon({
    className: `${CLASE_EDICION.INDICADOR} ${CLASE_EDICION.INDICADOR_LINDERO}`,
    iconSize: [LADO_INDICADOR_PX, LADO_INDICADOR_PX],
    iconAnchor: [LADO_INDICADOR_PX / 2, LADO_INDICADOR_PX / 2],
    html: svgIndicador('<polygon points="5,5 21,5 5,21 21,21"/>'),
  }),
})

// ── Mensajes propios ─────────────────────────────────────────────────────────
//
// Solo los que NO tienen dueño en `edit/`. Todo lo que `edit/offset.js` y
// `edit/vertices.js` ya redactan se publica verbatim (ver la cabecera).

/** No hay geometría editable en el store: no hay dónde insertar. */
const MSG_SIN_GEOMETRIA =
  'No se ha insertado ningún vértice: no hay ninguna geometría cargada en la que insertarlo. ' +
  'Carga una parcela o dibuja el contorno primero.'

/** No hay ni un lado utilizable (anillos de un punto, vértices no finitos…). */
const MSG_SIN_LADOS =
  'No se ha insertado ningún vértice: la geometría cargada no tiene ningún lindero sobre el que ' +
  'insertar (hacen falta al menos dos vértices distintos en algún recinto).'

/** No hay lado seleccionado y se ha pedido desplazarlo. */
const MSG_SIN_SELECCION =
  'No se ha desplazado ningún lindero: no hay ningún lado seleccionado. Pincha primero sobre el ' +
  'lindero que quieras mover y vuelve a intentarlo.'

/**
 * Clic en el vacío estando en modo borrar.
 *
 * ── Por qué ESTE gesto sí avisa y el clic en el vacío de la selección NO ─────
 * Fuera del modo borrar, pinchar lejos de todo DESELECCIONA: es una acción con
 * un efecto visible y deliberado, así que no hay nada que contar. En modo borrar
 * el mismo clic **no hace absolutamente nada**, y un modo armado que se traga un
 * clic en silencio es indistinguible de un modo que se ha apagado solo. Se dice
 * en qué radio hay que pinchar, que es la información que falta.
 */
const MSG_BORRAR_LEJOS =
  `No se ha borrado ningún vértice: no hay ninguno a menos de ${UMBRAL_PUNTERIA_PX} px del punto ` +
  `que has pinchado. En modo borrar hay que pinchar sobre el vértice, no sobre el lindero.`

// ── Helpers de módulo (puros) ────────────────────────────────────────────────

/** Describe un valor para el mensaje de un contrato roto. */
function describir(valor) {
  if (valor === null) return 'null'
  if (valor === undefined) return 'undefined'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/**
 * Rótulo legible del recinto `i`. `recintos[0]` es SIEMPRE el EXTERIOR (invariante
 * de `model/parcela.js`); los siguientes son huecos, numerados desde 1 para el
 * usuario. Gemela de la de `viewer/sincronizacion.js` (ver la nota de deuda).
 *
 * @param {number} i
 * @returns {string}
 */
const rotuloRecinto = (i) => (i === 0 ? 'EXTERIOR' : `HUECO ${i}`)

/** True si `p` es un par `[x, y]` de números finitos. */
const esPar = (p) =>
  Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])

/**
 * Anillos UTM (abiertos) del estado, como array por recinto. Un estado nulo o sin
 * recintos da `[]`; un recinto sin `vertices` cuenta como anillo VACÍO y NO se
 * filtra: filtrarlo desplazaría los índices y `RefVertice` dejaría de casar.
 *
 * @param {object|null} parcela
 * @returns {Array<Array<[number, number]>>}
 */
function anillosDe(parcela) {
  const recintos = parcela && Array.isArray(parcela.recintos) ? parcela.recintos : []
  return recintos.map((r) => (r && Array.isArray(r.vertices) ? r.vertices : []))
}

/**
 * Nº de LADOS de un anillo abierto de `n` vértices. Es la misma regla —y por los
 * mismos motivos— que `edit/snap.js#acumularAnillo`: con `n ≥ 3` hay `n` lados
 * (el último es el de CIERRE, que no está materializado); con `n === 2` hay UNO
 * (emitir `v0→v1` y `v1→v0` sería la misma línea dos veces); con `n < 2`, ninguno.
 *
 * @param {number} n
 * @returns {number}
 */
const numeroDeLados = (n) => (n < 2 ? 0 : n === 2 ? 1 : n)

/** ¿Los dos anillos tienen los MISMOS vértices, uno a uno? */
function mismosVertices(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false
  }
  return true
}

/**
 * ¿El objeto es el historial de `edit/historial.js` (`{pila, indice, limite}`)?
 * Una SOLA forma admitida, la real: la API de ese módulo es FUNCIONAL
 * (`commit(historial, estado)`), no un objeto con método. Mismo criterio —y misma
 * comprobación— que `viewer/sincronizacion.js`.
 */
const esHistorialUsable = (h) => !!h && typeof h === 'object' && Array.isArray(h.pila)

/**
 * Contrato del llamante: la {@link RefVertice} tiene la FORMA del typedef. Solo la
 * forma; que APUNTE a algo existente se comprueba aparte y no se trata igual (ver
 * `crearEdicion`).
 *
 * @param {unknown} ref
 * @param {string} fn
 * @returns {{recinto: number, indice: number}}
 * @throws {TypeError}
 */
function exigirFormaRef(ref, fn) {
  if (ref === null || typeof ref !== 'object' || Array.isArray(ref)) {
    throw new TypeError(
      `${fn}: la referencia debe ser una RefVertice {recinto, indice}; recibido ${describir(ref)}.`,
    )
  }
  const { recinto, indice } = ref
  if (!Number.isInteger(recinto) || recinto < 0) {
    throw new TypeError(
      `${fn}: 'recinto' debe ser un entero ≥ 0 (índice en recintos); recibido ${describir(recinto)}.`,
    )
  }
  if (!Number.isInteger(indice) || indice < 0) {
    throw new TypeError(
      `${fn}: 'indice' debe ser un entero ≥ 0 (índice en el anillo ABIERTO); ` +
        `recibido ${describir(indice)}.`,
    )
  }
  return { recinto, indice }
}

/**
 * Contrato del llamante sobre una tolerancia en METROS. `0` es válido y significa
 * «snap apagado» (es la semántica de `edit/snap.js#ajustar`, τ ≤ 0). NEGATIVA no:
 * una distancia negativa no es una tolerancia, es un error de tecleo del
 * programador que apagaría el snap sin decirlo.
 *
 * @param {unknown} valor
 * @param {string} fn
 * @returns {number}
 */
function exigirTolerancia(valor, fn) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new TypeError(
      `${fn}: 'tolerancia' debe ser un número finito de METROS; recibido ${describir(valor)}.`,
    )
  }
  if (valor < 0) {
    throw new RangeError(
      `${fn}: 'tolerancia' debe ser ≥ 0 metros (0 = snap apagado); recibido ${valor}.`,
    )
  }
  return valor
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('./_comun.js').RefVertice} RefVertice
 */

/**
 * @typedef {Object} Enganche  Lo que devuelve `ajustar`. `punto` SIEMPRE es
 *   utilizable: si no hubo enganche, es una copia del punto de entrada.
 * @property {[number, number]} punto
 * @property {boolean} enganchado
 * @property {'VERTICE'|'LINDERO'|null} tipo  Clave de `edit/snap.js#TIPO_ENGANCHE`.
 */

/**
 * Crea la capa de INTERACCIÓN de edición sobre un mapa ya montado.
 *
 * Devuelve, entre otras cosas, los DOS GANCHOS que `viewer/sincronizacion.js`
 * acepta para sus marcadores (`ajustar` y `alCrearMarcador`). Este módulo **no
 * edita `sincronizacion.js`**: produce las funciones y quien compone el visor se
 * las pasa. Por eso las firmas están congeladas.
 *
 * ```js
 * const edicion = crearEdicion({ mapa, estado, zona, historial, alAvisar })
 * sincronizar({ …, ajustar: edicion.ajustar, alCrearMarcador: edicion.alCrearMarcador })
 * // … al cerrar la pantalla, en orden inverso al montaje:
 * edicion.destruir()
 * ```
 *
 * Política de errores (SPEC §2 regla 1), con la frontera de siempre:
 *   · Contrato roto por el PROGRAMADOR (`mapa` que no es un `L.Map`, `estado` que no
 *     es el store, `zona` fuera de `HUSOS_VALIDOS`, `historial` que no es el POJO de
 *     `crearHistorial`, una `RefVertice` sin forma, una `distancia` no finita) →
 *     `throw` nombrando el argumento y lo recibido.
 *   · Gesto del USUARIO que no se puede atender (pinchar lejos, eliminar el vértice
 *     que dejaría el anillo en dos, desplazar 0 m) → NUNCA `throw`: se devuelve
 *     `aplicado: false` y se cuenta por `avisar` con el nivel que fija la regla de
 *     clasificación (ver la cabecera del módulo).
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa  Mapa ya creado (`viewer/mapa.js`).
 * @param {import('./_comun.js').EstadoVista} args.estado  El MISMO store que la tabla
 *   y el mapa. NO se crea otro: todo son vistas del mismo estado.
 * @param {number} args.zona  Huso UTM (29, 30 o 31).
 * @param {import('../edit/historial.js').Historial|null} [args.historial=null]  El
 *   POJO de `crearHistorial`, o `null` (defecto: entonces solo se hace `set`).
 * @param {number} [args.tolerancia=OPERATIVOS.snapMetros]  τ del snap, en METROS.
 * @param {import('./_comun.js').Avisar} [args.alAvisar]  Canal de aviso.
 * @returns {{
 *   ajustar: (utm: [number,number], refVertice: RefVertice|null, eventoOriginal?: object|null, opciones?: {dianasExtra?: Array<[number,number]>}) => (Enganche|null),
 *   alCrearMarcador: (marcador: object, refVertice: RefVertice) => void,
 *   snapActivo: (valor?: boolean) => boolean,
 *   tolerancia: (metros?: number) => number,
 *   seleccionarLado: (ref: RefVertice|null) => (RefVertice|null),
 *   ladoSeleccionado: () => (RefVertice|null),
 *   desplazarSeleccion: (distancia: number) => {aplicado: boolean, modo: string|null, detecciones: Array<object>},
 *   insertarEn: (latlng: object|[number,number]) => {aplicado: boolean, ref: RefVertice|null},
 *   eliminar: (refVertice: RefVertice) => {aplicado: boolean, motivo: string|null},
 *   fijarColindantes: (recintos: Array<object>) => void,
 *   fijarPuntos: (puntos: Array<[number,number]>) => void,
 *   alCambiarSeleccion: (fn: (ref: RefVertice|null) => void) => (() => void),
 *   modoBorrar: (valor?: boolean) => boolean,
 *   alCambiarModoBorrar: (fn: (activo: boolean) => void) => (() => void),
 *   modoInsertar: (valor?: boolean) => boolean,
 *   alCambiarModoInsertar: (fn: (activo: boolean) => void) => (() => void),
 *   destruir: () => void,
 * }}
 * @throws {TypeError|RangeError}
 */
export function crearEdicion({
  mapa,
  estado,
  zona,
  historial = null,
  tolerancia = OPERATIVOS.snapMetros,
  alAvisar,
} = {}) {
  // ── Contratos del programador: throw, nunca corrección callada ────────────
  if (
    !mapa ||
    typeof mapa.addLayer !== 'function' ||
    typeof mapa.removeLayer !== 'function' ||
    typeof mapa.on !== 'function' ||
    typeof mapa.off !== 'function' ||
    typeof mapa.latLngToLayerPoint !== 'function'
  ) {
    throw new TypeError(
      `crearEdicion: 'mapa' debe ser un L.Map (con addLayer/removeLayer/on/off y ` +
        `latLngToLayerPoint, que es lo que mide la puntería en píxeles); recibido ${describir(mapa)}.`,
    )
  }
  if (
    !estado ||
    typeof estado.get !== 'function' ||
    typeof estado.set !== 'function' ||
    typeof estado.subscribe !== 'function'
  ) {
    throw new TypeError(
      `crearEdicion: 'estado' debe ser el store de crearEstadoVista ({get,set,subscribe}); ` +
        `recibido ${describir(estado)}.`,
    )
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `crearEdicion: 'zona' inválida: ${JSON.stringify(zona)}. Válidas: ${HUSOS_VALIDOS.join(', ')}.`,
    )
  }
  if (historial !== null && historial !== undefined && !esHistorialUsable(historial)) {
    throw new TypeError(
      `crearEdicion: 'historial' debe ser el POJO de crearHistorial ({pila, indice, limite}) ` +
        `o null; recibido ${describir(historial)}.`,
    )
  }
  const avisar = resolverAvisar(alAvisar)

  // ── Estado interno ────────────────────────────────────────────────────────

  let vivo = true
  /**
   * ── Rework de UI · rebanada 3 (Edición), 2026-08-04 ────────────────────────
   * Si los CUATRO gestos de edición del mapa están vivos.
   *
   * **No es lo mismo que `vivo`**: aquél dice si el módulo existe (lo apaga
   * `destruir()` y no se enciende de vuelta); éste dice si la pantalla activa es
   * la de Edición, y se conmuta tantas veces como haga falta.
   *
   * ⛔ **LO QUE ESTO ARREGLA, MEDIDO.** Hasta hoy se podía arrastrar un vértice
   * —y borrarlo con el botón derecho, e insertar otro con doble clic— desde
   * CUALQUIERA de las cuatro pantallas: 15 de 15 marcadores arrastrables en
   * Validación, exactamente los mismos que en Edición. O sea que el peldaño
   * «Edición» del rail no cambiaba nada de lo que se podía hacer: era
   * decorativo, que es justo el síntoma que este rework existe para curar.
   *
   * Nace en `true` a propósito: `crearEdicion` es de `viewer/` y no sabe nada de
   * navegación (criterio 1 del plan). Quien lo conmuta es el aplicador de
   * `app/main.js`, suscrito a `app/navegacion.js`. Un visor montado sin
   * aplicador —los tests de este módulo, un mapa pelado— se comporta como antes.
   */
  let edicionActiva = true
  let toleranciaM = exigirTolerancia(tolerancia, 'crearEdicion')
  let snapEncendido = true
  /** Seguimiento propio de `Alt` (ver la cabecera: es el camino sin evento real). */
  let altPulsado = false

  /** Recintos de las parcelas vecinas (F05). COPIA superficial de lo que dan. */
  let colindantes = []
  /**
   * Lo mismo, con la forma que `dianasDe` espera para `colindantes`: una lista de
   * PARCELAS con su array `recintos`. El contrato público de `fijarColindantes` es
   * una lista de RECINTOS (más simple para el llamante y sin exigirle el POJO de
   * parcela entero), así que la adaptación se hace aquí, una vez por llamada, en
   * vez de en cada consulta del catálogo.
   */
  let vecinasParaDianas = []

  /**
   * Puntos sueltos del levantamiento importado (F11), en UTM y como PARES. COPIA
   * superficial de lo que dan, por el mismo motivo que `colindantes`.
   *
   * Aquí NO entra el vocabulario del DXF —`{capa, x, y, z}`—, igual que no entra en
   * `edit/snap.js`: este módulo trabaja en pares UTM y no conoce ni capas ni cotas.
   * La conversión es de quien cablea, y {@link crearEdicion}#fijarPuntos la exige
   * en voz alta en vez de tragarse los objetos y quedarse sin dianas en silencio.
   */
  let puntos = []

  /** Caché del catálogo de dianas. Ver la política de invalidación en la cabecera. */
  let cacheDianas = null

  /** Lado seleccionado: `{recinto, indice}` = el lado `indice → indice+1`, o `null`. */
  let seleccion = null
  const oyentesSeleccion = new Set()

  /**
   * ── EL MODO BORRAR ────────────────────────────────────────────────────────
   * Si está encendido, el clic del mapa **borra el vértice más cercano** en vez
   * de seleccionar el lindero más cercano. Es el único MODO de este módulo, y
   * conviene tener claro por qué existe y qué reglas se le aplican.
   *
   * **Por qué un modo y no un botón de «borra el seleccionado»**: borrar puntos
   * de un levantamiento es una tarea a granel —se importa un DXF con vértices de
   * más y se limpian ocho o diez seguidos—, y con un botón cada borrado cuesta
   * dos gestos (elegir, pulsar) en dos sitios distintos de la pantalla. Con el
   * modo cuesta uno, y siempre en el mismo sitio: encima del vértice.
   *
   * **Es EXCLUYENTE con lo que el clic hacía antes, y por eso al encenderlo se
   * suelta la selección de lindero.** Dejar el resalte pintado sobre un lado que
   * ya no se puede cambiar —porque el clic ya no selecciona— sería un mando que
   * miente sobre lo que va a pasar.
   *
   * **Y se apaga solo en tres sitios**: `Escape`, `activa(false)` (o sea, salir
   * de la pantalla de Edición) y `destruir()`. Un modo destructivo que sobreviva
   * a un cambio de pantalla es exactamente el accidente que no se puede permitir:
   * el usuario vuelve media hora después, pincha para mirar algo y borra un
   * vértice.
   */
  let borrando = false
  const oyentesModoBorrar = new Set()

  /**
   * ── EL MODO INSERTAR (2026-08-18) ─────────────────────────────────────────
   * Si está encendido, el clic del mapa **inserta un vértice en el lindero más
   * cercano** en vez de seleccionarlo: exactamente lo que ya hacía el doble clic,
   * con un gesto en vez de dos y con un mando que se ve.
   *
   * **Por qué existe, si el doble clic ya insertaba.** Porque no se descubría. El
   * gesto está documentado en la tabla `GESTOS` de `viewer/barra-edicion.js` como
   * «único gesto del mapa que cambia la geometría», y esa tabla vive detrás del
   * botón «?» — o sea que la capacidad más importante del editor era la única sin
   * representación en una barra donde todo lo demás sí la tiene. Y había una
   * asimetría que lo delataba: existía un modo para BORRAR vértice y no existía su
   * espejo para añadirlo.
   *
   * ⛔ **El doble clic NO se retira, y es una decisión.** El botón lo hace
   * descubrible; no lo sustituye. Quien ya lo tiene en los dedos no puede
   * encontrarse con que su gesto dejó de funcionar, y quien no lo conocía ya no lo
   * necesita. Las dos vías escriben por el MISMO {@link insertarEn}, así que no hay
   * dos definiciones de «insertar» que puedan divergir.
   *
   * **Es EXCLUYENTE con el modo borrar**, y por la razón más simple que hay: los
   * dos secuestran el clic sencillo, así que con los dos armados el clic no tendría
   * un significado. Encender uno apaga el otro, en {@link fijarModoBorrar} y en
   * {@link fijarModoInsertar}, y los dos anuncian — el botón de la barra que se
   * apaga solo se entera por su suscripción, no por el clic que no recibió.
   *
   * **Se apaga en los mismos tres sitios que borrar** (`Escape`, `activa(false)`,
   * `destruir()`). Aquí el motivo no es que sea destructivo —no lo es— sino que un
   * modo que sobrevive a un cambio de pantalla convierte el siguiente clic
   * distraído en una escritura en el modelo, y eso vale igual para crear que para
   * borrar: un vértice de más en un lindero es un defecto que F02 señala y que el
   * usuario no ha pedido.
   */
  let insertando = false
  const oyentesModoInsertar = new Set()

  let indicador = null
  /** Tipo del indicador VIVO, para no recrearlo en cada fotograma. */
  let tipoIndicador = null
  let resalte = null

  // ── Los dos apilados de este módulo, que NO son el mismo ──────────────────
  //
  // El RESALTE del lado va en el pane de la geometría editada (420), por DEBAJO del
  // de vértices (430): es un trazo GRUESO y traslúcido, y si subiera taparía los
  // vértices sobre los que el usuario tiene que seguir pinchando. Sin los panes del
  // visor (un mapa pelado, un test) cae al `overlayPane` de Leaflet (400), que sigue
  // por debajo del `markerPane` (600): la invariante se cumple igual, así que no es
  // una corrección callada de un contrato roto, es el otro caso legítimo.
  const panePropio =
    typeof mapa.getPane === 'function' && mapa.getPane(PANE.PARCELA_EDITADA)
      ? { pane: PANE.PARCELA_EDITADA }
      : {}

  // El INDICADOR va ARRIBA DEL TODO, y es lo contrario que el resalte a propósito.
  // Medido en navegador (2026-07-28): con el indicador en el pane de la geometría
  // editada (420), un enganche a LINDERO cerca del centro de un lado quedaba TAPADO
  // por su acotación —que vive en el pane 425 y se pinta justo en el punto medio del
  // lado, es decir, exactamente donde más cae este enganche—. El usuario veía la
  // cota y no veía a qué se estaba pegando: el indicador dejaba de hacer su único
  // trabajo justo en su caso más frecuente.
  //
  // El criterio es el de AutoCAD y se sostiene solo: la marca de referencia a objetos
  // es la respuesta al gesto EN CURSO y se dibuja encima de todo, porque dura lo que
  // dura el gesto. Lo ambiental (cotas, resalte) cede. Y no tapa el vértice que
  // rodea: la silueta es HUECA, así que el cuadradito amarillo se ve por dentro.
  const paneIndicador =
    typeof mapa.getPane === 'function' && mapa.getPane(PANE.VERTICES)
      ? { pane: PANE.VERTICES }
      : {} // sin panes del visor, un L.Marker cae al `markerPane` (600): también arriba

  const contenedor = typeof mapa.getContainer === 'function' ? mapa.getContainer() : null
  const doc = (contenedor && contenedor.ownerDocument) || globalThis.document || null
  const ventana = (doc && doc.defaultView) || globalThis.window || null

  // ── Lecturas del estado ───────────────────────────────────────────────────

  /** Anillo `r` del estado actual, o `null` si no existe. */
  function anilloDe(parcela, r) {
    const anillos = anillosDe(parcela)
    return Array.isArray(anillos[r]) ? anillos[r] : null
  }

  /** ¿Existe el vértice `(r, i)` en el estado, y es un par finito? */
  function verticeExiste(parcela, r, i) {
    const anillo = anilloDe(parcela, r)
    return anillo !== null && i < anillo.length && esPar(anillo[i])
  }

  // ── Tecla modificadora ────────────────────────────────────────────────────

  /**
   * `altKey` del evento recibido, o `null` si el evento no lo trae. Se admiten las
   * dos formas con las que puede llegar: un evento del DOM (`altKey` propio) y un
   * evento de Leaflet (que lo lleva dentro de `originalEvent`).
   */
  function altDelEvento(evento) {
    if (!evento || typeof evento !== 'object') return null
    if (typeof evento.altKey === 'boolean') return evento.altKey
    const original = evento.originalEvent
    if (original && typeof original.altKey === 'boolean') return original.altKey
    return null
  }

  /**
   * ¿Está `Alt` pulsada AHORA? El evento real manda sobre el seguimiento —y además
   * lo RESINCRONIZA—, porque el seguimiento es el que se puede haber quedado atrás.
   */
  function altVigente(evento) {
    const real = altDelEvento(evento)
    if (real === null) return altPulsado
    altPulsado = real
    return real
  }

  /** τ efectiva del gesto: 0 = snap apagado (semántica de `edit/snap.js#ajustar`). */
  function toleranciaEfectiva(evento) {
    return snapEncendido && !altVigente(evento) ? toleranciaM : 0
  }

  /**
   * Un `keydown` o un `keyup` cualquiera: la verdad está en `altKey`, no en `key`.
   * Leerlo así en vez de comparar `key === 'Alt'` resincroniza también cuando el
   * usuario pulsa cualquier OTRA tecla, que es información gratis sobre el estado
   * real del modificador.
   */
  const alTeclear = (evento) => {
    altPulsado = !!(evento && evento.altKey === true)
    // `Escape` apaga el modo borrar. Va aquí y no en un oyente propio porque este
    // ya está montado sobre el `document` por el seguimiento de `Alt`, y son la
    // misma clase de hecho: teclas que cambian lo que va a hacer el siguiente clic.
    //
    // ⚠️ Solo en `keydown` y solo si el modo está encendido: así `Escape` sigue
    // siendo de quien lo escuche (el panel de la barra, un diálogo) cuando aquí no
    // hay nada que cancelar. Y NO se llama a `preventDefault`: cancelar un modo
    // propio no puede robarle la tecla al navegador ni a nadie más.
    if (borrando && evento && evento.type === 'keydown' && evento.key === 'Escape') {
      fijarModoBorrar(false)
    }
    // Ídem para insertar (2026-08-18). Se comprueba aparte y no con un `||` porque
    // son excluyentes: como mucho uno de los dos está armado, así que la segunda
    // condición cuesta una comparación de booleano y se lee como lo que es —dos
    // modos que se cancelan con la misma tecla—, no como una rama compartida.
    if (insertando && evento && evento.type === 'keydown' && evento.key === 'Escape') {
      fijarModoInsertar(false)
    }
  }

  /**
   * La ventana pierde el foco: se baja la bandera. Sin esto, soltar `Alt` en OTRA
   * aplicación no emite `keyup` aquí y el snap se quedaría apagado para siempre y
   * en silencio.
   */
  const alPerderFoco = () => {
    altPulsado = false
  }

  // ── Catálogo de dianas (una vez por gesto) ────────────────────────────────

  /**
   * El catálogo vigente para este gesto. Ver la POLÍTICA DE INVALIDACIÓN en la
   * cabecera del módulo: las tres entradas se comparan por identidad y no se copia
   * nada.
   *
   * @param {object} parcela  `estado.get()` leído por el llamante.
   * @param {{recinto: number, indice: number}} ref
   * @returns {import('../edit/snap.js').Dianas}
   */
  function dianasVigentes(parcela, ref) {
    // ⚠️ `ref` puede ser `null` (F12: un punto que se está dibujando, que no es
    // vértice de nada todavía). Entonces no hay nada que excluir, y la caché se
    // indexa por `null`/`null` — que es una clave más, no un caso aparte.
    const recintoRef = ref === null ? null : ref.recinto
    const indiceRef = ref === null ? null : ref.indice
    if (
      cacheDianas !== null &&
      cacheDianas.parcela === parcela &&
      cacheDianas.vecinas === vecinasParaDianas &&
      cacheDianas.puntos === puntos &&
      cacheDianas.recinto === recintoRef &&
      cacheDianas.indice === indiceRef
    ) {
      return cacheDianas.dianas
    }
    const dianas = dianasDe({ parcela, colindantes: vecinasParaDianas, puntos, excluir: ref })
    cacheDianas = {
      parcela,
      vecinas: vecinasParaDianas,
      puntos,
      recinto: recintoRef,
      indice: indiceRef,
      dianas,
    }
    return dianas
  }

  // ── Indicador de enganche ─────────────────────────────────────────────────

  function ocultarIndicador() {
    if (indicador === null) return
    mapa.removeLayer(indicador)
    indicador = null
    tipoIndicador = null
  }

  /**
   * Marca visual sobre el punto enganchado, con la silueta que le toca a su tipo
   * (ver {@link ICONO_INDICADOR}). Se RECREA cuando cambia el tipo —para que la
   * silueta y la clase CSS no puedan divergir del tipo que representan— y se limita
   * a moverse mientras el tipo no cambia, que es el caso de cada fotograma.
   *
   * `interactive:false` y `keyboard:false` son obligatorios: el indicador aparece
   * ENCIMA del punto que el usuario está arrastrando, así que un clic capturado
   * rompería el gesto que está adornando, y una parada de tabulación por vértice
   * arruinaría el recorrido por teclado (mismo criterio que los marcadores de
   * `viewer/sincronizacion.js`).
   *
   * @param {[number, number]} puntoUTM
   * @param {'VERTICE'|'LINDERO'} tipo
   */
  function mostrarIndicador(puntoUTM, tipo) {
    const latlng = vertUTMaLatLng(puntoUTM, zona)
    if (indicador !== null && tipoIndicador === tipo) {
      indicador.setLatLng(latlng)
      return
    }
    ocultarIndicador()
    const icono = ICONO_INDICADOR[tipo]
    /* c8 ignore next -- `tipo` sale de TIPO_ENGANCHE; la guarda es por si crece */
    if (!icono) return
    indicador = L.marker(latlng, {
      icon: icono,
      interactive: false,
      keyboard: false,
      ...paneIndicador,
    }).addTo(mapa)
    tipoIndicador = tipo
  }

  // ── Resalte del lado seleccionado ─────────────────────────────────────────

  function quitarResalte() {
    if (resalte === null) return
    mapa.removeLayer(resalte)
    resalte = null
  }

  /**
   * Los dos extremos del lado seleccionado, en `[lat, lng]`, o `null` si el lado ya
   * no existe en el estado.
   */
  function extremosDelLado(sel) {
    const anillo = anilloDe(estado.get(), sel.recinto)
    if (anillo === null) return null
    const n = anillo.length
    if (numeroDeLados(n) === 0 || sel.indice >= n) return null
    const A = anillo[sel.indice]
    const B = anillo[(sel.indice + 1) % n]
    if (!esPar(A) || !esPar(B)) return null
    return [vertUTMaLatLng(A, zona), vertUTMaLatLng(B, zona)]
  }

  /**
   * Repinta el resalte desde el ESTADO.
   *
   * `arrastrado` es la excepción, y existe para que el resalte siga al vértice
   * durante el gesto: el arrastre NO escribe en el store hasta el `dragend` (así lo
   * decidió `sincronizacion.js`, y con razón: un `set` por fotograma reventaría el
   * historial), de modo que entre `dragstart` y `dragend` el estado aún dice que el
   * vértice está donde estaba. Si el vértice arrastrado es uno de los dos extremos
   * del lado resaltado, se sustituye SOLO ese extremo por su posición en vivo.
   *
   * @param {{recinto: number, indice: number, latlng: object}|null} [arrastrado]
   */
  function pintarSeleccion(arrastrado = null) {
    if (!vivo || seleccion === null) {
      quitarResalte()
      return
    }
    const par = extremosDelLado(seleccion)
    if (par === null) {
      quitarResalte()
      return
    }
    if (arrastrado !== null && arrastrado.recinto === seleccion.recinto) {
      const anillo = anilloDe(estado.get(), seleccion.recinto)
      const n = anillo === null ? 0 : anillo.length
      if (arrastrado.indice === seleccion.indice) par[0] = arrastrado.latlng
      else if (n > 0 && arrastrado.indice === (seleccion.indice + 1) % n) par[1] = arrastrado.latlng
    }
    if (resalte === null) resalte = L.polyline(par, { ...ESTILO_RESALTE, ...panePropio }).addTo(mapa)
    else resalte.setLatLngs(par)
  }

  const mismaRef = (a, b) =>
    (a === null && b === null) ||
    (a !== null && b !== null && a.recinto === b.recinto && a.indice === b.indice)

  function anunciarSeleccion() {
    const copia = seleccion === null ? null : { ...seleccion }
    for (const fn of oyentesSeleccion) fn(copia)
  }

  function anunciarModoBorrar() {
    for (const fn of oyentesModoBorrar) fn(borrando)
  }

  function anunciarModoInsertar() {
    for (const fn of oyentesModoInsertar) fn(insertando)
  }

  /**
   * Enciende o apaga el modo borrar, repinta el cursor y anuncia SOLO si ha
   * cambiado de verdad (mismo criterio que {@link fijarSeleccion}: un anuncio por
   * cambio real, nunca uno por llamada).
   *
   * La clase va en el CONTENEDOR del mapa. Es lo único que este módulo escribe en
   * el DOM fuera de sus dos capas, y es deliberado: el cursor pertenece a la
   * superficie sobre la que se pincha, no a un icono.
   *
   * @param {boolean} valor
   * @returns {boolean}  Lo que ha quedado.
   */
  function fijarModoBorrar(valor) {
    if (valor === borrando) return borrando
    borrando = valor
    if (contenedor && contenedor.classList) {
      contenedor.classList.toggle(CLASE_EDICION.MODO_BORRAR, borrando)
    }
    // Al ENCENDER se suelta el lindero: el clic ya no lo va a poder cambiar y el
    // resalte estaría prometiendo algo que no se cumple (ver `borrando`).
    if (borrando) fijarSeleccion(null)
    // …y se apaga el modo INSERTAR (2026-08-18): los dos secuestran el clic
    // sencillo, así que armados a la vez el clic no tendría UN significado. Va
    // ANTES del anuncio propio para que el orden que ven los oyentes sea el mismo
    // que el de los hechos: primero se apaga el que estaba, después se enciende el
    // que llega. Y no hay recursión: `fijarModoInsertar` solo apaga borrar cuando
    // ENCIENDE, y aquí llega con `false`.
    if (borrando) fijarModoInsertar(false)
    anunciarModoBorrar()
    return borrando
  }

  /**
   * Enciende o apaga el modo insertar. Gemela exacta de {@link fijarModoBorrar},
   * con las mismas tres reglas: anuncia solo si cambia de verdad, escribe su clase
   * en el CONTENEDOR del mapa (el cursor pertenece a la superficie sobre la que se
   * pincha, no a un icono), y apaga a su hermano al encenderse.
   *
   * Suelta el lindero seleccionado por el mismo motivo que borrar: el clic deja de
   * poder cambiarlo, y un resalte pintado sobre un lado que el siguiente clic ya no
   * va a seleccionar es un mando que miente sobre lo que va a pasar.
   *
   * @param {boolean} valor
   * @returns {boolean}  Lo que ha quedado.
   */
  function fijarModoInsertar(valor) {
    if (valor === insertando) return insertando
    insertando = valor
    if (contenedor && contenedor.classList) {
      contenedor.classList.toggle(CLASE_EDICION.MODO_INSERTAR, insertando)
    }
    if (insertando) fijarSeleccion(null)
    if (insertando) fijarModoBorrar(false)
    anunciarModoInsertar()
    return insertando
  }

  /** Fija la selección, repinta y anuncia SOLO si ha cambiado de verdad. */
  function fijarSeleccion(ref) {
    if (mismaRef(seleccion, ref)) {
      pintarSeleccion()
      return
    }
    seleccion = ref
    pintarSeleccion()
    anunciarSeleccion()
  }

  /**
   * Reubica la selección tras INSERTAR un vértice: si el vértice nuevo entra por
   * delante del lado resaltado (en el mismo anillo), ese lado pasa a tener un índice
   * más. Sin esto el resalte se quedaría señalando el lado de al lado, en silencio.
   *
   * Va por `fijarSeleccion`, así que el cambio de índice **se anuncia**: quien
   * llevara apuntada la `RefVertice` (un panel de offset, un rótulo) trabajaría si
   * no sobre un índice que ya significa otra cosa.
   */
  function reubicarPorInsercion(r, i) {
    if (seleccion === null || seleccion.recinto !== r) return
    if (i < seleccion.indice) fijarSeleccion({ recinto: r, indice: seleccion.indice + 1 })
  }

  /**
   * Reubica la selección tras ELIMINAR un vértice:
   *   · si se ha borrado el vértice que ABRE el lado resaltado, ese lado ya no
   *     existe como tal → se suelta la selección;
   *   · si se ha borrado uno anterior, el lado baja un índice;
   *   · si se ha borrado el que lo CIERRA, el lado sigue existiendo (ahora llega al
   *     siguiente vértice) y conserva su índice.
   * Como en la inserción, todo cambio pasa por `fijarSeleccion` y se anuncia.
   */
  function reubicarPorEliminacion(r, i) {
    if (seleccion === null || seleccion.recinto !== r) return
    if (i === seleccion.indice) fijarSeleccion(null)
    else if (i < seleccion.indice) fijarSeleccion({ recinto: r, indice: seleccion.indice - 1 })
  }

  // ── Escritura en el modelo: CLON → set → un commit ────────────────────────

  /**
   * Aplica unos `recintos` nuevos al estado. Es el MISMO patrón de
   * `sincronizacion.js#aplicarVertice`, y el clon no es cosmético: `commit`
   * fotografía con `structuredClone`, así que mutar en sitio dejaría al presente y a
   * su snapshot compartiendo memoria y el undo dejaría de deshacer.
   *
   * `geometriaOficial` se arrastra en el clon y NO se toca jamás (regla de oro 2):
   * las tres operaciones trabajan sobre `recintos` y solo sobre `recintos`.
   *
   * @param {object} actual  El estado leído por el llamante.
   * @param {Array<object>} nuevos  Recintos ya independientes (los de `edit/`).
   * @returns {object}  El estado nuevo, ya aplicado.
   */
  function aplicarRecintos(actual, nuevos) {
    const siguiente = structuredClone(actual)
    siguiente.recintos = nuevos
    estado.set(siguiente)
    // UN commit por operación acabada, y DESPUÉS del set. `historial` puede ser
    // null (es el defecto): entonces solo hay `set`.
    if (historial) commitHistorial(historial, siguiente)
    return siguiente
  }

  // ── Geometría de los gestos ───────────────────────────────────────────────

  /**
   * El lado más cercano al punto UTM `P`, con su proyección. Recorre TODOS los
   * recintos (exterior y huecos) y usa `geo/segmento.js#proyectarEnSegmento`, que es
   * la proyección punto→segmento propia del proyecto (regla de oro 6:
   * `turf.nearestPointOnLine` está prohibida sobre UTM).
   *
   * @param {object|null} parcela
   * @param {[number, number]} P
   * @returns {{recinto: number, indice: number, proy: object}|null}
   */
  function ladoMasCercano(parcela, P) {
    const anillos = anillosDe(parcela)
    let mejor = null
    for (let r = 0; r < anillos.length; r++) {
      const anillo = anillos[r]
      const n = anillo.length
      const lados = numeroDeLados(n)
      for (let i = 0; i < lados; i++) {
        const A = anillo[i]
        const B = anillo[(i + 1) % n]
        // Vértices no finitos o lados de longitud nula: dato posible del usuario
        // (lo señala F02), no un lindero. Se saltan sin lanzar, igual que en
        // `edit/snap.js`.
        if (!esPar(A) || !esPar(B)) continue
        if (distanciaEntre(A, B) <= LONGITUD_NULA_METROS) continue
        const proy = proyectarEnSegmento([P[0], P[1]], [A[0], A[1]], [B[0], B[1]])
        if (mejor === null || proy.distancia < mejor.proy.distancia) {
          mejor = { recinto: r, indice: i, proy }
        }
      }
    }
    return mejor
  }

  /**
   * El VÉRTICE más cercano al punto UTM `P`, mirando todos los recintos. Gemelo de
   * {@link ladoMasCercano} —misma forma de recorrido, misma tolerancia con el dato
   * malo, misma medida en metros— pero sobre puntos en vez de sobre segmentos.
   *
   * Se compara en METROS y el llamante convierte solo al ganador a píxeles, por la
   * razón que ya está escrita en {@link pixelesEntre}: el orden de los dos
   * criterios coincide a la escala de una parcela y convertir n vértices sería
   * pagar n desproyecciones para obtener el mismo ganador.
   *
   * @param {object|null} parcela
   * @param {[number, number]} P
   * @returns {{recinto: number, indice: number, punto: [number, number], distancia: number}|null}
   */
  function verticeMasCercano(parcela, P) {
    const anillos = anillosDe(parcela)
    let mejor = null
    for (let r = 0; r < anillos.length; r++) {
      const anillo = anillos[r]
      for (let i = 0; i < anillo.length; i++) {
        const V = anillo[i]
        // Vértice no finito: dato posible del usuario (lo señala F02), no una
        // diana. Se salta sin lanzar, igual que en `ladoMasCercano`.
        if (!esPar(V)) continue
        const distancia = distanciaEntre([P[0], P[1]], [V[0], V[1]])
        if (mejor === null || distancia < mejor.distancia) {
          mejor = { recinto: r, indice: i, punto: [V[0], V[1]], distancia }
        }
      }
    }
    return mejor
  }

  /**
   * Distancia EN PÍXELES DE PANTALLA entre dos puntos UTM. Se convierte solo el
   * candidato ganador (no los n lados): elegir el más cercano se hace en METROS,
   * que es una hipotenusa y no cuesta nada, y el orden de los dos criterios coincide
   * porque el factor de escala de la proyección es constante a la escala de una
   * parcela. Convertir n lados a píxeles sería pagar n desproyecciones para obtener
   * el mismo ganador.
   */
  function pixelesEntre(unUTM, otroUTM) {
    const a = mapa.latLngToLayerPoint(vertUTMaLatLng(unUTM, zona))
    const b = mapa.latLngToLayerPoint(vertUTMaLatLng(otroUTM, zona))
    return a.distanceTo(b)
  }

  // ── Las tres operaciones que escriben ─────────────────────────────────────

  /**
   * Inserta un vértice en el lindero más cercano al punto pinchado.
   *
   * **Se inserta el PIE de la proyección sobre el lado, no el punto crudo del
   * clic.** Insertar el punto crudo dejaría un pico en el lindero en cuanto el
   * usuario pinchara dos píxeles fuera de la línea — y nadie pincha dentro de la
   * línea.
   *
   * @param {object|[number, number]} latlng  Posición de Leaflet (`{lat,lng}` o par).
   * @returns {{aplicado: boolean, ref: RefVertice|null}}  `ref` es la del vértice
   *   NUEVO (`indice + 1` sobre el lado en el que ha entrado).
   */
  function insertarEn(latlng) {
    // Tras `destruir()` no se revienta y no se escribe: mismo precedente que
    // `app/cableado-catastro.js`, cuyas tres acciones devuelven sin hacer nada.
    if (!vivo) return { aplicado: false, ref: null }

    const parcela = estado.get()
    const recintos = parcela && Array.isArray(parcela.recintos) ? parcela.recintos : null
    if (recintos === null || recintos.length === 0) {
      // ERROR y no AVISO: la operación que el usuario acaba de pedir NO se aplica
      // (regla de clasificación del typedef `Avisar`, precedente `aplicarVertice`).
      avisar(MSG_SIN_GEOMETRIA, { nivel: NIVEL.ERROR })
      return { aplicado: false, ref: null }
    }

    const P = latLngAUTM(latlng, zona)
    const mejor = ladoMasCercano(parcela, P)
    if (mejor === null) {
      avisar(MSG_SIN_LADOS, { nivel: NIVEL.ERROR })
      return { aplicado: false, ref: null }
    }

    const px = pixelesEntre(P, mejor.proy.punto)
    if (px > UMBRAL_PUNTERIA_PX) {
      avisar(
        `No se ha insertado ningún vértice: has pinchado a ${Math.round(px)} px del lindero más ` +
          `cercano y el límite de puntería son ${UMBRAL_PUNTERIA_PX} px. Pincha sobre el lindero, ` +
          `o amplía el mapa para tener más sitio.`,
        { nivel: NIVEL.ERROR },
      )
      return { aplicado: false, ref: null }
    }

    // El pie cae en un EXTREMO (t = 0 o t = 1): ahí ya hay un vértice, e insertar
    // otro dejaría dos vértices en la misma coordenada — el «vértice duplicado» que
    // luego F02 señala y que rompe el snap (un lado de longitud cero no es un
    // lindero). Se rechaza y se dice cuál es el vértice que ya está.
    if (mejor.proy.enExtremo !== null) {
      const n = anilloDe(parcela, mejor.recinto).length
      const existente = mejor.proy.enExtremo === 'A' ? mejor.indice : (mejor.indice + 1) % n
      avisar(
        `No se ha insertado ningún vértice: el punto cae justo sobre el vértice ${existente + 1} ` +
          `de ${rotuloRecinto(mejor.recinto)}, donde ya hay uno. Pincha en un punto intermedio del ` +
          `lindero, no en su extremo.`,
        { nivel: NIVEL.ERROR },
      )
      return { aplicado: false, ref: null }
    }

    const ref = { recinto: mejor.recinto, indice: mejor.indice }
    const nuevos = insertarVertice(recintos, ref, mejor.proy.punto)
    // Antes del `set`: el suscriptor repinta el resalte, y debe encontrarse ya la
    // selección reubicada.
    reubicarPorInsercion(ref.recinto, ref.indice)
    aplicarRecintos(parcela, nuevos)
    return { aplicado: true, ref: { recinto: ref.recinto, indice: ref.indice + 1 } }
  }

  /**
   * Elimina un vértice.
   *
   * @param {RefVertice} refVertice
   * @returns {{aplicado: boolean, motivo: string|null}}  `motivo` es una clave de
   *   `edit/vertices.js#MOTIVO_VERTICE` cuando ese módulo se ha negado; `null`
   *   también cuando no se ha aplicado por una razón que no está en su catálogo (el
   *   vértice ya no existe), que aquí se cuenta con texto propio.
   */
  function eliminar(refVertice) {
    if (!vivo) return { aplicado: false, motivo: null }
    const ref = exigirFormaRef(refVertice, 'eliminar')

    const parcela = estado.get()
    if (!verticeExiste(parcela, ref.recinto, ref.indice)) {
      // No se lanza aunque la referencia esté fuera de rango (y `eliminarVertice`
      // sí lanzaría): esto llega de un menú contextual sobre un marcador que puede
      // haberse quedado viejo, o sea de un GESTO, no de un bug. Y es ERROR porque
      // la operación no se aplica — es el mismo caso, y el mismo texto, que
      // `sincronizacion.js#aplicarVertice`.
      avisar(
        `No se ha eliminado nada: el vértice ${ref.indice + 1} de ${rotuloRecinto(ref.recinto)} ` +
          `ya no existe en la parcela.`,
        { nivel: NIVEL.ERROR },
      )
      return { aplicado: false, motivo: null }
    }

    const { recintos: nuevos, motivo } = eliminarVertice(parcela.recintos, ref)
    if (motivo !== null) {
      // Texto de `edit/vertices.js`, VERBATIM: quien escribió la regla escribió el
      // mensaje. ERROR porque no se ha eliminado nada.
      avisar(MENSAJE_POR_MOTIVO[motivo], { nivel: NIVEL.ERROR })
      return { aplicado: false, motivo }
    }

    reubicarPorEliminacion(ref.recinto, ref.indice)
    aplicarRecintos(parcela, nuevos)
    return { aplicado: true, motivo: null }
  }

  /**
   * Desplaza el lado SELECCIONADO en paralelo a sí mismo (offset perpendicular).
   *
   * `distancia > 0` aleja el lindero del interior de su propio anillo; el signo lo
   * resuelve `edit/offset.js` midiendo la orientación, no por convención.
   *
   * **La `distancia` es contrato del PROGRAMADOR**: si no es un número finito,
   * `desplazarLado` lanza y aquí no se intercepta. Lo que el usuario teclea lo
   * convierte antes quien cablee el campo (igual que la celda de coordenada pasa por
   * `viewer/celda.js#parsearCoordenada`); un `NaN` que llegara hasta aquí sería un
   * parseo que falta, no un dato.
   *
   * @param {number} distancia  Metros.
   * @returns {{aplicado: boolean, modo: string|null, detecciones: Array<object>}}
   */
  function desplazarSeleccion(distancia) {
    const nada = { aplicado: false, modo: null, detecciones: [] }
    if (!vivo) return nada

    if (seleccion === null) {
      avisar(MSG_SIN_SELECCION, { nivel: NIVEL.ERROR })
      return nada
    }
    const parcela = estado.get()
    if (!verticeExiste(parcela, seleccion.recinto, seleccion.indice)) {
      avisar(
        `No se ha desplazado ningún lindero: el lado que estaba seleccionado (vértice ` +
          `${seleccion.indice + 1} de ${rotuloRecinto(seleccion.recinto)}) ya no existe en la ` +
          `parcela. Vuelve a seleccionar el lindero.`,
        { nivel: NIVEL.ERROR },
      )
      fijarSeleccion(null)
      return nada
    }

    const antes = parcela.recintos[seleccion.recinto].vertices
    const resultado = desplazarLado(parcela.recintos, seleccion, distancia)
    const despues = resultado.recintos[seleccion.recinto].vertices

    // El nivel de TODAS las detecciones sale de UN hecho medido —¿cambió el
    // anillo?— y no de un catálogo por tipo, que quedaría desfasado en cuanto
    // `edit/offset.js` publicara un `TIPO_OFFSET` nuevo. Ver la cabecera.
    const aplicado = !mismosVertices(antes, despues)
    const nivel = aplicado ? NIVEL.AVISO : NIVEL.ERROR
    for (const deteccion of resultado.detecciones) avisar(deteccion.mensaje, { nivel })

    if (!aplicado) {
      return { aplicado: false, modo: resultado.modo, detecciones: resultado.detecciones }
    }

    // Un BEVEL añade vértices al anillo, así que el índice del lado deja de
    // significar lo mismo — y `edit/offset.js` no publica en qué extremo biseló
    // (solo lo cuenta en el TEXTO de la detección, que es para el humano). En vez de
    // dejar el resalte señalando OTRO lado, se suelta la selección: el resalte
    // desaparece a la vista y los suscriptores se enteran, que es lo contrario de
    // hacerlo en silencio.
    if (antes.length !== despues.length) fijarSeleccion(null)

    aplicarRecintos(parcela, resultado.recintos)
    return { aplicado: true, modo: resultado.modo, detecciones: resultado.detecciones }
  }

  // ── Selección ─────────────────────────────────────────────────────────────

  /**
   * Selecciona el lado `indice → indice+1` del recinto indicado, o suelta la
   * selección con `null`.
   *
   * @param {RefVertice|null} ref
   * @returns {RefVertice|null}  La selección resultante (copia).
   */
  function seleccionarLado(ref) {
    if (!vivo) return null
    if (ref === null || ref === undefined) {
      fijarSeleccion(null)
      return null
    }
    const r = exigirFormaRef(ref, 'seleccionarLado')
    const parcela = estado.get()
    if (!verticeExiste(parcela, r.recinto, r.indice)) {
      avisar(
        `No se ha podido seleccionar ese lindero: el vértice ${r.indice + 1} de ` +
          `${rotuloRecinto(r.recinto)} no existe en la parcela.`,
        { nivel: NIVEL.ERROR },
      )
      fijarSeleccion(null)
      return null
    }
    fijarSeleccion({ recinto: r.recinto, indice: r.indice })
    return { ...seleccion }
  }

  /** La selección actual, en COPIA: un suscriptor no puede mutarnos el estado. */
  const ladoSeleccionado = () => (seleccion === null ? null : { ...seleccion })

  // ── Los dos ganchos de `viewer/sincronizacion.js` ─────────────────────────

  /**
   * Engancha el punto del gesto a la diana más cercana dentro de τ.
   *
   * Se llama en CADA FOTOGRAMA del arrastre, así que aquí no se construye nada que
   * se pueda reutilizar (ver la caché de dianas) y no se toca el store.
   *
   * @param {[number, number]} utm  Posición actual del vértice, UTM (m).
   * @param {RefVertice|null} refVertice  El vértice que se está moviendo. Se pasa
   *   a `dianasDe` como `excluir`: sin eso el vértice se engancha a sí mismo.
   *
   *   ⛔ **`null` es un valor LEGÍTIMO desde F12, y significa «no estoy moviendo
   *   ningún vértice existente»**: es el caso de `viewer/dibujo.js`, que engancha
   *   los puntos de un recinto que todavía no está en el modelo. Ahí no hay nada
   *   que excluir del catálogo, y `dianasDe` ya admite `excluir: null` desde F06.
   *
   *   Hasta el 2026-08-06 esto **lanzaba** con `null`, y era un defecto de encaje
   *   de manual: los dos módulos pasaban sus pruebas por separado —las de
   *   `viewer/dibujo.js` con un `ajustar` de mentira— y no encajaban. Lo destapó
   *   la primera prueba que los juntó, en `app/cableado-edificio.js`. Lo que sí
   *   sigue lanzando es una referencia MAL FORMADA (`{}`, `3`, un array): eso es
   *   el contrato del programador que `exigirFormaRef` defiende, y no se afloja.
   * @param {object|null} [eventoOriginal]  El evento del gesto, si lo hay. Solo se
   *   le mira `altKey` (directo o en `originalEvent`).
   * @param {{dianasExtra?: Array<[number,number]>}} [opciones]  ⭐ **(2026-08-19)**
   *   Pares UTM que se añaden al catálogo **como VÉRTICES**, solo para esta llamada.
   *
   *   Existe por un caso concreto: `viewer/dibujo.js` engancha los vértices de un
   *   recinto que **todavía no está en el modelo**, así que el catálogo no los
   *   conoce y no había forma de poner un vértice exactamente encima de otro ya
   *   puesto — que es lo que hace falta para volver sobre el trazo o rematar
   *   contra una esquina que uno mismo acaba de clavar.
   *
   *   ⚠️ **Se pasan por aquí y no se engancha aparte, y esa es toda la decisión.**
   *   Un segundo `ajustar` dentro de `viewer/dibujo.js` tendría su propia
   *   tolerancia y su propia idea de la tecla `Alt`, y los dos criterios de
   *   proximidad discreparían el día que el usuario cambiara τ. Aquí τ sigue
   *   siendo **una**.
   *
   *   ⚠️ Y **NO invalidan la caché de dianas**: se añaden sobre una copia del
   *   catálogo vigente. Cambian en cada clic, así que meterlas en la clave dejaría
   *   la caché inútil justo en el gesto que más la usa.
   * @returns {Enganche|null}  `null` significa **«no tengo opinión: usa tu punto tal
   *   cual»**, y ocurre con el snap apagado (tecla o `snapActivo(false)`), sin estado,
   *   con una referencia que ya no señala ningún vértice, o tras `destruir()`. Con
   *   objeto, `punto` es SIEMPRE utilizable (copia del de entrada si no enganchó).
   */
  function ajustar(utm, refVertice, eventoOriginal = null, { dianasExtra = [] } = {}) {
    if (!vivo) return null
    // `null` = «no muevo ningún vértice»; cualquier otra cosa tiene que tener la
    // forma de una RefVertice. Ver el porqué en la firma.
    const ref = refVertice === null ? null : exigirFormaRef(refVertice, 'ajustar')

    const tau = toleranciaEfectiva(eventoOriginal)
    if (tau <= 0) {
      // Snap apagado: ni se construye el catálogo ni queda indicador colgando.
      ocultarIndicador()
      return null
    }

    const parcela = estado.get()
    // Referencia que ya no señala nada: NO se lanza en mitad de un arrastre y no se
    // engancha. Y no es un error tragado: mover un vértice que ya no existe lo
    // detecta y lo cuenta `sincronizacion.js#aplicarVertice` en el `dragend`, que es
    // su dueño. Aquí solo se renuncia a opinar.
    //
    // ⚠️ Sin referencia no hay nada que comprobar: el punto que se está dibujando
    // no está en el modelo por definición, y exigirle que exista lo dejaría sin
    // enganche justo en el gesto para el que se hizo el enganche.
    if (ref !== null && !verticeExiste(parcela, ref.recinto, ref.indice)) {
      ocultarIndicador()
      return null
    }

    // El catálogo cacheado, más lo que pida el llamante SOLO para esta llamada. La
    // copia es superficial y se hace únicamente cuando hay extras: en el arrastre
    // —que llama aquí en cada fotograma— no se paga nada.
    let dianas = dianasVigentes(parcela, ref)
    if (Array.isArray(dianasExtra) && dianasExtra.length > 0) {
      // Delante de los demás vértices, por lo mismo que `dianasDe` pone primeros
      // los puntos importados: en un empate a distancia manda lo que el usuario
      // acaba de poner. Los pares mal formados los descarta `edit/snap.js#ajustar`,
      // igual que descarta un vértice degenerado del modelo.
      dianas = { vertices: [...dianasExtra, ...dianas.vertices], segmentos: dianas.segmentos }
    }
    const enganche = engancharPunto(utm, dianas, { tolerancia: tau })
    if (enganche.enganchado) mostrarIndicador(enganche.punto, enganche.tipo)
    else ocultarIndicador()

    return { punto: enganche.punto, enganchado: enganche.enganchado, tipo: enganche.tipo }
  }

  /**
   * Cablea un marcador de vértice recién creado por `viewer/sincronizacion.js`.
   *
   * Añade TRES oyentes al marcador y **no lleva ninguna lista paralela**:
   * `quitarMarcadores` hace `m.off()` en cada reconstrucción, así que estos oyentes
   * se retiran solos. Una lista propia se quedaría obsoleta en la primera
   * reconstrucción y apuntaría a marcadores que ya no están en el mapa.
   *
   * @param {import('leaflet').Marker} marcador
   * @param {RefVertice} refVertice
   * @returns {void}
   */
  function alCrearMarcador(marcador, refVertice) {
    if (!vivo) return
    if (!marcador || typeof marcador.on !== 'function' || typeof marcador.getLatLng !== 'function') {
      throw new TypeError(
        `alCrearMarcador: 'marcador' debe ser un L.Marker (con on/getLatLng); ` +
          `recibido ${describir(marcador)}.`,
      )
    }
    const ref = exigirFormaRef(refVertice, 'alCrearMarcador')

    // Éste es MÍO: es la única marca de propiedad que hay, y de ella depende que
    // `activa()` no toque los marcadores de la otra edición (ver
    // {@link marcadoresDeVertice}).
    mios.add(marcador)

    // Los marcadores se REHACEN en cada `sincronizar`, así que el estado de la
    // pantalla hay que aplicarlo también aquí: sin esto, cargar una parcela
    // estando en Validación devolvería 15 vértices arrastrables.
    aplicarArrastre(marcador)

    marcador.on('contextmenu', (evento) => {
      if (!vivo || !edicionActiva) return
      // Sin esto saldría ADEMÁS el menú del navegador encima del vértice.
      const dom = evento && evento.originalEvent ? evento.originalEvent : evento
      if (dom && typeof dom.preventDefault === 'function') L.DomEvent.preventDefault(dom)
      eliminar(ref)
    })

    marcador.on('drag', () => {
      if (!vivo || seleccion === null) return
      pintarSeleccion({ recinto: ref.recinto, indice: ref.indice, latlng: marcador.getLatLng() })
    })

    marcador.on('dragend', () => {
      if (!vivo) return
      // El indicador es del GESTO: se va con él, enganchara o no.
      ocultarIndicador()
      pintarSeleccion()
    })
  }

  // ── Gestos del mapa ───────────────────────────────────────────────────────

  /** Clic: selecciona el lindero más cercano, o deselecciona. NUNCA escribe. */
  /**
   * Pone el arrastre de UN marcador en lo que diga `edicionActiva`.
   *
   * `marcador.dragging` es el `L.Handler` que Leaflet monta cuando el marcador se
   * crea con `draggable: true` (`viewer/sincronizacion.js:958`, cableado en duro).
   * Apagar el oyente de `drag` NO bastaría: quien mueve el icono es `L.Draggable`
   * por CSS, así que el vértice se movería en pantalla aunque el modelo no se
   * enterara — el peor de los dos mundos.
   */
  function aplicarArrastre(marcador) {
    if (!marcador || !marcador.dragging) return
    if (edicionActiva) marcador.dragging.enable()
    else marcador.dragging.disable()
  }

  /**
   * Los marcadores de vértice **DE ESTA INSTANCIA** que están vivos en el mapa.
   *
   * ⛔ **Hasta F12 esto barría el mapa ENTERO** (`eachLayer` + `capa.refVertice`),
   * y con una sola edición daba igual. Con DOS —la de la parcela y la de la parte
   * activa del edificio, que es lo que F12 estrena— **no da igual, y está medido**
   * (F12 · M4, 2026-08-06, jsdom): con 4 marcadores de cada una en el mismo pane,
   * `edicionA.activa(false)` dejaba **0 de 8** arrastrables —apagaba también los de
   * B— y `activa(true)` volvía a encender **los 8**, incluidos los de una edición
   * que estaba apagada. El interruptor de una mandaba sobre la otra en los dos
   * sentidos, y en silencio.
   *
   * El dueño se sabe sin ninguna heurística: `sincronizar` le entrega cada
   * marcador recién creado a la edición cuyo gancho `alCrearMarcador` recibió, así
   * que **cada instancia cabla exactamente los suyos** y aquí solo hay que
   * acordarse. Un `WeakSet` y no un array: los marcadores se REHACEN en cada
   * `sincronizar` y una lista propia se quedaría llena de fantasmas —el mismo
   * argumento que ya está escrito en `alCrearMarcador` para no llevar lista de
   * oyentes—. El `eachLayer` se conserva porque además hay que estar VIVO en el
   * mapa: un marcador cablado y luego retirado no cuenta.
   */
  const mios = new WeakSet()

  function marcadoresDeVertice() {
    const encontrados = []
    if (typeof mapa.eachLayer !== 'function') return encontrados
    mapa.eachLayer((capa) => {
      if (capa && capa.refVertice && typeof capa.getLatLng === 'function' && mios.has(capa)) {
        encontrados.push(capa)
      }
    })
    return encontrados
  }

  const alClicMapa = (evento) => {
    if (!vivo || !edicionActiva || !evento || !evento.latlng) return
    const parcela = estado.get()

    // ── El modo borrar se lleva el clic entero ────────────────────────────────
    // Antes que nada, y sin caer luego en la selección de lindero: en este modo el
    // clic tiene UN significado. Funciona igual pinchando el cuadradito del
    // vértice que dos píxeles al lado, porque `sincronizacion.js` REEMITE al mapa
    // el clic de sus marcadores (ver el comentario largo de su `marcador.on(
    // 'click')`), así que aquí llega el mismo evento en los dos casos.
    if (borrando) {
      const cerca = verticeMasCercano(parcela, latLngAUTM(evento.latlng, zona))
      if (cerca === null || pixelesEntre(latLngAUTM(evento.latlng, zona), cerca.punto) > UMBRAL_PUNTERIA_PX) {
        avisar(MSG_BORRAR_LEJOS, { nivel: NIVEL.ERROR })
        return
      }
      // `eliminar` ya cuenta por qué cuando el modelo se niega (el mínimo de
      // vértices de un anillo), y ya reubica la selección. El modo NO se apaga: es
      // lo que lo distingue de un botón, y borrar ocho vértices seguidos es su
      // caso de uso.
      eliminar({ recinto: cerca.recinto, indice: cerca.indice })
      return
    }

    // ── …y el modo insertar se lleva el resto ─────────────────────────────────
    // Mismo trato y por la misma razón (2026-08-18). Se delega ENTERO en
    // `insertarEn`, que es quien ya sabe proyectar el clic sobre el lado, rechazar
    // el punto que cae en un extremo y contar con cifras por qué cuando no se
    // aplica: duplicar aquí cualquiera de esas tres cosas daría dos definiciones de
    // «insertar», y la que se queda vieja es siempre la nueva.
    //
    // El modo NO se apaga al insertar, igual que borrar: colocar cuatro vértices
    // seguidos sobre un lindero largo es su caso de uso, y apagarse solo obligaría
    // a volver a la barra —400 px abajo— entre punto y punto.
    if (insertando) {
      insertarEn(evento.latlng)
      return
    }

    const mejor = ladoMasCercano(parcela, latLngAUTM(evento.latlng, zona))
    if (mejor === null) {
      fijarSeleccion(null)
      return
    }
    const px = pixelesEntre(latLngAUTM(evento.latlng, zona), mejor.proy.punto)
    // Fuera de la diana: se DESELECCIONA. Es lo que un usuario espera de un clic en
    // el vacío, y deja una forma evidente de soltar la selección sin buscar un botón.
    // Y no se avisa de nada: no ha fallado nada, el usuario ha pinchado fuera.
    fijarSeleccion(px > UMBRAL_PUNTERIA_PX ? null : { recinto: mejor.recinto, indice: mejor.indice })
  }

  /** Doble clic: inserta. Es el único gesto del MAPA que escribe en el modelo. */
  const alDobleClicMapa = (evento) => {
    if (!vivo || !edicionActiva || !evento || !evento.latlng) return
    const dom = evento.originalEvent
    if (dom && typeof dom.preventDefault === 'function') L.DomEvent.preventDefault(dom)
    // ⚠️ En modo borrar NO se inserta, y no es una omisión defensiva: un doble clic
    // contiene dos clics, así que sin esta guarda el gesto sería «borra el vértice,
    // borra otro, y ahora inserta uno nuevo» — tres escrituras en el modelo, dos de
    // ellas contradictorias, con un solo gesto del usuario. Se consume el
    // `preventDefault` igual (el zoom por doble clic sigue apagado y devolverlo
    // aquí sería un salto de escala en mitad de una limpieza de vértices).
    if (borrando) return
    // ⚠️ Y en modo INSERTAR tampoco, por la misma aritmética (2026-08-18): un doble
    // clic contiene dos clics y en ese modo **cada clic ya inserta**, así que sin
    // esta guarda el gesto escribiría TRES vértices casi en el mismo sitio —dos del
    // modo y uno de aquí—, que es exactamente el «vértice duplicado» que
    // `insertarEn` rechaza a mano unas líneas más arriba.
    //
    // Los dos del modo SÍ entran, y se acepta con los ojos abiertos: es la misma
    // cuenta que borrar (allí un doble clic borra dos vértices) y arreglarlo pediría
    // un temporizador que distinguiera clic de doble clic, o sea meter el reloj en
    // un módulo que hoy no lo tiene. Quien arma un modo de clic y hace doble clic
    // obtiene dos veces lo que pidió, que es raro pero no es una sorpresa.
    if (insertando) return
    insertarEn(evento.latlng)
  }

  // ── Arranque ──────────────────────────────────────────────────────────────

  mapa.on('click', alClicMapa)
  mapa.on('dblclick', alDobleClicMapa)

  // Insertar un vértice y ampliar el mapa con el MISMO gesto sería un efecto
  // sorpresa. Se apaga el zoom por doble clic mientras este módulo vive, y se
  // restaura tal como estaba en `destruir()` (dejar el mapa como se encontró es la
  // regla del visor).
  //
  // ⚠️ Desde F12 se pide y se suelta por CUENTA y no con una bandera propia: con
  // dos ediciones sobre el mismo mapa, la bandera hacía que apagar una devolviera
  // el zoom mientras la otra seguía editando (ver {@link pedirZoomDobleClicApagado}).
  // `tengoElZoom` es lo que evita descontar dos veces.
  let tengoElZoom = true
  pedirZoomDobleClicApagado(mapa)

  if (doc) {
    doc.addEventListener('keydown', alTeclear)
    doc.addEventListener('keyup', alTeclear)
  }
  if (ventana) ventana.addEventListener('blur', alPerderFoco)

  const bajaDelStore = estado.subscribe(() => {
    if (!vivo) return
    // Invalidación de la caché por el camino del suscriptor (ver la política en la
    // cabecera: hace falta ADEMÁS de la comparación por identidad).
    cacheDianas = null
    // Una operación puede haber dejado la selección fuera de rango (otra vista ha
    // cargado una parcela distinta, un undo…). Se suelta y se anuncia: el resalte
    // desaparece a la vista, que es lo contrario de hacerlo en silencio.
    if (seleccion !== null && !verticeExiste(estado.get(), seleccion.recinto, seleccion.indice)) {
      fijarSeleccion(null)
      return
    }
    pintarSeleccion()
  })

  return {
    ajustar,
    alCrearMarcador,

    /**
     * Apaga el indicador de enganche, si lo hay. Idempotente.
     *
     * ⭐ **Existe por el DIBUJO (2026-08-19).** `ajustar` enciende y apaga el
     * indicador solo mientras alguien le pregunta, y eso basta para un arrastre:
     * el `dragend` viene precedido de un fotograma que ya decidió. `viewer/dibujo.js`
     * no tiene ese fotograma final —se para con `Escape`, con `Enter`, con un doble
     * clic o porque cambia la pantalla—, así que sin esta puerta el cuadradito del
     * OSNAP se quedaba pintado sobre un mapa en el que ya no se dibuja: una marca
     * que promete un enganche que ya no va a ocurrir.
     *
     * No apaga el snap ni suelta ninguna selección: es **solo** el adorno.
     *
     * @returns {void}
     */
    soltarEnganche() {
      if (!vivo) return
      ocultarIndicador()
    },

    /**
     * Getter/setter de los CUATRO gestos de edición del mapa (rebanada 3).
     *
     * Sin argumento lee; con un booleano escribe y devuelve el valor ya escrito,
     * igual que {@link snapActivo}.
     *
     * Apagarla hace tres cosas, y las tres hacen falta:
     *   1. **desactiva el arrastre** de todos los marcadores vivos (y de los que
     *      nazcan después, por `alCrearMarcador`);
     *   2. **suelta la selección de lindero**, porque el resalte se quedaría
     *      pintado señalando algo que ya no se puede desplazar;
     *   3. **devuelve el zoom por doble clic** que este módulo le quita al mapa
     *      mientras edita — si no, en las otras pantallas el doble clic no haría
     *      NI insertar NI ampliar, que es un gesto muerto sin decirlo.
     *
     * Lo que NO apaga, a propósito: la API pública (`insertarEn`, `eliminar`,
     * `desplazarSeleccion`…). Esas las conduce la barra, la barra solo se ve en
     * Edición, y apagarlas aquí además dejaría a los tests de este módulo sin
     * forma de ejercitar el motor. La frontera es **el gesto del mapa**.
     *
     * @param {boolean} [valor]
     * @returns {boolean}
     */
    activa(valor) {
      if (valor === undefined) return edicionActiva
      if (typeof valor !== 'boolean') {
        throw new TypeError(
          `activa: 'valor' debe ser un booleano (o nada, para leer); recibido ${describir(valor)}.`,
        )
      }
      if (valor === edicionActiva) return edicionActiva
      edicionActiva = valor
      for (const marcador of marcadoresDeVertice()) aplicarArrastre(marcador)
      if (!edicionActiva) {
        // Los dos MODOS primero: son los estados de este módulo que sobrevivir a un
        // cambio de pantalla convertiría en un accidente (ver `borrando` e
        // `insertando`). El de borrar, además, es destructivo.
        fijarModoBorrar(false)
        fijarModoInsertar(false)
        fijarSeleccion(null)
        ocultarIndicador()
      }
      // Simétrico con el arranque: el módulo apaga el zoom por doble clic para
      // que insertar un vértice no amplíe además el mapa. Si no se está
      // editando, ese motivo no existe y el zoom vuelve — **pero solo si no lo
      // está reteniendo otra edición del mismo mapa** (F12 · M4).
      if (edicionActiva && !tengoElZoom) {
        tengoElZoom = true
        pedirZoomDobleClicApagado(mapa)
      } else if (!edicionActiva && tengoElZoom) {
        tengoElZoom = false
        soltarZoomDobleClicApagado(mapa)
      }
      return edicionActiva
    },
    seleccionarLado,
    ladoSeleccionado,
    desplazarSeleccion,
    insertarEn,
    eliminar,

    /**
     * Getter/setter del snap. Sin argumento lee; con un booleano escribe y devuelve
     * el valor ya escrito. Es INDEPENDIENTE de la tecla `Alt`: esto es la
     * preferencia del usuario, `Alt` es el momentáneo.
     *
     * @param {boolean} [valor]
     * @returns {boolean}
     */
    snapActivo(valor) {
      if (valor === undefined) return snapEncendido
      if (typeof valor !== 'boolean') {
        throw new TypeError(
          `snapActivo: 'valor' debe ser un booleano (o nada, para leer); ` +
            `recibido ${describir(valor)}.`,
        )
      }
      snapEncendido = valor
      if (!snapEncendido) ocultarIndicador()
      return snapEncendido
    },

    /**
     * Getter/setter de τ, **en METROS**. Sin argumento lee. `0` es válido y apaga el
     * enganche (semántica de `edit/snap.js`). Cambiar τ NO invalida el catálogo de
     * dianas: el catálogo no depende de la tolerancia.
     *
     * @param {number} [metros]
     * @returns {number}
     */
    tolerancia(metros) {
      if (metros === undefined) return toleranciaM
      toleranciaM = exigirTolerancia(metros, 'tolerancia')
      return toleranciaM
    },

    /**
     * Fija los recintos de las parcelas VECINAS contra los que también se engancha
     * (los de F05). Array VACÍO = solo se engancha a la parcela propia y a la
     * oficial, que es el estado de partida: traer colindantes cuesta una petición al
     * WFS y no se hace a espaldas de nadie.
     *
     * ⚠️ Recibe RECINTOS (`{vertices, tipo}`), no parcelas. Lo que devuelve
     * `services/catastro.js#parcelaYColindantes` son PARCELAS, así que quien cablee
     * aplana: `edicion.fijarColindantes(resultado.datos.colindantes.flatMap((p) => p.recintos))`.
     * Pasar parcelas sin aplanar NO se acepta en silencio (no aportarían ni una
     * diana y el snap parecería roto sin motivo): se lanza diciendo qué hacer.
     *
     * @param {Array<{vertices: Array<[number,number]>}>} recintos
     * @returns {void}
     */
    fijarColindantes(recintos) {
      if (!vivo) return
      if (!Array.isArray(recintos)) {
        throw new TypeError(
          `fijarColindantes: se espera un array de recintos ({vertices, tipo}) de las parcelas ` +
            `vecinas, o [] si no hay ninguna; recibido ${describir(recintos)}.`,
        )
      }
      for (const rec of recintos) {
        if (rec && typeof rec === 'object' && Array.isArray(rec.recintos)) {
          throw new TypeError(
            `fijarColindantes: se espera un array de RECINTOS y ha llegado uno de PARCELAS (los ` +
              `elementos traen 'recintos'). Aplana lo que devuelve F05: ` +
              `colindantes.flatMap((p) => p.recintos).`,
          )
        }
      }
      // Copia superficial: cambia la identidad en cada llamada (que es lo que tira
      // la caché) y no queda atada a un array que el llamante pueda seguir mutando.
      colindantes = [...recintos]
      vecinasParaDianas = colindantes.length === 0 ? [] : [{ recintos: colindantes }]
      cacheDianas = null
    },

    /**
     * Fija los PUNTOS SUELTOS del levantamiento importado (F11) contra los que
     * también se engancha. Array VACÍO = se olvidan los que hubiera, que es el
     * estado de partida y también lo que toca al cerrar un expediente.
     *
     * Aportan dianas de VÉRTICE y ninguna de segmento —un punto suelto no tiene
     * lado—, y `edit/snap.js#dianasDe` los pone los PRIMEROS del catálogo: en un
     * empate a distancia manda lo medido sobre lo oficial.
     *
     * ⚠️ Recibe PARES `[x, y]` en UTM, no los objetos del parser. Lo que devuelve
     * `parsers/dxf.js` en `puntos` es `{capa, x, y, z}`, así que quien cablee
     * convierte: `resultado.puntos.map((p) => [p.x, p.y])`. Pasar los objetos sin
     * convertir NO se acepta en silencio —`dianasDe` los descartaría uno a uno y el
     * snap se quedaría sin una sola diana nueva, sin lanzar y sin avisar—: se lanza
     * diciendo qué hacer, que es la misma política que {@link fijarColindantes}.
     *
     * Un par mal formado suelto (un `NaN`, un array de uno) NO lanza: lo descarta
     * `dianasDe`, igual que descarta un vértice degenerado de la parcela. La guarda
     * de aquí es para el error de FORMA, que se lleva el array entero; el dato malo
     * aislado sigue la regla de la casa.
     *
     * @param {Array<[number,number]>} nuevos  Pares UTM, o `[]`.
     * @returns {void}
     * @throws {TypeError} Si no es un array, o si trae los objetos del parser.
     */
    fijarPuntos(nuevos) {
      if (!vivo) return
      if (!Array.isArray(nuevos)) {
        throw new TypeError(
          `fijarPuntos: se espera un array de pares UTM [x, y], o [] si no hay ninguno; ` +
            `recibido ${describir(nuevos)}.`,
        )
      }
      for (const p of nuevos) {
        if (p && typeof p === 'object' && !Array.isArray(p) && 'x' in p && 'y' in p) {
          throw new TypeError(
            `fijarPuntos: se esperan PARES [x, y] y han llegado los objetos del parser (los ` +
              `elementos traen 'x' e 'y'). Conviértelos: puntos.map((p) => [p.x, p.y]).`,
          )
        }
      }
      // Copia superficial: identidad nueva en cada llamada —que es lo que tira la
      // caché por la clave— y no queda atada a un array que el llamante siga mutando.
      puntos = [...nuevos]
      cacheDianas = null
    },

    /**
     * Se suscribe a los cambios de selección. Devuelve la función de BAJA.
     * El suscriptor recibe una COPIA de la `RefVertice`, o `null`.
     *
     * @param {(ref: RefVertice|null) => void} fn
     * @returns {() => void}
     */
    alCambiarSeleccion(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(
          `alCambiarSeleccion: 'fn' debe ser una función; recibido ${describir(fn)}.`,
        )
      }
      oyentesSeleccion.add(fn)
      return () => oyentesSeleccion.delete(fn)
    },

    /**
     * Getter/setter del MODO BORRAR. Sin argumento lee; con un booleano escribe y
     * devuelve el valor ya escrito, igual que {@link snapActivo} y `activa`.
     *
     * Encendido, el clic del mapa borra el vértice que tenga a menos de
     * {@link UMBRAL_PUNTERIA_PX} px en vez de seleccionar el lindero más cercano, y
     * el doble clic deja de insertar. El porqué de las tres cosas —y de las tres
     * formas de apagarlo— está junto a la variable `borrando`.
     *
     * @param {boolean} [valor]
     * @returns {boolean}
     */
    modoBorrar(valor) {
      if (valor === undefined) return borrando
      if (typeof valor !== 'boolean') {
        throw new TypeError(
          `modoBorrar: 'valor' debe ser un booleano (o nada, para leer); recibido ${describir(valor)}.`,
        )
      }
      // Tras `destruir()` no se enciende: el oyente del clic ya no está y el modo
      // quedaría armado sobre un mapa que no lo atiende. Mismo criterio que las
      // demás operaciones, que empiezan por `if (!vivo)`.
      if (!vivo) return borrando
      return fijarModoBorrar(valor)
    },

    /**
     * Se suscribe a los cambios del modo borrar. Devuelve la función de BAJA.
     * Gemela de {@link alCambiarSeleccion} y por el mismo motivo: quien pinta el
     * botón de la barra no puede sondear un booleano, y el modo se apaga TAMBIÉN
     * por caminos que ese botón no ve (`Escape`, salir de la pantalla).
     *
     * @param {(activo: boolean) => void} fn
     * @returns {() => void}
     */
    alCambiarModoBorrar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(
          `alCambiarModoBorrar: 'fn' debe ser una función; recibido ${describir(fn)}.`,
        )
      }
      oyentesModoBorrar.add(fn)
      return () => oyentesModoBorrar.delete(fn)
    },

    /**
     * Getter/setter del MODO INSERTAR (2026-08-18). Gemelo de {@link modoBorrar} y
     * con su mismo contrato: sin argumento lee, con un booleano escribe y devuelve
     * lo que ha quedado, y tras `destruir()` no se enciende.
     *
     * Encendido, el clic del mapa **inserta** un vértice en el lindero más cercano
     * —por el mismo {@link insertarEn} que usa el doble clic, que sigue vivo— en vez
     * de seleccionar el lindero, y el doble clic deja de insertar. Es EXCLUYENTE con
     * {@link modoBorrar}: encender éste apaga aquél, y al revés. Todo el porqué está
     * junto a la variable `insertando`.
     *
     * @param {boolean} [valor]
     * @returns {boolean}
     */
    modoInsertar(valor) {
      if (valor === undefined) return insertando
      if (typeof valor !== 'boolean') {
        throw new TypeError(
          `modoInsertar: 'valor' debe ser un booleano (o nada, para leer); recibido ${describir(valor)}.`,
        )
      }
      if (!vivo) return insertando
      return fijarModoInsertar(valor)
    },

    /**
     * Se suscribe a los cambios del modo insertar. Devuelve la función de BAJA.
     * Gemela de {@link alCambiarModoBorrar}, y aquí la suscripción no es una
     * comodidad: el modo se apaga TAMBIÉN por caminos que el botón no ve —`Escape`,
     * salir de la pantalla, y sobre todo **armar el modo borrar**, que lo cancela—.
     * Un botón que sondeara el booleano se quedaría pulsado y mintiendo.
     *
     * @param {(activo: boolean) => void} fn
     * @returns {() => void}
     */
    alCambiarModoInsertar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(
          `alCambiarModoInsertar: 'fn' debe ser una función; recibido ${describir(fn)}.`,
        )
      }
      oyentesModoInsertar.add(fn)
      return () => oyentesModoInsertar.delete(fn)
    },

    /**
     * Deja el módulo inerte y el mapa como estaba: capas fuera, oyentes del mapa, del
     * documento y de la ventana retirados, baja del store y `doubleClickZoom`
     * restaurado. IDEMPOTENTE.
     *
     * Se desmonta en orden inverso al montaje (la regla del visor, `viewer/index.js`):
     * primero se deja de escuchar, después se retira lo pintado.
     *
     * No anuncia la selección a `null` al soltarla: los oyentes se están yendo con la
     * pantalla, y notificar a quien se desmonta es la clase de aviso que acaba
     * escribiendo en un DOM que ya no existe.
     */
    destruir() {
      if (!vivo) return
      // ANTES de bajar la bandera: `fijarModoBorrar` tiene que poder quitar la
      // clase del contenedor, o el mapa se quedaría con el cursor de borrar puesto
      // y sin nadie que atendiera el clic — un modo fantasma, que es peor que uno
      // encendido. Se apaga en silencio para los oyentes que quedaran (el mismo
      // criterio que la selección, aquí abajo: no se notifica a quien se desmonta).
      oyentesModoBorrar.clear()
      fijarModoBorrar(false)
      // Ídem para insertar, y en el mismo sitio: antes de bajar `vivo`, para que
      // `fijarModoInsertar` pueda quitar su clase del contenedor. Un mapa que se
      // queda con el cursor de insertar puesto y sin nadie que atienda el clic es
      // un modo fantasma, que es peor que uno encendido.
      oyentesModoInsertar.clear()
      fijarModoInsertar(false)
      vivo = false
      bajaDelStore()
      mapa.off('click', alClicMapa)
      mapa.off('dblclick', alDobleClicMapa)
      if (doc) {
        doc.removeEventListener('keydown', alTeclear)
        doc.removeEventListener('keyup', alTeclear)
      }
      if (ventana) ventana.removeEventListener('blur', alPerderFoco)
      if (tengoElZoom) {
        tengoElZoom = false
        soltarZoomDobleClicApagado(mapa)
      }
      ocultarIndicador()
      quitarResalte()
      oyentesSeleccion.clear()
      seleccion = null
      cacheDianas = null
      colindantes = []
      vecinasParaDianas = []
      puntos = []
      altPulsado = false
    },
  }
}
