// test/viewer/mapa.dom.test.js — F03 · Tarea 2B.3.
//
// Proyecto Vitest `dom` (jsdom): el sufijo `.dom.test.js` lo enruta ahí porque
// `viewer/mapa.js` importa Leaflet (exige `window`).
//
// Nota sobre el arnés: `montarMapa` de `_ayuda-jsdom.js` crea SU PROPIO
// `L.map` (pensado para tests de otros módulos que YA dan por hecho un mapa
// montado), así que no sirve para probar `crearMapa` en sí. Aquí se usa
// `crearContenedor()` — que es la pieza del arnés que resuelve el tamaño 0 de
// jsdom — y se le pasa a `crearMapa`, que es la función bajo prueba.
import { describe, it, expect } from 'vitest'
import { crearContenedor } from './_ayuda-jsdom.js'
import { PANES } from '../../viewer/_comun.js'
import { crearMapa } from '../../viewer/mapa.js'
// El tope nativo del IGN se IMPORTA de su dueño (derivado de WMTS_IGN), no se
// copia aquí: antes este fichero tenía una tercera copia del `19` a mano y el
// cambio a 20 (banco 2D.1) la habría dejado desincronizada en silencio.
import { MAX_ZOOM_NATIVO_IGN } from '../../services/ign.js'

describe('crearMapa · panes', () => {
  // El rótulo NO lleva la cuenta, y es por lo mismo que este fichero no copia el
  // tope nativo del IGN (ver la cabecera): un número aquí es una copia a mano de
  // un dato que vive en `PANES`. Decía «los tres» desde F03 y F06 lo dejó en
  // cuatro sin que nada avisara —el cuerpo itera `PANES`, así que seguía verde—;
  // F07 lo habría dejado en cinco. Un test que pasa contando mal lo que hace es
  // el tipo de mentira en verde que este proyecto persigue.
  it('crea TODOS los panes de PANES, cada uno con su zIndex exacto', () => {
    const contenedor = crearContenedor()
    const { mapa, panes, destruir } = crearMapa(contenedor)

    for (const { nombre, zIndex } of PANES) {
      expect(panes[nombre]).toBeInstanceOf(HTMLElement)
      expect(panes[nombre].style.zIndex).toBe(String(zIndex))
      // mapa.getPane(nombre) debe ser EL MISMO elemento que panes[nombre]:
      // viewer/sincronizacion.js recibe `panes` por parámetro, pero cualquier
      // otro consumidor que solo tenga `mapa` debe llegar al mismo pane.
      expect(mapa.getPane(nombre)).toBe(panes[nombre])
    }

    destruir()
  })

  it('el zIndex de los panes queda en orden CRECIENTE, en el mismo orden que PANES', () => {
    // Derivado de PANES (no se escriben 410/420/430 a mano): el test sigue
    // siendo válido si _comun.js cambia esos valores.
    const contenedor = crearContenedor()
    const { panes, destruir } = crearMapa(contenedor)

    const zIndices = PANES.map(({ nombre }) => Number(panes[nombre].style.zIndex))
    const ordenadosAsc = [...zIndices].sort((a, b) => a - b)
    expect(zIndices).toEqual(ordenadosAsc)
    for (let i = 1; i < zIndices.length; i++) {
      expect(zIndices[i]).toBeGreaterThan(zIndices[i - 1])
    }

    destruir()
  })
})

describe('crearMapa · zoom sin tope artificial', () => {
  it('zoomSnap === 0 (zoom continuo, sin saltos a valores enteros)', () => {
    const contenedor = crearContenedor()
    const { mapa, destruir } = crearMapa(contenedor)
    expect(mapa.options.zoomSnap).toBe(0)
    destruir()
  })

  it('maxZoom por defecto queda estrictamente por encima del maxNativeZoom del IGN', () => {
    const contenedor = crearContenedor()
    const { mapa, destruir } = crearMapa(contenedor)
    expect(mapa.options.maxZoom).toBeGreaterThan(MAX_ZOOM_NATIVO_IGN)
    destruir()
  })

  it('un maxZoom bajo NO se rechaza: este módulo no conoce las capas (hallazgo 2.7)', () => {
    // `crearMapa` no monta capas, así que no puede saber si el maxZoom pedido es
    // suficiente: quien lo comprueba es `crearVisor`, contra el tope DERIVADO de
    // lo realmente montado (`viewer/capas.js#maxZoomNativo`). Antes `crearMapa` lo
    // rechazaba con RangeError por una propiedad de un servicio que este módulo ni
    // monta ni conoce — y con ella habría rechazado también un futuro visor sin
    // capas del IGN, que es la configuración que el hallazgo 2.7 dejó abierta.
    const contenedor = crearContenedor()
    let resultado
    expect(() => {
      resultado = crearMapa(contenedor, { maxZoom: MAX_ZOOM_NATIVO_IGN })
    }).not.toThrow()
    expect(resultado.mapa.options.maxZoom).toBe(MAX_ZOOM_NATIVO_IGN)
    resultado.destruir()

    const otro = crearMapa(crearContenedor(), { maxZoom: 12 })
    expect(otro.mapa.options.maxZoom).toBe(12)
    otro.destruir()
  })
})

