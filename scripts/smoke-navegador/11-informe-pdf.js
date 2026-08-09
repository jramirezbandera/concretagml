// scripts/smoke-navegador/11-informe-pdf.js — F09 · Tarea T6.2.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// EL INFORME DE CONTRASTE FIRMABLE EN PDF (F09) en un navegador de verdad, y
// **solo lo que ahí se puede medir**. La suite ya cubre el escritor de PDF
// (test/report/pdf.test.js, con snapshot de bytes), la maqueta
// (test/report/pdf-parcela.test.js), el encuadre y el troceado
// (test/report/encuadre.test.js), el literal (test/report/literal.test.js), la
// firma (test/report/firma.test.js), el diálogo
// (test/app/dialogo-informe.dom.test.js) y el cableado
// (test/app/informe.dom.test.js); **aquí no se vuelve a medir nada de eso**. Se
// miden las siete cosas que jsdom no puede dar:
//
//   1. ⭐ **EL CRITERIO DE ACEPTACIÓN 1, Y ESTE GUION ES EL ÚNICO SITIO DONDE SE
//      PUEDE MEDIR.** «El canvas compuesto exporta con `toDataURL` sin
//      `SecurityError`». En jsdom **no hay contexto 2D** —el paquete `canvas` no
//      está instalado ni se va a instalar—, así que allí no hay lienzo que
//      contaminar ni `toDataURL` que llamar: el plan de F09 lo declaró como
//      desviación 1 y lo trasladó aquí por escrito. Lo que la suite sí prueba, y
//      es el fallo REAL, es que `crossOrigin` se asigna **antes** que `src`
//      (`test/report/canvas.dom.test.js`, con un `Image` falso que registra el
//      ORDEN). Aquí se cierra el hueco con **una tesela REAL del WMS del
//      Catastro** y con lo que convierte una comprobación en una PRUEBA:
//
//        · **el caso positivo** — imagen con `crossOrigin='anonymous'` puesto
//          ANTES de `src`, dibujada en un lienzo, `toDataURL('image/jpeg')` que
//          **no lanza** y devuelve un JPEG de verdad; y
//        · **el CONTROL NEGATIVO** — la MISMA cartografía, cargada **sin**
//          `crossOrigin`, que tiene que dejar el lienzo contaminado y hacer que
//          `toDataURL` **LANCE**.
//
//      ⚠️ **Si el control negativo NO falla, la prueba no está probando nada**, y
//      eso se cuenta como PROBLEMA, no como éxito: significaría que el navegador
//      no está aplicando la política de origen (una extensión, una bandera, un
//      proxy que reescribe cabeceras) y que el caso positivo saldría verde
//      igualmente con el código roto. Es la misma doctrina que el `04`, que exige
//      `coincidePorIdentidad` en vez de `toContain`.
//
//      ⚠️ **Y las dos cargas usan URLs DISTINTAS** (un BBOX desplazado un metro).
//      No es aseo: la caché HTTP del navegador guarda la respuesta y una segunda
//      carga del MISMO recurso puede reutilizarla, con lo que el resultado del
//      control dependería del orden de las dos y de qué guardó el disco. Con dos
//      URLs distintas cada carga es una respuesta suya y el experimento es
//      reproducible.
//
//      Hechos ya MEDIDOS (T0.1, 2026-08-02) que este guion NO vuelve a
//      descubrir y sobre los que se apoya: el WMS del Catastro **sirve
//      `EPSG:25830`**, emite `Access-Control-Allow-Origin: *`, devuelve JPEG de
//      **3 componentes** y respeta el tamaño pedido **hasta 4000 px por eje**.
//   2. **Que el PDF baje y sean BYTES DE VERDAD.** Misma cadena
//      `Blob → createObjectURL → <a download> → click() → revoke` que miden `06`
//      (el GML) y `10` (el informe de texto), con el mismo patrón de captura
//      (GUION.md §12) y la misma promesa: los tres envoltorios se restauran en un
//      `finally` y el veredicto lo DECLARA. Lo que se afirma de los bytes es de
//      **nivel de byte**: que empiezan por `%PDF`, cuántas páginas declara el
//      árbol (`/Type /Pages /Count N`) y si lleva dentro el plano como imagen
//      `/DCTDecode` — que es, de rebote, **la prueba de extremo a extremo del
//      criterio 1**: sin `toDataURL` no hay JPEG que empotrar.
//   3. **Que pulsar «Componer PDF» NO CIERRE NADA POR DEBAJO.** Es la TERCERA
//      aparición de la misma familia de defectos en este proyecto, y por eso se
//      mide en vez de suponerse:
//        · F08 — el `click()` del `<a download>` burbujeaba hasta `document`, el
//          guardián de clic-fuera del cajón de diagnóstico lo veía como un clic
//          FUERA y **cerraba el cajón**; el acuse de recibo se escribía en un
//          `role="status"` que acababa de quedar en `display:none`
//          (`gml/descargar.js`, `stopPropagation` en CAPTURA).
//        · F09 · T5.1 — lo mismo con los clics **dentro del `<dialog>`**, que
//          cuelga del `<body>` y por tanto está FUERA del cajón: componer el PDF
//          cerraba el cajón por debajo del modal, y el usuario no lo veía hasta
//          cerrar el diálogo (`viewer/cajon-diagnostico.js#enDialogo`).
//      Se mide con las dos teclas del gesto: **`Escape` sobre el diálogo** y **el
//      clic de «Componer PDF»**. Tras los dos, el cajón sigue abierto y el
//      contraste sigue **pintado en el mapa** (`<path>` en el pane `diagnostico`).
//   4. **Que el diálogo quepa en la ventana y no la desborde.** Es un modal
//      centrado: **tapa el mapa a propósito** y por eso el solape se publica como
//      NÚMERO y no como falta (regla de oro 9) — igual que `09` publica el
//      porcentaje de lienzo que tapa el cajón. Lo que sí es defecto, y se caza, es
//      que se salga de la ventana (parte del formulario inalcanzable) o que
//      obligue a la página a hacer scroll horizontal.
//   5. **EL INVARIANTE HEREDADO: la caja de vértices sigue en ~267 px.** Cuarta
//      fase seguida (F06 la dejó en 303, F07 en 267 con su CTA, F08 en 267 con
//      «Abrir un GML…», y F09 dijo «coste 0 px en el panel» porque su interfaz es
//      un modal). Se mide al arrancar y **en el tick en que el diálogo se abre**;
//      medir «un rato luego» es lo que hizo fallar a la primera versión del
//      guardián de F07, que acusó al cajón de 11 px que eran de otros renglones
//      hablando después.
//      ⚠️ **Y aquí ese mismo error tiene un gemelo simétrico, que la PRIMERA
//      corrida de este guion pisó**: medir demasiado PRONTO, con algo todavía en
//      vuelo. Pulsar «Diagnosticar encaje» pide las colindantes, y cuando llegan
//      —~300 ms después, incluso saliendo de IndexedDB— el renglón de F05 crece a
//      dos líneas y **la caja pasa de 267 a 234 px**. No es de F09 y no es un
//      defecto (es la regla de oro 1 funcionando), pero estaba SIN MEDIR hasta
//      ahora. Así que este guion hace las dos cosas: **espera a que el panel se
//      asiente** ({@link asentarPanel}) y **atribuye** la pérdida al bloque que la
//      causó, para no volver a acusar al inocente.
//   6. **La tipografía de los botones NUEVOS**, derivando la expectativa del token
//      `--font-sans` leído del `:root` y **no de un literal copiado**. Es el
//      defecto que destapó el guion `10` en su primera corrida: un `font:'inherit'`
//      en línea gana a la hoja y deja la regla de `estilos/app.css` escrita, puesta
//      y muerta — y en jsdom **no hay cascada que lo delate**. Entran «Preparar
//      informe (PDF)» (que `10` ya vigila) y los TRES del diálogo, que nacieron
//      después.
//   7. **Que el `<dialog>` se comporte como un modal DE VERDAD.** Lo que jsdom no
//      tiene, MEDIDO (jsdom 29.1.1): `HTMLDialogElement.prototype` expone
//      **exactamente una** cosa, la propiedad reflejada `open` — no hay
//      `showModal()`, ni `close()`, ni capa superior, ni `::backdrop`, ni atrape de
//      foco, ni `inert`. `app/dialogo-informe.js` detecta la capacidad y cae al
//      atributo `open` para poder probarse en la suite, así que **la mitad que de
//      verdad se usa en producción solo se ejercita aquí**: `:modal` (capa
//      superior), el foco dentro al abrir, el fondo INERTE (un `.focus()` sobre un
//      control de detrás no se lo lleva) y `Escape`.
//
// ── QUÉ **NO** PUEDE MEDIR — LÉELO ANTES DE CITAR ESTE GUION ────────────────
//
//   · **NO abre el PDF.** Afirma sobre sus BYTES —cabecera, páginas declaradas,
//     imagen `/DCTDecode`, tamaño—, que es todo lo que un guion puede ver. Este
//     PDF está escrito **a mano, byte a byte, sin librería**: que Acrobat, el
//     visor de Chrome y un lector ligero lo abran los tres es del checklist humano
//     §10.1, y **uno que abre en un solo lector no está escrito, está de suerte**.
//   · **NO juzga el plano.** Puede decir que llegó cartografía y a qué tamaño; no
//     puede decir si el plano se LEE: si la escala gráfica es legible, si las
//     cotas se pisan, si el norte se ve. Checklist §10.2.
//   · **NO decide si alguna frase del informe se lee como un veredicto.** Publica
//     números y textos (regla de oro 9). Ese juicio es el punto BLOQUEANTE del
//     checklist §10.5, que hereda el carácter del 8.1 y del 9.4, y con mención
//     expresa a la **presunción de vía pública**: el único sitio de toda la
//     aplicación donde se PROPONE en vez de medir.
//   · **NO es un gesto de ratón** (§0 del GUION): los clics son `el.click()` y
//     `Escape` es un `KeyboardEvent` despachado a mano. `/browse` no tiene comando
//     `drag` y el dominio CDP `Input` no está en su allowlist.
//   · **NO prueba el troceado del plano** (criterio 3). A 180 mm y 300 ppp son
//     2126 px, por debajo del techo de 4000 px del WMS: la ruta normal es **una
//     sola `GetMap`** y forzar una geometría que no quepa costaría varias
//     peticiones de ~200 kB. Lo cubre `test/report/encuadre.test.js`.
//   · **NO mide la consola completa.** Cuenta las excepciones no capturadas y los
//     rechazos de promesa **que ocurran mientras corre**; el buffer entero es de
//     `$B console --errors` (§6).
//   · **NO fija las cifras del Catastro.** Contra los servicios VIVOS los datos
//     pueden cambiar: se exige la FORMA y las cifras se publican.
//
// ── RÉGIMEN DE RED: DECLARADO, Y MÁS BARATO QUE EL DE `09` ──────────────────
// UNA pasada, SIN bucles, y **el informe se compone UNA sola vez**. Seis
// peticiones como mucho, de dos clases muy distintas:
//
//   DATOS del Catastro (los que manda el override O8 — denegación ~10 días):
//     · **GetNeighbourParcel** — 1, al abrir el cajón de diagnóstico (0 si otro
//       gesto ya trajo las vecinas en esta página).
//     · **Consulta_DNPRC** — 1, al pulsar «Preparar informe (PDF)». Es el +1 de
//       presupuesto que F09 declaró en su plan, y va **solo para la parcela
//       propia**: pedirlo también para las cuatro colindantes serían 5 peticiones
//       por informe.
//   ⚠️ **NO se pulsa «Traer del Catastro»**, a diferencia de `09`: la parcela de
//   demostración **ya trae `geometriaOficial`** (es el estado de una parcela recién
//   traída), así que el CTA nace encendido y el GetParcel no hace falta. Lo único
//   que se pierde es la superficie catastral DECLARADA en la tabla a tres bandas
//   —que es de F07 y la mide `09`—, y a cambio este guion cuesta **una petición de
//   datos menos**.
//
//   CARTOGRAFÍA (WMS, sin cuota conocida, pero pesa):
//     · **2 `GetMap` PEQUEÑAS** (512×384, ~30 kB cada una) para el experimento del
//       criterio 1: una con CORS y otra sin él, con URLs distintas.
//     · **1 `GetMap` GRANDE** (2126×1535, ~200-270 kB) — el plano del informe, a
//       300 ppp. **Una, y solo una**: por eso el informe se compone una vez.
//
// Todas se cuentan por Resource Timing y salen en `red`. Léete `GUION.md` §13
// antes de lanzarlo.
//
// ── ⚠️ ESTE GUION NECESITA `npm run dev`, NO `vite preview` ─────────────────
// Lo dice el §16 y aquí vale igual, aunque por otro motivo: `vite preview` sirve
// `dist/`, y este guion **no** trae fixtures por `fetch` pero sí se apoya en que la
// aplicación esté servida bajo el `base` de Pages (`/concretagml/`) con los módulos
// sin empaquetar, que es donde se han medido todas las cifras de referencia de la
// carpeta. Si algún día se repite sobre el build, hay que remedir §17.
//
// ── CÓMO SE LANZA ───────────────────────────────────────────────────────────
// Página recién cargada (el guion lo comprueba), `$B eval` desde la raíz:
//
//   $B viewport 1440x900
//   $B goto http://localhost:PUERTO/concretagml/     # ⚠️ el base, no la raíz
//   $B wait ".gml-tabla-vertices"
//   $B console --clear
//   $B network --clear
//   $B eval scripts/smoke-navegador/11-informe-pdf.js
//   $B console --errors                              # → (no console errors)
//   $B network | grep -E "ServidorWMS|Consulta_DNPRC|GetNeighbour"
//   $B screenshot .gstack/smoke-f09.png              # la evidencia para el §10
//
// ⚠️ **Orden y estado final.** El guion deja **el cajón de diagnóstico abierto con
// el contraste pintado** y el diálogo CERRADO (lo cierra el propio cableado al
// bajar el PDF), a propósito: la captura tiene que enseñar que componer no se
// llevó nada por delante. Lo DECLARA en `estadoFinal`. No lo encadenes antes de
// `02` (le contamina la cuenta de `GetMap` con las tres peticiones de este guion)
// ni de `06` (contrasta el `areaValue` contra el dataset de arranque). Para
// repetirlo: `$B reload && $B wait ".gml-tabla-vertices"`.
//
// ⚠️ NO envuelvas este fichero en una IIFE: `browse` ya lo envuelve ÉL en
// `(async()=>{ … })()` — por eso los `await` y el `return` de nivel superior son
// legales. Con una IIFE propia, el `eval` devuelve una promesa que nadie espera y
// **el veredicto se pierde EN SILENCIO** mientras los efectos (clics, peticiones,
// la descarga) sí ocurren. Consecuencia normal y esperada: `node --check` sobre
// este fichero falla con «Illegal return statement».

