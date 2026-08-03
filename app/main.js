// app/main.js — F03 · Fase 4, Tarea 4B.1. EL ARRANQUE DE LA APP.
//
// Sustituye la sonda de build de la tarea 4A.1. Es la ENTRADA de Vite y el
// ÚNICO sitio del proyecto que ensambla la aplicación completa: coge las cajas
// vacías que declara `index.html` y las convierte en la pantalla viva.
//
// ── QUÉ ENSAMBLA, Y EN QUÉ ORDEN (el orden importa, y aquí está el por qué) ──
//   1. DATOS      — `parcelaDemo()` (o `parcelaDemoConHueco()` con `?demo=hueco`)
//                   de `./demo-datos.js`. Un POJO de parcela, en UTM.
//   2. ESTADO     — `crearEstadoVista(parcela)` + `crearHistorial()`. **LOS CREA
//                   LA APP, NO EL VISOR** (ver más abajo: es la razón de ser de
//                   la ficha del pie, y desde F06 también la del undo/redo). El
//                   historial se SIEMBRA aquí mismo con un `commit` del estado
//                   inicial; el porqué está en el apartado de F06.
//   3. PANEL      — `crearPanelAvisos(...)` de `./avisos.js`. Va ANTES del visor
//                   porque el visor necesita su `avisar` como `alAvisar`: si se
//                   creara después, los avisos del PRIMER encuadre (una tesela
//                   del IGN que no carga, la imagen WMS que falla) se irían al
//                   `console.warn` por defecto y el usuario no vería nada.
//   4. FICHA      — los nodos del pie, {@link actualizarFicha}, su suscripción al
//                   store y una primera llamada a mano (`subscribe` NO notifica
//                   al suscribirse).
//                   ⚠️ Va ANTES del visor DESDE F06, y no por gusto: el visor
//                   recibe `alPrevisualizar` —el canal en vivo del arrastre— y lo
//                   LLAMA durante su propia construcción (`crearVisor` abre el
//                   puente y fuerza un render justo tras el encuadre). Con la
//                   ficha montada después, esa primera llamada encontraría los
//                   nodos en la zona muerta del `const` y reventaría dentro del
//                   `try` de `sincronizacion.js`: un aviso espurio en cada
//                   arranque. Hasta F05 daba igual y estaba la sexta.
//   5. VISOR      — `crearVisor(...)` de `../viewer/index.js`. Monta mapa +
//                   capas + tabla de vértices, la EDICIÓN de F06 (`edicion:` y su
//                   capa de acotaciones), el DIAGNÓSTICO de F07 (`diagnostico:`,
//                   el cajón y la capa de contraste, los dos inertes hasta que
//                   los cablee el paso 8), el cajón de COMPROBACIÓN de F08
//                   (`comprobacion:`, inerte hasta el paso 9), la capa de
//                   PARCELAS VECINAS (`colindantes:`, vacía hasta que el paso 7
//                   le pase las que traiga el Catastro) y encuadra sobre la
//                   geometría.
//   6. EDICIÓN    — `cablearEdicion(...)` (F06, tarea T5.1): deshacer/rehacer con
//                   sus atajos, la casilla y la tolerancia del snap, el offset y
//                   el renglón `[data-estado="edicion"]`. Va DESPUÉS del visor
//                   porque consume `visor.edicion` (la interacción de
//                   `viewer/edicion.js`), y ANTES del Catastro porque ese le
//                   entrega dos ganchos suyos (ver el apartado de F06).
//   7. CATASTRO   — `cablearCatastro(...)` de `./cableado-catastro.js` (F05,
//                   tarea T4A), con las cuatro piezas que ese módulo exige ya
//                   hechas: transporte, base, caché y cliente. Va DESPUÉS del
//                   visor porque le pasa su `L.Map` (un clic en el mapa deduce
//                   la referencia), y ANTES del GML porque traer una parcela
//                   hace `estado.set` y de ese store sale el estado del botón
//                   «Generar GML».
//   8. DIAGNÓSTICO— `cablearDiagnostico(...)` de `./cableado-diagnostico.js`
//                   (F07, tarea T5.1): el CTA «Diagnosticar encaje», el cajón
//                   sobre el mapa y la capa de contraste. Va DESPUÉS del visor
//                   (le consume `visor.diagnostico`) y DESPUÉS del Catastro
//                   (para pedirle las colindantes de la invasión), que son sus
//                   dos dependencias. Y va ANTES del GML por lo mismo que la
//                   ficha: es una vista más del expediente, y el paso 10 es el
//                   que cierra el recorrido.
//                   ⚠️ Fuera del `try` del Catastro y sin `try` propio, como la
//                   edición: si el cliente del Catastro no se ha podido montar
//                   se diagnostica IGUAL —ocho de las nueve medidas no dependen
//                   de la red— y lo único que se pierde es la invasión, que el
//                   cajón dice en voz alta que no ha consultado.
//   9. COMPROBACIÓN—`cablearComprobacion(...)` de `./cableado-comprobacion.js`
//                   (F08, tarea T5.1): la entrada por fichero —el botón «Abrir
//                   un GML…» de la fila del rótulo y el arrastre sobre la
//                   VENTANA ENTERA—, el cajón que dice qué es ese `.gml` y qué
//                   le pasa, y el único `estado.set` que mete su parcela en el
//                   expediente. Tiene TRES dependencias y por eso va aquí:
//                     · DESPUÉS del visor, porque le consume `visor.comprobacion`
//                       (el cajón de F08, que es la pieza SUELTA del visor y no
//                       va envuelta como `diagnostico`);
//                     · DESPUÉS del Catastro, porque le pide el `cliente` para
//                       traer el parcelario con el que contrastar — el cliente,
//                       no el cableado: llamar a `cablearCatastro().cargar()`
//                       haría un `estado.set` con la geometría del WFS y
//                       BORRARÍA la del fichero, que es justo lo que hay que
//                       contrastar (ver la cabecera de aquel módulo);
//                     · DESPUÉS del diagnóstico, por dos motivos distintos: para
//                       que el CTA «Diagnosticar encaje» YA EXISTA cuando llegue
//                       la parcela del fichero —el recorrido de F08 termina
//                       encendiendo F07, y el destino no puede cablearse después
//                       que su origen—, y para poder pasarle
//                       `visor.diagnostico.cajon`: los dos cajones comparten la
//                       esquina `bottomleft` y son MUTUAMENTE EXCLUYENTES, así
//                       que abrir el de comprobación cierra el de F07.
//                   ⚠️ Fuera del `try` del Catastro y sin `try` propio, igual
//                   que la edición y el diagnóstico: si el cliente no se pudo
//                   montar, **se comprueba el fichero igual** —leer bytes,
//                   decodificar, parsear, validar y cargar la geometría no
//                   necesitan la red— y lo único que se pierde es el parcelario,
//                   que el cableado dice en voz alta que no ha pedido
//                   (`MOTIVO_SIN_CLIENTE`). Por eso lo que se le pasa es
//                   {@link clienteCatastro}, que vale `null` cuando el bloque
//                   del paso 7 se cayó, y `null` ahí es una respuesta prevista.
//                   El enlace con F07 —que el informe de contraste cuente lo que
//                   se leyó del fichero— está en el paso 8: ver
//                   {@link comprobacionCableada}.
//  10. GML        — `cablearGeneracionGml(...)` (F04, tarea T6.1). Necesita las
//                   dos piezas anteriores: el store (de él sale la geometría que
//                   se serializa, y de sus notificaciones el estado del botón) y
//                   el panel (es donde se publican las detecciones del
//                   serializador). Como la ficha, se suscribe y además se llama a
//                   mano una primera vez.
//  11. INFORME    — `cablearInforme(...)` de `./cableado-informe.js` (F09, tarea
//                   T5.1): el botón PRIMARIO del pie del cajón de diagnóstico
//                   («Preparar informe (PDF)»), el diálogo que recoge el
//                   encabezado, el lindero y el pie de firma, y el recorrido que
//                   termina con los bytes del PDF en la carpeta de descargas.
//                   Va EL ÚLTIMO porque es el que más dependencias tiene, y las
//                   tiene TODAS de pasos anteriores:
//                     · el store (paso 2) — es su SEXTO suscriptor;
//                     · el cajón de F07 (paso 5), de donde sale el botón;
//                     · el DIAGNÓSTICO del paso 8, que le presta su
//                       `ultimoDiagnostico()`: el informe imprime exactamente las
//                       cifras que el cajón está enseñando, no unas recalculadas;
//                     · el CLIENTE del Catastro (paso 7) para el servicio
//                       descriptivo (`Consulta_DNPRC`), que es el +1 de petición
//                       que cuesta toda F09;
//                     · el cableado del Catastro (paso 7) solo para SUSCRIBIRSE a
//                       las colindantes: con ellas `report/literal.js` atribuye
//                       cada lindero, y sin ellas lo dice;
//                     · la COMPROBACIÓN del paso 9, si la parcela vino de un
//                       fichero, por el mismo envoltorio que usa el paso 8.
//                   ⚠️ Sin `try` propio, igual que los pasos 6, 8 y 9: lo único
//                   que puede lanzar aquí es un contrato del programador. Lo que
//                   sí está previsto —que el Catastro o el almacén local no se
//                   hayan podido montar— entra como `null` y el informe se prepara
//                   igual, diciendo qué no se ha consultado.
//  12. EXPEDIENTE — `cablearExpediente(...)` de `./cableado-expediente.js` (F10,
//                   tarea T5.1): el botón «Expediente» de la fila del rótulo, su
//                   diálogo, el almacén local de IndexedDB, el autoguardado y las
//                   tres exportaciones (DXF, listado de coordenadas y fichero de
//                   proyecto). **Es donde la aplicación empieza a recordar** y
//                   donde `crearExpediente` estrena llamante en producción — hasta
//                   aquí el store llevaba una Parcela suelta y el `srs` era una
//                   constante de módulo, exactamente lo que la cabecera de
//                   `./demo-datos.js` lleva pidiendo desde F03.
//                   Va DESPUÉS de todo porque consume piezas de cuatro pasos: el
//                   store (paso 2, del que es el SÉPTIMO suscriptor), el gancho de
//                   la edición (paso 6), la CACHÉ del Catastro (paso 7, y solo
//                   para purgarla cuando falte espacio) y la comprobación (paso 9,
//                   para que «Abrir un proyecto…» use la ÚNICA zona de fichero de
//                   la aplicación en vez de fabricar una segunda).
//                   ⚠️ Sin `try`, igual que los pasos 6, 8, 9 y 11, y con un
//                   motivo de más: es el ÚLTIMO, así que un `catch` no protegería
//                   a nadie — lo que hay debajo ya está montado.
//
// ── POR QUÉ EL STORE LO CREA ESTA FUNCIÓN Y NO `crearVisor` ─────────────────
// `viewer/index.js` documenta que recibe el store ya hecho y NO lo fabrica, para
// que el llamante pueda COMPARTIRLO con otras vistas. Hasta ahora eso era una
// promesa sobre F05/F06; la ficha del pie de este fichero lo convierte en un
// hecho comprobable en producción: es un SEGUNDO suscriptor del MISMO store que
// el mapa y la tabla, y por eso existe. Se edita una coordenada en la tabla →
// `sincronizar` hace `estado.set` → se repintan el polígono del mapa Y la
// superficie del pie, sin que ninguna de las dos vistas sepa de la otra.
//
// ── POR QUÉ SE IMPORTA `viewer/index.js` DIRECTAMENTE Y NUNCA EL BARREL RAÍZ ─
// El barrel raíz `index.js` NO exporta el visor A PROPÓSITO (hallazgo C1/T10):
// `viewer/` y `services/` importan Leaflet, que exige `window`, y el barrel lo
// carga el proyecto Vitest `node`, que corre sin DOM. `test/contrato.test.js`
// vigila ese invariante y su comentario nombra LITERALMENTE esta tarea (la
// entrada demo de la Fase 4) como el momento en que alguien va a querer
// «exportar el visor por el barrel para que la demo lo importe bonito». No se ha
// hecho: aquí se importa `../viewer/index.js`.
//
// La comprobación de cierre de esta tarea es un grep sobre `app/` buscando
// importaciones del barrel raíz, y tiene que salir VACÍO. Por eso este párrafo
// describe el patrón en vez de escribirlo: un comentario que cita el patrón
// literal se convierte él mismo en una coincidencia y convierte un «cero duro»
// en un «cero salvo este falso positivo que hay que leer cada vez».
//   @see test/contrato.test.js  →  describe('contrato F03 · el visor NO sale por
//                                  el barrel raíz (Leaflet exige window)')
//
// ── F04 · LO QUE ESTA CAPA DECIDE Y `gml/` NO PUEDE DECIDIR ─────────────────
// `gml/` es capa de DOMINIO: no importa `model/`, no toca el DOM y no consulta
// el reloj. Eso deja cuatro decisiones huérfanas que sólo pueden tomarse aquí, y
// las cuatro están tomadas en {@link cablearGeneracionGml}:
//
//   1. LA FECHA. El reloj se lee AQUÍ, en `ahora()`, y el MISMO instante va al
//      nombre del fichero. Lo que NO baja es un `beginLifespanVersion`: en el
//      perfil de entrega ese elemento sale con `xsi:nil`, como en la plantilla
//      oficial del Catastro, porque la vigencia de la versión del objeto la fija
//      el Catastro al inscribir, no el declarante al subir (ver
//      `gml/serialize-cp.js`, decisión 3). Que `gml/` no consulte el reloj sigue
//      siendo la regla, y es lo que permite que el test de ida y vuelta compare
//      un GML entero contra un snapshot.
//
//   2. LA IDENTIDAD. `serializarParcelaCp` EXIGE `refcat` y no se la inventa;
//      `model/parcela.js` tiene `refcat` (que puede ser `null`) y `idLocal` (que
//      nunca lo es). Resolver `refcat ?? idLocal` es de esta capa, y por eso
//      `gml/` no necesita importar `model/`.
//
//   3. LA IDENTIDAD INSPIRE — `namespaceInspire` + `nationalCadastralReference`.
//      ⚠️ CORREGIDO el 2026-07-27. Aquí se fijaba `ES.LOCAL.CP` SIEMPRE y
//      `nationalCadastralReference` vacío, razonando que rellenarlo «convertiría
//      un alta en una declaración falsa de inscripción». El razonamiento tenía
//      buena intención y la conclusión era incoherente: con una referencia
//      catastral real de `localId` bajo `ES.LOCAL.CP`, el fichero afirmaba a la
//      vez «esta es su referencia catastral» y «esta parcela no está en el
//      Catastro». La FAQ del Catastro empareja los dos campos y no los deja
//      elegir por separado. Ver {@link identidadInspireDe}.
//
//   4. EL PERFIL DEL FICHERO. `PERFIL.ENTREGA`, explícito. Es la decisión que
//      hace que la Sede acepte el fichero en vez de rechazarlo, y no puede
//      quedarse dependiendo del valor por omisión de otro módulo.
//
//   5. LA TRADUCCIÓN DE SEVERIDADES. `gml/` habla de tres (INFO/AVISO/ERROR) y
//      el panel de dos (ver {@link NIVEL_POR_SEVERIDAD}).
//
// ⚠️ `gml/descargar.js` se importa DIRECTAMENTE, igual que `viewer/index.js` y
// por el mismo motivo: necesita `Blob`/`URL`/`document`, así que está fuera del
// barrel `gml/index.js` (que sí carga el proyecto Vitest `node`, sin DOM). Ese
// motivo sigue intacto. Los otros módulos de `gml/` se siguen importando uno a
// uno, y aquí había escrito que así «el bundle no arrastra `gml/parse.js`, que
// hoy no usa nadie en la app (lo usará F08)».
//
// ⛔ ESA MITAD ERA FALSA YA CUANDO SE ESCRIBIÓ, y se corrige en vez de borrarse
// porque el error de razonamiento es más instructivo que el dato.
// **`gml/parse.js` está en el bundle DESDE F05**: lo importa
// `services/_catastro-wfs.js` para leer la respuesta del WFS. Lo que era cierto
// es que no lo usaba nadie en la CAPA DE APLICACIÓN — y de ahí se saltó, sin
// medirlo, a «el bundle no lo arrastra», que es otra afirmación. Al cerrar F08 se
// midió de verdad, atribuyendo los dos paquetes por sourcemap contra el de F07
// reconstruido desde `a0e2a9d`: **15,78 kB en los dos, delta 0,00 kB.** Un módulo
// que ya estaba no puede volver a entrar.
//
// Lo que F08 sí cuesta, medido igual: el bundle pasa de 481,93 kB (F07) a
// 550,31 kB de JS (**+68,38 kB**; 177,93 kB en gzip), y son los SIETE módulos
// nuevos —encabezados por `report/contraste-texto.js` (+17,54) y
// `viewer/cajon-comprobacion.js` (+13,29)—, más `gml/decodificar.js`,
// `comprobacion/`, `app/zona-fichero.js` y el cableado. El CSS (45,95 kB) y el
// HTML (25,44 kB) también se mueven, y son de la cáscara y del cromo del cajón.
//
// La lección, que no es sobre bundles: «no lo usa nadie **aquí**» y «no está en
// el paquete» son dos afirmaciones distintas, y la segunda solo se sabe midiendo.
// Es la regla de oro 8 en pequeño, y el mismo salto de razonamiento que costó el
// rechazo del IVG (SPEC §3.1).
//
// Importar uno a uno en vez de por el barrel se conserva, pero por lo único que
// queda en pie: `gml/index.js` publica además `serialize-cp`, `anillos`, `ids` y
// el vocabulario entero, y esta capa solo usa cuatro cosas.
//
// ── F05 · LO QUE ESTA CAPA DECIDE AL ENCHUFAR EL CATASTRO ───────────────────
// `app/cableado-catastro.js` sabe hablar con el campo, los botones y el store,
// pero EXIGE el cliente ya hecho y sin valor por defecto: crearlo dentro
// decidiría por el llamante el transporte, la caché y el reloj (y en un test
// tocaría la red de verdad). Esta es la capa que puede decidirlo, y decide:
//
//   1. EL CANAL DE AVISOS ES UNO SOLO. El MISMO `panel.avisar` va al transporte,
//      a `abrirBd`, a la caché y al cliente. No se fabrica ningún avisador
//      extra, y el reparto ya está pensado para que el usuario no lea lo mismo
//      dos veces: `_red.js` avisa del fallo de RED, `services/catastro.js` NO
//      avisa por sus resultados (los devuelve, y el cableado los publica), y la
//      caché avisa de lo suyo, que es lo único que no cabe en ningún resultado.
//      `abrirBd` MEMOIZA su promesa, así que su `alAvisar` lo fija la primera
//      llamada: tiene que ser esta, la del arranque, o los fallos del almacén
//      acabarían en el `console.warn` por defecto.
//
//   2. NO SE ESPERA A INDEXEDDB. `abrirBd()` devuelve una promesa y se le pasa
//      SIN `await` a `crearCacheCatastro`, que la acepta tal cual a propósito y
//      la resuelve sola en su primera operación. Es lo que hace que una base
//      lenta —o un navegador con el almacenamiento denegado, o una pestaña
//      vieja bloqueando la versión— no retrase ni impida que se vea el mapa. La
//      caché es una OPTIMIZACIÓN: la app arranca y funciona aunque no haya base
//      nunca (entonces se comporta como `CACHE_NULA` y lo dice por el panel).
//
//   3. EL CATASTRO NO PUEDE TUMBAR EL ARRANQUE. Todo el bloque va en un `try`
//      cuyo `catch` NO relanza — la segunda excepción de este fichero, y por la
//      misma razón que la primera (ver el `catch` de `refrescar`): F05 añade una
//      VÍA DE ENTRADA, no sustituye la que hay, y si al preparar la conexión
//      revienta algo (el entorno sin `fetch`, un nodo del contrato que ya no
//      está en `index.html`), lo que no puede pasar es que se lleve por delante
//      el mapa, la tabla, la ficha y el botón «Generar GML» — que se cablea
//      DESPUÉS y con la geometría que ya está en el store. El defecto no se
//      tapa: va al panel como ERROR y a la consola, y los dos botones del bloque
//      se APAGAN, porque un botón vivo que no hace nada al pulsarlo es
//      exactamente el error silencioso que este proyecto no admite.
//      ⚠️ Ese `try` protege el CABLEADO, no el IMPORT: `cableado-catastro.js`
//      tiene un guardián de carga que lanza si el catálogo de motivos del
//      cliente crece y a él no le escriben el resumen. Es deliberadamente fatal
//      (su comentario explica por qué) y ocurre antes de que aquí se ejecute
//      nada; no se intenta neutralizar desde este fichero.
//
//   4. LA PROCEDENCIA DEL DATO NO SE MAQUILLA, y eso ahora incluye el eyebrow.
//      `index.html` nace diciendo «Parcela cargada», que hasta F05 era vago y a
//      partir de F05 sería FALSO: con un campo para traer parcelas del Catastro
//      al lado, ese rótulo se lee como «esta viene del Catastro» cuando lo que
//      hay en pantalla al abrir es el dataset de DEMOSTRACIÓN de
//      `./demo-datos.js`. Así que el rótulo pasa a escribirlo SIEMPRE la ficha
//      (ver {@link rotuloDelDato}), con los tres estados que de verdad existen.
//      Es la misma regla por la que `demo-datos.js` no le añade un patio a la
//      parcela real: un dato inventado no se presenta como uno del Catastro, y
//      uno del Catastro tampoco se presenta como una demostración.
//
// ── F06 · LO QUE ESTA CAPA DECIDE AL ENCHUFAR LA EDICIÓN ────────────────────
// `edit/` sabe geometría, `viewer/edicion.js` sabe gestos y `edit/historial.js`
// sabe apilar instantáneas; ninguno de los tres sabe cuándo empieza un documento
// ni qué tecla lo deshace. Eso se decide aquí, y son SEIS decisiones:
//
//   1. EL HISTORIAL SE SIEMBRA EN EL ARRANQUE. `crearHistorial()` deja la pila
//      vacía con `indice: -1`, y `puedeDeshacer` exige `indice > 0`. Sin sembrar,
//      el PRIMER `commit` del usuario caería en el índice 0 y su primera edición
//      sería IRREVERSIBLE, con el botón «Deshacer» apagado y sin nada que
//      explicara por qué. Un `commit(historial, estado.get())` justo después de
//      crearlo convierte el estado inicial en un destino legítimo al que volver.
//      Es la misma razón por la que `reiniciar` siembra en vez de vaciar (ver su
//      JSDoc en `edit/historial.js`).
//
//   2. DESHACER REVIERTE EDICIONES, NUNCA «LA PARCELA QUE TRAJE». Cargar una
//      parcela del Catastro es abrir un documento nuevo, así que el gancho
//      `alCargarParcela` REINICIA el historial en vez de commitear encima. Un
//      `Ctrl+Z` que devolviera la parcela anterior —cambiando la referencia
//      catastral que hay en pantalla, y con ella el GML que se generaría— sería
//      un error silencioso disfrazado de función. Ver {@link cablearEdicion}.
//
//   3. UNDO/REDO NO COMMITEAN. Navegar por el historial hace `estado.set(clon)` y
//      nada más: es la propia pila la que lleva la cuenta con su `indice`, y
//      commitear al deshacer haría que deshacer fuera, él mismo, una operación
//      deshacible — el bucle clásico. Que el `set` no ensucie la pila NO se da
//      por hecho: se comprueba en la suite (ningún suscriptor del store
//      commitea; `aplicarVertice` y `aplicarRecintos` commitean por su cuenta
//      DESPUÉS de escribir, y ninguno de los dos pasa por aquí).
//
//   4. LOS ATAJOS SE CALLAN DENTRO DE UN CAMPO. `Ctrl+Z` sobre un `<input>` es el
//      deshacer del NAVEGADOR sobre el texto que se está escribiendo, y las
//      celdas de coordenada de la tabla de vértices SON inputs. Robárselo para
//      revertir la geometría mientras el usuario corrige un dígito sería un fallo
//      grave y difícil de contar. Ver {@link esCampoDeTexto}.
//
//   5. LA TOLERANCIA SE TECLEA EN CENTÍMETROS Y EL MODELO ESTÁ EN METROS. La
//      conversión es de ESTA capa (`index.html` lo dice y pide expresamente que
//      no se «arregle» a metros), y quien manda en el arranque es el HTML: ver
//      {@link cablearEdicion} para cómo se atan las dos cifras.
//
//   6. LAS MEDIDAS DE LA FICHA TIENEN UN SOLO ORIGEN Y UN SOLO PINTOR.
//      Superficie, perímetro, Δ y recuento de vértices salen TODOS de
//      `edit/metricas.js` y se pintan con la MISMA función ({@link pintarMedidas})
//      la llame el suscriptor del store (geometría ya asentada) o el canal en
//      vivo del arrastre (geometría en vuelo). Dos rutas de pintado para la misma
//      cifra acaban divergiendo, y la que divergiría es la que el usuario está
//      mirando mientras mueve el vértice.
//
// ── F06 · LAS COLINDANTES: LO QUE F05 DEJÓ SIN CABLEAR ──────────────────────
// La cabecera de F05 decía que `cablearCatastro().colindantes()` existía y que
// aquí no se llamaba, porque la cáscara no tenía ningún gesto para pedirlas. Ya
// lo tiene: `index.html` trae «Traer colindantes» y lo cablea
// `cableado-catastro.js`, que publica cada resultado por `alColindantes(fn)`.
// Esta capa hace TRES cosas con él, y ninguna es automática:
//   · **dianas de enganche** — `visor.edicion.fijarColindantes(recintos)`. Ojo:
//     ese método recibe RECINTOS y F05 devuelve PARCELAS, así que hay que aplanar
//     (`colindantes.flatMap((p) => p.recintos)`); pasarle parcelas LANZA a
//     propósito, porque en silencio no aportarían ni una diana y el snap
//     parecería roto sin motivo.
//   · **el recuento en la ficha** — `[data-ficha="colindantes"]` deja de decir
//     «Sin consultar» y dice cuántas hay (incluido «0», que después de preguntar
//     sí es una respuesta). Lo escribe {@link actualizarFicha} y no el cableado
//     del Catastro: la ficha sigue teniendo un solo dueño.
//   · **DIBUJARLAS** — `visor.colindantes.pintar(vecinas)`, con las parcelas SIN
//     APLANAR (la capa necesita la referencia catastral de cada una para su
//     emergente: es la MISMA forma que consume `diagnosticar()`). Faltaba, y era
//     un defecto de verdad: hasta el arreglo del check visual, pulsar «Traer
//     colindantes» dejaba el mapa EXACTAMENTE IGUAL mientras la ficha decía «12».
//     El dato se usaba por dentro; que no se viera es la regla de oro 1 rota.
//     Las tres cuelgan del mismo `alColindantes`, que es un `Set` de suscriptores
//     justo para esto (ver el paso 7).
// Lo que NO ha cambiado es por qué no se piden solas: sería una SEGUNDA petición
// por cada parcela que nadie ha pedido —lo que castiga la política de uso del
// servicio (override O8)— y el store no distingue «parcela recién traída» de
// «parcela editada», así que un disparo automático desde el suscriptor acabaría
// consultando el Catastro al mover un vértice.
//
// ── POR QUÉ ESTE FICHERO EXPORTA DOS FUNCIONES (y solo dos) ─────────────────
// Un módulo de entrada normalmente no exporta nada. El criterio para hacer una
// excepción es siempre el mismo: **se extrae lo que no se comprueba en ningún
// otro sitio y el usuario ve**. El resto de este fichero ya está cubierto (los
// datos, en `test/app/demo-datos.test.js`; el panel, en `avisos.dom.test.js`; el
// visor, en toda la suite de `test/viewer/`), y el ensamblaje entero se ejercita
// al importar el módulo desde las suites de abajo.
//
//   · `cablearGeneracionGml` (F04) — validar, serializar, publicar detecciones,
//     descargar y re-evaluar el botón.
//   · `cablearEdicion` (F06) — el historial (undo/redo, atajos, reinicio al
//     cargar parcela), los tres controles del bloque «Edición» y el renglón de
//     estado. Se extrae además por una razón que no tenía F04: dos de sus piezas
//     —`alCargarParcela` y `alColindantes`— son GANCHOS que se le entregan a
//     `cableado-catastro.js`, y sin extraerlas no habría forma de ejercitarlas
//     sin una consulta real al Catastro.
//
// La FICHA del pie NO se extrae: sus dos caminos de pintado se ejercitan a
// través del ensamblaje real (el canal en vivo se captura del doble de
// `crearVisor`, que recibe `alPrevisualizar`), y extraerla solo añadiría una
// costura por la que la ficha podría acabar teniendo dos dueños.
//   @see test/app/main-gml.dom.test.js
//   @see test/app/main-edicion.dom.test.js
//
// ── POR QUÉ EL CSS DE LEAFLET SE IMPORTA AQUÍ Y NO EN `viewer/` ─────────────
// `viewer/index.js` declara que NO importa `leaflet/dist/leaflet.css` a
// propósito: el visor es una LIBRERÍA y el CSS es responsabilidad de la ENTRADA
// de la aplicación, que es este fichero. Sin él, el mapa sale descuadrado
// (panes sin `position:absolute`, controles sin caja).
// La otra hoja, `estilos/app.css`, va por `<link>` en `index.html` y NO se
// importa aquí: así la cáscara está vestida en el primer pintado, sin fogonazo
// de HTML crudo en cada recarga de `npm run dev`. El orden entre las dos hojas
// es indiferente por diseño (ver la cabecera de `estilos/app.css`: sus reglas
// sobre cromo de Leaflet suben la especificidad a `.gml-app .gml-mapa`).
//
// ── POR QUÉ NO HAY `import.meta.hot.accept()` ───────────────────────────────
// Un `accept` volvería a ejecutar este módulo sobre un `#mapa` que ya tiene un
// `L.Map` montado, y Leaflet lanzaría «Map container is already initialized»
// (doble montaje). Sin `accept`, Vite hace RECARGA COMPLETA de la página ante
// cualquier cambio, que es exactamente lo que este arranque necesita. Si algún
// día se quiere HMR fino, la vía es `import.meta.hot.dispose(() => visor.destruir())`,
// no `accept` a secas.
//
// ── POR QUÉ NO HAY NINGÚN GLOBAL DE DEPURACIÓN (`window.__gml`) ─────────────
// La sonda de build sí colgaba un `globalThis.__visor`. Aquí no: la verificación
// de esta tarea conduce la UI REAL (se mira el mapa, se cuentan las filas, se
// arrastra el deslizador), y un asa global es una API accidental que alguien
// acabaría usando en serio. Lo que hacía falta comprobar por consola —el riesgo
// nº 1 de la fase, que `mapa.getSize().y > 0`— se lee del DOM sin ningún hook:
// `getSize()` ES `[#mapa.clientWidth, #mapa.clientHeight]` (`Map#getSize` lee el
// contenedor), así que se comprueba con
// `const e = document.getElementById('mapa'); [e.clientWidth, e.clientHeight]`.
//
// ── EL BOTÓN «DIAGNOSTICAR» YA EXISTE (F07, 2026-07-29) ─────────────────────
// Aquí había un párrafo explicando por qué NO estaba: la maqueta lo llevaba, F07
// no existía, y un botón deshabilitado era UI muerta. Ya no aplica — el CTA está
// en el pie de `index.html` y lo cablea el paso 8—, pero la regla que lo escribió
// sigue en pie y por eso queda anotada: el botón nace `disabled` **y con el motivo
// escrito al lado**, que es la diferencia entre un botón apagado y un botón muerto.
// Ver `app/cableado-diagnostico.js#MOTIVO_SIN_OFICIAL`.

