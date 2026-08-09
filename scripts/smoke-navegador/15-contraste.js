// scripts/smoke-navegador/15-contraste.js — Rework de UI · T9, REESCRITO 2026-08-07.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// LA RUTA CRÍTICA 2 ENTERA, andada de una vez sobre la aplicación real:
//
//     soltar un GML → está cargado, dibujado y EDITABLE
//
// Un solo gesto. Eso es lo que hay que medir hoy, y no lo puede medir jsdom:
// hace falta maquetación real para saber si lo que se promete está a la vista, y
// hace falta el rail vivo para saber si el recorrido se puede seguir andando.
//
// ── ⛔ ESTE GUION MEDÍA LO CONTRARIO, Y ESA ES SU LECCIÓN ───────────────────
// Hasta el 2026-08-07 el recorrido tenía DOS peajes: «Contrastar con el
// parcelario» para que la geometría llegara siquiera al modelo, y después LA
// PUERTA —«Tomar esta geometría y editarla»— para poder tocarla. Este guion
// existía para vigilar el segundo, y lo vigilaba bien: en agosto cazó que el
// botón nacía **314 px por debajo del pliegue** a 1280×720 (267 a 1440×900),
// invisible al final de un scroll interno, mientras el renglón de procedencia lo
// nombraba. Siete pruebas de jsdom lo daban por visible, porque allí
// `getBoundingClientRect()` devuelve ceros.
//
// ⭐ **Y aun con el botón bien colocado, el recorrido seguía roto, por debajo de
// lo que este guion sabía mirar.** La puerta vivía en el cajón de DIAGNÓSTICO, y
// ese paso exige el parcelario del Catastro. Este guion montaba el único fixture
// que trae referencia catastral de verdad, así que aquí SIEMPRE había parcelario
// y la puerta SIEMPRE era alcanzable. Con un GML sin referencia —el caso
// corriente: un alta, una pérgola, cualquier fichero que aún no la tiene— el
// paso quedaba apagado, y con él la única pantalla que contenía el botón. **El
// rail mandaba a pulsar algo que no existía en ninguna parte de la aplicación.**
//
// La lección, que es de método y por eso se queda escrita: **un guion de humo
// que monta el caso favorable mide el caso favorable.** El defecto no estaba en
// los píxeles del botón —eso se arregló— sino en que su pantalla era
// inalcanzable, y para verlo había que soltar el fichero que NO trae referencia.
// Por eso el paso 3 de abajo existe.
//
// ── LO QUE ESTE GUION **NO** PUEDE MEDIR ────────────────────────────────────
//   · Si el diagnóstico es CORRECTO. Eso es del guion 09 y de la suite: aquí se
//     mide el recorrido y la maquetación, no la geometría.
//   · Si el texto de procedencia es el que un colegiado querría leer. Se
//     comprueba que dice de dónde salió el dibujo y que no lo atribuye al
//     Catastro; que se entienda es del checklist humano.
//   · El arrastre como gesto de ratón (§0 del GUION): el fichero entra con un
//     `DataTransfer` fabricado y eventos despachados a mano.
//
// ── RÉGIMEN DE RED — léete el §13 antes de lanzarlo ─────────────────────────
// Toca el servicio REAL: una pasada, sin bucles. **Como mucho tres peticiones de
// datos**: el parcelario del primer fichero (que ahora se pide al soltarlo, no
// al pulsar), sus colindantes al aterrizar en Diagnóstico, y ninguna por el
// segundo fichero, que no trae referencia con la que preguntar. Si el servicio
// no contesta, se dice y no se reintenta.
//
// ⚠️ NECESITA `npm run dev`, no `vite preview`: el fixture se trae por `fetch`
// de `test/fixtures/gml/`, y `preview` sirve `dist/`, donde no está.
//
// ⚠️ ESTE GUION DEJA ESTADO EN INDEXEDDB. Al terminar hay un expediente
// autoguardado, y la corrida SIGUIENTE arranca con una tarjeta de aviso más
// («hay trabajo autoguardado de una sesión anterior sin recuperar») que le come
// 73,14 px a la caja de vértices. Costó una falsa regresión el 2026-08-04: la
// caja pasó de 228,33 a 155,19 px y pareció culpa del arreglo. **`$B reload` NO
// basta: hay que borrar IndexedDB** (ver §22 del GUION).

// ── Umbrales, con su motivo ─────────────────────────────────────────────────

/** Cuánto se espera a que el servicio conteste antes de rendirse. Sin bucles. */
const ESPERA_CARGA = 20000

