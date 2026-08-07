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
 *                                                                              *
 * ── ⛔ F11 · T3.3 · LOS BLOQUES 11 A 15 ──                                      *
 * F11 le añade a la aplicación una segunda rama, y este cableado es donde podía  *
 * romper F10 **sin hacer ruido**. Lo de arriba (bloques 1–10) se monta SIN rama  *
 * —`rama: null` ⇒ PARCELA, exactamente F10— y sigue valiendo sin tocar una línea;*
 * lo de abajo es lo único que la mide.                                          *
 *                                                                              *
 * ⚠️ **Y una trampa de arnés medida, que cuesta media hora**: asignar el `<body>` *
 * de `index.html` con `innerHTML` **no trae la clase `gml-app`** —copia el       *
 * contenido, no los atributos de la etiqueta— y `cablearRama` la exige. Tiene su *
 * `it` en el bloque 11, para que la próxima persona la lea en vez de sufrirla.   *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { crearDialogoAvisos } from '../../app/dialogo-avisos.js'
import {
  COLETILLA_SIN_PERSISTENCIA,
  DOCUMENTO,
  EXTENSIONES_PROYECTO,
  FICHERO,
  MENSAJE_AUTOGUARDADO_EN_ESPERA,
  MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO,
  MENSAJE_GUARDADO_SIN_EDIFICIO,
  MENSAJE_SIN_EDIFICIO,
  MENSAJE_SIN_PARCELA,
  MENSAJE_SIN_PURGA,
  MENSAJE_SIN_RAMA_EDIFICIO,
  MENSAJE_SIN_SELECTOR,
  MOTIVO_GUARDAR_EN_EDIFICIO,
  MS_CONFIRMAR_BORRADO,
  SELECTOR_BOTON_EXPEDIENTE,
  cablearExpediente,
  mensajeEdificioFuera,
  mensajeParcelaDeContexto,
  mensajeParcelaFuera,
  nombreFicheroExport,
} from '../../app/cableado-expediente.js'
import { parcelaDemo, parcelaDemoConHueco, REFCAT_DEMO } from '../../app/demo-datos.js'
import { SELECTOR, motivoOtroHuso, selectorFila } from '../../app/dialogo-expediente.js'
import { ATRIBUTO_PANEL, RAMA, cablearRama } from '../../app/rama.js'
import { ACADVER } from '../../export/dxf.js'
import { deProyecto } from '../../export/proyecto.js'
import { TIPO_MIME_TEXTO, TIPO_MIME_XLSX, nombreFicheroGml } from '../../gml/descargar.js'
import { crearEdificio } from '../../model/edificio.js'
import { TIPO_EXPEDIENTE, crearExpediente } from '../../model/parcela.js'
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

// ── F11 · la segunda rama ────────────────────────────────────────────────────

/**
 * Un Edificio de verdad, del modelo. Dos partes, para que un recuento pueda
 * distinguirlo de un edificio vacío.
 */
function edificioDemo({ refcat = 'EDIF-1', parcelaContexto = null, idLocal = 'EDIF-DEMO' } = {}) {
  return crearEdificio({
    // F12 · T4.3: con identidad por defecto, que es como entra en producción por las
    // cuatro puertas. Las pruebas que midan qué pasa SIN ella la piden a `null`.
    idLocal,
    refcat,
    parcelaContexto,
    partes: [
      {
        nombre: 'cuerpo principal',
        origen: 'DXF',
        recinto: { tipo: 'EXTERIOR', vertices: [[0, 0], [10, 0], [10, 8], [0, 8]] },
      },
      {
        nombre: 'porche',
        origen: 'DXF',
        recinto: { tipo: 'EXTERIOR', vertices: [[10, 0], [14, 0], [14, 4], [10, 4]] },
      },
    ],
  })
}

/**
 * Un conmutador de rama de MENTIRA. Se usa **solo** donde hay que medir la BAJA de
 * la suscripción: con el de verdad, quitar `bajaRama()` de `destruir()` seguiría en
 * verde porque los manejadores empiezan por `if (destruido) return` —la lección de
 * los dos guardianes verdes de T2.4—. Aquí la baja es un espía y se mide que se
 * llama, que es lo único que la mutación no puede fingir.
 */
