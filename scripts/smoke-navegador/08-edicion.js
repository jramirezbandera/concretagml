// scripts/smoke-navegador/08-edicion.js — F06 · Tarea T6.2.
//
// ── QUÉ MIDE ────────────────────────────────────────────────────────────────
// La EDICIÓN de F06 en un navegador de verdad, y solo lo que ahí se puede medir:
// layout real, `getBoundingClientRect` real, proyección real, `L.Draggable` real,
// hit-testing real y píxeles reales. La suite (2.894 pruebas) ya cubre la
// geometría —que `desplazarLado` recalcule los contiguos, que `ajustar` priorice
// el vértice, que `insertarVertice` proyecte sobre el lado—; **aquí no se vuelve a
// medir nada de eso**. Se miden las seis cosas que jsdom no puede dar:
//
//   1. **El SNAP con `L.Draggable` de verdad** (criterio 2). Tres arrastres sobre
//      el vértice 1 del EXTERIOR:
//        · **A** — enganche a VÉRTICE: se arrastra menos que τ y la coordenada que
//          acaba en la tabla es la del vértice OFICIAL, no la del puntero. El
//          marcador VUELVE a su píxel de partida aunque el puntero acabe a 20 px:
//          eso es `colocar(..., enganchado)` haciendo `setLatLng` de verdad.
//        · **B** — enganche a LINDERO: se lleva el vértice 5 m a lo largo de su
//          propio lindero oficial y 1 m perpendicular. La coordenada que se
//          commitea tiene que quedar SOBRE la recta del lindero (producto vectorial
//          ≈ 0), a ~1 m del puntero. Es la proyección punto→segmento de la spec,
//          medida sobre una proyección cartográfica real.
//        · **C** — con `Alt` en el evento sintético: NO engancha, la coordenada es
//          la del puntero (± 2 cm de la escala medida) y no aparece indicador.
//      Y el INDICADOR (`.gml-snap--vertice` / `.gml-snap--lindero`) se cuenta
//      fotograma a fotograma: presente mientras dura el gesto, ausente al soltar.
//   2. **Las cotas contra el zoom REAL** (`viewer/acotaciones.js`). El filtro es
//      por PÍXELES (`OPERATIVOS.acotacionMinimaPx` = 44), así que en jsdom —sin
//      layout— no significa nada. Se cuentan los rótulos `.gml-acotacion` VISIBLES
//      a tres escalas medidas (Z−2, Z, Z+2) y se exige que el número crezca al
//      acercar y decrezca al alejar, y que VUELVA al mismo número al deshacer el
//      zoom.
//   3. **El offset sobre la pantalla** (criterio 3). Se selecciona un lindero con
//      un clic en el punto medio REAL entre dos marcadores, se teclea la distancia
//      y se pulsa: el `d` del `<path>` cambia y la superficie de la ficha se mueve.
//   4. **Insertar y eliminar con los gestos del mapa** (criterio 1). Doble clic
//      sobre un lindero → una fila más; clic derecho sobre el vértice nuevo → una
//      menos, y el anillo vuelve a ser EXACTAMENTE el de antes (el vértice
//      insertado cae sobre el lado, así que quitarlo es reversible). Se comprueba
//      además que los dos gestos llaman a `preventDefault` —ni menú contextual del
//      navegador ni zoom por doble clic— y que la ESCALA del mapa no ha cambiado.
//   5. **Undo / redo, incluida la INHIBICIÓN** (criterio 5). `Ctrl+Z` con el foco
//      en el mapa deshace y consume la tecla (`defaultPrevented: true`); `Ctrl+Z`
//      con el foco en una celda de coordenada NO deshace y NO consume la tecla
//      (`defaultPrevented: false`), que es la única señal observable de que el
//      atajo se ha dejado para el navegador.
//   6. **Las métricas EN VIVO durante el gesto** (criterio 4): superficie y
//      perímetro leídos de la ficha en CADA fotograma de `drag`, ANTES del
//      `mouseup`. Y al soltar se contrastan las dos cifras de la ficha contra un
//      shoelace y una suma de lados calculados AQUÍ sobre lo que hay en la tabla:
//      segunda implementación independiente de `geo/area.js` y `geo/metrica.js`,
//      igual que hace `06-generar-gml.js` con el `areaValue`.
//
// Y dos hit-tests REALES con `document.elementFromPoint`, que es lo más cerca que
// se puede estar de un puntero sin tenerlo: sobre el centro de un vértice tiene
// que responder el icono del marcador, y sobre el punto medio de un lado tiene que
// responder el `<path>` del polígono y **no la cota** (que va `interactive:false`
// y `pointer-events:none` justo para eso). En jsdom esto no existe.
//
// ── QUÉ **NO** PUEDE MEDIR — LÉELO ANTES DE CITAR ESTE GUION ────────────────
//
//   · **NO es un gesto de ratón.** Igual que `03-arrastre.js`: `/browse` no tiene
//     comando `drag` y su allowlist CDP es *deny-default* sin el dominio `Input`,
//     así que los eventos son SINTÉTICOS. Disparan `L.Draggable` porque Leaflet no
//     comprueba `isTrusted`, y por tanto esto prueba la maquinaria real, el layout
//     real y la proyección real; **no prueba** que el ratón de una persona llegue
//     al vértice: ergonomía del área de agarre (10 px), cursor, precisión exigida y
//     descubribilidad son el CHECKLIST HUMANO (§7). El veredicto lo dice en
//     `esGestoDeRatonReal: false`.
//   · **NO mide τ = 20 cm, que es el valor de producción.** A la escala de arranque
//     (≈ 16 px/m, medida) 20 cm son ~3,2 px, y `MouseEvent.clientX` es un ENTERO:
//     la resolución del gesto (1 px ≈ 6 cm) es un tercio de la tolerancia, así que
//     «enganchó» y «no enganchó» no se distinguirían de un redondeo. El guion
//     teclea 300 cm en `[data-campo="snap-tolerancia"]` —lo que además ejercita en
//     un navegador la conversión cm→m del campo, que es contrato de F06— y
//     **restaura 20 cm al terminar** (`restaurado.toleranciaCm`). τ es un parámetro
//     del MISMO camino de código; lo que el navegador aporta —`L.Draggable`, el
//     re-ajuste del `dragend`, el indicador, la tecla— no depende de su valor. El
//     ajuste fino de τ es de `test/edit/snap.test.js`.
//   · **NO toca ningún servicio de datos del Catastro.** Trabaja con la parcela de
//     demostración que ya trae la app, cuya `geometriaOficial` es lo que hace
//     medible el enganche (ver abajo). El **snap a COLINDANTES queda declarado como
//     NO CUBIERTO**: traerlas cuesta una petición al WFS y el régimen de uso del
//     override O8 manda (ver `GUION.md` §13). Lo único que sale a la red aquí es la
//     cartografía de fondo, que se repide sola al hacer zoom —igual que en `01`,
//     `02` y `05`—; no hay ni una llamada a `wfsCP.aspx` ni a `Consulta_RCCOOR`.
//   · **NO mide el Δ CATASTRAL en movimiento.** El criterio 4 lo nombra, pero la
//     parcela de demostración no trae `superficieCatastral` (solo la trae una
//     parcela venida de F05), así que el `<dd data-ficha="delta-catastral">` dice
//     «No hay con qué comparar» durante todo el guion. Se PUBLICA lo que dice y se
//     deja en `advertencias`: fabricar aquí una superficie declarada sería medir un
//     dato inventado. Δ en vivo se cubre en la suite y, con dato real, en el
//     checklist humano.
//   · **NO mide el fallback de paralelismo del offset** (bisel / miter-limit, la
//     segunda mitad del criterio 3): exige un ángulo agudo que la parcela de
//     demostración no tiene, y fabricarlo aquí sería reimplementar `edit/offset.js`
//     dentro del guion. Es de `test/edit/offset.test.js`.
//   · **NO mide la consola.** El buffer vive en el demonio de `browse`, no en la
//     página: `$B console --errors` (`GUION.md` §6).
//   · **NO mide el teclado físico.** `Alt` va como propiedad del evento sintético;
//     que el sistema operativo o el navegador se la queden (en Windows `Alt` abre
//     la barra de menús en algunos navegadores) es el punto 7.2 del checklist, y es
//     la decisión de la fase: si falla, hay que saberlo.
//
// ── POR QUÉ EL ENGANCHE ES MEDIBLE AQUÍ, Y NO ES UN TRUCO ───────────────────
// `app/demo-datos.js#parcelaDemo` carga la MISMA geometría en `recintos` y en
// `geometriaOficial` — que es el estado real de una parcela recién traída del
// Catastro. Y `edit/snap.js#dianasDe` documenta que **`excluir` NO se aplica a
// `geometriaOficial`**: el vértice oficial sigue siendo diana legítima aunque se
// esté arrastrando su gemelo editable. La consecuencia —«un desplazamiento menor
// que τ vuelve al sitio»— la declara el propio módulo como lo que el snap
// SIGNIFICA. Este guion la usa como banco de pruebas: da un desenlace binario y
// sin ambigüedad (la coordenada final es la oficial, o es la del puntero) sin
// necesidad de traer ni una parcela vecina.
//
// ── DETALLES QUE HAY QUE ACERTAR O EL GESTO NO OCURRE ───────────────────────
// Los cinco de `L.Draggable` están en la cabecera de `03-arrastre.js` y en
// `GUION.md` §10, y este guion los repite tal cual (`mousedown` en el icono con
// `button: 0`; `mousemove`/`mouseup` sobre `document.body` y NUNCA sobre
// `document`; primer paso por encima del `clickTolerance` de 3 px; `mouseup` de
// saneamiento al empezar). Los cuatro propios de F06:
//   · **`Alt` se lee por DOS caminos** (`viewer/edicion.js`): del evento real
//     cuando lo hay y de un seguimiento propio de `keydown`/`keyup` cuando no. El
//     `dragend` de Leaflet **no lleva `originalEvent`** (`finishDrag` dispara
//     `{noInertia, distance}`), así que la decisión de enganche AL SOLTAR sale del
//     seguimiento. Funciona porque los `mousemove` con `altKey:true` RESINCRONIZAN
//     la bandera. Por eso el guion suelta un `keyup` sin `altKey` después: sin él,
//     la bandera se quedaría alta y los gestos siguientes no engancharían.
//   · **Un clic del mapa NO se dispara sobre el contenedor**, sino sobre lo que
//     haya bajo el punto (`document.elementFromPoint`): así el gesto respeta
//     `pointer-events` y el hit-test es real. Leaflet lo recoge igual: su listener
//     está en el contenedor y el evento burbujea.
//   · **El `<path>` del polígono editado NO es el único de su pane**: el resalte
//     del lado (`.gml-lado-seleccionado`) y el indicador de enganche (`.gml-snap`)
//     comparten `parcelaEditada`. De ahí {@link caminoParcela}, que los excluye por
//     clase. `03-arrastre.js` usa `path` a secas porque en F03 no existían.
//   · **El zoom no se puede leer del DOM**, así que se MIDE: la escala en px/m sale
//     de la distancia en pantalla entre dos marcadores contra su distancia en UTM
//     leída de la tabla. Esa misma escala es la que convierte píxeles en metros en
//     todo el guion, y se recalcula después de cada cambio de vista.
//
// ── ESTADO EN QUE DEJA LA APP ───────────────────────────────────────────────
// La geometría queda MODIFICADA a propósito (un lindero desplazado 0,50 m), como
// en `03-arrastre.js`, para que la evidencia se vea en una captura. Lo que SÍ se
// restaura, porque envenenaría cualquier medida posterior: la **tolerancia a 20
// cm**, el **zoom al de arranque** y la **bandera de `Alt`**. El veredicto lo
// declara en `restaurado`. Para repetirlo: `$B reload && $B wait ".gml-tabla-vertices"`.
// NO lo encadenes antes de `06-generar-gml.js` (contrasta el `areaValue` contra el
// dataset de arranque) ni de `02-wms-encuadre.js` (el zoom le contamina la cuenta).
//
// ── NOTAS DE EJECUCIÓN ──────────────────────────────────────────────────────
//   · `$B eval scripts/smoke-navegador/08-edicion.js`, con la PÁGINA RECIÉN
//     CARGADA y sobre la parcela REAL (sin `?demo=`). Con `?demo=hueco` sale
//     `ok:false` diciendo por qué: ese dataset no tiene `geometriaOficial` y sin
//     ella no hay nada a lo que enganchar.
//   · `browse` envuelve el fichero en `(async()=>{ … })()` PORQUE contiene `await`
//     real; de ahí que el `return` de nivel superior sea legal. No lo quites.
//   · No hay `import`: `page.evaluate` no resuelve módulos. Los helpers están
//     duplicados entre guiones A PROPÓSITO.

