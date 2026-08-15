// app/dialogo-importacion.js — F18 · T1 · El `<dialog>` que revisa una medición.
//
// ── QUÉ ES ESTO Y POR QUÉ EXISTE ────────────────────────────────────────────
// F01 escribió los detectores defensivos —X/Y invertidas, geográficas pegadas,
// cierre que no cierra, reparto por capas— y su ficha pedía «la UI de lo que F00
// dejó como detectores puros». Esa UI **nunca se construyó**: en F01 no había
// aplicación (nace en F03) y `parsers/importar.js` se quedó once fases sin un solo
// llamante en producción. Este módulo es esa UI, y F18 su llamante.
//
// `importar()` **nunca corrige en silencio** (regla de oro 1): devuelve el dato
// como está, dice lo que ha visto y **ofrece** la corrección por opción. Sin una
// pantalla que enseñe la oferta, esa promesa se quedaba a medias — la oferta
// existía y no había forma humana de aceptarla.
//
// ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
//   · **No lee ficheros ni llama a `importar()`.** Recibe un resultado ya medido y
//     devuelve las OPCIONES que el llamante debe usar en la segunda pasada. Quien
//     orquesta las dos pasadas es `app/cableado-medicion.js`.
//   · **No decide si hay que abrirlo.** Eso se pregunta con {@link decisionesDe},
//     que es pura y se puede probar sin DOM.
//   · **No conoce el modelo.** No construye una `Parcela` ni sabe que existe un
//     store: entra un `ResultadoImportacion`, sale un objeto de opciones.
//   · **No toca `index.html`.** Fabrica su propio `<dialog>` y lo cuelga del
//     `<body>`, como `app/dialogo-informe.js` (F09), `app/dialogo-expediente.js`
//     (F10) y los dos de `app/panel-edificio.js` (F11).
//
// ── LAS TRES COSAS QUE ABREN ESTA PANTALLA, Y LA QUE NO ─────────────────────
// Se abre **solo cuando hay algo que decidir**, que es el mismo criterio que ya
// sigue la rama de edificio (`app/cableado-edificio.js` abre el reparto únicamente
// si hay más de una capa). Un `.txt` limpio de coordenadas entra directo y lo
// informativo va a los avisos del panel: un modal obligatorio en el camino feliz
// —y el camino feliz del perito es un volcado de coordenadas— es fricción pura.
//
// Disparan: **el reparto por capas**, **X/Y invertidas**, **el cierre ambiguo** y
// —desde el 2026-08-09— **el huso cuando de verdad es ambiguo**.
//
// ── ⭐ EL HUSO PASÓ DE «NO DISPARA» A DISPARAR, Y LO DECIDIÓ UNA MEDICIÓN ─────
//
// La regla original de F01 es literal: «nunca obligar a elegirlo en un desplegable
// […]; el desplegable queda como anulación» (`spec/feature-01-entrada-parcela.md:29`).
// Se escribió dando por hecho que la deducción acierta y que lo único que falta es
// decir **dónde ha caído**. Ese supuesto es falso, y así se midió el 2026-08-09
// sobre 42 municipios reales llevados a su huso verdadero y devueltos por
// `geo/huso.js#detectarHuso` con los candidatos por defecto:
//
//   · **42 de 42 salían ambiguos.**
//   · **En 22 de 42 el prioritario era el huso EQUIVOCADO** — Galicia, Extremadura,
//     Huelva y Cádiz (huso 29) y Cataluña y Baleares (huso 31) entraban TODAS como
//     huso 30, que es el primero de la lista de prioridad.
//
// Errar el huso no descoloca la parcela un poco: la coloca a **cientos de
// kilómetros**, con la geometría intacta y sin un solo error. Un aviso en el panel
// no es respuesta a eso, porque no hay dónde contestarlo. Así que la ambigüedad
// abre la pantalla —con el prioritario ya marcado, o sea un Enter en el caso
// normal— y el usuario dice dónde está su parcela.
//
// ⚠️ **Solo cuando es ambigua de verdad.** El mismo día, `geo/huso.js` estrenó
// ventana por huso (`BBOX_POR_HUSO`): antes los tres candidatos se validaban
// contra un rectángulo único que incluía medio Mediterráneo, y una parcela de
// Málaga se leía como «huso 31» cayendo en mar abierto frente a Argelia. Con la
// ventana afinada, esas lecturas imposibles ya no llegan aquí (42 → 36 ambiguos
// en el mismo barrido). Lo que queda son las de verdad: las que caen sobre suelo
// español en las dos lecturas, y ésas no las cierra ninguna geometría.
//
// ⚠️ Y **un fichero que declara su huso no pregunta nada**: un `.gml` trae
// `srsName` y no pasa por aquí (lo lee `comprobacion/gml.js`, que VERIFICA contra
// el huso declarado); y `resolverHuso` en modo verificar —`opts.huso` puesto—
// devuelve `ambiguo: false`, así que la segunda ronda no vuelve a preguntar.
//
// ── ⛔ CON REPARTO POR CAPAS SE PREGUNTA ESO Y NADA MÁS ──────────────────────
// Medido sobre `UTM.dxf` el 2026-08-06: sin elegir capa salen **27 detecciones**
// (8 de ellas avisos de cierre ambiguo); eligiendo la capa «0» quedan **9**, y ni
// un cierre ambiguo. Los 8 avisos hablaban de anillos del cajetín y de la leyenda
// que el usuario está a punto de descartar.
//
// Preguntar por ellos ANTES de saber qué capa entra es pedirle al usuario que
// decida sobre geometría que no va a importar. Así que cuando hay reparto de
// capas, {@link decisionesDe} devuelve **esa sola decisión**, y el llamante vuelve
// a medir con la capa puesta antes de preguntar nada más.
//
// ── EL CIERRE ES UNA DECISIÓN, NO UNA POR ANILLO ────────────────────────────
// `compensarCierre` y `retirarCierre` son opciones del fichero entero, no del
// anillo: `importar()` no admite «compensa este y aquel no». Se enseña **cuántos
// anillos** están en la banda ambigua y el mayor de sus errores, y se decide una
// vez. Ofrecer un control por anillo daría a entender una precisión que la capa de
// abajo no tiene.

