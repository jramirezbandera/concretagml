// scripts/smoke-navegador/10-comprobar-gml.js — F08 · Tarea T6.2.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// COMPROBAR UN GML EXISTENTE (F08) en un navegador de verdad, y **solo lo que
// ahí se puede medir**. La suite ya cubre la comprobación pura
// (test/comprobacion/), el decodificador (test/gml/decodificar.test.js), el
// informe (test/report/), la vista (test/viewer/cajon-comprobacion.dom.test.js),
// la zona de fichero (test/app/zona-fichero.dom.test.js), el cableado
// (test/app/comprobacion.dom.test.js) y los cuatro criterios
// (test/comprobacion/aceptacion-f08.dom.test.js); **aquí no se vuelve a medir
// nada de eso**. Se miden las seis cosas que jsdom no puede dar:
//
//   1. **Que SOLTAR UN FICHERO funcione de punta a punta.** En jsdom no hay
//      `DataTransfer` real, ni `File.arrayBuffer()` sobre bytes de verdad, ni un
//      velo con `opacity` calculada. Aquí se fabrica un `File` con los BYTES
//      REALES del fixture —traídos por `fetch` del propio servidor, ver «cómo se
//      lanza»— y se recorre entero: velo de arrastre → cajón → «Contrastar» →
//      petición al Catastro → parcela en el mapa → **el CTA de F07 se enciende
//      solo**.
//   2. **Que el cajón de comprobación NO TAPE nada.** Comparte la esquina
//      `bottomleft` con el de diagnóstico y las otras tres están ocupadas desde
//      F03/F06. Se mide el ÁREA DE SOLAPE, en píxeles, contra la barra de edición
//      (centrada en el borde INFERIOR desde el 2026-08-05; estuvo en `topleft`
//      hasta entonces), el control de capas (`topright`), la atribución y el
//      control de opacidad (`bottomright`). Sin layout esto no significa nada.
//      ⚠️ La barra se mide igual aunque hoy no pueda coincidir con el cajón —con
//      la comprobación abierta el paso «Edición» está bloqueado, así que la barra
//      no está en pantalla—: si esa exclusión del recorrido se rompiera algún día,
//      el borde inferior es justo donde se notaría, y esta medida es quien lo diría.
//   3. **Que los DOS CAJONES no aparezcan a la vez.** Dos de los tres caminos
//      están blindados por `app/cableado-comprobacion.js` y se comprueban aquí
//      sobre controles de Leaflet reales; **el tercero está declarado y no
//      resuelto** (ver `terceraVia` y el §9 del checklist humano): se MIDE y se
//      publica, no se finge.
//   4. **Que la descarga del informe produzca BYTES.** Misma cadena
//      `Blob → createObjectURL → <a download> → click() → revoke` que mide `06`
//      para el GML, con el mismo patrón de captura (GUION.md §12) y la misma
//      promesa: los tres envoltorios se restauran y el veredicto lo DECLARA.
//   5. **EL INVARIANTE HEREDADO: la caja de vértices sigue en ~267 px.** `08`
//      la dejó en 303, `09` midió 267 con el CTA del pie puesto, y T3.3 volvió a
//      medir **267,4375 px con el botón «Abrir un GML…» ya en la fila del
//      rótulo**: la Decisión 5 («cuesta 0 px») se cumplió. Aquí se comprueba dos
//      veces: al arrancar, y **en el mismo tick en que el cajón se abre** — la
//      primera versión del guardián de F07 acusó al cajón de 11 px que eran de
//      otros renglones hablando después, así que nada de medir «un rato luego».
//   6. **La tipografía de los botones de los dos cajones.** Los tres botones
//      —«Contrastar con el parcelario», «Descartar» y «Descargar informe de
//      contraste»— los fabrican los módulos SIN clase, y `font-family` no se
//      hereda en los controles de formulario: `estilos/app.css` les puso una
//      regla para que no salgan en `system-ui`. Que una regla EXISTA no
//      significa que se APLIQUE, y eso solo lo dice `getComputedStyle` en un
//      navegador con la hoja cargada. La expectativa se DERIVA del token
//      `--font-sans` leído del `:root`, no de un literal copiado.
//
// Y desde el **2026-08-02**, tres más, que **no son de F08 dos de ellas** y que
// **no las encontró ninguna máquina: las encontró la FIRMA HUMANA de F08**. Se
// miden aquí porque es donde se vieron —con la app entera viva y con layout— y
// porque la suite no llega a ninguna de las tres:
//
//   7. **QUE EL MAPA VIAJE A LA PARCELA QUE ENTRA, y NO al editar** (§17; defecto
//      heredado de F03/F05). `encuadrar()` se llamaba UNA vez, al construir el
//      visor: se soltaba un GML de otra provincia y el mapa seguía mirando la
//      parcela de demostración, con el dibujo hecho a cientos de kilómetros. **La
//      suite no podía verlo por construcción**: todas sus pruebas traen su
//      geometría a mano y la app arranca ya encuadrada sobre ella, así que la
//      pregunta «¿y cuando entra OTRA?» no se hacía en ninguna parte. Aquí se
//      mide con el fichero `UTM_1.gml` (un alta real de OTRA parcela, a ~400 km)
//      y con su mitad contraria, que importa igual: **arrastrar un vértice NO
//      mueve el mapa** (mismo píxel antes y después).
//   8. **QUE LAS PARCELAS VECINAS SE DIBUJEN** (§8 bis; deuda de F05). Se traían,
//      se publicaban por `alColindantes` y las usaban el snap de F06 y la invasión
//      de F07 — y **no las pintaba nadie**: pulsar «Traer colindantes» dejaba el
//      mapa exactamente igual mientras la ficha decía «12». La suite no lo veía
//      porque **nadie afirmaba que se dibujaran**. Se mide el número de contornos,
//      que estén en el pane 405 y **por debajo** de la parcela propia, que el
//      emergente traiga la referencia catastral, y **el riesgo que eso abría**:
//      que una capa interactiva le robe el clic al mapa.
//   9. **QUE EL CAMPO DE LA REFERENCIA DIGA LO MISMO QUE EL MODELO** (§7 bis y
//      §17.3; éste sí es defecto propio de F08). Con un fichero que trae
//      referencia, el campo la enseña en forma CANÓNICA; con uno que no la trae
//      (`UTM_1.gml`), el campo se **vacía** — y en los dos casos se comprueba que
//      ningún botón derivado se queda encendido contradiciéndolo, porque se
//      encienden mirando el MODELO y no el campo.
//
// Y de propina, dos cosas que solo tienen sentido con la app viva: un GML ajeno
// con una tanda LARGA de notas (el riesgo declarado en el plan: «hay que mirarlo
// con un fichero malo de verdad: va al guion 10») y un contador de excepciones no
// capturadas durante el recorrido.
//
// ── QUÉ **NO** PUEDE MEDIR — LÉELO ANTES DE CITAR ESTE GUION ────────────────
//
//   · **NO es un gesto de ratón, y el arrastre menos que ninguno.** `/browse` no
//     tiene comando `drag` y el dominio CDP `Input` no está en su allowlist
//     (§0 del GUION), así que aquí se fabrica un `DataTransfer` con un `File` y
//     se despachan `dragenter`/`dragover`/`dragleave`/`drop` a mano. Eso ejercita
//     el módulo entero —`preventDefault`, el contador de profundidad, el velo con
//     su `opacity` calculada, `File.arrayBuffer()` sobre bytes reales— pero
//     **arrastrar un fichero desde el explorador de Windows con la mano es otra
//     cosa** y queda en el checklist humano §9.1. El veredicto lo dice en
//     `esGestoDeRatonReal: false`.
//   · **NO decide si el cajón se ENTIENDE**, ni si las notas sobre el GML de otro
//     técnico se leen como una regañina, ni si alguna se lee como un veredicto
//     sobre su trabajo. Publica números y textos (regla de oro 9); el juicio es
//     del checklist §9, y ese último punto **BLOQUEA** igual que el 8.1.
//   · **NO abre el selector de ficheros del sistema.** El botón «Abrir un GML…»
//     se comprueba por estructura (existe, es un `<button>`, vive en la fila del
//     rótulo y tiene al lado el `<input type="file">` que fabrica el módulo); que
//     al pulsarlo se abra el diálogo del sistema operativo no lo puede ver ningún
//     guion — es checklist.
//   · **NO mide la consola completa.** Cuenta las excepciones no capturadas y los
//     rechazos de promesa **que ocurran mientras corre** (`consola`), que es más
//     de lo que hace `09`, pero el buffer entero es de `$B console --errors`
//     (§6).
//   · **NO fija las cifras del Catastro.** Contra el servicio VIVO los datos
//     pueden cambiar: se exige la FORMA (procedencia doble, CTA encendido, una
//     petición) y las cifras se publican.
//
// ── RÉGIMEN DE RED: COMO `07` Y `09`, PORQUE TOCA EL SERVICIO REAL ──────────
// UNA pasada, SIN bucles, y como mucho DOS peticiones de datos (override O8):
//
//   · «Contrastar con el parcelario» (GetParcel, con la referencia leída DEL
//     FICHERO) — 0 si la caché de IndexedDB de una corrida anterior sigue dentro
//     del TTL, 1 si no.
//   · Abrir el cajón de diagnóstico pide colindantes (GetNeighbourParcel) — una
//     pulsación, una petición; 0 si ya las trajo otro gesto en esta página.
//
// El segundo fichero que se suelta (el del huso incoherente) **no gasta nada**:
// declara EPSG:25829 y el cableado se niega a pedir el parcelario en un huso
// distinto del expediente (`motivoSrsAjeno`), que es justo lo que hay que ver.
// **El tercero (`UTM_1.gml`) tampoco**: no trae referencia catastral, y sin
// referencia no hay parcelario que pedir — el cableado lo dice sin salir a la red.
// Léete `GUION.md` §13 antes de lanzarlo.
//
// ── ⚠️ ESTE GUION NECESITA `npm run dev`, NO `vite preview` ─────────────────
// Los ficheros de prueba se traen con `fetch` del propio servidor
// (`test/fixtures/gml/…`), y eso solo funciona en DEV: `vite preview` sirve
// `dist/`, donde los fixtures no están. Se hace así a propósito —y no
// empotrando una copia del GML en este fichero— porque un fixture copiado es un
// fixture que diverge, y este proyecto ya pagó un rechazo del IVG por derivar
// del fichero equivocado (SPEC §3.1). Si el `fetch` falla, el guion **para y lo
// dice**; no inventa un GML de repuesto.
//
// ── CÓMO SE LANZA ───────────────────────────────────────────────────────────
// Página recién cargada (el guion lo comprueba), `$B eval` desde la raíz:
//
//   $B viewport 1440x900
//   $B goto http://localhost:PUERTO/concretagml/
//   $B wait ".gml-tabla-vertices"
//   $B console --clear
//   $B network --clear
//   $B eval scripts/smoke-navegador/10-comprobar-gml.js
//   $B console --errors                              # → (no console errors)
//   $B network | grep -E "wfsCP"                     # → ≤ 2 peticiones de datos
//   $B screenshot .gstack/smoke-f08.png              # la evidencia para el §9
//
// ⚠️ Deja **el cajón de comprobación ABIERTO con el fichero del huso
// incoherente**, a propósito: la captura tiene que enseñar la tanda larga de
// notas sobre un GML ajeno, que es justo lo que el §9 del checklist manda leer en
// voz alta. Lo restaura el §17.4, y lo DECLARA en `estadoFinal`.
//
// ⛔ Lo que **cambió el 2026-08-02**: la parcela que queda en pantalla ya **no**
// es la del primer fichero, sino la de `UTM_1.gml` —a ~400 km—, y con **un
// vértice movido**. Es el precio de medir el reencuadre, y se paga a sabiendas:
// el §9 del checklist mira el CAJÓN, no el dataset.
//
// No lo encadenes antes de `02` (le contamina la cuenta de `GetMap`) ni de `06`
// (contrasta el `areaValue` contra el dataset de arranque, y este guion lo
// sustituye por la parcela del fichero). Para repetirlo:
// `$B reload && $B wait ".gml-tabla-vertices"`.
//
// ⚠️ NO envuelvas este fichero en una IIFE: `browse` ya lo envuelve ÉL en
// `(async()=>{ … })()` — por eso los `await` y el `return` de nivel superior son
// legales. Con una IIFE propia, el `eval` devuelve una promesa que nadie espera y
// el veredicto se pierde EN SILENCIO mientras los efectos (soltar ficheros,
// peticiones) sí ocurren. Consecuencia: `node --check` falla con «Illegal return
// statement», y es normal.

const t0 = performance.now()
const TOPE_TOTAL_MS = 120000
const agotado = () => performance.now() - t0 > TOPE_TOTAL_MS

const problemas = []
const advertencias = []

// El búfer de Resource Timing nace en 250 entradas y las teselas lo llenan:
// desbordado, la cuenta de peticiones de datos saldría corta SIN síntoma (la
// misma trampa que `07` y `09` declaran). Se amplía ANTES de contar nada.
if (performance.getEntriesByType('resource').length >= 250) {
  advertencias.push(
    'El búfer de Resource Timing ya estaba lleno al empezar: la cuenta de peticiones de datos ' +
      'puede quedarse corta. Repite con la página recién cargada.',
  )
}
performance.setResourceTimingBufferSize(2000)

