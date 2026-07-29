/* -------------------------------------------------------------------------- *
 * test/viewer/contraste.dom.test.js — F07 · T3.2 · La capa del contraste     *
 *                                                                            *
 * `viewer/contraste.js` dibuja; no calcula. Así que lo que se prueba aquí es   *
 * lo que se PONE en el mapa y con qué opciones, no ninguna cifra —esas ya      *
 * tienen sus tests en `diagnostico/`—. Cuatro cosas por orden de importancia:  *
 *                                                                            *
 *   1. **El `fillRule:'evenodd'`**, del que depende que la diferencia          *
 *      sombreada sea la diferencia y no un manchón. Es el hallazgo que ahorró  *
 *      la única dependencia nueva de F07, así que tiene guardián propio —      *
 *      incluido uno que afirma el DEFECTO de Leaflet, para que una versión     *
 *      futura que lo cambie salga roja aquí y no en la pantalla del usuario.   *
 *   2. **Que nada intercepta el puntero.** Con el diagnóstico abierto F06      *
 *      sigue activo: una sombra que robe un clic deja la edición inservible.   *
 *   3. **El ámbar solo donde hay invasión**, que es la única excepción de la    *
 *      regla de oro 9 (spec §10.4).                                          *
 *   4. **Que el desmontaje no deja nada**, ni capas ni listeners del mapa.     *
 *                                                                            *
 * El diagnóstico se construye A MANO (POJO literal): esta capa consume una     *
 * forma, no una función, y montar el pipeline entero aquí acoplaría el test de *
 * la vista a la aritmética.                                                   *
 *                                                                            *
 * Proyecto Vitest `dom` (jsdom + Leaflet real, arnés `_ayuda-jsdom.js`).       *
 * -------------------------------------------------------------------------- */

import L from 'leaflet'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OPERATIVOS } from '../../config/operativos.js'
import { ETIQUETA } from '../../diagnostico/margen.js'
import { PANE, PANES } from '../../viewer/_comun.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearPanes, montarMapa } from './_ayuda-jsdom.js'

const ZONA = 30

// Un cuadrado de 10 m en UTM real (huso 30), y el mismo con el lado norte metido
// 0,40 m. Coordenadas de verdad porque la proyección se ejecuta de verdad.
const X0 = 373000
const Y0 = 4070000

const rect = (x0, y0, x1, y1) => [
  { vertices: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], tipo: 'EXTERIOR' },
]

const OFICIAL = () => rect(X0, Y0, X0 + 10, Y0 + 10)
const MEDIDO = () => rect(X0, Y0, X0 + 10, Y0 + 9.6)

/** Diagnóstico mínimo con todas las secciones a `null`. */
const DIAG_VACIO = {
  superficie: { medida: 96, catastral: null, registral: null, oficial: 100 },
  perimetro: { medido: { exterior: 39.2, huecos: 0, total: 39.2 }, oficial: null },
  bandas: { valores: {}, cruces: [] },
  solape: null,
  diferencia: null,
  centroides: null,
  desviacion: null,
  invasion: { consultado: false, invasiones: [], descartadas: [] },
  margen: null,
  omisiones: [],
  saltados: [],
}

/** El diagnóstico completo que la capa sabe pintar entero. */
const DIAG_COMPLETO = {
  ...DIAG_VACIO,
  solape: { area: 96, relativo: 0.96, piezas: [], nPiezas: 1 },
  diferencia: { area: 4 },
  centroides: { medido: [X0 + 5, Y0 + 4.8], oficial: [X0 + 5, Y0 + 5], distancia: 0.2 },
  desviacion: {
    porLado: [],
    maxima: {
      recinto: 0,
      indice: 2, // el lado norte: v[2] → v[3]
      maxima: 0.4,
      en: [X0 + 5, Y0 + 9.6],
      enOficial: [X0 + 5, Y0 + 10],
    },
    nMuestras: 140,
  },
  invasion: {
    consultado: true,
    invasiones: [
      { refcat: '9398501VK3799G', area: 1.5, piezas: [rect(X0 + 9, Y0 + 9, X0 + 11, Y0 + 11)] },
    ],
    descartadas: [{ refcat: '9398518VK3799G', area: 1e-4, grosor: 7e-5, nPiezas: 1 }],
  },
  margen: {
    clase: 'URBANA',
    deducida: true,
    criterio: 'La referencia …',
    perimetroM: 0.5,
    superficieRelativo: 0.05,
    etiqueta: ETIQUETA,
  },
}

