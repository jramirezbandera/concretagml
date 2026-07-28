/* -------------------------------------------------------------------------- *
 * test/services/catastro-ovc.test.js — F05 · Geocodificación inversa del        *
 * Catastro (OVC `Consulta_RCCOOR`).                                            *
 *                                                                              *
 * NADA de lo que se afirma aquí está escrito a mano. Los tres fixtures de       *
 * `test/fixtures/catastro/` son verdad externa (regla de oro 8) y este fichero  *
 * los lee del disco y DERIVA de ellos todo lo que comprueba: la referencia      *
 * catastral se compone con los dos campos del propio fixture, el `cod` se lee   *
 * del fichero, y hasta las URL medidas salen de `PROCEDENCIA.md`, que documenta *
 * con qué petición exacta se capturó cada respuesta. Un `expect(...)            *
 * .toBe('9398516VK3799G')` sería una opinión con formato de aserción.           *
 *                                                                              *
 * EL TEST QUE IMPORTA es el de `ovc-rccoor-cod76.json`. Ese fichero es lo que   *
 * devuelve el endpoint JSON cuando se le mandan los nombres de parámetro del    *
 * OTRO endpoint (el `.asmx`): HTTP 200, `control.cuerr:1`, y un `cod:"76"` que  *
 * dice «LA COORDENADA X OBLIGATORIA». Tiene la misma forma que un «aquí no hay  *
 * parcela», así que un lector ingenuo se lo cuenta al usuario como resultado    *
 * negativo cuando en realidad es un bug NUESTRO, presente en todas las          *
 * peticiones y reparable en una línea. Aquí se exige que salga como ILEGIBLE, y *
 * hay además una prueba negativa explícita —el `describe` de la tabla— que deja *
 * por escrito qué pasaría si alguien "arreglara" el problema metiendo el 76 en  *
 * `COD_OVC_SIN_REFERENCIA`.                                                     *
 *                                                                              *
 * Proyecto Vitest `node` (sin sufijo `.dom`): lógica pura, ni DOM ni red. Que   *
 * este módulo no toque la red se comprueba, además, leyendo su propio texto.    *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

import {
  CATASTRO_OVC_RCCOOR_JSON,
  CLAVE_ENVOLTORIO_RCCOOR,
  COD_OVC_SIN_REFERENCIA,
  LONGITUD_REFCAT_PARCELA,
  PARAM_RCCOOR,
  TIPO_RCCOOR,
  esCodSinReferencia,
  leerRccoor,
  urlRccoor,
} from '../../services/_catastro-ovc.js'
import { HUSOS_VALIDOS, srsPorHuso } from '../../geo/huso.js'

// ── Los ficheros de verdad externa ────────────────────────────────────────────

const DIR_FIXTURES = fileURLToPath(new URL('../fixtures/catastro/', import.meta.url))
const RUTA_MODULO = fileURLToPath(new URL('../../services/_catastro-ovc.js', import.meta.url))

/** Texto crudo de un fixture, decodificado como UTF-8 (ver `PROCEDENCIA.md`). */
const texto = (fichero) => readFileSync(`${DIR_FIXTURES}${fichero}`, 'utf8')

const TEXTO_OK = texto('ovc-rccoor-ok.json')
const TEXTO_COD16 = texto('ovc-rccoor-cod16.json')
const TEXTO_COD76 = texto('ovc-rccoor-cod76.json')
const PROCEDENCIA = texto('PROCEDENCIA.md')

/** El cuerpo ya parseado, para poder DERIVAR de él lo que se espera del módulo. */
const json = (t) => JSON.parse(t)

/**
 * La URL con la que se capturó un fixture, leída de su ficha en `PROCEDENCIA.md`.
 * Es la petición REAL, la única que se ha comprobado contra el servicio: atar
 * `urlRccoor` a ella es lo que impide que este test se limite a repetir lo que el
 * módulo hace (si el módulo y el test se equivocaran igual, la URL medida no).
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

const URL_OK = urlMedida('ovc-rccoor-ok.json')
const URL_COD16 = urlMedida('ovc-rccoor-cod16.json')
const URL_COD76 = urlMedida('ovc-rccoor-cod76.json')

/** El `geo` del fixture de éxito: el punto que se consultó, dicho por el servicio. */
const GEO_OK = json(TEXTO_OK)[CLAVE_ENVOLTORIO_RCCOOR].coordenadas.coord[0].geo
const X_OK = Number(GEO_OK.xcen)
const Y_OK = Number(GEO_OK.ycen)
const SRS_OK = GEO_OK.srs