/** El GML de parcela que la Sede acepta, y el ÚNICO fixture del repo con
 *  referencia catastral de verdad: con él hay parcelario y el recorrido llega
 *  hasta Diagnóstico. */
const FIXTURE_CON_REFCAT = 'test/fixtures/gml/cp_parcela_9398516VK3799G.gml'

/** ⭐ El fixture que destapa el defecto: un alta de particular con la referencia
 *  catastral PRESENTE Y VACÍA (`''`, medido en F08). Sin ella no hay parcelario
 *  que pedir, así que Diagnóstico se queda apagado — y ahí es donde el recorrido
 *  viejo se moría, porque su único botón de salida vivía en esa pantalla. */
const FIXTURE_SIN_REFCAT = 'test/fixtures/gml/UTM_1.gml'

// ── Utilidades ──────────────────────────────────────────────────────────────

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)

function caja(el) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    ancho: redondear(r.width),
    alto: redondear(r.height),
    x: redondear(r.left),
    y: redondear(r.top),
    abajo: redondear(r.bottom),
  }
}

/** Tiene caja. **No confundir con «se ve»**: ver `alcance()`. */
const tieneCaja = (el) => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}

const esperarA = async (pred, ms, cada = 100) => {
  const t0 = performance.now()
  while (performance.now() - t0 < ms) {
    if (pred()) return redondear(performance.now() - t0, 0)
    await new Promise((r) => setTimeout(r, cada))
  }
  return null
}

const SEL = {
  CAJON_COMP: '.gml-cajon-comprobacion',
  CAJON_DIAG: '.gml-cajon-diagnostico',
  CONTRASTAR: '[data-accion="contrastar-parcelario"]',
  PROCEDENCIA: '[data-procedencia="contraste"]',
  PUERTA: '[data-accion="tomar-geometria"]',
  VERTICES: '#tabla-vertices',
  RAIL: '[data-rail="pasos"]',
  BARRA_EDICION: '.gml-barra-edicion',
}

const app = () => $('[data-paso]') ?? document.body
const paso = () => app().dataset.paso ?? null

/** Los peldaños del rail con su estado y, si está apagado, su motivo. */
const peldanos = () =>
  Array.from(document.querySelectorAll(`${SEL.RAIL} button`)).map((b) => ({
    rotulo: (b.querySelector('[data-rail="rotulo"]') ?? b).textContent.trim().replace(/\s+/g, ' '),
    apagado: b.disabled === true,
  }))

const peldanoDe = (fotografia, nombre) =>
  fotografia.peldanos.find((p) => p.rotulo.startsWith(nombre)) ?? null

/**
 * ⭐ LA MEDICIÓN QUE JUSTIFICABA ESTE GUION, Y QUE SE CONSERVA: ¿se VE de verdad
 * un nodo, o solo «tiene caja»?
 *
 * Tres patas, y hacen falta las tres. Con una sola («tiene caja») el defecto del
 * 2026-08-04 salía verde: la puerta medía 394 × 30,84 px estando 280 px por
 * debajo del borde de la ventana. Hoy se aplica a la barra de edición, que es lo
 * que este recorrido tiene que dejar en pantalla.
 */
function alcance(nodo, contenedor) {
  if (!nodo || !contenedor) return null
  const rn = nodo.getBoundingClientRect()
  if (rn.height === 0) return { conCaja: false, seVe: false, motivo: 'no tiene caja' }
  const rc = contenedor.getBoundingClientRect()
  const centro = { x: rn.x + rn.width / 2, y: rn.y + rn.height / 2 }
  const dentroDeLaVentana = rn.top >= 0 && rn.bottom <= window.innerHeight
  const enElPunto =
    centro.y >= 0 && centro.y < window.innerHeight ? document.elementFromPoint(centro.x, centro.y) : null
  const dentroDelContenedor = rn.top >= rc.top - 1 && rn.bottom <= rc.bottom + 1
  return {
    conCaja: true,
    dentroDelContenedor,
    dentroDeLaVentana,
    loQueHayEnSuCentro: enElPunto
      ? `${enElPunto.tagName}[${enElPunto.dataset.accion || enElPunto.className}]`
      : 'FUERA DE LA VENTANA',
    nadieLoTapa: enElPunto !== null && (enElPunto === nodo || nodo.contains(enElPunto)),
    seVe:
      dentroDeLaVentana && enElPunto !== null && (enElPunto === nodo || nodo.contains(enElPunto)),
    caja: caja(nodo),
  }
}

