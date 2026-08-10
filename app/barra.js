// app/barra.js — Topbar · rebanada 1. LA BARRA DE RECORRIDO, y el único pintor.
//
// ── ⭐ ESTE FICHERO SE LLAMABA `app/rail.js` HASTA EL 2026-08-10 ────────────
// El rail era una COLUMNA de 210 px a la izquierda. Ahora es una BARRA de arriba,
// y el giro no es cosmético: **le devuelve al mapa 210 px de ancho** (678 → 888
// medidos a 1280×720) y convierte la lista de pasos en lo que el autor pidió, «una
// especie de diagrama de flujo que indica en qué paso vas».
//
// El nombre cambia porque la responsabilidad creció: además de los peldaños, este
// módulo pinta el **renglón de motivo** que va debajo, y en la rebanada 3 pintará
// el estado del botón de entrega. Un fichero llamado `rail.js` que gobierna tres
// cosas es exactamente el nombre rancio que este proyecto lleva pagando.
//
// ── ⚠️ LAS CLASES SIGUEN SIENDO `gml-rail-*`, Y NO ES DESIDIA ──────────────
// **`gml-barra-*` YA ESTÁ COGIDO** por `viewer/barra-edicion.js`: `.gml-barra-edicion`,
// `.gml-barra-herramienta`, `.gml-barra-partido`, `.gml-barra-conmutador`,
// `.gml-barra-desplegable`… son suyas y viven sobre el mapa. Renombrar aquí a ese
// prefijo pondría dos componentes distintos bajo el mismo espacio de nombres de CSS,
// y la colisión no la avisa nadie: se ve un día como un botón con el fondo raro.
// El contrato de marcado con `index.html` (`data-rail="cascara"`, `data-rail="pasos"`)
// se conserva por el mismo motivo por el que se conserva cualquier contrato: no hay
// ninguna ganancia en renombrarlo y sí un guion de humo que lo busca.
//
// ── QUÉ ES ESTO, Y QUÉ NO ES ────────────────────────────────────────────────
// Es un **APLICADOR**: se suscribe a `app/navegacion.js` y pinta. No decide nada y
// **no escribe ni una palabra en español para el usuario** —hay un test que lo
// afirma recorriendo los literales de este fichero—. Si te preguntas «¿por qué este
// paso está apagado?», la respuesta está en la tabla de guardas de `navegacion.js`.
//
// ── ⛔ UN SOLO `repintar()`, Y ES LA DECISIÓN A1 DE LA REVISIÓN ────────────
// `navegacion.js` **no notifica cuando cambian los HECHOS** —cargar una parcela no
// te mueve de paso, pero abre dos—, así que `app/main.js#refrescarHechos` tiene que
// repintar a mano. Partir esto en dos módulos (peldaños por un lado, renglón por
// otro) serían **dos llamadas que recordar**, y olvidar una deja un motivo rancio en
// pantalla sin lanzar nada: el fallo silencioso perfecto. Un módulo, un `repintar()`.
//
// ── EL MARCADO SE PARTE EN DOS, Y NO ES CAPRICHO ───────────────────────────
// `index.html` pone la CÁSCARA (el `<nav>`, la marca, el rótulo del grupo, el `<ol>`
// vacío) porque es ESTRUCTURA. Este módulo fabrica los PELDAÑOS —su número, su orden
// y sus rótulos salen de `PASOS` y `ROTULO_PASO`— y el RENGLÓN.
//
// ⚠️ **El renglón se fabrica aquí y NO se declara en `index.html` a propósito.** Dos
// razones, y la segunda es dura: (1) sin cableado no tiene nada que decir, así que
// escribirlo en el HTML lo enseñaría vacío durante el instante anterior al montaje;
// (2) **G16** —`test/services/contrato-catastro.test.js`— exige que todo `SELECTOR_*`
// exportado desde `app/` case exactamente un nodo de UNA de sus tres fuentes
// conocidas, y un cuarto origen saldría rojo. Por eso este módulo exporta selector
// de lo que RECIBE ({@link SELECTOR_BARRA}, {@link SELECTOR_PASOS}) y de nada de lo
// que fabrica, igual que hacía `rail.js` con los peldaños.
//
// ── ⛔ LA REGLA DURA, HEREDADA Y MEDIDA (`app/rama.js:24-40`) ───────────────
// **Un paso no disponible se APAGA: `disabled` en el botón y el motivo escrito al
// lado. JAMÁS se saca del `<ol>`.** Dos motivos, y el segundo es el caro:
//   1. Una barra que encoge y crece no deja aprender el recorrido, y aprenderlo es
//      justo lo que este rework persigue. En horizontal es peor todavía: sacar un
//      peldaño MUEVE a los demás de sitio.
//   2. Sacar nodos del documento es lo que huerfaniza referencias en esta
//      aplicación: `app/cableado-*.js` resuelve sus nodos como valores por defecto
//      de parámetro —una vez, al montar— y escribir en un nodo desconectado **no
//      lanza**.
//
// ── ⚠️ EL ESTADO SE PINTA DESDE `data-rail-estado` Y DE NINGÚN OTRO SITIO ──
// Ni desde `aria-current`, ni desde `:disabled`, ni desde una clase modificadora.
// UN atributo, un dueño — molde exacto del `data-rama` de `app/rama.js`. Dos fuentes
// para el mismo estado visible acaban divergiendo, y la que se queda atrás es
// siempre la de accesibilidad. `aria-current` y `disabled` siguen siendo
// obligatorios: son lo que oye el lector de pantalla y lo que impide que el
// tabulador se pare en un paso al que no se puede ir.
//
// ── ⭐ EL MOTIVO SE DICE EN DOS SITIOS Y EN DOS LARGOS ───────────────
// El giro a horizontal le quitó al motivo los tres renglones de 210 px que tenía
// (**40,5 px medidos** el 2026-08-09 con la aplicación vacía). La salida NO es
// recortar la frase —«Trae antes una parcela: por refe…» no es un motivo—, y
// tampoco es el renglón único que proponía la decisión D9 del diseño: la revisión
// externa la revocó al medir que hoy **se leen todos los motivos a la vez**, y un
// renglón solo dice uno. Lo que hay es una escalera:
//
//   1. **Pegado al peldaño, la forma BREVE** («Falta la parcela»). Todos a la vez,
//      que es lo que se salvó. La redacta `navegacion.js#MOTIVO_BREVE`.
//   2. **En el `title` del botón, la forma LARGA de ESE peldaño**, que es la que
//      dice CÓMO se resuelve. Responde «¿y este otro, por qué?» sin cambiar de
//      paso, y sale gratis: `title` ya es un mecanismo del navegador y del lector
//      de pantalla, sin inventar un patrón de texto oculto ni un `id` que
//      colisione entre pantallas.
//
// ⚠️ **Hubo un tercer peldaño en esta escalera y se retiró el 2026-08-10**: un
// renglón que cruzaba la barra entera con la forma LARGA del obstáculo más
// cercano. Lo pidió fuera el autor, y al revisarlo el motivo se sostenía solo: la
// forma larga ya estaba en el `title`, el acuse de la entrega ya estaba en el pie
// del panel —se veía DUPLICADO en pantalla en cuanto se descargaba un GML— y por
// repetirse cobraba 19 px de alto a la ventana entera. La decisión A1 no cambia:
// esta barra sigue teniendo UN solo `repintar()`.


