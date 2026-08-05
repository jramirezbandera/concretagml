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

import { PASO, PASOS, crearNavegacion } from '../../app/navegacion.js'
import {
  ATRIBUTO_PANTALLA,
  ATRIBUTO_PASO,
  SELECTOR_APP,
  SELECTOR_TITULO,
  TITULO_PANTALLA,
  cablearPantalla,
  pasosConTitulo,
} from '../../app/pantalla.js'
import { SELECTOR_RAIL } from '../../app/rail.js'

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

const TODO = { geometria: true, oficial: true, diagnostico: true }

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
    const rail = document.querySelector(SELECTOR_RAIL)
    expect(rail).not.toBeNull()
    expect(rail.querySelectorAll(`[${ATRIBUTO_PANTALLA}]`)).toHaveLength(0)
  })

  it('los canales que NO pueden desaparecer no declaran pantalla', () => {
    montarCascara()
    // Los avisos son el canal de errores de la aplicación entera: esconderlo al
    // cambiar de paso sería el peor fallo silencioso que esta cáscara puede tener.
    for (const selector of ['.gml-bloque--avisos', '.gml-panel-cabecera']) {
      const nodo = document.querySelector(selector)
      expect(nodo, `${selector} ha desaparecido de index.html`).not.toBeNull()
      expect(
        nodo.hasAttribute(ATRIBUTO_PANTALLA),
        `${selector} declara pantalla, así que desaparece en las demás`,
      ).toBe(false)
    }
  })

  it('la Entrada y la caja de vértices están en pantallas DISTINTAS', () => {
    // Es la afirmación entera de T6: si las dos se vieran a la vez, las tres vías
    // no tendrían sitio y volveríamos al panel de siempre.
    montarCascara()
    const entrada = document.querySelector('.gml-bloque--catastro').getAttribute(ATRIBUTO_PANTALLA)
    const vertices = document.querySelector('.gml-bloque--vertices').getAttribute(ATRIBUTO_PANTALLA)
    expect(entrada.split(/\s+/)).toContain(PASO.ENTRADA)
    expect(vertices.split(/\s+/)).not.toContain(PASO.ENTRADA)
    expect(vertices.split(/\s+/)).toContain(PASO.VALIDACION)
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
    for (const clase of ['gml-bloque--vertices', 'gml-bloque--contraste']) {
      expect(CSS, `.${clase} ha dejado de ser el estirador de su pantalla`).toMatch(
        new RegExp(`\\.${clase}\\s*\\{[^}]*flex:\\s*1 1 auto`),
      )
    }
  })

  it('⛔ los avisos siguen SIN declarar pantalla: solo se colapsan VACÍOS', () => {
    // El autor pidió que el contraste sustituyera «a los vértices y avisos». Los
    // vértices se van con `data-pantalla`; los avisos NO pueden, porque son el
    // canal de errores de la aplicación entera —`app/cableado-diagnostico.js` manda
    // ahí los fallos del cálculo y del informe, y sus renglones dicen «Mira el
    // panel de avisos»—. Lo que se oculta es el bloque cuando no tiene nada que
    // decir, por el mismo nodo (`.gml-avisos-vacio`) que fabrica `app/avisos.js`,
    // así que la regla y la lista no pueden divergir.
    montarCascara()
    expect(document.querySelector('.gml-bloque--avisos').hasAttribute(ATRIBUTO_PANTALLA)).toBe(false)
    expect(CSS).toContain(
      `.gml-app[data-paso='${PASO.DIAGNOSTICO}'] .gml-bloque--avisos:has(.gml-avisos-vacio)`,
    )
  })

  it('el pie del panel tampoco está en Entrada (mide 266 px y no cabía)', () => {
    montarCascara()
    const pie = document.querySelector('.gml-panel-pie')
    expect(pie.getAttribute(ATRIBUTO_PANTALLA).split(/\s+/)).not.toContain(PASO.ENTRADA)
    // Y sigue CONECTADO con todo su cableado: se oculta, no se quita.
    expect(pie.isConnected).toBe(true)
    expect(pie.querySelector('[data-accion="generar-gml"]')).not.toBeNull()
    expect(pie.querySelectorAll('[data-ficha]').length).toBeGreaterThan(0)
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
        PASO.INFORME,
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
    navegacion.navegarAPaso(PASO.INFORME)
    expect(titulo().textContent).toBe(TITULO_PANTALLA[PASO.INFORME])

    pantalla.destruir()
    pantalla.destruir()
    vivo = null

    expect(raiz().hasAttribute(ATRIBUTO_PASO)).toBe(false)
    expect(titulo().textContent).toBe(TITULO_PANTALLA[PASO.ENTRADA])
    // Y no se queda escuchando.
    navegacion.navegarAPaso(PASO.VALIDACION)
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
    expect(vias.map((v) => v.querySelector('h2').textContent.trim())).toEqual([
      'Referencia catastral',
      'Medición propia',
      'Comprobar un GML existente',
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

  it('la cuarta vía existe y va aparte: recuperar no es empezar', () => {
    montarCascara()
    const pie = document.querySelector('.gml-entrada-pie')
    expect(pie).not.toBeNull()
    expect(pie.querySelector('[data-accion="abrir-expediente"]')).not.toBeNull()
    expect(pie.closest('.gml-via')).toBeNull()
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
    for (const campo of ['srs', 'refcat', 'vertices', 'superficie', 'perimetro']) {
      expect(donde[campo], `«${campo}» es un hecho de la geometría`).toEqual([
        PASO.VALIDACION,
        PASO.EDICION,
        PASO.INFORME,
      ])
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
    // vez de contarlas—. Queda Informe, que es la única pantalla donde la ficha
    // es lo que las dice.
    montarCascara()
    const donde = Object.fromEntries(paresDeLaFicha().map(({ campo, dd }) => [campo, visibleEn(dd)]))
    for (const campo of ['superficie-catastral', 'delta-catastral', 'colindantes']) {
      expect(donde[campo], `«${campo}» no se ve donde debe`).toEqual([PASO.INFORME])
    }
  })

  it('las acciones del pie son de VALIDACIÓN y de ninguna otra', () => {
    montarCascara()
    const acciones = document.querySelector('.gml-acciones')
    expect(acciones).not.toBeNull()
    expect(visibleEn(acciones)).toEqual([PASO.VALIDACION])
    // Y siguen siendo las dos: «Generar GML» se queda aquí por decisión del autor
    // (el camino corto de una Subsanación no pasa por el diagnóstico).
    expect([...acciones.querySelectorAll('[data-accion]')].map((b) => b.dataset.accion)).toEqual([
      'generar-gml',
      'diagnosticar',
    ])
  })

  it('⛔ cada renglón de acuse se ve en las MISMAS pantallas que su botón', () => {
    // Un `role="status"` oculto es un mensaje que nadie lee: la aplicación creería
    // haber avisado. Es la regla de oro 1 rota en el sitio donde menos se nota,
    // y el guion 10 ya la cazó una vez en F08 (el acuse de la descarga del
    // informe, escrito en un renglón invisible).
    montarCascara()
    for (const boton of document.querySelectorAll('[data-accion]')) {
      const renglon = document.querySelector(`[data-estado="${boton.dataset.accion}"]`)
      if (renglon === null) continue
      expect(
        visibleEn(renglon),
        `el acuse de «${boton.dataset.accion}» se ve en otras pantallas que su botón`,
      ).toEqual(visibleEn(boton))
    }
  })

  it('las CINCO pantallas conservan el canal de avisos y la cabecera', () => {
    // Lo que NO se reparte, y es deliberado: desaparecer el canal de errores al
    // cambiar de paso sería el peor fallo silencioso que esta cáscara puede
    // tener (lo dice `estilos/app.css` donde declara las cinco reglas).
    montarCascara()
    for (const clase of ['gml-bloque--avisos', 'gml-panel-cabecera']) {
      const nodo = document.querySelector('.' + clase)
      expect(nodo, `falta «${clase}»`).not.toBeNull()
      expect(visibleEn(nodo), `«${clase}» ha dejado de estar en las cinco`).toEqual([...PASOS])
    }
  })
})
