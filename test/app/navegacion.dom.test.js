/* -------------------------------------------------------------------------- *
 * test/app/navegacion.dom.test.js — Rework de UI · T2 · el nodo huérfano        *
 *                                                                              *
 * Criterio 2 del plan, y el único cuyo fallo es INVISIBLE: **los pasos y las    *
 * ramas inactivas se ocultan, no se destruyen.**                                *
 *                                                                              *
 * ── POR QUÉ HACE FALTA UN FICHERO ENTERO PARA ESTO ──                          *
 * `app/cableado-*.js` resuelve sus nodos como **valores por defecto de          *
 * parámetro** (`cableado-catastro.js:656-662`): se evalúan UNA vez, al montar,  *
 * y se guardan en el cierre. Si el intercambio de pantalla sacara ese nodo del  *
 * documento, la referencia del cierre quedaría **huérfana, escribible y muda**: *
 * `isConnected` pasa a `false`, escribir en ella **no lanza**, sus oyentes      *
 * siguen disparando, y la referencia catastral recién traída del Catastro acaba *
 * en un nodo fuera del documento **mientras el usuario ve el campo vacío**.     *
 * Son **30 nodos resueltos así** en `app/`.                                      *
 *                                                                              *
 * `app/rama.js:24-40` lleva esa medición escrita desde F11, pero escrita: aquí  *
 * se vuelve EJECUTABLE, con su control negativo, que es la parte que de verdad  *
 * protege (§3). Un guardián que nunca ha visto fallar no sabe fallar.            *
 *                                                                              *
 * ── LAS TRES COSAS QUE SE VIGILAN ──                                            *
 *   1. Sobre el `index.html` REAL y el conmutador REAL: **TODOS** los nodos de   *
 *      contrato —los cinco `data-*`, no uno— sobreviven a la ida y vuelta con    *
 *      su IDENTIDAD, no solo con su contenido. `rama.dom.test.js` ya vigila un   *
 *      nodo sobre una cáscara mínima; esto es el censo entero del documento.     *
 *   2. Que un paso apagado esté `hidden` **y** `disabled`, que son dos           *
 *      afirmaciones y no una: un botón oculto pero habilitado lo sigue           *
 *      alcanzando el tabulador, y uno deshabilitado pero visible miente.         *
 *   3. El **control negativo**: con `replaceChildren` la misma secuencia pierde  *
 *      el dato **sin lanzar**. Si un día alguien cambia el mecanismo, es este    *
 *      `it` el que demuestra que el de arriba estaba midiendo algo.              *
 *   4. Y el complemento exacto de `test/app/navegacion.test.js`: allí, bajo      *
 *      `node`, tocar el DOM **revienta**; aquí, bajo jsdom, tocarlo             *
 *      **funcionaría en silencio**. Este fichero es el único sitio donde una     *
 *      línea de DOM colada en la autoridad de navegación se puede cazar.         *
 *                                                                              *
 * ⚠️ El eje PASO todavía no existe en el marcado (llega en T5). Lo que se cubre  *
 * hoy es el eje RAMA —el mismo mecanismo, el mismo `hidden`— y la garantía de    *
 * que la autoridad no pinta. El día que el rail aterrice, el censo de §1 lo      *
 * recorre igual sin tocar una línea de aquí: es el documento entero, no una      *
 * lista escrita a mano.                                                          *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { MOTIVO_SIN_OFICIAL as MOTIVO_DERIVACION } from '../../app/cableado-derivacion.js'
import { MOTIVO_SIN_OFICIAL as MOTIVO_DIAGNOSTICO } from '../../app/cableado-diagnostico.js'
import { textoProcedenciaMedicion } from '../../app/cableado-medicion.js'
import {
  INSTRUCCION_PARCELARIO,
  MOTIVO_DATO,
  PASOS,
  RAMAS,
  crearNavegacion,
} from '../../app/navegacion.js'
import { ATRIBUTO_PANEL, RAMA, SELECTOR, cablearRama } from '../../app/rama.js'

const RAIZ = join(import.meta.dirname, '..', '..')

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────
//
// No se copia el marcado: una copia a mano puede quedarse en verde con un
// `index.html` ya roto, que es el fallo que este fichero menos se puede permitir.
// `import.meta.dirname` y no `fileURLToPath(import.meta.url)`: bajo jsdom la URL
// del módulo no es de esquema `file:` y aquella conversión lanza.

const INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body([^>]*)>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/navegacion.dom.test.js: no se ha encontrado el <body> de index.html. La cáscara ' +
        'de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  const clase = /class\s*=\s*"([^"]*)"/i.exec(encontrado[1])
  return { clase: clase === null ? '' : clase[1], cuerpo: encontrado[2] }
})()

/**
 * Las dos secciones de la rama EDIFICIO, con los nombres del contrato K.2. Es el
 * mismo doble que usa `test/app/rama.dom.test.js` y por lo mismo: `app/main.js`
 * las fabrica en tiempo de ejecución con `crearPanelEdificio`, que arrastra el
 * cliente del `wfsBU`, el `L.Map` y las huellas — nada de lo cual mide esto.
 * Lo que hace falta de ellas es que **traigan nodos de contrato propios**, para
 * que el censo tenga algo que perder en las dos direcciones.
 */
