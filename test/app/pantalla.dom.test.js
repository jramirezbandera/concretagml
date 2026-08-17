/* -------------------------------------------------------------------------- *
 * test/app/pantalla.dom.test.js — Rework de UI · T6 · el eje PASO del panel    *
 *                                                                              *
 * `app/pantalla.js` escribe `data-paso` en la raíz y pone el título. **No       *
 * oculta nada**: quien esconde las secciones que no tocan son cinco reglas de   *
 * `estilos/app.css`. Eso parte la verificación en dos mitades, y las dos están  *
 * aquí porque las dos pueden fallar EN SILENCIO:                                *
 *                                                                              *
 *   1. **El atributo.** Que la raíz diga en qué paso está, y que el título      *
 *      cambie con él.                                                           *
 *   2. ⭐ **La coherencia entre el marcado y el CSS**, que es donde vive el      *
 *      fallo mudo. jsdom no aplica hojas de estilo, así que aquí no se puede    *
 *      medir si una sección se ve; lo que sí se puede —y es lo que de verdad    *
 *      protege— es exigir que **cada valor de `data-pantalla` sea un paso que   *
 *      existe** y que **cada paso tenga su regla en el CSS**. Un                *
 *      `data-pantalla="validacon"` con la errata no rompe nada: simplemente esa *
 *      sección no se vería NUNCA, en ninguna pantalla, y nadie se enteraría.    *
 *      Y un paso sin regla enseñaría las cinco secciones a la vez.              *
 *                                                                              *
 * Lo que se ve de verdad se mide en un navegador: `scripts/smoke-navegador/     *
 * 14-shell.js`, que es quien puede leer una maquetación.                         *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { PASO, PASOS, RAMA, crearNavegacion } from '../../app/navegacion.js'
import {
  ATRIBUTO_PANTALLA,
  ATRIBUTO_PASO,
  SELECTOR_APP,
  SELECTOR_TITULO,
  TITULO_EN_EDIFICIO,
  TITULO_PANTALLA,
  cablearPantalla,
  pasosConTitulo,
  tituloDe,
} from '../../app/pantalla.js'
import { SELECTOR_BARRA } from '../../app/barra.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const CSS = readFileSync(join(RAIZ, 'estilos', 'app.css'), 'utf8')

const INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body([^>]*)>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/pantalla.dom.test.js: no se ha encontrado el <body> de index.html. La cáscara ' +
        'de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  const atributos = [...encontrado[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(([, n, v]) => [n, v])
  return { atributos, cuerpo: encontrado[2] }
})()

/** Monta la cáscara real CON los atributos de la etiqueta `<body>`: `innerHTML`
 *  copia lo de dentro y nada de la etiqueta, y sin `data-app` esto no cablea. */
function montarCascara() {
  for (const [nombre, valor] of INDEX.atributos) document.body.setAttribute(nombre, valor)
  document.body.innerHTML = INDEX.cuerpo
}

let vivo = null
afterEach(() => {
  vivo?.destruir()
  vivo = null
  for (const [nombre] of INDEX.atributos) document.body.removeAttribute(nombre)
})

function cablear({ paso = PASO.ENTRADA, hechos = {} } = {}) {
  montarCascara()
  const navegacion = crearNavegacion({ paso, hechos, avisar: () => {} })
  vivo = cablearPantalla({ documento: document, navegacion })
  return { pantalla: vivo, navegacion }
}

const raiz = () => document.querySelector(SELECTOR_APP)
const titulo = () => document.querySelector(SELECTOR_TITULO)
const secciones = () => Array.from(document.querySelectorAll(`[${ATRIBUTO_PANTALLA}]`))

const TODO = { geometria: true, oficial: true }

// ─────────────────────────────────────────────────────────────────────────────

describe('T6 · el contrato de marcado', () => {
  it('`index.html` trae la raíz y el título, uno de cada', () => {
    montarCascara()
    expect(document.querySelectorAll(SELECTOR_APP)).toHaveLength(1)
    expect(document.querySelectorAll(SELECTOR_TITULO)).toHaveLength(1)
  })

  it('la raíz ES el `<body>`, y por eso hay que reponer sus atributos a mano', () => {
    montarCascara()
    expect(raiz()).toBe(document.body)
  })

  it('sin la raíz, cablear LANZA nombrando el selector', () => {
    montarCascara()
    document.body.removeAttribute('data-app')
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() => cablearPantalla({ documento: document, navegacion })).toThrow(/data-app="cascara"/)
  })

  it('sin documento o sin navegación, cablear LANZA', () => {
    montarCascara()
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() => cablearPantalla({ navegacion })).toThrow(TypeError)
    expect(() => cablearPantalla({ documento: document })).toThrow(TypeError)
  })
})

