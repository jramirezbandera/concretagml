// export/dxf.js — F10 · T2.2. EL DXF PARA EL CAD, escrito a mano.
//
// Cierra el círculo que F01 abrió: aquella fase aprendió a LEER un DXF de AutoCAD
// (`parsers/dxf.js`), y esta aprende a escribirlo. Emite **la parcela oficial junto
// a la editada, en capas separadas**, que es lo que el perito abre en el CAD para
// comparar las dos con las herramientas que ya sabe usar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ⛔ 2026-08-05 · ESTE MÓDULO EMITÍA UN FICHERO QUE COLGABA ZWCAD, Y NINGUNA
//    MEDICIÓN NUESTRA LO VEÍA
// ═══════════════════════════════════════════════════════════════════════════════
// Un usuario abrió en **ZWCAD 2023 Professional** el DXF de la parcela
// 9398516VK3799G que esta aplicación acababa de exportar. El programa se quedó en
// blanco y bloqueado, reteniendo el fichero. **No era la vista: el fichero no
// llegaba a cargar.**
//
// La causa, medida comparando estructuras crudas:
//
//   | fichero                          | secciones                                        | tablas   | versión |
//   |----------------------------------|--------------------------------------------------|----------|---------|
//   | el nuestro (hasta hoy)           | HEADER → TABLES → ENTITIES                        | LAYER    | AC1015  |
//   | los 3 DXF reales de AutoCAD      | HEADER → CLASSES → TABLES → BLOCKS → ENTITIES → OBJECTS | 9 tablas | AC1015  |
//   | los del CATASTRO (ConsultaMasiva)| HEADER → TABLES → ENTITIES                        | LTYPE, LAYER | ninguna |
//
// **Declarábamos `AC1015` (R2000) sin emitir nada de lo que R2000 exige**: ni
// `CLASSES`, ni la tabla `BLOCK_RECORD`, ni la sección `BLOCKS` con `*Model_Space`
// —que es quien POSEE a las entidades—, ni `OBJECTS` con el diccionario raíz. Un
// lector estricto lee la versión, aplica sus reglas y se queda sin suelo.
//
// ⚠️ **Y lo que hace de esto una lección y no una errata: los DOS oráculos que este
// módulo tenía dieron verde.** `ezdxf` abre el fichero con `readfile`, audita 0
// errores y 0 arreglos y encuentra las capas en la tabla —porque **rellena por su
// cuenta las tablas que faltan al cargar**, así que jamás se entera de que no
// estaban—; y `parsers/dxf.js` lo relee perfecto. Ni la suite ni `validar:dxf` ni
// el guion 12 podían ver este defecto: hacía falta un CAD. Lo vio un usuario.
//
// ── LA SALIDA ES R12, Y ES UNA ELECCIÓN MEDIDA ──────────────────────────────
// Se probaron tres candidatos en el ZWCAD del usuario. Abren **R12** y **R2000
// completo**; el nuestro con extents añadidas **NO** (lo que descarta que fuera un
// problema de vista). Entre los dos que abren se elige R12:
//
//   · **R12 no tiene grafo de handles.** La regla que este módulo ya se había
//     impuesto —«no emitir ninguna referencia cuyo destino no se emita»— pasa de ser
//     una cuerda floja a ser imposible de violar. Aquí se sube el listón: ahora
//     tampoco hay referencias POR NOMBRE colgando, porque `CONTINUOUS` se declara en
//     su tabla `LTYPE` en vez de confiar en que el CAD la traiga.
//   · **Un R2000 correcto son ~18 kB de andamio** (`CLASSES`, `BLOCK_RECORD`,
//     `*Model_Space`, diccionario raíz) **cuya corrección no puede juzgar ningún
//     oráculo automático que tengamos**: ezdxf aprueba igual el andamio bueno y su
//     ausencia. Sería mucho código sostenido por nada — que es exactamente lo que
//     acaba de fallar.
//   · **Es lo que el Catastro le entrega a este mismo público.** `ConsultaMasiva_.dxf`
//     es R12 con `POLYLINE`/`VERTEX`/`SEQEND` y estos peritos lo abren a diario. Es
//     verdad externa y además en la dirección correcta: un DXF hecho PARA abrirse en
//     un CAD, no uno que nosotros leemos.
//
// **Lo que se pierde y no se disimula:** `$INSUNITS = 6` («metros») es de R2000 y
// desaparece, así que el dibujo va sin declaración de unidades — igual que los del
// Catastro. No hay ambigüedad de escala porque las coordenadas son UTM absolutas.
//
// ── QUÉ LLEVA LA CABECERA, Y POR QUÉ TAN POCO ───────────────────────────────
// Dos cosas, y las dos son hechos que podemos respaldar:
//   1. `$ACADVER = AC1009`. **Decir lo que somos es justo lo que no hacíamos.**
//   2. `$EXTMIN`/`$EXTMAX`, calculadas sobre la geometría REALMENTE emitida. Sin
//      ellas la vista abre en el 0,0 y una parcela en UTM está a 4,4 millones de
//      unidades de ahí: pantalla en blanco con un fichero sano. Era el SEGUNDO
//      problema del caso de ZWCAD, independiente del primero.
// No se emiten `$LIMMIN`/`$LIMMAX` ni `$INSBASE`: describen un entorno de dibujo que
// aquí no existe, y emitirlos sería inventar un estado.
//
// ── DE LA ABLACIÓN DE F10 SOBREVIVE LO QUE SIGUE SIENDO CIERTO ──────────────
// ⭐ **Sin la sección TABLES, ezdxf lee el fichero, ve las polilíneas y el auditor da
// 0 errores y 0 arreglos — pero LAS CAPAS NO EXISTEN.** El criterio 3 de la fase
// —«abre en CAD **con las dos capas separadas**»— fallaría entero sin que nada
// avisara. De ahí que el test no compruebe que las entidades NOMBRAN las capas, sino
// que las capas ESTÁN EN LA TABLA.
//
// ── LAS COORDENADAS SALEN A 2 DECIMALES, Y ES LA MISMA CONSTANTE DEL GML ────
// `DECIMALES_COORD` de `gml/anillos.js`, no un «2» nuevo escrito aquí. Es lo que
// hace que **lo que el perito mide en el CAD sea exactamente lo que la Sede
// recibe**: si el DXF llevara la precisión completa del modelo y el GML fuera a
// 2 decimales, las dos superficies no cuadrarían y la diferencia la descubriría el
// usuario, no nosotros (regla de oro 11).
//
// ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
// No entrega el fichero (eso es `gml/descargar.js`), no proyecta nada —las
// coordenadas van en UTM crudo, regla de oro 3—, no lee el reloj y no calcula
// superficies. Y no emite huecos como huecos, porque el formato no tiene esa idea:
// los emite como contornos propios **y lo declara**.

