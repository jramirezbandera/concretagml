/* -------------------------------------------------------------------------- *
 * test/app/main-barra-expediente.dom.test.js — auditoría 2026-08-16           *
 *                                                                            *
 * ⛔ EL CANAL QUE EXISTÍA Y NO VIGILABA NADIE.                                *
 *                                                                            *
 * Archivar, renombrar o borrar un expediente cambia QUÉ documento hay abierto *
 * **sin tocar ningún store y sin mover de paso**, y esas dos cosas son lo     *
 * único que dispara una pintada de la barra (`navegacion.subscribe` y el      *
 * `repintar()` que llama `refrescarHechos`). Resultado medido: el diálogo     *
 * acusaba «Guardado «X»» y la zona de expediente de la barra seguía diciendo  *
 * «Sin guardar» hasta el siguiente cambio de store; con «Borrar», al revés,   *
 * se quedaba enseñando el nombre de un expediente que ya no existe —el caro   *
 * de los dos, porque afirma que el trabajo está archivado—.                   *
 *                                                                            *
 * `app/cableado-expediente.js` publica el canal (`alCambiarIdentidad`) y      *
 * `app/barra.js` sabe consumirlo (`suscribirExpediente`), y los dos tienen sus *
 * pruebas. Lo que NO tenía ninguna era el CABLE: el arreglo de los dos módulos *
 * no llega a producción hasta que `app/main.js` los une, y esa línea no la     *
 * cubría ningún test. Este fichero es esa cobertura, y por eso mide sobre la   *
 * aplicación ARRANCADA y con el gesto real (abrir «Expediente», escribir un    *
 * nombre, pulsar «Guardar»), no sobre las opciones con que se montó la barra:  *
 * afirmar que a `cablearBarra` se le pasó una función no demuestra que la      *
 * barra se entere de nada.                                                    *
 *                                                                            *
 * ── POR QUÉ UN FICHERO PROPIO ──                                              *
 * `app/main.js` se importa UNA vez por fichero (módulo cacheado) y aquí hace   *
 * falta el almacén REAL sobre `fake-indexeddb`: sin él no se guarda nada y no  *
 * hay identidad que pueda cambiar. Mismo motivo y mismo arnés que              *
 * `main-rama-por-url.dom.test.js` y `main-bd-versionchange.dom.test.js`.       *
 *                                                                            *
 * ── ⚠️ LA TRAMPA DEL ARNÉS, QUE ESTA PRUEBA YA PISÓ ──                        *
 * «Guardar» nace APAGADO y se enciende cuando llega el listado del almacén, y  *
 * `dialogo-expediente.js#alPulsar` ignora a propósito el clic sobre un botón   *
 * apagado («guarda de cinturón»). Pulsar sin esperar a que el diálogo arranque *
 * pierde el gesto en silencio y pinta de rojo el CABLE por culpa del ARNÉS.    *
 * De ahí la espera tras abrir, y de ahí que se afirme el acuse del diálogo     *
 * ANTES que la barra: si el rojo sale ahí, lo roto es guardar, no el cable.    *
 *                                                                            *
 * ── MUTACIÓN EJECUTADA (para comprobar que no es un guardián vacuo) ──        *
 * Aplicada a `app/main.js`, corrida `node scripts/vitest.mjs run --project dom *
 * main-barra-expediente` y revertida con el editor:                            *
 *   M1 · quitar la opción `suscribirExpediente` de `cablearBarra` —el estado   *
 *        en el que la auditoría encontró el cable— → **2 rojos**: la barra     *
 *        sigue diciendo «Sin guardar» con el expediente ya archivado. El acuse *
 *        del diálogo sigue VERDE, que es lo que separa el cable del gesto.     *
 * -------------------------------------------------------------------------- */

