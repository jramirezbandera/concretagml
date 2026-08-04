// scripts/smoke-navegador/12-expedientes.js — F10 · Tarea T6.2.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// LA PERSISTENCIA Y LAS TRES EXPORTACIONES (F10) en un navegador de verdad, y
// **solo lo que ahí se puede medir**. La suite ya cubre el almacén
// (test/storage/expedientes.test.js), el debounce (test/storage/autoguardado.js),
// la cuota (test/storage/cuota.test.js), la purga
// (test/storage/cache-catastro.test.js), los tres escritores (test/export/), el
// diálogo (test/app/dialogo-expediente.dom.test.js), el cableado
// (test/app/expediente.dom.test.js) y los seis criterios
// (test/storage/aceptacion-f10.test.js); **aquí no se vuelve a medir nada de
// eso**. Se miden las siete cosas que jsdom no puede dar:
//
//   1. ⭐ **QUE LOS BYTES ESTÁN EN UNA BASE DE VERDAD, Y ESTE GUION ES EL ÚNICO
//      SITIO DONDE SE PUEDE MEDIR.** Toda la suite de F10 corre sobre
//      `fake-indexeddb`, que **no es una base de datos**: es una implementación en
//      memoria que muere con el proceso. O sea que la promesa entera de la fase
//      —«el trabajo se guarda»— es, en la suite, incomprobable por construcción.
//      Aquí se cierra por dos caminos distintos y complementarios:
//
//        · **SEGUNDA CONEXIÓN** — se guarda un expediente por la interfaz y luego
//          se abre `indexedDB.open('concreta-gml')` **aparte**, sin pasar por
//          `storage/bd.js` (que MEMOIZA su conexión y devolvería la misma), y se
//          lee el registro de ahí. Si aparece, los bytes están en el almacén del
//          navegador y no en una variable de módulo.
//        · **HERENCIA ENTRE CARGAS** — el guion deja SIEMPRE un expediente marcado
//          ({@link MARCA}) y, al arrancar, busca el que dejó la corrida anterior.
//          Lanzarlo, hacer `$B reload` y volver a lanzarlo mide lo único que de
//          verdad importa: que sobrevive a que la página se vuelva a cargar. La
//          primera corrida lo declara como no medido en vez de fingirlo.
//
//      ⚠️ Lo que ni así se mide es **cerrar el NAVEGADOR entero** (no la pestaña):
//      eso es del checklist humano §11.1, y es donde de verdad se ve si el perfil
//      conserva o desaloja.
//   2. **`navigator.storage.persist()` y `estimate()` REALES.** No existen en Node
//      y en jsdom tampoco. La fase 0 midió que `persist()` devuelve `false` en un
//      perfil sin interacción previa, igual en `localhost` que en el `https://` de
//      Pages — o sea que **la ficha de la feature promete algo que no ocurre**
//      («evita el desalojo»). Aquí se vuelve a medir en cada corrida, porque es un
//      hecho del NAVEGADOR y puede cambiar: si algún día devuelve `true` en un
//      perfil con historial, este guion es quien se entera. Se publica como
//      NÚMERO/BOOLEANO, nunca como problema: un «no» del navegador no es un fallo
//      de la aplicación (regla de oro 9).
//   3. **Las TRES exportaciones, con sus BYTES.** Misma cadena
//      `Blob → createObjectURL → <a download> → click() → revoke` que miden `06`
//      (el GML), `10` (el informe de texto) y `11` (el PDF), con el mismo patrón de
//      captura (GUION.md §12) y la misma promesa: los envoltorios se restauran en
//      un `finally` y el veredicto lo DECLARA. Lo que se afirma es de nivel de
//      byte: que el DXF **empieza por la cabecera `AC1015`** y trae las dos capas
//      en su TABLA, que el listado lleva coma decimal española, y que el `.json`
//      se puede volver a leer (`JSON.parse` + el sobre `concreta-gml/proyecto`).
//   4. **Que abrir el diálogo y exportar NO CIERREN NADA POR DEBAJO.** Es la
//      CUARTA aparición de la misma familia de defectos en este proyecto, y por eso
//      se mide en vez de suponerse:
//        · F08 — el `click()` del `<a download>` burbujeaba hasta `document` y el
//          guardián de clic-fuera del cajón lo veía como un clic FUERA.
//        · F09 · T5.1 — lo mismo con los clics DENTRO del `<dialog>`, que cuelga
//          del `<body>` y por tanto está fuera del cajón.
//        · F10 · T4.1 — el mismo diálogo, otra vez. La suite afirma que el arreglo
//          de F09 (`viewer/cajon-diagnostico.js`, que pregunta por el ELEMENTO
//          `dialog` y no por su atributo `open`) sigue puesto; que funcione con la
//          capa superior de verdad —donde jsdom no llega— solo se ve aquí.
//   5. **EL INVARIANTE HEREDADO: la caja de vértices sigue en ~267 px.** Quinta
//      fase seguida (F06 la dejó en 303, F07 en 267 con su CTA, F08 en 267 con
//      «Abrir un GML…», F09 en 267 porque su interfaz es un modal, y F10 dijo
//      «coste 0 px» porque su botón cabe DENTRO del alto de línea del `<h2>`).
//      Se mide al arrancar y **en el tick en que el diálogo se abre**, con
//      {@link asentarPanel} y con ATRIBUCIÓN de la pérdida: las dos lecciones que
//      ya se pagaron —F07 midió demasiado tarde y acusó al cajón de píxeles
//      ajenos; F09 midió demasiado pronto y acusó al diálogo de 33 px que eran del
//      renglón de las colindantes—.
//      ⚠️ **Y aquí hay una medida que solo tiene sentido en F10**: la fila del
//      rótulo con DOS botones dentro. Se mide su alto y **la holgura** entre el
//      `<h2>` y el grupo de acciones: está en ~20 px, de los cuales 8 son el `gap`
//      declarado. O sea que «Expediente» **no puede crecer**: dos o tres caracteres
//      más parten la fila en dos líneas y eso cuesta los ~36 px que toda esta
//      decisión existe para no gastar.
//   6. **La tipografía del botón NUEVO y de los del diálogo**, derivando la
//      expectativa del token `--font-sans` leído del `:root` y **no de un literal
//      copiado**. Es el defecto que destapó el guion `10` en su primera corrida: un
//      `font:'inherit'` en línea gana a la hoja y deja la regla de
//      `estilos/app.css` escrita, puesta y muerta — y en jsdom **no hay cascada que
//      lo delate**.
//   7. **Que el `<dialog>` se comporte como un modal DE VERDAD.** Lo que jsdom no
//      tiene, MEDIDO (jsdom 29.1.1): `HTMLDialogElement.prototype` expone
//      **exactamente una** cosa, la propiedad reflejada `open`. Así que `:modal`
//      (capa superior), el foco dentro al abrir, el fondo INERTE y `Escape` **solo
//      se ejercitan aquí**.
//
// ── QUÉ **NO** PUEDE MEDIR — LÉELO ANTES DE CITAR ESTE GUION ────────────────
//
//   · **NO abre el DXF en un CAD.** Afirma sobre sus bytes —cabecera `AC1015`, las
//     dos capas en la TABLA, tamaño—, que es todo lo que un guion puede ver. Que
//     AutoCAD lo abra con las dos capas SELECCIONABLES POR CAPA es el punto
//     BLOQUEANTE del checklist §11.4, y es el mismo reparto que hizo F09 con el PDF
//     en tres lectores: **un DXF que valida contra nuestro propio parser y no abre
//     en AutoCAD no está exportado, está de suerte**.
//   · **NO cierra el navegador.** Mide la supervivencia a una RECARGA (§1); cerrar
//     el navegador entero y volver es del checklist §11.1.
//   · **NO abre dos pestañas.** El `versionchange` con dos pestañas de verdad se
//     provocó en la fase 0 con dos conexiones de la misma pestaña; con dos pestañas
//     es del checklist §11.2.
//   · **NO llena la cuota.** Medido en la fase 0: la cuota real de este origen es
//     ~1,8 GB y un expediente ocupa ~0,8 kB, así que llenarla son ~1,3 millones de
//     escrituras. La degradación se prueba con un doble en la suite y queda
//     declarado que es una simulación nuestra.
//   · **NO decide si alguna frase de la lista se lee como un veredicto.** Publica
//     números y textos (regla de oro 9). Ese juicio es el punto BLOQUEANTE del
//     checklist §11.6, que hereda el carácter del 8.1, el 9.4 y el 10.5.
//   · **NO es un gesto de ratón** (§0 del GUION): los clics son `el.click()` y
//     `Escape` es un `KeyboardEvent` despachado a mano.
//   · **NO abre un `.json` desde el disco.** El selector de ficheros del sistema no
//     se puede conducir desde aquí; la entrada por fichero la cubre
//     `test/app/expediente.dom.test.js` y el §11.5 la firma a mano.
//
// ── RÉGIMEN DE RED: CERO PETICIONES AL CATASTRO ─────────────────────────────
// **Este guion no toca la red.** No pulsa «Traer del Catastro», no abre el cajón
// de diagnóstico y no compone ningún informe: todo lo que mide es local (IndexedDB
// y tres serializadores puros). Es el guion más barato de la carpeta y se puede
// repetir sin mirar el §13.
//
// ── ⚠️ ESTE GUION NECESITA `npm run dev`, NO `vite preview` ─────────────────
// Lo mismo que el §16 y el §17: las cifras de referencia de esta carpeta están
// medidas sobre `npm run dev` bajo el `base` de Pages (`/concretagml/`). Si algún
// día se repite sobre el build, hay que remedir.
//
// ── CÓMO SE LANZA ───────────────────────────────────────────────────────────
// Página recién cargada (el guion lo comprueba), `$B eval` desde la raíz:
//
//   $B viewport 1440x900
//   $B goto http://localhost:PUERTO/concretagml/     # ⚠️ el base, no la raíz
//   $B wait ".gml-tabla-vertices"
//   $B console --clear
//   $B eval scripts/smoke-navegador/12-expedientes.js
//   $B reload && $B wait ".gml-tabla-vertices"        # ⭐ y AHORA la segunda vez:
//   $B eval scripts/smoke-navegador/12-expedientes.js #    mide la SUPERVIVENCIA
//   $B console --errors                               # → (no console errors)
//   $B screenshot .gstack/smoke-f10.png               # la evidencia para el §11
//
// ⚠️ **HAY QUE LANZARLO DOS VECES**, y no es opcional: la primera corrida no puede
// medir la supervivencia (no hay corrida anterior de la que heredar) y lo DECLARA
// en `noCubierto`. La segunda es la que firma el criterio 1.
//
// ⚠️ **Estado final.** El guion deja **un expediente marcado** ({@link MARCA}) a
// propósito —es lo que la corrida siguiente hereda— y borra todo lo demás que haya
// creado. Lo DECLARA en `estadoFinal`. Para dejar el perfil limpio del todo, el
// GUION §18 explica cómo borrar la base.
//
// ⚠️ NO envuelvas este fichero en una IIFE: `browse` ya lo envuelve ÉL en
// `(async()=>{ … })()` — por eso los `await` y el `return` de nivel superior son
// legales. Con una IIFE propia, el `eval` devuelve una promesa que nadie espera y
// **el veredicto se pierde EN SILENCIO** mientras los efectos (clics, escrituras,
// las descargas) sí ocurren. Consecuencia normal y esperada: `node --check` sobre
// este fichero falla con «Illegal return statement».

