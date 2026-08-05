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
import { ORIGEN_PARCELA, crearParcela } from '../model/parcela.js'
import { SEVERIDAD } from '../parsers/_comun.js'
import { importar } from '../parsers/importar.js'
import { NIVEL } from '../viewer/_comun.js'
import { SELECTOR_PROCEDENCIA } from './cableado-catastro.js'
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
  'No se ha podido leer ese fichero. Si lo has arrastrado desde una unidad de red o desde el ' +
  'correo, prueba a guardarlo primero en el disco.'

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

// ── Textos de procedencia ────────────────────────────────────────────────────

/**
 * El renglón `[data-procedencia="parcela"]` cuando la geometría entra de una
 * medición. Dice **tres** cosas y las tres importan:
 *
 *   1. **de dónde sale la geometría** —del fichero, NO del Catastro—, que es lo que
 *      impide que un levantamiento propio se lea como dato oficial;
 *   2. **qué pasa con el parcelario**, que es distinto según se haya conservado o
 *      no (ver {@link componerParcelaMedida});
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
 * @param {object} args
 * @param {string} args.nombreFichero
 * @param {string|null} [args.capa=null]  La capa elegida del DXF, si hubo elección.
 * @param {boolean} args.conParcelario  Si se ha conservado la geometría oficial.
 * @param {{zona: number, srs: string}|null} [args.huso=null]
 * @returns {string}
 */
export function textoProcedenciaMedicion({ nombreFichero, capa = null, conParcelario, huso = null }) {
  const deCapa = esTexto(capa) ? ` (capa «${capa}»)` : ''
  const geometria = `Geometría medida por ti, del fichero «${nombreFichero}»${deCapa} — NO del Catastro.`
  const parcelario = conParcelario
    ? ' Se conserva el parcelario que ya estaba en pantalla, solo para contrastar.'
    : ' Sin parcelario con el que contrastarla: tráelo con la referencia catastral.'
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
    idLocal: actual.idLocal,
    refcat: actual.refcat ?? null,
    recintos,
    // ⛔ INTACTA. Es toda la decisión de la fase en una línea.
    geometriaOficial: actual.geometriaOficial ?? null,
    superficieCatastral: actual.superficieCatastral ?? null,
    superficieRegistral: actual.superficieRegistral ?? null,
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

  let destruido = false
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
   */
  function aplicar(resultado, nombre, capa) {
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
      })
    }

    // Lo que hubo que decidir o que conviene saber, DESPUÉS de que la pantalla ya
    // enseñe la geometría: un aviso sobre algo que todavía no se ve no se entiende.
    for (const { mensaje, nivel } of avisosDe(resultado.detecciones)) avisar(mensaje, nivel)
    if (parcela.refcat === null) avisar(MENSAJE_SIN_REFERENCIA)

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

  /**
   * Un `.dxf` o un `.txt` soltado con la rama PARCELA puesta.
   *
   * **No lanza nunca** y cuenta por el panel todo lo que decide.
   *
   * @param {File} fichero
   * @returns {Promise<void>}
   */
  async function alFichero(fichero) {
    if (destruido) return
    const nombre = esTexto(fichero?.name) ? fichero.name : 'fichero sin nombre'

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

    try {
      // ⚠️ `new Uint8Array(...)` y no el búfer a pelo: la vista se construye con el
      // `Uint8Array` de ESTE realm, que es el del `instanceof` de
      // `gml/decodificar.js#aBytes`. Uno de otro realm —jsdom, un iframe— haría
      // lanzar a aquella función. Medido en F08 y reaprovechado en F11.
      const { texto } = decodificarGml(new Uint8Array(crudo))

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

      // ── 3 · ¿Ha salido una parcela? ──────────────────────────────────────
      if (!resultado.resumen.construida || resultado.parcela === null) {
        // El motivo lo da `importar()`, que es quien sabe. Aquí solo se antepone
        // que no ha entrado nada, para que no parezca que sí y además hay avisos.
        avisar(ENCABEZADO_NO_CONSTRUIDA)
        for (const { mensaje, nivel } of avisosDe(resultado.detecciones)) avisar(mensaje, nivel)
        return
      }

      aplicar(resultado, nombre, esTexto(opts.capa) ? opts.capa : null)
    } catch (causa) {
      reventar(`la lectura de «${nombre}» ha fallado`, causa)
    }
  }

  return {
    alFichero,

    /** Cierra la revisión que hubiera abierta y se desengancha. Idempotente. */
    destruir() {
      if (destruido) return
      destruido = true
      // Solo se destruye el diálogo si lo hemos fabricado nosotros: uno inyectado
      // es de quien lo inyectó, y destruirlo sería tirar de un cable ajeno.
      if (dialogo === null) revision.destruir()
    },
  }
}
