// scripts/smoke-navegador/13-edificio.js — F11 · Tarea T5.2.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// LA SEGUNDA RAMA (F11) en un navegador de verdad, a 1440×900, y **solo lo que
// ahí se puede medir**. La suite ya cubre el modelo (`test/model/edificio*`), el
// lector de GML BU (`test/gml/parse-bu*`), la entrada (`test/edificio/entrada*`),
// las mutaciones, el cliente del `wfsBU`, el conmutador en jsdom
// (`test/app/rama.dom.test.js`), el panel (`test/app/panel-edificio.dom.test.js`)
// y el cableado (`test/app/cableado-edificio.dom.test.js`); **aquí no se vuelve a
// medir nada de eso**. Se miden las ocho cosas que jsdom no puede dar:
//
//   1. ⭐ **EL GUARDIÁN DE ANCHO DEL CONMUTADOR, QUE SOLO EXISTE AQUÍ.** La
//      sección de F11 de `estilos/app.css` lo dice con estas palabras: «el
//      guardián no es de altura, es de ANCHO, y lo pone el guion de humo 13». El
//      porqué está MEDIDO en la fase 0 y corrige al plan, que pedía
//      `flex-wrap: nowrap` para `.gml-chips`:
//        · con `nowrap` la fila se queda en sus 25,39 px y la tabla intacta,
//          **pero el elemento que no cabe SE SALE 102,53 px** (`scrollWidth` 476
//          contra `clientWidth` 343) y `.gml-panel` es `overflow: hidden`, o sea
//          que **lo recorta en silencio**;
//        · con `wrap` —que es lo que hay, a propósito— el fallo AL MENOS SE VE:
//          la fila salta de línea y cuesta **20,28–29,19 px** según qué salte.
//      Entre un fallo caro que se ve y uno gratis que no se ve, este proyecto
//      elige siempre el primero — y entonces hace falta alguien que MIDA el
//      ancho. Ese alguien es {@link SUELO_HOLGURA}: sobre `.gml-chips`,
//      **`saltoDeLinea === false`** y **`holguraPx > 24`**. Cifras de partida
//      (T0.3·2, 2026-08-03, Chrome 1440×900): el conmutador ocupa **116,17 px de
//      los 169,28 libres** ⇒ **46,11 px de holgura**. Traducido: los rótulos
//      «Parcela» y «Edificio» **no pueden crecer**, igual que «Expediente» no
//      puede crecer en la fila del rótulo (F10, 21 px de holgura).
//   2. ⭐ **M10 EN UN NAVEGADOR DE VERDAD, IDA Y VUELTA.** La regla dura de
//      `app/rama.js` —el intercambio es `seccion.hidden`, JAMÁS
//      `replaceChildren`— se midió en la fase 0 en jsdom y en navegador; aquí se
//      vuelve a medir **con la aplicación entera montada**, que es donde de
//      verdad hay 30 nodos de `app/` resueltos una sola vez en el montaje. Se
//      comprueba, sobre el campo de la referencia catastral de PARCELA: que tras
//      ir a EDIFICIO y volver sea **el mismo nodo** (identidad `===`), que siga
//      `isConnected`, que **conserve su valor** y que **sus oyentes sigan
//      disparando** (una sonda propia del guion; ver {@link sondaRefcat}).
//      Y con él vuelven los dos CTA del pie, que `cablearRama` apaga con el
//      motivo escrito al lado y tiene que **restaurar exactamente**.
//   3. **EL INVARIANTE DE LOS 267,44 px, Y LAS TRES CIFRAS DE M8 DESPUÉS.** F11
//      tenía que ser **la SEXTA fase seguida a coste 0 px** (F06 dejó la caja de
//      vértices en 303, F07 en 267 con su CTA, F08 en 267 con «Abrir un GML…»,
//      F09 en 267 porque su interfaz es un modal, F10 en 267 porque «Expediente»
//      cabe en el alto de línea del `<h2>`). Las tres cifras de M8 son el ancho
//      libre de `.gml-chips`, el alto de `.gml-panel-cabecera` (117,13 px ANTES →
//      117,13 px DESPUÉS) y el alto de la caja de vértices (267,44 → 267,44).
//      ⚠️ **El invariante vale SOLO en la rama PARCELA**, y eso no es una
//      excepción: en EDIFICIO la caja que se estira es `.gml-partes` y arranca
//      ~42 px por debajo, porque el bloque «Origen del edificio» cuesta 42,07 px
//      más que el de parcela. Las dos cifras se publican por separado.
//   4. **QUE LAS HUELLAS SE VEN, Y ENCIMA DE LA PARCELA.** `viewer/partes.js`
//      pinta un `<path class="gml-huella">` por parte en el pane `partes`
//      (**zIndex 422**), entre la parcela editada (420) y los vértices (430). Se
//      comprueba **el orden REAL de los panes en el DOM**, no solo que existan
//      los `<path>`: un pane con el zIndex bien puesto y el `<path>` colgando de
//      otro sitio se vería igual de mal. Y el color: violeta claro `#A78BFA`,
//      elegido por descarte para no confundirse con el amarillo `#FFD600` del
//      usuario, que en esta rama sigue en pantalla como CONTEXTO justo debajo.
//   5. **SOLTAR UN `.dxf` DE VERDAD, EN LAS DOS RAMAS.** El destino se resuelve
//      por la RAMA ACTIVA (`app/main.js`, paso 9, resolución tardía), así que el
//      mismo fichero son dos documentos distintos:
//        · con la rama EDIFICIO produce partes (y huellas en el mapa);
//        · con la rama PARCELA **no carga nada y lo DICE** — reabrir un dibujo
//          como parcela es la otra mitad de la asimetría que dejó F10 y no entra
//          en F11. «No ha pasado nada» es lo único que no se puede interpretar.
//      Se usan dos fixtures reales: `poly_clasica.dxf` (una sola capa ⇒ vía
//      directa, sin diálogo) y `edificio_consulta_masiva_3515508VF0831N.dxf`
//      (**7 anillos en `Construccion` + 1 en `Parcela`** ⇒ diálogo de reparto).
//      ⚠️ En el diálogo, **marcar una casilla por asignación de `.checked` NO
//      dispara `change`**, y «Aplicar» nace `disabled` con su motivo al lado: hay
//      que despachar el suceso. Se mide **también el camino ingenuo**, para dejar
//      escrito que el gate lo gobierna un `change` y no un sondeo.
//   6. **LA FICHA DEL PIE CAMBIA DE CARA.** En EDIFICIO quedan **CUATRO** pares
//      de los ocho —se ocultan el `<dd>` **y** su `<dt>` de Perímetro, Superficie
//      catastral, Δ catastral y Colindantes— y dos cambian de pregunta:
//      «Vértices» ⇢ «Partes» y «Superficie» ⇢ «Superficie en planta». T0.3·8 dijo
//      que recortarla a 4 pares libera **75,75 px**: aquí se mide cuántos libera
//      de verdad.
//   7. **EL PANEL NUEVO, CON SU TIPOGRAFÍA Y SU TOPE.** La sección de F11 del CSS
//      se escribió **en paralelo con los módulos que fabrican el marcado y sin
//      verlos**, citando el contrato K en vez de copiarlo. El único fallo
//      silencioso que ese reparto puede producir es una regla escrita contra un
//      nombre que nadie pone — y el propio fichero dice que «el guion de humo 13
//      es quien lo caza». Así que aquí no basta con que las clases existan: se
//      comprueba que **la regla LLEGA** (`inline-flex` en el conmutador,
//      `flex-grow: 1` en `.gml-bloque--partes`, `overflow-y: auto` y el
//      `max-height` en `.gml-partes`). Y la tipografía se DERIVA del token
//      `--font-sans` del `:root`, no de un literal copiado — es el defecto que
//      destapó el guion `10`.
//      ⚠️ **Y el tope `--gml-partes-alto-max: 26vh` NO es lo que sostiene
//      «Generar GML» a la vista**, corregido al medirlo en T1.6: a 1440×900 son
//      234,00 px contra los 225,22 px que le quedan al estirador, o sea que **no
//      llega a morder**. Quien sostiene el pie es el reparto flex
//      (`flex: 1 1 auto` + `min-height: 0`); el tope es la RED para cuando esa
//      cadena se rompa. Se miden las dos cifras y se dice cuál manda.
//   8. **CONSOLA LIMPIA Y RÉGIMEN DE RED.** Leer un dibujo no consulta nada:
//      **cero peticiones a los servicios de DATOS del Catastro**. Ver el apartado
//      de abajo, que tiene un matiz que no se puede omitir.
//
// ── ⚠️ CÓMO SE CLASIFICA LA RED, Y POR QUÉ NO POR `STOREDQUERIE_ID` ─────────
// **`STOREDQUERIE_ID` lo usan LOS DOS endpoints** del Catastro —el de parcela y
// el de edificio—, así que clasificar por ese parámetro manda las peticiones de
// parcela a la rama de edificio. Está medido en la fase 0 de F11 y es una trampa
// preparada. Aquí se distingue por **`wfsCP.aspx` / `wfsBU.aspx`**, que es lo
// único que las separa. Ver {@link peticiones}.
//
// ⚠️ **Y «soltar un fichero no dispara ni una petición» es cierto del DIBUJO y
// falso de la CARTOGRAFÍA**, así que se publican dos cifras y no una: cargar un
// edificio **encuadra el mapa sobre sus huellas** (`encuadrarSobreRecintos`), y
// mover el mapa pide teselas. Eso no es leer el dibujo: es el mapa moviéndose. Lo
// que sí sería un defecto —que abrir un DXF consultara al Catastro— es la cifra
// de `datosCatastro`, y ésa tiene que ser **0**.
//
// ── QUÉ **NO** PUEDE MEDIR — LÉELO ANTES DE CITAR ESTE GUION ────────────────
//
//   · **NO es un gesto de ratón** (§0 del GUION): los clics son `el.click()`, el
//     arrastre es un `DataTransfer` fabricado y los sucesos van despachados a
//     mano. Que el conmutador se pueda pulsar con el dedo, que el objetivo de
//     ~25 px sea cómodo y que la casilla del diálogo de capas se marque sin
//     apuntar dos veces es del checklist humano §12.
//   · **NO toca el `wfsBU`.** El servicio de edificios del Catastro se puede
//     medir entero con ficheros locales en esta fase, y el override O8 pide una
//     pasada sin bucles: la vía en vivo es del checklist §12, con su régimen.
//   · **NO abre un DXF en un CAD**, ni compara la huella con el tejado real de la
//     ortofoto. Que la huella caiga DONDE ESTÁ EL EDIFICIO —y no 40 m al norte
//     por un huso mal deducido— es exactamente lo que esta capa existe para que
//     se vea con los ojos, y esos ojos son los del §12.
//   · **NO mide a 768 px de alto.** El tope en `vh` protege del contenido largo,
//     **no de la ventana corta**: a 768 px son 7 filas y no 8. Este guion mide en
//     el viewport en el que se lance y **DERIVA** la otra cifra, diciendo que es
//     derivada. Para medirla de verdad hay una segunda pasada en el §19.
//   · **NO decide si algún texto de la rama se lee como un veredicto** (regla de
//     oro 9). Publica los textos; el juicio es del §12.
//
// ── ⚠️ ESTE GUION NECESITA `npm run dev`, NO `vite preview` ─────────────────
// Fabrica `File`s con los BYTES REALES de dos fixtures traídos por `fetch` del
// propio servidor (`test/fixtures/parsers/…`), y eso **solo funciona en DEV**:
// `vite preview` sirve `dist/`, donde los fixtures no están. Lo mismo que el §16.
//
// ── CÓMO SE LANZA ───────────────────────────────────────────────────────────
// Página recién cargada (el guion lo comprueba), `$B eval` desde la raíz:
//
//   $B viewport 1440x900
//   $B goto http://localhost:PUERTO/concretagml/     # ⚠️ el base, no la raíz
//   $B wait ".gml-tabla-vertices"
//   $B console --clear
//   $B eval scripts/smoke-navegador/13-edificio.js
//   $B console --errors                              # → (no console errors)
//   $B screenshot .gstack/smoke-f11.png              # la evidencia para el §12
//
// ⚠️ **Página recién cargada, y no es formalismo**: el guion mide el invariante
// de los 267 px con la lista de avisos VACÍA, y una sola tarjeta de aviso cuesta
// ~52 px del sitio más caro del panel. Si arranca con avisos, lo dice y ATRIBUYE
// la pérdida en vez de acusar a F11 (es la lección que ya pagaron `09` —midió
// demasiado tarde— y `11` —midió demasiado pronto—).
//
// ⚠️ **Estado final.** El guion deja la aplicación en la rama **PARCELA**, con un
// EDIFICIO cargado en el segundo store y sus huellas pintadas en el mapa, y el
// mapa encuadrado sobre ellas (no sobre la parcela de demostración). Lo DECLARA
// en `estadoFinal`. Para volver al punto de partida: `$B reload`.
//
// ⚠️ NO envuelvas este fichero en una IIFE: `browse` ya lo envuelve ÉL en
// `(async()=>{ … })()` — por eso los `await` y el `return` de nivel superior son
// legales. Con una IIFE propia, el `eval` devuelve una promesa que nadie espera y
// **el veredicto se pierde EN SILENCIO** mientras los efectos (clics, ficheros
// soltados, el mapa moviéndose) sí ocurren. Consecuencia normal y esperada:
// `node --check` sobre este fichero falla con «Illegal return statement».

const t0 = performance.now()
const TOPE_TOTAL_MS = 26000
const agotado = () => performance.now() - t0 > TOPE_TOTAL_MS

const problemas = []
const advertencias = []
const noCubierto = []

/**
 * El suelo de holgura del conmutador, en píxeles. **Es EL guardián de F11**, y no
 * es un número redondo por gusto: la fase 0 midió 46,11 px con los rótulos
 * «Parcela» y «Edificio», y `.gml-chips` es `flex-wrap: wrap`, así que perder esa
 * holgura no rompe nada visible — hace que la fila salte de línea y se coma
 * 20,28–29,19 px de la caja de vértices sin que nada avise. 24 px es «cabe un
 * carácter ancho más y ni uno más»: por debajo de ahí, el siguiente rótulo que
 * alguien alargue parte la fila.
 */
const SUELO_HOLGURA = 24

/**
 * Lo que mide la caja de vértices en la rama PARCELA, a 1440×900 y con la lista
 * de avisos vacía. Referencia.
 *
 * ── ⛔ ESTE NÚMERO CAMBIÓ EL 2026-08-04, Y ES LA ÚNICA VEZ EN OCHO FASES ────
 * Valía **267** desde F07, y F08, F09, F10 y F11 se esforzaron en no moverlo:
 * cada una metió su interfaz en otro sitio (un cajón sobre el mapa, un modal, la
 * fila del rótulo) precisamente para no tocarlo. Era el invariante de la casa.
 *
 * **T6 del rework de UI lo subió a 386** (385,67 px exactos), y no optimizando
 * nada: sacando el bloque de Entrada de la pantalla de Validación, donde llevaba
 * desde F05 quitándole sitio a lo que se está validando. Es un **+44 %**, y es la
 * mejor cifra que tiene el rework para justificarse.
 *
 * Se sube la referencia en vez de bajarla porque el invariante sigue siéndolo:
 * lo que se vigila es que nadie se lo coma otra vez. Quien vea este guion en rojo
 * por esta línea, que mire primero el §20 del GUION antes de tocar nada.
 */
const CAJA_VERTICES_REFERENCIA = 386

/** El violeta claro de la huella (`viewer/partes.js#COLOR_HUELLA`), en `rgb()`. */
const COLOR_HUELLA_RGB = 'rgb(167, 139, 250)'

/** El amarillo del usuario. La huella **no puede** pintarse de esto: va justo encima. */
const COLOR_USUARIO_RGB = 'rgb(255, 214, 0)'

/** Los `zIndex` que `viewer/_comun.js#PANES` congela alrededor de `partes`. */
const Z_PARCELA_EDITADA = 420
const Z_PARTES = 422
const Z_VERTICES = 430

