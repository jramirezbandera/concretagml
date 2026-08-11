// app/dialogo-diccionario.js — F15 · «Me han rechazado el fichero».
//
// ── QUÉ CIERRA ESTE FICHERO ─────────────────────────────────────────────────
// `config/errores-ivg.json` traduce lo que devuelve la Sede. Esta es la pantalla
// donde el técnico lo consulta: pega el mensaje del IVG o del ICUC y lee qué
// significa, qué suele haberlo causado y qué hacer.
//
// Sin ella, la ficha de F15 se cumpliría al pie de la letra —el JSON existe y
// una función lo busca— y **el usuario no tendría ninguna forma de llegar al
// dato**. Este repositorio lleva varias piezas escritas y en verde que pasaron
// fases enteras sin llamante (`model/edificio.js` diez, `parsers/dxf.js` once,
// el pegado de LIST doce), y cada una costó después una fase de rescate.
//
// ── POR QUÉ NO SE LLAMA `dialogo-errores.js` ────────────────────────────────
// Porque «errores» ya está cogido: `app/dialogo-avisos.js` es la lista de errores
// y avisos de la SESIÓN, la que abren los chips que dicen «3 errores · 5 avisos».
// Son dos cosas distintas y contiguas —una dice lo que la app ha detectado, otra
// lo que la Sede ha contestado—, así que dos ficheros cuyos nombres solo se
// distinguen por el sinónimo elegido se confunden al leer un `import`. Aquí lo
// que se abre es el DICCIONARIO.
//
// ── DE DÓNDE CUELGA, Y LO QUE ESO CUESTA ────────────────────────────────────
// De un `role="menuitem"` del menú de Expediente (decisión 5 de la entrevista del
// 2026-08-11). Coste en píxeles de la barra: **cero** — el menú ya existe y crece
// hacia abajo, y la barra ya midió que no le sobra ancho. Un rechazo es un
// episodio del expediente: ni una salida (el menú de la derecha exporta ficheros)
// ni un paso del recorrido (no se «va» al diccionario, se consulta y se vuelve).
//
// ⚠️ `app/barra.js` cierra el menú al pulsar un `menuitem` **y no devuelve el
// foco a propósito**, con el motivo escrito en su línea 520: «la opción recién
// pulsada puede abrir un diálogo que se lo lleve». Éste es ese diálogo.
//
// ── ⭐ ABRE CON EL DICCIONARIO ENTERO PUESTO, Y ESA ES LA DECISIÓN ──────────
// El campo filtra; no es la puerta. Decisión 6 de la entrevista, y no es una
// preferencia de maqueta: es lo que dictan **los dos únicos mensajes de rechazo
// que este proyecto ha medido de verdad**.
//
//   · El del IVG (2026-07-27) fue «El archivo no cumple el esquema Inspire GML»:
//     genérico, compatible con media docena de causas distintas.
//   · El del ICUC (2026-08-06) fue «Los siguientes ficheros no se han cargado al
//     no ser válidos: -⟨nombre⟩», que **no nombra ninguna causa**.
//
// Una pantalla que arrancara vacía esperando una consulta precisa sería inútil
// justo con los dos mensajes reales. Arrancando con las 23 entradas a la vista,
// el peor caso es que el técnico las ojee — que es exactamente lo que necesita
// hacer cuando la Sede no le ha dicho qué falla.
//
// ── LO QUE ESTA PANTALLA NO HACE ────────────────────────────────────────────
//   · **No mira tu fichero.** No sabe qué tienes cargado y no lo pregunta. Es un
//     diccionario, no un validador: quien comprueba un GML es la vía de entrada
//     por fichero, y quien comprueba lo que vas a entregar es `derivacion/`.
//   · **No se abre sola.** Ni cuando hay errores, ni al descargar. Misma decisión
//     que el diálogo de avisos: un modal que salta encima se aprende a cerrar sin
//     leerlo.
//   · **No deja añadir entradas.** El diccionario crece editando
//     `config/errores-ivg.json` en el repositorio (decisión 4 de la entrevista):
//     una entrada guardada solo en este navegador es sabiduría que se pierde al
//     vaciarlo y que nunca llega a nadie más.

