// app/cableado-edificio-gml.js — F13 · «Generar GML» en la rama EDIFICIO.
//
// El último metro de F13 y lo único de toda la fase que el usuario llega a tocar:
// una construcción cargada → validación de sus partes → el fichero del **ICUC** en
// la carpeta de descargas. Sin esto, `validation/edificio.js` y
// `gml/serialize-bu.js` serían código que solo existe en los tests, que es
// literalmente lo que le pasó a `parsers/dxf.js` durante DIEZ fases y a las cuatro
// primeras de F12 hasta que alguien miró si el peldaño estaba encendido.
//
// ═════════════════════════════════════════════════════════════════════════════
// HERMANO DE `cablearGeneracionGml`, NO UN PARÁMETRO SUYO
// ═════════════════════════════════════════════════════════════════════════════
// Comparten el BOTÓN y no comparten nada más: validan cosas distintas
// (`validarParcela` frente a `validarEdificio`, que ni siquiera devuelven la misma
// forma), serializan dialectos distintos, nombran el fichero distinto y escuchan
// stores distintos. Meterlo todo en una función con banderas habría dejado el
// fichero más caliente de la aplicación —`app/main.js` pasa de 4.000 líneas—
// decidiendo por rama en seis sitios.
//
// ⚠️ **Lo que sí es común es EL BOTÓN, y por eso hay `mando()`.** Los dos
// cableados están vivos a la vez y suscritos a sus dos stores; sin una condición
// escrita en un solo sitio, el de parcela le escribiría el renglón cada vez que
// cambiara la parcela aunque el usuario estuviera mirando un edificio. La
// condición vive en `app/main.js` —que es el único que conoce los dos ejes— y aquí
// llega como función. Es el mismo reparto que F12 hizo con las dos ediciones sobre
// el mismo mapa.
//
// ═════════════════════════════════════════════════════════════════════════════
// LO QUE SE ENTREGA, Y LO QUE NO
// ═════════════════════════════════════════════════════════════════════════════
// El fichero lleva `Building` (la envolvente derivada de las partes SOBRE RASANTE)
// y un `OtherConstruction` por cada parte «Otra». **No lleva `BuildingPart`**: la
// ayuda oficial dice que el ICUC solo procesa esos dos. Ver la cabecera de
// `gml/serialize-bu.js`, donde está la decisión con su fuente.
//
// La envolvente NO se guarda en el modelo: se DERIVA aquí, en el momento de
// generar, con `edificio/envolvente.js`. Es lo que `model/edificio.js` lleva
// diciendo desde F00 y lo que hace que no pueda quedarse rancia.

import { NIVEL } from '../viewer/_comun.js'
import { SEVERIDAD } from '../gml/_comun.js'
import { serializarEdificioBu } from '../gml/serialize-bu.js'
import { TIPO_MIME_GML, descargarTexto, nombreFicheroGmlEdificio } from '../gml/descargar.js'
import { envolventeDe } from '../edificio/envolvente.js'
import { validarEdificio } from '../validation/edificio.js'
import { TIPO_PARTE } from '../model/edificio.js'

// ── Contrato con `index.html` ────────────────────────────────────────────────
// Los MISMOS nodos que la rama de parcela, a propósito: el pie no se intercambia
// (lo dice `app/rama.js`) y el usuario espera el botón donde siempre está.

/** El CTA del pie. */
export const SELECTOR_BOTON = '[data-accion="generar-gml"]'
/** Su renglón `role="status"`. */
export const SELECTOR_ESTADO = '[data-estado="generar-gml"]'

// ── Lo que se le dice al usuario ─────────────────────────────────────────────

/** Cuántos motivos caben en el renglón antes de resumir. Igual que en parcela. */
const MOTIVOS_EN_RENGLON = 2

/** Modificador del renglón para el desenlace que no trae el dato. */
const CLASE_ESTADO_ERROR = 'gml-accion-estado--error'

/**
 * Por qué «Generar GML» está apagado cuando no hay construcción.
 *
 * ⚠️ Es un motivo del DATO, no de la rama: lo que F13 retiró de `app/rama.js` es
 * el apagado *por ser edificio*. Éste dice qué falta y cómo conseguirlo, que es lo
 * que hace que un botón apagado no sea un botón muerto.
 */
