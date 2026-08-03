// export/dxf.js — F10 · T2.2. EL DXF PARA EL CAD, escrito a mano.
//
// Cierra el círculo que F01 abrió: aquella fase aprendió a LEER un DXF de AutoCAD
// (`parsers/dxf.js`), y esta aprende a escribirlo. Emite **la parcela oficial junto
// a la editada, en capas separadas**, que es lo que el perito abre en el CAD para
// comparar las dos con las herramientas que ya sabe usar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ⛔ EL OVERRIDE O12, AL PIE DE LA LETRA, PRODUCE UN FICHERO QUE NO ABRE
// ═══════════════════════════════════════════════════════════════════════════════
// `spec/feature-10-persistencia-export.md` manda emitir, literalmente:
//
//     HEADER ($ACADVER AC1015) → TABLES (LAYER) → ENTITIES → EOF
//     LWPOLYLINE: 0=LWPOLYLINE, 8=capa, 90=nº vértices, 70=1, y 10/20 por vértice
//
// Escrito así y pasado por `ezdxf` —una implementación independiente del formato—
// el resultado es:
//
//     DXFStructureError: missing 'AcDbPolyline' subclass in LWPOLYLINE
//
// No se lee mal: **no se abre**. Faltan los MARCADORES DE SUBCLASE `100=AcDbEntity`
// (antes del `8`) y `100=AcDbPolyline` (después), que el override no menciona y que
// los tres DXF reales de AutoCAD del repo sí llevan. Medido el 2026-08-03.
//
// ⚠️ **Y lo que convierte esto en una lección y no en una errata:** `parsers/dxf.js`
// —nuestro propio lector— lee ese fichero roto tan feliz: dos anillos, coordenadas
// exactas, cero detecciones. La prueba de ida y vuelta que iba a ser la red de
// seguridad **habría salido verde con un DXF que no abre en ninguna parte**. Por eso
// el oráculo de este módulo es `ezdxf` y nuestro parser es el SEGUNDO, no el primero.
//
// ── QUÉ SOSTIENE EL PESO, MEDIDO POR ABLACIÓN (12 piezas, una fuera cada vez) ──
// Solo TRES cosas son imprescindibles para que un lector independiente abra el
// fichero y lo audite sin un solo arreglo:
//   1. `100=AcDbEntity` en cada entidad;
//   2. `100=AcDbPolyline` en cada LWPOLYLINE;
//   3. el handle (`5`) en la CABECERA de la tabla LAYER — sin él, el auditor de
//      ezdxf «arregla» la tabla, y un fichero que hay que arreglar al abrirlo no es
//      un fichero que se pueda firmar.
// Todo lo demás salió opcional: handles de entidad, `330`, `$HANDSEED`,
// `$INSUNITS`, `6=CONTINUOUS`, `390`, los `100` de la tabla, y CRLF frente a LF.
//
// ⭐ **Y la trampa gorda: sin la sección TABLES, ezdxf lee el fichero, ve las dos
// polilíneas y el auditor da 0 errores y 0 arreglos — pero LAS CAPAS NO EXISTEN.**
// Las entidades dicen `PARCELA_OFICIAL` y `PARCELA_EDITADA`, y preguntarle al
// documento si esas capas están devuelve `False` para las dos. El criterio 3 de la
// fase —«abre en CAD **con las dos capas separadas**»— fallaría entero sin que nada
// avisara. De ahí que el test no compruebe que las entidades NOMBRAN las capas, sino
// que las capas ESTÁN EN LA TABLA.
//
// ── QUÉ SE EMITE DE MÁS, Y POR QUÉ NO ES «POR SI ACASO» ─────────────────────
// Se emiten cosas que la ablación declaró opcionales, y conviene justificar cada
// una, porque este proyecto no emite nada «por si acaso»:
//   · **ezdxf no es AutoCAD.** Lo único que la ablación demuestra es qué necesita
//     ESE lector. Donde un DXF real de AutoCAD lleva algo y cuesta una línea, se
//     emite: es la elección conservadora para un formato de intercambio que va a
//     abrir un tercero con un programa que aquí no hay.
//   · **Y con un límite duro: no se emite ninguna REFERENCIA POR HANDLE cuyo
//     destino no se emita también.** Por eso hay `330` en los registros de capa
//     (apuntan a la cabecera de la tabla, que sí está) y NO lo hay en las entidades
//     (apuntaría al BLOCK_RECORD del espacio-modelo, que no se emite), y por eso no
//     hay `390` (apuntaría al estilo de trazado, que vive en OBJECTS). Un handle
//     colgando es peor que un campo opcional ausente.
//   · `6=CONTINUOUS` sí se emite aunque tampoco haya tabla LTYPE, y la diferencia
//     no es un capricho: es una referencia POR NOMBRE a un tipo de línea que todo
//     CAD trae predefinido, no un handle a un objeto de este fichero.
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
 * La versión que se emite. **R2000**, y no el R12 del plan v4 ni el R14 del
 * override: `LWPOLYLINE` se introdujo en R14 (`AC1014`), pero las herramientas del
 * mundo real saltan de R12 a R2000 y no escriben R13/R14, así que un `AC1014` es
 * una versión que casi nadie produce y que por tanto casi nadie prueba.
 *
 * @readonly
 */
export const ACADVER = 'AC1015'

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

