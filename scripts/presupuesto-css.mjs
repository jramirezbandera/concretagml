#!/usr/bin/env node
// scripts/presupuesto-css.mjs — Rework de UI · T10. EL PRESUPUESTO DE LA HOJA.
//
// Mide lo que pesa la hoja de estilo CONSTRUIDA, la parte con el vendor
// descontado, y lo contrasta con el último asiento del registro de abajo.
//
// ═════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO ES UN SCRIPT Y NO UN PÁRRAFO EN UN MARKDOWN
// ═════════════════════════════════════════════════════════════════════════════
// El criterio 10 del rework dice: «`estilos/app.css` acaba pesando menos de
// 57.159 B al cerrar la quinta rebanada; durante la migración puede subir, pero
// **cada rebanada anota cuánto**». La premisa que lo justificaba decía que la
// hoja había crecido un 24 % en una fase «y nadie lo vio».
//
// Nadie lo vio porque no había NADA que mirar: ni un número publicado, ni un
// sitio donde anotarlo. Escribir ahora ese número a mano en un fichero de prosa
// reproduce el mismo modo de fallo con más letra: el día que alguien engorde la
// hoja no va a acordarse de venir a actualizar un markdown, exactamente como no
// se acordó de volver a por el rail durante ocho fases (`estilos/app.css:11-21`).
//
// Así que el registro y el medidor son la MISMA cosa: `ASIENTOS` es la lista, y
// el script sale ROJO si la hoja construida no coincide con el último asiento.
// La regla no es «no crezcas», que sería mentira durante una migración; es
// **«crece si hace falta, pero queda anotado»**. La única forma de poner el
// script en verde tras tocar CSS es añadir el asiento.
//
// Del `validar-xsd.mjs` se hereda la lección más cara del repositorio: **no
// poder medir es un FALLO (código 2), nunca un salto benigno.** Un guardián que
// se salta solo no es un guardián, es una intención — y ese error ya costó un
// fichero rechazado por la Sede con 1.784 pruebas en verde.
//
// ── QUÉ NÚMERO ES ÉSTE, Y CUÁL NO ───────────────────────────────────────────
// ⛔ NO es el tamaño de `estilos/app.css` en disco. Ése mide hoy ~182.000 B y
//    casi todo son COMENTARIOS: en este repositorio la hoja es también el
//    registro de diseño, y presupuestar el fichero fuente castigaría escribir
//    el porqué de cada regla, que es justo lo contrario de lo que se quiere.
//    El minificador se los come enteros; lo que sobrevive son REGLAS, que es lo
//    que el criterio 10 quiere vigilar («si de verdad se quitaron los apaños de
//    la pelea por píxeles o solo se taparon»).
//
// ✅ Es `dist/assets/index-*.css`: la hoja que se descarga. Contiene, en este
//    orden, `estilos/app.css` con sus cinco `@import` de tokens ya fundidos, y
//    detrás `leaflet/dist/leaflet.css`, que importa `app/main.js`.
//
// ⛔ **Y ahí está la corrección que T10 trae y que hay que leer antes de citar
//    el techo**: de los 57.159 B de la línea base, **15.095 son de Leaflet**.
//    Medido en las DOCE builds históricas del barrido: 15.095 B clavados en las
//    doce, porque `leaflet@^1.9.4` no se ha movido desde F05. O sea que el techo
//    del criterio 10, dicho en bytes que este proyecto escribe, es
//    **42.064 B**, no 57.159. Por eso se publican los dos.
//
// ── USO ─────────────────────────────────────────────────────────────────────
//     npm run build && npm run presupuesto
//
// Códigos de salida:  0 = dentro de lo anotado · 1 = la hoja se movió sin
// anotarse (o revienta el techo) · 2 = no se ha podido medir.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * El primer selector propio de `leaflet.css`, y por tanto la costura entre lo
 * nuestro y el vendor en la hoja construida.
 *
 * No vale buscar `.leaflet-` a secas: `estilos/app.css` tiene una docena de
 * reglas que pisan cromo de Leaflet (`.gml-app .gml-mapa .leaflet-bar`…) y la
 * primera aparecería mucho antes. `.leaflet-pane,` con la coma es la lista de
 * selectores con la que ARRANCA `leaflet.css` («required styles») y no la
 * escribe nadie más.
 */
export const MARCA_VENDOR = '.leaflet-pane,'

/** El espacio de nombres de todo lo que escribe este proyecto. */
export const MARCA_NUESTRA = '.gml-'

/**
 * Las CINCO rebanadas del rework de UI, en su orden. El techo del criterio 10
 * solo se exige cuando las cinco están anotadas.
 *
 * ── ⭐ ESTO ES HISTORIA CONGELADA, NO EL RAIL DE HOY (2026-08-08) ────────────
 * Hasta hoy esta lista y `app/navegacion.js#PASOS` eran idénticas, y una prueba
 * lo exigía. Coincidían porque **el rework se organizó por pantallas**, no porque
 * fueran la misma cosa: `REBANADAS` es el troceado de un proyecto de migración
 * que terminó, y `PASOS` es el recorrido vivo de la aplicación.
 *
 * El día que el rail bajó a tres peldaños —«Validación» se fusionó con Edición e
 * «Informe» dejó de ser un paso— la prueba de no-divergencia forzaba a reescribir
 * esta lista, y eso tenía **dos consecuencias, las dos malas**:
 *
 *   1. **Falseaba el registro.** Las rebanadas 1 a 4 se cerraron de verdad, en su
 *      día, con su commit y su medición. Reescribir la lista para que cuadre con
 *      el rail de hoy convierte un registro de lo que se hizo en un reflejo de lo
 *      que hay, que es justo lo que este fichero existe para no ser.
 *   2. **Resolvía por accidente una deuda declarada.** La quinta rebanada
 *      —«informe»— **estaba sin cerrar A PROPÓSITO** desde `3e9c8b0`: su producto
 *      está hecho, y no se declaraba cerrada porque hacerlo hace exigible el techo
 *      del criterio 10 y la hoja no llegaba. Con la lista recortada a tres, las
 *      tres quedaban cerradas y el techo empezaba a morder **por un cambio de
 *      navegación**, no porque nadie hubiera decidido nada sobre bytes. Medido
 *      ese día: 55.018 B nuestros contra 42.064 B exigidos, 12.954 B de más.
 *
 *      ⭐ **CERRADA EL 2026-08-11, y por la vía que faltaba: DECIDIENDO.** El autor
 *      resolvió la elección que `3e9c8b0` le reservó —bajar la hoja o revisar el
 *      techo— y eligió revisar el techo, con la poda del sistema de diseño hecha
 *      primero y medida. Ver {@link TECHO}, que cuenta el razonamiento entero, y el
 *      asiento «El sistema de diseño deja de ser el de otra app». Lo que este punto
 *      2 defendía era que la quinta no se cerrara **de rebote**; se ha cerrado de
 *      frente, así que el argumento queda satisfecho y no revocado.
 *
 * Así que las dos listas se separan y **la deuda se queda donde estaba, visible**.
 * Lo que se pierde es el guardián de no-divergencia; lo que lo sustituye es la
 * prueba de que cada `rebanada` de un asiento es una de éstas, que es la parte de
 * aquel guardián que seguía teniendo sentido (cazar una errata).
 *
 * ⚠️ Esta lista está a mano A PROPÓSITO y NO importa `app/navegacion.js`: un
 * script de tooling que importa código de la app se lleva por delante media
 * aplicación (`navegacion.js` cuelga de `viewer/_comun.js`). Hoy además **no
 * podría** importarlo aunque quisiera: dos de estos cinco nombres ya no existen
 * allí, y ésa es exactamente la razón por la que son cosas distintas.
 */
export const REBANADAS = Object.freeze(['entrada', 'validacion', 'edicion', 'diagnostico', 'informe'])

/**
 * El techo del criterio 10, en las dos unidades, para que nadie tenga que
 * hacer la resta de cabeza ni se le olvide que hay vendor dentro.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⭐ **REBASADO EL 2026-08-11, Y LA DECISIÓN LLEVABA OCHO DÍAS ESPERANDO**
 * ═════════════════════════════════════════════════════════════════════════════
 * Hasta hoy estos dos números eran **la medición de `960bb7a` (F11)**: 57.159 B
 * / 42.064 nuestros. Eran la línea base del rework de UI, y el criterio 10 pedía
 * literalmente «acabar pesando menos de» ella — o sea, acabar por debajo de donde
 * se empezó. Con esa forma, el techo era el presupuesto de UNA MIGRACIÓN: mover
 * pantallas de sitio no debería dejar la hoja más gorda que antes de moverlas.
 *
 * ⛔ **Y dejó de medir eso.** El asiento «Rework rebanada 5» (`3e9c8b0`) declaró
 * la quinta rebanada SIN CERRAR a propósito, precisamente para no hacer exigible un
 * techo al que la hoja no llegaba, y dejó la elección escrita —«bajar la hoja o
 * revisar el techo»— reservada al autor. Eso fue el **2026-08-03**. Entre aquel día
 * y hoy, contra los 42.064 B de una migración se han medido: F12 (edificio: partes
 * y plantas), F13, F14, F17 fase 4, F18, F19, F20, F21, F22, F23, los avisos a un
 * diálogo, las dos puertas del Catastro, el vértice sincronizado, y el topbar
 * entero en cuatro rebanadas. **Once features y una cáscara nueva.** El número
 * seguía ahí, pero ya no era el presupuesto de una migración: era el tamaño que
 * tenía otra aplicación, la de F11, usado para juzgar a ésta.
 *
 * ── QUÉ SE MIDIÓ ANTES DE DECIDIR (2026-08-11) ──────────────────────────────
 * Se comprobó primero si el hueco se cerraba limpiando, porque si se cerraba no
 * había nada que decidir. **No se cierra.** La hoja iba 20.394 B por encima; la
 * poda ENTERA del sistema de diseño —71 variables sin un solo llamante en cinco
 * ficheros de tokens, la regla muerta `.canvas-dot-grid` y el bloque del tema
 * oscuro completo— devolvió **4.552 B medidos**, el 22 % del hueco. Los 15.842 B
 * restantes son producto vivo, y eso ya estaba medido en `3e9c8b0` con otro método
 * (0 clases y 0 pares `data-*` huérfanos sobre 178 y 22; ninguna regla pasa de
 * 527 B). O sea: el techo de F11 **solo se cumplía quitando pantallas**.
 *
 * ── LO QUE ESTOS DOS NÚMEROS SON AHORA ──────────────────────────────────────
 * La hoja medida HOY, con la poda ya dentro, y nada más. No es un objetivo al que
 * llegar: es **la línea de la que no se sube sin decidirlo**. Sale del asiento
 * «El sistema de diseño deja de ser el de otra app», que es una build de verdad y
 * cualquiera puede reconstruir.
 *
 * ⚠️ **Y CON ESO EL TECHO CAMBIA DE FORMA, NO SOLO DE VALOR.** El de F11 era «menos
 * de», porque era una meta por debajo. Éste es **«no más de»**, porque es el sitio
 * donde estamos: exigir «menos de» la propia medición dejaría la hoja en falta el
 * mismo segundo de rebasarla, que no significa nada. La consecuencia práctica es la
 * que se buscaba y hay que decirla clara: **a partir de hoy, con las cinco
 * rebanadas cerradas, cualquier asiento que suba la cifra pone este script ROJO.**
 * Subir el techo sigue siendo posible —esto es un presupuesto, no una prohibición—
 * pero pasa a ser una línea que alguien escribe a mano con su motivo al lado, y no
 * un byte que se cuela mientras nadie mira. Que era, palabra por palabra, el modo
 * de fallo que este fichero existe para cerrar.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⭐ **SUBIDO A MANO EL 2026-08-11 (F15), Y ES EL PRIMER USO DEL MECANISMO**
 * ═════════════════════════════════════════════════════════════════════════════
 * De 57.906 a **60.213 B nuestros** (73.001 → 75.308 con vendor). **+2.307 B**, y
 * los pone enteros el diccionario de errores de la Sede: la hoja sin él vuelve a
 * medir 57.906 B **clavados**, comprobado construyendo las dos versiones el mismo
 * día. O sea que el asiento anterior era exacto y este delta no arrastra nada.
 *
 * ── POR QUÉ VALE LA PENA, QUE ES LO QUE ESTA LÍNEA OBLIGA A ESCRIBIR ────────
 * F15 no es un bloque más dentro de una pantalla que ya existe: es una PANTALLA
 * NUEVA cuyo interior no tiene precedente en esta aplicación —una lista buscable
 * de 23 fichas plegables, cada una con dos insignias, y un tinte que separa lo
 * MEDIDO contra la Sede de lo que solo dice un foro—. Los diálogos anteriores se
 * colgaron del interior del de capas y pagaron entre 0 y 70 B (F21); aquí la
 * cáscara se reutiliza igual —caja, velo, cuerpo, título, intro y pie entran en
 * las listas de selectores que ya existían, sin una declaración nueva— y lo que
 * se paga es exclusivamente el componente que nadie tenía.
 *
 * ── LO QUE SE DEVOLVIÓ ANTES DE PEDIR LA SUBIDA ─────────────────────────────
 * La primera medición fue **+2.884 B**. Se devolvieron **577** fundiendo cinco
 * reglas que eran la misma escrita varias veces, y ⛔ **dos de ellas ya estaban
 * duplicadas antes de F15**: `.gml-dialogo-importacion-bloqueo` (F18) y
 * `.gml-dialogo-pegado-motivo` (F19) tenían las mismas ocho declaraciones byte a
 * byte. La prueba de que las descripciones repetidas divergen está en esa misma
 * pareja: las dos arrastraban `var(--color-aviso, …)` —un token que NO EXISTE— y
 * **se arreglaron el mismo día, cuando por fin alguien las miró juntas**.
 *
 * ── LA FORMA NO CAMBIA ──────────────────────────────────────────────────────
 * Sigue siendo «no más de», y sigue con **holgura 0**: la siguiente subida vuelve
 * a salir roja y vuelve a tener que decidirse a mano. Eso es lo que se buscaba —
 * el techo no es una prohibición, es el sitio donde estamos.
 */