// ── Construcción de la URL ────────────────────────────────────────────────────

describe('urlRccoor · la URL es la MEDIDA, con los nombres de parámetro del .svc/json', () => {
  it('la constante base es el endpoint WCF/JSON y es el prefijo de la URL medida', () => {
    expect(CATASTRO_OVC_RCCOOR_JSON).toContain('.svc/json')
    expect(CATASTRO_OVC_RCCOOR_JSON).not.toContain('.asmx')
    // La constante no se inventa: es exactamente el trozo de la petición real que
    // va antes de la `?`.
    expect(URL_OK.startsWith(`${CATASTRO_OVC_RCCOOR_JSON}?`)).toBe(true)
  })

  it('reproduce BYTE A BYTE la petición con la que se capturó el fixture de éxito', () => {
    // Las coordenadas y el SRS salen del propio fixture (`geo`), no de una copia
    // a mano de la URL: si el módulo se desviara de la petición medida —por
    // ejemplo escapando el dos puntos del SRS, u ordenando otra cosa— aquí se ve.
    expect(urlRccoor(X_OK, Y_OK, SRS_OK)).toBe(URL_OK)
  })

  it('las claves de la query son exactamente SRS, CoorX y CoorY', () => {
    const q = new URL(urlRccoor(X_OK, Y_OK, SRS_OK)).searchParams
    expect([...q.keys()].sort()).toEqual(['CoorX', 'CoorY', 'SRS'])
    expect(q.get('CoorX')).toBe(String(X_OK))
    expect(q.get('CoorY')).toBe(String(Y_OK))
    expect(q.get('SRS')).toBe(SRS_OK)
    // Y son las que el módulo declara en un solo sitio.
    expect(PARAM_RCCOOR).toEqual({ srs: 'SRS', x: 'CoorX', y: 'CoorY' })
    expect(Object.isFrozen(PARAM_RCCOOR)).toBe(true)
  })

  it('ANTI-REGRESIÓN: no existe ninguna clave `Coordenada_X`/`Coordenada_Y`', () => {
    const q = new URL(urlRccoor(X_OK, Y_OK, SRS_OK)).searchParams
    expect(q.has('Coordenada_X')).toBe(false)
    expect(q.has('Coordenada_Y')).toBe(false)
    // …y la comprobación NO es vacua: la URL que produjo el fixture del cod 76 —el
    // error que se persigue— sí lleva esos nombres. Es la petición equivocada
    // hecha de verdad, no un supuesto.
    const mala = new URL(URL_COD76).searchParams
    expect(mala.has('Coordenada_X')).toBe(true)
    expect(mala.has('CoorX')).toBe(false)
    expect(urlRccoor(X_OK, Y_OK, SRS_OK)).not.toBe(URL_COD76)
  })

  it('el SRS va en forma corta con UN dos puntos, y la del WFS (dos) se rechaza', () => {
    expect(new URL(urlRccoor(X_OK, Y_OK, SRS_OK)).searchParams.get('SRS')).toBe('EPSG:25830')
    // `EPSG::25830` es la forma del WFS del MISMO organismo. Aquí no vale, y no
    // vale ruidosamente: mandarla produciría una consulta que el OVC contestaría
    // con un código engañoso.
    expect(() => urlRccoor(X_OK, Y_OK, 'EPSG::25830')).toThrow(RangeError)
  })

  it('acepta los tres SRS que soporta el proyecto, derivados de geo/huso.js', () => {
    for (const huso of HUSOS_VALIDOS) {
      const srs = srsPorHuso(huso)
      // Easting del meridiano central: un punto que cae en España en cualquiera
      // de los tres husos, así que la comprobación no depende de elegir bien.
      const url = new URL(urlRccoor(500000, Y_OK, srs))
      expect(url.searchParams.get('SRS')).toBe(srs)
    }
  })
})