// Excepciones no capturadas DURANTE el recorrido. No sustituye a
// `$B console --errors` (que ve el buffer entero de la sesión): añade la mitad
// que ese comando no puede atribuir, que es «esto reventó por lo que hizo ESTE
// guion». Se retiran al final, sin falta: un oyente vivo en `window` sobrevive
// al guion y contaminaría lo que venga detrás.
const excepciones = []
const alError = (e) => excepciones.push(String(e.message || e.type))
const alRechazo = (e) => excepciones.push(`unhandledrejection: ${String(e.reason)}`)
window.addEventListener('error', alError)
window.addEventListener('unhandledrejection', alRechazo)

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]
const redondear = (v, d = 2) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d)
const texto = (sel) => ($(sel) === null ? null : $(sel).textContent.trim())
const visible = (el) => el !== null && getComputedStyle(el).display !== 'none'

/** «1.535,87 m²» → 1535.87. Devuelve null si no hay número que leer. */
const leerNumero = (t) => {
  if (!t) return null
  const m = /-?[\d.]+(?:,\d+)?/.exec(t.replace('−', '-'))
  return m === null ? null : Number(m[0].replace(/\./g, '').replace(',', '.'))
}

/** Rectángulo entero de un selector, o `null`. Serializable. */
const rect = (sel) => {
  const el = typeof sel === 'string' ? $(sel) : sel
  if (el === null || el === undefined) return null
  const b = el.getBoundingClientRect()
  return {
    x: Math.round(b.left),
    y: Math.round(b.top),
    w: Math.round(b.width),
    h: Math.round(b.height),
    derecha: Math.round(b.right),
    abajo: Math.round(b.bottom),
  }
}

/** Área de solape de dos rectángulos, en px². 0 = no se pisan. */
function solape(a, b) {
  if (a === null || b === null) return null
  const ancho = Math.min(a.derecha, b.derecha) - Math.max(a.x, b.x)
  const alto = Math.min(a.abajo, b.abajo) - Math.max(a.y, b.y)
  return ancho <= 0 || alto <= 0 ? 0 : Math.round(ancho * alto)
}

/** Espera activa hasta que `condicion()` sea verdad o venza el plazo. */
async function esperar(condicion, ms, etiqueta, paso = 100) {
  const limite = performance.now() + ms
  while (performance.now() < limite) {
    if (condicion()) return true
    await new Promise((r) => setTimeout(r, paso))
  }
  advertencias.push(`Plazo agotado (${ms} ms) esperando: ${etiqueta}.`)
  return false
}

/** Alto de la caja de vértices: la cifra que este guion HEREDA de 08 §10 y 09 §5. */
const altoCajaVertices = () => {
  const caja = $('#tabla-vertices')
  return caja === null ? null : Math.round(caja.getBoundingClientRect().height)
}
const tarjetasDeAvisos = () => $$('#avisos .gml-aviso').length
const filasDeTabla = () => $$('#tabla-vertices tr[data-recinto="0"][data-indice]').length

/** Peticiones a los servicios de DATOS del Catastro vistas por Resource Timing. */
const peticionesDeDatos = () => {
  const entradas = performance.getEntriesByType('resource').map((e) => e.name)
  return {
    getParcel: entradas.filter((u) => u.includes('wfsCP') && !u.includes('Neighbour')).length,
    getNeighbour: entradas.filter((u) => u.includes('GetNeighbourParcel')).length,
  }
}

/**
 * Un `File` con los BYTES REALES del fixture. `arrayBuffer()` y no `text()`: la
 * mitad de F08 que importa es de nivel de byte (el fichero del WFS declara
 * `ISO-8859-1` y sus bytes son UTF-8), y `text()` los habría decodificado ya —
 * que es exactamente el error que `gml/decodificar.js` existe para no cometer.
 */
async function traerFixture(ruta, nombre) {
  const url = new URL(ruta, document.baseURI).href
  const respuesta = await fetch(url)
  if (!respuesta.ok) return { file: null, url, estado: respuesta.status }
  const bytes = await respuesta.arrayBuffer()
  return {
    file: new File([bytes], nombre, { type: 'application/gml+xml' }),
    url,
    estado: respuesta.status,
    bytes: bytes.byteLength,
  }
}

/**
 * El gesto: `dragenter` → `dragover` → `drop` sobre la VENTANA, que es donde
 * `app/zona-fichero.js` escucha. **No es un arrastre de ratón** (§0 del GUION):
 * es lo más parecido que `/browse` permite.
 */
function soltar(file) {
  const dt = new DataTransfer()
  dt.items.add(file)
  for (const tipo of ['dragenter', 'dragover', 'drop']) {
    window.dispatchEvent(new DragEvent(tipo, { bubbles: true, cancelable: true, dataTransfer: dt }))
  }
}

// ── Instrumental de los TRES ARREGLOS DEL CHECK VISUAL (§17) ────────────────
//
// Añadido el 2026-08-02, después de la FIRMA HUMANA de F08. Todo lo de aquí abajo
// sirve a las tres medidas del §17 del GUION y a nada más; se agrupa para que se
// vea de un vistazo qué le costó al guion medir lo que una persona vio en dos
// minutos.

/**
 * DÓNDE ESTÁ MIRANDO EL MAPA, sin tener el `L.Map` delante.
 *
 * Este guion corre dentro de la página pero **no tiene acceso al objeto mapa**:
 * `crearVisor` no lo publica en ningún global (a propósito: `app/main.js` lo dice
 * en su cabecera —`mapa.getSize()` ES `#mapa.clientWidth/clientHeight`, y por eso
 * no hace falta ningún `window.__gml`). Así que el encuadre se lee de donde SÍ es
 * observable: **el `src` de la imagen del WMS del Catastro**, que lleva su `BBOX`
 * en `EPSG:3857` y que `viewer/wms-catastro.js` reescribe UNA vez por encuadre
 * (criterio 2 de F03). El `src` se fija al PEDIR la imagen, así que está
 * disponible en cuanto hay `moveend`, sin esperar a que el servicio conteste.
 *
 * `null` si la capa superpuesta no está activa o todavía no ha pedido nada.
 *
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null}
 */
function bboxWms() {
  const img = $('img[alt="Cartografía catastral del encuadre actual"]')
  if (img === null || typeof img.src !== 'string' || img.src === '') return null
  const m = /[?&]BBOX=([^&]+)/i.exec(img.src)
  if (m === null) return null
  const n = decodeURIComponent(m[1]).split(',').map(Number)
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null
  return { minX: n[0], minY: n[1], maxX: n[2], maxY: n[3] }
}

/** Mercator esférico (EPSG:3857) → `[lon, lat]` en grados. Fórmula cerrada. */
function mercatorALonLat(x, y) {
  const R = 20037508.342789244
  const lon = (x / R) * 180
  const lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(((y / R) * 180 * Math.PI) / 180)) - Math.PI / 2)
  return [lon, lat]
}

/** Centro del encuadre actual en `[lon, lat]`, o `null`. */
function centroDelMapaLonLat() {
  const b = bboxWms()
  if (b === null) return null
  const [lon, lat] = mercatorALonLat((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2)
  return [redondear(lon, 6), redondear(lat, 6)]
}

/** Distancia entre dos `[lon, lat]` en km (haversine, R = 6371 km). */
function distanciaKm(a, b) {
  if (a === null || b === null) return null
  const rad = (g) => (g * Math.PI) / 180
  const dLat = rad(b[1] - a[1])
  const dLon = rad(b[0] - a[0])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2
  return redondear(2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))), 2)
}

/** Los marcadores de vértice del visor (`viewer/sincronizacion.js#CLASE.VERTICE`). */
const marcadores = () => $$('.leaflet-marker-icon.gml-vertice')

/** Centro en pantalla de un elemento, redondeado al píxel. */
function centroEnPantalla(el) {
  if (el === null || el === undefined) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
}

/** ¿Están TODOS los marcadores dentro del rectángulo del mapa? Con su cuenta. */
function marcadoresDentroDelMapa(rMapa) {
  const centros = marcadores().map(centroEnPantalla)
  const dentro = centros.filter(
    (c) => c !== null && c.x >= rMapa.x && c.x <= rMapa.derecha && c.y >= rMapa.y && c.y <= rMapa.abajo,
  )
  return { total: centros.length, dentro: dentro.length, todos: centros.length > 0 && dentro.length === centros.length }
}

/** Distancia de un punto a un segmento, en píxeles. */
function distanciaAlSegmento(p, a, b) {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const largo2 = vx * vx + vy * vy
  if (largo2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / largo2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy))
}

/**
 * Los LADOS de la parcela propia en coordenadas de pantalla, deducidos de los
 * marcadores de vértice (que son los mismos puntos, con layout real).
 *
 * @returns {Array<{a:{x:number,y:number}, b:{x:number,y:number}}>}
 */
function ladosEnPantalla() {
  const puntos = marcadores()
    .filter((el) => (el.title || '').startsWith('EXTERIOR'))
    .map(centroEnPantalla)
    .filter((p) => p !== null)
  const lados = []
  for (let i = 0; i < puntos.length; i++) {
    lados.push({ a: puntos[i], b: puntos[(i + 1) % puntos.length] })
  }
  return lados
}

/** Distancia mínima de un punto a cualquier lado de la parcela propia, en px. */
function distanciaAlLinderoMasCercano(p, lados) {
  let min = Infinity
  for (const { a, b } of lados) min = Math.min(min, distanciaAlSegmento(p, a, b))
  return min
}

/** ¿Hay un lindero SELECCIONADO? (`viewer/edicion.js#CLASE_EDICION.RESALTE`.) */
const hayLinderoSeleccionado = () => $('.gml-lado-seleccionado') !== null

/**
 * Un clic REAL sobre el punto `(x, y)` de la pantalla, despachado sobre el
 * elemento que de verdad está encima ahí (`elementFromPoint`). Sigue sin ser un
 * gesto de ratón (§0), pero **el destinatario lo elige el motor de layout y no el
 * guion**, que es justo lo que hace falta para preguntar «¿le roba la vecina el
 * clic al mapa?».
 */
function clicEnPantalla(x, y) {
  const destino = document.elementFromPoint(x, y)
  if (destino === null) return null
  // SOLO `click`, sin `mousedown`/`mouseup`: Leaflet no los necesita para su
  // evento de mapa y un `mousedown` suelto deja enganchado el `Draggable._dragging`
  // GLOBAL, que después impediría el arrastre de vértice del §17 (trampa 4 del §10
  // del GUION).
  destino.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      button: 0,
      buttons: 0,
      clientX: x,
      clientY: y,
    }),
  )
  return destino
}

/**
 * Arrastre SINTÉTICO de un marcador de vértice, calcado de `03-arrastre.js` (que
 * documenta las cinco trampas de `L.Draggable` que hay que acertar: `button:0`,
 * `mousemove` sobre `document.body` y no sobre `document`, pasos crecientes que
 * superen el `clickTolerance`, el `_dragging` global y el saneamiento previo).
 * **No es un gesto de ratón** (§0).
 *
 * @returns {Promise<boolean>}  `true` si Leaflet enganchó de verdad.
 */
async function arrastrarVertice(icono, dx, dy) {
  const base = { bubbles: true, cancelable: true, composed: true, view: window, button: 0 }
  const desde = centroEnPantalla(icono)
  document.body.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }))
  icono.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1, clientX: desde.x, clientY: desde.y }))
  let engancho = false
  for (const [px, py] of [[6, -2], [Math.round(dx * 0.5), Math.round(dy * 0.5)], [dx, dy]]) {
    document.body.dispatchEvent(
      new MouseEvent('mousemove', { ...base, buttons: 1, clientX: desde.x + px, clientY: desde.y + py }),
    )
    if (document.body.classList.contains('leaflet-dragging')) engancho = true
    await new Promise((r) => setTimeout(r, 24))
  }
  document.body.dispatchEvent(
    new MouseEvent('mouseup', { ...base, buttons: 0, clientX: desde.x + dx, clientY: desde.y + dy }),
  )
  return engancho
}

// ── 1 · Página recién cargada y F08 montada ─────────────────────────────────

const cajonComp = $('.gml-cajon-comprobacion')
const cajonDiag = $('.gml-cajon-diagnostico')
const botonAbrir = $('[data-accion="abrir-gml"]')
const inputFichero = $('.gml-zona-fichero-input')
const velo = $('.gml-soltar-superposicion')
const ctaDiag = $('[data-accion="diagnosticar"]')

if (cajonComp === null || botonAbrir === null || inputFichero === null || velo === null) {
  window.removeEventListener('error', alError)
  window.removeEventListener('unhandledrejection', alRechazo)
  return {
    guion: '10-comprobar-gml',
    ok: false,
    problemas: [
      'Falta alguna pieza de F08 en esta página: cajón `.gml-cajon-comprobacion` ' +
        `(${cajonComp !== null}), botón \`[data-accion="abrir-gml"]\` (${botonAbrir !== null}), ` +
        `\`input.gml-zona-fichero-input\` (${inputFichero !== null}), velo ` +
        `\`.gml-soltar-superposicion\` (${velo !== null}). F08 no está montada.`,
    ],
  }
}
if (cajonDiag === null || ctaDiag === null) {
  window.removeEventListener('error', alError)
  window.removeEventListener('unhandledrejection', alRechazo)
  return {
    guion: '10-comprobar-gml',
    ok: false,
    problemas: [
      'Falta el cajón de diagnóstico o su CTA: F08 termina EN F07 (el CTA se enciende solo), ' +
        'así que sin F07 montada este guion no puede medir su recorrido.',
    ],
  }
}

