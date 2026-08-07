// report/maqueta.js — F14 · EL MOTOR DE MAQUETA QUE COMPARTEN LOS DOS INFORMES.
//
// Todo lo de aquí vivía DENTRO de `report/pdf-parcela.js` desde F09, y estaba bien
// mientras hubo un solo informe. F14 trae el segundo —el de construcción— y con él
// la pregunta de siempre: ¿se copia el motor o se saca? Se saca, y el motivo no es
// el ahorro de líneas:
//
// ⭐ **Dos maquetadores son dos documentos que se van separando sin que nadie lo
// note.** Los dos informes se firman, se fotocopian y se archivan juntos en el
// mismo expediente; que el de parcela numere «Página 1 de 5» y el de edificio lo
// numere dos milímetros más abajo, o que uno diga «No consta» y el otro deje un
// hueco, es la clase de divergencia que no rompe ninguna prueba y que solo se ve
// cuando los dos papeles están encima de la mesa. Lo mismo que este repo lleva
// diciendo desde F00 de las cifras —una segunda implementación es una segunda
// verdad— vale para la tipografía de un documento que alguien suscribe.
//
// ── QUÉ ENTRA AQUÍ, Y QUÉ SE QUEDA EN CADA INFORME ───────────────────────────
// Entra lo que es **del papel**: las medidas del A4, la escala tipográfica, los
// grises, el cursor que sabe saltar de página, las tablas que repiten cabecera, los
// formateadores en español, el pie con «Página N de M» y las tres secciones que los
// dos documentos comparten palabra por palabra —el plano, la firma y la nota de
// composición—.
//
// Se queda fuera lo que es **del asunto**: qué secciones hay, en qué orden, qué
// dice cada una y **cómo se llama el documento**. `report/pdf-parcela.js` describe
// una parcela y `report/pdf-edificio.js` una construcción; comparten el papel, no
// el contenido.
//
// ── ⛔ ESTE MÓDULO NO SALE POR EL BARREL ─────────────────────────────────────
// Es el `gml/xml.js` de esta capa, y le vale letra por letra el argumento que
// `report/index.js` escribió en su decisión 3 para `crearDocumentoPdf`: publicarlo
// invita a COMPONER INFORMES A MANO por fuera de las dos funciones que guardan el
// nombre legal del documento, la ausencia de siglas oficiales y la regla de oro 9.
// Quien necesite el motor lo importa directamente, y entonces se le ve.
// Lo vigila `test/contrato.test.js`.
//
// ── LO QUE SE PARAMETRIZÓ AL SACARLO, Y POR QUÉ SOLO ESO ─────────────────────
// La extracción es un MOVIMIENTO, no una reescritura: el criterio de aceptación de
// la fase fue que el PDF de parcela no cambiara **ni un byte**. Solo tres cosas
// tuvieron que dejar de estar cableadas:
//
//   1. {@link portada} recibe el NOMBRE del documento y sus advertencias. Eran
//      constantes de `pdf-parcela.js`, y son justo lo que distingue a los dos.
//   2. {@link estamparPies} recibe el nombre para el pie, por lo mismo.
//   3. Las tres guardas y {@link exigirPlanoEncajable} reciben `quien` — el nombre
//      de la función pública que lanza. Un mensaje que diga «informePdfParcela:»
//      cuando el que ha fallado es el informe de edificio manda a quien depura al
//      fichero equivocado, que es peor que no decir nada.
//
// ── PURO ─────────────────────────────────────────────────────────────────────
// Sin DOM, sin red y **sin leer el reloj**, igual que sus dos consumidores: un
// informe firmado es un SNAPSHOT y su prueba tiene que valer igual dentro de un
// año. Dos imports, los dos puros: `./pdf.js` y `./firma.js`.

import { NO_CONSTA, TITULO_FIRMA, lineasFirma } from './firma.js'
import { A4_ALTO_MM, A4_ANCHO_MM } from './pdf.js'

// ── Medidas del papel, en milímetros ─────────────────────────────────────────
//
// TODO lo de este módulo va en milímetros, tamaños de letra incluidos: es el API
// de `report/pdf.js` y es además la unidad en la que se rotula un plano técnico
// (ISO 3098). 3,5 mm ≈ 10 pt.

/** Márgenes de la caja de texto. Los 15 mm laterales dejan 180 mm útiles, que es
 * exactamente el ancho del plano de la Receta A: el plano entra sin encogerse. */
export const MARGEN = Object.freeze({
  IZQUIERDA: 15,
  DERECHA: 15,
  SUPERIOR: 15,
})

/** Ancho útil de la caja de texto y del plano. */
export const ANCHO_UTIL = A4_ANCHO_MM - MARGEN.IZQUIERDA - MARGEN.DERECHA

/** Ordenada del filete del pie de página. Nada del cuerpo baja de aquí. */
export const Y_FILETE_PIE = A4_ALTO_MM - 16

/** Última ordenada utilizable por el cuerpo (queda un respiro sobre el filete). */
export const Y_LIMITE = Y_FILETE_PIE - 4

/** Alto útil de una página entera de cuerpo. Es el techo de un bloque indivisible. */
export const ALTO_PAGINA_UTIL = Y_LIMITE - MARGEN.SUPERIOR

/**
 * Tamaños de letra, **en milímetros de altura de em**. La escala sigue la de la
 * rotulación técnica: 2,5 mm es la altura normal de una cota (ISO 3098), y de ahí
 * hacia arriba y hacia abajo.
 */
export const TAM = Object.freeze({
  TITULO: 5,
  SECCION: 3.6,
  APARTADO: 3,
  CUERPO: 3,
  TABLA: 2.6,
  MENOR: 2.4,
  PIE: 2.2,
})

