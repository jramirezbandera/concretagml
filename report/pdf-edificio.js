// report/pdf-edificio.js — F14 · EL INFORME DE CONSTRUCCIÓN, EN PDF FIRMABLE.
//
// Hermano de `report/pdf-parcela.js`, y hermano de verdad: los dos comparten el
// papel entero —el cursor, las tablas, los formateadores, el plano, la firma y el
// pie— a través de `report/maqueta.js`, y **no comparten ni una frase del
// contenido**. Aquí no se mide nada: se coloca.
//
// ═════════════════════════════════════════════════════════════════════════════
// EL NOMBRE CAMBIA CON EL DOCUMENTO, Y ES EL CRITERIO 4 DE LA FICHA
// ═════════════════════════════════════════════════════════════════════════════
// Este informe tiene DOS nombres legales y el que le toca depende de lo que
// contenga:
//
//   · sin contraste → **«Informe de construcción para la Sede Electrónica»**
//   · con contraste → **«Informe de contraste con la construcción catastral»**
//
// No es cosmética. Un papel que se titula «de contraste» y no contrasta nada
// promete una comprobación que nadie ha hecho, y quien lo reciba —el cliente, el
// registrador, el ayuntamiento— no tiene forma de saberlo sin leerlo entero. El
// nombre es la primera línea y es la que se lee de verdad.
//
// ⚠️ Y como en el de parcela: **ni una sigla de los documentos oficiales del
// Catastro** en todo el papel. Este documento se firma, se fotocopia y se archiva;
// cualquier sigla impresa en él —aunque sea dentro de una negación— acaba siendo la
// sigla que alguien lee por encima en la portada de un documento firmado. Hay un
// test que afirma que no aparecen. (El informe de TEXTO de F08 sí las nombra, y esa
// divergencia está razonada en `report/contraste-texto.js`: aquél se mira y se
// tira.)
//
// ═════════════════════════════════════════════════════════════════════════════
// LA FICHA DE PARTES ES LA SECCIÓN PROPIA DE ESTE INFORME
// ═════════════════════════════════════════════════════════════════════════════
// Una fila por parte con superficie, plantas sobre y bajo rasante y tipo (ficha
// F14 §17). Tres decisiones sobre ella, y las tres son de honradez:
//
//   1. ⭐ **Las piscinas llevan «—» en las plantas, no «0»**, y el modelo ya lo
//      garantiza: `crearParteConstruccion` fuerza las plantas a `null` en las de
//      tipo `OTRA` *aunque se pasen valores*. Un «0» ahí se leería como «se ha
//      declarado que no tiene plantas», y lo cierto es que la pregunta no aplica.
//      El «—» de esta tabla es lo único de todo el proyecto que NO es {@link
//      NO_CONSTA}, y por eso: «No consta» significa que falta un dato que debería
//      estar.
//   2. **Se dice si la parte ENTRA en la huella**, porque es lo que hace que la
//      suma de la tabla no cuadre con la envolvente. En el edificio real la parte
//      MAYOR —245,90 m² de 568,03— es un sótano y queda FUERA: sin esa columna, el
//      lector suma la tabla, le da casi el doble que la huella y no puede saber por
//      qué.
//   3. **Una parte sin recinto sale igual**, con «No consta» en su superficie. El
//      modelo la admite mientras se trabaja, y esconderla del informe sería firmar
//      una relación de partes que no es la del expediente.
//
// ═════════════════════════════════════════════════════════════════════════════
// LA NOTA AL PIE DE LA ENVOLVENTE NO ES UNA FÓRMULA: ESTÁ MEDIDA
// ═════════════════════════════════════════════════════════════════════════════
// {@link NOTA_ENVOLVENTE} dice que el edificio-envolvente se deriva de las partes
// con volumen sobre rasante y que no se dibuja. Eso podría ser una explicación de
// diseño nuestra, y no lo es: F13 midió que la envolvente que este proyecto deriva
// de las 13 partes reales **es, vértice a vértice, el `Building` que publica el
// Catastro** —y F14 lo midió otra vez desde el otro lado, con un desvío de
// 1,7·10⁻¹³ m²—. El criterio «solo lo que tiene volumen sobre rasante» es SUYO.
//
// ═════════════════════════════════════════════════════════════════════════════
// PURO
// ═════════════════════════════════════════════════════════════════════════════
// Sin DOM, sin red y **sin leer el reloj**: la fecha y el identificador entran
// dentro del `encabezado`. Hay guardián por grep sobre el texto fuente, igual que
// en `report/pdf.js`, `report/firma.js` y `report/pdf-parcela.js`, y por el mismo
// motivo: un informe firmado es un SNAPSHOT y su prueba tiene que valer igual
// dentro de un año.