const montados = []

/** Monta mapa + panes y devuelve todo lo necesario, apuntando para la limpieza. */
function conMapa() {
  const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
  crearPanes(mapa)
  const contraste = crearContraste({ mapa, zona: ZONA })
  montados.push(() => {
    contraste.destruir()
    destruir()
  })
  return { mapa, contraste }
}

/**
 * Las capas vivas del mapa, por tipo.
 *
 * ⚠️ **Se excluye el RENDERIZADOR**, y hay que saberlo o los conteos mienten:
 * Leaflet añade su `L.SVG` al mapa como una capa más en cuanto se dibuja el primer
 * trazo, y `mapa.eachLayer` lo incluye. No lo pone esta capa, no lo quita
 * `destruir()` (ni debe: es del mapa) y no tiene `options.interactive`. Sin este
 * filtro, «el mapa quedó limpio» sería imposible de afirmar y el guardián de
 * `interactive: false` fallaría contra un `undefined` que no es de nadie.
 */
function capasDe(mapa) {
  const todas = []
  mapa.eachLayer((c) => {
    if (!(c instanceof L.Renderer)) todas.push(c)
  })
  return {
    todas,
    poligonos: todas.filter((c) => c instanceof L.Polygon),
    // `L.Polygon` extiende `L.Polyline`, así que hay que excluirlo explícitamente.
    lineas: todas.filter((c) => c instanceof L.Polyline && !(c instanceof L.Polygon)),
    marcadores: todas.filter((c) => c instanceof L.Marker),
  }
}

/**
 * A zoom 19 en el huso 30 la escala es **5 px/m** (medido con
 * `latLngToLayerPoint` sobre dos puntos UTM separados un metro). De ahí salen los
 * dos números que gobiernan varios tests de este fichero:
 *   · la banda del margen urbano (±0,50 m ⇒ 1,00 m de ancho) mide **5 px**;
 *   · una desviación de 0,40 m se dibuja a **2 px**, por DEBAJO de los 12 px de
 *     `cotaDiagnosticoMinimaPx`, así que su rótulo se filtra. Para probar el
 *     rótulo hace falta una desviación de metros, no de centímetros.
 */
const PX_POR_METRO = 5

afterEach(() => {
  while (montados.length > 0) montados.pop()()
})

describe('viewer/contraste.js · contratos del programador', () => {
  it('LANZA sin un mapa usable, nombrando las cinco funciones que necesita', () => {
    expect(() => crearContraste({ zona: ZONA })).toThrow(/addLayer.*latLngToLayerPoint/s)
    expect(() => crearContraste({ mapa: {}, zona: ZONA })).toThrow(TypeError)
  })

  it('LANZA con un huso que no es 29, 30 ni 31', () => {
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    crearPanes(mapa)
    expect(() => crearContraste({ mapa, zona: 28 })).toThrow(RangeError)
    expect(() => crearContraste({ mapa, zona: 28 })).toThrow(/29, 30, 31/)
    destruir()
  })

  it('LANZA si falta el pane del diagnóstico, explicando dónde va la capa', () => {
    // Sin panes: el mensaje tiene que decir qué se rompe, no solo que falta algo.
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    expect(() => crearContraste({ mapa, zona: ZONA })).toThrow(
      new RegExp(`falta el pane '${PANE.DIAGNOSTICO}'`),
    )
    destruir()
  })

  it('el pane que exige está declarado en PANES, entre acotaciones y vértices', () => {
    // Guardián de coherencia: si alguien quita el 428 de `PANES`, esta capa dejaría
    // de poder montarse y el rojo saldría aquí, con el motivo escrito.
    const z = Object.fromEntries(PANES.map((p) => [p.nombre, p.zIndex]))
    expect(z[PANE.DIAGNOSTICO]).toBe(428)
    expect(z[PANE.DIAGNOSTICO]).toBeGreaterThan(z[PANE.ACOTACIONES])
    expect(z[PANE.DIAGNOSTICO]).toBeLessThan(z[PANE.VERTICES])
  })

  it('LANZA con un `minimoPx` que no es un número ≥ 0', () => {
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    crearPanes(mapa)
    expect(() => crearContraste({ mapa, zona: ZONA, minimoPx: -1 })).toThrow(TypeError)
    expect(() => crearContraste({ mapa, zona: ZONA, minimoPx: NaN })).toThrow(TypeError)
    destruir()
  })
})