// Los dos léxicos se IMPORTAN y no se copian: el día que `parsers/` estrene un
// bloqueo o un tipo de detección, esto se entera. Copiar los literales fue lo que
// dejó a `MENSAJE_DIBUJO_EN_PARCELA` describiendo un mundo que ya no existía.
import { TIPO_DETECCION } from '../parsers/_comun.js'
import { BLOQUEOS } from '../parsers/importar.js'
import { NIVEL, resolverAvisar } from '../viewer/_comun.js'

// ── El vocabulario de decisiones ─────────────────────────────────────────────

/**
 * Los cuatro tipos de decisión que esta pantalla sabe resolver. Es un catálogo
 * CERRADO y hay un test-guarda que lo ata: si `parsers/importar.js` estrena una
 * oferta nueva y nadie la añade aquí, la oferta existiría sin forma de aceptarla —
 * que es exactamente el defecto que F18 viene a cerrar.
 *
 * @readonly
 */
export const TIPO_DECISION = Object.freeze({
  CAPA: 'CAPA',
  GRADOS: 'GRADOS',
  SWAP_XY: 'SWAP_XY',
  CIERRE: 'CIERRE',
  HUSO: 'HUSO',
})

/** Qué se hace con un cierre en la banda ambigua. Son las opciones de `importar()`. */
export const LECTURA_CIERRE = Object.freeze({
  DEJAR: 'DEJAR',
  COMPENSAR: 'COMPENSAR',
  RETIRAR: 'RETIRAR',
})

/**
 * Los bloqueos para los que **esta versión no tiene ninguna corrección que
 * ofrecer**, con lo que hay que hacer en su lugar. Se dicen con todas las letras
 * en vez de dejar un botón muerto o un diálogo con un solo «Cancelar».
 *
 * ⛔ **`COORDENADAS_EN_GRADOS` estuvo aquí desde F18 y dolía, porque F01 pedía
 * «detectar y ofrecer proyectar».** Lo que se midió entonces era cierto: la
 * detección traía `datos.reproyectar: true` y **`importar()` no tenía ninguna
 * opción para aplicarla**. **F19 la escribió**, así que este caso ya no vive aquí
 * salvo cuando de verdad no hay salida —Canarias, diferida por O13, y lo que no
 * cae en ningún territorio conocido—, y entonces el texto lo compone
 * {@link mensajeGradosSinCorreccion} con lo que se sabe del sitio. El renglón
 * genérico se conserva para cuando no viene situación ninguna.
 */
const SIN_CORRECCION = Object.freeze({
  [BLOQUEOS.COORDENADAS_EN_GRADOS]:
    'Las coordenadas están en grados geográficos (latitud y longitud), no en UTM, y no se ha ' +
    'podido situar la parcela para proyectarlas: vuelve a exportar el dibujo en coordenadas ' +
    'UTM desde tu CAD y suéltalo otra vez.',
  [BLOQUEOS.HUSO_NO_RESUELTO]:
    'Con estas coordenadas no se puede deducir en qué huso cae la parcela: ninguna de las tres ' +
    'lecturas (29, 30, 31) la sitúa en España. Suele significar que el fichero no está ' +
    'georreferenciado —coordenadas locales de obra— o que le falta un factor de escala.',
  [BLOQUEOS.SIN_GEOMETRIA]:
    'El fichero no trae ni una polilínea cerrada que pueda ser el contorno de una parcela.',
  [BLOQUEOS.LINEAS_NO_IMPORTADAS]:
    'El fichero trae líneas con cuatro o más números, que no son el formato que se lee aquí —una ' +
    'coordenada por línea, X Y y como mucho Z—, y esas líneas NO se han importado: al contorno le ' +
    'faltarían vértices. Vuelve a exportarlo con una coordenada por línea y suéltalo otra vez.',
  [BLOQUEOS.SUPERFICIE_NO_POSITIVA]:
    'Con los anillos que trae, el contorno menos los huecos no da una superficie positiva, así ' +
    'que no se puede decir cuál es el contorno y cuáles los huecos. Si el dibujo tiene varias ' +
    'capas, elegir una sola suele resolverlo.',
  // ── F22 · UN TEXTO PROVISIONAL QUE SE QUEDÓ CADUCO, Y SE CUENTA ───────────
  //
  // La fase 1 escribió aquí un texto **declarado provisional** para que la
  // pantalla no se quedara muda antes de que existiera la elección: el bloqueo se
  // emite desde `parsers/importar.js` y sin una entrada en esta tabla
  // `decisionesDe` lo filtraría, dejando al usuario con un fichero que no entra y
  // ni una frase que lo explique. Decía, literalmente:
  //
  //     «…Un expediente lleva una sola, y **todavía no se puede elegir cuál desde
  //     aquí**: deja en el dibujo la polilínea de tu parcela, o elige una capa que
  //     solo la contenga a ella.»
  //
  // ⛔ **Y siguió diciéndolo después de que las fases 3 y 4 construyeran justo
  // eso.** Se queda citado arriba en vez de borrarse (regla de oro 8): es la
  // tercera vez que este proyecto paga lo mismo —un texto correcto el día que se
  // escribió, con fecha de caducidad declarada y sin nadie que volviera—, y las
  // otras dos son el §11 del `GUION.md` (tres meses acusando a la aplicación de
  // hacer lo que se le pidió) y el rótulo del guion 17.
  //
  // ⚠️ **Por qué se puede prometer el cajón desde aquí.** Este módulo es de
  // `app/`, y el único que lo monta es `app/main.js`, que cablea SIEMPRE
  // `parcelas: visor.parcelas`. O sea que para todo usuario de esta pantalla la
  // elección existe. La degradación sin cajón —tests, uso como librería— no pasa
  // por este `<dialog>`: allí el motivo lo cuenta la detección de `importar()`.
  [BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS]:
    'El dibujo trae varias fincas separadas —ninguna está dentro de otra ni se solapa con ' +
    'otra—, así que no es una parcela con sus patios: son parcelas distintas. Un expediente ' +
    'lleva una sola: al cerrar esta ventana se abre sobre el mapa el cajón donde elegir cuál ' +
    'es la tuya, con la referencia de cada finca si el dibujo las nombra. Las demás se quedan ' +
    'dibujadas alrededor como parcelario de contexto.',
})

