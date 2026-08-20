// app/navegacion.js — Rework de UI · T1. EL DUEÑO ÚNICO DE {rama, paso}.
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
//   1. Guarda `{rama, paso}` y notifica a quien se suscriba.
//   2. Decide si un paso está DISPONIBLE, y cuando no lo está **entrega el
//      motivo escrito en español**. Regla de la casa: *paso apagado con motivo,
//      jamás paso muerto*.
//   3. Traduce ese estado a la URL y de vuelta (`#/parcela/edicion`).
//
// **⛔ NO TOCA EL DOM. Ni una línea.** No importa nada de `viewer/` que necesite
// `window`, no consulta `document`, no lee `location` ni escribe `location.hash`
// —recibe y devuelve CADENAS—, y por eso su prueba vive en el proyecto Vitest
// `node` (el bucle rápido) y no en `dom`. Quien pinta el rail, quien pone
// `hidden`, quien escribe el hash del navegador y quien apaga un botón es el
// APLICADOR (`app/rama.js` y `app/barra.js`, la barra de recorrido):
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
// pruebas propias, ANTES de tocar una línea de CSS». Su primer llamante llegó en
// T5 (entonces el rail vertical; desde 2026-08-10, `app/barra.js`). Hasta entonces `app/rama.js` sigue llevando
// la rama por su cuenta: son **dos dueños a la vez durante una rebanada**, y está
// contado a propósito para que nadie lo descubra como sorpresa. Lo que sí se hace
// hoy es dejar UNA sola definición del vocabulario de rama: {@link RAMA} y
// {@link RAMAS} se declaran AQUÍ y `app/rama.js` las reexporta, para que el día
// que aquél se degrade a aplicador la dependencia ya apunte en el sentido bueno
// (aplicador → dueño) y no haya que invertir un import con siete llamantes.
//
// ── EL ORDEN DE LAS CAUSAS, QUE NO ES CAPRICHO ─────────────────────────────
// Un paso puede estar bloqueado por dos cosas a la vez. Se dice SIEMPRE la más
// estructural primero, porque es la que el usuario no puede resolver trabajando:
//
//   1. RAMA  — «esta versión no sabe hacer eso con un edificio». No se arregla
//              trayendo datos: se arregla volviendo a la rama Parcela.
//   2. DATO  — «trae antes una parcela». Se arregla trabajando, y es el único de
//              los dos que se resuelve solo según avanzas.
//
// Decirlo al revés sería mentir por omisión: «trae antes una parcela» en la rama
// Edificio manda al usuario a hacer un trabajo que no le va a desbloquear nada.
//
// ── ⛔ AQUÍ HUBO UN TERCER EJE —EL MODO— Y SE RETIRÓ EL 2026-08-07 ──────────
// Este módulo llevaba un `modo` con dos valores (`NORMAL` y `COMPROBACION`) y una
// tercera causa de bloqueo entre RAMA y DATO: mientras la geometría viniera del
// GML de otro técnico, Edición estaba apagada y solo se abría cruzando «LA
// PUERTA» —un CTA llamado «Tomar esta geometría y editarla»—. La idea era
// «comprobación es una puerta, no una cárcel».
//
// **En producción era una cárcel, y está medido.** El CTA vivía dentro del cajón
// de DIAGNÓSTICO (`viewer/cajon-diagnostico.js`), y ese cajón solo se abre en el
// paso Diagnóstico, que en la rama PARCELA **exige el parcelario del Catastro**.
// Un GML sin referencia catastral utilizable —el caso corriente: un alta, una
// pérgola, cualquier fichero que todavía no tiene refcat— no trae parcelario, así
// que Diagnóstico se quedaba apagado… y con él la única pantalla que contenía la
// puerta. El rail mandaba a pulsar un botón que en ese recorrido **no existía en
// ninguna parte de la aplicación**.
//
// Y la premisa de fondo tampoco se sostenía: el GML que se abre es, la mayoría de
// las veces, **el tuyo** —el que generaste ayer y quieres retocar—. Tratar todo
// fichero `.gml` como trabajo ajeno y de solo lectura le cobraba un peaje al caso
// normal para proteger uno raro.
//
// Lo que sí se conserva es lo único que de verdad protegía: **de dónde salió la
// geometría se sigue diciendo** —`parcela.origen` no cambia, la cabecera rotula
// «GML importado · no del Catastro» y el renglón de procedencia lo repite—. Lo
// que se ha ido es el bloqueo, no la verdad.
//
// ── LA URL (decisión D3): HASH, Y EL DATO MANDA SOBRE LA URL ───────────────
// `#/parcela/edicion`. El hash no necesita nada del servidor, así que GitHub
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
 * Los pasos del recorrido. **En minúscula a propósito**: son lo que se escribe
 * en la URL (`#/parcela/edicion`) y una cadena que se enseña en la barra de
 * direcciones no se grita. Las ramas, en cambio, siguen en MAYÚSCULA porque son
 * el contrato G con el `data-rama` del marcado; {@link rutaDe} y
 * {@link leerRuta} son los únicos sitios donde se traduce entre las dos formas.
 *
 * ── ⭐ ERAN CINCO HASTA EL 2026-08-08, Y AHORA SON TRES ─────────────────────
 * Se retiran `VALIDACION` e `INFORME`. Los dos por el mismo motivo —el rail
 * prometía cinco estados y el panel solo tenía tres caras— pero con dos
 * historias distintas, y las dos MEDIDAS en Chrome antes de tocar nada:
 *
 *   · **VALIDACIÓN y EDICIÓN eran la misma pantalla.** Literalmente la misma
 *     `<section>`: el marcado decía `data-pantalla="validacion edicion informe"`
 *     en el bloque de vértices. Lo único que las separaba era que en una el
 *     arrastre estaba apagado y había un pie con tres CTA, y en la otra el
 *     arrastre estaba encendido y los CTA no existían. Y sus dos compuertas de
 *     acceso pedían EXACTAMENTE lo mismo (`ramas: RAMAS`,
 *     `requiere: ['geometria']`), así que fusionarlas no cambia quién puede
 *     entrar: el `REGLA` de abajo lo demuestra por ausencia.
 *     ⚠️ Desde que los avisos se mudaron a su diálogo (2026-08-07), «Validación»
 *     además ya no enseñaba ninguna validación: el nombre apuntaba a una
 *     superficie que se había ido a otro sitio.
 *
 *   · **INFORME no estaba vacío —eso se midió mal la primera vez— pero tampoco
 *     necesitaba ser un paso.** Pulsarlo abría el formulario del informe a
 *     pantalla completa (820 px medidos). Eso lo arregló la rebanada 5 del
 *     rework el 2026-08-05, y arreglaba un defecto real: hasta ese día el
 *     peldaño no participaba en producir el informe. Lo que la rebanada 5 no
 *     miró es que había una segunda salida al mismo defecto —**quitar el
 *     peldaño**— que no obliga al rail a tener un estado para cada `<dialog>`
 *     de la aplicación. El informe se sigue presentando a pantalla completa;
 *     lo que deja de existir es el peldaño (ver `app/main.js`).
 *
 * ⛔ **NO se dejan alias.** Sería tentador conservar `PASO.VALIDACION` apuntando
 * a `'edicion'` para no tocar a los llamantes. Eso es exactamente la segunda
 * fuente de verdad que este fichero lleva doce fases evitando: quien siga
 * escribiendo `PASO.VALIDACION` tiene que romperse ahora, no dentro de un año.
 * Las URL de fuera SÍ se respetan, y para eso está {@link RUTA_RETIRADA}.
 *
 * @readonly
 */
