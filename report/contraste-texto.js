// report/contraste-texto.js — F08 · El informe de contraste, en TEXTO PLANO.
//
// Estrena el directorio `report/`, que SPEC §5 reserva para F09. F08 escribió la
// **versión en texto del índice del informe firmable**
// (`spec/feature-09-informe-parcela.md`, §Contenido) para que el recorrido «soltar
// un GML → ver el contraste → llevarse el resultado» quedara cerrado desde el primer
// día y para que F09 no tuviera que reinventar qué va dentro ni en qué orden.
//
// ── QUÉ CAMBIÓ CUANDO F09 LLEGÓ (2026-08-02) ────────────────────────────────
// El documento firmable —plano compuesto a 300 ppp, descripción literaria del
// lindero y pie de firma colegiada— **ya existe**: lo componen `report/pdf-parcela.js`
// y sus contratos, y se pide con «Preparar informe (PDF)» en el cajón del
// diagnóstico. Este módulo NO se jubila por eso, y sigue enganchado al botón de al
// lado por dos motivos que no ha caducado ninguno: se compone **sin red** —no pide
// una sola tesela al WMS— y baja igual el día que el plano no se pueda armar.
//
// Lo que sí cambió es **el desmentido de la cabecera**. Decía que el firmable «es el
// de la fase F09 de esta herramienta y todavía no existe», y eso dejó de ser verdad;
// un aviso que se queda viejo es peor que ninguno, porque se sigue leyendo con la
// misma cara de cierto. Hoy dice lo que sigue siendo verdad —que este documento no
// lleva plano, ni descripción del lindero, ni pie de firma— y **remite al que sí los
// lleva**, por el nombre del botón que lo compone. Está anclado en `pie()` además de
// en `cabecera()`, a propósito: arriba, antes de leer una cifra, y abajo, en el sitio
// donde alguien iría a buscar la firma que no está.
//
// ── EL NOMBRE ES LEGAL, NO DECORATIVO ───────────────────────────────────────
// **«Informe de contraste con el parcelario catastral»**, y jamás «informe de
// validación gráfica». VGA e IVG son un procedimiento y un documento OFICIALES del
// Catastro, con código seguro de verificación, que emite su Sede Electrónica. Un
// nombre casi homónimo en la cabecera de un fichero descargado hace creer al cliente
// que su expediente ya se ha presentado, y esa confusión no la deshace ninguna letra
// pequeña. Está razonado en `spec/feature-09-informe-parcela.md` §Nombre, y el
// informe además lo dice de sí mismo, con todas las letras, en su primera pantalla.
//
// ── LA REGLA DE ORO 9 ES EL REQUISITO PRINCIPAL DE ESTE FICHERO ─────────────
// «La aplicación mide; el colegiado interpreta y firma. Ninguna cifra lleva juicio
// de valor: sin semáforos, sin válido/no válido» (SPEC §2). En un documento que solo
// es texto eso se traduce en una prohibición de VOCABULARIO, y hay un guardián que
// la afirma sobre la cadena generada:
//
//   · Ni «correcto», ni «apto», ni «cumple», ni «dentro de tolerancia», ni
//     «conforme», ni marcas de mérito (✓ / ⚠) sobre ninguna cifra.
//   · El **margen del BOE se ENUNCIA y no se compara** con nada. Viaja con su
//     etiqueta —que llega dentro del propio diagnóstico, precisamente para que no se
//     pueda escribir la cifra sin ella— y el informe dice por escrito que enfrentarlo
//     con las medidas es del colegiado que firma.
//   · La ÚNICA excepción de todo el proyecto es la **invasión a colindante**, hecho
//     topológico binario con consecuencia fija (SPEC §2, regla 9).
//
// ── LOS TRES SABORES DE «NO HAY» SE ESCRIBEN DISTINTO ───────────────────────
// Es media razón de ser de F07 (ver la cabecera de `diagnostico/parcela.js`) y aquí
// se conserva letra por letra, porque un informe es justo donde se firma la
// confusión:
//
//   1. **Una sección a `null`** deja su entrada en `omisiones` con el motivo YA
//      REDACTADO en español, y ese motivo se imprime **en el sitio de la cifra que
//      falta**, no en una nota al pie. Es la doctrina que `viewer/cajon-diagnostico.js`
//      dejó escrita: un motivo al pie se lee fuera de contexto o no se lee.
//   2. **`invasion.consultado: false`** se escribe «no se ha consultado», y **NUNCA**
//      «ninguna invasión». Son afirmaciones opuestas y la segunda tranquiliza. La
//      palabra «ninguna» aparece en un solo sitio de todo el informe: la línea de
//      invasión cuando SÍ se consultó y no había.
//   3. **Un número a `null`** dentro de una sección es «No consta», que no es 0. Un
//      «0,00 m²» donde falta la superficie registral diría que la escritura declara
//      cero metros cuadrados.
//
// ── EL RELOJ NO SE LEE AQUÍ ─────────────────────────────────────────────────
// La `fecha` entra por parámetro, igual que en todo `gml/` y por el mismo motivo: un
// informe descargado es un SNAPSHOT y tiene que valer lo mismo dentro de un año; si
// este módulo consultara la marca de tiempo del sistema, su snapshot de prueba
// cambiaría en cada ejecución y dejaría de afirmar nada. Tampoco se usan los
// formateadores de fecha dependientes del entorno: la fecha se rinde por componentes
// UTC, como hace `gml/_comun.js#dateTimeCatastro`, para que el mismo instante
// produzca el mismo texto en CI y en cualquier equipo. Hay un test que lo comprueba
// con un grep sobre el TEXTO de este fichero, así que esas llamadas no aparecen ni
// dentro de un comentario.
//
// ── CERO IMPORTS, Y ES UNA DECISIÓN ─────────────────────────────────────────
// Este módulo no importa nada. Podría importar `OMISION` de `diagnostico/parcela.js`
// —es el vocabulario de `omisiones[].que` y está exportado justo para que nadie
// escriba `'solape'` a mano—, pero ese módulo arrastra `diagnostico/topologia.js` y
// con él Turf entero al grafo de dependencias de un formateador de texto. Así que las
// claves se declaran aquí, en {@link OMISION_CONOCIDA}, y lo que impide que las dos
// listas diverjan es un **test-guarda** que las compara: la misma fórmula con la que
// `gml/_comun.js#SRS_SOPORTADOS` convive con `model/parcela.js#SRS_VALIDOS` y
// `geo/huso.js#HUSOS_VALIDOS`. Un literal suelto sin guardián sería peor; una
// dependencia de Turf en `report/`, también.
//
// ── QUÉ NO HACE ─────────────────────────────────────────────────────────────
//   · **No descarga nada.** Devuelve una cadena. El `Blob` y el `<a download>` son de
//     `gml/descargar.js#descargarTexto`, y el botón, del cajón de diagnóstico.
//   · **No calcula ni una cifra.** Todas vienen medidas de `diagnostico/`; aquí solo
//     se formatean. Una segunda aritmética sería una segunda verdad.
//   · **No traduce los mensajes de la comprobación.** `notas`, `bloqueos`,
//     `hallazgos`, `motivoNoContinua`, `queSignifica`, `etiqueta` y los `motivo` de
//     las omisiones llegan ya en español, redactados por quien sabe por qué (regla
//     de oro 1); este módulo los imprime LITERALES. Solo traduce los CÓDIGOS que sus
//     módulos no exponen en forma presentable —{@link MOTIVO_SALTADO} y
//     {@link ROTULO_ORIGEN}—, y ante un código desconocido imprime el código en vez
//     de esconderlo.
//   · **No pierde lo que un mensaje no dice.** `validation/` manda el CUÁL de un
//     hallazgo en `verticesAfectados` para que el visor lo resalte; aquí no hay nada
//     que resaltar, así que esas referencias se imprimen (ver {@link refsVertices}).
//   · **No redondea el modelo** (regla 11): el redondeo a 2 decimales es de SALIDA.