function ramaDeMentira(inicial = RAMA.PARCELA) {
  let valor = inicial
  const suscriptores = new Set()
  const bajas = []
  return {
    bajas,
    cuantosSuscriptores: () => suscriptores.size,
    get: () => valor,
    set(r) {
      valor = r
      for (const fn of [...suscriptores]) fn(r)
    },
    subscribe(fn) {
      suscriptores.add(fn)
      const baja = vi.fn(() => suscriptores.delete(fn))
      bajas.push(baja)
      return baja
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
  conRama = false,
  ramaInicial = RAMA.PARCELA,
  edificio = null,
  // Entra por parámetro desde T7: un `url` sin `createObjectURL` es la forma limpia de
  // provocar que `descargarTexto` NO entregue, sin doblar el módulo entero.
  url = espiaUrl(),
} = {}) {
  const apertura = bd ?? (await baseNueva())
  let reloj = Date.UTC(2026, 7, 3, 10, 0, 0)

  const panel = crearDialogoAvisos({ documento: document })
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
  const cargadas = []

  // ── F11 · la rama, cuando la prueba la pide ────────────────────────────────
  let rama = null
  let estadoEdificio = null
  if (conRama) {
    // ⛔ MEDIDO: asignar el `<body>` de `index.html` con `innerHTML` **no trae la
    // clase `gml-app`** —los atributos de la etiqueta `<body>` se quedan fuera—, y
    // `cablearRama` la exige (`SELECTOR.APP`). Hay un `it` que lo atesta más abajo.
    document.body.className = 'gml-app'
    // Una sección de edificio de mentira: el panel de verdad es de otra tarea, y sin
    // ninguna `cablearRama` saca un ERROR por el panel al conmutar (y con razón).
    const seccionEdificio = document.createElement('section')
    seccionEdificio.setAttribute(ATRIBUTO_PANEL, RAMA.EDIFICIO)
    seccionEdificio.hidden = true
    document.body.appendChild(seccionEdificio)
    estadoEdificio = crearEstadoVista(edificio)
    rama = cablearRama({ documento: document, panel, ramaInicial })
  }

  const cableado = cablearExpediente({
    estado,
    panel,
    srs,
    expedientes,
    cuota,
    cache,
    rama,
    estadoEdificio,
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
    estadoEdificio,
    expedientes,
    panel,
    persistencias,
    rama,
    timers,
    url,
    /** Desmonta las dos cosas que una prueba con rama deja puestas. */
    desmontar() {
      cableado.destruir()
      if (rama !== null) rama.destruir()
    },
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

/** El panel de avisos REAL sobre la cáscara real. Tres nodos, siempre los mismos. */
const panelDePrueba = () =>
  crearDialogoAvisos({ documento: document })

/** Los cinco textos que F11 añade. Entran en los dos guardianes de higiene. */
const TEXTOS_F11 = Object.freeze([
  MOTIVO_GUARDAR_EN_EDIFICIO,
  MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO,
  MENSAJE_SIN_EDIFICIO,
  MENSAJE_SIN_RAMA_EDIFICIO,
  MENSAJE_GUARDADO_SIN_EDIFICIO,
])

/**
 * Los textos que el rework de UI · T7 añade: los tres, **por los dos documentos**, o
 * sea las seis cadenas que pueden salir por pantalla.
 *
 * ⛔ **La lista se escribió primero con un solo documento por texto, y una mutación lo
 * cazó**: haciendo que el cableado avisara SIEMPRE, la prueba de «sin parcela debajo no
 * dice nada de más» seguía en VERDE, porque el texto que salía llevaba el otro nombre
 * de documento y el `not.toContain` no lo reconocía. Fijar una sola variante convierte
 * las comprobaciones negativas en decorado.
 *
 * Entran además en los mismos dos guardianes de higiene que los de F11: un texto que no
 * pase por ahí puede salir con Markdown crudo o con una palabra de mérito y nadie se
 * entera.
 */
const TEXTOS_T7 = Object.freeze(
  [mensajeEdificioFuera, mensajeParcelaDeContexto, mensajeParcelaFuera].flatMap((componer) =>
    Object.values(DOCUMENTO).map((donde) => componer(donde)),
  ),
)

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
  // `innerHTML` no trae los atributos de la etiqueta `<body>`: se deja explícito
  // vacío para que la trampa de F11 sea medible y no herencia de otra prueba.
  document.body.className = ''
  // Ver la trampa de entorno de la cabecera.
  clickEspiado = vi
    .spyOn(window.HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
})

afterEach(() => {
  clickEspiado.mockRestore()
  document.body.innerHTML = ''
  document.body.className = ''
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
    const panel = crearDialogoAvisos({ documento: document })
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

  // ── F20 · la cuarta salida ──────────────────────────────────────────────
  //
  // Lo que se mide aquí es EL CABLEADO, no la maqueta: que el botón exista, que
  // baje un fichero de verdad, que lo haga por el primitivo BINARIO y que se llame
  // como tiene que llamarse. Qué hay dentro de cada celda lo prueba
  // `test/export/excel-coordenadas.test.js`, y que Excel lo abra, `validar-xlsx`.

  it('⭐ el Excel baja como BYTES, y llegan intactos hasta el Blob', async () => {
    const m = await montar()
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_EXCEL)
    await reposar()

    expect(m.url.blobs).toHaveLength(1)
    const bytes = new Uint8Array(await m.url.blobs[0].arrayBuffer())
    // ⛔ La firma `PK` es la prueba de que NO ha pasado por `descargarTexto`: ese
    // primitivo codifica en UTF-8 y habría corrompido el ZIP en silencio, dejando
    // estos mismos cuatro bytes intactos al principio y el destrozo más adentro.
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    // Y el final: el EOCD. Si el cuerpo se hubiera recodificado, no cuadraría.
    expect(Array.from(bytes.subarray(bytes.length - 22, bytes.length - 18))).toEqual([
      0x50, 0x4b, 0x05, 0x06,
    ])
    m.cableado.destruir()
  })

  it('el Excel baja con el MISMO prefijo que el .txt y otra extensión', async () => {
    const m = await montar()
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_EXCEL)
    await reposar()

    expect(m.renglon()).toContain(`${FICHERO.EXCEL.prefijo}_${REFCAT_DEMO}`)
    expect(m.renglon()).toContain('.xlsx')
    expect(FICHERO.EXCEL.prefijo).toBe(FICHERO.COORDENADAS.prefijo)
    m.cableado.destruir()
  })

  it('declara el MIME registrado del .xlsx, y no el del .xls de antes de 2007', async () => {
    const m = await montar()
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_EXCEL)
    await reposar()

    expect(m.url.blobs[0].type).toBe(TIPO_MIME_XLSX)
    expect(TIPO_MIME_XLSX).not.toContain('ms-excel')
    m.cableado.destruir()
  })

  it('⭐ los dos listados de la misma parcela dicen lo mismo, y el .xlsx pesa más', async () => {
    // No es una prueba de tamaño: es que bajar los dos seguidos funcione y produzca
    // dos ficheros DISTINTOS y ambos no vacíos. El «dicen lo mismo» de verdad lo
    // vigila el guardián cruzado de `test/export/excel-coordenadas.test.js`.
    const m = await montar()
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_COORDENADAS)
    await reposar()
    pulsar(SELECTOR.EXPORTAR_EXCEL)
    await reposar()

    expect(m.url.blobs).toHaveLength(2)
    expect(m.url.blobs[0].size).toBeGreaterThan(0)
    expect(m.url.blobs[1].size).toBeGreaterThan(0)
    expect(m.url.blobs[0].type).toBe(TIPO_MIME_TEXTO)
    expect(m.url.blobs[1].type).toBe(TIPO_MIME_XLSX)
    m.cableado.destruir()
  })

  it('sin parcela no baja nada y se dice', async () => {
    const m = await montar({ parcela: null })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_EXCEL)
    await reposar()

    expect(m.url.blobs).toHaveLength(0)
    expect(m.renglon()).toBe(MENSAJE_SIN_PARCELA)
    m.cableado.destruir()
  })

  it('⭐ el aviso de la rama EDIFICIO nombra las salidas que de verdad hay', async () => {
    // Este mensaje ENUMERA, así que caduca cada vez que se añade una salida — y ya
    // caducó una vez: decía «El DXF y el listado de coordenadas» cuando ya eran tres.
    // Se comprueba contra el catálogo, no contra una cadena escrita a mano.
    for (const formato of [FICHERO.DXF, FICHERO.COORDENADAS, FICHERO.EXCEL]) {
      expect(
        MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO,
        `el aviso no nombra la salida ${formato.extension}`,
      ).toContain(formato.extension === '.dxf' ? 'DXF' : formato.extension)
    }
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

  it('los nombres derivan de `nombreFicheroGml` y no colisionan entre sí ni con el GML', async () => {
    const fecha = new Date(Date.UTC(2026, 7, 3, 10, 0, 0))
    const nombres = Object.values(FICHERO).map((f) =>
      nombreFicheroExport({ prefijo: f.prefijo, extension: f.extension, refcat: REFCAT_DEMO, fecha }),
    )
    const delGml = nombreFicheroGml({ refcat: REFCAT_DEMO, fecha })
    // ⚠️ La cuenta se DERIVA de `FICHERO` y no se escribe a mano. Estaba fijada en 4 y
    // F20 la puso en rojo al añadir la cuarta salida — un rojo correcto, porque el test
    // hacía su trabajo, pero por el motivo equivocado: lo que aquí importa es que TODOS
    // sean distintos, no cuántos hay. ⭐ Y el caso que de verdad vigila es el `.xlsx`,
    // que comparte el prefijo `coordenadas` con el `.txt` a propósito: los distingue la
    // extensión y nada más.
    expect(new Set([...nombres, delGml]).size).toBe(nombres.length + 1)
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
      ...TEXTOS_F11,
      ...TEXTOS_T7,
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
      ...TEXTOS_F11,
      ...TEXTOS_T7,
    ].join('\n')
    expect(textos).not.toMatch(prohibidas)
    expect(fuente).toContain('regla de oro 9')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// F11 · T3.3 · la rama y el expediente
//
// Aquí es donde F11 podía romper F10 sin hacer ruido. Todo lo de arriba sigue
// montando el cableado SIN rama —`rama: null` ⇒ PARCELA, exactamente F10—, así que
// estas pruebas son el único sitio donde se mide la segunda rama.
//
// ⚠️ Se usa el `cablearRama` DE VERDAD, no un doble, por lo mismo que el resto de
// este fichero usa el almacén de verdad: lo que se prueba es el CABLE. El único
// doble es el de la prueba de la baja, y allí está dicho por qué.
// ══════════════════════════════════════════════════════════════════════════════

describe('F11 · T3.3 · 11 · la trampa del arnés', () => {
  it('⛔ el `<body>` de index.html metido con `innerHTML` NO trae la clase `gml-app`', () => {
    // Medido, y cuesta media hora encontrarlo: `innerHTML` copia el CONTENIDO del
    // `<body>`, no sus atributos. `cablearRama` resuelve `.gml-app` y lanza sin ella.
    expect(CUERPO_INDEX).not.toMatch(/^\s*<body/i)
    expect(document.body.className).toBe('')
    const panel = panelDePrueba()
    expect(() => cablearRama({ documento: document, panel })).toThrow(/gml-app/)
  })
})

describe('F11 · T3.3 · 12 · (a) `expedienteActual()` pregunta por la rama', () => {
  it('⛔ con la rama EDIFICIO NO devuelve la parcela: devuelve el edificio', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    const exp = m.cableado.expedienteActual()

    expect(exp.tipo).toBe('EDIFICIO')
    expect(exp.edificio.partes).toHaveLength(2)
    expect(exp.parcela).toBeNull()
    // Anti-vacuidad: en el store de parcela HAY una parcela entera, y aun así no sale.
    expect(m.estado.get().refcat).toBe(REFCAT_DEMO)
    m.desmontar()
  })

  it('⭐ y en la rama PARCELA sigue devolviendo la parcela, con el edificio cargado', async () => {
    // La otra mitad del anti-vacuidad: si devolviera siempre el edificio, la prueba
    // de arriba tampoco diría nada.
    const m = await montar({ conRama: true, edificio: edificioDemo() })
    const exp = m.cableado.expedienteActual()
    expect(exp.tipo).toBe('PARCELA')
    expect(exp.parcela.refcat).toBe(REFCAT_DEMO)
    expect(exp.edificio).toBeNull()
    m.desmontar()
  })

  it('⛔ NUNCA se le pasan las DOS ramas a `crearExpediente`: no lanza con las dos llenas', async () => {
    // `model/parcela.js#crearExpediente` LANZA si le llegan `parcela` y `edificio`
    // juntos, y `expedienteActual()` se llama desde dentro de un `click`. Con los dos
    // stores llenos y la rama conmutada a EDIFICIO, esto es la prueba directa.
    const m = await montar({ conRama: true, edificio: edificioDemo() })
    expect(m.estado.get()).not.toBeNull()
    expect(m.estadoEdificio.get()).not.toBeNull()

    m.rama.set(RAMA.EDIFICIO)
    expect(() => m.cableado.expedienteActual()).not.toThrow()
    const exp = m.cableado.expedienteActual()
    // Una rama y solo una, en cada sentido.
    expect([exp.parcela, exp.edificio].filter((r) => r !== null)).toHaveLength(1)
    m.desmontar()
  })

  it('⭐ la parcela de pantalla viaja como `edificio.parcelaContexto` (desviación 9)', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    const exp = m.cableado.expedienteActual()

    expect(exp.edificio.parcelaContexto).toEqual(parcelaDemo().recintos)
    // Y no se ha colado por la puerta de al lado.
    expect(exp.parcela).toBeNull()
    // El store no se ha mutado (regla de oro 4): el POJO de allí sigue sin contexto.
    expect(m.estadoEdificio.get().parcelaContexto).toBeNull()
    m.desmontar()
  })

  it('…y NO pisa un `parcelaContexto` que ya traía el edificio', async () => {
    const propio = [{ tipo: 'EXTERIOR', vertices: [[1, 1], [2, 1], [2, 2]] }]
    const m = await montar({
      conRama: true,
      ramaInicial: RAMA.EDIFICIO,
      edificio: edificioDemo({ parcelaContexto: propio }),
    })
    expect(m.cableado.expedienteActual().edificio.parcelaContexto).toEqual(propio)
    m.desmontar()
  })

  it('sin edificio en el store devuelve null, no un expediente vacío', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: null })
    expect(m.cableado.expedienteActual()).toBeNull()
    m.desmontar()
  })

  it('el nombre del fichero sale con la RC del EDIFICIO, no con la de la parcela', async () => {
    const m = await montar({
      conRama: true,
      ramaInicial: RAMA.EDIFICIO,
      edificio: edificioDemo({ refcat: 'EDIF9999' }),
    })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()
    expect(m.renglon()).toContain('EDIF9999')
    expect(m.renglon()).not.toContain(REFCAT_DEMO)
    m.desmontar()
  })
})

