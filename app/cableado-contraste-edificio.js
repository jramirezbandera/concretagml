// app/cableado-contraste-edificio.js — F14 · La costura del contraste de EDIFICIO.
//
// ── QUÉ UNE, Y POR QUÉ HACÍA FALTA UN MÓDULO ───────────────────────────────
// `diagnostico/edificio.js` sabe contrastar y no sabe qué es un store.
// `viewer/cajon-contraste-edificio.js` sabe pintar y no sabe qué es la red.
// `services/catastro-edificio.js` sabe preguntar y no sabe qué hay en pantalla.
// Este fichero es lo que los une. Mientras no existiera, el motor del contraste
// era código muerto: la tercera vez que este proyecto escribe un canal sin
// llamante sería la buena.
//
// Su anatomía es la de `app/cableado-diagnostico.js` a propósito —recalcular al
// cambiar el store, un `ultimoContraste` que el informe recoge, `destruir()`
// idempotente—: quien llegue después reconoce el patrón sin leerlo entero.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ LA REFERENCIA SE **LEE**, NUNCA SE ESCRIBE EN EL MODELO
// ═════════════════════════════════════════════════════════════════════════════
// `model/edificio.js#construccionOficial` significa «*este edificio vino del
// Catastro*» y está CONGELADO en profundidad por la regla de oro 2. Este módulo
// **no le escribe** el término de comparación, y no es escrúpulo: confundir
// procedencia con referencia es exactamente lo que esa barrera existe para
// impedir. Al contrario que `app/cableado-edificio.js`, cuyo oficio SÍ es cargar,
// aquí la consulta al `wfsBU` **no reemplaza nada**: se guarda aparte, en una
// variable de este módulo, y se usa para comparar.
//
// El término de comparación es, por este orden:
//
//   1. `edificio.construccionOficial` — si el edificio VINO del Catastro, la
//      huella registrada ya está en casa y pedirla otra vez sería una petición
//      para traerse lo que ya se tiene. Es además el caso donde el contraste
//      cobra su valor real: al editar las partes (F12), nuestra envolvente cambia
//      y **ésta no**, así que la diferencia es justo lo que se ha tocado.
//   2. Lo que traiga {@link consultar} — el caso normal de una medición propia
//      (un DXF, un pegado), donde no hay nada oficial en el modelo.
//
// ── ⭐ Y SE COMPARA ENVOLVENTE CONTRA ENVOLVENTE, NO ENVOLVENTE CONTRA PARTES ─
// `construccionOficial` son las PARTES oficiales, no la huella del edificio. Las
// partes **se solapan entre sí** (un `BuildingPart` de dos plantas sobre otro de
// una comparten planta baja), así que cruzarlas una a una contra nuestra
// envolvente contaría dos veces el mismo metro cuadrado y el solape saldría
// inflado sin que nada avisara. Se deriva su envolvente con el MISMO
// `edificio/envolvente.js` que deriva la nuestra, y entonces la comparación es de
// iguales.
//
// ⭐ Esto no es una teoría: es la **diana de oro** que F13 midió. La envolvente
// derivada de las 13 partes reales de `9398516VK3799G` y el `Building` que el
// Catastro publica para ella coinciden a **1,7·10⁻¹³ m²** — trece cifras
// significativas—. Si esta función estuviera mal, ese caso saldría con una
// diferencia enorme en vez de con cero.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ LA HUELLA QUE LLEGA DEL SERVICIO: DE `anillos` A PIEZAS
// ═════════════════════════════════════════════════════════════════════════════
// `gml/parse-bu.js` devuelve del `Building` dos listas SUELTAS: `anillos` (un
// exterior por `gml:PolygonPatch`) y `huecos` (todos los `gml:interior` juntos).
// **Aparear cada hueco con su patch está declarado fuera de alcance** en aquel
// módulo, con estas palabras. Así que aquí hay tres casos y ninguno se resuelve
// adivinando (ver {@link huellaOficialDe}):
//
//   · **Un solo anillo** — todos los huecos son suyos. Sin ambigüedad.
//   · **Varios anillos y ningún hueco** — una pieza por anillo. Sin ambigüedad,
//     y es el caso REAL medido: la parcela de referencia da 2 anillos y 0 huecos.
//   · **Varios anillos y algún hueco** — ambiguo. **No se contrasta**, y se dice
//     por qué. Meter los huecos en la primera pieza daría una superficie oficial
//     equivocada, y en silencio: exactamente lo que la regla de oro 1 prohíbe.
//
// ═════════════════════════════════════════════════════════════════════════════
// LAS VECINAS SE PIDEN UNA VEZ, Y `null` NO ES `[]`
// ═════════════════════════════════════════════════════════════════════════════
// Misma doctrina que F07, y el mismo cliente: `null` = **no se ha consultado**;
// `[]` = se consultó y no hay ninguna. Son afirmaciones distintas y la segunda
// tranquiliza, así que el cajón las escribe distinto. Una apertura, una petición
// (override O8), con guarda para no encabalgar dos.
//
// ═════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE MÓDULO NO HACE
// ═════════════════════════════════════════════════════════════════════════════
// No compone el PDF (es de `app/cableado-informe-edificio.js`), no navega (es de
// `app/contraste.js`) y no monta nada del DOM (el cajón se lo dan hecho).