// ── Medidas del papel ────────────────────────────────────────────────────────

/** Ancho útil de línea. Texto plano en monoespaciada: alineación con espacios. */
const ANCHO = 78

/** Ancho de la columna de rótulos (incluye los puntos de relleno). */
const ANCHO_ROTULO = 32

/**
 * Lo que se escribe cuando un número no consta. **No es un `—` a secas**: un guion
 * se lee como «cero» o como «nada que reseñar», y aquí significa que el dato falta.
 * Mismo texto, deliberadamente, que `viewer/cajon-diagnostico.js`.
 */
const NO_CONSTA = 'No consta'

// ── Vocabularios espejo (ver «CERO IMPORTS» en la cabecera) ──────────────────

/**
 * Claves de `omisiones[].que`, espejo de `diagnostico/parcela.js#OMISION`. La
 * divergencia la impide un test-guarda, no la disciplina.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const OMISION_CONOCIDA = Object.freeze({
  SOLAPE: 'solape',
  DIFERENCIA: 'diferencia',
  CENTROIDES: 'centroides',
  DESVIACION: 'desviacion',
  MARGEN: 'margen',
})

/**
 * Rótulo humano de cada sección que puede quedar sin medir. Se usa en el recuento
 * final; el MOTIVO se imprime en el sitio de la cifra que falta.
 */
const ROTULO_OMISION = Object.freeze({
  [OMISION_CONOCIDA.SOLAPE]: 'Solape con el contorno oficial',
  [OMISION_CONOCIDA.DIFERENCIA]: 'Diferencia con el contorno oficial',
  [OMISION_CONOCIDA.CENTROIDES]: 'Desplazamiento de centroides',
  [OMISION_CONOCIDA.DESVIACION]: 'Desviación de lindero',
  [OMISION_CONOCIDA.MARGEN]: 'Margen oficial de identidad',
})

/** Rótulo humano de cada banda de la tabla a tres bandas. */
const ROTULO_BANDA = Object.freeze({
  medida: 'Medición',
  catastral: 'Catastro',
  registral: 'Registro',
})

/**
 * Procedencia de la geometría, espejo de `model/parcela.js#ORIGEN_PARCELA`. Un
 * origen que no esté aquí se imprime tal cual: inventarle una frase sería peor.
 */
const ROTULO_ORIGEN = Object.freeze({
  WFS: 'Descarga del Catastro (servicio WFS)',
  LIST: 'Fichero de listado de coordenadas (LIST) aportado',
  TXT: 'Fichero de texto de coordenadas (TXT) aportado',
  DXF: 'Fichero de CAD (DXF) aportado',
  GML_EXISTENTE: 'Fichero GML aportado por el usuario',
})

/**
 * Los códigos de `saltados[].motivo`, que `diagnostico/topologia.js` NO exporta en
 * forma presentable. Un código desconocido se imprime crudo (regla de oro 1: antes
 * un código feo que un silencio).
 */
const MOTIVO_SALTADO = Object.freeze({
  SIN_RECINTOS: 'la lista de recintos venía vacía: no hay región que medir',
  EXTERIOR_NO_APTO: 'el contorno exterior no forma anillo (menos de 3 vértices)',
  HUECO_NO_APTO:
    'un hueco no forma anillo (menos de 3 vértices); la región se ha medido sin él, ' +
    'así que la superficie sale por exceso en ese hueco',
})

// ── Formato de números, en español ───────────────────────────────────────────
//
// Los separadores son los de `es-ES`, igual que en `viewer/cajon-diagnostico.js`,
// con UNA divergencia deliberada: las **coordenadas van sin separador de millar**
// (`439283,23`, no `439.283,23`). Es la convención de cualquier listado topográfico
// y aquí además evita que un punto de millar y una coma decimal compartan la misma
// columna, que es la lectura equivocada más fácil de cometer en una tabla de
// vértices. Las superficies y las longitudes sí lo llevan, porque ahí se leen como
// magnitudes y no como identificadores de posición.

const nf = (decimales, agrupar = true) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: agrupar,
  })

/** Superficies y longitudes: 2 decimales, que es lo que la app sabe medir. */
const FORMATO_2 = nf(2)
/** La superficie DECLARADA por el Catastro es un ENTERO (override O6). */
const FORMATO_0 = nf(0)
/** Coordenadas: 2 decimales (regla 11, redondeo de salida) y sin agrupar. */
const FORMATO_COORD = nf(2, false)

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v)

const m2 = (v) => (esNumero(v) ? `${FORMATO_2.format(v)} m²` : NO_CONSTA)
const m2Entero = (v) => (esNumero(v) ? `${FORMATO_0.format(v)} m²` : NO_CONSTA)
const metros = (v) => (esNumero(v) ? `${FORMATO_2.format(v)} m` : NO_CONSTA)
const cuenta = (v) => (esNumero(v) ? FORMATO_0.format(v) : NO_CONSTA)

/**
 * Un `relativo` (FRACCIÓN, 0,05 = 5 %) como porcentaje presentable. **El × 100 vive
 * aquí**, en la capa de presentación, no en `diagnostico/bandas.js`: es la confusión
 * clásica de este campo y por eso el modelo devuelve fracción y solo quien presenta
 * multiplica.
 */
const porcentaje = (v) => (esNumero(v) ? `${FORMATO_2.format(v * 100)} %` : NO_CONSTA)

/** Con signo explícito: el signo de una diferencia es información, no adorno. */
function conSigno(v, formatear) {
  if (!esNumero(v)) return NO_CONSTA
  const texto = formatear(Math.abs(v))
  if (v > 0) return `+${texto}`
  if (v < 0) return `-${texto}`
  return texto
}

const coordenada = (v) => (esNumero(v) ? FORMATO_COORD.format(v) : NO_CONSTA)

/** Un par UTM `[x, y]` como `439283,23 ; 4479671,27`. */
const punto = (p) =>
  Array.isArray(p) && p.length >= 2 ? `${coordenada(p[0])} ; ${coordenada(p[1])}` : NO_CONSTA

/**
 * Fecha → `dd/mm/aaaa hh:mm (UTC)`, por COMPONENTES UTC.
 *
 * Ni se consulta el reloj ni se usa un formateador de fecha dependiente del
 * entorno: el mismo instante tiene que producir el mismo texto en CI y en el equipo
 * de quien firma (mismo razonamiento, y mismos componentes UTC, que
 * `gml/_comun.js#dateTimeCatastro`). Lleva el `(UTC)` escrito porque una hora sin
 * zona en un documento con pretensión de constancia es una hora que no significa
 * nada.
 *
 * @param {Date} fecha
 * @returns {string}
 */