// Excepciones no capturadas DURANTE el recorrido. No sustituye a
// `$B console --errors` (que ve el buffer entero de la sesión): añade la mitad que
// ese comando no puede atribuir, que es «esto reventó por lo que hizo ESTE guion».
const excepciones = []
const alError = (e) => excepciones.push(String(e.message || e.type))
const alRechazo = (e) => excepciones.push(`unhandledrejection: ${String(e.reason)}`)
window.addEventListener('error', alError)
window.addEventListener('unhandledrejection', alRechazo)

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]
const redondear = (v, d = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d
const texto = (sel) => ($(sel) === null ? null : $(sel).textContent.trim())
const alto = (sel) => {
  const el = typeof sel === 'string' ? $(sel) : sel
  return el === null || el === undefined ? null : redondear(el.getBoundingClientRect().height)
}
const ancho = (sel) => {
  const el = typeof sel === 'string' ? $(sel) : sel
  return el === null || el === undefined ? null : redondear(el.getBoundingClientRect().width)
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

const altoCajaVertices = () => {
  const caja = $('#tabla-vertices')
  return caja === null ? null : Math.round(caja.getBoundingClientRect().height)
}
const tarjetasDeAvisos = () => $$('#avisos .gml-aviso').length
const textosDeAvisos = () => $$('#avisos .gml-aviso-texto').map((t) => t.textContent.trim())
const filasDeTabla = () => $$('#tabla-vertices tr[data-recinto="0"][data-indice]').length
const huellas = () => $$('path.gml-huella')
const filasDePartes = () => $$('[data-lista="partes"] .gml-parte')

/**
 * Espera a que el PANEL deje de moverse: dos lecturas seguidas con la misma
 * altura. Existe por los dos falsos positivos que ya se pagaron —`09` midió
 * demasiado tarde y acusó al cajón de píxeles ajenos; `11` midió demasiado pronto
 * y acusó al diálogo de 33 px que eran del renglón de las colindantes—. Aquí mide
 * la caja que corresponda a la rama que esté puesta.
 */
async function asentarPanel(medir, ms = 2000) {
  const limite = performance.now() + ms
  let anterior = medir()
  while (performance.now() < limite) {
    await new Promise((r) => setTimeout(r, 200))
    const ahora = medir()
    if (ahora === anterior) return true
    anterior = ahora
  }
  advertencias.push(`El panel seguía moviéndose tras ${ms} ms: la medida puede llevar ruido.`)
  return false
}

/**
 * Las peticiones de red vistas por Resource Timing, clasificadas.
 *
 * ⛔ **Se clasifica por `wfsCP.aspx` / `wfsBU.aspx` y JAMÁS por
 * `STOREDQUERIE_ID`**: ese parámetro lo usan LOS DOS endpoints del Catastro
 * (medido en la fase 0 de F11), así que enrutar por él manda las peticiones de
 * parcela a la rama de edificio y deja la cuenta mintiendo en verde.
 *
 * Y se separa la CARTOGRAFÍA de los DATOS a propósito: cargar un edificio encuadra
 * el mapa sobre sus huellas, y mover el mapa pide teselas. Eso no es leer el
 * dibujo. Lo que sería un defecto es que abrir un DXF consultara al Catastro.
 */
function peticiones() {
  const nombres = performance.getEntriesByType('resource').map((e) => e.name)
  const propias = nombres.filter((u) => u.includes('/test/fixtures/'))
  const datosParcela = nombres.filter((u) => u.includes('wfsCP.aspx'))
  const datosEdificio = nombres.filter((u) => u.includes('wfsBU.aspx'))
  const cartografia = nombres.filter(
    (u) => /ServidorWMS|Cartografia|ign\.es|wmts|WMTS/i.test(u) && !u.includes('/test/fixtures/'),
  )
  return {
    total: nombres.length,
    datosCatastro: datosParcela.length + datosEdificio.length,
    datosParcela: datosParcela.length,
    datosEdificio: datosEdificio.length,
    cartografia: cartografia.length,
    fixturesDelGuion: propias.length,
  }
}

/**
 * Un `File` con los BYTES REALES del fixture. `arrayBuffer()` y no `text()`, por
 * lo mismo que en `10`: la decisión del encoding es de `gml/decodificar.js` y
 * `text()` la habría tomado por él.
 */
async function traerFixture(ruta, nombre, tipo = 'image/vnd.dxf') {
  const url = new URL(ruta, document.baseURI).href
  try {
    const respuesta = await fetch(url)
    if (!respuesta.ok) return { file: null, url, estado: respuesta.status }
    const bytes = await respuesta.arrayBuffer()
    return { file: new File([bytes], nombre, { type: tipo }), url, estado: respuesta.status, bytes: bytes.byteLength }
  } catch (error) {
    return { file: null, url, error: `${error.name}: ${error.message}` }
  }
}

/**
 * El gesto: `dragenter` → `dragover` → `drop` sobre la VENTANA, que es donde
 * `app/zona-fichero.js` escucha. **No es un arrastre de ratón** (§0 del GUION).
 */
function soltar(file) {
  const dt = new DataTransfer()
  dt.items.add(file)
  for (const tipo of ['dragenter', 'dragover', 'drop']) {
    window.dispatchEvent(new DragEvent(tipo, { bubbles: true, cancelable: true, dataTransfer: dt }))
  }
}

/** La primera familia de una lista `font-family`, en minúsculas y sin comillas. */
const primeraFamilia = (v) =>
  (v || '')
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()

/** Los `data-*` del contrato K.1 que no pueden repetirse entre ramas. */
const ATRIBUTOS_K1 = ['data-campo', 'data-accion', 'data-estado', 'data-ficha', 'data-procedencia']

/** Todos los valores de un `data-*` dentro de una raíz (incluida la propia raíz). */
function valoresDe(raiz, atributo) {
  if (raiz === null) return []
  const salida = []
  if (raiz.hasAttribute(atributo)) salida.push(raiz.getAttribute(atributo))
  for (const el of raiz.querySelectorAll(`[${atributo}]`)) salida.push(el.getAttribute(atributo))
  return salida
}

// ── 0 · ¿Está F11 montada? ──────────────────────────────────────────────────

const chips = $('.gml-chips')
const conmutador = $('[data-conmutador="rama"]')
const botonParcela = $('[data-ir-a-rama="PARCELA"]')
const botonEdificio = $('[data-ir-a-rama="EDIFICIO"]')
const bloqueEdificio = $('.gml-bloque--edificio')
const bloquePartes = $('.gml-bloque--partes')
const listaPartes = $('[data-lista="partes"]')
const dialogoCapas = $('dialog.gml-dialogo-capas')

if (
  chips === null ||
  conmutador === null ||
  botonParcela === null ||
  botonEdificio === null ||
  bloqueEdificio === null ||
  bloquePartes === null ||
  dialogoCapas === null
) {
  window.removeEventListener('error', alError)
  window.removeEventListener('unhandledrejection', alRechazo)
  return {
    guion: '13-edificio',
    ok: false,
    problemas: [
      'F11 no está montada en esta página: falta el conmutador (`[data-conmutador="rama"]`, que ' +
        'fabrica `app/rama.js`), alguna de las dos secciones del panel de edificio ' +
        '(`.gml-bloque--edificio` / `.gml-bloque--partes`, que fabrica `app/panel-edificio.js`) o el ' +
        '`<dialog>` de reparto por capas. Ninguno de los tres está en `index.html`: los pone el ' +
        'paso 13 de `app/main.js`, y si ese paso lanzó, la consola lo dice.',
    ],
    encontrado: {
      chips: chips !== null,
      conmutador: conmutador !== null,
      botonParcela: botonParcela !== null,
      botonEdificio: botonEdificio !== null,
      bloqueEdificio: bloqueEdificio !== null,
      bloquePartes: bloquePartes !== null,
      dialogoCapas: dialogoCapas !== null,
    },
  }
}

const app = $('.gml-app')
const cabecera = $('.gml-panel-cabecera')
const panelIzquierdo = $('.gml-panel')
const ficha = $('.gml-ficha')
const ctaGenerar = $('[data-accion="generar-gml"]')
const ctaDiagnosticar = $('[data-accion="diagnosticar"]')
const renglonGenerar = $('[data-estado="generar-gml"]')
const renglonDiagnosticar = $('[data-estado="diagnosticar"]')

await asentarPanel(altoCajaVertices)

const redAlArrancar = peticiones()

// ── 1 · Arranque: rama PARCELA y el invariante de los 267 px ────────────────

const arranque = {
  ramaEnElBody: app === null ? null : app.getAttribute('data-rama'),
  filas: filasDeTabla(),
  tarjetasDeAvisos: tarjetasDeAvisos(),
  altoCajaVerticesPx: altoCajaVertices(),
  altoCabeceraPx: alto(cabecera),
  altoFichaPx: alto(ficha),
  // La rama PARCELA se ve y la de EDIFICIO no. Se pregunta por `hidden` —el
  // mecanismo— y por `display` —el efecto—: una regla de CSS con `display` y
  // especificidad ≥(0,2,0) en la sección de F11 dejaría las DOS ramas en pantalla
  // a la vez y el `hidden` seguiría puesto, callado.
  // ⛔ **F12 · fase 5 · `hidden` YA NO ES LA RESPUESTA A «¿se ve?».** `app/rama.js`
  // esconde por RAMA con el atributo `hidden`; T4.1 estrenó el eje PASO en esta
  // rama y ése esconde por CSS (`data-pantalla` + `display: none`). Contar
  // `hidden === false` daba TRES secciones de edificio en «Entrada» cuando en
  // pantalla solo hay una. Se mide la CAJA, que es lo que decide qué ve el usuario.
  seccionesVisibles: $$('[data-rama-panel]').map((s) => ({
    rama: s.getAttribute('data-rama-panel'),
    clase: s.className,
    hidden: s.hidden || s.getBoundingClientRect().height === 0,
    hiddenAtributo: s.hidden,
    pantalla: s.getAttribute('data-pantalla'),
    altoPx: redondear(s.getBoundingClientRect().height),
    display: getComputedStyle(s).display,
  })),
  ctaGenerarApagado: ctaGenerar === null ? null : ctaGenerar.disabled,
  ctaDiagnosticarApagado: ctaDiagnosticar === null ? null : ctaDiagnosticar.disabled,
  renglonGenerar: renglonGenerar === null ? null : renglonGenerar.textContent.trim(),
  renglonDiagnosticar: renglonDiagnosticar === null ? null : renglonDiagnosticar.textContent.trim(),
  barraEdicionVisible: (() => {
    const barra = $('.leaflet-control .gml-barra-edicion, .gml-barra-edicion')
    return barra === null ? null : !barra.hidden
  })(),
  huellasEnElMapa: huellas().length,
}

if (arranque.ramaEnElBody !== 'PARCELA') {
  problemas.push(
    `La página no arranca en la rama PARCELA (\`data-rama\` = ${JSON.stringify(arranque.ramaEnElBody)}). ` +
      '`index.html` declara el panel de parcela, así que cualquier otra rama inicial obligaría a ' +
      'repintar en el arranque, y este guion mide el invariante desde ahí.',
  )
}
if (arranque.filas !== 15) {
  problemas.push(
    `La página no está recién cargada sobre la parcela de demostración (${arranque.filas} filas): ` +
      'las medidas de este guion suponen el dataset de arranque. `$B reload` y vuelve a lanzarlo.',
  )
}
if (arranque.tarjetasDeAvisos > 0) {
  advertencias.push(
    `La página arranca con ${arranque.tarjetasDeAvisos} tarjeta(s) de aviso, y una cuesta ~52 px del ` +
      'sitio más caro del panel: el invariante de los 267 px se mide con la lista vacía. Textos: ' +
      JSON.stringify(textosDeAvisos().map((t) => t.slice(0, 90))),
  )
}
if (
  arranque.tarjetasDeAvisos === 0 &&
  arranque.altoCajaVerticesPx !== null &&
  Math.abs(arranque.altoCajaVerticesPx - CAJA_VERTICES_REFERENCIA) > 2
) {
  problemas.push(
    `La caja de vértices arranca en ${arranque.altoCajaVerticesPx} px con la lista de avisos vacía, y ` +
      `la referencia medida son ${CAJA_VERTICES_REFERENCIA} px (los mismos que dejaron F07, F08, F09 y ` +
      'F10). F11 tenía que ser la SEXTA fase seguida a coste 0 px: algo del tamaño de un bloque ha ' +
      'entrado en el panel, o el conmutador ha partido la fila de chips (mira `conmutadorAncho`).',
  )
}
if (arranque.huellasEnElMapa > 0) {
  problemas.push(
    `Hay ${arranque.huellasEnElMapa} huella(s) de edificio pintadas en el mapa nada más cargar. El ` +
      'segundo store nace en `null` a propósito (contrato H): no se inventa un edificio de ' +
      'demostración, igual que `demo-datos.js` no le añade un patio a la parcela real.',
  )
}

// ── 2 · ⭐ EL GUARDIÁN DE ANCHO DEL CONMUTADOR ──────────────────────────────
//
// Lo que SUSTITUYE al `flex-wrap: nowrap` que el plan pedía por error. Ver la
// cabecera y la sección de F11 de `estilos/app.css`.

const conmutadorAncho = (() => {
  const hijos = [...chips.children]
  const estilo = getComputedStyle(chips)
  const gapPx = redondear(Number.parseFloat(estilo.columnGap) || 0)
  const anchoContenedorPx = redondear(chips.clientWidth)
  const anchos = hijos.map((h) => redondear(h.getBoundingClientRect().width))
  const sumaHijosPx = redondear(anchos.reduce((a, b) => a + b, 0))
  const ocupadoPx = redondear(sumaHijosPx + gapPx * Math.max(0, hijos.length - 1))
  const holguraPx = redondear(anchoContenedorPx - ocupadoPx)
  const anchoConmutadorPx = redondear(conmutador.getBoundingClientRect().width)
  const tops = hijos.map((h) => Math.round(h.getBoundingClientRect().top))
  return {
    queEs:
      'El guardián de F11, y el único sitio del proyecto donde existe. `.gml-chips` es ' +
      '`flex-wrap: wrap` A PROPÓSITO (con `nowrap` el elemento que no cabe se sale 102,53 px y ' +
      '`.gml-panel`, que es `overflow:hidden`, lo recorta EN SILENCIO). Con `wrap` el fallo se ve, ' +
      'pero cuesta 20,28–29,19 px de la caja de vértices sin que nada avise: por eso se mide el ANCHO.',
    hijos: hijos.length,
    clasesDeLosHijos: hijos.map((h) => h.className || h.tagName.toLowerCase()),
    anchosPx: anchos,
    gapPx,
    anchoContenedorPx,
    anchoConmutadorPx,
    ocupadoPx,
    // ⭐ LAS DOS CIFRAS DEL GUARDIÁN.
    holguraPx,
    saltoDeLinea: new Set(tops).size > 1,
    // La cifra de la fase 0 (169,28 px): lo que quedaba libre ANTES de meter el
    // conmutador. Se DERIVA de lo medido en vez de copiarse.
    anchoLibreSinConmutadorPx: redondear(holguraPx + anchoConmutadorPx + gapPx),
    // Lo que el `nowrap` habría escondido. Con `wrap` tiene que ser 0: si sale
    // positivo, algo se está recortando en silencio de todos modos.
    desbordeDelPanelPx:
      panelIzquierdo === null ? null : panelIzquierdo.scrollWidth - panelIzquierdo.clientWidth,
    desbordeDeLosChipsPx: chips.scrollWidth - chips.clientWidth,
    // El regalo medido de T1.6: `.gml-chips` no declara `align-items`, así que el
    // conmutador se estira al alto de la fila (que lo gobierna el chip) y sus
    // botones con él. WCAG 2.5.8 pide 24 px de objetivo.
    altoDelConmutadorPx: redondear(conmutador.getBoundingClientRect().height),
    altoDelBotonPx: redondear(botonParcela.getBoundingClientRect().height),
    rotulos: [botonParcela.textContent.trim(), botonEdificio.textContent.trim()],
    // La regla del CSS TIENE que llegar: la sección se escribió sin ver el módulo
    // que fabrica el marcado, y un nombre que no case deja la regla muerta y muda.
    //
    // ⚠️ **Y aquí hay un hecho de CSS que hay que saber para no acusar en falso**:
    // la hoja declara `inline-flex` y esto MIDE `flex`. No es un fallo ni una regla
    // muerta: **los ítems flex se BLOQUIFICAN** (CSS Display 3, §2.7), así que un
    // hijo de `.gml-chips` —que es `display:flex`— computa `flex` diga lo que diga
    // su `inline-flex`. El efecto es idéntico; lo que queda es que la palabra
    // `inline-` de la hoja es inerte por construcción. Se publica, no se acusa: lo
    // que sí se exige es que la regla LLEGUE, o sea que sea flex de alguna forma.
    display: getComputedStyle(conmutador).display,
    displayDeclaradoEnLaHoja: 'inline-flex',
    esFlex: /flex/.test(getComputedStyle(conmutador).display),
    flexGrow: getComputedStyle(conmutador).flexGrow,
    flexShrink: getComputedStyle(conmutador).flexShrink,
    alignItems: getComputedStyle(conmutador).alignItems,
    flexWrapDeLosChips: estilo.flexWrap,
  }
})()

if (conmutadorAncho.saltoDeLinea) {
  problemas.push(
    'LA FILA DE CHIPS SE HA PARTIDO EN DOS LÍNEAS: el conmutador y los chips ya no están a la ' +
      `misma altura (tops distintos, holgura ${conmutadorAncho.holguraPx} px). Eso cuesta ` +
      '20,28–29,19 px medidos de la caja de vértices y F11 deja de ser la sexta fase a coste 0 px. ' +
      'Los rótulos «Parcela» y «Edificio» no pueden crecer: acórtalos.',
  )
}
if (conmutadorAncho.holguraPx !== null && conmutadorAncho.holguraPx <= SUELO_HOLGURA) {
  problemas.push(
    `Solo quedan ${conmutadorAncho.holguraPx} px de holgura en \`.gml-chips\` y el suelo es ` +
      `${SUELO_HOLGURA} px (la fase 0 midió 46,11). Todavía no ha saltado de línea, pero el ` +
      'siguiente carácter que alguien le añada a un rótulo o a un chip la parte, y eso cuesta ' +
      '~20–29 px de la caja de vértices sin que nada avise.',
  )
}
if (conmutadorAncho.desbordeDelPanelPx !== null && conmutadorAncho.desbordeDelPanelPx > 0) {
  problemas.push(
    `El panel izquierdo desborda ${conmutadorAncho.desbordeDelPanelPx} px (\`scrollWidth\` contra ` +
      '`clientWidth`) y es `overflow: hidden`: se está recortando algo EN SILENCIO. Es exactamente ' +
      'el modo de fallo que `flex-wrap: nowrap` habría producido y por el que se dejó `wrap`.',
  )
}
if (!conmutadorAncho.esFlex) {
  problemas.push(
    `\`.gml-conmutador-rama\` computa \`display: ${conmutadorAncho.display}\` y la hoja declara ` +
      '`inline-flex`. La sección de F11 de `estilos/app.css` se escribió CITANDO el literal que ' +
      'exporta `app/rama.js#CLASE_CONMUTADOR`, sin verlo: si el nombre ha dejado de casar, la regla ' +
      'está escrita, puesta y MUERTA, y no lo dice nadie. Este guion es quien lo caza. (Que compute ' +
      '`flex` en vez de `inline-flex` NO es eso: los ítems flex se bloquifican y el efecto es el mismo.)',
  )
}
if (conmutadorAncho.altoDelBotonPx !== null && conmutadorAncho.altoDelBotonPx < 24) {
  advertencias.push(
    `Los botones del conmutador miden ${conmutadorAncho.altoDelBotonPx} px de alto y WCAG 2.5.8 pide ` +
      '24. El estirón lo daba `align-items: stretch` contra el alto del chip, y era gratis: si la ' +
      'fila se ha quedado sin chips, el conmutador vuelve a sus ~15 px.',
  )
}

// ── 3 · ⭐ M10 EN UN NAVEGADOR DE VERDAD: ida y vuelta ──────────────────────
//
// La regla dura de `app/rama.js`: el intercambio es `seccion.hidden`, JAMÁS
// `replaceChildren`. Con `hidden` el nodo sigue conectado, conserva su valor y sus
// oyentes siguen disparando; con `replaceChildren` la referencia que el cableado
// resolvió UNA vez en el montaje queda huérfana, escribible y MUDA — escribir en
// ella no lanza — y el dato acaba fuera del documento mientras el usuario ve el
// campo vacío. Hay **30 nodos de `app/` resueltos así**.

const refcatParcelaAntes = $('[data-campo="refcat"]')
const VALOR_SONDA = '9398516VK3799G'

/**
 * ⚠️ **La sonda es del guion, y hay que decir por qué.** Lo que M10 promete es
 * que «sus oyentes siguen disparando». Medido: `app/cableado-catastro.js` **no
 * engancha ningún `input`** a este campo —lo lee cuando se pulsa «Traer del
 * Catastro»—, y pulsar ese botón sería una petición al Catastro, que este guion
 * no hace. Así que se engancha una sonda PROPIA antes de conmutar: si sigue
 * disparando al volver, el nodo está conectado y los sucesos siguen llegando,
 * que es exactamente lo que `replaceChildren` habría roto en silencio.
 */
let sondaRefcat = 0
const dispararSonda = () => {
  sondaRefcat += 1
}
if (refcatParcelaAntes !== null) {
  refcatParcelaAntes.addEventListener('input', dispararSonda)
  refcatParcelaAntes.value = VALOR_SONDA
  refcatParcelaAntes.dispatchEvent(new Event('input', { bubbles: true }))
}
const sondaAntes = sondaRefcat

// ── A EDIFICIO ─────────────────────────────────────────────────────────────
botonEdificio.click()
await esperar(() => app.getAttribute('data-rama') === 'EDIFICIO', 3000, 'que se conmute a EDIFICIO')
await asentarPanel(() => alto('.gml-partes'))

const enEdificio = {
  ramaEnElBody: app.getAttribute('data-rama'),
  ariaPressed: {
    parcela: botonParcela.getAttribute('aria-pressed'),
    edificio: botonEdificio.getAttribute('aria-pressed'),
  },
  // ⛔ **F12 · fase 5 · `hidden` YA NO ES LA RESPUESTA A «¿se ve?».** `app/rama.js`
  // esconde por RAMA con el atributo `hidden`; T4.1 estrenó el eje PASO en esta
  // rama y ése esconde por CSS (`data-pantalla` + `display: none`). Contar
  // `hidden === false` daba TRES secciones de edificio en «Entrada» cuando en
  // pantalla solo hay una. Se mide la CAJA, que es lo que decide qué ve el usuario.
  seccionesVisibles: $$('[data-rama-panel]').map((s) => ({
    rama: s.getAttribute('data-rama-panel'),
    clase: s.className,
    hidden: s.hidden || s.getBoundingClientRect().height === 0,
    hiddenAtributo: s.hidden,
    pantalla: s.getAttribute('data-pantalla'),
    altoPx: redondear(s.getBoundingClientRect().height),
    display: getComputedStyle(s).display,
  })),
  // La caja de vértices ya no está: su sección está oculta. Es lo esperado y se
  // publica para que nadie lea el 0 como una pérdida.
  altoCajaVerticesPx: altoCajaVertices(),
  altoCabeceraPx: alto(cabecera),
  altoBloqueOrigenPx: alto(bloqueEdificio),
  altoBloquePartesPx: alto(bloquePartes),
  altoListaPartesPx: alto('.gml-partes'),
  // Los CTA del pie en la rama EDIFICIO, apagados CON EL MOTIVO ESCRITO AL LADO.
  //
  // ⛔ **REESCRITO EL 2026-08-06 POR F13, y la causa es de F13.** Lo que había
  // aquí medía el reparto del 2026-08-04: **dos** botones apagados por la misma
  // causa, un solo motivo que los NOMBRABA A LOS DOS y `aria-describedby` para
  // que el segundo no quedara mudo. Existía por una medida cara —dos párrafos
  // permanentes costaban **+134,75 px** en `.gml-acciones`, y el recorte se
  // llevaba «Diagnosticar encaje» entero—, y esa medida sigue valiendo.
  //
  // Lo que cambió es el hecho: **F13 enciende «Generar GML» en esta rama**. Ya no
  // se apaga por estar donde estás, sino por el DATO, y lo cablea
  // `app/cableado-edificio-gml.js`. Queda UN solo botón apagado por rama
  // («Diagnosticar encaje», hasta F14), así que su motivo cabe entero en su
  // propio renglón y el reparto con `aria-describedby` ya no hace falta: F13
  // **deshace** el problema de los 134,75 px en vez de administrarlo.
  //
  // ⚠️ Si algún día vuelven a ser dos, hay que volver al reparto — y MEDIRLO
  // antes. La cifra está en la cabecera de `app/rama.js`, donde también quedó
  // escrito el texto de los dos mensajes retirados.
  //
  // Aquí se mide LO QUE SE ENSEÑA, y las tres patas del que sigue apagado: que
  // esté apagado, que su renglón lleve texto propio y que ese texto explique de
  // verdad por qué.
  ctaGenerarApagado: ctaGenerar === null ? null : ctaGenerar.disabled,
  ctaDiagnosticarApagado: ctaDiagnosticar === null ? null : ctaDiagnosticar.disabled,
  motivoGenerar: renglonGenerar === null ? null : renglonGenerar.textContent.trim(),
  motivoDiagnosticar: renglonDiagnosticar === null ? null : renglonDiagnosticar.textContent.trim(),
  // ⭐ La cadena de accesibilidad del segundo CTA, entera y por sus tres eslabones:
  // el atributo, el nodo al que apunta y que ese nodo LLEVE TEXTO. Un
  // `aria-describedby` que apunta a un `id` que no existe —o a un renglón vacío—
  // es peor que no ponerlo: el lector de pantalla no dice nada y el marcado afirma
  // que sí lo dice.
  describedbyDelSegundoCta:
    ctaDiagnosticar === null ? null : ctaDiagnosticar.getAttribute('aria-describedby'),
  idDelRenglonPrincipal: renglonGenerar === null ? null : renglonGenerar.id || null,
  textoDelNodoDescriptor: (() => {
    if (ctaDiagnosticar === null) return null
    const id = ctaDiagnosticar.getAttribute('aria-describedby')
    if (id === null || id === '') return null
    const nodo = document.getElementById(id)
    return nodo === null ? null : nodo.textContent.trim()
  })(),
  barraEdicionOculta: (() => {
    const barra = $('.gml-barra-edicion')
    return barra === null ? null : barra.hidden === true
  })(),
  estadoDelPanel: texto('[data-estado="edificio"]'),
  listaVacia: texto('[data-lista="partes"] .gml-partes-vacio'),
  cuentaDePartes: (() => {
    const fila = bloquePartes.querySelector('.gml-rotulo-fila')
    return fila === null ? null : fila.textContent.replace(/\s+/g, ' ').trim()
  })(),
  tarjetasDeAvisos: tarjetasDeAvisos(),
}

if (enEdificio.ramaEnElBody !== 'EDIFICIO') {
  problemas.push('Pulsar «Edificio» no ha dejado `data-rama="EDIFICIO"` en el `<body>`.')
}
if (enEdificio.ariaPressed.edificio !== 'true' || enEdificio.ariaPressed.parcela !== 'false') {
  problemas.push(
    `\`aria-pressed\` no acompaña a la rama (parcela=${enEdificio.ariaPressed.parcela}, ` +
      `edificio=${enEdificio.ariaPressed.edificio}). El aspecto lo pinta \`data-rama\` a propósito, ` +
      'pero `aria-pressed` es lo ÚNICO que oye el lector de pantalla.',
  )
}
{
  const visiblesDeEdificio = enEdificio.seccionesVisibles.filter(
    (s) => s.rama === 'EDIFICIO' && s.hidden === false,
  )
  const visiblesDeParcela = enEdificio.seccionesVisibles.filter(
    (s) => s.rama === 'PARCELA' && s.hidden === false,
  )
  // ⛔ **F12 · fase 5 · ESTE NÚMERO ERA 2 Y AHORA ES 1..2, Y ES LO CONTRARIO DE
  // UN RELAJO.** F11 dejaba las dos secciones visibles **en los cinco pasos** —lo
  // midió la fase 0 de F12 (defecto M2): 314,97 / 157,06 px idénticos en todos—,
  // así que «siempre dos» era la firma de que el eje PASO no tocaba a esta rama.
  // T4.1 les puso `data-pantalla` y añadió una TERCERA (la parte activa), y desde
  // entonces lo correcto es que **cambien con el paso**: en «Entrada» se ve una
  // (origen), en «Validación» otra (partes) y en «Edición» dos (partes y activa).
  //
  // Lo que este guardián puede seguir exigiendo —y es lo que de verdad importaba—
  // es que **nunca se vean las tres a la vez**: eso sería el panel de F11 otra
  // vez, con los 397,19 px de la fase 0 y una fila de lista. Que el eje PASO las
  // mueva de verdad lo mide el guion 19, que es de F12.
  if (visiblesDeEdificio.length === 0 || visiblesDeEdificio.length > 2) {
    problemas.push(
      `Con la rama EDIFICIO puesta se ven ${visiblesDeEdificio.length} secciones suyas. En ningún ` +
        'paso pueden verse las tres a la vez —sería el panel de F11, con 397,19 px de origen y una ' +
        'sola fila de lista— ni ninguna: `.gml-bloque--partes` SUSTITUYE a `.gml-bloque--vertices` ' +
        'como estirador del panel.',
    )
  }
  if (visiblesDeParcela.length !== 0) {
    problemas.push(
      'Con la rama EDIFICIO puesta hay secciones de PARCELA todavía visibles: las dos ramas están en ' +
        'pantalla a la vez. Es el modo de fallo que la sección de F11 del CSS existe para evitar — una ' +
        'regla con `display` y especificidad ≥(0,2,0) le gana por ORDEN a `.gml-app [hidden]`. ' +
        JSON.stringify(visiblesDeParcela),
    )
  }
}
// ⭐ **F14 · «Diagnosticar encaje» YA NO SE APAGA POR LA RAMA.**
//
// Aquí ponía lo contrario —«sigue apagado en esta rama, y eso NO cambia hasta
// F14»— y era verdad hasta el 2026-08-07. **F14 es la fase que lo vuelve falso**:
// la rama EDIFICIO tiene su propio contraste (`diagnostico/edificio.js`) y su
// propia pantalla (`viewer/cajon-contraste-edificio.js`), así que apagar el botón
// por ser edificio sería negar lo que la aplicación ya sabe hacer.
//
// Se corrige con la misma forma con la que F13 corrigió el gemelo de «Generar
// GML» tres párrafos más abajo, y por el mismo motivo: lo que se exige ahora no es
// que esté apagado, sino que **si lo está, el motivo sea de esta rama**. Un
// renglón que hable de parcelas con una construcción en pantalla significa que
// está contestando el cableado equivocado.
if (
  enEdificio.motivoDiagnosticar &&
  /(^|\s)parcela\b/i.test(enEdificio.motivoDiagnosticar) &&
  !/rama Parcela/i.test(enEdificio.motivoDiagnosticar)
) {
  problemas.push(
    'Con la rama EDIFICIO puesta, el renglón de «Diagnosticar encaje» habla de una parcela: ' +
      JSON.stringify(enEdificio.motivoDiagnosticar) +
      '. Desde F14 esta rama tiene su propio contraste, y ese renglón tiene que hablar de la ' +
      'construcción o callarse.',
  )
}
// ⭐ **Y «Generar GML» ya NO se apaga por la rama: lo decide el DATO (F13).** El
// guardián que había aquí exigía lo contrario y era verdad hasta el 2026-08-06.
// Lo que se exige ahora es que el motivo, si lo hay, sea de esta rama: un renglón
// que hable de parcelas con un edificio en pantalla significa que manda el
// cableado equivocado. Que el botón se encienda **cuando se puede** lo mide el
// guion 20, que es el de esa fase.
if (
  enEdificio.motivoGenerar &&
  /(^|\s)parcela\b/i.test(enEdificio.motivoGenerar) &&
  !/rama Parcela/i.test(enEdificio.motivoGenerar)
) {
  problemas.push(
    'Con la rama EDIFICIO puesta, el renglón de «Generar GML» habla de una parcela: ' +
      JSON.stringify(enEdificio.motivoGenerar) +
      '. Desde F13 ese botón tiene DOS dueños y el que manda aquí es el de edificio; si contesta ' +
      'el otro, quien lo pulse se lleva el fichero de la otra rama.',
  )
}
// ⭐ Un botón apagado no puede quedar mudo — y desde F14 **el «si» importa**:
// esta rama ya no apaga NINGÚN CTA por serlo, así que el renglón vacío con el
// botón encendido es lo normal y no un fallo. Lo que sigue siendo inadmisible es
// la otra combinación: apagado y sin decir por qué.
if (enEdificio.ctaDiagnosticarApagado === true && !enEdificio.motivoDiagnosticar) {
  problemas.push(
    '«Diagnosticar encaje» está apagado y su renglón está VACÍO: es un botón muerto sin ' +
      'explicación, que es lo que la regla de la casa prohíbe. Desde F14 esta rama no lo apaga por ' +
      'ser edificio, así que si está gris es por el DATO y eso hay que decirlo.',
  )
} else if (
  enEdificio.motivoDiagnosticar &&
  !/Diagnosticar encaje/i.test(enEdificio.motivoDiagnosticar)
) {
  problemas.push(
    'El motivo de «Diagnosticar encaje» no nombra al botón del que habla: ' +
      JSON.stringify(enEdificio.motivoDiagnosticar) +
      '. Con un solo renglón por CTA, cada uno explica el suyo.',
  )
} else if (!/rama Edificio/i.test(enEdificio.motivoDiagnosticar)) {
  advertencias.push(
    'El motivo de «Diagnosticar encaje» no dice que la causa sea la rama en la que estás: ' +
      JSON.stringify(enEdificio.motivoDiagnosticar) +
      '. Sin eso, el usuario no sabe que volviendo a Parcela el botón se enciende.',
  )
}
// ⛔ **Y el mensaje que F13 retiró no puede volver por ninguno de los dos
// renglones.** Hablaba de los dos botones en una frase («…están apagados en la
// rama Edificio: esta versión sabe hacer las dos cosas con una parcela y todavía
// no con una construcción») y su segunda mitad es falsa desde el 2026-08-06.
for (const [donde, texto] of [
  ['Generar GML', enEdificio.motivoGenerar],
  ['Diagnosticar encaje', enEdificio.motivoDiagnosticar],
]) {
  if (typeof texto === 'string' && /todav[ií]a no con una construcci[oó]n/i.test(texto)) {
    problemas.push(
      `⛔ Ha vuelto el mensaje que F13 RETIRÓ, en el renglón de «${donde}»: ${JSON.stringify(texto)}. ` +
        'Decía que esta versión no sabe generar el GML de una construcción, y desde F13 sí sabe.',
    )
  }
}
if (enEdificio.barraEdicionOculta === false) {
  problemas.push(
    'La barra de edición flotante sigue visible con la rama EDIFICIO puesta. En esta rama la parcela ' +
      'del mapa es CONTEXTO, y un `Ctrl+Z` ahí deshace una edición que el usuario cree estar haciendo ' +
      'sobre el edificio.',
  )
}
if (!enEdificio.listaVacia) {
  problemas.push(
    'La lista de partes está vacía y no dice nada. El segundo store nace en `null` a propósito, así ' +
      'que ese renglón es LO PRIMERO que ve el usuario de esta rama y una lista vacía sin texto se ' +
      'lee como «esto no ha cargado».',
  )
}

// ── 3bis · ⭐ EL REPARTO DE ALTURA DEL PANEL EN LA RAMA EDIFICIO ───────────
//
// **Ésta es la medida que ninguna otra máquina de este proyecto puede hacer**, y
// es la que más caro sale de no hacer: jsdom no calcula layout, así que un panel
// que no cabe sale VERDE en las 5.697 pruebas de la suite.
//
// El presupuesto entero, en una resta: el panel mide lo que mide la ventana, la
// cabecera y el pie son `flex: 0 0 auto` (no ceden), el bloque de origen es
// `flex: 0 0 auto` (tampoco), y lo que sobra se lo reparten los DOS únicos
// encogibles — `#avisos` (`0 1 auto`) y la lista de partes (`1 1 auto`). Si la
// suma de los fijos se pasa, esos dos se aplastan **a la vez**, y ése es
// exactamente el desastre que F06 provocó, midió y dejó escrito: T0.3·1 avisó de
// que en esta rama tendría **DOS víctimas en vez de una**.
//
// Y hay un tercer efecto, peor porque no se ve: `.gml-panel` es `overflow: hidden`,
// así que lo que no cabe **se recorta en silencio** por abajo — el pie.
//
// ⛔ **F12 · fase 5 · EL PRESUPUESTO «EN VACÍO» YA NO SE PUEDE MEDIR AQUÍ, y no
// es una pérdida: es que el defecto que medía ha dejado de ser posible.** F11
// enseñaba las dos secciones de edificio **en los cinco pasos** (la fase 0 de F12
// lo midió y lo llamó defecto M2: 314,97 / 157,06 px idénticos en todos), así que
// con la rama vacía la lista estaba en pantalla y podía aplastarse a 0 px — que es
// justo lo que este bloque cazó en su día.
//
// T4.1 le puso `data-pantalla`: la lista vive en «Validación», «Edición» e
// «Informe», y **con la rama vacía esos tres peldaños están apagados** (el rail
// exige `geometria`). O sea que en vacío la lista NO ESTÁ, y medirla daba `0 px`
// acusando de un aplastamiento que ya no puede ocurrir.
//
// El presupuesto CON DATOS sigue midiéndose, y en dos sitios: `topeConPartes` más
// abajo (7 partes, este guion) y el guion 19 entero (13 partes, F12). Aquí se
// conserva el desglose —que es información buena— y **se apagan los dos guardianes
// que dependían de que la lista estuviera en pantalla**, diciéndolo.

const repartoDeAltura = (() => {
  if (panelIzquierdo === null) return { medido: false }
  const pie = $('.gml-panel-pie')
  const avisosCaja = $('#avisos')
  const lista = $('.gml-partes')
  const hijos = [...panelIzquierdo.children]
    .filter((el) => !el.hidden)
    .map((el) => ({
      clase: (el.className || el.tagName).replace('gml-bloque ', ''),
      altoPx: redondear(el.getBoundingClientRect().height),
      flex: getComputedStyle(el).flex,
    }))
  const suma = redondear(hijos.reduce((a, h) => a + (h.altoPx ?? 0), 0))
  return {
    medido: true,
    queEs:
      'El presupuesto de altura del panel en la rama EDIFICIO. Cabecera, bloque de origen y pie son ' +
      '`flex: 0 0 auto` y no ceden; lo que sobra se lo reparten los DOS encogibles (`#avisos` y la ' +
      'lista de partes). Si los fijos se pasan, esos dos se aplastan A LA VEZ y `.gml-panel` —que es ' +
      '`overflow: hidden`— recorta el resto por abajo, en silencio.',
    altoDelPanelPx: redondear(panelIzquierdo.getBoundingClientRect().height),
    hijos,
    sumaDeLosHijosPx: suma,
    sobresuscripcionPx: redondear(suma - panelIzquierdo.getBoundingClientRect().height),
    recorteDelPanelPx: panelIzquierdo.scrollHeight - panelIzquierdo.clientHeight,
    // Las dos víctimas, con su contenido real al lado.
    listaDePartes:
      lista === null
        ? null
        : { altoPx: redondear(lista.getBoundingClientRect().height), contenidoPx: lista.scrollHeight },
    avisos:
      avisosCaja === null
        ? null
        : {
            altoPx: redondear(avisosCaja.getBoundingClientRect().height),
            contenidoPx: avisosCaja.scrollHeight,
            tarjetas: tarjetasDeAvisos(),
          },
    // El pie crece en esta rama: la ficha libera, pero los DOS renglones
    // `role="status"` con los motivos de los CTA apagados son párrafos enteros.
    piePx: pie === null ? null : redondear(pie.getBoundingClientRect().height),
    pieDesglose:
      pie === null
        ? null
        : [...pie.children].map((el) => ({
            clase: el.className || el.tagName.toLowerCase(),
            altoPx: redondear(el.getBoundingClientRect().height),
          })),
    // El desglose del bloque de origen, que es el que decide todo.
    origenDesglose: [...bloqueEdificio.children].map((el) => ({
      clase: el.className || el.tagName.toLowerCase(),
      altoPx: redondear(el.getBoundingClientRect().height),
      texto: el.textContent.trim().slice(0, 60),
    })),
    origenPx: redondear(bloqueEdificio.getBoundingClientRect().height),
    // ⭐ El primero de los dos ahorros del 2026-08-04: **solo se enseña el apunte
    // del modelo ELEGIDO**. El otro va con `hidden` —no se retira del DOM, misma
    // regla que las secciones—, así que aquí se cuentan los dos y se mira cuántos
    // están a la vista. Si vuelven a verse los dos, vuelven ~136 px.
    apuntesDelSelector: $$('.gml-opcion-apunte').map((a) => ({
      hidden: a.hidden,
      display: getComputedStyle(a).display,
      altoPx: redondear(a.getBoundingClientRect().height),
      texto: a.textContent.trim().slice(0, 40),
    })),
    apuntesVisibles: $$('.gml-opcion-apunte').filter((a) => !a.hidden).length,
    // Las cifras de la corrida anterior de este mismo guion (2026-08-04, ANTES de
    // los dos arreglos), para que la diferencia se lea sin ir a buscarla.
    referencias: {
      origenSegunT16Px: 177.34,
      sitioParaLaListaSegunT16Px: 225.22,
      origenAntesDelArregloPx: 457.13,
      accionesAntesDelArregloPx: 207.53,
      sumaAntesDelArregloPx: 947.54,
      recorteAntesDelArregloPx: 48,
      listaAntesDelArregloPx: 2,
    },
  }
})()

if (repartoDeAltura.medido) {
  const lista = repartoDeAltura.listaDePartes
  const avisosCaja = repartoDeAltura.avisos
  // ⚠️ Solo si la lista ESTÁ en pantalla: ver la nota de arriba. Con la rama vacía
  // su sección pertenece a peldaños que el rail tiene apagados, y un `0 px` ahí no
  // es un aplastamiento — es que no hay nada que aplastar.
  const listaEnPantalla = lista !== null && lista.altoPx !== null && lista.altoPx > 0
  if (!listaEnPantalla) {
    advertencias.push(
      'El presupuesto EN VACÍO no se ha medido: con la rama EDIFICIO sin datos la lista de partes ' +
        'no está en pantalla (F12 · T4.1 le puso `data-pantalla` y sus peldaños exigen geometría). ' +
        'El presupuesto CON DATOS sí se mide, aquí en `topeConPartes` y entero en el guion 19.',
    )
  }
  if (listaEnPantalla && lista.altoPx < 26) {
    problemas.push(
      `LA LISTA DE PARTES MIDE ${lista.altoPx} px y su contenido ${lista.contenidoPx} px: en la rama ` +
        'EDIFICIO no cabe NI UNA fila (una fila mide ~26,40 px). El panel no reparte altura, la ' +
        `RACIONA: los fijos suman ${repartoDeAltura.sumaDeLosHijosPx} px para un panel de ` +
        `${repartoDeAltura.altoDelPanelPx} px, y los dos únicos encogibles se aplastan a la vez. Es el ` +
        'desastre de F06 repetido y con DOS víctimas, que es literalmente lo que T0.3·1 avisó que ' +
        `pasaría. Origen del edificio mide ${repartoDeAltura.origenPx} px y T1.6 lo midió en ` +
        `${repartoDeAltura.origenSegunT16Px}.`,
    )
  }
  if (avisosCaja !== null && avisosCaja.altoPx !== null && avisosCaja.altoPx < 16) {
    problemas.push(
      `LA CAJA DE AVISOS MIDE ${avisosCaja.altoPx} px en la rama EDIFICIO **con el panel vacío** (para ` +
        `${avisosCaja.contenidoPx} px de contenido y ${avisosCaja.tarjetas} tarjeta(s)): no cabe ni una ` +
        'línea de 16 px. Es la SEGUNDA víctima del mismo reparto, y un aviso que la aplicación escribe ' +
        'y el usuario no puede leer es un error silencioso (regla de oro 1). ⚠️ El panel CABE ' +
        `(sobresuscripción ${repartoDeAltura.sobresuscripcionPx} px, recorte ` +
        `${repartoDeAltura.recorteDelPanelPx}): lo que falta es holgura para los dos encogibles, no ` +
        `sitio para el panel. Faltan ${redondear(16 - avisosCaja.altoPx)} px.`,
    )
  }
  // ⭐⭐ EL GUARDIÁN QUE HABRÍA CAZADO EL DEFECTO A EN LA PRIMERA CORRIDA, y por eso
  // es el único de este guion que se exige a CERO EXACTO y se mide DOS veces (aquí
  // en vacío, y con las 7 partes cargadas en `topeConPartes`). `scrollHeight` y
  // `clientHeight` son enteros, así que no hay redondeo que tolerar: cualquier
  // píxel por encima de 0 es contenido del PIE que el usuario no puede alcanzar,
  // porque `.gml-panel` es `overflow: hidden` y no hay barra a la que agarrarse.
  if (repartoDeAltura.recorteDelPanelPx > 0) {
    problemas.push(
      `El panel izquierdo recorta ${repartoDeAltura.recorteDelPanelPx} px por abajo (\`scrollHeight\` ` +
        'contra `clientHeight`, y es `overflow: hidden`) en la rama EDIFICIO **con el panel vacío**: ' +
        'hay contenido del PIE que no se ve y no hay forma de llegar a él. Un CTA cuyo motivo está ' +
        'fuera de la pantalla es un botón mudo. El 2026-08-04 esto valía 48 px y se llevaba por ' +
        '«Diagnosticar encaje» entero.',
    )
  }
}

// ── 4 · La FICHA del pie cambia de cara ────────────────────────────────────

const CLAVES_SOLO_PARCELA = ['perimetro', 'superficie-catastral', 'delta-catastral', 'colindantes']
const parDeLaFicha = (clave) => {
  const dd = $(`[data-ficha="${clave}"]`)
  if (dd === null) return null
  const dt = dd.previousElementSibling
  return { dd, dt: dt !== null && dt.tagName === 'DT' ? dt : null }
}

const fichaEnEdificio = {
  queEs:
    'La ficha no cambia de panel: cambia de PREGUNTA. Cuatro de sus ocho pares hablan de la parcela ' +
    'y con un edificio delante estarían afirmando cosas del otro documento. Se ocultan el `<dd>` Y ' +
    'su `<dt>`: la ficha es una rejilla de dos columnas y dejar el rótulo solo la partiría.',
  altoPx: alto(ficha),
  paresVisibles: $$('.gml-ficha dd[data-ficha]').filter((dd) => !dd.hidden).length,
  paresTotales: $$('.gml-ficha dd[data-ficha]').length,
  ocultos: {},
  rotulos: {},
  valores: {},
}
for (const clave of CLAVES_SOLO_PARCELA) {
  const par = parDeLaFicha(clave)
  fichaEnEdificio.ocultos[clave] =
    par === null ? null : { dd: par.dd.hidden, dt: par.dt === null ? null : par.dt.hidden }
}
for (const clave of ['vertices', 'superficie', 'srs', 'refcat']) {
  const par = parDeLaFicha(clave)
  fichaEnEdificio.rotulos[clave] = par === null || par.dt === null ? null : par.dt.textContent.trim()
  fichaEnEdificio.valores[clave] = par === null ? null : par.dd.textContent.trim()
}
fichaEnEdificio.liberaPx =
  arranque.altoFichaPx === null || fichaEnEdificio.altoPx === null
    ? null
    : redondear(arranque.altoFichaPx - fichaEnEdificio.altoPx)
fichaEnEdificio.referenciaMedidaEnLaFase0Px = 75.75

if (fichaEnEdificio.paresVisibles !== 4) {
  problemas.push(
    `En la rama EDIFICIO se ven ${fichaEnEdificio.paresVisibles} pares de la ficha y tendrían que ser ` +
      'CUATRO de los ocho. Los otros cuatro (Perímetro, Superficie catastral, Δ catastral y ' +
      'Colindantes) hablan de la parcela.',
  )
}
for (const [clave, estado] of Object.entries(fichaEnEdificio.ocultos)) {
  if (estado === null) {
    problemas.push(`No existe el par «${clave}» de la ficha del pie.`)
    continue
  }
  if (estado.dd !== true || estado.dt !== true) {
    problemas.push(
      `El par «${clave}» de la ficha no está oculto del todo en la rama EDIFICIO ` +
        `(dd=${estado.dd}, dt=${estado.dt}). Si se oculta solo uno de los dos, la rejilla de dos ` +
        'columnas se parte por la mitad y el resto de la ficha se desalinea.',
    )
  }
}
if (fichaEnEdificio.rotulos.vertices !== 'Partes') {
  problemas.push(
    `El rótulo del recuento dice ${JSON.stringify(fichaEnEdificio.rotulos.vertices)} y en la rama ` +
      'EDIFICIO tiene que decir «Partes»: un edificio no tiene «vértices», tiene partes.',
  )
}
if (fichaEnEdificio.rotulos.superficie !== 'Superficie en planta') {
  problemas.push(
    `El rótulo de la superficie dice ${JSON.stringify(fichaEnEdificio.rotulos.superficie)} y en la ` +
      'rama EDIFICIO tiene que decir «Superficie en planta»: lo que se suma son huellas, no la ' +
      'superficie construida.',
  )
}

// ── 5 · El PANEL nuevo: tipografía, reglas que llegan y el tope de 26vh ────

const tokenSans = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
const tokenMono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim()
const esperadaSans = primeraFamilia(tokenSans)
const esperadaMono = primeraFamilia(tokenMono)

const aspecto = {
  token: { sans: tokenSans, mono: tokenMono },
  // Las reglas de la sección de F11 TIENEN que llegar. Se escribió sin ver los
  // módulos que fabrican el marcado, así que un nombre que no case deja la regla
  // muerta y muda — y este guion es el único guardián que tiene esa regla.
  reglas: {
    bloqueEdificioGap: getComputedStyle(bloqueEdificio).rowGap,
    bloquePartesFlexGrow: getComputedStyle(bloquePartes).flexGrow,
    listaFlexGrow: (() => {
      const l = $('.gml-partes')
      return l === null ? null : getComputedStyle(l).flexGrow
    })(),
    listaMinHeight: (() => {
      const l = $('.gml-partes')
      return l === null ? null : getComputedStyle(l).minHeight
    })(),
    listaOverflowY: (() => {
      const l = $('.gml-partes')
      return l === null ? null : getComputedStyle(l).overflowY
    })(),
    listaMaxHeight: (() => {
      const l = $('.gml-partes')
      return l === null ? null : getComputedStyle(l).maxHeight
    })(),
    opcionesDisplay: (() => {
      const o = $('.gml-opciones')
      return o === null ? null : getComputedStyle(o).display
    })(),
    opcionDisplay: (() => {
      const o = $('.gml-opcion')
      return o === null ? null : getComputedStyle(o).display
    })(),
    // ⛔ El `<dialog>` cerrado tiene que computar `display: none`. Una regla de
    // autor con `display` sobre `.gml-dialogo-capas` le ganaría SIEMPRE a
    // `dialog:not([open])` de la hoja del navegador, sin mirar especificidad, y
    // dejaría el diálogo plantado sobre la aplicación para siempre.
    dialogoCapasCerradoDisplay: getComputedStyle(dialogoCapas).display,
    dialogoCapasAbierto: dialogoCapas.open,
  },
  familias: [],
  estilosEnLinea: [],
}

const DIANAS_TIPOGRAFICAS = [
  ['«Parcela» (conmutador)', botonParcela, esperadaSans],
  ['«Edificio» (conmutador)', botonEdificio, esperadaSans],
  ['«¿Qué necesitas generar?»', bloqueEdificio.querySelector('.gml-campo-etiqueta'), esperadaSans],
  ['la opción del selector de modelo', $('.gml-opcion'), esperadaSans],
  ['el apunte de la opción', $('.gml-opcion-apunte'), esperadaSans],
  ['«Traer del Catastro» (edificio)', $('[data-accion="cargar-catastro-edificio"]'), esperadaSans],
  ['el renglón vacío de la lista de partes', $('.gml-partes-vacio'), esperadaSans],
  ['la referencia catastral del edificio', $('[data-campo="refcat-edificio"]'), esperadaMono],
]
for (const [queEs, el, esperada] of DIANAS_TIPOGRAFICAS) {
  if (el === null || esperada === '') continue
  const familia = primeraFamilia(getComputedStyle(el).fontFamily)
  aspecto.familias.push({ queEs, familia, esperada })
  if (familia !== esperada) {
    problemas.push(
      `${queEs} se pinta con «${familia}» y el token dice «${esperada}». Un \`font\` en línea gana a ` +
        'la hoja y deja la regla de `estilos/app.css` puesta y muerta; en jsdom no hay cascada que lo ' +
        'delate. Es el defecto que destapó el guion `10`.',
    )
  }
}
// `app/panel-edificio.js` promete por escrito que no escribe ni un `style` en
// línea. Se comprueba sobre TODO lo que fabrica, no sobre una muestra.
for (const raiz of [bloqueEdificio, bloquePartes, dialogoCapas]) {
  for (const el of [raiz, ...raiz.querySelectorAll('[style]')]) {
    const enLinea = el.getAttribute('style')
    if (enLinea) aspecto.estilosEnLinea.push({ nodo: el.tagName.toLowerCase(), clase: el.className, style: enLinea })
  }
}
if (aspecto.estilosEnLinea.length > 0) {
  problemas.push(
    `El panel de edificio lleva ${aspecto.estilosEnLinea.length} estilo(s) EN LÍNEA: ` +
      JSON.stringify(aspecto.estilosEnLinea) +
      '. `app/panel-edificio.js` promete no escribir ni una regla de CSS, ni desde JS, y un estilo en ' +
      'línea gana a la hoja siempre, sin mirar la especificidad.',
  )
}
if (aspecto.reglas.bloquePartesFlexGrow !== '1') {
  problemas.push(
    `\`.gml-bloque--partes\` computa \`flex-grow: ${aspecto.reglas.bloquePartesFlexGrow}\` y tiene que ` +
      'ser 1: es el NUEVO ESTIRADOR del panel en esta rama, el papel que `.gml-bloque--vertices` hace ' +
      'en la de parcela. Sin él, el pie —y con él «Generar GML»— se va fuera de la pantalla.',
  )
}
if (aspecto.reglas.listaOverflowY !== 'auto') {
  problemas.push(
    `\`.gml-partes\` computa \`overflow-y: ${aspecto.reglas.listaOverflowY}\` y tiene que ser \`auto\`: ` +
      'sin él, encoger significa RECORTAR en vez de scrollear.',
  )
}
if (aspecto.reglas.listaMinHeight !== '0px') {
  problemas.push(
    `\`.gml-partes\` computa \`min-height: ${aspecto.reglas.listaMinHeight}\` y tiene que ser 0: es LA ` +
      'trampa de este fichero, escrita ya tres veces — un hijo flex no baja del alto de su contenido, ' +
      'así que 13 partes empujarían el pie fuera de la pantalla.',
  )
}
if (aspecto.reglas.dialogoCapasCerradoDisplay !== 'none') {
  problemas.push(
    `El \`<dialog>\` de capas está cerrado y computa \`display: ${aspecto.reglas.dialogoCapasCerradoDisplay}\`. ` +
      'Lo que lo oculta es `dialog:not([open])` de la hoja del NAVEGADOR, y una regla de autor con ' +
      '`display` le gana SIEMPRE: el diálogo se quedaría plantado sobre la aplicación.',
  )
}

// ── 6 · El tope `--gml-partes-alto-max: 26vh`, y quién manda de verdad ─────

const tope = (() => {
  const lista = $('.gml-partes')
  if (lista === null) return { medido: false }
  const maxHeight = getComputedStyle(lista).maxHeight
  const topePx = redondear(Number.parseFloat(maxHeight) || 0)
  const altoPx = redondear(lista.getBoundingClientRect().height)
  return {
    medido: true,
    queEs:
      'CORREGIDO AL MEDIRLO (T1.6·1): a 1440×900 el tope NO llega a morder, así que NO es lo que ' +
      'sostiene «Generar GML» a la vista. Quien lo sostiene es el reparto flex (`flex: 1 1 auto` + ' +
      '`min-height: 0` en el hijo que scrollea); el tope es la RED para cuando esa cadena se rompa.',
    ventana: { w: window.innerWidth, h: window.innerHeight },
    maxHeight,
    topePx,
    topeEsperadoPx: redondear(window.innerHeight * 0.26),
    altoRealPx: altoPx,
    // ⭐ La pregunta que importa: ¿MUERDE el tope, o manda el reparto flex?
    muerdeElTope: topePx > 0 && Math.abs(altoPx - topePx) < 1,
    mandaElRepartoFlex: topePx > 0 && altoPx < topePx - 1,
    holguraDelTopePx: topePx > 0 ? redondear(topePx - altoPx) : null,
  }
})()

// ── 7 · Soltar un `.dxf` con la rama PARCELA: no carga, y lo DICE ──────────
//
// El destino de un dibujo se resuelve por la RAMA ACTIVA (`app/main.js`, paso 9,
// resolución tardía). Con la rama PARCELA no hay a quién dárselo —la entrada por
// DXF de la parcela es la otra mitad de la asimetría que dejó F10— y «no ha pasado
// nada» es lo único que el usuario no puede interpretar.

botonParcela.click()
await esperar(() => app.getAttribute('data-rama') === 'PARCELA', 3000, 'que se vuelva a PARCELA')

const clasica = await traerFixture('test/fixtures/parsers/poly_clasica.dxf', 'poly_clasica.dxf')
const edificioMasivo = await traerFixture(
  'test/fixtures/parsers/edificio_consulta_masiva_3515508VF0831N.dxf',
  'edificio_consulta_masiva_3515508VF0831N.dxf',
)

const dxfEnParcela = { medido: false, fixture: { url: clasica.url, estado: clasica.estado, bytes: clasica.bytes ?? null } }
if (clasica.file === null) {
  problemas.push(
    `No se ha podido traer el fixture \`${clasica.url}\` (estado ${clasica.estado ?? clasica.error}). ` +
      'Este guion EXIGE `npm run dev`: `vite preview` sirve `dist/`, donde `test/fixtures/` no está.',
  )
} else {
  dxfEnParcela.medido = true
  const avisosAntes = tarjetasDeAvisos()
  const filasAntes = filasDeTabla()
  const redAntes = peticiones()

  soltar(clasica.file)
  await esperar(() => tarjetasDeAvisos() > avisosAntes, 3000, 'que la app DIGA que el dibujo no entra aquí')
  await new Promise((r) => setTimeout(r, 250))

  const redDespues = peticiones()
  dxfEnParcela.avisosAntes = avisosAntes
  dxfEnParcela.avisosDespues = tarjetasDeAvisos()
  // ⛔ NO vale `slice(-1)[0]`, y costó un rojo el 2026-08-04. Desde el rework de
  // UI hay DOS clases de aviso: los del dominio («ese dibujo entra como partes de
  // un edificio») y los de la AUTORIDAD DE NAVEGACIÓN («ya no se puede seguir en
  // Validación… te dejo en Entrada»), y el segundo puede llegar detrás del
  // primero. Leer «la última tarjeta» daba por respuesta el mensaje de navegación
  // y acusaba al de dominio de no decir por dónde sí entra — cuando lo dice, y se
  // comprobó soltando el mismo fichero en una página limpia.
  //
  // Se busca la tarjeta que habla DEL DIBUJO, no la que llegó al final.
  dxfEnParcela.textoDelAviso =
    textosDeAvisos().find((t) => /dibujo|\.dxf|edificio/i.test(t)) ?? textosDeAvisos().slice(-1)[0] ?? null
  dxfEnParcela.diceLaViaQueSiExiste =
    dxfEnParcela.textoDelAviso === null ? null : /rama Edificio/i.test(dxfEnParcela.textoDelAviso)
  dxfEnParcela.filasAntes = filasAntes
  dxfEnParcela.filasDespues = filasDeTabla()
  dxfEnParcela.huellasEnElMapa = huellas().length
  dxfEnParcela.partesEnElPanel = filasDePartes().length
  dxfEnParcela.ramaSigueEnParcela = app.getAttribute('data-rama') === 'PARCELA'
  dxfEnParcela.peticionesDeDatos = redDespues.datosCatastro - redAntes.datosCatastro

  if (dxfEnParcela.avisosDespues <= avisosAntes) {
    problemas.push(
      'Se ha soltado un `.dxf` con la rama PARCELA puesta y la aplicación NO ha dicho nada. No ha ' +
        'pasado nada visible, y «no ha pasado nada» es lo único que el usuario no puede interpretar ' +
        '(regla de oro 1). Tenía que avisar y decir POR DÓNDE sí entra.',
    )
  }
  if (dxfEnParcela.diceLaViaQueSiExiste === false) {
    problemas.push(
      'El aviso de «ese dibujo no entra en la rama Parcela» no dice por dónde sí entra: ' +
        JSON.stringify(dxfEnParcela.textoDelAviso) +
        '. Decir «no» sin decir «por dónde» es la mitad de un mensaje.',
    )
  }
  if (dxfEnParcela.filasDespues !== filasAntes) {
    problemas.push(
      `Soltar un \`.dxf\` con la rama PARCELA ha cambiado la tabla de vértices (${filasAntes} → ` +
        `${dxfEnParcela.filasDespues} filas): reabrir un dibujo como parcela NO entra en F11 y aquí se ` +
        'ha cargado algo.',
    )
  }
  if (dxfEnParcela.huellasEnElMapa > 0 || dxfEnParcela.partesEnElPanel > 0) {
    problemas.push(
      `Soltar un \`.dxf\` con la rama PARCELA ha cargado ${dxfEnParcela.partesEnElPanel} parte(s) y ` +
        `${dxfEnParcela.huellasEnElMapa} huella(s) en el mapa: se ha escrito en el store de la OTRA ` +
        'rama mientras el usuario mira ésta.',
    )
  }
  if (dxfEnParcela.peticionesDeDatos > 0) {
    problemas.push(
      `Soltar un dibujo ha disparado ${dxfEnParcela.peticionesDeDatos} petición(es) a los servicios de ` +
        'DATOS del Catastro. Leer un fichero local no consulta nada.',
    )
  }
}

// ── 8 · Soltar el mismo `.dxf` con la rama EDIFICIO: partes y huellas ──────

botonEdificio.click()
await esperar(() => app.getAttribute('data-rama') === 'EDIFICIO', 3000, 'que se conmute a EDIFICIO otra vez')

const dxfEnEdificio = { medido: false }
if (clasica.file !== null) {
  dxfEnEdificio.medido = true
  const redAntes = peticiones()
  soltar(clasica.file)
  await esperar(() => filasDePartes().length > 0, 5000, 'que entren las partes del DXF')
  await esperar(() => huellas().length > 0, 5000, 'que se pinten las huellas en el mapa')
  await new Promise((r) => setTimeout(r, 300))
  const redDespues = peticiones()

  dxfEnEdificio.partesEnElPanel = filasDePartes().length
  dxfEnEdificio.nombresDeLasPartes = filasDePartes().map((li) => {
    const n = li.querySelector('.gml-parte-nombre')
    const d = li.querySelector('.gml-parte-dato')
    return { nombre: n === null ? null : n.textContent.trim(), dato: d === null ? null : d.textContent.trim() }
  })
  dxfEnEdificio.huellasEnElMapa = huellas().length
  dxfEnEdificio.estadoDelPanel = texto('[data-estado="edificio"]')
  dxfEnEdificio.procedencia = texto('[data-procedencia="edificio"]')
  dxfEnEdificio.fichaPartes = texto('[data-ficha="vertices"]')
  dxfEnEdificio.fichaSuperficie = texto('[data-ficha="superficie"]')
  dxfEnEdificio.peticionesDeDatos = redDespues.datosCatastro - redAntes.datosCatastro
  // ⚠️ Cartografía y datos son DOS cifras. Cargar un edificio encuadra el mapa
  // sobre sus huellas, y mover el mapa pide teselas: eso no es leer el dibujo.
  dxfEnEdificio.peticionesDeCartografia = redDespues.cartografia - redAntes.cartografia
  dxfEnEdificio.altoListaPartesPx = alto('.gml-partes')
  dxfEnEdificio.altoDeUnaFilaPx = (() => {
    const fila = $('[data-lista="partes"] .gml-parte')
    return fila === null ? null : redondear(fila.getBoundingClientRect().height)
  })()

  if (dxfEnEdificio.partesEnElPanel !== 1) {
    problemas.push(
      `\`poly_clasica.dxf\` trae UNA polilínea en UNA sola capa y han entrado ` +
        `${dxfEnEdificio.partesEnElPanel} partes. Con una sola capa la vía es DIRECTA: el diálogo de ` +
        'reparto no se abre y `entradaDesdeTexto` decide sola.',
    )
  }
  if (dxfEnEdificio.huellasEnElMapa !== dxfEnEdificio.partesEnElPanel) {
    problemas.push(
      `El panel dice ${dxfEnEdificio.partesEnElPanel} parte(s) y en el mapa hay ` +
        `${dxfEnEdificio.huellasEnElMapa} huella(s). Esa resta no la puede hacer el usuario de cabeza: ` +
        'si alguna parte no trae contorno dibujable, `viewer/partes.js` lo cuenta en un aviso.',
    )
  }
  if (dxfEnEdificio.peticionesDeDatos > 0) {
    problemas.push(
      `Leer un DXF ha disparado ${dxfEnEdificio.peticionesDeDatos} petición(es) a los servicios de ` +
        'DATOS del Catastro (`wfsCP.aspx`/`wfsBU.aspx`). Un dibujo se lee del fichero y de nada más.',
    )
  }
}

// ── 9 · ⭐ Las huellas SE VEN, y ENCIMA de la parcela ──────────────────────
//
// No basta con que exista el `<path>`: un pane con el zIndex bien puesto y el
// `<path>` colgando de otro sitio se vería igual de mal. Se lee el ORDEN REAL.

const panes = (() => {
  const salida = []
  $$('.leaflet-map-pane > .leaflet-pane, .leaflet-map-pane .leaflet-pane').forEach((p, i) => {
    const clase = p.getAttribute('class') || ''
    const m = /leaflet-([a-zA-Z-]+)-pane/.exec(clase)
    salida.push({
      nombre: m === null ? clase : m[1],
      clase,
      zIndex: getComputedStyle(p).zIndex,
      ordenEnElDom: i,
      hijos: p.children.length,
    })
  })
  return salida
})()

const capaHuellas = (() => {
  const paths = huellas()
  const uno = paths[0] ?? null
  const paneDeLasHuellas =
    uno === null ? null : (uno.closest('.leaflet-pane')?.getAttribute('class') ?? null)
  const zDe = (nombre) => {
    const p = panes.find((x) => x.nombre === nombre)
    return p === undefined ? null : Number(p.zIndex)
  }
  return {
    queEs:
      'F11, decisión 3: las partes SE PINTAN. Un edificio importado de un DXF que cae 40 m al norte ' +
      'por un huso mal deducido es indistinguible de uno bueno en la lista del panel, y salta a la ' +
      'vista en cuanto se pinta sobre la ortofoto.',
    paths: paths.length,
    paneDeLasHuellas,
    existeElPane: panes.some((p) => p.nombre === 'partes'),
    zPartes: zDe('partes'),
    zParcelaEditada: zDe('parcelaEditada'),
    zVertices: zDe('vertices'),
    zAcotaciones: zDe('acotaciones'),
    // El orden REAL, tal y como el navegador lo va a apilar.
    apilado: panes
      .filter((p) => Number.isFinite(Number(p.zIndex)))
      .sort((a, b) => Number(a.zIndex) - Number(b.zIndex))
      .map((p) => `${p.nombre}:${p.zIndex}`),
    stroke: uno === null ? null : getComputedStyle(uno).stroke,
    fill: uno === null ? null : getComputedStyle(uno).fill,
    fillOpacity: uno === null ? null : getComputedStyle(uno).fillOpacity,
    strokeWidth: uno === null ? null : getComputedStyle(uno).strokeWidth,
    clase: uno === null ? null : uno.getAttribute('class'),
    // El emergente se mide APARTE, abriéndolo: ver `emergente` más abajo.
    // `bindTooltip` no fabrica el nodo hasta que se abre, así que preguntar por
    // `aria-describedby` con el emergente cerrado siempre diría que no.
    ariaDescribedbyConElEmergenteCerrado: uno === null ? null : uno.hasAttribute('aria-describedby'),
    // ⭐ Dentro del RECORTE del mapa: un `<path>` con coordenadas fuera del
    // lienzo existe en el DOM y no se ve. Se mide su caja contra la del mapa.
    dentroDelLienzo: (() => {
      const mapa = $('#mapa')
      if (uno === null || mapa === null) return null
      const b = uno.getBoundingClientRect()
      const m = mapa.getBoundingClientRect()
      return b.width > 0 && b.height > 0 && b.right > m.left && b.left < m.right && b.bottom > m.top && b.top < m.bottom
    })(),
    cajaDeLaHuella: uno === null ? null : {
      w: Math.round(uno.getBoundingClientRect().width),
      h: Math.round(uno.getBoundingClientRect().height),
    },
  }
})()

if (!capaHuellas.existeElPane) {
  problemas.push(
    'No existe el pane `partes` en el mapa. Lo crea `viewer/mapa.js` iterando `viewer/_comun.js#PANES`, ' +
      "y `crearCapaPartes` LANZA si falta: si no está, es que el visor se montó sin él.",
  )
}
if (capaHuellas.zPartes !== null && capaHuellas.zPartes !== Z_PARTES) {
  problemas.push(
    `El pane \`partes\` tiene zIndex ${capaHuellas.zPartes} y \`viewer/_comun.js#PANES\` congela ` +
      `${Z_PARTES}. Los zIndex NUNCA se copian a mano: ese fichero es la única fuente de verdad.`,
  )
}
if (
  capaHuellas.zPartes !== null &&
  capaHuellas.zParcelaEditada !== null &&
  capaHuellas.zPartes <= capaHuellas.zParcelaEditada
) {
  problemas.push(
    `El pane \`partes\` (${capaHuellas.zPartes}) NO está por encima de \`parcelaEditada\` ` +
      `(${capaHuellas.zParcelaEditada} = ${Z_PARCELA_EDITADA} esperado). En la rama EDIFICIO el ASUNTO ` +
      'es el edificio y la parcela es contexto: por debajo, el relleno amarillo taparía las huellas.',
  )
}
if (
  capaHuellas.zPartes !== null &&
  capaHuellas.zVertices !== null &&
  capaHuellas.zPartes >= capaHuellas.zVertices
) {
  problemas.push(
    `El pane \`partes\` (${capaHuellas.zPartes}) NO está por debajo de \`vertices\` ` +
      `(${capaHuellas.zVertices} = ${Z_VERTICES} esperado): el vértice sigue siendo LO QUE SE AGARRA, ` +
      'y una huella rellena por encima le robaría el puntero.',
  )
}
if (capaHuellas.paths > 0 && !/leaflet-partes-pane/.test(capaHuellas.paneDeLasHuellas || '')) {
  problemas.push(
    `Las huellas existen pero NO cuelgan del pane \`partes\` (cuelgan de ` +
      `${JSON.stringify(capaHuellas.paneDeLasHuellas)}). El zIndex del pane correcto no sirve de nada ` +
      'si el `<path>` está en otro sitio: eso es lo que se apila de verdad.',
  )
}
if (capaHuellas.stroke !== null && capaHuellas.stroke !== COLOR_HUELLA_RGB) {
  problemas.push(
    `La huella se traza con ${capaHuellas.stroke} y \`viewer/partes.js#COLOR_HUELLA\` dice ` +
      `${COLOR_HUELLA_RGB} (#A78BFA). El color está elegido por descarte y con una restricción que ` +
      'muerde: en esta rama la parcela sigue debajo, en amarillo, y dos amarillos harían indistinguible ' +
      'el edificio del solar.',
  )
}
if (capaHuellas.fill === COLOR_USUARIO_RGB || capaHuellas.stroke === COLOR_USUARIO_RGB) {
  problemas.push(
    'La huella está pintada del AMARILLO del usuario (#FFD600), que es el de la parcela que queda ' +
      'justo debajo (pane 420 contra 422): el técnico no puede distinguir el edificio del solar.',
  )
}
if (capaHuellas.paths > 0 && capaHuellas.fillOpacity !== null && Number(capaHuellas.fillOpacity) === 0) {
  problemas.push(
    'La huella tiene el relleno a opacidad CERO. Ahí se diferencia de `viewer/colindantes.js`: una ' +
      'vecina es contexto y se deja hueca, pero la huella es EL ASUNTO — un contorno hueco sobre una ' +
      'ortofoto llena de linderos y sombras de aleros no se distingue de nada.',
  )
}
if (capaHuellas.paths > 0 && capaHuellas.dentroDelLienzo === false) {
  problemas.push(
    'Las huellas existen en el DOM pero su caja cae FUERA del lienzo del mapa: están pintadas y no se ' +
      'ven. Es el modo de fallo que la decisión 3 de la fase existe para cazar (un huso mal deducido ' +
      'pone el edificio a cientos de kilómetros, en silencio).',
  )
}

// El EMERGENTE, abierto de verdad. `bindTooltip` no fabrica el nodo hasta que se
// abre, así que la única forma de comprobar que la capa es interactiva —y que su
// rótulo LLEGA— es abrirlo. Y de paso mide lo que la cabecera de `viewer/partes.js`
// declara como riesgo MAYOR que en `colindantes.js`: estas huellas van en 422, o
// sea POR ENCIMA de la parcela, y su `interactive: true` podría robarle el clic al
// mapa (que es «Deducir del mapa» de F05). `L.Path` trae `bubblingMouseEvents: true`.
const emergente = await (async () => {
  const uno = huellas()[0] ?? null
  if (uno === null) return { medido: false }
  uno.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }))
  await esperar(() => $('.gml-huella-emergente') !== null, 1500, 'que se abra el emergente de la huella')
  const nodo = $('.gml-huella-emergente')
  const salida = {
    medido: true,
    aparece: nodo !== null,
    clase: nodo === null ? null : nodo.getAttribute('class'),
    texto: nodo === null ? null : nodo.textContent.trim(),
    ariaDescribedbyAlAbrir: uno.hasAttribute('aria-describedby'),
    // El clic NO se lo puede quedar la huella: eso es «Deducir del mapa».
    burbujeaElRaton: (() => {
      let llego = false
      const anota = () => {
        llego = true
      }
      const mapa = $('#mapa')
      if (mapa === null) return null
      mapa.addEventListener('mousemove', anota)
      uno.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true }))
      mapa.removeEventListener('mousemove', anota)
      return llego
    })(),
  }
  uno.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true }))
  return salida
})()