export const MOTIVO_SIN_EDIFICIO =
  'No hay ninguna construcción cargada: trae un edificio por cualquiera de las vías de Entrada ' +
  '—un GML, un DXF, el propio Catastro— y el botón se enciende.'

/**
 * Cuando la construcción existe pero **ninguna parte tiene volumen sobre rasante**
 * (todas son sótano, o todas son «Otra»). No hay huella que aportar, y es
 * literalmente lo que contesta el ICUC.
 */
export const MOTIVO_SIN_HUELLA =
  'Ninguna parte de la construcción tiene plantas sobre rasante, así que no hay huella que ' +
  'aportar: el ICUC pide la del edificio, y un volumen enterrado no la tiene. Revisa las plantas ' +
  'de las partes.'

/** Lo que se dice cuando revienta algo antes de tener el fichero. */
export const MENSAJE_FALLO_INESPERADO =
  'No se ha podido generar el GML de la construcción por un fallo interno; no se ha descargado ' +
  'ningún fichero. El detalle técnico está en la consola del navegador.'

/** Gemelo del anterior para el momento de la ENTREGA: el GML ya está bien. */
export const MENSAJE_FALLO_ENTREGA =
  'El GML de la construcción se ha generado, pero el navegador no ha podido descargarlo. ' +
  'El detalle técnico está en la consola del navegador.'

/** Los dos tramos del recorrido, a efectos de elegir el mensaje del `catch`. */
const FASE = Object.freeze({ GENERACION: 'GENERACION', ENTREGA: 'ENTREGA' })

/** Las TRES severidades de `gml/` a los DOS niveles del panel. Igual que en F04. */
const NIVEL_POR_SEVERIDAD = Object.freeze({
  [SEVERIDAD.INFO]: NIVEL.AVISO,
  [SEVERIDAD.AVISO]: NIVEL.AVISO,
  [SEVERIDAD.ERROR]: NIVEL.ERROR,
})

/**
 * El renglón cuando la validación bloquea. Mismo formato que el de parcela: el
 * recuento primero —para que se lea de un vistazo cuántos son— y los dos primeros
 * motivos después.
 *
 * @param {object[]} errores
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
  return `${recuento}: ${visibles.join(' ')}` + (resto > 0 ? ` (…y ${resto} motivo(s) más.)` : '')
}

/**
 * El renglón cuando el serializador se niega a escribir. Ver `motivoSinFichero`
 * de `app/main.js`: es el mismo hecho contado igual, y se escribe aparte porque
 * este módulo no importa aquél (ver la cabecera).
 *
 * @param {string[]} bloqueos
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

// ── Helpers de dominio ───────────────────────────────────────────────────────

/**
 * El máximo de plantas sobre rasante de las partes principales, o `null` si
 * ninguna lo declara.
 *
 * Es lo que va en el `numberOfFloorsAboveGround` del `Building` (dossier §1.2), y
 * `null` sale nulo en vez de `0`: «no consta» y «cero plantas» son cosas
 * distintas, y la segunda es la que convierte un edificio en un sótano.
 *
 * @param {object[]} partes
 * @returns {number|null}
 */
export function plantasDelEdificio(partes) {
  const declaradas = partes
    .filter((p) => p?.tipo === TIPO_PARTE.PRINCIPAL)
    .map((p) => p?.plantasSobreRasante)
    .filter((n) => typeof n === 'number' && Number.isFinite(n))
  return declaradas.length === 0 ? null : Math.max(...declaradas)
}

/** Las partes «Otra» con contorno: son las que salen como `OtherConstruction`. */
export const otrasDe = (partes) =>
  partes
    .filter((p) => p?.tipo === TIPO_PARTE.OTRA && Array.isArray(p?.recinto?.vertices))
    .map((p) => ({ nombre: p.nombre, recinto: p.recinto }))

/**
 * La identidad con la que se nombra el fichero y se compone el `gml:id`.
 *
 * Mismo criterio que la rama de parcela (`refcat ?? idLocal`): la referencia
 * catastral si la hay, y si no el nombre local con el que entró el documento. No
 * se inventa ninguna — `serializarEdificioBu` LANZA con la cadena vacía, y aquí se
 * comprueba antes para que eso no llegue a pasar nunca por esta vía.
 *
 * @param {object} edificio
 * @returns {string|null}
 */