describe('T6 · ⭐ marcado y CSS dicen lo mismo (el fallo mudo)', () => {
  it('todo valor de `data-pantalla` es un paso que EXISTE', () => {
    montarCascara()
    expect(secciones().length, 'no hay ni una sección marcada: el eje PASO no está cableado').toBeGreaterThan(0)
    for (const seccion of secciones()) {
      const declarados = seccion.getAttribute(ATRIBUTO_PANTALLA).split(/\s+/).filter(Boolean)
      expect(declarados.length, `«${seccion.className}» declara un data-pantalla vacío`).toBeGreaterThan(0)
      for (const paso of declarados) {
        expect(
          PASOS,
          `«${seccion.className}» pertenece a «${paso}», que no es un paso. Una errata aquí NO ` +
            `rompe nada: esa sección no se vería NUNCA, en ninguna pantalla, y nadie se enteraría`,
        ).toContain(paso)
      }
    }
  })

  it('cada paso tiene su regla en `estilos/app.css`', () => {
    // Sin la regla, ese paso enseñaría las CINCO secciones a la vez: el selector
    // no casa, nada se oculta, y tampoco avisa nadie.
    for (const paso of PASOS) {
      expect(
        CSS,
        `falta la regla de pantalla de «${paso}» en estilos/app.css: ese paso enseñaría todas ` +
          `las secciones a la vez`,
      ).toContain(`.gml-app[data-paso='${paso}'] [data-pantalla]:not([data-pantalla~='${paso}'])`)
    }
  })

  it('⛔ ninguna sección del RAIL lleva `data-pantalla` (se autoocultarían)', () => {
    // La regla del CSS es de DESCENDENCIA, así que `data-pantalla` dentro del rail
    // haría que los peldaños se ocultaran entre ellos. Es el motivo por el que el
    // rail usa `data-paso` y el panel `data-pantalla`, y no al revés.
    montarCascara()
    const rail = document.querySelector(SELECTOR_BARRA)
    expect(rail).not.toBeNull()
    expect(rail.querySelectorAll(`[${ATRIBUTO_PANTALLA}]`)).toHaveLength(0)
  })

  it('los canales que NO pueden desaparecer no declaran pantalla', () => {
    montarCascara()
    // El canal de errores es el de la aplicación entera: esconderlo al cambiar de
    // paso sería el peor fallo silencioso que esta cáscara puede tener.
    //
    // ⚠️ HASTA EL 2026-08-07 aquí también estaba `.gml-bloque--avisos`. Ya no
    // existe: la lista se fue a `app/dialogo-avisos.js` y de la columna quedan los
    // dos chips, que viven DENTRO de `.gml-panel-cabecera` — o sea que el
    // invariante no se ha debilitado, se ha concentrado en un solo nodo. Que los
    // chips sigan ahí lo comprueba el caso de aquí abajo.
    for (const selector of ['.gml-panel-cabecera']) {
      const nodo = document.querySelector(selector)
      expect(nodo, `${selector} ha desaparecido de index.html`).not.toBeNull()
      expect(
        nodo.hasAttribute(ATRIBUTO_PANTALLA),
        `${selector} declara pantalla, así que desaparece en las demás`,
      ).toBe(false)
    }
  })

  it('⭐ los dos chips viven en la cabecera, son BOTONES y no declaran pantalla', () => {
    // El guardián que sustituye al del bloque de avisos. Desde que la lista está
    // en un diálogo, estos dos nodos son **el único rastro permanente** de que
    // algo ha ido mal, y además la única puerta para abrir el detalle: si dejan
    // de ser botones, o si alguien les cuelga un `data-pantalla`, el canal de
    // errores desaparece en cuatro de las cinco pantallas sin que nada lo diga.
    montarCascara()
    // ⭐ **HASTA EL 2026-08-10 ESTO EXIGÍA `.gml-panel-cabecera`.** Los chips se
    // mudaron a la BARRA, y con ellos el conmutador de rama, que `app/rama.js`
    // inserta dentro de `.gml-chips` — así que la mudanza del `<div>` movió las
    // dos cosas sin tocar JavaScript. Lo que este `it` protege no ha cambiado y es
    // lo que se sigue afirmando: que los chips **no cuelguen de ninguna pantalla**.
    // Colgados, el canal de errores desaparecería en dos de los tres pasos sin que
    // nada lo dijera. Fuera del panel eso es todavía más importante: la barra se ve
    // siempre, y por eso es mejor sitio que la cabecera.
    const barra = document.querySelector('[data-rail="cascara"]')
    for (const nivel of ['ERROR', 'AVISO']) {
      const chip = document.querySelector(`.gml-chip[data-contador="${nivel}"]`)
      expect(chip, `falta el chip de ${nivel} en index.html`).not.toBeNull()
      expect(barra.contains(chip), `el chip de ${nivel} se ha salido de la barra`).toBe(true)
      expect(chip.tagName, `el chip de ${nivel} tiene que poder pincharse`).toBe('BUTTON')
      expect(chip.getAttribute('type'), 'un <button> sin type envía el formulario').toBe('button')
      expect(chip.hasAttribute(ATRIBUTO_PANTALLA)).toBe(false)
    }
  })

  it('⛔ index.html ya NO trae un `#avisos`: lo fabrica el diálogo', () => {
    // La trampa que este cambio deja abierta, y por eso hay guardián: si alguien
    // vuelve a escribir un `<div id="avisos">` en el marcado, habría DOS —el suyo
    // y el del diálogo— y `app/main.js` cablearía el del diálogo. El de index.html
    // se quedaría vacío para siempre, en silencio, y quien lo hubiera puesto
    // creería que los avisos «han dejado de funcionar». Es la misma trampa del
    // `[data-diag]` duplicado que index.html lleva documentando desde F06.
    montarCascara()
    expect(document.querySelectorAll('#avisos')).toHaveLength(0)
    expect(document.querySelectorAll('.gml-bloque--avisos')).toHaveLength(0)
  })

  it('la Entrada y la caja de vértices están en pantallas DISTINTAS', () => {
    // Es la afirmación entera de T6: si las dos se vieran a la vez, las tres vías
    // no tendrían sitio y volveríamos al panel de siempre.
    montarCascara()
    const entrada = document.querySelector('.gml-bloque--catastro').getAttribute(ATRIBUTO_PANTALLA)
    const vertices = document.querySelector('.gml-bloque--vertices').getAttribute(ATRIBUTO_PANTALLA)
    expect(entrada.split(/\s+/)).toContain(PASO.ENTRADA)
    expect(vertices.split(/\s+/)).not.toContain(PASO.ENTRADA)
    expect(vertices.split(/\s+/)).toContain(PASO.EDICION)
  })

  // ── ⭐ EL DIAGNÓSTICO EN LA COLUMNA (2026-08-05) ──────────────────────────
  // La pantalla de Diagnóstico deja de tener una ventana flotando sobre el mapa:
  // el contenedor de `viewer/cajon-diagnostico.js` se muda a esta sección del
  // panel (`cajon.anfitrion(...)`) y sustituye a la tabla de vértices. Aquí se
  // verifica la mitad que vive en el MARCADO; la otra mitad —que el nodo se muda
  // de verdad y se viste para el sitio nuevo— está en
  // `test/viewer/cajon-diagnostico.dom.test.js`.
  it('⭐ la cáscara trae la sección anfitriona del diagnóstico, VACÍA y única', () => {
    montarCascara()
    const anfitriones = document.querySelectorAll('[data-anfitrion="diagnostico"]')
    expect(
      anfitriones,
      'sin esta sección el diagnóstico se queda flotando sobre el mapa (y `app/main.js` LANZA)',
    ).toHaveLength(1)
    const seccion = anfitriones[0]
    expect(seccion.getAttribute(ATRIBUTO_PANTALLA).split(/\s+/)).toEqual([PASO.DIAGNOSTICO])
    // VACÍA a propósito: escribir aquí los nodos del diagnóstico daría un SEGUNDO
    // juego de `[data-diag]` y `[data-campo="superficie-registral"]` en el
    // documento, y `querySelector` se queda con el primero — el otro nacería
    // conectado, escribible y mudo. Es la trampa que index.html documenta desde F06.
    expect(seccion.children, 'la sección anfitriona no fabrica nada: solo aloja').toHaveLength(0)
  })

  it('⛔ en Diagnóstico la columna NO la ocupan los vértices: son dos estiradores', () => {
    // `.gml-bloque--vertices` y `.gml-bloque--contraste` son los dos `flex:1 1 auto`
    // del panel, y dos estiradores a la vez descosen el reparto (el mismo aviso que
    // `app/rama.js` dejó escrito para `.gml-bloque--partes`). Que no coincidan en
    // ninguna pantalla es lo que lo impide.
    montarCascara()
    const pantallasDe = (sel) =>
      document.querySelector(sel).getAttribute(ATRIBUTO_PANTALLA).split(/\s+/)
    const vertices = pantallasDe('.gml-bloque--vertices')
    const contraste = pantallasDe('.gml-bloque--contraste')
    expect(vertices).not.toContain(PASO.DIAGNOSTICO)
    expect(contraste).toEqual([PASO.DIAGNOSTICO])
    expect(vertices.filter((p) => contraste.includes(p))).toEqual([])
    // Y los dos declaran el reparto en el CSS, que es lo que los hace estiradores.
    //
    // ⚠️ El patrón admite que la clase venga en una LISTA de selectores, y eso es
    // una corrección de F14, no un aflojamiento: `.gml-bloque--contraste` comparte
    // ahora regla con `.gml-bloque--contraste-edificio` —el mismo hueco de la misma
    // pantalla en la otra rama—, y el patrón anterior (`\.clase\s*\{`) daba rojo
    // sobre un CSS correcto. Lo que se exige sigue siendo lo mismo: que la clase
    // esté en el selector de una regla que declara `flex: 1 1 auto`.
    for (const clase of [
      'gml-bloque--vertices',
      'gml-bloque--contraste',
      // F14 · el estirador de la MISMA pantalla en la rama EDIFICIO.
      'gml-bloque--contraste-edificio',
    ]) {
      expect(CSS, `.${clase} ha dejado de ser el estirador de su pantalla`).toMatch(
        new RegExp(`\\.${clase}[^{}]*\\{[^}]*flex:\\s*1 1 auto`),
      )
    }
  })

  it('⭐ F14 · y en la rama EDIFICIO el estirador de Diagnóstico es el suyo', () => {
    // El espejo de la prueba de arriba en la otra rama. No se puede montar contra
    // `index.html` —esa sección la fabrica `app/panel-edificio.js`—, así que lo que
    // se comprueba aquí es lo que sí vive en esta capa: que la hoja la viste igual
    // que a su gemela y que la clase NO es la misma. Dos secciones con la misma
    // clase confundirían a `querySelector` y a la cascada.
    expect(CSS).toContain('.gml-bloque--contraste-edificio')
    expect(
      CSS,
      'el cajón de edificio tiene que perder borde y sombra dentro del panel, igual que el de parcela',
    ).toMatch(/\.gml-bloque--contraste-edificio\s+\.gml-cajon-contraste-edificio/)
  })

  it('⛔ en Diagnóstico la columna es del contraste, y ya sin apaños', () => {
    // ── HISTORIA, porque este caso comprobaba lo contrario hasta el 2026-08-07 ──
    // El autor pidió que el contraste sustituyera «a los vértices y avisos». Los
    // vértices se iban con `data-pantalla`; los avisos NO podían, porque son el
    // canal de errores de la aplicación entera. El apaño era una regla CSS que
    // colapsaba el bloque solo cuando estaba VACÍO, colgada de `:has(.gml-avisos-vacio)`.
    //
    // Ese apaño ya no hace falta ni existe: la lista se fue a un diálogo, así que
    // en Diagnóstico la columna es del contraste SIEMPRE, esté la lista vacía o
    // llena, y el canal de errores sigue entero en los chips de la cabecera. Lo
    // que se comprueba ahora es que el apaño **se ha retirado de verdad**: una
    // regla `:has()` colgada de un nodo que ya nadie fabrica no falla, no avisa y
    // no hace nada — se queda ahí para siempre confundiendo a quien la lea.
    montarCascara()
    expect(document.querySelectorAll('.gml-bloque--avisos')).toHaveLength(0)
    expect(CSS, 'la regla del apaño sigue en la hoja y ya no gobierna nada').not.toContain(
      `.gml-app[data-paso='${PASO.DIAGNOSTICO}'] .gml-bloque--avisos:has(.gml-avisos-vacio)`,
    )
    // Lo que sí sigue siendo cierto y sostiene la regla de oro 1 en esta pantalla.
    expect(document.querySelector('.gml-panel-cabecera').hasAttribute(ATRIBUTO_PANTALLA)).toBe(false)
  })

  it('el pie del panel tampoco está en Entrada (mide 266 px y no cabía)', () => {
    montarCascara()
    const pie = document.querySelector('.gml-panel-pie')
    expect(pie.getAttribute(ATRIBUTO_PANTALLA).split(/\s+/)).not.toContain(PASO.ENTRADA)
    // Y sigue CONECTADO con todo su cableado: se oculta, no se quita.
    expect(pie.isConnected).toBe(true)
    expect(pie.querySelectorAll('[data-ficha]').length).toBeGreaterThan(0)
    // ⭐ **«Generar GML» YA NO ESTÁ AQUÍ, NI SU BOTÓN NI SU ACUSE (2026-08-10).**
    // El botón se fue a la zona de entrega de la barra (decisión A2: se ve en los
    // TRES pasos, apagado con motivo, en vez de existir solo en Edición), y el
    // acuse tuvo que seguirle FUERA de este `<footer>` por una razón que costó dos
    // intentos: el `<footer>` entero es `data-pantalla="edicion"`, así que un acuse
    // dentro es un acuse que solo se lee en uno de los tres pasos. El primer
    // intento fue copiar su texto a un renglón bajo la barra; se retiró al día
    // siguiente porque la misma frase se veía dos veces a la vez. El segundo, y el
    // que queda, es mudar el nodo al `<aside>`: **un solo escritor, un solo sitio.**
    expect(pie.querySelector('[data-accion="generar-gml"]')).toBeNull()
    expect(pie.querySelector('[data-estado="generar-gml"]')).toBeNull()
    const acuse = document.querySelector('[data-estado="generar-gml"]')
    expect(acuse, 'el acuse de «generar-gml» tiene que seguir existiendo').not.toBeNull()
    expect(acuse.closest(`[${ATRIBUTO_PANTALLA}]`), 'ha vuelto a colgar de una pantalla').toBeNull()
  })

  it('⛔ ni en Diagnóstico: repetía debajo lo que el contraste dice arriba', () => {
    // Con el contraste en la columna, el pie quedaba debajo diciendo por segunda
    // vez «Superficie», «Superficie catastral», «Δ catastral» y «Colindantes» —y
    // el bloque de arriba las dice mejor: con la diferencia relativa al lado y
    // nombrando las colindantes invadidas en vez de contarlas—. Son ~180 px que
    // obligaban a rodar la rueda para leer el propio diagnóstico.
    montarCascara()
    const pie = document.querySelector('.gml-panel-pie')
    expect(pie.getAttribute(ATRIBUTO_PANTALLA).split(/\s+/)).not.toContain(PASO.DIAGNOSTICO)
    // Y los tres renglones de contraste de la ficha DEJAN de declararlo también.
    // Si siguieran diciendo `diagnostico`, nadie se enteraría de que mienten: el
    // ancestro los oculta, y el guardián del guion 14 solo persigue lo que se VE
    // sin declararlo, nunca lo contrario.
    for (const ficha of ['superficie-catastral', 'delta-catastral', 'colindantes']) {
      const dd = document.querySelector(`[data-ficha="${ficha}"]`)
      expect(dd, `falta [data-ficha="${ficha}"] en index.html`).not.toBeNull()
      const declara = dd.getAttribute(ATRIBUTO_PANTALLA).split(/\s+/)
      expect(declara, `«${ficha}» sigue declarando una pantalla donde su pie no está`).toEqual([
        PASO.EDICION,
      ])
      // El `<dt>` hermano tiene que decir LO MISMO: son dos celdas de un grid, y
      // ocultar solo una descoloca la rejilla.
      expect(dd.previousElementSibling.getAttribute(ATRIBUTO_PANTALLA)).toBe(
        dd.getAttribute(ATRIBUTO_PANTALLA),
      )
    }
  })
})

