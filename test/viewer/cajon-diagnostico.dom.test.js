/* -------------------------------------------------------------------------- *
 * test/viewer/cajon-diagnostico.dom.test.js — F07 · T3.3 · El cajón          *
 *                                                                            *
 * El cajón es una VISTA: fabrica nodos, los rellena, los abre y los cierra.    *
 * Lo que se prueba, por orden de importancia:                                 *
 *                                                                            *
 *   1. **La regla de oro 9**, que es el requisito principal del fichero: ni   *
 *      una palabra de veredicto en el DOM pintado, ni un color de mérito      *
 *      fuera de la sección de invasión, y el titular DESCRIPTIVO.            *
 *   2. **«No se ha consultado» ≠ «no hay invasión»**, que es el error         *
 *      silencioso más caro que esta vista podría cometer: la segunda          *
 *      tranquiliza y en ese caso es falsa.                                   *
 *   3. **El contrato de nodos** con `app/cableado-diagnostico.js`, que los    *
 *      localiza por selector y lanza si falta alguno.                        *
 *   4. **El clic de fuera sin interceptar**, para que F06 siga usable con el  *
 *      cajón abierto (un clic cierra Y selecciona lindero, en el mismo gesto).*
 *                                                                            *
 * El diagnóstico se construye A MANO: esta vista consume una FORMA, y montar  *
 * el pipeline aquí acoplaría el test de la vista a la aritmética.            *
 *                                                                            *
 * Proyecto Vitest `dom` (jsdom + Leaflet real, arnés `_ayuda-jsdom.js`).       *
 * -------------------------------------------------------------------------- */

import L from 'leaflet'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ETIQUETA } from '../../diagnostico/margen.js'
import {
  ALTO_COMO_CAJON,
  ALTO_COMO_PANTALLA,
  CLASE,
  ESCALA,
  ESTILO_EN_EL_PANEL,
  ESTILO_SOBRE_EL_MAPA,
  MOTIVO_INFORME_SIN_DIAGNOSTICO,
  SELECTOR,
  crearCajonDiagnostico,
} from '../../viewer/cajon-diagnostico.js'
import { montarMapa } from './_ayuda-jsdom.js'

/**
 * Los valores esperados se CONSTRUYEN con los mismos formateadores que el módulo, en
 * vez de escribirse literales, y no es pereza: el `Intl` de este entorno **no agrupa
 * los millares** (da `1538,99` donde un navegador da `1.538,99`), así que un literal
 * ataría el test al ICU de la máquina. Lo que este fichero tiene que vigilar es la
 * COMPOSICIÓN —qué cifra, con qué unidad, con qué signo y en qué orden—, no el
 * formato de miles de ICU, que es de la plataforma. La convención de decimales sí se
 * afirma, y es la MISMA que usa `app/main.js` en la ficha del pie: dos decimales para
 * lo que la app mide, ninguno forzado para lo que el Catastro declara.
 */
const f2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f0 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const m2 = (v) => `${f2.format(v)} m²`

const BANDAS_COMPLETAS = {
  valores: { medida: 1538.99, catastral: 1536, registral: 1500 },
  cruces: [
    // `relativo` en FRACCIÓN: 0,002 son el 0,20 %. Cifras redondas a propósito —
    // 0,00195 se redondearía a «0,19 %» por la representación binaria de 0,195, y el
    // test estaría probando el redondeo de float64 en vez del × 100 de la vista.
    { a: 'medida', b: 'catastral', absoluto: 2.99, relativo: 0.002 },
    { a: 'medida', b: 'registral', absoluto: 38.99, relativo: 0.026 },
    { a: 'catastral', b: 'registral', absoluto: 36, relativo: 0.024 },
  ],
}

/** Diagnóstico completo: todas las secciones con dato. */
const COMPLETO = () => ({
  superficie: { medida: 1538.99, catastral: 1536, registral: 1500, oficial: 1535.87 },
  perimetro: { medido: { exterior: 160, huecos: 0, total: 160 }, oficial: { exterior: 159, huecos: 0, total: 159 } },
  bandas: BANDAS_COMPLETAS,
  solape: { area: 1535.87, relativo: 0.99797, piezas: [], nPiezas: 1 },
  diferencia: { area: 3.12 },
  centroides: { medido: [0, 0], oficial: [0, 0], distancia: 0.0581 },
  desviacion: { porLado: [], maxima: { recinto: 0, indice: 0, maxima: 0.4, en: [0, 0], enOficial: [0, 0] }, nMuestras: 570 },
  invasion: {
    consultado: true,
    invasiones: [{ refcat: '9398515VK3799G', area: 2.641388, piezas: [] }],
    descartadas: [{ refcat: '9398501VK3799G', area: 1.2e-4, grosor: 7.1e-5, nPiezas: 1 }],
  },
  margen: {
    clase: 'URBANA',
    deducida: true,
    criterio: 'La referencia 9398516VK3799G no lleva código de polígono…',
    perimetroM: 0.5,
    superficieRelativo: 0.05,
    etiqueta: ETIQUETA,
  },
  omisiones: [],
  saltados: [],
})

/** Sin geometría oficial: cuatro secciones omitidas, cada una con su motivo. */
const SIN_OFICIAL = () => ({
  superficie: { medida: 96, catastral: null, registral: null, oficial: null },
  perimetro: { medido: { exterior: 39.2, huecos: 0, total: 39.2 }, oficial: null },
  bandas: { valores: { medida: 96, catastral: null, registral: null }, cruces: [
    { a: 'medida', b: 'catastral', absoluto: null, relativo: null },
    { a: 'medida', b: 'registral', absoluto: null, relativo: null },
    { a: 'catastral', b: 'registral', absoluto: null, relativo: null },
  ] },
  solape: null,
  diferencia: null,
  centroides: null,
  desviacion: null,
  invasion: { consultado: false, invasiones: [], descartadas: [] },
  margen: null,
  omisiones: [
    { que: 'solape', motivo: 'No hay geometría oficial con la que contrastar: X.' },
    { que: 'diferencia', motivo: 'No hay geometría oficial con la que contrastar: X.' },
    { que: 'centroides', motivo: 'No hay geometría oficial con la que contrastar: X.' },
    { que: 'desviacion', motivo: 'No hay geometría oficial con la que contrastar: X.' },
    { que: 'margen', motivo: 'No se sabe si la parcela es urbana o rústica: hay que elegirlo.' },
  ],
  saltados: [],
})

const montados = []

function conCajon(opciones = {}) {
  const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
  const cajon = crearCajonDiagnostico({ mapa, ...opciones })
  const raiz = cajon.control.getContainer()
  montados.push(() => {
    cajon.destruir()
    destruir()
  })
  return { mapa, cajon, raiz }
}

const nodo = (raiz, selector) => raiz.querySelector(selector)

afterEach(() => {
  while (montados.length > 0) montados.pop()()
})

describe('viewer/cajon-diagnostico.js · contratos del programador', () => {
  it('LANZA sin un mapa usable', () => {
    expect(() => crearCajonDiagnostico({})).toThrow(TypeError)
    expect(() => crearCajonDiagnostico({ mapa: {} })).toThrow(/addControl/)
  })

  it('LANZA con una esquina que no es de Leaflet', () => {
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    expect(() => crearCajonDiagnostico({ mapa, posicion: 'centro' })).toThrow(RangeError)
    expect(() => crearCajonDiagnostico({ mapa, posicion: 42 })).toThrow(TypeError)
    destruir()
  })

  it('la esquina por defecto es `bottomleft`, la única libre del visor', () => {
    // `topleft` la ocupa la barra de edición de F06, `topright` el control de capas y
    // `bottomright` el de opacidad Y la atribución de Leaflet. No es un gusto.
    const { cajon } = conCajon()
    expect(cajon.control.getPosition()).toBe('bottomleft')
  })
})

describe('viewer/cajon-diagnostico.js · el contrato de nodos con el cableado', () => {
  it('produce TODOS los nodos de `SELECTOR`', () => {
    // `app/cableado-diagnostico.js` los localiza por selector y LANZA si falta alguno,
    // así que este test es el que garantiza que el cableado puede montarse.
    const { raiz } = conCajon()
    for (const [nombre, selector] of Object.entries(SELECTOR)) {
      expect(nodo(raiz, selector), `falta el nodo ${nombre} (${selector})`).not.toBeNull()
    }
  })

  it('los nodos de entrada son los TIPOS que el cableado espera', () => {
    // `registral` tiene que ser un `<input type=number>` (el cableado lee `.value` y
    // escucha `change`) y `clase` un `<select>`. Cambiar de elemento rompería el
    // cableado en silencio: es la lección que dejó escrita `viewer/barra-edicion.js`.
    const { raiz } = conCajon()
    const registral = nodo(raiz, SELECTOR.REGISTRAL)
    expect(registral.tagName).toBe('INPUT')
    expect(registral.type).toBe('number')
    const clase = nodo(raiz, SELECTOR.CLASE_PARCELA)
    expect(clase.tagName).toBe('SELECT')
    expect([...clase.options].map((o) => o.value)).toEqual(['', 'URBANA', 'RUSTICA'])
  })

  it('el renglón de estado es `role="status"`: anuncia sin robar el foco', () => {
    const { raiz, cajon } = conCajon()
    const estado = nodo(raiz, SELECTOR.ESTADO)
    expect(estado.getAttribute('role')).toBe('status')
    cajon.estado('Trayendo las parcelas colindantes…')
    expect(estado.textContent).toBe('Trayendo las parcelas colindantes…')
  })

  it('los nodos existen SIEMPRE, también con el cajón cerrado', () => {
    // Si solo existieran al abrir, el `nodo()` del cableado lanzaría al arrancar.
    const { raiz, cajon } = conCajon()
    expect(cajon.abierto()).toBe(false)
    for (const selector of Object.values(SELECTOR)) {
      expect(nodo(raiz, selector)).not.toBeNull()
    }
  })

  it('los `data-*` propios no colisionan con los del contrato', () => {
    // Los selectores del contrato son de VALOR EXACTO, igual que en la barra de F06.
    const { raiz } = conCajon()
    expect(raiz.querySelectorAll('[data-accion="cerrar-diagnostico"]')).toHaveLength(1)
    expect(raiz.querySelectorAll('[data-estado="cajon-diagnostico"]')).toHaveLength(1)
    // Y NO se llama `diagnostico` a secas: ese valor lo lleva… nadie, precisamente
    // para que el `[data-estado="diagnosticar"]` del pie y este no se puedan
    // confundir. Ver el aviso de `SELECTOR` en el módulo.
    expect(raiz.querySelectorAll('[data-estado="diagnostico"]')).toHaveLength(0)
  })
})

