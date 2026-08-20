/* -------------------------------------------------------------------------- *
 * test/app/main-rama-por-url.dom.test.js — la rama que pide la URL SE APLICA   *
 *                                                                              *
 * Auditoría 2026-08-16. `app/main.js` cableaba la rama en UN SOLO sentido:      *
 * `ramaCableada.subscribe(r => navegacion.cambiarRama(r))`. El viaje de vuelta  *
 * no existía —`ramaCableada.set(...)` solo lo llamaba el GML de edificio—, así  *
 * que una ruta que pidiera EDIFICIO movía la NAVEGACIÓN y dejaba el conmutador, *
 * el panel, la ficha, `<body data-rama>` y el mando de «Generar GML» en         *
 * PARCELA.                                                                     *
 *                                                                              *
 * Lo medido entonces, con una parcela cargada y la URL `#/edificio/edicion`:    *
 *                                                                              *
 *   · `navegacion.get()` → `{rama:'EDIFICIO', paso:'entrada'}`                  *
 *   · `document.body.dataset.rama` → `'PARCELA'`, conmutador con «Parcela»      *
 *     pulsado y el bloque del Catastro a la vista;                             *
 *   · el rail bloqueando Edición y Diagnóstico con «Falta el edificio» ENCIMA   *
 *     del panel de parcela, y sin salida salvo pulsar «Edificio» y volver.      *
 *                                                                              *
 * Y no es una URL rara: la escribe la propia aplicación en cada conmutación     *
 * (`escribirRuta`), así que se llega ahí con el botón ATRÁS del navegador.      *
 *                                                                              *
 * ── POR QUÉ UN FICHERO PROPIO ──                                               *
 * El hash hay que ponerlo ANTES de importar `app/main.js`, y el arranque real   *
 * se importa UNA vez por fichero (módulo cacheado). Misma razón por la que      *
 * existen `main-arranque-vacio` y `main-bd-versionchange`, y mismo arnés: los   *
 * dobles se copian de aquél, cuya cabecera los explica.                        *
 *                                                                              *
 * Proyecto Vitest `dom`.                                                       *
 * -------------------------------------------------------------------------- */

import 'fake-indexeddb/auto'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, vi } from 'vitest'

import { SRS_DEMO } from '../../app/demo-datos.js'
import { husoPorSrs } from '../../geo/huso.js'
import { crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { crearCajonComprobacion } from '../../viewer/cajon-comprobacion.js'
import { crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearListaSobrante } from '../../viewer/lista-sobrante.js'
import { VARIANTE, crearCapaPiezas } from '../../viewer/piezas.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

const RAIZ = join(import.meta.dirname, '..', '..')

// ── Los dobles (arnés de `main-arranque-vacio.dom.test.js`, ver su cabecera) ─

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
  diagnosticoVivo = {
    cajon: crearCajonDiagnostico({ mapa }),
    contraste: crearContraste({ mapa, zona: husoPorSrs(SRS_DEMO) }),
  }
  comprobacionViva = crearCajonComprobacion({ mapa })
  sobranteVivo = {
    lista: crearListaSobrante({ documento: document }),
    capa: crearCapaPiezas({ mapa, zona: husoPorSrs(SRS_DEMO) }),
    capaFuera: crearCapaPiezas({ mapa, zona: husoPorSrs(SRS_DEMO), variante: VARIANTE.FUERA }),
    capaVecinos: crearCapaPiezas({ mapa, zona: husoPorSrs(SRS_DEMO), variante: VARIANTE.VECINO }),
  }
}

vi.mock('../../viewer/index.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    crearVisor: (contenedor, opciones) => {
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
          // El modo insertar (2026-08-18): gemelo del de arriba, y por lo mismo.
          modoInsertar: () => false,
          alCambiarModoInsertar: () => () => {},
          fijarColindantes() {},
          // Los puntos sueltos del levantamiento (2026-08-19). El doble solo tiene
          // que EXISTIR: quien comprueba que se le pasan los buenos es
          // `main-edicion.dom.test.js`.
          fijarPuntos() {},
          desplazarSeleccion: () => ({ aplicado: false, modo: null, detecciones: [] }),
          activa: (v) => v,
        },
        barraEdicion: {
          control: barraViva.control,
          dibujoVisible() {},
          dibujoEnCurso() {},
        },
        colindantes: { pintar() {}, limpiar() {}, destruir() {} },
        puntosLevantamiento: { pintar() {}, limpiar() {}, destruir() {} },
        diagnostico: diagnosticoVivo,
        comprobacion: comprobacionViva,
        sobrante: sobranteVivo,
        destruir() {},
      }
    },
  }
})

