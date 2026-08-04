// app/rail.js — Rework de UI · T5. EL RAIL: el primer llamante de `app/navegacion.js`.
//
// ── QUÉ ES ESTO, Y QUÉ NO ES ────────────────────────────────────────────────
// Es un **APLICADOR**: se suscribe a `app/navegacion.js` y pinta. No decide
// nada. Si te preguntas «¿por qué este paso está apagado?», la respuesta no está
// en este fichero — está en la tabla de guardas de `navegacion.js`, y este módulo
// se limita a enseñar el motivo que aquélla le entrega ya redactado.
//
// El reparto es el mismo que `app/rama.js` va a adoptar cuando se degrade:
//   · `app/navegacion.js` — dueño de `{rama, paso, modo}`, guardas y motivos. SIN DOM.
//   · `app/rail.js`       — DOM y nada más. Sin reglas, sin condiciones de negocio.
//
// ── POR QUÉ EXISTE EL RAIL, CON FECHA ───────────────────────────────────────
// `estilos/app.css:10-12` lo recortó en F03 con esta razón escrita: «ese rail
// navegaría a pantallas que todavía no existen, así que no se copia». **La razón
// caducó en F04** y nadie volvió a por él. Once fases después la aplicación tenía
// cinco recorridos distintos viviendo en la misma pantalla —traer del Catastro,
// medición propia, comprobar un GML ajeno, edificio, recuperar un expediente— sin
// que nada declarara en cuál estabas.
//
// ── EL MARCADO SE PARTE EN DOS, Y NO ES CAPRICHO ───────────────────────────
// `index.html` pone la CÁSCARA del rail (el `<nav>`, la marca, el `<ol>` vacío)
// porque es ESTRUCTURA, igual que el panel y el mapa. Este módulo fabrica los
// PELDAÑOS, porque su número, su orden y sus rótulos salen de `PASOS` y
// `ROTULO_PASO`: escribirlos a mano en el HTML sería una segunda lista que hay
// que acordarse de mantener a la par, y las segundas listas divergen. Mismo
// criterio que `app/rama.js` con su conmutador.
//
// ── ⛔ LA REGLA DURA, HEREDADA Y MEDIDA (`app/rama.js:24-40`) ───────────────
// **Un paso no disponible se APAGA: `disabled` en el botón y el motivo escrito al
// lado. JAMÁS se saca del `<ol>`.** Dos motivos, y el segundo es el caro:
//   1. Un rail que encoge y crece no deja aprender el recorrido, y aprenderlo es
//      justo lo que este rework persigue.
//   2. Sacar nodos del documento es lo que huerfaniza referencias en esta
//      aplicación: `app/cableado-*.js` resuelve sus nodos como valores por
//      defecto de parámetro —una vez, al montar— y escribir en un nodo
//      desconectado **no lanza**. Aquí todavía no hay cableado colgando de los
//      peldaños, pero la regla se cumple desde el primer día para que nadie
//      «optimice» quitándolos cuando sí lo haya.
//
// ── ⚠️ EL RAIL NO SE PINTA SOLO: `aria-current` Y `disabled` SON DEL DOM ────
// El aspecto sale de `data-rail-estado` en el `<li>` —UN atributo, un dueño,
// molde exacto del `data-rama` de `app/rama.js`— y **no** de `aria-current`. Dos
// fuentes para el mismo estado visible acaban divergiendo. `aria-current` y
// `disabled` siguen siendo obligatorios: son lo que oye el lector de pantalla y
// lo que impide que el tabulador se pare en un paso al que no se puede ir.
//
// ── MOVIMIENTO (`estilos/tokens/motion.css`, y corrige al plan) ────────────
// El plan del rework decía «sin animaciones». El sistema de diseño dice otra cosa
// y es más fina: **150 ms ease-in-out en hover, foco y color de estado**, y
// **nunca** en transiciones de página. Aplicado aquí: el peldaño responde al
// tocarlo, y el cambio de paso es instantáneo. Sin lo primero el rail se siente
// muerto; con lo segundo, lento.

import { NIVEL, resolverAvisar } from '../viewer/_comun.js'
import { PASOS, ROTULO_PASO } from './navegacion.js'