export const PASO = Object.freeze({
  ENTRADA: 'entrada',
  EDICION: 'edicion',
  DIAGNOSTICO: 'diagnostico',
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
export const PASOS = Object.freeze([PASO.ENTRADA, PASO.EDICION, PASO.DIAGNOSTICO])

/**
 * Los pasos que EXISTIERON y a dónde va hoy quien llega con su URL.
 *
 * Un marcador guardado, un enlace pegado en un correo o el botón «atrás» del
 * navegador pueden traer todavía `#/parcela/validacion` o `#/parcela/informe`.
 * Sin esta tabla, {@link leerRuta} los declararía «no es una ruta nuestra» y el
 * usuario aterrizaría donde le tocara sin enterarse de por qué.
 *
 * A dónde va cada uno no es arbitrario: **al peldaño que se quedó su contenido**.
 * Validación se fusionó con Edición, e Informe se abre desde Diagnóstico.
 *
 * ⚠️ Esta tabla CRECE, no se limpia. El día que se retire otro paso se añade
 * aquí; borrar una entrada es romper enlaces que llevan años funcionando, y no
 * cuesta nada mantenerlas.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const RUTA_RETIRADA = Object.freeze({
  validacion: PASO.EDICION,
  informe: PASO.DIAGNOSTICO,
})

/**
 * Lo que se lee en cada paso del rail. Vive aquí y no en el aplicador porque el
 * motivo de bloqueo y el rótulo se leen juntos y en la misma línea: separarlos
 * garantizaba que un día dijeran cosas distintas.
 *
 * @readonly
 */
export const ROTULO_PASO = Object.freeze({
  [PASO.ENTRADA]: 'Entrada',
  [PASO.EDICION]: 'Edición',
  [PASO.DIAGNOSTICO]: 'Diagnóstico',
})

/**
 * Por qué está bloqueado un paso, como DATO y no como texto. El aplicador puede
 * necesitar distinguirlos y el test puede afirmar la causa sin copiar el literal
 * del motivo, que es la regla de la casa desde `MOTIVO_SIN_OFICIAL` (F07).
 *
 * ⛔ **Aquí hubo un tercer valor, `MODO`, y se retiró el 2026-08-07** junto con el
 * eje entero. El porqué está en la cabecera; el resumen es que la puerta que
 * levantaba ese bloqueo vivía en una pantalla a la que el propio bloqueo impedía
 * llegar.
 *
 * @readonly
 */
export const CAUSA = Object.freeze({ RAMA: 'RAMA', DATO: 'DATO' })

// ── Los hechos: lo único que entra de fuera ─────────────────────────────────

/**
 * Las tres cosas que este módulo necesita saber del expediente, y **las únicas**.
 * Son booleanos ya resueltos por quien sí conoce el modelo; aquí no se abre ni un
 * POJO. Quién los calcula, para que no haya que adivinarlo:
 *
 * · `geometria`   — ¿hay un RECINTO con el que trabajar en la rama activa?
 *                   En PARCELA es `hayGeometria(parcela)`
 *                   (`app/cableado-expediente.js:477`: un exterior con al menos
 *                   un vértice). En EDIFICIO es `hayEdificio(edificio)` (ídem,
 *                   línea 467), y ojo: **un edificio con CERO partes SÍ cuenta**,
 *                   porque es el punto de partida de la obra nueva.
 * · `oficial`     — ¿hay contorno del Catastro contra el que contrastar?
 *                   Es la primera mitad de `puedeDiagnosticar`
 *                   (`app/cableado-diagnostico.js:346`).
 * · `puntos`      — ⭐ (2026-08-19) ¿hay puntos sueltos de un levantamiento
 *                   importado? En PARCELA es `hayPuntos(parcela)`
 *                   (`app/cableado-expediente.js`, al lado de `hayGeometria`); en
 *                   EDIFICIO es `false` y no hay planes: esa rama dibuja sobre la
 *                   parte activa y no importa nubes de puntos.
 *
 * ── ⛔ POR QUÉ UN HECHO NUEVO Y NO ENSANCHAR `geometria` ────────────────────
 * La tentación era hacer que `geometria` significara «hay algo con lo que
 * trabajar» y contar los puntos dentro. **Habría abierto Diagnóstico sobre cero
 * recintos**, porque su regla lo exige (`REGLA[PASO.DIAGNOSTICO]`), y esa pantalla
 * contrastaría una geometría que no existe contra el parcelario. Un hecho que dos
 * peldaños leen con el mismo nombre tiene que querer decir lo mismo en los dos.
 *
 * Y no repite el error del hecho `diagnostico` que se retiró abajo: **éste tiene
 * un lector real** —la compuerta de Edición— desde la línea en que se escribe.
 *
 * ── ⛔ ERAN TRES, Y EL TERCERO SE VA CON EL PELDAÑO QUE LO LEÍA (2026-08-08) ──
 * Había un `diagnostico` — «¿se ha llegado a hacer un diagnóstico de encaje?»— y
 * su ÚNICO consumidor era `REGLA[PASO.INFORME]` en la rama PARCELA. Retirado ese
 * peldaño, el hecho se quedaba **de solo escritura**: `app/main.js` lo calculaba
 * en cada refresco, `MOTIVO_DATO` tenía una frase para él que ya no podía
 * enseñarse en ninguna pantalla, y `alDiagnostico(refrescarHechos)` —el canal que
 * T9 construyó para sustituir un `setTimeout(…, 500)`— existía solo para
 * encenderlo a tiempo.
 *
 * Un dato que se calcula y nadie lee no es inocuo aquí: es lo que hace que dentro
 * de un año alguien lo use creyendo que gobierna algo. Se retira entero, y
 * `fundirHechos` lanza nombrando la clave si alguien vuelve a pasarlo — que es la
 * forma de que esta retirada no se pueda deshacer a medias en silencio.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CLAVES_HECHOS = Object.freeze(['geometria', 'oficial', 'puntos'])

/**
 * Cómo arranca una rama: sin nada. Se congela y se COPIA en cada uso; devolver
 * esta misma referencia dejaría que un llamante la mutara para todos.
 *
 * @readonly
 */
export const HECHOS_VACIOS = Object.freeze({ geometria: false, oficial: false, puntos: false })

// ── Los motivos, que son el producto de este módulo tanto como el estado ────
//
// Se exportan para que el test los afirme SIN copiar el literal —igual que
// `MOTIVO_SIN_OFICIAL` (F07), `MOTIVO_COLINDANTES_APAGADO` (F05) y
// `MOTIVO_CTA_EN_EDIFICIO` (F11)— y para que el día que haya que reescribirlos
// se reescriban en un sitio.
//
// ⚠️ **SON CORTOS, Y ESO ESTÁ MEDIDO.** Los motivos de la casa hasta hoy viven
// bajo un CTA a lo ancho del panel y andan por los 180–240 caracteres. Éstos
// tienen que caber en la barra de recorrido, y la regla —qué no se puede, por qué
// y cómo volver a poder— se cumple igual en una frase que en tres.
//
// ⭐ **DÓNDE VIVEN CAMBIÓ EL 2026-08-10, y con ello a qué aprieta el tope.**
// Hasta esa fecha vivían en un rail vertical de 210 px y se leían los tres a la
// vez, envolviendo a tres renglones (**40,5 px medidos** a 1280×720). Alargarlos
// empujaba la ficha del pie del rail fuera de la pantalla. Girada la barra:
//
//   · la forma LARGA de aquí baja al RENGLÓN, de ancho completo y **una línea de
//     alto fija**. Ya no empuja nada: se RECORTA, que se ve menos. Tope 90.
//   · la forma BREVE ({@link MOTIVO_BREVE}) se queda pegada al peldaño, que es un
//     hueco mucho más pequeño. Tope 22.
//
// Los dos topes los vigila `test/app/navegacion.test.js`.

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
  // ⛔ **F14 · VACÍO, Y ESO ES EL ENTREGABLE DE LA FASE.**
  //
  // Aquí vivían los dos últimos motivos de rama, y hasta el 2026-08-07 eran
  // verdad:
  //
  //   DIAGNOSTICO: «El diagnóstico contrasta parcelas; aún no sabe con un edificio.»
  //   INFORME:     «El informe firma un diagnóstico, y el diagnóstico es de parcela.»
  //
  // F14 es exactamente la fase que los vuelve falsos: trae
  // `diagnostico/edificio.js` —el contraste con la construcción registrada— y
  // `report/pdf-edificio.js` —el informe de construcción firmable—. Se retiran en
  // vez de dejarlos envejecer, por el mismo criterio con el que F12 retiró el de
  // EDICIÓN: un motivo que sobrevive a la limitación que explicaba no se enseña
  // nunca (el paso está disponible) pero convence al siguiente que lea este objeto
  // de que la limitación sigue.
  //
  // ⚠️ **La compuerta se queda, aunque hoy no la use ningún paso.** `CAUSA.RAMA` y
  // su rama en {@link evaluarPaso} siguen ahí: son el mecanismo con el que se
  // declara «esta versión no sabe hacer esto en esta rama», y el día que haga falta
  // otra vez tiene que estar. Lo que no puede quedarse es una FRASE falsa. Hay un
  // test que afirma que esta tabla está vacía **a propósito**, para que nadie la
  // lea como un olvido y la rellene por simetría.
})

