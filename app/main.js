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
//                   ⭐ DESDE F11 la ficha tiene DOS caras, porque hay dos
//                   documentos posibles: ver {@link repintarFicha}. Cinco de sus
//                   ocho renglones hablan de la parcela, así que con la rama
//                   EDIFICIO puesta **estarían mintiendo**; se recorta a cuatro y
//                   eso libera 75,75 px medidos para la lista de partes.
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
//                   ⭐ DESDE F11 este paso reparte también lo que NO es de su tema,
//                   y por dos mecanismos distintos que conviene no confundir:
//                     · por EXTENSIÓN (`entradasExtra`) — el `.json` del expediente
//                       (F10) y el `.dxf`/`.txt` del edificio (F11). La zona de
//                       arrastre es UNA sola en toda la aplicación, así que quien
//                       quiera una familia de ficheros la declara aquí;
//                     · por CONTENIDO (`alGmlDeEdificio`, F11) — un `.gml` es un
//                       `.gml` hasta que se lee, y solo entonces se sabe si describe
//                       una parcela o una construcción. El GML de edificio deja de
//                       ser el callejón sin salida que F08 declaró «a medias».
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
//  13. RAMA Y     — `cablearRama(...)` de `./rama.js`, `crearPanelEdificio(...)` de
//      EDIFICIO     `./panel-edificio.js` y `cablearEdificio(...)` de
//                   `./cableado-edificio.js` (F11, tarea T4.1). **Aquí la
//                   aplicación deja de tener un solo tema.** Hasta este paso todo
//                   lo de arriba habla de parcelas: el store lleva una, el panel se
//                   titula «Origen de la parcela», la ficha del pie mide su
//                   contorno y el pie genera su GML. F11 añade un conmutador en la
//                   cabecera y un SEGUNDO panel que SUSTITUYE al primero —no se le
//                   suma: el panel no tiene un píxel libre, y está medido—, con su
//                   propio store, sus cinco vías de entrada y sus huellas pintadas
//                   sobre el mismo mapa.
//                   ⛔ **SE ENSAMBLA ANTES QUE EL PASO 12, aunque lleve número
//                   mayor.** Es la ÚNICA inversión de esta lista y tiene una causa
//                   exacta: `cablearExpediente` **se suscribe** al conmutador
//                   (`rama.subscribe`), así que la rama tiene que existir cuando él
//                   se monta. Lo que NO cambia es que el expediente sigue siendo el
//                   último en ejecutarse —que es justo lo que su apartado afirma—:
//                   F11 se cuela delante, no detrás.
//                   Sus dependencias vienen de cinco pasos anteriores:
//                     · el SEGUNDO store (paso 2), que nace en `null`;
//                     · el panel de avisos (paso 3);
//                     · el VISOR (paso 5), por dos cosas distintas: el `L.Map`
//                       sobre el que se pintan las huellas, y la BARRA DE EDICIÓN,
//                       que la rama EDIFICIO oculta — con el edificio delante la
//                       parcela es contexto, y un `Ctrl+Z` ahí desharía una edición
//                       que el usuario cree estar haciendo sobre el edificio;
//                     · los DOS clientes del paso 7 — el de edificio para traer la
//                       construcción, y el de parcela SOLO para deducir la
//                       referencia catastral desde la huella;
//                     · el store de PARCELA (paso 2), que solo se LEE: lo que haya
//                       en pantalla viaja como `edificio.parcelaContexto` y **nunca**
//                       como rama `parcela` de un expediente (desviación 9 de F11);
//                     · los dos CTA del pie (pasos 8 y 10), que la rama EDIFICIO
//                       APAGA CON EL MOTIVO ESCRITO AL LADO: generar el GML de
//                       edificio es F13 y diagnosticarlo es F14. Botón apagado con
//                       motivo, jamás botón muerto.
//                   ⚠️ SIN `try` propio, igual que los pasos 6, 8, 9, 11 y 12.
//
// ── F11 · EL ORDEN DE APAGADO, QUE ESTA PANTALLA NO EJERCE (Y POR ESO SE DICE) ─
// `services/catastro.js#destruir` **aborta el transporte**, y desde F11 ese
// transporte lo COMPARTEN dos clientes (override O8: una sola cola, un solo ritmo).
// La cabecera de aquel módulo dejó escrito que «si algún día hiciera falta compartir
// un transporte entre dos clientes, esto habría que revisarlo»; ese día es hoy, y la
// asimetría está medida: `crearClienteEdificio.destruir()` solo se apaga a sí mismo,
// pero `crearClienteCatastro.destruir()` deja al de edificio devolviendo `CANCELADA`
// **sin que nadie lo haya destruido**.
//
// Aquí no muerde, y por una razón que conviene escribir en vez de dar por supuesta:
// **este arranque no desmonta nada**. No hay `destruir()` de la aplicación ni
// `import.meta.hot.dispose`; la pantalla vive hasta que el navegador descarga la
// página, y entonces se va todo a la vez. El día que exista un desmontaje —una SPA,
// un HMR fino, un test que monte y desmonte— el orden es: **primero el edificio,
// después el resto**, y el cliente de parcela EL ÚLTIMO de los dos.
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
//   4. LOS ATAJOS SE CALLAN EN TRES SITIOS, Y CALLARSE NO ES CALLARLO.
//      · **Dentro de un campo** — `Ctrl+Z` sobre un `<input>` es el deshacer del
//        NAVEGADOR sobre el texto que se está escribiendo, y las celdas de
//        coordenada de la tabla de vértices SON inputs. Robárselo para revertir la
//        geometría mientras el usuario corrige un dígito sería un fallo grave y
//        difícil de contar. Ver {@link esCampoDeTexto}. Éste NO se dice: el usuario
//        obtiene lo que esperaba (el deshacer del texto), así que no hay nada que
//        contarle.
//      · **Bajo una ventana MODAL** (auditoría 2026-08-16) — ver
//        {@link hayDialogoModalAbierto} y {@link MENSAJE_ATAJO_CON_DIALOGO}.
//      · **Durante un arrastre de vértice** (misma auditoría) — ver
//        {@link arrastrandoVertice} y {@link MENSAJE_ATAJO_ARRASTRANDO}.
//      Los dos últimos SÍ se dicen, y por lo mismo: en ellos el usuario pulsa
//      esperando que pase algo, no pasa, y no tiene delante ningún botón gris que
//      se lo explique. Un atajo que no responde y no explica es un atajo roto.
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
  reencuadrar,
  reiniciar,
  undo,
} from '../edit/historial.js'
import { metricas } from '../edit/metricas.js'
import { area } from '../geo/area.js'
import { husoPorSrs } from '../geo/huso.js'
import { PERFIL, SEVERIDAD } from '../gml/_comun.js'
import { descargarGml } from '../gml/descargar.js'
import { NAMESPACE_INSPIRE_CATASTRO, NAMESPACE_INSPIRE_DEFECTO } from '../gml/ids.js'
import { serializarParcelaCp } from '../gml/serialize-cp.js'
// ⭐ **F18 · el PRIMER import del modelo en este fichero, y solo por el rótulo.**
// `app/main.js` lleva doce fases ensamblando sin conocer el modelo: quien construye
// parcelas son los cableados. Se importa `ORIGEN_PARCELA` —un catálogo, no una
// fábrica— porque {@link rotuloDelDato} tiene que distinguir de dónde vino la
// geometría, y derivarlo del catálogo es lo único que impide que el rótulo se quede
// viejo cuando el modelo estrene un origen. Escribirlo a mano aquí es exactamente
// lo que produjo el defecto que el guion 17 destapó.
import { ORIGEN_PARCELA } from '../model/parcela.js'
import { crearTransporte } from '../services/_red.js'
import { crearClienteCatastro } from '../services/catastro.js'
import { crearClienteEdificio } from '../services/catastro-edificio.js'
import { abrirBd } from '../storage/bd.js'
import { crearCacheCatastro } from '../storage/cache-catastro.js'
import { crearCuota } from '../storage/cuota.js'
import { crearExpedientes } from '../storage/expedientes.js'
import { crearPieDeFirmaGuardado } from '../storage/pie-firma.js'
import { validarParcela } from '../validation/parcela.js'
import { crearEstadoVista, NIVEL } from '../viewer/_comun.js'
// F14 · No sale por `viewer/index.js`, y es a propósito: `crearVisor` monta el
// cajón de diagnóstico porque **las dos ramas comparten mapa** y aquél existe
// desde F07 con su opción `diagnostico`. Éste se monta aparte porque solo tiene
// sentido con la rama EDIFICIO puesta, y meterlo en el visor obligaría a que el
// visor supiera qué es una rama —que es exactamente lo que no sabe—.
import { crearCajonContrasteEdificio } from '../viewer/cajon-contraste-edificio.js'
import { MINIMO_VERTICES } from '../edit/vertices.js'
import { crearDibujo } from '../viewer/dibujo.js'
import { crearVisor } from '../viewer/index.js'
// La leyenda SÍ sale por `viewer/index.js` (el visor la monta), pero sus GRUPOS
// son un enumerado y hay que nombrarlos para encender y apagar renglones. Se
// importa el enumerado directamente, igual que `app/main.js` importa
// `viewer/cajon-contraste-edificio.js`: sacar una constante por el barrel del
// visor obligaría a que el barrel creciera cada vez que una vista estrena un
// enumerado, y aquí no hay nada que montar — es una tabla de cadenas.
import { GRUPO as GRUPO_LEYENDA } from '../viewer/leyenda.js'
// F03 pasó por `./avisos.js` directo; desde el 2026-08-07 se entra por el
// diálogo, que es quien fabrica el `<div id="avisos">` y cablea los dos chips.
// Lo que devuelve trae `avisar` en la raíz, así que sirve tal cual donde antes
// iba el panel: los quince `panel.avisar(...)` de este fichero y los `typeof
// panel?.avisar === 'function'` de los cableados no se han tocado.
import { crearDialogoAvisos } from './dialogo-avisos.js'
// F15 · El diccionario de errores de la Sede. NO se le pasa `alAvisar` ni nada
// del estado: es una pantalla de consulta que no mira el fichero de nadie.
import { crearDialogoDiccionario } from './dialogo-diccionario.js'
import {
  SELECTOR_BOTON_CARGAR,
  SELECTOR_BOTON_COLINDANTES,
  SELECTOR_ESTADO_CATASTRO,
  SELECTOR_ESTADO_COLINDANTES,
  cablearCatastro,
} from './cableado-catastro.js'
import { cablearComprobacion } from './cableado-comprobacion.js'
// F14 · El contraste de la CONSTRUCCIÓN y su informe. Son los gemelos de los pasos
// 8 y 11 en la rama EDIFICIO, y entran aquí —y no dentro de `cablearEdificio`—
// por lo mismo que aquéllos: el que sabe qué cajón hay, qué cliente hay y qué
// reloj hay es esta costura.
import { cablearContrasteEdificio } from './cableado-contraste-edificio.js'
import { cablearDerivacion } from './cableado-derivacion.js'
import { crearRegistroColindantes } from './colindantes.js'
import { cablearDiagnostico } from './cableado-diagnostico.js'
// ⚠️ **El alias dice `DIBUJO` y no `EDIFICIO` desde F18, y es una corrección de
// vocabulario, no un capricho.** Esa lista (`.dxf`, `.txt`) la sigue publicando el
// cableado de edificio —es su contrato desde F11 y allí se queda, con UN solo
// dueño para que no pueda divergir—, pero **ya no describe un destino**: las mismas
// dos extensiones entran ahora en las dos ramas y quien elige es la rama en
// pantalla. Llamarla `EXTENSIONES_EDIFICIO` aquí haría leer el `entradasExtra` del
// paso 9 como si el fichero fuera del edificio antes de saberlo.
import { EXTENSIONES as EXTENSIONES_DIBUJO, cablearEdificio } from './cableado-edificio.js'
// F13 · el segundo dueño de «Generar GML»: la rama EDIFICIO ya sabe escribir su
// fichero (el del ICUC), así que el botón deja de estar apagado por ser edificio.
import { cablearGeneracionGmlEdificio, partesSenaladas } from './cableado-edificio-gml.js'
import {
  EXTENSIONES_PROYECTO,
  MENSAJE_SIN_EXPEDIENTE,
  cablearExpediente,
  hayEdificio,
  hayGeometria,
  hayPuntos,
} from './cableado-expediente.js'
import { cablearInforme } from './cableado-informe.js'
import { cablearInformeEdificio } from './cableado-informe-edificio.js'
import { cablearMedicion } from './cableado-medicion.js'
import { NOMBRE_PEGADO, crearDialogoPegado } from './dialogo-pegado.js'
import {
  AVISO_DEMO_HUECO_SINTETICO,
  SRS_DEMO,
  parcelaDemo,
  parcelaDemoConHueco,
} from './demo-datos.js'
import { cablearContraste } from './contraste.js'
import { cablearEmpezarDeNuevo } from './empezar-de-nuevo.js'
import { crearTarjetaBienvenida } from './tarjeta-bienvenida.js'
import { PASO, crearNavegacion } from './navegacion.js'
import { crearPanelEdificio } from './panel-edificio.js'
import { cablearPantalla } from './pantalla.js'
import { cablearBarra } from './barra.js'
import { RAMA, cablearRama } from './rama.js'

// ── Constantes de presentación ───────────────────────────────────────────────

/**
 * Los dos valores de `?demo=`, y desde el 2026-08-07 son la ÚNICA vía de entrar
 * con datos puestos.
 *
 * ── ⭐ QUÉ CAMBIÓ Y POR QUÉ ─────────────────────────────────────────────────
 * Hasta hoy la aplicación **arrancaba siempre con la parcela de demostración
 * cargada** —la real 9398516VK3799G, copiada dentro del código— y `?demo=hueco`
 * era la única forma de ver otra cosa. Petición del autor: *«que empiece sin
 * nada precargado»*. Y tiene razón de fondo, no solo de gusto: el recorrido que
 * la aplicación enseña en el rail empieza por **Entrada**, con sus tres vías, y
 * arrancar con una parcela ya dentro se saltaba el primer paso del producto y
 * ponía a todo el mundo a editar un dato que no es suyo.
 *
 * Los datasets **no se borran**: siguen siendo la forma de mirar el visor sin
 * red y son contra lo que miden los guiones de humo 06 y 08. Solo dejan de ser
 * el arranque por defecto.
 *
 *   · `?demo=real`  → {@link parcelaDemo}, la parcela REAL 9398516VK3799G.
 *   · `?demo=hueco` → {@link parcelaDemoConHueco}, SINTÉTICA con patio. Nunca se
 *     le añade un patio inventado a la real (ver la cabecera de
 *     `./demo-datos.js`).
 *   · sin `?demo=`, o con cualquier otro valor → **nada**, el store nace `null`.
 *
 * ⚠️ Un `?demo=` con un valor que no es ninguno de los dos cae en «nada», no en
 * la real. Es lo conservador: un typo (`?demo=rael`) que cargara datos haría
 * creer que se está mirando el dataset que se pidió.
 */
const DEMO = Object.freeze({ REAL: 'real', HUECO: 'hueco' })

/**
 * A dónde mira el mapa cuando **no hay nada cargado**, que desde el 2026-08-07 es
 * el arranque normal.
 *
 * ⛔ **No es opcional, y por eso está aquí arriba con su porqué:** `crearVisor`
 * **LANZA** si no hay ni geometría ni `vistaInicial` (`viewer/index.js#encuadrar`),
 * y lo hace a propósito — «un visor sin parcela obliga a que alguien decida a
 * dónde mirar». Ese alguien es este fichero, y ésta es la decisión.
 *
 * **España entera** (decisión del autor, 2026-08-07). No privilegia ninguna
 * provincia, deja situarse antes de buscar, y mantiene útil la DEDUCCIÓN POR CLIC
 * —que necesita cartografía debajo para poder pinchar—. Es además lo que hace la
 * propia Sede del Catastro al abrir sin referencia.
 *
 * `zoom: 6` encuadra la península y los dos archipiélagos quedan a un
 * desplazamiento; el centro es el centroide aproximado del territorio peninsular,
 * no Madrid (que caería 40 km al norte y dejaría Andalucía más cerca del borde).
 */
const VISTA_SIN_PARCELA = Object.freeze({ centro: [40.0, -3.7], zoom: 6 })

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

/**
 * ⭐ **EL SÉPTIMO, Y ES EL ESTADO NORMAL DESDE EL 2026-08-07**: no hay ninguna
 * parcela en el store.
 *
 * Antes este caso no existía en la práctica —la aplicación arrancaba con la
 * demostración dentro— y `rotuloDelDato` lo resolvía cayendo a
 * {@link EYEBROW_DEMOSTRACION}, que era un lado conservador razonable **mientras
 * siempre hubiera una demo que respaldara la frase**. Hoy ya no la hay, y decir
 * «Parcela de demostración» sobre un store vacío sería inventarse un dato: es
 * exactamente lo que la regla de oro contra maquillar datos prohíbe, cometido por
 * el rótulo que existe para declarar la procedencia.
 *
 * Dice **«Sin parcela»** y no «Cargando…»: no se está cargando nada, se está
 * esperando a que el usuario elija una de las vías de Entrada. Un «Cargando…»
 * permanente es la forma más rápida de que alguien piense que la aplicación se ha
 * colgado.
 */
const EYEBROW_VACIO = 'Sin parcela'

/**
 * ⛔ **EL CUARTO, Y LO DESTAPÓ EL GUION 17 EN SU PRIMERA CORRIDA (2026-08-06).**
 * Con F18 la cabecera decía «Parcela del Catastro» **después de importar el
 * levantamiento del propio técnico**, y eso es exactamente el error caro que toda
 * la maquinaria de procedencia existe para impedir: la aplicación afirmando que
 * una geometría viene de la Sede cuando la ha dibujado el usuario. A partir de ahí
 * se mira una medición propia creyéndola oficial, y se firma sobre ella.
 *
 * No lo vio ninguna de las 6.339 pruebas, y por un motivo que conviene tener
 * escrito: **la afirmación no existía**. `rotuloDelDato` tenía tres estados y
 * hasta F18 «no es la demo» implicaba «la trajo el Catastro», porque no había
 * ninguna otra forma de meter geometría en el store. F18 estrena la cuarta.
 */
const EYEBROW_MEDICION = 'Tu medición · no del Catastro'

/**
 * ⚠️ **EL QUINTO, Y ES LA DEUDA QUE F18 DEJÓ DICHA Y NO TOCÓ.** Un GML de otro
 * técnico caía en «Parcela del Catastro» por el mismo motivo que la medición
 * propia: `GML_EXISTENTE` tampoco es la Sede. F18 lo midió al pasar y **no lo
 * arregló a propósito** —ese rótulo es parte del recorrido de F08, que cruza a
 * Contraste y reescribe `data-procedencia`, y cambiarlo de refilón en la última
 * tarea de otra fase es como se rompe lo que nadie está mirando—. F19 es su casa.
 *
 * ⭐ **Y es UNO desde el 2026-08-07, cuando era dos.** Había un segundo rótulo
 * —«GML de otro técnico · tomado como tuyo»— para después de cruzar la puerta de
 * F08; retirado el modo COMPROBACIÓN, no hay dos estados que distinguir.
 *
 * ⚠️ **Y ya no dice «de otro técnico», que era una afirmación sin respaldo.** El
 * GML que se abre es, la mayoría de las veces, **el tuyo** —el que generaste ayer y
 * vienes a retocar—, y esta aplicación no tiene forma de saber quién lo escribió.
 * Lo que sí sabe, y es lo único que de verdad protegía aquel rótulo, es que **no lo
 * emite el Catastro**: eso es lo que se dice.
 */
const EYEBROW_GML_IMPORTADO = 'GML importado · no del Catastro'

/**
 * ⛔ **EL SEXTO (F22), Y EXISTE PORQUE SIN ÉL ESTA FASE MENTÍA AL REVÉS.**
 *
 * Un DXF de «Consulta Masiva» del Catastro **no es el levantamiento del técnico**:
 * es cartografía DE la Sede que el técnico ha descargado. Con los cinco rótulos de
 * antes caía en {@link EYEBROW_MEDICION} —«Tu medición · no del Catastro»— por
 * venir con `origen: DXF`, y eso es exactamente el error caro de esta aplicación
 * **con el signo cambiado**: atribuirle al usuario una geometría que no ha medido.
 * A partir de ahí se corrige un lindero creyendo que es propio, y se firma.
 *
 * ⚠️ **Y no vale con decir «Parcela del Catastro» a secas**, que es lo que dice la
 * vía del WFS. El técnico tiene que poder distinguir lo que la aplicación acaba de
 * pedirle al servicio de lo que él trajo en un fichero que puede llevar meses en su
 * disco: la Sede actualiza su cartografía, y un dibujo de junio no es lo que el WFS
 * contestaría hoy. Eso es lo que dice «del dibujo».
 *
 * ⛔ **Y el criterio NO puede ser `origen`, ni «`origen` de fichero + hay
 * `geometriaOficial`». Esa segunda condición se escribió, y habría reintroducido el
 * defecto de F18 con otro disfraz**: `componerParcelaMedida` **CONSERVA** la
 * `geometriaOficial` que hubiera —es toda la decisión de F18, la que hace que el
 * Diagnóstico funcione sin traer nada más—, así que el flujo normal del perito
 * (traigo la oficial, meto MI levantamiento) habría acabado rotulado «Cartografía
 * del Catastro» sobre el dibujo del técnico.
 *
 * El criterio es {@link dibujoEsLaOficial}: que lo que se está dibujando **SEA**
 * la geometría oficial, no que exista una. Es literalmente lo que la frase afirma.
 *
 * ⚠️ **Consecuencia buscada: en cuanto el técnico mueve un vértice, el rótulo pasa
 * a {@link EYEBROW_MEDICION}.** Y es correcto — lo que hay en pantalla ya es su
 * propuesta, no la cartografía de la Sede—; `geometriaOficial` sigue intacta como
 * referencia del Diagnóstico. ⚠️ La vía del WFS **no** se comporta así (sigue
 * diciendo «Parcela del Catastro» tras editar): es una incoherencia que F22
 * hereda, no que estrena, y queda declarada como deuda.
 */
const EYEBROW_DIBUJO_CATASTRO = 'Cartografía del Catastro · del dibujo'

/**
 * Los orígenes de `ORIGEN_PARCELA` que significan «lo ha medido el técnico». Se
 * derivan del catálogo del modelo y **no se escriben a mano**: el día que
 * `model/parcela.js` estrene un origen, esto se entera o se rompe, que es
 * justamente lo que no pasó con el criterio anterior.
 */
const ORIGENES_MEDIDOS = new Set([
  ORIGEN_PARCELA.LIST,
  ORIGEN_PARCELA.TXT,
  ORIGEN_PARCELA.DXF,
])

/**
 * Los DOS eyebrows de la rama EDIFICIO (F11). Los tres de arriba empiezan por
 * «Parcela» y con el edificio delante serían falsos los tres — la cabecera estaría
 * anunciando el documento de la otra rama.
 *
 * Son dos y no tres porque en esta rama **no existe la demostración**: el segundo
 * store nace en `null` a propósito (no se inventa un edificio de muestra, misma
 * regla por la que `demo-datos.js` no le añade un patio a la parcela real), así que
 * los dos estados que hay son «no hay nada» y «hay un edificio».
 */
const EYEBROW_EDIFICIO_VACIO = 'Edificio · sin cargar'
const EYEBROW_EDIFICIO = 'Edificio'

/** Texto de la ficha cuando la parcela no tiene referencia catastral. */
const SIN_REFCAT = 'Sin referencia'

/**
 * Coletilla de la ficha para una referencia que **la app ha deducido** de la
 * ubicación, no que haya afirmado nadie.
 *
 * ── POR QUÉ NO SE PINTA A SECAS ──
 * `parcela.refcat` significa SIEMPRE «esto lo afirma el usuario» y nunca «esto lo
 * adivinó un servicio» (`cableado-catastro.js`, «por qué la deducción no escribe
 * en el modelo»). La deducción automática de la importación no rompe esa regla
 * —sigue sin tocar el modelo—, así que la ficha tampoco puede enseñar su resultado
 * como si fuera lo mismo. Con la coletilla se lee lo que es: un dato de trabajo,
 * bueno para pedir el parcelario y pendiente de que el usuario lo confirme.
 */
const SUFIJO_REFCAT_DEDUCIDA = ' · deducida, sin confirmar'

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
 * **F22.** La coletilla del recuento cuando las vecinas salen de un DIBUJO y no de
 * una consulta al Catastro. Es corta a propósito: el renglón de la ficha es
 * estrecho y lo que hay que distinguir cabe en dos palabras. Ver
 * {@link colindantesDeDibujo}.
 */
const SUFIJO_COLINDANTES_DIBUJO = ' · del dibujo'

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

// ── F11 · la ficha del pie, en su versión de EDIFICIO ────────────────────────
//
// La ficha tiene ocho pares y **cinco de sus rótulos hablan de la parcela**
// (Vértices, Perímetro, Superficie catastral, Δ catastral, Colindantes). Con la
// rama EDIFICIO puesta esos renglones no es que sobren: es que **afirmarían cosas
// del otro documento**, que es exactamente el error silencioso que este proyecto no
// admite. Así que en esa rama se quedan CUATRO, y los cuatro se pueden sostener:
//
//   1. Sistema de referencia — es del EXPEDIENTE, no del tema. Idéntico.
//   2. Referencia catastral — la del edificio, que puede no tenerla.
//   3. **Partes** — el mismo `<dd>` que cuenta los vértices en la otra rama, con su
//      `<dt>` reescrito. Contar es lo que hace esa línea; cambia qué se cuenta.
//   4. **Superficie en planta** — la suma de las huellas.
//
// ⭐ Y no es solo higiene: recortar la ficha a cuatro pares libera **75,75 px
// medidos** (8 × 31,88 px → 4), que es la mayor palanca de altura de toda la fase y
// lo que le da sitio a la lista de partes.
//
// ⚠️ **«Superficie en planta» y no «Superficie» a secas, y la distinción importa**:
// lo que se mide aquí es el suelo que ocupan las huellas, no la superficie
// CONSTRUIDA, que es un atributo declarado del modelo COMPLETO (`superficieConstruida`,
// el `grossFloorArea` del Catastro) y que en un edificio de tres plantas es
// aproximadamente el triple. Llamarlas igual invitaría a compararlas, y la comparación
// no significa nada. Es la misma clase de distinción que separa {@link SIN_SUPERFICIE_CATASTRAL}
// de {@link SIN_DELTA_CATASTRAL}.

/** Rótulo del `<dt>` que cuenta, en cada rama. Mismo `<dd>`, otra pregunta. */
const ROTULO_VERTICES = 'Vértices'
const ROTULO_PARTES = 'Partes'

/** Ídem para el `<dd>` de la superficie. Ver el bloque de arriba. */
const ROTULO_SUPERFICIE = 'Superficie'
const ROTULO_SUPERFICIE_PLANTA = 'Superficie en planta'

/**
 * Ficha: no hay ningún edificio cargado. El segundo store nace en `null` y esto es
 * lo que se lee mientras nadie haya traído nada. Se DICE, en vez de dejar el guion
 * del HTML —que se lee como «esto no ha cargado»— o un «0», que afirmaría que el
 * edificio tiene cero partes cuando lo que pasa es que no hay edificio.
 */
const SIN_EDIFICIO = 'Sin cargar'

/**
 * Ficha: hay partes, pero alguna no trae contorno dibujable, así que la superficie
 * en planta es la de las que SÍ lo traen. Se dice entre paréntesis en el renglón de
 * «Partes» en vez de callarlo, porque si no la suma de abajo sería una superficie
 * incompleta con pinta de completa (regla de oro 1). El recuento de las que faltan
 * lo cuenta además `viewer/partes.js` en su propio aviso, y las dos cifras salen del
 * mismo sitio: el modelo.
 *
 * @param {number} conContorno
 * @param {number} total
 * @returns {string}
 */
const textoPartes = (conContorno, total) =>
  conContorno === total
    ? FORMATO_ENTERO.format(total)
    : `${FORMATO_ENTERO.format(total)} (${FORMATO_ENTERO.format(total - conContorno)} sin contorno)`

/**
 * Los cuatro `data-ficha` que la rama EDIFICIO **oculta**, porque sus rótulos hablan
 * de la parcela y en esta rama serían una afirmación sobre el otro documento. Se
 * ocultan el `<dd>` y su `<dt>`, con `hidden`: `.gml-app [hidden]` es (0,2,0) y
 * ninguna regla de `.gml-ficha` declara `display`, así que basta.
 */
const FICHA_SOLO_PARCELA = Object.freeze([
  'perimetro',
  'superficie-catastral',
  'delta-catastral',
  'colindantes',
])

// ── F11 · lo que este ENSAMBLAJE tiene que decir por su cuenta ───────────────
//
// Los tres mensajes son de ESTE fichero y no de `./cableado-edificio.js`, por el
// mismo reparto que puso `MENSAJE_SIN_EXPEDIENTE` en `./cableado-expediente.js`:
// hablan de cómo se ha montado la aplicación —qué paso ha corrido, qué rama está
// puesta—, y eso solo lo sabe quien la monta.

/**
 * La zona de arrastre anuncia aceptar `.dxf` y `.txt`, y el paso 13 no ha llegado a
 * montarse. Es un fallo del programa, no del usuario, y por eso es ERROR: una
 * extensión que se anuncia y al soltarla no hace nada es el error silencioso de
 * manual. Mismo criterio y misma redacción que `MENSAJE_SIN_EXPEDIENTE`.
 */
const MENSAJE_SIN_EDIFICIO_CABLEADO =
  'La rama de edificio no se ha podido montar en este arranque, así que ese fichero no tiene ' +
  'dónde entrar. Recarga la página; si vuelve a pasar, es un fallo de la aplicación y está en ' +
  'la consola del navegador.'

/**
 * Gemelo del de arriba para la otra rama (F18 · paso 17). Son DOS mensajes y no uno
 * genérico a propósito: si lo que ha reventado es la vía de medición, la rama de
 * edificio sigue sirviendo —y al revés—, así que decir «no se ha podido montar»
 * sin decir *qué* dejaría al usuario sin saber que le queda una salida.
 */
const MENSAJE_SIN_MEDICION_CABLEADA =
  'La vía de medición propia no se ha podido montar en este arranque, así que ese dibujo no ' +
  'tiene dónde entrar como parcela. Recarga la página; si vuelve a pasar, es un fallo de la ' +
  'aplicación y está en la consola del navegador.'

// ⭐ **AQUÍ VIVÍA `MENSAJE_DIBUJO_EN_PARCELA`, Y F18 LO HA BORRADO.** Decía esto:
//
//     'Ese dibujo entra como PARTES DE UN EDIFICIO, y ahora mismo estás en la rama
//      Parcela. Cambia a la rama Edificio con el conmutador de la cabecera y vuelve
//      a soltarlo. Reabrir un dibujo como parcela todavía no está: esta versión
//      sabe escribir su DXF, pero no leerlo de vuelta.'
//
// Era honrado y era correcto: F11 solo cableó el `.dxf`/`.txt` a la rama EDIFICIO,
// así que con la rama PARCELA puesta no había a quién darle el fichero. Lo que no
// era, es sostenible — **la pantalla de Entrada anunciaba esa vía con su propio
// botón** («Elegir un fichero de medición…»), y el usuario que lo pulsaba se comía
// este aviso. Un cartel sin puerta detrás.
//
// El paso 17 abre la puerta: ya no hay una rama que rechace lo que la otra acepta.
// Se deja escrito lo que decía, en vez de borrarlo sin más, porque el mensaje
// documenta una decisión de F11 que fue correcta en su momento.
//
// ⚠️ Y queda un guardián en `test/app/main-medicion.dom.test.js` que comprueba que ese
// identificador **no vuelve** al código: mientras exista, la vía no está cerrada.
// (Lee la fuente con los comentarios quitados, para no acusarse a sí mismo por
// estas líneas.)

/**
 * El `.gml` soltado resultó describir una construcción y se ha encaminado a la otra
 * rama. Se DICE, y no es cortesía: la pantalla acaba de cambiar de panel sola, y un
 * cambio de contexto que el usuario no ha pedido y que nadie explica se lee como un
 * fallo. AVISO, porque no ha ido nada mal — ha ido a donde tenía que ir.
 */
const MENSAJE_GML_ES_DE_EDIFICIO =
  'Ese GML describe una construcción, no una parcela: se ha cambiado a la rama Edificio para ' +
  'poder enseñártelo. El contraste contra el parcelario es de la rama Parcela y no se aplica aquí.'

