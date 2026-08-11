// scripts/smoke-navegador/26-diccionario-errores.js — F15 · el diccionario de la Sede.
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// `test/app/dialogo-diccionario.dom.test.js` (25 pruebas) cubre el contrato: que
// abre con las 23 puestas, que pegar el mensaje real del IVG y el del ICUC deja
// su causa la primera y desplegada, que la procedencia se ve, que cerrar es
// idempotente. Todo eso lo dice jsdom, y jsdom **devuelve cero en toda medida de
// maqueta**: no hay `getBoundingClientRect` de verdad, ni scroll, ni viewport.
//
// Lo que solo se puede medir aquí, y es donde este proyecto se ha quemado antes:
//
//   1. **Que la pantalla CABE a 1280×720**, que es el suelo declarado. El caso de
//      F17 fase 5 es el precedente exacto: una tabla medía 119 px, no desbordaba,
//      y por eso **no se quejaba nadie** — estaba muda. Un `<dialog>` de 23 fichas
//      con campo, cuenta y pie es justo la forma de pieza que se sale.
//   2. **Que «Cerrar» está DENTRO de la pantalla.** F11 cerró con el CTA fuera de
//      pantalla y 18,33 px entregados al rework. Un modal cuyo botón de salir no
//      se ve es peor que una pantalla fea: es una trampa.
//   3. **Que el campo NO se va al scrollear la lista.** Es la decisión de CSS de
//      esta fase —la lista tiene su propio tope y su propio scroll— y si esa
//      regla no llegara a aplicarse, el diálogo entero scrollearía y el campo de
//      búsqueda desaparecería en cuanto se bajase. La suite no lo ve.
//   4. **Que las fichas tienen alto de verdad y el texto no se recorta.**
//   5. **Que abrir el diccionario no consulta NADA.** Es un fichero del paquete.
//
// ── CÓMO SE LANZA ───────────────────────────────────────────────────────────
// Con `npm run dev` levantado y la página recién cargada:
//
//   $B viewport 1280x720                                      # el SUELO declarado
//   $B goto http://localhost:PUERTO/concretagml/?demo=real
//   $B wait ".gml-rail-pasos"
//   $B console --clear
//   $B network --clear
//   $B eval scripts/smoke-navegador/26-diccionario-errores.js
//   $B console --errors                                       # → (no console errors)
//
// ⚠️ **No depende del dataset.** El diccionario no mira ninguna parcela, así que
// este guion sale igual con `?demo=real` que sin él. Se lanza con `?demo=real`
// por consistencia con los otros veinticuatro, no por necesidad.
//
// ⚠️ **Estado final:** el diálogo queda CERRADO y el menú de expediente cerrado.
// No toca el store, así que se puede encadenar sin recargar — cosa que casi
// ningún otro guion de este repositorio puede decir.
//
// ── QUÉ **NO** MIDE ─────────────────────────────────────────────────────────
//   · **Si lo que dice el diccionario es CIERTO.** Eso no lo decide un navegador:
//     lo decide la Sede, y lo custodian los guardianes de
//     `test/config/errores-ivg.test.js` atando cada entrada medida al sitio del
//     repositorio donde consta su medición.
//   · **Si el técnico ENCUENTRA la opción** en el menú de Expediente. Es materia
//     del checklist humano: aquí solo se mide que existe y que abre.

const t0 = performance.now()
const problemas = []
const advertencias = []

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => Number.isFinite(n) ? Number(n.toFixed(d)) : null
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const caja = (el) => {
  const r = el.getBoundingClientRect()
  return { x: redondear(r.x), y: redondear(r.y), w: redondear(r.width), h: redondear(r.height),
           top: redondear(r.top), bottom: redondear(r.bottom) }
}

const VP = { w: window.innerWidth, h: window.innerHeight }

// ── 0 · El punto de partida ──────────────────────────────────────────────────

const disparador = $('[data-menu-disparador="expediente"]')
const contexto = {
  viewport: `${VP.w}x${VP.h}`,
  paso: document.body?.dataset?.paso ?? null,
  hayDisparadorDeMenu: disparador !== null,
}