/**
 * Grises. **Ninguno es de mérito** (regla de oro 9): marcan JERARQUÍA —el rótulo
 * de un campo pesa menos que su valor, la nota técnica menos que el lindero— y
 * nunca puntúan una cifra.
 */
export const GRIS = Object.freeze({
  TEXTO: 0,
  ROTULO: 0.4,
  SECUNDARIO: 0.3,
  FILETE: 0.55,
  PIE: 0.4,
})

/** Interlineado como múltiplo del tamaño de letra. */
export const INTERLINEA = 1.42

/** Ancho de la columna de rótulos en un campo «rótulo → valor». */
export const ANCHO_ROTULO = 55

/**
 * Canal entre columnas de una tabla, en milímetros. Se descuenta del ancho de cada
 * columna POR LA DERECHA. Sin él, una columna alineada a la derecha queda pegada al
 * rótulo de la siguiente y las dos se leen como un solo dato.
 */
export const AIRE_COLUMNA = 3

/** Aire antes y después de un epígrafe de sección. */
export const AIRE = Object.freeze({
  ANTES_SECCION: 6,
  DESPUES_SECCION: 2.5,
  ANTES_APARTADO: 3.5,
  DESPUES_APARTADO: 1.5,
  PARRAFO: 2,
})

// ── Formato de números, en español ───────────────────────────────────────────
//
// Los mismos criterios, exactamente, que `report/contraste-texto.js`: `es-ES`,
// coma decimal, dos decimales de SALIDA (regla 11) y separador de millar en
// superficies y longitudes, que ahí se leen como magnitudes. Las **coordenadas van
// sin separador de millar** (`439283,23`, no `439.283,23`), que es la convención de
// cualquier listado topográfico y evita que un punto de millar y una coma decimal
// compartan columna en la tabla de vértices. Lo que no puede pasar es que el
// informe de texto y el PDF del mismo expediente escriban la misma cifra distinto
// — ni que lo hagan el informe de parcela y el de construcción, que es lo que este
// módulo compartido garantiza desde F14.

const nf = (decimales, agrupar = true) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: agrupar,
  })

/** Superficies y longitudes: 2 decimales, que es lo que la app sabe medir. */
export const FORMATO_2 = nf(2)
/** La superficie DECLARADA por el Catastro es un ENTERO (override O6). */
export const FORMATO_0 = nf(0)
/** Coordenadas: 2 decimales y sin agrupar. */
export const FORMATO_COORD = nf(2, false)
/** Rumbos: un decimal de grado sexagesimal basta para leer un lindero. */
export const FORMATO_1 = nf(1)

export const esNumero = (v) => typeof v === 'number' && Number.isFinite(v)

export const m2 = (v) => (esNumero(v) ? `${FORMATO_2.format(v)} m²` : NO_CONSTA)
export const m2Entero = (v) => (esNumero(v) ? `${FORMATO_0.format(v)} m²` : NO_CONSTA)
export const metros = (v) => (esNumero(v) ? `${FORMATO_2.format(v)} m` : NO_CONSTA)
export const cuenta = (v) => (esNumero(v) ? FORMATO_0.format(v) : NO_CONSTA)

/**
 * ⛔ **Un AÑO no lleva separador de millar**, y esta función existe porque el
 * informe de construcción lo imprimió como «1.997» en su primera corrida. Lo cazó
 * una prueba que buscaba «1997» en el papel.
 *
 * No es un detalle tipográfico: «1.997» en la casilla «Año de construcción» de un
 * documento que se firma se lee como un número de expediente o como una cifra mal
 * puesta, no como un año. {@link cuenta} agrupa a propósito —ahí las cifras son
 * MAGNITUDES y el millar ayuda a leerlas—, y un año no es una magnitud.
 */
export const anio = (v) => (esNumero(v) ? FORMATO_COORD_ENTERO.format(v) : NO_CONSTA)

/** Enteros SIN agrupar. Hoy solo los años; ver {@link anio}. */
const FORMATO_COORD_ENTERO = nf(0, false)
export const grados = (v) => (esNumero(v) ? `${FORMATO_1.format(v)}°` : NO_CONSTA)
export const coordenada = (v) => (esNumero(v) ? FORMATO_COORD.format(v) : NO_CONSTA)

/**
 * Un `relativo` (FRACCIÓN, 0,05 = 5 %) como porcentaje. **El × 100 vive aquí**, en
 * la capa de presentación, no en `diagnostico/bandas.js`: es la confusión clásica
 * de este campo y por eso el modelo devuelve fracción.
 */
export const porcentaje = (v) => (esNumero(v) ? `${FORMATO_2.format(v * 100)} %` : NO_CONSTA)

/** Con signo explícito: el signo de una diferencia es información, no adorno. */
export function conSigno(v, formatear) {
  if (!esNumero(v)) return NO_CONSTA
  const texto = formatear(Math.abs(v))
  if (v > 0) return `+${texto}`
  if (v < 0) return `-${texto}`
  return texto
}

/** Un par UTM `[x, y]` como `439283,23 ; 4479671,27`. */
export const punto = (p) =>
  Array.isArray(p) && p.length >= 2 ? `${coordenada(p[0])} ; ${coordenada(p[1])}` : NO_CONSTA

/** Rótulo de un recinto: el 0 es el exterior, el resto huecos (1-based para leer). */
export const rotuloRecinto = (i) => (i === 0 ? 'Exterior' : `Hueco ${i}`)

