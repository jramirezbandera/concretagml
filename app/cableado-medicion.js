// app/cableado-medicion.js — F18 · T3 · La MEDICIÓN PROPIA entra por fin.
//
// ── QUÉ CIERRA ESTE FICHERO ─────────────────────────────────────────────────
// La pantalla de Entrada anuncia tres formas de empezar un expediente. Hasta hoy
// funcionaban dos: la referencia catastral (F05) y comprobar un GML (F08). La
// tercera —«Medición propia · tu levantamiento en `.dxf` o un volcado de
// coordenadas en `.txt`»— **rechazaba el fichero con un aviso**, porque F11 cableó
// esas dos extensiones únicamente a la rama de EDIFICIO.
//
// No es alcance nuevo: es el requisito de F01, que la ficha da por «✅ hecho» y lo
// está **solo para la capa de parsers**. En F01 no había aplicación —nace en F03—,
// así que `parsers/importar.js` se escribió sin llamante y ahí se quedó once fases.
// Este módulo es su llamante en producción.
//
// ── LAS CINCO COSAS DE LAS QUE ES DUEÑO ─────────────────────────────────────
//
//   1. **LEER EL FICHERO Y RECONOCER EL NUESTRO.** Antes que nada se pregunta si
//      lo que se ha soltado es el listado de replanteo que exporta esta misma
//      aplicación. Ver el apartado siguiente: es un rechazo con nombre propio.
//   2. **LAS DOS PASADAS DE `importar()`.** Una para mirar, otra para aplicar lo
//      que el usuario haya decidido. Ver «Las rondas».
//   3. **COMPONER LA PARCELA SIN PERDER LA OFICIAL.** Ver {@link componerParcelaMedida}:
//      es la decisión que le da valor a la fase y sale gratis.
//   4. **UN SOLO `estado.set`**, y después el gancho `alCargarParcela`. Mismo
//      orden y mismo motivo que `cablearCatastro` y `cablearComprobacion`.
//   5. **DECIR DE DÓNDE SALIÓ Y DÓNDE CAE**, en el renglón de procedencia.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//   · **No decide a qué rama va el fichero.** Eso es del paso 17 de `app/main.js`,
//     que lo resuelve TARDE por la rama en pantalla. Aquí se sabe que lo que entra
//     es una parcela porque quien llama ya lo ha decidido.
//   · **No pinta el mapa ni encuadra.** El visor es suscriptor del store: escribir
//     en él ES pintar (F03, paso 7 de `viewer/index.js`).
//   · **No dispara el autoguardado.** ⭐ Medido: el autoguardado de F10 es el
//     **séptimo suscriptor del mismo store** (`app/cableado-expediente.js`), así
//     que un `estado.set` ya lo arma. No hay nada que cablear.
//   · **No reinicia el historial.** Lo hace `alCargarParcela`, que es el gancho que
//     F06 extrajo justamente para esto (`app/main.js#cablearEdicion`).
//
// ── ⛔ EL FICHERO QUE ESCRIBIMOS Y NUESTRO PROPIO LECTOR MALINTERPRETA ───────
// F10 dejó medido que el listado de coordenadas de `export/coordenadas.js` **no es
// reimportable**: su primera columna es el número de vértice, y un lector de dos
// columnas la toma por la X. Daba igual mientras el `.txt` no entrara por ningún
// sitio. **F18 abre esa puerta.**
//
// ⭐ **Y lo que pasa hoy NO es lo que se había supuesto, medido el 2026-08-06:** el
// listado no construye una parcela falsa —sale `construida: false`— porque los
// números parásitos de la cabecera envenenan la comprobación del huso. Lo que el
// usuario recibe es «no se ha podido resolver el huso»: un bloqueo del catálogo,
// plausible, **y mentira** — no hay ningún huso que arreglar. Un diagnóstico
// correcto en la forma y falso en el fondo manda a perseguir algo que no existe.
//
// Se reconoce ANTES de llamar a `importar()`, con `esListadoDeReplanteo`, que vive
// junto a la frase que lo delata para que el detector y el texto no diverjan.
//
// ── LAS RONDAS, Y POR QUÉ NO SON UN BUCLE INFINITO ──────────────────────────
// `decisionesDe` devuelve **solo el reparto por capas** cuando lo hay: preguntar
// por el cierre de 25 anillos antes de saber cuál entra es pedirle al usuario que
// decida sobre geometría que va a descartar (medido: 27 detecciones sin capa, 9
// con la capa «0» puesta). Así que hacen falta hasta DOS vueltas: la capa primero,
// lo que quede después.
//
// ⚠️ **Y el terminador no es el contador de rondas: es `resueltas`.** Si el usuario
// elige «dejar el cierre como está», `importar()` se comporta igual y **vuelve a
// emitir la misma detección** — preguntar por lo que ya se contestó abriría la
// misma pantalla una y otra vez. Se lleva la cuenta de los TIPOS ya resueltos y no
// se repregunta. El tope de rondas es un cinturón, no el mecanismo.

import { esListadoDeReplanteo } from '../export/coordenadas.js'
import { decodificarGml } from '../gml/decodificar.js'
import { ORIGEN_PARCELA, TIPO_RECINTO, crearParcela, crearRecinto } from '../model/parcela.js'
import { SEVERIDAD } from '../parsers/_comun.js'
import { BLOQUEOS, importar } from '../parsers/importar.js'
import { NIVEL } from '../viewer/_comun.js'
import { SELECTOR_PROCEDENCIA, camposInvariantes } from './cableado-catastro.js'
import { INSTRUCCION_PARCELARIO } from './navegacion.js'
import {
  MENSAJE_ES_LISTADO_PROPIO,
  crearDialogoImportacion,
  decisionesDe,
} from './dialogo-importacion.js'

export { MENSAJE_ES_LISTADO_PROPIO, SELECTOR_PROCEDENCIA }

// ── Constantes ───────────────────────────────────────────────────────────────

/**
 * Cinturón por si `decisionesDe` y `resueltas` dejaran de bastar. Dos es el máximo
 * real (capa, y después el resto); la tercera existe para que un fallo futuro
 * degrade en «no se pregunta más» y no en un modal que no se cierra nunca.
 */
const RONDAS_MAX = 3

/** `resumen.formato` → `ORIGEN_PARCELA`. Los tres que emite `importar()`. */
const ORIGEN_POR_FORMATO = Object.freeze({
  LIST: ORIGEN_PARCELA.LIST,
  TXT: ORIGEN_PARCELA.TXT,
  DXF: ORIGEN_PARCELA.DXF,
})

// ── Lo que se le dice al usuario ─────────────────────────────────────────────

/** No se han podido leer los bytes. Es del entorno, no del fichero. */
export const MENSAJE_FICHERO_NO_LEIDO =
  'No se ha podido leer el contenido del fichero. Suele pasar cuando se ha movido, renombrado o ' +
  'desconectado la unidad desde que se eligió, o cuando se arrastra desde el correo o una unidad ' +
  'de red: guárdalo primero en el disco y vuelve a abrirlo. No se ha cambiado nada.'

/** El usuario ha cerrado la revisión sin aceptar. No ha ido nada mal. */
export const MENSAJE_CANCELADO =
  'Importación cancelada: no se ha cambiado nada de lo que había en pantalla.'

/**
 * Contrato roto en una capa de abajo. No intenta explicar la causa técnica —no le
 * sirve de nada— pero tampoco la esconde. Misma redacción y mismo criterio que
 * `MENSAJE_FALLO_INESPERADO` de F04 y F08.
 */
