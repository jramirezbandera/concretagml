// scripts/smoke-navegador/22-arranque-vacio.js — el arranque de PRODUCCIÓN.
//
// ── POR QUÉ ESTE GUION EXISTE, Y POR QUÉ NACE HOY ───────────────────────────
// El 2026-08-07 la aplicación dejó de arrancar con la parcela de demostración
// dentro (petición del autor: *«borra los datos de partida por defecto del
// módulo, para que empiece sin nada precargado»*). Los datasets siguen ahí, pero
// detrás de `?demo=`.
//
// ⛔ **Y ese mismo día, los veintiún guiones anteriores pasaron a llevar
// `?demo=real` en su `goto`** — porque miden el visor, la edición, el
// diagnóstico o el informe, y sin geometría no medirían nada. Consecuencia
// inmediata y peligrosa: **el arranque que ve el usuario de verdad dejaría de
// ejercitarlo NADIE**. Veintiún guiones en verde sobre una URL que ningún
// usuario escribe.
//
// Éste cubre ese hueco. Es el único que se lanza SIN `?demo=`.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// `test/app/main-arranque-vacio.dom.test.js` cubre el contrato del ensamblaje
// (que no lance, que el store nazca vacío, que el visor reciba `vistaInicial`,
// que el eyebrow no mienta). Lo que jsdom **no** puede decir es lo que este
// guion mide:
//
//   1. **Que el mapa enseña cartografía de verdad.** Sin geometría, el encuadre
//      cae en `vistaInicial`. Si esa rama estuviera mal, el usuario abriría la
//      aplicación y vería una cuadrícula gris — y **nada se quejaría**: no es un
//      error, es un mapa mirando a la nada. jsdom devuelve ceros y sale verde.
//   2. **Que se puede EMPEZAR.** Un arranque vacío solo vale si las vías de
//      Entrada están ahí y se pueden pulsar. Vacío + sin puertas = pantalla
//      muerta.
//   3. **Que lo que está apagado dice por qué.** Con la app vacía, casi todo lo
//      que hay en pantalla está apagado. Un botón apagado y mudo es la regla de
//      oro 1 rota justo en el primer minuto de uso.
//   4. **Que no se consulta nada.** Una aplicación que arranca sin datos no
//      tiene a quién pedírselos.
//
// ── CÓMO SE LANZA ───────────────────────────────────────────────────────────
// Con `npm run dev` levantado y la página recién cargada:
//
//   $B viewport 1280x720                              # el SUELO declarado
//   $B goto http://localhost:PUERTO/concretagml/      # ⛔ SIN ?demo=, es el punto
//   $B wait ".gml-rail-pasos"
//   $B console --clear
//   $B network --clear
//   $B eval scripts/smoke-navegador/22-arranque-vacio.js
//   $B console --errors                               # → (no console errors)
//
// ⚠️ **`$B network --clear` antes de lanzarlo**, o la sección 4 atribuye a este
// arranque las peticiones de la página anterior. Y **recarga entre pasadas**: si
// vienes de otro guion, el store puede traer una parcela puesta y este guion
// mediría el arranque de otro (lo dice y aborta, pero mejor no llegar ahí).
//
// ⚠️ **Estado final.** No toca nada: ni carga, ni edita, ni consulta. Es el único
// guion del repositorio que se puede lanzar dos veces seguidas sin recargar.
//
// ── QUÉ **NO** MIDE ─────────────────────────────────────────────────────────
//   · **Que las tres vías FUNCIONEN.** Que «Traer del Catastro» traiga, que el
//     fichero entre, que el pegado se lea. Eso son los guiones 07, 17 y 18, y
//     cada uno tiene el suyo. Aquí se mide que la puerta EXISTE y se puede
//     pulsar, no lo que hay detrás.
//   · **Si la pantalla es acogedora.** Que un colegiado que abre esto por primera
//     vez sepa por dónde empezar no tiene número, y sigue siendo del checklist
//     humano.

const t0 = performance.now()
const problemas = []
const advertencias = []

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)

/** ¿Se ve de verdad? Caja con área y sin `visibility:hidden`. */
function visible(el) {
  if (!el) return false
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return false
  const cs = getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
}

/** Un elemento se ve ENTERO dentro del viewport (no recortado por abajo). */
const entero = (el) => {
  if (!visible(el)) return false
  const r = el.getBoundingClientRect()
  return r.top >= 0 && r.bottom <= window.innerHeight + 1
}