/**
 * ⭐ **El espejo del anterior, y no es simétrico a propósito (2026-08-16).**
 *
 * Un `.gml` de PARCELA abierto con la rama EDIFICIO puesta entra en el store de
 * parcela y **la rama no se toca**. Antes esto no hacía falta decirlo porque casi
 * no pasaba: en esa rama la vía «Abrir un GML» estaba `hidden` y solo se llegaba
 * arrastrando. Desde que las dos vías de fichero se ven en las dos ramas
 * (`.gml-bloque--vias` de `index.html`), es un clic normal — y sin este renglón el
 * usuario pulsa, el fichero entra, y el panel que está mirando **no cambia nada**.
 * Eso se lee como que no ha funcionado.
 *
 * ⛔ **Y NO se conmuta a PARCELA, que era la otra salida.** La parcela que hay en
 * pantalla es el CONTEXTO del edificio —`app/cableado-edificio.js#parcelaContexto`,
 * desviación 9 del plan de F11, que se lo pasa a las cinco fábricas de entrada—,
 * así que traerla estando en Edificio es un gesto útil y probablemente deliberado.
 * Conmutar le desharía el trabajo a quien acertó. Se cuenta lo que ha pasado y se
 * deja la pantalla donde el usuario la dejó.
 */
const MENSAJE_GML_ES_DE_PARCELA =
  'Ese GML describe una parcela, no una construcción: ha entrado en la rama Parcela y sigues en ' +
  'la de Edificio, que es donde estabas. No se ha perdido nada — esa parcela le sirve de ' +
  'contexto al edificio. Cambia con el conmutador de arriba si quieres verla.'

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
 * Modificador de `.gml-accion-estado` para la acción COMPLETADA (verde).
 *
 * Es el simétrico exacto de {@link CLASE_ESTADO_ERROR} y se estrenó el
 * 2026-08-10: hasta entonces `--color-state-ok` llevaba definido desde la copia
 * del design system sin un solo uso, y la app decía «Descargado «X».» en el
 * mismo gris con el que dice cualquier otra cosa.
 *
 * ⚠️ **No es una excepción a la regla de oro 9**, y conviene no leerlo como
 * permiso para teñir cifras. Este renglón habla de la puerta de la aplicación
 * («¿te dejo generar?», «¿bajó el fichero?»), no del levantamiento. El rojo vive
 * aquí desde F04 sin que nadie lo haya discutido por el mismo motivo. El
 * razonamiento completo, y dónde está prohibido, en `estilos/app.css`
 * (`.gml-accion-estado--exito`) y en la cabecera de `viewer/cajon-diagnostico.js`.
 */
const CLASE_ESTADO_EXITO = 'gml-accion-estado--exito'

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
 * ⭐ **LO QUE DICE EL RENGLÓN CUANDO NO HAY NINGUNA PARCELA** (2026-08-18).
 *
 * ── EL DEFECTO QUE RETIRA, MEDIDO EN NAVEGADOR ──────────────────────────────
 * Hasta hoy, la aplicación recién abierta y **vacía** enseñaba en el panel una
 * caja ROJA de 47,69 px que decía: *«1 error bloquea la generación del GML: La
 * parcela no tiene ningún recinto: falta el contorno exterior.»* Está en la
 * captura que el autor mandó el 2026-08-11 y en el apunte de `TODOS.md` sobre el
 * chip que dice «0 errores» mientras el panel dice otra cosa.
 *
 * ⛔ **Y es la misma lección que esta aplicación ya aprendió con el eyebrow.**
 * `EYEBROW_VACIO` existe porque decir «Parcela de demostración» sobre un store
 * vacío «sería inventarse un dato». Esto era la misma frase con otra ropa: sobre
 * un store vacío **no hay ninguna parcela a la que le falte el contorno**. La
 * frase era literalmente cierta —`validarParcela([])` devuelve ese hallazgo, y
 * hace bien— y a la vez decía algo falso: que hay un expediente con un defecto.
 * Lo que hay es un expediente que todavía no ha empezado.
 *
 * ── LO QUE **NO** SE HACE, Y ES LA MITAD QUE IMPORTA ────────────────────────
 * NO se calla. El botón «Generar GML» sigue apagado y el renglón sigue diciendo
 * por qué, porque la regla de oro 1 no admite un control apagado y mudo. Lo que
 * cambia es que deja de ser un ERROR (`esError: false`, o sea sin la caja roja) y
 * pasa a decir lo único accionable que hay: elige una vía.
 *
 * ── ⚠️ EL EFECTO DE MAQUETA, QUE ES POR LO QUE ESTO SE ENCONTRÓ ─────────────
 * La caja roja se llevaba **72 px** de la columna del panel —más que su propio
 * alto, porque con ella se van sus márgenes—, y esos 72 px salían del sitio de la
 * tercera vía de Entrada, que lleva desde el rework cayendo bajo el pliegue a
 * 1280×720. Los dos apuntes abiertos de `TODOS.md` eran el mismo problema.
 */
export const MENSAJE_SIN_PARCELA_TODAVIA =
  'Todavía no hay parcela. Empieza por una de las vías de arriba.'

/**
 * ⭐ **EL TERCER ESTADO DEL MISMO RENGLÓN (2026-08-19), y lo destapó el
 * navegador.** Con un levantamiento de puntos importado SIN unir hay parcela
 * —con su origen, su nube y su idLocal— y **cero recintos**, así que el renglón
 * de arriba se enseñaba tal cual y decía dos cosas falsas a la vez: que no hay
 * nada («todavía no hay parcela», con 55 puntos pintados en el mapa) y que la
 * salida está «arriba», en una pantalla en la que el usuario ya no está.
 *
 * Es EXACTAMENTE la trampa que su gemelo vino a cerrar el 2026-08-18 —una frase
 * literalmente derivable de `recintos.length === 0` que describe un expediente
 * distinto del que hay en pantalla— repetida un estado más allá. El criterio no
 * cambia: **no hay parcela ≠ la parcela está mal**, y ahora tampoco **no hay
 * parcela ≠ la parcela todavía no tiene contorno**.
 *
 * Va sin caja roja, por lo mismo: no es un defecto del expediente, es el paso
 * siguiente. Y dice **la herramienta por su nombre**, que es lo único accionable
 * que hay aquí — la palabra «Dibujar recinto» está en la barra del mapa, a la
 * vista, mientras se lee esto.
 */
export const MENSAJE_SIN_CONTORNO_TODAVIA =
  'Tu levantamiento ha entrado, pero todavía no tiene contorno: dibújalo sobre los puntos con ' +
  '«Dibujar recinto», en la barra del mapa.'

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
/**
 * «Borrar vértices» (2026-08-10). **Es un CONMUTADOR**, no un disparador: arma el
 * modo borrar de `viewer/edicion.js` y se queda pulsado hasta que se apaga.
 *
 * ⚠️ Nace ENCENDIDO y en `aria-pressed="false"`, y no se deshabilita nunca: armar
 * el modo se puede hacer siempre —incluso sin geometría cargada, donde el primer
 * clic simplemente dirá que no hay ningún vértice cerca—, y un botón gris obligaría
 * a explicar un motivo que no existe.
 */
export const SELECTOR_BOTON_BORRAR = '[data-accion="borrar"]'

/**
 * El conmutador del MODO INSERTAR (2026-08-18), el noveno nodo del contrato que
 * `viewer/barra-edicion.js` fabrica para este módulo. Es el espejo exacto de
 * {@link SELECTOR_BOTON_BORRAR}: hasta hoy la barra tenía un modo para quitar un
 * vértice y ninguno para ponerlo, y el gesto que lo ponía —doble clic sobre el
 * lindero— solo se contaba en la tabla de la ayuda, detrás del botón «?».
 */
export const SELECTOR_BOTON_INSERTAR = '[data-accion="insertar-vertice"]'
/** Renglón `role="status"` del bloque, gemelo del de «Generar GML». */
export const SELECTOR_ESTADO_EDICION = '[data-estado="edicion"]'

/**
 * La sección VACÍA del panel donde se cuelga el diagnóstico cuando es la pantalla
 * (2026-08-05). Ver `viewer/cajon-diagnostico.js#anfitrion` para el porqué del
 * traslado, y el bloque de comentario de esa `<section>` en `index.html` para por
 * qué está vacía y no se puede duplicar.
 *
 * `anfitrion` y no `bloque` ni `diagnostico` a secas: dice lo que el nodo HACE
 * —alojar a otro—, que es lo único que lo distingue de las demás secciones del
 * panel. Y `[data-estado="diagnosticar"]` ya existe en el pie para otra cosa.
 */
export const SELECTOR_ANFITRION_DIAGNOSTICO = '[data-anfitrion="diagnostico"]'

/**
 * F14 · La misma idea en la rama EDIFICIO: la `<section>` vacía donde se cuelga el
 * contraste de la construcción cuando es la pantalla.
 *
 * ⚠️ **Esta NO está en `index.html`**: la fabrica `app/panel-edificio.js` junto con
 * las otras tres de su rama, así que **no se puede resolver antes del paso 13** —
 * hasta que `cablearEdificio` monta el panel, este selector devuelve `null`—. Por
 * eso el cajón se cuelga ahí abajo y no aquí arriba con el de parcela.
 */
export const SELECTOR_ANFITRION_CONTRASTE_EDIFICIO = '[data-anfitrion="contraste-edificio"]'

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
 * ⛔ **El atajo, INHIBIDO con una ventana modal abierta (auditoría 2026-08-16).**
 *
 * `esCampoDeTexto` era el único filtro, y cubre el caso de ESCRIBIR. No cubría el
 * de MIRAR: los diálogos de esta aplicación son modales de verdad —los abren con
 * `showModal()` `app/dialogo-expediente.js`, `app/dialogo-avisos.js` y
 * `app/dialogo-diccionario.js`— y dentro de ellos se navega por BOTONES, no por
 * campos. Escenario medido: se abre «Expediente», se recorre la lista de proyectos
 * guardados —el foco queda en un botón de fila— y se pulsa `Ctrl+Z`, que ahí es el
 * gesto natural. La geometría de detrás se deshacía; el mapa y el renglón están
 * TAPADOS POR EL VELO, así que nada lo decía, y el autoguardado persistía la
 * geometría ya revertida.
 *
 * ── POR QUÉ ESTE TEXTO VA TAMBIÉN AL PANEL Y NO SOLO AL RENGLÓN ─────────────
 * Porque el renglón está detrás del velo. El panel de avisos CONSERVA lo dicho, así
 * que el usuario lo lee al cerrar la ventana —que es cuando la pregunta «¿ha hecho
 * algo mi Ctrl+Z?» se puede contestar mirando el mapa—, y agrupa las repeticiones
 * con su `×N`, así que insistir con el atajo no llena el panel de tarjetas iguales.
 * Es la excepción al reparto de siempre (renglón = desenlace del atajo), y la
 * excepción la impone el velo, no el gusto.
 */
const MENSAJE_ATAJO_CON_DIALOGO =
  'Hay una ventana abierta encima, así que «Deshacer» y «Rehacer» se quedan quietos: lo que ' +
  'cambiarían está detrás del velo y no lo verías. Cierra la ventana y vuelve a pulsar.'

/**
 * ⛔ **Y el atajo, inhibido TAMBIÉN mientras se arrastra un vértice.**
 *
 * Es la otra mitad del defecto que `viewer/sincronizacion.js` cerró por su lado
 * (auditoría 2026-08-16): un `Ctrl+Z` a mitad de arrastre cambia la forma del
 * anillo bajo los pies del gesto, y el `dragend` escribía la coordenada en el
 * vértice equivocado. Aquel módulo ya no lo escribe —RENUNCIA al gesto, lo dice con
 * `NIVEL.ERROR` y repinta desde el modelo—, pero entonces el usuario pierde el
 * arrastre: suelta el ratón y le dicen «no se ha aplicado, repítelo». Esta mitad es
 * no llegar ahí. Ver {@link arrastrandoVertice}.
 *
 * Éste sí se queda SOLO en el renglón, y la diferencia con el de arriba es la que
 * decide: aquí no hay velo. El renglón está a la vista, el estado dura lo que dura
 * el gesto y una tarjeta en el panel por cada tecla pulsada durante un arrastre
 * sería ruido sobre algo que se resuelve soltando el ratón.
 */
const MENSAJE_ATAJO_ARRASTRANDO =
  'Estás arrastrando un vértice: «Deshacer» y «Rehacer» esperan a que lo sueltes. Deshacer a ' +
  'media faena cambiaría la parcela bajo el vértice que tienes agarrado.'
/**
 * Los dos de la pila COMPARTIDA entre ramas (auditoría 2026-08-16, ver
 * {@link moverse}). La pila lleva las operaciones de las dos ramas en el orden en
 * que se hicieron, así que un `Ctrl+Z` puede tocarle a la otra: eso no se impide
 * —es la decisión de F12, y una tecla no debería significar dos cosas— pero sí se
 * DICE, porque deshacer algo que no se está mirando y callarlo es la definición de
 * cambio silencioso.
 */
const COLA_ERA_DEL_EDIFICIO = 'Era una edición del edificio.'
const MENSAJE_OTRA_PARTE =
  'Esa operación es de otra parte del edificio, así que no se ha deshecho: elige esa parte en el ' +
  'panel y vuelve a intentarlo. No se ha cambiado nada.'

/**
 * Al entrar una parcela nueva. Dice las dos cosas que el usuario necesita saber y
 * que, calladas, se leerían como un fallo: que «Deshacer» se ha apagado, y por
 * qué. Es la cara visible de la decisión 2 de F06.
 */
const MENSAJE_PARCELA_NUEVA =
  'Parcela nueva: el historial de edición empieza de cero. «Deshacer» revierte tus ediciones de ' +
  'la geometría, nunca la parcela que has traído.'

/**
 * Se ha cerrado un recinto dibujado y no hay expediente donde meterlo. No debería
 * ocurrir —a la pantalla de Edición no se llega sin parcela—, y por eso el texto
 * no intenta enseñar nada: dice qué ha pasado con el trabajo, que es lo único que
 * el usuario necesita en ese instante.
 */
const MENSAJE_DIBUJO_SIN_PARCELA =
  'El recinto dibujado no se ha podido guardar: no hay ninguna parcela abierta. Empieza un ' +
  'expediente y vuelve a dibujarlo.'

/**
 * Dibujar REEMPLAZA el exterior, y `recintos[0]` se lleva los huecos con él (la
 * invariante del modelo, §4.3: solo el primero es EXTERIOR). Cuando había alguno,
 * se dice **con su número**: es la cifra que se comprueba de un vistazo, y callarla
 * sería perder trabajo en silencio.
 *
 * Es AVISO y no ERROR por la regla de clasificación de `viewer/_comun.js`: la
 * operación que el usuario pidió SÍ se ha aplicado — con una pérdida que se cuenta.
 * Y `Ctrl+Z` la revierte entera, porque el dibujo commitea como cualquier edición.
 */
const mensajeHuecosPerdidos = (n) =>
  `El recinto dibujado sustituye al exterior de la parcela, así que ${
    n === 1 ? 'se ha quitado el hueco que tenía' : `se han quitado sus ${n} huecos`
  }. «Deshacer» (Ctrl+Z) lo devuelve todo.`

/**
 * ⛔ **«Borrar vértices» armado sobre una geometría que ya está en el mínimo.**
 *
 * Reportado con captura el 2026-08-19: un recinto de TRES vértices, la papelera
 * roja —o sea armada, prometiendo— y «no me deja borrar por más que pincho». La
 * aplicación tenía razón y lo estaba diciendo: quitar un vértice de tres deja un
 * segmento, no un recinto, así que `edit/vertices.js` lo rechaza SIEMPRE. Pero lo
 * decía **después** del gesto, en una tarjeta del panel plegado, y agrupada como
 * «×6» — que es como seis intentos se leen como «1 error» en la cabecera.
 *
 * El defecto no era el rechazo: era **dejar armar un modo que no puede hacer nada
 * ni una sola vez**. Regla de oro 1: un mando que no puede actuar va apagado y con
 * el motivo escrito, no encendido esperando a que el usuario lo descubra pinchando.
 */
const MOTIVO_SIN_NADA_QUE_BORRAR =
  'No hay ningún vértice que se pueda borrar: todos los recintos están en el mínimo de 3. Con dos ' +
  'o menos deja de ser un recinto. Añade vértices, o quita el recinto entero.'

/** Estado del offset cuando no hay ningún lindero elegido. */
const MENSAJE_SIN_LADO = 'Sin lindero seleccionado: pincha uno en el mapa para poder desplazarlo.'
/** …y cuando sí lo hay. */
const MENSAJE_CON_LADO = 'Lindero seleccionado: ya puedes desplazarlo.'

/**
 * Los dos desenlaces del modo borrar.
 *
 * ── Por qué el modo armado SÍ escribe en el renglón, si el arranque de la barra
 * dejó de hacerlo ───────────────────────────────────────────────────────────
 * El comentario del final de {@link cablearEdicion} explica por qué se quitó el
 * cartel permanente sobre la ortofoto: era un texto de tres líneas que no se iba
 * hasta la primera edición y tapaba justo la parcela. Este es el caso contrario, y
 * la diferencia es la que decide:
 *
 *   · aquél describía un estado PASIVO (tres botones apagados) que el usuario no
 *     había pedido y que duraba indefinidamente;
 *   · este describe un modo que el usuario acaba de ARMAR con una pulsación, que
 *     cambia lo que hace su próximo clic, y que se va en cuanto lo apaga.
 *
 * Un modo destructivo sin confirmación en pantalla es la definición de trampa
 * silenciosa, y el `role="status"` es exactamente el canal para esto: lo anuncia
 * el lector de pantalla sin robar el foco, y quien mira ve una línea, no un
 * párrafo. El botón pulsado y el cursor lo dicen a la vez por vía visual.
 */
const MENSAJE_BORRAR_ARMADO =
  'Modo borrar: cada clic sobre un vértice lo elimina. Escape para salir.'
/** …y al desarmarlo, por cualquiera de sus tres caminos. */
const MENSAJE_BORRAR_APAGADO = 'Modo borrar apagado: el clic vuelve a seleccionar linderos.'

/**
 * Los gemelos del modo INSERTAR (2026-08-18), y aquí el `role="status"` gana un
 * cuarto camino que el de borrar no tenía: los dos modos son EXCLUYENTES, así que
 * armar uno **apaga el otro sin que su botón haya recibido ningún clic**. Ése es el
 * caso en el que un mensaje hablado vale de verdad — el usuario pulsó «Borrar» y lo
 * que se apagó fue otra cosa, en otro punto de la barra.
 *
 * ⚠️ Desde hoy este renglón solo se VE cuando es un error (ver `anunciar`), así que
 * estos dos textos son de lector de pantalla en la práctica. Se redactan igual de
 * cuidados: quien no ve el mapa no tiene otra vía de saber qué hace el próximo clic.
 */
const MENSAJE_INSERTAR_ARMADO =
  'Modo insertar: cada clic sobre un lindero le añade un vértice. Escape para salir.'
/** …y al desarmarlo, por cualquiera de sus cuatro caminos. */
const MENSAJE_INSERTAR_APAGADO =
  'Modo insertar apagado: el clic vuelve a seleccionar linderos.'

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

// ⭐ **SIN NADA PRECARGADO** (2026-08-07, petición del autor). La aplicación
// arranca con el store VACÍO y el usuario elige una de las vías de Entrada. Los
// dos datasets de demostración siguen ahí, detrás de `?demo=` — ver {@link DEMO}
// para el porqué del cambio y por qué un `?demo=` con un valor raro NO carga la
// parcela real.
const queDemo = new URLSearchParams(window.location.search).get('demo')
const esSintetica = queDemo === DEMO.HUECO
const parcela =
  esSintetica ? parcelaDemoConHueco() : queDemo === DEMO.REAL ? parcelaDemo() : null

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
 *
 * ⚠️ **`null` cuando no se arranca con demostración**, que desde el 2026-08-07 es
 * lo normal. Y el `?.` no es defensivo por si acaso: **sin él la aplicación no
 * arrancaba**. Medido en navegador el mismo día — con el store naciendo vacío,
 * este `parcela.idLocal` lanzaba un `TypeError` en el paso 1, o sea antes del
 * panel de avisos, del visor y del rail; en pantalla quedaba `index.html` sin
 * vestir de JavaScript (todos los bloques a la vez, rail vacío, mapa en blanco) y
 * **la consola no decía nada**, porque el error ocurre antes de que nadie escuche.
 * Cuatro «defectos» aparentes que eran uno solo.
 *
 * Con `null`, la comparación de {@link rotuloDelDato} nunca acierta —ningún
 * `idLocal` real es `null`—, que es justo lo que se quiere: sin demostración, no
 * hay nada que pueda «seguir siendo» la demostración.
 */
const ID_LOCAL_DEMO = parcela?.idLocal ?? null

// El eyebrow ya no se escribe aquí. Lo escribe SIEMPRE la ficha (paso 6), que es
// el único suscriptor que ve entrar y salir parcelas del store y por tanto el
// único que puede decir la verdad sobre su procedencia también DESPUÉS del
// arranque. Ver {@link rotuloDelDato} y la decisión 4 de la cabecera.
const eyebrow = nodo('[data-eyebrow]')

// Los dos indicadores de qué geometrías hay cargadas. Se resuelven aquí, una vez y
// al montar, como todos los nodos del contrato con `index.html`; los escribe
// {@link pintarCapasCargadas} desde el mismo suscriptor que el eyebrow.
const capaMedicion = nodo('[data-capa="medicion"]')
const capaOficial = nodo('[data-capa="oficial"]')

// ── 2 · Estado e historial ───────────────────────────────────────────────────

// UN solo store para las TRES vistas: el dibujo del mapa, la tabla de vértices
// y la ficha del pie (ver la cabecera).
const estado = crearEstadoVista(parcela)

// ── F11 · el SEGUNDO store, el de la rama EDIFICIO (contrato H) ──────────────
//
// Se crea AQUÍ, junto al de parcela y por el mismo motivo escrito arriba («POR QUÉ
// EL STORE LO CREA ESTA FUNCIÓN Y NO `crearVisor`»): para poder COMPARTIRLO. Lo
// leen tres módulos del paso 13 y del 12 —el cableado de edificio, el panel y el
// expediente—, y ninguno de ellos puede fabricarlo sin dejar a los otros dos
// mirando otra cosa.
//
// **Es un store SEPARADO y no un campo del primero**, y no es un atajo: es lo que el
// modelo lleva imponiendo desde F00. `crearExpediente` **prohíbe** llevar las dos
// ramas a la vez (`model/parcela.js`), así que un solo store con las dos dentro
// tendría que representar un estado que el dominio declara imposible. Y los ONCE
// suscriptores del de parcela no se enteran de que existe éste: ni una línea suya
// cambia en F11.
//
// ⚠️ **Nace en `null`, y eso es una decisión.** No se inventa un edificio de
// demostración: es la misma regla por la que `./demo-datos.js` no le añade un patio
// a la parcela real. Lo que sí hace el panel de edificio es DECIR qué hacer, con las
// cinco vías a la vista, en vez de enseñar una lista vacía que se lee como «esto no
// ha cargado».
const estadoEdificio = crearEstadoVista(null)

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

// ⚠️ **`#avisos` ya NO se busca en `index.html`**: lo fabrica el diálogo, dentro
// de sí mismo. Los dos chips sí siguen siendo contrato del marcado y se
// localizan por `data-contador`; nacen NEUTROS («0 errores» / «0 avisos») y es
// `app/avisos.js` quien pone y quita los modificadores de color y el destello.
// Aquí no se pasan a mano porque el diálogo los busca por el mismo selector y
// lanza con su propio mensaje si faltan.
const panel = crearDialogoAvisos({ documento: document })

// F15 · «Me han rechazado el fichero». Se monta AQUÍ, al lado del de avisos, y no
// en un cableado: no tiene nada que cablear. No lee el store, no escribe en él, no
// depende de la rama activa ni del paso, y por eso tampoco se guarda la referencia
// —nadie más de esta aplicación tiene por qué abrirlo—. El diálogo se cablea solo
// con su `menuitem` de `index.html` y vive de `config/errores-ivg.json`.
//
// ⛔ Y no es opcional que esté: sin esta línea el diccionario existe en el
// repositorio, sus 43 pruebas dan verde y **el usuario no tiene ninguna forma de
// llegar a él**. Es el modo de fallo que este proyecto ha pagado tres veces.
crearDialogoDiccionario({ documento: document })

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
 * El `<dt>` de un `<dd data-ficha="…">`. **F11**: hasta aquí los rótulos eran fijos
 * y bastaba con el `<dd>`; ahora dos de ellos cambian de pregunta según la rama
 * («Vértices» ⇢ «Partes») y otros cuatro se ocultan enteros, y ocultar un `<dd>`
 * dejando su `<dt>` a solas partiría la rejilla de dos columnas por la mitad.
 *
 * Se DERIVA del `<dd>` en vez de darle un `data-*` propio a cada `<dt>`, por lo
 * mismo que la ficha tiene un solo dueño: dos contratos para el mismo par de nodos
 * acaban divergiendo, y el par es lo que `<dl>` ya emparejaba.
 *
 * LANZA si el vecino no es un `<dt>`: eso sería la cáscara reordenada por debajo, un
 * contrato del programador, y tiene que sonar en desarrollo (regla de oro 1).
 *
 * @param {Element} dd
 * @returns {Element}
 */
function rotuloDe(dd) {
  const dt = dd.previousElementSibling
  if (dt === null || dt.tagName !== 'DT') {
    throw new Error(
      `app/main.js: el <dd data-ficha="${dd.getAttribute('data-ficha')}"> del pie no viene ` +
        `precedido de su <dt> (encontrado: ${dt === null ? 'nada' : dt.tagName}). La ficha es una ` +
        `<dl> de pares y F11 necesita el rótulo para reescribirlo y para ocultarlo con su valor.`,
    )
  }
  return dt
}

/** Los pares completos, para poder ocultar el rótulo junto con el valor. */
const fichaPares = new Map(
  [
    ['srs', fichaSrs],
    ['refcat', fichaRefcat],
    ['vertices', fichaVertices],
    ['superficie', fichaSuperficie],
    ['perimetro', fichaPerimetro],
    ['superficie-catastral', fichaSuperficieCatastral],
    ['delta-catastral', fichaDelta],
    ['colindantes', fichaColindantes],
  ].map(([clave, valor]) => [clave, { valor, rotulo: rotuloDe(valor) }]),
)

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
 * La referencia catastral que la app ha **deducido** de la ubicación de la
 * geometría, o `null` si no hay ninguna deducción vigente.
 *
 * Es un `let` de módulo por el mismo motivo que {@link colindantesTraidas}:
 * `model/parcela.js` no tiene dónde guardar esto y **no debe tenerlo**. Una
 * referencia deducida no es `parcela.refcat` —ese campo significa «lo afirma el
 * usuario»— y meterla ahí convertiría una conjetura en una afirmación, que es
 * justo lo que prohíbe la doctrina de la deducción.
 *
 * Lo escribe {@link fijarRefcatDeducida} y **se borra en cuanto entra parcela
 * nueva**: una referencia deducida de la geometría ANTERIOR pintada sobre la
 * actual sería una afirmación falsa sobre lo que hay en pantalla.
 *
 * ⛔ **Esa última frase era MENTIRA en dos de las cuatro puertas (auditoría
 * 2026-08-16).** Borraban la medición (paso 17) y la comprobación (paso 9); NO
 * borraban el Catastro (paso 7) ni el expediente (paso 13). Escenario verificado:
 * se importa un `.dxf` sin referencia —la app deduce una y la ficha pinta «…VK ·
 * deducida, sin confirmar»—, se abre después un proyecto guardado cuya parcela
 * tampoco trae referencia, y la ficha sigue enseñando la referencia de la parcela
 * ANTERIOR sobre la nueva ({@link actualizarFicha} sólo cae a la deducida cuando
 * el modelo no tiene). La vía del Catastro estaba enmascarada —su parcela siempre
 * trae `refcat`— pero el agujero era el mismo. Desde el arreglo, las CUATRO pasan
 * por {@link entraDocumentoNuevo}, que es el único sitio donde vive la regla.
 *
 * @type {string|null}
 */
let refcatDeducida = null

/**
 * El SELLO del documento que hay en pantalla: un contador monótono que sube una vez
 * por cada documento nuevo que entra, venga por la puerta que venga.
 *
 * ── POR QUÉ HACE FALTA, Y POR QUÉ NO ES UN `AbortController` ──
 * {@link deducirRefcatTrasImportar} lanza una consulta al Catastro y escribe su
 * respuesta en la ficha. Era una promesa suelta **sin ninguna guarda de vigencia**
 * (auditoría 2026-08-16): soltados dos dibujos sin referencia seguidos, la
 * respuesta del PRIMERO acababa pintada sobre la ficha del segundo. El patrón que
 * este proyecto ya tiene resuelto es el de `app/cableado-catastro.js#operar`
 * —abortador + token de secuencia monótono—, y aquí se usa **sólo su mitad del
 * token**: `catastroCableado.deducir()` no admite `AbortSignal`, así que un
 * `AbortController` en esta capa sería decorado. Lo que sí se puede garantizar, y
 * es lo que importa, es que **una respuesta superada no escriba**.
 *
 * @type {number}
 */
let selloDocumento = 0

/**
 * Ha entrado un DOCUMENTO NUEVO en la rama de parcela: se olvida la referencia
 * deducida del anterior y se invalida cualquier deducción que siga en el aire.
 *
 * Es la regla de {@link refcatDeducida} en un solo sitio. Las cuatro puertas la
 * llaman —Catastro (paso 7), comprobación (paso 9), expediente (paso 13) y medición
 * (paso 17)—, y tenerla escrita cuatro veces es justo cómo se perdió en dos de
 * ellas. Una puerta nueva que se olvide de esto vuelve a poder mentir, y por eso
 * `test/app/main-refcat-deducida.dom.test.js` la vigila sobre la app viva.
 *
 * **No avisa por el panel**, y es deliberado: lo que se borra es una CONJETURA de
 * la aplicación, no trabajo del usuario, y la ficha pasa a decir «Sin referencia»,
 * que es la verdad sobre el documento que acaba de entrar. Callar aquí no esconde
 * ningún cambio: lo que se esconde es lo contrario, dejarla puesta.
 *
 * @returns {void}
 */
function entraDocumentoNuevo() {
  selloDocumento += 1
  fijarRefcatDeducida(null)
}

/**
 * Qué rama está en pantalla, **desde el punto de vista de la ficha del pie**. Es un
 * `let` de módulo y no una lectura de `ramaCableada.get()` por una razón de orden:
 * la ficha se monta en el paso 4 y el conmutador no existe hasta el 13, así que
 * entre los dos hay nueve pasos en los que preguntarle sería preguntarle a `null`.
 * Lo escribe {@link aplicarRamaALaFicha}, que es el suscriptor del conmutador.
 *
 * Nace en PARCELA porque es con lo que arranca la pantalla: `index.html` declara esa
 * rama y `cablearRama` la confirma. **No existe el estado «sin rama».**
 *
 * @type {'PARCELA'|'EDIFICIO'}
 */
let ramaEnPantalla = RAMA.PARCELA

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
 *   · **{@link EYEBROW_MEDICION}** — ⛔ **el cuarto, y lo estrena F18**: la
 *     geometría la ha medido el técnico y ha entrado por un `.dxf` o un `.txt`.
 *     Ver el bloque de esa constante para el defecto que cierra.
 *
 * Sin parcela (`null`, que el store admite) se cae al lado conservador: el de la
 * demostración. Nunca se afirma «del Catastro» sin una parcela que lo respalde.
 *
 * ⚠️ **La pregunta es por el ORIGEN y no por el `idLocal`**, que es lo que hacía
 * hasta F18. Aquel criterio decía «si no es la demo, la trajo el Catastro», y era
 * cierto mientras el Catastro fuera la única puerta. Hoy hay cuatro orígenes en
 * `ORIGEN_PARCELA` y tres de ellos NO son la Sede.
 *
 *   · **{@link EYEBROW_GML_IMPORTADO}** — ⚠️ **el quinto, y lo estrena F19**: la
 *     geometría viene de un GML que se ha abierto desde un fichero. Hasta F19 este
 *     caso decía «del Catastro»; F18 lo midió al pasar y lo dejó dicho con su
 *     fecha, sin tocarlo. Eran DOS rótulos hasta el 2026-08-07, uno a cada lado de
 *     la puerta de F08; retirada la puerta, hay un solo estado que rotular.
 *
 * Sin parcela (`null`, que el store admite) se cae al lado conservador: el de la
 * demostración. Nunca se afirma «del Catastro» sin una parcela que lo respalde.
 *
 * ⚠️ **La pregunta es por el ORIGEN y no por el `idLocal`**, que es lo que hacía
 * hasta F18. Aquel criterio decía «si no es la demo, la trajo el Catastro», y era
 * cierto mientras el Catastro fuera la única puerta. Hoy hay cuatro orígenes en
 * `ORIGEN_PARCELA` y tres de ellos NO son la Sede.
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {string}
 */
