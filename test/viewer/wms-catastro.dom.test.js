// test/viewer/wms-catastro.dom.test.js — F03 · Tarea 2B.2.
//
// Este fichero es el que PROTEGE el criterio de aceptación 2 de F03: "el WMS del
// Catastro se pide una vez por encuadre, nunca en mosaico (verificable en el nº
// de peticiones al mover el mapa)". Teselar ese servicio es el mayor riesgo de
// bloqueo del proyecto (dossier §2.3/§2.5), así que aquí se CUENTAN las
// peticiones, no se confía en la implementación.
//
// Cómo se cuentan: `viewer/wms-catastro.js` precarga cada imagen en un
// `new Image()` desprendido, así que envolver `globalThis.Image` da el número
// EXACTO de peticiones al Catastro. La imagen visible del `L.ImageOverlay` la
// crea Leaflet con `document.createElement('img')` y solo recibe URLs ya
// cargadas (que en un navegador vienen de la caché), por lo que no aparece en la
// cuenta: es exactamente la distinción que se quiere medir.
//
// Proyecto Vitest `dom` (jsdom): el módulo importa Leaflet → solo-navegador.
// NINGUNA petición real de red: jsdom no descarga imágenes y los eventos
// `load`/`error` se emiten a mano con `dispararCarga` del arnés.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import L from 'leaflet'
import { ATRIBUCION } from '../../viewer/atribucion.js'
import {
  CAPAS_DEFECTO,
  CATASTRO_WMS,
  CRS_MAPA,
  FORMATO_DEFECTO,
  MAX_PIXELES_WMS,
  MENSAJES,
  MS_FUNDIDO,
  OPACIDAD_SUPERPUESTA,
  VERSION_WMS,
  crearCapaWMSCatastro,
  getMapUrl,
} from '../../viewer/wms-catastro.js'
import { NIVEL } from '../../viewer/_comun.js'
import { montarMapa, dispararCarga, esperarCiclo, espiarPeticiones } from './_ayuda-jsdom.js'

// ── Utilidades del test ───────────────────────────────────────────────────────

/** Valor CRUDO de un parámetro de la query (sin decodificar: se comprueba la forma literal). */
function parametro(url, nombre) {
  const encontrado = new RegExp(`[?&]${nombre}=([^&]*)`).exec(url)
  return encontrado ? encontrado[1] : null
}

/** Misma serialización de coordenada que el módulo (1 mm). */
const coord = (valor) => String(Number(valor.toFixed(3)))

// `espiarPeticiones` (el envoltorio de `globalThis.Image` que hace medible el
// criterio de aceptación 2) vive en el arnés `_ayuda-jsdom.js`: lo comparten esta
// suite, `capas.dom.test.js` e `index.dom.test.js`. `restaurar()` es del llamante
// — aquí se llama en el `afterEach` de cada bloque.

/** BBOX 3857 del encuadre actual, calculado FUERA del módulo (referencia independiente). */
function bboxEsperado(mapa) {
  const bounds = mapa.getBounds()
  const so = L.CRS.EPSG3857.project(bounds.getSouthWest())
  const ne = L.CRS.EPSG3857.project(bounds.getNorthEast())
  return [
    coord(Math.min(so.x, ne.x)),
    coord(Math.min(so.y, ne.y)),
    coord(Math.max(so.x, ne.x)),
    coord(Math.max(so.y, ne.y)),
  ].join(',')
}

/**
 * Desplaza el mapa de forma SINCRÓNICA y determinista. `animate:false` es
 * imprescindible: por defecto `setView` anima el pan con `PosAnimation`
 * (requestAnimationFrame), y entonces `moveend` llegaría ~250 ms después.
 */
function mover(mapa, dLat = 0.0004, dLng = 0) {
  const centro = mapa.getCenter()
  mapa.setView([centro.lat + dLat, centro.lng + dLng], mapa.getZoom(), { animate: false })
}

// BBOX del único ejemplo de GetMap empíricamente verificado (dossier §2.2:
// respuesta 200 + ACAO:*), en EPSG:25830 y con su tamaño de imagen.
const BBOX_DOSSIER = { minX: 511950, minY: 4662900, maxX: 512150, maxY: 4663100 }
const TAMANO_DOSSIER = { ancho: 756, alto: 756 }

// ── getMapUrl — función pura, agnóstica de CRS ────────────────────────────────