describe('crearMapa · opciones de Leaflet por REST (no una clave anidada)', () => {
  it('las opciones sueltas de opts llegan a L.map: { zoomAnimation: false } se aplica', () => {
    // Hallazgo 2.1: el JSDoc prometía una clave anidada `opts.opcionesLeaflet`
    // que la implementación nunca leyó. Quien siguiera el JSDoc le pasaba a
    // L.map una opción llamada «opcionesLeaflet» que Leaflet IGNORA sin decir
    // nada, y las animaciones seguían activas — que es justo la causa de test
    // colgado bajo jsdom que documenta test/viewer/_ayuda-jsdom.js.
    const contenedor = crearContenedor()
    const { mapa, destruir } = crearMapa(contenedor, { zoomAnimation: false })
    expect(mapa.options.zoomAnimation).toBe(false)
    destruir()
  })

  it('la forma ANIDADA no cuela como opción de Leaflet (documenta el fallo silencioso)', () => {
    const contenedor = crearContenedor()
    const { mapa, destruir } = crearMapa(contenedor, {
      opcionesLeaflet: { zoomAnimation: false },
    })
    // La animación sigue activa: Leaflet no conoce la clave «opcionesLeaflet».
    expect(mapa.options.zoomAnimation).not.toBe(false)
    destruir()
  })

  it('opts NO puede pisar zoomSnap ni maxZoom (van después del spread)', () => {
    const contenedor = crearContenedor()
    const { mapa, destruir } = crearMapa(contenedor, { zoomSnap: 1, maxZoom: 21 })
    expect(mapa.options.zoomSnap).toBe(0)
    // maxZoom SÍ es negociable (es un parámetro con nombre), zoomSnap no.
    expect(mapa.options.maxZoom).toBe(21)
    destruir()
  })
})

describe('crearMapa · atribución (criterio de aceptación 5, obligación legal)', () => {
  it('attributionControl queda activo y el control aterriza en el DOM', () => {
    const contenedor = crearContenedor()
    const { mapa, destruir } = crearMapa(contenedor)
    expect(mapa.options.attributionControl).toBe(true)
    expect(contenedor.querySelector('.leaflet-control-attribution')).not.toBeNull()
    destruir()
  })

  it('opts NO puede apagar el control de atribución (hallazgo 2.2)', () => {
    // Sin este blindaje, `{ attributionControl: false }` incumpliría el criterio
    // 5 aunque todas las capas llevaran su atribución perfecta: CC-BY 4.0 del
    // IGN, Ley 37/2007 RISP y ODbL de OSM.
    const contenedor = crearContenedor()
    const { mapa, destruir } = crearMapa(contenedor, { attributionControl: false })
    expect(mapa.options.attributionControl).toBe(true)
    expect(contenedor.querySelector('.leaflet-control-attribution')).not.toBeNull()
    destruir()
  })
})

describe('crearMapa · control de escala (solo barra gráfica)', () => {
  it('añade la barra métrica y NINGUNA barra imperial', () => {
    const contenedor = crearContenedor()
    const { destruir } = crearMapa(contenedor)

    // L.control.scale monta su contenedor ('.leaflet-control-scale') como
    // hijo del contenedor del mapa (vía _initControlPos → _controlContainer
    // → esquina bottomleft por defecto). Con metric:true/imperial:false,
    // Leaflet crea EXACTAMENTE un div '.leaflet-control-scale-line' (el
    // métrico); si imperial estuviera activo habría un segundo div hermano
    // con la misma clase. Se inspecciona el DOM que genera Leaflet en vez de
    // el objeto del control porque es lo que garantiza que la barra
    // ATERRIZA en pantalla, no solo que se instanció con esas opciones.
    const contenedorEscala = contenedor.querySelector('.leaflet-control-scale')
    expect(contenedorEscala).not.toBeNull()

    const lineas = contenedorEscala.querySelectorAll('.leaflet-control-scale-line')
    expect(lineas.length).toBe(1)

    destruir()
  })
})