const PANEL_EDIFICIO_DOBLE = `
  <section class="gml-bloque gml-bloque--edificio" ${ATRIBUTO_PANEL}="${RAMA.EDIFICIO}" hidden>
    <h2 class="gml-rotulo">Origen del edificio</h2>
    <input class="gml-entrada gml-mono" type="text" data-campo="refcat-edificio" />
    <button type="button" class="gml-boton" data-accion="cargar-catastro-edificio">Traer</button>
    <p class="gml-accion-estado" data-estado="edificio" role="status"></p>
    <p class="gml-procedencia" data-procedencia="edificio"></p>
  </section>
  <section class="gml-bloque gml-bloque--partes" ${ATRIBUTO_PANEL}="${RAMA.EDIFICIO}" hidden>
    <h2 class="gml-rotulo">Partes de la construcción</h2>
    <ul class="gml-partes" data-lista="partes"></ul>
  </section>
`

function montarCascara({ conPanelEdificio = true } = {}) {
  document.body.className = INDEX.clase
  document.body.innerHTML = INDEX.cuerpo
  if (!conPanelEdificio) return
  const panel = document.querySelector('.gml-panel')
  const pie = panel.querySelector('.gml-panel-pie')
  const molde = document.createElement('div')
  molde.innerHTML = PANEL_EDIFICIO_DOBLE
  for (const seccion of Array.from(molde.children)) panel.insertBefore(seccion, pie)
}

/** Un panel de avisos de mentira: lo único que `cablearRama` le pide es `avisar`. */
const doblePanel = () => ({ avisar: vi.fn() })

/** Un visor de mentira con su barra de edición, que es lo que la rama oculta. */
function dobleVisor() {
  const contenedorBarra = document.createElement('div')
  contenedorBarra.className = 'gml-barra-edicion'
  document.body.appendChild(contenedorBarra)
  return {
    edicion: { destruir() {} },
    barraEdicion: { control: { getContainer: () => contenedorBarra } },
    contenedorBarra,
  }
}

let cableadoVivo = null
afterEach(() => {
  cableadoVivo?.destruir()
  cableadoVivo = null
})

function cablear() {
  const panel = doblePanel()
  const visor = dobleVisor()
  cableadoVivo = cablearRama({ documento: document, panel, visor })
  return { rama: cableadoVivo, panel, visor }
}

// ── El censo ────────────────────────────────────────────────────────────────

/** Los cinco `data-*` del contrato K.1: los que el cableado resuelve una vez y
 *  guarda en el cierre. Son exactamente los que no pueden huerfanizarse. */
const DATOS_CONTRATO = ['data-campo', 'data-accion', 'data-estado', 'data-ficha', 'data-procedencia']