describe('getMapUrl · forma de la URL y orden de ejes', () => {
  it('emite todos los parámetros del GetMap, con el BBOX en orden minX,minY,maxX,maxY', () => {
    const url = getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { crs: 'EPSG:25830' })

    expect(url.startsWith(`${CATASTRO_WMS}?`)).toBe(true)
    expect(parametro(url, 'SERVICE')).toBe('WMS')
    expect(parametro(url, 'VERSION')).toBe(VERSION_WMS)
    expect(parametro(url, 'VERSION')).toBe('1.1.1') // decisión: 1.1.1 con SRS=
    expect(parametro(url, 'REQUEST')).toBe('GetMap')
    expect(parametro(url, 'SRS')).toBe('EPSG:25830')
    expect(url).not.toContain('CRS=') // 1.1.1 usa SRS, no CRS
    expect(parametro(url, 'BBOX')).toBe('511950,4662900,512150,4663100')
    expect(parametro(url, 'WIDTH')).toBe('756')
    expect(parametro(url, 'HEIGHT')).toBe('756')
    expect(parametro(url, 'FORMAT')).toBe(FORMATO_DEFECTO)
    expect(parametro(url, 'TRANSPARENT')).toBe('FALSE')
    expect(parametro(url, 'LAYERS')).toBe(CAPAS_DEFECTO.join(','))
    expect(parametro(url, 'STYLES')).toBe('') // presente aunque vacío
  })

  it('NO invierte los ejes: el BBOX nunca sale como Ymin,Xmin,… (error clásico)', () => {
    const url = getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { crs: 'EPSG:25830' })
    // Si alguien "arreglara" el orden pensando en el lat,lon de INSPIRE (4326),
    // saldría esto. Debe seguir siendo imposible.
    expect(parametro(url, 'BBOX')).not.toBe('4662900,511950,4663100,512150')
    const [a, b, c, d] = parametro(url, 'BBOX').split(',').map(Number)
    expect(a).toBeLessThan(c) // Xmin < Xmax
    expect(b).toBeLessThan(d) // Ymin < Ymax
    expect(a).toBe(BBOX_DOSSIER.minX)
    expect(b).toBe(BBOX_DOSSIER.minY)
  })

  it('SRS por defecto = EPSG:3857 (el CRS del mapa de Leaflet)', () => {
    const url = getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER)
    expect(parametro(url, 'SRS')).toBe('EPSG:3857')
    expect(parametro(url, 'SRS')).toBe(CRS_MAPA)
  })

  it('con crs EPSG:25830 (reutilización de F09) cambia SOLO el SRS: el bbox se serializa igual', () => {
    const en3857 = getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER)
    const en25830 = getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { crs: 'EPSG:25830' })
    expect(parametro(en3857, 'BBOX')).toBe(parametro(en25830, 'BBOX'))
    expect(en25830).toBe(en3857.replace('SRS=EPSG:3857', 'SRS=EPSG:25830'))
  })

  it('LAYERS lleva las seis capas por defecto unidas por coma, en orden de dibujo', () => {
    const url = getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER)
    expect(CAPAS_DEFECTO).toHaveLength(6)
    expect(parametro(url, 'LAYERS')).toBe('catastro,constru,masa,subparce,textos,limites')
  })

  it('acepta un subconjunto de capas y un formato distinto (plano del informe, F09)', () => {
    const url = getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, {
      crs: 'EPSG:25830',
      capas: ['catastro', 'limites'],
      formato: 'image/jpeg',
    })
    expect(parametro(url, 'LAYERS')).toBe('catastro,limites')
    expect(parametro(url, 'FORMAT')).toBe('image/jpeg')
  })

  it('TRANSPARENT refleja la opción (TRUE/FALSE)', () => {
    expect(parametro(getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { transparente: true }), 'TRANSPARENT'))
      .toBe('TRUE')
    expect(
      parametro(getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { transparente: false }), 'TRANSPARENT'),
    ).toBe('FALSE')
  })

  it('recorta las coordenadas a 1 mm y redondea WIDTH/HEIGHT a entero (el WMS los exige)', () => {
    const url = getMapUrl(
      { minX: 439240.123456, minY: 4479655.987654, maxX: 439260.5, maxY: 4479670 },
      { ancho: 800.4, alto: 599.6 },
      { crs: 'EPSG:25830' },
    )
    expect(parametro(url, 'BBOX')).toBe('439240.123,4479655.988,439260.5,4479670')
    expect(parametro(url, 'WIDTH')).toBe('800')
    expect(parametro(url, 'HEIGHT')).toBe('600')
  })
})