describe('viewer/cajon-diagnostico.js · apertura y cierre', () => {
  it('nace CERRADO', () => {
    const { cajon, raiz } = conCajon()
    expect(cajon.abierto()).toBe(false)
    expect(raiz.style.display).toBe('none')
  })

  it('`abrir()` y `cerrar()` son idempotentes', () => {
    const { cajon } = conCajon()
    cajon.abrir()
    cajon.abrir()
    expect(cajon.abierto()).toBe(true)
    cajon.cerrar()
    cajon.cerrar()
    expect(cajon.abierto()).toBe(false)
  })

  it('el botón de cerrar lo cierra y avisa a `alCerrar`', () => {
    const { cajon, raiz } = conCajon()
    const alCerrar = vi.fn()
    cajon.alCerrar(alCerrar)
    cajon.abrir()

    nodo(raiz, SELECTOR.CERRAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cajon.abierto()).toBe(false)
    expect(alCerrar).toHaveBeenCalledTimes(1)
  })

  it('un clic FUERA lo cierra', () => {
    const { cajon } = conCajon()
    cajon.abrir()
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cajon.abierto()).toBe(false)
  })

  it('el clic que lo ABRE no lo cierra en el mismo gesto', () => {
    // Regresión de un fallo real de F07 · T4.3, y no de un caso raro: el CTA
    // «Diagnosticar» del pie está FUERA del cajón, su manejador corre en la fase de
    // DESTINO y el oyente de este módulo escucha en el `document` — o sea, después,
    // burbujeando el MISMO evento. La secuencia era abrir y cerrar en el mismo
    // gesto: el cajón parpadeaba y desde fuera parecía que el botón no hacía nada.
    const { cajon } = conCajon()
    const boton = document.createElement('button')
    document.body.append(boton)
    boton.addEventListener('click', (evento) => cajon.abrir(evento))

    boton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cajon.abierto()).toBe(true)

    // Y el evento se CONSUME: el siguiente clic fuera sí cierra. Un guardián que se
    // quedara puesto convertiría el cajón en algo que no se cierra pinchando fuera.
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cajon.abierto()).toBe(false)
    boton.remove()
  })

  it('abierto POR CÓDIGO, el primer clic fuera sí lo cierra', () => {
    // La razón de comparar la IDENTIDAD del evento y no poner una bandera de «recién
    // abierto»: una bandera se tragaría también este clic, que sí es un clic fuera.
    const { cajon } = conCajon()
    cajon.abrir()
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cajon.abierto()).toBe(false)
  })

  it('un clic DENTRO no lo cierra', () => {
    // `disableClickPropagation` NO detiene el `click` (detiene mousedown, touchstart,
    // dblclick y contextmenu), así que un clic dentro SÍ llega a `document`: sin la
    // comprobación `contains`, abrir algo lo cerraría en el mismo gesto.
    const { cajon, raiz } = conCajon()
    cajon.abrir()
    nodo(raiz, SELECTOR.REGISTRAL).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cajon.abierto()).toBe(true)
  })

  it('el cierre por clic fuera NO intercepta el evento: F06 sigue usable', () => {
    // Ésta es la propiedad que hace que un solo clic cierre el cajón Y seleccione un
    // lindero. Si se llamara a `preventDefault`/`stopPropagation`, el primer clic
    // después de abrir se lo comería el cajón y habría que pinchar dos veces sin que
    // nada lo explicara.
    const { cajon } = conCajon()
    cajon.abrir()

    const evento = new MouseEvent('click', { bubbles: true, cancelable: true })
    const stop = vi.spyOn(evento, 'stopPropagation')
    document.body.dispatchEvent(evento)

    expect(cajon.abierto()).toBe(false)
    expect(evento.defaultPrevented).toBe(false)
    expect(stop).not.toHaveBeenCalled()
  })

  it('`Escape` lo cierra', () => {
    const { cajon } = conCajon()
    cajon.abrir()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(cajon.abierto()).toBe(false)
  })

  it('otra tecla no lo cierra', () => {
    const { cajon } = conCajon()
    cajon.abrir()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(cajon.abierto()).toBe(true)
  })

  it('pulsar dentro del cajón NO dispara el `click` del mapa (no elige lindero)', () => {
    // Se afirma el COMPORTAMIENTO y no la bandera privada `_leaflet_disable_click`,
    // igual que hace `test/viewer/barra-edicion.dom.test.js`: lo que importa no es que
    // Leaflet marque el contenedor, es que la edición de F06 siga funcionando debajo.
    const { mapa, cajon, raiz } = conCajon()
    const clics = []
    mapa.on('click', () => clics.push(1))
    cajon.abrir()

    nodo(raiz, SELECTOR.CERRAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clics).toHaveLength(0)
  })

  it('un `mousedown` dentro no llega al contenedor del mapa (no arrastra el mapa)', () => {
    const { mapa, cajon, raiz } = conCajon()
    const vistos = []
    mapa.getContainer().addEventListener('mousedown', () => vistos.push(1))
    cajon.abrir()

    nodo(raiz, SELECTOR.REGISTRAL).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    )
    expect(vistos).toHaveLength(0)
  })

  it('la rueda sobre el cajón no llega al contenedor del mapa (no hace zoom)', () => {
    const { mapa, cajon, raiz } = conCajon()
    const vistos = []
    mapa.getContainer().addEventListener('wheel', () => vistos.push(1))
    cajon.abrir()

    nodo(raiz, SELECTOR.CRUCES).dispatchEvent(new Event('wheel', { bubbles: true, cancelable: true }))
    expect(vistos).toHaveLength(0)
  })
})

describe('viewer/cajon-diagnostico.js · pintar el caso completo', () => {
  it('el titular es DESCRIPTIVO, con las dos cifras', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    const titular = nodo(raiz, SELECTOR.TITULAR).textContent
    expect(titular).toMatch(/^Contraste con el parcelario/)
    expect(titular).toContain(m2(1538.99))
    expect(titular).toContain(`${f0.format(1536)} m²`) // la declarada, ENTERA (override O6)
  })

  it('la superficie catastral se pinta SIN decimales y la medida CON dos', () => {
    // El Catastro publica un entero (`cp:areaValue`, override O6); la app mide con dos
    // decimales. Igualar los formatos le añadiría a la declarada dos cifras de
    // precisión que nadie ha afirmado, y borraría una diferencia que ES un dato. Es la
    // misma pareja de formatos que `app/main.js` (`FORMATO_SUPERFICIE` /
    // `FORMATO_DECLARADO`), a propósito: las dos vistas no pueden discrepar.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    expect(nodo(raiz, SELECTOR.MEDIDA).textContent).toBe(m2(1538.99))
    expect(nodo(raiz, SELECTOR.CATASTRAL).textContent).toBe(`${f0.format(1536)} m²`)
    // Y la clave: la declarada NO lleva decimales.
    expect(nodo(raiz, SELECTOR.CATASTRAL).textContent).not.toMatch(/,\d/)
    expect(nodo(raiz, SELECTOR.MEDIDA).textContent).toMatch(/,\d\d/)
  })

  it('la tabla de cruces trae las TRES filas, con signo y porcentaje', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    const filas = nodo(raiz, SELECTOR.CRUCES).querySelectorAll('tbody tr')
    expect(filas).toHaveLength(3)
    expect(filas[0].textContent).toContain('Medición − Catastro')
    expect(filas[0].textContent).toContain(`+${m2(2.99)}`)
    // `relativo` es FRACCIÓN en el modelo (0,002); el × 100 es de PRESENTACIÓN y vive
    // aquí. Si algún día alguien mueve el × 100 al modelo, esto sale «+0,00 %».
    expect(filas[0].textContent).toContain('+0,20 %')
    expect(filas[2].textContent).toContain('Catastro − Registro')
  })

  it('el solape sale con su área y su porcentaje sobre la mayor', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    const texto = nodo(raiz, SELECTOR.SOLAPE).textContent
    expect(texto).toContain(m2(1535.87))
    expect(texto).toContain('99,80 %')
    expect(texto).toContain('de la mayor')
  })

  it('la desviación dice la cifra Y el lindero, que es lo que se resalta en el mapa', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    const texto = nodo(raiz, SELECTOR.DESVIACION).textContent
    expect(texto).toContain('0,40 m')
    expect(texto).toContain('lindero 1') // `indice: 0` se presenta como 1 al humano
  })

  it('el margen se enuncia con su ETIQUETA literal y sus dos cifras', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    const texto = nodo(raiz, SELECTOR.MARGEN).textContent
    expect(texto).toContain(ETIQUETA)
    expect(texto).toContain('0,50 m')
    expect(texto).toContain('5,00 %')
  })

  it('si la clase la PROPUSO la app, se DICE, y el selector se queda como estaba', () => {
    // Presentar una deducción como un dato sería colar un criterio nuestro en el
    // expediente. El `criterio` es el texto que explica de dónde sale.
    //
    // ⚠️ Este test pedía además `selector.value === 'URBANA'` («y el selector se
    // sincroniza»). Estaba MAL, y no por poco: sincronizar el desplegable con la
    // propuesta la convertía en elegida a la vuelta siguiente. Ver el test «no se
    // lava una propuesta» y la cabecera de `pintarMargen`.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    expect(nodo(raiz, SELECTOR.MARGEN).textContent).toContain('propuesta por la aplicación')
    expect(nodo(raiz, SELECTOR.CLASE_PARCELA).value).toBe('')
  })

  it('si la clase la ELIGIÓ una persona, NO se dice que sea propuesta', () => {
    const { cajon, raiz } = conCajon()
    const d = COMPLETO()
    d.margen = { ...d.margen, deducida: false, criterio: null }
    cajon.pintar(d)
    expect(nodo(raiz, SELECTOR.MARGEN).textContent).not.toContain('propuesta')
    expect(nodo(raiz, SELECTOR.MARGEN).textContent).toContain(ETIQUETA)
  })

  it('pintar dos veces no duplica filas de la tabla', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    cajon.pintar(COMPLETO())
    expect(nodo(raiz, SELECTOR.CRUCES).querySelectorAll('tbody tr')).toHaveLength(3)
  })
})

describe('viewer/cajon-diagnostico.js · «no hay» y «no se sabe» se escriben distinto', () => {
  it('sin consultar colindantes NUNCA dice «no hay invasión»', () => {
    // El error silencioso más caro que esta vista podría cometer: «no se ha
    // consultado» y «no hay invasión» son afirmaciones opuestas y la segunda
    // tranquiliza.
    const { cajon, raiz } = conCajon()
    cajon.pintar(SIN_OFICIAL())
    const texto = nodo(raiz, SELECTOR.INVASION).textContent
    expect(texto).toContain('no se ha consultado')
    expect(texto).not.toMatch(/ninguna|no hay invasión/i)
  })

  it('consultadas y sin invasión, sí dice «ninguna»', () => {
    const { cajon, raiz } = conCajon()
    const d = COMPLETO()
    d.invasion = { consultado: true, invasiones: [], descartadas: [] }
    cajon.pintar(d)
    expect(nodo(raiz, SELECTOR.INVASION).textContent).toContain('ninguna')
  })

  it('una sección omitida escribe EL MOTIVO del diagnóstico, no un guion', () => {
    // El motivo viene ya redactado del modelo: la vista no tiene su propia tabla de
    // traducciones, que es lo que se queda corto en silencio cuando el modelo crece.
    const { cajon, raiz } = conCajon()
    cajon.pintar(SIN_OFICIAL())
    for (const selector of [SELECTOR.SOLAPE, SELECTOR.CENTROIDES, SELECTOR.DESVIACION]) {
      expect(nodo(raiz, selector).textContent).toContain('No hay geometría oficial')
    }
    expect(nodo(raiz, SELECTOR.MARGEN).textContent).toContain('urbana o rústica')
  })

  it('una superficie que no consta se escribe «No consta», no «0» ni «—»', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(SIN_OFICIAL())
    expect(nodo(raiz, SELECTOR.CATASTRAL).textContent).toBe('No consta')
  })

  it('un cruce sin términos sale «No consta» en las dos columnas', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(SIN_OFICIAL())
    const primera = nodo(raiz, SELECTOR.CRUCES).querySelector('tbody tr')
    expect(primera.textContent).toContain('No consta')
    expect(primera.textContent).not.toContain('0,00')
  })

  it('las descartadas se DICEN, con su total (regla de oro 1)', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    const texto = nodo(raiz, SELECTOR.INVASION).textContent
    expect(texto).toMatch(/descartado 1 solape/)
    // El MOTIVO, no solo el conteo: lo descartado tiene que poder discutirse, y el
    // renglón decía «más finos que un milímetro» cuando el umbral real es el
    // redondeo al centímetro del propio Catastro (2026-08-10).
    expect(texto).toMatch(/redondeo al centímetro/)
  })
})