// ── Contrato con la cáscara (copias deliberadas de `app/main.js`) ────────────
//
// ⚠️ **Desde el 2026-07-29 estos siete nodos NO están en `index.html`**: los
// fabrica `viewer/barra-edicion.js`, la barra flotante que `crearVisor` monta
// sobre el mapa. Los SELECTORES no han cambiado —ese era el objetivo del
// traslado—, así que este guion sigue conduciendo la edición sin tocar nada; lo
// que cambió es de dónde salen los nodos. Ni siquiera hay que abrir los
// desplegables para escribir en la tolerancia o en la distancia: los campos
// existen siempre en el DOM y solo se ocultan con `hidden` (invariante declarado
// en la cabecera de ese módulo, y con test).

/** Copias de `SELECTOR_BOTON_DESHACER` … `SELECTOR_ESTADO_EDICION`. */
const SEL = Object.freeze({
  DESHACER: '[data-accion="deshacer"]',
  REHACER: '[data-accion="rehacer"]',
  SNAP: '[data-campo="snap"]',
  TOLERANCIA: '[data-campo="snap-tolerancia"]',
  OFFSET_DISTANCIA: '[data-campo="offset-distancia"]',
  OFFSET: '[data-accion="offset"]',
  ESTADO: '[data-estado="edicion"]',
})

/** Clase del rótulo de cota (`viewer/acotaciones.js#CLASE_ACOTACION`). */
const CLASE_ACOTACION = 'gml-acotacion'

/** Clases de `viewer/edicion.js#CLASE_EDICION`. Copia deliberada. */
const CLASE_SNAP = 'gml-snap'
const CLASE_SNAP_VERTICE = 'gml-snap--vertice'
const CLASE_SNAP_LINDERO = 'gml-snap--lindero'
const CLASE_RESALTE = 'gml-lado-seleccionado'

/** Rótulo del recinto 0 en `viewer/sincronizacion.js#rotuloRecinto`. */
const ROTULO_RECINTO = 'EXTERIOR'

/** `OPERATIVOS.acotacionMinimaPx`: longitud mínima en pantalla de una cota. */
const ACOTACION_MINIMA_PX = 44

/**
 * `OPERATIVOS.snapMetros` (0,2 m) tal como nace el campo, en cm. Desde el
 * 2026-07-29 ese valor inicial ya no es un `20` escrito a mano en `index.html`:
 * `viewer/barra-edicion.js` lo DERIVA de `OPERATIVOS.snapMetros`, así que campo y
 * tolerancia operativa coinciden por construcción y no por disciplina.
 */
const TOLERANCIA_ARRANQUE_CM = 20

/** τ con la que se mide el enganche. Ver «QUÉ NO PUEDE MEDIR». */
const TOLERANCIA_MEDIDA_CM = 300

/** Desenlaces del historial (`app/main.js#MENSAJE_DESHECHO` / `MENSAJE_REHECHO`). */
const MENSAJE_DESHECHO = 'Deshecha la última operación.'
const MENSAJE_REHECHO = 'Rehecha la operación siguiente.'

/** Lo que el dataset REAL de `app/demo-datos.js` trae al arrancar. */
const ARRANQUE = Object.freeze({ vertices: 15, superficieM2: 1535.87 })

/** Distancia del offset, en metros (la que se teclea en el campo). */
const OFFSET_M = 0.5

/**
 * Holgura al contrastar las cifras de la ficha contra las cuentas de este guion.
 *
 * No es «por si acaso»: la ficha mide sobre el MODELO (precisión completa) y este
 * guion mide sobre lo que hay ESCRITO EN LA TABLA, que va redondeado para leerse.
 * Sobre un anillo de 15 vértices, medio milímetro por coordenada se acumula en un
 * par de centésimas de m². Lo que esta comprobación busca no es el último decimal:
 * es que la ficha y la lista de vértices no estén contando cosas distintas.
 */
const TOLERANCIA_COHERENCIA = 0.05

/** Presupuesto de tiempo. `browse` aborta el comando a los 30 s. */
const TOPE_TOTAL_MS = 24000

/** Margen para que un cambio de vista se asiente antes de medir. */
const MS_ASENTAR_VISTA = 380

/** Margen entre fotogramas del arrastre (por encima de los 50 ms de inercia). */
const MS_ENTRE_FOTOGRAMAS = 30

/** Margen para que un `estado.set` recorra sus suscriptores y pinte. */
const MS_PROPAGAR = 180

const t0 = performance.now()

/** Lo que TUMBA el smoke. */
const problemas = []

/** Lo que hay que saber pero NO tumba el smoke (limitaciones de la medida). */
const advertencias = []

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

/** Redondeo de presentación, para no publicar 1535.8700000000001. */
const redondear = (v, n = 3) => (Number.isFinite(v) ? Number(v.toFixed(n)) : null)

const agotado = () => performance.now() - t0 > TOPE_TOTAL_MS

// ── Lectura de la pantalla ───────────────────────────────────────────────────

/** Número que muestra la ficha del pie («1.535,87 m²» → 1535.87). */
function numeroDeFicha(clave) {
  const el = document.querySelector(`[data-ficha="${clave}"]`)
  if (el === null) return null
  const crudo = el.textContent.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(crudo)
  return Number.isFinite(n) ? n : null
}

const textoDeFicha = (clave) => {
  const el = document.querySelector(`[data-ficha="${clave}"]`)
  return el === null ? null : el.textContent
}

const renglon = () => {
  const el = document.querySelector(SEL.ESTADO)
  return el === null ? null : el.textContent
}

const renglonEnError = () => {
  const el = document.querySelector(SEL.ESTADO)
  return el === null ? null : el.classList.contains('gml-accion-estado--error')
}

const filasDeTabla = () => document.querySelectorAll('#tabla-vertices tr[data-indice]').length

/** Peso del panel de avisos: tarjetas + repeticiones (`×N`). Gemelo del de `06`. */
function pesoAvisos() {
  const tarjetas = [...document.querySelectorAll('#avisos .gml-aviso')]
  return {
    tarjetas: tarjetas.length,
    peso: tarjetas.reduce((total, tarjeta) => {
      // `.gml-aviso-veces` NO existe cuando `veces === 1` (contrato de app/avisos.js).
      const veces = tarjeta.querySelector('.gml-aviso-veces')
      return total + (veces === null ? 1 : Number(veces.textContent.replace(/\D/g, '')) || 1)
    }, 0),
    textos: tarjetas.map((t) => {
      const texto = t.querySelector('.gml-aviso-texto')
      return texto === null ? null : texto.textContent.slice(0, 120)
    }),
  }
}

/** El anillo del recinto 0 tal como está EN LA TABLA (que es lo que el usuario lee). */
function anilloDeLaTabla() {
  return [...document.querySelectorAll('#tabla-vertices tr[data-recinto="0"][data-indice]')]
    .map((fila) => ({
      i: Number(fila.dataset.indice),
      x: Number(fila.querySelector('input[data-eje="x"]').value),
      y: Number(fila.querySelector('input[data-eje="y"]').value),
    }))
    .sort((a, b) => a.i - b.i)
    .map((v) => [v.x, v.y])
}

/**
 * El `<path>` del polígono EDITADO. No vale `path` a secas: el resalte del lado y
 * el indicador de enganche comparten el pane `parcelaEditada`.
 */
function caminoParcela() {
  return (
    [...document.querySelectorAll('.leaflet-parcelaEditada-pane path')].find((p) => {
      const clase = p.getAttribute('class') || ''
      return !clase.includes(CLASE_RESALTE) && !clase.includes(CLASE_SNAP)
    }) || null
  )
}

const dDelCamino = () => {
  const p = caminoParcela()
  return p === null ? null : p.getAttribute('d')
}

/** El icono del marcador del vértice `indice` (0-based) del EXTERIOR. */
function iconoDe(indice) {
  const titulo = `${ROTULO_RECINTO} · vértice ${indice + 1}`
  return [...document.querySelectorAll('.leaflet-marker-icon[title]')].find((e) => e.title === titulo) || null
}

/** Centro en píxeles de CSS de un elemento. */
function centroDe(el) {
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, lado: [Math.round(r.width), Math.round(r.height)] }
}

/** Cotas: cuántas hay en el DOM y cuántas están VISIBLES (`display` ≠ none). */
function cotas() {
  const todas = [...document.querySelectorAll(`.${CLASE_ACOTACION}`)]
  const visibles = todas.filter((e) => e.style.display !== 'none')
  return {
    enDom: todas.length,
    visibles: visibles.length,
    textos: visibles.slice(0, 3).map((e) => e.textContent),
  }
}

/** El indicador de enganche que haya AHORA, con su tipo, o `null`. */
function indicadorDeEnganche() {
  const el = document.querySelector(`.${CLASE_SNAP}`)
  if (el === null) return null
  // En un elemento SVG, `className` es un SVGAnimatedString (GUION.md §9).
  const clase = el.getAttribute('class') || ''
  return clase.includes(CLASE_SNAP_VERTICE)
    ? 'VERTICE'
    : clase.includes(CLASE_SNAP_LINDERO)
      ? 'LINDERO'
      : clase
}

// ── Geometría (segunda implementación, independiente del proyecto) ───────────

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Fórmula del polígono sobre un anillo ABIERTO. Independiente de `geo/area.js`. */
function shoelace(anillo) {
  let suma = 0
  for (let i = 0; i < anillo.length; i += 1) {
    const [x1, y1] = anillo[i]
    const [x2, y2] = anillo[(i + 1) % anillo.length]
    suma += x1 * y2 - x2 * y1
  }
  return Math.abs(suma / 2)
}

