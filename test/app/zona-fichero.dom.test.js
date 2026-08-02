/* -------------------------------------------------------------------------- *
 * test/app/zona-fichero.dom.test.js — F08 · T3.2                               *
 *                                                                              *
 * `app/zona-fichero.js` es la PRIMERA entrada por fichero de la aplicación, y   *
 * todo lo que puede salir mal en ella es invisible: un `preventDefault` que     *
 * falta y el navegador se lleva la pestaña con la parcela dentro; un contador   *
 * de arrastre mal llevado y el velo parpadea en cada frontera de elemento; un   *
 * `input.value` sin resetear y volver a abrir el MISMO fichero corregido no     *
 * hace nada; un oyente que se queda vivo en `window` y sigue cancelando         *
 * arrastres de una pantalla que ya no existe. Nada de eso lo caza un test de    *
 * humo: va todo aquí.                                                          *
 *                                                                              *
 * ── EL PROBLEMA DE MEDIRLO EN JSDOM, Y CÓMO SE RESUELVE ───────────────────── *
 * jsdom (29.1) **no implementa `DataTransfer` ni `DragEvent`**: medido, los dos *
 * son `undefined`. Así que los eventos de arrastre se fabrican con `Event`      *
 * (`bubbles: true, cancelable: true` — sin `cancelable` un `preventDefault` no  *
 * se nota) y un DOBLE de `dataTransfer` colgado del evento. El doble imita las  *
 * dos caras reales del objeto: en `dragover` el navegador OCULTA `files` por    *
 * seguridad y solo publica `types` (con `'Files'` dentro); en `drop` ya trae    *
 * los ficheros. Los dos casos se ejercitan por separado.                        *
 *                                                                              *
 * `files` se dobla como objeto ARRAY-LIKE y no como array, porque una           *
 * `FileList` real no es un array: si el módulo usara `.map` o `.filter` sobre   *
 * ella, en el navegador reventaría y aquí pasaría. Los `File` sí son reales     *
 * (jsdom los tiene).                                                            *
 *                                                                              *
 * Y jsdom **tampoco sintetiza el `click` que un `<button>` emite al pulsar      *
 * Enter o Espacio** (medido: 0 clics tras un `keydown` de Enter). Por eso la    *
 * prueba de teclado no dispara teclas: afirma lo que SÍ hace que el teclado     *
 * funcione en un navegador de verdad —que se escucha `click` y no `mousedown`,  *
 * y que el input fabricado no es un segundo parador de tabulación—, que es la   *
 * mitad comprobable aquí. La otra mitad (soltar un fichero de verdad con el     *
 * ratón) es del guion de navegador de T6.2.                                     *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  crearZonaFichero,
  CLASE_SUPERPOSICION,
  CLASE_SUPERPOSICION_TEXTO,
  CLASE_INPUT,
  DATO_ARRASTRANDO,
  VALOR_ARRASTRANDO,
  MENSAJE_ALFICHERO_ROTO,
} from '../../app/zona-fichero.js'
import { NIVEL } from '../../viewer/_comun.js'

// ── Dobles ────────────────────────────────────────────────────────────────────

/** `FileList` de mentira: array-like con `length`, índices y `item`, como la de
 *  verdad — y deliberadamente SIN los métodos de `Array`. */
function dobleFileList(ficheros) {
  const lista = { length: ficheros.length, item: (i) => ficheros[i] ?? null }
  ficheros.forEach((f, i) => {
    lista[i] = f
  })
  return lista
}

/**
 * `DataTransfer` de mentira.
 * @param {File[]} ficheros  Lo que trae `files` (vacío en `dragover`, lleno en `drop`).
 * @param {string[]} [tipos] Lo que trae `types`. Por defecto `['Files']`.
 */
function dobleDataTransfer(ficheros = [], tipos = ['Files']) {
  return { types: tipos, files: dobleFileList(ficheros), dropEffect: 'none' }
}

/** Fabrica y despacha un evento de arrastre. Devuelve el evento para poder
 *  interrogar su `defaultPrevented`. */
function arrastre(tipo, { sobre = document.body, ficheros = [], tipos = ['Files'] } = {}) {
  const evento = new Event(tipo, { bubbles: true, cancelable: true })
  evento.dataTransfer = dobleDataTransfer(ficheros, tipos)
  sobre.dispatchEvent(evento)
  return evento
}

const gml = (nombre = 'parcela.gml') => new File(['<FeatureCollection/>'], nombre, { type: '' })

/** ¿Está puesta la marca de arrastre en el `<body>`? */
const arrastrando = () => document.body.dataset[DATO_ARRASTRANDO]

// ── Arnés ─────────────────────────────────────────────────────────────────────

