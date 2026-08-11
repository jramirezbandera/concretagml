/* -------------------------------------------------------------------------- *
 * test/app/salidas.test.js — el predicado de las cuatro salidas                *
 *                                                                              *
 * `app/salidas.js` cierra la deuda «Las salidas no saben decir si se pueden»   *
 * (`TODOS.md`, 2026-08-09): hasta el 2026-08-11 la disponibilidad de las cuatro *
 * exportaciones **no existía como dato**, solo como el error que salía al       *
 * intentarlas. Este fichero prueba el predicado; que la interfaz lo pinte lo    *
 * prueba `test/app/expediente.dom.test.js`, y que las dos cosas sean la MISMA   *
 * regla es justamente lo que ya no hace falta probar, porque hay una sola.      *
 *                                                                              *
 * Corre en el proyecto `node`: es una función pura sin DOM ni store, y el bucle *
 * rápido es donde tiene que verse si se rompe.                                  *
 * -------------------------------------------------------------------------- */

import { describe, expect, it } from 'vitest'

import { ACCION } from '../../app/dialogo-expediente.js'
import { RAMA as RAMA_DE_LA_APP } from '../../app/navegacion.js'
import {
  CAUSA,
  CLAVES_HECHOS,
  HECHOS_VACIOS,
  MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO,
  MENSAJE_SIN_EDIFICIO,
  MENSAJE_SIN_PARCELA,
  MOTIVO_BREVE,
  RAMA,
  SALIDA,
  SALIDAS,
  evaluarSalida,
  evaluarSalidas,
} from '../../app/salidas.js'

/** Las cuatro combinaciones de los dos hechos. */
const CON = Object.freeze({
  nada: { parcela: false, edificio: false },
  soloParcela: { parcela: true, edificio: false },
  soloEdificio: { parcela: false, edificio: true },
  ambas: { parcela: true, edificio: true },
})

const ver = (salida, rama, hechos) => evaluarSalida(salida, { rama, hechos })

// ═════════════════════════════════════════════════════════════════════════════

describe('app/salidas · el vocabulario no puede divergir del de la aplicación', () => {
  it('⭐ las cuatro `SALIDA` son exactamente los cuatro `ACCION.EXPORTAR_*`', () => {
    // ⛔ ÉSTE es el guardián que paga el no haber importado `ACCION`. El módulo es
    // neutro a propósito —no puede depender de la superficie de interfaz que lo usa,
    // que es todo el motivo por el que existe—, así que los literales están escritos
    // dos veces. Lo que impide que se separen es esta prueba, no la buena voluntad:
    // sin ella, renombrar una acción dejaría una opción del menú que no se apaga
    // nunca y una guarda que no protege nada, las dos en silencio.
    const delEmbudo = Object.entries(ACCION)
      .filter(([nombre]) => nombre.startsWith('EXPORTAR_'))
      .map(([, valor]) => valor)

    expect([...SALIDAS].sort()).toEqual(delEmbudo.sort())
    // Y anti-vacuidad: si `ACCION` dejara de tener claves `EXPORTAR_*`, las dos
    // listas serían vacías y esto pasaría diciendo que todo cuadra.
    expect(delEmbudo).toHaveLength(4)
  })

  it('y las dos ramas son las mismas que las del resto de la aplicación', () => {
    // Mismo trato y mismo motivo: `app/navegacion.js` cuelga de `viewer/_comun.js`, y
    // traerlo entero a un predicado de cuatro líneas es cargar media aplicación para
    // leer dos cadenas.
    expect({ ...RAMA }).toEqual({ ...RAMA_DE_LA_APP })
  })

  it('`SALIDAS` lista las cuatro de `SALIDA`, sin repetidos ni sobras', () => {
    expect([...SALIDAS].sort()).toEqual(Object.values(SALIDA).sort())
    expect(new Set(SALIDAS).size).toBe(SALIDAS.length)
  })

  it('`HECHOS_VACIOS` declara exactamente las claves de `CLAVES_HECHOS`, y todas a false', () => {
    // Un hecho declarado que no arranca, o uno que arranca sin estar declarado, es
    // cómo se llega a un predicado que lee `undefined` y contesta «no se puede» para
    // siempre sin que nadie sepa por qué.
    expect(Object.keys(HECHOS_VACIOS).sort()).toEqual([...CLAVES_HECHOS].sort())
    expect(Object.values(HECHOS_VACIOS)).toEqual([false, false])
  })
})