import { ESTADO_CONSERVACION, TIPO_PARTE } from '../model/edificio.js'
import { superficie } from '../geo/area.js'
import { REGISTRO } from '../diagnostico/edificio.js'
import { NO_CONSTA, lineasEncabezado } from './firma.js'
import { A4_ALTO_MM, A4_ANCHO_MM, crearDocumentoPdf } from './pdf.js'
import {
  AIRE,
  anio,
  GRIS,
  TAM,
  bloqueSustituciones,
  conSigno,
  coordenada,
  crearMaqueta,
  crearNumerador,
  cuenta,
  describir,
  epigrafe,
  esNumero,
  esObjeto,
  estamparPies,
  exigirEncabezado,
  exigirPlano,
  m2,
  metros,
  plural,
  porcentaje,
  portada,
  seccionFirma,
  seccionPlano,
  subepigrafe,
  textoONulo,
} from './maqueta.js'

// ── Los dos nombres legales ──────────────────────────────────────────────────

/**
 * El nombre cuando NO se ha hecho contraste: el informe es DECLARATIVO y describe
 * la construcción que se aporta. Ni una sigla de los documentos oficiales.
 */
export const NOMBRE_INFORME_EDIFICIO = 'Informe de construcción para la Sede Electrónica'

/**
 * El nombre cuando SÍ se ha hecho contraste. Ver la cabecera: titular «de
 * contraste» un papel que no contrasta nada promete una comprobación que nadie ha
 * hecho.
 */
export const NOMBRE_INFORME_EDIFICIO_CONTRASTE =
  'Informe de contraste con la construcción catastral'

/** Quién emite el documento. */
export const PRODUCTOR = 'Concreta GML'

/**
 * Lo que este documento NO es. Mismo criterio que el de parcela: se dice lo que no
 * es y quién sí emite los oficiales, **sin escribir sus siglas**.
 */
export const AVISO_NO_OFICIAL =
  'Este documento lo emite una aplicación privada y no tiene carácter oficial: no lo expide ni ' +
  'lo valida la administración catastral, no acredita ninguna inscripción y no sustituye a los ' +
  'documentos que esa administración emite con código seguro de verificación. Es un trabajo ' +
  'técnico que se aporta a un expediente y que suscribe quien lo firma.'

/**
 * La regla de oro 9, dicha en el papel. Sale de portada, antes de la primera cifra.
 */
export const AVISO_REGLA_9 =
  'Las cifras de este informe son MEDIDAS, no valoraciones: la aplicación mide sobre las ' +
  'coordenadas aportadas y no dictamina si el resultado es correcto, suficiente o admisible. ' +
  'Interpretar lo medido y asumir su consecuencia corresponde a quien firma.'

/**
 * La nota al pie que exige la ficha §17, palabra por palabra. Se exporta para que
 * la interfaz pueda anunciar lo mismo que dice el papel en vez de una segunda
 * redacción parecida.
 */
export const NOTA_ENVOLVENTE =
  'El edificio-envolvente se deriva de las partes con volumen sobre rasante; no se dibuja. Solo ' +
  'entran construcciones sobre rasante; se excluyen voladizos, terrazas y balcones.'

// ── Vocabularios de presentación ─────────────────────────────────────────────