describe('F11 · T3.3 · 13 · (b) F11 no guarda expedientes de edificio, y lo dice', () => {
  it('⛔ «Guardar» nace APAGADO con la rama EDIFICIO, y el motivo está escrito', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    await abrir(m)

    expect(document.querySelector(SELECTOR.GUARDAR).disabled).toBe(true)
    expect(m.renglon()).toBe(MOTIVO_GUARDAR_EN_EDIFICIO)
    // Botón apagado CON motivo, jamás botón muerto: el motivo nombra la alternativa.
    expect(MOTIVO_GUARDAR_EN_EDIFICIO).toContain('.json')
    m.desmontar()
  })

  it('⭐ y el motivo que sale NO es el genérico del diálogo, que aquí sería falso', async () => {
    // `app/dialogo-expediente.js#MOTIVO_SIN_GEOMETRIA` dice «todavía no hay ninguna
    // parcela en pantalla que guardar». Con la rama EDIFICIO eso es mentira: hay un
    // edificio, y lo que falta es el identificador. Un motivo equivocado manda al
    // usuario a arreglar lo que no está roto.
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    await abrir(m)
    expect(m.renglon()).not.toMatch(/ninguna parcela en pantalla/i)
    m.desmontar()
  })

  it('⛔ F12 · T4.3 · el motivo ya NO dice que falte el identificador: se lo dio esta fase', () => {
    // El motivo de F11 razonaba «porque un edificio no tiene aún el identificador con el
    // que se distinguen los expedientes guardados», y T1.1 se lo dio. Mandaba a esperar
    // por algo que ya está. Lo que queda es la razón que SIGUE siendo cierta: la lista y
    // «Recuperar» son de la rama Parcela. Y dice lo que sí pasa, para que nadie crea que
    // está perdiendo lo que tiene en pantalla.
    expect(MOTIVO_GUARDAR_EN_EDIFICIO).not.toMatch(/no tiene aún el identificador/i)
    expect(MOTIVO_GUARDAR_EN_EDIFICIO).toMatch(/lista de expedientes/i)
    expect(MOTIVO_GUARDAR_EN_EDIFICIO).toMatch(/autoguarda/i)
  })

  it('conmutar de rama con el diálogo ABIERTO enciende y apaga «Guardar» al vuelo', async () => {
    const m = await montar({ conRama: true, edificio: edificioDemo() })
    await abrir(m)
    expect(document.querySelector(SELECTOR.GUARDAR).disabled).toBe(false)

    m.rama.set(RAMA.EDIFICIO)
    await reposar()
    expect(document.querySelector(SELECTOR.GUARDAR).disabled).toBe(true)
    expect(m.renglon()).toBe(MOTIVO_GUARDAR_EN_EDIFICIO)

    m.rama.set(RAMA.PARCELA)
    await reposar()
    expect(document.querySelector(SELECTOR.GUARDAR).disabled).toBe(false)
    m.desmontar()
  })

  it('⭐ y la guarda NO depende de ese `disabled`: forzando el clic tampoco guarda', async () => {
    // Mismo argumento que la guarda del huso de F10: un `disabled` es cortesía. El
    // precio de que se colara es archivar el expediente de la PARCELA mientras el
    // usuario está mirando un edificio, en silencio.
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    await abrir(m)
    escribirNombre('No debería existir')
    const boton = document.querySelector(SELECTOR.GUARDAR)
    boton.disabled = false
    boton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await reposar()

    expect((await m.expedientes.listar()).registros).toHaveLength(0)
    expect(m.renglon()).toBe(MOTIVO_GUARDAR_EN_EDIFICIO)
    m.desmontar()
  })

  // ⛔ **F12 · T4.3 · AQUÍ HABÍA TRES PRUEBAS QUE YA NO PUEDEN EXISTIR**, y no porque
  // fueran malas: medían con precisión la desviación 7 de F11 —«el autoguardado no se
  // dispara con la rama EDIFICIO activa, ni siquiera para la parcela»— que existía por
  // un motivo escrito: **el borrador era UN registro de clave reservada** y las dos
  // ramas se habrían pisado. T4.3 le da una clave a cada rama
  // (`storage/expedientes.js#ID_BORRADOR_POR_TIPO`), el motivo desaparece, y seguir sin
  // guardar la parcela sería dejar de guardarla porque sí.
  //
  // Lo que se afirma ahora es lo contrario, y con el mismo rigor: se dispara, escribe
  // en SU clave, y **no toca la del otro**. Esa última es la que importa: era el riesgo
  // entero de la desviación 7 y es lo único que la levanta con seguridad.

  it('⭐ el autoguardado SÍ se dispara con la rama EDIFICIO activa (T4.3 levanta la desviación 7)', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    expect(m.timers.cuantos).toBe(0)

    m.estado.set(parcelaDemoConHueco())
    await reposar()

    expect(m.timers.cuantos).toBe(1)
    m.timers.disparar()
    await reposar()
    expect((await m.expedientes.listar()).hayBorrador).toBe(true)
    m.desmontar()
  })

  it('⭐ anti-vacuidad: el MISMO cambio en la rama PARCELA sí programa y sí escribe', async () => {
    const m = await montar({ conRama: true, edificio: edificioDemo() })
    m.estado.set(parcelaDemoConHueco())
    await reposar()

    expect(m.timers.cuantos).toBe(1)
    m.timers.disparar()
    await reposar()
    expect((await m.expedientes.listar()).hayBorrador).toBe(true)
    m.desmontar()
  })

  it('⭐ lo cambiado durante la rama EDIFICIO se guarda, y en la clave de PARCELA', async () => {
    // Antes de T4.3 esto se quedaba pendiente y se volcaba al volver. Ahora se escribe
    // en el momento — y sigue yendo al borrador de PARCELA, que es lo que hace que la
    // rama de al lado no lo pise.
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    m.estado.set(parcelaDemoConHueco())
    await reposar()
    m.timers.disparar()
    await reposar()

    const borrador = await m.expedientes.leerBorrador()
    expect(borrador.ok).toBe(true)
    expect(borrador.expediente.parcela.recintos).toHaveLength(2) // la del hueco
    m.desmontar()
  })

  it('⛔ y el borrador de EDIFICIO no pisa el de PARCELA: son dos registros', async () => {
    // **La afirmación que sostenía la desviación 7 entera**, ahora en positivo. Si las
    // dos claves volvieran a ser una, uno de estos dos `leerBorrador` devolvería el
    // documento de la otra rama y esta prueba se pondría roja.
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    m.estado.set(parcelaDemoConHueco())
    m.estadoEdificio.set(edificioDemo({ idLocal: 'el-de-la-prueba' }))
    await reposar()
    m.timers.disparar()
    await reposar()

    const deParcela = await m.expedientes.leerBorrador(TIPO_EXPEDIENTE.PARCELA)
    const deEdificio = await m.expedientes.leerBorrador(TIPO_EXPEDIENTE.EDIFICIO)
    expect(deParcela.ok).toBe(true)
    expect(deParcela.expediente.parcela.recintos).toHaveLength(2)
    expect(deEdificio.ok).toBe(true)
    expect(deEdificio.expediente.edificio.idLocal).toBe('el-de-la-prueba')
    m.desmontar()
  })

  it('⭐ DESCARTAR el borrador vuelca lo pendiente de las DOS ramas', async () => {
    // `resolverOferta` es el otro sitio que vuelca lo pendiente. Hasta T4.3 preguntaba
    // por la rama y se callaba en EDIFICIO; ahora vuelca las dos, porque las dos tienen
    // dónde escribir.
    const apertura = await baseNueva()
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 2) })
    await almacen.guardarBorrador(crearExpediente({ srs: SRS, parcela: parcelaDemo() }))
    const m = await montar({
      bd: apertura,
      conRama: true,
      ramaInicial: RAMA.EDIFICIO,
      edificio: edificioDemo(),
    })
    expect(m.cableado.estado().ofreciendoBorrador).toBe(true)

    m.estado.set(parcelaDemoConHueco())
    await reposar()
    // Con la oferta en pie NO se escribe: eso no ha cambiado, y es lo que impide que la
    // primera edición se lleve por delante el trabajo de ayer antes de ofrecerlo.
    expect(m.timers.cuantos).toBe(0)

    await abrir(m)
    pulsar(`${SELECTOR.BORRADOR} [data-accion="descartar-borrador"]`)
    await reposar()

    expect(m.timers.cuantos).toBe(1)
    m.desmontar()
  })

  it('⛔ el DXF y los dos listados se apagan con motivo, no bajan la parcela', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    await abrir(m)

    for (const selector of [
      SELECTOR.EXPORTAR_DXF,
      SELECTOR.EXPORTAR_COORDENADAS,
      SELECTOR.EXPORTAR_EXCEL,
    ]) {
      document
        .querySelector(selector)
        .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      await reposar()
      expect(m.renglon()).toBe(MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO)
    }
    // Lo que importa: no ha bajado NADA. Un DXF de la parcela de debajo mientras el
    // usuario mira un edificio es el documento equivocado, en silencio.
    expect(m.url.blobs).toHaveLength(0)
    m.desmontar()
  })

  it('⭐ pero el fichero de proyecto SÍ se lleva el edificio: es su única puerta', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()

    expect(m.url.blobs).toHaveLength(1)
    const leido = deProyecto(await m.url.blobs[0].text())
    expect(leido.ok).toBe(true)
    expect(leido.expediente.tipo).toBe('EDIFICIO')
    expect(leido.expediente.edificio.partes.map((p) => p.nombre)).toEqual([
      'cuerpo principal',
      'porche',
    ])
    m.desmontar()
  })

  it('sin edificio, exportar el proyecto lo dice hablando de EDIFICIOS', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: null })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()
    expect(m.renglon()).toBe(MENSAJE_SIN_EDIFICIO)
    expect(m.renglon()).not.toBe(MENSAJE_SIN_PARCELA)
    m.desmontar()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// F12 · T4.3 · EL AUTOGUARDADO DE LA RAMA EDIFICIO