const t0 = performance.now()
const TOPE_TOTAL_MS = 90000
const agotado = () => performance.now() - t0 > TOPE_TOTAL_MS

const problemas = []
const advertencias = []
const noCubierto = []

/**
 * El rótulo con el que este guion marca su expediente. Lleva la palabra HUMO
 * delante para que quien se lo encuentre en la lista sepa de dónde salió, y **no
 * lleva fecha**: la corrida siguiente tiene que poder encontrarlo por nombre exacto.
 */
const MARCA = 'HUMO F10 · dejado por 12-expedientes.js'

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
const visible = (el) => el !== null && el !== undefined && getComputedStyle(el).display !== 'none'

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

/** Alto de la caja de vértices: la cifra que este guion HEREDA de 08 §10, 09 §5, 10 §5 y 11 §5. */
const altoCajaVertices = () => {
  const caja = $('#tabla-vertices')
  return caja === null ? null : Math.round(caja.getBoundingClientRect().height)
}
const tarjetasDeAvisos = () => $$('#avisos .gml-aviso').length
const filasDeTabla = () => $$('#tabla-vertices tr[data-recinto="0"][data-indice]').length

/**
 * Espera a que el PANEL deje de moverse: dos lecturas seguidas con el mismo alto.
 * Existe por el falso positivo MEDIDO que pagó `11` (medir demasiado pronto, con el
 * renglón de las colindantes todavía en vuelo). Aquí hace falta por otro motivo: el
 * arranque de F10 lee IndexedDB y puede escribir una tarjeta de aviso —la oferta del
 * borrador, o el aviso de persistencia— **después** del primer pintado.
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

/** Los pares (código, valor) de un DXF ASCII, que es estrictamente alternante. */
function paresDxf(dxf) {
  const lineas = dxf.split(/\r\n|\n/)
  const salida = []
  for (let i = 0; i + 1 < lineas.length; i += 2) salida.push([lineas[i].trim(), lineas[i + 1]])
  return salida
}

/**
 * Lee el almacén de expedientes por una SEGUNDA conexión, sin pasar por
 * `storage/bd.js` —que memoiza la suya y devolvería la misma—. Es lo que distingue
 * «guardado» de «guardado en una variable de módulo», y `fake-indexeddb` no lo
 * puede probar ni fingir.
 *
 * Se abre SIN versión: pedir una concreta desde aquí podría disparar un
 * `versionchange` contra la conexión de la aplicación, que es justo lo que este
 * guion no quiere provocar.
 */
