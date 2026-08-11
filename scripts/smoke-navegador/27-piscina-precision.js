// scripts/smoke-navegador/26-piscina-precision.js — F21 · fase 3 · T3.1.
//
// ── POR QUÉ ESTE GUION EXISTE, Y POR QUÉ SE LLAMA 26 Y NO 22 ─────────────────
// La ficha de F21 lo pide con el nombre `22-piscina-precision.js` y ese número
// **ya estaba cogido** cuando se fue a escribir: `22-arranque-vacio.js` (la
// aplicación arranca vacía, 2026-08-07) lo tomó tres días después de que la ficha
// lo reservara, y nadie volvió a aquella línea. Los números de esta carpeta son
// posiciones en una lista, no identificadores de fase —el §32 es el guion 22 y es
// de otra cosa—, así que F21 se lleva el siguiente libre. Se dice aquí para que
// quien busque «el guion 22 de F21» encuentre el porqué y no un hueco.
//
// ── QUÉ MIDE, Y SOBRE TODO QUÉ NO ───────────────────────────────────────────
// F21 entregó dos mitades y la suite las cubre enteras: que la `OtherConstruction`
// entra como parte de tipo `OTRA` (`test/edificio/entrada.test.js`,
// `aceptacion-f11.test.js`), que `puedeGenerar` es `true` con la piscina recién
// cargada, que el número llega al XML como `horizontalGeometryEstimatedAccuracy`
// y que sin declararlo sigue saliendo `xsi:nil`
// (`test/app/edificio-gml.dom.test.js`), y que el campo rechaza fuera de
// `0,000–9,999` diciendo que el rango es del ICUC
// (`test/app/panel-edificio.dom.test.js`). **Nada de eso se vuelve a medir aquí.**
//
// Lo que jsdom no puede dar, que es lo que la propia ficha dejó escrito como la
// razón de que la fase no se cierre —«sin él no hay medida en navegador de que el
// botón "Trabajo" quepa en la fila del rótulo ni de que el diálogo se lea a
// 1280×720»—, son CINCO cosas:
//
//   1. **El botón «Trabajo» cabe en la fila del rótulo.** `.gml-rotulo-fila` es el
//      hueco de coste 0 px que estrenó F08: mete un botón en el alto de línea de
//      un `<h2>` que ya estaba. Si no cabe, la fila se parte y el bloque crece —y
//      en esta rama el panel no tiene holgura (F11 lo dejó medido). jsdom no
//      maqueta: ahí este botón «cabe» siempre.
//   2. **El diálogo se lee a 1280×720**, el suelo declarado del proyecto: entra
//      entero en la ventana, sin recorte, con su campo y sus dos botones dentro.
//   3. **El campo rechaza fuera de rango con un GESTO REAL**, tecleando y pulsando
//      el botón, no asignando `.value` — que es como lo prueba la suite y es lo
//      que no comprueba que el `<input type="number">` deje escribir eso siquiera.
//   4. ⭐ **La precisión declarada SOBREVIVE a una mutación.** Es el defecto que
//      F21 se encontró de camino: `edificio/mutaciones.js#reconstruir` re-crea el
//      edificio enumerando a mano lo que conserva, y sin la clave nueva cualquier
//      mutación —renombrar, teclear la referencia, cambiar de modelo— habría
//      devuelto la precisión a `null` **en silencio**, para reaparecer como
//      `xsi:nil` en un documento firmado. La suite lo cubre sobre el modelo; aquí
//      se camina el recorrido de verdad.
//   5. **Una parte de tipo «Otra» no enseña contadores de plantas**, que es la
//      mitad de la piscina que sí se puede medir sin red: una piscina no tiene
//      plantas, y enseñárselas al técnico es pedirle que invente un dato.
//
// ⛔ **LO QUE ESTE GUION NO PUEDE MEDIR, Y SE DICE EN VEZ DE APARENTARLO.** La
// piscina REAL entra por el servicio (`wfsBU.aspx`,
// `GetAllConstructionByParcel`), y el único fixture del repositorio que la trae es
// `test/fixtures/catastro/wfsbu-allconstruction-9398516VK3799G.xml`, que es una
// respuesta del WFS y no un fichero que la aplicación acepte soltar. Medir esa vía
// exige red de verdad, que es lo que hace el guion 07 y lo que este no hace. Así
// que aquí la parte «Otra» se crea a mano —que es el otro recorrido real, el de la
// obra nueva— y **la vía del servicio sigue sin medida en navegador**: está
// anotado en la ficha de F21 y en el §33 del GUION.
//
// ── CÓMO SE LANZA ───────────────────────────────────────────────────────────
//     $B viewport 1280x720
//     $B goto http://localhost:PUERTO/concretagml/?demo=real#/edificio/entrada
//     $B wait ".gml-panel"
//     $B console --clear
//     $B eval scripts/smoke-navegador/26-piscina-precision.js
//
// Se lanza a **1280×720** a propósito: es el suelo declarado y el criterio 2 habla
// de él. A 1440×900 todo lo que aquí se mide cabe con holgura y el guion no
// distingue nada. Deja la aplicación en la rama EDIFICIO con una parte añadida.