/** Singular o plural según la cuenta, para no escribir «1 recinto(s)». */
export const plural = (n, singular, pluralizado) =>
  `${cuenta(n)} ${n === 1 ? singular : pluralizado}`

// ── Guardas de contrato ──────────────────────────────────────────────────────
//
// Misma frontera de siempre en este repo: *el entorno degrada, el programador
// revienta*. Un dato que falta se imprime «No consta»; un TIPO imposible lanza.

export const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Describe un valor para un mensaje de error, sin reventar con los cíclicos. */
export function describir(valor) {
  if (typeof valor === 'string') return JSON.stringify(valor)
  if (valor === null) return 'null'
  if (valor === undefined) return 'undefined'
  if (valor instanceof Uint8Array) return `un Uint8Array de ${valor.length} bytes`
  if (Array.isArray(valor)) return `un array de ${valor.length}`
  if (typeof valor === 'object') return 'un objeto'
  return `${typeof valor} (${String(valor)})`
}

export const lista = (v) => (Array.isArray(v) ? v : [])

/** Un string no vacío, o `null`. Evita que un `''` pase por dato. */
export const textoONulo = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null)

// ── El maquetador ────────────────────────────────────────────────────────────

/**
 * Un cursor sobre el documento que sabe cuándo saltar de página.
 *
 * `y` es **el borde SUPERIOR del siguiente renglón**, no su línea base: quien
 * maqueta piensa en «cuánto llevo bajado», y la línea base la calcula esta capa
 * (`base = y + tam · 0,8`, que es aproximadamente el ascendente de Helvetica).
 *
 * Todo lo que escribe pasa por {@link Maqueta#necesita}, así que **ningún renglón
 * puede caer sobre el pie de página**: el salto no depende de que quien maqueta se
 * acuerde de pedirlo.
 *
 * @param {ReturnType<typeof import('./pdf.js').crearDocumentoPdf>} doc
 */