describe('urlRccoor · DEFENSA 1: se valida ANTES de emitir la petición', () => {
  it('el SRS que produjo el fixture cod 16 (EPSG:9999) no se puede volver a emitir', () => {
    // `ovc-rccoor-cod16.json` se capturó con este SRS inventado sobre un punto que
    // SÍ tiene parcela, y el servicio contestó «para esas coordenadas no hay
    // referencia disponible». Esa petición ya no es construible desde aquí: el
    // error engañoso no puede llegar a ocurrir por esta causa.
    const srsInventado = new URL(URL_COD16).searchParams.get('SRS')
    expect(srsInventado).not.toBe(SRS_OK)
    expect(() => urlRccoor(X_OK, Y_OK, srsInventado)).toThrow(RangeError)
  })

  it('un SRS no soportado o no-string revienta sin construir URL', () => {
    expect(() => urlRccoor(X_OK, Y_OK, 'EPSG:4326')).toThrow(RangeError)
    expect(() => urlRccoor(X_OK, Y_OK, 'EPSG:32628')).toThrow(/DIFERIDA|32628/) // Canarias, O13
    expect(() => urlRccoor(X_OK, Y_OK, 25830)).toThrow(TypeError)
  })

  it('una coordenada fuera de España se rechaza antes de la red, con el bbox en el mensaje', () => {
    // Mil kilómetros al norte del punto bueno: sigue siendo una coordenada UTM
    // plausible, pero cae en Francia.
    expect(() => urlRccoor(X_OK, Y_OK + 1_000_000, SRS_OK)).toThrow(RangeError)
    expect(() => urlRccoor(X_OK, Y_OK + 1_000_000, SRS_OK)).toThrow(/no cae dentro de España/)
  })

  it('un punto declarado en el huso equivocado se rechaza SUGIRIENDO el SRS bueno', () => {
    // El mismo punto del fixture (Madrid, huso 30) declarado en el 29 cae en el
    // Atlántico, fuera del bbox. El mensaje no se limita a decir que no vale:
    // nombra el SRS con el que sí caería (regla de oro 1).
    expect(() => urlRccoor(X_OK, Y_OK, srsPorHuso(29))).toThrow(RangeError)
    expect(() => urlRccoor(X_OK, Y_OK, srsPorHuso(29))).toThrow(/¿es ese el SRS del dato\?/)
    expect(() => urlRccoor(X_OK, Y_OK, srsPorHuso(29))).toThrow(new RegExp(SRS_OK))
  })

  it('una coordenada no finita es contrato roto por el programador (TypeError)', () => {
    expect(() => urlRccoor(Number.NaN, Y_OK, SRS_OK)).toThrow(TypeError)
    expect(() => urlRccoor(X_OK, Number.POSITIVE_INFINITY, SRS_OK)).toThrow(TypeError)
    expect(() => urlRccoor('439242.88', Y_OK, SRS_OK)).toThrow(TypeError)
  })
})

// ── Lectura de la respuesta ───────────────────────────────────────────────────

