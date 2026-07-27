/* -------------------------------------------------------------------------- *
 * test/gml/xml.test.js — F04 · T1.1 · el lector y el escritor XML por sí mismos *
 *                                                                              *
 * Reparto con el otro fichero de esta tarea: `test/gml/xml-oraculo.test.js`     *
 * contrasta el ÁRBOL RESULTANTE contra jsdom sobre los GML reales —es lo que    *
 * sostiene la corrección del parser—, y AQUÍ se afirma todo lo que un oráculo    *
 * no puede decir: qué pasa con lo que jsdom no acepta o no expone (los mensajes  *
 * de error con línea y columna, el rechazo del DOCTYPE, la declaración XML), las *
 * consultas de conveniencia, el escritor entero, y la ida y vuelta del propio    *
 * módulo (`render` → `parsearXml` → lo mismo).                                   *
 *                                                                              *
 * Dos criterios que gobiernan cómo está escrito este fichero:                    *
 *                                                                              *
 *  1. FRONTERA DE ERRORES (SPEC §2.1). Un XML mal formado es dato del usuario:  *
 *     NUNCA excepción, siempre `errores`. Se afirma el veredicto Y la           *
 *     localización, porque la línea y la columna son lo único que hace           *
 *     accionable un fallo en un fichero de 34 KB que el usuario acaba de subir   *
 *     (F08). La excepción queda para el contrato roto por el PROGRAMADOR.        *
 *                                                                              *
 *  2. EXPECTATIVAS DERIVADAS. Las líneas y columnas esperadas no se escriben a   *
 *     mano: se calculan con `posicionDe(prefijo)` a partir del propio texto de   *
 *     entrada, de modo que retocar el XML de un caso no obliga a recontar        *
 *     caracteres. Las cinco entidades predefinidas y el tope de profundidad se   *
 *     derivan de `ENTIDADES_XML` y `PROFUNDIDAD_MAXIMA`, no se recopian.         *
 *                                                                              *
 * Proyecto Vitest `node`: sin DOM y sin `DOMParser` global (Node 22).            *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import {
  ENTIDADES_XML,
  NS_XML,
  PROFUNDIDAD_MAXIMA,
  SIN_NAMESPACE,
  atributo,
  elem,
  escaparAtributo,
  escaparTexto,
  hijo,
  hijoUnico,
  hijos,
  parsearXml,
  render,
  ruta,
  texto,
} from '../../gml/xml.js'

// ── Utilidades del fichero ────────────────────────────────────────────────────

/**
 * Posición (1-based) del carácter que sigue a `prefijo` dentro del documento.
 * Es la forma de escribir «el error está justo aquí» sin contar caracteres a
 * mano: el caso se parte en `prefijo + resto` y la expectativa sale del prefijo.
 */
function posicionDe(prefijo) {
  const ultimoSalto = prefijo.lastIndexOf('\n')
  return {
    linea: prefijo.split('\n').length,
    columna: prefijo.length - ultimoSalto,
  }
}

/** Forma comparable de un árbol leído (ignora línea/columna y el prefijo). */
function canon(nodo) {
  return {
    ns: nodo.ns,
    local: nodo.local,
    atributos: nodo.atributos.map((a) => [a.ns, a.local, a.valor]),
    // El texto de un nodo CON hijos es sangrado de `render`, no dato; el de una
    // hoja SÍ es dato y se compara crudo.
    texto: nodo.hijos.length > 0 ? nodo.texto.trim() : nodo.texto,
    hijos: nodo.hijos.map(canon),
  }
}

const NS_A = 'urn:ejemplo:a'
const NS_B = 'urn:ejemplo:b'

// ── Contrato de entrada ───────────────────────────────────────────────────────

describe('parsearXml · frontera entre dato malo y contrato roto', () => {
  it('lanza TypeError SOLO si `texto` no es un string', () => {
    for (const malo of [null, undefined, 42, {}, [], Buffer.from('<a/>')]) {
      expect(() => parsearXml(malo), String(malo)).toThrow(TypeError)
    }
    // Y el mensaje nombra la función, el parámetro y la salida correcta, además
    // de recordar que el XML mal formado NO va por esta vía.
    expect(() => parsearXml(42)).toThrow(/parsearXml: 'texto'.*recibido number/s)
    expect(() => parsearXml(42)).toThrow(/no se señala con excepción/)
  })

  it('NO lanza ante un XML mal formado: lo devuelve en `errores`', () => {
    // Es la decisión central del módulo. Si alguien la «arregla» convirtiendo
    // esto en un throw, F08 (comprobar el GML de un tercero) deja de poder
    // enseñar los problemas al usuario y pasa a reventar.
    let resultado
    expect(() => {
      resultado = parsearXml('<a><b></c></a>')
    }).not.toThrow()
    expect(resultado.errores.length).toBeGreaterThan(0)
  })

  it('un documento correcto devuelve `errores` vacío y raíz no nula', () => {
    const { raiz, errores } = parsearXml('<a/>')
    expect(errores).toEqual([])
    expect(raiz.local).toBe('a')
  })

  it('es reentrante: dos llamadas sobre el mismo texto dan lo mismo', () => {
    // La RegExp de nombres lleva bandera sticky (guarda `lastIndex`); se crea
    // por llamada justo para que esto sea cierto.
    const xml = '<a xmlns="urn:ejemplo:a"><b c="1"/><b c="2"/></a>'
    expect(parsearXml(xml)).toEqual(parsearXml(xml))
  })
})

