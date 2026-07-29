// app/cableado-diagnostico.js — F07 · T4.3. EL CABLE entre el diagnóstico y la app.
//
// `diagnostico/` sabe medir el encaje, `viewer/cajon-diagnostico.js` sabe enseñarlo
// y `viewer/contraste.js` sabe señalarlo en el mapa. Ninguno de los tres conoce el
// store, el Catastro ni el CTA del pie: este fichero es lo que los une, igual que
// `app/cableado-catastro.js` hizo con F05 y `cablearEdicion` con F06.
//
// Su anatomía es la de aquel a propósito —selectores exportados, nodos resueltos
// con `throw` si faltan, dependencias inyectables, `destruir()` idempotente—: quien
// llegue después reconoce el patrón sin leerlo entero.
//
// ── LAS CINCO COSAS DE LAS QUE ES DUEÑO ─────────────────────────────────────
//
//   1. **EL CTA.** Encendido ⟺ hay `geometriaOficial` en el store. Y cuando queda
//      apagado se ESCRIBE EL MOTIVO: un botón gris y mudo es un error silencioso
//      (regla de oro 1). Ver {@link MOTIVO_SIN_OFICIAL}.
//   2. **LAS COLINDANTES.** Al abrir, si no hay vecinas, UNA llamada a
//      `catastro.colindantes()`. Una apertura, una petición (override O8).
//   3. **LA TRADUCCIÓN** `ParcelaGml[] → [{refcat, recintos}]`, que es lo que come
//      `diagnostico/parcela.js`.
//   4. **EL ESTADO DEL EXPEDIENTE**: la superficie registral y la clase de suelo
//      sobreviven a las ediciones y se REINICIAN con cada parcela distinta.
//   5. **EL RECÁLCULO**: por el store (una vez por operación acabada) y por los dos
//      campos del cajón. **Nunca por `alPrevisualizar`.**
//
// ── POR QUÉ EL RECÁLCULO NO SE ENGANCHA A `alPrevisualizar` ─────────────────
// Es la decisión de rendimiento de F07 y conviene que esté escrita donde se toma.
// `alPrevisualizar` se dispara en CADA FRAME de un arrastre —sesenta veces por
// segundo— y lo que hay detrás de `diagnosticar()` no es una resta: es la
// intersección topológica contra el contorno oficial y contra cada vecina, más el
// muestreo de la desviación lado a lado (decenas de miles de proyecciones, ~67 ms
// medidos sobre la parcela real). Colgarlo del frame convertiría un arrastre fluido
// en una presentación de diapositivas, y para nada: el diagnóstico no se lee
// mientras se mueve el ratón, se lee cuando se ha soltado.
//
// El canal correcto es `estado.subscribe`, que notifica UNA vez por operación
// ACABADA. La ficha del pie sigue con `edit/metricas.js` por el canal en vivo y el
// cajón con `diagnostico/parcela.js` por este: son dos consumidores distintos del
// mismo modelo y **ninguno recalcula lo del otro**. Que las dos cifras de
// superficie coincidan es invariante, y lo afirma el test de aceptación.
//
// ── POR QUÉ UNA PARCELA DISTINTA CIERRA EL CAJÓN ────────────────────────────
// La alternativa —dejarlo abierto y recalcular— parecía más amable y es peor por
// dos motivos. El primero: las vecinas son de la parcela ANTERIOR, así que habría
// que tirarlas, y el cajón se quedaría abierto diciendo «no se ha consultado» sin
// que el usuario hubiera hecho nada. El segundo, y el que decide: para volver a
// tenerlas haría falta otra petición, y dispararla sola —sin que nadie la pida— es
// justo lo que castiga la política de uso del servicio (override O8). Cerrando, la
// siguiente pulsación del CTA es el gesto que la autoriza. Una parcela nueva es un
// diagnóstico nuevo, no el mismo con otras cifras.
//
// El expediente (registral y clase) se reinicia en ese mismo momento y solo en ese:
// son datos de UNA escritura y de UNA parcela. Sobreviven a las ediciones —mover un
// vértice no cambia lo que dice el Registro— y eso es lo que el test afirma.
//
// ── LO QUE ESTE MÓDULO **NO** HACE ──────────────────────────────────────────
//   · **No importa Leaflet ni toca el mapa.** El contraste entra ya construido
//     (`visor.diagnostico.contraste`) y se le habla por sus tres métodos.
//   · **No habla con el Catastro.** Recibe el cableado de F05 y le pide
//     `colindantes()`; no construye URLs ni sabe qué es una *stored query*.
//   · **No filtra la parcela propia de las colindantes.** Ya lo hace
//     `services/catastro.js#parcelaYColindantes`, que es donde está medido el
//     override O15 (`GetNeighbourParcel` devuelve 5 miembros para 4 colindantes, y
//     la propia NO viene la primera). Repetir aquí ese filtro sería una segunda
//     verdad sobre el servicio; lo que sí hay es un test que lo afirma de extremo a
//     extremo, porque de eso depende que la parcela no aparezca invadiéndose a sí
//     misma al 100 %.
//   · **No decide si el encaje es bueno.** Traslada cifras (regla de oro 9).
//
// Su test es `test/app/diagnostico.dom.test.js`, con sufijo `.dom`: toca el DOM.