if (disparador === null) {
  return {
    guion: '26-diccionario-errores',
    ok: false,
    msTotal: redondear(performance.now() - t0),
    problemas: [
      'No existe [data-menu-disparador="expediente"]: sin el menú de Expediente no hay forma de ' +
        'llegar al diccionario. O la barra no ha montado, o la opción ha cambiado de casa.',
    ],
    advertencias,
    contexto,
  }
}

// ── 1 · Se llega desde el menú ───────────────────────────────────────────────

disparador.click()
await dormir(60)

const opcion = $('[data-accion="consultar-rechazo"]')
const apertura = {
  menuAbierto: disparador.getAttribute('aria-expanded') === 'true',
  hayOpcion: opcion !== null,
  rotulo: opcion?.textContent?.trim().replace(/\s+/g, ' ') ?? null,
  opcionVisible: opcion !== null && caja(opcion).h > 0,
}

if (!apertura.hayOpcion) {
  problemas.push(
    'El menú de Expediente NO tiene la opción [data-accion="consultar-rechazo"]. El diccionario ' +
      'existe en el paquete y no hay ninguna forma de abrirlo: es exactamente la pieza sin ' +
      'llamante que esta fase se escribió para no repetir.',
  )
}
if (apertura.hayOpcion && !apertura.opcionVisible) {
  problemas.push(
    `La opción existe pero mide 0 px de alto: está en el DOM y no en la pantalla, que es la ` +
      `forma de fallo que más veces ha dado verde en este repositorio.`,
  )
}

if (!apertura.hayOpcion) {
  disparador.click()
  return {
    guion: '26-diccionario-errores',
    ok: false,
    msTotal: redondear(performance.now() - t0),
    problemas,
    advertencias,
    contexto,
    apertura,
  }
}

opcion.click()
await dormir(120)

const dialogo = $('.gml-dialogo-diccionario')
const abierto = dialogo !== null && dialogo.hasAttribute('open')
apertura.dialogoAbierto = abierto
apertura.menuSeCerro = disparador.getAttribute('aria-expanded') !== 'true'

if (!abierto) {
  problemas.push('Pulsar la opción no ha abierto el `<dialog>` del diccionario.')
  return {
    guion: '26-diccionario-errores',
    ok: false,
    msTotal: redondear(performance.now() - t0),
    problemas,
    advertencias,
    contexto,
    apertura,
  }
}
if (!apertura.menuSeCerro) {
  advertencias.push(
    'El menú de Expediente se ha quedado abierto detrás del diálogo. No rompe nada porque el ' +
      'modal lo tapa, pero al cerrar reaparecerá colgando sobre el mapa.',
  )
}

// ── 2 · ⛔ ¿CABE? ────────────────────────────────────────────────────────────

const cajaDialogo = caja(dialogo)
const lista = $('#gml-diccionario')
const campo = $('.gml-diccionario-campo')
const cuenta = $('.gml-diccionario-cuenta')
const pie = $('.gml-dialogo-diccionario-pie')
const botonCerrar = $('[data-accion="cerrar-diccionario"]')

const maqueta = {
  dialogo: cajaDialogo,
  campo: campo ? caja(campo) : null,
  cuenta: cuenta ? caja(cuenta) : null,
  lista: lista ? caja(lista) : null,
  pie: pie ? caja(pie) : null,
  cerrar: botonCerrar ? caja(botonCerrar) : null,
  desbordaAbajo: redondear(cajaDialogo.bottom - VP.h),
  desbordaArriba: redondear(-cajaDialogo.top),
}

if (cajaDialogo.top < 0 || cajaDialogo.bottom > VP.h) {
  problemas.push(
    `El diálogo NO cabe a ${VP.w}×${VP.h}: ocupa de ${cajaDialogo.top} a ${cajaDialogo.bottom} px ` +
      `(sobresale ${Math.max(0, maqueta.desbordaArriba)} px por arriba y ` +
      `${Math.max(0, maqueta.desbordaAbajo)} px por abajo). El suelo declarado del proyecto es ` +
      `1280×720 y este es el tamaño en el que hay que verlo entero.`,
  )
}

