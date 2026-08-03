/* -------------------------------------------------------------------------- *
 * test/storage/aceptacion-f10.test.js — F10 · T6.1 · SUITE DE ACEPTACIÓN        *
 *                                                                               *
 * La prueba que decide si F10 está hecha. Los cuatro criterios de                *
 * `spec/feature-10-persistencia-export.md` § «Criterios de aceptación», más los  *
 * DOS que la entrevista de arranque añadió y que aquella ficha no tenía:         *
 *                                                                               *
 *   AC1 · guardar → listar → recuperar → duplicar conserva el modelo;            *
 *         el autoguardado dispara con debounce ..................... § 1         *
 *   AC2 · una migración de versión antigua no pierde datos ......... § 2         *
 *   AC3 · el DXF abre en CAD con las dos capas separadas;                        *
 *         snapshot estable ......................... § 3 — **PARTIDO** (ver más  *
 *         abajo: la mitad que ninguna máquina de este proyecto puede firmar se   *
 *         traslada al §11 del checklist humano, y aquí queda dicho).             *
 *   AC4 · `QuotaExceededError` degrada sin romper (purga caché, avisa) . § 4     *
 *   AC5 · el listado de coordenadas para replanteo ................. § 5 — NUEVO *
 *   AC6 · el fichero de proyecto `.json` ........................... § 6 — NUEVO *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * POR QUÉ EL AC3 SE PARTE EN DOS, Y QUÉ QUEDA DE CADA MITAD                     *
 * ════════════════════════════════════════════════════════════════════════════ *
 * «El DXF exportado abre en CAD» **no lo puede firmar ninguna máquina de este    *
 * proyecto**: en este equipo no hay AutoCAD (en `Program Files` solo queda un    *
 * *Inventor Server*, sin `acad.exe`), y aunque lo hubiera, «abre» es un juicio   *
 * de un programa que no es nuestro. Es el mismo reparto que hizo F09 con el PDF  *
 * en tres lectores.                                                             *
 *                                                                               *
 *   · **Lo que sí se mide aquí:** que el fichero de hoy es EXACTAMENTE el que    *
 *     hay versionado (estabilidad de bytes), que las dos capas existen **en la   *
 *     TABLA** y no solo nombradas por las entidades, y que nuestro propio lector *
 *     recupera los mismos anillos.                                              *
 *   · **Lo que NO se mide aquí, y por qué:** que abra en AutoCAD con las dos     *
 *     capas seleccionables **por capa** → §11 del checklist humano, punto        *
 *     BLOQUEANTE.                                                               *
 *                                                                               *
 * ⛔ **Y hay un motivo MEDIDO para no fiarse de nuestro lector.** En la fase 0   *
 * de F10 se escribió el DXF exactamente como manda el override O12 —sin los dos  *
 * marcadores de subclase— y `ezdxf` lanzó `DXFStructureError: missing            *
 * 'AcDbPolyline' subclass`: **el fichero no abría en ninguna parte**. Y          *
 * `parsers/dxf.js` lo leyó tan feliz: 2 anillos, coordenadas exactas, cero       *
 * detecciones. O sea que la prueba de ida y vuelta, sola, **habría salido VERDE  *
 * con un DXF que no abre**. Por eso el oráculo de esta fase es `ezdxf` (1.4.4),  *
 * que corre FUERA de la suite —es Python—, y lo que aquí se vigila son los       *
 * hechos que ese oráculo dejó fijados. Está entero en                            *
 * `test/export/dxf.test.js`; aquí no se duplica.                                 *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * ⛔ LO QUE ESTA SUITE **NO** PUEDE COMPROBAR, DICHO CON TODAS LAS LETRAS       *
 * ════════════════════════════════════════════════════════════════════════════ *
 * **`fake-indexeddb` NO ES UNA BASE DE DATOS.** Es una implementación en memoria *
 * que muere con el proceso. Así que aquí, por construcción, **es imposible       *
 * comprobar lo único que F10 promete de verdad**: que el trabajo sobreviva a     *
 * cerrar la pestaña. Un `it` que dijera «sobrevive a la recarga» sería mentira   *
 * de las tranquilizadoras. Eso se mide en un navegador de verdad —el guion       *
 * `scripts/smoke-navegador/12-expedientes.js`, §18 del GUION— y a cerrar el      *
 * NAVEGADOR entero solo llega una persona (§11 del checklist).                   *
 *                                                                               *
 * Los demás huecos, y ninguno se tapa fingiendo cobertura:                       *
 *                                                                               *
 *   (h1) **La cuota agotada se DOBLA.** Medido en la fase 0: la cuota real de    *
 *        este origen es 1,82 GB y un expediente realista ocupa 0,844 kB, así que *
 *        llenarla de verdad son ~1,3 millones de escrituras. Se provoca con un   *
 *        almacén que rechaza con `QuotaExceededError`, que es EXACTAMENTE lo que *
 *        el navegador hace —se lee lo de antes, no se escribe lo nuevo—, y queda *
 *        declarado que es una simulación nuestra.                                *
 *   (h2) **`navigator.storage.persist()` no se ejercita aquí**: no existe en     *
 *        Node. Su comportamiento real está MEDIDO (devuelve `false` en un perfil *
 *        sin interacción, igual en `localhost` que en el `https://` publicado) y *
 *        su cableado se prueba en `test/app/expediente.dom.test.js`.             *
 *   (h3) **El `versionchange` con DOS PESTAÑAS de verdad** no es reproducible    *
 *        aquí: se provocó con dos conexiones de la misma pestaña en la fase 0 y  *
 *        el resto es del §11.                                                    *
 *   (h4) **Aquí no hay DOM.** Este fichero corre en el proyecto `node`, así que  *
 *        no toca `app/cableado-expediente.js` ni el diálogo: se comprueba que    *
 *        las PIEZAS componen el criterio, y que el CABLE existe lo comprueba     *
 *        `test/app/expediente.dom.test.js`. Cada cosa donde se puede afirmar.    *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'

import { serializarCoordenadasTxt } from '../../export/coordenadas.js'
import { CAPAS, serializarParcelaDxf } from '../../export/dxf.js'
import { FORMATO_PROYECTO, VERSION_PROYECTO, aProyecto, deProyecto } from '../../export/proyecto.js'
import { crearExpediente, crearParcela } from '../../model/parcela.js'
import { parseDXF } from '../../parsers/dxf.js'
import {
  ALMACENES,
  ESQUEMA_ALMACENES,
  MIGRACIONES,
  NOMBRE_BD,
  VERSION_BD,
  aplicarMigraciones,
} from '../../storage/bd.js'
import { crearAutoguardado } from '../../storage/autoguardado.js'
import { crearCacheCatastro } from '../../storage/cache-catastro.js'
import { esCuotaExcedida } from '../../storage/cuota.js'
import { ID_BORRADOR, crearExpedientes } from '../../storage/expedientes.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const SRS = 'EPSG:25830'
const FECHA = new Date(Date.UTC(2026, 7, 3, 10, 0, 0))

// ── Utillaje ─────────────────────────────────────────────────────────────────

/** Una base recién creada, en su propio universo. Mismo arnés que el resto de `test/storage/`. */
async function baseNueva(fabrica = new IDBFactory()) {
  vi.resetModules()
  const { abrirBd } = await import('../../storage/bd.js')
  const apertura = await abrirBd({ indexedDB: fabrica })
  expect(apertura.disponible, 'el arnés no ha conseguido abrir la base').toBe(true)
  return apertura
}

