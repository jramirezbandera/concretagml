// scripts/smoke-navegador/05-salto-zoom.js — F03 · Fase 5.
//
// Guion de DIAGNÓSTICO. No cuelga de ningún criterio del spec y no tumba nada:
// mide, frame a frame, la transición de la imagen del WMS catastral al hacer
// zoom. Runbook y cifras de referencia en `GUION.md` §11.
//
// ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
// La revisión humana de la Fase 5 reportó: «si haces pan y luego zoom in, la
// cartografía catastral se mueve y luego vuelve a su sitio». Este guion se
// escribió para reproducirlo, y lo que midió NO fue lo que se esperaba.
//
// La hipótesis obvia era que `_alCargar` reposicionaba la imagen (`setBounds`)
// antes de que el navegador pintase el `src` nuevo, dejando un instante con el
// contenido viejo en la geometría nueva. **Existe, pero es UN solo frame** y no
// explicaba nada: el fenómeno que se ve dura 350-520 ms, tres órdenes de
// magnitud más. El guion lo sigue contando
// (`framesConContenidoViejoYGeometriaNueva`) porque es una regresión posible el
// día que alguien reordene esas dos líneas — y porque hoy sale **0**: el reflow
// forzado del fundido de entrada lo elimina de paso.
//
// El pan tampoco tenía nada que ver: el zoom SIN pan previo se comporta igual
// (524 ms frente a 349 ms; la diferencia es latencia de red).
//
// Lo que de verdad pasaba: Leaflet escala la imagen del encuadre anterior
// (1048×900 → 2096×1800) para mantenerla en su sitio geográfico mientras llega
// la nueva —350-520 ms, lo que tarda el WMS— y la nueva la sustituía de golpe,
// en un frame y A OPACIDAD PLENA. Ese corte seco es lo que el ojo lee como
// salto.
//
// ── QUÉ VIGILA HOY ──────────────────────────────────────────────────────────
// La corrección (fundido de `viewer/wms-catastro.js`) no puede quitar el cambio
// de escala: es consecuencia de «una imagen por encuadre, nunca teselas», la
// restricción central del proyecto. Lo que hace es que ese cambio ya NO coincida
// con un frente de opacidad plena. Así que lo que se mide es:
//
//   · que el cambio de escala SIGA ahí (`anchoAntes` ≈ 2 × `anchoDespues`), y
//   · que ocurra a opacidad ATENUADA, no plena.
//
// Si `opacidadEnElCambio` volviera a ser la opacidad de la capa, el fundido se
// habría perdido y el salto estaría de vuelta.
//
// ── QUÉ NO MIDE ─────────────────────────────────────────────────────────────
// No juzga si el resultado es agradable: eso es del ojo humano. Y no ejercita
// las dos redes de seguridad del fundido (encuadre deduplicado y fallo de
// carga), que cubre `test/viewer/wms-catastro.dom.test.js`.
//
// Lleva `await` real a propósito: `$B eval` solo envuelve en IIFE asíncrona el
// código que contiene `await`, y sin ese envoltorio el `return` de nivel
// superior sería un SyntaxError. NO se lo quites (GUION.md §9).

const PRESUPUESTO_MS = 25000
const arranque = performance.now()
const problemas = []

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const frame = () => new Promise((r) => requestAnimationFrame(r))

/** El `<img>` de la capa catastral superpuesta (la translúcida del overlayPane). */
const imagen = () => document.querySelector('.leaflet-overlay-pane img.leaflet-image-layer')

/** BBOX del `src`: identifica QUÉ contenido está pintado. */
function bboxDe(img) {
  if (!img || !img.src.includes('ServidorWMS.aspx')) return null
  return new URL(img.src).searchParams.get('BBOX')
}

/** Geometría en pantalla, redondeada al píxel. */
function geometriaDe(img) {
  if (!img) return null
  const r = img.getBoundingClientRect()
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
}

/** Una muestra del estado visible: contenido, geometría y opacidad EFECTIVA. */
function muestrear() {
  const img = imagen()
  return {
    t: Math.round(performance.now() - arranque),
    geometria: geometriaDe(img),
    bbox: bboxDe(img),
    // `getComputedStyle`, no `style.opacity`: durante una transición CSS el
    // atributo en línea ya vale el destino mientras lo pintado va por detrás.
    // Leer el inline daría el valor final desde el primer frame y el fundido
    // parecería instantáneo — el guion mediría su propia expectativa.
    opacidad: img ? Number(Number(getComputedStyle(img).opacity).toFixed(3)) : null,
  }
}

// ── Preparación ─────────────────────────────────────────────────────────────

const contenedor = document.getElementById('mapa')
if (!contenedor) throw new Error('05: no hay #mapa')
const botonZoom = document.querySelector('.leaflet-control-zoom-in')
if (!botonZoom) throw new Error('05: no hay botón de zoom')

// Se espera a que haya cartografía ANTES de medir: sin imagen de partida no hay
// transición que observar y el veredicto no significaría nada.
const limiteEspera = performance.now() + 8000
while (performance.now() < limiteEspera && bboxDe(imagen()) === null) await dormir(100)

const partida = muestrear()
if (partida.bbox === null) {
  problemas.push('No llegó cartografía catastral en 8 s: no hay transición que medir.')
}
const opacidadDeLaCapa = partida.opacidad