import { ERRORES_IVG, MOTIVO, PROCEDENCIA, buscar } from '../config/errores-ivg.js'

// ── Textos ───────────────────────────────────────────────────────────────────

const TITULO = 'Me han rechazado el fichero'

const INTRO =
  'Pega abajo el mensaje que te ha devuelto la Sede y te digo qué significa. Si el mensaje es ' +
  'genérico —los dos que hemos medido lo son—, repasa la lista entera: está abierta.'

const ROTULO_CAMPO = 'Mensaje del IVG o del ICUC'

const MARCADOR =
  'Pega aquí el texto tal cual, aunque sean varias líneas. También puedes escribir una palabra.'

const BOTON_LIMPIAR = 'Ver el diccionario entero'
const BOTON_CERRAR = 'Cerrar'

/** Los tres campos de la ficha, con el rótulo con el que se leen en pantalla. */
const APARTADOS = Object.freeze([
  ['traduccion', 'Qué significa'],
  ['causaProbable', 'Qué suele haber pasado'],
  ['comoCorregir', 'Qué hacer'],
])

const SIN_RESULTADOS =
  'Nada del diccionario casa con eso. Puede que el mensaje sea de una causa que todavía no ' +
  'tenemos anotada: cuando la resuelvas, añádela a config/errores-ivg.json.'

/**
 * Lo que se dice de una entrada que ha casado con un mensaje LITERAL de la Sede.
 * Es la afirmación fuerte de esta pantalla y por eso se dice con todas las
 * letras: no es que compartan palabras, es que ese texto exacto es el que la
 * Sede devuelve cuando pasa esto.
 */
const CASA_LITERAL = 'Casa con el mensaje literal que devuelve la Sede'

/** Rótulo de la insignia de procedencia. Sin esto, `MEDIDO` y `COMUNIDAD` se
 *  leerían igual de fiables, que es justo lo que el campo existe para impedir. */
const ROTULO_PROCEDENCIA = Object.freeze({
  [PROCEDENCIA.MEDIDO]: 'Medido contra la Sede',
  [PROCEDENCIA.DOCUMENTADO]: 'Documentado por el Catastro',
  [PROCEDENCIA.OBSERVADO]: 'Observado',
  [PROCEDENCIA.COMUNIDAD]: 'Lo dice la comunidad, sin comprobar',
  [PROCEDENCIA.INFERIDO]: 'Deducido, sin verlo rechazar',
})

// ── Clases y ganchos · contrato con `estilos/app.css` y con los guiones ──────

const CLASE = Object.freeze({
  DIALOGO: 'gml-dialogo-diccionario',
  CUERPO: 'gml-dialogo-diccionario-cuerpo',
  TITULO: 'gml-dialogo-diccionario-titulo',
  INTRO: 'gml-dialogo-diccionario-intro',
  BUSQUEDA: 'gml-diccionario-busqueda',
  ROTULO: 'gml-diccionario-rotulo',
  CAMPO: 'gml-diccionario-campo',
  CUENTA: 'gml-diccionario-cuenta',
  LISTA: 'gml-diccionario-lista',
  ENTRADA: 'gml-diccionario-entrada',
  RESUMEN: 'gml-diccionario-resumen',
  CLAVE: 'gml-diccionario-clave',
  INSIGNIAS: 'gml-diccionario-insignias',
  INSIGNIA: 'gml-diccionario-insignia',
  DETALLE: 'gml-diccionario-detalle',
  APARTADO: 'gml-diccionario-apartado',
  LITERAL: 'gml-diccionario-literal',
  CORRECCION: 'gml-diccionario-correccion',
  VERMAS: 'gml-diccionario-vermas',
  VACIO: 'gml-diccionario-vacio',
  PIE: 'gml-dialogo-diccionario-pie',
})

const ACCION = Object.freeze({
  LIMPIAR: 'limpiar-diccionario',
  CERRAR: 'cerrar-diccionario',
})

/**
 * El `menuitem` de la barra que abre esta pantalla. **Es contrato de
 * `index.html`** y casa exactamente un nodo, que es lo que exige G16
 * (`test/services/contrato-catastro.test.js`).
 */
export const SELECTOR_ABRIR_DICCIONARIO = '[data-accion="consultar-rechazo"]'