const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]
const redondear = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100)

const esperar = async (cond, ms = 4000, que = '') => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (cond()) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  problemas.push(`Se ha agotado la espera de ${que} (${ms} ms).`)
  return false
}

const caja = (el) => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    alto: redondear(r.height),
    ancho: redondear(r.width),
    top: redondear(r.top),
    bottom: redondear(r.bottom),
    left: redondear(r.left),
    right: redondear(r.right),
  }
}

/** Teclea de verdad: dispara `input` y `change`, como haría una persona. */
const teclear = (campo, valor) => {
  campo.focus()
  campo.value = valor
  campo.dispatchEvent(new Event('input', { bubbles: true }))
  campo.dispatchEvent(new Event('change', { bubbles: true }))
}

const SEL = {
  APP: '.gml-app',
  PANEL: '.gml-panel',
  DIALOGO: 'dialog.gml-dialogo-trabajo',
  ABRIR_TRABAJO: '[data-accion="abrir-trabajo-edificio"]',
  APLICAR_TRABAJO: '[data-accion="aplicar-trabajo"]',
  CANCELAR_TRABAJO: '[data-accion="cancelar-trabajo"]',
  PRECISION: '[data-campo="precision-edificio"]',
  ESTADO_TRABAJO: '[data-estado="dialogo-trabajo"]',
  ANADIR_PARTE: '[data-accion="anadir-parte"]',
  RENOMBRAR_PARTE: '[data-accion="renombrar-parte"]',
  TIPO_PARTE: '[data-campo="tipo-parte"]',
  PLANTAS_SOBRE: '[data-campo="plantas-sobre"]',
  PLANTAS_BAJO: '[data-campo="plantas-bajo"]',
  PARTE: '.gml-parte',
}

const problemas = []
const advertencias = []
const app = $(SEL.APP)

// ── 0 · La rama EDIFICIO puesta ────────────────────────────────────────────

if (app.getAttribute('data-rama') !== 'EDIFICIO') {
  const boton = $$('.gml-conmutador-rama button').find((b) => /edificio/i.test(b.textContent))
  if (!boton) problemas.push('No se encuentra el botón de la rama EDIFICIO en el conmutador.')
  else {
    boton.click()
    await esperar(() => app.getAttribute('data-rama') === 'EDIFICIO', 3000, 'la rama EDIFICIO')
  }
}

const arranque = {
  viewport: { ancho: window.innerWidth, alto: window.innerHeight },
  rama: app.getAttribute('data-rama'),
  // El suelo declarado. Si se lanza en otro sitio, lo que mida el §2 no vale
  // para el criterio, y decirlo es parte del veredicto.
  esElSueloDeclarado: window.innerWidth === 1280 && window.innerHeight === 720,
}
if (!arranque.esElSueloDeclarado) {
  advertencias.push(
    `Este guion mide el criterio 2 de F21 a 1280×720 y se ha lanzado a ${window.innerWidth}×` +
      `${window.innerHeight}. Lo que diga del diálogo describe ESA ventana, no el suelo declarado.`,
  )
}

// ── 1 · El botón «Trabajo» cabe en la fila del rótulo ──────────────────────

const abrir = $(SEL.ABRIR_TRABAJO)
const fila = abrir === null ? null : abrir.closest('.gml-rotulo-fila')