/**
 * Todos los nodos de contrato del documento montado, indexados por el selector
 * con el que los busca el cableado. **Se guarda el PRIMERO de cada selector**, a
 * propósito: es lo que devuelve `querySelector`, también si está oculto, y por
 * tanto es el nodo cuya identidad importa.
 *
 * Cero listas escritas a mano: el censo sale del documento, así que el día que
 * el rail añada pantallas con sus propios `data-*` los cubre solo.
 *
 * @returns {Map<string, Element>}
 */
function censoDeContrato() {
  const censo = new Map()
  for (const atributo of DATOS_CONTRATO) {
    for (const el of document.querySelectorAll(`[${atributo}]`)) {
      const selector = `[${atributo}="${el.getAttribute(atributo)}"]`
      if (!censo.has(selector)) censo.set(selector, el)
    }
  }
  return censo
}

/** Marca de agua para probar que el nodo conserva su CONTENIDO, no solo su sitio. */
const sembrar = (censo) => {
  const sembrados = new Map()
  for (const [selector, nodo] of censo) {
    if (nodo.tagName === 'INPUT') {
      nodo.value = `sembrado:${selector}`
      sembrados.set(selector, nodo.value)
    }
  }
  return sembrados
}

// ─────────────────────────────────────────────────────────────────────────────

describe('T2 · el censo de contrato sobrevive a la navegación', () => {
  it('el censo no es vacuo: el `index.html` real trae más de veinte nodos de contrato', () => {
    montarCascara()
    const censo = censoDeContrato()
    // Un suelo y no un número exacto: `toBe(26)` sería una lista escrita a mano
    // con otro nombre, y saldría roja cada vez que el marcado creciera con razón.
    expect(censo.size).toBeGreaterThan(20)
    // Y trae los de las DOS ramas, o la ida y vuelta no mediría nada.
    expect(censo.has('[data-campo="refcat"]')).toBe(true)
    expect(censo.has('[data-campo="refcat-edificio"]')).toBe(true)
  })

  it('⭐ tras ir y volver de rama, TODOS son EL MISMO nodo, conectado y con su valor', () => {
    montarCascara()
    const { rama } = cablear()
    const censo = censoDeContrato()
    const sembrados = sembrar(censo)
    expect(sembrados.size).toBeGreaterThan(0)

    rama.set(RAMA.EDIFICIO)
    rama.set(RAMA.PARCELA)

    for (const [selector, nodo] of censo) {
      // `toBe` sobre el NODO: un contenido igual lo produce también un nodo
      // NUEVO, y un nodo nuevo es exactamente el fallo que esto existe para cazar.
      expect(document.querySelector(selector), `«${selector}» ya no es el mismo nodo`).toBe(nodo)
      expect(nodo.isConnected, `«${selector}» se ha quedado fuera del documento`).toBe(true)
    }
    for (const [selector, valor] of sembrados) {
      expect(censo.get(selector).value, `«${selector}» ha perdido su valor`).toBe(valor)
    }
  })

  it('mientras la otra rama está puesta, los nodos siguen CONECTADOS (solo ocultos)', () => {
    montarCascara()
    const { rama } = cablear()
    const censo = censoDeContrato()

    rama.set(RAMA.EDIFICIO)

    for (const [selector, nodo] of censo) {
      expect(nodo.isConnected, `«${selector}» se ha desconectado al conmutar`).toBe(true)
      expect(document.querySelector(selector)).toBe(nodo)
    }
    // Y la sección de parcela está oculta de verdad: si no, esto no probaría nada.
    expect(document.querySelector('.gml-bloque--catastro').hidden).toBe(true)
  })

  it('los oyentes del nodo siguen vivos tras la ida y vuelta', () => {
    montarCascara()
    const { rama } = cablear()
    const campo = document.querySelector('[data-campo="refcat"]')
    const oido = vi.fn()
    campo.addEventListener('input', oido)

    rama.set(RAMA.EDIFICIO)
    rama.set(RAMA.PARCELA)

    document
      .querySelector('[data-campo="refcat"]')
      .dispatchEvent(new Event('input', { bubbles: true }))
    expect(oido).toHaveBeenCalledTimes(1)
  })
})