function rotuloDelDato(parcelaActual) {
  const hayParcela = parcelaActual !== null && parcelaActual !== undefined
  // ⭐ Sin parcela se dice SIN PARCELA (2026-08-07). Hasta hoy este caso caía en
  // «Parcela de demostración», y era el lado conservador **mientras siempre
  // hubiera una demo dentro**; desde que la aplicación arranca vacía, esa frase
  // sería un dato inventado. Ver {@link EYEBROW_VACIO}.
  if (!hayParcela) return EYEBROW_VACIO
  // `ID_LOCAL_DEMO` es `null` cuando no se arrancó con `?demo=`, y ningún
  // `idLocal` real vale `null`: sin demostración esta rama no se toma nunca.
  if (ID_LOCAL_DEMO !== null && parcelaActual.idLocal === ID_LOCAL_DEMO) {
    return esSintetica ? EYEBROW_SINTETICA : EYEBROW_DEMOSTRACION
  }
  if (parcelaActual.origen === ORIGEN_PARCELA.GML_EXISTENTE) return EYEBROW_GML_IMPORTADO
  // ⛔ F22 · Un dibujo que ES la geometría oficial es cartografía del Catastro, no
  // una medición. Ver {@link EYEBROW_DIBUJO_CATASTRO} y {@link dibujoEsLaOficial},
  // donde está escrito el criterio que se probó primero y por qué era falso.
  if (ORIGENES_MEDIDOS.has(parcelaActual.origen)) {
    return dibujoEsLaOficial(parcelaActual) ? EYEBROW_DIBUJO_CATASTRO : EYEBROW_MEDICION
  }
  return EYEBROW_CATASTRO
}

/**
 * ¿Lo que se está dibujando **ES** la geometría oficial, vértice a vértice?
 *
 * No «¿hay una geometría oficial?» —eso es cierto en todo el flujo normal de F18 y
 * no distingue nada—, sino si las dos son la MISMA. Es la afirmación que hace
 * {@link EYEBROW_DIBUJO_CATASTRO}, comprobada en vez de supuesta.
 *
 * Compara con salida temprana y sin serializar: se llama desde `repintarFicha`, o
 * sea en cada vértice que se arrastra, y una parcela real son decenas de vértices.
 *
 * @param {object} parcelaActual
 * @returns {boolean}
 */
function dibujoEsLaOficial(parcelaActual) {
  const oficial = parcelaActual.geometriaOficial
  const recintos = parcelaActual.recintos
  if (!Array.isArray(oficial) || !Array.isArray(recintos)) return false
  if (oficial.length === 0 || oficial.length !== recintos.length) return false
  for (let r = 0; r < recintos.length; r++) {
    const a = recintos[r]?.vertices
    const b = oficial[r]?.vertices
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    for (let v = 0; v < a.length; v++) {
      if (a[v][0] !== b[v][0] || a[v][1] !== b[v][1]) return false
    }
  }
  return true
}

/**
 * ⭐ **(2026-08-19) ¿Lo que ha entrado es un levantamiento SIN UNIR?** O sea: hay
 * nube de puntos y todavía **ningún** contorno.
 *
 * Es el tercer destino del aterrizaje tras importar, y existe porque las otras dos
 * preguntas del sitio —{@link dibujoEsLaOficial} y `aterrizarTrasContrastar`— dan
 * la geometría por hecha. Con `recintos: []` la primera contesta `false` (no hay
 * dibujo que comparar) y la segunda abriría el Diagnóstico de un contorno que no
 * existe. El destino correcto es Edición: es donde están «Dibujar recinto» y el
 * enganche a esos puntos, o sea la pantalla que convierte ese fichero en parcela.
 *
 * ⚠️ **Se pregunta por `hayGeometria` y no por `recintos.length`**, para que la
 * definición de «hay contorno» siga saliendo de un solo sitio
 * (`app/cableado-expediente.js`) y no de una segunda regla escrita aquí.
 *
 * @param {object|null} parcelaActual
 * @returns {boolean}
 */
function soloPuntosSinRecinto(parcelaActual) {
  return hayPuntos(parcelaActual) && !hayGeometria(parcelaActual)
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
  pintarCapasCargadas(parcelaActual)

  fichaSrs.textContent = SRS_DEMO
  // `refcat` es `null` en el dataset sintético, y se DICE («Sin referencia») en
  // vez de dejar un guion: un guion se lee como «esto no ha cargado».
  //
  // ⚠️ **Y hay un tercer estado desde la deducción automática de la importación**:
  // el modelo no tiene referencia, pero la app ha deducido una de la ubicación.
  // El orden importa y es el único posible: lo que AFIRMA el usuario manda sobre
  // lo que CONJETURA la app, así que la deducida solo se pinta cuando no hay
  // ninguna en el modelo, y siempre con su coletilla ({@link
  // SUFIJO_REFCAT_DEDUCIDA}). Sin ella, una parcela importada de un DXF se leería
  // en la ficha exactamente igual que una traída de la Sede.
  const refcatModelo = (parcelaActual && parcelaActual.refcat) || null
  fichaRefcat.textContent =
    refcatModelo !== null
      ? refcatModelo
      : refcatDeducida !== null
        ? `${refcatDeducida}${SUFIJO_REFCAT_DEDUCIDA}`
        : SIN_REFCAT
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
  //
  // ⛔ **F22 · y desde hoy dice de DÓNDE salieron.** Son dos fuentes: la consulta
  // al Catastro de siempre y las fincas que sobran de un dibujo de varias. El
  // número solo no distingue una cosa de la otra, y confundirlas es afirmar una
  // procedencia que la pantalla no respalda. Ver {@link colindantesDeDibujo}.
  fichaColindantes.textContent =
    colindantesTraidas === null
      ? SIN_COLINDANTES
      : `${FORMATO_ENTERO.format(colindantesTraidas)}${colindantesDeDibujo ? SUFIJO_COLINDANTES_DIBUJO : ''}`
}

/**
 * Los dos indicadores de qué geometrías hay cargadas (2026-08-08).
 *
 * ── POR QUÉ EXISTEN ──
 * Desde que traer el Catastro tiene dos puertas, el modelo puede estar en cuatro
 * estados y no en dos: sin nada, solo con levantamiento, solo con parcelario, o con
 * los dos. Hasta ahora la única forma de saber en cuál estabas era mirar el mapa y
 * adivinar de quién era cada trazo — y de eso depende qué se va a generar y si el
 * diagnóstico tiene contra qué medir.
 *
 * ⛔ **INFORMAN, NO CONTROLAN.** No son botones, no llevan `data-accion` y no
 * seleccionan capa activa. El día que se conviertan en selectores, esta feature se
 * ha desbordado hacia el sistema general de capas, que está fuera del alcance a
 * propósito.
 *
 * ⚠️ El estado se dice con PALABRAS además de con color, y no es celo: el color es
 * el único canal que un daltónico no tiene, y lo que estos dos indicadores comunican
 * es qué se va a firmar.
 *
 * @param {object|null} parcelaActual
 * @returns {void}
 */
function pintarCapasCargadas(parcelaActual) {
  const hayMedicion = recintosDe(parcelaActual).length > 0
  const oficial = parcelaActual === null ? null : parcelaActual?.geometriaOficial
  const hayOficial = Array.isArray(oficial) && oficial.length > 0

  capaMedicion.dataset.presente = String(hayMedicion)
  capaMedicion.textContent = hayMedicion ? 'Levantamiento' : 'Sin levantamiento'
  capaOficial.dataset.presente = String(hayOficial)
  capaOficial.textContent = hayOficial ? 'Parcelario del Catastro' : 'Sin parcelario'
}

// ── F11 · la otra cara de la misma ficha ─────────────────────────────────────

/**
 * El rótulo de PROCEDENCIA de la cabecera con la rama EDIFICIO puesta. Dos estados
 * y no tres, porque en esta rama **no hay demostración**: el store nace vacío a
 * propósito. Ver {@link EYEBROW_EDIFICIO}.
 *
 * @param {object|null} edificioActual
 * @returns {string}
 */
function rotuloDelEdificio(edificioActual) {
  return edificioActual === null || edificioActual === undefined
    ? EYEBROW_EDIFICIO_VACIO
    : EYEBROW_EDIFICIO
}

/**
 * Las partes de un Edificio, o `[]`. Mismo criterio que {@link recintosDe}: en este
 * store «no hay nada» es un estado legítimo y no una excepción.
 *
 * @param {object|null} edificioActual
 * @returns {Array<object>}
 */
function partesDe(edificioActual) {
  return edificioActual && Array.isArray(edificioActual.partes) ? edificioActual.partes : []
}

/**
 * Repinta la ficha desde el POJO `Edificio`. Suscriptor del SEGUNDO store, y la
 * mitad de {@link repintarFicha} que se ejecuta con la rama EDIFICIO puesta.
 *
 * Pinta CUATRO renglones y no ocho: los otros cuatro los oculta
 * {@link aplicarRamaALaFicha}, porque sus rótulos hablan de la parcela y aquí
 * estarían afirmando cosas del otro documento (ver el bloque de {@link ROTULO_PARTES}).
 *
 * ⚠️ **La superficie se mide sobre las huellas que TIENEN contorno**, y las que no
 * lo tienen se cuentan en el renglón de arriba: una suma incompleta con pinta de
 * completa es la regla de oro 1 rota. `geo/area.js#area` devuelve el valor absoluto,
 * así que una huella dibujada al revés suma igual — el sentido de giro es asunto del
 * serializador (F13), no de una cifra que se lee.
 *
 * @param {object|null} edificioActual  POJO de Edificio del segundo store (o `null`).
 * @returns {void}
 */
function actualizarFichaEdificio(edificioActual) {
  eyebrow.textContent = rotuloDelEdificio(edificioActual)

  // El SRS es del EXPEDIENTE, no del tema: la misma línea en las dos ramas.
  fichaSrs.textContent = SRS_DEMO
  fichaRefcat.textContent = (edificioActual && edificioActual.refcat) || SIN_REFCAT

  const partes = partesDe(edificioActual)
  if (edificioActual === null || edificioActual === undefined) {
    // Sin edificio no hay nada que contar ni que medir, y se DICE. Un «0» aquí
    // afirmaría que el edificio tiene cero partes, que es otra cosa.
    fichaVertices.textContent = SIN_EDIFICIO
    fichaSuperficie.textContent = SIN_EDIFICIO
    return
  }

  const huellas = partes
    .map((parte) => parte?.recinto?.vertices)
    .filter((vertices) => Array.isArray(vertices) && vertices.length > 0)

  fichaVertices.textContent = textoPartes(huellas.length, partes.length)
  fichaSuperficie.textContent = `${FORMATO_SUPERFICIE.format(
    huellas.reduce((suma, vertices) => suma + area(vertices), 0),
  )} m²`
}

/**
 * **El único punto de entrada de la ficha desde F11.** Mira qué rama está en
 * pantalla y le pasa el trabajo al pintor que toca, cada uno leyendo SU store.
 *
 * Existe por lo mismo que {@link pintarMedidas} es un solo sitio: los dos stores
 * notifican por su cuenta y la ficha es una sola. Sin este reparto, un `estado.set`
 * de la parcela —una edición, un `undo`, una parcela traída del Catastro— repintaría
 * cifras de parcela encima de las del edificio **sin que nadie lo pidiera**, y el
 * usuario vería la superficie de otra cosa en la línea que está mirando.
 *
 * @returns {void}
 */
function repintarFicha() {
  if (ramaEnPantalla === RAMA.EDIFICIO) actualizarFichaEdificio(estadoEdificio.get())
  else actualizarFicha(estado.get())
}

/**
 * Deja la ficha con la forma de una rama: reescribe los dos rótulos que cambian de
 * pregunta, oculta (o repone) los cuatro pares que solo tienen sentido en la parcela
 * y repinta. Es el suscriptor del conmutador del paso 13.
 *
 * Se ocultan **el `<dd>` y su `<dt>`**: la ficha es una rejilla de dos columnas y
 * dejar el rótulo solo la partiría por la mitad.
 *
 * @param {'PARCELA'|'EDIFICIO'} ramaNueva
 * @returns {void}
 */
function aplicarRamaALaFicha(ramaNueva) {
  ramaEnPantalla = ramaNueva === RAMA.EDIFICIO ? RAMA.EDIFICIO : RAMA.PARCELA
  const enEdificio = ramaEnPantalla === RAMA.EDIFICIO

  fichaPares.get('vertices').rotulo.textContent = enEdificio ? ROTULO_PARTES : ROTULO_VERTICES
  fichaPares.get('superficie').rotulo.textContent = enEdificio
    ? ROTULO_SUPERFICIE_PLANTA
    : ROTULO_SUPERFICIE

  for (const clave of FICHA_SOLO_PARCELA) {
    const par = fichaPares.get(clave)
    par.valor.hidden = enEdificio
    par.rotulo.hidden = enEdificio
  }

  repintarFicha()
}

/**
 * Deja constancia de la referencia catastral DEDUCIDA (o de que ya no hay
 * ninguna, con `null`) y repinta la ficha.
 *
 * @param {string|null} refcat
 * @returns {void}
 */
function fijarRefcatDeducida(refcat) {
  refcatDeducida = typeof refcat === 'string' && refcat !== '' ? refcat : null
  repintarFicha()
}

/**
 * Deja constancia de cuántas parcelas colindantes se han traído (o de que ya no
 * hay ninguna consulta vigente, con `null`) y repinta la ficha.
 *
 * @param {number|null} cuantas
 * @returns {void}
 */
function fijarRecuentoColindantes(cuantas, deDibujo = false) {
  // ⛔ **QUE UNA CONSULTA SUSTITUYA EL PARCELARIO DEL DIBUJO NO PUEDE SER MUDO.**
  // Lo destapó el guion 24: cargada una finca del DXF, las siete fincas vecinas
  // del fichero se cambiaban por las que contesta el WFS —7 → 3 medido— sin una
  // sola frase. No es geometría de trabajo, así que no es el defecto de agosto;
  // pero es contexto que el usuario ha visto aparecer y desaparecer, y en pantalla
  // las dos cosas se llaman igual: «colindantes». Regla de oro 1.
  if (colindantesDeDibujo && cuantas !== null && deDibujo !== true) {
    panel.avisar(
      `Las ${FORMATO_ENTERO.format(colindantesTraidas)} fincas vecinas que traía el dibujo se ` +
        `sustituyen por las ${FORMATO_ENTERO.format(cuantas)} que ha devuelto el Catastro para ` +
        `esta parcela. Son dos parcelarios distintos y el que manda a partir de ahora es el del ` +
        `servicio.`,
      { nivel: NIVEL.AVISO },
    )
  }
  colindantesTraidas = cuantas
  colindantesDeDibujo = cuantas !== null && deDibujo === true
  repintarFicha()
}

/**
 * ⛔ **F22 · De DÓNDE salieron las vecinas que hay dibujadas, que desde hoy son
 * dos sitios y antes era uno.**
 *
 * Hasta F22 la única forma de tener colindantes era pulsar «Traer colindantes», y
 * el renglón de la ficha podía decir «12» sin más porque no había otra lectura.
 * Ahora un DXF de «Consulta Masiva» trae la manzana entera y las siete fincas que
 * no eliges se quedan dibujadas: son parcelario de contexto **del fichero**, no
 * una consulta a la Sede.
 *
 * Que el número no diga cuál de las dos cosas es sería exactamente el error que
 * F18 cometió un piso más arriba —una afirmación de procedencia que la pantalla
 * no respalda—, así que se distingue. `false` cuando vienen del Catastro, que es
 * lo de siempre y por tanto el defecto.
 *
 * @type {boolean}
 */
let colindantesDeDibujo = false

/**
 * ¿Hay un ARRASTRE DE VÉRTICE en curso? Lo escribe {@link previsualizarMedidas} y lo
 * lee el atajo del historial, que mientras dure el gesto se calla y lo dice. El
 * porqué completo —de dónde sale el dato, por qué no de un predicado del visor y
 * cuál es su red de seguridad— está en {@link MENSAJE_ATAJO_ARRASTRANDO} y en el
 * bloque de {@link cablearEdicion} que lo consulta.
 *
 * Vive AQUÍ, y no en la sección 6 con el resto del atajo, por la zona muerta del
 * `let`: el paso 5 (`crearVisor`) llama al canal en vivo durante su construcción.
 *
 * @type {boolean}
 */
let arrastrandoVertice = false

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
 * El segundo argumento (`refVertice`) le sirve al otro consumidor del canal —la
 * capa de acotaciones, que resalta la cota del lado en curso— y, desde la auditoría
 * del 2026-08-16, también a {@link arrastrandoVertice}: es el ÚNICO sitio desde el
 * que esta capa puede saber que hay un gesto de arrastre abierto.
 *
 * @param {Array<Array<[number, number]>>} anillosUTM
 * @param {{recinto: number, indice: number}|null} [refVertice=null]  El vértice que
 *   se está moviendo, o `null` si esto es el render de la verdad (ver
 *   `viewer/sincronizacion.js`, typedef `AlPrevisualizar`).
 * @returns {void}
 */
function previsualizarMedidas(anillosUTM, refVertice = null) {
  // ⛔ **LO PRIMERO, Y ANTES DE LA GUARDA DE RAMA.** Los vértices de la parcela se
  // pueden arrastrar TAMBIÉN con la rama EDIFICIO puesta (lo dice la guarda de
  // abajo), así que salir antes dejaría la bandera contando una verdad a medias.
  arrastrandoVertice = refVertice !== null && refVertice !== undefined
  // ⚠️ F11: con la rama EDIFICIO puesta este canal NO pinta. La parcela sigue en el
  // mapa como CONTEXTO y sus vértices se pueden arrastrar —la barra de edición está
  // oculta, los marcadores no—, así que sin esta guarda un arrastre escribiría la
  // superficie de la parcela en la línea que está enseñando la del edificio. Es la
  // misma razón por la que {@link repintarFicha} reparte en vez de pintar.
  if (ramaEnPantalla === RAMA.EDIFICIO) return
  const parcelaActual = estado.get()
  const base = recintosDe(parcelaActual)
  pintarMedidas(
    anillosUTM.map((vertices, i) => ({ ...base[i], vertices })),
    declaradaDe(parcelaActual),
  )
}

estado.subscribe(repintarFicha)
// F11 · el SEGUNDO store también repinta la ficha, y por el mismo camino: es la
// misma vista de dos documentos distintos. Suscribirse a los dos y repartir dentro
// —en vez de tener dos fichas— es lo que hace que no puedan divergir.
estadoEdificio.subscribe(repintarFicha)
// `subscribe` NO notifica al suscribirse (ver `crearEstadoVista`): el primer
// pintado se hace a mano, o la ficha se quedaría con los guiones del HTML hasta
// la primera edición.
repintarFicha()

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
  // ⭐ A DÓNDE MIRA EL MAPA CUANDO NO HAY NADA (2026-08-07). Desde que la
  // aplicación arranca vacía, ésta es la rama que se toma **casi siempre** al
  // abrir: `encuadrar` prefiere la geometría cuando la hay y solo cae aquí
  // cuando el store está vacío, así que en cuanto entre una parcela el mapa
  // vuela a ella y esto no se vuelve a usar. **Sin esta línea `crearVisor`
  // LANZA** y la aplicación no arranca — es el contrato de `viewer/index.js`, y
  // es deliberado: un visor sin parcela obliga a decidir a dónde mirar. El
  // porqué del sitio elegido, en {@link VISTA_SIN_PARCELA}.
  vistaInicial: VISTA_SIN_PARCELA,
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
  // ⛔ AVISO PARA QUIEN LEA `diagnostico: true` Y `comprobacion: true` DE ABAJO
  // (rework de UI · T8, 2026-08-04). Son banderas de **MONTAJE**: le dicen a
  // `crearVisor` qué cajón CONSTRUIR, y nada más. **No son estado de modo, y no
  // dicen en qué punto del recorrido está el usuario.** Están escritas así desde
  // F07/F08 y las dos notas de abajo ya lo explican, pero el plan del rework las
  // leyó como si fueran el modo activo y dio por hecho que la navegación ya
  // existía; costó una revisión cruzada descubrir que no. Quien sabe el paso, la
  // rama y el modo es `app/navegacion.js`, desde T1 — y el rail que lo pinta,
  // `app/barra.js`. Si buscas «en qué pantalla estamos», no es esto.
  //
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
  // cuatro esquinas del mapa estaban ocupadas antes de F08 (`topleft` el zoom
  // —y hasta el 2026-08-05 también la barra de edición, que hoy vive centrada
  // abajo—, `topright` el control de capas, `bottomright` la opacidad y la
  // atribución). Los dos cajones son mutuamente excluyentes por diseño —la
  // comprobación PRECEDE al diagnóstico y no coexiste con él—, así que montarlos
  // los dos es lo normal y abrirlos a la vez no; de esa exclusión responde el
  // paso 9, que es quien sabe en qué punto del recorrido está el usuario.
  //
  // El cajón nace CERRADO y en blanco: montarlo no comprueba nada. Quien lo abre
  // y le da contenido es el paso 9, cuando el usuario suelta un `.gml`.
  comprobacion: true,
  // ── F22 · El cajón para ELEGIR FINCA y la capa que las dibuja ────────────
  // El DXF de «Consulta Masiva» del Catastro trae la MANZANA ENTERA —ocho fincas
  // disjuntas, cada una con su referencia rotulada dentro— y hay que decir cuál es
  // la del expediente. Ocho referencias que comparten los once primeros caracteres
  // no se distinguen leyendo: por eso son DOS piezas y no solo una lista.
  //
  // ⚠️ **Tercer cajón en `bottomleft`**, y el mismo reparto que los dos de arriba:
  // montarlos los tres es lo normal —son caras del mismo hueco— y abrir dos a la
  // vez no. De esa exclusión responde el paso que abre cada uno, que es quien sabe
  // en qué punto del recorrido está el usuario; aquí solo se montan, inertes.
  parcelas: true,
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
  // ── F17 · el SOBRANTE, montado (que tampoco es derivado) ─────────────────
  // Monta las dos piezas de F17: la LISTA del panel y la capa de MANCHAS
  // numeradas. Booleana por contrato, como `colindantes`, porque ninguna de las
  // dos elige nada al montarse: la lista NO es un control del mapa —no hay esquina
  // que escoger— y la capa no mide en píxeles.
  //
  // ⚠️ **`visor.sobrante.lista.nodo` sale SIN COLGAR de ningún sitio.** No es un
  // olvido: la sección anfitriona del panel la conoce `app/`, no `viewer/`. Quien
  // lo inserta es el paso 16, y hasta entonces el nodo existe y no está en el
  // documento — que es también lo que impide que sus `data-*` compitan por el
  // `querySelector` mientras nadie lo ha pedido.
  //
  // Nacen las dos VACÍAS: montarlas no deriva nada. Derivar es una resta booleana
  // que cuesta lo que cuesta, y corre cuando el usuario pulsa el CTA (paso 16).
  sobrante: true,
  // ── LA LEYENDA DE LOS GRAFISMOS (2026-08-15) ─────────────────────────────
  // Encargo del autor: «que el visor tenga un pequeño cuadro de leyenda donde se
  // dice qué significa cada grafismo». Y era un agujero real: el visor dibuja
  // hasta once cosas distintas —amarillo, gris discontinuo, mancha fría, ámbar,
  // rosa, banda punteada, cian, violeta— **cada una elegida por descarte y con su
  // porqué escrito en el módulo que la pinta**, y ese porqué no llegaba a la
  // pantalla. Ver la cabecera de `viewer/leyenda.js`.
  //
  // ⚠️ Se pasa `{grupos}` EXPLÍCITO aunque coincida con `GRUPOS_POR_DEFECTO`, por
  // lo mismo que `baseInicial`: la app dice en voz alta con qué arranca. Y arranca
  // con los dos grupos que están dibujados SIEMPRE que hay algo en el mapa; los
  // otros tres los enciende el paso 8, que es quien sabe qué pantalla hay
  // ({@link refrescarLeyenda}). Una leyenda que anuncia el ámbar de la invasión en
  // una pantalla donde no se diagnostica nada está mintiendo, y una leyenda que
  // miente es peor que no tenerla.
  //
  // Nace PLEGADA: el mapa es el asunto y esto es el pie de foto.
  leyenda: { grupos: [GRUPO_LEYENDA.LEVANTAMIENTO, GRUPO_LEYENDA.CATASTRO] },
  // El canal EN VIVO de la ficha (criterio de aceptación 4). Es opción de PRIMER
  // NIVEL y no una clave de `edicion` porque medir mientras se arrastra no exige
  // poder insertar vértices ni enganchar al parcelario: son dos cosas distintas.
  // Va DESPUÉS de las cotas en el mismo canal; `sincronizacion.js` ya envuelve
  // este gancho en su propio `try`, así que un fallo midiendo no se lleva por
  // delante ni las acotaciones ni el gesto.
  alPrevisualizar: previsualizarMedidas,
})

// ── 5 bis · LOS PUNTOS SUELTOS DEL LEVANTAMIENTO (2026-08-19) ────────────────
//
// Un fichero de campo trae 88 `POINT` y cero polilíneas. Desde hoy se pueden
// importar SIN unir y quedan de dianas para dibujar el linde encima.
//
// ⛔ **`viewer/edicion.js#fijarPuntos` llevaba desde el paso 9 de F18 escrito,
// documentado y probado, y su ÚNICO llamante era su propia prueba.** El
// enganche a lo medido existía en el catálogo de `edit/snap.js` y no había forma
// de llegar a él desde la aplicación: es el patrón «canal escrito y sin
// enchufar» que este proyecto ya se ha reprochado cuatro veces. Esto es el cable.
//
// ── POR QUÉ POR EL STORE Y NO EN EL GANCHO DE IMPORTACIÓN ──────────────────
// Los puntos viven en el modelo (`parcela.puntosLevantamiento`), así que llegan
// por MÁS puertas que la importación: recuperar un expediente guardado, abrir un
// fichero de proyecto, deshacer con `Ctrl+Z`. Colgarlo del gancho de la medición
// habría dejado las tres últimas sin puntos —sin verlos y sin engancharlos— y la
// diferencia no se ve hasta que alguien intenta apuntar. Por el store se cubren
// todas de una vez, que es lo mismo que ya hacen la ficha del pie y los hechos.
//
// ⚠️ **Las DOS llamadas van juntas y siempre**: `pintar` los enseña y
// `fijarPuntos` los engancha. Separarlas es la forma de que un día se vea un
// punto donde no se puede enganchar, o al revés.
function repintarPuntosLevantamiento() {
  const parcela = estado.get()
  const puntos = Array.isArray(parcela?.puntosLevantamiento) ? parcela.puntosLevantamiento : []
  visor.puntosLevantamiento?.pintar(puntos)
  // `fijarPuntos` copia y tira su caché de dianas; pasarle el array del modelo
  // —congelado— es seguro y es lo que garantiza que dibujo y enganche coincidan.
  visor.edicion?.fijarPuntos(puntos)
  // ⭐ **Y LA TERCERA SALIDA, desde F24**: el botón que los quita, con su cuenta.
  // Va aquí y no en `cablearEdicion` —que es quien gobierna las otras seis
  // herramientas de esa barra— por una razón que las otras seis no tienen: los
  // puntos no dependen de la rama ni del paso, solo del store, y éste es el único
  // suscriptor que ya los conoce. Meterlo allí habría hecho falta un segundo
  // suscriptor al mismo store para la misma cifra, y dos cuentas del mismo dato
  // divergen (la que se queda vieja es siempre la de la UI).
  visor.barraEdicion?.puntosVisible?.(puntos.length)
}

/** Lo que se dice si alguien logra pulsar «Quitar los puntos» sin puntos. */
export const MENSAJE_SIN_PUNTOS_QUE_QUITAR =
  'No hay ningún punto de levantamiento que quitar: este expediente no trae ninguno.'

/**
 * Lo que se dice tras quitar la nube de puntos.
 *
 * ⚠️ **Nombra el atajo, y esa es la mitad del mensaje.** Lo que se acaba de borrar
 * vino de un fichero que el usuario puede no tener a mano —el `.dxf` que le pasó el
 * topógrafo—, así que decir solo «quitados» sería contar la pérdida sin contar la
 * salida. El botón ya lo prometía antes del clic (ver `pistaQuitarPuntos`); esto lo
 * confirma después, que es cuando hace falta de verdad.
 *
 * @param {number} cuantos
 * @returns {string}
 */
export function mensajePuntosQuitados(cuantos) {
  const sujeto = cuantos === 1 ? 'el punto suelto' : `los ${cuantos} puntos sueltos`
  return `Quitado${cuantos === 1 ? '' : 's'} ${sujeto} del levantamiento. «Deshacer» (Ctrl+Z) los devuelve.`
}

/**
 * Quita del expediente la nube de puntos del levantamiento (F24, 2026-08-19).
 *
 * ⛔ **EL HUECO QUE ESTO CIERRA.** Desde que un `.dxf` de puntos puede entrar sin
 * unirlos, los puntos VIVEN EN EL MODELO: se guardan con el expediente, viajan en
 * el fichero de proyecto y se vuelven a pintar cada vez que se recupera. En cuanto
 * el contorno está dibujado encima dejan de servir para nada, y **no había forma de
 * quitarlos**: la única era no haberlos importado. Con 88 puntos sobre una parcela
 * ya cerrada eso es el mapa tapado para siempre.
 *
 * ⭐ **BORRA DE VERDAD, no esconde**, y es la decisión. Un conmutador de visibilidad
 * habría dejado dos verdades —lo que hay en el modelo y lo que se ve— y habría
 * obligado a apagar el enganche por su cuenta, porque un punto invisible al que se
 * engancha el ratón es peor que un punto de más. Además esa segunda verdad no
 * sobrevive a guardar y recuperar, así que la nube volvería a aparecer sola.
 *
 * ⭐ **Y ES REVERSIBLE PORQUE PASA POR EL MISMO CAMINO QUE TODO LO DEMÁS**: clon,
 * `set`, y un `commit` DESPUÉS. `Ctrl+Z` lo deshace como cualquier edición, que es
 * exactamente la red que hace admisible que un botón se lleve 88 puntos de un clic.
 * (El mismo razonamiento —y el mismo orden de las tres líneas— que `cerrarDibujo`.)
 *
 * ⚠️ **No toca ningún otro campo**, y la copia es un `structuredClone` del
 * expediente entero: es la lección de F21 por el otro lado —lo que allí se perdía
 * era un campo que un compositor no arrastraba, y aquí se arrastra todo porque no
 * se compone nada.
 *
 * ⚠️ **Se EXPORTA para poder probarla sin el botón**, y no es una comodidad: el
 * botón lo fabrica `viewer/barra-edicion.js` en el momento del montaje, así que un
 * test que rehaga la barra —cosa que el arnés de `main-edicion.dom.test.js` hace en
 * cada `montar()`— se queda con un nodo que este oyente nunca vio. Lo que la
 * aplicación garantiza es esta función; que el botón la alcance de verdad lo mide
 * el navegador (`scripts/smoke-navegador/28-puntos-sueltos.js`), que es la única
 * herramienta que ve el botón que el usuario pulsa.
 *
 * @returns {void}
 */
export function quitarPuntosLevantamiento() {
  const actual = estado.get()
  const puntos = Array.isArray(actual?.puntosLevantamiento) ? actual.puntosLevantamiento : []
  if (puntos.length === 0) {
    // No debería llegar —el botón está escondido sin puntos—, pero un clic que no
    // hace nada y no lo dice es la regla de oro 1 rota por omisión.
    panel.avisar(MENSAJE_SIN_PUNTOS_QUE_QUITAR, { nivel: NIVEL.AVISO })
    return
  }
  const cuantos = puntos.length
  const siguiente = structuredClone(actual)
  siguiente.puntosLevantamiento = []
  estado.set(siguiente)
  commit(historial, siguiente)
  panel.avisar(mensajePuntosQuitados(cuantos), { nivel: NIVEL.AVISO })
}

// El botón lo fabrica `viewer/barra-edicion.js` y vive en la barra del mapa, así
// que se busca como «Dibujar recinto» —con `querySelector` y su guarda— y no por
// el contrato de `nodo()`, que LANZA: un montaje sin visor (los dobles de test de
// otros pasos) no tiene barra, y ahí no hay nada que cablear.
{
  const botonQuitarPuntos = document.querySelector('[data-accion="quitar-puntos"]')
  if (botonQuitarPuntos !== null) {
    botonQuitarPuntos.addEventListener('click', quitarPuntosLevantamiento)
  }
}