/** Una foto del estado observable en un instante del recorrido. */
const foto = (etiqueta) => ({
  etiqueta,
  paso: paso(),
  hash: location.hash,
  peldanos: peldanos(),
  cajonComprobacion: tieneCaja($(SEL.CAJON_COMP)),
  cajonDiagnostico: tieneCaja($(SEL.CAJON_DIAG)),
  procedencia: {
    seVe: tieneCaja($(SEL.PROCEDENCIA)),
    texto: $(SEL.PROCEDENCIA)?.textContent?.trim() ?? null,
    caja: caja($(SEL.PROCEDENCIA)),
  },
  eyebrow: $('[data-eyebrow]')?.textContent?.trim() ?? null,
  verticesEnLaTabla: document.querySelectorAll(`${SEL.VERTICES} tbody tr`).length,
  cajaVertices: caja($(SEL.VERTICES)),
})

/** Suelta un `File` con los BYTES REALES del fixture sobre la ventana. */
async function soltar(ruta, nombre) {
  const url = new URL(ruta, document.baseURI).href
  const respuesta = await fetch(url)
  if (!respuesta.ok) return { ok: false, status: respuesta.status, url }
  const bytes = await respuesta.arrayBuffer()
  const file = new File([bytes], nombre, { type: 'application/gml+xml' })
  const dt = new DataTransfer()
  dt.items.add(file)
  for (const tipo of ['dragenter', 'dragover', 'drop']) {
    window.dispatchEvent(new DragEvent(tipo, { bubbles: true, cancelable: true, dataTransfer: dt }))
  }
  return { ok: true, bytes: bytes.byteLength, url }
}

// ── 0 · Arranque ────────────────────────────────────────────────────────────

const problemas = []
const advertencias = []
const t0 = performance.now()

const tarjetasAlArrancar = document.querySelectorAll('#avisos .gml-aviso').length
if (tarjetasAlArrancar > 0) {
  advertencias.push(
    `La aplicación arranca con ${tarjetasAlArrancar} tarjeta(s) de aviso ya puestas. Si una de ` +
      'ellas es la del autoguardado, este guion la dejó en la corrida anterior y le come ~73 px a ' +
      'la caja de vértices: las cifras del panel NO son comparables con las de referencia. Borra ' +
      'IndexedDB y recarga (§22 del GUION).',
  )
}
if (paso() !== 'entrada') {
  advertencias.push(
    `Este guion empieza en Entrada y la aplicación está en «${paso()}». Se lanza igual, pero el ` +
      'recorrido no arranca donde arranca un usuario.',
  )
}

const partida = foto('0 · antes de soltar nada')
const verticesDePartida = partida.verticesEnLaTabla

// ── 1 · Soltar un GML CON referencia: un solo gesto y está dentro ───────────

const entrega1 = await soltar(FIXTURE_CON_REFCAT, 'cp_parcela_9398516VK3799G.gml')
if (!entrega1.ok) {
  return {
    guion: '15-contraste',
    ok: false,
    problemas: [
      `El fixture no se sirve (HTTP ${entrega1.status}). Este guion necesita \`npm run dev\`: ` +
        '`vite preview` sirve `dist/`, donde los fixtures no están.',
    ],
    url: entrega1.url,
  }
}

// El aterrizaje es la señal de que el recorrido ha terminado: la parcela está en
// el store, el rail se ha recalculado y la navegación ha movido al usuario.
const msCarga = await esperarA(
  () => paso() === 'diagnostico' || paso() === 'edicion',
  ESPERA_CARGA,
)
const trasSoltar = foto('1 · tras soltar el .gml (un solo gesto)')

if (msCarga === null) {
  problemas.push(
    'Soltar el .gml no ha llevado a ninguna parte en 20 s. Si el servicio del Catastro no ha ' +
      'contestado esto NO es un defecto de la aplicación: mira la red antes de acusar.',
  )
}