import { NIVEL, resolverAvisar } from '../viewer/_comun.js'
import { PASOS, ROTULO_PASO } from './navegacion.js'

// ── El contrato de marcado ──────────────────────────────────────────────────
//
// Los literales los exporta este módulo, que es quien fabrica los peldaños.
// `estilos/app.css` se escribe contra estas cadenas y las CITA en su comentario.

// ⚠️ **LOS DOS SON SELECTORES DE ATRIBUTO `data-*` CON VALOR, Y NO ES ESTILO.**
// Ver G16 en la cabecera. La primera versión de este módulo usaba `.gml-rail` y
// `[data-rail-pasos]`, y las dos salieron rojas. La convención existe porque las
// clases son del CSS y los `data-*` son del CONTRATO: si un día alguien renombra
// una clase por estética, el cableado no se entera.

/** El `<nav>` de la cáscara. Lo pone `index.html`; este módulo NO lo fabrica. */
export const SELECTOR_BARRA = '[data-rail="cascara"]'

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

// ── Los menús de la barra (topbar · rebanadas 2 y 3) ────────────────────────
//
// ⚠️ **NO se exportan como `SELECTOR_*` a propósito.** G16 exige que todo
// `SELECTOR_*` de `app/` case EXACTAMENTE UN nodo, y estos casan uno POR MENÚ:
// hay dos y va a haber más. Se exportan como ATRIBUTO, que es lo que son.