/**
 * Los bloqueos que hablan de CÓMO SE REPARTEN los anillos y no del fichero.
 *
 * Con varias capas por delante, ninguno de ellos se enseña como bloqueo suelto:
 * la salida es elegir capa —una decisión que sí existe— y su motivo viaja como
 * `nota` dentro de ese grupo. Son excluyentes entre sí porque `importar()` los
 * emite así, y aquí solo se toma el que venga.
 *
 * ⚠️ NO es lo mismo que `BLOQUEOS_SOLO_PARCELA` de `parsers/importar.js`, aunque
 * hoy tengan los mismos miembros: aquél dice qué NO hereda la rama EDIFICIO,
 * éste dice qué se dobla dentro del grupo de capas de ESTA pantalla. Compartir la
 * constante ataría dos decisiones que no tienen por qué moverse juntas.
 */
const REPARTO = Object.freeze([
  BLOQUEOS.SUPERFICIE_NO_POSITIVA,
  BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS,
])

/**
 * Qué se le dice al usuario cuando el fichero viene en grados y **no se puede
 * proyectar**. Se compone con lo que `geo/huso.js#situarGrados` ha averiguado, en
 * vez de dar una frase única: «no cae en España» sobre unas coordenadas de Las
 * Palmas es cierto de una forma inútil, y el usuario no sabe qué ha pasado.
 *
 * @param {object|null} situacion  `datos.situacion` de la detección GRADOS.
 * @returns {string}
 */
function mensajeGradosSinCorreccion(situacion) {
  if (situacion?.region === 'CANARIAS') {
    return (
      'Las coordenadas están en grados geográficos y caen en Canarias. Esta versión trabaja en ' +
      'los husos 29, 30 y 31 (Península y Baleares) y todavía no proyecta el 28, que es el de ' +
      'Canarias: vuelve a exportar el dibujo en coordenadas UTM desde tu CAD.'
    )
  }
  if (situacion?.region === 'FUERA') {
    return (
      'Las coordenadas están en grados geográficos, y leídas en los dos órdenes posibles no caen ' +
      'ni en la España peninsular y Baleares ni en Canarias. Revisa si el fichero está en otro ' +
      'sistema de referencia, o vuelve a exportarlo en coordenadas UTM desde tu CAD.'
    )
  }
  return SIN_CORRECCION[BLOQUEOS.COORDENADAS_EN_GRADOS]
}

// ── Textos de la pantalla ────────────────────────────────────────────────────

const TITULO = 'Revisar la medición'

/**
 * El renglón que dice de qué fichero se está hablando. Va SIEMPRE, incluso con una
 * sola decisión: dos ficheros soltados seguidos abren dos veces la misma pantalla y
 * sin el nombre no hay forma de saber cuál se está contestando.
 */
const introDe = (nombre, formato) => `${nombre} · leído como ${formato}.`

const ROTULO_CAPAS = 'Elige la capa que contiene la parcela'

/**
 * ⛔ **El apunte del reparto por capas, y no es genérico: es lo MEDIDO.** En
 * `UTM.dxf` —el único plano de trabajo real que tiene este proyecto— la parcela
 * está en la capa **`0`** y **no** en la que se llama `PARCELA` (F11 · T0.2·2).
 * Por eso esta pantalla ofrece en vez de adivinar, y por eso el apunte avisa de que
 * el nombre no es garantía de nada.
 */
const APUNTE_CAPAS =
  'El dibujo trae polilíneas en varias capas y no se puede saber cuál es el contorno sin que lo ' +
  'digas. Ojo con el nombre: en planos reales la parcela no siempre está en la capa que se llama ' +
  '«PARCELA».'

const MOTIVO_SIN_CAPA = 'Elige una capa para continuar.'

const ROTULO_GRADOS = 'Coordenadas en grados'
const ROTULO_SWAP = 'X e Y invertidas'
const ROTULO_CIERRE = 'El contorno no cierra del todo'
const ROTULO_HUSO = 'Huso'

const APUNTE_HUSO =
  'El fichero no dice en qué huso está, y estos mismos metros se leen como una posición ' +
  'válida en más de uno: el Este vale ~500.000 en todos los husos, así que las coordenadas ' +
  'solas no lo deciden. Marca dónde está de verdad la parcela — errar el huso la coloca a ' +
  'cientos de kilómetros sin dar ningún error.'

const ETIQUETA_CIERRE = Object.freeze({
  [LECTURA_CIERRE.DEJAR]: 'Dejarlo como está (es una arista corta real)',
  [LECTURA_CIERRE.COMPENSAR]: 'Repartir el error entre los vértices (Bowditch)',
  [LECTURA_CIERRE.RETIRAR]: 'Quitar el último vértice (era el de cierre)',
})

const BOTON_IMPORTAR = 'Importar'
const BOTON_CANCELAR = 'Cancelar'

/** Cuántas líneas informativas se enseñan antes de resumir el resto. */
const INFORMATIVAS_VISIBLES = 4

const ROTULO_LO_DEMAS = 'Lo que se ha visto en el fichero'

const mas = (n) => `… y ${n} apunte${n === 1 ? '' : 's'} más, en los avisos del panel.`

/**
 * Lo que se dice cuando se ha soltado el listado de replanteo que exporta esta
 * misma aplicación. Es un rechazo con nombre propio, y su motivo está medido: sin
 * él el usuario recibe «no se ha podido resolver el huso», que es plausible, es un
 * bloqueo del catálogo y **es mentira** — no hay ningún huso que arreglar.
 *
 * Se exporta porque quien lo dice es el cableado, no esta pantalla: el listado se
 * reconoce ANTES de llamar a `importar()`, así que este diálogo no llega a abrirse.
 */
export const MENSAJE_ES_LISTADO_PROPIO =
  'Ese es el listado de coordenadas que genera esta misma aplicación, y no se puede volver a ' +
  'cargar: su primera columna es el número de vértice, no la X, y un lector de dos columnas la ' +
  'tomaría por una coordenada. Para recuperar un trabajo, abre el fichero de proyecto (.json).'

// ── Clases CSS, contrato con `estilos/app.css` ───────────────────────────────