describe('app/salidas · las tres salidas de la PARCELA', () => {
  const deLaParcela = [SALIDA.DXF, SALIDA.COORDENADAS, SALIDA.EXCEL]

  it('con parcela en la rama Parcela, se pueden', () => {
    for (const s of deLaParcela) {
      const v = ver(s, RAMA.PARCELA, CON.soloParcela)
      expect(v.disponible, `${s} tendría que poder`).toBe(true)
      // Disponible es disponible: ni causa ni motivo. Un motivo que sobrevive a que se
      // pueda es exactamente el que se queda rancio en pantalla.
      expect(v).toEqual({ disponible: true, causa: null, motivo: null, breve: null })
    }
  })

  it('sin parcela NO se pueden, y el motivo es el de la parcela', () => {
    for (const s of deLaParcela) {
      const v = ver(s, RAMA.PARCELA, CON.nada)
      expect(v.disponible).toBe(false)
      expect(v.causa).toBe(CAUSA.DATO)
      expect(v.motivo).toBe(MENSAJE_SIN_PARCELA)
      expect(v.breve).toBe(MOTIVO_BREVE.parcela)
    }
  })

  it('⛔ en la rama EDIFICIO no se pueden NI teniendo parcela debajo', () => {
    // Es el caso que de verdad importa y el que más se da: mirar un edificio sobre su
    // parcela. Dejarlas correr entregaría el dibujo de la otra rama en silencio, que
    // es lo que F11 no puede publicar (regla de oro 1).
    for (const s of deLaParcela) {
      const v = ver(s, RAMA.EDIFICIO, CON.ambas)
      expect(v.disponible, `${s} no puede bajar en la rama EDIFICIO`).toBe(false)
      expect(v.causa).toBe(CAUSA.RAMA)
      expect(v.motivo).toBe(MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO)
      expect(v.breve).toBe(MOTIVO_BREVE.rama)
    }
  })

  it('y la RAMA manda sobre el DATO: sin parcela y en Edificio, el motivo es la rama', () => {
    // El orden de los dos ejes no es cosmético: «trae una parcela» a quien está en la
    // rama Edificio le manda a hacer algo que **no le desbloquea nada**, porque al
    // volver con la parcela la salida seguiría apagada. Primero se dice lo que no se
    // arregla trabajando.
    for (const s of deLaParcela) {
      const v = ver(s, RAMA.EDIFICIO, CON.nada)
      expect(v.causa).toBe(CAUSA.RAMA)
      expect(v.motivo).toBe(MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO)
    }
  })
})

describe('app/salidas · el fichero de proyecto, la única de las dos ramas', () => {
  it('en Parcela pide parcela; en Edificio pide edificio', () => {
    expect(ver(SALIDA.PROYECTO, RAMA.PARCELA, CON.soloParcela).disponible).toBe(true)
    expect(ver(SALIDA.PROYECTO, RAMA.EDIFICIO, CON.soloEdificio).disponible).toBe(true)
  })

  it('⭐ y NO se conforma con el documento de la otra rama', () => {
    // El fallo que este `it` caza es el plausible: un predicado escrito con un `||`
    // —«hay parcela o hay edificio»— dejaría «Guardar proyecto» encendido en la rama
    // Edificio teniendo solo una parcela, y `expedienteActual()` devolvería `null`.
    // Un botón encendido que no hace nada.
    expect(ver(SALIDA.PROYECTO, RAMA.EDIFICIO, CON.soloParcela).disponible).toBe(false)
    expect(ver(SALIDA.PROYECTO, RAMA.PARCELA, CON.soloEdificio).disponible).toBe(false)
  })

  it('⭐ el motivo habla de la rama en la que estás, no de la otra', () => {
    // La corrección que `MOTIVO_DATO_EDIFICIO` hizo en el rail, aquí de nacimiento.
    const enEdificio = ver(SALIDA.PROYECTO, RAMA.EDIFICIO, CON.soloParcela)
    expect(enEdificio.motivo).toBe(MENSAJE_SIN_EDIFICIO)
    expect(enEdificio.motivo).not.toBe(MENSAJE_SIN_PARCELA)
    expect(enEdificio.breve).toBe(MOTIVO_BREVE.edificio)

    const enParcela = ver(SALIDA.PROYECTO, RAMA.PARCELA, CON.soloEdificio)
    expect(enParcela.motivo).toBe(MENSAJE_SIN_PARCELA)
    expect(enParcela.breve).toBe(MOTIVO_BREVE.parcela)
  })

  it('⛔ nunca se apaga por RAMA: es la única puerta de salida de un edificio', () => {
    // Siendo el almacén de este navegador incapaz de archivar un edificio (desviación
    // 6 de F11), este fichero es el único sitio donde un edificio se conserva.
    // Apagarlo por rama lo dejaría sin ninguna.
    for (const hechos of Object.values(CON)) {
      for (const rama of [RAMA.PARCELA, RAMA.EDIFICIO]) {
        expect(ver(SALIDA.PROYECTO, rama, hechos).causa).not.toBe(CAUSA.RAMA)
      }
    }
  })
})

