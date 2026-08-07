// app/cableado-informe-edificio.js — F14 · El informe de construcción, entregado.
//
// ── QUÉ HACE ────────────────────────────────────────────────────────────────
// Escucha «Preparar informe (PDF)» del cajón de contraste de edificio, compone el
// plano, maqueta el documento con `report/pdf-edificio.js` y lo baja. Es el
// gemelo de `app/cableado-informe.js` en la otra rama, con la misma anatomía y
// las mismas tres capas de fallo contadas por separado —plano, maquetación,
// entrega—, porque llevan a acciones distintas.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔⛔ POR QUÉ ESTE INFORME **NO** ABRE EL DIÁLOGO DE F09
// ═════════════════════════════════════════════════════════════════════════════
// El plan de F14 decía «el diálogo y la descarga». Se entrega la descarga y **no
// el diálogo**, y la desviación tiene tres motivos medidos, no uno de comodidad:
//
//  1. **El diálogo de F09 EXIGE un lindero.** `app/dialogo-informe.js#fijar` llama
//     a `exigirLindero(lindero, 'fijar')`, que lanza con `null`. Una construcción
//     no tiene lindero: tiene una huella. Pasarle uno sintético metería un editor
//     de descripción literaria de linderos encima de un informe de construcción —
//     contenido equivocado en un documento que se firma.
//  2. **Ofrece «Tipo de operación», que el ICUC no pide.** Está MEDIDO en F13,
//     el día que la Sede aceptó el fichero: el formulario del ICUC no tiene ese
//     campo. Enseñarlo aquí haría declarar un acto jurídico que nadie va a leer.
//  3. **Una segunda instancia colisionaría por selector.** `crearDialogoInforme`
//     cuelga su `<dialog>` del `<body>` con `[data-accion="componer-pdf"]`,
//     `[data-informe="literal"]` y los cuatro `[data-firma="…"]`. Dos juegos en el
//     mismo documento y `querySelector` se queda con el PRIMERO: los guiones 11 y
//     14 resuelven algunos de esos nodos de forma GLOBAL, así que uno de los dos
//     diálogos quedaría mudo sin un solo síntoma. Es la trampa M8 de F07, que este
//     proyecto ya ha pagado dos veces.
//
// ── ⚠️ Y LO QUE ESO CUESTA, DICHO ANTES DE QUE LO DESCUBRA NADIE ───────────
// El pie de firma **no se puede teclear desde esta rama**: se toma el que el
// navegador ya recuerde (`storage/pie-firma.js`, que llena F09 con su casilla
// «Recordar»). Si no hay ninguno guardado, el informe SALE IGUAL con los cuatro
// campos en «No consta» —`report/pdf-edificio.js` lo documenta como lo correcto y
// no como un hueco— y **el renglón del cajón lo dice**, con lo que hay que hacer
// para tenerlo. Un informe que se baja sin avisar de que va sin firmar sería
// exactamente el error silencioso que la regla de oro 1 prohíbe.
//
// Queda anotado como límite conocido de F14: la captura de firma propia de esta
// rama es alcance de otra fase, no un olvido de ésta.
//
// ═════════════════════════════════════════════════════════════════════════════
// EL PLANO DEGRADA, NO CANCELA
// ═════════════════════════════════════════════════════════════════════════════
// Misma decisión que F09, y por lo mismo: un plano que no se puede componer —el
// WMS no contesta, `toDataURL` devuelve `null`— no puede impedir que el informe
// baje. El motivo sale por los dos canales de la casa (panel y consola) y **el
// propio PDF lo dice en su sección**, que es lo que sobrevive a que alguien lo
// reenvíe.
//
// ⚠️ En jsdom `toDataURL()` devuelve `null` **SIN LANZAR** (medido en F09), así
// que aquí no basta con un `try`: quien decide si hay plano es el valor, no la
// ausencia de excepción.

