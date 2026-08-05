/* -------------------------------------------------------------------------- *
 * test/viewer/cajon-comprobacion.dom.test.js — F08 · T3.1 · El cajón          *
 *                                                                            *
 * El cajón es una VISTA: fabrica nodos, los rellena, los abre y los cierra.   *
 * Lo que se prueba, por orden de importancia:                                *
 *                                                                            *
 *   1. **La regla de oro 9**, que es el requisito principal del fichero, y    *
 *      aquí pesa más que en F07 porque este cajón habla del trabajo de OTRO   *
 *      técnico: ni una palabra ni una clase CSS de mérito en lo que ESTE      *
 *      módulo escribe.                                                       *
 *   2. **Un botón gris y mudo es un error silencioso**: «Contrastar» apagado  *
 *      ⟺ `!puedeContinuar`, y el motivo escrito en el renglón en el mismo     *
 *      paso.                                                                 *
 *   3. **`bloqueos` NO es lo contrario de `puedeContinuar`**: el CP 3.0 trae  *
 *      un ERROR y el botón sigue encendido. Si algún día se fundieran, el     *
 *      gate se habría convertido en un veredicto.                            *
 *   4. **`null` ≠ `[]` en los hallazgos**: «no se ha mirado» y «se ha mirado  *
 *      y no hay nada» se escriben distinto, o lo segundo tranquiliza en falso.*
 *   5. El contrato de nodos con el cableado, y el desmontaje atómico.        *
 *                                                                            *
 * ── LA COMPROBACIÓN SE PRODUCE DE VERDAD, NO SE INVENTA ────────────────────  *
 * Cada caso llama a `comprobarGml` sobre un fichero REAL del repo (o sobre    *
 * uno de los derivados, que llevan su `PROCEDENCIA.md`). Un POJO escrito a    *
 * mano probaría que la vista pinta lo que le dé la gana el test; lo que hay   *
 * que saber es que pinta lo que la capa pura produce hoy — incluidos los      *
 * casos que nadie escribiría a mano, como `refcat: ''` o `hallazgos: null`.   *
 *                                                                            *
 * Proyecto Vitest `dom` (jsdom + Leaflet real, arnés `_ayuda-jsdom.js`).      *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import L from 'leaflet'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { comprobarGml } from '../../comprobacion/gml.js'
import { decodificarGml } from '../../gml/decodificar.js'
import {
  CLASE,
  SELECTOR,
  SELECTOR_MIEMBRO,
  crearCajonComprobacion,
} from '../../viewer/cajon-comprobacion.js'
import { montarMapa } from './_ayuda-jsdom.js'

// ── Arnés: la comprobación de verdad, sobre los ficheros de verdad ───────────

const DIR = join(import.meta.dirname, '..', 'fixtures', 'gml')

const EJEMPLO = 'cp_ejemplo_explicativo.gml'
const WFS = 'cp_parcela_9398516VK3799G.gml'
const TRESCERO = 'UTM_1.gml'
const EDIFICIO = 'bu_building_9398516VK3799G.gml'
const MULTI = 'derivados/cp_multiparcela_entrega.gml'
const SRS_MALO = 'derivados/cp_srs_no_soportado.gml'

/** Los que se recorren en los invariantes que valen para TODOS. */
const TODOS = [EJEMPLO, WFS, TRESCERO, EDIFICIO, MULTI, SRS_MALO]

/**
 * Los bytes de un fixture, en un `Uint8Array` **de este realm**.
 *
 * ⚠️ El `Uint8Array.from` no es adorno. `readFileSync` devuelve un `Buffer` de
 * Node, y bajo jsdom el `Uint8Array` global es el de la ventana: el `instanceof`
 * con el que `gml/decodificar.js` valida su entrada da `false` entre realms y la
 * función lanza. Es una trampa que el test hermano del proyecto `node`
 * (`test/comprobacion/gml.test.js`) no puede encontrar, porque allí solo hay un
 * realm. Copiar los bytes cuesta microsegundos y lo deja fuera de discusión.
 */
const bytesDe = (nombre) => Uint8Array.from(readFileSync(join(DIR, nombre)))

/**
 * El recorrido completo, tal como lo hará la app: bytes → texto → comprobación.
 * Se decodifica con `gml/decodificar.js` y no fiándose del prólogo, que es para lo
 * que ese módulo existe: el fixture del WFS declara `ISO-8859-1` y sus bytes son
 * UTF-8.
 */
function comprobarFixture(nombre, extra = {}) {
  const bytes = bytesDe(nombre)
  const { texto, detecciones, encodingUsado } = decodificarGml(bytes)
  return comprobarGml({
    texto,
    nombreFichero: nombre.split('/').pop(),
    bytes: bytes.byteLength,
    deteccionesPrevias: detecciones,
    encodingUsado,
    ...extra,
  })
}

const montados = []

function conCajon(opciones = {}) {
  const { mapa, contenedor, destruir } = montarMapa({ centro: [40.46, -3.71], zoom: 19 })
  const cajon = crearCajonComprobacion({ mapa, ...opciones })
  const raiz = cajon.control.getContainer()
  montados.push(() => {
    cajon.destruir()
    destruir()
  })
  return { mapa, contenedor, cajon, raiz }
}

/** Monta el cajón y pinta un fixture de una vez, que es el 90 % de los casos. */
function conFichero(nombre, extra = {}) {
  const montaje = conCajon()
  const comprobacion = comprobarFixture(nombre, extra)
  montaje.cajon.pintar(comprobacion)
  return { ...montaje, comprobacion }
}

const nodo = (raiz, selector) => raiz.querySelector(selector)
const texto = (raiz, selector) => nodo(raiz, selector).textContent

afterEach(() => {
  while (montados.length > 0) montados.pop()()
})

// ═════════════════════════════════════════════════════════════════════════════
// 1 · CONTRATOS DEL PROGRAMADOR
// ═════════════════════════════════════════════════════════════════════════════