// ── Zoom, muestreando cada frame ────────────────────────────────────────────

const traza = [partida]
botonZoom.click()

const limite = performance.now() + 5000
while (performance.now() < limite) {
  await frame()
  traza.push(muestrear())
  const cola = traza.slice(-12)
  const asentado =
    cola.length === 12 &&
    cola.every(
      (m) => m.bbox !== partida.bbox && Math.abs(m.opacidad - cola[0].opacidad) < 0.001,
    )
  if (asentado) break
  if (performance.now() - arranque > PRESUPUESTO_MS) break
}

// ── Análisis ────────────────────────────────────────────────────────────────

const iCambio = traza.findIndex((m) => m.bbox !== null && m.bbox !== partida.bbox)
const huboImagenNueva = iCambio !== -1

// (1) La hipótesis REFUTADA, que se sigue vigilando: ningún frame debe mostrar
// contenido viejo con la geometría de la imagen nueva.
const geometriaFinal = traza.at(-1).geometria
let framesConContenidoViejoYGeometriaNueva = 0
for (const m of huboImagenNueva ? traza.slice(0, iCambio) : traza) {
  const g = m.geometria
  if (!g || !geometriaFinal) continue
  if (Math.abs(g.w - geometriaFinal.w) <= 2 && Math.abs(g.x - geometriaFinal.x) <= 2) {
    framesConContenidoViejoYGeometriaNueva += 1
  }
}
// El frame de partida cuenta como "geometría final" porque antes del zoom la
// imagen ya encajaba en el lienzo: se descuenta.
framesConContenidoViejoYGeometriaNueva = Math.max(0, framesConContenidoViejoYGeometriaNueva - 1)
if (framesConContenidoViejoYGeometriaNueva > 0) {
  problemas.push(
    `REGRESIÓN: ${framesConContenidoViejoYGeometriaNueva} frame(s) con la imagen VIEJA ya ` +
      'colocada en la geometría de la nueva. Revisa el orden de setBounds/setUrl en _alCargar.',
  )
}

// (2) El cambio de escala debe SEGUIR existiendo: es física de «una imagen por
// encuadre» y no se puede quitar sin teselar (prohibido).
const anchoAntes = huboImagenNueva && iCambio > 0 ? traza[iCambio - 1].geometria.w : null
const anchoDespues = huboImagenNueva ? traza[iCambio].geometria.w : null

// (3) Lo que el fundido tiene que garantizar: el cambio ocurre ATENUADO.
const opacidadEnElCambio = huboImagenNueva ? traza[iCambio].opacidad : null
const opacidadMinima = Math.min(...traza.map((m) => m.opacidad).filter((o) => o !== null))
const fundidoActivo =
  opacidadEnElCambio !== null &&
  opacidadDeLaCapa !== null &&
  opacidadEnElCambio < opacidadDeLaCapa * 0.8

if (huboImagenNueva && !fundidoActivo) {
  problemas.push(
    `El cambio de imagen ocurrió a opacidad ${opacidadEnElCambio} con la capa al ` +
      `${opacidadDeLaCapa}: el fundido NO está actuando y el salto ha vuelto.`,
  )
}

// (4) Y la opacidad debe RECUPERARSE: una capa que se queda tenue es el otro
// modo de fallo del fundido (ver las redes de seguridad del módulo).
const opacidadFinal = traza.at(-1).opacidad
const recupera =
  opacidadDeLaCapa !== null && Math.abs(opacidadFinal - opacidadDeLaCapa) < 0.02
if (huboImagenNueva && !recupera) {
  problemas.push(
    `La opacidad se quedó en ${opacidadFinal} y la capa es ${opacidadDeLaCapa}: el fundido ` +
      'no recuperó. Mira las redes de seguridad de _alCambiarEncuadre y _alFallar.',
  )
}

if (!huboImagenNueva) problemas.push('El zoom no trajo imagen nueva: la medida no concluye.')

return {
  guion: '05-salto-zoom',
  tipo: 'diagnóstico (no es criterio de aceptación)',
  ok: problemas.length === 0,
  opacidadDeLaCapa,
  // Lo que el fundido corrige:
  opacidadEnElCambio,
  opacidadMinima,
  opacidadFinal,
  fundidoActivo,
  framesDeSubidaDelFundido: huboImagenNueva
    ? traza.slice(iCambio).findIndex((m) => m.opacidad >= opacidadDeLaCapa - 0.01)
    : null,
  // Lo que el fundido NO corrige, y no debe: el cambio de escala sigue ahí.
  anchoAntes,
  anchoDespues,
  cambioDeEscalaPresente: anchoAntes !== null && anchoDespues !== null && anchoAntes > anchoDespues,
  // La hipótesis refutada, vigilada como regresión:
  framesConContenidoViejoYGeometriaNueva,
  msConLaImagenAnterior: huboImagenNueva ? traza[iCambio].t - traza[0].t : null,
  framesMuestreados: traza.length,
  ventanaDeLaTransicion: traza
    .slice(Math.max(0, iCambio - 6), iCambio + 8)
    .map((m) => ({ t: m.t, w: m.geometria && m.geometria.w, op: m.opacidad, nuevo: m.bbox !== partida.bbox })),
  abortadoPorTiempo: performance.now() - arranque > PRESUPUESTO_MS,
  problemas,
  ms: Math.round(performance.now() - arranque),
}