import { NIVEL } from '../validation/_comun.js'
import {
  REGISTRO,
  contrastarEdificio,
} from '../diagnostico/edificio.js'
import { envolventeDe } from '../edificio/envolvente.js'

// ── Lo que se le dice al usuario ─────────────────────────────────────────────

/**
 * No hay a quién preguntarle. **No es un fallo**: es un montaje sin servicio de
 * edificios (una pantalla de pruebas, la app sin red declarada). Se dice, porque
 * un botón que no hace nada es peor que un botón apagado con su motivo.
 */
export const SIN_CLIENTE =
  'No se puede consultar la construcción registrada: esta pantalla se ha montado sin el servicio ' +
  'de edificios del Catastro. El contraste es opcional y el GML se genera igual sin él.'

/** Nadie ha declarado la referencia catastral, así que no hay qué pedir. */
export const SIN_REFCAT =
  'Para consultar la construcción registrada hace falta la referencia catastral de la parcela, y ' +
  'este edificio no la lleva. Escríbela en «Origen del edificio» y vuelve a pulsar.'

/** La huella ya vino con el edificio: no hay nada que pedir. */
export const YA_ES_OFICIAL =
  'La construcción registrada ya vino con el edificio: se trajo del Catastro al cargarlo, y es la ' +
  'que se está contrastando. No hace falta volver a pedirla.'

/**
 * El caso ambiguo del apareo de huecos. Dice **exactamente** qué se ha encontrado
 * y por qué no se sigue, en vez de dar una cifra que estaría mal.
 *
 * @param {number} nAnillos
 * @param {number} nHuecos
 * @returns {string}
 */
export const huecosAmbiguos = (nAnillos, nHuecos) =>
  `La huella que publica el Catastro tiene ${nAnillos} contornos y ${nHuecos} ` +
  `${nHuecos === 1 ? 'hueco' : 'huecos'}, y el GML no dice a cuál pertenece cada hueco. No se ` +
  `contrasta: repartirlos a ojo daría una superficie oficial equivocada sin que nada lo dijera.`

/** La respuesta no traía `Building`, o sea que no hay huella de conjunto. */
export const SIN_BUILDING =
  'El Catastro ha respondido, pero su construcción no trae la huella de conjunto (el «Building») ' +
  'con la que se contrasta. Hay partes registradas, pero no el contorno que las envuelve.'

/** Lo que se dice cuando la consulta acaba bien y hay con qué contrastar. */
export const CONSULTA_HECHA = 'Construcción registrada traída del Catastro.'

/** Y el desenlace de una consulta que no ha traído nada. Nunca «no hay». */
export const COLA_DETALLE = 'Mira el panel de avisos para el detalle.'

