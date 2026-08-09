/* -------------------------------------------------------------------------- *
 * test/edificio/entrada.test.js — F11 · Las tres fábricas de entrada (T2.1)   *
 *                                                                            *
 * `edificio/entrada.js` es la única capa que decide el ORIGEN de una parte,   *
 * su nombre y el mapeo INSPIRE → modelo, y todos sus modos de fallo son EN    *
 * VERDE: un bloqueo de la OTRA rama reenviado a ciegas (y la fase entera se   *
 * queda sin su caso normal), una piscina que entra como vivienda sin decirlo, *
 * trece pares de plantas tirados en silencio, o una RC deducida desde un      *
 * punto que cae en la parcela del vecino. Por eso aquí:                       *
 *                                                                            *
 *   · Los NÚMEROS se LEEN del fichero, no del enunciado. Los vértices de las  *
 *     trece partes salen de un oráculo de expresiones regulares sobre el XML  *
 *     crudo ({@link contarPosList}), independiente de `gml/parse-bu.js`; el   *
 *     reparto por capas sale del propio DXF ({@link contarCapasDxf}).         *
 *   · Cada guardián trae su MITAD ANTI-VACUIDAD: se demuestra que `importar`  *
 *     SÍ bloquea el fixture de edificio (y por eso el filtro hace falta), que *
 *     el centroide aritmético de una parte en L cae FUERA de ella (y por eso  *
 *     `puntoDeReferencia` no puede ser el centroide), y que la envolvente del *
 *     `Building` no está entre las partes.                                    *
 *   · Y lo que el plan pedía comparar se COMPARA calculando la diferencia, no *
 *     afirmándola: los dos `Edificio` de las vías GML y WFS se diffean campo  *
 *     a campo y se exige que la única discrepancia sea el `origen`.           *
 *                                                                            *
 * Proyecto Vitest `node`: POJOs, texto y XML. Ni DOM, ni red, ni reloj.       *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'

import {
  CONDICION_A_ESTADO,
  REFERENCIA_SUPERFICIE_CONSTRUIDA,
  VIA,
  entradaDesdeGmlBu,
  entradaDesdeTexto,
  entradaDesdeWfsBu,
  puntoDeReferencia,
} from '../../edificio/entrada.js'
import { MOTIVO_ENTRADA, TIPO_EDIFICIO } from '../../edificio/_comun.js'
// F21 · la envolvente y la validación entran aquí porque el criterio 2 de la ficha
// se mide sobre el edificio que ESTA capa construye: comprobarlo en el módulo de al
// lado dejaría sin guardián justo la juntura que estuvo mal tres fases.
import { envolventeDe } from '../../edificio/envolvente.js'
import { validarEdificio } from '../../validation/edificio.js'
import { superficie } from '../../geo/area.js'
import { parsearGmlBu } from '../../gml/parse-bu.js'
import {
  ESTADO_CONSERVACION,
  MODELO_EDIFICIO,
  ORIGEN_PARTE,
  TIPO_PARTE,
  crearEdificio,
  crearParteConstruccion,
} from '../../model/edificio.js'
import { avisoDeSuperficie } from '../../app/cableado-medicion.js'
import { SUJETO_CONSTRUCCION } from '../../parsers/_comun.js'
import { BLOQUEOS_SOLO_PARCELA, importar } from '../../parsers/importar.js'

// ── Arnés ─────────────────────────────────────────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')

/** Un fichero de texto del repo, decodificado con el encoding que él declara. */
function leerGml(rel) {
  const bytes = readFileSync(join(RAIZ, ...rel.split('/')))
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  return new TextDecoder(m ? m[1] : 'utf-8').decode(bytes)
}

/** Un DXF del repo. Los DXF de este proyecto son ASCII de 8 bits (latin1). */
const leerDxf = (rel) => readFileSync(join(RAIZ, ...rel.split('/')), 'latin1')

const DXF_EDIFICIO = leerDxf('test/fixtures/parsers/edificio_consulta_masiva_3515508VF0831N.dxf')
const DXF_UTM = leerDxf('test/fixtures/parsers/UTM.dxf')
const TXT_LIST = leerDxf('test/fixtures/parsers/LIST.txt')
const TXT_PARCELA = leerDxf('test/fixtures/parsers/PARCELA.txt')

const GML_PARTES = leerGml('test/fixtures/gml/bu_buildingpart_9398516VK3799G.gml')
const GML_BUILDING = leerGml('test/fixtures/gml/bu_building_9398516VK3799G.gml')
const GML_TODO = leerGml('test/fixtures/catastro/wfsbu-allconstruction-9398516VK3799G.xml')
const GML_RUSTICA = leerGml('test/fixtures/catastro/wfsbu-allconstruction-13005A10900001.xml')
const GML_VACIO = leerGml('test/fixtures/catastro/wfsbu-coleccion-vacia-13005A10900001.xml')
const GML_PARCELA = leerGml('test/fixtures/gml/cp_parcela_9398516VK3799G.gml')

/**
 * ORÁCULO 1 — los vértices de cada anillo del GML, leídos con una expresión
 * regular sobre el texto crudo. Independiente de `gml/parse-bu.js`: si el lector
 * se dejara un anillo, este oráculo seguiría contándolo.
 *
 * ⚠️ Devuelve los pares CERRADOS (que es lo que cuenta el atributo `count` del
 * Catastro, medido en la fase 0). El anillo abierto que guarda el modelo tiene
 * uno menos: regla de oro 4.
 */
function contarPosList(xml) {
  const cerrados = []
  const re = /<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const numeros = m[1].trim().split(/\s+/).filter((t) => t.length > 0)
    cerrados.push(numeros.length / 2)
  }
  return cerrados
}

/**
 * ORÁCULO 2 — el reparto por capas de un DXF, leído del código de grupo 8 de
 * cada `LWPOLYLINE`/`POLYLINE`. Independiente de `parsers/dxf.js`.
 *
 * En un DXF ASCII los pares van en dos líneas: el código y su valor. Se recorre
 * la lista buscando cada entidad y, dentro de ella, el primer código 8.
 *
 * ⚠️ **Acotado a la sección `ENTITIES`, y hace falta**: escrito sin acotar contaba
 * 40 polilíneas en `UTM.dxf` en vez de 25, porque la sección `BLOCKS` trae las
 * definiciones del cajetín con sus propias polilíneas en la capa «0». Un oráculo
 * más generoso que el módulo que vigila no vigila nada.
 */
function contarCapasDxf(dxf) {
  const todas = dxf.split(/\r?\n/).map((l) => l.trim())
  let ini = -1
  for (let i = 0; i + 3 < todas.length; i++) {
    if (
      todas[i] === '0' &&
      todas[i + 1] === 'SECTION' &&
      todas[i + 2] === '2' &&
      todas[i + 3] === 'ENTITIES'
    ) {
      ini = i + 4
      break
    }
  }
  if (ini < 0) throw new Error('contarCapasDxf: el fichero no tiene sección ENTITIES.')
  let fin = todas.length
  for (let i = ini; i + 1 < todas.length; i++) {
    if (todas[i] === '0' && todas[i + 1] === 'ENDSEC') {
      fin = i
      break
    }
  }

  const lineas = todas.slice(ini, fin)
  const reparto = {}
  for (let i = 0; i + 1 < lineas.length; i++) {
    if (lineas[i] !== '0') continue
    const entidad = lineas[i + 1]
    if (entidad !== 'LWPOLYLINE' && entidad !== 'POLYLINE') continue
    for (let j = i + 2; j + 1 < lineas.length && lineas[j] !== '0'; j += 2) {
      if (lineas[j] === '8') {
        reparto[lineas[j + 1]] = (reparto[lineas[j + 1]] ?? 0) + 1
        break
      }
    }
  }
  return reparto
}

/** Los tipos de detección presentes, en orden. */
const tipos = (entrada) => entrada.detecciones.map((d) => d.tipo)

/** Las detecciones de un tipo. */
const de = (entrada, tipo) => entrada.detecciones.filter((d) => d.tipo === tipo)

/** El anillo CERRADO de una parte, en forma de polígono de Turf. */
const poligonoDe = (parte) => ({
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [[...parte.recinto.vertices, parte.recinto.vertices[0]]],
  },
})

/** Media aritmética de los vértices: el centroide que NO se debe usar. */
function centroide(vertices) {
  let sx = 0
  let sy = 0
  for (const [x, y] of vertices) {
    sx += x
    sy += y
  }
  return [sx / vertices.length, sy / vertices.length]
}

/** Parte con contorno, para los tests de `puntoDeReferencia`. */
const parteCon = (nombre, vertices) =>
  crearParteConstruccion({
    nombre,
    recinto: { vertices, tipo: 'EXTERIOR' },
    origen: ORIGEN_PARTE.DIBUJADA,
  })

/** Una L de 500 m² en UTM: su centroide aritmético cae en el hueco de la L. */
const EN_L = [
  [440000, 4100000],
  [440030, 4100000],
  [440030, 4100010],
  [440010, 4100010],
  [440010, 4100030],
  [440000, 4100030],
]

/** Cuadrado de `lado` m² con la esquina inferior izquierda en (x0, y0). */
const cuadrado = (x0, y0, lado) => [
  [x0, y0],
  [x0 + lado, y0],
  [x0 + lado, y0 + lado],
  [x0, y0 + lado],
]