import { DECIMALES_COORD, redondearAnillo } from '../gml/anillos.js'
import { SEVERIDAD, TIPO_EXPORT, crearDeteccionExport, resumirDetecciones } from './_comun.js'

// ── Constantes del formato ───────────────────────────────────────────────────

/**
 * La versión que se emite. **R12**, y la razón está en la cabecera del fichero: es
 * la versión que este módulo puede CUMPLIR entera. `AC1015` era una promesa que no
 * se sostenía y colgaba el CAD del usuario.
 *
 * @readonly
 */
export const ACADVER = 'AC1009'

/**
 * Terminador de línea. **CRLF**, que es lo que llevan los tres DXF reales de
 * AutoCAD de `test/fixtures/parsers/` (medido). LF también pasa el oráculo, pero
 * aquí manda el dato externo: esto es un formato de intercambio y lo va a abrir un
 * programa que no controlamos.
 *
 * ⚠️ Consecuencia para el arnés: la snapshot de bytes necesita **línea propia en
 * `.gitattributes`**, o un clon limpio en otra plataforma la recibe con LF y la
 * prueba se pone roja sin que nadie haya tocado nada. Es exactamente el defecto que
 * F09 encontró en `cp_parcela_9398516VK3799G.gml`.
 *
 * @readonly
 */
export const NL = '\r\n'

/**
 * Las dos capas, con su color de AutoCAD (código de grupo 62, índice ACI).
 *
 * El **2 es el amarillo** de la paleta ACI, que es el color con el que esta
 * aplicación dibuja la geometría del usuario en el mapa (`viewer/_comun.js`,
 * `#FFD600`): quien abra el DXF en el CAD ve lo mismo que veía en pantalla. El
 * **8 es el gris oscuro**, para la geometría oficial, que es fondo contra el que se
 * compara y no debe competir con lo editado.
 *
 * @readonly
 */