// ═════════════════════════════════════════════════════════════════════════════
//
// Lo que la desviación 7 de F11 aplazó, con su motivo escrito: el borrador era UN
// registro de clave reservada y suscribir el segundo store habría hecho que las dos
// ramas se pisaran. T4.3 parte la clave en dos, le da identidad al `Edificio` y
// suscribe el debounce. Lo que se comprueba aquí es lo que el usuario nota: que un
// edificio dibujado a mano sobrevive a cerrar la pestaña.

describe('F12 · T4.3 · la rama EDIFICIO se autoguarda', () => {
  it('⭐ tocar el edificio programa SU debounce y escribe SU borrador', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: null })
    expect(m.timers.cuantos).toBe(0)

    m.estadoEdificio.set(edificioDemo({ idLocal: 'UTM.dxf' }))
    await reposar()
    expect(m.timers.cuantos).toBe(1)

    m.timers.disparar()
    await reposar()
    const b = await m.expedientes.leerBorrador(TIPO_EXPEDIENTE.EDIFICIO)
    expect(b.ok).toBe(true)
    expect(b.expediente.tipo).toBe(TIPO_EXPEDIENTE.EDIFICIO)
    expect(b.expediente.edificio.partes).toHaveLength(2)
    m.desmontar()
  })

  it('⭐ y la parcela de debajo viaja dentro, como CONTEXTO', async () => {
    // Recuperar el borrador y devolver el edificio flotando sobre nada sería devolver
    // media pantalla. Es el mismo `conParcelaDeContexto` de «Guardar proyecto».
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: null })
    m.estadoEdificio.set(edificioDemo({ idLocal: 'UTM.dxf' }))
    await reposar()
    m.timers.disparar()
    await reposar()

    const b = await m.expedientes.leerBorrador(TIPO_EXPEDIENTE.EDIFICIO)
    expect(b.expediente.edificio.parcelaContexto).toEqual(parcelaDemo().recintos)
    m.desmontar()
  })

  it('⛔ un edificio SIN identidad no se autoguarda, y no se inventa una', async () => {
    // Dos documentos sin identidad son indistinguibles: el segundo pisaría al primero
    // creyendo que es una edición suya. Es lo que hacía imposible el autoguardado
    // antes de que `model/edificio.js` tuviera `idLocal` (T1.1).
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: null })
    m.estadoEdificio.set(edificioDemo({ idLocal: null }))
    await reposar()

    expect(m.timers.cuantos).toBe(0)
    expect((await m.expedientes.listar()).borradores).toEqual([])
    m.desmontar()
  })

  it('cargar OTRO edificio suelta la identidad del anterior', async () => {
    // Si no, el siguiente «Guardar» pisaría el registro del primero con la geometría
    // del segundo. Mismo criterio que `idLocalAbierto` para la parcela desde F10.
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: null })
    m.estadoEdificio.set(edificioDemo({ idLocal: 'primero.dxf' }))
    await reposar()
    const creado = m.cableado.estado().creado

    m.avanzar(60_000)
    m.estadoEdificio.set(edificioDemo({ idLocal: 'segundo.dxf' }))
    await reposar()
    expect(m.cableado.estado().creado).not.toBe(creado)
    m.desmontar()
  })

  it('editar el MISMO edificio conserva el `creado`: es una edición, no otro documento', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: null })
    m.estadoEdificio.set(edificioDemo({ idLocal: 'uno.dxf' }))
    await reposar()
    const creado = m.cableado.estado().creado

    m.avanzar(60_000)
    m.estadoEdificio.set(edificioDemo({ idLocal: 'uno.dxf', refcat: 'OTRA-RC' }))
    await reposar()
    expect(m.cableado.estado().creado).toBe(creado)
    m.desmontar()
  })

  it('⛔ las dos identidades son INDEPENDIENTES: cargar una parcela no toca la del edificio', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: null })
    m.estadoEdificio.set(edificioDemo({ idLocal: 'uno.dxf' }))
    await reposar()
    const delEdificio = m.cableado.estado().creado

    m.avanzar(60_000)
    m.estado.set(parcelaDemoConHueco()) // otro documento en la OTRA rama
    await reposar()
    expect(m.cableado.estado().creado).toBe(delEdificio)
    m.desmontar()
  })

  it('la suscripción al segundo store se retira al destruir', async () => {
    // Se mide por lo que HACE y no por un contador de suscriptores: `crearEstadoVista`
    // no publica ninguno, y un doble que lo publicara mediría el doble, no el cable.
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: null })
    m.cableado.destruir()
    m.estadoEdificio.set(edificioDemo({ idLocal: 'despues.dxf' }))
    await reposar()
    expect(m.timers.cuantos).toBe(0)
    if (m.rama !== null) m.rama.destruir()
  })

  it('sin rama de edificio montada nada de esto se monta, y F10 sigue igual', async () => {
    // El montaje de todas las pruebas de F10: `rama: null` y `estadoEdificio: null`.
    const m = await montar()
    m.estado.set(parcelaDemoConHueco())
    await reposar()
    m.timers.disparar()
    await reposar()
    expect((await m.expedientes.listar()).borradores).toEqual([TIPO_EXPEDIENTE.PARCELA])
    expect(m.cableado.estado().autoguardadoEdificio.escrituras).toBe(0)
    m.desmontar()
  })
})

