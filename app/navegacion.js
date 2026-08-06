// app/navegacion.js — Rework de UI · T1. EL DUEÑO ÚNICO DE {rama, paso, modo}.
//
// ── POR QUÉ EXISTE ESTE FICHERO, Y ES UNA MEDICIÓN, NO UNA OPINIÓN ──────────
// Once fases después, esta aplicación **no tenía autoridad de navegación**. Un
// grep de `navegar|pasoActivo|modoActivo|activarPaso|cambiarModo` sobre `app/` y
// `viewer/` devolvía SOLO el `moverse(navegar…)` del undo/redo de edición, y
// **doce ficheros mutaban el store** —tres de ellos dentro de `viewer/`, que es
// la librería y no la aplicación—. Lo que parecía estado de modo no lo era:
// `comprobacion: true` y `diagnostico: true` (`app/main.js:1209,1224`) son
// **banderas de MONTAJE** que se le pasan a `crearVisor` para decidir qué cajón
// construir (`app/main.js:1991`), no el modo en que está la sesión. La revisión
// cruzada de la fase de diseño impugnó la premisa contraria, se midió, y la
// premisa contraria era falsa.
//
// La consecuencia visible es la que abrió el rework: cinco recorridos distintos
// —traer del Catastro, medición propia, comprobar un GML ajeno, edificio,
// recuperar un expediente— viviendo en la MISMA pantalla sin que nada declare en
// cuál estás. De ahí «el flujo del usuario está poco claro» y «hay flujos
// diferentes que se pueden contradecir».
//
// ── QUÉ HACE, Y SOBRE TODO QUÉ NO HACE ─────────────────────────────────────
// Hace tres cosas y ninguna más:
//   1. Guarda `{rama, paso, modo}` y notifica a quien se suscriba.
//   2. Decide si un paso está DISPONIBLE, y cuando no lo está **entrega el
//      motivo escrito en español**. Regla de la casa: *paso apagado con motivo,
//      jamás paso muerto*.
//   3. Traduce ese estado a la URL y de vuelta (`#/parcela/validacion`).
//
// **⛔ NO TOCA EL DOM. Ni una línea.** No importa nada de `viewer/` que necesite
// `window`, no consulta `document`, no lee `location` ni escribe `location.hash`
// —recibe y devuelve CADENAS—, y por eso su prueba vive en el proyecto Vitest
// `node` (el bucle rápido) y no en `dom`. Quien pinta el rail, quien pone
// `hidden`, quien escribe el hash del navegador y quien apaga un botón es el
// APLICADOR (`app/rama.js` y, desde la rebanada 2, la cáscara de tres columnas):
// se suscribe aquí y obedece. **Un solo dueño de la verdad, muchos pintores.**
//
// **Tampoco decide qué cuenta como dato.** Los hechos entran de fuera ya
// resueltos (ver {@link CLAVES_HECHOS}); si este módulo volviera a preguntarse
// «¿qué es tener geometría?» habría una TERCERA definición de una regla que ya
// está escrita dos veces —`hayGeometria` en `app/cableado-expediente.js:477` y
// `puedeDiagnosticar` en `app/cableado-diagnostico.js:346`—, y tres copias de una
// regla divergen sin que nadie se entere. Aquí solo entran booleanos.
//
// ── ⚠️ ESTE MÓDULO NACE SIN LLAMANTE, Y ES DELIBERADO ──────────────────────
// El plan del rework lo ordena así: «la autoridad de navegación, sola y con
// pruebas propias, ANTES de tocar una línea de CSS». Su primer llamante llega en
// T5 (la cáscara de tres columnas). Hasta entonces `app/rama.js` sigue llevando
// la rama por su cuenta: son **dos dueños a la vez durante una rebanada**, y está
// contado a propósito para que nadie lo descubra como sorpresa. Lo que sí se hace
// hoy es dejar UNA sola definición del vocabulario de rama: {@link RAMA} y
// {@link RAMAS} se declaran AQUÍ y `app/rama.js` las reexporta, para que el día
// que aquél se degrade a aplicador la dependencia ya apunte en el sentido bueno
// (aplicador → dueño) y no haya que invertir un import con siete llamantes.
//
// ── EL ORDEN DE LAS CAUSAS, QUE NO ES CAPRICHO ─────────────────────────────
// Un paso puede estar bloqueado por tres cosas a la vez. Se dice SIEMPRE la más
// estructural primero, porque es la que el usuario no puede resolver trabajando:
//
//   1. RAMA  — «esta versión no sabe hacer eso con un edificio». No se arregla
//              trayendo datos: se arregla volviendo a la rama Parcela.
//   2. MODO  — «estás comprobando el GML de otro». Se arregla con LA PUERTA.
//   3. DATO  — «trae antes una parcela». Se arregla trabajando, y es el único de
//              los tres que se resuelve solo según avanzas.
//
// Decirlo al revés sería mentir por omisión: «trae antes una parcela» en la rama
// Edificio manda al usuario a hacer un trabajo que no le va a desbloquear nada.
//
// ── LA PUERTA (decisión D4 de la revisión de diseño) ───────────────────────
// **Comprobación es una PUERTA, no una cárcel.** Abres el GML ajeno, contrastas,
// y hay un CTA con nombre —«Tomar esta geometría y editarla»— que llama a
// {@link Navegacion#abrirPuerta}. Hasta pulsarlo, Edición no está. Al pulsarlo,
// el rail se completa y sigues por el recorrido normal. Eso rescata dentro de la
// aplicación el recorrido caro —GML con IVG negativo → verlo → corregirlo →
// regenerar— sin fingir en ningún momento que el fichero de otro es tuyo.
//
// ── LA URL (decisión D3): HASH, Y EL DATO MANDA SOBRE LA URL ───────────────
// `#/parcela/validacion`. El hash no necesita nada del servidor, así que GitHub
// Pages lo sirve tal cual y atrás/adelante/recargar funcionan. Al aterrizar se
// valida el paso pedido contra los hechos que HAY: si no se sostiene, se cae al
// último que sí **y se dice por qué** ({@link mensajeAterrizaje}). Un enlace
// compartido lleva el paso pero **no lleva el expediente**, y sin ese mensaje eso
// se lee como un fallo de la aplicación.