function fechaLarga(fecha) {
  const dos = (n) => String(n).padStart(2, '0')
  return (
    `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()} ` +
    `${dos(fecha.getUTCHours())}:${dos(fecha.getUTCMinutes())} (UTC)`
  )
}

// ── Composición del papel ────────────────────────────────────────────────────

/** Una regla horizontal de ancho completo. */
const regla = (caracter) => caracter.repeat(ANCHO)

/**
 * Parte un texto en líneas de como mucho `ancho` columnas, sin cortar palabras.
 * Una palabra más larga que el ancho se deja sobresalir: partirla por la mitad
 * rompería una referencia catastral o una URL, y prefiero una línea larga a un dato
 * ilegible.
 *
 * @param {string} texto
 * @param {number} ancho
 * @returns {string[]}  Al menos una línea (posiblemente vacía).
 */
function envolver(texto, ancho) {
  const palabras = String(texto).split(/\s+/).filter((p) => p !== '')
  if (palabras.length === 0) return ['']
  const lineas = []
  let actual = palabras[0]
  for (let i = 1; i < palabras.length; i++) {
    if (actual.length + 1 + palabras[i].length <= ancho) {
      actual += ` ${palabras[i]}`
    } else {
      lineas.push(actual)
      actual = palabras[i]
    }
  }
  lineas.push(actual)
  return lineas
}

/** Un párrafo con sangría, envuelto al ancho útil. */
const parrafo = (texto, sangria = 2) =>
  envolver(texto, ANCHO - sangria).map((l) => ' '.repeat(sangria) + l)

/**
 * Singular o plural según la cuenta. Existe para no escribir «1 recinto(s)»: un
 * paréntesis de cortesía en un documento con pretensión de constancia se lee como
 * descuido, y aquí se leen quince tablas seguidas.
 */
const plural = (n, singular, pluralizado) => `${cuenta(n)} ${n === 1 ? singular : pluralizado}`

/**
 * Una línea `Rótulo ........... valor`, con el valor envuelto y colgado a la altura
 * de su columna. Es lo que hace que un motivo largo de omisión se lea como el valor
 * del campo y no como un párrafo suelto.
 *
 * @param {string} rotulo
 * @param {string} valor
 * @param {number} [sangria=2]
 * @returns {string[]}
 */
function campo(rotulo, valor, sangria = 2) {
  const prefijo = `${' '.repeat(sangria) + rotulo} `.padEnd(sangria + ANCHO_ROTULO, '.')
  const cuelgue = ' '.repeat(prefijo.length + 1)
  return envolver(valor, ANCHO - prefijo.length - 1).map((l, i) =>
    i === 0 ? `${prefijo} ${l}` : cuelgue + l,
  )
}

/** Una viñeta con cuelgue, para las listas de notas y hallazgos. */
function vineta(marca, texto, sangria = 4) {
  const prefijo = ' '.repeat(sangria) + marca
  const cuelgue = ' '.repeat(prefijo.length + 1)
  return envolver(texto, ANCHO - prefijo.length - 1).map((l, i) =>
    i === 0 ? `${prefijo} ${l}` : cuelgue + l,
  )
}

/** Texto sangrado y envuelto, sin marca. Para el detalle colgado de una viñeta. */
const sangrar = (texto, sangria) =>
  envolver(texto, ANCHO - sangria).map((l) => ' '.repeat(sangria) + l)

/**
 * Numerador de secciones y apartados. Existe porque el informe **no siempre tiene
 * las mismas secciones**: cuando la parcela llegó por referencia catastral no hay
 * fichero que leer y la sección 2 desaparece — y tiene que desaparecer del todo, sin
 * dejar un hueco en la numeración que haga pensar que falta una página.
 */
function crearNumerador() {
  let seccion = 0
  let apartado = 0
  return {
    seccion(texto) {
      seccion += 1
      apartado = 0
      return ['', `${seccion}. ${texto.toUpperCase()}`, regla('-'), '']
    },
    apartado(texto) {
      apartado += 1
      return [`  ${seccion}.${apartado} ${texto}`, '']
    },
  }
}

// ── Guardas de contrato ──────────────────────────────────────────────────────

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Describe un valor para un mensaje de error, sin reventar con los cíclicos. */
function describir(valor) {
  if (typeof valor === 'string') return JSON.stringify(valor)
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return `un array de ${valor.length}`
  if (typeof valor === 'object') return 'un objeto'
  return `${typeof valor} (${String(valor)})`
}

const lista = (v) => (Array.isArray(v) ? v : [])

// ── Secciones ────────────────────────────────────────────────────────────────

/**
 * La cabecera: el nombre legal, la advertencia de provisionalidad y la de que esto
 * NO es el IVG. Va ARRIBA, antes de cualquier cifra, porque quien abre el fichero y
 * lee dos líneas tiene que haberse enterado ya.
 */
function cabecera() {
  return [
    regla('='),
    'INFORME DE CONTRASTE CON EL PARCELARIO CATASTRAL',
    regla('='),
    '',
    ...parrafo(
      'VERSIÓN EN TEXTO, SIN PIE DE FIRMA. No lleva plano de situación, ni ' +
        'descripción literaria del lindero, ni firma colegiada. El documento ' +
        'firmable —plano de situación a 300 ppp, descripción literaria del lindero y ' +
        'pie de firma— se compone en esta misma herramienta con «Preparar informe ' +
        '(PDF)», en el cajón del diagnóstico: este texto no lo sustituye.',
    ),
    '',
    ...parrafo(
      'Este documento NO es la validación gráfica alternativa (VGA) ni el informe de ' +
        'validación gráfica (IVG) del Catastro. Esos son un procedimiento y un ' +
        'documento oficiales, con código seguro de verificación, que emite la Sede ' +
        'Electrónica del Catastro. Descargar este fichero no presenta nada ante nadie.',
    ),
    '',
    ...parrafo(
      'La aplicación mide; el colegiado interpreta y firma. Las cifras de este ' +
        'informe no llevan juicio de valor y no hay en él una sola conclusión: ' +
        'leerlas es trabajo de quien firma.',
    ),
  ]
}

/** Sección 1 · Identificación. */
function identificacion({ num, comprobacion, diagnostico, parcela, fecha }) {
  const fichero = esObjeto(comprobacion) ? comprobacion.fichero : null
  const elegido = miembroElegido(comprobacion)

  const refcat =
    textoONulo(parcela?.refcat) ?? textoONulo(elegido?.refcat) ?? NO_CONSTA
  const srs =
    textoONulo(parcela?.srs) ??
    textoONulo(comprobacion?.geometria?.srs) ??
    textoONulo(elegido?.srs) ??
    NO_CONSTA

  const origen = textoONulo(parcela?.origen)
  const procedencia =
    origen === null
      ? 'No consta la procedencia de la geometría.'
      : (ROTULO_ORIGEN[origen] ?? origen)

  // La procedencia es DOBLE cuando hay contraste, y decirlo importa: la geometría es
  // del usuario y el parcelario es del Catastro. Un renglón que dijera «del Catastro»
  // a secas convertiría el fichero de un tercero en un dato oficial.
  const hayOficial = diagnostico?.perimetro?.oficial != null

  const lineas = [
    ...campo('Fecha del informe', fechaLarga(fecha)),
    ...campo('Referencia catastral', refcat),
    ...campo('Sistema de referencia', srs),
    ...campo('Procedencia de la geometría', procedencia),
    ...campo(
      'Procedencia del parcelario',
      hayOficial
        ? 'Contorno oficial descargado del Catastro, conservado intacto'
        : 'No se ha traído el contorno oficial del Catastro',
    ),
  ]

  if (esObjeto(fichero)) {
    const bytes = esNumero(fichero.bytes) ? ` (${cuenta(fichero.bytes)} bytes)` : ''
    lineas.push(
      ...campo('Fichero de origen', `${textoONulo(fichero.nombre) ?? NO_CONSTA}${bytes}`),
    )
  } else {
    lineas.push(
      ...campo('Fichero de origen', 'La parcela no se ha cargado de un fichero GML.'),
    )
  }

  return [...num.seccion('Identificación'), ...lineas]
}