describe('viewer/contraste.js · la diferencia simétrica y el `evenodd`', () => {
  it('el DEFECTO de Leaflet es `fillRule: evenodd` — de esto depende todo el dibujo', () => {
    // ÉSTE es el guardián del hallazgo que ahorró `@turf/difference` (la única
    // dependencia nueva que F07 habría necesitado). Está verificado en
    // `leaflet-src.js` (opción :8159, SVG :13347, Canvas :12900), y aquí se afirma
    // sobre la librería instalada: si una versión futura cambiara el defecto, la
    // diferencia sombreada pasaría a rellenarse por «nonzero» y se pintaría la UNIÓN
    // de las dos parcelas en vez de su diferencia — un manchón plausible que nadie
    // reconocería como un bug.
    expect(L.Polyline.prototype.options.fillRule).toBe('evenodd')
  })

  it('pinta UN solo polígono con los anillos de las DOS geometrías', () => {
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_VACIO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    const { poligonos } = capasDe(mapa)
    expect(poligonos).toHaveLength(1)
    // Dos anillos en un polígono: es lo que hace que la paridad los reste.
    expect(poligonos[0].getLatLngs()).toHaveLength(2)
    expect(poligonos[0].options.fillRule).toBe('evenodd')
  })

  it('pasa `fillRule` EXPLÍCITO aunque sea el defecto', () => {
    // Se pasa a mano para que quede escrito en el código de qué depende el dibujo.
    // Si el defecto de Leaflet cambiara, esta capa seguiría funcionando.
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_VACIO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })
    expect(capasDe(mapa).poligonos[0].options.fillRule).toBe('evenodd')
  })

  it('con huecos, TODOS los anillos entran en el mismo polígono', () => {
    // La paridad no distingue exterior de hueco y no hay que ordenarlos: un punto en
    // exterior+hueco cuenta 2 (fuera de la región) y en exterior solo cuenta 1
    // (dentro). Juntando las dos parcelas, impar ⟺ pertenece a una y no a la otra.
    const conHueco = [
      ...OFICIAL(),
      { vertices: [[X0 + 2, Y0 + 2], [X0 + 4, Y0 + 2], [X0 + 4, Y0 + 4], [X0 + 2, Y0 + 4]], tipo: 'HUECO' },
    ]
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_VACIO, { recintos: MEDIDO(), geometriaOficial: conHueco })

    const { poligonos } = capasDe(mapa)
    expect(poligonos).toHaveLength(1)
    expect(poligonos[0].getLatLngs()).toHaveLength(3) // medido + oficial + su hueco
  })

  it('sin geometría oficial no pinta diferencia: no hay dos regiones que restar', () => {
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_VACIO, { recintos: MEDIDO(), geometriaOficial: null })
    expect(capasDe(mapa).poligonos).toHaveLength(0)
  })

  it('un anillo de menos de 3 vértices se salta, sin pintar un polígono degenerado', () => {
    const linea = [{ vertices: [[X0, Y0], [X0 + 10, Y0]], tipo: 'EXTERIOR' }]
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_VACIO, { recintos: linea, geometriaOficial: OFICIAL() })
    // Solo queda un anillo utilizable: sin dos regiones no hay diferencia.
    expect(capasDe(mapa).poligonos).toHaveLength(0)
  })
})