// ── 0 · ¿Estamos midiendo lo que creemos? ───────────────────────────────────
//
// ⛔ La comprobación más importante del guion, y va primero. Si la URL trae
// `?demo=` o si el store ya tiene una parcela (porque vienes de otro guion sin
// recargar), **todo lo de abajo mediría el arranque de otra aplicación** y saldría
// verde. Es el fallo que el guion 09 pagó midiendo demasiado tarde.

const query = new URLSearchParams(location.search)
const demoEnLaUrl = query.get('demo')
const filasDeVertices = $$('#tabla-vertices tr[data-indice]').length
const refcatFicha = $('[data-ficha="refcat"]')?.textContent.trim() ?? ''
const eyebrow = $('[data-eyebrow]')?.textContent.trim() ?? ''

const contexto = {
  url: location.href,
  demoEnLaUrl,
  viewport: { ancho: window.innerWidth, alto: window.innerHeight },
  filasDeVertices,
  eyebrow,
  refcatFicha,
}

if (demoEnLaUrl !== null) {
  problemas.push(
    `La URL trae \`?demo=${demoEnLaUrl}\`. Este guion mide el arranque de PRODUCCIÓN, que es el ` +
      `que NO lleva query: lánzalo sobre \`…/concretagml/\` a secas. Con \`?demo=\` todo lo de ` +
      `abajo mediría otra aplicación y saldría verde.`,
  )
}

if (filasDeVertices > 0) {
  problemas.push(
    `Hay ${filasDeVertices} vértices en la tabla: la página NO viene recién cargada, o alguien ha ` +
      `traído una parcela. Recarga (\`$B reload\`) antes de lanzar este guion.`,
  )
}

// ── 1 · El mapa: cartografía de verdad, no una cuadrícula gris ─────────────
//
// Sin geometría el encuadre cae en `vistaInicial` (`app/main.js#VISTA_SIN_PARCELA`,
// España entera). Es la rama que se toma SIEMPRE al abrir desde hoy, y la que
// jsdom no puede mirar.

const mapaNodo = $('#mapa') ?? $('.gml-mapa') ?? $('.leaflet-container')
const cajaMapa = mapaNodo ? mapaNodo.getBoundingClientRect() : null

/**
 * ⚠️ **SE ESPERA A LAS TESELAS, Y NO ES UN `sleep` DE CORTESÍA.** La cifra que
 * decide el veredicto de esta sección es cuántas teselas se han PINTADO, y
 * pintarlas es una ida y vuelta a la red del IGN. Medir sin esperar daría 0 con
 * el encuadre perfectamente sano — un rojo falso—, que es el gemelo del verde
 * falso que este guion existe para evitar. Se espera hasta que haya alguna o
 * hasta agotar el tope, y **lo que se publica es cuánto se esperó**: si un día
 * este número se acerca al tope, la cifra de teselas ya no es de fiar.
 */
const TOPE_ESPERA_MS = 6000
const t0Teselas = performance.now()
while ($$('.leaflet-tile-loaded').length === 0 && performance.now() - t0Teselas < TOPE_ESPERA_MS) {
  await new Promise((r) => setTimeout(r, 150))
}
const msEsperandoTeselas = redondear(performance.now() - t0Teselas)

/** Teselas que el navegador ha PINTADO (no las que Leaflet ha creado). */
const teselasCargadas = $$('.leaflet-tile-loaded').length

const mapa = {
  existe: mapaNodo !== null,
  ancho: cajaMapa ? redondear(cajaMapa.width) : null,
  alto: cajaMapa ? redondear(cajaMapa.height) : null,
  teselasEnElDom: $$('.leaflet-tile').length,
  teselasCargadas,
  /** Cuánto hubo que esperar a la primera tesela. Cerca del tope ⇒ desconfía. */
  msEsperandoTeselas,
  topeEsperaMs: TOPE_ESPERA_MS,
  /** El nivel de zoom al que ha quedado. Un zoom de país, no de parcela. */
  zoom: (() => {
    const z = $('.leaflet-container')?.className.match(/leaflet-zoom-(\w+)/)
    return z ? z[1] : null
  })(),
  /** La escala gráfica dice a qué distancia se está mirando, y es texto legible. */
  escala: $('.leaflet-control-scale-line')?.textContent ?? null,
  atribucion: $('.leaflet-control-attribution')?.textContent?.trim().slice(0, 80) ?? null,
}