async function leerDeDisco() {
  const salida = { medido: false }
  try {
    const bd = await new Promise((res, rej) => {
      const p = indexedDB.open('concreta-gml')
      p.onsuccess = () => res(p.result)
      p.onerror = () => rej(p.error)
      p.onblocked = () => rej(new Error('bloqueada por otra conexión'))
    })
    salida.medido = true
    salida.version = bd.version
    salida.almacenes = [...bd.objectStoreNames].sort()
    salida.tieneExpedientes = salida.almacenes.includes('expedientes')

    if (salida.tieneExpedientes) {
      const tx = bd.transaction('expedientes', 'readonly')
      const almacen = tx.objectStore('expedientes')
      salida.indices = [...almacen.indexNames].sort()
      const todos = await new Promise((res, rej) => {
        const p = almacen.getAll()
        p.onsuccess = () => res(p.result)
        p.onerror = () => rej(p.error)
      })
      salida.registros = todos.length
      salida.marcados = todos
        .filter((r) => r && r.nombre === MARCA)
        .map((r) => ({
          id: r.id,
          refcat: r.refcat,
          srs: r.srs,
          actualizado: r.actualizado,
          vertices: r.expediente?.parcela?.recintos?.[0]?.vertices?.length ?? null,
          // ⛔ MEDIDO en la fase 0: el clonado estructural de IndexedDB **no
          // preserva `Object.freeze`**. Se comprueba sobre el registro CRUDO —que
          // tiene que venir DESCONGELADO— porque es el hecho que obliga a
          // rehidratar por `crearExpediente` al recuperar. Si algún día viniera
          // congelado, la rehidratación seguiría siendo correcta pero su
          // justificación escrita ya no, y hay que enterarse.
          oficialCongeladaEnCrudo: r.expediente?.parcela?.geometriaOficial
            ? Object.isFrozen(r.expediente.parcela.geometriaOficial)
            : null,
        }))
      await new Promise((res) => {
        tx.oncomplete = res
        tx.onerror = res
      })
    }
    bd.close()
  } catch (error) {
    salida.error = `${error.name}: ${error.message}`
  }
  return salida
}

/** Los nombres de capa declarados en la TABLA LAYER (no los que nombran las entidades). */
function capasDeLaTabla(dxf) {
  const nombres = []
  let enTabla = false
  let enRegistro = false
  for (const [c, val] of paresDxf(dxf)) {
    if (c === '2' && val === 'LAYER' && !enTabla) enTabla = true
    else if (enTabla && c === '0' && val === 'ENDTAB') break
    else if (enTabla && c === '0') enRegistro = val === 'LAYER'
    else if (enTabla && enRegistro && c === '2') nombres.push(val)
  }
  return nombres
}

// ── 1 · Página recién cargada y F10 montada ─────────────────────────────────

const botonExpediente = $('[data-accion="abrir-expediente"]')
const dialogoEl = $('dialog.gml-dialogo-expediente')

if (botonExpediente === null || dialogoEl === null) {
  window.removeEventListener('error', alError)
  window.removeEventListener('unhandledrejection', alRechazo)
  return {
    guion: '12-expedientes',
    ok: false,
    problemas: [
      'Falta el botón «Expediente» (`[data-accion="abrir-expediente"]`) o su `<dialog>` ' +
        '(`dialog.gml-dialogo-expediente`): F10 no está montada en esta página. El botón vive en ' +
        '`index.html`; el diálogo lo fabrica `app/dialogo-expediente.js` al construirse, no al abrirlo.',
    ],
  }
}

const superficieArranque = (() => {
  const t = texto('[data-ficha="superficie"]')
  if (!t) return null
  const m = /-?[\d.]+(?:,\d+)?/.exec(t)
  return m === null ? null : Number(m[0].replace(/\./g, '').replace(',', '.'))
})()

await asentarPanel()

const arranque = {
  filas: filasDeTabla(),
  superficieFicha: superficieArranque,
  refcatFicha: texto('[data-ficha="refcat"]'),
  // Herencia de 08 §10, 09 §5, 10 §5 y 11 §5, medida con el panel ya asentado.
  altoCajaVerticesPx: altoCajaVertices(),
  tarjetasDeAvisos: tarjetasDeAvisos(),
  avisos: $$('#avisos .gml-aviso-texto').map((t) => t.textContent.trim().slice(0, 160)),
  dialogoEnElDomAlArrancar: true,
  dialogoCerradoAlArrancar: !dialogoEl.open,
  // La Decisión 3 de la entrevista («coste 0 px en el panel — QUINTA fase seguida»),
  // comprobada por ESTRUCTURA: la interfaz de F10 es un `.gml-boton--menudo` en la
  // fila del rótulo y un modal, o sea que en el `<aside>` no puede haber aparecido
  // ningún bloque nuevo.
  bloqueExpedienteEnElPanel:
    $('aside .gml-bloque--expediente, aside [data-bloque="expediente"]') !== null,
}

// ⭐ LA MEDIDA QUE SOLO TENÍA SENTIDO EN F10: la fila del rótulo con DOS botones.
//
// ⛔⛔ ESTE BLOQUE MIDE UNA FILA QUE YA NO EXISTE (comprobado el 2026-08-04, rework
// de UI · T8). NO SE ARREGLA AQUÍ Y NO SE FINGE QUE FUNCIONA: se declara.
//
// T6 reestructuró Entrada en tres vías y se llevó los dos botones fuera de la fila
// del `<h2>` «Origen de la parcela»: «Abrir un GML…» es hoy la tercera vía y
// «Expediente» es el «Abrirlo» del pie de Entrada. **`.gml-rotulo-acciones` ya no
// aparece en `index.html`** —solo lo fabrica `app/panel-edificio.js`, que es otra
// pantalla—, y la consecuencia se mide en dos daños distintos:
//
//   1. `accionesRotulo` es SIEMPRE `null`, así que los dos guardianes de abajo
//      —`mismaLinea === false` y `holguraPx !== null`— **no pueden disparar nunca**.
//      Están verdes porque no miran nada, que es el peor verde que hay.
//   2. Peor todavía: `$('.gml-rotulo-fila')` no devuelve `null`, devuelve **la fila
//      de «Vértices»**, que es la otra que usa ese patrón. Así que `altoPx` y
//      `altoDelH2Px` siguen publicando números plausibles bajo el rótulo
//      `filaDelRotulo` — números de OTRO elemento. Es exactamente el error que T4
//      dejó escrito: medir el elemento equivocado da un verde que miente.
//
// QUÉ HAY QUE HACER CUANDO SE RETOME (no es de T8, que es de documentación): la
// decisión que esto protege —«la interfaz de F10 cuesta 0 px en el panel»— sigue
// viva, pero su comprobación es otra: que «Abrirlo» siga siendo un
// `.gml-boton--menudo` dentro de `.gml-entrada-pie`, en una sola línea, y que el
// guardián de `bloqueExpedienteEnElPanel` —que ése SÍ sigue midiendo lo suyo— siga
// en pie. Y el guion entero hay que lanzarlo sobre `#/parcela/validacion`, como ya
// avisa el §19 del GUION: en Entrada la caja de vértices no se ve y el guardián de
// los 220 px de más arriba levantaría una regresión que no existe.
const filaRotulo = $('.gml-rotulo-fila')
const h2Rotulo = filaRotulo === null ? null : filaRotulo.querySelector('.gml-rotulo')
const accionesRotulo = filaRotulo === null ? null : filaRotulo.querySelector('.gml-rotulo-acciones')
arranque.filaDelRotulo = {
  altoPx: filaRotulo === null ? null : redondear(filaRotulo.getBoundingClientRect().height),
  altoDelH2Px: h2Rotulo === null ? null : redondear(h2Rotulo.getBoundingClientRect().height),
  botonesDentro: accionesRotulo === null ? null : accionesRotulo.querySelectorAll('button').length,
  // «Misma línea» es lo que hace que el coste sea 0 px: si se parten, la fila crece
  // ~36 px y se los quita la caja de vértices.
  mismaLinea:
    h2Rotulo === null || accionesRotulo === null
      ? null
      : Math.abs(
          h2Rotulo.getBoundingClientRect().top - accionesRotulo.getBoundingClientRect().top,
        ) < 4,
  // La holgura que queda antes de que la fila se parta. De ella, 8 px son el `gap`
  // declarado en `.gml-rotulo-acciones`: lo que de verdad sobra es lo demás.
  holguraPx:
    h2Rotulo === null || accionesRotulo === null
      ? null
      : Math.round(
          accionesRotulo.getBoundingClientRect().left - h2Rotulo.getBoundingClientRect().right,
        ),
  rotuloDelBoton: botonExpediente.textContent.trim(),
}

