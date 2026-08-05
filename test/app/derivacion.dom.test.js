/* -------------------------------------------------------------------------- *
 * test/app/derivacion.dom.test.js — F17 · 4.2 · La costura del sobrante         *
 *                                                                              *
 * `cablearDerivacion` es donde F17 deja de ser una biblioteca y pasa a ser un   *
 * botón. Lo que se defiende aquí, por orden de importancia:                     *
 *                                                                              *
 *   1. ⛔ **QUE EL PREDICADO DEL CTA SEA BARATO Y ESTRUCTURAL**, y que NO mire  *
 *      la superficie. «Área menor» no implica «está dentro», y el predicado     *
 *      corre en cada vértice arrastrado. La PUERTA corre al pulsar, y explica   *
 *      con cifras cuando dice que no.                                          *
 *   2. ⛔ **QUE NO BASTE `xml !== null` PARA DESCARGAR.** El fichero de una sola *
 *      parcela sería un GML impecable y válido contra el XSD; lo que estaría    *
 *      mal es el EXPEDIENTE, y eso no lo ve ningún validador de esquema.         *
 *   3. ⛔ **QUE LA FOTO CADUQUE CON CUALQUIER CAMBIO** (decisión 3C), no solo    *
 *      cuando entra otra parcela: mover un vértice es exactamente lo que la     *
 *      invalida, y la identidad de la parcela no cambia al moverlo.             *
 *   4. Que ningún botón se quede gris y mudo, en ninguno de los seis motivos.   *
 *   5. Que el resaltado sea recíproco DE VERDAD, en los dos sentidos.           *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom + Leaflet real para la capa de manchas).         *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  cablearDerivacion,
  MOTIVO_NO_CIERRA,
  MOTIVO_SIN_GEOMETRIA,
  MOTIVO_SIN_OFICIAL,
  SELECTOR_ANFITRION,
  SELECTOR_BOTON,
  SELECTOR_ESTADO,
} from '../../app/cableado-derivacion.js'
import { crearParcela, crearRecinto, ORIGEN_PARCELA } from '../../model/parcela.js'
import { crearEstadoVista, latLngAUTM } from '../../viewer/_comun.js'
import {
  crearListaSobrante,
  MOTIVO_NINGUNA_INCLUIDA,
  MOTIVO_SIN_DERIVAR,
  SELECTOR,
} from '../../viewer/lista-sobrante.js'
import { CLASE_NUMERO, CLASE_PIEZA, crearCapaPiezas } from '../../viewer/piezas.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

const SRS = 'EPSG:25830'
const HUSO = 30
const FECHA = new Date(Date.UTC(2026, 7, 5, 9, 30, 0))

// Un cuadrado de 40 m junto al centro del encuadre del arnés, para que las
// manchas caigan en pantalla y «fuera del encuadre» no salga por su cuenta.
let X0 = 0
let Y0 = 0

const anilloRect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
]

/** La parcela oficial: 40 × 40 m. */
const oficial = () => [crearRecinto(anilloRect(X0, Y0, X0 + 40, Y0 + 40))]

/**
 * La geometría MEDIDA. Con `mengua > 0` la parcela se ha encogido por el este y
 * suelta una franja; con `mengua < 0` ha CRECIDO, que es lo que cierra la puerta.
 */
function parcela({ mengua = 10, refcat = '7136910UF1473N', idLocal = 'P-1' } = {}) {
  return crearParcela({
    idLocal,
    refcat,
    recintos: [crearRecinto(anilloRect(X0, Y0, X0 + 40 - mengua, Y0 + 40))],
    geometriaOficial: oficial(),
    origen: ORIGEN_PARCELA.WFS,
  })
}

// ── Arnés ────────────────────────────────────────────────────────────────────

let entorno = null
let estado = null
let lista = null
let capa = null
let avisos = []
let descargas = []
let cableado = null