const botonEnLaFila = (() => {
  if (abrir === null) {
    problemas.push(
      `No existe \`${SEL.ABRIR_TRABAJO}\`: el botón que abre las especificaciones del trabajo es la ` +
        'ÚNICA puerta a la precisión declarable, y sin él F21 no tiene interfaz.',
    )
    return { medido: false }
  }
  if (fila === null) {
    problemas.push(
      'El botón «Trabajo» no cuelga de un `.gml-rotulo-fila`. Ese hueco es el que hace que el botón ' +
        'cueste 0 px de panel (estrenado por F08): fuera de él, el bloque crece y en esta rama el ' +
        'panel no tiene holgura (F11 lo dejó medido).',
    )
    return { medido: false }
  }
  const cFila = caja(fila)
  const hijos = [...fila.children]
  const tops = new Set(hijos.map((h) => Math.round(h.getBoundingClientRect().top)))
  const rotulo = hijos.find((h) => h !== abrir)

  // ⛔ **AQUÍ NO VALE `scrollWidth − clientWidth`, Y LA PRIMERA VERSIÓN DE ESTE
  // GUION SE EQUIVOCÓ CON ESO** (2026-08-11, y se deja escrito porque el error es
  // reutilizable). Daba «recorta 5 px» con la fila perfectamente entera: el
  // culpable es el `::after` de `.gml-boton--menudo`, que agranda el objetivo de
  // pulsación 6 px por lado —posicionado en absoluto y a propósito, para llegar a
  // los 24 px que pide WCAG 2.5.8— y **cuenta para el `scrollWidth` sin pintar
  // nada**. Medido: botón `scrollWidth` 60 contra `clientWidth` 54, y de ahí los
  // 5 px de la fila.
  //
  // Recortar significa **esconder**, y esta fila es `overflow: visible`: no puede
  // esconder nada aunque se desborde. Así que se mide lo que de verdad importa —si
  // alguna caja de un hijo se sale de la caja de la fila— y el `scrollWidth` se
  // publica al lado, como dato y no como acusación.
  const estilo = getComputedStyle(fila)
  const rFila = fila.getBoundingClientRect()
  const seSalen = hijos
    .map((h) => ({ el: h, r: h.getBoundingClientRect() }))
    .filter(({ r }) => r.right > rFila.right + 0.5 || r.left < rFila.left - 0.5)
    .map(({ el, r }) => ({
      clase: (el.className || el.tagName).toString().slice(0, 40),
      sobraPx: redondear(Math.max(r.right - rFila.right, rFila.left - r.left)),
    }))
  const recortaDeVerdad = estilo.overflowX !== 'visible' && fila.scrollWidth > fila.clientWidth
  const desborde = seSalen.length
  return {
    medido: true,
    queEs:
      '`.gml-rotulo-fila` mete el botón en el alto de línea del rótulo que ya estaba, así que su ' +
      'coste en píxeles de panel tiene que ser CERO. Se comprueba que la fila no se ha partido en ' +
      'dos líneas y que no recorta por ancho.',
    altoDeLaFilaPx: cFila.alto,
    altoDelRotuloPx: rotulo ? caja(rotulo).alto : null,
    altoDelBotonPx: caja(abrir).alto,
    anchoDelBotonPx: caja(abrir).ancho,
    // El botón no puede ser más alto que la fila: si lo es, la ha estirado.
    haEstiradoLaFila: rotulo ? caja(abrir).alto > caja(rotulo).alto + 0.5 : null,
    saltoDeLinea: tops.size > 1,
    // Cuántos hijos se salen de la caja de la fila. Es lo que significa «no cabe».
    hijosQueSeSalen: seSalen,
    // Dato, no acusación: lo infla el `::after` del objetivo de pulsación.
    scrollWidthMenosClientPx: fila.scrollWidth - fila.clientWidth,
    overflowX: estilo.overflowX,
    recortaDeVerdad,
    holguraPx: redondear(
      fila.clientWidth - hijos.reduce((a, h) => a + h.getBoundingClientRect().width, 0),
    ),
  }
})()

