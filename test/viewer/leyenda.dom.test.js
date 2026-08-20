/* -------------------------------------------------------------------------- *
 * test/viewer/leyenda.dom.test.js — LA LEYENDA DE LOS GRAFISMOS DEL MAPA      *
 *                                                                            *
 * Lo que se prueba, por orden de importancia:                                 *
 *                                                                            *
 *   1. ⭐ **QUE NO MIENTA SOBRE LOS COLORES.** Es el riesgo entero de este     *
 *      módulo: la paleta se declara aquí y también en los cinco módulos que   *
 *      dibujan, y una leyenda con un hex viejo es peor que no tener leyenda   *
 *      —el usuario deja de mirar el mapa y se cree la tarjeta—. El guardián    *
 *      lee el FUENTE de cada capa dueña y exige que el color siga ahí.        *
 *   2. **Que no mienta sobre lo que hay dibujado**: un grupo apagado no deja   *
 *      renglones sueltos en el DOM, y pedirle un grupo que no existe LANZA en  *
 *      vez de quedarse corta en silencio (regla de oro 1).                    *
 *   3. **La regla de oro 9**: ni una palabra de veredicto en los renglones,    *
 *      con la ÚNICA excepción autorizada —la invasión a colindante (§10.4)—.  *
 *   4. **Que no le robe gestos al mapa**: pulsar dentro no elige lindero y la  *
 *      rueda no hace zoom, que es el fallo clásico de un control de Leaflet.   *
 *                                                                            *
 * Proyecto Vitest `dom` (jsdom + Leaflet real, arnés `_ayuda-jsdom.js`).       *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import L from 'leaflet'
import { afterEach, describe, expect, it } from 'vitest'

import {
  CLASE,
  ENTRADAS,
  GRUPO,
  GRUPOS_POR_DEFECTO,
  MUESTRA,
  ROTULO,
  ROTULO_GRUPO,
  SELECTOR,
  crearLeyenda,
} from '../../viewer/leyenda.js'
import { montarMapa } from './_ayuda-jsdom.js'

/** @type {Array<() => void>} */
const limpiezas = []
afterEach(() => {
  while (limpiezas.length > 0) limpiezas.pop()()
})

function conLeyenda(opciones = {}) {
  const { mapa, contenedor, destruir } = montarMapa({})
  const leyenda = crearLeyenda({ mapa, ...opciones })
  limpiezas.push(() => {
    leyenda.destruir()
    destruir()
  })
  const raiz = contenedor.querySelector(`.${CLASE.CONTENEDOR}`)
  return { leyenda, mapa, contenedor, raiz }
}

const entradasVisibles = (raiz) =>
  [...raiz.querySelectorAll(SELECTOR.ENTRADA)].map((el) => el.dataset.leyendaEntrada)

// ═══════════════════════════════════════════════════════════════════════════
// 1 · ⭐ LA PALETA NO PUEDE DIVERGIR DE LO QUE SE DIBUJA
// ═══════════════════════════════════════════════════════════════════════════
//
// `viewer/leyenda.js` repite los hex a propósito —cada capa declara su paleta con
// el porqué al lado, que es la convención que dejó escrita `viewer/piezas.js` al
// elegir su cian— y lo que NO puede pasar es que se separen. Esta es la guarda
// que lo impide, y es la razón de ser de este fichero.
//
// Se compara contra el FUENTE de la capa dueña y no contra un `options.color` de
// una capa montada, por una razón práctica: montar `contraste.js`, `piezas.js`,
// `partes.js`, `colindantes.js` y `sincronizacion.js` con datos suficientes para
// que cada uno pinte su grafismo sería reconstruir media aplicación en un test de
// una tarjeta de 12 renglones. Leer el fuente cuesta cinco `readFileSync` y caza
// exactamente el mismo fallo: alguien retoca un color en su capa y se olvida de
// aquí.

const RAIZ = join(import.meta.dirname, '..', '..')