import { NIVEL, crearEstadoVista, resolverAvisar } from '../viewer/_comun.js'

// ── El vocabulario ───────────────────────────────────────────────────────────

/**
 * Las dos ramas de la aplicación. **Contrato G.**
 *
 * ⚠️ Se declaran AQUÍ desde el rework de UI, y `app/rama.js` las REEXPORTA sin
 * redefinirlas: los valores viajan al `data-rama` del `<body>` y a los
 * `data-rama-panel` de las secciones, y dos declaraciones de la misma cadena en
 * dos ficheros es exactamente cómo se acaba con un atributo escrito que ninguna
 * regla atiende. Los siete llamantes que importan `RAMA` de `app/rama.js` siguen
 * funcionando igual.
 *
 * @readonly
 */
export const RAMA = Object.freeze({ PARCELA: 'PARCELA', EDIFICIO: 'EDIFICIO' })

/**
 * Las ramas en el orden en que se pintan y se tabulan. **Es el orden del DOM.**
 *
 * @readonly
 * @type {readonly ('PARCELA'|'EDIFICIO')[]}
 */
export const RAMAS = Object.freeze([RAMA.PARCELA, RAMA.EDIFICIO])

/**
 * Los cinco pasos del recorrido. **En minúscula a propósito**: son lo que se
 * escribe en la URL (`#/parcela/validacion`) y una cadena que se enseña en la
 * barra de direcciones no se grita. Las ramas, en cambio, siguen en MAYÚSCULA
 * porque son el contrato G con el `data-rama` del marcado; {@link rutaDe} y
 * {@link leerRuta} son los únicos sitios donde se traduce entre las dos formas.
 *
 * @readonly
 */
export const PASO = Object.freeze({
  ENTRADA: 'entrada',
  VALIDACION: 'validacion',
  EDICION: 'edicion',
  DIAGNOSTICO: 'diagnostico',
  INFORME: 'informe',
})

/**
 * Los pasos **en el orden del rail**, que es también el orden de avance: para
 * saber cuál es «el último que se sostiene» se recorre esta lista de atrás
 * adelante ({@link Navegacion#ultimoSostenible}). Cambiar este orden cambia a
 * dónde cae un enlace roto, así que no es decorativo.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const PASOS = Object.freeze([
  PASO.ENTRADA,
  PASO.VALIDACION,
  PASO.EDICION,
  PASO.DIAGNOSTICO,
  PASO.INFORME,
])

/**
 * Lo que se lee en cada paso del rail. Vive aquí y no en el aplicador porque el
 * motivo de bloqueo y el rótulo se leen juntos y en la misma línea: separarlos
 * garantizaba que un día dijeran cosas distintas.
 *
 * @readonly
 */
export const ROTULO_PASO = Object.freeze({
  [PASO.ENTRADA]: 'Entrada',
  [PASO.VALIDACION]: 'Validación',
  [PASO.EDICION]: 'Edición',
  [PASO.DIAGNOSTICO]: 'Diagnóstico',
  [PASO.INFORME]: 'Informe',
})

/**
 * Los dos modos de la sesión. **NO son las banderas de montaje de `crearVisor`**
 * (`comprobacion: true` / `diagnostico: true`): aquéllas dicen qué cajón se
 * construye, éste dice de quién es la geometría que estás mirando.
 *
 * · `NORMAL` — la geometría es del expediente: se edita y se genera GML.
 * · `COMPROBACION` — la geometría viene del GML de otro y es de SOLO LECTURA
 *   hasta que se cruza la puerta ({@link Navegacion#abrirPuerta}).
 *
 * @readonly
 */
export const MODO = Object.freeze({ NORMAL: 'NORMAL', COMPROBACION: 'COMPROBACION' })

/** Los modos, para los mensajes de error y para el test. @readonly */
export const MODOS = Object.freeze([MODO.NORMAL, MODO.COMPROBACION])

/**
 * Por qué está bloqueado un paso, como DATO y no como texto. El aplicador puede
 * necesitar distinguirlos —un bloqueo por MODO lleva la puerta al lado y los
 * otros dos no— y el test puede afirmar la causa sin copiar el literal del
 * motivo, que es la regla de la casa desde `MOTIVO_SIN_OFICIAL` (F07).
 *
 * @readonly
 */
export const CAUSA = Object.freeze({ RAMA: 'RAMA', MODO: 'MODO', DATO: 'DATO' })

// ── Los hechos: lo único que entra de fuera ─────────────────────────────────

/**
 * Las tres cosas que este módulo necesita saber del expediente, y **las únicas**.
 * Son booleanos ya resueltos por quien sí conoce el modelo; aquí no se abre ni un
 * POJO. Quién los calcula, para que no haya que adivinarlo:
 *
 * · `geometria`   — ¿hay algo con lo que trabajar en la rama activa?
 *                   En PARCELA es `hayGeometria(parcela)`
 *                   (`app/cableado-expediente.js:477`: un exterior con al menos
 *                   un vértice). En EDIFICIO es `hayEdificio(edificio)` (ídem,
 *                   línea 467), y ojo: **un edificio con CERO partes SÍ cuenta**,
 *                   porque es el punto de partida de la obra nueva.
 * · `oficial`     — ¿hay contorno del Catastro contra el que contrastar?
 *                   Es la primera mitad de `puedeDiagnosticar`
 *                   (`app/cableado-diagnostico.js:346`).
 * · `diagnostico` — ¿se ha llegado a hacer un diagnóstico de encaje? Es lo que
 *                   el informe firma; sin él, el informe no tiene qué decir.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CLAVES_HECHOS = Object.freeze(['geometria', 'oficial', 'diagnostico'])

/**
 * Cómo arranca una rama: sin nada. Se congela y se COPIA en cada uso; devolver
 * esta misma referencia dejaría que un llamante la mutara para todos.
 *
 * @readonly
 */