describe('viewer/cajon-comprobacion.js · contratos del programador', () => {
  it('LANZA sin un mapa usable', () => {
    expect(() => crearCajonComprobacion({})).toThrow(TypeError)
    expect(() => crearCajonComprobacion({ mapa: {} })).toThrow(/addControl/)
  })

  it('LANZA con una esquina que no es de Leaflet', () => {
    const { mapa, destruir } = montarMapa({ centro: [40.46, -3.71], zoom: 19 })
    expect(() => crearCajonComprobacion({ mapa, posicion: 'centro' })).toThrow(RangeError)
    expect(() => crearCajonComprobacion({ mapa, posicion: 42 })).toThrow(TypeError)
    destruir()
  })

  it('LANZA con un `alAvisar` que no es función, aunque el canal no se use', () => {
    // Patrón obligatorio del visor: el canal se RESUELVE —y por tanto se valida—
    // aunque esta vista no tenga hoy nada que avisar. Quien pase basura donde va el
    // canal se entera aquí, y no tres módulos más allá.
    const { mapa, destruir } = montarMapa({ centro: [40.46, -3.71], zoom: 19 })
    expect(() => crearCajonComprobacion({ mapa, alAvisar: 'no' })).toThrow(TypeError)
    destruir()
  })

  it('la esquina por defecto es `bottomleft`, COMPARTIDA con el cajón de F07', () => {
    // Las cuatro esquinas del mapa ya estaban ocupadas cuando llegó F08: `topleft`
    // la barra de edición, `topright` el control de capas, `bottomright` el de
    // opacidad y la atribución, y `bottomleft` el cajón de diagnóstico. Se comparte
    // con ese último a propósito: los dos son mutuamente excluyentes por diseño.
    const { cajon } = conCajon()
    expect(cajon.control.getPosition()).toBe('bottomleft')
  })

  it('es un `L.Control` de verdad, no un div suelto sobre el mapa', () => {
    const { cajon } = conCajon()
    expect(cajon.control).toBeInstanceOf(L.Control)
  })

  it('los tres `al*` LANZAN si no reciben una función', () => {
    const { cajon } = conCajon()
    expect(() => cajon.alElegir('no')).toThrow(TypeError)
    expect(() => cajon.alContrastar(null)).toThrow(TypeError)
    expect(() => cajon.alDescartar(42)).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · EL CONTRATO DE NODOS CON EL CABLEADO
// ═════════════════════════════════════════════════════════════════════════════

describe('viewer/cajon-comprobacion.js · el contrato de nodos con el cableado', () => {
  it('produce TODOS los nodos de `SELECTOR`, también CERRADO y sin pintar', () => {
    // El cableado los localiza por selector y lanza si falta alguno. Si solo
    // existieran al pintar, ese `nodo()` lanzaría al arrancar la aplicación.
    const { cajon, raiz } = conCajon()
    expect(cajon.abierto()).toBe(false)
    for (const [nombre, selector] of Object.entries(SELECTOR)) {
      expect(nodo(raiz, selector), `falta el nodo ${nombre} (${selector})`).not.toBeNull()
    }
  })

  it('los dos botones son `<button type="button">`, uno de cada', () => {
    // `type="button"` SIEMPRE: un `<button>` sin tipo envía formularios, y el día
    // que el visor viva dentro de uno sería una recarga sin explicación.
    const { raiz } = conCajon()
    for (const selector of [SELECTOR.CONTRASTAR, SELECTOR.DESCARTAR]) {
      expect(raiz.querySelectorAll(selector)).toHaveLength(1)
      expect(nodo(raiz, selector).tagName).toBe('BUTTON')
      expect(nodo(raiz, selector).type).toBe('button')
    }
  })

  it('el renglón de estado es `role="status"`: anuncia sin robar el foco', () => {
    const { raiz, cajon } = conCajon()
    const estado = nodo(raiz, SELECTOR.ESTADO)
    expect(estado.getAttribute('role')).toBe('status')
    cajon.estado('Trayendo el parcelario del Catastro…')
    expect(estado.textContent).toBe('Trayendo el parcelario del Catastro…')
  })

  it('el renglón se llama `cajon-comprobacion`, NO `contrastar` (lección M8 de F07)', () => {
    // La convención de la app es que el renglón de una acción lleve el nombre de
    // esa acción, así que un `[data-estado="contrastar"]` aquí colisionaría con
    // cualquier renglón del pie que hiciera lo mismo — y `querySelector` se queda
    // con el PRIMERO del documento, dejando este cajón mudo y sin síntoma.
    const { raiz } = conCajon()
    expect(raiz.querySelectorAll('[data-estado="cajon-comprobacion"]')).toHaveLength(1)
    expect(raiz.querySelectorAll('[data-estado="contrastar"]')).toHaveLength(0)
    expect(raiz.querySelectorAll('[data-estado="comprobacion"]')).toHaveLength(0)
  })

  it('el botón primario apunta al renglón con `aria-describedby`', () => {
    // El motivo de un botón apagado se escribe en el renglón; si el botón no lo
    // señala, quien va por lector de pantalla oye «Contrastar, no disponible» y se
    // queda sin el porqué.
    const { raiz } = conCajon()
    const id = nodo(raiz, SELECTOR.CONTRASTAR).getAttribute('aria-describedby')
    expect(id).toBeTruthy()
    expect(nodo(raiz, SELECTOR.ESTADO).id).toBe(id)
  })

  it('las clases CSS están exportadas y TODAS aplicadas', () => {
    // La hoja de estilos de la aplicación (T3.3) se escribe contra estas clases:
    // son contrato. Se comprueban TODAS y no dos de muestra, por la misma razón por
    // la que el cajón de F07 lo hace: allí `CLASE` llegó a exportar una `OMISION`
    // que no llevaba ningún nodo — un gancho de CSS que no engancha nada, y que
    // invita a escribir la regla y a creer que se aplica.
    const { raiz, cajon } = conFichero(WFS)
    expect(cajon).toBeTruthy()
    expect(raiz.classList.contains(CLASE.CONTENEDOR)).toBe(true)
    for (const nombre of Object.values(CLASE)) {
      if (nombre === CLASE.CONTENEDOR) continue
      expect(raiz.querySelector(`.${nombre}`), `nadie lleva la clase .${nombre}`).not.toBeNull()
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · APERTURA, CIERRE Y LAS DOS SALIDAS
// ═════════════════════════════════════════════════════════════════════════════

describe('viewer/cajon-comprobacion.js · apertura, cierre y las dos salidas', () => {
  it('nace CERRADO: montarlo no comprueba nada', () => {
    const { cajon, raiz } = conCajon()
    expect(cajon.abierto()).toBe(false)
    expect(raiz.style.display).toBe('none')
  })

  it('nace con el botón primario APAGADO y con el motivo ya escrito', () => {
    // Aunque nadie lo vea todavía. La alternativa es un botón gris y mudo esperando
    // a que alguien abra el cajón antes de pintar nada, y eso es un error silencioso
    // por mucho que hoy el cableado no lo haga.
    const { cajon, raiz } = conCajon()
    expect(nodo(raiz, SELECTOR.CONTRASTAR).disabled).toBe(true)
    expect(cajon.puedeContrastar()).toBe(false)
    expect(texto(raiz, SELECTOR.ESTADO)).toMatch(/no se ha comprobado ningún fichero/i)
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

  it('un clic FUERA **no** lo cierra, al revés que el cajón de F07', () => {
    // Es la única desviación de comportamiento respecto del de diagnóstico, y es
    // deliberada: aquél es una anotación que se descarta y se vuelve a pedir con un
    // clic; éste es una bifurcación cuyas dos salidas son decisiones con
    // consecuencias. Un clic en el mapa para mirar dónde cae la parcela no puede
    // tirar a la basura el fichero recién cargado — eso es una pérdida silenciosa.
    const { cajon } = conCajon()
    cajon.abrir()
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cajon.abierto()).toBe(true)
  })

  it('`Escape` tampoco lo cierra, y por lo mismo', () => {
    const { cajon } = conCajon()
    cajon.abrir()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(cajon.abierto()).toBe(true)
  })

  it('«Descartar» lo CIERRA y avisa a `alDescartar`', () => {
    // Cierra por sí solo: un botón cuyo efecto dependiera de que el llamante se
    // acuerde de cerrar sería un botón muerto el día que se le olvide.
    const { cajon, raiz } = conFichero(EJEMPLO)
    const alDescartar = vi.fn()
    cajon.alDescartar(alDescartar)
    cajon.abrir()

    nodo(raiz, SELECTOR.DESCARTAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cajon.abierto()).toBe(false)
    expect(alDescartar).toHaveBeenCalledTimes(1)
  })

  it('«Contrastar» avisa y NO cierra: la espera del Catastro se cuenta aquí', () => {
    // Quien escucha va a pedirle el parcelario al Catastro, y el renglón de este
    // cajón es donde se cuenta esa espera y dónde acaba el aviso si la red falla.
    // Cerrarlo aquí dejaría la petición corriendo sin superficie donde informar.
    const { cajon, raiz } = conFichero(EJEMPLO)
    const alContrastar = vi.fn()
    cajon.alContrastar(alContrastar)
    cajon.abrir()

    nodo(raiz, SELECTOR.CONTRASTAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(alContrastar).toHaveBeenCalledTimes(1)
    expect(cajon.abierto()).toBe(true)
  })

  it('el clic de «Contrastar» NO se intercepta: el cajón de F07 sigue pudiendo cerrarse', () => {
    // `disableClickPropagation` NO detiene el `click`, así que este clic llega
    // burbujeando hasta `document` — y eso es lo que hace que el guardián de
    // clic-fuera del cajón de diagnóstico lo cierre solo en cuanto el usuario opera
    // en éste. Pararlo con `stopPropagation` rompería esa exclusión mutua y dejaría
    // sordo además al panel de ayuda de la barra de edición.
    const { cajon, raiz } = conFichero(EJEMPLO)
    cajon.abrir()

    const evento = new MouseEvent('click', { bubbles: true, cancelable: true })
    const stop = vi.spyOn(evento, 'stopPropagation')
    const visto = vi.fn()
    document.addEventListener('click', visto)

    nodo(raiz, SELECTOR.CONTRASTAR).dispatchEvent(evento)

    expect(visto).toHaveBeenCalledTimes(1)
    expect(stop).not.toHaveBeenCalled()
    expect(evento.defaultPrevented).toBe(false)
    document.removeEventListener('click', visto)
  })

  it('admite VARIOS oyentes y devuelve la BAJA', () => {
    // Un `= fn` desengancharía al primero en silencio, como aprendió F05 con
    // `alColindantes`.
    const { cajon, raiz } = conFichero(EJEMPLO)
    const a = vi.fn()
    const b = vi.fn()
    const baja = cajon.alContrastar(a)
    cajon.alContrastar(b)

    nodo(raiz, SELECTOR.CONTRASTAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)

    baja()
    nodo(raiz, SELECTOR.CONTRASTAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
  })

  it('pulsar dentro del cajón NO dispara el `click` del mapa (no elige lindero)', () => {
    // Sin `disableClickPropagation`, pulsar «Descartar» seleccionaría además un
    // lindero por debajo: el gesto de F06 sigue vivo con este cajón abierto.
    const { mapa, cajon, raiz } = conFichero(EJEMPLO)
    const clics = []
    mapa.on('click', () => clics.push(1))
    cajon.abrir()

    nodo(raiz, SELECTOR.CONTRASTAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clics).toHaveLength(0)
  })

  it('un `mousedown` dentro no llega al contenedor del mapa (no arrastra el mapa)', () => {
    const { mapa, cajon, raiz } = conFichero(EJEMPLO)
    const vistos = []
    mapa.getContainer().addEventListener('mousedown', () => vistos.push(1))
    cajon.abrir()

    nodo(raiz, SELECTOR.DESCARTAR).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    )
    expect(vistos).toHaveLength(0)
  })

  it('la rueda sobre la lista de notas no llega al contenedor del mapa (no hace zoom)', () => {
    // Con un GML ajeno la lista de notas puede ser larga y tiene scroll propio: sin
    // `disableScrollPropagation`, leerla haría zoom al mapa por debajo.
    const { mapa, cajon, raiz } = conFichero(WFS)
    const vistos = []
    mapa.getContainer().addEventListener('wheel', () => vistos.push(1))
    cajon.abrir()

    nodo(raiz, SELECTOR.NOTAS).dispatchEvent(new Event('wheel', { bubbles: true, cancelable: true }))
    expect(vistos).toHaveLength(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · UNA PARCELA — la plantilla oficial del Catastro
// ═════════════════════════════════════════════════════════════════════════════

describe('viewer/cajon-comprobacion.js · una parcela (cp_ejemplo_explicativo.gml)', () => {
  it('el titular dice QUÉ ES el fichero, con la etiqueta que trae la capa pura', () => {
    const { raiz, comprobacion } = conFichero(EJEMPLO)
    expect(comprobacion.dialecto.id).toBe('CP_4_0_ENTREGA')
    const titular = texto(raiz, SELECTOR.TITULAR)
    expect(titular).toMatch(/^Comprobación del fichero/)
    // La etiqueta viene REDACTADA de `comprobacion/_comun.js#etiquetaDialecto`: la
    // vista no tiene su propia tabla de traducciones, que es lo que se queda corto
    // en silencio el día que aparezca un dialecto nuevo.
    expect(titular).toContain(comprobacion.dialecto.etiqueta)
  })

  it('el rótulo del fichero trae nombre, tamaño y con qué se ha leído', () => {
    const { raiz } = conFichero(EJEMPLO)
    const linea = texto(raiz, SELECTOR.FICHERO)
    expect(linea).toContain(EJEMPLO)
    expect(linea).toContain('3,1 kB') // 3216 bytes
    expect(linea).toContain('utf-8')
  })

  it('la explicación del dialecto se pinta TAL CUAL, sin reescribirla', () => {
    const { raiz, comprobacion } = conFichero(EJEMPLO)
    expect(texto(raiz, SELECTOR.QUE_SIGNIFICA)).toBe(comprobacion.dialecto.queSignifica)
  })

  it('la declarada va SIN decimales forzados y la medida CON dos', () => {
    // El `cp:areaValue` es un entero (override O6) y sale «236»; la medida es lo
    // que la app calcula y sale con sus dos decimales. Igualar los formatos le
    // añadiría a la declarada una precisión que nadie ha afirmado y borraría una
    // diferencia que ES un dato — la misma pareja de criterios que el cajón de F07.
    const { raiz } = conFichero(EJEMPLO)
    expect(texto(raiz, SELECTOR.DECLARADA)).toBe('236 m²')
    expect(texto(raiz, SELECTOR.DECLARADA)).not.toMatch(/,\d/)
    expect(texto(raiz, SELECTOR.MEDIDA)).toBe('236,05 m²')
  })

  it('la superficie declarada se rotula como «del fichero», nunca como catastral', () => {
    // Son dos números distintos con el mismo nombre coloquial: en el diagnóstico de
    // F07 «catastral» es lo que declara el PARCELARIO; ésta es lo que declara ESTE
    // fichero sobre sus propias coordenadas. Llamarlas igual sería atribuirle al
    // Catastro el número de un tercero.
    const { raiz } = conFichero(EJEMPLO)
    expect(raiz.textContent).toContain('Superficie que declara el fichero')
    expect(raiz.textContent).toContain('Superficie medida sobre sus coordenadas')
    expect(raiz.textContent).not.toMatch(/Superficie catastral/i)
  })

  it('el sentido del contorno exterior se ROTULA, y nada más (C4, override O1)', () => {
    // La plantilla oficial del Catastro va ANTIHORARIA y es el fichero que ellos
    // publican como ejemplo: el sentido del anillo es una convención, no un
    // requisito, así que aquí se dice cuál trae y se acabó.
    const { raiz, comprobacion } = conFichero(EJEMPLO)
    expect(comprobacion.miembros[0].orientacionExterior).toBe(1)
    expect(texto(raiz, SELECTOR.ORIENTACION)).toBe('Antihorario')
  })

  it('…y el horario del WFS se rotula igual de neutro', () => {
    const { raiz, comprobacion } = conFichero(WFS)
    expect(comprobacion.miembros[0].orientacionExterior).toBe(-1)
    expect(texto(raiz, SELECTOR.ORIENTACION)).toBe('Horario')
  })

  it('con UNA sola parcela NO hay radios: un grupo de uno no es una elección', () => {
    const { raiz, cajon } = conFichero(EJEMPLO)
    expect(raiz.querySelectorAll(SELECTOR_MIEMBRO)).toHaveLength(0)
    // Pero sí se dice cuál se está comprobando, con sus vértices.
    expect(texto(raiz, SELECTOR.MIEMBROS)).toContain('8 vértices')
    // Y `elegido()` responde «cuál se comprueba», no «cuál ha marcado el usuario».
    expect(cajon.elegido()).toBe(0)
  })

  it('el botón primario nace ENCENDIDO y el renglón, vacío', () => {
    const { raiz, cajon } = conFichero(EJEMPLO)
    expect(nodo(raiz, SELECTOR.CONTRASTAR).disabled).toBe(false)
    expect(cajon.puedeContrastar()).toBe(true)
    expect(texto(raiz, SELECTOR.ESTADO)).toBe('')
  })

  it('el botón apagado SE VE apagado sin depender de ninguna hoja de estilos', () => {
    // Un estilo en línea no puede expresar `:disabled` y este módulo no escribe
    // reglas, así que el cambio se aplica a mano. Sin esto, el botón apagado se ve
    // idéntico al encendido mientras el CSS de la app no esté cargado —en jsdom, en
    // `npm run dev` sin estilos y en el guion de navegador antes de que llegue—, y
    // un control que parece pulsable y no lo es no se distingue de uno roto.
    const encendido = conFichero(EJEMPLO)
    const apagado = conFichero(EDIFICIO)
    const fondo = (m) => nodo(m.raiz, SELECTOR.CONTRASTAR).style.background
    expect(fondo(encendido)).not.toBe(fondo(apagado))
    expect(nodo(apagado.raiz, SELECTOR.CONTRASTAR).style.cursor).toBe('default')
    expect(nodo(encendido.raiz, SELECTOR.CONTRASTAR).style.cursor).toBe('pointer')
  })

  it('las notas se pintan con su SEVERIDAD delante, una por detección', () => {
    const { raiz, comprobacion } = conFichero(EJEMPLO)
    const filas = nodo(raiz, SELECTOR.NOTAS).querySelectorAll('li')
    expect(filas).toHaveLength(comprobacion.notas.length)
    expect(filas.length).toBeGreaterThan(0)
    for (const [i, li] of [...filas].entries()) {
      expect(li.textContent).toContain(comprobacion.notas[i].severidad)
      expect(li.textContent).toContain(comprobacion.notas[i].mensaje)
    }
  })

  it('sin detecciones de nivel ERROR se DICE, no se calla la sección', () => {
    const { raiz, comprobacion } = conFichero(EJEMPLO)
    expect(comprobacion.bloqueos).toHaveLength(0)
    expect(texto(raiz, SELECTOR.BLOQUEOS)).toContain('Ninguna detección de nivel ERROR')
  })

  it('los hallazgos de F02 salen en tabla, con su nivel y sus vértices', () => {
    const { raiz, comprobacion } = conFichero(EJEMPLO)
    expect(comprobacion.hallazgos.length).toBeGreaterThan(0)
    const filas = nodo(raiz, SELECTOR.HALLAZGOS).querySelectorAll('tbody tr')
    expect(filas).toHaveLength(comprobacion.hallazgos.length)
    expect(filas[0].textContent).toContain(comprobacion.hallazgos[0].nivel)
    expect(filas[0].textContent).toContain(comprobacion.hallazgos[0].mensaje)
    expect(filas[0].textContent).toContain('1 vértice')
  })

  it('pintar dos veces no duplica ni filas ni notas', () => {
    const { raiz, cajon, comprobacion } = conFichero(EJEMPLO)
    cajon.pintar(comprobacion)
    expect(nodo(raiz, SELECTOR.HALLAZGOS).querySelectorAll('tbody tr')).toHaveLength(
      comprobacion.hallazgos.length,
    )
    expect(nodo(raiz, SELECTOR.NOTAS).querySelectorAll('li')).toHaveLength(
      comprobacion.notas.length,
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · TRES PARCELAS — elegir UNA, nunca varias
// ═════════════════════════════════════════════════════════════════════════════

describe('viewer/cajon-comprobacion.js · tres parcelas (derivados/cp_multiparcela_entrega.gml)', () => {
  it('tres parcelas ⇒ TRES radios, con la primera marcada', () => {
    const { raiz, comprobacion } = conFichero(MULTI)
    expect(comprobacion.miembros).toHaveLength(3)
    const radios = [...raiz.querySelectorAll(SELECTOR_MIEMBRO)]
    expect(radios).toHaveLength(3)
    expect(radios.map((r) => r.checked)).toEqual([true, false, false])
    expect(radios.map((r) => r.value)).toEqual(['0', '1', '2'])
  })

  it('son RADIOS del mismo grupo: una elección, no varias', () => {
    // Un `checkbox` diría que se pueden comprobar dos a la vez, y aquí se elige UNA:
    // las demás se quedan en el fichero. ⚠️ No es que «multiparcela esté fuera de
    // alcance» —caducó el 2026-08-03, override O18—: es que se comprueba de una en una.
    const { raiz } = conFichero(MULTI)
    const radios = [...raiz.querySelectorAll(SELECTOR_MIEMBRO)]
    for (const r of radios) expect(r.type).toBe('radio')
    expect(new Set(radios.map((r) => r.name)).size).toBe(1)
  })

  it('cada radio lleva su etiqueta, sus vértices y su `<label for>` real', () => {
    const { raiz, comprobacion } = conFichero(MULTI)
    const radios = [...raiz.querySelectorAll(SELECTOR_MIEMBRO)]
    for (const [i, radio] of radios.entries()) {
      const rotulo = raiz.querySelector(`label[for="${radio.id}"]`)
      expect(rotulo, `la parcela ${i} no tiene <label for>`).not.toBeNull()
      // La identificación y la superficie ya vienen dentro de `etiqueta`, redactadas
      // por la capa pura; la vista solo le añade el recuento de nodos.
      expect(rotulo.textContent).toContain(comprobacion.miembros[i].etiqueta)
      expect(rotulo.textContent).toContain(`${comprobacion.miembros[i].nVertices} vértices`)
    }
  })

  it('ELEGIR EL SEGUNDO se refleja: avisa con el índice 1 y `elegido()` lo dice', () => {
    const { raiz, cajon } = conFichero(MULTI)
    const alElegir = vi.fn()
    cajon.alElegir(alElegir)

    const segundo = raiz.querySelectorAll(SELECTOR_MIEMBRO)[1]
    segundo.checked = true
    segundo.dispatchEvent(new Event('change', { bubbles: true }))

    expect(alElegir).toHaveBeenCalledTimes(1)
    expect(alElegir).toHaveBeenCalledWith(1)
    expect(cajon.elegido()).toBe(1)
  })

  it('y al repintar con esa elección, el segundo radio queda marcado y las cifras cambian', () => {
    // Es el ciclo completo que hará el cableado: el radio avisa, el llamante vuelve
    // a comprobar con `indiceElegido` y repinta. La vista no recalcula nada.
    const { raiz, cajon } = conFichero(MULTI)
    const segunda = comprobarFixture(MULTI, { indiceElegido: 1 })
    cajon.pintar(segunda)

    const radios = [...raiz.querySelectorAll(SELECTOR_MIEMBRO)]
    expect(radios.map((r) => r.checked)).toEqual([false, true, false])
    expect(cajon.elegido()).toBe(1)
    expect(texto(raiz, SELECTOR.DECLARADA)).toBe(
      `${segunda.miembros[1].superficieDeclarada} m²`.replace('.', ','),
    )
  })

  it('dos cajones en el mismo documento NO comparten grupo de radios', () => {
    // Con el mismo `name` serían UN solo grupo: marcar una parcela en el primer mapa
    // desmarcaría la del segundo. Por eso el nombre lleva el sello de Leaflet.
    const a = conFichero(MULTI)
    const b = conFichero(MULTI)
    const nombreA = a.raiz.querySelector(SELECTOR_MIEMBRO).name
    const nombreB = b.raiz.querySelector(SELECTOR_MIEMBRO).name
    expect(nombreA).not.toBe(nombreB)
  })

  it('se DICE que las otras se quedan en el fichero, que es lo que hay que saber', () => {
    const { raiz } = conFichero(MULTI)
    expect(texto(raiz, SELECTOR.MIEMBROS)).toContain('3 parcelas')
    expect(texto(raiz, SELECTOR.MIEMBROS)).toMatch(/se quedan\s+en el fichero/)
  })

  it('un `change` que no venga de un radio de parcela se ignora', () => {
    // El oyente está DELEGADO en el `<fieldset>` (los radios los fabrica `pintar` y
    // desaparecen al repintar), así que tiene que filtrar por `data-comp`.
    const { raiz, cajon } = conFichero(MULTI)
    const alElegir = vi.fn()
    cajon.alElegir(alElegir)

    const intruso = document.createElement('input')
    intruso.type = 'checkbox'
    nodo(raiz, SELECTOR.MIEMBROS).append(intruso)
    intruso.dispatchEvent(new Event('change', { bubbles: true }))

    expect(alElegir).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · EL GATE — un botón gris y mudo es un error silencioso
// ═════════════════════════════════════════════════════════════════════════════

describe('viewer/cajon-comprobacion.js · un GML de edificio detiene el recorrido, con motivo', () => {
  it('el botón primario está APAGADO', () => {
    const { raiz, cajon, comprobacion } = conFichero(EDIFICIO)
    expect(comprobacion.puedeContinuar).toBe(false)
    expect(nodo(raiz, SELECTOR.CONTRASTAR).disabled).toBe(true)
    expect(cajon.puedeContrastar()).toBe(false)
  })

  it('y el MOTIVO está escrito en el renglón, literal y sin recortar', () => {
    // Es la mitad que convierte un botón gris en una respuesta. El contrato de
    // `comprobacion/gml.js` garantiza que ese motivo no puede ser `null` ni vacío
    // cuando `puedeContinuar` es `false`, y aquí se aprovecha.
    const { raiz, comprobacion } = conFichero(EDIFICIO)
    expect(comprobacion.motivoNoContinua).toBeTruthy()
    expect(texto(raiz, SELECTOR.ESTADO)).toBe(comprobacion.motivoNoContinua)
    expect(texto(raiz, SELECTOR.ESTADO)).toMatch(/CONSTRUCCIÓN/)
  })

  it('no hay parcelas, y eso también se dice en vez de dejar la lista en blanco', () => {
    const { raiz, comprobacion } = conFichero(EDIFICIO)
    expect(comprobacion.miembros).toHaveLength(0)
    expect(raiz.querySelectorAll(SELECTOR_MIEMBRO)).toHaveLength(0)
    expect(texto(raiz, SELECTOR.MIEMBROS)).toContain('no trae ninguna parcela')
  })

  it('`hallazgos: null` se escribe «no se ha mirado», nunca «no hay nada»', () => {
    // El error silencioso más caro que esta sección podría cometer: una tabla vacía
    // se lee como «se revisó y salió limpio», y aquí la verdad es que no se revisó
    // nada porque no había geometría. Es la misma disciplina que «no se ha
    // consultado» ≠ «no hay invasión» en el cajón de F07.
    const { raiz, comprobacion } = conFichero(EDIFICIO)
    expect(comprobacion.hallazgos).toBeNull()
    const nota = texto(raiz, SELECTOR.HALLAZGOS_NOTA)
    expect(nota).toContain('No se ha revisado ninguna geometría')
    expect(nota).toContain('no se ha mirado')
    expect(nodo(raiz, SELECTOR.HALLAZGOS).querySelectorAll('tr')).toHaveLength(0)
  })

  it('las cifras de la parcela salen «No consta», no en blanco ni a cero', () => {
    const { raiz } = conFichero(EDIFICIO)
    for (const selector of [
      SELECTOR.DECLARADA,
      SELECTOR.MEDIDA,
      SELECTOR.VERTICES,
      SELECTOR.SRS,
      SELECTOR.ORIENTACION,
    ]) {
      expect(texto(raiz, selector)).toBe('No consta')
    }
  })
})

describe('viewer/cajon-comprobacion.js · SRS no soportado: hay parcela y aun así se para', () => {
  it('el botón está apagado con su motivo, pero las cifras del fichero SÍ se enseñan', () => {
    // El usuario tiene derecho al diagnóstico de su fichero aunque la aplicación se
    // pare después: un 4326 no se puede situar, pero su superficie y sus vértices se
    // pueden mirar.
    const { raiz, comprobacion } = conFichero(SRS_MALO)
    expect(comprobacion.puedeContinuar).toBe(false)
    expect(comprobacion.miembros).toHaveLength(1)
    expect(nodo(raiz, SELECTOR.CONTRASTAR).disabled).toBe(true)
    expect(texto(raiz, SELECTOR.ESTADO)).toBe(comprobacion.motivoNoContinua)
    expect(texto(raiz, SELECTOR.MEDIDA)).toMatch(/m²$/)
  })

  it('el sistema de referencia sale «No consta», que no es lo mismo que vacío', () => {
    const { raiz, comprobacion } = conFichero(SRS_MALO)
    expect(comprobacion.miembros[0].srs).toBeNull()
    expect(texto(raiz, SELECTOR.SRS)).toBe('No consta')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · EL CP 3.0 — un ERROR en el fichero NO apaga el recorrido
// ═════════════════════════════════════════════════════════════════════════════

describe('viewer/cajon-comprobacion.js · el CP 3.0 (UTM_1.gml) sigue adelante', () => {
  it('el botón está ENCENDIDO pese a `soportado: false`', () => {
    // El valor de esta aplicación con un fichero de 2015 delante es «tu GML es de la
    // versión que la Sede ya no admite, aquí está tu parcela». Apagar el botón
    // mataría ese recorrido entero.
    const { raiz, cajon, comprobacion } = conFichero(TRESCERO)
    expect(comprobacion.dialecto.soportado).toBe(false)
    expect(comprobacion.puedeContinuar).toBe(true)
    expect(nodo(raiz, SELECTOR.CONTRASTAR).disabled).toBe(false)
    expect(cajon.puedeContrastar()).toBe(true)
    expect(texto(raiz, SELECTOR.ESTADO)).toBe('')
  })

  it('…y con una detección de nivel ERROR pintada en su sección', () => {
    // `bloqueos` NO es lo contrario de `puedeContinuar`, y éste es el caso REAL que
    // lo demuestra: hay un `DIALECTO_RECHAZADO` de nivel ERROR y el recorrido sigue.
    const { raiz, comprobacion } = conFichero(TRESCERO)
    expect(comprobacion.bloqueos.length).toBeGreaterThan(0)
    const filas = nodo(raiz, SELECTOR.BLOQUEOS).querySelectorAll('li')
    expect(filas).toHaveLength(comprobacion.bloqueos.length)
    expect(filas[0].textContent).toContain('ERROR')
  })

  it('la sección de ERROR dice que ERROR es una severidad, no una puerta cerrada', () => {
    // Sin esta frase, una lista titulada «ERROR» con el botón primario encendido al
    // lado se lee como una contradicción — o peor, como un veredicto.
    const { raiz } = conFichero(TRESCERO)
    const seccion = texto(raiz, SELECTOR.BLOQUEOS)
    expect(seccion).toContain('severidad de la detección')
    expect(seccion).toContain('lo dice el botón')
  })

  it('`hallazgos: []` se escribe «se ha revisado y no hay nada», distinto de `null`', () => {
    const { raiz, comprobacion } = conFichero(TRESCERO)
    expect(comprobacion.hallazgos).toEqual([])
    const nota = texto(raiz, SELECTOR.HALLAZGOS_NOTA)
    expect(nota).toContain('revisión completa')
    expect(nota).toContain('no ha salido nada que contar')
    expect(nota).not.toContain('No se ha revisado')
  })

  it('la referencia catastral vacía no se disfraza de referencia', () => {
    // MEDIDO en T2.1: en este fichero y en la plantilla oficial `refcat` es `''`, no
    // `null` — el elemento está y viene vacío. La capa pura ya lo rotula «sin
    // identificación» o por el identificador local, y la vista NO se inventa otra.
    const { raiz, comprobacion } = conFichero(TRESCERO)
    expect(comprobacion.miembros[0].refcat).toBe('')
    expect(texto(raiz, SELECTOR.MIEMBROS)).toContain(comprobacion.miembros[0].etiqueta)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · `pintar(null)` Y DESMONTAJE
// ═════════════════════════════════════════════════════════════════════════════

describe('viewer/cajon-comprobacion.js · `pintar(null)` y desmontaje', () => {
  it('`pintar(null)` deja el cajón en blanco, ABIERTO, y con el botón apagado', () => {
    // Sin fichero no hay nada que contrastar: dejar el botón como estaba sería
    // ofrecer una acción que no tiene sobre qué actuar.
    const { raiz, cajon } = conFichero(EJEMPLO)
    cajon.abrir()
    cajon.pintar(null)

    expect(cajon.abierto()).toBe(true)
    expect(texto(raiz, SELECTOR.TITULAR)).toBe('Sin fichero comprobado.')
    expect(texto(raiz, SELECTOR.DECLARADA)).toBe('No consta')
    expect(raiz.querySelectorAll(SELECTOR_MIEMBRO)).toHaveLength(0)
    expect(nodo(raiz, SELECTOR.HALLAZGOS).children).toHaveLength(0)
    expect(nodo(raiz, SELECTOR.CONTRASTAR).disabled).toBe(true)
    expect(texto(raiz, SELECTOR.ESTADO)).toMatch(/no se ha comprobado ningún fichero/i)
    expect(cajon.elegido()).toBeNull()
  })

  it('`destruir()` deja el mapa EXACTAMENTE como estaba, y es idempotente', () => {
    const { mapa, contenedor, destruir } = montarMapa({ centro: [40.46, -3.71], zoom: 19 })
    const esquina = contenedor.querySelector('.leaflet-bottom.leaflet-left')
    const antes = esquina.children.length

    const cajon = crearCajonComprobacion({ mapa })
    const raiz = cajon.control.getContainer()
    cajon.pintar(comprobarFixture(WFS))
    cajon.abrir()
    expect(esquina.children.length).toBe(antes + 1)

    cajon.destruir()
    expect(raiz.parentNode).toBeNull()
    expect(esquina.children.length).toBe(antes)
    expect(cajon.abierto()).toBe(false)
    expect(() => cajon.destruir()).not.toThrow()
    destruir()
  })

  it('después de `destruir()`, la API queda inerte y no revienta', () => {
    const { cajon } = conCajon()
    const comprobacion = comprobarFixture(EJEMPLO)
    cajon.destruir()
    expect(() => cajon.pintar(comprobacion)).not.toThrow()
    expect(() => cajon.abrir()).not.toThrow()
    expect(() => cajon.cerrar()).not.toThrow()
    expect(() => cajon.estado('x')).not.toThrow()
    expect(cajon.abierto()).toBe(false)
    expect(cajon.elegido()).toBeNull()
    expect(cajon.puedeContrastar()).toBe(false)
  })

  it('los oyentes se sueltan al destruir: pulsar un botón huérfano no avisa a nadie', () => {
    const { cajon, raiz } = conFichero(MULTI)
    const fn = vi.fn()
    cajon.alContrastar(fn)
    cajon.alDescartar(fn)
    cajon.alElegir(fn)

    cajon.destruir()

    nodo(raiz, SELECTOR.CONTRASTAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    nodo(raiz, SELECTOR.DESCARTAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    raiz.querySelector(SELECTOR_MIEMBRO).dispatchEvent(new Event('change', { bubbles: true }))
    expect(fn).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · NO JUZGA (regla de oro 9)
// ═════════════════════════════════════════════════════════════════════════════

describe('viewer/cajon-comprobacion.js · NO juzga (regla de oro 9)', () => {
  /**
   * Vocabulario de mérito. Es el mismo patrón que el guardián del cajón de F07,
   * palabra por palabra: dos guardianes que dijeran cosas distintas dejarían pasar
   * por un lado lo que el otro prohíbe.
   */
  const VEREDICTOS =
    /\b(apta|apto|válida|valida|válido|correcta|correcto|conforme|aprobad|suspend|admisible|aceptable|dentro de tolerancia|fuera de tolerancia|no válid)/i

  /**
   * Todo el texto que este cajón NO escribe: lo redactan capas de abajo y llega
   * literal, porque reescribirlo sería inventarse una traducción que se queda corta
   * en silencio (regla de oro 1).
   */
  const textoAjeno = (c) =>
    [
      c.dialecto.etiqueta,
      c.dialecto.queSignifica,
      c.fichero.nombre,
      c.motivoNoContinua ?? '',
      ...c.miembros.map((m) => m.etiqueta),
      ...c.notas.map((d) => d.mensaje),
      ...c.bloqueos.map((d) => d.mensaje),
      ...(c.hallazgos ?? []).flatMap((h) => [h.mensaje, h.correccion ?? '']),
    ].filter((t) => t.length > 0)

  /** El DOM pintado MENOS todo lo que atraviesa: o sea, lo que escribe este módulo. */
  function vocabularioPropio(raiz, c) {
    let resto = raiz.textContent
    // De más largo a más corto: un fragmento corto podría estar contenido en uno
    // largo y dejarlo partido en trozos que ya no casarían.
    for (const ajeno of textoAjeno(c).sort((a, b) => b.length - a.length)) {
      resto = resto.split(ajeno).join(' ')
    }
    return resto
  }

  it.each(TODOS)('el vocabulario PROPIO del cajón está limpio con %s', (fichero) => {
    const { raiz, comprobacion } = conFichero(fichero)
    const propio = vocabularioPropio(raiz, comprobacion)
    // Anti-vacuidad: si el despojado se hubiera llevado el texto entero, este
    // guardián estaría examinando una cadena vacía y pasaría siempre.
    expect(propio.replace(/\s+/g, ' ').trim().length).toBeGreaterThan(200)
    expect(propio).not.toMatch(VEREDICTOS)
  })

  it('el despojado FUNCIONA: si se cuela una palabra de mérito propia, salta', () => {
    // Un guardián que nunca se ha visto fallar no es un guardián. Se ensucia el DOM
    // con texto que NO está en la comprobación —o sea, texto «del módulo»— y se
    // exige que el mismo recorrido lo cace.
    const { raiz, comprobacion } = conFichero(EJEMPLO)
    const intruso = document.createElement('p')
    intruso.textContent = 'La parcela es correcta y apta para presentar.'
    raiz.append(intruso)
    expect(vocabularioPropio(raiz, comprobacion)).toMatch(VEREDICTOS)
  })

  it('el texto que ATRAVIESA sí puede traer esas palabras, y es legítimo', () => {
    // Documenta —y fija— el paso a través que el guardián tiene que respetar:
    // `comprobacion/gml.js` escribe «la validación completa» y `gml/decodificar.js`
    // «El texto es correcto; lo que está mal es la etiqueta» (habla de BYTES). Los
    // dos son ciertos y se imprimen literales por la regla de oro 1. Un guardián
    // sobre el documento entero estaría rojo por esto, y un guardián que se apaga
    // para no molestar no protege de nada.
    const { raiz, comprobacion } = conFichero(WFS)
    expect(raiz.textContent).toMatch(VEREDICTOS)
    expect(textoAjeno(comprobacion).join(' ')).toMatch(VEREDICTOS)
    expect(vocabularioPropio(raiz, comprobacion)).not.toMatch(VEREDICTOS)
  })

  it.each(TODOS)('ninguna clase CSS de mérito con %s', (fichero) => {
    // Una clase `--ok` o `--error` es una invitación escrita a pintar de rojo el
    // fichero de otro técnico. Las nueve clases de este módulo son estructurales.
    const { raiz } = conFichero(fichero)
    const MERITO = /(^|[-_])(ok|exito|éxito|error|valido|válido|correcto|apto|bien|mal)([-_]|$)/i
    for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
      for (const clase of el.classList) {
        expect(clase, `clase de mérito: ${clase}`).not.toMatch(MERITO)
      }
    }
  })

  it('las clases que este módulo pone son EXACTAMENTE las nueve exportadas', () => {
    // Deriva del DOM real, no de una lista escrita a mano: una clase que se colara
    // sin pasar por `CLASE` no la vería la hoja de estilos de T3.3 ni este guardián.
    // Se descuentan las de Leaflet (`leaflet-control` se la pone él al contenedor de
    // todo control), que no son de este módulo y no las puede quitar.
    const { raiz } = conFichero(MULTI)
    const puestas = new Set()
    for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
      for (const clase of el.classList) {
        if (!clase.startsWith('leaflet-')) puestas.add(clase)
      }
    }
    expect([...puestas].sort()).toEqual([...Object.values(CLASE)].sort())
  })

  it.each(TODOS)('ninguna cifra ni ningún texto lleva color de mérito con %s', (fichero) => {
    // Ni verde ni rojo, y tampoco el ÁMBAR de F07: su única excepción autorizada es
    // la invasión a colindante, y esa es del diagnóstico. Aquí todo va en el gris del
    // cromo del visor.
    const { raiz } = conFichero(fichero)
    const PROHIBIDOS = /#(16a34a|22c55e|dc2626|ef4444|15803d|b91c1c|92400e)/i
    const AMBAR = 'rgb(146, 64, 14)'
    for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
      expect(el.getAttribute('style') || '').not.toMatch(PROHIBIDOS)
      expect(el.style.color).not.toBe(AMBAR)
    }
  })

  it('el titular no dictamina ni con el fichero más desastroso de los nueve', () => {
    const { raiz } = conFichero(SRS_MALO)
    expect(texto(raiz, SELECTOR.TITULAR)).toMatch(/^Comprobación del fichero/)
    expect(texto(raiz, SELECTOR.TITULAR)).not.toMatch(VEREDICTOS)
  })

  it('la severidad se pinta como severidad: en texto, sin color y sin adjetivo', () => {
    const { raiz, comprobacion } = conFichero(TRESCERO)
    const primera = nodo(raiz, SELECTOR.NOTAS).querySelector('li span')
    expect(['INFO', 'AVISO', 'ERROR']).toContain(primera.textContent)
    expect(primera.textContent).toBe(comprobacion.notas[0].severidad)
    expect(primera.style.color).toBe('rgb(100, 116, 139)') // #64748B, el gris del cromo
  })
})

// ── La familia tipográfica la pone la HOJA, no el módulo ─────────────────────
//
// Defecto REAL, medido con `getComputedStyle` en navegador por
// `scripts/smoke-navegador/10-comprobar-gml.js` el 2026-07-30: los botones de los
// dos cajones salían en `system-ui` mientras el resto del cajón iba en Geist.
// Causa: llevaban `font: 'inherit'` EN LÍNEA, que hereda el `font` en línea del
// contenedor (`13px/1.45 system-ui`) y, por ser inline, GANA a la hoja. La regla
// `.gml-cajon-comprobacion button` de `estilos/app.css` estaba escrita, puesta…
// y era código muerto. En jsdom no se ve, porque aquí no hay cascada de hoja
// externa: por eso este guardián no mira el color resultante sino la CAUSA, que es
// lo único observable desde aquí.
//
// Es la lección de SPEC §3.1 aplicada a una hoja de estilos: una protección que no
// llega a ejecutarse no protege, y parecía escrita.

describe('viewer/cajon-comprobacion · ningún botón fija la tipografía en línea', () => {
  it('los dos botones del pie no llevan `font` ni `font-family` en su atributo style', () => {
    const { mapa, destruir } = montarMapa({ centro: [40.46, -3.71], zoom: 19 })
    const cajon = crearCajonComprobacion({ mapa })
    try {
      const raiz = mapa.getContainer().querySelector('.gml-cajon-comprobacion')
      const botones = [...raiz.querySelectorAll('button')]
      expect(botones.length, 'el pie tiene que traer sus dos botones').toBe(2)

      for (const boton of botones) {
        const rotulo = boton.textContent.trim()
        // Se mira `fontFamily` y NO el atajo `font`, y eso está medido: jsdom
        // SERIALIZA el atajo a partir de las propiedades sueltas, así que
        // `style.font` devuelve aquí `'600 inherit'` y nunca sería `''`. La
        // propiedad suelta, en cambio, caza las dos formas del defecto: quien
        // escriba `style.font = 'inherit'` deja `fontFamily` en `'inherit'`, y
        // quien escriba la familia a mano la deja con su valor. Cualquiera de las
        // dos vuelve a matar la regla de `estilos/app.css`.
        expect(
          boton.style.fontFamily,
          `«${rotulo}» fija la familia en línea: la regla de estilos/app.css queda muerta`,
        ).toBe('')
        // …y lo que el módulo SÍ debe seguir poniendo, para que el botón sea
        // legible sin ninguna hoja. Sin esto el guardián se cumpliría borrándolo
        // todo, que no es el arreglo.
        expect(boton.style.fontSize, `«${rotulo}» ha perdido el tamaño en línea`).toBe('inherit')
        expect(boton.style.padding, `«${rotulo}» ha perdido el relleno en línea`).not.toBe('')
      }
    } finally {
      cajon.destruir()
      destruir()
    }
  })
})