/** Zonas vivas de la prueba en curso; se destruyen en el `afterEach` para que
 *  ningún oyente de `window` sobreviva de una prueba a la siguiente (window es
 *  compartida por todo el fichero). */
let pendientes = []

/** La cáscara mínima de la que depende el módulo: un `<button>` DE VERDAD (no un
 *  `<div>`) dentro de la fila del rótulo, como el que escribe T3.3. */
function montarCascara() {
  document.body.innerHTML = `
    <section class="gml-seccion gml-seccion--catastro">
      <div class="gml-rotulo-fila">
        <h2>Origen de la parcela</h2>
        <button type="button" class="gml-boton gml-boton--secundario" data-accion="abrir-gml">
          Abrir un GML
        </button>
      </div>
      <div id="padre"><div id="hijo">contenido</div></div>
    </section>
  `
  return document.querySelector('[data-accion="abrir-gml"]')
}

function montar(opciones = {}) {
  const boton = montarCascara()
  const recibidos = []
  const avisos = []
  const zona = crearZonaFichero({
    boton,
    ventana: window,
    alFichero: (f) => recibidos.push(f),
    alAviso: (mensaje, detalle) => avisos.push({ mensaje, detalle }),
    ...opciones,
  })
  pendientes.push(zona)
  return {
    boton,
    zona,
    recibidos,
    avisos,
    input: document.querySelector(`.${CLASE_INPUT}`),
    velo: document.querySelector(`.${CLASE_SUPERPOSICION}`),
  }
}

/** Mete `ficheros` en el input y dispara el `change`, que es lo que hace el
 *  navegador cuando el usuario elige en el selector. `input.files` no es
 *  escribible en jsdom, así que se sustituye la propiedad en la instancia. */