describe('T6 · el atributo y el título', () => {
  it('escribe el paso en la raíz desde el arranque', () => {
    const { pantalla } = cablear()
    expect(raiz().getAttribute(ATRIBUTO_PASO)).toBe(PASO.ENTRADA)
    expect(pantalla.get()).toBe(PASO.ENTRADA)
  })

  it('sigue a la navegación', () => {
    const { navegacion } = cablear({ hechos: TODO })
    navegacion.navegarAPaso(PASO.DIAGNOSTICO)
    expect(raiz().getAttribute(ATRIBUTO_PASO)).toBe(PASO.DIAGNOSTICO)
  })

  it('el título cambia con la pantalla, y los CINCO pasos tienen el suyo', () => {
    const { navegacion } = cablear({ hechos: TODO })
    expect(pasosConTitulo()).toEqual([...PASOS])
    for (const paso of PASOS) {
      navegacion.navegarAPaso(paso)
      expect(titulo().textContent).toBe(TITULO_PANTALLA[paso])
    }
  })

  it('⭐ el título de la pantalla NO es el rótulo del rail', () => {
    // El rail dice «Entrada» porque tiene 210 px; la pantalla dice «Empieza tu
    // expediente», que es la respuesta directa a «no sé por dónde empezar». Si
    // algún día se unificaran, se perdería la segunda.
    expect(TITULO_PANTALLA[PASO.ENTRADA]).toBe('Empieza tu expediente')
    expect(TITULO_PANTALLA[PASO.ENTRADA]).not.toBe('Entrada')
  })

  it('`index.html` arranca con el título de la pantalla inicial', () => {
    // Es lo que se ve durante el instante anterior al montaje. Si dijera otra
    // cosa, la pantalla parpadearía con un título que no es el suyo.
    montarCascara()
    expect(titulo().textContent.trim()).toBe(TITULO_PANTALLA[PASO.ENTRADA])
  })

  // ── ⭐ F14 · el título depende de la RAMA, no solo del paso ────────────────

  it('⛔ F14 · en EDIFICIO, Edición NO dice «Edición del recinto»', () => {
    // MEDIDO en Chrome en la fase 4a, con los peldaños recién abiertos:
    // `#/edificio/edicion` decía «Edición del recinto» sobre trece partes, y
    // `#/edificio/informe` ponía el título de la PARCELA sobre un informe de
    // construcción. Un `<h1>` que nombra otra cosa de la que hay debajo es la
    // clase de error que nadie reporta y todo el mundo nota.
    //
    // ⭐ La tercera excepción —la del Informe— se retiró el 2026-08-08 con su
    // peldaño. El nombre legal del documento no se pierde: lo escribe el propio
    // `<dialog>`, que es quien sabe si hubo contraste.
    expect(tituloDe(PASO.EDICION, RAMA.EDIFICIO)).toBe('Edición de las partes')
    expect(tituloDe(PASO.EDICION, RAMA.EDIFICIO)).not.toBe(TITULO_PANTALLA[PASO.EDICION])
    expect(tituloDe(PASO.DIAGNOSTICO, RAMA.EDIFICIO)).toContain('construcción catastral')
  })

  it('⭐ F14 · es una tabla de EXCEPCIONES: lo no declarado cae en el título común', () => {
    // Esa forma es lo que impide que un paso nuevo tenga título en una rama y no en
    // la otra. Entrada vale igual para las dos: darle un título propio sería ruido.
    for (const paso of PASOS) {
      const esperado = TITULO_EN_EDIFICIO[paso] ?? TITULO_PANTALLA[paso]
      expect(tituloDe(paso, RAMA.EDIFICIO)).toBe(esperado)
      // Y la rama PARCELA no cambia por nada de esto.
      expect(tituloDe(paso, RAMA.PARCELA)).toBe(TITULO_PANTALLA[paso])
      expect(tituloDe(paso)).toBe(TITULO_PANTALLA[paso])
    }
    // Eran TRES hasta el 2026-08-08; la del Informe se fue con su peldaño.
    expect(Object.keys(TITULO_EN_EDIFICIO)).toHaveLength(2)
    expect(Object.keys(TITULO_EN_EDIFICIO)).not.toContain(PASO.ENTRADA)
  })

  it('⭐ F14 · los CINCO pasos por las DOS ramas tienen título, y ninguno se repite mal', () => {
    for (const rama of Object.values(RAMA)) {
      for (const paso of PASOS) {
        expect(typeof tituloDe(paso, rama), `«${paso}» en «${rama}» no tiene título`).toBe('string')
      }
      // Dentro de una rama, dos pantallas con el mismo `<h1>` no se distinguirían.
      const titulos = PASOS.map((p) => tituloDe(p, rama))
      expect(new Set(titulos).size).toBe(PASOS.length)
    }
  })

  it('⭐ F14 · el `<h1>` sigue a la RAMA en vivo, no solo al paso', () => {
    // Los hechos de LAS DOS ramas: sin los de EDIFICIO, `cambiarRama` recorta a
    // Entrada —lo hizo en la primera corrida— y la prueba mediría otra cosa.
    const { navegacion } = cablear({
      hechos: { [RAMA.PARCELA]: TODO, [RAMA.EDIFICIO]: TODO },
    })
    navegacion.navegarAPaso(PASO.EDICION)
    expect(titulo().textContent).toBe(TITULO_PANTALLA[PASO.EDICION])
    // Conmutar de rama tiene que reescribirlo: es el caso que un `aplicar({paso})`
    // a secas se dejaba fuera, y el que dejaba «Edición del recinto» sobre trece
    // partes de una construcción.
    navegacion.cambiarRama(RAMA.EDIFICIO)
    navegacion.navegarAPaso(PASO.EDICION)
    expect(titulo().textContent).toBe(TITULO_EN_EDIFICIO[PASO.EDICION])
  })

  it('sin `<h1>` no revienta: es una respuesta prevista', () => {
    montarCascara()
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() => {
      vivo = cablearPantalla({ documento: document, navegacion, titulo: null })
    }).not.toThrow()
    expect(raiz().getAttribute(ATRIBUTO_PASO)).toBe(PASO.ENTRADA)
  })
})