/**
 * ⚠️ **El único «no aplica» de todo el proyecto, y por eso no es {@link
 * NO_CONSTA}.** Una piscina no tiene plantas: no es que falte el dato, es que la
 * pregunta no se le hace. «No consta» diría que alguien tenía que haberlo
 * declarado y no lo hizo.
 */
export const NO_APLICA = '—'

/** Cómo se llama cada tipo de parte en el papel. */
const ROTULO_TIPO = Object.freeze({
  [TIPO_PARTE.PRINCIPAL]: 'Construcción',
  [TIPO_PARTE.OTRA]: 'Otra (piscina y similares)',
})

/** Cómo se llama cada estado de conservación en el papel. */
const ROTULO_ESTADO = Object.freeze({
  [ESTADO_CONSERVACION.FUNCIONAL]: 'Funcional',
  [ESTADO_CONSERVACION.EN_CONSTRUCCION]: 'En construcción',
  [ESTADO_CONSERVACION.RUINOSO]: 'Ruinoso',
  [ESTADO_CONSERVACION.DERRUIDO]: 'Derruido',
})

/** Rótulo de cada atributo general del edificio (modelo COMPLETO). */
const ROTULO_ATRIBUTO = Object.freeze({
  usoDominante: 'Uso dominante',
  estadoConservacion: 'Estado de conservación',
  anioConstruccion: 'Año de construcción',
  anioReforma: 'Año de reforma',
  numeroInmuebles: 'Número de inmuebles',
  numeroViviendas: 'Número de viviendas',
  superficieConstruida: 'Superficie construida declarada',
})

/**
 * Lo que se dice de cada estado del registro en la sección de contraste. Los
 * textos LARGOS los redacta `diagnostico/edificio.js` y llegan dentro del propio
 * contraste (regla de oro 1): aquí solo está el TITULAR de la sección, que es
 * decisión de maqueta.
 */
const TITULAR_REGISTRO = Object.freeze({
  [REGISTRO.CONSULTADO]: 'Contraste con la construcción registrada',
  [REGISTRO.SIN_CONSTRUCCIONES]: 'No consta construcción registrada',
  [REGISTRO.NO_CONSULTADO]: 'Contraste no realizado',
  [REGISTRO.NO_SE_HA_PODIDO]: 'Contraste no realizado',
})

// ── Helpers de este informe ──────────────────────────────────────────────────

/** Un entero de plantas, o el «no aplica» de las piscinas. */
const plantas = (v, esOtra) => (esOtra ? NO_APLICA : cuenta(v))

/** La superficie de una parte, o `null` si no tiene recinto que medir. */
function superficieDeParte(parte) {
  const recinto = parte?.recinto
  if (!recinto || !Array.isArray(recinto.vertices) || recinto.vertices.length < 3) return null
  return superficie([{ ...recinto, tipo: 'EXTERIOR' }])
}

/**
 * ¿Entra esta parte en la huella del edificio?
 *
 * ⚠️ **Se pregunta al MISMO criterio que `edificio/envolvente.js`** —volumen sobre
 * rasante— pero no se le pregunta a él: aquí no hay envolvente que derivar, solo
 * una columna que rellenar. Lo que NO se puede hacer es inventar un criterio
 * distinto, porque entonces la tabla diría que una parte entra y la huella diría
 * que no. Por eso la columna se rellena y el TOTAL de la envolvente sale del
 * contraste, no de sumar esta tabla.
 */
const entraEnHuella = (parte) =>
  parte?.tipo !== TIPO_PARTE.OTRA && esNumero(parte?.plantasSobreRasante) && parte.plantasSobreRasante > 0

// ── Portada ──────────────────────────────────────────────────────────────────

/** El nombre legal que le toca a este documento. Criterio de aceptación 4. */
export const nombreDelInforme = (contraste) =>
  hayContrasteReal(contraste) ? NOMBRE_INFORME_EDIFICIO_CONTRASTE : NOMBRE_INFORME_EDIFICIO