describe('F12 · T4.3 · la oferta del arranque conoce las dos ramas', () => {
  /** Cuándo se empezó el trabajo que se siembra. Fijo, para poder afirmarlo. */
  const CREADO_DE_AYER = '2026-08-01T07:30:00.000Z'

  /** Siembra los borradores que pida la prueba, en una base que se le devuelve. */
  async function conBorradores({ parcela = false, edificio = false } = {}) {
    const apertura = await baseNueva()
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 2, 9, 0, 0) })
    if (parcela) await almacen.guardarBorrador(crearExpediente({ srs: SRS, parcela: parcelaDemo() }))
    if (edificio) {
      await almacen.guardarBorrador(
        crearExpediente({
          tipo: TIPO_EXPEDIENTE.EDIFICIO,
          srs: SRS,
          edificio: edificioDemo({ idLocal: 'de-ayer.dxf', refcat: null }),
          // ⚠️ Explícitos: `crearExpediente` estampa el reloj DEL SISTEMA cuando faltan
          // —el `ahora` inyectado es el del almacén, no el del modelo—, y una prueba
          // sobre una fecha del sistema sería intermitente por diseño.
          metadatos: { creado: CREADO_DE_AYER, modificado: CREADO_DE_AYER, autor: '', idDocumento: '' },
        }),
      )
    }
    return apertura
  }

  it('⭐ un borrador SOLO de edificio se ofrece, y el aviso lo nombra por su rama', async () => {
    const m = await montar({
      bd: await conBorradores({ edificio: true }),
      conRama: true,
      edificio: null,
    })
    expect(m.cableado.estado().ofreciendoBorrador).toBe(true)
    expect(m.cableado.estado().ramasOfrecidas).toEqual([TIPO_EXPEDIENTE.EDIFICIO])
    // «del edificio», no «de la parcela»: es el único dato con el que el usuario puede
    // saber qué le van a devolver.
    expect(m.avisos().join('\n')).toMatch(/del edificio/)
    m.desmontar()
  })

  it('⭐ con las DOS, el aviso enumera las dos', async () => {
    const m = await montar({
      bd: await conBorradores({ parcela: true, edificio: true }),
      conRama: true,
      edificio: null,
    })
    expect(m.cableado.estado().ramasOfrecidas).toEqual([
      TIPO_EXPEDIENTE.PARCELA,
      TIPO_EXPEDIENTE.EDIFICIO,
    ])
    const dicho = m.avisos().join('\n')
    expect(dicho).toMatch(/de la parcela/)
    expect(dicho).toMatch(/y del edificio/)
    m.desmontar()
  })

  it('⭐ «Recuperar» abre las DOS ramas: son las dos mitades de una pantalla', async () => {
    const m = await montar({
      bd: await conBorradores({ parcela: true, edificio: true }),
      conRama: true,
      edificio: null,
    })
    await abrir(m)
    pulsar(`${SELECTOR.BORRADOR} [data-accion="recuperar-borrador"]`)
    await reposar()

    expect(m.estadoEdificio.get().idLocal).toBe('de-ayer.dxf')
    expect(m.estado.get().refcat).toBe(REFCAT_DEMO)
    m.desmontar()
  })

  it('⭐ y «Descartar» se lleva las dos: la oferta es una y el gesto es uno', async () => {
    const m = await montar({
      bd: await conBorradores({ parcela: true, edificio: true }),
      conRama: true,
      edificio: null,
    })
    await abrir(m)
    pulsar(`${SELECTOR.BORRADOR} [data-accion="descartar-borrador"]`)
    await reposar()

    expect((await m.expedientes.listar()).borradores).toEqual([])
    expect(m.cableado.estado().ofreciendoBorrador).toBe(false)
    m.desmontar()
  })

  it('⛔ recuperar el borrador conserva su `creado`: no lo toma por un documento nuevo', async () => {
    // `cargarEdificio` fija la identidad y DESPUÉS hace `set`, que notifica de forma
    // síncrona. Si no moviera también `idLocalAbierto`, nuestro propio suscriptor
    // tomaría este documento recién abierto por «otro» y le tiraría el `creado` que se
    // le acaba de poner — el trabajo recuperado diría haber empezado ahora mismo.
    const m = await montar({
      bd: await conBorradores({ edificio: true }),
      conRama: true,
      edificio: null,
    })
    m.avanzar(3 * 86_400_000) // tres días después de sembrarlo
    await abrir(m)
    pulsar(`${SELECTOR.BORRADOR} [data-accion="recuperar-borrador"]`)
    await reposar()

    expect(m.cableado.estado().rama).toBe(RAMA.EDIFICIO)
    expect(m.cableado.estado().creado).toBe(CREADO_DE_AYER)
    m.desmontar()
  })

  it('recuperar un borrador de edificio deja la pantalla EN su rama', async () => {
    const m = await montar({
      bd: await conBorradores({ edificio: true }),
      conRama: true,
      edificio: null,
    })
    expect(m.rama.get()).toBe(RAMA.PARCELA)
    await abrir(m)
    pulsar(`${SELECTOR.BORRADOR} [data-accion="recuperar-borrador"]`)
    await reposar()
    expect(m.rama.get()).toBe(RAMA.EDIFICIO)
    m.desmontar()
  })

  it('⛔ sin rama de edificio montada, un borrador de edificio se dice y no se abre', async () => {
    // El montaje de F10: no hay dónde ponerlo. Abrirlo en un store que nadie mira
    // sería un «recuperado» que no cambia nada en pantalla.
    const m = await montar({ bd: await conBorradores({ edificio: true }) })
    await abrir(m)
    pulsar(`${SELECTOR.BORRADOR} [data-accion="recuperar-borrador"]`)
    await reposar()
    expect(m.renglon()).toBe(MENSAJE_GUARDADO_SIN_EDIFICIO)
    m.desmontar()
  })
})