export const MENSAJE_FALLO_INESPERADO =
  'La lectura de esa medición se ha interrumpido por un fallo interno de la aplicación; no se ha ' +
  'cambiado nada. El detalle técnico está en la consola del navegador.'

/**
 * Ha entrado una parcela sin referencia catastral. **No bloquea** —el técnico puede
 * querer solo mirar la geometría, o traer la referencia después— pero se dice, con
 * las dos vías que ya existen al lado. Decir «no» sin decir «por dónde» es la mitad
 * de un mensaje.
 */
export const MENSAJE_SIN_REFERENCIA =
  'Esa geometría ha entrado sin referencia catastral, así que todavía no se puede generar un GML ' +
  'para la Sede. Escríbela en el campo de arriba, o usa «Deducir del mapa».'

/**
 * El fichero se ha leído pero no ha salido una parcela. Se antepone al motivo REAL
 * que da `importar()`, que es el que sabe por qué.
 */
export const ENCABEZADO_NO_CONSTRUIDA = 'No ha entrado ninguna parcela de ese fichero.'

/**
 * ⛔ **Un fichero SUPERADO por otro que se soltó después** (auditoría 2026-08-16,
 * hallazgo B2).
 *
 * Se dice, y no es opcional: un fichero que el usuario suelta y que no entra sin
 * que nadie lo cuente es exactamente la regla de oro 1 rota. Y aquí el usuario **no
 * puede deducirlo**: los dos gestos son suyos, pero él no sabe que la lectura del
 * primero seguía en vuelo cuando soltó el segundo — lo que ve es que uno de los dos
 * ficheros «no ha hecho nada».
 *
 * Misma redacción y mismo criterio que la de `app/cableado-edificio.js`: es el
 * mismo hecho en la otra rama, como ya pasa con {@link MENSAJE_FICHERO_NO_LEIDO}.
 *
 * ⚠️ **No afirma que el otro haya entrado**, solo que llegó después: el segundo
 * fichero puede haber fallado por su cuenta (y entonces lo dice su propio mensaje),
 * y esta frase seguiría siendo verdad. Decir aquí «es ése el que ha entrado» sería
 * afirmar algo que este punto del recorrido no sabe.
 *
 * @param {string} nombre   El que se descarta.
 * @param {string} vigente  El que llegó después.
 * @returns {string}
 */
export const mensajeFicheroSuperado = (nombre, vigente) =>
  `No se ha cargado «${nombre}»: mientras se leía soltaste «${vigente}». Entre dos ficheros manda ` +
  `el ÚLTIMO que sueltas, no el que termine de leerse antes. Si el que querías era «${nombre}», ` +
  `suéltalo otra vez.`

// ── F19 · La vista previa del pegado ─────────────────────────────────────────

/** Cómo se llama en pantalla cada formato. «TXT» no le dice nada a nadie. */
const NOMBRE_FORMATO = Object.freeze({
  LIST: 'LISTA de AutoCAD',
  TXT: 'coordenadas en dos columnas',
  DXF: 'DXF',
})

/** Cuatro decimales, como el resto de superficies medidas de la aplicación. */
const FORMATO_M2 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

/** Nada que leer todavía: el campo está vacío. No es un error, es el estado inicial. */
export const PEGADO_VACIO = 'Pega aquí el resultado del comando LISTA de AutoCAD, o dos columnas de coordenadas.'

/** Se ha pegado algo y no hay ni un par de coordenadas dentro. */
export const PEGADO_SIN_GEOMETRIA =
  'En ese texto no hay ningún par de coordenadas que pueda ser el contorno de una parcela. ' +
  'Del comando LISTA hay que copiar el bloque entero, con las líneas «Ubicación: X= … Y= …».'

/**
 * ⛔ **El aviso del cotejo que NO cuadra, y existe por un caso REAL del 2026-08-06.**
 *
 * Un técnico pegó la LISTA de una parcela suya y la aplicación entró con **16
 * vértices, 168,5851 m²**, cuando el dibujo declaraba **276,5018 m²**. Faltaba un
 * vértice: la copia se había cortado —la LISTA pagina en la ventana de texto del
 * CAD— y el último punto se quedó fuera. Las dos cifras que faltaban cuadraban
 * entre sí: los **107,9167 m²** de superficie y los **8,7738 m** de perímetro son
 * el mismo triángulo, el que el vértice perdido habría formado con la arista de
 * cierre.
 *
 * **La aplicación lo había dicho, y lo dijo bien** — el diálogo del pegado enseña
 * las dos cifras—, **pero lo decía UNA vez y en una pantalla que se cierra**.
 * Aceptada la importación, el panel se quedaba con sus avisos y ninguno era ese:
 * el usuario miraba 168,59 m² sin rastro de los 276,50 que declaraba su fichero.
 * Y por la vía de FICHERO no aparecía en ningún sitio, que era la decisión 5 de
 * F19 sin implementar.
 *
 * ⚠️ **Solo se emite cuando NO cuadran**, y es a propósito: {@link avisosDe}
 * descarta las detecciones `INFO` porque este panel es el de los avisos, no un
 * registro. Una coincidencia no es un aviso — se dice donde importa, que es en el
 * diálogo del pegado, mientras todavía se puede cancelar.
 *
 * @param {object|null} cotejo  `resumen.superficie` de `importar()`.
 * @returns {string|null}  El aviso, o `null` si no hay nada que decir.
 */
export function avisoDeSuperficie(cotejo) {
  if (!cotejo || cotejo.coincide !== false) return null
  const declarada = FORMATO_M2.format(cotejo.reportada)
  const calculada = FORMATO_M2.format(cotejo.calculada)
  const diferencia = FORMATO_M2.format(cotejo.diferencia)
  // ⚠️ El SIGNO importa y por eso se distingue: que el dibujo declare MÁS de lo
  // que sale suele ser geometría que no ha llegado —vértices perdidos al copiar—,
  // y que declare MENOS suele ser un vértice repetido o un anillo de más. Se
  // nombra la sospecha y **no se dictamina**: la aplicación no sabe cuál de las dos
  // cifras es la buena, y decidirlo por el técnico sería inventarse un veredicto.
  const sospecha =
    cotejo.reportada > cotejo.calculada
      ? 'Cuando el dibujo declara MÁS de lo que sale, lo normal es que no haya llegado toda la ' +
        'geometría: la LISTA pagina en la ventana de texto del CAD y es fácil copiarla a medias.'
      : 'Cuando el dibujo declara MENOS de lo que sale, suele haber un vértice repetido o un ' +
        'contorno de más.'
  return (
    `La superficie no cuadra con la que declara el dibujo: él dice ${declarada} m² y aquí sale ` +
    `${calculada} m², ${diferencia} m² de diferencia. La geometría ha entrado tal cual venía. ` +
    sospecha
  )
}

/**
 * Mira un texto pegado y cuenta **qué se ha entendido**, sin cambiar nada. Es lo
 * que se enseña en el diálogo de pegado ANTES de aceptar, y es el único momento en
 * el que el usuario puede cancelar viendo las cifras.
 *
 * ⭐ **Aquí es donde el cotejo de superficie estrena llamante.** `importar()` lo
 * calcula desde F01 en `resumen.superficie` —solo la LISTA declara su «Área:»— y
 * hasta F19 **no lo leía nadie** en toda la aplicación. Se enseñan **las dos
 * cifras siempre**, coincidan o no: la declarada por el dibujo y la calculada
 * aquí. Callar la comprobación cuando sale bien es quitarle al usuario la única
 * prueba de que se ha hecho.
 *
 * @param {string} texto
 * @returns {{ok: boolean, titular: string, renglones: string[], motivo: string|null}}
 */