/**
 * Qué DATO falta. Va indexado por el hecho que falta y **no por el paso**, a
 * propósito: la causa es la misma se mire desde donde se mire, y un texto por
 * paso serían tres frases que hay que mantener diciendo lo mismo.
 *
 * @readonly
 */
/**
 * ⭐ **Cómo se consigue el parcelario oficial. UNA frase, en UN sitio (2026-08-08).**
 *
 * ── POR QUÉ EXISTE ──
 * Cuatro sitios distintos de la aplicación le decían al usuario que le faltaba el
 * parcelario, y **los cuatro le mandaban a la trampa**: «tráelo desde Entrada»,
 * «tráela del Catastro y se enciende», «trae la parcela del Catastro y vuelve»,
 * «tráelo con la referencia catastral». Hasta el 2026-08-08 hacer eso **borraba su
 * medición** — el Catastro entraba en `recintos` y en `geometriaOficial` a la vez—,
 * así que la aplicación estaba empujando activamente hacia su peor defecto, con
 * cuatro redacciones distintas de la misma instrucción equivocada.
 *
 * Arreglado el defecto, la instrucción correcta es otra y hay que decirla en los
 * cuatro. Se escribe una vez: cuatro copias de una frase que hay que mantener
 * diciendo lo mismo son cuatro sitios donde volver a equivocarse, y ya pasó.
 *
 * ── QUÉ DICE, Y POR QUÉ ASÍ ──
 * Nombra **el botón**, que es lo que el usuario tiene que encontrar, y dice **lo que
 * NO pasa** —que su medición sigue—, que es exactamente el miedo que la frase
 * anterior confirmaba. No nombra la pantalla a propósito: dos de los cuatro sitios
 * la enseñan a unos píxeles del botón, y «ve a Validación» leído al lado del botón
 * es la clase de instrucción que enseña a desconfiar del texto.
 *
 * ⚠️ **Vive aquí, en `navegacion.js`, y no en el cableado del botón**, por lo mismo
 * que {@link MOTIVO_DATO}: este módulo no importa ningún `app/cableado-*.js`, así que
 * los cuatro pueden traérsela sin ciclo. Al revés no se podía.
 *
 * ⛔ **SU LONGITUD ES CARGA ESTRUCTURAL, no estilo.** Uno de los cuatro sitios es
 * {@link MOTIVO_DATO}`.oficial`, y ése se pinta en el RENGLÓN de la barra de
 * recorrido: **una línea de alto fija**, con un tope de 90 caracteres para el motivo
 * entero. Con 24 del enunciado de estado, esta frase no puede pasar de 66. Alargarla
 * pone rojo el guardián de los motivos — que es donde hay que enterarse, y no en la
 * pantalla del usuario con la frase recortada a media palabra.
 *
 * ⚠️ **Y el chip del peldaño ya no la enseña**: desde el 2026-08-10 ahí va la forma
 * BREVE ({@link MOTIVO_BREVE}), que tiene su propio tope de 22. Hasta entonces esto
 * decía «el chip del RAIL: 210 px medidos», y el rail vertical ya no existe.
 */