/** Perímetro euclídeo de un anillo ABIERTO. Independiente de `geo/metrica.js`. */
function perimetro(anillo) {
  let total = 0
  for (let i = 0; i < anillo.length; i += 1) total += dist(anillo[i], anillo[(i + 1) % anillo.length])
  return total
}

/** Distancia con signo de `p` a la recta `a→b`, en metros. 0 = colineal. */
function fueraDeLaRecta(p, a, b) {
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const largo = Math.hypot(ux, uy)
  if (largo === 0) return null
  return ((p[0] - a[0]) * uy - (p[1] - a[1]) * ux) / largo
}

// ── Escala: el zoom no se lee del DOM, se MIDE ──────────────────────────────

/**
 * Píxeles de pantalla por metro UTM, medidos entre dos marcadores contra sus
 * coordenadas de la tabla. Se comprueba con un SEGUNDO par: si los dos no
 * coinciden, la medida no es fiable y hay que decirlo, no promediarla.
 *
 * @returns {{pxPorMetro: number|null, contraste: number|null, coherente: boolean}}
 */
function escala() {
  const anillo = anilloDeLaTabla()
  const medir = (i, j) => {
    const a = iconoDe(i)
    const b = iconoDe(j)
    if (a === null || b === null || !anillo[i] || !anillo[j]) return null
    const ca = centroDe(a)
    const cb = centroDe(b)
    const m = dist(anillo[i], anillo[j])
    if (m === 0) return null
    return Math.hypot(ca.x - cb.x, ca.y - cb.y) / m
  }
  const principal = medir(0, 6)
  const contraste = medir(1, 13)
  const coherente =
    principal !== null && contraste !== null && Math.abs(principal - contraste) / principal < 0.02
  return { pxPorMetro: principal, contraste, coherente }
}

// ── Gestos sintéticos ────────────────────────────────────────────────────────

const BASE_RATON = { bubbles: true, cancelable: true, composed: true, view: window }

/**
 * Un evento de ratón en un PUNTO de la pantalla, despachado sobre lo que de verdad
 * hay debajo (`elementFromPoint`), no sobre el contenedor: así respeta
 * `pointer-events` y el hit-test es real. Leaflet lo recibe igual, por burbujeo.
 *
 * @returns {{destino: string|null, prevenido: boolean}}
 */
function ratonEn(tipo, punto, extra = {}) {
  const bajoElPunto = document.elementFromPoint(punto.x, punto.y)
  const destino = bajoElPunto || document.querySelector('.leaflet-container')
  if (destino === null) return { destino: null, prevenido: false }
  const evento = new MouseEvent(tipo, {
    ...BASE_RATON,
    clientX: Math.round(punto.x),
    clientY: Math.round(punto.y),
    ...extra,
  })
  destino.dispatchEvent(evento)
  return {
    destino: `${destino.tagName.toLowerCase()}${destino.getAttribute('class') ? `.${destino.getAttribute('class')}` : ''}`,
    prevenido: evento.defaultPrevented,
  }
}

/** Suelta la bandera de `Alt` del seguimiento de `viewer/edicion.js`. */
function soltarAlt() {
  document.body.dispatchEvent(
    new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Alt', altKey: false }),
  )
}

/**
 * Arrastra un vértice por eventos sintéticos y mide el gesto POR FOTOGRAMA.
 *
 * @param {number} indice  Vértice del EXTERIOR (0-based).
 * @param {{dx: number, dy: number}} gestoPx  Desplazamiento total del puntero.
 * @param {boolean} conAlt  `altKey` de los eventos (apaga el enganche).
 * @returns {Promise<object>}  Medidas del gesto (nunca lanza por un gesto fallido).
 */
async function arrastrar(indice, gestoPx, conAlt) {
  const icono = iconoDe(indice)
  if (icono === null) return { ok: false, motivo: `No hay marcador del vértice ${indice + 1}.` }

  const antes = centroDe(icono)
  const base = { ...BASE_RATON, button: 0, altKey: conAlt === true }

  // Saneamiento: `Draggable._dragging` es GLOBAL y un gesto anterior sin `mouseup`
  // dejaría mudo cualquier arrastre posterior (GUION.md §10.4).
  document.body.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }))

  icono.dispatchEvent(
    new MouseEvent('mousedown', { ...base, buttons: 1, clientX: Math.round(antes.x), clientY: Math.round(antes.y) }),
  )

  // Desplazamiento CRECIENTE: el primer paso ya supera el `clickTolerance` (3 px).
  const recorrido = [
    [6, 2],
    [Math.round(gestoPx.dx * 0.4), Math.round(gestoPx.dy * 0.4)],
    [Math.round(gestoPx.dx * 0.75), Math.round(gestoPx.dy * 0.75)],
    [gestoPx.dx, gestoPx.dy],
  ]

  const fotogramas = []
  let engancho = false
  for (const [dx, dy] of recorrido) {
    document.body.dispatchEvent(
      new MouseEvent('mousemove', {
        ...base,
        buttons: 1,
        clientX: Math.round(antes.x + dx),
        clientY: Math.round(antes.y + dy),
      }),
    )
    if (document.body.classList.contains('leaflet-dragging')) engancho = true
    fotogramas.push({
      dx,
      dy,
      indicador: indicadorDeEnganche(),
      superficie: numeroDeFicha('superficie'),
      perimetro: numeroDeFicha('perimetro'),
      x: anilloDeLaTabla()[indice] ? anilloDeLaTabla()[indice][0] : null,
    })
    await dormir(MS_ENTRE_FOTOGRAMAS)
  }

  const indicadorEnVuelo = indicadorDeEnganche()

  document.body.dispatchEvent(
    new MouseEvent('mouseup', {
      ...base,
      buttons: 0,
      clientX: Math.round(antes.x + gestoPx.dx),
      clientY: Math.round(antes.y + gestoPx.dy),
    }),
  )
  await dormir(MS_PROPAGAR)
  if (conAlt) soltarAlt()

  const iconoDespues = iconoDe(indice)
  return {
    ok: true,
    conAlt: conAlt === true,
    dragging: engancho,
    centroAntes: { x: Math.round(antes.x), y: Math.round(antes.y) },
    punteroFinal: { x: Math.round(antes.x + gestoPx.dx), y: Math.round(antes.y + gestoPx.dy) },
    centroDespues:
      iconoDespues === null
        ? null
        : { x: Math.round(centroDe(iconoDespues).x), y: Math.round(centroDe(iconoDespues).y) },
    fotogramas,
    indicadorEnVuelo,
    indicadorTrasSoltar: indicadorDeEnganche(),
    marcadorReutilizado: iconoDespues === icono && document.contains(icono),
  }
}

/** `Ctrl+Z` / `Ctrl+Y` sobre un destino, midiendo si la app CONSUME la tecla. */
async function atajo(destino, tecla, conShift = false) {
  const evento = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: tecla,
    ctrlKey: true,
    shiftKey: conShift,
  })
  destino.dispatchEvent(evento)
  await dormir(MS_PROPAGAR)
  return { tecla, prevenido: evento.defaultPrevented, renglon: renglon() }
}

// ── 0 · La página tiene que ser la que este guion sabe medir ────────────────

const esHueco = new URLSearchParams(location.search).get('demo') === 'hueco'
const contenedor = document.querySelector('.leaflet-container')

// ── ⛔ REBANADA 3 DEL REWORK (2026-08-04): ESTE GUION EXIGE ESTAR EN EDICIÓN ──
//
// Desde esa fecha los cuatro gestos de edición del mapa —arrastrar, borrar con
// el botón derecho, insertar con doble clic y seleccionar lindero— **solo están
// vivos en la pantalla de Edición**. Antes lo estaban en las cuatro, y el
// peldaño del rail no cambiaba nada de lo que se podía hacer.
//
// Lanzado en cualquier otra pantalla, este guion salía con CUATRO problemas que
// describían síntomas —«no ha aparecido ni un indicador de enganche», «el
// vértice se dibuja donde está el ratón»— y ninguno decía la causa. Un guion que
// reporta cuatro síntomas de una causa que sabe comprobar está haciendo perder
// el tiempo a quien lo lea, así que lo comprueba ANTES y lo dice en una línea.
//
// Se pone aquí y no en una nota del GUION porque las notas del GUION no se leen
// cuando el guion ya está corriendo (lección de T10).
const pasoActivo = document.querySelector('[data-paso]')?.dataset.paso ?? null
if (pasoActivo !== null && pasoActivo !== 'edicion') {
  return {
    guion: '08-edicion',
    feature: 'F06',
    tarea: 'T6.2',
    ok: false,
    url: location.href,
    pasoActivo,
    problemas: [
      `Este guion conduce la EDICIÓN y la aplicación está en «${pasoActivo}». Desde la rebanada 3 ` +
        'del rework los cuatro gestos de edición del mapa solo viven en la pantalla de Edición, ' +
        'así que aquí no habría nada que medir y los fallos que reportaría serían todos falsos. ' +
        'Relánzalo sobre `#/parcela/edicion` (recarga después de cambiar el hash: un cambio de ' +
        'solo el hash NO recarga el documento).',
    ],
    advertencias: [],
  }
}

if (contenedor === null || esHueco) {
  return {
    guion: '08-edicion',
    feature: 'F06',
    tarea: 'T6.2',
    ok: false,
    url: location.href,
    problemas: [
      contenedor === null
        ? 'No hay `.leaflet-container`: el visor no ha montado.'
        : 'Este guion mide sobre la parcela REAL de demostración y se ha lanzado con ' +
          '`?demo=hueco`. Ese dataset es SINTÉTICO y no trae `geometriaOficial`, así que no hay ' +
          'parcelario al que enganchar y el criterio 2 no se podría medir. Recarga sin `?demo=`.',
    ],
    ms: Math.round(performance.now() - t0),
  }
}

const controles = {
  deshacer: document.querySelector(SEL.DESHACER),
  rehacer: document.querySelector(SEL.REHACER),
  snap: document.querySelector(SEL.SNAP),
  tolerancia: document.querySelector(SEL.TOLERANCIA),
  offsetDistancia: document.querySelector(SEL.OFFSET_DISTANCIA),
  offset: document.querySelector(SEL.OFFSET),
  estado: document.querySelector(SEL.ESTADO),
}
const faltan = Object.entries(controles)
  .filter(([, nodo]) => nodo === null)
  .map(([clave]) => SEL[clave.toUpperCase()] || clave)

if (faltan.length > 0) {
  return {
    guion: '08-edicion',
    feature: 'F06',
    tarea: 'T6.2',
    ok: false,
    problemas: [
      `La pantalla no trae ${JSON.stringify(faltan)}. Esos siete selectores son el CONTRATO de ` +
        '`cablearEdicion` (app/main.js los exporta) y desde el 2026-07-29 los fabrica la BARRA ' +
        'flotante (`viewer/barra-edicion.js`, montada por `crearVisor` cuando `edicion.barra`, que ' +
        'es cierta por defecto). Sin esos nodos no hay nada que conducir: mira si el visor se ha ' +
        'montado sin edición, o si alguien ha pasado `barra: false`.',
    ],
    ms: Math.round(performance.now() - t0),
  }
}