if (emergente.medido && emergente.aparece === false) {
  problemas.push(
    'La huella no abre su emergente al pasar el puntero: `bindTooltip` no ha llegado, o la capa no es ' +
      'interactiva. El rótulo con el nombre de la parte es lo único que distingue una huella de otra ' +
      'en el mapa.',
  )
}
if (emergente.medido && emergente.burbujeaElRaton === false) {
  problemas.push(
    'La huella NO deja pasar los sucesos de ratón al mapa. Es el riesgo que `viewer/partes.js` declara ' +
      'MAYOR que en `colindantes.js` —aquéllas van en 405, debajo de todo, y éstas en 422, por encima ' +
      'de la parcela—: si esa prueba cae, «Deducir del mapa» (F05) deja de poder pinchar sobre el ' +
      'edificio. La salida escrita es dejar la capa sin emergente y con `interactive: false`.',
  )
}

// ── 10 · El diálogo de reparto por capas, con un DXF real de 8 anillos ─────
//
// `edificio_consulta_masiva_3515508VF0831N.dxf`: **7 anillos en `Construccion` +
// 1 en `Parcela`**. El reparto se OFRECE, no se impone, y no es prudencia: en
// `UTM.dxf` —el único plano real que tiene este proyecto— la parcela de verdad
// está en la capa `0` y NO en la que se llama `PARCELA`.