export function identidadDe(edificio) {
  for (const candidato of [edificio?.refcat, edificio?.idLocal]) {
    if (typeof candidato === 'string' && candidato.trim() !== '') return candidato
  }
  return null
}

/** La referencia catastral de verdad, o `null`. Es lo que va en el NOMBRE. */
const referenciaDe = (edificio) =>
  typeof edificio?.refcat === 'string' && edificio.refcat.trim() !== '' ? edificio.refcat : null

// ── El cableado ──────────────────────────────────────────────────────────────

/**
 * Cablea «Generar GML» para la rama EDIFICIO.
 *
 * @param {object} opciones
 * @param {{get: () => object|null, subscribe: (fn: Function) => Function}} opciones.estadoEdificio
 *   El store de la rama EDIFICIO.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel
 * @param {string} opciones.srs
 * @param {HTMLElement} [opciones.boton]
 * @param {HTMLElement} [opciones.renglon]
 * @param {() => Date} [opciones.ahora]
 * @param {typeof descargarTexto} [opciones.descargar]
 * @param {() => boolean} [opciones.mando]  Si esta rama gobierna hoy el botón.
 * @param {Document} [opciones.documento]
 * @returns {{generar: () => (object|null), refrescar: () => void, destruir: () => void}}
 * @throws {TypeError} Si falta el botón o el renglón en la cáscara.
 */