import 'leaflet/dist/leaflet.css'

import { OPERATIVOS } from '../config/operativos.js'
import {
  commit,
  crearHistorial,
  puedeDeshacer,
  puedeRehacer,
  redo,
  reiniciar,
  undo,
} from '../edit/historial.js'
import { metricas } from '../edit/metricas.js'
import { PERFIL, SEVERIDAD } from '../gml/_comun.js'
import { descargarGml } from '../gml/descargar.js'
import { NAMESPACE_INSPIRE_CATASTRO, NAMESPACE_INSPIRE_DEFECTO } from '../gml/ids.js'
import { serializarParcelaCp } from '../gml/serialize-cp.js'
import { crearTransporte } from '../services/_red.js'
import { crearClienteCatastro } from '../services/catastro.js'
import { abrirBd } from '../storage/bd.js'
import { crearCacheCatastro } from '../storage/cache-catastro.js'
import { crearCuota } from '../storage/cuota.js'
import { crearExpedientes } from '../storage/expedientes.js'
import { crearPieDeFirmaGuardado } from '../storage/pie-firma.js'
import { validarParcela } from '../validation/parcela.js'
import { crearEstadoVista, NIVEL } from '../viewer/_comun.js'
import { crearVisor } from '../viewer/index.js'
import { crearPanelAvisos } from './avisos.js'
import {
  SELECTOR_BOTON_CARGAR,
  SELECTOR_BOTON_COLINDANTES,
  SELECTOR_BOTON_DEDUCIR,
  SELECTOR_ESTADO_CATASTRO,
  cablearCatastro,
} from './cableado-catastro.js'
import { cablearComprobacion } from './cableado-comprobacion.js'
import { cablearDiagnostico } from './cableado-diagnostico.js'
import {
  EXTENSIONES_PROYECTO,
  MENSAJE_SIN_EXPEDIENTE,
  cablearExpediente,
} from './cableado-expediente.js'
import { cablearInforme } from './cableado-informe.js'
import {
  AVISO_DEMO_HUECO_SINTETICO,
  SRS_DEMO,
  parcelaDemo,
  parcelaDemoConHueco,
} from './demo-datos.js'

// ── Constantes de presentación ───────────────────────────────────────────────

/**
 * Valor de `?demo=` que selecciona el dataset SINTÉTICO con hueco. Es la única
 * vía para verlo: la parcela por defecto es la REAL del Catastro y nunca se le
 * añade un patio inventado encima (ver la cabecera de `./demo-datos.js`).
 */
const DEMO_HUECO = 'hueco'

/**
 * Los TRES eyebrows de la cabecera, que son los tres estados de PROCEDENCIA que
 * la app sabe distinguir de verdad (ver {@link rotuloDelDato}). `index.html`
 * nace con «Parcela cargada» y a partir de F05 el rótulo lo escribe siempre la
 * ficha: con un campo para traer parcelas del Catastro al lado, «cargada» se lee
 * como «traída de la Sede», y al abrir la app lo que hay es una demostración.
 */
const EYEBROW_SINTETICA = 'Parcela sintética · demostración'
const EYEBROW_DEMOSTRACION = 'Parcela de demostración'
const EYEBROW_CATASTRO = 'Parcela del Catastro'

/** Texto de la ficha cuando la parcela no tiene referencia catastral. */
const SIN_REFCAT = 'Sin referencia'

/**
 * Ficha: el Catastro no ha declarado ninguna superficie para esta parcela. Es lo
 * normal en todo lo que no viene del WFS (la demo, un DXF, un contorno dibujado)
 * y se DICE, en vez de dejar el guion del HTML, que se lee como «esto no ha
 * cargado», o un «0 m²», que sería afirmar una superficie que nadie declaró.
 */
const SIN_SUPERFICIE_CATASTRAL = 'No consta'

/**
 * Ficha: nadie ha pedido las parcelas colindantes. Traerlas es una consulta
 * aparte —«Traer colindantes», que cablea `./cableado-catastro.js`— y hasta que
 * alguien la dispara el texto dice eso y no «0», que sería contar unas vecinas
 * que no se han buscado. Después de preguntar, «0» sí es una respuesta y se
 * escribe (ver {@link actualizarFicha}).
 */
const SIN_COLINDANTES = 'Sin consultar'

/**
 * Ficha: no hay superficie declarada, así que la diferencia con ella **no
 * existe**. Es un texto DISTINTO de {@link SIN_SUPERFICIE_CATASTRAL} a propósito,
 * y la diferencia es la que separa dos afirmaciones que se confunden todo el
 * rato: allí lo que falta es un DATO («no consta esa superficie»), aquí lo que
 * falta es el TÉRMINO DE COMPARACIÓN. Escribir «No consta» en esta línea se
 * leería como «no consta la diferencia», que suena a que la app no ha sabido
 * calcularla; y «0,00 m²» —lo que saldría de tratar el `null` de
 * `edit/metricas.js#deltaCatastral` como un cero— afirmaría que no hay
 * discrepancia, que es justo lo contrario de lo que sabemos y además es la
 * versión tranquilizadora. Lo cierto es que no hay con qué comparar, y eso es lo
 * que se escribe.
 */
const SIN_DELTA_CATASTRAL = 'No hay con qué comparar'

/**
 * Superficie con dos decimales y separadores españoles (1.019,17). Dos
 * decimales porque es la precisión con la que el Catastro expresa la superficie
 * de parcela; el redondeo es de PRESENTACIÓN y jamás toca el modelo.
 *
 * F06 lo reutiliza para el PERÍMETRO, para el Δ catastral y para la distancia de
 * un offset, en vez de crear un formateador por línea. No es pereza: las cuatro
 * cifras son la misma clase de número —metros (o metros cuadrados) MEDIDOS por
 * la app, con la misma precisión de dos decimales— y un segundo formateador con
 * las mismas opciones solo añade un sitio desde el que divergir. Lo que sí es
 * otra clase de número es la superficie DECLARADA: por eso, y solo por eso,
 * existe {@link FORMATO_DECLARADO}.
 */
const FORMATO_SUPERFICIE = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * La superficie que el Catastro DECLARA, escrita como él la declara: sin
 * decimales forzados. Es toda la diferencia con {@link FORMATO_SUPERFICIE}, y no
 * es un capricho de formato — el Catastro publica un ENTERO de metros cuadrados
 * (`<cp:areaValue uom="m2">1536</cp:areaValue>`), así que pintar «1.536,00» le
 * añadiría dos cifras de precisión que nadie ha afirmado. La superficie MEDIDA
 * de la línea de arriba sí lleva sus dos decimales, porque esa la calcula la app
 * y sabe hasta dónde llega. Que las dos cifras no coincidan ES el dato (F07).
 *
 * F06 lo reutiliza para el PORCENTAJE del Δ catastral, y por lo mismo que se
 * eligió aquí: sin decimales forzados. «5 %» se escribe «5 %», no «5,00 %», y
 * una discrepancia diminuta se lee mejor como «0,01 %» que como «0,008 %».
 */
const FORMATO_DECLARADO = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })

/** Enteros con separador de millares español (para el recuento de vértices). */
const FORMATO_ENTERO = new Intl.NumberFormat('es-ES')

// ── Constantes del cableado de F04 ───────────────────────────────────────────

/**
 * Botón «Generar GML» del pie del panel. Es CONTRATO con `index.html` (nace
 * `disabled` allí a propósito: hasta que no se valida la geometría no se sabe si
 * se puede generar). Se exporta para que el test construya su cáscara con el
 * mismo literal en vez de con una copia que pueda divergir.
 */
export const SELECTOR_BOTON_GML = '[data-accion="generar-gml"]'

/**
 * Renglón `role="status"` que va debajo del botón. El lector de pantalla anuncia
 * lo que se escriba aquí sin robar el foco, y su CSS lo colapsa cuando está
 * vacío (`.gml-accion-estado:empty{display:none}`), así que «sin estado» no deja
 * un hueco en el pie. También es contrato con `index.html`.
 */
export const SELECTOR_ESTADO_GML = '[data-estado="generar-gml"]'