function elegirEnElInput(input, ficheros) {
  Object.defineProperty(input, 'files', {
    value: dobleFileList(ficheros),
    configurable: true,
  })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

beforeEach(() => {
  pendientes = []
  delete document.body.dataset[DATO_ARRASTRANDO]
})

afterEach(() => {
  for (const zona of pendientes) zona.destruir()
  pendientes = []
  document.body.innerHTML = ''
  delete document.body.dataset[DATO_ARRASTRANDO]
  vi.restoreAllMocks()
})

// ── 1 · preventDefault: el fallo más caro del módulo ─────────────────────────

describe('preventDefault en dragover y en drop', () => {
  it('`dragover` llama a preventDefault (sin él el navegador abre el fichero y se pierde la app entera)', () => {
    montar()

    const evento = new Event('dragover', { bubbles: true, cancelable: true })
    evento.dataTransfer = dobleDataTransfer([], ['Files'])
    const espia = vi.spyOn(evento, 'preventDefault')
    document.body.dispatchEvent(evento)

    expect(espia).toHaveBeenCalledTimes(1)
    // Y el efecto, no solo la llamada: `defaultPrevented` es lo que el navegador
    // mira para decidir si aplica su comportamiento por defecto.
    expect(evento.defaultPrevented).toBe(true)
  })

  it('`drop` llama a preventDefault (es el que impide de verdad la navegación al fichero)', () => {
    montar()

    const evento = new Event('drop', { bubbles: true, cancelable: true })
    evento.dataTransfer = dobleDataTransfer([gml()], ['Files'])
    const espia = vi.spyOn(evento, 'preventDefault')
    document.body.dispatchEvent(evento)

    expect(espia).toHaveBeenCalledTimes(1)
    expect(evento.defaultPrevented).toBe(true)
  })

  it('`dragenter` también se cancela, que es lo que pide el modelo de proceso del HTML', () => {
    montar()
    expect(arrastre('dragenter').defaultPrevented).toBe(true)
  })

  it('un arrastre que NO trae ficheros (texto de una celda a otra) NO se cancela', () => {
    // Anti-vacuidad de la prueba anterior: si el módulo cancelase TODO arrastre
    // de la ventana, rompería el soltar-texto nativo de los `<input>` del panel
    // de coordenadas. La prueba de arriba pasaría igual; ésta no.
    montar()

    const sobre = arrastre('dragover', { tipos: ['text/plain'] })
    const suelta = arrastre('drop', { tipos: ['text/plain'] })

    expect(sobre.defaultPrevented).toBe(false)
    expect(suelta.defaultPrevented).toBe(false)
    expect(arrastrando()).toBeUndefined()
  })

  it('marca el cursor como «copiar»: no nos llevamos el fichero de donde estaba', () => {
    montar()
    const evento = new Event('dragover', { bubbles: true, cancelable: true })
    evento.dataTransfer = dobleDataTransfer([], ['Files'])
    document.body.dispatchEvent(evento)
    expect(evento.dataTransfer.dropEffect).toBe('copy')
  })
})

// ── 2 · El contador: la superposición no parpadea al cruzar hijos ────────────

describe('contador de dragenter/dragleave', () => {
  it('la superposición NO parpadea al cruzar de un elemento a su hijo', () => {
    montar()
    const padre = document.getElementById('padre')
    const hijo = document.getElementById('hijo')

    // Los eventos de arrastre burbujean y se disparan POR NODO. El orden que
    // fija el modelo de proceso del HTML al cambiar de destino es `dragenter`
    // en el nuevo ANTES que `dragleave` en el anterior; se reproduce tal cual.
    const foto = []

    arrastre('dragenter', { sobre: padre })
    foto.push(arrastrando())

    arrastre('dragenter', { sobre: hijo }) // entra en el hijo…
    foto.push(arrastrando())

    arrastre('dragleave', { sobre: padre }) // …y sale del padre. Sigue dentro.
    foto.push(arrastrando())

    // Las TRES fotos en «si»: una implementación sin contador —que apagase con
    // cualquier `dragleave`— habría dejado la tercera en `undefined`. Ése es el
    // parpadeo, y ésta es la única forma de verlo en jsdom.
    expect(foto).toEqual([VALOR_ARRASTRANDO, VALOR_ARRASTRANDO, VALOR_ARRASTRANDO])

    // Y al salir de verdad (el último `dragleave` pendiente), se apaga.
    arrastre('dragleave', { sobre: hijo })
    expect(arrastrando()).toBeUndefined()
  })

  it('un `drop` apaga la superposición aunque queden entradas sin salida', () => {
    const { recibidos } = montar()
    arrastre('dragenter', { sobre: document.getElementById('padre') })
    arrastre('dragenter', { sobre: document.getElementById('hijo') })
    expect(arrastrando()).toBe(VALOR_ARRASTRANDO)

    arrastre('drop', { ficheros: [gml()] })

    expect(arrastrando()).toBeUndefined()
    expect(recibidos).toHaveLength(1)
  })

  it('un `dragleave` suelto no deja el contador en negativo (el siguiente arrastre sí enciende)', () => {
    montar()
    arrastre('dragleave')
    arrastre('dragleave')
    expect(arrastrando()).toBeUndefined()

    arrastre('dragenter')
    expect(arrastrando()).toBe(VALOR_ARRASTRANDO)
  })

  it('un `dragover` sin `dragenter` previo enciende igual (entrar por el borde de la ventana)', () => {
    montar()
    arrastre('dragover')
    expect(arrastrando()).toBe(VALOR_ARRASTRANDO)
  })

  it('la marca se pone en el <body> con el valor congelado del contrato', () => {
    montar()
    arrastre('dragenter')
    // Se afirma el ATRIBUTO tal cual lo verá el CSS de T3.3, no solo el dataset.
    expect(document.body.getAttribute(`data-${DATO_ARRASTRANDO}`)).toBe(VALOR_ARRASTRANDO)
    arrastre('dragleave')
    // Y al terminar el atributo se QUITA, no se pone a «no»: el selector de T3.3
    // puede ser el directo `body[data-arrastrando="si"]`.
    expect(document.body.hasAttribute(`data-${DATO_ARRASTRANDO}`)).toBe(false)
  })
})

// ── 3 · El mismo fichero dos veces ───────────────────────────────────────────

describe('el mismo fichero dos veces seguidas', () => {
  it('soltar dos veces el MISMO fichero dispara alFichero dos veces', () => {
    const { recibidos } = montar()
    const fichero = gml('parcela.gml')

    arrastre('drop', { ficheros: [fichero] })
    arrastre('drop', { ficheros: [fichero] })

    expect(recibidos).toEqual([fichero, fichero])
  })

  it('elegir dos veces el MISMO fichero dispara alFichero dos veces (input.value se resetea)', () => {
    const { input, recibidos } = montar()
    const fichero = gml('parcela.gml')

    elegirEnElInput(input, [fichero])
    // Ésta es la condición que hace posible el segundo `change`: un
    // `<input type="file">` no emite `change` si el valor no cambia, y corregir
    // el GML fuera y volver a abrirlo es el reintento más probable que hay.
    expect(input.value).toBe('')

    elegirEnElInput(input, [fichero])

    expect(recibidos).toEqual([fichero, fichero])
  })

  it('el reseteo de `input.value` se hace de verdad: se observa la ESCRITURA, no el resultado', () => {
    // Anti-vacuidad: en jsdom `input.value` de un file input ya vale `''` de
    // salida, así que afirmar `toBe('')` pasaría aunque el módulo no escribiera
    // nada. Aquí se intercepta el setter y se cuenta la escritura.
    const { input, recibidos } = montar()
    const escrituras = []
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => '',
      set: (v) => escrituras.push(v),
    })

    elegirEnElInput(input, [gml()])

    expect(escrituras).toEqual([''])
    expect(recibidos).toHaveLength(1)
  })

  it('también se resetea cuando el fichero se RECHAZA por su extensión', () => {
    const { input, recibidos, avisos } = montar()
    const escrituras = []
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => '',
      set: (v) => escrituras.push(v),
    })

    elegirEnElInput(input, [new File(['x'], 'plano.dwg')])

    expect(recibidos).toHaveLength(0)
    expect(avisos).toHaveLength(1)
    // Si no se reseteara, el usuario que se equivoca de fichero una vez ya no
    // podría volver a elegir ese mismo nombre nunca más sin recargar.
    expect(escrituras).toEqual([''])
  })

  it('también se resetea si `alFichero` revienta (el `finally`)', () => {
    const { input, avisos } = montarConAlFicheroRoto()
    const escrituras = []
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => '',
      set: (v) => escrituras.push(v),
    })

    elegirEnElInput(input, [gml()])

    expect(escrituras).toEqual([''])
    expect(avisos).toHaveLength(1)
  })
})