describe('T6 · destruir', () => {
  it('quita el atributo, repone el título y es IDEMPOTENTE', () => {
    const { pantalla, navegacion } = cablear({ hechos: TODO })
    navegacion.navegarAPaso(PASO.DIAGNOSTICO)
    expect(titulo().textContent).toBe(TITULO_PANTALLA[PASO.DIAGNOSTICO])

    pantalla.destruir()
    pantalla.destruir()
    vivo = null

    expect(raiz().hasAttribute(ATRIBUTO_PASO)).toBe(false)
    expect(titulo().textContent).toBe(TITULO_PANTALLA[PASO.ENTRADA])
    // Y no se queda escuchando.
    navegacion.navegarAPaso(PASO.EDICION)
    expect(raiz().hasAttribute(ATRIBUTO_PASO)).toBe(false)
  })
})

describe('T6 · las tres vías de Entrada (criterio 7)', () => {
  it('hay TRES vías nombradas, cada una con su rótulo y su acción', () => {
    montarCascara()
    const vias = Array.from(document.querySelectorAll('.gml-via'))
    expect(vias).toHaveLength(3)
    for (const via of vias) {
      expect(via.querySelector('h2')?.textContent.trim().length ?? 0).toBeGreaterThan(0)
      expect(via.querySelector('.gml-via-apunte')?.textContent.trim().length ?? 0).toBeGreaterThan(0)
    }
    // ⭐ La tercera se llamaba «Comprobar un GML existente» hasta el 2026-08-07, y
    // su apunte decía «sin generar uno nuevo». Era verdad mientras el GML entrara en
    // modo comprobación y de solo lectura; retirado ese modo, se abre y se edita
    // como cualquier otro fichero, y el rótulo lo dice.
    expect(vias.map((v) => v.querySelector('h2').textContent.trim())).toEqual([
      'Referencia catastral',
      'Medición propia',
      'Abrir un GML',
    ])
  })

  it('⭐ la MEDICIÓN PROPIA estrena botón: hasta T6 solo se podía arrastrar', () => {
    montarCascara()
    const boton = document.querySelector('[data-accion="abrir-medicion"]')
    expect(boton, 'la vía de medición propia no tiene control visible').not.toBeNull()
    expect(boton.closest('.gml-via')).toBe(document.querySelectorAll('.gml-via')[1])
  })

  it('las tres vías van SEPARADAS por un «O bien», que dice que son alternativas', () => {
    montarCascara()
    const separadores = document.querySelectorAll('.gml-obien')
    expect(separadores).toHaveLength(2) // tres vías ⇒ dos separadores
    for (const sep of separadores) expect(sep.textContent.trim()).toBe('O bien')
  })

  it('los botones de las tres vías ya NO viven en la fila del rótulo', () => {
    // Criterio 7, literal: «no como botones sueltos compitiendo en una fila del
    // rótulo». Ahí es donde F08 metió «Abrir un GML…» por una razón de altura que
    // en esta pantalla ya no aplica.
    montarCascara()
    for (const accion of ['abrir-gml', 'abrir-medicion']) {
      const boton = document.querySelector(`[data-accion="${accion}"]`)
      expect(boton.closest('.gml-rotulo-fila'), `«${accion}» sigue en la fila del rótulo`).toBeNull()
      expect(boton.closest('.gml-via'), `«${accion}» no está dentro de una vía`).not.toBeNull()
    }
  })

  it('⭐ la cuarta vía ya no es una vía: vive en el menú de expediente', () => {
    montarCascara()
    // ⛔ **HASTA EL 2026-08-10 ESTO EXIGÍA UN `.gml-entrada-pie`**, el renglón en
    // voz baja del final de Entrada. La razón por la que iba «aparte y más abajo»
    // sigue siendo buena —recuperar no es empezar, y anunciarlo al nivel de las
    // tres vías le daría a un recién llegado una cuarta cosa que descartar—, pero
    // el sitio dejó de serlo: **solo existía en Entrada**, y abrir un expediente es
    // algo que se quiere hacer desde cualquier paso.
    //
    // Lo que se afirma ahora es lo mismo dicho en el sitio nuevo: que exista, que
    // NO compita con las tres vías, y que no cuelgue de ninguna pantalla.
    const abrir = document.querySelector('[data-accion="abrir-expediente"]')
    expect(abrir).not.toBeNull()
    expect(abrir.closest('.gml-via')).toBeNull()
    expect(abrir.closest('[data-pantalla]')).toBeNull()
    expect(abrir.closest('[data-menu="expediente"]')).not.toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Rework de UI · REBANADA 2 (Validación) — el pie deja de ser compartido
// ═══════════════════════════════════════════════════════════════════════════
//
// Hasta el 2026-08-04 el pie del panel se enseñaba entero en CUATRO pantallas:
// ocho campos de ficha y dos acciones, 266,28 px FIJOS que a 1280×720 son el
// 37 % del panel. Medido en esa pantalla, el trabajo de Validación —los avisos
// y la tabla de vértices— era el **46,75 %** de su propia pantalla; el resto,
// mobiliario de otras.
//
// El reparto no se puede medir aquí (jsdom no aplica `estilos/app.css` y el eje
// PASO es CSS puro), así que lo que se afirma es el MARCADO. La otra mitad, en
// píxeles, la mide `scripts/smoke-navegador/14-shell.js`.
describe('rebanada 2 · el pie enseña lo de cada pantalla', () => {
  /** Los pares `<dt>`/`<dd>` de la ficha, emparejados por el DOM y no a mano. */
  const paresDeLaFicha = () =>
    [...document.querySelectorAll('.gml-ficha [data-ficha]')].map((dd) => ({
      campo: dd.dataset.ficha,
      dd,
      dt: dd.previousElementSibling,
    }))

  const pantallasDe = (el) => (el.getAttribute(ATRIBUTO_PANTALLA) ?? '').split(/\s+/).filter(Boolean)

  /** En qué pasos se ve un nodo, componiendo con TODOS sus ancestros marcados.
   *  El eje PASO se hereda por descendencia (así está escrita la regla del CSS),
   *  así que mirar solo el nodo daría una respuesta más optimista que la real. */
  const visibleEn = (el) => {
    let pasos = [...PASOS]
    for (let n = el; n !== null && n !== document.body.parentElement; n = n.parentElement) {
      const suyos = pantallasDe(n)
      if (suyos.length > 0) pasos = pasos.filter((p) => suyos.includes(p))
    }
    return pasos
  }

  it('⛔ `<dt>` y `<dd>` de un campo declaran las MISMAS pantallas', () => {
    // `.gml-ficha` es `display:grid` de dos columnas con los `<dt>`/`<dd>` como
    // celdas HERMANAS, no como nodo e hijo. Ocultar solo una de las dos deja la
    // otra corriendo la rejilla: los rótulos dejarían de casar con sus valores
    // y la ficha diría cosas que no son. No hay forma de que se note en verde.
    montarCascara()
    const pares = paresDeLaFicha()
    expect(pares.length, 'la ficha no tiene ni un campo: revisa el selector').toBeGreaterThan(0)
    for (const { campo, dd, dt } of pares) {
      expect(dt, `el campo «${campo}» no tiene <dt> delante`).not.toBeNull()
      expect(dt.tagName).toBe('DT')
      expect(
        pantallasDe(dt),
        `el rótulo y el valor de «${campo}» no se ocultan juntos: la rejilla se descoloca`,
      ).toEqual(pantallasDe(dd))
    }
  })

  it('⛔ ningún campo de la ficha es invisible en las CINCO pantallas', () => {
    // Un campo que no se ve nunca es un dato que la aplicación calcula, escribe
    // y no enseña jamás: silencio con coste. Una errata de una letra en el
    // `data-pantalla` produce exactamente eso, y el guardián de arriba —que solo
    // mira que el paso EXISTA— no la vería si la errata fuese un paso válido.
    montarCascara()
    for (const { campo, dd } of paresDeLaFicha()) {
      expect(visibleEn(dd), `el campo «${campo}» no se ve en ninguna pantalla`).not.toEqual([])
    }
  })

  it('los cinco campos de GEOMETRÍA se ven donde hay geometría que mirar', () => {
    // ⛔ AQUÍ TAMBIÉN ESTABA `DIAGNOSTICO` HASTA EL 2026-08-05. Se cae con el pie
    // entero: en esa pantalla el contraste ocupa la columna y el pie repetía
    // debajo la mitad de sus renglones. Los cuatro que NO se repetían —SRS,
    // referencia, vértices y perímetro— se van con ellos, y es el precio
    // declarado: son datos de identidad, están en las otras tres pantallas.
    montarCascara()
    const donde = Object.fromEntries(paresDeLaFicha().map(({ campo, dd }) => [campo, visibleEn(dd)]))
    // ⭐ 2026-08-08 · Eran TRES pantallas (Validación, Edición e Informe) y ahora
    // es UNA. No es que el pie se vea en menos sitios: es que aquellas tres eran
    // la misma —el mismo `<footer>`, el mismo contenido— y el rail bajó a tres
    // peldaños. Se sigue viendo exactamente donde se veía.
    for (const campo of ['srs', 'refcat', 'vertices', 'superficie', 'perimetro']) {
      expect(donde[campo], `«${campo}» es un hecho de la geometría`).toEqual([PASO.EDICION])
    }
  })

  it('los tres campos de CONTRASTE solo se ven donde nadie los repite', () => {
    // Nacieron con `data-pantalla` propio (rebanada 2) porque en Validación
    // decían «No consta», «No hay con qué comparar» y «Sin consultar»: tres
    // renglones reservando sitio para un silencio, que es lo que la regla de oro
    // 1 NO pide.
    //
    // ⛔ Y EL 2026-08-05 SALIERON TAMBIÉN DE DIAGNÓSTICO, que es donde entraron a
    // vivir. No por sitio, por REPETICIÓN: el bloque de contraste dice las tres
    // cosas arriba y mejor —«Parcelario vigente», la fila «Medición − Catastro»
    // con su diferencia relativa, y «Invasión a colindantes» nombrando cuáles en
    // vez de contarlas—. Quedaba Informe.
    //
    // ⭐ **Y EL 2026-08-08 SE MUDAN A EDICIÓN, porque Informe dejó de ser un
    // peldaño.** No se retiran: quedarse sin pantalla habría sido perderlas en
    // silencio, y son datos que el usuario ha traído. El motivo por el que en su
    // día salieron de Validación —«tres renglones reservando sitio para un
    // silencio»— ya no aplica: hoy dicen «No consta», «No hay con qué comparar» y
    // «4», que es información y no un hueco. Coste medido en Chrome: la caja de
    // vértices de Edición pasa de 475,89 a 405,08 px a 1440×900 y a 225,08 px a
    // 1280×720, las dos por encima de los suelos vigilados (120 y 124,57 px).
    montarCascara()
    const donde = Object.fromEntries(paresDeLaFicha().map(({ campo, dd }) => [campo, visibleEn(dd)]))
    for (const campo of ['superficie-catastral', 'delta-catastral', 'colindantes']) {
      expect(donde[campo], `«${campo}» no se ve donde debe`).toEqual([PASO.EDICION])
    }
  })

  it('las acciones del pie son de VALIDACIÓN y de ninguna otra', () => {
    montarCascara()
    const acciones = document.querySelector('.gml-acciones')
    expect(acciones).not.toBeNull()
    expect(visibleEn(acciones)).toEqual([PASO.EDICION])
    // «Generar GML» se queda aquí por decisión del autor (el camino corto de una
    // Subsanación no pasa por el diagnóstico).
    //
    // ⭐ Y DESDE F17 SON TRES, no dos. «Rehacer el parcelario» entra en el pie y no
    // dentro de su propio bloque porque ese bloque aparece SOLO cuando hay
    // sobrante (decisión de diseño D2): un botón dentro de él sería un botón que
    // solo existe después de haberlo pulsado. ⚠️ El tercero tiene un precio en
    // píxeles que este test no puede ver —el pie medía 209,47 px con dos— y lo
    // mide el guion de humo 16.
    //
    // ⭐ Y DESDE EL 2026-08-08 SON CUATRO. «Traer el parcelario de fondo» va
    // ANTES de «Diagnosticar encaje» porque es su requisito: sin contorno oficial
    // el encaje no se puede medir, y éste es el botón que lo trae. El ORDEN se
    // afirma, no solo el conjunto: leído de arriba abajo el pie cuenta la
    // secuencia real del trabajo, y una reordenación accidental lo rompería sin
    // que nada más se pusiera rojo.
    //
    // ⭐ **Y EL 2026-08-10 VUELVEN A SER TRES: «Generar GML» SE VA A LA BARRA.**
    // No es una vuelta atrás, es la decisión A2: el botón pasa a verse en los TRES
    // pasos, apagado con motivo, en vez de existir solo aquí. Y libera una plaza en
    // un pie cuyo techo el proyecto midió en TRES el 2026-08-08, al meter la
    // segunda puerta del Catastro — una plaza que conviene no gastarse sin pensar.
    //
    // La regla que decide qué sube y qué se queda, en una frase: **arriba lo que
    // sale de la app hacia fuera, abajo lo que transforma el expediente.** Las que
    // quedan producen geometría o parcelario DENTRO del expediente; el GML es un
    // fichero que se entrega.
    //
    // ⭐ **Y EL 2026-08-16 VUELVEN A SER CUATRO: entra «Traer colindantes»**, que
    // hasta ese día vivía en el bloque de Entrada. El motivo largo está en
    // `index.html`; el corto es que las vecinas se piden PARA editar (dianas de
    // enganche del snap) y PARA diagnosticar (invasión a colindantes), y las dos
    // cosas pasan aquí. Cumple además la regla de arriba: no sale nada de la app.
    //
    // ⚠️ **VA ENTRE el fondo y el diagnóstico, y el ORDEN se afirma**: primero el
    // contorno oficial contra el que se mide, luego las vecinas contra las que se
    // mide, y entonces el diagnóstico, que necesita los dos. Una reordenación
    // accidental rompe esto sin que nada más se ponga rojo.
    //
    // ⚠️ Y GASTA LA CUARTA PLAZA de un pie cuyo techo el proyecto midió en TRES el
    // 2026-08-08. El precio en píxeles —el pie medía 209,47 px con dos— no lo puede
    // ver este test: lo mide el guion de humo 16.
    expect([...acciones.querySelectorAll('[data-accion]')].map((b) => b.dataset.accion)).toEqual([
      'traer-fondo-catastral',
      'traer-colindantes',
      'diagnosticar',
      'rehacer-parcelario',
    ])
  })

  it('⛔ el `data-accion` del fondo NO es el de Entrada (contrato K.1)', () => {
    // Con las dos pantallas montadas a la vez `querySelector` devuelve la PRIMERA
    // del documento aunque esté `hidden`. Si estos dos valores coincidieran, los
    // clics del botón de Validación —el que CONSERVA la medición— irían a parar al
    // de Entrada, que la SUSTITUYE: el defecto que la feature cierra, servido por
    // el propio arreglo. Y sería mudo: ninguna otra prueba lo vería.
    montarCascara()
    const acciones = [...document.querySelectorAll('[data-accion]')].map((b) => b.dataset.accion)
    expect(acciones).toContain('cargar-catastro')
    expect(acciones).toContain('traer-fondo-catastral')
    expect(new Set(acciones).size, `hay data-accion repetidos: ${acciones}`).toBe(acciones.length)
  })

  it('⛔ cada renglón de acuse se ve en las MISMAS pantallas que su botón', () => {
    // Un `role="status"` oculto es un mensaje que nadie lee: la aplicación creería
    // haber avisado. Es la regla de oro 1 rota en el sitio donde menos se nota,
    // y el guion 10 ya la cazó una vez en F08 (el acuse de la descarga del
    // informe, escrito en un renglón invisible).
    montarCascara()

    // ⚠️ **`generar-gml` estuvo aquí como EXCEPCIÓN con nombre durante un día, y
    // se retiró el 2026-08-10 porque dejó de hacer falta.** Su botón se había ido a
    // la barra —o sea que se ve en los TRES pasos— y su acuse se quedó en
    // `.gml-acciones[data-pantalla="edicion"]`, que solo se ve en uno. El parche de
    // entonces fue copiar el texto arriba, en el renglón de la barra; el arreglo de
    // ahora es mudar el NODO, que cuelga del `<footer>` y no de la pantalla. Así la
    // regla general vuelve a cubrirlo sin excepción ninguna, que es donde tenía que
    // haber estado desde el principio.

    for (const boton of document.querySelectorAll('[data-accion]')) {
      const renglon = document.querySelector(`[data-estado="${boton.dataset.accion}"]`)
      if (renglon === null) continue
      expect(
        visibleEn(renglon),
        `el acuse de «${boton.dataset.accion}» se ve en otras pantallas que su botón`,
      ).toEqual(visibleEn(boton))
    }

    // Y una comprobación dirigida al caso que motivó todo esto: el botón vive en la
    // barra y su acuse **fuera de toda pantalla**, que es lo único que hace que
    // pulsarlo desde Entrada o Diagnóstico diga algo en alguna parte.
    const botonGml = document.querySelector('[data-accion="generar-gml"]')
    const acuseGml = document.querySelector('[data-estado="generar-gml"]')
    expect(botonGml, 'falta el botón de «generar-gml»').not.toBeNull()
    expect(acuseGml, 'falta el acuse de «generar-gml»').not.toBeNull()
    expect(botonGml.closest('[data-rail="cascara"]')).not.toBeNull()
    expect(
      acuseGml.closest(`[${ATRIBUTO_PANTALLA}]`),
      'el acuse de «generar-gml» ha vuelto a colgar de una pantalla: desde Entrada no se leerá',
    ).toBeNull()
    expect(visibleEn(acuseGml)).toEqual([...PASOS])
  })

  it('las CINCO pantallas conservan el canal de avisos y la cabecera', () => {
    // Lo que NO se reparte, y es deliberado: desaparecer el canal de errores al
    // cambiar de paso sería el peor fallo silencioso que esta cáscara puede
    // tener (lo dice `estilos/app.css` donde declara las cinco reglas).
    //
    // Desde el 2026-08-07 el canal ES la cabecera: los dos chips viven dentro, la
    // lista se abre desde ellos y el bloque de la columna ya no existe. Por eso
    // aquí queda una sola clase donde había dos — y por eso se comprueba también
    // el chip, que es lo que de verdad tiene que verse en las cinco.
    montarCascara()
    for (const clase of ['gml-panel-cabecera']) {
      const nodo = document.querySelector('.' + clase)
      expect(nodo, `falta «${clase}»`).not.toBeNull()
      expect(visibleEn(nodo), `«${clase}» ha dejado de estar en las cinco`).toEqual([...PASOS])
    }
    const chip = document.querySelector('.gml-chip[data-contador="ERROR"]')
    expect(visibleEn(chip), 'el contador de errores ha dejado de estar en las cinco').toEqual([
      ...PASOS,
    ])
  })
})
