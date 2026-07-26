// test/viewer/capas.dom.test.js — F03 · Tarea 3B.
//
// Este fichero PROTEGE el criterio de aceptación 1 de F03 —«las cinco capas base
// conmutan; la superpuesta regula opacidad»—, que hasta ahora no cubría nadie:
// `services/ign.js` y `services/osm.js` probaban sus capas por separado y
// `viewer/mapa.js` probaba justamente que NO monta ninguna. Aquí se prueba el
// ensamblaje.
//
// Además lleva el GERMEN DE LA GUARDA TRANSVERSAL de la Fase 4: enumera los seis
// descriptores de `viewer/capas.js#CAPAS` y afirma, capa a capa, `crossOrigin` y
// atribución. La afirmación de atribución es por IDENTIDAD DE REFERENCIA con un
// valor de `viewer/atribucion.js#ATRIBUCION`, no `toContain('Catastro')`: una
// paráfrasis («(c) Direccion General del Catastro») pasaría un `toContain` y
// sería un incumplimiento de licencia. Y hay un RECORRIDO INVERSO: cada valor de
// `ATRIBUCION` tiene que ser alcanzable desde alguna capa montada — hoy ese test
// detectaría, por ejemplo, una `ATRIBUCION.OSM` que no usa nadie.
//
// Proyecto Vitest `dom` (jsdom): el módulo importa Leaflet → solo-navegador.
// NINGUNA petición real de red: jsdom no descarga imágenes ni teselas, y los
// eventos `load`/`error` se emiten a mano con `dispararCarga` del arnés.
import { describe, it, expect, vi, afterEach } from 'vitest'
import L from 'leaflet'
import {
  BASE_POR_DEFECTO,
  CAPAS,
  CAPAS_BASE,
  CAPA_BLANCO,
  CAPA_CATASTRO,
  CAPA_SUPERPUESTA,
  ID_CAPA,
  crearCapaBlanca,
  descriptorPorId,
  maxZoomNativo,
  montarCapas,
} from '../../viewer/capas.js'
import { ATRIBUCION } from '../../viewer/atribucion.js'
import { NIVEL } from '../../viewer/_comun.js'
import { MENSAJES, OPACIDAD_SUPERPUESTA } from '../../viewer/wms-catastro.js'
import { WMTS_IGN } from '../../services/ign.js'
import { OSM } from '../../services/osm.js'
import { montarMapa, dispararCarga, espiarPeticiones } from './_ayuda-jsdom.js'

// ── Utilidades del test ───────────────────────────────────────────────────────

// El `maxZoom` que `viewer/mapa.js#crearMapa` fija por defecto (24). Aquí se usa
// el arnés (`montarMapa`, que crea su propio `L.map`) para no acoplar este test
// a otro módulo, pero se le pasa un maxZoom equivalente: sin un maxZoom finito en
// el mapa, `montarCapas` no puede subir el tope de las capas teseladas y el
// escenario dejaría de ser el real.
const MAX_ZOOM_MAPA = 24

const IDS_BASE = [
  ID_CAPA.CATASTRO,
  ID_CAPA.PNOA,
  ID_CAPA.TOPOGRAFICO,
  ID_CAPA.OSM,
  ID_CAPA.BLANCO,
]

/**
 * Atribución EXACTA que debe llevar cada capa. Se escribe la CLAVE de
 * `ATRIBUCION`, no el texto: el texto vive en un solo sitio (viewer/atribucion.js)
 * y aquí se compara por referencia. `null` = sin atribución (caso «Blanco»).
 */
const ATRIBUCION_ESPERADA = {
  [ID_CAPA.CATASTRO]: ATRIBUCION.CATASTRO,
  [ID_CAPA.PNOA]: ATRIBUCION.PNOA,
  [ID_CAPA.TOPOGRAFICO]: ATRIBUCION.IGN,
  [ID_CAPA.OSM]: ATRIBUCION.OSM,
  [ID_CAPA.BLANCO]: null,
  [ID_CAPA.CATASTRO_SUPERPUESTA]: ATRIBUCION.CATASTRO,
}

/** Limpieza garantizada aunque un `expect` falle a mitad de test. */
const pendientes = []
afterEach(() => {
  while (pendientes.length) {
    const limpiar = pendientes.pop()
    try {
      limpiar()
    } catch {
      /* la limpieza nunca debe enmascarar el fallo real del test */
    }
  }
})

/**
 * Mapa del arnés + capas montadas. Devuelve todo lo que hace falta y registra su
 * limpieza en `afterEach`.
 */
function montarVisor(opcionesCapas = {}, opcionesMapa = {}) {
  const { mapa, contenedor, destruir: destruirMapa } = montarMapa({
    maxZoom: MAX_ZOOM_MAPA,
    ...opcionesMapa,
  })
  const montado = montarCapas({ mapa, ...opcionesCapas })
  const todo = { mapa, contenedor, montado }
  pendientes.push(() => {
    montado.destruir()
    destruirMapa()
  })
  return todo
}