/** La cáscara MÍNIMA con los tres nodos del contrato de este cableado. */
function montarCascara() {
  document.body.innerHTML = `
    <div class="gml-app">
      <section data-anfitrion="sobrante" hidden></section>
      <div class="gml-acciones">
        <button type="button" data-accion="derivar-sobrante" disabled>Derivar sobrante</button>
        <p data-estado="derivar-sobrante" role="status"></p>
      </div>
    </div>`
}

/** Un doble de la descarga que registra lo que se le pide y no toca el disco. */
const descargar = (xml, opciones) => {
  descargas.push({ xml, ...opciones })
  return { descargado: true, nombre: `expediente-x_${opciones.miembros}.gml`, motivo: null }
}

function cablear(extra = {}) {
  cableado = cablearDerivacion({
    estado,
    lista,
    capa,
    panel: { avisar: (mensaje, detalle) => avisos.push({ mensaje, nivel: detalle?.nivel }) },
    srs: SRS,
    documento: document,
    ahora: () => FECHA,
    descargar,
    ...extra,
  })
  return cableado
}

beforeEach(() => {
  avisos = []
  descargas = []
  montarCascara()
  // Zoom 16 y no 18: a 18 el encuadre mide ~150 m y el cuadrado de 40 m con su
  // franja se saldría solo. «Fuera del encuadre» tiene que ser algo que un test
  // provoque, no el estado normal del arnés.
  entorno = montarMapa({ zoom: 16 })
  crearPanes(entorno.mapa)
})

afterEach(() => {
  cableado?.destruir()
  cableado = null
  lista?.destruir()
  capa?.destruir()
  entorno.destruir()
  document.body.innerHTML = ''
})

const boton = () => document.querySelector(SELECTOR_BOTON)
const renglon = () => document.querySelector(SELECTOR_ESTADO)
const seccion = () => document.querySelector(SELECTOR_ANFITRION)
const filas = () => [...document.querySelectorAll(SELECTOR.FILA)]
const botonEntregar = () => document.querySelector(SELECTOR.ENTREGAR)
const renglonEntrega = () => document.querySelector(SELECTOR.ESTADO_ENTREGA)
const nota = () => document.querySelector(SELECTOR.NOTA)
const manchas = () => entorno.contenedor.querySelectorAll(`.${CLASE_PIEZA}`)
const numeros = () => entorno.contenedor.querySelectorAll(`.${CLASE_NUMERO}`)

