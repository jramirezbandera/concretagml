/* -------------------------------------------------------------------------- *
 * test/edificio/comun.test.js — El CUARTO léxico del proyecto (F11, T1.3)     *
 *                                                                            *
 * Estrena `test/edificio/`. Sin fixtures en disco salvo uno: el código fuente *
 * de `parsers/importar.js`, que es de donde salen tres de los cinco códigos   *
 * de MOTIVO_ENTRADA y al que hay que quedar atado para que no diverjan.       *
 *                                                                            *
 * Cubre:                                                                     *
 *   - TIPO_EDIFICIO / SEVERIDAD: catálogo completo, congelado y DISJUNTO de   *
 *     los otros tres léxicos (que es lo que hace comprobable la clausura).    *
 *   - crearDeteccionEdificio: forma, y LANZA ante tipo/severidad/datos ajenos.*
 *   - resumirDetecciones: cuenta por tipo y por severidad, y da EXACTAMENTE   *
 *     lo mismo que la de `export/_comun.js` (anti-divergencia).               *
 *   - MOTIVO_ENTRADA: los cinco códigos, y los tres heredados atados a        *
 *     `parsers/importar.js`.                                                  *
 *   - nombreParteGenerico: 1-based en el texto, y aceptado por el MODELO.     *
 * -------------------------------------------------------------------------- */

import { describe, expect, it } from 'vitest'

import {
  MOTIVO_ENTRADA,
  SEVERIDAD,
  TIPO_EDIFICIO,
  crearDeteccionEdificio,
  nombreParteGenerico,
  resumirDetecciones,
} from '../../edificio/_comun.js'

// Los otros tres léxicos, importados SOLO para los guardas de coherencia.
import {
  SEVERIDAD as SEVERIDAD_PARSERS,
  TIPO_DETECCION,
} from '../../parsers/_comun.js'
import { SEVERIDAD as SEVERIDAD_GML, TIPO_GML } from '../../gml/_comun.js'
import {
  SEVERIDAD as SEVERIDAD_EXPORT,
  TIPO_EXPORT,
  resumirDetecciones as resumirExport,
} from '../../export/_comun.js'

// El modelo, para atar `nombreParteGenerico` a quien lo va a consumir.
import { ORIGEN_PARTE, crearParteConstruccion } from '../../model/edificio.js'

// El orquestador de la rama parcela, de donde vienen tres de los cinco motivos.
import { BLOQUEOS, BLOQUEOS_SOLO_PARCELA, importar } from '../../parsers/importar.js'

// ── El catálogo ───────────────────────────────────────────────────────────────

describe('edificio/_comun — TIPO_EDIFICIO', () => {
  it('expone el léxico completo, con clave === valor', () => {
    for (const k of [
      'PARTE_SIN_GEOMETRIA',
      'CAPA_DXF_DESCARTADA',
      'ATRIBUTO_NO_MAPEADO',
      'PARTE_BAJO_RASANTE',
      'MODELO_CAMBIADO',
      'PATCHES_MULTIPLES',
      'PLANTAS_DESCARTADAS',
      'RENOMBRADO_IGNORADO',
    ]) {
      expect(TIPO_EDIFICIO[k], `falta el tipo ${k}`).toBe(k)
    }
  })

  it('⛔ `TIPO_PARTE_FORZADO` NO vuelve: F21 hizo falso el hecho que contaba', () => {
    // Existió de F11 a F14 para decir que una `OtherConstruction` —la piscina—
    // entraba como parte `PRINCIPAL` «hasta la fase siguiente». F12 pasó sin
    // tocarlo, F13 lo volvió a medir, y F21 hace que entre con su tipo: el aviso
    // se queda sin hecho que contar. Este guardián existe porque un miembro de
    // léxico es barato de resucitar por costumbre, y volver a emitirlo sería
    // contarle al técnico un forzado que ya no ocurre.
    expect(TIPO_EDIFICIO.TIPO_PARTE_FORZADO).toBeUndefined()
    expect(Object.keys(TIPO_EDIFICIO)).not.toContain('TIPO_PARTE_FORZADO')
    // MITAD ANTI-VACUIDAD: el léxico sigue vivo y con sus vecinos dentro, así que
    // esto no pasa por haberse quedado el objeto vacío.
    expect(TIPO_EDIFICIO.PLANTAS_DESCARTADAS).toBe('PLANTAS_DESCARTADAS')
  })

  it('está congelado: no se le añaden tipos en caliente', () => {
    expect(Object.isFrozen(TIPO_EDIFICIO)).toBe(true)
    expect(() => {
      'use strict'
      TIPO_EDIFICIO.INVENTADO = 'INVENTADO'
    }).toThrow(TypeError)
  })

  it('PARTE_BAJO_RASANTE existe porque `part10` del fixture real contradice la ficha', () => {
    // Regla de oro 8: manda el dato. La ficha de F11 escribe «solo partes con
    // volumen sobre rasante» y el fixture del Catastro trae una parte con 0
    // plantas sobre rasante y 1 bajo. El tipo es cómo se dice en voz alta; el
    // lector que lo mide es T1.2 y quien lo emite, T2.1.
    expect(TIPO_EDIFICIO.PARTE_BAJO_RASANTE).toBe('PARTE_BAJO_RASANTE')
  })
})