export function crearMaqueta(doc) {
  const x0 = MARGEN.IZQUIERDA
  const xFin = x0 + ANCHO_UTIL
  let y = MARGEN.SUPERIOR

  const altoDe = (tam) => tam * INTERLINEA

  const maqueta = {
    get y() {
      return y
    },
    set y(valor) {
      y = valor
    },
    x0,
    xFin,
    ancho: ANCHO_UTIL,
    /**
     * El documento, a mano. Lo necesitan las dos primitivas que este maquetador no
     * envuelve —la imagen y algún rectángulo suelto—, y son la misma pieza: pasarlo
     * además por parámetro a cada sección solo daría dos nombres para lo mismo.
     */
    doc,

    /** Abre una página nueva y se planta arriba del todo. */
    nuevaPagina() {
      doc.pagina()
      y = MARGEN.SUPERIOR
      return maqueta
    },

    /**
     * Reserva `alto` milímetros: si no caben, salta de página.
     *
     * @param {number} alto  Milímetros que el siguiente bloque necesita SEGUIDOS.
     * @returns {boolean}  `true` si hubo salto (lo usan las tablas para repetir
     *   su cabecera).
     */
    necesita(alto) {
      if (y + alto <= Y_LIMITE) return false
      // Un bloque más alto que una página entera no cabe en ninguna: saltar sería
      // gastar una hoja en blanco y volver a no caber. Se escribe donde está y se
      // deja que el siguiente `necesita` lo parta.
      if (alto > ALTO_PAGINA_UTIL && y === MARGEN.SUPERIOR) return false
      maqueta.nuevaPagina()
      return true
    },

    /** Aire vertical. No provoca salto: un hueco al principio de una página sobra. */
    hueco(mm) {
      if (y > MARGEN.SUPERIOR) y = Math.min(y + mm, Y_LIMITE)
      return maqueta
    },

    /** Un filete horizontal de ancho completo. */
    filete({ grosor = 0.25, gris = GRIS.FILETE, desde = x0, hasta = xFin } = {}) {
      maqueta.necesita(grosor + 1)
      doc.linea(desde, y, hasta, y, { grosor, gris })
      y += grosor + 1
      return maqueta
    },

    /**
     * Un renglón suelto, sin envolver. Devuelve el ancho ocupado.
     *
     * @param {string} texto
     * @param {object} [opciones]
     */
    renglon(texto, { x = x0, tam = TAM.CUERPO, fuente = 'normal', gris = GRIS.TEXTO } = {}) {
      maqueta.necesita(altoDe(tam))
      const { ancho } = doc.texto(texto, { x, y: y + tam * 0.8, tam, fuente, gris })
      y += altoDe(tam)
      return ancho
    },

    /** Un renglón alineado a la DERECHA de la caja útil. */
    renglonDerecha(texto, { tam = TAM.CUERPO, fuente = 'normal', gris = GRIS.TEXTO } = {}) {
      const ancho = doc.medirTexto(texto, { tam, fuente })
      return maqueta.renglon(texto, { x: xFin - ancho, tam, fuente, gris })
    },

    /**
     * Un párrafo envuelto al ancho útil. Cada línea pide su sitio por separado, así
     * que un párrafo largo se parte entre páginas sin perder nada.
     */
    parrafo(
      texto,
      { tam = TAM.CUERPO, fuente = 'normal', gris = GRIS.TEXTO, sangria = 0 } = {},
    ) {
      const anchoUtil = ANCHO_UTIL - sangria
      for (const linea of doc.partirTexto(texto, anchoUtil, { tam, fuente })) {
        maqueta.renglon(linea, { x: x0 + sangria, tam, fuente, gris })
      }
      return maqueta
    },

    /**
     * Un campo «rótulo → valor», con el valor colgado a la altura de su columna.
     *
     * Si el rótulo no cabe en su columna, el valor baja a la línea siguiente en vez
     * de solaparse con él: un renglón ilegible es peor que un renglón de más.
     */
    campo(rotulo, valor, { tam = TAM.CUERPO, sangria = 0, grisValor = GRIS.TEXTO } = {}) {
      const xRotulo = x0 + sangria
      const anchoRotulo = ANCHO_ROTULO - sangria
      const cabe = doc.medirTexto(rotulo, { tam }) <= anchoRotulo - 2
      const xValor = cabe ? xRotulo + anchoRotulo : xRotulo + 3
      const lineas = doc.partirTexto(valor, xFin - xValor, { tam })

      maqueta.necesita(altoDe(tam) * (cabe ? 1 : 2))
      const yRotulo = y
      doc.texto(rotulo, { x: xRotulo, y: yRotulo + tam * 0.8, tam, gris: GRIS.ROTULO })
      if (!cabe) y += altoDe(tam)
      for (const linea of lineas) {
        maqueta.renglon(linea, { x: xValor, tam, gris: grisValor })
      }
      return maqueta
    },

    /**
     * Una tabla con cabecera **que se repite en cada página**. Las celdas se
     * envuelven dentro de su columna, así que una fila puede medir varias líneas.
     *
     * @param {string[]} cabeceras
     * @param {Array<string[]>} filas
     * @param {object} opciones
     * @param {number[]} opciones.anchos  Milímetros de cada columna.
     * @param {number[]} [opciones.izquierda=[0]]  Columnas alineadas a la izquierda;
     *   el resto van a la derecha, porque las cifras se comparan por su última
     *   posición. `[]` alinea todas a la derecha (la tabla de vértices: allí la
     *   primera columna también es un número).
     * @param {number} [opciones.sangria=0]
     * @param {number} [opciones.tam=TAM.TABLA]
     */
    tabla(cabeceras, filas, { anchos, izquierda = [0], sangria = 0, tam = TAM.TABLA } = {}) {
      const xInicio = x0 + sangria
      const total = anchos.reduce((s, a) => s + a, 0)
      const alto = altoDe(tam)

      /**
       * Las celdas de una fila, ya envueltas dentro de su columna. **Se mide antes
       * de pintar** —y no al revés— porque una fila puede ocupar varias líneas y el
       * salto de página tiene que decidirse con el alto REAL en la mano: pintar
       * primero y reparar después dibujaría la fila dos veces, una de ellas debajo
       * de la cabecera repetida.
       */
      const medirFila = (valores) => {
        let xCol = xInicio
        const celdas = valores.map((v, c) => {
          const celda = {
            lineas: doc.partirTexto(String(v ?? ''), anchos[c] - AIRE_COLUMNA, { tam }),
            xCol,
          }
          xCol += anchos[c]
          return celda
        })
        const nLineas = Math.max(...celdas.map((c) => c.lineas.length))
        return { celdas, alto: nLineas * alto }
      }

      const pintarFila = ({ celdas, alto: altoFila }, fuente) => {
        const yFila = y
        celdas.forEach((c, i) => {
          c.lineas.forEach((linea, k) => {
            const anchoTexto = doc.medirTexto(linea, { tam, fuente })
            // El canal de {@link AIRE_COLUMNA} se descuenta SIEMPRE por la derecha:
            // así una columna de cifras a la derecha nunca queda pegada al rótulo de
            // la siguiente (MEDIDO: «26,50 m 9398517VK3799G» se leía como un solo
            // dato en la tabla de tramos).
            const x = izquierda.includes(i)
              ? c.xCol
              : c.xCol + anchos[i] - AIRE_COLUMNA - anchoTexto
            doc.texto(linea, { x, y: yFila + k * alto + tam * 0.8, tam, fuente })
          })
        })
        y = yFila + altoFila
      }

      const cabecera = medirFila(cabeceras)
      const pintarCabecera = () => {
        pintarFila(cabecera, 'negrita')
        doc.linea(xInicio, y - alto * 0.15, xInicio + total, y - alto * 0.15, {
          grosor: 0.25,
          gris: GRIS.FILETE,
        })
        y += 0.6
      }

      // La cabecera y al menos una fila van juntas: una cabecera sola al pie de una
      // página es una cabecera que no encabeza nada.
      maqueta.necesita(cabecera.alto + alto * 2)
      pintarCabecera()
      for (const fila of filas) {
        const medida = medirFila(fila)
        // Una fila más alta que una página entera no cabe en ninguna: saltar sería
        // gastar una hoja en blanco para volver a no caber.
        if (
          y + medida.alto > Y_LIMITE &&
          medida.alto + cabecera.alto <= ALTO_PAGINA_UTIL
        ) {
          maqueta.nuevaPagina()
          pintarCabecera()
        }
        pintarFila(medida, 'normal')
      }
      doc.linea(xInicio, y + 0.4, xInicio + total, y + 0.4, { grosor: 0.25, gris: GRIS.FILETE })
      y += 1.6
      return maqueta
    },

    /**
     * Un recuadro con texto dentro. Mide primero y dibuja después, porque el
     * rectángulo necesita su alto antes de existir; y **no se parte entre páginas**:
     * medio recuadro en cada hoja se lee como dos avisos distintos.
     */
    recuadro(parrafos, { tam = TAM.MENOR, sangria = 0 } = {}) {
      const aire = 2.5
      const anchoCaja = ANCHO_UTIL - sangria
      const anchoTexto = anchoCaja - 2 * aire
      const bloques = parrafos.map((p) => doc.partirTexto(p, anchoTexto, { tam }))
      const nLineas = bloques.reduce((s, b) => s + b.length, 0)
      const alto = nLineas * altoDe(tam) + 2 * aire + (bloques.length - 1) * 1

      maqueta.necesita(alto)
      doc.rect(x0 + sangria, y, anchoCaja, alto, { trazo: GRIS.FILETE, grosor: 0.3 })
      y += aire
      bloques.forEach((bloque, i) => {
        if (i > 0) y += 1
        for (const linea of bloque) maqueta.renglon(linea, { x: x0 + sangria + aire, tam })
      })
      y += aire
      return maqueta
    },
  }

  return maqueta
}