describe('viewer/cajon-diagnostico.js · NO juzga (regla de oro 9)', () => {
  const VEREDICTOS =
    /\b(apta|apto|válida|valida|válido|correcta|correcto|conforme|aprobad|suspend|admisible|aceptable|dentro de tolerancia|fuera de tolerancia|no válid)/i

  it('el DOM pintado no contiene ni una palabra de veredicto', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    expect(raiz.textContent).not.toMatch(VEREDICTOS)
  })

  it('tampoco cuando falta la mitad del dato', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(SIN_OFICIAL())
    expect(raiz.textContent).not.toMatch(VEREDICTOS)
  })

  it('las cifras van en el gris del cromo: ningún verde ni rojo de mérito', () => {
    // Un Δ en verde cuando es pequeño y en rojo cuando es grande estaría dictaminando
    // si la discrepancia es tolerable, que es exactamente la decisión que no nos toca:
    // el umbral depende del expediente, del municipio y de quien firma.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())

    const PROHIBIDOS = /#(16a34a|22c55e|dc2626|ef4444|15803d|b91c1c)/i
    for (const el of raiz.querySelectorAll('*')) {
      expect(el.getAttribute('style') || '').not.toMatch(PROHIBIDOS)
    }
  })

  // jsdom normaliza los colores en línea a `rgb(...)`, así que el hexadecimal NO
  // aparece en `getAttribute('style')`: hay que leer `el.style.color`, que sí está
  // normalizado y es comparable.
  const AMBAR = 'rgb(146, 64, 14)' // #92400E
  const enAmbar = (raiz) =>
    [...raiz.querySelectorAll('*')].filter((el) => el.style.color === AMBAR)

  it('el ÁMBAR aparece SOLO en la sección de invasión', () => {
    // Es la única excepción que la spec autoriza (§10.4): hecho topológico binario
    // con consecuencia fija. En cualquier otra sección sería un veredicto.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())

    const ambar = enAmbar(raiz)
    expect(ambar.length).toBeGreaterThan(0)
    const invasion = nodo(raiz, SELECTOR.INVASION)
    for (const el of ambar) {
      expect(invasion.contains(el)).toBe(true)
    }
  })

  it('sin invasión no hay NADA en ámbar', () => {
    const { cajon, raiz } = conCajon()
    const d = COMPLETO()
    d.invasion = { consultado: true, invasiones: [], descartadas: [] }
    cajon.pintar(d)
    expect(enAmbar(raiz)).toHaveLength(0)
  })

  it('sin consultar tampoco hay ámbar: no se sabe no es un hallazgo', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(SIN_OFICIAL())
    expect(enAmbar(raiz)).toHaveLength(0)
  })

  it('el titular no dictamina ni cuando la discrepancia es enorme', () => {
    const { cajon, raiz } = conCajon()
    const d = COMPLETO()
    d.superficie = { ...d.superficie, medida: 6000 }
    cajon.pintar(d)
    expect(nodo(raiz, SELECTOR.TITULAR).textContent).toMatch(/^Contraste con el parcelario/)
    expect(nodo(raiz, SELECTOR.TITULAR).textContent).not.toMatch(VEREDICTOS)
  })
})