describe('edificio/_comun — SEVERIDAD, la cuarta copia', () => {
  it('tiene los tres niveles y está congelada', () => {
    expect(SEVERIDAD).toEqual({ INFO: 'INFO', AVISO: 'AVISO', ERROR: 'ERROR' })
    expect(Object.isFrozen(SEVERIDAD)).toBe(true)
  })

  it('NO diverge de las otras tres (duplicada a propósito, vigilada por este test)', () => {
    // Misma fórmula que el test-guarda de `gml/_comun.js` frente a
    // `parsers/_comun.js`: se duplica para no acoplar los grafos de
    // dependencias, y se ata para que nadie las separe.
    expect(SEVERIDAD).toEqual(SEVERIDAD_PARSERS)
    expect(SEVERIDAD).toEqual(SEVERIDAD_GML)
    expect(SEVERIDAD).toEqual(SEVERIDAD_EXPORT)
  })
})

describe('edificio/_comun — los cuatro catálogos son CERRADOS y DISJUNTOS', () => {
  it('ningún tipo de TIPO_EDIFICIO existe en los otros tres', () => {
    // Es lo que hace comprobable la regla de oro 1: una detección de otra capa
    // no puede colarse en ésta ni pasar desapercibida al pintarla.
    const ajenos = new Set([
      ...Object.values(TIPO_DETECCION),
      ...Object.values(TIPO_GML),
      ...Object.values(TIPO_EXPORT),
    ])
    const choques = Object.values(TIPO_EDIFICIO).filter((t) => ajenos.has(t))
    expect(choques, 'tipos que ya existen en otro léxico').toEqual([])
  })

  it('un tipo de otro léxico NO cuela en crearDeteccionEdificio', () => {
    expect(() =>
      crearDeteccionEdificio(TIPO_DETECCION.ARCO_DISCRETIZADO, 'x', SEVERIDAD.INFO),
    ).toThrow(RangeError)
    expect(() => crearDeteccionEdificio(TIPO_EXPORT.HUECO_EXPORTADO, 'x', SEVERIDAD.INFO)).toThrow(
      RangeError,
    )
    expect(() => crearDeteccionEdificio(TIPO_GML.BOM_PRESENTE, 'x', SEVERIDAD.INFO)).toThrow(
      RangeError,
    )
  })
})

// ── La fábrica ────────────────────────────────────────────────────────────────

describe('edificio/_comun — crearDeteccionEdificio', () => {
  it('devuelve el POJO {tipo, mensaje, severidad} sin `datos` si no se aporta', () => {
    const d = crearDeteccionEdificio(
      TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA,
      'La parte 3 no trae contorno dibujable.',
      SEVERIDAD.AVISO,
    )
    expect(d).toEqual({
      tipo: 'PARTE_SIN_GEOMETRIA',
      mensaje: 'La parte 3 no trae contorno dibujable.',
      severidad: 'AVISO',
    })
    expect('datos' in d).toBe(false)
    expect(Object.getPrototypeOf(d)).toBe(Object.prototype)
  })

  it('adjunta `datos` cuando se aporta (objeto plano, con arrays dentro)', () => {
    const d = crearDeteccionEdificio(
      TIPO_EDIFICIO.CAPA_DXF_DESCARTADA,
      '16 anillos de la capa «FINO» se han descartado.',
      SEVERIDAD.INFO,
      { capa: 'FINO', anillos: 16, indices: [0, 1, 2] },
    )
    expect(d.datos).toEqual({ capa: 'FINO', anillos: 16, indices: [0, 1, 2] })
  })

  it('LANZA con tipo, severidad o mensaje inválidos (nada de detecciones mudas)', () => {
    expect(() => crearDeteccionEdificio('INVENTADO', 'x', SEVERIDAD.INFO)).toThrow(RangeError)
    expect(() =>
      crearDeteccionEdificio(TIPO_EDIFICIO.MODELO_CAMBIADO, 'x', 'GRAVE'),
    ).toThrow(RangeError)
    expect(() =>
      crearDeteccionEdificio(TIPO_EDIFICIO.MODELO_CAMBIADO, '', SEVERIDAD.INFO),
    ).toThrow(TypeError)
    expect(() =>
      crearDeteccionEdificio(TIPO_EDIFICIO.MODELO_CAMBIADO, 42, SEVERIDAD.INFO),
    ).toThrow(TypeError)
  })

  it('LANZA si `datos` no es un objeto plano (a diferencia de export/_comun.js)', () => {
    for (const malo of [[1, 2], null, 7, 'texto']) {
      expect(() =>
        crearDeteccionEdificio(TIPO_EDIFICIO.MODELO_CAMBIADO, 'x', SEVERIDAD.INFO, malo),
      ).toThrow(TypeError)
    }
  })

  it('el mensaje nombra el problema, no lo etiqueta (regla de oro 1)', () => {
    // Anti-vacuidad: el catálogo obliga a un tipo, pero el TEXTO es lo que lee
    // el usuario y no puede ser el tipo repetido en mayúsculas.
    const d = crearDeteccionEdificio(
      TIPO_EDIFICIO.PATCHES_MULTIPLES,
      'El contorno del edificio venía en 2 trozos (gml:PolygonPatch); se han leído los 2.',
      SEVERIDAD.INFO,
    )
    expect(d.mensaje).not.toBe(d.tipo)
    expect(d.mensaje.length).toBeGreaterThan(20)
  })
})