/** El miembro elegido del fichero, o `null`. */
function miembroElegido(comprobacion) {
  if (!esObjeto(comprobacion)) return null
  const miembros = lista(comprobacion.miembros)
  const i = comprobacion.elegido
  return esNumero(i) && miembros[i] ? miembros[i] : null
}

/** Un string no vacío, o `null`. Evita que un `''` pase por dato. */
const textoONulo = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null)

/** Cuántas referencias de vértice se enumeran antes de resumir el resto. */
const MAX_VERTICES_CITADOS = 12

/**
 * Las referencias `{recinto, indice}` de un Hallazgo, en texto y **1-based**, que
 * es como se numeran los vértices para el humano en toda la aplicación.
 *
 * Existe porque los mensajes de `validation/` NO nombran los vértices: dicen
 * «Vértices consecutivos duplicados (distancia < 1 mm)» y ponen el CUÁL en
 * `verticesAfectados`, para que el visor los resalte en el mapa. En un informe de
 * texto no hay nada que resaltar, así que si esa lista no se imprime el dato se
 * pierde — y con él, el único modo que tiene el lector de ir a corregirlo.
 *
 * Se enumeran hasta {@link MAX_VERTICES_CITADOS} y se dice cuántos quedan: una
 * geometría con quinientos duplicados no debe producir una línea de quinientos
 * números, pero tampoco puede callarse que hay quinientos.
 */
function refsVertices(refs) {
  const porRecinto = new Map()
  for (const r of lista(refs)) {
    if (!esNumero(r?.recinto) || !esNumero(r?.indice)) continue
    if (!porRecinto.has(r.recinto)) porRecinto.set(r.recinto, [])
    porRecinto.get(r.recinto).push(r.indice + 1)
  }
  const partes = []
  for (const [recinto, indices] of porRecinto) {
    const citados = indices.slice(0, MAX_VERTICES_CITADOS)
    const resto = indices.length - citados.length
    partes.push(
      `${rotuloRecinto(recinto).toLowerCase()}, ` +
        `${citados.length === 1 ? 'vértice' : 'vértices'} ${citados.join(', ')}` +
        (resto > 0 ? ` y ${cuenta(resto)} más` : ''),
    )
  }
  return partes.join(' · ')
}

/**
 * Una lista de detecciones o de hallazgos, con su severidad DELANTE. Digiere las
 * dos formas que llegan a este informe sin adaptador, porque son dos vocabularios
 * distintos que dicen lo mismo: `DeteccionGml` (`{tipo, mensaje, severidad}`, de
 * `gml/`) y `Hallazgo` (`{nivel, mensaje, verticesAfectados, correccion}`, de
 * `validation/`). La severidad va delante porque una nota sin severidad se lee con
 * el tono de quien la lee, no con el de quien la escribió.
 *
 * El `mensaje` se copia LITERAL: es de otra capa, la redactó quien sabe por qué, y
 * reescribirlo aquí crearía una segunda versión que puede divergir (regla de oro 1).
 */
function detecciones(detecciones_, vacio) {
  const items = lista(detecciones_)
  if (items.length === 0) return [`    ${vacio}`]
  return items.flatMap((d) => {
    const severidad = textoONulo(d?.severidad) ?? textoONulo(d?.nivel) ?? 'INFO'
    const partes = [textoONulo(d?.mensaje) ?? 'Detección sin mensaje.']
    const donde = refsVertices(d?.verticesAfectados)
    if (donde !== '') partes.push(`— ${donde}`)
    // `correccion` solo viene en los ERROR de F02, y lleva el VERBO de la acción
    // («Eliminar vértice duplicado», no «Corregir»). En un informe que alguien va a
    // leer lejos de la pantalla es la mitad útil del hallazgo.
    const correccion = textoONulo(d?.correccion)
    if (correccion !== null) partes.push(`— ${correccion}`)
    const tipo = textoONulo(d?.tipo)
    if (tipo !== null) partes.push(`(${tipo})`)
    return vineta(`[${severidad.padEnd(5)}]`, partes.join(' '))
  })
}

/**
 * Sección 2 · Qué se leyó del fichero. **Solo existe si hubo fichero**: cuando la
 * parcela llegó por referencia catastral, `comprobacion` es `null` y esta sección no
 * se emite (ni como epígrafe vacío: un epígrafe con «no procede» debajo es un hueco
 * raro con otro nombre).
 */
