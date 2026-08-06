// export/excel-coordenadas.js — F20 · T2.1. EL LISTADO DE COORDENADAS, EN EXCEL.
//
// La maqueta del libro que baja del diálogo «Expediente». **Aquí no se calcula ni una
// cifra y no se escribe ni una etiqueta de XML**: las medidas vienen de
// `export/coordenadas.js#prepararListado` y el envase lo pone `export/xlsx.js`. Es el
// mismo reparto que `report/pdf-parcela.js` frente a `report/pdf.js`, y por lo mismo:
// un cambio de aspecto no debe poder romper el contenedor.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ⭐ ESTO NO ES UN DOCUMENTO NUEVO: ES EL LISTADO DE REPLANTEO EN OTRO ENVASE
// ═══════════════════════════════════════════════════════════════════════════════
// Y esa frase tiene consecuencia de código, no de prosa. La ficha de F20 exige que
// «la superficie y el perímetro del `.xlsx` sean IDÉNTICOS a los del `.txt` para la
// misma parcela» (criterio 5), y eso **no se cumple con una prueba que compare las
// dos salidas**: se cumple compartiendo el cálculo, que es lo que hace que la
// coincidencia no se pueda romper en vez de que se note cuando se rompa.
//
// Por eso de `export/coordenadas.js` se importan CUATRO cosas y ninguna es casual:
//
//   · `prepararListado` — el redondeo, los vértices fundidos, las medidas y las
//     detecciones. **La misma aritmética, no una equivalente.**
//   · `rotuloRecinto`  — con el que se rotula la PESTAÑA. Sin él, el `.txt` podría
//     decir «Hueco 1» y el `.xlsx` «Hueco 2» sobre el mismo anillo.
//   · `fechaLarga`     — el mismo instante escrito de la misma manera.
//   · `NO_CONSTA`      — la misma frase donde falta el mismo dato.
//
// ── POR QUÉ LOS NÚMEROS VAN COMO NÚMEROS, Y ESO ES MEDIA FASE ──────────────
// El `.txt` de F10 rinde las coordenadas ya formateadas en español, con su coma
// decimal, porque es texto y no puede hacer otra cosa. **Aquí sería un error**: una
// celda con `"372516,02"` dentro no se puede sumar, ni ordenar, ni restar de otra, y
// esa es exactamente la carencia que abre esta fase. Se escribe el número crudo
// —`372516.02`— con el formato `0.00`, y **es Excel quien lo pinta con coma** en un
// equipo en español. Medido en F20 · M1: openpyxl lo recupera como `float`.
//
// Lo mismo con las unidades: `1.535,87 m²` no es texto, es un número con el formato
// `0.00" m²"`. Se ve igual y se sigue pudiendo sumar.
//
// ⚠️ **Consecuencia que conviene tener escrita: la celda de la superficie guarda
// `1510.865149996761` y ENSEÑA `1.510,87`.** El redondeo es del formato, no del
// valor, y eso es lo correcto aquí por dos motivos. Primero, es exactamente lo que
// hace el `.txt`: allí la cifra completa también existe y `Intl.NumberFormat` la
// rinde a dos decimales al imprimirla — las dos salidas redondean al PRESENTAR, no al
// calcular. Y segundo, es lo que hace cierta la frase del pie: quien vuelva a medir
// sobre las coordenadas de la hoja obtiene ese número, no el recortado. Quien
// ensanche los decimales de la celda verá la cola, y lo que verá será verdad.
//
// ── LOS VÉRTICES SE NUMERAN DESDE 1 ────────────────────────────────────────
// ⚠️ **Y la imagen que originó la fase los numeraba desde 0.** Se decidió al aprobar
// el plan, y el motivo es el de arriba otra vez: el `.txt` numera desde 1, y dos
// documentos de esta aplicación llamando distinto al mismo punto se cruzan mal
// justamente en la mesa donde se replantea. La imagen manda en la ESTRUCTURA; no
// manda en algo que contradice a otro fichero nuestro.
//
// ── UNA HOJA POR RECINTO, Y EL PIE SOLO EN LA DEL EXTERIOR ─────────────────
// Cada anillo en su pestaña: es lo que mejor se pega a otro programa, porque cada
// tabla queda limpia y sola. El pie de medidas, en cambio, va **solo en la hoja del
// contorno exterior**, y no es un descuido: la superficie es la NETA de la parcela
// entera —exterior menos huecos—, así que repetirla en la pestaña de un hueco
// afirmaría que es la superficie de ese hueco, que es falso. En las hojas de hueco se
// dice dónde está el pie, en vez de dejar el hueco mudo.
//
// ── REGLA DE ORO 9 ─────────────────────────────────────────────────────────
// «La aplicación mide; el colegiado interpreta y firma.» Este libro enumera y suma:
// no dice si la parcela está bien, ni si cierra, ni si cuadra con nada. Ni
// «correcto», ni «cumple», ni «✓». Hay guardián de vocabulario sobre el texto que
// sale, igual que en el `.txt` y en `report/contraste-texto.js`.
//
// ── EL RELOJ NO SE LEE AQUÍ ────────────────────────────────────────────────
// `fecha` entra por parámetro, como en toda la capa.

