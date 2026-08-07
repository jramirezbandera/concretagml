/* -------------------------------------------------------------------------- *
 * test/app/panel-edificio.dom.test.js — F11 · T2.5                            *
 *                                                                            *
 * `app/panel-edificio.js` es la cara de la SEGUNDA rama de esta aplicación, y *
 * casi todo lo que puede salir mal en ella es invisible desde dentro:         *
 *                                                                            *
 *   · ⛔ un `data-*` repetido con los de `index.html`: `querySelector` se queda *
 *     con el nodo de PARCELA **aunque esté oculto** (medido, T0.3·6), así que  *
 *     el cableado de edificio escribiría en un campo de la otra rama y el      *
 *     usuario vería el suyo vacío. Este fichero recorre `index.html` DE VERDAD *
 *     —lo lee del disco— en vez de suponer qué hay dentro;                     *
 *   · el criterio de aceptación 1 «cumplido» con un `hidden` en vez de con la  *
 *     ausencia del bloque, que es lo que la desviación 12 promete;             *
 *   · una frase que se lea como un veredicto (regla de oro 9), que es el       *
 *     bloqueante heredado del 8.1, el 9.4, el 10.5 y el 11.x;                  *
 *   · un `replaceChildren` que deja un nodo del contrato huérfano, escribible  *
 *     y MUDO (riesgo 1, medido en T0.3·5);                                     *
 *   · y un año con letras que llega a `crearEdificio` y LANZA dentro de un     *
 *     `click`.                                                                *
 *                                                                            *
 * ── LO QUE JSDOM NO DA DE `<dialog>` ──────────────────────────────────────── *
 * Medido en F09 y sigue igual: `HTMLDialogElement` existe y su prototipo tiene *
 * EXACTAMENTE `constructor` y `open`. Ni `showModal()`, ni `close()`, ni       *
 * `cancel`, ni `::backdrop`, ni atrape de foco. Por eso el módulo detecta la   *
 * capacidad y cae al atributo `open`, e implementa él mismo `Escape` y la      *
 * devolución del foco — y por eso aquí se prueban esas dos cosas a mano.       *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ACCION,
  APUNTE_MODELO,
  AYUDA_PLANTAS,
  AYUDA_RENOMBRAR,
  CAMPO_ATRIBUTO,
  CLASE,
  CLASE_REUTILIZADA,
  DIALOGO,
  INTRO_ATRIBUTOS,
  INTRO_CAPAS,
  MENSAJE_OYENTE_ROTO,
  MOTIVO_CIERRE,
  MOTIVO_SIN_CAPAS,
  MOTIVO_SIN_REFCAT,
  PENDIENTE_DE_DIBUJAR,
  ROTULO_ESTADO_CONSERVACION,
  ROTULO_MODELO,
  ROTULO_TIPO_PARTE,
  SELECTOR,
  SELECTOR_COMPLETO,
  SELECTOR_PRINCIPAL,
  SIN_DATOS,
  SIN_MEDIDA,
  SIN_PARTES,
  SIN_PARTE_ACTIVA,
  TITULO_ATRIBUTOS,
  TITULO_CAPAS,
  TITULO_ORIGEN,
  TITULO_PARTES,
  crearPanelEdificio,
  motivoNoNumerico,
  selectorCapa,
  selectorParte,
} from '../../app/panel-edificio.js'
import { PASOS } from '../../app/navegacion.js'
import { ROTULO_ATRIBUTO } from '../../edificio/mutaciones.js'
import {
  ATRIBUTOS_COMPLETO,
  ESTADO_CONSERVACION,
  MODELO_EDIFICIO,
  TIPO_PARTE,
  crearEdificio,
} from '../../model/edificio.js'
import { NIVEL } from '../../viewer/_comun.js'

const RAIZ = join(import.meta.dirname, '..', '..')

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Un recinto de N vértices. Sirve para contar, que es lo único que el panel hace. */
const recinto = (n) => ({ vertices: Array.from({ length: n }, (_, i) => [i, i]), tipo: 'EXTERIOR' })

const parte = (nombre, n) => ({
  nombre,
  tipo: 'PRINCIPAL',
  recinto: n === null ? null : recinto(n),
  origen: 'DXF',
})

/**
 * El edificio con el que se prueba F12: una parte principal con plantas, una
 * piscina (`OTRA`, sin plantas por invariante del modelo) y una parte recién
 * añadida que todavía no tiene recinto. Los tres casos del bloque de parte
 * activa, en un solo fixture.
 */
const EDIFICIO_F12 = crearEdificio({
  refcat: '9398516VK3799G',
  partes: [
    {
      nombre: 'Cuerpo principal',
      tipo: TIPO_PARTE.PRINCIPAL,
      recinto: recinto(11),
      plantasSobreRasante: 2,
      plantasBajoRasante: 1,
      origen: 'WFS',
    },
    { nombre: 'Piscina', tipo: TIPO_PARTE.OTRA, recinto: recinto(5), origen: 'WFS' },
    { nombre: 'Parte 3', tipo: TIPO_PARTE.PRINCIPAL, recinto: null, origen: 'DIBUJADA' },
  ],
})

const EDIFICIO_SIMPLE = crearEdificio({
  refcat: '9398516VK3799G',
  modelo: MODELO_EDIFICIO.SIMPLIFICADO,
  partes: [parte('Parte 1', 11), parte('Porche', 5), parte('Piscina', null)],
})

const EDIFICIO_COMPLETO = crearEdificio({
  refcat: '9398516VK3799G',
  modelo: MODELO_EDIFICIO.COMPLETO,
  partes: [parte('Parte 1', 11)],
  usoDominante: '1_residential',
  estadoConservacion: ESTADO_CONSERVACION.FUNCIONAL,
  anioConstruccion: 1998,
  anioReforma: null,
  numeroInmuebles: 3,
  numeroViviendas: 2,
  superficieConstruida: 240.5,
})

/** El reparto medido de `UTM.dxf` (T0.2·3): 25 anillos en 5 capas. */
const CAPAS_UTM = [
  { nombre: 'FINO', anillos: 16 },
  { nombre: 'LINDE', anillos: 4 },
  { nombre: 'PARCELA', anillos: 3 },
  { nombre: 'BLANCO', anillos: 1 },
  { nombre: '0', anillos: 1 },
]

let panel
let avisos

beforeEach(() => {
  document.body.replaceChildren()
  document.body.className = 'gml-app'
  avisos = []
  panel = crearPanelEdificio({
    documento: document,
    alAvisar: (mensaje, opciones) => avisos.push({ mensaje, ...opciones }),
  })
  // Las secciones se montan a mano: `montar()` pide dos anclas y aquí se
  // fabrican, que es lo mismo que hará `app/main.js` con los bloques de parcela.
  const anclaOrigen = document.createElement('section')
  const anclaPartes = document.createElement('section')
  document.body.append(anclaOrigen, anclaPartes)
  panel.montar({ trasOrigen: anclaOrigen, trasPartes: anclaPartes })
})

afterEach(() => {
  panel?.destruir()
  document.body.replaceChildren()
  document.body.className = ''
})

/** Un nodo del contrato, exigiéndolo. Busca en TODO el documento a propósito. */
const nodo = (selector) => {
  const el = document.querySelector(selector)
  expect(el, `falta el nodo ${selector}`).not.toBeNull()
  return el
}

const todos = (selector) => [...document.querySelectorAll(selector)]

