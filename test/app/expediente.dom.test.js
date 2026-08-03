/* -------------------------------------------------------------------------- *
 * test/app/expediente.dom.test.js — F10 · T5.1 · la fase entera, cosida        *
 *                                                                              *
 * `storage/expedientes.js` sabe guardar, `storage/autoguardado.js` sabe esperar,*
 * `storage/cuota.js` sabe preguntar, `export/*` sabe escribir tres ficheros y   *
 * `app/dialogo-expediente.js` sabe enseñarlo. Mientras nadie los enchufe, F10   *
 * entera es código muerto. Aquí se prueba el CABLE, no las piezas.              *
 *                                                                              *
 * ── QUÉ SE PRUEBA AQUÍ, Y QUÉ NO ──                                            *
 * NO se vuelven a probar el almacén (`test/storage/expedientes.test.js`), el    *
 * debounce (`test/storage/autoguardado.test.js`), la cuota, los tres            *
 * serializadores (`test/export/`) ni el diálogo                                 *
 * (`test/app/dialogo-expediente.dom.test.js`). Se prueban las siete cosas de las*
 * que ESTE cableado es dueño:                                                   *
 *                                                                              *
 *   1. que el Expediente por fin existe, y que sus metadatos no se reestampan;  *
 *   2. ⭐ por qué `metadatos.idDocumento` se queda VACÍO — el hecho medido sobre  *
 *      `duplicar`, que es lo único que sostiene esa decisión;                   *
 *   3. que guardar dos veces pone al día UN registro, y que traer otra parcela   *
 *      NO lo pisa con una geometría ajena;                                      *
 *   4. ⭐ la ESPERA del autoguardado: que el trabajo de la sesión anterior no se  *
 *      borra con la primera tecla, y que el cambio de la espera no se pierde;   *
 *   5. que las tres exportaciones bajan con el nombre derivado y el proyecto se  *
 *      relee (ida y vuelta);                                                     *
 *   6. la degradación del criterio 4 (cuota → purga → reintento → decirlo);      *
 *   7. que el arranque OFRECE en vez de imponer.                                *
 *                                                                              *
 * ── DECISIÓN 1 · TODO REAL SALVO EL RELOJ, LOS TEMPORIZADORES Y `URL` ──        *
 * El almacén es el de verdad sobre `fake-indexeddb`, el store es el de verdad,   *
 * el panel es el de verdad y el diálogo es el de verdad, montado sobre el        *
 * `<body>` REAL de `index.html`. Se doblan tres cosas y solo tres: el reloj      *
 * (para poder afirmar marcas de tiempo), los temporizadores del debounce (para   *
 * no esperar dos segundos por prueba) y `URL.createObjectURL`, que jsdom no      *
 * implementa. Los tres son parámetros que los módulos ya ofrecían.               *
 *                                                                              *
 * ── DECISIÓN 2 · LA CÁSCARA SE LEE DE `index.html`, NO SE COPIA ──             *
 * Igual que en `catastro.dom.test.js`, `diagnostico.dom.test.js` y              *
 * `comprobacion.dom.test.js`: el botón «Expediente» es CONTRATO, y una copia a  *
 * mano seguiría en verde con la cáscara ya rota.                                *
 *                                                                              *
 * ── ⚠️ TRAMPA DE ENTORNO, MEDIDA ──                                            *
 * `a.click()` sobre un anchor con `download` hace que jsdom intente navegar y    *
 * escupa «Not implemented: navigation to another Document». Se espía el `click`  *
 * del prototipo en vez de dejarlo pasar: así la prueba mide que la entrega llegó *
 * hasta el gesto sin llenar la salida de la suite de ruido ajeno.                *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { crearPanelAvisos } from '../../app/avisos.js'
import {
  COLETILLA_SIN_PERSISTENCIA,
  EXTENSIONES_PROYECTO,
  FICHERO,
  MENSAJE_AUTOGUARDADO_EN_ESPERA,
  MENSAJE_SIN_PARCELA,
  MENSAJE_SIN_PURGA,
  MENSAJE_SIN_SELECTOR,
  MS_CONFIRMAR_BORRADO,
  SELECTOR_BOTON_EXPEDIENTE,
  cablearExpediente,
  nombreFicheroExport,
} from '../../app/cableado-expediente.js'
import { parcelaDemo, parcelaDemoConHueco, REFCAT_DEMO } from '../../app/demo-datos.js'
import { SELECTOR, motivoOtroHuso, selectorFila } from '../../app/dialogo-expediente.js'
import { ACADVER } from '../../export/dxf.js'
import { deProyecto } from '../../export/proyecto.js'
import { nombreFicheroGml } from '../../gml/descargar.js'
import { crearExpediente } from '../../model/parcela.js'
import { ALMACENES } from '../../storage/bd.js'
import { crearExpedientes } from '../../storage/expedientes.js'
import { crearEstadoVista } from '../../viewer/_comun.js'

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')

const CUERPO_INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/expediente.dom.test.js: no se ha encontrado el <body> de index.html. La cáscara ' +
        'de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  return encontrado[1]
})()

const SRS = 'EPSG:25830'
const OTRO_SRS = 'EPSG:25829'

// ── Utillaje ─────────────────────────────────────────────────────────────────

/** Cede el bucle de sucesos las veces que hagan falta para que IndexedDB termine. */
async function reposar(vueltas = 8) {
  for (let i = 0; i < vueltas; i += 1) await new Promise((r) => setTimeout(r, 0))
}