import { HUSOS_VALIDOS, srsPorHuso } from '../geo/huso.js'
import { resumirDetecciones } from './_comun.js'
import { NO_CONSTA, fechaLarga, prepararListado, rotuloRecinto } from './coordenadas.js'
import { ESTILO, serializarLibroXlsx } from './xlsx.js'

// ── Medidas del papel ────────────────────────────────────────────────────────

/**
 * Anchos de las tres columnas, en las unidades de Excel (aproximadamente «cuántos
 * caracteres caben»). La primera es estrecha porque solo lleva el número de vértice;
 * las otras dos tienen que admitir `4.084.674,06` sin cortarlo — una coordenada que
 * se ve como `#####` es una coordenada que no está.
 */
const ANCHOS = Object.freeze([{ ancho: 10 }, { ancho: 18 }, { ancho: 18 }])

/** El título de la caja, tal cual venía en la imagen de partida. */
const TITULO = 'Coordenadas Parcela'

/** Cabeceras de la tabla, tal cual venían en la imagen de partida. */
const COLUMNAS = Object.freeze(['Vértice', 'Coordenada X', 'Coordenada Y'])

/**
 * Nombre de la pestaña cuando la parcela no tiene geometría. **No se llama «Contorno
 * exterior»**: no hay ninguno, y una pestaña que promete un contorno y sale vacía
 * hace pensar en un fallo de la descarga.
 */
const HOJA_SIN_GEOMETRIA = 'Parcela sin geometría'

/**
 * Lo que este libro dice de sí mismo sobre volver a cargarlo aquí.
 *
 * ⚠️ **Es una redacción propia y no una copia de `AVISO_NO_REIMPORTABLE`**, y la
 * diferencia importa: aquella frase explica que el fichero no se puede releer *porque
 * la primera columna es el número de vértice y un lector de dos columnas la tomaría
 * por la X*. Aquí eso también es verdad, pero **hay una razón anterior y más simple**
 * —la aplicación no sabe abrir ficheros de Excel en absoluto—, y dar la razón
 * complicada cuando la sencilla es la que manda deja a quien lo lee pensando que con
 * quitar una columna se arreglaría.
 */
export const AVISO_NO_REIMPORTABLE_EXCEL =
  'Esta hoja no se puede volver a cargar en la aplicación: no sabe abrir ficheros de Excel. ' +
  'Para retomar el trabajo aquí, usa el fichero de proyecto (.json). Y si copias la tabla a otro ' +
  'programa, ten en cuenta que la primera columna es el número de vértice y no una coordenada.'

// ── Textos del pie ───────────────────────────────────────────────────────────

const NOTA_SUPERFICIE_NETA =
  'La superficie es la neta: el contorno exterior menos los huecos. La longitud total, en cambio, ' +
  'los SUMA — un hueco añade lindero, no lo quita.'

const NOTA_SOBRE_LO_IMPRESO =
  'Las cuatro medidas están tomadas sobre las coordenadas de esta hoja, ya redondeadas, y no sobre ' +
  'las del modelo interno: así, quien vuelva a medir sobre las cifras de arriba obtiene lo mismo ' +
  'que pone aquí.'

const NOTA_NI_JUZGA =
  'Esta hoja enumera y suma; no dice si la parcela está bien ni si sus medidas encajan con ninguna ' +
  'otra. Esa lectura es de quien firma.'

const NOTA_PIE_EN_LA_PRIMERA =
  'Las medidas de la parcela (superficie, perímetro y longitud de lindero) están en la primera ' +
  'hoja: son del conjunto —exterior menos huecos— y no de este recinto por separado.'

