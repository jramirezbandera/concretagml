/* -------------------------------------------------------------------------- *
 * app/salidas.js — ¿SE PUEDE ENTREGAR ESTO AHORA MISMO, Y SI NO, POR QUÉ      *
 * -------------------------------------------------------------------------- */
//
// ═════════════════════════════════════════════════════════════════════════════
// QUÉ DEUDA CIERRA ESTE FICHERO
// ═════════════════════════════════════════════════════════════════════════════
// «Las salidas no saben decir si se pueden», anotado en `TODOS.md` el 2026-08-09 y
// **bloqueado por la rebanada 3 del topbar**: antes no había menú al que le
// sirviera. El menú existe desde el 2026-08-11, así que el aplazamiento caducó.
//
// El contrato de esta aplicación es «apagado CON MOTIVO, jamás apagado y mudo».
// Los tres peldaños del recorrido lo cumplen (`app/navegacion.js#evaluarPaso`).
// «Generar GML» lo cumple. Las cuatro salidas —DXF, listado `.txt`, hoja `.xlsx`
// y proyecto `.json`— **no podían cumplirlo, y no por descuido de la interfaz**:
// su disponibilidad NO EXISTÍA COMO DATO. Existía solo como el error que salía al
// intentarlo, dentro de cuatro funciones de `app/cableado-expediente.js`:
//
//     function exportarDxf() {
//       if (bloqueaLaRamaEdificio()) return      // ← el motivo, dicho al pulsar
//       if (!hayGeometria(parcela)) { decir(…); return }
//       …
//
// Un menú no puede apagar una opción a partir de eso. Puede llamar y ver qué pasa,
// que es justo lo que no se quiere.
//
// ── POR QUÉ ES UN MÓDULO APARTE, Y NO UN MÉTODO DEL CABLEADO ────────────────
// Ésta era la pregunta de diseño que `TODOS.md` dejó escrita: «dónde vive el
// predicado: junto a la acción, o en un módulo neutro que ni el diálogo ni la
// barra posean». La respuesta es la segunda, por lo que aquella nota ya avisaba:
// hay DOS superficies de interfaz que necesitan la misma respuesta —el
// desplegable de la barra y el `<dialog>` de expedientes—, y colgar el predicado
// de una de ellas acopla la otra a su dueña. La propuesta que se descartó el
// 2026-08-09 («el menú se fabrica desde una tabla exportada por el diálogo») era
// exactamente ese acoplamiento.
//
// ── LA FORMA NO ES NUEVA: ES LA DE `app/navegacion.js` ──────────────────────
// Este módulo es el gemelo de `evaluarPaso` para las salidas, y se ha escrito
// deliberadamente con su misma anatomía: una función PURA, los hechos entrando
// como booleanos ya resueltos por quien sí conoce el modelo, los motivos
// redactados AQUÍ —quien decide redacta, quien pinta no escribe ni una palabra en
// español— y dos formas del mismo motivo (larga y breve) para los dos sitios
// donde se leen. Copiar la anatomía de algo que ya funciona y tiene guardianes es
// más barato que inventar una segunda manera de decir lo mismo, y sobre todo hace
// que quien lea uno de los dos ficheros ya sepa leer el otro.
//
// ⛔ **NO CONOCE EL DOM, NI EL STORE, NI LAS RAMAS DEL CABLEADO.** No importa
// `app/cableado-expediente.js` (sería un ciclo: es él quien importa esto) ni
// `app/dialogo-expediente.js` (sería el acoplamiento que este módulo existe para
// evitar). Lo único que entra son dos booleanos y una rama.
//
// ── LO QUE ESTE MÓDULO **NO** DECIDE ────────────────────────────────────────
// Si la entrega sale bien. Un `disponible: true` dice que la acción tiene sentido
// pedirla, no que el navegador vaya a dejar bajar el fichero: eso lo sigue
// contando `entregar()` por su renglón de acuse, con su rama de error. Esto es un
// predicado de DOMINIO, no una promesa sobre la descarga.