// ── 3 bis · Cuando el que revienta es el llamante ────────────────────────────

/** Monta una zona cuyo `alFichero` lanza siempre, con `console.error` silenciado. */
function montarConAlFicheroRoto() {
  const boton = montarCascara()
  const avisos = []
  const fallo = new Error('el llamante ha reventado')
  const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
  const zona = crearZonaFichero({
    boton,
    ventana: window,
    alFichero: () => {
      throw fallo
    },
    alAviso: (mensaje, detalle) => avisos.push({ mensaje, detalle }),
  })
  pendientes.push(zona)
  return { boton, zona, avisos, fallo, consola, input: document.querySelector(`.${CLASE_INPUT}`) }
}

describe('un `alFichero` que revienta', () => {
  it('NO se propaga: una excepción dentro de un oyente del DOM no sale por dispatchEvent y sería invisible', () => {
    // ⛔ MEDIDO en T3.2 y contrario a lo que este módulo hacía al principio: una
    // excepción lanzada dentro de un oyente NO sale por `dispatchEvent` (ni en
    // jsdom ni en el navegador). Dejarla propagar no es «que se entere el
    // llamante»: es un error SILENCIOSO para el usuario, que es justo lo que
    // prohíbe la regla de oro 1.
    const { avisos, fallo, consola } = montarConAlFicheroRoto()

    expect(() => arrastre('drop', { ficheros: [gml()] })).not.toThrow()

    expect(avisos).toHaveLength(1)
    expect(avisos[0].mensaje).toBe(MENSAJE_ALFICHERO_ROTO)
    // ERROR, no AVISO: aquí sí ha fallado la aplicación.
    expect(avisos[0].detalle.nivel).toBe(NIVEL.ERROR)
    // Y la causa viaja, para quien la sepa leer.
    expect(avisos[0].detalle.causa).toBe(fallo)
    // Los dos canales de la casa: panel en español + consola con el detalle.
    expect(consola).toHaveBeenCalledTimes(1)
    expect(consola.mock.calls[0][1]).toBe(fallo)
  })

  it('el mensaje no culpa al fichero de un defecto de la aplicación', () => {
    // Gemelo de `MENSAJE_SUSCRIPTOR_ROTO` de `app/cableado-catastro.js`: la
    // entrada no ha fallado, el fichero llegó.
    expect(MENSAJE_ALFICHERO_ROTO).toContain('fallo interno')
    expect(MENSAJE_ALFICHERO_ROTO).not.toMatch(/no se ha podido (abrir|leer) el fichero/i)
  })

  it('la zona sigue viva después: el siguiente fichero se entrega igual', () => {
    const boton = montarCascara()
    const recibidos = []
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let romper = true
    const zona = crearZonaFichero({
      boton,
      ventana: window,
      alFichero: (f) => {
        if (romper) throw new Error('la primera vez peta')
        recibidos.push(f)
      },
      alAviso: () => {},
    })
    pendientes.push(zona)

    arrastre('drop', { ficheros: [gml('primera.gml')] })
    romper = false
    arrastre('drop', { ficheros: [gml('segunda.gml')] })

    expect(recibidos.map((f) => f.name)).toEqual(['segunda.gml'])
    expect(arrastrando()).toBeUndefined()
  })
})

// ── 4 · Varios ficheros: se coge el primero Y SE DICE ────────────────────────