/**
 * Numerador de secciones y apartados.
 *
 * Existe por lo mismo que el de `report/contraste-texto.js`: **el informe no
 * siempre tiene las mismas secciones**. Cuando la parcela llegó por referencia
 * catastral no hay fichero que leer y esa sección desaparece — y tiene que
 * desaparecer del todo, sin dejar un hueco en la numeración que haga pensar que
 * falta una página. En el informe de construcción pasa lo mismo con el contraste,
 * que es opcional por diseño.
 */
export function crearNumerador() {
  let seccion = 0
  let apartado = 0
  return {
    seccion() {
      seccion += 1
      apartado = 0
      return String(seccion)
    },
    apartado() {
      apartado += 1
      return `${seccion}.${apartado}`
    },
  }
}

/**
 * Un epígrafe de sección: número, título en versalitas y filete.
 *
 * `altoMinimo` es lo que tiene que caber DEBAJO del epígrafe para que valga la
 * pena escribirlo aquí. Sin él, un epígrafe cabe casi siempre —mide 15 mm— y su
 * contenido salta a la hoja siguiente: eso es el **título huérfano** al pie de la
 * página, y MEDIDO se daba en la sección de firma, que necesita 50 mm seguidos.
 * Un rótulo sin nada debajo se lee como una sección vacía.
 */
export function epigrafe(maqueta, num, titulo, { altoMinimo = 0 } = {}) {
  maqueta.hueco(AIRE.ANTES_SECCION)
  maqueta.necesita(TAM.SECCION * INTERLINEA * 3 + altoMinimo)
  maqueta.renglon(`${num.seccion()}.  ${titulo.toUpperCase()}`, {
    tam: TAM.SECCION,
    fuente: 'negrita',
  })
  maqueta.filete({ grosor: 0.4, gris: GRIS.SECUNDARIO })
  maqueta.hueco(AIRE.DESPUES_SECCION)
}

/** Un epígrafe de apartado dentro de una sección. */
export function subepigrafe(maqueta, num, titulo) {
  maqueta.hueco(AIRE.ANTES_APARTADO)
  maqueta.necesita(TAM.APARTADO * INTERLINEA * 3)
  maqueta.renglon(`${num.apartado()}  ${titulo}`, { tam: TAM.APARTADO, fuente: 'negrita' })
  maqueta.hueco(AIRE.DESPUES_APARTADO)
}

// ── Portada ──────────────────────────────────────────────────────────────────

/**
 * El bloque de portada: el nombre legal, la advertencia de lo que este documento
 * NO es y la frase de la regla de oro 9. Va ARRIBA, antes de cualquier cifra,
 * porque quien abre el PDF y lee cinco líneas tiene que haberse enterado ya.
 *
 * ⚠️ **El nombre entra por parámetro y no está cableado**, y es lo único que se
 * parametrizó de esta función al sacarla de `pdf-parcela.js`: el nombre legal del
 * documento es precisamente lo que distingue a los dos informes, y en el de
 * construcción cambia además según se haya hecho contraste o no.
 *
 * @param {object} maqueta
 * @param {{nombre: string, avisos: string[]}} portadaDe  El nombre legal y las
 *   advertencias, en el orden en que se imprimen.
 */
export function portada(maqueta, { nombre, avisos }) {
  maqueta.renglon(nombre.toUpperCase(), { tam: TAM.TITULO, fuente: 'negrita' })
  maqueta.filete({ grosor: 0.6, gris: GRIS.TEXTO })
  maqueta.hueco(2)
  avisos.forEach((aviso, i) => {
    if (i > 0) maqueta.hueco(AIRE.PARRAFO)
    maqueta.parrafo(aviso, { tam: TAM.MENOR, gris: GRIS.SECUNDARIO })
  })
}

// ── El plano de situación ────────────────────────────────────────────────────

/**
 * Comprueba que el plano cabe en el papel **sin reescalarlo**, y que la imagen no
 * se va a estirar. Encoger el plano falsificaría la escala rotulada, que es la peor
 * avería posible de estos documentos.
 *
 * @param {number} anchoMm
 * @param {number} altoMm
 * @param {object} plano
 * @param {string} quien  Nombre de la función pública que lanza. Un mensaje que
 *   diga «informePdfParcela:» cuando ha fallado el informe de construcción manda a
 *   quien depura al fichero equivocado.
 * @throws {RangeError}
 */
