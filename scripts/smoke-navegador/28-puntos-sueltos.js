// scripts/smoke-navegador/28-puntos-sueltos.js — el levantamiento SIN UNIR (2026-08-19).
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// EL RECORRIDO ENTERO del fichero real de un topógrafo, andado de una vez:
//
//     soltar un DXF de 55 PUNTOS y CERO polilíneas
//       → elegir «No unirlos: traer los puntos y dibujar yo el recinto»
//       → aterrizar en EDICIÓN con los puntos pintados y el mapa encuadrado
//       → dibujar el contorno encima, enganchando a ellos
//       → CERRARLO PINCHANDO SU PRIMERA ESQUINA
//
// Las dos mitades eran callejones antes de hoy: «no unirlos» tiraba la nube
// entera —los puntos ni salían de `parsers/importar.js`— y el recinto solo se
// podía cerrar con doble clic, porque pinchar el primer vértice **añadía un
// vértice duplicado encima**.
//
// La suite cubre la lógica de las dos. Aquí se mide lo otro:
//
//   1. ⭐ **QUE LOS PUNTOS SE PINTEN.** `viewer/edicion.js#fijarPuntos` llevaba
//      desde el paso 9 de F18 escrito, documentado y con catorce pruebas, y su
//      ÚNICO llamante era su propia prueba: el enganche existía en el catálogo de
//      `edit/snap.js` y no había forma de llegar a él. En jsdom un `circleMarker`
//      «existe» aunque nadie lo vea; aquí se cuentan `<circle>` de verdad y se
//      comprueba que caen DENTRO de la ventana.
//   2. ⭐ **QUE EL MAPA ENCUADRE SOBRE ELLOS.** Con `recintos: []` el reencuadre
//      no tenía a qué mirar y la cascada caía a `vistaInicial`: la herramienta
//      puesta, los puntos cargados y **la vista general de España** en pantalla.
//      En jsdom `getBoundingClientRect()` devuelve ceros, así que ese defecto
//      —el mismo que F22 midió con las ocho fincas a 0×0— sale verde en la suite.
//   3. ⭐ **QUE EL CIERRE POR CLIC FUNCIONE CON PUNTERÍA REAL.** El umbral es de
//      PANTALLA (`UMBRAL_PUNTERIA_PX`, 12 px) y solo existe con layout: sin
//      píxeles no hay forma de comprobar que acertarle «casi» basta, que es toda
//      la razón del cambio.
//   4. ⭐ **QUE EL ENGANCHE SE VEA ANTES DE PINCHAR** (2026-08-19). Sin píxeles no
//      hay hover, y en jsdom un indicador «existe» aunque nadie lo mire. Aquí se
//      pasa el puntero sobre una diana —sin pinchar— y se exige el cuadradito del
//      OSNAP: hasta hoy solo aparecía EN el clic, o sea cuando ya no servía.
//   5. ⭐ **QUE NINGÚN RENGLÓN DIGA LO CONTRARIO DE SU BOTÓN.** Es la trampa que
//      esta casa ya ha pagado tres veces (M25, M31 y el chip de «0 errores»), y
//      **este guion la encontró dos veces en su primera corrida**: ver abajo.
//
// ── LO QUE ESTE GUION NO PUEDE MEDIR ────────────────────────────────────────
//   · **Que el orden propuesto sea el linde que el técnico caminó.** Es juicio
//     humano sobre un plano real y va al `CHECKLIST-HUMANO.md`.
//   · **El arrastre como gesto de ratón** (§0 del GUION): los clics del dibujo
//     son `MouseEvent` sintéticos sobre el contenedor del mapa, que es lo que
//     Leaflet escucha.
//   · **El paso por el ICUC** de un GML nacido de un levantamiento dibujado a
//     mano. Es verdad externa y no la da ninguna máquina de esta casa.
//
// ── RÉGIMEN DE RED: NINGUNA de datos ────────────────────────────────────────
// Toda la vía es local por definición —el levantamiento lo trae el técnico—, y
// desde hoy **tampoco se deduce la referencia**: sin contorno no hay punto
// interior que preguntar. Se cuenta y se exige cero.
//
// ⚠️ **Los fixtures se traen por `fetch` del propio servidor**, así que esto solo
// funciona en DEV: `vite preview` sirve `dist/`, donde no están.
//
// ── LO QUE ENCONTRÓ EN SU PRIMERA CORRIDA (2026-08-19) ──────────────────────
// ⛔ **DOS renglones que decían lo contrario de lo que hacía su botón**, los dos
// invisibles para las 8.185 pruebas:
//   · «Todavía no hay parcela. Empieza por una de las vías de arriba.» — con 55
//     puntos en el mapa y el usuario ya fuera de Entrada. Corregido con
//     `MENSAJE_SIN_CONTORNO_TODAVIA`.
//   · «"Traer el parcelario de fondo" está apagado…» **con el botón encendido**,
//     porque el motivo se escribía una vez y no se retiraba nunca al dejar de ser
//     verdad. Era inalcanzable hasta que este recorrido abrió el camino: entrar
//     en Edición sin contorno y dibujarlo allí mismo.
// ⛔ Y **un AVISO sobre una importación que había ido bien**: la deducción de
// referencia se pedía sin geometría y contestaba «no hay ninguna geometría
// cargada». Un aviso que cuenta un paso inaplicable enseña a no leer los avisos.