/** Modificador de `.gml-accion-estado` para el estado BLOQUEADO (rojo). */
const CLASE_ESTADO_ERROR = 'gml-accion-estado--error'

/**
 * Cuántos motivos DISTINTOS caben en el renglón antes de resumir el resto. El
 * renglón es una línea de 11 px debajo del botón, no un panel: con más de dos
 * mensajes deja de leerse. No es un tope de información —el recuento completo va
 * SIEMPRE delante («3 errores bloquean…»)—, es un tope de longitud.
 */
const MOTIVOS_EN_RENGLON = 2

/**
 * Identidad de último recurso cuando la parcela no tiene NI referencia catastral
 * NI `idLocal`. Con una parcela construida por `model/parcela.js#crearParcela`
 * no puede ocurrir (`idLocal` es obligatorio allí), pero el store admite
 * cualquier POJO y `serializarParcelaCp` LANZA con una `refcat` en blanco: más
 * vale un `<localId>` que dice la verdad que una excepción en un `click`.
 */
const IDENTIDAD_SIN_REFERENCIA = 'SIN-REFERENCIA'

/**
 * Lo que se le dice al usuario cuando la generación revienta por un defecto de
 * programación (contrato roto en `gml/`: SRS no soportado, coordenada no
 * publicable…). No intenta explicar la causa técnica —no le sirve de nada— pero
 * tampoco la esconde: dice qué ha pasado, que NO tiene fichero, y que el detalle
 * está en la consola, que es donde puede copiarlo para reportarlo.
 */
export const MENSAJE_FALLO_INESPERADO =
  'No se ha podido generar el GML por un fallo interno; no se ha descargado ningún ' +
  'fichero. El detalle técnico está en la consola del navegador.'

/**
 * Gemelo del anterior para el momento de la ENTREGA. Se distingue a propósito:
 * aquí el GML SÍ se ha generado bien y lo que ha fallado es la descarga, así que
 * la acción que le toca al usuario es otra (reintentar, mirar los permisos del
 * navegador) y no «tu parcela tiene algo raro».
 */
export const MENSAJE_FALLO_ENTREGA =
  'El GML se ha generado, pero el navegador no ha podido descargarlo. ' +
  'El detalle técnico está en la consola del navegador.'

/**
 * Los dos tramos del recorrido de generación, a efectos de elegir el mensaje
 * cuando algo revienta. No es una máquina de estados: es el mínimo que hace
 * falta para no contarle al usuario que «falló la generación» cuando el GML se
 * generó bien y lo que falló fue la descarga.
 */
const FASE = Object.freeze({ GENERACION: 'GENERACION', ENTREGA: 'ENTREGA' })

/**
 * Traducción de las TRES severidades de `gml/` a los DOS niveles del panel.
 *
 * `INFO` y `AVISO` caen los dos en `NIVEL.AVISO`, y `ERROR` en `NIVEL.ERROR`.
 * Justificación, que es lo que importa aquí:
 *
 *   · `NIVEL.ERROR` significa BLOQUEANTE en toda la app —el panel lo rotula
 *     literalmente «Bloqueante» y el chip rojo cuenta esos—, y en `gml/` una
 *     detección `ERROR` bloquea de verdad: `serializarParcelaCp` devuelve
 *     `xml: null` en cuanto hay una. Los dos vocabularios coinciden en ese punto.
 *   · Un `INFO` de `gml/` NO es «ruido de depuración»: son `ORIENTACION_NORMALIZADA`
 *     (se ha invertido un anillo) y `PUNTO_REFERENCIA_RECALCULADO` (se ha
 *     descartado el punto propuesto). El fichero que baja NO es el dibujo que el
 *     usuario tenía en pantalla, y la regla de oro 1 dice que se entera. Mapearlo
 *     a un tercer nivel «informativo» que el panel no sabe pintar equivaldría a
 *     tirarlo; mapearlo a `ERROR` sería mentir diciendo que algo bloquea.
 *     `AVISO` es el único nivel que dice la verdad: «pasó algo, mira».
 *
 * Derivado de los dos vocabularios, sin literales sueltos: si `SEVERIDAD`
 * creciera, la clave nueva daría `undefined` y {@link cablearGeneracionGml} cae
 * a `NIVEL.AVISO`, que es el suelo seguro (nunca inventa un bloqueo).
 */
const NIVEL_POR_SEVERIDAD = Object.freeze({
  [SEVERIDAD.INFO]: NIVEL.AVISO,
  [SEVERIDAD.AVISO]: NIVEL.AVISO,
  [SEVERIDAD.ERROR]: NIVEL.ERROR,
})

// ── Constantes del cableado del Catastro (F05) ───────────────────────────────

/**
 * Lo que se le dice al usuario cuando el bloque «Origen de la parcela» no ha
 * llegado a cablearse (ver la decisión 3 de la cabecera). Dice las tres cosas
 * que le hacen falta: qué se ha perdido, qué SIGUE funcionando —que es casi
 * todo, y es la diferencia entre una app rota y una app sin una vía de entrada—
 * y dónde está el detalle para poder reportarlo.
 */
const MENSAJE_SIN_CATASTRO =
  'No se ha podido preparar la conexión con el Catastro: el bloque «Origen de la parcela» queda ' +
  'deshabilitado durante esta sesión. Todo lo demás sigue funcionando —el mapa, la tabla de ' +
  'vértices, la validación y la generación del GML—. El detalle técnico está en la consola del ' +
  'navegador.'

// ── Constantes del cableado de la edición (F06) ──────────────────────────────

/**
 * Los siete nodos de la edición. Se exportan por el mismo motivo que
 * {@link SELECTOR_BOTON_GML}: para que los tests apunten al MISMO literal que el
 * código y no a una copia que pueda divergir.
 *
 * ⚠️ **NO salen de `index.html`** desde el 2026-07-29: los fabrica
 * `viewer/barra-edicion.js`, la barra flotante que `crearVisor` monta sobre el
 * mapa. Este módulo no se enteró del traslado —y ese era el objetivo— porque los
 * resuelve por selector y en el instante de llamar a {@link cablearEdicion}, que
 * ocurre después de `crearVisor`. Consecuencia que sí hay que tener presente:
 * **el orden importa**. Si algún día se cablea la edición antes de montar el
 * visor, `nodo()` lanzará nombrando el selector que falte.
 *
 * Que cada uno case EXACTAMENTE un nodo lo vigilan dos guardianes repartidos:
 * `test/services/contrato-catastro.test.js` (G16) exige que estos siete **no**
 * aparezcan en `index.html` —volver a declararlos ahí resucitaría el duplicado
 * que se acaba de quitar, y el cableado agarraría el de la cáscara dejando la
 * barra muerta en pantalla— y `test/viewer/barra-edicion.dom.test.js` exige que
 * la barra los produzca, uno cada uno.
 *
 * ⚠️ Los dos botones de deshacer/rehacer llevan MARCADO DENTRO (un `<kbd>` con su
 * atajo). Se les toca el `disabled`, **nunca el `textContent`**: reescribirlo se
 * llevaría por delante el atajo, que es justo lo que hace descubrible la función
 * para quien va por teclado. Lo dice también `viewer/barra-edicion.js` junto a ellos.
 */
export const SELECTOR_BOTON_DESHACER = '[data-accion="deshacer"]'
export const SELECTOR_BOTON_REHACER = '[data-accion="rehacer"]'
/** Casilla del enganche al parcelario. Nace MARCADA (la fabrica la barra). */
export const SELECTOR_CAMPO_SNAP = '[data-campo="snap"]'
/** Tolerancia del enganche. ⚠️ En CENTÍMETROS (ver {@link CENTIMETROS_POR_METRO}). */
export const SELECTOR_CAMPO_TOLERANCIA = '[data-campo="snap-tolerancia"]'
/** Distancia del desplazamiento de lindero. En METROS, a diferencia de la anterior. */
export const SELECTOR_CAMPO_OFFSET = '[data-campo="offset-distancia"]'
/** «Desplazar lindero». Nace `disabled`: sin lado seleccionado no hay qué mover. */
export const SELECTOR_BOTON_OFFSET = '[data-accion="offset"]'
/** Renglón `role="status"` del bloque, gemelo del de «Generar GML». */
export const SELECTOR_ESTADO_EDICION = '[data-estado="edicion"]'

/**
 * La conversión que `index.html` pide expresamente que haga esta capa: el campo
 * de tolerancia se teclea en CENTÍMETROS y `viewer/edicion.js#tolerancia` habla
 * METROS.
 *
 * No es un descuido del marcado ni algo que «arreglar» a metros: un técnico dice
 * «veinte centímetros», nunca «cero coma dos metros», y un campo que mostrara
 * `0,2` invita a teclear `20` por inercia — cien veces la tolerancia pedida y sin
 * que nada avise. El sitio correcto para la conversión es la frontera entre la
 * pantalla y el modelo, o sea aquí.
 */
const CENTIMETROS_POR_METRO = 100

// ⛔ Aquí vivía `MENSAJE_EDICION_INICIAL`, el texto que explicaba por qué los tres
// botones nacen apagados. Se ha ido con ellos: desde el 2026-07-29 los controles
// no están en el panel sino en la barra flotante sobre el mapa, y ese texto en el
// renglón de estado dejaba un cartel de tres líneas sobre la ortofoto hasta la
// primera edición. La regla de oro 1 se sigue cumpliendo —ver el comentario largo
// al final de `cablearEdicion`—, pero el motivo lo dan ahora el desplegable del
// offset y el panel de ayuda, que son los sitios donde se pregunta. No lo
// resucites aquí sin volver a mirar la pantalla.

/** Desenlaces de la navegación por el historial. */
const MENSAJE_DESHECHO = 'Deshecha la última operación.'
const MENSAJE_REHECHO = 'Rehecha la operación siguiente.'
/**
 * Y los dos que explican que NO se ha navegado. El botón está apagado en ese
 * caso, así que esto solo se lee llegando por el atajo de teclado — que es
 * precisamente el camino en el que el usuario no tiene delante un botón gris que
 * le diga que no hay nada. Callar aquí sería dejar un `Ctrl+Z` sin respuesta.
 */
const MENSAJE_NADA_QUE_DESHACER = 'No hay ninguna edición que deshacer.'
const MENSAJE_NADA_QUE_REHACER = 'No hay ninguna edición que rehacer.'

/**
 * Al entrar una parcela nueva. Dice las dos cosas que el usuario necesita saber y
 * que, calladas, se leerían como un fallo: que «Deshacer» se ha apagado, y por
 * qué. Es la cara visible de la decisión 2 de F06.
 */
const MENSAJE_PARCELA_NUEVA =
  'Parcela nueva: el historial de edición empieza de cero. «Deshacer» revierte tus ediciones de ' +
  'la geometría, nunca la parcela que has traído.'

/** Estado del offset cuando no hay ningún lindero elegido. */
const MENSAJE_SIN_LADO = 'Sin lindero seleccionado: pincha uno en el mapa para poder desplazarlo.'
/** …y cuando sí lo hay. */
const MENSAJE_CON_LADO = 'Lindero seleccionado: ya puedes desplazarlo.'

/**
 * El offset no se ha aplicado. NO se repite aquí el motivo: `viewer/edicion.js`
 * ya publica en el panel, verbatim, cada detección de `edit/offset.js` (y su
 * propio mensaje cuando no había lado). Reescribirlas aquí obligaría al usuario a
 * leer lo mismo dos veces, y sería además una segunda redacción del mismo suceso
 * — que es la que se queda vieja. Este renglón solo dice que no se hizo y dónde
 * está el porqué, igual que {@link motivoSinFichero} con el panel.
 */
const MENSAJE_OFFSET_SIN_APLICAR =
  'No se ha desplazado el lindero. El motivo está en el panel de avisos.'

// ── Nodos de la cáscara ──────────────────────────────────────────────────────

/**
 * Nodo de `index.html`, o `throw`. El marcado de la cáscara es CONTRATO (ver la
 * cabecera de `index.html`), así que un selector que no encuentra nada es un bug
 * del programador, no un dato malo: regla de oro 1, se lanza y se nombra el
 * selector. La alternativa —seguir con un `null` y morir cien líneas más allá
 * con «cannot set properties of null»— es justo el fallo ilegible que el
 * proyecto no admite.
 *
 * @param {string} selector
 * @returns {HTMLElement}
 * @throws {Error} Si la cáscara no tiene ese nodo.
 */
function nodo(selector) {
  const encontrado = document.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `app/main.js: la cáscara no tiene ningún nodo '${selector}'. El marcado de ` +
        `index.html es contrato de esta entrada (y de estilos/app.css): si se ha ` +
        `renombrado o movido ese nodo, hay que arreglarlo en index.html, no aquí.`,
    )
  }
  return /** @type {HTMLElement} */ (encontrado)
}

// ── 1 · Datos ────────────────────────────────────────────────────────────────

// `?demo=hueco` es la vía explícita para ver en pantalla un hueco interior, su
// rótulo «HUECO 1» y el recorte de anillos anidados. Cualquier otro valor (o
// ninguno) carga la parcela REAL del Catastro.
const esSintetica = new URLSearchParams(window.location.search).get('demo') === DEMO_HUECO
const parcela = esSintetica ? parcelaDemoConHueco() : parcelaDemo()

/**
 * El `idLocal` del dataset de DEMOSTRACIÓN con el que arranca la app. Es lo que
 * permite saber, más tarde y sin adivinar, si lo que hay en el store SIGUE
 * siendo la demostración o si el usuario ya ha traído una parcela de verdad (ver
 * {@link rotuloDelDato}).
 *
 * Se DERIVA del dataset en vez de escribir el literal `'demo-…'`, para que no
 * puedan divergir. Y se usa `idLocal` y no `refcat`, `origen` ni la identidad
 * del objeto, porque es el único de los cuatro que distingue de verdad:
 *   · `refcat` NO sirve — la parcela de demostración es la REAL 9398516VK3799G,
 *     así que traerla del Catastro deja la misma referencia en el store;
 *   · `origen` NO sirve — la demo ya es `WFS` (ese anillo salió del WFS, y
 *     `demo-datos.js` lo dice donde toca);
 *   · la identidad del POJO NO sirve — editar una coordenada en la tabla
 *     construye un objeto nuevo y la parcela seguiría siendo la de demostración.
 * `idLocal` en cambio viaja con el dato: sobrevive a las ediciones y solo cambia
 * cuando ENTRA otra parcela, que es exactamente la pregunta que se hace.
 */
const ID_LOCAL_DEMO = parcela.idLocal

// El eyebrow ya no se escribe aquí. Lo escribe SIEMPRE la ficha (paso 6), que es
// el único suscriptor que ve entrar y salir parcelas del store y por tanto el
// único que puede decir la verdad sobre su procedencia también DESPUÉS del
// arranque. Ver {@link rotuloDelDato} y la decisión 4 de la cabecera.
const eyebrow = nodo('[data-eyebrow]')

// ── 2 · Estado e historial ───────────────────────────────────────────────────

// UN solo store para las TRES vistas: el dibujo del mapa, la tabla de vértices
// y la ficha del pie (ver la cabecera).
const estado = crearEstadoVista(parcela)

// UNA sola pila de deshacer, compartida por los DOS módulos que commitean:
// `viewer/sincronizacion.js` (una celda tecleada, un vértice arrastrado) y
// `viewer/edicion.js` (insertar, eliminar, desplazar un lindero). Los dos la
// reciben a través de `crearVisor`.
const historial = crearHistorial()

// ⚠️ SEMBRADO, y es la decisión 1 de F06 (ver la cabecera). `crearHistorial`
// deja `indice: -1` y `puedeDeshacer` exige `indice > 0`: sin esta línea, el
// primer `commit` del usuario caería en el índice 0 y **su primera edición sería
// irreversible**, con el botón «Deshacer» apagado y sin nada que lo explicara.
// Con la semilla, el estado de partida es un destino legítimo al que volver.
commit(historial, estado.get())

// ── 3 · Panel de avisos ──────────────────────────────────────────────────────

// Los dos chips del contador se localizan por `data-contador`, que es el
// contrato de `index.html`: nacen NEUTROS («0 errores» / «0 avisos») y es
// `app/avisos.js` quien pone y quita los modificadores de color.
const panel = crearPanelAvisos({
  contenedor: nodo('#avisos'),
  chipError: nodo('.gml-chip[data-contador="ERROR"]'),
  chipAviso: nodo('.gml-chip[data-contador="AVISO"]'),
})

// El dataset sintético lo dice también EN LA LISTA de avisos, no solo en el
// eyebrow: el eyebrow se lee una vez al abrir y la lista queda.
if (esSintetica) panel.avisar(AVISO_DEMO_HUECO_SINTETICO, { nivel: NIVEL.AVISO })

// ── 4 · Ficha del pie: el SEGUNDO suscriptor del mismo store ─────────────────
//
// ⚠️ Va ANTES del visor desde F06 (ver la cabecera): {@link previsualizarMedidas}
// se le entrega a `crearVisor` como `alPrevisualizar`, y `crearVisor` lo llama
// durante su propia construcción.

const fichaSrs = nodo('[data-ficha="srs"]')
const fichaRefcat = nodo('[data-ficha="refcat"]')
const fichaVertices = nodo('[data-ficha="vertices"]')
const fichaSuperficie = nodo('[data-ficha="superficie"]')
const fichaPerimetro = nodo('[data-ficha="perimetro"]')
const fichaSuperficieCatastral = nodo('[data-ficha="superficie-catastral"]')
const fichaDelta = nodo('[data-ficha="delta-catastral"]')
const fichaColindantes = nodo('[data-ficha="colindantes"]')

/**
 * Cuántas parcelas colindantes se han traído del Catastro, o `null` mientras
 * nadie las haya pedido. Es un `let` de módulo y no un dato del store a
 * propósito: `model/parcela.js` no tiene dónde guardar unas vecinas —lo dice
 * `cableado-catastro.js` al explicar por qué `colindantes()` no escribe en el
 * modelo—, y meterlas donde no van sería peor que llevar aquí el recuento.
 * `null` ≠ `0`: ver {@link SIN_COLINDANTES}.
 *
 * @type {number|null}
 */
let colindantesTraidas = null

/**
 * El rótulo de PROCEDENCIA de la cabecera (`data-eyebrow`): qué es, exactamente,
 * lo que hay en pantalla. Tres estados, que son los tres que la app distingue:
 *
 *   · **{@link EYEBROW_CATASTRO}** — la parcela ha ENTRADO en el store después
 *     del arranque, o sea que la ha traído el cableado del Catastro. Vale
 *     también cuando ha salido de la copia local: sigue siendo un dato del
 *     Catastro, y de si se ha consultado el servicio o la caché —y de cuándo se
 *     guardó— habla el renglón `data-procedencia`, que es su sitio.
 *   · **{@link EYEBROW_SINTETICA}** — `?demo=hueco`: una parcela INVENTADA.
 *   · **{@link EYEBROW_DEMOSTRACION}** — el dataset por defecto: la geometría
 *     real de 9398516VK3799G, pero copiada dentro del código (ver la cabecera de
 *     `./demo-datos.js`), no traída del Catastro ahora. Decirle «Parcela
 *     cargada» —lo que trae `index.html`— sería, con el campo del Catastro al
 *     lado, hacerla pasar por una consulta que no se ha hecho.
 *
 * Sin parcela (`null`, que el store admite) se cae al lado conservador: el de la
 * demostración. Nunca se afirma «del Catastro» sin una parcela que lo respalde.
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {string}
 */
function rotuloDelDato(parcelaActual) {
  const hayParcela = parcelaActual !== null && parcelaActual !== undefined
  if (hayParcela && parcelaActual.idLocal !== ID_LOCAL_DEMO) return EYEBROW_CATASTRO
  return esSintetica ? EYEBROW_SINTETICA : EYEBROW_DEMOSTRACION
}