export function exigirPlanoEncajable(anchoMm, altoMm, plano, quien) {
  if (anchoMm > ANCHO_UTIL + 1e-9) {
    throw new RangeError(
      `${quien}: el plano mide ${anchoMm} mm de ancho y en A4 con márgenes de ` +
        `${MARGEN.IZQUIERDA} mm caben ${ANCHO_UTIL} mm. NO se reescala: la escala «1:N» que ` +
        'rotula este informe la calculó el encuadre para ese tamaño de papel, y encoger la ' +
        'imagen dejaría el plano con una escala declarada que no es la suya. Recomponga el ' +
        `encuadre con anchoMm ≤ ${ANCHO_UTIL}.`,
    )
  }
  if (altoMm > ALTO_PAGINA_UTIL + 1e-9) {
    throw new RangeError(
      `${quien}: el plano mide ${altoMm} mm de alto y en una página de A4 caben ` +
        `${ALTO_PAGINA_UTIL.toFixed(1)} mm de cuerpo. Un plano partido entre dos hojas no es un ` +
        'plano: recomponga el encuadre con un alto menor.',
    )
  }
  // Relación de aspecto: milímetros contra píxeles. El encuadre los deja iguales
  // salvo el 0,03 % que el redondeo a píxeles enteros empuja al papel; una
  // diferencia mayor significa que el plano y el encuadre no son del mismo trabajo,
  // y la imagen saldría estirada con la geometría fuera de sitio.
  const ratioMm = anchoMm / altoMm
  const ratioPx = plano.anchoPx / plano.altoPx
  const desvio = Math.abs(ratioMm - ratioPx) / ratioPx
  if (desvio > 0.01) {
    throw new RangeError(
      `${quien}: el plano se imprimiría estirado. La caja de papel es ${anchoMm}×` +
        `${altoMm} mm (relación ${ratioMm.toFixed(4)}) y la imagen es ${plano.anchoPx}×` +
        `${plano.altoPx} px (relación ${ratioPx.toFixed(4)}): un ${(desvio * 100).toFixed(2)} % ` +
        'de diferencia. ¿Son el encuadre y el plano del mismo trabajo?',
    )
  }
}

/**
 * El plano de situación, a escala declarada. **La misma sección en los dos
 * informes**, palabra por palabra: lo que cambia entre ellos es qué geometría se
 * dibujó dentro del JPEG, y eso es de `report/canvas.js`.
 *
 * El JPEG llega dibujado por `report/canvas.js` con la flecha de norte, la barra
 * de escala gráfica y la cartografía de fondo YA dentro; aquí solo se pega y se
 * rotula. **La escala NUMÉRICA la pone el PDF** —en pantalla va solo la barra
 * gráfica (dossier §4.4)—, y sale del encuadre, nunca de una segunda división.
 */
export function seccionPlano(maqueta, num, { plano, encuadre, srs, quien }) {
  epigrafe(maqueta, num, 'Plano de situación')

  if (plano === null) {
    maqueta.parrafo(
      'No se ha podido componer el plano de situación, así que este informe sale SIN plano. ' +
        'No es un informe equivalente al que lo lleva: la relación de vértices y las cifras del ' +
        'contraste siguen siendo las mismas, pero aquí falta la comprobación visual del encaje.',
    )
    return { anchoMm: 0, altoMm: 0 }
  }

  const anchoMm = encuadre.anchoMm
  const altoMm = encuadre.altoMm
  exigirPlanoEncajable(anchoMm, altoMm, plano, quien)

  // El plano entero en una hoja: si no cabe donde estamos, se salta antes de pegar.
  maqueta.necesita(altoMm + TAM.MENOR * INTERLINEA * 2)
  maqueta.doc.imagenJpeg(plano.jpeg, {
    x: maqueta.x0,
    y: maqueta.y,
    anchoMm,
    altoMm,
    // Los píxeles DECLARADOS se contrastan contra el `SOF` real del JPEG dentro de
    // `imagenJpeg`. Es la defensa contra el hallazgo medido: el WMS del Catastro
    // sustituye el tamaño sin avisar cuando se pasa de 4000 px.
    anchoPx: plano.anchoPx,
    altoPx: plano.altoPx,
  })
  maqueta.y += altoMm
  maqueta.doc.rect(maqueta.x0, maqueta.y - altoMm, anchoMm, altoMm, {
    trazo: GRIS.FILETE,
    grosor: 0.25,
  })
  maqueta.hueco(1.5)

  // Las medidas del papel pasan por el MISMO formateador que el resto del informe:
  // un `${altoMm}` crudo saldría «129.9624», con punto decimal inglés y cuatro
  // decimales, en un documento que escribe «163,12 m» dos páginas más allá.
  // (163,12 m es el perímetro MEDIDO del exterior de la parcela de referencia;
  // sale de `geo/metrica.js#perimetro` y coincide con la suma de tramos de
  // `report/literal.js`. Antes aquí ponía «163,79», que no es ninguna cifra de
  // este informe: el ejemplo del comentario tiene que poder comprobarse.)
  maqueta.renglon(
    `Escala 1:${cuenta(encuadre.escalaDenominador)}  ·  ${FORMATO_2.format(anchoMm)} × ` +
      `${FORMATO_2.format(altoMm)} mm sobre el papel  ·  ${cuenta(encuadre.ppp)} ppp  ·  ${srs}`,
    { tam: TAM.MENOR, fuente: 'negrita' },
  )
  maqueta.parrafo(
    'El norte del plano es el de CUADRÍCULA (el eje +Y de la proyección UTM), no el geográfico; ' +
      'la flecha y la barra de escala gráfica van dibujadas dentro de la imagen. La escala ' +
      'numérica de arriba es la del papel a tamaño original: una fotocopia reducida deja de ' +
      'estar a esa escala, y por eso el plano lleva además la barra gráfica.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO },
  )

  const atribucion = textoONulo(plano.atribucion)
  if (atribucion !== null) {
    maqueta.renglon(`Cartografía de fondo: ${atribucion}`, {
      tam: TAM.MENOR,
      gris: GRIS.SECUNDARIO,
    })
  }

  // ── Lo que le falta al plano se dice DEBAJO DEL PLANO ──────────────────────
  const caidas = lista(plano.capasCaidas)
  const teselas = lista(plano.teselasCaidas)
  if (caidas.length > 0 || teselas.length > 0) {
    const parrafos = [
      'Este plano no lleva toda la cartografía de fondo que se le pidió. No es el mismo plano ' +
        'que si la llevara, y por eso se dice aquí y no en una nota final:',
    ]
    for (const c of caidas) {
      parrafos.push(
        `· Capa «${textoONulo(c?.capa) ?? NO_CONSTA}»: ${textoONulo(c?.motivo) ?? NO_CONSTA}`,
      )
    }
    for (const t of teselas) {
      parrafos.push(
        `· Trozo de cartografía nº ${cuenta(esNumero(t?.indice) ? t.indice + 1 : null)}: ` +
          `${textoONulo(t?.motivo) ?? NO_CONSTA}`,
      )
    }
    maqueta.hueco(1.5)
    maqueta.recuadro(parrafos)
  }

  return { anchoMm, altoMm }
}

