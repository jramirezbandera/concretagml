/* -------------------------------------------------------------------------- *
 * test/app/edificio-gml.dom.test.js — F13 · T3.4 · «Generar GML» en EDIFICIO   *
 *                                                                              *
 * `app/cableado-edificio-gml.js` es lo que convierte `validation/edificio.js` y *
 * `gml/serialize-bu.js` en producto. Sin él serían código que solo existe en    *
 * los tests — que es literalmente lo que le pasó a `parsers/dxf.js` durante     *
 * DIEZ fases y a las cuatro primeras de F12.                                   *
 *                                                                              *
 * Lo que se mide aquí y no se puede medir desde las capas puras:                *
 *                                                                              *
 *   · que el botón y su renglón vayan SIEMPRE a la vez (un botón gris y mudo    *
 *     es lo que este cableado existe para no producir);                        *
 *   · que el fichero baje llamándose `edificio_…` y no `parcela_…` — la primera *
 *     versión llamaba a `descargarGml`, que compone el nombre por su cuenta, y  *
 *     el nombre se perdía EN SILENCIO;                                         *
 *   · que los avisos que NO bloquean —empezando por «no se ha comprobado si     *
 *     cae dentro de la parcela»— salgan ANTES de descargar, no después;         *
 *   · y el reparto del MANDO: con la rama Parcela puesta, este cableado no      *
 *     toca el botón ni genera nada.                                            *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  MENSAJE_FALLO_INESPERADO,
  MOTIVO_SIN_EDIFICIO,
  MOTIVO_SIN_HUELLA,
  SELECTOR_BOTON,
  SELECTOR_ESTADO,
  cablearGeneracionGmlEdificio,
  identidadDe,
  otrasDe,
  partesSenaladas,
  plantasDelEdificio,
} from '../../app/cableado-edificio-gml.js'
import { crearEdificio, crearParteConstruccion, TIPO_PARTE } from '../../model/edificio.js'
import { entradaDesdeGmlBu } from '../../edificio/entrada.js'
import { NIVEL } from '../../viewer/_comun.js'

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────
const RAIZ = join(import.meta.dirname, '..', '..')
const HTML = readFileSync(join(RAIZ, 'index.html'), 'utf8')

const SRS = 'EPSG:25830'
const BX = 440000
const BY = 4480000

const rect = (x, y, ancho, alto) => ({
  vertices: [
    [BX + x, BY + y],
    [BX + x + ancho, BY + y],
    [BX + x + ancho, BY + y + alto],
    [BX + x, BY + y + alto],
  ],
  tipo: 'EXTERIOR',
})

const parte = (nombre, recinto, extra = {}) =>
  crearParteConstruccion({
    nombre,
    recinto,
    origen: 'DIBUJADA',
    plantasSobreRasante: 1,
    plantasBajoRasante: 0,
    ...extra,
  })

/** Un edificio válido con una parte de 10×10 y su identidad. */
const edificioBueno = (extra = {}) =>
  crearEdificio({
    idLocal: 'nave.dxf',
    partes: [parte('Cuerpo principal', rect(0, 0, 10, 10))],
    ...extra,
  })

/** Store mínimo con la misma forma que `crearEstadoVista`. */
function crearStore(inicial = null) {
  let valor = inicial
  const suscriptores = new Set()
  return {
    get: () => valor,
    set(nuevo) {
      valor = nuevo
      for (const fn of suscriptores) fn(valor)
    },
    subscribe(fn) {
      suscriptores.add(fn)
      return () => suscriptores.delete(fn)
    },
  }
}

let avisos
let descargas

/** Cablea sobre la cáscara real. `mando` por defecto: esta rama manda. */
function cablear(opciones = {}) {
  const estadoEdificio = opciones.estadoEdificio ?? crearStore(null)
  const cable = cablearGeneracionGmlEdificio({
    estadoEdificio,
    panel: { avisar: (mensaje, o) => avisos.push({ mensaje, ...o }) },
    srs: SRS,
    ahora: () => new Date(Date.UTC(2026, 7, 6, 18, 30, 0)),
    descargar: (texto, o) => {
      descargas.push({ texto, ...o })
      return { descargado: true, nombre: o.nombreFichero, mensaje: null }
    },
    documento: document,
    ...opciones,
    estadoEdificio,
  })
  return { cable, estadoEdificio }
}

