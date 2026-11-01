// scripts/smoke-navegador/29-parcelas-del-expediente.js — F25 · fase 5 · LAS PARCELAS DEL EXPEDIENTE.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// UNA SEGREGACIÓN HECHA A MANO, andada entera sobre la parcela real
// (`?demo=real`, 9398516VK3799G, 15 vértices):
//
//     partirla en TRES con cortes que van de vértice a vértice
//       → dibujar la pieza B (v1…v6) enganchando a sus vértices
//       → dibujar la pieza C (v1, v6…v11) enganchando a la matriz y a B
//       → volver a la matriz y BORRARLE v2…v10, que es lo que ha soltado
//       → deshacer en una parcela y comprobar que no toca a otra
//       → bajar UN .gml con las tres, y la contraprueba: sin C no cierra y no baja
//
// El corte es EXACTO por construcción —cada esquina de las piezas es un vértice
// de la matriz, enganchado—, así que el conjunto tiene que cerrar sobre el
// contorno oficial sin tolerancias que discutir. Son tres parcelas editadas a mano
// (criterio 7 de la ficha), que es la forma que se sube a la Sede.
//
// La suite cubre la lógica de cada pieza. Aquí se mide lo otro:
//
//   1. ⭐ **QUE EL DIBUJO ENGANCHE CON PUNTERÍA REAL.** Los clics se dan sobre el
//      centro en píxeles de los marcadores de la matriz; si el enganche no los
//      captura, las piezas no cierran y la contraprueba no tiene nada que medir.
//   2. ⭐ **EL DESHACER DE CADA UNA, CON LA TECLA DE VERDAD** (criterio 1). Ctrl+Z
//      pasa por el oyente de `document` de `app/main.js`, no por `undo()` a mano:
//      la suite prueba `app/cambio-de-parcela.js` y prueba el historial, cada uno
//      por su lado, y lo que ninguna prueba ve es el cable entre los dos.
//   3. ⭐ **0 px EN EL PANEL Y 0 B DE CSS** (criterio 6). En jsdom
//      `getBoundingClientRect()` devuelve ceros: un control que se come la tabla de
//      vértices o pisa el zoom sale verde. Y que el control no tenga ni una regla
//      en las hojas de estilo solo se puede contar con las hojas cargadas.
//   4. ⭐ **QUE EL BORRADOR DE IndexedDB LLEVE LAS TRES** (criterio 3). Sobre la
//      base de verdad, no sobre `fake-indexeddb`.
//   5. ⭐ **LOS BYTES DEL .gml** (criterio 5): N `featureMember`, sus `localId` y
//      namespaces, el tipo de operación que se propone, y que SIN una pieza el
//      fichero NO se escribe. El XSD estricto se pasa fuera, sobre el XML que este
//      guion devuelve (`ficheros.expediente`): ver §36 del GUION.
//
// ── LO QUE ESTE GUION NO PUEDE MEDIR ────────────────────────────────────────
//   · ⛔ **Si la Sede lo acepta** (criterio 7). Las dos piezas dibujadas salen
//     como ALTAS (`ES.LOCAL.CP`, `localId` = `parcela-nueva-N`, referencia
//     vacía): `derivacion/identidad.js#identidadDeMiembro` solo da la forma de O19
//     (`…G.1`) a las piezas del sobrante. Esa forma, en una segregación, **no se ha
//     presentado nunca**. Va a `CHECKLIST-HUMANO.md` §24.
//   · **Si un técnico sabe qué parcela está editando sin que se lo expliquen.** Es
//     el punto bloqueante del checklist y es juicio, no medida.
//   · **El arrastre como gesto de ratón** (§0 del GUION): los clics del dibujo son
//     `MouseEvent` sintéticos sobre el nodo que hay bajo el punto.
//
// ── RÉGIMEN DE RED: NINGUNA de datos ────────────────────────────────────────
// Dibujar, borrar, deshacer y descargar son locales. Se cuenta y se exige cero.
//
// ⚠️ **Lánzalo sobre una página RECIÉN CARGADA** con `?demo=real#/parcela/edicion`:
// el guion monta su propio expediente y comprueba que parte de una sola parcela
// (la lección del §35: un guion que monta su estado inicial tiene que comprobar
// que el estado inicial es el que cree).

const t0 = performance.now()
// El búfer de `performance` guarda 250 recursos por defecto y las teselas del fondo
// lo llenan en un par de zooms: sin esto, las consultas del final no constarían.
performance.setResourceTimingBufferSize(10000)
const problemas = []
const advertencias = []