const superficieArranque = leerNumero(texto('[data-ficha="superficie"]'))
const paginaRecienCargada =
  filasDeTabla() === 15 && superficieArranque !== null && Math.abs(superficieArranque - 1535.87) < 0.02
if (!paginaRecienCargada) {
  problemas.push(
    `La página no está recién cargada sobre la parcela real (${filasDeTabla()} filas, superficie ` +
      `${JSON.stringify(texto('[data-ficha="superficie"]'))}): las medidas de este guion suponen el ` +
      'dataset de arranque. `$B reload` y vuelve a lanzarlo.',
  )
}

// La Decisión 5, comprobada por ESTRUCTURA: el botón vive en la fila del rótulo,
// al lado del `<h2>`, y no en un bloque propio. Es lo que hace que cueste 0 px.
const filaRotulo = botonAbrir.closest('.gml-rotulo-fila')
const arranque = {
  paginaRecienCargada,
  filas: filasDeTabla(),
  superficieFicha: superficieArranque,
  // Herencia de 08 §10 y 09 §5, medida en el MISMO estado (avisos vacíos).
  altoCajaVerticesPx: altoCajaVertices(),
  tarjetasDeAvisos: tarjetasDeAvisos(),
  cajonComprobacionCerrado: !visible(cajonComp),
  cajonDiagnosticoCerrado: !visible(cajonDiag),
  ctaDiagnosticoHabilitado: !ctaDiag.disabled,
  boton: {
    etiqueta: botonAbrir.tagName.toLowerCase(),
    texto: botonAbrir.textContent.trim(),
    enLaFilaDelRotulo: filaRotulo !== null,
    conRotuloAlLado: filaRotulo !== null && filaRotulo.querySelector('h2') !== null,
    // El coste en píxeles de la Decisión 5, medido: la fila del rótulo ya existía
    // y el botón cabe en su alto. Si esto creciera, se lo estaría comiendo a la
    // tabla de vértices.
    altoDeLaFilaPx: filaRotulo === null ? null : Math.round(filaRotulo.getBoundingClientRect().height),
  },
  input: {
    tipo: inputFichero.type,
    accept: inputFichero.accept,
    fueraDelTabulador: inputFichero.tabIndex === -1,
    ocultoAlLector: inputFichero.getAttribute('aria-hidden') === 'true',
    // NO `display:none` ni `hidden`: hay navegadores que se niegan a abrir el
    // selector de ficheros de un input que no se renderiza (lo razona el módulo).
    seRenderiza: getComputedStyle(inputFichero).display !== 'none' && !inputFichero.hidden,
    juntoAlBoton: inputFichero.previousElementSibling === botonAbrir,
  },
}
// El guardián de la caja de vértices, calcado de `09` y por el mismo motivo: caza
// un BLOQUE de los de 150-270 px entrando en el panel, no los píxeles del CTA.
// Referencia MEDIDA con F08 montada: 267 px (T3.3: 267,4375; los mismos que dejó
// F07, o sea que «Abrir un GML…» costó 0 px).
if (arranque.tarjetasDeAvisos === 0 && arranque.altoCajaVerticesPx !== null && arranque.altoCajaVerticesPx < 220) {
  problemas.push(
    `La caja de vértices arranca en ${arranque.altoCajaVerticesPx} px con la lista de avisos vacía ` +
      '(referencia medida: ~267 px, los mismos que dejó F07): algo del tamaño de un BLOQUE ha ' +
      'entrado en el panel, y la Decisión 5 de F08 era que el botón del rótulo costara 0 px.',
  )
}
if (!arranque.boton.enLaFilaDelRotulo || !arranque.boton.conRotuloAlLado) {
  problemas.push(
    'El botón «Abrir un GML…» no está dentro de un `.gml-rotulo-fila` con su `<h2>` al lado: la ' +
      'Decisión 5 de F08 es que vaya en la fila del rótulo, que es lo que hace que no le quite ' +
      'altura a la tabla de vértices.',
  )
}
if (arranque.boton.etiqueta !== 'button') {
  problemas.push(
    `«Abrir un GML…» es un <${arranque.boton.etiqueta}> y no un <button>: sin botón de verdad no ` +
      'hay foco, ni Enter, ni Espacio, ni anuncio del lector de pantalla.',
  )
}
if (!arranque.input.seRenderiza) {
  problemas.push(
    'El `<input type="file">` está oculto con `display:none` o con `hidden`: hay navegadores que ' +
      'se niegan a abrir el selector de ficheros de un input que no se renderiza, y el botón se ' +
      'quedaría mudo. Tiene que ir con el patrón «visually hidden» (1×1 px recortado).',
  )
}
if (!arranque.cajonComprobacionCerrado) problemas.push('El cajón de comprobación nace abierto.')
if (!arranque.cajonDiagnosticoCerrado) problemas.push('El cajón de diagnóstico está abierto antes de pulsar nada.')

// ── 2 · El material de prueba, del propio servidor ──────────────────────────

const traidoReal = await traerFixture(
  'test/fixtures/gml/cp_parcela_9398516VK3799G.gml',
  'cp_parcela_9398516VK3799G.gml',
)
const traidoHuso = await traerFixture(
  'test/fixtures/gml/derivados/cp_huso_incoherente.gml',
  'cp_huso_incoherente.gml',
)
// El TERCER fichero, y el único que trae OTRA parcela: el alta real de un
// particular en formato 3.0. Es lo que hace medible el reencuadre del §17 — los
// otros dos son la misma parcela `9398516VK3799G` que la de arranque, así que con
// ellos el mapa NO debe moverse (y esa mitad se mide en el §7 bis).
const traidoOtra = await traerFixture('test/fixtures/gml/UTM_1.gml', 'UTM_1.gml')
const material = {
  real: { url: traidoReal.url, estado: traidoReal.estado, bytes: traidoReal.bytes ?? null },
  husoIncoherente: { url: traidoHuso.url, estado: traidoHuso.estado, bytes: traidoHuso.bytes ?? null },
  otraParcela: { url: traidoOtra.url, estado: traidoOtra.estado, bytes: traidoOtra.bytes ?? null },
}
if (traidoReal.file === null) {
  window.removeEventListener('error', alError)
  window.removeEventListener('unhandledrejection', alRechazo)
  return {
    guion: '10-comprobar-gml',
    ok: false,
    material,
    problemas: [
      `No se ha podido traer el fixture (${traidoReal.estado}) de ${traidoReal.url}. Este guion ` +
        'necesita `npm run dev`: `vite preview` sirve `dist/`, donde los fixtures no están. Ver la ' +
        'cabecera.',
    ],
  }
}

// ── 3 · El arrastre: el velo se enciende y se apaga ─────────────────────────
//
// Sintético (§0). Lo que sí es real es todo lo demás: el `preventDefault` que
// impide que el navegador abra el fichero y se lleve la app entera por delante,
// el contador de profundidad, y un velo con `opacity` y `visibility` CALCULADAS
// por el motor de estilos, que en jsdom no existen.

const dt = new DataTransfer()
dt.items.add(traidoReal.file)
const emitir = (tipo) =>
  window.dispatchEvent(new DragEvent(tipo, { bubbles: true, cancelable: true, dataTransfer: dt }))

const veloAntes = {
  opacidad: Number(getComputedStyle(velo).opacity),
  visibilidad: getComputedStyle(velo).visibility,
  marcaEnElBody: document.body.dataset.arrastrando ?? null,
}
emitir('dragenter')
const sobrevuelo = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })
window.dispatchEvent(sobrevuelo)
// Dos fotogramas + el plazo de la transición: la opacidad la anima el CSS y
// leerla en el mismo tick daría el valor de partida (medido: 0).
await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
await new Promise((r) => setTimeout(r, 320))
const veloDurante = {
  opacidad: Number(getComputedStyle(velo).opacity),
  visibilidad: getComputedStyle(velo).visibility,
  // Suelo de seguridad del módulo: un velo a pantalla completa que capturase el
  // ratón dejaría la app inservible si el contador se quedara alto.
  punteroAtraviesa: getComputedStyle(velo).pointerEvents === 'none',
  marcaEnElBody: document.body.dataset.arrastrando ?? null,
  texto: velo.textContent.trim(),
  cubreLaVentana: (() => {
    const r = velo.getBoundingClientRect()
    return Math.round(r.width) >= window.innerWidth - 1 && Math.round(r.height) >= window.innerHeight - 1
  })(),
}
emitir('dragleave')
await new Promise((r) => setTimeout(r, 320))
const arrastre = {
  esGestoDeRatonReal: false,
  // La línea más cara del módulo: sin `preventDefault` en `dragover` el navegador
  // abre el fichero en la pestaña y se lleva la parcela y el historial.
  sobrevueloCancelado: sobrevuelo.defaultPrevented,
  veloAntes,
  veloDurante,
  veloDespues: {
    opacidad: Number(getComputedStyle(velo).opacity),
    marcaEnElBody: document.body.dataset.arrastrando ?? null,
  },
}
if (!arrastre.sobrevueloCancelado) {
  problemas.push(
    'El `dragover` NO se ha cancelado: sin ese `preventDefault` el navegador abre el fichero en la ' +
      'pestaña y la aplicación entera —parcela, historial, expediente— desaparece.',
  )
}
if (veloDurante.opacidad <= 0 || veloDurante.visibilidad !== 'visible') {
  problemas.push(
    `El velo de arrastre no se ve mientras se sobrevuela un fichero (opacidad ` +
      `${veloDurante.opacidad}, visibility ${veloDurante.visibilidad}): no hay ninguna señal de que ` +
      'se pueda soltar ahí.',
  )
}
if (!veloDurante.punteroAtraviesa) {
  problemas.push(
    'El velo de arrastre captura el ratón (`pointer-events` distinto de `none`): si el contador de ' +
      'profundidad se quedara alto por un `dragleave` perdido, la aplicación quedaría inservible y ' +
      'sin síntoma.',
  )
}
if (arrastre.veloDespues.marcaEnElBody !== null || arrastre.veloDespues.opacidad > 0) {
  problemas.push('Al salir el arrastre de la ventana el velo se queda puesto.')
}

// ── 4 · Soltar el fichero de verdad, y el invariante en el MISMO TICK ───────

const mapaEl = document.getElementById('mapa')
const mapaAntes = { ancho: mapaEl.clientWidth, alto: mapaEl.clientHeight }
const cajaAntesDeSoltar = altoCajaVertices()
const tarjetasAntesDeSoltar = tarjetasDeAvisos()

soltar(traidoReal.file)

// El recorrido `File → arrayBuffer → decodificar → comprobar → abrir` es
// asíncrono (una lectura de disco de por medio), así que «el mismo tick» aquí es
// el PRIMER macrotask en el que el cajón ya está abierto: se sondea con
// `setTimeout(0)` y se mide en el acto, antes de ningún otro gesto. La primera
// versión del guardián de F07 midió «un rato después» y acusó al cajón de 11 px
// que eran de otros renglones hablando.
const abrio = await esperar(() => visible(cajonComp), 10000, 'que el cajón de comprobación se abra', 0)
const cajaTrasAbrir = altoCajaVertices()
const tarjetasTrasAbrir = tarjetasDeAvisos()

if (!abrio) {
  problemas.push('Soltar el fichero no ha abierto el cajón de comprobación.')
}

const rectCajon = rect(cajonComp)
const rectMapa = rect(mapaEl)
const cajon = {
  abierto: visible(cajonComp),
  rect: rectCajon,
  dentroDelMapa:
    rectCajon !== null &&
    rectCajon.x >= rectMapa.x - 1 &&
    rectCajon.derecha <= rectMapa.derecha + 1 &&
    rectCajon.y >= rectMapa.y - 1 &&
    rectCajon.abajo <= rectMapa.abajo + 1,
  porcentajeDelLienzo:
    rectCajon === null ? null : redondear(((rectCajon.w * rectCajon.h) / (rectMapa.w * rectMapa.h)) * 100, 1),
  mapaIntacto: mapaEl.clientWidth === mapaAntes.ancho && mapaEl.clientHeight === mapaAntes.alto,
  titular: texto('[data-comp="titular"]'),
  fichero: texto('[data-comp="fichero"]'),
  queSignifica: texto('[data-comp="que-significa"]'),
  superficieDeclarada: texto('[data-comp="superficie-declarada"]'),
  superficieMedida: texto('[data-comp="superficie-medida"]'),
  vertices: texto('[data-comp="vertices"]'),
  srs: texto('[data-comp="srs"]'),
  renglon: texto('[data-estado="cajon-comprobacion"]'),
  contrastarHabilitado: !cajonComp.querySelector('[data-accion="contrastar-parcelario"]').disabled,
  notas: $$('[data-comp="notas"] li').length,
  bloqueos: $$('[data-comp="bloqueos"] li').length,
}
if (!cajon.dentroDelMapa) {
  problemas.push('El cajón de comprobación se sale del lienzo del mapa: no FLOTA, está empujando algo.')
}
if (!cajon.mapaIntacto) {
  problemas.push(
    `Abrir el cajón de comprobación ha cambiado el tamaño del mapa (${mapaAntes.ancho}×` +
      `${mapaAntes.alto} → ${mapaEl.clientWidth}×${mapaEl.clientHeight}): tenía que flotar sin ` +
      'quitarle un píxel.',
  )
}
if (cajon.fichero === null || !cajon.fichero.includes('cp_parcela_9398516VK3799G.gml')) {
  problemas.push(
    `El rótulo del cajón no nombra el fichero soltado: ${JSON.stringify(cajon.fichero)}. Es lo ` +
      'primero que un usuario coteja contra lo que tiene en el escritorio.',
  )
}
if (!cajon.contrastarHabilitado) {
  problemas.push(
    `«Contrastar con el parcelario» está apagado con el fichero real del WFS. Motivo escrito: ` +
      `${JSON.stringify(cajon.renglon)}.`,
  )
}