import { TIPO_MIME_PDF, descargarBinario } from '../gml/descargar.js'
import { componerPlano } from '../report/canvas.js'
import { encuadrar } from '../report/encuadre.js'
import { componerEncabezado, componerIdDocumento } from '../report/firma.js'
import { informePdfEdificio, nombreDelInforme } from '../report/pdf-edificio.js'
import { envolventeDe } from '../edificio/envolvente.js'
import { NIVEL } from '../viewer/_comun.js'

// ── Medidas del plano ────────────────────────────────────────────────────────
//
// Las MISMAS que el informe de parcela, y no es pereza: los dos documentos usan
// el mismo papel y la misma caja útil (`report/maqueta.js#ANCHO_UTIL`), así que
// dos medidas distintas darían dos planos de tamaños distintos en dos informes
// del mismo expediente.

/** Ancho del plano en el papel, en mm. */
export const ANCHO_PLANO_MM = 180
/** Alto del plano en el papel, en mm. */
export const ALTO_PLANO_MM = 130

// ── Lo que se le dice al usuario ─────────────────────────────────────────────

/** Mientras se compone. Se dice ANTES del primer `await`: el plano tarda. */
export const COMPONIENDO = 'Componiendo el informe de construcción…'

/** Ya hay uno en vuelo. Pulsar dos veces no compone dos documentos. */
export const YA_COMPONIENDO =
  'Ya se está componiendo un informe. Espera a que termine antes de volver a pulsar.'

/** No hay construcción. El `disabled` del botón es cortesía; esto es la garantía. */
export const SIN_EDIFICIO =
  'No hay ninguna construcción cargada, así que no hay informe que componer.'

/**
 * ⚠️ **El aviso que impide bajar un documento sin firmar sin saberlo.** Dice las
 * dos cosas que hacen falta: qué le falta al papel y cómo conseguir que no le
 * falte. Ver el apartado ⚠️ de la cabecera.
 */
export const SIN_FIRMA_RECORDADA =
  'El informe se ha compuesto SIN pie de firma: los cuatro campos salen como «No consta». Esta ' +
  'versión toma el pie de firma que el navegador recuerde, y todavía no hay ninguno guardado — ' +
  'se guarda desde el informe de parcela, marcando «Recordar mis datos».'

/** El plano no se ha podido componer. El informe sale igual, y lo dice. */
export const PLANO_NO_COMPUESTO =
  'No se ha podido componer el plano de situación del informe de construcción. El informe se ha ' +
  'compuesto igualmente y lo declara en su sección de plano: un plano caído degrada el ' +
  'documento, no lo cancela.'

/** Y su resumen para el renglón, que es corto por definición. */
export const AVISO_SIN_PLANO = 'El informe se ha compuesto SIN plano. Mira el panel de avisos.'

/** La maquetación ha reventado. Es un defecto del programa. */
export const PDF_NO_COMPUESTO =
  'El PDF del informe de construcción no se ha podido maquetar por un defecto de la aplicación. ' +
  'No se ha bajado nada: es preferible no entregar un documento a entregar uno a medias.'

/** Y la entrega. Un `<a download>` que no dispara no es lo mismo que un PDF roto. */
export const PDF_NO_ENTREGADO =
  'El PDF del informe de construcción se ha compuesto pero el navegador no lo ha descargado. ' +
  'Vuelve a pulsar; si sigue sin bajar, comprueba si el navegador está bloqueando las descargas.'

/**
 * El acuse de recibo, con **el nombre legal que ha tomado el documento**. Que el
 * nombre viaje en el acuse no es adorno: es el criterio de aceptación 4 hecho
 * visible —«Informe de construcción» o «Informe de contraste con la construcción
 * catastral» según haya habido contraste— y lo que permite al usuario saber, sin
 * abrir el PDF, cuál de los dos acaba de bajar.
 *
 * @param {string} nombreFichero
 * @param {string} titulo
 * @param {number} nPaginas
 * @returns {string}
 */
