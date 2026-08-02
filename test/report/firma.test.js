/* -------------------------------------------------------------------------- *
 * test/report/firma.test.js — F09 · T3.3 · el pie de firma y el encabezado    *
 *                                                                            *
 * `spec/feature-09-informe-parcela.md:21`: **«el punto 6 sostiene toda la     *
 * propuesta de valor»**. El punto 6 es este fichero. Lo que hay que probar no *
 * es aritmética —aquí no se calcula nada—, sino que el bloque que alguien va  *
 * a firmar y entregar:                                                        *
 *                                                                            *
 *   1. No deja NUNCA un hueco mudo. `null` y `''` se imprimen «No consta»,    *
 *      y el `valor` de toda línea es una cadena no vacía, siempre.            *
 *   2. Distingue los TRES sabores de «no hay»: el dato que falta, el que no   *
 *      se pidió, y el que se pidió y no se pudo traer. Confundir el segundo   *
 *      con el primero es afirmar algo sobre el Catastro que no sabemos.       *
 *   3. Trata como NORMAL el caso real de la parcela urbana del proyecto:      *
 *      municipio y provincia sí, paraje y polígono/parcela no. Se deriva del  *
 *      fixture REAL del servicio, no de un objeto inventado a mano.           *
 *   3 bis. Y no confunde «no lo tenemos» con «no existe para esta finca»:     *
 *      paraje, polígono y parcela identifican a la finca RÚSTICA, así que en  *
 *      una urbana no se imprimen —ni con un sustituto— y su sitio lo ocupan   *
 *      la clase y el domicilio. Con la clase sin determinar NO se adivina.    *
 *      Las dos clases salen de las dos capturas reales, leídas con el lector  *
 *      del contrato E.                                                        *
 *   4. **No presupone titulación** en una sola de las palabras que imprime.   *
 *      Es un requisito jurídico, no de redacción (`MEJORES_PRACTICAS_GML.md`  *
 *      §5.2: quién puede firmar qué está en disputa), y por eso hay un        *
 *      guardián de vocabulario que además se prueba a sí mismo.               *
 *   5. No lee el reloj, con un grep sobre su TEXTO fuente — mismo guardián,   *
 *      con las mismas palabras, que `test/report/contraste-texto.test.js`.    *
 *                                                                            *
 * ⚠️ El SOBRE del contrato E (`ok`, `motivo`, `mensaje`, `procedencia`) se    *
 * fabrica aquí: lo pone `services/catastro.js` y no hace falta traerlo entero *
 * para probar un encabezado. Los DATOS, en cambio, ya no se teclean: se leen  *
 * de las dos capturas reales con `services/_catastro-dnp.js#leerDnprc`, que   *
 * existe y está en verde desde T2.3. Ni el municipio, ni la ausencia de       *
 * paraje, ni la clase de cada finca son inventos de esta prueba. Que las dos  *
 * partes hablen el mismo idioma tampoco se da por hecho: hay una prueba que   *
 * ata el vocabulario de la clase y la lista de campos a los del contrato E.   *
 *                                                                            *
 * Proyecto Vitest `node`: texto puro, sin DOM.                                *
 *                                                                            *
 * ── MUTACIONES EJECUTADAS PARA COMPROBAR QUE LOS GUARDIANES NO SON VACUOS ── *
 * (Cada una se aplicó a `report/firma.js`, se corrió `npm run test:node`, se  *
 * anotó el rojo y se revirtió CON EL EDITOR — nunca con `git checkout`: hay   *
 * trabajo sin commitear en este árbol.)                                       *
 *                                                                            *
 * · M1 · `paraImprimir` → devolver `''` en vez de `NO_CONSTA`.                *
 *   ROJO 4, empezando por «ninguna línea deja un hueco mudo».                 *
 * · M2 · en `lineasEncabezado`, devolver `NO_CONSTA` también cuando           *
 *   `!p.consultado` (o sea, FUNDIR los sabores 2 y 3).                        *
 *   ROJO 1 la primera vez, y es información: la suite afirmaba el sabor 3     *
 *   pero no que los tres fueran DISTINTOS ENTRE SÍ sobre el mismo dato. Se    *
 *   añadió «el MISMO encabezado se imprime distinto…», que compara los tres   *
 *   textos del `paraje` —`null` en los tres casos— y exige que sean tres.     *
 *   Con ella, ROJO 2.                                                         *
 * · M3 · en `limpiar`, quitar el `trim()` (dejar solo el colapso).            *
 *   ROJO 6: los espacios de los extremos, el `'   '` que debe dar `null`, y   *
 *   de rebote `hayAlgunDato` y el recorte de `refcat`/`srs`.                  *
 * · M4 · `exigirClavesConocidas` → no comprobar nada.                         *
 *   ROJO 2: la clave mal escrita que se perdería en silencio, en la firma y   *
 *   en el encabezado.                                                         *
 * · M5 · `componerIdDocumento` → quitar la `Z` final.                         *
 *   ROJO 6: la forma exacta, `esIdDocumento`, y el `''` del Expediente.       *
 * · M6 · `exigirTextoONulo` → aceptar números con `String(valor)`.            *
 *   ROJO 2: el número de colegiado con cero a la izquierda, y la fecha.       *
 * · M7 · `TITULO_FIRMA` → `'El técnico competente que suscribe'`.             *
 *   ROJO 2: el guardián de vocabulario y el título.                           *
 * · M8 · `ROTULO_FIRMA.nombre` → `'Nombre del técnico'` (la mutación fina: un *
 *   solo rótulo, sin tocar el título).                                        *
 *   ROJO 1: el guardián de vocabulario, que mira TODOS los rótulos y no solo  *
 *   los que alguien se acuerde de listar.                                     *
 *                                                                            *
 * (Las cuatro siguientes, con el arreglo de la clase de finca.)               *
 *                                                                            *
 * · M9 · `noAplica` → no ocultar nunca (`if (true) return false`), o sea el   *
 *   defecto original de vuelta: la urbana volvería a pedir disculpas por el   *
 *   polígono.                                                                 *
 *   ROJO 5, empezando por «URBANA: paraje, polígono y parcela NO se imprimen» *
 *   y «EL DEFECTO, clavado».                                                  *
 * · M10 · `noAplica` → ocultar por REGLA, sin mirar si hay dato.              *
 *   ROJO 1, y es el que importa: «LA INVARIANTE: una fila solo se oculta si   *
 *   NO tiene dato». Sin esa prueba, la ocultación podría tragarse un dato.    *
 * · M11 · `claseDe` → devolver `URBANA` cuando no hay clase (adivinar).       *
 *   ROJO 4: el sabor 3 de siempre, los tres sabores sobre el mismo paraje,    *
 *   «CLASE `null`: no se adivina» y el encabezado antiguo sin la clave.       *
 * · M12 · `exigirClase` → aceptar cualquier valor.                            *
 *   ROJO 1: la clase que no es del contrato E, que se imprimiría tal cual y   *
 *   además dejaría a una urbana con las tres filas rústicas.                  *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { crearExpediente } from '../../model/parcela.js'
import {
  CAMPOS_DEL_SERVICIO,
  CAMPOS_ENCABEZADO,
  CAMPOS_FIRMA,
  CAMPOS_SOLO_RUSTICA,
  CLASES_ADMITIDAS,
  CLASE_RUSTICA,
  CLASE_URBANA,
  FIRMA_VACIA,
  NO_CONSTA,
  NO_CONSULTADO,
  NO_SE_HA_PODIDO_CONSULTAR,
  PREFIJO_ID_DOCUMENTO,
  ROTULO_ENCABEZADO,
  ROTULO_FIRMA,
  SIN_REFCAT,
  TITULO_FIRMA,
  componerEncabezado,
  componerIdDocumento,
  esIdDocumento,
  hayAlgunDato,
  lineasEncabezado,
  lineasFirma,
  normalizarFirma,
  paraImprimir,
  procedenciaDescriptivos,
  textoFecha,
} from '../../report/firma.js'
import {
  CAMPOS_DESCRIPTIVOS,
  CLASE_PARCELA,
  leerDnprc,
} from '../../services/_catastro-dnp.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const FUENTE_MODULO = readFileSync(join(RAIZ, 'report', 'firma.js'), 'utf8')

/** Instante FIJO. La fecha entra por parámetro; el módulo no consulta el reloj. */
const FECHA = new Date(Date.UTC(2026, 7, 2, 17, 4, 53))