/** Ids de las capas BASE que están ahora mismo en el mapa. */
function basesEnMapa(mapa, montado) {
  return [...montado.bases].filter(([, capa]) => mapa.hasLayer(capa)).map(([id]) => id)
}

/**
 * `espiarPeticiones` del arnés (`_ayuda-jsdom.js`) + registro automático de su
 * `restaurar()` en la pila de limpieza de esta suite. El envoltorio de
 * `globalThis.Image` es compartido con `wms-catastro.dom.test.js` e
 * `index.dom.test.js`; lo único propio de aquí es CUÁNDO se deshace.
 *
 * @returns {ReturnType<typeof espiarPeticiones>}
 */
function espiarPeticionesDeEsteTest() {
  const espia = espiarPeticiones()
  pendientes.push(() => espia.restaurar())
  return espia
}

/** Valor CRUDO de un parámetro de la query (sin decodificar). */
function parametro(url, nombre) {
  const encontrado = new RegExp(`[?&]${nombre}=([^&]*)`).exec(url)
  return encontrado ? encontrado[1] : null
}

/** El `<input>` que el control de capas ha creado para una capa concreta. */
function entradaDe(control, capa) {
  const sello = L.Util.stamp(capa)
  return control._layerControlInputs.find((input) => input.layerId === sello)
}

// ── Los descriptores como DATO inspeccionable ─────────────────────────────────

describe('viewer/capas · descriptores (recorribles sin montar un mapa)', () => {
  it('hay EXACTAMENTE 5 capas base y 1 superpuesta (spec §Capas)', () => {
    expect(CAPAS_BASE).toHaveLength(5)
    expect(CAPAS_BASE.every((d) => d.rol === 'base')).toBe(true)
    expect(CAPA_SUPERPUESTA.rol).toBe('overlay')
    expect(CAPAS).toHaveLength(6)
    expect(CAPAS.filter((d) => d.rol === 'overlay')).toHaveLength(1)
  })

  it('los ids estables son los cinco esperados, en el orden en que se ofrecen', () => {
    expect(CAPAS_BASE.map((d) => d.id)).toEqual(IDS_BASE)
    expect(CAPA_SUPERPUESTA.id).toBe(ID_CAPA.CATASTRO_SUPERPUESTA)
  })

  it('los rótulos son los cinco del spec: Catastro · Ortofoto PNOA · Topográfico IGN · OSM · Blanco', () => {
    // Literales A PROPÓSITO: el rótulo es contrato de UI (el spec los enumera) y
    // este test es la red que salta si un módulo dueño lo cambia sin querer.
    // «Ortofoto PNOA» y «Topográfico IGN (MTN)» son los rótulos que declaran
    // `WMTS_IGN['pnoa-ma'].nombre` y `WMTS_IGN['mapa-raster'].nombre` — este
    // módulo los consume TAL CUAL, no los reescribe.
    expect(CAPAS_BASE.map((d) => d.nombre)).toEqual([
      'Catastro',
      'Ortofoto PNOA',
      'Topográfico IGN (MTN)',
      'OpenStreetMap',
      'Blanco',
    ])
    expect(CAPAS_BASE[1].nombre).toBe(WMTS_IGN['pnoa-ma'].nombre)
    expect(CAPAS_BASE[2].nombre).toBe(WMTS_IGN['mapa-raster'].nombre)
    expect(CAPAS_BASE[3].nombre).toBe(OSM.nombre)
  })

  it('cada descriptor tiene la forma DescriptorCapa completa y está congelado', () => {
    for (const descriptor of CAPAS) {
      expect(typeof descriptor.id).toBe('string')
      expect(descriptor.id.length).toBeGreaterThan(0)
      expect(typeof descriptor.nombre).toBe('string')
      expect(descriptor.nombre.length).toBeGreaterThan(0)
      expect(['base', 'overlay']).toContain(descriptor.rol)
      expect(typeof descriptor.crear).toBe('function')
      expect(typeof descriptor.atribucion).toBe('string')
      expect(Object.isFrozen(descriptor)).toBe(true)
    }
    expect(Object.isFrozen(CAPAS_BASE)).toBe(true)
    expect(Object.isFrozen(CAPAS)).toBe(true)
  })

  it('la tercera WMTS del IGN (`ign-base`) queda FUERA de las cinco, a propósito', () => {
    // `services/ign.js` aísla las TRES que pide el spec; el control monta solo
    // dos. Es una elección documentada en la cabecera de viewer/capas.js, no un
    // olvido: el spec lista cinco bases y solo dos son del IGN.
    expect(CAPAS_BASE.map((d) => d.id)).not.toContain('ign-base')
    expect(WMTS_IGN['ign-base']).toBeDefined()
  })

  it('`maxNativeZoom` se declara SOLO donde existe, y con el valor del módulo dueño', () => {
    const porId = Object.fromEntries(CAPAS.map((d) => [d.id, d]))
    // Teseladas: el valor lo declara su propio módulo (no se copia a mano aquí).
    expect(porId[ID_CAPA.PNOA].maxNativeZoom).toBe(WMTS_IGN['pnoa-ma'].maxNativeZoom)
    expect(porId[ID_CAPA.TOPOGRAFICO].maxNativeZoom).toBe(WMTS_IGN['mapa-raster'].maxNativeZoom)
    expect(porId[ID_CAPA.OSM].maxNativeZoom).toBe(OSM.maxNativeZoom)
    // SIN tope nativo: el WMS del Catastro rasteriza a la resolución del lienzo
    // (una imagen por encuadre) y «Blanco» no tiene teselas que reescalar.
    // `undefined` significa «no hay tope», que no es lo mismo que «cero».
    expect(porId[ID_CAPA.CATASTRO].maxNativeZoom).toBeUndefined()
    expect(porId[ID_CAPA.CATASTRO_SUPERPUESTA].maxNativeZoom).toBeUndefined()
    expect(porId[ID_CAPA.BLANCO].maxNativeZoom).toBeUndefined()
  })

  it('la base por defecto es la Ortofoto PNOA y es una de las cinco', () => {
    expect(BASE_POR_DEFECTO).toBe(ID_CAPA.PNOA)
    expect(CAPAS_BASE.map((d) => d.id)).toContain(BASE_POR_DEFECTO)
  })

  it('descriptorPorId devuelve el descriptor y lanza RangeError con un id inventado', () => {
    expect(descriptorPorId(ID_CAPA.BLANCO)).toBe(CAPA_BLANCO)
    expect(descriptorPorId(ID_CAPA.CATASTRO)).toBe(CAPA_CATASTRO)
    expect(descriptorPorId(ID_CAPA.CATASTRO_SUPERPUESTA)).toBe(CAPA_SUPERPUESTA)
    expect(() => descriptorPorId('no-existe')).toThrow(RangeError)
  })

  it('maxZoomNativo es DERIVADO: 20 para el conjunto, null si nadie declara tope', () => {
    expect(maxZoomNativo(CAPAS)).toBe(
      Math.max(...CAPAS.map((d) => d.maxNativeZoom).filter((z) => typeof z === 'number')),
    )
    expect(maxZoomNativo(CAPAS)).toBe(20)
    // `maxZoomNativo` es una función PURA sobre cualquier conjunto: un conjunto
    // sin topes nativos (Catastro + Blanco) no tiene nada que superar, por eso
    // `null` y no `0`. Ese conjunto NO es hoy un visor montable —`montarCapas`
    // monta siempre las seis capas y no acepta subconjuntos—: se prueba el
    // contrato de la función, que es lo que quedará listo el día que sí lo sea.
    expect(maxZoomNativo([CAPA_CATASTRO, CAPA_BLANCO])).toBeNull()
    expect(maxZoomNativo([])).toBeNull()
    expect(() => maxZoomNativo('no-es-un-array')).toThrow(TypeError)
  })
})