// EL INVARIANTE HEREDADO, en su segunda mitad: abrir el cajón no le quita altura
// a la caja de vértices. Aquí no hay renglón que descontar (a diferencia de `09`,
// donde el CTA del pie habla al abrirse): el cajón vive en el mapa y el panel no
// debería enterarse. Lo único que puede mover la cifra legítimamente es que el
// fichero produzca una tarjeta de aviso, y por eso se cuentan.
const soltarNoRoboAltura =
  cajaAntesDeSoltar !== null &&
  cajaTrasAbrir !== null &&
  (cajaTrasAbrir >= cajaAntesDeSoltar - 2 || tarjetasTrasAbrir > tarjetasAntesDeSoltar)
if (!soltarNoRoboAltura) {
  problemas.push(
    `Soltar el fichero le ha quitado altura a la caja de vértices (${cajaAntesDeSoltar} → ` +
      `${cajaTrasAbrir} px en el tick de la apertura, con las mismas ${tarjetasTrasAbrir} tarjetas ` +
      'de aviso): el cajón flota sobre el mapa y el panel no tenía que enterarse.',
  )
}

// ── 5 · El cajón no tapa NINGUNO de los cuatro controles del mapa ───────────
//
// Las cuatro esquinas del mapa estaban ocupadas antes de F08 (`topleft` el zoom y
// —hasta el 2026-08-05— la barra de edición, `topright` el control de capas,
// `bottomright` la opacidad y la atribución, `bottomleft` el cajón de F07). Esto
// es lo único que puede decir si compartir `bottomleft` salió bien: áreas de
// solape, en píxeles reales.

const vecinos = {
  barraEdicion: rect('.gml-barra-edicion'),
  controlCapas: rect('.leaflet-control-layers'),
  atribucion: rect('.leaflet-control-attribution'),
  controlOpacidad: rect('.gml-control-opacidad'),
  controlZoom: rect('.leaflet-control-zoom'),
}
const solapes = {}
for (const [nombre, r] of Object.entries(vecinos)) {
  solapes[nombre] = { rect: r, areaPx2: solape(rectCajon, r) }
  if (r === null) {
    advertencias.push(`No se ha encontrado «${nombre}» en el mapa: su solape con el cajón no se ha medido.`)
    continue
  }
  if (solapes[nombre].areaPx2 > 0) {
    problemas.push(
      `El cajón de comprobación tapa «${nombre}»: ${solapes[nombre].areaPx2} px² de solape. Las ` +
        'cuatro esquinas del mapa ya estaban ocupadas y el cajón no puede pisar ninguna.',
    )
  }
}
// La atribución, además, tiene que seguir VISIBLE: es obligación de licencia y no
// solo una cuestión de no pisarse (criterio 4 de F03, que `04` mide sin el cajón).
const atribucionVisible = (() => {
  const el = $('.leaflet-control-attribution')
  if (el === null) return null
  const e = getComputedStyle(el)
  return e.display !== 'none' && e.visibility !== 'hidden' && Number(e.opacity) > 0
})()
if (atribucionVisible === false) {
  problemas.push('Con el cajón de comprobación abierto la atribución deja de verse: es obligación de licencia.')
}

// ── 6 · La tipografía de los botones de los DOS cajones ─────────────────────
//
// La expectativa se DERIVA del token, no se copia: si `--font-sans` cambia, el
// guion sigue midiendo lo que hay que medir.