function queSeLeyo({ num, comprobacion }) {
  const dialecto = esObjeto(comprobacion.dialecto) ? comprobacion.dialecto : {}
  const fichero = esObjeto(comprobacion.fichero) ? comprobacion.fichero : {}
  const miembros = lista(comprobacion.miembros)
  const elegido = miembroElegido(comprobacion)

  const salida = [...num.seccion('Qué se leyó del fichero')]

  salida.push(
    ...campo(
      'Dialecto',
      textoONulo(dialecto.etiqueta) ?? textoONulo(dialecto.id) ?? NO_CONSTA,
    ),
  )
  if (textoONulo(dialecto.queSignifica) !== null) {
    salida.push(...campo('Qué significa', dialecto.queSignifica))
  }
  if (typeof dialecto.soportado === 'boolean') {
    salida.push(
      ...campo(
        'Soporte de la aplicación',
        // CAPACIDAD, no mérito, y por eso se redacta en primera persona de la
        // herramienta. Y sin añadirle consecuencias: un GML 3.0 no soportado sí
        // enseña su parcela y uno de edificio no, así que la frase que valdría para
        // el uno mentiría sobre el otro. Lo que pasa en cada caso lo cuenta
        // `queSignifica`, que llega redactado por quien lo sabe.
        dialecto.soportado
          ? 'La aplicación soporta este dialecto.'
          : 'La aplicación no soporta este dialecto.',
      ),
    )
  }
  salida.push(
    ...campo('Codificación declarada', textoONulo(fichero.encodingDeclarado) ?? NO_CONSTA),
    ...campo('Codificación empleada', textoONulo(fichero.encodingUsado) ?? NO_CONSTA),
  )

  // `puedeContinuar` es CAPACIDAD DE LA APLICACIÓN, no mérito de la parcela — el
  // mismo estatuto que `puedeGenerar` de F02. Por eso se redacta en primera persona
  // de la herramienta y nunca como un dictamen sobre el fichero.
  if (typeof comprobacion.puedeContinuar === 'boolean') {
    salida.push(
      ...campo(
        'Continuación',
        comprobacion.puedeContinuar
          ? 'La aplicación puede contrastar esta parcela con el parcelario.'
          : `La aplicación no puede contrastar esta parcela: ` +
              `${textoONulo(comprobacion.motivoNoContinua) ?? 'no se ha indicado el motivo.'}`,
      ),
    )
  }

  // ── Las parcelas del fichero ───────────────────────────────────────────────
  // Se ELIGE una, nunca se unen. Las demás se listan porque quedan en el fichero y
  // el usuario tiene derecho a saber que están ahí y que no entran en este informe.
  //
  // ⚠️ El motivo ya NO es «multiparcela está fuera de alcance (SPEC §1)»: eso
  // caducó el 2026-08-03 con el override O18. Es que **este informe describe UNA
  // parcela**, y por eso la lista con su `<-- ELEGIDA` es imprescindible y no
  // decorativa — es lo único que impide leer el papel como si abarcara el fichero
  // entero. F17 traslada exactamente este patrón al PDF firmable.
  salida.push('', `  Parcelas que trae el fichero: ${plural(miembros.length, 'parcela', 'parcelas')}`)
  if (miembros.length === 0) {
    salida.push('    El fichero no trae parcelas legibles.')
  }
  for (const m of miembros) {
    const i = esNumero(m?.indice) ? m.indice : miembros.indexOf(m)
    const marca = elegido === m ? '  <-- ELEGIDA' : ''
    const etiqueta =
      textoONulo(m?.etiqueta) ?? textoONulo(m?.refcat) ?? textoONulo(m?.localId) ?? 'Sin etiqueta'
    salida.push(...vineta(`nº ${i + 1}`, `${etiqueta}${marca}`))
    const detalle = [
      plural(m?.nVertices, 'vértice', 'vértices'),
      plural(m?.nHuecos, 'hueco', 'huecos'),
      textoONulo(m?.srs) ?? NO_CONSTA,
    ]
    salida.push(...sangrar(detalle.join(' · '), 9))
    // C1: las DOS superficies del propio FICHERO, con nombre distinto del que llevan
    // las del parcelario en la sección del contraste. Confundirlas sería atribuir al
    // Catastro un número que declara un tercero.
    salida.push(
      ...sangrar(
        `Superficie que declara el fichero: ${m2Entero(m?.superficieDeclarada)} · ` +
          `medida sobre sus propias coordenadas: ${m2(m?.superficieMedida)}`,
        9,
      ),
    )
    const orientacion = textoOrientacion(m?.orientacionExterior)
    if (orientacion !== null) {
      salida.push(...sangrar(`Sentido del contorno exterior: ${orientacion}.`, 9))
    }
  }

  // ── Notas, bloqueos y geometría ────────────────────────────────────────────
  salida.push('', '  Notas de la lectura')
  salida.push(...detecciones(comprobacion.notas, 'Sin notas.'))

  salida.push('', '  Bloqueos')
  salida.push(...detecciones(comprobacion.bloqueos, 'Sin bloqueos.'))

  salida.push('', '  Geometría de la parcela elegida')
  if (comprobacion.hallazgos === null || comprobacion.hallazgos === undefined) {
    salida.push('    No se ha revisado la geometría.')
  } else {
    salida.push(...detecciones(comprobacion.hallazgos, 'Sin hallazgos que reseñar.'))
  }

  return salida
}

/**
 * El sentido de giro del contorno exterior, que es una NOTA y jamás un error
 * (override O1, matizado: el exterior horario es CONVENCIÓN, no requisito; la
 * plantilla oficial del Catastro va antihoraria).
 */
function textoOrientacion(valor) {
  const CONVENCION = ' (el WFS lo emite horario; la plantilla oficial, antihorario: es convención)'
  if (valor === -1) return `horario${CONVENCION}`
  if (valor === 1) return `antihorario${CONVENCION}`
  const texto = textoONulo(valor)
  return texto === null ? null : `${texto}${CONVENCION}`
}

/** El motivo de una sección que no se pudo medir, tal como lo redactó el modelo. */
function motivoOmision(diagnostico, que) {
  const omision = lista(diagnostico?.omisiones).find((o) => o?.que === que)
  return textoONulo(omision?.motivo) ?? 'No se ha medido, y el diagnóstico no dice por qué.'
}