// ── Utilidades ──────────────────────────────────────────────────────────────

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const texto = (sel) => $(sel)?.textContent?.trim() ?? ''

const esperarA = async (pred, ms = 5000, cada = 80) => {
  const limite = performance.now() + ms
  while (performance.now() < limite) {
    let v = null
    try {
      v = pred()
    } catch {
      v = null
    }
    if (v) return v
    await dormir(cada)
  }
  return null
}

function caja(el) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { alto: redondear(r.height), ancho: redondear(r.width), top: redondear(r.top), left: redondear(r.left) }
}

const seSolapan = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** El icono del vértice `n` (1-based) del EXTERIOR de la parcela EN EDICIÓN. */
const icono = (n) => $$('.leaflet-marker-icon[title]').find((e) => e.title === `EXTERIOR · vértice ${n}`) ?? null

function centro(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Un clic del usuario sobre el mapa: `MouseEvent` sintéticos sobre lo que hay bajo el punto. */
function clic(p) {
  const destino = document.elementFromPoint(p.x, p.y) ?? $('.leaflet-container')
  const comun = { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, view: window }
  for (const tipo of ['mousedown', 'mouseup', 'click']) destino.dispatchEvent(new MouseEvent(tipo, comun))
}

/** La tecla de verdad, por el oyente de `document` que monta `app/main.js`. */
function tecla(key, extra = {}) {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...extra }),
  )
}

// ── Selectores del contrato ─────────────────────────────────────────────────
// Copia deliberada de `viewer/parcelas-expediente.js#SELECTOR`: si allí cambian,
// este guion tiene que ponerse rojo, no seguir el cambio en silencio.

const SEL = {
  CONTROL: '[data-parcelas-expediente="control"]',
  FILA_LISTA: '[data-parcelas-expediente="fila-lista"]',
  LISTA: '[data-parcelas-expediente="lista"]',
  CUENTA: '[data-parcelas-expediente="cuenta"]',
  AÑADIR: '[data-parcelas-expediente="añadir"]',
  OPCION: '[data-parcelas-expediente="opcion"]',
  QUITAR: '[data-parcelas-expediente="quitar"]',
  DESCARGAR: '[data-parcelas-expediente="descargar"]',
  PANEL_DESCARGA: '[data-parcelas-expediente="panel-descarga"]',
  INCLUIR: '[data-parcelas-expediente="incluir"]',
  GML_FILA: '[data-parcelas-expediente="gml-fila"]',
  DESCARGAR_SELECCION: '[data-parcelas-expediente="descargar-seleccion"]',
  ESTADO: '[data-parcelas-expediente="estado"]',
  OTRA: '.gml-otra-parcela',
  BORRAR_VERTICE: 'button[data-accion="borrar-vertice"]',
  PANEL: '.gml-panel',
  TABLA: '.gml-tabla-vertices',
  EYEBROW: '[data-eyebrow]',
  VERTICES: '[data-ficha="vertices"]',
  SUPERFICIE: '[data-ficha="superficie"]',
  AVISO: '#avisos .gml-aviso-texto',
}

/** `app/main.js#EYEBROW_DIBUJADA`. */
const EYEBROW_DIBUJADA = 'Parcela nueva · dibujada aquí'
/** `viewer/dibujo.js#MENSAJE_CANCELADO`. */
const MENSAJE_CANCELADO = 'Dibujo cancelado: no se ha creado ningún recinto.'

const filas = () => $$(SEL.BORRAR_VERTICE).length
const avisos = () => $$(SEL.AVISO).map((n) => n.textContent.trim())
const otrasPintadas = () => $$(SEL.OTRA).length

/** Lo que dice la pantalla de la parcela en edición, en un objeto. */
const foto = () => ({
  enEdicion: $(SEL.LISTA)?.value ?? null,
  cuenta: texto(SEL.CUENTA),
  filas: filas(),
  superficie: texto(SEL.SUPERFICIE),
  eyebrow: texto(SEL.EYEBROW),
  otras: otrasPintadas(),
})

/** Pone otra parcela en edición con el selector, como el usuario. */
async function elegir(idLocal) {
  const lista = $(SEL.LISTA)
  lista.value = idLocal
  lista.dispatchEvent(new Event('change', { bubbles: true }))
  await esperarA(() => $(SEL.LISTA).value === idLocal && filas() > 0)
  await dormir(700) // el reencuadre anima el zoom
}

// ── La red que sale, contada ────────────────────────────────────────────────
// Por `performance`, no envolviendo `window.fetch`: el transporte de los servicios
// guarda su referencia a `fetch` al montarse (`services/_red.js`), así que un
// envoltorio puesto después NO la ve. La primera corrida contaba «0 peticiones»
// con una respuesta del Catastro pintada en el panel.
const peticionesDesde = (desde) =>
  performance
    .getEntriesByType('resource')
    .filter((e) => e.startTime >= desde)
    .map((e) => e.name)