const reparto = { medido: false }
if (edificioMasivo.file === null) {
  problemas.push(
    `No se ha podido traer el fixture \`${edificioMasivo.url}\` (estado ` +
      `${edificioMasivo.estado ?? edificioMasivo.error}).`,
  )
} else {
  reparto.medido = true
  reparto.fixture = { url: edificioMasivo.url, bytes: edificioMasivo.bytes ?? null }
  const redAntes = peticiones()

  soltar(edificioMasivo.file)
  await esperar(() => dialogoCapas.open, 5000, 'que se abra el diálogo de reparto por capas')
  await new Promise((r) => setTimeout(r, 200))

  reparto.abierto = dialogoCapas.open
  reparto.esModal = typeof dialogoCapas.matches === 'function' ? dialogoCapas.matches(':modal') : null
  reparto.displayAbierto = getComputedStyle(dialogoCapas).display
  reparto.focoDentro = dialogoCapas.contains(document.activeElement)
  reparto.filas = $$('[data-lista="capas"] [data-capa]').map((li) => ({
    capa: li.getAttribute('data-capa'),
    texto: li.textContent.replace(/\s+/g, ' ').trim(),
    marcada: li.querySelector('[data-campo="capa-elegida"]')?.checked ?? null,
  }))
  reparto.ningunaMarcadaDeFabrica = reparto.filas.every((f) => f.marcada === false)

  const botonAplicar = $('[data-accion="aplicar-capas"]')
  const renglonCapas = $('[data-estado="dialogo-capas"]')
  reparto.aplicarNaceApagado = botonAplicar === null ? null : botonAplicar.disabled
  reparto.motivoAlNacer = renglonCapas === null ? null : renglonCapas.textContent.trim()

  // ⚠️ EL CAMINO INGENUO, MEDIDO A PROPÓSITO: asignar `.checked` NO dispara
  // `change`, así que el gate no se entera. Se deja escrito para quien venga
  // detrás — y de paso comprueba que el gate lo gobierna un suceso y no un sondeo.
  const casillaConstruccion = $('[data-capa="Construccion"] [data-campo="capa-elegida"]')
  if (casillaConstruccion !== null) {
    casillaConstruccion.checked = true
    await new Promise((r) => setTimeout(r, 80))
    reparto.aplicarTrasAsignarChecked = botonAplicar === null ? null : botonAplicar.disabled

    // Y ahora bien: el suceso despachado, que es lo que hace un ratón de verdad.
    casillaConstruccion.dispatchEvent(new Event('change', { bubbles: true }))
    await esperar(() => botonAplicar !== null && !botonAplicar.disabled, 2000, 'que se encienda «Cargar las partes»')
    reparto.aplicarTrasDespacharChange = botonAplicar === null ? null : botonAplicar.disabled
    reparto.motivoTrasMarcar = renglonCapas === null ? null : renglonCapas.textContent.trim()

    if (botonAplicar !== null && !botonAplicar.disabled) {
      botonAplicar.click()
      await esperar(() => !dialogoCapas.open, 4000, 'que se cierre el diálogo al aplicar')
      await esperar(() => filasDePartes().length === 7, 5000, 'que entren las 7 partes de «Construccion»')
      await new Promise((r) => setTimeout(r, 300))
    }
  } else {
    problemas.push(
      'El diálogo de reparto no trae la capa `Construccion`, y el fixture ' +
        '`edificio_consulta_masiva_3515508VF0831N.dxf` la trae con 7 anillos (+1 en `Parcela`). ' +
        `Filas encontradas: ${JSON.stringify(reparto.filas)}.`,
    )
  }

  const redDespues = peticiones()
  reparto.partesTrasAplicar = filasDePartes().length
  reparto.huellasTrasAplicar = huellas().length
  reparto.estadoDelPanel = texto('[data-estado="edificio"]')
  reparto.procedencia = texto('[data-procedencia="edificio"]')
  reparto.fichaPartes = texto('[data-ficha="vertices"]')
  reparto.fichaSuperficie = texto('[data-ficha="superficie"]')
  reparto.dialogoCerrado = !dialogoCapas.open
  reparto.displayCerrado = getComputedStyle(dialogoCapas).display
  reparto.peticionesDeDatos = redDespues.datosCatastro - redAntes.datosCatastro
  reparto.altoListaPartesPx = alto('.gml-partes')
  reparto.altoDeUnaFilaPx = (() => {
    const fila = $('[data-lista="partes"] .gml-parte')
    return fila === null ? null : redondear(fila.getBoundingClientRect().height)
  })()
  reparto.filasQueSeVenEnteras =
    reparto.altoListaPartesPx === null || !reparto.altoDeUnaFilaPx
      ? null
      : Math.floor(reparto.altoListaPartesPx / reparto.altoDeUnaFilaPx)
  reparto.hayScrollEnLaLista = (() => {
    const l = $('.gml-partes')
    return l === null ? null : l.scrollHeight > l.clientHeight + 1
  })()

  if (reparto.filas.length !== 2) {
    problemas.push(
      `El diálogo de reparto enseña ${reparto.filas.length} capa(s) y el fixture trae DOS ` +
        `(\`Construccion\` con 7 anillos y \`Parcela\` con 1): ${JSON.stringify(reparto.filas)}.`,
    )
  }
  if (reparto.ningunaMarcadaDeFabrica === false) {
    problemas.push(
      'El diálogo de reparto viene con alguna capa MARCADA de fábrica. Ninguna puede venir marcada, y ' +
        'no es prudencia: en `UTM.dxf` la parcela de verdad está en la capa `0` y no en la que se ' +
        'llama `PARCELA`. Elegir por el nombre falla en el único plano real que tiene este proyecto.',
    )
  }
  if (reparto.aplicarNaceApagado !== true) {
    problemas.push(
      '«Cargar las partes» NO nace apagado con el diálogo recién abierto y ninguna capa marcada: ' +
        'aplicarlo así no cargaría ninguna parte.',
    )
  }
  if (reparto.aplicarNaceApagado === true && !reparto.motivoAlNacer) {
    problemas.push(
      '«Cargar las partes» nace apagado y su renglón está en blanco. Botón apagado CON MOTIVO, en el ' +
        'mismo paso, jamás en dos.',
    )
  }
  if (reparto.esModal === false) {
    problemas.push(
      'El `<dialog>` de reparto está abierto pero NO es `:modal`: se ha abierto con el atributo `open` ' +
        'en vez de con `showModal()`, así que no hay capa superior, ni velo, ni atrape de foco. En ' +
        'jsdom eso es lo normal (no implementa `showModal`); en un navegador de verdad es un defecto.',
    )
  }
  if (reparto.focoDentro === false) {
    problemas.push('Al abrir el diálogo de capas el foco se ha quedado FUERA: `Escape` no llegaría nunca.')
  }
  if (reparto.aplicarTrasDespacharChange === true) {
    problemas.push(
      'Marcar una capa y despachar su `change` NO ha encendido «Cargar las partes»: el gate del ' +
        'diálogo no se entera de lo que el usuario marca.',
    )
  }
  if (reparto.partesTrasAplicar !== 7) {
    problemas.push(
      `Se ha aplicado la capa \`Construccion\` (7 anillos medidos en el fixture) y han entrado ` +
        `${reparto.partesTrasAplicar} partes.`,
    )
  }
  if (reparto.huellasTrasAplicar !== reparto.partesTrasAplicar) {
    problemas.push(
      `El panel dice ${reparto.partesTrasAplicar} partes y en el mapa hay ${reparto.huellasTrasAplicar} ` +
        'huellas.',
    )
  }
  if (reparto.dialogoCerrado && reparto.displayCerrado !== 'none') {
    problemas.push(
      `El diálogo de capas cerrado computa \`display: ${reparto.displayCerrado}\` y debería ser «none».`,
    )
  }
  if (reparto.peticionesDeDatos > 0) {
    problemas.push(
      `Repartir un DXF por capas ha disparado ${reparto.peticionesDeDatos} petición(es) a los servicios ` +
        'de DATOS del Catastro.',
    )
  }

  // ── ⭐ Lo que la carga DICE por el panel, contrastado con lo que HA PASADO ──
  //
  // `edificio/entrada.js` filtra `BLOQUEOS_SOLO_PARCELA` de `resumen.bloqueos`
  // —los dos bloqueos que T1.1 añadió son DE PARCELA y en esta rama cada anillo es
  // su propio exterior—, pero las DETECCIONES de aguas arriba llegan tal cual y son
  // lo que el usuario LEE. Un aviso que afirma que algo no se ha construido,
  // mientras el renglón del panel dice que sí, es un error silencioso al revés: la
  // aplicación se contradice y quien decide cuál de las dos frases se cree es el
  // usuario. Se mide con el literal exacto, no con un `/parcela/i` que daría falsos
  // positivos sobre mensajes legítimos (el del autoguardado nombra la rama Parcela
  // a propósito, y está bien).
  reparto.avisosTrasCargar = textosDeAvisos().map((t) => t.slice(0, 200))
  reparto.avisoQueNiegaLaCarga =
    textosDeAvisos().find((t) => /No se construye la parcela/i.test(t)) ?? null
  reparto.elPanelDiceQueSiCargo = /Cargad/i.test(reparto.estadoDelPanel || '')
  if (reparto.avisoQueNiegaLaCarga !== null && reparto.elPanelDiceQueSiCargo) {
    problemas.push(
      'LA APLICACIÓN SE CONTRADICE: el renglón del panel dice ' +
        JSON.stringify(reparto.estadoDelPanel) +
        ' y en el panel de avisos hay una tarjeta que dice ' +
        JSON.stringify(reparto.avisoQueNiegaLaCarga) +
        '. Ese aviso viene de `parsers/importar.js` y habla del reparto «un exterior + N huecos», que ' +
        'es DE PARCELA: en la rama EDIFICIO cada anillo es su propio exterior, así que ni el número ' +
        'negativo ni la frase «No se construye la parcela» significan nada aquí. ' +
        '`edificio/entrada.js` ya filtra esos dos códigos de `resumen.bloqueos` (con ' +
        '`BLOQUEOS_SOLO_PARCELA`, y lo documenta); lo que no se filtra es su DETECCIÓN, que es ' +
        'justamente la mitad que el usuario lee.',
    )
  }
}

