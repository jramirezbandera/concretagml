/* -------------------------------------------------------------------------- *
 * test/derivacion/identidad.test.js — F17 · tarea 2.3                          *
 *                                                                              *
 * Quién es cada parcela del expediente en los términos del `inspireId`. Es el   *
 * dato más pequeño de toda la fase y el que más caro sale equivocado: un        *
 * `localId` bajo el namespace que no le toca no lo rechaza el XSD, no lo        *
 * rechaza la Sede, y sale firmado.                                              *
 *                                                                              *
 * Lo que este fichero defiende:                                                 *
 *                                                                              *
 *   1. ⛔ **QUE LOS TRES CAMPOS SEAN UNA SOLA AFIRMACIÓN.** Es la trampa 2 de    *
 *      `SPEC.md` §3.1, en la que esta aplicación cayó hasta el 2026-07-27:      *
 *      decía a la vez «ésta es su referencia catastral» y «esta parcela no      *
 *      existe en el Catastro». No hay ninguna función que devuelva uno suelto.  *
 *   2. ⭐ **QUE LA CESIÓN IMPLEMENTE LO MEDIDO Y NO LO DEDUCIDO** (override      *
 *      O19): referencia del padre SUFIJADA, no vacía, porque eso es lo que      *
 *      obtuvo IVG positivo. La deducción elegante dice lo contrario y no se ha  *
 *      presentado nunca.                                                        *
 *   3. Que la salida se pueda esparcir TAL CUAL sobre `serializarParcelaCp`.    *
 *                                                                              *
 * Proyecto Vitest `node`.                                                       *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import {
  NAMESPACE_CATASTRO,
  NAMESPACE_LOCAL,
  SEPARADOR_SEGREGADA,
  identidadDeCesion,
  identidadDeParcela,
} from '../../derivacion/identidad.js'
import { serializarExpedienteCp } from '../../gml/serialize-cp.js'

/** La refcat del único expediente de este proyecto con IVG positivo. */
const ORO = '7136910UF1473N'