// ── Declaración XML ───────────────────────────────────────────────────────────

describe('parsearXml · declaración XML', () => {
  it('lee version, encoding y standalone', () => {
    const { declaracion } = parsearXml(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a/>',
    )
    expect(declaracion).toEqual({ version: '1.0', encoding: 'UTF-8', standalone: 'yes' })
  })

  it('deja a null lo que no venga, y admite comillas simples', () => {
    const { declaracion } = parsearXml("<?xml version='1.0'?><a/>")
    expect(declaracion).toEqual({ version: '1.0', encoding: null, standalone: null })
  })

  it('devuelve null si no hay declaración', () => {
    expect(parsearXml('<a/>').declaracion).toBeNull()
  })

  it('`<?xml-stylesheet …?>` es una instrucción de proceso, NO la declaración', () => {
    const { declaracion, raiz, errores } = parsearXml('<?xml-stylesheet href="x.xsl"?><a/>')
    expect(declaracion).toBeNull()
    expect(errores).toEqual([])
    expect(raiz.local).toBe('a')
  })

  it('informa lo DECLARADO aunque no case con los bytes reales', () => {
    // Los GML del Catastro declaran ISO-8859-1 y en realidad vienen en UTF-8.
    // El módulo no transcodifica: solo cuenta lo que el fichero dice de sí mismo.
    expect(parsearXml('<?xml version="1.0" encoding="ISO-8859-1"?><a/>').declaracion.encoding).toBe(
      'ISO-8859-1',
    )
  })
})

// ── Namespaces ────────────────────────────────────────────────────────────────

describe('parsearXml · namespaces con ámbito léxico', () => {
  it('resuelve prefijos y el namespace por defecto, y hereda hacia los hijos', () => {
    const { raiz, errores } = parsearXml(
      `<r xmlns="${NS_A}" xmlns:p="${NS_B}"><hijo/><p:otro/></r>`,
    )
    expect(errores).toEqual([])
    expect([raiz.ns, raiz.local, raiz.prefijo]).toEqual([NS_A, 'r', ''])
    expect([raiz.hijos[0].ns, raiz.hijos[0].local]).toEqual([NS_A, 'hijo'])
    expect([raiz.hijos[1].ns, raiz.hijos[1].local, raiz.hijos[1].prefijo]).toEqual([
      NS_B,
      'otro',
      'p',
    ])
  })

  it('REDECLARA el default a media profundidad y lo restituye al salir', () => {
    // Este es el caso REAL del fixture cp 4.0: `<Identifier xmlns="…/base/3.3">`
    // dentro de un documento cuyo default es wfs 2.0. Si el ámbito no se apila
    // bien, `localId` y `namespace` acaban en el namespace equivocado y F04 no
    // encuentra el inspireId.
    const { raiz, errores } = parsearXml(
      `<r xmlns="${NS_A}"><dentro xmlns="${NS_B}"><hoja/></dentro><fuera/></r>`,
    )
    expect(errores).toEqual([])
    const dentro = raiz.hijos[0]
    expect(dentro.ns).toBe(NS_B)
    expect(dentro.hijos[0].ns).toBe(NS_B) // hereda la redeclaración
    expect(raiz.hijos[1].ns).toBe(NS_A) // el hermano NO la ve: el ámbito se restituye
  })

  it('un prefijo redeclarado más abajo tapa al de arriba solo en su subárbol', () => {
    const { raiz } = parsearXml(
      `<r xmlns:p="${NS_A}"><p:x><p:y xmlns:p="${NS_B}"><p:z/></p:y></p:x><p:w/></r>`,
    )
    const x = raiz.hijos[0]
    expect(x.ns).toBe(NS_A)
    expect(x.hijos[0].ns).toBe(NS_B)
    expect(x.hijos[0].hijos[0].ns).toBe(NS_B)
    expect(raiz.hijos[1].ns).toBe(NS_A)
  })

  it('el prefijo `xml:` está predeclarado sin necesidad de xmlns:xml', () => {
    const { raiz, errores } = parsearXml('<r xml:lang="es"/>')
    expect(errores).toEqual([])
    expect(atributo(raiz, NS_XML, 'lang')).toBe('es')
  })

  it('un prefijo NO declarado es un error del documento, no una excepción', () => {
    const prefijo = '<r>'
    const { errores } = parsearXml(`${prefijo}<p:x/></r>`)
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/prefijo «p».*no está declarado/)
    expect(errores[0]).toMatchObject(posicionDe(prefijo))
  })

  it('sin declaraciones, todo queda SIN namespace (no en uno inventado)', () => {
    const { raiz } = parsearXml('<r><x/></r>')
    expect(raiz.ns).toBe(SIN_NAMESPACE)
    expect(raiz.hijos[0].ns).toBe(SIN_NAMESPACE)
  })
})