export const TECHO = Object.freeze({ total: 75308, nuestro: 60213 })

/**
 * EL REGISTRO. Un asiento por hito, con la hoja construida medida de verdad.
 *
 * Los doce primeros NO se copiaron de ningún sitio: se midieron el 2026-08-04
 * reconstruyendo el artefacto en cada commit (se sustituye `estilos/`, se corre
 * `npm run build`, se lee `dist/assets/*.css`). Por eso hay `commit`: cualquiera
 * puede repetir el barrido y obtener los mismos números.
 *
 * `rebanada` = qué pantalla del rail cerró ese hito, o `null` si el hito no
 * cerró ninguna. Es lo que decide cuándo empieza a exigirse el techo.
 *
 * ── CÓMO SE AÑADE UN ASIENTO ────────────────────────────────────────────────
 *   1. `npm run build`
 *   2. `npm run presupuesto` → sale ROJO y te dice el par (total, nuestro)
 *   3. copias ese par aquí abajo con su hito, su commit y **una nota de una
 *      línea diciendo QUÉ subió o bajó**. La nota es la mitad del valor: un
 *      número sin causa no se puede revisar después.
 */
export const ASIENTOS = Object.freeze(
  [
    { hito: 'F03', commit: '5d68f14', total: 31779, nuestro: 16684, rebanada: null,
      nota: 'La cáscara nace: un panel de altura fija y el mapa.' },
    { hito: 'F04', commit: 'a1c1138', total: 32743, nuestro: 17648, rebanada: null,
      nota: 'Generación del GML: +964 B, el hito más barato de los doce.' },
    { hito: 'F05', commit: 'ba00138', total: 34938, nuestro: 19843, rebanada: null,
      nota: 'Catastro en vivo: la barra de búsqueda y sus estados.' },
    { hito: 'F06', commit: '3dd7f99', total: 42221, nuestro: 27126, rebanada: null,
      nota: '⭐ EL SALTO GORDO: +7.283 B, +36,7 % de lo nuestro en UNA fase. La barra flotante de edición.' },
    { hito: 'F07', commit: 'a0e2a9d', total: 43641, nuestro: 28546, rebanada: null,
      nota: 'Diagnóstico de encaje: el cajón sobre el mapa, no un bloque en el panel.' },
    { hito: 'F08', commit: '3ea5d49', total: 45905, nuestro: 30810, rebanada: null,
      nota: 'Comprobar un GML: segundo cajón sobre el mapa y la zona de soltar ficheros.' },
    { hito: 'F09', commit: '21366ac', total: 49244, nuestro: 34149, rebanada: null,
      nota: 'Informe firmable: el diálogo de la firma y su formulario.' },
    { hito: 'F10', commit: 'c2df2c7', total: 52801, nuestro: 37706, rebanada: null,
      nota: 'Persistencia: el diálogo de expedientes y la fila del rótulo.' },
    { hito: 'F11', commit: '960bb7a', total: 57159, nuestro: 42064, rebanada: null,
      nota: '⭐ LÍNEA BASE DEL REWORK. Segunda rama: el panel de edificio y sus dos cajas encogibles.' },
    { hito: 'Rework T1-T4', commit: 'cdaae52', total: 57159, nuestro: 42064, rebanada: null,
      nota: '⭐ CERO BYTES. La autoridad de navegación y sus tres guardianes son JS puro.' },
    { hito: 'Rework T5-T6', commit: 'c2e0544', total: 61108, nuestro: 46013, rebanada: 'entrada',
      nota: 'Cáscara de tres columnas (+2.370) y pantalla de Entrada (+1.579). La primera rebanada.' },
    { hito: 'Rework T7-T8', commit: '848934f', total: 61108, nuestro: 46013, rebanada: null,
      nota: 'Avisos de rama y comentarios: cero CSS, y los artefactos salieron idénticos byte a byte.' },
    { hito: 'Rework T9-T10', commit: 'af508f7', total: 61108, nuestro: 46013, rebanada: null,
      nota: 'Pantalla de contraste: el cajón se viste con estilos en línea, así que no toca la hoja.' },
    { hito: 'Rework rebanada 2', commit: 'c176c3f', total: 61108, nuestro: 46013, rebanada: 'validacion',
      nota: '⭐ CERO BYTES: repartir el pie por pantallas es MARCADO (data-pantalla), y las cinco reglas del CSS ya estaban escritas desde T6.' },
    { hito: 'Rework rebanada 3', commit: 'd0b7229', total: 61108, nuestro: 46013, rebanada: 'edicion',
      nota: '⭐ CERO BYTES otra vez: la barra declara su pantalla desde JS y el interruptor de los cuatro gestos es lógica, no estilo.' },
    { hito: 'Rework rebanada 4', commit: '44b02ad', total: 61108, nuestro: 46013, rebanada: 'diagnostico',
      nota: '⭐ CERO BYTES por TERCERA vez seguida, y aquí es un hecho sobre dónde vive el cromo del cajón: viewer/cajon-diagnostico.js se viste con estilos EN LÍNEA porque no importa ninguna hoja (para ser legible en jsdom y en un mapa pelado), así que anclarle el pie y subirle el tope de alto no toca app.css. Lo demás —que no se descarte y que el ✕ salga— es lógica.' },
    { hito: 'Rework rebanada 5', commit: '3e9c8b0', total: 61587, nuestro: 46492, rebanada: null,
      nota:
        '⚠️ EL PRODUCTO DE LA QUINTA ESTÁ HECHO Y AQUÍ NO SE DECLARA CERRADA, A PROPÓSITO. Cerrarla ' +
        'hace exigible el techo del criterio 10 (42.064 B nuestros) y hoy sobran 4.428. Se midió si ' +
        'había de dónde sacarlos y NO lo hay: 0 clases y 0 pares data-* huérfanos sobre 178 y 22, y ' +
        'el reparto son 286 reglas de las que ninguna pasa de 527 B una vez fuera los tokens (3.906) ' +
        'y el tema oscuro (1.931). O sea: el techo solo se cumple quitando producto vivo. La decisión ' +
        '—bajar la hoja o revisar el techo— es del autor, y hasta que la tome el registro dice la ' +
        'verdad: hoja movida +479 B (el informe a página completa y su bloque anclado), rebanada ' +
        'anotada, quinta SIN cerrar.' },
    { hito: 'Diagnóstico en la columna', commit: '4d73c6d', total: 61830, nuestro: 46735, rebanada: null,
      nota:
        '+243 B, y es lo que cuesta sacar el diagnóstico de encima del mapa: la sección anfitriona ' +
        'del panel (`.gml-bloque--contraste`, el estirador de esa pantalla), tres propiedades que ' +
        'le quitan al cajón el cromo de ventana flotante cuando vive dentro, y la regla que colapsa ' +
        'el bloque de avisos VACÍO en Diagnóstico. El cajón sigue vistiéndose EN LÍNEA para sus dos ' +
        'sitios (`ESTILO_SOBRE_EL_MAPA` / `ESTILO_EN_EL_PANEL`), así que el traslado en sí no toca ' +
        'esta hoja: los 243 B son solo el hueco que lo recibe. Sobran 4.671 sobre el techo, 243 más ' +
        'que en el asiento anterior y por la misma causa de fondo, que sigue sin resolverse.' },
    { hito: 'Barra de edición: palabras y centrada abajo', commit: 'bfcc63a', total: 62309, nuestro: 47214, rebanada: null,
      nota:
        '+479 B, y NO son producto nuevo: es el rediseño que el autor pidió al ver la barra ' +
        '(«no me gustan los iconos y no me gusta que esté debajo de los botones +− del zoom»). ' +
        'Reparto medido: la quinta esquina de Leaflet y su maquetación —centrado, hueco de la ' +
        'atribución y el `order` que abre los desplegables hacia ARRIBA para que la fila no se ' +
        'mueva al pulsarla— unos 300 B; el filete `role="separator"` entre grupos ~90; y el resto, ' +
        'vestir las herramientas como texto (familia, tamaño, grosor, `nowrap`) en vez de como ' +
        'iconos. Se DEVUELVEN dos reglas: la que encogía el icono del botón partido a 14 px (ese ' +
        'tamaño lo fija ahora el módulo, que solo emite un icono) y el `min-width` cuadrado de las ' +
        'herramientas, que con palabra dentro sobra. Sobran 5.150 sobre el techo.' },
    { hito: 'F17 · fase 4 · la pantalla del sobrante', commit: '28179ec', total: 62309, nuestro: 47214, rebanada: null,
      nota:
        '⭐ CERO BYTES, y aquí NO era lo esperado: F17 mete un bloque NUEVO en la columna de ' +
        'Validación —la lista del sobrante, con sus filas, su casilla por pieza, su campo de ' +
        'nombre, su contador y su botón—, que es producto de verdad y no un traslado. Sale a ' +
        'cero por dos decisiones tomadas al escribirlo: (1) la sección anfitriona de index.html ' +
        'NO lleva clase modificadora, porque `.gml-bloque` ya da columna flex, `min-height:0` y ' +
        'el relleno 16/24/0, y el bloque no se estira —el estirador de Validación sigue siendo ' +
        '`.gml-bloque--vertices`, y dos estiradores descosen el reparto—; y (2) el cromo de ' +
        'dentro se lo pone `viewer/lista-sobrante.js` EN LÍNEA, como el cajón del diagnóstico, ' +
        'porque `viewer/*` no importa ninguna hoja y tiene que ser legible en jsdom y sobre un ' +
        'mapa pelado. Lo que sí se reutiliza son CLASES que ya existen (`gml-rotulo`, ' +
        '`gml-rotulo-fila`, `gml-boton`, `gml-accion-estado`, `gml-entrada`, `gml-mono`), así ' +
        'que el bloque hereda el sistema de diseño sin declarar ni un color ni un espaciado ' +
        'propios. El asiento se anota aunque el número no se mueva: un hito sin fila haría que ' +
        'el registro dejara de contar la historia, que es la mitad de para lo que existe. ' +
        'Sobran 5.150 sobre el techo, los mismos que en el asiento anterior.' },
    { hito: 'F18 y F19, sin asiento propio', commit: '3a6717c', total: 65828, nuestro: 50733, rebanada: null,
      nota:
        '⚠️ **ASIENTO DE ATRIBUCIÓN, no de una fase.** Entre el asiento anterior y éste entraron ' +
        'F18 (entrada de parcela por fichero) y F19 (pegado de LIST, grados y rótulo del GML ' +
        'ajeno) **sin anotar ninguno de los dos**, y sus +3.519 B llegaron juntos a la fase 5 de ' +
        'F12 confundidos con los suyos. Se separan aquí, midiendo la hoja en el commit 3a6717c ' +
        'con `estilos/app.css` de HEAD y sin nada de F12: 65.828 B / 50.733 B nuestros. El ' +
        'reparto entre F18 y F19 NO se deshace —haría falta reconstruir en e469541, y las dos ' +
        'son de otra sesión—, así que la fila las nombra a las dos y no atribuye la cifra a ' +
        'ninguna. Lo que sí queda claro es qué NO es de F12. Sobran 8.669 sobre el techo.' },
    { hito: 'F12 · fase 5 · edificio: partes y plantas', commit: 'cc6ac46', total: 67334, nuestro: 52239, rebanada: null,
      nota:
        '**+1.506 B, medidos aparte** (ver el asiento anterior): se construyó la hoja con y sin ' +
        'los cambios de F12 para no cargarle los 3.519 B que venían sin atribuir. Y es la ' +
        'primera vez en seis fases que esta rama cuesta CSS, porque es la primera que le da ' +
        'pantalla propia. El reparto: la sección K.4 entera —el bloque de la parte activa (sus ' +
        'dos contadores de plantas en rejilla, el renglón de ayuda, la superficie en vivo y su ' +
        'estado), la fila de parte SELECCIONABLE (un `<button>` al que hay que devolverle el ' +
        'aspecto de texto, más el resalte de la activa) y el renglón plegado del selector de ' +
        'modelo—, más el relevo del estirador en «Edición». Dos reglas son de UNA LÍNEA y valen ' +
        'más que su tamaño: `.gml-barra-herramienta[hidden] { display: none }`, que arregla un ' +
        '`hidden` que NO funcionaba (la regla de la herramienta le ganaba a la hoja del ' +
        'navegador y «Dibujar recinto» se veía en la rama Parcela desde la fase 3), y el ' +
        '`min-height: 77px` de la lista de partes, que impide que el flex la apriete a dos filas ' +
        'de catorce. Las dos las encontró el guion 19 en un navegador real; en jsdom no hay ' +
        'cascada que resolver ni altura que repartir. Sobran 10.175 sobre el techo.' },
    { hito: 'F13 · edificio: validación y generación de GML', commit: '1a97b60', total: 67334, nuestro: 52239, rebanada: null,
      nota:
        '**CERO BYTES, y la hoja sale byte a byte idéntica al asiento anterior.** F13 no escribe ' +
        'ni una regla: enciende un botón que ya existía —con sus clases, su renglón `role=status` ' +
        'y su modificador de error—, y su capa nueva (`validation/edificio.js`, ' +
        '`gml/serialize-bu.js`) no toca el DOM. Lo único que se movió en pantalla fue RETIRAR dos ' +
        'mensajes, que es al revés que gastar. ⚠️ **Y el 0 no es solo de F13**: entre el asiento ' +
        'anterior y éste entró también F20 (el listado de coordenadas en hoja de cálculo, ' +
        'c8295ed) SIN asiento propio, y como el total no se ha movido ni un byte, lo que queda ' +
        'medido es que **ninguna de las dos escribió CSS** — no hay reparto que hacer porque no ' +
        'hay nada que repartir. El asiento se anota igual, por lo mismo que el de F17 fase 4: un ' +
        'hito sin fila deja de contar la historia, y aquí la historia es que la fase con más ' +
        'código nuevo desde F09 costó 0 px de hoja. Sobran 10.175 sobre el techo, los mismos.' },
    // ⚠️ `rebanada: null`, y NO `'informe'`. Se puso `'informe'` al escribir este
    // asiento y el guardián se puso rojo con razón: cerrar la quinta hace exigible
    // el techo del criterio 10, y **esa decisión no es de esta fase**. El asiento
    // «Rework rebanada 5» la dejó abierta a propósito, con la medición hecha («el
    // techo solo se cumple quitando producto vivo») y la elección —bajar la hoja o
    // revisar el techo— reservada al autor. F14 añade producto a esa pantalla; no
    // la cierra ni resuelve aquello.
    { hito: 'F14 · edificio: contraste e informe', commit: 'dccc6aa', total: 67595, nuestro: 52500, rebanada: null,
      nota:
        '**+261 B, y el plan los daba por CERO.** La idea era que el cajón de contraste de ' +
        'edificio reutilizara la clase del de parcela y no costara ni un byte. Se descartó al ' +
        'medir el riesgo: `gml-cajon-diagnostico` la resuelven CINCO guiones de humo (09, 10, 11, ' +
        '14 y 15) con `document.querySelector`, que se queda con el PRIMERO del documento — y los ' +
        'dos cajones se montan a la vez y se turnan por rama. Es la trampa M8 de F07, ya pagada ' +
        'dos veces; estos 261 B son el precio de no pagarla una tercera. El reparto: la clase ' +
        'propia `.gml-cajon-contraste-edificio` entra en las DOS únicas reglas del cajón que van ' +
        'acotadas al contenedor (el cromo de ventana y la familia de los botones); la sección ' +
        'anfitriona `.gml-bloque--contraste-edificio` comparte regla con su gemela de parcela; y ' +
        'entra `.gml-cajon-registro`, el renglón de la pantalla honesta, con la familia y los ' +
        '46ch de `.gml-cajon-margen`. **Las clases de los HIJOS cuestan CERO**: sus reglas son ' +
        '`.gml-app .gml-cajon-titular`, `…-cifra`, `…-seccion dt`, `…-invasion` — sin contenedor ' +
        'delante—, así que alcanzan a los dos cajones sin tocarlas. Sobran 10.436 sobre el techo.' },
    { hito: 'F21 · edificio: la piscina en su tipo y la precisión declarable', commit: '2706cef',
      total: 67665, nuestro: 52570, rebanada: null,
      nota:
        '**+70 B, y son el asiento más barato que ha tenido una pantalla nueva en este proyecto.** ' +
        'F21 estrena un `<dialog>` entero —«Especificaciones del trabajo profesional», con su ' +
        'título, su intro, su campo, su pie de dos botones y su renglón `role=status`— y paga ' +
        'SOLO por el contenedor: `.gml-dialogo-trabajo` entra en las dos reglas que van acotadas ' +
        'al `<dialog>` (la caja `fixed` centrada y su `::backdrop`) y en ninguna más. El interior ' +
        'reutiliza `gml-dialogo-capas-cuerpo`, `…-titulo`, `…-intro`, `…-pie` y `…-estado` tal ' +
        'cual, y el campo reutiliza `gml-campo` + `gml-entrada` + `gml-mono`: **ni una ' +
        'declaración nueva**. Es el mismo reparto que F14 hizo con el cajón de contraste, y la ' +
        'clase propia existe por el mismo motivo medido —los guiones de humo resuelven los ' +
        '`<dialog>` con `document.querySelector`, que se queda con el PRIMERO—, no para vestirlo ' +
        'distinto. ⚠️ La mitad de la fase que arregla la piscina cuesta **0 B**: es lógica de ' +
        '`edificio/entrada.js` y no toca el DOM. Sobran 10.506 sobre el techo.' },
    { hito: 'Los avisos salen del panel a un diálogo', commit: '5aa0ac0',
      total: 69122, nuestro: 54027, rebanada: null,
      nota:
        '**+1.457 B, y es el primer asiento de este proyecto que compra SITIO EN PANTALLA con ' +
        'bytes de hoja.** Los diez anteriores compraban producto; éste retira producto de la ' +
        'columna: la lista de avisos deja de vivir en `.gml-bloque--avisos` —que cedía hasta 34vh ' +
        'del panel, el sitio que se reparten la tabla de vértices y el pie de «Generar GML»— y se ' +
        'muda a un `<dialog>`. **Lo que se compra no se mide en bytes**: se mide en los 34vh que ' +
        'la columna recupera y en los ~60 px que el bloque gastaba en poner «Sin avisos.» el 95 % ' +
        'del tiempo. ── EL REPARTO ── El contenedor sigue el molde de F14 y F21 y cuesta lo ' +
        'mismo que ellos: `.gml-dialogo-avisos` entra en las dos reglas acotadas al `<dialog>` ' +
        '(caja `fixed` y `::backdrop`) más `-cuerpo`, `-titulo` y `-pie`, que ya existían. Las ' +
        'tarjetas de dentro (`.gml-aviso` y sus cinco hijos) valen **0 B**: no se ha tocado ni ' +
        'una. Lo que SÍ cuesta y no estaba previsto son **las tres piezas que la mudanza obliga ' +
        'a inventar**: (1) el reseteo de `.gml-chip`, porque pasa de `<span>` a `<button>` y hay ' +
        'que deshacerle al navegador la tipografía, el fondo y el borde; (2) el destello del ' +
        'chip —`@keyframes` + la clase + su rama de `prefers-reduced-motion`—, que es lo ÚNICO ' +
        'que sustituye a la tarjeta roja de 52 px que antes aparecía sola en la columna; y (3) ' +
        'las tres pestañas de filtro (`.gml-filtro-avisos`, con su `:hover` y su `--puesto`), ' +
        'que no reutilizan `.gml-boton` a propósito: son alternancias de 12 px y heredar el ' +
        'botón de la casa habría costado más deshacerlo que escribirlo. ── LO QUE SE DEVUELVE ── ' +
        'Se BORRAN tres reglas: `.gml-bloque--avisos { flex }`, su `min-height` y el apaño ' +
        '`[data-paso=diagnostico] …:has(.gml-avisos-vacio)`. Ese apaño existía solo porque el ' +
        'bloque competía con el contraste en aquella pantalla; sin bloque, no hay competencia. ' +
        'Los 1.457 B son ya el NETO de esos tres borrados. Sobran 11.963 sobre el techo.' },
    { hito: 'El vértice seleccionado se ve en el mapa y en la tabla', commit: '5aa0ac0',
      total: 69401, nuestro: 54306, rebanada: null,
      nota:
        '**+279 B por DOS reglas, y es el asiento más barato del proyecto que añade una ' +
        'interacción entera.** Pinchar un vértice lo señala en la tabla, y pinchar la fila lo ' +
        'señala en el mapa. ── POR QUÉ CUESTA TAN POCO ── La mitad de la feature **no pasa por ' +
        'esta hoja**: el cuadradito grande con anillo oscuro del vértice seleccionado es otro ' +
        '`L.divIcon` con estilos EN LÍNEA, porque `viewer/sincronizacion.js` es librería y no ' +
        'puede importar CSS (la misma razón que ya tenía el vértice normal desde F03). Lo que se ' +
        'paga aquí es solo la fila: un fondo ámbar diluido con `color-mix` sobre ' +
        '`--gml-color-usuario-sobre-claro` —el MISMO token que ya pintaba el nº de vértice de esa ' +
        'tabla, así que no entra ni un color nuevo— y una barra de 3 px como `inset box-shadow` ' +
        'en la celda del índice. ── Y NO HAY CLASE DE ESTADO ── Las dos reglas cuelgan de ' +
        '`[aria-current=\'true\']`, que el módulo ya tiene que poner para el lector de pantalla: ' +
        'es la misma decisión que la barra de edición tomó con `aria-expanded`, y aquí además ' +
        'ahorra el atributo `class` que habría que escribir en cada `<tr>`. Sobran 12.242 sobre ' +
        'el techo.' },
    { hito: 'Dos indicadores de qué geometrías hay cargadas (puerta 2)', commit: '0097b57',
      total: 69956, nuestro: 54861, rebanada: null,
      nota:
        '**+555 B, y es lo ÚNICO que la feature de las dos puertas le cuesta a esta hoja.** El ' +
        'resto —el compositor, los dos ganchos, el reencuadre del historial, el aviso del fondo ' +
        'sin solape y el botón «Traer el parcelario de fondo»— no toca CSS: el botón nuevo ' +
        'reutiliza `.gml-boton--secundario` y su renglón `.gml-accion-estado`, los dos con tres ' +
        'llamantes ya. ── QUÉ SE PAGA ── `.gml-capas` (el contenedor flex bajo el rótulo del ' +
        'dato) y `.gml-capa` con su punto `::before`, más las tres reglas de estado ' +
        '(`[data-presente=\'true\']` y las dos que le ponen al punto el color de SU geometría). ' +
        'Son 4 px de alto extra en la cabecera del panel, medidos. ── POR QUÉ NO SALE MÁS ' +
        'BARATO ── El ámbar es `--gml-color-usuario-sobre-claro`, el token que ya pinta el nº de ' +
        'vértice: no entra ni un color nuevo por ese lado. El neutro del parcelario (#6b7280) SÍ ' +
        'es un literal y no un token, y es deliberado: es el `COLOR_OFICIAL` de ' +
        '`viewer/sincronizacion.js`, que vive en JS porque el visor no puede importar CSS. ' +
        'Promoverlo a token obligaría a mantener el mismo valor en dos sitios sin nadie que lo ' +
        'atara; el comentario de la regla nombra su origen, que es lo que sí ata. ── Y NO SE ' +
        'PAGA UN ESTADO OCULTO ── El indicador apagado cambia el TEXTO («Sin levantamiento»), ' +
        'así que no hace falta ninguna utilidad de texto solo para lectores: el color es ' +
        'refuerzo, nunca el único canal. Sobran 12.797 sobre el techo.' },
    { hito: 'Los indicadores se aprietan: 3 px por debajo de un suelo medido', commit: '0097b57',
      total: 69972, nuestro: 54877, rebanada: null,
      nota:
        '**+16 B —un `line-height` y un margen— y es el asiento más barato del proyecto, pero no ' +
        'es cosmético: es el que devuelve un guion de humo a verde.** Los dos indicadores del ' +
        'asiento anterior ocupaban 19,94 px en la cabecera del panel, que comparte columna con la ' +
        'tabla de vértices. Esa tabla tiene DOS suelos vigilados desde los guiones: 120 px (§10, ' +
        'con una tanda de 12 avisos) y 124,57 px (§16, con sobrante de 2 piezas). Medido en Chrome ' +
        'el 2026-08-08: la dejaban en **117 px**, TRES por debajo del suelo del §10 — y el panel ' +
        'no desborda, así que el síntoma habría sido mudo. ── QUÉ SE CAMBIA ── `line-height:1.2` ' +
        '(el bloque baja de 15,94 a 13,19 px) y `margin-top` de 4 a 2 px: **19,94 → 15,19 px**. ── ' +
        'Y QUÉ NO ── **no se retiran los indicadores**, se aprietan: son la única señal en pantalla ' +
        'de qué geometría se va a generar, y quitarlos habría sido pagar producto por píxeles. Con ' +
        'el cambio, §10 pierde ese problema, y §16, §09 y §23 quedan en `ok:true`. Sobran 12.781 ' +
        'sobre el techo.' },
    { hito: 'Los botones de Entrada dejan de tocarse (y de robarse el clic)', commit: '771c8b3',
      total: 70113, nuestro: 55018, rebanada: null,
      nota:
        '**+141 B por TRES declaraciones, y las tres arreglan defectos MEDIDOS, no gusto.** El ' +
        'autor reportó que los botones de la barra de Entrada estaban «sin margen entre ellos y ' +
        'se solapan», y al medir en Chrome a 1440×900 las dos cosas eran literales. ── (1) y (2) ' +
        'LOS DOS APILADOS A CERO ── `.gml-via` es un bloque normal y lo único que separaba a sus ' +
        'hijos era el `margin: 4px 0 10px` del apunte, así que todo lo que cuelga por DEBAJO del ' +
        'apunte se apilaba a **0,00 px**: «Traer del Catastro» acababa en 284,53 y «Deducir del ' +
        'mapa» empezaba en 284,53; «Elegir un fichero de medición…» acababa en 472,53 y «Pegar ' +
        'coordenadas…» empezaba en 472,53. Los bordes de 1 px se fundían en una sola línea. Se ' +
        'pagan `.gml-via-boton + .gml-via-boton { margin-top }` y `.gml-boton-par { margin-top }`, ' +
        'los dos a `--space-2` porque 8 px es ya el `gap` de `.gml-campo-fila`, `.gml-boton-par` y ' +
        '`.gml-bloque`: la columna respira igual que la fila. ⚠️ **Y NO se hace con ' +
        '`display:flex` + `gap` en `.gml-via`**, que habría sido una declaración en vez de dos: ' +
        'dentro de un flex los márgenes del rótulo y del apunte NO se colapsan y se SUMARÍAN al ' +
        'gap — medido, 22 px de columna en vez de 16. ── (3) EL SOLAPE DE VERDAD ── ' +
        '`.gml-boton--menudo::after` agranda el objetivo 6 px por lado, y está escrito para un ' +
        'botón SOLO en su fila (F08, F10). En el conmutador de rama hay dos a 4 px: los objetivos ' +
        'se solapaban 8 px y cada uno se metía 2 px dentro de la caja VISIBLE del otro. Medido con ' +
        '`elementFromPoint`, con «Parcela» en 234 → 290,73 px: **en x = 289 y x = 290 el clic lo ' +
        'recibía EDIFICIO**. Se apaga con `content: none` acotado al conmutador (0,2,0), y no se ' +
        'pierde accesibilidad: el `align-items: stretch` de K.1 ya deja esos botones en 25,39 px, ' +
        'por encima de los 24 que pide WCAG 2.5.8. ── EL PRECIO EN PÍXELES ── **+16 px de columna ' +
        'en Entrada**, y hay que decir dónde caen: a 1280×720 la quinta vía («Abrirlo», el ' +
        'expediente guardado) ya se veía recortada ANTES de este cambio —bottom 737,20 sobre 720, ' +
        'guion 22 en `ok:false`— y ahora queda en 753,20. El defecto es previo y sigue abierto; ' +
        'este asiento no lo crea, lo empeora en 16 px y lo deja anotado. Sobran 12.938 sobre el ' +
        'techo.' },
    { hito: '«Vaciarlo»: el pie de Entrada estrena un segundo renglón', commit: '0c28e6f',
      total: 70262, nuestro: 55167, rebanada: null,
      nota:
        '**+149 B por DOS reglas de tres declaraciones**, y las dos son de composición, no de ' +
        'aspecto. Petición del autor (2026-08-09): la aplicación tenía cuatro puertas de entrada y ' +
        'ninguna de salida — quien soltaba el `.dxf` equivocado se quedaba con él, y ni recargar a ' +
        'mano valía, porque el `?demo=` y el `#/parcela/edicion` vuelven a entrar con la página. ' +
        '── (1) `.gml-entrada-pie + .gml-entrada-pie` ── El pie pasa a tener DOS preguntas en voz ' +
        'baja («¿Ya tenías un expediente?» y «¿Quieres empezar de cero?»), así que al segundo se ' +
        'le quitan `border-top`, `padding-top` y el margen de 8 px, y se le pone `--space-1`. Sin ' +
        'esas tres, el bloque enseñaba DOS hairlines a 20 px una de otra y se leía como el final ' +
        'de la pantalla dos veces. ── (2) `.gml-entrada-pie + .gml-accion-estado` ── 8 px para el ' +
        'renglón del armado («vuelve a pulsar para confirmarlo»), y va en el `+` y no en la clase ' +
        'para heredar el `:empty{display:none}` que ya tiene: sin texto no hay hueco, así que la ' +
        'columna no paga nada el 99 % del tiempo. ── ⭐ EL PRECIO EN PÍXELES ES **CERO** EN EL ' +
        'ARRANQUE, Y ESO SE MIDIÓ ── El segundo renglón nace `hidden` y solo sale cuando hay algo ' +
        'que vaciar. Medido en Chrome a 1280×720 con la app VACÍA (que es el arranque de ' +
        'producción desde el 2026-08-07): `display:none`, alto 0,00 px y «Abrirlo» sigue acabando ' +
        'en **753,20 px** — exactamente donde lo dejó el asiento anterior. O sea que el defecto de ' +
        'desbordamiento que aquél anotó **no se empeora**. Con una parcela cargada (`?demo=real`) ' +
        'el pie crece **+30,50 px** (753,20 → 783,70) y cae detrás del scroll del panel; se ' +
        'comprobó que se alcanza scrolleando y que el objetivo del botón lo recibe el botón ' +
        '(`elementFromPoint` sobre `[data-accion="empezar-de-nuevo"]`, con el `::after` de ' +
        '`--menudo` a -6 px por lado). Sobran 13.103 sobre el techo.' },
    { hito: 'Topbar · rebanada 0 · las reglas muertas, y el informe recupera su pantalla',
      commit: '0c28e6f',
      total: 70117, nuestro: 55022, rebanada: null,
      nota:
        '**−145 B, y es el primer asiento en negativo que no es una reescritura.** Trabajo ' +
        'preparatorio del topbar: la mudanza a barra horizontal retira `--gml-rail-ancho`, y antes ' +
        'de tocar la cáscara había que resolver lo que colgaba de él. ── (1) SE VAN DOS SELECTORES ' +
        'DEL EJE PASO ── La regla llevaba CINCO —`entrada`, `validacion`, `edicion`, `diagnostico`, ' +
        '`informe`— y dos eran código muerto: `PASO.VALIDACION` y `PASO.INFORME` se retiraron del ' +
        'enum en el propio rework (`app/navegacion.js:135` y `:161`, «NO se dejan alias»), así que ' +
        '`app/pantalla.js` no puede escribirlos y aquellos dos selectores no casaban NUNCA. No ' +
        'hacían daño, pero mentían sobre cuántas pantallas tiene la aplicación. ── (2) LA TERCERA ' +
        'REGLA MUERTA SÍ HACÍA DAÑO ── `.gml-app[data-paso=\'informe\'] .gml-dialogo-informe` daba al ' +
        'diálogo del informe la pantalla completa, y por el mismo motivo estaba muerta desde el ' +
        'rework. **El diálogo llevaba meses saliendo como la tarjeta centrada de F09 y ninguna ' +
        'prueba lo veía**, porque el CSS de esta cáscara no tenía ni una. Ahora cuelga de ' +
        '`[data-presentacion=\'pantalla\']`, que escribe `presentar()` en el mismo fork donde ya ' +
        'decidía `show()` contra `showModal()`. No se usó `aria-modal="false"`, que estaba ahí y ' +
        'era gratis, por la regla de `app/barra.js` («el estado se pinta desde `data-rail-estado`»): ' +
        'el aspecto sale de un `data-*` y no de ' +
        'ARIA. ── ⭐ EL PRECIO EN PÍXELES, MEDIDO EN CHROME A 1280×720 ── ANTES: caja 760×633,60 en ' +
        '(260, 43,20), formulario 1.566 px, visible 632, **934 px (59,6 %) tras un scroll interno**. ' +
        'DESPUÉS: caja **1.070×720 en (210, 0)**, formulario 1.378 (reflujo: más ancho, menos alto), ' +
        'visible 720, **658 px (47,8 %)**. Se recuperan 276 px de documento leído sin scrollear, y ' +
        'el rail sigue visible a la izquierda, que era la condición escrita («taparlo convertiría la ' +
        'pantalla en una ratonera»). **NO se elimina el scroll y no se pretende**: 1.378 px no caben ' +
        'en 720. ── ⚠️ CORRIGE A LA NOTA DEL 2026-08-05, que decía que «Componer PDF» y «Cancelar» ' +
        'nacían bajo el pliegue: ya no, tienen pie pegajoso y se ven siempre. Lo enterrado es el ' +
        'CONTENIDO. Y el defecto había EMPEORADO solo, de 704 px a 934, porque F19 y F21 le metieron ' +
        'campos al formulario mientras nadie miraba. Sobran 12.958 sobre el techo.' },

    { hito: 'Topbar · rebanada 1 · el rail gira 90°, la cáscara pasa a rejilla',
      commit: '0c28e6f',
      total: 71303, nuestro: 56208, rebanada: null,
      nota:
        '**+1.186 B.** El rail vertical de 210 px se convierte en la barra de arriba, y la cáscara ' +
        'deja de ser un `display:flex` de tres columnas para ser una rejilla de 2×2 con áreas ' +
        '(`barra barra / panel mapa`). **Cero nodos nuevos en `index.html`** —el `<nav>` es a su vez ' +
        'una rejilla, así que sus cuatro hijos se colocan sin un solo `<div>` envolvente—, que es lo ' +
        'que dejó esta rebanada fuera del alcance del contrato K.1 y del guardián G16. ── ⭐ EL ' +
        'CANJE, MEDIDO EN CHROME A 1280×720 CON `?demo=real` ── ANTES: rail 210×720, panel 392×720, ' +
        'mapa **678×720**. DESPUÉS: barra **1280×72**, panel 392×648, mapa **888×648**. El mapa gana ' +
        '210 px de ancho y paga 72 de alto: **+17,9 % de superficie** (488.160 → 575.424 px²). ── ⛔ ' +
        'LO QUE CUESTA, Y NO SE MAQUILLA ── El panel paga los mismos 72 px de alto **y no gana nada**, ' +
        'y se los come ENTEROS su único estirador: `#tabla-vertices` pasa de **225,08 a 153,08 px** ' +
        '(−32 %) en Edición con datos. Y en Entrada rompe un criterio: la tercera vía («Abrir un ' +
        'GML») cae **59,42 px bajo el pliegue**, que el guion 14 reporta. No hay hueco muerto que ' +
        'recuperar —la sección tiene 16 px de relleno y 8 de separación, medidos—: el contenido de ' +
        'Entrada mide 575,61 px y el panel solo tiene 707,92 px si la barra vale 12. **La aplicación ' +
        'estaba a 12,08 px de ese acantilado antes del topbar**; el topbar no lo creó, lo cruzó. ── ' +
        'DE DÓNDE SALEN LOS BYTES ── La rejilla y sus áreas son baratas; lo caro es que la barra ' +
        'horizontal necesita reglas que la columna no tenía: la unión punteada entre peldaños ' +
        '(`::before` con el estado de sus dos extremos), la pista reservada del motivo breve, y el ' +
        'renglón de motivo entero, que es un componente nuevo. ── ⭐ Y ESTRENA GUARDIÁN ── ' +
        '`test/estilos/cascara.test.js`: 11 pruebas que corren en `npm test` sobre una hoja que hasta ' +
        'hoy **no tenía ninguna**. Cazan las 7 mutaciones con las que se probaron, incluida la que ' +
        'reproduce el defecto de la rebanada 0 (una regla que cita un paso retirado). Sobran 14.144 ' +
        'sobre el techo.' },

    { hito: 'Topbar · rebanada 2 · el expediente, los avisos y la entrega suben a la barra',
      commit: 'eb39919',
      total: 72839, nuestro: 57744, rebanada: null,
      nota:
        '**+1.536 B.** La barra pasa de tres zonas a CINCO —marca · expediente · recorrido · ' +
        'rama+avisos · entrega— y el recorrido se centra, que es lo que la hace leerse como una ' +
        'barra: a 1917 px sobraban **1.381,7 px medidos** a la derecha, el 72 %. ── QUÉ SUBE, Y ' +
        'TODO SON MUDANZAS ── Ni un `data-accion` nuevo: `abrir-expediente` y `empezar-de-nuevo` ' +
        'vienen del pie de Entrada, `generar-gml` del pie del panel, y los dos chips de la ' +
        'cabecera. El conmutador «Parcela/Edificio» subió **sin tocar una línea de JavaScript**: ' +
        '`app/rama.js` lo inserta dentro de `.gml-chips`, así que mudar ese `<div>` movió las dos ' +
        'cosas. La regla que decide qué sube: **arriba lo que sale de la app hacia fuera, abajo lo ' +
        'que transforma el expediente** — por eso «Diagnosticar encaje» y «Derivar sobrante» se ' +
        'quedan. ── ⭐ Y EL PIE DE ENTRADA DEVUELVE 104 px MEDIDOS ── La tercera vía («Abrir un ' +
        'GML») caía **139 px** bajo el pliegue a 1280×720 tras la rebanada 1; ahora caen **35**. No ' +
        'está cerrado y no se disimula: el guion 14 lo sigue reportando y sale `ok:false` por eso y ' +
        'por nada más. ── ⛔ LO QUE NO ENTRA, Y POR QUÉ ── El desplegable `[▾]` de salidas. Sus ' +
        'cinco `data-accion` los fabrica hoy `app/dialogo-expediente.js` DENTRO de su `<dialog>`, y ' +
        'repetirlos arriba es la trampa K.1 exacta: `querySelector` se queda con el primero del ' +
        'documento. Hace falta sacarlos del diálogo y abrir `atender()` en el cableado; el hueco y ' +
        'los tres pasos están escritos en `index.html` donde irá. ── DE DÓNDE SALEN LOS BYTES ── ' +
        'Dos menús desplegables con su sombra y su teclado, la zona de expediente con sus dos ' +
        'renglones, y el botón partido. A cambio se van las tres reglas de `.gml-entrada-pie` y la ' +
        'de `.gml-rail-grupo`, que se quedaron sin nodo. Sobran 15.680 sobre el techo.' },

    { hito: 'Topbar · la barra deja de recortarse a sí misma y se va el renglón',
      // Era `null` y el guardián de asientos salía ROJO por eso: el test exige
      // un hash o la cadena literal «(sin commitear)», y `typeof null` es
      // 'object', así que `toMatch()` ni siquiera llegaba a comparar. Corregido
      // el 2026-08-10; queda por commitear igual que estaba.
      commit: '(sin commitear)',
      total: 72734, nuestro: 57639, rebanada: null,
      nota:
        '**−105 B, y es el primer asiento de este rework que DEVUELVE bytes.** Tres arreglos que ' +
        'salen de mirar la aplicación publicada, no de leer el plan. ── ⛔ 1 · LA BARRA SE ' +
        'RECORTABA A SÍ MISMA ── `.gml-rail` era `overflow:hidden` y eso rompía sus propios menús ' +
        'por DOS caminos, los dos medidos: el menú del expediente mide 94,2 px y colgaba de una ' +
        'zona de 44,3, así que sus **37,3 px de abajo quedaban cortados** —«Vaciarlo» se pintaba y ' +
        'era inalcanzable—; y `overflow:hidden` **no impide el scroll, solo su barra**, así que el ' +
        '`focus()` de la primera opción arrastraba el contenedor entero (**`scrollTop: 37`**) y se ' +
        'llevaba la marca, el recorrido y «Generar GML» fuera de la pantalla. Lo que aquel ' +
        '`hidden` protegía lo dan `minmax(0,1fr)` y el `text-overflow` de cada zona, que recortan ' +
        'TEXTO sin recortar CAJA. ── 2 · SE VA EL RENGLÓN DE MOTIVO (−19 px de alto) ── Lo pidió ' +
        'fuera el autor y el motivo se sostiene solo: **las dos cosas que decía se decían ya en ' +
        'otro sitio** —el motivo largo en el `title` del peldaño, el acuse de la entrega en el pie ' +
        'del panel— y con un GML descargado la misma frase se veía DOS VECES a la vez. ' +
        '`--gml-cabecera-alto` baja de 72 px a 53 y el mapa pasa de 888×648 a **888×667**. Lo ' +
        'único que costó: el acuse de «Generar GML» tuvo que salir del `<footer>` —que es entero ' +
        '`data-pantalla="edicion"`— al `<aside>`, o pulsar desde Entrada no diría nada en ninguna ' +
        'parte. ── 3 · LA BARRA TENÍA `padding: 0` ── La marca nacía en `x: 0` y la entrega ' +
        'terminaba en el borde exacto de la ventana (`right: 0`, medido). ── QUÉ VIGILA AHORA EL ' +
        'GUION 14 ── Su sección del renglón se sustituye por la que mide los menús: abre, mide ' +
        '`scrollTop` de la barra y comprueba que cada opción cae dentro de la ventana. **Cazó la ' +
        'mutación**: con `overflow:hidden` devuelto sale `ok:false` nombrando la causa. Sobran ' +
        '15.575 sobre el techo.' },

    { hito: 'La aplicación estrena el verde: acción completada',
      commit: '(sin commitear)',
      total: 72788, nuestro: 57693, rebanada: null,
      nota:
        '**+54 B por UNA regla de dos líneas, y es el primer uso de `--color-state-ok` en todo el ' +
        'proyecto.** Sale de `/plan-design-review` del 2026-08-10, que midió esto: la hoja definía ' +
        'el verde del design system desde la copia del 2026-07-26 y **no lo usaba ni una vez** —ni ' +
        '`#15803d` ni `#22c55e` aparecían fuera del fichero de tokens—. La aplicación contaba ' +
        'errores en rojo y avisos en ámbar, y cuando la acción salía bien lo decía en el mismo gris ' +
        'que «no hay parcela»: se podía recorrer las tres pantallas, generar un GML válido y no ver ' +
        'un solo verde. ── QUÉ ENTRA ── `.gml-accion-estado--exito`, el simétrico exacto de ' +
        '`--error`, que `app/main.js` conmuta en el ÚNICO desenlace en el que la acción pedida se ' +
        'completa: `entrega.descargado`. ── ⛔ POR QUÉ NO ES UNA GRIETA EN LA REGLA DE ORO 9 ── La ' +
        'revisión propuso primero un VEREDICTO de encaje en el cajón de diagnóstico («fuera del ' +
        'margen de identidad», en rojo) y **se descartó por incumplirla**: la cabecera de ' +
        '`viewer/cajon-diagnostico.js` prohíbe las tres cosas que ese diseño hacía —color de mérito ' +
        'sobre una cifra, texto que dictamina, y el margen como veredicto en vez de enunciado—, y ' +
        'la regla tiene 76 aserciones en 10 ficheros de test y se ha re-decidido al menos tres ' +
        'veces. Lo que entra no es una cifra ni un juicio sobre el levantamiento: es la máquina de ' +
        'estados de la propia app diciendo si te deja seguir, que es exactamente lo que ya hacía el ' +
        'rojo desde F04 sin que nadie lo discutiera. ── GUARDIÁN ── Dos `it` nuevos en ' +
        '`test/app/main-gml.dom.test.js`: que la descarga completada marca el verde y NO el rojo ' +
        '(mutuamente excluyentes), y que una descarga fallida no lo marca aunque el GML exista. ' +
        'Sobran 15.629 sobre el techo.' },

    { hito: 'El cajón de diagnóstico estrena jerarquía: escala de 5 pasos y rótulos de grupo',
      commit: '(sin commitear)',
      total: 72844, nuestro: 57749, rebanada: null,
      nota:
        '**+56 B, y el trabajo de verdad NO está en esta hoja.** Es la segunda mitad de la revisión ' +
        'de diseño del 2026-08-10 (T1 y T2), y el hallazgo que la reordenó fue este: **la ' +
        'tipografía del cajón no la gobierna este fichero**. `viewer/cajon-diagnostico.js` viste EN ' +
        'LÍNEA —por el mismo acuerdo que `viewer/capas.js`: tiene que leerse sobre una ortofoto ' +
        'aunque la hoja no cargue—, y un estilo en línea gana a cualquier selector. Así que la ' +
        'escala vive allí, en `ESCALA`, y de aquí solo salen los 56 B de `.gml-cajon-rotulo` ' +
        '(familia, que es lo único que el módulo no fija). ── QUÉ MEDÍA ANTES ── 92 de las 105 ' +
        'declaraciones de tamaño de la aplicación valían 10, 11 o 12 px: el dato y su nombre se ' +
        'leían igual de fuerte. Y varias filas del cajón **no declaraban tamaño**, así que heredaban ' +
        'los 12 px de Leaflet sobre el mapa y otro distinto dentro del panel — el mismo cajón se veía ' +
        'de dos tamaños según dónde estuviera. ── QUÉ ENTRA ── Cinco pasos con papel asignado ' +
        '(DATO_XL 30 / DATO 15 / CUERPO 13 / APUNTE 12 / RÓTULO 10), dos rótulos de grupo ' +
        '(«Superficie», «Encaje») como `<h3>` para que un lector de pantalla salte de grupo, y la ' +
        'superficie medida a 30 px **solo cuando hay cifra**: «No consta» a 30 px grita una ' +
        'ausencia. ── ⛔ LO QUE NO ENTRA, Y POR QUÉ ── Un rótulo para la invasión: esa sección se ' +
        'anuncia con TRES textos distintos («no se ha consultado» / «ninguna» / el título a secas) y ' +
        'esa diferencia es media razón de ser de F07. Y ningún color ni palabra de mérito: la regla ' +
        'de oro 9 sigue intacta, esto es jerarquía de lectura, no juicio. ── GUARDIÁN ── Cinco `it` ' +
        'en `test/viewer/cajon-diagnostico.dom.test.js`, y uno es anti-deriva: recorre el DOM y ' +
        'exige que TODO `fontSize` en línea salga de `ESCALA`. Cazó un `11px` suelto en la nota de ' +
        'astillas descartadas nada más escribirse. ── ⚠️ LO QUE CUESTA, MEDIDO Y NO ESTIMADO ── ' +
        '**+107 px de alto** en el cajón a 1280×720 con el diagnóstico completo (`scrollHeight` 717 ' +
        '→ 824), contra 544 px visibles. NO introduce scroll: con 717 ya scrolleaba, porque el cajón ' +
        'es el estirador de esta pantalla y scrollear por dentro es su trabajo desde F07. Lo ' +
        'profundiza, y ese es el canje que se acepta a cambio de que el dato titular se lea desde ' +
        'lejos. Si algún día aprieta, lo primero que debe plegarse es el párrafo del margen de ' +
        'identidad, que son cinco líneas de 12 px que casi nadie lee. Sobran 15.685 sobre el techo.' },

    { hito: 'La barra de edición vuelve a los iconos, con pista propia y una herramienta de borrar',
      commit: '(sin commitear)',
      total: 74250, nuestro: 59155, rebanada: null,
      nota:
        '**+1.406 B, y una línea de las 1.406 es la que arregla el defecto que se reportó.** El ' +
        'autor pidió tres cosas el 2026-08-10: poder borrar puntos desde la tabla de coordenadas, ' +
        'una herramienta de borrar en la barra, y la barra en iconos con texto al pasar el ratón — ' +
        'más «el botón de ayuda abre una ventana con margen excesivo a la derecha». ── ⭐ EL ' +
        'MARGEN NO ERA UN MARGEN ── `.gml-esquina-centro-abajo .gml-barra-edicion` es `flex-' +
        'direction:column` sin `align-items`, o sea `stretch`, que **no estira a los hijos con ancho ' +
        'propio: los deja a la izquierda**. La fila de herramientas medía ~530 px con las palabras y ' +
        'el panel de ayuda mide 460 fijos, así que esos ~70 px de diferencia quedaban en blanco a su ' +
        'derecha. Una caja de 460 alineada a la izquierda dentro de otra de 530, no un padding. Se ' +
        'cierra con `align-items:center`, que además hace que abrir un panel ya no desplace las ' +
        'herramientas (la caja crece desde su centro, que es donde el `translateX(-50%)` la ancla). ' +
        '── ⚠️ ESTO REVIERTE EL REDISEÑO DEL 2026-08-05 ── aquel día el autor RECHAZÓ los iconos, y ' +
        'su objeción no era estética: era que `title` aparece al segundo de pasar el ratón, o sea ' +
        '**después de haber dudado**. Por eso la barra no vuelve con `title` sino con una PISTA ' +
        'propia a 120 ms (e instantánea con el foco del teclado), y un guardián prohíbe que ninguna ' +
        'herramienta lleve además el `title` nativo — dos globos sobre el mismo botón es el descuido ' +
        'clásico de quien se fabrica un tooltip. ── QUÉ ENTRA EN BYTES ── el estado `aria-pressed` de ' +
        'los conmutadores (uno azul, y ROJO el destructivo: armar «Borrar» y armar «Dibujar» no ' +
        'pueden verse igual), la tipografía y la sombra de la pista (lo que la hace FLOTAR va en ' +
        'línea, o sería un renglón que empuja la fila al pasar el ratón), la cuarta columna de la ' +
        'tabla de vértices con su ×, el cursor `crosshair` del modo borrar y una `.gml-rotulo-oculto` ' +
        'genérica. ── ⛔ LA TRAMPA DEL CURSOR ── `crearMapa` hace `L.map()` sobre el propio `<main ' +
        'class="gml-mapa">`, así que la clase del modo cae en ESE MISMO elemento y un selector de ' +
        'descendencia `.gml-mapa .gml-modo-borrar` no habría casado nunca. ── QUÉ SE VA ── la regla ' +
        'de las palabras y `.gml-barra-texto`, que se queda sin nodos. La fila baja de ~530 px a ' +
        '~200, con lo que el panel de ayuda pasa a ser el hijo más ancho de la barra. Sobran 17.091 ' +
        'sobre el techo.' },

    { hito: 'El cromo se despega del mapa: elevación, tres niveles de texto y una sola forma',
      commit: '(sin commitear)',
      total: 77020, nuestro: 61925, rebanada: null,
      nota:
        '**+2.770 B**, y es la revisión de diseño de sistema que pidió el autor el 2026-08-10 en ' +
        'una frase: «el cromo (panel, cabecera, selectores) vive en el mismo plano visual que el ' +
        'mapa y compite con él, en vez de flotar por encima con autoridad». ── ⭐ EL REPARTO, ' +
        'MEDIDO Y NO ESTIMADO ── Se construyó la hoja CUATRO veces, quitando un bloque cada vez, ' +
        'porque a ojo habría salido al revés: **selector de capas +1.699 · caja de aviso +764 · ' +
        'elevar panel y barra +160 · todo lo demás +147**. Lo caro NO es la elevación (seis ' +
        'declaraciones) sino el selector de capas, y el motivo es el prefijo: sus reglas nuevas ' +
        'arrastran `.gml-app .gml-mapa .leaflet-control-layers-*` (~45 caracteres antes de la ' +
        'primera llave) porque la convención de la sección del mapa exige (0,3,0) para ganarle a ' +
        'las reglas que Leaflet duplica bajo `.leaflet-touch`. Se comprobó que (0,2,0) bastaría ' +
        'para éstas y **no se hizo**: media sección con un prefijo y media con otro es peor que ' +
        '300 B. ── QUÉ SE COMPRA ── (1) **Elevación.** Panel y barra pasan a `position:relative` ' +
        '+ `z-index` + sombra direccional, y el `z-index` no es opcional: son HERMANOS del mapa ' +
        'en la rejilla, así que sin él la sombra la tapa el mapa, y por debajo de 1000 la tapa el ' +
        'botón de zoom, que nace a 10 px del borde. Lo que flota DENTRO del mapa (capas, ' +
        'opacidad, zoom, barra de edición, los dos cajones) pasa a un halo común. ── ⚠️ **LAS ' +
        'SOMBRAS SE CALIBRARON SOBRE LA CAPA «BLANCO», NO SOBRE LA ORTOFOTO**, y esa decisión ' +
        'ahorró una equivocación: una sombra oscura sobre el mar es invisible por física, así que ' +
        'ajustarla ahí lleva a subirla hasta que se vea y entonces sale una banda gris sobre el ' +
        'parcelario blanco del Catastro. La primera tanda (20 %, desenfoque 16, estrechamiento ' +
        '−8) no se veía ni sobre blanco: 6 px de extensión útil. ── (2) **El selector de capas ' +
        'deja de mezclar bases y superpuesta**: rótulo de grupo por `::before` y divisor a ' +
        'sangre. Los rótulos NO son nodos a propósito —ese DOM lo fabrica `L.control.layers` y ' +
        'hurgarlo tras `addControl` se rompe en una subida menor de la dependencia sin que lo ' +
        'diga nadie—. ⛔ **Y aquí estaba el único trozo de interfaz que NO iba en Geist**: ' +
        '`leaflet.css` le pone Helvetica/Arial a `.leaflet-container`, que es ancestro de todo lo ' +
        'del mapa, y la primera versión de este bloque dio tamaño y color pero NO familia. El ' +
        'autor lo reportó como «la tipografía de capa base es muy fina y no se entiende bien»; se ' +
        'corrige con `font-family` donde toca (un `<label>` no la hereda), 13/500 en las filas y ' +
        '11 px con menos interletra en los rótulos de grupo. ── (3) **La caja del aviso de ' +
        'error.** Era texto rojo suelto al fondo de la columna y el autor lo describió exacto: ' +
        '«parece un fallo de la app». ⛔ Y destapó un defecto de cascada al mirarlo en el ' +
        'navegador: `--panel` y `--error` caen en el MISMO `<p>` y los dos querían `padding`, así ' +
        'que el aviso salía **a sangre de borde a borde del panel**; se reparte con la ' +
        'combinación de las dos clases (margen para la sangría, relleno para la caja). En jsdom ' +
        'no hay cascada que resolver. ── (4) **Un radio y una altura de control, re-punteando ' +
        'tokens del design system en vez de reescribir reglas.** `--radius`, `--radius-md` y ' +
        '`--radius-sm` se REDECLARAN en el `:root` de esta hoja (no se toca `tokens/spacing.css`, ' +
        'que es copia fiel): los ~40 radios pasan a 6 px **sin tocar ni una regla**. De ahí que ' +
        '«todo lo demás» sean 147 B para un cambio que se ve en toda la pantalla. ── ⛔ **LO QUE ' +
        'SE PROBÓ Y EL AUTOR RECHAZÓ EL MISMO DÍA** ── El encargo pedía reservar la saturación ' +
        'para «la geometría del usuario (violeta #7C3AED)», así que el acento pasó a ese violeta ' +
        're-punteando cuatro tokens más del DS. Se revirtió entero («no me gusta el morado, creo ' +
        'que es mejor el azul de antes») y son los −126 B de diferencia con la primera medición. ' +
        'Queda anotado en la hoja porque **el encargo daba por hecho que la geometría del usuario ' +
        'era ese violeta y no lo es desde F03 fase 5**: `viewer/_comun.js#COLOR_USUARIO` lo ' +
        'retiró porque desaparece sobre las sombras de la ortofoto. Probado y descartado dos ' +
        'veces, en el mapa y en el cromo. ── (5) **El recorrido de la barra**, también reportado ' +
        '(«los textos no coinciden con el punto, se ve mal y feo cuando está señalado»). El punto ' +
        'y la línea de unión se centraban en el alto del peldaño, pero el texto es una rejilla de ' +
        'DOS filas (rótulo + la reserva del motivo), así que su centro cae ENTRE las dos líneas. ' +
        'El desfase es exactamente media pista —`(H−R−M)/2 + R/2 = H/2 − M/2`—, o sea que se ' +
        'corrige con dos `margin-bottom: var(--gml-motivo-alto)` y sin escribir ni una cifra a ' +
        'mano. Y el relleno de color del peldaño activo se retira: era un rectángulo de 56 px de ' +
        'alto detrás de una palabra. El filo de 2 px se muda del peldaño al botón, porque en el ' +
        'peldaño incluía la línea de unión y la pestaña arrancaba a mitad del guion. ── ⭐ **Y DE ' +
        'PASO SE CIERRAN DOS VARIABLES MUERTAS QUE NADIE VEÍA**: `.gml-barra-menu-opcion` pedía ' +
        '`var(--radius-sm)` y `.gml-rail-marca` pedía `var(--space-5)`, y **ninguna de las dos ' +
        'existe en `tokens/`** — una variable sin declarar deja la propiedad en su valor inicial, ' +
        'así que aquella opción de menú llevaba meses a 0 px de radio y aquel relleno izquierdo a ' +
        '0. ── ⭐ **EL PRECIO EN PÍXELES ES CERO EN LA COLUMNA, Y ESO SE MIDIÓ** ── La ' +
        'unificación de altura de campo y botón se puso primero en 34 px y crecía la pantalla de ' +
        'Entrada 10 px (`scrollHeight` del bloque 575 → 585 en Chrome a 1280×720), empujando ' +
        '«Abrir un GML» de ~2 a 12 px bajo el pliegue. El encargo lo prohíbe («no añadas aire ' +
        'decorativo que reduzca lo que cabe en pantalla») y además 34 no está en la rejilla de 8 ' +
        'que el mismo encargo pide. Con **32** el bloque vuelve a medir **575 exactos**, y la ' +
        'respiración nueva de los separadores «O bien» (+16) queda pagada por el relleno de las ' +
        'vías (13/14 → 12/16) y el margen del apunte (10 → 8). Lo único que paga alto es el MAPA: ' +
        'la barra sube de 52 a 56 px porque el encargo la pedía menos apretada, y el mapa baja de ' +
        '888×667 a 888×663. ── GUARDIÁN ── `test/estilos/cascara.test.js` cazó una variable ' +
        'huérfana antes de que llegara al build, y `test/viewer/cajon-diagnostico.dom.test.js` ' +
        'cazó el radio de 8 px del cajón flotante que la unificación dejaba fuera. 7.516 pruebas ' +
        'en verde. Sobran 19.861 sobre el techo.' },

    { hito: 'El selector de capas baja la voz: reposo, fila activa y el rótulo de la casa',
      commit: '(sin commitear)',
      total: 76993, nuestro: 61898, rebanada: null,
      nota:
        '**+158 B MÍOS, y la hoja marca −27 respecto del asiento anterior: los otros −185 B no ' +
        'son de este cambio.** El árbol lo comparte otra sesión (`estilos/app.css` cambió en disco ' +
        'entre la lectura y la edición), así que la cifra propia se midió construyendo la hoja DOS ' +
        'veces, con los tres retoques y sin ellos: 76.835 → 76.993. Es el mismo método —y el mismo ' +
        'motivo— que el asiento «F18 y F19, sin asiento propio»: lo que no se puede atribuir, no se ' +
        'atribuye. ── EL ENCARGO ── El autor, sobre el control de capas: «el texto resalta ' +
        'demasiado y parece como que este modal no encaja con el resto del diseño de la página». ── ' +
        '⭐ LAS DOS DIVERGENCIAS, MEDIDAS EN CHROME A 1440×900 ANTES DE TOCAR NADA ── (1) las seis ' +
        'filas iban a **13 px / peso 500 / `--color-text-primary`**, y **ningún otro texto de 13 px ' +
        'de la aplicación pesa 500**: `.gml-via`, los peldaños de la barra y la ficha van a 13/400. ' +
        'Eran el único sitio donde el sistema hablaba más alto, y para enunciar opciones que el 99 % ' +
        'del tiempo están en reposo. (2) los rótulos de grupo iban a **0,44 px de interletra** y el ' +
        '`.gml-rotulo` del panel —la MISMA versalita de 11/600, en la misma pantalla y a 40 cm— va a ' +
        '**1,1 px**. ── QUÉ ENTRA ── Las filas bajan a 13/400 en `--color-text-secondary` (8,6:1 ' +
        'sobre el blanco de la tarjeta: baja el énfasis, no el contraste), la interletra de los dos ' +
        'rótulos pasa a la de la casa, y entra UNA regla nueva: la fila marcada recupera 500 y el ' +
        'primario. Eso es lo que se COMPRA al bajar el resto — hasta hoy las seis se veían igual y ' +
        'lo único que decía cuál está puesta era el punto del radio. ── ⛔ NO DESHACE EL ARREGLO DEL ' +
        'DÍA 10 ── aquella queja («muy fina y no se entiende bien») la causaba la FAMILIA (Arial de ' +
        '`leaflet.css`), no el peso; la familia y los 13 px se quedan. ── ⚠️ POR QUÉ `:has()` Y NO ' +
        'UNA CLASE ── el DOM lo fabrica `L.control.layers` y no hay dónde poner una clase sin hurgar ' +
        'en su interior tras `addControl`, que es la trampa que los rótulos `::before` ya evitan. Si ' +
        'un navegador no lo soporta, se descarta la regla y las seis filas quedan en reposo: se ' +
        'pierde el resalte, no el control. Verificado en Chrome que el resalte SIGUE al radio ' +
        '(clic en «Catastro» → 500 en Catastro, 400 en las otras cuatro). ── EL PRECIO EN PÍXELES ── ' +
        'la tarjeta ENCOGE 3,17 px de ancho (187,30 → 184,13) y no cambia de alto (263,00): el mapa ' +
        'no paga nada. Sobran 19.834 sobre el techo.' },

    { hito: 'La barra adelgaza: fuera el motivo y las salidas suben al partido de entrega',
      commit: '(sin commitear)',
      total: 77553, nuestro: 62458, rebanada: null,
      nota:
        '**+560 B**, y salen de dos peticiones del autor del 2026-08-11 que se resuelven en la ' +
        'misma barra. ── (1) **FUERA EL SUB-RENGLÓN DE MOTIVO** («no me gusta el texto debajo de ' +
        'Edición y Diagnóstico de que falta parcela, hace que el topbar sea muy ancho y queda ' +
        'desproporcionado»). ⛔ **El nodo NO se borra, y esa es toda la decisión**: la regla dura ' +
        'de `app/barra.js` dice que un paso apagado lleva el motivo escrito al lado, y borrar el ' +
        '`<span>` dejaría un botón deshabilitado cuyo nombre accesible es «Edición» a secas. Con ' +
        'la receta de texto oculto (1×1 px + `clip-path`, la misma de `.gml-rotulo-oculto`) el ' +
        'nombre accesible sigue siendo «Edición Falta la parcela» —medido en el navegador— y lo ' +
        'que se pierde son píxeles. ⚠️ Lo que SÍ se pierde, dicho sin maquillar: quien ve la ' +
        'pantalla y no usa lector ya solo tiene la forma LARGA en el `title`, o sea a un segundo ' +
        'de pasar el ratón. Se acepta porque hay un tercer canal que la barra de edición no ' +
        'tenía: el aviso del pie del panel lo dice con todas las letras. ── ⭐ **Y ARRASTRA TRES ' +
        'COSAS QUE NO SE VEN EN EL DIFF** ── (a) `--gml-motivo-alto` se retira: sin segunda línea ' +
        'no hay pista que reservar, y `.gml-rail-texto` deja de ser una rejilla de dos filas; ' +
        '(b) **la corrección de media pista de ayer se retira con ella** —los dos `margin-bottom` ' +
        'que subían el punto y la línea de unión para que coincidieran con el rótulo— porque con ' +
        'una sola línea `align-items: center` ya los alinea solo (medido: punto 23,0 / rótulo ' +
        '22,1 px); (c) la barra baja de **56 a 48 px**. Y 48 no es marcha atrás sobre el «dale ' +
        'algo más de alto» de ayer: el peldaño pasa de 32,85 px de contenido a 18,85, así que la ' +
        'holgura sube a ~14,6 px por lado, MÁS que los 9,6 que tenía con 52. Las dos peticiones ' +
        'no pedían lo mismo: una era holgura, la otra volumen. El mapa recupera 8 px de alto ' +
        '(888×663 → **888×671**, medido). ── (2) **LAS TRES EXPORTACIONES SUBEN A UN DESPLEGABLE ' +
        'JUNTO A «GENERAR GML»** («no tiene sentido que la exportación esté dentro del menú de ' +
        'expediente»). El hueco llevaba declarado desde la rebanada 2 del topbar con sus tres ' +
        'pasos escritos en `index.html`, y los tres se han hecho: el diálogo deja de fabricar ' +
        'esos botones (queda UNO por acción, la trampa K.1 evitada), `cablearExpediente` abre su ' +
        'embudo como `atender()` público, y el teclado sale gratis porque el mecanismo de menús ' +
        'de `app/barra.js` ya era genérico sobre `[data-menu-disparador]`. ⚠️ **Suben SOLO las ' +
        'tres de geometría**: `exportar-proyecto` y `abrir-proyecto` se quedan, porque el `.json` ' +
        'no es una salida sino el expediente guardado para volver a abrirlo. Misma regla que ' +
        'repartió la barra en la rebanada 2: arriba lo que sale de la app hacia fuera. ── ⛔ **LOS ' +
        'DOS DEFECTOS QUE DESTAPÓ MIRARLO EN EL NAVEGADOR** ── (a) **el acuse se perdía**: ' +
        '`decir()` escribe en el `role="status"` del `<dialog>`, y con el diálogo cerrado pedir ' +
        'un DXF sin parcela respondía «no hay nada que exportar» donde no lo lee nadie — un menú ' +
        'que se pulsa y no pasa nada, regla de oro 1. Se enruta EN `decir()` y no en cada ' +
        'llamante (son siete) al renglón `[data-estado="generar-gml"]`, que es el acuse de la ' +
        'zona de entrega y por tanto el sitio correcto; y se pide por el método público `acusar` ' +
        'de su dueño en vez de escribirle el nodo, para no tener dos módulos peleándose por los ' +
        'modificadores rojo/verde. (b) **el menú no se cerraba al elegir**: el oyente de ' +
        '`app/barra.js` salía por su primera guarda con cualquier clic de dentro. No se notaba ' +
        'porque las dos opciones que había abrían un `<dialog>` encima; exportar no tapa nada y ' +
        'el menú se quedaba colgando sobre el mapa. Ahora cierra si el clic fue en un ' +
        '`[role="menuitem"]`, que además es lo que dice el patrón ARIA. ── DE DÓNDE SALEN LOS ' +
        'BYTES ── el botón partido (cuatro reglas: radios de la costura, el filete translúcido y ' +
        'su variante para el primario apagado) y la receta de texto oculto del motivo. Se ' +
        'DEVUELVEN la rejilla de dos filas de `.gml-rail-texto` y los dos `margin-bottom` de la ' +
        'corrección; los 560 B son ya el neto. ── ⛔ **EL PARTIDO SE VE MITAD GRIS Y MITAD AZUL, Y ' +
        'ES A PROPÓSITO**: «Generar GML» nace apagado hasta que la parcela valida, y exportar el ' +
        'DXF sirve JUSTO mientras eso no pasa. Apagar la flecha escondería la única salida que ' +
        'funciona en ese momento; pintarla de gris dejándola pulsable sería un control que miente ' +
        'sobre sí mismo. ── ⚠️ **LA COLUMNA DE ENTRADA CRECIÓ, Y NO ES DE ESTE ASIENTO**: el ' +
        'bloque mide ahora 610 px de `scrollHeight` contra los 575 de ayer, y los 35 px son las ' +
        'dos líneas que otra sesión le añadió al apunte de la vía principal mientras esto se ' +
        'escribía («También puedes pinchar la parcela en el mapa…»). Se anota para que el ' +
        'siguiente que mida no se lo cargue a la barra. 7.521 pruebas en verde. Sobran 20.394 ' +
        'sobre el techo.' },

    // ⭐ EL ASIENTO QUE CIERRA LA QUINTA REBANADA. Es el único de los treinta que
    // lleva `rebanada` distinto de `null` sin ser una pantalla nueva, y el motivo
    // está en {@link TECHO}: la quinta no se cierra porque se haya terminado un
    // producto —su producto estaba hecho desde `3e9c8b0`—, se cierra porque la
    // decisión que la mantenía abierta ya está tomada.
    { hito: 'El sistema de diseño deja de ser el de otra app (y el techo pasa a ser el de ésta)',
      commit: '(sin commitear)',
      total: 73001, nuestro: 57906, rebanada: 'informe',
      nota:
        '⭐ **−4.552 B, el asiento en negativo más grande del registro, y el ÚNICO que no cambia ' +
        'un píxel de la pantalla.** `estilos/tokens/` era copia literal del sistema de diseño de ' +
        'una **calculadora de hormigón** (`prototipo/_ds/concreta-design-system-…`), y el problema ' +
        'nunca fue la copia —está bien hecha y su procedencia estaba escrita—: es que nadie volvió ' +
        'a adaptarla a ESTE producto en dieciséis fases. ── QUÉ SE MIDIÓ ── De las **120 variables ' +
        'declaradas en los cinco ficheros de tokens, 71 no tenían un solo `var()` que las llamara** ' +
        'en todo el producto: 52 en `colors.css` (14 de sección de hormigón —armaduras, cercos, ' +
        'tensiones—, 13 de estratos geotécnicos, 4 de casos de carga —sobrecarga, viento, nieve, ' +
        'sismo—, y los 19 alias cortos «usados por el sitio de marketing» que este proyecto no ' +
        'tiene), 10 en `spacing.css` (**ocho eran las dimensiones de la cáscara de la ' +
        'calculadora**: `--topbar-h`, `--sidebar-w`, `--inputs-w`, `--results-w`, y las cuatro de ' +
        'su portada), 5 en `typography.css` (la rampa de display con `clamp()` hasta 68 px, cuando ' +
        'esta app no pasa de 30) y 4 en `motion.css`. ── ⛔ Y UNA REGLA MUERTA DE VERDAD ── ' +
        '`.canvas-dot-grid`, la retícula del lienzo SVG de la calculadora. No había un solo nodo ' +
        'con esa clase, pero se construía igual: **el minificador se come los comentarios y no las ' +
        'reglas**, que es exactamente por lo que este presupuesto mide la hoja construida y no el ' +
        'fuente. Lo más elocuente es que esta app SÍ tiene retícula de puntos —de telón detrás del ' +
        'mapa— y la pinta con otro color a propósito, porque el `--color-dot-grid` del sistema ' +
        'está calibrado para lienzo blanco y sobre el #f1f5f9 del mapa es invisible: si aquella ' +
        'regla se hubiera usado, no se habría visto. ── ⛔ EL TEMA OSCURO ESTABA COMPLETO Y MUERTO ' +
        '── ~45 tokens bajo `html[data-theme="dark"]`, y `data-theme` **no aparecía en ningún ' +
        '`.js`, `.html` ni en `app.css`**: solo en el selector que lo declaraba. Se RETIRA, y el ' +
        'motivo se midió antes de decidir: la app tiene ~150 hex literales cableados en 15 ' +
        'ficheros de `viewer/`, `report/` y `export/`, porque `viewer/*` no puede importar CSS por ' +
        'contrato —tiene que leerse sobre una ortofoto aunque la hoja no cargue—. Un tema que no ' +
        'llega al mapa, ni a los cuatro cajones, ni al PDF, ni al DXF es medio tema; y la paleta ' +
        'oscura que había se diseñó para leerse sobre un lienzo, no sobre una ortofoto. Queda en ' +
        'el git y `DESIGN.md` declara la app como de tema CLARO, con este motivo. ── EL REPARTO DE ' +
        'LOS 4.552 B ── 3.961 los 71 tokens y la regla muerta; 591 el bloque oscuro. Es poco por ' +
        'variable (~56 B) y es la lección del asiento: **los tokens muertos no engordan la hoja, ' +
        'la ensucian.** Lo que se compra aquí no son bytes, son los 37 nombres que hablaban de ' +
        'otro producto. ── ⚠️ LO QUE CASI SALIÓ MAL ── `--dot-grid-size` entró en la lista de ' +
        'muertos al preparar la medición y **está vivo**: lo usa `.gml-app .gml-mapa` para el paso ' +
        'de la retícula del telón. Lo cazó verificar los 72 candidatos uno a uno con `grep` antes ' +
        'de borrar, en vez de fiarse del barrido que los encontró — el barrido acertaba (nunca lo ' +
        'listó), la mano al copiar la lista no. Se anota porque la primera medición de esta poda ' +
        'salió a −4.605 B, sobre un árbol donde una `var()` viva apuntaba a la nada. ── ⭐ Y CIERRA ' +
        'LA QUINTA REBANADA ── El techo pasa de los 42.064 B de F11 a estos 57.906, o sea a la ' +
        'medición de hoy, y cambia de forma («no más de» en vez de «menos de»). El razonamiento ' +
        'entero está en {@link TECHO}: contra aquel número, que era el tamaño de la aplicación de ' +
        'F11, se han medido después once features y una cáscara nueva. La consecuencia buscada es ' +
        'que **desde este asiento cualquier subida pone el script rojo** y hay que decidirla. La ' +
        'deuda dejó de ser deuda: 4.394 pruebas del proyecto `node` en verde. Holgura: 0 B, en el ' +
        'techo exacto.' },
    { hito: 'F15 · el diccionario de errores de la Sede (y tres tokens que no existían)',
      commit: '(sin commitear)',
      total: 75308, nuestro: 60213, rebanada: null,
      nota:
        '**+2.307 B, y es el PRIMER asiento que sube el techo con el mecanismo del asiento ' +
        'anterior**, que dejó holgura 0 justamente para que esto tuviera que decidirse a mano. La ' +
        'atribución no es una estimación: se construyeron **las dos versiones el mismo día** y la ' +
        'hoja sin F15 mide **57.906 B clavados**, o sea el asiento anterior exacto. El delta es ' +
        'entero de esta fase y no arrastra nada de nadie. ── QUÉ SE PAGA ── Una PANTALLA NUEVA ' +
        'cuyo interior no existía en esta aplicación: lista buscable de 23 fichas plegables, dos ' +
        'insignias por ficha, y un tinte que separa lo MEDIDO contra la Sede de lo que solo dice ' +
        'un foro. La CÁSCARA no cuesta un byte —caja, velo, cuerpo, título, intro y pie entran en ' +
        'las listas de selectores que ya existían, mismo reparto que F21 y F14—, así que estos ' +
        '2.307 B son el componente y nada más. ── ⭐ SE DEVOLVIERON 577 B ANTES DE PEDIR LA SUBIDA ' +
        '── La primera medición fue +2.884. Se fundieron cinco reglas que eran la misma escrita ' +
        'varias veces, y ⛔ **dos ya estaban duplicadas ANTES de F15**: ' +
        '`.gml-dialogo-importacion-bloqueo` (F18) y `.gml-dialogo-pegado-motivo` (F19) llevaban ' +
        'las mismas ocho declaraciones byte a byte. Se funden con la de F15 en una sola regla de ' +
        'tres selectores. ── ⛔ Y AHÍ SALIÓ EL HALLAZGO DE LA FASE EN ESTA HOJA ── Las dos ' +
        'arrastraban `var(--color-aviso, var(--color-border-main))` y **`--color-aviso` no está ' +
        'definido en ninguna parte**: durante meses sus comentarios prometían «el color de aviso y ' +
        'NO rojo» y lo que se pintaba era el gris del fallback. Un barrido de las cinco hojas ' +
        'destapó **tres** propiedades usadas y nunca definidas sobre 72 declaradas y 67 usadas, y ' +
        'la tercera era la cara: `--color-state-error` en `.gml-barra-menu-opcion--riesgo`, que es ' +
        '**«Vaciarlo»** —la única acción irreversible del menú de expediente—, pintada del color ' +
        'del texto normal y **tipográficamente indistinguible de «Expedientes guardados»**, que ' +
        'está justo encima. Las tres corregidas (`--color-state-warn` ×2, `--color-state-fail` ' +
        '×1) y custodiadas por `test/estilos/tokens-definidos.test.js`, nuevo. `var()` con ' +
        'fallback degrada EN SILENCIO y jsdom no resuelve `var()`: esto solo se ve leyendo el CSS ' +
        'como texto, que es por lo que el guardián es de disco y no de componente. ── ⚠️ NO CIERRA ' +
        'REBANADA (`rebanada: null`): el diccionario cuelga del menú de Expediente y no es una ' +
        'pantalla del rail. Las cinco siguen cerradas, así que el techo se sigue exigiendo.' },
  ].map((a) => Object.freeze({ ...a, vendor: a.total - a.nuestro })),
)