const fontSans = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
const familiaEsperada = (fontSans.split(',')[0] || '').trim().replace(/^["']|["']$/g, '')
const botonesDeCajon = [
  ['contrastar', cajonComp.querySelector('[data-accion="contrastar-parcelario"]')],
  ['descartar', cajonComp.querySelector('[data-accion="descartar-comprobacion"]')],
  ['descargar-informe', cajonDiag.querySelector('[data-accion="descargar-informe"]')],
  // El primario del pie de F09. Entra en la misma lista porque nació con el mismo
  // reparto —el módulo pone tamaño y grosor, la hoja pone la familia— y se rompería
  // igual: en silencio, y solo en navegador (en jsdom no hay cascada).
  ['preparar-informe', cajonDiag.querySelector('[data-accion="preparar-informe"]')],
]
const tipografia = {
  tokenFontSans: fontSans,
  familiaEsperada,
  botones: {},
  todosConLaFamiliaDeLaApp: true,
}
for (const [nombre, el] of botonesDeCajon) {
  if (el === null) {
    tipografia.botones[nombre] = null
    advertencias.push(`No se ha encontrado el botón «${nombre}»: su tipografía no se ha medido.`)
    continue
  }
  const calculada = getComputedStyle(el).fontFamily
  const cuadra = familiaEsperada !== '' && calculada.includes(familiaEsperada)
  tipografia.botones[nombre] = { fontFamily: calculada, cuadra }
  if (!cuadra) {
    tipografia.todosConLaFamiliaDeLaApp = false
    problemas.push(
      `El botón «${nombre}» se pinta en ${JSON.stringify(calculada)} y no con la familia de la ` +
        `aplicación (${JSON.stringify(familiaEsperada)}, de \`--font-sans\`). La regla de ` +
        '`estilos/app.css` para los botones de los dos cajones existe pero NO se está aplicando: ' +
        'los módulos fijan `font: inherit` EN LÍNEA sobre el botón, y el estilo en línea gana a la ' +
        'hoja, así que el botón hereda el `font: 13px/1.45 system-ui,sans-serif` que el propio ' +
        'módulo pone en el contenedor.',
    )
  }
}

// ── 7 · «Contrastar»: el parcelario, el store y F07 encendiéndose sola ──────

const antesDeContrastar = peticionesDeDatos()
const cajaAntesDeContrastar = altoCajaVertices()
const procedenciaEl = $('[data-procedencia="parcela"]')
const procedenciaAltoAntes = procedenciaEl === null ? 0 : Math.round(procedenciaEl.getBoundingClientRect().height)

// El campo de la referencia y sus dos botones DERIVADOS (§17). Nacen así: el
// campo VACÍO —`index.html` no le pone `value`— y los dos botones apagados.
const campoRefcatEl = $('[data-campo="refcat"]')
const botonDeducirEl = $('[data-accion="deducir-refcat"]')
const botonColindantesEl = $('[data-accion="traer-colindantes"]')
const campoAntesDeContrastar = campoRefcatEl === null ? null : campoRefcatEl.value
// La vista ANTES, para el §17: esta parcela es LA MISMA que la de arranque
// (el fixture es la descarga del WFS de `9398516VK3799G`, que es también el
// dataset de demostración), así que el mapa NO debe moverse — y esa mitad es tan
// importante como la otra.
const vistaAntesDeContrastar = centroDelMapaLonLat()

cajonComp.querySelector('[data-accion="contrastar-parcelario"]').click()
// El renglón del cajón es la única superficie donde contar la espera, y por eso
// «Contrastar» NO cierra el cajón en el clic: se lee en el acto.
const renglonDurante = texto('[data-estado="cajon-comprobacion"]')
const cerroSolo = await esperar(
  () => !visible(cajonComp),
  20000,
  'que el recorrido termine y el cajón se cierre (¿hay red?)',
)
const trasContrastar = peticionesDeDatos()
const cajaTrasContrastar = altoCajaVertices()
const procedenciaAltoDespues = procedenciaEl === null ? 0 : Math.round(procedenciaEl.getBoundingClientRect().height)

const procedencia = texto('[data-procedencia="parcela"]')
const contraste = {
  renglonDurante,
  cerroSolo,
  procedencia,
  // La procedencia es DOBLE y las dos mitades tienen dueños distintos. Un renglón
  // que dijera «Del Catastro» a secas convertiría el fichero de un tercero en un
  // dato oficial, y ése es EL error de producto de esta fase.
  nombraElFichero: (procedencia || '').includes('cp_parcela_9398516VK3799G.gml'),
  diceQueNoEsDelCatastro: /NO del Catastro/i.test(procedencia || ''),
  nombraElParcelario: /parcelario/i.test(procedencia || ''),
  filas: filasDeTabla(),
  superficieFicha: leerNumero(texto('[data-ficha="superficie"]')),
  superficieCatastral: leerNumero(texto('[data-ficha="superficie-catastral"]')),
  refcatFicha: texto('[data-ficha="refcat"]'),
  ctaDiagnosticoHabilitado: !ctaDiag.disabled,
  renglonCta: texto('[data-estado="diagnosticar"]'),
  tarjetasDeAvisos: tarjetasDeAvisos(),
}
if (!contraste.cerroSolo) {
  problemas.push(
    'El cajón de comprobación no se ha cerrado al terminar el recorrido: con la parcela ya en el ' +
      'store no tiene nada que decir, y lo que hay que mirar es el mapa.',
  )
}
if (!contraste.nombraElFichero || !contraste.diceQueNoEsDelCatastro || !contraste.nombraElParcelario) {
  problemas.push(
    `El renglón de procedencia no cuenta las DOS mitades: ${JSON.stringify(procedencia)}. La ` +
      'geometría es de un fichero de un tercero y el parcelario del Catastro; decir solo lo ' +
      'segundo convierte el fichero ajeno en un dato oficial.',
  )
}
if (!contraste.ctaDiagnosticoHabilitado) {
  problemas.push(
    `El CTA «Diagnosticar encaje» sigue apagado tras contrastar (motivo: ` +
      `${JSON.stringify(contraste.renglonCta)}): la promesa de F08 es que F07 se enciende SOLA en ` +
      'cuanto hay parcelario, sin una línea de código nuevo.',
  )
}
if (contraste.filas !== 15) {
  problemas.push(
    `La parcela del fichero ha entrado con ${contraste.filas} vértices y el fichero trae 15: la ` +
      'geometría que se contrasta es la del FICHERO, no la del WFS.',
  )
}
if (contraste.superficieCatastral === null) {
  advertencias.push(
    'La ficha no enseña superficie catastral: probablemente el parcelario no ha llegado. Las ' +
      'medidas que dependen de él quedan sin comprobar en esta corrida.',
  )
}

// ── 7 bis · EL CAMPO DE LA REFERENCIA, y que el mapa NO se mueva (§17) ──────
//
// Los dos defectos de esta sección son de la FIRMA HUMANA de F08, no de la suite:
//   · el campo se quedaba VACÍO con un fichero que trae referencia (defecto propio
//     de F08, en `app/cableado-comprobacion.js`);
//   · y aquí, además, se comprueba la mitad contraria del reencuadre (defecto
//     HEREDADO de F03/F05): la parcela del fichero es la MISMA que la de arranque
//     —el fixture es la descarga del WFS de `9398516VK3799G`, que es el dataset de
//     demostración—, así que la vista tiene que quedarse EXACTAMENTE donde estaba.
//     `refcat ?? idLocal` es la clave, y no la identidad del objeto.

/** Las dos mitades del campo: con referencia utilizable y sin ella. */
const campoRefcat = {
  queEs:
    'El campo `[data-campo="refcat"]` y sus dos botones DERIVADOS, que se encienden mirando el ' +
    'MODELO y no el campo: por eso una referencia huérfana en el campo los deja contradiciéndolo.',
  arranqueVacio: campoAntesDeContrastar === '',
  conReferencia: null,
  sinReferencia: null,
}
campoRefcat.conReferencia = {
  fichero: 'cp_parcela_9398516VK3799G.gml',
  valor: campoRefcatEl === null ? null : campoRefcatEl.value,
  canonica: campoRefcatEl !== null && campoRefcatEl.value === '9398516VK3799G',
  fichaRefcat: texto('[data-ficha="refcat"]'),
  // Coherencia campo ↔ modelo: con referencia en el modelo, «Deducir del mapa» se
  // APAGA (no hay nada que deducir) y «Traer colindantes» se ENCIENDE.
  deducirHabilitado: botonDeducirEl === null ? null : !botonDeducirEl.disabled,
  colindantesHabilitado: botonColindantesEl === null ? null : !botonColindantesEl.disabled,
}
campoRefcat.conReferencia.coherente =
  campoRefcat.conReferencia.canonica &&
  campoRefcat.conReferencia.deducirHabilitado === false &&
  campoRefcat.conReferencia.colindantesHabilitado === true
if (!campoRefcat.conReferencia.canonica) {
  problemas.push(
    `El campo «Referencia catastral» no trae la referencia del fichero en forma canónica: ` +
      `${JSON.stringify(campoRefcat.conReferencia.valor)} (se esperaba "9398516VK3799G"). El fichero ` +
      'la trae y el modelo la tiene; que el campo no la diga deja la pantalla contradiciéndose.',
  )
}
if (!campoRefcat.conReferencia.coherente) {
  problemas.push(
    `Los botones derivados no cuadran con la referencia cargada (deducir habilitado: ` +
      `${campoRefcat.conReferencia.deducirHabilitado}, colindantes habilitado: ` +
      `${campoRefcat.conReferencia.colindantesHabilitado}). Con referencia en el MODELO, «Deducir ` +
      'del mapa» no tiene nada que deducir y «Traer colindantes» sí tiene a quién preguntar.',
  )
}

const vistaTrasContrastar = centroDelMapaLonLat()
/** El reencuadre, primera mitad: la MISMA parcela no mueve la vista. */
const reencuadre = {
  queEs:
    'El mapa sigue a la parcela, pero no persigue al editor. La identidad es `refcat ?? idLocal` ' +
    '(viewer/index.js#claveDeParcela), NUNCA la del objeto: `edit/` reconstruye el POJO en cada ' +
    'operación.',
  comoSeLee:
    'El centro del encuadre se deduce del BBOX (EPSG:3857) que lleva el `src` de la imagen del WMS ' +
    'del Catastro: este guion no tiene el `L.Map` y la app no lo publica en ningún global.',
  mismaParcela: {
    antes: vistaAntesDeContrastar,
    despues: vistaTrasContrastar,
    desplazamientoKm: distanciaKm(vistaAntesDeContrastar, vistaTrasContrastar),
  },
}
if (vistaAntesDeContrastar === null || vistaTrasContrastar === null) {
  advertencias.push(
    'No se ha podido leer el BBOX del WMS del Catastro (¿capa superpuesta apagada?): el reencuadre ' +
      'se mide solo con los marcadores, sin cifras geográficas.',
  )
} else if (reencuadre.mismaParcela.desplazamientoKm > 0.001) {
  problemas.push(
    `Cargar la parcela del fichero ha MOVIDO el mapa ${reencuadre.mismaParcela.desplazamientoKm} km, ` +
      'y es la misma parcela que ya estaba (misma referencia catastral): el visor solo debe ' +
      'reencuadrar cuando entra una parcela con OTRA identidad, nunca al recargar la misma.',
  )
}

const red = {
  peticionesGetParcel: trasContrastar.getParcel - antesDeContrastar.getParcel,
  peticionesGetNeighbour: 0, // se rellena tras abrir el cajón de diagnóstico
  nota:
    'GetParcel puede ser 0 con la caché de IndexedDB dentro del TTL, y como mucho 1: la dispara UNA ' +
    'pulsación del usuario (override O8). El segundo fichero declara otro huso y no gasta nada.',
}
if (red.peticionesGetParcel > 1) {
  problemas.push(
    `${red.peticionesGetParcel} peticiones GetParcel para una sola pulsación de «Contrastar»: el ` +
      'régimen del override O8 es una pulsación, una petición.',
  )
}
if (red.peticionesGetParcel === 0) {
  // No es un fallo —es lo que la caché de F05 existe para hacer— pero SÍ limita
  // la medida: en esta pasada el recorrido no ha salido a la red, así que no dice
  // nada sobre CORS ni sobre el servicio. Mismo criterio que `07`.
  advertencias.push(
    'La caché de IndexedDB ya estaba caliente: «Contrastar» se ha servido de la copia local sin ' +
      'salir a la red (0 peticiones). El recorrido queda medido igual, pero esta pasada NO dice ' +
      'nada del servicio ni de CORS. Para medirlos, borra la base y recarga (GUION.md §13).',
  )
}

// El presupuesto de altura, otra vez: lo que la procedencia crece sale del mismo
// reparto de alto fijo del panel. Se mide y se ATRIBUYE, en vez de acusar al
// cajón de lo que ha escrito otro renglón (la lección de la primera corrida de
// `09`). Es la misma excepción legítima que allí se le hacía al renglón del CTA.
const procedenciaCrecioPx = Math.max(0, procedenciaAltoDespues - procedenciaAltoAntes)
const panel = {
  queEs: 'MEDIDA de layout real, sin juicio (regla de oro 9).',
  altoCajaVerticesAlArrancarPx: arranque.altoCajaVerticesPx,
  altoAntesDeSoltarPx: cajaAntesDeSoltar,
  altoTrasAbrirElCajonPx: cajaTrasAbrir,
  soltarNoRoboAltura,
  altoAntesDeContrastarPx: cajaAntesDeContrastar,
  altoTrasContrastarPx: cajaTrasContrastar,
  procedenciaAltoAntesPx: procedenciaAltoAntes,
  procedenciaAltoDespuesPx: procedenciaAltoDespues,
  procedenciaCrecioPx,
  contrastarNoRoboMasQueLaProcedencia:
    cajaAntesDeContrastar !== null &&
    cajaTrasContrastar !== null &&
    cajaAntesDeContrastar - cajaTrasContrastar <= procedenciaCrecioPx + 2,
  bloqueComprobacionEnElPanel: $('.gml-bloque--comprobacion') !== null,
  bloqueDiagnosticoEnElPanel: $('.gml-bloque--diagnostico') !== null,
}
if (panel.bloqueComprobacionEnElPanel) {
  problemas.push(
    'Hay un `.gml-bloque--comprobacion` en el panel: la Decisión 3 de F08 era exactamente que ese ' +
      'bloque NO existiera (el cajón flota sobre el mapa).',
  )
}
if (!panel.contrastarNoRoboMasQueLaProcedencia) {
  problemas.push(
    `Contrastar le ha quitado a la caja de vértices más de lo que ha crecido el renglón de ` +
      `procedencia (${panel.altoAntesDeContrastarPx} → ${panel.altoTrasContrastarPx} px, y la ` +
      `procedencia solo explica ${procedenciaCrecioPx} px): algo más del panel ha crecido.`,
  )
}

// ── 8 · F07 se abre, y los dos cajones nunca a la vez (camino 2 de 3) ───────

const antesDeVecinas = peticionesDeDatos()
ctaDiag.click()
await esperar(() => visible(cajonDiag), 5000, 'que el cajón de diagnóstico se abra')
await esperar(
  () => !/no se ha consultado/i.test(texto('[data-diag="invasion"]') || ''),
  12000,
  'las colindantes del WFS (GetNeighbourParcel)',
)
red.peticionesGetNeighbour = peticionesDeDatos().getNeighbour - antesDeVecinas.getNeighbour
if (red.peticionesGetNeighbour > 1) {
  problemas.push(
    `${red.peticionesGetNeighbour} peticiones GetNeighbourParcel para una sola apertura del cajón: ` +
      'el régimen del override O8 es una pulsación, una petición.',
  )
}

const exclusion = {
  // Camino 1: cualquier `estado.set` cierra el de comprobación (medido arriba, en
  // `contraste.cerroSolo`).
  alEntrarLaParcelaSeCierraElDeComprobacion: contraste.cerroSolo,
  conElDiagnosticoAbierto: {
    diagnostico: visible(cajonDiag),
    comprobacion: visible(cajonComp),
  },
}
if (exclusion.conElDiagnosticoAbierto.diagnostico && exclusion.conElDiagnosticoAbierto.comprobacion) {
  problemas.push('Los dos cajones están abiertos a la vez tras abrir el de diagnóstico: comparten `bottomleft`.')
}

// ── 8 bis · LAS PARCELAS VECINAS, DIBUJADAS (§17) ───────────────────────────
//
// Deuda de F05 encontrada en la FIRMA HUMANA de F08: las colindantes se traían,
// se publicaban por `alColindantes` y las consumían el snap de F06 y la invasión
// de F07 — pero **no las pintaba nadie**. Pulsar «Traer colindantes» dejaba el
// mapa exactamente igual mientras la ficha decía «12». Ningún test de la suite lo
// veía porque **ninguno afirmaba que se dibujaran**.
//
// Se mide justo aquí porque es AQUÍ donde llegan: abrir el cajón de diagnóstico
// pide las vecinas (una pulsación, una petición), y el tercer suscriptor de
// `alColindantes` las pinta en el mismo turno.

await esperar(() => $$('.gml-colindante').length > 0, 6000, 'los contornos de las parcelas vecinas')

const paneColindantes = $('.leaflet-colindantes-pane')
const paneParcelaOficial = $('.leaflet-parcelaOficial-pane')
const zIndexDe = (el) => (el === null ? null : Number(getComputedStyle(el).zIndex))
const contornos = $$('.gml-colindante')

const colindantes = {
  queEs: 'La capa `viewer/colindantes.js`, que hasta la firma humana de F08 no existía.',
  contornos: contornos.length,
  fichaDice: texto('[data-ficha="colindantes"]'),
  fichaCuenta: leerNumero(texto('[data-ficha="colindantes"]')),
  enSuPane: $$('.leaflet-colindantes-pane path.gml-colindante').length,
  zIndexPane: zIndexDe(paneColindantes),
  zIndexParcelaOficial: zIndexDe(paneParcelaOficial),
  // Un contorno sin relleno visible: `fillOpacity: 0` para que el interior entero
  // responda al emergente sin pintar ni un píxel (ver la cabecera del módulo).
  estilo:
    contornos.length === 0
      ? null
      : {
          stroke: contornos[0].getAttribute('stroke'),
          strokeWidth: contornos[0].getAttribute('stroke-width'),
          fillOpacity: contornos[0].getAttribute('fill-opacity'),
          interactiva: contornos[0].getAttribute('class').includes('leaflet-interactive'),
        },
}
colindantes.porDebajoDeLaParcela =
  colindantes.zIndexPane !== null &&
  colindantes.zIndexParcelaOficial !== null &&
  colindantes.zIndexPane < colindantes.zIndexParcelaOficial

if (colindantes.contornos === 0) {
  problemas.push(
    'No hay NI UN contorno `.gml-colindante` en el mapa con las vecinas ya traídas ' +
      `(la ficha dice ${JSON.stringify(colindantes.fichaDice)}): las colindantes se consultan, se ` +
      'usan por dentro y no se ven — que es exactamente el defecto que la firma humana de F08 ' +
      'encontró y que este bloque existe para que no vuelva.',
  )
}
if (colindantes.contornos > 0 && colindantes.enSuPane !== colindantes.contornos) {
  problemas.push(
    `${colindantes.contornos - colindantes.enSuPane} contorno(s) de vecina están fuera del pane ` +
      '`colindantes`: el pane es lo único que garantiza que una vecina no tape a la parcela propia ' +
      'en el lindero que COMPARTEN.',
  )
}
if (colindantes.contornos > 0 && !colindantes.porDebajoDeLaParcela) {
  problemas.push(
    `El pane de las colindantes (zIndex ${colindantes.zIndexPane}) no está por DEBAJO del de la ` +
      `parcela oficial (${colindantes.zIndexParcelaOficial}): una vecina comparte lindero con la ` +
      'propia, y dibujada encima pondría gris el lado compartido.',
  )
}
if (colindantes.fichaCuenta !== null && colindantes.contornos > colindantes.fichaCuenta) {
  problemas.push(
    `Hay ${colindantes.contornos} contornos en el mapa y la ficha cuenta ${colindantes.fichaCuenta} ` +
      'vecinas: el mapa dice más de lo que la ficha sabe.',
  )
}
if (colindantes.fichaCuenta !== null && colindantes.contornos < colindantes.fichaCuenta) {
  // No es un fallo: la capa AVISA cuando salta una vecina sin contorno dibujable.
  advertencias.push(
    `Se han pintado ${colindantes.contornos} de las ${colindantes.fichaCuenta} vecinas que cuenta la ` +
      'ficha. La capa avisa de las que no traen contorno dibujable; comprueba que hay tarjeta.',
  )
}

// El EMERGENTE con la referencia catastral. Exige `interactive: true`, que es de
// donde salía el riesgo del clic (abajo).
colindantes.emergente = { medido: false }
if (contornos.length > 0) {
  const r = contornos[0].getBoundingClientRect()
  const sobre = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
  contornos[0].dispatchEvent(
    new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: sobre.x,
      clientY: sobre.y,
    }),
  )
  await esperar(() => $('.gml-colindante-emergente') !== null, 1500, 'el emergente de la vecina')
  const emergenteEl = $('.gml-colindante-emergente')
  colindantes.emergente = {
    medido: true,
    aparece: emergenteEl !== null,
    texto: emergenteEl === null ? null : emergenteEl.textContent.trim(),
  }
  colindantes.emergente.traeReferencia =
    emergenteEl !== null && /^[0-9A-Z]{14,20}$/.test(colindantes.emergente.texto || '')
  colindantes.emergente.diceQueNoLaTrae =
    emergenteEl !== null && /sin referencia catastral/i.test(colindantes.emergente.texto || '')
  contornos[0].dispatchEvent(
    new MouseEvent('mouseout', { bubbles: true, cancelable: true, composed: true, view: window }),
  )
  if (!colindantes.emergente.aparece) {
    problemas.push(
      'Pasar por encima de una vecina no enseña ningún emergente: sin la referencia catastral, un ' +
        'contorno gris no dice de quién es y la capa sería un adorno.',
    )
  } else if (!colindantes.emergente.traeReferencia && !colindantes.emergente.diceQueNoLaTrae) {
    problemas.push(
      `El emergente de la vecina dice ${JSON.stringify(colindantes.emergente.texto)}, que no es una ` +
        'referencia catastral ni el texto de «sin referencia».',
    )
  }
}