describe('viewer/contraste.js · la invasión, y solo ahí, va en ámbar', () => {
  it('pinta una pieza por invasión, en ámbar', () => {
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    const ambar = capasDe(mapa).poligonos.filter((p) => p.options.fillColor === '#D97706')
    expect(ambar).toHaveLength(1)
    expect(ambar[0].options.fillOpacity).toBeGreaterThan(0.3)
  })

  it('las DESCARTADAS no se dibujan', () => {
    // Son astillas de redondeo en un lindero compartido: salen en el cajón con su
    // área y su grosor (regla de oro 1) pero no se pintan, porque un ámbar de 1 cm²
    // sobre el mapa afirmaría un conflicto que no existe.
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    expect(DIAG_COMPLETO.invasion.descartadas).toHaveLength(1)
    const ambar = capasDe(mapa).poligonos.filter((p) => p.options.fillColor === '#D97706')
    expect(ambar).toHaveLength(1) // la invasión real, no la astilla
  })

  it('sin invasiones no hay NADA en ámbar en todo el mapa', () => {
    // La regla de oro 9 al revés: el color que afirma algo no puede aparecer cuando
    // no hay nada que afirmar.
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_VACIO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    for (const capa of capasDe(mapa).todas) {
      expect(capa.options.fillColor).not.toBe('#D97706')
      expect(capa.options.color).not.toBe('#D97706')
    }
  })
})