describe('varios ficheros a la vez', () => {
  it('coge el primero y lo DICE, nombrando los que no ha abierto (regla de oro 1)', () => {
    const { recibidos, avisos } = montar()
    const a = gml('a.gml')
    const b = gml('b.gml')
    const c = gml('c.gml')

    arrastre('drop', { ficheros: [a, b, c] })

    expect(recibidos).toEqual([a])
    expect(avisos).toHaveLength(1)
    const { mensaje, detalle } = avisos[0]
    expect(mensaje).toContain('3')
    expect(mensaje).toContain('«a.gml»')
    expect(mensaje).toContain('«b.gml»')
    expect(mensaje).toContain('«c.gml»')
    expect(detalle.nivel).toBe(NIVEL.AVISO)
  })

  it('coge el PRIMERO aunque no valga, no «el primero que valga»', () => {
    // Buscar el primero aceptable sería una segunda elección silenciosa encima
    // de la primera: el usuario no sabría cuál de los tres se ha abierto.
    const { recibidos, avisos } = montar()

    arrastre('drop', { ficheros: [new File(['x'], 'plano.dwg'), gml('buena.gml')] })

    expect(recibidos).toHaveLength(0)
    expect(avisos).toHaveLength(2) // «son varios» + «esa extensión no»
    expect(avisos[1].mensaje).toContain('plano.dwg')
  })

  it('con muchísimos ficheros el aviso no se convierte en un muro de nombres', () => {
    const { recibidos, avisos } = montar()
    const muchos = Array.from({ length: 40 }, (_, i) => gml(`p${i}.gml`))

    arrastre('drop', { ficheros: muchos })

    expect(recibidos).toEqual([muchos[0]])
    const { mensaje } = avisos[0]
    expect(mensaje).toContain('40')
    expect(mensaje).toContain('y 34 más') // 39 no abiertos, 5 nombrados
    expect(mensaje).not.toContain('p39.gml')
    expect(mensaje.length).toBeLessThan(400)
  })

  it('un solo fichero no produce ningún aviso', () => {
    const { recibidos, avisos } = montar()
    arrastre('drop', { ficheros: [gml()] })
    expect(recibidos).toHaveLength(1)
    expect(avisos).toEqual([])
  })

  it('un soltado que se anuncia con ficheros y no trae ninguno se dice, no se traga', () => {
    const { recibidos, avisos } = montar()
    arrastre('drop', { ficheros: [], tipos: ['Files'] })
    expect(recibidos).toHaveLength(0)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].detalle.nivel).toBe(NIVEL.AVISO)
  })
})

// ── 5 · Extensión ajena: aviso claro, no fallo ───────────────────────────────

describe('extensión ajena', () => {
  it('avisa nombrando las extensiones que SÍ se aceptan y NO llama a alFichero', () => {
    const { recibidos, avisos } = montar()

    arrastre('drop', { ficheros: [new File(['x'], 'plano.dwg')] })

    expect(recibidos).toHaveLength(0)
    expect(avisos).toHaveLength(1)
    const { mensaje, detalle } = avisos[0]
    expect(mensaje).toContain('plano.dwg')
    expect(mensaje).toContain('.dwg')
    expect(mensaje).toContain('.gml')
    expect(mensaje).toContain('.xml')
    // AVISO, no ERROR: es un dato del usuario, no un fallo de la aplicación.
    expect(detalle.nivel).toBe(NIVEL.AVISO)
  })

  it('no lanza: un dato malo del usuario nunca tumba la zona', () => {
    const { recibidos } = montar()
    expect(() => arrastre('drop', { ficheros: [new File(['x'], 'plano.dwg')] })).not.toThrow()
    // Y la zona sigue viva después.
    arrastre('drop', { ficheros: [gml()] })
    expect(recibidos).toHaveLength(1)
  })

  it('la extensión se compara SIN distinguir mayúsculas', () => {
    const { recibidos, avisos } = montar()
    arrastre('drop', { ficheros: [gml('PARCELA.GML')] })
    expect(recibidos).toHaveLength(1)
    expect(avisos).toEqual([])
  })

  it('un fichero sin extensión se dice con esas palabras, no con un «.» a secas', () => {
    const { recibidos, avisos } = montar()
    arrastre('drop', { ficheros: [new File(['x'], 'LISTADO')] })
    expect(recibidos).toHaveLength(0)
    expect(avisos[0].mensaje).toContain('no tiene extensión')
  })

  it('la doble extensión se juzga por la última (`parcela.gml.txt` no es un GML)', () => {
    const { recibidos, avisos } = montar()
    arrastre('drop', { ficheros: [gml('parcela.gml.txt')] })
    expect(recibidos).toHaveLength(0)
    // Se afirma sobre la extensión JUZGADA, no sobre el nombre: `toContain('.txt')`
    // pasaría por el propio nombre del fichero sin medir nada.
    expect(avisos[0].mensaje).toMatch(/es \.txt/)
  })
})

