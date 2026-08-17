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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  cablearDerivacion,
  motivoEntregaBloqueada,
  MOTIVO_NO_CIERRA,
  MOTIVO_SIN_GEOMETRIA,
  MOTIVO_SIN_OFICIAL,
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
import {
  CLASE_NUMERO,
  CLASE_PIEZA,
  CLASE_PIEZA_FUERA,
  VARIANTE,
  crearCapaPiezas,
} from '../../viewer/piezas.js'
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
let capaFuera = null
let avisos = []
let descargas = []
let cableado = null

/** La cáscara MÍNIMA con los tres nodos del contrato de este cableado. */
function montarCascara() {
  document.body.innerHTML = `
    <div class="gml-app">
      <div class="gml-acciones">
        <button type="button" data-accion="rehacer-parcelario" disabled>Rehacer el parcelario</button>
        <p data-estado="rehacer-parcelario" role="status"></p>
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
    capaFuera,
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
  capaFuera?.destruir()
  entorno.destruir()
  document.body.innerHTML = ''
})

const boton = () => document.querySelector(SELECTOR_BOTON)
const renglon = () => document.querySelector(SELECTOR_ESTADO)
// El panel ya no cuelga de una sección de la cáscara: es un control de Leaflet
// en la esquina del mapa, así que «se ve o no» se pregunta a SU nodo.
const panelSobrante = () => lista.nodo
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
    lista = crearListaSobrante({ mapa: entorno.mapa, documento: document })
    capa = crearCapaPiezas({ mapa: entorno.mapa, zona: HUSO })
    capaFuera = crearCapaPiezas({ mapa: entorno.mapa, zona: HUSO, variante: VARIANTE.FUERA })
  })

  // ── 1 · Contratos ─────────────────────────────────────────────────────────

  describe('contratos', () => {
    it('sin store, sin lista, sin capa, sin panel o sin srs, LANZA nombrando cuál', () => {
      const base = {
        estado,
        lista,
        capa,
        capaFuera,
        panel: { avisar() {} },
        srs: SRS,
        documento: document,
      }
      expect(() => cablearDerivacion({ ...base, estado: null })).toThrow(/'estado'/)
      expect(() => cablearDerivacion({ ...base, lista: {} })).toThrow(/sobrante: true/)
      expect(() => cablearDerivacion({ ...base, capa: {} })).toThrow(/viewer\/piezas\.js/)
      expect(() => cablearDerivacion({ ...base, panel: null })).toThrow(/app\/avisos\.js/)
      expect(() => cablearDerivacion({ ...base, srs: '' })).toThrow(/EPSG:25830/)
    })

    it('si la cáscara no trae un nodo del contrato, LANZA nombrándolo', () => {
      document.body.innerHTML = '<div class="gml-app"></div>'
      expect(() => cablear()).toThrow(/data-accion="rehacer-parcelario"/)
    })

    it('⭐ el panel es un CONTROL del mapa, y ya no un hueco de la columna', () => {
      // Hasta el 2026-08-17 este cableado resolvía `[data-anfitrion="sobrante"]`
      // y le hacía `append` del nodo. Ya no: el panel se cuelga solo, en la
      // esquina `bottomleft`, y este módulo dejó de conocer un nodo de la
      // cáscara. Lo que se comprueba es que **está en el documento sin que nadie
      // de `app/` lo haya colgado** — es decir, antes incluso de cablear.
      expect(entorno.contenedor.contains(panelSobrante())).toBe(true)
      expect(panelSobrante().closest('.leaflet-bottom.leaflet-left')).not.toBeNull()
      cablear()
      expect(panelSobrante().matches(SELECTOR.BLOQUE)).toBe(true)
    })

    it('el panel nace ESCONDIDO: aparece solo cuando hay sobrante (D2)', () => {
      cablear()
      expect(panelSobrante().hidden).toBe(true)
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
      expect(panelSobrante().hidden).toBe(false)
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

    it('⛔ LA PUERTA: si la parcela CRECIÓ se ENSEÑA lo que se sale, y no se entrega', () => {
      // ⛔ **Este test afirmaba lo contrario hasta el 2026-08-10**: que no se
      // derivaba nada, que el bloque quedaba escondido y que las manchas eran cero.
      // Era el comportamiento, y era un defecto — el sobrante estaba restado,
      // medido, ordenado y numerado, y se tiraba antes de enseñarlo.
      //
      // Lo que NO ha cambiado, y por eso sigue siendo la misma prueba: **no se
      // puede ENTREGAR**. Esos metros son de un colindante y un expediente sin él
      // vuelve con IVG negativo. Lo que se ha separado es VER de ENTREGAR.
      cablear()
      estado.set(parcela({ mengua: -10 }))
      boton().click()

      // El bloque se ve, y dentro está la sección del exceso con su trozo.
      expect(panelSobrante().hidden).toBe(false)
      const fuera = document.querySelector(SELECTOR.FUERA)
      expect(fuera.hidden).toBe(false)
      expect(document.querySelectorAll(SELECTOR.FUERA_FILA)).toHaveLength(1)
      expect(document.querySelector(SELECTOR.FUERA_ROTULO).textContent).toMatch(/400,00 m²/)
      // Y la mancha está pintada, en la capa ÁMBAR y no en la del sobrante.
      expect(entorno.contenedor.querySelectorAll(`.${CLASE_PIEZA_FUERA}`)).toHaveLength(1)

      // La descarga, cerrada CON SU MOTIVO. Un botón gris y mudo es lo que no vale.
      expect(botonEntregar().disabled).toBe(true)
      expect(renglonEntrega().textContent).toMatch(/no se puede descargar/)
      expect(renglonEntrega().textContent).toMatch(/400,00 m²/)

      // El renglón del pie apunta al bloque, corto y en rojo.
      expect(renglon().textContent).toMatch(/Se sale del contorno oficial/)
      expect(renglon().textContent).toMatch(/400,00 m²/)
      expect(renglon().classList.contains('gml-accion-estado--error')).toBe(true)
      // ⚠️ Y el PORQUÉ va al panel de avisos, no al renglón. La partición está
      // MEDIDA por el guion 16: las cinco líneas del mensaje entero, a 343 px de
      // ancho, le comían 74,96 px a la tabla de vértices — un tercio de lo que le
      // queda a 1280×720. Lo accionable con su cifra arriba; el porqué, abajo.
      expect(renglon().textContent.length, 'el renglón del pie no puede ser un párrafo').toBeLessThan(150)
      expect(avisos.map((a) => a.mensaje).join(' ')).toMatch(/es terreno de alguien/s)
    })

    it('⛔ EL CASO MIXTO: se retranquea por un lado y se sale por otro, y se ven LOS DOS', () => {
      // El caso que de verdad estrena esta fase, y el que el usuario tenía delante
      // cuando lo reportó. Medido sobre su expediente real 29050A01000144
      // (2026-08-10): 36,46 m² de sobrante y 25,49 m² de exceso **a la vez**, y la
      // aplicación no le enseñaba ninguno de los dos.
      //
      // Aquí, sobre el rectángulo del arnés: la geometría se corre 10 m al este, así
      // que suelta una franja de 10×40 por el oeste y se come otra igual por el este.
      cablear()
      estado.set(
        crearParcela({
          idLocal: 'P-1',
          refcat: '7136910UF1473N',
          recintos: [crearRecinto(anilloRect(X0 + 10, Y0, X0 + 50, Y0 + 40))],
          geometriaOficial: oficial(),
          origen: ORIGEN_PARCELA.WFS,
        }),
      )
      boton().click()

      // ⭐ Las DOS mitades a la vista, que es la frase entera de esta fase.
      expect(filas(), 'el sobrante del oeste tiene que listarse').toHaveLength(1)
      expect(document.querySelectorAll(SELECTOR.FUERA_FILA)).toHaveLength(1)
      expect(panelSobrante().hidden).toBe(false)

      // Cada trozo en su capa y con su color: 400 m² a cada lado.
      expect(entorno.contenedor.querySelectorAll(`.${CLASE_PIEZA_FUERA}`)).toHaveLength(1)
      expect(manchas(), 'una mancha por trozo, las dos capas sobre el mismo mapa').toHaveLength(2)

      // Y la descarga sigue cerrada: el sobrante es bueno, pero falta el titular
      // de lo de fuera.
      expect(botonEntregar().disabled).toBe(true)
      expect(renglonEntrega().textContent).toMatch(/no se puede descargar/)
    })

    it('⛔ y `entregar()` NO descarga aunque lo llamen a pelo con la puerta cerrada', () => {
      // La defensa no puede ser el `disabled` de un botón: `entregar()` es API
      // pública del cableado. Al otro lado hay un fichero que alguien firma.
      cablear()
      estado.set(parcela({ mengua: -10 }))
      boton().click()
      expect(cableado.entregar()).toBeNull()
      expect(descargas, 'no puede haberse descargado nada').toHaveLength(0)
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
      expect(panelSobrante().hidden).toBe(false)
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

  // ── 6 bis · ⭐ El canal del sobrante (auditoría 2026-08-16, hallazgo B1) ───

  describe('alCambiarSobrante · el canal que la leyenda escucha', () => {
    it('⛔ avisa al FOTOGRAFIAR y al INVALIDAR, sin carga, y la baja funciona', () => {
      // El defecto verificado por traza: «Rehacer el parcelario» pintaba las manchas
      // cian y ámbar SIN tocar el store y sin publicar nada, así que la leyenda
      // no las anunciaba hasta la siguiente navegación o edición — el reverso
      // exacto de la doctrina escrita junto a `refrescarLeyenda` en app/main.js.
      cablear()
      estado.set(parcela())
      const vistos = []
      // El aviso NO lleva carga (patrón `alCambiarIdentidad` del expediente):
      // quien escuche vuelve a leer `ultimaCesion()`, y por eso lo que se apunta
      // aquí es esa lectura — que además prueba que el aviso llega DESPUÉS de
      // guardar la foto, nunca antes.
      const baja = cableado.alCambiarSobrante(() =>
        vistos.push(cableado.ultimaCesion() !== null),
      )

      boton().click() // deriva → hay foto
      expect(vistos).toEqual([true])

      estado.set(parcela({ mengua: 12 })) // cualquier cambio caduca la foto (3C)
      expect(vistos).toEqual([true, false])

      baja()
      boton().click()
      expect(vistos, 'después de la baja no llega nada').toHaveLength(2)
    })

    it('con algo que no es una función, LANZA (contrato del programador)', () => {
      cablear()
      // ⚠️ La comprobación del tipo va PRIMERO y no sobra: sin el canal, llamar a
      // `cableado.alCambiarSobrante(null)` lanza igual un `TypeError` («no es una
      // función»), así que este test pasaría en verde sobre un cableado que no
      // publica nada. Es la misma trampa que la mitad «la guarda NO es vacua» de
      // `test/contrato.test.js`.
      expect(typeof cableado.alCambiarSobrante).toBe('function')
      expect(() => cableado.alCambiarSobrante(null)).toThrow(TypeError)
    })

    it('un oyente roto no interrumpe ni la derivación ni a los demás', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      cablear()
      estado.set(parcela())
      const vistos = []
      cableado.alCambiarSobrante(() => {
        throw new Error('oyente roto')
      })
      cableado.alCambiarSobrante(() => vistos.push('ok'))

      expect(cableado.derivar()).not.toBeNull()
      expect(vistos).toEqual(['ok'])
      expect(error).toHaveBeenCalled()
      error.mockRestore()
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

// ── ⛔ El renglón decía SIEMPRE «no cierra», y en la mitad de los casos mentía ──

describe('motivoEntregaBloqueada · decir lo que de verdad bloquea', () => {
  // ⭐ EL DEFECTO (2026-08-10). `entregar()` escribía `MOTIVO_NO_CIERRA` ante
  // CUALQUIER bloqueo. Medido sobre `6346726UF8664N`: el conjunto cerraba —suma,
  // cero solape y cobertura, las tres— y lo que impedía la descarga era que el
  // escritor de GML no podía emitir una astilla de 0,0251 m². El autor leyó «el
  // expediente NO cierra sobre el contorno oficial», se fue a buscar un problema de
  // cierre inexistente y concluyó que la aplicación había perdido la función.
  //
  // Un botón apagado con un motivo FALSO cuesta más que uno apagado y mudo: el mudo
  // te deja mirar, el falso te manda a otro sitio.

  it('⛔ con el conjunto cerrando NO dice «no cierra»', () => {
    const texto = motivoEntregaBloqueada({ bloqueos: ['PIEZA_INVALIDA'], xml: null })
    expect(texto).not.toBe(MOTIVO_NO_CIERRA)
    expect(texto).not.toMatch(/cierra/i)
    expect(texto).toMatch(/no se puede escribir en el fichero/)
  })

  it('y cuando SÍ es el cierre, sigue diciendo exactamente lo de siempre', () => {
    // El caso que este renglón sí describía bien no se toca: es el que devuelve IVG
    // negativo y el que más falta hace explicar.
    expect(motivoEntregaBloqueada({ bloqueos: ['CONJUNTO_NO_CIERRA'], xml: null })).toBe(
      MOTIVO_NO_CIERRA,
    )
    // Y manda sobre los demás: si el conjunto no cierra, eso es lo que hay que leer.
    expect(
      motivoEntregaBloqueada({ bloqueos: ['PIEZA_INVALIDA', 'CONJUNTO_NO_CIERRA'], xml: null }),
    ).toBe(MOTIVO_NO_CIERRA)
  })

  it('junta varios bloqueos en una frase, sin repetir el «porque»', () => {
    const texto = motivoEntregaBloqueada({
      bloqueos: ['CRECE_FUERA', 'RECORTE_FALLIDO'],
      xml: null,
    })
    expect(texto).toMatch(/se sale del contorno oficial/)
    expect(texto).toMatch(/no se ha podido recortar/)
    expect(texto.match(/porque/g)).toHaveLength(1)
  })

  it('⛔ un bloqueo sin frase propia cae en el genérico, no inventa una', () => {
    // Preferible «mira los avisos» a una frase concreta y equivocada: es el mismo
    // error que este bloque arregla, cometido de otra manera.
    const texto = motivoEntregaBloqueada({ bloqueos: ['UN_TIPO_QUE_NO_EXISTE'], xml: null })
    expect(texto).toMatch(/panel de avisos/)
    expect(texto).not.toMatch(/porque/)
  })

  it('sin bloqueos —xml nulo por otra causa— tampoco afirma nada falso', () => {
    expect(motivoEntregaBloqueada({ bloqueos: [], xml: null })).toMatch(/panel de avisos/)
    expect(motivoEntregaBloqueada(null)).toMatch(/panel de avisos/)
  })
})

// ── ⭐ EL CASO DEL AUTOR, DE PUNTA A PUNTA ──────────────────────────────────

describe('cablearDerivacion · ⭐ retranqueo de milímetros + invasión de metros', () => {
  // El caso que F23 existe para resolver, con la forma exacta con la que llegó
  // roto el 2026-08-10 (`6346726UF8664N`): la medición se ENGANCHA al lindero
  // oficial por un lado —y deja una astilla de milímetros que no puede ser finca— y
  // se mete METROS en el colindante por el otro.
  //
  // Se caía por DOS sitios a la vez, y los dos están aquí:
  //   1. la astilla se ofrecía como finca y tumbaba el fichero entero;
  //   2. al no quedar ninguna pieza propia que declarar, el cableado apagaba el
  //      botón con «no hay expediente que entregar» — ignorando que el vecino
  //      recortado ES una parcela más del expediente.
  beforeEach(() => {
    const centro = latLngAUTM(entorno.mapa.getCenter(), HUSO)
    X0 = centro[0] - 20
    Y0 = centro[1] - 20
    estado = crearEstadoVista(null)
    lista = crearListaSobrante({ mapa: entorno.mapa, documento: document })
    capa = crearCapaPiezas({ mapa: entorno.mapa, zona: HUSO })
    capaFuera = crearCapaPiezas({ mapa: entorno.mapa, zona: HUSO, variante: VARIANTE.FUERA })
  })

  /** Enganchada al oeste por 0,5 mm y metida 5 m en el vecino por el este. */
  const medida = () =>
    crearParcela({
      idLocal: 'P-1',
      refcat: '7136910UF1473N',
      recintos: [crearRecinto(anilloRect(X0 + 0.0005, Y0, X0 + 45, Y0 + 40))],
      geometriaOficial: oficial(),
      origen: ORIGEN_PARCELA.WFS,
    })

  /** El registro de `app/colindantes.js`, reducido a lo que este cable le pide. */
  const registro = () => ({
    get: () => [{ refcat: 'V-1', recintos: [crearRecinto(anilloRect(X0 + 40, Y0, X0 + 80, Y0 + 40))] }],
  })

  it('⛔ la única pieza del sobrante NO se ofrece como finca, y se dice por qué', () => {
    cablear({ colindantes: registro() })
    estado.set(medida())
    boton().click()
    expect(filas()).toHaveLength(1)
    expect(document.querySelector(SELECTOR.NO_EMITIBLE)).not.toBeNull()
    expect(document.querySelector(SELECTOR.INCLUIR).checked).toBe(false)
    expect(nota().textContent).toMatch(/no se puede emitir/)
  })

  it('⭐ y el botón se ENCIENDE igual: el vecino recortado es una parcela del expediente', () => {
    // Cero altas, cero reparto… y dos parcelas que declarar. Antes aquí se leía
    // «No hay ninguna pieza incluida, así que no hay expediente que entregar», que
    // era falso.
    cablear({ colindantes: registro() })
    estado.set(medida())
    boton().click()
    expect(renglonEntrega().textContent).not.toBe(MOTIVO_NINGUNA_INCLUIDA)
    expect(botonEntregar().disabled).toBe(false)
  })

  it('⭐ y descarga: dos miembros, la parcela medida y el colindante recortado', () => {
    cablear({ colindantes: registro() })
    estado.set(medida())
    boton().click()
    botonEntregar().click()
    expect(descargas).toHaveLength(1)
    expect(descargas[0].miembros).toBe(2)
    expect(descargas[0].xml).toMatch(/7136910UF1473N/)
    expect(descargas[0].xml).toMatch(/V-1/)
    expect(renglonEntrega().classList.contains('gml-accion-estado--error')).toBe(false)
  })

  it('⛔ SIN colindantes sigue cerrado, y el motivo NO habla de cierre', () => {
    // La puerta original no se ha aflojado: sin haber traído las vecinas no se sabe
    // de quién es la superficie invadida. Y el renglón dice ESO, no «no cierra».
    cablear()
    estado.set(medida())
    boton().click()
    expect(botonEntregar().disabled).toBe(true)
    expect(renglonEntrega().textContent).toMatch(/Trae las parcelas colindantes/)
    expect(renglonEntrega().textContent).not.toBe(MOTIVO_NO_CIERRA)
  })
})
