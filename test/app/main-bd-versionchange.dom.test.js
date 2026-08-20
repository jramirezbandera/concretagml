/* -------------------------------------------------------------------------- *
 * test/app/main-bd-versionchange.dom.test.js — S1b · el gancho `alVersionChange`*
 *                                              está CABLEADO      (2026-08-15)  *
 *                                                                              *
 * EL DEFECTO QUE VIGILA: F10 preparó en `storage/bd.js` el mecanismo de         *
 * desbloqueo multipestaña —`alVersionChange` recibe las versiones y un          *
 * `cerrar()`— y NADIE lo cableaba (`grep alVersionChange app/` → 0 resultados). *
 * Consecuencia: cuando ESTA pestaña era la vieja, la pestaña nueva recibía      *
 * `blocked`, degradaba a trabajar sin caché… y se quedaba sin almacén hasta     *
 * cerrar esta a mano, porque nadie soltaba la conexión. La mitad `storage` del  *
 * hallazgo (degradar en vez de colgar) se prueba en `test/storage/`; esta es la *
 * otra mitad: que `app/main.js` cierra la conexión al recibir `versionchange` y *
 * se lo cuenta al usuario.                                                      *
 *                                                                              *
 * ── POR QUÉ UN FICHERO PROPIO ──                                               *
 * Un módulo ES-M se evalúa UNA vez por fichero de test, y los otros ficheros    *
 * que arrancan `app/main.js` lo hacen SIN IndexedDB (jsdom no lo trae), así que *
 * en ellos `abrirBd` degrada y el gancho no existe. Aquí `fake-indexeddb/auto`  *
 * se importa ANTES que `app/main.js`, de modo que el arranque abre una base DE  *
 * VERDAD y el ciclo multipestaña es real: la «otra pestaña» es un `open` con    *
 * versión mayor sobre la MISMA fábrica global.                                  *
 *                                                                              *
 * ── POR QUÉ LA PRUEBA NO PUEDE MENTIR EN VERDE ──                              *
 * Sin el cableado, el `open` de la «pestaña nueva» queda BLOQUEADO para siempre *
 * (nadie cierra) y `esperarA` agota sus turnos: rojo. Y la frase que se busca   *
 * en el panel es la del CABLEADO («ha cerrado su conexión»), no la genérica de  *
 * `storage/bd.js` («Recarga esta página…»), que sale igual con y sin gancho.    *
 *                                                                              *
 * El arnés (cáscara real + visor doblado + transporte que no toca la red) es el *
 * de `main-arranque-vacio.dom.test.js`, y por lo mismo: tres cableados de       *
 * `app/main.js` van fuera de todo `try` y hacen duck typing de decenas de       *
 * métodos, así que el cromo del mapa se monta DE VERDAD o el arranque lanza.    *
 * -------------------------------------------------------------------------- */

// ANTES que `app/main.js`: es lo que hace que el arranque abra una base real.
import 'fake-indexeddb/auto'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, vi } from 'vitest'

import { SRS_DEMO } from '../../app/demo-datos.js'
import { husoPorSrs } from '../../geo/huso.js'
import { NOMBRE_BD, VERSION_BD } from '../../storage/bd.js'
import { crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { crearCajonComprobacion } from '../../viewer/cajon-comprobacion.js'
import { crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearListaSobrante } from '../../viewer/lista-sobrante.js'
import { VARIANTE, crearCapaPiezas } from '../../viewer/piezas.js'
import { crearSenalMiembro } from '../../viewer/senal-miembro.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

const RAIZ = join(import.meta.dirname, '..', '..')

// ── Los dobles (arnés de `main-arranque-vacio.dom.test.js`, ver su cabecera) ─

const arranque = vi.hoisted(() => ({ opciones: null, peticiones: [] }))

let mapaVivo = null
let barraViva = null
let diagnosticoVivo = null
let comprobacionViva = null
let sobranteVivo = null

/** El cromo que `crearVisor` monta SOBRE el mapa se monta DE VERDAD (ver cabecera). */
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
    capaFuera: crearCapaPiezas({
      mapa,
      zona: husoPorSrs(SRS_DEMO),
      variante: VARIANTE.FUERA,
    }),
    capaVecinos: crearCapaPiezas({
      mapa,
      zona: husoPorSrs(SRS_DEMO),
      variante: VARIANTE.VECINO,
    }),
    senal: crearSenalMiembro({ mapa, zona: husoPorSrs(SRS_DEMO) }),
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
      'test/app/main-bd-versionchange.dom.test.js: no se ha encontrado el <body> de index.html.',
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

// Arranque de PRODUCCIÓN (sin `?demo=`): aquí importa la base, no la parcela.
window.history.replaceState({}, '', '/')

// El arranque REAL, una sola vez. Si lanzara, el fichero entero falla aquí.
await import('../../app/main.js')

/**
 * Cede turnos al bucle de eventos hasta que la condición (que puede ser
 * asíncrona) se cumple. Mismo criterio que `test/storage/bd.test.js#esperarA`:
 * un tope alto para que un fallo real se vea como fallo con nombre, no como
 * cuelgue, y cero esperas de duración fija.
 *
 * @param {() => boolean|Promise<boolean>} condicion
 * @param {string} queEsperaba
 * @param {number} [maxTurnos=400]
 */
async function esperarA(condicion, queEsperaba, maxTurnos = 400) {
  for (let turno = 0; turno < maxTurnos; turno++) {
    if (await condicion()) return
    await new Promise((resolver) => setTimeout(resolver, 0))
  }
  throw new Error(
    `esperarA: tras ${maxTurnos} turnos del bucle de eventos, sigue sin cumplirse: ${queEsperaba}.`,
  )
}

describe('app/main · S1b: `alVersionChange` está cableado al arranque', () => {
  it('⭐ cuando otra pestaña pide subir la versión, ESTA cierra su conexión y lo cuenta', async () => {
    // (1) El arranque ha abierto la base de verdad, con la escalera aplicada.
    await esperarA(async () => {
      const bases = await indexedDB.databases()
      return bases.some((b) => b.name === NOMBRE_BD && b.version === VERSION_BD)
    }, 'que el arranque de app/main.js abra la base local')

    // (2) La «pestaña nueva»: pide una versión MAYOR sobre la misma fábrica.
    // Sin el cableado, este open recibe `blocked` y espera PARA SIEMPRE — la
    // conexión del arranque no la suelta nadie — y `esperarA` agota sus turnos.
    const otraPestana = indexedDB.open(NOMBRE_BD, VERSION_BD + 1)
    await esperarA(
      () => otraPestana.readyState === 'done',
      'que la pestaña del arranque cierre su conexión y deje pasar la apertura nueva',
    )
    expect(otraPestana.result, 'la apertura nueva no ha llegado a base').toBeTruthy()
    expect(otraPestana.result.version).toBe(VERSION_BD + 1)
    otraPestana.result.close()

    // (3) Y el usuario se ha enterado POR EL PANEL, con la frase del CABLEADO
    // (la genérica de `storage/bd.js` —«Recarga esta página…»— saldría igual sin
    // gancho, así que no serviría de prueba). Las tarjetas viven en `#avisos`
    // también con el diálogo cerrado (contrato de `app/dialogo-avisos.js`).
    const avisos = document.getElementById('avisos').textContent
    expect(avisos).toMatch(/ha cerrado su conexión/i)
    expect(avisos).toMatch(/recarg/i)
  })
})