// ── El contrato de marcado ──────────────────────────────────────────────────
//
// Los literales los exporta este módulo, que es quien fabrica los peldaños.
// `estilos/app.css` se escribe contra estas cadenas y las CITA en su comentario.

// ⚠️ **LOS DOS SON SELECTORES DE ATRIBUTO `data-*` CON VALOR, Y NO ES ESTILO.**
// Hay un guardián —G16, en `test/services/contrato-catastro.test.js`— que recorre
// TODOS los `SELECTOR_*` exportados desde `app/` y exige dos cosas de cada uno:
// que sea `[data-algo="valor"]` y que case **exactamente un nodo** de
// `index.html`. La primera versión de este módulo usaba `.gml-rail` y
// `[data-rail-pasos]`, y las dos salieron rojas. La convención existe porque las
// clases son del CSS y los `data-*` son del CONTRATO: si un día alguien renombra
// una clase por estética, el cableado no se entera.

/** El `<nav>` de la cáscara. Lo pone `index.html`; este módulo NO lo fabrica. */
export const SELECTOR_RAIL = '[data-rail="cascara"]'

/** El `<ol>` que este módulo rellena. Nace vacío en `index.html`. */
export const SELECTOR_PASOS = '[data-rail="pasos"]'

/** `data-ir-a-paso="entrada"` en cada botón. Gemelo de `data-ir-a-rama`. */
export const ATRIBUTO_IR_A_PASO = 'data-ir-a-paso'

/**
 * `data-rail-estado="activo|libre|bloqueado"` en cada `<li>`. **Es el único
 * gancho de CSS del estado de un peldaño.**
 */
export const ATRIBUTO_ESTADO = 'data-rail-estado'

/** Los tres estados de un peldaño. @readonly */
export const ESTADO = Object.freeze({
  ACTIVO: 'activo',
  LIBRE: 'libre',
  BLOQUEADO: 'bloqueado',
})

/** Clases del marcado que este módulo fabrica. Las viste `estilos/app.css`. */
export const CLASE = Object.freeze({
  PASO: 'gml-rail-paso',
  BOTON: 'gml-rail-boton',
  PUNTO: 'gml-rail-punto',
  TEXTO: 'gml-rail-texto',
  ROTULO: 'gml-rail-rotulo',
  MOTIVO: 'gml-rail-motivo',
})

/** Selector de un peldaño concreto. @param {string} paso */
export const selectorPaso = (paso) => `[${ATRIBUTO_IR_A_PASO}="${paso}"]`

/**
 * Lo que se le dice al usuario si revienta algo colgado del cambio de paso.
 * Gemelo de `MENSAJE_CONMUTAR_ROTO` de `app/rama.js` y por el mismo motivo
 * MEDIDO: **una excepción lanzada dentro de un oyente del DOM no sale por
 * `dispatchEvent`**, ni en jsdom ni en el navegador, así que dejarla propagar
 * sería un error silencioso para el usuario.
 */
export const MENSAJE_NAVEGAR_ROTO =
  'Se ha cambiado de paso, pero algo que estaba pendiente del cambio se ha interrumpido por un ' +
  'fallo interno; lo que ves en pantalla puede no estar completo. El detalle técnico está en la ' +
  'consola del navegador.'

// ── Utilidades ──────────────────────────────────────────────────────────────

/** ¿Sirve como documento? DUCK TYPING, igual que `app/rama.js`: `Document` no
 *  existe como global bajo el proyecto Vitest `node`. @param {*} d */
const esDocumento = (d) =>
  !!d &&
  typeof d === 'object' &&
  typeof d.createElement === 'function' &&
  typeof d.querySelector === 'function'

/** ¿Sirve como elemento del DOM? @param {*} el */
const esElementoDOM = (el) =>
  !!el && typeof el === 'object' && typeof el.addEventListener === 'function' && el.nodeType === 1

/** ¿Sirve como la navegación de `app/navegacion.js`? Se piden las cuatro
 *  capacidades que este módulo usa, ni una más: así el test puede inyectar un
 *  doble sin construir la autoridad entera. @param {*} n */