/** Handle de la cabecera de la tabla LAYER. Convencional y fijo. */
const HANDLE_TABLA_LAYER = '2'

/** Primer handle libre para registros y entidades. Por debajo van las tablas. */
const PRIMER_HANDLE = 0x30

/** `$INSUNITS = 6` es «metros». El modelo está en UTM, así que no hay duda que dejar. */
const INSUNITS_METROS = 6

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
 * La sección HEADER. Tres variables y ni una más: las 250 que trae un DXF de
 * AutoCAD describen un entorno de dibujo (rejillas, estilos de cota, vistas) que
 * aquí no existe, y emitirlas sería inventar un estado.
 *
 * @param {string} handSeed  Primer handle libre, en hexadecimal.
 * @returns {string[]}
 */
function seccionHeader(handSeed) {
  return [
    par(0, 'SECTION'),
    par(2, 'HEADER'),
    par(9, '$ACADVER'),
    par(1, ACADVER),
    // El siguiente handle libre. Si un CAD añade entidades al fichero, empieza por
    // aquí en vez de arriesgarse a repetir uno de los nuestros.
    par(9, '$HANDSEED'),
    par(5, handSeed),
    par(9, '$INSUNITS'),
    par(70, INSUNITS_METROS),
    par(0, 'ENDSEC'),
  ]
}

/**
 * La sección TABLES con la tabla LAYER. **Es la que sostiene el criterio 3**: sin
 * ella el fichero abre igual y las capas no existen (ver la cabecera).
 *
 * @param {readonly {nombre: string, color: number}[]} capas
 * @param {() => string} siguienteHandle
 * @returns {string[]}
 */
function seccionTables(capas, siguienteHandle) {
  const lineas = [
    par(0, 'SECTION'),
    par(2, 'TABLES'),
    par(0, 'TABLE'),
    par(2, 'LAYER'),
    par(5, HANDLE_TABLA_LAYER), // ← imprescindible: sin esto el auditor «arregla»
    par(100, 'AcDbSymbolTable'),
    par(70, capas.length),
  ]
  for (const capa of capas) {
    lineas.push(
      par(0, 'LAYER'),
      par(5, siguienteHandle()),
      // Propietario: la cabecera de esta misma tabla, que SÍ se emite. Es la única
      // referencia por handle de todo el fichero cuyo destino existe.
      par(330, HANDLE_TABLA_LAYER),
      par(100, 'AcDbSymbolTableRecord'),
      par(100, 'AcDbLayerTableRecord'),
      par(2, capa.nombre),
      par(70, 0), // sin banderas: ni congelada, ni bloqueada, ni oculta
      par(62, capa.color),
      par(6, 'CONTINUOUS'), // referencia por NOMBRE, no por handle (ver la cabecera)
    )
  }
  lineas.push(par(0, 'ENDTAB'), par(0, 'ENDSEC'))
  return lineas
}

/**
 * Una `LWPOLYLINE` cerrada.
 *
 * El anillo entra **abierto** (regla de oro 4: el modelo no guarda el vértice de
 * cierre) y sale con `70=1`, que es la bandera de «cerrada». **No se repite el
 * primer vértice al final**, y esa es una diferencia deliberada con los DXF reales
 * del repo: los suyos llevan `70=0` y repiten el vértice, que es cómo AutoCAD
 * guarda una polilínea que el usuario cerró a ojo. Emitir la bandera dice lo mismo
 * sin depender de que dos coordenadas coincidan hasta el último decimal.
 *
 * @param {Array<[number, number]>} vertices  Anillo abierto, YA redondeado.
 * @param {string} capa
 * @param {string} handle
 * @returns {string[]}
 */
function lwpolyline(vertices, capa, handle) {
  const lineas = [
    par(0, 'LWPOLYLINE'),
    par(5, handle),
    // Aquí NO va `330`: apuntaría al BLOCK_RECORD del espacio-modelo, que este
    // fichero no emite, y un handle colgando es peor que un campo ausente.
    par(100, 'AcDbEntity'), // ⛔ sin esto, ezdxf no abre el fichero
    par(8, capa),
    par(100, 'AcDbPolyline'), // ⛔ ni sin esto
    par(90, vertices.length),
    par(70, 1), // cerrada
  ]
  for (const [x, y] of vertices) {
    lineas.push(par(10, x.toFixed(DECIMALES_COORD)), par(20, y.toFixed(DECIMALES_COORD)))
  }
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
 * Serializa una parcela a DXF R2000 con la geometría oficial y la editada en capas
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

  let handle = PRIMER_HANDLE
  const siguienteHandle = () => (handle++).toString(16).toUpperCase()

  // ── Las capas van SIEMPRE las dos a la tabla, tenga o no geometría cada una ──
  // Una capa declarada y vacía dice «aquí no había nada»; una capa ausente deja al
  // usuario preguntándose si el exportador se la comió.
  const capas = [CAPA_CERO, CAPAS.OFICIAL, CAPAS.EDITADA]
  const lineasTablas = seccionTables(capas, siguienteHandle)

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

      lineasEntidades.push(...lwpolyline(vertices, capa.nombre, siguienteHandle()))
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

  // `$HANDSEED` se escribe al final porque solo entonces se sabe cuántos handles se
  // han gastado. Es el motivo por el que la cabecera se compone la última aunque se
  // escriba la primera.
  const lineas = [
    ...seccionHeader(handle.toString(16).toUpperCase()),
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