const terminar = (veredicto) => veredicto

// ═════════════════════════════════════════════════════════════════════════════
// 0 · El punto de partida: UNA parcela, la real, en Edición
// ═════════════════════════════════════════════════════════════════════════════

const arranque = {
  paso: location.hash,
  filas: filas(),
  controlVisible: $(SEL.CONTROL) !== null && $(SEL.CONTROL).hidden === false,
  listaVisible: $(SEL.FILA_LISTA) !== null && $(SEL.FILA_LISTA).hidden === false,
  descargarVisible: $(SEL.DESCARGAR) !== null && $(SEL.DESCARGAR).hidden === false,
  opcionesEnLista: $$('option', $(SEL.LISTA) ?? document.createElement('select')).length,
}
if (!location.hash.includes('edicion') || arranque.filas !== 15) {
  return terminar({
    guion: '29-parcelas-del-expediente',
    ok: false,
    problemas: [
      `La página no está en el arranque que este guion monta (paso «${arranque.paso}», ` +
        `${arranque.filas} vértices; se esperaban Edición y los 15 de 9398516VK3799G). ` +
        'Lánzalo sobre `?demo=real#/parcela/edicion` recién cargado.',
    ],
    arranque,
  })
}
if (arranque.opcionesEnLista > 1) {
  return terminar({
    guion: '29-parcelas-del-expediente',
    ok: false,
    problemas: [
      `El expediente ya tiene ${arranque.opcionesEnLista} parcelas antes de empezar: la página no está ` +
        'recién cargada (o se ha recuperado un borrador). Recárgala; medir sobre un estado calentado ' +
        'acusaría defectos que no existen (§35).',
    ],
    arranque,
  })
}
// ⭐ Con UNA parcela el control ya está, y solo con su puerta de entrada (fase 3).
if (!arranque.controlVisible) {
  problemas.push('Con una parcela no se ve el control del expediente: «Añadir parcela» no tiene puerta.')
}
if (arranque.listaVisible || arranque.descargarVisible) {
  problemas.push(
    'Con UNA parcela el control enseña la lista o «Descargar»: no hay nada entre lo que elegir.',
  )
}

const panel = $(SEL.PANEL)
const base = {
  tablaPx: caja($(SEL.TABLA))?.alto ?? null,
  panelAnchoPx: caja(panel)?.ancho ?? null,
  desbordeVertical: panel ? redondear(Math.max(0, panel.scrollHeight - panel.clientHeight)) : null,
}

// ── El encuadre: cada vértice que se va a pinchar tiene que estar LIBRE ──────
// A 1280×720 el encuadre de arranque deja v1 bajo el control de capas y v4 bajo la
// barra de edición (medido el 2026-11-01). Un técnico alejaría el mapa; el guion
// también, un nivel cada vez, hasta que bajo cada vértice haya MAPA —un marcador o
// el lienzo— y no un control. ⚠️ No se exige que sea SU marcador: v8 tapa media
// v7 a cualquier zoom, y da igual, porque el punto del clic lo calcula el mapa por
// las coordenadas del evento, no por el icono que lo recibe. La primera versión del
// guion lo exigía, alejaba tres niveles buscándolo y acababa con los vértices
// amontonados.
const libre = (n) => {
  const el = icono(n)
  if (el === null) return false
  const p = centro(el)
  const bajo = document.elementFromPoint(p.x, p.y)
  return bajo !== null && bajo.closest('.leaflet-control-container') === null && bajo.closest('.leaflet-container') !== null
}
const PINCHADOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
let alejado = 0
while (!PINCHADOS.every(libre) && alejado < 3) {
  $('.leaflet-control-zoom-out')?.click()
  alejado += 1
  await dormir(700)
}
if (!PINCHADOS.every(libre)) {
  return terminar({
    guion: '29-parcelas-del-expediente',
    ok: false,
    problemas: ['No se ha podido dejar libres los vértices que hay que pinchar, ni alejando tres niveles.'],
    arranque,
  })
}
/** Dónde está cada vértice de la matriz en pantalla, ANTES de tocar nada. */
const P = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1, centro(icono(i + 1))]))
const idMatriz = $(SEL.LISTA)?.value ?? null

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Dibujar las dos piezas, enganchando a los vértices de la matriz
// ═════════════════════════════════════════════════════════════════════════════