describe('getMapUrl · contratos rotos por el programador → throw (regla de oro 1)', () => {
  it('bbox ausente, incompleto o no numérico → TypeError', () => {
    expect(() => getMapUrl(undefined, TAMANO_DOSSIER)).toThrow(TypeError)
    expect(() => getMapUrl(null, TAMANO_DOSSIER)).toThrow(TypeError)
    expect(() => getMapUrl({ minX: 0, minY: 0, maxX: 1 }, TAMANO_DOSSIER)).toThrow(TypeError)
    expect(() => getMapUrl({ minX: 0, minY: 0, maxX: '1', maxY: 1 }, TAMANO_DOSSIER)).toThrow(
      TypeError,
    )
    expect(() => getMapUrl({ minX: 0, minY: 0, maxX: NaN, maxY: 1 }, TAMANO_DOSSIER)).toThrow(
      TypeError,
    )
    expect(() => getMapUrl([0, 0, 1, 1], TAMANO_DOSSIER)).toThrow(TypeError)
  })

  it('BBOX degenerado o invertido (minX >= maxX, minY >= maxY) → RangeError', () => {
    expect(() => getMapUrl({ minX: 10, minY: 0, maxX: 10, maxY: 1 }, TAMANO_DOSSIER)).toThrow(
      RangeError,
    )
    expect(() => getMapUrl({ minX: 20, minY: 0, maxX: 10, maxY: 1 }, TAMANO_DOSSIER)).toThrow(
      RangeError,
    )
    expect(() => getMapUrl({ minX: 0, minY: 5, maxX: 10, maxY: 5 }, TAMANO_DOSSIER)).toThrow(
      RangeError,
    )
  })

  it('tamaño 0, negativo o no numérico → RangeError/TypeError', () => {
    expect(() => getMapUrl(BBOX_DOSSIER, { ancho: 0, alto: 600 })).toThrow(RangeError)
    expect(() => getMapUrl(BBOX_DOSSIER, { ancho: 800, alto: 0 })).toThrow(RangeError)
    expect(() => getMapUrl(BBOX_DOSSIER, { ancho: -800, alto: 600 })).toThrow(RangeError)
    expect(() => getMapUrl(BBOX_DOSSIER, { ancho: '800', alto: 600 })).toThrow(TypeError)
    expect(() => getMapUrl(BBOX_DOSSIER, undefined)).toThrow(TypeError)
  })

  it('un eje por encima del techo de 4000 px del servicio → RangeError (no imagen muda)', () => {
    // Medido el 2026-07-26: el WMS recorta EN SILENCIO a 4000 px por eje y
    // devuelve HTTP 200 con un PNG de OTRO tamaño (WIDTH=4001&HEIGHT=100 →
    // 4000×2000; 5000²/8000²/10000² → 4000×4000). Sin esta guarda, el llamante
    // (F09: 2126 px para 180 mm a 300 ppp, y más en formatos grandes) trabajaría
    // con una escala equivocada sin enterarse: boquete en la regla de oro 1.
    expect(MAX_PIXELES_WMS).toBe(4000)

    // El límite EXACTO sigue siendo válido (es lo que el servicio sí sirve).
    expect(() =>
      getMapUrl(BBOX_DOSSIER, { ancho: MAX_PIXELES_WMS, alto: MAX_PIXELES_WMS }),
    ).not.toThrow()

    // Un solo píxel más, en cualquiera de los dos ejes, lanza.
    expect(() =>
      getMapUrl(BBOX_DOSSIER, { ancho: MAX_PIXELES_WMS + 1, alto: 100 }),
    ).toThrow(RangeError)
    expect(() =>
      getMapUrl(BBOX_DOSSIER, { ancho: 100, alto: MAX_PIXELES_WMS + 1 }),
    ).toThrow(RangeError)
    expect(() => getMapUrl(BBOX_DOSSIER, { ancho: 6000, alto: 6000 })).toThrow(RangeError)
    // El mensaje explica el techo y qué hacer (trocear/reducir), no solo que falla.
    expect(() => getMapUrl(BBOX_DOSSIER, { ancho: 6000, alto: 6000 })).toThrow(/4000/)

    // El tamaño que F09 necesita de verdad (180 mm a 300 ppp) cabe holgadamente.
    expect(() => getMapUrl(BBOX_DOSSIER, { ancho: 2126, alto: 1500 })).not.toThrow()
  })

  it('capas vacías o con comas, y formato vacío → TypeError', () => {
    expect(() => getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { capas: [] })).toThrow(TypeError)
    expect(() => getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { capas: 'catastro' })).toThrow(TypeError)
    expect(() => getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { capas: ['a,b'] })).toThrow(TypeError)
    expect(() => getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { formato: '' })).toThrow(TypeError)
  })

  it('la forma URN/URI del CRS (que sí usan el WFS y el GML) no cuela en el WMS', () => {
    expect(() =>
      getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { crs: 'urn:ogc:def:crs:EPSG::25830' }),
    ).toThrow(TypeError)
    expect(() => getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { crs: 'EPSG::25830' })).toThrow(TypeError)
    expect(() => getMapUrl(BBOX_DOSSIER, TAMANO_DOSSIER, { crs: 25830 })).toThrow(TypeError)
  })
})

// ── La capa: UNA petición por encuadre ────────────────────────────────────────