// ── EL RIESGO QUE SE MIDIÓ Y QUEDÓ DESPEJADO ────────────────────────────────
// El emergente obliga a `interactive: true`, y una capa interactiva puede ROBARLE
// EL CLIC AL MAPA — que es «Deducir del mapa» de F05 y la selección de lindero de
// F06. Aquí se comprueba con la app viva y con el motor de layout eligiendo el
// destinatario: se pincha en un punto donde `elementFromPoint` devuelve el
// `<path>` de una VECINA, y se mira si el mapa reaccionó **con la coordenada del
// puntero** (selecciona el lindero que hay debajo si cae dentro de los 12 px de
// `UMBRAL_PUNTERIA_PX`, y deselecciona si cae lejos).
//
// ⚠️ Y una cosa que solo se ve con la app entera delante: **el clic de «Deducir
// del mapa» y unas colindantes dibujadas NO PUEDEN COEXISTIR en esta aplicación**.
// La deducción se arma solo con una parcela SIN referencia catastral
// (`puedeDeducirDe`), y las vecinas se piden POR referencia y se sueltan en cuanto
// entra otra parcela. Así que aquí se mide lo que sí se puede medir y es lo mismo
// que estaba en juego: que el clic ATRAVIESA la vecina y llega al mapa con su
// coordenada. Que además la deducción quede armada al cargar una parcela sin
// referencia se mide en el §17.
const lados = ladosEnPantalla()
const buscarPuntoSobreVecina = (predicado) => {
  for (let y = rectMapa.y + 8; y < rectMapa.abajo - 8; y += 7) {
    for (let x = rectMapa.x + 8; x < rectMapa.derecha - 8; x += 7) {
      const p = { x, y }
      if (!predicado(p)) continue
      const el = document.elementFromPoint(x, y)
      if (el !== null && typeof el.getAttribute === 'function') {
        const clase = el.getAttribute('class') || ''
        if (clase.includes('gml-colindante')) return p
      }
    }
  }
  return null
}
const puntoCerca = buscarPuntoSobreVecina((p) => {
  const d = distanciaAlLinderoMasCercano(p, lados)
  return d >= 3 && d <= 9
})
const puntoLejos = buscarPuntoSobreVecina((p) => distanciaAlLinderoMasCercano(p, lados) > 40)

colindantes.clicAlMapa = { medido: false }
if (puntoCerca === null || puntoLejos === null) {
  advertencias.push(
    'No se han encontrado los dos puntos que necesita la prueba del clic sobre una vecina ' +
      `(cerca del lindero: ${JSON.stringify(puntoCerca)}, lejos: ${JSON.stringify(puntoLejos)}): el ` +
      'riesgo del robo del clic queda sin medir en esta corrida.',
  )
} else {
  const bajoCerca = document.elementFromPoint(puntoCerca.x, puntoCerca.y)
  const bajoLejos = document.elementFromPoint(puntoLejos.x, puntoLejos.y)
  clicEnPantalla(puntoLejos.x, puntoLejos.y)
  await new Promise((r) => setTimeout(r, 120))
  const seleccionInicial = hayLinderoSeleccionado()
  clicEnPantalla(puntoCerca.x, puntoCerca.y)
  await new Promise((r) => setTimeout(r, 120))
  const seleccionaAlPincharCerca = hayLinderoSeleccionado()
  clicEnPantalla(puntoLejos.x, puntoLejos.y)
  await new Promise((r) => setTimeout(r, 120))
  const deseleccionaAlPincharLejos = !hayLinderoSeleccionado()

  colindantes.clicAlMapa = {
    medido: true,
    queEs:
      'Con el `<path>` de una vecina ENCIMA del punto pinchado, ¿reacciona el mapa con la ' +
      'coordenada del puntero? Si la capa robara el clic, la selección de lindero no se movería.',
    puntoCercaDeLindero: puntoCerca,
    puntoLejosDeLindero: puntoLejos,
    encimaCerca: bajoCerca === null ? null : bajoCerca.getAttribute('class'),
    encimaLejos: bajoLejos === null ? null : bajoLejos.getAttribute('class'),
    seleccionInicial,
    seleccionaAlPincharCerca,
    deseleccionaAlPincharLejos,
    elClicLlegaAlMapa: seleccionaAlPincharCerca && deseleccionaAlPincharLejos,
    nota:
      'La deducción de F05 no se puede ejercitar A LA VEZ que esto: se arma solo con una parcela ' +
      'SIN referencia catastral, y sin referencia no hay vecinas que pedir. Ver el §17.',
  }
  if (!colindantes.clicAlMapa.elClicLlegaAlMapa) {
    problemas.push(
      'Un clic sobre el contorno de una parcela vecina NO llega al mapa con la coordenada del ' +
        `puntero (selecciona cerca: ${seleccionaAlPincharCerca}, deselecciona lejos: ` +
        `${deseleccionaAlPincharLejos}). La capa de colindantes es interactiva porque su emergente ` +
        'lo exige, y si le roba el clic al mapa se lleva por delante «Deducir del mapa» de F05 y la ' +
        'selección de lindero de F06. La salida está decidida: la capa se queda sin emergente y con ' +
        '`interactive:false`.',
    )
  }
}

// Los clics de arriba burbujean hasta `document`, donde vive el guardián de
// clic-fuera del cajón de F07: si lo han cerrado, se reabre —cuesta 0 peticiones,
// las vecinas ya están adoptadas— porque el §9 mide la descarga del informe CON
// EL CAJÓN ABIERTO, y sin eso su guardián sería vacuo.
colindantes.cerroElCajonDeDiagnostico = !visible(cajonDiag)
if (colindantes.cerroElCajonDeDiagnostico) {
  const antesDeReabrir = peticionesDeDatos()
  ctaDiag.click()
  await esperar(() => visible(cajonDiag), 5000, 'reabrir el cajón de diagnóstico tras los clics')
  const trasReabrir = peticionesDeDatos()
  colindantes.peticionesAlReabrir =
    trasReabrir.getParcel - antesDeReabrir.getParcel + (trasReabrir.getNeighbour - antesDeReabrir.getNeighbour)
  if (colindantes.peticionesAlReabrir > 0) {
    problemas.push(
      `Reabrir el cajón de diagnóstico ha gastado ${colindantes.peticionesAlReabrir} petición(es): ` +
        'las vecinas ya estaban adoptadas y no había nada que volver a pedir.',
    )
  }
}

// ── 9 · El informe de contraste: BYTES, no una promesa ──────────────────────
//
// Mismo patrón de captura que `06` (GUION.md §12) y con la misma promesa: los
// tres envoltorios se restauran en un `finally` y el veredicto lo DECLARA. Un
// guion que deja la página parcheada convierte en mentira todo lo que se mida
// después de él.

const botonInforme = cajonDiag.querySelector('[data-accion="descargar-informe"]')
const crearUrlOriginal = URL.createObjectURL
const revocarUrlOriginal = URL.revokeObjectURL
const crearElementoOriginal = document.createElement
const teniaCreateElementPropio = Object.prototype.hasOwnProperty.call(document, 'createElement')

const blobs = []
const hrefsCreados = []
const hrefsRevocados = []
const anclas = []

URL.createObjectURL = function (objeto) {
  const href = crearUrlOriginal.call(URL, objeto)
  blobs.push(objeto)
  hrefsCreados.push(href)
  return href
}
URL.revokeObjectURL = function (href) {
  hrefsRevocados.push(href)
  return revocarUrlOriginal.call(URL, href)
}
document.createElement = function (etiqueta, ...resto) {
  const el = crearElementoOriginal.call(document, etiqueta, ...resto)
  if (String(etiqueta).toLowerCase() === 'a') anclas.push(el)
  return el
}

const informeHabilitadoAntes = !botonInforme.disabled
const diagnosticoAbiertoAntesDeDescargar = visible(cajonDiag)
let excepcionAlDescargar = null
try {
  botonInforme.click()
} catch (error) {
  excepcionAlDescargar = `${error.name}: ${error.message}`
} finally {
  URL.createObjectURL = crearUrlOriginal
  URL.revokeObjectURL = revocarUrlOriginal
  if (teniaCreateElementPropio) document.createElement = crearElementoOriginal
  else delete document.createElement
}
await new Promise((r) => setTimeout(r, 200))

const restaurado =
  URL.createObjectURL === crearUrlOriginal &&
  URL.revokeObjectURL === revocarUrlOriginal &&
  document.createElement === crearElementoOriginal
const ancla = anclas.find((a) => typeof a.download === 'string' && a.download.length > 0) || null
const contenido = blobs.length > 0 ? await blobs[0].text() : null
// EL título: la primera línea que no es en blanco ni una regla de `=`. Se busca
// así y no «las primeras N líneas» porque la cabecera del informe trae, a dos
// párrafos del título, el desmentido que NOMBRA la VGA y el IVG para negarlos —
// y un umbral de líneas los metía en el mismo saco (medido: la primera versión
// de este guion salió roja sobre un informe correcto).
const lineasInforme = (contenido || '').split('\n')
const tituloInforme = lineasInforme.find((l) => l.trim() !== '' && !/^=+$/.test(l.trim())) ?? null

const informe = {
  habilitadoAntesDePulsar: informeHabilitadoAntes,
  excepcionAlDescargar,
  blobsCapturados: blobs.length,
  bytes: blobs.length > 0 ? blobs[0].size : null,
  tipo: blobs.length > 0 ? blobs[0].type : null,
  revocaLaQueCreo:
    hrefsCreados.length === hrefsRevocados.length && hrefsCreados.every((h, i) => h === hrefsRevocados[i]),
  restaurado,
  nombreDelAncla: ancla === null ? null : ancla.download,
  anclaFueraDelDom: ancla === null ? null : !document.body.contains(ancla),
  renglon: texto('[data-estado="informe-contraste"]'),
  // El contenido, por AFIRMACIONES y no por snapshot: el snapshot es de la suite
  // (test/report/), aquí lo que se comprueba es que los bytes que baja el
  // navegador son ESE informe y no un fichero vacío.
  titulo: tituloInforme === null ? null : tituloInforme.trim(),
  titulaComoTocaLegalmente:
    /^INFORME DE CONTRASTE CON EL PARCELARIO CATASTRAL$/i.test((tituloInforme || '').trim()),
  // ⚠️ Aquí NO se puede buscar «validación gráfica» en todo el documento, y la
  // primera versión de este guion lo hizo y salió ROJA sobre un informe
  // CORRECTO. VGA/IVG son documentos oficiales con CSV y un nombre casi homónimo
  // hace creer al cliente que ya presentó algo, así que
  // `report/contraste-texto.js` los nombra tres veces A PROPÓSITO: dos para
  // DESMENTIRLOS («Este documento NO es la validación gráfica alternativa
  // (VGA)…», y otra vez en el pie) y una tercera en otro sentido («la validación
  // completa» de la geometría, que es F02). Lo que hay que comprobar son las dos
  // cosas de verdad: que el desmentido ESTÉ, y que el documento no se LLAME así.
  desmienteSerLaValidacionGrafica:
    /NO es la validaci[oó]n gr[aá]fica alternativa \(VGA\)/i.test(contenido || ''),
  seLlamaValidacionGraficaEnElTitulo: /validaci[oó]n\s+gr[aá]fica/i.test(tituloInforme || ''),
  // ⚠️ REESCRITO EN F09 (T4.2). Hasta el 2026-08-02 aquí se buscaba «provisional»,
  // porque el informe se llamaba a sí mismo «VERSIÓN PROVISIONAL EN TEXTO» y decía
  // que el firmable «todavía no existe». F09 lo trajo, así que el desmentido se
  // reescribió: lo que hay que medir ahora son las DOS mitades que siguen siendo
  // verdad —que este documento no lleva pie de firma, y que REMITE al que sí lo
  // lleva por el nombre de su botón—. El `\s+` no es aseo: el párrafo va justificado
  // a lo ancho y el rótulo se puede partir por un salto de línea.
  diceQueNoLlevaPieDeFirma: /sin\s+pie\s+de\s+firma/i.test(contenido || ''),
  remiteAlInformeFirmable: /«Preparar\s+informe\s+\(PDF\)»/i.test(contenido || ''),
  // Y que la frase caducada no haya vuelto: un desmentido viejo se sigue leyendo con
  // la misma cara de cierto que uno vigente.
  siguePresumiendoDeQueElFirmableNoExiste: /todav[ií]a\s+no\s+existe/i.test(contenido || ''),
  nombraElFicheroDeOrigen: (contenido || '').includes('cp_parcela_9398516VK3799G.gml'),
  lineas: contenido === null ? null : contenido.split('\n').length,
  // Y la mitad que solo se ve aquí: ¿sigue el cajón donde se acaba de escribir el
  // desenlace?
  diagnosticoAbiertoAntesDeDescargar,
  diagnosticoSigueAbierto: visible(cajonDiag),
}
if (excepcionAlDescargar !== null) {
  problemas.push(`Pulsar «Descargar informe de contraste» ha LANZADO: ${excepcionAlDescargar}.`)
}
if (!restaurado) {
  problemas.push(
    'El guion NO ha restaurado los envoltorios de `URL.createObjectURL` / `URL.revokeObjectURL` / ' +
      '`document.createElement`: la página queda parcheada y cualquier medida posterior es sospechosa.',
  )
}
if (informe.blobsCapturados !== 1) {
  problemas.push(
    `Se esperaba EXACTAMENTE 1 llamada a URL.createObjectURL al pulsar «Descargar informe» y ha ` +
      `habido ${informe.blobsCapturados}. Renglón: ${JSON.stringify(informe.renglon)}.`,
  )
}
if (informe.bytes !== null && informe.bytes === 0) {
  problemas.push('El informe ha bajado con 0 bytes: un fichero vacío es peor que ningún fichero.')
}
if (informe.blobsCapturados > 0 && !informe.revocaLaQueCreo) {
  problemas.push(
    `La URL de blob del informe NO se ha revocado (o se ha revocado otra): creadas ` +
      `${JSON.stringify(hrefsCreados)}, revocadas ${JSON.stringify(hrefsRevocados)}.`,
  )
}
if (!informe.titulaComoTocaLegalmente) {
  problemas.push(
    `El informe descargado no se titula «Informe de contraste con el parcelario catastral» sino ` +
      `${JSON.stringify(informe.titulo)}.`,
  )
}
if (!informe.desmienteSerLaValidacionGrafica) {
  problemas.push(
    'El informe descargado NO desmiente ser la validación gráfica alternativa (VGA) ni el informe ' +
      'de validación gráfica (IVG): son un procedimiento y un documento OFICIALES con código ' +
      'seguro de verificación, y sin ese desmentido escrito el cliente puede creer que descargar ' +
      'este fichero presenta algo ante la Sede.',
  )
}
if (informe.seLlamaValidacionGraficaEnElTitulo) {
  problemas.push(
    'El bloque del título del informe se llama a sí mismo «validación gráfica»: ése es el nombre ' +
      'de un documento oficial del Catastro y este no lo es.',
  )
}
if (!informe.diceQueNoLlevaPieDeFirma) {
  problemas.push(
    'El informe descargado no dice que NO lleva pie de firma: sin eso, un texto con el nombre legal ' +
      'del documento y todas las cifras dentro se puede presentar como si estuviera firmado.',
  )
}
if (!informe.remiteAlInformeFirmable) {
  problemas.push(
    'El informe descargado no remite al documento firmable por el nombre de su botón («Preparar ' +
      'informe (PDF)»): decir lo que falta sin decir dónde está es media regla de oro 1.',
  )
}
if (informe.siguePresumiendoDeQueElFirmableNoExiste) {
  problemas.push(
    'El informe descargado sigue diciendo que el documento firmable «todavía no existe». Lo trajo ' +
      'F09 el 2026-08-02: el aviso caducó y ahora es falso, pero se lee con la misma cara de cierto.',
  )
}
if (!informe.nombraElFicheroDeOrigen) {
  problemas.push(
    'El informe descargado no nombra el fichero del que salió la geometría: sin eso, el documento ' +
      'no dice de quién es la medición que contrasta.',
  )
}
if (informe.diagnosticoAbiertoAntesDeDescargar && !informe.diagnosticoSigueAbierto) {
  problemas.push(
    'Pulsar «Descargar informe de contraste» CIERRA el cajón de diagnóstico, y el desenlace ' +
      `(${JSON.stringify(informe.renglon)}) se escribe en un renglón que acaba de desaparecer: el ` +
      'usuario no llega a leer que su fichero ha bajado, ni el motivo si no baja. La causa está ' +
      'medida: `gml/descargar.js` cuelga el `<a download>` del `<body>` y su `click()` sintético ' +
      'burbujea hasta `document`, donde el guardián de clic-fuera de F07 lo cuenta como un clic ' +
      'fuera del cajón (`disableClickPropagation` no detiene el `click`).',
  )
}

