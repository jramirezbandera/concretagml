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
 *      —«informe»— **está sin cerrar A PROPÓSITO** desde `3e9c8b0`: su producto
 *      está hecho, y no se declara cerrada porque hacerlo hace exigible el techo
 *      del criterio 10 y la hoja no llega. Con la lista recortada a tres, las
 *      tres quedaban cerradas y el techo empezaba a morder **por un cambio de
 *      navegación**, no porque nadie hubiera decidido nada sobre bytes. Medido
 *      ese día: 55.018 B nuestros contra 42.064 B exigidos, 12.954 B de más.
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
 * Los dos números son **la medición exacta de `960bb7a` (F11)**, que es la
 * línea base declarada del rework: el criterio pide acabar por debajo de donde
 * se empezó.
 */
export const TECHO = Object.freeze({ total: 57159, nuestro: 42064 })

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
  // anotadas, que es el momento en que el rework se declara terminado.
  if (pendientes.length === 0 && medido.nuestro >= techo.nuestro) {
    problemas.push(
      `Las cinco rebanadas están cerradas y la hoja NO ha bajado del techo del criterio 10: ` +
        `${bytes(medido.nuestro)} nuestros frente a los ${bytes(techo.nuestro)} exigidos ` +
        `(${bytes(techo.total)} con Leaflet dentro). Sobran ${bytes(medido.nuestro - techo.nuestro)}.`,
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
    veredicto.delta.nuestro >= 0
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