export const HECHOS_VACIOS = Object.freeze({ geometria: false, oficial: false, diagnostico: false })

// ── Los motivos, que son el producto de este módulo tanto como el estado ────
//
// Se exportan para que el test los afirme SIN copiar el literal —igual que
// `MOTIVO_SIN_OFICIAL` (F07), `MOTIVO_COLINDANTES_APAGADO` (F05) y
// `MOTIVO_CTA_EN_EDIFICIO` (F11)— y para que el día que haya que reescribirlos
// se reescriban en un sitio.
//
// ⚠️ **SON CORTOS, Y ESO ESTÁ MEDIDO.** Los motivos de la casa hasta hoy viven
// bajo un CTA a lo ancho del panel y andan por los 180–240 caracteres. Éstos
// viven en un rail de **210 px** y se leen los cinco a la vez: la maqueta con las
// fuentes reales del repo los midió en **14 / 14 / 27 / 14 px** de alto (uno
// envuelve a dos líneas) a 1280×720, que es el suelo declarado. Alargarlos
// empujaría la ficha del pie del rail fuera de la pantalla, que es literalmente
// el defecto que este rework viene a arreglar. La regla —qué no se puede, por qué
// y cómo volver a poder— se cumple igual, en una frase en vez de en tres.

/**
 * Por qué un paso no está en esta RAMA. Bloqueo estructural: no se desbloquea
 * trabajando, se desbloquea volviendo a la rama Parcela. Hermano corto de
 * `MOTIVO_CTA_EN_EDIFICIO` (`app/rama.js`), que es el mismo hecho contado en el
 * pie, donde sí hay sitio para el párrafo completo.
 *
 * ⛔ **`EDICION` YA NO ESTÁ AQUÍ, y su ausencia es carga útil.** Hasta el
 * 2026-08-06 decía «esta versión edita parcelas, todavía no construcciones»; F12
 * es la fase que la convierte en falsa, así que la frase se retira en vez de
 * quedarse a envejecer. Un motivo que sobrevive a la limitación que explicaba es
 * peor que ninguno: no se enseña nunca —el paso está disponible— pero el que
 * venga a leer este objeto se creerá que la limitación sigue.
 *
 * @readonly
 */
export const MOTIVO_RAMA = Object.freeze({
  [PASO.DIAGNOSTICO]: 'El diagnóstico contrasta parcelas; aún no sabe con un edificio.',
  [PASO.INFORME]: 'El informe firma un diagnóstico, y el diagnóstico es de parcela.',
})

/**
 * Por qué un paso no está en modo COMPROBACIÓN. **Nombra la puerta**, porque un
 * bloqueo del que no se dice la salida es una cárcel (decisión D4).
 *
 * @readonly
 */
export const MOTIVO_MODO = Object.freeze({
  [PASO.EDICION]: 'Estás comprobando el GML de otro. Pulsa «Tomar esta geometría y editarla».',
})

/**
 * Qué DATO falta. Va indexado por el hecho que falta y **no por el paso**, a
 * propósito: la causa es la misma se mire desde donde se mire, y un texto por
 * paso serían cinco frases que hay que mantener diciendo lo mismo.
 *
 * @readonly
 */
export const MOTIVO_DATO = Object.freeze({
  geometria: 'Trae antes una parcela: por referencia catastral o desde tu medición.',
  oficial: 'Falta el parcelario del Catastro: tráelo desde Entrada.',
  diagnostico: 'Haz antes el diagnóstico de encaje: el informe firma su resultado.',
})

/**
 * Lo mismo, **cuando la rama es EDIFICIO**. Solo los hechos que allí significan
 * otra cosa; el resto sigue saliendo de {@link MOTIVO_DATO}.
 *
 * ⛔ **Existe porque el de arriba MENTÍA en esta rama**, y F12 lo hizo visible al
 * abrir el paso Edición aquí: `geometria` no es «hay parcela» sino «hay
 * edificio» (`hayEdificio`, y ojo: un edificio con CERO partes SÍ cuenta), así
 * que mandar a alguien a traer una parcela para poder editar su construcción es
 * mandarle a hacer lo que no le desbloquea nada. Ya pasaba en Validación desde
 * F11; se arregla aquí porque es aquí donde se midió.
 *
 * La nota de arriba —«indexado por el hecho y no por el paso»— sigue valiendo:
 * lo que cambia no es el paso desde el que se mira, es **qué es el hecho** en
 * cada rama.
 *
 * @readonly
 */
export const MOTIVO_DATO_EDIFICIO = Object.freeze({
  geometria: 'Trae antes un edificio, o añade una parte y dibuja su recinto.',
})

/** El rótulo del CTA que cruza la puerta. Lo pinta el aplicador; el nombre es de
 *  aquí para que el motivo de arriba y el botón digan la MISMA cadena. */
export const ROTULO_PUERTA = 'Tomar esta geometría y editarla'

/** Por qué no se puede cruzar una puerta que no está abierta. Es un fallo de
 *  programación (el CTA no debería existir fuera de COMPROBACIÓN), pero se cuenta
 *  en español porque el aplicador puede enseñarlo. */
export const MOTIVO_SIN_PUERTA =
  'No estás comprobando ningún GML ajeno, así que no hay ninguna geometría de otro que tomar.'