// ── 1 · Reconocimiento: página recién cargada, escala y coherencia ──────────

const anilloArranque = anilloDeLaTabla()
const escalaArranque = escala()

const arranque = {
  filas: filasDeTabla(),
  vertices: numeroDeFicha('vertices'),
  superficie: numeroDeFicha('superficie'),
  perimetro: numeroDeFicha('perimetro'),
  deltaCatastral: textoDeFicha('delta-catastral'),
  superficieCatastral: textoDeFicha('superficie-catastral'),
  renglon: renglon(),
  botones: {
    deshacer: controles.deshacer.disabled,
    rehacer: controles.rehacer.disabled,
    offset: controles.offset.disabled,
  },
  snapMarcado: controles.snap.checked,
  toleranciaCm: controles.tolerancia.value,
  pxPorMetro: redondear(escalaArranque.pxPorMetro, 4),
  escalaCoherente: escalaArranque.coherente,
  // A la escala de arranque, cuántos píxeles vale la τ de producción. Es el número
  // que obliga a medir el enganche con otra τ (ver la cabecera).
  toleranciaArranqueEnPx:
    escalaArranque.pxPorMetro === null
      ? null
      : redondear((TOLERANCIA_ARRANQUE_CM / 100) * escalaArranque.pxPorMetro, 2),
}

const paginaRecienCargada =
  arranque.filas === ARRANQUE.vertices &&
  arranque.superficie !== null &&
  Math.abs(arranque.superficie - ARRANQUE.superficieM2) < 0.01

if (!paginaRecienCargada) {
  problemas.push(
    `La pantalla no está en el arranque del dataset REAL (se esperaban ${ARRANQUE.vertices} ` +
      `vértices y ${ARRANQUE.superficieM2} m², y hay ${arranque.filas} y ${arranque.superficie}). ` +
      'Este guion edita: necesita partir de un estado conocido. Recarga la página y repítelo. Si ' +
      'con la página recién cargada sigue sin cuadrar, hay regresión en `app/demo-datos.js` o en ' +
      'la cadena estado → ficha.',
  )
}
if (!escalaArranque.coherente) {
  problemas.push(
    `La escala medida entre dos pares de marcadores no coincide (${arranque.pxPorMetro} vs ` +
      `${redondear(escalaArranque.contraste, 4)} px/m). Sin escala fiable no se puede convertir el ` +
      'gesto en metros y ninguna medida de este guion vale.',
  )
}
if (!controles.snap.checked) {
  problemas.push(
    'La casilla `[data-campo="snap"]` NO nace marcada. `viewer/barra-edicion.js` la deja marcada a ' +
      'propósito, por `defaultChecked` (el estado inicial tiene que ser el que protege: dejar ' +
      'milímetros de hueco entre dos parcelas que en el terreno son la misma línea es el error más ' +
      'caro de esta app), y todo el criterio 2 se mide con el enganche encendido.',
  )
}
if (arranque.toleranciaCm !== String(TOLERANCIA_ARRANQUE_CM)) {
  problemas.push(
    `El campo de tolerancia arranca en ${JSON.stringify(arranque.toleranciaCm)} y no en ` +
      `"${TOLERANCIA_ARRANQUE_CM}" (centímetros). Es lo que ata los 20 cm del campo a los 0,2 m ` +
      'de `OPERATIVOS.snapMetros`.',
  )
}
if (arranque.deltaCatastral !== null && !/no hay/i.test(arranque.deltaCatastral)) {
  advertencias.push(
    `El Δ catastral dice ${JSON.stringify(arranque.deltaCatastral)}: la parcela de demostración ` +
      'ha dejado de venir sin superficie declarada, así que el Δ en vivo YA se podría medir aquí ' +
      '(hoy está declarado como no cubierto).',
  )
} else {
  advertencias.push(
    'Δ CATASTRAL NO MEDIDO: la parcela de demostración no trae `superficieCatastral` (solo la ' +
      `trae una parcela venida de F05), así que la ficha dice ${JSON.stringify(arranque.deltaCatastral)} ` +
      'durante todo el guion. El criterio 4 se mide aquí sobre superficie y perímetro; el Δ en ' +
      'movimiento queda para la suite y para el checklist humano con dato real.',
  )
}

// Coherencia de la ficha contra una segunda implementación, sobre lo que hay en la
// tabla. Si estas dos cifras discreparan, el usuario estaría leyendo en pantalla
// una superficie que su propia lista de vértices no sostiene.
const coherenciaArranque = {
  superficieFicha: arranque.superficie,
  superficieShoelace: redondear(shoelace(anilloArranque), 2),
  perimetroFicha: arranque.perimetro,
  perimetroCalculado: redondear(perimetro(anilloArranque), 2),
}
coherenciaArranque.superficieCuadra =
  arranque.superficie !== null &&
  Math.abs(arranque.superficie - coherenciaArranque.superficieShoelace) <= TOLERANCIA_COHERENCIA
coherenciaArranque.perimetroCuadra =
  arranque.perimetro !== null &&
  Math.abs(arranque.perimetro - coherenciaArranque.perimetroCalculado) <= TOLERANCIA_COHERENCIA

if (!coherenciaArranque.superficieCuadra || !coherenciaArranque.perimetroCuadra) {
  problemas.push(
    `Las cifras de la ficha no cuadran con lo que hay en la tabla: superficie ` +
      `${coherenciaArranque.superficieFicha} vs ${coherenciaArranque.superficieShoelace} m² ` +
      `(shoelace), perímetro ${coherenciaArranque.perimetroFicha} vs ` +
      `${coherenciaArranque.perimetroCalculado} m (suma de lados). Las dos cuentas de este guion ` +
      'son independientes de `geo/area.js` y `geo/metrica.js`.',
  )
}

// ── 2 · Hit-test REAL: quién responde bajo el puntero ───────────────────────

const centroVertice = centroDe(iconoDe(0))
const centroLado = (() => {
  const a = centroDe(iconoDe(0))
  const b = centroDe(iconoDe(1))
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
})()

const describirNodo = (el) =>
  el === null ? null : `${el.tagName.toLowerCase()}${el.getAttribute('class') ? `.${el.getAttribute('class')}` : ''}`

const bajoElVertice = document.elementFromPoint(centroVertice.x, centroVertice.y)
const bajoElLado = document.elementFromPoint(centroLado.x, centroLado.y)

// ⚠️ El icono del vértice es un `L.divIcon` y su cuadradito visible es un `<span>`
// DENTRO del `.leaflet-marker-icon` (`viewer/sincronizacion.js#iconoVertice`), así
// que `elementFromPoint` devuelve el span y no el div. Lo que hay que comprobar es
// que el punto CAE EN EL MARCADOR —`closest`—, no que el nodo sea el div: ahí es
// donde Leaflet engancha el `Draggable`, y el evento sube por burbujeo.
const marcadorBajoElPunto = bajoElVertice === null ? null : bajoElVertice.closest('.leaflet-marker-icon')

const hitTest = {
  queEs:
    'document.elementFromPoint: hit-testing REAL del navegador (respeta pointer-events, ' +
    'z-index y el apilado de panes). NO es un puntero: no dice si una persona acierta.',
  sobreElVertice: describirNodo(bajoElVertice),
  respondeElMarcador: marcadorBajoElPunto !== null,
  // Y que sea EL vértice que se apuntaba, no otro que se le haya puesto encima.
  tituloDelMarcador: marcadorBajoElPunto === null ? null : marcadorBajoElPunto.title,
  tituloEsperado: `${ROTULO_RECINTO} · vértice 1`,
  sobreElLado: describirNodo(bajoElLado),
  ladoAtrapadoPorLaCota:
    bajoElLado !== null && (bajoElLado.getAttribute('class') || '').includes(CLASE_ACOTACION),
  ladoIconoPx: centroVertice.lado,
}

if (!hitTest.respondeElMarcador || hitTest.tituloDelMarcador !== hitTest.tituloEsperado) {
  problemas.push(
    `Sobre el CENTRO del vértice 1 responde ${JSON.stringify(hitTest.sobreElVertice)} ` +
      `(marcador ${JSON.stringify(hitTest.tituloDelMarcador)}) y no el marcador de ese vértice: ` +
      'algo se ha puesto por encima del pane `vertices` y un ratón real no llegaría a agarrarlo.',
  )
}
if (hitTest.ladoAtrapadoPorLaCota) {
  problemas.push(
    'Sobre el PUNTO MEDIO de un lindero responde la COTA. `viewer/acotaciones.js` la monta con ' +
      '`interactive:false` y `pointer-events:none` justo para esto: si atrapa el puntero, el ' +
      'doble clic que inserta un vértice —el gesto más usado de la fase— deja de funcionar.',
  )
}

// ── 3 · Las cotas contra el zoom REAL ───────────────────────────────────────

const zoomIn = document.querySelector('.leaflet-control-zoom-in')
const zoomOut = document.querySelector('.leaflet-control-zoom-out')

async function pulsarZoom(boton, veces) {
  for (let i = 0; i < veces; i += 1) {
    boton.click()
    await dormir(MS_ASENTAR_VISTA)
  }
}

/** Una lectura de cotas junto con la escala a la que se ha tomado. */
function lecturaDeCotas() {
  const e = escala()
  const c = cotas()
  return {
    pxPorMetro: redondear(e.pxPorMetro, 4),
    umbralEnMetros: e.pxPorMetro === null ? null : redondear(ACOTACION_MINIMA_PX / e.pxPorMetro, 2),
    ...c,
  }
}

let acotaciones = { medido: false, motivo: 'No hay controles de zoom de Leaflet en la página.' }