// ── 6 · El botón: un <button> de verdad, y el teclado ────────────────────────

describe('el botón y el input fabricado', () => {
  it('el módulo FABRICA el <input type="file"> (T3.3 no lo pone) y lo deja junto al botón', () => {
    const { boton, input } = montar()
    expect(input).not.toBeNull()
    expect(input.tagName).toBe('INPUT')
    expect(input.type).toBe('file')
    expect(input.previousElementSibling).toBe(boton)
    // El `accept` se DERIVA de las extensiones aceptadas, no se escribe aparte:
    // así el filtro del selector del sistema no puede desincronizarse del que
    // aplica el módulo.
    expect(input.accept).toBe('.gml,.xml')
  })

  it('pulsar el botón abre el input', () => {
    const { boton, input } = montar()
    const abrir = vi.spyOn(input, 'click')

    boton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(abrir).toHaveBeenCalledTimes(1)
  })

  it('responde al teclado: se escucha `click`, que es lo que emite un <button> con Enter o Espacio', () => {
    // jsdom NO sintetiza el `click` de la activación por teclado (medido: un
    // `keydown` de Enter sobre un `<button>` produce 0 clics), así que lo que se
    // afirma aquí es la CAUSA de que funcione en un navegador: que el único
    // oyente del botón sea de tipo `click`. Con `mousedown` —el error clásico—
    // esta prueba saldría roja y el botón sería inaccesible con teclado.
    const boton = montarCascara()
    const tipos = []
    const addOriginal = boton.addEventListener.bind(boton)
    boton.addEventListener = (tipo, fn, opts) => {
      tipos.push(tipo)
      return addOriginal(tipo, fn, opts)
    }

    const zona = crearZonaFichero({
      boton,
      ventana: window,
      alFichero: () => {},
      alAviso: () => {},
    })
    pendientes.push(zona)
    delete boton.addEventListener

    expect(tipos).toEqual(['click'])

    // Y el gesto de teclado, tal y como el navegador lo entrega: foco en el
    // botón y el `click` que la activación produce.
    const input = document.querySelector(`.${CLASE_INPUT}`)
    const abrir = vi.spyOn(input, 'click')
    boton.focus()
    expect(document.activeElement).toBe(boton)
    boton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(abrir).toHaveBeenCalledTimes(1)
  })

  it('el input oculto no es un segundo parador de tabulación ni se anuncia al lector', () => {
    const { input } = montar()
    expect(input.tabIndex).toBe(-1)
    expect(input.getAttribute('aria-hidden')).toBe('true')
    // Oculto por estilo EN LÍNEA y no por `display:none`: hay navegadores que se
    // niegan a abrir el selector de un input que no se renderiza, y además
    // `estilos/app.css` (T3.3) va en paralelo y este control no puede depender
    // de que esa hoja llegue.
    expect(input.style.position).toBe('absolute')
    expect(input.style.width).toBe('1px')
    expect(input.style.display).toBe('')
  })

  it('el clic del botón se cancela, por si algún día la zona vive dentro de un <form>', () => {
    const { boton } = montar()
    const evento = new MouseEvent('click', { bubbles: true, cancelable: true })
    boton.dispatchEvent(evento)
    expect(evento.defaultPrevented).toBe(true)
  })
})

// ── 7 · destruir(): ni un oyente vivo en la ventana ──────────────────────────

