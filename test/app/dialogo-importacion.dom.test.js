/* -------------------------------------------------------------------------- *
 * test/app/dialogo-importacion.dom.test.js — F18 · T1                         *
 *                                                                            *
 * `app/dialogo-importacion.js` es la UI que F01 pidió y nunca se construyó:   *
 * la que enseña las detecciones defensivas y deja ACEPTAR la corrección que   *
 * `importar()` lleva once fases ofreciendo sin que nadie pudiera cogerla.     *
 *                                                                            *
 * Lo que puede salir mal aquí es de la familia «la pantalla dice una cosa y   *
 * el fichero entra siendo otra»:                                             *
 *                                                                            *
 *   · una corrección que se aplica sin que nadie la haya marcado;            *
 *   · un botón apagado sin decir por qué;                                    *
 *   · preguntar por el cierre de anillos que el usuario está a punto de       *
 *     descartar al elegir capa;                                              *
 *   · obligar a elegir huso, que es justo lo que F01 prohíbe;                *
 *   · y un diálogo que se abre sin nada que decidir, o que no se abre         *
 *     cuando sí lo hay.                                                       *
 *                                                                            *
 * ⭐ **Las pruebas van contra `UTM.dxf`, el único plano de trabajo REAL que   *
 * tiene el proyecto.** Un DXF de juguete con dos capas demuestra que el       *
 * repartidor compila; éste tiene 25 polilíneas en 5 capas, cajetín, leyenda,  *
 * 3 INSERT y 136 anotaciones, y **la parcela de verdad está en la capa `0`**  *
 * y no en la que se llama `PARCELA`.                                          *
 *                                                                            *
 * ── LO QUE JSDOM NO DA DE `<dialog>` ──────────────────────────────────────── *
 * Medido en F09 y sigue igual: el prototipo tiene EXACTAMENTE `constructor` y  *
 * `open`. Ni `showModal()`, ni `close()`, ni `cancel`. Por eso el módulo       *
 * detecta la capacidad, cae al atributo `open` e implementa él mismo `Escape`. *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { superficie } from '../../geo/area.js'
import {
  LECTURA_CIERRE,
  TIPO_DECISION,
  crearDialogoImportacion,
  decisionesDe,
  hayQueDecidir,
} from '../../app/dialogo-importacion.js'
import { BLOQUEOS, importar } from '../../parsers/importar.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const leerFixture = (n) => readFileSync(join(RAIZ, 'test', 'fixtures', 'parsers', n), 'utf8')

const UTM_DXF = leerFixture('UTM.dxf')
const PARCELA_TXT = leerFixture('PARCELA.txt')

/** Un anillo cuadrado en UTM 30N realista, ABIERTO. */
const CUADRADO = '440123.45 4470987.65\n440133.45 4470987.65\n440133.45 4470997.65\n440123.45 4470997.65'

/** El mismo cuadrado con el último vértice a 4 cm del primero: banda ambigua. */
const CIERRE_AMBIGUO = `${CUADRADO}\n440123.48 4470987.68`

/** El mismo cuadrado con el Este y el Norte cambiados de sitio. */
const INVERTIDO = CUADRADO.split('\n')
  .map((l) => l.split(' ').reverse().join(' '))
  .join('\n')

const txt = (texto, opts = {}) => importar(texto, { formato: 'TXT', ...opts })

let dialogo = null

beforeEach(() => {
  document.body.replaceChildren()
})

afterEach(() => {
  dialogo?.destruir()
  dialogo = null
  vi.restoreAllMocks()
})

// ═════════════════════════════════════════════════════════════════════════════
// 1 · `decisionesDe` — la función pura, que es quien decide si hay pantalla
// ═════════════════════════════════════════════════════════════════════════════