describe('F11 · T3.3 · 14 · (c) `abrirProyecto` conmuta la rama', () => {
  /** Un `.json` de edificio, escrito por la propia aplicación. Ida y vuelta de verdad. */
  async function jsonDeEdificio(m) {
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()
    const texto = await m.url.blobs.at(-1).text()
    m.url.blobs.length = 0
    return texto
  }

  it('⛔ un `.json` con un expediente de EDIFICIO CONMUTA la rama y entra en SU store', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    const texto = await jsonDeEdificio(m)

    // Se vuelve a la rama de parcela y se vacía el store de edificio: si `abrirProyecto`
    // no conmutara, todo lo de abajo saldría igual de vacío.
    m.rama.set(RAMA.PARCELA)
    m.estadoEdificio.set(null)
    await reposar()
    expect(m.rama.get()).toBe(RAMA.PARCELA)

    await m.cableado.abrirProyecto(ficheroDeTexto('proyecto.json', texto))
    await reposar()

    expect(m.rama.get()).toBe(RAMA.EDIFICIO)
    expect(m.estadoEdificio.get().partes).toHaveLength(2)
    // Y NO se ha metido un edificio en el store de la parcela.
    expect(m.estado.get().refcat).toBe(REFCAT_DEMO)
    expect(m.estado.get().partes).toBeUndefined()
    m.desmontar()
  })

  it('…y lo cuenta por el panel, diciendo ya que no se va a poder ARCHIVAR', async () => {
    // ⛔ F12 · T4.3 · antes exigía «no lo puede guardar en este navegador», y eso dejó
    // de ser cierto en esta misma fase: el edificio se autoguarda. Lo que se sigue
    // diciendo —y lo que esta prueba defiende ahora— es que no se archiva con nombre.
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    const texto = await jsonDeEdificio(m)
    m.rama.set(RAMA.PARCELA)
    await reposar()

    await m.cableado.abrirProyecto(ficheroDeTexto('proyecto.json', texto))
    await reposar()

    const dicho = m.avisos().join('\n')
    expect(dicho).toMatch(/rama Edificio/)
    expect(dicho).toMatch(/no .*archiva con nombre/i)
    // Y no vuelve a decir lo caducado: que una recarga se lo llevaría.
    expect(dicho).not.toMatch(/no lo puede guardar en este navegador/i)
    m.desmontar()
  })

  it('⭐ y un `.json` de PARCELA abierto desde la rama EDIFICIO conmuta al revés', async () => {
    const m = await montar({ conRama: true, edificio: edificioDemo() })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()
    const texto = await m.url.blobs.at(-1).text()

    m.rama.set(RAMA.EDIFICIO)
    await reposar()

    await m.cableado.abrirProyecto(ficheroDeTexto('proyecto.json', texto))
    await reposar()

    expect(m.rama.get()).toBe(RAMA.PARCELA)
    expect(m.estado.get().refcat).toBe(REFCAT_DEMO)
    m.desmontar()
  })

  it('sin rama montada, un `.json` de edificio lo DICE y no toca nada', async () => {
    // Es el montaje de F10 entero: `rama: null` y `estadoEdificio: null`.
    const conRama = await montar({
      conRama: true,
      ramaInicial: RAMA.EDIFICIO,
      edificio: edificioDemo(),
    })
    const texto = await jsonDeEdificio(conRama)
    conRama.desmontar()

    document.body.innerHTML = CUERPO_INDEX
    document.body.className = ''
    const m = await montar()
    await m.cableado.abrirProyecto(ficheroDeTexto('proyecto.json', texto))
    await reposar()

    expect(m.avisos().join('\n')).toContain(MENSAJE_SIN_RAMA_EDIFICIO)
    expect(m.estado.get().refcat).toBe(REFCAT_DEMO)
    m.cableado.destruir()
  })

  it('un `.json` que dice ser de EDIFICIO y no trae edificio se cuenta, sin reventar', async () => {
    const m = await montar({ conRama: true, edificio: edificioDemo() })
    const sobre = {
      formato: 'concreta-gml/proyecto',
      version: 1,
      generado: '2026-08-03T09:00:00.000Z',
      nombre: 'roto',
      expediente: { tipo: 'EDIFICIO', srs: SRS, metadatos: {}, parcela: null, edificio: null },
    }
    await expect(
      m.cableado.abrirProyecto(ficheroDeTexto('roto.json', JSON.stringify(sobre))),
    ).resolves.toBeUndefined()

    expect(m.avisos().join('\n')).toContain(MENSAJE_GUARDADO_SIN_EDIFICIO)
    expect(m.rama.get()).toBe(RAMA.PARCELA)
    m.desmontar()
  })
})