export const acuse = (nombreFichero, titulo, nPaginas) =>
  `Descargado «${nombreFichero}»: ${titulo}, ${nPaginas} ${nPaginas === 1 ? 'página' : 'páginas'}.`

// ── Contratos de las dependencias ────────────────────────────────────────────

const esStore = (v) => !!v && typeof v.get === 'function' && typeof v.subscribe === 'function'

/** Del cajón solo se usan tres cosas, y solo esas se exigen. */
const esCajon = (v) =>
  !!v && typeof v.alPreparar === 'function' && typeof v.estadoInforme === 'function'

/** El almacén del pie de firma: `storage/pie-firma.js`. `null` es legítimo. */
const esPieFirma = (v) => !!v && typeof v.recuperar === 'function'

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Cablea el informe de construcción.
 *
 * @param {Object} opciones
 * @param {object} opciones.cajon  El de `viewer/cajon-contraste-edificio.js`.
 * @param {object} opciones.estadoEdificio  El store del edificio (contrato H).
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos.
 * @param {() => object|null} opciones.contraste  El último contraste, **como
 *   función y no como valor**: cambia con cada edición, y capturarlo al cablear
 *   imprimiría las cifras del día del montaje. Se le pasa
 *   `cablearContrasteEdificio#ultimoContraste` SIN invocar, igual que F09 hace con
 *   `ultimoDiagnostico`. `null` ⇒ informe **solo declarativo**, que es un
 *   resultado legítimo y no una degradación (ficha §17).
 * @param {() => Array|null} [opciones.huellaOficial=() => null]  Las PIEZAS de la
 *   construcción registrada, para que el plano dibuje las DOS huellas y el
 *   encuadre abarque a las dos. **Como función, y por el mismo motivo que
 *   `contraste`**; aparte de él porque el objeto del contraste trae cifras y
 *   referencias, no contornos. Se le pasa `cablearContrasteEdificio#huellaOficial`.
 * @param {string} opciones.srs  SRS del expediente.
 * @param {{recuperar: Function}|null} [opciones.pieFirma=null]  El almacén de
 *   `storage/pie-firma.js`. `null` ⇒ los cuatro campos salen «No consta» y **se
 *   dice** ({@link SIN_FIRMA_RECORDADA}).
 * @param {() => Date} [opciones.ahora=() => new Date()]  El reloj. Se inyecta
 *   porque `report/` no lo consulta por contrato. ⚠️ Devuelve un `Date` y **no un
 *   timestamp**: `report/firma.js#componerIdDocumento` LANZA con un número, y es
 *   la misma firma que `app/cableado-informe.js`. Dos relojes con dos formas
 *   distintas en la misma capa se confunden a la primera.
 * @param {typeof componerPlano} [opciones.plano]  La composición del plano.
 * @param {typeof descargarBinario} [opciones.descargar]  La entrega.
 * @returns {{componer: Function, destruir: Function}}
 * @throws {TypeError}  Contrato del programador.
 */