/** Lo único que tocaría la red. Esta prueba no consulta nada al Catastro. */
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
      'test/app/main-rama-por-url.dom.test.js: no se ha encontrado el <body> de index.html.',
    )
  }
  const clase = /class="([^"]*)"/i.exec(encontrado[1])
  const atributos = [...encontrado[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(([, n, v]) => [
    n,
    v,
  ])
  return { clase: clase === null ? '' : clase[1], atributos, cuerpo: encontrado[2] }
})()

document.body.className = CASCARA.clase
for (const [nombre, valor] of CASCARA.atributos) document.body.setAttribute(nombre, valor)
document.body.innerHTML = CASCARA.cuerpo

// ⭐ LO QUE MIDE ESTE FICHERO: la URL pide EDIFICIO **antes** de que arranque
// nada. Es exactamente lo que el navegador entrega al pegar un enlace o al
// pulsar ATRÁS sobre una ruta que la propia aplicación escribió.
window.history.replaceState({}, '', '/#/edificio/entrada')

// El arranque REAL, una sola vez. Si lanzara, el fichero entero falla aquí.
await import('../../app/main.js')

describe('app/main · la rama que pide la URL se APLICA, no solo se navega', () => {
  it('⭐ arrancar en `#/edificio/entrada` deja la pantalla en EDIFICIO', () => {
    // El `<body data-rama>` es, según `app/rama.js`, «el ÚNICO gancho de CSS de
    // la rama»: si dice PARCELA, la pantalla ENTERA está en parcela por mucho que
    // la navegación crea otra cosa.
    expect(document.body.dataset.rama).toBe('EDIFICIO')
  })

  it('y el conmutador lo dice también: «Edificio» pulsado y «Parcela» no', () => {
    // Anti-vacuidad del anterior: el atributo podría escribirlo cualquiera. Estos
    // dos botones son lo que el usuario mira para saber dónde está.
    const pulsado = (rama) =>
      document.querySelector(`[data-ir-a-rama="${rama}"]`)?.getAttribute('aria-pressed')
    expect(pulsado('EDIFICIO')).toBe('true')
    expect(pulsado('PARCELA')).toBe('false')
  })

  it('el bloque del Catastro —que es de PARCELA— no se queda a la vista', () => {
    // La avería no era solo cosmética: con las dos mitades en desacuerdo, el rail
    // evaluaba los hechos de una rama sobre el panel de la otra.
    const bloque = document.querySelector('.gml-bloque--catastro')
    if (bloque !== null) expect(bloque.closest('[hidden]')).not.toBeNull()
  })

  it('⭐ y el viaje de vuelta funciona: un `hashchange` a PARCELA reconmuta', () => {
    // El botón ATRÁS del navegador, que es como se llegaba al atasco: la ruta
    // cambia sin que nadie pulse el conmutador.
    window.history.replaceState({}, '', '/#/parcela/entrada')
    window.dispatchEvent(new window.HashChangeEvent('hashchange'))

    expect(document.body.dataset.rama).toBe('PARCELA')

    // Y no se queda enganchado: vuelve a EDIFICIO cuando la ruta lo pide.
    window.history.replaceState({}, '', '/#/edificio/entrada')
    window.dispatchEvent(new window.HashChangeEvent('hashchange'))
    expect(document.body.dataset.rama).toBe('EDIFICIO')
  })

  it('la ida y vuelta no entra en bucle: la ruta escrita sigue siendo la pedida', () => {
    // Los dos cables se realimentan (rama → navegación → rama), y lo único que
    // corta el bucle es la comparación de `main.js`. Si fallara, esto se colgaría
    // o dejaría el hash oscilando.
    window.history.replaceState({}, '', '/#/parcela/entrada')
    window.dispatchEvent(new window.HashChangeEvent('hashchange'))

    expect(document.body.dataset.rama).toBe('PARCELA')
    expect(location.hash).toContain('parcela')
  })
})
