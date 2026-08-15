/* -------------------------------------------------------------------------- *
 * test/services/catastro.test.js — F05 · T2A. La PUERTA PÚBLICA del Catastro.  *
 *                                                                              *
 * Este fichero prueba el módulo que compone los otros tres, así que es el       *
 * primero de F05 que ve una consulta ENTERA: URL → transporte → cuerpo →        *
 * clasificación → resultado presentable. Y aun así **no toca la red ni una      *
 * vez**: el `fetch` entra doblado (`_doble-fetch.js`, de la tarea T1A) y las    *
 * respuestas son los ficheros reales de `test/fixtures/catastro/` y             *
 * `test/fixtures/gml/`, capturados con `curl` el 2026-07-27 y documentados con  *
 * su SHA-256 en `PROCEDENCIA.md`. La política de uso del Catastro sanciona el   *
 * uso automático con ~10 días de denegación (override O8): «probarlo contra el  *
 * servicio» no es una alternativa disponible, y por eso no la hay.              *
 *                                                                              *
 * ── CERO LISTAS ESCRITAS A MANO ─────────────────────────────────────────────  *
 * Ni una referencia catastral, ni una URL, ni un número de miembros, ni un      *
 * `numberMatched`, ni una coordenada. Todo se LEE del disco:                    *
 *   · las URL con las que se capturó cada fixture salen de `PROCEDENCIA.md`,    *
 *     que las documenta una a una, y son las que el doble de `fetch` reconoce:  *
 *     **si el cliente construye una URL que difiere en un byte de la medida,    *
 *     el doble contesta 404 y el test cae**;                                    *
 *   · la referencia buena sale del GML de la parcela; la inexistente, del       *
 *     parámetro `refcat` de la URL medida del `ExceptionReport`;                *
 *   · el punto de la geocodificación sale del `geo` del propio `ovc-rccoor-ok`; *
 *   · los conteos salen de contar `<member>` en el fichero con una RegExp que   *
 *     no comparte una línea con el módulo bajo prueba.                          *
 *                                                                              *
 * ── LAS TRAMPAS QUE ESTE FICHERO EXISTE PARA CLAVAR ─────────────────────────  *
 *   1. Se cuentan los `<member>`; los atributos de conteo MIENTEN (10 miembros, *
 *      539 declarados, las dos cifras leídas del mismo fichero).                *
 *   2. La propia parcela se separa por referencia catastral, NUNCA por          *
 *      posición: en el fixture de vecindad está la 2.ª de 5, y hay un test que  *
 *      lo afirma leyendo el orden del fichero para dejar escrito por qué un     *
 *      `parcelas[0]` estaría mal.                                              *
 *   3. «No hay parcela en esa caja» y «esa referencia no existe» llegan con el  *
 *      MISMO código: se comprueba que salen con el MISMO motivo, explícitamente,*
 *      para dejar escrito que no se distinguen.                                 *
 *   4. BBOX degenerado → `throw`; BBOX demasiado grande → estado. Dos fronteras *
 *      en la misma función, y las dos se prueban una al lado de la otra.        *
 *   5. El `cod:76` del OVC (una URL mal construida por NOSOTROS) sale como      *
 *      fallo técnico, jamás como «aquí no hay parcela».                         *
 *                                                                              *
 * ── EL GUARDIÁN DEL FINAL ───────────────────────────────────────────────────  *
 * El último test del fichero exige que **todo motivo de `MOTIVO_CATASTRO` se    *
 * haya producido de verdad** en algún caso de esta suite. Los resultados se     *
 * apuntan solos: el arnés envuelve el cliente y recoge cada `motivo` que sale.  *
 * Es el guardián que impide inventarse un `LIMITE_EXCEDIDO` o un `BLOQUEADO`    *
 * que nadie ha medido nunca — un motivo que ningún test puede provocar es un    *
 * motivo que nadie ha visto.                                                    *
 *                                                                              *
 * ── COMPROBADO POR MUTACIÓN (a mano, durante el desarrollo) ─────────────────  *
 * Se mutó `services/catastro.js`, se corrió la suite y se revirtió:             *
 *   (a) `separarPropia` devolviendo `parcelas[0]` y el resto (o sea, separando  *
 *       por POSICIÓN) → **3 rojos**; el de colindantes dice «expected           *
 *       '9398501VK3799G' to be '9398516VK3799G'» — la VECINA de la primera      *
 *       posición colada como si fuera la parcela del usuario.                   *
 *   (b) `nMiembros` tomado de `declarado.numberReturned` en vez de contado →    *
 *       **1 rojo**: «expected 539 to be 10», que es la mentira del servicio     *
 *       entrando en el resultado con dos órdenes de magnitud de error.          *
 *   (c) el tope de área comparado con `>=` en vez de con `>` → **1 rojo**; el   *
 *       caso anti-vacuidad (una caja de exactamente el máximo) dice «expected   *
 *       'BBOX_DEMASIADO_GRANDE' not to be 'BBOX_DEMASIADO_GRANDE'».             *
 *   (d) saltándose la consulta a la caché (ir siempre a la red) → **6 rojos**;  *
 *       el criterio 1 dice «expected 'RED' to be 'CACHE'» y el espía de `fetch` *
 *       deja de cuadrar en los dos sentidos («expected +0 to be 1»).            *
 *   (e) dejando que un fallo de ESCRITURA en la caché tumbara la consulta →     *
 *       **1 rojo**: la promesa RECHAZABA con «cuota de almacenamiento agotada»  *
 *       después de haber traído la parcela con éxito.                           *
 * Queda constancia porque un test que nunca se ha visto fallar no es una        *
 * garantía, es una esperanza.                                                   *
 *                                                                              *
 * ⚠️ ENCODING: los XML del Catastro declaran `ISO-8859-1` y sus bytes son       *
 * UTF-8 (mentira heredada del servicio, documentada en `PROCEDENCIA.md`). Se    *
 * leen SIEMPRE como UTF-8 ignorando la declaración.                             *
 *                                                                              *
 * Proyecto Vitest `node` (sin sufijo `.dom`): ni DOM, ni Leaflet, ni            *
 * IndexedDB — la caché entra por su puerto y su doble es un `Map`.              *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

import {
  CACHE_NULA,
  MAX_AREA_BBOX_M2,
  MOTIVO_CATASTRO,
  NIVEL_POR_MOTIVO,
  ORIGEN,
  SRS_DEFAULT,
  crearClienteCatastro,
  normalizarRefcat,
} from '../../services/catastro.js'
import {
  COUNT_BBOX_DEFECTO,
  TIPO_RESPUESTA_WFS,
  leerColeccion,
} from '../../services/_catastro-wfs.js'
import { TIPO_RCCOOR, leerRccoor } from '../../services/_catastro-ovc.js'
import { BACKOFF, crearTransporte } from '../../services/_red.js'
import { NIVEL } from '../../viewer/_comun.js'
import { HUSOS_VALIDOS, husoPorSrs, srsPorHuso } from '../../geo/huso.js'
import { crearDobleDormir, crearDobleFetch, errorDeRed } from './_doble-fetch.js'

// ── Los ficheros de verdad externa, leídos como UTF-8 ─────────────────────────

const DIR_CATASTRO = fileURLToPath(new URL('../fixtures/catastro/', import.meta.url))
const DIR_GML = fileURLToPath(new URL('../fixtures/gml/', import.meta.url))
const RUTA_MODULO = fileURLToPath(new URL('../../services/catastro.js', import.meta.url))

const leer = (dir, nombre) => readFileSync(`${dir}${nombre}`, 'utf8')

const PROCEDENCIA = leer(DIR_CATASTRO, 'PROCEDENCIA.md')
const EXC_RC_INEXISTENTE = leer(DIR_CATASTRO, 'wfs-exceptionreport-rc-inexistente.xml')
const EXC_BBOX_VACIO = leer(DIR_CATASTRO, 'wfs-bbox-vacio-mar.xml')
const BBOX_COUNT10 = leer(DIR_CATASTRO, 'wfs-bbox-count10.xml')
const VECINDAD = leer(DIR_CATASTRO, 'wfs-neighbour-9398516VK3799G.xml')
const CATALOGO_XML = leer(DIR_CATASTRO, 'wfs-describestoredqueries.xml')
const OVC_OK = leer(DIR_CATASTRO, 'ovc-rccoor-ok.json')
const OVC_COD16 = leer(DIR_CATASTRO, 'ovc-rccoor-cod16.json')
const OVC_COD76 = leer(DIR_CATASTRO, 'ovc-rccoor-cod76.json')

const GML_PARCELA = leer(DIR_GML, 'cp_parcela_9398516VK3799G.gml')
const GML_EDIFICIO = leer(DIR_GML, 'bu_building_9398516VK3799G.gml')

const FUENTE_MODULO = readFileSync(RUTA_MODULO, 'utf8')

/**
 * El módulo SIN sus comentarios. Hace falta para los guardianes de texto: la
 * cabecera del módulo CITA el texto que el servicio devuelve —incluida su errata
 * («No records *founded*»)— porque documentarlo es justo lo que impide que
 * alguien ramifique sobre él, y un guardián que mirase el fichero entero
 * confundiría la advertencia con la infracción. Se quitan los bloques de
 * comentario y las líneas que son ÍNTEGRAMENTE de comentario de línea; los
 * comentarios al final de una línea de código se quedan, y da igual: lo que se
 * busca no aparece en ninguno.
 */