// ══════════════════════════════════════════════════════════════════════════════
// 1 · entradaDesdeTexto — DXF, LIST y TXT
// ══════════════════════════════════════════════════════════════════════════════

describe('entradaDesdeTexto — el DXF de edificio real', () => {
  const entrada = entradaDesdeTexto(DXF_EDIFICIO)

  it('⭐ NO sale bloqueado, y ésa es la prueba del filtro BLOQUEOS_SOLO_PARCELA', () => {
    // MITAD ANTI-VACUIDAD: `importar` SÍ lo bloquea, con los dos códigos de la
    // otra rama. Si esta primera parte dejara de cumplirse, el filtro habría
    // dejado de hacer falta y este test tiene que enterarse.
    const crudo = importar(DXF_EDIFICIO)
    expect(crudo.resumen.bloqueos).toEqual(['ANILLOS_EN_VARIAS_CAPAS', 'SUPERFICIE_NO_POSITIVA'])
    expect(crudo.parcela).toBeNull()
    for (const b of crudo.resumen.bloqueos) {
      expect(BLOQUEOS_SOLO_PARCELA, `${b} debería ser un bloqueo SOLO de parcela`).toContain(b)
    }

    // Y la rama EDIFICIO pasa: para un edificio cada anillo es su propio exterior.
    expect(entrada.resumen.bloqueos).toEqual([])
    expect(entrada.resumen.construido).toBe(true)
    expect(entrada.edificio).not.toBeNull()
  })

  it('una polilínea = una parte, con el reparto por capas del fichero', () => {
    const reparto = contarCapasDxf(DXF_EDIFICIO)
    expect(reparto).toEqual({ Construccion: 7, Parcela: 1 })

    expect(entrada.resumen.nPartes).toBe(8)
    expect(entrada.edificio.partes).toHaveLength(8)
    // `resumen.capas` es 1:1 con las partes y trae el nombre LITERAL de la capa.
    const contadas = {}
    for (const c of entrada.resumen.capas) contadas[c] = (contadas[c] ?? 0) + 1
    expect(contadas).toEqual(reparto)
    expect(entrada.resumen.capas).toHaveLength(entrada.resumen.nPartes)
  })

  it('las partes nacen con nombre genérico, PRINCIPAL, plantas sin asignar y origen DXF', () => {
    expect(entrada.edificio.partes.map((p) => p.nombre)).toEqual([
      'Parte 1',
      'Parte 2',
      'Parte 3',
      'Parte 4',
      'Parte 5',
      'Parte 6',
      'Parte 7',
      'Parte 8',
    ])
    for (const p of entrada.edificio.partes) {
      expect(p.tipo).toBe(TIPO_PARTE.PRINCIPAL)
      expect(p.origen).toBe(ORIGEN_PARTE.DXF)
      expect(p.plantasSobreRasante).toBeNull()
      expect(p.plantasBajoRasante).toBeNull()
      expect(p.recinto).not.toBeNull()
    }
    expect(entrada.resumen.nVertices).toEqual(
      entrada.edificio.partes.map((p) => p.recinto.vertices.length),
    )
  })

  it('un volcado de CAD NO es geometría oficial: construccionOficial se queda a null', () => {
    // Es la medición del técnico, no lo que el Catastro tiene registrado. El
    // término de comparación de F14 solo lo fijan las vías de GML y WFS.
    expect(entrada.edificio.construccionOficial).toBeNull()
    expect(entrada.edificio.parcelaContexto).toBeNull()
    expect(entrada.edificio.modelo).toBe(MODELO_EDIFICIO.SIMPLIFICADO)
  })

  // ⛔ CORREGIDO EL 2026-08-04, y lo destapó el GUION DE HUMO 13, no esta suite.
  //
  // Aquí ponía «arrastra TODAS las detecciones de importar, sin tocarlas», y esa
  // era la decisión de T2.1: filtrar los BLOQUEOS de parcela y reenviar las
  // detecciones tal cual. En pantalla eso produjo una contradicción medida: la
  // rama EDIFICIO decía a la vez «Cargadas 7 partes… 62 vértices en total» y «El
  // contorno menos los huecos da −13,32 m² con 7 anillo(s)… **No se construye la
  // parcela**». Las dos frases eran ciertas por separado; juntas no hay forma de
  // leerlas. Y esta suite estaba VERDE, porque el `it` de abajo exigía justamente
  // el reenvío completo.
  //
  // La lección, que no es sobre detecciones: **filtrar un bloqueo y no filtrar su
  // detección deja fuera la mitad que el usuario LEE.** El filtro tiene dos mitades
  // y las dos usan la misma lista publicada (`BLOQUEOS_SOLO_PARCELA`).
  it('arrastra las detecciones de importar SALVO las que hablan del reparto de parcela', () => {
    // ⚠️ **Con el MISMO sujeto**, y es una corrección de F14 y no un aflojamiento.
    // Lo que este `it` defiende es que no se PIERDA ninguna detección por el
    // camino; desde F14 `entradaDesdeTexto` le pide a `importar` que hable de una
    // CONSTRUCCIÓN, así que tres de sus mensajes cambian de sujeto a propósito.
    // Comparar contra el defecto («la parcela») haría fallar este guardián sobre un
    // cambio correcto —y, peor, tapa el otro: sin igualar el sujeto no se sabría si
    // la detección se perdió o si solo cambió de palabras—. Que el sujeto cambie de
    // verdad lo afirma el `it` de más abajo.
    const crudo = importar(DXF_EDIFICIO, { sujeto: SUJETO_CONSTRUCCION })
    const delReparto = crudo.detecciones.filter((d) => d?.datos?.bloqueo !== undefined)
    // El fixture real las produce: si dejara de hacerlo, este `it` estaría
    // afirmando un filtro sobre un conjunto vacío.
    expect(delReparto.length).toBeGreaterThan(0)

    for (const d of crudo.detecciones) {
      const esperada = d.datos?.bloqueo === undefined
      expect(
        entrada.detecciones.some((e) => e.tipo === d.tipo && e.mensaje === d.mensaje),
        esperada
          ? `se ha perdido la detección ${d.tipo} de importar`
          : `la detección ${d.tipo} habla del reparto de parcela (${d.datos.bloqueo}) y no debería llegar a la rama EDIFICIO`,
      ).toBe(esperada)
    }
    expect(entrada.resumen.detecciones.total).toBe(entrada.detecciones.length)
  })

  it('⭐ F14 · los avisos del importador hablan de la CONSTRUCCIÓN, no de la parcela', () => {
    // La deuda de F11 · fase 5, pagada. Son avisos sobre fallos REALES del fichero
    // —«el centroide de la parcela no cae en España», «no son geometría de
    // parcela», «deja solo la polilínea de la parcela en la capa 0»— y contarlos
    // sobre el objeto equivocado hace buscar el problema donde no está.
    //
    // Se compara contra el MISMO fichero leído como parcela, que es el oráculo
    // independiente: si `entradaDesdeTexto` dejara de fijar el sujeto, los dos
    // conjuntos volverían a ser idénticos y esto saldría rojo.
    const comoParcela = importar(DXF_EDIFICIO)
    const textos = entrada.detecciones.map((d) => d.mensaje).join('\n')
    const textosParcela = comoParcela.detecciones.map((d) => d.mensaje).join('\n')

    expect(textos, 'los avisos de la rama EDIFICIO siguen hablando de «la parcela»').not.toMatch(
      /\bla parcela\b|geometría de parcela/i,
    )
    // Y el oráculo dice que ese fichero SÍ los produce cuando se lee como parcela:
    // sin esto, la afirmación de arriba se cumpliría también con cero avisos.
    expect(textosParcela).toMatch(/\bla parcela\b|geometría de parcela/i)
    expect(textos).toMatch(/construcción/i)

    // ⛔ Y la guía del CAD no es la de parcela con otro sustantivo: a una parcela
    // se le dice «deja SOLO la polilínea», y aquí eso perdería una parte por cada
    // polilínea de más.
    if (textos.includes('LIMPIA (PURGE)')) {
      expect(textos).not.toContain('Deja solo la polilínea')
      expect(textos).toContain('una por parte')
    }
  })

  it('⛔ y la contradicción concreta que se vio en pantalla no vuelve', () => {
    // El síntoma, literal: partes cargadas y a la vez «No se construye la parcela».
    // Son OCHO y no siete porque este `entrada` se lee sin elegir capa: 7 de
    // `Construccion` + 1 de `Parcela`. En pantalla eran 7 porque el usuario había
    // pasado por el diálogo de reparto; la contradicción es la misma con las dos.
    expect(entrada.resumen.nPartes).toBe(8)
    expect(entrada.edificio).not.toBeNull()
    for (const d of entrada.detecciones) {
      expect(d.mensaje).not.toMatch(/No se construye la parcela/)
      expect(d.mensaje).not.toMatch(/el primero es el contorno y los demás son huecos/)
    }
  })
})

