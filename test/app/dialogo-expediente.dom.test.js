/* -------------------------------------------------------------------------- *
 * test/app/dialogo-expediente.dom.test.js — F10 · T4.1                        *
 *                                                                            *
 * `app/dialogo-expediente.js` administra el trabajo de alguien: lo guarda, lo *
 * recupera, lo borra y lo saca a un fichero. Casi todo lo que puede salir mal *
 * en esta pantalla es de la familia «pasa algo distinto de lo que dice»:      *
 *                                                                            *
 *   · un botón apagado sin decir por qué;                                     *
 *   · un «Recuperar» que se deja pulsar sobre un expediente de otro huso y    *
 *     deja la geometría en el sitio equivocado;                               *
 *   · un repintado de la lista que le borra al usuario el nombre a medio      *
 *     teclear;                                                                *
 *   · la lista de «lo que NO se guarda» divergiendo de lo que de verdad no se *
 *     guarda, porque alguien la copió en vez de importarla;                   *
 *   · y la cuarta aparición de la familia de defectos de costura: un clic     *
 *     dentro del diálogo que burbujea hasta el guardián de clic-fuera y       *
 *     cierra los cajones del mapa por debajo.                                 *
 *                                                                            *
 * Ese último se comprueba contra el guardián REAL de `viewer/cajon-diagnostico.js` *
 * y no contra una copia: el plan predecía que costaría cero, y una predicción *
 * no verificada es exactamente lo que este proyecto lleva pagando caro.       *
 *                                                                            *
 * ── LO QUE JSDOM NO DA DE `<dialog>` ──────────────────────────────────────── *
 * Medido en F09 y sigue igual: `HTMLDialogElement` existe y su prototipo tiene *
 * EXACTAMENTE `constructor` y `open`. Ni `showModal()`, ni `close()`, ni       *
 * `cancel`, ni `::backdrop`, ni atrape de foco. Por eso el módulo detecta la   *
 * capacidad y cae al atributo `open`, e implementa él mismo `Escape` y la      *
 * devolución del foco.                                                        *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ACCION,
  CLASE,
  CLASE_REUTILIZADA,
  MENSAJE_OYENTE_ROTO,
  MOTIVO_CIERRE,
  MOTIVO_SIN_GEOMETRIA,
  SELECTOR,
  SIN_DATOS,
  crearDialogoExpediente,
  motivoOtroHuso,
  selectorFila,
} from '../../app/dialogo-expediente.js'
import { AVISO_DURABILIDAD, NO_SE_GUARDA } from '../../storage/expedientes.js'
import { NIVEL } from '../../viewer/_comun.js'

const RAIZ = join(import.meta.dirname, '..', '..')

// ── Fixtures ────────────────────────────────────────────────────────────────

const SRS = 'EPSG:25830'

const REGISTROS = [
  { id: 'EXP-1', nombre: 'Linde norte', refcat: '9398516VK3799G', srs: SRS, edad: 'hace 2 horas' },
  { id: 'EXP-2', nombre: 'Finca del arroyo', refcat: null, srs: SRS, edad: 'hace 6 días' },
  { id: 'EXP-3', nombre: 'Trabajo de Huelva', refcat: '1234567AB1234C', srs: 'EPSG:25829', edad: 'ayer' },
]

let dialogo
let avisos

beforeEach(() => {
  document.body.replaceChildren()
  avisos = []
  dialogo = crearDialogoExpediente({
    documento: document,
    alAvisar: (mensaje, opciones) => avisos.push({ mensaje, ...opciones }),
  })
})

afterEach(() => {
  dialogo?.destruir()
  document.body.replaceChildren()
})

/** Un nodo del diálogo por selector, exigiéndolo: el contrato con el cableado. */
const nodo = (selector) => {
  const el = dialogo.nodo.querySelector(selector)
  expect(el, `falta el nodo ${selector}`).not.toBeNull()
  return el
}

const fijarTodo = (extra = {}) =>
  dialogo.fijar({ registros: REGISTROS, srsActual: SRS, puedeGuardar: true, ...extra })