// ── 10bis · ⭐ LA ADVERTENCIA DEL AUTOGUARDADO: UNA VEZ, NO DOS ────────────
//
// **El guardián que impide que vuelvan 89 px.** Hasta el 2026-08-04 la misma
// advertencia se enseñaba DOS VECES A LA VEZ: entera y permanente concatenada en
// `[data-procedencia="edificio"]` —donde medía **89,06 px** de un panel al que le
// faltaban 32,70— y entera otra vez como tarjeta del panel de avisos en cuanto
// había algo que perder. Decir dos veces lo mismo no es el doble de honrado.
//
// El reparto que se decidió, y este bloque mide sus DOS mitades:
//   · en el renglón, **una línea** ({@link BREVE}), permanente, porque no guardar
//     es una PROPIEDAD de esta versión y no un suceso;
//   · en el panel de avisos, **la tarjeta entera y UNA vez**, cuando pasa a haber
//     algo que perder, que es cuando la advertencia se puede accionar.
//
// ⛔ **Y las dos mitades tienen que estar.** Un guardián que solo mirara la
// primera aprobaría el peor desenlace posible: que el ahorro se llevara la
// advertencia por delante y la rama dejara de decir que no guarda. Por eso la
// tarjeta se exige, no se supone.
//
// ⚠️ **El texto LARGO no se copia aquí, se DERIVA de la aplicación**: es el de la
// propia tarjeta. Copiarlo obligaría a mantener 289 caracteres en dos sitios, que
// es exactamente la clase de duplicado que este bloque existe para cazar. Lo único
// que se cita es el literal BREVE, que es el contrato del renglón.