/**
 * Las cuatro salidas, por su identificador de acción.
 *
 * ⚠️ **Los literales están escritos aquí y NO importados de `ACCION`**
 * (`app/dialogo-expediente.js`), que es el vocabulario único del embudo de
 * acciones. Es deliberado y es el mismo trato que `REBANADAS` tiene con `PASOS` en
 * `scripts/presupuesto-css.mjs`: importar el enum traería a un módulo neutro la
 * superficie de interfaz de la que tiene que ser independiente.
 *
 * Lo que sustituye a la importación es un GUARDIÁN, no la buena voluntad:
 * `test/app/salidas.test.js` afirma que estos cuatro valores son exactamente los
 * cuatro `ACCION.EXPORTAR_*`. Si alguien renombra una acción, sale rojo en
 * `npm run test:node` en vez de dejar una opción del menú que no se apaga nunca.
 *
 * @readonly
 */
export const SALIDA = Object.freeze({
  DXF: 'exportar-dxf',
  COORDENADAS: 'exportar-coordenadas',
  EXCEL: 'exportar-excel',
  PROYECTO: 'exportar-proyecto',
})

/** Las cuatro, en el orden en el que se ofrecen. @readonly @type {readonly string[]} */
export const SALIDAS = Object.freeze([
  SALIDA.DXF,
  SALIDA.COORDENADAS,
  SALIDA.EXCEL,
  SALIDA.PROYECTO,
])

/**
 * Las dos ramas, con los mismos valores que `app/navegacion.js#RAMA`.
 *
 * Se repiten aquí por lo mismo que {@link SALIDA} y con el mismo guardián detrás:
 * `navegacion.js` cuelga de `viewer/_comun.js` y traerlo entero a un predicado de
 * cuatro líneas es cargar media aplicación para leer dos cadenas.
 *
 * @readonly
 */
export const RAMA = Object.freeze({ PARCELA: 'PARCELA', EDIFICIO: 'EDIFICIO' })

/**
 * Por qué no se puede, en el eje en el que no se puede. Gemelo del `CAUSA` de
 * `app/navegacion.js`, y por el mismo motivo: quien pinta a veces necesita saber
 * si el obstáculo se quita trabajando o solo cambiando de rama.
 *
 * · `RAMA` — esta salida no es de la rama activa. No se arregla trabajando.
 * · `DATO` — falta el documento. Se arregla trayéndolo.
 *
 * @readonly
 */
export const CAUSA = Object.freeze({ RAMA: 'RAMA', DATO: 'DATO' })

// ── Los hechos: lo único que entra de fuera ─────────────────────────────────

/**
 * Las dos cosas que este módulo necesita saber, y **las únicas**. Booleanos ya
 * resueltos por quien conoce el modelo; aquí no se abre ni un POJO. Quién los
 * calcula, para que no haya que adivinarlo:
 *
 * · `parcela`  — ¿hay una parcela con geometría? Es `hayGeometria(estado.get())`
 *                (`app/cableado-expediente.js`), o sea un exterior con al menos un
 *                vértice.
 * · `edificio` — ¿hay un edificio? Es `hayEdificio(edificioActual())` (ídem), y
 *                ojo: **un edificio con CERO partes SÍ cuenta**, porque es el punto
 *                de partida de la obra nueva. Es la misma vara que usa el rail.
 *
 * ⚠️ **Son los DOS a la vez y no «el de la rama activa»**, que es la diferencia con
 * los hechos del rail. Aquí hace falta así porque `exportar-proyecto` es la única
 * salida que sirve para las dos ramas y su motivo cambia según cuál esté puesta:
 * decir «no hay ninguna parcela» a quien está mirando un edificio le manda a
 * arreglar lo que no le desbloquea nada — el error exacto que
 * `MOTIVO_DATO_EDIFICIO` vino a corregir en el rail.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CLAVES_HECHOS = Object.freeze(['parcela', 'edificio'])

/**
 * Cómo arranca la aplicación: sin nada. Se congela y se COPIA en cada uso, igual
 * que su gemelo del rail: devolver esta referencia dejaría que un llamante la
 * mutara para todos.
 *
 * @readonly
 */
export const HECHOS_VACIOS = Object.freeze({ parcela: false, edificio: false })