const CLASE = Object.freeze({
  DIALOGO: 'gml-dialogo-importacion',
  CUERPO: 'gml-dialogo-importacion-cuerpo',
  TITULO: 'gml-dialogo-importacion-titulo',
  INTRO: 'gml-dialogo-importacion-intro',
  GRUPO: 'gml-dialogo-importacion-grupo',
  ROTULO: 'gml-dialogo-importacion-rotulo',
  APUNTE: 'gml-dialogo-importacion-apunte',
  LISTA: 'gml-dialogo-importacion-lista',
  OPCION: 'gml-dialogo-importacion-opcion',
  CUENTA: 'gml-dialogo-importacion-cuenta',
  BLOQUEO: 'gml-dialogo-importacion-bloqueo',
  PIE: 'gml-dialogo-importacion-pie',
  ESTADO: 'gml-dialogo-importacion-estado',
})

const ACCION = Object.freeze({ IMPORTAR: 'importar-medicion', CANCELAR: 'cancelar-medicion' })

// ── Helpers puros ────────────────────────────────────────────────────────────

const esTexto = (v) => typeof v === 'string' && v.trim() !== ''

/** Formateo de metros con dos decimales, en español, como el resto de la casa. */
const FORMATO_M = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const metros = (v) => `${FORMATO_M.format(v)} m`

/** Las detecciones de un tipo, sin reventar si `detecciones` no es un array. */
const porTipo = (detecciones, tipo) =>
  (Array.isArray(detecciones) ? detecciones : []).filter((d) => d?.tipo === tipo)

/**
 * El reparto de anillos por capa, a partir del contrato `resumen.capas` —que es
 * 1:1 con los anillos— y no del `datos` de una detección: aquél es campo publicado
 * de {@link ResumenImportacion} y esto otro es la forma interna de un mensaje.
 *
 * @param {readonly string[]} capas
 * @returns {Array<{nombre: string, anillos: number}>} Ordenado de más a menos
 *   anillos; a igualdad, por nombre, para que la lista no baile entre aperturas.
 */
function repartoDeCapas(capas) {
  const cuenta = new Map()
  for (const c of Array.isArray(capas) ? capas : []) {
    cuenta.set(c, (cuenta.get(c) ?? 0) + 1)
  }
  return [...cuenta.entries()]
    .map(([nombre, anillos]) => ({ nombre, anillos }))
    .sort((a, b) => b.anillos - a.anillos || a.nombre.localeCompare(b.nombre, 'es'))
}

// ── LA FUNCIÓN PURA: ¿hay algo que decidir? ──────────────────────────────────

/**
 * Reparte lo que ha devuelto `importar()` en tres montones: lo que hay que
 * **decidir**, lo que **bloquea sin remedio** y lo que solo **informa**.
 *
 * Es pura y se exporta por dos motivos: `app/cableado-medicion.js` la usa para
 * saber si abre la pantalla o no, y así **hay un solo dueño** de qué cuenta como
 * decisión — si esto viviera dentro del `<dialog>`, el cableado tendría que
 * adivinarlo con una segunda regla que acabaría divergiendo.
 *
 * ⛔ **Con reparto por capas devuelve ESA SOLA DECISIÓN.** Ver la cabecera: lo
 * demás está medido sobre anillos que el usuario está a punto de descartar.
 *
 * @param {{detecciones?: Array<object>, resumen?: object}} resultado  Tal cual sale
 *   de `parsers/importar.js#importar`.
 * @returns {{decisiones: Array<object>, bloqueos: Array<{codigo: string, mensaje: string}>,
 *            informativas: string[]}}
 */