import { diagnosticar } from '../diagnostico/parcela.js'
import { NIVEL } from '../viewer/_comun.js'

// ── Los selectores del contrato con `index.html` ─────────────────────────────

/**
 * «Diagnosticar encaje». **Nace `disabled` en `index.html`** y lo enciende el
 * ESTADO, nunca la mera importación de este módulo.
 */
export const SELECTOR_BOTON_DIAGNOSTICAR = '[data-accion="diagnosticar"]'

/**
 * Renglón `role="status"` del CTA. Lleva la misma cadena que su `data-accion`, que
 * es la convención de esta app (`generar-gml`/`generar-gml`, `cargar-catastro`/
 * `cargar-catastro`).
 *
 * ⚠️ NO confundir con el renglón del CAJÓN, que es `[data-estado="cajon-diagnostico"]`
 * y vive dentro del mapa. Son dos superficies distintas: este cuenta el desenlace
 * de PULSAR el botón (por qué está apagado, si la consulta de vecinas falló); el
 * otro, el estado de lo que se está enseñando dentro del cajón. Se llaman distinto
 * a propósito: `querySelector` se queda con el PRIMERO del documento y el `<aside>`
 * va antes que el `<main>`, así que dos nodos con el mismo valor dejarían al del
 * cajón inalcanzable y mudo. La trampa está documentada en `index.html` desde F06.
 */
export const SELECTOR_ESTADO_DIAGNOSTICO = '[data-estado="diagnosticar"]'

// ── Constantes de presentación ───────────────────────────────────────────────

/** Modificador de `.gml-accion-estado` para el desenlace que NO trae el dato. */
const CLASE_ESTADO_ERROR = 'gml-accion-estado--error'

/**
 * Por qué «Diagnosticar encaje» está apagado. Se exporta para que su test lo
 * afirme sin copiar el literal, igual que `MOTIVO_COLINDANTES_APAGADO` de F05.
 *
 * Dice las dos cosas que hacen falta: qué falta y cómo conseguirlo. «Necesitas una
 * parcela» a secas dejaría al usuario mirando una parcela cargada sin entender por
 * qué no le vale (la suya es un DXF: tiene geometría, pero no tiene contra qué
 * contrastarla).
 */
export const MOTIVO_SIN_OFICIAL =
  '«Diagnosticar encaje» está apagado: el diagnóstico contrasta la geometría medida contra el ' +
  'contorno OFICIAL del Catastro, y esta parcela no lo trae (se ha cargado de un fichero o se ' +
  'ha dibujado). Tráela del Catastro y se enciende.'

/**
 * Lo que se dice cuando no hay a quién pedirle las vecinas. No es un fallo: es un
 * visor montado sin el cableado del Catastro, que es un uso legítimo.
 */
export const MOTIVO_SIN_CATASTRO =
  'No se han consultado las parcelas colindantes: esta pantalla no tiene conectado el cliente ' +
  'del Catastro. Las otras ocho medidas del diagnóstico no dependen de ellas.'

/**
 * Lo que se dice cuando la consulta de vecinas no ha traído nada. **El diagnóstico
 * se pinta igual**: un fallo de red no puede tumbar las ocho medidas que no
 * dependen de la red, y decir «no hay invasión» porque no se ha podido mirar sería
 * el error silencioso más caro de esta pantalla.
 */
export const COLA_SIN_VECINAS =
  'El resto del diagnóstico está calculado; solo falta la invasión a colindantes.'