/** Sección 3 · El contraste: las once secciones de `diagnosticar()`, rotuladas. */
function contraste({ num, diagnostico }) {
  const d = diagnostico
  const salida = [...num.seccion('Contraste con el parcelario')]

  // ── 1 · superficie ─────────────────────────────────────────────────────────
  const s = esObjeto(d.superficie) ? d.superficie : {}
  salida.push(...num.apartado('Superficies'))
  // Las CUATRO, cada una con su nombre entero: confundirlas es el error de fondo
  // que este apartado existe para impedir.
  salida.push(
    ...tabla(
      ['Concepto', 'Superficie'],
      [
        ['Medida sobre la geometría de la parcela', m2(s.medida)],
        ['Declarada por el Catastro (cp:areaValue)', m2Entero(s.catastral)],
        ['Medida sobre el contorno oficial del Catastro', m2(s.oficial)],
        ['Registral, de la escritura', m2(s.registral)],
      ],
      4,
    ),
  )
  salida.push('')
  salida.push(
    ...parrafo(
      'Las dos cifras del Catastro no son la misma y no deben confundirse: la ' +
        'DECLARADA es el cp:areaValue que publica el parcelario, y la MEDIDA SOBRE EL ' +
        'CONTORNO OFICIAL es lo que esta aplicación mide sobre las coordenadas que ' +
        'emite ese mismo parcelario. Que difieran es el dato, no un fallo.',
      4,
    ),
  )

  // ── 2 · perimetro ──────────────────────────────────────────────────────────
  const p = esObjeto(d.perimetro) ? d.perimetro : {}
  salida.push('', ...num.apartado('Perímetros'))
  salida.push(...tablaPerimetros(p))

  // ── 3 · bandas ─────────────────────────────────────────────────────────────
  salida.push('', ...num.apartado('Comparación a tres bandas'))
  salida.push(
    ...parrafo(
      'Los tres pares salen siempre y en orden fijo, aunque falte con qué ' +
        'calcularlos: una fila ausente se leería como «esto no hacía falta mirarlo» y ' +
        'una fila con «No consta» dice lo que de verdad pasa. El signo es ' +
        'información: «Medición - Catastro» negativo significa que se ha medido menos ' +
        'de lo que declara el Catastro.',
      4,
    ),
  )
  salida.push('')
  salida.push(...tablaBandas(d.bandas))

  // ── 4 · solape ─────────────────────────────────────────────────────────────
  salida.push('', ...num.apartado('Solape con el contorno oficial'))
  if (!esObjeto(d.solape)) {
    salida.push(...parrafo(motivoOmision(d, OMISION_CONOCIDA.SOLAPE), 4))
  } else {
    salida.push(
      ...campo('Superficie común', m2(d.solape.area), 4),
      ...campo(
        'Sobre la mayor de las dos',
        porcentaje(d.solape.relativo),
        4,
      ),
      ...campo('Piezas disjuntas', cuenta(d.solape.nPiezas), 4),
    )
  }

  // ── 5 · diferencia ─────────────────────────────────────────────────────────
  salida.push('', ...num.apartado('Diferencia con el contorno oficial'))
  if (!esObjeto(d.diferencia)) {
    salida.push(...parrafo(motivoOmision(d, OMISION_CONOCIDA.DIFERENCIA), 4))
  } else {
    salida.push(
      ...campo('Superficie no común', m2(d.diferencia.area), 4),
      '',
      ...parrafo(
        'Diferencia simétrica: la superficie que está en uno de los dos contornos y ' +
          'no en el otro, sumando los dos sentidos.',
        4,
      ),
    )
  }

  // ── 6 · centroides ─────────────────────────────────────────────────────────
  salida.push('', ...num.apartado('Desplazamiento de centroides'))
  if (!esObjeto(d.centroides)) {
    salida.push(...parrafo(motivoOmision(d, OMISION_CONOCIDA.CENTROIDES), 4))
  } else {
    salida.push(
      ...campo('Centroide de la medición', punto(d.centroides.medido), 4),
      ...campo('Centroide del oficial', punto(d.centroides.oficial), 4),
      ...campo('Distancia entre ambos', metros(d.centroides.distancia), 4),
    )
  }

  // ── 7 · desviacion ─────────────────────────────────────────────────────────
  salida.push('', ...num.apartado('Desviación de lindero, lado a lado'))
  salida.push(...bloqueDesviacion(d))

  // ── 8 · invasion ───────────────────────────────────────────────────────────
  salida.push('', ...num.apartado('Invasión a colindantes'))
  salida.push(...bloqueInvasion(d.invasion))

  // ── 9 · margen ─────────────────────────────────────────────────────────────
  salida.push('', ...num.apartado('Margen oficial de identidad'))
  salida.push(...bloqueMargen(d))

  // ── 10 · omisiones ─────────────────────────────────────────────────────────
  salida.push('', ...num.apartado('Lo que no se ha podido medir'))
  const omisiones = lista(d.omisiones)
  if (omisiones.length === 0) {
    salida.push('    Se ha podido medir todo lo que este informe recoge.')
  } else {
    salida.push(
      ...parrafo(
        'Las secciones siguientes no se han medido. El motivo de cada una va escrito ' +
          'en su propio apartado, en el sitio de la cifra que falta.',
        4,
      ),
      '',
    )
    for (const o of omisiones) {
      const que = textoONulo(o?.que) ?? '(sin identificar)'
      salida.push(...vineta('·', ROTULO_OMISION[que] ?? que))
    }
  }

  // ── 11 · saltados ──────────────────────────────────────────────────────────
  salida.push('', ...num.apartado('Recintos que no se han podido medir'))
  const saltados = lista(d.saltados)
  if (saltados.length === 0) {
    salida.push('    Se han medido todos los recintos.')
  } else {
    salida.push(
      ...parrafo(
        'Estos recintos han quedado fuera de alguna medición. No desaparecen en ' +
          'silencio: aquí están, con su sitio y su motivo.',
        4,
      ),
      '',
    )
    for (const x of saltados) {
      const donde = textoONulo(x?.donde) ?? '(sin sitio)'
      const indice = esNumero(x?.indice) ? `[${x.indice}]` : ''
      const motivo = MOTIVO_SALTADO[x?.motivo] ?? `motivo ${textoONulo(x?.motivo) ?? NO_CONSTA}`
      salida.push(
        ...vineta('·', `${donde}${indice}, ${cuenta(x?.nVertices)} vértices: ${motivo}.`),
      )
    }
  }

  return salida
}

/** La tabla de perímetros: exterior / huecos / total, medido y oficial. */
function tablaPerimetros(p) {
  const filas = [
    ['Medición', p.medido],
    ['Contorno oficial', p.oficial],
  ]
  const celdas = filas.map(([rotulo, v]) => [
    rotulo,
    v == null ? NO_CONSTA : metros(v.exterior),
    v == null ? NO_CONSTA : metros(v.huecos),
    v == null ? NO_CONSTA : metros(v.total),
  ])
  const cabeceras = ['', 'Exterior', 'Huecos', 'Total']
  return tabla(cabeceras, celdas, 4)
}

/** La tabla a tres bandas: los tres pares cruzados, en el orden que fija el modelo. */
function tablaBandas(bandas) {
  const cruces = lista(bandas?.cruces)
  if (cruces.length === 0) return ['    No hay comparación a tres bandas que mostrar.']
  const filas = cruces.map((c) => [
    `${ROTULO_BANDA[c?.a] ?? c?.a} - ${ROTULO_BANDA[c?.b] ?? c?.b}`,
    conSigno(c?.absoluto, m2),
    conSigno(c?.relativo, porcentaje),
  ])
  return tabla(['Par', 'Diferencia', 'Relativa'], filas, 4)
}

/**
 * Una tabla alineada con espacios. **Sin tuberías de Markdown**: una tabla de
 * tuberías se rompe en cuanto una celda no cabe y depende de que alguien la
 * renderice; este fichero se abre en un bloc de notas.
 *
 * Por defecto la primera columna va a la izquierda (son rótulos) y el resto a la
 * derecha (son cifras, y las cifras se comparan por su última posición). La regla
 * bajo la cabecera se dimensiona con la línea REAL más larga, no con la suma de
 * anchos: una columna cuyas celdas casi siempre están vacías —la marca del lado de
 * máxima desviación, por ejemplo— dejaría si no una regla flotando en el aire.
 *
 * @param {string[]} cabeceras
 * @param {Array<Array<string>>} filas
 * @param {number} sangria
 * @param {number[]} [izquierda=[0]]  Índices de las columnas alineadas a la
 *   izquierda. `[]` alinea todas a la derecha (la tabla de vértices: ahí la primera
 *   columna también es un número).
 * @returns {string[]}
 */
function tabla(cabeceras, filas, sangria, izquierda = [0]) {
  const nColumnas = cabeceras.length
  const anchos = []
  for (let c = 0; c < nColumnas; c++) {
    anchos[c] = Math.max(cabeceras[c].length, ...filas.map((f) => String(f[c] ?? '').length))
  }
  const componer = (celdas) =>
    (
      ' '.repeat(sangria) +
      celdas
        .map((celda, c) =>
          izquierda.includes(c)
            ? String(celda ?? '').padEnd(anchos[c])
            : String(celda ?? '').padStart(anchos[c]),
        )
        .join('  ')
    ).trimEnd()

  const lineas = [componer(cabeceras), ...filas.map(componer)]
  const ancho = Math.max(...lineas.map((l) => l.length)) - sangria
  return [lineas[0], ' '.repeat(sangria) + '-'.repeat(ancho), ...lineas.slice(1)]
}

/** Rótulo de un recinto: el 0 es el exterior, el resto huecos (1-based para leer). */
const rotuloRecinto = (i) => (i === 0 ? 'Exterior' : `Hueco ${i}`)

/**
 * La desviación de lindero, **con el lado señalado**. Va desglosada lado a lado y no
 * como una cifra única a propósito: la máxima sin culpable no se puede acotar sobre
 * un plano ni corregir sobre el terreno.
 */