describe('leerRccoor · ovc-rccoor-ok.json: la RC llega PARTIDA y hay que componerla', () => {
  const r = leerRccoor(TEXTO_OK)
  const coordCruda = json(TEXTO_OK)[CLAVE_ENVOLTORIO_RCCOOR].coordenadas.coord[0]

  it('clasifica como CANDIDATOS, con un solo candidato', () => {
    expect(r.tipo).toBe(TIPO_RCCOOR.CANDIDATOS)
    expect(r.cuantos).toBe(1)
    expect(r.unico).toBe(true)
    expect(r.candidatos).toHaveLength(1)
    expect(r.cod).toBeNull()
  })

  it('el refcat es la CONCATENACIÓN de los dos campos del propio fixture, y mide 14', () => {
    // Derivado del fichero, no escrito a mano: el servicio no manda ningún campo
    // con los 14 caracteres juntos, y esa es justo la trampa del formato.
    const esperado = `${coordCruda.pc.pc1}${coordCruda.pc.pc2}`
    expect(r.candidatos[0].refcat).toBe(esperado)
    expect(r.candidatos[0].refcat).toHaveLength(LONGITUD_REFCAT_PARCELA)
    expect(LONGITUD_REFCAT_PARCELA).toBe(coordCruda.pc.pc1.length + coordCruda.pc.pc2.length)
    // Las dos mitades se conservan para poder rastrear de dónde sale la RC.
    expect(r.candidatos[0].pc1).toBe(coordCruda.pc.pc1)
    expect(r.candidatos[0].pc2).toBe(coordCruda.pc.pc2)
  })

  it('conserva el domicilio (`ldt`): es lo único con lo que un humano elige', () => {
    expect(r.candidatos[0].domicilio).toBe(coordCruda.ldt)
    expect(r.mensaje).toContain(coordCruda.ldt)
  })

  it('convierte a números las coordenadas, que el servicio manda como cadenas', () => {
    expect(typeof coordCruda.geo.xcen).toBe('string') // así viene: '439242.88'
    expect(r.candidatos[0].centro).toEqual({
      x: Number(coordCruda.geo.xcen),
      y: Number(coordCruda.geo.ycen),
      srs: coordCruda.geo.srs,
    })
  })

  it('el recuento se CUENTA; el `cucoor` del servicio solo se expone', () => {
    const control = json(TEXTO_OK)[CLAVE_ENVOLTORIO_RCCOOR].control
    expect(r.declarados).toBe(control.cucoor)
    expect(r.cuantos).toBe(r.candidatos.length)
  })
})

describe('leerRccoor · varios candidatos: no se rellena nada a ciegas', () => {
  it('con dos candidatos, `unico` es false y el mensaje manda dejar elegir', () => {
    // Se DUPLICA el candidato real del fixture (no se inventa uno): un punto en un
    // linde devuelve más de una entrada en `coordenadas.coord`, que es un array.
    const cuerpo = json(TEXTO_OK)
    const uno = cuerpo[CLAVE_ENVOLTORIO_RCCOOR].coordenadas.coord[0]
    const otro = structuredClone(uno)
    otro.pc.pc2 = 'VK3799H' // misma manzana, otra parcela
    otro.ldt = 'CL SAN RESTITUTO 74 MADRID (MADRID)'
    cuerpo[CLAVE_ENVOLTORIO_RCCOOR].coordenadas.coord = [uno, otro]

    const r = leerRccoor(JSON.stringify(cuerpo))
    expect(r.tipo).toBe(TIPO_RCCOOR.CANDIDATOS)
    expect(r.cuantos).toBe(2)
    expect(r.unico).toBe(false)
    expect(r.candidatos.map((c) => c.refcat)).toEqual([
      `${uno.pc.pc1}${uno.pc.pc2}`,
      `${otro.pc.pc1}${otro.pc.pc2}`,
    ])
    expect(r.mensaje).toMatch(/dejar elegir/)
    // Los dos domicilios van en el mensaje: sin ellos la lista es ilegible.
    expect(r.mensaje).toContain(uno.ldt)
    expect(r.mensaje).toContain(otro.ldt)
  })
})

describe('leerRccoor · ovc-rccoor-cod16.json: «aquí no hay parcela» (estado válido)', () => {
  const r = leerRccoor(TEXTO_COD16)
  const errCrudo = json(TEXTO_COD16)[CLAVE_ENVOLTORIO_RCCOOR].lerr[0]

  it('clasifica como SIN_REFERENCIA con el cod y el des leídos del fichero', () => {
    expect(r.tipo).toBe(TIPO_RCCOOR.SIN_REFERENCIA)
    expect(r.cod).toBe(errCrudo.cod)
    expect(r.des).toBe(errCrudo.des)
    expect(r.candidatos).toEqual([])
    expect(r.cuantos).toBe(0)
    expect(r.unico).toBe(false)
  })

  it('ese cod ESTÁ en COD_OVC_SIN_REFERENCIA, que es lo que lo hace un «no hay»', () => {
    expect(esCodSinReferencia(errCrudo.cod)).toBe(true)
    expect(Object.keys(COD_OVC_SIN_REFERENCIA)).toContain(errCrudo.cod)
  })

  it('el mensaje dice que es un estado válido, no un fallo', () => {
    expect(r.mensaje).toContain(errCrudo.des)
    expect(r.mensaje).toMatch(/estado VÁLIDO, no un fallo/)
  })
})