/**
 * Parte la hoja construida en lo nuestro y el vendor, **comprobando la costura
 * en cada lectura en vez de darla por buena**.
 *
 * Que Leaflet vaya al final es un hecho medido en doce builds, no una promesa
 * de Vite: el día que cambie el orden (o que alguien importe otra hoja de
 * terceros) este reparto atribuiría bytes ajenos a este proyecto y el
 * presupuesto pasaría a medir otra cosa **sin decirlo**. De ahí las dos
 * verificaciones: la marca aparece UNA vez, y detrás de ella no queda ni un
 * selector `.gml-`.
 *
 * @param {string} css Contenido de la hoja construida.
 * @returns {{total: number, nuestro: number, vendor: number}} Bytes UTF-8.
 * @throws {Error} Si la costura no se puede verificar.
 */
export function partirHoja(css) {
  const trozos = css.split(MARCA_VENDOR)
  if (trozos.length === 1) {
    throw new Error(
      `No se encuentra «${MARCA_VENDOR}» en la hoja construida: no se puede separar lo que ` +
        'escribe este proyecto de lo que trae Leaflet. Si se ha quitado Leaflet, el presupuesto ' +
        'entero cambia de escala y hay que rehacer la línea base (TECHO), no ajustar la marca.',
    )
  }
  if (trozos.length > 2) {
    throw new Error(
      `«${MARCA_VENDOR}» aparece ${trozos.length - 1} veces en la hoja construida y debería ` +
        'aparecer una: alguien ha escrito ese selector fuera de leaflet.css, o el vendor entra dos veces.',
    )
  }
  const cola = trozos[1]
  if (cola.includes(MARCA_NUESTRA)) {
    throw new Error(
      'Detrás del bloque de Leaflet hay selectores `.gml-`: el vendor ha dejado de ser el final ' +
        'de la hoja y este reparto atribuiría bytes de Leaflet a este proyecto. Hay que rehacer ' +
        'el corte antes de volver a fiarse de la cifra.',
    )
  }
  const total = Buffer.byteLength(css, 'utf8')
  const nuestro = Buffer.byteLength(trozos[0], 'utf8')
  return { total, nuestro, vendor: total - nuestro }
}