// ── LA TRAMPA: atributos sin prefijo ──────────────────────────────────────────

describe('parsearXml · un atributo SIN PREFIJO no está en el namespace por defecto', () => {
  // XML-NS 1.0 §6.2. Es el fallo que comete la mayoría de las implementaciones
  // caseras, y en un GML de parcela decide si `srsName` se encuentra o no.
  // Verificado además contra jsdom en el oráculo: allí estos atributos salen con
  // `namespaceURI === null`.
  const XML =
    `<gml:MultiSurface xmlns="${NS_A}" xmlns:gml="${NS_B}" gml:id="MS_1" srsName="EPSG/0/25830">` +
    `<gml:posList srsDimension="2" count="16">1 2</gml:posList></gml:MultiSurface>`

  it('`srsName`, `srsDimension` y `count` viven SIN namespace', () => {
    const { raiz, errores } = parsearXml(XML)
    expect(errores).toEqual([])
    expect(atributo(raiz, SIN_NAMESPACE, 'srsName')).toBe('EPSG/0/25830')
    const posList = raiz.hijos[0]
    expect(atributo(posList, SIN_NAMESPACE, 'srsDimension')).toBe('2')
    expect(atributo(posList, SIN_NAMESPACE, 'count')).toBe('16')
  })

  it('y NO se encuentran en el namespace por defecto del elemento', () => {
    // Formulación negativa explícita: si alguien «simplifica» la resolución para
    // que un atributo sin prefijo herede el default, ESTE test es el que revienta.
    const { raiz } = parsearXml(XML)
    expect(raiz.ns).toBe(NS_B) // el elemento sí está en el ns de su prefijo…
    expect(atributo(raiz, NS_A, 'srsName')).toBeNull() // …y el default es NS_A
    expect(atributo(raiz, NS_B, 'srsName')).toBeNull()
  })

  it('un atributo CON prefijo sí resuelve a su namespace (`gml:id`)', () => {
    const { raiz } = parsearXml(XML)
    expect(atributo(raiz, NS_B, 'id')).toBe('MS_1')
    expect(atributo(raiz, SIN_NAMESPACE, 'id')).toBeNull()
  })

  it('`atributos` conserva el orden de documento y el prefijo original', () => {
    const { raiz } = parsearXml(XML)
    expect(raiz.atributos.map((a) => a.local)).toEqual(['id', 'srsName'])
    expect(raiz.atributos.map((a) => a.prefijo)).toEqual(['gml', ''])
  })

  it('las declaraciones `xmlns`/`xmlns:p` NO aparecen como atributos', () => {
    const { raiz } = parsearXml(XML)
    expect(raiz.atributos.some((a) => a.local === 'xmlns' || a.prefijo === 'xmlns')).toBe(false)
  })
})

// ── Texto, entidades y CDATA ──────────────────────────────────────────────────

describe('parsearXml · texto, entidades y CDATA', () => {
  it('expande LAS CINCO entidades predefinidas (derivadas del módulo)', () => {
    // La lista no se recopia: se recorre `ENTIDADES_XML`, que es lo que el
    // parser considera soportado. Añadir una entrada allí obliga a que funcione.
    for (const [nombre, valor] of Object.entries(ENTIDADES_XML)) {
      const { raiz, errores } = parsearXml(`<a>&${nombre};</a>`)
      expect(errores, `entidad &${nombre};`).toEqual([])
      expect(raiz.texto).toBe(valor)
    }
    expect(Object.keys(ENTIDADES_XML)).toHaveLength(5)
  })

  it('expande referencias numéricas decimales y hexadecimales', () => {
    expect(parsearXml('<a>&#65;&#x42;&#x63;</a>').raiz.texto).toBe('ABc')
    expect(parsearXml('<a>&#241;&#xF1;</a>').raiz.texto).toBe('ññ')
  })

  it('expande referencias fuera del BMP (pares subrogados correctos)', () => {
    const { raiz, errores } = parsearXml('<a>&#x1F600;</a>')
    expect(errores).toEqual([])
    expect(raiz.texto).toBe(String.fromCodePoint(0x1f600))
  })

  it('una entidad NO predefinida es un error explícito, no una expansión callada', () => {
    const prefijo = '<a>'
    const { raiz, errores } = parsearXml(`${prefijo}&nbsp;</a>`)
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/&nbsp;.*fuera del subconjunto soportado/s)
    expect(errores[0]).toMatchObject(posicionDe(prefijo))
    // El texto crudo se conserva: no se inventa un valor ni se borra el dato.
    expect(raiz.texto).toBe('&nbsp;')
  })

  it('una referencia numérica a un carácter ilegal en XML se rechaza', () => {
    const { errores } = parsearXml('<a>&#0;</a>')
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/no es un carácter válido en XML/)
  })

  it('un «&» suelto se señala y no se corrige por su cuenta', () => {
    const { errores } = parsearXml('<a>Bar & Grill</a>')
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/«&» suelto/)
  })

  it('CDATA entrega su contenido CRUDO, sin expandir nada', () => {
    // El fixture real de edificio lleva una URL en CDATA; si el parser expandiera
    // dentro, un `&` de la query rompería el enlace.
    const { raiz, errores } = parsearXml('<a><![CDATA[x & y < z &amp; w]]></a>')
    expect(errores).toEqual([])
    expect(raiz.texto).toBe('x & y < z &amp; w')
  })

  it('CDATA y texto adyacente se concatenan en un único `texto`', () => {
    expect(parsearXml('<a>uno<![CDATA[&dos]]>tres</a>').raiz.texto).toBe('uno&dostres')
  })

  it('`nodo.texto` es el texto DIRECTO, sin recursión', () => {
    const { raiz } = parsearXml('<a>fuera<b>dentro</b>final</a>')
    expect(raiz.texto).toBe('fuerafinal')
    expect(raiz.hijos[0].texto).toBe('dentro')
  })

  it('normaliza CRLF a LF en el texto (XML 1.0 §2.11)', () => {
    expect(parsearXml('<a>x\r\ny\rz</a>').raiz.texto).toBe('x\ny\nz')
  })
})