// ── Ayudas ───────────────────────────────────────────────────────────────────

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v)

/** Un string no vacío, o `null`. Evita que un `''` pase por dato. */
const textoONulo = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null)

/**
 * Una celda de medida: número con su unidad **en el formato**, o el texto de que no
 * consta. Lo segundo no puede ser una celda numérica, así que cambia también el
 * estilo — de ahí que esto sea una función y no un literal.
 */
const medida = (valor, estilo) =>
  esNumero(valor) ? { valor, estilo } : { valor: NO_CONSTA, estilo: ESTILO.TEXTO }

/**
 * `EPSG:25830` → `UTM 30 ETRS89`, que es como lo rotulaba la imagen de partida y como
 * lo dice quien trabaja con esto.
 *
 * ⚠️ **Se deriva invirtiendo `srsPorHuso`, en vez de escribir un segundo mapa.**
 * `geo/huso.js` no publica el suyo —`SRS_POR_HUSO` es privado— y publicarlo, o
 * copiarlo, daría dos sitios donde dice qué huso es un EPSG. El bucle recorre tres
 * enteros.
 *
 * Un SRS que no reconocemos **se escribe tal cual**: es un dato del expediente y
 * callarlo sería peor que enseñarlo sin traducir.
 *
 * @param {string|null} srs
 * @returns {string|null}
 */
function zonaLegible(srs) {
  const valor = textoONulo(srs)
  if (valor === null) return null
  for (const huso of HUSOS_VALIDOS) {
    if (srsPorHuso(huso) === valor) return `UTM ${huso} ETRS89`
  }
  return valor
}

/**
 * El bloque de cabecera que llevan TODAS las hojas: el recuadro de la imagen.
 *
 * @returns {{filas: Array<Array<*>>, combinaciones: string[]}}
 */
function cabecera({ refcat, srs, nombre, fecha, rotulo, nVerticesHoja }) {
  const etiqueta = (t) => ({ valor: t, estilo: ESTILO.ETIQUETA })
  const dato = (v) => ({ valor: v, estilo: ESTILO.TEXTO })

  // ⚠️ Las tres celdas del título se emiten aunque DOS ESTÉN VACÍAS: una celda
  // combinada solo pinta el borde de las celdas que existen de verdad, así que sin B1
  // y C1 el recuadro del título saldría abierto por la derecha. Para eso
  // `export/xlsx.js` admite la celda vacía CON estilo.
  const vaciaConRecuadro = { estilo: ESTILO.TITULO }

  const filas = [
    [{ valor: TITULO, estilo: ESTILO.TITULO }, vaciaConRecuadro, vaciaConRecuadro],
    [etiqueta('Identificador:'), dato(textoONulo(refcat) ?? NO_CONSTA)],
    [etiqueta('Zona:'), dato(zonaLegible(srs) ?? NO_CONSTA)],
    [etiqueta('Recinto:'), dato(rotulo)],
  ]
  // El expediente solo aparece cuando lo hay: una fila «Expediente: No consta» ocupa
  // sitio para decir nada, y este bloque está justo encima de lo que se va a copiar.
  if (textoONulo(nombre) !== null) filas.push([etiqueta('Expediente:'), dato(nombre)])
  filas.push(
    [etiqueta('Vértices:'), { valor: nVerticesHoja, estilo: ESTILO.TEXTO }],
    [etiqueta('Fecha:'), dato(fechaLarga(fecha))],
  )

  return { filas, combinaciones: ['A1:C1'] }
}

/**
 * La tabla de vértices de un recinto: cabecera de columnas y una fila por vértice.
 *
 * @param {Array<[number, number]>} vertices
 * @returns {Array<Array<*>>}
 */
function tabla(vertices) {
  const filas = [COLUMNAS.map((c) => ({ valor: c, estilo: ESTILO.CABECERA }))]
  if (vertices.length === 0) {
    filas.push([{ valor: 'Este recinto no tiene vértices.', estilo: ESTILO.TEXTO }])
    return filas
  }
  vertices.forEach(([x, y], i) => {
    filas.push([
      // Desde 1, igual que el `.txt`. Ver la cabecera del módulo.
      { valor: i + 1, estilo: ESTILO.ENTERO },
      { valor: x, estilo: ESTILO.DECIMAL },
      { valor: y, estilo: ESTILO.DECIMAL },
    ])
  })
  return filas
}