export const CAPAS = Object.freeze({
  OFICIAL: Object.freeze({ nombre: 'PARCELA_OFICIAL', color: 8 }),
  EDITADA: Object.freeze({ nombre: 'PARCELA_EDITADA', color: 2 }),
})

/** La capa 0 existe en todo DXF; se declara para no dejarla implícita. */
const CAPA_CERO = Object.freeze({ nombre: '0', color: 7 })

/**
 * El tipo de línea que nombran las tres capas.
 *
 * ⭐ **Se declara en su tabla en vez de darlo por supuesto.** Todo CAD trae
 * `CONTINUOUS` predefinido y el Catastro también lo emite; declararlo cierra la
 * última referencia por nombre que colgaba fuera del fichero. Después de que un
 * hueco estructural nos colgara un CAD, «esto lo traerá el lector» dejó de valer
 * como argumento.
 */
const LTYPE_CONTINUO = Object.freeze({ nombre: 'CONTINUOUS', descripcion: 'Solid line' })

// ── Utillaje de escritura ────────────────────────────────────────────────────

/**
 * Un par (código de grupo, valor) del DXF ASCII, que es estrictamente alternante:
 * línea impar el código, línea par el valor.
 *
 * @param {number|string} codigo
 * @param {number|string} valor
 * @returns {string}
 */
const par = (codigo, valor) => `${codigo}${NL}${valor}`

/** Una coordenada, con la precisión de salida del GML. */
const coord = (n) => n.toFixed(DECIMALES_COORD)

// ── Typedefs ─────────────────────────────────────────────────────────────────

/** @typedef {import('./_comun.js').DeteccionExport} DeteccionExport */

/**
 * @typedef {Object} ResultadoDxf
 * @property {string} dxf  El fichero completo, listo para entregar. **Nunca `null`**:
 *   aunque no haya ni una geometría, sale un DXF válido con sus capas vacías, y las
 *   detecciones dicen que está vacío. Un fichero vacío que abre es más honrado que
 *   un `null` que quien llama tiene que interpretar.
 * @property {DeteccionExport[]} detecciones  Todo lo que se descartó, se redondeó o
 *   se emitió de otra forma (regla de oro 1).
 * @property {{total: number, porTipo: object, porSeveridad: object}} resumen
 * @property {{nombre: string, entidades: number}[]} capas  Qué capas se han escrito
 *   y con cuántas polilíneas cada una. Es lo que el cableado enseña en el acuse.
 */

// ── Composición de las secciones ─────────────────────────────────────────────

/**
 * La sección HEADER. Dos variables y ni una más, y las dos son hechos que se pueden
 * respaldar: la versión que de verdad cumplimos y la envolvente de lo que se emite.
 * Las 250 que trae un DXF de AutoCAD describen un entorno de dibujo que aquí no
 * existe, y emitirlas sería inventar un estado.
 *
 * @param {{minX: number, minY: number, maxX: number, maxY: number}|null} envolvente
 *   `null` cuando no se ha emitido ni una geometría: entonces no hay extents que
 *   declarar y **no se inventan**. Unas extents de 0,0 a 0,0 mandarían la vista del
 *   CAD a un punto donde no hay nada, que es peor que no decir nada.
 * @returns {string[]}
 */
function seccionHeader(envolvente) {
  const lineas = [par(0, 'SECTION'), par(2, 'HEADER'), par(9, '$ACADVER'), par(1, ACADVER)]
  if (envolvente !== null) {
    lineas.push(
      par(9, '$EXTMIN'),
      par(10, coord(envolvente.minX)),
      par(20, coord(envolvente.minY)),
      par(30, '0.0'),
      par(9, '$EXTMAX'),
      par(10, coord(envolvente.maxX)),
      par(20, coord(envolvente.maxY)),
      par(30, '0.0'),
    )
  }
  lineas.push(par(0, 'ENDSEC'))
  return lineas
}

/**
 * La sección TABLES: `LTYPE` y `LAYER`. **Es la que sostiene el criterio 3**: sin
 * ella el fichero abre igual y las capas no existen (ver la cabecera).
 *
 * @param {readonly {nombre: string, color: number}[]} capas
 * @returns {string[]}
 */