/**
 * Lo que se le dice a quien aterriza desde un enlace que pide un paso que sus
 * datos no sostienen. **Sin este mensaje, el hash se lee como un fallo**: la
 * decisión D3 lo dejó escrito como riesgo y éste es el texto que lo tapa.
 *
 * @param {string} pedido   El paso que traía la URL.
 * @param {string} destino  Donde se ha aterrizado de verdad.
 * @returns {string}
 */
export const mensajeAterrizaje = (pedido, destino) =>
  `El enlace pedía «${ROTULO_PASO[pedido] ?? pedido}», pero un enlace lleva el paso y no el ` +
  `expediente: aquí todavía no está el dato que ese paso necesita. Te dejo en ` +
  `«${ROTULO_PASO[destino] ?? destino}»; según lo traigas, el resto del recorrido se abre solo.`

/**
 * Lo que se dice cuando el paso activo deja de sostenerse porque el dato se ha
 * ido (se cierra un expediente, se descarta la geometría). **Se cae solo, pero no
 * en silencio**: regla de oro 1.
 *
 * @param {string} desde   Donde estaba el usuario.
 * @param {string} destino Donde se le ha dejado.
 * @param {string} motivo  Por qué ya no se sostiene.
 * @returns {string}
 */
export const mensajeCaida = (desde, destino, motivo) =>
  `Ya no se puede seguir en «${ROTULO_PASO[desde] ?? desde}»: ${motivo} Te dejo en ` +
  `«${ROTULO_PASO[destino] ?? destino}».`

/**
 * Lo que se dice cuando el estado y quien lo pinta no consiguen ponerse de
 * acuerdo. Solo puede pasar si un suscriptor navega en cada notificación —o sea,
 * un bucle—: ver {@link TOPE_RECONCILIACION}. Gemelo de `MENSAJE_SIN_CONVERGER`
 * de `app/rama.js`, y por el mismo motivo.
 */
export const MENSAJE_SIN_CONVERGER =
  'La navegación y lo que se ve en pantalla no han conseguido ponerse de acuerdo: algo la está ' +
  'cambiando en bucle. Se deja como está; el detalle técnico está en la consola del navegador.'

/**
 * Cuántas veces se reintenta poner de acuerdo `get()` con los suscriptores antes
 * de rendirse y decirlo. Ocho, el mismo tope y por la misma razón que
 * `TOPE_RECONCILIACION` de `app/rama.js`: hace falta UNA vuelta para el caso real
 * y el tope solo existe para que un bucle de programación no cuelgue la pestaña.
 */
export const TOPE_RECONCILIACION = 8

// ── La tabla de guardas ─────────────────────────────────────────────────────

/**
 * La regla de cada paso, declarativa. Se lee de un vistazo, que es justo lo que
 * no se podía hacer cuando esto vivía repartido en doce ficheros.
 *
 * · `ramas`         — en qué ramas existe el paso.
 * · `enComprobacion`— si el paso está disponible con el GML de otro delante.
 * · `requiere`      — qué hechos hacen falta, **en el orden en que se nombran**:
 *                     si faltan dos, se dice el primero de la lista. Para el
 *                     diagnóstico eso significa «trae antes una parcela» antes
 *                     que «falta el parcelario», que es el orden en que el
 *                     usuario puede resolverlos.
 *
 * ⚠️ **Edición NO exige que la validación haya pasado**, y es deliberado: F02
 * puede devolver `puedeGenerar: false` con errores, y la forma de arreglarlos es
 * precisamente editar. Exigir una validación limpia para entrar en Edición
 * dejaría al usuario encerrado fuera de la única pantalla que resuelve su
 * problema. La maqueta de julio rotulaba «Necesita el recinto validado»; esa
 * frase no llegó al código a propósito.
 *
 * @readonly
 */
const REGLA = Object.freeze({
  [PASO.ENTRADA]: { ramas: RAMAS, enComprobacion: true, requiere: Object.freeze([]) },
  [PASO.VALIDACION]: { ramas: RAMAS, enComprobacion: true, requiere: Object.freeze(['geometria']) },
  // ⛔ **F12 · T4.2 · EDICIÓN PASA A EXISTIR TAMBIÉN EN LA RAMA EDIFICIO.**
  //
  // Hasta el 2026-08-06 este paso era `[RAMA.PARCELA]` y su motivo decía «esta
  // versión edita parcelas, todavía no construcciones». Era verdad, y F12 es
  // exactamente la fase que la deja de serlo: la rama EDIFICIO tiene ya su
  // edición de la parte activa, su dibujo de recinto y su tabla de coordenadas.
  //
  // ⚠️ Y no es cosmética: **con el peldaño apagado, TODO el motor que cablea
  // `app/cableado-edificio.js` era inalcanzable en producción** —nadie llamaría
  // nunca a `edificio.edicion(true)`, la palabra «Dibujar recinto» no aparecería
  // y F12 sería código que solo existe en los tests, que es lo que le pasó a F11
  // hasta su T4.1—. Lo destapó una prueba de T4.2 al intentar navegar hasta aquí.
  //
  // `enComprobacion: false` NO cambia: comprobar el GML de otro sigue siendo un
  // modo de la rama de parcela, y ahí la puerta se cruza con su CTA.
  [PASO.EDICION]: {
    ramas: RAMAS,
    enComprobacion: false,
    requiere: Object.freeze(['geometria']),
  },
  [PASO.DIAGNOSTICO]: {
    ramas: Object.freeze([RAMA.PARCELA]),
    enComprobacion: true,
    requiere: Object.freeze(['geometria', 'oficial']),
  },
  [PASO.INFORME]: {
    ramas: Object.freeze([RAMA.PARCELA]),
    enComprobacion: true,
    requiere: Object.freeze(['diagnostico']),
  },
})

