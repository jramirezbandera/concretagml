/* -------------------------------------------------------------------------- *
 * test/app/main-aterrizaje-catastro.dom.test.js — 2026-08-16                  *
 *                                                                            *
 * ⛔ LA VÍA QUE CARGABA LA PARCELA Y NO SE MOVÍA DE SITIO.                    *
 *                                                                            *
 * «Traer del Catastro» hacía su trabajo entero —consulta, `estado.set`, mapa  *
 * repintado— y dejaba al usuario **en Entrada**, mirando las tres vías con su *
 * parcela ya cargada por debajo. Es el mismo defecto que T9 del rework        *
 * corrigió para «Contrastar» y F18 para la medición propia; de los tres       *
 * caminos de entrada, éste era el único que seguía sin arreglar, y el que más *
 * se usa. Una vía que carga y no mueve la pantalla se lee como una vía que no *
 * ha hecho nada.                                                              *
 *                                                                            *
 * Lo que se ata aquí, sobre la aplicación VIVA:                               *
 *                                                                            *
 *   · **A** — traer una parcela por referencia catastral deja la pantalla en  *
 *     EDICIÓN, con la parcela dentro.                                          *
 *   · **B** — y en Edición y no en Diagnóstico, que es el destino que usan las *
 *     otras dos vías (`aterrizarTrasContrastar`). Aquí el encaje valdría CERO  *
 *     por construcción —lo traído es a la vez `recintos` y `geometriaOficial`, *
 *     o sea la parcela contrastada consigo misma—, y enseñar ese cero como si  *
 *     fuera un resultado es lo que F22 ya declinó para el DXF de «Consulta     *
 *     Masiva». Sin este caso, cambiar el destino a `aterrizarTrasContrastar`   *
 *     pasaría el caso A y nadie se enteraría.                                  *
 *   · **C** — anti-vacuidad: la app arranca en ENTRADA. Sin esto los dos de    *
 *     arriba podrían estar midiendo una pantalla que ya estaba puesta.         *
 *                                                                            *
 * ── EL ARNÉS: LA APP DE VERDAD, Y SÓLO DOS DOBLES ──                          *
 * Calcado de `main-refcat-deducida.dom.test.js`, y por su mismo motivo:        *
 *   · `crearVisor`, porque un `L.Map` completo no pinta nada en esta historia; *
 *   · el TRANSPORTE, no el cliente: `crearClienteCatastro` y `cablearCatastro` *
 *     son los REALES y sirven el `GetParcel` capturado de la Sede. Así lo que  *
 *     entra en el store sale del código de producción y no de una imitación.   *
 *                                                                            *
 * ── MUTACIONES EJECUTADAS (para comprobar que no son guardianes vacuos) ──    *
 * Cada una aplicada a `app/main.js`, corrida `npm run test:dom -- aterrizaje`  *
 * y revertida con el editor.                                                   *
 *   M1 · quitar `navegacion.navegarAPaso(PASO.EDICION)` del `alCargarParcela`  *
 *        del paso 7 (o sea: el estado en el que estaba) → 2 rojos, A y B.      *
 *   M2 · dejar el `navegarAPaso` pero quitar el `refrescarHechos()` de delante *
 *        → 2 rojos: el guardián del peldaño decide con los hechos de ANTES del *
 *        `set` y devuelve al usuario a Entrada por «no hay geometría».          *
 *   M3 · cambiar el destino por `aterrizarTrasContrastar()` → 1 rojo, el B: la *
 *        pantalla acaba en Diagnóstico enseñando un encaje tautológico.         *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { SELECTOR_BOTON_CARGAR, SELECTOR_CAMPO_REFCAT } from '../../app/cableado-catastro.js'
import { SRS_DEMO } from '../../app/demo-datos.js'
import { husoPorSrs } from '../../geo/huso.js'
import { crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { crearCajonComprobacion } from '../../viewer/cajon-comprobacion.js'
import { crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import { crearCajonParcelas } from '../../viewer/cajon-parcelas.js'
import { crearCapaCandidatas } from '../../viewer/candidatas.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearListaSobrante } from '../../viewer/lista-sobrante.js'
import { VARIANTE, crearCapaPiezas } from '../../viewer/piezas.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

const RAIZ = join(import.meta.dirname, '..', '..')

/** El `GetParcel` real de la Sede: UN miembro, la parcela `9398516VK3799G`. */
const TEXTO_PARCELA = readFileSync(
  join(RAIZ, 'test', 'fixtures', 'gml', 'cp_parcela_9398516VK3799G.gml'),
  'utf8',
)

/**
 * La referencia que se teclea. Se DERIVA del fixture y no se copia a mano, que es
 * la regla de la casa: si mañana se recaptura, esta prueba le sigue sola.
 */
const REFCAT = /nationalCadastralReference>([^<]+)</.exec(TEXTO_PARCELA)[1].trim()

// ── El transporte doble ─────────────────────────────────────────────────────
//
// Cumple el puerto que `crearClienteCatastro` exige (`pedirTexto`, `estado`,
// `destruir`) y **no conoce `fetch`**: es imposible que esta suite toque la red.
// Resuelve SOLO, y a propósito: aquí no hay ninguna carrera que montar —la hay en
// `main-refcat-deducida.dom.test.js`, con su transporte manual— y lo que se mide es
// dónde acaba la pantalla cuando todo va bien.

const red = vi.hoisted(() => ({ urls: [] }))