import 'fake-indexeddb/auto'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { ATRIBUTO_BARRA, EXPEDIENTE_SIN_NOMBRE } from '../../app/barra.js'
import { SELECTOR_BOTON_EXPEDIENTE } from '../../app/cableado-expediente.js'
import { SRS_DEMO } from '../../app/demo-datos.js'
import { SELECTOR as SELECTOR_DIALOGO } from '../../app/dialogo-expediente.js'
import { husoPorSrs } from '../../geo/huso.js'
import { crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { crearCajonComprobacion } from '../../viewer/cajon-comprobacion.js'
import { crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearListaSobrante } from '../../viewer/lista-sobrante.js'
import { VARIANTE, crearCapaPiezas } from '../../viewer/piezas.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

const RAIZ = join(import.meta.dirname, '..', '..')

// ── Los dobles (arnés de `main-rama-por-url.dom.test.js`, ver su cabecera) ───

const arranque = vi.hoisted(() => ({ opciones: null, peticiones: [] }))

let mapaVivo = null
let barraViva = null
let diagnosticoVivo = null
let comprobacionViva = null
let sobranteVivo = null

/** El cromo que `crearVisor` monta SOBRE el mapa se monta DE VERDAD. */
function montarCromoDelMapa() {
  const { mapa } = montarMapa()
  crearPanes(mapa)
  barraViva = crearBarraEdicion({ mapa })
  mapaVivo = mapa
  const zona = husoPorSrs(SRS_DEMO)
  diagnosticoVivo = {
    cajon: crearCajonDiagnostico({ mapa }),
    contraste: crearContraste({ mapa, zona }),
  }
  comprobacionViva = crearCajonComprobacion({ mapa })
  sobranteVivo = {
    lista: crearListaSobrante({ documento: document }),
    capa: crearCapaPiezas({ mapa, zona }),
    capaFuera: crearCapaPiezas({ mapa, zona, variante: VARIANTE.FUERA }),
  }
}

vi.mock('../../viewer/index.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    crearVisor: (_contenedor, opciones) => {
      arranque.opciones = opciones
      montarCromoDelMapa()
      return {
        mapa: mapaVivo,
        estado: opciones.estado,
        capas: {},
        acotaciones: null,
        edicion: {
          snapActivo: () => true,
          tolerancia: () => 0.2,
          ladoSeleccionado: () => null,
          alCambiarSeleccion: () => () => {},
          modoBorrar: () => false,
          alCambiarModoBorrar: () => () => {},
          fijarColindantes() {},
          desplazarSeleccion: () => ({ aplicado: false, modo: null, detecciones: [] }),
          activa: (v) => v,
        },
        barraEdicion: {
          control: barraViva.control,
          dibujoVisible() {},
          dibujoEnCurso() {},
        },
        colindantes: { pintar() {}, limpiar() {}, destruir() {} },
        diagnostico: diagnosticoVivo,
        comprobacion: comprobacionViva,
        sobrante: sobranteVivo,
        destruir() {},
      }
    },
  }
})

/** Lo único que tocaría la red. Guardar un expediente no consulta nada. */
vi.mock('../../services/_red.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    crearTransporte: () => ({
      async pedirTexto(url) {
        arranque.peticiones.push(url)
        throw new Error(`prueba: este arranque no debería tocar la red (${url})`)
      },
      estado: () => ({ peticiones: arranque.peticiones.length }),
      destruir() {},
    }),
  }
})

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

const CASCARA = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body([^>]*)>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/main-barra-expediente.dom.test.js: no se ha encontrado el <body> de index.html.',
    )
  }
  const clase = /class="([^"]*)"/i.exec(encontrado[1])
  const atributos = [...encontrado[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(([, n, v]) => [n, v])
  return { clase: clase === null ? '' : clase[1], atributos, cuerpo: encontrado[2] }
})()

document.body.className = CASCARA.clase
for (const [nombre, valor] of CASCARA.atributos) document.body.setAttribute(nombre, valor)
document.body.innerHTML = CASCARA.cuerpo

// `?demo=real` para arrancar CON geometría: sin nada que archivar, «Guardar» está
// apagado y no hay identidad que pueda cambiar.
window.history.replaceState({}, '', '?demo=real')

// El arranque REAL, una sola vez. Si lanzara, el fichero entero falla aquí.
await import('../../app/main.js')

/** El store REAL del ensamblaje. */
const estado = arranque.opciones.estado