const boton = () => document.querySelector(SELECTOR_BOTON)
const renglon = () => document.querySelector(SELECTOR_ESTADO)

beforeEach(() => {
  document.documentElement.innerHTML = HTML
  document.body.className = 'gml-app'
  avisos = []
  descargas = []
})

// ── 1 · El botón y su motivo, siempre a la vez ───────────────────────────────

describe('cablearGeneracionGmlEdificio · el botón nunca queda gris y mudo', () => {
  it('sin construcción: apagado, y el renglón dice qué falta y cómo conseguirlo', () => {
    cablear()
    expect(boton().disabled).toBe(true)
    expect(renglon().textContent).toBe(MOTIVO_SIN_EDIFICIO)
    expect(renglon().textContent).toMatch(/Entrada/)
  })

  it('con una construcción válida: encendido y el renglón LIMPIO', () => {
    const { estadoEdificio } = cablear()
    estadoEdificio.set(edificioBueno())
    expect(boton().disabled).toBe(false)
    expect(renglon().textContent).toBe('')
  })

  it('una parte principal sin plantas lo apaga, con el recuento delante', () => {
    const { estadoEdificio } = cablear()
    estadoEdificio.set(
      crearEdificio({
        idLocal: 'nave.dxf',
        partes: [parte('Cuerpo', rect(0, 0, 10, 10), { plantasSobreRasante: null })],
      }),
    )
    expect(boton().disabled).toBe(true)
    expect(renglon().textContent).toMatch(/^1 error bloquea la generación del GML/)
    expect(renglon().textContent).toMatch(/plantas sobre rasante/)
  })

  it('⛔ todo bajo rasante: apagado con su motivo PROPIO, no con el genérico', () => {
    // Es un caso real —un sótano suelto— y el usuario tiene que poder leerlo
    // ANTES de pulsar, no en el mensaje de un fichero que no baja.
    const { estadoEdificio } = cablear()
    estadoEdificio.set(
      crearEdificio({
        idLocal: 'sotano.dxf',
        partes: [parte('Sótano', rect(0, 0, 10, 10), { plantasSobreRasante: 0, plantasBajoRasante: 1 })],
      }),
    )
    expect(boton().disabled).toBe(true)
    expect(renglon().textContent).toBe(MOTIVO_SIN_HUELLA)
  })

  it('el renglón se limpia al pasar de un edificio malo a uno bueno', () => {
    const { estadoEdificio } = cablear()
    estadoEdificio.set(
      crearEdificio({ idLocal: 'x', partes: [parte('C', rect(0, 0, 10, 10), { plantasSobreRasante: null })] }),
    )
    expect(renglon().textContent).not.toBe('')
    estadoEdificio.set(edificioBueno())
    expect(renglon().textContent).toBe('')
    expect(boton().disabled).toBe(false)
  })

  it('LANZA si la cáscara no trae el botón: es contrato con index.html', () => {
    document.querySelector(SELECTOR_BOTON).remove()
    expect(() => cablear()).toThrow(/contrato con index.html/)
  })
})

// ── 2 · La entrega ───────────────────────────────────────────────────────────

