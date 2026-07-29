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
import { CLASE, SELECTOR, crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
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