vi.mock('../../services/_red.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    crearTransporte: () => ({
      async pedirTexto(url) {
        red.urls.push(url)
        return {
          ok: true,
          estado: 200,
          texto: TEXTO_PARCELA,
          tipoContenido: 'application/xml',
          motivo: null,
          mensaje: null,
          intentos: 1,
          ms: 1,
          url,
        }
      },
      estado: () => ({ peticiones: red.urls.length }),
      destruir() {},
    }),
  }
})

// ── El espía del montaje ─────────────────────────────────────────────────────

let vivos = null
function montarCromoDelMapa() {
  const { mapa } = montarMapa()
  crearPanes(mapa)
  crearBarraEdicion({ mapa })
  const zona = husoPorSrs(SRS_DEMO)
  vivos = {
    mapa,
    diagnostico: {
      cajon: crearCajonDiagnostico({ mapa }),
      contraste: crearContraste({ mapa, zona }),
    },
    comprobacion: crearCajonComprobacion({ mapa }),
    parcelas: { cajon: crearCajonParcelas({ mapa }), capa: crearCapaCandidatas({ mapa, zona }) },
    sobrante: {
      lista: crearListaSobrante({ documento: document }),
      capa: crearCapaPiezas({ mapa, zona }),
      capaFuera: crearCapaPiezas({ mapa, zona, variante: VARIANTE.FUERA }),
    },
  }
}

vi.mock('../../viewer/index.js', async (importarOriginal) => ({
  ...(await importarOriginal()),
  crearVisor: (_contenedor, opciones) => {
    montarCromoDelMapa()
    return {
      mapa: vivos.mapa,
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
      },
      colindantes: { pintar() {}, limpiar() {}, destruir() {} },
      diagnostico: vivos.diagnostico,
      comprobacion: vivos.comprobacion,
      parcelas: vivos.parcelas,
      sobrante: vivos.sobrante,
      destruir() {},
    }
  },
}))

// ── La cáscara, que TIENE que existir antes de importar `app/main.js` ────────

const HTML = readFileSync(join(RAIZ, 'index.html'), 'utf8')
const CASCARA = (() => {
  const encontrado = /<body([^>]*)>([\s\S]*?)<\/body>/i.exec(HTML)
  const clase = /class="([^"]*)"/i.exec(encontrado[1])
  const atributos = [...encontrado[1].matchAll(/([a-z-]+)="([^"]*)"/gi)]
    .filter(([, nombre]) => nombre !== 'class')
    .map(([, nombre, valor]) => [nombre, valor])
  return { clase: clase === null ? '' : clase[1], atributos, cuerpo: encontrado[2] }
})()

document.body.className = CASCARA.clase
for (const [nombre, valor] of CASCARA.atributos) document.body.setAttribute(nombre, valor)
document.body.innerHTML = CASCARA.cuerpo

// ⛔ **SIN `?demo=`, y hace falta**: `?demo=real` precarga la parcela
// `9398516VK3799G` —la misma del fixture— y este fichero se quedaría midiendo un
// aterrizaje sobre una parcela que ya estaba puesta. Se limpia la query en vez de
// darla por vacía porque el proyecto Vitest comparte entorno entre ficheros (mismo
// recurso, y mismo motivo, que `main-arranque-vacio.dom.test.js`).
window.history.replaceState({}, '', '/')
await import('../../app/main.js')

/** Cede el turno al bucle de microtareas unas cuantas veces. */
async function cederTurno(veces = 80) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

/** El paso que la aplicación dice estar enseñando, leído de la URL. */
const pasoEnPantalla = () => window.location.hash

/** El renglón de la ficha que dice la referencia catastral. */
const fichaRefcat = () => document.querySelector('[data-ficha="refcat"]').textContent.trim()

// ═══════════════════════════════════════════════════════════════════════════

describe('main · «Traer del Catastro» aterriza en EDICIÓN', () => {
  it('C · anti-vacuidad: la aplicación arranca en Entrada, no en Edición', () => {
    // Sin esto, los dos casos de abajo podrían estar midiendo una pantalla que
    // ya estaba puesta antes de pulsar nada.
    expect(pasoEnPantalla()).not.toContain('edicion')
    expect(fichaRefcat()).not.toContain(REFCAT)
  })

  it('A · se teclea la referencia, se pulsa, y la pantalla acaba en Edición', async () => {
    document.querySelector(SELECTOR_CAMPO_REFCAT).value = REFCAT
    document.querySelector(SELECTOR_BOTON_CARGAR).click()
    await cederTurno()

    // La consulta ha salido de verdad y ha traído la parcela: sin esto, un
    // aterrizaje sobre una carga fallida pasaría igual.
    expect(red.urls.some((u) => u.includes('GetParcel'))).toBe(true)
    expect(fichaRefcat()).toContain(REFCAT)

    expect(pasoEnPantalla()).toBe('#/parcela/edicion')
  })

  it('B · y NO en Diagnóstico: ahí el encaje valdría cero por construcción', () => {
    // Lo traído es a la vez `recintos` y `geometriaOficial`, o sea la parcela
    // contrastada consigo misma. Es el mismo argumento con el que F22 dejó fuera de
    // Diagnóstico el DXF de «Consulta Masiva»: que nadie lea ese cero como una
    // verificación. Se afirma aparte del caso A porque un `aterrizarTrasContrastar`
    // aquí lo dejaría verde y este rojo.
    expect(pasoEnPantalla()).not.toContain('diagnostico')
  })
})
