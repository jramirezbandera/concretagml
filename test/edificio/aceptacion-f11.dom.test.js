/* -------------------------------------------------------------------------- *
 * test/edificio/aceptacion-f11.dom.test.js — F11 · T5.1 · SUITE DE ACEPTACIÓN  *
 *                                                                              *
 * La mitad de la aceptación de F11 que **necesita un documento**. El resto de   *
 * los criterios, y la cabecera larga con las cuatro reglas de la suite, están   *
 * en el hermano `test/edificio/aceptacion-f11.test.js` (proyecto `node`).       *
 * Aquí viven:                                                                  *
 *                                                                              *
 *   AC1 · «El selector oculta los atributos semánticos en modo                 *
 *         simplificado.» ....................................... § 1           *
 *   AC3 · «La RC se deduce del centroide de la huella y es editable.»          *
 *         .......... § 2 — **la mitad «y es editable»**. La mitad «se deduce»   *
 *         es geometría pura y se mide en el hermano `node`, sobre el fixture    *
 *         real de trece partes.                                                *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * ⭐ EL AC1 SE CUMPLE **MÁS FUERTE** QUE COMO LO PIDE LA FICHA, Y ES MEDIBLE   *
 * ════════════════════════════════════════════════════════════════════════════ *
 * La ficha dice «ocultar el bloque de atributos semánticos». La desviación 12   *
 * del plan hace algo distinto y comprobable: en SIMPLIFICADO esos nodos **no    *
 * están ocultos, NO ESTÁN** — ni el `<dialog>` de los siete atributos, ni el    *
 * botón que lo abre. `app/panel-edificio.js` los declara aparte de los demás,   *
 * en `SELECTOR_COMPLETO`, cuyo JSDoc dice literalmente que es «la forma         *
 * comprobable del criterio de aceptación 1».                                    *
 *                                                                              *
 * La diferencia entre las dos lecturas **se mide**, y es la razón de ser del    *
 * § 1.2: con `hidden`, el nodo sigue CONECTADO al documento —conserva su valor, *
 * sus oyentes siguen disparando y basta con quitar un atributo desde la consola *
 * para que reaparezca—. Aquí se guarda la referencia al nodo mientras existe y  *
 * se comprueba que, al volver a SIMPLIFICADO, queda `isConnected: false`. Una   *
 * implementación con `hidden` pasaría todo lo demás de este fichero y ese `it`  *
 * la pondría en rojo.                                                          *
 *                                                                              *
 * Y hay una razón para que no sea celo de tests: el modelo del ICUC **no tiene  *
 * esas claves** (`crearEdificio` no las añade en SIMPLIFICADO, medido en el     *
 * hermano `node`, § 3.7). Un formulario que las enseñara escondidas dejaría al  *
 * usuario rellenando campos que no se van a serializar.                        *
 *                                                                              *
 * ── NO SE DUPLICA LA UNITARIA ───────────────────────────────────────────────  *
 * El panel nodo a nodo —los siete `data-campo`, los rótulos, el `<select>` de   *
 * conservación, el año con letras, el diálogo abriéndose y cerrándose— es de    *
 * `test/app/panel-edificio.dom.test.js`; el cable entero (las cinco vías, la    *
 * deducción contra el servicio, el repintado que no borra) es de                *
 * `test/app/edificio.dom.test.js`. Aquí solo está el recorrido del criterio, y  *
 * **sobre un edificio REAL**: el `wfsBU` de 9398516VK3799G, que es el único     *
 * documento del repo que trae los siete atributos semánticos de verdad          *
 * (`1_residential`, FUNCIONAL, 1997, 18 inmuebles, 17 viviendas, 2.513 m²).     *
 *                                                                              *
 * ⚠️ De `<dialog>`, jsdom da EXACTAMENTE `constructor` y `open` (medido en F09   *
 * y sin cambios): ni `showModal()`, ni `close()`, ni foco. Este fichero no      *
 * necesita nada de eso —pregunta por la EXISTENCIA de los nodos, no por su      *
 * apertura—, y lo que sí hace falta lo cubre la unitaria del panel.             *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  ACCION,
  CAMPO_ATRIBUTO,
  SELECTOR,
  SELECTOR_COMPLETO,
  crearPanelEdificio,
} from '../../app/panel-edificio.js'
import { entradaDesdeTexto, entradaDesdeWfsBu, puntoDeReferencia } from '../../edificio/entrada.js'
import { conModelo } from '../../edificio/mutaciones.js'
import { TIPO_EDIFICIO } from '../../edificio/_comun.js'
import { parsearGmlBu } from '../../gml/parse-bu.js'
import { ATRIBUTOS_COMPLETO, MODELO_EDIFICIO } from '../../model/edificio.js'

// ═════════════════════════════════════════════════════════════════════════════
// 0 · Los dos edificios REALES y el arnés
// ═════════════════════════════════════════════════════════════════════════════

const RAIZ = join(import.meta.dirname, '..', '..')

function leerXml(rel) {
  const bytes = readFileSync(join(RAIZ, ...rel.split('/')))
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  return new TextDecoder(m ? m[1] : 'utf-8').decode(bytes)
}

const WFS_TODO = leerXml('test/fixtures/catastro/wfsbu-allconstruction-9398516VK3799G.xml')
const DXF_EDIFICIO = readFileSync(
  join(RAIZ, 'test', 'fixtures', 'parsers', 'edificio_consulta_masiva_3515508VF0831N.dxf'),
  'latin1',
)

/**
 * El edificio del Catastro en modelo COMPLETO: el único documento del repo con
 * los siete atributos semánticos rellenos de verdad. Sus valores MEDIDOS son los
 * que este fichero espera ver en los campos.
 */