// ⚠️ EL ORDEN DE LOS DOS PASOS IMPORTA, y no es el intuitivo: primero se quitan
// las líneas que son ÍNTEGRAMENTE comentario de línea, y SOLO DESPUÉS los bloques
// `/* */`. Al revés, un `//` que cite un glob del proyecto (`viewer/*`, `app/**`)
// mete una barra-asterisco que abre un bloque FALSO, y el borrado de bloques se
// traga el código que venga detrás hasta el siguiente `*/` — que puede estar cien
// líneas más abajo. El guardián seguiría verde mirando un fichero vacío.
// Descubierto en T5A: con el orden inverso, `storage/bd.js` se quedaba en NADA.
// Aquí hoy sería inocuo (este módulo no cita globs en comentarios de línea), y por
// eso se arregla ahora: una mina que solo explota cuando alguien añade un
// comentario inocente no es un riesgo que valga la pena conservar.
const CODIGO_MODULO = FUENTE_MODULO.split('\n')
  .filter((l) => !/^\s*\/\//.test(l))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')

// ── Oráculos independientes: RegExp sobre el TEXTO CRUDO ─────────────────────
// No se usa el lector XML del proyecto para sacar la verdad-terreno: sería el
// mismo código que está bajo prueba, una capa más abajo.

/** Cuántos `<member>` trae el documento. Es EL número: contar es contar. */
const miembrosDe = (texto) => (texto.match(/<member>/g) ?? []).length

/** Las referencias catastrales del documento, en ORDEN de aparición. */
const refcatsDe = (texto) => [
  ...texto.matchAll(/<cp:nationalCadastralReference>([^<]*)</g),
].map((m) => m[1])

/** Un atributo de la raíz WFS, tal cual lo declara el servicio. */
const atributoRaiz = (texto, nombre) => new RegExp(`${nombre}="([^"]*)"`).exec(texto)?.[1] ?? null

/**
 * La URL con la que se capturó un fixture, leída de SU ficha en `PROCEDENCIA.md`.
 * Es la petición REAL, la única comprobada contra el servicio: atar el doble de
 * `fetch` a ella es lo que convierte cada test en una comprobación de que el
 * cliente pide EXACTAMENTE lo que se midió.
 *
 * @param {string} fichero  Nombre del fixture, tal como titula su sección.
 * @returns {string}
 */
function urlMedida(fichero) {
  const lineas = PROCEDENCIA.split('\n')
  const inicio = lineas.findIndex((l) => l.startsWith('## ') && l.includes(fichero))
  if (inicio === -1) throw new Error(`PROCEDENCIA.md no documenta ${fichero}`)
  for (let i = inicio + 1; i < lineas.length && !lineas[i].startsWith('## '); i += 1) {
    const m = /^\|\s*URL\s*\|\s*`([^`]+)`\s*\|/.exec(lineas[i])
    if (m) return m[1]
  }
  throw new Error(`PROCEDENCIA.md no da la URL medida de ${fichero}`)
}

const URL_RC_INEXISTENTE = urlMedida('wfs-exceptionreport-rc-inexistente.xml')
const URL_VECINDAD = urlMedida('wfs-neighbour-9398516VK3799G.xml')
const URL_BBOX_COUNT10 = urlMedida('wfs-bbox-count10.xml')
const URL_BBOX_MAR = urlMedida('wfs-bbox-vacio-mar.xml')
const URL_OVC_OK = urlMedida('ovc-rccoor-ok.json')

/** Query string de una URL medida, como objeto plano. */
const parametros = (u) => Object.fromEntries(new URL(u).searchParams)

/** `'EPSG::25830'` (forma del WFS) → `'EPSG:25830'` (forma corta del modelo). */
const aFormaCorta = (srsPeticion) => srsPeticion.replace('::', ':')

/** `'439000,4479400,439600,4480000,EPSG::25830'` → `{bbox, srs}`. */
function desmontarBbox(valor) {
  const trozos = valor.split(',')
  const [minX, minY, maxX, maxY] = trozos.slice(0, 4).map(Number)
  return { bbox: { minX, minY, maxX, maxY }, srs: aFormaCorta(trozos[4]) }
}

// ── Los datos del caso, DERIVADOS de los ficheros ────────────────────────────

/** La referencia catastral buena: la del GML real de la parcela. */
const RC_BUENA = refcatsDe(GML_PARCELA)[0]

/** La inexistente: la que se pidió para capturar el `ExceptionReport`. */
const RC_INEXISTENTE = parametros(URL_RC_INEXISTENTE).refcat

/** El SRS con el que se midió todo, en forma corta. */
const SRS_MEDIDO = aFormaCorta(parametros(URL_RC_INEXISTENTE).srsname)

/**
 * La URL del `GetParcel` BUENO. `PROCEDENCIA.md` no la lista —dice
 * explícitamente que ese fixture vive en `../gml/` y que no se duplica—, así que
 * se deriva de la petición medida del `ExceptionReport` cambiándole la única cosa
 * que cambia: la referencia catastral. Es la misma *stored query*, el mismo SRS y
 * el mismo orden de parámetros.
 */
const URL_PARCELA_OK = URL_RC_INEXISTENTE.replace(RC_INEXISTENTE, RC_BUENA)

const BBOX_COUNT10_PEDIDO = desmontarBbox(parametros(URL_BBOX_COUNT10).bbox)
const BBOX_MAR_PEDIDO = desmontarBbox(parametros(URL_BBOX_MAR).bbox)

/** El punto de la geocodificación: el que el propio fixture de éxito devuelve. */
const GEO_OK = JSON.parse(OVC_OK).Consulta_RCCOORResult.coordenadas.coord[0].geo
const X_OK = Number(GEO_OK.xcen)
const Y_OK = Number(GEO_OK.ycen)

// ── Arnés ─────────────────────────────────────────────────────────────────────

/**
 * Lo que el doble de `fetch` contesta a cada URL MEDIDA. Una URL que no esté
 * aquí recibe un 404: si el cliente se desvía un byte de la petición medida, se
 * ve como `ESTADO_HTTP` en vez de pasar en verde.
 */
const RESPUESTAS = new Map([
  [URL_PARCELA_OK, GML_PARCELA],
  [URL_RC_INEXISTENTE, EXC_RC_INEXISTENTE],
  [URL_VECINDAD, VECINDAD],
  [URL_BBOX_COUNT10, BBOX_COUNT10],
  [URL_BBOX_MAR, EXC_BBOX_VACIO],
  [URL_OVC_OK, OVC_OK],
])

const PLAN_FIXTURES = (url) =>
  RESPUESTAS.has(url) ? { estado: 200, texto: RESPUESTAS.get(url) } : { estado: 404 }

/** Todos los motivos que la suite ha producido DE VERDAD. Ver el guardián final. */
const MOTIVOS_VISTOS = new Set()

const METODOS = ['parcelaPorRefcat', 'parcelaYColindantes', 'parcelasEnBbox', 'refcatPorCoordenada']

/** Envuelve el cliente para que cada `motivo` que salga quede apuntado solo. */
function vigilar(cliente) {
  const espejo = { ...cliente }
  for (const metodo of METODOS) {
    espejo[metodo] = async (...args) => {
      const r = await cliente[metodo](...args)
      if (r && typeof r.motivo === 'string') MOTIVOS_VISTOS.add(r.motivo)
      return r
    }
  }
  return espejo
}

/**
 * Doble del puerto `CacheCatastro`: un `Map`, con contadores y con la posibilidad
 * de fallar a voluntad. **No hay IndexedDB en ningún test de este fichero**, que
 * es justo lo que un puerto bien declarado permite.
 */
function crearCacheDoble({ fallaLeer = false, fallaGuardar = false, devuelve } = {}) {
  const almacen = new Map()
  const llamadas = { leer: 0, guardar: 0 }
  return {
    almacen,
    llamadas,
    puerto: {
      async leer(clave) {
        llamadas.leer += 1
        if (fallaLeer) throw new Error('la caché local no se ha podido abrir')
        if (devuelve !== undefined) return devuelve
        return almacen.get(clave) ?? null
      },
      async guardar(clave, valor, meta) {
        llamadas.guardar += 1
        if (fallaGuardar) throw new Error('cuota de almacenamiento agotada')
        almacen.set(clave, { valor, guardadoEn: meta.guardadoEn })
      },
    },
  }
}

/**
 * Monta transporte + cliente + dobles de una vez. `alAvisar` es un espía en los
 * dos, así que ningún test escribe en la consola y el que quiera comprobar un
 * aviso solo tiene que mirar `avisos`.
 */
function montar({
  plan = PLAN_FIXTURES,
  cache = CACHE_NULA,
  srs,
  ahora,
  venceElReloj = false,
} = {}) {
  const red = crearDobleFetch({ plan })
  const esperas = crearDobleDormir({ venceElReloj })
  const avisos = []
  const espia = (mensaje, detalle) => avisos.push({ mensaje, detalle })
  const transporte = crearTransporte({
    fetch: red.fetch,
    dormir: esperas.dormir,
    aleatorio: () => 0,
    alAvisar: espia,
  })
  const cliente = crearClienteCatastro({
    transporte,
    cache,
    ...(srs === undefined ? {} : { srs }),
    ...(ahora === undefined ? {} : { ahora }),
    alAvisar: espia,
  })
  return { cliente: vigilar(cliente), crudo: cliente, transporte, red, esperas, avisos }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('services/catastro · el arnés lee ficheros de verdad (anti-vacuidad)', () => {
  it('las referencias, el SRS y el punto salen de los ficheros, no de este test', () => {
    expect(RC_BUENA, 'el GML de la parcela no trae referencia catastral').toMatch(/^[0-9A-Z]{14}$/)
    expect(RC_INEXISTENTE, 'la URL medida no trae `refcat`').toMatch(/^[0-9A-Z]{14}$/)
    expect(RC_INEXISTENTE).not.toBe(RC_BUENA)
    expect(Number.isFinite(X_OK) && Number.isFinite(Y_OK)).toBe(true)
    // La RC del OVC se compone de sus dos mitades y tiene que ser la misma parcela.
    const pc = JSON.parse(OVC_OK).Consulta_RCCOORResult.coordenadas.coord[0].pc
    expect(`${pc.pc1}${pc.pc2}`).toBe(RC_BUENA)
  })

  it('los fixtures traen lo que se les va a pedir (miembros y conteos declarados)', () => {
    expect(miembrosDe(VECINDAD)).toBeGreaterThan(1)
    expect(miembrosDe(BBOX_COUNT10)).toBeGreaterThan(0)
    expect(atributoRaiz(BBOX_COUNT10, 'numberMatched')).not.toBeNull()
    expect(refcatsDe(VECINDAD).length).toBe(miembrosDe(VECINDAD))
  })

  it('el doble de `fetch` contesta 404 a lo que NO se midió (o el arnés sería vacuo)', async () => {
    const { red } = montar()
    const transporte = crearTransporte({ fetch: red.fetch, dormir: crearDobleDormir().dormir })
    const r = await transporte.pedirTexto('https://ejemplo.invalid/no-medido')
    expect(r.ok).toBe(false)
    expect(r.estado).toBe(404)
  })
})

describe('services/catastro · contrato del módulo', () => {
  it('el cliente expone exactamente las siete funciones de la puerta pública', () => {
    // Siete desde F09: `descriptivosPorRefcat` (contrato E) trae los datos
    // alfanuméricos que el encabezado del informe imprime y que la geometría del
    // WFS no tiene. Su suite propia es `test/services/catastro-dnp.test.js`; aquí
    // solo se ancla la superficie pública, que es lo que este bloque vigila.
    const { crudo } = montar()
    expect(Object.keys(crudo).sort()).toEqual([
      'descriptivosPorRefcat',
      'destruir',
      'estado',
      'parcelaPorRefcat',
      'parcelaYColindantes',
      'parcelasEnBbox',
      'refcatPorCoordenada',
    ])
  })

  it('MOTIVO_CATASTRO está congelado y NO inventa un motivo de bloqueo', () => {
    expect(Object.isFrozen(MOTIVO_CATASTRO)).toBe(true)
    // Nadie ha medido —ni va a medir— qué contesta el Catastro a un cliente
    // denegado: provocarlo cuesta ~10 días de servicio (override O8) y
    // `PROCEDENCIA.md` lo declara como hueco. Un detector de una señal que nadie
    // ha visto o es código muerto que tranquiliza, o dispara en falso.
    for (const inventado of ['LIMITE_EXCEDIDO', 'BLOQUEADO', 'RATE_LIMITED', 'CORS', 'VACIO']) {
      expect(Object.keys(MOTIVO_CATASTRO)).not.toContain(inventado)
    }
    expect(PROCEDENCIA).toContain('No hay fixture de bloqueo por abuso')
  })

  it('CRITERIO 8 · el mapa motivo→nivel cubre el catálogo ENTERO y ninguno es ERROR', () => {
    // Conjunto derivado, no lista escrita: las dos direcciones, para que ni falte
    // un motivo ni sobre un nivel de un motivo que ya no existe.
    expect(Object.keys(NIVEL_POR_MOTIVO).sort()).toEqual(Object.values(MOTIVO_CATASTRO).sort())
    for (const motivo of Object.values(MOTIVO_CATASTRO)) {
      // `ERROR` es lo que BLOQUEA la generación del GML (`viewer/_comun.js`). Que
      // el Catastro no conteste no impide dibujar la parcela a mano: se pierde una
      // consulta, no un trabajo.
      expect(NIVEL_POR_MOTIVO[motivo], `${motivo} no debería bloquear el GML`).toBe(NIVEL.AVISO)
      expect(NIVEL_POR_MOTIVO[motivo]).not.toBe(NIVEL.ERROR)
    }
    expect(Object.isFrozen(NIVEL_POR_MOTIVO)).toBe(true)
  })

  it('SRS_DEFAULT es un huso soportado y es el SRS con el que se midió todo', () => {
    expect(() => husoPorSrs(SRS_DEFAULT)).not.toThrow()
    expect(SRS_DEFAULT).toBe(SRS_MEDIDO)
    // Y es uno de los que `geo/huso.js` implementa, no una cadena suelta.
    expect(HUSOS_VALIDOS.map(srsPorHuso)).toContain(SRS_DEFAULT)
  })

  it('CACHE_NULA está congelada, no encuentra nada y no lanza al guardar', async () => {
    expect(Object.isFrozen(CACHE_NULA)).toBe(true)
    await expect(CACHE_NULA.leer('lo que sea')).resolves.toBeNull()
    await expect(CACHE_NULA.guardar('k', {}, { guardadoEn: 0 })).resolves.toBeUndefined()
  })

  it('el módulo no escribe ninguna URL del Catastro ni llama al `fetch` (regla de oro 7)', () => {
    // La contingencia CORS vive en las constantes de los módulos `_`: si este
    // fichero escribiera un dominio, habría DOS sitios que tocar el día que haga
    // falta un proxy, y el segundo se olvidaría.
    expect(FUENTE_MODULO).not.toMatch(/https:\/\/ovc\.catastro/)
    expect(FUENTE_MODULO).not.toMatch(/\bfetch\s*\(/)
    // Y no toca IndexedDB: la caché entra por su puerto.
    expect(FUENTE_MODULO).not.toMatch(/indexedDB|from '\.\.\/storage\//)
  })

  it('crearClienteCatastro exige transporte, caché válida y un SRS soportado', () => {
    const { transporte } = montar()
    expect(() => crearClienteCatastro({})).toThrow(TypeError)
    expect(() => crearClienteCatastro({ transporte: {} })).toThrow(TypeError)
    expect(() => crearClienteCatastro({ transporte, cache: { leer: 1 } })).toThrow(TypeError)
    // Canarias está DIFERIDA (override O13): el mensaje sale de `geo/huso.js`,
    // que es el único sitio del proyecto que sabe qué husos hay.
    expect(() => crearClienteCatastro({ transporte, srs: 'EPSG:32628' })).toThrow(RangeError)
  })
})

describe('services/catastro · normalizarRefcat', () => {
  it('quita espacios (también los de dentro) y pone mayúsculas', () => {
    const conRuido = `  ${RC_BUENA.slice(0, 7).toLowerCase()} ${RC_BUENA.slice(7)}  `
    expect(normalizarRefcat(conRuido)).toBe(RC_BUENA)
    expect(normalizarRefcat(RC_BUENA)).toBe(RC_BUENA)
  })

  it('rechaza lo que no tiene forma de referencia de parcela, sin lanzar', () => {
    const malos = [
      '',
      '   ',
      RC_BUENA.slice(0, -1), // 13
      `${RC_BUENA}0`, // 15
      `${RC_BUENA.slice(0, -1)}-`, // carácter fuera del alfabeto
      null,
      undefined,
      42,
      {},
    ]
    for (const malo of malos) {
      expect(normalizarRefcat(malo), `${JSON.stringify(malo)} no es una referencia`).toBeNull()
    }
  })

  it('acepta la referencia de INMUEBLE (20) y se queda con la parcela (14)', () => {
    // La de 20 es la de los recibos del IBI y la que imprime la Sede, o sea la
    // que la gente tiene delante. Sus 14 primeros SON la parcela por
    // construcción (los 6 restantes son número fijo + control), así que esto no
    // adivina nada: recorta por una frontera definida.
    const inmueble = `${RC_BUENA}0001WX`
    expect(inmueble).toHaveLength(20)
    expect(normalizarRefcat(inmueble)).toBe(RC_BUENA)
    // Y con el ruido con el que se pega de verdad.
    expect(normalizarRefcat(`  ${inmueble.toLowerCase()}  `)).toBe(RC_BUENA)
  })

  it('las dos longitudes que valen son 14 y 20, y NADA entre medias', () => {
    // Anti-vacuidad de la prueba anterior: si alguien «arreglara» la de 20 con
    // un `slice(0, 14)` a secas, cualquier cadena larga pasaría a ser válida y
    // consultaríamos al Catastro una referencia inventada a partir de basura.
    for (const n of [13, 15, 16, 19, 21, 28]) {
      const cadena = 'A'.repeat(n)
      expect(normalizarRefcat(cadena), `${n} caracteres no es ninguna de las dos formas`).toBeNull()
    }
    expect(normalizarRefcat('A'.repeat(14))).toHaveLength(14)
    expect(normalizarRefcat('A'.repeat(20))).toHaveLength(14)
  })

  it('el CAMPO del formulario no puede truncar lo que se pega (fallo silencioso)', () => {
    // Guardián del defecto que encontró el guion de humo `07`: con
    // `maxlength="14"` en el input, `9398516 VK3799G` —correcta, y con el
    // espacio con el que la Sede la imprime— llegaba aquí recortada a
    // `9398516 VK3799` y se rechazaba. El campo no puede alterar el dato: quien
    // valida y explica es esta función.
    const conEspacio = `${RC_BUENA.slice(0, 7)} ${RC_BUENA.slice(7)}`
    expect(conEspacio).toHaveLength(15) // ← más de 14: por eso el truncado mordía
    expect(normalizarRefcat(conEspacio)).toBe(RC_BUENA)
    expect(normalizarRefcat(conEspacio.slice(0, 14))).toBeNull() // lo que pasaba antes

    const html = readFileSync(
      fileURLToPath(new URL('../../index.html', import.meta.url)),
      'utf8',
    )
    const campo = html.slice(html.indexOf('data-campo="refcat"') - 400, html.indexOf('data-campo="refcat"') + 400)
    expect(campo, 'el campo de referencia no puede llevar maxlength').not.toMatch(/maxlength/)
  })

  it('NO comprueba el dígito de control, y eso es deliberado', () => {
    // Se cambia el último carácter de una referencia real: la forma sigue siendo
    // válida y el control ya no cuadra. La función la acepta A PROPÓSITO — el
    // algoritmo de control no está verificado contra el servicio en este proyecto
    // y un falso negativo bloquearía una consulta legítima. Una referencia con la
    // forma buena y el control malo produce una URL legítima a la que el Catastro
    // contesta «no encontrado», que es una respuesta honesta y presentable.
    const otroFinal = RC_BUENA.at(-1) === 'A' ? 'B' : 'A'
    const controlRoto = RC_BUENA.slice(0, -1) + otroFinal
    expect(controlRoto).not.toBe(RC_BUENA)
    expect(normalizarRefcat(controlRoto)).toBe(controlRoto)
    // Y la referencia inexistente MEDIDA también pasa la forma: es «el usuario
    // tecleó bien y la parcela no está», no «el usuario tecleó cualquier cosa».
    expect(normalizarRefcat(RC_INEXISTENTE)).toBe(RC_INEXISTENTE)
  })
})

describe('services/catastro · parcelaPorRefcat (criterios 1 y 2)', () => {
  it('CRITERIO 1a · devuelve geometría, referencia catastral y SRS de la parcela real', async () => {
    const { cliente, red } = montar()
    const r = await cliente.parcelaPorRefcat(RC_BUENA)

    expect(r.ok).toBe(true)
    expect(r.motivo).toBeNull()
    expect(r.mensaje).toBeNull()
    expect(r.datos.refcat).toBe(RC_BUENA)
    expect(r.datos.srs).toBe(SRS_DEFAULT)
    expect(r.datos.recintos.length).toBeGreaterThan(0)
    expect(r.datos.recintos[0].vertices.length).toBeGreaterThan(2)
    // La procedencia dice de dónde vino, y la URL es la MEDIDA (el doble solo
    // contesta a esa; cualquier desviación habría dado 404).
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
    expect(r.procedencia.url).toBe(URL_PARCELA_OK)
    expect(r.procedencia.intentos).toBe(1)
    expect(r.procedencia.edadMs).toBeNull()
    expect(red.total).toBe(1)
  })

  it('CRITERIO 1b · la SEGUNDA llamada sale de la caché y el `fetch` cuenta 0 nuevas', async () => {
    const cache = crearCacheDoble()
    const { cliente, red } = montar({ cache: cache.puerto })

    const primera = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(primera.procedencia.origen).toBe(ORIGEN.RED)
    const peticionesTrasLaPrimera = red.total
    expect(peticionesTrasLaPrimera).toBe(1)

    const segunda = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(segunda.ok).toBe(true)
    expect(segunda.procedencia.origen).toBe(ORIGEN.CACHE)
    expect(segunda.procedencia.url).toBeNull()
    expect(segunda.procedencia.intentos).toBe(0)
    // El dato es el mismo, no una versión degradada.
    expect(segunda.datos).toEqual(primera.datos)
    // Y LO QUE IMPORTA: ni una petición nueva.
    expect(red.total - peticionesTrasLaPrimera).toBe(0)
  })

  it('lo que se GUARDA en la caché es el CUERPO CRUDO, no el POJO parseado', async () => {
    // No es un detalle de implementación: es la garantía de que una corrección
    // futura en `gml/parse.js` arregla retroactivamente TODO lo ya cacheado.
    // Guardar el POJO congelaría cada entrada con los fallos del parser del día
    // que se guardó y los serviría durante el TTL entero sin avisar. Este
    // proyecto ya lo pagó una vez: el 2026-07-27 la Sede rechazó un GML por un
    // fallo de esta capa (SPEC §3.1), corregido el mismo día — con POJOs
    // cacheados, quien hubiera consultado esa mañana habría seguido viendo el
    // dato mal una semana entera.
    const cache = crearCacheDoble()
    const { cliente } = montar({ cache: cache.puerto })

    await cliente.parcelaPorRefcat(RC_BUENA)

    const guardados = [...cache.almacen.values()]
    expect(guardados).toHaveLength(1)
    const guardado = guardados[0].valor
    expect(typeof guardado).toBe('string')
    // Y es el cuerpo de verdad, no una cadena cualquiera: se relee con el mismo
    // lector del módulo y produce la parcela pedida. Derivado, no tecleado.
    const releido = leerColeccion(guardado)
    expect(releido.tipo).toBe(TIPO_RESPUESTA_WFS.PARCELAS)
    expect(releido.parcelas.map((p) => p.refcat)).toContain(RC_BUENA)
  })

  it('un cuerpo cacheado ILEGIBLE se ignora y se va a la red, sin romper nada', async () => {
    // La contrapartida honesta de cachear texto: si mañana el lector deja de
    // aceptar un cuerpo viejo, eso degrada a «más lento», nunca a «roto».
    const cache = crearCacheDoble()
    const { cliente, red } = montar({ cache: cache.puerto })
    await cliente.parcelaPorRefcat(RC_BUENA)
    const clave = [...cache.almacen.keys()][0]
    cache.almacen.set(clave, { valor: '<esto ya no es un GML>', guardadoEn: 0 })

    const r = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(r.ok).toBe(true)
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
    expect(red.total).toBe(2)
  })

  it('la VECINDAD se cachea, y con clave distinta de la parcela suelta', async () => {
    // `parcelaYColindantes` es la consulta más pesada de F05 (11,7 kB medidos
    // frente a 2,9 kB) y F06/F07 la piden en cada diagnóstico: no cachearla
    // sería el mayor agujero anti-bloqueo del cliente. Y la clave TIENE que ser
    // distinta: el servicio devuelve dos cuerpos diferentes para la misma
    // referencia (5 miembros y 1), así que compartir clave serviría una parcela
    // sin sus colindantes, o al revés.
    const cache = crearCacheDoble()
    const { cliente, red } = montar({ cache: cache.puerto })

    const primera = await cliente.parcelaYColindantes(RC_BUENA)
    expect(primera.procedencia.origen).toBe(ORIGEN.RED)
    const segunda = await cliente.parcelaYColindantes(RC_BUENA)
    expect(segunda.procedencia.origen).toBe(ORIGEN.CACHE)
    expect(red.total).toBe(1)
    expect(segunda.datos.colindantes).toHaveLength(primera.datos.colindantes.length)

    // Y la parcela suelta NO se sirve desde la entrada de la vecindad.
    const suelta = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(suelta.procedencia.origen).toBe(ORIGEN.RED)
    expect(new Set(cache.almacen.keys()).size).toBe(2)
  })

  it('la caché se consulta ANTES que la red: con dato guardado no hay ni una petición', async () => {
    const cache = crearCacheDoble()
    const { cliente, red } = montar({ cache: cache.puerto })
    await cliente.parcelaPorRefcat(RC_BUENA) // llena la caché
    const otro = montar({ cache: cache.puerto }) // cliente NUEVO, misma caché

    const r = await otro.cliente.parcelaPorRefcat(RC_BUENA)
    expect(r.procedencia.origen).toBe(ORIGEN.CACHE)
    expect(otro.red.total).toBe(0)
    expect(red.total).toBe(1)
  })

  it('`procedencia.edadMs` dice cuánto lleva guardado (el «guardado hace 6 días»)', async () => {
    const cache = crearCacheDoble()
    let reloj = 1_000
    const { cliente } = montar({ cache: cache.puerto, ahora: () => reloj })

    await cliente.parcelaPorRefcat(RC_BUENA)
    const SEIS_DIAS_MS = 6 * 24 * 60 * 60 * 1000
    reloj += SEIS_DIAS_MS

    const r = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(r.procedencia.origen).toBe(ORIGEN.CACHE)
    expect(r.procedencia.edadMs).toBe(SEIS_DIAS_MS)
  })

  it('CRITERIO 2 · una referencia INEXISTENTE da NO_ENCONTRADO, no una excepción', async () => {
    const { cliente } = montar()
    // Sin `rejects`: la promesa resuelve. Si lanzara, el test caería aquí mismo.
    const r = await cliente.parcelaPorRefcat(RC_INEXISTENTE)

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    expect(r.datos).toBeNull()
    // El texto del servicio se arrastra ÍNTEGRO y entre comillas: se enseña, no
    // se analiza (es libre, bilingüe y con una errata del propio Catastro).
    const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(EXC_RC_INEXISTENTE)[1]
    expect(r.mensaje).toContain(cdata)
    // Y se dice que no es un fallo de la herramienta (override C6).
    expect(r.mensaje).toMatch(/estado válido/i)
  })

  it('un fallo NO_ENCONTRADO no se guarda en la caché: mañana puede existir', async () => {
    const cache = crearCacheDoble()
    const { cliente } = montar({ cache: cache.puerto })
    await cliente.parcelaPorRefcat(RC_INEXISTENTE)
    expect(cache.llamadas.guardar).toBe(0)
    expect(cache.almacen.size).toBe(0)
  })

  it('una referencia mal escrita da ENTRADA_INVALIDA sin tocar la red', async () => {
    const { cliente, red } = montar()
    const r = await cliente.parcelaPorRefcat('  esto no es una RC  ')

    expect(r.motivo).toBe(MOTIVO_CATASTRO.ENTRADA_INVALIDA)
    expect(r.procedencia.origen).toBe(ORIGEN.LOCAL)
    expect(r.procedencia.url).toBeNull()
    expect(red.total).toBe(0)
    // El mensaje dice lo que se espera Y que no se juzga el dígito de control.
    expect(r.mensaje).toMatch(/14 caracteres/)
    expect(r.mensaje).toMatch(/dígito de control/i)
  })

  it('TRAMPA 6 · un fallo de ESCRITURA en la caché avisa pero NO cambia el resultado', async () => {
    const cache = crearCacheDoble({ fallaGuardar: true })
    const { cliente, avisos } = montar({ cache: cache.puerto })
    const r = await cliente.parcelaPorRefcat(RC_BUENA)

    // La parcela se ha traído bien. Que el almacenamiento esté lleno no puede
    // convertir un acierto en un error.
    expect(r.ok).toBe(true)
    expect(r.datos.refcat).toBe(RC_BUENA)
    expect(r.motivo).toBeNull()
    // Pero no es silencioso (regla de oro 1): es el ÚNICO suceso de este módulo
    // que no cabe en el resultado, y por eso va por el canal de aviso.
    const deCache = avisos.filter((a) => /caché/i.test(a.mensaje))
    expect(deCache.length).toBe(1)
    expect(deCache[0].detalle.nivel).toBe(NIVEL.AVISO)
  })

  it('un fallo de LECTURA en la caché avisa y se va a la red: el dato llega igual', async () => {
    const cache = crearCacheDoble({ fallaLeer: true })
    const { cliente, avisos, red } = montar({ cache: cache.puerto })
    const r = await cliente.parcelaPorRefcat(RC_BUENA)

    expect(r.ok).toBe(true)
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
    expect(red.total).toBe(1)
    expect(avisos.some((a) => /caché/i.test(a.mensaje))).toBe(true)
  })

  it('una caché que devuelve otra forma se ignora, avisa y no sirve `undefined`', async () => {
    const cache = crearCacheDoble({ devuelve: { esto: 'no es {valor, guardadoEn}' } })
    const { cliente, avisos } = montar({ cache: cache.puerto })
    const r = await cliente.parcelaPorRefcat(RC_BUENA)

    expect(r.ok).toBe(true)
    expect(r.datos.refcat).toBe(RC_BUENA)
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
    expect(avisos.some((a) => /forma/i.test(a.mensaje))).toBe(true)
  })

  it('TRAMPA 2 · si la colección no trae la parcela pedida, sale ILEGIBLE (nunca `parcelas[0]`)', async () => {
    // El servicio contesta con una colección de OTRA parcela. Un cliente que
    // cogiera el primer miembro devolvería la parcela equivocada como si fuera la
    // del usuario, y nadie se enteraría.
    const { cliente } = montar({ plan: { estado: 200, texto: GML_PARCELA } })
    const r = await cliente.parcelaPorRefcat(RC_INEXISTENTE)

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE)
    expect(r.datos).toBeNull()
    expect(r.mensaje).toContain(RC_INEXISTENTE)
    expect(r.mensaje).toContain(RC_BUENA)
  })
})

describe('services/catastro · parcelaYColindantes (criterio 4)', () => {
  it('CRITERIO 4 · separa la propia por referencia catastral, no por posición', async () => {
    const { cliente } = montar()
    const r = await cliente.parcelaYColindantes(RC_BUENA)

    const nMiembros = miembrosDe(VECINDAD)
    expect(r.ok).toBe(true)
    expect(r.datos.propia.refcat).toBe(RC_BUENA)
    // Derivado del fichero: la propia viene DENTRO, así que hay un colindante
    // menos que miembros. Medido: 5 miembros para 4 colindantes.
    expect(r.datos.colindantes.length).toBe(nMiembros - 1)
    // Y ninguna colindante repite la propia.
    expect(r.datos.colindantes.map((p) => p.refcat)).not.toContain(RC_BUENA)
    expect(new Set(r.datos.colindantes.map((p) => p.refcat)).size).toBe(nMiembros - 1)
    expect(r.procedencia.url).toBe(URL_VECINDAD)
  })

  it('la propia NO viene la primera en el fichero: por eso no vale el índice', () => {
    // Este test no mira el módulo: mira el FICHERO, para dejar escrito por qué
    // `parcelas[0]` sería un error y no una simplificación. Medido: 2.ª de 5.
    const orden = refcatsDe(VECINDAD)
    expect(orden).toContain(RC_BUENA)
    expect(orden.indexOf(RC_BUENA)).not.toBe(0)
    expect(PROCEDENCIA).toContain('LA VECINDAD SE INCLUYE A SÍ MISMA')
  })

  it('una referencia mal escrita da ENTRADA_INVALIDA sin tocar la red', async () => {
    const { cliente, red } = montar()
    const r = await cliente.parcelaYColindantes('XX')
    expect(r.motivo).toBe(MOTIVO_CATASTRO.ENTRADA_INVALIDA)
    expect(red.total).toBe(0)
  })

  // ⭐ **O15 CORREGIDO (2026-08-15).** Esto afirmaba lo contrario —que una vecindad
  // sin la parcela pedida salía `RESPUESTA_ILEGIBLE`— y la corrección no es de
  // gusto: es que el servicio **no siempre se incluye a sí misma**. Medido en vivo
  // sobre tres parcelas contiguas del mismo polígono: `8081402TF9288S` y
  // `8081403TF9288S` vienen con la propia dentro; `8081401TF9288S` devuelve UN
  // miembro (`8081402TF9288S`) y ella no está.
  //
  // Con la regla vieja, esa parcela se quedaba sin colindantes por sus TRES puertas
  // —«Traer colindantes», el cajón de diagnóstico y el informe—, porque la única
  // vecina buena que sí había llegado se tiraba entera con la respuesta. Y encima
  // se contaba como avería del servicio.
  it('una vecindad sin la parcela pedida NO es ilegible: son todas colindantes', async () => {
    const { cliente } = montar({ plan: { estado: 200, texto: VECINDAD } })
    const r = await cliente.parcelaYColindantes(RC_INEXISTENTE)

    expect(r.ok, 'el servicio ha contestado con parcelas: eso no es un fallo').toBe(true)
    // `propia` es `null` y NO `parcelas[0]`: elegir una a dedo daría por parcela del
    // usuario a una vecina, que es justo lo que prohíbe la trampa 2.
    expect(r.datos.propia, 'la pedida no vino, y no se elige una a dedo').toBeNull()
    // Y NINGÚN miembro se pierde: los que llegaron son todos colindantes.
    expect(r.datos.colindantes.length).toBe(miembrosDe(VECINDAD))
    expect(r.datos.colindantes.map((p) => p.refcat)).toContain(RC_BUENA)
  })
})

describe('services/catastro · parcelasEnBbox (criterios 5 y 6)', () => {
  it('CRITERIO 5 · cuenta los miembros; los atributos de conteo del servicio MIENTEN', async () => {
    const { cliente } = montar()
    const r = await cliente.parcelasEnBbox(BBOX_COUNT10_PEDIDO.bbox, {
      srs: BBOX_COUNT10_PEDIDO.srs,
    })

    const contados = miembrosDe(BBOX_COUNT10)
    const declaradoMatched = atributoRaiz(BBOX_COUNT10, 'numberMatched')
    const declaradoReturned = atributoRaiz(BBOX_COUNT10, 'numberReturned')

    expect(r.ok).toBe(true)
    expect(r.datos.nMiembros).toBe(contados)
    expect(r.datos.parcelas.length).toBe(contados)
    // Las dos cifras salen del MISMO fichero, y no coinciden: eso es la mentira.
    expect(Number(declaradoMatched)).not.toBe(contados)
    expect(declaradoReturned).toBe(declaradoMatched)
    // Lo declarado se arrastra, con un nombre que dice que es lo que el servicio
    // DICE. Nadie debe paginar ni dibujar un contador con ello.
    expect(r.datos.declarado.numberMatched).toBe(declaradoMatched)
    expect(r.datos.declarado.numberReturned).toBe(declaradoReturned)
    // Y `truncado`: llegaron tantas como pedimos, así que puede haber más — y el
    // servicio no dice cuántas, porque sus atributos mienten.
    expect(r.datos.count).toBe(COUNT_BBOX_DEFECTO)
    expect(r.datos.truncado).toBe(true)
    expect(r.procedencia.url).toBe(URL_BBOX_COUNT10)
  })

  it('CRITERIO 6a · un encuadre de EXACTAMENTE el máximo pasa (anti-vacuidad)', async () => {
    // Sin este caso, «rechazar siempre» aprobaría el criterio 6b. La caja se
    // construye con aritmética entera exacta a partir de la propia constante:
    // una tira de 1 m de alto por MAX_AREA_BBOX_M2 de ancho mide justo el máximo.
    const { cliente, red } = montar()
    const enElLimite = { minX: 0, minY: 0, maxX: MAX_AREA_BBOX_M2, maxY: 1 }
    const r = await cliente.parcelasEnBbox(enElLimite)

    expect(r.motivo).not.toBe(MOTIVO_CATASTRO.BBOX_DEMASIADO_GRANDE)
    // Se emitió de verdad: el límite es el último valor ADMITIDO, no el primero
    // rechazado. (Esa URL no está entre las medidas, así que el doble da 404 —
    // que es exactamente la prueba de que la petición salió.)
    expect(red.total).toBe(1)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.ESTADO_HTTP)
  })

  it('CRITERIO 6b · un metro cuadrado más da BBOX_DEMASIADO_GRANDE y el `fetch` cuenta 0', async () => {
    const { cliente, red } = montar()
    const unoDeMas = { minX: 0, minY: 0, maxX: MAX_AREA_BBOX_M2 + 1, maxY: 1 }
    const r = await cliente.parcelasEnBbox(unoDeMas)

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.BBOX_DEMASIADO_GRANDE)
    expect(r.procedencia.origen).toBe(ORIGEN.LOCAL)
    expect(r.procedencia.url).toBeNull()
    // Se comprueba ANTES de emitir: medido, 600 × 600 m devolvieron 539 parcelas
    // y ~1,15 MB, así que preguntar y arrepentirse no es una opción.
    expect(red.total).toBe(0)
    expect(r.mensaje).toMatch(/No se ha llegado a consultar al Catastro/)
  })

  it('TRAMPA 4 · un BBOX degenerado o invertido LANZA: eso no lo teclea un usuario', async () => {
    const { cliente, red } = montar()
    const { bbox } = BBOX_COUNT10_PEDIDO
    // Frontera distinta a la del tamaño, y a propósito: un encuadre demasiado
    // grande lo produce la rueda del ratón; una caja invertida la produce código.
    await expect(
      cliente.parcelasEnBbox({ ...bbox, minX: bbox.maxX, maxX: bbox.minX }),
    ).rejects.toThrow(RangeError)
    await expect(cliente.parcelasEnBbox({ ...bbox, maxY: bbox.minY })).rejects.toThrow(RangeError)
    await expect(cliente.parcelasEnBbox(null)).rejects.toThrow(TypeError)
    expect(red.total).toBe(0)
  })

  it('el `count` se valida delegando en el constructor de URL (sin segunda verdad)', async () => {
    const { cliente } = montar()
    await expect(
      cliente.parcelasEnBbox(BBOX_COUNT10_PEDIDO.bbox, { count: 0 }),
    ).rejects.toThrow(RangeError)
  })
})

describe('services/catastro · el «vacío» y el «no existe» son la MISMA cosa (criterio 3)', () => {
  it('CRITERIO 3 · una caja sin parcelas da EL MISMO motivo que una RC inexistente', async () => {
    const { cliente } = montar()
    const porCaja = await cliente.parcelasEnBbox(BBOX_MAR_PEDIDO.bbox, { srs: BBOX_MAR_PEDIDO.srs })
    const porReferencia = await cliente.parcelaPorRefcat(RC_INEXISTENTE)

    // Se afirma la IGUALDAD, no cada valor por separado: lo que hay que dejar
    // escrito es que esta herramienta NO PUEDE distinguirlos, porque el servicio
    // usa el mismo `exceptionCode` para los dos (medido, `PROCEDENCIA.md`).
    expect(porCaja.motivo).toBe(porReferencia.motivo)
    expect(porCaja.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)

    // Lo único que los diferencia es el texto libre del CDATA, que se arrastra
    // íntegro y NO se analiza jamás (es bilingüe y trae una errata del servicio).
    const cdata = (t) => /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(t)[1]
    expect(porCaja.mensaje).toContain(cdata(EXC_BBOX_VACIO))
    expect(porReferencia.mensaje).toContain(cdata(EXC_RC_INEXISTENTE))
    expect(cdata(EXC_BBOX_VACIO)).not.toBe(cdata(EXC_RC_INEXISTENTE))
    // La errata del propio Catastro, transcrita tal cual.
    expect(cdata(EXC_BBOX_VACIO)).toContain('founded')
  })

  it('el módulo no ramifica sobre el texto del CDATA', () => {
    // Guardián de texto sobre el CÓDIGO (sin comentarios: la cabecera cita esas
    // frases a propósito, para advertir de ellas). Si alguien intentara distinguir
    // los dos casos leyendo el CDATA, tendría que escribir aquí alguna de estas
    // palabras. El día que el Catastro corrija su errata, ese `if` se rompería EN
    // VERDE: seguiría devolviendo una rama, la equivocada.
    expect(CODIGO_MODULO, 'el filtro de comentarios se ha comido el código').toContain(
      'export function normalizarRefcat',
    )
    for (const trozo of ['founded', 'No records', 'No se ha encontrado la parcela']) {
      expect(CODIGO_MODULO).not.toContain(trozo)
    }
    // Y tampoco se inspecciona el `detalle` de la excepción por otros medios.
    expect(CODIGO_MODULO).not.toMatch(/detalle\s*\.\s*(includes|indexOf|match|test|startsWith)/)
  })
})

describe('services/catastro · refcatPorCoordenada (geocodificación inversa)', () => {
  it('devuelve el candidato del punto medido, con `cuantos` y `unico`', async () => {
    const { cliente } = montar()
    const r = await cliente.refcatPorCoordenada(X_OK, Y_OK)

    expect(r.ok).toBe(true)
    expect(r.datos.cuantos).toBe(1)
    expect(r.datos.unico).toBe(true)
    expect(r.datos.candidatos[0].refcat).toBe(RC_BUENA)
    // El domicilio se conserva: es lo ÚNICO con lo que una persona puede elegir
    // entre varios candidatos.
    expect(r.datos.candidatos[0].domicilio).toBe(
      JSON.parse(OVC_OK).Consulta_RCCOORResult.coordenadas.coord[0].ldt,
    )
    expect(r.procedencia.url).toBe(URL_OVC_OK)
  })

  it('la segunda consulta del mismo punto sale de la caché, sin red', async () => {
    const cache = crearCacheDoble()
    const { cliente, red } = montar({ cache: cache.puerto })
    await cliente.refcatPorCoordenada(X_OK, Y_OK)
    const tras = red.total

    // Unos centímetros más allá es el MISMO punto: la clave redondea al metro,
    // que es la resolución a la que dos clics del usuario son la misma pregunta.
    // El desplazamiento se DERIVA del propio redondeo (parte del metro entero y
    // le suma una décima) para que el test no dependa de si la coordenada del
    // fixture cae cerca de un `.5`, que es donde el redondeo cambia de metro.
    const mismoMetro = (v) => Math.round(v) + 0.1
    const r = await cliente.refcatPorCoordenada(mismoMetro(X_OK), mismoMetro(Y_OK))
    expect(r.procedencia.origen).toBe(ORIGEN.CACHE)
    expect(red.total - tras).toBe(0)
    // Y el dato que sale de la caché es el REINTERPRETADO, entero: la política
    // de cachear crudo no puede degradar lo que la primera consulta ya dio.
    expect(r.datos.candidatos[0].refcat).toBe(RC_BUENA)
    expect(r.datos.unico).toBe(true)
  })

  it('S2 · lo que se GUARDA en la caché es el CUERPO CRUDO del OVC, no el POJO interpretado', async () => {
    // La misma garantía —y el mismo guardián— que ya tenía `parcelaPorRefcat`:
    // el crudo se reinterpreta con el lector de HOY en cada acierto, así que una
    // corrección futura de `leerRccoor` arregla retroactivamente lo ya cacheado.
    // Con el POJO guardado (lo que hacía S2), cada registro quedaba congelado
    // con la lectura del día en que se guardó, contra la decisión 1 de
    // `storage/cache-catastro.js`.
    const cache = crearCacheDoble()
    const { cliente } = montar({ cache: cache.puerto })

    await cliente.refcatPorCoordenada(X_OK, Y_OK)

    const guardados = [...cache.almacen.values()]
    expect(guardados).toHaveLength(1)
    const guardado = guardados[0].valor
    expect(typeof guardado).toBe('string')
    // Y es el cuerpo de verdad: se relee con el mismo lector del módulo y
    // produce el candidato medido. Derivado, no tecleado.
    const releido = leerRccoor(guardado)
    expect(releido.tipo).toBe(TIPO_RCCOOR.CANDIDATOS)
    expect(releido.candidatos[0].refcat).toBe(RC_BUENA)
  })

  it('S2 · un registro VIEJO con el POJO cacheado es fallo de caché → red, nunca un acierto', async () => {
    // Los registros guardados antes de la corrección llevan dentro el objeto
    // interpretado. No se pueden servir —sería servir la interpretación de otro
    // día como si fuera de hoy— ni pueden romper nada: se tratan como «no
    // estaba», se va a la red, y el `guardar` posterior los pisa con el crudo.
    const cache = crearCacheDoble()
    const { cliente, red } = montar({ cache: cache.puerto })
    await cliente.refcatPorCoordenada(X_OK, Y_OK) // llena la caché (con el crudo)
    const clave = [...cache.almacen.keys()][0]
    // El formato ANTIGUO, tal como lo dejaba el código de antes de S2.
    cache.almacen.set(clave, {
      valor: { candidatos: [{ refcat: RC_BUENA }], cuantos: 1, unico: true },
      guardadoEn: 0,
    })

    const r = await cliente.refcatPorCoordenada(X_OK, Y_OK)
    expect(r.ok).toBe(true)
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
    expect(red.total).toBe(2)
    // Y el registro viejo ha quedado PISADO por el crudo: la migración es sola.
    expect(typeof cache.almacen.get(clave).valor).toBe('string')
  })

  it('S2 · un crudo cacheado que ya no se puede leer se ignora y se va a la red', async () => {
    // La contrapartida honesta de cachear texto, igual que en las colecciones
    // del WFS: degrada a «más lento», nunca a «roto».
    const cache = crearCacheDoble()
    const { cliente, red } = montar({ cache: cache.puerto })
    await cliente.refcatPorCoordenada(X_OK, Y_OK)
    const clave = [...cache.almacen.keys()][0]
    cache.almacen.set(clave, { valor: '{"esto ya no es": "un RCCOOR"}', guardadoEn: 0 })

    const r = await cliente.refcatPorCoordenada(X_OK, Y_OK)
    expect(r.ok).toBe(true)
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
    expect(red.total).toBe(2)
  })

  it('un `cod` de la tabla («no hay parcela ahí») es NO_ENCONTRADO: estado válido', async () => {
    const { cliente } = montar({ plan: { estado: 200, texto: OVC_COD16 } })
    const r = await cliente.refcatPorCoordenada(X_OK, Y_OK)

    expect(r.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    expect(r.mensaje).toContain(JSON.parse(OVC_COD16).Consulta_RCCOORResult.lerr[0].des)
    expect(r.mensaje).toMatch(/estado válido/i)
  })

  it('TRAMPA 5 · un `cod` fuera de la tabla es fallo TÉCNICO, jamás «aquí no hay parcela»', async () => {
    // `ovc-rccoor-cod76.json` es lo que el servicio contesta cuando la URL la
    // hemos construido mal NOSOTROS (nombres de parámetro del otro endpoint):
    // HTTP 200, `cuerr:1`, y la misma FORMA que un resultado negativo. Traducirlo
    // a «no hay parcela» le diría al usuario que se busque otra parcela cuando lo
    // que hay que hacer es arreglar un bug de una línea.
    const { cliente } = montar({ plan: { estado: 200, texto: OVC_COD76 } })
    const r = await cliente.refcatPorCoordenada(X_OK, Y_OK)

    expect(r.motivo).toBe(MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE)
    expect(r.motivo).not.toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    expect(r.mensaje).toMatch(/FALLO DE ESTA APLICACIÓN/)
    expect(r.mensaje).toContain(JSON.parse(OVC_COD76).Consulta_RCCOORResult.lerr[0].cod)
  })

  it('un punto fuera de España es ENTRADA_INVALIDA (estado), no una excepción', async () => {
    // El punto lo pincha el usuario en el mapa, y el mapa llega hasta Marruecos:
    // hacer clic en el sitio equivocado no puede reventar la app. Se usa el mismo
    // Este del punto medido con Norte 0 (el ecuador), que no cae en España con
    // ningún huso soportado.
    const { cliente, red } = montar()
    const r = await cliente.refcatPorCoordenada(X_OK, 0)

    expect(r.motivo).toBe(MOTIVO_CATASTRO.ENTRADA_INVALIDA)
    expect(r.procedencia.origen).toBe(ORIGEN.LOCAL)
    expect(red.total).toBe(0)
    expect(r.mensaje).toMatch(/España/)
  })

  it('una coordenada que no es un número finito SÍ lanza: eso lo construye código', async () => {
    const { cliente } = montar()
    await expect(cliente.refcatPorCoordenada(Number.NaN, Y_OK)).rejects.toThrow(TypeError)
    await expect(cliente.refcatPorCoordenada(X_OK, Number.POSITIVE_INFINITY)).rejects.toThrow(
      TypeError,
    )
  })
})

describe('services/catastro · lo que llega del transporte, traducido', () => {
  it('un estado HTTP no 2xx sale como ESTADO_HTTP, y un 4xx no se reintenta', async () => {
    const { cliente, red } = montar({ plan: { estado: 404 } })
    const r = await cliente.parcelaPorRefcat(RC_BUENA)

    expect(r.motivo).toBe(MOTIVO_CATASTRO.ESTADO_HTTP)
    expect(r.procedencia.intentos).toBe(1)
    expect(red.total).toBe(1)
    expect(r.mensaje).toContain('404')
  })

  it('un fallo de red sale como SIN_RED tras agotar los reintentos', async () => {
    const { cliente, red } = montar({ plan: { error: errorDeRed() } })
    const r = await cliente.parcelaPorRefcat(RC_BUENA)

    expect(r.motivo).toBe(MOTIVO_CATASTRO.SIN_RED)
    // El número de intentos se DERIVA de la constante del transporte.
    expect(r.procedencia.intentos).toBe(BACKOFF.intentos)
    expect(red.total).toBe(BACKOFF.intentos)
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
  })

  it('agotar el plazo sale como TIEMPO_AGOTADO (sin gastar ni un milisegundo real)', async () => {
    const { cliente } = montar({ plan: { pendiente: true }, venceElReloj: true })
    const r = await cliente.parcelaPorRefcat(RC_BUENA)

    expect(r.motivo).toBe(MOTIVO_CATASTRO.TIEMPO_AGOTADO)
    expect(r.ok).toBe(false)
  })

  it('cancelar con la señal del llamante sale como CANCELADA', async () => {
    const { cliente, red } = montar({ plan: { pendiente: true } })
    const control = new AbortController()
    control.abort()

    const r = await cliente.parcelaPorRefcat(RC_BUENA, { senal: control.signal })
    expect(r.motivo).toBe(MOTIVO_CATASTRO.CANCELADA)
    expect(red.total).toBe(0)
  })

  it('destruir deja el cliente inerte y para el transporte, sin lanzar', async () => {
    const { cliente, crudo, red, transporte } = montar()
    crudo.destruir()
    crudo.destruir() // idempotente

    const r = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.CANCELADA)
    expect(r.procedencia.origen).toBe(ORIGEN.LOCAL)
    expect(red.total).toBe(0)
    // El transporte también queda destruido: al cerrar una pantalla se para todo.
    expect((await transporte.pedirTexto(URL_PARCELA_OK)).motivo).toBe('CANCELADA')
  })

  it('un cuerpo que no es una colección de parcelas sale como RESPUESTA_ILEGIBLE', async () => {
    for (const cuerpo of [CATALOGO_XML, GML_EDIFICIO, 'no soy XML', '']) {
      const { cliente } = montar({ plan: { estado: 200, texto: cuerpo } })
      const r = await cliente.parcelaPorRefcat(RC_BUENA)
      expect(r.motivo, `cuerpo de ${cuerpo.length} caracteres`).toBe(
        MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
      )
      expect(typeof r.mensaje).toBe('string')
      expect(r.mensaje.length).toBeGreaterThan(0)
    }
  })

  it('`estado()` separa las consultas del cliente de las peticiones del transporte', async () => {
    const cache = crearCacheDoble()
    const { cliente, crudo } = montar({ cache: cache.puerto })
    await cliente.parcelaPorRefcat(RC_BUENA)
    await cliente.parcelaPorRefcat(RC_BUENA) // de caché
    await cliente.parcelaPorRefcat('no vale') // ni caché ni red

    const e = crudo.estado()
    expect(e.consultas).toBe(3)
    expect(e.deCache).toBe(1)
    expect(e.deRed).toBe(1)
    expect(e.fallosCache).toBe(0)
    // Los del transporte van anidados: son otra unidad y mezclarlos invitaría a
    // sumarlos (una consulta puede costar entre 0 y BACKOFF.intentos peticiones).
    expect(e.red.peticiones).toBe(1)
  })
})

describe('services/catastro · la forma del resultado (criterio 7)', () => {
  it('CRITERIO 7 · las MISMAS claves siempre, salga bien o mal', async () => {
    const { cliente } = montar()
    const resultados = [
      await cliente.parcelaPorRefcat(RC_BUENA), // éxito por red
      await cliente.parcelaPorRefcat(RC_INEXISTENTE), // no encontrado
      await cliente.parcelaPorRefcat('nada'), // entrada inválida (local)
      await cliente.parcelaYColindantes(RC_BUENA), // éxito, otra forma de datos
      await cliente.parcelasEnBbox(BBOX_COUNT10_PEDIDO.bbox, { srs: BBOX_COUNT10_PEDIDO.srs }),
      await cliente.parcelasEnBbox({ minX: 0, minY: 0, maxX: MAX_AREA_BBOX_M2 + 1, maxY: 1 }),
      await cliente.refcatPorCoordenada(X_OK, Y_OK),
      await cliente.refcatPorCoordenada(X_OK, 0),
    ]

    // Conjunto DERIVADO del primero, no una lista escrita a mano.
    const claves = Object.keys(resultados[0]).sort()
    const clavesProcedencia = Object.keys(resultados[0].procedencia).sort()
    expect(claves.length).toBeGreaterThan(0)
    for (const r of resultados) {
      expect(Object.keys(r).sort()).toEqual(claves)
      expect(Object.keys(r.procedencia).sort()).toEqual(clavesProcedencia)
      // Los invariantes del contrato, en todos.
      expect(r.ok).toBe(r.datos !== null)
      expect(r.ok).toBe(r.motivo === null)
      expect(r.ok).toBe(r.mensaje === null)
      if (r.motivo !== null) expect(Object.values(MOTIVO_CATASTRO)).toContain(r.motivo)
      expect(Object.values(ORIGEN)).toContain(r.procedencia.origen)
      expect(Number.isFinite(r.procedencia.ms)).toBe(true)
      // `url` no nulo ⟺ hubo petición.
      expect(r.procedencia.url !== null).toBe(r.procedencia.origen === ORIGEN.RED)
      // `edadMs` solo tiene sentido si el dato salió de la caché.
      if (r.procedencia.origen !== ORIGEN.CACHE) expect(r.procedencia.edadMs).toBeNull()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EL GUARDIÁN. Va el último a propósito: dentro de un fichero, Vitest ejecuta
// los tests en orden de declaración, así que para cuando esto corre ya se ha
// producido todo lo que la suite es capaz de producir.
// ─────────────────────────────────────────────────────────────────────────────

describe('services/catastro · guardián del catálogo de motivos', () => {
  it('TODO motivo de MOTIVO_CATASTRO tiene un caso REPRODUCIBLE en esta suite', () => {
    // Es el guardián que impide inventarse un motivo. Un `LIMITE_EXCEDIDO` o un
    // `BLOQUEADO` no podrían llegar aquí: nadie ha medido —ni va a medir— qué
    // contesta el Catastro a un cliente denegado, porque provocarlo cuesta ~10
    // días de servicio (override O8). Un motivo que ningún test puede provocar o
    // es código muerto que además TRANQUILIZA, o dispara en falso y le dice al
    // usuario que está bloqueado cuando se le ha caído el wifi.
    const catalogo = Object.values(MOTIVO_CATASTRO).sort()
    const vistos = [...MOTIVOS_VISTOS].sort()
    expect(vistos).toEqual(catalogo)
  })

  it('el guardián no es vacuo: sabe distinguir un motivo que nadie ha producido', () => {
    // Prueba negativa del instrumento. Si `MOTIVOS_VISTOS` se llenara solo, la
    // igualdad de arriba sería verdad por casualidad.
    expect(MOTIVOS_VISTOS.has('MOTIVO_QUE_NADIE_HA_MEDIDO')).toBe(false)
    expect(MOTIVOS_VISTOS.size).toBe(Object.keys(MOTIVO_CATASTRO).length)
  })
})