export function cablearGeneracionGmlEdificio({
  estadoEdificio,
  panel,
  srs,
  boton,
  renglon,
  ahora = () => new Date(),
  descargar = descargarTexto,
  mando = () => true,
  documento = globalThis.document,
} = {}) {
  const nodoBoton = boton ?? documento.querySelector(SELECTOR_BOTON)
  const nodoRenglon = renglon ?? documento.querySelector(SELECTOR_ESTADO)
  if (!nodoBoton || !nodoRenglon) {
    throw new TypeError(
      `cablearGeneracionGmlEdificio: faltan en la cáscara «${SELECTOR_BOTON}» o ` +
        `«${SELECTOR_ESTADO}». Es el contrato con index.html, y sin ellos no hay ` +
        'dónde decir por qué el botón está apagado.',
    )
  }

  // ── ⛔ LA BANDERA QUE FALTABA (auditoría 2026-08-16, hallazgo B3) ───────────
  //
  // Éste era el ÚNICO cableado de `app/` sin `destruido`, y no era inocuo: soltar
  // los cables impide que lleguen EVENTOS, no que alguien LLAME. Y hay quien llama:
  // `app/main.js` invoca `refrescar()` en cada conmutación de rama, y el botón y el
  // renglón son **los mismos nodos** que gobierna la rama de parcela (el pie no se
  // intercambia, lo dice `app/rama.js`). Un cable ya destruido podía por tanto
  // escribirle encima el motivo de un edificio que ya no se ve, y publicar por
  // {@link alValidacion} la validación de un documento retirado — que es lo que
  // mueve el resalte de las huellas en el mapa.
  //
  // El patrón es el de los demás (`cableado-informe-edificio.js`,
  // `cableado-contraste-edificio.js`, `cableado-diagnostico.js`): guarda al
  // principio de cada método público y `destruido = true` al frente de `destruir()`,
  // que además queda IDEMPOTENTE.
  let destruido = false

  /** Escribe el renglón. Vacío + sin modificador es «todo en orden». */
  function decir(texto, esError) {
    nodoRenglon.textContent = texto
    nodoRenglon.classList.toggle(CLASE_ESTADO_ERROR, esError)
  }

  // ── ⭐ F14 · La validación, PUBLICADA ──────────────────────────────────────
  //
  // Un `Set` y no un `= fn`, como todos los `alAlgo` de la casa: un asignador
  // desengancharía al primer oyente en silencio.

  /** @type {Set<(v: object|null) => void>} */
  const oyentesValidacion = new Set()
  /** La última calculada. `null` = no hay (sin partes, o el cálculo reventó). */
  let ultimaValidacion = null

  /**
   * Guarda la validación y avisa. Un oyente roto se cuenta y no interrumpe: quien
   * avisa ya ha hecho su trabajo, y esto corre desde un suscriptor del store.
   *
   * @param {object|null} validacion
   */
  function publicarValidacion(validacion) {
    ultimaValidacion = validacion ?? null
    for (const fn of [...oyentesValidacion]) {
      try {
        fn(ultimaValidacion)
      } catch (causa) {
        console.error('[gml-bu] un oyente de alValidacion ha reventado', causa)
      }
    }
  }

  /**
   * Lo que hay que saber del edificio que haya en el store, en un solo sitio.
   *
   * ⚠️ Devuelve SIEMPRE la misma forma, también cuando no hay edificio: un
   * `null` suelto obligaría a cada llamante a preguntar antes de mirar, y el que
   * se olvidara vería «0 errores» donde lo que hay es «nada que validar».
   *
   * @param {object|null} edificio
   */
  function examinar(edificio) {
    const partes = Array.isArray(edificio?.partes) ? edificio.partes : []
    if (partes.length === 0) return { hay: false, motivo: MOTIVO_SIN_EDIFICIO }

    const validacion = validarEdificio(partes, {
      srs,
      parcelaContexto: edificio.parcelaContexto ?? null,
    })
    if (!validacion.puedeGenerar) {
      return { hay: true, validacion, motivo: motivoDeBloqueo(validacion.errores) }
    }

    // La huella se deriva AQUÍ, no se guarda: es lo que dice `model/edificio.js`
    // desde F00. Y si sale vacía, el botón se apaga con su motivo propio en vez de
    // dejar que el serializador lo descubra: el usuario tiene que poder leerlo
    // ANTES de pulsar, no en el mensaje de un fichero que no baja.
    const envolvente = envolventeDe(partes)
    if (envolvente.recintos.length === 0) {
      return { hay: true, validacion, envolvente, motivo: MOTIVO_SIN_HUELLA }
    }
    return { hay: true, validacion, envolvente, motivo: null }
  }

  /**
   * Suscriptor del store: re-evalúa y lo refleja en el par botón + renglón. Los
   * dos SIEMPRE a la vez — un botón apagado sin motivo al lado es lo que este
   * cableado existe para no producir.
   */
  function refrescar() {
    if (destruido || !mando()) return
    let examen
    try {
      examen = examinar(estadoEdificio?.get() ?? null)
      // ⭐ F14 · La validación se PUBLICA, y por eso este `refrescar` deja de ser
      // solo el gate del botón. Ver {@link alValidacion}.
      publicarValidacion(examen.validacion ?? null)
    } catch (causa) {
      // Misma red que el cableado de parcela y por el mismo camino medido: el
      // store admite cualquier POJO, así que una coordenada no finita puede
      // hacer LANZAR a la validación desde `geo/huso.js`. Aquí no se relanza:
      // esto corre dentro del ensamblaje y desde un `subscribe`.
      nodoBoton.disabled = true
      decir(MENSAJE_FALLO_INESPERADO, true)
      console.error('[gml-bu] no se ha podido evaluar si la construcción puede generarse:', causa)
      // Y el resalte del mapa se RETIRA: unas huellas señaladas por una validación
      // que acaba de reventar señalarían lo que ya no se sabe.
      publicarValidacion(null)
      return
    }
    if (examen.motivo === null) {
      nodoBoton.disabled = false
      decir('', false)
      return
    }
    nodoBoton.disabled = true
    decir(examen.motivo, examen.hay)
  }

  /** El recorrido completo, con la red que impide el botón mudo. */
  function generar() {
    if (destruido) return null
    let fase = FASE.GENERACION
    try {
      return recorrido(() => {
        fase = FASE.ENTREGA
      })
    } catch (causa) {
      const mensaje = fase === FASE.ENTREGA ? MENSAJE_FALLO_ENTREGA : MENSAJE_FALLO_INESPERADO
      // Se dice al usuario Y se relanza: lo primero porque un botón que no hace
      // nada es un error silencioso; lo segundo porque esto es un defecto de
      // programación y tiene que seguir apareciendo en la consola.
      decir(mensaje, true)
      panel.avisar(mensaje, { nivel: NIVEL.ERROR, causa })
      throw causa
    }
  }

  /** @param {() => void} entrandoEnEntrega */
  function recorrido(entrandoEnEntrega) {
    if (!mando()) return null
    const edificio = estadoEdificio?.get() ?? null

    // ── 1 · Validación ──────────────────────────────────────────────────────
    const examen = examinar(edificio)
    if (examen.motivo !== null) {
      // Al panel, uno por uno: es donde caben enteros. `h.nivel` ya es el del
      // hallazgo, para que las dos capas no puedan divergir.
      for (const h of examen.validacion?.errores ?? []) panel.avisar(h.mensaje, { nivel: h.nivel })
      nodoBoton.disabled = true
      decir(examen.motivo, examen.hay)
      return null
    }

    // ── 2 · Los avisos que NO bloquean, y lo que no se ha podido comprobar ───
    // Sale antes de generar y no después: el técnico está a punto de subir esto a
    // la Sede, y «no se ha comprobado si cae dentro de la parcela» es justo lo que
    // tiene que leer ANTES, no cuando el fichero ya está en su carpeta.
    for (const h of examen.validacion.avisos) panel.avisar(h.mensaje, { nivel: h.nivel })

    // ── 3 · Serialización ───────────────────────────────────────────────────
    const identidad = identidadDe(edificio)
    if (identidad === null) {
      // No debería llegar aquí —`examinar` exige partes y el modelo exige nombre
      // en cuanto hay documento—, pero si llegara, `serializarEdificioBu` lanzaría
      // y el usuario vería «fallo interno» cuando lo que falta es un nombre.
      nodoBoton.disabled = true
      decir(MOTIVO_SIN_EDIFICIO, true)
      return null
    }

    const fecha = ahora()
    const { xml, resumen, detecciones } = serializarEdificioBu({
      envolvente: examen.envolvente.recintos,
      otras: otrasDe(edificio.partes),
      srs,
      refcat: identidad,
      modelo: edificio.modelo,
      plantasSobreRasante: plantasDelEdificio(edificio.partes),
      estadoConservacion: edificio.estadoConservacion ?? null,
      // ⭐ F21 · LA LÍNEA QUE F13 DEJÓ SIN ESCRIBIR. `serializarEdificioBu` acepta
      // `precisionMetros` desde su fase 2 y **nadie se lo pasaba nunca**, así que
      // el `horizontalGeometryEstimatedAccuracy` salía `xsi:nil` siempre: honrado
      // mientras el dato no existía, y falso desde que la Sede lo exige en su paso
      // 1 y el técnico lo tiene delante. Sin declarar sigue siendo `null` ⇒ `nil`.
      precisionMetros: edificio.precisionMetros ?? null,
      // Los semánticos solo tienen efecto en COMPLETO; se pasan siempre y decide
      // el serializador, para que no haya dos sitios que sepan cuál es cuál.
      usoDominante: edificio.usoDominante ?? null,
      numeroInmuebles: edificio.numeroInmuebles ?? null,
      numeroViviendas: edificio.numeroViviendas ?? null,
      superficieConstruida: edificio.superficieConstruida ?? null,
      anioConstruccion: edificio.anioConstruccion ?? null,
      // `beginLifespanVersion` NO se pasa, igual que en la entrega de parcela:
      // su ausencia emite `xsi:nil`, y en un alta eso es lo único honesto — desde
      // cuándo rige la versión del objeto lo fija el Catastro, no el declarante.
    })

    // ── 4 · Regla de oro 1: TODO lo que decidió el serializador, al panel ────
    for (const d of detecciones) {
      panel.avisar(d.mensaje, { nivel: NIVEL_POR_SEVERIDAD[d.severidad] ?? NIVEL.AVISO })
    }

    // ── 5 · Entrega ─────────────────────────────────────────────────────────
    if (xml === null) {
      decir(motivoSinFichero(resumen.bloqueos), true)
      return null
    }
    entrandoEnEntrega()

    // ⚠️ **`descargarTexto` y no `descargarGml`, y no es indiferente**:
    // `descargarGml` compone el nombre POR SU CUENTA con `nombreFicheroGml`, así
    // que un `nombre` pasado en sus opciones se ignoraría **en silencio** y el
    // fichero del ICUC bajaría llamándose `parcela_…`. Se baja un escalón, que es
    // donde el nombre sí es un parámetro. (Comprobado al escribirlo: la primera
    // versión llamaba a `descargarGml` y el nombre no llegaba a ninguna parte.)
    const entrega = descargar(xml, {
      // La REFERENCIA, no la identidad: un edificio sin referencia catastral se
      // llama `edificio_sin-referencia_…`, que es verdad, y no `edificio_<el
      // nombre del fichero que soltó el usuario>`.
      nombreFichero: nombreFicheroGmlEdificio({ refcat: referenciaDe(edificio), fecha }),
      mime: TIPO_MIME_GML,
    })
    decir(
      entrega.descargado ? `Descargado «${entrega.nombre}».` : entrega.mensaje,
      !entrega.descargado,
    )
    return entrega
  }

  nodoBoton.addEventListener('click', generar)
  const desuscribir = estadoEdificio?.subscribe(refrescar) ?? (() => {})
  // `subscribe` no notifica al suscribirse: el primer estado se calcula a mano.
  refrescar()

  return {
    generar,
    refrescar,

    /**
     * La ÚLTIMA validación calculada, o `null`. Es una lectura, no una puerta.
     *
     * @returns {object|null}
     */
    ultimaValidacion: () => ultimaValidacion,

    /**
     * ⭐ **F14 · Se suscribe a la validación. Devuelve la BAJA.**
     *
     * ── POR QUÉ ESTE CANAL EXISTE ──────────────────────────────────────────
     * `validation/edificio.js#porParte` se construyó en F13 para que «el resalte
     * del aviso rodee la parte que se sale, no otra» (ficha §16.1) y **no tuvo ni
     * un llamante fuera de sus pruebas**. Tercera vez que este proyecto escribe el
     * canal y no lo enchufa. Lo que faltaba no era el cálculo: era **una forma de
     * enterarse**, porque hasta F14 la validación se hacía aquí dentro y moría
     * aquí dentro.
     *
     * ⚠️ Y no bastaba con validar al pulsar «Generar GML», que es lo que la ficha
     * de F13 anotó como pendiente: para que el resalte esté vivo hay que validar
     * **al cambiar el modelo**. Ya se hacía —{@link refrescar} corre en cada `set`
     * del store para gobernar el botón—, así que el canal no añade ni una
     * validación de más: publica la que ya se estaba calculando. De rebote, el
     * recuento del renglón deja de poder estar rancio.
     *
     * Se le pasa la validación entera —no solo los índices— porque quien escuche
     * decide qué hacer con ella; hoy es el resalte del mapa y mañana puede ser una
     * lista en el panel. `null` significa «no hay validación»: sin partes, o
     * porque acaba de reventar.
     *
     * @param {(validacion: object|null) => void} fn
     * @returns {() => void}
     */
    alValidacion(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alValidacion: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      oyentesValidacion.add(fn)
      return () => oyentesValidacion.delete(fn)
    },

    /** Suelta los dos cables y deja el módulo INERTE. IDEMPOTENTE. */
    destruir() {
      if (destruido) return
      destruido = true
      nodoBoton.removeEventListener('click', generar)
      desuscribir()
      oyentesValidacion.clear()
    },
  }
}