function seccionTables(capas) {
  const lineas = [
    par(0, 'SECTION'),
    par(2, 'TABLES'),
    // LTYPE primero: las capas de abajo lo nombran, y una tabla que se nombra antes
    // de declararse es justo el tipo de deuda que colgó el CAD.
    par(0, 'TABLE'),
    par(2, 'LTYPE'),
    par(70, 1),
    par(0, 'LTYPE'),
    par(2, LTYPE_CONTINUO.nombre),
    par(70, 64),
    par(3, LTYPE_CONTINUO.descripcion),
    par(72, 65), // 'A', el código de alineación; es el único valor que R12 admite
    par(73, 0), // sin tramos: la línea es continua
    par(40, '0.0'), // longitud total del patrón
    par(0, 'ENDTAB'),
    par(0, 'TABLE'),
    par(2, 'LAYER'),
    par(70, capas.length),
  ]
  for (const capa of capas) {
    lineas.push(
      par(0, 'LAYER'),
      par(2, capa.nombre),
      par(70, 0), // sin banderas: ni congelada, ni bloqueada, ni oculta
      par(62, capa.color),
      par(6, LTYPE_CONTINUO.nombre), // y ahora su destino ESTÁ en el fichero
    )
  }
  lineas.push(par(0, 'ENDTAB'), par(0, 'ENDSEC'))
  return lineas
}

/**
 * Una polilínea cerrada, en la forma clásica `POLYLINE` → `VERTEX`… → `SEQEND`.
 *
 * El anillo entra **abierto** (regla de oro 4: el modelo no guarda el vértice de
 * cierre) y sale con `70=1`, que es la bandera de «cerrada». **No se repite el
 * primer vértice al final**, y esa es una diferencia deliberada con los DXF reales
 * del repo: los suyos repiten el vértice, que es cómo AutoCAD guarda una polilínea
 * que el usuario cerró a ojo. Emitir la bandera dice lo mismo sin depender de que
 * dos coordenadas coincidan hasta el último decimal.
 *
 * ⚠️ **Sin punto mudo `10/20/30` en la cabecera y sin `30` en los vértices.** El
 * manual de R12 describe el punto mudo, pero ni el DXF del Catastro ni el fixture
 * `poly_clasica.dxf` del repo lo llevan, y un `30` por vértice haría que
 * `parsers/dxf.js` declarase una `Z_DESCARTADA` que no existe: estaríamos emitiendo
 * una tercera dimensión que el modelo no tiene para luego avisar de haberla tirado.
 *
 * ⚠️ **La capa va en la cabecera Y en cada `VERTEX` y en el `SEQEND`.** No es
 * redundancia decorativa: es la trampa que `parsers/dxf.js` documenta del fixture
 * real de edificio, y los ficheros del Catastro la etiquetan igual.
 *
 * @param {Array<[number, number]>} vertices  Anillo abierto, YA redondeado.
 * @param {string} capa
 * @returns {string[]}
 */
function polilinea(vertices, capa) {
  const lineas = [
    par(0, 'POLYLINE'),
    par(8, capa),
    par(66, 1), // «detrás vienen VERTEX»; en R12 es obligatorio
    par(70, 1), // cerrada
  ]
  for (const [x, y] of vertices) {
    lineas.push(par(0, 'VERTEX'), par(8, capa), par(10, coord(x)), par(20, coord(y)))
  }
  lineas.push(par(0, 'SEQEND'), par(8, capa))
  return lineas
}

// ── Preparación de la geometría ──────────────────────────────────────────────

/**
 * Redondea un anillo a la precisión de salida y quita los vértices que se funden
 * con el anterior al hacerlo. Devuelve también cuántos se fundieron, para que quien
 * llama pueda declararlo (regla de oro 1).
 *
 * El cierre se comprueba contra el PRIMER vértice además de contra el anterior: un
 * anillo cuyo último vértice colapsa sobre el primero dejaría una polilínea cerrada
 * con un lado de longitud cero.
 *
 * @param {Array<[number, number]>} anillo  Anillo abierto en UTM.
 * @returns {{vertices: Array<[number, number]>, colapsados: number}}
 */
function prepararAnillo(anillo) {
  const redondeado = redondearAnillo(anillo)
  const vertices = []
  let colapsados = 0
  for (const v of redondeado) {
    const anterior = vertices[vertices.length - 1]
    if (anterior && anterior[0] === v[0] && anterior[1] === v[1]) {
      colapsados += 1
      continue
    }
    vertices.push(v)
  }
  while (
    vertices.length > 1 &&
    vertices[0][0] === vertices[vertices.length - 1][0] &&
    vertices[0][1] === vertices[vertices.length - 1][1]
  ) {
    vertices.pop()
    colapsados += 1
  }
  return { vertices, colapsados }
}