const esNavegacion = (n) =>
  !!n &&
  typeof n === 'object' &&
  typeof n.get === 'function' &&
  typeof n.subscribe === 'function' &&
  typeof n.navegarAPaso === 'function' &&
  typeof n.rail === 'function'

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Rail
 * @property {() => void} repintar  Vuelve a pintar desde `navegacion.rail()`.
 *   Público porque los HECHOS pueden cambiar sin que cambie `{rama, paso, modo}`
 *   —cargar una parcela no te mueve de paso, pero abre tres— y en ese caso el
 *   store no notifica. Quien sabe que los hechos han cambiado es el llamante.
 * @property {() => void} destruir  Vacía el `<ol>`, retira los oyentes y se da de
 *   baja del store. IDEMPOTENTE.
 */

/**
 * Cablea el rail de navegación.
 *
 * Contrato roto por el PROGRAMADOR (falta el `<nav>`, falta el `<ol>`, no se pasa
 * una navegación) → `Error`/`TypeError`, igual que el resto del proyecto. Lo que
 * puede pasarle a un USUARIO —pulsar un paso al que no se puede ir, un suscriptor
 * que revienta— **nunca lanza**.
 *
 * @param {Object} opciones
 * @param {Document} opciones.documento  Se inyecta en vez de tomar el global:
 *   así el test lo mide y así funciona dentro de un iframe.
 * @param {object} opciones.navegacion  La de `app/navegacion.js`.
 * @param {Element} [opciones.contenedor]  El `<ol>`; se busca si no se da.
 * @param {object|null} [opciones.panel]  El de `app/avisos.js`, o `null`.
 * @param {((paso: string) => void)|null} [opciones.alNavegar]  Se llama DESPUÉS
 *   de pintar, con el paso ya activo. Es por donde `app/main.js` mete el
 *   `invalidateSize()` del mapa sin que este módulo sepa que hay un mapa.
 * @returns {Rail}
 */