/**
 * Los recintos del POJO que haya en el store, o `[]`. El store admite `null` y
 * cualquier POJO: aquí «no hay parcela» es un estado legítimo, no una excepción.
 *
 * @param {object|null} parcelaActual
 * @returns {Array<object>}
 */
function recintosDe(parcelaActual) {
  return parcelaActual && Array.isArray(parcelaActual.recintos) ? parcelaActual.recintos : []
}

/**
 * La superficie que el Catastro DECLARA para esta parcela, en m², o `null` si no
 * consta. No se calcula NADA aquí: es lo que el servicio dijo, tal cual entró en
 * el modelo (`cp:areaValue`). Si esta función cayera alguna vez en una medición
 * propia, la ficha compararía la medición consigo misma y la discrepancia —que
 * es media razón de ser de la app— saldría siempre en cero.
 *
 * Un valor no finito se trata como AUSENTE, que es lo que `edit/metricas.js`
 * exige (`número finito | null`, y lanza con cualquier otra cosa).
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {number|null}
 */
function declaradaDe(parcelaActual) {
  const declarada =
    parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.superficieCatastral
  return Number.isFinite(declarada) ? declarada : null
}

/**
 * Un número con su signo DELANTE cuando es positivo. `Intl` ya escribe el menos;
 * lo que no escribe es el más, y en un Δ el signo ES la información: «−0,13 m²»
 * dice que medimos MENOS que lo inscrito y «+0,13 m²» que medimos más, mientras
 * que «0,13 m²» no dice ninguna de las dos cosas. El cero no lleva signo (medida
 * y declarada coinciden, y un «+0,00» sería ruido).
 *
 * @param {number} valor
 * @param {Intl.NumberFormat} formato
 * @returns {string}
 */
function conSigno(valor, formato) {
  return valor > 0 ? `+${formato.format(valor)}` : formato.format(valor)
}

/**
 * El PERÍMETRO, que es tres números y no uno (`geo/metrica.js#perimetro` devuelve
 * `{exterior, huecos, total}` justamente para no elegir en silencio por el
 * llamante). Aquí la elección se toma y se escribe:
 *
 *   · Manda el **EXTERIOR**, porque es el lindero del que habla una escritura y
 *     al que se refiere la tolerancia oficial de identidad (±0,50 m urbana /
 *     ±2,00 m rústica, SPEC §3). Es la cifra que el técnico va a comparar.
 *   · Los HUECOS se suman aparte y solo aparecen si los hay. Callarlos dejaría
 *     una parcela con patio diciendo un perímetro menor que la línea que tiene
 *     dibujada; fundirlos en un solo número haría lo contrario, inflar el
 *     lindero exterior con metros que no son suyos. Los dos serían un número
 *     plausible y falso.
 *
 * @param {{exterior: number, huecos: number}} perimetro
 * @returns {string}
 */
function textoPerimetro(perimetro) {
  const exterior = `${FORMATO_SUPERFICIE.format(perimetro.exterior)} m`
  return perimetro.huecos > 0
    ? `${exterior} (+${FORMATO_SUPERFICIE.format(perimetro.huecos)} m de huecos)`
    : exterior
}

/**
 * La DIFERENCIA entre lo medido y lo declarado, tal como la devuelve
 * `edit/metricas.js`: absoluto con signo y, cuando el cociente está definido, su
 * porcentaje.
 *
 * ⚠️ REGLA DE ORO 9 — aquí no hay ni un color de mérito, ni un semáforo, ni un
 * «dentro de tolerancia». El umbral depende del expediente, del municipio y del
 * criterio del técnico que firma: la app MIDE y SEÑALA. `index.html` lo dice
 * también junto al `<dd>`, y por eso esta función devuelve TEXTO y nunca toca
 * clases del nodo.
 *
 * @param {{absoluto: number, relativo: number|null}|null} delta
 * @returns {string}
 */
function textoDelta(delta) {
  if (delta === null) return SIN_DELTA_CATASTRAL
  const absoluto = `${conSigno(delta.absoluto, FORMATO_SUPERFICIE)} m²`
  // `relativo` es una FRACCIÓN, no un porcentaje (el ×100 es de presentación, y
  // es la confusión clásica de este campo); es `null` cuando la declarada es 0 y
  // el cociente no existe — ahí se pinta solo el absoluto en vez de un «∞ %».
  if (delta.relativo === null) return absoluto
  return `${absoluto} (${conSigno(delta.relativo * 100, FORMATO_DECLARADO)} %)`
}

/**
 * **La parte NUMÉRICA de la ficha, y el único sitio desde el que se pinta.**
 *
 * La llaman los DOS caminos que existen —el suscriptor del store (geometría ya
 * asentada) y el canal en vivo del arrastre (geometría en vuelo)— y ese es todo
 * su motivo de ser: dos rutas de pintado para la misma cifra acaban divergiendo,
 * y la que divergiría es precisamente la que el usuario mira mientras mueve el
 * vértice. Ver la decisión 6 de F06 en la cabecera.
 *
 * Las cuatro cifras salen de `edit/metricas.js#metricas`, que a su vez las saca
 * de `geo/area.js#superficie` y `geo/metrica.js#perimetro`. Esta capa no calcula
 * nada: compone texto. En particular la SUPERFICIE ya no se pide directamente a
 * `geo/area.js` —como se hacía hasta F06—, para que la cifra que se ve durante el
 * arrastre y la que se serializa en el GML no puedan salir de dos sumas
 * distintas.
 *
 * Si el modelo llegara con el invariante roto (`recintos[0]` que no es EXTERIOR),
 * `metricas` LANZA a propósito y aquí se deja subir: es un bug del programa y
 * tiene que sonar (regla de oro 1), no quedarse en un guion en el pie. En el
 * camino en vivo esa excepción la recoge `viewer/sincronizacion.js`, que avisa
 * una vez por gesto y deja seguir el arrastre.
 *
 * @param {Array<object>} recintos  Geometría a medir (la del store, o la EN VUELO).
 * @param {number|null} superficieCatastral  La declarada, o `null` si no consta.
 * @returns {void}
 */
function pintarMedidas(recintos, superficieCatastral) {
  const medidas = metricas(recintos, { superficieCatastral })

  fichaVertices.textContent = FORMATO_ENTERO.format(medidas.nVertices)
  fichaSuperficie.textContent = `${FORMATO_SUPERFICIE.format(medidas.superficie)} m²`
  fichaPerimetro.textContent = textoPerimetro(medidas.perimetro)
  fichaDelta.textContent = textoDelta(medidas.deltaCatastral)
}

/**
 * Repinta la ficha ENTERA desde el POJO de parcela. Suscriptor del store: se
 * llama en CADA `estado.set` (una coordenada editada en la tabla, un vértice
 * arrastrado y soltado, una parcela traída del Catastro, un undo) y las medidas
 * se recalculan solas.
 *
 * Lo que pinta de más que {@link pintarMedidas} es lo que NO cambia durante un
 * arrastre y por tanto no tiene sentido recalcular por fotograma: el eyebrow, el
 * SRS, la referencia catastral, la superficie declarada y el recuento de
 * colindantes. Arrastrar un vértice no cambia ninguna de esas cinco cosas.
 *
 * El SRS no sale de la parcela: `crearParcela` no porta `srs` (vive en el
 * Expediente), así que se pinta el del dataset, el mismo que se le da al visor.
 *
 * Desde F05 escribe también el EYEBROW de la cabecera, que es una afirmación
 * sobre la procedencia del dato y por tanto cambia cuando cambia el dato: ver
 * {@link rotuloDelDato} y la decisión 4 de la cabecera del módulo.
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {void}
 */
function actualizarFicha(parcelaActual) {
  const declarada = declaradaDe(parcelaActual)

  eyebrow.textContent = rotuloDelDato(parcelaActual)

  fichaSrs.textContent = SRS_DEMO
  // `refcat` es `null` en el dataset sintético, y se DICE («Sin referencia») en
  // vez de dejar un guion: un guion se lee como «esto no ha cargado».
  fichaRefcat.textContent = (parcelaActual && parcelaActual.refcat) || SIN_REFCAT
  // La MEDIDA y el resto de cifras de la app, por el único camino que las pinta.
  pintarMedidas(recintosDe(parcelaActual), declarada)
  // Las dos líneas de F05. La superficie de arriba es la MEDIDA (la calcula la
  // app); esta es la DECLARADA (la dice el Catastro), y van juntas para poder
  // compararlas de un vistazo. La resta de las dos es el Δ, que pinta
  // {@link pintarMedidas} justo debajo.
  fichaSuperficieCatastral.textContent =
    declarada === null ? SIN_SUPERFICIE_CATASTRAL : `${FORMATO_DECLARADO.format(declarada)} m²`
  // El recuento de las vecinas. Hasta F06 esta línea era la constante «Sin
  // consultar» porque nadie las pedía; ahora hay un gesto que las pide («Traer
  // colindantes», que cablea `./cableado-catastro.js`) y su resultado llega por
  // {@link cablearEdicion}#alColindantes. Se sigue escribiendo DESDE AQUÍ, y no
  // desde el cableado del Catastro, que es lo que mantiene la ficha con un solo
  // dueño. Mientras nadie pregunte, el texto dice que no se ha preguntado.
  fichaColindantes.textContent =
    colindantesTraidas === null ? SIN_COLINDANTES : FORMATO_ENTERO.format(colindantesTraidas)
}

/**
 * Deja constancia de cuántas parcelas colindantes se han traído (o de que ya no
 * hay ninguna consulta vigente, con `null`) y repinta la ficha.
 *
 * @param {number|null} cuantas
 * @returns {void}
 */
function fijarRecuentoColindantes(cuantas) {
  colindantesTraidas = cuantas
  actualizarFicha(estado.get())
}

/**
 * El canal EN VIVO del arrastre (criterio de aceptación 4 de F06): los anillos
 * que aún NO han pasado por el store, medidos y pintados en cada fotograma.
 *
 * `viewer/sincronizacion.js` no escribe en el store hasta el `dragend` —un `set`
 * por movimiento del ratón reventaría el historial—, así que sin este canal la
 * superficie del pie se quedaría congelada durante todo el gesto y solo saltaría
 * al soltar. Con él, las tres cifras se mueven con el vértice.
 *
 * Recibe ANILLOS (`[[x,y], …]` por recinto), no recintos: el `tipo` de cada uno
 * —el invariante EXTERIOR/HUECO que `geo/area.js` y `geo/metrica.js` exigen— se
 * toma del estado por posición, que es de donde `sincronizar` copió los anillos.
 *
 * El segundo argumento (`refVertice`) se ignora aquí a propósito: señala QUÉ
 * vértice se está moviendo y eso solo le sirve al otro consumidor del canal, la
 * capa de acotaciones, que resalta la cota del lado en curso.
 *
 * @param {Array<Array<[number, number]>>} anillosUTM
 * @returns {void}
 */
function previsualizarMedidas(anillosUTM) {
  const parcelaActual = estado.get()
  const base = recintosDe(parcelaActual)
  pintarMedidas(
    anillosUTM.map((vertices, i) => ({ ...base[i], vertices })),
    declaradaDe(parcelaActual),
  )
}

estado.subscribe(actualizarFicha)
// `subscribe` NO notifica al suscribirse (ver `crearEstadoVista`): el primer
// pintado se hace a mano, o la ficha se quedaría con los guiones del HTML hasta
// la primera edición.
actualizarFicha(estado.get())

// ── 5 · Visor ────────────────────────────────────────────────────────────────

// El retorno SÍ se recoge desde F05: de él salen el `L.Map` que el cableado del
// Catastro necesita para la deducción por clic (paso 7) y, desde F06, la
// interacción de edición que consume {@link cablearEdicion} (paso 6).
const visor = crearVisor(nodo('#mapa'), {
  estado,
  // `<div>`, no `<table>`: es la caja con `overflow:auto` contra la que scrollea
  // la cabecera pegajosa. `sincronizar` crea la `<table>` dentro.
  tablaEl: nodo('#tabla-vertices'),
  srs: SRS_DEMO,
  // El ÚNICO camino para que un fallo de red de la cartografía o una celda
  // ilegible acaben en el panel en vez de en el `console.warn` por defecto.
  alAvisar: panel.avisar,
  // Ortofoto PNOA. Coincide con `capas.js#BASE_POR_DEFECTO`, y se pasa igual de
  // forma explícita: es LA capa sobre la que se calca, y que la app diga en voz
  // alta con qué base arranca vale más que ahorrar una línea.
  baseInicial: 'pnoa-ma',
  // ⚠️ DECISIÓN, y va CONTRA el defecto de `montarCapas` (que es `false`). Con
  // `false` la cartografía catastral arranca apagada y, sobre todo, el control
  // de opacidad arranca DESHABILITADO: quien abre la app por primera vez ve un
  // deslizador gris que no se mueve y lo lee como un fallo del programa. Además
  // catastral-en-transparencia-sobre-ortofoto ES la vista que da sentido al
  // producto (calcar), y encenderla cuesta exactamente 1 `GetMap` por encuadre
  // — la capa WMS pide una imagen por encuadre, no un mosaico de teselas.
  superpuestaInicial: true,
  // La pila del paso 2, YA SEMBRADA. La reciben los dos módulos que commitean
  // —`sincronizacion.js` y `edicion.js`—, cada uno con una instantánea por
  // operación acabada; los atajos y los botones que navegan por ella son del
  // paso 6.
  historial,
  // ── F06 · la edición, encendida ──────────────────────────────────────────
  // La lista de claves es CERRADA (`tolerancia`, `minimoPx`, `snapActivo`) y una
  // errata LANZA, así que no hay forma de pedir aquí algo que se ignore en
  // silencio. Se pasa `tolerancia` EXPLÍCITA aunque coincida con el defecto de
  // `crearEdicion`, por lo mismo que `baseInicial`: la app dice en voz alta con
  // qué τ arranca. `snapActivo` NO se pasa: quien decide el estado inicial del
  // enganche es la casilla de `index.html`, y {@link cablearEdicion} se lo
  // empuja al visor en cuanto la lee (paso 6) — con la tolerancia hace lo mismo,
  // que es lo que ata los 20 cm del campo a estos 0,2 m POR CONSTRUCCIÓN y no
  // por casualidad.
  edicion: { tolerancia: OPERATIVOS.snapMetros },
  // ── F07 · el diagnóstico, montado (que no es lo mismo que abierto) ───────
  // `true` y no un objeto: las dos claves que admite —`posicion` y `minimoPx`—
  // valen aquí exactamente lo que sus defectos, y escribirlas sería fingir una
  // decisión que no se ha tomado. El cajón nace CERRADO y la capa VACÍA; quien
  // los abre y les da cifras es el paso 8, cuando el usuario pulsa el CTA.
  //
  // Ojo a la combinación: `edicion` y `diagnostico` a la vez es el caso NORMAL de
  // F07, no una rareza. Se diagnostica SOBRE la parcela que se está editando, y
  // por eso el cajón recalcula en cada operación del store.
  diagnostico: true,
  // ── F08 · el cajón de comprobación, montado (que tampoco es abierto) ─────
  // `true` y no un objeto por lo mismo que arriba: su única clave de montaje
  // —`posicion`— vale aquí exactamente lo que su defecto, `bottomleft`.
  //
  // ⚠️ Y `bottomleft` es LA MISMA esquina que el cajón de F07, a sabiendas: las
  // cuatro esquinas del mapa estaban ocupadas antes de F08 (`topleft` la barra
  // de edición, `topright` el control de capas, `bottomright` la opacidad y la
  // atribución). Los dos cajones son mutuamente excluyentes por diseño —la
  // comprobación PRECEDE al diagnóstico y no coexiste con él—, así que montarlos
  // los dos es lo normal y abrirlos a la vez no; de esa exclusión responde el
  // paso 9, que es quien sabe en qué punto del recorrido está el usuario.
  //
  // El cajón nace CERRADO y en blanco: montarlo no comprueba nada. Quien lo abre
  // y le da contenido es el paso 9, cuando el usuario suelta un `.gml`.
  comprobacion: true,
  // ── Las PARCELAS VECINAS, dibujadas (deuda de F05) ───────────────────────
  // `true` y no un objeto porque esta opción es BOOLEANA por contrato: la capa no
  // tiene ni una opción de montaje (`crearVisor` LANZA si se le pasa un objeto, y
  // el mensaje nombra la vía buena). Va aquí, en el paso 5, porque la capa es del
  // VISOR: quien la llena es el paso 7, con lo que devuelve «Traer colindantes».
  //
  // ⚠️ Esto es el arreglo de un defecto REAL encontrado en el check visual: las
  // vecinas se traían del Catastro desde F05, las usaban por dentro el SNAP de F06
  // y la INVASIÓN de F07, y NO LAS PINTABA NADIE. El usuario leía «12 parcelas
  // colindantes» en la ficha y el mapa seguía exactamente igual — la regla de oro 1
  // rota en el último tramo, que es el peor sitio: el trabajo estaba hecho.
  //
  // Sin `colindantes: true` aquí, `visor.colindantes` vale `null` y el suscriptor
  // que las pinta (paso 7) no tendría dónde pintarlas.
  colindantes: true,
  // El canal EN VIVO de la ficha (criterio de aceptación 4). Es opción de PRIMER
  // NIVEL y no una clave de `edicion` porque medir mientras se arrastra no exige
  // poder insertar vértices ni enganchar al parcelario: son dos cosas distintas.
  // Va DESPUÉS de las cotas en el mismo canal; `sincronizacion.js` ya envuelve
  // este gancho en su propio `try`, así que un fallo midiendo no se lleva por
  // delante ni las acotaciones ni el gesto.
  alPrevisualizar: previsualizarMedidas,
})

// ── 6 · Edición: historial, atajos y controles (F06 · T5.1) ──────────────────

/**
 * ¿El foco está en algo donde se ESCRIBE? Si lo está, los atajos de esta capa se
 * callan.
 *
 * No es cortesía: las celdas de coordenada de la tabla de vértices SON `<input>`,
 * y ahí `Ctrl+Z` es el deshacer del NAVEGADOR sobre el texto que el usuario está
 * tecleando. Robárselo para revertir la geometría —mientras corrige un dígito de
 * una coordenada, o la referencia catastral, o la tolerancia— destruiría trabajo
 * que él creía a salvo y de la forma más desconcertante posible: el atajo hace lo
 * de siempre en todas partes menos aquí. Es la clase de fallo que nadie reporta
 * bien porque nadie entiende qué ha pasado.
 *
 * Se miran las TRES etiquetas editables y `isContentEditable`, no una lista de
 * los inputs concretos de la cáscara: la regla es «se está escribiendo», no «este
 * campo». Un campo nuevo en `index.html` queda protegido sin tocar esto.
 *
 * @param {EventTarget|null} destino  `evento.target`.
 * @returns {boolean}
 */
function esCampoDeTexto(destino) {
  if (destino === null || typeof destino !== 'object') return false
  const etiqueta = typeof destino.tagName === 'string' ? destino.tagName.toUpperCase() : ''
  if (etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'SELECT') return true
  return destino.isContentEditable === true
}

/**
 * Un número tecleado por el usuario, o `null` si lo que hay no es uno.
 *
 * Misma frontera que `viewer/celda.js#parsearCoordenada` y por el mismo motivo:
 * lo que sale de un `<input>` es DATO DEL USUARIO y nunca contrato roto, así que
 * aquí no se lanza nunca — se devuelve `null` y quien llama avisa y revierte.
 * `Number('')` vale `0`, que es la trampa clásica de este parseo: un campo vacío
 * apagaría el enganche (τ = 0) sin que nada lo dijera, así que el vacío se trata
 * como ilegible, no como cero.
 *
 * @param {string} texto  `input.value`.
 * @returns {number|null}
 */
function numeroTecleado(texto) {
  const limpio = String(texto ?? '').trim()
  if (limpio === '') return null
  // La coma es el separador decimal español y un `type="number"` no la entrega,
  // pero un campo de texto sí podría: se admite por lo mismo que en las celdas.
  const valor = Number(limpio.replace(',', '.'))
  return Number.isFinite(valor) ? valor : null
}