if (arranque.filas !== 15) {
  problemas.push(
    `La página no está recién cargada sobre la parcela real (${arranque.filas} filas): las medidas ` +
      'de este guion suponen el dataset de arranque. `$B reload` y vuelve a lanzarlo.',
  )
}
if (
  arranque.tarjetasDeAvisos === 0 &&
  arranque.altoCajaVerticesPx !== null &&
  arranque.altoCajaVerticesPx < 220
) {
  problemas.push(
    `La caja de vértices arranca en ${arranque.altoCajaVerticesPx} px con la lista de avisos vacía ` +
      '(referencia medida: ~267 px, los mismos que dejaron F07, F08 y F09): algo del tamaño de un ' +
      'BLOQUE ha entrado en el panel, y la Decisión 3 de F10 era que su interfaz costara 0 px.',
  )
}
if (arranque.bloqueExpedienteEnElPanel) {
  problemas.push(
    'Ha aparecido un bloque de expediente en el panel izquierdo: F10 decidió a propósito que su ' +
      'interfaz fuera un botón menudo en la fila del rótulo y un `<dialog>`, para no volver a ' +
      'comerle altura a la tabla de vértices (quinta fase seguida).',
  )
}
if (arranque.filaDelRotulo.mismaLinea === false) {
  problemas.push(
    `La fila «Origen de la parcela» se ha PARTIDO en dos líneas (alto ${arranque.filaDelRotulo.altoPx} ` +
      'px): el botón «Expediente» ya no cabe dentro del alto de línea del `<h2>` y el coste deja de ' +
      'ser 0 px. Acorta el rótulo del botón; ~36 px son los que esta decisión existe para no gastar.',
  )
}
if (arranque.filaDelRotulo.holguraPx !== null && arranque.filaDelRotulo.holguraPx < 12) {
  advertencias.push(
    `Solo quedan ${arranque.filaDelRotulo.holguraPx} px de holgura entre el rótulo y los botones (8 ` +
      'de ellos son el `gap` declarado). «Expediente» no puede crecer ni un carácter más.',
  )
}
if (!arranque.dialogoCerradoAlArrancar) {
  problemas.push('El `<dialog>` de expediente está ABIERTO antes de pulsar nada.')
}

// ── 2 · ⭐ Persistencia y cuota REALES ──────────────────────────────────────
//
// Se publican, no se juzgan (regla de oro 9): que el navegador diga que no a
// `persist()` es la respuesta normal de un sitio sin interacción previa, MEDIDA en
// la fase 0, y no un defecto de la aplicación. Lo que sí sería un defecto —que la
// aplicación prometiera durabilidad sin tenerla— lo mide el §4, mirando el acuse.

const almacenamiento = {
  hayApi: typeof navigator.storage === 'object' && navigator.storage !== null,
  persistDisponible: typeof navigator.storage?.persist === 'function',
  estimateDisponible: typeof navigator.storage?.estimate === 'function',
  persisted: null,
  cuotaMB: null,
  usoAntesKB: null,
  origen: location.origin,
  esSeguro: window.isSecureContext,
}
if (almacenamiento.persistDisponible) {
  // `persisted()` y no `persist()`: la aplicación ya llamó a `persist()` al
  // arrancar y volver a pedirlo aquí no aporta nada. Lo que interesa es el RÉGIMEN.
  almacenamiento.persisted = await navigator.storage.persisted()
}
if (almacenamiento.estimateDisponible) {
  const est = await navigator.storage.estimate()
  almacenamiento.cuotaMB = redondear((est.quota || 0) / 1048576, 1)
  almacenamiento.usoAntesKB = redondear((est.usage || 0) / 1024, 1)
}
if (!almacenamiento.hayApi) {
  problemas.push(
    'Este navegador no expone `navigator.storage`: F10 no puede saber en qué régimen de ' +
      'almacenamiento está y la aplicación no puede prometer nada sobre la durabilidad.',
  )
}

// ── 3 · ⭐ La HERENCIA de la corrida anterior (criterio 1) ──────────────────
//
// Ver el punto 1 de la cabecera: es la mitad que sólo se puede medir lanzando el
// guion dos veces con un `$B reload` en medio. La primera corrida no puede, y lo
// DECLARA en vez de fingirlo.

// ⚠️ `.focus()` ANTES del `.click()`, y no es adorno: en un navegador de verdad un
// clic de ratón deja el foco en el botón, pero `element.click()` **no lo mueve**. Sin
// esta línea, `focoPrevio` sería el `<body>` y el guion acusaría al diálogo de no
// devolver el foco al cerrar — un falso positivo sobre un gesto que este guion no
// puede hacer (§0 del GUION: aquí no hay ratón).
botonExpediente.focus()
botonExpediente.click()
await esperar(() => dialogoEl.open, 4000, 'que se abra el diálogo «Expediente»')
// La lista sale de IndexedDB, así que se pinta un tick después de abrirse.
await esperar(
  () => $$('dialog.gml-dialogo-expediente [data-id]').length > 0 ||
    texto('[data-estado="dialogo-expediente"]') !== null,
  4000,
  'que llegue la lista de expedientes guardados',
)
await new Promise((r) => setTimeout(r, 300))

const filaConLaMarca = () =>
  $$('dialog.gml-dialogo-expediente [data-id]').find((f) =>
    f.textContent.includes(MARCA),
  ) || null

const heredado = filaConLaMarca()
// La lectura de disco va ANTES de guardar nada: lo que se busca es la marca que
// dejó OTRA carga de la página, y guardar primero la sustituiría por la de ahora.
const discoAntes = await leerDeDisco()