/**
 * ¿Se ha llegado a contrastar de verdad?
 *
 * ⭐ **`contraste !== null` NO basta**, y ésta es la decisión fina de la fase: el
 * objeto del contraste existe también cuando el Catastro dice que no hay nada
 * registrado, o cuando la consulta falló. En esos dos casos hay una SECCIÓN que
 * contar —y se cuenta— pero **no hay contraste**, así que el documento no puede
 * titularse «de contraste». Solo `CONSULTADO` lo es.
 */
export const hayContrasteReal = (contraste) =>
  esObjeto(contraste) && contraste.registro?.clave === REGISTRO.CONSULTADO

// ── 1 · Encabezado ───────────────────────────────────────────────────────────

function seccionEncabezado(maqueta, num, { encabezado, edificio }) {
  epigrafe(maqueta, num, 'Identificación')

  for (const linea of lineasEncabezado(encabezado)) {
    maqueta.campo(linea.etiqueta, linea.valor)
  }

  const modelo = textoONulo(edificio?.modelo)
  if (modelo !== null) {
    maqueta.campo(
      'Modelo de datos',
      modelo === 'COMPLETO'
        ? 'Completo (geometría y atributos del edificio)'
        : 'Simplificado (solo geometría, referencia y estado)',
    )
  }
}

// ── La ficha de partes ───────────────────────────────────────────────────────

/**
 * La sección propia de este informe: una fila por parte. Ver la cabecera para las
 * tres decisiones de honradez que la gobiernan.
 */
function seccionPartes(maqueta, num, { partes, contraste }) {
  epigrafe(maqueta, num, 'Relación de partes de la construcción')

  if (partes.length === 0) {
    maqueta.parrafo(
      'La construcción no tiene ninguna parte declarada. No hay ficha de partes que relacionar, ' +
        'y sin al menos una parte con su contorno no hay huella que aportar.',
    )
    return
  }

  const filas = partes.map((parte, i) => {
    const esOtra = parte?.tipo === TIPO_PARTE.OTRA
    const area = superficieDeParte(parte)
    return [
      cuenta(i + 1),
      textoONulo(parte?.nombre) ?? NO_CONSTA,
      ROTULO_TIPO[parte?.tipo] ?? NO_CONSTA,
      area === null ? NO_CONSTA : m2(area),
      plantas(parte?.plantasSobreRasante, esOtra),
      plantas(parte?.plantasBajoRasante, esOtra),
      entraEnHuella(parte) ? 'Sí' : 'No',
    ]
  })

  maqueta.tabla(['Nº', 'Nombre', 'Tipo', 'Superficie', 'Sobre', 'Bajo', 'En huella'], filas, {
    anchos: [10, 44, 38, 30, 16, 16, 26],
    izquierda: [0, 1, 2],
  })

  // ── Lo que la tabla NO dice sola ──────────────────────────────────────────
  // La suma de la columna de superficies NO es la huella, y sin decirlo el lector
  // la suma de cabeza y se encuentra con otra cifra en la sección siguiente.
  const conRecinto = partes.filter((p) => superficieDeParte(p) !== null)
  const sumaTodas = conRecinto.reduce((s, p) => s + superficieDeParte(p), 0)
  const nEnHuella = partes.filter(entraEnHuella).length
  const huellaMedida = esObjeto(contraste) ? contraste.huella?.medida : null

  maqueta.hueco(1)
  maqueta.parrafo(
    `La relación tiene ${plural(partes.length, 'parte', 'partes')}, de las que ` +
      `${plural(nEnHuella, 'entra', 'entran')} en la huella del edificio. Las superficies de la ` +
      `tabla suman ${m2(sumaTodas)}` +
      (esNumero(huellaMedida)
        ? `, y la huella mide ${m2(huellaMedida)}: la diferencia son las partes que no entran y ` +
          'los solapes entre las que sí, que en la huella se cuentan una sola vez.'
        : '. Esa suma NO es la huella del edificio: las partes que no entran quedan fuera y las ' +
          'que se superponen se cuentan una sola vez.'),
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO },
  )
  maqueta.hueco(AIRE.PARRAFO)
  maqueta.parrafo(NOTA_ENVOLVENTE, { tam: TAM.MENOR, gris: GRIS.SECUNDARIO })
}