if (!mapa.existe) {
  problemas.push('No hay contenedor de mapa en la página. Sin él no hay nada que medir aquí.')
} else {
  if (mapa.alto <= 0 || mapa.ancho <= 0) {
    problemas.push(
      `El mapa mide ${mapa.ancho}×${mapa.alto}. A 0, \`viewer/wms-catastro.js\` corta el encuadre ` +
        `sin petición, sin aviso y sin error: la pantalla se queda en blanco y nada lo dice.`,
    )
  }
  // ⭐ EL UMBRAL DE ESTE GUION. Sin geometría, si `vistaInicial` no llegara o
  // llegara mal, el mapa se queda en una cuadrícula gris — que NO es un error
  // para nadie: no hay excepción, no hay aviso, y la suite en jsdom sale verde.
  // La única prueba de que el encuadre en vacío funciona es que haya cartografía
  // PINTADA.
  if (teselasCargadas === 0) {
    problemas.push(
      `El mapa no ha pintado NI UNA tesela con la aplicación recién abierta y sin parcela. Es la ` +
        `cuadrícula gris: el encuadre en vacío (\`vistaInicial\`) no está funcionando, y este fallo ` +
        `no levanta ninguna excepción ni ningún aviso. Teselas en el DOM: ${mapa.teselasEnElDom}.`,
    )
  }
  if (mapa.escala === null) {
    advertencias.push(
      'No hay escala gráfica en el mapa. No es bloqueante, pero es lo único que dice a qué ' +
        'distancia se está mirando cuando no hay parcela de referencia.',
    )
  }
}

// ── 2 · Se puede EMPEZAR: las vías de Entrada, visibles y pulsables ────────
//
// Vacío + sin puertas = pantalla muerta. Este es el criterio que convierte «no
// hay nada cargado» en «todavía no has empezado».

const paso = document.body.dataset.paso ?? null
const rama = document.body.dataset.rama ?? null

/**
 * Las puertas de la pantalla Entrada, por su `data-accion` (contrato de la app).
 *
 * ⛔ **Estos cinco nombres están LEÍDOS del marcado, no recordados.** La primera
 * versión de este guion los escribió de memoria (`cargar-parcela`,
 * `elegir-fichero-medicion`, `pegar-coordenadas`) y dio **tres problemas rojos
 * que eran del guion y no de la aplicación**: las tres vías estaban perfectamente
 * ahí con otro nombre. Un guion que acusa por la forma del texto es el defecto
 * que este repositorio lleva anotando desde F17.
 */
const PUERTAS = [
  { accion: 'cargar-catastro', nombre: 'Traer del Catastro' },
  { accion: 'abrir-medicion', nombre: 'Elegir un fichero de medición…' },
  { accion: 'abrir-pegado', nombre: 'Pegar coordenadas…' },
  { accion: 'abrir-gml', nombre: 'Abrir un GML…' },
  { accion: 'abrir-expediente', nombre: 'Abrirlo (expediente guardado)' },
]

const puertas = PUERTAS.map(({ accion, nombre }) => {
  const el = $(`[data-accion="${accion}"]`)
  return {
    accion,
    nombre,
    existe: el !== null,
    visible: visible(el),
    entera: entero(el),
    apagada: el === null ? null : el.disabled === true,
  }
})

const entrada = {
  paso,
  rama,
  titulo: $('[data-titulo="pantalla"]')?.textContent.trim() ?? null,
  puertas,
  puertasAbiertas: puertas.filter((p) => p.visible && p.apagada === false).length,
}

if (paso !== 'entrada') {
  problemas.push(
    `La aplicación arranca en el paso «${paso}» y no en «entrada». Sin parcela no hay nada que ` +
      `validar, editar ni diagnosticar: aterrizar en otro sitio deja al usuario en una pantalla ` +
      `que no puede usar.`,
  )
}

// Al menos las DOS vías que no dependen de red ni de ficheros externos tienen que
// estar abiertas: si todas están apagadas, la aplicación arranca sin salida.
if (entrada.puertasAbiertas === 0) {
  problemas.push(
    'NINGUNA vía de Entrada está abierta con la aplicación recién abierta y vacía. La pantalla no ' +
      'tiene salida: no se puede empezar de ninguna forma.',
  )
}

for (const p of puertas) {
  if (!p.existe) {
    problemas.push(
      `Falta la vía «${p.nombre}» (\`[data-accion="${p.accion}"]\`) en la pantalla de Entrada. Con ` +
        `la app arrancando vacía, cada puerta que falta es un camino que deja de existir.`,
    )
  } else if (p.visible && !p.entera) {
    problemas.push(
      `La vía «${p.nombre}» se ve RECORTADA a ${window.innerWidth}×${window.innerHeight}: hay que ` +
        `scrollear para alcanzarla. Es el defecto que el guion 14 ya encontró con la tercera vía ` +
        `el 2026-08-06.`,
    )
  }
}