// ── El pie de firma ──────────────────────────────────────────────────────────

/**
 * La última sección, y **la que sostiene toda la propuesta de valor**
 * (`spec/feature-09-informe-parcela.md:21`). Idéntica en los dos informes: quien
 * firma y con qué responsabilidad no depende de si el asunto es una parcela o una
 * construcción.
 *
 * Neutral por obligación, no por estilo: quién puede firmar qué está en disputa
 * jurídica, así que el bloque no presupone titulación, no la insinúa y no ofrece
 * una lista de la que elegirla. Los rótulos y el título los pone
 * `report/firma.js`, que lleva su propio guardián de vocabulario; aquí solo se
 * colocan.
 *
 * Las cuatro líneas salen SIEMPRE, aunque no haya ni un dato: una línea que
 * desaparece se lee como «este documento no necesitaba ese dato», y lo que pasa es
 * que falta.
 */
export function seccionFirma(maqueta, num, { firma }) {
  // El bloque entero junto, **y el epígrafe con él**: una firma partida entre dos
  // hojas es una firma que hay que explicar, y un «FIRMA» solo al pie de la
  // anterior es peor todavía.
  const altoBloque = TAM.CUERPO * INTERLINEA * 4 + 34
  epigrafe(maqueta, num, TITULO_FIRMA, { altoMinimo: altoBloque })

  for (const linea of lineasFirma(firma)) {
    maqueta.campo(linea.etiqueta, linea.valor)
  }

  maqueta.hueco(22)
  maqueta.doc.linea(maqueta.x0, maqueta.y, maqueta.x0 + 80, maqueta.y, {
    grosor: 0.3,
    gris: GRIS.TEXTO,
  })
  maqueta.y += 1.5
  maqueta.renglon('Firma', { tam: TAM.MENOR, gris: GRIS.ROTULO })
  maqueta.hueco(AIRE.PARRAFO)
  maqueta.parrafo(
    'Este documento no lleva firma electrónica ni código seguro de verificación: la firma es ' +
      'la que estampe quien suscribe, con los medios que su colegio y el destinatario admitan. ' +
      'El identificador que consta en el encabezado lo emite esta aplicación y sirve para ' +
      'rastrear el documento, no para verificarlo ante ningún organismo.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO },
  )
}

// ── Cierre · lo que le pasó a la composición ─────────────────────────────────

/**
 * Las sustituciones de caracteres, si las hubo. **Va al final y solo se puede
 * escribir aquí**: `sustituciones()` no sabe lo que hubo hasta que se ha escrito
 * el último renglón.
 *
 * Se enumeran por su PUNTO DE CÓDIGO y no reimprimiendo el carácter: el carácter
 * volvería a sustituirse y el aviso diría «se ha sustituido ? por ?».
 *
 * @returns {string[]}  Las incidencias, en español, para el valor de retorno.
 */
export function bloqueSustituciones(maqueta, doc) {
  const sustituciones = doc.sustituciones()
  if (sustituciones.length === 0) return []

  const porPunto = new Map()
  for (const s of sustituciones) {
    const clave = s.punto
    if (!porPunto.has(clave)) porPunto.set(clave, { punto: clave, veces: 0, paginas: new Set() })
    const entrada = porPunto.get(clave)
    entrada.veces += 1
    entrada.paginas.add(s.pagina)
  }

  const lineas = [...porPunto.values()].map(
    (e) =>
      `· U+${e.punto.toString(16).toUpperCase().padStart(4, '0')}: ` +
      `${plural(e.veces, 'vez', 'veces')}, en ` +
      `${plural(e.paginas.size, 'página', 'páginas')} (${[...e.paginas].sort((a, b) => a - b).join(', ')}).`,
  )

  maqueta.hueco(AIRE.ANTES_SECCION)
  maqueta.necesita(TAM.SECCION * INTERLINEA * 3)
  maqueta.renglon('NOTA DE COMPOSICIÓN', { tam: TAM.SECCION, fuente: 'negrita' })
  maqueta.filete({ grosor: 0.4, gris: GRIS.SECUNDARIO })
  maqueta.hueco(AIRE.DESPUES_SECCION)
  maqueta.parrafo(
    'Algunos caracteres del texto no tienen representación en la codificación de este documento ' +
      'y se han dibujado como «?». No se han perdido en silencio: aquí van, por su punto de ' +
      'código Unicode, para que quien firma pueda corregirlos en el origen antes de entregar.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO },
  )
  maqueta.hueco(1.5)
  for (const linea of lineas) maqueta.parrafo(linea, { tam: TAM.MENOR, sangria: 4 })

  return [
    `Se han sustituido ${plural(sustituciones.length, 'carácter', 'caracteres')} sin ` +
      'representación en la codificación del documento; el informe lo declara en su nota de ' +
      'composición.',
  ]
}

