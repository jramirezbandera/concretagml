/* -------------------------------------------------------------------------- *
 * test/report/expediente-f17.test.js — F17 · tarea 3.2 (8A + T12)              *
 *                                                                              *
 * Dos cosas que el informe de F09 no sabía decir y que un expediente de varias  *
 * parcelas vuelve indispensables:                                               *
 *                                                                              *
 *   1. ⛔ **SU ALCANCE.** Este informe describe UNA parcela: una geometría, una  *
 *      tabla de vértices, un literal de lindero. Con «Segregación» impreso       *
 *      encima y sin decir que el envío lleva dos, el papel se lee como si las    *
 *      cubriera todas. Se traslada al PDF el patrón del `<-- ELEGIDA` que el     *
 *      informe de texto ya usaba para las parcelas del FICHERO.                  *
 *   2. ⛔ **EL TIPO DE OPERACIÓN.** Es el único dato del expediente con           *
 *      redundancia cero: no viaja en el `.gml`, no lo comprueba la Sede, y el    *
 *      informe **no lo nombraba**. Un valor equivocado produce un IVG positivo   *
 *      con la etiqueta mal puesta, firmado y con su CSV.                         *
 *                                                                              *
 * Y los dos guardianes de vocabulario que hacen que las tres copias de           *
 * «Subsanación» del proyecto no puedan divergir.                                 *
 *                                                                              *
 * Proyecto Vitest `node`.                                                        *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

import { AVISO_DECLARATIVO, TIPO_OPERACION } from '../../derivacion/operacion.js'
import { diagnosticar } from '../../diagnostico/parcela.js'
import { componerEncabezado } from '../../report/firma.js'
import { OPERACION_CONOCIDA, informeContrasteTexto } from '../../report/contraste-texto.js'
import { informePdfParcela } from '../../report/pdf-parcela.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const FECHA = new Date(Date.UTC(2026, 7, 5, 10, 0, 0))
const REF = '7136910UF1473N'

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

const DIAGNOSTICO = diagnosticar({ recintos: rect(0, 0, 20, 10) })

/** El expediente de dos miembros: la matriz descrita y la cesión, que no. */
const EXPEDIENTE = Object.freeze({
  tipoOperacion: TIPO_OPERACION.SEGREGACION,
  propuesto: true,
  porQue: 'El fichero lleva 2 parcelas y una es un alta que el Catastro todavía no tiene.',
  miembros: [
    { localId: REF, namespace: 'ES.SDGC.CP', areaValue: 442, descrita: true },
    { localId: `${REF}.1`, namespace: 'ES.LOCAL.CP', areaValue: 24, descrita: false },
  ],
})

const encabezado = () =>
  componerEncabezado({ refcat: REF, srs: 'EPSG:25830', fecha: FECHA })

const aLatin1 = (bytes) => Buffer.from(bytes).toString('latin1')

const pdf = (expediente) =>
  aLatin1(informePdfParcela({ diagnostico: DIAGNOSTICO, encabezado: encabezado(), expediente }).bytes)

const texto = (expediente) =>
  informeContrasteTexto({ diagnostico: DIAGNOSTICO, fecha: FECHA, expediente })

// ── 1 · El PDF ──────────────────────────────────────────────────────────────