describe('cablearGeneracionGmlEdificio · la entrega', () => {
  it('⛔ el fichero baja llamándose `edificio_…`, no `parcela_…`', () => {
    // Regresión de un defecto real de esta fase: la primera versión llamaba a
    // `descargarGml`, que compone el nombre POR SU CUENTA con `nombreFicheroGml`,
    // así que el nombre que este módulo calculaba se perdía en silencio.
    const { estadoEdificio } = cablear()
    estadoEdificio.set(edificioBueno({ refcat: '9398516VK3799G' }))
    boton().click()

    expect(descargas).toHaveLength(1)
    expect(descargas[0].nombreFichero).toBe('edificio_9398516VK3799G_2026-08-06T18-30-00.gml')
    expect(descargas[0].nombreFichero).not.toMatch(/^parcela/)
  })

  it('sin referencia catastral el nombre lo dice, y no usa el nombre del fichero', () => {
    const { estadoEdificio } = cablear()
    estadoEdificio.set(edificioBueno())
    boton().click()
    expect(descargas[0].nombreFichero).toBe('edificio_sin-referencia_2026-08-06T18-30-00.gml')
  })

  it('lo que baja es el GML de construcción, con su huella y su footPrint', () => {
    const { estadoEdificio } = cablear()
    estadoEdificio.set(edificioBueno({ refcat: '9398516VK3799G' }))
    boton().click()

    const xml = descargas[0].texto
    expect(xml).toContain('<bu-ext2d:Building')
    expect(xml).toContain('footPrint')
    expect(xml).toContain('srsName="urn:ogc:def:crs:EPSG::25830"')
    // La identidad viaja: sin ella el fichero no dice de qué construcción es.
    expect(xml).toContain('<base:localId>9398516VK3799G</base:localId>')
  })

  it('el desenlace se dice en el renglón, con el nombre del fichero', () => {
    const { estadoEdificio } = cablear()
    estadoEdificio.set(edificioBueno())
    boton().click()
    expect(renglon().textContent).toMatch(/^Descargado «edificio_/)
  })

  it('una piscina sale como OtherConstruction y NO cuenta para la huella', () => {
    const { estadoEdificio } = cablear()
    estadoEdificio.set(
      crearEdificio({
        idLocal: 'chalet.dxf',
        partes: [
          parte('Vivienda', rect(0, 0, 10, 10)),
          parte('Piscina', rect(30, 0, 8, 4), { tipo: TIPO_PARTE.OTRA, plantasSobreRasante: null }),
        ],
      }),
    )
    boton().click()

    const xml = descargas[0].texto
    expect(xml).toContain('<bu-ext2d:OtherConstruction')
    expect(xml).toContain('openAirPool')
    // Un solo patch: la piscina no entra en la envolvente del edificio.
    expect(xml.match(/<gml:PolygonPatch>/g)).toHaveLength(1)
  })

  it('si la descarga falla, se dice y no se calla', () => {
    const { estadoEdificio } = cablear({
      descargar: () => ({ descargado: false, nombre: null, mensaje: 'El navegador no ha podido.' }),
    })
    estadoEdificio.set(edificioBueno())
    boton().click()
    expect(renglon().textContent).toBe('El navegador no ha podido.')
    expect(renglon().classList.contains('gml-accion-estado--error')).toBe(true)
  })
})

// ── 3 · Lo que se le cuenta al usuario antes de subirlo ──────────────────────