describe('crearCapaWMSCatastro · una imagen por encuadre, JAMÁS un mosaico', () => {
  let arnes
  let espia

  beforeEach(() => {
    arnes = montarMapa({ ancho: 800, alto: 600 })
    espia = espiarPeticiones() // después de montar: el mapa vacío no pide imágenes
  })

  afterEach(() => {
    espia.restaurar()
    arnes.destruir()
  })

  it('al añadirse al mapa emite EXACTAMENTE UNA petición, del encuadre completo', () => {
    const capa = crearCapaWMSCatastro().addTo(arnes.mapa)

    expect(espia.total).toBe(1)
    expect(capa.estado().peticiones).toBe(1)

    const url = espia.urls()[0]
    // El BBOX lo proyecta la CAPA (no lo pide al llamante): coincide con el
    // encuadre del mapa proyectado a 3857 por una vía independiente.
    expect(parametro(url, 'BBOX')).toBe(bboxEsperado(arnes.mapa))
    expect(parametro(url, 'SRS')).toBe('EPSG:3857')
    // Tamaño = lienzo COMPLETO. Una tesela sería 256×256: la prueba de que no
    // hay mosaico es que la imagen pedida es del tamaño del mapa.
    expect(parametro(url, 'WIDTH')).toBe(String(arnes.mapa.getSize().x))
    expect(parametro(url, 'HEIGHT')).toBe(String(arnes.mapa.getSize().y))
    expect(parametro(url, 'WIDTH')).toBe('800')
    expect(parametro(url, 'HEIGHT')).toBe('600')
  })

  it('N moveend con encuadres DISTINTOS ⇒ exactamente N peticiones (1 por encuadre)', () => {
    crearCapaWMSCatastro().addTo(arnes.mapa)
    expect(espia.total).toBe(1) // la del añadido
    dispararCarga(espia.ultima())

    const encuadres = 3
    for (let i = 0; i < encuadres; i++) {
      const antes = espia.total
      mover(arnes.mapa)
      // Exactamente UNA petición nueva por encuadre: ni cero, ni una rejilla.
      expect(espia.total).toBe(antes + 1)
      dispararCarga(espia.ultima())
    }

    expect(espia.total).toBe(1 + encuadres)
    // Todas distintas (cada una es su encuadre) y todas del lienzo completo.
    expect(new Set(espia.urls()).size).toBe(1 + encuadres)
    for (const url of espia.urls()) {
      expect(parametro(url, 'WIDTH')).toBe('800')
      expect(parametro(url, 'HEIGHT')).toBe('600')
      expect(url).not.toContain('WIDTH=256')
      expect(url).not.toContain('TILE') // ni rastro de vocabulario de teselas
    }
  })

  it('un moveend SIN cambio de encuadre ⇒ 0 peticiones nuevas (deduplicación por URL)', () => {
    const capa = crearCapaWMSCatastro().addTo(arnes.mapa)
    dispararCarga(espia.ultima())
    expect(espia.total).toBe(1)

    arnes.mapa.fire('moveend')
    arnes.mapa.fire('moveend')
    arnes.mapa.fire('resize')

    expect(espia.total).toBe(1)
    expect(capa.estado().peticiones).toBe(1)
  })

  it('getEvents() declara moveend y resize, y NO zoomend (decisión 2 de la cabecera)', () => {
    // Este test es el que tiene DIENTES contra la regresión: si alguien añade
    // `zoomend` "por completitud", falla aquí. La razón está medida en el test
    // siguiente y en la cabecera del módulo.
    const eventos = Object.keys(crearCapaWMSCatastro().getEvents())
    expect(eventos).toContain('moveend')
    expect(eventos).toContain('resize')
    expect(eventos).not.toContain('zoomend')
  })

  it('se escucha moveend y NO zoomend: un zoom emite AMBOS y aun así solo pide 1 imagen', () => {
    // Razón de ser de la decisión (cabecera del módulo, punto 2): Leaflet emite
    // zoomend Y moveend en cada zoom; suscribir los dos DUPLICARÍA la cuenta
    // justo en la medición del criterio de aceptación 2.
    crearCapaWMSCatastro().addTo(arnes.mapa)
    dispararCarga(espia.ultima())

    const emitidos = []
    arnes.mapa.on('zoomend', () => emitidos.push('zoomend'))
    arnes.mapa.on('moveend', () => emitidos.push('moveend'))

    const antes = espia.total
    arnes.mapa.setZoom(arnes.mapa.getZoom() - 1)

    // Evidencia empírica de que los dos eventos llegan por un solo zoom:
    expect(emitidos).toEqual(['zoomend', 'moveend'])
    // …y de que la capa sigue pidiendo UNA sola imagen.
    expect(espia.total).toBe(antes + 1)
  })

  it('nunca hay más de una petición en vuelo por instancia (no hay rejilla concurrente)', () => {
    const capa = crearCapaWMSCatastro().addTo(arnes.mapa)
    // Tres encuadres seguidos SIN resolver ninguno: aunque se solapen, cada
    // encuadre aporta una única imagen.
    mover(arnes.mapa)
    mover(arnes.mapa)
    expect(espia.total).toBe(3)
    expect(capa.estado().peticiones).toBe(3)
    // Y las tres son del lienzo completo, con BBOX distintos (no una malla del
    // mismo encuadre).
    const bboxes = espia.urls().map((url) => parametro(url, 'BBOX'))
    expect(new Set(bboxes).size).toBe(3)
  })
})

