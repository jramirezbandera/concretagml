/* -------------------------------------------------------------------------- *
 * test/services/catastro-edificio.test.js — F11 · T2.2                         *
 * LA PUERTA PÚBLICA del servicio de EDIFICIO del Catastro.                     *
 *                                                                              *
 * `services/catastro-edificio.js` es el único módulo de F11 que habla con la    *
 * red, así que aquí la red va DOBLADA (`test/services/_doble-fetch.js`) y los   *
 * cuerpos que se le sirven son **ficheros reales del disco**: los cinco de la   *
 * tanda de F11 en `test/fixtures/catastro/` —capturados con `curl` el           *
 * 2026-08-03, con su SHA-256 en `PROCEDENCIA.md`— y los dos GML de edificio de  *
 * F00. Ni un cuerpo inventado en los caminos que importan.                      *
 *                                                                              *
 * ── LAS SEIS COSAS QUE ESTE FICHERO EXISTE PARA CLAVAR ─────────────────────── *
 *   1. ⭐ **Son DOS peticiones, y no tres.** Se cuentan las llamadas al `fetch`  *
 *      doble y se leen los `STOREDQUERIE_ID` de las URL emitidas: tienen que    *
 *      ser exactamente `CONSULTAS_DE_CARGA`, en ese orden, y **no puede         *
 *      aparecer** ni `GetBuildingByParcel` ni `GetOtherBuildingByParcel`.       *
 *   2. ⛔⛔ **El 404 sale como «no localizada», NO como fallo técnico.** Es el    *
 *      punto que se rompe solo, y por eso lleva su **mitad anti-vacuidad**: se  *
 *      comprueba que el transporte, sobre esa MISMA URL, sí devuelve            *
 *      `ESTADO_HTTP` con `texto: null` — o sea que el camino equivocado estaba  *
 *      disponible y no se ha tomado.                                           *
 *   3. ⛔ **La colección VACÍA es camino normal**: `ok: true`, sin `motivo`, con *
 *      `sinConstrucciones: true`. Un test que la diera por error convertiría el *
 *      punto de partida de la obra nueva en una avería.                         *
 *   4. ⚠️ **El transporte es EL MISMO OBJETO** que recibiría                     *
 *      `crearClienteCatastro`, y se afirma por su efecto observable: una carga  *
 *      de edificio mueve los contadores que ve el cliente de parcela.           *
 *   5. **La forma de `ResultadoCatastro`, DERIVADA y no copiada**: se ejecuta   *
 *      una consulta de parcela de verdad y se comparan los juegos de claves.    *
 *      Un literal escrito aquí se quedaría viejo el día que aquel contrato      *
 *      cambiara, y este test seguiría verde.                                   *
 *   6. ⛔ **`destruir()` NO destruye el transporte compartido** — y la           *
 *      asimetría contraria (destruir el cliente de parcela sí deja mudo a este) *
 *      queda ANCLADA en un `it`, porque es una trampa viva para T3.2 y T4.1.    *
 *                                                                              *
 * Proyecto Vitest `node` (sin sufijo `.dom`): aquí no hay DOM, ni Leaflet, ni   *
 * red de verdad, ni IndexedDB (la caché entra por su puerto, con un `Map`).     *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { CONSULTAS_BU, TIPO_RESPUESTA_BU } from '../../services/_catastro-bu.js'
import { MOTIVO_RED, crearTransporte } from '../../services/_red.js'
import {
  MOTIVO_CATASTRO,
  NIVEL_POR_MOTIVO,
  SRS_DEFAULT,
  crearClienteCatastro,
} from '../../services/catastro.js'
import {
  CONSULTAS_DE_CARGA,
  CONSULTAS_POR_CARGA,
  crearClienteEdificio,
} from '../../services/catastro-edificio.js'
import { crearDobleDormir, crearDobleFetch, errorDeRed } from './_doble-fetch.js'

// ── Los cuerpos: ficheros reales ─────────────────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')
const leer = (...partes) => readFileSync(join(RAIZ, 'test', 'fixtures', ...partes), 'utf8')

/** `GetAllConstructionByParcel` de la parcela de referencia: 1 Building + 1 piscina. */
const TODAS_URBANA = leer('catastro', 'wfsbu-allconstruction-9398516VK3799G.xml')
/** `GetAllConstructionByParcel` de una rústica: 1 Building y ninguna «otra». */
const TODAS_RUSTICA = leer('catastro', 'wfsbu-allconstruction-13005A10900001.xml')
/** `200 OK` + colección BU con CERO miembros. El punto de partida de la obra nueva. */
const VACIA = leer('catastro', 'wfsbu-coleccion-vacia-13005A10900001.xml')
/** La pantalla de error de ASP.NET que llega con el 404. **No es XML.** */
const ERROR_404 = leer('catastro', 'wfsbu-error-404-ovcerror.html')
/** `GetBuildingPartByParcel` de la parcela de referencia: las 13 partes (F00). */
const PARTES_URBANA = leer('gml', 'bu_buildingpart_9398516VK3799G.gml')
/** GML de PARCELA de ENTREGA: MISMA raíz y MISMO contenedor que el sobre del wfsBU. */
const CP_ENTREGA = leer('gml', 'cp_ejemplo_explicativo.gml')
/** Una colección de parcelas del WFS, para poder ejercitar el cliente hermano. */
const CP_WFS = leer('gml', 'cp_parcela_9398516VK3799G.gml')

const REFCAT_URBANA = '9398516VK3799G'
const REFCAT_RUSTICA = '13005A10900001'

// ── Arnés ────────────────────────────────────────────────────────────────────

/** El `STOREDQUERIE_ID` de una URL emitida. Sin la «S»: es la grafía del servicio. */
const consultaDe = (url) => new URL(url).searchParams.get('STOREDQUERIE_ID')

/** El `refcat` de una URL emitida. */
const refcatDe = (url) => new URL(url).searchParams.get('refcat')