/**
 * ⭐ **Los índices de las partes a las que apunta algún hallazgo.** FUNCIÓN PURA,
 * y exportada porque es la traducción entre `validation/edificio.js#porParte` y
 * `viewer/partes.js#pintar({senaladas})` — la juntura que F13 dejó sin construir.
 *
 * ⚠️ **Errores y avisos entran los DOS**, y no se distinguen en el mapa. En la
 * lista sí están separados —son categorías distintas y el recuento se hace sobre
 * ellas—, pero el resalte contesta una sola pregunta: «¿de qué parte habla lo que
 * estoy leyendo?». Dos trazos distintos ahí obligarían a mirar dos veces, y el
 * segundo estaría además a un paso de leerse como un semáforo (regla de oro 9).
 *
 * @param {object|null} validacion  Lo que devuelve `validarEdificio`, o `null`.
 * @returns {number[]}  Índices, en orden y sin repetir. `[]` si no hay ninguno.
 */
export function partesSenaladas(validacion) {
  const porParte = validacion?.porParte
  if (!Array.isArray(porParte)) return []
  return porParte
    .filter((p) => (p?.errores?.length ?? 0) + (p?.avisos?.length ?? 0) > 0)
    .map((p) => p.indice)
    .filter((i) => Number.isInteger(i))
}