describe('crearCapaWMSCatastro · intercambio de imagen y carreras', () => {
  let arnes
  let espia

  beforeEach(() => {
    arnes = montarMapa({ ancho: 800, alto: 600 })
    espia = espiarPeticiones()
  })

  afterEach(() => {
    espia.restaurar()
    arnes.destruir()
  })

  it('mantiene la imagen previa visible hasta que la nueva ha cargado', () => {
    const capa = crearCapaWMSCatastro().addTo(arnes.mapa)
    const visible = () => capa.getElement().getAttribute('src')

    // Antes de la primera carga, la imagen visible es el GIF 1×1 de Leaflet
    // (data: URI → cero peticiones de red).
    expect(visible()).toBe(L.Util.emptyImageUrl)
    expect(capa.urlVisible()).toBeNull()

    const url1 = espia.urls()[0]
    dispararCarga(espia.imagenes[0])
    expect(visible()).toBe(url1)
    expect(capa.urlVisible()).toBe(url1)

    mover(arnes.mapa)
    const url2 = espia.urls()[1]
    expect(url2).not.toBe(url1)
    // Petición en vuelo: la imagen visible NO se ha tocado (nada de hueco blanco).
    expect(visible()).toBe(url1)

    dispararCarga(espia.imagenes[1])
    expect(visible()).toBe(url2)
    expect(capa.getBounds().equals(arnes.mapa.getBounds())).toBe(true)
  })

  it('carrera: la respuesta lenta de un encuadre viejo NO pisa la imagen más nueva', async () => {
    const capa = crearCapaWMSCatastro().addTo(arnes.mapa)
    dispararCarga(espia.imagenes[0])

    mover(arnes.mapa) // encuadre VIEJO  → imagenes[1]
    mover(arnes.mapa) // encuadre NUEVO  → imagenes[2]
    const urlVieja = espia.urls()[1]
    const urlNueva = espia.urls()[2]
    expect(urlVieja).not.toBe(urlNueva)

    dispararCarga(espia.imagenes[2]) // el NUEVO resuelve primero
    await esperarCiclo()
    dispararCarga(espia.imagenes[1]) // el VIEJO llega tarde
    await esperarCiclo()

    expect(capa.getElement().getAttribute('src')).toBe(urlNueva)
    expect(capa.urlVisible()).toBe(urlNueva)
    // El token de secuencia lo descartó: se contabiliza, no se aplica.
    expect(capa.estado().descartadas).toBe(1)
    expect(capa.estado().cargadas).toBe(3)
    expect(capa.estado().aplicadas).toBe(2)
  })
})

describe('crearCapaWMSCatastro · errores de carga (regla de oro 1: nunca callado)', () => {
  let arnes
  let espia
  let avisos

  beforeEach(() => {
    arnes = montarMapa({ ancho: 800, alto: 600 })
    espia = espiarPeticiones()
    avisos = []
  })

  afterEach(() => {
    espia.restaurar()
    arnes.destruir()
  })

  const alAvisar = (mensaje, detalle) => avisos.push({ mensaje, detalle })

  it('sin ninguna imagen previa: avisa UNA vez con nivel AVISO y el mensaje "sin cartografía"', () => {
    const capa = crearCapaWMSCatastro({ alAvisar }).addTo(arnes.mapa)

    dispararCarga(espia.imagenes[0], { error: true })

    expect(avisos).toHaveLength(1)
    expect(avisos[0].mensaje).toBe(MENSAJES.SIN_CARTOGRAFIA)
    // NIVEL.AVISO, no ERROR (hallazgo 2.5): cartografía de FONDO que no carga es
    // el mismo suceso que un tileerror del IGN y no bloquea generar el GML.
    expect(avisos[0].detalle.nivel).toBe(NIVEL.AVISO)
    expect(avisos[0].detalle.nivel).not.toBe(NIVEL.ERROR)
    expect(capa.estado().hayCartografia).toBe(false)
    expect(capa.estado().fallidas).toBe(1)
    // No hay nada que conservar: la imagen visible sigue siendo el placeholder.
    expect(capa.getElement().getAttribute('src')).toBe(L.Util.emptyImageUrl)
  })

  it('con imagen previa: avisa UNA vez, distingue "obsoleta" y CONSERVA la imagen anterior', () => {
    const capa = crearCapaWMSCatastro({ alAvisar }).addTo(arnes.mapa)
    const url1 = espia.urls()[0]
    dispararCarga(espia.imagenes[0])
    expect(avisos).toHaveLength(0)

    mover(arnes.mapa)
    dispararCarga(espia.imagenes[1], { error: true })

    expect(avisos).toHaveLength(1)
    expect(avisos[0].mensaje).toBe(MENSAJES.OBSOLETA)
    expect(avisos[0].mensaje).not.toBe(MENSAJES.SIN_CARTOGRAFIA)
    expect(avisos[0].detalle.nivel).toBe(NIVEL.AVISO)
    expect(capa.getElement().getAttribute('src')).toBe(url1) // se conserva
    expect(capa.estado()).toMatchObject({ hayCartografia: true, obsoleta: true })
  })

  it('el fallo de una petición YA SUPERADA se contabiliza pero no molesta al usuario', async () => {
    const capa = crearCapaWMSCatastro({ alAvisar }).addTo(arnes.mapa)
    dispararCarga(espia.imagenes[0])

    mover(arnes.mapa) // viejo  → imagenes[1]
    mover(arnes.mapa) // nuevo  → imagenes[2]
    dispararCarga(espia.imagenes[2]) // el vigente carga bien
    await esperarCiclo()
    dispararCarga(espia.imagenes[1], { error: true }) // el superado falla tarde

    expect(avisos).toHaveLength(0) // el usuario está viendo el encuadre correcto
    expect(capa.estado().fallidas).toBe(1)
    expect(capa.estado().descartadas).toBe(1)
    expect(capa.estado().obsoleta).toBe(false)
  })

  it('tras un fallo, el MISMO encuadre puede reintentarse (la deduplicación se libera)', () => {
    const capa = crearCapaWMSCatastro({ alAvisar }).addTo(arnes.mapa)
    const url1 = espia.urls()[0]
    dispararCarga(espia.imagenes[0], { error: true })
    expect(capa.urlPedida()).toBeNull()

    arnes.mapa.fire('moveend') // mismo encuadre, pero hay que recuperarse del fallo
    expect(espia.total).toBe(2)
    expect(espia.urls()[1]).toBe(url1)

    dispararCarga(espia.imagenes[1])
    expect(capa.urlVisible()).toBe(url1)
    expect(capa.estado().obsoleta).toBe(false)
  })

  it('un alAvisar que no es función es un contrato roto → TypeError (resolverAvisar)', () => {
    expect(() => crearCapaWMSCatastro({ alAvisar: 42 })).toThrow(TypeError)
  })
})