if (zoomIn !== null && zoomOut !== null && !agotado()) {
  const enZ = lecturaDeCotas()
  await pulsarZoom(zoomOut, 2)
  const alejado = lecturaDeCotas()
  await pulsarZoom(zoomIn, 2)
  const devuelto = lecturaDeCotas()
  await pulsarZoom(zoomIn, 2)
  const acercado = lecturaDeCotas()
  await pulsarZoom(zoomOut, 2)
  const final = lecturaDeCotas()

  acotaciones = {
    medido: true,
    umbralPx: ACOTACION_MINIMA_PX,
    enZ,
    alejado,
    devuelto,
    acercado,
    final,
    escalaCambio: alejado.pxPorMetro !== null && enZ.pxPorMetro !== null && alejado.pxPorMetro < enZ.pxPorMetro,
    bajanAlAlejar: alejado.visibles < enZ.visibles,
    subenAlAcercar: acercado.visibles > enZ.visibles,
    reversible: final.visibles === enZ.visibles && devuelto.visibles === enZ.visibles,
    // El nº de rótulos EN EL DOM no cambia con el zoom: se ocultan con
    // `display:none`, no se destruyen (`viewer/acotaciones.js#aplicarVisibilidad`).
    domEstable: alejado.enDom === enZ.enDom && acercado.enDom === enZ.enDom,
  }

  if (!acotaciones.escalaCambio) {
    problemas.push(
      `Pulsar «−» dos veces no ha cambiado la escala (${enZ.pxPorMetro} → ${alejado.pxPorMetro} ` +
        'px/m): el zoom no se ha movido y la medida de las cotas no dice nada. ¿Tope de zoom, o el ' +
        'control no responde al click sintético?',
    )
  } else {
    if (!acotaciones.bajanAlAlejar) {
      problemas.push(
        `Al ALEJAR el zoom las cotas visibles no han bajado (${enZ.visibles} → ` +
          `${alejado.visibles} de ${enZ.enDom}). El filtro de ` +
          `\`viewer/acotaciones.js\` es por PÍXELES (${ACOTACION_MINIMA_PX}): al alejar, los lados ` +
          'cortos dejan de caber y sus rótulos tienen que desaparecer solos.',
      )
    }
    if (!acotaciones.subenAlAcercar) {
      problemas.push(
        `Al ACERCAR el zoom las cotas visibles no han subido (${enZ.visibles} → ` +
          `${acercado.visibles} de ${enZ.enDom}).`,
      )
    }
    if (!acotaciones.reversible) {
      problemas.push(
        `Volviendo al zoom de partida las cotas visibles no vuelven al mismo número ` +
          `(${enZ.visibles} → ${devuelto.visibles} → ${final.visibles}): la visibilidad depende de ` +
          'algo más que de la escala, y eso es un estado que se arrastra.',
      )
    }
    if (!acotaciones.domEstable) {
      advertencias.push(
        `El nº de rótulos EN EL DOM cambia con el zoom (${enZ.enDom} → ${alejado.enDom} → ` +
          `${acercado.enDom}). No es un fallo funcional, pero viewer/acotaciones.js promete ` +
          'ocultarlos con `display:none` y no destruirlos: crear y destruir capas por cada zoom es ' +
          'el gasto que ese diseño evita.',
      )
    }
  }
} else if (agotado()) {
  acotaciones = { medido: false, motivo: 'Presupuesto de tiempo agotado antes de medir las cotas.' }
}

// ── 4 · El enganche, con τ tecleada para que sea medible ────────────────────

controles.tolerancia.value = String(TOLERANCIA_MEDIDA_CM)
controles.tolerancia.dispatchEvent(new Event('change', { bubbles: true }))
await dormir(MS_PROPAGAR)

const toleranciaAplicada = {
  tecleadaCm: TOLERANCIA_MEDIDA_CM,
  renglon: renglon(),
  // El renglón es la ÚNICA prueba desde fuera de que el campo en cm ha llegado al
  // visor en metros: `cablearEdicion` lo reescribe con lo que ha aplicado.
  loConfirma: (renglon() || '').includes(String(TOLERANCIA_MEDIDA_CM)),
  enError: renglonEnError(),
}
if (!toleranciaAplicada.loConfirma || toleranciaAplicada.enError) {
  problemas.push(
    `Teclear ${TOLERANCIA_MEDIDA_CM} en \`${SEL.TOLERANCIA}\` no ha dado el renglón esperado: ` +
      `${JSON.stringify(toleranciaAplicada.renglon)}. La conversión cm→m del campo es contrato de F06.`,
  )
}

const pxPorMetro = escala().pxPorMetro
const metrosDe = (px) => (pxPorMetro === null ? null : px / pxPorMetro)

// A · Enganche a VÉRTICE. Se mueve ~1,4 m (menos que τ = 3 m), así que la diana
//     más cercana es el vértice OFICIAL, que está en la posición de partida.
const arrastreA = await arrastrar(0, { dx: 20, dy: 12 }, false)
const anilloTrasA = anilloDeLaTabla()
const engancheVertice = {
  queSeEspera:
    'La coordenada commiteada es la del VÉRTICE OFICIAL (el de partida), no la del puntero: ' +
    '`dianasDe` no excluye `geometriaOficial` (ver su JSDoc).',
  gestoEnMetros: redondear(metrosDe(Math.hypot(20, 12)), 3),
  toleranciaM: TOLERANCIA_MEDIDA_CM / 100,
  coordenadaAntes: anilloArranque[0],
  coordenadaDespues: anilloTrasA[0],
  desviacionDelOficialM: redondear(dist(anilloTrasA[0], anilloArranque[0]), 4),
  indicadoresPorFotograma: arrastreA.fotogramas.map((f) => f.indicador),
  ...arrastreA,
}
// El marcador vuelve a su píxel de partida aunque el puntero acabe a 23 px: es
// `colocar(..., enganchado)` haciendo `setLatLng`. Sin esto, el vértice se
// dibujaría donde está el ratón y no donde ha enganchado.
engancheVertice.marcadorVuelveAlOrigen =
  arrastreA.centroDespues !== null &&
  Math.abs(arrastreA.centroDespues.x - arrastreA.centroAntes.x) <= 1 &&
  Math.abs(arrastreA.centroDespues.y - arrastreA.centroAntes.y) <= 1

if (!arrastreA.dragging) {
  problemas.push(
    'El arrastre A NO enganchó: `document.body` nunca tuvo `leaflet-dragging`. Causas típicas en ' +
      'GUION.md §10 (button ≠ 0, primer paso por debajo del clickTolerance, `Draggable._dragging` ' +
      'global alto por un gesto sin `mouseup`: recarga y repite).',
  )
}
if (engancheVertice.desviacionDelOficialM > 0.005) {
  problemas.push(
    `Con τ = ${TOLERANCIA_MEDIDA_CM} cm, un arrastre de ` +
      `${engancheVertice.gestoEnMetros} m NO ha enganchado al vértice oficial: la coordenada ha ` +
      `quedado a ${engancheVertice.desviacionDelOficialM} m de él. Lo que acaba en la tabla es la ` +
      'posición del puntero, o sea que el snap no está mandando sobre el `dragend`.',
  )
}
if (!engancheVertice.indicadoresPorFotograma.some((i) => i === 'VERTICE')) {
  problemas.push(
    `Durante el arrastre A no ha aparecido ni un indicador \`.${CLASE_SNAP_VERTICE}\` ` +
      `(fotogramas: ${JSON.stringify(engancheVertice.indicadoresPorFotograma)}). El indicador ` +
      'visual del enganche lo pide la spec de F06 en su alcance, y es lo único que le dice al ' +
      'usuario POR QUÉ el vértice no está donde tiene el ratón.',
  )
}
if (arrastreA.indicadorTrasSoltar !== null) {
  problemas.push(
    `El indicador de enganche sigue en el mapa después de soltar (${arrastreA.indicadorTrasSoltar}): ` +
      'es del GESTO y se va con él (`alCrearMarcador` → `dragend` → `ocultarIndicador`).',
  )
}
if (!engancheVertice.marcadorVuelveAlOrigen) {
  problemas.push(
    `Tras enganchar, el marcador ha quedado en ${JSON.stringify(arrastreA.centroDespues)} y no en ` +
      `${JSON.stringify(arrastreA.centroAntes)}: el vértice se está dibujando donde está el ratón y ` +
      'no donde ha enganchado.',
  )
}
if (!arrastreA.marcadorReutilizado) {
  problemas.push(
    'El marcador se ha RECREADO durante el gesto (hallazgo C8): un arrastre real se perdería a mitad.',
  )
}

// B · Enganche a LINDERO. Se lleva el vértice 5 m A LO LARGO de su propio lindero
//     oficial (así ningún vértice queda dentro de τ) y 1 m PERPENDICULAR (así el
//     enganche tiene algo que corregir). Lo commiteado debe caer SOBRE la recta.
const direccionUTM = (() => {
  const a = anilloArranque[0]
  const b = anilloArranque[1]
  const largo = dist(a, b)
  return [(b[0] - a[0]) / largo, (b[1] - a[1]) / largo]
})()
// UTM → pantalla: +X va a la derecha y +Y (norte) va hacia ARRIBA, o sea −y en CSS.
const alLargoPx = (m) => ({
  dx: direccionUTM[0] * m * pxPorMetro,
  dy: -direccionUTM[1] * m * pxPorMetro,
})
const perpendicularPx = (m) => ({
  dx: -direccionUTM[1] * m * pxPorMetro,
  dy: -direccionUTM[0] * m * pxPorMetro,
})
const paso1 = alLargoPx(5)
const paso2 = perpendicularPx(1)
const gestoB = { dx: Math.round(paso1.dx + paso2.dx), dy: Math.round(paso1.dy + paso2.dy) }

const arrastreB = await arrastrar(0, gestoB, false)
const anilloTrasB = anilloDeLaTabla()
const engancheLindero = {
  queSeEspera:
    'La coordenada commiteada cae SOBRE la recta del lindero oficial v1→v2 (proyección ' +
    'punto→segmento de la spec), a ~1 m de donde acabó el puntero.',
  gestoPx: gestoB,
  fueraDeLaRectaM: redondear(fueraDeLaRecta(anilloTrasB[0], anilloArranque[0], anilloArranque[1]), 4),
  avanceSobreLaRectaM: redondear(dist(anilloTrasB[0], anilloArranque[0]), 3),
  indicadoresPorFotograma: arrastreB.fotogramas.map((f) => f.indicador),
  ...arrastreB,
}
if (engancheLindero.fueraDeLaRectaM === null || Math.abs(engancheLindero.fueraDeLaRectaM) > 0.01) {
  problemas.push(
    `Con el puntero a ~1 m del lindero oficial, la coordenada commiteada ha quedado a ` +
      `${engancheLindero.fueraDeLaRectaM} m de la recta v1→v2 en vez de SOBRE ella: el enganche a ` +
      'LINDERO no está proyectando (o no ha enganchado).',
  )
}
if (!engancheLindero.indicadoresPorFotograma.some((i) => i === 'LINDERO')) {
  problemas.push(
    `Durante el arrastre B no ha aparecido ni un indicador \`.${CLASE_SNAP_LINDERO}\` ` +
      `(fotogramas: ${JSON.stringify(engancheLindero.indicadoresPorFotograma)}). El tipo de ` +
      'enganche es información: `edit/snap.js` publica `TIPO_ENGANCHE` justo para que la UI lo ' +
      'distinga sin leer ningún texto.',
  )
}

// ── 5 · Undo / redo, y la inhibición con el foco en una celda ───────────────

const undoA = await atajo(contenedor, 'z')
const anilloTrasUndo = anilloDeLaTabla()
const redo = await atajo(contenedor, 'y')
const anilloTrasRedo = anilloDeLaTabla()
const undoB = await atajo(contenedor, 'z')
const anilloTrasUndo2 = anilloDeLaTabla()

const historial = {
  undo: undoA,
  redo,
  undoTrasRedo: undoB,
  desviacionTrasUndoM: redondear(dist(anilloTrasUndo[0], anilloArranque[0]), 4),
  desviacionTrasRedoM: redondear(dist(anilloTrasRedo[0], anilloTrasB[0]), 4),
  desviacionTrasUndo2M: redondear(dist(anilloTrasUndo2[0], anilloArranque[0]), 4),
  // Criterio 5: se revierte la OPERACIÓN, no el fotograma. Un historial por
  // fotograma habría metido 4 instantáneas por gesto y un solo `Ctrl+Z` habría
  // dejado el vértice a medio camino.
  volvioDeUnaVez: false,
}
historial.volvioDeUnaVez = historial.desviacionTrasUndoM <= 0.005