/**
 * El literal que TIENE que llevar el renglón de procedencia (contrato con
 * `app/cableado-edificio.js#MENSAJE_SIN_AUTOGUARDADO_BREVE`).
 *
 * ⛔ **F12 · T4.3 · ACTUALIZADO, porque el anterior CADUCÓ dentro de esa tarea.**
 * Decía «Esta rama no se guarda sola: exporta el dibujo desde tu CAD antes de cerrar
 * la pestaña», y las dos mitades dejaron de ser verdad el mismo día: la rama pasó a
 * autoguardarse (clave de borrador propia + identidad del `Edificio`) y el recinto
 * pasó a poderse dibujar aquí, así que no hay CAD del que reexportarlo. Este guion
 * habría seguido exigiendo la frase vieja y habría dado `ok:false` acusando al
 * producto de un defecto que era suyo.
 */
const BREVE = 'Esta rama guarda el trabajo en curso, pero todavía no lo archiva con nombre.'

const advertenciaSinAutoguardado = (() => {
  const renglon = $('[data-procedencia="edificio"]')
  const textoRenglon = renglon === null ? null : renglon.textContent.trim()
  // La tarjeta larga, tomada de la aplicación: la que empieza como la breve —las dos
  // hablan de «esta rama»— y no ES la breve. Así el guion no guarda una segunda copia.
  const tarjetas = textosDeAvisos().filter((t) => /^Esta rama /i.test(t))
  const larga = tarjetas.find((t) => t !== BREVE) ?? null
  return {
    queEs:
      'La misma advertencia, repartida en dos mitades que dicen cosas distintas: una línea permanente ' +
      'en el renglón (no guardar es una propiedad de esta versión) y la tarjeta entera en el panel de ' +
      'avisos, una vez, cuando ya hay algo que perder. El texto largo se DERIVA de la tarjeta, no se ' +
      'copia aquí.',
    textoDelRenglon: textoRenglon,
    largoDelRenglonCaracteres: textoRenglon === null ? null : textoRenglon.length,
    altoDelRenglonPx: alto(renglon),
    renglonLlevaLaBreve: textoRenglon === null ? null : textoRenglon.includes(BREVE),
    tarjetasConLaAdvertencia: tarjetas.length,
    textoDeLaTarjeta: larga,
    largoDeLaTarjetaCaracteres: larga === null ? null : larga.length,
    // ⛔ LA REPETICIÓN: el renglón llevando, palabra por palabra, lo que ya dice
    // la tarjeta. Se comprueba contra el texto REAL de la tarjeta.
    elRenglonRepiteLaTarjeta:
      textoRenglon === null || larga === null ? null : textoRenglon.includes(larga),
  }
})()