// ── Los atributos generales ──────────────────────────────────────────────────

/**
 * Los atributos semánticos del edificio. **Solo existen en modelo COMPLETO**: el
 * modelo ni siquiera crea las claves en SIMPLIFICADO, así que aquí no hay que
 * decidir si están vacíos — no están.
 *
 * @returns {boolean}  Si se ha emitido la sección.
 */
function seccionAtributos(maqueta, num, { edificio }) {
  const claves = Object.keys(ROTULO_ATRIBUTO).filter((c) => edificio?.[c] !== undefined)
  if (claves.length === 0) return false

  epigrafe(maqueta, num, 'Atributos generales del edificio')
  for (const clave of claves) {
    const valor = edificio[clave]
    let texto
    if (valor === null) texto = NO_CONSTA
    else if (clave === 'estadoConservacion') texto = ROTULO_ESTADO[valor] ?? String(valor)
    else if (clave === 'superficieConstruida') texto = m2(valor)
    // ⛔ Los AÑOS con `anio` y no con `cuenta`: la primera corrida imprimió «1.997»
    // en la casilla «Año de construcción». Ver `report/maqueta.js#anio`.
    else if (clave === 'anioConstruccion' || clave === 'anioReforma') texto = anio(valor)
    else if (typeof valor === 'number') texto = cuenta(valor)
    else texto = String(valor)
    maqueta.campo(ROTULO_ATRIBUTO[clave], texto)
  }
  maqueta.hueco(1)
  maqueta.parrafo(
    'Estos atributos los DECLARA quien suscribe: la aplicación no los comprueba contra ninguna ' +
      'fuente y no los deduce de la geometría.',
    { tam: TAM.MENOR, gris: GRIS.SECUNDARIO },
  )
  return true
}

// ── La relación de vértices ──────────────────────────────────────────────────

function seccionVertices(maqueta, num, { partes, srs }) {
  epigrafe(maqueta, num, 'Relación de vértices')
  maqueta.campo('Sistema de referencia', srs)
  maqueta.hueco(1)

  let hubo = false
  partes.forEach((parte, i) => {
    const recinto = parte?.recinto
    if (!recinto || !Array.isArray(recinto.vertices) || recinto.vertices.length === 0) return
    hubo = true
    const nombre = textoONulo(parte?.nombre) ?? `Parte nº ${i + 1}`
    subepigrafe(maqueta, num, `${nombre} · ${plural(recinto.vertices.length, 'vértice', 'vértices')}`)
    maqueta.tabla(
      ['Nº', 'X (m)', 'Y (m)'],
      recinto.vertices.map((v, k) => [cuenta(k + 1), coordenada(v?.[0]), coordenada(v?.[1])]),
      { anchos: [16, 50, 50], izquierda: [], sangria: 4 },
    )
  })

  if (!hubo) {
    maqueta.parrafo(
      'Ninguna parte tiene contorno declarado, así que no hay vértices que relacionar.',
    )
  }
}

// ── El contraste ─────────────────────────────────────────────────────────────

/**
 * La sección del contraste, **que solo existe si el llamante pasó uno**.
 *
 * ⭐ Y con contraste hay CUATRO documentos posibles, no dos: los tres estados sin
 * huella oficial producen cada uno su sección, con su motivo redactado por
 * `diagnostico/edificio.js` (regla de oro 1: quien sabe por qué no se pudo medir es
 * quien lo escribe). Emitir la sección aunque no haya cifras es deliberado: un
 * informe donde la sección de contraste simplemente no aparece se lee como un
 * informe al que no le tocaba contrastar, y aquí lo que pasa es otra cosa.
 */
