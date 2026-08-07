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

  /** Escribe el renglón. Vacío + sin modificador es «todo en orden». */
  function decir(texto, esError) {
    nodoRenglon.textContent = texto
    nodoRenglon.classList.toggle(CLASE_ESTADO_ERROR, esError)
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
    if (!mando()) return
    let examen
    try {
      examen = examinar(estadoEdificio?.get() ?? null)
    } catch (causa) {
      // Misma red que el cableado de parcela y por el mismo camino medido: el
      // store admite cualquier POJO, así que una coordenada no finita puede
      // hacer LANZAR a la validación desde `geo/huso.js`. Aquí no se relanza:
      // esto corre dentro del ensamblaje y desde un `subscribe`.
      nodoBoton.disabled = true
      decir(MENSAJE_FALLO_INESPERADO, true)
      console.error('[gml-bu] no se ha podido evaluar si la construcción puede generarse:', causa)
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
    destruir() {
      nodoBoton.removeEventListener('click', generar)
      desuscribir()
    },
  }
}