// ── Ayudas ───────────────────────────────────────────────────────────────────

const nodoBarra = (cual) => document.querySelector(`[${ATRIBUTO_BARRA}="${cual}"]`)
const nombreEnLaBarra = () => nodoBarra('expediente-nombre').textContent.trim()
const apunteEnLaBarra = () => nodoBarra('expediente-apunte').textContent.trim()

/** Pulsa un botón. Falla nombrándolo si no está o si está apagado. */
function pulsar(selector) {
  const boton = document.querySelector(selector)
  expect(boton, `no hay ningún botón '${selector}'`).not.toBeNull()
  expect(boton.disabled, `el botón '${selector}' está apagado`).not.toBe(true)
  boton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

/**
 * Cede el turno unas cuantas vueltas. Macrotareas y no microtareas:
 * `fake-indexeddb` programa las suyas y una cadena de `Promise.resolve()` no las
 * deja correr.
 */
async function cederTurno(veces = 40) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) {
    await new Promise((cumplir) => setTimeout(cumplir, 0))
  }
}

const NOMBRE = 'Lindero norte · Cortijo del Aljibe'

// ═══════════════════════════════════════════════════════════════════════════

describe('app/main · la barra sigue al EXPEDIENTE, no solo a los dos stores', () => {
  it('de partida la barra dice que hay trabajo SIN archivar', () => {
    // Anti-vacuidad del guardián de abajo: si la barra ya dijera el nombre antes
    // de guardar, la prueba siguiente pasaría sin que el cable existiera.
    expect(nombreEnLaBarra()).toBe(EXPEDIENTE_SIN_NOMBRE.nombre)
    expect(nombreEnLaBarra()).not.toContain(NOMBRE)
  })

  it('⛔ guardar con nombre se REFLEJA en la barra, sin tocar el store ni cambiar de paso', async () => {
    // El gesto REAL, entero: abrir «Expediente», escribir el nombre y pulsar
    // «Guardar». Nada de llamar a la API del cableado por dentro — lo que la
    // auditoría encontró sin cubrir era justo el recorrido.
    const parcelaAntes = estado.get()
    const pasoAntes = document.body.dataset.paso

    pulsar(SELECTOR_BOTON_EXPEDIENTE)
    // ⚠️ Se ESPERA a que el diálogo termine de arrancar: ver la trampa del arnés
    // en la cabecera. Sin esto, el clic de «Guardar» se pierde en silencio.
    await cederTurno()

    const campo = document.querySelector(SELECTOR_DIALOGO.NOMBRE)
    expect(campo, 'no se ha abierto el diálogo de expediente').not.toBeNull()
    campo.value = NOMBRE
    pulsar(SELECTOR_DIALOGO.GUARDAR)
    await cederTurno()

    // Primero el acuse del DIÁLOGO, que es la mitad que no depende de la barra:
    // si el rojo saliera aquí, lo roto es guardar y no el cable.
    expect(
      document.querySelector(SELECTOR_DIALOGO.ESTADO).textContent,
      'el expediente no se ha llegado a archivar',
    ).toMatch(/guardado/i)

    // ⭐ Y lo que se juega este fichero: la barra se ha enterado.
    expect(nombreEnLaBarra()).toBe(NOMBRE)
    expect(apunteEnLaBarra()).toMatch(/guardado/i)

    // …y se ha enterado SIN que se mueva nada de lo que la barra sabía seguir. Es
    // lo que convierte esto en un guardián del CABLE y no del gesto: si el
    // repintado hubiera llegado por el camino de siempre, uno de estos dos habría
    // cambiado.
    expect(estado.get(), 'archivar no toca el store de la parcela').toBe(parcelaAntes)
    expect(document.body.dataset.paso, 'archivar no mueve de paso').toBe(pasoAntes)
  })

  it('⚠️ y el texto no se ha borrado después: la zona queda puesta, no parpadea', () => {
    // El complemento del anterior: la pintada de la zona no es un destello que la
    // siguiente pintada completa deshaga leyendo otra cosa.
    expect(nombreEnLaBarra()).toBe(NOMBRE)
  })
})