/** `id` de la lista. Lo buscan las pruebas y el guion de humo 26. */
const ID_LISTA = 'gml-diccionario'

/** El mismo duck typing del resto de la casa. */
function esElementoDOM(el) {
  return (
    !!el &&
    typeof el === 'object' &&
    typeof el.appendChild === 'function' &&
    typeof el.addEventListener === 'function' &&
    el.nodeType === 1
  )
}

/**
 * @typedef {Object} DialogoDiccionario
 * @property {HTMLElement} nodo   El `<dialog>`.
 * @property {HTMLElement} lista  El contenedor de las entradas.
 * @property {HTMLTextAreaElement} campo  Donde se pega el mensaje.
 * @property {(texto?: string) => void} abrir  Enseña el diálogo. Si se le pasa
 *   texto, abre con la búsqueda ya hecha.
 * @property {() => void} cerrar  IDEMPOTENTE.
 * @property {() => boolean} estaAbierto
 * @property {() => number} visibles  Cuántas entradas se están enseñando.
 * @property {() => void} destruir  IDEMPOTENTE.
 */

/**
 * Fabrica el diálogo del diccionario y cablea el `menuitem` que lo abre.
 *
 * Fabrica su propio DOM, como los diálogos de F09, F10, F11, F18 y F19:
 * `index.html` solo aporta la opción del menú.
 *
 * @param {object} [opciones]
 * @param {Document} [opciones.documento=document]
 * @param {HTMLElement} [opciones.disparador]  La opción del menú. Si no llega se
 *   busca por {@link SELECTOR_ABRIR_DICCIONARIO}.
 * @param {readonly import('../config/errores-ivg.js').EntradaError[]} [opciones.entradas]
 *   El diccionario. Parámetro para las pruebas: en producción es el del repo.
 * @returns {DialogoDiccionario}
 * @throws {TypeError}  Si falta el documento, o si no hay disparador. Un
 *   disparador que falta es una pantalla inalcanzable, que es el modo de fallo
 *   que esta fase existe para no repetir: se dice al montar y no cuando alguien
 *   se pregunte por qué el menú tiene una opción menos.
 */