/**
 * El pie de la primera hoja: las medidas, lo que hubo que decidir y las notas.
 *
 * @returns {Array<Array<*>>}
 */
function pie({ superficieNeta, perimetro, detecciones }) {
  const rotulo = (t) => [{ valor: t, estilo: ESTILO.ROTULO }]
  const apunte = (t) => [{ valor: t, estilo: ESTILO.APUNTE }]
  const linea = (t, valor, estilo) => [{ valor: t, estilo: ESTILO.ETIQUETA }, medida(valor, estilo)]

  const filas = [
    [],
    rotulo('Medidas'),
    linea('Superficie', superficieNeta, ESTILO.METROS_CUADRADOS),
    linea('Perímetro exterior', perimetro?.exterior ?? null, ESTILO.METROS),
    linea('Perímetro de los huecos', perimetro?.huecos ?? null, ESTILO.METROS),
    linea('Longitud total de lindero', perimetro?.total ?? null, ESTILO.METROS),
    [],
    apunte(NOTA_SUPERFICIE_NETA),
    apunte(NOTA_SOBRE_LO_IMPRESO),
  ]

  // Lo que el exportador tuvo que decidir va DENTRO del libro y no solo por el panel
  // de la aplicación (regla de oro 1): quien reciba este fichero por correo no vio
  // nunca la pantalla donde se avisó.
  if (detecciones.length > 0) {
    filas.push([], rotulo('Al preparar esta hoja'))
    for (const d of detecciones) filas.push(apunte(`[${d.severidad}] ${d.mensaje}`))
  }

  filas.push([], apunte(AVISO_NO_REIMPORTABLE_EXCEL), apunte(NOTA_NI_JUZGA))
  return filas
}

/**
 * ¿Es esto una lista de recintos del modelo? Se pide exactamente lo que este módulo
 * usa, y ni un campo más: duck typing, igual que `export/dxf.js` y `coordenadas.js`.
 */
function esListaDeRecintos(v) {
  return Array.isArray(v) && v.every((r) => r && typeof r === 'object' && Array.isArray(r.vertices))
}

// ── Typedefs ─────────────────────────────────────────────────────────────────

/** @typedef {import('./_comun.js').DeteccionExport} DeteccionExport */

/**
 * @typedef {Object} ResultadoExcel
 * @property {Uint8Array} bytes  El libro `.xlsx` completo.
 * @property {DeteccionExport[]} detecciones  Lo que hubo que decidir por el camino.
 * @property {{total: number, porTipo: Record<string, number>, porSeveridad: Record<string, number>}} resumen
 * @property {number} nVertices  Vértices realmente escritos, ya redondeados y sin los
 *   que se fundieron.
 * @property {number} nHojas  Pestañas del libro. La interfaz puede decirlo sin abrirlo.
 */

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Serializa la geometría de una parcela como listado de coordenadas en un libro de
 * Excel, con una hoja por recinto.
 *
 * ```js
 * const { bytes, detecciones } = serializarCoordenadasExcel({
 *   recintos: parcela.recintos,
 *   refcat: parcela.refcat,
 *   srs: expediente.srs,
 *   fecha,                  // INYECTADA: la pone el cableado; aquí no se lee el reloj
 *   nombre: identidad.nombre,
 * })
 * ```
 *
 * **Devuelve `bytes` y no `texto`**, al contrario que sus tres hermanas de esta capa:
 * un `.xlsx` es un contenedor binario. Baja por `gml/descargar.js#descargarBinario`,
 * el mismo primitivo que F09 escribió para el PDF.
 *
 * **No lanza por un dato malo del usuario**: una parcela sin geometría, un recinto
 * degenerado o un hueco sin vértices salen por `detecciones` y el libro se emite
 * igual. El `throw` se reserva al contrato roto por el programador (SPEC §2.1) y a
 * las coordenadas fuera del rango publicable, que las rechaza
 * `gml/anillos.js#redondearCoord` con su motivo.
 *
 * @param {object} opciones
 * @param {Array<{vertices: Array<[number, number]>, tipo?: string}>} [opciones.recintos=[]]
 *   Los recintos del modelo. `recintos[0]` es el EXTERIOR y el resto huecos.
 * @param {string|null} [opciones.refcat=null]  Referencia catastral. `null` es un caso
 *   legítimo (parcela de un DXF, de un TXT o dibujada) y se escribe como tal.
 * @param {string|null} [opciones.srs=null]  Sistema de referencia, p. ej. `EPSG:25830`.
 *   Se rotula como zona («UTM 30 ETRS89»); ver {@link zonaLegible}.
 * @param {Date} opciones.fecha  Instante que se estampa. **Obligatorio y por
 *   parámetro**: ver la cabecera del módulo.
 * @param {string|null} [opciones.nombre=null]  Rótulo del expediente, si lo hay.
 * @returns {ResultadoExcel}
 * @throws {TypeError}   `opciones` que no es objeto, recintos con otra forma, `fecha`
 *   que no es una fecha, `refcat`/`srs`/`nombre` que no son texto ni `null`.
 * @throws {RangeError}  `fecha` inválida, o lo que lance `redondearCoord`.
 */