// ── 3 · Lo apagado DICE por qué (regla de oro 1) ───────────────────────────
//
// Con la app vacía, casi todo está apagado. Un botón apagado y mudo en el primer
// minuto de uso es la peor versión de la regla de oro 1.

const peldanos = $$('.gml-rail-pasos li[data-paso]').map((li) => {
  const boton = li.querySelector('button')
  const motivo = li.querySelector('.gml-rail-motivo')
  return {
    paso: li.dataset.paso,
    apagado: boton ? boton.disabled === true : null,
    motivo: motivo ? motivo.textContent.trim() : '',
  }
})

/** Botones apagados de la COLUMNA (no del rail) y qué dicen a su lado. */
const apagadosDelPanel = $$('.gml-panel button[disabled]')
  .filter((b) => visible(b))
  .map((b) => {
    // El motivo, por las tres vías que usa la casa: el renglón `role=status`
    // hermano, el `aria-describedby`, o el `title`.
    const porAria = b.getAttribute('aria-describedby')
    const descrito = porAria ? document.getElementById(porAria)?.textContent?.trim() : ''
    const hermano = b.parentElement?.querySelector('[role="status"]')?.textContent?.trim() ?? ''
    return {
      texto: b.textContent.trim().slice(0, 40),
      motivo: (descrito || hermano || b.title || '').trim(),
    }
  })

const mudez = {
  peldanosApagados: peldanos.filter((p) => p.apagado).length,
  peldanosApagadosYMudos: peldanos.filter((p) => p.apagado && p.motivo === '').map((p) => p.paso),
  botonesApagadosEnElPanel: apagadosDelPanel.length,
  botonesApagadosYMudos: apagadosDelPanel.filter((b) => b.motivo === '').map((b) => b.texto),
  peldanos,
}

if (mudez.peldanosApagadosYMudos.length > 0) {
  problemas.push(
    `${mudez.peldanosApagadosYMudos.length} peldaño(s) del rail están apagados y MUDOS ` +
      `(${mudez.peldanosApagadosYMudos.join(', ')}). Con la aplicación arrancando vacía, esto es lo ` +
      `primero que ve el usuario: un recorrido cerrado sin decir cómo abrirlo.`,
  )
}

if (mudez.botonesApagadosYMudos.length > 0) {
  advertencias.push(
    `${mudez.botonesApagadosYMudos.length} botón(es) del panel están apagados y sin motivo a la ` +
      `vista: ${mudez.botonesApagadosYMudos.join(' · ')}. No es bloqueante —el rail sí explica el ` +
      `estado general— pero cada uno es un clic que no responde y no dice por qué.`,
  )
}

// ── 4 · El arranque en vacío NO consulta nada ─────────────────────────────
//
// Una aplicación que arranca sin datos no tiene a quién pedírselos. Si esto se
// rompe, alguien ha metido una carga automática — que es exactamente lo contrario
// de lo que se pidió.

/**
 * ⛔ **SE FILTRA POR HOST AJENO, NO POR LA PALABRA «catastro» EN LA URL.** La
 * primera versión de este guion filtraba con `/catastro|wfs/i` sobre la URL
 * entera y contó **diez peticiones al Catastro** que eran
 * `…/concretagml/services/catastro.js` — los MÓDULOS de la propia aplicación,
 * servidos por Vite desde `localhost`. Un rojo redondo, escandaloso y falso.
 *
 * El criterio correcto es el ORIGEN: cualquier cosa que salga de este servidor.
 * Las teselas del IGN y del PNOA sí salen fuera, y son legítimas —son justo lo
 * que la sección 1 exige que ocurra—, así que se descuentan por host.
 */
const HOSTS_DE_CARTOGRAFIA =
  /(^|\.)(ign\.es|idee\.es|openstreetmap\.org|arcgisonline\.com|catastro\.meh\.es)$/i

/**
 * Ancho de BBOX, en metros, a partir del cual pedir la cartografía CATASTRAL deja
 * de tener sentido. 200 km es un orden de magnitud por encima de cualquier
 * término municipal.
 */
const BBOX_ABSURDO_M = 200_000