/** Un fallo INESPERADO del cálculo. Es un defecto del programa, no del dato. */
export const FALLO_INESPERADO =
  'El contraste con la construcción catastral ha fallado por un defecto de la aplicación. Las ' +
  'cifras que hubiera en pantalla se han retirado: es preferible no enseñar nada a enseñar algo ' +
  'que no se puede sostener.'

// ── Traducciones puras ───────────────────────────────────────────────────────

/** Un recinto EXTERIOR del modelo a partir de un anillo suelto. */
const exterior = (vertices) => ({ vertices, tipo: 'EXTERIOR' })

/** Un recinto HUECO. */
const hueco = (vertices) => ({ vertices, tipo: 'HUECO' })

/** ¿Este anillo encierra algo? Menos de tres vértices no es un anillo. */
const esAnillo = (a) => Array.isArray(a) && a.length >= 3

/**
 * Traduce el `Building` de `gml/parse-bu.js` a las PIEZAS que
 * `diagnostico/edificio.js` espera (`Array<Recinto[]>`).
 *
 * **FUNCIÓN PURA, y exportada para que tenga prueba propia**: es la juntura entre
 * dos formas de decir lo mismo, y las junturas son donde se pierden los huecos.
 * Los tres casos —y por qué el tercero se niega en vez de adivinar— están en la
 * cabecera del módulo.
 *
 * @param {{anillos?: Array, huecos?: Array}|null} building  `resultado.datos.edificio`.
 * @returns {{piezas: Array<Array<object>>|null, motivo: string|null}}  `piezas`
 *   `null` con su motivo cuando no se puede traducir sin inventarse nada.
 */
export function huellaOficialDe(building) {
  if (!building || typeof building !== 'object') {
    return { piezas: null, motivo: SIN_BUILDING }
  }
  const anillos = (Array.isArray(building.anillos) ? building.anillos : []).filter(esAnillo)
  const huecos = (Array.isArray(building.huecos) ? building.huecos : []).filter(esAnillo)

  if (anillos.length === 0) return { piezas: null, motivo: SIN_BUILDING }
  // Un solo contorno: todos los huecos son suyos, sin ambigüedad posible.
  if (anillos.length === 1) {
    return { piezas: [[exterior(anillos[0]), ...huecos.map(hueco)]], motivo: null }
  }
  // Varios contornos y ningún hueco: una pieza por contorno. Es el caso REAL
  // medido en la parcela de referencia (2 anillos, 0 huecos).
  if (huecos.length === 0) {
    return { piezas: anillos.map((a) => [exterior(a)]), motivo: null }
  }
  return { piezas: null, motivo: huecosAmbiguos(anillos.length, huecos.length) }
}

/**
 * Las PIEZAS de la construcción oficial que el modelo ya lleva, derivadas con el
 * MISMO `envolventeDe` que la nuestra. Ver el apartado ⭐ de la cabecera: cruzar
 * partes contra envolvente contaría dos veces los metros compartidos.
 *
 * @param {object|null} edificio  El POJO de `model/edificio.js`.
 * @returns {Array<Array<object>>|null}  `null` si el modelo no trae ninguna.
 */
export function huellaDelModelo(edificio) {
  const oficial = edificio?.construccionOficial
  if (!Array.isArray(oficial) || oficial.length === 0) return null
  const recintos = envolventeDe(oficial).recintos
  return recintos.length === 0 ? null : recintos
}

/** Traduce las parcelas del Catastro a las vecinas que el contraste espera. */
function aVecinas(parcelas) {
  if (!Array.isArray(parcelas)) return []
  return parcelas.map((p) => ({
    refcat: typeof p.refcat === 'string' && p.refcat !== '' ? p.refcat : null,
    recintos: Array.isArray(p.recintos) ? p.recintos : [],
  }))
}