describe('viewer/contraste.js · el lindero de máxima desviación', () => {
  it('resalta el lado señalado y dibuja su línea guía', () => {
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    const { lineas } = capasDe(mapa)
    // Se filtra por COLOR y no por `weight`: la banda del margen también es gruesa
    // (5 px a este zoom, ver PX_POR_METRO), así que un filtro por grosor cazaba las
    // dos. El color es lo que identifica cada dibujo sin depender del zoom.
    const resalte = lineas.filter((l) => l.options.color === '#DB2777' && !l.options.dashArray)
    const guia = lineas.filter((l) => l.options.dashArray === '4 3')
    expect(resalte).toHaveLength(1)
    expect(resalte[0].options.weight).toBe(4)
    expect(guia).toHaveLength(1)
  })

  it('el lado resaltado es el que dice `maxima.indice`, con el módulo del anillo', () => {
    // `indice: 2` sobre un anillo de 4 vértices es el lado v[2]→v[3]: el norte, que
    // es el que se ha movido. Equivocar el lado es peor que equivocar la cifra en un
    // milímetro, porque §10.5 lo resalta en el dibujo.
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    const resalte = capasDe(mapa).lineas.find(
      (l) => l.options.color === '#DB2777' && !l.options.dashArray,
    )
    const puntos = resalte.getLatLngs()
    expect(puntos).toHaveLength(2)
    // Los dos extremos del lado norte del contorno MEDIDO (y = Y0 + 9,6).
    expect(puntos[0].lat).toBeCloseTo(puntos[1].lat, 5)
  })

  it('rotula la cota con la cifra en metros y coma decimal', () => {
    // La desviación de 0,40 m de `DIAG_COMPLETO` se dibuja a 2 px (PX_POR_METRO) y su
    // rótulo se filtra con razón. Para probar el rótulo hace falta un segmento que se
    // vea: 4 m son 20 px, por encima de los 12 de `cotaDiagnosticoMinimaPx`.
    const { mapa, contraste } = conMapa()
    const separada = {
      ...DIAG_COMPLETO,
      desviacion: {
        ...DIAG_COMPLETO.desviacion,
        maxima: {
          ...DIAG_COMPLETO.desviacion.maxima,
          maxima: 4,
          en: [X0 + 5, Y0 + 9.6],
          enOficial: [X0 + 5, Y0 + 13.6],
        },
      },
    }
    contraste.pintar(separada, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    expect(4 * PX_POR_METRO).toBeGreaterThan(OPERATIVOS.cotaDiagnosticoMinimaPx)
    const marcador = capasDe(mapa).marcadores[0]
    expect(marcador).toBeDefined()
    expect(marcador.options.icon.options.html).toContain('4,00 m')
    expect(marcador.options.interactive).toBe(false)
  })

  it('por debajo de `cotaDiagnosticoMinimaPx` dibuja la línea pero NO el rótulo', () => {
    // Lo que se filtra por píxeles es el RÓTULO, no la línea: el segmento medido →
    // oficial ES el hallazgo y se dibuja siempre. Un rótulo sobre dos puntos
    // solapados sería un dedo señalando al aire.
    const { mapa, contraste } = conMapa()
    const casiIgual = {
      ...DIAG_COMPLETO,
      desviacion: {
        ...DIAG_COMPLETO.desviacion,
        maxima: {
          ...DIAG_COMPLETO.desviacion.maxima,
          maxima: 0.001,
          en: [X0 + 5, Y0 + 9.6],
          enOficial: [X0 + 5, Y0 + 9.601],
        },
      },
    }
    contraste.pintar(casiIgual, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    // 1 mm × 5 px/m = 0,005 px: muy por debajo de los 12.
    expect(0.001 * PX_POR_METRO).toBeLessThan(OPERATIVOS.cotaDiagnosticoMinimaPx)
    expect(capasDe(mapa).marcadores).toHaveLength(0)
    expect(capasDe(mapa).lineas.filter((l) => l.options.dashArray === '4 3')).toHaveLength(1)
  })

  it('si el diagnóstico apunta a un recinto que la geometría no tiene, AVISA', () => {
    // Pintar juntos un diagnóstico y una geometría de momentos distintos. No se
    // dibuja nada inventado y se dice (regla de oro 1).
    const alAvisar = vi.fn()
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    crearPanes(mapa)
    const contraste = crearContraste({ mapa, zona: ZONA, alAvisar })

    contraste.pintar(
      { ...DIAG_COMPLETO, desviacion: { ...DIAG_COMPLETO.desviacion, maxima: { ...DIAG_COMPLETO.desviacion.maxima, recinto: 7 } } },
      { recintos: MEDIDO(), geometriaOficial: OFICIAL() },
    )

    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toMatch(/recinto 7/)
    contraste.destruir()
    destruir()
  })
})

describe('viewer/contraste.js · la banda del margen NO es un buffer', () => {
  it('la dibuja como TRAZO del contorno oficial, con ancho en píxeles', () => {
    // `turf.buffer` está prohibida (regla de oro 6) y aquí no hace falta: el ancho
    // sale de los metros del margen a la escala actual.
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    const banda = capasDe(mapa).lineas.find((l) => l.options.dashArray === '2 6')
    expect(banda).toBeDefined()
    expect(banda.options.color).toBe('#94A3B8')
    // ±0,50 m ⇒ 1,00 m de ancho ⇒ 5 px a este zoom. La cifra sale de la ESCALA, no
    // de una constante: es lo que hace que sea una banda sobre el TERRENO.
    expect(banda.options.weight).toBeCloseTo(2 * 0.5 * PX_POR_METRO, 1)
  })

  it('el ancho es el DOBLE del margen: es ± y se extiende a los dos lados', () => {
    // Dibujarla con el ancho de la cifra sola mostraría la mitad del margen. A zoom
    // 19 en este huso hay del orden de 1,1 px/m, así que 2 × 0,50 m ≈ 1,1 px; lo que
    // se afirma es la RELACIÓN entre dos márgenes distintos, no un absoluto que
    // dependa del zoom exacto de Leaflet.
    const { mapa, contraste } = conMapa()

    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })
    const urbana = capasDe(mapa).lineas.find((l) => l.options.dashArray === '2 6').options.weight

    contraste.pintar(
      { ...DIAG_COMPLETO, margen: { ...DIAG_COMPLETO.margen, clase: 'RUSTICA', perimetroM: 2 } },
      { recintos: MEDIDO(), geometriaOficial: OFICIAL() },
    )
    const rustica = capasDe(mapa).lineas.find((l) => l.options.dashArray === '2 6').options.weight

    // 2 m contra 0,5 m: cuatro veces, salvo el tope de píxeles.
    expect(rustica / urbana).toBeCloseTo(4, 1)
  })

  it('sin margen en el diagnóstico no dibuja ninguna banda', () => {
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_VACIO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })
    expect(capasDe(mapa).lineas.filter((l) => l.options.dashArray === '2 6')).toHaveLength(0)
  })

  it('la banda va DISCONTINUA: una banda continua se leería como un carril', () => {
    // Y un carril se lee como «lo que cae aquí está bien», que es el veredicto que la
    // regla de oro 9 prohíbe. La discontinuidad la presenta como referencia.
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })
    const banda = capasDe(mapa).lineas.find((l) => l.options.color === '#94A3B8')
    expect(banda.options.dashArray).toBe('2 6')
  })
})