function seccionContraste(maqueta, num, { contraste }) {
  const clave = contraste.registro?.clave ?? REGISTRO.NO_CONSULTADO
  epigrafe(maqueta, num, TITULAR_REGISTRO[clave] ?? TITULAR_REGISTRO[REGISTRO.NO_CONSULTADO])

  const motivo = textoONulo(contraste.registro?.motivo)
  if (motivo !== null) {
    maqueta.parrafo(motivo)
    maqueta.hueco(AIRE.PARRAFO)
  }

  const h = contraste.huella ?? {}
  maqueta.campo('Huella medida', m2(h.medida))
  if (esNumero(h.oficial)) {
    maqueta.campo('Huella registrada en el Catastro', m2(h.oficial))
    maqueta.campo('Diferencia', conSigno(h.diferencia, (v) => m2(v)))
  }
  maqueta.campo('Perímetro exterior medido', metros(h.perimetroMedido?.total))

  if (contraste.solape !== null && contraste.solape !== undefined) {
    subepigrafe(maqueta, num, 'Coincidencia de las dos huellas')
    maqueta.campo('Superficie común', m2(contraste.solape.area))
    maqueta.campo('Sobre la mayor de las dos', porcentaje(contraste.solape.relativo))
    if (contraste.diferencia) {
      maqueta.campo('Superficie no común', m2(contraste.diferencia.area))
    }
    if (contraste.centroides) {
      maqueta.campo('Desplazamiento del centro', metros(contraste.centroides.distancia))
    }
  }

  if (contraste.enParcela) {
    subepigrafe(maqueta, num, 'Encaje en la parcela declarada')
    maqueta.campo('Superficie dentro de la parcela', m2(contraste.enParcela.superficieDentro))
    maqueta.campo('Superficie fuera de la parcela', m2(contraste.enParcela.superficieFuera))
    maqueta.campo('Proporción dentro', porcentaje(contraste.enParcela.relativo))
  }

  bloqueInvasion(maqueta, num, contraste.invasion)

  // ── Lo que no se ha podido medir, DONDE se echa en falta ──────────────────
  const omisiones = Array.isArray(contraste.omisiones) ? contraste.omisiones : []
  if (omisiones.length > 0) {
    maqueta.hueco(AIRE.PARRAFO)
    maqueta.recuadro([
      'Lo que este contraste no ha podido medir, y por qué:',
      ...omisiones.map((o) => `· ${textoONulo(o?.motivo) ?? NO_CONSTA}`),
    ])
  }
}

/**
 * La invasión a colindantes: la ÚNICA sección con consecuencia fija de todo el
 * proyecto, y aun así **sin adjetivos**. Sale como superficie y referencia
 * catastral; interpretarla es de quien firma.
 */
function bloqueInvasion(maqueta, num, invasion) {
  if (!esObjeto(invasion)) return
  subepigrafe(maqueta, num, 'Invasión de parcelas colindantes')

  if (invasion.consultado !== true) {
    // «No se ha consultado» y «no hay invasión» son afirmaciones opuestas, y la
    // segunda tranquiliza. No se escriben igual.
    maqueta.parrafo(
      'No se han consultado las parcelas colindantes, así que este informe NO afirma que la ' +
        'construcción no invada ninguna: afirma que no se ha mirado.',
    )
    return
  }

  const lista = Array.isArray(invasion.invasiones) ? invasion.invasiones : []
  if (lista.length === 0) {
    maqueta.parrafo(
      'Se han consultado las parcelas colindantes y la construcción no comparte superficie con ' +
        'ninguna de ellas.',
    )
  } else {
    maqueta.tabla(
      ['Referencia catastral', 'Superficie común'],
      lista.map((i) => [textoONulo(i?.refcat) ?? 'Parcela sin referencia', m2(i?.area)]),
      { anchos: [110, 70], izquierda: [0] },
    )
  }

  const descartadas = Array.isArray(invasion.descartadas) ? invasion.descartadas : []
  if (descartadas.length > 0) {
    maqueta.parrafo(
      `Se han descartado ${plural(descartadas.length, 'astilla', 'astillas')} de superficie por ` +
        'debajo del grosor mínimo con el que se considera una invasión real: son el redondeo ' +
        'propio de un lindero compartido. No se ocultan, pero no se cuentan.',
      { tam: TAM.MENOR, gris: GRIS.SECUNDARIO },
    )
  }
}