// ── Enumeración de invariantes (guarda transversal de la Fase 4) ──────────────

describe('viewer/capas · enumeración de invariantes de TODAS las capas', () => {
  it('crear() de cada descriptor devuelve una capa con crossOrigin === "anonymous"', () => {
    // Criterio de aceptación 4 + override O7. Se recorre `CAPAS`, no una lista
    // escrita a mano: una capa nueva que alguien añada al módulo entra sola en
    // este test.
    for (const descriptor of CAPAS) {
      const capa = descriptor.crear()
      expect(capa.options.crossOrigin, `capa «${descriptor.id}»`).toBe('anonymous')
    }
  })

  it('la atribución de cada capa es IDÉNTICA POR REFERENCIA a un valor de ATRIBUCION', () => {
    // Identidad, no `toContain`: un `toContain('Catastro')` dejaría pasar una
    // paráfrasis, y reformular estos textos es incumplir la licencia (CC-BY 4.0
    // del IGN, Ley 37/2007 RISP, ODbL de OSM).
    const legales = Object.values(ATRIBUCION)
    for (const descriptor of CAPAS) {
      const capa = descriptor.crear()
      const esperada = ATRIBUCION_ESPERADA[descriptor.id]
      // El descriptor y la capa que produce nunca pueden decir cosas distintas.
      expect(capa.options.attribution, `capa «${descriptor.id}»`).toBe(descriptor.atribucion)

      if (esperada === null) {
        // Único caso vacío, y es LEGÍTIMO: ver el test específico de «Blanco».
        expect(descriptor.id).toBe(ID_CAPA.BLANCO)
        expect(capa.options.attribution).toBe('')
      } else {
        expect(capa.options.attribution).toBe(esperada)
        expect(legales.some((texto) => texto === capa.options.attribution)).toBe(true)
      }
    }
  })

  it('«Blanco»: atribución VACÍA legítima (no hay datos de terceros que citar)', () => {
    // Se afirma explícitamente, no por omisión: la capa «Blanco» es un lienzo
    // generado en el cliente —ni imagen, ni geometría, ni topónimo ajenos—, así
    // que no existe titular al que atribuir. Inventar un texto ahí sería
    // afirmar una cesión que no ha ocurrido. Por eso `ATRIBUCION` no tiene ni
    // debe tener una clave BLANCO.
    expect(CAPA_BLANCO.atribucion).toBe('')
    expect(Object.keys(ATRIBUCION)).not.toContain('BLANCO')
    const capa = CAPA_BLANCO.crear()
    expect(capa.options.attribution).toBe('')
    // Y `crossOrigin` sí va, aunque sea vacuo: la guarda transversal enumera sin
    // excepciones y un futuro `createTile` que cargara algo lo heredaría.
    expect(capa.options.crossOrigin).toBe('anonymous')
  })

  it('«Blanco» no hace NINGUNA petición de red: sus teselas son <div>, no <img>', () => {
    const espia = espiarPeticionesDeEsteTest()
    const { contenedor } = montarVisor({ baseInicial: ID_CAPA.BLANCO })

    expect(espia.total).toBe(0)
    expect(contenedor.querySelectorAll('img')).toHaveLength(0)
    const teselas = contenedor.querySelectorAll('.gml-capa-blanca > div')
    expect(teselas.length).toBeGreaterThan(0)
    for (const tesela of teselas) {
      expect(tesela.tagName).toBe('DIV')
      expect(tesela.getAttribute('src')).toBeNull()
    }
  })

  it('RECORRIDO INVERSO: cada valor de ATRIBUCION es alcanzable desde una capa montada', () => {
    // Sin este test, una `ATRIBUCION.OSM` que no usara ninguna capa del visor
    // pasaría desapercibida: el texto existiría, pero el usuario nunca lo vería
    // y el criterio de aceptación 5 estaría incumplido para esa fuente.
    const { montado } = montarVisor()
    const montadas = new Set([...montado.capas.values()].map((c) => c.options.attribution))
    for (const [clave, texto] of Object.entries(ATRIBUCION)) {
      expect(montadas.has(texto), `ATRIBUCION.${clave} no la usa ninguna capa del visor`).toBe(true)
    }
  })
})