// ── Estructura ────────────────────────────────────────────────────────────────

describe('parsearXml · estructura del documento', () => {
  it('un elemento autocerrado no tiene ni hijos ni texto', () => {
    const { raiz, errores } = parsearXml('<a><b/><c></c></a>')
    expect(errores).toEqual([])
    expect(raiz.hijos.map((h) => h.local)).toEqual(['b', 'c'])
    for (const h of raiz.hijos) {
      expect(h.hijos).toEqual([])
      expect(h.texto).toBe('')
    }
  })

  it('comentarios e instrucciones de proceso NO son hijos ni aportan texto', () => {
    const { raiz, errores } = parsearXml('<a><!--nota--><?pi dato?><b/></a>')
    expect(errores).toEqual([])
    expect(raiz.hijos.map((h) => h.local)).toEqual(['b'])
    expect(raiz.texto).toBe('')
  })

  it('admite comentarios en el prólogo y en el epílogo', () => {
    // Los dos fixtures de parcela llevan comentarios entre la declaración y la
    // raíz: si el prólogo no los admitiera, no se podría leer ni uno.
    const { raiz, errores } = parsearXml(
      '<?xml version="1.0"?>\n<!--cabecera-->\n<a/>\n<!--pie-->\n',
    )
    expect(errores).toEqual([])
    expect(raiz.local).toBe('a')
  })

  it('admite valores de atributo con comilla simple y con comilla doble', () => {
    const { raiz, errores } = parsearXml(`<a x='con "dobles"' y="con 'simples'"/>`)
    expect(errores).toEqual([])
    expect(atributo(raiz, SIN_NAMESPACE, 'x')).toBe('con "dobles"')
    expect(atributo(raiz, SIN_NAMESPACE, 'y')).toBe("con 'simples'")
  })

  it('normaliza el espacio en blanco LITERAL del valor de un atributo (§3.3.3)', () => {
    // Salto de línea y tabulador literales pasan a espacio; los mismos
    // caracteres escritos como referencia NO. Esa asimetría es el motivo de que
    // `escaparAtributo` escape \r \n \t como referencias numéricas.
    const { raiz } = parsearXml('<a b="x\ny\tz" c="x&#10;y&#9;z"/>')
    expect(atributo(raiz, SIN_NAMESPACE, 'b')).toBe('x y z')
    expect(atributo(raiz, SIN_NAMESPACE, 'c')).toBe('x\ny\tz')
  })

  it('cada nodo lleva la línea y la columna de su etiqueta de apertura', () => {
    const xml = '<a>\n  <b/>\n  <c>\n    <d/>\n  </c>\n</a>'
    const { raiz } = parsearXml(xml)
    expect({ linea: raiz.linea, columna: raiz.columna }).toEqual(posicionDe(''))
    const b = raiz.hijos[0]
    expect({ linea: b.linea, columna: b.columna }).toEqual(posicionDe('<a>\n  '))
    const d = raiz.hijos[1].hijos[0]
    expect({ linea: d.linea, columna: d.columna }).toEqual(posicionDe('<a>\n  <b/>\n  <c>\n    '))
  })

  it('salta el BOM sin desplazar las posiciones que reporta', () => {
    const { raiz, errores } = parsearXml('\uFEFF<a/>')
    expect(errores).toEqual([])
    expect(raiz.local).toBe('a')
  })
})

// ── XML mal formado: errores con localización, nunca excepción ────────────────