const t0 = performance.now()
const problemas = []
const advertencias = []

// ── Utilidades ──────────────────────────────────────────────────────────────

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

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
  return {
    alto: redondear(r.height),
    ancho: redondear(r.width),
    top: redondear(r.top),
    left: redondear(r.left),
  }
}

/** El centro de un nodo, en píxeles de ventana. */
function centro(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/**
 * Un clic del usuario sobre el mapa. **No es un arrastre** (§0 del GUION): son
 * `MouseEvent` sintéticos sobre el nodo que hay bajo esas coordenadas, que es lo
 * que Leaflet escucha para su evento `click`.
 */
function clic(p) {
  const destino = document.elementFromPoint(p.x, p.y) ?? $('.leaflet-container')
  const comun = { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, view: window }
  for (const tipo of ['mousedown', 'mouseup', 'click']) {
    destino.dispatchEvent(new MouseEvent(tipo, comun))
  }
}

function mover(p) {
  const destino = document.elementFromPoint(p.x, p.y) ?? $('.leaflet-container')
  destino.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: p.x,
      clientY: p.y,
      view: window,
    }),
  )
}

/** El gesto de soltar un fichero. Escucha `app/zona-fichero.js`, sobre la VENTANA. */
function soltar(file) {
  const dt = new DataTransfer()
  dt.items.add(file)
  for (const tipo of ['dragenter', 'dragover', 'drop']) {
    window.dispatchEvent(new DragEvent(tipo, { bubbles: true, cancelable: true, dataTransfer: dt }))
  }
}

/** Un `File` con los BYTES REALES del fixture. */
async function traerFixture(ruta, nombre) {
  const url = new URL(ruta, document.baseURI).href
  const respuesta = await fetch(url)
  if (!respuesta.ok) return { file: null, url, estado: respuesta.status }
  const bytes = await respuesta.arrayBuffer()
  return { file: new File([bytes], nombre, { type: '' }), url, bytes: bytes.byteLength }
}

// ── Selectores del contrato ─────────────────────────────────────────────────

const SEL = {
  DIALOGO: '.gml-dialogo-importacion',
  RADIO_PUNTOS: 'input[data-campo="puntos"]',
  IMPORTAR: '[data-accion="importar-medicion"]',
  PUNTO_LEV: '.gml-punto-levantamiento',
  SNAP: '.gml-snap',
  TRAZO_PUNTO: '.gml-trazo-punto',
  TRAZO_CIERRE: '.gml-trazo-cierre',
  DIBUJAR: '[data-accion="dibujar-recinto"]',
  QUITAR_PUNTOS: '[data-accion="quitar-puntos"]',
  AVISO: '#avisos .gml-aviso-texto',
  FICHA_VERTICES: '[data-ficha="vertices"]',
  FICHA_SUPERFICIE: '[data-ficha="superficie"]',
  ESTADO_GML: '[data-estado="generar-gml"]',
  BOTON_FONDO: '[data-accion="traer-fondo-catastral"]',
  ESTADO_FONDO: '[data-estado="traer-fondo-catastral"]',
}