/** Los recintos de la parcela con la que comparar: la del store o la del modelo. */
function parcelaDe(edificio, parcelaEnPantalla) {
  const delModelo = edificio?.parcelaContexto
  if (Array.isArray(delModelo) && delModelo.length > 0) return delModelo
  const recintos = parcelaEnPantalla?.recintos
  return Array.isArray(recintos) && recintos.length > 0 ? recintos : null
}

// ── Contratos de las dependencias ────────────────────────────────────────────

/** ¿Sirve como store? DUCK TYPING, igual que en el resto de los cableados. */
const esStore = (v) => !!v && typeof v.get === 'function' && typeof v.subscribe === 'function'

/** ¿Es el cajón de `viewer/cajon-contraste-edificio.js`? Se comprueba lo que se USA. */
const esCajon = (v) =>
  !!v &&
  typeof v.pintar === 'function' &&
  typeof v.abrir === 'function' &&
  typeof v.cerrar === 'function' &&
  typeof v.abierto === 'function' &&
  typeof v.estado === 'function' &&
  typeof v.consultando === 'function' &&
  typeof v.alConsultar === 'function' &&
  typeof v.alCerrar === 'function'

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Cablea el contraste de la construcción.
 *
 * @param {Object} opciones
 * @param {object} opciones.cajon  El de `viewer/cajon-contraste-edificio.js`.
 * @param {object} opciones.estadoEdificio  El store del edificio (contrato H).
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos.
 * @param {object|null} [opciones.estadoParcela=null]  El store de PARCELA, **solo
 *   de lectura**: da el contexto con el que medir «dentro de la parcela» cuando el
 *   edificio no lo lleva. `null` es un montaje legítimo y se dice en pantalla.
 * @param {{edificioPorRefcat: Function}|null} [opciones.cliente=null]  El de
 *   `services/catastro-edificio.js`. `null` ⇒ no se consulta, y **se dice**
 *   ({@link SIN_CLIENTE}). ⛔ No se destruye aquí: es de quien lo creó.
 * @param {{colindantes: Function}|null} [opciones.catastro=null]  El cliente de
 *   PARCELAS, solo para las vecinas. `null` ⇒ la invasión sale «no se ha
 *   consultado», que es la verdad y no un hueco.
 * @param {string} opciones.srs  SRS del expediente.
 * @param {{pintar: Function}|null} [opciones.contrasteMapa=null]  La capa de
 *   `viewer/contraste.js`, que sombrea la diferencia sobre el dibujo. Se reutiliza
 *   TAL CUAL: recibe recintos y le da igual de qué son.
 * @returns {{abrir: Function, cerrar: Function, recalcular: Function,
 *   consultar: Function, ultimoContraste: Function, alContraste: Function,
 *   destruir: Function}}
 * @throws {TypeError}  Contrato del programador.
 */