/**
 * Lo que se le dice al usuario cuando el diagnóstico revienta por un defecto de
 * programación. Mismo criterio —y mismas tres piezas— que
 * `MENSAJE_FALLO_INESPERADO` de `app/main.js` y de `cableado-catastro.js`: qué ha
 * pasado, que no se ha cambiado nada, y dónde está el detalle.
 */
export const MENSAJE_FALLO_INESPERADO =
  'El diagnóstico se ha interrumpido por un fallo interno de la aplicación; no se ha cambiado ' +
  'nada de la parcela. El detalle técnico está en la consola del navegador.'

// ── Nodos de la cáscara ──────────────────────────────────────────────────────

/**
 * Nodo de `index.html`, o `throw`. El marcado de la cáscara es CONTRATO, así que un
 * selector que no encuentra nada es un bug del programador y no un dato malo: se
 * lanza y **se nombra el selector**. Gemelo del de `cableado-catastro.js`; son dos
 * copias de cuatro líneas y siguen siendo dos porque cada mensaje nombra su propio
 * fichero, que es la mitad de lo que sirve.
 *
 * @param {string} selector
 * @returns {HTMLElement}
 * @throws {Error} Si la cáscara no tiene ese nodo.
 */
function nodo(selector) {
  const encontrado = document.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `app/cableado-diagnostico.js: la cáscara no tiene ningún nodo '${selector}'. El marcado ` +
        `de index.html es contrato de este cableado (y de estilos/app.css): si se ha renombrado ` +
        `o movido ese nodo, hay que arreglarlo en index.html, no aquí.`,
    )
  }
  return /** @type {HTMLElement} */ (encontrado)
}

// ── Lecturas del modelo ──────────────────────────────────────────────────────

/**
 * Los recintos del POJO que haya en el store. El store admite `null` (su valor
 * inicial documentado) y cualquier POJO sin validarlo, así que aquí no se da nada
 * por hecho. Mismo criterio que `cableado-catastro.js#recintosDe`.
 *
 * @param {object|null} parcelaActual
 * @returns {Array<{vertices: Array<[number, number]>, tipo: string}>}
 */
function recintosDe(parcelaActual) {
  const recintos =
    parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.recintos
  return Array.isArray(recintos) ? recintos : []
}

/**
 * El contorno OFICIAL del POJO, o `null`. `null` y un array VACÍO se tratan igual
 * —no hay con qué contrastar— pero se distinguen del array con recintos, que es lo
 * único que enciende el CTA.
 *
 * @param {object|null} parcelaActual
 * @returns {Array|null}
 */
function oficialDe(parcelaActual) {
  const oficial =
    parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.geometriaOficial
  return Array.isArray(oficial) && oficial.length > 0 ? oficial : null
}

/**
 * ¿Tiene sentido ofrecer «Diagnosticar encaje»? **Hay contorno oficial Y hay
 * geometría del usuario.** Las dos mitades importan y la segunda no es teórica: el
 * store arranca en `null` y una parcela a medio dibujar tiene `recintos: []`.
 *
 * No se exporta: es una regla INTERNA de esta pantalla, y sacarla invitaría a que
 * otro módulo decidiera con ella. Se comprueba desde fuera por su efecto (el
 * `disabled` del botón), que es lo que el usuario ve. Mismo criterio que
 * `puedeDeducirDe` y `puedePedirColindantesDe` de F05.
 *
 * @param {object|null} parcelaActual
 * @returns {boolean}
 */
function puedeDiagnosticar(parcelaActual) {
  return oficialDe(parcelaActual) !== null && recintosDe(parcelaActual).length > 0
}

/**
 * Qué PARCELA es esta, a efectos de «¿ha entrado una distinta?». La referencia
 * catastral primero y el `idLocal` como respaldo: los dos sobreviven a las
 * ediciones —`edit/` reconstruye el POJO pero no reetiqueta el expediente—, que es
 * exactamente la propiedad que hace falta. La identidad del OBJETO no vale: cada
 * operación de edición produce uno nuevo.
 *
 * @param {object|null} parcelaActual
 * @returns {string|null}
 */