/** Una base recién creada, en su propio universo. Mismo arnés que `test/storage/`. */
async function baseNueva() {
  vi.resetModules()
  const { abrirBd } = await import('../../storage/bd.js')
  const apertura = await abrirBd({ indexedDB: new IDBFactory() })
  expect(apertura.disponible, 'el arnés no ha conseguido abrir la base').toBe(true)
  return apertura
}

/**
 * Temporizadores a mano. **No se usa `vi.useFakeTimers`** y es la misma razón que
 * escribió `test/storage/autoguardado.test.js`: falsear el tiempo global rompe
 * `fake-indexeddb`, que programa sus propias tareas.
 */
function temporizadores() {
  const pendientes = new Map()
  let n = 0
  return {
    programar(fn) {
      n += 1
      pendientes.set(n, fn)
      return n
    },
    cancelar(id) {
      pendientes.delete(id)
    },
    /** Dispara todo lo programado, en orden. */
    disparar() {
      const fns = [...pendientes.values()]
      pendientes.clear()
      for (const fn of fns) fn()
    },
    get cuantos() {
      return pendientes.size
    },
  }
}

/** Espía de `URL`: guarda los blobs para poder leerlos. */
function espiaUrl() {
  const blobs = []
  const revocadas = []
  return {
    blobs,
    revocadas,
    createObjectURL(blob) {
      blobs.push(blob)
      return `blob:prueba/${blobs.length - 1}`
    },
    revokeObjectURL(href) {
      revocadas.push(href)
    },
  }
}

/** Una caché de mentira que solo sabe purgar. Es lo único que el cableado le pide. */
function cacheQuePurga(purgados = 3) {
  const llamadas = []
  return {
    llamadas,
    async purgarCaducados(opciones) {
      llamadas.push(opciones ?? {})
      return {
        ok: true,
        purgados,
        revisados: purgados + 1,
        sinFecha: 0,
        bytesAprox: purgados * 1000,
        porAlmacen: { parcelas: purgados },
        motivo: null,
        mensaje: `Se han liberado ${purgados} consulta(s) guardada(s) del Catastro.`,
      }
    },
  }
}

/**
 * Envuelve un almacén real haciendo que las `n` primeras escrituras fallen por
 * CUOTA. Es cómo se provoca el criterio 4: llenar 1,82 GB de verdad son ~1,3
 * millones de escrituras (medido en la fase 0), así que se dobla el fallo y se
 * declara — el plan de F10 lo dice con estas palabras.
 */
function almacenSinEspacio(real, n = 1) {
  let quedan = n
  return {
    ...real,
    async guardar(...args) {
      if (quedan > 0) {
        quedan -= 1
        return {
          ok: false,
          registro: null,
          motivo: 'ERROR_ESCRITURA',
          mensaje: 'No se ha podido guardar el expediente (QuotaExceededError: lleno).',
          esCuota: true,
        }
      }
      return real.guardar(...args)
    },
  }
}

/** El montaje completo. Devuelve todo lo que las pruebas necesitan tocar. */
async function montar({
  parcela = parcelaDemo(),
  srs = SRS,
  cache = cacheQuePurga(),
  persistido = false,
  elegirFichero = null,
  almacen = null,
  bd = null,
} = {}) {
  const apertura = bd ?? (await baseNueva())
  let reloj = Date.UTC(2026, 7, 3, 10, 0, 0)

  const panel = crearPanelAvisos({
    contenedor: document.querySelector('#avisos'),
    chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
    chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
  })
  const estado = crearEstadoVista(parcela)
  const expedientes =
    almacen ??
    crearExpedientes({ bd: apertura, ahora: () => reloj, alAvisar: panel.avisar })
  const persistencias = []
  const cuota = {
    async pedirPersistencia() {
      persistencias.push(true)
      return { ok: true, persistido, yaEstaba: persistido, motivo: null, mensaje: null, causa: null }
    },
  }
  const timers = temporizadores()
  const url = espiaUrl()
  const cargadas = []

  const cableado = cablearExpediente({
    estado,
    panel,
    srs,
    expedientes,
    cuota,
    cache,
    elegirFichero,
    alCargarParcela: (p) => cargadas.push(p),
    ahora: () => new Date(reloj),
    programar: timers.programar,
    cancelar: timers.cancelar,
    url,
  })

  await reposar()

  return {
    apertura,
    cableado,
    cargadas,
    estado,
    expedientes,
    panel,
    persistencias,
    timers,
    url,
    avisos: () => [...document.querySelectorAll('#avisos .gml-aviso-texto')].map((t) => t.textContent),
    renglon: () => document.querySelector(SELECTOR.ESTADO).textContent,
    avanzar(ms) {
      reloj += ms
    },
    get reloj() {
      return reloj
    },
  }
}

/** Pulsa un botón del diálogo por selector. Falla nombrándolo si no está. */
function pulsar(selector) {
  const boton = document.querySelector(selector)
  expect(boton, `no hay ningún botón '${selector}' en el diálogo`).not.toBeNull()
  expect(boton.disabled, `el botón '${selector}' está apagado`).toBe(false)
  boton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
}

/** Abre el diálogo y espera a que llegue la lista. */
async function abrir(m) {
  m.cableado.abrir()
  await reposar()
}

/** Escribe en el campo «Nombre del expediente». */
function escribirNombre(texto) {
  document.querySelector(SELECTOR.NOMBRE).value = texto
}