export function decisionesDe(resultado) {
  const detecciones = Array.isArray(resultado?.detecciones) ? resultado.detecciones : []
  const resumen = resultado?.resumen ?? {}
  const codigos = Array.isArray(resumen.bloqueos) ? resumen.bloqueos : []

  // ── Los bloqueos sin corrección que ofrecer ────────────────────────────────
  // Los bloqueos DE REPARTO no entran aquí cuando hay varias capas: su salida es
  // elegir capa, y esa decisión sí existe. Se cuelan como texto dentro del grupo
  // de capas. ⚠️ Son DOS desde F22 y se listan una sola vez: escribirlos a mano en
  // los tres sitios donde hacen falta es como se olvida el tercero.
  const bloqueos = codigos
    .filter((c) => c in SIN_CORRECCION)
    .map((codigo) => ({ codigo, mensaje: SIN_CORRECCION[codigo] }))

  const decisiones = []

  // ── 1 · El reparto por capas, que si está es lo ÚNICO que se pregunta ──────
  const reparto = repartoDeCapas(resumen.capas)
  if (reparto.length > 1) {
    // El motivo por el que no ha entrado nada todavía se arrastra a la misma
    // pantalla, pero UNO solo: `importar()` los emite excluyentes a propósito, y
    // enseñar dos explicaciones distintas del mismo hecho es la contradicción que
    // este proyecto ya pagó dos veces.
    const deReparto = codigos.find((c) => REPARTO.includes(c) && c in SIN_CORRECCION) ?? null
    return {
      decisiones: [
        {
          tipo: TIPO_DECISION.CAPA,
          opciones: reparto,
          nota: deReparto === null ? null : SIN_CORRECCION[deReparto],
        },
      ],
      bloqueos: bloqueos.filter((b) => !REPARTO.includes(b.codigo)),
      informativas: informativasDe(detecciones),
    }
  }

  // ── 1bis · F19 · Coordenadas en grados, que si se pueden proyectar es lo
  //   ÚNICO que se pregunta, y por el mismo motivo que el reparto por capas: el
  //   cierre, el huso y la superficie están medidos sobre unos números que están
  //   a punto de cambiar de unidad. Aceptada la proyección, el cableado vuelve a
  //   llamar a `importar()` y las decisiones de verdad aparecen sobre metros.
  const enGrados = porTipo(detecciones, TIPO_DETECCION.GRADOS).find(
    (d) => d?.datos?.situacion && d.datos.aplicado !== true,
  )
  const situacion = enGrados?.datos?.situacion ?? null
  if (codigos.includes(BLOQUEOS.COORDENADAS_EN_GRADOS)) {
    if (situacion?.proyectable === true) {
      return {
        decisiones: [{ tipo: TIPO_DECISION.GRADOS, situacion }],
        // El bloqueo NO se enseña: tiene corrección y está justo encima. Decir a la
        // vez «vuelve a exportar desde el CAD» y «pulsa aquí para proyectar» es la
        // contradicción de M28 de F11, escrita en dos párrafos seguidos.
        bloqueos: bloqueos.filter((b) => b.codigo !== BLOQUEOS.COORDENADAS_EN_GRADOS),
        informativas: informativasDe(detecciones),
      }
    }
    // Sin corrección posible: el motivo se compone con lo que se sabe del sitio.
    for (const b of bloqueos) {
      if (b.codigo === BLOQUEOS.COORDENADAS_EN_GRADOS) {
        b.mensaje = mensajeGradosSinCorreccion(situacion)
      }
    }
  }

  // ── 2 · X/Y invertidas ────────────────────────────────────────────────────
  const swaps = porTipo(detecciones, TIPO_DETECCION.SWAP_XY).filter(
    (d) => d?.datos?.aplicado === false,
  )
  if (swaps.length > 0) {
    decisiones.push({
      tipo: TIPO_DECISION.SWAP_XY,
      anillos: swaps.length,
      // `rangoPlausible: false` significa que ni siquiera intercambiadas caen donde
      // deberían: se dice, porque aceptar a ciegas ahí es meter basura convencido.
      plausible: swaps.every((d) => d.datos?.rangoPlausible !== false),
    })
  }

  // ── 3 · El cierre en la banda ambigua ─────────────────────────────────────
  //
  // ⚠️ `interpretacion: 'CERRADO_EN_EL_FICHERO'` NO se pregunta, y el filtro tiene
  // que decirlo EXPRESAMENTE. Esa detección lleva `aplicado: 'NINGUNO'` como las
  // de la banda ambigua —porque es verdad: no se ha tocado nada— así que filtrar
  // solo por `aplicado` la colaba y la pantalla volvía a preguntar. Es una
  // polilínea que el DXF marca como cerrada (código 70): el tramo de cierre es
  // una arista dibujada y no hay decisión que tomar. Ver
  // `parsers/importar.js#resolverCierre`, banda (c0), medida en `UTM.dxf`.
  const cierres = porTipo(detecciones, TIPO_DETECCION.CIERRE).filter(
    (d) => d?.datos?.aplicado === 'NINGUNO' && d?.datos?.interpretacion !== 'CERRADO_EN_EL_FICHERO',
  )
  if (cierres.length > 0) {
    const errores = cierres.map((d) => Number(d.datos?.error)).filter(Number.isFinite)
    decisiones.push({
      tipo: TIPO_DECISION.CIERRE,
      anillos: cierres.length,
      errorMaximo: errores.length > 0 ? Math.max(...errores) : null,
    })
  }

  // ── 4 · El huso AMBIGUO, que desde el 2026-08-09 SÍ dispara ───────────────
  // Ver la cabecera: hasta hoy esto iba dentro de un `if (decisiones.length > 0)`
  // y la ambigüedad del huso solo se podía contestar cuando la pantalla ya
  // estaba abierta por otro motivo. En un fichero limpio se resolvía sola al
  // huso 30 y lo único que recibía el usuario era un aviso en el panel.
  const ambiguo = porTipo(detecciones, TIPO_DETECCION.HUSO_AMBIGUO)[0]
  const candidatos = ambiguo?.datos?.candidatos
  const preguntamosElHuso = Array.isArray(candidatos) && candidatos.length > 1
  if (preguntamosElHuso) {
    decisiones.push({
      tipo: TIPO_DECISION.HUSO,
      candidatos,
      prioritario: ambiguo.datos?.prioritario ?? candidatos[0]?.zona ?? null,
    })
  }

  return {
    decisiones,
    bloqueos,
    informativas: informativasDe(detecciones, { preguntamosElHuso }),
  }
}

/**
 * Los mensajes que solo informan, sin repetir. Un DXF real trae la misma frase de
 * «entidad no soportada: INSERT» tres veces —una por INSERT—: enseñarlas las tres
 * es ruido que tapa lo que sí importa.
 *
 * @param {Array<object>} detecciones
 * @param {object} [opciones]
 * @param {boolean} [opciones.preguntamosElHuso=false]  Si la pantalla lleva la
 *   pregunta del huso, se calla el «cae en el huso 30» informativo. Ver abajo.
 * @returns {string[]}
 */
function informativasDe(detecciones, { preguntamosElHuso = false } = {}) {
  const vistas = new Set()
  const fuera = new Set([TIPO_DETECCION.SWAP_XY, TIPO_DETECCION.HUSO_AMBIGUO])
  // ⛔ **Y el punto de caída, cuando estamos PREGUNTANDO por él.** Se vio en el
  // navegador el mismo día que se escribió la pregunta: bajo «marca dónde está de
  // verdad la parcela» aparecía «La parcela cae en el huso 30 (EPSG:25830):
  // lon=−3,826…», o sea la pantalla preguntando y contestándose sola tres líneas
  // más abajo. Es la lección M28 de F11 —dos frases ciertas que juntas se leen
  // como una contradicción— y aquí además empuja a la respuesta equivocada: ese
  // «cae en» es el prioritario, que es justo lo que se está poniendo en duda.
  // Sin pregunta del huso la frase se queda: es el «decir dónde ha caído» de F01.
  if (preguntamosElHuso) fuera.add(TIPO_DETECCION.HUSO_DETECTADO)
  for (const d of detecciones) {
    if (!esTexto(d?.mensaje) || fuera.has(d.tipo)) continue
    // Las que acompañan a un bloqueo NO se repiten aquí: ya se dicen arriba, con su
    // motivo y su salida. Es la lección M28 de F11 —el panel diciendo dos cosas
    // ciertas por separado que juntas se contradicen—, aplicada de antemano.
    if (esTexto(d?.datos?.bloqueo)) continue
    vistas.add(d.mensaje)
  }
  return [...vistas]
}

/**
 * ¿Hay que abrir la pantalla? Azúcar sobre {@link decisionesDe} para que el
 * cableado no tenga que acordarse de qué campo mirar.
 *
 * @param {object} resultado
 * @returns {boolean}
 */
export function hayQueDecidir(resultado) {
  return decisionesDe(resultado).decisiones.length > 0
}