if (undoA.renglon !== MENSAJE_DESHECHO) {
  problemas.push(
    `\`Ctrl+Z\` con el foco en el mapa no ha dejado el renglón en ${JSON.stringify(MENSAJE_DESHECHO)} ` +
      `sino en ${JSON.stringify(undoA.renglon)}.`,
  )
}
if (!undoA.prevenido) {
  problemas.push(
    '`Ctrl+Z` con el foco en el mapa NO se ha consumido (`defaultPrevented: false`): el navegador ' +
      'lo va a procesar además, y eso revierte texto en cualquier otro sitio de la página.',
  )
}
if (!historial.volvioDeUnaVez) {
  problemas.push(
    `Un solo \`Ctrl+Z\` no ha devuelto el vértice a su sitio: ha quedado a ` +
      `${historial.desviacionTrasUndoM} m del original. El criterio 5 pide revertir OPERACIONES ` +
      'completas, no fotogramas del arrastre (el snapshot es de `dragend`, no de `mousemove`).',
  )
}
if (redo.renglon !== MENSAJE_REHECHO || historial.desviacionTrasRedoM > 0.005) {
  problemas.push(
    `\`Ctrl+Y\` no ha rehecho la operación: renglón ${JSON.stringify(redo.renglon)} y el vértice ` +
      `ha quedado a ${historial.desviacionTrasRedoM} m de donde lo dejó el arrastre B.`,
  )
}
if (historial.desviacionTrasUndo2M > 0.005) {
  problemas.push(
    `El segundo \`Ctrl+Z\` (tras el redo) no ha devuelto el vértice al original: ` +
      `${historial.desviacionTrasUndo2M} m.`,
  )
}

// La inhibición: con el foco en una celda de coordenada, `Ctrl+Z` es del NAVEGADOR.
const celda = document.querySelector('#tabla-vertices input[data-eje="x"]')
celda.focus()
const focoEnLaCelda = document.activeElement === celda
const renglonAntesDeInhibir = renglon()
const anilloAntesDeInhibir = anilloDeLaTabla()
const inhibido = await atajo(celda, 'z')
const anilloTrasInhibir = anilloDeLaTabla()
celda.blur()

const inhibicion = {
  porQue:
    'Las celdas de coordenada SON `<input>`: ahí `Ctrl+Z` es el deshacer del navegador sobre el ' +
    'texto que se está tecleando. Robárselo destruiría trabajo que el usuario creía a salvo.',
  focoEnLaCelda,
  prevenido: inhibido.prevenido,
  renglonAntes: renglonAntesDeInhibir,
  renglonDespues: inhibido.renglon,
  geometriaIntacta: dist(anilloTrasInhibir[0], anilloAntesDeInhibir[0]) === 0,
}
if (inhibicion.prevenido) {
  problemas.push(
    '`Ctrl+Z` con el foco en una celda de coordenada se ha CONSUMIDO ' +
      '(`defaultPrevented: true`): la app le está robando el deshacer al navegador justo mientras ' +
      'el usuario escribe. Es la inhibición de `esCampoDeTexto` (app/main.js), y es la que más ' +
      'fácil se rompe.',
  )
}
if (!inhibicion.geometriaIntacta || inhibicion.renglonDespues !== renglonAntesDeInhibir) {
  problemas.push(
    `\`Ctrl+Z\` con el foco en la celda HA DESHECHO algo: la geometría ha cambiado o el renglón ha ` +
      `pasado de ${JSON.stringify(renglonAntesDeInhibir)} a ${JSON.stringify(inhibido.renglon)}.`,
  )
}

// ── 6 · Métricas EN VIVO durante el gesto (criterio 4) ──────────────────────
//
// Se mide con `Alt`: sin enganche el vértice sigue al puntero fotograma a
// fotograma, así que las cifras tienen que moverse. Con enganche volvería al sitio
// en cada fotograma y no habría nada que ver.

const superficieAntesDeC = numeroDeFicha('superficie')
const perimetroAntesDeC = numeroDeFicha('perimetro')
const GESTO_C = { dx: 46, dy: 28 }
const anilloAntesDeC = anilloDeLaTabla()
const arrastreC = await arrastrar(0, GESTO_C, true)
const anilloTrasC = anilloDeLaTabla()

const superficiesEnVuelo = arrastreC.fotogramas.map((f) => f.superficie)
const perimetrosEnVuelo = arrastreC.fotogramas.map((f) => f.perimetro)

const enVivo = {
  superficieAntes: superficieAntesDeC,
  perimetroAntes: perimetroAntesDeC,
  superficiesPorFotograma: superficiesEnVuelo,
  perimetrosPorFotograma: perimetrosEnVuelo,
  // Lo que de verdad prueba el criterio 4: que se mueven ANTES del `mouseup`, no
  // que salten al soltar. `sincronizacion.js` no toca el store hasta el `dragend`;
  // esto llega por el canal `alPrevisualizar`.
  superficieSeMuevePorFotograma: new Set(superficiesEnVuelo.filter((s) => s !== null)).size > 1,
  perimetroSeMuevePorFotograma: new Set(perimetrosEnVuelo.filter((p) => p !== null)).size > 1,
  cambioAntesDeSoltar:
    superficiesEnVuelo.length > 0 && superficiesEnVuelo[superficiesEnVuelo.length - 1] !== superficieAntesDeC,
  deltaCatastral: textoDeFicha('delta-catastral'),
}

if (!enVivo.superficieSeMuevePorFotograma || !enVivo.perimetroSeMuevePorFotograma) {
  problemas.push(
    `Durante el arrastre, superficie y perímetro no se mueven fotograma a fotograma ` +
      `(superficies ${JSON.stringify(superficiesEnVuelo)}, perímetros ` +
      `${JSON.stringify(perimetrosEnVuelo)}). El criterio 4 pide que se actualicen DURANTE el ` +
      'arrastre, y ese canal es `alPrevisualizar` — el store no se toca hasta el `dragend`.',
  )
}
if (!enVivo.cambioAntesDeSoltar) {
  problemas.push(
    'La superficie del último fotograma es la misma que antes de empezar el gesto: la ficha se ' +
      'está actualizando SOLO al soltar, que es exactamente lo que el canal en vivo existe para evitar.',
  )
}

// Y al soltar, las dos cifras de la ficha contra las dos cuentas de este guion.
const coherenciaTrasC = {
  superficieFicha: numeroDeFicha('superficie'),
  superficieShoelace: redondear(shoelace(anilloTrasC), 2),
  perimetroFicha: numeroDeFicha('perimetro'),
  perimetroCalculado: redondear(perimetro(anilloTrasC), 2),
}
coherenciaTrasC.cuadra =
  Math.abs(coherenciaTrasC.superficieFicha - coherenciaTrasC.superficieShoelace) <= TOLERANCIA_COHERENCIA &&
  Math.abs(coherenciaTrasC.perimetroFicha - coherenciaTrasC.perimetroCalculado) <= TOLERANCIA_COHERENCIA

if (!coherenciaTrasC.cuadra) {
  problemas.push(
    `Tras el arrastre, la ficha y la tabla no dicen lo mismo: superficie ` +
      `${coherenciaTrasC.superficieFicha} vs ${coherenciaTrasC.superficieShoelace} m², perímetro ` +
      `${coherenciaTrasC.perimetroFicha} vs ${coherenciaTrasC.perimetroCalculado} m.`,
  )
}

// El arrastre C tenía `Alt`: NO debe haber enganchado. Se comprueba contra la
// posición del puntero traducida a metros con la escala medida.
// Pantalla → UTM: +x de CSS es +X (Este) y +y de CSS es −Y (el norte va hacia
// arriba). La escala es la MEDIDA, no una constante: por eso esta cuenta es una
// comprobación de la proyección y no una tautología.
const punteroEsperado = [
  anilloAntesDeC[0][0] + metrosDe(GESTO_C.dx),
  anilloAntesDeC[0][1] - metrosDe(GESTO_C.dy),
]
const sinEnganche = {
  queSeEspera: 'Con `Alt`, la coordenada es la del PUNTERO: ni indicador ni corrección.',
  coordenada: anilloTrasC[0],
  punteroEsperado: [redondear(punteroEsperado[0], 3), redondear(punteroEsperado[1], 3)],
  desviacionM: redondear(dist(anilloTrasC[0], punteroEsperado), 3),
  indicadoresPorFotograma: arrastreC.fotogramas.map((f) => f.indicador),
  desviacionDelOficialM: redondear(dist(anilloTrasC[0], anilloArranque[0]), 3),
}
if (sinEnganche.indicadoresPorFotograma.some((i) => i !== null)) {
  problemas.push(
    `Con \`Alt\` pulsada ha aparecido indicador de enganche ` +
      `(${JSON.stringify(sinEnganche.indicadoresPorFotograma)}): la tecla modificadora del ` +
      'criterio 2 no está apagando el snap.',
  )
}
if (sinEnganche.desviacionM > 0.1) {
  problemas.push(
    `Con \`Alt\` pulsada, la coordenada final (${JSON.stringify(sinEnganche.coordenada)}) no es la ` +
      `del puntero (${JSON.stringify(sinEnganche.punteroEsperado)}): ${sinEnganche.desviacionM} m ` +
      'de desviación. O ha enganchado, o la escala medida no es la que usa la proyección.',
  )
}
if (sinEnganche.desviacionDelOficialM < 0.5) {
  problemas.push(
    `Con \`Alt\` pulsada el vértice ha vuelto a ${sinEnganche.desviacionDelOficialM} m del oficial: ` +
      'eso es lo que haría el enganche, y con `Alt` no debería enganchar nada.',
  )
}

// Deshacer el arrastre C: a partir de aquí se mide el offset, y conviene partir de
// la geometría de arranque.
await atajo(contenedor, 'z')
const anilloTrasLimpiar = anilloDeLaTabla()

// τ vuelve a su valor de arranque ANTES de seguir: lo que venga después no puede
// heredar una tolerancia de 3 m.
controles.tolerancia.value = String(TOLERANCIA_ARRANQUE_CM)
controles.tolerancia.dispatchEvent(new Event('change', { bubbles: true }))
await dormir(MS_PROPAGAR)

// ── 7 · Offset con un clic REAL sobre el lindero ────────────────────────────

const puntoDelLado = (() => {
  const a = centroDe(iconoDe(0))
  const b = centroDe(iconoDe(1))
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
})()

const clicDeSeleccion = ratonEn('click', puntoDelLado, { button: 0, detail: 1 })
await dormir(MS_PROPAGAR)

const dAntesDelOffset = dDelCamino()
const superficieAntesDelOffset = numeroDeFicha('superficie')
const filasAntesDelOffset = filasDeTabla()
const avisosAntesDelOffset = pesoAvisos()