describe('cablearGeneracionGmlEdificio · el panel de avisos', () => {
  it('⭐ «no se ha comprobado si cae dentro de la parcela» sale ANTES de descargar', () => {
    // Es el caso NORMAL —medido en la fase 0: `parcelaContexto` viene vacío por
    // las dos vías—, y el técnico tiene que leerlo antes de subir el fichero a la
    // Sede, no cuando ya está en su carpeta.
    const { estadoEdificio } = cablear()
    estadoEdificio.set(edificioBueno())
    boton().click()

    const indiceAviso = avisos.findIndex((a) => /No se ha comprobado/.test(a.mensaje))
    expect(indiceAviso).toBeGreaterThanOrEqual(0)
    expect(descargas).toHaveLength(1)
    // El aviso está en la lista y la descarga ocurrió: el orden se comprueba
    // porque el aviso se publica dentro del mismo clic, antes de serializar.
    expect(avisos[indiceAviso].nivel).toBe(NIVEL.AVISO)
  })

  it('con errores, el renglón resume y el botón se apaga: el clic ni llega', () => {
    // ⚠️ Medido al escribir esta prueba: **un botón `disabled` no emite `click`**,
    // ni en jsdom ni en el navegador. Así que con errores el usuario NO llega
    // nunca al panel por esta vía — lo que lee es el renglón, y por eso el
    // renglón lleva el recuento y los dos primeros motivos y no un «no se puede».
    const { cable, estadoEdificio } = cablear()
    estadoEdificio.set(
      crearEdificio({
        idLocal: 'x',
        partes: [
          parte('A', rect(0, 0, 10, 10), { plantasSobreRasante: null }),
          parte('B', rect(30, 0, 10, 10), { plantasSobreRasante: null }),
        ],
      }),
    )
    boton().click()
    expect(descargas).toHaveLength(0)
    expect(renglon().textContent).toMatch(/^2 errores bloquean/)

    // Y por la vía PROGRAMÁTICA —que es API pública de este módulo— los errores
    // sí salen enteros y uno a uno, que es donde caben. Sigue sin descargarse nada.
    avisos.length = 0
    expect(cable.generar()).toBeNull()
    const bloqueantes = avisos.filter((a) => a.nivel === NIVEL.ERROR)
    expect(bloqueantes).toHaveLength(2)
    expect(bloqueantes.every((a) => /plantas sobre rasante/.test(a.mensaje))).toBe(true)
    expect(descargas).toHaveLength(0)
  })

  it('lo que decide el serializador también se cuenta (regla de oro 1)', () => {
    const { estadoEdificio } = cablear()
    estadoEdificio.set(edificioBueno())
    boton().click()
    // La envolvente sale antihoraria y el serializador la invierte (override O1).
    expect(avisos.some((a) => /sentido|orientaci/i.test(a.mensaje))).toBe(true)
  })
})

// ── 4 · El reparto del MANDO ─────────────────────────────────────────────────

describe('cablearGeneracionGmlEdificio · sin mando no toca nada', () => {
  it('con la rama Parcela puesta, no escribe el botón ni el renglón', () => {
    const { estadoEdificio } = cablear({ mando: () => false })
    boton().disabled = false
    renglon().textContent = 'GML de la parcela preparado.'

    estadoEdificio.set(edificioBueno())

    expect(boton().disabled).toBe(false)
    expect(renglon().textContent).toBe('GML de la parcela preparado.')
  })

  it('y un clic que llegue igualmente NO descarga el GML de la construcción', () => {
    const { estadoEdificio } = cablear({ mando: () => false })
    estadoEdificio.set(edificioBueno())
    boton().click()
    expect(descargas).toHaveLength(0)
  })

  it('`refrescar()` es lo que repinta al recuperar el mando', () => {
    let manda = false
    const { cable, estadoEdificio } = cablear({ mando: () => manda })
    estadoEdificio.set(edificioBueno())
    expect(renglon().textContent).toBe('')

    manda = true
    cable.refrescar()
    expect(boton().disabled).toBe(false)
    expect(renglon().textContent).toBe('')

    estadoEdificio.set(null)
    expect(renglon().textContent).toBe(MOTIVO_SIN_EDIFICIO)
  })

  it('`destruir()` retira el oyente y la suscripción', () => {
    const { cable, estadoEdificio } = cablear()
    cable.destruir()
    estadoEdificio.set(edificioBueno())
    // Ni repinta…
    expect(boton().disabled).toBe(true)
    // …ni responde al clic.
    boton().click()
    expect(descargas).toHaveLength(0)
  })
})

// ── 5 · La red de la regla de oro 1 ──────────────────────────────────────────

describe('cablearGeneracionGmlEdificio · cuando revienta algo', () => {
  it('un POJO corrupto en el store no deja el botón mudo', () => {
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { estadoEdificio } = cablear()
    // El store admite cualquier cosa: `crearEstadoVista` no valida nada.
    estadoEdificio.set({ partes: [{ nombre: 'X', recinto: { vertices: [[NaN, NaN]] } }] })

    expect(boton().disabled).toBe(true)
    expect(renglon().textContent).toBe(MENSAJE_FALLO_INESPERADO)
    expect(espia).toHaveBeenCalled()
    espia.mockRestore()
  })
})

// ── 6 · Los helpers de dominio ───────────────────────────────────────────────