if (botonEnLaFila.medido) {
  if (botonEnLaFila.saltoDeLinea) {
    problemas.push(
      `La fila del rótulo se ha partido en DOS líneas con el botón «Trabajo» dentro (alto ` +
        `${botonEnLaFila.altoDeLaFilaPx} px). Eso deja de ser el hueco de coste 0 px que F08 estrenó ` +
        'y le quita al panel de esta rama una altura que F11 midió que no tiene.',
    )
  }
  if (botonEnLaFila.hijosQueSeSalen.length > 0) {
    problemas.push(
      'Algo se sale de la fila del rótulo: ' +
        JSON.stringify(botonEnLaFila.hijosQueSeSalen) +
        '. Con el rótulo y el botón dentro de una fila de ' +
        `${botonEnLaFila.altoDeLaFilaPx} px de alto, salirse es esconderse.`,
    )
  }
  if (botonEnLaFila.recortaDeVerdad) {
    problemas.push(
      `La fila del rótulo es \`overflow: ${botonEnLaFila.overflowX}\` y su contenido mide ` +
        `${botonEnLaFila.scrollWidthMenosClientPx} px más que su caja: está recortando en silencio.`,
    )
  }
  if (botonEnLaFila.haEstiradoLaFila === true) {
    problemas.push(
      `El botón «Trabajo» mide ${botonEnLaFila.altoDelBotonPx} px y el rótulo ` +
        `${botonEnLaFila.altoDelRotuloPx}: ha estirado la fila, así que ya no cuesta 0 px.`,
    )
  }
}

// ── 2 · El diálogo se lee a 1280×720 ───────────────────────────────────────

let dialogo = null
const dialogoAbierto = await (async () => {
  if (abrir === null) return { medido: false }
  abrir.click()
  await esperar(() => $(SEL.DIALOGO)?.hasAttribute('open'), 3000, 'que se abra el diálogo del trabajo')
  dialogo = $(SEL.DIALOGO)
  if (dialogo === null || !dialogo.hasAttribute('open')) {
    problemas.push('El diálogo «Especificaciones del trabajo profesional» no se ha abierto.')
    return { medido: false }
  }
  const c = caja(dialogo)
  const campo = $(SEL.PRECISION)
  const aplicar = $(SEL.APLICAR_TRABAJO)
  const cancelar = $(SEL.CANCELAR_TRABAJO)
  const dentro = (el) => {
    const b = caja(el)
    return b === null ? null : b.top >= -0.5 && b.bottom <= window.innerHeight + 0.5
  }
  return {
    medido: true,
    queEs:
      'El criterio 2 de F21 en el suelo declarado: la caja del diálogo entra ENTERA en la ventana, ' +
      'no recorta por dentro, y las tres piezas con las que se interactúa —el campo y los dos ' +
      'botones del pie— están dentro de lo visible. Un diálogo que hay que scrollear para encontrar ' +
      'el botón de aceptar es el mismo defecto que F09 pagó con el informe.',
    caja: c,
    ventana: { ancho: window.innerWidth, alto: window.innerHeight },
    cabeEnLaVentana: c.top >= -0.5 && c.bottom <= window.innerHeight + 0.5,
    sobresalePorAbajoPx: redondear(Math.max(0, c.bottom - window.innerHeight)),
    recorteInteriorPx: dialogo.scrollHeight - dialogo.clientHeight,
    campoVisible: campo === null ? null : dentro(campo),
    aplicarVisible: aplicar === null ? null : dentro(aplicar),
    cancelarVisible: cancelar === null ? null : dentro(cancelar),
    // El foco tiene que estar DENTRO: es un `showModal()`.
    focoDentro: dialogo.contains(document.activeElement),
  }
})()

if (dialogoAbierto.medido) {
  if (!dialogoAbierto.cabeEnLaVentana) {
    problemas.push(
      `El diálogo del trabajo NO cabe en la ventana: sobresale ${dialogoAbierto.sobresalePorAbajoPx} px ` +
        `por abajo (caja ${dialogoAbierto.caja.alto} px sobre ${dialogoAbierto.ventana.alto} de alto). ` +
        'Es el criterio 2 de F21 y el suelo declarado del proyecto.',
    )
  }
  if (dialogoAbierto.recorteInteriorPx > 0) {
    problemas.push(
      `El diálogo recorta ${dialogoAbierto.recorteInteriorPx} px de su propio contenido sin barra a la ` +
        'que agarrarse.',
    )
  }
  for (const [pieza, visible] of [
    ['el campo de la precisión', dialogoAbierto.campoVisible],
    ['el botón de aplicar', dialogoAbierto.aplicarVisible],
    ['el botón de cancelar', dialogoAbierto.cancelarVisible],
  ]) {
    if (visible === false) {
      problemas.push(`Con el diálogo abierto, ${pieza} queda fuera de la ventana.`)
    }
    if (visible === null) {
      problemas.push(`Con el diálogo abierto, ${pieza} no existe en el DOM.`)
    }
  }
  if (dialogoAbierto.focoDentro === false) {
    advertencias.push(
      'El foco no ha entrado en el diálogo al abrirlo. Con `showModal()` debería; si se abre con ' +
        '`show()`, el teclado se queda fuera.',
    )
  }
}

