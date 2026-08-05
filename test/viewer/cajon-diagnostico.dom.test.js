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
    expect(texto).toMatch(/milímetro/)
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
 * F08 · T4.2 · EL PIE DEL INFORME                                            *
 *                                                                            *
 * El botón «Descargar informe de contraste» vive DENTRO del cajón y no en el *
 * pie de la app — las tres razones están escritas en la cabecera del módulo. *
 * Lo que este bloque vigila es lo que puede fallar en silencio:              *
 *                                                                            *
 *   · Que NUNCA esté gris y mudo (regla de oro 1).                           *
 *   · Que su `data-estado` no pueda colisionar con nada (lección M8 de F07). *
 *   · Que el cajón AVISE y no descargue: componer y entregar son del cable.  *
 * ────────────────────────────────────────────────────────────────────────── */

describe('viewer/cajon-diagnostico.js · el pie del informe (F08)', () => {
  it('el botón NACE apagado Y con el motivo escrito: nunca gris y mudo', () => {
    // Un botón apagado sin su porqué a la vista no se distingue de uno roto. El
    // motivo se escribe al NACER, no al primer repintado: el cajón se puede abrir
    // sin que nadie haya llamado a `pintar`, y ese es justo el instante en que el
    // botón está gris.
    const { raiz } = conCajon()
    const boton = nodo(raiz, SELECTOR.DESCARGAR)
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
    const boton = nodo(raiz, SELECTOR.DESCARGAR)
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
    // (`informe-contraste`) y no por la acción (`descargar-informe`).
    const { raiz } = conCajon()
    const valores = [...raiz.querySelectorAll('[data-estado]')].map((el) => el.dataset.estado)
    // Exactamente dos renglones, y los dos con nombre propio.
    expect(valores.sort()).toEqual(['cajon-diagnostico', 'informe-contraste'])
    expect(new Set(valores).size).toBe(valores.length)
    // Y el valor del estado NO es el de ninguna acción del cajón: son dos espacios
    // de nombres distintos y cruzarlos es exactamente lo que costó M8.
    const acciones = [...raiz.querySelectorAll('[data-accion]')].map((el) => el.dataset.accion)
    // La lista es EXHAUSTIVA a propósito: una acción nueva en el cajón tiene que
    // pasar por aquí y por la comprobación de colisión de abajo. `tomar-geometria`
    // la trae el rework de UI · T9 —la puerta de D4— y entró justamente así.
    expect(acciones.sort()).toEqual([
      'cerrar-diagnostico',
      'descargar-informe',
      'preparar-informe',
      'tomar-geometria',
    ])
    for (const valor of valores) expect(acciones).not.toContain(valor)
  })

  it('⭐ T9 · la procedencia y la puerta no chocan con nada del resto de la aplicación', () => {
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
    expect(nodo(raiz, SELECTOR.PUERTA)).not.toBeNull()
  })

  it('los selectores exportados apuntan a UN nodo cada uno', () => {
    const { raiz } = conCajon()
    expect(raiz.querySelectorAll(SELECTOR.DESCARGAR)).toHaveLength(1)
    expect(raiz.querySelectorAll(SELECTOR.PREPARAR)).toHaveLength(1)
    expect(raiz.querySelectorAll(SELECTOR.ESTADO_INFORME)).toHaveLength(1)
  })

  it('`pintar(d)` lo ENCIENDE y borra el motivo', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    expect(nodo(raiz, SELECTOR.DESCARGAR).disabled).toBe(false)
    expect(nodo(raiz, SELECTOR.ESTADO_INFORME).textContent).toBe('')
  })

  it('se enciende también con el diagnóstico a medias: hay cifras que llevarse', () => {
    // Sin geometría oficial faltan cuatro secciones, pero la medición, el perímetro
    // y la relación de vértices están: negarle el informe a quien llegó con un DXF
    // sería apagar el botón por un motivo que no es el suyo.
    const { cajon, raiz } = conCajon()
    cajon.pintar(SIN_OFICIAL())
    expect(nodo(raiz, SELECTOR.DESCARGAR).disabled).toBe(false)
  })

  it('`pintar(null)` lo vuelve a APAGAR y reescribe el motivo', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    cajon.estadoInforme('Descargado «contraste_X_2026-07-30T10-00-00.txt».')

    cajon.pintar(null)

    expect(nodo(raiz, SELECTOR.DESCARGAR).disabled).toBe(true)
    // Al apagar SÍ se pisa el desenlace anterior: habla de un diagnóstico que ya no
    // está, y dejarlo junto a un botón gris haría creer que basta con volver a
    // pulsarlo.
    expect(nodo(raiz, SELECTOR.ESTADO_INFORME).textContent).toBe(MOTIVO_INFORME_SIN_DIAGNOSTICO)
  })

  it('repintar NO pisa el desenlace que escribió el cableado (solo borra el motivo)', () => {
    // `pintar` corre en CADA operación acabada —cada vértice que F06 mueva con el
    // cajón abierto—. Vaciar el renglón sin condición se llevaría por delante el
    // «Descargado «…».» un instante después de haberlo puesto. Es la misma regla que
    // `app/cableado-diagnostico.js#refrescarBoton` defiende para el renglón del CTA.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    cajon.estadoInforme('Descargado «contraste_X_2026-07-30T10-00-00.txt».')

    cajon.pintar(COMPLETO())

    expect(nodo(raiz, SELECTOR.ESTADO_INFORME).textContent).toBe(
      'Descargado «contraste_X_2026-07-30T10-00-00.txt».',
    )
  })

  it('`alDescargar` avisa al pulsar, admite VARIOS oyentes y devuelve la BAJA', () => {
    const { cajon, raiz } = conCajon()
    const a = vi.fn()
    const b = vi.fn()
    const baja = cajon.alDescargar(a)
    cajon.alDescargar(b)
    cajon.pintar(COMPLETO())

    nodo(raiz, SELECTOR.DESCARGAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)

    baja()
    nodo(raiz, SELECTOR.DESCARGAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
  })

  it('`alDescargar` LANZA si no recibe una función', () => {
    const { cajon } = conCajon()
    expect(() => cajon.alDescargar('no')).toThrow(TypeError)
  })

  it('el cajón NO descarga nada: solo avisa', () => {
    // Es una VISTA. Componer el texto es de `report/contraste-texto.js` y entregarlo
    // de `gml/descargar.js#descargarTexto`; a los dos los llama el cableado. Si el
    // cajón supiera de Blobs, el visor dejaría de ser consumible como librería.
    const { cajon, raiz } = conCajon()
    const crear = vi.spyOn(URL, 'createObjectURL')
    cajon.pintar(COMPLETO())
    nodo(raiz, SELECTOR.DESCARGAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(crear).not.toHaveBeenCalled()
    crear.mockRestore()
  })

  it('pulsar el botón NO cierra el cajón', () => {
    // `disableClickPropagation` no detiene el `click`, así que el clic llega al
    // `document`; lo que lo salva es la comprobación `contains` del guardián. Y a
    // propósito NO se para la propagación: eso dejaría sordo al panel de ayuda de la
    // barra de edición, que también escucha en el documento.
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    cajon.abrir()

    const evento = new MouseEvent('click', { bubbles: true, cancelable: true })
    const stop = vi.spyOn(evento, 'stopPropagation')
    nodo(raiz, SELECTOR.DESCARGAR).dispatchEvent(evento)

    expect(cajon.abierto()).toBe(true)
    expect(stop).not.toHaveBeenCalled()
    expect(evento.defaultPrevented).toBe(false)
  })

  it('`estadoInforme` y el renglón de arriba son DOS nodos distintos', () => {
    // Aquel cuenta lo que le pasa a lo que se está enseñando (las vecinas que no
    // llegaron); este, el desenlace de pulsar el botón. Escribir en uno no puede
    // borrar el otro.
    const { cajon, raiz } = conCajon()
    cajon.estado('Invasión a colindantes: no se ha podido consultar.')
    cajon.estadoInforme('Descargado «contraste_X.txt».')

    expect(nodo(raiz, SELECTOR.ESTADO).textContent).toBe(
      'Invasión a colindantes: no se ha podido consultar.',
    )
    expect(nodo(raiz, SELECTOR.ESTADO_INFORME).textContent).toBe('Descargado «contraste_X.txt».')
    expect(nodo(raiz, SELECTOR.ESTADO)).not.toBe(nodo(raiz, SELECTOR.ESTADO_INFORME))
  })

  it('el botón NO es un `input` ni un `select`: el cajón sigue con DOS mandos', () => {
    // El test de aceptación de F07 afirma que los únicos controles del cajón son los
    // dos datos del expediente («ni umbral configurable, ni siquiera uno que elija el
    // usuario»). Un tercer control numérico sería el umbral entrando por la puerta de
    // atrás; un `<button>` de descarga no lo es, y esto lo deja escrito.
    const { raiz } = conCajon()
    const controles = [...raiz.querySelectorAll('input, select')]
    expect(controles.map((el) => el.dataset.campo).sort()).toEqual([
      'clase-parcela',
      'superficie-registral',
    ])
  })

  it('ni el botón ni su motivo llevan palabra ni color de MÉRITO (regla de oro 9)', () => {
    const VEREDICTOS =
      /\b(apta|apto|válida|valida|válido|correcta|correcto|conforme|aprobad|suspend|admisible|aceptable|dentro de tolerancia|fuera de tolerancia|no válid)/i
    const { raiz } = conCajon()
    const boton = nodo(raiz, SELECTOR.DESCARGAR)
    expect(boton.textContent).toBe('Descargar informe de contraste')
    expect(boton.textContent).not.toMatch(VEREDICTOS)
    expect(MOTIVO_INFORME_SIN_DIAGNOSTICO).not.toMatch(VEREDICTOS)
    // El apagado va en el GRIS del cromo, nunca en rojo: lo que se comunica es «no
    // se puede pulsar ahora», no «esto está mal».
    const PROHIBIDOS = /#(16a34a|22c55e|dc2626|ef4444|15803d|b91c1c)/i
    expect(boton.getAttribute('style') || '').not.toMatch(PROHIBIDOS)
    expect(boton.style.background).not.toBe('')
  })

  it('`destruir()` desengancha el botón y deja `estadoInforme` inerte', () => {
    const { cajon, raiz } = conCajon()
    const fn = vi.fn()
    cajon.alDescargar(fn)
    cajon.pintar(COMPLETO())
    const boton = nodo(raiz, SELECTOR.DESCARGAR)

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

/* ────────────────────────────────────────────────────────────────────────── *
 * F09 · T4.2 · «PREPARAR INFORME (PDF)», EL PRIMARIO DEL PIE                 *
 *                                                                            *
 * El botón del documento FIRMABLE de F09. Comparte pie, gate y renglón con   *
 * el de texto, y esa es justo la parte que puede romperse en silencio:       *
 *                                                                            *
 *   · Que NUNCA esté gris y mudo (regla de oro 1), ni al nacer ni al         *
 *     apagarse: un botón apagado sin su porqué no se distingue de uno roto.  *
 *   · Que los DOS se enciendan y se apaguen a la vez. Un gate paralelo que   *
 *     se desincronizara dejaría un botón encendido componiendo un informe de *
 *     cifras que ya no están.                                                *
 *   · Que se vea que es el PRIMARIO: el orden y la vestimenta son lo único   *
 *     que dice cuál de los dos documentos es el entregable.                  *
 *   · Que el cajón AVISE y no componga nada: sigue siendo una vista.         *
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
    // Y el motivo lo NOMBRA, que es lo que hace que un renglón compartido sirva:
    // quien lo oiga por `aria-describedby` tiene que saber de qué botón le hablan.
    expect(MOTIVO_INFORME_SIN_DIAGNOSTICO).toContain('Preparar informe (PDF)')
    expect(MOTIVO_INFORME_SIN_DIAGNOSTICO).toContain('Descargar informe de contraste')
  })

  it('comparte el renglón con el de texto, y los dos lo tienen ENLAZADO', () => {
    // Un solo renglón porque es un solo hecho el que apaga a los dos. Dos renglones
    // diciendo lo mismo se desincronizan solos — y el segundo tendría además que ser
    // único en todo el documento (M8).
    const { raiz } = conCajon()
    const renglon = nodo(raiz, SELECTOR.ESTADO_INFORME)
    expect(renglon.id).not.toBe('')
    expect(nodo(raiz, SELECTOR.PREPARAR).getAttribute('aria-describedby')).toBe(renglon.id)
    expect(nodo(raiz, SELECTOR.DESCARGAR).getAttribute('aria-describedby')).toBe(renglon.id)
    expect(raiz.querySelectorAll('[data-estado="informe-contraste"]')).toHaveLength(1)
  })

  it('`pintar(d)` ENCIENDE los dos botones a la vez y borra el motivo', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    expect(nodo(raiz, SELECTOR.PREPARAR).disabled).toBe(false)
    expect(nodo(raiz, SELECTOR.DESCARGAR).disabled).toBe(false)
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

  it('`pintar(null)` APAGA los dos y reescribe el motivo', () => {
    const { cajon, raiz } = conCajon()
    cajon.pintar(COMPLETO())
    cajon.estadoInforme('Informe preparado.')

    cajon.pintar(null)

    expect(nodo(raiz, SELECTOR.PREPARAR).disabled).toBe(true)
    expect(nodo(raiz, SELECTOR.DESCARGAR).disabled).toBe(true)
    // Al apagar SÍ se pisa el desenlace anterior: habla de un diagnóstico que ya no
    // está, y dejarlo junto a dos botones grises haría creer que basta con volver a
    // pulsar.
    expect(nodo(raiz, SELECTOR.ESTADO_INFORME).textContent).toBe(MOTIVO_INFORME_SIN_DIAGNOSTICO)
  })

  it('la VESTIMENTA viaja con el `disabled`, y el primario se distingue del secundario', () => {
    // Un botón que parece pulsable y no lo es no se distingue de uno roto; y dos
    // fondos oscuros lado a lado no dirían cuál es el entregable. El apagado va en el
    // GRIS del cromo, nunca en rojo (regla de oro 9).
    const { cajon, raiz } = conCajon()
    const primario = nodo(raiz, SELECTOR.PREPARAR)
    const secundario = nodo(raiz, SELECTOR.DESCARGAR)

    expect(primario.style.cursor).toBe('default')
    expect(secundario.style.cursor).toBe('default')

    cajon.pintar(COMPLETO())
    expect(primario.style.cursor).toBe('pointer')
    expect(secundario.style.cursor).toBe('pointer')
    // El fondo oscuro del cromo es del primario, y solo suyo.
    expect(primario.style.background).not.toBe('')
    expect(primario.style.background).not.toBe(secundario.style.background)

    cajon.pintar(null)
    expect(primario.style.cursor).toBe('default')
    expect(secundario.style.cursor).toBe('default')
    const PROHIBIDOS = /#(16a34a|22c55e|dc2626|ef4444|15803d|b91c1c)/i
    expect(primario.getAttribute('style') || '').not.toMatch(PROHIBIDOS)
  })

  it('el primario va PRIMERO en el pie: el orden es lo que dice cuál es el entregable', () => {
    const { raiz } = conCajon()
    const acciones = [...raiz.querySelectorAll('footer [data-accion]')].map(
      (el) => el.dataset.accion,
    )
    // ⚠️ La PUERTA de T9 estuvo aquí un día y se sacó el 2026-08-04, medida en
    // Chrome: ver el bloque «la puerta se pega abajo» de más abajo. El pie vuelve a
    // ser lo que era, los dos entregables del informe.
    expect(acciones).toEqual(['preparar-informe', 'descargar-informe'])
  })

  // ── ⛔ La puerta se pega abajo, y esto no es estética ──────────────────────
  // El guion de humo del 2026-08-04 midió que la puerta, metida al final del
  // `<footer>`, NACÍA FUERA DE LA VISTA: el cajón enseña 372 px de 686 a 1280×720
  // (466 de 744 a 1440×900) y el botón caía 314 px (267 px) por debajo del borde
  // visible, con el scroll en 0 y sin nada que dijera que estaba ahí. El renglón
  // de procedencia llegaba a NOMBRARLO, señalando a algo invisible.
  //
  // Las siete pruebas de la ruta 2 lo daban por visible **en verde**, porque jsdom
  // no calcula maquetación. Aquí no se puede medir el píxel, así que se afirma la
  // ESTRUCTURA que lo garantiza — que es lo que se rompería si alguien deshace el
  // arreglo sin querer.
  describe('viewer/cajon-diagnostico.js · la puerta se pega abajo (T9, corregido 2026-08-04)', () => {
    // ⚠️ ESTA PRUEBA CAMBIÓ DE FORMA EL 2026-08-05 (rebanada 4) Y NO DE FONDO.
    // Hasta entonces exigía que la puerta fuera hija DIRECTA del contenedor que
    // scrollea, porque era el único elemento anclado. La rebanada 4 midió que los
    // otros tres —los dos botones del informe y el renglón de estado— sufrían el
    // MISMO defecto (207,53 px, 248,38 px y 164,69 px por debajo del borde), así
    // que el anclaje pasó a ser de todo el grupo. Lo que hay que garantizar sigue
    // siendo lo mismo: **entre la puerta y el elemento que scrollea hay un bloque
    // `sticky` pegado abajo, y ese bloque es lo último del cajón**. Escrito así, la
    // prueba habría pasado ANTES del cambio y pasa DESPUÉS: lo que no pasa es el
    // defecto que las dos versiones vigilan.
    it('cuelga de un bloque ANCLADO que es lo último del contenedor que scrollea', () => {
      const { raiz } = conCajon()
      const puerta = nodo(raiz, SELECTOR.PUERTA)

      // El que scrollea se busca SUBIENDO desde la puerta, no se supone.
      let contenedor = null
      for (let el = puerta.parentElement; el !== null && contenedor === null; el = el.parentElement) {
        if (el.style?.overflowY === 'auto') contenedor = el
      }
      expect(contenedor, 'entre la puerta y la raíz nadie scrollea').not.toBe(null)
      expect(
        contenedor.classList.contains(CLASE.CONTENEDOR),
        'el que scrollea tiene que ser el contenedor del cajón',
      ).toBe(true)
      expect(contenedor.style.maxHeight, 'y el que tiene tope de alto').not.toBe('')

      // El ancla: la puerta o alguno de sus ancestros por debajo del que scrollea.
      let ancla = null
      for (let el = puerta; el !== null && el !== contenedor; el = el.parentElement) {
        if (el.style.position === 'sticky' && el.style.bottom === '0px') ancla = el
      }
      expect(ancla, 'nada entre la puerta y el scroller está pegado abajo').not.toBe(null)

      // Y ese bloque es lo ÚLTIMO: si algo se cuela detrás, el `sticky` se despega
      // en cuanto ese algo asoma, que es exactamente cómo nació el defecto.
      const ultimoDirecto = contenedor.lastElementChild
      expect(
        ultimoDirecto === ancla || ultimoDirecto.contains(ancla),
        'el bloque anclado tiene que ser lo último del cajón',
      ).toBe(true)

      // La decisión de T9 sigue viva: la puerta no se mezcla con los entregables.
      expect(puerta.closest('footer')).toBe(null)
      expect(puerta.parentElement.lastElementChild).toBe(puerta)
    })

    it('declara `sticky` y `bottom: 0`, que es lo que la mantiene a la vista', () => {
      const { raiz } = conCajon()
      const puerta = nodo(raiz, SELECTOR.PUERTA)
      expect(puerta.style.position).toBe('sticky')
      expect(puerta.style.bottom).toBe('0px')
    })

    it('al enseñarla se pone `block`, porque `sticky` no se pega sobre un elemento en línea', () => {
      const { cajon, raiz } = conCajon()
      const puerta = nodo(raiz, SELECTOR.PUERTA)
      expect(puerta.style.display).toBe('none')
      cajon.puerta(true)
      // `''` dejaría el `<button>` en `inline-block` y el arreglo se deshace sin
      // que nada lo diga: por eso se afirma el valor y no «distinto de none».
      expect(puerta.style.display).toBe('block')
      cajon.puerta(false)
      expect(puerta.style.display).toBe('none')
    })

    it('lleva fondo opaco, o el contenido se vería pasar por debajo', () => {
      const { raiz } = conCajon()
      const puerta = nodo(raiz, SELECTOR.PUERTA)
      // Un sticky transparente deja ver el texto que scrollea detrás, y el botón se
      // vuelve ilegible justo cuando más falta hace.
      expect(puerta.style.background).not.toBe('transparent')
      expect(puerta.style.background).not.toBe('')
    })
  })

  it('los dos botones comparten FILA: el segundo cuesta 0 px de alto', () => {
    // La razón 2 de F08 —el panel no pierde ni un píxel— sigue en pie porque el
    // cajón no crece. `getBoundingClientRect` no mide nada en jsdom, así que lo que
    // se afirma es la ESTRUCTURA que lo garantiza: un solo contenedor flex.
    const { raiz } = conCajon()
    const primario = nodo(raiz, SELECTOR.PREPARAR)
    const secundario = nodo(raiz, SELECTOR.DESCARGAR)
    expect(primario.parentElement).toBe(secundario.parentElement)
    expect(primario.parentElement.style.display).toBe('flex')
  })

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

  it('los dos canales son INDEPENDIENTES: preparar no descarga y descargar no prepara', () => {
    const { cajon, raiz } = conCajon()
    const preparar = vi.fn()
    const descargar = vi.fn()
    cajon.alPreparar(preparar)
    cajon.alDescargar(descargar)
    cajon.pintar(COMPLETO())

    nodo(raiz, SELECTOR.PREPARAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(preparar).toHaveBeenCalledTimes(1)
    expect(descargar).not.toHaveBeenCalled()

    nodo(raiz, SELECTOR.DESCARGAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(descargar).toHaveBeenCalledTimes(1)
    expect(preparar).toHaveBeenCalledTimes(1)
  })

  it('pulsarlo NO cierra el cajón ni para la propagación', () => {
    // Mismo caso que el de texto: `disableClickPropagation` no detiene el `click`, y
    // lo que salva al cajón es la comprobación `contains` del guardián. Parar la
    // propagación dejaría sordo al panel de ayuda de la barra de edición.
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

  it('`destruir()` lo desengancha', () => {
    const { cajon, raiz } = conCajon()
    const fn = vi.fn()
    cajon.alPreparar(fn)
    cajon.pintar(COMPLETO())
    const boton = nodo(raiz, SELECTOR.PREPARAR)

    cajon.destruir()

    expect(() =>
      boton.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    ).not.toThrow()
    expect(fn).not.toHaveBeenCalled()
  })
})

// ── La familia tipográfica la pone la HOJA, no el módulo ─────────────────────
//
// Gemelo del guardián de `test/viewer/cajon-comprobacion.dom.test.js`, y existe
// por el mismo defecto REAL medido en navegador el 2026-07-30 por
// `scripts/smoke-navegador/10-comprobar-gml.js`: «Descargar informe de contraste»
// salía en `system-ui` porque llevaba `font: 'inherit'` EN LÍNEA, y el inline gana
// a la hoja — la regla `.gml-cajon-diagnostico button` de `estilos/app.css` era
// código muerto. Los dos cajones se arreglaron juntos porque sus cabeceras dicen
// que tienen que leerse como el mismo cromo; se vigilan juntos por lo mismo.

describe('viewer/cajon-diagnostico · los botones del informe no fijan la tipografía en línea', () => {
  // Los DOS del pie, no solo el que tuvo el defecto: el de F09 nació con el mismo
  // reparto y se rompería de la misma forma, en silencio y solo en navegador.
  for (const [rotulo, accion] of [
    ['Descargar informe de contraste', 'descargar-informe'],
    ['Preparar informe (PDF)', 'preparar-informe'],
  ]) {
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
  it('⭐ los dos botones del informe y el renglón de estado van DENTRO del bloque anclado', () => {
    const { raiz } = conCajon()
    const puerta = nodo(raiz, SELECTOR.PUERTA)

    // El ancla se busca desde la puerta, que ya tiene su propio guardián: así los
    // dos hablan del MISMO bloque y no de dos cosas que se llaman igual.
    let ancla = null
    for (let el = puerta; el !== null && el !== raiz; el = el.parentElement) {
      if (el.style.position === 'sticky' && el.style.bottom === '0px') ancla = el
    }
    expect(ancla, 'no hay bloque anclado del que colgar lo accionable').not.toBe(null)

    for (const sel of [SELECTOR.PREPARAR, SELECTOR.DESCARGAR, SELECTOR.ESTADO]) {
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
    expect(raiz.style.borderRadius).toBe('8px')
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