describe('entradaDesdeTexto — la elección de capa (decisión 5: ofrecer, no imponer)', () => {
  it('con opts.capa entra solo esa capa, y las demás se dicen UNA A UNA', () => {
    const entrada = entradaDesdeTexto(DXF_EDIFICIO, { capa: 'Construccion' })
    expect(entrada.resumen.nPartes).toBe(7)
    expect(new Set(entrada.resumen.capas)).toEqual(new Set(['Construccion']))

    const descartadas = de(entrada, TIPO_EDIFICIO.CAPA_DXF_DESCARTADA)
    expect(descartadas).toHaveLength(1)
    expect(descartadas[0].datos).toMatchObject({
      capa: 'Parcela',
      anillos: 1,
      capaElegida: 'Construccion',
    })
    // El nombre LITERAL de la capa va en el mensaje: el usuario reconoce el suyo.
    expect(descartadas[0].mensaje).toContain('«Parcela»')
  })

  it('⛔ elegir capa NO basta: en UTM.dxf la capa «PARCELA» deja 3 anillos disjuntos', () => {
    // Medido por T1.1: con `{capa:'PARCELA'}` la rama parcela lo bloquea. Para un
    // EDIFICIO no hay nada que bloquear —tres anillos disjuntos son tres partes— y
    // por eso ese código está en BLOQUEOS_SOLO_PARCELA y aquí se filtra.
    //
    // ⭐ **Desde F22 el código dice literalmente lo que este test se llama.** Antes
    // era `SUPERFICIE_NO_POSITIVA` —la consecuencia aritmética de leer tres fincas
    // como un contorno con huecos—; ahora es `VARIOS_RECINTOS_DISJUNTOS`, que es la
    // causa. Para esta rama no cambia nada, y ése es justo el punto: la frase «tres
    // anillos disjuntos son tres partes» ya la decía el comentario y ahora la dice
    // también el dato.
    const crudo = importar(DXF_UTM, { capa: 'PARCELA' })
    expect(crudo.resumen.bloqueos).toContain('VARIOS_RECINTOS_DISJUNTOS')

    const entrada = entradaDesdeTexto(DXF_UTM, { capa: 'PARCELA' })
    expect(entrada.resumen.bloqueos).toEqual([])
    expect(entrada.resumen.nPartes).toBe(3)
    // Y las otras CUATRO capas del plano se nombran una a una.
    expect(de(entrada, TIPO_EDIFICIO.CAPA_DXF_DESCARTADA).map((d) => d.datos.capa).sort()).toEqual(
      ['0', 'BLANCO', 'FINO', 'LINDE'],
    )
  })

  it('sin elegir capa entran las 25 polilíneas de UTM.dxf, mobiliario de dibujo incluido', () => {
    // No se adivina: se importa lo que hay y la interfaz enseña el reparto. En
    // `UTM.dxf` la parcela de verdad está en la capa «0», NO en la llamada
    // «PARCELA» (T0.2·2), así que elegir por el nombre habría fallado.
    const entrada = entradaDesdeTexto(DXF_UTM)
    expect(entrada.resumen.nPartes).toBe(25)
    expect(de(entrada, TIPO_EDIFICIO.CAPA_DXF_DESCARTADA)).toHaveLength(0)
    const contadas = {}
    for (const c of entrada.resumen.capas) contadas[c] = (contadas[c] ?? 0) + 1
    expect(contadas).toEqual(contarCapasDxf(DXF_UTM))
    expect(contadas).toEqual({ FINO: 16, LINDE: 4, PARCELA: 3, BLANCO: 1, 0: 1 })
  })
})

describe('entradaDesdeTexto — LIST y TXT', () => {
  it('un pegado de LISTA entra como UNA parte, sin capas inventadas', () => {
    const entrada = entradaDesdeTexto(TXT_LIST)
    expect(entrada.resumen.via).toBe(VIA.LIST)
    expect(entrada.resumen.origen).toBe(ORIGEN_PARTE.LIST)
    expect(entrada.resumen.nPartes).toBe(1)
    expect(entrada.edificio.partes[0].origen).toBe(ORIGEN_PARTE.LIST)
    // `importar` rellena `capas` con '' porque necesita un array 1:1; aquí se
    // dice `null`, que es «esta vía no tiene capas» y no «se llaman vacío».
    expect(importar(TXT_LIST).resumen.capas).toEqual([''])
    expect(entrada.resumen.capas).toBeNull()
  })

  it('un TXT de dos columnas entra igual, con su propio origen', () => {
    const entrada = entradaDesdeTexto(TXT_PARCELA)
    expect(entrada.resumen.via).toBe(VIA.TXT)
    expect(entrada.resumen.origen).toBe(ORIGEN_PARTE.TXT)
    expect(entrada.edificio.partes).toHaveLength(1)
    expect(entrada.edificio.partes[0].origen).toBe(ORIGEN_PARTE.TXT)
    expect(entrada.resumen.capas).toBeNull()
  })

  it('el formato se puede imponer, y entonces formatoAutodetectado es false', () => {
    expect(entradaDesdeTexto(TXT_PARCELA).resumen.formatoAutodetectado).toBe(true)
    expect(entradaDesdeTexto(TXT_PARCELA, { formato: 'TXT' }).resumen.formatoAutodetectado).toBe(
      false,
    )
  })
})