/**
 * Cablea el bloque «Edición» del panel: el historial (botones y atajos), los tres
 * controles del enganche y el offset, y el renglón de estado. Es el último metro
 * de F06 y lo único de toda la feature que se ve sin tocar el mapa.
 *
 * ── QUÉ CABLEA, Y CONTRA QUÉ ──
 *   · **Deshacer / Rehacer** → `edit/historial.js`. `disabled` DERIVADO de
 *     `puedeDeshacer`/`puedeRehacer` y re-evaluado tras cada cambio; nunca se les
 *     toca el texto (llevan su `<kbd>` dentro).
 *   · **`Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`** (y sus gemelos con `Meta`, para
 *     macOS) → lo mismo, sobre `document`. **Inhibidos dentro de un campo de
 *     texto**: ver {@link esCampoDeTexto}.
 *   · **Casilla del snap** → `visor.edicion.snapActivo(v)`.
 *   · **Tolerancia (cm)** → `visor.edicion.tolerancia(m)`, dividiendo por
 *     {@link CENTIMETROS_POR_METRO}.
 *   · **Distancia (m) + «Desplazar lindero»** → `visor.edicion.desplazarSeleccion(d)`.
 *     El botón se enciende y se apaga con `alCambiarSeleccion`.
 *
 * ── EL ESTADO DE LOS BOTONES SE REFRESCA EN UNA MICROTAREA, Y HACE FALTA ──
 * Los dos módulos que commitean escriben en este orden: `estado.set(siguiente)` y
 * DESPUÉS `commit(historial, siguiente)` (ver `sincronizacion.js#aplicarVertice` y
 * `edicion.js#aplicarRecintos`). Un suscriptor del store corre DENTRO de ese
 * `set`, o sea ANTES del `commit`: leería la pila sin la operación que acaba de
 * ocurrir y dejaría «Deshacer» apagado hasta la operación SIGUIENTE — un botón
 * con un paso de retraso permanente, que es peor que uno roto porque parece que
 * funciona. Aplazar la lectura a una microtarea la coloca después del `commit`,
 * que es síncrono e inmediato. Por eso {@link refrescar} también se expone en el
 * retorno: quien commitee por su cuenta puede forzarla sin esperar a nadie.
 *
 * ── LOS DOS GANCHOS QUE ESTE CABLEADO DA AL CATASTRO ──
 * `alCargarParcela` y `alColindantes` no los llama nadie de aquí: se los queda
 * `cablearCatastro`, que es quien sabe cuándo entra una parcela y cuándo llegan
 * las vecinas. Están en este módulo —y no allí— porque los dos operan sobre
 * piezas de la EDICIÓN (la pila del historial y las dianas del enganche), no
 * sobre la consulta.
 *
 * Política de errores (SPEC §2 regla 1), con la frontera de siempre:
 *   · Contrato del PROGRAMADOR (un nodo que falta en `index.html`, un `historial`
 *     que no es el POJO de `crearHistorial`, un visor montado sin edición) →
 *     `throw` nombrando lo que falta.
 *   · Dato malo del USUARIO (una tolerancia que no es un número, una distancia de
 *     offset ilegible) → **nunca `throw`**: avisa por el panel, lo dice en el
 *     renglón y revierte el campo al valor vigente. Es el patrón exacto de
 *     `sincronizacion.js#alCambiarCelda` con `parsearCoordenada`.
 *
 * @param {object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El MISMO
 *   store que el mapa, la tabla y la ficha.
 * @param {import('../edit/historial.js').Historial} opciones.historial  La pila
 *   YA SEMBRADA (ver la decisión 1 de F06 en la cabecera del módulo) y la misma
 *   que se le pasó al visor.
 * @param {ReturnType<import('../viewer/edicion.js').crearEdicion>} opciones.edicion
 *   `visor.edicion`. Es `null` si el visor se montó sin edición, y entonces esto
 *   LANZA: cablear los controles de algo que no está montado dejaría cuatro
 *   mandos vivos que no harían nada.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Por él salen los
 *   datos malos del usuario.
 * @param {(cuantas: number|null) => void} [opciones.alContarColindantes]  Dónde
 *   dejar el recuento de vecinas. Es un callback y no el `<dd>` de la ficha
 *   porque la ficha tiene un solo dueño (ver {@link actualizarFicha}).
 * @param {HTMLElement} [opciones.botonDeshacer]  Por defecto, el nodo
 *   {@link SELECTOR_BOTON_DESHACER}; si falta, `nodo` LANZA. Ídem los seis
 *   siguientes con sus selectores.
 * @param {HTMLElement} [opciones.botonRehacer]
 * @param {HTMLInputElement} [opciones.casillaSnap]
 * @param {HTMLInputElement} [opciones.campoTolerancia]
 * @param {HTMLInputElement} [opciones.campoOffset]
 * @param {HTMLElement} [opciones.botonOffset]
 * @param {HTMLElement} [opciones.renglon]
 * @param {Document} [opciones.documento]  Dónde se escuchan los atajos. Se
 *   escuchan en el DOCUMENTO y no en el panel porque el usuario tiene las manos
 *   en el mapa cuando quiere deshacer.
 * @returns {{
 *   refrescar: () => void,
 *   deshacer: () => boolean,
 *   rehacer: () => boolean,
 *   alCargarParcela: (parcelaNueva: object) => void,
 *   alColindantes: (resultado: object) => void,
 *   destruir: () => void,
 * }}
 * @throws {TypeError}  Contrato del programador (ver arriba).
 */
export function cablearEdicion({
  estado,
  historial,
  edicion,
  panel,
  alContarColindantes = () => {},
  botonDeshacer = nodo(SELECTOR_BOTON_DESHACER),
  botonRehacer = nodo(SELECTOR_BOTON_REHACER),
  casillaSnap = nodo(SELECTOR_CAMPO_SNAP),
  campoTolerancia = nodo(SELECTOR_CAMPO_TOLERANCIA),
  campoOffset = nodo(SELECTOR_CAMPO_OFFSET),
  botonOffset = nodo(SELECTOR_BOTON_OFFSET),
  renglon = nodo(SELECTOR_ESTADO_EDICION),
  documento = document,
} = {}) {
  // ── Contratos del programador, ANTES de tocar un solo nodo ────────────────
  if (!estado || typeof estado.get !== 'function' || typeof estado.set !== 'function') {
    throw new TypeError(
      `cablearEdicion: 'estado' debe ser el store de crearEstadoVista ({get,set,subscribe}).`,
    )
  }
  if (!historial || !Array.isArray(historial.pila)) {
    throw new TypeError(
      `cablearEdicion: 'historial' debe ser el POJO de crearHistorial ({pila, indice, limite}). ` +
        `La API de edit/historial.js es FUNCIONAL, no un objeto con métodos.`,
    )
  }
  if (!edicion || typeof edicion.snapActivo !== 'function') {
    throw new TypeError(
      `cablearEdicion: 'edicion' debe ser la interacción de viewer/edicion.js (lo que devuelve ` +
        `crearVisor en 'visor.edicion'). Vale 'null' cuando el visor se monta SIN edición, y ` +
        `entonces no hay nada que cablear: estos controles quedarían vivos y mudos.`,
    )
  }

  /**
   * Escribe el renglón `role="status"`. Vacío + sin modificador es el estado «no
   * hay nada que contar»: el CSS lo colapsa (`.gml-accion-estado:empty`) y el
   * bloque no da un salto de layout. Gemelo del `decir` de
   * {@link cablearGeneracionGml}.
   *
   * @param {string} texto
   * @param {boolean} [esError=false]
   */
  function decir(texto, esError = false) {
    renglon.textContent = texto
    renglon.classList.toggle(CLASE_ESTADO_ERROR, esError)
  }

  /**
   * El estado de los dos botones del historial, DERIVADO de la pila. Nunca se
   * les toca el `textContent` (llevan su `<kbd>` dentro).
   */
  function refrescar() {
    botonDeshacer.disabled = !puedeDeshacer(historial)
    botonRehacer.disabled = !puedeRehacer(historial)
  }

  /**
   * Navega por el historial y aplica el resultado al store.
   *
   * ⚠️ **No commitea, y es una decisión** (la 3 de F06): la pila lleva su propia
   * cuenta con `indice`, así que un `commit` aquí convertiría el propio deshacer
   * en una operación deshacible y borraría además la rama de rehacer. Que un
   * `set` externo NO ensucie la pila no se da por hecho —se comprueba en la
   * suite—: ningún suscriptor del store commitea, y los dos módulos que sí lo
   * hacen commitean por su cuenta después de escribir, sin pasar por aquí.
   *
   * @param {(h: object) => (object|null)} navegar  `undo` o `redo`.
   * @param {string} exito  Renglón cuando se ha navegado.
   * @param {string} vacio  Renglón cuando no había a dónde ir.
   * @returns {boolean}
   */
  function moverse(navegar, exito, vacio) {
    const instantanea = navegar(historial)
    // `null` = no hay a dónde ir. El botón ya estaba apagado, así que esto solo
    // se alcanza por el atajo de teclado: no se revienta y se dice por qué no ha
    // pasado nada.
    if (instantanea === null) {
      refrescar()
      decir(vacio)
      return false
    }
    estado.set(instantanea)
    refrescar()
    decir(exito)
    return true
  }

  const deshacer = () => moverse(undo, MENSAJE_DESHECHO, MENSAJE_NADA_QUE_DESHACER)
  const rehacer = () => moverse(redo, MENSAJE_REHECHO, MENSAJE_NADA_QUE_REHACER)

  /**
   * Los atajos. `Ctrl+Z` deshace; `Ctrl+Y` y `Ctrl+Shift+Z` rehacen (las dos
   * formas existen en el mundo real y elegir una sola dejaría a media humanidad
   * pulsando algo que no pasa nada). `Meta` cuenta como `Ctrl` para que en macOS
   * funcione `⌘Z` sin una segunda rama.
   *
   * NO se consulta `evento.defaultPrevented`, y es una decisión: hoy nadie más
   * maneja estas teclas, y respetarlo significaría que cualquier oyente futuro
   * que llamara a `preventDefault` por otro motivo dejaría el undo de la app
   * apagado EN SILENCIO. El filtro que sí hace falta —y que cubre el caso real,
   * que es escribir— es el del foco.
   *
   * @param {KeyboardEvent} evento
   */
  const alPulsarTecla = (evento) => {
    if (!evento) return
    if (!(evento.ctrlKey === true || evento.metaKey === true)) return
    // ⚠️ El foco manda: dentro de un campo, `Ctrl+Z` es del navegador.
    if (esCampoDeTexto(evento.target)) return

    const tecla = typeof evento.key === 'string' ? evento.key.toLowerCase() : ''
    if (tecla !== 'z' && tecla !== 'y') return

    // Se consume SIEMPRE que el atajo es nuestro, también cuando no hay nada que
    // deshacer: dejar que el navegador lo procese además revertiría texto en
    // cualquier otro sitio de la página, que es justo lo que se quiere evitar.
    evento.preventDefault()
    if (tecla === 'y' || evento.shiftKey === true) rehacer()
    else deshacer()
  }

  // ── El enganche (casilla + tolerancia) ────────────────────────────────────

  /** τ vigente en el visor, en centímetros, lista para escribirla en el campo. */
  function toleranciaEnCm() {
    return Number((edicion.tolerancia() * CENTIMETROS_POR_METRO).toFixed(2))
  }

  /** Fuerza el campo al valor vigente (revertir una tolerancia ilegible). */
  function revertirTolerancia() {
    campoTolerancia.value = String(toleranciaEnCm())
  }

  const alCambiarSnap = () => {
    const activo = casillaSnap.checked === true
    edicion.snapActivo(activo)
    decir(
      activo
        ? `Ajuste al parcelario activado (${FORMATO_DECLARADO.format(toleranciaEnCm())} cm).`
        : 'Ajuste al parcelario desactivado: el arrastre no engancha a nada.',
    )
  }

  /**
   * Aplica la tolerancia tecleada. Un valor que no es un número, o que es
   * negativo, es DATO MALO DEL USUARIO: se avisa, se dice en el renglón y se
   * revierte el campo. No se lanza —`viewer/edicion.js#tolerancia` sí lanzaría
   * con un negativo, y con razón: para él eso es contrato roto, porque lo que el
   * usuario teclea lo convierte quien cablea el campo, que es esta función.
   *
   * El `0` SÍ es válido y significa «enganche apagado» (semántica de
   * `edit/snap.js`); no se corrige ni se avisa.
   *
   * @param {boolean} [alArrancar=false]  En el arranque no se avisa por el panel:
   *   un `index.html` con el campo mal escrito es un defecto del programa, no algo
   *   que el usuario haya hecho, y el sitio donde se cuenta es la consola.
   * @returns {boolean}  `true` si se ha aplicado lo tecleado.
   */
  function aplicarTolerancia(alArrancar = false) {
    const cm = numeroTecleado(campoTolerancia.value)
    if (cm === null || cm < 0) {
      const mensaje =
        `Tolerancia de ajuste: «${campoTolerancia.value}» no es una distancia en centímetros ` +
        `(hace falta un número ≥ 0; 0 apaga el enganche). Se mantiene ` +
        `${FORMATO_DECLARADO.format(toleranciaEnCm())} cm.`
      if (alArrancar) console.warn(`[edicion] ${mensaje}`)
      else panel.avisar(mensaje, { nivel: NIVEL.AVISO })
      decir(mensaje, true)
      revertirTolerancia()
      return false
    }
    edicion.tolerancia(cm / CENTIMETROS_POR_METRO)
    return true
  }

  const alCambiarTolerancia = () => {
    if (aplicarTolerancia()) {
      decir(`Tolerancia de ajuste: ${FORMATO_DECLARADO.format(toleranciaEnCm())} cm.`)
    }
  }

  // ── El offset ─────────────────────────────────────────────────────────────

  const alPulsarOffset = () => {
    const metros = numeroTecleado(campoOffset.value)
    if (metros === null) {
      const mensaje =
        `Distancia de desplazamiento: «${campoOffset.value}» no es un número de metros. No se ha ` +
        `movido ningún lindero.`
      panel.avisar(mensaje, { nivel: NIVEL.AVISO })
      decir(mensaje, true)
      // Aquí NO se revierte el campo, a diferencia de la tolerancia, y la razón
      // es que no hay ningún «valor vigente» al que volver: la distancia de un
      // offset no vive en el modelo, es lo que el usuario está escribiendo ahora.
      // Borrárselo o sustituirlo le quitaría lo único que puede corregir.
      return
    }
    // La distancia baja TAL CUAL, incluido el 0: `viewer/edicion.js` ya sabe
    // contar que desplazar cero no hace nada, y adelantarnos aquí sería una
    // segunda redacción del mismo suceso.
    const { aplicado } = edicion.desplazarSeleccion(metros)
    // Las `detecciones` NO se publican otra vez: ya las ha soltado en el panel
    // `viewer/edicion.js`, verbatim y con el nivel que les toca. Ver
    // {@link MENSAJE_OFFSET_SIN_APLICAR}.
    decir(
      aplicado
        ? `Lindero desplazado ${FORMATO_SUPERFICIE.format(metros)} m.`
        : MENSAJE_OFFSET_SIN_APLICAR,
      !aplicado,
    )
  }

  // ── Los dos ganchos del Catastro ──────────────────────────────────────────

  /**
   * Ha entrado una parcela NUEVA en el store (la ha traído `cablearCatastro`).
   *
   * REINICIA el historial en vez de commitear encima, y esa es la decisión 2 de
   * F06: deshacer revierte ediciones de la geometría, nunca «la parcela que
   * traje». Un `Ctrl+Z` que devolviera la parcela anterior cambiaría la
   * referencia catastral que hay en pantalla —y con ella el GML que se
   * generaría— sin que nada lo anunciase; el usuario creería estar deshaciendo un
   * arrastre y estaría cambiando de expediente.
   *
   * Y se sueltan las COLINDANTES, por lo mismo: son las vecinas de la parcela
   * anterior. Dejarlas puestas mantendría como dianas de enganche unos linderos
   * que ya no lindan con nada, y el snap engancharía a geometría de otro sitio
   * sin que nada lo explicara.
   *
   * @param {object} parcelaNueva  La que acaba de entrar en el store.
   * @returns {void}
   */
  function alCargarParcela(parcelaNueva) {
    reiniciar(historial, parcelaNueva)
    edicion.fijarColindantes([])
    alContarColindantes(null)
    refrescar()
    decir(MENSAJE_PARCELA_NUEVA)
  }

  /**
   * Han llegado las parcelas VECINAS («Traer colindantes»).
   *
   * ⚠️ `fijarColindantes` recibe RECINTOS y F05 devuelve PARCELAS: hay que
   * APLANAR. Pasarle las parcelas sin aplanar LANZA a propósito (no aportarían ni
   * una diana y el snap parecería roto sin motivo), y ese `throw` sería un
   * defecto de esta línea, no del usuario.
   *
   * Un resultado sin dato (`ok: false`: no encontrado, red caída, consulta
   * superada) se ignora en silencio A PROPÓSITO: `cableado-catastro.js` ya lo ha
   * contado en su renglón y en el panel, con su motivo. Lo que no se hace es
   * borrar las dianas que hubiera: una consulta que falla no es una consulta que
   * devuelve cero vecinas.
   *
   * @param {{ok: boolean, datos: {colindantes?: Array<object>}|null}} resultado
   *   El `ResultadoCatastro` de `services/catastro.js#parcelaYColindantes`.
   * @returns {void}
   */
  function alColindantes(resultado) {
    if (!resultado || resultado.ok !== true || !resultado.datos) return

    const vecinas = Array.isArray(resultado.datos.colindantes) ? resultado.datos.colindantes : []
    const recintos = vecinas.flatMap((v) => (v && Array.isArray(v.recintos) ? v.recintos : []))
    edicion.fijarColindantes(recintos)
    alContarColindantes(vecinas.length)

    const cuantas =
      vecinas.length === 0
        ? 'El Catastro no ha devuelto ninguna parcela colindante'
        : vecinas.length === 1
          ? '1 parcela colindante'
          : `${FORMATO_ENTERO.format(vecinas.length)} parcelas colindantes`
    decir(
      vecinas.length === 0
        ? `${cuantas}: el ajuste sigue enganchando solo a la parcela propia.`
        : `${cuantas}: el ajuste engancha también a sus linderos.`,
    )
  }

  // ── Arranque ──────────────────────────────────────────────────────────────

  botonDeshacer.addEventListener('click', deshacer)
  botonRehacer.addEventListener('click', rehacer)
  documento.addEventListener('keydown', alPulsarTecla)
  casillaSnap.addEventListener('change', alCambiarSnap)
  campoTolerancia.addEventListener('change', alCambiarTolerancia)
  botonOffset.addEventListener('click', alPulsarOffset)

  // El botón del offset sigue a la SELECCIÓN, que vive en `viewer/edicion.js` y
  // cambia con los clics del mapa: sin lado elegido no hay nada que desplazar.
  const bajaSeleccion = edicion.alCambiarSeleccion((ref) => {
    botonOffset.disabled = ref === null
    decir(ref === null ? MENSAJE_SIN_LADO : MENSAJE_CON_LADO)
  })
  botonOffset.disabled = edicion.ladoSeleccionado() === null

  // ⚠️ EL ARRANQUE DEL ENGANCHE LO MANDA EL HTML, y esto es lo que ata las dos
  // cifras POR CONSTRUCCIÓN en vez de por casualidad: `index.html` nace con la
  // casilla marcada y con `20` en el campo (centímetros), y `crearVisor` recibe
  // `OPERATIVOS.snapMetros` (0,2 m). Aquí se empuja lo que dice el HTML, así que
  // si alguien cambia el campo, la app usa lo del campo; y si el campo dejara de
  // traer un número, {@link aplicarTolerancia} lo revierte al valor del visor —
  // que sale de `OPERATIVOS`. En los dos sentidos acaban coincidiendo, y ninguno
  // de los dos puede quedarse en silencio con la cifra del otro.
  edicion.snapActivo(casillaSnap.checked === true)
  // Y se normaliza el campo con lo que ha quedado vigente («20 » → «20»). Si lo
  // tecleado no valía, `aplicarTolerancia` ya lo ha revertido y ha dicho por qué.
  if (aplicarTolerancia(true)) revertirTolerancia()

  // La suscripción al store con el aplazamiento de la microtarea (ver el JSDoc).
  const bajaDelStore = estado.subscribe(() => queueMicrotask(refrescar))
  refrescar()

  // ── Por qué el arranque ya NO escribe aquí (2026-07-29) ────────────────────
  // Aquí se pintaba {@link MENSAJE_EDICION_INICIAL}: los tres botones nacen
  // apagados y la regla de oro 1 dice que quien deja un botón gris escribe el
  // motivo al lado. La regla sigue en pie; lo que cambió es DÓNDE cae ese texto.
  //
  // Mientras los controles vivían en el panel, era un renglón de 11 px al pie de
  // su bloque: ambiental e inofensivo. Desde que la barra flota SOBRE EL MAPA, el
  // mismo texto es un cartel de tres líneas plantado sobre la ortofoto que no se
  // va hasta la primera edición — y tapa justo la parcela que el usuario ha
  // venido a mirar. Comprobado en navegador. Cambiar de sitio un control cambia
  // lo que significa su texto, y esto es un ejemplo de manual.
  //
  // El motivo NO se pierde, se reparte donde cada control lo puede contar:
  //   · «Desplazar lindero» → el `[data-motivo="offset"]` de su propio
  //     desplegable, que `viewer/barra-edicion.js` emite y CSS enseña justo
  //     mientras el botón está apagado;
  //   · deshacer/rehacer → el panel de ayuda del botón «?», que lo dice en su
  //     primera línea, y {@link MENSAJE_SIN_DESHACER}/{@link MENSAJE_SIN_REHACER}
  //     en cuanto alguien lo intenta por atajo, que es el momento en que la
  //     pregunta se hace de verdad.
  // El renglón queda para los DESENLACES, que es lo que un `role="status"` sabe
  // anunciar sin estorbar: vacío no ocupa alto y no tapa nada.

  return {
    refrescar,
    deshacer,
    rehacer,
    alCargarParcela,
    alColindantes,

    /**
     * Retira los seis oyentes, la baja de la selección y la del store. IDEMPOTENTE.
     * No toca el historial ni el estado: los dos son del llamante.
     */
    destruir() {
      botonDeshacer.removeEventListener('click', deshacer)
      botonRehacer.removeEventListener('click', rehacer)
      documento.removeEventListener('keydown', alPulsarTecla)
      casillaSnap.removeEventListener('change', alCambiarSnap)
      campoTolerancia.removeEventListener('change', alCambiarTolerancia)
      botonOffset.removeEventListener('click', alPulsarOffset)
      bajaSeleccion()
      bajaDelStore()
    },
  }
}