/**
 * ⚠️ **La comprobación que hace que esto NO sea un falso positivo.** Encontrar la
 * marca en la lista no prueba que haya sobrevivido a nada: lanzando el guion dos
 * veces SIN recargar, la segunda corrida se encuentra la que dejó la primera en la
 * misma carga de página y daría el criterio por firmado.
 *
 * `performance.timeOrigin` es el instante en que ESTE documento empezó. Si la marca
 * se escribió ANTES, es de otra carga; si se escribió después, es de ésta y no dice
 * nada sobre la supervivencia. Es exacto y no depende de que el operador recuerde
 * haber hecho `$B reload`.
 */
const marcasPrevias = (discoAntes.marcados || []).filter(
  (m) => Number.isFinite(Date.parse(m.actualizado)) && Date.parse(m.actualizado) < performance.timeOrigin,
)

const herencia = {
  medido: marcasPrevias.length > 0,
  queEs:
    'El expediente que dejó una carga ANTERIOR de la página. Si está —y su marca de tiempo es ' +
    'previa a `performance.timeOrigin`—, el trabajo ha sobrevivido a una recarga en una IndexedDB ' +
    'de verdad, que es lo que la suite no puede medir porque corre sobre `fake-indexeddb`.',
  enLaLista: heredado !== null,
  filaHeredada: heredado === null ? null : heredado.textContent.replace(/\s+/g, ' ').trim().slice(0, 160),
  marcasEnDisco: (discoAntes.marcados || []).length,
  marcasDeOtraCarga: marcasPrevias.length,
  masAntigua: marcasPrevias.length === 0 ? null : marcasPrevias.map((m) => m.actualizado).sort()[0],
  timeOrigin: new Date(performance.timeOrigin).toISOString(),
  verticesDeLaHeredada: marcasPrevias.length === 0 ? null : marcasPrevias[0].vertices,
}
if (!herencia.medido) {
  noCubierto.push(
    'LA SUPERVIVENCIA A LA RECARGA no se ha medido en esta corrida: no había ningún expediente ' +
      `marcado «${MARCA}» escrito ANTES de que esta página se cargara` +
      (herencia.enLaLista
        ? ' (la marca que hay en la lista la ha escrito ESTA misma carga, así que no cuenta: ' +
          'lanzar el guion dos veces sin recargar no mide nada)'
        : ' (es lo normal la PRIMERA vez)') +
      '. Haz `$B reload && $B wait ".gml-tabla-vertices"` y vuelve a lanzarlo: esa corrida es la ' +
      'que firma el criterio 1.',
  )
}
if (herencia.medido && herencia.verticesDeLaHeredada !== 15) {
  problemas.push(
    `El expediente heredado ha sobrevivido a la recarga con ${herencia.verticesDeLaHeredada} vértices ` +
      'y se guardó con 15: la geometría se ha degradado al pasar por IndexedDB.',
  )
}

// ── 4 · Guardar por la interfaz, y el acuse ─────────────────────────────────

const campoNombre = dialogoEl.querySelector('[data-expediente="nombre"]')
const botonGuardar = dialogoEl.querySelector('[data-accion="guardar-expediente"]')
const renglonDialogo = dialogoEl.querySelector('[data-estado="dialogo-expediente"]')

const modal = {
  abierto: dialogoEl.open,
  // Lo que jsdom no tiene: capa superior de verdad.
  esModal: typeof dialogoEl.matches === 'function' ? dialogoEl.matches(':modal') : null,
  focoDentro: dialogoEl.contains(document.activeElement),
  focoEn: document.activeElement === null ? null : document.activeElement.dataset.expediente ?? document.activeElement.tagName,
  rect: rect(dialogoEl),
  ventana: { w: window.innerWidth, h: window.innerHeight },
  // El fondo INERTE: un `.focus()` sobre un control de detrás no se lo lleva.
  fondoInerte: (() => {
    const detras = $('[data-accion="abrir-gml"]')
    if (detras === null) return null
    const antes = document.activeElement
    detras.focus()
    const seLoLlevo = document.activeElement === detras
    if (seLoLlevo && antes !== null && typeof antes.focus === 'function') antes.focus()
    return !seLoLlevo
  })(),
  altoCajaVerticesConElDialogoAbierto: altoCajaVertices(),
}
modal.cabeEnLaVentana =
  modal.rect === null
    ? null
    : modal.rect.x >= 0 && modal.rect.y >= 0 && modal.rect.derecha <= modal.ventana.w + 1 && modal.rect.abajo <= modal.ventana.h + 1
modal.scrollHorizontalDeLaPagina = document.documentElement.scrollWidth - document.documentElement.clientWidth

if (modal.esModal === false) {
  problemas.push(
    'El `<dialog>` está abierto pero NO es `:modal`: se ha abierto con el atributo `open` en vez de ' +
      'con `showModal()`, así que no hay capa superior, ni velo, ni atrape de foco. En jsdom eso es ' +
      'lo normal (no implementa `showModal`); en un navegador de verdad es un defecto.',
  )
}
if (modal.cabeEnLaVentana === false) {
  problemas.push(
    `El diálogo se sale de la ventana (${JSON.stringify(modal.rect)} en ${modal.ventana.w}×${modal.ventana.h}): ` +
      'parte del formulario queda inalcanzable.',
  )
}
if (modal.scrollHorizontalDeLaPagina > 0) {
  problemas.push(
    `Abrir el diálogo obliga a la página a hacer scroll horizontal (${modal.scrollHorizontalDeLaPagina} px).`,
  )
}
if (modal.focoDentro === false) {
  problemas.push('Al abrir el diálogo el foco se ha quedado FUERA: `Escape` no llegaría nunca.')
}
if (modal.fondoInerte === false) {
  advertencias.push(
    'El fondo NO está inerte: un control de detrás del modal se ha llevado el foco. Con `showModal()` ' +
      'el navegador lo impide solo; si esto falla, es que el diálogo no es modal de verdad.',
  )
}
if (
  arranque.altoCajaVerticesPx !== null &&
  modal.altoCajaVerticesConElDialogoAbierto !== null &&
  modal.altoCajaVerticesConElDialogoAbierto < arranque.altoCajaVerticesPx
) {
  // ATRIBUCIÓN, no acusación: la lección que pagó `11`. Se publica la pérdida y se
  // dice quién la causó, en vez de cargársela al diálogo por estar cerca.
  advertencias.push(
    `La caja de vértices ha pasado de ${arranque.altoCajaVerticesPx} a ` +
      `${modal.altoCajaVerticesConElDialogoAbierto} px al abrir el diálogo. El diálogo es un modal y ` +
      'cuelga del `<body>`: no puede quitarle altura al panel. Mira si ha entrado una tarjeta de ' +
      `aviso (había ${arranque.tarjetasDeAvisos}, hay ${tarjetasDeAvisos()}).`,
  )
}