const rect = (x0, y0, x1, y1) => [
  {
    tipo: 'EXTERIOR',
    vertices: [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
  },
]

// ── 1 · La matriz ────────────────────────────────────────────────────────────

describe('identidadDeParcela · los dos párrafos de la FAQ del Catastro', () => {
  it('CON referencia catastral: los tres campos dicen «está inscrita»', () => {
    expect(identidadDeParcela({ refcat: ORO, idLocal: 'p1' })).toEqual({
      refcat: ORO,
      namespaceInspire: NAMESPACE_CATASTRO,
      nationalCadastralReference: ORO,
    })
  })

  it('SIN ella: los tres dicen «es un alta», y el `localId` es el del modelo', () => {
    // El patrón de `UTM_1.gml`, el alta real de un particular que este proyecto
    // tiene versionada desde F04.
    expect(identidadDeParcela({ refcat: null, idLocal: 'parcela-dibujada-1' })).toEqual({
      refcat: 'parcela-dibujada-1',
      namespaceInspire: NAMESPACE_LOCAL,
      nationalCadastralReference: '',
    })
  })

  it('⛔ NUNCA la combinación contradictoria: refcat real bajo `ES.LOCAL.CP`', () => {
    // El error que esta aplicación cometió durante cuatro fases. Se comprueba sobre
    // las dos salidas posibles, que son todas las que hay.
    for (const args of [{ refcat: ORO, idLocal: 'p1' }, { refcat: null, idLocal: 'p1' }]) {
      const id = identidadDeParcela(args)
      const inscrita = id.namespaceInspire === NAMESPACE_CATASTRO
      expect(id.nationalCadastralReference !== '').toBe(inscrita)
      if (inscrita) expect(id.nationalCadastralReference).toBe(id.refcat)
    }
  })

  it('una referencia en blanco NO es una referencia', () => {
    expect(identidadDeParcela({ refcat: '   ', idLocal: 'p1' }).namespaceInspire).toBe(
      NAMESPACE_LOCAL,
    )
    // Y lo que sí llega se recorta: un `localId` con espacios alrededor es otro id.
    expect(identidadDeParcela({ refcat: ` ${ORO} ` }).refcat).toBe(ORO)
  })

  it('⛔ lanza si no hay NI referencia NI `idLocal`', () => {
    // El `<localId>` no puede quedar vacío: el XSD no lo admite y es la base de los
    // cuatro `gml:id`. Lanzar aquí es lanzar donde todavía se sabe de qué parcela
    // se habla; el serializador lanzaría más tarde y más lejos.
    expect(() => identidadDeParcela({})).toThrow(TypeError)
    expect(() => identidadDeParcela()).toThrow(/refcat.*idLocal|idLocal/)
    expect(() => identidadDeParcela({ refcat: '', idLocal: '  ' })).toThrow(TypeError)
  })
})

// ── 2 · ⭐ La cesión: lo MEDIDO manda sobre lo deducido (O19) ────────────────

describe('identidadDeCesion · el override O19, tal y como se presentó', () => {
  it('⭐ reproduce EXACTAMENTE la pieza que obtuvo IVG positivo', () => {
    // CSV `XMWPXCN9J8DB9J89`, 2026-08-03. La combinación es contradictoria sobre el
    // papel —`ES.LOCAL.CP` dice «no está en la base de datos» y la referencia dice
    // que sí— y la Sede la aceptó. Regla de oro 8: manda la medición.
    expect(identidadDeCesion({ refcatPadre: ORO, orden: 1 })).toEqual({
      refcat: `${ORO}.1`,
      namespaceInspire: NAMESPACE_LOCAL,
      nationalCadastralReference: `${ORO}.1`,
    })
  })

  it('el sufijo es el ordinal de la pieza, y el separador es un punto', () => {
    expect(SEPARADOR_SEGREGADA).toBe('.')
    expect(identidadDeCesion({ refcatPadre: ORO, orden: 4 }).refcat).toBe(`${ORO}.4`)
  })

  it('SIN referencia del padre, la de la cesión va VACÍA — y eso NO está medido', () => {
    // Cuando la matriz también es un alta no hay nada inscrito a lo que referirse.
    // Rellenarlo con un `idLocal` interno sería afirmar una inscripción que no
    // existe. ⚠️ Este camino no se ha presentado nunca en la Sede.
    expect(identidadDeCesion({ idLocalPadre: 'parcela-dibujada-1', orden: 2 })).toEqual({
      refcat: 'parcela-dibujada-1.2',
      namespaceInspire: NAMESPACE_LOCAL,
      nationalCadastralReference: '',
    })
  })

  it('la referencia del padre gana al `idLocal` cuando están las dos', () => {
    expect(identidadDeCesion({ refcatPadre: ORO, idLocalPadre: 'p1', orden: 1 }).refcat).toBe(
      `${ORO}.1`,
    )
  })

  it('⛔ lanza con un `orden` que no es un entero ≥ 1', () => {
    // Sin esta guarda, un `orden` ausente daría `7136910UF1473N.undefined`: un
    // identificador de finca con la palabra «undefined» dentro, en un fichero que
    // se firma. Y un `0` daría `…N.0`, que no es lo que se presentó.
    expect(() => identidadDeCesion({ refcatPadre: ORO })).toThrow(RangeError)
    expect(() => identidadDeCesion({ refcatPadre: ORO, orden: 0 })).toThrow(RangeError)
    expect(() => identidadDeCesion({ refcatPadre: ORO, orden: 1.5 })).toThrow(RangeError)
    expect(() => identidadDeCesion({ refcatPadre: ORO, orden: '1' })).toThrow(RangeError)
  })

  it('⛔ lanza si no hay padre del que colgar el nombre', () => {
    expect(() => identidadDeCesion({ orden: 1 })).toThrow(TypeError)
    expect(() => identidadDeCesion({ refcatPadre: '  ', orden: 1 })).toThrow(/refcatPadre/)
  })
})

// ── 3 · Que encaje con el serializador sin adaptador ────────────────────────

describe('identidad · encaja en `serializarExpedienteCp` esparciéndola', () => {
  it('⭐ matriz + cesión producen un expediente con los dos namespaces del oro', () => {
    // La cadena entera: identidad → sobre de N miembros. Si los nombres de los
    // campos dejaran de coincidir con los que espera el serializador, esto se
    // pondría rojo aquí y no en la Sede.
    const { xml, resumen } = serializarExpedienteCp({
      parcelas: [
        { ...identidadDeParcela({ refcat: ORO }), recintos: rect(0, 0, 20, 10), srs: 'EPSG:25830' },
        {
          ...identidadDeCesion({ refcatPadre: ORO, orden: 1 }),
          recintos: rect(20, 0, 22, 10),
          srs: 'EPSG:25830',
        },
      ],
    })
    expect(xml).toContain(`<base:localId>${ORO}</base:localId>`)
    expect(xml).toContain(`<base:localId>${ORO}.1</base:localId>`)
    expect(resumen.namespaces).toEqual([NAMESPACE_CATASTRO, NAMESPACE_LOCAL])
    expect(resumen.localIds).toEqual([ORO, `${ORO}.1`])
  })

  it('⛔ y los `gml:id` NO chocan, aunque las dos referencias empiecen igual', () => {
    // M7 de la ficha: la base del id es `namespace + refcat`. Aquí además los
    // `refcat` son distintos —uno lleva sufijo—, así que hay dos razones para que
    // no choquen y ninguna es casualidad.
    const { xml } = serializarExpedienteCp({
      parcelas: [
        { ...identidadDeParcela({ refcat: ORO }), recintos: rect(0, 0, 20, 10), srs: 'EPSG:25830' },
        {
          ...identidadDeCesion({ refcatPadre: ORO, orden: 1 }),
          recintos: rect(20, 0, 22, 10),
          srs: 'EPSG:25830',
        },
      ],
    })
    const ids = [...xml.matchAll(/gml:id="([^"]+)"/g)].map((m) => m[1])
    expect(ids.length).toBe(new Set(ids).size)
    expect(ids.length).toBe(2 * 3 + 1)
  })
})