// Sin nodos explícitos: los localiza `cablearEdicion` con los selectores del
// contrato, y LANZA nombrándolos si `index.html` ha dejado de traerlos. Va FUERA
// del `try` del Catastro y antes que él: la edición no depende de la red, y lo
// que ese `try` protege es una vía de ENTRADA, no la herramienta.
const edicionCableada = cablearEdicion({
  estado,
  historial,
  edicion: visor.edicion,
  panel,
  // La ficha tiene un solo dueño (el paso 4); el cableado de la edición le pasa
  // el recuento en vez de escribir en el `<dd>`.
  alContarColindantes: fijarRecuentoColindantes,
})

// ── 7 · El Catastro en vivo (F05 · T4A) ──────────────────────────────────────

/**
 * El cableado del Catastro, o `null` si no se ha podido montar. Vive FUERA del
 * `try` —donde se le asigna— porque el paso 8 lo necesita y el `const` de dentro
 * es de bloque.
 *
 * `null` no es un caso de excepción que haya que tapar: es lo que
 * `cablearDiagnostico` entiende como «no hay a quién pedirle las vecinas», y lo
 * dice en el renglón. Ocho de las nueve medidas del diagnóstico no dependen de la
 * red, así que perder la novena no puede llevarse por delante las otras ocho.
 *
 * @type {ReturnType<typeof cablearCatastro>|null}
 */
let catastroCableado = null

/**
 * El CLIENTE del Catastro, o `null` si no se ha llegado a construir. Vive fuera
 * del `try` por la misma razón que {@link catastroCableado} —el `const` de dentro
 * es de bloque y el paso 9 lo necesita—, pero **no es el mismo dato y por eso son
 * dos variables**:
 *
 *   · `catastroCableado` es la UI del bloque «Origen de la parcela» (los tres
 *     botones, el campo y el renglón). Lo consume el paso 8 para pedir vecinas.
 *   · `clienteCatastro` es el acceso al servicio, a secas. Lo consume el paso 9,
 *     que **no puede usar el cableado**: `cargar()` hace `estado.set` con la
 *     geometría del WFS y borraría la del fichero (ver la cabecera de
 *     `./cableado-comprobacion.js`). F08 pide el parcelario y COMPONE.
 *
 * Se asigna en cuanto el cliente existe y ANTES de `cablearCatastro`, a propósito:
 * si lo que revienta es el CABLEADO —un nodo que `index.html` ya no trae—, el
 * cliente está perfectamente construido y la comprobación de un fichero puede
 * seguir trayendo su parcelario. Perder la vía de entrada del Catastro no tiene
 * por qué llevarse por delante también el contraste de F08.
 *
 * @type {ReturnType<typeof crearClienteCatastro>|null}
 */
let clienteCatastro = null

/**
 * La CACHÉ del Catastro, o `null` si no se llegó a construir. Vive fuera del `try`
 * por la misma razón que las dos de arriba, y la consume el paso 12 para **una sola
 * cosa**: purgarla por antigüedad cuando el almacén local se quede sin espacio
 * (criterio 4 de F10).
 *
 * ⚠️ Se purga ESTA y no otra cosa porque es lo único de esta base que se puede
 * volver a pedir. Los expedientes y el pie de firma viven en la misma base y **no
 * son caché**: `storage/cache-catastro.js` solo enruta sus propios almacenes, y hay
 * una prueba que lo afirma sembrando los otros dos. `null` aquí no es una excepción
 * que tapar: significa que no hay nada que liberar automáticamente, y el cableado
 * del expediente lo dice en vez de fingir que lo ha intentado.
 *
 * @type {ReturnType<typeof crearCacheCatastro>|null}
 */
let cacheCatastro = null

try {
  // El transporte es el único que toca la red: cola de 2, timeout, backoff con
  // jitter. Su `alAvisar` es EL MISMO panel que todo lo demás (decisión 1).
  const transporte = crearTransporte({ alAvisar: panel.avisar })

  // ⚠️ SIN `await`, y es la decisión 2 de la cabecera: `abrirBd` devuelve una
  // promesa y `crearCacheCatastro` la acepta tal cual a propósito, resolviéndola
  // sola en su primera operación. Esperarla aquí ataría el primer pintado del
  // mapa a IndexedDB —a una base lenta, a otra pestaña que bloquea la versión, a
  // un navegador que niega el almacenamiento—, y la caché es una optimización:
  // sin base, se comporta como `CACHE_NULA` y la app funciona igual.
  const cache = crearCacheCatastro({
    bd: abrirBd({ alAvisar: panel.avisar }),
    alAvisar: panel.avisar,
  })
  // Antes de construir el cliente, por el mismo motivo escrito en {@link clienteCatastro}:
  // si lo que revienta es algo de más abajo, la caché está perfectamente construida y
  // el paso 12 puede seguir purgándola para hacer sitio.
  cacheCatastro = cache

  const cliente = crearClienteCatastro({
    transporte,
    cache,
    // EXPLÍCITO aunque hoy coincida con el `SRS_DEFAULT` del cliente: el sistema
    // de referencia es del EXPEDIENTE (el mismo que se le da al visor y el mismo
    // que se pinta en la ficha), no del servicio. El día que el expediente
    // trabaje en otro huso, el cliente lo sigue sin que haya que acordarse.
    srs: SRS_DEMO,
    // El cliente NO avisa por sus resultados —los devuelve, y el cableado los
    // publica—; este canal es solo para los fallos de la CACHÉ, que son lo único
    // suyo que no cabe en ningún resultado. Ver la decisión 1 de la cabecera.
    alAvisar: panel.avisar,
  })
  // Antes de cablear nada: ver el JSDoc de {@link clienteCatastro}. Un cableado
  // que reviente después de esta línea deja el bloque del Catastro apagado, pero
  // NO deja al paso 9 sin parcelario.
  clienteCatastro = cliente

  const catastro = cablearCatastro({
    // El MISMO store que el mapa, la tabla y la ficha. `viewer/index.js`
    // documenta que recibe el store ya hecho para que F05 pudiera compartirlo;
    // esta línea es esa promesa cobrada.
    estado,
    panel,
    cliente,
    srs: SRS_DEMO,
    // El `L.Map` del visor, para la segunda vía de la deducción: clic en el mapa
    // → geocodificación inversa (spec F05 §7.3). El cableado lo consume por duck
    // typing (`on`/`off`) y solo actúa cuando tiene sentido deducir, así que un
    // clic normal del mapa no consulta nada.
    mapa: visor.mapa,
    // ── F06 · abrir un documento nuevo ────────────────────────────────────
    // Se llama tras cada `estado.set` de una parcela TRAÍDA, y aquí eso
    // significa una sola cosa: REINICIAR el historial. Deshacer revierte
    // ediciones de la geometría, nunca «la parcela que traje» (decisión 2 de
    // F06). Ver {@link cablearEdicion}#alCargarParcela.
    alCargarParcela: edicionCableada.alCargarParcela,
    // Los seis nodos del bloque los localiza él con los selectores de su
    // contrato, y LANZA nombrándolos si `index.html` ha dejado de traerlos.
  })
  catastroCableado = catastro

  // ── F06 · las vecinas, cuando el usuario las pide ───────────────────────
  // El botón «Traer colindantes» lo cablea `cableado-catastro.js`; lo que hace
  // ESTA capa con el resultado —dianas de enganche, recuento en la ficha y, desde
  // el arreglo del check visual, CONTORNOS EN EL MAPA— está repartido entre
  // {@link cablearEdicion}#alColindantes y {@link pintarColindantes}.

  /**
   * Dibuja en el mapa las parcelas vecinas que acaba de devolver el Catastro.
   *
   * ⚠️ **LAS DOS FORMAS DEL MISMO DATO, y no se unifican.** Es la trampa que ya
   * avisa {@link cablearEdicion}#alColindantes unas cuantas líneas más arriba:
   *   · `edicion.fijarColindantes` (F06) quiere **RECINTOS APLANADOS** —le da igual
   *     de qué parcela sea cada anillo: solo busca dianas de enganche— y LANZA si
   *     se le pasan parcelas.
   *   · `visor.colindantes.pintar` quiere **PARCELAS SIN APLANAR**, `[{refcat,
   *     recintos}]`, que es la misma forma que consume `diagnosticar()`: necesita
   *     la referencia catastral de CADA vecina para su título emergente, que es
   *     justo lo que el aplanado pierde.
   * Dos consumidores con dos formas distintas del mismo resultado. Aplanar aquí
   * dejaría los emergentes mudos; no aplanar allí rompería el snap.
   *
   * Un resultado sin dato (`ok:false`) no borra lo pintado, por el mismo criterio
   * que las dianas: una consulta que falla no es una consulta que devuelve cero
   * vecinas, y `cableado-catastro.js` ya la ha contado en su renglón y en el panel.
   * Un `ok:true` con cero vecinas SÍ limpia, porque eso sí es una respuesta.
   *
   * @param {{ok: boolean, datos: {colindantes?: Array<object>}|null}} resultado
   *   El `ResultadoCatastro` de `services/catastro.js#parcelaYColindantes`.
   * @returns {void}
   */
  function pintarColindantes(resultado) {
    if (!resultado || resultado.ok !== true || !resultado.datos) return
    const vecinas = Array.isArray(resultado.datos.colindantes) ? resultado.datos.colindantes : []
    // SIN aplanar y sin traducir: la capa consume exactamente lo que el servicio
    // devuelve. Y `visor.colindantes` no puede ser `null` aquí — el paso 5 monta el
    // visor con `colindantes: true`—, así que no se comprueba: un `null` ahí sería
    // un defecto de esta casa y tiene que reventar en desarrollo, no degradarse en
    // silencio hasta el navegador del usuario.
    visor.colindantes.pintar(vecinas)
  }

  // Se comprueba la FORMA en vez de llamar a ciegas, y no es adorno defensivo:
  // sin el puente, «Traer del Catastro» y «Deducir del mapa» siguen siendo
  // perfectamente útiles, así que un cableado que no publique colindantes no
  // puede llevarse por delante el bloque entero (que es lo que haría el `catch`
  // de abajo). Lo que no se hace es callarlo: va a la consola nombrando el
  // contrato, porque un botón que consulta al Catastro y cuyo resultado nadie
  // recoge sí sería un error silencioso.
  //
  // ── AQUÍ SE ENCHUFAN DOS OYENTES, Y EN TOTAL SON TRES ───────────────────
  // `alColindantes` es una SUSCRIPCIÓN (un `Set`, con baja) y no un callback
  // único, y su JSDoc dice para qué: «F06 quiere las vecinas para el snap y F07
  // las querrá para el diagnóstico, y el segundo en llegar no puede desalojar al
  // primero en silencio». El que las DIBUJA es el TERCERO —el paso 8 registra el
  // suyo por su cuenta, al cablear el diagnóstico— y por eso puede enchufarse aquí
  // sin quitarle nada a nadie. Que sigan siendo tres lo afirma
  // `test/app/main-edicion.dom.test.js` sobre el arranque real: si algún día baja,
  // alguien ha desenchufado a uno.
  if (typeof catastro.alColindantes === 'function') {
    // 1 · Las dianas del enganche (F06) y el recuento de la ficha.
    catastro.alColindantes(edicionCableada.alColindantes)
    // 2 · Y el mapa, que era el único que no se enteraba.
    catastro.alColindantes(pintarColindantes)
  } else {
    console.warn(
      '[catastro] el cableado no publica `alColindantes(fn)`: las parcelas vecinas que se traigan ' +
        'no se dibujarán en el mapa, no se usarán como dianas de enganche y no se contarán en la ' +
        'ficha.',
    )
  }
} catch (causa) {
  // ── Aquí NO se relanza (decisión 3 de la cabecera) ─────────────────────────
  // Relanzar mataría el arranque entero: sin `app/main.js` no habría ficha ni
  // botón «Generar GML», que se cablea DESPUÉS, y el usuario perdería la app
  // completa por no poder usar UNA de sus vías de entrada. El defecto no se
  // tapa —panel como ERROR y consola— y el bloque muerto se apaga.
  console.error('[catastro] no se ha podido cablear la entrada del Catastro:', causa)
  panel.avisar(MENSAJE_SIN_CATASTRO, { nivel: NIVEL.ERROR, causa })

  // `document.querySelector` a pelo y no `nodo()`: `nodo` LANZA cuando no
  // encuentra, y lanzar DENTRO del catch de arranque volvería a tumbar la app
  // por el mismo sitio que se acaba de proteger. Aquí un nodo que falta es,
  // además, la causa más probable de haber llegado hasta este catch.
  // Los TRES botones del bloque, no dos: «Traer colindantes» (F06) también lo
  // cablea `cableado-catastro.js`, así que si su cableado revienta se queda
  // encendido y mudo — el botón que promete algo que nadie puede cumplir, que es
  // exactamente lo que este bucle existe para impedir (regla de oro 1).
  for (const selector of [
    SELECTOR_BOTON_CARGAR,
    SELECTOR_BOTON_DEDUCIR,
    SELECTOR_BOTON_COLINDANTES,
  ]) {
    const boton = document.querySelector(selector)
    if (boton !== null) boton.disabled = true
  }
  const renglonCatastro = document.querySelector(SELECTOR_ESTADO_CATASTRO)
  if (renglonCatastro !== null) renglonCatastro.textContent = MENSAJE_SIN_CATASTRO
}

// ── 8 · Diagnóstico de encaje (F07 · T5.1) ───────────────────────────────────

// Es el TERCER suscriptor del store, y no recalcula nada de lo que ya calculan los
// otros dos: la ficha del pie sigue con `edit/metricas.js` por el canal EN VIVO del
// arrastre, y el cajón con `diagnostico/parcela.js` por el del store —una vez por
// operación acabada—. Que las dos superficies coincidan es invariante, no
// casualidad: las dos miden el mismo contorno con la misma fórmula de `geo/area.js`.
//
// ⚠️ El diagnóstico NO se engancha a `alPrevisualizar`. Ese canal se dispara en cada
// FRAME del arrastre y detrás de `diagnosticar()` hay intersección topológica contra
// el contorno oficial y contra cada vecina (~67 ms medidos sobre la parcela real):
// colgarlo del frame convertiría un arrastre fluido en una presentación de
// diapositivas, y para nada, porque el diagnóstico se lee al soltar. El razonamiento
// entero está en la cabecera de `./cableado-diagnostico.js`.
//
// SIN `try`, igual que la edición del paso 6 y por lo mismo: lo único que puede
// lanzar aquí es un contrato del programador (un nodo que `index.html` ya no trae, o
// un visor montado sin `diagnostico: true`), y eso tiene que ser ruidoso en
// desarrollo, no degradarse en silencio en producción. Lo que sí está previsto —que
// el Catastro no se haya podido montar— no es una excepción: entra como `null`.

/**
 * El cableado de comprobación del paso 9, o `null` mientras no exista. **Es una
 * referencia ADELANTADA y ese es todo su motivo**: la lee el envoltorio
 * `comprobacion` de aquí abajo, que se ejecuta mucho después del arranque.
 *
 * @type {ReturnType<typeof cablearComprobacion>|null}
 */
let comprobacionCableada = null

/**
 * El cableado del expediente del paso 12, o `null` mientras no exista. **Referencia
 * ADELANTADA por exactamente el mismo motivo** que la de arriba, y aquí la lee la
 * entrada extra de fichero que el paso 9 le pasa a la zona de arrastre: soltar un
 * `.json` sobre la ventana ocurre mucho después del arranque, así que el destino se
 * resuelve TARDE en vez de congelarse en el montaje.
 *
 * `null` en el momento de soltar un fichero solo puede significar una cosa —que el
 * paso 12 reventó—, y entonces se dice: una extensión que la zona anuncia aceptar y
 * que al soltarla no hace nada es el error silencioso de manual.
 *
 * @type {ReturnType<typeof cablearExpediente>|null}
 */
let expedienteCableado = null

/**
 * El cableado del diagnóstico. **Se guarda la referencia desde F09** y no por
 * gusto: el paso 11 le pide `ultimoDiagnostico()`, que es el ÚNICO sitio donde
 * vive el diagnóstico que el cajón está enseñando ahora mismo. El informe firmable
 * tiene que imprimir esas cifras y no unas recalculadas — ver el JSDoc de aquel
 * accesor, que es donde está el porqué.
 *
 * @type {ReturnType<typeof cablearDiagnostico>}
 */