function claveDeExpediente(parcelaActual) {
  if (parcelaActual === null || parcelaActual === undefined) return null
  const refcat = typeof parcelaActual.refcat === 'string' ? parcelaActual.refcat.trim() : ''
  if (refcat !== '') return `refcat:${refcat}`
  const idLocal = typeof parcelaActual.idLocal === 'string' ? parcelaActual.idLocal : ''
  return idLocal === '' ? null : `idLocal:${idLocal}`
}

/**
 * `ParcelaGml[]` → `[{refcat, recintos}]`, que es lo que come
 * `diagnostico/parcela.js`. La traducción es de tres campos y aun así vive en una
 * función con nombre: es la costura entre el vocabulario de `gml/parse.js` y el de
 * `diagnostico/`, y las costuras se leen mejor con nombre.
 *
 * Una vecina SIN recintos se deja pasar con `recintos: []`. No se filtra a
 * propósito: `diagnostico/topologia.js` la anota en `saltados` con su índice y su
 * motivo, y así el usuario ve que el Catastro devolvió una vecina que no se ha
 * podido medir. Descartarla aquí la haría desaparecer sin dejar rastro, que es la
 * definición de fallo silencioso.
 *
 * @param {Array<{refcat: string|null, recintos: Array}>} parcelas
 * @returns {Array<{refcat: string|null, recintos: Array}>}
 */
function aVecinas(parcelas) {
  if (!Array.isArray(parcelas)) return []
  return parcelas.map((p) => ({
    refcat: typeof p.refcat === 'string' && p.refcat !== '' ? p.refcat : null,
    recintos: Array.isArray(p.recintos) ? p.recintos : [],
  }))
}

// ── Contratos de las dependencias ────────────────────────────────────────────

/** ¿Sirve como store? DUCK TYPING, igual que en `viewer/index.js#esStore`. */
const esStore = (v) =>
  !!v && typeof v.get === 'function' && typeof v.subscribe === 'function'

/** ¿Es el cajón de `viewer/cajon-diagnostico.js`? Se comprueba lo que se USA. */
const esCajon = (v) =>
  !!v &&
  typeof v.pintar === 'function' &&
  typeof v.abrir === 'function' &&
  typeof v.cerrar === 'function' &&
  typeof v.abierto === 'function' &&
  typeof v.registral === 'function' &&
  typeof v.clase === 'function' &&
  typeof v.reiniciarExpediente === 'function' &&
  typeof v.estado === 'function' &&
  typeof v.alCambiar === 'function' &&
  typeof v.alCerrar === 'function'

/** ¿Es la capa de `viewer/contraste.js`? */
const esContraste = (v) => !!v && typeof v.pintar === 'function' && typeof v.limpiar === 'function'