// ── La función pública ───────────────────────────────────────────────────────

/**
 * El informe de construcción, en PDF firmable (ficha F14 §17).
 *
 * ```js
 * const encuadre = encuadrar({ recintos: envolvente.flat(), anchoMm: 180, altoMm: 130 })
 * const plano = await componerPlano({ encuadre, recintos, recintosOficiales })
 * const encabezado = componerEncabezado({ descriptivos, refcat, srs, fecha, idDocumento })
 *
 * const { bytes, titulo } = informePdfEdificio({
 *   edificio, encabezado, contraste, plano, encuadre, firma,
 * })
 * ```
 *
 * ### El contenido, en orden
 *
 *   1. **Identificación** — municipio, referencia catastral, SRS, fecha,
 *      identificador único y modelo de datos.
 *   2. **Plano de situación** a escala declarada (la misma sección que el informe
 *      de parcela, de `report/maqueta.js`).
 *   3. **Relación de partes** — la ficha del §17.
 *   4. **Atributos generales** — *solo si el modelo es COMPLETO*.
 *   5. **Relación de vértices**, parte a parte.
 *   6. **Contraste** — *solo si el llamante pasó uno*.
 *   7. **Pie de firma**.
 *
 * Las secciones que no se emiten **no dejan hueco en la numeración**: el numerador
 * solo avanza cuando se escribe un epígrafe.
 *
 * @param {Object} entrada
 * @param {Object} entrada.edificio  El POJO de `model/edificio.js`. **Obligatorio**:
 *   sin construcción no hay informe de construcción.
 * @param {Object} entrada.encabezado  El de `report/firma.js#componerEncabezado`.
 *   **Obligatorio**: trae la fecha y el identificador, que este módulo no puede
 *   inventarse porque no lee el reloj.
 * @param {Object|null} [entrada.contraste=null]  Lo que devuelve
 *   `diagnostico/edificio.js#contrastarEdificio`. ⚠️ **`null` NO imprime la
 *   sección**, y es deliberado: el contraste es un paso OPCIONAL y un informe sin
 *   él es exactamente lo que la ficha llama «informe solo declarativo». Con
 *   cualquier otro valor la sección se imprime, aunque el registro diga que no se
 *   pudo contrastar — ver {@link seccionContraste}.
 * @param {Object|null} [entrada.plano=null]  El de `report/canvas.js#componerPlano`.
 *   `null` = no se pudo componer, y el informe sale diciéndolo.
 * @param {Object|null} [entrada.encuadre=null]  Obligatorio si hay `plano`.
 * @param {Object|null} [entrada.firma=null]  El pie de firma. `null` imprime los
 *   cuatro campos con «No consta», que es lo correcto y no un hueco.
 * @returns {{bytes: Uint8Array, nPaginas: number, idDocumento: string, titulo: string,
 *   nombreFichero: string, sustituciones: ReadonlyArray<Object>, incidencias: string[]}}
 *   `titulo` es el nombre legal que ha tomado el documento: cambia según haya
 *   habido contraste o no (criterio de aceptación 4).
 * @throws {TypeError}  Contrato del programador.
 * @throws {RangeError}  Si el plano no cabe en el papel sin reescalarlo.
 */