const CON_ATRIBUTOS = entradaDesdeWfsBu(parsearGmlBu(WFS_TODO), {
  modelo: MODELO_EDIFICIO.COMPLETO,
}).edificio

/** Las siete huellas de la capa `Construccion` del DXF real (criterio 2). */
const DEL_DXF = entradaDesdeTexto(DXF_EDIFICIO, { capa: 'Construccion' }).edificio

/** La referencia que el Catastro devolvería para el punto de esas huellas. */
const RC_DEL_DIBUJO = '3515508VF0831N'

let panel
let intenciones

beforeEach(() => {
  document.body.replaceChildren()
  document.body.className = 'gml-app'
  intenciones = []
  panel = crearPanelEdificio({ documento: document })
  // Dos anclas, como hará `app/main.js` con los bloques de la rama de parcela.
  const anclaOrigen = document.createElement('section')
  const anclaPartes = document.createElement('section')
  document.body.append(anclaOrigen, anclaPartes)
  panel.montar({ trasOrigen: anclaOrigen, trasPartes: anclaPartes })
  panel.alAccion((carga) => intenciones.push(carga))
})

afterEach(() => {
  panel?.destruir()
  document.body.replaceChildren()
  document.body.className = ''
})

/** Un nodo que TIENE que estar. Se busca en todo el documento a propósito. */
function nodo(selector) {
  const el = document.querySelector(selector)
  expect(el, `falta el nodo ${selector}`).not.toBeNull()
  return el
}

const todos = (selector) => [...document.querySelectorAll(selector)]

/** Elige un modelo POR EL SELECTOR, como lo haría una persona. */
function elegirModelo(valor) {
  const radio = todos(SELECTOR.MODELO).find((r) => r.value === valor)
  expect(radio, `no hay radio para el modelo ${valor}`).toBeDefined()
  radio.checked = true
  radio.dispatchEvent(new Event('change', { bubbles: true }))
  return radio
}

/** Escribe en un campo como lo haría un teclado: valor + `input`. */
function teclear(campo, texto) {
  campo.value = texto
  campo.dispatchEvent(new Event('input', { bubbles: true }))
}