const guardado = { medido: false }
if (botonGuardar !== null && campoNombre !== null && !botonGuardar.disabled) {
  guardado.medido = true
  campoNombre.value = MARCA
  const antes = $$('dialog.gml-dialogo-expediente [data-id]').length
  botonGuardar.click()
  await esperar(
    () => $$('dialog.gml-dialogo-expediente [data-id]').length > antes || filaConLaMarca() !== null,
    8000,
    'que el expediente se guarde y aparezca en la lista',
  )
  await new Promise((r) => setTimeout(r, 300))

  const fila = filaConLaMarca()
  guardado.apareceEnLaLista = fila !== null
  guardado.fila = fila === null ? null : fila.textContent.replace(/\s+/g, ' ').trim().slice(0, 160)
  guardado.idEnElDom = fila === null ? null : fila.dataset.id
  guardado.acuse = renglonDialogo === null ? null : renglonDialogo.textContent.trim()
  // ⭐ El acuse tiene que DECIR lo que el navegador ha contestado sobre la
  // durabilidad. La ficha de la feature prometía que `persist()` «evita el
  // desalojo» y está medido que devuelve `false`: prometer conservación que no se
  // tiene sería exactamente el error silencioso que la regla de oro 1 prohíbe.
  guardado.acuseDiceQueNoHayGarantia =
    guardado.acuse === null ? null : /no garantiza/i.test(guardado.acuse)

  if (!guardado.apareceEnLaLista) {
    problemas.push(
      'Se ha pulsado «Guardar» y el expediente NO ha aparecido en la lista. Renglón del diálogo: ' +
        JSON.stringify(guardado.acuse),
    )
  }
  if (
    almacenamiento.persisted === false &&
    guardado.acuseDiceQueNoHayGarantia === false
  ) {
    problemas.push(
      'El navegador NO garantiza conservar los datos (`persisted() === false`) y el acuse de guardado ' +
        'no lo dice: ' +
        JSON.stringify(guardado.acuse) +
        '. La ficha de F10 prometía que `persist()` evita el desalojo y está medido que no; ' +
        'prometer una durabilidad que no se tiene es un error silencioso (regla de oro 1).',
    )
  }
} else {
  problemas.push(
    'El botón «Guardar» del diálogo está apagado con la parcela de demostración en pantalla: ' +
      `motivo escrito = ${JSON.stringify(renglonDialogo === null ? null : renglonDialogo.textContent.trim())}.`,
  )
}

// ── 5 · ⭐ SEGUNDA CONEXIÓN: los bytes están en una base de verdad ──────────
//
// Se abre `indexedDB` **aparte**, sin pasar por `storage/bd.js` —que memoiza su
// conexión y devolvería la misma—, y se lee el registro de ahí. Es lo que
// distingue «guardado» de «guardado en una variable de módulo», y `fake-indexeddb`
// no puede probarlo ni fingirlo.

const enDisco = await leerDeDisco()
enDisco.laMarcaEstaEnDisco = (enDisco.marcados || []).length > 0
enDisco.registroMarcado = (enDisco.marcados || [])[0] ?? null

if (enDisco.medido && !enDisco.tieneExpedientes) {
  problemas.push(
    `La base de este navegador no tiene el almacén «expedientes» (tiene ${JSON.stringify(enDisco.almacenes)}): ` +
      'la migración de la versión 3 no se ha aplicado.',
  )
}
if (enDisco.medido && enDisco.tieneExpedientes && (enDisco.indices || []).length === 0) {
  problemas.push(
    'El almacén «expedientes» existe pero NO tiene índices: `getAllFromIndex` sobre `actualizado` ' +
      'daría `NotFoundError` y la lista saldría vacía sin que nada lo explicara.',
  )
}
if (guardado.medido && guardado.apareceEnLaLista && enDisco.medido && !enDisco.laMarcaEstaEnDisco) {
  problemas.push(
    'El expediente aparece en la lista de la interfaz pero NO está en la base leída por una segunda ' +
      'conexión: lo que se está enseñando no se ha escrito en IndexedDB.',
  )
}
if (enDisco.registroMarcado && enDisco.registroMarcado.oficialCongeladaEnCrudo === true) {
  advertencias.push(
    'La geometría oficial viene CONGELADA del registro crudo. Estaba medido que el clonado ' +
      'estructural no preserva `Object.freeze`; si ha cambiado, la rehidratación por ' +
      '`crearExpediente` sigue siendo correcta pero su justificación escrita ya no lo es.',
  )
}

// ── 6 · Las TRES exportaciones, con sus bytes ───────────────────────────────
//
// Mismo patrón de captura que `06`, `10` y `11` (GUION.md §12) y con la misma
// promesa: los envoltorios se restauran en un `finally` y el veredicto lo DECLARA.

