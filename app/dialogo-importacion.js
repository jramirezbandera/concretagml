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
// Disparan: **el reparto por capas**, **X/Y invertidas** y **el cierre ambiguo**.
//
// ⛔ **EL HUSO NO DISPARA, Y ES UNA REGLA DE F01 AL PIE DE LA LETRA:** «nunca
// obligar a elegirlo en un desplegable […]; el desplegable queda como anulación»
// (`spec/feature-01-entrada-parcela.md:29`). `importar()` ya resuelve el huso
// prioritario y CONSTRUYE la parcela con él; lo que hay que hacer es decir **dónde
// ha caído**, no parar el recorrido. Así que el huso aparece como anulación cuando
// la pantalla ya está abierta por otro motivo, y como aviso cuando no.
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
 * ⛔ **`COORDENADAS_EN_GRADOS` está aquí y duele, porque F01 pedía «detectar y
 * ofrecer proyectar».** Medido el 2026-08-06: la detección existe y trae
 * `datos.reproyectar: true`, pero **`importar()` no tiene ninguna opción para
 * aplicarla** — `geo/huso.js#sanear` declara que no proyecta (regla de oro 3) y la
 * proyección vive en `geo/utm.js#forward`, sin nadie que las una. Enchufarlas es
 * trabajo de la capa de geometría, no de esta; F18 es cableado y UI. Se dice lo
 * que pasa y qué hacer, y queda como deuda con dueño en la ficha de la fase.
 */
const SIN_CORRECCION = Object.freeze({
  [BLOQUEOS.COORDENADAS_EN_GRADOS]:
    'Las coordenadas están en grados geográficos (latitud y longitud), no en UTM. Esta versión ' +
    'sabe reconocerlo pero todavía no sabe proyectarlas: vuelve a exportar el dibujo en ' +
    'coordenadas UTM desde tu CAD y suéltalo otra vez.',
  [BLOQUEOS.HUSO_NO_RESUELTO]:
    'Con estas coordenadas no se puede deducir en qué huso cae la parcela: ninguna de las tres ' +
    'lecturas (29, 30, 31) la sitúa en España. Suele significar que el fichero no está ' +
    'georreferenciado —coordenadas locales de obra— o que le falta un factor de escala.',
  [BLOQUEOS.SIN_GEOMETRIA]:
    'El fichero no trae ni una polilínea cerrada que pueda ser el contorno de una parcela.',
  [BLOQUEOS.SUPERFICIE_NO_POSITIVA]:
    'Con los anillos que trae, el contorno menos los huecos no da una superficie positiva, así ' +
    'que no se puede decir cuál es el contorno y cuáles los huecos. Si el dibujo tiene varias ' +
    'capas, elegir una sola suele resolverlo.',
})

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

const ROTULO_SWAP = 'X e Y invertidas'
const ROTULO_CIERRE = 'El contorno no cierra del todo'
const ROTULO_HUSO = 'Huso'

const APUNTE_HUSO =
  'Se ha deducido del propio dibujo. Cámbialo solo si sabes que la parcela cae en otro sitio.'

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
  // `SUPERFICIE_NO_POSITIVA` con varias capas NO entra aquí: su salida es elegir
  // capa, y esa decisión sí existe. Se cuela como texto dentro del grupo de capas.
  const bloqueos = codigos
    .filter((c) => c in SIN_CORRECCION)
    .map((codigo) => ({ codigo, mensaje: SIN_CORRECCION[codigo] }))

  const decisiones = []

  // ── 1 · El reparto por capas, que si está es lo ÚNICO que se pregunta ──────
  const reparto = repartoDeCapas(resumen.capas)
  if (reparto.length > 1) {
    return {
      decisiones: [
        {
          tipo: TIPO_DECISION.CAPA,
          opciones: reparto,
          // Se arrastra el motivo del bloqueo de superficie para poder decir, en la
          // misma pantalla, por qué no ha entrado nada todavía.
          nota: codigos.includes(BLOQUEOS.SUPERFICIE_NO_POSITIVA)
            ? SIN_CORRECCION[BLOQUEOS.SUPERFICIE_NO_POSITIVA]
            : null,
        },
      ],
      bloqueos: bloqueos.filter((b) => b.codigo !== BLOQUEOS.SUPERFICIE_NO_POSITIVA),
      informativas: informativasDe(detecciones),
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
  const cierres = porTipo(detecciones, TIPO_DETECCION.CIERRE).filter(
    (d) => d?.datos?.aplicado === 'NINGUNO',
  )
  if (cierres.length > 0) {
    const errores = cierres.map((d) => Number(d.datos?.error)).filter(Number.isFinite)
    decisiones.push({
      tipo: TIPO_DECISION.CIERRE,
      anillos: cierres.length,
      errorMaximo: errores.length > 0 ? Math.max(...errores) : null,
    })
  }

  // ── 4 · El huso, que NO dispara: solo aparece si ya hay pantalla ──────────
  // Ver la cabecera y `spec/feature-01-entrada-parcela.md:29`.
  if (decisiones.length > 0) {
    const ambiguo = porTipo(detecciones, TIPO_DETECCION.HUSO_AMBIGUO)[0]
    const candidatos = ambiguo?.datos?.candidatos
    if (Array.isArray(candidatos) && candidatos.length > 1) {
      decisiones.push({
        tipo: TIPO_DECISION.HUSO,
        candidatos,
        prioritario: ambiguo.datos?.prioritario ?? candidatos[0]?.zona ?? null,
      })
    }
  }

  return { decisiones, bloqueos, informativas: informativasDe(detecciones) }
}

/**
 * Los mensajes que solo informan, sin repetir. Un DXF real trae la misma frase de
 * «entidad no soportada: INSERT» tres veces —una por INSERT—: enseñarlas las tres
 * es ruido que tapa lo que sí importa.
 *
 * @param {Array<object>} detecciones
 * @returns {string[]}
 */
function informativasDe(detecciones) {
  const vistas = new Set()
  const fuera = new Set([TIPO_DETECCION.SWAP_XY, TIPO_DETECCION.HUSO_AMBIGUO])
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