describe('crearMapa · contenedor (duck typing, no instanceof)', () => {
  it('lanza TypeError si el contenedor no es un elemento del DOM', () => {
    expect(() => crearMapa(null)).toThrow(TypeError)
    expect(() => crearMapa('#mapa')).toThrow(TypeError)
    expect(() => crearMapa({})).toThrow(TypeError)
  })

  it('acepta un elemento de OTRO realm (lo que instanceof HTMLElement rechazaría)', () => {
    // Hallazgo 2.10: `instanceof HTMLElement` falla entre realms (iframe) y
    // referencia un global inexistente bajo el proyecto `node`. El duck typing
    // comprueba lo que Leaflet de verdad necesita del contenedor.
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const ajeno = iframe.contentDocument.createElement('div')
    iframe.contentDocument.body.appendChild(ajeno)
    // Prueba de que es de otro realm: no es un HTMLElement de ESTE realm.
    expect(ajeno instanceof HTMLElement).toBe(false)
    expect(ajeno.nodeType).toBe(1)

    for (const prop of ['clientWidth', 'offsetWidth']) {
      Object.defineProperty(ajeno, prop, { value: 400, configurable: true })
    }
    for (const prop of ['clientHeight', 'offsetHeight']) {
      Object.defineProperty(ajeno, prop, { value: 300, configurable: true })
    }

    let resultado
    expect(() => {
      resultado = crearMapa(ajeno)
    }).not.toThrow()
    resultado.destruir()
    iframe.remove()
  })
})

describe('crearMapa · sin capas', () => {
  it('no añade ninguna capa al mapa (las capas son de la Fase 3)', () => {
    const contenedor = crearContenedor()
    const { mapa, destruir } = crearMapa(contenedor)
    let capas = 0
    mapa.eachLayer(() => capas++)
    expect(capas).toBe(0)
    destruir()
  })
})

describe('crearMapa · vistaInicial', () => {
  it('con vistaInicial, aplica el centro y el zoom pedidos', () => {
    const contenedor = crearContenedor()
    const centro = [40.4, -3.7]
    const zoom = 15
    const { mapa, destruir } = crearMapa(contenedor, { vistaInicial: { centro, zoom } })

    expect(mapa.getCenter().lat).toBeCloseTo(centro[0], 9)
    expect(mapa.getCenter().lng).toBeCloseTo(centro[1], 9)
    expect(mapa.getZoom()).toBe(zoom)

    destruir()
  })

  it('SIN vistaInicial, no lanza y el mapa queda sin centrar A PROPÓSITO (no es un descuido)', () => {
    const contenedor = crearContenedor()
    let resultado
    expect(() => {
      resultado = crearMapa(contenedor)
    }).not.toThrow()

    // "Sin centrar" no se comprueba mirando un campo interno: se comprueba
    // apoyándose en el propio contrato de Leaflet. `getCenter()` exige que el
    // mapa tenga una vista (centro+zoom) fijada al menos una vez ("Set map
    // center and zoom first."); como crearMapa NO llama a setView cuando no
    // se le pasa vistaInicial, ese es precisamente el error que Leaflet
    // lanza. Es la prueba de que el encuadre queda, deliberadamente, en
    // manos de quien llame (crearVisor, Fase 3) — no un valor por defecto
    // inventado (nada de "centrar en España").
    expect(() => resultado.mapa.getCenter()).toThrow('Set map center and zoom first.')

    resultado.destruir()
  })

  it('lanza TypeError si vistaInicial no tiene la forma {centro:[lat,lon], zoom}', () => {
    const contenedor = crearContenedor()
    expect(() => crearMapa(contenedor, { vistaInicial: {} })).toThrow(TypeError)
    expect(() => crearMapa(contenedor, { vistaInicial: { centro: [1], zoom: 10 } })).toThrow(TypeError)
    expect(() => crearMapa(contenedor, { vistaInicial: { centro: [1, 2], zoom: 'x' } })).toThrow(
      TypeError,
    )
  })
})

describe('crearMapa · destruir', () => {
  it('destruir() no lanza y deja el mapa desmontado', () => {
    const contenedor = crearContenedor()
    const { mapa, destruir } = crearMapa(contenedor)
    expect(() => destruir()).not.toThrow()
    // Desmontado: Leaflet ya no lo considera "cargado" (mismo contrato de
    // Leaflet usado arriba para "sin centrar").
    expect(() => mapa.getCenter()).toThrow()
  })

  it('destruir() es IDEMPOTENTE: llamarlo dos veces no lanza (contrato explícito)', () => {
    const contenedor = crearContenedor()
    const { destruir } = crearMapa(contenedor)
    destruir()
    expect(() => destruir()).not.toThrow()
  })
})

describe('crearMapa · tamaño real bajo jsdom', () => {
  it('mapa.getSize() tiene ancho y alto > 0, gracias al contenedor del arnés', () => {
    // Es la prueba de que este módulo es utilizable por los tests de los
    // demás módulos de la Fase 2B/3 (services/ign.js, viewer/wms-catastro.js,
    // viewer/sincronizacion.js): todos montarán su mapa sobre crearMapa +
    // crearContenedor, y necesitan un tamaño real para que getBounds() no
    // degenere.
    const contenedor = crearContenedor({ ancho: 640, alto: 480 })
    const { mapa, destruir } = crearMapa(contenedor)
    const tam = mapa.getSize()
    expect(tam.x).toBe(640)
    expect(tam.y).toBe(480)
    expect(tam.x).toBeGreaterThan(0)
    expect(tam.y).toBeGreaterThan(0)
    destruir()
  })
})