describe('entradaDesdeTexto — lo que sí bloquea, y lo que lanza', () => {
  it('un volcado sin geometría bloquea con SIN_GEOMETRIA y NO lanza', () => {
    const entrada = entradaDesdeTexto('')
    expect(entrada.resumen.bloqueos).toEqual([MOTIVO_ENTRADA.SIN_GEOMETRIA])
    expect(entrada.edificio).toBeNull()
    expect(entrada.resumen.construido).toBe(false)
    expect(entrada.resumen.nPartes).toBe(0)
  })

  it('coordenadas en grados bloquean con COORDENADAS_EN_GRADOS (dato malo, no excepción)', () => {
    const entrada = entradaDesdeTexto('-5.26 36.93\n-5.25 36.93\n-5.25 36.94\n')
    expect(entrada.resumen.bloqueos).toContain(MOTIVO_ENTRADA.COORDENADAS_EN_GRADOS)
    expect(entrada.edificio).toBeNull()
  })

  it('coordenadas fuera de España bloquean con HUSO_NO_RESUELTO', () => {
    const entrada = entradaDesdeTexto('500000 1000000\n500100 1000000\n500100 1000100\n')
    expect(entrada.resumen.bloqueos).toContain(MOTIVO_ENTRADA.HUSO_NO_RESUELTO)
    expect(entrada.edificio).toBeNull()
    expect(entrada.resumen.huso).toBeNull()
  })

  it('un modelo inválido LANZA: es contrato del programador, no dato del usuario', () => {
    expect(() => entradaDesdeTexto(TXT_PARCELA, { modelo: 'simplificado' })).toThrow(RangeError)
    expect(() => entradaDesdeTexto(TXT_PARCELA, { modelo: 'simplificado' })).toThrow(
      /opts\.modelo.*SIMPLIFICADO, COMPLETO/s,
    )
  })

  it('un texto que no es string LANZA (lo lanza importar, y se deja subir)', () => {
    expect(() => entradaDesdeTexto(42)).toThrow(TypeError)
  })

  it('opts.refcat, opts.modelo y opts.parcelaContexto llegan al modelo', () => {
    const contexto = [{ vertices: cuadrado(440000, 4100000, 50), tipo: 'EXTERIOR' }]
    const entrada = entradaDesdeTexto(TXT_PARCELA, {
      refcat: '9398516VK3799G',
      modelo: MODELO_EDIFICIO.COMPLETO,
      parcelaContexto: contexto,
    })
    expect(entrada.edificio.refcat).toBe('9398516VK3799G')
    expect(entrada.edificio.modelo).toBe(MODELO_EDIFICIO.COMPLETO)
    expect(entrada.edificio.parcelaContexto).toEqual(contexto)
    // Copia defensiva: el modelo no comparte referencias con la entrada.
    expect(entrada.edificio.parcelaContexto).not.toBe(contexto)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2 · entradaDesdeGmlBu — el dialecto de edificio
// ══════════════════════════════════════════════════════════════════════════════

describe('entradaDesdeGmlBu — las trece partes del fixture real', () => {
  const entrada = entradaDesdeGmlBu(GML_PARTES)

  it('produce una parte por anillo, con los vértices que el fichero declara', () => {
    // ORÁCULO: los pares de cada `posList`, contados sobre el XML crudo. El
    // modelo guarda el anillo ABIERTO, así que se le quita el de cierre.
    const cerrados = contarPosList(GML_PARTES)
    expect(cerrados).toHaveLength(13)
    expect(entrada.resumen.nPartes).toBe(13)
    expect(entrada.resumen.nVertices).toEqual(cerrados.map((n) => n - 1))
  })

  it('todas nacen PRINCIPAL, con origen GML_EXISTENTE y nombre genérico', () => {
    expect(entrada.resumen.via).toBe(VIA.GML_EXISTENTE)
    expect(entrada.resumen.origen).toBe(ORIGEN_PARTE.GML_EXISTENTE)
    expect(new Set(entrada.edificio.partes.map((p) => p.tipo))).toEqual(
      new Set([TIPO_PARTE.PRINCIPAL]),
    )
    expect(new Set(entrada.edificio.partes.map((p) => p.origen))).toEqual(
      new Set([ORIGEN_PARTE.GML_EXISTENTE]),
    )
    expect(entrada.edificio.partes.at(-1).nombre).toBe('Parte 13')
  })

  it('⭐ las plantas ENTRAN, y se dicen: las trece, con sus números', () => {
    // ⛔ **F12 · fase 5 · esta prueba afirmaba lo contrario**, y lo afirmaba bien:
    // F11 tiraba las plantas por alcance y lo decía. **F12 es la fase que las
    // recoge** y llegó a la fase 5 sin que nadie tocara `partesDeFeature`: la
    // suite seguía verde porque ninguna prueba pedía que llegaran al modelo. Lo
    // destapó el guion 19 en un navegador real —cero rótulos romanos sobre trece
    // huellas—, no esta suite.
    const crudo = parsearGmlBu(GML_PARTES)
    expect(entrada.edificio.partes.map((p) => p.plantasSobreRasante)).toEqual(
      crudo.partes.map((p) => p.numberOfFloorsAboveGround),
    )
    expect(entrada.edificio.partes.map((p) => p.plantasBajoRasante)).toEqual(
      crudo.partes.map((p) => p.numberOfFloorsBelowGround),
    )
    // MITAD ANTI-VACUIDAD: si el lector devolviera `null` en las trece —el fallo
    // silencioso del namespace equivocado—, esto pasaría comparando nada con nada.
    expect(crudo.partes.every((p) => p.numberOfFloorsAboveGround !== null)).toBe(true)

    const dicho = de(entrada, TIPO_EDIFICIO.PLANTAS_DESCARTADAS)
    expect(dicho).toHaveLength(1)
    expect(dicho[0].datos.partes).toHaveLength(13)
    // Los números salen del lector, no de este fichero de test: se comprueba que
    // son EXACTAMENTE los que el documento trae.
    expect(dicho[0].datos.partes.map((p) => p.arriba)).toEqual(
      crudo.partes.map((p) => p.numberOfFloorsAboveGround),
    )
    expect(dicho[0].datos.partes.map((p) => p.abajo)).toEqual(
      crudo.partes.map((p) => p.numberOfFloorsBelowGround),
    )
    // ⭐ Y el aviso ya NO dice que se pierdan: lo marca `datos.entran`, que es lo
    // que un llamante puede mirar sin leer el texto (el tipo sigue llamándose
    // `PLANTAS_DESCARTADAS` y es deuda declarada, no un olvido).
    expect(dicho[0].datos.entran).toBe(true)
    expect(dicho[0].mensaje).not.toMatch(/NO las guarda/i)
  })

  it('⛔ part10 es SOLO bajo rasante: entra marcada, no se descarta', () => {
    // ORÁCULO: el documento declara exactamente un `numberOfFloorsAboveGround` a 0.
    const ceros = GML_PARTES.match(/<bu-ext2d:numberOfFloorsAboveGround>0</g) ?? []
    expect(ceros).toHaveLength(1)

    const dicho = de(entrada, TIPO_EDIFICIO.PARTE_BAJO_RASANTE)
    expect(dicho).toHaveLength(1)
    expect(dicho[0].datos.partes).toEqual([
      { localId: '9398516VK3799G_part10', indice: 9, abajo: 1 },
    ])
    expect(dicho[0].mensaje).toContain('9398516VK3799G_part10')
    // Y sigue estando: la parte 10 conserva sus 35 vértices.
    expect(entrada.edificio.partes[9].recinto.vertices).toHaveLength(35)
    expect(entrada.resumen.nPartes).toBe(13)
  })

  it('la RC sale del documento, y NO de recortar el localId', () => {
    // `bu-core2d:reference` solo existe en el `Building`, y aquí no hay ninguno:
    // la RC sale del `refcat=` del xlink de `cadastralParcels`, que sí llevan las
    // partes. Cortar el `localId` daría '9398516VK3799' o '9398516VK3799G_part1'.
    expect(entrada.edificio.refcat).toBe('9398516VK3799G')
    expect(parsearGmlBu(GML_PARTES).edificio).toBeNull()
  })

  it('⭐ la geometría del Catastro ES la oficial: se guarda congelada (regla de oro 2)', () => {
    expect(entrada.edificio.construccionOficial).toHaveLength(13)
    expect(Object.isFrozen(entrada.edificio.construccionOficial)).toBe(true)
    expect(Object.isFrozen(entrada.edificio.construccionOficial[0].recinto.vertices)).toBe(true)
    expect(entrada.edificio.construccionOficial[0].recinto.vertices).toEqual(
      entrada.edificio.partes[0].recinto.vertices,
    )
    // Copia INDEPENDIENTE: no comparte referencias con las partes editables.
    expect(entrada.edificio.construccionOficial[0]).not.toBe(entrada.edificio.partes[0])
  })

  it('el huso NO se deduce: sale del srsName que declara el documento', () => {
    expect(entrada.resumen.huso).toMatchObject({ zona: 30, srs: 'EPSG:25830', ambiguo: false })
    expect(entrada.resumen.huso.lat).toBeGreaterThan(40)
    expect(entrada.resumen.huso.lon).toBeLessThan(0)
    // Y `capas` es null: un GML no tiene capas y no se le inventan.
    expect(entrada.resumen.capas).toBeNull()
  })
})

describe('entradaDesdeGmlBu — la piscina, la envolvente y los atributos', () => {
  const entrada = entradaDesdeGmlBu(GML_TODO)

  it('⭐ F21 · la piscina se lee y entra con su TIPO, sin avisar de ningún forzado', () => {
    // ⛔ Este `it` exigía lo contrario —«entra como PRINCIPAL y se DICE que es un
    // tipo forzado»— y estuvo verde tres fases defendiendo el defecto que F21
    // arregla. El convenio de F11 («el tipo correcto se asigna en F12») caducó sin
    // que nadie lo recogiera.
    expect(entrada.resumen.nPartes).toBe(1)
    expect(entrada.edificio.partes[0].tipo).toBe(TIPO_PARTE.OTRA)
    // ORÁCULO: el documento trae una `OtherConstruction` con esa naturaleza, y el
    // tipo sale de la LISTA en la que viene, no del `constructionNature`.
    expect(GML_TODO).toContain('bu-ext2d:OtherConstruction')
    expect(GML_TODO).toContain('openAirPool')

    // El aviso que decía el forzado ya no tiene hecho que contar, y su tipo no
    // existe en el léxico: se comprueba por la CADENA, para que esto siga siendo
    // legible cuando nadie recuerde qué fue `TIPO_PARTE_FORZADO`.
    expect(entrada.detecciones.map((d) => d.tipo)).not.toContain('TIPO_PARTE_FORZADO')
    expect(TIPO_EDIFICIO.TIPO_PARTE_FORZADO).toBeUndefined()
  })

  it('⭐ F21 · y por eso `puedeGenerar` es true sin teclearle plantas a una piscina', () => {
    // ⛔ LA MEDIDA QUE DEFINE LA FASE. Con la piscina como PRINCIPAL,
    // `validation/edificio.js` la rechazaba —correctamente en su marco— por no
    // declarar plantas sobre rasante… que es un dato que una piscina NO TIENE: el
    // modelo las fuerza a `null` en las partes `OTRA`. El técnico tenía que teclear
    // una mentira para desbloquear el botón.
    const v = validarEdificio(entrada.edificio.partes, { srs: 'EPSG:25830' })
    expect(v.puedeGenerar).toBe(true)
    expect(v.errores).toHaveLength(0)

    // ⭐ MITAD ANTI-VACUIDAD: la regla que lo bloqueaba SIGUE VIVA, y se demuestra
    // sobre la misma geometría con el tipo cambiado a mano. Sin esto, un día que
    // la regla desapareciera esta prueba seguiría verde por el motivo equivocado.
    const comoAntes = [
      crearParteConstruccion({
        nombre: entrada.edificio.partes[0].nombre,
        tipo: TIPO_PARTE.PRINCIPAL,
        recinto: entrada.edificio.partes[0].recinto,
        origen: entrada.edificio.partes[0].origen,
      }),
    ]
    const antes = validarEdificio(comoAntes, { srs: 'EPSG:25830' })
    expect(antes.puedeGenerar).toBe(false)
    expect(antes.errores).toHaveLength(1)
    expect(antes.errores[0].mensaje).toContain('plantas sobre rasante')
  })

  it('⛔ la huella del Building es la ENVOLVENTE: no entra como parte, y se dice', () => {
    const dicho = de(entrada, TIPO_EDIFICIO.PATCHES_MULTIPLES).filter(
      (d) => d.datos.destino === 'DESCARTADA_ENVOLVENTE',
    )
    expect(dicho).toHaveLength(1)
    expect(dicho[0].datos).toMatchObject({ caras: 2, vertices: [4, 52] })

    // MITAD ANTI-VACUIDAD: ninguna parte tiene esos contornos, ni siquiera por
    // casualidad. Si la envolvente se colara, aquí habría un 4 o un 52.
    expect(entrada.resumen.nVertices).toEqual([18])
    // Y sus 56 vértices sí están en el fichero: se descartan, no se pierden.
    expect(contarPosList(GML_TODO)).toEqual([5, 53, 19])
  })

  it('una parte con VARIAS caras entra como varias partes, y se dice', () => {
    // Ningún fixture real lo trae en un `BuildingPart` (el `Building` sí, con dos
    // patches), así que el caso se FABRICA duplicando un `gml:PolygonPatch` del
    // fichero real. {@link mutar} revienta si la sustitución no llega a ocurrir:
    // un caso de prueba que no muta nada es un test que pasa sin mirar.
    const patch = /<gml:PolygonPatch>[\s\S]*?<\/gml:PolygonPatch>/.exec(GML_PARTES)
    expect(patch).not.toBeNull()
    const mutado = GML_PARTES.replace(patch[0], `${patch[0]}\n${patch[0]}`)
    expect(mutado.length).toBeGreaterThan(GML_PARTES.length)

    const entrada = entradaDesdeGmlBu(mutado)
    expect(entrada.resumen.nPartes).toBe(14) // 13 + la cara duplicada
    const dicho = de(entrada, TIPO_EDIFICIO.PATCHES_MULTIPLES).filter(
      (d) => d.datos.destino === 'UNA_PARTE_POR_CARA',
    )
    expect(dicho).toHaveLength(1)
    expect(dicho[0].datos).toMatchObject({ localId: '9398516VK3799G_part1', caras: 2 })
  })

  it('los huecos de una parte NO llegan al modelo, y se dice cuántos eran', () => {
    // La ficha fija «sin huecos en partes» y ningún fichero real trae ninguno:
    // el caso se fabrica metiéndole un `gml:interior` a la piscina.
    const exterior = /<gml:exterior>[\s\S]*?<\/gml:exterior>/.exec(
      GML_TODO.slice(GML_TODO.indexOf('OtherConstruction')),
    )
    expect(exterior).not.toBeNull()
    const interior = exterior[0]
      .replace('<gml:exterior>', '<gml:interior>')
      .replace('</gml:exterior>', '</gml:interior>')
    const mutado = GML_TODO.replace(
      `${exterior[0]}\n              </gml:Polygon>`,
      `${exterior[0]}${interior}\n              </gml:Polygon>`,
    )
    expect(mutado).not.toBe(GML_TODO)

    const entrada = entradaDesdeGmlBu(mutado)
    const dicho = de(entrada, TIPO_EDIFICIO.PATCHES_MULTIPLES).filter(
      (d) => d.datos.destino === 'HUECOS_DESCARTADOS',
    )
    expect(dicho).toHaveLength(1)
    expect(dicho[0].datos).toMatchObject({ localId: '9398516VK3799G_PI.1', huecos: 1 })
    // La parte entra igual, con su contorno: lo que se pierde es el hueco.
    expect(entrada.resumen.nVertices).toEqual([18])
  })

  it('una construcción sin geometría utilizable entra sin contorno, y se dice', () => {
    // Se le quita el `bu-ext2d:geometry` a la piscina: el modelo admite una parte
    // «pendiente de dibujar», pero callarlo dejaría al usuario contando partes
    // que no ve en el mapa.
    const geo = /<bu-ext2d:geometry>[\s\S]*?<\/bu-ext2d:geometry>/g
    const bloques = GML_TODO.match(geo)
    expect(bloques).toHaveLength(2)
    const mutado = GML_TODO.replace(bloques[1], '')
    expect(mutado).not.toBe(GML_TODO)

    const entrada = entradaDesdeGmlBu(mutado)
    expect(entrada.resumen.nPartes).toBe(1)
    expect(entrada.resumen.nVertices).toEqual([0])
    expect(entrada.edificio.partes[0].recinto).toBeNull()
    const dicho = de(entrada, TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA)
    expect(dicho).toHaveLength(1)
    expect(dicho[0].datos.localId).toBe('9398516VK3799G_PI.1')
    // Y esa parte no aporta punto de referencia, pero tampoco revienta.
    expect(puntoDeReferencia(entrada.edificio)).toBeNull()
  })

  it('en SIMPLIFICADO los atributos NO se guardan, y la pérdida se enumera', () => {
    expect(entrada.edificio.modelo).toBe(MODELO_EDIFICIO.SIMPLIFICADO)
    expect('usoDominante' in entrada.edificio).toBe(false)
    const dicho = de(entrada, TIPO_EDIFICIO.ATRIBUTO_NO_MAPEADO)
    expect(dicho).toHaveLength(1)
    expect(dicho[0].datos.modelo).toBe(MODELO_EDIFICIO.SIMPLIFICADO)
    expect(dicho[0].datos.atributosIgnorados.sort()).toEqual([
      'anioConstruccion',
      'estadoConservacion',
      'numeroInmuebles',
      'numeroViviendas',
      'superficieConstruida',
      'usoDominante',
    ])
  })

  it('en COMPLETO se traduce INSPIRE → modelo, valor a valor', () => {
    const completo = entradaDesdeGmlBu(GML_TODO, { modelo: MODELO_EDIFICIO.COMPLETO })
    const crudo = parsearGmlBu(GML_TODO).edificio

    // `functional → FUNCIONAL`: el VALOR se traduce, y solo ese está medido.
    expect(crudo.conditionOfConstruction).toBe('functional')
    expect(completo.edificio.estadoConservacion).toBe(ESTADO_CONSERVACION.FUNCIONAL)
    expect(CONDICION_A_ESTADO.functional).toBe(ESTADO_CONSERVACION.FUNCIONAL)

    // `currentUse → usoDominante`: se traduce el CAMPO, no el valor — el modelo
    // no tiene vocabulario cerrado para el uso y no se le inventa uno.
    expect(crudo.currentUse).toBe('1_residential')
    expect(completo.edificio.usoDominante).toBe('1_residential')

    // `grossFloorArea → superficieConstruida`.
    expect(crudo.officialArea[0].referencia).toBe(REFERENCIA_SUPERFICIE_CONSTRUIDA)
    expect(completo.edificio.superficieConstruida).toBe(crudo.officialArea[0].valor)
    expect(completo.edificio.superficieConstruida).toBe(2513)

    expect(completo.edificio.numeroInmuebles).toBe(18)
    expect(completo.edificio.numeroViviendas).toBe(17)
    // El Catastro refiere la fecha al 1 de enero: al modelo llega el AÑO.
    expect(crudo.dateOfConstruction.beginning).toBe('1997-01-01T00:00:00')
    expect(completo.edificio.anioConstruccion).toBe(1997)
    // `end` NO es una reforma: `anioReforma` se queda vacío, no se inventa.
    expect(completo.edificio.anioReforma).toBeNull()

    // Y en COMPLETO ya no hay nada que no quepa.
    expect(de(completo, TIPO_EDIFICIO.ATRIBUTO_NO_MAPEADO)).toHaveLength(0)
  })

  it('un estado de conservación que no está en el vocabulario se dice, no se aproxima', () => {
    const mutado = GML_TODO.replace('>functional<', '>declined<')
    expect(mutado).not.toBe(GML_TODO) // el caso de prueba tiene que mutar algo
    const entradaMutada = entradaDesdeGmlBu(mutado, { modelo: MODELO_EDIFICIO.COMPLETO })
    expect(entradaMutada.edificio.estadoConservacion).toBeNull()
    const dicho = de(entradaMutada, TIPO_EDIFICIO.ATRIBUTO_NO_MAPEADO)
    expect(dicho).toHaveLength(1)
    expect(dicho[0].datos).toEqual({ atributo: 'estadoConservacion', valorInspire: 'declined' })
    expect('declined' in CONDICION_A_ESTADO).toBe(false)
  })
})

describe('entradaDesdeGmlBu — los tres desenlaces sin edificio', () => {
  it('la colección VACÍA no es un error: bloquea con SIN_CONSTRUCCION y lo explica', () => {
    const entrada = entradaDesdeGmlBu(GML_VACIO)
    expect(entrada.resumen.bloqueos).toEqual([MOTIVO_ENTRADA.SIN_CONSTRUCCION])
    expect(entrada.edificio).toBeNull()
    expect(entrada.resumen.nPartes).toBe(0)
    expect(entrada.resumen.huso).toBeNull()
    const dicho = de(entrada, TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA)
    expect(dicho).toHaveLength(1)
    expect(dicho[0].mensaje).toContain('obra nueva')
    expect(dicho[0].datos.miembros).toBe(0)
  })

  it('un documento con SOLO el Building bloquea, y nombra la consulta que falta', () => {
    for (const xml of [GML_BUILDING, GML_RUSTICA]) {
      const entrada = entradaDesdeGmlBu(xml)
      expect(entrada.resumen.bloqueos).toEqual([MOTIVO_ENTRADA.SIN_CONSTRUCCION])
      expect(entrada.edificio).toBeNull()
      const dicho = de(entrada, TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA)
      expect(dicho[0].mensaje).toContain('GetBuildingPartByParcel')
      expect(dicho[0].datos.miembros).toBeGreaterThan(0)
      // La envolvente se sigue diciendo aunque no haya edificio que construir.
      expect(
        de(entrada, TIPO_EDIFICIO.PATCHES_MULTIPLES).some(
          (d) => d.datos.destino === 'DESCARTADA_ENVOLVENTE',
        ),
      ).toBe(true)
    }
  })

  it('un GML de PARCELA bloquea con DIALECTO_NO_BU y NO lanza', () => {
    const entrada = entradaDesdeGmlBu(GML_PARCELA)
    expect(entrada.resumen.bloqueos).toEqual([MOTIVO_ENTRADA.DIALECTO_NO_BU])
    expect(entrada.edificio).toBeNull()
    // El lector ya ha dicho QUÉ es: aquí solo se le pone el código estable.
    expect(tipos(entrada)).toContain('DIALECTO_OTRO_TEMA')
  })

  it('un XML roto bloquea igual, sin excepción (la lección de F08)', () => {
    const entrada = entradaDesdeGmlBu('<esto no <<< es XML')
    expect(entrada.resumen.bloqueos).toEqual([MOTIVO_ENTRADA.DIALECTO_NO_BU])
    expect(entrada.edificio).toBeNull()
    expect(entrada.detecciones.length).toBeGreaterThan(0)
  })

  it('sin srsName no hay huso, y sin huso no hay dónde situar la geometría', () => {
    const mutado = GML_PARTES.replaceAll('srsName="urn:ogc:def:crs:EPSG::25830"', 'x="1"')
    expect(mutado).not.toBe(GML_PARTES)
    const entrada = entradaDesdeGmlBu(mutado)
    expect(entrada.resumen.bloqueos).toEqual([MOTIVO_ENTRADA.HUSO_NO_RESUELTO])
    expect(entrada.edificio).toBeNull()
    expect(entrada.resumen.huso).toBeNull()
  })

  it('un xml que no es string LANZA: contrato del programador', () => {
    expect(() => entradaDesdeGmlBu(null)).toThrow(TypeError)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3 · entradaDesdeWfsBu — la misma traducción, otra procedencia
// ══════════════════════════════════════════════════════════════════════════════

describe('entradaDesdeWfsBu — el ahorro grande de F11', () => {
  it('⭐ del MISMO dialecto sale el MISMO Edificio: la única diferencia es el origen', () => {
    const porFichero = entradaDesdeGmlBu(GML_PARTES)
    const porServicio = entradaDesdeWfsBu(parsearGmlBu(GML_PARTES))

    // La diferencia se CALCULA, no se afirma: se recorren las dos estructuras y
    // se anota cada ruta que discrepa. Si mañana divergieran en otra cosa, este
    // test dice en qué.
    const diferencias = []
    const comparar = (a, b, ruta) => {
      if (a === b) return
      if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
        a.forEach((_, i) => comparar(a[i], b[i], `${ruta}[${i}]`))
        return
      }
      if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
        const claves = new Set([...Object.keys(a), ...Object.keys(b)])
        for (const k of claves) comparar(a[k], b[k], `${ruta}.${k}`)
        return
      }
      diferencias.push({ ruta, fichero: a, servicio: b })
    }
    comparar(porFichero.edificio, porServicio.edificio, 'edificio')

    expect(diferencias.length).toBeGreaterThan(0) // si no, el test no mira nada
    for (const d of diferencias) {
      expect(d.ruta, `diferencia inesperada en ${d.ruta}`).toMatch(/\.origen$/)
      expect(d.fichero).toBe(ORIGEN_PARTE.GML_EXISTENTE)
      expect(d.servicio).toBe(ORIGEN_PARTE.WFS)
    }
    // 13 partes + 13 en construccionOficial = 26 rutas, y ni una más.
    expect(diferencias).toHaveLength(26)

    // Y las detecciones son LAS MISMAS, en el mismo orden.
    expect(tipos(porServicio)).toEqual(tipos(porFichero))
  })

  it('la vía y la procedencia sí cambian, y eso es lo que se declara', () => {
    const entrada = entradaDesdeWfsBu(parsearGmlBu(GML_TODO))
    expect(entrada.resumen.via).toBe(VIA.WFS)
    expect(entrada.resumen.origen).toBe(ORIGEN_PARTE.WFS)
    // Nadie ha deducido nada: se le ha pedido a un servicio que solo habla BU.
    expect(entrada.resumen.formatoAutodetectado).toBe(false)
    expect(entradaDesdeGmlBu(GML_TODO).resumen.formatoAutodetectado).toBe(true)
  })

  it('la colección vacía del servicio es el punto de partida, no una avería', () => {
    const entrada = entradaDesdeWfsBu(parsearGmlBu(GML_VACIO))
    expect(entrada.resumen.bloqueos).toEqual([MOTIVO_ENTRADA.SIN_CONSTRUCCION])
    expect(entrada.resumen.via).toBe(VIA.WFS)
  })

  it('⭐ el caso completo de la fase: las DOS consultas del WFS fundidas en un edificio', () => {
    // `services/catastro-edificio.js` (T2.2) hace exactamente esta fusión de
    // `GetAllConstructionByParcel` + `GetBuildingPartByParcel`, y su `datos` es un
    // contrato C con campos DE MÁS (`refcat`, `sinConstrucciones`, `consultas`).
    // Se reproduce aquí a mano, sin importar aquel módulo, para que esta capa
    // quede probada contra la FORMA y no contra su implementación.
    const leidos = [parsearGmlBu(GML_TODO), parsearGmlBu(GML_PARTES)]
    const juntado = {
      ok: true,
      refcat: '9398516VK3799G',
      dialecto: leidos[0].dialecto,
      srs: leidos[0].srs,
      srsName: leidos[0].srsName,
      edificio: leidos.find((d) => d.edificio !== null).edificio,
      partes: leidos.flatMap((d) => d.partes),
      otras: leidos.flatMap((d) => d.otras),
      sinConstrucciones: false,
      nMiembros: leidos.reduce((n, d) => n + d.nMiembros, 0),
      consultas: 2,
      detecciones: leidos.flatMap((d) => d.detecciones),
    }

    const entrada = entradaDesdeWfsBu(juntado, { modelo: MODELO_EDIFICIO.COMPLETO })

    // 13 cuerpos + la piscina = 14 partes. La envolvente del Building NO está.
    expect(entrada.resumen.nPartes).toBe(14)
    expect(entrada.resumen.nVertices).toEqual([...contarPosList(GML_PARTES).map((n) => n - 1), 18])
    expect(entrada.edificio.partes.at(-1).nombre).toBe('Parte 14')
    expect(entrada.resumen.bloqueos).toEqual([])

    // ⭐ F21 · LAS TRECE SON CUERPOS Y LA CATORCE ES LA PISCINA, y el reparto sale
    // de las dos listas del documento, no de un nombre ni de una superficie.
    expect(entrada.edificio.partes.map((p) => p.tipo)).toEqual([
      ...Array(13).fill(TIPO_PARTE.PRINCIPAL),
      TIPO_PARTE.OTRA,
    ])

    // Y las cosas que esta fase declara que tira, dichas todas a la vez.
    expect(de(entrada, TIPO_EDIFICIO.PLANTAS_DESCARTADAS)[0].datos.partes).toHaveLength(13)
    expect(de(entrada, TIPO_EDIFICIO.PARTE_BAJO_RASANTE)).toHaveLength(1)
    expect(
      de(entrada, TIPO_EDIFICIO.PATCHES_MULTIPLES).filter(
        (d) => d.datos.destino === 'DESCARTADA_ENVOLVENTE',
      ),
    ).toHaveLength(1)

    // Los atributos del `Building` llegan aunque su geometría no.
    expect(entrada.edificio.superficieConstruida).toBe(2513)
    expect(entrada.edificio.refcat).toBe('9398516VK3799G')
    expect(entrada.edificio.construccionOficial).toHaveLength(14)
  })

  it('⭐ F21 · y la huella que se declararía es 322,13 m², la que el ICUC ACEPTÓ', () => {
    // ⛔⛔ EL CRITERIO 2 DE LA FICHA, Y LA RAZÓN DE SER DE LA FASE. Por esta vía
    // —la del servicio, la que caminó el guion 21 de F14— el `Building` declaraba
    // 406,69 m² en 3 piezas: **84,56 de más, que son la piscina entera**, metida
    // dentro de la huella del edificio en un documento que se firma.
    //
    // ⭐ Y el número bueno NO lo elige esta prueba: **322,13 m² es la cifra que la
    // Sede aceptó** el 2026-08-07 en el ICUC positivo `E1HTN9QN6AKZB4XY`, donde el
    // Catastro declara 322 m² de huella. Es diana de oro EXTERNA, no un snapshot
    // nuestro (F13, y la misma que su round-trip usa vértice a vértice).
    const leidos = [parsearGmlBu(GML_TODO), parsearGmlBu(GML_PARTES)]
    const entrada = entradaDesdeWfsBu({
      ok: true,
      refcat: '9398516VK3799G',
      dialecto: leidos[0].dialecto,
      srs: leidos[0].srs,
      srsName: leidos[0].srsName,
      edificio: leidos.find((d) => d.edificio !== null).edificio,
      partes: leidos.flatMap((d) => d.partes),
      otras: leidos.flatMap((d) => d.otras),
      sinConstrucciones: false,
      nMiembros: leidos.reduce((n, d) => n + d.nMiembros, 0),
      consultas: 2,
      detecciones: leidos.flatMap((d) => d.detecciones),
    })

    const env = envolventeDe(entrada.edificio.partes)
    const area = env.recintos.reduce((t, pieza) => t + superficie(pieza), 0)
    expect(env.recintos).toHaveLength(2)
    expect(area).toBeCloseTo(322.13, 2)

    // La piscina queda fuera POR SER OTRA, y no por ser un sótano: son dos motivos
    // distintos y el segundo sería una clasificación falsa. Se comprueba el motivo,
    // no solo la cifra — declarar 0 plantas da la MISMA superficie por el camino
    // equivocado (medido en la fase 0, M2).
    expect(env.excluidas.map((e) => [e.nombre, e.motivo])).toEqual([
      ['Parte 10', 'SOLO_BAJO_RASANTE'],
      ['Parte 14', 'NO_ES_PRINCIPAL'],
    ])

    // ⭐ MITAD ANTI-VACUIDAD: la piscina no se ha perdido por el camino. Sigue en
    // el modelo, con sus 84,56 m², y es lo que `otrasDe` recoge para emitirla como
    // `OtherConstruction` — la mitad del serializador que F13 dejó SIN llamante
    // vivo por la vía de entrada.
    const otras = entrada.edificio.partes.filter((p) => p.tipo === TIPO_PARTE.OTRA)
    expect(otras).toHaveLength(1)
    expect(superficie([otras[0].recinto])).toBeCloseTo(84.56, 2)
    expect(area + superficie([otras[0].recinto])).toBeCloseTo(406.69, 2)
  })

  it('pasarle el ResultadoEdificioCatastro entero en vez de su `.datos` LANZA', () => {
    const sobre = { ok: true, datos: parsearGmlBu(GML_TODO), motivo: null, origen: 'RED' }
    expect(() => entradaDesdeWfsBu(sobre)).toThrow(TypeError)
    expect(() => entradaDesdeWfsBu(sobre)).toThrow(/\.datos/)
    expect(() => entradaDesdeWfsBu(null)).toThrow(TypeError)
    expect(() => entradaDesdeWfsBu('<xml/>')).toThrow(TypeError)
    // Y lo que SÍ acepta es el `.datos`.
    expect(entradaDesdeWfsBu(sobre.datos).edificio).not.toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4 · puntoDeReferencia — el punto del que se deduce la RC
// ══════════════════════════════════════════════════════════════════════════════

describe('puntoDeReferencia — ⛔ NO es el centroide', () => {
  it('con una parte en L, el centroide cae FUERA y el punto devuelto cae DENTRO', () => {
    const edificio = crearEdificio({ partes: [parteCon('L', EN_L)] })
    const poligono = poligonoDe(edificio.partes[0])

    // MITAD ANTI-VACUIDAD, y la razón de ser de esta función: el centroide
    // aritmético de una L cae en su hueco. El Catastro contestaría con la
    // referencia de la parcela vecina, en silencio (cableado-catastro.js:133-141).
    expect(booleanPointInPolygon(centroide(EN_L), poligono)).toBe(false)

    const punto = puntoDeReferencia(edificio)
    expect(punto).not.toBeNull()
    expect(booleanPointInPolygon(punto, poligono)).toBe(true)
  })

  it('elige la parte de MAYOR superficie, no la primera', () => {
    const pequena = EN_L // 500 m²
    const grande = cuadrado(441000, 4101000, 100) // 10.000 m²
    const edificio = crearEdificio({
      partes: [parteCon('pequeña', pequena), parteCon('grande', grande)],
    })
    const punto = puntoDeReferencia(edificio)
    expect(booleanPointInPolygon(punto, poligonoDe(edificio.partes[1]))).toBe(true)
    expect(booleanPointInPolygon(punto, poligonoDe(edificio.partes[0]))).toBe(false)
  })

  it('con superficies iguales gana la de menor índice: dos llamadas dan lo mismo', () => {
    const edificio = crearEdificio({
      partes: [
        parteCon('a', cuadrado(440000, 4100000, 40)),
        parteCon('b', cuadrado(441000, 4101000, 40)),
      ],
    })
    const punto = puntoDeReferencia(edificio)
    expect(booleanPointInPolygon(punto, poligonoDe(edificio.partes[0]))).toBe(true)
    expect(puntoDeReferencia(edificio)).toEqual(punto)
  })

  it('devuelve el PAR pelado: sus detecciones se descartan (aquí mentirían)', () => {
    // Las de `puntoInterior` hablan del `cp:referencePoint` y de lo que el
    // Catastro rechaza al inscribir. Aquí no se serializa nada, así que
    // republicarlas sería contarle al usuario un problema que no tiene
    // (`app/cableado-catastro.js:1146` hace exactamente esto).
    const punto = puntoDeReferencia(crearEdificio({ partes: [parteCon('L', EN_L)] }))
    expect(Array.isArray(punto)).toBe(true)
    expect(punto).toHaveLength(2)
    expect(punto.every(Number.isFinite)).toBe(true)
  })

  it('sin ninguna parte con contorno utilizable devuelve null, sin lanzar', () => {
    expect(puntoDeReferencia(crearEdificio({ partes: [] }))).toBeNull()
    expect(
      puntoDeReferencia(
        crearEdificio({
          partes: [crearParteConstruccion({ nombre: 'sin dibujar', origen: ORIGEN_PARTE.DIBUJADA })],
        }),
      ),
    ).toBeNull()
    // Menos de 3 vértices no es un recinto: tampoco sirve.
    expect(
      puntoDeReferencia(
        crearEdificio({
          partes: [parteCon('segmento', [[440000, 4100000], [440010, 4100000]])],
        }),
      ),
    ).toBeNull()
  })

  it('una coordenada no publicable NO revienta: esa parte se ignora', () => {
    // `gml/anillos.js#redondearCoord` LANZA con un NaN o con |v| ≥ 1e15. Aquí se
    // filtra antes en vez de envolverlo en un `catch`, que se tragaría también
    // los errores de programación.
    const edificio = crearEdificio({
      partes: [
        parteCon('rota', [
          [Number.NaN, 4100000],
          [440010, 4100000],
          [440010, 4100010],
        ]),
        parteCon('buena', cuadrado(440100, 4100100, 20)),
      ],
    })
    const punto = puntoDeReferencia(edificio)
    expect(booleanPointInPolygon(punto, poligonoDe(edificio.partes[1]))).toBe(true)
  })

  it('cae dentro de una parte REAL del fixture de trece partes', () => {
    const entrada = entradaDesdeGmlBu(GML_PARTES)
    const punto = puntoDeReferencia(entrada.edificio)
    expect(punto).not.toBeNull()
    const dentroDeAlguna = entrada.edificio.partes.some(
      (p) => p.recinto !== null && booleanPointInPolygon(punto, poligonoDe(p)),
    )
    expect(dentroDeAlguna).toBe(true)
  })

  it('lo que no es un Edificio LANZA: contrato del programador', () => {
    expect(() => puntoDeReferencia(null)).toThrow(TypeError)
    expect(() => puntoDeReferencia([])).toThrow(TypeError)
    expect(() => puntoDeReferencia({ refcat: 'x' })).toThrow(/partes/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5 · El contrato D, y que no se cuela ni un bloqueo de la otra rama
// ══════════════════════════════════════════════════════════════════════════════

describe('contrato D — el espejo de ResumenImportacion', () => {
  const CASOS = () => [
    ['DXF', entradaDesdeTexto(DXF_EDIFICIO)],
    ['DXF+capa', entradaDesdeTexto(DXF_EDIFICIO, { capa: 'Construccion' })],
    ['LIST', entradaDesdeTexto(TXT_LIST)],
    ['TXT', entradaDesdeTexto(TXT_PARCELA)],
    ['vacío', entradaDesdeTexto('')],
    ['GML partes', entradaDesdeGmlBu(GML_PARTES)],
    ['GML todo', entradaDesdeGmlBu(GML_TODO)],
    ['GML vacío', entradaDesdeGmlBu(GML_VACIO)],
    ['GML parcela', entradaDesdeGmlBu(GML_PARCELA)],
    ['WFS', entradaDesdeWfsBu(parsearGmlBu(GML_TODO))],
  ]

  it('las CINCO vías devuelven exactamente la misma forma', () => {
    const CLAVES = [
      'via',
      'formatoAutodetectado',
      'origen',
      'nPartes',
      'nVertices',
      'capas',
      'huso',
      'bloqueos',
      'construido',
      'detecciones',
      // F14 · El cotejo contra el «Área:» del volcado. Está en las CINCO vías —es
      // parte de la forma—, y vale `null` en las que no tienen volcado que declare
      // nada. Que la clave exista siempre es lo que impide que un llamante tenga
      // que preguntar antes de mirar.
      'superficie',
      // ⭐ F22 · Los rótulos que el dibujo le pone a cada parte. Mismo criterio que
      // `superficie`: está en las CINCO vías y vale `null` donde no hay fichero que
      // los traiga. F22 **no los usa en esta rama** —no cambia ni un
      // comportamiento—; lo que hace es dejar de tirarlos.
      'rotulos',
    ]
    for (const [nombre, entrada] of CASOS()) {
      expect(Object.keys(entrada).sort(), nombre).toEqual(['detecciones', 'edificio', 'resumen'])
      expect(Object.keys(entrada.resumen).sort(), nombre).toEqual([...CLAVES].sort())
      expect(Object.values(VIA), nombre).toContain(entrada.resumen.via)
      expect(Object.values(ORIGEN_PARTE), nombre).toContain(entrada.resumen.origen)
      expect(entrada.resumen.nVertices, nombre).toHaveLength(entrada.resumen.nPartes)
      expect(entrada.resumen.detecciones.total, nombre).toBe(entrada.detecciones.length)
      expect(typeof entrada.resumen.formatoAutodetectado, nombre).toBe('boolean')
    }
  })

  it('es el espejo de ResumenImportacion, con las dos renombradas y ni una clave suelta', () => {
    const deImportar = Object.keys(importar(DXF_EDIFICIO).resumen)
    const deEntrada = Object.keys(entradaDesdeTexto(DXF_EDIFICIO).resumen)
    // `formato → via`, `nAnillos → nPartes`, `construida → construido`.
    //
    // ⭐ **F14 · `superficie` YA VIAJA, y con el mismo nombre.** Aquí ponía que «no
    // tiene sentido para un edificio de N huellas, así que no viaja», y la primera
    // mitad sigue siendo verdad: el `calculada` de `importar` mide el reparto de
    // una PARCELA (primer anillo menos los demás) y sobre cuerpos disjuntos da un
    // número que no significa nada. Lo que era falso es la conclusión: lo que no
    // sirve es AQUEL número, no el cotejo. Se recalcula sobre las partes, se llama
    // igual y tiene la misma forma —para que `avisoDeSuperficie` lo lea sin
    // cambiar—, y vale `null` cuando no es comparable. Ver `cotejoDeConstruccion`.
    const traducido = deImportar.map(
      (k) => ({ formato: 'via', nAnillos: 'nPartes', construida: 'construido' })[k] ?? k,
    )
    expect(deEntrada.sort()).toEqual(traducido.sort())
  })

  it('`construido` y `bloqueos` no pueden contradecirse, en ninguna vía', () => {
    for (const [nombre, entrada] of CASOS()) {
      expect(entrada.resumen.construido, nombre).toBe(entrada.edificio !== null)
      expect(entrada.resumen.construido, nombre).toBe(entrada.resumen.bloqueos.length === 0)
    }
  })

  it('⛔ ni un bloqueo de la rama PARCELA sale por aquí, y todos son de MOTIVO_ENTRADA', () => {
    const motivos = Object.values(MOTIVO_ENTRADA)
    for (const [nombre, entrada] of CASOS()) {
      for (const b of entrada.resumen.bloqueos) {
        expect(motivos, `${nombre}: ${b} no está en MOTIVO_ENTRADA`).toContain(b)
        expect(BLOQUEOS_SOLO_PARCELA, `${nombre}: ${b} es de la otra rama`).not.toContain(b)
      }
    }
  })

  it('`capas` solo existe en la vía DXF', () => {
    for (const [nombre, entrada] of CASOS()) {
      if (entrada.resumen.via === VIA.DXF) {
        expect(entrada.resumen.capas, nombre).toHaveLength(entrada.resumen.nPartes)
      } else {
        expect(entrada.resumen.capas, nombre).toBeNull()
      }
    }
  })

  it('las detecciones de las tres capas conviven con la MISMA forma', () => {
    // `parsers/_comun.js`, `gml/_comun.js` y `edificio/_comun.js` son catálogos
    // distintos y la forma es una sola: por eso la interfaz las pinta con un
    // componente y `resumirDetecciones` las cuenta sin adaptador.
    for (const [nombre, entrada] of CASOS()) {
      for (const d of entrada.detecciones) {
        expect(typeof d.tipo, nombre).toBe('string')
        expect(typeof d.mensaje, nombre).toBe('string')
        expect(d.mensaje.length, nombre).toBeGreaterThan(0)
        expect(['INFO', 'AVISO', 'ERROR'], nombre).toContain(d.severidad)
      }
      const suma = Object.values(entrada.resumen.detecciones.porSeveridad).reduce(
        (a, b) => a + b,
        0,
      )
      expect(suma, nombre).toBe(entrada.detecciones.length)
    }
  })

  it('los mensajes de esta capa no emiten veredictos (regla de oro 9)', () => {
    const PROHIBIDAS = /\b(correcto|incorrecto|válido|inválido|erróneo|mal hecho|aprobad)/i
    const propias = new Set(Object.values(TIPO_EDIFICIO))
    for (const [nombre, entrada] of CASOS()) {
      for (const d of entrada.detecciones.filter((x) => propias.has(x.tipo))) {
        expect(d.mensaje, `${nombre} · ${d.tipo}`).not.toMatch(PROHIBIDAS)
      }
    }
  })
})

// ══ ⭐ F14 · EL COTEJO DE SUPERFICIE EN LA RAMA EDIFICIO (deuda de F19) ═══════

describe('F14 · entradaDesdeTexto · el cotejo contra el «Área:» del volcado', () => {
  /**
   * Una LISTA de AutoCAD con N polilíneas cuadradas de 10 m de lado, disjuntas.
   *
   * ⚠️ Las separa la palabra `separador`, que es la convención de
   * `parsers/_comun.js#extraerPares`. Sin ella el parser las lee como UN anillo de
   * 4·N vértices —lo destapó la primera corrida de estas pruebas, que daban
   * `nPartes: 1` donde se esperaban tres—, y entonces no se estaría midiendo el
   * caso multiparte sino otro.
   */
  const listaCon = (areas) =>
    areas
      .map((area, i) => {
        const x = 440000 + i * 100
        const y = 4480000
        return [
          '        LWPOLYLINE  Capa: "0"',
          '          Cerrado',
          `          Área: ${area.toFixed(4)}`,
          `   en punto  X= ${x}.0000  Y= ${y}.0000  Z= 0.0000`,
          `   en punto  X= ${x + 10}.0000  Y= ${y}.0000  Z= 0.0000`,
          `   en punto  X= ${x + 10}.0000  Y= ${y + 10}.0000  Z= 0.0000`,
          `   en punto  X= ${x}.0000  Y= ${y + 10}.0000  Z= 0.0000`,
        ].join('\n')
      })
      .join('\nseparador\n')

  it('⭐ UNA parte: se cuenta, y la cifra es la de la parte', () => {
    const { resumen } = entradaDesdeTexto(listaCon([100]))
    expect(resumen.nPartes).toBe(1)
    expect(resumen.superficie).not.toBeNull()
    expect(resumen.superficie.calculada).toBe(100)
    expect(resumen.superficie.reportada).toBe(100)
    expect(resumen.superficie.coincide).toBe(true)
  })

  it('⭐ y cuando NO cuadra se nota, que es para lo que existe', () => {
    // El caso real del 2026-08-06 trasladado a esta rama: el dibujo declara más de
    // lo que ha entrado porque la LISTA se copió a medias.
    const { resumen } = entradaDesdeTexto(listaCon([276.5018]))
    expect(resumen.superficie.coincide).toBe(false)
    expect(resumen.superficie.calculada).toBe(100)
    expect(resumen.superficie.reportada).toBe(276.5018)
    // Y `avisoDeSuperficie` de la otra rama lo lee SIN una línea nueva: es el
    // requisito del plan, y lo que impide dos redacciones del mismo aviso.
    const texto = avisoDeSuperficie(resumen.superficie)
    expect(texto).not.toBeNull()
    expect(texto).toContain('276,50')
    expect(texto).toContain('100,00')
  })

  it('⛔ con VARIAS partes NO se cuenta, y es lo correcto', () => {
    // MEDIDO: `parsers/list.js#extraerMetadatosLIST` se queda con la ÚLTIMA línea
    // «Área:» del volcado, así que con tres polilíneas ese número es el área de UNA
    // y no la del conjunto. Cotejar la suma (300) contra la última (100) daría
    // siempre «no cuadra» — la peor clase de aviso: el que salta siempre.
    const { resumen } = entradaDesdeTexto(listaCon([100, 100, 100]))
    expect(resumen.nPartes).toBe(3)
    expect(resumen.superficie).toBeNull()
    expect(avisoDeSuperficie(resumen.superficie)).toBeNull()
  })

  it('sin «Área:» en el volcado no hay nada que cotejar', () => {
    const sinArea = listaCon([100]).replace(/\s*Área:.*\n/, '\n')
    const { resumen } = entradaDesdeTexto(sinArea)
    expect(resumen.superficie).toBeNull()
  })

  it('la vía del GML no trae cotejo: allí no hay volcado que declare nada', () => {
    const porGml = entradaDesdeGmlBu(GML_PARTES)
    expect(porGml.resumen.superficie).toBeNull()
  })

  it('⛔ y NO se reenvía el de `importar`: aquel mide un reparto de PARCELA', () => {
    // MEDIDO: el de allí es `superficie(recintos)` con el primer anillo como
    // exterior y los demás como HUECOS. Con tres cuerpos disjuntos de 100 m² da
    // **−100 m²**, no 300. Reenviarlo habría sido peor que no tener cotejo: una
    // cifra con aspecto de medida que no mide nada.
    const texto = listaCon([100, 100, 100])
    const deParcela = importar(texto).resumen.superficie
    expect(deParcela).not.toBeNull()
    expect(deParcela.calculada).toBe(-100)
    expect(entradaDesdeTexto(texto).resumen.superficie).toBeNull()
  })
})