/** Todo el texto visible que este módulo escribe, más placeholders y aria-labels. */
function textosDelPanel() {
  const trozos = []
  for (const raiz of panel.raices()) {
    trozos.push(raiz.textContent ?? '')
    for (const el of raiz.querySelectorAll('[placeholder], [aria-label]')) {
      trozos.push(el.getAttribute('placeholder') ?? '', el.getAttribute('aria-label') ?? '')
    }
  }
  return trozos.join(' \n ')
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · El contrato de nodos
// ═════════════════════════════════════════════════════════════════════════════

describe('app/panel-edificio · el marcado que el cableado espera', () => {
  it('fabrica TRES secciones y UN `<dialog>`, y los monta en el documento', () => {
    // `index.html` no trae ninguno: mismo reparto que los diálogos de F09 y F10 y
    // que la zona de fichero de F08. La tercera es de F12 · T4.1.
    expect(panel.seccionOrigen.tagName).toBe('SECTION')
    expect(panel.seccionPartes.tagName).toBe('SECTION')
    expect(panel.seccionActiva.tagName).toBe('SECTION')
    expect(panel.dialogoCapas.tagName).toBe('DIALOG')
    for (const raiz of panel.raices()) expect(raiz.isConnected).toBe(true)
    // Sin atributos (nace SIMPLIFICADO) el único `<dialog>` es el de capas.
    expect(document.querySelectorAll('dialog').length).toBe(1)
  })

  it('`secciones()` son EXACTAMENTE las `<section>`, sin los `<dialog>`', () => {
    // Es lo que el cableado sella con `data-rama-panel`, y meter ahí un `<dialog>`
    // sería fabricar un `<dialog open hidden>` en la primera conmutación de rama:
    // un diálogo que se abre y no se ve.
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    expect(panel.secciones()).toEqual([
      panel.seccionOrigen,
      panel.seccionPartes,
      panel.seccionActiva,
      // F14 · la cuarta. Entra en la lista y por eso entra en el sellado sola, que
      // es literalmente la lección que T4.1 dejó escrita cuando la tercera se quedó
      // fuera y la suite siguió en verde.
      panel.seccionContraste,
    ])
    for (const seccion of panel.secciones()) expect(seccion.tagName).toBe('SECTION')
  })

  it('las CUATRO secciones llevan `.gml-bloque` y su modificador', () => {
    // `.gml-bloque` es lo que les da `flex:none`, `min-height:0` y el `padding`
    // del panel; sin él, el modificador solo no maqueta nada.
    expect(panel.seccionOrigen.className).toBe(`gml-bloque ${CLASE.BLOQUE}`)
    expect(panel.seccionPartes.className).toBe(`gml-bloque ${CLASE.BLOQUE_PARTES}`)
    expect(panel.seccionActiva.className).toBe(`gml-bloque ${CLASE.BLOQUE_ACTIVA}`)
    expect(panel.seccionContraste.className).toBe(`gml-bloque ${CLASE.BLOQUE_CONTRASTE}`)
  })

  it('⭐ F14 · la anfitriona del contraste nace VACÍA, y solo en Diagnóstico', () => {
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    // VACÍA: su contenido lo muda `viewer/cajon-contraste-edificio.js` desde la
    // esquina del mapa. Fabricar aquí sus nodos pondría un segundo
    // `[data-contraste="titular"]` en el documento y `querySelector` se quedaría
    // con el primero, dejando uno de los dos juegos mudo y sin síntoma.
    expect(panel.seccionContraste.children).toHaveLength(0)
    expect(panel.seccionContraste.getAttribute('data-anfitrion')).toBe('contraste-edificio')
    // Y en UNA sola pantalla: es el estirador de Diagnóstico, y dos estiradores a
    // la vez descosen el reparto del panel.
    expect(panel.seccionContraste.getAttribute('data-pantalla')).toBe('diagnostico')
    // Ninguna otra sección de esta rama declara esa pantalla, que es lo que lo
    // impide de verdad.
    for (const otra of [panel.seccionOrigen, panel.seccionPartes, panel.seccionActiva]) {
      expect(otra.getAttribute('data-pantalla').split(/\s+/)).not.toContain('diagnostico')
    }
  })

  it('⛔ F14 · la anfitriona NO escribe `data-rama-panel`: lo sella el cableado', () => {
    // El reparto de F11, y no se toca: `app/rama.js` DESCUBRE las secciones de
    // edificio por ese atributo y quien las fabrica no lo escribe. Ponerlo aquí
    // haría que este módulo tuviera opinión sobre un intercambio que no gobierna.
    expect(panel.seccionContraste.hasAttribute('data-rama-panel')).toBe(false)
  })

  it('TODOS los selectores de SELECTOR existen desde el primer momento', () => {
    // Antes de `fijar`, con el modelo recién nacido: es cuando el cableado los
    // busca, y `app/main.js` LANZA si falta uno.
    for (const selector of Object.values(SELECTOR)) nodo(selector)
  })

  it('⛔ los de SELECTOR_PRINCIPAL NO existen todavía: dependen de la parte activa', () => {
    // La otra mitad del contrato: si el cableado se agarrase a éstos en el
    // montaje se quedaría con una referencia a un nodo que va a morir la primera
    // vez que alguien elija una piscina.
    for (const selector of Object.values(SELECTOR_PRINCIPAL)) {
      expect(document.querySelector(selector), `${selector} no debería existir aún`).toBeNull()
    }
    expect(panel.plantasDisponibles()).toBe(false)
  })

  it('las tres secciones van en el orden del trabajo: origen → partes → parte activa', () => {
    // No es cosmética. `.gml-bloque--partes` es el estirador de esta rama y ocupa
    // el sitio de la caja de vértices, que va la última; y «la parte activa» solo
    // significa algo DEBAJO de la lista de la que se elige.
    const trasOrigen = panel.seccionOrigen.compareDocumentPosition(panel.seccionPartes)
    expect(trasOrigen & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const trasPartes = panel.seccionPartes.compareDocumentPosition(panel.seccionActiva)
    expect(trasPartes & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('`montar` LANZA si el ancla no está en el documento', () => {
    const otro = crearPanelEdificio({ documento: document })
    const suelto = document.createElement('section')
    expect(() => otro.montar({ trasOrigen: suelto, trasPartes: suelto })).toThrow(TypeError)
    otro.destruir()
  })

  it('no escribe ni un estilo en línea, y en particular ni un `font`', () => {
    // Lección MEDIDA de F08 (guion 10): un estilo en línea GANA a la hoja, así que
    // un `font: 'inherit'` de conveniencia deja muertas las reglas de
    // `estilos/app.css` sin que nada se queje, y en jsdom no hay cascada que lo
    // delate.
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    panel.fijarCapas(CAPAS_UTM)
    const conEstilo = []
    for (const raiz of panel.raices()) {
      if (raiz.getAttribute('style') !== null) conEstilo.push(raiz.tagName)
      for (const el of raiz.querySelectorAll('*')) {
        if (el.getAttribute('style') !== null) conEstilo.push(el.tagName)
      }
    }
    expect(conEstilo).toEqual([])
  })

  it('todas las clases que pinta están declaradas en CLASE o en CLASE_REUTILIZADA', () => {
    // Un guardián de cromo: una clase suelta escrita a mano no la vestiría nadie
    // —`estilos/app.css` se escribió CONTRA estos literales, sin ver este
    // fichero— y no se notaría hasta verlo en pantalla.
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    panel.fijarCapas(CAPAS_UTM)
    const declaradas = new Set([...Object.values(CLASE), ...CLASE_REUTILIZADA])
    const sueltas = new Set()
    for (const raiz of panel.raices()) {
      for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
        for (const clase of el.classList) if (!declaradas.has(clase)) sueltas.add(clase)
      }
    }
    expect([...sueltas]).toEqual([])
  })

  it('ninguna clase de CLASE lleva juicio de valor (regla de oro 9 en el gancho de CSS)', () => {
    // Ni `--ok`, ni `--error`, ni `--exito`, ni `--valido`. Mismo guardián que en
    // los dos diálogos anteriores.
    for (const clase of Object.values(CLASE)) {
      expect(clase).toMatch(/^gml-[a-z0-9-]+$/)
      expect(clase).not.toMatch(/ok|error|exito|valido|correct|malo|bueno|alerta|peligro/i)
    }
  })

  it('`destruir` es idempotente y deja el documento como estaba', () => {
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    expect(document.querySelectorAll('dialog').length).toBe(2)
    panel.destruir()
    panel.destruir()
    expect(document.querySelectorAll('dialog').length).toBe(0)
    expect(document.querySelector(SELECTOR.REFCAT)).toBeNull()
    expect(document.querySelector(SELECTOR.LISTA_PARTES)).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · ⛔ Ningún `data-*` choca con los de la rama PARCELA
// ═════════════════════════════════════════════════════════════════════════════

describe('app/panel-edificio · los `data-*` no se pisan con los de index.html', () => {
  /**
   * Los `data-*` de `index.html`, leídos DEL FICHERO. No se copian a mano: una
   * lista escrita aquí envejecería sin que nadie lo notase, y es justo el fallo
   * que este bloque existe para impedir.
   */
  const HTML = readFileSync(join(RAIZ, 'index.html'), 'utf8')

  /** @returns {Set<string>} pares `atributo=valor` que declara `index.html`. */
  const deIndexHtml = () =>
    new Set((HTML.match(/data-[a-z-]+="[^"]*"/g) ?? []).map((s) => s.replace(/"/g, '')))

  /**
   * Los `data-*` que las dos ramas comparten A PROPÓSITO, y que por tanto quedan
   * fuera del guardián de choques.
   *
   * ⚠️ **La excepción no afloja la regla: la enuncia.** Lo que el contrato K.1
   * prohíbe es repetir un atributo que el cableado resuelve con `querySelector`
   * para quedarse con UN nodo — ahí manda el orden del documento y parcela va
   * primero, así que el nombre repetido deja muerta a una rama en silencio. Los
   * de esta lista no son de esa clase:
   *
   *   · `data-pantalla` es el eje PASO, y lo lee **el CSS con un selector que
   *     casa con TODOS** (`estilos/app.css:271-275`). Que las dos ramas usen el
   *     mismo vocabulario no es un choque: es el mecanismo. Una sección de
   *     edificio con un `data-pantalla` propio no se ocultaría nunca.
   *
   * Si algún día entra otro, que entre con su párrafo. Una lista de exclusión sin
   * motivos escritos es la manera de desactivar un guardián sin que se note.
   */
  const EJES_COMPARTIDOS = new Set(['data-pantalla'])

  /** @returns {Set<string>} los mismos pares, pero de este módulo. */
  function delPanel() {
    const pares = new Set()
    for (const raiz of panel.raices()) {
      for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
        for (const attr of el.attributes) {
          if (!attr.name.startsWith('data-')) continue
          if (EJES_COMPARTIDOS.has(attr.name)) continue
          pares.add(`${attr.name}=${attr.value}`)
        }
      }
    }
    return pares
  }

  it('index.html declara los `data-*` que este test cree que declara', () => {
    // Mitad anti-vacuidad: si el `match` dejara de encontrar nada, el test de
    // abajo pasaría siempre y no lo diría. Estos cinco están medidos a mano.
    const enHtml = deIndexHtml()
    expect(enHtml.size).toBeGreaterThan(20)
    for (const par of [
      'data-campo=refcat',
      'data-accion=cargar-catastro',
      'data-estado=cargar-catastro',
      'data-procedencia=parcela',
      'data-ficha=refcat',
    ]) {
      expect(enHtml, `index.html ya no declara ${par}`).toContain(par)
    }
  })

  it('⛔ ni uno solo de los `data-*` del panel de edificio existe ya en index.html', () => {
    // MEDIDO (T0.3·6): con las dos ramas en el DOM,
    // `querySelector('[data-campo="refcat"]')` devuelve SIEMPRE el de parcela,
    // también con su sección `hidden`, porque manda el orden del documento. Un
    // nombre repetido deja muerta a una de las dos ramas, en silencio.
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    panel.fijarCapas(CAPAS_UTM)
    const enHtml = deIndexHtml()
    const chocan = [...delPanel()].filter((par) => enHtml.has(par))
    expect(chocan).toEqual([])
  })

  it('⛔ las TRES secciones declaran `data-pantalla`, y con pasos que existen', () => {
    // El defecto M2, medido el 2026-08-06 y arreglado en T4.1: hasta ese día
    // NINGUNA sección de edificio lo declaraba, así que las tres se veían en los
    // cinco pasos —314,97 / 157,06 px IDÉNTICOS— y el rail encendía cinco
    // peldaños sobre una sola pantalla.
    //
    // ⚠️ Y la segunda mitad importa igual: un paso mal escrito no da un error,
    // da una sección que **no se ve en ninguna** de las cinco pantallas, porque
    // las cinco reglas de `estilos/app.css:271-275` la ocultarían todas. Es un
    // fallo silencioso de manual, así que se comprueba contra `PASOS`.
    for (const seccion of panel.secciones()) {
      const declarado = seccion.getAttribute('data-pantalla')
      expect(declarado, `${seccion.className} no declara data-pantalla`).toBeTruthy()
      for (const paso of declarado.split(/\s+/)) {
        expect(PASOS, `«${paso}» no es un paso del rail`).toContain(paso)
      }
    }
  })

  it('el eje PASO es el MISMO vocabulario que el de `index.html`, no uno paralelo', () => {
    // La otra cara de `EJES_COMPARTIDOS`: la excepción solo vale si las dos ramas
    // hablan de verdad el mismo idioma. Si un día alguien le pusiera a esta rama
    // pasos propios, el CSS de `index.html` no los conocería y el guardián de
    // choques —que ya no los mira— no diría nada.
    const enHtml = new Set(
      (HTML.match(/data-pantalla="[^"]*"/g) ?? []).flatMap((s) =>
        s.replace(/^data-pantalla="|"$/g, '').split(/\s+/),
      ),
    )
    expect(enHtml.size).toBeGreaterThan(2) // anti-vacuidad
    for (const seccion of panel.secciones()) {
      for (const paso of seccion.getAttribute('data-pantalla').split(/\s+/)) {
        expect(enHtml, `index.html no usa la pantalla «${paso}»`).toContain(paso)
      }
    }
  })

  it('la referencia catastral de esta rama se llama `refcat-edificio`, jamás `refcat`', () => {
    // El caso concreto que el contrato K.2 subraya, con su `it` propio: es el que
    // más caro sale, porque la RC recién traída del Catastro acabaría en el campo
    // invisible de la otra rama.
    expect(SELECTOR.REFCAT).toBe('[data-campo="refcat-edificio"]')
    expect(nodo(SELECTOR.REFCAT).dataset.campo).toBe('refcat-edificio')
    expect(todos('[data-campo="refcat"]')).toEqual([])
  })

  it('los siete atributos usan los `data-campo` del contrato, y en el orden del modelo', () => {
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    const enPantalla = todos(`${SELECTOR_COMPLETO.BLOQUE_ATRIBUTOS} [data-campo]`).map(
      (el) => el.dataset.campo,
    )
    expect(enPantalla).toEqual([
      'uso-dominante',
      'estado-conservacion',
      'anio-construccion',
      'anio-reforma',
      'numero-inmuebles',
      'numero-viviendas',
      'superficie-construida',
    ])
    // Y ese orden ES el de `ATRIBUTOS_COMPLETO` (`model/edificio.js:60-67`), no
    // una segunda lista escrita a mano que pueda divergir.
    expect(enPantalla).toEqual(ATRIBUTOS_COMPLETO.map((c) => CAMPO_ATRIBUTO[c]))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · ⭐ El criterio de aceptación 1, señalado con el dedo
// ═════════════════════════════════════════════════════════════════════════════

describe('app/panel-edificio · criterio 1: en SIMPLIFICADO los atributos NO EXISTEN', () => {
  it('nace en SIMPLIFICADO, y ni el bloque ni el botón están en el documento', () => {
    // La ficha pide «ocultar»; la desviación 12 hace algo más fuerte y
    // comprobable: no están ocultos, NO ESTÁN. `hidden` se puede quitar desde la
    // consola; lo que no existe, no.
    expect(panel.valores().modelo).toBe(MODELO_EDIFICIO.SIMPLIFICADO)
    expect(panel.atributosDisponibles()).toBe(false)
    for (const selector of Object.values(SELECTOR_COMPLETO)) {
      expect(document.querySelector(selector), `${selector} no debería existir`).toBeNull()
    }
    // Y no es que estén escondidos: ni uno de ellos vive dentro de algo con
    // `hidden`, porque no vive en ninguna parte.
    //
    // ⚠️ Aquí ponía `expect(todos('[hidden]')).toEqual([])`, o sea «no hay NI UN
    // nodo oculto en todo el panel». Decía más de lo que quería decir, y dejó de
    // ser cierto el 2026-08-04, cuando el panel pasó a enseñar **solo el apunte del
    // modelo elegido** y a ocultar el otro con `hidden` (ver `pintarModelo`, y los
    // 272,03 px que costaban los dos a la vez). Ese `hidden` no tiene nada que ver
    // con el criterio 1: la afirmación se acota a lo que el criterio dice.
    for (const oculto of todos('[hidden]')) {
      for (const selector of Object.values(SELECTOR_COMPLETO)) {
        expect(oculto.querySelector(selector), `${selector} escondido en un [hidden]`).toBeNull()
        expect(oculto.matches(selector)).toBe(false)
      }
    }
  })

  it('elegir COMPLETO los trae, y volver a SIMPLIFICADO los quita otra vez', () => {
    const radio = todos(SELECTOR.MODELO).find((r) => r.value === MODELO_EDIFICIO.COMPLETO)
    radio.checked = true
    radio.dispatchEvent(new Event('change', { bubbles: true }))

    expect(panel.atributosDisponibles()).toBe(true)
    for (const selector of Object.values(SELECTOR_COMPLETO)) nodo(selector)
    expect(todos(`${SELECTOR_COMPLETO.BLOQUE_ATRIBUTOS} [data-campo]`).length).toBe(7)

    const vuelta = todos(SELECTOR.MODELO).find((r) => r.value === MODELO_EDIFICIO.SIMPLIFICADO)
    vuelta.checked = true
    vuelta.dispatchEvent(new Event('change', { bubbles: true }))

    expect(panel.atributosDisponibles()).toBe(false)
    for (const selector of Object.values(SELECTOR_COMPLETO)) {
      expect(document.querySelector(selector)).toBeNull()
    }
    expect(document.querySelectorAll('dialog').length).toBe(1)
  })

  it('los radios llevan los valores de MODELO_EDIFICIO SIN TRADUCIR', () => {
    // Contrato K.2. El rótulo sí está en castellano; el `value` es el del modelo,
    // para que el cableado no tenga que traducir de vuelta.
    expect(todos(SELECTOR.MODELO).map((r) => r.value)).toEqual(Object.values(MODELO_EDIFICIO))
    expect(todos(SELECTOR.MODELO).map((r) => r.type)).toEqual(['radio', 'radio'])
  })

  it('los dos radios son EXCLUYENTES entre sí y no lo son con los de otro panel', () => {
    // El `name` lleva un sello incremental: dos paneles en el mismo documento con
    // el mismo `name` serían UN grupo, y elegir en uno desmarcaría el otro.
    const otro = crearPanelEdificio({ documento: document })
    const anclaA = document.createElement('section')
    const anclaB = document.createElement('section')
    document.body.append(anclaA, anclaB)
    otro.montar({ trasOrigen: anclaA, trasPartes: anclaB })

    const nombres = new Set(todos(SELECTOR.MODELO).map((r) => r.name))
    expect(nombres.size).toBe(2)
    otro.destruir()
  })

  it('`abrirAtributos()` en SIMPLIFICADO no hace nada y no lanza', () => {
    expect(() => panel.abrirAtributos()).not.toThrow()
    expect(panel.abiertoDialogo(DIALOGO.ATRIBUTOS)).toBe(false)
  })

  it('`fijar` con un edificio COMPLETO trae el bloque sin tocar ningún radio a mano', () => {
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    expect(panel.atributosDisponibles()).toBe(true)
    expect(todos(SELECTOR.MODELO).find((r) => r.checked).value).toBe(MODELO_EDIFICIO.COMPLETO)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · La referencia catastral y el selector de modelo
// ═════════════════════════════════════════════════════════════════════════════

describe('app/panel-edificio · la referencia catastral', () => {
  it('es monoespaciada y ⛔ NO lleva `maxlength`', () => {
    // Medido y razonado en `index.html:199-210`: el `maxlength="14"` recortaba lo
    // pegado ANTES de que nadie lo mirase, así que «9398516 VK3799G» —con el
    // espacio con el que la Sede imprime las referencias— perdía el último
    // carácter y recibía «no tiene forma de referencia catastral» por una
    // referencia correcta.
    const campo = nodo(SELECTOR.REFCAT)
    expect(campo.classList.contains('gml-mono')).toBe(true)
    expect(campo.classList.contains('gml-entrada')).toBe(true)
    expect(campo.hasAttribute('maxlength')).toBe(false)
    expect(campo.getAttribute('autocomplete')).toBe('off')
    expect(campo.getAttribute('spellcheck')).toBe('false')
  })

  it('acepta entera una referencia de INMUEBLE de 20 caracteres', () => {
    // El caso concreto que el `maxlength` rompía por accidente.
    const campo = nodo(SELECTOR.REFCAT)
    campo.value = '9398516VK3799G0001AB'
    expect(panel.valores().refcat).toBe('9398516VK3799G0001AB')
  })

  it('un repintado NO le borra al usuario la referencia a medio teclear', () => {
    nodo(SELECTOR.REFCAT).value = '93985'
    panel.fijar({ edificio: EDIFICIO_SIMPLE }) // sin `refcat` en la entrada
    expect(nodo(SELECTOR.REFCAT).value).toBe('93985')
    // Y con `refcat` explícito sí se escribe: es el camino del Catastro.
    panel.fijar({ edificio: EDIFICIO_SIMPLE, refcat: '9398516VK3799G' })
    expect(nodo(SELECTOR.REFCAT).value).toBe('9398516VK3799G')
  })

  it('«Traer del Catastro» se apaga CON EL MOTIVO ESCRITO, en el mismo paso', () => {
    // Regla de oro 1: botón apagado con motivo al lado, jamás botón gris y mudo.
    panel.fijar({ edificio: null, puedeConsultarCatastro: false })
    expect(nodo(SELECTOR.CARGAR_CATASTRO).disabled).toBe(true)
    expect(nodo(SELECTOR.ESTADO).textContent).toBe(MOTIVO_SIN_REFCAT)

    panel.fijar({ edificio: EDIFICIO_SIMPLE, puedeConsultarCatastro: true })
    expect(nodo(SELECTOR.CARGAR_CATASTRO).disabled).toBe(false)
    expect(nodo(SELECTOR.ESTADO).textContent).toBe('')
  })

  it('`fijar(null)` devuelve el renglón de estado a su texto de nacimiento', () => {
    panel.estado('cualquier cosa')
    panel.fijar(null)
    expect(nodo(SELECTOR.ESTADO).textContent).toBe(SIN_DATOS)
  })

  it('el renglón de procedencia es de fuera: aquí no se calcula ninguna edad', () => {
    expect(nodo(SELECTOR.PROCEDENCIA).textContent).toBe('')
    panel.procedencia('del Catastro · guardado hace 6 días')
    expect(nodo(SELECTOR.PROCEDENCIA).textContent).toBe('del Catastro · guardado hace 6 días')
  })

  it('cambiar de modelo emite la intención, para que el cableado pueda avisar antes', () => {
    // `conModelo` devuelve la detección MODELO_CAMBIADO con la lista de lo que se
    // pierde; quien la enseña es el cableado, y para eso necesita enterarse.
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    const radio = todos(SELECTOR.MODELO).find((r) => r.value === MODELO_EDIFICIO.COMPLETO)
    radio.checked = true
    radio.dispatchEvent(new Event('change', { bubbles: true }))
    expect(vistas.map((v) => v.accion)).toEqual([ACCION.CAMBIAR_MODELO])
    expect(vistas[0].valores.modelo).toBe(MODELO_EDIFICIO.COMPLETO)
  })

  it('elegir el modelo que ya estaba NO emite nada', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    const radio = todos(SELECTOR.MODELO).find((r) => r.value === MODELO_EDIFICIO.SIMPLIFICADO)
    radio.dispatchEvent(new Event('change', { bubbles: true }))
    expect(vistas).toEqual([])
  })

  it('`fijar` con un modelo inventado LANZA, y deja el panel como estaba', () => {
    // Misma barrera que `crearEdificio` y `conModelo`: un typo no puede degradar
    // en silencio al comportamiento SIMPLIFICADO, que omite los siete atributos.
    panel.fijar({ edificio: EDIFICIO_SIMPLE })
    const antes = nodo(SELECTOR.LISTA_PARTES).children.length
    expect(() => panel.fijar({ edificio: EDIFICIO_SIMPLE, modelo: 'SIMPLIFICADA' })).toThrow(
      RangeError,
    )
    expect(nodo(SELECTOR.LISTA_PARTES).children.length).toBe(antes)
    expect(panel.valores().modelo).toBe(MODELO_EDIFICIO.SIMPLIFICADO)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · La lista de partes
// ═════════════════════════════════════════════════════════════════════════════

describe('app/panel-edificio · la lista de partes', () => {
  it('vacía, dice QUÉ HACER con las cinco vías a la vista', () => {
    // El store nace vacío a propósito (contrato H: no se inventa un edificio de
    // demostración), así que esto es lo PRIMERO que se ve de esta rama y no puede
    // leerse como «esto no ha cargado».
    const vacio = nodo(`.${CLASE.PARTES_VACIO}`)
    expect(vacio.textContent).toBe(SIN_PARTES)
    for (const via of ['DXF', 'LIST', '.txt', 'GML', 'Catastro']) {
      expect(SIN_PARTES, `la vía ${via} no se nombra`).toContain(via)
    }
  })

  it('una parte por fila, con su índice y su recuento de vértices', () => {
    panel.fijar({ edificio: EDIFICIO_SIMPLE })
    const filas = todos(`${SELECTOR.LISTA_PARTES} .${CLASE.PARTE}`)
    expect(filas.length).toBe(3)
    expect(filas.map((f) => f.dataset.parteIndice)).toEqual(['0', '1', '2'])
    expect(filas.map((f) => f.querySelector(`.${CLASE.PARTE_NOMBRE}`).textContent)).toEqual([
      'Parte 1',
      'Porche',
      'Piscina',
    ])
    expect(filas.map((f) => f.querySelector(`.${CLASE.PARTE_DATO}`).textContent)).toEqual([
      '11 vértices',
      '5 vértices',
      // Una parte sin contorno se DICE: el modelo la admite («pendiente de
      // dibujar»), pero no se pinta en el mapa, y callarlo dejaría al usuario
      // contando partes que no ve.
      'sin contorno',
    ])
    expect(nodo(selectorParte(1)).querySelector(`.${CLASE.PARTE_NOMBRE}`).textContent).toBe('Porche')
  })

  it('la cuenta del rótulo concuerda con las filas, en singular y en plural', () => {
    const cuenta = () => panel.seccionPartes.querySelector('.gml-rotulo-fila span').textContent
    expect(cuenta()).toBe('0 partes')
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    expect(cuenta()).toBe('1 parte')
    panel.fijar({ edificio: EDIFICIO_SIMPLE })
    expect(cuenta()).toBe('3 partes')
  })

  it('⛔ el `<ul>` del contrato es SIEMPRE el mismo nodo: nunca se sustituye', () => {
    // Riesgo 1, medido (T0.3·5): con `replaceChildren` sobre la sección la
    // referencia del cableado queda huérfana, escribible y MUDA. Los 30 nodos de
    // `app/` se resuelven UNA vez en el montaje.
    const antes = nodo(SELECTOR.LISTA_PARTES)
    const refcatAntes = nodo(SELECTOR.REFCAT)
    const estadoAntes = nodo(SELECTOR.ESTADO)
    panel.fijar({ edificio: EDIFICIO_SIMPLE })
    panel.fijar(null)
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    expect(nodo(SELECTOR.LISTA_PARTES)).toBe(antes)
    expect(nodo(SELECTOR.REFCAT)).toBe(refcatAntes)
    expect(nodo(SELECTOR.ESTADO)).toBe(estadoAntes)
    expect(antes.isConnected).toBe(true)
  })

  it('«Renombrar» abre el editor con el foco dentro y el nombre seleccionado', () => {
    panel.fijar({ edificio: EDIFICIO_SIMPLE })
    nodo(selectorParte(1)).querySelector(`[data-accion="${ACCION.RENOMBRAR_PARTE}"]`).click()
    const entrada = nodo('[data-campo="nombre-parte"]')
    expect(entrada.value).toBe('Porche')
    expect(document.activeElement).toBe(entrada)
    // Y la ayuda se escribe: `Escape` no se descubre solo.
    expect(nodo(SELECTOR.ESTADO).textContent).toBe(AYUDA_RENOMBRAR)
  })

  it('Intro confirma el renombrado y lo emite; el editor se cierra', () => {
    const vistas = []
    panel.fijar({ edificio: EDIFICIO_SIMPLE })
    panel.alAccion((a) => vistas.push(a))
    nodo(selectorParte(1)).querySelector(`[data-accion="${ACCION.RENOMBRAR_PARTE}"]`).click()
    const entrada = nodo('[data-campo="nombre-parte"]')
    entrada.value = 'Porche cubierto'
    entrada.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(vistas).toHaveLength(1)
    expect(vistas[0].accion).toBe(ACCION.RENOMBRAR_PARTE)
    expect(vistas[0].indice).toBe(1)
    expect(vistas[0].nombre).toBe('Porche cubierto')
    expect(document.querySelector('[data-campo="nombre-parte"]')).toBeNull()
  })

  it('Escape cancela el renombrado y NO emite nada', () => {
    const vistas = []
    panel.fijar({ edificio: EDIFICIO_SIMPLE })
    panel.alAccion((a) => vistas.push(a))
    nodo(selectorParte(0)).querySelector(`[data-accion="${ACCION.RENOMBRAR_PARTE}"]`).click()
    const entrada = nodo('[data-campo="nombre-parte"]')
    entrada.value = 'lo que sea'
    entrada.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(vistas).toEqual([])
    expect(nodo(selectorParte(0)).querySelector(`.${CLASE.PARTE_NOMBRE}`).textContent).toBe('Parte 1')
  })

  it('un nombre EN BLANCO se emite igual: quien decide es `conParteRenombrada`', () => {
    // `crearParteConstruccion` LANZA con un nombre vacío (`model/edificio.js:137`),
    // y por eso `conParteRenombrada` conserva el anterior y devuelve una detección
    // `RENOMBRADO_IGNORADO`. Esta vista no puede tener una segunda opinión sobre
    // eso: filtrarlo aquí dejaría al usuario sin el aviso.
    const vistas = []
    panel.fijar({ edificio: EDIFICIO_SIMPLE })
    panel.alAccion((a) => vistas.push(a))
    nodo(selectorParte(0)).querySelector(`[data-accion="${ACCION.RENOMBRAR_PARTE}"]`).click()
    const entrada = nodo('[data-campo="nombre-parte"]')
    entrada.value = '   '
    entrada.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(vistas).toHaveLength(1)
    expect(vistas[0].nombre).toBe('   ')
  })

  it('el botón del editor confirma en el segundo clic, sin abrirlo dos veces', () => {
    const vistas = []
    panel.fijar({ edificio: EDIFICIO_SIMPLE })
    panel.alAccion((a) => vistas.push(a))
    const boton = () =>
      nodo(selectorParte(2)).querySelector(`[data-accion="${ACCION.RENOMBRAR_PARTE}"]`)
    boton().click()
    expect(boton().textContent).toBe('Guardar nombre')
    nodo('[data-campo="nombre-parte"]').value = 'Piscina descubierta'
    boton().click()
    expect(vistas.map((v) => v.nombre)).toEqual(['Piscina descubierta'])
  })

  it('un `fijar` mientras se renombra cierra el editor sin inventarse nada', () => {
    panel.fijar({ edificio: EDIFICIO_SIMPLE })
    nodo(selectorParte(0)).querySelector(`[data-accion="${ACCION.RENOMBRAR_PARTE}"]`).click()
    panel.fijar({ edificio: EDIFICIO_SIMPLE })
    expect(document.querySelector('[data-campo="nombre-parte"]')).toBeNull()
  })

  it('una parte sin nombre utilizable recibe uno genérico, y no una fila muda', () => {
    panel.fijar({ edificio: { partes: [{ nombre: '   ', recinto: null }] } })
    expect(nodo(`.${CLASE.PARTE_NOMBRE}`).textContent).toBe('Parte 1')
  })

  it('`fijar` con algo que no es un edificio LANZA (contrato del programador)', () => {
    expect(() => panel.fijar('9398516VK3799G')).toThrow(TypeError)
    expect(() => panel.fijar({ edificio: { partes: 'tres' } })).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · El diálogo de reparto por capas
// ═════════════════════════════════════════════════════════════════════════════

describe('app/panel-edificio · el diálogo de reparto por capas', () => {
  it('enseña el reparto con el NOMBRE LITERAL de cada capa y su recuento', () => {
    // El reparto medido de `UTM.dxf` (T0.2·3). Los nombres se enseñan tal cual
    // vienen del código de grupo 8, sin bajar a minúsculas: el usuario los coteja
    // contra lo que ve en su CAD.
    panel.fijarCapas(CAPAS_UTM)
    const filas = todos(`${SELECTOR.LISTA_CAPAS} [data-capa]`)
    expect(filas.map((f) => f.dataset.capa)).toEqual(['FINO', 'LINDE', 'PARCELA', 'BLANCO', '0'])
    expect(filas.map((f) => f.querySelector(`.${CLASE.CAPAS_NOMBRE}`).textContent)).toEqual([
      'FINO',
      'LINDE',
      'PARCELA',
      'BLANCO',
      '0',
    ])
    expect(filas.map((f) => f.querySelector(`.${CLASE.CAPAS_CUENTA}`).textContent)).toEqual([
      '16 polilíneas',
      '4 polilíneas',
      '3 polilíneas',
      '1 polilínea',
      '1 polilínea',
    ])
    expect(nodo(selectorCapa('PARCELA')).dataset.capa).toBe('PARCELA')
  })

  it('⛔ NINGUNA capa viene marcada, y «Aplicar» nace apagado con su motivo', () => {
    // Decisión 5, y ya no es prudencia: en `UTM.dxf` la parcela de verdad está en
    // la capa `0` y NO en la que se llama `PARCELA` (T0.2·2, 12 de 12 vértices
    // contra `PARCELA.txt`). Elegir por el nombre falla en el único plano real
    // que tiene este proyecto.
    panel.fijarCapas(CAPAS_UTM)
    expect(todos('[data-campo="capa-elegida"]').every((c) => c.checked === false)).toBe(true)
    expect(nodo(SELECTOR.APLICAR_CAPAS).disabled).toBe(true)
    expect(nodo(SELECTOR.ESTADO_CAPAS).textContent).toBe(MOTIVO_SIN_CAPAS)
  })

  it('marcar una capa enciende «Aplicar» y vacía el motivo, en el mismo paso', () => {
    panel.fijarCapas(CAPAS_UTM)
    const casilla = nodo(`${selectorCapa('0')} [data-campo="capa-elegida"]`)
    casilla.checked = true
    casilla.dispatchEvent(new Event('change', { bubbles: true }))
    expect(nodo(SELECTOR.APLICAR_CAPAS).disabled).toBe(false)
    expect(nodo(SELECTOR.ESTADO_CAPAS).textContent).toBe('')
    expect(panel.capasElegidas()).toEqual(['0'])
  })

  it('«Aplicar» emite las capas marcadas, con su literal', () => {
    const vistas = []
    panel.fijarCapas(CAPAS_UTM)
    panel.alAccion((a) => vistas.push(a))
    for (const nombre of ['LINDE', '0']) {
      const casilla = nodo(`${selectorCapa(nombre)} [data-campo="capa-elegida"]`)
      casilla.checked = true
      casilla.dispatchEvent(new Event('change', { bubbles: true }))
    }
    nodo(SELECTOR.APLICAR_CAPAS).click()
    expect(vistas).toHaveLength(1)
    expect(vistas[0].accion).toBe(ACCION.APLICAR_CAPAS)
    expect(vistas[0].capas).toEqual(['LINDE', '0'])
  })

  it('la capa SIN NOMBRE se dice con palabras, no con un hueco en blanco', () => {
    // `parseDXF` devuelve `''` cuando la entidad no traía código 8 (contrato A).
    // Un renglón vacío parecería un fallo de pintado.
    panel.fijarCapas([{ nombre: '', anillos: 2 }])
    expect(nodo(`.${CLASE.CAPAS_NOMBRE}`).textContent).toBe('Sin nombre de capa')
    expect(nodo(selectorCapa('')).dataset.capa).toBe('')
  })

  it('un nombre de capa con comillas no revienta `selectorCapa`', () => {
    // Un nombre de capa viene de un fichero ajeno: puede traer cualquier cosa, y
    // un selector inválido hace que `querySelector` LANCE.
    panel.fijarCapas([{ nombre: 'MURO "SUR"', anillos: 1 }])
    expect(() => document.querySelector(selectorCapa('MURO "SUR"'))).not.toThrow()
    expect(document.querySelector(selectorCapa('MURO "SUR"'))).not.toBeNull()
  })

  it('`fijarCapas` con algo que no es una lista LANZA', () => {
    expect(() => panel.fijarCapas('FINO')).toThrow(TypeError)
    expect(() => panel.fijarCapas([{ anillos: 3 }])).toThrow(TypeError)
  })

  it('`fijarCapas(null)` vacía la lista sin dejar el botón encendido', () => {
    panel.fijarCapas(CAPAS_UTM)
    panel.fijarCapas(null)
    expect(todos(`${SELECTOR.LISTA_CAPAS} [data-capa]`)).toEqual([])
    expect(nodo(SELECTOR.APLICAR_CAPAS).disabled).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · El diálogo de los siete atributos
// ═════════════════════════════════════════════════════════════════════════════

describe('app/panel-edificio · el diálogo de atributos (desviación 12)', () => {
  beforeEach(() => {
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
  })

  it('rotula los siete campos con las MISMAS palabras que `conModelo`', () => {
    // `ROTULO_ATRIBUTO` se importa de `edificio/mutaciones.js`, no se copia: dos
    // redacciones distintas de «nº de viviendas» en la misma pantalla son dos
    // campos distintos para quien lee.
    const etiquetas = todos(
      `${SELECTOR_COMPLETO.BLOQUE_ATRIBUTOS} .gml-campo-etiqueta`,
    ).map((e) => e.textContent)
    expect(etiquetas).toEqual(ATRIBUTOS_COMPLETO.map((c) => ROTULO_ATRIBUTO[c]))
  })

  it('el estado de conservación es un `<select>` con los valores SIN TRADUCIR', () => {
    const select = nodo('[data-campo="estado-conservacion"]')
    expect(select.tagName).toBe('SELECT')
    expect([...select.options].map((o) => o.value)).toEqual([
      '',
      ...Object.values(ESTADO_CONSERVACION),
    ])
    expect([...select.options].slice(1).map((o) => o.textContent)).toEqual(
      Object.values(ESTADO_CONSERVACION).map((v) => ROTULO_ESTADO_CONSERVACION[v]),
    )
  })

  it('los campos numéricos son `type="text"`, para poder DECIR que no llevan un número', () => {
    // ⚠️ Con `type="number"` el navegador vacía `.value` ante lo que no sabe leer,
    // así que «mil novecientos» llegaría como cadena vacía y se guardaría como
    // «sin indicar» EN SILENCIO. Es exactamente la regla de oro 1.
    for (const clave of ['anio-construccion', 'numero-viviendas', 'superficie-construida']) {
      const campo = nodo(`[data-campo="${clave}"]`)
      expect(campo.type).toBe('text')
      expect(campo.getAttribute('inputmode')).toBe('numeric')
    }
  })

  it('se rellena con lo que trae el edificio, y el hueco vacío es hueco vacío', () => {
    expect(nodo('[data-campo="uso-dominante"]').value).toBe('1_residential')
    expect(nodo('[data-campo="estado-conservacion"]').value).toBe(ESTADO_CONSERVACION.FUNCIONAL)
    expect(nodo('[data-campo="anio-construccion"]').value).toBe('1998')
    // `anioReforma` es `null` en el fixture: se enseña vacío, no como «0».
    expect(nodo('[data-campo="anio-reforma"]').value).toBe('')
    expect(nodo('[data-campo="superficie-construida"]').value).toBe('240.5')
  })

  it('«Guardar» emite los siete ya convertidos, y el blanco viaja como `null`', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    nodo('[data-campo="numero-viviendas"]').value = '4'
    nodo(SELECTOR_COMPLETO.APLICAR_ATRIBUTOS).click()
    expect(vistas).toHaveLength(1)
    expect(vistas[0].accion).toBe(ACCION.APLICAR_ATRIBUTOS)
    expect(vistas[0].atributos).toEqual({
      usoDominante: '1_residential',
      estadoConservacion: ESTADO_CONSERVACION.FUNCIONAL,
      anioConstruccion: 1998,
      anioReforma: null,
      numeroInmuebles: 3,
      numeroViviendas: 4,
      superficieConstruida: 240.5,
    })
  })

  it('la superficie con COMA decimal se lee, no se rechaza', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    nodo('[data-campo="superficie-construida"]').value = '240,5'
    nodo(SELECTOR_COMPLETO.APLICAR_ATRIBUTOS).click()
    expect(vistas[0].atributos.superficieConstruida).toBe(240.5)
  })

  it('⛔ un año con letras NO llega al modelo: se nombra el campo y no se guarda nada', () => {
    // `conAtributos` no valida a propósito («convertir el texto de un `<input>` a
    // número es de la interfaz») y `crearEdificio` LANZA con un `NaN`. Lanzar
    // dentro de un `click` no lo ve nadie.
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    nodo('[data-campo="anio-construccion"]').value = 'mil novecientos'
    nodo('[data-campo="numero-inmuebles"]').value = 'tres'
    nodo(SELECTOR_COMPLETO.APLICAR_ATRIBUTOS).click()
    expect(vistas).toEqual([])
    expect(nodo(SELECTOR_COMPLETO.ESTADO_ATRIBUTOS).textContent).toBe(
      motivoNoNumerico([ROTULO_ATRIBUTO.anioConstruccion, ROTULO_ATRIBUTO.numeroInmuebles]),
    )
    // Y el diálogo se queda abierto: cerrarlo perdería lo tecleado.
    expect(nodo(SELECTOR_COMPLETO.ESTADO_ATRIBUTOS).textContent).toContain('año de construcción')
    expect(panel.valores().atributosIlegibles).toEqual([
      ROTULO_ATRIBUTO.anioConstruccion,
      ROTULO_ATRIBUTO.numeroInmuebles,
    ])
  })

  it('el `[data-bloque]` NO cuelga del propio `<dialog>` (la bomba de `dialog:not([open])`)', () => {
    // Si cayera ahí, cualquier `display` de la hoja sobre ese atributo dejaría el
    // diálogo plantado sobre la aplicación para siempre. `estilos/app.css` se
    // escribió sin poder saberlo y por eso a ese atributo solo le da propiedades
    // que no maquetan; aquí se cierra el otro extremo.
    const bloque = nodo(SELECTOR_COMPLETO.BLOQUE_ATRIBUTOS)
    expect(bloque.tagName).not.toBe('DIALOG')
    expect(bloque.closest('dialog')).not.toBeNull()
  })

  it('la rejilla de dos columnas es un nodo propio, que es donde vive el `display`', () => {
    expect(nodo(`.${CLASE.ATRIBUTOS_REJILLA}`).tagName).toBe('DIV')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Los dos diálogos: foco, Escape y cierre
// ═════════════════════════════════════════════════════════════════════════════

describe('app/panel-edificio · abrir y cerrar los dos diálogos', () => {
  it('abrir deja el foco DENTRO, y cerrar se lo devuelve a quien lo tenía', () => {
    panel.fijarCapas(CAPAS_UTM)
    const refcat = nodo(SELECTOR.REFCAT)
    refcat.focus()
    panel.abrirCapas()
    expect(panel.dialogoCapas.contains(document.activeElement)).toBe(true)
    // El primer control enfocable, no el diálogo: esto se abre para hacer algo.
    expect(document.activeElement.dataset.campo).toBe('capa-elegida')
    panel.cerrarCapas()
    expect(document.activeElement).toBe(refcat)
  })

  it('`Escape` cierra el diálogo de capas y lo dice, con su motivo', () => {
    // En jsdom ésta es la ÚNICA vía: `HTMLDialogElement` no trae `cancel`.
    const cierres = []
    panel.fijarCapas(CAPAS_UTM)
    panel.alCerrar((c) => cierres.push(c))
    panel.abrirCapas()
    panel.dialogoCapas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(panel.abiertoDialogo(DIALOGO.CAPAS)).toBe(false)
    expect(cierres).toEqual([{ dialogo: DIALOGO.CAPAS, motivo: MOTIVO_CIERRE.ESCAPE }])
  })

  it('`Escape` cierra también el diálogo de atributos', () => {
    const cierres = []
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    panel.alCerrar((c) => cierres.push(c))
    panel.abrirAtributos()
    expect(panel.abiertoDialogo(DIALOGO.ATRIBUTOS)).toBe(true)
    const dialogo = nodo(`.${CLASE.DIALOGO_ATRIBUTOS}`)
    dialogo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(panel.abiertoDialogo(DIALOGO.ATRIBUTOS)).toBe(false)
    expect(cierres).toEqual([{ dialogo: DIALOGO.ATRIBUTOS, motivo: MOTIVO_CIERRE.ESCAPE }])
  })

  it('«Cancelar» cierra sin emitir ninguna acción, y lo avisa como cierre', () => {
    const vistas = []
    const cierres = []
    panel.fijarCapas(CAPAS_UTM)
    panel.alAccion((a) => vistas.push(a))
    panel.alCerrar((c) => cierres.push(c))
    panel.abrirCapas()
    nodo(SELECTOR.CANCELAR_CAPAS).click()
    expect(vistas).toEqual([])
    expect(cierres).toEqual([{ dialogo: DIALOGO.CAPAS, motivo: MOTIVO_CIERRE.BOTON }])
  })

  it('el cierre POR PROGRAMA no avisa a nadie, y conserva lo marcado', () => {
    panel.fijarCapas(CAPAS_UTM)
    const cierres = []
    panel.alCerrar((c) => cierres.push(c))
    const casilla = nodo(`${selectorCapa('0')} [data-campo="capa-elegida"]`)
    casilla.checked = true
    casilla.dispatchEvent(new Event('change', { bubbles: true }))
    panel.abrirCapas()
    panel.cerrarCapas()
    expect(cierres).toEqual([])
    panel.abrirCapas()
    expect(panel.capasElegidas()).toEqual(['0'])
  })

  it('cerrar dos veces no avisa dos veces (idempotente)', () => {
    const cierres = []
    panel.fijarCapas(CAPAS_UTM)
    panel.alCerrar((c) => cierres.push(c))
    panel.abrirCapas()
    panel.dialogoCapas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    panel.dialogoCapas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(cierres).toHaveLength(1)
  })

  it('pasar a SIMPLIFICADO con el diálogo de atributos abierto lo cierra y lo retira', () => {
    panel.fijar({ edificio: EDIFICIO_COMPLETO })
    panel.abrirAtributos()
    expect(panel.abiertoDialogo(DIALOGO.ATRIBUTOS)).toBe(true)
    const radio = todos(SELECTOR.MODELO).find((r) => r.value === MODELO_EDIFICIO.SIMPLIFICADO)
    radio.checked = true
    radio.dispatchEvent(new Event('change', { bubbles: true }))
    expect(panel.abiertoDialogo(DIALOGO.ATRIBUTOS)).toBe(false)
    expect(document.querySelectorAll('dialog').length).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · Los oyentes, y lo que pasa cuando uno revienta
// ═════════════════════════════════════════════════════════════════════════════

describe('app/panel-edificio · los oyentes', () => {
  it('`alAccion` y `alCerrar` devuelven su BAJA', () => {
    const vistas = []
    const baja = panel.alAccion((a) => vistas.push(a))
    nodo(SELECTOR.CARGAR_CATASTRO).click()
    baja()
    nodo(SELECTOR.CARGAR_CATASTRO).click()
    expect(vistas).toHaveLength(1)
    expect(vistas[0].accion).toBe(ACCION.CARGAR_CATASTRO)
  })

  it('un `alAlgo` que no recibe función LANZA (contrato del programador)', () => {
    expect(() => panel.alAccion('no soy una función')).toThrow(TypeError)
    expect(() => panel.alCerrar(null)).toThrow(TypeError)
  })

  it('un oyente que revienta se AVISA, y no deja sin enterarse a los demás', () => {
    // MEDIDO: una excepción lanzada dentro de un oyente del DOM no sale por
    // `dispatchEvent`, ni en jsdom ni en el navegador. Dejarla propagar es un
    // error silencioso de manual.
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sanos = []
    panel.alAccion(() => {
      throw new Error('el cableado ha reventado')
    })
    panel.alAccion((a) => sanos.push(a))
    nodo(SELECTOR.CARGAR_CATASTRO).click()
    expect(sanos).toHaveLength(1)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].mensaje).toBe(MENSAJE_OYENTE_ROTO)
    expect(avisos[0].nivel).toBe(NIVEL.ERROR)
    consola.mockRestore()
  })

  it('toda intención viaja con lo que hubiera en el panel al pulsar', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    nodo(SELECTOR.REFCAT).value = ' 9398516VK3799G '
    nodo(SELECTOR.CARGAR_CATASTRO).click()
    expect(vistas[0].valores).toEqual({
      modelo: MODELO_EDIFICIO.SIMPLIFICADO,
      refcat: '9398516VK3799G',
    })
  })

  it('un botón apagado no emite nada aunque se le mande un `click`', () => {
    const vistas = []
    panel.fijarCapas(CAPAS_UTM)
    panel.alAccion((a) => vistas.push(a))
    nodo(SELECTOR.APLICAR_CAPAS).click()
    expect(vistas).toEqual([])
  })

  it('`destruir` deja el módulo inerte: ni emite, ni escribe, ni lanza', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    const boton = nodo(SELECTOR.CARGAR_CATASTRO)
    panel.destruir()
    boton.click()
    expect(vistas).toEqual([])
    expect(() => panel.fijar({ edificio: EDIFICIO_SIMPLE })).not.toThrow()
    expect(() => panel.estado('nada')).not.toThrow()
    expect(panel.capasElegidas()).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · ⛔ Regla de oro 9 sobre TODO lo que este módulo escribe
// ═════════════════════════════════════════════════════════════════════════════

describe('app/panel-edificio · regla de oro 9: la aplicación mide, el colegiado firma', () => {
  /**
   * Palabras que convierten una cifra o un estado en un veredicto. Es el
   * bloqueante heredado del 8.1, el 9.4, el 10.5 y el 11.x: si alguna frase del
   * panel de edificio se lee como un juicio, la fase no se cierra.
   *
   * ⚠️ NO están aquí «funcional», «ruinoso» ni «derruido»: son el vocabulario
   * declarado de `ESTADO_CONSERVACION` —el `conditionOfConstruction` de INSPIRE—,
   * o sea el VALOR de un campo que el usuario elige, no una calificación que la
   * aplicación emita sobre nada.
   *
   * ⛔ Y hay CUATRO palabras que se probaron y se quitaron, con su motivo medido,
   * porque cazaban un literal que este módulo comparte palabra por palabra con
   * `app/dialogo-expediente.js` y `app/dialogo-informe.js`
   * ({@link MENSAJE_OYENTE_ROTO}: «la orden ha llegado **bien**… un **fallo**
   * interno»):
   *   · «bien» y «mal» a secas son adverbios de uso general y ahí hablan de la
   *     FONTANERÍA, no de la medición. Se cazan sus formas evaluativas («está
   *     bien», «mal hecho»), que es donde el adverbio se vuelve juicio.
   *   · «error» y «fallo» describen que **la máquina** ha fallado, y decirlo en
   *     voz alta no es que la regla 9 lo tolere: es que la regla 1 lo EXIGE. Lo
   *     que la 9 prohíbe es juzgar la MEDICIÓN, no confesar una avería.
   * Un guardián que obligue a reescribir una frase correcta de tres módulos está
   * midiendo la palabra y no la regla.
   *
   * ⛔ **Y las fronteras NO son `\b`, y esto sí es un fallo silencioso encontrado
   * al medirlo.** La primera versión usaba `/\b(…|[óo]ptim[oa]s?|…)\b/i` y **no
   * disparaba con «El resultado es óptimo.»**: `\b` está definida sobre `\w`, que
   * en JavaScript es `[A-Za-z0-9_]` y **no incluye las vocales acentuadas ni la
   * ñ**, así que entre el espacio y la `ó` NO hay frontera de palabra y la
   * alternativa entera queda muerta. Un guardián de castellano escrito con `\b`
   * deja pasar en silencio justo las palabras que llevan tilde. Se usan
   * lookarounds sobre `\p{L}` con la bandera `u`, y el `it` de arriba —el que
   * comprueba que el guardián DISPARA— es quien lo destapó.
   */
  const VEREDICTO = new RegExp(
    '(?<!\\p{L})(?:v[áa]lid[oa]s?|inv[áa]lid[oa]s?|correct[oa]s?|incorrect[oa]s?|cumple|' +
      'apt[oa]s?|aprobad[oa]s?|rechazad[oa]s?|conforme|est[áa] (?:bien|mal)|(?:bien|mal) hecho|' +
      '[óo]ptim[oa]s?|perfect[oa]s?|excelente|deficiente|grave|acepta(?:ble|do)|garantiza|' +
      'asegura|sem[áa]foro)(?!\\p{L})',
    'iu',
  )

  it('el guardián DISPARA con una frase que sí es un veredicto', () => {
    // Mitad anti-vacuidad, y es la lección de F03 fase 4: un guardián que no
    // dispara nunca no protege de nada y además sale verde. Estas seis frases son
    // las que este panel no puede llegar a decir.
    for (const frase of [
      'La geometría es válida.',
      'El edificio no cumple las reglas del ICUC.',
      'Reparto correcto: 7 partes.',
      'El resultado es óptimo.',
      'Este DXF es aceptable.',
      'La aplicación garantiza que la Sede lo admitirá.',
    ]) {
      expect(frase, `el guardián no ve el veredicto de «${frase}»`).toMatch(VEREDICTO)
    }
  })

  it('ni el marcado ni sus textos llevan una palabra de veredicto', () => {
    panel.fijar({ edificio: EDIFICIO_COMPLETO, puedeConsultarCatastro: false })
    panel.fijarCapas(CAPAS_UTM)
    const texto = textosDelPanel()
    const encontrada = texto.match(VEREDICTO)
    expect(encontrada, `el panel escribe «${encontrada?.[0]}»`).toBeNull()
  })

  it('tampoco los literales exportados, incluidos los que solo salen en un caso raro', () => {
    // Los de arriba solo se ven en su circunstancia; éstos se comprueban SIEMPRE,
    // que es lo que separa un guardián de una casualidad.
    const literales = [
      TITULO_ORIGEN,
      TITULO_PARTES,
      TITULO_CAPAS,
      TITULO_ATRIBUTOS,
      INTRO_CAPAS,
      INTRO_ATRIBUTOS,
      SIN_PARTES,
      SIN_DATOS,
      MOTIVO_SIN_CAPAS,
      MOTIVO_SIN_REFCAT,
      AYUDA_RENOMBRAR,
      MENSAJE_OYENTE_ROTO,
      motivoNoNumerico(['año de construcción']),
      ...Object.values(ROTULO_MODELO),
      ...Object.values(APUNTE_MODELO),
    ]
    for (const literal of literales) {
      const encontrada = literal.match(VEREDICTO)
      expect(encontrada, `«${literal}» dice «${encontrada?.[0]}»`).toBeNull()
    }
  })

  it('el apunte del modelo dice QUÉ SE PIERDE, con los siete nombrados', () => {
    // Regla de oro 1 aplicada a un radio: pasar a SIMPLIFICADO borra los siete
    // atributos, y eso hay que decirlo ANTES de pulsar, no después.
    const apunte = APUNTE_MODELO[MODELO_EDIFICIO.SIMPLIFICADO]
    expect(apunte).toContain('se borran los siete atributos')
    for (const clave of ATRIBUTOS_COMPLETO) {
      expect(APUNTE_MODELO[MODELO_EDIFICIO.COMPLETO]).toContain(ROTULO_ATRIBUTO[clave])
    }
  })

  it('el diálogo de capas explica el porqué con el DATO, no con una recomendación', () => {
    // Es el argumento medido de la decisión 5: en `UTM.dxf` la parcela está en la
    // capa `0` y no en la que se llama `PARCELA`.
    expect(INTRO_CAPAS).toContain('PARCELA')
    expect(INTRO_CAPAS).toContain('la aplicación no elige por el nombre')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · F12 · T4.1 — la fila que se elige, y el bloque de la parte activa
// ═════════════════════════════════════════════════════════════════════════════

describe('app/panel-edificio · F12: elegir una parte', () => {
  it('el nombre de la fila es un `<button>`, no un `<span>` con un `click` encima', () => {
    // Una fila clicable que no es un control no se alcanza con el tabulador, no
    // responde a Intro ni a Espacio y no se anuncia como pulsable. El cromo se lo
    // quita `estilos/app.css`; aquí no se escribe ni un estilo (hay un `it`).
    panel.fijar({ edificio: EDIFICIO_F12 })
    const elegir = nodo(`${selectorParte(0)} [data-accion="${ACCION.SELECCIONAR_PARTE}"]`)
    expect(elegir.tagName).toBe('BUTTON')
    expect(elegir.type).toBe('button')
    expect(elegir.className).toBe(CLASE.PARTE_NOMBRE)
    expect(elegir.textContent).toBe('Cuerpo principal')
  })

  it('pulsar una fila emite su índice, y el panel NO se elige solo', () => {
    // El panel no decide qué está activo: lo decide el store, y vuelve por
    // `fijar`. Mismo viaje de ida y vuelta que el renombrado.
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    panel.fijar({ edificio: EDIFICIO_F12 })
    expect(panel.parteActiva()).toBeNull()

    nodo(`${selectorParte(1)} [data-accion="${ACCION.SELECCIONAR_PARTE}"]`).click()
    expect(vistas).toHaveLength(1)
    expect(vistas[0]).toMatchObject({ accion: ACCION.SELECCIONAR_PARTE, indice: 1 })
    expect(panel.parteActiva()).toBeNull()
  })

  it('pulsar la fila que YA estaba activa vuelve a emitir (el segundo clic reencuadra)', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    panel.fijar({ edificio: EDIFICIO_F12, activa: 1 })
    nodo(`${selectorParte(1)} [data-accion="${ACCION.SELECCIONAR_PARTE}"]`).click()
    expect(vistas.map((a) => a.indice)).toEqual([1])
  })

  it('la fila activa se marca con `aria-current` y con su modificador de clase', () => {
    panel.fijar({ edificio: EDIFICIO_F12, activa: 2 })
    const fila = nodo(selectorParte(2))
    expect(fila.classList.contains(CLASE.PARTE_ACTIVA)).toBe(true)
    const elegir = fila.querySelector(`[data-accion="${ACCION.SELECCIONAR_PARTE}"]`)
    expect(elegir.getAttribute('aria-current')).toBe('true')
    // Y SOLO una: dos filas marcadas dirían que se editan dos a la vez.
    expect(todos(`.${CLASE.PARTE_ACTIVA}`)).toHaveLength(1)
    expect(todos('[aria-current="true"]')).toHaveLength(1)
  })

  it('`fijar` sin `activa` CONSERVA la que hubiera: un repintado no deselecciona', () => {
    panel.fijar({ edificio: EDIFICIO_F12, activa: 1 })
    panel.fijar({ edificio: EDIFICIO_F12 })
    expect(panel.parteActiva()).toBe(1)
  })

  it('⛔ un índice fuera de la lista NO lanza: se queda sin parte activa', () => {
    // Es lo que pasa al eliminar la última parte, o sea un uso normal. Lanzar
    // aquí reventaría dentro de un `click`.
    panel.fijar({ edificio: EDIFICIO_F12, activa: 2 })
    expect(() => panel.fijar({ edificio: EDIFICIO_F12, activa: 9 })).not.toThrow()
    expect(panel.parteActiva()).toBeNull()
    expect(nodo(SELECTOR.ESTADO_ACTIVA).textContent).toBe(SIN_PARTE_ACTIVA)
  })

  it('«Añadir parte» vive en el hueco de coste 0 px del rótulo, y emite sin índice', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    const boton = nodo(SELECTOR.ANADIR_PARTE)
    expect(boton.className).toContain('gml-boton--menudo')
    expect(boton.closest('.gml-rotulo-fila')).not.toBeNull()
    boton.click()
    expect(vistas[0]).toMatchObject({ accion: ACCION.ANADIR_PARTE, indice: null })
  })

  it('«Añadir parte» funciona con la lista VACÍA: es de donde sale la primera', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    expect(nodo(SELECTOR.ANADIR_PARTE).disabled).toBe(false)
    nodo(SELECTOR.ANADIR_PARTE).click()
    expect(vistas).toHaveLength(1)
  })
})

describe('app/panel-edificio · F12: el bloque de la parte activa', () => {
  it('sin parte elegida el cuerpo se oculta y se dice POR QUÉ, con el botón apagado', () => {
    // Regla de oro 1: el botón apagado y su motivo, en el mismo paso.
    panel.fijar({ edificio: EDIFICIO_F12 })
    expect(nodo(SELECTOR.ESTADO_ACTIVA).textContent).toBe(SIN_PARTE_ACTIVA)
    expect(nodo(SELECTOR.ELIMINAR_PARTE).disabled).toBe(true)
    expect(nodo(SELECTOR.TIPO_PARTE).closest('[hidden]')).not.toBeNull()
  })

  it('⛔ el `hidden` va en el CUERPO, JAMÁS en la `<section>`', () => {
    // `app/rama.js` gobierna el `hidden` de las `<section>` que descubre por
    // `data-rama-panel` —lo ESCRIBE en cada conmutación—, así que dos dueños del
    // mismo atributo es un intercambio que se descuadra solo.
    panel.fijar({ edificio: EDIFICIO_F12 })
    expect(panel.seccionActiva.hidden).toBe(false)
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    expect(panel.seccionActiva.hidden).toBe(false)
  })

  it('con parte elegida enseña su nombre, su tipo y sus plantas', () => {
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    expect(nodo(SELECTOR.ESTADO_ACTIVA).textContent).toBe('')
    expect(nodo(SELECTOR.ELIMINAR_PARTE).disabled).toBe(false)
    expect(nodo(SELECTOR.TIPO_PARTE).value).toBe(TIPO_PARTE.PRINCIPAL)
    expect(nodo(SELECTOR_PRINCIPAL.PLANTAS_SOBRE).value).toBe('2')
    expect(nodo(SELECTOR_PRINCIPAL.PLANTAS_BAJO).value).toBe('1')
    expect(panel.seccionActiva.textContent).toContain('Cuerpo principal')
  })

  it('el `<select>` de tipo lleva los valores de TIPO_PARTE SIN TRADUCIR', () => {
    // Contrato K.2: lo que viaja es el valor del modelo; lo que se lee es el
    // rótulo. Y el rótulo de OTRA dice qué cabe dentro, que es lo que hace falta
    // para reconocerlo.
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    const select = nodo(SELECTOR.TIPO_PARTE)
    expect([...select.options].map((o) => o.value)).toEqual(Object.values(TIPO_PARTE))
    expect([...select.options].map((o) => o.textContent)).toEqual(
      Object.values(TIPO_PARTE).map((t) => ROTULO_TIPO_PARTE[t]),
    )
    expect(ROTULO_TIPO_PARTE[TIPO_PARTE.OTRA]).toContain('piscina')
  })

  it('una parte SIN recinto lo dice, y manda a la herramienta que lo arregla', () => {
    panel.fijar({ edificio: EDIFICIO_F12, activa: 2 })
    const dicho = nodo(SELECTOR.ESTADO_ACTIVA).textContent
    expect(dicho).toBe(PENDIENTE_DE_DIBUJAR)
    expect(dicho).toContain('Dibujar recinto')
    // Y la fila de la lista lo dice también, con sus palabras.
    expect(nodo(selectorParte(2)).textContent).toContain('sin contorno')
  })

  it('⛔ la caja de la tabla de coordenadas nace y se queda VACÍA', () => {
    // Su dueño es `viewer/sincronizacion.js`, que hace `replaceChildren()` dentro
    // en cada repintado. Lo que este módulo metiera ahí desaparecería al primer
    // `set` del store, sin avisar.
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    const caja = nodo(SELECTOR.TABLA_ACTIVA)
    expect(caja).toBe(panel.tablaParteActiva)
    expect(caja.childNodes).toHaveLength(0)
    expect(caja.className).toBe('gml-tabla-caja')
    // Y el rótulo va FUERA, o se lo llevaría por delante ese mismo repintado.
    expect(panel.seccionActiva.textContent).toContain('Vértices')
  })

  it('⛔ la superficie se devuelve al guion en cada `fijar`, para no mentir de parte', () => {
    // Una cifra correcta atribuida al objeto equivocado es peor que un guion:
    // cambiar de «Parte 10» a «Parte 11» dejaría los 245,90 m² de la primera bajo
    // el nombre de la segunda hasta que alguien llamase a `medidas`.
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    panel.medidas({ activa: '245,90 m²', huella: '322,13 m² de huella' })
    expect(nodo(SELECTOR.SUPERFICIE_ACTIVA).textContent).toBe('245,90 m²')
    expect(nodo(SELECTOR.HUELLA).textContent).toBe('322,13 m² de huella')

    panel.fijar({ edificio: EDIFICIO_F12, activa: 1 })
    expect(nodo(SELECTOR.SUPERFICIE_ACTIVA).textContent).toBe(SIN_MEDIDA)
  })

  it('`medidas` con una sola cifra no toca la otra', () => {
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    panel.medidas({ activa: '10,00 m²', huella: '99,00 m²' })
    panel.medidas({ activa: '11,00 m²' })
    expect(nodo(SELECTOR.HUELLA).textContent).toBe('99,00 m²')
  })

  it('«Eliminar parte» emite el índice de la ACTIVA, y vive en su bloque', () => {
    // No en la fila ni en la cabecera de la lista: un «Eliminar» a 300 px de la
    // fila elegida, en una lista de trece que se parecen, se pulsa por error.
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    panel.fijar({ edificio: EDIFICIO_F12, activa: 1 })
    const boton = nodo(SELECTOR.ELIMINAR_PARTE)
    expect(panel.seccionActiva.contains(boton)).toBe(true)
    boton.click()
    expect(vistas[0]).toMatchObject({ accion: ACCION.ELIMINAR_PARTE, indice: 1 })
  })

  it('sin parte activa, «Eliminar parte» no emite NADA aunque le llegue un `click`', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    panel.fijar({ edificio: EDIFICIO_F12 })
    nodo(SELECTOR.ELIMINAR_PARTE).click()
    expect(vistas).toEqual([])
  })
})

describe('app/panel-edificio · F12 criterio 1: una piscina NO tiene contadores', () => {
  it('⛔ en una parte OTRA los campos de plantas NO están ocultos: NO ESTÁN', () => {
    // Misma forma comprobable que el criterio 1 de F11 con los siete atributos:
    // se puede señalar con el dedo. Un «0» sería mentira —`conPlantas` lo dice
    // así: «en ésas las plantas no son cero: no aplican»— y un campo vacío
    // invitaría a rellenarlo.
    panel.fijar({ edificio: EDIFICIO_F12, activa: 1 })
    expect(nodo(SELECTOR.TIPO_PARTE).value).toBe(TIPO_PARTE.OTRA)
    for (const selector of Object.values(SELECTOR_PRINCIPAL)) {
      expect(document.querySelector(selector), `${selector} sigue en el documento`).toBeNull()
    }
    expect(panel.plantasDisponibles()).toBe(false)
  })

  it('la ayuda de rasante se va con los campos que explica', () => {
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    expect(panel.seccionActiva.textContent).toContain(AYUDA_PLANTAS)
    panel.fijar({ edificio: EDIFICIO_F12, activa: 1 })
    expect(panel.seccionActiva.textContent).not.toContain(AYUDA_PLANTAS)
  })

  it('la ayuda es la LITERAL de la ficha, con las dos mitades', () => {
    // Es la única frase del proyecto que dice qué es la rasante; dos redacciones
    // serían dos definiciones.
    expect(AYUDA_PLANTAS).toContain('sótanos')
    expect(AYUDA_PLANTAS).toContain('la línea del terreno')
  })

  it('volver a PRINCIPAL los repone, y con los valores del store', () => {
    panel.fijar({ edificio: EDIFICIO_F12, activa: 1 })
    expect(panel.plantasDisponibles()).toBe(false)
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    expect(panel.plantasDisponibles()).toBe(true)
    expect(nodo(SELECTOR_PRINCIPAL.PLANTAS_SOBRE).value).toBe('2')
  })

  it('una parte principal SIN plantas deja los campos en blanco, no en «0»', () => {
    // `null` es «aún no se sabe» y cero es un número de plantas. La distinción es
    // del modelo y esta vista no puede borrarla.
    panel.fijar({ edificio: EDIFICIO_F12, activa: 2 })
    expect(nodo(SELECTOR_PRINCIPAL.PLANTAS_SOBRE).value).toBe('')
    expect(nodo(SELECTOR_PRINCIPAL.PLANTAS_BAJO).value).toBe('')
  })
})

describe('app/panel-edificio · F12: lo que se teclea en las plantas', () => {
  const teclear = (selector, valor) => {
    const campo = nodo(selector)
    campo.value = valor
    campo.dispatchEvent(new Event('change', { bubbles: true }))
  }

  it('los dos campos son `type="text"`, para poder DECIR que no llevan un número', () => {
    // Con `type="number"` el navegador VACÍA `.value` ante lo que no sabe leer, y
    // «dos» se guardaría como «sin indicar» en silencio. Medido en F11 con los años.
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    for (const selector of Object.values(SELECTOR_PRINCIPAL)) {
      expect(nodo(selector).type).toBe('text')
      expect(nodo(selector).getAttribute('inputmode')).toBe('numeric')
    }
  })

  it('un número entra como NÚMERO, y se mandan los dos campos', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    teclear(SELECTOR_PRINCIPAL.PLANTAS_SOBRE, '3')
    expect(vistas[0]).toMatchObject({
      accion: ACCION.CAMBIAR_PLANTAS,
      indice: 0,
      plantas: { sobre: 3, bajo: 1 },
    })
  })

  it('⛔ lo que NO es un número viaja TAL CUAL, para que el aviso pueda citarlo', () => {
    // `NaN` no significa nada para quien escribió «dos». Y `conPlantas` no lanza
    // nunca con esto: viene de un teclado.
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    teclear(SELECTOR_PRINCIPAL.PLANTAS_SOBRE, 'dos')
    expect(vistas[0].plantas.sobre).toBe('dos')
  })

  it('un decimal o un negativo SÍ salen como número: quien los juzga es la mutación', () => {
    // El reparto está escrito en las dos capas: aquí se decide si es un número,
    // y «entero de cero para arriba» vive en `edificio/mutaciones.js`.
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    teclear(SELECTOR_PRINCIPAL.PLANTAS_SOBRE, '2,5')
    teclear(SELECTOR_PRINCIPAL.PLANTAS_BAJO, '-1')
    expect(vistas[0].plantas.sobre).toBe(2.5)
    expect(vistas[1].plantas.bajo).toBe(-1)
  })

  it('vaciar un campo manda `null` («aún no se sabe»), no cero', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    teclear(SELECTOR_PRINCIPAL.PLANTAS_SOBRE, '   ')
    expect(vistas[0].plantas.sobre).toBeNull()
  })

  it('cambiar el tipo emite el valor SIN TRADUCIR y el índice de la activa', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    teclear(SELECTOR.TIPO_PARTE, TIPO_PARTE.OTRA)
    expect(vistas[0]).toMatchObject({
      accion: ACCION.CAMBIAR_TIPO_PARTE,
      indice: 0,
      tipo: TIPO_PARTE.OTRA,
    })
  })

  it('sin parte activa, un `change` en el bloque no emite nada', () => {
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    panel.fijar({ edificio: EDIFICIO_F12 })
    teclear(SELECTOR.TIPO_PARTE, TIPO_PARTE.OTRA)
    expect(vistas).toEqual([])
  })
})

describe('app/panel-edificio · F12: el selector de modelo se pliega', () => {
  it('nace DESPLEGADO: elegir el modelo es lo primero que hay que poder hacer', () => {
    expect(panel.modeloPlegado()).toBe(false)
    expect(nodo(SELECTOR.MODELO).closest('[hidden]')).toBeNull()
    expect(nodo(SELECTOR.DESPLEGAR_MODELO).closest('[hidden]')).not.toBeNull()
  })

  it('⛔ pulsar un radio NO lo pliega: ahí es cuando hay que leer qué se pierde', () => {
    // Plegar en el `change` haría desaparecer bajo el propio cursor el apunte que
    // dice «se borran los siete atributos». Es la frase que justifica el gesto.
    const radio = todos(SELECTOR.MODELO).find((r) => r.value === MODELO_EDIFICIO.COMPLETO)
    radio.click()
    expect(panel.modeloPlegado()).toBe(false)
    expect(panel.seccionOrigen.textContent).toContain(APUNTE_MODELO[MODELO_EDIFICIO.COMPLETO])
  })

  it('entrar un edificio SÍ lo pliega, y el renglón dice el rótulo entero', () => {
    // 174,41 px MEDIDOS que vuelven al panel (F12 · M1, 1280×720).
    panel.fijar({ edificio: EDIFICIO_F12 })
    expect(panel.modeloPlegado()).toBe(true)
    expect(nodo(SELECTOR.MODELO).closest('[hidden]')).not.toBeNull()
    const renglon = nodo(SELECTOR.DESPLEGAR_MODELO).closest(`.${CLASE.MODELO_PLEGADO}`)
    expect(renglon.hidden).toBe(false)
    expect(renglon.textContent).toContain(ROTULO_MODELO[MODELO_EDIFICIO.SIMPLIFICADO])
  })

  it('«Cambiar» lo despliega, deja el foco en el radio puesto y NO emite nada', () => {
    // No cambia ningún dato: mandárselo al cableado sería pedirle que devolviera
    // una orden que no tiene nada que decidir.
    const vistas = []
    panel.alAccion((a) => vistas.push(a))
    panel.fijar({ edificio: EDIFICIO_F12 })
    nodo(SELECTOR.DESPLEGAR_MODELO).click()
    expect(panel.modeloPlegado()).toBe(false)
    expect(vistas).toEqual([])
    expect(document.activeElement.value).toBe(MODELO_EDIFICIO.SIMPLIFICADO)
  })

  it('⛔ y un repintado NO se lo vuelve a cerrar en las manos', () => {
    // Hay un `fijar` por cada mutación —renombrar, añadir, plantas—, así que sin
    // esto el selector se cerraría solo en cuanto el usuario tocara cualquier cosa.
    panel.fijar({ edificio: EDIFICIO_F12 })
    nodo(SELECTOR.DESPLEGAR_MODELO).click()
    panel.fijar({ edificio: EDIFICIO_F12, activa: 0 })
    expect(panel.modeloPlegado()).toBe(false)
  })

  it('`fijar(null)` vuelve a empezar: desplegado, y sin recordar el «Cambiar»', () => {
    panel.fijar({ edificio: EDIFICIO_F12 })
    nodo(SELECTOR.DESPLEGAR_MODELO).click()
    panel.fijar(null)
    expect(panel.modeloPlegado()).toBe(false)
    expect(panel.parteActiva()).toBeNull()
    panel.fijar({ edificio: EDIFICIO_F12 })
    expect(panel.modeloPlegado()).toBe(true)
  })
})
