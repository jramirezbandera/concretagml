import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ERRORES_IVG,
  PROCEDENCIA,
  VALIDADOR,
  MOTIVO,
  NOTA,
  buscar,
  normalizar,
} from '../../config/errores-ivg.js'

// F15 · El diccionario de errores de la Sede. Tres cosas se vigilan aquí, y la
// tercera es la que de verdad justifica el fichero:
//
//   1. Los tres criterios de aceptación de `spec/feature-15-…md`.
//   2. Que el cargador sea el ÚNICO lector del JSON (molde de `operativos.test.js`).
//   3. ⛔ Que NADIE vuelva a meter en el diccionario las tres afirmaciones del
//      catálogo del dossier §1.5 que este proyecto refutó midiendo. Es el riesgo
//      real de esta pieza: la próxima persona que la amplíe va a tener delante la
//      misma lista de trece errores de la que salieron, y «completar el
//      diccionario con las semillas que faltan» es exactamente el gesto que
//      volvería a meter la entrada invertida.

const RAIZ = fileURLToPath(new URL('../..', import.meta.url))
const leer = (rel) => readFileSync(join(RAIZ, rel), 'utf8')

describe('config/errores-ivg.js · cargador único y congelado', () => {
  it('solo `config/errores-ivg.js` lee el JSON; el resto del proyecto lee el módulo', () => {
    // Verdad-terreno sobre disco, igual que con `operativos.json`: un segundo
    // lector es una segunda copia del diccionario esperando a divergir, y aquí
    // divergir significa enseñar al usuario una corrección distinta de la que
    // está en el repositorio.
    const SALTA = new Set(['node_modules', 'dist', '.git', '.gstack', '.claude'])
    const IMPORTA_JSON =
      /(?:^|\n)[ \t]*import[^\n]*['"][^'"]*errores-ivg\.json['"]|import\([ \t]*['"][^'"]*errores-ivg\.json['"]/
    const fuentes = []
    const pila = ['']
    while (pila.length > 0) {
      const rel = pila.pop()
      for (const e of readdirSync(join(RAIZ, rel), { withFileTypes: true })) {
        const hijo = rel === '' ? e.name : `${rel}/${e.name}`
        if (e.isDirectory()) {
          if (!SALTA.has(e.name)) pila.push(hijo)
        } else if (e.isFile() && /\.(?:js|mjs)$/.test(hijo)) {
          fuentes.push(hijo)
        }
      }
    }
    const lectores = fuentes.filter((f) => IMPORTA_JSON.test(leer(f))).sort()
    expect(
      lectores,
      'el diccionario solo debe cargarlo config/errores-ivg.js: importa `ERRORES_IVG` del módulo.',
    ).toEqual(['config/errores-ivg.js'])
    expect(fuentes.length, 'el recorrido de fuentes no ha encontrado nada que mirar').toBeGreaterThan(0)
  })

  it('está CONGELADO: nadie puede reescribir una corrección en caliente', () => {
    expect(Object.isFrozen(ERRORES_IVG)).toBe(true)
    for (const e of ERRORES_IVG) {
      expect(Object.isFrozen(e), `la entrada «${e.clave}» no está congelada`).toBe(true)
      expect(Object.isFrozen(e.mensajes), `los mensajes de «${e.clave}» no están congelados`).toBe(true)
    }
    expect(() => {
      ERRORES_IVG[0].comoCorregir = 'lo que sea'
    }).toThrow(TypeError)
  })

  it('expone todas las entradas del JSON y ninguna clave de servicio', () => {
    // Se lee con `readFileSync` y no con `import` para no convertir a este test
    // en un segundo lector, que dejaría mentir a la guarda de arriba.
    const crudo = JSON.parse(leer('config/errores-ivg.json'))
    const esperadas = Object.keys(crudo).filter((k) => !k.startsWith('_'))
    expect(ERRORES_IVG.map((e) => e.clave)).toEqual(esperadas)
    expect(NOTA).toBe(crudo._nota)
    expect(ERRORES_IVG.some((e) => e.clave.startsWith('_'))).toBe(false)
  })
})

describe('config/errores-ivg.json · criterio 2 · estructura fijada', () => {
  const CAMPOS_DE_LA_FICHA = ['traduccion', 'causaProbable', 'comoCorregir', 'fecha']

  it('cada entrada trae los cuatro campos que fija la ficha, con texto de verdad', () => {
    for (const e of ERRORES_IVG) {
      for (const campo of CAMPOS_DE_LA_FICHA) {
        expect(typeof e[campo], `«${e.clave}» · ${campo}`).toBe('string')
        expect(e[campo].trim().length, `«${e.clave}» · ${campo} está vacío`).toBeGreaterThan(0)
      }
    }
  })

  it('cada entrada declara validador y procedencia de los léxicos, y una fecha AAAA-MM-DD', () => {
    for (const e of ERRORES_IVG) {
      expect(Object.values(VALIDADOR), `«${e.clave}» · validador`).toContain(e.validador)
      expect(Object.values(PROCEDENCIA), `«${e.clave}» · procedencia`).toContain(e.procedencia)
      expect(e.fecha, `«${e.clave}» · fecha`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Array.isArray(e.mensajes), `«${e.clave}» · mensajes`).toBe(true)
      expect(typeof e.verMas, `«${e.clave}» · verMas`).toBe('string')
    }
  })

  it('admite entradas nuevas SIN tocar código: el cargador no conoce ninguna clave', () => {
    // El criterio 2 dice «admite entradas nuevas sin cambio de código». La forma
    // de probarlo no es leer el cargador, es buscar sobre una entrada que no
    // existe en el fichero: si `buscar` la encuentra, es que no hay ni una clave
    // cableada en ningún sitio.
    const inventada = {
      clave: 'ejemplo inventado por el test',
      traduccion: 'x',
      causaProbable: 'x',
      comoCorregir: 'x',
      fecha: '2026-08-11',
      validador: VALIDADOR.IVG,
      procedencia: PROCEDENCIA.OBSERVADO,
      mensajes: ['un mensaje que la Sede nunca ha devuelto'],
      verMas: '',
    }
    const r = buscar('un mensaje que la Sede nunca ha devuelto', { entradas: [inventada] })
    expect(r).toHaveLength(1)
    expect(r[0].entrada.clave).toBe('ejemplo inventado por el test')
    expect(r[0].motivo).toBe(MOTIVO.MENSAJE)
  })

  it('no hay claves repetidas ni claves que sean prefijo trivial de otra', () => {
    const claves = ERRORES_IVG.map((e) => e.clave)
    expect(new Set(claves).size).toBe(claves.length)
  })
})

describe('config/errores-ivg.js · criterio 1 · buscar un fragmento devuelve su entrada', () => {
  it('el mensaje LITERAL del rechazo del IVG (2026-07-27) saca su causa la PRIMERA', () => {
    const r = buscar('El archivo no cumple el esquema Inspire GML')
    expect(r.length).toBeGreaterThan(0)
    expect(r[0].entrada.clave).toBe('wfs:FeatureCollection en la raíz')
    expect(r[0].motivo).toBe(MOTIVO.MENSAJE)
    expect(r[0].entrada.traduccion).toBeTruthy()
    expect(r[0].entrada.causaProbable).toBeTruthy()
    expect(r[0].entrada.comoCorregir).toBeTruthy()
  })

  it('el mensaje LITERAL del rechazo del ICUC (2026-08-06) saca su causa la PRIMERA', () => {
    const r = buscar(
      'Los siguientes ficheros no se han cargado al no ser válidos: - edificio_9398516VK3799G_2026-08-06T21-19-34.gml',
    )
    expect(r.length).toBeGreaterThan(0)
    expect(r[0].entrada.clave).toBe('falta xmlns:xlink en la raíz')
    expect(r[0].motivo).toBe(MOTIVO.MENSAJE)
  })

  it('la salida técnica de libxml2 también encuentra su entrada', () => {
    const r = buscar(
      "Element '{http://www.opengis.net/wfs/2.0}FeatureCollection': No matching global declaration available for the validation root.",
    )
    expect(r[0].entrada.clave).toBe('wfs:FeatureCollection en la raíz')
  })

  it('la errata del PDF oficial se encuentra pegando solo la palabra', () => {
    const r = buscar('funtional')
    expect(r[0].entrada.clave).toBe('funtional')
    expect(r[0].entrada.comoCorregir).toContain('functional')
  })

  it('busca sin tildes y sin importar mayúsculas', () => {
    expect(buscar('ORIENTACION')[0].entrada.clave).toBe('orientación de los anillos')
    expect(buscar('orientación')[0].entrada.clave).toBe('orientación de los anillos')
  })

  it('la consulta vacía devuelve el diccionario ENTERO en el orden del fichero', () => {
    // Decisión 6 de la entrevista: la pantalla abre con todo puesto. Un mensaje
    // genérico —y los dos reales lo son— no puede dejar al técnico ante un vacío.
    for (const vacia of ['', '   ', '\n\t ']) {
      const r = buscar(vacia)
      expect(r).toHaveLength(ERRORES_IVG.length)
      expect(r.map((x) => x.entrada.clave)).toEqual(ERRORES_IVG.map((e) => e.clave))
    }
  })

  it('cuando nada casa devuelve lista vacía, y eso es una respuesta legítima', () => {
    // ⚠️ La consulta tiene que ser de verdad ajena al diccionario. La primera
    // redacción de este test decía «zzzqqq no existe en ninguna parte» y salía
    // ROJO con razón: «existe», «ninguna» y «parte» son palabras que la prosa de
    // las entradas usa, así que casaban a puntuación 1. El fallo estaba en el
    // test, no en la búsqueda — pero deja escrito el comportamiento real: un
    // mensaje largo pegado casa flojo con muchas entradas, y lo que separa el
    // grano de la paja NO es un umbral sino el `motivo`, que la pantalla enseña.
    expect(buscar('zzzqqq wwwxxx yyyvvv')).toEqual([])
  })

  it('las palabras vacías del español no hacen casar a todo el diccionario', () => {
    // Sin la lista de vacías, «de la que se ha» casaría con las 23 entradas y el
    // orden por puntuación dejaría de significar nada.
    expect(buscar('de la que se ha por con para')).toEqual([])
  })

  it('el filtro por validador respeta las entradas que valen para los dos', () => {
    const icuc = buscar('', { validador: VALIDADOR.ICUC })
    expect(icuc.length).toBeGreaterThan(0)
    expect(icuc.length).toBeLessThan(ERRORES_IVG.length)
    for (const { entrada } of icuc) {
      expect([VALIDADOR.ICUC, VALIDADOR.AMBOS]).toContain(entrada.validador)
    }
    // Sin filtro, y con `AMBOS`, se ve todo.
    expect(buscar('').length).toBe(ERRORES_IVG.length)
    expect(buscar('', { validador: VALIDADOR.AMBOS }).length).toBe(ERRORES_IVG.length)
  })

  it('un casamiento por mensaje literal siempre puntúa por encima de uno por palabras', () => {
    const r = buscar('El archivo no cumple el esquema Inspire GML')
    const porMensaje = r.filter((x) => x.motivo === MOTIVO.MENSAJE)
    const porTexto = r.filter((x) => x.motivo === MOTIVO.TEXTO)
    expect(porMensaje.length).toBeGreaterThan(0)
    for (const m of porMensaje) {
      for (const t of porTexto) expect(m.puntuacion).toBeGreaterThan(t.puntuacion)
    }
  })

  it('`normalizar` conserva los dos puntos de los nombres cualificados', () => {
    // Si partiera por el `:`, «gml» casaría con media docena de entradas que no
    // vienen a cuento y `wfs:FeatureCollection` dejaría de ser una clave útil.
    expect(normalizar('wfs:FeatureCollection')).toBe('wfs:featurecollection')
    expect(normalizar('  Anillo   NO cerrado ')).toBe('anillo no cerrado')
  })
})

describe('config/errores-ivg.json · criterio 3 · las semillas de §1.5 están cargadas', () => {
  // Las trece del catálogo del dossier, cada una con un fragmento que tiene que
  // encontrarse. No se comprueba por clave literal —eso ataría el test a la
  // redacción— sino porque BUSCARLA la encuentre, que es lo que el criterio 1
  // promete al usuario.
  const SEMILLAS = [
    ['1 · gml:FeatureCollection en parcela', 'gml:FeatureCollection en parcela'],
    ['2 · srsName', 'srsName'],
    ['3 · orientación', 'orientación'],
    ['4 · gml:id por dígito', 'dígito'],
    ['5 · anillo no cerrado o <4 puntos', 'anillo no cerrado'],
    ['6 · referencePoint fuera del polígono', 'referencePoint'],
    ['7 · encoding', 'encoding'],
    ['8 · base: en el inspireId', 'inspireId'],
    ['9 · boundedBy/zoning', 'boundedBy'],
    ['10 · MultiPolygon', 'MultiPolygon'],
    ['11 · voladizos y terrazas', 'voladizos'],
    ['12a · solapes entre recintos', 'solapes'],
    ['12b · construcción a más de 100 m', '100 m'],
    ['13 · funtional', 'funtional'],
  ]

  it.each(SEMILLAS)('la semilla %s se encuentra buscándola', (_nombre, fragmento) => {
    const r = buscar(fragmento)
    expect(r.length, `«${fragmento}» no encuentra ninguna entrada`).toBeGreaterThan(0)
  })

  it('el diccionario cubre los dos trámites, no solo el que le da nombre al fichero', () => {
    const validadores = new Set(ERRORES_IVG.map((e) => e.validador))
    expect(validadores.has(VALIDADOR.IVG)).toBe(true)
    expect(validadores.has(VALIDADOR.ICUC)).toBe(true)
    expect(validadores.has(VALIDADOR.AMBOS)).toBe(true)
  })

  it('la mayor parte de lo que dice está MEDIDO contra el servicio real', () => {
    // No es una métrica de vanidad: es lo que separa este diccionario de los que
    // circulan copiados. Si baja de aquí, alguien ha estado engordándolo con
    // material sin comprobar y hay que mirarlo.
    const medidas = ERRORES_IVG.filter((e) => e.procedencia === PROCEDENCIA.MEDIDO)
    expect(medidas.length).toBeGreaterThanOrEqual(10)
    for (const e of medidas) {
      expect(e.verMas, `la entrada MEDIDA «${e.clave}» no dice dónde está su medición`).not.toBe('')
    }
  })
})

describe('⛔ config/errores-ivg.json · lo que este proyecto REFUTÓ midiendo no vuelve', () => {
  // Estos cuatro tests son el motivo por el que el fichero de pruebas existe.
  // Cada uno defiende una medición concreta contra el gesto de «completar el
  // diccionario» copiando otra vez el catálogo del dossier.

  const porClave = (clave) => ERRORES_IVG.find((e) => e.clave === clave)

  it('`gml:FeatureCollection` en parcela NO figura como causa de rechazo (§1.5 nº 1 está INVERTIDA)', () => {
    const e = porClave('gml:FeatureCollection en parcela')
    expect(e, 'falta la entrada que enmienda la semilla nº 1').toBeTruthy()
    expect(e.correccion, 'la entrada tiene que declarar qué catálogo enmienda').toBeTruthy()
    // Es la raíz de la ENTREGA: la que trae la plantilla oficial y la que la Sede
    // aceptó. Que el texto lo diga en positivo es la mitad del valor de la entrada.
    expect(e.traduccion).toMatch(/NO ES UN ERROR/i)
    expect(e.comoCorregir).toMatch(/wfs:FeatureCollection/)
  })

  it('la plantilla oficial del Catastro sigue teniendo esa raíz (verdad-terreno, no memoria)', () => {
    // Sin esto, la entrada de arriba sería una afirmación mía. Con esto, es una
    // afirmación del fichero que publica la D.G. del Catastro y que está en el repo.
    const plantilla = leer('test/fixtures/gml/cp_ejemplo_explicativo.gml')
    expect(plantilla).toContain('<gml:FeatureCollection')
    expect(plantilla).toContain('<gml:featureMember>')
    expect(plantilla).toContain('http://inspire.ec.europa.eu/schemas/cp/4.0')
  })

  it('la orientación de anillos NO figura como causa de rechazo (§1.5 nº 3, override O1)', () => {
    const e = porClave('orientación de los anillos')
    expect(e, 'falta la entrada que enmienda la semilla nº 3').toBeTruthy()
    expect(e.correccion).toBeTruthy()
    expect(e.traduccion).toMatch(/NO ES CAUSA DE RECHAZO/i)
    expect(e.procedencia).toBe(PROCEDENCIA.MEDIDO)
    // Y que no se cuele por otra puerta: ninguna entrada puede decir que hay que
    // corregir la orientación para que la Sede acepte.
    for (const otra of ERRORES_IVG) {
      if (otra.clave === e.clave) continue
      expect(
        /orientaci[oó]n/i.test(otra.comoCorregir) && /rechaz/i.test(otra.comoCorregir),
        `la entrada «${otra.clave}» vuelve a vender la orientación como causa de rechazo`,
      ).toBe(false)
    }
  })

  it('el prefijo `base:` NO figura como el culpable del inspireId (§1.5 nº 8, override O4)', () => {
    const e = porClave('base: en el inspireId')
    expect(e, 'falta la entrada que matiza la semilla nº 8').toBeTruthy()
    expect(e.correccion).toBeTruthy()
    // Lo que manda es el namespace, y la corrección tiene que decir el número.
    expect(e.comoCorregir).toMatch(/3\.3/)
  })

  it('las entradas que enmiendan un catálogo ajeno dicen A CUÁL y son exactamente tres', () => {
    const enmiendas = ERRORES_IVG.filter((e) => e.correccion)
    expect(enmiendas.map((e) => e.clave).sort()).toEqual(
      ['base: en el inspireId', 'gml:FeatureCollection en parcela', 'orientación de los anillos'].sort(),
    )
    for (const e of enmiendas) {
      expect(e.correccion, `«${e.clave}» no nombra el catálogo que enmienda`).toMatch(/§1\.5/)
    }
  })
})

describe('config/errores-ivg.json · atado a lo que el repositorio tiene escrito', () => {
  // Los mensajes literales son el mecanismo por el que «pegar el rechazo»
  // funciona. Si alguien los reescribe de memoria, la pantalla deja de casar el
  // mensaje real y NADIE se entera: la búsqueda seguiría dando resultados por
  // palabras sueltas. Por eso se atan al sitio del repositorio donde consta lo
  // que la Sede devolvió de verdad.

  it('el mensaje del IVG que trae la entrada es el que consta en `spec/SPEC.md` §3.1', () => {
    const e = ERRORES_IVG.find((x) => x.clave === 'wfs:FeatureCollection en la raíz')
    const spec = leer('spec/SPEC.md')
    expect(e.mensajes.length).toBeGreaterThan(0)
    expect(spec).toContain(e.mensajes[0])
    expect(spec).toContain('No matching global declaration available for the validation root')
  })

  it('el mensaje del ICUC que trae la entrada es el que consta en la ficha de F13', () => {
    const e = ERRORES_IVG.find((x) => x.clave === 'falta xmlns:xlink en la raíz')
    const ficha = leer('spec/feature-13-edificio-gml.md')
    expect(e.mensajes.length).toBeGreaterThan(0)
    expect(ficha).toContain(e.mensajes[0])
  })

  it('la corrección del `xmlns:xlink` es literalmente la que emite el serializador', () => {
    const e = ERRORES_IVG.find((x) => x.clave === 'falta xmlns:xlink en la raíz')
    expect(e.comoCorregir).toContain('http://www.w3.org/1999/xlink')
    expect(leer('gml/serialize-bu.js') + leer('gml/_comun.js')).toContain(
      'http://www.w3.org/1999/xlink',
    )
  })

  it('el orden de `cp:CadastralParcel` que dicta la entrada es el que emite `gml/`', () => {
    const e = ERRORES_IVG.find((x) => x.clave === 'orden de los elementos de cp:CadastralParcel')
    const comun = leer('gml/_comun.js')
    const orden = [
      'areaValue',
      'beginLifespanVersion',
      'endLifespanVersion',
      'geometry',
      'inspireId',
      'label',
      'nationalCadastralReference',
      'referencePoint',
    ]
    for (const campo of orden) {
      expect(e.comoCorregir, `la entrada no nombra ${campo}`).toContain(campo)
    }
    // Y que el módulo siga teniendo esa constante: si se renombrara, la entrada
    // apuntaría a un sitio que ya no existe.
    expect(comun).toContain('ORDEN_CADASTRAL_PARCEL')
  })
})