// ══════════════════════════════════════════════════════════════════════════════
// § 1 · AC1
// ══════════════════════════════════════════════════════════════════════════════
describe('AC1 · «El selector oculta los atributos semánticos en modo simplificado.»', () => {
  it('⭐ el panel nace en SIMPLIFICADO y los atributos NO ESTÁN en el documento', () => {
    // 1.1 · Ni ocultos ni deshabilitados: ausentes. `atributosDisponibles()` lo
    // dice sin que nadie tenga que espiar el DOM por selector.
    expect(panel.valores().modelo).toBe(MODELO_EDIFICIO.SIMPLIFICADO)
    expect(panel.atributosDisponibles()).toBe(false)

    for (const selector of Object.values(SELECTOR_COMPLETO)) {
      expect(document.querySelector(selector), `${selector} existe en SIMPLIFICADO`).toBeNull()
    }
    // Ni uno de los siete campos, por su `data-campo` del contrato.
    for (const campo of Object.values(CAMPO_ATRIBUTO)) {
      expect(document.querySelector(`[data-campo="${campo}"]`), `${campo} existe`).toBeNull()
    }
    // Y el único `<dialog>` del panel es el del reparto por capas.
    expect(todos('dialog')).toHaveLength(1)

    // Anti-vacuidad: los que existen SIEMPRE sí están. Si el panel entero
    // estuviera vacío, todo lo de arriba pasaría igual y no diría nada.
    for (const selector of Object.values(SELECTOR)) nodo(selector)
  })

  it('⭐ ⛔ «ocultar» y «no estar» NO son lo mismo, y aquí se mide la diferencia', () => {
    // 1.2 · El guardián que distingue esta implementación de un `hidden`. Medido
    // en T0.3·5: con `hidden` el nodo sigue conectado, conserva su valor y sus
    // oyentes siguen disparando; basta con quitar el atributo para que vuelva.
    elegirModelo(MODELO_EDIFICIO.COMPLETO)
    const bloque = nodo(SELECTOR_COMPLETO.BLOQUE_ATRIBUTOS)
    const boton = nodo(SELECTOR_COMPLETO.ABRIR_ATRIBUTOS)
    expect(bloque.isConnected).toBe(true)
    expect(boton.isConnected).toBe(true)

    elegirModelo(MODELO_EDIFICIO.SIMPLIFICADO)

    // Lo que un `hidden` NO daría: los nodos han salido del documento.
    expect(bloque.isConnected).toBe(false)
    expect(boton.isConnected).toBe(false)
    expect(panel.atributosDisponibles()).toBe(false)
    // Y no se han quedado escondidos en el panel con un atributo puesto.
    //
    // ⚠️ Se pregunta por los nodos DEL CRITERIO y no por «ningún `[hidden]` en todo
    // el panel», que es lo que ponía aquí: desde el 2026-08-04 el panel oculta con
    // `hidden` el apunte del modelo que NO está elegido (272,03 px medidos que
    // costaban los dos a la vez), y eso no tiene nada que ver con este criterio.
    for (const oculto of todos('[hidden]')) {
      for (const selector of Object.values(SELECTOR_COMPLETO)) {
        expect(oculto.querySelector(selector), `${selector} escondido en un [hidden]`).toBeNull()
        expect(oculto.matches(selector)).toBe(false)
      }
    }
  })

  it('⭐ con el edificio REAL del Catastro: en COMPLETO se ven los siete, y son los del documento', () => {
    // 1.3 · El recorrido del criterio sobre un edificio de verdad. Los valores son
    // los MEDIDOS del `wfsBU` de 9398516VK3799G, no un POJO de juguete: un
    // formulario que aparece vacío no demuestra que el bloque sirva para algo.
    panel.fijar({ edificio: CON_ATRIBUTOS })

    expect(panel.valores().modelo).toBe(MODELO_EDIFICIO.COMPLETO)
    expect(panel.atributosDisponibles()).toBe(true)
    for (const selector of Object.values(SELECTOR_COMPLETO)) nodo(selector)

    const campos = todos(`${SELECTOR_COMPLETO.BLOQUE_ATRIBUTOS} [data-campo]`)
    expect(campos).toHaveLength(ATRIBUTOS_COMPLETO.length)
    expect(ATRIBUTOS_COMPLETO).toHaveLength(7)

    const leido = Object.fromEntries(campos.map((c) => [c.dataset.campo, c.value]))
    expect(leido[CAMPO_ATRIBUTO.usoDominante]).toBe('1_residential')
    expect(leido[CAMPO_ATRIBUTO.estadoConservacion]).toBe('FUNCIONAL')
    expect(leido[CAMPO_ATRIBUTO.anioConstruccion]).toBe('1997')
    expect(leido[CAMPO_ATRIBUTO.numeroInmuebles]).toBe('18')
    expect(leido[CAMPO_ATRIBUTO.numeroViviendas]).toBe('17')
    expect(leido[CAMPO_ATRIBUTO.superficieConstruida]).toBe('2513')
    // El año de reforma viene vacío en el documento, y el hueco vacío es hueco
    // vacío: no se rellena con un `0` ni con el de construcción.
    expect(leido[CAMPO_ATRIBUTO.anioReforma]).toBe('')
  })

  it('⭐ y al pasar a SIMPLIFICADO desaparecen del documento, con datos dentro y todo', () => {
    // 1.4 · La otra dirección, que es la del criterio: el caso frecuente —el ICUC—
    // es el camino corto. Y se hace con los campos LLENOS, que es cuando un
    // formulario oculto seguiría enviando lo que tiene dentro.
    panel.fijar({ edificio: CON_ATRIBUTOS })
    const campos = todos(`${SELECTOR_COMPLETO.BLOQUE_ATRIBUTOS} [data-campo]`)
    expect(campos.some((c) => c.value !== '')).toBe(true)

    elegirModelo(MODELO_EDIFICIO.SIMPLIFICADO)

    expect(panel.atributosDisponibles()).toBe(false)
    for (const selector of Object.values(SELECTOR_COMPLETO)) {
      expect(document.querySelector(selector)).toBeNull()
    }
    for (const campo of campos) expect(campo.isConnected).toBe(false)
    // `valores()` deja de ofrecer atributos: no hay de dónde leerlos, y devolver
    // los últimos vistos sería contarle al cableado un formulario que ya no existe.
    expect(panel.valores().atributos).toBeNull()
    // Y no queda nada que abrir.
    expect(() => panel.abrirAtributos()).not.toThrow()
    expect(panel.atributosDisponibles()).toBe(false)
  })

  it('⭐ el cambio se EMITE antes de tocar el modelo: la pérdida se puede avisar (regla de oro 1)', () => {
    // 1.5 · «Ocultar» aquí significa BORRAR: `crearEdificio` no añade esas claves
    // en SIMPLIFICADO, así que el paso es destructivo. El panel emite la intención
    // y no muta nada, y `conModelo` devuelve la lista de lo que se pierde JUNTO al
    // edificio nuevo, para que la interfaz pueda preguntar ANTES de escribirlo.
    panel.fijar({ edificio: CON_ATRIBUTOS })
    intenciones.length = 0
    elegirModelo(MODELO_EDIFICIO.SIMPLIFICADO)

    expect(intenciones.map((i) => i.accion)).toEqual([ACCION.CAMBIAR_MODELO])
    // La intención viaja con lo que hubiera en el panel al pulsar, y ahí está el
    // modelo elegido: el cableado no tiene que volver a leer el DOM para saberlo.
    expect(intenciones[0].valores.modelo).toBe(MODELO_EDIFICIO.SIMPLIFICADO)
    // El POJO del store sigue entero: el panel no lo ha tocado.
    expect(CON_ATRIBUTOS.numeroViviendas).toBe(17)
    expect(CON_ATRIBUTOS.modelo).toBe(MODELO_EDIFICIO.COMPLETO)

    const { edificio, detecciones } = conModelo(CON_ATRIBUTOS, MODELO_EDIFICIO.SIMPLIFICADO)
    expect(edificio).not.toBe(CON_ATRIBUTOS)
    for (const clave of ATRIBUTOS_COMPLETO) expect(clave in edificio).toBe(false)

    const aviso = detecciones.find((d) => d.tipo === TIPO_EDIFICIO.MODELO_CAMBIADO)
    expect(aviso).toBeDefined()
    expect(aviso.datos.atributosPerdidos).toEqual([...ATRIBUTOS_COMPLETO])
    // Y enumera CON QUÉ VALOR se pierde cada uno: los seis que traía relleno el
    // documento real (el año de reforma venía vacío). Una lista de claves sin sus
    // valores no le sirve al usuario para decidir si sigue.
    expect(aviso.datos.conValor.map((a) => a.clave)).toEqual(
      ATRIBUTOS_COMPLETO.filter((c) => CON_ATRIBUTOS[c] !== null),
    )
    expect(aviso.datos.conValor).toHaveLength(6)
    expect(aviso.datos.conValor.map((a) => a.valor)).toContain(17)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// § 2 · AC3 — la mitad «y es editable» (la mitad «se deduce» está en el `.test.js`)
// ══════════════════════════════════════════════════════════════════════════════
describe('AC3 · «La RC se deduce del centroide de la huella y es editable.»', () => {
  it('⛔ el campo lleva APELLIDO de rama: `refcat-edificio`, jamás `refcat`', () => {
    // 2.1 · Medido en T0.3·6: `querySelector` se queda con el nodo de la rama de
    // PARCELA aunque esté oculto, así que un `[data-campo="refcat"]` a secas aquí
    // dejaría muerta una de las dos ramas, en silencio. (Que `index.html` no
    // declare ninguno de estos `data-*` lo comprueba
    // `test/app/panel-edificio.dom.test.js:302`, leyendo el fichero de verdad.)
    expect(SELECTOR.REFCAT).toBe('[data-campo="refcat-edificio"]')
    const campo = nodo(SELECTOR.REFCAT)
    expect(campo.dataset.campo).toBe('refcat-edificio')
    expect(document.querySelector('[data-campo="refcat"]')).toBeNull()
  })

  it('⭐ «es editable»: es un campo de texto vivo, sin `readonly`, `disabled` ni `maxlength`', () => {
    // 2.2 · Editable de verdad, no un renglón que se pueda leer. Y sin
    // `maxlength`, que en `index.html` fue un FALLO SILENCIOSO medido: recortaba
    // lo pegado antes de que nadie lo mirara, así que quien pegaba
    // «9398516 VK3799G» —con el espacio con el que la Sede imprime las
    // referencias— perdía el último carácter.
    const campo = nodo(SELECTOR.REFCAT)
    expect(campo.tagName).toBe('INPUT')
    expect(campo.type).toBe('text')
    expect(campo.hasAttribute('readonly')).toBe(false)
    expect(campo.disabled).toBe(false)
    expect(campo.hasAttribute('maxlength')).toBe(false)

    teclear(campo, '9398516 VK3799G')
    expect(campo.value).toBe('9398516 VK3799G')
    expect(campo.value).toHaveLength(15)
  })

  it('⭐ el recorrido del criterio: hay huella → sale un punto → se escribe la RC → se corrige a mano', () => {
    // 2.3 · Las dos mitades cosidas, sobre el DXF real de siete huellas. La
    // consulta al Catastro NO pasa por aquí (es red): lo que se mide es que la
    // deducción tiene de dónde salir y que lo deducido es editable encima.
    // El cable completo está en `test/app/edificio.dom.test.js:802`.
    panel.fijar({ edificio: DEL_DXF })
    expect(DEL_DXF.partes).toHaveLength(7)

    const punto = puntoDeReferencia(DEL_DXF)
    expect(punto).not.toBeNull()
    expect(punto.every(Number.isFinite)).toBe(true)

    // Lo que el Catastro devolvería para ese punto entra en el campo…
    panel.fijar({ edificio: DEL_DXF, refcat: RC_DEL_DIBUJO })
    const campo = nodo(SELECTOR.REFCAT)
    expect(campo.value).toBe(RC_DEL_DIBUJO)

    // …y encima se puede corregir, que es la mitad «y es editable».
    teclear(campo, '9398516VK3799G')
    expect(panel.valores().refcat).toBe('9398516VK3799G')
  })

  it('⭐ un repintado NO le borra al usuario lo que está tecleando', () => {
    // 2.4 · La mitad de «editable» que se rompe sola: cargar partes, renombrar una
    // o cambiar de modelo vuelve a pintar el panel, y si ese repintado escribiera
    // en el campo, el usuario perdería la referencia a media línea. Que `fijar` SÍ
    // escribe cuando se le pide es la mitad anti-vacuidad de este `it`.
    const campo = nodo(SELECTOR.REFCAT)
    teclear(campo, '3515508VF08')

    panel.fijar({ edificio: DEL_DXF }) // sin `refcat`: no se toca
    expect(campo.value).toBe('3515508VF08')
    expect(panel.valores().refcat).toBe('3515508VF08')

    panel.fijar({ edificio: DEL_DXF, refcat: RC_DEL_DIBUJO }) // con `refcat`: sí
    expect(campo.value).toBe(RC_DEL_DIBUJO)
  })
})