// ⭐ EL CRITERIO CENTRAL: **el fichero entra solo**. Ni cajón, ni confirmación.
if (trasSoltar.cajonComprobacion) {
  problemas.push(
    'Ha salido el cajón de comprobación con un GML de UNA sola parcela. Desde el 2026-08-07 solo ' +
      'debe aparecer cuando el fichero trae varias y hay que elegir: en todo lo demás el fichero ' +
      'se carga solo, como un .dxf.',
  )
}
// ⚠️ **No se compara el NÚMERO de vértices con el de partida, y costó una falsa
// alarma al escribir esto (2026-08-07).** Con `?demo=real` la parcela de
// demostración es exactamente la misma que trae este fixture, así que el contador
// no cambia y un guardián escrito así acusa a la aplicación de no haber cargado
// nada. Lo que sí distingue es la CABECERA: la demo no se rotula como un GML
// importado, y ese rótulo solo puede escribirlo `ORIGEN_PARCELA.GML_EXISTENTE`.
if (trasSoltar.verticesEnLaTabla === 0) {
  problemas.push('La tabla de vértices está vacía: la geometría del fichero no ha llegado al modelo.')
}
if (trasSoltar.eyebrow === partida.eyebrow) {
  problemas.push(
    `La cabecera sigue diciendo «${partida.eyebrow}» después de soltar el fichero: lo que hay en ` +
      'pantalla no es lo que se ha traído.',
  )
}
if ($(SEL.PUERTA) !== null) {
  problemas.push(
    'Sigue existiendo un botón «Tomar esta geometría y editarla» en el DOM. La puerta se retiró ' +
      'con el modo COMPROBACIÓN el 2026-08-07.',
  )
}

// El aterrizaje: con parcelario, Diagnóstico; sin él, Validación. Aquí hay.
if (msCarga !== null && trasSoltar.paso !== 'diagnostico') {
  problemas.push(
    `Con parcelario traído, soltar el fichero tiene que dejarte en Diagnóstico. El paso activo es ` +
      `«${trasSoltar.paso}». Si el Catastro no contestó, esto es red y no aplicación.`,
  )
}

// ⭐ EDICIÓN ABIERTA. Es el defecto que abrió este cambio, del derecho.
const edicion1 = peldanoDe(trasSoltar, 'Edición')
if (edicion1 === null) problemas.push('No hay peldaño «Edición» en el rail.')
else if (edicion1.apagado) {
  problemas.push(
    `«Edición» está apagada con un GML recién cargado: «${edicion1.rotulo}». Era el peaje que se ` +
      'retiró, y su botón de salida vivía en una pantalla a la que este mismo bloqueo impedía llegar.',
  )
}

// La procedencia: dice de dónde salió, y NO se lo atribuye al Catastro.
if (!trasSoltar.procedencia.seVe) {
  problemas.push(
    'El renglón de procedencia no se ve: es lo único que dice de dónde salió la geometría que ' +
      'estás mirando, y T6 ya lo escondió sin querer una vez.',
  )
}
const textoProcedencia = trasSoltar.procedencia.texto ?? ''
if (!textoProcedencia.includes('GML existente')) {
  problemas.push(`La procedencia no dice que la geometría viene de un GML: «${textoProcedencia}».`)
}
if (!textoProcedencia.includes('no se modifica')) {
  advertencias.push(
    'La procedencia ya no promete que el fichero de origen queda intacto. Es la única frase que lo ' +
      'dice, y es la duda inmediata de quien acaba de abrir su propio GML.',
  )
}
if (textoProcedencia.includes('otro técnico')) {
  problemas.push(
    'La procedencia sigue diciendo «de otro técnico». Es una afirmación sobre la autoría que esta ' +
      'aplicación no puede comprobar: el GML que se abre suele ser el del propio usuario.',
  )
}
// Y la CABECERA, que es lo que más se lee: no puede atribuirlo a la Sede.
const eyebrow = trasSoltar.eyebrow ?? ''
if (/parcela del catastro/i.test(eyebrow)) {
  problemas.push(
    `La cabecera dice «${eyebrow}» sobre una geometría que ha traído alguien en un fichero. Es el ` +
      'error caro que F18/F19 cerraron: firmar sobre un dibujo ajeno creyéndolo oficial.',
  )
}
if (!/no del catastro/i.test(eyebrow)) {
  problemas.push(`La cabecera no advierte de que esto no lo emite el Catastro: «${eyebrow}».`)
}

// ── 2 · Y se puede EDITAR de verdad, no solo en el rail ─────────────────────

let alcanceBarra = null
let msEdicion = null
if (edicion1 !== null && !edicion1.apagado) {
  const botones = Array.from(document.querySelectorAll(`${SEL.RAIL} button`))
  const botonEdicion = botones.find((b) => b.textContent.trim().startsWith('Edición'))
  botonEdicion?.click()
  msEdicion = await esperarA(() => paso() === 'edicion' && tieneCaja($(SEL.BARRA_EDICION)), 5000)
  alcanceBarra = alcance($(SEL.BARRA_EDICION), document.documentElement)

  if (msEdicion === null) {
    problemas.push(
      'El peldaño «Edición» está encendido pero pulsarlo no deja la barra de edición en pantalla: ' +
        'el rail promete una pantalla que no llega.',
    )
  } else if (alcanceBarra !== null && !alcanceBarra.seVe) {
    problemas.push(
      `La barra de edición existe y NO se ve: dentro de la ventana: ${alcanceBarra.dentroDeLaVentana}; ` +
        `en su centro hay «${alcanceBarra.loQueHayEnSuCentro}». Es exactamente el defecto que este ` +
        'guion cazó en la puerta el 2026-08-04, en otro nodo.',
    )
  }
}
const trasEditar = foto('2 · en Edición, con la barra puesta')