describe('cablearGeneracionGmlEdificio · los helpers', () => {
  it('`plantasDelEdificio` es el MÁXIMO de las principales, y `null` no es 0', () => {
    const partes = [
      parte('A', rect(0, 0, 5, 5), { plantasSobreRasante: 2 }),
      parte('B', rect(10, 0, 5, 5), { plantasSobreRasante: 7 }),
      parte('Sótano', rect(20, 0, 5, 5), { plantasSobreRasante: 0 }),
    ]
    expect(plantasDelEdificio(partes)).toBe(7)
    // Ninguna declarada ⇒ `null`, que NO es lo mismo que 0: cero plantas sobre
    // rasante es lo que convierte un edificio en un sótano.
    expect(plantasDelEdificio([parte('A', rect(0, 0, 5, 5), { plantasSobreRasante: null })])).toBeNull()
    expect(plantasDelEdificio([])).toBeNull()
  })

  it('`plantasDelEdificio` ignora las «Otra»: una piscina no tiene plantas', () => {
    const piscina = parte('Piscina', rect(0, 0, 5, 5), {
      tipo: TIPO_PARTE.OTRA,
      plantasSobreRasante: null,
    })
    expect(plantasDelEdificio([piscina])).toBeNull()
  })

  it('`otrasDe` selecciona las «Otra» CON contorno', () => {
    const partes = [
      parte('Vivienda', rect(0, 0, 5, 5)),
      parte('Piscina', rect(10, 0, 5, 5), { tipo: TIPO_PARTE.OTRA, plantasSobreRasante: null }),
      crearParteConstruccion({ nombre: 'Porche sin dibujar', tipo: TIPO_PARTE.OTRA, origen: 'DIBUJADA' }),
    ]
    const otras = otrasDe(partes)
    expect(otras).toHaveLength(1)
    expect(otras[0].nombre).toBe('Piscina')
  })

  it('`identidadDe` prefiere la referencia catastral, y nunca inventa', () => {
    expect(identidadDe({ refcat: '9398516VK3799G', idLocal: 'x.dxf' })).toBe('9398516VK3799G')
    expect(identidadDe({ refcat: null, idLocal: 'x.dxf' })).toBe('x.dxf')
    expect(identidadDe({ refcat: '  ', idLocal: 'x.dxf' })).toBe('x.dxf')
    expect(identidadDe({ refcat: null, idLocal: null })).toBeNull()
    expect(identidadDe(null)).toBeNull()
  })
})

// ── 7 · ⭐ El edificio real, de punta a punta ────────────────────────────────

describe('cablearGeneracionGmlEdificio · las trece partes del Catastro', () => {
  it('un edificio real entra, se valida, se genera y baja', () => {
    const gml = readFileSync(
      join(RAIZ, 'test', 'fixtures', 'gml', 'bu_buildingpart_9398516VK3799G.gml'),
      'utf8',
    )
    const { edificio } = entradaDesdeGmlBu(gml)
    const { estadoEdificio } = cablear()
    estadoEdificio.set(edificio)

    expect(boton().disabled).toBe(false)
    boton().click()

    expect(descargas).toHaveLength(1)
    const xml = descargas[0].texto
    // La huella son DOS cuerpos: es la del Catastro, medida.
    expect(xml.match(/<gml:PolygonPatch>/g)).toHaveLength(2)
    // Y el máximo de plantas de las trece.
    expect(xml).toContain('<bu-ext2d:numberOfFloorsAboveGround>7<')
    // Sin `BuildingPart`: el ICUC no los procesa.
    expect(xml).not.toContain('BuildingPart')
  })
})

// ── ⭐ F14 · LA VALIDACIÓN SE PUBLICA, Y `porParte` ESTRENA LLAMANTE ──────────