const t0 = performance.now()
const TOPE_TOTAL_MS = 120000
const agotado = () => performance.now() - t0 > TOPE_TOTAL_MS

const problemas = []
const advertencias = []

// El búfer de Resource Timing nace en 250 entradas y las teselas del visor lo
// llenan: desbordado, la cuenta de peticiones saldría corta SIN síntoma (la misma
// trampa que declaran `07`, `09` y `10`). Se amplía ANTES de contar nada.
if (performance.getEntriesByType('resource').length >= 250) {
  advertencias.push(
    'El búfer de Resource Timing ya estaba lleno al empezar: la cuenta de peticiones puede quedarse ' +
      'corta. Repite con la página recién cargada.',
  )
}
performance.setResourceTimingBufferSize(2000)

// Excepciones no capturadas DURANTE el recorrido. No sustituye a
// `$B console --errors` (que ve el buffer entero de la sesión): añade la mitad que
// ese comando no puede atribuir, que es «esto reventó por lo que hizo ESTE guion».
// Se retiran al final, sin falta: un oyente vivo en `window` sobrevive al guion y
// contaminaría lo que venga detrás.
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
const visible = (el) => el !== null && el !== undefined && getComputedStyle(el).display !== 'none'

/** «1.535,87 m²» → 1535.87. Devuelve null si no hay número que leer. */
const leerNumero = (t) => {
  if (!t) return null
  const m = /-?[\d.]+(?:,\d+)?/.exec(t.replace('−', '-'))
  return m === null ? null : Number(m[0].replace(/\./g, '').replace(',', '.'))
}

/** Rectángulo entero de un elemento o selector, o `null`. Serializable. */
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
async function esperar(condicion, ms, etiqueta, paso = 120) {
  const limite = performance.now() + ms
  while (performance.now() < limite) {
    if (condicion()) return true
    await new Promise((r) => setTimeout(r, paso))
  }
  advertencias.push(`Plazo agotado (${ms} ms) esperando: ${etiqueta}.`)
  return false
}

/** Alto de la caja de vértices: la cifra que este guion HEREDA de 08 §10, 09 §5 y 10 §5. */
const altoCajaVertices = () => {
  const caja = $('#tabla-vertices')
  return caja === null ? null : Math.round(caja.getBoundingClientRect().height)
}
const tarjetasDeAvisos = () => $$('#avisos .gml-aviso').length
const filasDeTabla = () => $$('#tabla-vertices tr[data-recinto="0"][data-indice]').length

/**
 * Peticiones vistas por Resource Timing, por servicio. Las dos primeras son las
 * de DATOS que manda el override O8; `wms` es cartografía y se cuenta aparte
 * porque su presupuesto es de PESO, no de cuota.
 */
const peticiones = () => {
  const entradas = performance.getEntriesByType('resource').map((e) => e.name)
  return {
    getNeighbour: entradas.filter((u) => u.includes('GetNeighbourParcel')).length,
    dnprc: entradas.filter((u) => /Consulta_DNPRC/i.test(u)).length,
    wms: entradas.filter((u) => u.includes('ServidorWMS.aspx')).length,
  }
}

/** El `<path>` que F07 pinta en el pane `diagnostico`: la prueba de que el contraste sigue vivo. */
const paneDiagnostico = () =>
  document.querySelector('.leaflet-diagnostico-pane, .leaflet-pane[class*="diagnostico"]')
const trazosDelContraste = () => {
  const pane = paneDiagnostico()
  return pane === null ? null : pane.querySelectorAll('path').length
}

/** Alto del bloque «Origen de la parcela», que es de F05 y de F08 — no de F09. */
const altoBloqueOrigen = () => {
  const bloque = $('.gml-bloque--catastro')
  return bloque === null ? null : Math.round(bloque.getBoundingClientRect().height)
}

/**
 * Espera a que el PANEL deje de moverse: dos lecturas seguidas con el mismo alto.
 *
 * ⚠️ **Esta función existe por un falso positivo MEDIDO, y es la misma lección que
 * F07 ya pagó.** La primera corrida de este guion salió roja acusando al diálogo de
 * 33 px que no eran suyos: pulsar «Diagnosticar encaje» pide las colindantes, y
 * cuando llegan —~300 ms después, incluso saliendo de IndexedDB, porque la lectura
 * es asíncrona igual— el renglón `[data-estado="cargar-catastro"]` **de F05**
 * escribe «El Catastro ha devuelto 4 colindantes…», crece a dos líneas y le quita
 * 33 px a la caja de vértices. Medir «justo después del clic» y comparar «justo
 * después de abrir el diálogo» metía ese renglón dentro de la ventana de medida y
 * se lo cargaba a F09.
 *
 * La cabecera de `09` ya avisaba con todas las letras: «nada de medir un rato
 * luego» — pero el error simétrico es medir DEMASIADO PRONTO, con algo todavía en
 * vuelo. Se espera a que el panel se asiente, y **además** se atribuye la pérdida
 * (ver `invariante`): las dos cosas, porque una sola no basta.
 */
async function asentarPanel(ms = 3000) {
  const limite = performance.now() + ms
  let anterior = altoCajaVertices()
  while (performance.now() < limite) {
    await new Promise((r) => setTimeout(r, 250))
    const ahora = altoCajaVertices()
    if (ahora === anterior) return true
    anterior = ahora
  }
  advertencias.push(`El panel seguía moviéndose tras ${ms} ms: la medida del invariante puede llevar ruido.`)
  return false
}

/** `Escape` de verdad, sobre el elemento que tenga el foco (que es como llega en el navegador). */
function pulsarEscape() {
  const diana = document.activeElement || document.body
  diana.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }),
  )
}

// ── 1 · Página recién cargada y F09 montada ─────────────────────────────────

const cajonDiag = $('.gml-cajon-diagnostico')
const ctaDiag = $('[data-accion="diagnosticar"]')
const renglonCta = $('[data-estado="diagnosticar"]')
const botonPreparar = $('[data-accion="preparar-informe"]')
const renglonInforme = $('[data-estado="informe-contraste"]')