estado.subscribe(repintarPuntosLevantamiento)
// `subscribe` NO notifica al suscribirse (ver `crearEstadoVista`), y el arranque
// puede traer ya una parcela con puntos —un expediente recuperado—: la primera
// pasada se hace a mano, igual que con la ficha del pie.
repintarPuntosLevantamiento()

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
 * ¿Hay una VENTANA MODAL abierta encima? Si la hay, los atajos de esta capa se
 * callan y lo dicen: ver {@link MENSAJE_ATAJO_CON_DIALOGO}.
 *
 * ── POR QUÉ NO BASTA `dialog[open]` ────────────────────────────────────────
 * Porque `open` no distingue las dos formas de enseñar un `<dialog>`, y esta
 * aplicación usa las dos a propósito. `showModal()` deja INERTE todo lo de detrás
 * y pinta un velo —ésos son los que hay que atender—; `show()` no, y
 * `app/dialogo-informe.js#presentar` lo usa deliberadamente en modo PANTALLA para
 * que el rail siga navegando y el mapa se siga viendo. Apagar el undo ahí sería
 * romper una pantalla de trabajo por arreglar otra cosa.
 *
 * ── LAS DOS PREGUNTAS, Y POR QUÉ HACEN FALTA LAS DOS ───────────────────────
 *   · **`:modal`** es la respuesta exacta y la da el navegador. Es la que manda
 *     donde existe, porque no depende de que nadie se acuerde de nada.
 *   · **`aria-modal`** es la de respaldo, y no es una imitación pobre: en jsdom
 *     `showModal` NO EXISTE (medido: `el.showModal is not a function`, jsdom
 *     29.1.1), así que los seis diálogos caen a su vía de respaldo —el atributo
 *     `open` a pelo— y `:modal` no casaría jamás. O sea: sin esta segunda
 *     pregunta, este guardián estaría apagado justo donde se prueba. Y el atributo
 *     no se inventa aquí: los seis lo escriben ya, y el ÚNICO que escribe
 *     `aria-modal="false"` es el informe en modo pantalla, que es exactamente el
 *     caso que hay que dejar pasar. Se lee «no es modal» solo con ese `false`
 *     explícito: un `<dialog open>` de un tercero sin `aria-modal` se trata como
 *     modal, que es el lado conservador (peor es deshacer a ciegas).
 *
 * @param {Document} documento  Dónde buscar.
 * @returns {boolean}
 */
function hayDialogoModalAbierto(documento) {
  for (const dialogo of documento.querySelectorAll('dialog[open]')) {
    // `try` porque `:modal` es un selector reciente: un motor que no lo conozca
    // lanza `SyntaxError` al parsearlo, y eso no puede tumbar un `keydown`.
    try {
      if (dialogo.matches(':modal')) return true
    } catch {
      /* sin `:modal`: decide la pregunta de abajo */
    }
    if (dialogo.getAttribute('aria-modal') !== 'false') return true
  }
  return false
}

/**
 * ¿Hay un ARRASTRE DE VÉRTICE en curso? Mientras lo haya, los atajos del historial
 * se callan y lo dicen: ver {@link MENSAJE_ATAJO_ARRASTRANDO}.
 *
 * ── DE DÓNDE SALE ESTE DATO, Y POR QUÉ NO DE UN PREDICADO DEL VISOR ────────
 * Porque no hay ninguno: la bandera `arrastrando` de `viewer/sincronizacion.js` es
 * un `let` privado y `crearVisor` no devuelve esa pieza. Lo que SÍ hay es el
 * segundo parámetro del canal en vivo que este módulo ya recibe: `AlPrevisualizar`
 * define `refVertice` como «el vértice que se está moviendo» en cada `drag` y
 * `null` «al final de cada `render()`, con los anillos DEL ESTADO». O sea: el
 * estado del gesto viaja por un contrato que ya está publicado y cableado, y aquí
 * solo se lee un argumento que hasta hoy se tiraba. No se toca `viewer/`.
 *
 * ── LA RED DE SEGURIDAD, Y POR QUÉ ES OBLIGATORIA ─────────────────────────
 * Un gesto que nunca recibe su `dragend` —el puntero sale de la ventana— no
 * emitiría el render final que baja esta bandera, y el `Ctrl+Z` se quedaría MUERTO
 * EN SILENCIO: es el hallazgo 2.11 que `viewer/sincronizacion.js` ya se encontró
 * con su propio render diferido, con esta cara. Un arrastre no puede sobrevivir a
 * que se suelte el botón del ratón, así que {@link cablearEdicion} escucha el
 * `mouseup`/`pointerup` del documento y la baja ahí. Con eso, lo peor que puede
 * pasar es que el atajo espere a que el usuario levante el dedo.
 *
 * ⚠️ **Se DECLARA quince pasos más arriba, junto a {@link previsualizarMedidas}**, y
 * no aquí, que es donde se lee. No es orden estético: el paso 5 llama a
 * `crearVisor` y `crearVisor` LLAMA al canal en vivo durante su propia construcción
 * (ver la cabecera del módulo, apartado 4), así que un `let` declarado en esta
 * sección quedaría en la zona muerta y el arranque reventaría con
 * «Cannot access 'arrastrandoVertice' before initialization». Es exactamente la
 * trampa que la ficha ya pagó en F06.
 */

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
 *     macOS) → lo mismo, sobre `document`. **Inhibidos en tres situaciones** —
 *     dentro de un campo de texto ({@link esCampoDeTexto}), bajo una ventana modal
 *     ({@link hayDialogoModalAbierto}) y durante un arrastre de vértice
 *     ({@link arrastrandoVertice})—; ver la decisión 4 de la cabecera para cuál de
 *     las tres se DICE y por qué.
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
 * @param {() => void} [opciones.alSoltarColindantes]  Para soltar el REGISTRO de
 *   vecinas (`app/colindantes.js`) cuando entra parcelario nuevo. Es un callback
 *   por lo mismo que {@link opciones.alContarColindantes}: este cableado no
 *   conoce al registro, y el registro se monta doce pasos más tarde. Por defecto
 *   no hace nada, que es la verdad en una pantalla montada sin él.
 * @param {(instantanea: object) => boolean} [opciones.esDeEdificio]  ¿Esta
 *   instantánea del historial es de la rama EDIFICIO? Por defecto «no», que es lo
 *   correcto para quien monte este cableado sin la otra rama (tests, uso como
 *   librería): sin edificio no hay instantáneas de edificio.
 * @param {(instantanea: object) => boolean} [opciones.aplicarDeEdificio]  Quien
 *   sabe escribir una instantánea de EDIFICIO donde le toca. Devuelve `false` si
 *   no ha podido, y entonces **nadie la ha escrito**. Ver la decisión de
 *   {@link moverse}: sin esto, una instantánea de una huella acababa dentro de la
 *   parcela del expediente.
 * @param {HTMLElement} [opciones.botonDeshacer]  Por defecto, el nodo
 *   {@link SELECTOR_BOTON_DESHACER}; si falta, `nodo` LANZA. Ídem los seis
 *   siguientes con sus selectores.
 * @param {HTMLElement} [opciones.botonRehacer]
 * @param {HTMLInputElement} [opciones.casillaSnap]
 * @param {HTMLInputElement} [opciones.campoTolerancia]
 * @param {HTMLInputElement} [opciones.campoOffset]
 * @param {HTMLElement} [opciones.botonOffset]
 * @param {HTMLElement} [opciones.botonBorrar]
 * @param {HTMLElement} [opciones.botonInsertar]  El conmutador del modo insertar
 *   (2026-08-18), {@link SELECTOR_BOTON_INSERTAR}. Es el NOVENO nodo del contrato,
 *   y como los ocho anteriores: si falta, `nodo` LANZA. No se ha hecho opcional a
 *   propósito — un noveno que se pudiera omitir dejaría dos formas de montar la
 *   barra, y la que se queda vieja es siempre la nueva.
 * @param {HTMLElement} [opciones.renglon]
 * @param {import('../viewer/barra-edicion.js').BarraMontada|null} [opciones.barra=null]
 *   `visor.barraEdicion`. **Opcional a propósito**: lo único que se le pide es
 *   `borrarActivo(bool)`, o sea el NOMBRE y la PISTA del botón del modo borrar, que
 *   son adorno informativo. El estado que de verdad importa —el `aria-pressed` y el
 *   renglón— sale del nodo y del renglón, que se resuelven por selector como los
 *   demás. Sin barra el cableado funciona entero; con ella, además el botón dice
 *   «Salir del modo borrar» mientras está armado.
 * @param {Document} [opciones.documento]  Dónde se escuchan los atajos. Se
 *   escuchan en el DOCUMENTO y no en el panel porque el usuario tiene las manos
 *   en el mapa cuando quiere deshacer.
 * @returns {{
 *   refrescar: () => void,
 *   deshacer: () => boolean,
 *   rehacer: () => boolean,
 *   alCargarParcela: (parcelaNueva: object) => void,
 *   alCambiarDocumento: (parcelaNueva: object) => void,
 *   alCambiarOficial: (parcela: object) => void,
 *   alColindantes: (resultado: object) => void,
 *   mandoDeDibujo: (activo: boolean) => boolean,
 *   alternarDibujo: () => boolean,
 *   dibujando: () => boolean,
 *   destruir: () => void,
 * }}
 * @throws {TypeError}  Contrato del programador (ver arriba).
 */