export const INSTRUCCION_PARCELARIO =
  'Tráelo con «Traer el parcelario de fondo»: tu medición sigue.'

export const MOTIVO_DATO = Object.freeze({
  geometria: 'Trae antes una parcela: por referencia catastral o desde tu medición.',
  // ⛔ Decía «tráelo desde Entrada», y ahí el único botón que había era el que
  // SUSTITUÍA la medición del usuario por la del Catastro: el rail empujaba a la
  // trampa. El enunciado es corto porque este motivo vive en el chip del rail; ver
  // el tope en {@link INSTRUCCION_PARCELARIO}.
  oficial: `Sin parcelario oficial. ${INSTRUCCION_PARCELARIO}`,
  // ⛔ Aquí había un `diagnostico: 'Haz antes el diagnóstico de encaje: el informe
  // firma su resultado.'` y se retiró el 2026-08-08 con el peldaño «Informe», que
  // era la única pantalla capaz de enseñarlo. Ver {@link CLAVES_HECHOS}.
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

/**
 * ⭐ **EL MISMO MOTIVO EN TRES PALABRAS (rebanada 1 del topbar, 2026-08-10).**
 *
 * ── POR QUÉ LO REDACTA ESTE MÓDULO Y NO EL QUE PINTA ───────────────────────
 * El rail giró de vertical a horizontal, y con el giro el motivo dejó de tener
 * 210 px de ancho por tres renglones —**40,5 px medidos**— para tener el hueco de
 * un peldaño en una barra. La salida fácil era que el aplicador recortara el
 * texto: eso produce «Trae antes una parcela: por refe…», que no es un motivo, es
 * un motivo roto.
 *
 * La regla de la casa es la de {@link MOTIVO_DATO} y no cambia: **quien decide
 * redacta, quien pinta no escribe ni una palabra** (`app/barra.js` no tiene un
 * solo literal en español para el usuario, y hay un test que lo afirma). Así que
 * la forma corta se escribe aquí, al lado de la larga, donde no puede divergir de
 * ella sin que se vea en el mismo diff.
 *
 * ── LAS DOS FORMAS NO SON LA MISMA FRASE, Y ESO ES EL PUNTO ────────────────
 * La breve dice **QUÉ falta**; la larga dice **CÓMO conseguirlo**. Se leen a la
 * vez y en sitios distintos: la breve pegada a cada peldaño bloqueado (todos a la
 * vez, que es lo que la revisión externa salvó al revocar la decisión D9 del
 * diseño: con la aplicación vacía se ve simultáneamente por qué no puedes editar y
 * por qué no puedes diagnosticar), y la larga en el renglón de debajo, para el
 * obstáculo más cercano.
 *
 * ⛔ **TOPE: 22 caracteres.** No es estética. Tres peldaños con su punto, su
 * rótulo y su breve tienen que caber en la barra junto a la marca, el grupo y —
 * desde las rebanadas 2 y 3— el expediente y la entrega. Hay un guardián que
 * mide esta tabla; si sale rojo, la frase no cabe, y enterarse ahí es enterarse
 * antes que el usuario.
 *
 * ⚠️ **Indexada por el HECHO, igual que {@link MOTIVO_DATO}**, y por lo mismo: la
 * causa es la misma se mire desde el paso que se mire.
 *
 * @readonly
 */
export const MOTIVO_BREVE = Object.freeze({
  geometria: 'Falta la parcela',
  oficial: 'Falta el parcelario',
})

/** Igual, cuando la rama es EDIFICIO. Ver {@link MOTIVO_DATO_EDIFICIO}. @readonly */
export const MOTIVO_BREVE_EDIFICIO = Object.freeze({
  geometria: 'Falta el edificio',
})

/**
 * Cuántos caracteres puede tener una forma breve. Ver el tope de
 * {@link MOTIVO_BREVE}: es sitio en una barra horizontal, no gusto.
 */
export const TOPE_MOTIVO_BREVE = 22

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
 * · `requiere`      — qué hechos hacen falta, **en el orden en que se nombran**:
 *                     si faltan dos, se dice el primero de la lista. Para el
 *                     diagnóstico eso significa «trae antes una parcela» antes
 *                     que «falta el parcelario», que es el orden en que el
 *                     usuario puede resolverlos.
 *                     ⭐ **Un elemento que sea ARRAY es una alternativa**: basta
 *                     con que se cumpla uno de los que nombra. Entró el
 *                     2026-08-19 con el hecho `puntos`, porque Edición se abre
 *                     con un recinto **o** con una nube de puntos importada, y
 *                     esas dos cosas no se pueden fundir en un booleano sin que
 *                     Diagnóstico herede el ensanche (ver {@link CLAVES_HECHOS}).
 *                     El motivo que se redacta es el del **primero nombrado**: es
 *                     el principal, y el orden de la lista ya era significativo.
 *
 * ⚠️ **Edición NO exige que la validación haya pasado**, y es deliberado: F02
 * puede devolver `puedeGenerar: false` con errores, y la forma de arreglarlos es
 * precisamente editar. Exigir una validación limpia para entrar en Edición
 * dejaría al usuario encerrado fuera de la única pantalla que resuelve su
 * problema. La maqueta de julio rotulaba «Necesita el recinto validado»; esa
 * frase no llegó al código a propósito.
 *
 * ── ⭐ LA PRUEBA DE QUE LA FUSIÓN DEL 2026-08-08 NO CAMBIA QUIÉN ENTRA ───────
 * Aquí había una línea más, y decía **exactamente esto**:
 *
 *     [PASO.VALIDACION]: { ramas: RAMAS, requiere: Object.freeze(['geometria']) },
 *
 * O sea: la misma `ramas` y el mismo `requiere` que `EDICION` de aquí abajo,
 * carácter por carácter. Dos peldaños con la misma compuerta y la misma
 * `<section>` de panel no eran dos estados de la aplicación, eran uno escrito
 * dos veces. Que la fusión salga gratis en materia de acceso no es una promesa
 * de esta nota: se ve en que esta tabla es la misma quitando esa línea.
 *
 * @readonly
 */
const REGLA = Object.freeze({
  [PASO.ENTRADA]: { ramas: RAMAS, requiere: Object.freeze([]) },
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
  // ⛔ **Y el 2026-08-07 pierde su `enComprobacion: false`**, que era el único
  // `false` de toda la tabla: era lo que apagaba Edición mientras hubiera un GML
  // ajeno delante. El porqué de la retirada está en la cabecera.
  //
  // ⭐ **Y el 2026-08-19 su `requiere` estrena la forma de ALTERNATIVA.** Un
  // levantamiento de campo son puntos sueltos y cero polilíneas: se importan sin
  // unir, no hay recinto todavía, y la pantalla que sirve para hacerlo —la que
  // tiene «Dibujar recinto» y el enganche a esos puntos— es justo ésta. Con
  // `['geometria']` a secas, la única herramienta que resuelve ese fichero quedaba
  // detrás de una puerta que solo abría el resultado de haberla usado.
  //
  // ⚠️ En la rama EDIFICIO la alternativa no cambia nada: allí `puntos` es
  // siempre `false`, así que la compuerta sigue siendo `geometria` a secas.
  [PASO.EDICION]: {
    ramas: RAMAS,
    requiere: Object.freeze([Object.freeze(['geometria', 'puntos'])]),
  },
  // ⭐ **F14 · DIAGNÓSTICO E INFORME PASAN A EXISTIR TAMBIÉN EN LA RAMA EDIFICIO**,
  // y con ellos `requiere` deja de ser una lista para poder ser un MAPA POR RAMA.
  //
  // No es una generalización preventiva: sin ella los dos peldaños quedarían
  // abiertos y **inalcanzables**, que es la trampa de F13 repetida.
  //
  //   · DIAGNÓSTICO en PARCELA exige el parcelario (`oficial`) porque sin él no hay
  //     nada que contrastar. En EDIFICIO **no**: el contraste es OPCIONAL y su caso
  //     estrella —la obra nueva, «no consta construcción registrada»— es
  //     precisamente aquel en el que NO hay huella oficial. Exigirla dejaría la
  //     pantalla honesta escrita, probada y sin forma de llegar a ella, que es
  //     literalmente lo que le pasó a `MOTIVO_SIN_EDIFICIO` en F13.
  //   · INFORME en PARCELA exigía el diagnóstico porque es lo que firma. En
  //     EDIFICIO **no**: la ficha §17 dice «*si no [hubo contraste], informe solo
  //     declarativo, sin sección de contraste*», así que el informe de construcción
  //     se sostiene con la construcción y nada más.
  //
  // ⭐ **Y ESE SEGUNDO PUNTO YA NO DESCRIBE NINGUNA LÍNEA DE ESTA TABLA**
  // (2026-08-08): retirado el peldaño «Informe», su regla se va con él. La
  // condición NO desaparece, cambia de naturaleza: **pasa de compuerta de rail a
  // hecho de la estructura**. «Preparar informe (PDF)» vive DENTRO del cajón de
  // diagnóstico, y ese cajón no existe hasta que se ha diagnosticado, así que no
  // hay forma de pedir un informe sin diagnóstico ni habiéndolo querido. Una
  // guarda que el marcado ya impone no hace falta declararla otra vez aquí: eso
  // son dos sitios que pueden divergir.
  [PASO.DIAGNOSTICO]: {
    ramas: RAMAS,
    requiere: Object.freeze({
      [RAMA.PARCELA]: Object.freeze(['geometria', 'oficial']),
      [RAMA.EDIFICIO]: Object.freeze(['geometria']),
    }),
  },
})

/**
 * Los hechos que un paso exige EN ESTA RAMA.
 *
 * `requiere` admite dos formas y la razón es que la mayoría de los pasos piden lo
 * mismo en las dos ramas, y escribirlo dos veces sería dos sitios que pueden
 * divergir sin que nada lo diga. Un array = «lo mismo en todas»; un objeto = «esto
 * en cada una». La tabla se sigue leyendo de un vistazo, que es para lo que existe.
 *
 * @param {{requiere: readonly string[]|Record<string, readonly string[]>}} regla
 * @param {string} rama
 * @returns {readonly string[]}
 */
function hechosQueExige(regla, rama) {
  const { requiere } = regla
  if (Array.isArray(requiere)) return requiere
  // Un paso con mapa por rama y una rama sin entrada NO exige nada, y es la
  // respuesta correcta: la compuerta de RAMA ya ha dejado pasar, así que el paso
  // existe ahí; si además nadie declaró qué dato necesita, no necesita ninguno.
  return requiere[rama] ?? EMPTY
}

/** Lista vacía compartida, para no crear una por consulta en el camino caliente. */
const EMPTY = Object.freeze([])

/**
 * ¿Está disponible este paso, y si no, por qué? La ÚNICA función que decide, y
 * pura: mismas entradas, misma respuesta, sin store y sin DOM. Todo lo demás de
 * este módulo la llama.
 *
 * ⭐ **Devuelve DOS redacciones del mismo motivo desde 2026-08-10**: `motivo` (cómo
 * se consigue) y `breve` (qué falta). Ver {@link MOTIVO_BREVE} para el porqué de
 * las dos y quién enseña cada una. `breve` **cae al largo** cuando no hay forma
 * corta escrita: así el aplicador tiene una sola regla —pinta `breve`— y un motivo
 * nuevo sin abreviar sale largo en la barra, que se ve, en vez de salir vacío, que
 * no se ve. Hoy el único caso posible es un motivo de {@link CAUSA.RAMA}, y esa
 * tabla está vacía a propósito.
 *
 * @param {string} paso
 * @param {{rama: string, hechos: object}} situacion
 * @returns {{disponible: boolean, causa: string|null, motivo: string|null, breve: string|null}}
 */
export function evaluarPaso(paso, { rama, hechos }) {
  const regla = REGLA[paso]
  if (regla === undefined) {
    throw new RangeError(
      `evaluarPaso: paso desconocido ${JSON.stringify(paso)}. Los únicos son ${PASOS.join(', ')}.`,
    )
  }
  // 1 · RAMA — lo que esta versión no sabe hacer. No se arregla trabajando.
  if (!regla.ramas.includes(rama)) {
    const motivo = MOTIVO_RAMA[paso] ?? null
    return { disponible: false, causa: CAUSA.RAMA, motivo, breve: motivo }
  }
  // 2 · DATO — lo único que se resuelve solo según se avanza.
  for (const exigencia of hechosQueExige(regla, rama)) {
    // Un array es una ALTERNATIVA («cualquiera de éstos»); un string, el hecho a
    // secas. Se normaliza a lista para tener UN solo camino y no dos ramas que
    // puedan divergir en qué motivo redactan.
    const alternativas = Array.isArray(exigencia) ? exigencia : [exigencia]
    if (!alternativas.some((h) => hechos[h] === true)) {
      // El PRIMERO nombrado es el principal, y es el que da las palabras: decirle
      // al usuario «falta la parcela» describe la vía normal, mientras que nombrar
      // la alternativa («o importa unos puntos sueltos») convertiría el caso raro
      // en la instrucción principal.
      const hecho = alternativas[0]
      // El de la rama manda cuando lo hay: ver {@link MOTIVO_DATO_EDIFICIO}.
      const enEdificio = rama === RAMA.EDIFICIO
      const propio = enEdificio ? MOTIVO_DATO_EDIFICIO[hecho] : undefined
      const propioBreve = enEdificio ? MOTIVO_BREVE_EDIFICIO[hecho] : undefined
      const motivo = propio ?? MOTIVO_DATO[hecho] ?? null
      return {
        disponible: false,
        causa: CAUSA.DATO,
        motivo,
        breve: propioBreve ?? MOTIVO_BREVE[hecho] ?? motivo,
      }
    }
  }
  return { disponible: true, causa: null, motivo: null, breve: null }
}

// ── La URL (decisión D3) ────────────────────────────────────────────────────

/**
 * El estado, escrito como hash. `{rama: 'PARCELA', paso: 'edicion'}` →
 * `#/parcela/edicion`. Los dos ejes caben enteros, que es lo que hace que
 * atrás/adelante y un enlace pegado se comporten igual.
 *
 * ⚠️ **Este traductor NO conoce {@link RUTA_RETIRADA}, y es correcto**: escribe
 * la URL de un estado que existe HOY, y los estados retirados ya no son un
 * estado. La traducción va en el otro sentido, en {@link leerRuta}, que es donde
 * llega lo que un usuario pudo guardar hace meses.
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
  const pedido = trozos[1].toLowerCase()
  if (!RAMAS.includes(rama)) return null
  // Un paso RETIRADO no es un hash ajeno: es una URL nuestra de antes. Se
  // traduce al peldaño que se quedó su contenido en vez de devolver `null`, que
  // habría mandado al usuario a la pantalla por omisión sin decirle nada. Ver
  // {@link RUTA_RETIRADA}.
  const paso = RUTA_RETIRADA[pedido] ?? pedido
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
 * vería DOS pasos apagados sin ninguna razón visible, con la suite en verde.
 * Es el mismo fallo mudo que la regla de `hidden` evita en el DOM, pero en los
 * datos. Una clave AUSENTE, en cambio, es `false` y no lanza: un hecho que no
 * afirmas es un hecho que no tienes.
 *
 * @param {object} parciales
 * @param {object} base
 * @param {string} quien
 * @returns {{geometria: boolean, oficial: boolean}}
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
 * @property {{geometria: boolean, oficial: boolean}} hechos
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
 *   es `false` esto NO es null**, y hay una prueba que recorre los tres pasos en
 *   todas las combinaciones para atestarlo: es el criterio «cero pasos apagados
 *   en silencio», y es la mitad del producto de este módulo.
 * @property {string|null} breve   Lo mismo en tres palabras, para el hueco de un
 *   peldaño en la barra horizontal. **Tampoco es null cuando `disponible` es
 *   `false`**, y la misma prueba lo recorre. Ver {@link MOTIVO_BREVE}.
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
  hechos = {},
  avisar = null,
} = {}) {
  const contarlo = resolverAvisar(avisar)
  exigirRama(rama, 'crearNavegacion')
  exigirPaso(paso, 'crearNavegacion')

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

  /** @param {string} r @param {string} p @returns {Situacion} */
  const situacionCon = (r, p) =>
    Object.freeze({ rama: r, paso: p, hechos: Object.freeze({ ...porRama[r] }) })

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
   * Entrada: si el usuario tiene la parcela cargada, cae en Edición, que es
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
   * @param {{rama: string, paso: string}} pretendida
   * @returns {Desenlace}
   */
  function asentar({ rama: r, paso: p }) {
    const tentativa = situacionCon(r, p)
    const veredicto = evaluarPaso(p, tentativa)
    if (veredicto.disponible) {
      publicar(tentativa)
      return { ok: true, paso: p, causa: null, motivo: null }
    }
    const destino = ultimoSostenible(tentativa)
    publicar(situacionCon(r, destino))
    const aviso = mensajeCaida(p, destino, veredicto.motivo ?? '')
    contarlo(aviso, { nivel: NIVEL.AVISO })
    return { ok: false, paso: destino, causa: veredicto.causa, motivo: aviso }
  }

  // El estado inicial se recorta EN SILENCIO (ver la cabecera de `crearNavegacion`):
  // publicar por el canal de avisos durante el montaje llenaría el panel antes de
  // que el usuario haya hecho nada.
  {
    const tentativa = situacionCon(rama, paso)
    const pisoFirme = evaluarPaso(paso, tentativa).disponible ? paso : ultimoSostenible(tentativa)
    publicar(situacionCon(rama, pisoFirme))
  }

  /**
   * @typedef {Object} Navegacion
   * @property {() => Situacion} get
   * @property {(fn: (s: Situacion) => void) => (() => void)} subscribe
   * @property {(paso: string) => Desenlace} navegarAPaso
   * @property {(rama: string) => Desenlace} cambiarRama
   * @property {(parciales: object, rama?: string) => Desenlace} actualizarHechos
   * @property {(rama: string) => object} hechosDe
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
      publicar(situacionCon(actual.rama, destino))
      return { ok: true, paso: destino, causa: null, motivo: null }
    },

    /**
     * Conmuta de rama. Los hechos de la rama de destino ya están guardados, así
     * que el paso se reevalúa **contra los suyos** y no contra los de la rama de
     * la que se viene; si no se sostiene, se cae y se cuenta.
     *
     * @param {string} destino
     * @returns {Desenlace}
     */
    cambiarRama(destino) {
      exigirRama(destino, 'cambiarRama')
      const actual = store.get()
      if (destino === actual.rama) return { ok: true, paso: actual.paso, causa: null, motivo: null }
      return asentar({ rama: destino, paso: actual.paso })
    },

    /**
     * Actualiza los hechos de una rama (la activa por omisión) y reevalúa. Es lo
     * que llama el aplicador cuando el store del documento cambia.
     *
     * ⛔ **Si NINGÚN hecho cambia, no se publica** (auditoría 2026-08-16, hallazgo
     * B4). Es el invariante que `app/barra.js` (decisión A1) y
     * `app/main.js#refrescarHechos` afirman por escrito —«solo notifica si el paso
     * activo deja de sostenerse»— y que este método llevaba rompiendo: llamaba
     * SIEMPRE a `asentar` → `publicar` → `store.set(objeto nuevo)`, y
     * `crearEstadoVista.set` notifica sin comparar. Medido: `refrescarHechos()`
     * producía **2 notificaciones completas** —una por rama— aunque no cambiara ni
     * un hecho, más el `barra.repintar()` explícito de aquella función: **3
     * pintadas enteras del rail por cada vértice arrastrado**, con sus tres pasadas
     * de `contraste.aplicar`, `pantalla.aplicar` y `escribirRuta`.
     *
     * ⚠️ **La comparación es superficial y basta**: {@link fundirHechos} devuelve
     * un registro plano con exactamente {@link CLAVES_HECHOS} booleanas, así que no
     * hay nada anidado que comparar. Y se compara lo FUNDIDO contra lo que había,
     * no `parciales` contra nada: `{}` y `{oficial: true}` sobre un `oficial` que
     * ya era `true` son los dos «no ha cambiado nada».
     *
     * ⚠️ Y **no publicar no es no guardar**: el registro fundido se escribe igual
     * (aunque sea idéntico), que es lo que sostiene el conmutador de rama. Lo único
     * que se ahorra es despertar a quien pinta.
     *
     * @param {object} parciales  Solo las claves que cambian.
     * @param {string} [rama]     A qué rama pertenecen; la activa por omisión.
     * @returns {Desenlace}
     */
    actualizarHechos(parciales, rama = store.get().rama) {
      exigirRama(rama, 'actualizarHechos')
      const antes = porRama[rama]
      const fundido = fundirHechos(parciales, antes, 'actualizarHechos')
      porRama[rama] = fundido
      const actual = store.get()
      if (CLAVES_HECHOS.every((clave) => fundido[clave] === antes[clave])) {
        // Nada que reevaluar: con los mismos hechos, la misma rama y el mismo paso,
        // el veredicto es por fuerza el que ya está publicado. Se devuelve el
        // desenlace de «no ha pasado nada», que es el mismo que devolvía `asentar`.
        return { ok: true, paso: actual.paso, causa: null, motivo: null }
      }
      return asentar({ rama: actual.rama, paso: actual.paso })
    },

    /**
     * Los hechos de una rama, **también de la que no está activa**. Es lo que
     * necesita T7 para avisar de qué rama se guarda y cuál se queda fuera del
     * fichero.
     *
     * @param {string} rama
     * @returns {{geometria: boolean, oficial: boolean}}
     */
    hechosDe(rama) {
      exigirRama(rama, 'hechosDe')
      return Object.freeze({ ...porRama[rama] })
    },

    /**
     * El rail entero, listo para pintar. **Los tres pasos, siempre**: uno que no
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
          breve: veredicto.breve,
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
      const tentativa = situacionCon(pedido.rama, pedido.paso)
      const veredicto = evaluarPaso(pedido.paso, tentativa)
      if (veredicto.disponible) {
        publicar(tentativa)
        return { ok: true, paso: pedido.paso, causa: null, motivo: null }
      }
      const destino = ultimoSostenible(tentativa)
      publicar(situacionCon(pedido.rama, destino))
      const aviso = mensajeAterrizaje(pedido.paso, destino)
      contarlo(aviso, { nivel: NIVEL.AVISO })
      return { ok: false, paso: destino, causa: veredicto.causa, motivo: aviso }
    },
  }
}