if (advertenciaSinAutoguardado.renglonLlevaLaBreve === false) {
  problemas.push(
    'El renglón `[data-procedencia="edificio"]` no lleva la advertencia breve de que esta rama ' +
      `todavía no ARCHIVA con nombre. Dice: ${JSON.stringify(advertenciaSinAutoguardado.textoDelRenglon)}. ` +
      'Esa línea es permanente a propósito: no archivar es una propiedad de esta versión, no un ' +
      'suceso, y el usuario tiene que verla ANTES de contar con algo que no va a estar.',
  )
}
if (advertenciaSinAutoguardado.elRenglonRepiteLaTarjeta === true) {
  problemas.push(
    `El renglón de procedencia mide ${advertenciaSinAutoguardado.altoDelRenglonPx} px y repite PALABRA ` +
      'POR PALABRA lo que ya dice la tarjeta del panel de avisos. Es la repetición que costaba 89,06 ' +
      'px en un panel al que le faltaban 32,70: decir dos veces lo mismo no es el doble de honrado. ' +
      'En el renglón va la línea breve; la versión entera vive en la tarjeta.',
  )
}
if (advertenciaSinAutoguardado.tarjetasConLaAdvertencia === 0) {
  problemas.push(
    'Se ha cargado un edificio y NO hay ninguna tarjeta en el panel de avisos que diga qué hace y ' +
      'qué no hace esta rama con lo que se acaba de cargar. Ahora sí hay algo en juego, y ése es ' +
      'justo el momento en que la advertencia se puede accionar. Un ahorro de píxeles que se lleva ' +
      'la advertencia por delante es peor que los píxeles que ahorraba.',
  )
}
if (advertenciaSinAutoguardado.tarjetasConLaAdvertencia > 1) {
  advertencias.push(
    `Hay ${advertenciaSinAutoguardado.tarjetasConLaAdvertencia} tarjetas con la advertencia del ` +
      'autoguardado en el panel de avisos. Tenía que decirse UNA vez: la lista de avisos es finita y ' +
      'cada repetición desaloja algo que sí es de este documento.',
  )
}

// El tope, remedido AHORA que la lista tiene 7 filas de verdad y no un renglón
// vacío: es la única medida que dice si `26vh` muerde o si manda el reparto flex.
const topeConPartes = (() => {
  const lista = $('.gml-partes')
  if (lista === null) return { medido: false }
  const topePx = redondear(Number.parseFloat(getComputedStyle(lista).maxHeight) || 0)
  const altoPx = redondear(lista.getBoundingClientRect().height)
  const filaPx = reparto.altoDeUnaFilaPx ?? null
  return {
    medido: true,
    ventana: { w: window.innerWidth, h: window.innerHeight },
    topePx,
    altoRealPx: altoPx,
    muerdeElTope: topePx > 0 && Math.abs(altoPx - topePx) < 1,
    mandaElRepartoFlex: topePx > 0 && altoPx < topePx - 1,
    altoDeUnaFilaPx: filaPx,
    filasEnterasQueCaben: filaPx ? Math.floor(altoPx / filaPx) : null,
    // ── El mismo reparto que el §3bis, remedido con 7 partes y sus avisos ─────
    // dentro. **Es el peor momento del panel y es el estado en el que se
    // trabaja**: el panel vacío puede caber y no ser el caso que importa.
    hijos:
      panelIzquierdo === null
        ? null
        : [...panelIzquierdo.children]
            .filter((el) => !el.hidden)
            .map((el) => ({
              clase: (el.className || el.tagName).replace('gml-bloque ', ''),
              altoPx: redondear(el.getBoundingClientRect().height),
              flex: getComputedStyle(el).flex,
            })),
    origenDesglose: [...bloqueEdificio.children].map((el) => ({
      clase: el.className || el.tagName.toLowerCase(),
      altoPx: redondear(el.getBoundingClientRect().height),
    })),
    pieDesglose: (() => {
      const pie = $('.gml-panel-pie')
      return pie === null
        ? null
        : [...pie.children].map((el) => ({
            clase: el.className || el.tagName.toLowerCase(),
            altoPx: redondear(el.getBoundingClientRect().height),
          }))
    })(),
    sobresuscripcionPx:
      panelIzquierdo === null
        ? null
        : redondear(
            [...panelIzquierdo.children]
              .filter((el) => !el.hidden)
              .reduce((a, el) => a + el.getBoundingClientRect().height, 0) -
              panelIzquierdo.getBoundingClientRect().height,
          ),
    recorteDelPanelPx:
      panelIzquierdo === null ? null : panelIzquierdo.scrollHeight - panelIzquierdo.clientHeight,
    contenidoDeLaListaPx: lista.scrollHeight,
    avisos: (() => {
      const caja = $('#avisos')
      return caja === null
        ? null
        : {
            altoPx: redondear(caja.getBoundingClientRect().height),
            contenidoPx: caja.scrollHeight,
            tarjetas: tarjetasDeAvisos(),
          }
    })(),
    // ⭐ **CUÁNTOS PÍXELES FALTAN, que es la pregunta que hay que contestar cuando
    // el panel ya CABE pero los encogibles siguen sin sitio.** «Cabe» es un
    // booleano y no dice nada accionable; esto es una resta con dos umbrales
    // declarados: el MÍNIMO decente (una fila de la lista y una línea de los
    // avisos, que es lo que hace que las dos cajas dejen de parecer rotas) y el
    // TODO (las 7 filas y las tarjetas enteras). Quien tenga que decidir de dónde
    // salen los píxeles necesita las dos cifras, no la respuesta «no cabe».
    deficit: (() => {
      const caja = $('#avisos')
      const unaLinea = 16
      const faltaLista = filaPx ? redondear(Math.max(0, filaPx - altoPx)) : null
      const faltaListaTodo = filaPx ? redondear(Math.max(0, lista.scrollHeight - altoPx)) : null
      const altoAvisos = caja === null ? null : caja.getBoundingClientRect().height
      const faltaAvisos = caja === null ? null : redondear(Math.max(0, unaLinea - altoAvisos))
      const faltaAvisosTodo = caja === null ? null : redondear(Math.max(0, caja.scrollHeight - altoAvisos))
      return {
        queEs:
          'Lo que le falta al panel para que sus dos cajas encogibles dejen de parecer rotas. NO es ' +
          '«no cabe»: el panel cabe (recorte 0). Es que los dos únicos elementos que pueden ceder ' +
          'ceden hasta el hueso en cuanto entran datos.',
        paraUnaFilaDeLaListaPx: faltaLista,
        paraTodaLaListaPx: faltaListaTodo,
        paraUnaLineaDeAvisosPx: faltaAvisos,
        paraTodosLosAvisosPx: faltaAvisosTodo,
        minimoDecentePx:
          faltaLista === null || faltaAvisos === null ? null : redondear(faltaLista + faltaAvisos),
        todoPx:
          faltaListaTodo === null || faltaAvisosTodo === null
            ? null
            : redondear(faltaListaTodo + faltaAvisosTodo),
        // ⭐ Y cuando el mínimo ya se cumple, lo que hace falta saber es LO
        // CONTRARIO: **cuánto sobra**. Es el margen con el que se va a encontrar
        // quien toque este panel después —F12 le añade las plantas por parte—, y
        // un margen que nadie ha contado se gasta solo.
        margen: {
          enLaListaPx: filaPx ? redondear(Math.max(0, altoPx - filaPx)) : null,
          enLosAvisosPx: caja === null ? null : redondear(Math.max(0, altoAvisos - unaLinea)),
          totalPx:
            filaPx && caja !== null
              ? redondear(Math.max(0, altoPx - filaPx) + Math.max(0, altoAvisos - unaLinea))
              : null,
        },
      }
    })(),
    // ⚠️ DERIVADO, NO MEDIDO: a 768 px de alto el tope vale 199,68 px. Se dice
    // que es derivado porque un tope en `vh` protege del contenido largo y no de
    // la ventana corta, y esa cifra hay que MEDIRLA en una segunda pasada (§19).
    derivadoA768: filaPx
      ? {
          derivado: true,
          topePx: redondear(768 * 0.26),
          filasEnteras: Math.floor((768 * 0.26) / filaPx),
        }
      : null,
  }
})()

// ⭐⭐ El guardián del recorte, la SEGUNDA vez: con las 7 partes dentro y sus
// avisos, que es el peor momento del panel. En la corrida del 2026-08-04 valía
// 115 px. Cero exacto, por lo mismo que en el §3bis.
if (topeConPartes.medido && topeConPartes.recorteDelPanelPx > 0) {
  problemas.push(
    `Con las 7 partes cargadas el panel recorta ${topeConPartes.recorteDelPanelPx} px por abajo ` +
      `(sobresuscripción ${topeConPartes.sobresuscripcionPx} px). El panel vacío puede caber y este ` +
      'no es el caso que importa: el usuario trabaja con partes dentro, y ahí es donde el pie se cae ' +
      'de la pantalla. El 2026-08-04 valía 115 px.',
  )
}
if (topeConPartes.medido && topeConPartes.filasEnterasQueCaben === 0) {
  problemas.push(
    `Con 7 partes cargadas no se ve NI UNA fila entera de la lista (alto ${topeConPartes.altoRealPx} px, ` +
      `contenido ${topeConPartes.contenidoDeLaListaPx} px, fila ${topeConPartes.altoDeUnaFilaPx} px). La ` +
      'lista de partes es el asunto entero de esta rama. ⚠️ El panel CABE (recorte ' +
      `${topeConPartes.recorteDelPanelPx} px): lo que pasa es que los dos únicos encogibles ceden hasta ` +
      `el hueso en cuanto entran datos. Faltan ${topeConPartes.deficit.paraUnaFilaDeLaListaPx} px para ` +
      `UNA fila y ${topeConPartes.deficit.paraTodaLaListaPx} px para las siete; de dónde salen, en ` +
      '`topeConPartes.hijos` / `origenDesglose` / `pieDesglose`.',
  )
}
if (
  topeConPartes.medido &&
  topeConPartes.avisos !== null &&
  topeConPartes.avisos.tarjetas > 0 &&
  topeConPartes.avisos.altoPx < 16
) {
  problemas.push(
    `Con datos cargados la caja de avisos mide ${topeConPartes.avisos.altoPx} px y lleva ` +
      `${topeConPartes.avisos.tarjetas} tarjeta(s) que necesitan ${topeConPartes.avisos.contenidoPx} px: ` +
      'no cabe ni una línea. Es la segunda víctima del mismo reparto, y en el peor momento — justo ' +
      'cuando la aplicación tiene algo que decir sobre lo que se acaba de cargar. Faltan ' +
      `${topeConPartes.deficit.paraUnaLineaDeAvisosPx} px para una línea y ` +
      `${topeConPartes.deficit.paraTodosLosAvisosPx} px para las tarjetas enteras.`,
  )
}

// ── 11 · ⭐ LA VUELTA: el panel de parcela sigue vivo (M10) ────────────────

botonParcela.click()
await esperar(() => app.getAttribute('data-rama') === 'PARCELA', 3000, 'que se vuelva a la rama PARCELA')
await asentarPanel(altoCajaVertices)

const refcatParcelaDespues = $('[data-campo="refcat"]')
if (refcatParcelaDespues !== null) {
  refcatParcelaDespues.dispatchEvent(new Event('input', { bubbles: true }))
}

const idaYVuelta = {
  queEs:
    'M10 en un navegador de verdad, con la aplicación entera montada. La regla dura de `app/rama.js` ' +
    'es que el intercambio sea `seccion.hidden` y JAMÁS `replaceChildren`: con `hidden` el nodo sigue ' +
    'conectado, conserva su valor y sus oyentes siguen disparando; con `replaceChildren` la ' +
    'referencia que el cableado resolvió UNA vez en el montaje queda huérfana, escribible y MUDA ' +
    '—escribir en ella no lanza— y el dato acaba fuera del documento mientras el usuario ve el campo ' +
    'vacío. Superficie del riesgo, contada: 30 nodos de `app/` resueltos así.',
  // 1 · El MISMO nodo. `===`, no «uno que se le parece».
  mismoNodo: refcatParcelaAntes !== null && refcatParcelaDespues === refcatParcelaAntes,
  conectado: refcatParcelaAntes === null ? null : refcatParcelaAntes.isConnected,
  // 2 · Con su valor.
  valorEscrito: VALOR_SONDA,
  valorAhora: refcatParcelaDespues === null ? null : refcatParcelaDespues.value,
  // 3 · Y con su cableado vivo. Ver {@link sondaRefcat}: la sonda es del guion, y
  // está dicho por qué (la aplicación no engancha ningún `input` a este campo, y
  // pulsar «Traer del Catastro» sería una petición que este guion no hace).
  sondaAntes,
  sondaDespues: sondaRefcat,
  sondaSigueDisparando: sondaRefcat > sondaAntes,
  // 4 · El corolario T0.3·6, medido en vivo: con las DOS ramas en el DOM,
  // `querySelector('[data-campo="refcat"]')` sigue devolviendo el de PARCELA.
  querySelectorDevuelveElDeParcela:
    refcatParcelaDespues !== null &&
    refcatParcelaDespues.closest('[data-rama-panel]')?.getAttribute('data-rama-panel') === 'PARCELA',
  // 5 · Los dos CTA del pie, restaurados EXACTAMENTE como estaban.
  ctaGenerarApagado: ctaGenerar === null ? null : ctaGenerar.disabled,
  ctaDiagnosticarApagado: ctaDiagnosticar === null ? null : ctaDiagnosticar.disabled,
  renglonGenerar: renglonGenerar === null ? null : renglonGenerar.textContent.trim(),
  renglonDiagnosticar: renglonDiagnosticar === null ? null : renglonDiagnosticar.textContent.trim(),
  ctaGenerarRestaurado: ctaGenerar === null ? null : ctaGenerar.disabled === arranque.ctaGenerarApagado,
  ctaDiagnosticarRestaurado:
    ctaDiagnosticar === null ? null : ctaDiagnosticar.disabled === arranque.ctaDiagnosticarApagado,
  renglonGenerarRestaurado:
    renglonGenerar === null ? null : renglonGenerar.textContent.trim() === arranque.renglonGenerar,
  // ⭐ Y las DOS marcas que `cablearRama` pone SOLO mientras la rama EDIFICIO está
  // puesta tienen que irse con ella. Un `aria-describedby` superviviente apuntaría,
  // en la rama PARCELA, a un renglón vacío o —peor— al que el cableado del GML use
  // para decir otra cosa: el lector de pantalla leería el estado de «Generar GML»
  // como si fuera la descripción de «Diagnosticar encaje». Y un `id` huérfano en un
  // nodo de `index.html` es exactamente el residuo que este módulo promete no dejar.
  describedbyDelSegundoCta:
    ctaDiagnosticar === null ? null : ctaDiagnosticar.getAttribute('aria-describedby'),
  idDelRenglonPrincipal: renglonGenerar === null ? null : renglonGenerar.id || null,
  // 6 · La barra de edición vuelve.
  barraEdicionVisible: (() => {
    const barra = $('.gml-barra-edicion')
    return barra === null ? null : barra.hidden !== true
  })(),
  // 7 · La tabla de vértices, entera.
  filas: filasDeTabla(),
  altoCajaVerticesPx: altoCajaVertices(),
  tarjetasDeAvisos: tarjetasDeAvisos(),
  // 8 · Y la ficha del pie, con sus ocho pares y sus rótulos de parcela.
  paresVisiblesEnLaFicha: $$('.gml-ficha dd[data-ficha]').filter((dd) => !dd.hidden).length,
  rotuloVertices: (() => {
    const par = parDeLaFicha('vertices')
    return par === null || par.dt === null ? null : par.dt.textContent.trim()
  })(),
  rotuloSuperficie: (() => {
    const par = parDeLaFicha('superficie')
    return par === null || par.dt === null ? null : par.dt.textContent.trim()
  })(),
  altoFichaPx: alto(ficha),
  // 9 · Las huellas del edificio SIGUEN pintadas: la parcela y el edificio son
  // dos documentos y el mapa es uno. Se publica como HECHO, no como problema.
  huellasQueSiguenEnElMapa: huellas().length,
}