describe('viewer/cajon-diagnostico.js · la superficie registral y la clase', () => {
  it('`registral()` es `null` con el campo vacío, no 0', () => {
    // Un campo vacío significa «no consta»; un 0 diría que la escritura declara cero
    // metros cuadrados. Es la misma distinción que sostiene toda la tabla.
    const { cajon } = conCajon()
    expect(cajon.registral()).toBeNull()
  })

  it('`registral()` lee el número tecleado', () => {
    const { cajon, raiz } = conCajon()
    nodo(raiz, SELECTOR.REGISTRAL).value = '1500.5'
    expect(cajon.registral()).toBe(1500.5)
  })

  it('un `type="number"` NUNCA entrega una coma: la saneas el navegador, no nosotros', () => {
    // Documenta por qué el `replace(',', '.')` del módulo no se ejecuta con este
    // campo: la especificación de HTML sanea el valor de un input numérico a la forma
    // estándar o a cadena vacía, así que un «1500,5» asignado se convierte en ''. El
    // `replace` se conserva por lo MISMO que lo conserva `app/main.js#numeroTecleado`
    // («un `type="number"` no la entrega, pero un campo de texto sí podría»), y este
    // test es la constancia de que hoy la defensa no hace falta y de por qué.
    const { cajon, raiz } = conCajon()
    const campo = nodo(raiz, SELECTOR.REGISTRAL)
    campo.value = '1500,5'
    expect(campo.value).toBe('')
    expect(cajon.registral()).toBeNull()
  })

  it('`registral()` es `null` con basura, no NaN', () => {
    const { cajon, raiz } = conCajon()
    nodo(raiz, SELECTOR.REGISTRAL).value = 'hola'
    expect(cajon.registral()).toBeNull()
  })

  it('`clase()` es `null` mientras nadie elige', () => {
    const { cajon } = conCajon()
    expect(cajon.clase()).toBeNull()
  })

  it('pintar una clase DEDUCIDA no la mete en el `<select>`: no se lava una propuesta', () => {
    // `COMPLETO()` trae `margen.deducida: true`. Si `pintar` volcara esa clase en el
    // desplegable, la vuelta siguiente `clase()` la devolvería como si alguien la
    // hubiera marcado, `diagnosticar` la recibiría por `clase` en vez de por
    // `refcat` y el rótulo «Clase propuesta por la aplicación» desaparecería solo:
    // la propuesta se quedaría en el expediente sin que nadie la aceptara.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())

    expect(nodo(raiz, SELECTOR.CLASE_PARCELA).value).toBe('')
    expect(cajon.clase()).toBeNull()
    // Y la propuesta SÍ se dice, con todas las letras, donde toca.
    expect(nodo(raiz, SELECTOR.MARGEN).textContent).toContain('propuesta por la aplicación')
  })

  it('pintar tampoco borra la clase que SÍ eligió una persona', () => {
    const { cajon, raiz } = conCajon()
    nodo(raiz, SELECTOR.CLASE_PARCELA).value = 'RUSTICA'

    cajon.pintar(COMPLETO())
    expect(cajon.clase()).toBe('RUSTICA')

    // Ni siquiera cuando el margen viene a `null` (que es lo que pasa mientras nadie
    // ha elegido y no hay referencia de la que deducir).
    cajon.pintar(SIN_OFICIAL())
    expect(cajon.clase()).toBe('RUSTICA')
  })

  it('`reiniciarExpediente()` vacía los DOS campos y NO avisa a `alCambiar`', () => {
    const { cajon, raiz } = conCajon()
    nodo(raiz, SELECTOR.REGISTRAL).value = '1500'
    nodo(raiz, SELECTOR.CLASE_PARCELA).value = 'URBANA'
    const fn = vi.fn()
    cajon.alCambiar(fn)

    cajon.reiniciarExpediente()

    expect(cajon.registral()).toBeNull()
    expect(cajon.clase()).toBeNull()
    // No lo ha cambiado el usuario: avisar provocaría un recálculo redundante justo
    // antes del que va a hacer quien ha llamado a esto.
    expect(fn).not.toHaveBeenCalled()
  })

  it('`reiniciarExpediente()` es inerte tras destruir', () => {
    const { cajon } = conCajon()
    cajon.destruir()
    expect(() => cajon.reiniciarExpediente()).not.toThrow()
  })

  it('`alCambiar` avisa al teclear la registral y al elegir clase, y devuelve la BAJA', () => {
    const { cajon, raiz } = conCajon()
    const fn = vi.fn()
    const baja = cajon.alCambiar(fn)

    nodo(raiz, SELECTOR.REGISTRAL).dispatchEvent(new Event('change', { bubbles: true }))
    expect(fn).toHaveBeenCalledTimes(1)
    nodo(raiz, SELECTOR.CLASE_PARCELA).dispatchEvent(new Event('change', { bubbles: true }))
    expect(fn).toHaveBeenCalledTimes(2)

    baja()
    nodo(raiz, SELECTOR.CLASE_PARCELA).dispatchEvent(new Event('change', { bubbles: true }))
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('admite VARIOS oyentes: un `= fn` desengancharía al primero en silencio', () => {
    const { cajon, raiz } = conCajon()
    const a = vi.fn()
    const b = vi.fn()
    cajon.alCambiar(a)
    cajon.alCambiar(b)
    nodo(raiz, SELECTOR.CLASE_PARCELA).dispatchEvent(new Event('change', { bubbles: true }))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('`alCambiar`/`alCerrar` LANZAN si no reciben una función', () => {
    const { cajon } = conCajon()
    expect(() => cajon.alCambiar('no')).toThrow(TypeError)
    expect(() => cajon.alCerrar(null)).toThrow(TypeError)
  })

  it('`pintar` NO pisa la registral que el usuario está escribiendo', () => {
    // Pisar lo que alguien teclea es la forma más rápida de que no vuelva a usarse un
    // formulario.
    const { cajon, raiz } = conCajon()
    const campo = nodo(raiz, SELECTOR.REGISTRAL)
    campo.value = '1234'
    cajon.pintar(COMPLETO()) // trae registral: 1500
    expect(campo.value).toBe('1234')
  })

  it('…pero rellena el campo vacío si el diagnóstico trae el dato', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    expect(nodo(raiz, SELECTOR.REGISTRAL).value).toBe('1500')
  })
})

describe('viewer/cajon-diagnostico.js · `pintar(null)` y desmontaje', () => {
  it('`pintar(null)` deja el cajón en blanco sin cerrarlo', () => {
    const { cajon, raiz } = conCajon()
    cajon.abrir()
    cajon.pintar(COMPLETO())
    cajon.pintar(null)

    expect(cajon.abierto()).toBe(true)
    expect(nodo(raiz, SELECTOR.TITULAR).textContent).toBe('Sin diagnóstico.')
    expect(nodo(raiz, SELECTOR.MEDIDA).textContent).toBe('No consta')
    expect(nodo(raiz, SELECTOR.CRUCES).children).toHaveLength(0)
  })

  it('`destruir()` quita el control, retira los oyentes del documento y es idempotente', () => {
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    const cajon = crearCajonDiagnostico({ mapa })
    const raiz = cajon.control.getContainer()
    cajon.abrir()

    cajon.destruir()
    expect(raiz.parentNode).toBeNull()
    expect(cajon.abierto()).toBe(false)
    expect(() => cajon.destruir()).not.toThrow()

    // Y los oyentes del documento se han ido: un Escape ya no hace nada.
    expect(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    ).not.toThrow()
    destruir()
  })

  it('después de `destruir()`, la API queda inerte y no revienta', () => {
    const { cajon } = conCajon()
    cajon.destruir()
    expect(() => cajon.pintar(COMPLETO())).not.toThrow()
    expect(() => cajon.abrir()).not.toThrow()
    expect(() => cajon.estado('x')).not.toThrow()
    expect(cajon.registral()).toBeNull()
    expect(cajon.clase()).toBeNull()
    expect(cajon.abierto()).toBe(false)
  })

  it('las clases CSS del cajón están exportadas y aplicadas', () => {
    // `estilos/app.css` (T4.2) se escribe contra estas clases: son contrato.
    const { raiz, cajon } = conCajon()
    cajon.pintar(COMPLETO())
    expect(raiz.classList.contains(CLASE.CONTENEDOR)).toBe(true)

    // TODAS, no dos de muestra. `CLASE` llegó a exportar una `OMISION` que no
    // llevaba ningún nodo: un gancho de CSS que no engancha nada, y que invita a
    // escribir la regla y a creer que se aplica. Esta comprobación es lo que lo
    // encontró, y lo que impide que vuelva a pasar.
    for (const nombre of Object.values(CLASE)) {
      if (nombre === CLASE.CONTENEDOR) continue
      expect(raiz.querySelector(`.${nombre}`), `nadie lleva la clase .${nombre}`).not.toBeNull()
    }
  })

  it('es un `L.Control` de verdad, no un div suelto sobre el mapa', () => {
    const { cajon } = conCajon()
    expect(cajon.control).toBeInstanceOf(L.Control)
  })
})

/* ────────────────────────────────────────────────────────────────────────── *
 * EL PIE DEL INFORME (F08 · T4.2, reescrito el 2026-08-15)                    *
 *                                                                            *
 * ⛔ **ESTE BLOQUE VIGILABA DOS BOTONES Y HOY VIGILA UNO.** «Descargar        *
 * informe de contraste» —el `.txt`— se retiró por encargo del autor: «solo    *
 * necesito el pdf». Con él se fueron sus once pruebas, y las que quedan son   *
 * las que NO eran suyas sino del PIE: el renglón que habla, su enlace con el  *
 * botón, y la lección M8 sobre los `data-*`.                                  *
 *                                                                            *
 * Lo que se conserva a propósito es la GUARDA DE LA RETIRADA (la primera de   *
 * abajo): que el botón no vuelva por accidente, y que si alguien lo repone lo *
 * haga a sabiendas. Sin ella, media docena de pruebas de este fichero pasarían*
 * igual con un botón de más en el pie.                                        *
 *                                                                            *
 * Lo que este bloque sigue vigilando, y por orden:                            *
 *                                                                            *
 *   · Que el botón NUNCA esté gris y mudo (regla de oro 1).                   *
 *   · Que su `data-estado` no pueda colisionar con nada (lección M8 de F07).  *
 *   · Que el cajón AVISE y no componga: componer y entregar son del cable.    *
 * ────────────────────────────────────────────────────────────────────────── */

describe('viewer/cajon-diagnostico.js · el pie del informe', () => {
  it('⛔ EL PIE TIENE UN SOLO BOTÓN: el informe en texto se retiró el 2026-08-15', () => {
    // La guarda de la retirada. Un botón que vuelve «sin querer» —al resolver un
    // conflicto, al revertir un commit— no lo caza ninguna otra prueba de este
    // fichero: todas preguntan por lo que SÍ tiene que estar.
    const { raiz } = conCajon()
    const acciones = [...raiz.querySelectorAll('footer [data-accion]')].map(
      (el) => el.dataset.accion,
    )
    expect(acciones).toEqual(['preparar-informe'])
    expect(raiz.querySelector('[data-accion="descargar-informe"]')).toBeNull()
    expect(raiz.textContent).not.toContain('Descargar informe de contraste')
  })

  it('…y el canal `alDescargar` se fue con él: no queda una API muerta', () => {
    // Un método que sigue en la API sin nodo que lo dispare es peor que ninguno:
    // el siguiente que lo vea creerá que hay un botón en alguna parte.
    const { cajon } = conCajon()
    expect(cajon.alDescargar).toBeUndefined()
  })

  it('el botón NACE apagado Y con el motivo escrito: nunca gris y mudo', () => {
    // Un botón apagado sin su porqué a la vista no se distingue de uno roto. El
    // motivo se escribe al NACER, no al primer repintado: el cajón se puede abrir
    // sin que nadie haya llamado a `pintar`, y ese es justo el instante en que el
    // botón está gris.
    const { raiz } = conCajon()
    const boton = nodo(raiz, SELECTOR.PREPARAR)
    expect(boton).not.toBeNull()
    expect(boton.tagName).toBe('BUTTON')
    expect(boton.type).toBe('button')
    expect(boton.disabled).toBe(true)
    expect(nodo(raiz, SELECTOR.ESTADO_INFORME).textContent).toBe(MOTIVO_INFORME_SIN_DIAGNOSTICO)
  })

  it('el renglón del informe es `role="status"` y está ENLAZADO al botón', () => {
    // `aria-describedby`: quien oiga el botón oye también por qué está apagado, sin
    // tener que ir a buscarlo. Y `role="status"` lo anuncia sin robar el foco.
    const { raiz } = conCajon()
    const boton = nodo(raiz, SELECTOR.PREPARAR)
    const renglon = nodo(raiz, SELECTOR.ESTADO_INFORME)
    expect(renglon.getAttribute('role')).toBe('status')
    expect(renglon.id).not.toBe('')
    expect(boton.getAttribute('aria-describedby')).toBe(renglon.id)
  })

  it('⚠️ M8 · el `data-estado` del informe NO colisiona con ningún otro del cajón', () => {
    // La lección M8 de F07, aplicada por segunda vez: `[data-estado="diagnostico"]`
    // iba a chocar con el `[data-estado="diagnosticar"]` del pie de la app, y
    // `querySelector` se queda con el PRIMERO del documento — el renglón habría
    // quedado mudo y SIN SÍNTOMA. Por eso el del informe se llama por el COMPONENTE
    // (`informe-contraste`) y no por la acción (`preparar-informe`).
    const { raiz } = conCajon()
    const valores = [...raiz.querySelectorAll('[data-estado]')].map((el) => el.dataset.estado)
    // Exactamente dos renglones, y los dos con nombre propio.
    expect(valores.sort()).toEqual(['cajon-diagnostico', 'informe-contraste'])
    expect(new Set(valores).size).toBe(valores.length)
    // Y el valor del estado NO es el de ninguna acción del cajón: son dos espacios
    // de nombres distintos y cruzarlos es exactamente lo que costó M8.
    const acciones = [...raiz.querySelectorAll('[data-accion]')].map((el) => el.dataset.accion)
    // La lista es EXHAUSTIVA a propósito: una acción nueva en el cajón tiene que
    // pasar por aquí y por la comprobación de colisión de abajo. Fueron CUATRO
    // hasta el 2026-08-07 (`tomar-geometria`, la puerta de D4) y TRES hasta el
    // 2026-08-15 (`descargar-informe`, el `.txt`).
    expect(acciones.sort()).toEqual(['cerrar-diagnostico', 'preparar-informe'])
    for (const valor of valores) expect(acciones).not.toContain(valor)
  })

  it('⭐ T9 · la procedencia no choca con nada del resto de la aplicación', () => {
    // El contrato K.1 (ningún par atributo/valor repetido en el documento montado)
    // lo vigila `test/app/main-edificio.dom.test.js` sobre la app entera. Aquí se
    // afirma la mitad que es de ESTE módulo: los dos valores que estrena T9 son los
    // que se declararon, y son únicos dentro del cajón.
    const { raiz } = conCajon()
    const procedencias = [...raiz.querySelectorAll('[data-procedencia]')].map(
      (el) => el.dataset.procedencia,
    )
    // `contraste`, y NUNCA `parcela`: ese valor ya lo usa el renglón de la vía del
    // Catastro en `index.html`, y `querySelector` se queda con el primero del
    // documento — el de aquí quedaría mudo y sin síntoma. Es M8 otra vez.
    expect(procedencias).toEqual(['contraste'])
    expect(nodo(raiz, SELECTOR.PROCEDENCIA)).not.toBeNull()
    // ⛔ Aquí se afirmaba también `SELECTOR.PUERTA` (`[data-accion="tomar-geometria"]`).
    // El botón se retiró el 2026-08-07 con el modo COMPROBACIÓN entero.
    expect(raiz.querySelector('[data-accion="tomar-geometria"]')).toBeNull()
  })

  it('los selectores exportados apuntan a UN nodo cada uno', () => {
    const { raiz } = conCajon()
    expect(raiz.querySelectorAll(SELECTOR.PREPARAR)).toHaveLength(1)
    expect(raiz.querySelectorAll(SELECTOR.ESTADO_INFORME)).toHaveLength(1)
  })

  it('`SELECTOR` ya no exporta `DESCARGAR`: un selector sin nodo devuelve null callando', () => {
    expect(SELECTOR.DESCARGAR).toBeUndefined()
  })

  it('repintar NO pisa el desenlace que escribió el cableado (solo borra el motivo)', () => {
    // `pintar` corre en CADA operación acabada. Vaciar el renglón sin condición se
    // llevaría por delante el acuse de recibo que el cableado acaba de escribir, un
    // instante después de ponerlo. Es la misma regla que
    // `app/cableado-diagnostico.js#refrescarBoton` defiende para el renglón del CTA.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    cajon.estadoInforme('Informe preparado.')

    cajon.pintar(COMPLETO())

    expect(nodo(raiz, SELECTOR.ESTADO_INFORME).textContent).toBe('Informe preparado.')
  })

  it('`estadoInforme` y el renglón de arriba son DOS nodos distintos', () => {
    // Aquel cuenta lo que le pasa a lo que se está enseñando (las vecinas que no
    // llegaron); este, el desenlace de pulsar el botón. Escribir en uno no puede
    // borrar el otro.
    const { cajon, raiz } = conCajon()
    cajon.estado('Invasión a colindantes: no se ha podido consultar.')
    cajon.estadoInforme('Informe preparado.')

    expect(nodo(raiz, SELECTOR.ESTADO).textContent).toBe(
      'Invasión a colindantes: no se ha podido consultar.',
    )
    expect(nodo(raiz, SELECTOR.ESTADO_INFORME).textContent).toBe('Informe preparado.')
    expect(nodo(raiz, SELECTOR.ESTADO)).not.toBe(nodo(raiz, SELECTOR.ESTADO_INFORME))
  })

  it('el botón NO es un `input` ni un `select`: el cajón sigue con DOS mandos', () => {
    // El test de aceptación de F07 afirma que los únicos controles del cajón son los
    // dos datos del expediente («ni umbral configurable, ni siquiera uno que elija el
    // usuario»). Un tercer control numérico sería el umbral entrando por la puerta de
    // atrás; un `<button>` no lo es, y esto lo deja escrito.
    const { raiz } = conCajon()
    const controles = [...raiz.querySelectorAll('input, select')]
    expect(controles.map((el) => el.dataset.campo).sort()).toEqual([
      'clase-parcela',
      'superficie-registral',
    ])
  })
})

/* ────────────────────────────────────────────────────────────────────────── *
 * F09 · T4.2 · «PREPARAR INFORME (PDF)», EL BOTÓN DEL PIE                     *
 *                                                                            *
 * El botón del documento FIRMABLE de F09. Desde el 2026-08-15 es el ÚNICO del *
 * pie —el de texto se retiró—, así que este bloque dejó de vigilar la         *
 * jerarquía entre dos y vigila lo que puede romperse en uno solo:             *
 *                                                                            *
 *   · Que NUNCA esté gris y mudo (regla de oro 1), ni al nacer ni al          *
 *     apagarse: un botón apagado sin su porqué no se distingue de uno roto.   *
 *   · Que la VESTIMENTA viaje con el `disabled`. Un botón que parece pulsable *
 *     y no lo es tampoco se distingue de uno roto.                            *
 *   · Que el cajón AVISE y no componga nada: sigue siendo una vista.          *
 * ────────────────────────────────────────────────────────────────────────── */

describe('viewer/cajon-diagnostico.js · «Preparar informe (PDF)» (F09)', () => {
  it('el botón NACE apagado Y con el motivo escrito: nunca gris y mudo', () => {
    const { raiz } = conCajon()
    const boton = nodo(raiz, SELECTOR.PREPARAR)
    expect(boton).not.toBeNull()
    expect(boton.tagName).toBe('BUTTON')
    expect(boton.type).toBe('button')
    expect(boton.textContent).toBe('Preparar informe (PDF)')
    expect(boton.disabled).toBe(true)
    // El motivo se escribe al NACER, no al primer repintado: el cajón se puede abrir
    // sin que nadie haya llamado a `pintar`, y ese es el instante en que está gris.
    expect(nodo(raiz, SELECTOR.ESTADO_INFORME).textContent).toBe(MOTIVO_INFORME_SIN_DIAGNOSTICO)
    // Y el motivo lo NOMBRA: quien lo oiga por `aria-describedby` tiene que saber de
    // qué botón le hablan. Nombraba a los DOS hasta el 2026-08-15.
    expect(MOTIVO_INFORME_SIN_DIAGNOSTICO).toContain('Preparar informe (PDF)')
    expect(MOTIVO_INFORME_SIN_DIAGNOSTICO).not.toContain('Descargar informe de contraste')
  })

  it('`pintar(d)` lo ENCIENDE y borra el motivo', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    expect(nodo(raiz, SELECTOR.PREPARAR).disabled).toBe(false)
    expect(nodo(raiz, SELECTOR.ESTADO_INFORME).textContent).toBe('')
  })

  it('se enciende también con el diagnóstico a medias: hay medidas que maquetar', () => {
    // Sin geometría oficial faltan cuatro secciones, pero la medición, el perímetro y
    // la relación de vértices están. El PDF lleva ADEMÁS plano y pie de firma, y eso
    // no cambia la condición: lo que se exige es que haya medidas.
    const { cajon, raiz } = conCajon()
    cajon.pintar(SIN_OFICIAL())
    expect(nodo(raiz, SELECTOR.PREPARAR).disabled).toBe(false)
  })

  it('`pintar(null)` lo vuelve a APAGAR y reescribe el motivo', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    cajon.estadoInforme('Informe preparado.')

    cajon.pintar(null)

    expect(nodo(raiz, SELECTOR.PREPARAR).disabled).toBe(true)
    // Al apagar SÍ se pisa el desenlace anterior: habla de un diagnóstico que ya no
    // está, y dejarlo junto a un botón gris haría creer que basta con volver a
    // pulsar.
    expect(nodo(raiz, SELECTOR.ESTADO_INFORME).textContent).toBe(MOTIVO_INFORME_SIN_DIAGNOSTICO)
  })

  it('la VESTIMENTA viaja con el `disabled`, y el apagado nunca va en rojo', () => {
    // Un botón que parece pulsable y no lo es no se distingue de uno roto. El apagado
    // va en el GRIS del cromo: lo que se comunica es «no se puede pulsar ahora», no
    // «esto está mal» (regla de oro 9).
    const { cajon, raiz } = conCajon()
    const boton = nodo(raiz, SELECTOR.PREPARAR)

    expect(boton.style.cursor).toBe('default')

    cajon.pintar(COMPLETO())
    expect(boton.style.cursor).toBe('pointer')
    // El fondo oscuro del cromo, que es lo que lo hace la acción principal.
    expect(boton.style.background).not.toBe('')

    cajon.pintar(null)
    expect(boton.style.cursor).toBe('default')
    const PROHIBIDOS = /#(16a34a|22c55e|dc2626|ef4444|15803d|b91c1c)/i
    expect(boton.getAttribute('style') || '').not.toMatch(PROHIBIDOS)
  })

  it('⭐ ocupa el ANCHO del pie: una acción única no se queda a media columna', () => {
    // Con dos botones, el pie era una fila `flex` y cada uno medía lo que su texto.
    // Con uno solo eso deja 176 px de pie vacío a la derecha, y un botón corto
    // flotando a la izquierda de un hueco se lee como si faltara el otro. Se afirma
    // la ESTRUCTURA, no el ancho: en jsdom no hay maquetación que medir.
    const { raiz } = conCajon()
    const boton = nodo(raiz, SELECTOR.PREPARAR)
    expect(boton.style.width).toBe('100%')
    expect(boton.style.display).toBe('block')
    // Y cuelga DIRECTAMENTE del `<footer>`: la fila `flex` que repartía dos botones
    // se fue con el segundo.
    expect(boton.parentElement.tagName).toBe('FOOTER')
  })

  /* ⛔ **AQUÍ VIVÍA `describe('…la puerta se pega abajo…')`, CON SUS CUATRO
   * PRUEBAS, Y SE FUE CON EL BOTÓN EL 2026-08-07.**
   *
   * Vigilaban la estructura que mantenía «Tomar esta geometría y editarla» a la
   * vista: `sticky`, `bottom: 0`, `display: block` al enseñarla y fondo opaco. La
   * medición que las motivó (el botón nacía 314 px por debajo del pliegue a
   * 1280×720 y 267 a 1440×900) **no se pierde**: de ella salió el bloque anclado
   * que sigue vivo unas líneas más abajo, y que hoy sujeta el botón del informe y
   * el renglón de estado.
   *
   * Y la lección de método tampoco: aquellas cuatro pruebas pasaban en verde
   * mientras el botón era inalcanzable en producción, porque jsdom no maqueta y
   * porque este módulo no sabe en qué paso del rail se le pinta.
   */

  it('`alPreparar` avisa al pulsar, admite VARIOS oyentes y devuelve la BAJA', () => {
    const { cajon, raiz } = conCajon()
    const a = vi.fn()
    const b = vi.fn()
    const baja = cajon.alPreparar(a)
    cajon.alPreparar(b)
    cajon.pintar(COMPLETO())

    nodo(raiz, SELECTOR.PREPARAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)

    baja()
    nodo(raiz, SELECTOR.PREPARAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
  })

  it('`alPreparar` LANZA si no recibe una función', () => {
    const { cajon } = conCajon()
    expect(() => cajon.alPreparar('no')).toThrow(TypeError)
  })

  it('pulsarlo NO cierra el cajón ni para la propagación', () => {
    // `disableClickPropagation` no detiene el `click`, y lo que salva al cajón es la
    // comprobación `contains` del guardián. Parar la propagación dejaría sordo al
    // panel de ayuda de la barra de edición, que también escucha en el documento.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    cajon.abrir()

    const evento = new MouseEvent('click', { bubbles: true, cancelable: true })
    const stop = vi.spyOn(evento, 'stopPropagation')
    nodo(raiz, SELECTOR.PREPARAR).dispatchEvent(evento)

    expect(cajon.abierto()).toBe(true)
    expect(stop).not.toHaveBeenCalled()
    expect(evento.defaultPrevented).toBe(false)
  })

  it('el cajón NO compone ni baja nada: solo avisa', () => {
    // Sigue siendo una VISTA. Maquetar el PDF es de `report/pdf-parcela.js` y pedir
    // el pie de firma, del diálogo; los llama el cableado. Si el cajón supiera de
    // Blobs, el visor dejaría de ser consumible como librería.
    const { cajon, raiz } = conCajon()
    const crear = vi.spyOn(URL, 'createObjectURL')
    cajon.pintar(COMPLETO())
    nodo(raiz, SELECTOR.PREPARAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(crear).not.toHaveBeenCalled()
    crear.mockRestore()
  })

  it('ni el rótulo ni el motivo llevan palabra de MÉRITO (regla de oro 9)', () => {
    const VEREDICTOS =
      /\b(apta|apto|válida|valida|válido|correcta|correcto|conforme|aprobad|suspend|admisible|aceptable|dentro de tolerancia|fuera de tolerancia|no válid)/i
    const { raiz } = conCajon()
    const boton = nodo(raiz, SELECTOR.PREPARAR)
    expect(boton.textContent).not.toMatch(VEREDICTOS)
    expect(MOTIVO_INFORME_SIN_DIAGNOSTICO).not.toMatch(VEREDICTOS)
  })

  it('`destruir()` lo desengancha y deja `estadoInforme` inerte', () => {
    const { cajon, raiz } = conCajon()
    const fn = vi.fn()
    cajon.alPreparar(fn)
    cajon.pintar(COMPLETO())
    const boton = nodo(raiz, SELECTOR.PREPARAR)

    cajon.destruir()

    // El nodo sigue existiendo (el control ya no está en el mapa, pero el elemento
    // es el mismo objeto) y pulsarlo no llama a nadie ni revienta.
    expect(() =>
      boton.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    ).not.toThrow()
    expect(fn).not.toHaveBeenCalled()
    expect(() => cajon.estadoInforme('x')).not.toThrow()
    expect(() => cajon.destruir()).not.toThrow()
  })
})

// ── La familia tipográfica la pone la HOJA, no el módulo ─────────────────────
//
// Gemelo del guardián de `test/viewer/cajon-comprobacion.dom.test.js`, y existe
// por el mismo defecto REAL medido en navegador el 2026-07-30 por
// `scripts/smoke-navegador/10-comprobar-gml.js`: «Descargar informe de contraste»
// salía en `system-ui` porque llevaba `font: 'inherit'` EN LÍNEA, y el inline gana
// a la hoja — la regla `.gml-cajon-diagnostico button` de `estilos/app.css` era
// código muerto. Aquel botón ya no existe (se retiró el 2026-08-15) y el guardián
// se queda: el que hereda el reparto es «Preparar informe (PDF)», que se rompería
// de la misma forma, en silencio y solo en navegador.

describe('viewer/cajon-diagnostico · el botón del informe no fija la tipografía en línea', () => {
  for (const [rotulo, accion] of [['Preparar informe (PDF)', 'preparar-informe']]) {
    it(`«${rotulo}» no lleva font-family en su atributo style`, () => {
      const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
      const cajon = crearCajonDiagnostico({ mapa })
      try {
        const raiz = mapa.getContainer().querySelector('.gml-cajon-diagnostico')
        const boton = raiz.querySelector(`[data-accion="${accion}"]`)
        expect(boton, 'el pie del cajón tiene que traer el botón del informe').toBeTruthy()
        expect(boton.textContent).toBe(rotulo)

        // Ver el porqué de mirar `fontFamily` y no el atajo `font` en el guardián
        // gemelo: jsdom serializa el atajo desde las propiedades sueltas.
        expect(
          boton.style.fontFamily,
          'el botón fija la familia en línea: la regla de estilos/app.css queda muerta',
        ).toBe('')
        // Lo que el módulo SÍ tiene que seguir poniendo, para que sea legible sin
        // hoja. Sin esto, el guardián se cumpliría borrándolo todo.
        expect(boton.style.fontSize, 'el botón ha perdido el tamaño en línea').toBe('inherit')
        expect(boton.style.fontWeight, 'el botón ha perdido el grosor en línea').toBe('600')
      } finally {
        cajon.destruir()
        destruir()
      }
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// Rework de UI · rebanada 4 · ¿ESTO ES UN CAJÓN O ES LA PANTALLA?
//
// ⛔ EL DEFECTO, MEDIDO EN CHROME EL 2026-08-05 a 1280×720:
//
//   · llegar a Diagnóstico por el peldaño del rail dejaba la pantalla VACÍA — el
//     cajón se abría y este mismo guardián de clic-fuera lo cerraba en el mismo
//     gesto, porque el clic del rail no es el evento de apertura;
//   · UN clic en el mapa cerraba el diagnóstico, y mirar el mapa es exactamente
//     lo que se hace en esa pantalla;
//   · una vez cerrado, el peldaño del rail NO lo devolvía (navegar al paso en el
//     que ya estás no publica nada), así que el rail seguía marcando
//     «Diagnóstico», el `<h1>` seguía diciendo «Diagnóstico de encaje» y no había
//     diagnóstico en ninguna parte.
//
// Aquí se prueba el INTERRUPTOR. Que el aplicador lo conmute donde toca es de
// `test/app/contraste.test.js`, y que en un navegador de verdad se note, del
// guion 14.
// ═══════════════════════════════════════════════════════════════════════════════
describe('viewer/cajon-diagnostico.js · `comoPantalla` (rebanada 4)', () => {
  it('nace en `false`: un visor montado a pelo es EXACTAMENTE el cajón de F07', () => {
    const { cajon } = conCajon()
    expect(cajon.comoPantalla()).toBe(false)
  })

  it('⛔ como PANTALLA, un clic fuera ya no lo cierra; como cajón, sí', () => {
    const { cajon } = conCajon()
    cajon.abrir()
    cajon.comoPantalla(true)

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cajon.abierto(), 'un clic en el mapa NO puede borrar la pantalla').toBe(true)

    // ANTI-VACUIDAD: el mismo gesto, con el interruptor al revés, SÍ cierra. Sin
    // esto la prueba pasaría igual aunque el clic no llegara a ningún guardián.
    cajon.comoPantalla(false)
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cajon.abierto(), 'siendo cajón tiene que seguir descartándose').toBe(false)
  })

  it('⛔ como PANTALLA, Escape tampoco lo cierra; como cajón, sí', () => {
    const { cajon } = conCajon()
    cajon.abrir()
    cajon.comoPantalla(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(cajon.abierto()).toBe(true)

    cajon.comoPantalla(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(cajon.abierto()).toBe(false)
  })

  it('⭐ como PANTALLA el cerrar NO cierra: avisa de que quieren salir', () => {
    const { cajon, raiz } = conCajon()
    const salidas = []
    const cierres = []
    cajon.alSalir(() => salidas.push('x'))
    cajon.alCerrar(() => cierres.push('x'))
    cajon.abrir()
    cajon.comoPantalla(true)

    nodo(raiz, SELECTOR.CERRAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(salidas).toHaveLength(1)
    expect(cajon.abierto(), 'la vista no se cierra sola: quien decide es la navegación').toBe(true)
    expect(cierres, 'y no dispara alCerrar, que significa otra cosa').toHaveLength(0)
  })

  it('…y como CAJÓN el cerrar cierra y no avisa de ninguna salida', () => {
    const { cajon, raiz } = conCajon()
    const salidas = []
    cajon.alSalir(() => salidas.push('x'))
    cajon.abrir()

    nodo(raiz, SELECTOR.CERRAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(cajon.abierto()).toBe(false)
    expect(salidas).toHaveLength(0)
  })

  it('⛔ como PANTALLA sube el tope de alto: 42,77 % del diagnóstico nacía escondido', () => {
    // Medido a 1280×720: contenido 650 px en un cajón de 374,39 → 278 px bajo el
    // pliegue, con «Preparar informe (PDF)» a 207,53 px por debajo del borde.
    const { cajon, raiz } = conCajon()
    expect(raiz.style.maxHeight).toBe(ALTO_COMO_CAJON)

    cajon.comoPantalla(true)
    expect(raiz.style.maxHeight).toBe(ALTO_COMO_PANTALLA)
    expect(ALTO_COMO_PANTALLA).not.toBe(ALTO_COMO_CAJON)

    cajon.comoPantalla(false)
    expect(raiz.style.maxHeight).toBe(ALTO_COMO_CAJON)
  })

  it('el rótulo del botón de cerrar deja de mentir a quien no ve la pantalla', () => {
    const { cajon, raiz } = conCajon()
    const cerrar = nodo(raiz, SELECTOR.CERRAR)
    expect(cerrar.getAttribute('aria-label')).toBe('Cerrar el diagnóstico')
    cajon.comoPantalla(true)
    expect(cerrar.getAttribute('aria-label')).toBe('Salir del diagnóstico')
    cajon.comoPantalla(false)
    expect(cerrar.getAttribute('aria-label')).toBe('Cerrar el diagnóstico')
  })

  it('sin argumento LEE, y con algo que no es booleano LANZA', () => {
    const { cajon } = conCajon()
    expect(cajon.comoPantalla()).toBe(false)
    expect(cajon.comoPantalla(true)).toBe(true)
    expect(cajon.comoPantalla()).toBe(true)
    expect(() => cajon.comoPantalla('si')).toThrow(TypeError)
    expect(() => cajon.comoPantalla(1)).toThrow(TypeError)
    // Y el valor no se ha movido por el intento fallido.
    expect(cajon.comoPantalla()).toBe(true)
  })

  it('alSalir devuelve su baja, y destruir limpia el canal', () => {
    const { cajon, raiz } = conCajon()
    const vistos = []
    const baja = cajon.alSalir(() => vistos.push('x'))
    cajon.abrir()
    cajon.comoPantalla(true)
    const cerrar = nodo(raiz, SELECTOR.CERRAR)

    cerrar.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(vistos).toHaveLength(1)

    baja()
    cerrar.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(vistos, 'la baja tiene que callar el canal').toHaveLength(1)

    expect(() => cajon.alSalir('no soy función')).toThrow(TypeError)
  })

  // ── ⛔ EL BLOQUE ANCLADO: lo que HABLA y lo que se PULSA no puede esconderse ──
  // Los tres nodos de esta prueba estaban medidos por debajo del borde visible del
  // cajón recién abierto: 207,53 px el primario del informe, 248,38 px el
  // secundario y 164,69 px el renglón de estado (role="status", o sea el canal por
  // el que este cajón cumple la regla de oro 1). jsdom no puede medir eso, así que
  // se afirma la ESTRUCTURA que lo impide.
  it('⭐ el botón del informe y los dos renglones van DENTRO del bloque anclado', () => {
    const { raiz } = conCajon()
    // ⚠️ El ancla se busca SUBIENDO desde el renglón de estado y no se supone.
    // Hasta el 2026-08-07 se buscaba desde la puerta de D4, que tenía su propio
    // guardián; retirada aquélla, el punto de partida es uno de los tres nodos que
    // este `it` existe para proteger.
    let ancla = null
    for (let el = nodo(raiz, SELECTOR.ESTADO); el !== null && el !== raiz; el = el.parentElement) {
      if (el.style.position === 'sticky') ancla = el
    }
    expect(ancla, 'no hay bloque anclado del que colgar lo accionable').not.toBe(null)
    // ⛔ **`bottom` es `-10px` desde el 2026-08-15, y NO `0px`.** Aquí se afirmaba
    // el `0px` y estaba mal: con `bottom: 0` el bloque se ancla a la caja de
    // RELLENO del contenedor que scrollea, no a su borde, y quedaba una rendija de
    // 10 px —el `padding-bottom`— por la que seguía pasando texto. Medido en Chrome
    // sobre una parcela urbana real: la última línea del margen de identidad
    // asomaba DEBAJO del botón, como si fuera su pie. Lo que hay que exigir es que
    // el ancla llegue al SUELO, no un literal concreto: se comprueba que compense
    // el relleno de abajo del contenedor, que es lo que de verdad importa.
    const rellenoAbajo = Number.parseFloat(raiz.style.paddingBottom) || 0
    expect(Number.parseFloat(ancla.style.bottom)).toBe(-rellenoAbajo)

    // Eran CUATRO nodos hasta el 2026-08-15 (entraba `SELECTOR.DESCARGAR`, el
    // botón del `.txt`). Lo que se ancla sigue siendo lo mismo: lo que HABLA y lo
    // que se PULSA.
    for (const sel of [SELECTOR.PREPARAR, SELECTOR.ESTADO, SELECTOR.ESTADO_INFORME]) {
      expect(ancla.contains(nodo(raiz, sel)), 'se queda fuera del bloque anclado: ' + sel).toBe(
        true,
      )
    }
    // Y el bloque lleva fondo opaco: un sticky transparente deja ver el texto que
    // scrollea por detrás, y lo vuelve ilegible justo cuando más falta hace.
    expect(ancla.style.background).not.toBe('')
    expect(ancla.style.background).not.toBe('transparent')
  })
})

/* -------------------------------------------------------------------------- *
 * `anfitrion`: el diagnóstico se muda a la COLUMNA IZQUIERDA (2026-08-05)      *
 *                                                                              *
 * Lo que se verifica aquí es lo que puede fallar EN SILENCIO al mudar un nodo   *
 * de sitio: que se mude de verdad, que vuelva, que se vista para cada sitio     *
 * (dos juegos de estilos con las MISMAS claves — el que una lista mencione y la *
 * otra no se queda pegado al cambiar), y sobre todo que **el nodo sea el        *
 * mismo**: duplicarlo daría dos `[data-campo="superficie-registral"]` en el     *
 * documento y `querySelector` se quedaría con el primero, dejando al otro mudo. *
 *                                                                              *
 * Lo que se ve de verdad —que quepa, que scrollee, que el pie no se salga— se   *
 * mide en un navegador: `scripts/smoke-navegador/09-diagnostico.js`.            *
 * -------------------------------------------------------------------------- */
describe('viewer/cajon-diagnostico.js · `anfitrion` (2026-08-05)', () => {
  /** Una sección del panel de mentira, hermana del mapa y no descendiente suya. */
  function conPanel() {
    const panel = document.createElement('section')
    document.body.append(panel)
    montados.push(() => panel.remove())
    return panel
  }

  it('nace en `null`: un visor montado a pelo sigue siendo el cajón de F07', () => {
    const { cajon, raiz } = conCajon()
    expect(cajon.anfitrion()).toBe(null)
    cajon.comoPantalla(true)
    // Sin anfitrión, ser la pantalla solo cambia el tope de alto (rebanada 4).
    expect(cajon.anfitrion()).toBe(null)
    expect(raiz.style.maxHeight).toBe(ALTO_COMO_PANTALLA)
    expect(raiz.parentElement.className, 'sigue en la esquina de Leaflet').toContain('leaflet')
  })

  it('⭐ como PANTALLA se cuelga del anfitrión, y al dejar de serlo VUELVE', () => {
    const { cajon, raiz } = conCajon()
    const esquina = raiz.parentElement
    const panel = conPanel()

    cajon.anfitrion(panel)
    expect(cajon.anfitrion()).toBe(panel)
    // Todavía no es la pantalla: tener anfitrión no basta, hacen falta las DOS.
    expect(raiz.parentElement, 'un anfitrión no muda nada por sí solo').toBe(esquina)

    cajon.comoPantalla(true)
    expect(raiz.parentElement).toBe(panel)

    cajon.comoPantalla(false)
    expect(raiz.parentElement, 'al dejar de ser la pantalla vuelve a su esquina').toBe(esquina)
  })

  it('…y da igual el orden: primero pantalla y después anfitrión llega al mismo sitio', () => {
    const { cajon, raiz } = conCajon()
    const panel = conPanel()
    cajon.comoPantalla(true)
    cajon.anfitrion(panel)
    expect(raiz.parentElement).toBe(panel)
  })

  it('`anfitrion(null)` lo devuelve a la esquina aunque siga siendo la pantalla', () => {
    const { cajon, raiz } = conCajon()
    const esquina = raiz.parentElement
    cajon.anfitrion(conPanel())
    cajon.comoPantalla(true)
    expect(cajon.anfitrion(null)).toBe(null)
    expect(raiz.parentElement).toBe(esquina)
    expect(raiz.style.maxHeight, 'y recupera el tope de la pantalla flotante').toBe(
      ALTO_COMO_PANTALLA,
    )
  })

  it('⛔ es EL MISMO nodo: no se duplica ningún `data-*` del contrato', () => {
    // Dos juegos de nodos con el mismo `data-*` es el fallo mudo que index.html
    // lleva documentando desde F06: `querySelector` se queda con el primero del
    // documento y el otro nace escribible, conectado y sin efecto.
    const { cajon, raiz } = conCajon()
    const registral = nodo(raiz, SELECTOR.REGISTRAL)
    registral.value = '1500'

    cajon.anfitrion(conPanel())
    cajon.comoPantalla(true)

    for (const sel of [SELECTOR.REGISTRAL, SELECTOR.PREPARAR, SELECTOR.TITULAR, SELECTOR.ESTADO]) {
      expect(document.querySelectorAll(sel), `«${sel}» está dos veces en el documento`).toHaveLength(
        1,
      )
    }
    // El nodo viaja con su estado y con sus oyentes puestos: `append` reengancha,
    // no reconstruye. Si se hubiera fabricado otro, el valor tecleado se perdería.
    expect(document.querySelector(SELECTOR.REGISTRAL)).toBe(registral)
    expect(cajon.registral()).toBe(1500)
  })

  it('⛔ en el panel deja de ser una ventana: ni sombra, ni radio, ni tope de alto', () => {
    const { cajon, raiz } = conCajon()
    cajon.anfitrion(conPanel())
    cajon.comoPantalla(true)

    expect(raiz.style.boxShadow, 'una sombra dentro del panel dibuja una tarjeta').toBe('none')
    expect(raiz.style.borderRadius).toBe('0px')
    // En el panel la altura se REPARTE (flex), no se declara contra la ventana.
    expect(raiz.style.maxHeight).toBe('none')
    expect(raiz.style.maxWidth).toBe('none')
    expect(raiz.style.flex).not.toBe('')
    expect(raiz.style.minHeight).toBe('0px')
  })

  it('⛔ y al volver a la esquina recupera EL JUEGO ENTERO, sin restos del panel', () => {
    // Es lo que se pierde si las dos listas de estilos dejan de tener las mismas
    // claves: lo que una pone y la otra no menciona se queda pegado. Un cajón
    // flotante sin sombra y sin `max-width` sobre una ortofoto es ilegible.
    const { cajon, raiz } = conCajon()
    cajon.anfitrion(conPanel())
    cajon.comoPantalla(true)
    cajon.comoPantalla(false)

    expect(raiz.style.boxShadow).not.toBe('none')
    expect(raiz.style.maxWidth).not.toBe('none')
    expect(raiz.style.maxHeight).toBe(ALTO_COMO_CAJON)
    // ⭐ Era '8px' hasta la revisión de diseño del 2026-08-10, que unificó el radio
    // de TODA la interfaz en 6 px (`--gml-radio` en `estilos/app.css`; el encargo
    // del autor decía «un solo valor, p. ej. 6px»). Lo que esta prueba vigila no es
    // la cifra sino que `comoPantalla(false)` devuelva el juego de estilos ENTERO,
    // así que se actualiza la cifra y el guardián sigue haciendo su trabajo.
    expect(raiz.style.borderRadius).toBe('6px')
    expect(raiz.style.flex, 'el reparto flex es del panel y ahí no aplica').toBe('')
    expect(raiz.style.minHeight).toBe('')
  })

  it('los dos juegos de estilos declaran LAS MISMAS claves', () => {
    // El guardián de lo de arriba, dicho una sola vez y sin pasar por el DOM: una
    // clave en un juego y no en el otro se queda pegada al mudar de sitio.
    expect(Object.keys(ESTILO_EN_EL_PANEL).sort()).toEqual(
      Object.keys(ESTILO_SOBRE_EL_MAPA).sort(),
    )
  })

  it('⛔ el relleno horizontal del panel es el MISMO que sobre el mapa (12 px)', () => {
    // No es aseo: el bloque anclado del pie se sale de ese relleno con
    // `margin: -12px` y `width: calc(100% + 24px)` para que su fondo llegue a los
    // bordes. Si el relleno del panel cambiara, el pie se saldría 12 px por cada
    // lado — y jsdom no lo vería, porque no maqueta. El de ABAJO también tiene que
    // sobrevivir, porque lo compensa `margin-bottom: -10px`.
    const { cajon, raiz } = conCajon()
    const sobreElMapa = raiz.style.padding
    cajon.anfitrion(conPanel())
    cajon.comoPantalla(true)
    const enElPanel = raiz.style.padding

    const lados = (p) => {
      const t = p.split(/\s+/)
      if (t.length === 2) return { lr: t[1], abajo: t[0] }
      if (t.length === 3) return { lr: t[1], abajo: t[2] }
      return { lr: t[1] ?? t[0], abajo: t[2] ?? t[0] }
    }
    expect(lados(enElPanel).lr, `«${enElPanel}» contra «${sobreElMapa}»`).toBe(
      lados(sobreElMapa).lr,
    )
    expect(lados(enElPanel).abajo).toBe(lados(sobreElMapa).abajo)
  })

  it('sin argumento LEE, y con algo que no es elemento ni `null` LANZA', () => {
    const { cajon } = conCajon()
    const panel = conPanel()
    expect(cajon.anfitrion()).toBe(null)
    expect(cajon.anfitrion(panel)).toBe(panel)
    for (const malo of ['#panel', 42, {}, true]) {
      expect(() => cajon.anfitrion(malo)).toThrow(TypeError)
    }
    // Y el anfitrión no se ha movido por los intentos fallidos.
    expect(cajon.anfitrion()).toBe(panel)
  })

  it('`destruir()` retira el contenedor esté donde esté, y no deja restos en el panel', () => {
    const { mapa, cajon, raiz } = conCajon()
    const panel = conPanel()
    cajon.anfitrion(panel)
    cajon.comoPantalla(true)
    expect(panel.children).toHaveLength(1)

    cajon.destruir()
    expect(raiz.isConnected, 'el contenedor se ha quedado colgando del panel').toBe(false)
    expect(panel.children).toHaveLength(0)
    // Y después de destruir, la API calla en vez de reventar (contrato de la casa).
    expect(cajon.anfitrion()).toBe(null)
    expect(cajon.anfitrion(panel)).toBe(null)
    expect(mapa).toBeTruthy()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// ⭐ LA JERARQUÍA TIPOGRÁFICA (revisión de diseño del 2026-08-10)
// ═════════════════════════════════════════════════════════════════════════════
// El cajón era «una columna indiferenciada»: seis bloques seguidos sin una pista
// de dónde acababa uno, y con la mitad de las filas SIN declarar tamaño —o sea
// heredando 12 px de Leaflet sobre el mapa y otro distinto dentro del panel—.
// Estos `it` vigilan las tres decisiones que lo arreglaron.
describe('viewer/cajon-diagnostico · la escala y los rótulos de grupo', () => {
  it('salen los DOS rótulos de grupo, en orden y como <h3>', () => {
    const { raiz } = conCajon()
    const rotulos = [...raiz.querySelectorAll(`.${CLASE.ROTULO}`)]
    expect(rotulos.map((r) => r.textContent)).toEqual(['Superficie', 'Encaje'])
    // `<h3>` y no `<p>`: cuelgan del `<h2>` de la cabecera, así que un lector de
    // pantalla puede saltar de grupo en grupo. En versalitas se verían igual.
    expect(rotulos.map((r) => r.tagName)).toEqual(['H3', 'H3'])
  })

  it('la invasión NO lleva rótulo de grupo, y es a propósito', () => {
    // Esa sección se anuncia con TRES textos distintos («…: no se ha
    // consultado», «…: ninguna», y el título a secas), y esa diferencia es media
    // razón de ser de F07. Un rótulo fijo encima las aplanaría en una.
    const { raiz, cajon } = conCajon()
    cajon.pintar(COMPLETO())
    expect(nodo(raiz, SELECTOR.INVASION).querySelector(`.${CLASE.ROTULO}`)).toBe(null)
    const dicenInvasion = [...raiz.querySelectorAll(`.${CLASE.ROTULO}`)].filter((r) =>
      /invasi/i.test(r.textContent),
    )
    expect(dicenInvasion, 'ningún rótulo de grupo debe nombrar la invasión').toEqual([])
  })

  it('la superficie medida se destaca SOLO cuando hay cifra que destacar', () => {
    // «No consta» a 30 px grita una ausencia: un cajón sin nada que decir no debe
    // decirlo más alto que uno que sí.
    const { raiz, cajon } = conCajon()
    const medida = nodo(raiz, SELECTOR.MEDIDA)

    cajon.pintar(COMPLETO())
    expect(medida.style.fontSize).toBe(ESCALA.DATO_XL)
    expect(medida.textContent).toBe(m2(1538.99))

    cajon.pintar(null)
    expect(medida.style.fontSize).toBe(ESCALA.DATO)
  })

  it('las etiquetas y las cifras NO miden lo mismo: el salto es real', () => {
    // Es el hallazgo que originó todo esto: 92 de las 105 declaraciones de tamaño
    // de la aplicación valían 10, 11 o 12 px, así que el dato y su nombre se leían
    // igual de fuerte. Aquí se afirma el salto, no los números concretos.
    const { raiz, cajon } = conCajon()
    cajon.pintar(COMPLETO())
    const px = (v) => Number.parseFloat(v)
    expect(px(ESCALA.DATO)).toBeGreaterThan(px(ESCALA.CUERPO))
    expect(px(ESCALA.DATO_XL)).toBeGreaterThan(px(ESCALA.DATO))
    expect(px(ESCALA.CUERPO)).toBeGreaterThan(px(ESCALA.APUNTE))
    expect(px(ESCALA.APUNTE)).toBeGreaterThan(px(ESCALA.ROTULO))
    // Y el salto se ve en el DOM, no solo en la constante.
    expect(nodo(raiz, SELECTOR.SOLAPE).style.fontSize).toBe(ESCALA.DATO)
  })

  it('ningún tamaño se escribe a mano fuera de ESCALA', () => {
    // El guardián anti-deriva: mientras este módulo vista EN LÍNEA, la hoja no
    // gobierna nada de lo que se lee aquí, así que el único sitio donde puede
    // vivir la escala es la constante. Un `fontSize: '11px'` de conveniencia en
    // el siguiente cambio no rompería ninguna otra prueba.
    const { raiz, cajon } = conCajon()
    cajon.pintar(COMPLETO())

    // DOS excepciones autorizadas, y ninguna es una decisión de tamaño:
    //   · `14px` — el glifo ✕ de cerrar. No es texto: es un icono dibujado con una
    //     fuente, y lo manda su caja de 1 em, no la jerarquía de lectura.
    //   · `inherit` — los dos botones del informe. Un control de formulario trae
    //     la fuente que le da el navegador (en Windows, otra familia y otro
    //     tamaño); `inherit` lo devuelve a la del cajón. Declara que NO decide.
    const permitidos = new Set([...Object.values(ESCALA), '14px', 'inherit'])
    const intrusos = [raiz, ...raiz.querySelectorAll('*')]
      .filter((el) => el.style.fontSize !== '')
      .map((el) => el.style.fontSize)
      .filter((tam) => !permitidos.has(tam))

    expect(intrusos, `tamaños fuera de ESCALA: ${intrusos.join(', ')}`).toEqual([])
  })
})

/* -------------------------------------------------------------------------- *
 * LA REESTRUCTURACIÓN DEL PANEL (2026-08-15)                                  *
 *                                                                            *
 * Encargo del autor sobre la pantalla de Diagnóstico: «es horrible, está mal   *
 * estructurada, los datos no son legibles». Lo que se corrigió, y lo que este  *
 * bloque impide que vuelva:                                                   *
 *                                                                            *
 *   1. **Las cifras se partían.** «146,87 m² · 90,31 % de la mayor» iba en UN  *
 *      nodo, dentro de una rejilla `auto 1fr` que le daba a la etiqueta todo   *
 *      el ancho que pidiera. En el panel de 344 px, «Solape» se leía en cuatro *
 *      líneas y la cifra quedaba enterrada en un párrafo roto.                 *
 *   2. **Los motivos de omisión se vestían de cifra**: prosa de 15 px          *
 *      alineada a la derecha en una columna estrecha.                          *
 *   3. **El margen era un muro**: las cifras del margen y el criterio de la     *
 *      clase propuesta —tres líneas en una referencia urbana real—             *
 *      concatenados en un solo párrafo gris.                                   *
 *   4. **La columna no tenía juntas**: seis bloques seguidos sin un filete.     *
 *                                                                            *
 * ⚠️ En jsdom no hay maquetación: no se mide cuántas líneas ocupa nada. Lo que *
 * se afirma es la ESTRUCTURA que lo garantiza —dos pisos, dos párrafos, la     *
 * plantilla de la rejilla, los filetes—, que es lo que puede revertirse sin    *
 * que nadie lo note. Lo que se ve de verdad se mide en un navegador:           *
 * `scripts/smoke-navegador/09-diagnostico.js`.                                 *
 * -------------------------------------------------------------------------- */

describe('viewer/cajon-diagnostico.js · la ficha se lee (2026-08-15)', () => {
  it('⭐ la cifra y su matiz son DOS nodos: «de la mayor» ya no parte el número', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())

    const solape = nodo(raiz, SELECTOR.SOLAPE)
    const [cifra, matiz] = solape.children
    expect(solape.children).toHaveLength(2)
    // La cifra manda una línea entera, ella sola.
    expect(cifra.textContent).toBe(m2(1535.87))
    // Y el matiz baja al segundo piso, en tamaño de apunte.
    expect(matiz.textContent).toBe('99,80 % de la mayor')
    expect(matiz.style.display).toBe('block')
    expect(matiz.style.fontSize).toBe(ESCALA.APUNTE)
    // El `·` era el separador de dos cosas en UNA línea. En dos líneas no separa
    // nada, así que se fue con la partición.
    expect(solape.textContent).not.toContain('·')
  })

  it('la desviación reparte igual: la cota arriba, el lindero debajo', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())

    const [cifra, matiz] = nodo(raiz, SELECTOR.DESVIACION).children
    expect(cifra.textContent).toBe('0,40 m')
    expect(matiz.textContent).toBe('lindero 1')
  })

  it('una métrica SIN matiz no deja un renglón en blanco de por medio', () => {
    // Un `<span>` de bloque vacío cuesta una línea por fila, y tres filas serían
    // tres renglones de nada en un panel que scrollea.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())

    const [, matiz] = nodo(raiz, SELECTOR.CENTROIDES).children
    expect(matiz.textContent).toBe('')
    expect(matiz.style.display).toBe('none')
  })

  it('⭐ un MOTIVO de omisión se viste de prosa, no de cifra', () => {
    // Prosa de 15 px justificada a la derecha en una columna estrecha es
    // exactamente lo que no se lee.
    const { cajon, raiz } = conCajon()
    cajon.pintar(SIN_OFICIAL())

    for (const sel of [SELECTOR.SOLAPE, SELECTOR.CENTROIDES, SELECTOR.DESVIACION]) {
      const celda = nodo(raiz, sel)
      expect(celda.style.textAlign, sel).toBe('left')
      expect(celda.style.fontSize, sel).toBe(ESCALA.CUERPO)
    }
  })

  it('…y volver a tener cifra la vuelve a vestir de cifra', () => {
    // El camino de vuelta es el que se olvida: sin él, una parcela que recupera su
    // contorno oficial se quedaría con las tres métricas en tamaño de prosa y
    // alineadas a la izquierda para siempre.
    const { cajon, raiz } = conCajon()
    cajon.pintar(SIN_OFICIAL())
    cajon.pintar(COMPLETO())

    const solape = nodo(raiz, SELECTOR.SOLAPE)
    expect(solape.style.textAlign).toBe('right')
    expect(solape.style.fontSize).toBe(ESCALA.DATO)
  })

  it('las cifras van a la DERECHA: seis números de anchos distintos se comparan mirando', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    for (const sel of [SELECTOR.MEDIDA, SELECTOR.CATASTRAL, SELECTOR.SOLAPE]) {
      expect(nodo(raiz, sel).style.textAlign, sel).toBe('right')
    }
  })

  it('⛔ la rejilla NO le da a la etiqueta el ancho que pida', () => {
    // Era `auto 1fr`: la etiqueta se quedaba con lo que quisiera —«Desviación
    // máxima de lindero» son 22 caracteres— y la cifra con lo que sobrara. La
    // inversión es la corrección: la que se parte es la PROSA.
    const { raiz } = conCajon()
    const rejillas = [...raiz.querySelectorAll('dl')]
    expect(rejillas.length).toBeGreaterThan(0)
    for (const dl of rejillas) {
      expect(dl.style.gridTemplateColumns).toBe('minmax(0,1fr) auto')
    }
  })

  it('⭐ el margen son DOS párrafos: las cifras y la clase propuesta no se pegan', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())

    const margen = nodo(raiz, SELECTOR.MARGEN)
    const [cifras, clase] = margen.children
    expect(margen.children).toHaveLength(2)
    expect(cifras.textContent).toContain(ETIQUETA)
    expect(cifras.textContent).not.toContain('propuesta por la aplicación')
    expect(clase.textContent).toContain('propuesta por la aplicación')
    expect(clase.style.display).toBe('block')
    // Y el nodo del contrato sigue siendo UNO y sigue diciéndolo todo: quien
    // pregunte por la etiqueta del margen la encuentra donde siempre.
    expect(margen.textContent).toContain(ETIQUETA)
  })

  it('si la clase la eligió una PERSONA, el segundo párrafo se esconde', () => {
    const { cajon, raiz } = conCajon()
    const d = COMPLETO()
    d.margen = { ...d.margen, deducida: false, criterio: null }
    cajon.pintar(d)

    const [, clase] = nodo(raiz, SELECTOR.MARGEN).children
    expect(clase.textContent).toBe('')
    expect(clase.style.display).toBe('none')
  })

  it('⛔ una propuesta que deja de serlo NO sobrevive al repintado', () => {
    // El renglón que se queda puesto de una vuelta a la siguiente diría que la
    // aplicación propone una clase que ya no propone. Es la misma familia de error
    // que el «lavado» del `<select>` que `pintarMargen` tiene prohibido.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    const d = COMPLETO()
    d.margen = { ...d.margen, deducida: false, criterio: null }
    cajon.pintar(d)

    expect(nodo(raiz, SELECTOR.MARGEN).textContent).not.toContain('propuesta')
  })

  it('la columna tiene JUNTAS: la invasión y el margen se separan con un filete', () => {
    // Sin ellas, seis bloques seguidos son «una columna indiferenciada» — el
    // diagnóstico de la revisión de diseño del 2026-08-10, que en las dos secciones
    // sin rótulo seguía sin corregirse. Van EN LÍNEA porque el cajón tiene que
    // separar sus secciones también sobre un mapa pelado.
    const { raiz } = conCajon()
    const invasion = nodo(raiz, SELECTOR.INVASION)
    expect(invasion.style.borderTop).not.toBe('')
    const bloqueMargen = nodo(raiz, SELECTOR.MARGEN).parentElement
    expect(bloqueMargen.style.borderTop).not.toBe('')
  })

  it('`pintar(null)` deja las celdas de dos pisos INTACTAS, no las vacía a lo bruto', () => {
    // Escribirles el `textContent` encima les arrancaría los dos `<span>` de dentro,
    // y al siguiente `pintar(d)` no habría dónde poner el matiz: el cajón se
    // quedaría mudo a mitad, sin un solo síntoma.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    cajon.pintar(null)

    const solape = nodo(raiz, SELECTOR.SOLAPE)
    expect(solape.children).toHaveLength(2)
    expect(solape.textContent).toBe('No consta')

    cajon.pintar(COMPLETO())
    expect(nodo(raiz, SELECTOR.SOLAPE).textContent).toContain('de la mayor')
  })

  it('`pintar(null)` también vacía los DOS párrafos del margen', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    cajon.pintar(null)

    const margen = nodo(raiz, SELECTOR.MARGEN)
    expect(margen.textContent).toBe('')
    expect(margen.children).toHaveLength(2)
  })

  it('la clase `.gml-cajon-apunte` está exportada y la llevan los matices', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    const apuntes = [...raiz.querySelectorAll(`.${CLASE.APUNTE}`)]
    // Los dos matices de encaje y el párrafo de la clase propuesta.
    expect(apuntes.length).toBeGreaterThanOrEqual(3)
  })
})