/** Un `File` de mentira con `text()`, que es lo único que `abrirProyecto` le pide. */
function ficheroDeTexto(nombre, contenido) {
  return { name: nombre, async text() { return contenido } }
}

let clickEspiado

beforeEach(() => {
  document.body.innerHTML = CUERPO_INDEX
  // Ver la trampa de entorno de la cabecera.
  clickEspiado = vi
    .spyOn(window.HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
})

afterEach(() => {
  clickEspiado.mockRestore()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

// ══════════════════════════════════════════════════════════════════════════════
describe('F10 · T5.1 · 1 · el Expediente por fin existe', () => {
  it('el botón del contrato está en la cáscara REAL de index.html', () => {
    expect(document.querySelector(SELECTOR_BOTON_EXPEDIENTE)).not.toBeNull()
  })

  it('`expedienteActual()` devuelve un Expediente del modelo con el srs inyectado', async () => {
    const m = await montar()
    const exp = m.cableado.expedienteActual()
    expect(exp.tipo).toBe('PARCELA')
    expect(exp.srs).toBe(SRS)
    expect(exp.parcela.refcat).toBe(REFCAT_DEMO)
    expect(exp.parcela.recintos[0].vertices).toHaveLength(15)
    m.cableado.destruir()
  })

  it('⭐ la geometría oficial vuelve CONGELADA (regla de oro 2)', async () => {
    const m = await montar()
    const exp = m.cableado.expedienteActual()
    expect(Object.isFrozen(exp.parcela.geometriaOficial)).toBe(true)
    expect(Object.isFrozen(exp.parcela.geometriaOficial[0])).toBe(true)
    m.cableado.destruir()
  })

  it('⭐ `metadatos.creado` NO se reestampa en cada derivación', async () => {
    const m = await montar()
    const primero = m.cableado.expedienteActual()
    m.avanzar(60_000)
    const segundo = m.cableado.expedienteActual()
    expect(segundo.metadatos.creado).toBe(primero.metadatos.creado)
    m.cableado.destruir()
  })

  it('`metadatos.idDocumento` y `autor` salen VACÍOS, y es deliberado', async () => {
    const m = await montar()
    const exp = m.cableado.expedienteActual()
    expect(exp.metadatos.idDocumento).toBe('')
    expect(exp.metadatos.autor).toBe('')
    m.cableado.destruir()
  })

  it('sin geometría en el store devuelve null en vez de un expediente vacío', async () => {
    const m = await montar({ parcela: null })
    expect(m.cableado.expedienteActual()).toBeNull()
    m.cableado.destruir()
  })

  it('un `srs` que el modelo no admite revienta AL CABLEAR, no en el primer guardado', async () => {
    const apertura = await baseNueva()
    const panel = crearPanelAvisos({
      contenedor: document.querySelector('#avisos'),
      chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
      chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
    })
    expect(() =>
      cablearExpediente({
        estado: crearEstadoVista(parcelaDemo()),
        panel,
        srs: 'EPSG:4326',
        expedientes: crearExpedientes({ bd: apertura }),
        cuota: { pedirPersistencia: async () => ({ ok: true, persistido: true }) },
      }),
    ).toThrow(/srs/i)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('F10 · T5.1 · 2 · ⭐ por qué `idDocumento` se queda vacío', () => {
  it('`duplicar` copia `expediente.metadatos` TAL CUAL y solo cambia la clave', async () => {
    // Es el hecho MEDIDO que sostiene la decisión escrita en la cabecera del
    // cableado: si la identidad del expediente viviera DENTRO de `metadatos`, una
    // copia la arrastraría apuntando al registro original, y nada fallaría.
    const m = await montar()
    await abrir(m)
    escribirNombre('Linde norte')
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    const primero = (await m.expedientes.listar()).registros[0]
    const copia = await m.expedientes.duplicar(primero.id)
    expect(copia.ok).toBe(true)

    const crudoOriginal = await m.apertura.bd.get(ALMACENES.EXPEDIENTES, primero.id)
    const crudoCopia = await m.apertura.bd.get(ALMACENES.EXPEDIENTES, copia.registro.id)

    // Anti-vacuidad: la clave SÍ cambia, o el resto de la prueba no diría nada.
    expect(crudoCopia.id).not.toBe(crudoOriginal.id)
    expect(crudoCopia.expediente.metadatos).toEqual(crudoOriginal.expediente.metadatos)
    m.cableado.destruir()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('F10 · T5.1 · 3 · guardar', () => {
  it('«Guardar» crea el registro con el nombre del campo', async () => {
    const m = await montar()
    await abrir(m)
    escribirNombre('Linde norte')
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    const { registros } = await m.expedientes.listar()
    expect(registros).toHaveLength(1)
    expect(registros[0].nombre).toBe('Linde norte')
    expect(registros[0].refcat).toBe(REFCAT_DEMO)
    expect(registros[0].srs).toBe(SRS)
    expect(m.renglon()).toContain('Linde norte')
    m.cableado.destruir()
  })

  it('guardar DOS veces pone al día UN registro, no crea un segundo', async () => {
    const m = await montar()
    await abrir(m)
    escribirNombre('Linde norte')
    pulsar(SELECTOR.GUARDAR)
    await reposar()
    m.avanzar(120_000)
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    const { registros } = await m.expedientes.listar()
    expect(registros).toHaveLength(1)
    expect(registros[0].actualizado).not.toBe(registros[0].creado)
    m.cableado.destruir()
  })

  it('⭐ traer OTRA parcela suelta la identidad: el siguiente guardado NO pisa el anterior', async () => {
    const m = await montar()
    await abrir(m)
    escribirNombre('La primera')
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    // Otro documento: `idLocal` distinto, que es el único discriminador que sirve.
    m.estado.set(parcelaDemoConHueco())
    await reposar()

    escribirNombre('La segunda')
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    const { registros } = await m.expedientes.listar()
    expect(registros).toHaveLength(2)
    expect(registros.map((r) => r.nombre).sort()).toEqual(['La primera', 'La segunda'])
    m.cableado.destruir()
  })

  it('editar la MISMA parcela no suelta la identidad', async () => {
    const m = await montar()
    await abrir(m)
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    const parcela = m.estado.get()
    m.estado.set({
      ...parcela,
      recintos: [
        { ...parcela.recintos[0], vertices: parcela.recintos[0].vertices.map(([x, y]) => [x + 1, y]) },
      ],
    })
    await reposar()
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    expect((await m.expedientes.listar()).registros).toHaveLength(1)
    m.cableado.destruir()
  })

  it('el acuse lleva la coletilla cuando `persist()` dijo que no', async () => {
    const m = await montar({ persistido: false })
    await abrir(m)
    pulsar(SELECTOR.GUARDAR)
    await reposar()
    expect(m.renglon()).toContain(COLETILLA_SIN_PERSISTENCIA.trim())
    m.cableado.destruir()
  })

  it('…y NO la lleva cuando el navegador sí garantiza la conservación', async () => {
    const m = await montar({ persistido: true })
    await abrir(m)
    pulsar(SELECTOR.GUARDAR)
    await reposar()
    expect(m.renglon()).not.toContain(COLETILLA_SIN_PERSISTENCIA.trim())
    m.cableado.destruir()
  })

  it('sin parcela, «Guardar» nace apagado y el porqué está escrito', async () => {
    const m = await montar({ parcela: null })
    await abrir(m)
    expect(document.querySelector(SELECTOR.GUARDAR).disabled).toBe(true)
    expect(m.renglon().length).toBeGreaterThan(0)
    m.cableado.destruir()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('F10 · T5.1 · 4 · recuperar, duplicar y borrar', () => {
  /** Guarda uno y devuelve su registro. */
  async function conUnoGuardado(m, nombre = 'Guardado') {
    await abrir(m)
    escribirNombre(nombre)
    pulsar(SELECTOR.GUARDAR)
    await reposar()
    return (await m.expedientes.listar()).registros[0]
  }

  it('«Recuperar» mete la parcela en el store, avisa a la edición y cierra el diálogo', async () => {
    const m = await montar()
    const registro = await conUnoGuardado(m)

    // Se ensucia el store para que la recuperación sea distinguible.
    m.estado.set(parcelaDemoConHueco())
    await reposar()
    await abrir(m)

    pulsar(`${selectorFila(registro.id)} [data-accion="recuperar-expediente"]`)
    await reposar()

    expect(m.estado.get().refcat).toBe(REFCAT_DEMO)
    expect(m.cargadas.at(-1).refcat).toBe(REFCAT_DEMO)
    expect(document.querySelector('dialog.gml-dialogo-expediente').open).toBe(false)
    m.cableado.destruir()
  })

  it('una fila de OTRO huso nace con «Recuperar» apagado', async () => {
    const m = await montar()
    // Se guarda por la puerta de atrás: la pantalla trabaja en 25830 y este no.
    await m.expedientes.guardar(crearExpediente({ srs: OTRO_SRS, parcela: parcelaDemo() }), {
      nombre: 'De Galicia',
    })
    await abrir(m)

    const registro = (await m.expedientes.listar()).registros[0]
    const fila = selectorFila(registro.id)
    expect(document.querySelector(`${fila} [data-accion="recuperar-expediente"]`).disabled).toBe(true)
    // Duplicar y borrar SIGUEN encendidos: ésos no necesitan el visor.
    expect(document.querySelector(`${fila} [data-accion="duplicar-expediente"]`).disabled).toBe(false)
    m.cableado.destruir()
  })

  it('⭐ y el cableado no depende de ese `disabled`: la guarda del huso es suya', async () => {
    const m = await montar()
    await m.expedientes.guardar(crearExpediente({ srs: OTRO_SRS, parcela: parcelaDemo() }), {
      nombre: 'De Galicia',
    })
    await abrir(m)
    const registro = (await m.expedientes.listar()).registros[0]
    // Se dispara el botón apagado A PROPÓSITO: un `disabled` es cortesía, no garantía.
    document
      .querySelector(`${selectorFila(registro.id)} [data-accion="recuperar-expediente"]`)
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await reposar()

    expect(m.cargadas, 'se ha recuperado un expediente de otro huso').toEqual([])
    m.cableado.destruir()
  })

  it('un fichero de proyecto de otro huso se rechaza con el MISMO texto que el diálogo', async () => {
    const m = await montar()
    const ajeno = {
      formato: 'concreta-gml/proyecto',
      version: 1,
      generado: '2026-08-02T10:00:00.000Z',
      nombre: 'De Galicia',
      expediente: crearExpediente({ srs: OTRO_SRS, parcela: parcelaDemo() }),
    }
    await m.cableado.abrirProyecto(ficheroDeTexto('ajeno.json', JSON.stringify(ajeno)))
    await reposar()

    expect(m.avisos().join('\n')).toContain(motivoOtroHuso(OTRO_SRS))
    expect(m.cargadas).toEqual([])
    m.cableado.destruir()
  })

  it('«Duplicar» añade una copia con «(copia)» en el nombre', async () => {
    const m = await montar()
    const registro = await conUnoGuardado(m, 'Original')
    pulsar(`${selectorFila(registro.id)} [data-accion="duplicar-expediente"]`)
    await reposar()

    const { registros } = await m.expedientes.listar()
    expect(registros).toHaveLength(2)
    expect(registros.map((r) => r.nombre)).toContain('Original (copia)')
    m.cableado.destruir()
  })

  it('⭐ «Borrar» de un solo clic NO borra: arma y lo dice', async () => {
    const m = await montar()
    const registro = await conUnoGuardado(m)
    pulsar(`${selectorFila(registro.id)} [data-accion="borrar-expediente"]`)
    await reposar()

    expect((await m.expedientes.listar()).registros).toHaveLength(1)
    expect(m.renglon()).toContain('Vuelve a pulsar')
    m.cableado.destruir()
  })

  it('el SEGUNDO clic en la misma fila sí borra', async () => {
    const m = await montar()
    const registro = await conUnoGuardado(m)
    const selector = `${selectorFila(registro.id)} [data-accion="borrar-expediente"]`
    pulsar(selector)
    await reposar()
    pulsar(selector)
    await reposar()

    expect((await m.expedientes.listar()).registros).toHaveLength(0)
    m.cableado.destruir()
  })

  it('pasado el plazo, el segundo clic vuelve a armar en vez de borrar', async () => {
    const m = await montar()
    const registro = await conUnoGuardado(m)
    const selector = `${selectorFila(registro.id)} [data-accion="borrar-expediente"]`
    pulsar(selector)
    await reposar()
    m.avanzar(MS_CONFIRMAR_BORRADO + 1)
    pulsar(selector)
    await reposar()

    expect((await m.expedientes.listar()).registros).toHaveLength(1)
    expect(m.renglon()).toContain('Vuelve a pulsar')
    m.cableado.destruir()
  })

  it('irse a otra acción DESARMA el borrado', async () => {
    const m = await montar()
    const registro = await conUnoGuardado(m)
    const selector = `${selectorFila(registro.id)} [data-accion="borrar-expediente"]`
    pulsar(selector)
    await reposar()
    pulsar(`${selectorFila(registro.id)} [data-accion="duplicar-expediente"]`)
    await reposar()
    // La lista se ha repintado: el botón de la fila original es otro nodo.
    pulsar(`${selectorFila(registro.id)} [data-accion="borrar-expediente"]`)
    await reposar()

    const { registros } = await m.expedientes.listar()
    expect(registros.some((r) => r.id === registro.id)).toBe(true)
    m.cableado.destruir()
  })

  it('borrar el expediente ABIERTO suelta la identidad: el siguiente guardado crea otro', async () => {
    const m = await montar()
    const registro = await conUnoGuardado(m, 'Se va')
    const selector = `${selectorFila(registro.id)} [data-accion="borrar-expediente"]`
    pulsar(selector)
    await reposar()
    pulsar(selector)
    await reposar()
    expect(m.cableado.estado().idAbierto).toBeNull()

    pulsar(SELECTOR.GUARDAR)
    await reposar()
    const { registros } = await m.expedientes.listar()
    expect(registros).toHaveLength(1)
    expect(registros[0].id).not.toBe(registro.id)
    m.cableado.destruir()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('F10 · T5.1 · 5 · ⭐ el autoguardado y su espera', () => {
  /** Deja un borrador escrito en la base y devuelve la apertura para reutilizarla. */
  async function conBorrador() {
    const apertura = await baseNueva()
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 2, 9, 0, 0) })
    const r = await almacen.guardarBorrador(crearExpediente({ srs: SRS, parcela: parcelaDemo() }))
    expect(r.ok, 'el arnés no ha conseguido dejar un borrador').toBe(true)
    return apertura
  }

  it('sin borrador previo, un cambio programa y escribe el trabajo en curso', async () => {
    const m = await montar()
    m.estado.set(parcelaDemoConHueco())
    expect(m.timers.cuantos).toBe(1)
    m.timers.disparar()
    await reposar()

    const b = await m.expedientes.leerBorrador()
    expect(b.ok).toBe(true)
    expect(b.expediente.parcela.recintos).toHaveLength(2)
    m.cableado.destruir()
  })

  it('el borrador NO sale en la lista de expedientes guardados', async () => {
    const m = await montar()
    m.estado.set(parcelaDemoConHueco())
    m.timers.disparar()
    await reposar()

    const { registros, hayBorrador } = await m.expedientes.listar()
    expect(registros).toHaveLength(0)
    expect(hayBorrador).toBe(true)
    m.cableado.destruir()
  })

  it('⭐ con una oferta pendiente, el primer cambio NO escribe: la espera protege lo de ayer', async () => {
    const m = await montar({ bd: await conBorrador() })
    expect(m.cableado.estado().ofreciendoBorrador).toBe(true)

    m.estado.set(parcelaDemoConHueco())
    expect(m.timers.cuantos, 'se ha programado una escritura con la oferta en pie').toBe(0)
    await reposar()

    const b = await m.expedientes.leerBorrador()
    // Sigue siendo el de ayer: la parcela de un solo recinto, no la de dos.
    expect(b.expediente.parcela.recintos).toHaveLength(1)
    m.cableado.destruir()
  })

  it('…y lo DICE, una sola vez y no en cada tecla', async () => {
    const m = await montar({ bd: await conBorrador() })
    m.estado.set(parcelaDemoConHueco())
    m.estado.set(parcelaDemo())
    m.estado.set(parcelaDemoConHueco())
    await reposar()

    const cuantas = m.avisos().filter((t) => t === MENSAJE_AUTOGUARDADO_EN_ESPERA).length
    expect(cuantas).toBe(1)
    m.cableado.destruir()
  })

  it('⭐ al DESCARTAR, el cambio hecho durante la espera se vuelca en vez de perderse', async () => {
    const m = await montar({ bd: await conBorrador() })
    m.estado.set(parcelaDemoConHueco())
    await reposar()

    await abrir(m)
    pulsar(`${SELECTOR.BORRADOR} [data-accion="descartar-borrador"]`)
    await reposar()

    expect(m.timers.cuantos, 'la espera no ha volcado el cambio pendiente').toBe(1)
    m.timers.disparar()
    await reposar()

    const b = await m.expedientes.leerBorrador()
    expect(b.ok).toBe(true)
    expect(b.expediente.parcela.recintos).toHaveLength(2)
    m.cableado.destruir()
  })

  it('«Recuperar» el borrador carga la parcela y NO saca el aviso de espera', async () => {
    const m = await montar({ bd: await conBorrador() })
    m.estado.set(parcelaDemoConHueco())
    await abrir(m)
    // Se limpia lo dicho hasta aquí para medir solo lo de la recuperación.
    const antes = m.avisos().length

    pulsar(`${SELECTOR.BORRADOR} [data-accion="recuperar-borrador"]`)
    await reposar()

    expect(m.estado.get().recintos).toHaveLength(1)
    expect(m.cableado.estado().ofreciendoBorrador).toBe(false)
    expect(
      m.avisos().slice(antes).filter((t) => t === MENSAJE_AUTOGUARDADO_EN_ESPERA),
      'recuperar el borrador ha disparado el aviso de espera',
    ).toEqual([])
    m.cableado.destruir()
  })

  it('`destruir()` NO escribe lo pendiente: desmontar no es guardar a escondidas', async () => {
    const m = await montar()
    m.estado.set(parcelaDemoConHueco())
    m.cableado.destruir()
    expect(m.timers.cuantos).toBe(0)
    await reposar()
    expect((await m.expedientes.leerBorrador()).ok).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('F10 · T5.1 · 6 · las tres exportaciones', () => {
  it('el DXF baja con su nombre y con la cabecera del formato', async () => {
    const m = await montar()
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_DXF)
    await reposar()

    expect(m.url.blobs).toHaveLength(1)
    await expect(m.url.blobs[0].text()).resolves.toContain(ACADVER)
    expect(m.renglon()).toContain('.dxf')
    expect(clickEspiado).toHaveBeenCalled()
    m.cableado.destruir()
  })

  it('el listado de coordenadas baja con prefijo propio', async () => {
    const m = await montar()
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_COORDENADAS)
    await reposar()

    expect(m.renglon()).toContain(`${FICHERO.COORDENADAS.prefijo}_${REFCAT_DEMO}`)
    expect(m.renglon()).toContain('.txt')
    m.cableado.destruir()
  })

  it('⭐ el fichero de proyecto se relee: ida y vuelta completa', async () => {
    const m = await montar()
    await abrir(m)
    escribirNombre('Para el compañero')
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()

    const texto = await m.url.blobs[0].text()
    const leido = deProyecto(texto)
    expect(leido.ok).toBe(true)
    expect(leido.nombre).toBe('Para el compañero')
    expect(leido.expediente.srs).toBe(SRS)
    expect(leido.expediente.parcela.recintos[0].vertices).toEqual(
      m.estado.get().recintos[0].vertices,
    )
    m.cableado.destruir()
  })

  it('los tres nombres derivan de `nombreFicheroGml` y no colisionan entre sí ni con el GML', async () => {
    const fecha = new Date(Date.UTC(2026, 7, 3, 10, 0, 0))
    const nombres = Object.values(FICHERO).map((f) =>
      nombreFicheroExport({ prefijo: f.prefijo, extension: f.extension, refcat: REFCAT_DEMO, fecha }),
    )
    const delGml = nombreFicheroGml({ refcat: REFCAT_DEMO, fecha })
    expect(new Set([...nombres, delGml]).size).toBe(4)
    // La marca de tiempo es LA MISMA: es lo que empareja los ficheros en la carpeta.
    const marca = delGml.slice('parcela_'.length + REFCAT_DEMO.length + 1, -'.gml'.length)
    for (const n of nombres) expect(n).toContain(marca)
  })

  it('una parcela sin geometría oficial exporta UNA capa y lo DICE (regla de oro 1)', async () => {
    const m = await montar({ parcela: parcelaDemoConHueco() })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_DXF)
    await reposar()

    expect(m.url.blobs).toHaveLength(1)
    expect(m.avisos().join('\n')).toMatch(/oficial/i)
    m.cableado.destruir()
  })

  it('sin parcela no baja nada y se dice', async () => {
    const m = await montar({ parcela: null })
    await abrir(m)
    document.querySelector(SELECTOR.EXPORTAR_DXF).dispatchEvent(
      new window.MouseEvent('click', { bubbles: true }),
    )
    await reposar()

    expect(m.url.blobs).toHaveLength(0)
    expect(m.renglon()).toBe(MENSAJE_SIN_PARCELA)
    m.cableado.destruir()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('F10 · T5.1 · 7 · la entrada del `.json`', () => {
  it('la extensión que se le añade a la zona es exactamente `.json`', () => {
    expect([...EXTENSIONES_PROYECTO]).toEqual(['.json'])
  })

  it('un proyecto real entra en el store y se cuenta', async () => {
    const m = await montar()
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()
    const texto = await m.url.blobs[0].text()

    m.estado.set(parcelaDemoConHueco())
    await reposar()
    await m.cableado.abrirProyecto(ficheroDeTexto('proyecto.json', texto))
    await reposar()

    expect(m.estado.get().refcat).toBe(REFCAT_DEMO)
    expect(m.cargadas.at(-1).refcat).toBe(REFCAT_DEMO)
    expect(m.avisos().join('\n')).toMatch(/proyecto/i)
    m.cableado.destruir()
  })

  it('un GML metido en un `.json` NO revienta: se cuenta con su motivo', async () => {
    const m = await montar()
    await expect(
      m.cableado.abrirProyecto(ficheroDeTexto('raro.json', '<?xml version="1.0"?><algo/>')),
    ).resolves.toBeUndefined()
    expect(m.avisos().join('\n')).toMatch(/gml|xml/i)
    expect(m.estado.get().refcat).toBe(REFCAT_DEMO)
    m.cableado.destruir()
  })

  it('«Abrir un proyecto…» abre el selector de la ÚNICA zona de fichero', async () => {
    const llamadas = []
    const m = await montar({ elegirFichero: () => llamadas.push(true) })
    await abrir(m)
    pulsar(SELECTOR.ABRIR_PROYECTO)
    await reposar()
    expect(llamadas).toHaveLength(1)
    m.cableado.destruir()
  })

  it('…y sin ese canal lo DICE en vez de ser un botón que no hace nada', async () => {
    const m = await montar({ elegirFichero: null })
    await abrir(m)
    pulsar(SELECTOR.ABRIR_PROYECTO)
    await reposar()
    expect(m.renglon()).toBe(MENSAJE_SIN_SELECTOR)
    m.cableado.destruir()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('F10 · T5.1 · 8 · la degradación del criterio 4', () => {
  it('cuota agotada → purga la caché → reintenta → guarda', async () => {
    const apertura = await baseNueva()
    const real = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 3) })
    const cache = cacheQuePurga(4)
    const m = await montar({ bd: apertura, almacen: almacenSinEspacio(real, 1), cache })

    await abrir(m)
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    expect(cache.llamadas, 'no se ha purgado la caché al chocar con la cuota').toHaveLength(1)
    expect((await real.listar()).registros).toHaveLength(1)
    m.cableado.destruir()
  })

  it('una purga que no libera nada NO se disfraza: se dice y no se reintenta', async () => {
    const apertura = await baseNueva()
    const real = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 3) })
    const cacheVacia = {
      llamadas: [],
      async purgarCaducados() {
        this.llamadas.push(1)
        return {
          ok: true,
          purgados: 0,
          revisados: 0,
          sinFecha: 0,
          bytesAprox: 0,
          porAlmacen: {},
          motivo: null,
          mensaje: 'No había ninguna consulta caducada que liberar.',
        }
      },
    }
    const m = await montar({ bd: apertura, almacen: almacenSinEspacio(real, 5), cache: cacheVacia })

    await abrir(m)
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    expect(cacheVacia.llamadas).toHaveLength(1)
    expect(m.renglon()).toMatch(/espacio/i)
    expect((await real.listar()).registros).toHaveLength(0)
    m.cableado.destruir()
  })

  it('sin caché cableada se dice qué puede hacer el usuario, en vez de callar', async () => {
    const apertura = await baseNueva()
    const real = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 3) })
    const m = await montar({ bd: apertura, almacen: almacenSinEspacio(real, 5), cache: null })

    await abrir(m)
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    expect(m.renglon()).toBe(MENSAJE_SIN_PURGA)
    m.cableado.destruir()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('F10 · T5.1 · 9 · el arranque OFRECE, no impone', () => {
  it('se pide la persistencia UNA vez al arrancar', async () => {
    const m = await montar()
    expect(m.persistencias).toHaveLength(1)
    expect(m.cableado.estado().persistido).toBe(false)
    m.cableado.destruir()
  })

  it('⭐ la aplicación arranca como siempre: la parcela del store no se toca', async () => {
    const apertura = await baseNueva()
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 2) })
    await almacen.guardarBorrador(crearExpediente({ srs: SRS, parcela: parcelaDemoConHueco() }))

    const m = await montar({ bd: apertura })
    expect(m.estado.get().refcat, 'el arranque ha cambiado la parcela por su cuenta').toBe(
      REFCAT_DEMO,
    )
    expect(m.cargadas, 'el arranque ha abierto un documento sin que nadie lo pidiera').toEqual([])
    m.cableado.destruir()
  })

  it('con borrador se OFRECE por el panel, nombrando dónde está el botón', async () => {
    const apertura = await baseNueva()
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 2) })
    await almacen.guardarBorrador(crearExpediente({ srs: SRS, parcela: parcelaDemo() }))

    const m = await montar({ bd: apertura })
    const dicho = m.avisos().join('\n')
    expect(dicho).toContain(REFCAT_DEMO)
    expect(dicho).toContain('Expediente')
    m.cableado.destruir()
  })

  it('⭐ el régimen de almacenamiento NO gasta una tarjeta del panel al arrancar', async () => {
    // ⛔ CORREGIDO AL MEDIRLO (guion 12, 2026-08-03). Este aviso salía por el panel al
    // arrancar cuando ya había algo guardado, y costaba **52 px de la caja de
    // vértices** (267 → 215, por debajo del suelo declarado de 220) en CADA carga y
    // para siempre — porque, a diferencia de la oferta del borrador, no se resuelve
    // nunca. Se dice donde se puede actuar, no donde estorba.
    const apertura = await baseNueva()
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 2) })
    await almacen.guardar(crearExpediente({ srs: SRS, parcela: parcelaDemo() }), { nombre: 'Uno' })

    const m = await montar({ bd: apertura, persistido: false })
    expect(m.avisos().join('\n')).not.toMatch(/no garantiza/i)
    m.cableado.destruir()
  })

  it('…pero se DICE al abrir el diálogo, que es donde se decide confiarle el trabajo', async () => {
    const m = await montar({ persistido: false })
    await abrir(m)
    expect(m.renglon()).toMatch(/no garantiza/i)
    m.cableado.destruir()
  })

  it('…y NO se dice cuando el navegador sí garantiza la conservación', async () => {
    const m = await montar({ persistido: true })
    await abrir(m)
    expect(m.renglon()).not.toMatch(/no garantiza/i)
    m.cableado.destruir()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('F10 · T5.1 · 10 · higiene', () => {
  it('`destruir()` retira el diálogo, el oyente del botón y la suscripción del store', async () => {
    const m = await montar()
    expect(document.querySelectorAll('dialog.gml-dialogo-expediente')).toHaveLength(1)

    m.cableado.destruir()
    expect(document.querySelectorAll('dialog.gml-dialogo-expediente')).toHaveLength(0)

    // Ni el botón ni el store despiertan ya a nadie.
    document
      .querySelector(SELECTOR_BOTON_EXPEDIENTE)
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    m.estado.set(parcelaDemoConHueco())
    await reposar()
    expect(document.querySelectorAll('dialog.gml-dialogo-expediente')).toHaveLength(0)
    expect(m.timers.cuantos).toBe(0)
  })

  it('`destruir()` es IDEMPOTENTE', async () => {
    const m = await montar()
    m.cableado.destruir()
    expect(() => m.cableado.destruir()).not.toThrow()
  })

  it('el botón de la cáscara abre el diálogo de verdad', async () => {
    const m = await montar()
    document
      .querySelector(SELECTOR_BOTON_EXPEDIENTE)
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await reposar()
    expect(document.querySelector('dialog.gml-dialogo-expediente').open).toBe(true)
    m.cableado.destruir()
  })

  it('⭐ el módulo no lee el reloj del sistema: `Date.now()` no aparece en su fuente', () => {
    const fuente = readFileSync(join(RAIZ, 'app', 'cableado-expediente.js'), 'utf8')
    // Anti-vacuidad: el fichero se ha leído de verdad.
    expect(fuente.length).toBeGreaterThan(1000)
    expect(fuente).not.toMatch(/Date\.now\(\)/)
  })

  it('⭐ ningún mensaje lleva Markdown crudo: el panel no lo interpreta', async () => {
    // ⛔ MEDIDO en navegador real (2026-08-03): el panel de avisos pinta `textContent`,
    // así que un `**No se ha abierto nada**` sale en pantalla CON los asteriscos. Se
    // encontraron dos —éste y el de `storage/expedientes.js#borrar`— y los dos se
    // arreglaron quitando la sintaxis, no añadiendo un intérprete de Markdown: enfatizar
    // con palabras siempre funciona, y meter marcado en el canal de avisos abriría una
    // superficie de inyección para textos que llevan dentro nombres de fichero.
    const apertura = await baseNueva()
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 2) })
    await almacen.guardarBorrador(crearExpediente({ srs: SRS, parcela: parcelaDemo() }))
    const m = await montar({ bd: apertura })

    const textos = [
      ...m.avisos(),
      COLETILLA_SIN_PERSISTENCIA,
      MENSAJE_AUTOGUARDADO_EN_ESPERA,
      MENSAJE_SIN_PARCELA,
      MENSAJE_SIN_PURGA,
      MENSAJE_SIN_SELECTOR,
    ]
    // Anti-vacuidad: el arranque ha dicho algo de verdad.
    expect(m.avisos().length).toBeGreaterThan(0)
    for (const t of textos) expect(t, `«${t.slice(0, 60)}…» lleva Markdown crudo`).not.toContain('**')
    m.cableado.destruir()
  })

  it('⭐ regla de oro 9: ni una palabra de mérito en lo que este módulo escribe', () => {
    const fuente = readFileSync(join(RAIZ, 'app', 'cableado-expediente.js'), 'utf8')
    const prohibidas = /\b(correcta|correcto|perfecto|válida|válido|aprobado|conforme|garantiza\w*\s+que\s+es)\b/i
    // Solo los textos que salen por pantalla: las constantes exportadas de mensaje.
    const textos = [
      COLETILLA_SIN_PERSISTENCIA,
      MENSAJE_AUTOGUARDADO_EN_ESPERA,
      MENSAJE_SIN_PARCELA,
      MENSAJE_SIN_PURGA,
      MENSAJE_SIN_SELECTOR,
    ].join('\n')
    expect(textos).not.toMatch(prohibidas)
    expect(fuente).toContain('regla de oro 9')
  })
})