/**
 * ¿Es esto una lista de recintos del modelo? Se pide exactamente lo que este
 * módulo usa: un array de `{vertices: [[x,y], …]}`.
 *
 * @param {*} v
 * @returns {boolean}
 */
function esListaDeRecintos(v) {
  return Array.isArray(v) && v.every((r) => r && typeof r === 'object' && Array.isArray(r.vertices))
}

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Serializa una parcela a DXF R12 con la geometría oficial y la editada en capas
 * separadas.
 *
 * **No lanza por un dato malo del usuario** —una parcela sin geometría oficial, un
 * anillo degenerado, un hueco— : eso sale por `detecciones`. El `throw` se reserva
 * al contrato roto por el programador (SPEC §2.1), y a las coordenadas fuera del
 * rango publicable, que las rechaza `gml/anillos.js#redondearCoord` con su motivo.
 *
 * @param {object} opciones
 * @param {Array<{vertices: Array<[number, number]>}>} [opciones.recintosEditados=[]]
 *   Los recintos del modelo (`parcela.recintos`). `recintos[0]` es el exterior y el
 *   resto son huecos; ver {@link TIPO_EXPORT}`.HUECO_EXPORTADO`.
 * @param {Array<{vertices: Array<[number, number]>}>|null} [opciones.recintosOficiales=null]
 *   `parcela.geometriaOficial`. `null` cuando la parcela no vino del Catastro: sale
 *   una capa en vez de dos y se declara.
 * @returns {ResultadoDxf}
 * @throws {TypeError}   Si los recintos no tienen la forma del modelo.
 * @throws {RangeError}  Lo que lance `redondearCoord` (coordenada no finita o fuera
 *   del rango publicable).
 */