export function inspeccionarTexto(texto) {
  const vacio = !esTexto(texto)
  if (vacio) return { ok: false, titular: '', renglones: [], motivo: PEGADO_VACIO }

  // El listado propio, antes que nada y por el mismo motivo que en `alTexto`.
  if (esListadoDeReplanteo(texto)) {
    return { ok: false, titular: '', renglones: [], motivo: MENSAJE_ES_LISTADO_PROPIO }
  }

  let resultado
  try {
    resultado = importar(texto)
  } catch (causa) {
    // Un pegado no puede tirar la pantalla. `importar()` solo lanza por contrato
    // del programador, así que llegar aquí es un defecto NUESTRO: se dice sin
    // adornos y se deja constancia en la consola.
    console.error('[medicion] la vista previa del pegado ha fallado:', causa)
    return { ok: false, titular: '', renglones: [], motivo: MENSAJE_FALLO_INESPERADO }
  }

  const { resumen } = resultado
  if (resumen.nAnillos === 0) {
    return { ok: false, titular: '', renglones: [], motivo: PEGADO_SIN_GEOMETRIA }
  }

  const vertices = resumen.nVertices.reduce((suma, n) => suma + n, 0)
  const contornos =
    resumen.nAnillos === 1 ? 'un contorno' : `${resumen.nAnillos} contornos (uno y sus huecos)`
  const titular =
    `${vertices} vértice${vertices === 1 ? '' : 's'} · ${contornos} · ` +
    `${NOMBRE_FORMATO[resumen.formato] ?? resumen.formato}`

  const renglones = []
  const cotejo = resumen.superficie
  if (cotejo) {
    renglones.push(
      `Superficie: el dibujo declara ${FORMATO_M2.format(cotejo.reportada)} m² y aquí sale ` +
        `${FORMATO_M2.format(cotejo.calculada)} m² ` +
        (cotejo.coincide
          ? '(coinciden).'
          : `— NO coinciden, se diferencian en ${FORMATO_M2.format(cotejo.diferencia)} m².`),
    )
  }
  if (resumen.huso) {
    renglones.push(`Cae en el huso ${resumen.huso.zona} (${resumen.huso.srs}).`)
  }

  // ⚠️ `ok` NO es `construida`. Unas coordenadas en grados no construyen y aun así
  // se puede seguir: la pantalla de revisión ofrece proyectarlas (F19 · T2). Lo que
  // impide seguir es no haber entendido ni una coordenada.
  return { ok: true, titular, renglones, motivo: null }
}

// ── Textos de procedencia ────────────────────────────────────────────────────

/**
 * El renglón `[data-procedencia="parcela"]` cuando la geometría entra de una
 * medición. Dice **tres** cosas y las tres importan:
 *
 *   1. **de dónde sale la geometría** —del fichero, NO del Catastro—, que es lo que
 *      impide que un levantamiento propio se lea como dato oficial;
 *   2. **qué pasa con el parcelario**, que es distinto según se haya conservado o
 *      no (ver {@link componerParcelaMedida}). ⛔ Cuando NO lo hay decía «tráelo con
 *      la referencia catastral», y era la trampa: hasta el 2026-08-08 hacerlo
 *      borraba la medición que este mismo renglón acaba de anunciar. La instrucción
 *      sale ahora de `INSTRUCCION_PARCELARIO`, compartida por los cuatro sitios que
 *      la decían de cuatro maneras distintas;
 *   3. **dónde cae la parcela**, que es la exigencia de F01 §detecciones
 *      defensivas: «desproyectar el centroide, mostrar dónde ha caído la parcela
 *      antes de continuar». Sin esto, una medición en el huso equivocado entra sin
 *      que nada lo diga.
 *
 * ⚠️ **No se reutiliza `textoProcedenciaDoble` de `cableado-comprobacion.js`, y no
 * es por gusto:** aquélla compone la mitad del Catastro con `textoProcedencia`, que
 * necesita el objeto `ProcedenciaCatastro` del resultado del WFS —con su hora y la
 * edad de la copia local—. **El store no lo guarda**: una `Parcela` tiene
 * `geometriaOficial`, no de dónde vino. Inventar aquí una hora sería exactamente la
 * mentira que ese renglón existe para evitar, así que se dice lo único que consta:
 * que el parcelario es el que ya había en pantalla.
 *
 * ⛔ **Y «fichero» no vale para todo, lo cual costó una corrida del guion 18.** Con
 * F19 esta misma vía la estrena el PEGADO, y el renglón salía diciendo «del fichero
 * «coordenadas pegadas»» — una afirmación falsa sobre el origen del dato, escrita
 * justo en la línea que existe para decir de dónde salió. No lo vio ninguna prueba
 * porque las de la suite comprobaban que la frase contuviera «pegad», y lo contenía.
 * Ahora el sustantivo lo decide {@link deFichero}.
 *
 * @param {object} args
 * @param {string} args.nombreFichero
 * @param {string|null} [args.capa=null]  La capa elegida del DXF, si hubo elección.
 * @param {boolean} args.conParcelario  Si se ha conservado la geometría oficial.
 * @param {{zona: number, srs: string}|null} [args.huso=null]
 * @param {boolean} [args.deFichero=true]  `false` cuando el volcado se ha pegado.
 * @returns {string}
 */
export function textoProcedenciaMedicion({
  nombreFichero,
  capa = null,
  conParcelario,
  huso = null,
  deFichero = true,
}) {
  const deCapa = esTexto(capa) ? ` (capa «${capa}»)` : ''
  const origen = deFichero ? `del fichero «${nombreFichero}»` : `de ${nombreFichero}`
  const geometria = `Geometría medida por ti, ${origen}${deCapa} — NO del Catastro.`
  const parcelario = conParcelario
    ? ' Se conserva el parcelario que ya estaba en pantalla, solo para contrastar.'
    : ` Sin parcelario con el que contrastarla. ${INSTRUCCION_PARCELARIO}`
  const donde = huso === null ? '' : ` Cae en el huso ${huso.zona} (${huso.srs}).`
  return `${geometria}${parcelario}${donde}`
}

// ── Helpers puros ────────────────────────────────────────────────────────────

const esTexto = (v) => typeof v === 'string' && v.trim() !== ''

/** El nodo del contrato con `index.html`, o `throw` nombrando el selector. */
function nodo(selector) {
  const encontrado = document.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `app/cableado-medicion.js: la cáscara no tiene ningún nodo '${selector}'. El marcado de ` +
        `index.html es contrato de este cableado: si se ha renombrado o movido ese nodo, hay que ` +
        `arreglarlo en index.html, no aquí.`,
    )
  }
  return encontrado
}