const red = (() => {
  const propio = location.origin
  const fuera = performance
    .getEntriesByType('resource')
    .map((r) => r.name)
    .filter((u) => {
      if (u.startsWith(propio)) return false // los módulos y assets de la app
      try {
        return !HOSTS_DE_CARTOGRAFIA.test(new URL(u).hostname)
      } catch {
        return false
      }
    })
  return {
    /** Peticiones a servidores AJENOS que no son cartografía. */
    aServiciosAjenos: fuera,
    /** Las de cartografía, publicadas aparte: son la prueba de la sección 1. */
    deCartografia: performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .filter((u) => {
        try {
          return !u.startsWith(propio) && HOSTS_DE_CARTOGRAFIA.test(new URL(u).hostname)
        } catch {
          return false
        }
      }).length,
    /**
     * ⚠️ **HALLAZGO ABIERTO, y por eso se mide en cada pasada en vez de taparse.**
     * La capa «Cartografía catastral» nace ENCENDIDA y `viewer/wms-catastro.js`
     * **no tiene guarda de zoom mínimo**. Mientras la aplicación abría encuadrada
     * sobre una parcela eso nunca se notó; desde que arranca mirando a España
     * entera (2026-08-07), **cada apertura pide al WMS del Catastro una imagen de
     * ~1.658 × 1.761 km** en 678×720 px, donde no se distingue una parcela ni de
     * lejos. No rompe nada y por eso no es un `problema`: es una petición inútil
     * a un servicio de una administración pública, repetida en cada apertura.
     * La decisión —poner un `minZoom` a la capa o dejarlo— es del autor.
     */
    catastroConBBoxAbsurdo: performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .filter((u) => /catastro\.meh\.es/i.test(u) && /BBOX=/i.test(u))
      .map((u) => {
        const bbox = /BBOX=([^&]+)/i.exec(u)?.[1]?.split(',').map(Number) ?? []
        if (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) return null
        return { anchoM: redondear(bbox[2] - bbox[0], 0), altoM: redondear(bbox[3] - bbox[1], 0) }
      })
      .filter((b) => b !== null && b.anchoM > BBOX_ABSURDO_M),
  }
})()
red.cuantas = red.aServiciosAjenos.length

if (red.catastroConBBoxAbsurdo.length > 0) {
  const b = red.catastroConBBoxAbsurdo[0]
  advertencias.push(
    `Se ha pedido la cartografía catastral con un BBOX de ${b.anchoM} × ${b.altoM} m ` +
      `(${redondear(b.anchoM / 1000, 0)} km de ancho). A esa escala el WMS del Catastro no ` +
      `distingue una parcela, así que la petición no sirve para nada — y se hace en CADA apertura ` +
      `desde que la aplicación arranca mirando a España entera (2026-08-07). La capa nace ` +
      `encendida y \`viewer/wms-catastro.js\` no tiene zoom mínimo. NO rompe nada: es una petición ` +
      `inútil a un servicio de una administración pública. Decisión del autor: ponerle un ` +
      `zoom mínimo a la capa, o dejarlo.`,
  )
}

if (red.cuantas > 0) {
  problemas.push(
    `El arranque en vacío ha consultado ${red.cuantas} servicio(s) ajeno(s) sin que nadie se lo ` +
      `pida: ${red.aServiciosAjenos.slice(0, 3).join(' · ')}. Una aplicación que arranca sin datos ` +
      `no tiene a quién pedírselos.`,
  )
}

// ── 5 · El rótulo de procedencia no miente ────────────────────────────────

const procedencia = {
  eyebrow,
  diceDemostracion: /demostraci[oó]n/i.test(eyebrow),
  diceCatastro: /catastro/i.test(eyebrow),
  diceCargada: /cargada/i.test(eyebrow),
}

if (procedencia.diceDemostracion || procedencia.diceCatastro || procedencia.diceCargada) {
  problemas.push(
    `El rótulo de procedencia dice «${eyebrow}» con el store VACÍO. Es el rótulo que existe para ` +
      `declarar de dónde viene el dato, afirmando un dato que no hay. Regla de oro contra ` +
      `maquillar datos.`,
  )
}

if (eyebrow === '') {
  problemas.push(
    'El rótulo de procedencia está VACÍO. Tiene que DECIR que no hay parcela, no callarse: el ' +
      'silencio se lee como «esto no ha cargado todavía».',
  )
}

return {
  guion: '22-arranque-vacio',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0),
  problemas,
  advertencias,
  noCubierto: [
    'QUE LAS TRES VÍAS FUNCIONEN. Aquí se mide que la puerta existe y se puede pulsar, no lo que hay detrás: eso son los guiones 07 (Catastro en vivo), 17 (medición propia) y 18 (pegado).',
    'SI LA PANTALLA ES ACOGEDORA. Que un colegiado que abre esto por primera vez sepa por dónde empezar no tiene número, y sigue siendo del checklist humano.',
    'QUE LA CARTOGRAFÍA SEA LA CORRECTA. Se cuentan teselas PINTADAS, no se mira qué hay en ellas: un PNOA de otra zona daría la misma cifra. El encuadre fino es del guion 02.',
  ],
  contexto,
  mapa,
  entrada,
  mudez,
  red,
  procedencia,
}