if (botonCerrar === null) {
  problemas.push('No hay botón «Cerrar» en el pie del diálogo.')
} else {
  const c = maqueta.cerrar
  if (c.bottom > VP.h || c.top < 0 || c.h === 0) {
    problemas.push(
      `⛔ «Cerrar» está FUERA de la pantalla (arriba ${c.top}, abajo ${c.bottom}, alto ${c.h}, ` +
        `viewport ${VP.h}). Es el defecto que cerró F11 con 18,33 px entregados al rework: un ` +
        `modal cuyo botón de salir no se ve es una trampa, no una pantalla fea.`,
    )
  }
}

// ── 3 · Las 23 fichas, con alto de verdad ────────────────────────────────────

const fichas = $$('#gml-diccionario .gml-diccionario-entrada')
const cajas = fichas.map((f) => ({ clave: f.dataset.clave, ...caja(f) }))
const sinAlto = cajas.filter((c) => c.h === 0)
const resumenes = $$('#gml-diccionario .gml-diccionario-resumen')
const recortadas = resumenes
  .map((r) => ({
    clave: r.closest('.gml-diccionario-entrada')?.dataset?.clave ?? '?',
    scrollW: r.scrollWidth,
    clientW: r.clientWidth,
  }))
  .filter((r) => r.scrollW - r.clientW > 1)

const contenido = {
  cuantasFichas: fichas.length,
  textoCuenta: cuenta?.textContent?.trim() ?? null,
  altoMedioFicha: fichas.length === 0 ? null : redondear(cajas.reduce((s, c) => s + c.h, 0) / fichas.length),
  conProcedenciaMedida: fichas.filter((f) => f.dataset.diccionarioProcedencia === 'MEDIDO').length,
  plegadasAlAbrir: fichas.filter((f) => !f.open).length,
  sinAlto: sinAlto.map((c) => c.clave),
  resumenesRecortados: recortadas,
}

if (fichas.length === 0) {
  problemas.push(
    'El diccionario ha abierto VACÍO. Tiene que abrir con el catálogo entero puesto: es la ' +
      'decisión de la fase, porque los dos mensajes de rechazo que se han medido son genéricos ' +
      'y una pantalla que exige una consulta precisa no sirve para ellos.',
  )
}
if (sinAlto.length > 0) {
  problemas.push(
    `${sinAlto.length} ficha(s) miden 0 px de alto: están en el DOM y no en la pantalla ` +
      `(${sinAlto.slice(0, 3).map((c) => c.clave).join(' · ')}).`,
  )
}
if (recortadas.length > 0) {
  advertencias.push(
    `${recortadas.length} clave(s) se recortan en su renglón: ` +
      `${recortadas.slice(0, 3).map((r) => `«${r.clave}» ${r.scrollW}>${r.clientW} px`).join(' · ')}. ` +
      `La columna de claves es lo que se ojea, y una clave a medias no se ojea.`,
  )
}
if (contenido.plegadasAlAbrir !== fichas.length) {
  advertencias.push(
    `${fichas.length - contenido.plegadasAlAbrir} ficha(s) nacen desplegadas. Al abrir sin ` +
      `filtrar tienen que estar todas plegadas: desplegadas son un muro de texto que no se ojea.`,
  )
}

// ── 4 · ⭐ El campo NO se va al scrollear la lista ───────────────────────────
// La decisión de CSS de esta fase. Si la regla no llegara a aplicarse, quien
// scrollea perdería de vista el campo en el que está escribiendo.

const campoAntes = campo ? caja(campo) : null
let scroll = { medible: false }