describe('destruir()', () => {
  it('deja `window` sin NI UN escuchador (se espía addEventListener/removeEventListener)', () => {
    const boton = montarCascara()

    // Monkey-patch a mano y no `vi.spyOn`, por el mismo motivo que el test de
    // `viewer/barra-edicion.js`: aquí interesa la IDENTIDAD exacta de la función
    // registrada —quitar un oyente exige la misma referencia— y un espía puede
    // difuminarla. Se espía DESPUÉS de montar la cáscara: lo que se cuenta es
    // solo lo que añade la zona.
    const anadidos = []
    const quitados = []
    const propioAdd = Object.prototype.hasOwnProperty.call(window, 'addEventListener')
    const propioRemove = Object.prototype.hasOwnProperty.call(window, 'removeEventListener')
    const addOriginal = window.addEventListener
    const removeOriginal = window.removeEventListener
    window.addEventListener = function (tipo, fn, opciones) {
      anadidos.push([tipo, fn])
      return addOriginal.call(this, tipo, fn, opciones)
    }
    window.removeEventListener = function (tipo, fn, opciones) {
      quitados.push([tipo, fn])
      return removeOriginal.call(this, tipo, fn, opciones)
    }

    try {
      const zona = crearZonaFichero({
        boton,
        ventana: window,
        alFichero: () => {},
        alAviso: () => {},
      })
      zona.destruir()
    } finally {
      if (propioAdd) window.addEventListener = addOriginal
      else delete window.addEventListener
      if (propioRemove) window.removeEventListener = removeOriginal
      else delete window.removeEventListener
    }

    // La superficie que la zona ocupa en la ventana, escrita: cuatro eventos de
    // arrastre y ni uno más.
    expect(anadidos.map(([tipo]) => tipo).sort()).toEqual([
      'dragenter',
      'dragleave',
      'dragover',
      'drop',
    ])
    expect(anadidos.length).toBeGreaterThan(0) // que la lista no esté vacía por error
    for (const [tipo, fn] of anadidos) {
      expect(
        quitados.some(([t, f]) => t === tipo && f === fn),
        `el oyente '${tipo}' de la ventana se ha quedado vivo tras destruir(): es una fuga que no se ve`,
      ).toBe(true)
    }
  })

  it('después de destruir, un arrastre sobre la ventana ya no se cancela ni marca nada', () => {
    const { zona } = montar()
    zona.destruir()

    const sobre = arrastre('dragover')
    const suelta = arrastre('drop', { ficheros: [gml()] })

    expect(sobre.defaultPrevented).toBe(false)
    expect(suelta.defaultPrevented).toBe(false)
    expect(arrastrando()).toBeUndefined()
  })

  it('después de destruir, ni el botón ni el input siguen conectados', () => {
    const { boton, input, recibidos, zona } = montar()
    const abrir = vi.spyOn(input, 'click')
    zona.destruir()

    boton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    elegirEnElInput(input, [gml()])

    expect(abrir).not.toHaveBeenCalled()
    expect(recibidos).toHaveLength(0)
  })

  it('retira del documento el input que fabricó y el velo que creó', () => {
    const { zona } = montar()
    expect(document.querySelector(`.${CLASE_INPUT}`)).not.toBeNull()
    expect(document.querySelector(`.${CLASE_SUPERPOSICION}`)).not.toBeNull()

    zona.destruir()

    expect(document.querySelector(`.${CLASE_INPUT}`)).toBeNull()
    expect(document.querySelector(`.${CLASE_SUPERPOSICION}`)).toBeNull()
  })

  it('borra la marca de arrastre aunque se destruya a media faena', () => {
    const { zona } = montar()
    arrastre('dragenter')
    expect(arrastrando()).toBe(VALOR_ARRASTRANDO)

    zona.destruir()

    expect(arrastrando()).toBeUndefined()
  })

  it('es idempotente', () => {
    const { zona } = montar()
    zona.destruir()
    expect(() => zona.destruir()).not.toThrow()
  })
})

// ── 8 · El velo, y la frontera con T3.3 ──────────────────────────────────────

describe('la superposición de arrastre', () => {
  it('usa la clase congelada del contrato y dice qué se puede soltar', () => {
    const { velo } = montar()
    expect(velo.className).toBe(CLASE_SUPERPOSICION)
    const texto = velo.querySelector(`.${CLASE_SUPERPOSICION_TEXTO}`)
    // El texto se DERIVA de `extensiones`, que es un dato que el CSS no tiene.
    expect(texto.textContent).toContain('.gml')
    expect(texto.textContent).toContain('.xml')
  })

  it('no captura el ratón: un velo pegado no puede dejar la aplicación inservible', () => {
    // Suelo de seguridad, no cromo. Si el contador se quedara alto por un
    // `dragleave` perdido, un velo a pantalla completa que capturase punteros
    // dejaría la app muerta sin síntoma («no me responde a nada»).
    const { velo } = montar()
    expect(velo.style.pointerEvents).toBe('none')
    expect(velo.getAttribute('aria-hidden')).toBe('true')
  })

  it('si la cáscara ya trae un velo, lo REUSA y no lo borra al destruir', () => {
    const boton = montarCascara()
    const propio = document.createElement('div')
    propio.className = CLASE_SUPERPOSICION
    propio.id = 'velo-de-la-cascara'
    document.body.appendChild(propio)

    const zona = crearZonaFichero({
      boton,
      ventana: window,
      alFichero: () => {},
      alAviso: () => {},
    })
    pendientes.push(zona)

    expect(document.querySelectorAll(`.${CLASE_SUPERPOSICION}`)).toHaveLength(1)
    zona.destruir()
    expect(document.getElementById('velo-de-la-cascara')).toBe(propio)
  })

  it('no escribe ni una regla de estilo del cromo: eso es de T3.3', () => {
    // El módulo marca el estado y ya. Lo único que fija en línea sobre el velo
    // es `pointer-events` (el suelo de seguridad de arriba).
    const { velo } = montar()
    const fijadas = Array.from(velo.style)
    expect(fijadas).toEqual(['pointer-events'])
  })
})