const seleccion = {
  puntoPulsado: { x: Math.round(puntoDelLado.x), y: Math.round(puntoDelLado.y) },
  quienRespondio: clicDeSeleccion.destino,
  resaltePintado: document.querySelector(`.${CLASE_RESALTE}`) !== null,
  botonOffsetHabilitado: controles.offset.disabled === false,
  renglon: renglon(),
}
if (!seleccion.resaltePintado || !seleccion.botonOffsetHabilitado) {
  problemas.push(
    `Un clic en el punto medio del lindero 1 (${JSON.stringify(seleccion.puntoPulsado)}, respondió ` +
      `${JSON.stringify(seleccion.quienRespondio)}) no ha dejado el lado seleccionado: resalte ` +
      `${seleccion.resaltePintado}, botón «Desplazar lindero» habilitado ` +
      `${seleccion.botonOffsetHabilitado}. Sin selección no hay offset que medir.`,
  )
}

let offset = { medido: false, motivo: 'No se pudo seleccionar ningún lindero.' }
if (seleccion.botonOffsetHabilitado) {
  controles.offsetDistancia.value = String(OFFSET_M)
  controles.offset.click()
  await dormir(MS_PROPAGAR)

  const anilloTrasOffset = anilloDeLaTabla()
  offset = {
    medido: true,
    distanciaM: OFFSET_M,
    renglon: renglon(),
    enError: renglonEnError(),
    dCambio: dDelCamino() !== dAntesDelOffset,
    superficieAntes: superficieAntesDelOffset,
    superficieDespues: numeroDeFicha('superficie'),
    // El offset recalcula los CONTIGUOS por intersección: no añade ni quita vértices.
    filasAntes: filasAntesDelOffset,
    filasDespues: filasDeTabla(),
    // Cuánto se ha movido de verdad el lindero, medido sobre la tabla: la distancia
    // del vértice 1 nuevo a la recta vieja v1→v2 tiene que ser la que se tecleó.
    desplazamientoMedidoM: redondear(
      Math.abs(fueraDeLaRecta(anilloTrasOffset[0], anilloTrasLimpiar[0], anilloTrasLimpiar[1])),
      3,
    ),
    coherencia: null,
  }
  offset.coherencia = {
    superficieShoelace: redondear(shoelace(anilloTrasOffset), 2),
    cuadra: Math.abs(numeroDeFicha('superficie') - shoelace(anilloTrasOffset)) <= TOLERANCIA_COHERENCIA,
  }
  // Regla de oro 1 sobre el gesto más usado de la fase. En ESTE dataset los dos
  // lados contiguos al lindero 1 son casi su prolongación (0,03°), así que
  // `edit/offset.js` no tiene esquina donde apoyar la intersección y aplica su
  // fallback: la operación SE HACE, pero degradada. Que el panel lo cuente es lo
  // que separa «te lo he movido como pediste» de «te lo he movido de otra manera».
  const avisosDespuesDelOffset = pesoAvisos()
  offset.avisos = {
    tarjetasAntes: avisosAntesDelOffset.tarjetas,
    tarjetasDespues: avisosDespuesDelOffset.tarjetas,
    pesoAntes: avisosAntesDelOffset.peso,
    pesoDespues: avisosDespuesDelOffset.peso,
    crecio: avisosDespuesDelOffset.peso > avisosAntesDelOffset.peso,
    textos: avisosDespuesDelOffset.textos,
  }
  if (!offset.avisos.crecio) {
    problemas.push(
      'Desplazar el lindero 1 de este dataset NO ha dejado ni una tarjeta en el panel de avisos. ' +
        'Sus dos lados contiguos son casi su prolongación (≈ 0,03°), así que `edit/offset.js` no ' +
        'tiene punto de corte donde apoyarse y tiene que aplicar su fallback: la operación se ' +
        'aplica DEGRADADA y callarlo sería exactamente el error silencioso que la regla de oro 1 ' +
        'prohíbe. Si el guard de paralelismo ha cambiado de umbral, dilo aquí antes de tocar nada.',
    )
  }

  if (!offset.dCambio) {
    problemas.push(
      'Tras «Desplazar lindero», el atributo `d` del polígono NO ha cambiado: el dibujo no refleja ' +
        'la operación.',
    )
  }
  if (offset.superficieAntes === offset.superficieDespues) {
    problemas.push(
      `La superficie de la ficha no se ha movido con el offset (${offset.superficieDespues} m²): ` +
        'desplazar un lindero 0,50 m cambia el área por construcción.',
    )
  }
  if (offset.filasAntes !== offset.filasDespues) {
    problemas.push(
      `El offset ha cambiado el nº de vértices (${offset.filasAntes} → ${offset.filasDespues}): ` +
        'sobre ESTE lindero del dataset de arranque, el criterio 3 se cumple recalculando los dos ' +
        'contiguos por intersección, sin añadir ninguno. Un vértice de más es el FALLBACK de ' +
        'bisel de `edit/offset.js`, que se dispara cuando los lados adyacentes son casi paralelos ' +
        '— y eso, aquí, significa que la geometría de partida no era la de arranque (mira ' +
        '`paginaRecienCargada`) o que ha cambiado el guard de paralelismo.',
    )
  }
  if (offset.enError) {
    problemas.push(`El renglón ha quedado en ERROR tras el offset: ${JSON.stringify(offset.renglon)}.`)
  }
  if (Math.abs(offset.desplazamientoMedidoM - OFFSET_M) > 0.01) {
    problemas.push(
      `El lindero se ha movido ${offset.desplazamientoMedidoM} m y se pidieron ${OFFSET_M} m ` +
        '(medido sobre las coordenadas de la tabla, no sobre lo que dice el renglón).',
    )
  }
  if (!offset.coherencia.cuadra) {
    problemas.push(
      `Tras el offset la superficie de la ficha (${offset.superficieDespues}) no cuadra con el ` +
        `shoelace de la tabla (${offset.coherencia.superficieShoelace}).`,
    )
  }
}

// ── 8 · Insertar (doble clic) y eliminar (clic derecho) ─────────────────────

const anilloAntesDeInsertar = anilloDeLaTabla()
const escalaAntesDelDobleClic = escala().pxPorMetro
const puntoDeInsercion = (() => {
  const a = centroDe(iconoDe(2))
  const b = centroDe(iconoDe(3))
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
})()

// El gesto COMPLETO, como lo emite un navegador: dos ciclos de clic y el `dblclick`
// encima. Los dos clics seleccionan el mismo lado (idempotente) y solo el `dblclick`
// escribe en el modelo, que es justo lo que documenta `viewer/edicion.js`.
ratonEn('mousedown', puntoDeInsercion, { button: 0, buttons: 1, detail: 1 })
ratonEn('mouseup', puntoDeInsercion, { button: 0, buttons: 0, detail: 1 })
ratonEn('click', puntoDeInsercion, { button: 0, detail: 1 })
ratonEn('mousedown', puntoDeInsercion, { button: 0, buttons: 1, detail: 2 })
ratonEn('mouseup', puntoDeInsercion, { button: 0, buttons: 0, detail: 2 })
ratonEn('click', puntoDeInsercion, { button: 0, detail: 2 })
const dobleClic = ratonEn('dblclick', puntoDeInsercion, { button: 0, detail: 2 })
await dormir(MS_PROPAGAR + 120)

const anilloTrasInsertar = anilloDeLaTabla()
const insertar = {
  puntoPulsado: { x: Math.round(puntoDeInsercion.x), y: Math.round(puntoDeInsercion.y) },
  filasAntes: anilloAntesDeInsertar.length,
  filasDespues: anilloTrasInsertar.length,
  // `preventDefault` es lo que impide que el doble clic haga ADEMÁS zoom.
  dobleClicPrevenido: dobleClic.prevenido,
  escalaAntes: redondear(escalaAntesDelDobleClic, 4),
  escalaDespues: redondear(escala().pxPorMetro, 4),
  renglon: renglon(),
  // El vértice nuevo cae PROYECTADO sobre el lado, no en el punto crudo del clic:
  // se comprueba que es colineal con los dos extremos del lado de partida.
  fueraDeLaRectaM: null,
}
insertar.zoomIntacto =
  insertar.escalaAntes !== null &&
  insertar.escalaDespues !== null &&
  Math.abs(insertar.escalaDespues - insertar.escalaAntes) / insertar.escalaAntes < 0.01
if (insertar.filasDespues === insertar.filasAntes + 1) {
  insertar.fueraDeLaRectaM = redondear(
    fueraDeLaRecta(anilloTrasInsertar[3], anilloAntesDeInsertar[2], anilloAntesDeInsertar[3]),
    4,
  )
}

if (insertar.filasDespues !== insertar.filasAntes + 1) {
  problemas.push(
    `El doble clic sobre el lindero 3 no ha insertado un vértice (${insertar.filasAntes} → ` +
      `${insertar.filasDespues} filas). Renglón: ${JSON.stringify(insertar.renglon)}.`,
  )
}
if (!insertar.dobleClicPrevenido) {
  problemas.push(
    'El `dblclick` no se ha cancelado (`defaultPrevented: false`): `viewer/edicion.js` llama a ' +
      '`L.DomEvent.preventDefault` justo para que insertar un vértice no amplíe además el mapa.',
  )
}
if (!insertar.zoomIntacto) {
  problemas.push(
    `El doble clic ha cambiado la escala del mapa (${insertar.escalaAntes} → ` +
      `${insertar.escalaDespues} px/m): doubleClickZoom tiene que estar apagado mientras vive la ` +
      'edición.',
  )
}
if (insertar.fueraDeLaRectaM !== null && Math.abs(insertar.fueraDeLaRectaM) > 0.01) {
  problemas.push(
    `El vértice insertado ha quedado a ${insertar.fueraDeLaRectaM} m de la recta del lindero: ` +
      'tenía que caer PROYECTADO sobre el lado, no en el punto crudo del clic.',
  )
}

// Y el clic derecho sobre ESE vértice nuevo. Al estar sobre el lado, quitarlo tiene
// que devolver el anillo EXACTAMENTE al de antes de insertarlo.
const iconoNuevo = iconoDe(3)
let eliminar = { medido: false, motivo: 'No se insertó ningún vértice que eliminar.' }
if (iconoNuevo !== null && insertar.filasDespues === insertar.filasAntes + 1) {
  const c = centroDe(iconoNuevo)
  const eventoContextual = new MouseEvent('contextmenu', {
    ...BASE_RATON,
    clientX: Math.round(c.x),
    clientY: Math.round(c.y),
    button: 2,
    buttons: 2,
  })
  iconoNuevo.dispatchEvent(eventoContextual)
  await dormir(MS_PROPAGAR + 120)

  const anilloTrasEliminar = anilloDeLaTabla()
  eliminar = {
    medido: true,
    filasAntes: insertar.filasDespues,
    filasDespues: anilloTrasEliminar.length,
    // Sin esto saldría ADEMÁS el menú contextual del navegador encima del vértice.
    menuDelNavegadorPrevenido: eventoContextual.defaultPrevented,
    renglon: renglon(),
    anilloVuelveAlDeAntes:
      anilloTrasEliminar.length === anilloAntesDeInsertar.length &&
      anilloTrasEliminar.every(
        (v, i) => v[0] === anilloAntesDeInsertar[i][0] && v[1] === anilloAntesDeInsertar[i][1],
      ),
  }

  if (eliminar.filasDespues !== eliminar.filasAntes - 1) {
    problemas.push(
      `El clic derecho sobre el vértice nuevo no lo ha eliminado (${eliminar.filasAntes} → ` +
        `${eliminar.filasDespues} filas).`,
    )
  }
  if (!eliminar.menuDelNavegadorPrevenido) {
    problemas.push(
      'El `contextmenu` no se ha cancelado: al eliminar el vértice saldría ADEMÁS el menú del ' +
        'navegador encima del mapa.',
    )
  }
  if (!eliminar.anilloVuelveAlDeAntes) {
    problemas.push(
      'Insertar un vértice sobre un lado y volver a quitarlo NO devuelve el anillo al de antes: ' +
        'el par insertar/eliminar está perdiendo precisión por el camino.',
    )
  }
}