describe('T2 · apagado son DOS afirmaciones: oculto Y deshabilitado', () => {
  it('en la rama EDIFICIO los CTA siguen conectados, pero `disabled`', () => {
    montarCascara()
    const { rama } = cablear()
    const generar = document.querySelector(SELECTOR.CTA_GENERAR)
    const diagnosticar = document.querySelector(SELECTOR.CTA_DIAGNOSTICAR)

    rama.set(RAMA.EDIFICIO)

    for (const cta of [generar, diagnosticar]) {
      // Criterio 2 del plan, literal: NO desaparece del documento…
      expect(cta.isConnected).toBe(true)
      expect(document.body.contains(cta)).toBe(true)
      // …y a la vez no se puede pulsar ni alcanzar con el tabulador.
      expect(cta.disabled).toBe(true)
    }
  })

  it('la barra de edición se OCULTA, no se quita del documento', () => {
    montarCascara()
    const { rama, visor } = cablear()
    const barra = visor.contenedorBarra

    rama.set(RAMA.EDIFICIO)

    expect(barra.isConnected).toBe(true)
    expect(barra.hidden).toBe(true)

    rama.set(RAMA.PARCELA)
    expect(barra.hidden).toBe(false)
  })

  it('volver RESTAURA el estado que tenía el CTA, no lo enciende a la fuerza', () => {
    // Matiz medido al escribir esta prueba: `index.html` sirve los CTA ya
    // `disabled` —sin dato no hay nada que hacer—, y `app/rama.js` **restaura lo
    // que se encontró** en vez de forzar el encendido. Si forzara, volver de
    // Edificio dejaría un botón encendido que no cumple, que es justamente lo que
    // la regla de la casa prohíbe. Se prueba en los dos sentidos, porque un
    // `expect(disabled).toBe(true)` a secas también pasaría con un módulo que no
    // reponga nada.
    //
    // ⭐ **F13 · «Generar GML» salió de esta prueba, y no por comodidad**: desde
    // que la rama Edificio sabe escribir su propio GML, ese botón ya no lo apaga
    // este módulo — lo gobierna `app/cableado-edificio-gml.js` según el dato. Lo
    // que se afirma de él ahora es lo contrario: que la conmutación NO lo toca.
    montarCascara()
    const { rama } = cablear()
    const generar = document.querySelector(SELECTOR.CTA_GENERAR)
    const diagnosticar = document.querySelector(SELECTOR.CTA_DIAGNOSTICAR)

    // Uno encendido (como lo dejaría una parcela cargada) y otro apagado.
    generar.disabled = false
    diagnosticar.disabled = true

    rama.set(RAMA.EDIFICIO)
    expect(diagnosticar.disabled).toBe(true)
    // «Generar GML» se queda como estaba: este módulo ya no manda sobre él.
    expect(generar.disabled).toBe(false)

    rama.set(RAMA.PARCELA)
    expect(diagnosticar.disabled).toBe(true)
    expect(generar.disabled).toBe(false)
    // Y el motivo del apagado se retira: si se quedara, explicaría un apagado
    // que ya no existe.
    expect(document.querySelector(SELECTOR.ESTADO_DIAGNOSTICAR).textContent).not.toContain(
      'Edificio',
    )
  })

  it('⭐ F14 · ya no queda NINGÚN CTA que este módulo apague al conmutar', () => {
    // ⛔ **Este `it` era de F13 y afirmaba que «Diagnosticar encaje» sí se apagaba
    // al pasar a EDIFICIO**, porque era el único que quedaba. F14 retira también
    // ese apagado: el contraste de construcción existe, así que el motivo era
    // falso.
    //
    // Lo que se conserva es la propiedad que de verdad importaba y que ahora se
    // cumple sola: **conmutar de rama y volver deja los dos CTA como estaban**.
    // Se mide sobre los dos, y con estados DISTINTOS, para que una implementación
    // que los pusiera a los dos en el mismo valor no pasara por casualidad.
    montarCascara()
    const { rama } = cablear()
    const diagnosticar = document.querySelector(SELECTOR.CTA_DIAGNOSTICAR)
    const generar = document.querySelector(SELECTOR.CTA_GENERAR)
    diagnosticar.disabled = false
    generar.disabled = true

    rama.set(RAMA.EDIFICIO)
    expect(diagnosticar.disabled).toBe(false)
    expect(generar.disabled).toBe(true)

    rama.set(RAMA.PARCELA)
    expect(diagnosticar.disabled).toBe(false)
    expect(generar.disabled).toBe(true)
  })
})