describe('informePdfParcela · la sección del alcance (8A + T12)', () => {
  it('⭐ imprime el tipo de operación con la palabra del desplegable de la Sede', () => {
    // «Segregación», con tilde y en singular: el papel y la Sede tienen que decir
    // lo mismo para que se puedan cotejar de un vistazo.
    const bytes = pdf(EXPEDIENTE)
    expect(bytes).toContain('ALCANCE DE ESTE INFORME')
    expect(bytes).toContain('Segregación')
    expect(bytes).toContain('Tipo de operación')
  })

  it('⛔ y lo imprime como lo que ES: declarativo, con los tres candados', () => {
    const bytes = pdf(EXPEDIENTE)
    expect(bytes).toContain('Dato DECLARATIVO')
    expect(bytes).toContain('no lo caza nadie')
    expect(bytes).toContain('Confírmelo en la Sede')
  })

  it('dice QUIÉN lo declara, y la propuesta se distingue de la elección', () => {
    expect(pdf(EXPEDIENTE)).toContain('Lo propone la aplicación')
    expect(pdf({ ...EXPEDIENTE, propuesto: false })).toContain('Lo ha elegido quien presenta')
  })

  it('⭐ lista las DOS parcelas y marca la que este informe describe', () => {
    const bytes = pdf(EXPEDIENTE)
    expect(bytes).toContain(REF)
    expect(bytes).toContain(`${REF}.1`)
    expect(bytes).toContain('ES.LOCAL.CP')
    expect(bytes).toContain('es la que se describe')
    expect(bytes).toContain('este informe describe UNA de')
  })

  it('con UNA sola parcela la sección sigue saliendo, y dice que es la que describe', () => {
    // No es redundante: es la frase que impide leer el papel como si abarcara un
    // expediente entero el día que lleve varias. Y con una parcela el acto jurídico
    // es una Subsanación, que es lo que esta aplicación llevaba once fases haciendo
    // sin nombrarlo (SPEC §7.2).
    const bytes = pdf({
      tipoOperacion: TIPO_OPERACION.SUBSANACION,
      propuesto: true,
      porQue: null,
      miembros: [{ localId: REF, namespace: 'ES.SDGC.CP', areaValue: 466, descrita: true }],
    })
    expect(bytes).toContain('Subsanación')
    expect(bytes).toContain('una sola parcela y es la que describe')
  })

  it('⛔ sin tipo declarado imprime SIN DECLARAR y lo saca por `incidencias`', () => {
    // No se inventa uno «por defecto»: declarar un acto jurídico que nadie ha
    // elegido es exactamente lo que el override O20 prohíbe. Se imprime el hueco y
    // se dice que lo hay, para que no pase inadvertido.
    const r = informePdfParcela({
      diagnostico: DIAGNOSTICO,
      encabezado: encabezado(),
      expediente: { ...EXPEDIENTE, tipoOperacion: null },
    })
    expect(aLatin1(r.bytes)).toContain('SIN DECLARAR')
    expect(r.incidencias.join(' ')).toMatch(/sin declarar el tipo de operación/)
  })

  it('⛔ una lista que no marca EXACTAMENTE una descrita sale por `incidencias`', () => {
    // Ni cero ni dos: la marca existe para señalar a UNA, y si no lo hace el papel
    // dice algo que no es. Se declara en vez de corregirse sola.
    const ninguna = informePdfParcela({
      diagnostico: DIAGNOSTICO,
      encabezado: encabezado(),
      expediente: {
        ...EXPEDIENTE,
        miembros: EXPEDIENTE.miembros.map((m) => ({ ...m, descrita: false })),
      },
    })
    expect(ninguna.incidencias.join(' ')).toMatch(/marca 0 como descrita/)

    const dos = informePdfParcela({
      diagnostico: DIAGNOSTICO,
      encabezado: encabezado(),
      expediente: {
        ...EXPEDIENTE,
        miembros: EXPEDIENTE.miembros.map((m) => ({ ...m, descrita: true })),
      },
    })
    expect(dos.incidencias.join(' ')).toMatch(/marca 2 como descrita/)
  })

  it('⚠️ `expediente: null` NO imprime la sección, y es deliberado', () => {
    // Un informe sin ella dice lo mismo que decían todos los de F09 —describe una
    // parcela—, que es la verdad mientras nadie declare otra cosa.
    const bytes = pdf(null)
    expect(bytes).not.toContain('ALCANCE DE ESTE INFORME')
    expect(bytes).not.toContain('Dato DECLARATIVO')
  })
})

// ── 2 · El informe de texto ─────────────────────────────────────────────────