// ── Propagación del canal de aviso (regla de oro 1) ───────────────────────────

describe('viewer/capas · propagación de alAvisar (regla 1: ningún error silencioso)', () => {
  it('un tileerror en una capa creada DESDE SU DESCRIPTOR llega al alAvisar inyectado', () => {
    // El hallazgo de la auditoría: `DescriptorCapa.crear` acepta `opts`
    // precisamente para esto. Si `viewer/capas.js` montara las capas sin pasar
    // el canal, TODOS los tileerror se quedarían en el console.warn por defecto.
    for (const descriptor of CAPAS.filter((d) => d.maxNativeZoom !== undefined)) {
      const espia = vi.fn()
      const capa = descriptor.crear({ alAvisar: espia })
      capa.fire('tileerror', { error: new Error('fallo de red') })

      expect(espia, `capa «${descriptor.id}»`).toHaveBeenCalledTimes(1)
      expect(espia.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
    }
  })

  it('montarCapas PROPAGA el canal a las capas teseladas que monta', () => {
    const espia = vi.fn()
    const { montado } = montarVisor({ alAvisar: espia })

    montado.bases.get(ID_CAPA.PNOA).fire('tileerror', { error: new Error('fallo de red') })
    expect(espia).toHaveBeenCalledTimes(1)
    expect(espia.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('montarCapas PROPAGA el canal a la base del WMS del Catastro', () => {
    const espiaImagenes = espiarPeticionesDeEsteTest()
    const espia = vi.fn()
    montarVisor({ alAvisar: espia, baseInicial: ID_CAPA.CATASTRO })

    expect(espiaImagenes.total).toBe(1)
    dispararCarga(espiaImagenes.imagenes[0], { error: true })

    expect(espia).toHaveBeenCalledTimes(1)
    expect(espia.mock.calls[0][0]).toBe(MENSAJES.SIN_CARTOGRAFIA)
    // AVISO y no ERROR: cartografía de FONDO que no carga nunca bloquea la
    // generación del GML (regla fijada junto al typedef Avisar de _comun.js).
    expect(espia.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('montarCapas PROPAGA el canal a la capa SUPERPUESTA', () => {
    const espiaImagenes = espiarPeticionesDeEsteTest()
    const espia = vi.fn()
    const { montado } = montarVisor({ alAvisar: espia, superpuestaInicial: true })

    expect(montado.superpuestaActiva()).toBe(true)
    expect(espiaImagenes.total).toBe(1)
    dispararCarga(espiaImagenes.imagenes[0], { error: true })

    expect(espia).toHaveBeenCalledTimes(1)
    expect(espia.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('alAvisar con basura es un contrato roto por el programador → TypeError', () => {
    const { mapa, destruir } = montarMapa({ maxZoom: MAX_ZOOM_MAPA })
    pendientes.push(destruir)
    expect(() => montarCapas({ mapa, alAvisar: 'no soy una función' })).toThrow(TypeError)
  })
})

// ── Conmutación de bases (criterio de aceptación 1) ───────────────────────────

describe('viewer/capas · conmutación de las cinco bases (criterio de aceptación 1)', () => {
  it('al montar hay UNA sola base activa y es la Ortofoto PNOA (defecto)', () => {
    const { mapa, montado } = montarVisor()
    expect(basesEnMapa(mapa, montado)).toEqual([BASE_POR_DEFECTO])
    expect(montado.baseActiva()).toBe(BASE_POR_DEFECTO)
  })

  it('recorrer LAS CINCO deja siempre exactamente UNA activa y las otras cuatro fuera', () => {
    const { mapa, montado } = montarVisor()

    for (const id of IDS_BASE) {
      montado.activarBase(id)

      const activas = basesEnMapa(mapa, montado)
      expect(activas, `tras activar «${id}»`).toEqual([id])
      expect(montado.baseActiva()).toBe(id)
      expect(mapa.hasLayer(montado.bases.get(id))).toBe(true)
      for (const otro of IDS_BASE.filter((x) => x !== id)) {
        expect(mapa.hasLayer(montado.bases.get(otro)), `«${otro}» debería estar fuera`).toBe(false)
      }
    }
  })

  it('un CLIC REAL en el radio del control conmuta la base y deja una sola', () => {
    // No basta con la API programática: el criterio 1 habla del control que ve
    // el usuario. Aquí se pulsa el <input type="radio"> que monta Leaflet.
    const { mapa, montado } = montarVisor()
    const capaOSM = montado.bases.get(ID_CAPA.OSM)
    const radio = entradaDe(montado.control, capaOSM)

    expect(radio).toBeDefined()
    expect(radio.type).toBe('radio')
    radio.click()

    expect(basesEnMapa(mapa, montado)).toEqual([ID_CAPA.OSM])
    // El seguimiento del estado se hace escuchando la CAPA, así que el clic en
    // el control también lo actualiza (no solo `activarBase`).
    expect(montado.baseActiva()).toBe(ID_CAPA.OSM)
  })

  it('el control monta 5 radios (bases) y 1 casilla (superpuesta), con sus rótulos', () => {
    const { contenedor, montado } = montarVisor()
    const raiz = montado.control.getContainer()
    expect(contenedor.contains(raiz)).toBe(true)

    const radios = raiz.querySelectorAll('input[type=radio]')
    const casillas = raiz.querySelectorAll('input[type=checkbox]')
    expect(radios).toHaveLength(5)
    expect(casillas).toHaveLength(1)

    const texto = raiz.textContent
    for (const descriptor of CAPAS) {
      expect(texto, `falta el rótulo «${descriptor.nombre}»`).toContain(descriptor.nombre)
    }
  })

  it('activarBase con un id desconocido —o con el de la superpuesta— lanza RangeError', () => {
    const { montado } = montarVisor()
    expect(() => montado.activarBase('no-existe')).toThrow(RangeError)
    // La superpuesta NO es una base: pedirla como tal es un contrato roto.
    expect(() => montado.activarBase(ID_CAPA.CATASTRO_SUPERPUESTA)).toThrow(RangeError)
  })

  it('baseInicial elige otra base; un baseInicial inválido lanza RangeError', () => {
    const { mapa, montado } = montarVisor({ baseInicial: ID_CAPA.TOPOGRAFICO })
    expect(basesEnMapa(mapa, montado)).toEqual([ID_CAPA.TOPOGRAFICO])

    const otro = montarMapa({ maxZoom: MAX_ZOOM_MAPA })
    pendientes.push(otro.destruir)
    expect(() => montarCapas({ mapa: otro.mapa, baseInicial: 'ign-base' })).toThrow(RangeError)
    expect(() =>
      montarCapas({ mapa: otro.mapa, baseInicial: ID_CAPA.CATASTRO_SUPERPUESTA }),
    ).toThrow(RangeError)
  })

  it('montarCapas exige un mapa de Leaflet (contrato del programador)', () => {
    expect(() => montarCapas({})).toThrow(TypeError)
    expect(() => montarCapas({ mapa: null })).toThrow(TypeError)
    expect(() => montarCapas({ mapa: {} })).toThrow(TypeError)
  })
})

// ── La capa superpuesta ───────────────────────────────────────────────────────

describe('viewer/capas · capa superpuesta', () => {
  it('no se añade por defecto; `superpuestaInicial: true` la enciende', () => {
    const { montado } = montarVisor()
    expect(montado.superpuestaActiva()).toBe(false)

    const otro = montarVisor({ superpuestaInicial: true })
    expect(otro.montado.superpuestaActiva()).toBe(true)
  })

  it('se activa y se desactiva sobre CUALQUIERA de las cinco bases', () => {
    const { mapa, montado } = montarVisor()

    for (const id of IDS_BASE) {
      montado.activarBase(id)

      montado.activarSuperpuesta(true)
      expect(montado.superpuestaActiva(), `superpuesta sobre «${id}»`).toBe(true)
      expect(mapa.hasLayer(montado.superpuesta)).toBe(true)
      // La base sigue siendo la misma: la superpuesta no la desplaza.
      expect(basesEnMapa(mapa, montado)).toEqual([id])

      montado.activarSuperpuesta(false)
      expect(montado.superpuestaActiva(), `superpuesta apagada sobre «${id}»`).toBe(false)
      expect(basesEnMapa(mapa, montado)).toEqual([id])
    }
  })

  it('un CLIC REAL en la casilla del control enciende y apaga la superpuesta', () => {
    const { montado } = montarVisor()
    const casilla = entradaDe(montado.control, montado.superpuesta)
    expect(casilla.type).toBe('checkbox')

    casilla.click()
    expect(montado.superpuestaActiva()).toBe(true)
    casilla.click()
    expect(montado.superpuestaActiva()).toBe(false)
  })

  it('base catastral en tilePane y opaca; superpuesta en overlayPane y transparente', () => {
    const { montado } = montarVisor({ baseInicial: ID_CAPA.CATASTRO, superpuestaInicial: true })

    const base = montado.bases.get(ID_CAPA.CATASTRO)
    expect(base.options.pane).toBe('tilePane')
    expect(base.options.opacity).toBe(1)
    expect(parametro(base.urlPedida(), 'TRANSPARENT')).toBe('FALSE')

    expect(montado.superpuesta.options.pane).toBe('overlayPane')
    expect(montado.superpuesta.options.opacity).toBe(OPACIDAD_SUPERPUESTA)
    expect(parametro(montado.superpuesta.urlPedida(), 'TRANSPARENT')).toBe('TRUE')
  })

  it('CRITERIO 2: base + superpuesta catastrales = 2 peticiones por encuadre, y es CORRECTO', () => {
    // El criterio real es «1 petición por capa WMS del Catastro VISIBLE», no «1
    // petición y punto». Son DOS IMÁGENES distintas del MISMO encuadre (una
    // opaca de fondo, otra con TRANSPARENT=TRUE para superponer), no una capa
    // teselada en dos trozos. Lo que el criterio prohíbe es el MOSAICO — por eso
    // aquí se comprueba que ambas piden el encuadre COMPLETO con el mismo BBOX y
    // el mismo tamaño, y que ninguna pide teselas de 256 px.
    const espia = espiarPeticionesDeEsteTest()
    montarVisor({ baseInicial: ID_CAPA.CATASTRO, superpuestaInicial: true })

    expect(espia.total).toBe(2)
    const [urlA, urlB] = espia.urls()
    expect(parametro(urlA, 'BBOX')).toBe(parametro(urlB, 'BBOX'))
    expect(parametro(urlA, 'WIDTH')).toBe(parametro(urlB, 'WIDTH'))
    expect(parametro(urlA, 'HEIGHT')).toBe(parametro(urlB, 'HEIGHT'))
    expect([parametro(urlA, 'TRANSPARENT'), parametro(urlB, 'TRANSPARENT')].sort()).toEqual([
      'FALSE',
      'TRUE',
    ])
    for (const url of espia.urls()) {
      expect(parametro(url, 'WIDTH')).not.toBe('256')
      expect(Number(parametro(url, 'WIDTH'))).toBeGreaterThan(256)
    }
  })
})

// ── Opacidad regulable (criterio de aceptación 1, segunda mitad) ──────────────

describe('viewer/capas · opacidad de la superpuesta', () => {
  it('el control de opacidad monta un <input type="range"> etiquetado en el mapa', () => {
    const { contenedor, montado } = montarVisor()
    const raiz = montado.controlOpacidad.getContainer()
    expect(contenedor.contains(raiz)).toBe(true)

    const rango = raiz.querySelector('input[type=range]')
    expect(rango).not.toBeNull()
    const etiqueta = raiz.querySelector('label')
    expect(etiqueta.getAttribute('for')).toBe(rango.id)
    expect(etiqueta.textContent.length).toBeGreaterThan(0)
    expect(rango.getAttribute('aria-label')).toBe(etiqueta.textContent)
  })

  it('fijarOpacidad cambia la opacidad EFECTIVA de la superpuesta, incluidos los extremos', () => {
    const { montado } = montarVisor({ superpuestaInicial: true })
    expect(montado.opacidad()).toBe(OPACIDAD_SUPERPUESTA)
    expect(montado.superpuesta.options.opacity).toBe(OPACIDAD_SUPERPUESTA)

    for (const valor of [0, 0.35, 1]) {
      expect(montado.fijarOpacidad(valor)).toBe(valor)
      expect(montado.opacidad()).toBe(valor)
      expect(montado.superpuesta.options.opacity, `opacidad ${valor}`).toBe(valor)
    }
  })

  it('la opacidad se ACOTA a [0,1] (viene de un gesto, no de un contrato)', () => {
    const { montado } = montarVisor({ superpuestaInicial: true })
    expect(montado.fijarOpacidad(-3)).toBe(0)
    expect(montado.superpuesta.options.opacity).toBe(0)
    expect(montado.fijarOpacidad(17)).toBe(1)
    expect(montado.superpuesta.options.opacity).toBe(1)
  })

  it('una opacidad que no es un número finito sí es contrato roto → TypeError', () => {
    const { montado } = montarVisor()
    expect(() => montado.fijarOpacidad('0.5')).toThrow(TypeError)
    expect(() => montado.fijarOpacidad(NaN)).toThrow(TypeError)
    expect(() => montado.fijarOpacidad(Infinity)).toThrow(TypeError)
  })

  it('la opacidad INICIAL fuera de [0,1] LANZA RangeError (no se acota: la escribe el programador)', () => {
    // La otra mitad de la asimetría que documenta `acotarOpacidad`: el GESTO se
    // acota (test de arriba, `fijarOpacidad(17)` → 1) porque viene de un
    // `<input type="range">`; la INICIAL la escribe el programador y acotarla
    // sería corregir en silencio un valor mal escrito (regla de oro 1). Hasta la
    // auditoría de cierre de la fase 3, `montarCapas` acotaba también esta y
    // montaba un visor a opacidad 1 sin decir nada.
    const { mapa, destruir } = montarMapa({ maxZoom: MAX_ZOOM_MAPA })
    pendientes.push(destruir)

    expect(() => montarCapas({ mapa, opacidad: 5 })).toThrow(RangeError)
    expect(() => montarCapas({ mapa, opacidad: -0.5 })).toThrow(RangeError)
    // La FORMA sigue siendo TypeError, igual que en el gesto.
    expect(() => montarCapas({ mapa, opacidad: '0.5' })).toThrow(TypeError)
    expect(() => montarCapas({ mapa, opacidad: NaN })).toThrow(TypeError)

    // Y falla ANTES de montar nada: ninguna capa ni control ha llegado al mapa.
    let capas = 0
    mapa.eachLayer(() => capas++)
    expect(capas).toBe(0)
  })

  it('los extremos exactos 0 y 1 SÍ son opacidades iniciales válidas', () => {
    // El rango es cerrado: que lance con 5 no puede convertirse en «lanza con 0».
    for (const opacidad of [0, 1]) {
      const { montado } = montarVisor({ opacidad, superpuestaInicial: true })
      expect(montado.opacidad(), `opacidad inicial ${opacidad}`).toBe(opacidad)
      expect(montado.superpuesta.options.opacity).toBe(opacidad)
    }
  })

  it('MOVER el deslizador (evento `input` real) cambia la opacidad efectiva', () => {
    const { montado } = montarVisor({ superpuestaInicial: true })
    const rango = montado.controlOpacidad.getContainer().querySelector('input[type=range]')

    rango.value = '25'
    rango.dispatchEvent(new Event('input'))
    expect(montado.superpuesta.options.opacity).toBeCloseTo(0.25, 10)
    expect(montado.opacidad()).toBeCloseTo(0.25, 10)

    // Extremos, tal como los produce el propio <input>.
    rango.value = rango.min
    rango.dispatchEvent(new Event('input'))
    expect(montado.superpuesta.options.opacity).toBe(0)

    rango.value = rango.max
    rango.dispatchEvent(new Event('input'))
    expect(montado.superpuesta.options.opacity).toBe(1)
  })

  it('fijarOpacidad por API refleja el valor en el deslizador (los dos son la misma vista)', () => {
    const { montado } = montarVisor({ superpuestaInicial: true })
    const rango = montado.controlOpacidad.getContainer().querySelector('input[type=range]')
    montado.fijarOpacidad(0.8)
    expect(Number(rango.value)).toBe(80)
  })

  it('el control se DESHABILITA cuando la superpuesta no está activa, y se rehabilita al activarla', () => {
    const { montado } = montarVisor()
    const raiz = montado.controlOpacidad.getContainer()
    const rango = raiz.querySelector('input[type=range]')

    // Arranca sin superpuesta: un control de opacidad de algo que no se ve
    // mentiría.
    expect(rango.disabled).toBe(true)
    expect(raiz.getAttribute('aria-disabled')).toBe('true')

    montado.activarSuperpuesta(true)
    expect(rango.disabled).toBe(false)
    expect(raiz.getAttribute('aria-disabled')).toBe('false')

    montado.activarSuperpuesta(false)
    expect(rango.disabled).toBe(true)
  })

  it('`opacidad` inicial se aplica a la capa y al deslizador', () => {
    const { montado } = montarVisor({ superpuestaInicial: true, opacidad: 0.2 })
    expect(montado.superpuesta.options.opacity).toBe(0.2)
    expect(montado.opacidad()).toBe(0.2)
    const rango = montado.controlOpacidad.getContainer().querySelector('input[type=range]')
    expect(Number(rango.value)).toBe(20)
  })
})

// ── maxZoom / maxNativeZoom de lo montado ────────────────────────────────────

describe('viewer/capas · tope de zoom de las capas montadas', () => {
  it('expone el maxNativeZoom DERIVADO del conjunto montado (lo que 3C debe comparar)', () => {
    const { montado } = montarVisor()
    expect(montado.maxNativeZoom).toBe(maxZoomNativo(CAPAS))
    expect(montado.maxNativeZoom).toBe(20)
  })

  it('a las capas TESELADAS se les pasa el maxZoom del mapa, sin tocar su maxNativeZoom', () => {
    // Sin esto, `L.TileLayer` se quedaría con maxZoom == maxNativeZoom (20) y
    // `L.Control.Layers#_checkDisabledLayers` DESHABILITARÍA sus radios por
    // encima de z20 — justo donde el spec exige poder seguir acercándose para
    // calcar sobre la ortofoto aunque pixele.
    const { mapa, montado } = montarVisor()
    for (const id of [ID_CAPA.PNOA, ID_CAPA.TOPOGRAFICO, ID_CAPA.OSM]) {
      const capa = montado.bases.get(id)
      expect(capa.options.maxZoom, `capa «${id}»`).toBe(MAX_ZOOM_MAPA)
      expect(capa.options.maxNativeZoom).toBe(descriptorPorId(id).maxNativeZoom)
      expect(capa.options.maxZoom).toBeGreaterThan(capa.options.maxNativeZoom)
    }
    expect(mapa.getMaxZoom()).toBe(MAX_ZOOM_MAPA)
  })

  it('el control NO deshabilita ninguna capa por encima del zoom nativo (z22)', () => {
    const { mapa, montado } = montarVisor()
    mapa.setZoom(22, { animate: false })
    for (const input of montado.control._layerControlInputs) {
      expect(input.disabled).toBe(false)
    }
  })

  it('a las capas SIN tope nativo no se les inventa un maxZoom', () => {
    const { montado } = montarVisor()
    expect(montado.bases.get(ID_CAPA.CATASTRO).options.maxZoom).toBeUndefined()
    expect(montado.bases.get(ID_CAPA.BLANCO).options.maxZoom).toBeUndefined()
    expect(montado.superpuesta.options.maxZoom).toBeUndefined()
  })

  it('si el mapa no declara un maxZoom finito, las teseladas se quedan en su tope nativo', () => {
    // Es la razón por la que `crearMapa` fija `maxZoom: 24`: sin un tope del
    // mapa, `montarCapas` no tiene hasta dónde subir el de las capas y el visor
    // acabaría capado en z20 (`Map#_layersMaxZoom`).
    const { mapa, destruir } = montarMapa()
    pendientes.push(destruir)
    const montado = montarCapas({ mapa })
    pendientes.push(montado.destruir)

    expect(montado.bases.get(ID_CAPA.PNOA).options.maxZoom).toBe(
      WMTS_IGN['pnoa-ma'].maxNativeZoom,
    )
  })
})

// ── Destrucción ───────────────────────────────────────────────────────────────

describe('viewer/capas · destruir', () => {
  it('deja el mapa sin NUESTRAS capas ni NUESTROS controles', () => {
    const { mapa, contenedor, montado } = montarVisor({ superpuestaInicial: true })
    expect(contenedor.querySelector('.leaflet-control-layers')).not.toBeNull()
    expect(contenedor.querySelector('.gml-control-opacidad')).not.toBeNull()

    montado.destruir()

    for (const [id, capa] of montado.capas) {
      expect(mapa.hasLayer(capa), `«${id}» debería estar fuera del mapa`).toBe(false)
    }
    let capas = 0
    mapa.eachLayer(() => capas++)
    expect(capas).toBe(0)
    expect(contenedor.querySelector('.leaflet-control-layers')).toBeNull()
    expect(contenedor.querySelector('.gml-control-opacidad')).toBeNull()
  })

  it('NO toca el control de atribución del mapa (criterio de aceptación 5)', () => {
    // El control de atribución y la barra de escala son de `viewer/mapa.js`.
    // Quitarlos aquí incumpliría el criterio 5 en cuanto alguien remontara capas.
    const { contenedor, montado } = montarVisor()
    montado.destruir()
    expect(contenedor.querySelector('.leaflet-control-attribution')).not.toBeNull()
  })

  it('es IDEMPOTENTE: llamarlo dos veces no lanza', () => {
    const { montado } = montarVisor({ superpuestaInicial: true })
    montado.destruir()
    expect(() => montado.destruir()).not.toThrow()
  })

  it('no lanza si el mapa ya se ha destruido antes', () => {
    const { mapa, destruir } = montarMapa({ maxZoom: MAX_ZOOM_MAPA })
    const montado = montarCapas({ mapa })
    destruir()
    expect(() => montado.destruir()).not.toThrow()
  })
})

// ── La factory suelta de «Blanco» ─────────────────────────────────────────────

describe('viewer/capas · crearCapaBlanca', () => {
  it('acepta (e ignora) alAvisar, y valida su forma como el resto del visor', () => {
    expect(() => crearCapaBlanca({ alAvisar: () => {} })).not.toThrow()
    expect(() => crearCapaBlanca()).not.toThrow()
    expect(() => crearCapaBlanca({ alAvisar: 'no soy una función' })).toThrow(TypeError)
  })

  it('opts NO puede debilitar attribution ni crossOrigin (invariantes no negociables)', () => {
    const capa = crearCapaBlanca({
      attribution: 'texto inventado',
      crossOrigin: false,
      opacity: 0.5,
    })
    expect(capa.options.attribution).toBe('')
    expect(capa.options.crossOrigin).toBe('anonymous')
    // Lo negociable sí pasa.
    expect(capa.options.opacity).toBe(0.5)
  })
})