describe('crearCapaWMSCatastro · CORS, atribución y doble uso (base + superpuesta)', () => {
  let arnes
  let espia

  beforeEach(() => {
    arnes = montarMapa({ ancho: 800, alto: 600 })
    espia = espiarPeticiones()
  })

  afterEach(() => {
    espia.restaurar()
    arnes.destruir()
  })

  it('crossOrigin anonymous (criterio 4 / override O7) y atribución importada de atribucion.js', () => {
    const capa = crearCapaWMSCatastro().addTo(arnes.mapa)

    expect(capa.options.crossOrigin).toBe('anonymous')
    expect(capa.options.attribution).toBe(ATRIBUCION.CATASTRO)
    expect(capa.options.attribution).toBe('© Dirección General del Catastro')
    // Tanto la imagen visible del overlay como la imagen de PRECARGA (que es la
    // que de verdad descarga los píxeles) van anónimas: si no, contaminarían el
    // canvas del informe de F09.
    expect(capa.getElement().getAttribute('crossorigin')).toBe('anonymous')
    expect(espia.imagenes[0].getAttribute('crossorigin')).toBe('anonymous')
  })

  it('opts NO puede debilitar crossOrigin/attribution (invariantes no negociables)', () => {
    // Réplica deliberada del test de debilitamiento de test/services/ign.dom.test.js
    // (hallazgo 2.3 de la auditoría de coherencia): los dos módulos que construyen
    // capas deben blindar los MISMOS invariantes de la MISMA manera y tener el
    // MISMO test con dientes. Hoy `initialize` solo reenvía {pane, opacity} a
    // L.setOptions; el día que alguien añada un pass-through de `...resto` (la
    // petición natural de la Fase 3 para className/zIndex), este test es lo único
    // que impedirá que crossOrigin y attribution se debiliten en silencio.
    const capa = crearCapaWMSCatastro({
      crossOrigin: false,
      attribution: 'texto inventado',
    }).addTo(arnes.mapa)

    expect(capa.options.crossOrigin).toBe('anonymous')
    expect(capa.options.attribution).toBe(ATRIBUCION.CATASTRO)
    expect(capa.getElement().getAttribute('crossorigin')).toBe('anonymous')
  })

  it('la misma factory da base opaca en tilePane y superpuesta translúcida en overlayPane', () => {
    const base = crearCapaWMSCatastro({ rol: 'base' }).addTo(arnes.mapa)
    const encima = crearCapaWMSCatastro({ rol: 'overlay' }).addTo(arnes.mapa)

    expect(base.getElement().parentNode).toBe(arnes.mapa.getPane('tilePane'))
    expect(encima.getElement().parentNode).toBe(arnes.mapa.getPane('overlayPane'))
    expect(base.options.opacity).toBe(1)
    expect(encima.options.opacity).toBe(OPACIDAD_SUPERPUESTA)
    // La base va opaca; la superpuesta con transparencia (para ver el fondo).
    expect(parametro(espia.urls()[0], 'TRANSPARENT')).toBe('FALSE')
    expect(parametro(espia.urls()[1], 'TRANSPARENT')).toBe('TRUE')
  })

  it('base + superpuesta a la vez ⇒ 2 peticiones por encuadre: 1 POR INSTANCIA VISIBLE', () => {
    const base = crearCapaWMSCatastro({ rol: 'base' }).addTo(arnes.mapa)
    const encima = crearCapaWMSCatastro({ rol: 'overlay' }).addTo(arnes.mapa)
    expect(espia.total).toBe(2)
    dispararCarga(espia.imagenes[0])
    dispararCarga(espia.imagenes[1])

    mover(arnes.mapa)
    expect(espia.total).toBe(4)
    expect(base.estado().peticiones).toBe(2)
    expect(encima.estado().peticiones).toBe(2)
  })

  it('setOpacity regula la superpuesta (la Fase 3 le cablea un <input type="range">)', () => {
    const encima = crearCapaWMSCatastro({ rol: 'overlay' }).addTo(arnes.mapa)
    expect(encima.getElement().style.opacity).toBe(String(OPACIDAD_SUPERPUESTA))

    encima.setOpacity(0.25)
    expect(encima.options.opacity).toBe(0.25)
    expect(encima.getElement().style.opacity).toBe('0.25')
  })

  it('opciones explícitas ganan al defecto del rol (pane, opacidad, transparente, capas)', () => {
    const capa = crearCapaWMSCatastro({
      rol: 'base',
      pane: 'overlayPane',
      opacidad: 0.5,
      transparente: true,
      capas: ['catastro'],
    }).addTo(arnes.mapa)

    expect(capa.options.pane).toBe('overlayPane')
    expect(capa.options.opacity).toBe(0.5)
    expect(parametro(espia.urls()[0], 'TRANSPARENT')).toBe('TRUE')
    expect(parametro(espia.urls()[0], 'LAYERS')).toBe('catastro')
  })

  it('al quitarla del mapa deja de pedir imágenes', () => {
    const capa = crearCapaWMSCatastro().addTo(arnes.mapa)
    dispararCarga(espia.imagenes[0])
    expect(espia.total).toBe(1)

    arnes.mapa.removeLayer(capa)
    mover(arnes.mapa)
    mover(arnes.mapa)

    expect(espia.total).toBe(1)
  })

  it('un CRS distinto del mapa es un camino no implementado → RangeError explícito', () => {
    // F09 (plano a 300 ppp en EPSG:25830) no usa la capa: proyecta las esquinas
    // con geo/utm.js#forward y llama a getMapUrl directamente.
    expect(() => crearCapaWMSCatastro({ crs: 'EPSG:25830' })).toThrow(RangeError)
    expect(() => crearCapaWMSCatastro({ rol: 'inventado' })).toThrow(RangeError)
    expect(() => crearCapaWMSCatastro({ opacidad: 2 })).toThrow(RangeError)
    expect(() => crearCapaWMSCatastro({ opacidad: 'mucha' })).toThrow(TypeError)
  })
})