// ── 9 · Genérico a propósito: el conector que F01 heredará (Decisión 2) ──────

describe('conector genérico (no sabe qué es un GML)', () => {
  it('con otras extensiones acepta otros ficheros y nombra ESAS en el aviso', () => {
    // El día que F01 cablee DXF/LIST/TXT, `parsers/importar.js` recibe el texto
    // y autodetecta el formato: por aquí solo cambian las extensiones. La
    // interfaz de arrastrar-y-soltar no se rehace, que es el punto entero de la
    // Decisión 2 del plan.
    const boton = montarCascara()
    const recibidos = []
    const avisos = []
    const zona = crearZonaFichero({
      boton,
      ventana: window,
      extensiones: ['.dxf', '.txt'],
      alFichero: (f) => recibidos.push(f),
      alAviso: (m, d) => avisos.push({ mensaje: m, detalle: d }),
    })
    pendientes.push(zona)

    arrastre('drop', { ficheros: [new File(['0\nSECTION'], 'planta.dxf')] })
    expect(recibidos).toHaveLength(1)
    expect(recibidos[0].name).toBe('planta.dxf')

    arrastre('drop', { ficheros: [gml('parcela.gml')] })
    expect(recibidos).toHaveLength(1)
    expect(avisos[0].mensaje).toContain('.dxf')
    expect(avisos[0].mensaje).toContain('.txt')
    expect(avisos[0].mensaje).not.toContain('.xml')

    expect(document.querySelector(`.${CLASE_INPUT}`).accept).toBe('.dxf,.txt')
  })

  it('entrega el File TAL CUAL: no lo lee, no lo decodifica y no lo parsea', () => {
    const { recibidos } = montar()
    const fichero = gml('parcela.gml')
    arrastre('drop', { ficheros: [fichero] })
    // Identidad, no copia: decodificar es de `gml/decodificar.js` y comprobar de
    // `comprobacion/gml.js`, los dos por encima de esta capa.
    expect(recibidos[0]).toBe(fichero)
  })
})

// ── 10 · Contrato roto por el PROGRAMADOR: throw, y nombrando el hueco ───────

describe('contrato con el programador', () => {
  const base = () => ({ ventana: window, alFichero: () => {}, alAviso: () => {} })

  it('sin `boton` lanza TypeError', () => {
    expect(() => crearZonaFichero({ ...base() })).toThrow(TypeError)
    expect(() => crearZonaFichero({ ...base(), boton: null })).toThrow(/'boton'/)
  })

  it('un `boton` que no es un elemento del DOM lanza TypeError', () => {
    expect(() => crearZonaFichero({ ...base(), boton: { click: () => {} } })).toThrow(TypeError)
  })

  it('sin `ventana` lanza TypeError', () => {
    const boton = montarCascara()
    expect(() => crearZonaFichero({ boton, alFichero: () => {} })).toThrow(/'ventana'/)
  })

  it('sin `alFichero` lanza TypeError', () => {
    const boton = montarCascara()
    expect(() => crearZonaFichero({ boton, ventana: window })).toThrow(/'alFichero'/)
  })

  it('una extensión sin punto lanza RangeError nombrándola', () => {
    const boton = montarCascara()
    expect(() =>
      crearZonaFichero({ ...base(), boton, extensiones: ['gml'] }),
    ).toThrow(RangeError)
    expect(() => crearZonaFichero({ ...base(), boton, extensiones: ['gml'] })).toThrow(/"gml"/)
  })

  it('una lista de extensiones vacía lanza TypeError', () => {
    const boton = montarCascara()
    expect(() => crearZonaFichero({ ...base(), boton, extensiones: [] })).toThrow(/'extensiones'/)
  })

  it('sin `alAviso` cae al aviso por defecto del visor, nunca al silencio', () => {
    const boton = montarCascara()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const zona = crearZonaFichero({ boton, ventana: window, alFichero: () => {} })
    pendientes.push(zona)

    arrastre('drop', { ficheros: [new File(['x'], 'plano.dwg')] })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('plano.dwg')
  })

  it('un `alAviso` que no es función ni null lanza TypeError (política de resolverAvisar)', () => {
    const boton = montarCascara()
    expect(() =>
      crearZonaFichero({ boton, ventana: window, alFichero: () => {}, alAviso: 'sí' }),
    ).toThrow(TypeError)
  })
})