export function cablearRail({ documento, navegacion, contenedor, panel = null, alNavegar = null } = {}) {
  if (!esDocumento(documento)) {
    throw new TypeError(
      `cablearRail: 'documento' debe ser un Document (o un objeto con createElement y ` +
        `querySelector); recibido ${typeof documento}. No se toma el global a propósito.`,
    )
  }
  if (!esNavegacion(navegacion)) {
    throw new TypeError(
      `cablearRail: 'navegacion' debe ser la autoridad de app/navegacion.js (con get, subscribe, ` +
        `navegarAPaso y rail); recibido ${typeof navegacion}.`,
    )
  }
  if (alNavegar !== null && typeof alNavegar !== 'function') {
    throw new TypeError(`cablearRail: 'alNavegar' debe ser una función o null; recibido ${typeof alNavegar}.`)
  }

  const lista = contenedor ?? documento.querySelector(SELECTOR_PASOS)
  if (!esElementoDOM(lista)) {
    throw new Error(
      `cablearRail: no se encuentra «${SELECTOR_PASOS}» en el documento. Es parte del contrato de ` +
        `marcado con index.html; sin él no hay dónde poner los pasos.`,
    )
  }

  const avisar = resolverAvisar(
    panel === null ? undefined : (mensaje, opciones) => panel.avisar(mensaje, opciones),
  )

  let destruido = false
  const oyentes = []
  /** Los nodos de cada paso, por paso. Se fabrican UNA vez y no se vuelven a
   *  crear: repintar escribe sobre ellos. Ver la regla dura de la cabecera. */
  const peldanos = new Map()

  const escuchar = (nodo, tipo, fn) => {
    nodo.addEventListener(tipo, fn)
    oyentes.push(() => nodo.removeEventListener(tipo, fn))
  }

  // ── Fabricar los peldaños, una sola vez ───────────────────────────────────

  for (const paso of PASOS) {
    const li = documento.createElement('li')
    li.className = CLASE.PASO
    li.setAttribute('data-paso', paso)

    const boton = documento.createElement('button')
    boton.type = 'button'
    boton.className = CLASE.BOTON
    boton.setAttribute(ATRIBUTO_IR_A_PASO, paso)

    const punto = documento.createElement('span')
    punto.className = CLASE.PUNTO
    // El punto es decorativo: lo que dice el estado al lector de pantalla son
    // `aria-current` y `disabled`, no una viñeta.
    punto.setAttribute('aria-hidden', 'true')

    const texto = documento.createElement('span')
    texto.className = CLASE.TEXTO

    const rotulo = documento.createElement('span')
    rotulo.className = CLASE.ROTULO
    rotulo.textContent = ROTULO_PASO[paso]

    // El motivo vive DENTRO del botón a propósito: así el lector de pantalla lo
    // anuncia como parte del nombre del control, sin `aria-describedby` ni un
    // `id` que habría que inventar (y que colisionaría entre pantallas ocultas).
    const motivo = documento.createElement('span')
    motivo.className = CLASE.MOTIVO

    texto.append(rotulo, motivo)
    boton.append(punto, texto)
    li.append(boton)
    lista.append(li)

    peldanos.set(paso, { li, boton, rotulo, motivo })
    escuchar(boton, 'click', alPulsar)
  }

  // ── Pintar ────────────────────────────────────────────────────────────────

  /**
   * Lleva `navegacion.rail()` a la pantalla. Idempotente: pintar dos veces lo
   * mismo no cambia nada. **No crea ni destruye ni un nodo**: solo escribe
   * atributos y texto.
   */
  function pintar() {
    if (destruido) return
    for (const peldano of navegacion.rail()) {
      const nodos = peldanos.get(peldano.paso)
      // Un paso que la autoridad conoce y este rail no habría que fabricarlo, y
      // fabricar nodos fuera del montaje es justo lo que la regla dura prohíbe.
      // No puede pasar —los dos leen `PASOS`— y si pasara, callarlo sería peor.
      if (nodos === undefined) continue

      const estado = peldano.activo
        ? ESTADO.ACTIVO
        : peldano.disponible
          ? ESTADO.LIBRE
          : ESTADO.BLOQUEADO
      nodos.li.setAttribute(ATRIBUTO_ESTADO, estado)

      // ⛔ Apagado, NUNCA quitado. Y `disabled` es lo que impide que el
      // tabulador se pare en un paso al que no se puede ir.
      nodos.boton.disabled = !peldano.disponible
      if (peldano.activo) nodos.boton.setAttribute('aria-current', 'step')
      else nodos.boton.removeAttribute('aria-current')

      nodos.rotulo.textContent = peldano.rotulo
      // Regla de la casa: paso apagado CON MOTIVO, jamás paso muerto. El motivo
      // llega ya redactado desde la autoridad; aquí no se escribe ni una palabra.
      nodos.motivo.textContent = peldano.disponible ? '' : (peldano.motivo ?? '')
      nodos.motivo.hidden = peldano.disponible
    }
  }

  /** @param {Event} evento */
  function alPulsar(evento) {
    if (destruido) return
    evento.preventDefault()
    const destino = evento.currentTarget.getAttribute(ATRIBUTO_IR_A_PASO)
    try {
      // La autoridad decide. Si dice que no —no debería, el botón estaría
      // `disabled`— no se navega y el motivo ya está en pantalla.
      const desenlace = navegacion.navegarAPaso(destino)
      if (desenlace.ok && alNavegar !== null) alNavegar(desenlace.paso)
    } catch (causa) {
      // Ver {@link MENSAJE_NAVEGAR_ROTO}: una excepción dentro de un oyente del
      // DOM no sale por `dispatchEvent`, así que dejarla propagar sería mudo.
      avisar(MENSAJE_NAVEGAR_ROTO, { nivel: NIVEL.ERROR, causa })
      console.error('[rail] el cambio de paso ha fallado de forma inesperada:', causa)
    }
  }

  // El DOM, antes que nadie de fuera. `subscribe` no notifica al suscribirse
  // (contrato de `crearEstadoVista`), así que la primera pintada va a mano.
  const baja = navegacion.subscribe(pintar)
  pintar()

  return {
    repintar: pintar,

    destruir() {
      if (destruido) return
      destruido = true
      baja()
      for (const quitar of oyentes) quitar()
      oyentes.length = 0
      // Aquí SÍ se vacía la lista, y no contradice la regla dura: estos nodos los
      // fabricó este módulo y nadie de fuera guarda una referencia a ellos. Es la
      // misma simetría que `app/rama.js` con su conmutador: lo que pone, lo quita.
      for (const { li } of peldanos.values()) li.remove()
      peldanos.clear()
    },
  }
}

export default cablearRail