const REF = '9398516VK3799G'
const REF_RUSTICA = '13005A10900005'

// ── Los DOS casos REALES: una urbana y una rústica ──────────────────────────
//
// Los fixtures son las respuestas que dio el servicio descriptivo del Catastro
// para la parcela de referencia del proyecto (urbana, rama `lrcdnp`, 18
// inmuebles) y para una rústica (rama `bico`). De la primera sale el municipio y
// la provincia; y sale también —esto es lo importante— que NO trae paraje, ni
// polígono, ni parcela, ni domicilio. De la segunda salen el paraje «C.BOLSA», el
// polígono 109 y la parcela 5, que es el sistema de identificación de una finca
// rústica y no existe para la urbana.
//
// ⚠️ Los DATOS ya no se teclean aquí: se leen con el lector REAL
// (`services/_catastro-dnp.js#leerDnprc`, que existe y está en verde desde T2.3)
// sobre el fichero capturado. Lo que se sigue fabricando en este test es el SOBRE
// —`ok`, `motivo`, `mensaje`, `procedencia`—, que es lo que pone `services/
// catastro.js` y no hace falta traer entero para probar un encabezado. Que las
// dos partes hablen el mismo idioma no se da por hecho: hay una prueba que ata el
// vocabulario de la clase y la lista de campos a los del contrato E.

const leerFixture = (nombre) =>
  readFileSync(join(RAIZ, 'test', 'fixtures', 'catastro', nombre), 'utf8')

const TEXTO_URBANA = leerFixture(`ovc-dnprc-urbana-${REF}.json`)
const TEXTO_RUSTICA = leerFixture(`ovc-dnprc-rustica-${REF_RUSTICA}.json`)

/** El primer inmueble de la respuesta real, del que se leen los descriptivos. */
const DT_REAL = JSON.parse(TEXTO_URBANA).consulta_dnprcResult.lrcdnp.rcdnp[0].dt

/** El sobre del CONTRATO E con los datos REALES de la urbana. */
const DESCRIPTIVOS_URBANA = Object.freeze({
  ok: true,
  motivo: null,
  mensaje: null,
  procedencia: { origen: 'RED', edadMs: null, intentos: 1, ms: 214, url: 'https://…' },
  datos: Object.freeze(leerDnprc(TEXTO_URBANA).datos),
})

/** Íd. con los de la RÚSTICA, que sí tiene paraje, polígono y parcela. */
const DESCRIPTIVOS_RUSTICA = Object.freeze({
  ok: true,
  motivo: null,
  mensaje: null,
  procedencia: { origen: 'RED', edadMs: null, intentos: 1, ms: 198, url: 'https://…' },
  datos: Object.freeze(leerDnprc(TEXTO_RUSTICA).datos),
})

/**
 * Un sobre CONTESTADO en el que la clase quedó **sin determinar**. No es un
 * invento: `leerDnprc` devuelve `clase: null` cuando el subárbol no es
 * concluyente o `cn` lo contradice (decisión B del contrato E), y es el caso en
 * el que este módulo NO puede adivinar qué filas aplican.
 */
const DESCRIPTIVOS_SIN_CLASE = Object.freeze({
  ok: true,
  motivo: null,
  mensaje: null,
  procedencia: { origen: 'RED', edadMs: null, intentos: 1, ms: 201, url: 'https://…' },
  datos: Object.freeze({
    municipio: DESCRIPTIVOS_URBANA.datos.municipio,
    provincia: DESCRIPTIVOS_URBANA.datos.provincia,
    paraje: null,
    poligono: null,
    parcela: null,
    domicilio: null,
    clase: null,
  }),
})

/** Un sobre de contrato E que falló, con el `mensaje` ya redactado por services/. */
const DESCRIPTIVOS_FALLIDOS = Object.freeze({
  ok: false,
  motivo: 'ESTADO_HTTP',
  mensaje: 'El Catastro ha contestado con un error 503. Vuelve a intentarlo dentro de un rato.',
  procedencia: { origen: 'RED', edadMs: null, intentos: 3, ms: 12040, url: 'https://…' },
  datos: null,
})

/** El encabezado del caso real (urbana), ya compuesto. */
const encabezadoReal = (cambios = {}) =>
  componerEncabezado({
    descriptivos: DESCRIPTIVOS_URBANA,
    refcat: REF,
    srs: 'EPSG:25830',
    fecha: FECHA,
    ...cambios,
  })

/** Íd. con la rústica. */
const encabezadoRustico = (cambios = {}) =>
  componerEncabezado({
    descriptivos: DESCRIPTIVOS_RUSTICA,
    refcat: REF_RUSTICA,
    srs: 'EPSG:25830',
    fecha: FECHA,
    ...cambios,
  })

/** Índice campo → línea, para poder afirmar por nombre y no por posición. */
const porCampo = (lineas) => Object.fromEntries(lineas.map((l) => [l.campo, l]))

// ═════════════════════════════════════════════════════════════════════════════
// 1 · La verdad externa: qué trae de verdad el servicio para una urbana
// ═════════════════════════════════════════════════════════════════════════════