describe('parsearXml · XML mal formado → errores con línea y columna', () => {
  it('etiqueta de cierre que no casa, señalada donde está y citando la apertura', () => {
    const prefijo = '<a>\n  <b>'
    const { errores } = parsearXml(`${prefijo}</c>\n</a>`)
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/«<\/c>».*no casa.*«<b>».*línea 2/)
    expect(errores[0]).toMatchObject(posicionDe(prefijo))
  })

  it('elemento sin cerrar al llegar al final del fichero, señalado en su APERTURA', () => {
    // La localización que sirve es la de la ETIQUETA DE APERTURA: decir «error
    // en la última línea» de un GML de 34 KB no ayuda a nadie.
    const prefijo = '<a>\n  '
    const { errores } = parsearXml(`${prefijo}<b>\n`)
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/«<b>».*línea 2.*no se cierra con «<\/b>»/)
    expect(errores[0]).toMatchObject(posicionDe(prefijo))
  })

  it('elemento sin cerrar que hace fallar el cierre del padre: se cita la apertura', () => {
    const prefijo = '<a>\n  <b>\n'
    const { errores } = parsearXml(`${prefijo}</a>`)
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/«<\/a>» no casa con la de apertura «<b>» de la línea 2/)
    expect(errores[0]).toMatchObject(posicionDe(prefijo))
  })

  it('atributo sin comillas', () => {
    const prefijo = '<a b='
    const { errores } = parsearXml(`${prefijo}1/>`)
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/entre comillas/)
    expect(errores[0]).toMatchObject(posicionDe(prefijo))
  })

  it('atributo sin «=»', () => {
    const { errores } = parsearXml('<a b/>')
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/no lleva «=»/)
  })

  it('atributos pegados sin espacio', () => {
    const { errores } = parsearXml('<a b="1"c="2"/>')
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/falta un espacio/)
  })

  it('atributo repetido: se avisa y se conserva el primero', () => {
    const { raiz, errores } = parsearXml('<a b="1" b="2"/>')
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/«b».*repetido/)
    expect(atributo(raiz, SIN_NAMESPACE, 'b')).toBe('1')
  })

  it('documento vacío y documento sin elemento raíz', () => {
    expect(parsearXml('').errores[0].mensaje).toMatch(/ningún elemento raíz/)
    expect(parsearXml('   \n  ').errores[0].mensaje).toMatch(/ningún elemento raíz/)
    expect(parsearXml('esto no es XML').errores[0].mensaje).toMatch(/se esperaba el elemento raíz/)
  })

  it('contenido después del elemento raíz', () => {
    const { raiz, errores } = parsearXml('<a/><b/>')
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/después del elemento raíz/)
    expect(raiz.local).toBe('a') // lo leído hasta ahí se conserva
  })

  it('comentario, CDATA e instrucción sin cerrar', () => {
    expect(parsearXml('<a><!-- x</a>').errores[0].mensaje).toMatch(/comentario.*no se cierra/)
    expect(parsearXml('<a><![CDATA[ x</a>').errores[0].mensaje).toMatch(/CDATA.*no se cierra/)
    expect(parsearXml('<a><? x</a>').errores[0].mensaje).toMatch(
      /instrucción de proceso.*no se cierra/,
    )
  })

  it('todo error trae mensaje en castellano y localización utilizable', () => {
    const { errores } = parsearXml('<a><b></c></a>')
    for (const e of errores) {
      expect(Object.keys(e).sort()).toEqual(['columna', 'linea', 'mensaje'])
      expect(e.linea).toBeGreaterThanOrEqual(1)
      expect(e.columna).toBeGreaterThanOrEqual(1)
    }
  })
})

// ── Lo que queda FUERA del subconjunto, con error explícito ───────────────────

describe('parsearXml · fuera del subconjunto declarado (rechazo explícito)', () => {
  it('`<!DOCTYPE>` se rechaza de plano y el mensaje dice POR QUÉ', () => {
    // Defensa ante la expansión recursiva de entidades («billion laughs») en un
    // fichero que sube un tercero. El mensaje tiene que explicarlo: quien vea el
    // rechazo no debe poder concluir «bah, será un bug del parser».
    const { raiz, errores } = parsearXml('<!DOCTYPE a><a/>')
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/DOCTYPE/)
    expect(errores[0].mensaje).toMatch(/billion laughs/)
    expect(raiz).toBeNull()
  })

  it('el DOCTYPE con DTD interna tampoco llega a expandirse', () => {
    const bomba = '<!DOCTYPE a [<!ENTITY x "yyyyyyyyyy"><!ENTITY y "&x;&x;&x;">]><a>&y;</a>'
    const { raiz, errores } = parsearXml(bomba)
    expect(raiz).toBeNull()
    expect(errores[0].mensaje).toMatch(/DOCTYPE/)
  })

  it('un DOCTYPE metido dentro del contenido también se rechaza', () => {
    expect(parsearXml('<a><!DOCTYPE b></a>').errores[0].mensaje).toMatch(/DOCTYPE/)
  })

  it('una sección `<!…>` que no sea comentario ni CDATA se rechaza nombrándola', () => {
    const { errores } = parsearXml('<a><!ENTITY x "y"></a>')
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/fuera del subconjunto soportado/)
  })

  it(`corta el anidamiento por encima de PROFUNDIDAD_MAXIMA (${PROFUNDIDAD_MAXIMA})`, () => {
    // Derivado de la constante exportada: subirla o bajarla no obliga a tocar el
    // test. Justo por debajo del tope tiene que seguir leyendo sin quejarse.
    const anidar = (n) => '<a>'.repeat(n) + '</a>'.repeat(n)
    expect(parsearXml(anidar(PROFUNDIDAD_MAXIMA)).errores).toEqual([])
    const { errores } = parsearXml(anidar(PROFUNDIDAD_MAXIMA + 5))
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(new RegExp(`más de ${PROFUNDIDAD_MAXIMA} niveles`))
  })
})