export function informePdfEdificio(entrada) {
  if (!esObjeto(entrada)) {
    throw new TypeError(
      'informePdfEdificio: se espera un objeto {edificio, encabezado, contraste, plano, ' +
        `encuadre, firma}; recibido ${describir(entrada)}.`,
    )
  }

  const {
    edificio,
    encabezado,
    contraste = null,
    plano = null,
    encuadre = null,
    firma = null,
  } = entrada

  if (!esObjeto(edificio)) {
    throw new TypeError(
      "informePdfEdificio: 'edificio' debe ser el POJO de model/edificio.js#crearEdificio; " +
        `recibido ${describir(edificio)}.`,
    )
  }
  if (!Array.isArray(edificio.partes)) {
    throw new TypeError(
      "informePdfEdificio: 'edificio.partes' debe ser un array; recibido " +
        `${describir(edificio.partes)}. ¿Se ha construido el edificio a mano en vez de con ` +
        'crearEdificio?',
    )
  }
  if (contraste !== null && !esObjeto(contraste)) {
    throw new TypeError(
      "informePdfEdificio: 'contraste' debe ser el objeto de contrastarEdificio() o null " +
        `(null = no se ha contrastado, que es un caso normal); recibido ${describir(contraste)}.`,
    )
  }
  exigirEncabezado(encabezado, 'informePdfEdificio')
  exigirPlano(plano, encuadre, 'informePdfEdificio')

  const idDocumento = encabezado.idDocumento.trim()
  const titulo = nombreDelInforme(contraste)
  // ⚠️ El SRS sale SOLO del encabezado, y no hay un `?? edificio.srs` de reserva:
  // `model/edificio.js#crearEdificio` **no tiene campo `srs`** (a diferencia de
  // `crearParcela`), así que esa segunda vía leería `undefined` para siempre y
  // parecería una red que no lo es.
  const srs = textoONulo(encabezado.srs) ?? NO_CONSTA

  const doc = crearDocumentoPdf({
    anchoMm: A4_ANCHO_MM,
    altoMm: A4_ALTO_MM,
    titulo: `${titulo} · ${idDocumento}`,
    autor: textoONulo(firma?.nombre),
    productor: PRODUCTOR,
    // INYECTADA dentro del encabezado: este módulo no consulta el reloj.
    fecha: encabezado.fecha,
  })

  const maqueta = crearMaqueta(doc)
  const num = crearNumerador()
  const incidencias = []

  portada(maqueta, { nombre: titulo, avisos: [AVISO_NO_OFICIAL, AVISO_REGLA_9] })
  seccionEncabezado(maqueta, num, { encabezado, edificio })
  seccionPlano(maqueta, num, { plano, encuadre, srs, quien: 'informePdfEdificio' })
  seccionPartes(maqueta, num, { partes: edificio.partes, contraste })
  seccionAtributos(maqueta, num, { edificio })
  seccionVertices(maqueta, num, { partes: edificio.partes, srs })
  if (contraste !== null) seccionContraste(maqueta, num, { contraste })
  seccionFirma(maqueta, num, { firma })

  // ── Lo que hubo que declarar ───────────────────────────────────────────────
  for (const c of Array.isArray(plano?.capasCaidas) ? plano.capasCaidas : []) {
    incidencias.push(
      `La capa de cartografía «${textoONulo(c?.capa) ?? NO_CONSTA}» no se ha dibujado en el ` +
        `plano: ${textoONulo(c?.motivo) ?? NO_CONSTA}`,
    )
  }
  for (const t of Array.isArray(plano?.teselasCaidas) ? plano.teselasCaidas : []) {
    incidencias.push(
      `Un trozo del plano ha quedado sin cartografía de fondo: ${textoONulo(t?.motivo) ?? NO_CONSTA}`,
    )
  }
  // ⭐ El MISMO objeto `pie` va a la nota de composición y a los pies (R3): la
  // nota se imprime ANTES de estampar los pies —que necesitan el total de
  // páginas— y pre-escanea sus textos para que una sustitución ocurrida en el
  // pie quede enumerada en el papel. Ver report/maqueta.js#bloqueSustituciones.
  const pie = {
    nombre: titulo,
    idDocumento,
    atribucion: textoONulo(plano?.atribucion) ?? '',
  }
  incidencias.push(...bloqueSustituciones(maqueta, doc, pie))

  const nPaginas = estamparPies(doc, pie)

  return {
    bytes: doc.bytes(),
    nPaginas,
    idDocumento,
    titulo,
    // Nombre SUGERIDO para la descarga, con el identificador dentro para que dos
    // informes del mismo día no se pisen en la carpeta de descargas. Quien descarga
    // es `gml/descargar.js`; aquí solo se propone.
    nombreFichero: `informe-construccion-${idDocumento}.pdf`,
    sustituciones: doc.sustituciones(),
    incidencias,
  }
}