/**
 * «Añadir parcela ▾» → «Dibujar una parcela nueva» → las esquinas → la primera otra
 * vez para cerrar. Devuelve lo que dice la pantalla y los avisos que han salido.
 */
async function dibujarPieza(esquinas) {
  const antes = avisos().length
  $(SEL.AÑADIR).click()
  await dormir(100)
  const opcion = $$(SEL.OPCION).find((b) => b.dataset.clave === 'dibujar') ?? null
  if (opcion === null) return { error: 'el menú no ofrece «Dibujar una parcela nueva»' }
  opcion.click()
  await dormir(200)
  for (const n of esquinas) {
    clic(P[n])
    await dormir(150)
  }
  clic(P[esquinas[0]])
  await dormir(700)
  const todos = avisos()
  return {
    ...foto(),
    // El panel apila lo nuevo arriba: lo que ha salido son las primeras `n`.
    avisosNuevos: todos.slice(0, Math.max(0, todos.length - antes)),
    // ⭐ La vista se CONSERVA al poner en edición la pieza recién dibujada (fase 3):
    // su primera esquina sigue en el píxel donde se pinchó.
    derivaPx: (() => {
      const v1 = icono(1)
      if (v1 === null) return null
      const c = centro(v1)
      return redondear(Math.hypot(c.x - P[esquinas[0]].x, c.y - P[esquinas[0]].y), 1)
    })(),
  }
}

function revisarPieza(nombre, r, { vertices, cuantas }) {
  if (r.error) {
    problemas.push(`Pieza ${nombre}: ${r.error}.`)
    return
  }
  if (r.cuenta !== `de ${cuantas}`) {
    problemas.push(`Tras dibujar ${nombre} el selector dice «${r.cuenta}» y no «de ${cuantas}».`)
  }
  if (r.filas !== vertices) {
    problemas.push(`La pieza ${nombre} tiene ${r.filas} vértices en la tabla y se pincharon ${vertices}.`)
  }
  if (r.enEdicion === idMatriz) {
    problemas.push(`La pieza ${nombre} se ha dibujado y la que sigue en edición es la matriz.`)
  }
  if (r.eyebrow !== EYEBROW_DIBUJADA) {
    problemas.push(`La cabecera de la pieza ${nombre} dice «${r.eyebrow}» y no «${EYEBROW_DIBUJADA}».`)
  }
  if (r.otras !== cuantas - 1) {
    problemas.push(`Con ${cuantas} parcelas el mapa pinta ${r.otras} que no están en edición, y son ${cuantas - 1}.`)
  }
  if (r.avisosNuevos.some((a) => /Autointersecci/i.test(a))) {
    problemas.push(`La pieza ${nombre} ha salido con una autointersección: el enganche no ha cogido los vértices.`)
  }
  // ⛔ Un recinto que SÍ se ha creado no puede anunciarse como cancelado.
  if (r.avisosNuevos.includes(MENSAJE_CANCELADO)) {
    problemas.push(`Al cerrar la pieza ${nombre} el panel dice «${MENSAJE_CANCELADO}», y la pieza existe.`)
  }
  if (r.derivaPx !== null && r.derivaPx > 2) {
    problemas.push(
      `Poner en edición la pieza ${nombre} ha movido el mapa ${r.derivaPx} px: el técnico pierde el sitio ` +
        'donde acaba de dibujar (la fase 3 lo decidió: la vista se conserva).',
    )
  }
}

const piezaB = await dibujarPieza([1, 2, 3, 4, 5, 6])
revisarPieza('B', piezaB, { vertices: 6, cuantas: 2 })
const idB = piezaB.enEdicion

const piezaC = await dibujarPieza([1, 6, 7, 8, 9, 10, 11])
revisarPieza('C', piezaC, { vertices: 7, cuantas: 3 })
const idC = piezaC.enEdicion

// ═════════════════════════════════════════════════════════════════════════════
// 2 · La matriz suelta lo que ya es de B y de C: se le borran v2…v10
// ═════════════════════════════════════════════════════════════════════════════