// ── 3 · El campo rechaza fuera de rango, con un gesto de verdad ────────────

const rango = await (async () => {
  const campo = $(SEL.PRECISION)
  const aplicar = $(SEL.APLICAR_TRABAJO)
  const estado = $(SEL.ESTADO_TRABAJO)
  if (campo === null || aplicar === null) return { medido: false }

  // 3.1 · Fuera de rango: 10 metros. El máximo del ICUC es 9,999.
  teclear(campo, '10')
  aplicar.click()
  await new Promise((r) => setTimeout(r, 200))
  const textoFuera = estado === null ? null : estado.textContent.trim()
  const siguemAbierto = $(SEL.DIALOGO)?.hasAttribute('open') === true

  // 3.2 · El máximo exacto SÍ entra.
  teclear(campo, '9.999')
  aplicar.click()
  await esperar(() => $(SEL.DIALOGO)?.hasAttribute('open') !== true, 2000, 'que el diálogo se cierre')

  return {
    medido: true,
    queEs:
      'El criterio 6 de F21 con un gesto real: se teclea, se pulsa, y se lee lo que la aplicación ' +
      'contesta. La suite lo prueba asignando `.value`, que no comprueba que el `<input>` deje ' +
      'escribirlo ni que el renglón se pinte.',
    fueraDeRango: {
      tecleado: '10',
      dialogoSigueAbierto: siguemAbierto,
      texto: textoFuera,
      diceElRango: textoFuera === null ? null : /9[.,]999|ICUC|rango/i.test(textoFuera),
    },
    maximoExacto: {
      tecleado: '9.999',
      dialogoCerrado: $(SEL.DIALOGO)?.hasAttribute('open') !== true,
    },
  }
})()

if (rango.medido) {
  if (rango.fueraDeRango.dialogoSigueAbierto === false) {
    problemas.push(
      'Con 10 metros —fuera del rango del ICUC— el diálogo se ha CERRADO: ha aceptado un valor que la ' +
        'Sede no admite, o lo ha recortado en silencio. Las dos cosas son peores que no dejarlo entrar.',
    )
  }
  if (rango.fueraDeRango.diceElRango === false) {
    problemas.push(
      `El renglón del diálogo rechaza el valor sin decir cuál es el rango: ` +
        `${JSON.stringify(rango.fueraDeRango.texto)}. Decir «no» sin decir «cuánto» es media respuesta ` +
        '(regla de oro 1), y el rango no es nuestro: es del formulario del ICUC.',
    )
  }
  if (rango.maximoExacto.dialogoCerrado === false) {
    problemas.push(
      'El máximo exacto (9,999 m) NO se ha aceptado: el diálogo sigue abierto. Un rango cerrado que ' +
        'rechaza su propio extremo es un error de comparación, y el técnico no tiene forma de saberlo.',
    )
  }
}

// ── 4 · ⭐ La precisión sobrevive a una mutación ───────────────────────────

const trasMutar = await (async () => {
  if (!rango.medido || rango.maximoExacto.dialogoCerrado === false) return { medido: false }

  // Se añade una parte: es una mutación de las de `reconstruir`, que es donde
  // vivía el defecto que F21 cazó con el guardián del *shape*.
  const anadir = $(SEL.ANADIR_PARTE)
  if (anadir === null) return { medido: false, porque: 'no existe «Añadir parte»' }
  const partesAntes = $$(SEL.PARTE).length
  anadir.click()
  await esperar(() => $$(SEL.PARTE).length > partesAntes, 3000, 'que entre la parte nueva')

  // Y se vuelve a abrir el diálogo: el campo tiene que traer lo declarado.
  $(SEL.ABRIR_TRABAJO)?.click()
  await esperar(() => $(SEL.DIALOGO)?.hasAttribute('open'), 3000, 'que reabra el diálogo')
  const campo = $(SEL.PRECISION)
  const valor = campo === null ? null : campo.value
  $(SEL.CANCELAR_TRABAJO)?.click()
  await new Promise((r) => setTimeout(r, 150))

  return {
    medido: true,
    queEs:
      'El defecto que F21 se encontró de camino, caminado entero en el navegador: ' +
      '`edificio/mutaciones.js#reconstruir` re-crea el edificio enumerando a mano lo que conserva, y ' +
      'sin la clave nueva CUALQUIER mutación devolvía la precisión a `null` en silencio — para ' +
      'reaparecer como `xsi:nil` en un documento firmado.',
    partesAntes,
    partesDespues: $$(SEL.PARTE).length,
    valorDeclarado: '9.999',
    valorTrasLaMutacion: valor,
    sobrevive: valor !== null && Number.parseFloat(valor) === 9.999,
  }
})()