describe('leerRccoor · ovc-rccoor-cod76.json: ILEGIBLE, y NO «no encontrado»', () => {
  const r = leerRccoor(TEXTO_COD76)
  const errCrudo = json(TEXTO_COD76)[CLAVE_ENVOLTORIO_RCCOOR].lerr[0]

  it('el fixture tiene la MISMA forma que el de «no hay parcela» (por eso engaña)', () => {
    // Las dos respuestas traen `control.cuerr:1` y un `lerr` con `cod`/`des`. Lo
    // único que las distingue es el código, y de ahí que la tabla sea la defensa.
    const cuerpo16 = json(TEXTO_COD16)[CLAVE_ENVOLTORIO_RCCOOR]
    const cuerpo76 = json(TEXTO_COD76)[CLAVE_ENVOLTORIO_RCCOOR]
    expect(Object.keys(cuerpo76)).toEqual(Object.keys(cuerpo16))
    expect(cuerpo76.control).toEqual(cuerpo16.control)
    expect(cuerpo76.lerr[0].cod).not.toBe(cuerpo16.lerr[0].cod)
  })

  it('NO se clasifica como SIN_REFERENCIA: es RESPUESTA_ILEGIBLE', () => {
    expect(r.tipo).toBe(TIPO_RCCOOR.RESPUESTA_ILEGIBLE)
    expect(r.tipo).not.toBe(TIPO_RCCOOR.SIN_REFERENCIA)
    expect(r.candidatos).toEqual([])
  })

  it('el mensaje trae el cod y el des LITERALES del servicio', () => {
    expect(r.cod).toBe(errCrudo.cod)
    expect(r.des).toBe(errCrudo.des)
    expect(r.mensaje).toContain(errCrudo.cod)
    expect(r.mensaje).toContain(errCrudo.des)
  })

  it('el mensaje culpa a ESTA APLICACIÓN, no a una parcela inexistente', () => {
    // Es la diferencia entre que el usuario se vaya a buscar otra parcela y que el
    // programador arregle el bug. La frase tiene que estar, y tiene que negar
    // explícitamente la lectura equivocada.
    expect(r.mensaje).toMatch(/FALLO DE ESTA APLICACIÓN/)
    expect(r.mensaje).toMatch(/NO a que en ese punto no haya parcela/)
    // Y nombra la causa concreta y conocida: los nombres del otro endpoint.
    expect(r.mensaje).toContain('Coordenada_X')
  })
})