describe('app/salidas · el contrato de la respuesta', () => {
  it('con la aplicación VACÍA, ninguna de las cuatro se puede, y las cuatro dicen por qué', () => {
    // La aplicación arranca vacía desde el 2026-08-07, así que éste es el estado que
    // ve quien la abre por primera vez.
    for (const rama of [RAMA.PARCELA, RAMA.EDIFICIO]) {
      for (const v of evaluarSalidas({ rama, hechos: { ...HECHOS_VACIOS } })) {
        expect(v.disponible, `${v.salida} en ${rama}`).toBe(false)
        expect(typeof v.motivo, `${v.salida} sin motivo`).toBe('string')
        expect(v.motivo.length).toBeGreaterThan(20)
        expect(typeof v.breve, `${v.salida} sin forma breve`).toBe('string')
        expect(v.breve.length).toBeGreaterThan(0)
      }
    }
  })

  it('`evaluarSalidas` devuelve las cuatro, en orden, con su nombre dentro', () => {
    const todas = evaluarSalidas({ rama: RAMA.PARCELA, hechos: CON.soloParcela })
    expect(todas.map((v) => v.salida)).toEqual([...SALIDAS])
    for (const v of todas) expect(v.disponible).toBe(true)
  })

  it('una salida desconocida LANZA, no devuelve «no se puede»', () => {
    // Es un contrato roto del programador, no un estado del usuario. Devolver «no
    // disponible» lo esconderría detrás de una opción que se apaga sola y nadie
    // sabría por qué; y el mensaje nombra las cuatro válidas para que el rojo diga
    // qué se esperaba.
    expect(() => ver('exportar-pdf', RAMA.PARCELA, CON.ambas)).toThrow(RangeError)
    expect(() => ver('exportar-pdf', RAMA.PARCELA, CON.ambas)).toThrow(/exportar-dxf/)
  })

  it('unos hechos ausentes o a medias se tratan como «no», no como «sí»', () => {
    // ⚠️ La comprobación es `!== true` y no `=== false` a propósito: un hecho que
    // llegue `undefined` porque quien llama se dejó una clave tiene que apagar la
    // salida, no encenderla. Encenderla sería entregar un fichero de la nada.
    expect(ver(SALIDA.DXF, RAMA.PARCELA, {}).disponible).toBe(false)
    expect(ver(SALIDA.DXF, RAMA.PARCELA, undefined).disponible).toBe(false)
    expect(ver(SALIDA.DXF, RAMA.PARCELA, { parcela: 'sí' }).disponible).toBe(false)
    expect(ver(SALIDA.DXF, RAMA.PARCELA, { parcela: 1 }).disponible).toBe(false)
  })

  it('es PURA: la misma pregunta dos veces da lo mismo, y no muta los hechos', () => {
    const hechos = { parcela: false, edificio: true }
    const antes = JSON.stringify(hechos)
    const a = ver(SALIDA.PROYECTO, RAMA.EDIFICIO, hechos)
    const b = ver(SALIDA.PROYECTO, RAMA.EDIFICIO, hechos)
    expect(a).toEqual(b)
    expect(JSON.stringify(hechos)).toBe(antes)
  })
})

describe('app/salidas · higiene de los textos que salen por pantalla', () => {
  const TEXTOS = [
    MENSAJE_SIN_PARCELA,
    MENSAJE_SIN_EDIFICIO,
    MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO,
    ...Object.values(MOTIVO_BREVE),
  ]

  it('ninguno lleva Markdown crudo ni comillas rectas', () => {
    // Estos textos van a un `title`, a un nombre accesible y a un renglón de acuse:
    // los tres los pinta el navegador tal cual. Un `**` o un backtick se leen.
    for (const t of TEXTOS) {
      expect(t, `«${t}» lleva marcado`).not.toMatch(/\*\*|`|^- |\[.+\]\(.+\)/)
      expect(t, `«${t}» usa comillas rectas`).not.toMatch(/"/)
    }
  })

  it('las formas breves son cortas de verdad, y las largas dicen cómo salir', () => {
    // La breve es un nombre accesible: un lector de pantalla la recita cada vez que
    // el foco pasa por encima. La larga es la que se lee a propósito.
    for (const b of Object.values(MOTIVO_BREVE)) {
      expect(b.length, `«${b}» no es una forma breve`).toBeLessThanOrEqual(24)
      expect(b).not.toMatch(/[.:]$/)
    }
    // Las dos que tienen salida la nombran. `MENSAJE_SIN_PARCELA` no lleva
    // instrucción a propósito: se lee estando en Entrada, que es literalmente la
    // lista de maneras de traer la parcela que falta.
    expect(MENSAJE_SIN_EDIFICIO).toMatch(/Carga uno/)
    expect(MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO).toMatch(/Vuelve a/)
  })
})
