/* -------------------------------------------------------------------------- *
 * test/app/dialogo-informe.dom.test.js — F09 · T4.1                            *
 *                                                                              *
 * `app/dialogo-informe.js` es la última pantalla antes de que alguien firme un  *
 * documento, y casi todo lo que puede salir mal en ella es invisible: un campo  *
 * prerrellenado con «No consta» que acaba impreso como si fuera el nombre del   *
 * municipio; una advertencia de «esto lo hemos PROPUESTO, no medido» que        *
 * desaparece en cuanto el usuario reescribe el párrafo; un botón apagado sin    *
 * decir por qué; un `Escape` que se lleva media hora de correcciones.           *
 *                                                                              *
 * ── LO QUE JSDOM NO DA DE `<dialog>`, Y POR QUÉ ESTÁ ESCRITO AQUÍ ──────────── *
 * MEDIDO el 2026-08-02 sobre jsdom 29.1.1: `HTMLDialogElement` existe y su      *
 * prototipo tiene EXACTAMENTE dos entradas —`constructor` y `open`—. No hay     *
 * `showModal()`, ni `show()`, ni `close()`, ni `returnValue`, ni los eventos    *
 * `cancel` y `close`, ni capa superior, ni `::backdrop`, ni atrape de foco, ni  *
 * `inert`. Lo único que sí funciona es la hoja del navegador: sin `open`        *
 * computa `display:none` y con `open`, `display:block`.                         *
 *                                                                              *
 * Por eso el módulo detecta la capacidad y cae al atributo `open`, e implementa *
 * él mismo `Escape` y la devolución del foco. Aquí hay una prueba que AFIRMA    *
 * esas ausencias: el día que jsdom implemente `showModal`, esa prueba se pondrá *
 * roja y quien la lea sabrá que puede simplificar el módulo, en vez de          *
 * descubrirlo por casualidad tres fases más tarde.                             *
 *                                                                              *
 * Lo que NO se puede medir aquí y se queda para el guion de navegador: que el   *
 * modal atrape de verdad el foco, que el velo se pinte y que el diálogo salga   *
 * por encima de los controles de Leaflet.                                       *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  crearDialogoInforme,
  CLASE,
  CLASE_REUTILIZADA,
  SELECTOR,
  selectorEncabezado,
  selectorFirma,
  CAMPOS_EDITABLES,
  MOTIVO_CIERRE,
  MOTIVO_PRESUNCION_SIN_ACUSE,
  SIN_DATOS,
  MENSAJE_OYENTE_ROTO,
  ATRIBUTO_PRESENTACION,
  PRESENTACION,
} from '../../app/dialogo-informe.js'
import {
  CAMPOS_FIRMA,
  componerEncabezado,
  NO_CONSTA,
  NO_CONSULTADO,
  NO_SE_HA_PODIDO_CONSULTAR,
  ROTULO_FIRMA,
  TITULO_FIRMA,
} from '../../report/firma.js'
import { describirLindero, PRESUNCION } from '../../report/literal.js'
import { NIVEL } from '../../viewer/_comun.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** El reloj no se lee en ningún sitio de `report/`: la fecha entra por parámetro. */
const FECHA = new Date(Date.UTC(2026, 7, 2, 17, 4, 53))

/** El sobre del contrato E con datos, tal como lo devuelve `services/`. */
const sobre = (datos) => ({ ok: true, motivo: null, mensaje: null, procedencia: 'RED', datos })

/** Encabezado de finca RÚSTICA: las once filas, todas con dato. */
const ENCABEZADO_RUSTICA = () => ({
  encabezado: componerEncabezado({
    descriptivos: sobre({
      municipio: 'ALHAURIN DE LA TORRE',
      provincia: 'MALAGA',
      clase: 'RUSTICA',
      domicilio: null,
      paraje: 'LOS TOMILLARES',
      poligono: '8',
      parcela: '98',
    }),
    refcat: '29007A008000980000XY',
    srs: 'EPSG:25830',
    fecha: FECHA,
    idDocumento: null,
  }),
  procedencia: sobre({}),
})

/**
 * Encabezado de finca URBANA. Es la parcela de referencia del proyecto y el caso
 * MEDIDO: el servicio devuelve municipio y provincia, y ni paraje, ni polígono, ni
 * parcela, ni domicilio.
 */
const ENCABEZADO_URBANA = () => {
  const datos = {
    municipio: 'MALAGA',
    provincia: 'MALAGA',
    clase: 'URBANA',
    domicilio: null,
    paraje: null,
    poligono: null,
    parcela: null,
  }
  return {
    encabezado: componerEncabezado({
      descriptivos: sobre(datos),
      refcat: '9398516VK3799G',
      srs: 'EPSG:25830',
      fecha: FECHA,
      idDocumento: null,
    }),
    procedencia: sobre(datos),
  }
}

/** Un borrador de lindero SIN nada propuesto. */
const LINDERO_LIMPIO = () => ({
  texto: 'Linda al Norte, en línea recta de 12,45 m, con la parcela de referencia catastral X.',
  tramos: [
    {
      cardinal: 'Norte',
      azimut: 0,
      longitud: 12.45,
      nLados: 1,
      refcat: 'X',
      label: null,
      indiceInicio: 0,
      indiceFin: 1,
      presuncionNoVerificada: null,
    },
  ],
})

/** Un borrador con DOS tramos propuestos por presunción de vía pública. */
const LINDERO_CON_PRESUNCION = () => ({
  texto:
    'Linda al Sudoeste, en línea quebrada de 9 lados que suman 47,21 m, presumiblemente con ' +
    'vía pública (ninguna parcela catastral colindante alcanza este lindero; dato NO ' +
    'verificado, confirme antes de firmar).',
  tramos: [
    {
      cardinal: 'Sudoeste',
      azimut: 225,
      longitud: 47.21,
      nLados: 9,
      refcat: null,
      label: null,
      indiceInicio: 0,
      indiceFin: 9,
      presuncionNoVerificada: PRESUNCION.VIA_PUBLICA,
    },
    {
      cardinal: 'Este',
      azimut: 90,
      longitud: 8.4,
      nLados: 1,
      refcat: null,
      label: null,
      indiceInicio: 9,
      indiceFin: 10,
      presuncionNoVerificada: PRESUNCION.VIA_PUBLICA,
    },
  ],
})

// ── Arnés ─────────────────────────────────────────────────────────────────────

/** Diálogos vivos de la prueba en curso. Se destruyen en el `afterEach`. */
let pendientes = []

/**
 * Monta el diálogo con un botón «que lo abre» delante, para poder medir la
 * devolución del foco contra algo que no sea el `<body>`.
 */
function montar(opciones = {}) {
  document.body.className = 'gml-app'
  document.body.innerHTML = '<button type="button" id="abridor">Preparar informe</button>'
  const abridor = document.getElementById('abridor')
  const avisos = []
  const dialogo = crearDialogoInforme({
    documento: document,
    alAvisar: (mensaje, detalle) => avisos.push({ mensaje, detalle }),
    ...opciones,
  })
  pendientes.push(dialogo)
  return { dialogo, abridor, avisos, raiz: dialogo.nodo }
}

/** Monta y carga un informe de una sola vez, que es el 90 % de las pruebas. */
function conInforme({ encabezado = ENCABEZADO_RUSTICA(), lindero = LINDERO_LIMPIO(), ...resto } = {}) {
  const arnes = montar()
  arnes.dialogo.fijar({ ...encabezado, lindero, ...resto })
  return arnes
}

const nodo = (raiz, selector) => {
  const el = raiz.querySelector(selector)
  if (el === null) throw new Error(`el selector ${selector} no encuentra nada`)
  return el
}
const texto = (raiz, selector) => nodo(raiz, selector).textContent
const existe = (raiz, selector) => raiz.querySelector(selector) !== null