/**
 * Contrasta la medición con el registro.
 *
 * @param {{total: number, nuestro: number}} medido
 * @param {object} [opciones]
 * @returns {{ok: boolean, problemas: string[], ultimo: object, cerradas: string[],
 *            pendientes: string[], delta: {total: number, nuestro: number}}}
 */
export function comparar(medido, { asientos = ASIENTOS, techo = TECHO, rebanadas = REBANADAS } = {}) {
  const problemas = []
  const ultimo = asientos[asientos.length - 1]

  if (medido.total !== ultimo.total || medido.nuestro !== ultimo.nuestro) {
    const d = medido.nuestro - ultimo.nuestro
    problemas.push(
      `La hoja se ha movido y NADIE lo ha anotado: el último asiento («${ultimo.hito}») dice ` +
        `${bytes(ultimo.total)} (${bytes(ultimo.nuestro)} nuestros) y lo construido mide ` +
        `${bytes(medido.total)} (${bytes(medido.nuestro)} nuestros), ` +
        `${d >= 0 ? '+' : ''}${bytes(d)}. Añade el asiento en scripts/presupuesto-css.mjs ` +
        'con su hito y una línea diciendo qué ha cambiado.',
    )
  }

  const cerradas = rebanadas.filter((r) => asientos.some((a) => a.rebanada === r))
  const pendientes = rebanadas.filter((r) => !cerradas.includes(r))

  // El techo NO se exige durante la migración: el criterio 10 dice literalmente
  // que puede subir mientras dure. Solo muerde cuando las cinco pantallas están
  // anotadas, que es el momento en que el rework se declara terminado — y desde el
  // 2026-08-11 lo están.
  //
  // ⭐ **`>` Y NO `>=`, Y EL CAMBIO ES DELIBERADO (2026-08-11).** Hasta hoy esto era
  // `>=` y una prueba lo afirmaba con estas palabras: «justo EN el techo es rojo: el
  // criterio dice "menos de", no "como mucho"». Era correcto mientras el techo fue
  // la medición de F11, o sea una META POR DEBAJO: quedarse clavado en la línea de
  // salida no es haber bajado de ella.
  //
  // Con el techo rebasado a la medición de HOY (ver {@link TECHO}) el sentido se da
  // la vuelta: el techo ya no es una meta, es el sitio donde estamos, y la regla es
  // «no subas de aquí». Con `>=`, rebasarlo dejaría la hoja en falta el mismo
  // segundo de hacerlo —la medición sería exactamente el techo— y el guardián
  // nacería rojo sin que nada estuviera mal, que es la forma más rápida de que
  // alguien lo apague.
  //
  // ⛔ Lo que NO cambia es la dirección: un solo byte por encima sigue siendo rojo.
  // El operador se ha relajado en el punto de igualdad, no en la pendiente.
  if (pendientes.length === 0 && medido.nuestro > techo.nuestro) {
    problemas.push(
      `Las cinco rebanadas están cerradas y la hoja ha SUBIDO del techo del criterio 10: ` +
        `${bytes(medido.nuestro)} nuestros frente a los ${bytes(techo.nuestro)} de la línea ` +
        `declarada (${bytes(techo.total)} con Leaflet dentro). Sobran ` +
        `${bytes(medido.nuestro - techo.nuestro)}. Devuelve los bytes, o sube el techo A MANO ` +
        'en scripts/presupuesto-css.mjs escribiendo al lado por qué vale la pena.',
    )
  }

  return {
    ok: problemas.length === 0,
    problemas,
    ultimo,
    cerradas,
    pendientes,
    delta: { total: medido.total - techo.total, nuestro: medido.nuestro - techo.nuestro },
  }
}