// ── El `<dialog>` ────────────────────────────────────────────────────────────

/**
 * Fabrica la pantalla de revisión. **No la abre**: quien decide cuándo se abre es
 * `app/cableado-medicion.js`, con {@link hayQueDecidir}.
 *
 * ```js
 * const dialogo = crearDialogoImportacion({ alAvisar: panel.avisar })
 * const opts = await dialogo.abrir({ nombre: 'UTM.dxf', resultado })
 * if (opts === null) return          // el usuario ha cancelado
 * const definitivo = importar(texto, { ...opts })
 * ```
 *
 * @param {object} [opciones]
 * @param {Document} [opciones.documento=document]
 * @param {(mensaje: string, extra?: object) => void} [opciones.alAvisar]  Para lo
 *   que es defecto de programación, nunca para lo que decide el usuario.
 * @returns {{nodo: HTMLElement, abrir: (entrada: object) => Promise<object|null>,
 *            destruir: () => void}}
 */
export function crearDialogoImportacion({ documento = document, alAvisar } = {}) {
  const doc = documento
  const avisar = resolverAvisar(alAvisar)

  if (!doc || typeof doc.createElement !== 'function') {
    throw new TypeError(
      `crearDialogoImportacion: 'documento' debe ser un Document; recibido ${typeof doc}.`,
    )
  }

  let destruido = false
  let abierto = false
  let focoPrevio = null
  /** El `resolve` de la promesa en vuelo. `null` = no hay pantalla abierta. */
  let resolver = null
  /** Lo que se está enseñando, para poder leer las respuestas al aceptar. */
  let decisionesEnPantalla = []

  const crear = (etiqueta, clase, texto) => {
    const el = doc.createElement(etiqueta)
    if (clase) el.className = clase
    if (texto !== undefined) el.textContent = texto
    return el
  }

  const dialogo = crear('dialog', CLASE.DIALOGO)
  dialogo.setAttribute('aria-modal', 'true')
  // Suelo del foco: sin un control enfocable, `abrir()` dejaría el foco fuera del
  // diálogo y `Escape` no llegaría nunca. Misma razón que en `panel-edificio.js`.
  dialogo.tabIndex = -1

  const cuerpo = crear('div', CLASE.CUERPO)
  const titulo = crear('h2', CLASE.TITULO, TITULO)
  titulo.id = 'gml-dialogo-importacion-titulo'
  dialogo.setAttribute('aria-labelledby', titulo.id)
  const intro = crear('p', CLASE.INTRO, '')
  /** Donde se pintan los grupos. Se vacía en cada apertura. */
  const grupos = crear('div', null)
  const pie = crear('div', CLASE.PIE)
  const botonImportar = crear('button', 'gml-boton gml-boton--primario', BOTON_IMPORTAR)
  botonImportar.type = 'button'
  botonImportar.dataset.accion = ACCION.IMPORTAR
  const botonCancelar = crear('button', 'gml-boton gml-boton--secundario', BOTON_CANCELAR)
  botonCancelar.type = 'button'
  botonCancelar.dataset.accion = ACCION.CANCELAR
  pie.append(botonImportar, botonCancelar)
  const estado = crear('p', CLASE.ESTADO, '')
  estado.dataset.estado = 'dialogo-importacion'
  estado.setAttribute('role', 'status')
  botonImportar.setAttribute('aria-describedby', 'gml-dialogo-importacion-estado')
  estado.id = 'gml-dialogo-importacion-estado'

  cuerpo.append(titulo, intro, grupos, pie, estado)
  dialogo.append(cuerpo)
  doc.body.appendChild(dialogo)

  // ── Pintado ───────────────────────────────────────────────────────────────

  /** Un grupo con su rótulo y, opcionalmente, su apunte. */
  function grupo(rotulo, apunte) {
    const caja = crear('div', CLASE.GRUPO)
    caja.append(crear('h3', CLASE.ROTULO, rotulo))
    if (esTexto(apunte)) caja.append(crear('p', CLASE.APUNTE, apunte))
    return caja
  }

  /** Una opción de radio, con su etiqueta clicable entera. */
  function opcionRadio(grupoNombre, valor, texto, marcado, cuenta) {
    const fila = crear('label', CLASE.OPCION)
    const radio = doc.createElement('input')
    radio.type = 'radio'
    radio.name = grupoNombre
    radio.value = valor
    radio.checked = marcado === true
    radio.dataset.campo = grupoNombre
    fila.append(radio, crear('span', null, texto))
    if (cuenta !== undefined) fila.append(crear('span', CLASE.CUENTA, cuenta))
    return fila
  }

  function pintarCapas(decision) {
    const caja = grupo(ROTULO_CAPAS, APUNTE_CAPAS)
    if (esTexto(decision.nota)) caja.append(crear('p', CLASE.BLOQUEO, decision.nota))
    const lista = crear('div', CLASE.LISTA)
    for (const { nombre, anillos } of decision.opciones) {
      // ⚠️ El nombre de la capa va ENTRE COMILLAS y tal cual viene del código de
      // grupo 8: una capa llamada `0` y otra llamada `  0 ` son distintas para el
      // DXF, y sin las comillas se verían iguales.
      const fila = opcionRadio(
        'capa',
        nombre,
        `«${nombre}»`,
        false,
        `${anillos} polilínea${anillos === 1 ? '' : 's'}`,
      )
      // ⛔ **EL NOMBRE VA EN MONO, y lo destapó mirar la pantalla.** En la
      // tipografía del panel, la capa llamada **`0`** se lee como una **«O»** — y
      // es justo la capa que contiene la parcela en el único plano real que tiene
      // este proyecto. Un usuario no puede elegir bien entre «0» y «O» si se ven
      // iguales, y aquí elegir mal significa importar el cajetín.
      fila.querySelector('span')?.classList.add('gml-mono')
      lista.append(fila)
    }
    caja.append(lista)
    return caja
  }

  /**
   * El grupo de los grados. Enseña **dónde ha caído la parcela** antes de tocar
   * nada, que es lo que `feature-01` §Detecciones pide para el huso y vale igual
   * aquí: «huso 30» a secas no le dice nada a nadie; «cae en lat 36,72 · lon
   * −4,42, huso 30» sí. Y si las columnas venían al revés, se dice también: el
   * usuario tiene que poder reconocer su propio fichero en lo que lee.
   */
  function pintarGrados(decision) {
    const s = decision.situacion
    const orden = s.invertido
      ? 'Las columnas vienen como (latitud, longitud), al revés de lo habitual. '
      : ''
    const caja = grupo(
      ROTULO_GRADOS,
      `${orden}Leídas así, la parcela cae en lat ${s.lat.toFixed(6)} · lon ${s.lon.toFixed(6)}, ` +
        `dentro del huso ${s.zona} (${s.srs}). El modelo trabaja en metros: para poder medir, ` +
        'dibujar y generar el GML hay que proyectarlas.',
    )
    const lista = crear('div', CLASE.LISTA)
    lista.append(
      // El «no» va primero y marcado, como en X/Y invertidas: la opción por
      // defecto de esta pantalla es NO tocar el dato del usuario.
      opcionRadio('grados', 'no', 'Dejarlas en grados (no entrará ninguna parcela)', true),
      opcionRadio('grados', 'si', `Proyectar a UTM huso ${s.zona} (${s.srs})`, false),
    )
    caja.append(lista)
    return caja
  }

  function pintarSwap(decision) {
    const caja = grupo(
      ROTULO_SWAP,
      `Los ${decision.anillos === 1 ? 'vértices del contorno parecen tener' : 'contornos parecen tener'} ` +
        'el Este y el Norte cambiados de sitio' +
        (decision.plausible
          ? '.'
          : ', y aun intercambiándolos no caen donde debería estar una parcela española.'),
    )
    const lista = crear('div', CLASE.LISTA)
    lista.append(
      opcionRadio('swap', 'no', 'Dejarlo como está', true),
      opcionRadio('swap', 'si', 'Intercambiar X e Y', false),
    )
    caja.append(lista)
    return caja
  }

  function pintarCierre(decision) {
    const cuantos =
      decision.anillos === 1
        ? 'El último vértice no coincide con el primero'
        : `En ${decision.anillos} contornos el último vértice no coincide con el primero`
    const cuanto =
      decision.errorMaximo === null ? '' : ` (hasta ${metros(decision.errorMaximo)} de diferencia)`
    const caja = grupo(
      ROTULO_CIERRE,
      `${cuantos}${cuanto}. Puede ser un error de cierre del levantamiento o un lado corto de ` +
        'verdad, y no se puede saber desde aquí.',
    )
    const lista = crear('div', CLASE.LISTA)
    for (const clave of [LECTURA_CIERRE.DEJAR, LECTURA_CIERRE.COMPENSAR, LECTURA_CIERRE.RETIRAR]) {
      lista.append(
        opcionRadio('cierre', clave, ETIQUETA_CIERRE[clave], clave === LECTURA_CIERRE.DEJAR),
      )
    }
    caja.append(lista)
    return caja
  }

  function pintarHuso(decision) {
    const caja = grupo(ROTULO_HUSO, APUNTE_HUSO)
    const lista = crear('div', CLASE.LISTA)
    for (const c of decision.candidatos) {
      // Se enseña DÓNDE CAE en cada lectura, que es lo que pedía F01: una zona
      // suelta («30» o «31») no le dice nada a nadie; «cae en Málaga» sí.
      const donde =
        Number.isFinite(c?.lat) && Number.isFinite(c?.lon)
          ? ` — cae en ${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}`
          : ''
      lista.append(
        opcionRadio(
          'huso',
          String(c.zona),
          `Huso ${c.zona} (${c.srs})${donde}`,
          c.zona === decision.prioritario,
        ),
      )
    }
    caja.append(lista)
    return caja
  }

  function pintarBloqueos(bloqueos) {
    const caja = grupo('Por qué no ha entrado todavía')
    for (const b of bloqueos) caja.append(crear('p', CLASE.BLOQUEO, b.mensaje))
    return caja
  }

  function pintarInformativas(informativas) {
    const caja = grupo(ROTULO_LO_DEMAS)
    const lista = crear('ul', CLASE.LISTA)
    for (const texto of informativas.slice(0, INFORMATIVAS_VISIBLES)) {
      lista.append(crear('li', null, texto))
    }
    caja.append(lista)
    if (informativas.length > INFORMATIVAS_VISIBLES) {
      caja.append(crear('p', CLASE.APUNTE, mas(informativas.length - INFORMATIVAS_VISIBLES)))
    }
    return caja
  }

  /** ¿Se puede pulsar «Importar»? Hoy solo la capa es obligatoria. */
  function repintarGate() {
    const pideCapa = decisionesEnPantalla.some((d) => d.tipo === TIPO_DECISION.CAPA)
    const elegida = pideCapa ? dialogo.querySelector('input[data-campo="capa"]:checked') : null
    const falta = pideCapa && elegida === null
    botonImportar.disabled = falta
    // Regla de oro 1: un botón apagado sin motivo escrito es un botón roto.
    estado.textContent = falta ? MOTIVO_SIN_CAPA : ''
  }

  // ── Lectura de lo elegido ─────────────────────────────────────────────────

  /**
   * Traduce la pantalla a las opciones de `importar()`. **Solo escribe las claves
   * que el usuario ha decidido**: mandar `compensarCierre: false` cuando no había
   * ninguna decisión de cierre sería afirmar algo que nadie ha dicho.
   *
   * @returns {object}
   */
  function leerOpciones() {
    const opts = {}
    const leer = (campo) => dialogo.querySelector(`input[data-campo="${campo}"]:checked`)

    for (const d of decisionesEnPantalla) {
      if (d.tipo === TIPO_DECISION.CAPA) {
        const capa = leer('capa')
        if (capa) opts.capa = capa.value
      }
      if (d.tipo === TIPO_DECISION.GRADOS) {
        if (leer('grados')?.value === 'si') opts.proyectarGrados = true
      }
      if (d.tipo === TIPO_DECISION.SWAP_XY) {
        if (leer('swap')?.value === 'si') opts.intercambiarXY = true
      }
      if (d.tipo === TIPO_DECISION.CIERRE) {
        const cierre = leer('cierre')?.value
        if (cierre === LECTURA_CIERRE.COMPENSAR) opts.compensarCierre = true
        if (cierre === LECTURA_CIERRE.RETIRAR) opts.retirarCierre = true
      }
      if (d.tipo === TIPO_DECISION.HUSO) {
        const huso = Number(leer('huso')?.value)
        if (Number.isFinite(huso)) opts.huso = huso
      }
    }
    return opts
  }

  // ── Apertura, cierre y desenlace ──────────────────────────────────────────

  /** Cierra el `<dialog>` de verdad, con la detección de capacidad de la casa. */
  function cerrarNodo() {
    if (typeof dialogo.close === 'function') {
      try {
        dialogo.close()
      } catch {
        dialogo.removeAttribute('open')
      }
    } else {
      dialogo.removeAttribute('open')
    }
  }

  /**
   * Único punto por el que sale esta pantalla. IDEMPOTENTE: `abierto` se baja ANTES
   * de tocar el DOM, así que el evento `close` que emita el navegador vuelve a
   * entrar aquí y se va por la primera línea.
   *
   * @param {object|null} desenlace  Las opciones, o `null` si se ha cancelado.
   */
  function terminar(desenlace) {
    if (!abierto) return
    abierto = false
    cerrarNodo()

    const previo = focoPrevio
    focoPrevio = null
    if (previo && typeof previo.focus === 'function' && previo.isConnected) previo.focus()

    const resolverAhora = resolver
    resolver = null
    decisionesEnPantalla = []
    if (resolverAhora) resolverAhora(desenlace)
  }

  function alClic(evento) {
    const boton = evento.target?.closest?.('[data-accion]')
    if (!boton || !dialogo.contains(boton)) return
    if (boton.dataset.accion === ACCION.CANCELAR) terminar(null)
    if (boton.dataset.accion === ACCION.IMPORTAR && !botonImportar.disabled) {
      terminar(leerOpciones())
    }
  }

  const alCambiar = () => repintarGate()

  /**
   * `Escape` = cancelar. Se escucha el `cancel` del `<dialog>` —que es lo que emite
   * el navegador— y además la tecla, porque en jsdom no hay `showModal` y el evento
   * nativo no llega nunca. Las dos entradas caen en `terminar`, que es idempotente.
   */
  function alCancelar(evento) {
    evento.preventDefault?.()
    terminar(null)
  }

  function alTecla(evento) {
    if (evento.key === 'Escape' && abierto) {
      evento.preventDefault?.()
      terminar(null)
    }
  }

  dialogo.addEventListener('click', alClic)
  dialogo.addEventListener('change', alCambiar)
  dialogo.addEventListener('cancel', alCancelar)
  dialogo.addEventListener('keydown', alTecla)

  return {
    nodo: dialogo,

    /**
     * Enseña la revisión y **espera**. Resuelve con las opciones para la segunda
     * pasada de `importar()`, o con `null` si el usuario cancela.
     *
     * Si ya había una pantalla abierta, la anterior se resuelve como CANCELADA
     * antes de abrir la nueva: dos ficheros soltados seguidos no pueden dejar dos
     * promesas colgando, y la que gana es la última que pidió el usuario.
     *
     * @param {object} entrada
     * @param {string} entrada.nombre  Nombre del fichero, para el renglón de intro.
     * @param {object} entrada.resultado  Lo que devolvió `importar()`.
     * @returns {Promise<object|null>}
     */
    abrir(entrada) {
      if (destruido) return Promise.resolve(null)
      if (abierto) terminar(null)

      const nombre = esTexto(entrada?.nombre) ? entrada.nombre : 'el fichero'
      const resultado = entrada?.resultado ?? {}
      const { decisiones, bloqueos, informativas } = decisionesDe(resultado)

      if (decisiones.length === 0) {
        // Defecto de programación: quien abre tenía que haber preguntado antes con
        // `hayQueDecidir`. Se dice y se resuelve sin pantalla, en vez de enseñar un
        // diálogo vacío con un botón que no decide nada.
        avisar(
          'Se ha intentado abrir la revisión de una medición que no tenía nada que decidir. El ' +
            'fichero entra igual; el detalle está en la consola del navegador.',
          { nivel: NIVEL.ERROR },
        )
        console.error('[importacion] `abrir()` sin decisiones; usa `hayQueDecidir` antes.')
        return Promise.resolve({})
      }

      decisionesEnPantalla = decisiones
      intro.textContent = introDe(nombre, esTexto(resultado?.resumen?.formato) ? resultado.resumen.formato : 'volcado')
      grupos.replaceChildren()

      for (const d of decisiones) {
        if (d.tipo === TIPO_DECISION.CAPA) grupos.append(pintarCapas(d))
        if (d.tipo === TIPO_DECISION.GRADOS) grupos.append(pintarGrados(d))
        if (d.tipo === TIPO_DECISION.SWAP_XY) grupos.append(pintarSwap(d))
        if (d.tipo === TIPO_DECISION.CIERRE) grupos.append(pintarCierre(d))
        if (d.tipo === TIPO_DECISION.HUSO) grupos.append(pintarHuso(d))
      }
      if (bloqueos.length > 0) grupos.append(pintarBloqueos(bloqueos))
      if (informativas.length > 0) grupos.append(pintarInformativas(informativas))

      repintarGate()

      focoPrevio = doc.activeElement ?? null
      abierto = true
      if (typeof dialogo.showModal === 'function') {
        try {
          dialogo.showModal()
        } catch {
          dialogo.setAttribute('open', '')
        }
      } else {
        dialogo.setAttribute('open', '')
      }
      // El foco al primer control de decisión, no al botón: quien abre esto viene a
      // elegir, no a aceptar.
      const primero = dialogo.querySelector('input[data-campo]')
      ;(primero ?? dialogo).focus()

      return new Promise((resuelve) => {
        resolver = resuelve
      })
    },

    /** Cierra lo que hubiera —resolviendo como cancelado— y se quita del DOM. */
    destruir() {
      if (destruido) return
      terminar(null)
      destruido = true
      dialogo.removeEventListener('click', alClic)
      dialogo.removeEventListener('change', alCambiar)
      dialogo.removeEventListener('cancel', alCancelar)
      dialogo.removeEventListener('keydown', alTecla)
      dialogo.remove()
    },
  }
}