// ── 3 · ⭐ EL CASO QUE EL GUION VIEJO NO MONTABA: un GML SIN referencia ─────
//
// Aquí es donde el recorrido se moría, y por qué ningún guardián lo veía: sin
// referencia catastral no hay parcelario, sin parcelario Diagnóstico se apaga, y
// la puerta vivía DENTRO de Diagnóstico. Hoy este fichero tiene que entrar igual
// y dejar Edición abierta; lo único que se pierde —y se dice— es el diagnóstico.

const entrega2 = await soltar(FIXTURE_SIN_REFCAT, 'sin-referencia.gml')
let trasSinRefcat = null
if (!entrega2.ok) {
  advertencias.push(
    `El fixture sin referencia no se sirve (HTTP ${entrega2.status}): el paso 3 no se ha medido.`,
  )
} else {
  const msSinRefcat = await esperarA(() => paso() === 'edicion', 8000)
  trasSinRefcat = foto('3 · tras soltar un GML SIN referencia catastral')

  if (msSinRefcat === null) {
    problemas.push(
      `Un GML sin referencia catastral no aterriza en Validación; el paso activo es ` +
        `«${trasSinRefcat.paso}». Sin parcelario, Validación es lo más lejos que se sostiene.`,
    )
  }
  const edicion2 = peldanoDe(trasSinRefcat, 'Edición')
  if (edicion2 !== null && edicion2.apagado) {
    problemas.push(
      `⛔ EL DEFECTO ORIGINAL, DE VUELTA: con un GML SIN referencia catastral «Edición» está ` +
        `apagada («${edicion2.rotulo}»). Éste es el fichero corriente —un alta, una pérgola— y es ` +
        'el caso en el que el usuario se quedaba encerrado sin salida visible.',
    )
  }
  const diagnostico2 = peldanoDe(trasSinRefcat, 'Diagnóstico')
  if (diagnostico2 !== null && !diagnostico2.apagado) {
    advertencias.push(
      'Sin referencia catastral no debería haber parcelario, y «Diagnóstico» está encendido. ' +
        'Puede ser que quedara el parcelario del fichero anterior: míralo antes de acusar.',
    )
  } else if (diagnostico2 !== null && !/parcelario/i.test(diagnostico2.rotulo)) {
    problemas.push(
      `«Diagnóstico» está apagado sin decir que lo que falta es el parcelario: ` +
        `«${diagnostico2.rotulo}». Un paso apagado en silencio es la regla de oro 1 rota.`,
    )
  }
}

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '15-contraste',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto: [
    'SI EL DIAGNÓSTICO ES CORRECTO. Aquí se mide el recorrido y la maquetación; la geometría es del guion 09 y de la suite.',
    'SI EL TEXTO DE PROCEDENCIA SE ENTIENDE. Se comprueba que dice de dónde salió el dibujo y que no lo atribuye al Catastro; que se lea bien es del checklist humano.',
    'EL ARRASTRE COMO GESTO DE RATÓN (§0): el fichero entra con un `DataTransfer` fabricado.',
    'EL GML DE VARIAS PARCELAS, que es el único que sigue abriendo el cajón. Lo cubre la suite (test/app/comprobacion.dom.test.js) y el guion 10.',
  ],
  arranque: {
    viewport: { ancho: window.innerWidth, alto: window.innerHeight },
    url: location.href,
    tarjetasDeAvisos: tarjetasAlArrancar,
    bytesDelFixture: entrega1.bytes,
  },
  tiempos: { msCarga, msEdicion },
  barraDeEdicion: alcanceBarra,
  fotos: [partida, trasSoltar, trasEditar, trasSinRefcat].filter(Boolean),
  estadoFinal: {
    queDeja:
      'Un GML cargado y editable, y un expediente autoguardado en IndexedDB. Para volver al punto ' +
      'de partida NO basta `$B reload`: hay que borrar IndexedDB (§22 del GUION).',
    paso: paso(),
    tarjetasDeAvisos: document.querySelectorAll('#avisos .gml-aviso').length,
  },
}