/**
 * **La composición, y es el corazón de la fase.**
 *
 * ⭐ Un dibujo entra como MEDICIÓN: ocupa `recintos` —lo que se dibuja, se edita y
 * se acaba serializando— y **`geometriaOficial` no se toca**. El modelo ya guarda
 * las dos por separado desde F00 (`model/parcela.js`), así que el Diagnóstico de
 * encaje de F07 funciona **sin traer nada más**: es el flujo real del perito —traigo
 * la oficial, meto mi levantamiento, contrasto— y sale gratis.
 *
 * ── ⛔ SALVO QUE LO QUE HAYA EN PANTALLA SEA LA DEMOSTRACIÓN ────────────────
 * La aplicación arranca con una parcela cargada, y **no es geometría de mentira**:
 * es la parcela REAL 9398516VK3799G con su geometría oficial de verdad
 * (`app/demo-datos.js`). Componer contra ella sería correcto si el dibujo del
 * usuario fuera de ESA parcela, y no tiene por qué serlo: con un levantamiento de
 * otra provincia, el Diagnóstico contrastaría dos polígonos sin relación y daría
 * cifras enormes, ciertas y sin ningún sentido.
 *
 * Así que si el store sigue en la demostración, el dibujo **sustituye**: expediente
 * nuevo, sin parcelario y sin referencia.
 *
 * ⚠️ **El detector no se inventa: es `ID_LOCAL_DEMO`**, que existe desde el rework
 * de UI para responder exactamente esta pregunta y ya lo usa `rotuloDelDato`. Su
 * JSDoc razona por qué `refcat`, `origen` y la identidad del POJO **no** sirven —la
 * demo es una parcela real, ya viene con `origen: WFS`, y editar un vértice
 * construye un objeto nuevo—. Se reutiliza ese, no un segundo criterio.
 *
 * @param {object|null} actual  Lo que hay en el store, o `null`.
 * @param {Array<object>} recintos  Los recintos recién importados.
 * @param {object} args
 * @param {string} args.origen  Uno de `ORIGEN_PARCELA`.
 * @param {string|null} args.idLocalDemo  El `idLocal` del dataset de demostración.
 * @param {string} args.nombreFichero  Último recurso para el `idLocal`.
 * @returns {object} Parcela
 */
export function componerParcelaMedida(actual, recintos, { origen, idLocalDemo, nombreFichero }) {
  const sigueEnDemo =
    !actual || (esTexto(idLocalDemo) && actual.idLocal === idLocalDemo)

  if (sigueEnDemo) {
    return crearParcela({
      // Sin referencia todavía: el `idLocal` sale del fichero, que es lo único que
      // consta. Mismo último recurso que `idLocalDe` en `cableado-comprobacion.js`.
      idLocal: esTexto(nombreFichero) ? nombreFichero : 'medicion-propia',
      refcat: null,
      recintos,
      geometriaOficial: null,
      origen,
    })
  }

  return crearParcela({
    // `idLocal` y `superficieRegistral`, los dos campos que no son de ninguno de los
    // dos ejes. Los comparte con su DUAL `componerParcelaConOficial` —el compositor
    // del Catastro, que conserva lo que éste pisa y pisa lo que éste conserva— y por
    // eso salen de un helper y no de dos listas paralelas: `superficieRegistral` la
    // teclea una persona, y era el campo que el otro compositor perdía en silencio.
    ...camposInvariantes(actual),
    refcat: actual.refcat ?? null,
    recintos,
    // ⛔ INTACTA. Es toda la decisión de la fase en una línea.
    geometriaOficial: actual.geometriaOficial ?? null,
    superficieCatastral: actual.superficieCatastral ?? null,
    origen,
  })
}

// ── F22 · CUANDO EL DIBUJO TRAE VARIAS FINCAS ────────────────────────────────

/**
 * El renglón de procedencia de una finca elegida **que el dibujo nombra**.
 *
 * ⛔ **Existe porque el guion 24 midió a la aplicación diciendo dos cosas
 * contrarias sobre la misma geometría, con dos centímetros de separación.** La
 * cabecera ponía «Cartografía del Catastro · del dibujo» —correcto, y es lo que
 * M25 costó— y el renglón de debajo, que reutilizaba
 * {@link textoProcedenciaMedicion} tal cual, ponía «Geometría **medida por ti** …
 * **NO del Catastro**». Las dos frases no pueden ser verdad a la vez, y la que se
 * lee al firmar es la de abajo.
 *
 * ⚠️ **Solo para la rama con nombres.** Sin rótulos que respalden la referencia la
 * finca entra como MEDICIÓN (decisión 2), y entonces el renglón de F18 dice lo
 * único que consta: que la geometría sale de un fichero y que el Catastro no la
 * ha confirmado.
 *
 * @param {object} args
 * @param {string} args.nombreFichero
 * @param {string|null} [args.capa=null]
 * @param {string} args.refcat  La referencia que el dibujo trae escrita dentro.
 * @param {{zona: number, srs: string}|null} [args.huso=null]
 * @returns {string}
 */
export function textoProcedenciaFincaElegida({ nombreFichero, capa = null, refcat, huso = null }) {
  const deCapa = esTexto(capa) ? ` (capa «${capa}»)` : ''
  const donde = huso === null ? '' : ` Cae en el huso ${huso.zona} (${huso.srs}).`
  return (
    `Cartografía del Catastro, leída del fichero «${nombreFichero}»${deCapa} — no de una consulta ` +
    `al servicio. La referencia ${refcat} viene escrita en el propio dibujo. Sirve a la vez de ` +
    `contorno oficial: mientras no muevas un vértice, el encaje vale cero porque son la misma ` +
    `geometría.${donde}`
  )
}

/** Lo que se dice en el panel al abrir el cajón de elección. */
export const mensajeElegirFinca = (cuantas) =>
  `El dibujo trae ${cuantas} fincas separadas y un expediente lleva una sola. ` +
  `Elige la tuya en el cajón del mapa: al marcarla se resalta sobre la cartografía.`

/** Y lo que se dice al descartar el dibujo entero. */
export const MENSAJE_FINCAS_DESCARTADAS =
  'Se ha descartado el dibujo. No ha entrado ninguna finca ni se ha dibujado nada.'

/**
 * Lo que se dice de las fincas que NO se han elegido.
 *
 * ⚠️ Dice **«del dibujo»** y no «del Catastro», aunque el dibujo venga de la Sede:
 * son dos afirmaciones distintas y la ficha del panel ya cuenta las que trae el
 * WFS. Confundirlas sería el mismo error que F18 cometió con la cabecera, un piso
 * más abajo.
 */
export const mensajeVecinasDelDibujo = (cuantas) =>
  cuantas === 0
    ? 'El dibujo no traía ninguna otra finca alrededor.'
    : `Las otras ${cuantas} fincas del dibujo se quedan dibujadas como parcelario de ` +
      `contexto. Son del fichero, no una consulta al Catastro.`

/**
 * Lo que se cuenta cuando el dibujo trae además construcciones. **No entran**
 * (decisión 4 de F22) pero se NOMBRAN: 168 polilíneas que el usuario ve en su CAD
 * y que la aplicación ignora sin decir nada son 168 motivos para desconfiar de lo
 * que sí ha entrado.
 */
export const mensajeConstruccionesFuera = (cuantas, capa) =>
  `El dibujo trae además ${cuantas} polilínea(s) en la capa «${capa}» que no son parcelas ` +
  `y no entran aquí. Para meter un edificio, cambia a la rama Edificio y suelta el mismo ` +
  `fichero: allí sí se leen.`

/**
 * Compone la parcela a partir de la finca ELEGIDA de un dibujo de varias.
 *
 * ⭐ **La decisión 2 de F22 vive aquí, y es la que separa este compositor de
 * {@link componerParcelaMedida}.** Un DXF de «Consulta Masiva» **no es el
 * levantamiento del técnico**: es cartografía DEL Catastro que el técnico ha
 * descargado. Tratarla como medición propia sería rotularle «Tu medición · no del
 * Catastro» a un polígono que el usuario no ha medido — el error caro de esta
 * aplicación, con el signo cambiado.
 *
 * **El criterio sale del DATO, no de un fingerprint del fichero**: si el dibujo
 * trae rótulos que nombran las fincas 1:1 —en la práctica, la capa `RefCatastral`
 * de la descarga del Catastro— la geometría entra como OFICIAL: ocupa `recintos`
 * **y** `geometriaOficial`, y el rótulo da la `refcat`. Sin esos nombres no hay
 * nada que respalde llamarla oficial, y entra como MEDICIÓN, que es lo que decidió
 * F18.
 *
 * ⚠️ **`geometriaOficial === recintos` hace que el Diagnóstico salga en CERO hasta
 * que el técnico edite, y eso es correcto**: todavía no ha medido nada. Es la misma
 * tautología que F21 dejó escrita para el contraste de edificio, y se dice para que
 * nadie lea ese cero como una verificación.
 *
 * @param {Array<[number,number]>} anillo  El anillo ABIERTO de la finca elegida.
 * @param {{nombre: string|null}} candidata  Su ficha, de la detección de `importar`.
 * @param {object} args
 * @param {string} args.origen  Uno de `ORIGEN_PARCELA`.
 * @param {string} args.nombreFichero  Último recurso para el `idLocal`.
 * @returns {object}  Parcela del modelo.
 */