/**
 * ¿Está disponible este paso, y si no, por qué? La ÚNICA función que decide, y
 * pura: mismas entradas, misma respuesta, sin store y sin DOM. Todo lo demás de
 * este módulo la llama.
 *
 * @param {string} paso
 * @param {{rama: string, modo: string, hechos: object}} situacion
 * @returns {{disponible: boolean, causa: string|null, motivo: string|null}}
 */
export function evaluarPaso(paso, { rama, modo, hechos }) {
  const regla = REGLA[paso]
  if (regla === undefined) {
    throw new RangeError(
      `evaluarPaso: paso desconocido ${JSON.stringify(paso)}. Los únicos son ${PASOS.join(', ')}.`,
    )
  }
  // 1 · RAMA — lo que esta versión no sabe hacer. No se arregla trabajando.
  if (!regla.ramas.includes(rama)) {
    return { disponible: false, causa: CAUSA.RAMA, motivo: MOTIVO_RAMA[paso] ?? null }
  }
  // 2 · MODO — la geometría es de otro. Se arregla cruzando la puerta.
  if (modo === MODO.COMPROBACION && !regla.enComprobacion) {
    return { disponible: false, causa: CAUSA.MODO, motivo: MOTIVO_MODO[paso] ?? null }
  }
  // 3 · DATO — lo único que se resuelve solo según se avanza.
  for (const hecho of regla.requiere) {
    if (hechos[hecho] !== true) {
      // El de la rama manda cuando lo hay: ver {@link MOTIVO_DATO_EDIFICIO}.
      const propio = rama === RAMA.EDIFICIO ? MOTIVO_DATO_EDIFICIO[hecho] : undefined
      return { disponible: false, causa: CAUSA.DATO, motivo: propio ?? MOTIVO_DATO[hecho] ?? null }
    }
  }
  return { disponible: true, causa: null, motivo: null }
}

// ── La URL (decisión D3) ────────────────────────────────────────────────────

/**
 * El estado, escrito como hash. `{rama: 'PARCELA', paso: 'validacion'}` →
 * `#/parcela/validacion`. **El modo no viaja en la URL**: la comprobación empieza
 * al soltar el fichero de otro, y un enlace nunca lleva ese fichero, así que
 * escribirlo prometería un estado imposible de restaurar.
 *
 * @param {{rama: string, paso: string}} estado
 * @returns {string}
 */
export function rutaDe({ rama, paso }) {
  return `#/${String(rama).toLowerCase()}/${String(paso).toLowerCase()}`
}

/**
 * Lee un hash y devuelve lo que pide, **sin juzgar si se sostiene**: eso es de
 * {@link Navegacion#irARuta}, que es quien conoce los hechos. Separarlo permite
 * probar el traductor con cadenas sueltas y sin montar nada.
 *
 * Tolerante con lo que un usuario puede escribir a mano o pegar mal —con o sin
 * `#`, con o sin `/` inicial, con `/` de sobra al final, en cualquier caja— y
 * ESTRICTO con lo que no es una ruta: devuelve `null` y quien llame decide. Un
 * hash ajeno (`#seccion`, el de otra librería) no es un error, es que no es
 * nuestro.
 *
 * @param {string} hash
 * @returns {{rama: string, paso: string}|null}
 */
export function leerRuta(hash) {
  if (typeof hash !== 'string') return null
  const limpio = hash.trim().replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '')
  if (limpio === '') return null
  const trozos = limpio.split('/')
  if (trozos.length !== 2) return null
  const rama = trozos[0].toUpperCase()
  const paso = trozos[1].toLowerCase()
  if (!RAMAS.includes(rama)) return null
  if (!PASOS.includes(paso)) return null
  return { rama, paso }
}

// ── Utilidades internas ─────────────────────────────────────────────────────

/**
 * Normaliza y valida una rama, o LANZA nombrándola. Es un parámetro de
 * PROGRAMADOR —el usuario solo pulsa uno de los dos botones del conmutador—, así
 * que una cadena que no sea una rama se caza al escribirla y no media hora
 * después. Mismo criterio (y casi el mismo texto) que `normalizarRama` de
 * `app/rama.js`.
 *
 * @param {*} rama
 * @param {string} quien
 * @returns {'PARCELA'|'EDIFICIO'}
 */
function exigirRama(rama, quien) {
  if (!RAMAS.includes(rama)) {
    throw new RangeError(
      `${quien}: rama desconocida ${JSON.stringify(rama)}. Las únicas son ` +
        `${RAMAS.map((r) => `RAMA.${r}`).join(' y ')}.`,
    )
  }
  return rama
}

/** Igual, para un paso. @param {*} paso @param {string} quien @returns {string} */
function exigirPaso(paso, quien) {
  if (!PASOS.includes(paso)) {
    throw new RangeError(
      `${quien}: paso desconocido ${JSON.stringify(paso)}. Los únicos son ${PASOS.join(', ')}.`,
    )
  }
  return paso
}

/**
 * Valida un registro de hechos y lo devuelve completo.
 *
 * ⛔ **Una clave desconocida LANZA, y ése es el punto.** Si `geomtria` (con la
 * errata) se aceptara en silencio, `geometria` seguiría en `false` y el usuario
 * vería CUATRO pasos apagados sin ninguna razón visible, con la suite en verde.
 * Es el mismo fallo mudo que la regla de `hidden` evita en el DOM, pero en los
 * datos. Una clave AUSENTE, en cambio, es `false` y no lanza: un hecho que no
 * afirmas es un hecho que no tienes.
 *
 * @param {object} parciales
 * @param {object} base
 * @param {string} quien
 * @returns {{geometria: boolean, oficial: boolean, diagnostico: boolean}}
 */