const exportaciones = { medido: false }
if (dialogoEl.open) {
  exportaciones.medido = true

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

  const ACCIONES = [
    ['exportar-dxf', 'dxf'],
    ['exportar-coordenadas', 'coordenadas'],
    ['exportar-proyecto', 'proyecto'],
  ]
  const renglones = {}
  let excepcionAlExportar = null
  try {
    for (const [accion, clave] of ACCIONES) {
      const boton = dialogoEl.querySelector(`[data-accion="${accion}"]`)
      if (boton === null || boton.disabled) {
        problemas.push(`El botón «${accion}» no está o está apagado en el diálogo.`)
        continue
      }
      const antes = blobs.length
      boton.click()
      await esperar(() => blobs.length > antes, 6000, `que baje el fichero de «${accion}»`, 100)
      renglones[clave] = renglonDialogo === null ? null : renglonDialogo.textContent.trim()
    }
    await new Promise((r) => setTimeout(r, 300))
  } catch (error) {
    excepcionAlExportar = `${error.name}: ${error.message}`
  } finally {
    URL.createObjectURL = crearUrlOriginal
    URL.revokeObjectURL = revocarUrlOriginal
    if (teniaCreateElementPropio) document.createElement = crearElementoOriginal
    else delete document.createElement
  }

  exportaciones.restaurado =
    URL.createObjectURL === crearUrlOriginal &&
    URL.revokeObjectURL === revocarUrlOriginal &&
    document.createElement === crearElementoOriginal
  exportaciones.excepcion = excepcionAlExportar
  exportaciones.blobsCapturados = blobs.length
  exportaciones.revocaLasQueCrea =
    hrefsCreados.length === hrefsRevocados.length &&
    hrefsCreados.every((h, i) => h === hrefsRevocados[i])
  exportaciones.nombres = anclas
    .filter((a) => typeof a.download === 'string' && a.download.length > 0)
    .map((a) => a.download)
  exportaciones.renglones = renglones

  if (!exportaciones.restaurado) {
    problemas.push(
      'El guion NO ha restaurado los envoltorios de `URL.createObjectURL` / `URL.revokeObjectURL` / ' +
        '`document.createElement`: cualquier medida posterior de esta sesión es sospechosa.',
    )
  }
  if (exportaciones.blobsCapturados !== 3) {
    problemas.push(
      `Se esperaban 3 descargas (DXF, coordenadas y proyecto) y ha habido ${exportaciones.blobsCapturados}. ` +
        `Renglones: ${JSON.stringify(renglones)}.`,
    )
  }
  if (exportaciones.blobsCapturados > 0 && !exportaciones.revocaLasQueCrea) {
    problemas.push(
      'Alguna URL de objeto creada no se ha revocado, o se ha revocado otra: es una fuga de memoria ' +
        'que crece con cada exportación.',
    )
  }

  // Los BYTES, uno a uno. Se leen de los Blobs capturados, que sobreviven a la
  // revocación de su URL.
  const leidos = []
  for (const b of blobs) leidos.push({ tipo: b.type, bytes: b.size, texto: await b.text() })

  const porExtension = (ext) =>
    exportaciones.nombres.findIndex((n) => n.toLowerCase().endsWith(ext))

  const iDxf = porExtension('.dxf')
  const iTxt = porExtension('.txt')
  const iJson = porExtension('.json')

  exportaciones.dxf =
    iDxf < 0 || leidos[iDxf] === undefined
      ? null
      : {
          nombre: exportaciones.nombres[iDxf],
          tipo: leidos[iDxf].tipo,
          bytes: leidos[iDxf].bytes,
          // ⭐ La cabecera del formato. El guion NO escribe 'AC1015' a mano en un
          // `expect`: lo busca en la variable `$ACADVER` del propio fichero, que es
          // donde el CAD la lee.
          acadver: (() => {
            const p = paresDxf(leidos[iDxf].texto)
            const i = p.findIndex(([c, v]) => c === '9' && v.trim() === '$ACADVER')
            return i < 0 || p[i + 1] === undefined ? null : p[i + 1][1].trim()
          })(),
          capasEnLaTabla: capasDeLaTabla(leidos[iDxf].texto),
          crlf: leidos[iDxf].texto.includes('\r\n'),
          lfSueltos: leidos[iDxf].texto.replace(/\r\n/g, '').includes('\n'),
        }
  exportaciones.coordenadas =
    iTxt < 0 || leidos[iTxt] === undefined
      ? null
      : {
          nombre: exportaciones.nombres[iTxt],
          tipo: leidos[iTxt].tipo,
          bytes: leidos[iTxt].bytes,
          // Coma decimal española: el defecto de F09 fue justo el contrario.
          comaDecimal: /\d,\d/.test(leidos[iTxt].texto),
          puntoIngles: /\d+\.\d{2}\s*m²/.test(leidos[iTxt].texto),
          primeraLinea: leidos[iTxt].texto.split('\n')[1] ?? null,
        }
  exportaciones.proyecto =
    iJson < 0 || leidos[iJson] === undefined
      ? null
      : (() => {
          let leido = null
          let error = null
          try {
            leido = JSON.parse(leidos[iJson].texto)
          } catch (e) {
            error = `${e.name}: ${e.message}`
          }
          return {
            nombre: exportaciones.nombres[iJson],
            tipo: leidos[iJson].tipo,
            bytes: leidos[iJson].bytes,
            error,
            formato: leido === null ? null : leido.formato,
            version: leido === null ? null : leido.version,
            srs: leido === null ? null : leido.expediente?.srs ?? null,
            vertices: leido === null ? null : leido.expediente?.parcela?.recintos?.[0]?.vertices?.length ?? null,
          }
        })()

  if (exportaciones.dxf !== null) {
    if (exportaciones.dxf.bytes === 0) problemas.push('El DXF ha bajado con 0 bytes.')
    if (exportaciones.dxf.acadver !== 'AC1015') {
      problemas.push(
        `El DXF declara $ACADVER ${JSON.stringify(exportaciones.dxf.acadver)} y no AC1015 (R2000): ` +
          'medido en la fase 0 con `ezdxf`, `LWPOLYLINE` no es válido por debajo de R14.',
      )
    }
    if (exportaciones.dxf.capasEnLaTabla.length < 2) {
      problemas.push(
        `El DXF trae ${exportaciones.dxf.capasEnLaTabla.length} capa(s) en su TABLA LAYER y el ` +
          'criterio 3 pide DOS separadas. ⚠️ Sin la sección TABLES el auditor de ezdxf da 0 errores ' +
          'y las capas NO EXISTEN: por eso se mira la tabla y no los nombres de las entidades.',
      )
    }
    if (exportaciones.dxf.lfSueltos) {
      problemas.push('El DXF lleva LF sueltos: está medio convertido y los tres DXF reales son CRLF.')
    }
  }
  if (exportaciones.coordenadas !== null) {
    if (exportaciones.coordenadas.bytes === 0) problemas.push('El listado ha bajado con 0 bytes.')
    if (exportaciones.coordenadas.puntoIngles) {
      problemas.push(
        'El listado de coordenadas lleva un decimal con PUNTO inglés en las medidas: es exactamente ' +
          'el defecto que F09 se comió en el PDF, y un equipo de campo que teclee con el separador ' +
          'equivocado replantea en el sitio equivocado.',
      )
    }
  }
  if (exportaciones.proyecto !== null) {
    if (exportaciones.proyecto.error !== null) {
      problemas.push(`El fichero de proyecto no es JSON válido: ${exportaciones.proyecto.error}.`)
    }
    if (exportaciones.proyecto.formato !== 'concreta-gml/proyecto') {
      problemas.push(
        `El fichero de proyecto declara formato ${JSON.stringify(exportaciones.proyecto.formato)}: ` +
          'sin el sobre, `deProyecto` no lo reconocería al volver a abrirlo.',
      )
    }
    if (exportaciones.proyecto.vertices !== 15) {
      problemas.push(
        `El fichero de proyecto lleva ${exportaciones.proyecto.vertices} vértices y la parcela de ` +
          'arranque tiene 15: se ha perdido geometría por el camino.',
      )
    }
  }
}

// ── 7 · ⭐ Que exportar no se lleve nada por delante (CUARTA aparición) ─────

const nadaSeCerroPorDebajo = {
  queEs:
    'F08: el `click()` del `<a download>` cerraba el cajón de diagnóstico. F09/T5.1: los clics ' +
    'DENTRO del `<dialog>` hacían lo mismo. F10 estrena un segundo diálogo y tres botones que ' +
    'descargan: se mide, no se supone.',
  dialogoSigueAbierto: dialogoEl.open,
  esModalTrasExportar: typeof dialogoEl.matches === 'function' ? dialogoEl.matches(':modal') : null,
  focoSigueDentro: dialogoEl.contains(document.activeElement),
}
if (!nadaSeCerroPorDebajo.dialogoSigueAbierto) {
  problemas.push(
    'El diálogo «Expediente» se ha CERRADO SOLO al exportar. Es la cuarta aparición de la familia: ' +
      'el `click()` del `<a download>` burbujea hasta `document` y algún guardián de clic-fuera lo ' +
      'toma por un clic fuera. Mira `gml/descargar.js` (stopPropagation en CAPTURA) y ' +
      '`viewer/cajon-diagnostico.js` (pregunta por el ELEMENTO `dialog`, no por su atributo `open`).',
  )
}

// ── 8 · Tipografía de los botones nuevos ────────────────────────────────────
//
// La expectativa se DERIVA del token del `:root`, no se copia. Es el defecto que
// destapó el guion `10`: un estilo en línea gana a la hoja y en jsdom no hay
// cascada que lo delate.

const tokenSans = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
const primeraFamilia = (v) =>
  (v || '')
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
const esperada = primeraFamilia(tokenSans)