if (trasMutar.medido && trasMutar.sobrevive === false) {
  problemas.push(
    `La precisión declarada NO ha sobrevivido a añadir una parte: se declaró 9,999 m y el campo ` +
      `dice ahora ${JSON.stringify(trasMutar.valorTrasLaMutacion)}. Es el defecto de \`reconstruir\` ` +
      'que F21 tapó, y su forma es la peor posible: el dato se pierde EN SILENCIO y reaparece como ' +
      '`xsi:nil` en un documento que se firma.',
  )
}

// ── 5 · Una parte «Otra» no enseña contadores de plantas ───────────────────

const parteOtra = await (async () => {
  const partes = $$(SEL.PARTE)
  if (partes.length === 0) return { medido: false, porque: 'no hay ninguna parte en la lista' }
  partes[partes.length - 1].click()
  await esperar(() => $(SEL.TIPO_PARTE) !== null, 3000, 'que salga el bloque de la parte activa')
  const tipo = $(SEL.TIPO_PARTE)
  if (tipo === null) return { medido: false, porque: 'no hay campo de tipo de parte' }

  const opciones = [...tipo.options].map((o) => ({ valor: o.value, texto: o.textContent.trim() }))
  const otra = opciones.find((o) => /otra/i.test(o.texto) || /OTRA/.test(o.valor))
  if (!otra) return { medido: false, porque: 'el campo de tipo no ofrece «Otra»', opciones }

  tipo.value = otra.valor
  tipo.dispatchEvent(new Event('change', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 300))

  const sobre = $(SEL.PLANTAS_SOBRE)
  const bajo = $(SEL.PLANTAS_BAJO)
  const seVe = (el) => el !== null && el.getBoundingClientRect().height > 0
  return {
    medido: true,
    queEs:
      'La mitad de la piscina que se puede medir sin red: una parte de tipo «Otra» no tiene plantas, ' +
      'y enseñarle contadores al técnico es pedirle que invente un dato — que es literalmente lo que ' +
      'F21 midió que pasaba (había que teclear una mentira para desbloquear el botón).',
    opciones,
    tipoPuesto: tipo.value,
    plantasSobreVisible: seVe(sobre),
    plantasBajoVisible: seVe(bajo),
  }
})()

if (parteOtra.medido && (parteOtra.plantasSobreVisible || parteOtra.plantasBajoVisible)) {
  problemas.push(
    'Una parte de tipo «Otra» —una piscina— sigue enseñando contadores de plantas ' +
      `(sobre: ${parteOtra.plantasSobreVisible}, bajo: ${parteOtra.plantasBajoVisible}). Una piscina no ` +
      'tiene plantas: el modelo las fuerza a `null` y pedirlas es pedir un dato falso.',
  )
}
if (!parteOtra.medido) {
  advertencias.push(`El §5 no se ha medido: ${parteOtra.porque}.`)
}

// ── Veredicto ──────────────────────────────────────────────────────────────

return {
  guion: '26-piscina-precision.js',
  fase: 'F21 · fase 3 · T3.1',
  ok: problemas.length === 0,
  problemas,
  advertencias,
  arranque,
  botonEnLaFila,
  dialogo: dialogoAbierto,
  rango,
  trasMutar,
  parteOtra,
  noMedidoAquí: {
    laViaDelServicio:
      'La piscina REAL llega por `wfsBU.aspx#GetAllConstructionByParcel` y su único fixture es una ' +
      'respuesta del WFS que la aplicación no acepta soltar. Medirla exige red (guion 07). Aquí la ' +
      'parte «Otra» se crea a mano, que es el recorrido de la obra nueva.',
    elICUC:
      'Ninguna de las dos mitades de F21 ha pasado por el ICUC. El fichero que la Sede aceptó (F13) ' +
      'fue por la vía de fichero y sin piscina; que un GML CON `OtherConstruction` y CON precisión ' +
      'declarada cargue allí sigue sin medirse, y eso no lo puede firmar ninguna máquina.',
  },
}