export function componerParcelaElegida(anillo, candidata, { origen, nombreFichero }) {
  const recintos = [crearRecinto(anillo, TIPO_RECINTO.EXTERIOR)]
  const nombre = esTexto(candidata?.nombre) ? candidata.nombre : null

  return crearParcela({
    // La referencia sirve de `idLocal` cuando la hay: es lo que identifica la finca
    // en todas las demás pantallas. Sin ella, el nombre del fichero, que es el
    // mismo último recurso que usa `componerParcelaMedida`.
    idLocal: nombre ?? (esTexto(nombreFichero) ? nombreFichero : 'finca-elegida'),
    refcat: nombre,
    recintos,
    // ⛔ Toda la decisión 2 en una línea, y su condición en la de arriba.
    geometriaOficial: nombre === null ? null : recintos,
    origen,
  })
}

/**
 * Los mensajes que hay que publicar en el panel tras una importación, sin repetir.
 *
 * Se sigue la convención de F11: **`ERROR` y `AVISO` salen; `INFO` no**. Lo
 * informativo que sí importa —dónde cae la parcela— se dice UNA vez y a propósito,
 * en el renglón de procedencia, en vez de dejar escapar detecciones sueltas.
 *
 * @param {Array<object>} detecciones
 * @returns {Array<{mensaje: string, nivel: string}>}
 */
function avisosDe(detecciones) {
  const vistos = new Set()
  const salida = []
  for (const d of Array.isArray(detecciones) ? detecciones : []) {
    if (!esTexto(d?.mensaje) || vistos.has(d.mensaje)) continue
    if (d.severidad !== SEVERIDAD.AVISO && d.severidad !== SEVERIDAD.ERROR) continue
    vistos.add(d.mensaje)
    salida.push({
      mensaje: d.mensaje,
      nivel: d.severidad === SEVERIDAD.ERROR ? NIVEL.ERROR : NIVEL.AVISO,
    })
  }
  return salida
}

// ── El cableado ──────────────────────────────────────────────────────────────

/**
 * Cablea la vía de MEDICIÓN PROPIA. Es el **paso 17** del ensamblaje de
 * `app/main.js`.
 *
 * ```js
 * const medicion = cablearMedicion({
 *   estado, panel,
 *   alCargarParcela: edicionCableada.alCargarParcela,
 *   idLocalDemo: ID_LOCAL_DEMO,
 * })
 * \ … en el `entradasExtra` del paso 9, cuando la rama en pantalla es PARCELA:
 * medicion.alFichero(fichero)
 * \ … al cerrar la pantalla:
 * medicion.destruir()
 * ```
 *
 * @param {object} opciones
 * @param {{get: Function, set: Function}} opciones.estado  El store de la parcela.
 * @param {{avisar: Function}} opciones.panel
 * @param {(parcela: object) => void} [opciones.alCargarParcela]  El gancho de F06.
 * @param {string|null} [opciones.idLocalDemo=null]  Ver {@link componerParcelaMedida}.
 * @param {Document} [opciones.documento=document]
 * @param {HTMLElement} [opciones.procedencia]  El renglón de {@link SELECTOR_PROCEDENCIA}.
 * @param {object} [opciones.dialogo]  Inyectable para el test; si no, se fabrica.
 * @returns {{alFichero: (f: File) => Promise<void>, destruir: () => void}}
 * @throws {TypeError}  Contrato del programador.
 */