// ── El pie de página ─────────────────────────────────────────────────────────

/**
 * Estampa el pie en TODAS las páginas, ya sabiendo cuántas son.
 *
 * Es la segunda pasada: el cuerpo se compone una vez, se pregunta `nPaginas()` y se
 * vuelve con `irAPagina`. El documento no se compone dos veces, así que el pie no
 * puede decir una cosa y el cuerpo otra.
 *
 * @param {object} doc
 * @param {{nombre: string, idDocumento: string, atribucion: string}} pie  `nombre`
 *   es el nombre legal del documento — entra por parámetro por lo mismo que en
 *   {@link portada}.
 */
export function estamparPies(doc, { nombre, idDocumento, atribucion }) {
  const total = doc.nPaginas()
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.irAPagina(pagina)
    doc.linea(MARGEN.IZQUIERDA, Y_FILETE_PIE, MARGEN.IZQUIERDA + ANCHO_UTIL, Y_FILETE_PIE, {
      grosor: 0.25,
      gris: GRIS.FILETE,
    })

    const izquierda = `${nombre} · ${idDocumento}`
    doc.texto(izquierda, {
      x: MARGEN.IZQUIERDA,
      y: Y_FILETE_PIE + 3.4,
      tam: TAM.PIE,
      gris: GRIS.PIE,
    })

    const numeracion = `Página ${cuenta(pagina)} de ${cuenta(total)}`
    const anchoNumeracion = doc.medirTexto(numeracion, { tam: TAM.PIE })
    doc.texto(numeracion, {
      x: MARGEN.IZQUIERDA + ANCHO_UTIL - anchoNumeracion,
      y: Y_FILETE_PIE + 3.4,
      tam: TAM.PIE,
      gris: GRIS.PIE,
    })

    if (atribucion !== '') {
      doc.texto(atribucion, {
        x: MARGEN.IZQUIERDA,
        y: Y_FILETE_PIE + 7,
        tam: TAM.PIE,
        gris: GRIS.PIE,
      })
    }
  }
  return total
}

// ── Guardas de la entrada pública ────────────────────────────────────────────

/**
 * @param {object} encabezado
 * @param {string} quien  Nombre de la función pública que lanza.
 * @throws {TypeError}
 */
export function exigirEncabezado(encabezado, quien) {
  if (!esObjeto(encabezado)) {
    throw new TypeError(
      `${quien}: 'encabezado' debe ser el objeto de report/firma.js#componerEncabezado ` +
        `(contrato D); recibido ${describir(encabezado)}. De él salen la fecha y el identificador ` +
        'del documento: este módulo no consulta el reloj.',
    )
  }
  if (!(encabezado.fecha instanceof Date) || !Number.isFinite(encabezado.fecha.getTime())) {
    throw new TypeError(
      `${quien}: 'encabezado.fecha' debe ser una fecha utilizable; recibido ` +
        `${describir(encabezado.fecha)}. Compón el encabezado con componerEncabezado en vez de a ` +
        'mano.',
    )
  }
  if (textoONulo(encabezado.idDocumento) === null) {
    throw new TypeError(
      `${quien}: 'encabezado.idDocumento' no puede faltar. Un documento cuyo ` +
        'identificador dice «No consta» no es honrado, es inservible: componerEncabezado lo ' +
        'compone cuando el expediente no trae uno.',
    )
  }
}

/**
 * @param {object|null} plano
 * @param {object|null} encuadre
 * @param {string} quien  Nombre de la función pública que lanza.
 * @throws {TypeError|RangeError}
 */
export function exigirPlano(plano, encuadre, quien) {
  if (plano === null) return
  if (!esObjeto(plano)) {
    throw new TypeError(
      `${quien}: 'plano' debe ser el objeto de report/canvas.js#componerPlano ` +
        `(contrato B) o null si no se ha podido componer; recibido ${describir(plano)}.`,
    )
  }
  if (!(plano.jpeg instanceof Uint8Array)) {
    throw new TypeError(
      `${quien}: 'plano.jpeg' debe ser un Uint8Array con los bytes del JPEG; recibido ` +
        `${describir(plano.jpeg)}.`,
    )
  }
  for (const clave of ['anchoPx', 'altoPx']) {
    if (!Number.isInteger(plano[clave]) || plano[clave] < 1) {
      throw new RangeError(
        `${quien}: 'plano.${clave}' debe ser un entero ≥ 1 de píxeles; recibido ` +
          `${describir(plano[clave])}. Son los que se contrastan contra el SOF real del JPEG.`,
      )
    }
  }
  if (!esObjeto(encuadre)) {
    throw new TypeError(
      `${quien}: con un 'plano' hace falta el 'encuadre' que lo produjo ` +
        `(report/encuadre.js#encuadrar, contrato A); recibido ${describir(encuadre)}. De él sale ` +
        'la escala que se rotula, y calcularla aquí sería una segunda verdad.',
    )
  }
  for (const clave of ['anchoMm', 'altoMm', 'escalaDenominador']) {
    if (typeof encuadre[clave] !== 'number' || !(encuadre[clave] > 0)) {
      throw new TypeError(
        `${quien}: 'encuadre.${clave}' debe ser un número > 0; recibido ` +
          `${describir(encuadre[clave])}. ¿Se ha construido el encuadre a mano en vez de con ` +
          'report/encuadre.js#encuadrar?',
      )
    }
  }
}