describe('cablearDerivacion', () => {
  beforeEach(() => {
    const centro = latLngAUTM(entorno.mapa.getCenter(), HUSO)
    X0 = centro[0] - 20
    Y0 = centro[1] - 20
    estado = crearEstadoVista(null)
    lista = crearListaSobrante({ documento: document })
    capa = crearCapaPiezas({ mapa: entorno.mapa, zona: HUSO })
  })

  // ── 1 · Contratos ─────────────────────────────────────────────────────────

  describe('contratos', () => {
    it('sin store, sin lista, sin capa, sin panel o sin srs, LANZA nombrando cuál', () => {
      const base = { estado, lista, capa, panel: { avisar() {} }, srs: SRS, documento: document }
      expect(() => cablearDerivacion({ ...base, estado: null })).toThrow(/'estado'/)
      expect(() => cablearDerivacion({ ...base, lista: {} })).toThrow(/sobrante: true/)
      expect(() => cablearDerivacion({ ...base, capa: {} })).toThrow(/viewer\/piezas\.js/)
      expect(() => cablearDerivacion({ ...base, panel: null })).toThrow(/app\/avisos\.js/)
      expect(() => cablearDerivacion({ ...base, srs: '' })).toThrow(/EPSG:25830/)
    })

    it('si la cáscara no trae un nodo del contrato, LANZA nombrándolo', () => {
      document.body.innerHTML = '<div class="gml-app"></div>'
      expect(() => cablear()).toThrow(/data-accion="derivar-sobrante"/)
    })

    it('cuelga el bloque de la sección anfitriona, que venía VACÍA', () => {
      expect(seccion().children).toHaveLength(0)
      cablear()
      expect(seccion().querySelector(SELECTOR.BLOQUE)).not.toBeNull()
    })

    it('el bloque nace ESCONDIDO: aparece solo cuando hay sobrante (D2)', () => {
      cablear()
      expect(seccion().hidden).toBe(true)
    })
  })

  // ── 2 · ⛔ El predicado del CTA ───────────────────────────────────────────

  describe('el CTA del pie', () => {
    it('con el store vacío nace APAGADO y el renglón dice que falta el contorno', () => {
      cablear()
      expect(boton().disabled).toBe(true)
      expect(renglon().textContent).toBe(MOTIVO_SIN_OFICIAL)
    })

    it('con contorno oficial pero sin geometría medida, lo dice DISTINTO', () => {
      cablear()
      estado.set({ geometriaOficial: oficial(), recintos: [] })
      expect(boton().disabled).toBe(true)
      expect(renglon().textContent).toBe(MOTIVO_SIN_GEOMETRIA)
    })

    it('con las dos mitades, se enciende y el renglón se calla', () => {
      cablear()
      estado.set(parcela())
      expect(boton().disabled).toBe(false)
      expect(renglon().textContent).toBe('')
    })

    it('⛔ el predicado NO mira la superficie: una parcela que CRECIÓ lo enciende igual', () => {
      // «Área menor» no implica «está dentro», y comprobarlo de verdad cuesta una
      // resta booleana que no se puede pagar en cada `input` de un arrastre. Quien
      // dice que no es la PUERTA, al pulsar.
      cablear()
      estado.set(parcela({ mengua: -10 }))
      expect(boton().disabled).toBe(false)
    })
  })

  // ── 3 · Derivar ───────────────────────────────────────────────────────────

  describe('derivar', () => {
    it('pinta la lista Y las manchas, y enseña el bloque', () => {
      cablear()
      estado.set(parcela())
      boton().click()

      expect(filas()).toHaveLength(1)
      expect(manchas()).toHaveLength(1)
      expect(numeros()).toHaveLength(1)
      expect(seccion().hidden).toBe(false)
      // ⛔ Y el renglón del PIE se calla, a propósito: lo que diría —cuántas y
      // cuánto miden— lo dice el bloque con su contador y una fila por pieza, y lo
      // dice mejor. Medido por el guion 16: repetirlo cuesta 22,84 px de tabla de
      // vértices, que a 1280×720 son casi tres cuartos de fila de las quince.
      expect(renglon().textContent).toBe('')
    })

    it('sin piezas SÍ habla, porque no aparece ningún bloque que lo diga', () => {
      cablear()
      estado.set(parcela({ mengua: 0 }))
      boton().click()
      expect(renglon().textContent).toMatch(/No hay sobrante/)
    })

    it('el botón de entrega se enciende con la selección puesta', () => {
      cablear()
      estado.set(parcela())
      boton().click()
      expect(botonEntregar().disabled).toBe(false)
    })

    it('⛔ desmarcar TODAS lo apaga con el motivo, y remite a «Generar GML»', () => {
      // Excluirlas todas es legítimo; lo que ya no hay es un expediente de VARIAS
      // parcelas que entregar. Decirlo es la diferencia entre apagado y muerto.
      cablear()
      estado.set(parcela())
      boton().click()
      const casilla = document.querySelector(SELECTOR.INCLUIR)
      casilla.checked = false
      casilla.dispatchEvent(new window.Event('change', { bubbles: true }))
      expect(botonEntregar().disabled).toBe(true)
      expect(renglonEntrega().textContent).toBe(MOTIVO_NINGUNA_INCLUIDA)
    })

    it('⛔ LA PUERTA: si la parcela CRECIÓ no se deriva nada y se explica con cifras', () => {
      // El sobrante saldría VACÍO mientras hay vecinos afectados, y la aplicación
      // exportaría un expediente incompleto con total confianza.
      cablear()
      estado.set(parcela({ mengua: -10 }))
      boton().click()

      expect(filas()).toHaveLength(0)
      expect(manchas()).toHaveLength(0)
      expect(seccion().hidden).toBe(true)
      expect(renglon().textContent).toMatch(/SE SALE del contorno oficial/)
      expect(renglon().textContent).toMatch(/400,00 m²/)
      expect(renglon().classList.contains('gml-accion-estado--error')).toBe(true)
      // ⚠️ Y el PORQUÉ va al panel de avisos, no al renglón. La partición está
      // MEDIDA por el guion 16: las cinco líneas del mensaje entero, a 343 px de
      // ancho, le comían 74,96 px a la tabla de vértices — un tercio de lo que le
      // queda a 1280×720. Lo accionable con su cifra arriba; el porqué, abajo.
      expect(renglon().textContent.length, 'el renglón del pie no puede ser un párrafo').toBeLessThan(150)
      expect(avisos.map((a) => a.mensaje).join(' ')).toMatch(
        /es terreno de alguien.*fase 2 de esta feature/s,
      )
    })

    it('y no se llama error: no haber sobrante es un resultado legítimo', () => {
      cablear()
      estado.set(parcela({ mengua: 0 }))
      boton().click()
      expect(renglon().classList.contains('gml-accion-estado--error')).toBe(false)
    })

    it('todo lo que decidió la derivación va al PANEL de avisos (regla de oro 1)', () => {
      // Con una mengua de 1 mm la franja es una ASTILLA: se lista con sus cifras
      // (no desaparece, al revés que en F07) y la detección de «pieza estrecha»
      // sale por el canal que es de lo que le pasa al DATO.
      cablear()
      estado.set(parcela({ mengua: 0.001 }))
      boton().click()
      expect(filas(), 'la astilla se LISTA, no se descarta').toHaveLength(1)
      expect(avisos.map((a) => a.mensaje).join(' ')).toMatch(
        /ruido de redondeo del lindero.*incluirla o no es tuyo/,
      )
    })

    it('un fallo INESPERADO del cálculo se cuenta en los dos sitios', () => {
      // Al panel porque es lo que le pasa al DATO; al renglón porque el usuario
      // acaba de pulsar un botón y tiene derecho a saber que no ha pasado nada.
      cablear()
      estado.set(parcela())
      // Una geometría oficial que revienta la resta: recinto sin `vertices`.
      estado.set({ ...parcela(), geometriaOficial: [{ tipo: 'EXTERIOR' }] })
      boton().click()
      expect(renglon().textContent).toMatch(/Mira el panel de avisos|fallado/)
    })
  })

  // ── 4 · ⛔ La foto caduca (3C) ────────────────────────────────────────────

  describe('el sobrante es una FOTO', () => {
    it('⛔ mover un vértice la invalida, aunque la parcela sea LA MISMA', () => {
      // La identidad no cambia al editar, así que el gancho de `viewer/index.js`
      // —que suelta las colindantes cuando entra OTRA parcela— no sirve aquí.
      cablear()
      estado.set(parcela())
      boton().click()
      expect(filas()).toHaveLength(1)

      estado.set(parcela({ mengua: 12 }))
      expect(filas()).toHaveLength(0)
      expect(manchas()).toHaveLength(0)
      expect(cableado.ultimaCesion()).toBeNull()
    })

    it('⭐ y lo DICE en el bloque, que se queda a la vista con la explicación', () => {
      // Esconderlo haría desaparecer al mismo tiempo la lista y la explicación de
      // por qué ha desaparecido, que es la definición de fallo silencioso.
      cablear()
      estado.set(parcela())
      boton().click()
      estado.set(parcela({ mengua: 12 }))
      expect(seccion().hidden).toBe(false)
      expect(nota().textContent).toMatch(/Los nombres escritos se han perdido/)
    })

    it('si entra OTRA parcela, el mensaje es distinto y lo dice', () => {
      cablear()
      estado.set(parcela())
      boton().click()
      estado.set(parcela({ idLocal: 'P-2', refcat: '9999999XX9999X' }))
      expect(nota().textContent).toMatch(/Ha entrado otra parcela/)
    })

    it('los nombres escritos NO se reasignan: se pierden', () => {
      cablear()
      estado.set(parcela())
      boton().click()
      const campo = document.querySelector(SELECTOR.NOMBRE)
      campo.value = 'Cesión al camino'
      campo.dispatchEvent(new window.Event('input', { bubbles: true }))
      expect(lista.nombres()).toEqual({ 1: 'Cesión al camino' })

      estado.set(parcela({ mengua: 12 }))
      boton().click()
      expect(lista.nombres()).toEqual({})
    })
  })

  // ── 5 · ⛔ La entrega ─────────────────────────────────────────────────────

  describe('entregar', () => {
    function derivado() {
      cablear()
      estado.set(parcela())
      boton().click()
      return cableado
    }

    it('compone el expediente y lo descarga con el HECHO de cuántos miembros lleva', () => {
      derivado()
      botonEntregar().click()
      expect(descargas).toHaveLength(1)
      // ⛔ Se pasa `miembros` y no un prefijo: si el llamante pudiera elegir el
      // nombre, podría llamar «parcela» a un fichero con tres.
      expect(descargas[0].miembros).toBe(2)
      expect(descargas[0].refcat).toBe('7136910UF1473N')
      expect(descargas[0].fecha).toBe(FECHA)
      expect(descargas[0].xml).toMatch(/gml:featureMember/)
    })

    it('el acuse queda escrito y sigue visible al terminar', () => {
      derivado()
      botonEntregar().click()
      expect(renglonEntrega().textContent).toMatch(/Descargado «expediente-x_2\.gml» con 2 parcelas/)
      expect(renglonEntrega().classList.contains('gml-accion-estado--error')).toBe(false)
    })

    it('excluir una pieza cambia lo que se compone', () => {
      derivado()
      const casilla = document.querySelector(SELECTOR.INCLUIR)
      casilla.checked = false
      casilla.dispatchEvent(new window.Event('change', { bubbles: true }))
      // El botón está apagado, así que `entregar()` no debería bajar nada aunque
      // se llame a mano… pero llamarlo es legítimo, y entonces compone SOLO la
      // parcela, que no es un expediente: no cierra y no se descarga.
      cableado.entregar()
      expect(descargas).toHaveLength(0)
      expect(renglonEntrega().textContent).toBe(MOTIVO_NO_CIERRA)
    })

    it('⛔ un expediente que NO cierra no se descarga, aunque el XML esté impecable', () => {
      // El test que da nombre a este bloque: el fichero de una sola parcela sería
      // un GML válido contra el XSD. Lo que estaría mal es el EXPEDIENTE.
      derivado()
      const casilla = document.querySelector(SELECTOR.INCLUIR)
      casilla.checked = false
      casilla.dispatchEvent(new window.Event('change', { bubbles: true }))
      cableado.entregar()
      expect(descargas).toHaveLength(0)
      expect(renglonEntrega().textContent).toMatch(/IVG negativo/)
    })

    it('sin foto derivada, `entregar()` no hace nada y no lanza', () => {
      cablear()
      expect(cableado.entregar()).toBeNull()
      expect(descargas).toHaveLength(0)
      expect(renglonEntrega().textContent).toBe(MOTIVO_SIN_DERIVAR)
    })
  })

  // ── 6 · El resaltado recíproco ────────────────────────────────────────────

  describe('resaltado recíproco', () => {
    it('señalar la FILA resalta la mancha', () => {
      cablear()
      estado.set(parcela())
      boton().click()
      filas()[0].dispatchEvent(new window.MouseEvent('mouseenter'))
      expect(numeros()[0].dataset.resaltada).toBe('si')
    })

    it('y señalar la MANCHA resalta la fila', () => {
      cablear()
      estado.set(parcela())
      boton().click()
      manchas()[0].dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }))
      expect(filas()[0].dataset.resaltada).toBe('si')
    })
  })

  // ── 7 · Desmontaje ────────────────────────────────────────────────────────

  describe('destruir', () => {
    it('suelta los cinco cables y es idempotente', () => {
      cablear()
      estado.set(parcela())
      cableado.destruir()
      // El store ya no le llega: el renglón se queda como estaba.
      const antes = renglon().textContent
      estado.set(null)
      expect(renglon().textContent).toBe(antes)
      expect(() => cableado.destruir()).not.toThrow()
      cableado = null
    })
  })
})