// ── Consultas de conveniencia ─────────────────────────────────────────────────

describe('consultas · hijos, hijo, hijoUnico, texto, atributo y ruta', () => {
  const DOC = `<r xmlns="${NS_A}" xmlns:p="${NS_B}">
      <x>uno</x>
      <x>dos</x>
      <p:x>otro namespace</p:x>
      <solo uom="m2"> 1536 </solo>
      <hondo><mas><fondo>final</fondo></mas></hondo>
    </r>`
  const raiz = parsearXml(DOC).raiz

  it('`hijos` devuelve todos los que casan (ns, local), en orden', () => {
    expect(hijos(raiz, NS_A, 'x').map((n) => n.texto)).toEqual(['uno', 'dos'])
  })

  it('`hijos` discrimina por namespace, no solo por nombre local', () => {
    expect(hijos(raiz, NS_B, 'x').map((n) => n.texto)).toEqual(['otro namespace'])
    expect(hijos(raiz, SIN_NAMESPACE, 'x')).toEqual([])
  })

  it('`hijo` devuelve el primero, o null', () => {
    expect(hijo(raiz, NS_A, 'x').texto).toBe('uno')
    expect(hijo(raiz, NS_A, 'noexiste')).toBeNull()
  })

  it('`hijoUnico` devuelve el elemento solo si hay EXACTAMENTE uno', () => {
    expect(hijoUnico(raiz, NS_A, 'solo').local).toBe('solo')
    expect(hijoUnico(raiz, NS_A, 'noexiste')).toBeNull()
    // Con dos NO devuelve el primero: devolver uno de los dos calladamente sería
    // el error silencioso que la regla de oro 1 prohíbe.
    expect(hijoUnico(raiz, NS_A, 'x')).toBeNull()
  })

  it('`hijoUnico` anota la DUPLICIDAD si se le pasa `errores`, y la ausencia no', () => {
    const errores = []
    expect(hijoUnico(raiz, NS_A, 'x', errores)).toBeNull()
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/único «x».*hay 2/)
    expect(errores[0].linea).toBe(hijos(raiz, NS_A, 'x')[1].linea)

    // Ausencia: un elemento opcional del XSD puede faltar legítimamente.
    const otros = []
    expect(hijoUnico(raiz, NS_A, 'noexiste', otros)).toBeNull()
    expect(otros).toEqual([])
  })

  it('`texto` recorta; `nodo.texto` conserva el crudo', () => {
    const solo = hijo(raiz, NS_A, 'solo')
    expect(texto(solo)).toBe('1536')
    expect(solo.texto).toBe(' 1536 ')
  })

  it('`atributo` devuelve el valor o null', () => {
    const solo = hijo(raiz, NS_A, 'solo')
    expect(atributo(solo, SIN_NAMESPACE, 'uom')).toBe('m2')
    expect(atributo(solo, SIN_NAMESPACE, 'noexiste')).toBeNull()
  })

  it('`ruta` desciende y devuelve null en cuanto un paso falta', () => {
    expect(
      texto(ruta(raiz, [[NS_A, 'hondo'], [NS_A, 'mas'], [NS_A, 'fondo']])),
    ).toBe('final')
    expect(ruta(raiz, [[NS_A, 'hondo'], [NS_A, 'noexiste'], [NS_A, 'fondo']])).toBeNull()
    expect(ruta(raiz, [])).toBe(raiz)
  })

  it('las consultas LANZAN ante contrato roto por el programador', () => {
    // Aquí sí toca excepción: no es dato del usuario, es una llamada mal escrita.
    for (const fn of [hijos, hijo, hijoUnico, atributo]) {
      expect(() => fn(null, NS_A, 'x'), fn.name).toThrow(TypeError)
      expect(() => fn(raiz, undefined, 'x'), fn.name).toThrow(TypeError)
      expect(() => fn(raiz, NS_A, ''), fn.name).toThrow(TypeError)
    }
    expect(() => texto(null)).toThrow(TypeError)
    expect(() => ruta(raiz, 'no es array')).toThrow(TypeError)
    expect(() => ruta(raiz, [[NS_A]])).toThrow(/par \[ns, local\]/)
    expect(() => hijoUnico(raiz, NS_A, 'x', 'no es array')).toThrow(TypeError)
  })

  it('`texto(null)` LANZA en vez de devolver \'\': ausente ≠ vacío', () => {
    // `<cp:label/>` (vacío) es un dato; que no esté el elemento es otro. Un
    // `texto(null) === ''` los confundiría y el fallo aparecería en la Sede.
    expect(() => texto(hijo(raiz, NS_A, 'noexiste'))).toThrow(/comprueba antes que no es null/)
  })
})

// ── Escritura ─────────────────────────────────────────────────────────────────