export function cablearContrasteEdificio({
  cajon,
  estadoEdificio,
  panel,
  estadoParcela = null,
  cliente = null,
  catastro = null,
  srs,
  contrasteMapa = null,
} = {}) {
  if (!esCajon(cajon)) {
    throw new TypeError(
      `cablearContrasteEdificio: 'cajon' debe ser el de viewer/cajon-contraste-edificio.js (con ` +
        `pintar, abrir, cerrar, abierto, estado, consultando, alConsultar y alCerrar); recibido ` +
        `${typeof cajon}.`,
    )
  }
  if (!esStore(estadoEdificio)) {
    throw new TypeError(
      `cablearContrasteEdificio: 'estadoEdificio' debe ser el store de crearEstadoVista (con get ` +
        `y subscribe); recibido ${typeof estadoEdificio}.`,
    )
  }
  if (typeof panel?.avisar !== 'function') {
    throw new TypeError(
      `cablearContrasteEdificio: 'panel' debe ser el de app/avisos.js (con avisar); recibido ` +
        `${typeof panel}. Sin él los fallos del cálculo no tendrían por dónde salir.`,
    )
  }
  if (estadoParcela !== null && !esStore(estadoParcela)) {
    throw new TypeError(
      `cablearContrasteEdificio: 'estadoParcela' debe ser un store (con get y subscribe) o null; ` +
        `recibido ${typeof estadoParcela}.`,
    )
  }
  if (typeof srs !== 'string' || srs === '') {
    throw new TypeError(
      `cablearContrasteEdificio: 'srs' debe ser el SRS del expediente en forma corta ` +
        `(p. ej. 'EPSG:25830'); recibido ${typeof srs}.`,
    )
  }

  let destruido = false

  /**
   * La huella que ha traído la CONSULTA, y su estado. **Nunca se escribe en el
   * modelo** (ver la cabecera). Nace sin consultar, que es uno de los cuatro
   * sabores de «no hay» y no la ausencia de información.
   *
   * @type {{piezas: Array|null, clave: string}}
   */
  let consultado = { piezas: null, clave: REGISTRO.NO_CONSULTADO }

  /** Las vecinas. `null` = NO SE HA CONSULTADO; `[]` = se consultó y no hay. */
  let vecinas = null

  /** Una consulta de vecinas en vuelo, para no encabalgar dos aperturas. */
  let pidiendoVecinas = false

  /**
   * El ÚLTIMO contraste que se pintó, que es el que el informe recoge. Se GUARDA
   * en vez de recalcularse al pulsar, y por lo mismo que en F09: recalcular podría
   * dar cifras distintas de las que el usuario tiene delante, y un informe que no
   * dice lo mismo que la pantalla de la que salió es peor que no tener informe.
   *
   * @type {object|null}
   */
  let ultimo = null

  /** @type {Set<(c: object|null) => void>} */
  const oyentes = new Set()

  /** Qué edificio había, para saber que ha entrado OTRO (y no que se ha editado). */
  let identidad = claveDe(estadoEdificio.get())

  /**
   * La identidad del expediente de construcción. Cambiar de edificio invalida la
   * consulta y las vecinas; editarlo, no. Se usa `refcat` y no la referencia del
   * objeto porque cada mutación de F12 devuelve un POJO nuevo.
   */
  function claveDe(edificio) {
    if (!edificio) return null
    return `${edificio.idLocal ?? ''}·${edificio.refcat ?? ''}`
  }

  function notificar() {
    for (const fn of [...oyentes]) {
      try {
        fn(ultimo)
      } catch (causa) {
        console.error('cablearContrasteEdificio: un oyente de alContraste ha reventado', causa)
      }
    }
  }

  /**
   * Tira el último contraste y deja el cajón coherente con esa verdad: en blanco y
   * con el botón del informe apagado (el cajón escribe su propio motivo). Es el
   * ÚNICO camino por el que `ultimo` vuelve a `null`, para que el invariante que
   * sostiene la guarda del botón no dependa de acordarse.
   */
  function olvidar() {
    ultimo = null
    cajon.pintar(null)
    if (contrasteMapa) contrasteMapa.pintar(null)
    notificar()
  }

  /**
   * El término de comparación de AHORA MISMO, con su estado. Ver el orden y su
   * porqué en la cabecera.
   *
   * @param {object|null} edificio
   * @returns {{piezas: Array|null, clave: string}}
   */
  function referencia(edificio) {
    const delModelo = huellaDelModelo(edificio)
    if (delModelo !== null) return { piezas: delModelo, clave: REGISTRO.CONSULTADO }
    return consultado
  }

  /**
   * Recalcula y repinta las DOS vistas. No hace nada con el cajón cerrado: medir
   * para no enseñarlo cuesta lo mismo y no lo mira nadie.
   *
   * Un fallo aquí es un defecto de programación —los datos malos del usuario los
   * traduce `contrastarEdificio` a `omisiones` y a `saltados`, no a excepciones—,
   * así que se cuenta como tal y **no se deja subir**: este camino se alcanza desde
   * un suscriptor del store, y reventar ahí tumbaría a los demás suscriptores, que
   * no tienen la culpa.
   */
  function recalcular() {
    if (destruido || !cajon.abierto()) return
    const edificio = estadoEdificio.get()
    if (!edificio || !Array.isArray(edificio.partes)) {
      olvidar()
      cajon.estado('No hay construcción que contrastar.')
      return
    }

    try {
      const envolvente = envolventeDe(edificio.partes).recintos
      const { piezas, clave } = referencia(edificio)
      const c = contrastarEdificio({
        envolvente,
        huellaOficial: piezas,
        registro: clave,
        parcelaContexto: parcelaDe(edificio, estadoParcela?.get() ?? null),
        vecinas,
      })
      ultimo = c
      cajon.pintar(c)
      // ⚠️ Se APLANAN las piezas para PINTAR, y solo para eso. La capa dibuja UN
      // polígono con todos los anillos y `fillRule:'evenodd'`, que es justo la
      // diferencia simétrica; aplanar ahí es correcto. **Aplanarlas para CALCULAR
      // no lo es**, y está medido: `coordsRegion` toma el segundo cuerpo por hueco
      // y el solape sale 5,20 m² en vez de 322,13 —un error mudo del 98,4 %—. Por
      // eso `contrastarEdificio` recibe las piezas enteras, unas líneas más arriba.
      if (contrasteMapa) {
        contrasteMapa.pintar(c, {
          recintos: envolvente.flat(),
          geometriaOficial: piezas === null ? null : piezas.flat(),
        })
      }
      notificar()
    } catch (causa) {
      olvidar()
      cajon.estado(`El contraste ha fallado. ${COLA_DETALLE}`)
      panel.avisar(FALLO_INESPERADO, { nivel: NIVEL.ERROR, causa })
      console.error('cablearContrasteEdificio: fallo al contrastar', causa)
    }
  }

  /**
   * UNA petición de vecinas, y solo si no las hay. El resto de casos —ya
   * consultadas, sin cliente, otra en vuelo— no piden nada: override O8.
   */
  async function pedirVecinas() {
    if (destruido || vecinas !== null || pidiendoVecinas) return
    if (catastro === null || typeof catastro.colindantes !== 'function') return
    pidiendoVecinas = true
    try {
      const resultado = await catastro.colindantes()
      if (destruido) return
      if (resultado?.ok && resultado.datos) {
        vecinas = aVecinas(resultado.datos.colindantes)
        recalcular()
      }
      // Un fallo de la consulta NO se convierte en `[]`: dejar `vecinas` en `null`
      // es lo que hace que el cajón siga diciendo «no se ha consultado» en vez de
      // «no hay invasión», que es la afirmación tranquilizadora y falsa.
    } catch (causa) {
      console.error('cablearContrasteEdificio: la consulta de colindantes ha fallado', causa)
    } finally {
      pidiendoVecinas = false
    }
  }

  /**
   * Pide la construcción registrada al `wfsBU`. **No reemplaza el modelo**: guarda
   * la huella aparte y recalcula. Ver la cabecera.
   *
   * @returns {Promise<{clave: string, motivo: string|null}>}  El estado en que ha
   *   quedado el registro. Se devuelve —en vez de no devolver nada— para que el
   *   guion de humo y las pruebas puedan afirmarlo sin leer el DOM.
   */
  async function consultar() {
    if (destruido) return { clave: consultado.clave, motivo: null }

    const edificio = estadoEdificio.get()
    // Ya la tenemos en casa: pedirla otra vez sería una petición para traerse lo
    // que ya está. Se dice, en vez de dejar el botón sin efecto aparente.
    if (huellaDelModelo(edificio) !== null) {
      cajon.estado(YA_ES_OFICIAL)
      return { clave: REGISTRO.CONSULTADO, motivo: YA_ES_OFICIAL }
    }
    if (cliente === null) {
      cajon.estado(SIN_CLIENTE)
      panel.avisar(SIN_CLIENTE, { nivel: NIVEL.AVISO })
      return { clave: consultado.clave, motivo: SIN_CLIENTE }
    }
    const refcat = typeof edificio?.refcat === 'string' ? edificio.refcat.trim() : ''
    if (refcat === '') {
      cajon.estado(SIN_REFCAT)
      return { clave: consultado.clave, motivo: SIN_REFCAT }
    }

    cajon.consultando(true)
    try {
      const resultado = await cliente.edificioPorRefcat(refcat, { srs })
      if (destruido) return { clave: consultado.clave, motivo: null }

      if (!resultado?.ok) {
        // ⛔ Un fallo de la consulta NO es «no consta»: son los dos sabores que
        // esta fase existe para separar. `NO_SE_HA_PODIDO` lo dice con todas las
        // letras en el renglón del registro.
        consultado = { piezas: null, clave: REGISTRO.NO_SE_HA_PODIDO }
        panel.avisar(
          resultado?.mensaje ??
            'No se ha podido consultar la construcción registrada en el Catastro.',
          { nivel: NIVEL.AVISO },
        )
        cajon.estado(`No se ha podido consultar. ${COLA_DETALLE}`)
        recalcular()
        return { clave: consultado.clave, motivo: resultado?.mensaje ?? null }
      }

      const datos = resultado.datos
      // ⭐ El caso que da nombre a la «pantalla honesta»: `ok:true` y la parcela no
      // tiene nada construido. Es un RESULTADO, no un error, y por eso viaja como
      // un estado del contraste y no como un fallo.
      if (datos.sinConstrucciones) {
        consultado = { piezas: null, clave: REGISTRO.SIN_CONSTRUCCIONES }
        cajon.estado('')
        recalcular()
        return { clave: consultado.clave, motivo: null }
      }
      // ⛔ El SRS se comprueba, y no se supone: mezclar dos sistemas de referencia
      // pondría la huella oficial a kilómetros de la nuestra y el contraste daría
      // cifras enormes sin dar ningún error. Mismo criterio, y mismo texto, que
      // `app/cableado-edificio.js#cargar`.
      if (datos.srs !== null && datos.srs !== srs) {
        const estorbo =
          `El Catastro ha devuelto la construcción en ${datos.srs} y este expediente trabaja en ` +
          `${srs}. No se contrasta: mezclar dos sistemas de referencia daría cifras enormes sin ` +
          `dar ningún error.`
        consultado = { piezas: null, clave: REGISTRO.NO_SE_HA_PODIDO }
        panel.avisar(estorbo, { nivel: NIVEL.AVISO })
        cajon.estado(`No se ha podido contrastar. ${COLA_DETALLE}`)
        recalcular()
        return { clave: consultado.clave, motivo: estorbo }
      }

      const { piezas, motivo } = huellaOficialDe(datos.edificio)
      if (piezas === null) {
        // Hay construcción registrada pero no se puede usar como término de
        // comparación. **No es `SIN_CONSTRUCCIONES`**: decir «no consta ninguna»
        // aquí sería mentir sobre el Catastro.
        consultado = { piezas: null, clave: REGISTRO.NO_SE_HA_PODIDO }
        panel.avisar(motivo, { nivel: NIVEL.AVISO })
        cajon.estado(`No se ha podido contrastar. ${COLA_DETALLE}`)
        recalcular()
        return { clave: consultado.clave, motivo }
      }

      consultado = { piezas, clave: REGISTRO.CONSULTADO }
      cajon.estado(CONSULTA_HECHA)
      recalcular()
      return { clave: consultado.clave, motivo: null }
    } catch (causa) {
      consultado = { piezas: null, clave: REGISTRO.NO_SE_HA_PODIDO }
      panel.avisar('La consulta de la construcción registrada ha fallado.', {
        nivel: NIVEL.ERROR,
        causa,
      })
      cajon.estado(`No se ha podido consultar. ${COLA_DETALLE}`)
      recalcular()
      return { clave: consultado.clave, motivo: null }
    } finally {
      // `consultando(false)` solo borra su propio aviso, así que el desenlace que
      // se acaba de escribir sobrevive. Ver el JSDoc de la vista.
      if (!destruido) cajon.consultando(false)
    }
  }

  /**
   * Abre el cajón, pinta con lo que hay y **después** pide las vecinas si faltan.
   * Ese orden importa: pintar primero enseña las cifras que ya se pueden dar, y la
   * invasión llega cuando llegue diciendo mientras tanto que no se ha consultado.
   */
  async function abrir(evento = null) {
    if (destruido) return
    cajon.abrir(evento)
    recalcular()
    await pedirVecinas()
  }

  function cerrar() {
    if (!destruido) cajon.cerrar()
  }

  // ── Suscripciones ──────────────────────────────────────────────────────────

  const desuscribir = estadoEdificio.subscribe(() => {
    if (destruido) return
    const nueva = claveDe(estadoEdificio.get())
    if (nueva !== identidad) {
      // Otro edificio: otra parcela, otras vecinas, otra construcción registrada.
      // No conservar nada es lo correcto — enseñar la huella oficial de la parcela
      // anterior junto a la envolvente de ésta sería el peor contraste posible.
      identidad = nueva
      consultado = { piezas: null, clave: REGISTRO.NO_CONSULTADO }
      vecinas = null
    }
    recalcular()
  })

  const bajaConsultar = cajon.alConsultar(() => {
    consultar().catch((causa) => {
      console.error('cablearContrasteEdificio: la consulta ha reventado', causa)
    })
  })
  // Al cerrar el cajón se limpia el mapa: las manchas del contraste sin las cifras
  // que las explican son un dibujo sin pie.
  const bajaCerrar = cajon.alCerrar(() => {
    if (contrasteMapa) contrasteMapa.pintar(null)
  })

  return {
    abrir,
    cerrar,
    recalcular,
    consultar,

    /**
     * El ÚLTIMO contraste que se PINTÓ, o `null`. Es lo que el informe recoge, y su
     * invariante es el mismo que el de F09: **`null` exactamente cuando el cajón ha
     * recibido `pintar(null)`**, que es lo que apaga el botón del informe.
     *
     * @returns {object|null}
     */
    ultimoContraste: () => ultimo,

    /**
     * Las PIEZAS de la construcción registrada que se están usando como término de
     * comparación, o `null` si no hay ninguna.
     *
     * ⭐ **Existe porque el objeto del contraste NO las lleva**, y eso es a
     * propósito: `contrastarEdificio` devuelve cifras y referencias, nunca
     * contornos, que es lo que lo mantiene ciego a la vista. Quien necesita los
     * contornos es el PLANO del informe —tiene que dibujar las dos huellas, y el
     * encuadre tiene que abarcarlas a las dos—, y buscarlas dentro del contraste
     * daría `null` siempre: el plano saldría sin la mitad que hay que comparar y
     * sin que nada lo dijera.
     *
     * Es una lectura, no una puerta: devuelve lo que hay ahora mismo, sea del
     * modelo o de la consulta, con el mismo orden de preferencia que usa el
     * cálculo.
     *
     * @returns {Array<Array<object>>|null}
     */
    huellaOficial: () => referencia(estadoEdificio.get()).piezas,

    /**
     * Se suscribe a los cambios del último contraste. Devuelve la BAJA. Es lo que
     * mantiene al rail al día sin apaños con temporizador — la lección que T9 dejó
     * escrita en `cablearDiagnostico#notificarDiagnostico`.
     *
     * @param {(c: object|null) => void} fn
     * @returns {() => void}
     */
    alContraste(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alContraste: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      oyentes.add(fn)
      return () => oyentes.delete(fn)
    },

    /**
     * Deja el cableado inerte y limpia el mapa. IDEMPOTENTE.
     *
     * No destruye el cajón —es del visor— ni los clientes —son de quien los creó—:
     * este módulo desmonta lo que ha montado él, ni más ni menos.
     */
    destruir() {
      if (destruido) return
      destruido = true
      desuscribir()
      bajaConsultar()
      bajaCerrar()
      oyentes.clear()
      if (contrasteMapa) contrasteMapa.pintar(null)
    },
  }
}

export default cablearContrasteEdificio