describe('T2 · ⛔ el control negativo: por qué `hidden` y no otra cosa', () => {
  /**
   * Reproduce el mecanismo EXACTO de `app/cableado-*.js`: el nodo se resuelve
   * como **valor por defecto de parámetro**, o sea una sola vez al montar, y se
   * queda en el cierre. Es lo que hace que el fallo sea mudo.
   */
  function cableadoDeMentira({ campo = document.querySelector('[data-campo="refcat"]') } = {}) {
    return {
      nodo: campo,
      escribirLoQueVinoDelCatastro: (valor) => {
        campo.value = valor
      },
    }
  }

  it('con `hidden`: el cableado escribe y el usuario LO VE', () => {
    montarCascara()
    const cableado = cableadoDeMentira()
    document.querySelector('.gml-bloque--catastro').hidden = true

    cableado.escribirLoQueVinoDelCatastro('9398516VK3799G')

    expect(cableado.nodo.isConnected).toBe(true)
    expect(document.querySelector('[data-campo="refcat"]')).toBe(cableado.nodo)
    expect(document.querySelector('[data-campo="refcat"]').value).toBe('9398516VK3799G')
  })

  it('con `replaceChildren`: se pierde el dato, NO lanza, y el campo se ve vacío', () => {
    montarCascara()
    const cableado = cableadoDeMentira()
    const seccion = document.querySelector('.gml-bloque--catastro')

    // Lo que `app/rama.js:24-40` prohíbe, hecho a propósito.
    seccion.replaceChildren()

    expect(cableado.nodo.isConnected).toBe(false)
    // ⛔ **ÉSTE es el `expect` que justifica el fichero entero.** Escribir en un
    // nodo desconectado no lanza: sin este control, «el fallo es invisible»
    // sería una frase del plan y no un hecho comprobado.
    expect(() => cableado.escribirLoQueVinoDelCatastro('9398516VK3799G')).not.toThrow()
    expect(cableado.nodo.value).toBe('9398516VK3799G')
    // Y lo que el usuario tiene delante: nada. La referencia catastral que acaba
    // de traer del Catastro está en un nodo fuera del documento.
    expect(document.querySelector('[data-campo="refcat"]')).toBeNull()
  })

  it('con `remove()` pasa exactamente lo mismo (no es cosa de `replaceChildren`)', () => {
    montarCascara()
    const cableado = cableadoDeMentira()

    cableado.nodo.remove()

    expect(cableado.nodo.isConnected).toBe(false)
    expect(() => cableado.escribirLoQueVinoDelCatastro('x')).not.toThrow()
    expect(document.querySelector('[data-campo="refcat"]')).toBeNull()
  })
})

describe('T2 · la autoridad de navegación no pinta (complemento del test `node`)', () => {
  it('recorrer TODO lo que sabe hacer no cambia ni un nodo del documento', () => {
    // Bajo el proyecto `node`, una línea de DOM en `app/navegacion.js` revienta
    // porque no hay `document`. Bajo jsdom **funcionaría en silencio**, así que
    // éste es el único sitio del repositorio donde se puede cazar.
    montarCascara()
    const antesHtml = document.body.innerHTML
    const censo = censoDeContrato()

    const nav = crearNavegacion({
      hechos: {
        PARCELA: { geometria: true, oficial: true, diagnostico: true },
        EDIFICIO: { geometria: true },
      },
      avisar: () => {},
    })
    for (const paso of PASOS) nav.navegarAPaso(paso)
    nav.rail()
    for (const rama of RAMAS) nav.cambiarRama(rama)
    nav.irARuta('#/edificio/validacion')
    nav.irARuta('#/parcela/informe')
    nav.actualizarHechos({ geometria: false })
    nav.ruta()

    expect(document.body.innerHTML).toBe(antesHtml)
    for (const [selector, nodo] of censo) {
      expect(document.querySelector(selector), `«${selector}» ha cambiado`).toBe(nodo)
    }
  })

  it('y su estado avanzó de verdad: el recorrido no fue una lista de no-operaciones', () => {
    // Anti-vacuidad del `it` de arriba: si la navegación no hiciera nada, el DOM
    // también seguiría intacto y la prueba pasaría sin haber medido nada.
    const nav = crearNavegacion({ hechos: { geometria: true }, avisar: () => {} })
    expect(nav.get().paso).toBe(PASOS[0])
    expect(nav.navegarAPaso(PASOS[1]).ok).toBe(true)
    expect(nav.get().paso).toBe(PASOS[1])
    // Y un paso que el dato no sostiene se queda donde está, DICIENDO por qué.
    const bloqueado = nav.navegarAPaso(PASOS[4])
    expect(bloqueado.ok).toBe(false)
    expect(bloqueado.motivo).toMatch(/\S/)
  })
})