// ── El recuento ───────────────────────────────────────────────────────────────

describe('edificio/_comun — resumirDetecciones', () => {
  const muestra = () => [
    crearDeteccionEdificio(TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA, 'a', SEVERIDAD.AVISO),
    crearDeteccionEdificio(TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA, 'b', SEVERIDAD.AVISO),
    crearDeteccionEdificio(TIPO_EDIFICIO.PATCHES_MULTIPLES, 'c', SEVERIDAD.INFO),
    crearDeteccionEdificio(TIPO_EDIFICIO.PARTE_BAJO_RASANTE, 'd', SEVERIDAD.ERROR),
  ]

  it('cuenta el total, por tipo y por severidad', () => {
    expect(resumirDetecciones(muestra())).toEqual({
      total: 4,
      porTipo: { PARTE_SIN_GEOMETRIA: 2, PATCHES_MULTIPLES: 1, PARTE_BAJO_RASANTE: 1 },
      porSeveridad: { AVISO: 2, INFO: 1, ERROR: 1 },
    })
  })

  it('con lista vacía devuelve ceros y mapas vacíos, no null', () => {
    expect(resumirDetecciones([])).toEqual({ total: 0, porTipo: {}, porSeveridad: {} })
  })

  it('da EXACTAMENTE lo mismo que la de export/_comun.js (anti-divergencia)', () => {
    // Están copiadas, no importadas (cabecera del módulo). Este test es el que
    // impide que la copia se «mejore» por un lado y la UI cuente distinto según
    // qué capa le hable.
    const d = muestra()
    expect(resumirDetecciones(d)).toEqual(resumirExport(d))
    expect(resumirDetecciones([])).toEqual(resumirExport([]))
  })
})

// ── Los motivos de bloqueo ────────────────────────────────────────────────────