// ── Los motivos, que son el producto de este módulo tanto como el estado ─────
//
// ⚠️ **LOS TRES VENÍAN DE `app/cableado-expediente.js` Y SE HAN MUDADO AQUÍ, no
// copiado.** Aquel fichero los re-exporta para no romper a sus importadores. La
// mudanza es la mitad del trabajo: mientras el motivo viviera junto a la acción, un
// menú que quisiera decirlo tendría que importar el cableado entero, y dos
// superficies de interfaz habrían acabado con dos redacciones del mismo obstáculo.
//
// ⭐ **DOS FORMAS DEL MISMO MOTIVO, como en el rail**: la LARGA dice qué no se puede,
// por qué, y qué hacer en su lugar; la BREVE dice qué falta. Se leen en sitios
// distintos —la larga en el `title` de la opción y en el renglón de acuse, la breve
// como nombre accesible pegado a la opción apagada— y por eso no son la misma frase.

/**
 * Cuando no hay ninguna parcela en pantalla.
 *
 * ⚠️ **Su texto habla también de «guardar», y eso NO es un descuido de la mudanza**:
 * es el mismo hecho —no hay parcela— y lo leen los dos sitios. Escribir dos frases
 * para un solo hecho es lo que deja que una de las dos se quede rancia; ya pasó en
 * este repositorio con `MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO`, que enumeraba dos
 * salidas cuando ya eran tres.
 */
export const MENSAJE_SIN_PARCELA =
  'No hay ninguna parcela en pantalla: no hay nada que guardar ni que exportar.'

/** Cuando se pide exportar el proyecto y el store de edificio está vacío. */
export const MENSAJE_SIN_EDIFICIO =
  'No hay ningún edificio en pantalla: no hay nada que exportar. Carga uno desde un fichero o ' +
  'desde el Catastro, en la rama Edificio.'

/**
 * Por qué el DXF y los dos listados de coordenadas no bajan con la rama EDIFICIO
 * activa.
 *
 * Los tres escritores son de PARCELA —`serializarParcelaDxf`,
 * `serializarCoordenadasTxt` y `serializarCoordenadasExcel` hablan de recintos, y el
 * nombre del fichero saldría con la referencia catastral de la parcela—, así que
 * dejarlos correr entregaría **el documento de la otra rama, en silencio**, que es
 * exactamente lo que F11 no puede publicar (regla de oro 1).
 *
 * ⚠️ **Este texto ENUMERA las salidas, así que caduca cada vez que se añade una.** Ya
 * pasó con el Excel de F20: decía «El DXF y el listado de coordenadas» cuando ya eran
 * tres. Un mensaje que enumera hay que revisarlo al ampliar `FICHERO`, y por eso su
 * prueba lo comprueba contra el catálogo y no contra una cadena escrita a mano.
 */
export const MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO =
  'El DXF y los listados de coordenadas (.txt y .xlsx) son de la parcela, y ahora mismo estás en ' +
  'la rama Edificio: no se ha descargado nada para no entregarte el dibujo de otra cosa. Vuelve a ' +
  'la rama Parcela para exportarlos, o usa «Guardar proyecto (.json)», que sí se lleva el edificio.'

/**
 * El mismo motivo en tres palabras, para el nombre accesible de la opción apagada.
 *
 * ── POR QUÉ HAY UNA FORMA BREVE SI NUNCA SE VE ─────────────────────────────
 * Una opción de menú `disabled` cuyo nombre accesible es «Exportar para CAD .dxf» a
 * secas le dice a quien va por lector de pantalla que no puede, y nada más. La
 * receta de la casa —la que el rail volvió a decidir el 2026-08-11— es un `<span>`
 * de texto oculto dentro del botón con la forma breve, más la larga en el `title`.
 * Así el nombre accesible pasa a ser «Exportar para CAD .dxf · Falta la parcela».
 *
 * ⛔ **Y NO se mete aquí la forma larga.** Un nombre accesible de 300 caracteres es
 * peor que uno corto: el lector lo recita entero cada vez que el foco pasa por
 * encima. Lo largo se dice donde se pide, no donde se pasa.
 *
 * ⚠️ **No hay tope de 22 como en el rail**, y la diferencia es de sitio, no de
 * gusto: el `MOTIVO_BREVE` del rail comparte una barra horizontal con la marca, el
 * recorrido y la entrega, y su tope está medido en píxeles. Esto no ocupa ninguno.
 * Se escriben cortos porque un nombre accesible corto se lee mejor.
 *
 * @readonly
 */