/** `data-menu-disparador="expediente"` en el botón que abre. */
export const ATRIBUTO_DISPARADOR = 'data-menu-disparador'

/** `data-menu="expediente"` en el desplegable. El valor casa con el de arriba. */
export const ATRIBUTO_MENU = 'data-menu'

/**
 * Dónde se escribe el nombre del expediente abierto y su apunte. Los pone
 * `index.html`; este módulo los rellena desde `estado()` del cableado.
 */
export const ATRIBUTO_BARRA = 'data-barra'

/**
 * Lo que se lee en la zona de expediente cuando no hay ninguno archivado, que es
 * el caso normal al abrir la aplicación. Se exporta para que el test lo afirme
 * sin copiar el literal, igual que los motivos de `app/navegacion.js`.
 *
 * ⚠️ Dice «Sin expediente» y no «Expediente», porque la zona tiene que decir un
 * ESTADO y no un rótulo: un cajón que pone «Expediente» y no dice cuál es la
 * clase de interfaz que obliga a abrirlo para saber si hay algo dentro.
 *
 * @readonly
 */
export const EXPEDIENTE_VACIO = Object.freeze({
  nombre: 'Sin expediente',
  apunte: 'Nada que guardar todavía',
})

/** Y cuando hay trabajo en pantalla que todavía no se ha archivado con nombre. */
export const EXPEDIENTE_SIN_NOMBRE = Object.freeze({
  nombre: 'Sin guardar',
  apunte: 'Se autoguarda; archívalo para conservarlo',
})

/**
 * Lo que se le dice al usuario si revienta algo colgado del cambio de paso.
 * Gemelo de `MENSAJE_CONMUTAR_ROTO` de `app/rama.js` y por el mismo motivo
 * MEDIDO: **una excepción lanzada dentro de un oyente del DOM no sale por
 * `dispatchEvent`**, ni en jsdom ni en el navegador, así que dejarla propagar
 * sería un error silencioso para el usuario.
 *
 * ⚠️ Es el ÚNICO literal en español de este fichero, y es una excepción
 * consciente a la regla de la cabecera: no describe una regla de negocio —eso lo
 * redacta la autoridad—, describe que ESTE módulo se ha roto.
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

/**
 * Un texto que se pueda pintar, o `''`. Cualquier cosa que no sea una cadena con
 * algo dentro se trata como «no hay motivo»: el productor de la entrega es de
 * otro módulo y devolver `undefined`, `null` o `{}` no puede acabar escribiendo
 * «undefined» en la barra del usuario.
 *
 * @param {*} valor
 * @returns {string}
 */
const textoDe = (valor) => (typeof valor === 'string' ? valor.trim() : '')

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Barra
 * @property {() => void} repintar  Vuelve a pintar desde `navegacion.rail()` y
 *   desde el productor del motivo de entrega. Público porque los HECHOS pueden
 *   cambiar sin que cambie `{rama, paso}` —cargar una parcela no te mueve de paso,
 *   pero abre dos— y en ese caso el store no notifica. Quien sabe que los hechos
 *   han cambiado es el llamante. **Es el ÚNICO repintado de la barra** (decisión
 *   A1): si algún día hay que llamar a dos, la decisión se ha roto.
 * @property {() => void} destruir  Vacía el `<ol>`, retira el renglón y los
 *   oyentes, y se da de baja del store. IDEMPOTENTE.
 */