export function cablearMedicion({
  estado,
  panel,
  alCargarParcela = null,
  idLocalDemo = null,
  documento = document,
  procedencia = nodo(SELECTOR_PROCEDENCIA),
  dialogo = null,
  parcelas = null,
  colindantes = null,
  alPedirEleccion = null,
  cajonesQueCerrar = [],
} = {}) {
  // ── Contratos del programador, ANTES de tocar un solo nodo ────────────────
  if (!estado || typeof estado.get !== 'function' || typeof estado.set !== 'function') {
    throw new TypeError("cablearMedicion: 'estado' debe ser el store de la parcela (get/set).")
  }
  if (!panel || typeof panel.avisar !== 'function') {
    throw new TypeError("cablearMedicion: 'panel' debe tener un método 'avisar'.")
  }
  if (alCargarParcela !== null && typeof alCargarParcela !== 'function') {
    throw new TypeError("cablearMedicion: 'alCargarParcela' debe ser una función o null.")
  }
  if (alPedirEleccion !== null && typeof alPedirEleccion !== 'function') {
    throw new TypeError("cablearMedicion: 'alPedirEleccion' debe ser una función o null.")
  }
  if (parcelas !== null && (!parcelas.cajon || !parcelas.capa)) {
    // Se comprueba la FORMA y no cada método: es `visor.parcelas` tal cual, y un
    // `{cajon}` a medias es un error de cableado que reventaría más tarde y lejos.
    throw new TypeError(
      "cablearMedicion: 'parcelas' debe ser `visor.parcelas` ({cajon, capa}) o null.",
    )
  }

  let destruido = false

  // ── ⛔ EL TOKEN DE LA PUERTA: ENTRE DOS FICHEROS MANDA EL ÚLTIMO SOLTADO ────
  //
  // **Auditoría 2026-08-16, hallazgo B2.** {@link alFichero} lee los bytes con un
  // `await` y nada ordenaba las dos lecturas: soltar dos ficheros casi a la vez
  // —o uno mientras el anterior todavía se leía— dejaba ganar al que RESUELVE
  // último, que con un fichero grande y otro pequeño es el que se soltó PRIMERO. El
  // usuario veía entrar lo que acababa de soltar y, un instante después, otra cosa.
  //
  // Es exactamente la defensa 2 del Catastro (`app/cableado-catastro.js`: «una
  // respuesta lenta de un encuadre viejo NUNCA puede pisar una imagen más nueva»)
  // aplicada a la otra puerta por la que entra geometría. Aquí es igual de caro:
  // esto escribe la geometría que se firma y `alCargarParcela` reinicia el
  // historial, así que lo pisado tampoco vuelve con Ctrl+Z.
  //
  // ⚠️ Y **con aviso**, al revés que la consulta superada del Catastro: allí el
  // usuario sabe que ha sustituido su propia consulta; aquí no sabe que el primer
  // fichero seguía leyéndose. Ver {@link mensajeFicheroSuperado}.
  let secuenciaFichero = 0
  /** El nombre del último fichero aceptado, para poder decir quién ganó. */
  let ficheroVigente = null

  const revision = dialogo ?? crearDialogoImportacion({ documento, alAvisar: panel.avisar })

  const avisar = (mensaje, nivel = NIVEL.AVISO, extra = {}) => {
    panel.avisar(mensaje, { nivel, ...extra })
  }

  /**
   * Un fallo que NO es del fichero sino de esta casa. Se cuenta por el panel con
   * redacción de usuario y por la consola con el detalle. Nunca se propaga: esto
   * cuelga de un `drop`, y una excepción dentro de un oyente del DOM no llega a
   * ninguna parte (la lección de F08 entera).
   */
  function reventar(donde, causa) {
    avisar(MENSAJE_FALLO_INESPERADO, NIVEL.ERROR, { causa })
    console.error(`[medicion] ${donde}:`, causa)
  }

  /**
   * Mete la parcela en el store y deja la pantalla coherente. **Un solo `set`**, y
   * el gancho DESPUÉS: quien escuche se encuentra el store ya escrito.
   *
   * @param {object} resultado  El definitivo de `importar()`.
   * @param {string} nombre
   * @param {string|null} capa
   * @param {boolean} deFichero  Ver {@link textoProcedenciaMedicion}.
   */
  function aplicar(resultado, nombre, capa, deFichero) {
    const origen = ORIGEN_POR_FORMATO[resultado.resumen.formato]
    if (origen === undefined) {
      // Inalcanzable: `importar` solo emite LIST/TXT/DXF. Si deja de ser cierto que
      // se vea aquí, y no en un `origen` inválido dentro del modelo.
      throw new RangeError(
        `cablearMedicion: 'importar' devolvió el formato ${JSON.stringify(resultado.resumen.formato)}, ` +
          `que no tiene ORIGEN_PARCELA. Conocidos: ${Object.keys(ORIGEN_POR_FORMATO).join(', ')}.`,
      )
    }

    const actual = estado.get()
    const parcela = componerParcelaMedida(actual, resultado.parcela.recintos, {
      origen,
      idLocalDemo,
      nombreFichero: nombre,
    })

    estado.set(parcela)

    if (procedencia) {
      procedencia.textContent = textoProcedenciaMedicion({
        nombreFichero: nombre,
        capa,
        conParcelario: parcela.geometriaOficial !== null,
        huso: resultado.resumen.huso,
        deFichero,
      })
    }

    // Lo que hubo que decidir o que conviene saber, DESPUÉS de que la pantalla ya
    // enseñe la geometría: un aviso sobre algo que todavía no se ve no se entiende.
    for (const { mensaje, nivel } of avisosDe(resultado.detecciones)) avisar(mensaje, nivel)

    if (parcela.refcat === null) avisar(MENSAJE_SIN_REFERENCIA)

    // ⛔ **EL ÚLTIMO EN EMITIRSE PARA QUEDAR EL PRIMERO EN LEERSE.** Comprobado en
    // `app/avisos.js`, no supuesto: el panel ordena **el más reciente arriba**
    // (regla de diseño 6) y enseña 12 tarjetas como mucho. Si el dibujo declara
    // una superficie y no es la que ha entrado, eso es LA cosa que hay que leer
    // —significa que la geometría que estás mirando no es la que mediste—, y
    // enterrarla bajo doce avisos de separadores decimales sería no decirla.
    // Ver {@link avisoDeSuperficie} para el caso real que lo puso aquí.
    const cotejo = avisoDeSuperficie(resultado.resumen.superficie)
    if (cotejo !== null) avisar(cotejo)

    // ⛔ EL ÚLTIMO, y si revienta lo de arriba ya está hecho: una parcela cargada no
    // se descarga porque falle un oyente. Mismo criterio que `notificarCarga` en
    // `cableado-catastro.js` y en `cableado-comprobacion.js`.
    if (alCargarParcela !== null && !destruido) {
      try {
        alCargarParcela(parcela)
      } catch (causa) {
        reventar('el aviso de parcela cargada (alCargarParcela) ha fallado', causa)
      }
    }
  }

  // ── F22 · La elección de finca ──────────────────────────────────────────────
  //
  // ⚠️ **Las suscripciones se hacen UNA vez, aquí, y no al abrir el cajón.** El
  // cajón se abre una vez por fichero soltado, así que suscribirse ahí acumularía
  // un oyente por fichero y el segundo dibujo cargaría dos parcelas. Lo que cambia
  // entre ficheros es el DATO, y ese vive en `pendiente`.

  /** El dibujo que está esperando a que se elija una finca, o `null`. */
  let pendiente = null

  /** Suelta lo pintado y olvida el dibujo. No toca el store. */
  function olvidarEleccion() {
    pendiente = null
    if (parcelas === null) return
    parcelas.capa.pintar(null)
    parcelas.cajon.pintar(null)
    parcelas.cajon.cerrar()
  }

  if (parcelas !== null) {
    // Marcar en la lista ⇒ resaltar en el mapa. Es la mitad que la decisión 3
    // compró: ocho referencias que comparten los once primeros caracteres no se
    // distinguen leyendo.
    parcelas.cajon.alElegir((i) => {
      if (!destruido) parcelas.capa.resaltar(i)
    })
    // Y señalar en el mapa ⇒ marcar en la lista. `marcar` NO reemite, así que el
    // bucle mapa → cajón → mapa no se cierra sobre sí mismo.
    parcelas.capa.alSenalar((i) => {
      if (destruido) return
      parcelas.cajon.marcar(i)
      parcelas.capa.resaltar(i)
    })
    parcelas.cajon.alConfirmar((i) => {
      if (!destruido) confirmarFinca(i)
    })
    parcelas.cajon.alDescartar(() => {
      if (destruido) return
      olvidarEleccion()
      avisar(MENSAJE_FINCAS_DESCARTADAS, NIVEL.INFO)
    })
  }

  /**
   * **T4.5 · Las construcciones se NOMBRAN, aunque no entren.**
   *
   * El DXF de «Consulta Masiva» trae 168 huellas de edificio además de las fincas,
   * y la decisión 4 de F22 las deja fuera: la rama EDIFICIO tiene su propia entrada
   * y su propia regla de partes. Lo que no puede pasar es que se caigan en
   * silencio — 168 polilíneas que el usuario ve en su CAD y la aplicación ignora
   * sin decir nada son 168 motivos para desconfiar de lo que sí ha entrado.
   *
   * El reparto por capas lo publica `parsers/importar.js` en `datos.capas` de su
   * detección de reparto, que es un contrato ya publicado (lo lee también
   * `edificio/entrada.js`): se lee de ahí y no se vuelve a contar.
   */
  function avisarConstruccionesFuera(resultado, opts) {
    const elegida = esTexto(opts.capa) ? opts.capa : null
    if (elegida === null) return
    const reparto = resultado.detecciones.find(
      (d) => d?.datos?.aplicado === 'FILTRADO' && d?.datos?.capas,
    )
    if (!reparto) return
    for (const [capa, cuantos] of Object.entries(reparto.datos.capas)) {
      if (capa !== elegida && cuantos > 0) avisar(mensajeConstruccionesFuera(cuantos, capa), NIVEL.INFO)
    }
  }

  /**
   * El dibujo trae N fincas separadas: se pintan, se enumeran y se pregunta.
   *
   * **No mete nada en el store.** Lo único que hace es poner la pregunta delante,
   * que es exactamente lo que a esta aplicación le faltaba: hasta F22 el recorrido
   * moría en «No ha entrado ninguna parcela de ese fichero» después de haber
   * pedido —y obtenido— una decisión que no arreglaba nada.
   *
   * @param {object} resultado  El de `importar()`, con el bloqueo puesto.
   * @param {object} aviso  La detección `VARIOS_RECINTOS_DISJUNTOS`.
   * @param {string} nombre
   * @param {boolean} deFichero
   */
  function ofrecerEleccion(resultado, aviso, nombre, deFichero) {
    const candidatas = aviso.datos.recintos
    pendiente = { resultado, candidatas, nombre, deFichero }

    parcelas.capa.pintar(
      candidatas.map((c, i) => ({
        vertices: resultado.anillos[i],
        nombre: c.nombre ?? null,
        superficie: c.superficie,
      })),
    )
    parcelas.cajon.pintar({
      nombre,
      candidatas,
      capaRotulos: aviso.datos.rotulos?.capa ?? null,
    })

    // (el encuadre va después de abrir el cajón; ver más abajo)

    // Los cajones de esta esquina son caras del mismo hueco. Se cierran ANTES de
    // abrir el nuestro y NO por su guardián de clic-fuera: soltar un fichero no es
    // un clic, así que ese guardián no se entera y quedarían dos apilados. Es el
    // mismo gesto, y por el mismo motivo, que hace `cableado-comprobacion.js`.
    for (const otro of cajonesQueCerrar) {
      try {
        otro.cerrar()
      } catch (causa) {
        reventar('cerrar un cajón vecino ha fallado', causa)
      }
    }
    parcelas.cajon.abrir()

    // ⛔ **Y SE LLEVA EL MAPA HASTA ELLAS, que el guion 24 midió a 0 × 0 px.** Las
    // candidatas no pasan por el store, y el store es quien reencuadra: con la
    // aplicación recién abierta —mirando a España entera— una manzana de cien
    // metros ocupa menos de un píxel. El cajón decía «marca la tuya, se resalta en
    // el mapa» y en el mapa no había nada que mirar. La suite no podía verlo: en
    // jsdom `getBoundingClientRect()` devuelve ceros.
    //
    // ⛔ **Y DESPUÉS DE `abrir()`, esquivando el cajón**, que es la segunda mitad
    // del mismo hallazgo: con las ocho dentro del mapa, el cajón tapaba CINCO al
    // 100 %. Se pide su caja —que solo tiene sentido con el cajón ya abierto— y el
    // encuadre deja ese trozo libre.
    parcelas.capa.encuadrar({ evitar: parcelas.cajon.caja() })

    avisar(mensajeElegirFinca(candidatas.length))

    // Llevar al usuario a la pantalla a la que pertenece este cajón. Sin esto,
    // soltar el fichero desde Diagnóstico dejaría el rail diciendo «Diagnóstico»
    // con la pregunta de Entrada en la esquina del mapa — o, peor, con el cajón
    // cerrado por el dueño de la esquina y la pregunta sin hacer. Mismo gancho y
    // mismo porqué que `alPedirEleccion` en `cableado-comprobacion.js`.
    if (alPedirEleccion !== null) {
      try {
        alPedirEleccion()
      } catch (causa) {
        reventar('el aviso de elección pendiente (alPedirEleccion) ha fallado', causa)
      }
    }
  }

  /**
   * El usuario ha elegido. La finca `i` entra en el store; **las demás se quedan
   * como parcelario de contexto**, que es la decisión 1 de F22 y lo que convierte
   * un arreglo en una vía nueva: el DXF hace sin red lo que hoy solo hace el WFS.
   *
   * @param {number} i  Índice en la lista de candidatas.
   */
  function confirmarFinca(i) {
    if (pendiente === null) return
    const { resultado, candidatas, nombre, deFichero } = pendiente
    const anillo = resultado.anillos[i]
    if (!Array.isArray(anillo)) return

    try {
      const parcela = componerParcelaElegida(anillo, candidatas[i], {
        origen: ORIGEN_POR_FORMATO[resultado.resumen.formato],
        nombreFichero: nombre,
      })

      // ⚠️ Las vecinas se calculan ANTES del `set`, porque el `set` dispara el
      // reencuadre del visor y ése LIMPIA las colindantes (es una parcela nueva).
      // Pintarlas antes las borraría el propio store.
      const vecinas = candidatas
        .map((c, j) => ({ c, j }))
        .filter(({ j }) => j !== i && Array.isArray(resultado.anillos[j]))
        .map(({ c, j }) => ({
          refcat: c.nombre ?? null,
          recintos: [crearRecinto(resultado.anillos[j], TIPO_RECINTO.EXTERIOR)],
        }))

      estado.set(parcela)
      olvidarEleccion()

      if (procedencia) {
        // ⛔ **DOS renglones y no uno, y el guion 24 dijo por qué.** Con nombre, la
        // geometría es cartografía DEL Catastro y el texto de F18 —«medida por ti
        // — NO del Catastro»— contradecía a la cabecera dos centímetros más
        // arriba. Sin nombre no hay nada que respalde llamarla oficial y vale el
        // renglón de siempre.
        procedencia.textContent =
          parcela.refcat === null
            ? textoProcedenciaMedicion({
                nombreFichero: nombre,
                capa: candidatas[i]?.capa ?? null,
                conParcelario: parcela.geometriaOficial !== null,
                huso: resultado.resumen.huso,
                deFichero,
              })
            : textoProcedenciaFincaElegida({
                nombreFichero: nombre,
                capa: candidatas[i]?.capa ?? null,
                refcat: parcela.refcat,
                huso: resultado.resumen.huso,
              })
      }

      for (const { mensaje, nivel } of avisosDe(resultado.detecciones)) avisar(mensaje, nivel)
      if (parcela.refcat === null) avisar(MENSAJE_SIN_REFERENCIA)

      if (alCargarParcela !== null && !destruido) {
        try {
          alCargarParcela(parcela)
        } catch (causa) {
          reventar('el aviso de parcela cargada (alCargarParcela) ha fallado', causa)
        }
      }

      // ⛔ **LAS VECINAS VAN LAS ÚLTIMAS, DESPUÉS DE `alCargarParcela`, Y ESO SE
      // DESCUBRIÓ CON UN TEST EN ROJO.** Estaban justo detrás del `set`, que es
      // donde parecía que tocaban, y la ficha del panel seguía diciendo «Sin
      // consultar» con siete vecinas dibujadas en el mapa.
      //
      // El motivo: `alCargarParcela` significa «documento nuevo», y por eso
      // `cablearEdicion#alCambiarOficial` llama a `alContarColindantes(null)` —
      // unas vecinas traídas para OTRA parcela ya no valen, que es correcto para
      // la vía del Catastro—. Aquí las vecinas vienen del MISMO fichero que la
      // parcela, así que no caducan con ella: se ponen cuando ya nadie las va a
      // borrar.
      //
      // ⚠️ Y las candidatas se leen de `pendiente` ANTES —arriba, en `vecinas`—
      // porque `olvidarEleccion()` ya lo ha vaciado a estas alturas.
      if (colindantes !== null && vecinas.length > 0) colindantes.pintar(vecinas)
      avisar(mensajeVecinasDelDibujo(vecinas.length), NIVEL.INFO)
    } catch (causa) {
      // `crearParcela` lanza si la geometría rompe un invariante del modelo, y ese
      // camino no puede acabar en un cajón mudo.
      parcelas.cajon.estado('La finca no se ha cargado. El motivo está en el panel de avisos.')
      reventar('la carga de la finca elegida ha fallado', causa)
    }
  }

  /**
   * Un `.dxf` o un `.txt` soltado con la rama PARCELA puesta.
   *
   * **No lanza nunca** y cuenta por el panel todo lo que decide.
   *
   * ⚠️ **Lo único que hace de fichero es sacarle el texto.** De ahí abajo el
   * camino es {@link alTexto} y es el MISMO que el del pegado (F19): las rondas de
   * decisión, la composición y el `estado.set` nunca supieron de dónde venía el
   * volcado, y por eso el pegado costó partir esta función y no escribir otra.
   *
   * @param {File} fichero
   * @returns {Promise<void>}
   */
  async function alFichero(fichero) {
    if (destruido) return
    const nombre = esTexto(fichero?.name) ? fichero.name : 'fichero sin nombre'

    // El token se coge al ACEPTAR el fichero, no al terminar de leerlo: es el orden
    // en que el usuario los soltó, que es el único que él conoce. Ver el token.
    const token = ++secuenciaFichero
    ficheroVigente = nombre

    /** @type {ArrayBuffer} */
    let crudo
    try {
      crudo = await fichero.arrayBuffer()
    } catch (causa) {
      avisar(MENSAJE_FICHERO_NO_LEIDO, NIVEL.ERROR, { causa })
      console.error(`[medicion] no se han podido leer los bytes de «${nombre}»:`, causa)
      return
    }
    if (destruido) return
    if (token !== secuenciaFichero) {
      // Superado mientras se leía. No se decodifica siquiera —el trabajo ya no le
      // sirve a nadie— y se cuenta con los dos nombres.
      avisar(mensajeFicheroSuperado(nombre, ficheroVigente ?? 'otro fichero'))
      return
    }

    let texto
    try {
      // ⚠️ `new Uint8Array(...)` y no el búfer a pelo: la vista se construye con el
      // `Uint8Array` de ESTE realm, que es el del `instanceof` de
      // `gml/decodificar.js#aBytes`. Uno de otro realm —jsdom, un iframe— haría
      // lanzar a aquella función. Medido en F08 y reaprovechado en F11.
      ;({ texto } = decodificarGml(new Uint8Array(crudo)))
    } catch (causa) {
      reventar(`la lectura de «${nombre}» ha fallado`, causa)
      return
    }

    await alTexto(texto, nombre, true, token)
  }

  /**
   * Un volcado de coordenadas YA EN TEXTO, venga de donde venga: de un fichero
   * (arriba) o del pegado de la LISTA de AutoCAD (F19, `app/dialogo-pegado.js`).
   *
   * **No lanza nunca** y cuenta por el panel todo lo que decide.
   *
   * @param {string} texto   El volcado.
   * @param {string} nombre  Cómo llamarlo en pantalla y en el `idLocal`.
   * @param {boolean} [deFichero=false]  Solo cambia CÓMO SE NOMBRA el origen en el
   *   renglón de procedencia: llamar «fichero» a lo que el usuario acaba de pegar
   *   es una afirmación falsa, y justo en la línea que existe para decir de dónde
   *   salió el dato. Lo destapó la primera corrida del guion 18.
   * @param {number|null} [token=null]  El de la puerta, cuando esto viene de un
   *   fichero: {@link alFichero} ya lo cogió al aceptarlo y aquí solo se comprueba.
   *   `null` es «esta entrada es nueva» —el pegado— y entonces coge el suyo, que es
   *   lo correcto: pegar unas coordenadas también es soltar algo, y si hay un
   *   fichero todavía leyéndose, manda lo último que el usuario ha hecho.
   * @returns {Promise<void>}
   */
  async function alTexto(texto, nombre = 'coordenadas pegadas', deFichero = false, token = null) {
    if (destruido) return
    if (!esTexto(texto)) {
      // Contrato del programador, no dato del usuario: un pegado vacío lo para el
      // diálogo mucho antes de llegar aquí.
      throw new TypeError(`cablearMedicion.alTexto: 'texto' debe ser un string no vacío.`)
    }

    let vigilancia = token
    if (vigilancia === null) {
      vigilancia = ++secuenciaFichero
      ficheroVigente = nombre
    }

    try {
      // ── 1 · ¿Es NUESTRO listado de replanteo? ────────────────────────────
      // Antes de `importar()`, porque su diagnóstico sobre este fichero es falso.
      if (esListadoDeReplanteo(texto)) {
        avisar(MENSAJE_ES_LISTADO_PROPIO)
        return
      }

      // ── 2 · Las rondas de decisión ───────────────────────────────────────
      let resultado = importar(texto)
      let opts = {}
      const resueltas = new Set()

      for (let ronda = 0; ronda < RONDAS_MAX; ronda++) {
        const { decisiones } = decisionesDe(resultado)
        const pendientes = decisiones.filter((d) => !resueltas.has(d.tipo))
        if (pendientes.length === 0) break

        const elegido = await revision.abrir({ nombre, resultado })
        if (destruido) return
        if (elegido === null) {
          avisar(MENSAJE_CANCELADO)
          return
        }
        for (const d of decisiones) resueltas.add(d.tipo)
        opts = { ...opts, ...elegido }
        resultado = importar(texto, opts)
      }

      // ⛔ **Y aquí otra vez el token**, porque las rondas de decisión son el otro
      // `await` de este recorrido: soltar un fichero mientras la pantalla de
      // revisión del anterior está abierta dejaría entrar los DOS, y el viejo el
      // último. Se comprueba después de la última espera y antes de tocar nada.
      if (vigilancia !== secuenciaFichero) {
        avisar(mensajeFicheroSuperado(nombre, ficheroVigente ?? 'otro fichero'))
        return
      }

      // ── 2 bis · ⭐ F22 · ¿Es que el dibujo trae VARIAS fincas? ────────────
      // Va ANTES del paso 3 porque no es un fallo: es una pregunta que la
      // aplicación sabe hacer. Hasta F22 esto caía en «No ha entrado ninguna
      // parcela de ese fichero» **después** de haber pedido y obtenido una
      // decisión —la capa— que no arreglaba nada, que es peor que no ofrecer
      // ninguna salida.
      //
      // Sin `parcelas` cableado (un test, un uso como librería) NO se desvía y el
      // recorrido sigue al paso 3, donde el bloqueo se cuenta con palabras. Se
      // degrada, no se rompe.
      const disjuntas =
        parcelas !== null &&
        resultado.resumen.bloqueos.includes(BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS)
          ? resultado.detecciones.find(
              (d) => d?.datos?.bloqueo === BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS,
            )
          : null

      if (disjuntas) {
        avisarConstruccionesFuera(resultado, opts)
        ofrecerEleccion(resultado, disjuntas, nombre, deFichero)
        return
      }

      // ── 3 · ¿Ha salido una parcela? ──────────────────────────────────────
      if (!resultado.resumen.construida || resultado.parcela === null) {
        // El motivo lo da `importar()`, que es quien sabe. Aquí solo se antepone
        // que no ha entrado nada, para que no parezca que sí y además hay avisos.
        avisar(ENCABEZADO_NO_CONSTRUIDA)
        for (const { mensaje, nivel } of avisosDe(resultado.detecciones)) avisar(mensaje, nivel)
        return
      }

      aplicar(resultado, nombre, esTexto(opts.capa) ? opts.capa : null, deFichero)
    } catch (causa) {
      reventar(`la lectura de «${nombre}» ha fallado`, causa)
    }
  }

  return {
    alFichero,
    alTexto,
    inspeccionarTexto,

    /** Cierra la revisión que hubiera abierta y se desengancha. Idempotente. */
    destruir() {
      if (destruido) return
      destruido = true
      // F22 · Un dibujo a medio elegir no sobrevive al desmontaje: sus fincas
      // dibujadas se quedarían en el mapa sin cajón desde el que elegirlas.
      olvidarEleccion()
      // Solo se destruye el diálogo si lo hemos fabricado nosotros: uno inyectado
      // es de quien lo inyectó, y destruirlo sería tirar de un cable ajeno.
      if (dialogo === null) revision.destruir()
    },
  }
}