function bloqueDesviacion(d) {
  if (!esObjeto(d.desviacion)) {
    return parrafo(motivoOmision(d, OMISION_CONOCIDA.DESVIACION), 4)
  }
  const { porLado, maxima, nMuestras } = d.desviacion
  const lados = lista(porLado)
  const salida = []

  if (!esObjeto(maxima)) {
    salida.push(
      ...parrafo(
        'La desviación máxima no se ha podido atribuir a un lado concreto: o no hay ' +
          'lados medibles, o no hay contorno oficial contra el que medirlos.',
        4,
      ),
    )
  } else {
    salida.push(
      ...campo('Desviación máxima', metros(maxima.maxima), 4),
      ...campo(
        'Lado que la produce',
        `lado ${maxima.indice + 1} del ${rotuloRecinto(maxima.recinto).toLowerCase()}`,
        4,
      ),
      ...campo('Punto de la medición', punto(maxima.en), 4),
      ...campo('Su homólogo del oficial', punto(maxima.enOficial), 4),
    )
  }
  salida.push(...campo('Muestras tomadas', cuenta(nMuestras), 4))
  salida.push(
    '',
    ...parrafo(
      'Es el máximo, lado a lado, de la distancia mínima de cada muestra al contorno ' +
        'oficial completo. Se muestrea cada 0,30 m sobre el terreno y los dos extremos ' +
        'de cada lado entran siempre, así que la cifra puede quedarse hasta 0,15 m por ' +
        'debajo del máximo continuo. La medida es dirigida (de la medición al oficial) ' +
        'y por tanto asimétrica.',
      4,
    ),
  )

  if (lados.length > 0) {
    salida.push('', '    Desviación de cada lado')
    const filas = lados.map((l) => [
      `${rotuloRecinto(l.recinto)}, lado ${l.indice + 1}`,
      metros(l.maxima),
      l === maxima ? '<-- máxima' : '',
    ])
    salida.push(...tabla(['Lado', 'Desviación', ''], filas, 4))
  }
  return salida
}

/**
 * La invasión a colindantes: la ÚNICA excepción de la regla de oro 9 en todo el
 * proyecto, porque es un hecho topológico binario con consecuencia fija.
 *
 * ⛔ Con `consultado: false` **jamás** se escribe «ninguna». «No se ha consultado» y
 * «no hay invasión» son afirmaciones opuestas, y la falsa es la que tranquiliza: es
 * el error silencioso más caro que este informe podría cometer, porque acabaría
 * firmado.
 */
function bloqueInvasion(invasion) {
  if (!esObjeto(invasion)) {
    return parrafo('El diagnóstico no trae la sección de invasión a colindantes.', 4)
  }
  if (invasion.consultado !== true) {
    return parrafo(
      'No se ha consultado. Este informe no dice nada sobre si la parcela invade a ' +
        'sus colindantes: para saberlo hay que traer del Catastro las parcelas ' +
        'vecinas y volver a diagnosticar.',
      4,
    )
  }

  const salida = []
  const hallazgos = lista(invasion.invasiones)
  if (hallazgos.length === 0) {
    salida.push(
      ...parrafo(
        'Se han consultado las parcelas colindantes y no comparte superficie con ninguna.',
        4,
      ),
    )
  } else {
    salida.push(
      ...parrafo('Se ha consultado. La parcela comparte superficie con:', 4),
      '',
    )
    for (const h of hallazgos) {
      salida.push(
        ...vineta('·', `${textoONulo(h?.refcat) ?? 'parcela sin referencia'}: ${m2(h?.area)}`),
      )
    }
  }

  const descartadas = lista(invasion.descartadas)
  if (descartadas.length > 0) {
    const total = descartadas.reduce((s, x) => s + (esNumero(x?.area) ? x.area : 0), 0)
    const grosor = Math.max(...descartadas.map((x) => (esNumero(x?.grosor) ? x.grosor : 0)))
    salida.push(
      '',
      ...parrafo(
        `Se han descartado ${plural(descartadas.length, 'solape', 'solapes')} que suman ` +
          `${m2(total)}, el más grueso de ${FORMATO_COORD.format(grosor * 1000)} mm: son ` +
          'astillas de redondeo del lindero compartido, no superficie. Se dejan ' +
          'escritas para que el criterio se pueda auditar.',
        4,
      ),
    )
  }
  return salida
}

/**
 * El margen del BOE, que se ENUNCIA. Aquí está la línea más fácil de cruzar de todo
 * el informe: bastaría comparar la cifra de arriba con la de al lado para convertir
 * una capa informativa en el veredicto que la spec prohíbe. No se hace, y el propio
 * texto dice que no se hace.
 */
function bloqueMargen(d) {
  if (!esObjeto(d.margen)) {
    return parrafo(motivoOmision(d, OMISION_CONOCIDA.MARGEN), 4)
  }
  const m = d.margen
  const clase = textoONulo(m.clase) ?? NO_CONSTA
  // La ETIQUETA llega dentro del propio diagnóstico —viaja con la cifra justo para
  // que no se pueda escribir la una sin la otra— y se ENUNCIA en una frase, no como
  // el rótulo de un campo: un rótulo invita a poner al lado el valor con el que se
  // compara, y aquí no se compara con nada.
  const etiqueta = textoONulo(m.etiqueta) ?? 'margen de identidad del Catastro'
  const salida = [
    ...parrafo(
      `${etiqueta.charAt(0).toUpperCase()}${etiqueta.slice(1)} en clase ${clase}: ` +
        `±${metros(m.perimetroM)} de perímetro y ${porcentaje(m.superficieRelativo)} de ` +
        'superficie.',
      4,
    ),
    '',
    ...campo(
      'Clase de suelo',
      `${clase}` +
        (m.deducida ? ' (propuesta por la aplicación, no elegida por una persona)' : ' (elegida)'),
      4,
    ),
  ]
  if (textoONulo(m.criterio) !== null) {
    salida.push(...campo('Criterio de la propuesta', m.criterio, 4))
  }
  salida.push(
    '',
    ...parrafo(
      'Fuente: BOE-A-2020-12111. Es un criterio de IDENTIDAD —si se está hablando de ' +
        'la misma finca— y no una calificación del levantamiento. Este informe lo ' +
        'ENUNCIA y no lo enfrenta a las cifras de arriba: esa lectura es del ' +
        'colegiado que firma. Una discrepancia grande significa a menudo que la ' +
        'geometría catastral está mal, y ése suele ser el motivo por el que se abre ' +
        'el expediente.',
      4,
    ),
  )
  return salida
}

/** Sección 4 · La relación de vértices con sus coordenadas. */
function relacionVertices({ num, comprobacion, parcela, srs }) {
  const recintos = recintosDe(parcela, comprobacion)
  const salida = [...num.seccion('Relación de vértices')]

  if (recintos.length === 0) {
    salida.push('  No consta la geometría de la parcela.')
    return salida
  }

  const total = recintos.reduce((s, r) => s + lista(r?.vertices).length, 0)
  salida.push(
    ...parrafo(
      `Coordenadas en ${srs}, en metros, con dos decimales. Los anillos van ABIERTOS: ` +
        'el último vértice no repite el primero, que es como los guarda el modelo y ' +
        `como se numeran aquí. Total: ${plural(total, 'vértice', 'vértices')} en ` +
        `${plural(recintos.length, 'recinto', 'recintos')}.`,
    ),
  )

  recintos.forEach((r, i) => {
    const vertices = lista(r?.vertices)
    salida.push('', `  ${rotuloRecinto(i)} — ${plural(vertices.length, 'vértice', 'vértices')}`, '')
    if (vertices.length === 0) {
      salida.push('    Este recinto no tiene vértices.')
      return
    }
    const filas = vertices.map((v, k) => [
      String(k + 1),
      coordenada(v?.[0]),
      coordenada(v?.[1]),
    ])
    // Todas las columnas a la derecha: aquí la primera también es un número.
    salida.push(...tabla(['Nº', 'X (m)', 'Y (m)'], filas, 4, []))
  })

  return salida
}