describe('viewer/contraste.js · nada intercepta el puntero (F06 sigue vivo)', () => {
  it('TODAS las capas van `interactive: false`', () => {
    // Con el diagnóstico abierto se sigue editando: se diagnostica, se corrige el
    // lindero y se vuelve a diagnosticar. Una sombra que robe un clic al mapa —o un
    // arrastre a un vértice— deja la edición de F06 inservible.
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    const { todas } = capasDe(mapa)
    expect(todas.length).toBeGreaterThan(3)
    for (const capa of todas) {
      expect(capa.options.interactive, `una capa quedó interactiva`).toBe(false)
    }
  })

  it('todo va al pane del diagnóstico, bajo los vértices', () => {
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    for (const capa of capasDe(mapa).todas) {
      expect(capa.options.pane).toBe(PANE.DIAGNOSTICO)
    }
  })
})

describe('viewer/contraste.js · idempotencia, limpieza y desmontaje', () => {
  it('pintar dos veces lo mismo deja el mismo número de capas', () => {
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })
    const n = capasDe(mapa).todas.length
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })
    expect(capasDe(mapa).todas).toHaveLength(n)
  })

  it('`pintar(null)` limpia el mapa: es el cajón cerrándose', () => {
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })
    expect(capasDe(mapa).todas.length).toBeGreaterThan(0)
    contraste.pintar(null)
    expect(capasDe(mapa).todas).toHaveLength(0)
  })

  it('`limpiar()` quita todo sin desmontar la capa', () => {
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })
    contraste.limpiar()
    expect(capasDe(mapa).todas).toHaveLength(0)
    // Y sigue viva: se puede volver a pintar.
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })
    expect(capasDe(mapa).todas.length).toBeGreaterThan(0)
  })

  it('`destruir()` retira las capas Y los listeners del mapa, y es idempotente', () => {
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    crearPanes(mapa)
    const off = vi.spyOn(mapa, 'off')
    const contraste = crearContraste({ mapa, zona: ZONA })
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })

    contraste.destruir()
    expect(capasDe(mapa).todas).toHaveLength(0)
    expect(off).toHaveBeenCalledWith('zoomend moveend', expect.any(Function))

    // Idempotente, como todo desmontaje del visor.
    expect(() => contraste.destruir()).not.toThrow()
    // Y después de destruir, `pintar` no vuelve a poner nada.
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })
    expect(capasDe(mapa).todas).toHaveLength(0)
    destruir()
  })

  it('se suscribe a `zoomend moveend`: la banda y la cota se miden en PÍXELES', () => {
    // Su anchura en píxeles depende del zoom aunque la geometría no se mueva. Es el
    // mismo motivo por el que `viewer/acotaciones.js` escucha estos dos eventos.
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    crearPanes(mapa)
    const on = vi.spyOn(mapa, 'on')
    const contraste = crearContraste({ mapa, zona: ZONA })
    expect(on).toHaveBeenCalledWith('zoomend moveend', expect.any(Function))
    contraste.destruir()
    destruir()
  })

  it('el repintado por zoom NO duplica capas', () => {
    const { mapa, contraste } = conMapa()
    contraste.pintar(DIAG_COMPLETO, { recintos: MEDIDO(), geometriaOficial: OFICIAL() })
    const n = capasDe(mapa).todas.length

    mapa.fire('zoomend')
    expect(capasDe(mapa).todas).toHaveLength(n)
    mapa.fire('moveend')
    expect(capasDe(mapa).todas).toHaveLength(n)
  })

  it('un `zoomend` sin haber pintado nada no revienta ni pinta nada', () => {
    const { mapa } = conMapa()
    expect(() => mapa.fire('zoomend')).not.toThrow()
    expect(capasDe(mapa).todas).toHaveLength(0)
  })
})