// ── 10 · Un GML AJENO con una tanda larga de notas ──────────────────────────
//
// El riesgo que el plan de F08 mandó expresamente a este guion: «`validarParcela`
// sobre un GML ajeno escupe una tanda larga de hallazgos y empuja el panel […]
// hay que mirarlo con un fichero malo de verdad: va al guion 10». Y de paso el
// camino 2 de la exclusión mutua: soltar un fichero NO es un clic, así que el
// guardián de clic-fuera de F07 no se entera y su cajón se quedaría abierto
// debajo si nadie lo cerrara.

const ficheroLargo = { medido: false }
if (traidoHuso.file === null) {
  advertencias.push(
    `No se ha podido traer ${traidoHuso.url} (${traidoHuso.estado}): el caso del GML ajeno con ` +
      'una tanda larga de notas queda sin medir en esta corrida.',
  )
} else {
  // El cajón de diagnóstico tiene que estar ABIERTO para medir el camino 2. Si el
  // defecto de la descarga lo cerró, se reabre — y se dice, porque reabrirlo no
  // cuesta ninguna petición (las vecinas ya están adoptadas).
  const huboQueReabrir = !visible(cajonDiag)
  if (huboQueReabrir) {
    ctaDiag.click()
    await esperar(() => visible(cajonDiag), 5000, 'reabrir el cajón de diagnóstico')
  }
  const antesDelSegundo = peticionesDeDatos()
  const diagnosticoAbiertoAntes = visible(cajonDiag)

  soltar(traidoHuso.file)
  await esperar(() => visible(cajonComp), 10000, 'que el cajón se abra con el segundo fichero', 0)

  const rectLargo = rect(cajonComp)
  const b1 = cajonComp.querySelector('[data-accion="contrastar-parcelario"]')
  const b2 = cajonComp.querySelector('[data-accion="descartar-comprobacion"]')
  const scrollPrevio = cajonComp.scrollTop
  cajonComp.scrollTop = cajonComp.scrollHeight
  const dentroDelCajon = (el) => {
    const r = el.getBoundingClientRect()
    return r.top >= rectLargo.y - 1 && r.bottom <= rectLargo.abajo + 1
  }
  const botonesAlcanzables = dentroDelCajon(b1) && dentroDelCajon(b2)
  cajonComp.scrollTop = scrollPrevio

  ficheroLargo.medido = true
  ficheroLargo.huboQueReabrirElDiagnostico = huboQueReabrir
  ficheroLargo.diagnosticoAbiertoAntes = diagnosticoAbiertoAntes
  ficheroLargo.diagnosticoSeCerroAlAbrirLaComprobacion = diagnosticoAbiertoAntes && !visible(cajonDiag)
  ficheroLargo.notas = $$('[data-comp="notas"] li').length
  ficheroLargo.hallazgos = $$('[data-comp="hallazgos"] tbody tr').length
  ficheroLargo.bloqueos = $$('[data-comp="bloqueos"] li').length
  ficheroLargo.srs = texto('[data-comp="srs"]')
  ficheroLargo.rect = rectLargo
  ficheroLargo.mismoTamanoQueConElLimpio = rectLargo !== null && rectCajon !== null && rectLargo.h === rectCajon.h
  ficheroLargo.dentroDelMapa =
    rectLargo !== null &&
    rectLargo.x >= rectMapa.x - 1 &&
    rectLargo.derecha <= rectMapa.derecha + 1 &&
    rectLargo.y >= rectMapa.y - 1 &&
    rectLargo.abajo <= rectMapa.abajo + 1
  ficheroLargo.cajonHaceScroll = cajonComp.scrollHeight > cajonComp.clientHeight + 1
  ficheroLargo.botonesAlcanzables = botonesAlcanzables
  // Fuera de huso es una NOTA, no un fallo: el recorrido CONTINÚA (regla de oro
  // 9 y criterio 2 de la spec).
  ficheroLargo.contrastarSigueHabilitado = !b1.disabled
  ficheroLargo.tarjetasDeAvisos = tarjetasDeAvisos()
  ficheroLargo.altoCajaVerticesPx = altoCajaVertices()
  ficheroLargo.peticionesGastadas =
    peticionesDeDatos().getParcel - antesDelSegundo.getParcel +
    (peticionesDeDatos().getNeighbour - antesDelSegundo.getNeighbour)

  if (diagnosticoAbiertoAntes && visible(cajonDiag)) {
    problemas.push(
      'Soltar un fichero con el cajón de diagnóstico abierto deja los DOS abiertos: soltar no es un ' +
        'clic, así que el guardián de clic-fuera de F07 no se entera y el cierre tiene que hacerlo ' +
        'el cableado de F08.',
    )
  }
  if (!ficheroLargo.dentroDelMapa) {
    problemas.push(
      'Con un GML de notas largas el cajón se sale del lienzo del mapa: el tope de alto no está ' +
        'sujetándolo.',
    )
  }
  if (!ficheroLargo.botonesAlcanzables) {
    problemas.push(
      'Con un GML de notas largas los botones «Contrastar» y «Descartar» no se alcanzan ni haciendo ' +
        'scroll dentro del cajón: el usuario ve el problema y no la salida.',
    )
  }
  if (!ficheroLargo.contrastarSigueHabilitado) {
    problemas.push(
      'Con coordenadas fuera del huso declarado el recorrido se DETIENE: el criterio 2 dice que eso ' +
        'sale como nota, no como fallo, y `puedeContinuar` es capacidad y no mérito.',
    )
  }
  if (ficheroLargo.peticionesGastadas > 0) {
    problemas.push(
      `Soltar el segundo fichero ha gastado ${ficheroLargo.peticionesGastadas} petición(es) sin que ` +
        'nadie pulse «Contrastar»: la consulta al Catastro la dispara el usuario (override O8).',
    )
  }
}

// ── 11 · La tercera vía, DECLARADA y no resuelta ────────────────────────────
//
// T4.1 blindó dos de los tres caminos y dejó el tercero por escrito: pulsar
// «Diagnosticar encaje» en el pie con el cajón de comprobación abierto abre el de
// F07 sin tocar el store, así que los dos quedan apilados en vertical. No se
// resuelve porque la única forma sería escuchar el clic del CTA de otra feature,
// y ese cable se rompe en silencio. Aquí NO se convierte en un fallo: se MIDE, se
// publica con su alto apilado, y quien decide si molesta es el checklist §9.

const terceraVia = { medida: false }
if (visible(cajonComp) && !ctaDiag.disabled) {
  ctaDiag.click()
  await esperar(() => visible(cajonDiag), 5000, 'el cajón de diagnóstico de la tercera vía')
  const rc = rect(cajonComp)
  const rd = rect(cajonDiag)
  terceraVia.medida = true
  terceraVia.losDosAbiertos = visible(cajonComp) && visible(cajonDiag)
  terceraVia.comprobacion = rc
  terceraVia.diagnostico = rd
  terceraVia.altoApiladoPx = rc !== null && rd !== null ? Math.max(rc.abajo, rd.abajo) - Math.min(rc.y, rd.y) : null
  terceraVia.seSalenDelMapa =
    rc !== null && rd !== null && (Math.min(rc.y, rd.y) < rectMapa.y - 1 || Math.max(rc.abajo, rd.abajo) > rectMapa.abajo + 1)
  terceraVia.seSolapan = solape(rc, rd)
  terceraVia.nota =
    'DECLARADO Y NO RESUELTO por T4.1: es el tercero de los tres caminos y el único sin blindar. ' +
    'No cuenta como fallo aquí (ver la cabecera y el §9 del checklist humano); se mide para que ' +
    'quien lo juzgue tenga la cifra delante.'
  // Se deja SOLO el de comprobación abierto: es lo que tiene que enseñar la
  // captura del §9 (la tanda larga de notas sobre un GML ajeno).
  const cerrarDiag = cajonDiag.querySelector('[data-accion="cerrar-diagnostico"]')
  if (cerrarDiag !== null) cerrarDiag.click()
}

// ── 17 · EL MAPA SIGUE A LA PARCELA, Y NO PERSIGUE AL EDITOR (§17) ──────────
//
// El defecto que la FIRMA HUMANA de F08 destapó y que ningún test de la suite
// podía ver: `encuadrar()` se llamaba UNA sola vez, al construir el visor. Se
// traía una parcela de Sevilla o se soltaba un GML de Cádiz y **el mapa seguía
// mirando la parcela de demostración**. El dibujo estaba hecho —a cientos de
// kilómetros de la vista—, así que la app parecía no hacer nada.
//
// La suite no lo veía por construcción: **todas sus pruebas traen su geometría a
// mano y la app arranca ya encuadrada sobre ella**, así que la única pregunta que
// importaba —«¿y cuando entra OTRA?»— no se hacía en ninguna parte.
//
// Va AQUÍ, al final, por dos motivos: carga una parcela distinta (y deja de haber
// parcelario, así que el CTA de F07 se apaga y los §§10 y 11 ya no se podrían
// medir), y el arrastre de vértice deja la geometría movida a propósito.

// ── 17.1 · Editar NO mueve el mapa ──────────────────────────────────────────
// La mitad que más importa de las dos: un mapa que se recentra mientras se
// arrastra un vértice es peor que un mapa quieto, porque el vértice se escapa del
// puntero. `edit/` reconstruye el POJO en cada operación (regla de oro 4), así que
// comparar identidades de objeto diría «otra parcela» en CADA frame del arrastre.

const panelMapaEl = $('.leaflet-map-pane')
const iconos = marcadores()
const iconoArrastrado = iconos.find((el) => (el.title || '') === 'EXTERIOR · vértice 1') ?? iconos[0] ?? null
const iconoReferencia =
  iconos.find((el) => (el.title || '') === 'EXTERIOR · vértice 8') ??
  iconos.find((el) => el !== iconoArrastrado) ??
  null