function fundirHechos(parciales, base, quien) {
  if (parciales === null || typeof parciales !== 'object' || Array.isArray(parciales)) {
    throw new TypeError(
      `${quien}: los hechos deben ser un objeto con ${CLAVES_HECHOS.join('/')}; recibido ` +
        `${JSON.stringify(parciales)}.`,
    )
  }
  for (const clave of Object.keys(parciales)) {
    if (!CLAVES_HECHOS.includes(clave)) {
      throw new TypeError(
        `${quien}: hecho desconocido «${clave}». Los únicos son ${CLAVES_HECHOS.join(', ')}. ` +
          `Aceptarlo dejaría el rail apagado sin decir por qué.`,
      )
    }
  }
  const fundido = { ...base }
  for (const clave of CLAVES_HECHOS) {
    if (clave in parciales) fundido[clave] = parciales[clave] === true
  }
  return fundido
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Situacion
 * @property {'PARCELA'|'EDIFICIO'} rama
 * @property {string} paso
 * @property {'NORMAL'|'COMPROBACION'} modo
 * @property {{geometria: boolean, oficial: boolean, diagnostico: boolean}} hechos
 *   Los hechos **de la rama activa**. Los de la otra siguen guardados: ver
 *   {@link Navegacion#hechosDe}.
 */

/**
 * @typedef {Object} Desenlace
 * @property {boolean} ok        Si el movimiento se ha hecho.
 * @property {string} paso       Donde se ha quedado: el pedido si `ok`, el que
 *   había si no. **Nunca `null`**: siempre se está en algún paso.
 * @property {string|null} causa  Uno de {@link CAUSA} cuando `ok` es `false`.
 * @property {string|null} motivo Qué decirle al usuario, en español.
 */

/**
 * @typedef {Object} PeldañoDelRail
 * @property {string} paso
 * @property {string} rotulo
 * @property {boolean} activo      Si es el paso en el que se está.
 * @property {boolean} disponible  Si se puede ir.
 * @property {string|null} causa   Por qué no, como dato.
 * @property {string|null} motivo  Por qué no, en español. **Cuando `disponible`
 *   es `false` esto NO es null**, y hay una prueba que recorre los cinco pasos en
 *   todas las combinaciones para atestarlo: es el criterio «cero pasos apagados
 *   en silencio», y es la mitad del producto de este módulo.
 */

/**
 * Crea la autoridad de navegación. **No monta nada**: no hay `destruir()` porque
 * no hay ni un oyente ni un nodo que devolver.
 *
 * El estado inicial es de PROGRAMADOR: si el `paso` que se pide no se sostiene
 * con los hechos que se dan, se recorta en silencio al último que sí. Para
 * arrancar desde la URL —que sí es de usuario y sí hay que contarlo— está
 * {@link Navegacion#irARuta}.
 *
 * @param {Object} [opciones]
 * @param {'PARCELA'|'EDIFICIO'} [opciones.rama=RAMA.PARCELA]
 * @param {string} [opciones.paso=PASO.ENTRADA]
 * @param {'NORMAL'|'COMPROBACION'} [opciones.modo=MODO.NORMAL]
 * @param {object} [opciones.hechos]  Hechos de la rama inicial, o un registro por
 *   rama (`{PARCELA: {...}, EDIFICIO: {...}}`) si ya se conocen los dos.
 * @param {((mensaje: string, opciones?: object) => void)|null} [opciones.avisar]
 *   Canal de aviso de la casa. Se usa SOLO para lo que el usuario tiene que
 *   saber: la caída de paso y la no convergencia.
 * @returns {Navegacion}
 */
export function crearNavegacion({
  rama = RAMA.PARCELA,
  paso = PASO.ENTRADA,
  modo = MODO.NORMAL,
  hechos = {},
  avisar = null,
} = {}) {
  const contarlo = resolverAvisar(avisar)
  exigirRama(rama, 'crearNavegacion')
  exigirPaso(paso, 'crearNavegacion')
  if (!MODOS.includes(modo)) {
    throw new RangeError(
      `crearNavegacion: modo desconocido ${JSON.stringify(modo)}. Los únicos son ` +
        `${MODOS.map((m) => `MODO.${m}`).join(' y ')}.`,
    )
  }

  // Los hechos van POR RAMA, y no es un lujo: si fueran uno solo habría una
  // ventana —entre conmutar y refrescar— en la que la rama diría EDIFICIO y los
  // hechos seguirían describiendo la parcela, y el rail enseñaría pasos abiertos
  // que no lo están. Guardándolos por rama, conmutar no necesita nada más.
  const porRama = {
    [RAMA.PARCELA]: { ...HECHOS_VACIOS },
    [RAMA.EDIFICIO]: { ...HECHOS_VACIOS },
  }
  const pareceRegistroPorRama = RAMAS.some((r) => Object.prototype.hasOwnProperty.call(hechos, r))
  if (pareceRegistroPorRama) {
    for (const r of RAMAS) {
      if (Object.prototype.hasOwnProperty.call(hechos, r)) {
        porRama[r] = fundirHechos(hechos[r], porRama[r], `crearNavegacion.hechos.${r}`)
      }
    }
  } else {
    porRama[rama] = fundirHechos(hechos, porRama[rama], 'crearNavegacion.hechos')
  }

  const store = crearEstadoVista(null)
  /** El último estado que se llegó a NOTIFICAR. Ver la reconciliación en `publicar`. */
  let notificado = null
  /** Si estamos dentro de una publicación (la nuestra, no la de `crearEstadoVista`). */
  let publicando = false

  store.subscribe((situacion) => {
    notificado = situacion
  })

  /** @param {string} r @returns {Situacion} */
  const situacionCon = (r, p, m) =>
    Object.freeze({ rama: r, paso: p, modo: m, hechos: Object.freeze({ ...porRama[r] }) })

  /**
   * Publica un estado nuevo y **reconcilia la guarda anti-reentrada de
   * `crearEstadoVista`**.
   *
   * Aquel store, si un suscriptor escribe DURANTE la notificación, actualiza el
   * estado y no relanza la cascada (es su defensa contra el bucle de
   * realimentación, y está bien). Aquí eso dejaría `get()` diciendo una cosa y a
   * los suscriptores creyendo otra, que es el desacuerdo más caro que puede tener
   * este módulo. Se arregla igual que en `app/rama.js`, y **sin tocar
   * `viewer/_comun.js`**, que tiene más de cinco mil pruebas detrás.
   *
   * La reentrada se corta arriba a propósito: si un suscriptor navega dentro de
   * la notificación, su `publicar` deja el estado escrito y **se va**; el bucle
   * de la llamada de fuera es el que vuelve a notificar. Sin ese corte, el de
   * dentro giraría hasta el tope sin que nadie escuchara.
   *
   * @param {Situacion} siguiente
   */
  function publicar(siguiente) {
    if (publicando) {
      store.set(siguiente)
      return
    }
    publicando = true
    try {
      store.set(siguiente)
      let vueltas = 0
      while (store.get() !== notificado && vueltas < TOPE_RECONCILIACION) {
        store.set(store.get())
        vueltas += 1
      }
      if (store.get() !== notificado) {
        contarlo(MENSAJE_SIN_CONVERGER, { nivel: NIVEL.ERROR })
        console.error(
          `[navegacion] no converge tras ${TOPE_RECONCILIACION} vueltas: get()=` +
            `${JSON.stringify(store.get())}, notificado=${JSON.stringify(notificado)}.`,
        )
      }
    } finally {
      publicando = false
    }
  }

  /**
   * El paso más avanzado que se sostiene con la situación dada. Se recorre
   * {@link PASOS} de atrás adelante, así que un enlace roto no cae siempre a
   * Entrada: si el usuario tiene la parcela cargada, cae en Validación, que es
   * donde estaría de haber llegado andando.
   *
   * @param {Situacion} situacion
   * @returns {string}
   */
  function ultimoSostenible(situacion) {
    for (let i = PASOS.length - 1; i >= 0; i -= 1) {
      if (evaluarPaso(PASOS[i], situacion).disponible) return PASOS[i]
    }
    // Entrada no tiene guardas, así que esto es inalcanzable salvo que alguien
    // le ponga una. Se devuelve igual en vez de `undefined`: nunca «sin paso».
    return PASO.ENTRADA
  }

  /**
   * Recorta el paso activo si ha dejado de sostenerse, lo publica, y **lo
   * cuenta**. Un usuario al que la pantalla le cambia debajo sin explicación cree
   * que ha hecho algo mal.
   *
   * @param {{rama: string, paso: string, modo: string}} pretendida
   * @returns {Desenlace}
   */
  function asentar({ rama: r, paso: p, modo: m }) {
    const tentativa = situacionCon(r, p, m)
    const veredicto = evaluarPaso(p, tentativa)
    if (veredicto.disponible) {
      publicar(tentativa)
      return { ok: true, paso: p, causa: null, motivo: null }
    }
    const destino = ultimoSostenible(tentativa)
    publicar(situacionCon(r, destino, m))
    const aviso = mensajeCaida(p, destino, veredicto.motivo ?? '')
    contarlo(aviso, { nivel: NIVEL.AVISO })
    return { ok: false, paso: destino, causa: veredicto.causa, motivo: aviso }
  }

  // El estado inicial se recorta EN SILENCIO (ver la cabecera de `crearNavegacion`):
  // publicar por el canal de avisos durante el montaje llenaría el panel antes de
  // que el usuario haya hecho nada.
  {
    const tentativa = situacionCon(rama, paso, modo)
    const pisoFirme = evaluarPaso(paso, tentativa).disponible ? paso : ultimoSostenible(tentativa)
    publicar(situacionCon(rama, pisoFirme, modo))
  }

  /**
   * @typedef {Object} Navegacion
   * @property {() => Situacion} get
   * @property {(fn: (s: Situacion) => void) => (() => void)} subscribe
   * @property {(paso: string) => Desenlace} navegarAPaso
   * @property {(rama: string) => Desenlace} cambiarRama
   * @property {(parciales: object, rama?: string) => Desenlace} actualizarHechos
   * @property {(rama: string) => object} hechosDe
   * @property {() => Desenlace} entrarEnComprobacion
   * @property {() => Desenlace} abrirPuerta
   * @property {() => PeldañoDelRail[]} rail
   * @property {() => string} ruta
   * @property {(hash: string) => Desenlace} irARuta
   * @property {(paso: string) => {disponible: boolean, causa: string|null, motivo: string|null}} puedeIrA
   */
  return {
    get: () => store.get(),

    subscribe(fn) {
      return store.subscribe(fn)
    },

    /**
     * Lleva al paso pedido, o se queda donde está **diciendo por qué**. Un paso
     * bloqueado NO lanza: que el usuario pulse algo que todavía no puede es un
     * recorrido normal, no un fallo de programación. Lo que sí lanza es un paso
     * que no existe, que solo puede escribirlo quien programa.
     *
     * @param {string} paso
     * @returns {Desenlace}
     */
    navegarAPaso(destino) {
      exigirPaso(destino, 'navegarAPaso')
      const actual = store.get()
      // Ya estamos ahí: no se notifica. Un movimiento redundante despertaría a
      // los suscriptores (que recargan cosas) sin que nada haya cambiado. Misma
      // guarda que `alPulsar` de `app/rama.js`.
      if (destino === actual.paso) return { ok: true, paso: destino, causa: null, motivo: null }
      const veredicto = evaluarPaso(destino, actual)
      if (!veredicto.disponible) {
        return { ok: false, paso: actual.paso, causa: veredicto.causa, motivo: veredicto.motivo }
      }
      publicar(situacionCon(actual.rama, destino, actual.modo))
      return { ok: true, paso: destino, causa: null, motivo: null }
    },

    /**
     * Conmuta de rama. Los hechos de la rama de destino ya están guardados, así
     * que el paso se reevalúa **contra los suyos** y no contra los de la rama de
     * la que se viene; si no se sostiene, se cae y se cuenta.
     *
     * ⚠️ El modo NO se toca. En la rama EDIFICIO la comprobación no añade ningún
     * bloqueo que la rama no ponga ya, y borrarlo al conmutar significaría que ir
     * y volver te saca del modo sin pedírtelo.
     *
     * @param {string} destino
     * @returns {Desenlace}
     */
    cambiarRama(destino) {
      exigirRama(destino, 'cambiarRama')
      const actual = store.get()
      if (destino === actual.rama) return { ok: true, paso: actual.paso, causa: null, motivo: null }
      return asentar({ rama: destino, paso: actual.paso, modo: actual.modo })
    },

    /**
     * Actualiza los hechos de una rama (la activa por omisión) y reevalúa. Es lo
     * que llama el aplicador cuando el store del documento cambia.
     *
     * @param {object} parciales  Solo las claves que cambian.
     * @param {string} [rama]     A qué rama pertenecen; la activa por omisión.
     * @returns {Desenlace}
     */
    actualizarHechos(parciales, rama = store.get().rama) {
      exigirRama(rama, 'actualizarHechos')
      porRama[rama] = fundirHechos(parciales, porRama[rama], 'actualizarHechos')
      const actual = store.get()
      return asentar({ rama: actual.rama, paso: actual.paso, modo: actual.modo })
    },

    /**
     * Los hechos de una rama, **también de la que no está activa**. Es lo que
     * necesita T7 para avisar de qué rama se guarda y cuál se queda fuera del
     * fichero.
     *
     * @param {string} rama
     * @returns {{geometria: boolean, oficial: boolean, diagnostico: boolean}}
     */
    hechosDe(rama) {
      exigirRama(rama, 'hechosDe')
      return Object.freeze({ ...porRama[rama] })
    },

    /**
     * Entra en comprobación: la geometría que hay delante es de otro. Fuerza la
     * rama PARCELA —se comprueba el GML de una parcela, no de un edificio— y
     * reevalúa el paso.
     *
     * @returns {Desenlace}
     */
    entrarEnComprobacion() {
      const actual = store.get()
      return asentar({ rama: RAMA.PARCELA, paso: actual.paso, modo: MODO.COMPROBACION })
    },

    /**
     * **La puerta** (D4). Toma la geometría del GML ajeno como propia: el modo
     * pasa a NORMAL y el rail se completa. Se queda en el paso en el que estaba,
     * que es lo que espera quien acaba de decir «y ahora quiero editar esto»:
     * el rail se enciende delante de sus ojos en vez de teletransportarle.
     *
     * @returns {Desenlace}
     */
    abrirPuerta() {
      const actual = store.get()
      if (actual.modo !== MODO.COMPROBACION) {
        return { ok: false, paso: actual.paso, causa: CAUSA.MODO, motivo: MOTIVO_SIN_PUERTA }
      }
      publicar(situacionCon(actual.rama, actual.paso, MODO.NORMAL))
      return { ok: true, paso: actual.paso, causa: null, motivo: null }
    },

    /**
     * El rail entero, listo para pintar. **Los cinco pasos, siempre**: uno que no
     * está disponible se apaga y se explica, nunca desaparece. Un rail que
     * encoge y crece no deja aprender el recorrido, y aprenderlo es el punto.
     *
     * @returns {PeldañoDelRail[]}
     */
    rail() {
      const actual = store.get()
      return PASOS.map((p) => {
        const veredicto = evaluarPaso(p, actual)
        return {
          paso: p,
          rotulo: ROTULO_PASO[p],
          activo: p === actual.paso,
          disponible: veredicto.disponible,
          causa: veredicto.causa,
          motivo: veredicto.motivo,
        }
      })
    },

    /** ¿Se puede ir a este paso, y si no, por qué? Sin moverse. Es
     *  {@link evaluarPaso} contra la situación actual, y existe para que el
     *  aplicador no tenga que reconstruirla a mano. @param {string} paso */
    puedeIrA(paso) {
      exigirPaso(paso, 'puedeIrA')
      return evaluarPaso(paso, store.get())
    },

    /** El estado actual escrito como hash. @returns {string} */
    ruta() {
      return rutaDe(store.get())
    },

    /**
     * Aterriza desde un hash (arranque, atrás/adelante, enlace pegado). **El dato
     * manda sobre la URL** (D3): si el paso pedido no se sostiene se cae al
     * último que sí y se dice por qué, con {@link mensajeAterrizaje} y no con el
     * mensaje de caída, porque la causa es distinta —aquí nadie ha perdido nada,
     * es que un enlace no lleva el expediente— y confundirlas se lee como un
     * fallo de la aplicación.
     *
     * Un hash que no es nuestro (`#seccion`, el de otra librería) no mueve nada y
     * no se cuenta: no es un error, es que no va con nosotros.
     *
     * @param {string} hash
     * @returns {Desenlace}
     */
    irARuta(hash) {
      const pedido = leerRuta(hash)
      const actual = store.get()
      if (pedido === null) {
        return { ok: false, paso: actual.paso, causa: null, motivo: null }
      }
      const tentativa = situacionCon(pedido.rama, pedido.paso, actual.modo)
      const veredicto = evaluarPaso(pedido.paso, tentativa)
      if (veredicto.disponible) {
        publicar(tentativa)
        return { ok: true, paso: pedido.paso, causa: null, motivo: null }
      }
      const destino = ultimoSostenible(tentativa)
      publicar(situacionCon(pedido.rama, destino, actual.modo))
      const aviso = mensajeAterrizaje(pedido.paso, destino)
      contarlo(aviso, { nivel: NIVEL.AVISO })
      return { ok: false, paso: destino, causa: veredicto.causa, motivo: aviso }
    },
  }
}