/**
 * Guion del `fetch` doble ENRUTADO POR CONSULTA. Cada *stored query* recibe lo
 * suyo; una consulta no prevista devuelve un 418 para que, si algún día se
 * emitiera una tercera, el caso fallara **rápido y por el motivo equivocado**,
 * que es exactamente como uno quiere enterarse (misma técnica que el
 * `PLAN_PROHIBIDO` de `_casos-catastro.js`).
 *
 * @param {Record<string, import('./_doble-fetch.js').GuionFetch>} porConsulta
 */
const planPorConsulta = (porConsulta) => (url) =>
  porConsulta[consultaDe(url)] ?? {
    estado: 418,
    texto: 'esta consulta no debería pedirse nunca en este caso',
  }

/** Las dos consultas de la carga contestando cuerpos buenos. */
const PLAN_URBANA = planPorConsulta({
  [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 200, texto: TODAS_URBANA },
  [CONSULTAS_BU.PARTES]: { estado: 200, texto: PARTES_URBANA },
})

/** Caché de mentira que cumple el puerto `CacheCatastro` con un `Map`. */
function crearCacheDeMemoria({ falloAlLeer = false, falloAlGuardar = false } = {}) {
  const datos = new Map()
  return {
    datos,
    lecturas: [],
    escrituras: [],
    async leer(clave) {
      this.lecturas.push(clave)
      if (falloAlLeer) throw new Error('la caché está rota')
      return datos.get(clave) ?? null
    },
    async guardar(clave, valor, meta) {
      this.escrituras.push(clave)
      if (falloAlGuardar) throw new Error('no cabe')
      datos.set(clave, { valor, guardadoEn: meta.guardadoEn })
    },
  }
}

/**
 * Monta transporte + los DOS clientes sobre él. Devolver también el de parcela no
 * es adorno: es lo que permite afirmar que el transporte es compartido de verdad
 * y comparar la forma de los dos resultados.
 *
 * @param {object} [opciones]
 */