describe('informeContrasteTexto · la misma sección, en el otro medio', () => {
  it('⭐ trae el tipo, el porqué, el aviso y la lista con su marca', () => {
    const t = texto(EXPEDIENTE)
    expect(t).toContain('ALCANCE DE ESTE INFORME')
    expect(t).toContain('Segregación')
    expect(t).toContain('Dato DECLARATIVO')
    expect(t).toContain(`${REF}.1`)
    expect(t).toContain('<-- LA QUE SE DESCRIBE')
  })

  it('la marca señala a UNA sola fila, que es todo el sentido de ponerla', () => {
    const t = texto(EXPEDIENTE)
    expect(t.match(/<-- LA QUE SE DESCRIBE/g)).toHaveLength(1)
  })

  it('⛔ la lista del EXPEDIENTE no se confunde con la del FICHERO leído', () => {
    // Son dos preguntas distintas: «el fichero que abriste traía éstas» y «el
    // expediente que vas a presentar lleva éstas». Marcas distintas a propósito.
    const t = texto(EXPEDIENTE)
    expect(t).toContain('Parcelas que lleva el expediente')
    expect(t).not.toContain('Parcelas que trae el fichero') // no hubo fichero
  })

  it('sin declarar, dice SIN DECLARAR también en texto', () => {
    expect(texto({ ...EXPEDIENTE, tipoOperacion: null })).toContain('SIN DECLARAR')
  })

  it('⚠️ `expediente: null` la omite entera, y renumera sin dejar hueco', () => {
    const t = texto(null)
    expect(t).not.toContain('ALCANCE DE ESTE INFORME')
    // La sección 2 pasa a ser la siguiente que haya: no queda un «2.» vacío.
    expect(t).toMatch(/\n2\. [A-ZÁÉÍÓÚÑ]/)
  })
})

// ── 3 · Los guardianes de vocabulario ───────────────────────────────────────

describe('las tres copias de «Subsanación» no pueden divergir', () => {
  it('⛔ `contraste-texto.js#OPERACION_CONOCIDA` es espejo de `TIPO_OPERACION`', () => {
    // Ese módulo tiene CERO IMPORTS por regla propia, así que copia las claves. Lo
    // que impide que las dos listas envejezcan es esto, no la disciplina.
    expect(OPERACION_CONOCIDA).toEqual(TIPO_OPERACION)
  })

  it('⛔ y el aviso declarativo es LITERALMENTE el mismo en los dos ficheros', () => {
    // Se compara contra el TEXTO FUENTE, no contra una constante importada: si se
    // importara, no habría nada que comprobar. Es la misma fórmula que ata
    // `PRESUNCION_CONOCIDA` con `report/literal.js`.
    const fuente = readFileSync(join(RAIZ, 'report', 'contraste-texto.js'), 'utf8')
    // Las tres marcas de F09 tienen que estar dentro de la frase que el lector copia.
    for (const marca of ['Dato DECLARATIVO', 'no lo caza nadie', 'Confírmelo en la Sede']) {
      expect(AVISO_DECLARATIVO, `el original no dice «${marca}»`).toContain(marca)
      expect(fuente, `la copia de contraste-texto.js no dice «${marca}»`).toContain(marca)
    }
    // Y el informe de texto lo imprime entero, no un resumen.
    expect(texto(EXPEDIENTE).replace(/\s+/g, ' ')).toContain(
      AVISO_DECLARATIVO.replace(/\s+/g, ' '),
    )
  })

  it('⛔ `derivacion/operacion.js` sigue sin arrastrar nada — que es por lo que el PDF SÍ lo importa', () => {
    // `report/pdf-parcela.js` copia `PRESUNCION_CONOCIDA` de `report/literal.js`
    // porque aquel módulo arrastra Turf a un maquetador. Con `operacion.js` no hace
    // falta, y este test es lo que mantiene cierto ese «no hace falta»: el día que
    // alguien le meta un import pesado, se pondrá rojo y habrá que copiar.
    const fuente = readFileSync(join(RAIZ, 'derivacion', 'operacion.js'), 'utf8')
    const imports = [...fuente.matchAll(/(?:^|\n)[ \t]*import[\s\S]*?\bfrom[ \t]+['"]([^'"]+)['"]/g)].map(
      (m) => m[1],
    )
    expect(imports).toEqual(['./identidad.js'])
    // Y su único vecino tampoco importa nada: la cadena entera es una hoja.
    const identidad = readFileSync(join(RAIZ, 'derivacion', 'identidad.js'), 'utf8')
    expect(identidad).not.toMatch(/(?:^|\n)[ \t]*import[\s\S]*?\bfrom[ \t]+['"]/)
    // Mitad anti-vacuidad: el detector ve un import si lo hay.
    expect(
      [...("import x from '@turf/area'\n").matchAll(/(?:^|\n)[ \t]*import[\s\S]*?\bfrom[ \t]+['"]([^'"]+)['"]/g)].map(
        (m) => m[1],
      ),
    ).toEqual(['@turf/area'])
  })
})