/**
 * Bytes con separador de millares español, que es como están escritas todas las
 * cifras del repositorio.
 *
 * `useGrouping: 'always'` no es adorno: en español el separador de millares NO
 * se pone por defecto en números de cuatro cifras, así que sin él este medidor
 * escribiría «3949 B» al lado de «61.108 B» y los dos números parecerían venir
 * de sitios distintos.
 */
export function bytes(n) {
  return `${n.toLocaleString('es-ES', { useGrouping: 'always' })} B`
}

/**
 * El informe que se imprime. Se separa de la E/S para poder probarlo sin `dist/`.
 *
 * @returns {string}
 */
export function informe(medido, veredicto, { techo = TECHO } = {}) {
  // En valor absoluto: el signo ya lo dice la palabra («por encima»/«por debajo»),
  // y «-9,4 % por debajo» se lee como lo contrario de lo que es.
  const pct = (a, b) => `${(Math.abs((a - b) / b) * 100).toFixed(1).replace('.', ',')} %`
  const lineas = [
    '─ Presupuesto de la hoja construida (Rework de UI · T10) ────────────────',
    `  Hoja entera        ${bytes(medido.total)}`,
    `  · de este proyecto ${bytes(medido.nuestro)}   ← la cifra presupuestada`,
    `  · de Leaflet       ${bytes(medido.vendor)}   (vendor: no lo escribimos ni lo podemos encoger)`,
    '',
    `  Techo (criterio 10) ${bytes(techo.nuestro)} nuestros / ${bytes(techo.total)} con vendor`,
    // ⚠️ Los TRES casos, y el de en medio se estrenó el 2026-08-11: desde que el
    // techo es la medición de hoy, «clavado en el techo» es el estado NORMAL y no
    // una casualidad. Con dos ramas decía «SOBRAN 0 B (0,0 % por encima)», que
    // suena a falta y es lo contrario: es exactamente cumplirlo.
    veredicto.delta.nuestro === 0
      ? '  Hoy está CLAVADO   en el techo: 0 B de holgura, y un byte más es rojo.'
      : veredicto.delta.nuestro > 0
        ? `  Hoy SOBRAN          ${bytes(veredicto.delta.nuestro)}  (${pct(medido.nuestro, techo.nuestro)} por encima)`
        : `  Hoy hay holgura de  ${bytes(-veredicto.delta.nuestro)}  (${pct(medido.nuestro, techo.nuestro)} por debajo)`,
    '',
    `  Último asiento      ${veredicto.ultimo.hito} — ${bytes(veredicto.ultimo.total)}`,
    `  Rebanadas cerradas  ${veredicto.cerradas.length}/${veredicto.cerradas.length + veredicto.pendientes.length}${
      veredicto.pendientes.length > 0 ? ` (faltan: ${veredicto.pendientes.join(', ')})` : ''
    }`,
  ]
  if (veredicto.pendientes.length > 0) {
    lineas.push('  El techo NO se exige hasta que las cinco estén cerradas (criterio 10).')
  }
  return lineas.join('\n')
}