describe('edificio/_comun — MOTIVO_ENTRADA', () => {
  it('expone los cinco códigos, con clave === valor, y está congelado', () => {
    expect(MOTIVO_ENTRADA).toEqual({
      SIN_GEOMETRIA: 'SIN_GEOMETRIA',
      COORDENADAS_EN_GRADOS: 'COORDENADAS_EN_GRADOS',
      HUSO_NO_RESUELTO: 'HUSO_NO_RESUELTO',
      LINEAS_NO_IMPORTADAS: 'LINEAS_NO_IMPORTADAS',
      SIN_CONSTRUCCION: 'SIN_CONSTRUCCION',
      DIALECTO_NO_BU: 'DIALECTO_NO_BU',
    })
    expect(Object.isFrozen(MOTIVO_ENTRADA)).toBe(true)
  })

  it('los CUATRO heredados son LITERALMENTE los de parsers/importar.js#BLOQUEOS', () => {
    // Test-guarda de coherencia: `entradaDesdeTexto` (T2.1) delega en `importar()`
    // y arrastra sus `bloqueos` SIN traducir. Si alguien renombra un código allí,
    // este test cae aquí en vez de que la interfaz deje de reconocer un bloqueo
    // en producción.
    for (const codigo of [
      'SIN_GEOMETRIA',
      'COORDENADAS_EN_GRADOS',
      'HUSO_NO_RESUELTO',
      // Auditoría 2026-08: universal a propósito — una huella a la que le faltan
      // vértices está tan rota como una parcela.
      'LINEAS_NO_IMPORTADAS',
    ]) {
      expect(MOTIVO_ENTRADA[codigo], `divergencia con parsers/importar.js en ${codigo}`).toBe(
        BLOQUEOS[codigo],
      )
    }
  })

  it('y se comprueba de verdad: un volcado sin geometría bloquea con ese código', () => {
    // Mitad no vacua del guarda anterior: no se afirma solo sobre una constante,
    // se ejecuta el orquestador real.
    const { parcela, resumen } = importar('', { formato: 'TXT' })
    expect(parcela).toBeNull()
    expect(resumen.bloqueos).toContain(MOTIVO_ENTRADA.SIN_GEOMETRIA)
  })

  it('⛔ los TRES bloqueos de parcela NO están aquí, y es deliberado', () => {
    // MEDIDO el 2026-08-03: `importar()` ya no emite tres bloqueos, emite CINCO.
    // `ANILLOS_EN_VARIAS_CAPAS` y `SUPERFICIE_NO_POSITIVA` dicen que el reparto
    // «un exterior + N huecos» no se sostiene — y en la rama EDIFICIO cada anillo
    // es su propio exterior, así que no aplican. T2.1 tiene que FILTRARLOS al
    // reenviar `resumen.bloqueos`, o un DXF de vivienda + porche + piscina (el
    // caso normal de esta fase) saldría bloqueado por venir de más de una capa.
    //
    // ⛔ **F22 añade el sexto, `VARIOS_RECINTOS_DISJUNTOS`, y es el que más falta
    // hace que se filtre**: vivienda, porche y piscina SON tres recintos
    // disjuntos, así que sin el filtro esta rama quedaría bloqueada en TODOS sus
    // ficheros y no solo en los de varias capas.
    expect(BLOQUEOS_SOLO_PARCELA.length).toBe(3)
    for (const codigo of BLOQUEOS_SOLO_PARCELA) {
      expect(codigo in MOTIVO_ENTRADA, `${codigo} no debe estar en MOTIVO_ENTRADA`).toBe(false)
    }
    // Y al revés: todo lo que `importar` puede emitir, o está en este catálogo o
    // está en la lista de los que solo son de parcela. Nada se queda sin clasificar.
    for (const codigo of Object.values(BLOQUEOS)) {
      expect(
        codigo in MOTIVO_ENTRADA || BLOQUEOS_SOLO_PARCELA.includes(codigo),
        `el bloqueo ${codigo} de parsers/importar.js no está clasificado en esta capa`,
      ).toBe(true)
    }
  })

  it('los DOS propios de esta capa no los emite la rama parcela', () => {
    const deParcela = Object.values(BLOQUEOS)
    expect(deParcela).not.toContain(MOTIVO_ENTRADA.SIN_CONSTRUCCION)
    expect(deParcela).not.toContain(MOTIVO_ENTRADA.DIALECTO_NO_BU)
  })
})

// ── El nombre genérico ────────────────────────────────────────────────────────

describe('edificio/_comun — nombreParteGenerico', () => {
  it('es 0-based en el parámetro y 1-based en el texto', () => {
    expect(nombreParteGenerico(0)).toBe('Parte 1')
    expect(nombreParteGenerico(1)).toBe('Parte 2')
    expect(nombreParteGenerico(12)).toBe('Parte 13') // las 13 partes del fixture BU
  })

  it('no inventa nombres de uso («vivienda», «porche»…): son del usuario', () => {
    const nombres = Array.from({ length: 5 }, (_, i) => nombreParteGenerico(i).toLowerCase())
    for (const inventado of ['vivienda', 'porche', 'garaje', 'piscina', 'cuerpo']) {
      expect(nombres.some((n) => n.includes(inventado))).toBe(false)
    }
  })

  it('LANZA con un índice que no es entero ≥ 0 (contrato del programador)', () => {
    for (const malo of [-1, 1.5, '0', null, undefined, NaN]) {
      expect(() => nombreParteGenerico(malo), `no lanzó con ${JSON.stringify(malo)}`).toThrow(
        TypeError,
      )
    }
  })

  it('lo que produce lo acepta el MODELO sin más (no vacío)', () => {
    // Anti-vacuidad: el nombre genérico existe para poblar partes reales, y
    // `crearParteConstruccion` lanza con un nombre vacío.
    const parte = crearParteConstruccion({
      nombre: nombreParteGenerico(0),
      origen: ORIGEN_PARTE.DXF,
    })
    expect(parte.nombre).toBe('Parte 1')
  })
})