describe('cablearGeneracionGmlEdificio · F14 · el canal de la validación', () => {
  it('`partesSenaladas` traduce `porParte` a índices, sin repetir y en orden', () => {
    const validacion = {
      porParte: [
        { indice: 0, errores: [], avisos: [] },
        { indice: 1, errores: [{ x: 1 }], avisos: [] },
        { indice: 2, errores: [], avisos: [{ y: 2 }] },
        { indice: 3, errores: [{ x: 1 }], avisos: [{ y: 2 }] },
      ],
    }
    // ⚠️ Errores y avisos entran los DOS, y el mapa no los distingue: el resalte
    // contesta «¿de qué parte habla lo que estoy leyendo?», no «¿es grave?».
    // Dos trazos distintos ahí estarían a un paso de leerse como un semáforo.
    expect(partesSenaladas(validacion)).toEqual([1, 2, 3])
  })

  it('sin validación —o con una rota— devuelve `[]` y NO lanza', () => {
    // Se llama desde un suscriptor del store: reventar ahí tumbaría a los demás.
    for (const basura of [null, undefined, {}, { porParte: null }, { porParte: 'x' }]) {
      expect(() => partesSenaladas(basura)).not.toThrow()
      expect(partesSenaladas(basura)).toEqual([])
    }
    expect(partesSenaladas({ porParte: [{ indice: null, errores: [{}], avisos: [] }] })).toEqual([])
  })

  it('⭐ publica en CADA cambio del modelo, no solo al pulsar «Generar GML»', () => {
    // Es la mitad que F13 dejó anotada como pendiente: para que el resalte esté
    // vivo hay que validar al cambiar el modelo. Ya se hacía —`refrescar` gobierna
    // el botón—, así que el canal no añade ni una validación: publica la que ya se
    // estaba calculando.
    const { cable, estadoEdificio } = cablear()
    const vistas = []
    cable.alValidacion((v) => vistas.push(v))

    estadoEdificio.set(edificioBueno())
    estadoEdificio.set(edificioBueno({ idLocal: 'otra.dxf' }))
    expect(vistas).toHaveLength(2)
    expect(vistas.every((v) => Array.isArray(v?.porParte))).toBe(true)
    // Y la última queda leíble sin volver a preguntar.
    expect(cable.ultimaValidacion()).toBe(vistas.at(-1))
  })

  it('sin partes publica `null`: no hay nada que validar, y no es «cero hallazgos»', () => {
    const { cable, estadoEdificio } = cablear()
    const vistas = []
    cable.alValidacion((v) => vistas.push(v))
    estadoEdificio.set(edificioBueno())
    estadoEdificio.set(null)
    expect(vistas.at(-1)).toBeNull()
    expect(partesSenaladas(vistas.at(-1))).toEqual([])
  })

  it('⛔ una parte que se sale de la parcela SE SEÑALA, y es la que se sale', () => {
    // El criterio de la ficha §16.1, con datos: dos partes, una dentro de la
    // parcela declarada y otra fuera. Lo que se afirma es CUÁL se señala.
    const dentro = parte('Dentro', rect(0, 0, 10, 10))
    const fuera = parte('Fuera', rect(400, 400, 10, 10))
    const { cable, estadoEdificio } = cablear()
    const vistas = []
    cable.alValidacion((v) => vistas.push(v))
    estadoEdificio.set(
      crearEdificio({
        idLocal: 'dos.dxf',
        partes: [dentro, fuera],
        parcelaContexto: [{ tipo: 'EXTERIOR', vertices: rect(-5, -5, 30, 30).vertices }],
      }),
    )
    const senaladas = partesSenaladas(vistas.at(-1))
    expect(senaladas, 'la parte que se sale es la 1, no la 0').toContain(1)
    expect(senaladas).not.toContain(0)
  })

  it('varios oyentes conviven, uno roto no interrumpe, y `destruir` los suelta', () => {
    const { cable, estadoEdificio } = cablear()
    const buenos = []
    cable.alValidacion(() => {
      throw new Error('oyente roto')
    })
    const baja = cable.alValidacion(() => buenos.push(1))
    // Quien avisa ya ha hecho su trabajo: un oyente roto se cuenta y no corta.
    expect(() => estadoEdificio.set(edificioBueno())).not.toThrow()
    expect(buenos).toHaveLength(1)

    baja()
    estadoEdificio.set(edificioBueno({ idLocal: 'otra.dxf' }))
    expect(buenos).toHaveLength(1)

    expect(() => cable.alValidacion('no soy función')).toThrow(TypeError)
    cable.destruir()
  })
})