// ═════════════════════════════════════════════════════════════════════════════
// 1 · El contrato de nodos
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-expediente · el marcado que el cableado espera', () => {
  it('el `<dialog>` se fabrica aquí y se monta en el documento', () => {
    // `index.html` no lo trae: mismo reparto que el diálogo de F09 y que la zona de
    // fichero de F08. Si esto se rompiera, el cableado buscaría un nodo que no está.
    expect(dialogo.nodo.tagName).toBe('DIALOG')
    expect(dialogo.nodo.isConnected).toBe(true)
    expect(dialogo.nodo.className).toBe(CLASE.DIALOGO)
    expect(document.querySelectorAll('dialog').length).toBe(1)
  })

  it('TODOS los selectores del contrato existen desde el primer momento', () => {
    // Antes de `fijar`, con el diálogo cerrado y sin nada pintado: es cuando el
    // cableado los busca, y `app/main.js` LANZA si falta uno.
    for (const selector of Object.values(SELECTOR)) nodo(selector)
  })

  it('las diez acciones tienen su botón, y ningún botón tiene una acción inventada', () => {
    fijarTodo()
    const enPantalla = new Set(
      [...dialogo.nodo.querySelectorAll('[data-accion]')].map((b) => b.dataset.accion),
    )
    for (const accion of Object.values(ACCION)) {
      expect(enPantalla, `nadie ofrece la acción ${accion}`).toContain(accion)
    }
    // Y al revés: solo las del vocabulario más el cierre, que no es una intención
    // del expediente sino del diálogo.
    for (const accion of enPantalla) {
      expect([...Object.values(ACCION), 'cerrar-expediente']).toContain(accion)
    }
  })

  it('no escribe ni un estilo en línea, y en particular ni un `font`', () => {
    // Lección MEDIDA de F08 (guion 10): un estilo en línea GANA a la hoja, así que un
    // `font: 'inherit'` de conveniencia deja muertas las reglas de `estilos/app.css`
    // sin que nada se queje, y en jsdom no hay cascada que lo delate.
    fijarTodo({ borrador: { refcat: '9398516VK3799G', edad: 'hace un momento' } })
    const conEstilo = [...dialogo.nodo.querySelectorAll('*')].filter(
      (el) => el.getAttribute('style') !== null,
    )
    expect(conEstilo.map((el) => el.tagName)).toEqual([])
  })

  it('todas las clases que pinta están declaradas en CLASE o en CLASE_REUTILIZADA', () => {
    // Un guardián de cromo: una clase suelta escrita a mano no la vestiría nadie y no
    // se notaría hasta verlo en pantalla.
    fijarTodo({ borrador: { refcat: null, edad: 'ayer' } })
    const declaradas = new Set([...Object.values(CLASE), ...CLASE_REUTILIZADA])
    const usadas = new Set()
    for (const el of dialogo.nodo.querySelectorAll('*')) {
      for (const c of el.classList) usadas.add(c)
    }
    expect(usadas.size).toBeGreaterThan(8) // anti-vacuidad: hay cromo que mirar
    for (const c of usadas) expect(declaradas, `clase no declarada: ${c}`).toContain(c)
  })

  it('ninguna clase lleva juicio de valor (regla de oro 9 en el gancho de CSS)', () => {
    for (const c of Object.values(CLASE)) {
      expect(c).not.toMatch(/--(ok|error|exito|valido|correcto|fallo)\b/)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Lo que NO se guarda se enumera, y no se copia
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-expediente · lo que no se guarda', () => {
  it('enumera las CUATRO frases de `storage/expedientes.js`, literales', () => {
    const bloque = nodo(SELECTOR.NO_SE_GUARDA)
    const escritas = [...bloque.querySelectorAll('li')].map((li) => li.textContent)
    expect(escritas).toEqual([...NO_SE_GUARDA])
    expect(NO_SE_GUARDA.length).toBeGreaterThan(3) // anti-vacuidad
  })

  it('la advertencia de durabilidad es la de `AVISO_DURABILIDAD`, sin reescribir', () => {
    expect(nodo(SELECTOR.DURABILIDAD).textContent).toBe(AVISO_DURABILIDAD)
  })

  it('⚠️ el fuente IMPORTA esas dos cosas en vez de copiarlas', () => {
    // Es lo único que impide que la lista de la pantalla y la del almacén diverjan.
    // Una copia se queda vieja el día que se añada algo al almacén, y lo que quedaría
    // desfasado sería justo la promesa que el usuario lee antes de pulsar «Guardar».
    const fuente = readFileSync(join(RAIZ, 'app', 'dialogo-expediente.js'), 'utf8')
    expect(fuente).toMatch(
      /import \{[^}]*AVISO_DURABILIDAD[^}]*NO_SE_GUARDA[^}]*\} from '\.\.\/storage\/expedientes\.js'/,
    )
  })

  it('el aviso está ARRIBA, antes de la lista de guardados, y no al pie', () => {
    // Un aviso al pie se lee después de haber pulsado, o no se lee.
    const posicion = dialogo.nodo.compareDocumentPosition(nodo(SELECTOR.LISTA))
    const avisoAntes =
      nodo(SELECTOR.NO_SE_GUARDA).compareDocumentPosition(nodo(SELECTOR.LISTA)) &
      Node.DOCUMENT_POSITION_FOLLOWING
    expect(posicion).toBeGreaterThan(0)
    expect(avisoAntes).toBeTruthy()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · La lista
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-expediente · la lista de guardados', () => {
  it('pinta una fila por registro, en el orden en que llegan', () => {
    fijarTodo()
    const filas = [...nodo(SELECTOR.LISTA).children]
    expect(filas.map((li) => li.dataset.id)).toEqual(['EXP-1', 'EXP-2', 'EXP-3'])
    expect(filas[0].textContent).toContain('Linde norte')
    expect(filas[0].textContent).toContain('9398516VK3799G')
    expect(filas[0].textContent).toContain('hace 2 horas')
  })

  it('el huso se enseña SIEMPRE, no solo cuando estorba', () => {
    // Enseñarlo únicamente en el caso malo obligaría a deducir el bueno por ausencia.
    fijarTodo()
    for (const li of nodo(SELECTOR.LISTA).children) {
      expect(li.textContent).toMatch(/EPSG:258\d\d/)
    }
  })

  it('un registro sin referencia catastral lo DICE, en vez de dejar el hueco', () => {
    fijarTodo()
    const fila = nodo(selectorFila('EXP-2'))
    expect(fila.textContent).toContain('Sin referencia catastral')
  })

  it('sin nada guardado se escribe por qué la lista está vacía', () => {
    dialogo.fijar({ registros: [], srsActual: SRS, puedeGuardar: true })
    expect(nodo(SELECTOR.LISTA).children.length).toBe(0)
    expect(nodo(SELECTOR.VACIO).hidden).toBe(false)
    expect(nodo(SELECTOR.VACIO).textContent).toContain('No hay ningún expediente guardado')
  })

  it('con registros, el renglón de «no hay nada» se esconde', () => {
    fijarTodo()
    expect(nodo(SELECTOR.VACIO).hidden).toBe(true)
  })

  it('antes de mirar dice que TODAVÍA NO SE HA MIRADO, que no es «no hay»', () => {
    // Los dos sabores de «no hay» de este proyecto desde F07: «no se ha consultado» y
    // «no hay ninguno» son afirmaciones distintas, y la segunda tranquiliza.
    expect(nodo(SELECTOR.VACIO).textContent).toBe(SIN_DATOS)
    expect(SIN_DATOS).toMatch(/todavía no se ha mirado/i)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · ⭐ El huso incompatible se dice ANTES de pulsar
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-expediente · un expediente de otro huso', () => {
  it('⭐ apaga su «Recuperar» Y escribe el motivo, en el mismo paso', () => {
    fijarTodo()
    const fila = nodo(selectorFila('EXP-3'))
    const recuperar = fila.querySelector(`[data-accion="${ACCION.RECUPERAR}"]`)

    expect(recuperar.disabled).toBe(true)
    expect(fila.textContent).toContain(motivoOtroHuso('EPSG:25829'))
    // Y el motivo está ENLAZADO al botón: un lector de pantalla que anuncie el botón
    // anuncia también el porqué, sin que el usuario tenga que ir a buscarlo.
    const descrito = recuperar.getAttribute('aria-describedby')
    expect(descrito).not.toBeNull()
    expect(fila.querySelector(`#${descrito}`)).not.toBeNull()
  })

  it('pero duplicar y borrar siguen encendidos: ésos no necesitan el visor', () => {
    fijarTodo()
    const fila = nodo(selectorFila('EXP-3'))
    expect(fila.querySelector(`[data-accion="${ACCION.DUPLICAR}"]`).disabled).toBe(false)
    expect(fila.querySelector(`[data-accion="${ACCION.BORRAR}"]`).disabled).toBe(false)
  })

  it('las filas del MISMO huso no se marcan (anti-vacuidad de lo anterior)', () => {
    fijarTodo()
    for (const id of ['EXP-1', 'EXP-2']) {
      const fila = nodo(selectorFila(id))
      expect(fila.querySelector(`[data-accion="${ACCION.RECUPERAR}"]`).disabled).toBe(false)
      expect(fila.querySelector(`.${CLASE.FILA_NOTA}`)).toBeNull()
    }
  })

  it('sin saber el huso de la pantalla no se marca NINGUNA fila', () => {
    // `srsActual: null` es «todavía no se sabe», que no es «coinciden todas». Marcar
    // por defecto apagaría botones que sí funcionan.
    dialogo.fijar({ registros: REGISTROS, srsActual: null, puedeGuardar: true })
    for (const li of nodo(SELECTOR.LISTA).children) {
      expect(li.querySelector(`[data-accion="${ACCION.RECUPERAR}"]`).disabled).toBe(false)
    }
  })

  it('un «Recuperar» apagado no emite la acción aunque se le fuerce el clic', () => {
    fijarTodo()
    const visto = []
    dialogo.alAccion((a) => visto.push(a))
    nodo(selectorFila('EXP-3')).querySelector(`[data-accion="${ACCION.RECUPERAR}"]`).click()
    expect(visto).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · El botón «Guardar» y su porqué
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-expediente · «Guardar» nunca está apagado y mudo', () => {
  it('nace apagado y con su motivo escrito', () => {
    expect(dialogo.puedeGuardar()).toBe(false)
    expect(nodo(SELECTOR.ESTADO).textContent).toBe(SIN_DATOS)
  })

  it('sin parcela sigue apagado, y el motivo lo dice', () => {
    dialogo.fijar({ registros: [], srsActual: SRS, puedeGuardar: false })
    expect(dialogo.puedeGuardar()).toBe(false)
    expect(nodo(SELECTOR.ESTADO).textContent).toBe(MOTIVO_SIN_GEOMETRIA)
    expect(MOTIVO_SIN_GEOMETRIA).toContain('«Guardar»')
  })

  it('con parcela se enciende y el renglón se VACÍA', () => {
    // Dejar ahí el motivo anterior sería peor que no decir nada: es un repintado.
    fijarTodo()
    expect(dialogo.puedeGuardar()).toBe(true)
    expect(nodo(SELECTOR.ESTADO).textContent).toBe('')
  })

  it('el renglón de estado está enlazado al botón por `aria-describedby`', () => {
    const boton = nodo(SELECTOR.GUARDAR)
    expect(boton.getAttribute('aria-describedby')).toBe(nodo(SELECTOR.ESTADO).id)
    expect(nodo(SELECTOR.ESTADO).getAttribute('role')).toBe('status')
  })

  it('`estado()` escribe, y el siguiente `fijar` vuelve a mandar', () => {
    fijarTodo()
    dialogo.estado('Guardado.')
    expect(nodo(SELECTOR.ESTADO).textContent).toBe('Guardado.')
    dialogo.fijar({ registros: [], srsActual: SRS, puedeGuardar: false })
    expect(nodo(SELECTOR.ESTADO).textContent).toBe(MOTIVO_SIN_GEOMETRIA)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · El borrador OFRECE, no impone
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-expediente · el trabajo autoguardado', () => {
  it('sin borrador, el bloque está escondido pero EXISTE en el DOM', () => {
    // Si solo apareciera al pintar, el `nodo()` del cableado lanzaría al arrancar.
    fijarTodo()
    expect(nodo(SELECTOR.BORRADOR).hidden).toBe(true)
    expect(nodo(SELECTOR.BORRADOR).isConnected).toBe(true)
  })

  it('con borrador se enseña, con su referencia y su antigüedad', () => {
    fijarTodo({ borrador: { refcat: '9398516VK3799G', edad: 'hace 3 minutos' } })
    const bloque = nodo(SELECTOR.BORRADOR)
    expect(bloque.hidden).toBe(false)
    expect(bloque.textContent).toContain('9398516VK3799G')
    expect(bloque.textContent).toContain('hace 3 minutos')
  })

  it('dice que MIENTRAS NO SE DECIDA no pasa nada: ofrece, no impone', () => {
    fijarTodo({ borrador: { refcat: null, edad: null } })
    expect(nodo(SELECTOR.BORRADOR_TEXTO).textContent).toMatch(/se queda donde está/i)
  })

  it('ofrece las dos salidas, recuperar y descartar', () => {
    fijarTodo({ borrador: { refcat: null, edad: 'ayer' } })
    const visto = []
    dialogo.alAccion((a) => visto.push(a.accion))
    nodo(`[data-accion="${ACCION.RECUPERAR_BORRADOR}"]`).click()
    nodo(`[data-accion="${ACCION.DESCARTAR_BORRADOR}"]`).click()
    expect(visto).toEqual([ACCION.RECUPERAR_BORRADOR, ACCION.DESCARTAR_BORRADOR])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · Las intenciones
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-expediente · alAccion', () => {
  it('una acción de fila lleva el `id` de SU fila', () => {
    fijarTodo()
    const visto = []
    dialogo.alAccion((a) => visto.push(a))
    nodo(selectorFila('EXP-2')).querySelector(`[data-accion="${ACCION.DUPLICAR}"]`).click()
    expect(visto).toEqual([{ accion: ACCION.DUPLICAR, id: 'EXP-2', nombre: null }])
  })

  it('una acción global lleva `id: null`', () => {
    fijarTodo()
    const visto = []
    dialogo.alAccion((a) => visto.push(a))
    nodo(SELECTOR.EXPORTAR_DXF).click()
    expect(visto[0]).toEqual({ accion: ACCION.EXPORTAR_DXF, id: null, nombre: null })
  })

  it('el nombre tecleado viaja CON la acción, recortado', () => {
    // Para que el cableado no tenga que acordarse de leerlo, que es como se olvida.
    fijarTodo()
    nodo(SELECTOR.NOMBRE).value = '  Linde sur  '
    const visto = []
    dialogo.alAccion((a) => visto.push(a))
    nodo(SELECTOR.GUARDAR).click()
    expect(visto[0]).toEqual({ accion: ACCION.GUARDAR, id: null, nombre: 'Linde sur' })
    expect(dialogo.valores()).toEqual({ nombre: 'Linde sur' })
  })

  it('un nombre en blanco viaja como `null`, no como cadena vacía', () => {
    // El almacén sabe componer un rótulo por defecto; una cadena vacía le haría
    // guardar un nombre vacío.
    fijarTodo()
    nodo(SELECTOR.NOMBRE).value = '   '
    expect(dialogo.valores()).toEqual({ nombre: null })
  })

  it('admite VARIOS oyentes: un `= fn` desengancharía al primero en silencio', () => {
    fijarTodo()
    const a = []
    const b = []
    dialogo.alAccion((x) => a.push(x.accion))
    const baja = dialogo.alAccion((x) => b.push(x.accion))
    nodo(SELECTOR.EXPORTAR_PROYECTO).click()
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    baja()
    nodo(SELECTOR.EXPORTAR_PROYECTO).click()
    expect(a).toHaveLength(2)
    expect(b).toHaveLength(1)
  })

  it('⚠️ un oyente que revienta no deja la pantalla muda ni tumba a los demás', () => {
    // Una excepción dentro de un oyente del DOM NO sale por `dispatchEvent`: dejarla
    // propagar deja al usuario mirando una pantalla que no ha hecho nada.
    fijarTodo()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const otros = []
    dialogo.alAccion(() => {
      throw new Error('el cableado se ha roto')
    })
    dialogo.alAccion((x) => otros.push(x.accion))

    expect(() => nodo(SELECTOR.ABRIR_PROYECTO).click()).not.toThrow()
    expect(otros).toEqual([ACCION.ABRIR_PROYECTO])
    expect(avisos.at(-1).mensaje).toBe(MENSAJE_OYENTE_ROTO)
    expect(avisos.at(-1).nivel).toBe(NIVEL.ERROR)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('la delegación sobrevive a los repintados de la lista', () => {
    // Con un oyente por botón habría que darlos de baja en cada repintado, y el que
    // se olvide es una fuga que no se ve.
    fijarTodo()
    const visto = []
    dialogo.alAccion((a) => visto.push(a.id))
    fijarTodo()
    fijarTodo()
    nodo(selectorFila('EXP-1')).querySelector(`[data-accion="${ACCION.BORRAR}"]`).click()
    expect(visto).toEqual(['EXP-1'])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Abrir, cerrar, foco y Escape
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-expediente · apertura y cierre', () => {
  it('⚠️ jsdom sigue sin dar nada de `<dialog>` salvo `open`', () => {
    // Si esto se pone rojo, jsdom ha implementado el modal y el módulo se puede
    // simplificar. Vale más enterarse aquí que por casualidad tres fases más tarde.
    expect(Object.getOwnPropertyNames(HTMLDialogElement.prototype).sort()).toEqual([
      'constructor',
      'open',
    ])
  })

  it('abre con el atributo `open` y lleva el foco a un control', () => {
    fijarTodo()
    const fuera = document.createElement('button')
    document.body.append(fuera)
    fuera.focus()

    dialogo.abrir()
    expect(dialogo.abierto()).toBe(true)
    expect(dialogo.nodo.hasAttribute('open')).toBe(true)
    expect(dialogo.nodo.contains(document.activeElement)).toBe(true)
  })

  it('al cerrar devuelve el foco a quien lo tenía', () => {
    fijarTodo()
    const fuera = document.createElement('button')
    document.body.append(fuera)
    fuera.focus()
    dialogo.abrir()
    dialogo.cerrar()
    expect(document.activeElement).toBe(fuera)
  })

  it('`Escape` cierra y avisa; `cerrar()` cierra y NO avisa', () => {
    fijarTodo()
    const motivos = []
    dialogo.alCerrar((m) => motivos.push(m))

    dialogo.abrir()
    dialogo.nodo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(dialogo.abierto()).toBe(false)
    expect(motivos).toEqual([MOTIVO_CIERRE.ESCAPE])

    dialogo.abrir()
    dialogo.cerrar()
    expect(motivos).toEqual([MOTIVO_CIERRE.ESCAPE]) // el programático no avisa
  })

  it('«Cerrar» avisa con BOTON, y no se confunde con una acción del expediente', () => {
    fijarTodo()
    const motivos = []
    const acciones = []
    dialogo.alCerrar((m) => motivos.push(m))
    dialogo.alAccion((a) => acciones.push(a))
    dialogo.abrir()
    nodo(SELECTOR.CERRAR).click()
    expect(motivos).toEqual([MOTIVO_CIERRE.BOTON])
    expect(acciones).toEqual([])
  })

  it('cerrar NO borra nada: al reabrir sigue el nombre a medio teclear', () => {
    fijarTodo()
    dialogo.abrir()
    nodo(SELECTOR.NOMBRE).value = 'A medias'
    dialogo.cerrar()
    dialogo.abrir()
    expect(nodo(SELECTOR.NOMBRE).value).toBe('A medias')
  })

  it('⭐ un repintado de la lista tampoco le borra el nombre al usuario', () => {
    // `fijar` sin `nombre` no toca el campo: el cableado repinta la lista cada vez que
    // se guarda o se borra algo, y eso no puede tirar lo que hay tecleado.
    fijarTodo()
    nodo(SELECTOR.NOMBRE).value = 'A medias'
    fijarTodo()
    expect(nodo(SELECTOR.NOMBRE).value).toBe('A medias')
    // Y con `nombre` explícito sí se sustituye, que es la otra mitad.
    fijarTodo({ nombre: 'Otro' })
    expect(nodo(SELECTOR.NOMBRE).value).toBe('Otro')
  })

  it('abrir dos veces no pierde el elemento al que devolver el foco', () => {
    fijarTodo()
    const fuera = document.createElement('button')
    document.body.append(fuera)
    fuera.focus()
    dialogo.abrir()
    dialogo.abrir() // idempotente: no vuelve a apuntar `focoPrevio`
    dialogo.cerrar()
    expect(document.activeElement).toBe(fuera)
  })

  it('`destruir()` es idempotente y deja el DOM como estaba', () => {
    fijarTodo()
    dialogo.abrir()
    dialogo.destruir()
    expect(document.querySelectorAll('dialog').length).toBe(0)
    expect(() => dialogo.destruir()).not.toThrow()
    // Y queda inerte, sin lanzar.
    expect(() => dialogo.fijar({ registros: [] })).not.toThrow()
    expect(dialogo.abierto()).toBe(false)
    expect(dialogo.valores()).toEqual({ nombre: null })
    dialogo = null
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · ⭐ La familia de defectos de costura, comprobada contra el guardián REAL
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-expediente · un clic aquí dentro no es un clic en el mapa', () => {
  it('⭐ el guardián de clic-fuera de F09 reconoce ESTE diálogo, sin tocar una línea', async () => {
    // El plan predecía «debería costar cero» porque `viewer/cajon-diagnostico.js`
    // pregunta por el ELEMENTO `dialog` y no por su atributo `open`. Una predicción no
    // verificada es exactamente lo que este proyecto lleva pagando caro desde F03, así
    // que se comprueba con el fuente REAL del guardián y no con una copia suya.
    const fuente = readFileSync(join(RAIZ, 'viewer', 'cajon-diagnostico.js'), 'utf8')
    expect(fuente).toContain("closest('dialog')")
    // Y —la mitad que de verdad importa— que sigue preguntando por el ELEMENTO: con
    // `dialog[open]` daría `null` justo en el `keydown` de `Escape`, que es cuando el
    // diálogo ya se ha cerrado y el evento aún va subiendo.
    expect(fuente).not.toContain("closest('dialog[open]')")

    fijarTodo()
    dialogo.abrir()
    const dentro = nodo(SELECTOR.EXPORTAR_DXF)
    expect(dentro.closest('dialog')).toBe(dialogo.nodo)

    // Y con el diálogo CERRADO sigue reconociéndose, que es el caso que el `[open]`
    // se dejaba fuera.
    dialogo.cerrar()
    expect(dentro.closest('dialog')).toBe(dialogo.nodo)
  })

  it('los clics del diálogo burbujean hasta el `document`, como los del mapa', () => {
    // Anti-vacuidad de lo anterior: si no burbujearan, el guardián no haría falta y la
    // prueba de arriba no estaría afirmando nada.
    fijarTodo()
    const vistos = []
    const oyente = (e) => vistos.push(e.target)
    document.addEventListener('click', oyente)
    nodo(SELECTOR.EXPORTAR_COORDENADAS).click()
    document.removeEventListener('click', oyente)
    expect(vistos).toHaveLength(1)
    expect(vistos[0].closest('dialog')).toBe(dialogo.nodo)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · La frontera: el programador revienta
// ═════════════════════════════════════════════════════════════════════════════

describe('app/dialogo-expediente · contrato roto por el programador', () => {
  it('sin documento no se construye', () => {
    expect(() => crearDialogoExpediente()).toThrow(TypeError)
    expect(() => crearDialogoExpediente({ documento: null })).toThrow(TypeError)
    expect(() => crearDialogoExpediente({ documento: {} })).toThrow(TypeError)
  })

  it('un `fijar` con la forma equivocada lanza, y no deja la pantalla a medias', () => {
    fijarTodo()
    const antes = nodo(SELECTOR.LISTA).children.length
    expect(() => dialogo.fijar('no')).toThrow(TypeError)
    expect(() => dialogo.fijar({ registros: 'no' })).toThrow(TypeError)
    expect(() => dialogo.fijar({ registros: [{ nombre: 'sin id' }] })).toThrow(TypeError)
    // La validación va ANTES de tocar un solo nodo: si algo lanza, la pantalla queda
    // EXACTAMENTE como estaba.
    expect(nodo(SELECTOR.LISTA).children.length).toBe(antes)
  })

  it('`fijar(null)` deja la pantalla como recién nacida, sin cerrarla', () => {
    fijarTodo({ borrador: { refcat: null, edad: 'ayer' } })
    dialogo.abrir()
    dialogo.fijar(null)
    expect(dialogo.abierto()).toBe(true)
    expect(nodo(SELECTOR.LISTA).children.length).toBe(0)
    expect(nodo(SELECTOR.BORRADOR).hidden).toBe(true)
    expect(dialogo.puedeGuardar()).toBe(false)
    expect(nodo(SELECTOR.ESTADO).textContent).toBe(SIN_DATOS)
  })

  it('un `alAlgo` que no recibe función lanza', () => {
    expect(() => dialogo.alAccion('no')).toThrow(TypeError)
    expect(() => dialogo.alCerrar(null)).toThrow(TypeError)
  })

  it('un `id` con comillas no rompe `selectorFila`', () => {
    // `CSS.escape` no existe en jsdom, y un `[data-id="…"]` con comillas dentro es un
    // selector inválido: `querySelector` LANZA, a diez módulos de su causa.
    dialogo.fijar({ registros: [{ id: 'EXP-"raro"', nombre: 'x', srs: SRS }], srsActual: SRS })
    expect(() => dialogo.nodo.querySelector(selectorFila('EXP-"raro"'))).not.toThrow()
    expect(dialogo.nodo.querySelector(selectorFila('EXP-"raro"'))).not.toBeNull()
  })
})