export function cablearInformeEdificio({
  cajon,
  estadoEdificio,
  panel,
  contraste,
  huellaOficial = () => null,
  srs,
  pieFirma = null,
  ahora = () => new Date(),
  plano: componerElPlano = componerPlano,
  descargar = descargarBinario,
} = {}) {
  if (!esCajon(cajon)) {
    throw new TypeError(
      `cablearInformeEdificio: 'cajon' debe ser el de viewer/cajon-contraste-edificio.js (con ` +
        `alPreparar y estadoInforme); recibido ${typeof cajon}.`,
    )
  }
  if (!esStore(estadoEdificio)) {
    throw new TypeError(
      `cablearInformeEdificio: 'estadoEdificio' debe ser el store de crearEstadoVista (con get y ` +
        `subscribe); recibido ${typeof estadoEdificio}.`,
    )
  }
  if (typeof panel?.avisar !== 'function') {
    throw new TypeError(
      `cablearInformeEdificio: 'panel' debe ser el de app/avisos.js (con avisar); recibido ` +
        `${typeof panel}.`,
    )
  }
  if (typeof contraste !== 'function') {
    throw new TypeError(
      `cablearInformeEdificio: 'contraste' debe ser una FUNCIÓN que devuelva el último contraste ` +
        `(o null); recibido ${typeof contraste}. Se pasa como función y no como valor porque ` +
        `cambia con cada edición: un valor capturado al cablear imprimiría cifras caducadas.`,
    )
  }
  if (typeof srs !== 'string' || srs === '') {
    throw new TypeError(
      `cablearInformeEdificio: 'srs' debe ser el SRS del expediente en forma corta; recibido ` +
        `${typeof srs}.`,
    )
  }
  if (pieFirma !== null && !esPieFirma(pieFirma)) {
    throw new TypeError(
      `cablearInformeEdificio: 'pieFirma' debe ser el almacén de storage/pie-firma.js (con ` +
        `recuperar) o null; recibido ${typeof pieFirma}.`,
    )
  }
  for (const [nombre, valor] of [
    ['huellaOficial', huellaOficial],
    ['ahora', ahora],
    ['plano', componerElPlano],
    ['descargar', descargar],
  ]) {
    if (typeof valor !== 'function') {
      throw new TypeError(
        `cablearInformeEdificio: '${nombre}' debe ser una función; recibido ${typeof valor}.`,
      )
    }
  }

  let destruido = false
  /** Un informe en vuelo. Pulsar dos veces no compone dos documentos. */
  let componiendo = false

  function decir(texto) {
    if (!destruido) cajon.estadoInforme(texto)
  }

  /**
   * Lo que el navegador recuerde del pie de firma. Sin almacén, o con un fallo del
   * almacén, se devuelve `null`: una firma que no se recupera no puede tumbar la
   * composición de un informe, y el documento lo dirá con «No consta».
   *
   * @returns {Promise<object|null>}
   */
  async function firmaRecordada() {
    if (pieFirma === null) return null
    try {
      const r = await pieFirma.recuperar()
      return r?.firma ?? null
    } catch (causa) {
      console.error('cablearInformeEdificio: fallo al recuperar el pie de firma guardado', causa)
      return null
    }
  }

  /**
   * El plano, o `null` si no se ha podido componer. **Nunca lanza**: ver la
   * cabecera. El encuadre abarca las DOS huellas —la medida y la del Catastro—,
   * porque encuadrar solo por la nuestra dejaría fuera, en silencio, justo la
   * mitad del contraste que el plano existe para enseñar.
   *
   * ⛔ **LAS PIEZAS SE PASAN COMO PIEZAS A `encuadrar` Y APLANADAS A
   * `componerPlano`, y no es un capricho: los dos las quieren de forma distinta.**
   * La primera corrida de este cableado lo destapó, y el fallo era mudo por la vía
   * peor —el `catch` de abajo lo degradaba, así que **todo edificio de más de un
   * cuerpo habría salido SIEMPRE sin plano** y el informe lo habría declarado como
   * si fuera cosa de la red—:
   *
   *     TypeError: bbox: recintos[1] debe ser HUECO; recibido tipo='EXTERIOR'
   *
   * `encuadrar` impone el invariante de `model/parcela.js` (un EXTERIOR y el resto
   * HUECOS) sobre su `recintos`, y para lo demás tiene `otrosRecintos`, que es
   * justamente un array DE CONJUNTOS. `componerPlano` no lo impone: dibuja los
   * anillos con `fill('evenodd')`, así que aplanarlos ahí es correcto —igual que en
   * la capa de Leaflet, y por la misma razón—.
   *
   * Es la tercera cara de M3: aplanar piezas está BIEN para dibujar y MAL para todo
   * lo demás.
   *
   * @param {Array<Array<object>>} piezas  Las de la envolvente medida.
   * @param {Array<Array<object>>|null} piezasOficiales  Las de la huella catastral.
   * @returns {Promise<{plano: object|null, encuadre: object|null}>}
   */
  async function componerElPlanoOSinEl(piezas, piezasOficiales) {
    try {
      const encuadre = encuadrar({
        // La primera pieza manda; las demás y la huella oficial entran como
        // «otros conjuntos», que es exactamente para lo que existe ese parámetro.
        // El contorno oficial TIENE que caber: encuadrar solo por lo medido dejaría
        // fuera, en silencio, justo la mitad del contraste que el plano enseña.
        recintos: piezas[0] ?? [],
        otrosRecintos: [...piezas.slice(1), ...(piezasOficiales ?? [])],
        anchoMm: ANCHO_PLANO_MM,
        altoMm: ALTO_PLANO_MM,
      })
      const laminado = await componerElPlano({
        encuadre,
        recintos: piezas.flat(),
        recintosOficiales: piezasOficiales === null ? null : piezasOficiales.flat(),
        srs,
        alAvisar: panel.avisar,
      })
      // ⚠️ El `null` sin excepción es un caso REAL y medido (jsdom, `toDataURL`),
      // así que se comprueba el VALOR y no solo la ausencia de `throw`.
      return laminado === null || laminado === undefined
        ? { plano: null, encuadre: null }
        : { plano: laminado, encuadre }
    } catch (causa) {
      panel.avisar(PLANO_NO_COMPUESTO, { nivel: NIVEL.AVISO, causa })
      console.error('cablearInformeEdificio: fallo al componer el plano', causa)
      return { plano: null, encuadre: null }
    }
  }

  /**
   * Compone el informe y lo entrega. Es lo que se llama al pulsar el botón, y está
   * en la API pública para que el guion de humo y las pruebas puedan pedirlo sin
   * simular un clic.
   *
   * @returns {Promise<object|null>}  El `ResultadoDescarga` de `gml/descargar.js`,
   *   o `null` si no se llegó a intentar la entrega.
   */
  async function componer() {
    if (destruido) return null
    const edificio = estadoEdificio.get()
    if (!edificio || !Array.isArray(edificio.partes) || edificio.partes.length === 0) {
      decir(SIN_EDIFICIO)
      return null
    }
    if (componiendo) {
      decir(YA_COMPONIENDO)
      return null
    }

    componiendo = true
    // Antes del primer `await`: el plano tarda, y un botón que se queda pensando
    // sin decirlo es un error silencioso.
    decir(COMPONIENDO)
    try {
      // UN solo instante para la fecha del encabezado y para el identificador del
      // documento: leer el reloj dos veces podría dejarlos discrepando en el cambio
      // de segundo, y el identificador es lo que empareja el papel con su registro.
      const fecha = ahora()
      const refcat = typeof edificio.refcat === 'string' ? edificio.refcat : null
      const c = contraste()

      const encabezado = componerEncabezado({
        refcat,
        srs,
        fecha,
        idDocumento: componerIdDocumento(refcat, fecha),
      })

      const firma = await firmaRecordada()
      if (destruido) return null

      // ── 1 · El plano (la RED) ──────────────────────────────────────────────
      // Las PIEZAS enteras: quien decide cómo se aplanan —y para qué— es
      // {@link componerElPlanoOSinEl}, donde está escrito lo que costó averiguarlo.
      const piezas = envolventeDe(edificio.partes).recintos
      // ⛔ La huella oficial NO se saca del contraste: aquel objeto trae CIFRAS y
      // referencias, no contornos —es lo que lo mantiene ciego a la vista—, así que
      // buscarla ahí daría siempre `null` y el plano saldría sin la mitad que hay
      // que comparar, en silencio. La da quien la tiene: el cableado del contraste,
      // que es el único que sabe si vino con el modelo o de la consulta.
      const piezasOficiales = huellaOficial()
      const { plano, encuadre } = await componerElPlanoOSinEl(
        piezas,
        Array.isArray(piezasOficiales) ? piezasOficiales : null,
      )
      if (destruido) return null

      // ── 2 · La maqueta ─────────────────────────────────────────────────────
      let informe
      try {
        informe = informePdfEdificio({
          edificio,
          encabezado,
          contraste: c,
          plano,
          // `encuadre` solo si hay plano: `informePdfEdificio` exige la pareja.
          encuadre: plano === null ? null : encuadre,
          firma,
        })
      } catch (causa) {
        decir('El PDF no se ha podido componer. Mira el panel de avisos.')
        panel.avisar(PDF_NO_COMPUESTO, { nivel: NIVEL.ERROR, causa })
        console.error('cablearInformeEdificio: fallo al maquetar el PDF', causa)
        return null
      }

      // ── 3 · Lo que el informe ha tenido que declarar de sí mismo ───────────
      // Al panel, una por una: son cosas que le han pasado AL DOCUMENTO (una capa
      // que no se dibujó, un carácter sustituido) y hay que poder leerlas enteras.
      for (const incidencia of informe.incidencias) {
        panel.avisar(incidencia, { nivel: NIVEL.AVISO })
      }

      // ── 4 · La entrega ─────────────────────────────────────────────────────
      let entrega
      try {
        entrega = descargar(informe.bytes, {
          nombreFichero: informe.nombreFichero,
          mime: TIPO_MIME_PDF,
        })
      } catch (causa) {
        decir('El PDF no ha bajado. Mira el panel de avisos.')
        panel.avisar(PDF_NO_ENTREGADO, { nivel: NIVEL.ERROR, causa })
        console.error('cablearInformeEdificio: fallo al entregar el PDF', causa)
        return null
      }

      if (!entrega.descargado) {
        // `descargarBinario` trae un `mensaje` en castellano ya presentable.
        decir(entrega.mensaje)
        return entrega
      }

      // ⭐ El acuse lleva el NOMBRE LEGAL que ha tomado el documento (criterio 4).
      // Y las dos cosas que el usuario tiene que saber sin abrir el PDF se dicen
      // juntas: que bajó, y qué le falta si le falta algo.
      const faltas = []
      if (plano === null) faltas.push(AVISO_SIN_PLANO)
      if (firma === null) faltas.push(SIN_FIRMA_RECORDADA)
      decir([acuse(informe.nombreFichero, informe.titulo, informe.nPaginas), ...faltas].join(' '))
      if (firma === null) panel.avisar(SIN_FIRMA_RECORDADA, { nivel: NIVEL.AVISO })
      return entrega
    } finally {
      componiendo = false
    }
  }

  const baja = cajon.alPreparar(() => {
    componer().catch((causa) => {
      // El `componer` de arriba atrapa todo lo previsible; esto es para lo que ni
      // él previó. Una excepción lanzada dentro de un oyente del DOM **no sale por
      // `dispatchEvent`**, así que dejarla propagar sería un error silencioso de
      // manual: la pantalla se queda como estaba y el único rastro está en una
      // consola que nadie abre.
      decir('El informe no se ha podido componer. Mira el panel de avisos.')
      panel.avisar(PDF_NO_COMPUESTO, { nivel: NIVEL.ERROR, causa })
      console.error('cablearInformeEdificio: fallo inesperado al componer', causa)
    })
  })

  return {
    componer,

    /**
     * Retira el oyente del cajón y deja el módulo inerte. IDEMPOTENTE.
     *
     * No destruye el cajón —es del visor— ni el almacén —es de quien lo creó—.
     */
    destruir() {
      if (destruido) return
      destruido = true
      baja()
    },
  }
}

export default cablearInformeEdificio

/**
 * El nombre legal que TOMARÍA el informe con el contraste que hay ahora. Se
 * reexporta desde aquí —además de vivir en `report/pdf-edificio.js`— para que la
 * cáscara y el guion de humo puedan afirmar el criterio 4 sin importar la capa de
 * informes, que no es suya.
 *
 * @see report/pdf-edificio.js#nombreDelInforme
 */
export { nombreDelInforme }