if (idaYVuelta.mismoNodo === false) {
  problemas.push(
    'Tras ir a EDIFICIO y volver, `[data-campo="refcat"]` YA NO ES EL MISMO NODO. Es exactamente el ' +
      'fallo que la regla dura de `app/rama.js` existe para impedir: hay 30 nodos de `app/` resueltos ' +
      'UNA sola vez en el montaje, y todos ellos acaban de quedarse huérfanos, escribibles y MUDOS.',
  )
}
if (idaYVuelta.conectado === false) {
  problemas.push(
    'El campo de la referencia catastral de parcela ha vuelto DESCONECTADO del documento ' +
      '(`isConnected: false`): escribir en él no lanza y el usuario ve el campo vacío.',
  )
}
if (idaYVuelta.valorAhora !== VALOR_SONDA) {
  problemas.push(
    `El campo de la referencia catastral ha perdido lo que tenía escrito: se escribió ` +
      `${JSON.stringify(VALOR_SONDA)} y ahora dice ${JSON.stringify(idaYVuelta.valorAhora)}. Conmutar ` +
      'de rama no puede borrarle al usuario lo que estaba tecleando.',
  )
}
if (idaYVuelta.sondaSigueDisparando === false) {
  problemas.push(
    'Los oyentes del campo de la referencia catastral han dejado de disparar tras la ida y vuelta: el ' +
      'nodo está en el documento y ya no oye nada.',
  )
}
if (idaYVuelta.querySelectorDevuelveElDeParcela === false) {
  problemas.push(
    '`querySelector("[data-campo=refcat]")` ya no devuelve el campo de la rama PARCELA. Es el ' +
      'corolario medido en T0.3·6: con las dos ramas en el DOM manda el orden del documento, y por eso ' +
      'el contrato K.1 prohíbe repetir un `data-*` entre ramas.',
  )
}
if (idaYVuelta.filas !== 15) {
  problemas.push(
    `Al volver a la rama PARCELA la tabla tiene ${idaYVuelta.filas} filas y tenía 15: la geometría se ` +
      'ha perdido por el camino.',
  )
}
if (idaYVuelta.ctaGenerarRestaurado === false || idaYVuelta.ctaDiagnosticarRestaurado === false) {
  problemas.push(
    `Los CTA del pie no han vuelto a como estaban (generar: ${arranque.ctaGenerarApagado} → ` +
      `${idaYVuelta.ctaGenerarApagado}; diagnosticar: ${arranque.ctaDiagnosticarApagado} → ` +
      `${idaYVuelta.ctaDiagnosticarApagado}). \`cablearRama\` guarda lo que tenía cada uno antes de ` +
      'apagarlo justamente para poder devolverlo.',
  )
}
if (idaYVuelta.renglonGenerarRestaurado === false) {
  problemas.push(
    'El renglón de «Generar GML» no ha vuelto a lo que decía antes de la conmutación: se ha quedado ' +
      `con ${JSON.stringify(idaYVuelta.renglonGenerar)} y decía ${JSON.stringify(arranque.renglonGenerar)}.`,
  )
}
if (idaYVuelta.describedbyDelSegundoCta !== null) {
  problemas.push(
    `Al volver a la rama PARCELA, «Diagnosticar encaje» se ha quedado con ` +
      `\`aria-describedby="${idaYVuelta.describedbyDelSegundoCta}"\`. Esa marca es de la rama EDIFICIO ` +
      'y solo de ella: aquí apunta al renglón de OTRO botón, así que el lector de pantalla leería el ' +
      'estado de «Generar GML» como si fuera la descripción de éste.',
  )
}
if (idaYVuelta.idDelRenglonPrincipal !== null) {
  problemas.push(
    `Al volver a la rama PARCELA, el renglón de «Generar GML» se ha quedado con el \`id\` ` +
      `«${idaYVuelta.idDelRenglonPrincipal}», que lo pone \`app/rama.js\` solo mientras la rama ` +
      'EDIFICIO está puesta. Este módulo promete devolver el documento exactamente a como estaba.',
  )
}
if (idaYVuelta.barraEdicionVisible === false) {
  problemas.push(
    'La barra de edición flotante NO ha vuelto al volver a la rama PARCELA: se oculta con `hidden` a ' +
      'propósito (nunca `remove()`) para poder reponerla sin recablear los siete nodos que ' +
      '`app/main.js#cablearEdicion` resolvió en el montaje.',
  )
}
if (idaYVuelta.paresVisiblesEnLaFicha !== 8) {
  problemas.push(
    `Al volver a PARCELA la ficha enseña ${idaYVuelta.paresVisiblesEnLaFicha} pares de los ocho: los ` +
      'cuatro que se ocultaron no han vuelto.',
  )
}
if (idaYVuelta.rotuloVertices !== 'Vértices' || idaYVuelta.rotuloSuperficie !== 'Superficie') {
  problemas.push(
    `Los rótulos de la ficha no han vuelto a los de parcela (${JSON.stringify(idaYVuelta.rotuloVertices)}, ` +
      `${JSON.stringify(idaYVuelta.rotuloSuperficie)}).`,
  )
}

// ── 12 · ⭐ EL INVARIANTE, CON ATRIBUCIÓN ──────────────────────────────────
//
// Las dos lecciones ya pagadas: `09` midió demasiado tarde y le cargó al cajón
// píxeles ajenos; `11` midió demasiado pronto y le cargó al diálogo 33 px que eran
// del renglón de las colindantes. Aquí la pérdida se PUBLICA y se ATRIBUYE.

const invariante = {
  queEs:
    'F11 tenía que ser la SEXTA fase seguida a coste 0 px. El invariante vale SOLO en la rama ' +
    'PARCELA: en EDIFICIO la caja que se estira es `.gml-partes` y arranca ~42 px por debajo, porque ' +
    '«Origen del edificio» cuesta 42,07 px más que «Origen de la parcela». Son dos cifras, no una.',
  referenciaPx: CAJA_VERTICES_REFERENCIA,
  // ── Las TRES cifras de M8, medidas DESPUÉS del cambio ────────────────────
  m8: {
    anchoLibreDeLosChipsPx: conmutadorAncho.holguraPx,
    anchoLibreSinConmutadorPx: conmutadorAncho.anchoLibreSinConmutadorPx,
    altoDeLaCabeceraPx: arranque.altoCabeceraPx,
    altoDeLaCajaDeVerticesPx: arranque.altoCajaVerticesPx,
  },
  alArrancarPx: arranque.altoCajaVerticesPx,
  alVolverPx: idaYVuelta.altoCajaVerticesPx,
  clavado:
    arranque.altoCajaVerticesPx === null || idaYVuelta.altoCajaVerticesPx === null
      ? null
      : arranque.altoCajaVerticesPx === idaYVuelta.altoCajaVerticesPx,
  perdidaPx:
    arranque.altoCajaVerticesPx === null || idaYVuelta.altoCajaVerticesPx === null
      ? null
      : arranque.altoCajaVerticesPx - idaYVuelta.altoCajaVerticesPx,
  avisosAlArrancar: arranque.tarjetasDeAvisos,
  avisosAlVolver: idaYVuelta.tarjetasDeAvisos,
  // La ATRIBUCIÓN: una tarjeta de aviso cuesta ~52 px, y este guion FABRICA
  // avisos a propósito (suelta un DXF en la rama que no toca, y cargar un
  // edificio dice qué archiva y qué no esta rama). Eso no es coste de F11.
  avisosQueEsteGuionHaProvocado: idaYVuelta.tarjetasDeAvisos - arranque.tarjetasDeAvisos,
  textosDeLosAvisos: textosDeAvisos().map((t) => t.slice(0, 120)),
  // En la rama EDIFICIO: cuánto le queda al estirador, que es la otra cifra.
  sitioDelEstiradorEnEdificioPx: enEdificio.altoListaPartesPx,
  bloqueOrigenEnEdificioPx: enEdificio.altoBloqueOrigenPx,
  cabeceraEnParcelaPx: arranque.altoCabeceraPx,
  cabeceraEnEdificioPx: enEdificio.altoCabeceraPx,
  cabeceraClavada:
    arranque.altoCabeceraPx === null || enEdificio.altoCabeceraPx === null
      ? null
      : Math.abs(arranque.altoCabeceraPx - enEdificio.altoCabeceraPx) < 1,
}

if (invariante.clavado === false && invariante.avisosQueEsteGuionHaProvocado === 0) {
  problemas.push(
    `La caja de vértices ha pasado de ${invariante.alArrancarPx} a ${invariante.alVolverPx} px con la ` +
      'ida y vuelta, y la lista de avisos no ha cambiado: la conmutación de rama le está costando ' +
      'píxeles al panel de parcela, y la fase 0 midió que volvía exacta a 267,44.',
  )
}
if (invariante.clavado === false && invariante.avisosQueEsteGuionHaProvocado > 0) {
  advertencias.push(
    `La caja de vértices ha pasado de ${invariante.alArrancarPx} a ${invariante.alVolverPx} px, y en el ` +
      `camino han entrado ${invariante.avisosQueEsteGuionHaProvocado} tarjeta(s) de aviso que este ` +
      'guion provoca a propósito (~52 px cada una). La pérdida se ATRIBUYE a los avisos, no a la ' +
      'conmutación: para medir el invariante limpio, `$B reload` y mira `arranque` contra la ' +
      // Deriva de la constante: escrito a mano decía «267» y se quedó viejo el
      // 2026-08-04 sin que nadie lo viera, tres líneas debajo del sitio donde el
      // número SÍ se actualizó. Dos copias de una cifra divergen siempre.
      `referencia de ${CAJA_VERTICES_REFERENCIA} px.`,
  )
}
if (invariante.cabeceraClavada === false) {
  problemas.push(
    `La cabecera del panel mide ${invariante.cabeceraEnParcelaPx} px en PARCELA y ` +
      `${invariante.cabeceraEnEdificioPx} px en EDIFICIO. Tiene que ser la misma en las dos: el ` +
      'conmutador es lo ÚNICO del panel que no se intercambia, y su coste medido es 0 px ' +
      '(117,13 → 117,13).',
  )
}

// ── 13 · El contrato K.1: ningún `data-*` repetido entre ramas ─────────────
//
// El corolario de T0.3·6 llevado a la aplicación ENTERA y no solo a `index.html`:
// con las dos ramas en el DOM, `querySelector` se queda con el de parcela aunque
// esté oculto, así que un nombre repetido deja a una de las dos ramas muda.

const contratoK1 = { colisiones: [], porAtributo: {} }
for (const atributo of ATRIBUTOS_K1) {
  const deParcela = new Set()
  const deEdificio = new Set()
  for (const seccion of $$('[data-rama-panel="PARCELA"]')) {
    for (const v of valoresDe(seccion, atributo)) deParcela.add(v)
  }
  for (const seccion of $$('[data-rama-panel="EDIFICIO"]')) {
    for (const v of valoresDe(seccion, atributo)) deEdificio.add(v)
  }
  for (const v of valoresDe(dialogoCapas, atributo)) deEdificio.add(v)
  const comunes = [...deEdificio].filter((v) => deParcela.has(v))
  contratoK1.porAtributo[atributo] = {
    parcela: [...deParcela].sort(),
    edificio: [...deEdificio].sort(),
    comunes,
  }
  for (const v of comunes) contratoK1.colisiones.push(`${atributo}="${v}"`)
}
if (contratoK1.colisiones.length > 0) {
  problemas.push(
    `Hay ${contratoK1.colisiones.length} \`data-*\` REPETIDOS entre las dos ramas: ` +
      JSON.stringify(contratoK1.colisiones) +
      '. Medido en T0.3·6: con las dos ramas en el DOM `querySelector` devuelve SIEMPRE el de parcela, ' +
      'también con su sección `hidden`, porque manda el orden del documento. El cableado de edificio ' +
      'leería y escribiría en un campo invisible de la otra rama, en silencio.',
  )
}

// ── 14 · Régimen de red y consola ──────────────────────────────────────────

const redAlTerminar = peticiones()
const red = {
  queEs:
    'Se clasifica por `wfsCP.aspx` / `wfsBU.aspx` y JAMÁS por `STOREDQUERIE_ID`, que lo usan LOS DOS ' +
    'endpoints del Catastro (medido en la fase 0): enrutar por ese parámetro manda las peticiones de ' +
    'parcela a la rama de edificio y deja la cuenta mintiendo en verde.',
  alArrancar: redAlArrancar,
  alTerminar: redAlTerminar,
  // ⭐ La cifra que tiene que ser 0: leer un dibujo no consulta nada.
  datosCatastroDuranteElGuion: redAlTerminar.datosCatastro - redAlArrancar.datosCatastro,
  // Publicada por separado y a propósito: cargar un edificio ENCUADRA el mapa
  // sobre sus huellas, y mover el mapa pide teselas. Eso no es leer el dibujo.
  cartografiaDuranteElGuion: redAlTerminar.cartografia - redAlArrancar.cartografia,
  fixturesQueEsteGuionSeHaTRAIDO: redAlTerminar.fixturesDelGuion - redAlArrancar.fixturesDelGuion,
}
if (red.datosCatastroDuranteElGuion > 0) {
  problemas.push(
    `Este guion ha disparado ${red.datosCatastroDuranteElGuion} petición(es) a los servicios de DATOS ` +
      'del Catastro (`wfsCP.aspx`/`wfsBU.aspx`) y su régimen es CERO: F11 se mide entera con ficheros ' +
      'locales, y la vía en vivo del `wfsBU` es del checklist humano §12 (override O8: una pasada, sin ' +
      'bucles).',
  )
}

// ── Veredicto ──────────────────────────────────────────────────────────────

window.removeEventListener('error', alError)
window.removeEventListener('unhandledrejection', alRechazo)
if (refcatParcelaAntes !== null) refcatParcelaAntes.removeEventListener('input', dispararSonda)

if (excepciones.length > 0) {
  problemas.push(`Excepciones no capturadas durante el recorrido: ${JSON.stringify(excepciones)}.`)
}
if (agotado()) {
  advertencias.push(`El guion ha tardado más de ${TOPE_TOTAL_MS} ms: alguna espera se ha ido de plazo.`)
}

noCubierto.push(
  'QUE LA HUELLA CAIGA DONDE ESTÁ EL EDIFICIO. Este guion mide que el `<path>` existe, que cuelga del ' +
    'pane 422, que está por encima de la parcela y que su caja cae dentro del lienzo. Comparar la ' +
    'huella con el TEJADO de la ortofoto —que es la comprobación entera que justifica pintarlas— pide ' +
    'ojos. Checklist humano §12.',
  'LA VÍA EN VIVO DEL `wfsBU` («Traer del Catastro» de la rama Edificio). Se puede medir, y este guion ' +
    'no la toca a propósito: F11 se cierra entera con ficheros locales y el override O8 pide una ' +
    'pasada sin bucles. Checklist §12, con su régimen de red.',
  'EL TOPE `--gml-partes-alto-max` A 768 px DE ALTO. Un tope en `vh` protege del contenido largo, no ' +
    'de la ventana corta: a 768 px son 7 filas y no 8. La cifra que este guion publica en ' +
    '`topeConPartes.derivadoA768` es DERIVADA; medirla pide `$B viewport 1440x768` y una segunda ' +
    'pasada (§19 del GUION).',
  'QUE UN GESTO DE RATÓN DE VERDAD MARQUE LA CASILLA DEL DIÁLOGO DE CAPAS. Aquí se asigna `.checked` ' +
    'y se despacha el `change` a mano (§0 del GUION); que el objetivo de pulsación de ~25 px del ' +
    'conmutador y el de la casilla sean cómodos es del §12.',
  'SI ALGÚN TEXTO DE LA RAMA SE LEE COMO UN VEREDICTO. Este guion publica textos, no los juzga (regla ' +
    'de oro 9). Punto BLOQUEANTE del checklist §12, que hereda el carácter del 8.1, el 9.4, el 10.5 y ' +
    'el 11.6.',
  'ABRIR EN UN CAD el DXF del que salen estas huellas, y cotejar sus capas contra las que el diálogo ' +
    'de reparto ha ofrecido. Es la otra mitad del §11.4.',
)

return {
  guion: '13-edificio',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto,
  arranque,
  conmutadorAncho,
  enEdificio,
  fichaEnEdificio,
  aspecto,
  repartoDeAltura,
  tope,
  topeConPartes,
  emergente,
  dxfEnParcela,
  dxfEnEdificio,
  capaHuellas,
  panes,
  reparto,
  advertenciaSinAutoguardado,
  idaYVuelta,
  invariante,
  contratoK1,
  red,
  estadoFinal: {
    queDeja:
      'La aplicación en la rama PARCELA, con un EDIFICIO cargado en el segundo store (7 partes de la ' +
      'capa `Construccion`), sus huellas pintadas en el mapa y el mapa encuadrado sobre ellas y no ' +
      'sobre la parcela de demostración. Además, las tarjetas de aviso que el propio guion provoca. ' +
      'Para volver al punto de partida: `$B reload`.',
    rama: app.getAttribute('data-rama'),
    huellasEnElMapa: huellas().length,
    partesEnElStore: filasDePartes().length,
    tarjetasDeAvisos: tarjetasDeAvisos(),
    altoCajaVerticesPx: altoCajaVertices(),
  },
}