const tipografia = { token: tokenSans, esperada, botones: [] }
const dianasTipograficas = [
  ['«Expediente» (fila del rótulo)', botonExpediente],
  ['«Guardar» (diálogo)', dialogoEl.querySelector('[data-accion="guardar-expediente"]')],
  ['«Exportar DXF» (diálogo)', dialogoEl.querySelector('[data-accion="exportar-dxf"]')],
  ['«Abrir un proyecto…» (diálogo)', dialogoEl.querySelector('[data-accion="abrir-proyecto"]')],
]
for (const [queEs, el] of dianasTipograficas) {
  if (el === null) continue
  const familia = primeraFamilia(getComputedStyle(el).fontFamily)
  const estiloEnLinea = el.getAttribute('style') || ''
  tipografia.botones.push({ queEs, familia, estiloEnLinea: estiloEnLinea || null })
  if (esperada !== '' && familia !== esperada) {
    problemas.push(
      `El botón ${queEs} se pinta con «${familia}» y el token --font-sans dice «${esperada}». ` +
        'Un `font` en línea gana a la hoja y deja la regla de `estilos/app.css` puesta y muerta.',
    )
  }
  if (/font/i.test(estiloEnLinea)) {
    problemas.push(
      `El botón ${queEs} lleva tipografía en un estilo EN LÍNEA (${JSON.stringify(estiloEnLinea)}): ` +
        'gana a la hoja siempre, sin mirar la especificidad.',
    )
  }
}

// ── 9 · `Escape` cierra, y el foco vuelve ──────────────────────────────────

const cierre = { medido: false }
if (dialogoEl.open) {
  cierre.medido = true
  pulsarEscape()
  await esperar(() => !dialogoEl.open, 3000, 'que `Escape` cierre el diálogo')
  cierre.cerradoConEscape = !dialogoEl.open
  cierre.displayTrasCerrar = getComputedStyle(dialogoEl).display
  cierre.focoVuelveAlBoton = document.activeElement === botonExpediente
  if (!cierre.cerradoConEscape) {
    problemas.push('`Escape` no ha cerrado el diálogo «Expediente».')
  }
  if (cierre.cerradoConEscape && cierre.displayTrasCerrar !== 'none') {
    problemas.push(
      `El diálogo cerrado computa display:${cierre.displayTrasCerrar} y debería ser «none». Es la ` +
        'trampa que avisa la sección CSS: una regla `display` sobre el `<dialog>` gana a la hoja del ' +
        'navegador SIEMPRE y lo deja plantado sobre la aplicación.',
    )
  }
  if (!cierre.focoVuelveAlBoton) {
    advertencias.push(
      'Al cerrar con `Escape` el foco no ha vuelto al botón «Expediente»: quien navega con teclado ' +
        'aterriza al principio del documento.',
    )
  }
}

// ── 10 · Limpieza: se deja UNA marca y nada más ─────────────────────────────
//
// Los expedientes que este guion crea son basura en el perfil de quien lo lanza,
// salvo UNO: la marca que la corrida siguiente necesita heredar. Si había una
// heredada, se borra la vieja y se queda la nueva — o la lista crecería una fila
// por corrida.

const limpieza = { intentado: false }
if (guardado.medido && guardado.apareceEnLaLista && (enDisco.marcados || []).length > 1) {
  limpieza.intentado = true
  botonExpediente.click()
  await esperar(() => dialogoEl.open, 3000, 'que se reabra el diálogo para limpiar')
  await new Promise((r) => setTimeout(r, 400))

  const conLaMarca = $$('dialog.gml-dialogo-expediente [data-id]').filter((f) =>
    f.textContent.includes(MARCA),
  )
  limpieza.marcasEncontradas = conLaMarca.length
  // Se borran todas menos la ÚLTIMA de la lista, que por el orden del índice es la
  // más antigua; la más reciente (la primera) es la que se hereda.
  const sobrantes = conLaMarca.slice(1)
  for (const fila of sobrantes) {
    const boton = fila.querySelector('[data-accion="borrar-expediente"]')
    if (boton === null) continue
    // Dos clics: el borrado es en dos tiempos a propósito (es irreversible y el
    // diálogo no tiene pantalla de confirmación).
    boton.click()
    await new Promise((r) => setTimeout(r, 120))
    const otraVez = $$('dialog.gml-dialogo-expediente [data-id]')
      .find((f) => f.dataset.id === fila.dataset.id)
      ?.querySelector('[data-accion="borrar-expediente"]')
    if (otraVez) otraVez.click()
    await new Promise((r) => setTimeout(r, 250))
  }
  limpieza.marcasTrasLimpiar = $$('dialog.gml-dialogo-expediente [data-id]').filter((f) =>
    f.textContent.includes(MARCA),
  ).length
  if (dialogoEl.open) {
    pulsarEscape()
    await esperar(() => !dialogoEl.open, 2000, 'que se cierre el diálogo tras limpiar')
  }
}

// ── Veredicto ───────────────────────────────────────────────────────────────

window.removeEventListener('error', alError)
window.removeEventListener('unhandledrejection', alRechazo)

if (excepciones.length > 0) {
  problemas.push(`Excepciones no capturadas durante el recorrido: ${JSON.stringify(excepciones)}.`)
}
if (agotado()) {
  advertencias.push(`El guion ha tardado más de ${TOPE_TOTAL_MS} ms: alguna espera se ha ido de plazo.`)
}

noCubierto.push(
  'CERRAR EL NAVEGADOR ENTERO (no la pestaña) y volver: es donde de verdad se ve si el perfil ' +
    'conserva o desaloja. Checklist humano §11.1.',
  'ABRIR EL DXF EN UN CAD con las dos capas seleccionables POR CAPA. Este guion afirma sobre sus ' +
    'bytes ($ACADVER, capas en la TABLA); que AutoCAD lo abra no lo puede firmar ninguna máquina ' +
    'de este proyecto. Punto BLOQUEANTE del checklist §11.4.',
  'DOS PESTAÑAS A LA VEZ y el `versionchange` de verdad. Checklist §11.2.',
  'ABRIR UN `.json` DESDE EL DISCO: el selector de ficheros del sistema no se conduce desde aquí. ' +
    'Checklist §11.5.',
  'SI ALGUNA FRASE DE LA LISTA SE LEE COMO UN VEREDICTO. Este guion publica textos, no los juzga ' +
    '(regla de oro 9). Punto BLOQUEANTE del checklist §11.6.',
)

return {
  guion: '12-expedientes',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0, 0),
  problemas,
  advertencias,
  noCubierto,
  arranque,
  almacenamiento,
  herencia,
  guardado,
  enDisco,
  modal,
  exportaciones,
  nadaSeCerroPorDebajo,
  tipografia,
  cierre,
  limpieza,
  estadoFinal: {
    queDeja:
      `UN expediente marcado «${MARCA}» en IndexedDB, a propósito: es lo que la corrida siguiente ` +
      'hereda para poder medir la supervivencia a la recarga. Todo lo demás que este guion haya ' +
      'creado se borra en el §10.',
    dialogoAbierto: dialogoEl.open,
    tarjetasDeAvisos: tarjetasDeAvisos(),
    altoCajaVerticesPx: altoCajaVertices(),
    comoDejarLoLimpio:
      "$B js 'await null; await new Promise(r => { const p = indexedDB.deleteDatabase(\"concreta-gml\"); " +
      "p.onsuccess = p.onerror = p.onblocked = r }); return \"borrada\"'",
  },
}