/**
 * Cablea la barra de recorrido.
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
 * @param {Element} [opciones.cascara]  El `<nav>` de la barra; se busca si no se
 *   da. Desde que el renglón de motivo se retiró (2026-08-10) este módulo no
 *   cuelga nada de él, pero se sigue admitiendo porque es el ancla de los menús y
 *   el nodo que `destruir()` tiene que dejar como lo encontró.
 * @param {object|null} [opciones.panel]  El de `app/avisos.js`, o `null`.
 * @param {((paso: string) => void)|null} [opciones.alNavegar]  Se llama DESPUÉS
 *   de pintar, con el paso ya activo. Es por donde `app/main.js` mete el
 *   `invalidateSize()` del mapa sin que este módulo sepa que hay un mapa.
 * @returns {Barra}
 */
export function cablearBarra({
  documento,
  navegacion,
  contenedor,
  cascara,
  panel = null,
  alNavegar = null,
  expediente = null,
} = {}) {
  if (!esDocumento(documento)) {
    throw new TypeError(
      `cablearBarra: 'documento' debe ser un Document (o un objeto con createElement y ` +
        `querySelector); recibido ${typeof documento}. No se toma el global a propósito.`,
    )
  }
  if (!esNavegacion(navegacion)) {
    throw new TypeError(
      `cablearBarra: 'navegacion' debe ser la autoridad de app/navegacion.js (con get, subscribe, ` +
        `navegarAPaso y rail); recibido ${typeof navegacion}.`,
    )
  }
  if (alNavegar !== null && typeof alNavegar !== 'function') {
    throw new TypeError(`cablearBarra: 'alNavegar' debe ser una función o null; recibido ${typeof alNavegar}.`)
  }
  if (expediente !== null && typeof expediente !== 'function') {
    throw new TypeError(
      `cablearBarra: 'expediente' debe ser una función o null; recibido ${typeof expediente}. Es ` +
        `el \`estado()\` de app/cableado-expediente.js, y se lee en CADA pintada por lo mismo ` +
        `que el motivo de entrega: una foto guardada se queda rancia.`,
    )
  }

  const lista = contenedor ?? documento.querySelector(SELECTOR_PASOS)
  if (!esElementoDOM(lista)) {
    throw new Error(
      `cablearBarra: no se encuentra «${SELECTOR_PASOS}» en el documento. Es parte del contrato de ` +
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

    // El motivo BREVE vive DENTRO del botón a propósito: así el lector de pantalla
    // lo anuncia como parte del nombre del control, sin `aria-describedby` ni un
    // `id` que habría que inventar (y que colisionaría entre pantallas ocultas).
    // El LARGO va al `title` del mismo botón; ver la escalera de la cabecera.
    const motivo = documento.createElement('span')
    motivo.className = CLASE.MOTIVO

    texto.append(rotulo, motivo)
    boton.append(punto, texto)
    li.append(boton)
    lista.append(li)

    peldanos.set(paso, { li, boton, rotulo, motivo })
    escuchar(boton, 'click', alPulsar)
  }

  // ⛔ **AQUÍ SE FABRICABA EL RENGLÓN DE MOTIVO, y se retiró el 2026-08-10.**
  // Era un `<p aria-live="polite">` colgado del `<nav>` que decía la forma LARGA
  // del obstáculo más cercano, o el acuse de la entrega cuando lo había. Lo pidió
  // fuera el autor, y al revisarlo el motivo se sostenía solo: **las dos cosas que
  // decía tenían ya otra superficie** —el `title` del peldaño para la larga, el
  // pie del panel para el acuse—, así que era un segundo sitio para lo mismo
  // cobrando 19 px de alto a la ventana entera. Con un GML descargado la misma
  // frase se veía dos veces a la vez.
  //
  // Lo ÚNICO que se perdió, y se anota para que quien lo eche en falta sepa qué
  // buscar: el acuse de «Generar GML» solo se ve donde vive su pie. Por eso el
  // mismo cambio lo sacó de `.gml-acciones[data-pantalla="edicion"]` y lo dejó
  // colgando del `<footer>`, visible en los tres pasos igual que su botón.

  // ── Pintar ────────────────────────────────────────────────────────────────

  /**
   * Lleva `navegacion.rail()` —y el motivo de entrega, si lo hay— a la pantalla.
   * Idempotente: pintar dos veces lo mismo no cambia nada. **No crea ni destruye
   * ni un nodo**: solo escribe atributos y texto.
   */
  function pintar() {
    if (destruido) return
    pintarExpediente()

    for (const peldano of navegacion.rail()) {
      const nodos = peldanos.get(peldano.paso)
      // Un paso que la autoridad conoce y esta barra no habría que fabricarlo, y
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

      // Regla de la casa: paso apagado CON MOTIVO, jamás paso muerto. Las dos
      // redacciones llegan ya escritas desde la autoridad; aquí no se escribe ni
      // una palabra y tampoco se recorta ninguna.
      const largo = peldano.disponible ? '' : textoDe(peldano.motivo)
      const breve = peldano.disponible ? '' : textoDe(peldano.breve) || largo

      nodos.motivo.textContent = breve
      nodos.motivo.hidden = breve === ''
      if (largo === '') nodos.boton.removeAttribute('title')
      else nodos.boton.title = largo
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
      console.error('[barra] el cambio de paso ha fallado de forma inesperada:', causa)
    }
  }

  // ── Los menús desplegables ────────────────────────────────────────────────
  //
  // Viven aquí y no en un módulo propio por la MISMA decisión A1 que junta los
  // peldaños y el renglón: la barra tiene un dueño. Un `app/barra-menus.js`
  // aparte sería un segundo módulo con oyentes sobre los mismos nodos, y el día
  // que uno se destruya y el otro no, los oyentes huérfanos siguen disparando.
  //
  // ⚠️ **Solo uno abierto a la vez.** Dos menús abiertos sobre una barra de 52 px
  // se tapan entre ellos, y el de la derecha nace pegado al borde de la ventana.

  /** @type {Element|null} El disparador del menú abierto, o `null`. */
  let menuAbierto = null

  /** @param {string} nombre @returns {Element|null} */
  const menuDe = (nombre) => documento.querySelector(`[${ATRIBUTO_MENU}="${nombre}"]`)

  /** Cierra el que haya, si lo hay. **Idempotente y sin devolver el foco**: quien
   *  quiera devolverlo lo pide, porque cerrar por clic fuera no debe robar foco.
   *  @param {{devolverFoco?: boolean}} [opciones] */
  function cerrarMenus({ devolverFoco = false } = {}) {
    if (menuAbierto === null) return
    const nombre = menuAbierto.getAttribute(ATRIBUTO_DISPARADOR)
    const panelMenu = menuDe(nombre)
    if (panelMenu !== null) panelMenu.hidden = true
    menuAbierto.setAttribute('aria-expanded', 'false')
    const disparador = menuAbierto
    menuAbierto = null
    if (devolverFoco && typeof disparador.focus === 'function') disparador.focus()
  }

  /** @param {Element} disparador */
  function abrirMenu(disparador) {
    const nombre = disparador.getAttribute(ATRIBUTO_DISPARADOR)
    const panelMenu = menuDe(nombre)
    // Un disparador sin su menú es contrato de marcado roto. No se lanza —el
    // usuario ha pulsado un botón, no ha programado nada— pero se dice donde lo
    // ve quien programa, que si no es un botón que no hace nada y no se sabe.
    if (panelMenu === null) {
      console.error(`[barra] el disparador «${nombre}» no tiene menú «[${ATRIBUTO_MENU}=…]».`)
      return
    }
    cerrarMenus()
    panelMenu.hidden = false
    disparador.setAttribute('aria-expanded', 'true')
    menuAbierto = disparador
    const primera = panelMenu.querySelector('[role="menuitem"]:not([disabled])')
    if (primera !== null && typeof primera.focus === 'function') primera.focus()
  }

  for (const disparador of documento.querySelectorAll(`[${ATRIBUTO_DISPARADOR}]`)) {
    escuchar(disparador, 'click', (evento) => {
      evento.preventDefault()
      evento.stopPropagation()
      if (menuAbierto === disparador) cerrarMenus({ devolverFoco: true })
      else abrirMenu(disparador)
    })
  }

  // Un clic en cualquier otro sitio cierra. `capture: false` y en el `document`:
  // así las acciones de dentro del menú llegan a su propio oyente ANTES de que
  // esto lo cierre, que es lo que permite que pulsar una opción funcione.
  escuchar(documento, 'click', (evento) => {
    if (menuAbierto === null) return
    const panelMenu = menuDe(menuAbierto.getAttribute(ATRIBUTO_DISPARADOR))
    if (panelMenu !== null && panelMenu.contains(evento.target)) return
    if (menuAbierto.contains(evento.target)) return
    cerrarMenus()
  })

  // `Escape` cierra Y devuelve el foco: quien lo pulsa está en el menú, y dejarle
  // el foco en el `<body>` le obliga a tabular desde el principio de la página.
  escuchar(documento, 'keydown', (evento) => {
    if (evento.key !== 'Escape' || menuAbierto === null) return
    evento.stopPropagation()
    cerrarMenus({ devolverFoco: true })
  })

  // ── La zona de expediente ─────────────────────────────────────────────────

  const nodoNombre = documento.querySelector(`[${ATRIBUTO_BARRA}="expediente-nombre"]`)
  const nodoApunte = documento.querySelector(`[${ATRIBUTO_BARRA}="expediente-apunte"]`)

  /**
   * Lleva el estado del expediente a la barra. Se llama desde `pintar()`, o sea
   * desde el ÚNICO `repintar()` de la barra (decisión A1).
   *
   * ⚠️ **Lee de `estado()` y no del store**: quien sabe qué expediente hay abierto
   * es `app/cableado-expediente.js`, que ya publicaba `nombreAbierto` y
   * `puedeGuardar` para el guion 12. Reconstruirlo aquí desde el modelo sería una
   * segunda definición de «qué expediente tengo», y las segundas definiciones
   * divergen.
   */
  function pintarExpediente() {
    if (nodoNombre === null || nodoApunte === null) return
    const foto = expediente === null ? null : expediente()
    if (foto === null || typeof foto !== 'object') {
      nodoNombre.textContent = EXPEDIENTE_VACIO.nombre
      nodoApunte.textContent = EXPEDIENTE_VACIO.apunte
      return
    }
    const nombre = typeof foto.nombreAbierto === 'string' ? foto.nombreAbierto.trim() : ''
    if (nombre !== '') {
      nodoNombre.textContent = nombre
      nodoApunte.textContent = foto.puedeGuardar === true ? 'Guardado en este navegador' : ''
      return
    }
    // Sin nombre hay dos casos y **no dicen lo mismo**: o no hay nada (la app
    // recién abierta) o hay trabajo sin archivar. Confundirlos le diría a quien
    // lleva media hora midiendo que no tiene nada.
    const hayTrabajo = foto.puedeGuardar === true
    const cual = hayTrabajo ? EXPEDIENTE_SIN_NOMBRE : EXPEDIENTE_VACIO
    nodoNombre.textContent = cual.nombre
    nodoApunte.textContent = cual.apunte
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
      cerrarMenus()
      for (const { li } of peldanos.values()) li.remove()
      peldanos.clear()
    },
  }
}

export default cablearBarra