await elegir(idMatriz)
const matrizAntes = foto()
// ⭐ El coste en el panel se mide AQUÍ: la misma parcela con las mismas 15 filas que
// al arrancar, y la única diferencia es que el expediente tiene tres. La primera
// corrida lo medía al final, con la matriz ya en 6 filas, y acusaba a la fase de
// encoger la tabla 217 px que eran solo nueve filas menos.
const tablaConTresPx = caja($(SEL.TABLA))?.alto ?? null
const desbordeConTres = panel ? redondear(Math.max(0, panel.scrollHeight - panel.clientHeight)) : null
if (matrizAntes.filas !== 15) {
  problemas.push(`Al volver a la matriz la tabla tiene ${matrizAntes.filas} vértices y no 15: dibujar las piezas la ha tocado.`)
}
if (matrizAntes.eyebrow === EYEBROW_DIBUJADA) {
  problemas.push('La cabecera de la matriz dice que es una parcela dibujada: el rótulo no ha seguido al cambio.')
}
for (let i = 0; i < 9; i++) {
  // Siempre la × de la fila 2: al borrar, las de detrás suben un puesto.
  $$(SEL.BORRAR_VERTICE)[1]?.click()
  await dormir(120)
}
await dormir(300)
const matrizRecortada = foto()
if (matrizRecortada.filas !== 6) {
  problemas.push(`Borrar v2…v10 ha dejado la matriz con ${matrizRecortada.filas} vértices en vez de 6.`)
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Criterio 1 · el deshacer es de cada parcela, con la tecla de verdad
// ═════════════════════════════════════════════════════════════════════════════

await elegir(idB)
const bAntes = foto()
tecla('z')
await dormir(400)
const bTrasCtrlZ = foto()
await elegir(idMatriz)
const matrizTrasCtrlZEnB = foto()
tecla('z')
await dormir(400)
const matrizDeshecha = foto()
tecla('y')
await dormir(400)
const matrizRehecha = foto()

const deshacer = { bAntes, bTrasCtrlZ, matrizTrasCtrlZEnB, matrizDeshecha, matrizRehecha }
if (bTrasCtrlZ.filas !== bAntes.filas || bTrasCtrlZ.superficie !== bAntes.superficie) {
  problemas.push(
    `Ctrl+Z en la pieza B, que no tiene nada que deshacer, la ha cambiado: ${bAntes.filas} → ` +
      `${bTrasCtrlZ.filas} vértices, «${bAntes.superficie}» → «${bTrasCtrlZ.superficie}».`,
  )
}
// ⛔ EL CRITERIO 1: el Ctrl+Z pulsado en B no puede haber llegado a la matriz.
if (matrizTrasCtrlZEnB.filas !== 6) {
  problemas.push(
    `⛔ Ctrl+Z pulsado con la pieza B en edición ha llegado a la MATRIZ: tenía 6 vértices y tiene ` +
      `${matrizTrasCtrlZEnB.filas}. Es el peor fallo de la fase: deshacer en una parcela que no se ve.`,
  )
}
if (matrizDeshecha.filas !== 7) {
  problemas.push(
    `De vuelta en la matriz, Ctrl+Z no ha devuelto el último vértice borrado (${matrizTrasCtrlZEnB.filas} → ` +
      `${matrizDeshecha.filas}): su historia no se ha conservado al cambiar de parcela.`,
  )
}
if (matrizRehecha.filas !== 6) {
  problemas.push(`Ctrl+Y no ha rehecho el borrado en la matriz (${matrizDeshecha.filas} → ${matrizRehecha.filas}).`)
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Criterio 6 · 0 px en el panel y 0 B de CSS
// ═════════════════════════════════════════════════════════════════════════════

const control = $(SEL.CONTROL)
$(SEL.DESCARGAR)?.click()
await dormir(200)
const rectControl = control?.getBoundingClientRect() ?? null
const rectMapa = $('.leaflet-container')?.getBoundingClientRect() ?? null
const pisados = rectControl === null
  ? []
  : $$('.leaflet-control')
      .filter((c) => c !== control && !c.contains(control) && c.offsetParent !== null)
      .filter((c) => {
        const r = c.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && seSolapan(rectControl, r)
      })
      .map((c) => c.className.split(' ').filter((k) => k.startsWith('leaflet-control-') || k.startsWith('gml-'))[0] ?? c.className)

/** Reglas de las hojas cargadas que nombran el control o la capa. */
function reglasDelControl() {
  const hallazgos = []
  for (const hoja of document.styleSheets) {
    let reglas
    try {
      reglas = hoja.cssRules
    } catch {
      continue // hoja de otro origen: no es nuestra
    }
    for (const r of reglas) {
      const sel = r.selectorText ?? ''
      if (/parcelas-expediente|gml-otra-parcela/.test(sel)) hallazgos.push(sel)
    }
  }
  return hallazgos
}

const coste = {
  tablaPx: tablaConTresPx,
  tablaBasePx: base.tablaPx,
  panelAnchoPx: caja(panel)?.ancho ?? null,
  desbordeVertical: Math.max(
    desbordeConTres ?? 0,
    panel ? redondear(Math.max(0, panel.scrollHeight - panel.clientHeight)) : 0,
  ),
  desbordeHorizontal: panel ? redondear(Math.max(0, panel.scrollWidth - panel.clientWidth)) : null,
  control: rectControl === null ? null : { alto: redondear(rectControl.height), ancho: redondear(rectControl.width), top: redondear(rectControl.top), left: redondear(rectControl.left) },
  controlDentroDelMapa:
    rectControl !== null && rectMapa !== null &&
    rectControl.left >= rectMapa.left && rectControl.right <= rectMapa.right &&
    rectControl.top >= rectMapa.top && rectControl.bottom <= rectMapa.bottom,
  pisaA: pisados,
  reglasCss: reglasDelControl(),
}
if (coste.tablaPx !== null && coste.tablaBasePx !== null && coste.tablaPx < coste.tablaBasePx - 0.5) {
  problemas.push(
    `⛔ La tabla de vértices ha ENCOGIDO con tres parcelas: ${coste.tablaBasePx} → ${coste.tablaPx} px. ` +
      'El panel no desborda cuando pasa esto; encoge en silencio.',
  )
}
if (coste.panelAnchoPx !== base.panelAnchoPx) {
  problemas.push(`El panel ha cambiado de ancho con tres parcelas: ${base.panelAnchoPx} → ${coste.panelAnchoPx} px.`)
}
if (coste.desbordeVertical > base.desbordeVertical || coste.desbordeHorizontal > 0) {
  problemas.push(`El panel desborda con tres parcelas (${coste.desbordeVertical} / ${coste.desbordeHorizontal} px).`)
}
if (!coste.controlDentroDelMapa) {
  problemas.push('El control del expediente, con la descarga abierta, se sale del mapa.')
}
if (coste.pisaA.length > 0) {
  problemas.push(`El control del expediente, con la descarga abierta, pisa a: ${coste.pisaA.join(', ')}.`)
}
if (coste.reglasCss.length > 0) {
  problemas.push(
    `Hay ${coste.reglasCss.length} regla(s) de CSS para el control o la capa (${coste.reglasCss.join(' · ')}): ` +
      'la fase prometía 0 B de hoja.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Criterio 3 · el borrador de IndexedDB lleva las TRES
// ═════════════════════════════════════════════════════════════════════════════

function leerBorrador() {
  return new Promise((resolver) => {
    const pet = indexedDB.open('concreta-gml')
    pet.onerror = () => resolver({ error: String(pet.error) })
    pet.onsuccess = () => {
      const bd = pet.result
      try {
        const tx = bd.transaction('expedientes', 'readonly')
        const almacen = tx.objectStore('expedientes')
        const g = almacen.get('EXP-borrador-en-curso')
        const c = almacen.count()
        tx.oncomplete = () => {
          bd.close()
          resolver({ registro: g.result ?? null, registros: c.result })
        }
        tx.onerror = () => {
          bd.close()
          resolver({ error: String(tx.error) })
        }
      } catch (causa) {
        bd.close()
        resolver({ error: String(causa) })
      }
    }
  })
}
// El autoguardado espera 2 s desde la última edición (`MS_AUTOGUARDADO`).
let borrador = null
const limiteBorrador = performance.now() + 8000
while (performance.now() < limiteBorrador) {
  borrador = await leerBorrador()
  const exp = borrador.registro?.expediente
  if (exp && Array.isArray(exp.parcelas) && exp.parcelas.length === 3) break
  await dormir(500)
}
const guardado = {
  error: borrador?.error ?? null,
  registros: borrador?.registros ?? null,
  parcelas: borrador?.registro?.expediente?.parcelas?.map((p) => ({
    idLocal: p.idLocal,
    vertices: p.recintos?.[0]?.vertices?.length ?? null,
  })) ?? null,
  activa: borrador?.registro?.expediente?.activa ?? null,
  refcat: borrador?.registro?.refcat ?? null,
}
if (guardado.error !== null) {
  problemas.push(`No se ha podido leer el borrador de IndexedDB: ${guardado.error}.`)
} else if (guardado.parcelas === null || guardado.parcelas.length !== 3) {
  problemas.push(
    `⛔ El borrador del autoguardado no lleva las tres parcelas: lleva ` +
      `${guardado.parcelas === null ? 'ninguna (o ningún borrador)' : guardado.parcelas.length}. ` +
      'Cerrar la pestaña ahora perdería trabajo en silencio (H2).',
  )
} else {
  const matrizGuardada = guardado.parcelas.find((p) => p.idLocal === idMatriz)
  if (matrizGuardada?.vertices !== 6) {
    problemas.push(
      `El borrador lleva la matriz con ${matrizGuardada?.vertices} vértices y en pantalla tiene 6: guarda ` +
        'una copia vieja de la parcela en edición.',
    )
  }
  // El registro se nombra por la PRINCIPAL aunque se edite otra (fase 2, 2.3).
  if (guardado.refcat !== null && guardado.refcat !== '9398516VK3799G') {
    problemas.push(`El borrador se ha rotulado «${guardado.refcat}» y no con la referencia de la principal.`)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 6 · Criterio 5 · UN .gml con las tres, y sin una no se escribe
// ═════════════════════════════════════════════════════════════════════════════

const crearUrlOriginal = URL.createObjectURL
const blobs = []
URL.createObjectURL = function (objeto) {
  blobs.push(objeto)
  return crearUrlOriginal.call(URL, objeto)
}
const leerUltimo = async (desde) =>
  blobs.length > desde ? new TextDecoder('utf-8', { fatal: true }).decode(await blobs[blobs.length - 1].arrayBuffer()) : null

/** Lo que dice de sí mismo un .gml de parcela catastral. */
function leerGml(xml) {
  if (xml === null) return null
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return { malFormado: true }
  const porNombre = (n) => [...doc.getElementsByTagNameNS('*', n)].map((e) => e.textContent.trim())
  return {
    featureMember: doc.getElementsByTagNameNS('*', 'featureMember').length,
    localId: porNombre('localId'),
    namespace: porNombre('namespace'),
    nationalCadastralReference: porNombre('nationalCadastralReference'),
    areaValue: porNombre('areaValue'),
  }
}

let excepcion = null
try {
  // ── 6.1 · Las tres marcadas ──
  const casillas = $$(SEL.INCLUIR)
  const seleccion = {
    filas: casillas.length,
    marcadas: casillas.filter((c) => c.checked).length,
    boton: texto(SEL.DESCARGAR_SELECCION),
  }
  if (seleccion.filas !== 3 || seleccion.marcadas !== 3) {
    problemas.push(`La descarga ofrece ${seleccion.filas} filas con ${seleccion.marcadas} marcadas; se esperaban 3 y 3.`)
  }
  let desde = blobs.length
  $(SEL.DESCARGAR_SELECCION)?.click()
  await dormir(500)
  const xmlTres = await leerUltimo(desde)
  var tres = { ...seleccion, estado: texto(SEL.ESTADO), gml: leerGml(xmlTres), bytes: xmlTres?.length ?? 0 }
  if (xmlTres === null) {
    problemas.push(`«Descargar las 3 marcadas» no ha bajado nada. El renglón dice: «${tres.estado}».`)
  } else {
    if (tres.gml.malFormado) problemas.push('El .gml de las tres no es XML bien formado.')
    if (tres.gml.featureMember !== 3) {
      problemas.push(`El .gml lleva ${tres.gml.featureMember} featureMember y se marcaron 3.`)
    }
    if (new Set(tres.gml.localId).size !== tres.gml.localId.length) {
      problemas.push(`Dos parcelas del .gml comparten localId: ${tres.gml.localId.join(', ')}.`)
    }
    if (!tres.gml.localId.includes('9398516VK3799G') || tres.gml.namespace[0] !== 'ES.SDGC.CP') {
      problemas.push(
        `La matriz no sale como la finca oficial (localId ${tres.gml.localId[0]}, namespace ${tres.gml.namespace[0]}).`,
      )
    }
    if (!/Segregación/.test(tres.estado)) {
      problemas.push(
        `Una matriz con dos altas tiene la forma de Segregación, y el renglón no la propone: «${tres.estado}».`,
      )
    }
    // ⚠️ La forma de las altas dibujadas, que nadie ha presentado (ver la cabecera).
    const altas = tres.gml.localId.filter((_, i) => tres.gml.namespace[i] === 'ES.LOCAL.CP')
    if (altas.some((id) => !id.startsWith('9398516VK3799G.'))) {
      advertencias.push(
        `Las piezas dibujadas salen como altas sin referencia (localId ${altas.join(', ')}, ` +
          'nationalCadastralReference vacía). La forma aceptada con IVG positivo (O19) es la de la ' +
          'matriz con sufijo (…G.1) y solo la llevan las piezas del sobrante. Lo decide la Sede: ' +
          'CHECKLIST-HUMANO §24.1.',
      )
    }
  }

  // ── 6.2 · La contraprueba: sin C, la matriz y B no cubren el contorno oficial ──
  const casillaC = $$(SEL.INCLUIR).find((c) => c.dataset.idLocal === idC)
  if (casillaC) {
    casillaC.checked = false
    casillaC.dispatchEvent(new Event('change', { bubbles: true }))
  }
  await dormir(100)
  desde = blobs.length
  const botonDos = texto(SEL.DESCARGAR_SELECCION)
  $(SEL.DESCARGAR_SELECCION)?.click()
  await dormir(500)
  var sinC = {
    boton: botonDos,
    bajado: blobs.length > desde,
    estado: texto(SEL.ESTADO),
    estadoEnRojo: $(SEL.ESTADO)?.style.color === 'rgb(185, 28, 28)',
  }
  if (sinC.bajado) {
    problemas.push(
      '⛔ Sin la pieza C el expediente NO cubre el contorno oficial y el .gml se ha escrito igual (criterio 5).',
    )
  }
  if (!/No se descarga/.test(sinC.estado)) {
    problemas.push(`Sin la pieza C no baja nada, pero el renglón no dice por qué: «${sinC.estado}».`)
  }
  if (casillaC) {
    casillaC.checked = true
    casillaC.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // ── 6.3 · El GML de UNA fila: la pieza B sola ──
  desde = blobs.length
  $$(SEL.GML_FILA).find((b) => b.dataset.idLocal === idB)?.click()
  await dormir(500)
  const xmlB = await leerUltimo(desde)
  var soloB = { estado: texto(SEL.ESTADO), gml: leerGml(xmlB) }
  // No se exige que baje: una alta suelta puede no tener la forma de ninguna entrega.
  // Lo que se exige es que el renglón DIGA lo que ha pasado.
  if (soloB.estado === '' || soloB.estado === sinC.estado) {
    problemas.push('El «GML» de una fila no ha dicho nada en el renglón del control.')
  }
  if (xmlB !== null && soloB.gml.featureMember !== 1) {
    problemas.push(`El GML de una sola fila lleva ${soloB.gml.featureMember} featureMember.`)
  }
  var xmlExpediente = xmlTres
} catch (causa) {
  excepcion = String(causa?.stack ?? causa)
  problemas.push(`La descarga ha lanzado: ${causa?.message ?? causa}.`)
} finally {
  URL.createObjectURL = crearUrlOriginal
}
$(SEL.DESCARGAR)?.click() // cierra el panel

// ── La red que ha salido ────────────────────────────────────────────────────

// Los servicios de DATOS (`OVCServWeb` = RCCOOR y DNPRC; `INSPIRE/wfs…`). Las teselas
// del WMS también son de `ovc.catastro` y no cuentan: son el fondo del mapa.
const esDeDatos = (u) => /OVCServWeb|INSPIRE\/wfs/i.test(u)
const peticiones = peticionesDesde(t0)
const red = {
  total: peticiones.length,
  aServiciosDeDatos: peticiones.filter(esDeDatos).length,
  cuales: peticiones.filter(esDeDatos).map((u) => u.split('?')[0].split('/').pop()),
}
if (red.aServiciosDeDatos > 0) {
  problemas.push(
    `Partir una parcela a mano ha hecho ${red.aServiciosDeDatos} consulta(s) al Catastro ` +
      `(${[...new Set(red.cuales)].join(', ')}). Es un trabajo local: un clic de DIBUJO no es un clic de ` +
      '«¿qué parcela hay aquí?», y cada uno es una petición que el override O8 no permite regalar.',
  )
}

// ── Veredicto ───────────────────────────────────────────────────────────────

return terminar({
  guion: '29-parcelas-del-expediente',
  ok: problemas.length === 0,
  ventana: `${innerWidth}×${innerHeight}`,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto: [
    'SI LA SEDE LO ACEPTA (criterio 7): verdad externa. Ver CHECKLIST-HUMANO §24.',
    'SI UN TÉCNICO SABE QUÉ PARCELA ESTÁ EDITANDO sin que se lo expliquen: juicio humano, bloqueante.',
    'EL XSD ESTRICTO: se pasa fuera, sobre ficheros.expediente (npm run validar:xsd).',
    'EL ARRASTRE COMO GESTO DE RATÓN (§0): los clics son MouseEvent sintéticos.',
  ],
  arranque: { ...arranque, alejado, idMatriz },
  base,
  piezaB,
  piezaC,
  matrizAntes,
  matrizRecortada,
  deshacer,
  coste,
  guardado,
  descarga: { tres: typeof tres === 'undefined' ? null : tres, sinC: typeof sinC === 'undefined' ? null : sinC, soloB: typeof soloB === 'undefined' ? null : soloB, excepcion },
  red,
  ficheros: { expediente: typeof xmlExpediente === 'undefined' ? null : xmlExpediente },
})