// ── De aquí abajo, solo E/S ──────────────────────────────────────────────────

/**
 * Localiza la hoja construida y se niega a medir una que esté vieja.
 *
 * Medir un `dist/` anterior al último cambio de CSS daría una cifra plausible y
 * FALSA, que es el peor resultado posible para un guardián. Ya pasó a mano
 * mientras se escribía T10: `dist/` de las 16:18 y `estilos/app.css` de las
 * 14:53 parecían coherentes y no lo eran.
 */
function localizarHoja() {
  const dir = join(RAIZ, 'dist', 'assets')
  if (!existsSync(dir)) {
    throw new Error('No hay `dist/`. Corre `npm run build` y vuelve: el presupuesto se mide sobre el artefacto, no sobre la fuente.')
  }
  const hojas = readdirSync(dir).filter((n) => n.endsWith('.css'))
  if (hojas.length !== 1) {
    throw new Error(
      `Se esperaba UNA hoja en dist/assets y hay ${hojas.length} (${hojas.join(', ') || 'ninguna'}). ` +
        'Con más de una, el reparto nuestro/vendor deja de tener sentido y hay que decidir qué se presupuesta.',
    )
  }
  const ruta = join(dir, hojas[0])
  const construida = statSync(ruta).mtimeMs

  const fuentes = [join(RAIZ, 'node_modules', 'leaflet', 'dist', 'leaflet.css')]
  const cola = [join(RAIZ, 'estilos')]
  while (cola.length > 0) {
    const d = cola.pop()
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) cola.push(p)
      else if (e.name.endsWith('.css')) fuentes.push(p)
    }
  }
  const masNueva = fuentes
    .filter((f) => existsSync(f))
    .map((f) => ({ f, t: statSync(f).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0]

  if (masNueva && masNueva.t > construida) {
    throw new Error(
      `La hoja construida es MÁS VIEJA que «${masNueva.f.slice(RAIZ.length + 1)}». La cifra sería ` +
        'plausible y falsa. Corre `npm run build` antes de medir.',
    )
  }
  return { ruta, css: readFileSync(ruta, 'utf8') }
}

function principal() {
  let medido
  try {
    const { css } = localizarHoja()
    medido = partirHoja(css)
  } catch (err) {
    console.error(`⛔ NO SE HA PODIDO MEDIR: ${err.message}`)
    return 2
  }
  const veredicto = comparar(medido)
  console.log(informe(medido, veredicto))
  if (veredicto.ok) {
    console.log('\n✅ La hoja coincide con el último asiento.')
    return 0
  }
  console.error('')
  for (const p of veredicto.problemas) console.error(`⛔ ${p}`)
  return 1
}

// ¿Me están ejecutando, o me está importando un test? Se compara la ruta de
// este módulo con la que node recibió por argumento.
//
// ⚠️ La comparación es SIN DISTINGUIR MAYÚSCULAS a propósito, y no es pereza:
// este repositorio arrastra el bug de casing de la unidad en Windows (`e:` vs
// `E:`, documentado en `vitest.config.js` y en `vite.config.js`). Con una
// comparación estricta, invocar el script desde un cwd con la unidad en
// minúscula no ejecutaría NADA y saldría con código 0: un guardián que se salta
// solo, otra vez.
const esteFichero = fileURLToPath(import.meta.url)
const invocado = process.argv[1] ? resolve(process.argv[1]) : ''
if (esteFichero.toLowerCase() === invocado.toLowerCase()) {
  process.exit(principal())
}