/**
 * De dónde salen los vértices: del modelo si lo hay, y si no, de la geometría que
 * leyó la comprobación. Las dos son la MISMA geometría en el recorrido de F08; se
 * admiten las dos para que el informe se pueda emitir también cuando la parcela
 * todavía no ha entrado en el store.
 */
function recintosDe(parcela, comprobacion) {
  const delModelo = lista(parcela?.recintos)
  if (delModelo.length > 0) return delModelo
  return lista(comprobacion?.geometria?.recintos)
}

/** Sección final · el desmentido, otra vez y en el sitio donde se firma. */
function pie({ num }) {
  return [
    ...num.seccion('Nota final'),
    ...parrafo(
      'Este documento es la VERSIÓN EN TEXTO del informe de contraste y NO LLEVA PIE ' +
        'DE FIRMA. No tiene plano de situación, ni descripción literaria del lindero, ' +
        'ni número de colegiado, ni código de verificación. El documento firmable que ' +
        'sí los lleva se compone con «Preparar informe (PDF)», en el cajón del ' +
        'diagnóstico. Ninguno de los dos es la validación gráfica alternativa (VGA) ni ' +
        'el informe de validación gráfica (IVG) del Catastro, que emite su Sede ' +
        'Electrónica.',
    ),
    '',
    ...parrafo(
      'La aplicación mide; el colegiado interpreta y firma. Aquí no hay una sola ' +
        'conclusión sobre las cifras, y no la hay a propósito.',
    ),
    '',
    regla('='),
  ]
}

// ── La función pública ───────────────────────────────────────────────────────

/**
 * El informe de contraste con el parcelario catastral, en TEXTO PLANO (contrato E
 * del plan de F08).
 *
 * ```js
 * const texto = informeContrasteTexto({
 *   comprobacion,   // la de `comprobacion/gml.js`, o null si la parcela vino por RC
 *   diagnostico,    // lo que devuelve `diagnostico/parcela.js#diagnosticar`
 *   parcela,        // el POJO de `model/parcela.js`
 *   fecha,          // INYECTADA: este módulo no consulta el reloj
 * })
 * ```
 *
 * Pensado para leerse en fuente MONOESPACIADA: las columnas se alinean con espacios
 * y no hay una sola tubería de Markdown (ver {@link tabla}). Los números van en
 * formato español, con coma decimal.
 *
 * ### Qué garantiza este texto
 *
 *   · **Nombre legal.** «Informe de contraste con el parcelario catastral», y dice
 *     de sí mismo que no es el VGA/IVG del Catastro.
 *   · **Qué NO es.** Dice, arriba y abajo, que es la versión en texto, que no lleva
 *     plano, ni descripción del lindero, ni pie de firma, y **remite** al documento
 *     firmable por el nombre del botón que lo compone: «Preparar informe (PDF)».
 *   · **Ninguna cifra con juicio de valor** (SPEC §2, regla 9). El margen del BOE se
 *     enuncia y no se compara. La única excepción es la invasión a colindante.
 *   · **`null` es «No consta», nunca 0**, y «no se ha consultado» nunca es «ninguna».
 *
 * @param {Object} entrada
 * @param {Object|null} [entrada.comprobacion=null]  La `Comprobacion` de
 *   `comprobacion/gml.js`. **`null` es un caso legítimo y frecuente**: la parcela
 *   llegó por referencia catastral y no hubo fichero que comprobar. Entonces la
 *   sección «Qué se leyó del fichero» **no se emite** y las demás se renumeran, sin
 *   dejar hueco.
 * @param {Object} entrada.diagnostico  Lo que devuelve
 *   `diagnostico/parcela.js#diagnosticar`. Obligatorio: sin él no hay informe.
 * @param {Object|null} [entrada.parcela=null]  El POJO de `model/parcela.js`
 *   (`refcat`, `origen`, `recintos`…), del que salen la identificación y la relación
 *   de vértices. Se admite `null` para poder emitir el informe antes de que la
 *   parcela entre en el store; entonces los vértices salen de `comprobacion.geometria`.
 * @param {Date} entrada.fecha  Instante que se estampa en la cabecera. **OBLIGATORIO
 *   y por parámetro**: este módulo no consulta la marca de tiempo del sistema, para
 *   que su salida sea función pura de su entrada (ver la cabecera del fichero).
 * @returns {string}  El informe completo, con `\n` como separador de línea y sin
 *   salto final.
 * @throws {TypeError} Contrato del programador: `entrada` que no es objeto,
 *   `diagnostico` ausente o que no es objeto, `comprobacion`/`parcela` que no son
 *   objeto ni `null`, o `fecha` que no es una fecha.
 * @throws {RangeError} Si `fecha` es una fecha inválida (tiempo no finito).
 */
export function informeContrasteTexto(entrada) {
  if (!esObjeto(entrada)) {
    throw new TypeError(
      `informeContrasteTexto: se espera un objeto ` +
        `{comprobacion, diagnostico, parcela, fecha}; recibido ${describir(entrada)}.`,
    )
  }

  const { comprobacion = null, diagnostico, parcela = null, fecha } = entrada

  if (!esObjeto(diagnostico)) {
    throw new TypeError(
      `informeContrasteTexto: 'diagnostico' debe ser el objeto que devuelve ` +
        `diagnosticar(); recibido ${describir(diagnostico)}.`,
    )
  }
  if (comprobacion !== null && !esObjeto(comprobacion)) {
    throw new TypeError(
      `informeContrasteTexto: 'comprobacion' debe ser una Comprobacion o null ` +
        `(null = la parcela no vino de un fichero); recibido ${describir(comprobacion)}.`,
    )
  }
  if (parcela !== null && !esObjeto(parcela)) {
    throw new TypeError(
      `informeContrasteTexto: 'parcela' debe ser el POJO del modelo o null; ` +
        `recibido ${describir(parcela)}.`,
    )
  }
  if (!(fecha instanceof Date)) {
    throw new TypeError(
      `informeContrasteTexto: 'fecha' debe ser una fecha; recibido ${describir(fecha)}. ` +
        'El informe no consulta el reloj: la fecha entra por parámetro.',
    )
  }
  if (!Number.isFinite(fecha.getTime())) {
    throw new RangeError("informeContrasteTexto: 'fecha' es inválida (tiempo no finito).")
  }

  const num = crearNumerador()
  const srs =
    textoONulo(parcela?.srs) ??
    textoONulo(comprobacion?.geometria?.srs) ??
    textoONulo(miembroElegido(comprobacion)?.srs) ??
    NO_CONSTA

  const lineas = [
    ...cabecera(),
    ...identificacion({ num, comprobacion, diagnostico, parcela, fecha }),
    // La sección del fichero SOLO existe si hubo fichero. Ver {@link queSeLeyo}.
    ...(comprobacion === null ? [] : queSeLeyo({ num, comprobacion })),
    ...contraste({ num, diagnostico }),
    ...relacionVertices({ num, comprobacion, parcela, srs }),
    ...pie({ num }),
  ]

  return lineas.join('\n')
}