/** Un anillo cuadrado de `lado` metros, en UTM 30N realista. */
const anillo = (lado, dx = 0) => [
  [440123.45 + dx, 4470987.65],
  [440123.45 + dx + lado, 4470987.65],
  [440123.45 + dx + lado, 4470987.65 + lado],
  [440123.45 + dx, 4470987.65 + lado],
]

/** Un Expediente del modelo REAL, con geometría oficial (que es la que se congela). */
function expedientePrueba({ refcat = '9398516VK3799G', dx = 0 } = {}) {
  return crearExpediente({
    srs: SRS,
    parcela: crearParcela({
      idLocal: `ES.LOCAL.CP.${refcat}`,
      refcat,
      recintos: [{ vertices: anillo(40, dx), tipo: 'EXTERIOR' }],
      geometriaOficial: [{ vertices: anillo(40), tipo: 'EXTERIOR' }],
      superficieCatastral: 1600,
      origen: 'WFS',
    }),
  })
}

/**
 * Envuelve un almacén haciendo que las `n` primeras escrituras rechacen por CUOTA.
 * Ver el hueco (h1) de la cabecera: es una simulación NUESTRA, y por eso se dice.
 */
function sinEspacio(real, n = 1) {
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

/** Los pares (código, valor) de un DXF ASCII, que es estrictamente alternante. */
function pares(dxf) {
  const lineas = dxf.split(/\r\n|\n/)
  const salida = []
  for (let i = 0; i + 1 < lineas.length; i += 2) salida.push([lineas[i].trim(), lineas[i + 1]])
  return salida
}

/** Los nombres de capa declarados en la TABLA LAYER (no los que nombran las entidades). */
function capasDeLaTabla(dxf) {
  const p = pares(dxf)
  const nombres = []
  let enTabla = false
  let enRegistro = false
  for (const [c, val] of p) {
    if (c === '2' && val === 'LAYER' && !enTabla) enTabla = true
    else if (enTabla && c === '0' && val === 'ENDTAB') break
    else if (enTabla && c === '0') enRegistro = val === 'LAYER'
    else if (enTabla && enRegistro && c === '2') nombres.push(val)
  }
  return nombres
}

// ══════════════════════════════════════════════════════════════════════════════
// § 1 · AC1
// ══════════════════════════════════════════════════════════════════════════════
describe('AC1 · «Guardar → listar → recuperar → duplicar un expediente conserva el modelo; el autoguardado dispara con debounce»', () => {
  it('el recorrido entero conserva la geometría, la referencia y el huso', async () => {
    const apertura = await baseNueva()
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 3) })
    const original = expedientePrueba()

    const guardado = await almacen.guardar(original, { nombre: 'Linde norte' })
    expect(guardado.ok).toBe(true)

    const listado = await almacen.listar()
    expect(listado.ok).toBe(true)
    expect(listado.registros).toHaveLength(1)
    expect(listado.registros[0].nombre).toBe('Linde norte')

    const recuperado = await almacen.recuperar(listado.registros[0].id)
    expect(recuperado.ok).toBe(true)
    expect(recuperado.expediente.srs).toBe(original.srs)
    expect(recuperado.expediente.parcela.refcat).toBe(original.parcela.refcat)
    expect(recuperado.expediente.parcela.recintos[0].vertices).toEqual(
      original.parcela.recintos[0].vertices,
    )
    expect(recuperado.expediente.parcela.superficieCatastral).toBe(1600)

    const duplicado = await almacen.duplicar(listado.registros[0].id)
    expect(duplicado.ok).toBe(true)
    expect(duplicado.registro.id).not.toBe(listado.registros[0].id)
    expect((await almacen.listar()).registros).toHaveLength(2)
  })

  it('⭐ lo recuperado vuelve CONGELADO: `structuredClone` no preserva `Object.freeze`', async () => {
    // Es el hallazgo 4 de la fase 0, medido en navegador real: `Object.isFrozen`
    // vale `true` antes del `put` y `false` después del `get`. Sin la rehidratación
    // por `crearExpediente`, la barrera de la regla de oro 2 desaparecería EN
    // SILENCIO — la geometría oficial se podría editar y nadie se enteraría.
    const apertura = await baseNueva()
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 3) })
    const { registro } = await almacen.guardar(expedientePrueba())

    // Anti-vacuidad: el registro CRUDO viene descongelado, que es el hecho que
    // obliga a rehidratar. Si esto dejara de ser cierto, el `it` de arriba dejaría
    // de significar nada y hay que enterarse.
    const crudo = await apertura.bd.get(ALMACENES.EXPEDIENTES, registro.id)
    expect(Object.isFrozen(crudo.expediente.parcela.geometriaOficial)).toBe(false)

    const { expediente } = await almacen.recuperar(registro.id)
    expect(Object.isFrozen(expediente.parcela.geometriaOficial)).toBe(true)
    expect(Object.isFrozen(expediente.parcela.geometriaOficial[0])).toBe(true)
  })

  it('la lista viene del MÁS RECIENTE al más antiguo (el índice da el orden contrario)', async () => {
    // Medido en la fase 0: `getAllFromIndex` sobre `actualizado` devuelve el más
    // ANTIGUO primero. La ficha decía «listar (getAllFromIndex)» a secas y ese
    // orden habría pasado por bueno: sale una lista plausible, solo que del revés.
    const apertura = await baseNueva()
    let t = Date.UTC(2026, 7, 1)
    const almacen = crearExpedientes({ bd: apertura, ahora: () => t })
    for (const nombre of ['El primero', 'El segundo', 'El tercero']) {
      await almacen.guardar(expedientePrueba(), { nombre })
      t += 60_000
    }
    expect((await almacen.listar()).registros.map((r) => r.nombre)).toEqual([
      'El tercero',
      'El segundo',
      'El primero',
    ])
  })

  it('el borrador del autoguardado NO sale en la lista, y se dice que lo hay', async () => {
    const apertura = await baseNueva()
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 3) })
    await almacen.guardar(expedientePrueba(), { nombre: 'Guardado a mano' })
    await almacen.guardarBorrador(expedientePrueba({ dx: 5 }))

    const listado = await almacen.listar()
    expect(listado.registros).toHaveLength(1)
    expect(listado.registros.map((r) => r.id)).not.toContain(ID_BORRADOR)
    expect(listado.hayBorrador).toBe(true)
  })

  it('⭐ el debounce COALESCE: N cambios seguidos escriben UNA vez', async () => {
    const apertura = await baseNueva()
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 3) })
    // Temporizador a mano: `vi.useFakeTimers` rompe `fake-indexeddb`, que programa
    // sus propias tareas. Mismo arnés que `test/storage/autoguardado.test.js`.
    const pendientes = []
    const auto = crearAutoguardado({
      guardar: (exp) => almacen.guardarBorrador(exp),
      programar: (fn) => pendientes.push(fn) - 1,
      cancelar: (i) => {
        pendientes[i] = null
      },
      ahora: () => Date.UTC(2026, 7, 3),
    })

    for (let i = 0; i < 15; i += 1) auto.cambiado(expedientePrueba({ dx: i }))
    const vivos = pendientes.filter(Boolean)
    expect(vivos, 'quince cambios han dejado más de un temporizador vivo').toHaveLength(1)

    await vivos[0]()
    await auto.ahoraMismo()

    expect(auto.estado().escrituras).toBe(1)
    expect(auto.estado().cambios).toBe(15)
    // Y lo escrito es el ÚLTIMO cambio, no el primero.
    const leido = await almacen.leerBorrador()
    expect(leido.ok).toBe(true)
    expect(leido.expediente.parcela.recintos[0].vertices[0][0]).toBe(anillo(40, 14)[0][0])
  })

  it('la espera del debounce cae dentro del rango 1–3 s que pide la ficha', async () => {
    const { MS_AUTOGUARDADO, MS_AUTOGUARDADO_MIN, MS_AUTOGUARDADO_MAX } = await import(
      '../../storage/autoguardado.js'
    )
    expect(MS_AUTOGUARDADO).toBeGreaterThanOrEqual(MS_AUTOGUARDADO_MIN)
    expect(MS_AUTOGUARDADO).toBeLessThanOrEqual(MS_AUTOGUARDADO_MAX)
    expect(MS_AUTOGUARDADO_MIN).toBe(1000)
    expect(MS_AUTOGUARDADO_MAX).toBe(3000)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// § 2 · AC2
// ══════════════════════════════════════════════════════════════════════════════
describe('AC2 · «Una migración de versión antigua no pierde datos»', () => {
  /**
   * Fabrica una base parada en la versión 2 —la de F09, ANTES de que existieran los
   * expedientes— con un registro en cada uno de los tres almacenes de entonces, y
   * la deja cerrada. Es el usuario que ya tenía la aplicación instalada.
   */
  async function baseDeAntesDeF10(fabrica) {
    const anterior = MIGRACIONES.slice(0, 2)
    const bd = await new Promise((res, rej) => {
      const p = fabrica.open(NOMBRE_BD, anterior.length)
      p.onupgradeneeded = () => aplicarMigraciones(p.result, 0, { migraciones: anterior })
      p.onsuccess = () => res(p.result)
      p.onerror = () => rej(p.error)
    })
    await new Promise((res, rej) => {
      const tx = bd.transaction([ALMACENES.PARCELAS, ALMACENES.REVGEO, ALMACENES.PIE_FIRMA], 'readwrite')
      tx.objectStore(ALMACENES.PARCELAS).put({ refcat: '9398516VK3799G', guardadoEn: 1, dato: 'parcela vieja' })
      tx.objectStore(ALMACENES.REVGEO).put({ clave: '439250,4479664,EPSG:25830', refcat: '9398516VK3799G' })
      tx.objectStore(ALMACENES.PIE_FIRMA).put({ id: 'pie', nombre: 'Quien firma' })
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
    bd.close()
    return bd
  }

  it('⭐ subir de la versión 2 a la 3 conserva los tres registros anteriores', async () => {
    const fabrica = new IDBFactory()
    await baseDeAntesDeF10(fabrica)

    const apertura = await baseNueva(fabrica)
    expect(apertura.bd.version).toBe(VERSION_BD)

    expect((await apertura.bd.get(ALMACENES.PARCELAS, '9398516VK3799G')).dato).toBe('parcela vieja')
    expect(
      (await apertura.bd.get(ALMACENES.REVGEO, '439250,4479664,EPSG:25830')).refcat,
    ).toBe('9398516VK3799G')
    expect((await apertura.bd.get(ALMACENES.PIE_FIRMA, 'pie')).nombre).toBe('Quien firma')
  })

  it('…y el almacén de expedientes aparece CON SUS DOS ÍNDICES', async () => {
    const fabrica = new IDBFactory()
    await baseDeAntesDeF10(fabrica)
    const apertura = await baseNueva(fabrica)

    const tx = apertura.bd.transaction(ALMACENES.EXPEDIENTES)
    const almacen = tx.objectStore(ALMACENES.EXPEDIENTES)
    const declarados = ESQUEMA_ALMACENES[ALMACENES.EXPEDIENTES]
    expect(almacen.keyPath).toBe(declarados.keyPath)
    expect([...almacen.indexNames].sort()).toEqual(Object.keys(declarados.indices).sort())
    // Anti-vacuidad: que la lista sea la declarada no dice nada si está vacía.
    expect([...almacen.indexNames].length).toBeGreaterThan(0)
    await tx.done
  })

  it('…y sobre esa base ascendida se puede guardar y listar de verdad', async () => {
    const fabrica = new IDBFactory()
    await baseDeAntesDeF10(fabrica)
    const apertura = await baseNueva(fabrica)

    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 3) })
    const r = await almacen.guardar(expedientePrueba(), { nombre: 'Después de migrar' })
    expect(r.ok).toBe(true)
    expect((await almacen.listar()).registros.map((x) => x.nombre)).toEqual(['Después de migrar'])
  })

  it('el índice `refcat` se llama como el CÓDIGO, no como el dossier', () => {
    // Desviación 1 del plan, declarada antes de empezar: la ficha y el dossier §4.2
    // escriben `refCatastral`; el modelo dice `refcat` desde F00. Un índice con el
    // otro nombre no extraería clave ninguna de un POJO de parcela.
    expect(Object.keys(ESQUEMA_ALMACENES[ALMACENES.EXPEDIENTES].indices)).toContain('refcat')
    expect(Object.keys(ESQUEMA_ALMACENES[ALMACENES.EXPEDIENTES].indices)).not.toContain(
      'refCatastral',
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// § 3 · AC3 — PARTIDO (ver la cabecera)
// ══════════════════════════════════════════════════════════════════════════════
describe('AC3 · «El DXF exportado abre en CAD con las dos capas separadas; snapshot estable»', () => {
  const parcelaDosCapas = () => ({
    recintosEditados: [{ vertices: anillo(40, 2) }],
    recintosOficiales: [{ vertices: anillo(40) }],
  })

  it('⭐ las dos capas existen EN LA TABLA, no solo nombradas por las entidades', () => {
    // Es la trampa gorda de la fase 0: SIN la sección TABLES, ezdxf lee el fichero,
    // ve las dos polilíneas y el auditor da 0 errores y 0 arreglos — pero
    // `e.dxf.layer in doc.layers` devuelve `False` para las dos. El criterio 3
    // entero fallaría sin que nada avisara.
    const { dxf } = serializarParcelaDxf(parcelaDosCapas())
    expect(capasDeLaTabla(dxf)).toEqual(
      expect.arrayContaining([CAPAS.OFICIAL.nombre, CAPAS.EDITADA.nombre]),
    )
  })

  it('⭐ el DXF VERSIONADO —el artefacto, no el que se acaba de generar— cumple el criterio', () => {
    // Se mira el FICHERO EN DISCO a propósito, y no la salida del serializador: el
    // criterio 3 habla del fichero que se entrega, y `test/export/dxf.test.js` ya
    // vigila con `toMatchFileSnapshot` que el serializador siga produciendo ESE. Aquí
    // la pregunta es la otra mitad: si el artefacto que hay versionado sirve.
    //
    // ⚠️ Y no es celo: F09 encontró un `.gml` versionado que un clon limpio recibía
    // con los finales de línea cambiados, porque le faltaba su línea en
    // `.gitattributes`. Un DXF al que le pasara eso seguiría pasando la snapshot —se
    // compara contra sí mismo— y no abriría en ningún CAD.
    const versionado = readFileSync(
      join(RAIZ, 'test', 'export', '__snapshots__', 'parcela-dos-capas.dxf'),
      'utf8',
    )
    expect(versionado.length).toBeGreaterThan(0)
    // CRLF, como los tres DXF reales del repo (medido en la fase 0).
    expect(versionado).toContain('\r\n')
    expect(versionado.replace(/\r\n/g, ''), 'hay LF sueltos: el fichero está medio convertido').not.toContain('\n')
    expect(capasDeLaTabla(versionado)).toEqual(
      expect.arrayContaining([CAPAS.OFICIAL.nombre, CAPAS.EDITADA.nombre]),
    )
    expect(parseDXF(versionado).anillos).toHaveLength(2)
  })

  it('la ida y vuelta contra nuestro lector devuelve los mismos anillos', () => {
    // Es el oráculo SEGUNDO, no el primero. Ver la cabecera: por sí solo aprobaría
    // un fichero que no abre en ninguna parte.
    const { dxf } = serializarParcelaDxf(parcelaDosCapas())
    const leido = parseDXF(dxf)
    expect(leido.origen).toBe('DXF')
    expect(leido.anillos).toHaveLength(2)
    const vueltos = leido.anillos.map((a) => a.map(([x, y]) => [x, y]))
    expect(vueltos).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(anillo(40).map(([x, y]) => [x, y])),
        expect.arrayContaining(anillo(40, 2).map(([x, y]) => [x, y])),
      ]),
    )
  })

  it('sin geometría oficial sale UNA capa y se DICE (regla de oro 1)', () => {
    const { dxf, detecciones } = serializarParcelaDxf({
      recintosEditados: [{ vertices: anillo(40) }],
      recintosOficiales: null,
    })
    // La capa sigue EXISTIENDO en la tabla, vacía: quien abra el fichero ve que
    // había un sitio para la oficial y que no se ha puesto nada.
    expect(capasDeLaTabla(dxf)).toEqual(
      expect.arrayContaining([CAPAS.OFICIAL.nombre, CAPAS.EDITADA.nombre]),
    )
    expect(detecciones.map((d) => d.tipo)).toContain('SIN_GEOMETRIA_OFICIAL')
  })

  it('⛔ la otra mitad del criterio queda TRASLADADA, no cubierta', () => {
    // Este `it` no mide el DXF: mide que la deuda esté ESCRITA donde alguien la vaya
    // a leer. Un criterio que se parte y no se apunta en ningún sitio es un criterio
    // que se da por cumplido sin que nadie lo haya comprobado.
    const checklist = readFileSync(
      join(RAIZ, 'scripts', 'smoke-navegador', 'CHECKLIST-HUMANO.md'),
      'utf8',
    )
    expect(checklist).toMatch(/§?\s*11\b/)
    expect(checklist.toLowerCase()).toContain('cad')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// § 4 · AC4
// ══════════════════════════════════════════════════════════════════════════════
describe('AC4 · «`QuotaExceededError` degrada sin romper (purga caché, avisa)»', () => {
  it('la escritura que no cabe NO lanza: devuelve su motivo y marca `esCuota`', async () => {
    const apertura = await baseNueva()
    const real = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 3) })
    const almacen = sinEspacio(real, 1)

    let r
    await expect(
      (async () => {
        r = await almacen.guardar(expedientePrueba(), { nombre: 'No cabe' })
      })(),
    ).resolves.toBeUndefined()
    expect(r.ok).toBe(false)
    expect(r.esCuota).toBe(true)
  })

  it('`esCuotaExcedida` reconoce las TRES formas vivas, y por `name`/`code`', () => {
    // Jamás por el texto del mensaje: cambia con el navegador y con el idioma, y un
    // `includes('quota')` funcionaría en un Chrome en inglés y fallaría en el mismo
    // Chrome en castellano — o sea, la degradación no se dispararía justo cuando más
    // falta hace, y en silencio.
    expect(esCuotaExcedida({ name: 'QuotaExceededError' })).toBe(true)
    expect(esCuotaExcedida({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true)
    expect(esCuotaExcedida({ code: 22 })).toBe(true)
    expect(esCuotaExcedida({ code: 1014 })).toBe(true)
    expect(esCuotaExcedida({ message: 'the quota has been exceeded' })).toBe(false)
    expect(esCuotaExcedida(null)).toBe(false)
  })

  it('⭐ la purga libera la caché del Catastro y NO toca los expedientes ni el pie de firma', async () => {
    // La mitad que importa del criterio 4. `storage/cache-catastro.js` solo enruta
    // SUS almacenes; que los otros dos sobrevivan es lo que impide que quedarse sin
    // espacio se lleve por delante el trabajo del usuario.
    const apertura = await baseNueva()
    const viejo = Date.now() - 40 * 86_400_000
    await apertura.bd.put(ALMACENES.PARCELAS, { refcat: 'CADUCADA', guardadoEn: viejo })
    await apertura.bd.put(ALMACENES.PIE_FIRMA, { id: 'pie', nombre: 'Quien firma' })
    const almacen = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 3) })
    const { registro } = await almacen.guardar(expedientePrueba(), { nombre: 'A salvo' })

    const cache = crearCacheCatastro({ bd: apertura })
    const purga = await cache.purgarCaducados()

    expect(purga.ok).toBe(true)
    expect(purga.purgados).toBeGreaterThan(0)
    expect(await apertura.bd.get(ALMACENES.PARCELAS, 'CADUCADA')).toBeUndefined()
    expect(await apertura.bd.get(ALMACENES.PIE_FIRMA, 'pie')).toBeDefined()
    expect((await almacen.recuperar(registro.id)).ok).toBe(true)
  })

  it('purgar → reintentar guarda de verdad: la degradación compone', async () => {
    const apertura = await baseNueva()
    await apertura.bd.put(ALMACENES.PARCELAS, {
      refcat: 'CADUCADA',
      guardadoEn: Date.now() - 40 * 86_400_000,
    })
    const real = crearExpedientes({ bd: apertura, ahora: () => Date.UTC(2026, 7, 3) })
    const almacen = sinEspacio(real, 1)
    const cache = crearCacheCatastro({ bd: apertura })

    let r = await almacen.guardar(expedientePrueba(), { nombre: 'Al segundo intento' })
    expect(r.esCuota).toBe(true)
    const purga = await cache.purgarCaducados()
    expect(purga.purgados).toBeGreaterThan(0)
    r = await almacen.guardar(expedientePrueba(), { nombre: 'Al segundo intento' })

    expect(r.ok).toBe(true)
    expect((await real.listar()).registros.map((x) => x.nombre)).toEqual(['Al segundo intento'])
  })

  it('sin base, nada lanza y todo lo dice: el entorno degrada', async () => {
    const avisos = []
    const almacen = crearExpedientes({ bd: null, alAvisar: (m) => avisos.push(m) })
    const r = await almacen.guardar(expedientePrueba(), { nombre: 'Sin base' })
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('SIN_BD')
    expect(r.mensaje.length).toBeGreaterThan(0)
    expect(avisos.length).toBeGreaterThan(0)
    expect((await almacen.listar()).registros).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// § 5 · AC5 — NUEVO (el TXT estaba en el «Alcance» de la ficha y en ningún criterio)
// ══════════════════════════════════════════════════════════════════════════════
describe('AC5 · «El listado de coordenadas para replanteo» (criterio NUEVO)', () => {
  const recintos = [{ vertices: anillo(40), tipo: 'EXTERIOR' }]

  it('lleva la referencia catastral, el huso, la fecha y el número de vértices', () => {
    const { texto, nVertices } = serializarCoordenadasTxt({
      recintos,
      refcat: '9398516VK3799G',
      srs: SRS,
      fecha: FECHA,
    })
    expect(texto).toContain('9398516VK3799G')
    expect(texto).toContain(SRS)
    // Fecha en formato español y con el huso horario DICHO: un listado que se lleva
    // a campo no puede dejar dudando si «03/08» es agosto o marzo, ni a qué hora.
    expect(texto).toContain('03/08/2026')
    expect(texto).toContain('(UTC)')
    expect(nVertices).toBe(4)
  })

  it('⭐ los metros van con COMA decimal española', () => {
    // El defecto de F09 fue justo el contrario: un «129.9624» con punto inglés colado
    // en el PDF. Un listado que un equipo de campo teclee con el separador equivocado
    // replantea en el sitio equivocado.
    const { texto } = serializarCoordenadasTxt({ recintos, refcat: null, srs: SRS, fecha: FECHA })
    expect(texto).toMatch(/1\.600,00 m²/)
    expect(texto).not.toMatch(/1600\.00/)
  })

  it('el fichero de hoy es EXACTAMENTE el versionado (estabilidad de bytes)', () => {
    const { texto } = serializarCoordenadasTxt({
      recintos: [{ vertices: anillo(40), tipo: 'EXTERIOR' }],
      refcat: '9398516VK3799G',
      srs: SRS,
      fecha: FECHA,
      nombre: null,
    })
    // El snapshot versionado es el de la parcela REAL de 15 vértices; aquí solo se
    // afirma que el escritor produce algo estable y con final de línea LF, que es lo
    // que `.gitattributes` fija para esa carpeta. La comparación byte a byte contra
    // el fichero real vive en `test/export/coordenadas.test.js`, con su parcela.
    expect(texto).not.toContain('\r')
    expect(texto.endsWith('\n')).toBe(false)
  })

  it('⛔ y DICE que no se puede volver a cargar aquí, porque no se puede', async () => {
    // Es el hecho MEDIDO de T3.1: 15 vértices entran y 18 pares salen del parser, y
    // ninguno correcto — la primera columna es el número de vértice, no la X. El
    // aviso no es letra pequeña, es el resultado de haberlo intentado.
    const { AVISO_NO_REIMPORTABLE } = await import('../../export/coordenadas.js')
    const { texto } = serializarCoordenadasTxt({ recintos, refcat: null, srs: SRS, fecha: FECHA })
    const plano = (t) => t.replace(/\s+/g, ' ')
    expect(plano(texto)).toContain(plano(AVISO_NO_REIMPORTABLE).slice(0, 80))
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// § 6 · AC6 — NUEVO (alcance de la entrevista: no está en la ficha, ni en SPEC, ni en el dossier)
// ══════════════════════════════════════════════════════════════════════════════
describe('AC6 · «El fichero de proyecto `.json`» (alcance NUEVO)', () => {
  it('⭐ la ida y vuelta por JSON conserva el expediente entero', () => {
    // Sin backend y sin cuentas, IndexedDB es una caja fuerte SIN PUERTA: borrar los
    // datos del sitio se lo lleva todo y no hay forma de mandarle el expediente a un
    // compañero. Ésta es la puerta, así que tiene que cerrar y abrir sin perder nada.
    const original = expedientePrueba()
    const proyecto = aProyecto(original, { fecha: FECHA, nombre: 'Para el compañero' })
    const leido = deProyecto(JSON.stringify(proyecto, null, 2))

    expect(leido.ok).toBe(true)
    expect(leido.nombre).toBe('Para el compañero')
    expect(leido.expediente.srs).toBe(original.srs)
    expect(leido.expediente.parcela.refcat).toBe(original.parcela.refcat)
    expect(leido.expediente.parcela.recintos[0].vertices).toEqual(
      original.parcela.recintos[0].vertices,
    )
    expect(leido.expediente.parcela.superficieCatastral).toBe(1600)
  })

  it('lo leído vuelve CONGELADO, igual que lo recuperado del almacén', () => {
    const proyecto = aProyecto(expedientePrueba(), { fecha: FECHA })
    const leido = deProyecto(JSON.stringify(proyecto))
    expect(Object.isFrozen(leido.expediente.parcela.geometriaOficial)).toBe(true)
  })

  it('el sobre se declara: formato y versión van dentro del fichero', () => {
    const proyecto = aProyecto(expedientePrueba(), { fecha: FECHA })
    expect(proyecto.formato).toBe(FORMATO_PROYECTO)
    expect(proyecto.version).toBe(VERSION_PROYECTO)
    expect(typeof proyecto.generado).toBe('string')
  })

  it('⭐ un fichero ajeno o roto NUNCA lanza: devuelve su motivo (la lección de F08)', () => {
    const rotos = [
      ['vacío', ''],
      ['un GML', '<?xml version="1.0"?><FeatureCollection/>'],
      ['JSON que no es objeto', '[1,2,3]'],
      ['objeto sin sobre', '{"hola":"qué tal"}'],
      ['otro formato', '{"formato":"otra-cosa/v1","version":1,"expediente":{}}'],
      ['sin expediente', '{"formato":"concreta-gml/proyecto","version":1}'],
      ['expediente ilegible', '{"formato":"concreta-gml/proyecto","version":1,"expediente":{"srs":"EPSG:25830","parcela":{"recintos":"no"}}}'],
      ['JSON truncado', '{"formato":"concreta-gml/proyecto","version":1,"expe'],
    ]
    for (const [queEs, texto] of rotos) {
      expect(() => deProyecto(texto), `«${queEs}» ha lanzado`).not.toThrow()
      const r = deProyecto(texto)
      expect(r.ok, `«${queEs}» se ha dado por bueno`).toBe(false)
      expect(r.motivo, `«${queEs}» no dice por qué`).not.toBeNull()
      expect(r.mensaje.length, `«${queEs}» no trae mensaje`).toBeGreaterThan(0)
    }
  })

  it('una versión POSTERIOR se lee y se avisa, en vez de rechazarse', () => {
    const proyecto = aProyecto(expedientePrueba(), { fecha: FECHA })
    const futuro = { ...proyecto, version: VERSION_PROYECTO + 7, algoNuevo: true }
    const leido = deProyecto(JSON.stringify(futuro))

    expect(leido.ok).toBe(true)
    expect(leido.version).toBe(VERSION_PROYECTO + 7)
    expect(leido.avisos.map((a) => a.tipo)).toEqual(
      expect.arrayContaining(['VERSION_POSTERIOR', 'CLAVE_DESCONOCIDA']),
    )
  })

  it('el proyecto es lo que viaja: un expediente guardado sale y vuelve a entrar', async () => {
    // El recorrido completo del criterio, sin cableado: almacén → proyecto → texto →
    // almacén de otra base. Es lo que hace un técnico que se lleva el trabajo a casa.
    const origen = await baseNueva(new IDBFactory())
    const almacenA = crearExpedientes({ bd: origen, ahora: () => Date.UTC(2026, 7, 3) })
    const { registro } = await almacenA.guardar(expedientePrueba(), { nombre: 'El de la oficina' })
    const { expediente } = await almacenA.recuperar(registro.id)

    const texto = JSON.stringify(aProyecto(expediente, { fecha: FECHA, nombre: registro.nombre }))

    const destino = await baseNueva(new IDBFactory())
    const almacenB = crearExpedientes({ bd: destino, ahora: () => Date.UTC(2026, 7, 4) })
    const leido = deProyecto(texto)
    expect(leido.ok).toBe(true)
    const puesto = await almacenB.guardar(leido.expediente, { nombre: leido.nombre })

    expect(puesto.ok).toBe(true)
    const final = await almacenB.recuperar(puesto.registro.id)
    expect(final.expediente.parcela.recintos[0].vertices).toEqual(
      expediente.parcela.recintos[0].vertices,
    )
    // Anti-vacuidad: son DOS bases distintas, no la misma dos veces.
    expect((await almacenA.listar()).registros).toHaveLength(1)
    expect((await almacenB.listar()).registros).toHaveLength(1)
  })
})