export function crearDialogoDiccionario({
  documento = document,
  disparador,
  entradas = ERRORES_IVG,
} = {}) {
  const doc = documento
  if (!doc || typeof doc.createElement !== 'function') {
    throw new TypeError(
      `crearDialogoDiccionario: 'documento' debe ser un Document; recibido ${typeof doc}.`,
    )
  }

  const boton = disparador ?? doc.querySelector(SELECTOR_ABRIR_DICCIONARIO)
  if (!esElementoDOM(boton)) {
    throw new TypeError(
      `crearDialogoDiccionario: no hay disparador. Se busca por ` +
        `'${SELECTOR_ABRIR_DICCIONARIO}', que es contrato de index.html. Sin él, el diccionario ` +
        `queda escrito y sin ninguna forma de llegar a él desde la aplicación.`,
    )
  }

  const crear = (etiqueta, clase, texto) => {
    const el = doc.createElement(etiqueta)
    if (clase) el.className = clase
    if (texto !== undefined) el.textContent = texto
    return el
  }

  // ── El DOM ────────────────────────────────────────────────────────────────

  const dialogo = crear('dialog', CLASE.DIALOGO)
  dialogo.setAttribute('aria-modal', 'true')
  dialogo.tabIndex = -1

  const cuerpo = crear('div', CLASE.CUERPO)

  const titulo = crear('h2', CLASE.TITULO, TITULO)
  titulo.id = 'gml-dialogo-diccionario-titulo'
  dialogo.setAttribute('aria-labelledby', titulo.id)

  const intro = crear('p', CLASE.INTRO, INTRO)

  const busqueda = crear('div', CLASE.BUSQUEDA)
  const rotulo = crear('label', CLASE.ROTULO, ROTULO_CAMPO)
  rotulo.htmlFor = 'gml-diccionario-campo'
  const campo = crear('textarea', CLASE.CAMPO)
  campo.id = 'gml-diccionario-campo'
  campo.rows = 3
  campo.placeholder = MARCADOR
  // `spellcheck` fuera: lo que se pega son mensajes técnicos con nombres
  // cualificados, y el subrayado rojo bajo `wfs:FeatureCollection` sugiere que
  // hay algo mal escrito justo donde no lo hay.
  campo.spellcheck = false
  busqueda.append(rotulo, campo)

  // `role="status"` y no `aria-live` a pelo: la cuenta cambia con cada tecla, y
  // un `assertive` interrumpiría al lector de pantalla en mitad de la escritura.
  const cuenta = crear('p', CLASE.CUENTA)
  cuenta.setAttribute('role', 'status')

  const lista = crear('div', CLASE.LISTA)
  lista.id = ID_LISTA

  const pie = crear('div', CLASE.PIE)
  const botonLimpiar = crear('button', 'gml-boton gml-boton--secundario', BOTON_LIMPIAR)
  botonLimpiar.type = 'button'
  botonLimpiar.dataset.accion = ACCION.LIMPIAR
  const botonCerrar = crear('button', 'gml-boton gml-boton--primario', BOTON_CERRAR)
  botonCerrar.type = 'button'
  botonCerrar.dataset.accion = ACCION.CERRAR
  pie.append(botonLimpiar, botonCerrar)

  cuerpo.append(titulo, intro, busqueda, cuenta, lista, pie)
  dialogo.append(cuerpo)
  doc.body.appendChild(dialogo)

  // ── El pintado ────────────────────────────────────────────────────────────

  let destruido = false
  let abierto = false
  let focoPrevio = null
  /** Cuántas entradas se están enseñando. Lo lee `visibles()` y el guion 26. */
  let cuantasVisibles = 0

  /**
   * Pinta una entrada como un `<details>` plegado.
   *
   * ⚠️ **Plegado, y no abierto.** Con 23 entradas × tres apartados, la lista
   * abierta es un muro de texto que no se lee: lo que se ojea es la columna de
   * claves. La excepción está en {@link pintar}: cuando lo pegado casa con un
   * mensaje LITERAL, esa entrada abre sola, porque ahí no hay nada que ojear —
   * ya sabemos cuál es.
   *
   * @param {import('../config/errores-ivg.js').EntradaError} e
   * @param {'MENSAJE'|'CLAVE'|'TEXTO'} motivo
   * @param {boolean} desplegada
   */
  function pintarEntrada(e, motivo, desplegada) {
    const det = crear('details', CLASE.ENTRADA)
    det.dataset.clave = e.clave
    // ⛔ `data-diccionario-procedencia` y NO `data-procedencia`, que es lo que
    // decía la primera versión. `data-procedencia` **ya está cogido**: es el
    // renglón que dice de dónde viene el dato que hay en pantalla
    // (`app/cableado-catastro.js:218` → `[data-procedencia="parcela"]`,
    // `app/panel-edificio.js:396` → `[data-procedencia="edificio"]`), y lo
    // resuelven con `querySelector` EN SINGULAR. Este `<dialog>` cuelga del
    // `<body>`, así que 23 fichas con ese atributo son 23 candidatos a que
    // `querySelector` se quede con el equivocado.
    //
    // Lo cazó el contrato K.1 de `test/app/main-edificio.dom.test.js` sobre la
    // aplicación entera montada, y su veredicto es el correcto: esto NO es un
    // grupo legítimo al que declararle una excepción —como los radios de modelo o
    // las casillas de capa—, es otro concepto que casualmente se llamaba igual.
    // La salida es cambiarle el nombre al recién llegado, no ensanchar la regla.
    det.dataset.diccionarioProcedencia = e.procedencia
    det.dataset.validador = e.validador
    if (desplegada) det.open = true

    const resumen = crear('summary', CLASE.RESUMEN)
    resumen.append(crear('span', CLASE.CLAVE, e.clave))

    const insignias = crear('span', CLASE.INSIGNIAS)
    const tramite = crear('span', `${CLASE.INSIGNIA} ${CLASE.INSIGNIA}--validador`, e.validador)
    tramite.title = e.validador === 'AMBOS' ? 'Vale para el IVG y para el ICUC' : `Trámite: ${e.validador}`
    const proc = crear(
      'span',
      `${CLASE.INSIGNIA} ${CLASE.INSIGNIA}--procedencia`,
      ROTULO_PROCEDENCIA[e.procedencia] ?? e.procedencia,
    )
    proc.title = `${e.procedencia} · ${e.fecha}`
    insignias.append(tramite, proc)
    resumen.append(insignias)
    det.append(resumen)

    const detalle = crear('div', CLASE.DETALLE)

    if (motivo === MOTIVO.MENSAJE) {
      detalle.append(crear('p', CLASE.LITERAL, CASA_LITERAL))
    }

    for (const [campoEntrada, rotuloApartado] of APARTADOS) {
      const p = crear('p', CLASE.APARTADO)
      const dt = crear('strong', null, rotuloApartado)
      p.append(dt, doc.createTextNode(` ${e[campoEntrada]}`))
      detalle.append(p)
    }

    if (e.correccion) {
      detalle.append(crear('p', CLASE.CORRECCION, `⚠️ ${e.correccion}`))
    }
    if (e.verMas) {
      detalle.append(crear('p', CLASE.VERMAS, `Detalle: ${e.verMas}`))
    }

    det.append(detalle)
    lista.append(det)
  }

  /**
   * Repinta la lista con lo que haya en el campo.
   *
   * La cuenta se dice SIEMPRE, incluso sin filtrar («23 entradas»), por lo mismo
   * que el cotejo de superficie del diálogo de pegado se enseña coincida o no:
   * callar el número cuando no filtra nada obliga a contar a ojo para saber si la
   * búsqueda ha hecho algo.
   */
  function pintar() {
    const texto = campo.value ?? ''
    const resultados = buscar(texto, { entradas })
    const filtrando = texto.trim() !== ''

    lista.replaceChildren()
    cuantasVisibles = resultados.length

    // Solo se despliega sola la PRIMERA, y solo si ha casado por mensaje
    // literal. Desplegar todas las que casen devuelve el muro de texto por otra
    // puerta; desplegar la primera cuando ha casado flojo promete una certeza
    // que la puntuación no respalda.
    const desplegarPrimera = filtrando && resultados[0]?.motivo === MOTIVO.MENSAJE

    resultados.forEach(({ entrada, motivo }, i) => {
      pintarEntrada(entrada, filtrando ? motivo : MOTIVO.TEXTO, i === 0 && desplegarPrimera)
    })

    if (resultados.length === 0) {
      lista.append(crear('p', CLASE.VACIO, SIN_RESULTADOS))
    }

    // ⛔ LA CUENTA SEPARA LO FUERTE DE LO FLOJO, Y NO ES COSMÉTICA.
    // La primera redacción decía «N de 23 entradas casan con lo que has pegado»,
    // y el guion 26 la midió contra el mensaje REAL del IVG: **15 de 23**. Solo
    // UNA casaba de verdad —por el literal— y las otras catorce compartían la
    // palabra «archivo» o «esquema», que en un diccionario de errores de esquema
    // las comparte medio catálogo. Decir «15 casan» sobre eso es la aplicación
    // afirmando más de lo que sabe, que es exactamente lo que este proyecto no
    // hace con una superficie ni con una procedencia y tampoco va a hacer aquí.
    // La lista ya estaba ordenada y la fuerte ya venía desplegada y con su
    // rótulo; lo que mentía era el número.
    const literales = resultados.filter((r) => r.motivo === MOTIVO.MENSAJE).length
    const flojas = resultados.length - literales
    const plural = (n, singular, plural_) => `${n} ${n === 1 ? singular : plural_}`

    cuenta.textContent = !filtrando
      ? `${entradas.length} entradas · sin filtrar`
      : literales === 0
        ? `${resultados.length} de ${entradas.length} entradas comparten palabras con lo que has pegado`
        : flojas === 0
          ? `${plural(literales, 'entrada casa', 'entradas casan')} con el mensaje literal`
          : `${plural(literales, 'entrada casa', 'entradas casan')} con el mensaje literal · ` +
            `${plural(flojas, 'más comparte', 'más comparten')} palabras`

    // «Ver el diccionario entero» solo tiene sentido si hay algo que deshacer.
    // Un botón que no hace nada y no dice por qué es la trampa que este proyecto
    // persigue desde F08.
    botonLimpiar.disabled = !filtrando
  }

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  function cerrarNodo() {
    if (typeof dialogo.close === 'function') {
      try {
        dialogo.close()
      } catch {
        dialogo.removeAttribute('open')
      }
    } else {
      dialogo.removeAttribute('open')
    }
  }

  /**
   * Único punto por el que sale este diálogo. IDEMPOTENTE: el `close` que emite
   * el navegador vuelve a entrar aquí.
   *
   * ⚠️ **NO se vacía el campo al cerrar.** Quien cierra para ir a mirar su GML y
   * vuelve, vuelve a lo que estaba leyendo. Aquí cerrar no pierde nada —no hay
   * nada que el usuario haya producido— y por eso también se puede cerrar
   * pinchando el velo, al revés que en el diálogo de pegar coordenadas.
   */
  function cerrar() {
    if (!abierto) return
    abierto = false
    cerrarNodo()

    const previo = focoPrevio
    focoPrevio = null
    if (previo && typeof previo.focus === 'function' && previo.isConnected) previo.focus()
  }

  /**
   * Enseña el diálogo.
   *
   * @param {string} [texto]  Si llega, se pone en el campo y se busca. Hoy nadie
   *   lo usa: existe para el día que un aviso de la aplicación ofrezca «mira qué
   *   dice el diccionario de esto», que es la ampliación natural de esta fase.
   */
  function abrir(texto) {
    if (destruido) return
    if (typeof texto === 'string') campo.value = texto
    pintar()

    if (abierto) return
    focoPrevio = doc.activeElement ?? null
    abierto = true
    if (typeof dialogo.showModal === 'function') {
      try {
        dialogo.showModal()
      } catch {
        dialogo.setAttribute('open', '')
      }
    } else {
      dialogo.setAttribute('open', '')
    }
    // El foco al campo: se ha entrado aquí con un mensaje en el portapapeles, y
    // lo primero que se quiere hacer es pegarlo. Ctrl+V funciona sin tocar nada.
    if (typeof campo.focus === 'function') campo.focus()
  }

  // ── Oyentes ───────────────────────────────────────────────────────────────

  const escuchados = []
  function escuchar(diana, tipo, fn) {
    diana.addEventListener(tipo, fn)
    escuchados.push({ diana, tipo, fn })
  }

  escuchar(boton, 'click', (evento) => {
    evento.preventDefault?.()
    abrir()
  })
  boton.setAttribute('aria-haspopup', 'dialog')

  // Sin rebote: son 23 entradas y una comparación de cadenas. Un `setTimeout`
  // aquí solo añadiría un estado que las pruebas tendrían que esperar.
  escuchar(campo, 'input', pintar)

  escuchar(dialogo, 'click', (evento) => {
    // El `<dialog>` ocupa toda la pantalla y el contenido vive en el cuerpo, así
    // que un `target` que sea el propio `<dialog>` es un clic en el velo.
    if (evento.target === dialogo) {
      cerrar()
      return
    }
    const pulsado = evento.target?.closest?.('[data-accion]')
    if (!pulsado || !dialogo.contains(pulsado)) return
    if (pulsado.dataset.accion === ACCION.CERRAR) cerrar()
    if (pulsado.dataset.accion === ACCION.LIMPIAR) {
      campo.value = ''
      pintar()
      if (typeof campo.focus === 'function') campo.focus()
    }
  })

  escuchar(dialogo, 'cancel', (evento) => {
    evento.preventDefault?.()
    cerrar()
  })

  escuchar(dialogo, 'keydown', (evento) => {
    if (evento.key === 'Escape' && abierto) {
      evento.preventDefault?.()
      cerrar()
    }
  })

  pintar()

  return {
    nodo: dialogo,
    lista,
    campo,
    abrir,
    cerrar,
    estaAbierto: () => abierto,
    visibles: () => cuantasVisibles,

    /** Cierra lo que hubiera, suelta los oyentes y se quita del DOM. */
    destruir() {
      if (destruido) return
      cerrar()
      destruido = true
      for (const { diana, tipo, fn } of escuchados) diana.removeEventListener(tipo, fn)
      escuchados.length = 0
      boton.removeAttribute('aria-haspopup')
      dialogo.remove()
    },
  }
}