const diagnosticoCableado = cablearDiagnostico({
  estado,
  cajon: visor.diagnostico.cajon,
  contraste: visor.diagnostico.contraste,
  panel,
  // ── F08 · las dos features, enlazadas ────────────────────────────────────
  // El informe de contraste que se descarga desde el cajón de F07 lleva una
  // sección con lo que se leyó del fichero, y esa sección solo existe si la
  // parcela vino de uno. Aquí es donde se le dice de dónde sacarla.
  //
  // ⚠️ ES UN ENVOLTORIO Y NO `comprobacionCableada.comprobacion` A SECAS, porque
  // el paso 9 todavía no ha corrido: en esta línea `comprobacionCableada` vale
  // `null`, y pasar su método sería un `TypeError` en el arranque.
  //
  // Y lo que NO se hace es reordenar los pasos, que sería lo primero que se
  // ocurre. Tres razones, en orden de peso:
  //   1. La opción `comprobacion` de `cablearDiagnostico` YA ES una función por
  //      contrato, y su JSDoc dice por qué: la comprobación CAMBIA con el tiempo
  //      —entra al soltar un GML y se va al descartarlo—, así que un valor
  //      congelado en el montaje mentiría a la segunda carga. Resolverla tarde
  //      no es un apaño alrededor del orden: es exactamente la forma que ese
  //      parámetro pide. El envoltorio no añade ni una indirección nueva.
  //   2. El orden 8 → 9 es el del RECORRIDO: F08 termina entregando una parcela
  //      a F07, y el destino no puede cablearse después que su origen (ver el
  //      paso 9 de la cabecera). Invertirlos solo movería la referencia
  //      adelantada al otro lado —`cablearComprobacion` necesita el cajón de
  //      F07 para la exclusión mutua de `bottomleft`—, y encima al lado que NO
  //      la tiene prevista en su contrato.
  //   3. El defecto de esta opción es `() => null`, que es LA VÍA DE F05: quien
  //      llegó por referencia catastral descarga su informe igual, sin sección
  //      de fichero. Este envoltorio devuelve exactamente eso mientras no haya
  //      comprobación, así que la interfaz no se ramifica por procedencia.
  comprobacion: () =>
    comprobacionCableada === null ? null : comprobacionCableada.comprobacion(),
  // Se comprueba la FORMA en vez de pasarlo a ciegas, por el mismo criterio que el
  // puente de colindantes de F06 unas líneas más arriba: un cableado del Catastro
  // incompleto no puede tumbar el diagnóstico entero, que es lo que haría el
  // `throw` del contrato de `cablearDiagnostico`. Sin cliente se diagnostica igual
  // y el renglón dice que las vecinas no se han consultado — que es exactamente lo
  // que ha pasado.
  catastro:
    catastroCableado !== null &&
    typeof catastroCableado.colindantes === 'function' &&
    typeof catastroCableado.alColindantes === 'function'
      ? catastroCableado
      : null,
  // Los dos nodos del CTA los localiza él con los selectores de su contrato, y
  // LANZA nombrándolos si `index.html` ha dejado de traerlos.
})

// ── 9 · Comprobar un GML existente (F08 · T5.1) ──────────────────────────────

// La PRIMERA vía de entrada por fichero que tiene esta aplicación. Hasta aquí solo
// se podía hablar de una parcela que la app misma hubiera traído del Catastro; el
// técnico que llega con un `.gml` en la mano —el de otro despacho, el que le
// rechazaron hace dos años— no tenía dónde meterlo.
//
// SIN `try`, igual que la edición del paso 6 y el diagnóstico del paso 8, y por lo
// mismo: lo único que puede lanzar aquí es un contrato del programador (el botón
// «Abrir un GML…» que `index.html` ya no trae, un visor montado sin
// `comprobacion: true`, un `srs` que no es un huso implementado), y eso tiene que
// ser ruidoso en desarrollo en vez de degradarse en silencio en producción.
//
// Lo que SÍ está previsto —que el bloque del Catastro se haya caído— no es una
// excepción y entra como `null`: se comprueba el fichero igual, se carga su
// geometría igual, y lo único que no se puede hacer es traer el parcelario con el
// que contrastarla. Es la misma degradación honrada que el diagnóstico sin vecinas.
comprobacionCableada = cablearComprobacion({
  // El MISMO store que el mapa, la tabla, la ficha y el diagnóstico. Es el quinto
  // suscriptor, y escribe en él UNA sola vez por recorrido.
  estado,
  // La pieza SUELTA del visor (no `visor.comprobacion.cajon`): F07 son dos piezas
  // inseparables —el cajón dice las cifras y la capa las señala— y F08 es una.
  cajon: visor.comprobacion,
  panel,
  // El cliente, NO el cableado del paso 7. Ver el JSDoc de {@link clienteCatastro}:
  // `cargar()` haría `estado.set` con la geometría del WFS y borraría la del
  // fichero, que es justo lo que hay que contrastar.
  cliente: clienteCatastro,
  // El mismo SRS del expediente que reciben el visor y el cliente. El cableado lo
  // valida AL MONTAR con `husoPorSrs` —no en el primer fichero—, y además lo usa
  // para negarse a pedir el parcelario cuando el fichero declara otro: el contraste
  // entre dos husos daría cientos de kilómetros con pinta de medida.
  srs: SRS_DEMO,
  // La exclusión mutua de `bottomleft`. Soltar un fichero no es un clic, así que el
  // guardián de clic-fuera de F07 no se entera y su cajón se quedaría abierto
  // debajo; se le pasa el de F07 para que este cableado lo cierre al abrir el suyo.
  cajonDiagnostico: visor.diagnostico.cajon,
  // ── F06 · abrir un documento nuevo ────────────────────────────────────────
  // El MISMO gancho que recibe el Catastro en el paso 7, y por la MISMA razón:
  // cargar la parcela de un fichero es abrir un documento nuevo, así que el
  // historial se REINICIA en vez de commitear encima. Un `Ctrl+Z` que devolviera la
  // parcela anterior —cambiando la geometría que hay en pantalla y la que se
  // generaría— sería un error silencioso disfrazado de función (decisión 2 de F06).
  alCargarParcela: edicionCableada.alCargarParcela,
  // ── F10 · el `.json` entra por ESTA zona y no por una segunda ─────────────
  // `crearZonaFichero` engancha el arrastre en la VENTANA ENTERA: dos zonas vivas
  // harían `preventDefault` las dos sobre el mismo `drop` y entregarían el mismo
  // fichero a dos destinos. Así que la que ya existe acepta también `.json` y
  // enruta por extensión — el mecanismo está en `cablearComprobacion`, y de ahí
  // sale además el texto del velo («Suelta aquí el fichero (.gml, .xml o .json)»).
  //
  // El destino se resuelve TARDE, igual que el envoltorio `comprobacion` del paso
  // 11: el paso 12 todavía no ha corrido cuando se monta esto.
  entradasExtra: [
    {
      extensiones: EXTENSIONES_PROYECTO,
      alFichero: (fichero) => {
        if (expedienteCableado === null) {
          panel.avisar(MENSAJE_SIN_EXPEDIENTE, { nivel: NIVEL.ERROR })
          return
        }
        // La promesa se suelta a propósito: `abrirProyecto` no lanza y cuenta por
        // el panel todo lo que decide (es la lección de F08 entera).
        expedienteCableado.abrirProyecto(fichero)
      },
    },
  ],
  // El botón del rótulo y el renglón de procedencia los localiza él con los
  // selectores de su contrato, y LANZA nombrándolos si `index.html` no los trae.
  // El `<input type="file">` y la superposición de arrastre NO están en la cáscara:
  // los fabrica `app/zona-fichero.js`, y `index.html` lo dice por escrito.
})

// ── 10 · Generación del GML (F04 · T6.1) ─────────────────────────────────────

/**
 * Referencia catastral REAL de una parcela, o `null` si no tiene.
 *
 * Se comprueba el CONTENIDO y no sólo la presencia: una `refcat` de espacios en
 * blanco no es una referencia, y colarla haría que el nombre del fichero llevara
 * un segmento vacío en vez de decir «sin referencia».
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {string|null}
 */
function referenciaCatastralDe(parcelaActual) {
  const refcat = parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.refcat
  return typeof refcat === 'string' && refcat.trim().length > 0 ? refcat : null
}

/**
 * IDENTIDAD de la parcela para `serializarParcelaCp`: `refcat ?? idLocal ??`
 * {@link IDENTIDAD_SIN_REFERENCIA}. De ella salen el `<localId>` del `inspireId`
 * y la base de los cuatro `gml:id`.
 *
 * NO es lo mismo que la referencia catastral, y por eso son dos funciones:
 *   · la IDENTIDAD nunca puede faltar (el serializador lanza con ella en blanco)
 *     y en un alta de particular es legítimo que sea el `idLocal` del modelo —es
 *     justo el patrón de `UTM_1.gml`, el alta real de un particular;
 *   · la REFERENCIA sí puede faltar, y cuando falta hay que DECIRLO en vez de
 *     rellenar el hueco con la identidad interna. `nombreFicheroGml` ya tiene el
 *     texto para eso («sin-referencia»); dárselo hecho sería tapárselo.
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {string}  Siempre un string no vacío.
 */
function identidadDe(parcelaActual) {
  const idLocal =
    parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.idLocal
  const local = typeof idLocal === 'string' && idLocal.trim().length > 0 ? idLocal : null
  return referenciaCatastralDe(parcelaActual) ?? local ?? IDENTIDAD_SIN_REFERENCIA
}

/**
 * La pareja `localId` ↔ `namespace` del `inspireId`, que la FAQ del Catastro fija
 * y que hasta el 2026-07-27 esta app incumplía.
 *
 * La regla, literal («¿Cómo nombrar las parcelas dentro de un GML de parcela
 * catastral?»):
 *
 *   · «Si la parcela está inscrita en las bases de datos de catastro, o se desea
 *     conservar la referencia catastral […], el valor del atributo identificativo
 *     localId será la referencia catastral y el valor del atributo namespace
 *     empleado será ES.SDGC.CP.»
 *   · «Si la parcela no existe en la base de datos de catastro se deberá emplear
 *     el valor del atributo namespace ES.LOCAL.CP y un identificador unívoco
 *     dentro del negocio jurídico.»
 *
 * O sea: los dos campos son UNA sola afirmación, no dos ajustes independientes.
 * La app venía poniendo la referencia catastral real como `localId` bajo
 * `ES.LOCAL.CP`, que dice a la vez «esta es su referencia catastral» y «esta
 * parcela no existe en el Catastro». Eso no era una preferencia discutible: era
 * una contradicción dentro del mismo elemento.
 *
 * `nationalCadastralReference` acompaña al namespace y no se decide aparte,
 * porque afirma exactamente lo mismo que `ES.SDGC.CP`: que la finca está inscrita
 * con esa referencia. Dejarlo vacío junto a `ES.SDGC.CP` sería volver a partir en
 * dos una única afirmación.
 *
 * El caso normal de esta herramienta es el segundo párrafo de arriba y a la vez
 * el primero: una RGA **alternativa** sobre una parcela que SÍ existe —el técnico
 * descarga su cartografía, corrige el lindero y vuelve a subirlo—, y ahí la
 * referencia se conserva. Sin referencia, es un alta y va todo a `ES.LOCAL.CP`.
 *
 * `cp:label` se queda VACÍO en los dos casos: es el número de orden de la parcela
 * dentro de un polígono y esta app no lo conoce. Vacío valida (su tipo no tiene
 * `minLength`, comprobado contra el XSD).
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {{namespaceInspire: string, nationalCadastralReference: string}}
 */
function identidadInspireDe(parcelaActual) {
  const refcat = referenciaCatastralDe(parcelaActual)
  return refcat === null
    ? { namespaceInspire: NAMESPACE_INSPIRE_DEFECTO, nationalCadastralReference: '' }
    : { namespaceInspire: NAMESPACE_INSPIRE_CATASTRO, nationalCadastralReference: refcat }
}

/**
 * Texto del renglón cuando la VALIDACIÓN bloquea: cuántos errores son y cuáles.
 *
 * El recuento va delante y completo; lo que se recorta es la enumeración (ver
 * {@link MOTIVOS_EN_RENGLON}). Un «no se puede generar» a secas —o, peor, un
 * botón gris y mudo— es un error silencioso de manual: el usuario ve apagado lo
 * único que la pantalla le ofrece hacer y no tiene forma de saber por qué.
 *
 * @param {import('../validation/_comun.js').Hallazgo[]} errores  Lista NO vacía.
 * @returns {string}
 */
function motivoDeBloqueo(errores) {
  const distintos = [...new Set(errores.map((e) => e.mensaje))]
  const visibles = distintos.slice(0, MOTIVOS_EN_RENGLON)
  const resto = distintos.length - visibles.length
  const recuento =
    errores.length === 1
      ? '1 error bloquea la generación del GML'
      : `${errores.length} errores bloquean la generación del GML`
  return (
    `${recuento}: ${visibles.join(' ')}` + (resto > 0 ? ` (…y ${resto} motivo(s) más.)` : '')
  )
}

/**
 * Texto del renglón cuando es el SERIALIZADOR el que no emite fichero. Es un
 * caso distinto del anterior y por eso tiene su propio texto: aquí la validación
 * de F02 dio el visto bueno y lo que ha aparecido es algo que sólo se ve al
 * redondear y al escribir (dos vértices que se funden, un punto de referencia
 * imposible). Decir «hay errores en la parcela» sería confuso; lo que hay es un
 * GML que no se puede escribir bien, y el detalle acaba de entrar en el panel.
 *
 * @param {string[]} bloqueos  `resumen.bloqueos` del serializador (tipos, sin repetir).
 * @returns {string}
 */
function motivoSinFichero(bloqueos) {
  const cuantos =
    bloqueos.length === 1
      ? 'ha aparecido un problema bloqueante'
      : `han aparecido ${bloqueos.length} problemas bloqueantes`
  return (
    `No se ha descargado ningún fichero: al escribir el GML ${cuantos} ` +
    `(${bloqueos.join(', ')}). El detalle está en el panel de avisos.`
  )
}

/**
 * Cablea el botón «Generar GML» del pie: el último metro de F04 y lo único de
 * toda la feature que el usuario llega a ver.
 *
 * ── QUÉ HACE AL PULSAR, EN ORDEN ──
 *   1. VALIDA con `validation/parcela.js`. Si `puedeGenerar` es `false` no se
 *      genera NADA y cada error entra por el panel con su mensaje.
 *   2. SERIALIZA con `gml/serialize-cp.js`.
 *   3. PUBLICA EN EL PANEL **TODAS** las detecciones del serializador. Este paso
 *      no es cosmético: es la regla de oro 1 viviendo aquí. Es la ÚNICA
 *      superficie de la aplicación donde el usuario se entera de que se le ha
 *      redondeado una coordenada, invertido un anillo o recalculado el punto de
 *      referencia — cosas que ocurren en silencio dentro de `gml/` y que hacen
 *      que el fichero que baja NO sea exactamente el dibujo que tenía delante.
 *      La severidad se traduce con {@link NIVEL_POR_SEVERIDAD}.
 *   4. DESCARGA si hay `xml`. Si es `null` lo dice en el renglón y no descarga:
 *      `descargarGml` tampoco bajaría nada (devolvería `SIN_CONTENIDO`), pero
 *      llamarlo para que diga que no puede sería pedirle que rediagnostique algo
 *      que ya sabemos.
 *
 * ── EL ESTADO DEL BOTÓN SE RE-EVALÚA, NO SE FIJA UNA VEZ ──
 * Va por `estado.subscribe`, igual que la ficha del pie, y no sólo al arrancar.
 * F06 permite mover vértices: un botón evaluado una única vez seguiría diciendo
 * «se puede generar» después de que el usuario cruzara el contorno consigo mismo,
 * y esa mentira acabaría en un GML rechazado por la Sede. `subscribe` NO notifica
 * al suscribirse, así que la primera evaluación se hace a mano. Desde F06 el
 * store cambia además al insertar, eliminar, desplazar un lindero y al
 * deshacer/rehacer: las cinco operaciones pasan por `set` y las cinco vuelven a
 * evaluar el botón, incluido el undo —que puede devolver la parcela a un estado
 * generable, o sacarla de él.
 *
 * ⚠️ CADENCIA — LA NOTA QUE F06 CIERRA. Se valida en CADA `set`, y hasta F06 esta
 * nota anunciaba que aquí acabaría haciendo falta un DEBOUNCE «cuando el arrastre
 * de un vértice dispare un `set` por movimiento del ratón».
 *
 * **Eso no ha pasado, y ya no va a pasar.** El arrastre nunca ha tocado el store
 * por fotograma —`sincronizacion.js` mueve el marcador, el punto del polígono y
 * su fila en vivo, y hace UN `set` y UN `commit` en el `dragend`— y F06 ha
 * mantenido esa propiedad al añadir las vistas en vivo: superficie, perímetro,
 * Δ y acotaciones se alimentan de un canal APARTE (`alPrevisualizar`) que recibe
 * los anillos en vuelo y **no escribe en el estado**. El store sigue cambiando
 * una vez por operación acabada, que es exactamente la cadencia para la que esta
 * validación está dimensionada.
 *
 * Lo que sigue vigente de la advertencia de `validation/parcela.js` es que sus
 * reglas topológicas son O(n²) y que la cadencia es responsabilidad de esta capa.
 * Si algún día alguien enchufa al store algo que escriba por fotograma —dibujo
 * continuo, un lazo de selección—, el debounce va AQUÍ y no en `validation/`. Con
 * el diseño actual sería complejidad sin caso de uso: añadirlo retrasaría el
 * apagado del botón tras una operación que ya ha terminado.
 *
 * ── POR QUÉ EL MANEJADOR NO SE FÍA DE `boton.disabled` ──
 * Vuelve a validar antes de generar. `disabled` es estado de PRESENTACIÓN: lo
 * escribe este mismo módulo a partir de una validación anterior, y entre una y
 * otra puede haber pasado cualquier cosa. Confiar en él sería hacer que la
 * corrección del fichero dependiera de que un atributo del DOM esté al día.
 *
 * @param {object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El MISMO
 *   store que el mapa, la tabla y la ficha.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos ya
 *   montado: por él salen los errores de validación y las detecciones de `gml/`.
 * @param {string} opciones.srs  SRS del expediente (`'EPSG:25830'`…).
 * @param {HTMLElement} [opciones.boton]  Por defecto, el nodo
 *   {@link SELECTOR_BOTON_GML} de la cáscara; si falta, `nodo` LANZA.
 * @param {HTMLElement} [opciones.renglon]  Ídem con {@link SELECTOR_ESTADO_GML}.
 * @param {() => Date} [opciones.ahora]  De dónde sale «ahora». Por defecto el
 *   reloj del sistema. Es un parámetro y no una llamada directa porque la fecha
 *   entra en el GML *y* en el nombre del fichero: poder fijarla es lo que permite
 *   afirmar algo exacto sobre los dos en una prueba. `gml/` no lo puede hacer por
 *   su cuenta (no consulta el reloj, por contrato).
 * @param {typeof descargarGml} [opciones.descargar]  La entrega del fichero.
 * @returns {{generar: () => (object|null), destruir: () => void}}  `generar`
 *   ejecuta el recorrido completo y devuelve el `ResultadoDescarga` (o `null` si
 *   no se llegó a descargar); `destruir` retira el oyente y la suscripción.
 * @throws {TypeError}  Si falta el botón o el renglón en la cáscara (contrato
 *   con `index.html`), vía {@link nodo}.
 */