if (cajonDiag === null || ctaDiag === null || renglonCta === null) {
  window.removeEventListener('error', alError)
  window.removeEventListener('unhandledrejection', alRechazo)
  return {
    guion: '11-informe-pdf',
    ok: false,
    problemas: [
      'Falta el CTA `[data-accion="diagnosticar"]`, su renglón o el cajón ' +
        '`.gml-cajon-diagnostico`: F09 empieza DONDE TERMINA F07 (el informe dice exactamente lo ' +
        'que dice el cajón del que salió), así que sin F07 montada este guion no puede medir nada.',
    ],
  }
}
if (botonPreparar === null || renglonInforme === null) {
  window.removeEventListener('error', alError)
  window.removeEventListener('unhandledrejection', alRechazo)
  return {
    guion: '11-informe-pdf',
    ok: false,
    problemas: [
      'Falta «Preparar informe (PDF)» (`[data-accion="preparar-informe"]`) o su renglón ' +
        '(`[data-estado="informe-contraste"]`) en el pie del cajón de diagnóstico: F09 no está ' +
        'montada en esta página. Los fabrica `viewer/cajon-diagnostico.js`; `index.html` no se toca.',
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

const arranque = {
  paginaRecienCargada,
  filas: filasDeTabla(),
  superficieFicha: superficieArranque,
  refcatFicha: texto('[data-ficha="refcat"]'),
  ctaDiagnosticoHabilitado: !ctaDiag.disabled,
  cajonDiagnosticoCerrado: !visible(cajonDiag),
  // Los dos botones del pie del cajón nacen APAGADOS y con el motivo escrito en el
  // mismo paso (regla de oro 1): sin diagnóstico enseñándose no hay informe que
  // preparar. Un botón gris y mudo no se distingue de uno roto.
  prepararHabilitado: !botonPreparar.disabled,
  motivoInforme: renglonInforme.textContent.trim(),
  etiquetaPreparar: botonPreparar.textContent.trim(),
  // Herencia de 08 §10, 09 §5 y 10 §5, medida en el MISMO estado (avisos vacíos).
  altoCajaVerticesPx: altoCajaVertices(),
  tarjetasDeAvisos: tarjetasDeAvisos(),
  // La Decisión 3 de F09 («coste 0 px en el panel — cuarta fase seguida»),
  // comprobada por ESTRUCTURA: la interfaz de F09 es un modal y dos botones dentro
  // del cajón, o sea que en el `<aside>` no puede haber aparecido ningún bloque.
  bloqueInformeEnElPanel: $('aside .gml-bloque--informe, aside [data-bloque="informe"]') !== null,
  dialogoEnElDomAlArrancar: $('.gml-dialogo-informe') !== null,
}
// El guardián de la caja de vértices, calcado de `09` y `10` y por el mismo
// motivo: caza un BLOQUE de los de 150-270 px entrando en el panel, no los píxeles
// de un renglón. Referencia MEDIDA con F08 montada: 267,4375 px.
if (arranque.tarjetasDeAvisos === 0 && arranque.altoCajaVerticesPx !== null && arranque.altoCajaVerticesPx < 220) {
  problemas.push(
    `La caja de vértices arranca en ${arranque.altoCajaVerticesPx} px con la lista de avisos vacía ` +
      '(referencia medida: ~267 px, los mismos que dejaron F07 y F08): algo del tamaño de un BLOQUE ' +
      'ha entrado en el panel, y la Decisión 3 de F09 era que su interfaz —un modal— costara 0 px.',
  )
}
if (arranque.bloqueInformeEnElPanel) {
  problemas.push(
    'Ha aparecido un bloque de informe en el panel izquierdo: F09 decidió a propósito que su ' +
      'interfaz fuera un `<dialog>` y dos botones dentro del cajón, para no volver a comerle altura ' +
      'a la tabla de vértices (cuarta fase seguida).',
  )
}
if (!arranque.dialogoEnElDomAlArrancar) {
  problemas.push(
    'El `<dialog>` de «Preparar informe» no está en el DOM al arrancar: `app/dialogo-informe.js` lo ' +
      'fabrica y lo cuelga del `<body>` al construirse, no al abrirlo. Si se creara al vuelo, el ' +
      '`nodo()` del cableado lanzaría al arrancar y el renglón nacería mudo.',
  )
}
if (arranque.prepararHabilitado) {
  problemas.push(
    'El botón «Preparar informe (PDF)» nace ENCENDIDO, sin ningún diagnóstico enseñándose: el ' +
      'informe dice exactamente lo que dice el cajón del que sale, y sin cajón no hay nada que decir.',
  )
}
if (!arranque.prepararHabilitado && arranque.motivoInforme === '') {
  problemas.push(
    'Los dos botones del informe nacen apagados y MUDOS: la regla de oro 1 exige que el motivo se ' +
      'escriba en el mismo paso en que se apagan. Un botón gris y sin explicación no se distingue de ' +
      'uno roto.',
  )
}
if (!arranque.cajonDiagnosticoCerrado) {
  problemas.push('El cajón de diagnóstico está abierto antes de pulsar nada.')
}

// ── 2 · ⭐ EL CRITERIO 1, con su CONTROL NEGATIVO ───────────────────────────
//
// Lo primero del guion, y a propósito: es la razón de ser del fichero y no debe
// depender de que el resto del recorrido llegue vivo hasta aquí. Se hace con dos
// teselas PEQUEÑAS (512×384) porque lo que se mide es la política de origen, que
// no sabe de tamaños; la grande —2126×1535, a 300 ppp— la pide luego la
// aplicación de verdad, una sola vez.

/**
 * El encuadre del experimento, DERIVADO de lo que hay en pantalla y no copiado:
 * la caja de las coordenadas de la tabla de vértices, que están en **EPSG:25830**
 * (UTM huso 30, X=Este, Y=Norte) porque es el SRS del expediente. Si algún día la
 * parcela de arranque cambiara, este guion seguiría pidiendo cartografía de donde
 * está la parcela, que es lo único que importa para que el WMS conteste con
 * píxeles y no con un `ServiceExceptionReport`.
 */
function bboxDeLaTablaUtm() {
  const filas = $$('#tabla-vertices tr[data-recinto="0"][data-indice]').map((tr) => [
    Number((tr.querySelector('input[data-eje="x"]') || {}).value?.replace(',', '.')),
    Number((tr.querySelector('input[data-eje="y"]') || {}).value?.replace(',', '.')),
  ])
  const buenas = filas.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  if (buenas.length < 3) return null
  const xs = buenas.map((p) => p[0])
  const ys = buenas.map((p) => p[1])
  return {
    minX: Math.min(...xs) - 20,
    minY: Math.min(...ys) - 20,
    maxX: Math.max(...xs) + 20,
    maxY: Math.max(...ys) + 20,
  }
}

/**
 * La URL de un `GetMap`, con la MISMA forma que `viewer/wms-catastro.js#getMapUrl`
 * —copia deliberada, como la de los cuatro literales legales en `04`: si divergen,
 * este guion debe fallar—. `SRS=` y no `CRS=` porque el módulo emite **WMS 1.1.1**
 * a propósito (esquiva la trampa del orden de ejes de 1.3.0, donde en 25830 el
 * northing va primero).
 */
const CATASTRO_WMS = 'https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx'
const CAPAS_WMS = ['catastro', 'constru', 'masa', 'subparce', 'textos', 'limites']
function urlGetMap(bbox, ancho, alto) {
  const c = (v) => String(Number(v.toFixed(3)))
  return (
    `${CATASTRO_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&SRS=EPSG:25830` +
    `&BBOX=${[bbox.minX, bbox.minY, bbox.maxX, bbox.maxY].map(c).join(',')}` +
    `&WIDTH=${ancho}&HEIGHT=${alto}&FORMAT=image/jpeg&TRANSPARENT=FALSE` +
    `&LAYERS=${CAPAS_WMS.join(',')}&STYLES=`
  )
}

/**
 * Espera a que una imagen cargue y devuelve lo MEDIDO, sin lanzar nunca.
 *
 * ⚠️ **El `crossOrigin` no se pone aquí**, y es a propósito: el orden que manda
 * MDN —y el único que surte efecto— es `crossOrigin` **antes** de `src`, así que
 * cada llamante lo asigna él, delante de sus ojos, justo antes de fijar la URL. Al
 * revés la petición ya salió sin la cabecera `Origin`, el navegador no la
 * reintenta, y la única señal es el `SecurityError` de `toDataURL`, al final del
 * todo. Es exactamente el fallo que la suite prueba con un `Image` falso que
 * registra el ORDEN.
 */
function esperarCarga(img) {
  return new Promise((resolver) => {
    const t = performance.now()
    let hecho = false
    const acabar = (estado) => {
      if (hecho) return
      hecho = true
      resolver({
        estado,
        ancho: img.naturalWidth,
        alto: img.naturalHeight,
        ms: redondear(performance.now() - t, 0),
      })
    }
    img.onload = () => acabar('cargada')
    img.onerror = () => acabar('error')
    setTimeout(() => acabar('plazo-agotado'), 25000)
  })
}

/** Dibuja la imagen en un lienzo nuevo e intenta exportarlo. Devuelve QUÉ pasó. */
function exportarLienzoCon(img, ancho, alto) {
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (ctx === null) return { contexto2d: false, lanzo: null, error: null, dataUrl: null }
  ctx.drawImage(img, 0, 0)
  try {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    return {
      contexto2d: true,
      lanzo: false,
      error: null,
      // La SEGUNDA sustitución silenciosa que documenta `report/canvas.js`:
      // `toDataURL` cae a PNG sin avisar si el tipo no está soportado. Se comprueba
      // el prefijo, no se supone.
      esJpeg: dataUrl.startsWith('data:image/jpeg;base64,'),
      prefijo: dataUrl.slice(0, 30),
      longitud: dataUrl.length,
    }
  } catch (error) {
    return {
      contexto2d: true,
      lanzo: true,
      nombreError: error.name,
      error: `${error.name}: ${error.message}`,
      esJpeg: null,
      prefijo: null,
      longitud: null,
    }
  }
}

const ANCHO_SONDA = 512
const ALTO_SONDA = 384
const bboxUtm = bboxDeLaTablaUtm()
const criterio1 = {
  queEs:
    'Criterio de aceptación 1 de F09: el canvas compuesto exporta con `toDataURL` sin ' +
    '`SecurityError`. NO se puede medir en jsdom (no hay contexto 2D); este guion es el único ' +
    'sitio del proyecto donde se mide, y por eso lleva CONTROL NEGATIVO.',
  srs: 'EPSG:25830',
  bboxUtm,
  tamanoPedido: { ancho: ANCHO_SONDA, alto: ALTO_SONDA },
}

if (bboxUtm === null) {
  problemas.push(
    'No se ha podido derivar un BBOX en EPSG:25830 de la tabla de vértices: sin encuadre no hay ' +
      'tesela real que pedirle al WMS, y el criterio 1 se queda SIN MEDIR en la única corrida que ' +
      'puede medirlo.',
  )
} else {
  // Las DOS urls son distintas a propósito (el BBOX del control va desplazado un
  // metro): con la misma, la caché HTTP podría servir la segunda carga desde disco
  // y el resultado dependería del orden. Ver la cabecera.
  const urlPositiva = urlGetMap(bboxUtm, ANCHO_SONDA, ALTO_SONDA)
  const bboxControl = {
    minX: bboxUtm.minX + 1,
    minY: bboxUtm.minY + 1,
    maxX: bboxUtm.maxX + 1,
    maxY: bboxUtm.maxY + 1,
  }
  const urlNegativa = urlGetMap(bboxControl, ANCHO_SONDA, ALTO_SONDA)

  // ── Caso POSITIVO: con `crossOrigin='anonymous'` ANTES de `src` ────────────
  const imgPositiva = new Image()
  const esperaPositiva = esperarCarga(imgPositiva)
  imgPositiva.crossOrigin = 'anonymous'
  imgPositiva.src = urlPositiva
  const cargaPositiva = await esperaPositiva

  criterio1.conCors = {
    url: urlPositiva,
    carga: cargaPositiva,
    // El techo silencioso del WMS, medido el 2026-08-02: pasarse de 4000 px por eje
    // no RECORTA, SUSTITUYE (pedidos 4200×100 y 5000×100, devolvió 4000×2000 las dos
    // veces, con HTTP 200 y sin una palabra). Aquí se pide muy por debajo, pero la
    // comprobación va igual: es la que `report/canvas.js` hace en producción y la
    // que evita un plano con toda la geometría descolocada.
    tamanoCoincideConLoPedido: cargaPositiva.ancho === ANCHO_SONDA && cargaPositiva.alto === ALTO_SONDA,
  }
  if (cargaPositiva.estado !== 'cargada') {
    problemas.push(
      `La tesela del WMS del Catastro con CORS no ha cargado (${cargaPositiva.estado}): sin ella el ` +
        'criterio 1 no se puede medir. Ojo con la trampa del §6: el WMS devuelve sus errores como ' +
        '`ServiceExceptionReport` en `text/xml` **con HTTP 200**, y lo que lo delata es el `onerror` ' +
        'del `<img>` por fallo de decodificación, que es justo lo que se acaba de ver.',
    )
  } else {
    criterio1.conCors.exportacion = exportarLienzoCon(imgPositiva, ANCHO_SONDA, ALTO_SONDA)
    if (criterio1.conCors.exportacion.contexto2d === false) {
      problemas.push('El lienzo no da contexto 2D en este navegador: el criterio 1 no se puede medir aquí.')
    } else if (criterio1.conCors.exportacion.lanzo) {
      problemas.push(
        `⭐ CRITERIO 1 ROTO: \`toDataURL\` ha LANZADO sobre el lienzo con una tesela real del WMS ` +
          `cargada con \`crossOrigin='anonymous'\`: ${criterio1.conCors.exportacion.error}. La ` +
          'Receta A del informe (plano a 300 ppp compuesto a mano) es INVIABLE tal como está: o el ' +
          'servicio ha dejado de emitir `Access-Control-Allow-Origin: *`, o `crossOrigin` se está ' +
          'asignando DESPUÉS de `src` en algún punto de carga.',
      )
    } else if (criterio1.conCors.exportacion.esJpeg === false) {
      problemas.push(
        `\`toDataURL('image/jpeg')\` no ha devuelto un JPEG sino ` +
          `${JSON.stringify(criterio1.conCors.exportacion.prefijo)}: es la caída SILENCIOSA a PNG ` +
          'que documenta `report/canvas.js`, y el PDF llevaría dentro bytes que dice que son JPEG.',
      )
    }
  }

  // ── CONTROL NEGATIVO: la misma cartografía, SIN `crossOrigin` ──────────────
  // Si esto NO falla, el caso positivo no demuestra nada.
  const imgNegativa = new Image()
  const esperaNegativa = esperarCarga(imgNegativa)
  // ⛔ A PROPÓSITO: ni una línea de `crossOrigin`. Es el control.
  imgNegativa.src = urlNegativa
  const cargaNegativa = await esperaNegativa

  criterio1.controlNegativo = {
    queEs:
      'La MISMA cartografía cargada SIN `crossOrigin`. Tiene que dejar el lienzo CONTAMINADO y hacer ' +
      'que `toDataURL` LANCE. Si no lanza, la prueba de arriba no está probando nada.',
    url: urlNegativa,
    carga: cargaNegativa,
  }
  if (cargaNegativa.estado !== 'cargada') {
    advertencias.push(
      `La tesela del control negativo no ha cargado (${cargaNegativa.estado}): el control se queda ` +
        'sin ejercitar y el caso positivo, sin contraste. No tumba el guion, pero la corrida no ' +
        'demuestra el criterio 1 con la fuerza que debería.',
    )
  } else {
    criterio1.controlNegativo.exportacion = exportarLienzoCon(imgNegativa, ANCHO_SONDA, ALTO_SONDA)
    const lanzo = criterio1.controlNegativo.exportacion.lanzo
    criterio1.controlNegativo.contaminaComoDebe = lanzo === true
    criterio1.controlNegativo.esSecurityError =
      criterio1.controlNegativo.exportacion.nombreError === 'SecurityError'
    if (lanzo === false) {
      problemas.push(
        '⚠️ EL CONTROL NEGATIVO NO HA FALLADO: `toDataURL` ha exportado un lienzo en el que se ' +
          'dibujó una imagen de otro origen cargada SIN `crossOrigin`, y eso tenía que lanzar ' +
          '`SecurityError`. Con la política de origen desactivada (una extensión, una bandera de ' +
          'arranque, un proxy que reescribe cabeceras), el caso positivo de arriba saldría verde ' +
          'aunque `crossOrigin` no se estuviera asignando: **esta corrida NO demuestra el ' +
          'criterio 1**. Repite en un navegador limpio.',
      )
    } else if (lanzo === true && !criterio1.controlNegativo.esSecurityError) {
      advertencias.push(
        `El control negativo ha lanzado ${JSON.stringify(criterio1.controlNegativo.exportacion.error)} ` +
          'en vez de un `SecurityError`: contamina, que es lo que se quería ver, pero con otro ' +
          'nombre del que documenta la especificación.',
      )
    }
  }

  criterio1.conclusion =
    criterio1.conCors?.exportacion?.lanzo === false && criterio1.controlNegativo?.contaminaComoDebe === true
      ? 'CRITERIO 1 DEMOSTRADO: con CORS exporta, sin CORS lanza. La Receta A es viable en este navegador.'
      : 'CRITERIO 1 NO DEMOSTRADO en esta corrida: mira `problemas` y `advertencias`.'
}

// ── 3 · El diagnóstico, que es de donde sale el informe ─────────────────────
//
// F09 no recalcula nada: `app/cableado-informe.js` recibe el `ultimoDiagnostico()`
// del cajón, o sea **el mismo objeto que el cajón está enseñando**. Así que el
// informe no puede existir sin este paso, y por eso está aquí y no es opcional.

const antesDeDiagnosticar = peticiones()
const mapaEl = document.getElementById('mapa')
const mapaAntes = { ancho: mapaEl.clientWidth, alto: mapaEl.clientHeight }

ctaDiag.click()
const abrioElCajon = await esperar(() => visible(cajonDiag), 20000, 'que el cajón de diagnóstico se abra')

// ⚠️ EL CAJÓN SE ABRE EN EL MISMO TICK DEL CLIC, pero las colindantes tardan. Dos
// cosas dependen de esperar aquí, y las dos salieron mal en las primeras corridas:
//
//   · **La cuenta de peticiones.** Resource Timing solo apunta un recurso cuando
//     TERMINA, así que contar en cuanto el cajón es visible daba `getNeighbour: 0`
//     incluso en una pasada en FRÍO con la base borrada — un cero que se leía como
//     «no se pidió nada» cuando lo que pasaba es que todavía estaba en vuelo. Un
//     contador que dice cero por llegar pronto es peor que no tenerlo.
//   · **El invariante de la caja de vértices.** El renglón de F05 crece a dos
//     líneas cuando llegan, y esos 33 px acababan imputados al diálogo de F09.
//     Ver {@link asentarPanel}.
const panelAsentado = await asentarPanel()
const trasDiagnosticar = peticiones()

const diagnostico = {
  cajonAbierto: visible(cajonDiag),
  rect: rect(cajonDiag),
  mapaIntacto: mapaEl.clientWidth === mapaAntes.ancho && mapaEl.clientHeight === mapaAntes.alto,
  titular: texto('[data-diag="titular"]'),
  trazosDelContraste: trazosDelContraste(),
  panelAsentado,
  peticionesGetNeighbour: trasDiagnosticar.getNeighbour - antesDeDiagnosticar.getNeighbour,
  renglonDeColindantes: texto('[data-estado="cargar-catastro"]'),
  // Aquí es donde F09 se engancha a F07: los dos botones del pie se encienden con
  // el MISMO gate que pinta el cajón.
  prepararHabilitado: !botonPreparar.disabled,
  motivoInforme: renglonInforme.textContent.trim(),
}
if (!abrioElCajon) {
  problemas.push('Pulsar «Diagnosticar encaje» no ha abierto el cajón: sin diagnóstico no hay informe que preparar.')
}
if (diagnostico.trazosDelContraste === 0) {
  problemas.push(
    'El cajón se ha abierto pero el pane `diagnostico` no tiene ni un `<path>`: el contraste no se ' +
      'ha pintado en el mapa, y es lo que este guion va a comprobar que sigue vivo después de ' +
      'componer el PDF.',
  )
}
if (diagnostico.peticionesGetNeighbour === 0 && /colindantes/i.test(diagnostico.renglonDeColindantes || '')) {
  advertencias.push(
    'Las parcelas colindantes han salido de la caché de IndexedDB: esta pasada no mide el WFS ni su ' +
      'CORS. Para una pasada en FRÍO, borra la base antes de recargar (ver «Cómo se lanza» en el ' +
      '§17 del GUION).',
  )
}
if (!diagnostico.prepararHabilitado) {
  problemas.push(
    `Con el cajón de diagnóstico abierto y pintado, «Preparar informe (PDF)» sigue apagado ` +
      `(motivo: ${JSON.stringify(diagnostico.motivoInforme)}). F09 se enciende con el MISMO gate que ` +
      'el informe de texto de F08: hay diagnóstico enseñándose, o no hay informe que preparar.',
  )
}

// ── 4 · «Preparar informe (PDF)»: el DNPRC y el diálogo ─────────────────────

// El panel ya se asentó al final del §3: la referencia del invariante se toma con
// las colindantes de F05 dentro y su renglón ya crecido.
const antesDePreparar = peticiones()
const cajaAntesDelDialogo = altoCajaVertices()
const bloqueOrigenAntes = altoBloqueOrigen()
const tarjetasAntesDelDialogo = tarjetasDeAvisos()
const focoAntesDeAbrir =
  document.activeElement === null ? null : document.activeElement.tagName.toLowerCase()

botonPreparar.click()
// El renglón se escribe ANTES del primer `await` del cableado (MENSAJE_PREPARANDO):
// entre pulsar y ver el diálogo hay una petición al Catastro, y un botón que se
// queda pensando sin decirlo es un error silencioso. Se lee en el acto.
const renglonMientrasPrepara = renglonInforme.textContent.trim()

const dialogoEl = $('.gml-dialogo-informe')
const abrioElDialogo = await esperar(
  () => dialogoEl !== null && dialogoEl.open === true,
  25000,
  'que el diálogo «Preparar informe» se abra (¿contesta el Catastro?)',
)
// EL INVARIANTE, en el MISMO TICK de la apertura: aquí no hay renglón que
// descontar —el diálogo vive fuera del panel— así que cualquier pérdida es del
// diálogo, salvo que el recorrido haya producido una tarjeta de aviso.
const cajaTrasAbrirDialogo = altoCajaVertices()
const bloqueOrigenDespues = altoBloqueOrigen()
const tarjetasTrasAbrirDialogo = tarjetasDeAvisos()
const trasPreparar = peticiones()

// La pérdida se ATRIBUYE, no se acusa a bulto. Dos dueños posibles, y ninguno es
// F09: una tarjeta de avisos nueva, y el bloque «Origen de la parcela» —que es de
// F05 y de F08— creciendo porque alguno de sus renglones ha hablado.
const crecioElBloqueOrigen =
  bloqueOrigenAntes === null || bloqueOrigenDespues === null
    ? 0
    : Math.max(0, bloqueOrigenDespues - bloqueOrigenAntes)
const invariante = {
  queEs:
    'La caja de vértices, cuarta fase seguida (F06: 303 px · F07: 267 con su CTA · F08: 267 con ' +
    '«Abrir un GML…» · F09 prometió 0 px porque su interfaz es un modal).',
  alArrancarPx: arranque.altoCajaVerticesPx,
  panelAsentadoAntesDeMedir: panelAsentado,
  antesDelDialogoPx: cajaAntesDelDialogo,
  enElTickDeLaAperturaPx: cajaTrasAbrirDialogo,
  tarjetasAntes: tarjetasAntesDelDialogo,
  tarjetasDespues: tarjetasTrasAbrirDialogo,
  // Lo que YA le costó al panel pedir el diagnóstico, antes de que F09 tocara
  // nada. No es un defecto y no lo juzga este guion: es una cifra que hasta ahora
  // no estaba medida y que la primera corrida sacó a la luz (ver §17).
  costeDeLasColindantesPx:
    arranque.altoCajaVerticesPx === null || cajaAntesDelDialogo === null
      ? null
      : arranque.altoCajaVerticesPx - cajaAntesDelDialogo,
  renglonDeColindantes: texto('[data-estado="cargar-catastro"]'),
  bloqueOrigenAntesPx: bloqueOrigenAntes,
  bloqueOrigenDespuesPx: bloqueOrigenDespues,
  crecioElBloqueOrigenPx: crecioElBloqueOrigen,
}
invariante.perdidaImputableAlDialogoPx =
  cajaAntesDelDialogo === null || cajaTrasAbrirDialogo === null
    ? null
    : Math.max(0, cajaAntesDelDialogo - cajaTrasAbrirDialogo - crecioElBloqueOrigen)
invariante.abrirNoRoboAltura =
  invariante.perdidaImputableAlDialogoPx !== null &&
  (invariante.perdidaImputableAlDialogoPx <= 2 || tarjetasTrasAbrirDialogo > tarjetasAntesDelDialogo)
if (!invariante.abrirNoRoboAltura) {
  problemas.push(
    `Abrir el diálogo le ha quitado ${invariante.perdidaImputableAlDialogoPx} px a la caja de ` +
      `vértices que NO se explican por nada más (${cajaAntesDelDialogo} → ${cajaTrasAbrirDialogo} px ` +
      `en el tick de la apertura, con las mismas ${tarjetasTrasAbrirDialogo} tarjetas de aviso y con ` +
      `el bloque «Origen de la parcela» creciendo ${crecioElBloqueOrigen} px). El diálogo cuelga del ` +
      '`<body>` y el panel no tenía que enterarse: la Decisión 3 de F09 era coste 0 px.',
  )
}

if (dialogoEl === null) {
  problemas.push(
    'No hay ningún `.gml-dialogo-informe` en el documento después de pulsar «Preparar informe ' +
      '(PDF)»: sin diálogo no hay nada más que medir en este guion.',
  )
}

const preparacion = {
  renglonMientrasPrepara,
  abrio: abrioElDialogo,
  peticionesDnprc: trasPreparar.dnprc - antesDePreparar.dnprc,
  renglonDelCajonTrasAbrir: renglonInforme.textContent.trim(),
  // El cajón NO se cierra al abrir el diálogo: el informe se prepara SOBRE el
  // diagnóstico que se está enseñando y cerrarlo sería quitar de en medio lo que se
  // está describiendo.
  cajonSigueAbierto: visible(cajonDiag),
}
if (preparacion.abrio && preparacion.peticionesDnprc === 0) {
  advertencias.push(
    'El diálogo se ha abierto SIN gastar ninguna consulta al DNPRC: los descriptivos han salido de ' +
      'la caché de IndexedDB de una corrida anterior. La pasada es válida para todo lo demás, pero ' +
      '**no mide el servicio descriptivo ni su CORS**. Para una pasada en FRÍO, borra la base antes ' +
      'de recargar (ver «Cómo se lanza» en el §17 del GUION).',
  )
}
if (preparacion.renglonMientrasPrepara === '') {
  advertencias.push(
    'El renglón del informe no ha dicho nada entre pulsar y abrir el diálogo. Si la respuesta del ' +
      'Catastro llegó en el mismo tick pudo pasarse por alto; con el servicio lento, un botón mudo ' +
      'durante segundos es un error silencioso (regla de oro 1).',
  )
}
if (!preparacion.cajonSigueAbierto) {
  problemas.push(
    'Abrir el diálogo ha cerrado el cajón de diagnóstico: el informe describe lo que el cajón está ' +
      'enseñando, y quitarlo de en medio es exactamente el defecto que T5.1 corrigió con `enDialogo`.',
  )
}

// ── 5 · Que el `<dialog>` sea un MODAL DE VERDAD ────────────────────────────
//
// Lo que jsdom no tiene, MEDIDO: su `HTMLDialogElement.prototype` expone
// exactamente `['constructor', 'open']`. Ni `showModal`, ni capa superior, ni
// `::backdrop`, ni `inert`. `app/dialogo-informe.js` detecta la capacidad y cae al
// atributo `open` para poder probarse en la suite, así que la mitad que de verdad
// se usa en producción SOLO se ejercita aquí.

const modal = { medido: false }
if (dialogoEl !== null && dialogoEl.open) {
  modal.medido = true
  modal.tieneShowModal = typeof dialogoEl.showModal === 'function'
  // `:modal` es LA pregunta: solo casa si el diálogo está en la CAPA SUPERIOR, o
  // sea si se abrió con `showModal()` y no con el atributo `open` de respaldo.
  try {
    modal.enLaCapaSuperior = dialogoEl.matches(':modal')
  } catch (error) {
    modal.enLaCapaSuperior = null
    advertencias.push(`Este navegador no entiende el selector \`:modal\` (${error.name}): la capa superior no se ha medido.`)
  }
  modal.ariaModal = dialogoEl.getAttribute('aria-modal')
  modal.tieneAriaLabelledby = dialogoEl.getAttribute('aria-labelledby') !== null
  // El velo. Solo lo pinta el navegador con `showModal()`; con la vía de respaldo no
  // hay velo y no pasa nada — pero entonces tampoco hay modal.
  const backdrop = getComputedStyle(dialogoEl, '::backdrop')
  modal.backdrop = backdrop === null ? null : backdrop.backgroundColor
  modal.focoDentroAlAbrir =
    document.activeElement !== null && dialogoEl.contains(document.activeElement)
  modal.focoAntesDeAbrir = focoAntesDeAbrir
  modal.elementoEnfocado =
    document.activeElement === null
      ? null
      : `${document.activeElement.tagName.toLowerCase()}${
          document.activeElement.dataset && document.activeElement.dataset.informe
            ? `[data-informe="${document.activeElement.dataset.informe}"]`
            : ''
        }`

  // EL ATRAPE DE FOCO, medido por su consecuencia y no por su implementación: con
  // el diálogo en la capa superior, TODO lo de detrás queda inerte, así que un
  // `.focus()` sobre un control del panel **no se lleva el foco**. `dialogo-informe.js`
  // declara expresamente que NO reimplementa el atrape («en el navegador lo da la
  // capa superior gratis»), o sea que esto mide justo lo que aquel módulo delegó.
  // ⛔ **EL CONTROL SONDEADO TIENE QUE ESTAR VISIBLE, Y EL DE ANTES NO LO
  // ESTABA.** Aquí ponía `[data-campo="refcat"] || [data-accion="generar-gml"]`:
  // el primero vive en la sección de Entrada y el segundo en la de Edición, y con
  // el informe abierto se está en Diagnóstico, donde `app/pantalla.js` los tiene
  // OCULTOS. Un elemento oculto no acepta el foco **por estar oculto**, así que
  // esta medida daba «fondo inerte» pasara lo que pasara — y con el veredicto en
  // el sentido de F09 eso salía verde y confirmaba un modal que no existía.
  //
  // El botón del rail es el sondeo correcto por dos razones: se ve en las tres
  // pantallas, y es EXACTAMENTE lo que la rebanada 5 quería que siguiera
  // alcanzable cuando eligió `show()` en vez de `showModal()`.
  const controlDeDetras =
    $('.gml-rail-pasos button:not([disabled])') || $('[data-conmutador="rama"] button')
  if (controlDeDetras !== null) {
    const focoPrevio = document.activeElement
    controlDeDetras.focus()
    modal.fondoInerte = document.activeElement !== controlDeDetras
    modal.controlDeDetrasProbado =
      controlDeDetras.dataset.campo || controlDeDetras.dataset.accion || controlDeDetras.tagName
    if (!modal.fondoInerte && focoPrevio !== null && typeof focoPrevio.focus === 'function') {
      // Si el fondo NO era inerte se acaba de mover el foco fuera del diálogo: se
      // devuelve donde estaba para no falsear lo que venga después.
      focoPrevio.focus()
    }
  }

  // ── ⛔ ESTE VEREDICTO ESTUVO AL REVÉS DESDE EL 2026-08-05, Y NADIE VOLVIÓ ──
  //
  // Se escribió en F09, cuando el informe era un MODAL: exigía capa superior,
  // foco dentro y fondo inerte, y las tres cosas las daba `showModal()`.
  //
  // La rebanada 5 del rework convirtió el informe en una PANTALLA COMPLETA y lo
  // hizo a propósito con `show()` y no con `showModal()` —un modal deja inerte el
  // rail, o sea la navegación, y convertiría el informe en una ratonera de la que
  // solo se sale por Escape—. Este guion no se actualizó, así que llevaba desde
  // entonces acusando a la aplicación de hacer justo lo que se le pidió que
  // hiciera. Es el mismo modo de fallo que el `03-arrastre.js` sin guarda de paso.
  //
  // ⭐ 2026-08-08 · Hoy la presentación es INCONDICIONAL —el informe ya no depende
  // de ningún peldaño— así que el veredicto se puede escribir sin ambigüedad y en
  // el sentido bueno: **NO puede ser modal**, y lo de detrás **tiene que seguir
  // alcanzable**. La afirmación es más fuerte que la anterior, no más débil.
  if (modal.enLaCapaSuperior === true) {
    problemas.push(
      'El informe está en la CAPA SUPERIOR (`:modal` casa): se ha abierto con `showModal()`. Se ' +
        'presenta a pantalla completa a propósito y con `show()`, porque un modal deja inerte todo ' +
        'lo de detrás — y detrás está el RAIL. Con `showModal()` el informe se convierte en una ' +
        'ratonera de la que solo se sale por Escape.',
    )
  }
  if (modal.ariaModal !== 'false') {
    problemas.push(
      `El informe declara \`aria-modal="${modal.ariaModal}"\` y no lo es: lo de detrás sigue en ` +
        'juego. Un lector de pantalla que se crea ese atributo deja de anunciar el rail, que es la ' +
        'única salida.',
    )
  }
  if (!modal.focoDentroAlAbrir) {
    problemas.push(
      `Al abrir el informe el foco se ha quedado fuera (${JSON.stringify(modal.elementoEnfocado)}): ` +
        'quien navegue con teclado tiene que tabular a ciegas por la aplicación de detrás hasta ' +
        'llegar al formulario que se le acaba de abrir.',
    )
  }
  if (modal.fondoInerte === true) {
    problemas.push(
      `Con el informe abierto, un \`.focus()\` sobre «${modal.controlDeDetrasProbado}» del panel NO ` +
        'se lleva el foco: el fondo está INERTE. Eso es lo que hace `showModal()`, y es justo lo ' +
        'que la rebanada 5 evitó: con el fondo inerte el rail no se puede pulsar y el informe pasa ' +
        'a ser una pantalla sin salida.',
    )
  }
}

// ── 6 · El diálogo cabe en la ventana (y tapa el mapa a propósito) ──────────
//
// Es un MODAL centrado: que tape el mapa no es un defecto, es lo que es. El solape
// se publica como número (regla de oro 9), igual que `09` publica el porcentaje de
// lienzo que tapa el cajón. Lo que sí es defecto es que se salga de la ventana o
// que haga scrollar la página en horizontal.

const encaje = { medido: false }
if (dialogoEl !== null && dialogoEl.open) {
  const rDialogo = rect(dialogoEl)
  const rMapa = rect(mapaEl)
  const cuerpoDialogo = dialogoEl.querySelector('.gml-dialogo-informe-cuerpo')
  encaje.medido = true
  encaje.rect = rDialogo
  encaje.ventana = { ancho: window.innerWidth, alto: window.innerHeight }
  encaje.dentroDeLaVentana =
    rDialogo !== null &&
    rDialogo.x >= -1 &&
    rDialogo.y >= -1 &&
    rDialogo.derecha <= window.innerWidth + 1 &&
    rDialogo.abajo <= window.innerHeight + 1
  encaje.solapeConElMapaPx2 = solape(rDialogo, rMapa)
  encaje.porcentajeDelLienzo =
    rDialogo === null || rMapa === null || rMapa.w * rMapa.h === 0
      ? null
      : redondear((solape(rDialogo, rMapa) / (rMapa.w * rMapa.h)) * 100, 1)
  encaje.nota =
    'Un modal centrado TAPA el mapa a propósito (Decisión 3 de F09: esto no anota la cartografía, ' +
    'prepara un documento). El número se publica sin juicio; lo que se vigila es que no desborde.'
  // El formulario es largo: el diálogo tiene `max-height` y `overflow-y:auto` para
  // que quepa. Si el contenido cabe sin scroll, mejor; si no cabe, tiene que poder
  // scrollarse DENTRO (y no arrastrar a la página).
  encaje.contenido = {
    scrollHeight: dialogoEl.scrollHeight,
    clientHeight: dialogoEl.clientHeight,
    desbordaYSeScrollea: dialogoEl.scrollHeight > dialogoEl.clientHeight,
    overflowY: getComputedStyle(dialogoEl).overflowY,
    // `overscroll-behavior: contain` NO es adorno: debajo hay un mapa y una rueda
    // que se escapara del final del formulario haría zoom sobre la parcela.
    overscrollBehavior: getComputedStyle(dialogoEl).overscrollBehavior,
    cuerpoEncontrado: cuerpoDialogo !== null,
  }
  encaje.paginaSinScrollHorizontal =
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  if (!encaje.dentroDeLaVentana) {
    problemas.push(
      `El diálogo se sale de la ventana (${JSON.stringify(rDialogo)} en ${window.innerWidth}×` +
        `${window.innerHeight}): parte del formulario que hay que rellenar antes de firmar queda ` +
        'inalcanzable.',
    )
  }
  if (!encaje.paginaSinScrollHorizontal) {
    problemas.push(
      `Con el diálogo abierto la página desborda en horizontal ` +
        `(scrollWidth ${document.documentElement.scrollWidth} > clientWidth ` +
        `${document.documentElement.clientWidth}).`,
    )
  }
  if (encaje.contenido.desbordaYSeScrollea && !/(auto|scroll)/.test(encaje.contenido.overflowY)) {
    problemas.push(
      `El contenido del diálogo no cabe (${dialogoEl.scrollHeight} > ${dialogoEl.clientHeight} px) y ` +
        `su \`overflow-y\` es ${JSON.stringify(encaje.contenido.overflowY)}: lo que sobre no se puede ` +
        'alcanzar de ninguna manera.',
    )
  }
  if (!encaje.contenido.cuerpoEncontrado) {
    advertencias.push(
      'No se ha encontrado `.gml-dialogo-informe-cuerpo` dentro del diálogo: `estilos/app.css` ' +
        'reparte el interior desde ese `<div>` a propósito (un `display` sobre el `<dialog>` mataría ' +
        'su ocultación nativa).',
    )
  }
}

// ── 7 · La tipografía de los botones NUEVOS, derivada del token ─────────────
//
// La expectativa sale de `--font-sans` leído del `:root`, no de un literal
// copiado: si el token cambia, el guion sigue midiendo lo que hay que medir. Es la
// medida que destapó el defecto 1 de `10` —una regla escrita, puesta y muerta— y
// sigue siendo la única que lo vería volver: en jsdom no hay cascada.

const fontSans = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
const familiaEsperada = (fontSans.split(',')[0] || '').trim().replace(/^["']|["']$/g, '')
const botonesNuevos = [
  ['preparar-informe', botonPreparar],
  ['componer-pdf', dialogoEl === null ? null : dialogoEl.querySelector('[data-accion="componer-pdf"]')],
  ['cancelar-informe', dialogoEl === null ? null : dialogoEl.querySelector('[data-accion="cancelar-informe"]')],
  ['regenerar-lindero', dialogoEl === null ? null : dialogoEl.querySelector('[data-accion="regenerar-lindero"]')],
]
const tipografia = {
  tokenFontSans: fontSans,
  familiaEsperada,
  botones: {},
  todosConLaFamiliaDeLaApp: true,
}
for (const [nombre, el] of botonesNuevos) {
  if (el === null) {
    tipografia.botones[nombre] = null
    advertencias.push(`No se ha encontrado el botón «${nombre}»: su tipografía no se ha medido.`)
    continue
  }
  const calculada = getComputedStyle(el).fontFamily
  const cuadra = familiaEsperada !== '' && calculada.includes(familiaEsperada)
  tipografia.botones[nombre] = {
    fontFamily: calculada,
    // El estilo EN LÍNEA es la causa del defecto de F08, así que se publica: un
    // `font`/`font-family` en el atributo `style` gana a la hoja siempre.
    styleEnLinea: el.getAttribute('style'),
    cuadra,
  }
  if (!cuadra) {
    tipografia.todosConLaFamiliaDeLaApp = false
    problemas.push(
      `El botón «${nombre}» se pinta en ${JSON.stringify(calculada)} y no con la familia de la ` +
        `aplicación (${JSON.stringify(familiaEsperada)}, de \`--font-sans\`). Es el defecto que ` +
        'destapó el guion `10` en F08: `font-family` NO se hereda en los controles de formulario, y ' +
        'un `font:inherit` en línea gana a la hoja y deja la regla de `estilos/app.css` escrita, ' +
        'puesta y muerta. En jsdom no hay cascada que lo delate.',
    )
  }
}

// ── 8 · `Escape`: cierra el diálogo y NADA MÁS ──────────────────────────────
//
// Primera de las dos teclas del defecto 3. `Escape` es LA tecla de cerrar un
// modal, así que sin la guarda `enDialogo` de `viewer/cajon-diagnostico.js`
// cancelar este diálogo cerraría además el cajón de debajo: dos cierres por una
// tecla, y el segundo sin que nadie lo hubiera pedido.

const escape = { medido: false }
if (dialogoEl !== null && dialogoEl.open) {
  escape.medido = true
  escape.cajonAntes = visible(cajonDiag)
  escape.trazosAntes = trazosDelContraste()
  pulsarEscape()
  await esperar(() => dialogoEl.open === false, 3000, 'que `Escape` cierre el diálogo')
  escape.dialogoCerrado = dialogoEl.open === false
  escape.cajonSigueAbierto = visible(cajonDiag)
  escape.trazosDespues = trazosDelContraste()
  escape.contrasteSiguePintado = escape.trazosDespues !== null && escape.trazosDespues > 0
  if (!escape.dialogoCerrado) {
    problemas.push(
      '`Escape` no ha cerrado el diálogo. `app/dialogo-informe.js` lo implementa con un `keydown` ' +
        'propio porque el evento `cancel` no existe en jsdom; en el navegador las dos vías se solapan ' +
        'y `cerrar` es idempotente a propósito.',
    )
  }
  if (!escape.cajonSigueAbierto) {
    problemas.push(
      '⚠️ `Escape` ha cerrado el diálogo Y el cajón de diagnóstico de debajo: dos cierres por una ' +
        'tecla. Es el defecto que `viewer/cajon-diagnostico.js#_cerrarPorEscape` corrigió con la ' +
        'guarda `enDialogo`, y acaba de volver.',
    )
  }
  if (escape.contrasteSiguePintado === false) {
    problemas.push(
      'Tras `Escape` el pane `diagnostico` se ha quedado sin `<path>`: cerrar el diálogo ha borrado ' +
        'el contraste del mapa.',
    )
  }
}

// ── 9 · Reabrir: cero peticiones (los descriptivos están cacheados) ─────────

const reapertura = { medido: false }
if (dialogoEl !== null && !dialogoEl.open && !botonPreparar.disabled) {
  const antesDeReabrir = peticiones()
  reapertura.medido = true
  botonPreparar.click()
  reapertura.abrio = await esperar(() => dialogoEl.open === true, 20000, 'reabrir el diálogo')
  const trasReabrir = peticiones()
  reapertura.peticionesDnprc = trasReabrir.dnprc - antesDeReabrir.dnprc
  if (reapertura.peticionesDnprc > 0) {
    problemas.push(
      `Reabrir el diálogo ha gastado ${reapertura.peticionesDnprc} petición(es) al DNPRC: ` +
        '`app/cableado-informe.js` cachea los descriptivos POR EXPEDIENTE precisamente para que ' +
        'preparar el informe dos veces cueste una consulta, no dos. El presupuesto de red de F09 es +1.',
    )
  }
}

// ── 10 · La PRESUNCIÓN DE VÍA PÚBLICA: el único sitio donde se PROPONE ──────
//
// `report/literal.js` tiene UNA excepción a la regla de oro 9: en parcela urbana
// con colindantes consultados, un frente que ninguna parcela alcanza se describe
// «presumiblemente con vía pública … dato NO verificado». Quien va a firmar tiene
// que enterarse, y por eso «Componer PDF» nace APAGADO mientras haya una presunción
// sin repasar. Aquí se mide el mecanismo; si la frase se lee como un veredicto es
// el punto BLOQUEANTE del checklist §10.5.

const presuncion = { medido: false }
const bloquePresuncion = dialogoEl === null ? null : dialogoEl.querySelector('[data-informe="presuncion"]')
const acuse = dialogoEl === null ? null : dialogoEl.querySelector('[data-informe="acuse-presuncion"]')
const botonComponer = dialogoEl === null ? null : dialogoEl.querySelector('[data-accion="componer-pdf"]')
const renglonDialogo = dialogoEl === null ? null : dialogoEl.querySelector('[data-estado="dialogo-informe"]')

if (dialogoEl !== null && dialogoEl.open && bloquePresuncion !== null && botonComponer !== null) {
  presuncion.medido = true
  presuncion.bloqueVisible = !bloquePresuncion.hidden
  presuncion.tramos = $$('[data-informe="presuncion-tramos"] li').map((li) => li.textContent.trim())
  presuncion.componerHabilitadoAntes = !botonComponer.disabled
  presuncion.renglonAntes = renglonDialogo === null ? null : renglonDialogo.textContent.trim()
  if (presuncion.bloqueVisible) {
    // Regla de oro 1: el botón apagado nunca está mudo. El motivo se escribe en el
    // mismo paso, y se comprueba que lo diga —no que exista un renglón.
    presuncion.motivoEscrito = /casilla/i.test(presuncion.renglonAntes || '')
    if (presuncion.componerHabilitadoAntes) {
      problemas.push(
        'Hay una presunción de vía pública en el borrador y «Componer PDF» está ENCENDIDO sin haber ' +
          'marcado el acuse: la advertencia se puede leer en diagonal, que es exactamente lo que el ' +
          'acuse existe para impedir. Es el único sitio de la aplicación donde se PROPONE en vez de ' +
          'medir.',
      )
    }
    if (!presuncion.motivoEscrito) {
      problemas.push(
        `«Componer PDF» está apagado por la presunción y el renglón del diálogo no lo dice ` +
          `(${JSON.stringify(presuncion.renglonAntes)}): un botón gris y mudo no se distingue de uno ` +
          'roto (regla de oro 1).',
      )
    }
    if (acuse !== null) {
      // Se marca CON UN CLIC, que es como lo marca una persona: `checked = true` a
      // pelo no dispara `change` y el gate no se enteraría.
      acuse.click()
      await new Promise((r) => setTimeout(r, 80))
      presuncion.acuseMarcado = acuse.checked === true
      presuncion.componerHabilitadoDespues = !botonComponer.disabled
      if (!presuncion.componerHabilitadoDespues) {
        problemas.push(
          'Marcar el acuse de la presunción no ha encendido «Componer PDF»: el gate se ha quedado ' +
            'cerrado y no hay forma de llegar al PDF.',
        )
      }
    }
  } else {
    presuncion.nota =
      'Este borrador no propone ninguna vía pública, así que el gate del acuse no se ha ejercitado. ' +
      'Depende de la parcela y de las colindantes que hayan llegado: no es un fallo, es que no había ' +
      'nada que presumir. Lo cubre `test/app/dialogo-informe.dom.test.js`.'
  }
}

// El texto del literal, publicado para el §10.5 del checklist: el juicio sobre si
// alguna frase se lee como un veredicto NO lo hace este guion (regla de oro 9).
const literalEl = dialogoEl === null ? null : dialogoEl.querySelector('[data-informe="literal"]')
const borrador = {
  queEs:
    'El borrador del lindero, tal cual lo redactó `report/literal.js`. Se publica ENTERO para que ' +
    'el §10.5 del checklist se pueda leer en voz alta. Este guion NO juzga cómo se lee.',
  caracteres: literalEl === null ? null : literalEl.value.length,
  primerParrafo:
    literalEl === null ? null : (literalEl.value.split('\n').find((l) => l.trim() !== '') || '').trim(),
  mencionaPresuncion: literalEl === null ? null : /presumiblemente/i.test(literalEl.value),
  texto: literalEl === null ? null : literalEl.value,
}

// ── 11 · ⭐ «Componer PDF»: los BYTES, y que no se cierre nada por debajo ────
//
// Mismo patrón de captura que `06` y `10` (GUION.md §12) y con la misma promesa:
// los tres envoltorios se restauran en un `finally` y el veredicto lo DECLARA. La
// diferencia con `10` es que aquí la composición es ASÍNCRONA —hay una `GetMap` de
// 200 kB de por medio—, así que los envoltorios tienen que seguir puestos mientras
// se espera, y se restauran después.

const informe = { medido: false }
if (dialogoEl !== null && dialogoEl.open && botonComponer !== null && !botonComponer.disabled) {
  informe.medido = true
  const antesDeComponer = peticiones()
  const cajonAntesDeComponer = visible(cajonDiag)
  const trazosAntesDeComponer = trazosDelContraste()

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

  const tComponer = performance.now()
  let excepcionAlComponer = null
  let renglonMientrasCompone = null
  try {
    botonComponer.click()
    // El renglón se escribe ANTES del primer `await` del cableado
    // (MENSAJE_COMPONIENDO): es la espera LARGA del recorrido y una espera muda se
    // interpreta como que la aplicación se ha colgado.
    renglonMientrasCompone = renglonDialogo === null ? null : renglonDialogo.textContent.trim()
    await esperar(() => blobs.length > 0, 60000, 'que el PDF se componga y baje (¿contesta el WMS?)', 150)
    // Un respiro para que el `finally` del cableado revoque y cierre.
    await new Promise((r) => setTimeout(r, 400))
  } catch (error) {
    excepcionAlComponer = `${error.name}: ${error.message}`
  } finally {
    URL.createObjectURL = crearUrlOriginal
    URL.revokeObjectURL = revocarUrlOriginal
    if (teniaCreateElementPropio) document.createElement = crearElementoOriginal
    else delete document.createElement
  }
  const msComponer = redondear(performance.now() - tComponer, 0)

  const restaurado =
    URL.createObjectURL === crearUrlOriginal &&
    URL.revokeObjectURL === revocarUrlOriginal &&
    document.createElement === crearElementoOriginal
  const ancla = anclas.find((a) => typeof a.download === 'string' && a.download.length > 0) || null

  // Los BYTES. `arrayBuffer()` y no `text()`: un PDF es binario y decodificarlo
  // como texto destruye justo lo que hay que mirar. Se lee del Blob capturado, que
  // sobrevive a la revocación de su URL.
  let bytes = null
  if (blobs.length > 0) bytes = new Uint8Array(await blobs[0].arrayBuffer())
  // Latin-1 y no UTF-8: los bytes del PDF NO son texto y `TextDecoder('utf-8')`
  // sustituiría los que no son válidos por U+FFFD, con lo que buscar `/DCTDecode`
  // podría fallar por culpa del decodificador. `latin1` es biyectivo byte↔carácter.
  const comoTexto = bytes === null ? null : new TextDecoder('latin1').decode(bytes)
  const cabecera = bytes === null ? null : comoTexto.slice(0, 8)
  const paginas = comoTexto === null ? null : /\/Type\s*\/Pages\s*\/Count\s+(\d+)/.exec(comoTexto)

  informe.captura = {
    restaurado,
    blobsCapturados: blobs.length,
    revocaLaQueCreo:
      hrefsCreados.length === hrefsRevocados.length && hrefsCreados.every((h, i) => h === hrefsRevocados[i]),
    nombreDelAncla: ancla === null ? null : ancla.download,
    anclaFueraDelDom: ancla === null ? null : !document.body.contains(ancla),
  }
  informe.excepcionAlComponer = excepcionAlComponer
  informe.renglonMientrasCompone = renglonMientrasCompone
  informe.msComponer = msComponer
  informe.peticionesWms = peticiones().wms - antesDeComponer.wms
  informe.bytes = bytes === null ? null : bytes.length
  informe.tipoDelBlob = blobs.length > 0 ? blobs[0].type : null
  informe.cabecera = cabecera
  informe.empiezaPorPDF = cabecera !== null && cabecera.startsWith('%PDF')
  informe.termina = comoTexto === null ? null : comoTexto.slice(-8).replace(/\s+/g, ' ').trim()
  informe.tieneEOF = comoTexto === null ? null : /%%EOF\s*$/.test(comoTexto)
  informe.paginasDeclaradas = paginas === null ? null : Number(paginas[1])
  // ⭐ La prueba de EXTREMO A EXTREMO del criterio 1: el plano solo entra en el PDF
  // como imagen `/DCTDecode`, y esos bytes salen de `toDataURL` sobre el lienzo
  // compuesto. Si están, `toDataURL` no lanzó DENTRO DE LA APLICACIÓN DE VERDAD.
  informe.llevaPlanoJpeg = comoTexto === null ? null : comoTexto.includes('/DCTDecode')
  informe.imagenesEmpotradas = comoTexto === null ? null : (comoTexto.match(/\/Subtype\s*\/Image/g) || []).length
  informe.nombreDelFichero = informe.captura.nombreDelAncla
  informe.renglonDelCajonTrasBajar = renglonInforme.textContent.trim()

  // La mitad de este apartado que solo se puede ver aquí: ¿se ha llevado por
  // delante algo de lo de debajo? Es la TERCERA aparición de la misma familia de
  // defectos (§0 de la cabecera).
  informe.nadaSeCerroPorDebajo = {
    queEs:
      'F08: el `click()` del `<a download>` cerraba el cajón. F09/T5.1: los clics DENTRO del ' +
      '`<dialog>` hacían lo mismo. Se mide, no se supone.',
    cajonAntes: cajonAntesDeComponer,
    cajonDespues: visible(cajonDiag),
    trazosAntes: trazosAntesDeComponer,
    trazosDespues: trazosDelContraste(),
    // El diálogo SÍ se cierra, y es correcto: lo cierra el cableado
    // PROGRAMÁTICAMENTE cuando el PDF ha bajado (ya no hay nada que rellenar), así
    // que no cuenta como `alCancelar`.
    dialogoCerradoPorElCableado: dialogoEl.open === false,
  }
  informe.nadaSeCerroPorDebajo.cajonSigueAbierto = informe.nadaSeCerroPorDebajo.cajonDespues === true
  informe.nadaSeCerroPorDebajo.contrasteSiguePintado =
    informe.nadaSeCerroPorDebajo.trazosDespues !== null && informe.nadaSeCerroPorDebajo.trazosDespues > 0

  if (excepcionAlComponer !== null) {
    problemas.push(`Pulsar «Componer PDF» ha LANZADO: ${excepcionAlComponer}.`)
  }
  if (!restaurado) {
    problemas.push(
      'El guion NO ha restaurado los envoltorios de `URL.createObjectURL` / `URL.revokeObjectURL` / ' +
        '`document.createElement`: la página queda parcheada y cualquier medida posterior es sospechosa.',
    )
  }
  if (informe.captura.blobsCapturados !== 1) {
    problemas.push(
      `Se esperaba EXACTAMENTE 1 llamada a URL.createObjectURL al componer el PDF y ha habido ` +
        `${informe.captura.blobsCapturados}. Renglón del diálogo: ` +
        `${JSON.stringify(renglonDialogo === null ? null : renglonDialogo.textContent.trim())}.`,
    )
  }
  if (informe.captura.blobsCapturados > 0 && !informe.captura.revocaLaQueCreo) {
    problemas.push(
      `La URL de blob del PDF NO se ha revocado (o se ha revocado otra): creadas ` +
        `${JSON.stringify(hrefsCreados)}, revocadas ${JSON.stringify(hrefsRevocados)}. ` +
        '`gml/descargar.js` promete revocar SIEMPRE, y por eso la revocación va en el `finally` más ' +
        'interno.',
    )
  }
  if (informe.bytes === 0) {
    problemas.push('El PDF ha bajado con 0 bytes: un fichero vacío es peor que ningún fichero.')
  }
  if (informe.bytes !== null && informe.empiezaPorPDF !== true) {
    problemas.push(
      `Los bytes que bajan no empiezan por «%PDF» sino por ${JSON.stringify(informe.cabecera)}: ` +
        'este PDF está escrito a mano, byte a byte, sin librería, y la cabecera es lo primero que ' +
        'mira cualquier lector antes de decidir si abre el fichero.',
    )
  }
  if (informe.tieneEOF === false) {
    problemas.push(
      'El PDF no termina en `%%EOF`: sin el marcador de fin, un lector estricto puede negarse a ' +
        'abrirlo o dar el fichero por truncado.',
    )
  }
  if (informe.paginasDeclaradas !== null && informe.paginasDeclaradas < 1) {
    problemas.push(`El árbol de páginas del PDF declara ${informe.paginasDeclaradas} páginas.`)
  }
  if (informe.paginasDeclaradas === null && informe.bytes !== null) {
    problemas.push(
      'No se ha encontrado el nodo `/Type /Pages /Count N` en el PDF: sin árbol de páginas el ' +
        'documento no es un PDF válido, por mucho que empiece por «%PDF».',
    )
  }
  if (informe.tipoDelBlob !== 'application/pdf') {
    problemas.push(
      `El blob del informe se ha entregado con tipo MIME ${JSON.stringify(informe.tipoDelBlob)} y no ` +
        '`application/pdf`: el sistema operativo elige el programa con el que abrirlo por ahí.',
    )
  }
  if (informe.captura.nombreDelAncla !== null && !/\.pdf$/i.test(informe.captura.nombreDelAncla)) {
    problemas.push(
      `El fichero baja como ${JSON.stringify(informe.captura.nombreDelAncla)}, sin extensión .pdf.`,
    )
  }
  if (informe.llevaPlanoJpeg === false) {
    problemas.push(
      '⭐ El PDF NO lleva ninguna imagen `/DCTDecode` dentro: el plano no ha entrado. Como el plano ' +
        'solo puede entrar por `toDataURL` sobre el lienzo compuesto, esto significa que el criterio ' +
        '1 ha fallado DENTRO de la aplicación, o que el WMS no contestó y el informe salió sin plano ' +
        '(mira el renglón y el panel de avisos: `app/cableado-informe.js` lo dice por tres canales).',
    )
  }
  if (informe.nadaSeCerroPorDebajo.cajonAntes && !informe.nadaSeCerroPorDebajo.cajonSigueAbierto) {
    problemas.push(
      '⚠️ Componer el PDF ha CERRADO el cajón de diagnóstico por debajo del modal. Es la tercera vez ' +
        'que este proyecto ve el mismo defecto: en F08 lo hacía el `click()` del `<a download>` ' +
        '(corregido en `gml/descargar.js` con `stopPropagation` en CAPTURA) y en F09/T5.1 lo hacían ' +
        'los clics dentro del `<dialog>`, que cuelga del `<body>` y por tanto queda FUERA del cajón ' +
        '(corregido en `viewer/cajon-diagnostico.js#enDialogo`). El usuario no lo ve hasta cerrar el ' +
        'diálogo: para entonces el contraste está borrado y el acuse de recibo se ha escrito en un ' +
        '`role="status"` que acaba de quedar en `display:none`.',
    )
  }
  if (informe.nadaSeCerroPorDebajo.contrasteSiguePintado === false) {
    problemas.push(
      'Tras componer el PDF el pane `diagnostico` se ha quedado sin `<path>`: el contraste del mapa ' +
        'se ha borrado, y el informe describe justo eso.',
    )
  }
  if (informe.peticionesWms > 2) {
    advertencias.push(
      `Componer el plano ha hecho ${informe.peticionesWms} peticiones al WMS. La ruta normal es UNA ` +
        '(180 mm a 300 ppp son 2126 px, por debajo del techo de 4000): más de una significa o bien ' +
        'troceado (geometría que no cabe) o bien el sondeo capa a capa que `componerPlano` hace ' +
        'cuando la petición junta falla.',
    )
  }
}

// ── 12 · Consola y cierre ───────────────────────────────────────────────────

window.removeEventListener('error', alError)
window.removeEventListener('unhandledrejection', alRechazo)

const red = {
  queEs: 'Peticiones vistas por Resource Timing durante ESTE guion. DATOS y CARTOGRAFÍA se cuentan aparte.',
  datos: {
    getNeighbour: diagnostico.peticionesGetNeighbour,
    dnprc: preparacion.peticionesDnprc,
    dnprcAlReabrir: reapertura.peticionesDnprc ?? null,
    total: (diagnostico.peticionesGetNeighbour || 0) + (preparacion.peticionesDnprc || 0),
    presupuesto: 'Como mucho 2 (override O8). NO se pulsa «Traer del Catastro»: la demo ya trae contorno oficial.',
  },
  cartografia: {
    wmsDelExperimento: 2,
    wmsDelPlano: informe.peticionesWms ?? null,
    nota: '2 sondas de 512×384 para el criterio 1 + 1 GetMap de 2126×1535 (~200-270 kB) para el plano.',
  },
  totalEnLaSesion: peticiones(),
}
if (red.datos.total > 2) {
  problemas.push(
    `Este guion ha gastado ${red.datos.total} peticiones de DATOS del Catastro y su presupuesto son ` +
      '2 (override O8: la denegación por abuso es de ~10 días).',
  )
}

const consola = {
  queEs:
    'Excepciones no capturadas y rechazos de promesa DURANTE este guion. El buffer entero es de ' +
    '`$B console --errors` (§6).',
  excepcionesNoCapturadas: excepciones.length,
  detalle: excepciones.slice(0, 10),
}
if (excepciones.length > 0) {
  problemas.push(
    `${excepciones.length} excepción(es) no capturada(s) durante el recorrido: ` +
      `${JSON.stringify(excepciones.slice(0, 3))}.`,
  )
}

const estadoFinal = {
  queEs: 'Lo que queda en pantalla para la captura del §10 del checklist humano.',
  cajonDiagnosticoAbierto: visible(cajonDiag),
  dialogoAbierto: dialogoEl === null ? null : dialogoEl.open,
  trazosDelContraste: trazosDelContraste(),
  renglonDelInforme: renglonInforme.textContent.trim(),
  tarjetasDeAvisos: tarjetasDeAvisos(),
  altoCajaVerticesPx: altoCajaVertices(),
  nota:
    'El cajón queda ABIERTO con el contraste pintado y el diálogo CERRADO (lo cierra el cableado al ' +
    'bajar el PDF): la captura tiene que enseñar que componer no se llevó nada por delante.',
}

if (agotado()) {
  advertencias.push(`Presupuesto de tiempo agotado (${TOPE_TOTAL_MS} ms): repite con la página recién cargada.`)
}

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '11-informe-pdf',
  feature: 'F09',
  tarea: 'T6.2',
  criterios: [1, 2, 3, 4, 5],
  url: location.href,
  ok: problemas.length === 0,
  esGestoDeRatonReal: false,
  aviso:
    'Los clics son `el.click()` y `Escape` es un `KeyboardEvent` despachado a mano: `/browse` no ' +
    'tiene comando `drag` y el dominio CDP `Input` no está en su allowlist (§0). Y sobre todo: este ' +
    'guion NO abre el PDF. Afirma sobre sus bytes; que lo abran tres lectores distintos —Acrobat, el ' +
    'visor de Chrome y uno ligero— es el §10.1 del checklist humano, porque este PDF está escrito a ' +
    'mano byte a byte y uno que abre en un solo lector no está escrito, está de suerte.',
  duracionMs: redondear(performance.now() - t0, 0),
  arranque,
  criterio1,
  diagnostico,
  preparacion,
  invariante,
  modal,
  encaje,
  tipografia,
  escape,
  reapertura,
  presuncion,
  borrador,
  informe,
  red,
  estadoFinal,
  consola,
  noCubierto: [
    'Que el PDF ABRA. Se afirma sobre sus bytes (%PDF, /Type /Pages /Count N, /DCTDecode, %%EOF); abrirlo en Acrobat, en el visor de Chrome y en un lector ligero es el checklist §10.1, y es obligatorio: el fichero está escrito a mano, sin librería.',
    'Si el PLANO se lee: escala gráfica legible, cotas que no se pisan, norte visible, la parcela reconocible sobre la cartografía. Checklist §10.2.',
    'Si alguna frase del informe se lee como un VEREDICTO —sobre el encaje o sobre el trabajo de otro técnico—, y en particular la presunción de vía pública. Es el punto BLOQUEANTE del checklist §10.5 (regla de oro 9).',
    'El criterio 3 (troceado del plano cuando no cabe en una GetMap): a 180 mm y 300 ppp son 2126 px, por debajo del techo de 4000 px del WMS, así que la ruta normal es UNA petición. Forzarlo costaría varias de ~200 kB. Lo cubre test/report/encuadre.test.js.',
    'La impresión en papel: márgenes reales de la impresora, si el A4 sale a escala, si el gris del diagnóstico se distingue en blanco y negro. Checklist §10.3.',
    'La caída del WMS a mitad de composición (el informe sale SIN plano y lo dice por tres canales): /browse no tiene modo offline ni interceptación de red. Checklist §10.4; lo cubre test/app/informe.dom.test.js.',
    'El atrape de foco POR TABULACIÓN: aquí se mide su consecuencia (el fondo queda inerte y un `.focus()` de detrás no se lleva el foco), no el ciclo de `Tab`, que un evento sintético no mueve.',
    'Si los datos recordados del pie de firma sobreviven a cerrar el navegador: eso es IndexedDB y tiempo, y la suite lo cubre con `fake-indexeddb`.',
  ],
  problemas,
  advertencias,
}