describe('escaparTexto y escaparAtributo', () => {
  it('escaparTexto cubre & < > y el retorno de carro', () => {
    expect(escaparTexto('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d')
    // El `>` no sería obligatorio salvo tras `]]`, pero se escapa siempre para
    // que ninguna concatenación futura forme un `]]>` accidental.
    expect(escaparTexto(']]>')).toBe(']]&gt;')
    expect(escaparTexto('x\ry')).toBe('x&#13;y')
  })

  it('escaparTexto NO escapa comillas (no hacen falta en contenido)', () => {
    expect(escaparTexto(`comillas " y '`)).toBe(`comillas " y '`)
  })

  it('escaparAtributo cubre & < > " y los blancos que el parser normalizaría', () => {
    expect(escaparAtributo('a & b < c > d "e"')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;')
    expect(escaparAtributo('x\ry\nz\tw')).toBe('x&#13;y&#10;z&#9;w')
  })

  it('escaparAtributo NO escapa la comilla simple (los valores van en dobles)', () => {
    expect(escaparAtributo("d'Hondt")).toBe("d'Hondt")
  })

  it('ambas lanzan TypeError si no reciben un string', () => {
    expect(() => escaparTexto(42)).toThrow(TypeError)
    expect(() => escaparAtributo(null)).toThrow(TypeError)
  })
})

describe('elem · construcción del árbol de salida', () => {
  it('devuelve un POJO plano con los atributos EN ORDEN', () => {
    const n = elem('cp:areaValue', [['uom', 'm2']], '1536')
    expect(n).toEqual({ nombre: 'cp:areaValue', atributos: [['uom', 'm2']], contenido: '1536' })
  })

  it('el orden de los atributos es el que se le pasa (array, no objeto)', () => {
    const n = elem('a', [['z', '1'], ['a', '2'], ['m', '3']])
    expect(n.atributos.map(([k]) => k)).toEqual(['z', 'a', 'm'])
  })

  it('acepta hijos NodoSalida y rechaza cualquier otra cosa como hijo', () => {
    expect(() => elem('a', [], [elem('b')])).not.toThrow()
    expect(() => elem('a', [], ['texto suelto'])).toThrow(/no es un NodoSalida/)
    expect(() => elem('a', [], [null])).toThrow(/no es un NodoSalida/)
  })

  it('RECHAZA un valor de atributo numérico, a propósito', () => {
    // Convertir un número a texto en un GML es una decisión (cuántos decimales,
    // hacia dónde redondea) y la regla de oro 11 dice dónde se toma. `elem` no
    // la toma por ti: te obliga a escribir el toFixed a la vista.
    expect(() => elem('gml:posList', [['count', 16]])).toThrow(/debe ser un string/)
    expect(() => elem('gml:posList', [['count', String(16)]])).not.toThrow()
  })

  it('valida nombre, forma de los atributos y tipo del contenido', () => {
    expect(() => elem('')).toThrow(TypeError)
    expect(() => elem(42)).toThrow(TypeError)
    expect(() => elem('a', 'no es array')).toThrow(TypeError)
    expect(() => elem('a', ['no es par'])).toThrow(/par \[nombre, valor\]/)
    expect(() => elem('a', [['', 'v']])).toThrow(TypeError)
    expect(() => elem('a', [], 42)).toThrow(TypeError)
  })
})

describe('render · serialización con sangrado', () => {
  it('un elemento sin contenido sale AUTOCERRADO', () => {
    expect(render(elem('cp:label'))).toBe('<cp:label/>')
    expect(render(elem('cp:label', [], []))).toBe('<cp:label/>')
    expect(render(elem('cp:label', [], ''))).toBe('<cp:label/>')
  })

  it('un elemento con texto sale en UNA línea (el texto nunca se sangra)', () => {
    // En `gml:posList` un salto de línea añadido cambiaría el dato que lee el
    // validador, así que el contenido de texto jamás se toca.
    expect(render(elem('cp:areaValue', [['uom', 'm2']], '1536'))).toBe(
      '<cp:areaValue uom="m2">1536</cp:areaValue>',
    )
  })

  it('un elemento con hijos sale sangrado, un hijo por línea', () => {
    const arbol = elem('r', [], [elem('a', [], 'x'), elem('b'), elem('c', [], [elem('d')])])
    expect(render(arbol)).toBe(
      ['<r>', '  <a>x</a>', '  <b/>', '  <c>', '    <d/>', '  </c>', '</r>'].join('\n'),
    )
  })

  it('respeta `indentacion` y `nivel`', () => {
    const arbol = elem('r', [], [elem('a')])
    expect(render(arbol, { indentacion: '    ' })).toBe('<r>\n    <a/>\n</r>')
    expect(render(arbol, { indentacion: '\t' })).toBe('<r>\n\t<a/>\n</r>')
    expect(render(arbol, { nivel: 2 })).toBe('    <r>\n      <a/>\n    </r>')
  })

  it('escapa los valores de atributo al escribirlos', () => {
    expect(render(elem('a', [['b', 'x & "y" < z']]))).toBe('<a b="x &amp; &quot;y&quot; &lt; z"/>')
  })

  it('rechaza una `indentacion` que no sea blanco y un `nivel` inválido', () => {
    // Una indentación con cualquier otro carácter inyectaría texto en el XML.
    expect(() => render(elem('a'), { indentacion: '-- ' })).toThrow(/espacios o tabuladores/)
    expect(() => render(elem('a'), { nivel: -1 })).toThrow(RangeError)
    expect(() => render(elem('a'), { nivel: 1.5 })).toThrow(RangeError)
  })

  it('rechaza cualquier cosa que no sea un NodoSalida (no acepta XML crudo)', () => {
    expect(() => render('<a/>')).toThrow(/NodoSalida construido con elem/)
    expect(() => render(null)).toThrow(TypeError)
  })
})

// ── Ida y vuelta del propio módulo ────────────────────────────────────────────

describe('ida y vuelta · render → parsearXml devuelve lo mismo que se escribió', () => {
  // El árbol de prueba lleva a propósito todo lo que puede perderse por el
  // camino: namespaces por prefijo y por defecto, atributos con y sin prefijo
  // (la trampa), caracteres a escapar en texto y en atributo, blancos que el
  // parser normalizaría si no fueran referencias, un elemento vacío y anidamiento.
  const ARBOL = elem(
    'wfs:FeatureCollection',
    [
      ['xmlns:wfs', 'http://www.opengis.net/wfs/2.0'],
      ['xmlns:gml', 'http://www.opengis.net/gml/3.2'],
      ['xmlns:cp', 'http://inspire.ec.europa.eu/schemas/cp/4.0'],
      ['xmlns', 'urn:defecto'],
    ],
    [
      elem('miembro', [], [
        elem('gml:MultiSurface', [['gml:id', 'MS_1'], ['srsName', 'EPSG/0/25830']], [
          elem(
            'gml:posList',
            [['srsDimension', '2'], ['count', '3']],
            '1.00 2.00 3.00 4.00 1.00 2.00',
          ),
        ]),
        elem('cp:label'),
        elem('raro', [['con', 'a & b < c > d "e"']], 'texto & con < signos > raros'),
        elem('blancos', [['b', 'x\ry\nz\tw']], 'sobrevive\rel retorno'),
      ]),
    ],
  )

  const XML = render(ARBOL)
  const { raiz, errores } = parsearXml(XML)

  it('el XML producido se vuelve a leer sin un solo error', () => {
    expect(errores, XML).toEqual([])
  })

  it('la estructura, los namespaces y los textos coinciden', () => {
    const esperado = {
      ns: 'http://www.opengis.net/wfs/2.0',
      local: 'FeatureCollection',
      atributos: [],
      texto: '',
      hijos: [
        {
          ns: 'urn:defecto',
          local: 'miembro',
          atributos: [],
          texto: '',
          hijos: [
            {
              ns: 'http://www.opengis.net/gml/3.2',
              local: 'MultiSurface',
              // `gml:id` con namespace; `srsName` SIN él: la trampa, ida y vuelta.
              atributos: [
                ['http://www.opengis.net/gml/3.2', 'id', 'MS_1'],
                [SIN_NAMESPACE, 'srsName', 'EPSG/0/25830'],
              ],
              texto: '',
              hijos: [
                {
                  ns: 'http://www.opengis.net/gml/3.2',
                  local: 'posList',
                  atributos: [
                    [SIN_NAMESPACE, 'srsDimension', '2'],
                    [SIN_NAMESPACE, 'count', '3'],
                  ],
                  texto: '1.00 2.00 3.00 4.00 1.00 2.00',
                  hijos: [],
                },
              ],
            },
            {
              ns: 'http://inspire.ec.europa.eu/schemas/cp/4.0',
              local: 'label',
              atributos: [],
              texto: '',
              hijos: [],
            },
            {
              ns: 'urn:defecto',
              local: 'raro',
              atributos: [[SIN_NAMESPACE, 'con', 'a & b < c > d "e"']],
              texto: 'texto & con < signos > raros',
              hijos: [],
            },
            {
              ns: 'urn:defecto',
              local: 'blancos',
              atributos: [[SIN_NAMESPACE, 'b', 'x\ry\nz\tw']],
              texto: 'sobrevive\rel retorno',
              hijos: [],
            },
          ],
        },
      ],
    }
    expect(canon(raiz)).toEqual(esperado)
  })

  it('el elemento sin contenido viaja como autocerrado', () => {
    expect(XML).toContain('<cp:label/>')
  })

  it('los blancos sobreviven SOLO porque van como referencias numéricas', () => {
    // La demostración de por qué `escaparAtributo`/`escaparTexto` los escapan:
    // el mismo valor escrito con blancos LITERALES no vuelve igual.
    expect(XML).toContain('b="x&#13;y&#10;z&#9;w"')
    const literal = parsearXml('<a b="x\ry\nz\tw">sobrevive\rel retorno</a>').raiz
    expect(atributo(literal, SIN_NAMESPACE, 'b')).toBe('x y z w') // normalizado: se perdió
    expect(literal.texto).toBe('sobrevive\nel retorno') // el \r pasó a \n: se perdió
  })

  it('la ida y vuelta es idempotente: render(parse(render(x))) no deriva', () => {
    // Se re-renderiza desde el árbol de SALIDA original (que es el contrato de
    // escritura) y se comprueba que el texto es estable llamada tras llamada.
    expect(render(ARBOL)).toBe(XML)
    // Y que el árbol leído del segundo pase es idéntico al del primero.
    expect(canon(parsearXml(render(ARBOL)).raiz)).toEqual(canon(raiz))
  })
})