function montar({ plan = PLAN_URBANA, cache, ahora, venceElReloj = false } = {}) {
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
  const comunes = { transporte, alAvisar: espia, ...(cache ? { cache } : {}), ...(ahora ? { ahora } : {}) }
  return {
    red,
    esperas,
    avisos,
    transporte,
    edificios: crearClienteEdificio(comunes),
    catastro: crearClienteCatastro(comunes),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 · EL COSTE: DOS PETICIONES, Y NO TRES
// ─────────────────────────────────────────────────────────────────────────────

describe('el coste de una carga está DICHO y es de dos peticiones', () => {
  it('`CONSULTAS_POR_CARGA` se DERIVA de la lista, no se escribe', () => {
    expect(CONSULTAS_POR_CARGA).toBe(CONSULTAS_DE_CARGA.length)
    expect(CONSULTAS_POR_CARGA).toBe(2)
    expect(Object.isFrozen(CONSULTAS_DE_CARGA)).toBe(true)
  })

  it('la pareja es la MEDIDA: «todas las construcciones» + «partes», en ese orden', () => {
    // ⭐ `GetAllConstructionByParcel` trae el Building Y la piscina de una vez. La
    // vía obvia de tres consultas cuesta un 50 % más y no aporta nada.
    expect([...CONSULTAS_DE_CARGA]).toEqual([
      CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES,
      CONSULTAS_BU.PARTES,
    ])
    expect(CONSULTAS_DE_CARGA).not.toContain(CONSULTAS_BU.EDIFICIO)
    expect(CONSULTAS_DE_CARGA).not.toContain(CONSULTAS_BU.OTRAS_CONSTRUCCIONES)
  })

  it('una carga real emite EXACTAMENTE dos peticiones, y son esas dos', async () => {
    const { edificios, red } = montar()
    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)

    expect(r.ok).toBe(true)
    expect(red.total, 'la carga ha costado un número de peticiones distinto de dos').toBe(2)
    expect(red.urls().map(consultaDe)).toEqual([...CONSULTAS_DE_CARGA])
    expect(red.urls().map(refcatDe)).toEqual([REFCAT_URBANA, REFCAT_URBANA])
    // Y el coste es afirmable DESDE EL PROPIO RESULTADO, no solo desde el espía.
    expect(r.procedencia.consultas).toBe(CONSULTAS_POR_CARGA)
    expect(r.procedencia.urls).toEqual(red.urls())
    expect(r.procedencia.intentos).toBe(2)
    expect(r.datos.consultas).toBe(CONSULTAS_POR_CARGA)
  })

  it('NO se pide la tercera consulta: ni `GetBuildingByParcel` ni `GetOtherBuildingByParcel`', async () => {
    const { edificios, red } = montar()
    await edificios.edificioPorRefcat(REFCAT_URBANA)
    const pedidas = red.urls().map(consultaDe)
    expect(pedidas).not.toContain(CONSULTAS_BU.EDIFICIO)
    expect(pedidas).not.toContain(CONSULTAS_BU.OTRAS_CONSTRUCCIONES)
  })

  it('el `srsname` de las dos URL es el del cliente, con el doble dos puntos medido', async () => {
    const { edificios, red } = montar()
    await edificios.edificioPorRefcat(REFCAT_URBANA)
    for (const url of red.urls()) {
      expect(new URL(url).searchParams.get('srsname')).toBe(SRS_DEFAULT.replace(':', '::'))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2 · EL DATO: LOS DOS DOCUMENTOS, JUNTOS
// ─────────────────────────────────────────────────────────────────────────────

describe('las dos respuestas se juntan en un solo dato', () => {
  it('trae el Building, sus 13 partes y la PISCINA, sin traducir nada', async () => {
    const { edificios } = montar()
    const { datos } = await edificios.edificioPorRefcat(REFCAT_URBANA)

    expect(datos.edificio.refcat).toBe(REFCAT_URBANA)
    // Dos `PolygonPatch` en el Building (medido): asumir uno pierde 52 de 56 puntos.
    expect(datos.edificio.anillos.map((a) => a.length)).toEqual([4, 52])
    expect(datos.partes).toHaveLength(13)
    // ⭐ La piscina, que no estaba en ningún fixture de F00 y que se pierde entera
    //    —y en silencio— si la carga se hace con `GetBuildingByParcel`.
    expect(datos.otras).toHaveLength(1)
    expect(datos.otras[0].constructionNature, 'nada traducido: el valor es el CRUDO').toBe(
      'openAirPool',
    )
    // Miembros CONTADOS, sumando los dos documentos (2 + 13). Este servicio no
    // declara `numberMatched` ni `numberReturned`: no hay contador del que fiarse.
    expect(datos.nMiembros).toBe(15)
    expect(datos.sinConstrucciones).toBe(false)
    expect(datos.srs).toBe(SRS_DEFAULT)
    expect(datos.srsName, 'el srsName va LITERAL: en BU es una URN').toBe(
      'urn:ogc:def:crs:EPSG::25830',
    )
    expect(datos.dialecto).toBe('BU')
    expect(datos.refcat, 'la referencia PEDIDA viaja en el dato').toBe(REFCAT_URBANA)
  })

  it('las detecciones de los DOS documentos llegan concatenadas', async () => {
    const { edificios } = montar()
    const { datos } = await edificios.edificioPorRefcat(REFCAT_URBANA)
    // No se afirma el número exacto —eso caduca con el lector—, sino que hay más
    // que las de un solo documento: si se perdieran las de uno, esto caería.
    expect(datos.detecciones.length).toBeGreaterThan(10)
    expect(datos.detecciones.every((d) => typeof d.tipo === 'string')).toBe(true)
  })

  it('un edificio SIN partes registradas no es un fallo: envolvente sí, partes no', async () => {
    // Composición del arnés, no una pareja medida: la rústica tiene `Building`
    // (medido) y se le sirve una colección de partes vacía (cuerpo real de otra
    // consulta). Es el caso «hay envolvente y no hay partes», que existe.
    const { edificios } = montar({
      plan: planPorConsulta({
        [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 200, texto: TODAS_RUSTICA },
        [CONSULTAS_BU.PARTES]: { estado: 200, texto: VACIA },
      }),
    })
    const r = await edificios.edificioPorRefcat(REFCAT_RUSTICA)

    expect(r.ok).toBe(true)
    expect(r.datos.edificio.refcat).toBe(REFCAT_RUSTICA)
    expect(r.datos.partes).toEqual([])
    expect(r.datos.sinConstrucciones, 'hay envolvente: NO está sin construcciones').toBe(false)
    expect(r.datos.nMiembros).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3 · ⛔ LA COLECCIÓN VACÍA ES CAMINO NORMAL
// ─────────────────────────────────────────────────────────────────────────────

describe('⛔ la colección vacía es el punto de partida de la obra nueva, no un error', () => {
  const montarVacia = (extra) =>
    montar({
      plan: planPorConsulta({
        [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 200, texto: VACIA },
        [CONSULTAS_BU.PARTES]: { estado: 200, texto: VACIA },
      }),
      ...extra,
    })

  it('sale con `ok: true`, sin motivo y sin mensaje', async () => {
    const { edificios } = montarVacia()
    const r = await edificios.edificioPorRefcat(REFCAT_RUSTICA)

    expect(r.ok, 'una parcela sin nada construido NO es un fallo').toBe(true)
    expect(r.motivo).toBeNull()
    expect(r.mensaje).toBeNull()
    expect(r.datos.sinConstrucciones).toBe(true)
    expect(r.datos.edificio).toBeNull()
    expect(r.datos.partes).toEqual([])
    expect(r.datos.otras).toEqual([])
    expect(r.datos.nMiembros).toBe(0)
  })

  it('sin ni un feature no se inventa el SRS que se pidió', async () => {
    const { edificios } = montarVacia()
    const { datos } = await edificios.edificioPorRefcat(REFCAT_RUSTICA)
    // Se pidió en 25830 y el documento no lo dice en ninguna parte: `null` es «no
    // lo sé», que es distinto de «es el que pedí».
    expect(datos.srs).toBeNull()
    expect(datos.srsName).toBeNull()
    expect(datos.refcat, 'lo único que se puede afirmar es la referencia pedida').toBe(
      REFCAT_RUSTICA,
    )
  })

  it('cuesta las DOS peticiones: no se da por hecho que sin envolvente no hay partes', async () => {
    // Que un `Building` ausente implique cero `BuildingPart` es INFERENCIA, no
    // medición. Ahorrarse la segunda consulta por ahí podría esconder partes
    // reales, y eso sería un error silencioso. Se paga la petición.
    const { edificios, red } = montarVacia()
    await edificios.edificioPorRefcat(REFCAT_RUSTICA)
    expect(red.total).toBe(CONSULTAS_POR_CARGA)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4 · ⛔⛔ EL 404 SALE COMO «NO LOCALIZADA», NO COMO FALLO TÉCNICO
// ─────────────────────────────────────────────────────────────────────────────
// Es el punto que se rompe solo: `services/_red.js` en un no-2xx devuelve
// `ok: false`, `motivo: ESTADO_HTTP` y `texto: null`. Traducir `MOTIVO_RED` antes
// de mirar el estado convertiría «esa referencia no está» en «ha fallado la red».

describe('⛔⛔ el 404 del wfsBU se lee como referencia no localizada', () => {
  const PLAN_404 = planPorConsulta({
    [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 404, texto: ERROR_404 },
    [CONSULTAS_BU.PARTES]: { estado: 404, texto: ERROR_404 },
  })

  it('el motivo es NO_ENCONTRADO, y NO `ESTADO_HTTP`', async () => {
    const { edificios } = montar({ plan: PLAN_404 })
    const r = await edificios.edificioPorRefcat('0000000XX0000X')

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    expect(
      r.motivo,
      'el 404 traducido por MOTIVO_RED saldría como ESTADO_HTTP: ese es el fallo que este ' +
        'test existe para cazar',
    ).not.toBe(MOTIVO_CATASTRO.ESTADO_HTTP)
    expect(r.datos).toBeNull()
  })

  it('MITAD ANTI-VACUIDAD: el camino equivocado estaba disponible y no se ha tomado', async () => {
    // El transporte, sobre la MISMA respuesta, dice `ESTADO_HTTP` y no entrega ni
    // el cuerpo. Si este módulo tradujera por ahí, el motivo sería el otro. Sin
    // esta afirmación, el test de arriba podría estar pasando por casualidad.
    const { transporte, edificios } = montar({ plan: PLAN_404 })
    const http = await transporte.pedirTexto('https://ejemplo.invalido/x?STOREDQUERIE_ID=' + CONSULTAS_BU.PARTES)
    expect(http.ok).toBe(false)
    expect(http.motivo).toBe(MOTIVO_RED.ESTADO_HTTP)
    expect(http.estado).toBe(404)
    expect(http.texto, '_red.js no entrega el cuerpo de un no-2xx').toBeNull()
    // Y el mismo 404, por la puerta de este módulo, sale por el otro camino.
    const r = await edificios.edificioPorRefcat('0000000XX0000X')
    expect(r.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    expect(r.mensaje, 'el mensaje NO es el del transporte').not.toBe(http.mensaje)
  })

  it('el mensaje DICE que el servicio es mudo, en vez de elegir una de las dos causas', async () => {
    const { edificios } = montar({ plan: PLAN_404 })
    const r = await edificios.edificioPorRefcat('0000000XX0000X')
    expect(r.mensaje).toContain('no existe')
    expect(r.mensaje).toContain('construido mal')
    expect(r.mensaje).toContain(CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES)
  })

  it('⚠️ ANCLADO para T3.2: el transporte avisa por su cuenta, y dice OTRA cosa', async () => {
    // `services/_red.js#fallar` emite por el canal antes de que este módulo tenga
    // nada que decir, y su texto habla de una DIRECCIÓN WEB cuando el usuario ha
    // escrito una referencia catastral. No se puede evitar sin tocar `_red.js`,
    // que esta tarea no toca. Queda anclado para que quien cablee la pantalla sepa
    // que **el renglón bueno es `resultado.mensaje`**, no el aviso del canal.
    const { edificios, avisos } = montar({ plan: PLAN_404 })
    const r = await edificios.edificioPorRefcat('0000000XX0000X')

    const delTransporte = avisos.filter((a) => a.mensaje.includes('404'))
    expect(delTransporte, 'si esto deja de pasar, la trampa 6 de la cabecera sobra').toHaveLength(1)
    expect(delTransporte[0].mensaje).toContain('esa dirección no existe')
    // Y el mensaje del resultado, que es el que se enseña, dice lo que hay que decir.
    expect(r.mensaje).not.toContain('dirección')
    expect(r.mensaje).toContain('referencia')
  })

  it('para en la PRIMERA consulta: no se pregunta por las partes de lo que no existe', async () => {
    const { edificios, red } = montar({ plan: PLAN_404 })
    const r = await edificios.edificioPorRefcat('0000000XX0000X')
    expect(red.total, 'una referencia inexistente cuesta UNA petición, no dos').toBe(1)
    expect(r.procedencia.consultas).toBe(1)
    expect(r.procedencia.urls).toHaveLength(1)
    expect(consultaDe(r.procedencia.url)).toBe(CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES)
  })

  it('un 404 en la SEGUNDA consulta dice que la primera SÍ contestó', async () => {
    // Es dato observado, no adivinanza, y cambia la lectura del fallo: si la
    // primera consulta encontró la referencia, «no existe» es lo menos probable.
    const { edificios, red } = montar({
      plan: planPorConsulta({
        [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 200, texto: TODAS_URBANA },
        [CONSULTAS_BU.PARTES]: { estado: 404, texto: ERROR_404 },
      }),
    })
    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    expect(r.mensaje).toContain('la consulta anterior')
    expect(red.total).toBe(2)
    expect(consultaDe(r.procedencia.url), 'la URL del resultado es la que FALLÓ').toBe(
      CONSULTAS_BU.PARTES,
    )
    expect(r.procedencia.urls).toHaveLength(2)
  })

  it('media carga NO se entrega: sin partes no hay edificio a medias', async () => {
    const { edificios } = montar({
      plan: planPorConsulta({
        [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 200, texto: TODAS_URBANA },
        [CONSULTAS_BU.PARTES]: { error: errorDeRed() },
      }),
    })
    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)
    // `{edificio, partes: []}` sería indistinguible de «esta parcela tiene
    // envolvente y ninguna parte», que es una afirmación falsa sobre el Catastro.
    expect(r.ok).toBe(false)
    expect(r.datos).toBeNull()
    expect(r.motivo).toBe(MOTIVO_CATASTRO.SIN_RED)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5 · ⛔ CINCO ESTADOS, NO TRES: EL 403 NO SE DISFRAZA
// ─────────────────────────────────────────────────────────────────────────────

describe('⛔ un estado HTTP no medido no se disfraza de «esa referencia no existe»', () => {
  it('un 403 —el bloqueo por abuso del override O8— sale como ESTADO_HTTP', async () => {
    const { edificios } = montar({
      plan: planPorConsulta({
        [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 403, texto: 'prohibido' },
      }),
    })
    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)

    expect(r.motivo).toBe(MOTIVO_CATASTRO.ESTADO_HTTP)
    expect(
      r.motivo,
      'sin ESTADO_NO_MEDIDO, el bloqueo por abuso saldría como «esa referencia no existe»',
    ).not.toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    expect(r.mensaje).toContain('403')
    expect(r.mensaje).toContain('No se afirma que la referencia no exista')
  })

  it('un 2xx con un cuerpo que no es de este servicio sale como RESPUESTA_ILEGIBLE', async () => {
    // El GML de parcela de ENTREGA tiene la MISMA raíz y el MISMO contenedor que
    // el sobre del wfsBU: si esto saliera como «no hay nada construido», una
    // colección de parcelas se leería como un solar vacío.
    const { edificios } = montar({
      plan: planPorConsulta({
        [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 200, texto: CP_ENTREGA },
      }),
    })
    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE)
    expect(r.ok).toBe(false)
  })

  it('sin respuesta (`estado === null`) manda MOTIVO_RED, que es donde vive ese caso', async () => {
    const { edificios } = montar({ plan: { error: errorDeRed() } })
    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)
    // `clasificarRespuestaBu` LANZA con `estado: null` a propósito: «no llegó a
    // haber respuesta» no es un dato raro de este servicio. Si este módulo se lo
    // pasara, el test caería con un TypeError en vez de con un resultado.
    expect(r.motivo).toBe(MOTIVO_CATASTRO.SIN_RED)
    expect(r.ok).toBe(false)
    expect(r.procedencia.origen).toBe('RED')
  })

  it('el plazo agotado y la cancelación también salen por MOTIVO_RED', async () => {
    const conReloj = montar({ plan: { pendiente: true }, venceElReloj: true })
    expect((await conReloj.edificios.edificioPorRefcat(REFCAT_URBANA)).motivo).toBe(
      MOTIVO_CATASTRO.TIEMPO_AGOTADO,
    )

    const control = new AbortController()
    control.abort()
    const conSenal = montar()
    const r = await conSenal.edificios.edificioPorRefcat(REFCAT_URBANA, { senal: control.signal })
    expect(r.motivo).toBe(MOTIVO_CATASTRO.CANCELADA)
    expect(conSenal.red.total, 'cancelar antes de empezar cuesta CERO peticiones').toBe(0)
  })

  it('todo motivo que este módulo puede producir tiene NIVEL en `services/catastro.js`', async () => {
    // La razón de ser del contrato F: misma forma ⇒ la interfaz reutiliza
    // `NIVEL_POR_MOTIVO` sin escribir nada nuevo. Si algún camino produjera un
    // motivo fuera del catálogo, la pantalla lo pintaría sin nivel.
    const casos = [
      [{}, 'no es una referencia'],
      [{ plan: PLAN_URBANA }, REFCAT_URBANA],
      [
        { plan: planPorConsulta({ [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 404 } }) },
        REFCAT_URBANA,
      ],
      [
        { plan: planPorConsulta({ [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 403 } }) },
        REFCAT_URBANA,
      ],
      [
        {
          plan: planPorConsulta({
            [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 200, texto: CP_ENTREGA },
          }),
        },
        REFCAT_URBANA,
      ],
      [{ plan: { error: errorDeRed() } }, REFCAT_URBANA],
    ]
    for (const [opciones, refcat] of casos) {
      const { edificios } = montar(opciones)
      const r = await edificios.edificioPorRefcat(refcat)
      if (r.motivo === null) continue
      expect(Object.values(MOTIVO_CATASTRO), `motivo fuera del catálogo: ${r.motivo}`).toContain(
        r.motivo,
      )
      expect(NIVEL_POR_MOTIVO[r.motivo], `${r.motivo} sin nivel`).toBeDefined()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6 · LO QUE ESTE MÓDULO COMPRUEBA POR SU CUENTA ANTES DE JUNTAR
// ─────────────────────────────────────────────────────────────────────────────

describe('dos respuestas que no encajan no se juntan', () => {
  it('lo que habla de OTRA referencia no se enseña como si fuera la pedida', async () => {
    // Se pide la urbana y el servicio contesta con la rústica. Es la lección de
    // F05 (la parcela buena se identifica por su referencia, nunca por su
    // posición) aplicada del otro lado.
    const { edificios } = montar({
      plan: planPorConsulta({
        [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 200, texto: TODAS_RUSTICA },
        [CONSULTAS_BU.PARTES]: { estado: 200, texto: PARTES_URBANA },
      }),
    })
    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE)
    expect(r.mensaje).toContain(REFCAT_RUSTICA)
    expect(r.datos).toBeNull()
  })

  it('la colección vacía no dispara ese guardián: no tiene ninguna referencia que juzgar', async () => {
    const { edificios } = montar({
      plan: planPorConsulta({
        [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 200, texto: VACIA },
        [CONSULTAS_BU.PARTES]: { estado: 200, texto: VACIA },
      }),
    })
    // Se pide una referencia DISTINTA de la del fixture y sale bien igualmente:
    // un documento sin features no puede contradecir a nadie.
    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)
    expect(r.ok).toBe(true)
    expect(r.datos.sinConstrucciones).toBe(true)
  })

  it('un cuerpo 2xx que el lector no entiende sale como RESPUESTA_ILEGIBLE, no como vacío', async () => {
    // Colección BU bien formada (la clasificación la aprueba) pero con basura
    // dentro: es el hueco entre `clasificarRespuestaBu` y `parsearGmlBu`.
    const truncada = VACIA.replace('</gml:FeatureCollection>', '<gml:featureMember/>')
    const { edificios } = montar({
      plan: planPorConsulta({
        [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 200, texto: truncada },
      }),
    })
    const r = await edificios.edificioPorRefcat(REFCAT_RUSTICA)
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7 · LA FORMA DEL RESULTADO, DERIVADA DEL CONTRATO HERMANO
// ─────────────────────────────────────────────────────────────────────────────

describe('la forma es la de `ResultadoCatastro`, y se comprueba contra el original', () => {
  /** Un resultado de VERDAD del cliente de parcela, para comparar formas. */
  async function resultadoDeParcela() {
    const { catastro } = montar({ plan: { estado: 200, texto: CP_WFS } })
    return catastro.parcelaPorRefcat(REFCAT_URBANA)
  }

  it('las claves de primer nivel son EXACTAMENTE las mismas', async () => {
    const { edificios } = montar()
    const mio = await edificios.edificioPorRefcat(REFCAT_URBANA)
    const suyo = await resultadoDeParcela()

    expect(suyo.ok, 'el caso de control del cliente hermano no ha salido bien').toBe(true)
    expect(Object.keys(mio)).toEqual(Object.keys(suyo))
  })

  it('`procedencia` conserva las cinco claves del original, en el mismo orden', async () => {
    const { edificios } = montar()
    const mio = await edificios.edificioPorRefcat(REFCAT_URBANA)
    const suyo = await resultadoDeParcela()

    const suyas = Object.keys(suyo.procedencia)
    // Prefijo, no igualdad: F11 añade `urls` y `consultas` porque este flujo pide
    // más de una URL. Que las cinco originales sigan delante y con el mismo nombre
    // es lo que permite reutilizar `textoProcedencia` sin escribir nada nuevo.
    expect(Object.keys(mio.procedencia).slice(0, suyas.length)).toEqual(suyas)
    expect(Object.keys(mio.procedencia)).toContain('urls')
    expect(Object.keys(mio.procedencia)).toContain('consultas')
  })

  it('los invariantes del contrato se cumplen en TODOS los caminos', async () => {
    const casos = [
      [{}, 'no es una referencia'],
      [{ plan: PLAN_URBANA }, REFCAT_URBANA],
      [
        { plan: planPorConsulta({ [CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES]: { estado: 404 } }) },
        REFCAT_URBANA,
      ],
      [{ plan: { error: errorDeRed() } }, REFCAT_URBANA],
    ]
    for (const [opciones, refcat] of casos) {
      const { edificios } = montar(opciones)
      const r = await edificios.edificioPorRefcat(refcat)
      // ok ⟺ datos ⟺ motivo ⟺ mensaje
      expect(r.ok).toBe(r.datos !== null)
      expect(r.ok).toBe(r.motivo === null)
      expect(r.ok).toBe(r.mensaje === null)
      // `url === null` ⟺ `origen !== 'RED'`
      expect(r.procedencia.url === null).toBe(r.procedencia.origen !== 'RED')
      expect(r.procedencia.consultas).toBe(r.procedencia.urls.length)
      expect(Number.isFinite(r.procedencia.ms)).toBe(true)
    }
  })

  it('una referencia mal escrita NO lanza y no cuesta ni una petición', async () => {
    const { edificios, red } = montar()
    const r = await edificios.edificioPorRefcat('esto no es una referencia')
    expect(r.motivo).toBe(MOTIVO_CATASTRO.ENTRADA_INVALIDA)
    expect(r.procedencia.origen).toBe('LOCAL')
    expect(r.procedencia.url).toBeNull()
    expect(red.total).toBe(0)
  })

  it('la referencia de INMUEBLE (20 caracteres) se recorta a su parcela, como en la otra rama', async () => {
    const { edificios, red } = montar()
    const r = await edificios.edificioPorRefcat(`${REFCAT_URBANA}0001XX`)
    expect(r.ok).toBe(true)
    expect(red.urls().map(refcatDe)).toEqual([REFCAT_URBANA, REFCAT_URBANA])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8 · ⚠️ EL TRANSPORTE ES EL MISMO OBJETO QUE EL DE LA RAMA DE PARCELA
// ─────────────────────────────────────────────────────────────────────────────

describe('⚠️ el transporte se COMPARTE con `crearClienteCatastro` (override O8)', () => {
  it('es el mismo objeto, y una carga de edificio mueve los contadores que ve el otro cliente', async () => {
    const { edificios, catastro, transporte } = montar()
    const antes = catastro.estado().red.peticiones

    await edificios.edificioPorRefcat(REFCAT_URBANA)

    // La afirmación por identidad…
    expect(edificios.estado().red).toEqual(transporte.estado())
    // …y la afirmación por EFECTO, que es la que de verdad prueba que la cola, los
    // reintentos y el ritmo son compartidos: dos transportes serían dos colas de 2,
    // o sea cuatro peticiones simultáneas contra el mismo servicio.
    expect(catastro.estado().red.peticiones).toBe(antes + CONSULTAS_POR_CARGA)
    expect(edificios.estado().red.peticiones).toBe(catastro.estado().red.peticiones)
  })

  it('no se crea un transporte por defecto, y el mensaje dice por qué', () => {
    expect(() => crearClienteEdificio()).toThrow(TypeError)
    expect(() => crearClienteEdificio({})).toThrow(/MISMO objeto que recibe crearClienteCatastro/)
    expect(() => crearClienteEdificio({ transporte: {} })).toThrow(/pedirTexto/)
  })

  it('⛔ `destruir()` NO destruye el transporte: la otra rama sigue viva', async () => {
    // ⚠️ El enrutado NO puede ir por `STOREDQUERIE_ID`: los DOS servicios usan ese
    // mismo parámetro (`_catastro-wfs.js` también), así que se enruta por endpoint.
    const { edificios, catastro, red } = montar({
      plan: (url) =>
        url.includes('wfsBU') ? { estado: 200, texto: VACIA } : { estado: 200, texto: CP_WFS },
    })

    edificios.destruir()

    const suyo = await catastro.parcelaPorRefcat(REFCAT_URBANA)
    expect(
      suyo.ok,
      'destruir el cliente de edificio ha dejado muda la rama de parcela: el transporte es ' +
        'compartido y NO se puede abortar desde aquí',
    ).toBe(true)
    expect(red.total).toBeGreaterThan(0)

    // Y este cliente sí queda inerte, sin tocar la red.
    const peticiones = red.total
    const mio = await edificios.edificioPorRefcat(REFCAT_URBANA)
    expect(mio.motivo).toBe(MOTIVO_CATASTRO.CANCELADA)
    expect(red.total).toBe(peticiones)
  })

  it('⚠️ la asimetría contraria, ANCLADA: destruir el cliente de parcela deja mudo a este', async () => {
    // No es un defecto de este módulo —`crearClienteCatastro.destruir()` aborta el
    // transporte, y su cabecera lo declara— pero es una trampa viva para el
    // cableado: el ORDEN importa. Queda en un test para que nadie la descubra.
    const { edificios, catastro, red } = montar()
    catastro.destruir()
    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.CANCELADA)
    expect(red.total, 'ni una petición: el transporte ya estaba abortado').toBe(0)
  })

  it('`destruir()` es idempotente y no borra los contadores', async () => {
    const { edificios } = montar()
    await edificios.edificioPorRefcat(REFCAT_URBANA)
    edificios.destruir()
    edificios.destruir()
    expect(edificios.estado().cargas).toBe(1)
    expect(edificios.estado().peticiones).toBe(CONSULTAS_POR_CARGA)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9 · LA CACHÉ
// ─────────────────────────────────────────────────────────────────────────────

describe('la caché: todo-o-nada, texto crudo y sin tocar `storage/`', () => {
  it('la segunda carga no toca la red y lo dice desde el propio resultado', async () => {
    const cache = crearCacheDeMemoria()
    let reloj = 1_000
    const { edificios, red } = montar({ cache, ahora: () => reloj })

    const primera = await edificios.edificioPorRefcat(REFCAT_URBANA)
    expect(primera.procedencia.origen).toBe('RED')
    expect(red.total).toBe(CONSULTAS_POR_CARGA)

    reloj += 6 * 24 * 3_600_000 // seis días después
    const segunda = await edificios.edificioPorRefcat(REFCAT_URBANA)

    expect(red.total, 'la segunda carga ha vuelto a la red').toBe(CONSULTAS_POR_CARGA)
    expect(segunda.procedencia.origen).toBe('CACHE')
    expect(segunda.procedencia.edadMs).toBe(6 * 24 * 3_600_000)
    expect(segunda.procedencia.url, 'de la caché no se pidió ninguna URL').toBeNull()
    expect(segunda.procedencia.consultas).toBe(0)
    expect(segunda.procedencia.intentos).toBe(0)
    // Y el dato es el mismo, reconstruido desde los bytes.
    expect(segunda.datos.partes).toHaveLength(primera.datos.partes.length)
    expect(segunda.datos.otras[0].constructionNature).toBe('openAirPool')
  })

  it('se guarda el TEXTO del GML, no el POJO ya leído', async () => {
    const cache = crearCacheDeMemoria()
    const { edificios } = montar({ cache })
    await edificios.edificioPorRefcat(REFCAT_URBANA)

    expect(cache.datos.size).toBe(CONSULTAS_POR_CARGA)
    for (const { valor } of cache.datos.values()) {
      expect(typeof valor, 'un POJO cacheado congelaría los fallos del lector de hoy').toBe(
        'string',
      )
      expect(valor).toContain('FeatureCollection')
    }
  })

  it('las claves llevan un prefijo que `storage/cache-catastro.js` ya sabe enrutar', async () => {
    const cache = crearCacheDeMemoria()
    const { edificios } = montar({ cache })
    await edificios.edificioPorRefcat(REFCAT_URBANA)

    // `storage/cache-catastro.js#rutaDe` LANZA con un prefijo desconocido, y hoy
    // solo conoce `parcela:` y `revgeo:`. Un prefijo nuevo obligaría a un almacén
    // nuevo y a su migración; con el sufijo propio la entrada es inconfundible.
    for (const clave of cache.datos.keys()) {
      expect(clave.startsWith('parcela:')).toBe(true)
      expect(clave).toContain(SRS_DEFAULT)
      expect(clave).toContain(REFCAT_URBANA)
    }
    // Las dos consultas tienen clave PROPIA: compartirla serviría una por la otra.
    expect(new Set(cache.datos.keys()).size).toBe(CONSULTAS_POR_CARGA)
  })

  it('TODO-O-NADA: con una sola entrada guardada se vuelve a la red por las dos', async () => {
    const cache = crearCacheDeMemoria()
    const { edificios, red } = montar({ cache })
    await edificios.edificioPorRefcat(REFCAT_URBANA)

    // El navegador desaloja una de las dos.
    cache.datos.delete([...cache.datos.keys()][1])
    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)

    expect(red.total).toBe(2 * CONSULTAS_POR_CARGA)
    expect(
      r.procedencia.origen,
      'un acierto a medias no puede salir como CACHE: la edad solo valdría para la mitad',
    ).toBe('RED')
  })

  it('el SRS entra en la clave: dos husos son dos entradas', async () => {
    const cache = crearCacheDeMemoria()
    const { edificios, red } = montar({ cache })
    await edificios.edificioPorRefcat(REFCAT_URBANA)
    await edificios.edificioPorRefcat(REFCAT_URBANA, { srs: 'EPSG:25829' })
    expect(cache.datos.size).toBe(2 * CONSULTAS_POR_CARGA)
    expect(red.total).toBe(2 * CONSULTAS_POR_CARGA)
  })

  it('un fallo de la caché avisa por el canal y NO cambia el resultado', async () => {
    const alLeer = montar({ cache: crearCacheDeMemoria({ falloAlLeer: true }) })
    const r1 = await alLeer.edificios.edificioPorRefcat(REFCAT_URBANA)
    expect(r1.ok, 'un fallo de LECTURA no puede impedir traer el edificio').toBe(true)
    expect(alLeer.avisos.some((a) => a.mensaje.includes('caché'))).toBe(true)

    const alGuardar = montar({ cache: crearCacheDeMemoria({ falloAlGuardar: true }) })
    const r2 = await alGuardar.edificios.edificioPorRefcat(REFCAT_URBANA)
    expect(r2.ok, 'un fallo de ESCRITURA no puede convertir un acierto en un error').toBe(true)
    expect(alGuardar.avisos.some((a) => a.mensaje.includes('caché'))).toBe(true)
    expect(alGuardar.edificios.estado().fallosCache).toBeGreaterThan(0)
  })

  it('un cuerpo cacheado que ya no se puede leer se ignora y se va a la red, sin avisar', async () => {
    const cache = crearCacheDeMemoria()
    const { edificios, red, avisos } = montar({ cache })
    await edificios.edificioPorRefcat(REFCAT_URBANA)

    for (const clave of cache.datos.keys()) {
      cache.datos.set(clave, { valor: 'esto ya no es un GML', guardadoEn: 0 })
    }
    const avisosAntes = avisos.length
    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)

    expect(r.ok, 'degradar a «más lento» sí; a «roto» no').toBe(true)
    expect(r.procedencia.origen).toBe('RED')
    expect(red.total).toBe(2 * CONSULTAS_POR_CARGA)
    expect(avisos.length, 'al usuario no le ha pasado nada: tiene su edificio igual').toBe(
      avisosAntes,
    )
  })

  it('sin caché inyectada, `CACHE_NULA`: funciona entero y no guarda nada', async () => {
    const { edificios } = montar()
    const primera = await edificios.edificioPorRefcat(REFCAT_URBANA)
    const segunda = await edificios.edificioPorRefcat(REFCAT_URBANA)
    expect(primera.ok && segunda.ok).toBe(true)
    expect(segunda.procedencia.origen).toBe('RED')
    expect(edificios.estado().deCache).toBe(0)
  })

  it('la edad de una carga cacheada es la de la entrada MÁS VIEJA', async () => {
    const cache = crearCacheDeMemoria()
    let reloj = 0
    const { edificios } = montar({ cache, ahora: () => reloj })
    await edificios.edificioPorRefcat(REFCAT_URBANA)

    // Una de las dos se «refresca» a mano: la edad del conjunto tiene que seguir
    // siendo la de la otra, o el renglón presentaría como reciente medio dato viejo.
    const claves = [...cache.datos.keys()]
    cache.datos.set(claves[0], { ...cache.datos.get(claves[0]), guardadoEn: 900 })
    reloj = 1_000

    const r = await edificios.edificioPorRefcat(REFCAT_URBANA)
    expect(r.procedencia.origen).toBe('CACHE')
    expect(r.procedencia.edadMs).toBe(1_000)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10 · CONTRATO DEL PROGRAMADOR
// ─────────────────────────────────────────────────────────────────────────────

describe('el contrato roto por el programador LANZA; el dato del usuario no', () => {
  const conTransporte = () =>
    crearTransporte({ fetch: crearDobleFetch().fetch, dormir: crearDobleDormir().dormir })

  it('valida sus inyecciones al crear el cliente, no en la primera consulta', () => {
    expect(() => crearClienteEdificio(null)).toThrow(TypeError)
    expect(() => crearClienteEdificio({ transporte: conTransporte(), cache: {} })).toThrow(
      /CacheCatastro/,
    )
    expect(() => crearClienteEdificio({ transporte: conTransporte(), ahora: 'ya' })).toThrow(
      /'ahora'/,
    )
    // El huso se descubre al cablear, no media hora después.
    expect(() => crearClienteEdificio({ transporte: conTransporte(), srs: 'EPSG:9999' })).toThrow()
  })

  it('`edificioPorRefcat` valida sus opciones y su SRS', async () => {
    const { edificios } = montar()
    await expect(edificios.edificioPorRefcat(REFCAT_URBANA, null)).rejects.toThrow(TypeError)
    await expect(
      edificios.edificioPorRefcat(REFCAT_URBANA, { srs: 'EPSG:9999' }),
    ).rejects.toThrow()
  })

  it('`estado()` devuelve una FOTO, no una referencia que cambia sola', async () => {
    const { edificios } = montar()
    const antes = edificios.estado()
    await edificios.edificioPorRefcat(REFCAT_URBANA)
    expect(antes.cargas).toBe(0)
    expect(edificios.estado().cargas).toBe(1)
    expect(edificios.estado().deRed).toBe(1)
    expect(edificios.estado().peticiones).toBe(CONSULTAS_POR_CARGA)
  })

  it('la API pública son tres funciones y ninguna más', () => {
    const { edificios } = montar()
    expect(Object.keys(edificios).sort()).toEqual(['destruir', 'edificioPorRefcat', 'estado'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 11 · ANTI-VACUIDAD DEL PROPIO ARNÉS
// ─────────────────────────────────────────────────────────────────────────────

describe('el arnés no es vacuo: los cuerpos son los ficheros reales', () => {
  it('los seis fixtures se han leído y no están vacíos', () => {
    for (const [nombre, texto] of [
      ['allconstruction urbana', TODAS_URBANA],
      ['allconstruction rústica', TODAS_RUSTICA],
      ['colección vacía', VACIA],
      ['404 de ASP.NET', ERROR_404],
      ['13 partes', PARTES_URBANA],
      ['GML de parcela de ENTREGA', CP_ENTREGA],
    ]) {
      expect(texto.length, `${nombre} está vacío`).toBeGreaterThan(100)
    }
  })

  it('el fixture del 404 NO es XML, que es lo que hace real la trampa', () => {
    expect(ERROR_404).toContain('<html')
    expect(ERROR_404).not.toContain('FeatureCollection')
  })

  it('el sobre del GML de parcela de ENTREGA es indistinguible del de este servicio', () => {
    // Sin esto, el caso del apartado 5 pasaría por casualidad: lo que lo hace
    // difícil es que la raíz y el contenedor son LOS MISMOS, y que lo ÚNICO que
    // los separa es el `gml:id` de la colección.
    expect(CP_ENTREGA).toContain('gml:FeatureCollection')
    expect(CP_ENTREGA).toContain('gml:featureMember')
    expect(VACIA).toContain('gml:FeatureCollection')
    expect(CP_ENTREGA).toContain('ES.SDGC.CP')
    expect(VACIA, 'el único discriminante de una colección VACÍA').toContain('ES.SDGC.BU')
  })

  it('la colección vacía NO tiene ni un miembro, y la urbana sí', () => {
    expect((VACIA.match(/<gml:featureMember>/g) ?? []).length).toBe(0)
    expect((TODAS_URBANA.match(/<gml:featureMember>/g) ?? []).length).toBe(2)
    expect((PARTES_URBANA.match(/<gml:featureMember>/g) ?? []).length).toBe(13)
  })

  it('los cinco tipos de `TIPO_RESPUESTA_BU` siguen existiendo, y son cinco', () => {
    // Este módulo traduce tres de ellos y deja dos como camino de éxito. Si el
    // catálogo creciera sin que aquí se decidiera, el módulo no cargaría.
    expect(Object.keys(TIPO_RESPUESTA_BU)).toHaveLength(5)
  })
})