describe('dialogo-importacion · decisionesDe', () => {
  it('⭐ con `UTM.dxf` pregunta por la capa, y por ESO SOLO', () => {
    // El corazón de la decisión de diseño. Medido el 2026-08-06: sin elegir capa
    // ese fichero produce 27 detecciones, 8 de ellas avisos de cierre ambiguo de
    // anillos del cajetín y de la leyenda. Preguntar por ellos antes de saber qué
    // capa entra es pedirle al usuario que decida sobre lo que va a descartar.
    const { decisiones } = decisionesDe(importar(UTM_DXF))

    expect(decisiones).toHaveLength(1)
    expect(decisiones[0].tipo).toBe(TIPO_DECISION.CAPA)
    // Y en particular NO se le pregunta por el cierre, que sí está detectado.
    expect(decisiones.map((d) => d.tipo)).not.toContain(TIPO_DECISION.CIERRE)
  })

  it('las cinco capas salen con su recuento y ordenadas de más a menos anillos', () => {
    const [capa] = decisionesDe(importar(UTM_DXF)).decisiones
    expect(capa.opciones).toEqual([
      { nombre: 'FINO', anillos: 16 },
      { nombre: 'LINDE', anillos: 4 },
      { nombre: 'PARCELA', anillos: 3 },
      { nombre: '0', anillos: 1 },
      { nombre: 'BLANCO', anillos: 1 },
    ])
    // Anti-vacuidad del orden: 25 polilíneas en total, como midió F11.
    expect(capa.opciones.reduce((s, c) => s + c.anillos, 0)).toBe(25)
  })

  it('el motivo de que no haya entrado nada viaja CON la pregunta de la capa', () => {
    // `SUPERFICIE_NO_POSITIVA` no se lista como bloqueo aparte: su salida es
    // justamente elegir capa, así que se dice dentro de ese grupo. Separarlos daría
    // dos mensajes ciertos que juntos parecen contradecirse (lección M28 de F11).
    const { decisiones, bloqueos } = decisionesDe(importar(UTM_DXF))
    expect(decisiones[0].nota).toMatch(/no da una superficie positiva/i)
    expect(bloqueos.map((b) => b.codigo)).not.toContain(BLOQUEOS.SUPERFICIE_NO_POSITIVA)
  })

  it('un volcado limpio no tiene NADA que decidir: entra directo', () => {
    expect(hayQueDecidir(txt(CUADRADO))).toBe(false)
    expect(decisionesDe(txt(CUADRADO)).decisiones).toEqual([])
  })

  it('X/Y invertidas y cierre ambiguo SÍ abren pantalla', () => {
    expect(decisionesDe(txt(INVERTIDO)).decisiones.map((d) => d.tipo)).toContain(
      TIPO_DECISION.SWAP_XY,
    )
    const cierre = decisionesDe(txt(CIERRE_AMBIGUO)).decisiones.find(
      (d) => d.tipo === TIPO_DECISION.CIERRE,
    )
    expect(cierre).toBeDefined()
    expect(cierre.anillos).toBe(1)
    expect(cierre.errorMaximo).toBeCloseTo(0.0424, 3)
  })

  it('⛔ el huso NO dispara la pantalla por sí solo — es la regla de F01', () => {
    // «Nunca obligar a elegirlo en un desplegable […]; el desplegable queda como
    // anulación» (spec/feature-01-entrada-parcela.md:29). `importar()` ya resuelve
    // el prioritario y CONSTRUYE la parcela: parar el recorrido para preguntar sería
    // desobedecer la ficha y estorbar en el camino feliz.
    const limpio = txt(CUADRADO)
    const ambiguo = limpio.detecciones.some((d) => d.tipo === 'HUSO_AMBIGUO')

    expect(ambiguo).toBe(true) // el fixture SÍ es ambiguo: la prueba no es vacua
    expect(limpio.resumen.construida).toBe(true) // y aun así entra
    expect(hayQueDecidir(limpio)).toBe(false) // y no se pregunta
  })

  it('…pero si la pantalla ya está abierta, el huso aparece como ANULACIÓN', () => {
    const conCierre = decisionesDe(txt(CIERRE_AMBIGUO)).decisiones
    const huso = conCierre.find((d) => d.tipo === TIPO_DECISION.HUSO)
    expect(huso).toBeDefined()
    expect(huso.prioritario).toBe(30)
    expect(huso.candidatos.map((c) => c.zona)).toEqual([30, 31])
  })

  it('los bloqueos sin corrección se dicen con su salida, no con un botón muerto', () => {
    // ⛔ RETRACTADO EN F19. Aquí el caso de ejemplo eran unos grados de Málaga, y
    // la prueba afirmaba: «No se ofrece proyectar porque `importar()` no sabe: se
    // dice qué hacer». Era cierto y ya no lo es —F19 escribió la proyección—, así
    // que el mismo fichero pasa de bloqueo a DECISIÓN y hace falta un caso que de
    // verdad no tenga salida. Canarias lo es, y por escrito (override O13).
    const canarias = decisionesDe(txt('-15.42 28.12\n-15.41 28.12\n-15.41 28.13\n-15.42 28.13'))
    const codigos = canarias.bloqueos.map((b) => b.codigo)

    expect(codigos).toContain(BLOQUEOS.COORDENADAS_EN_GRADOS)
    expect(canarias.decisiones).toEqual([])
    const mensaje = canarias.bloqueos.find(
      (b) => b.codigo === BLOQUEOS.COORDENADAS_EN_GRADOS,
    ).mensaje
    expect(mensaje).toMatch(/UTM/)
    expect(mensaje).toMatch(/vuelve a exportar/i)
    // Y NOMBRA Canarias en vez de decir «no cae en España», que sobre unas
    // coordenadas de Las Palmas es cierto de una forma que no ayuda a nadie.
    expect(mensaje).toMatch(/Canarias/)
  })

  it('F19 · unos grados de la Península son una DECISIÓN, y la única de la pantalla', () => {
    const malaga = decisionesDe(txt('-4.42 36.72\n-4.41 36.72\n-4.41 36.73\n-4.42 36.73'))

    expect(malaga.decisiones).toHaveLength(1)
    const [d] = malaga.decisiones
    expect(d.tipo).toBe(TIPO_DECISION.GRADOS)
    expect(d.situacion.zona).toBe(30)
    expect(d.situacion.proyectable).toBe(true)
    // ⛔ Y el bloqueo NO se enseña además: tendría al usuario leyendo «vuelve a
    // exportar desde tu CAD» justo encima del botón que lo arregla.
    expect(malaga.bloqueos.map((b) => b.codigo)).not.toContain(BLOQUEOS.COORDENADAS_EN_GRADOS)
  })

  it('F19 · la pantalla enseña DÓNDE cae antes de proyectar, y ofrece no hacerlo', () => {
    const dialogo = crearDialogoImportacion({ documento: document })
    const malaga = txt('-4.42 36.72\n-4.41 36.72\n-4.41 36.73\n-4.42 36.73')
    dialogo.abrir({ nombre: 'gps.txt', resultado: malaga })

    const texto = dialogo.nodo.textContent
    expect(texto).toMatch(/36\.72/) // la latitud donde ha caído
    expect(texto).toMatch(/huso 30/)
    expect(texto).toMatch(/EPSG:25830/)
    // La opción marcada de salida es NO tocar el dato (regla de oro 1).
    const marcado = dialogo.nodo.querySelector('input[data-campo="grados"]:checked')
    expect(marcado.value).toBe('no')
    dialogo.destruir()
  })

  it('F19 · y si vienen al revés (lat, lon) se dice, en vez de callarlo', () => {
    const dialogo = crearDialogoImportacion({ documento: document })
    dialogo.abrir({
      nombre: 'gps.txt',
      resultado: txt('36.72 -4.42\n36.72 -4.41\n36.73 -4.41\n36.73 -4.42'),
    })
    expect(dialogo.nodo.textContent).toMatch(/al rev[ée]s/i)
    dialogo.destruir()
  })

  it('las informativas no repiten, y las que acompañan a un bloqueo no salen dos veces', () => {
    const { informativas } = decisionesDe(importar(UTM_DXF))
    // `UTM.dxf` trae TRES INSERT, cada uno con su detección y el MISMO mensaje.
    const insert = informativas.filter((m) => m.includes('INSERT'))
    expect(insert).toHaveLength(1)
    // Y el mensaje del reparto de superficie, que lleva `datos.bloqueo`, no está.
    expect(informativas.some((m) => m.includes('-390'))).toBe(false)
  })

  it('no revienta con una entrada inservible: es la puerta de un fichero de fuera', () => {
    for (const v of [null, undefined, {}, { detecciones: null, resumen: null }]) {
      expect(() => decisionesDe(v)).not.toThrow()
      expect(decisionesDe(v).decisiones).toEqual([])
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · La pantalla: lo que se ve y lo que devuelve
// ═════════════════════════════════════════════════════════════════════════════

describe('dialogo-importacion · la pantalla', () => {
  const abrirCon = (texto, opts) => {
    dialogo = crearDialogoImportacion({ documento: document })
    const resultado = typeof texto === 'string' ? importar(texto, opts) : texto
    const promesa = dialogo.abrir({ nombre: 'UTM.dxf', resultado })
    return { promesa, nodo: dialogo.nodo }
  }

  it('nace fuera del DOM de `index.html`: se fabrica sola y se cuelga del body', () => {
    dialogo = crearDialogoImportacion({ documento: document })
    expect(dialogo.nodo.tagName).toBe('DIALOG')
    expect(dialogo.nodo.parentElement).toBe(document.body)
    expect(dialogo.nodo.getAttribute('aria-modal')).toBe('true')
    expect(dialogo.nodo.getAttribute('aria-labelledby')).toBeTruthy()
  })

  it('⭐ pinta las cinco capas de `UTM.dxf` con su nombre LITERAL entre comillas', () => {
    const { nodo } = abrirCon(UTM_DXF)
    const opciones = [...nodo.querySelectorAll('input[data-campo="capa"]')].map((i) => i.value)
    expect(opciones).toEqual(['FINO', 'LINDE', 'PARCELA', '0', 'BLANCO'])
    // Entre comillas para que una capa `0` y otra `  0 ` no se vean iguales.
    expect(nodo.textContent).toContain('«0»')
    expect(nodo.textContent).toContain('16 polilíneas')
  })

  it('«Importar» NACE APAGADO y con el motivo escrito, no mudo', () => {
    const { nodo } = abrirCon(UTM_DXF)
    const boton = nodo.querySelector('[data-accion="importar-medicion"]')
    const estado = nodo.querySelector('[data-estado="dialogo-importacion"]')

    expect(boton.disabled).toBe(true)
    expect(estado.textContent).toMatch(/elige una capa/i)
    expect(estado.getAttribute('role')).toBe('status')
  })

  it('al marcar una capa se enciende el botón y el motivo desaparece', () => {
    const { nodo } = abrirCon(UTM_DXF)
    const cero = [...nodo.querySelectorAll('input[data-campo="capa"]')].find((i) => i.value === '0')
    cero.checked = true
    cero.dispatchEvent(new Event('change', { bubbles: true }))

    expect(nodo.querySelector('[data-accion="importar-medicion"]').disabled).toBe(false)
    expect(nodo.querySelector('[data-estado="dialogo-importacion"]').textContent).toBe('')
  })

  it('⭐ resuelve con las opciones de `importar()`, y solo con las decididas', async () => {
    const { promesa, nodo } = abrirCon(UTM_DXF)
    const cero = [...nodo.querySelectorAll('input[data-campo="capa"]')].find((i) => i.value === '0')
    cero.checked = true
    cero.dispatchEvent(new Event('change', { bubbles: true }))
    nodo.querySelector('[data-accion="importar-medicion"]').click()

    // Ni una clave de más: mandar `compensarCierre: false` sin que nadie lo haya
    // decidido sería afirmar algo que el usuario no ha dicho.
    await expect(promesa).resolves.toEqual({ capa: '0' })
  })

  it('el cierre se traduce a la opción correcta de `importar()`, una por lectura', async () => {
    for (const [lectura, esperado] of [
      [LECTURA_CIERRE.DEJAR, {}],
      [LECTURA_CIERRE.COMPENSAR, { compensarCierre: true }],
      [LECTURA_CIERRE.RETIRAR, { retirarCierre: true }],
    ]) {
      const { promesa, nodo } = abrirCon(CIERRE_AMBIGUO, { formato: 'TXT' })
      const radio = [...nodo.querySelectorAll('input[data-campo="cierre"]')].find(
        (i) => i.value === lectura,
      )
      radio.checked = true
      radio.dispatchEvent(new Event('change', { bubbles: true }))
      nodo.querySelector('[data-accion="importar-medicion"]').click()

      // El huso sale como anulación con su valor por defecto: forma parte del
      // desenlace y por eso se compara contra el esperado MÁS el huso.
      await expect(promesa).resolves.toEqual({ ...esperado, huso: 30 })
      dialogo.destruir()
      dialogo = null
    }
  })

  it('X/Y solo se intercambian si se marca: por defecto NO se toca el dato', async () => {
    const { promesa, nodo } = abrirCon(INVERTIDO, { formato: 'TXT' })
    expect(nodo.querySelector('input[data-campo="swap"][value="no"]').checked).toBe(true)
    nodo.querySelector('[data-accion="importar-medicion"]').click()
    const opts = await promesa
    expect(opts.intercambiarXY).toBeUndefined()
  })

  it('«Cancelar» y `Escape` resuelven con `null`, y no importan nada', async () => {
    const cancelado = abrirCon(UTM_DXF)
    cancelado.nodo.querySelector('[data-accion="cancelar-medicion"]').click()
    await expect(cancelado.promesa).resolves.toBeNull()
    dialogo.destruir()
    dialogo = null

    const conEscape = abrirCon(UTM_DXF)
    conEscape.nodo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await expect(conEscape.promesa).resolves.toBeNull()
  })

  it('soltar un segundo fichero cancela la promesa del primero, sin dejarla colgando', async () => {
    dialogo = crearDialogoImportacion({ documento: document })
    const primera = dialogo.abrir({ nombre: 'a.dxf', resultado: importar(UTM_DXF) })
    const segunda = dialogo.abrir({ nombre: 'b.dxf', resultado: importar(UTM_DXF) })

    await expect(primera).resolves.toBeNull()
    expect(dialogo.nodo.textContent).toContain('b.dxf')

    dialogo.nodo.querySelector('[data-accion="cancelar-medicion"]').click()
    await expect(segunda).resolves.toBeNull()
  })

  it('`destruir` resuelve lo que hubiera abierto y se quita del DOM', async () => {
    const { promesa } = abrirCon(UTM_DXF)
    dialogo.destruir()
    await expect(promesa).resolves.toBeNull()
    expect(document.body.contains(dialogo.nodo)).toBe(false)
    dialogo = null
  })

  it('abrirla sin nada que decidir es un defecto de PROGRAMACIÓN, y se dice', async () => {
    const alAvisar = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    dialogo = crearDialogoImportacion({ documento: document, alAvisar })

    // Resuelve con `{}` —el fichero entra igual, no se castiga al usuario por un
    // fallo nuestro— pero lo cuenta por el panel y por la consola.
    await expect(dialogo.abrir({ nombre: 'x.txt', resultado: txt(CUADRADO) })).resolves.toEqual({})
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalled()
  })

  it('el fichero se nombra SIEMPRE: dos ficheros seguidos abren la misma pantalla', () => {
    const { nodo } = abrirCon(UTM_DXF)
    expect(nodo.textContent).toContain('UTM.dxf')
    expect(nodo.textContent).toContain('DXF')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · ⭐ Que lo que sale de la pantalla sirva de verdad
// ═════════════════════════════════════════════════════════════════════════════
//
// Las pruebas de arriba miden la pantalla. Ésta mide que la pantalla no sea un
// adorno: que las opciones que devuelve, pasadas a `importar()`, produzcan LA
// PARCELA BUENA. Sin esto, todo lo anterior podría estar verde con un diálogo
// que devuelve una capa que no sirve.

describe('dialogo-importacion · la elección produce la parcela correcta', () => {
  it('⭐ elegir «0» en `UTM.dxf` da la parcela real, con superficie POSITIVA', async () => {
    dialogo = crearDialogoImportacion({ documento: document })
    const promesa = dialogo.abrir({ nombre: 'UTM.dxf', resultado: importar(UTM_DXF) })
    const cero = [...dialogo.nodo.querySelectorAll('input[data-campo="capa"]')].find(
      (i) => i.value === '0',
    )
    cero.checked = true
    cero.dispatchEvent(new Event('change', { bubbles: true }))
    dialogo.nodo.querySelector('[data-accion="importar-medicion"]').click()

    const definitivo = importar(UTM_DXF, await promesa)

    expect(definitivo.resumen.bloqueos).toEqual([])
    expect(definitivo.resumen.construida).toBe(true)
    // ⛔ El guardián de la regresión que arregló F11: `importar()` construía
    // parcelas de superficie NEGATIVA en silencio (−390,45 m² con este fichero).
    expect(superficie(definitivo.parcela.recintos)).toBeGreaterThan(0)
    expect(superficie(definitivo.parcela.recintos)).toBeCloseTo(61.045, 3)
  })

  it('⭐ y es LA MISMA parcela que `PARCELA.txt`, que es la verdad externa que hay', () => {
    // La prueba de que la capa «0» es la buena no es que construya —`BLANCO`
    // también construye, 15,00 m²— sino que coincide con el volcado de coordenadas
    // del mismo levantamiento. Es lo que F11 midió y aquí queda atado.
    const porDxf = importar(UTM_DXF, { capa: '0' })
    const porTxt = importar(PARCELA_TXT, { formato: 'TXT' })

    expect(porDxf.resumen.nVertices).toEqual(porTxt.resumen.nVertices)
    expect(superficie(porDxf.parcela.recintos)).toBeCloseTo(
      superficie(porTxt.parcela.recintos),
      3,
    )

    // Vértice a vértice, a la precisión con la que el TXT los publica.
    const r4 = (anillo) => anillo.map((p) => p.map((n) => Number(n.toFixed(4))))
    expect(r4(porDxf.parcela.recintos[0].vertices)).toEqual(r4(porTxt.parcela.recintos[0].vertices))
  })

  it('⚠️ elegir mal la capa NO se disimula: «PARCELA» sigue sin construir, y lo dice', () => {
    // Anti-vacuidad de la prueba anterior y del apunte de la pantalla: el nombre de
    // la capa no garantiza nada. Con «PARCELA» quedan tres anillos disjuntos.
    //
    // ⭐ **F22 · y ahora el motivo es el que este comentario decía desde F11.** Era
    // `SUPERFICIE_NO_POSITIVA` —la consecuencia de leer tres fincas como un
    // contorno con huecos— y es `VARIOS_RECINTOS_DISJUNTOS`, que es la causa.
    const mal = importar(UTM_DXF, { capa: 'PARCELA' })
    expect(mal.resumen.construida).toBe(false)
    expect(mal.resumen.bloqueos).toContain(BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS)

    // Y la pantalla NO se queda muda: el bloqueo tiene su texto y dice el hecho.
    const { bloqueos, decisiones } = decisionesDe(mal)
    expect(decisiones).toEqual([])
    expect(bloqueos.map((b) => b.codigo)).toEqual([BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS])
    expect(bloqueos[0].mensaje).toContain('fincas separadas')
  })

  it('⛔ y el texto de ese bloqueo NO puede seguir diciendo que la elección no existe', () => {
    // **Este guardián existe porque el texto se quedó caduco.** La fase 1 lo
    // escribió declarándolo provisional —«todavía no se puede elegir cuál desde
    // aquí»— para que la pantalla no se quedara muda antes de que la elección
    // existiera, y las fases 3 y 4 la construyeron sin que nadie volviera aquí.
    // Un texto con fecha de caducidad declarada y sin guardián caduca en silencio.
    const mensaje = decisionesDe(importar(UTM_DXF, { capa: 'PARCELA' })).bloqueos[0].mensaje

    // Se acusa por la AFIRMACIÓN y no por la palabra: lo prohibido es negar que se
    // pueda elegir, en cualquiera de sus formas.
    expect(/no se puede elegir|no puedes elegir|todav[íi]a no/i.test(mensaje)).toBe(false)
    // Y lo exigido es que diga dónde se elige, que es lo que la fase 3 construyó.
    expect(/caj[óo]n/i.test(mensaje)).toBe(true)
  })
})