export const MOTIVO_BREVE = Object.freeze({
  parcela: 'Falta la parcela',
  edificio: 'Falta el edificio',
  rama: 'Estás en Edificio',
})

// ── La regla ────────────────────────────────────────────────────────────────

/**
 * Qué necesita cada salida. Tabla y no `if`, por lo mismo que `REGLA` en
 * `app/navegacion.js`: añadir la quinta salida tiene que ser añadir una fila.
 *
 * · `ramas`  — en cuáles tiene sentido. Fuera de ellas la causa es {@link CAUSA.RAMA}.
 * · `hecho`  — qué clave de {@link CLAVES_HECHOS} exige, por rama.
 *
 * ⚠️ `PROYECTO` es la ÚNICA que sirve para las dos, y exige un hecho DISTINTO en
 * cada una. Ése es todo el motivo por el que este módulo recibe los dos hechos y no
 * «el de la rama activa».
 */
const REGLA = Object.freeze({
  [SALIDA.DXF]: { ramas: [RAMA.PARCELA], hecho: { [RAMA.PARCELA]: 'parcela' } },
  [SALIDA.COORDENADAS]: { ramas: [RAMA.PARCELA], hecho: { [RAMA.PARCELA]: 'parcela' } },
  [SALIDA.EXCEL]: { ramas: [RAMA.PARCELA], hecho: { [RAMA.PARCELA]: 'parcela' } },
  [SALIDA.PROYECTO]: {
    ramas: [RAMA.PARCELA, RAMA.EDIFICIO],
    hecho: { [RAMA.PARCELA]: 'parcela', [RAMA.EDIFICIO]: 'edificio' },
  },
})

/**
 * ¿Se puede entregar esta salida ahora mismo, y si no, por qué? **La única función
 * que decide**, y pura: mismas entradas, misma respuesta, sin store y sin DOM.
 *
 * @param {string} salida  Una de {@link SALIDA}.
 * @param {{rama: string, hechos: {parcela: boolean, edificio: boolean}}} situacion
 * @returns {{disponible: boolean, causa: string|null, motivo: string|null, breve: string|null}}
 * @throws {RangeError} Si la salida no es una de las cuatro. Es un contrato roto
 *   del programador, no un estado del usuario: devolver «no disponible» lo
 *   escondería detrás de una opción que se apaga sola y nadie sabría por qué.
 */
export function evaluarSalida(salida, { rama, hechos }) {
  const regla = REGLA[salida]
  if (regla === undefined) {
    throw new RangeError(
      `evaluarSalida: salida desconocida ${JSON.stringify(salida)}. Las únicas son ` +
        `${SALIDAS.join(', ')}.`,
    )
  }
  // 1 · RAMA — lo que esta salida no es. No se arregla trabajando.
  if (!regla.ramas.includes(rama)) {
    return {
      disponible: false,
      causa: CAUSA.RAMA,
      motivo: MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO,
      breve: MOTIVO_BREVE.rama,
    }
  }
  // 2 · DATO — lo único que se resuelve solo trayendo el documento.
  const hecho = regla.hecho[rama]
  if (hechos?.[hecho] !== true) {
    return {
      disponible: false,
      causa: CAUSA.DATO,
      // El de la rama manda: mandar a traer una parcela a quien está mirando un
      // edificio es mandarle a hacer lo que no le desbloquea nada.
      motivo: hecho === 'edificio' ? MENSAJE_SIN_EDIFICIO : MENSAJE_SIN_PARCELA,
      breve: MOTIVO_BREVE[hecho],
    }
  }
  return { disponible: true, causa: null, motivo: null, breve: null }
}

/**
 * Las cuatro de golpe, que es lo que necesita quien pinta un menú.
 *
 * Existe para que el aplicador no tenga que conocer {@link SALIDAS} ni el orden:
 * pide el estado y recorre lo que le den. Es la misma comodidad que `rail()` le da
 * a `app/barra.js`.
 *
 * @param {{rama: string, hechos: {parcela: boolean, edificio: boolean}}} situacion
 * @returns {Array<{salida: string, disponible: boolean, causa: string|null,
 *   motivo: string|null, breve: string|null}>}
 */
export function evaluarSalidas(situacion) {
  return SALIDAS.map((salida) => ({ salida, ...evaluarSalida(salida, situacion) }))
}

export default evaluarSalida