const editar = { medido: false }
if (iconoArrastrado === null || iconoReferencia === null) {
  advertencias.push(
    'No hay marcadores suficientes para el arrastre del §17: «editar no mueve el mapa» queda sin ' +
      'medir en esta corrida.',
  )
} else {
  const transformAntes = panelMapaEl === null ? null : panelMapaEl.style.transform
  const referenciaAntes = centroEnPantalla(iconoReferencia)
  const bboxAntes = bboxWms()
  const superficieAntes = texto('[data-ficha="superficie"]')

  const engancho = await arrastrarVertice(iconoArrastrado, 40, -28)
  await esperar(
    () => texto('[data-ficha="superficie"]') !== superficieAntes,
    3000,
    'que el arrastre del §17 llegue al store',
  )

  const referenciaDespues = centroEnPantalla(iconoReferencia)
  editar.medido = true
  editar.esGestoDeRatonReal = false
  editar.engancho = engancho
  editar.laGeometriaCambio = texto('[data-ficha="superficie"]') !== superficieAntes
  editar.transformDelMapa = { antes: transformAntes, despues: panelMapaEl === null ? null : panelMapaEl.style.transform }
  editar.verticeDeReferencia = { antes: referenciaAntes, despues: referenciaDespues }
  editar.desplazamientoPx =
    referenciaAntes === null || referenciaDespues === null
      ? null
      : Math.round(Math.hypot(referenciaDespues.x - referenciaAntes.x, referenciaDespues.y - referenciaAntes.y))
  editar.bbox = { antes: bboxAntes, despues: bboxWms() }
  editar.elMapaSeQuedoQuieto = editar.desplazamientoPx !== null && editar.desplazamientoPx <= 1

  if (!editar.engancho) {
    advertencias.push(
      'El arrastre sintético del §17 no ha enganchado en `L.Draggable` (`leaflet-dragging` nunca ' +
        'apareció en el `<body>`): la medida de «editar no mueve el mapa» queda debilitada. Ver la ' +
        'trampa 4 del §10 del GUION.',
    )
  }
  if (!editar.laGeometriaCambio) {
    advertencias.push(
      'El arrastre del §17 no ha cambiado la superficie: sin edición efectiva, «editar no mueve el ' +
        'mapa» no afirma gran cosa.',
    )
  }
  if (editar.laGeometriaCambio && !editar.elMapaSeQuedoQuieto) {
    problemas.push(
      `Editar la parcela ha MOVIDO el mapa: un vértice que no se ha tocado se ha desplazado ` +
        `${editar.desplazamientoPx} px en pantalla. El visor solo debe reencuadrar cuando entra una ` +
        'parcela con OTRA identidad; recentrar durante una edición le escapa el vértice al puntero y ' +
        'rompe F06 entera.',
    )
  }
}

// ── 17.2 · Entrar OTRA parcela SÍ mueve el mapa ─────────────────────────────

const reencuadreOtra = { medido: false }
if (traidoOtra.file === null) {
  advertencias.push(
    `No se ha podido traer ${traidoOtra.url} (${traidoOtra.estado}): el reencuadre con otra parcela ` +
      'queda sin medir en esta corrida.',
  )
} else {
  const vistaAntes = centroDelMapaLonLat()
  const bboxAntesDeViajar = bboxWms()
  const contornosAntes = $$('.gml-colindante').length
  const antesDeLaTercera = peticionesDeDatos()

  soltar(traidoOtra.file)
  const abrioTercero = await esperar(() => visible(cajonComp), 8000, 'el cajón con UTM_1.gml', 0)
  const botonContrastar = cajonComp.querySelector('[data-accion="contrastar-parcelario"]')
  const contrastarHabilitado = botonContrastar !== null && !botonContrastar.disabled

  reencuadreOtra.abrioElCajon = abrioTercero
  reencuadreOtra.fichero = texto('[data-comp="fichero"]')
  reencuadreOtra.contrastarHabilitado = contrastarHabilitado
  reencuadreOtra.renglon = texto('[data-estado="cajon-comprobacion"]')

  if (!contrastarHabilitado) {
    problemas.push(
      `Con \`UTM_1.gml\` (formato 3.0, alta real sin referencia catastral) el recorrido se DETIENE: ` +
        `${JSON.stringify(reencuadreOtra.renglon)}. Que la Sede ya no admita el 3.0 es una NOTA; la ` +
        'parcela se enseña igual (criterio 2).',
    )
  } else {
    botonContrastar.click()
    await esperar(() => !visible(cajonComp), 12000, 'que UTM_1.gml entre en el expediente')
    // El encuadre se lee del `src` del WMS, que se reescribe en el `moveend` del
    // reencuadre. Se espera a que CAMBIE, no un plazo fijo.
    const cambio = await esperar(
      () => {
        const b = bboxWms()
        return b !== null && (bboxAntesDeViajar === null || b.minX !== bboxAntesDeViajar.minX || b.minY !== bboxAntesDeViajar.minY)
      },
      8000,
      'que el WMS pida el encuadre NUEVO',
    )
    const vistaDespues = centroDelMapaLonLat()
    const rMapaAhora = rect(mapaEl)
    const dentro = marcadoresDentroDelMapa(rMapaAhora)

    reencuadreOtra.medido = true
    reencuadreOtra.filas = filasDeTabla()
    reencuadreOtra.fichaRefcat = texto('[data-ficha="refcat"]')
    reencuadreOtra.elWmsPidioOtroEncuadre = cambio
    reencuadreOtra.vistaAntes = vistaAntes
    reencuadreOtra.vistaDespues = vistaDespues
    reencuadreOtra.laVistaViajoKm = distanciaKm(vistaAntes, vistaDespues)
    reencuadreOtra.marcadores = dentro
    reencuadreOtra.contornosDeVecinasAntes = contornosAntes
    reencuadreOtra.contornosDeVecinasDespues = $$('.gml-colindante').length
    reencuadreOtra.peticionesGastadas =
      peticionesDeDatos().getParcel - antesDeLaTercera.getParcel +
      (peticionesDeDatos().getNeighbour - antesDeLaTercera.getNeighbour)

    if (reencuadreOtra.laVistaViajoKm !== null && reencuadreOtra.laVistaViajoKm < 1) {
      problemas.push(
        `Ha entrado OTRA parcela (${reencuadreOtra.filas} vértices, a cientos de km de la anterior) y ` +
          `la vista se ha movido ${reencuadreOtra.laVistaViajoKm} km: el mapa sigue mirando donde ` +
          'estaba. Es el defecto que la firma humana de F08 destapó: el dibujo se hace, pero fuera ' +
          'de la pantalla, así que la app parece no hacer nada.',
      )
    }
    if (!dentro.todos) {
      problemas.push(
        `Tras cargar otra parcela, ${dentro.total - dentro.dentro} de sus ${dentro.total} vértices ` +
          'caen FUERA del lienzo del mapa: el encuadre tiene que contener la geometría entera.',
      )
    }
    if (reencuadreOtra.contornosDeVecinasDespues > 0) {
      problemas.push(
        `Han quedado ${reencuadreOtra.contornosDeVecinasDespues} contornos de las colindantes de la ` +
          'parcela ANTERIOR con otra parcela ya cargada: unas vecinas huérfanas son una mentira sobre ' +
          'el mapa (siguen diciendo «esto linda con lo tuyo»), y a 400 km ni siquiera se ve que se ' +
          'han quedado atrás.',
      )
    }
    if (reencuadreOtra.peticionesGastadas > 0) {
      problemas.push(
        `Cargar \`UTM_1.gml\` ha gastado ${reencuadreOtra.peticionesGastadas} petición(es): no trae ` +
          'referencia catastral, así que no hay parcelario que pedir y el cableado debe decirlo sin ' +
          'salir a la red.',
      )
    }

    // ── 17.3 · El campo, cuando el fichero NO trae referencia utilizable ────
    // La decisión CONTRARIA a la de la vía del Catastro, y razonada: allí el campo
    // es lo que el usuario TECLEÓ y no se le quita; aquí manda el fichero, que
    // afirma que esta parcela no tiene referencia. Dejar la anterior sería peor que
    // el hueco: el campo hablaría de una parcela que ya no está en pantalla, y
    // «Deducir del mapa» —que mira el MODELO— se encendería al lado de una
    // referencia perfectamente escrita, que es lo único que ese botón promete que
    // no hace falta.
    campoRefcat.sinReferencia = {
      fichero: 'UTM_1.gml',
      valor: campoRefcatEl === null ? null : campoRefcatEl.value,
      vacio: campoRefcatEl !== null && campoRefcatEl.value === '',
      fichaRefcat: texto('[data-ficha="refcat"]'),
      deducirHabilitado: botonDeducirEl === null ? null : !botonDeducirEl.disabled,
      colindantesHabilitado: botonColindantesEl === null ? null : !botonColindantesEl.disabled,
    }
    campoRefcat.sinReferencia.coherente =
      campoRefcat.sinReferencia.vacio &&
      campoRefcat.sinReferencia.deducirHabilitado === true &&
      campoRefcat.sinReferencia.colindantesHabilitado === false
    if (!campoRefcat.sinReferencia.vacio) {
      problemas.push(
        `El campo «Referencia catastral» se ha quedado con ` +
          `${JSON.stringify(campoRefcat.sinReferencia.valor)} después de cargar un fichero que NO ` +
          'trae referencia: está hablando de una parcela que ya no está en pantalla.',
      )
    }
    if (!campoRefcat.sinReferencia.coherente) {
      problemas.push(
        `Con el campo vacío, los botones derivados no cuadran (deducir habilitado: ` +
          `${campoRefcat.sinReferencia.deducirHabilitado}, colindantes habilitado: ` +
          `${campoRefcat.sinReferencia.colindantesHabilitado}). Sin referencia en el modelo, ` +
          '«Deducir del mapa» sí tiene algo que hacer y «Traer colindantes» no tiene a quién ' +
          'preguntar.',
      )
    }
  }
}

// ── 17.4 · Se restaura el estado que la captura del §9 necesita ─────────────
// El guion tiene que TERMINAR con el cajón de comprobación abierto sobre el GML
// ajeno de notas largas: es lo que el §9 del checklist humano manda leer en voz
// alta. Soltar otra vez ese fichero no cuesta ninguna petición (no se pulsa
// «Contrastar»), y se DECLARA en vez de dejarlo implícito.
const estadoFinal = { restaurado: false }
if (traidoHuso.file !== null) {
  soltar(traidoHuso.file)
  estadoFinal.restaurado = await esperar(
    () => visible(cajonComp),
    8000,
    'reabrir el cajón con el GML ajeno para la captura',
  )
  estadoFinal.fichero = texto('[data-comp="fichero"]')
  estadoFinal.notas = $$('[data-comp="notas"] li').length
  estadoFinal.parcelaEnPantalla = {
    filas: filasDeTabla(),
    refcat: texto('[data-ficha="refcat"]'),
    nota:
      'Desde el §17 la parcela cargada es la de `UTM_1.gml` y la geometría está EDITADA a propósito ' +
      '(un vértice movido): la captura enseña el cajón, no el dataset de arranque.',
  }
}

// ── Consola y cierre ────────────────────────────────────────────────────────

window.removeEventListener('error', alError)
window.removeEventListener('unhandledrejection', alRechazo)

const consola = {
  queEs: 'Excepciones no capturadas y rechazos de promesa DURANTE este guion. El buffer entero es de `$B console --errors` (§6).',
  excepcionesNoCapturadas: excepciones.length,
  detalle: excepciones.slice(0, 10),
}
if (excepciones.length > 0) {
  problemas.push(
    `${excepciones.length} excepción(es) no capturada(s) durante el recorrido: ` +
      `${JSON.stringify(excepciones.slice(0, 3))}. El criterio 2 exige que ni un SRS inesperado ni ` +
      'unas coordenadas fuera de huso produzcan una excepción.',
  )
}

if (agotado()) {
  advertencias.push(`Presupuesto de tiempo agotado (${TOPE_TOTAL_MS} ms): repite con la página recién cargada.`)
}

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '10-comprobar-gml',
  feature: 'F08',
  tarea: 'T6.2',
  criterios: [1, 2, 3, 4],
  url: location.href,
  ok: problemas.length === 0,
  esGestoDeRatonReal: false,
  aviso:
    'El arrastre es un `DataTransfer` fabricado y unos eventos despachados a mano: `/browse` no ' +
    'tiene comando `drag` (§0). Prueba el módulo entero con layout, CSS y bytes reales, pero ' +
    'arrastrar un fichero desde el explorador de Windows con la mano es otra cosa y queda en el ' +
    'checklist humano §9.1. La lectura —si el cajón se entiende, si las notas suenan a regañina, si ' +
    'alguna se lee como un veredicto sobre otro técnico— también es del §9.',
  duracionMs: redondear(performance.now() - t0, 0),
  material,
  arranque,
  arrastre,
  cajon,
  solapes,
  atribucionVisible,
  tipografia,
  contraste,
  campoRefcat,
  red,
  panel,
  exclusion,
  colindantes,
  informe,
  ficheroLargo,
  terceraVia,
  reencuadre: { ...reencuadre, editar, otraParcela: reencuadreOtra },
  estadoFinal,
  consola,
  noCubierto: [
    'El arrastre con un ratón de verdad desde el explorador de archivos (§0): aquí es sintético.',
    'Que pulsar «Abrir un GML…» abra el selector de ficheros del sistema operativo: ningún guion ve ese diálogo.',
    'Los ficheros que solo existen en la suite (multiparcela, edificio, SRS no soportado): aquí se sueltan tres —el limpio, uno ajeno de notas largas y un alta real en 3.0 de OTRA parcela—. Los cuatro criterios los mide test/comprobacion/aceptacion-f08.dom.test.js.',
    'La tercera vía de la exclusión mutua se MIDE (ver `terceraVia`) pero no se juzga: está declarada y no resuelta por T4.1.',
    'La DEDUCCIÓN por clic en el mapa (F05) no se ejercita: se arma solo con una parcela SIN referencia catastral, y sin referencia no hay colindantes que dibujar — las dos condiciones son incompatibles en esta app. Lo que sí se mide es que el clic ATRAVIESA la vecina y llega al mapa con su coordenada (`colindantes.clicAlMapa`).',
    'La parcela ANÓNIMA (sin refcat ni idLocal), que no se reencuadra y avisa una vez: no hay vía en la interfaz para cargar una, y lo cubre test/viewer/index.dom.test.js.',
  ],
  problemas,
  advertencias,
}