// ── La red que sale, contada ────────────────────────────────────────────────

const peticiones = []
const fetchOriginal = window.fetch
window.fetch = function (recurso, opciones) {
  peticiones.push(String(recurso && recurso.url ? recurso.url : recurso))
  return fetchOriginal.call(this, recurso, opciones)
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Soltar el levantamiento y ver qué ofrece la pantalla de revisión
// ═════════════════════════════════════════════════════════════════════════════

const fixture = await traerFixture('icuc-pruebas/ejemplos dxf/martin.dxf', 'martin.dxf')
if (fixture.file === null) {
  window.fetch = fetchOriginal
  return {
    guion: '28-puntos-sueltos',
    ok: false,
    problemas: [
      `No se ha podido traer el fixture (${fixture.url}, estado ${fixture.estado}). ` +
        'Este guion exige `npm run dev`: `vite preview` sirve dist/, donde no está.',
    ],
  }
}

soltar(fixture.file)
const dialogo = await esperarA(() => {
  const d = $(SEL.DIALOGO)
  return d && d.open ? d : null
})

const opciones = $$(SEL.RADIO_PUNTOS).map((i) => ({
  valor: i.value,
  texto: (i.closest('label')?.textContent ?? '').trim(),
}))
const revision = {
  seAbre: dialogo !== null,
  esModalDeVerdad: dialogo !== null && typeof dialogo.showModal === 'function',
  opciones: opciones.length,
  etiquetas: opciones.map((o) => o.texto),
}

if (dialogo === null) {
  problemas.push('La pantalla de revisión no se ha abierto al soltar un DXF de puntos sueltos.')
}
// ⛔ La tercera opción TIENE que ofrecer una salida. Decir «no entrará ninguna
// parcela» y no dejar nada es peor que no ofrecer nada (lo midió F22).
const soloPuntos = opciones.find((o) => o.valor === '@solo-puntos') ?? null
if (soloPuntos === null) {
  problemas.push('No hay opción de traer los puntos sin unir: la tercera vía sigue sin existir.')
} else if (/no entrará ninguna parcela/i.test(soloPuntos.texto)) {
  problemas.push(
    'La tercera opción sigue anunciándose como un callejón («no entrará ninguna parcela»).',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Elegirla e importar
// ═════════════════════════════════════════════════════════════════════════════

const radio = $$(SEL.RADIO_PUNTOS).find((i) => i.value === '@solo-puntos')
const botonImportar = $(SEL.IMPORTAR, $(SEL.DIALOGO))
const importarNaceApagado = botonImportar !== null && botonImportar.disabled === true
if (!importarNaceApagado) {
  problemas.push('«Importar» no nace apagado: ninguna de las tres respuestas es un defecto seguro.')
}
if (radio) {
  radio.checked = true
  radio.dispatchEvent(new Event('change', { bubbles: true }))
  botonImportar.click()
}

await esperarA(() => $$(SEL.PUNTO_LEV).length > 0)
await dormir(400)

const arosPintados = $$(SEL.PUNTO_LEV)
const dentroDeLaVentana = arosPintados.filter((a) => {
  const c = a.getBoundingClientRect()
  return c.left >= 0 && c.top >= 0 && c.right <= innerWidth && c.bottom <= innerHeight
})

const entrada = {
  puntosPintados: arosPintados.length,
  visiblesEnLaVentana: dentroDeLaVentana.length,
  paso: location.hash,
  botonDibujar: (() => {
    const b = $(SEL.DIBUJAR)
    return b === null ? 'no existe' : b.hidden ? 'oculto' : 'visible'
  })(),
  renglonGml: ($(SEL.ESTADO_GML)?.textContent ?? '').trim(),
}

if (entrada.puntosPintados === 0) {
  problemas.push(
    'Los puntos NO se han pintado. `fijarPuntos` puede estar cableado y la capa no: el enganche ' +
      'existiría y sería invisible, que es una lotería y no una ayuda.',
  )
}
// ⭐ El encuadre. Sin él la cascada cae a `vistaInicial` y el usuario aterriza
// mirando España entera con sus 55 esquinas a diez husos de distancia.
if (entrada.puntosPintados > 0 && entrada.visiblesEnLaVentana === 0) {
  problemas.push(
    `Los ${entrada.puntosPintados} puntos están en el DOM pero NINGUNO cae dentro de la ventana: ` +
      'el mapa no ha encuadrado sobre ellos.',
  )
}
if (!location.hash.includes('edicion')) {
  problemas.push(
    `Tras importar los puntos la pantalla es «${location.hash}» y no Edición, que es donde están ` +
      '«Dibujar recinto» y el enganche a esos puntos.',
  )
}
if (entrada.botonDibujar !== 'visible') {
  problemas.push(`«Dibujar recinto» está ${entrada.botonDibujar} en la pantalla que lo necesita.`)
}
// ⛔ M25/M31: el renglón no puede describir un expediente distinto del que hay.
if (/todavía no hay parcela/i.test(entrada.renglonGml)) {
  problemas.push(
    'El renglón de «Generar GML» dice «todavía no hay parcela» con los puntos ya cargados y el ' +
      'usuario fuera de Entrada: describe un expediente que no es el de la pantalla.',
  )
}

// ⭐ Y ningún AVISO sobre una importación que ha ido bien.
const avisos = $$('[data-nivel]').map((n) => n.textContent.trim())
if (avisos.some((a) => /no hay ninguna geometría cargada/i.test(a))) {
  problemas.push(
    'Se avisa de que «no hay ninguna geometría cargada» después de una importación correcta: la ' +
      'deducción de referencia se está pidiendo sin contorno del que sacar un punto interior.',
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Dibujar el recinto sobre los puntos y CERRARLO pinchando el primero
// ═════════════════════════════════════════════════════════════════════════════

// Tres puntos bien separados de la nube: el triángulo tiene que tener superficie.
const dianas = [arosPintados[0], arosPintados[Math.floor(arosPintados.length / 3)],
  arosPintados[Math.floor((2 * arosPintados.length) / 3)]].filter(Boolean).map(centro)

$(SEL.DIBUJAR)?.click()
await dormir(200)

// ⭐ **EL ENGANCHE SE VE ANTES DE PINCHAR (2026-08-19).** El indicador OSNAP se
// encendía solo EN el clic, así que pasar el puntero sobre uno de los 55 puntos
// no enseñaba nada y el enganche se descubría cuando el vértice ya estaba puesto.
// Es exactamente lo que jsdom no puede medir: allí un marcador «existe» sin que
// nadie lo vea, y **sin píxeles no hay hover**. Aquí se pasa el puntero por
// encima de una diana —sin pinchar— y se exige el cuadradito.
mover(dianas[0])
await dormir(150)
const previa = {
  indicadores: $$(SEL.SNAP).length,
  verticesPuestos: $$(SEL.TRAZO_PUNTO).length + $$(SEL.TRAZO_CIERRE).length,
}
if (previa.indicadores === 0) {
  problemas.push(
    'Pasar el puntero sobre un punto del levantamiento no enseña el indicador de enganche: el ' +
      'usuario no sabe que ese clic va a clavar el vértice ahí hasta que ya lo ha clavado.',
  )
}
// ⛔ Y previsualizar no es actuar: el puntero no pone vértices.
if (previa.verticesPuestos !== 0) {
  problemas.push(
    `Mover el puntero ha puesto ${previa.verticesPuestos} vértice(s) sin que nadie pinchara.`,
  )
}

for (const p of dianas) {
  clic(p)
  await dormir(150)
}

const trasTres = {
  vertices: $$(SEL.TRAZO_PUNTO).length + $$(SEL.TRAZO_CIERRE).length,
  primeraEsquinaMarcada: $$(SEL.TRAZO_CIERRE).length,
}
if (trasTres.vertices !== 3) {
  problemas.push(`Tres clics han puesto ${trasTres.vertices} vértices en vez de 3.`)
}
// ⭐ La primera esquina se agranda SOLO cuando ya se puede cerrar. Un grafismo
// que anuncie una diana que no lo es es un mando que miente.
if (trasTres.primeraEsquinaMarcada !== 1) {
  problemas.push(
    'La primera esquina no se distingue de las demás con tres vértices puestos: no hay forma de ' +
      'saber que pinchándola se cierra.',
  )
}

// El puntero encima: tiene que ARMARSE (es el único aviso previo al clic).
const aro = $(SEL.TRAZO_CIERRE)
const sueltoFill = aro?.getAttribute('fill-opacity')
mover(dianas[0])
await dormir(150)
const armadoFill = aro?.getAttribute('fill-opacity')
const senal = { suelto: sueltoFill, armado: armadoFill }
if (aro !== null && sueltoFill === armadoFill) {
  problemas.push(
    'La primera esquina no cambia al acercarle el puntero: el usuario solo se entera de que ha ' +
      'cerrado cuando ya ha cerrado.',
  )
}

// ⭐ Y acertarle «casi» basta: el umbral es de PANTALLA, no de terreno.
const casi = { x: dianas[0].x + 6, y: dianas[0].y }
clic(casi)
await dormir(500)

const cerrado = {
  sigueDibujando: $(SEL.DIBUJAR)?.getAttribute('aria-pressed'),
  trazoEnCurso: $$(SEL.TRAZO_PUNTO).length,
  vertices: ($(SEL.FICHA_VERTICES)?.textContent ?? '').trim(),
  superficie: ($(SEL.FICHA_SUPERFICIE)?.textContent ?? '').trim(),
  puntosSiguenAhi: $$(SEL.PUNTO_LEV).length,
  cajaMapa: caja($('.leaflet-container')),
}

if (cerrado.vertices !== '3') {
  problemas.push(
    `El recinto no se ha cerrado con un clic sobre su primera esquina (a 6 px, dentro del umbral ` +
      `de puntería): la ficha dice ${JSON.stringify(cerrado.vertices)} vértices.`,
  )
}
if (cerrado.trazoEnCurso !== 0) {
  problemas.push('Ha quedado un trazo a medias después de cerrar.')
}
if (!/[1-9]/.test(cerrado.superficie)) {
  problemas.push(`El recinto cerrado no declara superficie: «${cerrado.superficie}».`)
}
// ⛔ Los puntos del levantamiento NO se van al cerrar: son la referencia contra la
// que se sigue trabajando, y siguen siendo dianas para mover un vértice después.
if (cerrado.puntosSiguenAhi !== entrada.puntosPintados) {
  problemas.push(
    `Cerrar el recinto se ha llevado puntos del levantamiento: ${entrada.puntosPintados} → ` +
      `${cerrado.puntosSiguenAhi}.`,
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Ningún renglón puede decir lo contrario de su botón
// ═════════════════════════════════════════════════════════════════════════════

const coherencia = {
  fondoApagado: $(SEL.BOTON_FONDO)?.disabled ?? null,
  renglonFondo: ($(SEL.ESTADO_FONDO)?.textContent ?? '').trim(),
  renglonGml: ($(SEL.ESTADO_GML)?.textContent ?? '').trim(),
}
if (coherencia.fondoApagado === false && /está apagado/i.test(coherencia.renglonFondo)) {
  problemas.push(
    '«Traer el parcelario de fondo» está ENCENDIDO y su renglón dice que está apagado. El motivo ' +
      'se escribió cuando era verdad y nadie lo retira al dejar de serlo.',
  )
}
if (/todavía no hay parcela|no tiene contorno/i.test(coherencia.renglonGml)) {
  problemas.push(
    `Con el recinto ya cerrado, el renglón de «Generar GML» sigue diciendo ` +
      `«${coherencia.renglonGml}».`,
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Y la nube se puede QUITAR, con red
// ═════════════════════════════════════════════════════════════════════════════
//
// ⛔ **EL DEFECTO QUE ESTA SECCIÓN CIERRA.** Hasta el 2026-08-19 no había ningún
// mando que se llevara los puntos: viven en el modelo, así que se guardaban con el
// expediente, viajaban en el fichero de proyecto y se repintaban al recuperarlo.
// Con el contorno ya dibujado encima, esos 55 aros dejan de servir para nada y
// tapan el mapa para siempre. La única forma de perderlos era no importarlos.
//
// ⚠️ **Esto SOLO se puede medir aquí.** La suite prueba la función y prueba el
// botón, cada uno por su lado; lo que ningún test de jsdom ve es si el clic del
// usuario sobre el botón que la barra fabrica llega hasta el store — que es
// exactamente el fallo que este proyecto ya se ha comido cuatro veces («canal
// escrito y sin enchufar»), y una quinta con `puntosVisible` fuera de la fachada
// del control, cazada por su prueba el mismo día.

const botonQuitar = $(SEL.QUITAR_PUNTOS)
const quitar = {
  existe: botonQuitar !== null,
  visibleConPuntos: botonQuitar !== null && botonQuitar.hidden === false,
  // La CUENTA dentro del nombre: es la única cifra que el usuario tiene, porque
  // 55 aros de 3 px superpuestos no se cuentan mirando.
  nombre: botonQuitar?.dataset.pista ?? null,
}

if (!quitar.existe) {
  problemas.push('La barra del mapa no ha fabricado «Quitar los puntos».')
} else {
  if (!quitar.visibleConPuntos) {
    problemas.push('Con 55 puntos en el mapa, «Quitar los puntos» sigue escondido.')
  }
  // `String.raw`: en una plantilla normal `\b` es el carácter de RETROCESO, no la
  // frontera de palabra, y la comprobación daba rojo con el nombre correcto delante.
  if (!new RegExp(String.raw`\b${entrada.puntosPintados}\b`).test(quitar.nombre ?? '')) {
    problemas.push(
      `«Quitar los puntos» no dice cuántos se lleva: su nombre es ` +
        `${JSON.stringify(quitar.nombre)} y en el mapa hay ${entrada.puntosPintados}.`,
    )
  }

  botonQuitar.click()
  await dormir(500)

  quitar.trasQuitar = {
    puntosEnMapa: $$(SEL.PUNTO_LEV).length,
    botonEscondido: $(SEL.QUITAR_PUNTOS)?.hidden ?? null,
    // ⭐ Lo que NO se puede llevar por delante: el recinto que se acaba de dibujar.
    vertices: ($(SEL.FICHA_VERTICES)?.textContent ?? '').trim(),
    superficie: ($(SEL.FICHA_SUPERFICIE)?.textContent ?? '').trim(),
    dicho: [...$$(SEL.AVISO)].map((t) => t.textContent).find((t) => /Quitad/i.test(t)) ?? null,
  }

  if (quitar.trasQuitar.puntosEnMapa !== 0) {
    problemas.push(
      `Quitar los puntos ha dejado ${quitar.trasQuitar.puntosEnMapa} aros en el mapa. El clic no ` +
        'llega al store: es el «canal escrito y sin enchufar» otra vez.',
    )
  }
  if (quitar.trasQuitar.botonEscondido !== true) {
    problemas.push(
      'Con la nube ya quitada, «Quitar los puntos» sigue a la vista: un mando ofreciendo quitar ' +
        'algo que ya no está.',
    )
  }
  if (quitar.trasQuitar.vertices !== cerrado.vertices) {
    problemas.push(
      `Quitar los puntos se ha llevado también el recinto: ${cerrado.vertices} → ` +
        `${quitar.trasQuitar.vertices} vértices.`,
    )
  }
  if (quitar.trasQuitar.superficie !== cerrado.superficie) {
    problemas.push(
      `La superficie ha cambiado al quitar los puntos: «${cerrado.superficie}» → ` +
        `«${quitar.trasQuitar.superficie}».`,
    )
  }
  // ⚠️ Y tiene que DECIRLO nombrando el atajo: lo que se acaba de borrar vino de un
  // fichero que el usuario puede no tener a mano.
  if (quitar.trasQuitar.dicho === null || !/Ctrl\+Z/i.test(quitar.trasQuitar.dicho)) {
    problemas.push(
      `Quitar los puntos no ha dicho cómo volver: el panel dice ` +
        `${JSON.stringify(quitar.trasQuitar.dicho)}.`,
    )
  }

  // ── LA RED, con el atajo DE VERDAD ────────────────────────────────────────
  // No `undo(historial)` a mano: la tecla, pasando por el oyente de `document` que
  // monta `cablearEdicion`. Es la mitad que ninguna prueba de jsdom de este repo
  // toca, porque allí el botón que se cablea muere en el primer remontaje.
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }),
  )
  await dormir(600)

  quitar.trasDeshacer = {
    puntosEnMapa: $$(SEL.PUNTO_LEV).length,
    botonEscondido: $(SEL.QUITAR_PUNTOS)?.hidden ?? null,
    vertices: ($(SEL.FICHA_VERTICES)?.textContent ?? '').trim(),
  }

  if (quitar.trasDeshacer.puntosEnMapa !== entrada.puntosPintados) {
    problemas.push(
      `«Deshacer» no ha devuelto la nube: ${entrada.puntosPintados} → ` +
        `${quitar.trasDeshacer.puntosEnMapa} puntos. El botón promete en su nombre que se puede ` +
        'deshacer, y esa promesa es lo que hace admisible que se lleve 55 de un clic.',
    )
  }
  if (quitar.trasDeshacer.botonEscondido !== false) {
    problemas.push('La nube ha vuelto y su botón no: el mando se ha quedado escondido.')
  }
  if (quitar.trasDeshacer.vertices !== cerrado.vertices) {
    problemas.push(
      `El «Deshacer» del quitado se ha llevado el recinto por delante: ` +
        `${quitar.trasDeshacer.vertices} vértices en vez de ${cerrado.vertices}.`,
    )
  }
}

// ── La red que ha salido ────────────────────────────────────────────────────

const red = {
  total: peticiones.length,
  aServiciosDeDatos: peticiones.filter((u) => /ovc\.catastro|wfs|wfsBU/i.test(u)).length,
}
if (red.aServiciosDeDatos > 0) {
  problemas.push(
    `La vía del levantamiento ha consultado ${red.aServiciosDeDatos} servicio(s) de datos. Es ` +
      'local por definición, y sin contorno ni siquiera hay punto interior que preguntar.',
  )
}

window.fetch = fetchOriginal

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '28-puntos-sueltos',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto: [
    'QUE EL ORDEN PROPUESTO SEA EL LINDE QUE EL TÉCNICO CAMINÓ: juicio humano sobre un plano real. Va al CHECKLIST-HUMANO.',
    'EL ARRASTRE COMO GESTO DE RATÓN (§0): los clics del dibujo son MouseEvent sintéticos sobre el contenedor del mapa.',
    'EL PASO POR EL ICUC de un GML nacido de un levantamiento dibujado a mano: verdad externa, no la da ninguna máquina de esta casa.',
  ],
  fixture: { nombre: 'martin.dxf', bytes: fixture.bytes },
  revision,
  entrada,
  previa,
  trasTres,
  senal,
  cerrado,
  coherencia,
  quitar,
  red,
}