export function serializarParcelaDxf(opciones = {}) {
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(
      `serializarParcelaDxf: se esperaba un objeto de opciones; recibido ${JSON.stringify(opciones)}.`,
    )
  }
  const { recintosEditados = [], recintosOficiales = null } = opciones

  if (!esListaDeRecintos(recintosEditados)) {
    throw new TypeError(
      `serializarParcelaDxf: 'recintosEditados' debe ser un array de recintos del modelo ` +
        `({vertices: [[x,y], …]}); recibido ${JSON.stringify(recintosEditados)}.`,
    )
  }
  if (recintosOficiales !== null && !esListaDeRecintos(recintosOficiales)) {
    throw new TypeError(
      `serializarParcelaDxf: 'recintosOficiales' debe ser un array de recintos del modelo o ` +
        `null; recibido ${JSON.stringify(recintosOficiales)}.`,
    )
  }

  /** @type {DeteccionExport[]} */
  const detecciones = []

  // La envolvente de lo REALMENTE emitido, para `$EXTMIN`/`$EXTMAX`. Se acumula
  // sobre los vértices ya redondeados, no sobre los de entrada: las extents tienen
  // que describir el dibujo que el CAD va a ver, no el modelo del que salió.
  let envolvente = null
  const abarcar = (x, y) => {
    if (envolvente === null) envolvente = { minX: x, minY: y, maxX: x, maxY: y }
    else {
      envolvente.minX = Math.min(envolvente.minX, x)
      envolvente.minY = Math.min(envolvente.minY, y)
      envolvente.maxX = Math.max(envolvente.maxX, x)
      envolvente.maxY = Math.max(envolvente.maxY, y)
    }
  }

  // ── Las capas van SIEMPRE las dos a la tabla, tenga o no geometría cada una ──
  // Una capa declarada y vacía dice «aquí no había nada»; una capa ausente deja al
  // usuario preguntándose si el exportador se la comió.
  const capas = [CAPA_CERO, CAPAS.OFICIAL, CAPAS.EDITADA]
  const lineasTablas = seccionTables(capas)

  // ── Entidades ─────────────────────────────────────────────────────────────
  const lineasEntidades = [par(0, 'SECTION'), par(2, 'ENTITIES')]
  const cuenta = { [CAPAS.OFICIAL.nombre]: 0, [CAPAS.EDITADA.nombre]: 0 }

  /**
   * Vuelca una lista de recintos en una capa, declarando lo que pasa por el camino.
   *
   * @param {Array<{vertices: Array<[number, number]>}>} recintos
   * @param {{nombre: string}} capa
   * @param {string} queEs  Cómo se llama esta geometría en los mensajes.
   */
  function volcar(recintos, capa, queEs) {
    recintos.forEach((recinto, i) => {
      const { vertices, colapsados } = prepararAnillo(recinto.vertices)

      if (colapsados > 0) {
        detecciones.push(
          crearDeteccionExport(
            TIPO_EXPORT.COLAPSO_POR_REDONDEO,
            `En ${queEs}, ${colapsados} vértice(s) coincidían con el anterior al redondear a ` +
              `${DECIMALES_COORD} decimales y no se han emitido. Es el mismo redondeo con el que ` +
              'se genera el GML, así que el CAD y el fichero que se presenta dicen lo mismo.',
            SEVERIDAD.INFO,
            { capa: capa.nombre, recinto: i, colapsados },
          ),
        )
      }

      if (vertices.length < 3) {
        detecciones.push(
          crearDeteccionExport(
            TIPO_EXPORT.ANILLO_DESCARTADO,
            `En ${queEs}, un contorno se ha quedado en ${vertices.length} vértice(s) y no se ha ` +
              'emitido: con menos de tres no hay superficie que dibujar.',
            SEVERIDAD.AVISO,
            { capa: capa.nombre, recinto: i, vertices: vertices.length },
          ),
        )
        return
      }

      if (i > 0) {
        detecciones.push(
          crearDeteccionExport(
            TIPO_EXPORT.HUECO_EXPORTADO,
            `En ${queEs}, un hueco sale como contorno cerrado propio en la capa ` +
              `«${capa.nombre}». El DXF no tiene el concepto de hueco: en el CAD se verán dos ` +
              'contornos, y la superficie del recinto es la del exterior menos la de este.',
            SEVERIDAD.AVISO,
            { capa: capa.nombre, recinto: i },
          ),
        )
      }

      lineasEntidades.push(...polilinea(vertices, capa.nombre))
      for (const [x, y] of vertices) abarcar(x, y)
      cuenta[capa.nombre] += 1
    })
  }

  if (recintosOficiales === null) {
    detecciones.push(
      crearDeteccionExport(
        TIPO_EXPORT.SIN_GEOMETRIA_OFICIAL,
        'Esta parcela no trae la geometría oficial del Catastro, así que el DXF sale con una sola ' +
          `capa dibujada («${CAPAS.EDITADA.nombre}»). La capa «${CAPAS.OFICIAL.nombre}» está creada ` +
          'y vacía. Trae la parcela del Catastro si quieres comparar las dos en el CAD.',
        SEVERIDAD.AVISO,
      ),
    )
  } else {
    volcar(recintosOficiales, CAPAS.OFICIAL, 'la geometría oficial')
  }
  volcar(recintosEditados, CAPAS.EDITADA, 'la geometría editada')

  for (const capa of [CAPAS.OFICIAL, CAPAS.EDITADA]) {
    if (cuenta[capa.nombre] === 0 && !(capa === CAPAS.OFICIAL && recintosOficiales === null)) {
      detecciones.push(
        crearDeteccionExport(
          TIPO_EXPORT.CAPA_VACIA,
          `La capa «${capa.nombre}» se ha creado en el fichero pero no lleva ningún contorno.`,
          SEVERIDAD.AVISO,
          { capa: capa.nombre },
        ),
      )
    }
  }

  lineasEntidades.push(par(0, 'ENDSEC'))

  // La cabecera se compone la ÚLTIMA aunque se escriba la primera: hasta aquí no se
  // sabe la envolvente de lo emitido, y unas extents inventadas serían peores que
  // ninguna.
  const lineas = [
    ...seccionHeader(envolvente),
    ...lineasTablas,
    ...lineasEntidades,
    par(0, 'EOF'),
  ]

  return {
    dxf: lineas.join(NL) + NL,
    detecciones,
    resumen: resumirDetecciones(detecciones),
    capas: [
      { nombre: CAPAS.OFICIAL.nombre, entidades: cuenta[CAPAS.OFICIAL.nombre] },
      { nombre: CAPAS.EDITADA.nombre, entidades: cuenta[CAPAS.EDITADA.nombre] },
    ],
  }
}

export default serializarParcelaDxf