describe('COD_OVC_SIN_REFERENCIA · la prueba NEGATIVA, para quien venga a "arreglarlo"', () => {
  it('el 76 NO está en la tabla, y esa ausencia es lo que sostiene el caso anterior', () => {
    // ⛔ SI ALGUIEN AÑADIERA '76' A `COD_OVC_SIN_REFERENCIA`, el fixture
    // `ovc-rccoor-cod76.json` pasaría a clasificarse como SIN_REFERENCIA y la app
    // le diría al usuario «aquí no hay parcela» cada vez que la URL esté mal
    // construida — que es SIEMPRE, porque el 76 no depende del punto: significa
    // «falta la coordenada X», o sea que estamos usando los nombres de parámetro
    // del endpoint `.asmx` en el endpoint JSON. El bug quedaría invisible y el
    // usuario concluiría que el Catastro está caído. Este test está aquí para que
    // ese cambio no se pueda hacer sin leer esto.
    const cod76 = json(TEXTO_COD76)[CLAVE_ENVOLTORIO_RCCOOR].lerr[0].cod
    expect(cod76).toBe('76')
    expect(esCodSinReferencia(cod76)).toBe(false)
    expect(Object.keys(COD_OVC_SIN_REFERENCIA)).not.toContain(cod76)
  })

  it('la regla se DERIVA de la tabla: lo que está dentro es «no hay», lo de fuera ilegible', () => {
    // Se construye una respuesta con cada código de la tabla a partir del fixture
    // real, cambiándole solo el `cod`: así la correspondencia tabla → clasificación
    // queda comprobada para toda la tabla, no para la única entrada de hoy.
    const plantilla = json(TEXTO_COD16)
    const conCod = (cod) => {
      const c = structuredClone(plantilla)
      c[CLAVE_ENVOLTORIO_RCCOOR].lerr[0].cod = cod
      return leerRccoor(JSON.stringify(c))
    }
    for (const cod of Object.keys(COD_OVC_SIN_REFERENCIA)) {
      expect(conCod(cod).tipo).toBe(TIPO_RCCOOR.SIN_REFERENCIA)
    }
    for (const cod of ['76', '99', '0', 'XX']) {
      expect(esCodSinReferencia(cod)).toBe(false)
      expect(conCod(cod).tipo).toBe(TIPO_RCCOOR.RESPUESTA_ILEGIBLE)
    }
  })

  it('basta UN código desconocido entre varios para que la respuesta sea ilegible', () => {
    const cuerpo = json(TEXTO_COD16)
    const conocido = cuerpo[CLAVE_ENVOLTORIO_RCCOOR].lerr[0]
    const desconocido = json(TEXTO_COD76)[CLAVE_ENVOLTORIO_RCCOOR].lerr[0]
    cuerpo[CLAVE_ENVOLTORIO_RCCOOR].lerr = [conocido, desconocido]
    const r = leerRccoor(JSON.stringify(cuerpo))
    expect(r.tipo).toBe(TIPO_RCCOOR.RESPUESTA_ILEGIBLE)
    expect(r.cod).toBe('76') // el desconocido, que es el que hay que investigar
  })

  it('la tabla y sus entradas están congeladas, y cada entrada dice de dónde sale', () => {
    expect(Object.isFrozen(COD_OVC_SIN_REFERENCIA)).toBe(true)
    for (const [cod, entrada] of Object.entries(COD_OVC_SIN_REFERENCIA)) {
      expect(Object.isFrozen(entrada)).toBe(true)
      expect(entrada.cod).toBe(cod)
      expect(entrada.motivo.length).toBeGreaterThan(0)
    }
    expect(Object.isFrozen(TIPO_RCCOOR)).toBe(true)
  })

  it('esCodSinReferencia no se deja engañar por las claves heredadas de Object', () => {
    expect(esCodSinReferencia('constructor')).toBe(false)
    expect(esCodSinReferencia('toString')).toBe(false)
    // El cod medido es una CADENA: si llegara numérico, es un cambio de formato y
    // se trata como ilegible, no como «no hay parcela».
    expect(esCodSinReferencia(16)).toBe(false)
  })
})