export function cablearGeneracionGml({
  estado,
  panel,
  srs,
  boton = nodo(SELECTOR_BOTON_GML),
  renglon = nodo(SELECTOR_ESTADO_GML),
  ahora = () => new Date(),
  descargar = descargarGml,
} = {}) {
  /**
   * Escribe el renglón `role="status"`. Vacío + sin modificador es el estado
   * «todo en orden»: el CSS lo colapsa y el pie no da un salto de layout.
   *
   * @param {string} texto
   * @param {boolean} esError
   */
  function decir(texto, esError) {
    renglon.textContent = texto
    renglon.classList.toggle(CLASE_ESTADO_ERROR, esError)
  }

  /**
   * Valida el POJO que haya en el store. El `|| []` no es paranoia: el store
   * admite `null` (es su valor inicial documentado) y `validarParcela` LANZA si
   * no le dan un array — y lo hace con razón, porque para él eso es contrato
   * roto. Aquí «no hay parcela» es un estado legítimo de la app, y la respuesta
   * correcta es un array vacío, que la primera regla traduce a «falta el
   * contorno exterior»: un error del expediente, no una excepción.
   *
   * @param {object|null} parcelaActual
   * @returns {{errores: object[], avisos: object[], puedeGenerar: boolean}}
   */
  function validar(parcelaActual) {
    const recintos = (parcelaActual && parcelaActual.recintos) || []
    return validarParcela(recintos, { srs })
  }

  /** Deja el botón apagado y el renglón diciendo por qué. */
  function bloquear(errores) {
    boton.disabled = true
    decir(motivoDeBloqueo(errores), true)
  }

  /**
   * Suscriptor del store: re-evalúa si se puede generar y lo refleja en el par
   * botón + renglón. Los dos SIEMPRE a la vez — un botón apagado sin motivo al
   * lado es lo que este cableado existe para no producir.
   *
   * @param {object|null} parcelaActual
   */
  function refrescar(parcelaActual) {
    let errores
    let puedeGenerar
    try {
      ;({ errores, puedeGenerar } = validar(parcelaActual))
    } catch (causa) {
      // ── Aquí NO se relanza, y es la única excepción de este módulo ────────
      // `refrescar` corre en dos sitios donde relanzar hace más daño que bien:
      // al CABLEAR (dentro del ensamblaje de `app/main.js`) y desde un
      // `estado.subscribe`. Que `validarParcela` reviente por un dato corrupto
      // —comprobado: con una coordenada no finita lanza desde
      // `geo/huso.js#detectarHuso`— no es hipotético, porque el store admite
      // cualquier POJO sin validarlo.
      //
      // Si esto relanzara, la app entera dejaría de arrancar: no habría mapa, ni
      // tabla, ni ficha, ni panel de avisos. Y el usuario perdería justamente lo
      // que necesita para entender qué tiene mal. Apagar el botón y decirlo
      // conserva todo lo demás en pie, que es lo útil.
      //
      // El defecto NO se tapa: va a la consola por `console.error` y al panel
      // como ERROR. Lo que no hace es llevarse por delante la aplicación.
      boton.disabled = true
      decir(MENSAJE_FALLO_INESPERADO, true)
      panel.avisar(MENSAJE_FALLO_INESPERADO, { nivel: NIVEL.ERROR, causa })
      console.error('[gml] no se ha podido evaluar si la parcela puede generarse:', causa)
      return
    }
    if (puedeGenerar) {
      boton.disabled = false
      decir('', false)
      return
    }
    bloquear(errores)
  }

  /**
   * El recorrido completo. Ver la cabecera de {@link cablearGeneracionGml}.
   *
   * @returns {object|null}  El `ResultadoDescarga` de `gml/descargar.js`, o
   *   `null` si no se llegó a intentar la descarga.
   */
  function generar() {
    // En qué punto del recorrido estamos. Sirve para una sola cosa: elegir el
    // mensaje del `catch`. Se usa un marcador de fase en vez de un `try` anidado
    // alrededor de la entrega porque el anidado NO funciona —lo comprobé
    // rompiéndolo—: el `catch` interior escribe su mensaje, relanza, y el
    // exterior vuelve a capturar la MISMA excepción y pisa el renglón con el
    // mensaje genérico. El usuario acababa leyendo «fallo interno» cuando lo que
    // había fallado era la descarga de un GML perfectamente generado.
    let fase = FASE.GENERACION
    try {
      return recorrido(() => {
        fase = FASE.ENTREGA
      })
    } catch (causa) {
      const mensaje = fase === FASE.ENTREGA ? MENSAJE_FALLO_ENTREGA : MENSAJE_FALLO_INESPERADO
      // ── La red de la regla de oro 1 ───────────────────────────────────────
      // Un CONTRATO ROTO en las capas de abajo no llega como hallazgo: llega
      // como excepción. Y hay un camino MEDIDO, no hipotético, para que ocurra:
      // el store admite cualquier POJO (`crearEstadoVista` no valida nada) y
      // `crearRecinto` sólo protege a quien pase por él, así que una parcela con
      // una coordenada no finita puede acabar dentro. Comprobado ejecutándolo:
      // con un `NaN` en un vértice, `validarParcela` LANZA —no lo deja pasar en
      // silencio— desde `geo/huso.js#detectarHuso` («coordenada no finita»).
      // `serializarParcelaCp` lanza por su cuenta ante un `srs` no soportado o
      // una coordenada no publicable (`|v| >= 1e15`).
      //
      // Sin este `catch`, cualquiera de esas excepciones sube desde un manejador
      // de `click` y el usuario ve un botón que NO HACE NADA: pulsa, no baja
      // ningún fichero y nada le dice por qué. Eso es un error silencioso de
      // manual, y la regla de oro 1 dice que el usuario se entera.
      //
      // Por eso envuelve al recorrido ENTERO y no sólo a la serialización: el
      // primer camino real que encontré entra por la validación, que es el paso
      // 1. Un `catch` alrededor del paso 2 habría sido una red colocada justo
      // donde no está el agujero.
      //
      // Y se RELANZA a propósito: esto es un defecto de programación, así que
      // sigue teniendo que aparecer en la consola y en cualquier recogida de
      // errores. Decirlo al usuario Y relanzarlo atiende a los dos destinatarios;
      // tragárselo sería el otro error de la misma familia.
      decir(mensaje, true)
      panel.avisar(mensaje, { nivel: NIVEL.ERROR, causa })
      throw causa
    }
  }

  /**
   * El recorrido propiamente dicho, sin la red de {@link generar}.
   *
   * @param {() => void} entrandoEnEntrega  Se llama justo antes de intentar la
   *   descarga, para que {@link generar} sepa qué mensaje toca si algo revienta
   *   a partir de ahí. Ver el comentario del `catch`.
   * @returns {object|null}  El `ResultadoDescarga` de `gml/descargar.js`, o
   *   `null` si no se llegó a intentar la descarga.
   */
  function recorrido(entrandoEnEntrega) {
    const parcelaActual = estado.get()

    // ── 1 · Validación ──────────────────────────────────────────────────────
    const { errores, puedeGenerar } = validar(parcelaActual)
    if (!puedeGenerar) {
      // Al panel, uno por uno y con su mensaje: es donde el usuario puede leerlos
      // enteros (el renglón sólo cabe resumir). `e.nivel` ya es `NIVEL.ERROR` —se
      // pasa el del hallazgo en vez de escribirlo, para que las dos capas no
      // puedan divergir.
      for (const e of errores) panel.avisar(e.mensaje, { nivel: e.nivel })
      bloquear(errores)
      return null
    }

    // ── 2 · Serialización ───────────────────────────────────────────────────
    // Un solo instante para el fichero y para su nombre (ver la cabecera del
    // módulo, decisión 1).
    const fecha = ahora()
    const { xml, resumen, detecciones } = serializarParcelaCp({
      recintos: parcelaActual.recintos,
      srs,
      refcat: identidadDe(parcelaActual),
      // El PERFIL va EXPLÍCITO aunque hoy sea el defecto del serializador: es la
      // diferencia entre un fichero que la Sede admite y uno que rechaza, y no
      // puede quedar colgando de un valor por omisión de otro módulo.
      perfil: PERFIL.ENTREGA,
      // `namespaceInspire` y `nationalCadastralReference` son UNA sola decisión y
      // salen juntos de un solo sitio: ver {@link identidadInspireDe}.
      ...identidadInspireDe(parcelaActual),
      // `beginLifespanVersion` NO se pasa a propósito: en el perfil de entrega su
      // ausencia emite `xsi:nil="true" nilReason="other:unpopulated"`, que es lo
      // que trae la plantilla oficial y lo único honesto en un alta — desde
      // cuándo rige esa versión del objeto lo fija el Catastro al inscribirla, no
      // el declarante al subir el fichero. La `fecha` se sigue necesitando, pero
      // para el NOMBRE del fichero, que es lo de abajo.
      //
      // `label`, `puntoReferencia` y `timeStamp` se dejan en su defecto: el
      // primero porque esta app no conoce el número de orden de la parcela, y los
      // otros dos porque el perfil de entrega no los escribe.
    })

    // ── 3 · Regla de oro 1: TODO lo que decidió el serializador, al panel ────
    for (const d of detecciones) {
      panel.avisar(d.mensaje, { nivel: NIVEL_POR_SEVERIDAD[d.severidad] ?? NIVEL.AVISO })
    }

    // ── 4 · Entrega ─────────────────────────────────────────────────────────
    if (xml === null) {
      decir(motivoSinFichero(resumen.bloqueos), true)
      return null
    }

    // A partir de aquí el fallo se cuenta con un mensaje DISTINTO: el GML ya está
    // generado y sus detecciones ya están publicadas, así que lo que puede fallar
    // es la descarga (el navegador niega `createObjectURL`, la pestaña se está
    // cerrando). Para el usuario «tu dato no se puede escribir» y «el fichero está
    // bien pero no ha bajado» son cosas distintas y llevan a acciones distintas;
    // un solo mensaje para las dos le haría buscar el problema donde no está.
    entrandoEnEntrega()

    // La REFERENCIA (no la identidad) es lo que va en el nombre del fichero, y
    // la MISMA `fecha` que lleva dentro el `beginLifespanVersion`.
    const entrega = descargar(xml, { refcat: referenciaCatastralDe(parcelaActual), fecha })
    // El desenlace se dice SIEMPRE, salga bien o mal. Cuando falla, `descargarGml`
    // trae un `mensaje` en castellano ya presentable: se muestra tal cual y no se
    // duplica en el panel, porque el panel es para lo que le pasa al DATO y esto
    // es lo que le ha pasado a la ENTREGA.
    decir(
      entrega.descargado ? `Descargado «${entrega.nombre}».` : entrega.mensaje,
      !entrega.descargado,
    )
    return entrega
  }

  boton.addEventListener('click', generar)
  const desuscribir = estado.subscribe(refrescar)
  // Igual que la ficha: `subscribe` NO notifica al suscribirse, así que el primer
  // estado del botón se calcula a mano. Sin esta línea el botón se quedaría en el
  // `disabled` con el que nace en `index.html` —y con el renglón vacío— hasta la
  // primera edición: exactamente el botón gris y mudo que no se admite.
  refrescar(estado.get())

  return {
    generar,
    destruir() {
      boton.removeEventListener('click', generar)
      desuscribir()
    },
  }
}

// Sin nodos explícitos: los localiza `cablearGeneracionGml` con los selectores
// del contrato, y LANZA nombrándolos si `index.html` ha dejado de traerlos.
cablearGeneracionGml({ estado, panel, srs: SRS_DEMO })

// ── 11 · Informe de contraste firmable en PDF (F09 · T5.1) ───────────────────

// El último metro de F09 y lo único de toda la fase que el usuario llega a tocar:
// «Preparar informe (PDF)» → datos descriptivos del Catastro → diálogo con el
// lindero redactado y la firma recordada → «Componer PDF» → plano a 300 ppp →
// maqueta → los bytes en la carpeta de descargas.
//
// Es el SEXTO suscriptor del mismo store, y como los otros cinco no recalcula nada
// de lo que ya calcula otro: el diagnóstico se lo presta el paso 8 y las vecinas se
// las presta el paso 7. Lo único que este cableado consulta por su cuenta es el
// servicio DESCRIPTIVO (`Consulta_DNPRC`), que es una petición por expediente y el
// presupuesto de red entero de la fase.
//
// SIN `try`, igual que los pasos 6, 8 y 9 y por lo mismo: lo único que puede lanzar
// aquí es un contrato del programador (un visor montado sin `diagnostico: true`, un
// `srs` que no es un huso). Lo que sí está previsto entra como `null` y se dice.
//
// **`index.html` no se toca en F09**: el `<dialog>` lo fabrica
// `app/dialogo-informe.js` —igual que `app/zona-fichero.js` fabrica su
// `<input type="file">`— y los dos botones del pie los fabrica
// `viewer/cajon-diagnostico.js`.
cablearInforme({
  // El MISMO store que el mapa, la tabla, la ficha, el diagnóstico, la comprobación
  // y el botón del GML. No escribe en él: un informe mide y maqueta, no edita.
  estado,
  // La misma pieza que consume el paso 8. Los dos botones del pie del cajón viven
  // en la misma fila y los enciende el mismo gate, así que los dos cableados montan
  // sobre el mismo cajón — cada uno por su canal (`alDescargar` / `alPreparar`).
  cajon: visor.diagnostico.cajon,
  panel,
  // El SRS del expediente: el mismo que reciben el visor, el cliente y F08. Se
  // imprime en el encabezado, se rotula bajo el plano y es con el que se le pide la
  // cartografía al WMS.
  srs: SRS_DEMO,
  // ⚠️ EL DIAGNÓSTICO NO SE RECALCULA: se lee el que el cajón está enseñando. Ver
  // `cablearDiagnostico#ultimoDiagnostico`. Se pasa el método SIN invocar —es una
  // función por contrato— porque el diagnóstico cambia con cada edición y un valor
  // congelado en el montaje sería siempre `null`.
  diagnostico: diagnosticoCableado.ultimoDiagnostico,
  // El CLIENTE, no el cableado del paso 7: de él solo se usa
  // `descriptivosPorRefcat`, y `null` (el bloque del Catastro se cayó) es una
  // respuesta prevista — el informe se prepara igual y el encabezado dice que no se
  // ha consultado.
  cliente: clienteCatastro,
  // Y el CABLEADO, esta vez, solo para SUSCRIBIRSE a las colindantes: de ellas sale
  // la atribución de cada lindero en la descripción literaria. Es el CUARTO oyente
  // de `alColindantes` —un `Set` con baja, precisamente para que el que llega no
  // desaloje al que estaba— y **no dispara ninguna consulta**: se cuelga de la que
  // el cajón del diagnóstico ya hace al abrirse. Se comprueba la FORMA en vez de
  // pasarlo a ciegas, por el mismo criterio que el puente de colindantes de F06 y
  // que el `catastro:` del paso 8.
  catastro:
    catastroCableado !== null && typeof catastroCableado.alColindantes === 'function'
      ? catastroCableado
      : null,
  // El pie de firma recordado. `abrirBd` MEMOIZA su conexión, así que esta llamada
  // reutiliza la que abrió la caché del Catastro en el paso 7 en vez de abrir una
  // segunda; y va sin `await` por lo mismo que allí: preparar un informe no puede
  // quedarse esperando a IndexedDB, y sin base el almacén se comporta como si no
  // hubiera nada recordado (y lo dice por el panel).
  pieFirma: crearPieDeFirmaGuardado({
    bd: abrirBd({ alAvisar: panel.avisar }),
    alAvisar: panel.avisar,
  }),
  // El MISMO envoltorio que el paso 8, y por la misma razón escrita allí: la
  // comprobación cambia con el tiempo —entra al soltar un GML y se va al
  // descartarlo—, así que se resuelve tarde. Aquí, además, `comprobacionCableada`
  // YA está asignado (el paso 9 corrió antes), pero el envoltorio se conserva
  // porque lo que hace falta no es esquivar el orden: es no congelar el valor.
  comprobacion: () =>
    comprobacionCableada === null ? null : comprobacionCableada.comprobacion(),
})

// ── 12 · Persistencia y exportación (F10 · T5.1) ─────────────────────────────

// Once fases después, la aplicación **por fin recuerda**. Hasta esta línea, recargar
// la pestaña tiraba el trabajo entero: no había ni una línea de almacenamiento, ni un
// flag de sucio, ni forma de llevarse un expediente a otro equipo. Y aquí es también
// donde `crearExpediente` —que existe en `model/parcela.js` desde F00 y cuyo único
// llamante en todo el repo era `test/contrato.test.js`— **estrena llamante en
// producción**, con el `srs` saliendo de `./demo-datos.js` tal y como la cabecera de
// aquel fichero lleva pidiendo desde F03.
//
// Va EL ÚLTIMO, después incluso del informe, y no por antigüedad: es el que más
// piezas de pasos anteriores consume y el único que las consume TODAS ya montadas.
//   · el store (paso 2) — es su SÉPTIMO suscriptor, y el primero que no dibuja nada
//     con lo que oye: lo usa para saber si lo que hay en pantalla es una edición del
//     mismo documento o un documento nuevo;
//   · el gancho de la EDICIÓN (paso 6), porque recuperar un expediente es abrir un
//     documento nuevo y el historial se reinicia en vez de commitear encima;
//   · la CACHÉ del Catastro (paso 7), y **solo para purgarla** cuando el almacén se
//     quede sin espacio. Ver {@link cacheCatastro};
//   · la COMPROBACIÓN (paso 9), para que «Abrir un proyecto…» abra el selector de la
//     ÚNICA zona de fichero de la aplicación en vez de fabricar una segunda.
//
// ⚠️ SIN `try`, igual que los pasos 6, 8, 9 y 11: lo único que puede lanzar aquí es
// un contrato del programador —el botón «Expediente» que `index.html` ya no trae, un
// `srs` que el modelo no admite—. Y como es el ÚLTIMO paso, un `catch` no protegería
// a nadie de nada: lo que hay debajo ya está montado. Lo que sí está previsto —que no
// haya almacén local, que la caché no se montara— entra como degradación y se dice.
//
// **`index.html` aporta un botón y nada más**: el `<dialog>` lo fabrica
// `app/dialogo-expediente.js`, igual que hicieron `app/zona-fichero.js`, los dos
// cajones y el diálogo de F09.
expedienteCableado = cablearExpediente({
  // El MISMO store que las otras seis vistas.
  estado,
  panel,
  // El SRS del expediente: el mismo que reciben el visor, el cliente, F08 y F09. Aquí
  // deja de ser un dato suelto y pasa a ser lo que siempre debió ser — un campo del
  // Expediente—, que es literalmente lo que `./demo-datos.js` lleva pidiendo desde F03.
  srs: SRS_DEMO,
  // ⚠️ `abrirBd` MEMOIZA su conexión, así que esta llamada reutiliza la que abrió la
  // caché del Catastro en el paso 7 (o la del pie de firma en el 11) en vez de abrir
  // una tercera; y va SIN `await` por lo mismo que allí: el almacén se resuelve solo
  // en su primera operación, y atar el arranque a IndexedDB —a una base lenta, a otra
  // pestaña que bloquea la versión, a un navegador que niega el almacenamiento— es
  // justo lo que la decisión 2 de esta cabecera se negó a hacer.
  expedientes: crearExpedientes({
    bd: abrirBd({ alAvisar: panel.avisar }),
    alAvisar: panel.avisar,
  }),
  // `navigator.storage` se toma del entorno (el defecto de `crearCuota`): aquí sí
  // existe. El canal de avisos es solo para cuando una llamada LANZA — un «no» del
  // navegador a `persist()` no es un incidente, es la respuesta normal y MEDIDA.
  cuota: crearCuota({ alAvisar: panel.avisar }),
  // `null` cuando el bloque del Catastro se cayó, y `null` ahí es una respuesta
  // prevista: no hay nada que liberar y el cableado lo dice.
  cache: cacheCatastro,
  // El MISMO gancho que reciben el Catastro (paso 7) y la comprobación (paso 9).
  alCargarParcela: edicionCableada.alCargarParcela,
  // Se comprueba la FORMA en vez de pasarlo a ciegas, mismo criterio que el `catastro:`
  // del paso 11: sin este canal, «Abrir un proyecto…» lo DICE en lugar de ser un botón
  // que no hace nada, y el arrastre sobre la ventana sigue funcionando igual.
  elegirFichero:
    comprobacionCableada !== null && typeof comprobacionCableada.elegirFichero === 'function'
      ? () => comprobacionCableada.elegirFichero()
      : null,
})