export function cablearEdicion({
  estado,
  historial,
  edicion,
  panel,
  // ── F18 · «Dibujar recinto» en la rama PARCELA (2026-08-18) ───────────────
  // Los DOS o ninguno: sin mapa no hay dónde pinchar y sin `srs` no se sabe a qué
  // huso convertir los clics. Faltando cualquiera, el resto del cableado funciona
  // igual y lo único que no habrá es la herramienta — que es el caso real de un
  // montaje sin visor (los dobles de test de otros pasos).
  mapa = null,
  srs = null,
  alContarColindantes = () => {},
  alSoltarColindantes = () => {},
  aplicarDeEdificio = () => false,
  esDeEdificio = () => false,
  botonDeshacer = nodo(SELECTOR_BOTON_DESHACER),
  botonRehacer = nodo(SELECTOR_BOTON_REHACER),
  casillaSnap = nodo(SELECTOR_CAMPO_SNAP),
  campoTolerancia = nodo(SELECTOR_CAMPO_TOLERANCIA),
  campoOffset = nodo(SELECTOR_CAMPO_OFFSET),
  botonOffset = nodo(SELECTOR_BOTON_OFFSET),
  botonBorrar = nodo(SELECTOR_BOTON_BORRAR),
  botonInsertar = nodo(SELECTOR_BOTON_INSERTAR),
  renglon = nodo(SELECTOR_ESTADO_EDICION),
  barra = null,
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

  // ── F18 · EL DIBUJO DE LA PARCELA ─────────────────────────────────────────
  //
  // ⭐ **Lo que esto cierra.** Desde F12 se puede dibujar un recinto vértice a
  // vértice… pero solo en la rama EDIFICIO. En la de PARCELA, la única forma de
  // que entrara geometría era traerla (Catastro, GML, DXF, pegado): con un
  // levantamiento de PUNTOS SUELTOS —el fichero real del autor, 88 puntos y cero
  // polilíneas— la aplicación tenía las dianas puestas (paso 9) y ninguna
  // herramienta con la que unirlas. Es `viewer/dibujo.js` estrenando su segundo
  // llamante, y por eso ese módulo no se reescribe para esto.
  //
  // ── POR QUÉ AQUÍ Y NO EN UN MÓDULO NUEVO ──────────────────────────────────
  // Este cableado ya gobierna las otras cinco herramientas de la MISMA barra
  // —snap, tolerancia, offset, borrar, insertar— y ya tiene las cuatro piezas que
  // el dibujo necesita: el store, el historial, el panel y la edición. Un módulo
  // aparte tendría que recibirlas todas y, sobre todo, **habría un segundo dueño
  // de `barra.dibujoVisible` dentro de la misma rama**. Ya hay dos (uno por rama);
  // tres es donde estas cosas empiezan a parpadear.
  //
  // ── LA EDICIÓN SE APAGA MIENTRAS SE DIBUJA, Y NO ES OPCIONAL ──────────────
  // `viewer/dibujo.js` escucha `click` en el mapa; `viewer/edicion.js` TAMBIÉN
  // —selecciona lindero, y con un modo armado borra o inserta un vértice—. Sin
  // apagar la edición, el mismo clic que pone una esquina del recinto nuevo
  // seleccionaría un lindero de la parcela vieja, y con «Borrar vértices» armado
  // le borraría uno. `viewer/dibujo.js` lo dejó escrito al nacer («quien apaga eso
  // es `app/`») y hasta hoy no lo hacía nadie: en la rama EDIFICIO las dos conviven
  // porque allí el clic de la edición cae sobre OTRA geometría.
  //
  // ⚠️ Y `ajustar` sigue vivo con la edición apagada —`activa(false)` apaga los
  // GESTOS, no el enganche—, que es justo lo que hace falta: se dibuja enganchando
  // a los puntos importados.
  const husoDibujo = srs === null ? null : husoPorSrs(srs)

  /** @type {object|null} El dibujo vértice a vértice, o `null` si no hay mapa. */
  let dibujoActivo = null
  /** Si es ESTA rama la que puede dibujar ahora mismo. Lo empuja `app/main.js`. */
  let mandoDibujo = false
  /** Lo que valía `edicion.activa()` justo antes de empezar a dibujar. */
  let edicionAntesDelDibujo = true

  /**
   * Deja la barra diciendo la verdad sobre el dibujo.
   *
   * ⚠️ **Escribe SIEMPRE, tenga el mando o no**, igual que hace la rama EDIFICIO:
   * el que no lo tiene escribe `false`. Quien decide el ORDEN de las dos llamadas
   * es el único sitio que conoce los dos ejes (ver `aplicarEdicion`). Callarse
   * aquí dejaría el botón como lo hubiera dejado la otra rama.
   */
  function refrescarBarraDibujo() {
    if (barra === null) return
    barra.dibujoVisible?.(mandoDibujo && dibujoActivo !== null)
    barra.dibujoEnCurso?.(dibujoActivo?.dibujando() === true)
  }

  /**
   * El usuario ha cerrado un recinto dibujado sobre la parcela.
   *
   * ⛔ **REEMPLAZA el exterior, y con él los huecos.** Es la decisión del autor
   * (2026-08-18) y es la misma semántica que la rama EDIFICIO, donde el recinto
   * dibujado sustituye al de la parte activa. Lo que aquí se añade es **decirlo**:
   * un hueco que desaparece sin una palabra es trabajo perdido en silencio, y el
   * usuario no tiene por qué saber que `recintos[0]` arrastra a los demás.
   *
   * Pasa por el MISMO camino que las tres operaciones de `viewer/edicion.js`
   * —clon, `set`, un `commit` DESPUÉS— así que `Ctrl+Z` lo deshace como cualquier
   * otra edición. Ésa es la red que hace admisible reemplazar.
   *
   * @param {{vertices: Array<[number,number]>, tipo?: string}} recinto
   */
  function cerrarDibujo(recinto) {
    const actual = estado.get()
    if (actual === null || actual === undefined) {
      // No hay expediente donde escribir. No debería llegar —la barra vive en la
      // pantalla de Edición, a la que no se llega sin parcela—, pero tirar treinta
      // clics en silencio sería exactamente lo que este proyecto no hace.
      panel.avisar(MENSAJE_DIBUJO_SIN_PARCELA, { nivel: NIVEL.ERROR })
      refrescarBarraDibujo()
      return
    }
    const previos = Array.isArray(actual.recintos) ? actual.recintos : []
    const huecos = Math.max(0, previos.length - 1)
    const siguiente = structuredClone(actual)
    siguiente.recintos = [recinto]
    estado.set(siguiente)
    // UN commit por operación acabada y DESPUÉS del `set`, como `aplicarRecintos`.
    commit(historial, siguiente)
    if (huecos > 0) panel.avisar(mensajeHuecosPerdidos(huecos), { nivel: NIVEL.AVISO })
    refrescarBarraDibujo()
  }

  if (mapa !== null && husoDibujo !== null) {
    dibujoActivo = crearDibujo({
      mapa,
      zona: husoDibujo,
      // El MISMO enganche que el arrastre: el dibujo no reimplementa el snap. Y es
      // lo que hace que dibujar sobre un levantamiento importado sea exacto y no
      // aproximado — sus puntos son dianas desde el paso 9.
      ajustar: edicion.ajustar,
      // Su contrapartida: el indicador OSNAP se enciende también al PASAR el
      // puntero, y ninguna de las cinco formas de terminar un dibujo pasa por un
      // último `mousemove` que lo apagara. Sin esto se queda pintado.
      alSoltarEnganche: () => edicion.soltarEnganche(),
      alCerrar: cerrarDibujo,
      alAvisar: (m, o) => panel.avisar(m, o),
    })
    // ⛔ El canal que `viewer/dibujo.js` estrenó para esto. De las cinco formas de
    // terminar un dibujo solo UNA avisaba (cerrar bien); `Escape`, `Enter` corto,
    // el doble clic y `destruir()` paraban en silencio. Sin esta suscripción, un
    // `Escape` dejaría la edición apagada PARA SIEMPRE y el botón diciendo
    // «Cancelar dibujo» sobre un dibujo que ya no existe.
    dibujoActivo.alCambiar((dibujando) => {
      if (!dibujando) edicion.activa(edicionAntesDelDibujo)
      refrescarBarraDibujo()
    })
  }

  /**
   * Las nueve declaraciones del «oculto a la vista, presente para el lector de
   * pantalla» (2026-08-18). Es la receta estándar, y **no es `display:none` ni
   * `visibility:hidden`**: las dos sacan el nodo del árbol de accesibilidad, así que
   * con cualquiera de ellas el `role="status"` dejaría de anunciar y este renglón se
   * quedaría sin su única razón de seguir existiendo.
   *
   * Se escriben EN LÍNEA y no en `estilos/app.css` a propósito: esa hoja está en su
   * techo de presupuesto con **0 B de holgura** (`scripts/presupuesto-css.mjs`), y
   * meter aquí nueve declaraciones obligaría a un asiento para algo que no lo
   * necesita — este estado lo escribe JS en cada llamada, no hay ningún selector que
   * lo pueda expresar sin observar la clase desde la hoja.
   */
  const RENGLON_OCULTO = Object.freeze({
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: '0',
    border: '0',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  })

  /**
   * Escribe el renglón `role="status"`. Vacío + sin modificador es el estado «no
   * hay nada que contar»: el CSS lo colapsa (`.gml-accion-estado:empty`) y el
   * bloque no da un salto de layout.
   *
   * 🏷️ **SE LLAMABA `decir` HASTA EL 2026-08-20**, y se renombró porque en este
   * mismo fichero hay otro `decir` —el de {@link cablearGeneracionGml}— con una
   * FIRMA DISTINTA: aquél lleva un tercer parámetro `esExito` y su segundo
   * argumento es obligatorio. Dos funciones locales homónimas con contratos que
   * no encajan es una trampa para quien busque por nombre, y desde F24 el
   * renglón de la barra tiene además un hermano visible
   * (`CLASE_BARRA.SITUACION`) del que hay que distinguirlo al leer. El nombre
   * dice ahora lo único que hace esta: **anunciar por lector de pantalla**. El
   * de `cablearGeneracionGml` conserva `decir` —escribe el pie del expediente,
   * que sí se ve— y no se tocó.
   *
   * ⭐ **DESDE EL 2026-08-18 ESTE RENGLÓN SOLO SE VE CUANDO ES UN ERROR**, y ese es
   * el cambio que pidió el autor al ver un texto flotando encima de la barra del
   * mapa. El porqué, que no es de gusto:
   *
   *   · Por aquí pasan quince desenlaces de acciones que el usuario **acaba de hacer
   *     con las manos sobre el mapa** —insertar, borrar, deshacer, desplazar, cambiar
   *     la tolerancia—. Todas se ven en el propio mapa o en el propio control en el
   *     mismo instante, así que el texto las contaba por segunda vez, encima del
   *     mapa y a 400 px de donde estaba mirando el usuario.
   *   · Un ERROR no se ve en ninguna otra parte: es la operación que **no** se
   *     aplicó, o sea que no hay nada nuevo en el mapa que mirar. Esos siguen a la
   *     vista, en rojo, con su `--error`.
   *
   * ⛔ **Y sigue anunciándose entero por lector de pantalla, los quince incluidos.**
   * Ése es el motivo de que se oculte con {@link RENGLON_OCULTO} y no con
   * `display:none`: quien no ve el mapa no tiene ninguna otra vía de enterarse de
   * que el vértice se insertó. Vaciar el renglón habría sido dejar mudas quince
   * acciones para exactamente los usuarios que más lo necesitan.
   *
   * @param {string} texto
   * @param {boolean} [esError=false]
   */
  function anunciar(texto, esError = false) {
    renglon.textContent = texto
    renglon.classList.toggle(CLASE_ESTADO_ERROR, esError)
    for (const [propiedad, valor] of Object.entries(RENGLON_OCULTO)) {
      // Cadena vacía = «quita la declaración en línea» y devuelve el nodo a lo que
      // diga la hoja, que es lo que tiene que pasar con un error: se ve como se ha
      // visto siempre. Asignar el valor solo cuando toca dejaría el rastro puesto.
      renglon.style[propiedad] = esError ? '' : valor
    }
  }

  /**
   * El estado de los dos botones del historial, DERIVADO de la pila. Nunca se
   * les toca el `textContent` (llevan su `<kbd>` dentro).
   */
  /**
   * ¿Queda algún vértice que se pueda borrar?
   *
   * Se pregunta por ANILLO y no por la parcela entera, que es como lo decide
   * `edit/vertices.js`: con un exterior de 3 y un hueco de 5, del hueco sí se puede
   * quitar. Preguntar «¿tiene la parcela más de 3 vértices?» daría `true` en ese
   * caso Y en el de dos recintos de tres, donde no se puede tocar ninguno.
   *
   * @param {object|null} parcela
   * @returns {boolean}
   */
  function hayAlgoQueBorrar(parcela) {
    const recintos = Array.isArray(parcela?.recintos) ? parcela.recintos : []
    return recintos.some((r) => Array.isArray(r?.vertices) && r.vertices.length > MINIMO_VERTICES)
  }

  function refrescar() {
    botonDeshacer.disabled = !puedeDeshacer(historial)
    botonRehacer.disabled = !puedeRehacer(historial)

    // ── ⛔ «Borrar vértices» no se deja armar si no puede borrar NADA ─────────
    // Ver {@link MOTIVO_SIN_NADA_QUE_BORRAR}: el defecto que esto cierra es un
    // mando encendido que no podía actuar ni una vez, y que solo lo confesaba
    // después del gesto y en un panel plegado.
    const sePuedeBorrar = hayAlgoQueBorrar(estado.get())
    botonBorrar.disabled = !sePuedeBorrar
    // Y si estaba armado cuando la geometría bajó al mínimo —borrando vértices
    // hasta dejarla en tres, que es el camino normal para llegar aquí—, se
    // DESARMA: dejarlo rojo sobre un modo que ya no puede actuar es la misma
    // mentira, solo que alcanzada por el otro lado.
    if (!sePuedeBorrar && edicion.modoBorrar()) edicion.modoBorrar(false)
    if (barra !== null) barra.borrarMotivo?.(sePuedeBorrar ? '' : MOTIVO_SIN_NADA_QUE_BORRAR)
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
   * ⛔ **A CADA INSTANTÁNEA, SU STORE (auditoría 2026-08-16).** Este `moverse`
   * hacía `estado.set(instantanea)` a secas, y `estado` es el store de PARCELA.
   * Pero la pila es de las DOS ramas a propósito (ver la decisión en el montaje
   * de `cablearEdificio`: «`Ctrl+Z` es UNA tecla y el usuario no lleva la cuenta
   * de en qué rama la pulsa»), así que por ella pasan también las proyecciones de
   * la parte activa del edificio. Medido: editar dos veces el vértice de una
   * huella y pulsar `Ctrl+Z` dejaba `{recintos, idLocal, origen, parteDeEdificio}`
   * DENTRO del store de la parcela; y como en esa rama la ficha, el mando de GML
   * y el autoguardado son los del edificio, no se veía hasta volver a Parcela —
   * donde esa huella ya se validaba, se serializaba y se firmaba como si fuera la
   * finca. La variante con el botón a la vista era aún más fácil: editar la
   * parcela, ir a Edificio, mover un vértice, volver, y pulsar «Deshacer».
   *
   * La pila NO se parte —esa decisión estaba bien tomada—: lo que se arregla es
   * que aquí se MIRE de quién es lo que se acaba de sacar. La marca la pone
   * `edificio/parte-activa.js` en la propia proyección y dice literalmente que
   * esto «no debe acabar en `crearParcela` ni en un expediente»; nadie la leía.
   *
   * ⚠️ **Si la instantánea es de edificio y no se puede colocar** (no hay parte
   * elegida, o la elegida es otra), se DESHACE la navegación y se cuenta. Dejar
   * el índice movido habría descuadrado la pila respecto a lo que hay en
   * pantalla, que es la avería que vino a arreglar esto.
   *
   * @param {(h: object) => (object|null)} navegar  `undo` o `redo`.
   * @param {(h: object) => (object|null)} desnavegar  La inversa, para volver
   *   atrás si la instantánea no se puede aplicar.
   * @param {string} exito  Renglón cuando se ha navegado.
   * @param {string} vacio  Renglón cuando no había a dónde ir.
   * @returns {boolean}
   */
  function moverse(navegar, desnavegar, exito, vacio) {
    const instantanea = navegar(historial)
    // `null` = no hay a dónde ir. El botón ya estaba apagado, así que esto solo
    // se alcanza por el atajo de teclado: no se revienta y se dice por qué no ha
    // pasado nada.
    if (instantanea === null) {
      refrescar()
      anunciar(vacio)
      return false
    }

    if (esDeEdificio(instantanea) === true) {
      if (aplicarDeEdificio(instantanea) !== true) {
        // Se devuelve el índice a donde estaba: la operación NO se ha deshecho.
        desnavegar(historial)
        refrescar()
        anunciar(MENSAJE_OTRA_PARTE, true)
        return false
      }
      refrescar()
      anunciar(`${exito} ${COLA_ERA_DEL_EDIFICIO}`)
      return true
    }

    estado.set(instantanea)
    refrescar()
    anunciar(exito)
    return true
  }

  const deshacer = () => moverse(undo, redo, MENSAJE_DESHECHO, MENSAJE_NADA_QUE_DESHACER)
  const rehacer = () => moverse(redo, undo, MENSAJE_REHECHO, MENSAJE_NADA_QUE_REHACER)

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

    // ── ⛔ LAS DOS INHIBICIONES DE LA AUDITORÍA 2026-08-16 ──────────────────
    // Van DESPUÉS de reconocer la tecla y no antes, para no hablar por un
    // `Ctrl+S` o un `Ctrl+P` que no son nuestros; y NO llaman a
    // `preventDefault()`, igual que la rama del campo de texto y por lo mismo:
    // aquí el atajo no es nuestro, así que se devuelve al navegador entero.
    //
    // Las dos DICEN lo que pasa. Un atajo que no responde y no explica es un
    // atajo roto, y los dos casos son justo aquellos en los que el usuario no
    // tiene delante el botón gris que se lo contaría.
    if (hayDialogoModalAbierto(documento)) {
      anunciar(MENSAJE_ATAJO_CON_DIALOGO, true)
      // Y al panel además, porque el renglón está detrás del velo. Ver el bloque
      // de {@link MENSAJE_ATAJO_CON_DIALOGO}.
      panel.avisar(MENSAJE_ATAJO_CON_DIALOGO, { nivel: NIVEL.AVISO })
      return
    }
    if (arrastrandoVertice) {
      // Sin panel: aquí no hay velo, el renglón se lee y el estado dura lo que
      // dura el gesto. Ver {@link MENSAJE_ATAJO_ARRASTRANDO}.
      anunciar(MENSAJE_ATAJO_ARRASTRANDO, true)
      return
    }

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
    anunciar(
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
      anunciar(mensaje, true)
      revertirTolerancia()
      return false
    }
    edicion.tolerancia(cm / CENTIMETROS_POR_METRO)
    return true
  }

  const alCambiarTolerancia = () => {
    if (aplicarTolerancia()) {
      anunciar(`Tolerancia de ajuste: ${FORMATO_DECLARADO.format(toleranciaEnCm())} cm.`)
    }
  }

  // ── El modo borrar ────────────────────────────────────────────────────────

  /**
   * Pulsar «Borrar vértices» CONMUTA el modo. Se lee el estado vigente del visor
   * —no una copia local— y se le pide el contrario: así dos pulsaciones seguidas
   * dejan lo mismo que ninguna, y una pulsación después de un `Escape` vuelve a
   * encender en vez de intentar apagar lo que ya está apagado.
   *
   * No escribe en el renglón ni toca el `aria-pressed`: de las dos cosas se
   * encarga la suscripción a `alCambiarModoBorrar` (ver el arranque). Hacerlo aquí
   * además sería contarlo dos veces por el camino del botón y una sola por los
   * otros tres.
   */
  /**
   * ⛔ **Y antes de nada, cancela el dibujo en curso** (2026-08-19).
   *
   * Desde F18 · paso 10 el dibujo APAGA la edición mientras dura —si no, el mismo
   * clic pondría una esquina y además borraría un vértice—. La consecuencia que se
   * escapó: con un trazo a medias, este botón seguía armando el modo borrar, así
   * que el usuario se quedaba con la papelera ROJA y unos clics que no borraban
   * nada **y que tampoco avisaban de nada**, porque `alClicMapa` sale antes de
   * mirar el modo cuando la edición está apagada. Silencio absoluto, que es peor
   * que el rechazo con motivo.
   *
   * Los tres —dibujar, borrar e insertar— secuestran el clic sencillo, así que son
   * excluyentes por la misma razón por la que ya lo eran borrar e insertar entre
   * sí: armados a la vez, el clic no tendría UN significado.
   */
  const alPulsarBorrar = () => {
    dibujoActivo?.cancelar()
    edicion.modoBorrar(!edicion.modoBorrar())
  }

  /**
   * Pulsar «Insertar vértices» CONMUTA su modo. Gemelo exacto de
   * {@link alPulsarBorrar} y con las mismas dos reglas: se lee el estado vigente del
   * visor —no una copia local— y no se escribe aquí ni el renglón ni el
   * `aria-pressed`, que son de la suscripción.
   *
   * ⭐ Y aquí la segunda regla deja de ser higiene y pasa a ser necesaria: como los
   * dos modos son excluyentes, esta pulsación puede apagar el modo BORRAR. Pintar
   * desde aquí dejaría al botón de la papelera pulsado y mintiendo, porque este
   * `click` no es suyo. Empujando desde `alCambiarModoBorrar`, se apaga solo.
   */
  const alPulsarInsertar = () => {
    // Gemelo del de borrar, y por lo mismo: ver {@link alPulsarBorrar}.
    dibujoActivo?.cancelar()
    edicion.modoInsertar(!edicion.modoInsertar())
  }

  // ── El offset ─────────────────────────────────────────────────────────────

  const alPulsarOffset = () => {
    const metros = numeroTecleado(campoOffset.value)
    if (metros === null) {
      const mensaje =
        `Distancia de desplazamiento: «${campoOffset.value}» no es un número de metros. No se ha ` +
        `movido ningún lindero.`
      panel.avisar(mensaje, { nivel: NIVEL.AVISO })
      anunciar(mensaje, true)
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
    anunciar(
      aplicado
        ? `Lindero desplazado ${FORMATO_SUPERFICIE.format(metros)} m.`
        : MENSAJE_OFFSET_SIN_APLICAR,
      !aplicado,
    )
  }

  // ── Los ganchos del Catastro ──────────────────────────────────────────────
  //
  // ⛔ **ESTO ERA UN GANCHO QUE HACÍA CINCO COSAS, Y HUBO QUE PARTIRLO (2026-08-08).**
  // Desde que traer el Catastro tiene DOS puertas —«empezar desde el Catastro», que
  // sustituye el documento, y «traer el parcelario de fondo», que solo aporta la
  // geometría oficial—, las cinco responsabilidades ya no caen del mismo lado:
  //
  //   | Efecto                  | ¿Solo fondo? | Por qué |
  //   |-------------------------|--------------|---------|
  //   | reiniciar el historial  | **NO** | la geometría de trabajo no ha cambiado, y reiniciar es lo que te roba el «deshacer» |
  //   | «parcela nueva»         | **NO** | no hay parcela nueva: hay fondo nuevo, y necesita su propio mensaje |
  //   | soltar las colindantes  | SÍ | son las vecinas de OTRA parcela: dejarlas engancha el snap a geometría de otro sitio |
  //   | contador de vecinas     | SÍ | mismo motivo |
  //   | reencuadrar el historial| SÍ | ver {@link alCambiarOficial}: sin esto el primer Ctrl+Z borra el fondo |
  //
  // Se parten en dos con nombre propio, y {@link alCargarParcela} se queda como la
  // COMPOSICIÓN de los dos para los tres llamantes a los que sí les cambia el
  // documento entero (fichero, pegado, proyecto). Ninguno de ellos cambia.

  /**
   * Ha entrado un DOCUMENTO nuevo en el store.
   *
   * REINICIA el historial en vez de commitear encima, y esa es la decisión 2 de
   * F06: deshacer revierte ediciones de la geometría, nunca «la parcela que
   * traje». Un `Ctrl+Z` que devolviera la parcela anterior cambiaría la
   * referencia catastral que hay en pantalla —y con ella el GML que se
   * generaría— sin que nada lo anunciase; el usuario creería estar deshaciendo un
   * arrastre y estaría cambiando de expediente.
   *
   * @param {object} parcelaNueva  La que acaba de entrar en el store.
   * @returns {void}
   */
  function alCambiarDocumento(parcelaNueva) {
    reiniciar(historial, parcelaNueva)
    refrescar()
    anunciar(MENSAJE_PARCELA_NUEVA)
  }

  /**
   * Ha entrado un PARCELARIO OFICIAL nuevo, con o sin documento nuevo detrás.
   *
   * ── POR QUÉ SE REENCUADRA EL HISTORIAL ──
   * Con la puerta de contexto el `estado.set` mete un POJO nuevo con
   * `geometriaOficial` rellena y la pila **no se toca**, así que el primer Ctrl+Z
   * devolvería un *snapshot* anterior SIN oficial y el fondo desaparecería sin que
   * nada lo explicara. `reencuadrar` reescribe la oficial en TODA la historia
   * dejando `recintos` y el puntero de undo intactos: el fondo pasa a ser propiedad
   * del documento, no de un paso que el usuario haya dado. Es lo coherente con la
   * regla de oro 2 —la oficial no es algo que el usuario «hizo»— y es atómico, así
   * que si algo falla a mitad la pila se queda como estaba.
   *
   * ── Y POR QUÉ SE SUELTAN LAS COLINDANTES ──
   * Son las vecinas de la parcela ANTERIOR. Dejarlas puestas mantendría como dianas
   * de enganche unos linderos que ya no lindan con nada, y el snap engancharía a
   * geometría de otro sitio sin que nada lo explicara. **Esto sí vale para las dos
   * puertas**, y es la mitad que se perdería si el gancho se hubiera partido mal.
   *
   * Lo que NO cabe aquí es lo que vive fuera de la edición —el diagnóstico ya
   * calculado y los contornos de las vecinas dibujados en el mapa—: los invalida
   * quien tiene esas piezas, en el paso 7. Ver allí.
   *
   * @param {object} parcela  La que acaba de entrar en el store, con su oficial.
   * @returns {void}
   */
  function alCambiarOficial(parcela) {
    reencuadrar(historial, (instantanea) => ({
      ...instantanea,
      geometriaOficial: parcela.geometriaOficial,
    }))
    edicion.fijarColindantes([])
    alContarColindantes(null)
    // ⛔ Y EL REGISTRO, que es la TERCERA pieza y se quedó fuera hasta que la
    // auditoría del 2026-08-16 lo midió. Las dianas del enganche y el recuento de
    // la ficha se soltaban aquí desde F06; el registro de `app/colindantes.js`
    // —el que LEE `cablearDerivacion` para repartir el exceso entre los
    // vecinos— no lo soltaba nadie: su `olvidar()` no tenía un solo llamante en
    // toda la aplicación. Consecuencia medida: traídas las vecinas de A y cargada
    // B, «Rehacer el parcelario» repartía el exceso de B contra las fincas de A y,
    // como el registro seguía diciendo «ya se ha consultado», NO se emitía el
    // aviso de vecinas sin consultar: el exceso —que no toca nada de A— se
    // declaraba entero sobre VIAL, y eso abría la puerta de «Descargar
    // expediente». Es palabra por palabra el fallo que la cabecera de
    // `app/colindantes.js` declara inaceptable, alcanzado por el otro lado: no
    // por colapsar `null` a `[]`, sino por no volver nunca a `null`.
    alSoltarColindantes()
    refrescar()
  }

  /**
   * Los dos a la vez, en este orden. Es lo que necesita quien abre un documento
   * ENTERO —un fichero, un pegado, un proyecto—, que trae a la vez geometría de
   * trabajo y (a veces) parcelario.
   *
   * El orden importa: el documento SIEMBRA la pila y el parcelario la reencuadra
   * sobre lo sembrado. Al revés, el reencuadre se perdería en el `reiniciar`.
   *
   * @param {object} parcelaNueva
   * @returns {void}
   */
  function alCargarParcela(parcelaNueva) {
    alCambiarDocumento(parcelaNueva)
    alCambiarOficial(parcelaNueva)
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

    // ⛔ **AQUÍ HABÍA UN `anunciar()`, Y SE RETIRÓ EL 2026-08-18. No volver a ponerlo
    // sin leer esto.** Escribía en el renglón de la barra del mapa «2 parcelas
    // colindantes: el ajuste engancha también a sus linderos», y era **el mismo
    // hecho contado dos veces**: el desenlace de esta consulta ya lo escribe
    // `app/cableado-catastro.js#colindantes` en `[data-estado="traer-colindantes"]`,
    // que es el renglón `role="status"` PROPIO de «Traer colindantes» y que nació el
    // 2026-08-16 exactamente para esto (su constante lo dice con estrella).
    //
    // O sea que de los dieciséis mensajes que pasaban por `anunciar` en este cableado,
    // éste era el único que ya tenía casa en otro sitio — y encima el único que no
    // contaba una acción del usuario sobre el mapa, sino el resultado de una
    // consulta de red lanzada desde un botón del panel. Se queda donde se pulsa.
    //
    // Lo que NO se ha perdido: `fijarColindantes` de aquí arriba sigue dando las
    // dianas al snap, y `alContarColindantes` sigue dejando la cuenta en el modelo.
    // Lo único que se fue es la segunda copia del texto.
  }

  // ── Arranque ──────────────────────────────────────────────────────────────

  /**
   * La RED DE SEGURIDAD de {@link arrastrandoVertice}: se ha soltado el botón del
   * ratón, así que no hay arrastre que valga. Existe porque un gesto que nunca
   * recibe su `dragend` —el puntero sale de la ventana— no emitiría el render final
   * que baja la bandera, y el atajo se quedaría muerto EN SILENCIO. Se escucha en
   * el DOCUMENTO, que es donde Leaflet escucha el suyo.
   *
   * Los dos eventos y no uno: Leaflet usa punteros donde los hay y ratón donde no,
   * y bajar una bandera dos veces no cuesta nada.
   */
  const alSoltarElRaton = () => {
    arrastrandoVertice = false
  }

  botonDeshacer.addEventListener('click', deshacer)
  botonRehacer.addEventListener('click', rehacer)
  documento.addEventListener('keydown', alPulsarTecla)
  documento.addEventListener('mouseup', alSoltarElRaton)
  documento.addEventListener('pointerup', alSoltarElRaton)
  casillaSnap.addEventListener('change', alCambiarSnap)
  campoTolerancia.addEventListener('change', alCambiarTolerancia)
  botonOffset.addEventListener('click', alPulsarOffset)
  botonBorrar.addEventListener('click', alPulsarBorrar)
  botonInsertar.addEventListener('click', alPulsarInsertar)

  // El botón del offset sigue a la SELECCIÓN, que vive en `viewer/edicion.js` y
  // cambia con los clics del mapa: sin lado elegido no hay nada que desplazar.
  const bajaSeleccion = edicion.alCambiarSeleccion((ref) => {
    botonOffset.disabled = ref === null
    anunciar(ref === null ? MENSAJE_SIN_LADO : MENSAJE_CON_LADO)
    // ⭐ **El renglón de SITUACIÓN de la barra (T2, 2026-08-19).** Es OTRO canal
    // que el `anunciar` de arriba, y la diferencia es toda la tarea:
    //
    //   · `anunciar` escribe el `role="status"`, que **no se ve** —`RENGLON_OCULTO` lo
    //     recorta a 1 px salvo que sea un error— y cuenta el CAMBIO, en pasado, al
    //     lector de pantalla. Sigue igual que antes: no se le ha tocado una coma.
    //   · esto escribe un renglón **visible** sobre la barra, en presente, que dice
    //     en qué estado estás y se queda mientras dure. Va `aria-hidden` justo
    //     porque el de arriba ya lo anuncia: sin eso, se oiría dos veces.
    //
    // La barra es OPCIONAL —hay montajes sin visor— y por eso el doble `?.`, igual
    // que `barra?.borrarActivo?.()`. Sin barra no se pierde nada de lo de arriba.
    barra?.ladoSeleccionado?.(ref !== null)
  })
  botonOffset.disabled = edicion.ladoSeleccionado() === null
  // El estado inicial, por el mismo camino que el botón de al lado: sin esto la
  // barra nacería diciendo «sin lindero» aunque se monte sobre una selección viva.
  barra?.ladoSeleccionado?.(edicion.ladoSeleccionado() !== null)

  // ── El modo borrar: UN solo sentido de propagación ─────────────────────────
  // El botón PIDE (`alPulsarBorrar` → `edicion.modoBorrar(...)`) y la suscripción
  // PINTA lo que haya quedado. Nunca al revés, y por eso `alPulsarBorrar` no toca
  // el `aria-pressed`: `viewer/edicion.js` apaga el modo por tres caminos que este
  // cableado no ve (`Escape`, salir de Edición, `destruir`), así que si el botón se
  // pintara a sí mismo al pulsarse habría dos verdades del mismo booleano y la de
  // la pantalla se quedaría vieja en cuanto se usara cualquiera de esos tres. Con
  // el lazo cerrado por la suscripción, los cuatro caminos acaban en la misma línea.
  const bajaModoBorrar = edicion.alCambiarModoBorrar((activo) => {
    botonBorrar.setAttribute('aria-pressed', activo ? 'true' : 'false')
    // La barra es opcional: sin ella el `aria-pressed` de arriba ya deja el botón
    // correcto, y lo que se pierde es solo el cambio de nombre y de pista. Se pasa
    // por parámetro —y no se busca por selector— porque `borrarActivo` es un método
    // del control de Leaflet, no un nodo.
    barra?.borrarActivo?.(activo)
    anunciar(activo ? MENSAJE_BORRAR_ARMADO : MENSAJE_BORRAR_APAGADO)
  })

  // ── El modo insertar: lo mismo, y con un camino más ────────────────────────
  // Idéntico al de arriba, y el argumento del sentido único se refuerza: a los tres
  // caminos que este cableado no ve (`Escape`, salir de Edición, `destruir`) se suma
  // un CUARTO que además es de la propia barra — **armar el modo borrar apaga éste**,
  // y al revés, porque los dos se llevan el clic sencillo y no puede haber dos. O
  // sea que pulsar un botón cambia el `aria-pressed` del OTRO. Pintar al pulsar
  // dejaría siempre a uno de los dos mintiendo; con las dos suscripciones puestas,
  // los dos botones se enteran de todo pase lo que pase.
  const bajaModoInsertar = edicion.alCambiarModoInsertar((activo) => {
    botonInsertar.setAttribute('aria-pressed', activo ? 'true' : 'false')
    barra?.insertarActivo?.(activo)
    anunciar(activo ? MENSAJE_INSERTAR_ARMADO : MENSAJE_INSERTAR_APAGADO)
  })

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
    alCambiarDocumento,
    alCambiarOficial,
    alColindantes,

    /**
     * Dice si es ESTA rama la que puede dibujar ahora mismo. Gemelo de
     * `cablearEdificio#edicion(bool)`, y lo empuja el mismo sitio: `aplicarEdicion`,
     * el único que conoce a la vez el paso y la rama.
     *
     * Perder el mando **cancela el trazo en curso**. Un dibujo a medias que
     * sobreviviera a un cambio de pantalla volvería a la vida sobre otra geometría,
     * que es el accidente que el modo borrar ya tiene prohibido por escrito.
     *
     * @param {boolean} activo
     * @returns {boolean}  Lo que ha quedado.
     */
    mandoDeDibujo(activo) {
      mandoDibujo = activo === true
      if (!mandoDibujo) dibujoActivo?.cancelar()
      refrescarBarraDibujo()
      return mandoDibujo
    },

    /**
     * Empieza a dibujar el recinto de la parcela, o cancela el que iba. Es lo que
     * hace el botón «Dibujar recinto» cuando el mando es de esta rama.
     *
     * @returns {boolean}  Si ha quedado dibujando.
     */
    alternarDibujo() {
      if (dibujoActivo === null || !mandoDibujo) return false
      if (dibujoActivo.dibujando()) {
        dibujoActivo.cancelar()
      } else {
        // ⛔ La otra mitad de la exclusión (ver `alPulsarBorrar`): empezar a dibujar
        // DESARMA los dos modos. Sin esto, el modo borrar sobreviviría al dibujo y
        // volvería a estar vivo —con su botón rojo— en cuanto el trazo terminara,
        // sobre una geometría que el propio dibujo acaba de reemplazar.
        edicion.modoBorrar(false)
        edicion.modoInsertar(false)
        // Y el orden importa: se apaga la edición ANTES de enganchar los oyentes
        // del dibujo, o el primer clic llegaría a las dos.
        edicionAntesDelDibujo = edicion.activa() !== false
        edicion.activa(false)
        dibujoActivo.empezar()
      }
      refrescarBarraDibujo()
      return dibujoActivo.dibujando()
    },

    /** ¿Se está dibujando sobre la parcela? Para el guion de humo y para el test. */
    dibujando: () => dibujoActivo?.dibujando() === true,

    /**
     * Retira los NUEVE oyentes —los siete de siempre más los dos del `mouseup`/
     * `pointerup` que cierran un arrastre huérfano (ver {@link arrastrandoVertice})—,
     * las dos bajas del visor (selección y modo borrar) y la del store. IDEMPOTENTE.
     * No toca el historial ni el estado: los dos son del llamante.
     */
    destruir() {
      botonDeshacer.removeEventListener('click', deshacer)
      botonRehacer.removeEventListener('click', rehacer)
      documento.removeEventListener('keydown', alPulsarTecla)
      documento.removeEventListener('mouseup', alSoltarElRaton)
      documento.removeEventListener('pointerup', alSoltarElRaton)
      casillaSnap.removeEventListener('change', alCambiarSnap)
      campoTolerancia.removeEventListener('change', alCambiarTolerancia)
      botonOffset.removeEventListener('click', alPulsarOffset)
      botonBorrar.removeEventListener('click', alPulsarBorrar)
      botonInsertar.removeEventListener('click', alPulsarInsertar)
      bajaSeleccion()
      bajaModoBorrar()
      bajaModoInsertar()
      bajaDelStore()
      // `destruir` del dibujo PARA el trazo, y al parar emite su último `false`:
      // la barra se limpia sola y la edición se repone. Por eso no hace falta
      // esconder el botón a mano aquí.
      dibujoActivo?.destruir()
      dibujoActivo = null
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
  // ── F18 · las dos piezas de «Dibujar recinto» en esta rama ────────────────
  // El MISMO `L.Map` que usa la rama EDIFICIO para lo suyo: las dos comparten la
  // cartografía y nunca dibujan a la vez (lo garantiza `aplicarEdicion`).
  mapa: visor.mapa,
  // El mismo SRS del expediente que reciben el visor y las dos ramas. De él sale
  // el huso al que se convierten los clics, por `geo/huso.js#husoPorSrs` — que es
  // el único sitio del proyecto que sabe qué husos están implementados.
  srs: SRS_DEMO,
  // Para que «Borrar vértices» diga «Salir del modo borrar» mientras está armado.
  // Puede ser `null` (visor montado con `edicion:{barra:false}`) y el cableado lo
  // admite: ver el JSDoc de `opciones.barra`.
  barra: visor.barraEdicion,
  // La ficha tiene un solo dueño (el paso 4); el cableado de la edición le pasa
  // el recuento en vez de escribir en el `<dd>`.
  alContarColindantes: fijarRecuentoColindantes,
  // El registro se monta en el paso 12, así que se lee PEREZOSAMENTE igual que
  // los dos de abajo. Ver el porqué en `alCambiarOficial`.
  alSoltarColindantes: () => registroColindantes?.olvidar(),
  // ── A cada instantánea, su store (auditoría 2026-08-16) ───────────────────
  // Los dos se leen PEREZOSAMENTE: `edificioCableado` se monta en el paso 13 y
  // esto es el 6, así que aquí todavía vale `null` — y tiene que seguir
  // valiendo, porque la edición no depende de que la otra rama llegue a montarse.
  // Con `null` la respuesta es «no es de edificio» y «no hay quien lo aplique»,
  // que es exactamente la verdad en una pantalla sin rama de edificio.
  esDeEdificio: (i) => edificioCableado?.esInstantaneaDeEdificio(i) === true,
  aplicarDeEdificio: (i) => edificioCableado?.aplicarDelHistorial(i) === true,
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
 * El cliente del servicio de EDIFICIO (F11), o `null` si no se llegó a construir.
 * Vive fuera del `try` por lo mismo que los tres de arriba, y lo consume el paso 13.
 *
 * ⚠️ **Comparte el `transporte` con {@link clienteCatastro}, y eso no es estilo**:
 * la cola de concurrencia 2, los reintentos y el ritmo son de la APLICACIÓN frente
 * al servidor del Catastro, no de cada cliente — es literalmente lo que exige el
 * override O8. `crearClienteEdificio` lo comprueba y lanza si le dan otro.
 *
 * `null` no es una excepción que tapar: la rama EDIFICIO se monta igual y lo DICE
 * (`MENSAJE_SIN_CLIENTE` de `./cableado-edificio.js`). Las cuatro vías por fichero
 * —DXF, listado, GML de edificio y proyecto— no tocan la red.
 *
 * @type {ReturnType<typeof crearClienteEdificio>|null}
 */
let clienteEdificio = null

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
    bd: abrirBd({
      alAvisar: panel.avisar,
      // S1 (2026-08-15) · El gancho que F10 dejó preparado en `storage/bd.js` y
      // que NADIE cableaba. Sin él, cuando ESTA pestaña es la vieja, la nueva
      // recibe `blocked`, degrada a trabajar sin caché y avisa — pero se queda
      // sin almacén hasta que esta suelte la conexión. La decisión de cerrar se
      // toma aquí y no en `storage/bd.js`, como su cabecera pedía: esta es la
      // capa que tiene el panel delante para contarlo. Cerrar es irreversible
      // para esta conexión (toda lectura y escritura posteriores fallan con
      // `InvalidStateError`, que la caché degrada a «no estaba» avisando), y por
      // eso el aviso dice qué queda parado y qué lo recupera: recargar.
      // ⚠️ `abrirBd` MEMOIZA sus opciones en la PRIMERA llamada, así que este
      // cableado tiene que vivir aquí, en el arranque — las llamadas posteriores
      // (pie de firma, expedientes) reutilizan esta conexión y este gancho.
      alVersionChange: ({ cerrar }) => {
        cerrar()
        panel.avisar(
          'Otra pestaña de esta aplicación necesitaba actualizar el almacén local, así que ' +
            'esta pestaña ha cerrado su conexión para dejarla continuar. Puedes seguir ' +
            'trabajando y generar el GML con normalidad, pero la caché del Catastro y el ' +
            'guardado de expedientes quedan parados en esta pestaña hasta que la recargues.',
          { nivel: NIVEL.AVISO },
        )
      },
    }),
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

  // ── F11 · el segundo cliente, con EL MISMO transporte y LA MISMA caché ─────
  // El `wfsBU` es otro endpoint del mismo servidor, así que compartir transporte no
  // es una comodidad: es lo que hace que las dos ramas sumen a la MISMA cola y al
  // mismo ritmo (override O8). Compartir la caché tampoco es casual — sus claves
  // llevan el prefijo `parcela:<srs>:<refcat>:bu:<consulta>`, reusando el almacén
  // que ya existe en vez de estrenar uno que obligaría a migrar la base.
  //
  // Va DESPUÉS del cliente de parcela y antes de `cablearCatastro` por el mismo
  // criterio de arriba: cada línea deja construido lo que ya se puede construir, y
  // lo que reviente después no se lleva por delante lo anterior.
  clienteEdificio = crearClienteEdificio({
    transporte,
    cache,
    // Explícito, como el de parcela y por lo mismo: el sistema de referencia es del
    // EXPEDIENTE (el que se pinta en la ficha), no del servicio.
    srs: SRS_DEMO,
    // Solo para los fallos de la CACHÉ, que es lo único suyo que no cabe en ningún
    // resultado. Los resultados los devuelve y los publica el cableado.
    alAvisar: panel.avisar,
  })

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
    // ── LOS DOS GANCHOS, UNO POR PUERTA (2026-08-08) ──────────────────────
    // Éste es el ÚNICO llamante que recibe los dos por separado, y es el motivo
    // por el que hubo que partirlos: es el único que tiene dos puertas.
    //
    // · «Empezar desde el Catastro» dispara los dos: documento nuevo.
    // · «Traer el parcelario de fondo» dispara solo el segundo: la geometría de
    //   trabajo es la del usuario y se queda donde está.
    //
    // Deshacer revierte ediciones de la geometría, nunca «la parcela que traje»
    // (decisión 2 de F06). Ver {@link cablearEdicion}#alCambiarDocumento.
    //
    // ⛔ **VA ENVUELTO DESDE LA AUDITORÍA DEL 2026-08-16.** Era el gancho a pelo, y
    // ésta era una de las dos puertas que NO borraban la referencia deducida. El
    // defecto quedaba enmascarado —la parcela del Catastro siempre trae `refcat` y
    // la ficha la prefiere—, pero la conjetura se quedaba colgada y reaparecía
    // sobre el siguiente documento que entrara sin referencia. Ver
    // {@link entraDocumentoNuevo}.
    // ⭐ **Y ATERRIZA EN EDICIÓN DESDE EL 2026-08-16.** Hasta hoy «Traer del
    // Catastro» dejaba al usuario **en Entrada**, mirando las tres vías con la
    // parcela ya cargada por debajo: exactamente el defecto que T9 del rework
    // corrigió para «Contrastar» y F18 para la medición propia, y el único de los
    // tres caminos de entrada que seguía sin arreglar. Cargar geometría y no moverse
    // hace que la vía parezca no haber hecho nada.
    //
    // ⛔ **A EDICIÓN, Y NO A `aterrizarTrasContrastar`**, que es lo que usan los
    // otros dos. Aquel intenta Diagnóstico primero, y aquí el diagnóstico valdría
    // CERO POR CONSTRUCCIÓN: lo que se acaba de traer es a la vez `recintos` y
    // `geometriaOficial` (ver {@link componerParcelaConOficial} con `sustituir`), o
    // sea la parcela contrastada consigo misma. Es el mismo argumento con el que F22
    // dejó fuera de Diagnóstico el DXF de «Consulta Masiva» —«que nadie lea ese cero
    // como una verificación»—, y aquí se cumple SIEMPRE, no en un caso raro.
    // Edición es además donde el usuario va a hacer lo que vino a hacer: mover el
    // recinto oficial sobre la cartografía.
    //
    // ⚠️ Los HECHOS primero, como en `aterrizarTrasContrastar` y por lo mismo: el
    // guardián del peldaño decidiría con los hechos de antes del `set` y mandaría al
    // usuario de vuelta a Entrada por «no hay geometría».
    //
    // ⛔ Va en `alCargarParcela` y **no en `alCambiarOficial`**, que es el gancho de
    // al lado y se dispara por las DOS puertas: por la puerta 2 —«Traer el parcelario
    // de fondo», que se pulsa DESDE Edición— navegar sería moverle el suelo a quien
    // ya está donde tiene que estar.
    alCargarParcela: (parcela) => {
      edicionCableada.alCambiarDocumento(parcela)
      entraDocumentoNuevo()
      refrescarHechos()
      navegacion.navegarAPaso(PASO.EDICION)
    },
    alCambiarOficial: (parcela) => {
      edicionCableada.alCambiarOficial(parcela)
      // ── Y AQUÍ SE INVALIDA LO QUE LA EDICIÓN NO TIENE EN LA MANO ────────
      // Las dos piezas que quedan hablan del fondo ANTERIOR, y las dos fallarían
      // en silencio: siguen en pantalla, con aspecto de dato bueno.
      //
      //   · El DIAGNÓSTICO ya calculado. `cablearDiagnostico` lo olvida solo
      //     cuando entra otra parcela, y lo detecta por IDENTIDAD
      //     (`claveDeExpediente`: refcat o idLocal). Con la puerta de contexto la
      //     identidad puede no moverse —una medición que ya traía referencia—, así
      //     que hay que decírselo: si no, el botón del informe se queda encendido
      //     y el PDF que baje mide contra un parcelario que ya no está.
      //   · Los CONTORNOS de las vecinas dibujados en el mapa. `viewer/index.js`
      //     los suelta en el mismo cambio de identidad, y por lo mismo aquí no se
      //     entera. Un contorno gris junto a un fondo nuevo sigue diciendo «esto
      //     linda con lo tuyo» sobre una parcela que ya no es la de al lado.
      //
      // Se comprueba la FORMA antes de llamar, misma doctrina que el resto de este
      // paso: un cableado que no publique el canal no puede tumbar la carga, que ha
      // ido bien.
      if (typeof diagnosticoCableado?.olvidarPorFondoNuevo === 'function') {
        diagnosticoCableado.olvidarPorFondoNuevo()
      }
      if (visor.colindantes !== null) visor.colindantes.limpiar()
    },
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
  // sin el puente, «Traer del Catastro» y la deducción por clic siguen siendo
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
  // Los DOS botones que cablea `cableado-catastro.js`, y el segundo **está en otra
  // pantalla**: «Traer colindantes» (F06) se mudó al pie de Edición el 2026-08-16 y
  // lo sigue cableando este módulo, así que si su cableado revienta se quedaría
  // encendido y mudo — el botón que promete algo que nadie puede cumplir, que es
  // exactamente lo que este bucle existe para impedir (regla de oro 1). Que no se
  // vea desde aquí no lo salva: el usuario llega a Edición en dos clics.
  //
  // ⛔ Eran TRES hasta esa fecha; el que falta es «Deducir del mapa», retirado.
  for (const selector of [SELECTOR_BOTON_CARGAR, SELECTOR_BOTON_COLINDANTES]) {
    const boton = document.querySelector(selector)
    if (boton !== null) boton.disabled = true
  }
  // Y los DOS renglones, por lo mismo: el motivo de un botón apagado se lee donde
  // está el botón. Sin esta segunda línea, «Traer colindantes» quedaba gris en
  // Edición con el porqué escrito dos pantallas atrás.
  for (const selector of [SELECTOR_ESTADO_CATASTRO, SELECTOR_ESTADO_COLINDANTES]) {
    const renglonCatastro = document.querySelector(selector)
    if (renglonCatastro !== null) renglonCatastro.textContent = MENSAJE_SIN_CATASTRO
  }
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
 * El cableado de la rama EDIFICIO del paso 13, o `null` mientras no exista.
 * **Referencia ADELANTADA por el mismo motivo que las dos de arriba**, y aquí la
 * leen DOS destinos que el paso 9 le entrega a la zona de fichero: el `.dxf`/`.txt`
 * (por extensión) y el GML de edificio (por contenido). Las dos cosas ocurren mucho
 * después del arranque, así que el destino se resuelve TARDE en vez de congelarse en
 * el montaje.
 *
 * `null` en el momento de soltar un fichero solo puede significar que el paso 13
 * reventó, y entonces **se dice**: una zona que anuncia aceptar `.dxf` y que al
 * soltarlo no hace nada es el error silencioso de manual. Es literalmente el mismo
 * razonamiento que F10 escribió para el `.json`.
 *
 * @type {ReturnType<typeof cablearEdificio>|null}
 */
let edificioCableado = null

/**
 * F14 · El contraste de la construcción, o `null` mientras el paso 13b no haya
 * corrido. **Referencia adelantada, y esta sí es necesaria y no un accidente de
 * orden**: `hechosDeEdificio` lo lee para saber si se ha llegado a contrastar, y
 * los hechos iniciales del rail se derivan al crear la navegación, que ocurre
 * después del 13b pero cuya FUNCIÓN se escribe antes.
 *
 * `null` significa exactamente lo mismo que un contraste a `null`: no se ha
 * contrastado. No bloquea ningún peldaño —el informe de construcción se sostiene
 * sin contraste, ficha §17—, así que una cáscara a la que el 13b se le cayera
 * seguiría navegando entera y diciendo la verdad.
 *
 * @type {ReturnType<typeof cablearContrasteEdificio>|null}
 */
let contrasteEdificioCableado = null

/**
 * El conmutador de rama del paso 13, o `null` mientras no exista. Tercera referencia
 * adelantada del fichero, y la lee el desvío `alGmlDeEdificio` que el paso 9 le
 * entrega a la zona de fichero: encaminar un GML de construcción implica **conmutar
 * la rama**, y eso no lo puede hacer `cablearComprobacion` porque no sabe que existen.
 *
 * ⚠️ No se usa para preguntar «¿qué rama hay?» en el resto del fichero: para eso
 * está {@link ramaEnPantalla}, que existe desde el paso 4 y no desde el 13.
 *
 * @type {ReturnType<typeof cablearRama>|null}
 */
let ramaCableada = null

/**
 * El cableado de la MEDICIÓN PROPIA del paso 17, o `null` mientras no exista.
 * Cuarta referencia adelantada del fichero, y la lee el mismo destino que resuelve
 * `edificioCableado`: el `.dxf`/`.txt` que el paso 9 le entrega a la zona.
 *
 * ⭐ **Con esto, esa entrada pasa de tener UN destino y un rechazo a tener DOS**, y
 * la elige {@link ramaEnPantalla}. Ver el `entradasExtra` del paso 9.
 *
 * @type {ReturnType<typeof cablearMedicion>|null}
 */
let medicionCableada = null

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
  //
  // ⚠️ **Desde T9 esta exclusión tiene además un dueño de arriba** (`app/contraste.js`,
  // paso 15): qué cajón puede estar abierto se DERIVA del paso. Ésta se queda porque
  // cubre el instante exacto del `drop`, que ocurre antes de que nadie navegue — dos
  // redes contra el mismo fallo, y la de aquí es la de dentro.
  cajonDiagnostico: visor.diagnostico.cajon,
  // ── El GML de VARIAS parcelas para el recorrido, y hay que estar en Entrada ─
  //
  // ⛔ **Aquí estaba el `alComprobar` de T9, que encendía el modo COMPROBACIÓN**, y
  // se fue con el modo el 2026-08-07 (ver la cabecera de `app/navegacion.js`). Lo
  // que se queda es la otra mitad de aquel gancho, que sigue haciendo falta y que
  // **lo destapó una prueba**: el cajón de comprobación pertenece a la tercera vía
  // de Entrada (`app/contraste.js#cajonDe`), así que soltar un fichero estando en
  // Diagnóstico dejaría el rail diciendo «Diagnóstico» y al dueño de la esquina
  // cerrando el cajón que acaba de hacer una pregunta. Además es lo que el gesto
  // significa: traer un fichero nuevo es empezar otro expediente.
  //
  // ⚠️ **Ahora solo se llama cuando hay algo que preguntar** —un fichero con más de
  // un `featureMember`—. Un GML normal ya no abre ningún cajón: entra y se dibuja.
  //
  // ⚠️ `navegacion` se declara en el paso 14 y esto es el 9. No es un problema: la
  // flecha se CREA aquí y se LLAMA cuando el usuario suelta un fichero, que es
  // siempre después de que el módulo entero se haya evaluado.
  alPedirEleccion: () => {
    navegacion.navegarAPaso(PASO.ENTRADA)
  },
  // ── F06 · abrir un documento nuevo ────────────────────────────────────────
  // El MISMO gancho que recibe el Catastro en el paso 7, y por la MISMA razón:
  // cargar la parcela de un fichero es abrir un documento nuevo, así que el
  // historial se REINICIA en vez de commitear encima. Un `Ctrl+Z` que devolviera la
  // parcela anterior —cambiando la geometría que hay en pantalla y la que se
  // generaría— sería un error silencioso disfrazado de función (decisión 2 de F06).
  //
  // ⚠️ **Y desde T9 aquí ATERRIZA la ruta crítica 2.** Contrastar mete la parcela en
  // el store y hasta ahora dejaba al usuario donde estaba —en Entrada, mirando las
  // tres vías, con la geometría de otro ya cargada por debajo y sin una sola línea
  // que dijera de dónde había salido—. Ver {@link aterrizarTrasContrastar}.
  alCargarParcela: (parcela) => {
    edicionCableada.alCargarParcela(parcela)
    // La parcela que entra por esta puerta trae su referencia AFIRMADA, así que
    // una deducción vieja sobra: la ficha ya prefiere la del modelo, y dejarla
    // colgada reaparecería en cuanto se cargara algo sin referencia.
    entraDocumentoNuevo()
    // ⭐ 2026-08-16 · El fichero era de parcela y el usuario está en la otra rama:
    // se DICE. El porqué entero —y por qué NO se conmuta— en
    // {@link MENSAJE_GML_ES_DE_PARCELA}. Va antes de aterrizar para que el aviso
    // esté puesto cuando la pantalla cambie de paso, no después.
    if (ramaEnPantalla === RAMA.EDIFICIO) {
      panel.avisar(MENSAJE_GML_ES_DE_PARCELA, { nivel: NIVEL.AVISO })
    }
    aterrizarTrasContrastar()
  },
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
    // ── El `.dxf` y el `.txt`: DOS destinos, y los elige la rama ──────────────
    // F10 dejó la asimetría escrita: la aplicación exporta un DXF que no sabe
    // reabrir, y `parsers/dxf.js` llevaba desde F01 sin un solo llamante en
    // producción. F11 le dio la mitad —entra como partes de un edificio— y
    // **F18 cierra la otra**: entra como medición de la parcela.
    //
    // ⚠️ **El destino depende de la RAMA ACTIVA, y por eso se resuelve dentro** y
    // no capturando una referencia: con la rama PARCELA un DXF es una medición de
    // la parcela, y con la EDIFICIO son las huellas de la construcción. Es el mismo
    // fichero y son dos documentos distintos, así que decidirlo en el montaje —donde
    // ni siquiera existe todavía el conmutador— sería congelar la respuesta a una
    // pregunta que el usuario contesta después.
    //
    // ⭐ **Hasta F18 esta entrada tenía un destino y un rechazo**, y el rechazo caía
    // justo en la vía que la pantalla de Entrada anuncia con su propio botón. Ahora
    // son dos destinos simétricos y no hace falta avisar de nada: el fichero va
    // donde el usuario está mirando.
    {
      extensiones: EXTENSIONES_DIBUJO,
      alFichero: (fichero) => {
        const enEdificio = ramaEnPantalla === RAMA.EDIFICIO
        const destino = enEdificio ? edificioCableado : medicionCableada
        if (destino === null) {
          // Un paso que no ha montado. Se dice CUÁL, porque el motivo es distinto y
          // la salida también: si falta la rama de edificio, la de parcela sigue
          // sirviendo, y al revés.
          panel.avisar(
            enEdificio ? MENSAJE_SIN_EDIFICIO_CABLEADO : MENSAJE_SIN_MEDICION_CABLEADA,
            { nivel: NIVEL.ERROR },
          )
          return
        }
        // La promesa se suelta a propósito, igual que arriba: los dos `alFichero`
        // no lanzan y cuentan por el panel todo lo que deciden.
        destino.alFichero(fichero)
      },
    },
  ],
  // ── F11 · el GML de EDIFICIO, por CONTENIDO y no por extensión ─────────────
  // Un `.gml` es un `.gml` hasta que se lee. `comprobacion/gml.js` reconoce el
  // dialecto BU desde F08 y hasta hoy se paraba ahí con honradez, porque no había
  // sitio al que llevarlo: era el criterio 4 de F08, declarado «a medias». Ya hay
  // sitio, así que el fichero se encamina y **la rama se conmuta**, que es la parte
  // que `cablearComprobacion` no puede hacer porque no sabe que existen las ramas.
  //
  // Resolución TARDE, por lo mismo que las dos entradas de arriba.
  alGmlDeEdificio: (fichero) => {
    if (edificioCableado === null || ramaCableada === null) {
      panel.avisar(MENSAJE_SIN_EDIFICIO_CABLEADO, { nivel: NIVEL.ERROR })
      return
    }
    // Primero la rama y después el fichero, y el orden importa: `alFichero` escribe
    // en el segundo store y pinta las huellas en el mapa, y hacerlo con el panel de
    // parcela todavía delante dejaría al usuario mirando cómo cambia un documento
    // que no está viendo.
    ramaCableada.set(RAMA.EDIFICIO)
    panel.avisar(MENSAJE_GML_ES_DE_EDIFICIO, { nivel: NIVEL.AVISO })
    edificioCableado.alFichero(fichero)
  },
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
  // ── ⭐ F13 · quién manda sobre el botón ────────────────────────────────────
  // Hasta F13 este cableado era el ÚNICO dueño de «Generar GML», y cuando la rama
  // era EDIFICIO `app/rama.js` lo apagaba entero. Desde que la rama de edificio
  // también sabe generar, el botón tiene DOS pretendientes suscritos a DOS stores
  // distintos, y el de parcela seguiría escribiéndole el renglón cada vez que
  // cambiara la parcela —aunque el usuario esté mirando un edificio—.
  //
  // `mando()` es la condición, y se escribe UNA vez en `app/main.js`: es el mismo
  // reparto que F12 hizo con las dos ediciones sobre el mismo mapa, y por el mismo
  // motivo (dos módulos escribiendo el mismo nodo acaban dependiendo del orden en
  // que lleguen sus avisos). Por defecto `true`, para que quien cablee esto solo
  // —los tests de F04— no tenga que saber nada de ramas.
  mando = () => true,
} = {}) {
  /**
   * Escribe el renglón `role="status"`. Vacío + sin modificador es el estado
   * «todo en orden»: el CSS lo colapsa y el pie no da un salto de layout.
   *
   * `esExito` es opcional y por defecto `false`, así que las cinco llamadas que
   * solo distinguen error de reposo siguen limpiando el verde sin decir nada:
   * los dos modificadores son mutuamente excluyentes y quien escribe el renglón
   * no debería tener que acordarse de apagar el otro.
   *
   * @param {string} texto
   * @param {boolean} esError
   * @param {boolean} [esExito]  La acción se completó. Ver {@link CLASE_ESTADO_EXITO}.
   */
  function decir(texto, esError, esExito = false) {
    renglon.textContent = texto
    renglon.classList.toggle(CLASE_ESTADO_ERROR, esError)
    renglon.classList.toggle(CLASE_ESTADO_EXITO, esExito)
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
    // ⭐ F13 · si esta rama no tiene el mando, no se toca el botón NI el renglón:
    // el otro dueño está diciendo algo suyo ahí y pisárselo dejaría al usuario
    // leyendo el motivo de una parcela mientras trabaja con un edificio.
    if (!mando()) return
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
    // ⭐ NO HAY PARCELA ≠ LA PARCELA ESTÁ MAL (2026-08-18). El botón se apaga
    // igual y el renglón sigue diciendo por qué —regla de oro 1—, pero sin la
    // caja roja y sin hablar de un contorno que le falta a algo que no existe.
    // El porqué entero, en {@link MENSAJE_SIN_PARCELA_TODAVIA}.
    // La MISMA expresión que usa `validar` justo arriba, a propósito: si las dos
    // divergen, una diría «no hay parcela» y la otra validaría algo.
    if (((parcelaActual && parcelaActual.recintos) || []).length === 0) {
      boton.disabled = true
      // ⭐ Y SON DOS SITUACIONES, no una (2026-08-19). Sin recintos puede no haber
      // NADA, o haber un levantamiento de puntos esperando a que se dibuje su
      // linde. La segunda tiene parcela, tiene 55 puntos en el mapa y tiene una
      // acción concreta que hacer, así que decirle «todavía no hay parcela» sería
      // el mismo defecto que el mensaje de al lado vino a corregir.
      decir(
        hayPuntos(parcelaActual) ? MENSAJE_SIN_CONTORNO_TODAVIA : MENSAJE_SIN_PARCELA_TODAVIA,
        false,
      )
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
    // Segunda mitad de la guarda de `mando()`: sin ella, un clic que llegase con
    // la otra rama puesta descargaría el GML de la parcela mientras el usuario
    // mira un edificio — el fallo silencioso que `app/rama.js` interceptaba con su
    // guarda de captura antes de que este botón tuviera dos dueños.
    if (!mando()) return null
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
    // El tercer argumento es el estreno del verde (2026-08-10): es el único
    // desenlace de todo este cableado en el que la acción que el usuario pidió se
    // completó de verdad, y hasta hoy se decía en el mismo gris que «no hay
    // parcela». No califica el GML —eso sería la regla de oro 9—: dice que el
    // fichero bajó.
    decir(
      entrega.descargado ? `Descargado «${entrega.nombre}».` : entrega.mensaje,
      !entrega.descargado,
      entrega.descargado,
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

    /**
     * ⭐ **EL RENGLÓN DE ACUSE, ABIERTO A UN SEGUNDO LLAMANTE (2026-08-11).**
     *
     * `[data-estado="generar-gml"]` es el acuse de la ZONA DE ENTREGA de la barra, y
     * hasta hoy esa zona tenía un solo botón. Con el desplegable de salidas puesto
     * tiene cuatro, y los otros tres los gobierna `app/cableado-expediente.js`.
     *
     * ⛔ **Se expone el método en vez de dejar que aquel módulo escriba el nodo.**
     * El renglón y sus dos modificadores mutuamente excluyentes
     * (`--error`/`--exito`) son de este cableado desde F04; dos módulos escribiendo
     * las mismas clases sobre el mismo nodo acaban dejando el rojo encendido bajo un
     * mensaje verde. Un dueño, dos llamantes.
     *
     * @param {string} texto
     * @param {boolean} esError
     * @param {boolean} [esExito]
     */
    acusar: decir,

    // ⭐ F13 · lo publica para que el reparto del mando pueda REPINTAR al cambiar
    // de rama. Sin esto, conmutar dejaría el botón como lo hubiera dejado el otro
    // dueño hasta que su store cambiara: un botón encendido sin motivo, o apagado
    // con el motivo de la otra rama.
    refrescar: () => refrescar(estado.get()),
    destruir() {
      boton.removeEventListener('click', generar)
      desuscribir()
    },
  }
}

/**
 * ⭐ **F13 · quién manda sobre «Generar GML», escrito UNA vez.**
 *
 * Desde esta fase el botón tiene DOS dueños —el de parcela y el de construcción—,
 * cada uno suscrito a su store y los dos vivos a la vez. Si cada uno escribiera
 * cuando su store cambia, el usuario acabaría leyendo el motivo de una parcela
 * mientras mira un edificio, y el ganador dependería del orden en que llegaran los
 * avisos. Es exactamente la situación de las dos ediciones sobre el mismo mapa
 * (F12 · T4.2) y se resuelve igual: la condición se escribe aquí, en el único
 * sitio que conoce los dos ejes, y baja a los dos cableados como función.
 *
 * `ramaEnPantalla` y no `ramaCableada.get()`: existe desde el paso 4 y vale
 * `PARCELA` desde el primer instante, así que sirve también antes de que el
 * conmutador esté montado (paso 13).
 */
const mandoDeParcela = () => ramaEnPantalla !== RAMA.EDIFICIO
/** La otra mitad. Se escribe como negación de la de arriba para que no puedan
 *  ser las dos ciertas —ni las dos falsas— el día que alguien toque una. */
const mandoDeEdificio = () => !mandoDeParcela()

// Sin nodos explícitos: los localiza `cablearGeneracionGml` con los selectores
// del contrato, y LANZA nombrándolos si `index.html` ha dejado de traerlos.
const gmlDeParcela = cablearGeneracionGml({
  estado,
  panel,
  srs: SRS_DEMO,
  mando: mandoDeParcela,
})

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
/**
 * El pie de firma recordado. `abrirBd` MEMOIZA su conexión, así que esta llamada
 * reutiliza la que abrió la caché del Catastro en el paso 7 en vez de abrir una
 * segunda; y va sin `await` por lo mismo que allí: preparar un informe no puede
 * quedarse esperando a IndexedDB, y sin base el almacén se comporta como si no
 * hubiera nada recordado (y lo dice por el panel).
 *
 * ⭐ **F14 lo saca a una constante propia porque ahora lo comparten DOS informes**,
 * el de parcela y el de construcción. Y compartirlo es el requisito, no un ahorro:
 * el pie de firma es de la PERSONA que firma, no del documento, y dos almacenes
 * sobre la misma base harían que marcar «Recordar» en un informe no se notara en
 * el otro — el usuario tendría que teclear sus datos dos veces sin entender por
 * qué. Ver `app/cableado-informe-edificio.js`, que solo LEE de aquí.
 */
const pieFirmaGuardado = crearPieDeFirmaGuardado({
  bd: abrirBd({ alAvisar: panel.avisar }),
  alAvisar: panel.avisar,
})

const informeCableado = cablearInforme({
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
  pieFirma: pieFirmaGuardado,
  // El MISMO envoltorio que el paso 8, y por la misma razón escrita allí: la
  // comprobación cambia con el tiempo —entra al soltar un GML y se va al
  // descartarlo—, así que se resuelve tarde. Aquí, además, `comprobacionCableada`
  // YA está asignado (el paso 9 corrió antes), pero el envoltorio se conserva
  // porque lo que hace falta no es esquivar el orden: es no congelar el valor.
  comprobacion: () =>
    comprobacionCableada === null ? null : comprobacionCableada.comprobacion(),
})

// ── 13 · La segunda rama: EDIFICIO (F11 · T4.1) ──────────────────────────────
//
// Aquí la aplicación deja de tener un solo tema. Once fases hablando de parcelas y
// este paso monta el conmutador, el panel de edificio que SUSTITUYE al de parcela y
// el cableado que cose sus cinco vías de entrada con el segundo store y con el mapa.
//
// ⛔ **VA ANTES DEL PASO 12 aunque lleve número mayor** (ver la cabecera): el
// expediente **se suscribe** al conmutador, así que la rama tiene que existir cuando
// él se monta. El expediente sigue siendo el último en ejecutarse; F11 se cuela
// delante.
//
// SIN `try` propio, igual que los pasos 6, 8, 9, 11 y 12: lo único que puede lanzar
// aquí es un contrato del programador —una cáscara sin `.gml-chips`, un `<body>` sin
// `gml-app`, un CTA del pie que `index.html` ya no trae, un `srs` que no es un huso
// implementado—, y eso tiene que ser ruidoso en desarrollo en vez de degradarse en
// silencio en producción. Lo que sí está previsto —que el bloque del Catastro se
// cayera y no haya clientes— entra como `null` y la rama se monta igual, diciendo
// que no hay servicio: las cuatro vías por fichero no tocan la red.

// El conmutador PRIMERO, y no por gusto: `cablearEdificio` le pregunta con qué rama
// nace la pantalla para dejar sus dos secciones con el `hidden` correcto. Al revés
// también funciona —las secciones de EDIFICIO se descubren por `data-rama-panel` en
// cada conmutación, no al cablear—, pero entonces el panel de edificio se quedaría
// visible encima del de parcela hasta la primera pulsación.
ramaCableada = cablearRama({
  documento: document,
  panel,
  // ⛔ Se le pasa el VISOR entero y él pregunta por `visor.barraEdicion`, jamás por
  // `visor.edicion`: son dos preguntas distintas y la segunda no implica la primera
  // (con `edicion: {barra: false}` la edición se monta y la barra no). Está medido.
  visor,
})

// La ficha del pie es el TERCER suscriptor del conmutador —después del propio DOM y
// del expediente—, y el único que no cambia de panel: cambia de PREGUNTA. Cinco de
// sus ocho renglones hablan de la parcela y con el edificio delante estarían
// afirmando cosas del otro documento. Ver {@link aplicarRamaALaFicha}.
ramaCableada.subscribe(aplicarRamaALaFicha)

// El panel de la rama, **creado aquí y montado por el cableado**. Es el mismo reparto
// que el `cliente` de `cablearCatastro` y por lo mismo: crearlo dentro decidiría por
// el llamante el documento y el canal de avisos de una vista. Quien lo monta es
// `cablearEdificio`, que además le sella las dos `<section>` con `data-rama-panel`
// —sin esa marca el conmutador no las gobierna y la rama no se enseñaría nunca—.
const panelEdificio = crearPanelEdificio({ documento: document, alAvisar: panel.avisar })

edificioCableado = cablearEdificio({
  // El SEGUNDO store (paso 2). Su estado ES el POJO `Edificio` o `null`, simétrico a
  // como el de parcela es el POJO Parcela.
  estado: estadoEdificio,
  panel,
  panelEdificio,
  // El mismo SRS del expediente que reciben el visor, los dos clientes, F08 y F09.
  srs: SRS_DEMO,
  // `null` cuando el bloque del paso 7 se cayó, y `null` ahí es una respuesta
  // prevista: la rama se monta igual y dice que no hay servicio.
  cliente: clienteEdificio,
  // ⚠️ El de PARCELA, y **solo** para deducir la referencia catastral desde la
  // huella. No se le pasa el cableado del paso 7 por lo mismo que en el paso 9:
  // `cargar()` haría un `estado.set` en el store de la OTRA rama.
  clienteParcela: clienteCatastro,
  // El `L.Map` del visor, para pintar las huellas en su pane propio (422) y para
  // encuadrar sobre ellas. Es el MISMO mapa: las dos ramas comparten la cartografía.
  mapa: visor.mapa,
  // Solo se LEE, y solo para que la parcela que hubiera en pantalla viaje como
  // `edificio.parcelaContexto` — que es literalmente lo que `model/edificio.js`
  // previó— y **nunca** como rama `parcela` de un expediente (desviación 9 de F11).
  estadoParcela: estado,
  // Para saber con qué rama nace la pantalla, y nada más.
  //
  // ⚠️ **Hoy es REDUNDANTE, y se pasa igual.** Medido por mutación: quitarlo no
  // cambia ni una prueba, porque `cablearEdificio` se cae a leer el `data-rama` del
  // documento y `cablearRama` —que corre tres líneas más arriba— ya lo ha escrito.
  // Es decir: la redundancia la produce el ORDEN que se eligió aquí, no el
  // parámetro. El día que alguien monte el panel de edificio antes que el
  // conmutador, esta línea es lo único que evita que las dos secciones nuevas se
  // queden visibles encima del panel de parcela hasta la primera pulsación.
  rama: ramaCableada,
  // ── F12 · T4.2 · lo que la edición de la parte activa necesita ─────────────
  // El MISMO historial que la rama de parcela, y a propósito: `Ctrl+Z` es UNA
  // tecla y el usuario no lleva la cuenta de en qué rama la pulsa. Con dos pilas
  // separadas, deshacer en Edificio dejaría intacta la última cosa que se ve
  // haber hecho —o desharía algo de la otra rama— y las dos lecturas son peores
  // que una sola pila que fotografía el POJO que toque.
  historial,
  // La barra sobre el mapa, SOLO para encender la palabra «Dibujar recinto». Se
  // le pasa `visor.barraEdicion` y no `visor.edicion`: son dos preguntas
  // distintas y la segunda no implica la primera (medido por T1.5 de F11).
  barraEdicion: visor.barraEdicion,
})

// ── 13b · El CONTRASTE de la construcción y su informe (F14) ─────────────────
//
// Los gemelos de los pasos 8 y 11 en la rama EDIFICIO, y van AQUÍ —después del 13
// y no dentro de él— por una razón dura: su sección anfitriona **la fabrica
// `app/panel-edificio.js`**, así que hasta que `cablearEdificio` ha montado el
// panel, `SELECTOR_ANFITRION_CONTRASTE_EDIFICIO` no existe en el documento y
// `nodo()` lanzaría. Con el de parcela no pasa: aquél viene en `index.html`.
//
// ⚠️ Y van antes de `crearNavegacion` porque `hechosDeEdificio` lee
// `contrasteEdificioCableado`: los hechos iniciales del rail se derivan en el
// arranque, y con la variable todavía en `null` el peldaño Informe nacería
// diciendo que no se ha contrastado aunque hubiera un contraste hecho. Hoy no lo
// hay nunca en el arranque —el contraste se hace pulsando—, pero la dependencia es
// real y el orden la respeta en vez de apoyarse en que hoy dé igual.

/**
 * El cajón del contraste de construcción. Se monta SIEMPRE, aunque la pantalla
 * nazca en la rama de parcela: nace cerrado y `display:none`, así que no cuesta ni
 * un píxel, y montarlo tarde obligaría a montar y desmontar controles de Leaflet
 * en cada conmutación de rama — con sus oyentes del `document` yendo y viniendo,
 * que es de donde salen las fugas.
 */
const cajonContrasteEdificio = crearCajonContrasteEdificio({
  mapa: visor.mapa,
  alAvisar: panel.avisar,
})
// Su sitio en el panel, exactamente como el de parcela y por lo mismo. `nodo()`
// lanza nombrando el selector si el panel no lo ha traído, que es lo correcto: es
// un contrato entre dos módulos de esta misma capa.
cajonContrasteEdificio.anfitrion(nodo(SELECTOR_ANFITRION_CONTRASTE_EDIFICIO))

contrasteEdificioCableado = cablearContrasteEdificio({
  cajon: cajonContrasteEdificio,
  estadoEdificio,
  panel,
  // Solo se LEE, y solo para medir cuánto de la construcción cae DENTRO de la
  // parcela: es la pregunta propia de esta rama, y la que en la de parcela no
  // existe. Nunca se escribe en él.
  estadoParcela: estado,
  // El cliente de EDIFICIOS del paso 7. `null` si aquel bloque se cayó, y `null`
  // ahí es una respuesta prevista: el contraste se monta igual y dice que no hay
  // servicio con el que consultar.
  cliente: clienteEdificio,
  // El CABLEADO de parcelas, y solo para las vecinas de la invasión. Se comprueba
  // la FORMA en vez de pasarlo a ciegas, por el mismo criterio que el `catastro:`
  // del paso 11.
  catastro:
    catastroCableado !== null && typeof catastroCableado.colindantes === 'function'
      ? catastroCableado
      : null,
  srs: SRS_DEMO,
  // ⭐ **La MISMA capa de contraste que la rama de parcela**, sin una línea nueva.
  // `viewer/contraste.js` recibe recintos y le da igual de qué son: sombrea la
  // diferencia simétrica con un `fillRule:'evenodd'`. Las dos ramas no la usan a la
  // vez —la rama es única y `app/contraste.js` cierra el cajón que no toca—, así
  // que compartirla no las pisa.
  contrasteMapa: visor.diagnostico.contraste,
})

const informeEdificioCableado = cablearInformeEdificio({
  cajon: cajonContrasteEdificio,
  estadoEdificio,
  panel,
  // SIN invocar: el contraste cambia con cada edición de las partes, y un valor
  // congelado en el montaje sería siempre `null`. Igual que F09 con el diagnóstico.
  contraste: contrasteEdificioCableado.ultimoContraste,
  // Y aparte, los CONTORNOS: el objeto del contraste trae cifras, no geometría, y
  // el plano tiene que dibujar las dos huellas. Ver el JSDoc de esa función.
  huellaOficial: contrasteEdificioCableado.huellaOficial,
  srs: SRS_DEMO,
  // El MISMO almacén que el informe de parcela: la firma es de quien firma, no del
  // documento. Ver {@link pieFirmaGuardado}.
  pieFirma: pieFirmaGuardado,
})

// El rail depende de que haya contraste (o de que no lo haya) para decir la verdad
// del peldaño «Informe», así que se le avisa por el canal en vez de con un
// temporizador — que es el apaño que T9 borró en la otra rama.
contrasteEdificioCableado.alContraste(() => refrescarHechos())

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
  // ⭐ 2026-08-11 · el acuse de las tres exportaciones, que desde hoy se piden desde
  // el desplegable de la barra y ya no desde dentro del `<dialog>`. Sin este cable,
  // su desenlace se escribiría en el renglón del diálogo —que está cerrado— y
  // «no hay nada que exportar» no lo leería nadie: fallo silencioso de manual.
  // Se pasa el método del dueño del nodo, no el nodo. Ver `acusar` en
  // `cablearGeneracionGml` y `acusar` en `cablearExpediente`.
  acuse: (t, e, x) => gmlDeParcela.acusar(t, e, x),
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
  // ── F11 · las dos piezas que impiden guardar el documento equivocado ───────
  // Sin ellas `expedienteActual()` devolvería SIEMPRE `{srs, parcela}`, y con la
  // rama EDIFICIO puesta eso tenía dos desenlaces y los dos eran malos: guardar la
  // parcela mientras en pantalla hay un edificio (documento equivocado, **en
  // silencio**), o pasarle las dos ramas a `crearExpediente`, que LANZA dentro de un
  // `click` porque el modelo impone la exclusividad desde F00.
  //
  // ⚠️ Y de aquí sale la razón por la que el paso 13 corre ANTES que éste: este
  // cableado **se suscribe** al conmutador —para poder ofrecer que se guarde lo que
  // cambió antes de salir de la rama—, así que no vale pasárselo después.
  rama: ramaCableada,
  estadoEdificio,
  // El MISMO gancho que reciben el Catastro (paso 7) y la comprobación (paso 9).
  //
  // ⛔ **Y ENVUELTO COMO ELLOS DESDE LA AUDITORÍA DEL 2026-08-16.** Ésta era la otra
  // puerta que no borraba la referencia deducida, y aquí el defecto NO estaba
  // enmascarado: un proyecto guardado cuya parcela no trae referencia dejaba en la
  // ficha la que se dedujo del dibujo anterior, sobre una geometría que no es la
  // suya. Ver {@link entraDocumentoNuevo}.
  alCargarParcela: (parcela) => {
    edicionCableada.alCargarParcela(parcela)
    entraDocumentoNuevo()
  },
  // Se comprueba la FORMA en vez de pasarlo a ciegas, mismo criterio que el `catastro:`
  // del paso 11: sin este canal, «Abrir un proyecto…» lo DICE en lugar de ser un botón
  // que no hace nada, y el arrastre sobre la ventana sigue funcionando igual.
  elegirFichero:
    comprobacionCableada !== null && typeof comprobacionCableada.elegirFichero === 'function'
      ? () => comprobacionCableada.elegirFichero()
      : null,
})


// ── 14 · EL RAIL DE NAVEGACIÓN (rework de UI · T5) ───────────────────────────
//
// El paso que le da a `app/navegacion.js` su PRIMER LLAMANTE. Aquel módulo se
// escribió en T1 sin ninguno, a propósito y por orden del plan: «la autoridad de
// navegación, sola y con pruebas propias, antes de tocar una línea de CSS».
//
// Va EL ÚLTIMO —después incluso del expediente— y no por antigüedad, sino porque
// es el único paso que necesita **todo lo demás ya montado**: lee los dos stores
// (2 y 13), el conmutador de rama (13), el diagnóstico (8) y el mapa (3).
//
// ⚠️ **NO decide nada.** Aquí solo se DERIVAN los hechos y se enchufan los cables.
// Qué paso está disponible y por qué no lo está lo dice `app/navegacion.js`, que
// no toca el DOM; quién lo pinta es `app/barra.js`, que no conoce ni una regla.
// Este bloque es la costura, y la costura no opina.

/**
 * Los hechos de la rama PARCELA, para las guardas del rail.
 *
 * ⚠️ **`geometria` y `puntos` NO se responden aquí**: `hayGeometria` y `hayPuntos`
 * vienen de `app/cableado-expediente.js`, que es quien ya decidía qué cuenta como
 * geometría a la hora de guardar. Escribir aquí una segunda versión de esa regla la
 * haría divergir el día que una de las dos cambiara, y el síntoma sería un rail que
 * ofrece un paso que el pie no deja completar.
 *
 * `oficial` sí se lee del modelo directamente, y es deliberado: la pregunta
 * equivalente de `app/cableado-diagnostico.js` (`oficialDe`) está declarada allí
 * como **regla interna de esa pantalla** y con el motivo escrito, así que se
 * respeta. Lo que se lee aquí es el CAMPO del POJO (`model/parcela.js`), no su
 * regla: hay contorno oficial cuando `geometriaOficial` trae al menos un recinto.
 *
 * ⛔ **AQUÍ SE DEVOLVÍA UN TERCER HECHO, `diagnostico`, Y SE RETIRA EL
 * 2026-08-08.** Decía «el último diagnóstico que se pintó en el cajón» y su único
 * consumidor era la compuerta del peldaño «Informe». Retirado el peldaño, este
 * booleano no lo leía nadie: se calculaba en cada refresco y se tiraba. Quien
 * quiera saber si hay diagnóstico sigue teniendo la puerta de siempre
 * (`diagnosticoCableado.ultimoDiagnostico()`), que es de donde salía este valor —
 * lo que desaparece es la COPIA que viajaba al rail. Ver
 * `app/navegacion.js#CLAVES_HECHOS`.
 *
 * @param {object|null} parcela
 * @returns {{geometria: boolean, oficial: boolean}}
 */
function hechosDeParcela(parcela) {
  return {
    geometria: hayGeometria(parcela),
    oficial: Array.isArray(parcela?.geometriaOficial) && parcela.geometriaOficial.length > 0,
    // ⭐ El tercero (2026-08-19). Abre Edición cuando no hay recinto todavía: es el
    // levantamiento de puntos sueltos, que se importa sin unir y se dibuja encima.
    puntos: hayPuntos(parcela),
  }
}

/**
 * Los hechos de la rama EDIFICIO.
 *
 * ⛔ **Hasta F14 esto devolvía `oficial: false, diagnostico: false` a pelo**, y su
 * comentario decía «solo el primero puede ser cierto en esta versión: el
 * diagnóstico y el informe son de parcela». Era verdad y F14 lo vuelve falso: los
 * dos peldaños existen ya en esta rama. Se calculan de verdad.
 *
 * ⚠️ Y significan **otra cosa** que en la rama de parcela, que es justo por lo que
 * `app/navegacion.js` tuvo que admitir un `requiere` por rama:
 *
 *   · `geometria`   — hay construcción con la que trabajar. Un edificio con CERO
 *                     partes SÍ cuenta: es el punto de partida de la obra nueva.
 *   · `oficial`     — hay huella publicada por el Catastro con la que contrastar.
 *                     **No abre ningún peldaño** —el contraste es opcional y su
 *                     caso estrella es que no la haya—: se calcula para que el rail
 *                     pueda decir la verdad de lo que hay, no para bloquear.
 *
 * ⛔ **Y AQUÍ TAMBIÉN SE VA `diagnostico` (2026-08-08).** Su propio comentario ya
 * decía, desde F14, que **no bloqueaba nada en esta rama**: ningún paso de
 * EDIFICIO lo exigía. Vivía porque en PARCELA sí abría «Informe», y `fundirHechos`
 * obliga a que las dos ramas hablen el mismo vocabulario. Retirado aquel peldaño,
 * se queda sin ninguna de las dos razones. `contrasteEdificioCableado
 * .ultimoContraste()` sigue estando para quien lo necesite; lo que se retira es la
 * copia que viajaba al rail para que nadie la mirase.
 *
 * @param {object|null} edificio
 * @returns {{geometria: boolean, oficial: boolean}}
 */
function hechosDeEdificio(edificio) {
  return {
    geometria: hayEdificio(edificio),
    oficial: hayHuellaOficial(edificio),
    // ⛔ `false` SIEMPRE, y escrito y no omitido: `fundirHechos` obliga a que las
    // dos ramas hablen el mismo vocabulario, y callarlo dejaría la clave a merced
    // del valor por defecto. Esta rama dibuja sobre la parte activa y no importa
    // nubes de puntos; el día que lo haga, esta línea es donde se entera.
    puntos: false,
  }
}

/**
 * ¿Hay huella publicada por el Catastro para esta construcción?
 *
 * ⚠️ **No es `edificio.construccionOficial !== null` y ya está.** Ese campo lleva
 * las PARTES que vinieron del Catastro cuando el edificio se trajo de allí, y puede
 * ser una lista vacía; lo que el contraste necesita es que haya al menos una con
 * contorno. Se pregunta por lo que se va a usar.
 *
 * @param {object|null} edificio
 */
function hayHuellaOficial(edificio) {
  const oficial = edificio?.construccionOficial
  return (
    Array.isArray(oficial) &&
    oficial.some((p) => Array.isArray(p?.recinto?.vertices) && p.recinto.vertices.length >= 3)
  )
}

/**
 * La AUTORIDAD DE NAVEGACIÓN de la aplicación. Una sola instancia, y nace con la
 * rama que el conmutador ya tiene puesta: `cablearRama` corrió en el paso 13 y
 * dejó escrito el `data-rama` del `<body>`, así que preguntarle es más barato y
 * más fiable que volver a decidirlo.
 *
 * El paso inicial es ENTRADA y se RECORTA solo si no se sostiene (contrato de
 * `crearNavegacion`); con la parcela de demostración cargada, sí se sostiene.
 */
const navegacion = crearNavegacion({
  rama: ramaCableada.get(),
  paso: PASO.ENTRADA,
  hechos: {
    [RAMA.PARCELA]: hechosDeParcela(estado.get()),
    [RAMA.EDIFICIO]: hechosDeEdificio(estadoEdificio.get()),
  },
  // El mismo canal que todo lo demás de esta cáscara: lo que el usuario tiene que
  // saber va al panel de avisos, no a la consola.
  avisar: panel.avisar,
})

/**
 * Vuelve a derivar los hechos de las DOS ramas y repinta el rail.
 *
 * ⚠️ **Se llama de más a propósito.** Derivar cuesta cuatro lecturas de POJO y una
 * llamada a un getter; equivocarse por defecto cuesta un rail que enseña un paso
 * apagado cuando ya se puede entrar, que es la clase de mentira que este rework
 * viene a quitar.
 *
 * ⛔ **Y ahora llamarlo de sobra de verdad no repinta de sobra** (auditoría
 * 2026-08-16, hallazgo B4). Esta misma línea afirmaba que `actualizarHechos` «solo
 * notifica si el paso activo deja de sostenerse», y era falso: publicaba SIEMPRE, y
 * `crearEstadoVista.set` notifica sin comparar. Medido: estas dos llamadas
 * producían **2 notificaciones completas aunque no cambiara ni un hecho** —y esta
 * función cuelga de los dos stores, o sea de cada vértice arrastrado— más el
 * `barra.repintar()` de abajo: 3 pintadas enteras del rail, con sus tres pasadas de
 * `contraste.aplicar`, `pantalla.aplicar` y `escribirRuta`. Arreglado en
 * `app/navegacion.js#actualizarHechos`, que compara los hechos antes de publicar.
 *
 * @returns {void}
 */
function refrescarHechos() {
  navegacion.actualizarHechos(hechosDeParcela(estado.get()), RAMA.PARCELA)
  navegacion.actualizarHechos(hechosDeEdificio(estadoEdificio.get()), RAMA.EDIFICIO)
  // El repintado va a mano y SE QUEDA: es la red barata de la doctrina de arriba
  // —repintar la barra son doce nodos— y lo único que garantiza que la zona del
  // rail no se quede rancia si algún día un hecho deja de derivarse de un store.
  barra.repintar()
}

const barra = cablearBarra({
  documento: document,
  navegacion,
  panel,
  /**
   * ⚠️ **`invalidateSize()` NO ES DECORATIVO, y es una de las cuatro decisiones
   * que la revisión de ingeniería dejó abiertas.** Leaflet cachea el tamaño del
   * contenedor y solo lo remide cuando se lo dicen. Mientras la barra no cambie de
   * alto, un cambio de paso no mueve el mapa; pero el día que una pantalla
   * reparta el hueco de otra forma —Diagnóstico trae el mapa al centro—, sin esta
   * línea el mapa se quedaría dibujando sobre un tamaño que ya no tiene: teselas
   * en el sitio equivocado, clics desplazados y **ningún error en consola**.
   *
   * ⚠️ Y desde que la barra es horizontal hay un caso NUEVO que sí ocurre: el
   * renglón de motivo aparece y desaparece con los hechos. Ocupa su alto siempre
   * —`app/barra.js` lo deja vacío en vez de ocultarlo, justo para que esto no
   * pase—, pero si alguien lo «optimiza» a `hidden`, el mapa cambiará de alto sin
   * que nadie llame aquí.
   *
   * Va aquí y no dentro de `app/barra.js` porque aquel módulo no sabe que existe
   * un mapa, y no tiene por qué saberlo.
   */
  alNavegar: () => {
    if (visor?.mapa) visor.mapa.invalidateSize()
  },

  /**
   * ⭐ **EL PRODUCTOR DEL EXPEDIENTE (topbar · rebanada 2).** Se inyecta como
   * FUNCIÓN y se lee en cada pintada: una foto guardada aquí se quedaría rancia en
   * el primer cambio del expediente, que es exactamente el fallo mudo que la
   * decisión A1 existe para impedir. Es el `estado()` que
   * `app/cableado-expediente.js` ya publicaba para el guion 12; la barra no
   * reconstruye nada.
   *
   * ⚠️ **Aquí hubo un segundo productor, `motivoDeEntrega`, y se fue con el
   * renglón el 2026-08-10.** Leía `[data-estado="generar-gml"]` del DOM para poder
   * repetir arriba el acuse de la entrega. Al retirar el renglón dejó de tener
   * lector, y el acuse se resolvió mudando el NODO en vez de copiando su texto:
   * ahora cuelga del `<footer>` en vez de `.gml-acciones[data-pantalla="edicion"]`,
   * así que se ve en los tres pasos igual que su botón (decisión A2) y sigue
   * habiendo **un solo escritor**, que son los cableados de GML.
   */
  expediente: () => expedienteCableado?.estado() ?? null,

  /**
   * Y el CANAL por el que se entera de que ese estado ha cambiado (auditoría
   * 2026-08-16).
   *
   * ⛔ El productor de arriba se lee «en CADA pintada» —y es cierto—, pero las
   * pintadas de la barra solo las disparan la navegación y `refrescarHechos`,
   * que cuelga de los dos stores. **Archivar, renombrar y borrar un expediente no
   * tocan ningún store ni la navegación**: cambian `identidades[rama]` dentro de
   * `cablearExpediente` y nada más. Medido: guardar con nombre y cerrar el
   * diálogo dejaba la barra diciendo «Sin guardar · Se autoguarda; archívalo para
   * conservarlo» hasta el siguiente cambio de store o de paso; y al borrar, al
   * revés, la barra seguía enseñando el nombre de un expediente que ya no existía.
   *
   * El canal avisa sin cargar nada: la verdad se sigue leyendo del productor, para
   * no crear una segunda definición de «qué expediente tengo». `cablearBarra`
   * repinta solo su zona, así que la decisión A1 del `repintar()` único sigue en
   * pie.
   */
  suscribirExpediente: (fn) => expedienteCableado.alCambiarIdentidad(fn),
})

// El eje PASO de la cáscara (T6): escribe `data-paso` en el `<body>` y pone el
// título de la pantalla. **No oculta nada por JavaScript**: quien esconde las
// secciones que no tocan son las tres reglas de `estilos/app.css`, y el porqué
// —dos ejes escribiendo `hidden` serían dos dueños de la misma propiedad— está
// en la cabecera de `app/pantalla.js`.
cablearPantalla({ documento: document, navegacion })

// ── 15 · LA PANTALLA DE CONTRASTE (rework de UI · T9) ────────────────────────
//
// Funde Comprobación y Diagnóstico en UNA pantalla con la procedencia declarada.
// Lo que cambia respecto a F07/F08 no es lo que se enseña: es **quién manda**.
//
//   · **La esquina del mapa la decide el PASO.** Hasta hoy los dos cajones de
//     `bottomleft` se excluían por un acuerdo entre ellos —`cablearComprobacion`
//     recibía el cajón del otro para cerrarlo—. Ahora se deriva de `{paso}` en
//     `app/contraste.js#cajonDe`, que es una función pura de cuatro líneas.
//   · **La procedencia se declara y no se pierde.** Sale de `parcela.origen` (el
//     modelo) y del modo (la navegación), y se escribe en el propio cajón. Antes
//     lo único que la decía era `[data-procedencia="parcela"]` de `index.html`, que
//     T6 dejó DENTRO de la pantalla Entrada: en cuanto se navegaba, desaparecía.
//   · **La puerta (D4)** conecta el CTA del cajón con `navegacion.abrirPuerta()`.
//
// Va aquí y no en `app/cableado-diagnostico.js` porque aquél es de F07 y no tiene
// por qué enterarse de que existe una autoridad de navegación; ni en la vista, que
// no sabe qué es un modo. Este módulo es el único sitio donde las tres cosas se
// conocen, que es la definición de costura.
// ── ⭐ EL DIAGNÓSTICO SE MUDA A LA COLUMNA IZQUIERDA (2026-08-05) ────────────
//
// Se le da al cajón el nodo del panel donde tiene que colgarse cuando ES la
// pantalla. A partir de aquí, `comoPantalla(true)` no solo le sube el tope de alto:
// lo saca de la esquina del mapa y lo mete en el panel, donde sustituye a la tabla
// de vértices (que dejó de declarar esa pantalla en `index.html`).
//
// ⚠️ VA ANTES DE `cablearContraste`, y no es orden libre: aquél aplica el paso
// actual en su última línea —para dejar la pantalla coherente cuando se aterriza
// desde un hash `#/parcela/diagnostico`—, así que si el anfitrión no estuviera
// puesto todavía, ese primer `comoPantalla(true)` dejaría el diagnóstico flotando
// sobre el mapa hasta la siguiente navegación. `anfitrion()` reubica por su cuenta,
// así que invertir el orden no rompería nada; simplemente se vería el salto.
//
// Un cambio de sitio no cambia el tamaño del MAPA (el panel mide lo mismo en las
// tres pantallas), así que no hace falta `invalidateSize` aquí: quien lo llama en
// cada navegación es `alNavegar`, más arriba.
visor.diagnostico.cajon.anfitrion(nodo(SELECTOR_ANFITRION_DIAGNOSTICO))

const contrasteCableado = cablearContraste({
  navegacion,
  estado,
  // ⚠️ El del CABLEADO, no el del cajón: `abrir()` comprueba que haya contorno
  // oficial, recalcula y pide las vecinas. Abrir el cajón a pelo enseñaría las
  // cifras del diagnóstico anterior.
  //
  // ⛔ **Y no se reabre lo que ya está abierto**, porque `abrir()` pide las
  // parcelas colindantes por RED. El CTA «Diagnosticar encaje» del pie ya abre el
  // cajón por su cuenta (paso 8) y le pasa SU evento —lo que impide que el guardián
  // de clic-fuera lo cierre en el mismo gesto—; cuando el rail llega detrás y
  // navega, el trabajo ya está hecho. Sin esta guarda, cada clic en el CTA costaría
  // dos consultas al Catastro y la segunda pisaría a la primera.
  abrirDiagnostico: () => {
    if (visor.diagnostico.cajon.abierto()) return
    diagnosticoCableado.abrir().catch((causa) => {
      console.error('[main] la apertura del diagnóstico desde el rail ha fallado:', causa)
    })
  },
  cerrarDiagnostico: () => visor.diagnostico.cajon.cerrar(),
  cerrarComprobacion: () => comprobacionCableada?.cerrar(),
  declararProcedencia: (texto) => visor.diagnostico.cajon.procedencia(texto),
  // ⛔ Aquí iban `mostrarPuerta` y `suscribirPuerta`, los dos cables de «Tomar esta
  // geometría y editarla». El botón y el modo que levantaba se retiraron el
  // 2026-08-07: ver la cabecera de `app/navegacion.js`.
  // ── Rework de UI · rebanada 4 ────────────────────────────────────────────
  // El cajón de diagnóstico deja de ser descartable cuando ES la pantalla. La
  // decisión de cuándo lo es la toma `app/contraste.js` (es quien conoce el
  // paso); esto es el cable, igual que el aplicador de la edición de más abajo.
  fijarDiagnosticoComoPantalla: (esPantalla) => visor.diagnostico.cajon.comoPantalla(esPantalla),
  suscribirSalida: (fn) => visor.diagnostico.cajon.alSalir(fn),

  // ── F14 · Los cuatro gemelos de la rama EDIFICIO ─────────────────────────
  // Mismo reparto, mismo orden y mismas trampas esquivadas que arriba. Y el
  // MISMO `abrir()` del CABLEADO y no el del cajón: aquél recalcula y pide las
  // vecinas, mientras que abrir el cajón a pelo enseñaría las cifras del
  // contraste anterior.
  //
  // ⛔ Sin guarda de «no reabrir lo que ya está abierto», al revés que en la
  // rama de parcela, y la asimetría tiene motivo: allí el CTA «Diagnosticar
  // encaje» del pie abre el cajón por su cuenta antes de que el rail navegue, y
  // sin guarda cada clic costaba dos consultas al Catastro. Aquí no hay CTA que
  // se adelante —el único camino a esta pantalla es el rail—, y `abrir()` es
  // idempotente en lo caro: `pedirVecinas` no pide nada si ya las tiene.
  abrirContrasteEdificio: () => {
    contrasteEdificioCableado?.abrir().catch((causa) => {
      console.error('[main] la apertura del contraste de edificio ha fallado:', causa)
    })
  },
  cerrarContrasteEdificio: () => contrasteEdificioCableado?.cerrar(),
  fijarContrasteEdificioComoPantalla: (esPantalla) =>
    cajonContrasteEdificio.comoPantalla(esPantalla),
  suscribirSalidaEdificio: (fn) => cajonContrasteEdificio.alSalir(fn),
})

/**
 * Dónde aterriza el usuario después de «Contrastar con el parcelario». **Es la
 * ruta crítica 2 del plan de pruebas**, y hasta T9 no se podía andar: contrastar
 * cargaba la parcela y dejaba al usuario en Entrada, mirando las tres vías.
 *
 * Se intenta Diagnóstico, que es a lo que se venía. Si no se sostiene —el caso
 * real y previsto: el Catastro no ha dado parcelario, así que no hay contorno
 * oficial contra el que contrastar (degradación declarada de F08)— se cae a
 * **Edición y se dice por qué**, en vez de dejar al usuario donde estaba
 * preguntándose si el botón ha hecho algo.
 *
 * ⭐ Esa caída era a «Validación» hasta el 2026-08-08; el destino no ha cambiado
 * de sitio, ha cambiado de nombre: Edición es la pantalla que se quedó la tabla
 * de vértices y los CTA que antes vivían allí.
 *
 * @returns {void}
 */
function aterrizarTrasContrastar() {
  // Los hechos PRIMERO: la parcela acaba de entrar y sin esto el guardián de
  // Diagnóstico decidiría contra los hechos de antes del `set`.
  refrescarHechos()
  const aDiagnostico = navegacion.navegarAPaso(PASO.DIAGNOSTICO)
  if (aDiagnostico.ok) return
  navegacion.navegarAPaso(PASO.EDICION)
  if (typeof aDiagnostico.motivo === 'string' && aDiagnostico.motivo !== '') {
    panel.avisar(aDiagnostico.motivo, { nivel: NIVEL.AVISO })
  }
}

/**
 * ⭐ **La deducción automática de la importación.** Un `.dxf`/`.txt` entra SIN
 * referencia catastral —el fichero de un topógrafo trae coordenadas, no
 * referencias— y hasta hoy la app se limitaba a decirlo y a mandar al usuario al
 * botón «Deducir del mapa». El problema es DÓNDE lo dejaba: aquel botón vivía en
 * **Entrada** y la importación aterriza en **Edición**
 * ({@link aterrizarTrasContrastar}), así que el usuario caía en una pantalla desde
 * la que la referencia no se podía sacar, mirando un «Sin referencia» sin remedio a
 * la vista.
 *
 * ⭐ **Y EL 2026-08-16 ESE BOTÓN SE RETIRÓ, CON ESTO COMO MEDIA RAZÓN.** Entre esta
 * deducción automática y el clic en el mapa —que no exige geometría cargada, al
 * revés que el botón— no le quedaba ningún caso propio que atender. Este paso, que
 * nació para tapar el hueco que dejaba, es hoy el camino principal.
 *
 * ── LO QUE ESTO NO CAMBIA, Y ES LO IMPORTANTE ──
 * **No escribe en el modelo.** `catastro.deducir()` rellena el CAMPO de Entrada y
 * su rótulo de procedencia, y nada más; aquí solo se añade el eco en la ficha
 * ({@link fijarRefcatDeducida}), con su coletilla. `parcela.refcat` sigue
 * significando «esto lo afirma el usuario» y solo lo escribe «Traer del Catastro».
 * Sin esa disciplina, un DXF importado acabaría generando un GML para la Sede
 * contra una referencia que nadie ha confirmado — el error silencioso de siempre.
 *
 * ── UNA IMPORTACIÓN, UNA PETICIÓN (override O8) ──
 * Se dispara **solo si el modelo no trae referencia**, que descarta de un tiro los
 * tres casos que ya la tienen: un `.gml` con la suya, un DXF de «Consulta Masiva»
 * y las fincas de F22, cuya referencia sale de los rótulos del propio dibujo. Y es
 * una sola consulta `RCCOOR` por fichero soltado, que es el mismo coste que tenía
 * el clic que el usuario iba a dar de todos modos.
 *
 * La promesa se suelta a propósito: todo lo que puede fallar dentro ya lo cuenta
 * F05 por su renglón y por el panel, y un fallo de red aquí **no puede** estropear
 * una importación que ha ido bien.
 *
 * ── ⛔ SUELTA SÍ; SIN GUARDA DE VIGENCIA, NO (auditoría 2026-08-16) ──────────
 * Hasta hoy nada comparaba la respuesta con el documento que hubiera en pantalla
 * al llegar. Escenario medido: se sueltan dos dibujos sin referencia seguidos y la
 * respuesta del PRIMERO escribe su `refcat` en la ficha del SEGUNDO — la misma
 * afirmación falsa que {@link refcatDeducida} declara impedir, alcanzada por el
 * otro lado (por el tiempo, no por la puerta). Se sigue el patrón que el proyecto
 * ya tiene resuelto en `app/cableado-catastro.js#operar`: se captura el
 * {@link selloDocumento} al empezar y, al resolverse, **la consulta superada no
 * escribe nada**. Del abortador se prescinde con motivo: `deducir()` no admite
 * señal, así que aquí sería decorado (y el cableado ya aborta lo suyo por dentro).
 *
 * Una deducción descartada NO se avisa: nunca llegó a pintarse, y lo que la ficha
 * dice del documento nuevo —«Sin referencia»— es verdad. Ver
 * {@link entraDocumentoNuevo}.
 *
 * @param {object|null} parcela  La que acaba de entrar en el store.
 * @returns {void}
 */
function deducirRefcatTrasImportar(parcela) {
  if (parcela && parcela.refcat) return
  // ⭐ **SIN CONTORNO NO SE PREGUNTA (2026-08-19), y lo destapó el navegador.**
  // La deducción busca un punto interior de la geometría y le pregunta al Catastro
  // qué parcela hay ahí; con un levantamiento de puntos importado sin unir no hay
  // polígono, así que `deducir()` contestaba con un AVISO —«no hay ninguna
  // geometría cargada»— **sobre una importación que había ido bien**, y era el
  // primero que el usuario leía. No es un fallo: es un paso que todavía no aplica,
  // y un aviso que cuenta un paso inaplicable enseña a no leer los avisos.
  if (!hayGeometria(parcela)) return
  if (catastroCableado === null || typeof catastroCableado.deducir !== 'function') return

  // El sello de ESTE documento. Se lee ahora y no dentro del `then`: leerlo allí
  // sería leer el del documento que hubiera al contestar, o sea no comprobar nada.
  const sello = selloDocumento

  catastroCableado
    .deducir()
    .then((resultado) => {
      // ⛔ Consulta SUPERADA: mientras se preguntaba entró otro documento. Su
      // referencia es cierta, pero no de lo que hay en pantalla.
      if (sello !== selloDocumento) return
      if (!resultado || resultado.ok !== true || !resultado.datos) return
      const { candidatos, unico } = resultado.datos
      // `unico !== true` es el caso de la frontera: el punto interior cae donde el
      // Catastro conoce varias parcelas. F05 ya ha pintado la lista de candidatos
      // en Entrada; elegir una aquí sería exactamente el candidato «a dedo» que el
      // cliente del servicio se niega a escoger.
      if (unico !== true || !Array.isArray(candidatos) || candidatos.length === 0) return
      fijarRefcatDeducida(candidatos[0].refcat)
    })
    .catch((causa) => {
      console.error('[main] la deducción automática tras importar ha fallado:', causa)
    })
}

// ── La vía de MEDICIÓN PROPIA estrena botón (T6) ────────────────────────────
//
// Hasta hoy la única forma de meter un DXF o un TXT era ARRASTRARLO sobre la
// ventana, y eso no se ve: un camino que solo conoce quien escribió el código no
// es un camino. El botón abre el MISMO selector de fichero que «Abrir un GML…»
// —hay UNA sola zona en toda la aplicación, porque dos harían `preventDefault`
// las dos sobre el mismo `drop`— y el destino se resuelve por la extensión, que
// es como funciona desde F10.
//
// ⭐ **2026-08-16 · Y ESTE BOTÓN SIRVE A LAS DOS RAMAS**, sin una línea de más
// aquí: lo único que había que arreglar es que se VIERA. Vivía dentro de
// `.gml-bloque--catastro`, que `app/rama.js` oculta al conmutar, así que el mismo
// párrafo de arriba —«un camino que solo conoce quien escribió el código»— volvía
// a ser cierto, palabra por palabra, para el usuario de la rama EDIFICIO. Ahora
// las dos vías de fichero viven en `.gml-bloque--vias`, que no lleva marca de
// rama; el destino lo sigue eligiendo `ramaEnPantalla` en el paso 9.
const botonMedicion = document.querySelector('[data-accion="abrir-medicion"]')
if (botonMedicion !== null) {
  if (comprobacionCableada !== null && typeof comprobacionCableada.elegirFichero === 'function') {
    botonMedicion.addEventListener('click', () => comprobacionCableada.elegirFichero())
  } else {
    // Regla de oro 1: un botón que no hace nada es peor que uno apagado. Si el
    // paso 9 se cayó, este botón lo DICE con el motivo al lado en vez de tragar
    // el clic — y el arrastre sobre la ventana sigue siendo la vía que queda.
    botonMedicion.disabled = true
    botonMedicion.title =
      'El selector de ficheros no se ha podido montar en esta sesión. Puedes seguir soltando el ' +
      'fichero sobre la ventana.'
  }
}

// Los tres sitios de los que pueden venir hechos nuevos. Ninguno de los tres
// sabe que existe un rail: se suscriben y ya.
estado.subscribe(refrescarHechos)
estadoEdificio.subscribe(refrescarHechos)
ramaCableada.subscribe((rama) => {
  navegacion.cambiarRama(rama)
  refrescarHechos()
})

// ⛔ **Y EL SENTIDO CONTRARIO, QUE FALTABA (auditoría 2026-08-16).** El cable de
// arriba lleva la rama del conmutador a la navegación, pero NADIE hacía el viaje
// de vuelta: `navegacion.irARuta(...)` publica una rama —la escribe el hash, y el
// hash lo escribe esta misma aplicación en cada conmutación (ver
// {@link escribirRuta})— y `ramaCableada.set(...)` solo lo llamaba el GML de
// edificio. Resultado medido: con una parcela cargada, pulsar ATRÁS en el
// navegador dejaba la navegación en EDIFICIO y el conmutador, el panel, la ficha,
// `<body data-rama>` y el mando de «Generar GML» en PARCELA. El rail evaluaba
// entonces los hechos de la otra rama y bloqueaba Edición y Diagnóstico con
// «Falta el edificio» **encima del panel de parcela**, y de ahí no se salía sin
// pulsar «Edificio» y volver. Un enlace `#/edificio/…` pegado en frío hacía lo
// mismo desde el arranque.
//
// La cabecera de `app/rama.js` ya declaraba los «dos dueños durante una rebanada»
// como algo transitorio; la rebanada que lo cerraba no llegó nunca.
//
// ⚠️ **No hay bucle**, y por construcción: `set` solo se llama cuando la rama
// pedida DIFIERE de la puesta, y para cuando corren los suscriptores el store de
// `rama.js` ya devuelve la nueva —así que la vuelta por el cable de arriba
// encuentra `pedida === get()` y se para en seco. Es la misma guarda por
// comparación con la que {@link escribirRuta} corta el bucle hash ↔ navegación.
navegacion.subscribe((ruta) => {
  const pedida = ruta?.rama
  if (pedida === undefined || pedida === null) return
  if (pedida === ramaCableada.get()) return
  ramaCableada.set(pedida)
})

// ⛔ **AQUÍ VIVÍA EL ESPEJO DEL MODO (F19), Y SE FUE CON ÉL EL 2026-08-07.**
// Repintaba la cabecera al cruzar la puerta de F08, porque «Tomar esta geometría y
// editarla» no tocaba el store —la parcela era la misma— y ningún suscriptor de
// `estado` se enteraba. Retirado el modo, el rótulo del GML importado es uno solo y
// lo pinta el suscriptor del store como los otros cuatro.
//
// ⭐ **AQUÍ ESTUVO EL APAÑO DE T5, Y T9 LO BORRÓ. Y EL 2026-08-08 SE VA TAMBIÉN
// LO QUE T9 PUSO EN SU SITIO.** El apaño ponía esto:
//
//     ctaDiagnosticar.addEventListener('click', () => {
//       queueMicrotask(refrescarHechos)
//       setTimeout(refrescarHechos, 500)   // «por si llegan las vecinas»
//     })
//
// Existía porque `app/cableado-diagnostico.js` **no notificaba a nadie**:
// `ultimoDiagnostico()` era una lectura, no un canal. Como el paso «Informe» del
// rail dependía de que hubiera diagnóstico, la única forma de enterarse era mirar
// dos veces y esperar que la segunda llegara tarde. T9 lo sustituyó por una
// suscripción de verdad: `diagnosticoCableado.alDiagnostico(refrescarHechos)`.
//
// ⛔ Y esa línea ya no está, porque **retirado el peldaño «Informe» no hay ningún
// paso del rail que dependa de que haya diagnóstico**. Refrescar los hechos al
// diagnosticar no encendía nada: `geometria` y `oficial` —los dos que quedan— no
// cambian por diagnosticar. Era una suscripción viva cuyo trabajo se había
// quedado sin destinatario.
//
// ⚠️ **`alDiagnostico` NO se retira de `cablearDiagnostico`**: sigue teniendo
// llamante (el cajón y el informe se enteran por ahí). Lo que se retira es ESTE
// suscriptor.
//
// Y el CTA del pie NAVEGA, que es la otra mitad de T9: pulsar «Diagnosticar encaje»
// era la única acción de la aplicación que producía una pantalla entera sin mover
// el rail de sitio.

// ── Rework de UI · rebanada 5 · EL INFORME ES UNA PANTALLA, NO UN MODAL ────
//
// ⛔ **EL DEFECTO QUE ESTO CIERRA, MEDIDO EN CHROME EL 2026-08-05.** La pantalla
// «Informe» **no tenía nada del informe**: el panel enseñaba exactamente lo mismo
// que Validación —cabecera 117 + avisos 63 + vértices 360 + pie 179 = 720 px— y
// de las tres acciones del informe («Preparar informe (PDF)», «Descargar informe
// de contraste» y «Componer PDF») **no se veía ninguna**: las dos primeras viven
// dentro del cajón de diagnóstico, que en Informe está cerrado, y la tercera
// dentro del `<dialog>`. Ni un solo bloque del panel es propio de esa pantalla.
//
// O sea: **el peldaño «Informe» del rail no participaba en producir el informe.**
// El PDF se sacaba desde Diagnóstico, con el rail marcando otra cosa. Es el mismo
// síntoma de la rebanada 3 (un peldaño decorativo) y de la 4 (una pantalla vacía),
// y aquí estaban los dos a la vez.
//
// La corrección de la rebanada 5 fue —«Informe sale del `<dialog>` a página
// completa»— con el interruptor `app/dialogo-informe.js#comoPantalla`.
//
// ── ⭐ Y EL 2026-08-08 SE LE QUITA EL PELDAÑO, QUE ES LA OTRA SALIDA AL MISMO
//      DEFECTO ────────────────────────────────────────────────────────────────
// La rebanada 5 diagnosticó bien —«el peldaño no participaba»— y eligió una de
// las dos correcciones posibles: **hacer que participara**. La otra era
// **quitarlo**, y es la que se aplica ahora, porque la primera obliga al rail a
// tener un estado por cada `<dialog>` de la aplicación y esta aplicación tiene
// siete. El informe **sigue presentándose a pantalla completa** —eso no se
// toca—; lo que desaparece es el peldaño y, con él, tres cables:
//
//   · el suscriptor que conmutaba `comoPantalla` según el paso,
//   · el `preparar()` de rescate que existía porque al peldaño se podía llegar
//     desde el rail sin haber pulsado el CTA que prepara el contenido,
//   · y la navegación del propio CTA.
//
// ⚠️ **Y la guarda de «no hay informe sin diagnóstico» NO se pierde**: pasa de
// compuerta declarada a hecho de la estructura. «Preparar informe (PDF)» vive
// DENTRO del cajón de diagnóstico, y ese cajón no existe hasta que se ha
// diagnosticado. Ver la nota en `app/navegacion.js#REGLA`.
if (
  informeCableado.dialogo !== null &&
  typeof informeCableado.dialogo.comoPantalla === 'function'
) {
  const dialogoInforme = informeCableado.dialogo

  // SIEMPRE pantalla, y ahora se puede decir de una vez porque ya no depende de
  // dónde esté el rail. Se fija al cablear —no al abrir— porque `presentar()` lee
  // esta bandera en el momento de enseñarse: dejarla para el oyente del CTA sería
  // volver a hacer que el orden de dos oyentes importe, que es exactamente lo que
  // la rebanada 5 tuvo que blindar.
  dialogoInforme.comoPantalla(true)

  // En modo pantalla, «Cancelar» y `Escape` NO cierran: PIDEN salir (ver
  // `dialogo-informe.js#pedirCierre`), porque cerrar estando en su propio paso
  // dejaba la pantalla vacía. Sin peldaño propio ya no hay pantalla que vaciar:
  // detrás está Diagnóstico, con su cajón y sus cifras, que es de donde se vino.
  // Así que salir es, literalmente, cerrar.
  //
  // ⛔ El gesto sigue pasando por `alCancelar` y no se le devuelve a `pedirCierre`
  // la capacidad de cerrar solo: quien decide qué significa «sácame de aquí» es la
  // aplicación, no la vista. Hoy significa cerrar; el día que signifique otra cosa
  // se cambia aquí, en una línea, y la vista no se entera.
  dialogoInforme.alCancelar(() => {
    dialogoInforme.cerrar()
  })
}

// ⛔ **AQUÍ ESTABA LA NAVEGACIÓN DE «Preparar informe (PDF)», Y SE HA IDO
// (2026-08-08).** Ponía `navegacion.navegarAPaso(PASO.INFORME)` y era la mitad
// de T9 que emparejaba este CTA con «Diagnosticar encaje». Sin peldaño «Informe»
// no hay a dónde navegar, y el botón vuelve a hacer UNA sola cosa: el oyente de
// `cablearInforme` prepara el contenido y abre el diálogo, que es lo que hacía
// desde F09 y no ha dejado de hacer ni un día.

const ctaDiagnosticar = document.querySelector('[data-accion="diagnosticar"]')
if (ctaDiagnosticar !== null) {
  // ⚠️ **El orden de los dos oyentes de este botón importa, y no es casualidad.**
  // El del paso 8 (`cablearDiagnostico`) se registró antes, así que corre primero y
  // abre el cajón pasándole SU evento —lo que impide que el guardián de clic-fuera
  // lo cierre en el mismo gesto—. Cuando llega éste, el cajón ya está abierto y
  // `abrirDiagnostico` del paso 15 se encuentra el trabajo hecho: por eso no vuelve
  // a pedir las vecinas. Si algún día se invierten, se pedirían dos veces.
  ctaDiagnosticar.addEventListener('click', () => {
    navegacion.navegarAPaso(PASO.DIAGNOSTICO)
  })
}

// ── Rework de UI · rebanada 3 · EDICIÓN PASA A SER UN PASO DE VERDAD ────────
//
// ⛔ **EL DEFECTO QUE ESTO CIERRA, MEDIDO EN CHROME EL 2026-08-04.** Los cuatro
// gestos de edición del mapa —arrastrar un vértice, borrarlo con el botón
// derecho, insertar con doble clic y seleccionar un lindero— estaban vivos en
// las CUATRO pantallas: **15 de 15 marcadores arrastrables en Validación**,
// exactamente los mismos que en Edición. El peldaño «Edición» del rail no
// cambiaba NADA de lo que se podía hacer; era decorativo, que es el síntoma que
// este rework existe para curar.
//
// El interruptor vive en `viewer/edicion.js` y no sabe nada de navegación
// (criterio 1). Quien decide es la autoridad; esto es solo el cable entre las
// dos, y por eso está aquí y no allí.
//
// ⚠️ La barra de herramientas se esconde por OTRO camino —`data-pantalla` en
// `viewer/barra-edicion.js` y las tres reglas del CSS—, y es deliberado: son
// dos ejes distintos (lo que se VE y lo que se PUEDE), y hacerlos pasar por el
// mismo sitio los ataría de una forma que costaría deshacer el día que una
// pantalla quiera enseñar la barra apagada con su motivo al lado.
//
// ── ⛔ F12 · T4.2 · Y DESDE QUE HAY DOS EDICIONES, ESTE ES **EL** SITIO ──────
// La rama EDIFICIO tiene su propio `crearEdicion` sobre el mismo `L.Map`, y las
// dos NO pueden estar encendidas a la vez: los gestos se pisarían y el usuario
// arrastraría un vértice de la parcela creyendo mover el del edificio. Quién
// edita depende de DOS ejes —qué rama y qué paso—, y los dos solo se cruzan
// aquí: `app/rama.js` no sabe de pasos y `app/navegacion.js` no sabe de ramas.
//
// Por eso las dos ediciones se nombran **en la misma función**, con la condición
// escrita una sola vez. Repartir esta decisión entre los dos módulos sería
// dejarla a merced del orden en que llegasen sus avisos.
if (visor.edicion !== null && typeof visor.edicion.activa === 'function') {
  // `subscribe` entrega la situación al suscriptor, igual que en `app/rama.js` y
  // `app/contraste.js`; el arranque se hace a mano con `get()` porque el store no
  // publica al suscribirse.
  const aplicarEdicion = () => {
    const editando = navegacion.get().paso === PASO.EDICION
    const enEdificio = ramaCableada !== null && ramaCableada.get() === RAMA.EDIFICIO
    const mandaParcela = editando && !enEdificio
    const mandaEdificio = editando && enEdificio

    // ── ⭐ F18 · Y DESDE QUE LAS DOS RAMAS DIBUJAN, EL ORDEN IMPORTA ─────────
    // «Dibujar recinto» es UN botón con DOS dueños, uno por rama, y los dos
    // escriben siempre —el que no manda, `false`—. Eso es deliberado (callarse
    // dejaría el botón como lo hubiera dejado el otro), pero convierte el ORDEN de
    // estas dos llamadas en la decisión: **gana el último que escribe**, así que
    // hay que llamar primero al que PIERDE el mando. Es el mismo problema que
    // «Generar GML» resolvió con `mando()`, y se resuelve en el mismo sitio: aquí,
    // que es el único que conoce a la vez el paso y la rama.
    //
    // Sin esto y con orden fijo, una de las dos conmutaciones deja el botón
    // mintiendo: yendo a Parcela lo escondería el edificio justo después de que la
    // parcela lo enseñara, y la herramienta sería invisible en la única rama que
    // acaba de ganarla.
    if (mandaParcela) {
      edificioCableado?.edicion(false)
      edicionCableada.mandoDeDibujo(true)
    } else {
      edicionCableada.mandoDeDibujo(false)
      edificioCableado?.edicion(mandaEdificio)
    }

    // ⚠️ Y ESTO, EL ÚLTIMO. `mandoDeDibujo(false)` cancela el trazo en curso, y al
    // cancelarlo el cableado REPONE la edición que había apagado para dibujar. Si
    // `activa(...)` se escribiera antes, esa reposición sería la última palabra y
    // dejaría la edición de la parcela encendida en una pantalla que no es Edición.
    visor.edicion.activa(mandaParcela)
  }
  aplicarEdicion()
  navegacion.subscribe(aplicarEdicion)
  // ⚠️ Y también al conmutador de rama: sin esta segunda suscripción, cambiar de
  // rama sin cambiar de paso dejaría encendida la edición de la rama que se
  // acaba de abandonar. `app/rama.js` publica `subscribe` desde F11.
  ramaCableada?.subscribe(aplicarEdicion)
}

// ── ⭐ F13 · «Generar GML» en la rama EDIFICIO ───────────────────────────────
//
// El segundo dueño del botón. Se cablea AQUÍ y no junto al de parcela (paso 10)
// porque necesita el conmutador ya montado para poder repintarse al cambiar de
// rama, y el conmutador es el paso 13.
//
// ⚠️ **Los dos tienen que repintarse en cada conmutación, y no solo el que
// entra.** El que sale dejó el botón como estaba con SU dato; si solo repintara
// el entrante, un botón encendido por la parcela seguiría encendido en la rama
// Edificio hasta que el store de edificio cambiara — y pulsarlo generaría el GML
// de la construcción sin que nada lo hubiera dicho. Se llama a los dos y decide
// `mando()`: el que no lo tiene, no toca nada.
const gmlDeEdificio = cablearGeneracionGmlEdificio({
  estadoEdificio,
  panel,
  srs: SRS_DEMO,
  mando: mandoDeEdificio,
})

ramaCableada?.subscribe(() => {
  gmlDeParcela.refrescar()
  gmlDeEdificio.refrescar()
})

// ── ⭐ F14 · EL RESALTE POR PARTE: `porParte` ESTRENA LLAMANTE ────────────────
//
// `validation/edificio.js#porParte` se construyó en la fase 1 de F13 para que «el
// resalte del aviso rodee LA PARTE QUE SE SALE, no otra» (ficha §16.1), se probó,
// y **no tuvo ni un llamante fuera de sus pruebas**. Es la tercera vez que este
// proyecto escribe el canal y no lo enchufa —F11 `parsers/dxf.js`, F12
// `edificio.edicion`, F13 esto—, y ésta es la línea que lo cierra.
//
// ⚠️ **No añade ni una validación.** `cablearGeneracionGmlEdificio` ya validaba en
// cada cambio del modelo para gobernar «Generar GML»; lo único que faltaba era una
// forma de enterarse. Por eso el cable va del canal de aquél al `resaltar` del
// otro, y no hay un tercer `validarEdificio` en ninguna parte: dos validaciones
// serían dos verdades sobre el mismo edificio, y el día que una divergiera el mapa
// señalaría una parte mientras el renglón habla de otra.
gmlDeEdificio.alValidacion((validacion) => {
  edificioCableado?.resaltar(partesSenaladas(validacion))
})

// ── F12 · T4.2 · «Dibujar recinto», la sexta palabra de la barra ─────────────
//
// Se cablea aquí y no en `viewer/barra-edicion.js` por lo mismo que «Deshacer» y
// «Offset»: la barra FABRICA el botón y no sabe qué hace, y quien lo sabe es el
// cableado de la rama. El botón nace ESCONDIDO —no apagado— y lo enseña quien
// tenga el mando: `cablearEdificio` cuando hay una parte elegida, y desde F18
// también `cablearEdicion` en la rama PARCELA.
//
// ── ⭐ F18 · UN BOTÓN, DOS HERRAMIENTAS, Y EL REPARTO ESCRITO AQUÍ ──────────
// El mismo botón dibuja el recinto de la parte activa en EDIFICIO y el exterior de
// la parcela en PARCELA. No son la misma operación —escriben en stores distintos y
// significan cosas distintas— pero son la misma PALABRA para el usuario, y por eso
// comparten mando en vez de tener uno cada uno: dos botones «Dibujar recinto» en la
// misma barra, uno de ellos siempre escondido, sería la barra explicando la
// arquitectura interna.
//
// El reparto se decide en el instante del clic y no en el montaje, por lo mismo que
// el destino de un `.dxf` soltado: la rama la elige el usuario después. Y se lee
// `mandoDeParcela()`, que ya existe desde el paso 10 y es la MISMA condición que
// gobierna «Generar GML» — una sola definición de «quién manda ahora».
{
  const botonDibujar = document.querySelector('[data-accion="dibujar-recinto"]')
  if (botonDibujar !== null) {
    botonDibujar.addEventListener('click', () => {
      if (mandoDeParcela()) edicionCableada.alternarDibujo()
      else edificioCableado?.alternarDibujo()
    })
  }
}

// ── La URL (decisión D3): hash, y el DATO manda sobre la URL ─────────────────
//
// `#/parcela/validacion`. El hash no necesita nada del servidor, así que GitHub
// Pages lo sirve tal cual y atrás/adelante/recargar funcionan. Al aterrizar se
// valida el paso pedido contra los hechos que HAY: si no se sostiene, se cae al
// último que sí Y SE DICE POR QUÉ, porque un enlace compartido lleva el paso pero
// no lleva el expediente.

/**
 * Lleva el estado a la barra de direcciones.
 *
 * ⚠️ **El arranque REEMPLAZA y los cambios EMPUJAN**, y la diferencia se nota:
 * con `location.hash` en el arranque, la primera entrada del historial sería la
 * URL sin hash, y el primer «atrás» del usuario le sacaría de la aplicación
 * creyendo que vuelve un paso. `replaceState` no dispara `hashchange`, que es
 * justo lo que se quiere aquí (el estado ya es el que se está escribiendo).
 *
 * @param {{reemplazar?: boolean}} [opciones]
 */
function escribirRuta({ reemplazar = false } = {}) {
  const ruta = navegacion.ruta()
  if (location.hash === ruta) return
  if (reemplazar) history.replaceState(null, '', ruta)
  else location.hash = ruta
}

// El aterrizaje va ANTES de suscribirse: un enlace que no se sostiene provoca una
// caída con su mensaje, y no hace falta escribir en la URL el paso intermedio.
// Un hash que no es nuestro (`#seccion`, el de otra librería) no mueve nada y no
// se cuenta: no es un error, es que no va con nosotros.
if (location.hash !== '') navegacion.irARuta(location.hash)
escribirRuta({ reemplazar: true })

navegacion.subscribe(() => escribirRuta())

// Atrás, adelante y pegar un enlace a mano entran todos por aquí.
window.addEventListener('hashchange', () => {
  if (location.hash === navegacion.ruta()) return
  navegacion.irARuta(location.hash)
})

// ── 16 · EL SOBRANTE (F17 · 4.2) ─────────────────────────────────────────────
//
// El último paso, y el que cierra el hueco que dejaba a esta aplicación sin poder
// entregar **más de 1 de cada 5** expedientes de parcelario reales: mover un
// lindero hacia dentro obliga a aportar también la finca que se suelta, o el IVG
// sale negativo. Hasta hoy la app sabía derivarla, medirla, validarla, componer el
// sobre de N `gml:featureMember` y comprobar que el conjunto cierra — y nadie
// llamaba a nada de eso. `derivacion/entrega.js` llevaba desde la fase 3 sin
// llamante en producción; aquí lo estrena.
//
// Va EL ÚLTIMO por lo mismo que el informe y el expediente: es el que más
// dependencias tiene, y las tiene todas de pasos anteriores.
//   · el STORE (paso 2), del que sale la geometría editada Y el contorno oficial,
//     y del que este cableado es un suscriptor más — el que invalida la foto;
//   · el VISOR (paso 5), por sus DOS piezas de F17: la lista del panel y la capa
//     de manchas numeradas;
//   · el PANEL de avisos (paso 3), a donde van las detecciones de la derivación y
//     del expediente: eso es lo que le pasa al DATO. Los motivos de los botones
//     van en sus renglones, que es lo que le pasa a la ACCIÓN.
//
// ⚠️ **La sección anfitriona la rellena el propio cableado**, que es quien conoce
// a la vez el nodo del panel y la lista. Es la misma división que estrenó el
// diagnóstico el 2026-08-05 con `cajon.anfitrion(...)`, con una diferencia: aquél
// nace en una esquina del mapa y SE MUDA, y éste nunca ha estado en el mapa.
//
// ⚠️ SIN `try` propio, igual que los pasos 6, 8, 9, 11, 12 y 13: lo único que
// puede lanzar aquí es un contrato del programador (o que la cáscara haya dejado
// de traer los tres nodos, y entonces hay que arreglar `index.html`).
// El registro de vecinas (F23). Se suscribe al canal de F05 y **no pide nada**: se
// puebla con las colindantes que traiga cualquier otra parte de la aplicación —abrir
// el Diagnóstico, o «Traer colindantes»—, así que no gasta ni una petición de más
// (override O8). Sin cliente del Catastro se queda en `null`, que es «no se han
// consultado» y NO «no hay ninguna»: la derivación lo dice en vez de inventarlo.
const registroColindantes = crearRegistroColindantes({ catastro: catastroCableado })

const derivacionCableada = cablearDerivacion({
  estado,
  lista: visor.sobrante.lista,
  capa: visor.sobrante.capa,
  capaFuera: visor.sobrante.capaFuera,
  // La TERCERA capa (2026-08-18): cómo queda la parcela del colindante tras el
  // recorte. Sin ella la aplicación proponía modificar la finca de otro titular
  // —la metía en el `.gml` y la listaba con su superficie— sin enseñarla nunca.
  capaVecinos: visor.sobrante.capaVecinos,
  // ⭐ La SEÑAL de «cuál es cuál» (2026-08-20): el marco que marca en el mapa la
  // geometría de la fila que se está señalando en «Para comprobar». Sin ella esa
  // zona lista las parcelas del expediente por su referencia catastral —once
  // caracteres iguales de doce, en el caso normal— y no hay forma de emparejar
  // una fila con ninguna de las manchas del mapa.
  senal: visor.sobrante.senal,
  colindantes: registroColindantes,
  panel,
  srs: SRS_DEMO,
})

// ── 16 bis · LA LEYENDA DICE LO QUE HAY DIBUJADO, Y NADA MÁS ─────────────────
//
// La leyenda se montó en el paso 5 con los dos grupos que están siempre —tu
// medición y el Catastro—, y aquí se le enchufa lo que la pone al día. Va EL
// ÚLTIMO de los suscriptores porque necesita a los tres que le dicen qué hay:
//
//   · la NAVEGACIÓN (paso 14), que sabe el paso y la rama;
//   · la DERIVACIÓN (paso 16, justo arriba), que sabe si hay una foto del
//     sobrante viva — sus manchas cian y ámbar están en el mapa exactamente
//     mientras `ultimaCesion()` no sea `null`, porque su `invalidar()` limpia las
//     dos capas en el mismo gesto en que la borra;
//   · el STORE (paso 2), que es lo que hace caducar esa foto: sin oírlo, la
//     leyenda seguiría anunciando un sobrante que se borró del mapa al mover un
//     vértice.
//
// ⛔ **Por qué no basta con enseñarlo todo siempre**, que era lo cómodo: una
// leyenda que anuncia el ámbar de la invasión en una pantalla donde no se
// diagnostica nada le está diciendo al técnico que ese color puede aparecer —y
// cuando de verdad aparezca, ya no significará lo mismo—. Una leyenda que miente
// es peor que no tenerla, porque el usuario deja de mirar el mapa y se cree la
// tarjeta. Es la misma doctrina con la que el diagnóstico distingue «no hay» de
// «no se sabe».
//
// ⚠️ Los grupos se recalculan ENTEROS en cada aviso y se aplican tal cual:
// `grupos()` repinta doce nodos, así que no hay nada que memorizar, y una
// comparación de arrays aquí sería una segunda fuente de verdad que se
// desincroniza sola.
function gruposDeLeyenda() {
  // Los dos que están dibujados siempre que hay algo en el mapa.
  const grupos = [GRUPO_LEYENDA.LEVANTAMIENTO, GRUPO_LEYENDA.CATASTRO]
  const enEdificio = ramaEnPantalla === RAMA.EDIFICIO
  if (enEdificio) grupos.push(GRUPO_LEYENDA.EDIFICIO)
  // El contraste de F07 —la mancha fría, el ámbar, el rosa y la banda del
  // margen— lo pinta `viewer/contraste.js`, y SOLO en la pantalla de Diagnóstico
  // de la rama PARCELA: en la de edificio ese cajón es otro y no dibuja nada de
  // esto.
  if (!enEdificio && navegacion.get().paso === PASO.DIAGNOSTICO) {
    grupos.push(GRUPO_LEYENDA.DIAGNOSTICO)
  }
  if (derivacionCableada.ultimaCesion() !== null) grupos.push(GRUPO_LEYENDA.SOBRANTE)
  return grupos
}

function refrescarLeyenda() {
  // `?.` y no un `if`: `visor.leyenda` es `null` cuando el visor se monta sin
  // ella, y este paso no es quien decide que eso sea un error — es la misma
  // política de opcionalidad que el resto de piezas del visor.
  visor.leyenda?.grupos(gruposDeLeyenda())
}

navegacion.subscribe(refrescarLeyenda)
estado.subscribe(refrescarLeyenda)
// ⛔ **Y LA DERIVACIÓN, que faltaba** (auditoría 2026-08-16, hallazgo B1).
// Los tres párrafos de arriba nombraban a la derivación como una de las tres
// fuentes de esta leyenda y solo se enchufaban dos, así que el caso más visible de
// los tres era justo el que no llegaba: pulsar «Rehacer el parcelario» pintaba las
// manchas cian y ámbar y la tarjeta NO las anunciaba hasta la siguiente navegación
// o edición. Derivar no toca ningún store ni mueve el rail —por eso ninguno de los
// otros dos cables se entera—, y por eso `cablearDerivacion` publica su propio
// canal, sin carga, igual que el de identidad del expediente.
derivacionCableada.alCambiarSobrante(refrescarLeyenda)
// Y una vez AHORA, para que la leyenda nazca coherente con la pantalla en la que
// se aterriza (un hash `#/parcela/diagnostico` pegado en un correo entra
// directamente en Diagnóstico y nadie habría navegado todavía).
refrescarLeyenda()

// ── 17 · LA MEDICIÓN PROPIA (F18) ────────────────────────────────────────────
//
// El paso que le da a `parsers/importar.js` su PRIMER LLAMANTE en producción para
// la rama de PARCELA. Aquel módulo se escribió en F01 —con sus detectores de X/Y
// invertidas, geográficas pegadas, cierre que no cierra y reparto por capas— y se
// quedó once fases en verde sin que nadie pudiera llamarlo: en F01 todavía no
// había aplicación, y cuando la hubo, F08 cableó `.gml`, F10 declinó el DXF por
// escrito y F11 llevó `.dxf`/`.txt` solo a la rama de edificio.
//
// Mientras tanto la pantalla de Entrada anunciaba la vía con su propio botón. Este
// paso es lo que hay detrás del cartel.
//
// ⚠️ **Va después del 13 (la rama) y del 14 (el rail), y no por antigüedad**: el
// destino del fichero lo elige {@link ramaEnPantalla} y el aterrizaje mueve el
// rail. Las dos cosas tienen que existir antes.
//
// ⚠️ SIN `try` propio, igual que los pasos 6, 8, 9, 11, 12, 13 y 16.
const medicion = cablearMedicion({
  estado,
  panel,
  idLocalDemo: ID_LOCAL_DEMO,
  // ⛔ **El gancho va ENVUELTO, y es el mismo envoltorio que usa el paso 9 para
  // «Contrastar».** `alCargarParcela` reinicia el historial —para que un `Ctrl+Z`
  // no devuelva la parcela anterior, decisión 2 de `cablearEdicion`— pero no mueve
  // al usuario de sitio. Y aquí la ruta crítica también ATERRIZA: acaba de entrar
  // geometría nueva, y dejar al usuario en Entrada mirando las tres vías con su
  // propia medición ya cargada por debajo es exactamente el defecto que T9 del
  // rework corrigió para el Catastro.
  //
  // {@link aterrizarTrasContrastar} intenta Diagnóstico y se cae a Validación
  // diciendo por qué: con la parcela oficial delante el encaje se puede medir, y
  // sin ella —el caso de empezar un expediente desde cero— no, y se dice.
  //
  // ⛔ **F22 · Y NO SE ATERRIZA EN DIAGNÓSTICO CUANDO LO DIBUJADO *ES* LA
  // OFICIAL, que lo destapó el guion 24.** Un DXF de «Consulta Masiva» entra con
  // `recintos === geometriaOficial`, así que el encaje vale CERO **por
  // construcción**: la ficha de F22 ya lo dice —«que nadie lea ese cero como una
  // verificación»— y aterrizar ahí es enseñar un dictamen tautológico como si
  // fuera un resultado.
  //
  // Y tenía una segunda mitad, peor y silenciosa: abrir el Diagnóstico dispara
  // `pedirVecinas()`, que **sustituía las siete fincas del dibujo por las que
  // conteste el WFS** —medido: 7 → 3, y el renglón de la ficha perdía el «· del
  // dibujo»— cincuenta milisegundos después de haberlas cargado. Es el mismo
  // patrón que «traer el Catastro machaca la medición» (2026-08-08), un piso más
  // abajo y con las vecinas en vez de con la parcela.
  //
  // El criterio es {@link dibujoEsLaOficial}, el mismo que M25 midió para la
  // cabecera: **que lo dibujado SEA la oficial**, no que exista una. El destino es
  // Edición, que es donde están la tabla de vértices y los CTA.
  //
  // ⭐ **Y HAY UN TERCER DESTINO desde el 2026-08-19: el levantamiento SIN UNIR.**
  // Ese fichero entra con `recintos: []` y su nube de puntos, así que las dos ramas
  // de arriba fallarían las dos: `dibujoEsLaOficial` es falso —no hay dibujo— y
  // `aterrizarTrasContrastar` intentaría Diagnóstico sobre un contorno que no
  // existe. El sitio al que hay que ir es Edición, que es donde están «Dibujar
  // recinto» y el enganche a esos puntos: la pantalla que convierte ese fichero en
  // una parcela. Se comprueba ANTES que las otras dos por eso mismo — es el único
  // caso en que todavía no hay geometría, y las demás preguntas la dan por hecha.
  alCargarParcela: (parcela) => {
    edicionCableada.alCargarParcela(parcela)
    // Entra geometría nueva: la deducción de la ANTERIOR deja de valer. Se borra
    // ANTES de aterrizar para que la ficha no enseñe ni un fotograma la referencia
    // de la parcela que se acaba de ir. Y sube el sello, que es lo que deja
    // superada la consulta que aquella importación pudiera tener en el aire.
    entraDocumentoNuevo()
    if (soloPuntosSinRecinto(parcela) || dibujoEsLaOficial(parcela)) {
      refrescarHechos()
      navegacion.navegarAPaso(PASO.EDICION)
    } else {
      aterrizarTrasContrastar()
    }
    // Y DESPUÉS de aterrizar: la pantalla ya está donde tiene que estar, así que
    // la respuesta del Catastro no llega a un rail que todavía se está moviendo.
    deducirRefcatTrasImportar(parcela)
  },
  // ── F22 · el dibujo trae VARIAS fincas ────────────────────────────────────
  // Las dos piezas del visor y la capa de vecinas. Van desde aquí y no se buscan
  // desde el cableado por lo mismo que todo lo demás del visor: `app/main.js` es
  // el único módulo que compone, y `cablearMedicion` sigue funcionando sin ellas
  // —se degrada a contar el bloqueo con palabras— para poder usarse en un test.
  parcelas: visor.parcelas,
  // ⚠️ **NO se le pasa `visor.colindantes` a pelo**, y no es ceremonia: la ficha
  // del panel tiene UN dueño —este módulo—, que es lo que impide que dos sitios
  // escriban el mismo renglón con criterios distintos. El cableado pinta; quién
  // lleva la cuenta, y de dónde dice que salieron, se decide aquí.
  colindantes: {
    pintar: (vecinas) => {
      visor.colindantes.pintar(vecinas)
      fijarRecuentoColindantes(vecinas.length, true)
    },
  },
  // Los otros dos inquilinos de `bottomleft`. Se cierran ANTES de abrir el de
  // fincas: soltar un fichero no es un clic, así que su guardián de clic-fuera no
  // se entera y quedarían apilados. Mismo gesto que el paso 9 con el de F07.
  cajonesQueCerrar: [visor.diagnostico.cajon, visor.comprobacion],
  // El MISMO gancho y el MISMO porqué que en el paso 9: este cajón pertenece a
  // Entrada, y soltar el fichero desde Diagnóstico dejaría el rail diciendo una
  // cosa y la esquina del mapa enseñando otra.
  alPedirEleccion: () => {
    navegacion.navegarAPaso(PASO.ENTRADA)
  },
})
medicionCableada = medicion

// ── Paso 18 · F19 · EL PEGADO DE COORDENADAS ────────────────────────────────
//
// La vía que `feature-01` llama **principal** y que llevaba doce fases sin
// construirse: `parsers/list.js` está en verde desde la fase 1 y **no había ni un
// manejador de `paste` en producción**. Ver `app/dialogo-pegado.js`.
//
// ⚠️ **Va después del 17 y por lo mismo que él**: el destino se resuelve TARDE,
// por {@link ramaEnPantalla}, y los dos cableados tienen que existir ya. Con
// PARCELA lo pegado entra como medición; con EDIFICIO, como partes. **El mismo
// gesto en las dos ramas** (decisión 7): que valga en una y no en la otra es la
// asimetría que F11 dejó a medias y F18 borró para el fichero.
const dialogoPegado = crearDialogoPegado({ documento: document, alAvisar: panel.avisar })
const botonPegado = document.querySelector('[data-accion="abrir-pegado"]')
if (botonPegado !== null) {
  botonPegado.addEventListener('click', async () => {
    const enEdificio = ramaEnPantalla === RAMA.EDIFICIO
    const destino = enEdificio ? edificioCableado : medicionCableada
    if (destino === null || typeof destino.alTexto !== 'function') {
      // Regla de oro 1: un botón que traga el clic es peor que uno apagado.
      panel.avisar(
        'La pantalla de pegar coordenadas no está disponible en esta sesión. Puedes seguir ' +
          'usando «Elegir un fichero de medición…» o soltando el fichero sobre la ventana.',
        { nivel: NIVEL.AVISO },
      )
      return
    }

    const texto = await dialogoPegado.abrir({ inspeccionar: destino.inspeccionarTexto })
    // `null` es cancelar, y cancelar no es un fallo: no se dice nada. El diálogo
    // solo devuelve texto cuando su propia vista previa ha dicho que sirve.
    if (texto === null) return
    await destino.alTexto(texto, NOMBRE_PEGADO)
  })
}

// ── Paso 19 · «VACIARLO»: LA SALIDA DEL EXPEDIENTE EN CURSO ─────────────────
//
// Petición del autor (2026-08-09). Va EL ÚLTIMO por lo mismo que el rail: para
// vaciar hay que tenerlo todo montado. El renglón y sus dos tiempos los pone
// `app/empezar-de-nuevo.js`; lo que se decide aquí es **qué significa vaciar**, y
// ésa es una decisión de esta costura y de nadie más.
//
// ── ⛔ POR QUÉ SE RECARGA EL DOCUMENTO Y NO SE «LIMPIA EL ESTADO» ───────────
// La tentación es `estado.set(null)`, `estadoEdificio.set(null)`, `reiniciar(
// historial, null)` y listo. Los dos stores lo aguantarían —desde el 2026-08-07
// nacen vacíos, así que todos sus suscriptores ya saben tratar el `null`—, y aun
// así estaría MAL, porque el estado de esta pantalla no vive solo en los stores:
//
//   · `colindantesTraidas` y `colindantesDeDibujo`, aquí mismo (paso 4): la ficha
//     seguiría diciendo «3 colindantes» sobre una pantalla vacía;
//   · `ramaEnPantalla`, aquí mismo, y el `data-rama` del `<body>`;
//   · el último diagnóstico de `cableado-diagnostico.js` y su cajón;
//   · el sobrante derivado y su lista (paso 16);
//   · la elección de finca pendiente de `cableado-medicion.js` (F22);
//   · la identidad del expediente abierto en las DOS ramas
//     (`identidades` en `cableado-expediente.js`), que decide si el siguiente
//     «Guardar» crea un registro o pisa uno;
//   · el pie de firma del informe, los renglones de procedencia, la caché de la
//     capa WMS, el encuadre del mapa…
//
// O sea que un vaciado «a mano» son dieciocho módulos que hay que acordarse de
// tocar, y la penalización por olvidar uno no es un error: es una pantalla que
// dice algo que ya no es verdad, en verde y sin ruido. Este repositorio lleva
// quince fases anotando exactamente ese modo de fallo.
//
// Recargar es lo contrario: **no hay nada que acordarse de limpiar**, porque el
// arranque vacío es un camino que la aplicación ya recorre en producción todos los
// días y que tiene suite propia (`test/app/main-arranque-vacio.dom.test.js`).
// Cuesta lo que cuesta abrir la aplicación —es estática, sin servidor— y lo que se
// pierde es exactamente lo que se ha pedido perder: lo guardado sigue en IndexedDB.
//
// ── ⚠️ LA QUERY Y EL HASH HAY QUE QUITARLOS, Y ANTES DE RECARGAR ───────────
// `location.reload()` a secas recargaría **la misma URL**, y la misma URL es
// `?demo=real#/parcela/edicion`: volvería a entrar el dataset de demostración y el
// aterrizaje intentaría un paso que ya no se sostiene. Por eso se reescribe la
// barra de direcciones primero.
//
// ⛔ Y se reescribe con `replaceState` y NO con `location.replace(limpia)`: cuando
// lo único que cambia es el hash —el caso normal, porque el `?demo=` solo lo lleva
// quien lo ha escrito—, `location.replace` **no recarga nada**, solo mueve el
// fragmento. Sería un botón que borra la barra de direcciones y deja la pantalla
// igual. `replaceState` cambia la URL del documento sin navegar y sin dejar
// entrada en el historial (un «atrás» a un estado que ya no existe no ayuda a
// nadie), y el `reload()` de la línea siguiente ya recarga la URL nueva.
cablearEmpezarDeNuevo({
  documento: document,
  estado,
  estadoEdificio,
  alVaciar: () => {
    const limpia = new URL(location.href)
    limpia.search = ''
    limpia.hash = ''
    history.replaceState(null, '', limpia)
    location.reload()
  },
})

// Y una última remedida del mapa cuando el navegador ya ha maquetado el rail. En
// el arranque la cáscara entera existe antes de que corra este fichero, así que
// Leaflet mide bien; esto es la red para el día que deje de ser cierto.
requestAnimationFrame(() => {
  if (visor?.mapa) visor.mapa.invalidateSize()
})

// ── 18 · LA PRIMERA VISITA ───────────────────────────────────────────────────
//
// La tarjeta que cuenta qué es esto, cómo empezar, y —lo que de verdad justifica
// el paso— que **pinchar el mapa rellena la referencia catastral**. Ese camino
// existe desde F05 y no tiene ningún control que lo anuncie: hasta hoy vivía en la
// segunda frase del apunte de una vía (`index.html:630`), que es mejor que nada y
// menos que suficiente.
//
// Va LA ÚLTIMA del fichero a propósito. La condición de apertura mira los DOS
// stores, y para que esa mirada valga algo tiene que ocurrir cuando ya ha pasado
// todo lo que puede meter una parcela: el `?demo=`, el aterrizaje por `location.hash`
// (paso 17) y cualquier expediente que se restaure. Montarla antes daría la
// fotografía de un arranque que todavía no ha terminado de arrancar.
//
// El módulo NO escucha ni al mapa ni al store: los dos cierres automáticos se
// cablean aquí abajo. Ver la cabecera de `app/tarjeta-bienvenida.js`.
const bienvenida = crearTarjetaBienvenida({ documento: document })

/**
 * ⭐ **LA CONDICIÓN, Y SUS DOS MITADES.**
 *
 *   · **La llave.** Primera visita de este navegador.
 *   · **Los dos stores vacíos.** Ésta es la mitad que se olvida, y es la que
 *     impide que la tarjeta MIENTA. Su texto habla del mapa de España, así que
 *     solo puede salir cuando el mapa mira a España — o sea cuando `encuadrar`
 *     cae en `vistaInicial` por no haber geometría. Con un expediente restaurado,
 *     con `?demo=` o con una URL que trae parcela, el mapa ya voló a ella y una
 *     bienvenida encima sería una tarjeta describiendo una pantalla que no está.
 *
 * ⛔ Y cuando no se abre **la llave NO se escribe**: quien llegó por una URL con
 * parcela no ha visto nada, así que sigue teniendo pendiente su primera visita.
 */
if (!bienvenida.yaVista() && estado.get() === null && estadoEdificio.get() === null) {
  // Sin parcela no hay referencia, así que el gesto está siempre vivo en este
  // camino. Se pasa explícito igual —y no por defecto— porque el día que esta
  // condición cambie, el que la cambie tiene que ver esta línea.
  const abrirBienvenida = () => bienvenida.abrir({ rama: ramaEnPantalla, puedeDeducir: true })

  // ── ⚠️ NO SE ABRE EN EL PRIMER FOTOGRAMA, Y ES UNA DECISIÓN MEDIDA ────────
  // `.gml-mapa` enseña de telón la retícula de puntos mientras cargan las teselas
  // (ver la sección «Mapa» de `estilos/app.css`). Una tarjeta blanca flotando
  // sobre esa retícula gris no se lee como una bienvenida: se lee como que la
  // cartografía no ha cargado. Se espera al primer `load` de la capa base —la de
  // verdad, la que `viewer/capas.js` tiene montada— y, si no llega, a 600 ms.
  //
  // Es una CARRERA y no una espera: el `load` puede no llegar nunca (sin red, o
  // con el WMS caído), y en ese caso la tarjeta tiene que salir igual. Un camino
  // que solo funciona con red sería peor que el problema que resuelve.
  let yaAbierta = false
  const abrirUnaVez = () => {
    if (yaAbierta) return
    yaAbierta = true
    abrirBienvenida()
  }
  const base = visor?.capas?.bases?.get?.(visor.capas.baseActiva?.())
  if (base && typeof base.once === 'function') base.once('load', abrirUnaVez)
  setTimeout(abrirUnaVez, 600)

  // ── Cierre 1 · el primer clic en el mapa ─────────────────────────────────
  // El gesto que la retira es EL MISMO que enseña. Se lee, se prueba, y la ayuda
  // se aparta sola justo cuando deja de hacer falta. Se marca la llave: quien ha
  // ejecutado el gesto ya no necesita que se lo cuenten.
  //
  // ⚠️ `once` y no `on`: este oyente no tiene por qué sobrevivir a su único uso, y
  // dejarlo puesto obligaría a retirarlo en algún sitio que hoy no existe.
  if (visor?.mapa && typeof visor.mapa.once === 'function') {
    visor.mapa.once('click', () => bienvenida.cerrar({ marcar: true }))
  }

  // ── Cierre 2 · entra una parcela por cualquier vía ───────────────────────
  // ⛔ **ESTA MITAD NO ESTABA EN EL PLAN Y SIN ELLA HAY UN DEFECTO REAL.** Quien
  // ignora la tarjeta, teclea una referencia y pulsa «Traer del Catastro» carga su
  // parcela — y el mapa vuela a ella — con la bienvenida todavía encima. La
  // tarjeta describe el arranque vacío: en cuanto el arranque deja de estar vacío,
  // la tarjeta sobra. Es la misma regla de la condición de apertura, aplicada
  // también DESPUÉS de abrir.
  //
  // Se marca la llave porque llegar aquí es haber empezado de verdad, y eso es
  // exactamente lo que la tarjeta venía a conseguir. De paso cierra el flanco de
  // «Empezar de nuevo», que recarga la página: sin marcar, quien carga una parcela
  // y vacía volvería a ver la bienvenida como si fuera nuevo.
  //
  // Las dos suscripciones **se dan de baja en cuanto disparan**, y no es limpieza
  // decorativa: sin la baja quedarían dos cierres vivos para siempre, y quien
  // reabra la tarjeta desde «Cómo funciona» con una parcela en pantalla la vería
  // cerrarse sola en la siguiente edición —cada operación de `edit/` publica un
  // POJO nuevo—. O sea: una opción de menú que no hace nada, sin decir por qué.
  //
  // `crearEstadoVista#subscribe` NO notifica al suscribirse (está escrito en su
  // contrato), así que esto no puede autodispararse con el estado que ya hay.
  const bajas = []
  const cerrarPorDato = (dato) => {
    if (dato === null) return
    bienvenida.cerrar({ marcar: true })
    while (bajas.length) bajas.pop()()
  }
  bajas.push(estado.subscribe(cerrarPorDato), estadoEdificio.subscribe(cerrarPorDato))
}