if (lista !== null && campo !== null) {
  const puedeScrollear = lista.scrollHeight - lista.clientHeight
  lista.scrollTop = lista.scrollHeight
  await dormir(60)
  const campoDespues = caja(campo)
  scroll = {
    medible: true,
    listaScrollHeight: lista.scrollHeight,
    listaClientHeight: lista.clientHeight,
    sobranteScrollable: redondear(puedeScrollear),
    scrollTopLogrado: redondear(lista.scrollTop),
    campoAntes,
    campoDespues,
    campoSeHaMovido: redondear(Math.abs(campoDespues.top - campoAntes.top)),
    campoSigueVisible: campoDespues.top >= 0 && campoDespues.bottom <= VP.h,
  }

  if (puedeScrollear <= 0) {
    advertencias.push(
      `La lista no tiene scroll propio (scrollHeight ${lista.scrollHeight} ≤ clientHeight ` +
        `${lista.clientHeight}): con 23 fichas debería tenerlo. O el tope de alto no se está ` +
        `aplicando, o la caja se ha estirado — y entonces quien scrollea mueve el diálogo entero.`,
    )
  } else if (scroll.scrollTopLogrado === 0) {
    problemas.push(
      'La lista NO scrollea por dentro: `scrollTop` se queda en 0 con contenido de sobra. El ' +
        'scroll se lo está quedando el diálogo, así que bajar por las fichas se lleva el campo ' +
        'de búsqueda fuera de la vista.',
    )
  }

  if (!scroll.campoSigueVisible) {
    problemas.push(
      `Tras bajar la lista, el campo de búsqueda se ha salido de la pantalla (arriba ` +
        `${scroll.campoDespues.top}, abajo ${scroll.campoDespues.bottom}). En una pantalla donde ` +
        `se teclea y se mira el resultado a la vez, el campo tiene que quedarse quieto.`,
    )
  } else if (scroll.campoSeHaMovido > 2) {
    advertencias.push(
      `El campo se ha movido ${scroll.campoSeHaMovido} px al scrollear la lista. Debería quedarse ` +
        `clavado: el tope de alto de la lista existe justo para eso.`,
    )
  }

  lista.scrollTop = 0
  await dormir(40)
}

// ── 5 · Pegar el mensaje REAL del IVG ────────────────────────────────────────

const MENSAJE_IVG = 'El archivo no cumple el esquema Inspire GML'
let busqueda = { medible: false }

if (campo !== null) {
  campo.value = MENSAJE_IVG
  campo.dispatchEvent(new Event('input', { bubbles: true }))
  await dormir(80)

  const tras = $$('#gml-diccionario .gml-diccionario-entrada')
  const primera = tras[0] ?? null
  const detalle = primera?.querySelector('.gml-diccionario-detalle') ?? null
  const literal = primera?.querySelector('.gml-diccionario-literal') ?? null

  busqueda = {
    medible: true,
    pegado: MENSAJE_IVG,
    cuantasCasan: tras.length,
    primeraClave: primera?.dataset?.clave ?? null,
    primeraDesplegada: primera?.open === true,
    diceQueCasaElLiteral: literal !== null && caja(literal).h > 0,
    altoDetalle: detalle ? caja(detalle).h : null,
    textoCuenta: $('.gml-diccionario-cuenta')?.textContent?.trim() ?? null,
  }

  if (busqueda.primeraClave !== 'wfs:FeatureCollection en la raíz') {
    problemas.push(
      `Pegado el mensaje que el IVG devolvió DE VERDAD el 2026-07-27 («${MENSAJE_IVG}»), la ` +
        `primera entrada es «${busqueda.primeraClave}» y tenía que ser la raíz ` +
        `\`wfs:FeatureCollection\`, que es la causa medida de aquel rechazo.`,
    )
  }
  if (!busqueda.primeraDesplegada) {
    problemas.push(
      'La entrada que casa con el mensaje literal NO se ha desplegado sola. Es el pago de esta ' +
        'pantalla: pegar el rechazo y leer la causa sin un clic más.',
    )
  }
  if (!busqueda.diceQueCasaElLiteral) {
    problemas.push(
      'Falta el rótulo «Casa con el mensaje literal que devuelve la Sede», que es lo que separa ' +
        'un acierto seguro de una coincidencia por palabras sueltas.',
    )
  }
  if (busqueda.altoDetalle !== null && busqueda.altoDetalle < 40) {
    problemas.push(
      `El detalle de la entrada desplegada mide ${busqueda.altoDetalle} px: son tres apartados de ` +
        `texto, así que o está recortado o no se ha pintado.`,
    )
  }

  // ⛔ Y LO QUE ESTE GUION DESTAPÓ EN SU PRIMERA CORRIDA (2026-08-11).
  // Con este mismo mensaje casan QUINCE de las 23, y solo UNA por el literal:
  // las otras catorce comparten «archivo» o «esquema», que en un diccionario de
  // errores de esquema las comparte medio catálogo. La cuenta decía «15 de 23
  // entradas casan con lo que has pegado», o sea la aplicación afirmando más de
  // lo que sabe. Ahora separa las dos cosas, y este guardián lo vigila.
  busqueda.casanFlojo = busqueda.cuantasCasan - 1
  if (busqueda.cuantasCasan > 1 && !/literal/i.test(busqueda.textoCuenta ?? '')) {
    problemas.push(
      `La cuenta dice «${busqueda.textoCuenta}» con ${busqueda.cuantasCasan} entradas en pantalla ` +
        `de las que solo UNA casa por el mensaje literal. Un número a secas se lee como ` +
        `«${busqueda.cuantasCasan} respuestas» cuando hay una, y las otras ` +
        `${busqueda.casanFlojo} solo comparten una palabra común. La cuenta tiene que separar lo ` +
        `fuerte de lo flojo.`,
    )
  }

  // Se deja el campo limpio para que el estado final sea el de reposo.
  campo.value = ''
  campo.dispatchEvent(new Event('input', { bubbles: true }))
  await dormir(60)
}