/** Teclea en un control y dispara el `input`/`change` que emitiría el navegador. */
function teclear(el, valor) {
  el.value = valor
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Marca o desmarca una casilla como lo haría una pulsación. */
function conmutar(casilla, marcada) {
  casilla.checked = marcada
  casilla.dispatchEvent(new Event('change', { bubbles: true }))
}

const escape = (raiz) =>
  raiz.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

beforeEach(() => {
  pendientes = []
})

afterEach(() => {
  for (const d of pendientes) d.destruir()
  pendientes = []
  document.body.innerHTML = ''
  document.body.className = ''
  vi.restoreAllMocks()
})

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Lo que jsdom da y lo que no — MEDIDO, no supuesto
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-informe · el <dialog> de jsdom', () => {
  it('jsdom NO implementa showModal/show/close ni returnValue (medido)', () => {
    // Esta prueba documenta el motivo por el que el módulo detecta capacidades en
    // vez de llamar a `showModal()` a pelo. Si algún día se pone roja, es una buena
    // noticia: significa que jsdom lo ha implementado y la vía de respaldo se puede
    // revisar. Lo que no puede es enterarse nadie.
    const d = document.createElement('dialog')
    expect(typeof d.showModal).toBe('undefined')
    expect(typeof d.show).toBe('undefined')
    expect(typeof d.close).toBe('undefined')
    expect(typeof d.returnValue).toBe('undefined')
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(d))).toEqual(['constructor', 'open'])
  })

  it('lo que SÍ da es la hoja del navegador: `open` gobierna el display', () => {
    // Es lo que sostiene la vía de respaldo del módulo, así que se afirma.
    const d = document.createElement('dialog')
    document.body.appendChild(d)
    expect(getComputedStyle(d).display).toBe('none')
    d.setAttribute('open', '')
    expect(getComputedStyle(d).display).toBe('block')
    d.remove()
  })

  it('tampoco hay `inert`, así que el atrape de foco no se puede medir aquí', () => {
    expect('inert' in document.body).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Contrato del programador
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-informe · contrato del programador', () => {
  it('sin `documento` lanza TypeError nombrando lo que esperaba', () => {
    expect(() => crearDialogoInforme()).toThrow(TypeError)
    expect(() => crearDialogoInforme({})).toThrow(/documento/)
    expect(() => crearDialogoInforme({ documento: 'document' })).toThrow(/Document/)
  })

  it('un canal de avisos que no es función ni nulo lanza en la creación', () => {
    expect(() => crearDialogoInforme({ documento: document, alAvisar: 42 })).toThrow(TypeError)
  })

  it('los tres `alAlgo` exigen función', () => {
    const { dialogo } = montar()
    expect(() => dialogo.alComponer('no')).toThrow(/alComponer/)
    expect(() => dialogo.alRegenerar(null)).toThrow(/alRegenerar/)
    expect(() => dialogo.alCancelar({})).toThrow(/alCancelar/)
  })

  it('`fijar` rechaza una entrada que no es objeto ni null', () => {
    const { dialogo } = montar()
    expect(() => dialogo.fijar('informe')).toThrow(TypeError)
    expect(() => dialogo.fijar({ lindero: LINDERO_LIMPIO() })).toThrow(/encabezado/)
  })

  it('`fijarLindero` rechaza un string suelto, y dice por qué', () => {
    const { dialogo } = conInforme()
    expect(() => dialogo.fijarLindero('Linda al Norte…')).toThrow(TypeError)
    expect(() => dialogo.fijarLindero('Linda al Norte…')).toThrow(/tramos/)
  })

  it('un `fijar` que revienta a mitad NO deja la pantalla con dos documentos', () => {
    // Es la razón por la que las tres validaciones van antes de tocar un nodo: un
    // encabezado nuevo con el lindero del anterior son dos documentos a la vez, y
    // nadie avisando.
    const { dialogo, raiz } = conInforme()
    const antes = nodo(raiz, SELECTOR.LITERAL).value
    const municipioAntes = nodo(raiz, selectorEncabezado('municipio')).value

    const nuevo = ENCABEZADO_URBANA()
    expect(() => dialogo.fijar({ ...nuevo, lindero: 'esto no es un lindero' })).toThrow(TypeError)

    expect(nodo(raiz, SELECTOR.LITERAL).value).toBe(antes)
    expect(nodo(raiz, selectorEncabezado('municipio')).value).toBe(municipioAntes)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Contrato de nodos con el cableado de T5.1
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-informe · contrato de nodos', () => {
  it('los nodos de SELECTOR existen desde el primer instante, sin haber fijado nada', () => {
    // Si solo aparecieran al pintar, el `nodo()` del cableado lanzaría al arrancar.
    const { raiz } = montar()
    for (const [nombre, selector] of Object.entries(SELECTOR)) {
      expect(existe(raiz, selector), `falta ${nombre} (${selector})`).toBe(true)
    }
  })

  it('el `<dialog>` nace cerrado, fuera del flujo y con nombre accesible', () => {
    const { raiz } = montar()
    expect(raiz.tagName).toBe('DIALOG')
    expect(raiz.open).toBe(false)
    expect(raiz.getAttribute('aria-labelledby')).toBe(nodo(raiz, SELECTOR.TITULO).id)
    expect(nodo(raiz, SELECTOR.TITULO).id).not.toBe('')
  })

  it('«Componer PDF» nace APAGADO y con el motivo escrito, no mudo (regla de oro 1)', () => {
    const { dialogo, raiz } = montar()
    expect(dialogo.puedeComponer()).toBe(false)
    expect(nodo(raiz, SELECTOR.COMPONER).disabled).toBe(true)
    expect(texto(raiz, SELECTOR.ESTADO)).toBe(SIN_DATOS)
    // Y el motivo está enlazado al botón, para que un lector de pantalla lo anuncie.
    expect(nodo(raiz, SELECTOR.COMPONER).getAttribute('aria-describedby')).toBe(
      nodo(raiz, SELECTOR.ESTADO).id,
    )
  })

  it('el renglón de estado es un `role="status"` nombrado por COMPONENTE', () => {
    // Lección M8 de F07: `querySelector` se queda con el primero del documento, así
    // que un `[data-estado="componer"]` chocaría con el renglón de una acción
    // homónima del panel y uno de los dos quedaría mudo.
    const { raiz } = montar()
    const estado = nodo(raiz, SELECTOR.ESTADO)
    expect(estado.getAttribute('role')).toBe('status')
    expect(estado.dataset.estado).toBe('dialogo-informe')
  })

  it('dos diálogos en el mismo documento no comparten un solo `id`', () => {
    // Un `<label for>` que apunta al campo del otro diálogo no se ve: el rótulo
    // sigue ahí, solo que pulsarlo enfoca el control equivocado.
    const a = conInforme()
    const b = conInforme()
    const ids = (raiz) => [...raiz.querySelectorAll('[id]')].map((el) => el.id)
    const deA = ids(a.raiz)
    const deB = ids(b.raiz)
    expect(deA.length).toBeGreaterThan(5)
    expect(deA.filter((id) => deB.includes(id))).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · El encabezado
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-informe · el encabezado', () => {
  it('en RÚSTICA se pintan las once filas, paraje y polígono incluidos', () => {
    const { raiz } = conInforme()
    for (const campo of ['municipio', 'provincia', 'clase', 'domicilio', 'paraje', 'poligono', 'parcela', 'refcat', 'srs', 'fecha', 'idDocumento']) {
      expect(existe(raiz, selectorEncabezado(campo)), `falta ${campo}`).toBe(true)
    }
  })

  it('en URBANA no se pintan paraje, polígono ni parcela — y esa lógica NO se duplica', () => {
    // La decide `report/firma.js#lineasEncabezado`: en una urbana esos tres datos no
    // faltan, es que no existen para ella. Este módulo pinta lo que aquél le da.
    const { raiz } = conInforme({ encabezado: ENCABEZADO_URBANA() })
    expect(existe(raiz, selectorEncabezado('paraje'))).toBe(false)
    expect(existe(raiz, selectorEncabezado('poligono'))).toBe(false)
    expect(existe(raiz, selectorEncabezado('parcela'))).toBe(false)
    // Y su sitio lo ocupan la clase y el domicilio, que sí identifican una urbana.
    expect(texto(raiz, selectorEncabezado('clase'))).toBe('URBANA')
    expect(existe(raiz, selectorEncabezado('domicilio'))).toBe(true)
  })

  it('los seis editables son `<input>` y los cinco de la aplicación son texto fijo', () => {
    const { raiz } = conInforme()
    for (const campo of CAMPOS_EDITABLES) {
      expect(nodo(raiz, selectorEncabezado(campo)).tagName, campo).toBe('INPUT')
    }
    for (const campo of ['clase', 'refcat', 'srs', 'fecha', 'idDocumento']) {
      expect(nodo(raiz, selectorEncabezado(campo)).tagName, campo).toBe('P')
    }
  })

  it('`clase` NO se edita: es un vocabulario cerrado que decide qué filas se imprimen', () => {
    expect(CAMPOS_EDITABLES).not.toContain('clase')
    const { raiz } = conInforme()
    expect(nodo(raiz, selectorEncabezado('clase')).tagName).not.toBe('INPUT')
  })

  it('⚠️ un campo que no consta se pinta VACÍO, nunca con «No consta» dentro', () => {
    // Es el fallo más caro de esta pantalla: meter el sustituto en el `<input>`
    // haría que `valores()` devolviera la cadena «No consta» como si fuera el
    // nombre del municipio, y el documento se imprimiría con ella.
    const { dialogo, raiz } = montar()
    dialogo.fijar({
      encabezado: componerEncabezado({
        descriptivos: sobre({
          municipio: 'MALAGA',
          provincia: null,
          clase: 'RUSTICA',
          domicilio: null,
          paraje: null,
          poligono: null,
          parcela: null,
        }),
        refcat: '29007A008000980000XY',
        srs: 'EPSG:25830',
        fecha: FECHA,
        idDocumento: null,
      }),
      procedencia: sobre({}),
      lindero: LINDERO_LIMPIO(),
    })

    const provincia = nodo(raiz, selectorEncabezado('provincia'))
    expect(provincia.value).toBe('')
    expect(provincia.value).not.toBe(NO_CONSTA)
    expect(dialogo.valores().encabezado.provincia).toBeNull()
  })

  it('el sustituto va en un apunte ENLAZADO al campo, y distingue los tres sabores', () => {
    const conProcedencia = (procedencia) => {
      const { dialogo, raiz } = montar()
      dialogo.fijar({
        encabezado: componerEncabezado({ refcat: null, srs: null, fecha: FECHA }),
        procedencia,
        lindero: LINDERO_LIMPIO(),
      })
      const campo = nodo(raiz, selectorEncabezado('municipio'))
      const apunte = raiz.querySelector(`#${campo.getAttribute('aria-describedby')}`)
      return apunte.textContent
    }

    //  2 · se pidió y no vino  ·  3 · no se pidió  ·  y el tercero: falló la consulta.
    expect(conProcedencia(sobre({}))).toBe(NO_CONSTA)
    expect(conProcedencia(null)).toBe(NO_CONSULTADO)
    expect(
      conProcedencia({
        ok: false,
        motivo: 'RED',
        mensaje: 'El servicio del Catastro no ha respondido a tiempo.',
        procedencia: 'RED',
        datos: null,
      }),
    ).toBe(`${NO_SE_HA_PODIDO_CONSULTAR} — El servicio del Catastro no ha respondido a tiempo.`)
  })

  it('un campo con dato NO lleva apunte: el hueco explicado solo aparece si hay hueco', () => {
    const { raiz } = conInforme()
    const municipio = nodo(raiz, selectorEncabezado('municipio'))
    expect(municipio.value).toBe('ALHAURIN DE LA TORRE')
    expect(municipio.hasAttribute('aria-describedby')).toBe(false)
  })

  it('`valores()` recoge lo tecleado y deja intacto lo que la aplicación pone', () => {
    const { dialogo, raiz } = conInforme()
    teclear(nodo(raiz, selectorEncabezado('municipio')), '  Alhaurín   de la  Torre  ')
    teclear(nodo(raiz, selectorEncabezado('paraje')), '')

    const v = dialogo.valores()
    expect(v.encabezado.municipio).toBe('Alhaurín de la Torre')
    // Vaciar un campo lo deja en `null`, no en `''`: es lo que `report/firma.js`
    // sabe imprimir como «No consta».
    expect(v.encabezado.paraje).toBeNull()
    // Y lo que no se edita viaja tal cual, la fecha incluida y siendo el MISMO Date.
    expect(v.encabezado.refcat).toBe('29007A008000980000XY')
    expect(v.encabezado.fecha).toBe(FECHA)
    expect(v.encabezado.idDocumento).toMatch(/^CG-29007A008000980000XY-20260802-170453Z$/)
  })

  it('en urbana, los tres campos no pintados conservan lo que traía el encabezado', () => {
    const { dialogo } = conInforme({ encabezado: ENCABEZADO_URBANA() })
    const v = dialogo.valores()
    expect(v.encabezado.paraje).toBeNull()
    expect(v.encabezado.clase).toBe('URBANA')
  })

  it('`valores()` es `null` mientras no se haya fijado nada', () => {
    const { dialogo } = montar()
    expect(dialogo.valores()).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · El borrador del lindero y «Regenerar»
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-informe · el borrador del lindero', () => {
  it('el cuadro trae el texto redactado y es EDITABLE (lo pide la spec)', () => {
    const { dialogo, raiz } = conInforme()
    const cuadro = nodo(raiz, SELECTOR.LITERAL)
    expect(cuadro.tagName).toBe('TEXTAREA')
    expect(cuadro.readOnly).toBe(false)
    expect(cuadro.disabled).toBe(false)
    expect(cuadro.value).toBe(LINDERO_LIMPIO().texto)

    teclear(cuadro, 'Linda al Norte con el camino de servicio.')
    expect(dialogo.valores().lindero).toBe('Linda al Norte con el camino de servicio.')
    expect(dialogo.valores().linderoEditado).toBe(true)
  })

  it('el lindero se devuelve LITERAL: los saltos de línea son párrafos y no se tocan', () => {
    const { dialogo, raiz } = conInforme()
    const conParrafos = 'Linda al Norte…\n\nNota técnica. El contorno…\n'
    teclear(nodo(raiz, SELECTOR.LITERAL), conParrafos)
    expect(dialogo.valores().lindero).toBe(conParrafos)
  })

  it('«Regenerar» vuelve al borrador POR SÍ SOLO, sin depender de ningún suscrito', () => {
    const { dialogo, raiz } = conInforme()
    const cuadro = nodo(raiz, SELECTOR.LITERAL)
    teclear(cuadro, 'algo distinto')
    nodo(raiz, SELECTOR.REGENERAR).click()
    expect(cuadro.value).toBe(LINDERO_LIMPIO().texto)
    expect(dialogo.valores().linderoEditado).toBe(false)
  })

  it('«Regenerar» DICE que se ha llevado lo que hubiera escrito (regla de oro 1)', () => {
    const { raiz } = conInforme()
    teclear(nodo(raiz, SELECTOR.LITERAL), 'media hora de correcciones')
    nodo(raiz, SELECTOR.REGENERAR).click()
    const acuse = texto(raiz, SELECTOR.ESTADO)
    expect(acuse).not.toBe('')
    expect(acuse).toMatch(/ya no está|no ha cambiado nada/)

    // Y si no había nada que deshacer, lo dice distinto: un acuse que mintiera
    // sobre una pérdida que no ha ocurrido enseña a no leerlos.
    nodo(raiz, SELECTOR.REGENERAR).click()
    expect(texto(raiz, SELECTOR.ESTADO)).toMatch(/no ha cambiado nada/)
  })

  it('«Regenerar» avisa a los suscritos DESPUÉS de haber restaurado', () => {
    const { dialogo, raiz } = conInforme()
    const visto = []
    dialogo.alRegenerar(() => visto.push(nodo(raiz, SELECTOR.LITERAL).value))
    teclear(nodo(raiz, SELECTOR.LITERAL), 'x')
    nodo(raiz, SELECTOR.REGENERAR).click()
    expect(visto).toEqual([LINDERO_LIMPIO().texto])
  })

  it('`fijarLindero` sustituye SOLO el borrador y no toca encabezado ni firma', () => {
    const { dialogo, raiz } = conInforme()
    teclear(nodo(raiz, selectorFirma('nombre')), 'Quien firma')
    teclear(nodo(raiz, selectorEncabezado('municipio')), 'CORREGIDO')

    dialogo.fijarLindero({ texto: 'Otro borrador.', tramos: [] })

    expect(nodo(raiz, SELECTOR.LITERAL).value).toBe('Otro borrador.')
    expect(dialogo.valores().firma.nombre).toBe('Quien firma')
    expect(dialogo.valores().encabezado.municipio).toBe('CORREGIDO')
  })

  it('la baja de `alRegenerar` desengancha de verdad', () => {
    const { dialogo, raiz } = conInforme()
    let veces = 0
    const baja = dialogo.alRegenerar(() => (veces += 1))
    nodo(raiz, SELECTOR.REGENERAR).click()
    baja()
    nodo(raiz, SELECTOR.REGENERAR).click()
    expect(veces).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · LA PRESUNCIÓN — el requisito central de esta tarea
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-informe · la presunción no se puede pasar por alto', () => {
  it('sin presunción no hay bloque, y el botón está encendido y el renglón limpio', () => {
    const { dialogo, raiz } = conInforme()
    expect(nodo(raiz, SELECTOR.PRESUNCION).hidden).toBe(true)
    expect(dialogo.puedeComponer()).toBe(true)
    expect(texto(raiz, SELECTOR.ESTADO)).toBe('')
  })

  it('con presunción sale el bloque, con un renglón por tramo y su medida', () => {
    const { raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    const bloque = nodo(raiz, SELECTOR.PRESUNCION)
    expect(bloque.hidden).toBe(false)

    const renglones = [...nodo(raiz, SELECTOR.PRESUNCION_TRAMOS).children].map((li) => li.textContent)
    expect(renglones).toHaveLength(2)
    // Cardinal, medida y qué se propone: lo justo para localizarlo en el borrador.
    expect(renglones[0]).toContain('Sudoeste')
    expect(renglones[0]).toContain('9 lados')
    expect(renglones[0]).toContain('47,21 m')
    expect(renglones[0]).toContain('vía pública')
    expect(renglones[1]).toContain('en línea recta de 8,40 m')
  })

  it('⚠️ el botón «Componer PDF» nace APAGADO y el motivo se escribe EN EL MISMO PASO', () => {
    const { dialogo, raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    expect(dialogo.puedeComponer()).toBe(false)
    expect(texto(raiz, SELECTOR.ESTADO)).toBe(MOTIVO_PRESUNCION_SIN_ACUSE)
  })

  it('marcar el acuse enciende el botón y limpia el renglón; desmarcarlo lo deshace', () => {
    const { dialogo, raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    const casilla = nodo(raiz, SELECTOR.ACUSE)

    conmutar(casilla, true)
    expect(dialogo.puedeComponer()).toBe(true)
    expect(texto(raiz, SELECTOR.ESTADO)).toBe('')

    conmutar(casilla, false)
    expect(dialogo.puedeComponer()).toBe(false)
    expect(texto(raiz, SELECTOR.ESTADO)).toBe(MOTIVO_PRESUNCION_SIN_ACUSE)
  })

  it('⚠️ LA PRUEBA CLAVE: borrar la advertencia del texto NO borra la marca', () => {
    // La marca se deriva de `tramos[].presuncionNoVerificada`, no del texto. Un
    // resaltado que buscara la frase con un `includes` se apagaría en cuanto el
    // usuario reescribiera el párrafo — y lo que se habría borrado sería la
    // ADVERTENCIA, no el hecho. Es el fallo exacto contra el que avisa la cabecera
    // de `report/literal.js`.
    const { dialogo, raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    teclear(nodo(raiz, SELECTOR.LITERAL), 'Linda al Sudoeste con la calle Real.')

    expect(nodo(raiz, SELECTOR.PRESUNCION).hidden).toBe(false)
    expect(dialogo.puedeComponer()).toBe(false)
    expect(texto(raiz, SELECTOR.ESTADO)).toBe(MOTIVO_PRESUNCION_SIN_ACUSE)
    expect(dialogo.valores().presunciones).toHaveLength(2)
  })

  it('un borrador nuevo DESMARCA el acuse: es un acuse de ESTOS tramos', () => {
    const { dialogo, raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    conmutar(nodo(raiz, SELECTOR.ACUSE), true)
    expect(dialogo.puedeComponer()).toBe(true)

    dialogo.fijarLindero(LINDERO_CON_PRESUNCION())
    expect(nodo(raiz, SELECTOR.ACUSE).checked).toBe(false)
    expect(dialogo.puedeComponer()).toBe(false)
  })

  it('un borrador SIN presunción esconde el bloque y devuelve el botón', () => {
    const { dialogo, raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    dialogo.fijarLindero(LINDERO_LIMPIO())
    expect(nodo(raiz, SELECTOR.PRESUNCION).hidden).toBe(true)
    expect(nodo(raiz, SELECTOR.PRESUNCION_TRAMOS).children).toHaveLength(0)
    expect(dialogo.puedeComponer()).toBe(true)
  })

  it('un código de presunción DESCONOCIDO no desaparece: se enseña nombrándolo', () => {
    // Regla de oro 1. Si `report/literal.js` estrena una presunción nueva, tiene que
    // verse aquí como un renglón raro y no evaporarse del único bloque donde una
    // desaparición cuesta cara.
    const { dialogo, raiz } = conInforme({
      lindero: {
        texto: 'Linda al Norte…',
        tramos: [
          { cardinal: 'Norte', longitud: 3, nLados: 1, presuncionNoVerificada: 'CAUCE_PUBLICO' },
        ],
      },
    })
    expect(nodo(raiz, SELECTOR.PRESUNCION).hidden).toBe(false)
    expect(texto(raiz, SELECTOR.PRESUNCION_TRAMOS)).toContain('CAUCE_PUBLICO')
    expect(dialogo.puedeComponer()).toBe(false)
  })

  it('el acuse NO afirma haber verificado nada: dice que se ha repasado', () => {
    // Obligar a jurar que algo se ha comprobado invertiría la regla de oro 9: la
    // aplicación mide y el colegiado interpreta. Aquí solo se pide que lo haya visto.
    const { raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    const rotulo = nodo(raiz, SELECTOR.ACUSE).closest('label').textContent
    expect(rotulo).toMatch(/repasado/i)
    expect(rotulo).not.toMatch(/verificad|comprobad|certific|garantiz/i)
  })

  it('`valores()` lleva los tramos propuestos y si se han acusado', () => {
    const { dialogo, raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    expect(dialogo.valores().acusePresuncion).toBe(false)
    conmutar(nodo(raiz, SELECTOR.ACUSE), true)
    const v = dialogo.valores()
    expect(v.acusePresuncion).toBe(true)
    expect(v.presunciones.map((t) => t.presuncionNoVerificada)).toEqual([
      PRESUNCION.VIA_PUBLICA,
      PRESUNCION.VIA_PUBLICA,
    ])
  })

  it('sin presunciones, `acusePresuncion` es false y no significa nada', () => {
    const { dialogo } = conInforme()
    expect(dialogo.valores().presunciones).toEqual([])
    expect(dialogo.valores().acusePresuncion).toBe(false)
  })

  it('el gate se sostiene contra un `click` sintético sobre el botón apagado', () => {
    const { dialogo, raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    let veces = 0
    dialogo.alComponer(() => (veces += 1))
    nodo(raiz, SELECTOR.COMPONER).click()
    // jsdom no bloquea el `click()` sobre un botón deshabilitado como sí hace el
    // navegador, así que la guarda del módulo es la que responde.
    expect(veces).toBe(0)
  })
})

describe('app/dialogo-informe · la presunción, contra el `describirLindero` de verdad', () => {
  /**
   * Una parcela urbana cuadrada con UNA vecina pegada al lado este. Los otros tres
   * frentes no encuentran colindante y, por ser urbana con vecinas consultadas, se
   * proponen como vía pública. Es el recorrido real de la parcela de referencia del
   * proyecto, reducido a lo mínimo.
   */
  const CUADRADA = {
    recintos: [
      {
        tipo: 'EXTERIOR',
        vertices: [
          [439000, 4479000],
          [439010, 4479000],
          [439010, 4479010],
          [439000, 4479010],
        ],
      },
    ],
    vecinas: [
      {
        refcat: '9398515VK3799G',
        label: '15',
        recintos: [
          {
            vertices: [
              [439010, 4479000],
              [439020, 4479000],
              [439020, 4479010],
              [439010, 4479010],
            ],
          },
        ],
      },
    ],
    clase: 'URBANA',
  }

  it('el contrato encaja: lo que sale de `describirLindero` entra tal cual', () => {
    const lindero = describirLindero(CUADRADA)
    const conPresuncion = lindero.tramos.filter((t) => t.presuncionNoVerificada !== null)
    // Mitad anti-vacuidad: si el fixture dejara de producir presunciones, esta
    // suite entera estaría midiendo el caso trivial y pasaría igual.
    expect(conPresuncion.length).toBeGreaterThan(0)

    const { dialogo, raiz } = conInforme({ encabezado: ENCABEZADO_URBANA(), lindero })
    expect(nodo(raiz, SELECTOR.LITERAL).value).toBe(lindero.texto)
    expect(nodo(raiz, SELECTOR.PRESUNCION).hidden).toBe(false)
    expect(nodo(raiz, SELECTOR.PRESUNCION_TRAMOS).children).toHaveLength(conPresuncion.length)
    expect(dialogo.puedeComponer()).toBe(false)
  })

  it('el mismo lindero en RÚSTICA no propone nada, y el botón nace encendido', () => {
    const lindero = describirLindero({ ...CUADRADA, clase: 'RUSTICA' })
    const { dialogo, raiz } = conInforme({ lindero })
    expect(nodo(raiz, SELECTOR.PRESUNCION).hidden).toBe(true)
    expect(dialogo.puedeComponer()).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · El pie de firma y su neutralidad jurídica
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-informe · el pie de firma', () => {
  it('están los cuatro campos, con los rótulos de report/firma.js', () => {
    const { raiz } = conInforme()
    for (const campo of CAMPOS_FIRMA) {
      const entrada = nodo(raiz, selectorFirma(campo))
      expect(entrada.tagName).toBe('INPUT')
      expect(entrada.type).toBe('text')
      const rotulo = raiz.querySelector(`label[for="${entrada.id}"]`)
      expect(rotulo, `sin rótulo para ${campo}`).not.toBeNull()
      expect(rotulo.textContent).toBe(ROTULO_FIRMA[campo])
    }
    expect(texto(raiz, SELECTOR.FIRMA)).toContain(TITULO_FIRMA)
  })

  it('⚠️ NEUTRALIDAD: ni un desplegable, ni una lista, ni autocompletado de profesión', () => {
    // MEJORES_PRACTICAS_GML.md §5.2: quién puede firmar qué está en disputa. Una
    // lista cerrada sería tomar partido, y `colegio` es texto libre por eso.
    //
    // ⚠️ El guardián se ACOTA al grupo de la firma con F17, y conviene decir por qué
    // en vez de dejarlo como un ajuste: decía «ni un `<select>` en todo el diálogo»
    // y eso era el alcance de cuando el diálogo no tenía ninguno. Lo que defiende no
    // es la ausencia de desplegables —el de «Tipo de operación» es obligado, sus dos
    // opciones son las que la Sede impone y están medidas—: defiende que **de quién
    // firma no se ofrezca una lista**. Ampliarlo a todo el documento habría obligado
    // a quitar un control que la Sede exige para conservar una regla sobre otro.
    const { raiz } = conInforme()
    const firma = nodo(raiz, SELECTOR.FIRMA)
    expect(firma.querySelectorAll('select')).toHaveLength(0)
    expect(raiz.querySelectorAll('datalist')).toHaveLength(0)
    for (const campo of CAMPOS_FIRMA) {
      const entrada = nodo(raiz, selectorFirma(campo))
      expect(entrada.hasAttribute('list'), campo).toBe(false)
    }
    // Y el ÚNICO desplegable del diálogo es el de la operación, que vive fuera de
    // este grupo. Si mañana apareciera otro, esto lo dice.
    const selects = [...raiz.querySelectorAll('select')]
    expect(selects).toHaveLength(1)
    expect(selects[0].dataset.operacion).toBe('tipo')
  })

  it('⚠️ NEUTRALIDAD: ninguna etiqueta presupone titulación', () => {
    const { raiz } = conInforme()
    const TITULACION =
      /\b(arquitect|aparejador|ingenier|topógraf|topograf|agrónom|agronom|geógraf|geograf|técnico competente|facultativ|perito)/i
    expect(texto(raiz, SELECTOR.FIRMA)).not.toMatch(TITULACION)
    expect(raiz.textContent).not.toMatch(TITULACION)
  })

  it('`valores().firma` sale normalizado por report/firma.js, y el blanco es null', () => {
    const { dialogo, raiz } = conInforme()
    teclear(nodo(raiz, selectorFirma('nombre')), '  Nombre \t  Apellido   Apellido ')
    teclear(nodo(raiz, selectorFirma('numeroColegiado')), '04321')
    teclear(nodo(raiz, selectorFirma('colegio')), '   ')

    const { firma } = dialogo.valores()
    expect(firma.nombre).toBe('Nombre Apellido Apellido')
    // Los ceros a la izquierda del número de colegiado NO se pierden.
    expect(firma.numeroColegiado).toBe('04321')
    expect(firma.colegio).toBeNull()
    expect(firma.contacto).toBeNull()
    expect(Object.keys(firma)).toEqual([...CAMPOS_FIRMA])
  })

  it('el salto de línea de un nombre pegado lo quita la PLATAFORMA, no nosotros', () => {
    // MEDIDO. `report/firma.js` colapsa los saltos de línea porque «un nombre pegado
    // desde un correo trae a menudo uno dentro», y resulta que a estos campos no
    // llega nunca: el algoritmo de saneado de `<input type="text">` borra CR y LF al
    // asignar el valor. Se afirma para que nadie retire aquella defensa creyéndola
    // redundante: sigue haciendo falta para el `<textarea>` y para quien componga la
    // firma sin pasar por esta pantalla.
    const { dialogo, raiz } = conInforme()
    const entrada = nodo(raiz, selectorFirma('nombre'))
    teclear(entrada, 'Nombre\nApellido')
    expect(entrada.value).toBe('NombreApellido')
    expect(dialogo.valores().firma.nombre).toBe('NombreApellido')
  })

  it('la firma recordada se prerrellena, y «Recordar» refleja lo que se le pase', () => {
    const { dialogo, raiz } = conInforme({
      firma: { nombre: 'Quien firma', numeroColegiado: '1234' },
      recordarFirma: true,
    })
    expect(nodo(raiz, selectorFirma('nombre')).value).toBe('Quien firma')
    expect(nodo(raiz, SELECTOR.RECORDAR).checked).toBe(true)
    expect(dialogo.valores().recordarFirma).toBe(true)

    conmutar(nodo(raiz, SELECTOR.RECORDAR), false)
    expect(dialogo.valores().recordarFirma).toBe(false)
  })

  it('una firma en blanco NO apaga el botón: un informe sin colegiado es legítimo', () => {
    const { dialogo } = conInforme()
    expect(dialogo.valores().firma.nombre).toBeNull()
    expect(dialogo.puedeComponer()).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Apertura, cierre, foco y `Escape`
// ═════════════════════════════════════════════════════════════════════════════

// ── El gancho de CSS del modo de presentación ───────────────────────────────
//
// ⛔ ESTE BLOQUE NACE DE UN DEFECTO QUE VIVIÓ MESES EN VERDE (2026-08-09).
// La pantalla completa del diálogo colgaba de `.gml-app[data-paso='informe']` en
// `estilos/app.css`, y `PASO.INFORME` se había retirado del enum de
// `app/navegacion.js`. El selector no podía casar nunca, así que el diálogo salía
// como tarjeta centrada con **934 px de 1.566 (59,6 %) tras un scroll interno**,
// medido en Chrome a 1280×720. `comoPantalla(true)` seguía activo por dentro, de
// modo que ni el comportamiento ni ninguna prueba delataban nada: lo único que
// faltaba era la geometría, y la geometría no la miraba nadie.
//
// Lo que se prueba aquí es la ÚNICA pieza que puede volver a romperse en silencio:
// que el atributo se escriba, y que diga lo mismo que el modo. Que el CSS lo use
// bien es del guion de humo; que exista es de aquí.
describe('app/dialogo-informe · `data-presentacion`, el gancho de CSS del modo', () => {
  it('en modo pantalla el `<dialog>` se marca como «pantalla»', () => {
    const { dialogo, raiz } = conInforme()
    dialogo.comoPantalla(true)
    dialogo.abrir()
    expect(raiz.getAttribute(ATRIBUTO_PRESENTACION)).toBe(PRESENTACION.PANTALLA)
  })

  it('en modo tarjeta se marca como «tarjeta», y no se queda el valor de antes', () => {
    const { dialogo, raiz } = conInforme()
    dialogo.comoPantalla(true)
    dialogo.abrir()
    expect(raiz.getAttribute(ATRIBUTO_PRESENTACION)).toBe(PRESENTACION.PANTALLA)

    // Conmutar con el diálogo ABIERTO: `comoPantalla` cierra mudo y reabre, así que
    // vuelve a pasar por `presentar()`. Si el atributo se escribiera en otro sitio
    // —al cablear, al construir— este caso lo dejaría mintiendo.
    dialogo.comoPantalla(false)
    expect(raiz.getAttribute(ATRIBUTO_PRESENTACION)).toBe(PRESENTACION.TARJETA)
  })

  it('⛔ el marcador acompaña a `aria-modal` y NO lo sustituye', () => {
    // Los dos existen a propósito y dicen cosas distintas: `aria-modal` es lo que
    // oye el lector de pantalla, `data-presentacion` es de dónde saca el CSS su
    // geometría. La regla está escrita en `app/barra.js, «el estado se pinta desde data-rail-estado»`: dos fuentes para el
    // mismo estado visible acaban divergiendo, así que cada una tiene su trabajo.
    const { dialogo, raiz } = conInforme()

    dialogo.comoPantalla(true)
    dialogo.abrir()
    expect(raiz.getAttribute('aria-modal')).toBe('false')
    expect(raiz.getAttribute(ATRIBUTO_PRESENTACION)).toBe(PRESENTACION.PANTALLA)

    dialogo.comoPantalla(false)
    expect(raiz.getAttribute('aria-modal')).toBe('true')
    expect(raiz.getAttribute(ATRIBUTO_PRESENTACION)).toBe(PRESENTACION.TARJETA)
  })

  it('los dos valores son los que el CSS cita, letra por letra', () => {
    // Guardián barato contra el renombrado silencioso: `estilos/app.css` escribe
    // `[data-presentacion='pantalla']` a mano, y un cambio aquí lo dejaría muerto
    // exactamente igual que murió `[data-paso='informe']`.
    expect(ATRIBUTO_PRESENTACION).toBe('data-presentacion')
    expect(PRESENTACION.PANTALLA).toBe('pantalla')
    expect(PRESENTACION.TARJETA).toBe('tarjeta')
  })
})

describe('app/dialogo-informe · apertura, cierre y foco', () => {
  it('`abrir()` abre y lleva el foco al primer campo', () => {
    const { dialogo, raiz, abridor } = conInforme()
    abridor.focus()
    dialogo.abrir()
    expect(dialogo.abierto()).toBe(true)
    expect(raiz.open).toBe(true)
    expect(document.activeElement).toBe(nodo(raiz, selectorEncabezado('municipio')))
  })

  it('el foco no aterriza NUNCA en un control escondido', () => {
    // El acuse de la presunción está antes que el cuadro de texto en el DOM y, sin
    // informe fijado, el encabezado está vacío: si el bloque oculto contara, el foco
    // caería en una casilla que no se ve.
    const { dialogo, raiz } = montar()
    dialogo.abrir()
    expect(document.activeElement).not.toBe(nodo(raiz, SELECTOR.ACUSE))
    expect(document.activeElement.closest('[hidden]')).toBeNull()
  })

  it('`Escape` cierra, devuelve el foco y avisa con su motivo', () => {
    const { dialogo, raiz, abridor } = conInforme()
    const motivos = []
    dialogo.alCancelar((m) => motivos.push(m))

    abridor.focus()
    dialogo.abrir()
    escape(raiz)

    expect(dialogo.abierto()).toBe(false)
    expect(raiz.open).toBe(false)
    expect(document.activeElement).toBe(abridor)
    expect(motivos).toEqual([MOTIVO_CIERRE.ESCAPE])
  })

  it('cualquier otra tecla no cierra nada', () => {
    const { dialogo, raiz } = conInforme()
    dialogo.abrir()
    raiz.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(dialogo.abierto()).toBe(true)
  })

  it('«Cancelar» cierra y avisa con SU motivo, distinto del de `Escape`', () => {
    const { dialogo, raiz, abridor } = conInforme()
    const motivos = []
    dialogo.alCancelar((m) => motivos.push(m))
    abridor.focus()
    dialogo.abrir()
    nodo(raiz, SELECTOR.CANCELAR).click()
    expect(dialogo.abierto()).toBe(false)
    expect(motivos).toEqual([MOTIVO_CIERRE.BOTON])
    expect(document.activeElement).toBe(abridor)
  })

  it('`cerrar()` es MUDO: el usuario no se ha echado atrás de nada', () => {
    const { dialogo } = conInforme()
    const motivos = []
    dialogo.alCancelar((m) => motivos.push(m))
    dialogo.abrir()
    dialogo.cerrar()
    expect(dialogo.abierto()).toBe(false)
    expect(motivos).toEqual([])
  })

  it('⚠️ CERRAR NO BORRA NADA: se vuelve a abrir y todo sigue donde estaba', () => {
    // Es la contrapartida de haber aceptado `Escape` en un diálogo que contiene un
    // lindero reescrito a mano. El cajón de F08 se negó a cerrarse con `Escape`
    // justamente para no perder lo que tenía dentro; aquí la accesibilidad manda que
    // `Escape` cierre, así que lo que se garantiza es lo otro.
    const { dialogo, raiz } = conInforme()
    dialogo.abrir()
    teclear(nodo(raiz, SELECTOR.LITERAL), 'media hora de correcciones')
    teclear(nodo(raiz, selectorFirma('nombre')), 'Quien firma')
    escape(raiz)

    dialogo.abrir()
    expect(nodo(raiz, SELECTOR.LITERAL).value).toBe('media hora de correcciones')
    expect(dialogo.valores().firma.nombre).toBe('Quien firma')
  })

  it('abrir dos veces no pierde a quien había que devolverle el foco', () => {
    const { dialogo, abridor } = conInforme()
    abridor.focus()
    dialogo.abrir()
    dialogo.abrir() // idempotente: no vuelve a apuntar `focoPrevio`
    dialogo.cerrar()
    expect(document.activeElement).toBe(abridor)
  })

  it('si quien tenía el foco ya no está en el documento, no se fuerza nada', () => {
    const { dialogo, abridor } = conInforme()
    abridor.focus()
    dialogo.abrir()
    abridor.remove()
    expect(() => dialogo.cerrar()).not.toThrow()
  })

  it('`fijar(null)` deja el diálogo en blanco, abierto, y el botón apagado con motivo', () => {
    const { dialogo, raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    dialogo.abrir()
    dialogo.fijar(null)
    expect(dialogo.abierto()).toBe(true)
    expect(nodo(raiz, SELECTOR.LITERAL).value).toBe('')
    expect(nodo(raiz, SELECTOR.PRESUNCION).hidden).toBe(true)
    expect(dialogo.valores()).toBeNull()
    expect(texto(raiz, SELECTOR.ESTADO)).toBe(SIN_DATOS)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · «Componer PDF», los oyentes y el desmontaje
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-informe · componer y desmontar', () => {
  it('«Componer PDF» entrega los valores ya leídos, sin cerrar el diálogo', () => {
    // No cierra por sí solo, a propósito: quien escucha va a componer un PDF y este
    // renglón de estado es donde se cuenta esa espera. Cerrarlo aquí dejaría la
    // operación corriendo sin ninguna superficie donde informar de ella.
    const { dialogo, raiz } = conInforme()
    const recibidos = []
    dialogo.alComponer((v) => recibidos.push(v))
    dialogo.abrir()
    teclear(nodo(raiz, selectorFirma('nombre')), 'Quien firma')
    nodo(raiz, SELECTOR.COMPONER).click()

    expect(recibidos).toHaveLength(1)
    expect(recibidos[0].firma.nombre).toBe('Quien firma')
    expect(recibidos[0].encabezado.municipio).toBe('ALHAURIN DE LA TORRE')
    expect(dialogo.abierto()).toBe(true)
  })

  it('varios oyentes conviven, y cada baja desengancha solo al suyo', () => {
    const { dialogo, raiz } = conInforme()
    const vistos = []
    const baja1 = dialogo.alComponer(() => vistos.push(1))
    dialogo.alComponer(() => vistos.push(2))
    nodo(raiz, SELECTOR.COMPONER).click()
    baja1()
    nodo(raiz, SELECTOR.COMPONER).click()
    expect(vistos).toEqual([1, 2, 2])
  })

  it('un oyente que revienta se cuenta por el panel y NO tumba a los demás', () => {
    // MEDIDO en F08: una excepción dentro de un oyente del DOM no sale por
    // `dispatchEvent`. Dejarla propagar es un error silencioso de manual.
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { dialogo, raiz, avisos } = conInforme()
    const vistos = []
    dialogo.alComponer(() => {
      throw new Error('el compositor está roto')
    })
    dialogo.alComponer(() => vistos.push('el segundo sí corre'))

    expect(() => nodo(raiz, SELECTOR.COMPONER).click()).not.toThrow()
    expect(vistos).toEqual(['el segundo sí corre'])
    expect(avisos).toHaveLength(1)
    expect(avisos[0].mensaje).toBe(MENSAJE_OYENTE_ROTO)
    expect(avisos[0].detalle.nivel).toBe(NIVEL.ERROR)
    expect(consola).toHaveBeenCalled()
  })

  it('`estado()` escribe el renglón, y el siguiente repintado manda sobre él', () => {
    const { dialogo, raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    dialogo.estado('Componiendo el PDF…')
    expect(texto(raiz, SELECTOR.ESTADO)).toBe('Componiendo el PDF…')
    conmutar(nodo(raiz, SELECTOR.ACUSE), true)
    expect(texto(raiz, SELECTOR.ESTADO)).toBe('')
  })

  it('`destruir()` es idempotente, deja el DOM como estaba y devuelve el foco', () => {
    const { dialogo, raiz, abridor } = conInforme()
    abridor.focus()
    dialogo.abrir()
    dialogo.destruir()

    expect(raiz.isConnected).toBe(false)
    expect(document.querySelector(`.${CLASE.DIALOGO}`)).toBeNull()
    expect(document.activeElement).toBe(abridor)
    expect(() => dialogo.destruir()).not.toThrow()
  })

  it('después de destruir, todo lo demás calla en vez de reventar', () => {
    const { dialogo, raiz } = conInforme()
    dialogo.destruir()
    expect(() => dialogo.abrir()).not.toThrow()
    expect(() => dialogo.cerrar()).not.toThrow()
    expect(() => dialogo.fijar(null)).not.toThrow()
    expect(dialogo.abierto()).toBe(false)
    expect(dialogo.valores()).toBeNull()
    expect(dialogo.puedeComponer()).toBe(false)
    // Y los oyentes no vuelven a correr.
    let veces = 0
    dialogo.alComponer(() => (veces += 1))
    raiz.querySelector(SELECTOR.COMPONER).click()
    expect(veces).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · Guardianes transversales
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Vocabulario de VEREDICTO. La MISMA lista, palabra por palabra, que el guardián
 * de `test/report/contraste-texto.test.js`: dos guardianes que dijeran cosas
 * distintas dejarían pasar por un lado lo que el otro prohíbe.
 *
 * No incluye «validación», y es deliberado: el desmentido de este diálogo nombra
 * la «validación gráfica alternativa (VGA)» y el «informe de validación gráfica
 * (IVG)» precisamente para NEGAR que él lo sea. Son los nombres de un
 * procedimiento y un documento oficiales del Catastro, no un juicio sobre la
 * parcela.
 */
const VEREDICTO = Object.freeze([
  /\bválid[oa]s?\b/i,
  /\binválid[oa]s?\b/i,
  /\bcorrect[oa]s?\b/i,
  /\bincorrect[oa]s?\b/i,
  /\bapt[oa]s?\b/i,
  /\bcumple[n]?\b/i,
  /\bincumple[n]?\b/i,
  /\bconforme[s]?\b/i,
  /\btoleranci[ao]s?\b/i,
  /\bsemáforos?\b/i,
  /\bumbral(es)?\b/i,
  /\baprobad[oa]s?\b/i,
  /\bsuspens[oa]s?\b/i,
  /\bacept(able|ables|ado|ada)\b/i,
])

const veredictosEn = (t) =>
  VEREDICTO.flatMap((re) => {
    const m = re.exec(t)
    return m === null ? [] : [`${m[0]} (${re})`]
  })

/**
 * TODO el texto que el diálogo enseña: el de los nodos y el de los atributos que
 * un lector de pantalla lee. Sin los atributos, un rótulo de mérito escondido en
 * un `aria-label` pasaría de largo.
 */
function textoVisible(raiz) {
  const trozos = [raiz.textContent]
  for (const el of raiz.querySelectorAll('*')) {
    for (const attr of ['aria-label', 'placeholder', 'title']) {
      const v = el.getAttribute(attr)
      if (v) trozos.push(v)
    }
    if (el.value && typeof el.value === 'string') trozos.push(el.value)
  }
  return trozos.join(' ')
}

/**
 * El texto que ATRAVIESA este módulo: lo redactan capas de abajo (o lo teclea el
 * usuario) y llega literal, porque reescribirlo sería inventarse una traducción
 * que se queda corta en silencio.
 */
function textoAjeno(raiz, { encabezado, lindero }) {
  const del = [lindero.texto, ...lindero.tramos.map((t) => t.cardinal)]
  for (const [k, v] of Object.entries(encabezado.encabezado)) {
    if (typeof v === 'string') del.push(v)
    if (k === 'fecha') del.push(nodo(raiz, selectorEncabezado('fecha')).textContent)
  }
  // Los rótulos de `report/firma.js`, que se IMPORTAN de allí y no se copian.
  del.push(TITULO_FIRMA, ...Object.values(ROTULO_FIRMA))
  for (const el of raiz.querySelectorAll(`.${CLASE.ROTULO}`)) del.push(el.textContent)
  return del.filter((t) => typeof t === 'string' && t.length > 0)
}

/** El texto pintado MENOS todo lo que atraviesa: o sea, lo que escribe este módulo. */
function vocabularioPropio(raiz, fixture) {
  let resto = textoVisible(raiz)
  // De más largo a más corto: un fragmento corto podría estar contenido en uno
  // largo y dejarlo partido en trozos que ya no casarían.
  for (const ajeno of textoAjeno(raiz, fixture).sort((a, b) => b.length - a.length)) {
    resto = resto.split(ajeno).join(' ')
  }
  return resto
}

describe('app/dialogo-informe · guardián de la regla de oro 9', () => {
  const casos = [
    ['rústica sin presunción', { encabezado: ENCABEZADO_RUSTICA(), lindero: LINDERO_LIMPIO() }],
    ['urbana con presunción', { encabezado: ENCABEZADO_URBANA(), lindero: LINDERO_CON_PRESUNCION() }],
  ]

  it.each(casos)('el vocabulario PROPIO del diálogo está limpio con %s', (_, fixture) => {
    const { raiz } = conInforme(fixture)
    const propio = vocabularioPropio(raiz, fixture)
    // Anti-vacuidad: si el despojado se hubiera llevado el texto entero, este
    // guardián estaría examinando una cadena vacía y pasaría siempre.
    expect(propio.replace(/\s+/g, ' ').trim().length).toBeGreaterThan(400)
    expect(veredictosEn(propio)).toEqual([])
  })

  it('el despojado FUNCIONA: si se cuela una palabra de mérito propia, salta', () => {
    // Un guardián que nunca se ha visto fallar no es un guardián.
    const fixture = { encabezado: ENCABEZADO_RUSTICA(), lindero: LINDERO_LIMPIO() }
    const { raiz } = conInforme(fixture)
    const intruso = document.createElement('p')
    intruso.textContent = 'La parcela es correcta y apta para presentar.'
    raiz.append(intruso)
    expect(veredictosEn(vocabularioPropio(raiz, fixture))).not.toEqual([])
  })

  it('lo que escribe el USUARIO en su documento sí puede llevarlas, y es legítimo', () => {
    // Es su documento y su redacción. Lo que este módulo se prohíbe es afirmarlo ÉL.
    const fixture = {
      encabezado: ENCABEZADO_RUSTICA(),
      lindero: {
        texto: 'Linda al Norte con la finca descrita conforme a la escritura, tolerancia aparte.',
        tramos: [],
      },
    }
    const { raiz } = conInforme(fixture)
    // ⚠️ `textContent` NO sirve aquí, y es la trampa de medir un `<textarea>`:
    // asignar `.value` no toca su nodo de texto hijo, así que el borrador del
    // lindero es invisible para `raiz.textContent`. Un guardián escrito contra
    // `textContent` estaría verde sin haber mirado el texto más importante de la
    // pantalla. Por eso {@link textoVisible} recoge también los `value`.
    expect(veredictosEn(raiz.textContent)).toEqual([])
    expect(veredictosEn(textoVisible(raiz))).not.toEqual([])
    expect(veredictosEn(vocabularioPropio(raiz, fixture))).toEqual([])
  })

  it('el título es el nombre legal correcto, y no el del documento oficial', () => {
    // SPEC §11.1: «Informe de validación gráfica» es el nombre de un documento
    // OFICIAL del Catastro y no se puede usar aquí ni parecido.
    const { raiz } = conInforme()
    expect(texto(raiz, SELECTOR.TITULO)).toContain('contraste con el parcelario catastral')
    expect(texto(raiz, SELECTOR.TITULO)).not.toMatch(/validaci[oó]n gr[aá]fica/i)
  })

  it('el desmentido está a la vista antes de teclear nada', () => {
    const { raiz } = conInforme()
    const intro = texto(raiz, SELECTOR.INTRO)
    expect(intro).toMatch(/no es la validación gráfica alternativa/i)
    expect(intro).toMatch(/IVG/)
    expect(intro).toMatch(/Sede Electrónica/)
  })
})

describe('app/dialogo-informe · guardianes de marcado y de cromo', () => {
  it('las clases puestas son EXACTAMENTE las declaradas (propias + reutilizadas)', () => {
    // Deriva del DOM real, no de una lista escrita a mano: una clase que se colara
    // sin pasar por `CLASE` no la vería la hoja de estilos ni este guardián.
    const { raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    const puestas = new Set()
    for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
      for (const clase of el.classList) puestas.add(clase)
    }
    const declaradas = new Set([...Object.values(CLASE), ...CLASE_REUTILIZADA])
    for (const clase of puestas) {
      expect([...declaradas], `clase no declarada: ${clase}`).toContain(clase)
    }
    // Y al revés, para que `CLASE` no acumule entradas muertas que el CSS vista en
    // balde: todas las propias se usan en el caso completo.
    for (const clase of Object.values(CLASE)) {
      expect([...puestas], `clase declarada y sin usar: ${clase}`).toContain(clase)
    }
  })

  it('ninguna clase de mérito', () => {
    const { raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    const MERITO = /(^|[-_])(ok|exito|éxito|error|valido|válido|correcto|apto|bien|mal)([-_]|$)/i
    for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
      for (const clase of el.classList) {
        expect(clase, `clase de mérito: ${clase}`).not.toMatch(MERITO)
      }
    }
  })

  it('⚠️ NI UN estilo EN LÍNEA en todo el diálogo', () => {
    // La lección MEDIDA de F08 (guion 10): un `font:'inherit'` en línea gana a la
    // hoja, así que la regla CSS queda escrita, puesta y muerta — y en jsdom no hay
    // cascada que lo delate. Este módulo NO necesita ser legible sin hoja
    // (`estilos/app.css` entra por `<link>` y es contrato de la cáscara), así que la
    // regla aquí es simple y absoluta: cero `style`.
    const { raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    for (const el of [raiz, ...raiz.querySelectorAll('*')]) {
      expect(el.getAttribute('style'), `estilo en línea en <${el.tagName.toLowerCase()}>`).toBeNull()
    }
  })

  it('todas las clases propias llevan el prefijo `gml-`', () => {
    for (const clase of Object.values(CLASE)) expect(clase.startsWith('gml-')).toBe(true)
  })

  it('todo control tiene rótulo o nombre accesible: ni uno mudo', () => {
    const { raiz } = conInforme({ lindero: LINDERO_CON_PRESUNCION() })
    for (const control of raiz.querySelectorAll('input, textarea')) {
      const tieneLabel =
        raiz.querySelector(`label[for="${control.id}"]`) !== null ||
        control.closest('label') !== null ||
        control.hasAttribute('aria-label')
      expect(tieneLabel, `control sin rótulo: ${control.outerHTML.slice(0, 90)}`).toBe(true)
    }
  })

  it('⚠️ el botón apagado NUNCA está mudo, en ninguno de sus estados', () => {
    // Regla de oro 1, comprobada por barrido en vez de caso a caso: se recorren los
    // estados en los que el botón se apaga y se exige texto en el renglón cada vez.
    const { dialogo, raiz } = montar()
    const estados = [
      () => {},
      () => dialogo.fijar({ ...ENCABEZADO_RUSTICA(), lindero: LINDERO_CON_PRESUNCION() }),
      () => conmutar(nodo(raiz, SELECTOR.ACUSE), true),
      () => conmutar(nodo(raiz, SELECTOR.ACUSE), false),
      () => dialogo.fijar(null),
    ]
    for (const paso of estados) {
      paso()
      if (nodo(raiz, SELECTOR.COMPONER).disabled) {
        expect(texto(raiz, SELECTOR.ESTADO).trim().length, 'botón apagado y mudo').toBeGreaterThan(0)
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Rework de UI · rebanada 5 · ¿ESTO ES UN MODAL O ES LA PANTALLA?
//
// ⛔ EL DEFECTO, MEDIDO EN CHROME EL 2026-08-05 a 1280×720:
//
//   · la pantalla «Informe» NO tenía nada del informe. El panel enseñaba lo mismo
//     que Validación (cabecera 117 + avisos 63 + vértices 360 + pie 179 = 720 px)
//     y de las tres acciones del informe no se veía NINGUNA: dos viven dentro del
//     cajón de diagnóstico —cerrado en Informe— y la tercera dentro del <dialog>;
//   · el PDF se sacaba desde Diagnóstico, con el rail marcando otra cosa: el
//     peldaño «Informe» no participaba en producir el informe;
//   · y el formulario escondía 704 px de 1.336 (52,7 %) bajo el pliegue, con
//     «Componer PDF» y «Cancelar» entre lo escondido.
//
// Aquí se prueba el INTERRUPTOR. Que el aplicador lo conmute donde toca es de
// `app/main.js`, y que en un navegador de verdad se note, del guion 14.
// ═══════════════════════════════════════════════════════════════════════════════
describe('app/dialogo-informe.js · `comoPantalla` (rebanada 5)', () => {
  it('nace en `false`: montado a pelo es EXACTAMENTE el modal de F09', () => {
    const { dialogo } = montar()
    expect(dialogo.comoPantalla()).toBe(false)
  })

  it('⛔ como PANTALLA, `Escape` no cierra: avisa de que quieren salir', () => {
    const { dialogo, raiz } = montar()
    const salidas = []
    dialogo.alCancelar((motivo) => salidas.push(motivo))
    dialogo.abrir()
    dialogo.comoPantalla(true)

    raiz.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(salidas).toHaveLength(1)
    expect(dialogo.abierto(), 'la vista no se cierra sola: quien decide es la navegación').toBe(
      true,
    )

    // ANTI-VACUIDAD: el mismo gesto con el interruptor al revés SÍ cierra. Sin
    // esto la prueba pasaría igual aunque el `keydown` no llegara a ningún sitio.
    dialogo.comoPantalla(false)
    raiz.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(dialogo.abierto(), 'siendo modal tiene que seguir cerrándose').toBe(false)
  })

  it('⛔ como PANTALLA, «Cancelar» tampoco cierra: avisa', () => {
    const { dialogo, raiz } = montar()
    const salidas = []
    dialogo.alCancelar((motivo) => salidas.push(motivo))
    dialogo.abrir()
    dialogo.comoPantalla(true)

    // Se busca por TEXTO y no por selector: el botón no lleva `data-accion`, y un
    // selector inventado devolvería `null` sin quejarse.
    const botonCancelar = Array.from(raiz.querySelectorAll('button')).find((x) =>
      /cancelar/i.test(x.textContent),
    )
    expect(botonCancelar, 'no está el botón «Cancelar»').toBeDefined()
    botonCancelar.click()

    expect(salidas).toHaveLength(1)
    expect(dialogo.abierto()).toBe(true)
  })

  it('⛔ `aria-modal` deja de mentir: en modo pantalla lo de detrás NO está inerte', () => {
    const { dialogo, raiz } = montar()
    dialogo.abrir()
    expect(raiz.getAttribute('aria-modal')).toBe('true')
    dialogo.comoPantalla(true)
    expect(raiz.getAttribute('aria-modal')).toBe('false')
    dialogo.comoPantalla(false)
    expect(raiz.getAttribute('aria-modal')).toBe('true')
  })

  it('⭐ conmutar con el diálogo ABIERTO lo vuelve a presentar, y sin avisar de nada', () => {
    // El caso del CTA, que abre y navega en el mismo gesto: un `showModal()` solo
    // se deshace cerrando, así que sin esto quedaría un modal encima de su propia
    // pantalla. Y el cierre intermedio no puede contarse como que el usuario se
    // ha echado atrás.
    const { dialogo } = montar()
    const salidas = []
    dialogo.alCancelar(() => salidas.push('x'))
    dialogo.abrir()
    expect(dialogo.abierto()).toBe(true)

    dialogo.comoPantalla(true)

    expect(dialogo.abierto(), 'sigue abierto tras cambiar de presentación').toBe(true)
    expect(salidas, 'cambiar de presentación no es echarse atrás').toHaveLength(0)
  })

  it('sin argumento LEE, y con algo que no es booleano LANZA', () => {
    const { dialogo } = montar()
    expect(dialogo.comoPantalla()).toBe(false)
    expect(dialogo.comoPantalla(true)).toBe(true)
    expect(dialogo.comoPantalla()).toBe(true)
    expect(() => dialogo.comoPantalla('si')).toThrow(TypeError)
    expect(() => dialogo.comoPantalla(0)).toThrow(TypeError)
    expect(dialogo.comoPantalla()).toBe(true)
  })

  // ── ⛔ El bloque anclado: lo que se pulsa y lo que habla no puede esconderse ──
  // Medido a 1280×720 con el informe ya a página completa: «Componer PDF» caía
  // 379,53 px por debajo del borde visible, «Cancelar» otro tanto y el renglón de
  // estado 412,92. jsdom no mide eso, así que se afirma la ESTRUCTURA.
  it('⭐ «Componer PDF» y el renglón de estado van DENTRO del bloque anclado', () => {
    const { raiz } = montar()
    const componer = raiz.querySelector('[data-accion="componer-pdf"]')
    const estado = raiz.querySelector('[data-estado="dialogo-informe"]')
    expect(componer, 'no está el botón que produce el entregable').not.toBe(null)
    expect(estado, 'no está el renglón por el que este diálogo habla').not.toBe(null)

    const anclado = componer.closest(`.${CLASE.ANCLADO}`)
    expect(anclado, '«Componer PDF» no cuelga de ningún bloque anclado').not.toBe(null)
    expect(anclado.contains(estado), 'el renglón de estado se queda fuera del anclado').toBe(true)

    // Y es lo ÚLTIMO del contenido: si algo se cuela detrás, el `sticky` se despega
    // en cuanto ese algo asoma, que es exactamente cómo nace este defecto.
    expect(anclado.parentElement.lastElementChild).toBe(anclado)
  })
})