// ── LOS CUATRO TEXTOS DEL PARCELARIO, UNA SOLA INSTRUCCIÓN (2026-08-08) ──────
//
// Va en un test `.dom` y no en `navegacion.test.js` por una razón mecánica: aquí se
// importan los TRES cableados que comparten la frase, y esos módulos resuelven nodos
// del documento. Bajo `node` no se pueden ni cargar.

describe('los cuatro textos del parcelario comparten UNA instrucción', () => {
  /** Los cuatro sitios que le dicen al usuario que le falta el parcelario. */
  const LOS_CUATRO = () => [
    ['navegacion · MOTIVO_DATO.oficial', MOTIVO_DATO.oficial],
    ['cableado-diagnostico · MOTIVO_SIN_OFICIAL', MOTIVO_DIAGNOSTICO],
    ['cableado-derivacion · MOTIVO_SIN_OFICIAL', MOTIVO_DERIVACION],
    [
      'cableado-medicion · textoProcedenciaMedicion',
      textoProcedenciaMedicion({ nombreFichero: 'mio.dxf', conParcelario: false }),
    ],
  ]

  it('⭐ los CUATRO llevan la frase compartida, palabra por palabra', () => {
    // Es el contrato de la decisión 2A y no es burocracia: eran cuatro redacciones
    // distintas de la misma instrucción y las cuatro estaban mal. Cuatro copias de
    // una frase que hay que mantener diciendo lo mismo son cuatro sitios donde
    // volver a equivocarse, y ya pasó una vez.
    for (const [donde, texto] of LOS_CUATRO()) {
      expect(texto, `«${donde}» ya no usa la constante compartida`).toContain(
        INSTRUCCION_PARCELARIO,
      )
    }
  })

  it('⛔ y NINGUNO manda ya a la trampa: ni a Entrada ni a «traer la parcela»', () => {
    // El defecto de producto que esta feature cierra. Hasta el 2026-08-08 los cuatro
    // empujaban a la acción que BORRA la medición del usuario, cada uno con su
    // redacción: «tráelo desde Entrada», «Tráela del Catastro y se enciende», «Trae
    // la parcela del Catastro y vuelve», «tráelo con la referencia catastral».
    for (const [donde, texto] of LOS_CUATRO()) {
      expect(texto, `«${donde}» sigue mandando a Entrada`).not.toMatch(/desde Entrada/i)
      expect(texto, `«${donde}» sigue mandando a traer la PARCELA`).not.toMatch(
        /tr[aá]e(?:la|r)?\s+(?:la\s+)?parcela/i,
      )
    }
  })

  it('⛔ ANTI-VACUIDAD: la frase compartida nombra el botón que conserva la medición', () => {
    // Sin esto, los dos `it` de arriba pasarían con una constante vacía o con una
    // que dijera cualquier otra cosa: afirmarían que las cuatro dicen LO MISMO, no
    // que digan lo CORRECTO.
    expect(INSTRUCCION_PARCELARIO).toContain('Traer el parcelario de fondo')
    expect(INSTRUCCION_PARCELARIO).toMatch(/medici[oó]n/i)
  })
})