// Lo que el marcado promete y el cableado no ata: el renglón `role="status"` dice
// ser «el desenlace de deshacer, rehacer, insertar, eliminar y desplazar», pero
// insertar y eliminar no escriben en él (nadie en `app/` llama a `insertarEn` ni a
// `eliminar`: los dos gestos viven dentro de `viewer/edicion.js`, que solo publica
// en el panel cuando la operación NO se aplica). Se MIDE y se dice; no se juzga.
const anuncios = {
  renglonTrasInsertar: insertar.renglon,
  renglonTrasEliminar: eliminar.medido ? eliminar.renglon : null,
  anunciaLaInsercion: /insert/i.test(insertar.renglon || ''),
  anunciaLaEliminacion: eliminar.medido ? /elimin|quitad/i.test(eliminar.renglon || '') : null,
}
if (!anuncios.anunciaLaInsercion || anuncios.anunciaLaEliminacion === false) {
  advertencias.push(
    'El renglón `[data-estado="edicion"]` NO anuncia ni la inserción ni la eliminación de un ' +
      `vértice (tras insertar dice ${JSON.stringify(anuncios.renglonTrasInsertar)}). El comentario ` +
      'de `viewer/barra-edicion.js` —que es quien lo fabrica desde el 2026-07-29; antes lo decía ' +
      '`index.html`— lo describe como «el desenlace de deshacer, rehacer, insertar, eliminar y ' +
      'desplazar», y de esos cinco solo tres lo escriben: los dos gestos del mapa viven en ' +
      '`viewer/edicion.js`, que solo habla cuando la operación NO se aplica. La operación SÍ es ' +
      'visible (aparece el vértice, crece la tabla, cambia el recuento de la ficha), así que esto ' +
      'no es un error silencioso; es una promesa del marcado que el cableado no ata. Decidirlo es ' +
      'del checklist humano (§7), no de este guion.',
  )
}

// ── 9 · Restauración de lo que envenenaría medidas posteriores ──────────────

soltarAlt()
const restaurado = {
  toleranciaCm: controles.tolerancia.value,
  toleranciaEsLaDeArranque: controles.tolerancia.value === String(TOLERANCIA_ARRANQUE_CM),
  snapMarcado: controles.snap.checked,
  escalaFinal: redondear(escala().pxPorMetro, 4),
  zoomComoAlArrancar:
    arranque.pxPorMetro !== null &&
    Math.abs(redondear(escala().pxPorMetro, 4) - arranque.pxPorMetro) / arranque.pxPorMetro < 0.01,
  geometriaModificada: true,
  nota:
    'La geometría queda MODIFICADA a propósito (un lindero desplazado 0,50 m), como en ' +
    '03-arrastre.js. Lo que sí se restaura: τ, el zoom y la bandera de `Alt`.',
}
if (!restaurado.toleranciaEsLaDeArranque) {
  problemas.push(
    `El guion no ha devuelto la tolerancia a ${TOLERANCIA_ARRANQUE_CM} cm (ha quedado en ` +
      `${JSON.stringify(restaurado.toleranciaCm)}): cualquier medida posterior heredaría una τ que ` +
      'no es la de producción.',
  )
}
if (!restaurado.zoomComoAlArrancar) {
  problemas.push(
    `El guion no ha devuelto el zoom al de arranque (${arranque.pxPorMetro} → ` +
      `${restaurado.escalaFinal} px/m).`,
  )
}

// ── 10 · El presupuesto de altura, después del traslado a la barra ──────────
//
// MEDIDA, no juicio (regla de oro 9). Este apartado nació midiendo lo que el
// bloque «Edición» le quitaba a la caja de vértices: 270 px fijos que la dejaban
// en 64 px, o sea 1,6 renglones para 15 vértices. **El bloque ya no existe**
// (2026-07-29): las herramientas viven en la barra flotante y la caja recupera
// esos píxeles. Lo que se sigue midiendo, y por qué:
//
//   · **la caja de vértices**, porque el presupuesto del panel no ha
//     desaparecido: sigue repartiendo alto fijo entre bloques, y el siguiente que
//     entre (F07 mete el suyo de diagnóstico) puede volver a comérsela. Ningún
//     test de la suite vigila esto — no hay layout en jsdom;
//   · **la barra**, porque lo que ganó el panel lo paga el MAPA: la barra flota
//     sobre la ortofoto. Cuánto ocupa es medible; si estorba, no.
//
// Las dos cifras van al veredicto para que el checklist humano (§7.6 y §7.6 bis)
// mire un número y no una impresión.
const cajaVertices = document.querySelector('#tabla-vertices')
const filaCualquiera = document.querySelector('#tabla-vertices tr[data-indice]')
const cabeceraTabla = document.querySelector('#tabla-vertices thead')
const barraEdicion = document.querySelector('.gml-barra-edicion')
const altoCaja = cajaVertices === null ? null : cajaVertices.getBoundingClientRect().height
const altoFila = filaCualquiera === null ? null : filaCualquiera.getBoundingClientRect().height
const altoCabecera = cabeceraTabla === null ? 0 : cabeceraTabla.getBoundingClientRect().height
const rectBarra = barraEdicion === null ? null : barraEdicion.getBoundingClientRect()

const panel = {
  queEs: 'MEDIDA de layout real, sin juicio: el umbral de «demasiado corta» es humano.',
  viewport: { ancho: window.innerWidth, alto: window.innerHeight },
  altoCajaVerticesPx: altoCaja === null ? null : Math.round(altoCaja),
  altoTotalDeLaTablaPx: cajaVertices === null ? null : cajaVertices.scrollHeight,
  altoFilaPx: altoFila === null ? null : Math.round(altoFila),
  filasALaVista: altoCaja && altoFila ? redondear(altoCaja / altoFila, 1) : null,
  // La cabecera es FIJA y no es una fila de datos: descontarla es lo que dice
  // cuántos vértices se leen de verdad. El primer renglón de debajo es además el
  // separador del recinto («EXTERIOR»), que tampoco es un vértice.
  renglonesBajoLaCabecera: altoCaja && altoFila ? redondear((altoCaja - altoCabecera) / altoFila, 1) : null,
  filasEnTotal: filasDeTabla(),
  // El bloque «Edición» del panel ya no existe; si alguien lo resucitara, esto
  // volvería a dar un número — y G16 se pondría rojo antes (los siete selectores
  // del contrato están exigidos a CERO en `index.html`).
  altoBloqueEdicionPx: (() => {
    const bloque = document.querySelector('.gml-bloque--edicion')
    return bloque === null ? null : Math.round(bloque.getBoundingClientRect().height)
  })(),
  barra:
    rectBarra === null
      ? null
      : { anchoPx: Math.round(rectBarra.width), altoPx: Math.round(rectBarra.height) },
  tarjetasDeAvisos: pesoAvisos().tarjetas,
}

// La barra es hoy la ÚNICA superficie desde la que se puede deshacer, conmutar el
// enganche o desplazar un lindero. Que falte no lo detecta el bloque de arriba
// —los siete selectores existirían igual si alguien los devolviera al panel—, así
// que se comprueba aparte.
if (barraEdicion === null) {
  problemas.push(
    'No hay `.gml-barra-edicion` en la página. Los siete controles se han encontrado, así que ' +
      'alguien los ha devuelto al marcado del panel: es el duplicado que G16 prohíbe, y la barra ' +
      'quedaría muerta en cuanto vuelva (querySelector se queda con el primero).',
  )
}

const abortadoPorTiempo = agotado()
if (abortadoPorTiempo) {
  advertencias.push(
    `Presupuesto de tiempo agotado (${TOPE_TOTAL_MS} ms): puede que alguna fase se haya medido con ` +
      'la vista sin asentar. Repite con la página recién cargada.',
  )
}

// ── Veredicto ───────────────────────────────────────────────────────────────

return {
  guion: '08-edicion',
  feature: 'F06',
  tarea: 'T6.2',
  criterios: [1, 2, 3, 4, 5],
  url: location.href,
  ok: problemas.length === 0,
  esGestoDeRatonReal: false,
  aviso:
    'Gestos SINTÉTICOS en navegador real (layout, CSS, proyección, L.Draggable y hit-testing ' +
    'reales). NO son gestos de ratón: /browse no tiene comando `drag` y su allowlist CDP no ' +
    'incluye el dominio `Input`. La ergonomía del agarre, la tecla `Alt` del sistema operativo, ' +
    'la descubribilidad de los ocho gestos (hoy en el panel de ayuda del botón «?») y si la barra ' +
    'estorba sobre la parcela son del CHECKLIST HUMANO §7.',
  tocaServiciosDelCatastro: false,
  arranque,
  paginaRecienCargada,
  coherenciaArranque,
  hitTest,
  acotaciones,
  toleranciaAplicada,
  engancheVertice,
  engancheLindero,
  historial,
  inhibicion,
  enVivo,
  coherenciaTrasC,
  sinEnganche,
  seleccion,
  offset,
  insertar,
  eliminar,
  anuncios,
  panel,
  restaurado,
  noCubierto: [
    'Snap a COLINDANTES: traerlas cuesta una petición al WFS (override O8, GUION.md §13). Se ' +
      'mide el enganche contra `geometriaOficial`, que la parcela de demostración sí trae.',
    'τ = 20 cm (el valor de producción): a la escala de arranque son ~' +
      `${arranque.toleranciaArranqueEnPx} px y \`MouseEvent.clientX\` es un entero. Se mide con ` +
      `${TOLERANCIA_MEDIDA_CM} cm y se restauran los 20.`,
    'Δ catastral en movimiento: la parcela de demostración no trae superficie declarada.',
    'Fallback de paralelismo del offset (bisel/miter-limit): exige un ángulo agudo que este ' +
      'dataset no tiene. Es de `test/edit/offset.test.js`.',
    'La consola: el buffer vive en el demonio de browse ($B console --errors, GUION.md §6).',
    'El teclado físico: `Alt` va como propiedad del evento sintético; que la intercepte el ' +
      'navegador o Windows es del checklist humano §7.2.',
  ],
  consola: {
    medidaAqui: false,
    comoSeMide: '$B console --errors',
    reglaEnGuion: 'GUION.md · §6 «Qué cuenta como consola limpia»',
  },
  advertencias,
  problemas,
  abortadoPorTiempo,
  ms: Math.round(performance.now() - t0),
}