/** ¿Es el cableado de F05, con lo que este módulo le pide? */
const esCatastro = (v) =>
  !!v && typeof v.colindantes === 'function' && typeof v.alColindantes === 'function'

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Cablea el diagnóstico de encaje: el CTA del pie, el cajón del mapa, la capa de
 * contraste y (si lo hay) el cliente del Catastro para las colindantes.
 *
 * ```js
 * const visor = crearVisor(el, { estado, tablaEl, srs, edicion: true, diagnostico: true })
 * const catastro = cablearCatastro({ estado, panel, cliente, srs })
 * const diag = cablearDiagnostico({
 *   estado,
 *   cajon: visor.diagnostico.cajon,
 *   contraste: visor.diagnostico.contraste,
 *   catastro,
 *   panel,
 * })
 * // … al cerrar la pantalla:
 * diag.destruir()
 * ```
 *
 * @param {Object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El store del
 *   visor. Se LEE y se ESCUCHA; nunca se escribe: el diagnóstico mide, no edita.
 * @param {object} opciones.cajon  `visor.diagnostico.cajon`.
 * @param {object} opciones.contraste  `visor.diagnostico.contraste`.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos, para
 *   el único caso que le corresponde: un fallo INESPERADO del cálculo.
 * @param {object|null} [opciones.catastro=null]  El cableado de F05
 *   (`cablearCatastro`). `null` ⇒ no se consultan vecinas y se DICE
 *   ({@link MOTIVO_SIN_CATASTRO}): es un uso legítimo, no una degradación callada.
 * @param {HTMLElement} [opciones.boton]  El CTA. Por defecto, el de la cáscara.
 * @param {HTMLElement} [opciones.renglon]  Su `role="status"`.
 * @returns {{abrir: (evento?: Event|null) => Promise<void>, recalcular: () => void,
 *   destruir: () => void}}
 * @throws {TypeError}  Contrato del programador.
 * @throws {Error}  Si la cáscara no trae los dos nodos del contrato.
 */
export function cablearDiagnostico({
  estado,
  cajon,
  contraste,
  panel,
  catastro = null,
  boton = nodo(SELECTOR_BOTON_DIAGNOSTICAR),
  renglon = nodo(SELECTOR_ESTADO_DIAGNOSTICO),
} = {}) {
  if (!esStore(estado)) {
    throw new TypeError(
      `cablearDiagnostico: 'estado' debe ser el store de crearEstadoVista ` +
        `({get, subscribe}); recibido ${typeof estado}.`,
    )
  }
  if (!esCajon(cajon)) {
    throw new TypeError(
      `cablearDiagnostico: 'cajon' debe ser el de viewer/cajon-diagnostico.js ` +
        `(lo devuelve crearVisor en visor.diagnostico.cajon); recibido ${typeof cajon}. Si vale ` +
        `undefined, el visor se montó sin 'diagnostico: true'.`,
    )
  }
  if (!esContraste(contraste)) {
    throw new TypeError(
      `cablearDiagnostico: 'contraste' debe ser el de viewer/contraste.js ` +
        `(visor.diagnostico.contraste); recibido ${typeof contraste}.`,
    )
  }
  if (!panel || typeof panel.avisar !== 'function') {
    throw new TypeError(
      `cablearDiagnostico: 'panel' debe ser el panel de avisos (con 'avisar'); recibido ` +
        `${typeof panel}. Sin él, un fallo interno del cálculo no tendría dónde contarse.`,
    )
  }
  if (catastro !== null && !esCatastro(catastro)) {
    throw new TypeError(
      `cablearDiagnostico: 'catastro' debe ser el cableado de app/cableado-catastro.js ` +
        `(con colindantes y alColindantes), o null para no consultar vecinas; recibido ` +
        `${typeof catastro}.`,
    )
  }

  let destruido = false

  /**
   * Las vecinas traducidas, o `null`. **`null` = NO SE HA CONSULTADO**, que es
   * distinto de `[]` = se consultó y no hay ninguna, y esa distinción viaja intacta
   * hasta el cajón: es lo que separa «no hay invasión» de «no lo he mirado».
   *
   * @type {Array<{refcat: string|null, recintos: Array}>|null}
   */
  let vecinas = null

  /** Qué parcela había la última vez, para detectar que ha entrado otra. */
  let clave = claveDeExpediente(estado.get())

  /** Una consulta de vecinas en vuelo, para no encabalgar dos aperturas. */
  let pidiendo = false

  // ── Escritura en la cáscara ────────────────────────────────────────────────

  /**
   * Escribe el renglón del CTA. Vacío + sin modificador es «no ha pasado nada
   * todavía»: el CSS lo colapsa (`:empty`) y el pie no da un salto.
   *
   * @param {string} texto
   * @param {boolean} fallo
   */
  function decir(texto, fallo) {
    renglon.textContent = texto
    renglon.classList.toggle(CLASE_ESTADO_ERROR, fallo)
  }

  /**
   * Estado del CTA. Es a la vez el suscriptor del store y lo que se llama al acabar
   * cada consulta, así que la regla vive en UN solo sitio.
   *
   * ── POR QUÉ EL MOTIVO SOLO SE ESCRIBE CON EL RENGLÓN VACÍO ──
   * Calcado de `cableado-catastro.js#refrescar`, y por lo mismo: esto corre en cada
   * `set` del store —o sea, en cada vértice que F06 mueva—, y escribir sin
   * condición borraría el desenlace de la última acción un instante después de
   * haberlo puesto. El renglón VACÍO es el único estado que no es de nadie, y es
   * justo el que se ve al abrir la app con el botón ya gris.
   *
   * @param {object|null} parcelaActual
   */
  function refrescarBoton(parcelaActual) {
    const sinOficial = !puedeDiagnosticar(parcelaActual)
    boton.disabled = sinOficial
    if (sinOficial && renglon.textContent === '') decir(MOTIVO_SIN_OFICIAL, false)
  }

  // ── El cálculo ─────────────────────────────────────────────────────────────

  /**
   * Recalcula y repinta las DOS vistas. No hace nada con el cajón cerrado: medir
   * para no enseñarlo cuesta los mismos ~67 ms y no lo mira nadie.
   *
   * Un fallo aquí es un defecto de programación (los datos malos del usuario los
   * traduce `diagnosticar` a `saltados` y a `omisiones`, no a excepciones), así que
   * se cuenta como tal —panel con `NIVEL.ERROR` y consola— y **no se deja subir**:
   * este camino se alcanza desde un suscriptor del store, y dejar reventar ahí
   * tumbaría también a los otros suscriptores, que no tienen la culpa.
   */
  function recalcular() {
    if (destruido || !cajon.abierto()) return
    const parcelaActual = estado.get()
    const recintos = recintosDe(parcelaActual)
    const geometriaOficial = oficialDe(parcelaActual)

    if (recintos.length === 0) {
      cajon.pintar(null)
      contraste.pintar(null)
      cajon.estado('No hay geometría que diagnosticar.')
      return
    }

    try {
      const d = diagnosticar({
        recintos,
        geometriaOficial,
        superficieCatastral:
          typeof parcelaActual.superficieCatastral === 'number'
            ? parcelaActual.superficieCatastral
            : null,
        superficieRegistral: cajon.registral(),
        vecinas,
        clase: cajon.clase(),
        // Para PROPONER la clase cuando nadie la ha elegido. Sin normalizar: la del
        // modelo ya viene del Catastro o la ha escrito el usuario, y
        // `diagnostico/margen.js` reconoce las dos formas.
        refcat: typeof parcelaActual.refcat === 'string' ? parcelaActual.refcat : null,
      })
      cajon.pintar(d)
      contraste.pintar(d, { recintos, geometriaOficial })
    } catch (causa) {
      cajon.estado('El diagnóstico ha fallado. Mira el panel de avisos.')
      panel.avisar(MENSAJE_FALLO_INESPERADO, { nivel: NIVEL.ERROR, causa })
      console.error('cablearDiagnostico: fallo al diagnosticar', causa)
    }
  }

  // ── Las colindantes ────────────────────────────────────────────────────────

  /**
   * Adopta las vecinas de un resultado del Catastro y repinta si el cajón está
   * abierto. Es el ÚNICO camino por el que `vecinas` deja de ser `null`, y por eso
   * se llega a él tanto desde la petición propia como desde el botón «Traer
   * colindantes» de F05: quien ya las trajo no tiene que traerlas otra vez.
   *
   * @param {import('../services/catastro.js').ResultadoCatastro} resultado
   */
  function adoptar(resultado) {
    if (destruido) return
    if (!resultado || !resultado.ok || !resultado.datos) return
    vecinas = aVecinas(resultado.datos.colindantes)
    recalcular()
  }

  /**
   * UNA petición de vecinas, y solo si no las hay. El resto de casos —ya
   * consultadas, sin cliente, otra petición en vuelo— salen por arriba sin tocar la
   * red: una apertura, una petición (override O8).
   *
   * **El diagnóstico ya está pintado antes de llamar a esto**, así que un fallo
   * aquí solo escribe el renglón. Es la regla que este módulo defiende: un fallo de
   * red no puede tumbar las ocho medidas que no dependen de la red.
   */
  async function pedirVecinas() {
    if (destruido || vecinas !== null || pidiendo) return
    if (catastro === null) {
      decir(MOTIVO_SIN_CATASTRO, false)
      return
    }
    pidiendo = true
    try {
      // La adopción y el repintado llegan por `alColindantes` (el cableado de F05
      // publica ANTES de devolver), así que aquí solo queda contar el desenlace. Un
      // segundo camino de adopción desde este `resultado` traduciría dos veces lo
      // mismo y dejaría dos sitios donde equivocarse.
      const resultado = await catastro.colindantes()
      if (destruido) return
      if (resultado === null) return
      if (!resultado.ok) {
        // El motivo largo ya lo ha contado el cableado de F05 por su renglón y por
        // el panel. Aquí se dice lo ÚNICO que este módulo sabe y aquel no: que el
        // resto del diagnóstico sigue en pie.
        decir(COLA_SIN_VECINAS, true)
        cajon.estado('Invasión a colindantes: no se ha podido consultar.')
      }
    } catch (causa) {
      // `colindantes()` propaga los fallos INESPERADOS (los del catálogo salen por
      // `ok:false`). Ya se han contado por tres canales en F05; aquí solo se cierra
      // el renglón para que el usuario no se quede mirando un cajón a medias.
      decir(COLA_SIN_VECINAS, true)
      cajon.estado('Invasión a colindantes: no se ha podido consultar.')
      console.error('cablearDiagnostico: fallo al pedir las colindantes', causa)
    } finally {
      pidiendo = false
    }
  }

  /**
   * Abre el cajón, pinta con lo que hay y **después** pide las vecinas si faltan.
   * Ese orden es la decisión: el usuario ve las ocho medidas al instante y la
   * invasión aparece cuando llega, en vez de mirar un cajón vacío mientras la red
   * trabaja.
   *
   * @param {Event|null} [evento=null]  El clic que lo está abriendo, si viene de
   *   uno. Se le pasa al cajón para que su guardián del clic fuera no cuente como
   *   «clic fuera» el mismo clic del CTA —que vive en el pie, o sea fuera— y lo
   *   cierre en el mismo gesto. Ver `viewer/cajon-diagnostico.js#_cerrarPorClicFuera`.
   * @returns {Promise<void>}
   */
  async function abrir(evento = null) {
    if (destruido) return
    if (!puedeDiagnosticar(estado.get())) {
      decir(MOTIVO_SIN_OFICIAL, false)
      return
    }
    decir('', false)
    cajon.abrir(evento)
    cajon.estado('')
    recalcular()
    await pedirVecinas()
  }

  // ── Oyentes ────────────────────────────────────────────────────────────────

  /**
   * El manejador suelta la promesa a propósito, igual que los cuatro de F05: lo que
   * puede fallar dentro ya se ha contado por el renglón, por el cajón y por la
   * consola antes de resolverse. Quien llama a `abrir()` desde la API sí recibe la
   * promesa.
   */
  const alPulsar = (evento) => {
    abrir(evento).catch(() => {})
  }

  /**
   * El suscriptor del store: UNA vez por operación acabada (ver la cabecera sobre
   * por qué no `alPrevisualizar`).
   *
   * @param {object|null} parcelaActual
   */
  function alCambiarElStore(parcelaActual) {
    if (destruido) return
    const nueva = claveDeExpediente(parcelaActual)
    if (nueva !== clave) {
      clave = nueva
      // Otra parcela: otro expediente, otras vecinas, otro diagnóstico. Ver la
      // cabecera sobre por qué se cierra en vez de recalcular.
      vecinas = null
      cajon.reiniciarExpediente()
      cajon.cerrar()
      contraste.pintar(null)
      decir('', false)
    }
    refrescarBoton(parcelaActual)
    recalcular()
  }

  boton.addEventListener('click', alPulsar)
  const desuscribirStore = estado.subscribe(alCambiarElStore)
  const bajaCambio = cajon.alCambiar(recalcular)
  // Al cerrar el cajón se limpia el mapa: las manchas y la cota son la MITAD del
  // diagnóstico, y dejarlas pintadas sobre un cajón cerrado sería dejar una
  // anotación sin su explicación.
  const bajaCierre = cajon.alCerrar(() => contraste.pintar(null))
  const bajaColindantes = catastro === null ? () => {} : catastro.alColindantes(adoptar)

  // `subscribe` NO notifica al suscribirse (ver `crearEstadoVista`): el primer
  // estado del botón se calcula a mano. Sin esta línea, el CTA se quedaría en el
  // `disabled` con el que nace en `index.html` hasta el primer cambio del store, y
  // quien abra la app con una parcela ya cargada vería gris justo el botón que le
  // hace falta.
  refrescarBoton(estado.get())

  return {
    abrir,
    recalcular,

    /**
     * Deja el cableado inerte: retira el oyente del CTA, la suscripción al store,
     * las dos del cajón y la de las colindantes, y **limpia el mapa**. IDEMPOTENTE.
     *
     * No destruye el cajón ni el contraste: son del VISOR y los desmonta
     * `visor.destruir()`. Este módulo desmonta lo que ha montado él, ni más ni
     * menos — la misma regla que hace que `crearVisor` sea atómico.
     */
    destruir() {
      if (destruido) return
      destruido = true
      boton.removeEventListener('click', alPulsar)
      desuscribirStore()
      bajaCambio()
      bajaCierre()
      bajaColindantes()
      contraste.pintar(null)
    },
  }
}