// ── 6 · Abrir el diccionario no consulta nada ───────────────────────────────
// El diccionario viaja en el paquete. Una petición aquí significaría que alguien
// ha colgado el catálogo de un `fetch`, y entonces la pantalla dejaría de
// funcionar exactamente el día que hace falta: sin cobertura, en obra.

const red = (() => {
  if (typeof performance.getEntriesByType !== 'function') return { medible: false }
  const desde = t0
  const ajenas = performance
    .getEntriesByType('resource')
    .filter((e) => e.startTime >= desde)
    .map((e) => e.name)
    .filter((n) => !n.startsWith(location.origin))
  return { medible: true, cuantasAjenas: ajenas.length, aServiciosAjenos: ajenas.slice(0, 5) }
})()

if (red.medible && red.cuantasAjenas > 0) {
  problemas.push(
    `Abrir el diccionario ha consultado ${red.cuantasAjenas} servicio(s) ajeno(s): ` +
      `${red.aServiciosAjenos.join(' · ')}. El catálogo viaja en el paquete y tiene que abrirse ` +
      `sin red — es la pantalla que se consulta cuando algo ha ido mal.`,
  )
}

// ── 7 · Cerrar, y no dejar rastro ───────────────────────────────────────────

document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
dialogo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
await dormir(100)

const cierre = {
  sigueAbierto: dialogo.hasAttribute('open'),
  menuAbierto: disparador.getAttribute('aria-expanded') === 'true',
}

if (cierre.sigueAbierto) {
  const cerrarBoton = $('[data-accion="cerrar-diccionario"]')
  cerrarBoton?.click()
  await dormir(80)
  cierre.cerroConElBoton = !dialogo.hasAttribute('open')
  problemas.push(
    '`Escape` no cierra el diccionario. Es el gesto por defecto de un `<dialog>` y el que la ' +
      'gente usa sin pensar.',
  )
}

if (cierre.menuAbierto) {
  disparador.click()
  await dormir(40)
}

return {
  guion: '26-diccionario-errores',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0),
  problemas,
  advertencias,
  noCubierto: [
    'SI LO QUE DICE EL DICCIONARIO ES CIERTO. Eso no lo decide un navegador: lo decide la Sede. Lo custodian los guardianes de test/config/errores-ivg.test.js, que atan cada entrada MEDIDA al sitio del repositorio donde consta su medición.',
    'SI EL TÉCNICO ENCUENTRA LA OPCIÓN en el menú de Expediente. Aquí se mide que existe y que abre, no que sea descubrible: eso es del checklist humano.',
    'SI LA REDACCIÓN SE ENTIENDE. Que «Qué significa / Qué suele haber pasado / Qué hacer» le sirva a un colegiado con un rechazo delante no tiene número.',
  ],
  contexto,
  apertura,
  maqueta,
  contenido,
  scroll,
  busqueda,
  red,
  cierre,
}