export function serializarCoordenadasExcel(opciones = {}) {
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(
      `serializarCoordenadasExcel: se esperaba un objeto de opciones; recibido ${JSON.stringify(opciones)}.`,
    )
  }
  const { recintos = [], refcat = null, srs = null, fecha, nombre = null } = opciones

  if (!esListaDeRecintos(recintos)) {
    throw new TypeError(
      `serializarCoordenadasExcel: 'recintos' debe ser un array de recintos del modelo ` +
        `({vertices: [[x,y], …]}); recibido ${JSON.stringify(recintos)}.`,
    )
  }
  for (const [clave, valor] of [
    ['refcat', refcat],
    ['srs', srs],
    ['nombre', nombre],
  ]) {
    if (valor !== null && typeof valor !== 'string') {
      throw new TypeError(
        `serializarCoordenadasExcel: '${clave}' debe ser un texto o null; recibido ${typeof valor}.`,
      )
    }
  }
  if (!(fecha instanceof Date)) {
    throw new TypeError(
      `serializarCoordenadasExcel: 'fecha' debe ser una fecha; recibido ${typeof fecha}. ` +
        'El listado no consulta el reloj: la fecha entra por parámetro.',
    )
  }
  if (!Number.isFinite(fecha.getTime())) {
    throw new RangeError("serializarCoordenadasExcel: 'fecha' es inválida (tiempo no finito).")
  }

  // ⭐ La MISMA aritmética que el `.txt`, no una equivalente. Ver la cabecera.
  const { preparados, detecciones, superficieNeta, perimetro, nVertices } = prepararListado(recintos)

  const comunes = { refcat, srs, nombre, fecha }

  /** @type {Array<{nombre: string, filas: Array<Array<*>>, columnas: *, combinaciones: string[]}>} */
  const hojas = []

  if (preparados.length === 0) {
    // Una parcela sin geometría NO produce un libro sin hojas —Excel no lo abriría, y
    // `serializarLibroXlsx` lanza por eso—: produce una hoja que lo dice.
    const { filas, combinaciones } = cabecera({
      ...comunes,
      rotulo: NO_CONSTA,
      nVerticesHoja: 0,
    })
    hojas.push({
      nombre: HOJA_SIN_GEOMETRIA,
      columnas: ANCHOS,
      combinaciones,
      filas: [
        ...filas,
        [],
        [{ valor: 'No consta la geometría de la parcela.', estilo: ESTILO.TEXTO }],
        ...pie({ superficieNeta, perimetro, detecciones }),
      ],
    })
  } else {
    for (const p of preparados) {
      const rotulo = rotuloRecinto(p.indice)
      const { filas, combinaciones } = cabecera({
        ...comunes,
        rotulo,
        nVerticesHoja: p.vertices.length,
      })
      const esLaPrimera = p.indice === 0
      hojas.push({
        nombre: rotulo,
        columnas: ANCHOS,
        combinaciones,
        filas: [
          ...filas,
          [],
          ...tabla(p.vertices),
          // El pie completo va SOLO en la del exterior; las demás dicen dónde está.
          ...(esLaPrimera
            ? pie({ superficieNeta, perimetro, detecciones })
            : [[], [{ valor: NOTA_PIE_EN_LA_PRIMERA, estilo: ESTILO.APUNTE }]]),
        ],
      })
    }
  }

  return {
    bytes: serializarLibroXlsx({ hojas, fecha }),
    detecciones,
    resumen: resumirDetecciones(detecciones),
    nVertices,
    nHojas: hojas.length,
  }
}

export default serializarCoordenadasExcel