describe('report/firma · el caso real de la parcela urbana (hecho MEDIDO)', () => {
  it('el fixture del servicio trae municipio y provincia', () => {
    expect(DT_REAL.nm).toBe('MADRID')
    expect(DT_REAL.np).toBe('MADRID')
  })

  it('y NO trae paraje, ni polígono/parcela, ni domicilio: la rama urbana no los tiene', () => {
    // Si esto se pusiera rojo, el «caso normal» habría dejado de serlo y habría
    // que revisar todo lo que esta prueba da por sabido. La afirmación va sobre el
    // FICHERO y no sobre nuestro parser, para que valga aunque el parser cambie.
    expect(DT_REAL.locs.lors).toBeUndefined() // `lors` es la rama RÚSTICA
    expect(DT_REAL.locs.lous).toBeDefined() // y la que hay es la urbana
    expect(DT_REAL.ldt).toBeUndefined() // el domicilio ya montado tampoco viene
  })

  it('las dos capturas son de CLASES distintas, y lo dice el lector real', () => {
    // La premisa entera de la sección 4 bis. No se teclea «URBANA» en ningún
    // sitio de este fichero: sale del lector del contrato E leyendo el fichero
    // capturado.
    expect(DESCRIPTIVOS_URBANA.datos.clase).toBe(CLASE_PARCELA.URBANA)
    expect(DESCRIPTIVOS_RUSTICA.datos.clase).toBe(CLASE_PARCELA.RUSTICA)
  })

  it('la RÚSTICA sí trae paraje, polígono y parcela: son SU identificador', () => {
    expect(DESCRIPTIVOS_RUSTICA.datos.paraje).toBe('C.BOLSA')
    expect(DESCRIPTIVOS_RUSTICA.datos.poligono).toBe('109')
    expect(DESCRIPTIVOS_RUSTICA.datos.parcela).toBe('5')
    // Y la urbana no trae ninguno de los tres. Aquí está la asimetría que este
    // módulo tiene que imprimir bien.
    for (const campo of CAMPOS_SOLO_RUSTICA) {
      expect(DESCRIPTIVOS_URBANA.datos[campo], campo).toBeNull()
    }
  })

  it('el vocabulario de la clase es EL DEL CONTRATO E, no uno paralelo', () => {
    // `report/firma.js` no importa nada —es puro y hay un guardián por grep—, así
    // que las dos constantes están escritas dos veces. Esta prueba es lo que
    // impide que se separen sin que nadie se entere.
    expect(CLASE_URBANA).toBe(CLASE_PARCELA.URBANA)
    expect(CLASE_RUSTICA).toBe(CLASE_PARCELA.RUSTICA)
    expect([...CLASES_ADMITIDAS].sort()).toEqual(Object.values(CLASE_PARCELA).sort())
  })

  it('y los campos que el encabezado espera del servicio son los que el servicio da', () => {
    expect([...CAMPOS_DEL_SERVICIO].sort()).toEqual([...CAMPOS_DESCRIPTIVOS].sort())
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Normalizar la firma
// ═════════════════════════════════════════════════════════════════════════════

describe('report/firma · normalizarFirma', () => {
  it('devuelve SIEMPRE los cuatro campos del contrato, y ninguno más', () => {
    expect(Object.keys(normalizarFirma({ nombre: 'Alguien' }))).toEqual([...CAMPOS_FIRMA])
    expect(Object.keys(normalizarFirma())).toEqual([...CAMPOS_FIRMA])
  })

  it('recorta los extremos y colapsa los espacios internos, saltos de línea incluidos', () => {
    // El caso real: un nombre pegado desde un correo trae un salto dentro, y ese
    // salto rompería la caja del pie de firma en el PDF.
    const firma = normalizarFirma({
      nombre: '  Nombre\n  Apellido  Apellido ',
      contacto: '\tcorreo@ejemplo.es\n',
    })
    expect(firma.nombre).toBe('Nombre Apellido Apellido')
    expect(firma.contacto).toBe('correo@ejemplo.es')
  })

  it('`\'\'`, los espacios sueltos y los campos ausentes son `null`, que es lo que se imprime «No consta»', () => {
    const firma = normalizarFirma({ nombre: '', numeroColegiado: '   ', colegio: null })
    expect(firma.nombre).toBeNull()
    expect(firma.numeroColegiado).toBeNull()
    expect(firma.colegio).toBeNull()
    expect(firma.contacto).toBeNull() // ni siquiera venía
  })

  it('sin argumento, o con null, da la firma vacía — el primer arranque no es un error', () => {
    expect(normalizarFirma()).toEqual({ ...FIRMA_VACIA })
    expect(normalizarFirma(null)).toEqual({ ...FIRMA_VACIA })
    expect(normalizarFirma(undefined)).toEqual({ ...FIRMA_VACIA })
  })

  it('un informe SIN número de colegiado no lanza: es un informe legítimo', () => {
    expect(() => normalizarFirma({ nombre: 'Alguien' })).not.toThrow()
  })

  it('devuelve un objeto NUEVO y mutable, y no toca la entrada', () => {
    const entrada = { nombre: '  Alguien  ' }
    const a = normalizarFirma(entrada)
    const b = normalizarFirma(entrada)
    expect(a).not.toBe(b)
    expect(Object.isFrozen(a)).toBe(false)
    expect(entrada.nombre).toBe('  Alguien  ') // sin tocar
    // Y no es la constante congelada disfrazada.
    expect(normalizarFirma()).not.toBe(FIRMA_VACIA)
  })

  it('una clave DESCONOCIDA lanza, nombrándola: perderla en silencio sería el peor fallo', () => {
    // `colegiado` es `numeroColegiado` con una palabra de menos. Ignorarlo dejaría
    // el documento firmado con «No consta» donde el usuario escribió su número.
    expect(() => normalizarFirma({ nombre: 'Alguien', colegiado: '04321' })).toThrow(TypeError)
    expect(() => normalizarFirma({ colegiado: '04321' })).toThrow(/colegiado/)
    expect(() => normalizarFirma({ colegiado: '04321' })).toThrow(/numeroColegiado/)
  })

  it('un NÚMERO de colegiado lanza: `String(4321)` perdería el cero de `04321` en silencio', () => {
    expect(() => normalizarFirma({ numeroColegiado: 4321 })).toThrow(TypeError)
    expect(() => normalizarFirma({ numeroColegiado: 4321 })).toThrow(/ceros a la izquierda/)
    // Y con la cadena, el cero sobrevive.
    expect(normalizarFirma({ numeroColegiado: '04321' }).numeroColegiado).toBe('04321')
  })

  it('los tipos imposibles lanzan TypeError', () => {
    expect(() => normalizarFirma('Alguien')).toThrow(TypeError)
    expect(() => normalizarFirma([])).toThrow(TypeError)
    expect(() => normalizarFirma(7)).toThrow(TypeError)
    expect(() => normalizarFirma({ nombre: {} })).toThrow(TypeError)
    expect(() => normalizarFirma({ contacto: true })).toThrow(TypeError)
  })

  it('hayAlgunDato distingue la firma vacía de la que tiene un solo campo', () => {
    expect(hayAlgunDato()).toBe(false)
    expect(hayAlgunDato({ nombre: '  ' })).toBe(false)
    expect(hayAlgunDato({ contacto: '600 000 000' })).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Lo que se imprime: ni un hueco mudo
// ═════════════════════════════════════════════════════════════════════════════

describe('report/firma · la regla dura: `null` y `\'\'` se imprimen «No consta»', () => {
  it('paraImprimir sustituye lo que falta y respeta lo que hay', () => {
    expect(paraImprimir(null)).toBe(NO_CONSTA)
    expect(paraImprimir('')).toBe(NO_CONSTA)
    expect(paraImprimir('   ')).toBe(NO_CONSTA)
    expect(paraImprimir(undefined)).toBe(NO_CONSTA)
    expect(paraImprimir('  Alguien  ')).toBe('Alguien')
  })

  it('las cuatro líneas de la firma salen SIEMPRE, también con la firma en blanco', () => {
    const lineas = lineasFirma()
    expect(lineas.map((l) => l.campo)).toEqual([...CAMPOS_FIRMA])
    expect(lineas.every((l) => l.valor === NO_CONSTA)).toBe(true)
    expect(lineas.every((l) => l.consta === false)).toBe(true)
  })

  it('ninguna línea deja un hueco mudo: `valor` es siempre una cadena no vacía', () => {
    // El guardián central de este fichero. Se comprueba sobre las cuatro
    // combinaciones que de verdad pasan: firma llena, firma vacía, encabezado con
    // servicio y encabezado sin servicio.
    const casos = [
      lineasFirma(),
      lineasFirma({ nombre: 'Alguien', numeroColegiado: '04321' }),
      lineasEncabezado(encabezadoReal(), { procedencia: DESCRIPTIVOS_URBANA }),
      lineasEncabezado(encabezadoRustico(), { procedencia: DESCRIPTIVOS_RUSTICA }),
      lineasEncabezado(componerEncabezado({ fecha: FECHA })),
      lineasEncabezado(componerEncabezado({ fecha: FECHA }), {
        procedencia: DESCRIPTIVOS_FALLIDOS,
      }),
    ]
    for (const lineas of casos) {
      for (const linea of lineas) {
        expect(typeof linea.valor, `${linea.campo} no es texto`).toBe('string')
        expect(linea.valor.trim(), `${linea.campo} está en blanco`).not.toBe('')
        expect(typeof linea.etiqueta).toBe('string')
        expect(linea.etiqueta.trim()).not.toBe('')
      }
    }
  })

  it('`consta` dice si hay dato, y no si el dato es bueno (regla de oro 9)', () => {
    const lineas = porCampo(lineasFirma({ nombre: 'Alguien' }))
    expect(lineas.nombre).toMatchObject({ valor: 'Alguien', consta: true })
    expect(lineas.contacto).toMatchObject({ valor: NO_CONSTA, consta: false })
  })

  it('los rótulos de las líneas son los del módulo, no otros inventados por el maquetador', () => {
    for (const linea of lineasFirma()) expect(linea.etiqueta).toBe(ROTULO_FIRMA[linea.campo])
    for (const linea of lineasEncabezado(encabezadoReal())) {
      expect(linea.etiqueta).toBe(ROTULO_ENCABEZADO[linea.campo])
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · El encabezado y los TRES sabores de «no hay»
// ═════════════════════════════════════════════════════════════════════════════

describe('report/firma · componerEncabezado', () => {
  it('devuelve las nueve claves del contrato D, en orden', () => {
    expect(Object.keys(encabezadoReal())).toEqual([...CAMPOS_ENCABEZADO])
  })

  it('EL CASO REAL: municipio y provincia constan; paraje y polígono/parcela, no', () => {
    const e = encabezadoReal()
    expect(e.municipio).toBe('MADRID')
    expect(e.provincia).toBe('MADRID')
    expect(e.paraje).toBeNull()
    expect(e.poligono).toBeNull()
    expect(e.parcela).toBeNull()
    expect(e.refcat).toBe(REF)
    expect(e.srs).toBe('EPSG:25830')
    expect(e.fecha).toBe(FECHA)
  })

  it('y ese caso se IMPRIME con «No consta» en el sitio de lo que falta, no con un hueco', () => {
    const l = porCampo(lineasEncabezado(encabezadoReal(), { procedencia: DESCRIPTIVOS_URBANA }))
    expect(l.municipio.valor).toBe('MADRID')
    expect(l.municipio.consta).toBe(true)
    // El domicilio es el identificador de una finca urbana y esta finca lo tiene:
    // el que no lo tiene es el servicio en esta rama. Ausencia de verdad, sabor 2.
    expect(l.domicilio.valor).toBe(NO_CONSTA)
    expect(l.domicilio.consta).toBe(false)
    // Paraje, polígono y parcela NO se imprimen en una urbana, y por qué está en
    // la sección 4 bis. Aquí basta con que no estén.
    for (const campo of CAMPOS_SOLO_RUSTICA) expect(l[campo], campo).toBeUndefined()
  })

  it('SABOR 3: si NADIE consultó el servicio, se dice «No se ha consultado», no «No consta»', () => {
    // La distinción más cara de perder: «No consta el paraje» afirma algo sobre el
    // Catastro; «no se ha consultado» afirma lo único que sabemos.
    const e = componerEncabezado({ refcat: REF, srs: 'EPSG:25830', fecha: FECHA })
    const l = porCampo(lineasEncabezado(e)) // sin procedencia ⇒ no se consultó
    for (const campo of CAMPOS_DEL_SERVICIO) {
      expect(l[campo].valor, campo).toBe(NO_CONSULTADO)
      expect(l[campo].consta, campo).toBe(false)
    }
    // Y los que pone la aplicación NO llevan ese sabor: si falta el SRS, falta
    // aquí dentro y no en el Catastro.
    expect(l.srs.valor).toBe('EPSG:25830')
    expect(porCampo(lineasEncabezado(componerEncabezado({ fecha: FECHA }))).srs.valor).toBe(
      NO_CONSTA,
    )
    expect(porCampo(lineasEncabezado(componerEncabezado({ fecha: FECHA }))).refcat.valor).toBe(
      NO_CONSTA,
    )
  })

  it('SABOR 3 bis: si se consultó y falló, se dice «No se ha podido consultar» + el porqué', () => {
    const e = componerEncabezado({ descriptivos: DESCRIPTIVOS_FALLIDOS, refcat: REF, fecha: FECHA })
    const l = porCampo(lineasEncabezado(e, { procedencia: DESCRIPTIVOS_FALLIDOS }))
    expect(l.municipio.valor).toBe(NO_SE_HA_PODIDO_CONSULTAR)
    // El mensaje llega redactado de `services/` y se copia LITERAL (regla de oro 1).
    expect(l.municipio.detalle).toBe(DESCRIPTIVOS_FALLIDOS.mensaje)
    expect(l.provincia.detalle).toBe(DESCRIPTIVOS_FALLIDOS.mensaje)
  })

  it('los tres sabores son TRES textos distintos, y ninguno se parece a los otros', () => {
    const textos = new Set([NO_CONSTA, NO_CONSULTADO, NO_SE_HA_PODIDO_CONSULTAR])
    expect(textos.size).toBe(3)
  })

  it('EL MISMO encabezado se imprime distinto según se haya consultado el servicio o no', () => {
    // La prueba que de verdad separa los sabores 2 y 3: el `paraje` es `null` en
    // los tres casos —el dato no está—, y sin embargo las tres líneas dicen cosas
    // distintas, porque lo que ha pasado es distinto. Si alguien fundiera dos
    // sabores, dos de estos tres textos se igualarían.
    //
    // Se usa el sobre SIN CLASE y no el de la urbana: en una urbana el paraje ni
    // siquiera se imprime, porque no es que falte, es que no existe (sección 4
    // bis). Los tres sabores son sobre datos que la finca PODRÍA tener.
    const e = componerEncabezado({
      descriptivos: DESCRIPTIVOS_SIN_CLASE,
      refcat: REF,
      fecha: FECHA,
    })
    const sinConsultar = porCampo(lineasEncabezado(e)).paraje.valor
    const consultado = porCampo(lineasEncabezado(e, { procedencia: DESCRIPTIVOS_SIN_CLASE })).paraje
      .valor
    const fallido = porCampo(lineasEncabezado(e, { procedencia: DESCRIPTIVOS_FALLIDOS })).paraje
      .valor

    expect(new Set([sinConsultar, consultado, fallido]).size).toBe(3)
    expect(sinConsultar).toBe(NO_CONSULTADO)
    expect(consultado).toBe(NO_CONSTA)
    expect(fallido).toBe(NO_SE_HA_PODIDO_CONSULTAR)
  })

  it('acepta el sobre del contrato E directamente como `procedencia`, sin traducirlo', () => {
    // Obligar a traducir es la clase de paso que se olvida y deja los cinco campos
    // con el sabor equivocado.
    const e = encabezadoReal()
    const conSobre = lineasEncabezado(e, { procedencia: DESCRIPTIVOS_URBANA })
    const conTraduccion = lineasEncabezado(e, {
      procedencia: procedenciaDescriptivos(DESCRIPTIVOS_URBANA),
    })
    expect(conSobre).toEqual(conTraduccion)
  })

  it('los descriptivos se COPIAN del servicio y no se completan de ningún otro sitio', () => {
    const e = componerEncabezado({
      descriptivos: {
        ok: true,
        datos: { municipio: '  SEVILLA ', provincia: 'SEVILLA', paraje: '', poligono: '8' },
      },
      fecha: FECHA,
    })
    expect(e.municipio).toBe('SEVILLA') // recortado
    expect(e.paraje).toBeNull() // `''` es `null`
    expect(e.poligono).toBe('8')
    expect(e.parcela).toBeNull() // el servicio no lo trajo: aquí tampoco está
  })

  it('recorta refcat y srs, y `\'\'` es `null`', () => {
    const e = componerEncabezado({ refcat: `  ${REF} `, srs: '  ', fecha: FECHA })
    expect(e.refcat).toBe(REF)
    expect(e.srs).toBeNull()
  })

  it('la fecha es obligatoria y entra por parámetro', () => {
    expect(() => componerEncabezado({ refcat: REF })).toThrow(TypeError)
    expect(() => componerEncabezado({ refcat: REF })).toThrow(/no consulta el reloj/)
    expect(() => componerEncabezado({ fecha: '2026-08-02' })).toThrow(TypeError)
    expect(() => componerEncabezado({ fecha: new Date('vaya') })).toThrow(RangeError)
  })

  it('una clave desconocida en el argumento lanza, nombrándola', () => {
    expect(() => componerEncabezado({ fecha: FECHA, municipio: 'MADRID' })).toThrow(TypeError)
    expect(() => componerEncabezado({ fecha: FECHA, municipio: 'MADRID' })).toThrow(/municipio/)
  })

  it('un sobre SIN `datos` lanza: no es el contrato E, y `null` no es lo mismo que vacío', () => {
    expect(() => componerEncabezado({ descriptivos: { ok: true }, fecha: FECHA })).toThrow(
      /datos/,
    )
    expect(() => componerEncabezado({ descriptivos: 'MADRID', fecha: FECHA })).toThrow(TypeError)
  })

  it('lineasEncabezado exige un encabezado completo: nadie maqueta un objeto a medias', () => {
    expect(() => lineasEncabezado({ municipio: 'MADRID' })).toThrow(TypeError)
    expect(() => lineasEncabezado({ municipio: 'MADRID' })).toThrow(/componerEncabezado/)
    expect(() => lineasEncabezado(null)).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 bis · El identificador de la finca depende de su CLASE
// ═════════════════════════════════════════════════════════════════════════════
//
// Paraje, polígono y parcela son el sistema de identificación de la finca
// RÚSTICA. Una urbana no los tiene —no le faltan, no existen para ella—, y su
// identificador equivalente es el domicilio. Imprimir «Polígono: No se ha
// consultado» en el informe de una urbana no es un error silencioso, pero sí un
// no-error que confunde: quien lo lea entenderá «se omitió» cuando lo cierto es
// «no aplica». En un documento que alguien firma cuesta lo mismo.

describe('report/firma · lo que identifica a la finca depende de su clase', () => {
  it('URBANA: paraje, polígono y parcela NO se imprimen', () => {
    const lineas = lineasEncabezado(encabezadoReal(), { procedencia: DESCRIPTIVOS_URBANA })
    const campos = lineas.map((l) => l.campo)
    for (const campo of CAMPOS_SOLO_RUSTICA) expect(campos, campo).not.toContain(campo)
    // Y no es que se hayan caído todas: las que sí identifican a una urbana están.
    expect(campos).toContain('clase')
    expect(campos).toContain('domicilio')
    expect(campos).toContain('refcat')
  })

  it('URBANA: y en su sitio se dice QUÉ es la finca, que es lo que explica la ausencia', () => {
    // Ocultar sin decir por qué sería la trampa de siempre. La fila de la clase se
    // imprime literal, como el municipio: el servicio habla en mayúsculas.
    const l = porCampo(lineasEncabezado(encabezadoReal(), { procedencia: DESCRIPTIVOS_URBANA }))
    expect(l.clase.valor).toBe(CLASE_URBANA)
    expect(l.clase.consta).toBe(true)
    expect(l.clase.etiqueta).toBe(ROTULO_ENCABEZADO.clase)
  })

  it('EL DEFECTO, clavado: una urbana NUNCA dice «No se ha consultado» de esos tres campos', () => {
    // Era falso —`Consulta_DNPRC` sí se consultó y sí contestó— y además
    // despistaba. Se comprueba con y sin `procedencia`, porque la ocultación es
    // por CLASE y no por lo que haya pasado con la consulta.
    for (const opciones of [{}, { procedencia: DESCRIPTIVOS_URBANA }]) {
      for (const linea of lineasEncabezado(encabezadoReal(), opciones)) {
        expect(CAMPOS_SOLO_RUSTICA, `${linea.campo}: ${linea.valor}`).not.toContain(linea.campo)
      }
    }
  })

  it('RÚSTICA: exactamente como siempre, porque ahí los tres campos SON el identificador', () => {
    const l = porCampo(lineasEncabezado(encabezadoRustico(), { procedencia: DESCRIPTIVOS_RUSTICA }))
    expect(l.clase.valor).toBe(CLASE_RUSTICA)
    // Los valores salen del fixture real leído con el lector real, no de aquí.
    expect(l.paraje.valor).toBe(DESCRIPTIVOS_RUSTICA.datos.paraje)
    expect(l.poligono.valor).toBe(DESCRIPTIVOS_RUSTICA.datos.poligono)
    expect(l.parcela.valor).toBe(DESCRIPTIVOS_RUSTICA.datos.parcela)
    for (const campo of CAMPOS_SOLO_RUSTICA) expect(l[campo].consta, campo).toBe(true)
  })

  it('RÚSTICA sin paraje: las tres filas siguen saliendo, y con su sabor', () => {
    // Si a una rústica le falta el paraje, le falta DE VERDAD: ahí «No consta» es
    // la palabra exacta y la fila tiene que estar para poder decirlo.
    const sobre = {
      ok: true,
      datos: { ...DESCRIPTIVOS_RUSTICA.datos, paraje: null },
    }
    const l = porCampo(
      lineasEncabezado(componerEncabezado({ descriptivos: sobre, fecha: FECHA }), {
        procedencia: sobre,
      }),
    )
    expect(l.paraje.valor).toBe(NO_CONSTA)
    expect(l.paraje.consta).toBe(false)
  })

  it('CLASE `null`: no se adivina. Se emiten las tres y se declara lo que se sabe', () => {
    // Es el comportamiento prudente y el que ya había. Con la clase sin determinar,
    // afirmar que el polígono no aplica sería afirmar que la finca es urbana, y eso
    // no lo sabe nadie.
    const e = componerEncabezado({ descriptivos: DESCRIPTIVOS_SIN_CLASE, fecha: FECHA })
    expect(e.clase).toBeNull()

    const consultado = porCampo(lineasEncabezado(e, { procedencia: DESCRIPTIVOS_SIN_CLASE }))
    const aSecas = porCampo(lineasEncabezado(e))
    for (const campo of CAMPOS_SOLO_RUSTICA) {
      expect(consultado[campo].valor, campo).toBe(NO_CONSTA)
      expect(aSecas[campo].valor, campo).toBe(NO_CONSULTADO)
    }
    // Y la propia clase se declara, en vez de callarse: es un dato del servicio
    // como los demás y lleva los mismos sabores.
    expect(consultado.clase.valor).toBe(NO_CONSTA)
    expect(aSecas.clase.valor).toBe(NO_CONSULTADO)
  })

  it('un encabezado SIN la clave `clase` se imprime como se imprimía: no revienta', () => {
    // `clase` y `domicilio` llegaron después. Un encabezado escrito a mano con los
    // nueve campos de antes tiene que seguir valiendo — la ampliación es aditiva.
    const antiguo = {
      municipio: 'MADRID',
      provincia: 'MADRID',
      paraje: null,
      poligono: null,
      parcela: null,
      refcat: REF,
      srs: 'EPSG:25830',
      fecha: FECHA,
      idDocumento: 'EXP-2026-0007',
    }
    const l = porCampo(lineasEncabezado(antiguo))
    for (const campo of CAMPOS_SOLO_RUSTICA) expect(l[campo].valor, campo).toBe(NO_CONSULTADO)
  })

  it('LA INVARIANTE: una fila solo se oculta si NO tiene dato', () => {
    // Antes que creerle a la clasificación, se le cree al dato. Si a una urbana le
    // llegara un polígono —no debería—, el polígono se imprime: perder un dato en
    // silencio es lo que este repo persigue, y una ocultación por regla es una
    // forma barata de acabar haciéndolo.
    const raro = {
      ok: true,
      datos: { ...DESCRIPTIVOS_URBANA.datos, poligono: '109' },
    }
    const l = porCampo(
      lineasEncabezado(componerEncabezado({ descriptivos: raro, fecha: FECHA }), {
        procedencia: raro,
      }),
    )
    expect(l.poligono.valor).toBe('109')
    expect(l.poligono.consta).toBe(true)
    // Los otros dos, que siguen sin dato, siguen sin salir.
    expect(l.paraje).toBeUndefined()
    expect(l.parcela).toBeUndefined()
  })

  it('el ENCABEZADO conserva las once claves aunque se impriman menos líneas', () => {
    // El contrato D no cambia de forma según la finca: lo que cambia es lo que se
    // imprime. Quien quiera el dato crudo lo tiene, se pinte o no.
    const e = encabezadoReal()
    expect(Object.keys(e)).toEqual([...CAMPOS_ENCABEZADO])
    expect(e.paraje).toBeNull()
    expect(lineasEncabezado(e).length).toBeLessThan(CAMPOS_ENCABEZADO.length)
    expect(lineasEncabezado(encabezadoRustico()).length).toBe(CAMPOS_ENCABEZADO.length)
  })

  it('una clase que NO es del contrato E lanza, nombrando las dos que sí', () => {
    // Ni se imprime una palabra que nadie ha escrito, ni se decide con ella qué
    // filas aplican. `null` es la forma prevista de decir «no se sabe» y no lanza.
    const con = (clase) =>
      componerEncabezado({ descriptivos: { ok: true, datos: { clase } }, fecha: FECHA })
    expect(() => con('SOLAR')).toThrow(TypeError)
    expect(() => con('SOLAR')).toThrow(/URBANA/)
    expect(() => con('SOLAR')).toThrow(/RUSTICA/)
    expect(() => con('UR')).toThrow(TypeError) // el código del servicio, ya traducido en `services/`
    expect(() => con(7)).toThrow(TypeError)
    expect(() => con(null)).not.toThrow()
    expect(() => con(undefined)).not.toThrow()
    // Y la caja no manda: es un código de un vocabulario cerrado, no un texto.
    expect(con('  urbana ').clase).toBe(CLASE_URBANA)
  })
})

describe('report/firma · procedenciaDescriptivos', () => {
  it('null es «no se ha consultado», y no un sobre vacío', () => {
    expect(procedenciaDescriptivos(null)).toEqual({
      consultado: false,
      ok: false,
      motivo: null,
      mensaje: null,
    })
  })

  it('un sobre con datos es consultado y ok', () => {
    expect(procedenciaDescriptivos(DESCRIPTIVOS_URBANA)).toEqual({
      consultado: true,
      ok: true,
      motivo: null,
      mensaje: null,
    })
  })

  it('un sobre sin datos arrastra el motivo y el mensaje que redactó `services/`', () => {
    expect(procedenciaDescriptivos(DESCRIPTIVOS_FALLIDOS)).toEqual({
      consultado: true,
      ok: false,
      motivo: 'ESTADO_HTTP',
      mensaje: DESCRIPTIVOS_FALLIDOS.mensaje,
    })
  })

  it('se le cree al DATO y no a la bandera: `ok: true` con `datos: null` no es ok', () => {
    expect(procedenciaDescriptivos({ ok: true, datos: null }).ok).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · El identificador del documento
// ═════════════════════════════════════════════════════════════════════════════

describe('report/firma · componerIdDocumento', () => {
  it('tiene la forma `CG-<refcat>-<AAAAMMDD>-<hhmmss>Z`, exacta', () => {
    expect(componerIdDocumento(REF, FECHA)).toBe(`CG-${REF}-20260802-170453Z`)
  })

  it('sin referencia catastral, se ve que no la hay: no queda un hueco', () => {
    expect(componerIdDocumento(null, FECHA)).toBe(`CG-${SIN_REFCAT}-20260802-170453Z`)
    expect(componerIdDocumento('', FECHA)).toBe(`CG-${SIN_REFCAT}-20260802-170453Z`)
    expect(componerIdDocumento('  --  ', FECHA)).toBe(`CG-${SIN_REFCAT}-20260802-170453Z`)
  })

  it('canonicaliza la referencia: mayúsculas y solo letras y dígitos', () => {
    // En el ENCABEZADO la referencia se imprime tal cual; aquí es una matrícula y
    // tiene que tener forma fija, o `esIdDocumento` no podría reconocerla.
    expect(componerIdDocumento(' 9398516 vk3799g ', FECHA)).toBe(`CG-${REF}-20260802-170453Z`)
  })

  it('es UTC por componentes: el mismo instante da SIEMPRE el mismo identificador', () => {
    // Un informe descargado es un snapshot. Si esto dependiera de la zona horaria
    // del equipo, dos copias del mismo documento llevarían matrículas distintas.
    const otra = new Date(FECHA.getTime())
    expect(componerIdDocumento(REF, otra)).toBe(componerIdDocumento(REF, FECHA))
    // Y la `Z` final dice que la hora es UTC (ISO 8601), no la del reloj de nadie.
    expect(componerIdDocumento(REF, FECHA).endsWith('Z')).toBe(true)
  })

  it('empieza por el prefijo del proyecto, que NO es un código de la Sede', () => {
    expect(componerIdDocumento(REF, FECHA).startsWith(`${PREFIJO_ID_DOCUMENTO}-`)).toBe(true)
  })

  it('esIdDocumento reconoce lo que compone, y no es vacuo', () => {
    expect(esIdDocumento(componerIdDocumento(REF, FECHA))).toBe(true)
    expect(esIdDocumento(componerIdDocumento(null, FECHA))).toBe(true)
    expect(esIdDocumento('')).toBe(false)
    expect(esIdDocumento(null)).toBe(false)
    expect(esIdDocumento('CG-9398516VK3799G-20260802-170453')).toBe(false) // sin Z
    expect(esIdDocumento('XX-9398516VK3799G-20260802-170453Z')).toBe(false) // otro prefijo
    expect(esIdDocumento('CG--20260802-170453Z')).toBe(false) // hueco
    expect(esIdDocumento('CG-9398516VK3799G-2026802-170453Z')).toBe(false) // fecha corta
  })

  it('la fecha entra por parámetro también aquí', () => {
    expect(() => componerIdDocumento(REF, null)).toThrow(TypeError)
    expect(() => componerIdDocumento(REF, new Date('vaya'))).toThrow(RangeError)
    expect(() => componerIdDocumento(7, FECHA)).toThrow(TypeError)
  })
})

describe('report/firma · el idDocumento reutiliza la clave que ya existe en el Expediente', () => {
  it('`metadatos.idDocumento` es la clave del modelo, y no se inventa otra', () => {
    // Derivado del modelo REAL, no comparado contra la cadena escrita a mano por
    // segunda vez: si mañana el modelo la renombrara, esto se pone rojo.
    const expediente = crearExpediente()
    expect(Object.keys(expediente.metadatos)).toContain('idDocumento')
    expect(CAMPOS_ENCABEZADO).toContain('idDocumento')
  })

  it('el `\'\'` con el que `crearExpediente` la deja por defecto NO se imprime «No consta»', () => {
    // Es la ÚNICA excepción a la regla dura, y está razonada en la cabecera del
    // módulo: el identificador no es un dato del mundo que podamos no tener, es la
    // matrícula que esta herramienta le pone al documento que está emitiendo.
    const expediente = crearExpediente()
    expect(expediente.metadatos.idDocumento).toBe('')
    const e = componerEncabezado({
      refcat: REF,
      fecha: FECHA,
      idDocumento: expediente.metadatos.idDocumento,
    })
    expect(e.idDocumento).toBe(`CG-${REF}-20260802-170453Z`)
    expect(porCampo(lineasEncabezado(e)).idDocumento.valor).not.toBe(NO_CONSTA)
  })

  it('si el expediente TRAE identificador, manda el suyo y se imprime literal', () => {
    const expediente = crearExpediente({ idDocumento: 'EXP-2026-0007' })
    const e = componerEncabezado({
      refcat: REF,
      fecha: FECHA,
      idDocumento: expediente.metadatos.idDocumento,
    })
    expect(e.idDocumento).toBe('EXP-2026-0007')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · Guardián del reloj (grep sobre el TEXTO fuente)
// ═════════════════════════════════════════════════════════════════════════════

describe('report/firma · no lee el reloj del sistema', () => {
  // Mismo guardián, con las mismas palabras, que `test/report/contraste-texto.test.js`
  // y `test/gml/contrato-gml.test.js`. El motivo es el mismo: un informe firmado es
  // un SNAPSHOT y tiene que valer lo mismo dentro de un año. Se mira el TEXTO
  // ENTERO del fuente, comentarios incluidos.
  const INSTANCIA_FECHA = /\bnew\s+Date\b/
  const RELOJ = /\bDate\s*\.\s*now\b/
  const FORMATO_LOCAL = /toLocale(Date|Time)?String\b/

  it('no instancia una fecha propia ni consulta la marca de tiempo', () => {
    expect(INSTANCIA_FECHA.test(FUENTE_MODULO), 'instancia una fecha propia').toBe(false)
    expect(RELOJ.test(FUENTE_MODULO), 'consulta el reloj del sistema').toBe(false)
  })

  it('no usa formateadores de fecha dependientes del entorno', () => {
    expect(FORMATO_LOCAL.test(FUENTE_MODULO)).toBe(false)
    expect(FUENTE_MODULO).toContain('getUTCFullYear')
  })

  it('los detectores no son vacuos', () => {
    expect(INSTANCIA_FECHA.test('const x = new Date()')).toBe(true)
    expect(RELOJ.test('const t = Date . now()')).toBe(true)
    expect(FORMATO_LOCAL.test('f.toLocaleDateString("es-ES")')).toBe(true)
    expect(INSTANCIA_FECHA.test('if (fecha instanceof Date) return')).toBe(false)
  })

  it('no importa NADA: es puro y no arrastra ni una dependencia', () => {
    expect(/^\s*import\s/m.test(FUENTE_MODULO)).toBe(false)
  })

  it('la fecha se rinde por componentes UTC, con la zona escrita', () => {
    expect(textoFecha(FECHA)).toBe('02/08/2026 17:04 (UTC)')
    expect(textoFecha(FECHA)).toBe(textoFecha(FECHA))
    expect(() => textoFecha('2026-08-02')).toThrow(TypeError)
  })

  it('la misma entrada produce la misma salida, dos veces seguidas', () => {
    expect(lineasEncabezado(encabezadoReal())).toEqual(lineasEncabezado(encabezadoReal()))
    expect(lineasFirma({ nombre: 'Alguien' })).toEqual(lineasFirma({ nombre: 'Alguien' }))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · Guardián de vocabulario: el bloque NO presupone titulación
// ═════════════════════════════════════════════════════════════════════════════

describe('report/firma · ni una palabra que presuponga titulación', () => {
  // ⚠️ Esto NO es una preferencia de redacción. `MEJORES_PRACTICAS_GML.md` §5.2:
  // topógrafos (COIGT), arquitectos (COA), aparejadores, ingenieros agrónomos y
  // geógrafos se disputan quién puede firmar qué, y la sentencia que se cita en
  // los foros para zanjarlo está degradada a Tier C en ese mismo documento (fuente
  // de parte interesada, no localizada en CENDOJ, y con doctrina contraria a la
  // que se le atribuye). Un rótulo que presuponga la titulación de quien firma
  // mete a esta herramienta —y a quien la use— en una disputa que no es suya.
  const PROHIBIDAS = Object.freeze([
    [/t[eé]cnic[oa]s?\b/i, 'presupone que quien firma es «técnico»'],
    [/competente/i, 'la fórmula «técnico competente» es justo lo que está en disputa'],
    [/arquitect/i, 'nombra una titulación'],
    [/aparejador/i, 'nombra una titulación'],
    [/ingenier/i, 'nombra una titulación'],
    [/agr[oó]nom/i, 'nombra una titulación'],
    [/top[oó]graf/i, 'nombra una titulación'],
    [/ge[oó]graf/i, 'nombra una titulación'],
    [/perit/i, 'nombra un perfil profesional concreto'],
    [/facultativ/i, 'nombra un perfil profesional concreto'],
    [/titulaci[oó]n|titulad[oa]/i, 'habla de la titulación de quien firma'],
    [/suscrib/i, 'la fórmula «el … que suscribe» arrastra siempre un sustantivo delante'],
  ])

  /** Los defectos de un texto, con el porqué de cada uno. */
  const defectosEn = (texto) =>
    PROHIBIDAS.filter(([re]) => re.test(texto)).map(([, porque]) => porque)

  /**
   * TODO lo que este módulo puede llegar a imprimir por su cuenta: los rótulos,
   * el título del bloque y los tres sustitutos. **No incluye los VALORES que
   * teclea el usuario**, y es deliberado: si alguien escribe su titulación en el
   * campo `colegio`, se imprime tal cual — es su documento. Lo que este módulo se
   * prohíbe es afirmarlo ÉL.
   */
  const VOCABULARIO_PROPIO = [
    TITULO_FIRMA,
    NO_CONSTA,
    NO_CONSULTADO,
    NO_SE_HA_PODIDO_CONSULTAR,
    ...Object.values(ROTULO_FIRMA),
    ...Object.values(ROTULO_ENCABEZADO),
    // Y lo que de verdad sale por la puerta, con todo en blanco: si alguien
    // añadiera un rótulo sin meterlo en las tablas, aparecería aquí.
    ...lineasFirma().flatMap((l) => [l.etiqueta, l.valor]),
    ...lineasEncabezado(componerEncabezado({ fecha: FECHA })).flatMap((l) => [
      l.etiqueta,
      l.valor,
    ]),
    ...lineasEncabezado(encabezadoReal(), { procedencia: DESCRIPTIVOS_URBANA }).flatMap((l) => [
      l.etiqueta,
      l.valor,
    ]),
  ]

  it('ninguna de las palabras que imprime el módulo presupone titulación', () => {
    for (const texto of VOCABULARIO_PROPIO) {
      expect(defectosEn(texto), `«${texto}»`).toEqual([])
    }
  })

  it('el bloque se titula «Firma» y no le pone nombre a quien firma', () => {
    expect(TITULO_FIRMA).toBe('Firma')
  })

  it('`colegio` es un campo LIBRE: no hay lista cerrada de la que elegir', () => {
    // Un desplegable sería una lista cerrada, y cerrarla es tomar partido. El
    // módulo no exporta ninguna lista de colegios ni de profesiones, y acepta
    // cualquier texto.
    expect(normalizarFirma({ colegio: 'Cualquier cosa que escriba' }).colegio).toBe(
      'Cualquier cosa que escriba',
    )
    expect(normalizarFirma({ colegio: 'Colegio de vaya usted a saber' }).colegio).not.toBeNull()
  })

  it('el detector NO es vacuo: caza las fórmulas que este proyecto ha descartado', () => {
    expect(defectosEn('El técnico competente que suscribe').length).toBeGreaterThan(0)
    expect(defectosEn('Arquitecto colegiado').length).toBeGreaterThan(0)
    expect(defectosEn('Ingeniero Técnico en Topografía').length).toBeGreaterThan(0)
    expect(defectosEn('Perito judicial').length).toBeGreaterThan(0)
    expect(defectosEn('Titulación del firmante').length).toBeGreaterThan(0)
    expect(defectosEn('Geógrafo').length).toBeGreaterThan(0)
  })

  it('y no es histérico: «Número de colegiado» y «Colegio profesional» pasan', () => {
    // Estar colegiado no dice de QUÉ se está colegiado, y es el vocabulario de la
    // propia spec (`spec/feature-09-informe-parcela.md:21`). Si esto se pusiera
    // rojo, el guardián estaría prohibiendo el contrato.
    expect(defectosEn('Número de colegiado')).toEqual([])
    expect(defectosEn('Colegio profesional')).toEqual([])
    expect(defectosEn('Nombre y apellidos')).toEqual([])
  })
})