// ── Fundido de la imagen (Fase 5) ────────────────────────────────────────────
//
// Blinda la corrección del defecto que reportó la revisión humana: «al hacer
// zoom la cartografía catastral se mueve y luego vuelve a su sitio». Medido
// frame a frame en navegador real, NO era un error de posición —no existe ni un
// instante con la imagen vieja colocada donde va la nueva—: era que la imagen
// del encuadre anterior se muestra escalada 350-520 ms y la nueva la sustituía
// de golpe, en un frame. La corrección reparte esa discontinuidad con un
// fundido.
//
// Lo que estas pruebas vigilan por encima de todo es que el arreglo sea SOLO
// presentación: si algún día tocara una petición, el criterio de aceptación 2
// —el mayor riesgo de bloqueo del proyecto— se habría roto por un detalle
// estético. Por eso el primer `it` del bloque cuenta peticiones.
describe('crearCapaWMSCatastro · fundido de la imagen (Fase 5)', () => {
  let arnes
  let espia

  /** Opacidad efectiva del `<img>` visible del overlay. */
  const opacidadVisible = (capa) => Number(capa.getElement().style.opacity)

  beforeEach(() => {
    arnes = montarMapa({ ancho: 800, alto: 600 })
    espia = espiarPeticiones()
  })

  afterEach(() => {
    espia.restaurar()
    arnes.destruir()
  })

  it('NO cambia el número de peticiones: el criterio 2 sigue intacto', () => {
    const capa = crearCapaWMSCatastro().addTo(arnes.mapa)
    dispararCarga(espia.ultima())
    expect(espia.total).toBe(1)

    // Un zoom completo: `zoomstart` (que atenúa) + `moveend` (que pide).
    arnes.mapa.fire('zoomstart')
    mover(arnes.mapa)
    dispararCarga(espia.ultima())

    // Dos encuadres ⇒ dos peticiones. Si el fundido hubiera introducido una
    // recarga del `<img>`, un reintento o un clon, aquí saldrían más.
    expect(espia.total).toBe(2)
    expect(capa.estado().peticiones).toBe(2)
    // Y ninguna del tamaño de una tesela (la firma de un mosaico).
    for (const url of espia.urls()) expect(parametro(url, 'WIDTH')).toBe('800')
  })

  it('`zoomstart` ATENÚA la imagen visible: durante el zoom es provisional', () => {
    const capa = crearCapaWMSCatastro({ opacidad: 0.6 }).addTo(arnes.mapa)
    dispararCarga(espia.ultima())
    expect(opacidadVisible(capa)).toBeCloseTo(0.6, 5)

    arnes.mapa.fire('zoomstart')

    // Atenuada, pero NUNCA a cero: quedarse sin cartografía mientras se calca
    // desorienta más que verla tenue.
    expect(opacidadVisible(capa)).toBeLessThan(0.6)
    expect(opacidadVisible(capa)).toBeGreaterThan(0)
  })

  it('atenuar es SOLO presentación: `options.opacity` y `estado()` no mienten', () => {
    const capa = crearCapaWMSCatastro({ opacidad: 0.6 }).addTo(arnes.mapa)
    dispararCarga(espia.ultima())
    const urlAntes = capa.urlVisible()

    arnes.mapa.fire('zoomstart')

    // El fundido toca `style`, no el estado de la capa. Si tocara
    // `options.opacity`, el deslizador de `viewer/capas.js` leería un valor
    // provisional y saltaría al siguiente encuadre.
    expect(capa.options.opacity).toBe(0.6)
    expect(capa.urlVisible()).toBe(urlAntes)
    expect(capa.estado().hayCartografia).toBe(true)
  })

  it('la imagen nueva ENTRA fundida y acaba en la opacidad de la capa', () => {
    const capa = crearCapaWMSCatastro({ opacidad: 0.6 }).addTo(arnes.mapa)
    dispararCarga(espia.ultima())

    arnes.mapa.fire('zoomstart')
    mover(arnes.mapa)
    dispararCarga(espia.ultima())

    // El destino de la transición es la opacidad de la capa: el fundido sube
    // hasta ella, no la deja a medias.
    expect(opacidadVisible(capa)).toBeCloseTo(0.6, 5)
    expect(capa.getElement().style.transition).toContain(`${MS_FUNDIDO}ms`)
  })

  it('el ESTADO se aplica de inmediato, sin esperar al fundido', () => {
    // El fundido es lo último de `_alCargar` y solo toca `style`. Si el estado
    // dependiera de la animación, un navegador con animaciones reducidas —o
    // jsdom, que no anima— vería una capa que dice no tener cartografía.
    const capa = crearCapaWMSCatastro().addTo(arnes.mapa)
    dispararCarga(espia.ultima())

    expect(capa.urlVisible()).toBe(espia.urls()[0])
    expect(capa.estado().aplicadas).toBe(1)
    expect(capa.estado().hayCartografia).toBe(true)
  })

  it('el deslizador MANDA: `setOpacity` corta el fundido y aplica el valor ya', () => {
    const capa = crearCapaWMSCatastro({ opacidad: 0.6 }).addTo(arnes.mapa)
    dispararCarga(espia.ultima())
    arnes.mapa.fire('zoomstart') // deja un fundido en curso

    capa.setOpacity(0.25)

    // Sin transición pendiente y con el valor exacto: arrastrar el deslizador
    // con una transición puesta se sentiría 180 ms pegajoso.
    expect(capa.getElement().style.transition).toBe('')
    expect(opacidadVisible(capa)).toBeCloseTo(0.25, 5)
    expect(capa.options.opacity).toBe(0.25)
  })

  it('RED DE SEGURIDAD: un encuadre deduplicado tras atenuar restaura la opacidad', () => {
    // El caso que dejaría la capa atenuada PARA SIEMPRE: se atenúa en
    // `zoomstart` y el `moveend` siguiente no pide nada porque la URL no ha
    // cambiado, así que no hay ninguna carga que devuelva la opacidad.
    const capa = crearCapaWMSCatastro({ opacidad: 0.6 }).addTo(arnes.mapa)
    dispararCarga(espia.ultima())
    const peticionesAntes = espia.total

    arnes.mapa.fire('zoomstart')
    expect(opacidadVisible(capa)).toBeLessThan(0.6)

    // `moveend` SIN mover: misma URL ⇒ deduplicada ⇒ 0 peticiones.
    arnes.mapa.fire('moveend')

    expect(espia.total).toBe(peticionesAntes)
    expect(opacidadVisible(capa)).toBeCloseTo(0.6, 5)
  })

  it('RED DE SEGURIDAD: un fallo de carga tras atenuar también la restaura', () => {
    // Lo visible es la cartografía anterior y ahí se queda. Dejarla atenuada
    // sería un segundo síntoma del mismo fallo; el aviso de «obsoleta» ya lo
    // cuenta con palabras.
    const avisos = []
    const capa = crearCapaWMSCatastro({
      opacidad: 0.6,
      alAvisar: (mensaje) => avisos.push(mensaje),
    }).addTo(arnes.mapa)
    dispararCarga(espia.ultima())

    arnes.mapa.fire('zoomstart')
    mover(arnes.mapa)
    dispararCarga(espia.ultima(), { error: true })

    expect(opacidadVisible(capa)).toBeCloseTo(0.6, 5)
    expect(avisos).toContain(MENSAJES.OBSOLETA)
    expect(capa.estado().obsoleta).toBe(true)
  })

  it('retirar la capa no deja temporizadores de fundido vivos', () => {
    const capa = crearCapaWMSCatastro().addTo(arnes.mapa)
    dispararCarga(espia.ultima())
    arnes.mapa.fire('zoomstart')

    // Si `onRemove` no cancelara, quedaría un `setTimeout` apuntando a una capa
    // ya retirada: la fuga que `destruir()` existe para no dejar.
    expect(() => arnes.mapa.removeLayer(capa)).not.toThrow()
    expect(capa._temporizadorFundido).toBeNull()
  })

  it('la capa BASE (opacidad 1) también funde, y hasta 1', () => {
    // El rol `base` es opaco; el fundido debe llevarlo a 1 exacto, no a la
    // opacidad de la superpuesta.
    const capa = crearCapaWMSCatastro({ rol: 'base' }).addTo(arnes.mapa)
    dispararCarga(espia.ultima())

    arnes.mapa.fire('zoomstart')
    expect(opacidadVisible(capa)).toBeLessThan(1)

    mover(arnes.mapa)
    dispararCarga(espia.ultima())
    expect(opacidadVisible(capa)).toBeCloseTo(1, 5)
  })
})