describe('leerRccoor · el ENVOLTORIO y las respuestas que no se entienden', () => {
  it('sin `Consulta_RCCOORResult` no hay nada que leer, aunque el contenido sea válido', () => {
    // El mismo cuerpo del fixture bueno, desenvuelto: todo cuelga del envoltorio y
    // omitirlo es leer `undefined` y concluir cualquier cosa.
    const desenvuelto = JSON.stringify(json(TEXTO_OK)[CLAVE_ENVOLTORIO_RCCOOR])
    const r = leerRccoor(desenvuelto)
    expect(r.tipo).toBe(TIPO_RCCOOR.RESPUESTA_ILEGIBLE)
    expect(r.mensaje).toContain(CLAVE_ENVOLTORIO_RCCOOR)
  })

  it('un cuerpo que no es JSON (una página de error, un proxy) sale ilegible, no revienta', () => {
    const r = leerRccoor('<html><body>503 Service Unavailable</body></html>')
    expect(r.tipo).toBe(TIPO_RCCOOR.RESPUESTA_ILEGIBLE)
    expect(r.mensaje).toMatch(/no es JSON válido/)
  })

  it('una referencia catastral que no mide 14 caracteres es ilegible', () => {
    const cuerpo = json(TEXTO_OK)
    cuerpo[CLAVE_ENVOLTORIO_RCCOOR].coordenadas.coord[0].pc.pc2 = 'VK379' // 5, no 7
    const r = leerRccoor(JSON.stringify(cuerpo))
    expect(r.tipo).toBe(TIPO_RCCOOR.RESPUESTA_ILEGIBLE)
    expect(r.mensaje).toContain(String(LONGITUD_REFCAT_PARCELA))
  })

  it('`coordenadas.coord` que no es un array es ilegible (no se colapsa a uno)', () => {
    const cuerpo = json(TEXTO_OK)
    const [uno] = cuerpo[CLAVE_ENVOLTORIO_RCCOOR].coordenadas.coord
    cuerpo[CLAVE_ENVOLTORIO_RCCOOR].coordenadas.coord = uno // objeto suelto
    expect(leerRccoor(JSON.stringify(cuerpo)).tipo).toBe(TIPO_RCCOOR.RESPUESTA_ILEGIBLE)
  })

  it('un `coord` VACÍO no se traduce a «no hay parcela»: ese caso no está medido', () => {
    const cuerpo = json(TEXTO_OK)
    cuerpo[CLAVE_ENVOLTORIO_RCCOOR].coordenadas.coord = []
    const r = leerRccoor(JSON.stringify(cuerpo))
    expect(r.tipo).toBe(TIPO_RCCOOR.RESPUESTA_ILEGIBLE)
    expect(r.mensaje).toMatch(/no está medido/)
  })

  it('un `cuerr` sin `lerr` que lo enumere es ilegible', () => {
    const cuerpo = json(TEXTO_COD16)
    delete cuerpo[CLAVE_ENVOLTORIO_RCCOOR].lerr
    expect(leerRccoor(JSON.stringify(cuerpo)).tipo).toBe(TIPO_RCCOOR.RESPUESTA_ILEGIBLE)
  })

  it('un envoltorio sin `lerr` ni `coordenadas` es ilegible', () => {
    const r = leerRccoor(JSON.stringify({ [CLAVE_ENVOLTORIO_RCCOOR]: { control: {} } }))
    expect(r.tipo).toBe(TIPO_RCCOOR.RESPUESTA_ILEGIBLE)
  })

  it('el resultado tiene SIEMPRE la misma forma, sea cual sea el tipo', () => {
    const claves = (r) => Object.keys(r).sort()
    const forma = claves(leerRccoor(TEXTO_OK))
    expect(forma).toEqual([
      'candidatos',
      'cod',
      'cuantos',
      'declarados',
      'des',
      'mensaje',
      'tipo',
      'unico',
    ])
    expect(claves(leerRccoor(TEXTO_COD16))).toEqual(forma)
    expect(claves(leerRccoor(TEXTO_COD76))).toEqual(forma)
    // Y el mensaje nunca va vacío: es lo que la UI enseña (regla de oro 1).
    for (const t of [TEXTO_OK, TEXTO_COD16, TEXTO_COD76]) {
      expect(leerRccoor(t).mensaje.length).toBeGreaterThan(0)
    }
  })

  it('pasar algo que no es texto es contrato roto por el programador (TypeError)', () => {
    // Un objeto ya parseado es el error típico: el transporte da texto.
    expect(() => leerRccoor(json(TEXTO_OK))).toThrow(TypeError)
    expect(() => leerRccoor(null)).toThrow(TypeError)
    expect(() => leerRccoor(undefined)).toThrow(TypeError)
  })
})

describe('el módulo NO toca la red: entra texto, sale estructura', () => {
  it('su código fuente no contiene ninguna llamada de red', () => {
    // Guardián estático, en la línea de `test/contrato.test.js`: quien pide es el
    // transporte (`services/_red.js`). Si este módulo empezara a pedir por su
    // cuenta, dejaría de poder probarse contra los fixtures del disco y se
    // saltaría la cola y el backoff que protegen del bloqueo del Catastro (O8).
    const fuente = readFileSync(RUTA_MODULO, 'utf8')
    // El lookbehind es sobre `\w` y no sobre `\w|\.`: así `prefetch(` no dispara
    // (falso positivo) pero `window.fetch(` sí (que es una llamada de red real).
    const LLAMA_A_LA_RED = /(?<!\w)fetch\s*\(|XMLHttpRequest|sendBeacon|EventSource/
    expect(LLAMA_A_LA_RED.test(fuente)).toBe(false)
    // La guarda no es vacua: sí dispararía si el módulo pidiera por su cuenta.
    expect(LLAMA_A_LA_RED.test('const r = await fetch(urlRccoor(x, y, srs))')).toBe(true)
    expect(LLAMA_A_LA_RED.test('const r = await window.fetch(url)')).toBe(true)
    expect(LLAMA_A_LA_RED.test('// el prefetch de la tesela es otra cosa')).toBe(false)
  })
})