/**
 * ⚠️ **Los COMENTARIOS se despojan, y no es un refinamiento: sin esto la guarda
 * nace en falso verde.** Medido al escribirla: `viewer/sincronizacion.js` no
 * declara el amarillo —lo importa de `_comun.js`— pero lo MENCIONA en su cabecera
 * («el color es `COLOR_USUARIO`, amarillo `#FFD600` desde la revisión…»), así que
 * la primera versión de este fichero daba por buena una entrada que apuntaba al
 * módulo equivocado. Un guardián que pasa por una frase de un comentario no
 * vigila nada: el día que alguien cambie el valor de verdad, el comentario viejo
 * lo seguiría tapando.
 *
 * Es la misma exención, y por el mismo motivo, que `contrato-capas.dom.test.js`
 * documenta para su despojador. Aquí basta con la versión por líneas: los hex
 * viven en asignaciones de una línea, nunca partidos entre dos.
 *
 * @param {string} fuente
 * @returns {string}  Solo las líneas que son CÓDIGO.
 */
const soloCodigo = (fuente) =>
  fuente
    .split('\n')
    .filter((linea) => !/^\s*(?:\/\/|\/\*|\*)/.test(linea))
    .join('\n')

describe('viewer/leyenda.js · ⭐ la paleta no puede divergir de la que se dibuja', () => {
  const fuentes = new Map()
  const fuenteDe = (ruta) => {
    if (!fuentes.has(ruta)) fuentes.set(ruta, soloCodigo(readFileSync(join(RAIZ, ruta), 'utf8')))
    return fuentes.get(ruta)
  }

  for (const entrada of ENTRADAS) {
    it(`«${entrada.id}» pinta ${entrada.color}, y ${entrada.fuente} sigue usándolo`, () => {
      const fuente = fuenteDe(entrada.fuente)
      // Insensible a mayúsculas: `#D97706` y `#d97706` son el mismo color, y la
      // guarda no está para vigilar el estilo de escritura.
      const encontrado = fuente.toLowerCase().includes(entrada.color.toLowerCase())
      expect(
        encontrado,
        `la leyenda dice que «${entrada.id}» se pinta de ${entrada.color}, y ese color ya no ` +
          `aparece en ${entrada.fuente}. O lo han cambiado allí y hay que traerlo aquí, o la ` +
          `entrada ha cambiado de capa y hay que corregir su 'fuente'. Una leyenda con un color ` +
          `viejo es peor que no tener leyenda.`,
      ).toBe(true)
    })
  }

  // ── ⛔ Y LA GUARDA AL REVÉS (2026-08-20), QUE ES LA QUE FALTABA ──────────
  //
  // Todo lo de arriba comprueba una sola dirección: que el color que la leyenda
  // ANUNCIA siga pintándose. **No caza la omisión**, que es el fallo que este
  // proyecto acaba de tener: `viewer/piezas.js` estrenó el violeta del colindante
  // recortado el 2026-08-18 y la leyenda se quedó sin nombrarlo hasta el
  // 2026-08-20. Dos días con una parcela ENTERA pintada de un color que la
  // tarjeta no declaraba —y en el mismo grupo donde sí declaraba los otros dos—.
  //
  // ⚠️ **Se vigila `viewer/piezas.js` y no `viewer/` entero, y es a propósito.**
  // Ahí cada `COLOR_*` es, por construcción, el relleno de una mancha que el
  // usuario ve como una finca: son los tres grafismos de la capa y no hay más.
  // Otros módulos declaran además sombras, orlas y trazos de apoyo —el
  // `COLOR_SOMBRA` de `senal-miembro.js`, sin ir más lejos— que no son grafismos
  // por sí mismos y que exigir en la leyenda la llenaría de renglones que no
  // significan nada. Una guarda que obliga a inventar entradas deja de ser una
  // guarda.
  it('⛔ TODO color que `viewer/piezas.js` declara está en la leyenda', () => {
    const fuente = fuenteDe('viewer/piezas.js')
    const declarados = [...fuente.matchAll(/const\s+COLOR_\w+\s*=\s*'(#[0-9A-Fa-f]{6})'/g)].map(
      (m) => m[1].toLowerCase(),
    )
    expect(declarados.length, 'la capa declara sus colores como constantes').toBeGreaterThan(0)

    const anunciados = new Set(ENTRADAS.map((e) => e.color.toLowerCase()))
    for (const color of declarados) {
      expect(
        anunciados.has(color),
        `viewer/piezas.js pinta ${color} y la leyenda no lo nombra. Un color en el mapa que la ` +
          `tarjeta no declara es una leyenda que MIENTE POR OMISIÓN: el usuario ve una mancha ` +
          `y no tiene dónde mirar qué significa. Añade su renglón al catálogo.`,
      ).toBe(true)
    }
  })

  it('cada entrada declara un fichero de `viewer/` que existe', () => {
    for (const entrada of ENTRADAS) {
      expect(entrada.fuente, `«${entrada.id}»`).toMatch(/^viewer\/_?[a-z-]+\.js$/)
      expect(() => fuenteDe(entrada.fuente)).not.toThrow()
    }
  })

  it('los ids son únicos: dos renglones con el mismo `data-` serían un selector roto', () => {
    const ids = ENTRADAS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todos los colores son hex de 6 dígitos: `conAlfa` los parsea a mano', () => {
    for (const entrada of ENTRADAS) {
      expect(entrada.color, `«${entrada.id}»`).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('cada entrada cae en un grupo declarado y en una forma de muestra declarada', () => {
    const grupos = Object.values(GRUPO)
    const muestras = Object.values(MUESTRA)
    for (const entrada of ENTRADAS) {
      expect(grupos, `«${entrada.id}»`).toContain(entrada.grupo)
      expect(muestras, `«${entrada.id}»`).toContain(entrada.muestra)
    }
  })

  it('todo grupo declarado tiene rótulo Y al menos un renglón: ninguno sale vacío', () => {
    for (const grupo of Object.values(GRUPO)) {
      expect(ROTULO_GRUPO[grupo], `el grupo '${grupo}' no tiene rótulo`).toBeTruthy()
      expect(
        ENTRADAS.some((e) => e.grupo === grupo),
        `el grupo '${grupo}' no tiene ni una entrada: sería un rótulo sobre nada`,
      ).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2 · CONTRATOS DEL PROGRAMADOR
// ═══════════════════════════════════════════════════════════════════════════

describe('viewer/leyenda.js · contratos del programador', () => {
  it('LANZA sin un mapa usable', () => {
    expect(() => crearLeyenda({})).toThrow(TypeError)
    expect(() => crearLeyenda({ mapa: {} })).toThrow(TypeError)
  })

  it('LANZA con una esquina que no es de Leaflet', () => {
    const { mapa, destruir } = montarMapa({})
    limpiezas.push(destruir)
    expect(() => crearLeyenda({ mapa, posicion: 'centro' })).toThrow(RangeError)
    expect(() => crearLeyenda({ mapa, posicion: 7 })).toThrow(TypeError)
  })

  it('LANZA con `abierta` que no es booleano: un `undefined` colado sería una lectura muda', () => {
    const { mapa, destruir } = montarMapa({})
    limpiezas.push(destruir)
    expect(() => crearLeyenda({ mapa, abierta: 'si' })).toThrow(TypeError)
  })

  it('⛔ un grupo desconocido LANZA y lo NOMBRA: quedarse corta en silencio es lo prohibido', () => {
    // Regla de oro 1, y aquí muerde más que en ningún otro control: una leyenda a
    // la que se le pide un grupo que no existe se quedaría sin esos renglones, y
    // quien la mirase creería que en esa pantalla no hay nada más dibujado.
    const { mapa, destruir } = montarMapa({})
    limpiezas.push(destruir)
    expect(() => crearLeyenda({ mapa, grupos: ['inventado'] })).toThrow(/inventado/)
    expect(() => crearLeyenda({ mapa, grupos: 'levantamiento' })).toThrow(TypeError)

    const { leyenda } = conLeyenda()
    expect(() => leyenda.grupos(['tampoco'])).toThrow(RangeError)
  })

  it('⛔ y al lanzar NO deja media leyenda montada sobre el mapa (auditoría V5)', () => {
    // `grupos` se validaba DESPUÉS de `mapa.addControl(control)`, al revés que los
    // otros tres argumentos. Con un grupo inválido la excepción salía con la
    // pastilla «Leyenda» ya colgada del mapa y sin asa para quitarla: `crearLeyenda`
    // no devuelve nada cuando lanza, así que nadie tenía el `destruir()`. Un control
    // huérfano sobre la esquina, imposible de retirar, es el peor de los dos males
    // posibles — el contrato roto lo arregla el programador leyendo el mensaje; el
    // control zombi no lo puede arreglar nadie.
    const { mapa, contenedor, destruir } = montarMapa({})
    limpiezas.push(destruir)

    expect(() => crearLeyenda({ mapa, grupos: ['inventado'] })).toThrow(RangeError)

    expect(
      contenedor.querySelector(`.${CLASE.CONTENEDOR}`),
      'ha quedado una leyenda montada que nadie puede destruir',
    ).toBeNull()
    // Y el que sí se monta después sigue siendo UNO solo (la trampa M8: dos nodos
    // con la misma clase y `querySelector` se queda con el primero).
    crearLeyenda({ mapa })
    expect(contenedor.querySelectorAll(`.${CLASE.CONTENEDOR}`)).toHaveLength(1)
  })

  it('la esquina por defecto es `bottomleft`, la única libre del visor', () => {
    const { contenedor } = conLeyenda()
    const esquina = contenedor.querySelector('.leaflet-bottom.leaflet-left')
    expect(esquina.querySelector(`.${CLASE.CONTENEDOR}`)).not.toBeNull()
  })

  it('es un `L.Control` de verdad, no un div suelto sobre el mapa', () => {
    const { leyenda } = conLeyenda()
    expect(leyenda.control).toBeInstanceOf(L.Control)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3 · QUÉ SE ENSEÑA Y QUÉ NO
// ═══════════════════════════════════════════════════════════════════════════

describe('viewer/leyenda.js · los grupos', () => {
  it('nace con `GRUPOS_POR_DEFECTO`: lo que está dibujado siempre', () => {
    const { leyenda, raiz } = conLeyenda()
    expect(leyenda.grupos()).toEqual([...GRUPOS_POR_DEFECTO])
    const ids = entradasVisibles(raiz)
    for (const entrada of ENTRADAS) {
      const deberia = GRUPOS_POR_DEFECTO.includes(entrada.grupo)
      expect(ids.includes(entrada.id), `«${entrada.id}»`).toBe(deberia)
    }
  })

  it('⛔ un grupo apagado NO deja renglones escondidos en el DOM', () => {
    // Se REHACE el panel en vez de esconder renglones: un renglón oculto sigue en
    // el árbol de accesibilidad de algunos lectores, y anunciar un grafismo que no
    // está dibujado es exactamente lo que este control tiene prohibido.
    const { raiz } = conLeyenda()
    expect(raiz.textContent).not.toContain('Invasión')
    expect(raiz.querySelector('[data-leyenda-entrada="invasion"]')).toBeNull()
  })

  it('`grupos([...])` enciende renglones, y devuelve lo aplicado', () => {
    const { leyenda, raiz } = conLeyenda()
    const aplicado = leyenda.grupos([GRUPO.LEVANTAMIENTO, GRUPO.DIAGNOSTICO])
    expect(aplicado).toEqual([GRUPO.LEVANTAMIENTO, GRUPO.DIAGNOSTICO])
    expect(entradasVisibles(raiz)).toContain('invasion')
    // Y lo que se apagó se ha ido de verdad.
    expect(entradasVisibles(raiz)).not.toContain('colindante')
  })

  it('sin argumento LEE, y la lectura es una COPIA (nadie muta el estado por detrás)', () => {
    const { leyenda } = conLeyenda()
    const leido = leyenda.grupos()
    leido.push(GRUPO.DIAGNOSTICO)
    expect(leyenda.grupos()).not.toContain(GRUPO.DIAGNOSTICO)
  })

  it('los duplicados se colapsan: un grupo repetido no pinta dos veces sus renglones', () => {
    const { leyenda, raiz } = conLeyenda({ grupos: [GRUPO.SOBRANTE, GRUPO.SOBRANTE] })
    expect(leyenda.grupos()).toEqual([GRUPO.SOBRANTE])
    expect(raiz.querySelectorAll('[data-leyenda-entrada="pieza"]')).toHaveLength(1)
  })

  it('con la lista VACÍA no queda ni un renglón ni un rótulo', () => {
    const { raiz } = conLeyenda({ grupos: [] })
    expect(entradasVisibles(raiz)).toEqual([])
    expect(raiz.querySelector(`.${CLASE.GRUPO}`)).toBeNull()
  })

  it('los grupos salen en el orden de `GRUPO`, no en el que los pida el llamante', () => {
    // Si no, la misma leyenda cambiaría de orden según por dónde navegue el
    // usuario, y una tarjeta de referencia que se reordena sola no se memoriza.
    const { raiz } = conLeyenda({ grupos: [GRUPO.DIAGNOSTICO, GRUPO.LEVANTAMIENTO] })
    const rotulos = [...raiz.querySelectorAll(`.${CLASE.GRUPO}`)].map((el) => el.textContent)
    expect(rotulos).toEqual([ROTULO_GRUPO[GRUPO.LEVANTAMIENTO], ROTULO_GRUPO[GRUPO.DIAGNOSTICO]])
  })

  it('repintar no duplica: `grupos()` dos veces deja los mismos renglones', () => {
    const { leyenda, raiz } = conLeyenda()
    leyenda.grupos([GRUPO.CATASTRO])
    leyenda.grupos([GRUPO.CATASTRO])
    expect(entradasVisibles(raiz)).toEqual(['oficial', 'colindante'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4 · PLEGADA Y DESPLEGADA
// ═══════════════════════════════════════════════════════════════════════════

describe('viewer/leyenda.js · la pastilla', () => {
  it('nace PLEGADA: el mapa es el asunto y esto es el pie de foto', () => {
    const { leyenda, raiz } = conLeyenda()
    expect(leyenda.abierta()).toBe(false)
    expect(raiz.querySelector(SELECTOR.PANEL).style.display).toBe('none')
  })

  it('la pastilla dice qué abre y declara su estado a quien no ve la pantalla', () => {
    const { raiz } = conLeyenda()
    const pastilla = raiz.querySelector(SELECTOR.ALTERNAR)
    expect(pastilla.tagName).toBe('BUTTON')
    expect(pastilla.type).toBe('button')
    expect(pastilla.textContent).toBe(ROTULO)
    expect(pastilla.getAttribute('aria-expanded')).toBe('false')
    // `aria-controls` apunta al panel DE VERDAD, no a un id inventado.
    const panel = raiz.querySelector(SELECTOR.PANEL)
    expect(panel.id).not.toBe('')
    expect(pastilla.getAttribute('aria-controls')).toBe(panel.id)
  })

  it('pulsarla la abre y la vuelve a cerrar, y `aria-expanded` la sigue', () => {
    const { leyenda, raiz } = conLeyenda()
    const pastilla = raiz.querySelector(SELECTOR.ALTERNAR)

    pastilla.click()
    expect(leyenda.abierta()).toBe(true)
    expect(pastilla.getAttribute('aria-expanded')).toBe('true')
    expect(raiz.querySelector(SELECTOR.PANEL).style.display).not.toBe('none')

    pastilla.click()
    expect(leyenda.abierta()).toBe(false)
    expect(pastilla.getAttribute('aria-expanded')).toBe('false')
  })

  it('`abierta: true` la monta desplegada, y `abrir`/`cerrar` son idempotentes', () => {
    const { leyenda } = conLeyenda({ abierta: true })
    expect(leyenda.abierta()).toBe(true)
    leyenda.abrir()
    expect(leyenda.abierta()).toBe(true)
    leyenda.cerrar()
    leyenda.cerrar()
    expect(leyenda.abierta()).toBe(false)
  })

  it('cambiar de grupos con la leyenda ABIERTA no la cierra', () => {
    // Se repinta el panel entero, así que es justo el sitio donde se perdería.
    const { leyenda, raiz } = conLeyenda({ abierta: true })
    leyenda.grupos([GRUPO.DIAGNOSTICO])
    expect(leyenda.abierta()).toBe(true)
    expect(raiz.querySelector(SELECTOR.PANEL).style.display).not.toBe('none')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5 · LAS MUESTRAS: EL TROCITO DE DIBUJO QUE SE COMPARA CON EL MAPA
// ═══════════════════════════════════════════════════════════════════════════

describe('viewer/leyenda.js · las muestras', () => {
  /** El hex de la entrada, como jsdom normaliza un color en línea. */
  const rgbDe = (hex) =>
    `rgb(${Number.parseInt(hex.slice(1, 3), 16)}, ${Number.parseInt(hex.slice(3, 5), 16)}, ` +
    `${Number.parseInt(hex.slice(5, 7), 16)})`

  it('cada renglón lleva SU muestra y su texto', () => {
    const { raiz } = conLeyenda({ grupos: Object.values(GRUPO) })
    for (const entrada of ENTRADAS) {
      const fila = raiz.querySelector(`[data-leyenda-entrada="${entrada.id}"]`)
      expect(fila, `«${entrada.id}»`).not.toBeNull()
      expect(fila.querySelector(`.${CLASE.MUESTRA}`), `«${entrada.id}»`).not.toBeNull()
      expect(fila.textContent).toContain(entrada.texto)
    }
  })

  it('un ÁREA pinta su contorno con el color exacto de la capa', () => {
    const { raiz } = conLeyenda({ grupos: [GRUPO.DIAGNOSTICO] })
    const invasion = ENTRADAS.find((e) => e.id === 'invasion')
    const muestra = raiz.querySelector('[data-leyenda-entrada="invasion"] .' + CLASE.MUESTRA)
    expect(muestra.style.borderColor).toBe(rgbDe(invasion.color))
    // Y el relleno lleva el MISMO alfa con el que se pinta la mancha del mapa. Se
    // lee de `backgroundImage` y no de `background`: el relleno va como CAPA sobre
    // la banda de dos tonos, porque en el mapa es translúcido y deja ver la
    // ortofoto (ver `FONDO_MUESTRA`).
    expect(muestra.style.backgroundImage).toContain(String(invasion.relleno))
  })

  it('toda muestra tiene fondo propio: ninguna se queda sobre el blanco de la tarjeta', () => {
    // ── ⛔ ESTA PRUEBA CAMBIÓ DE AFIRMACIÓN EL 2026-08-19 ──────────────────────
    // Se llamaba «ninguna muestra se queda sobre BLANCO: hay colores que ahí no se
    // ven» y defendía la BANDA DE DOS TONOS, que existía porque `#CBD5E1` (parcelas
    // colindantes) da 1,3:1 sobre blanco — medido en navegador el 2026-08-15.
    //
    // La banda se retiró por decisión del autor, tomada con ese número delante:
    // los dos grises de interfaz pegados por un filo duro se leían como un tema
    // claro y uno oscuro en una aplicación que solo tiene modo claro.
    //
    // ⚠️ **Lo que la prueba NO puede seguir afirmando** es que todas las muestras se
    // vean: la de colindantes no se ve, y eso está aceptado a sabiendas y escrito
    // en `FONDO_MUESTRA`. Fingir aquí que sigue cubierto sería dejar un guardián
    // verde sobre una promesa retirada — el mismo defecto que costó una semana de
    // rojos falsos en el guion de humo 14.
    //
    // Lo que SÍ sigue siendo cierto, y es lo que se mide: cada muestra tiene fondo
    // propio (`--color-bg-elevated`) y por tanto caja visible sobre la tarjeta, que
    // es blanca. Sin eso, las muestras de área perderían además la prueba de que sus
    // rellenos son translúcidos.
    const { raiz } = conLeyenda({ grupos: Object.values(GRUPO) })
    for (const entrada of ENTRADAS) {
      if (entrada.muestra === MUESTRA.ROTULO) continue // trae su propia pastilla oscura
      const muestra = raiz.querySelector(
        `[data-leyenda-entrada="${entrada.id}"] .${CLASE.MUESTRA}`,
      )
      expect(muestra.style.backgroundImage, `«${entrada.id}»`).toContain('linear-gradient')
    }
  })

  it('una LÍNEA discontinua reproduce el `dashArray` real, no un `dashed` cualquiera', () => {
    // El parcelario vigente y el margen de identidad son los dos grises
    // discontinuos del mapa: si la leyenda los pintara igual, no serviría para lo
    // que se abre. Un `border-style: dashed` deja el ritmo a criterio del
    // navegador y no se parecería a ninguno de los dos.
    const { raiz } = conLeyenda({ grupos: [GRUPO.CATASTRO, GRUPO.DIAGNOSTICO] })
    const oficial = raiz.querySelector('[data-leyenda-entrada="oficial"] span span')
    expect(oficial.style.background).toContain('repeating-linear-gradient')
    // `4 3`: 4 px de trazo, y el ciclo cierra en 7.
    expect(oficial.style.background).toContain('4px')
    expect(oficial.style.background).toContain('7px')

    const margen = raiz.querySelector('[data-leyenda-entrada="margen"] span span')
    // `2 6`: ciclo de 8. Distinto del de arriba, que es de lo que se trata.
    expect(margen.style.background).toContain('8px')
  })

  it('una línea CONTINUA no finge un trazo discontinuo', () => {
    const { raiz } = conLeyenda({ grupos: [GRUPO.CATASTRO] })
    const colindante = raiz.querySelector('[data-leyenda-entrada="colindante"] span span')
    expect(colindante.style.background).not.toContain('gradient')
  })

  it('el VÉRTICE lleva su anillo oscuro: amarillo sobre blanco es ilegible', () => {
    // ~1,4:1 de contraste. Es la advertencia escrita en `COLOR_USUARIO`, y en la
    // tarjeta blanca de la leyenda muerde igual que en la tabla de vértices.
    const { raiz } = conLeyenda()
    const punto = raiz.querySelector('[data-leyenda-entrada="vertice"] span span')
    expect(punto.style.boxShadow).not.toBe('')
    // jsdom normaliza el color en línea a `rgb(...)`: el `#fff` escrito en el
    // módulo no aparece tal cual, y compararlo contra el literal sería probar el
    // serializador de jsdom en vez del borde.
    expect(punto.style.border).toContain('rgb(255, 255, 255)')
  })

  it('la muestra es `aria-hidden`: es el texto de al lado dicho en dibujo', () => {
    const { raiz } = conLeyenda({ grupos: Object.values(GRUPO) })
    for (const muestra of raiz.querySelectorAll(`.${CLASE.MUESTRA}`)) {
      expect(muestra.getAttribute('aria-hidden')).toBe('true')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6 · LA REGLA DE ORO 9
// ═══════════════════════════════════════════════════════════════════════════

describe('viewer/leyenda.js · NO juzga (regla de oro 9)', () => {
  const VEREDICTOS =
    /\b(apta|apto|válida|valida|válido|correcta|correcto|incorrect|conforme|error|defecto|mal |problema|conflict|aprobad|suspend|admisible|aceptable|tolerancia)/i

  it('ni un renglón dictamina, con todos los grupos encendidos', () => {
    // Una leyenda es justo el sitio donde se cuela un veredicto sin querer: basta
    // con escribir «zona conflictiva» donde pone «invasión a colindante».
    const { raiz } = conLeyenda({ grupos: Object.values(GRUPO), abierta: true })
    expect(raiz.textContent).not.toMatch(VEREDICTOS)
  })

  it('ningún renglón lleva verde ni rojo de mérito', () => {
    const { raiz } = conLeyenda({ grupos: Object.values(GRUPO), abierta: true })
    const PROHIBIDOS = /#(16a34a|22c55e|dc2626|ef4444|15803d|b91c1c)/i
    for (const el of raiz.querySelectorAll('*')) {
      expect(el.getAttribute('style') || '').not.toMatch(PROHIBIDOS)
    }
  })

  it('el ÁMBAR solo lo llevan los dos hechos topológicos que lo tienen autorizado', () => {
    // §10.4: la invasión a colindante es la única excepción de todo el proyecto, y
    // el trozo que se sale del contorno oficial es exactamente el mismo hecho
    // dicho desde la derivación — por eso `viewer/piezas.js` repite ese ámbar.
    const conAmbar = ENTRADAS.filter((e) => e.color.toLowerCase() === '#d97706').map((e) => e.id)
    expect(conAmbar.sort()).toEqual(['fuera', 'invasion'])
  })

  it('las tres cifras del diagnóstico se nombran sin adjetivo', () => {
    const { raiz } = conLeyenda({ grupos: [GRUPO.DIAGNOSTICO], abierta: true })
    expect(raiz.textContent).toContain('Diferencia entre tu medición y el parcelario vigente')
    expect(raiz.textContent).toContain('desviación máxima')
    expect(raiz.textContent).toContain('Margen de identidad')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7 · NO LE ROBA GESTOS AL MAPA
// ═══════════════════════════════════════════════════════════════════════════

describe('viewer/leyenda.js · los gestos siguen siendo del mapa', () => {
  it('pulsar dentro NO dispara el `click` del mapa (no elige lindero)', () => {
    const { mapa, raiz } = conLeyenda({ abierta: true })
    let clics = 0
    mapa.on('click', () => {
      clics += 1
    })
    raiz.querySelector(SELECTOR.PANEL).dispatchEvent(
      new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }),
    )
    expect(clics).toBe(0)
  })

  it('un `mousedown` dentro no llega al contenedor del mapa (no arrastra el mapa)', () => {
    const { contenedor, raiz } = conLeyenda({ abierta: true })
    let recibidos = 0
    contenedor.addEventListener('mousedown', () => {
      recibidos += 1
    })
    raiz.dispatchEvent(new globalThis.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(recibidos).toBe(0)
  })

  it('la rueda sobre la leyenda no llega al contenedor del mapa (no hace zoom)', () => {
    const { contenedor, raiz } = conLeyenda({ abierta: true })
    let recibidos = 0
    contenedor.addEventListener('wheel', () => {
      recibidos += 1
    })
    raiz.dispatchEvent(new globalThis.WheelEvent('wheel', { bubbles: true, cancelable: true }))
    expect(recibidos).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 8 · DESMONTAJE
// ═══════════════════════════════════════════════════════════════════════════

describe('viewer/leyenda.js · desmontaje', () => {
  it('`destruir()` quita el control y es IDEMPOTENTE', () => {
    const { mapa, contenedor, destruir } = montarMapa({})
    const leyenda = crearLeyenda({ mapa })
    limpiezas.push(destruir)

    expect(contenedor.querySelector(`.${CLASE.CONTENEDOR}`)).not.toBeNull()
    leyenda.destruir()
    leyenda.destruir()
    expect(contenedor.querySelector(`.${CLASE.CONTENEDOR}`)).toBeNull()
  })

  it('después de `destruir()` la API queda inerte y no revienta', () => {
    const { leyenda } = conLeyenda()
    leyenda.destruir()
    expect(leyenda.grupos()).toEqual([])
    expect(leyenda.abierta()).toBe(false)
    expect(() => {
      leyenda.abrir()
      leyenda.cerrar()
      leyenda.grupos([GRUPO.CATASTRO])
    }).not.toThrow()
  })

  it('las clases CSS están exportadas y aplicadas: son contrato con la hoja', () => {
    const { raiz } = conLeyenda({ grupos: Object.values(GRUPO), abierta: true })
    expect(raiz.classList.contains(CLASE.CONTENEDOR)).toBe(true)
    for (const nombre of Object.values(CLASE)) {
      if (nombre === CLASE.CONTENEDOR) continue
      expect(raiz.querySelector(`.${nombre}`), `nadie lleva la clase .${nombre}`).not.toBeNull()
    }
  })
})