describe('F11 · T3.3 · 15 · higiene de la rama', () => {
  it('`rama` que no es un conmutador revienta AL CABLEAR, nombrando lo que se espera', async () => {
    const apertura = await baseNueva()
    const panel = panelDePrueba()
    const base = {
      estado: crearEstadoVista(parcelaDemo()),
      panel,
      srs: SRS,
      expedientes: crearExpedientes({ bd: apertura }),
      cuota: { pedirPersistencia: async () => ({ ok: true, persistido: true }) },
    }
    expect(() => cablearExpediente({ ...base, rama: 'EDIFICIO' })).toThrow(/rama/)
    expect(() => cablearExpediente({ ...base, estadoEdificio: {} })).toThrow(/estadoEdificio/)
  })

  it('⭐ `destruir()` da de BAJA la suscripción a la rama (medido con la baja, no con la bandera)', async () => {
    // ⛔ Lección de T2.4: dos de sus ocho guardianes salieron VERDES con la mutación
    // puesta, porque los manejadores empiezan por `if (destruido) return` y la prueba
    // medía la bandera. Aquí se mide **la llamada a la baja**, que es lo único que
    // quitar `bajaRama()` de `destruir()` no puede fingir.
    const doble = ramaDeMentira()
    const apertura = await baseNueva()
    const panel = panelDePrueba()
    const cableado = cablearExpediente({
      estado: crearEstadoVista(parcelaDemo()),
      panel,
      srs: SRS,
      expedientes: crearExpedientes({ bd: apertura }),
      cuota: { pedirPersistencia: async () => ({ ok: true, persistido: true }) },
      rama: doble,
      estadoEdificio: crearEstadoVista(null),
    })
    await reposar()

    expect(doble.bajas).toHaveLength(1)
    expect(doble.cuantosSuscriptores()).toBe(1)

    cableado.destruir()
    expect(doble.bajas[0]).toHaveBeenCalledTimes(1)
    expect(doble.cuantosSuscriptores()).toBe(0)
    expect(() => cableado.destruir()).not.toThrow()
  })

  it('sin `rama` cableada la respuesta es PARCELA: F10 se comporta exactamente igual', async () => {
    const m = await montar()
    expect(m.cableado.estado().rama).toBe(RAMA.PARCELA)
    expect(m.cableado.estado().puedeGuardar).toBe(true)
    expect(m.cableado.expedienteActual().tipo).toBe('PARCELA')
    m.cableado.destruir()
  })

  it('la fotografía de estado dice la rama y si se puede guardar', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    expect(m.cableado.estado().rama).toBe(RAMA.EDIFICIO)
    expect(m.cableado.estado().puedeGuardar).toBe(false)
    m.rama.set(RAMA.PARCELA)
    expect(m.cableado.estado().rama).toBe(RAMA.PARCELA)
    expect(m.cableado.estado().puedeGuardar).toBe(true)
    m.desmontar()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Rework de UI · T7 · la rama que se queda FUERA, dicha
//
// Hallazgo A2 de la revisión de ingeniería: `expedienteActual()` deriva la rama
// activa y **descarta la otra en silencio**. La semántica NO se cambia —la
// exclusividad es de `model/parcela.js` y está ahí por un motivo—, así que lo que
// estas pruebas miden no es que se guarde otra cosa: es que **se diga**.
//
// Con anti-vacuidad por los dos lados, que es lo que hace que digan algo: que salga
// cuando hay que decirlo Y que NO salga cuando no. Un aviso que sale siempre no
// informa de nada, y encima cuesta una tarjeta en el panel, que es justo el sitio
// que este rework está intentando desatascar.
// ══════════════════════════════════════════════════════════════════════════════

describe('Rework de UI · T7 · 16 · qué rama se guarda y cuál NO va en el fichero', () => {
  it('⛔ «Guardar» con un edificio cargado lo DICE: por el renglón y por el panel', async () => {
    const m = await montar({ conRama: true, edificio: edificioDemo() })
    await abrir(m)
    escribirNombre('Solo la parcela')
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    const esperado = mensajeEdificioFuera(DOCUMENTO.GUARDADO)
    expect(m.renglon()).toContain(esperado)
    // Y al panel también: el renglón se lo lleva el siguiente `fijar`, y esto hay que
    // poder releerlo con el diálogo ya cerrado.
    expect(m.avisos().join('\n')).toContain(esperado)
    // El acuse de siempre no se ha perdido por el camino.
    expect(m.renglon()).toContain('Solo la parcela')
    m.desmontar()
  })

  it('⭐ y el mensaje no miente: el registro guardado de verdad NO lleva el edificio', async () => {
    // Anti-vacuidad dura. Sin esta prueba, la de arriba mide un texto bonito y no que
    // ese texto sea VERDAD — que es la única razón por la que vale la pena escribirlo.
    const m = await montar({ conRama: true, edificio: edificioDemo() })
    await abrir(m)
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    const { registros } = await m.expedientes.listar()
    const r = await m.expedientes.recuperar(registros[0].id)
    expect(r.expediente.tipo).toBe('PARCELA')
    expect(r.expediente.edificio).toBeNull()
    // …con el edificio bien vivo en el otro store mientras tanto: se ha quedado fuera
    // del fichero, no de la sesión, y eso es exactamente lo que el texto promete.
    expect(m.estadoEdificio.get().partes).toHaveLength(2)
    m.desmontar()
  })

  it('…y SIN edificio cargado el acuse es el de F10, sin una palabra de más', async () => {
    const m = await montar({ conRama: true, edificio: null })
    await abrir(m)
    pulsar(SELECTOR.GUARDAR)
    await reposar()

    expect(m.renglon()).toContain('en este navegador.')
    for (const t of TEXTOS_T7) expect(m.renglon()).not.toContain(t)
    for (const t of TEXTOS_T7) expect(m.avisos().join('\n')).not.toContain(t)
    m.desmontar()
  })

  it('sin rama cableada (F10 puro) no aparece ninguno de los tres textos', async () => {
    const m = await montar()
    await abrir(m)
    pulsar(SELECTOR.GUARDAR)
    await reposar()
    for (const t of TEXTOS_T7) expect(m.renglon()).not.toContain(t)
    m.cableado.destruir()
  })

  it('⛔ el `.json` de un edificio dice que la parcela de debajo va solo como CONTEXTO', async () => {
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()

    const esperado = mensajeParcelaDeContexto(DOCUMENTO.PROYECTO)
    expect(m.renglon()).toContain(esperado)
    expect(m.avisos().join('\n')).toContain(esperado)
    // Y NO el del caso peor: son dos situaciones distintas y el texto las distingue.
    expect(m.renglon()).not.toContain(mensajeParcelaFuera(DOCUMENTO.PROYECTO))
    m.desmontar()
  })

  it('⭐ la promesa de ese texto se MIDE: al reabrir el fichero la parcela no vuelve al panel', async () => {
    // El mensaje afirma dos cosas comprobables —que la parcela viaja recortada y que al
    // reabrir no aparece en el panel de parcela—, y las dos se miden aquí. Un mensaje
    // que promete de más es peor que el silencio que viene a arreglar.
    const m = await montar({ conRama: true, ramaInicial: RAMA.EDIFICIO, edificio: edificioDemo() })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()

    const texto = await m.url.blobs[0].text()
    const leido = deProyecto(texto)
    // Dentro del fichero SÍ está, como contexto y solo con los recintos.
    expect(leido.expediente.edificio.parcelaContexto).toEqual(parcelaDemo().recintos)
    expect(leido.expediente.parcela).toBeNull()

    // Una parcela distinguible en el store, para poder ver si la trae o si la pisa.
    m.estado.set(parcelaDemoConHueco())
    await reposar()
    await m.cableado.abrirProyecto(ficheroDeTexto('vuelta.json', texto))
    await reposar()

    expect(m.cargadas).toHaveLength(0)
    expect(m.estado.get().recintos).toEqual(parcelaDemoConHueco().recintos)
    // Se ha quedado donde el mensaje dice que se queda: dentro del edificio.
    expect(m.estadoEdificio.get().parcelaContexto).toEqual(parcelaDemo().recintos)
    m.desmontar()
  })

  it('⛔ con un edificio que YA traía contexto propio, el texto es el OTRO: la parcela no viaja', async () => {
    const propio = [{ tipo: 'EXTERIOR', vertices: [[1, 1], [2, 1], [2, 2]] }]
    const m = await montar({
      conRama: true,
      ramaInicial: RAMA.EDIFICIO,
      edificio: edificioDemo({ parcelaContexto: propio }),
    })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()

    expect(m.renglon()).toContain(mensajeParcelaFuera(DOCUMENTO.PROYECTO))
    expect(m.renglon()).not.toContain(mensajeParcelaDeContexto(DOCUMENTO.PROYECTO))
    // Medido en el fichero, no solo en el texto: lo que viaja es el contexto propio.
    const leido = deProyecto(await m.url.blobs[0].text())
    expect(leido.expediente.edificio.parcelaContexto).toEqual(propio)
    expect(leido.expediente.edificio.parcelaContexto).not.toEqual(parcelaDemo().recintos)
    m.desmontar()
  })

  it('…y sin parcela debajo, el `.json` del edificio no dice nada de más', async () => {
    const m = await montar({
      conRama: true,
      ramaInicial: RAMA.EDIFICIO,
      edificio: edificioDemo(),
      parcela: null,
    })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()

    expect(m.renglon()).toContain('Descargado el fichero de proyecto')
    for (const t of TEXTOS_T7) expect(m.renglon()).not.toContain(t)
    m.desmontar()
  })

  it('⭐ un fichero que NO ha bajado no arrastra la coletilla de lo que no lleva', async () => {
    // Contarle a alguien qué no lleva un fichero que no existe es ruido encima de un
    // fallo. Un `url` sin `createObjectURL` hace que `descargarTexto` salga por
    // «este entorno no implementa…», que es la única rama de fallo provocable aquí.
    const m = await montar({
      conRama: true,
      ramaInicial: RAMA.EDIFICIO,
      edificio: edificioDemo(),
      url: {},
    })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_PROYECTO)
    await reposar()

    expect(m.renglon()).toMatch(/no se ha descargado/i)
    for (const t of TEXTOS_T7) expect(m.renglon()).not.toContain(t)
    for (const t of TEXTOS_T7) expect(m.avisos().join('\n')).not.toContain(t)
    m.desmontar()
  })

  it('el DXF y el listado quedan fuera de T7 a propósito: no descartan ninguna rama', async () => {
    const m = await montar({ conRama: true, edificio: edificioDemo() })
    await abrir(m)
    pulsar(SELECTOR.EXPORTAR_DXF)
    await reposar()
    for (const t of TEXTOS_T7) expect(m.renglon()).not.toContain(t)

    pulsar(SELECTOR.EXPORTAR_COORDENADAS)
    await reposar()
    for (const t of TEXTOS_T7) expect(m.renglon()).not.toContain(t)
    m.desmontar()
  })

  it('los tres textos nombran su documento, dicen la salida que lo conserva y no se repiten', async () => {
    expect(mensajeEdificioFuera(DOCUMENTO.GUARDADO)).toContain(DOCUMENTO.GUARDADO)
    expect(mensajeEdificioFuera(DOCUMENTO.PROYECTO)).toContain(DOCUMENTO.PROYECTO)
    // Tres textos × dos documentos, y las seis cadenas distintas: si dos coincidieran,
    // el acuse estaría mandando al usuario a buscar donde no hay nada.
    expect(new Set(TEXTOS_T7).size).toBe(6)
    // Ninguno se queda en el diagnóstico: los tres dicen a qué rama ir y qué pulsar.
    for (const t of TEXTOS_T7) expect(t).toMatch(/rama (Parcela|Edificio)/)
    for (const t of TEXTOS_T7) expect(t).toMatch(/fichero de proyecto|\.json/)
  })
})
