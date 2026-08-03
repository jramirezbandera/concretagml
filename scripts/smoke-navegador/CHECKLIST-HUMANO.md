# Checklist humano — F03 · Fase 5

Lo que **ninguna máquina de este proyecto puede firmar**. El smoke automático
(`GUION.md`) mide los cinco criterios de aceptación en un navegador real y sale
`ok:true` en las dos pasadas; la suite (1.173 pruebas) cubre la lógica. Queda
esto, que es de otra naturaleza: **gestos de ratón de verdad** y **juicio
visual**.

> Desde F05 esta lista tiene un punto **6**, que no es de F03 y no es de la misma
> naturaleza que los cinco primeros: recoge lo que ni siquiera
> `07-catastro-vivo.js` —que llama al Catastro de verdad— puede firmar.
>
> Y desde F06 tiene un punto **7**, el de la EDICIÓN: lo que `08-edicion.js` no
> alcanza porque sus gestos son sintéticos (la mano), más lo que es juicio y no
> medida (si un gesto se descubre, si la barra estorba sobre la parcela, si once
> filas de vértices bastan). **El punto 7 se firma junto con el 6**, y hasta
> entonces esta lista sigue bloqueando el cierre de F03 → F05 → F06.
> **Sigue SIN FIRMAR** — el traslado de las herramientas a la barra
> (2026-07-29) reescribió 7.4 y 7.6 y añadió 7.6 bis.
>
> Y desde F07 tiene un punto **8**, el del DIAGNÓSTICO: lo que `09-diagnostico.js`
> no alcanza porque es juicio y no medida — si el cajón estorba, si la sombra de
> la diferencia se ENTIENDE sin leyenda, y el punto BLOQUEANTE de la fase: si
> alguna cifra o algún color **se lee como un veredicto**. **El punto 8 se firma
> junto con el 6 y el 7**; la cadena bloqueada es F03 → F05 → F06 → F07.
>
> Y desde F08 tiene un punto **9**, el de COMPROBAR UN GML EXISTENTE: el
> **arrastre con la mano** (que `10-comprobar-gml.js` solo puede sintetizar, igual
> que el punto 1 con el ratón), si el cajón de comprobación se entiende sin que
> nadie lo explique, y el punto BLOQUEANTE que HEREDA el carácter del 8.1: si
> alguna nota **se lee como un veredicto sobre el trabajo de otro técnico**. La
> app mide; el colegiado firma. **El punto 9 se firma junto con el 6, el 7 y el
> 8**; la cadena bloqueada es F03 → F05 → F06 → F07 → F08.
>
> Y desde F09 tiene un punto **10**, el del INFORME FIRMABLE EN PDF, y es de los
> que no se pueden delegar en ninguna máquina por dos motivos distintos. Uno es
> mecánico: el PDF está escrito **a mano, byte a byte, sin librería**, y
> `11-informe-pdf.js` solo puede mirar sus bytes — **que ABRA, y en tres lectores
> distintos, hay que verlo** (§10.1, y BLOQUEA: uno que abre en un solo lector no
> está escrito, está de suerte). El otro es de lectura, y HEREDA el carácter del
> 8.1 y del 9.4 subiendo la apuesta: en F07 el sujeto era una parcela, en F08 el
> trabajo de otro técnico, y **aquí es un papel que alguien firma y entrega**. Con
> mención expresa a la **presunción de vía pública**, que es el único sitio de toda
> la aplicación donde se PROPONE en vez de medir (§10.5, BLOQUEANTE). **El punto 10
> se firma junto con el 6, el 7, el 8 y el 9**; la cadena bloqueada pasa a ser
> **F03 → F05 → F06 → F07 → F08 → F09**.
>
> Y desde F10 tiene un punto **11**, el de PERSISTENCIA Y EXPORTACIÓN, y es el que
> más depende del ENTORNO de toda la lista. `12-expedientes.js` cierra el hueco más
> grande que ha tenido nunca esta suite —**toda la de F10 corre sobre
> `fake-indexeddb`, que no es una base de datos**— y mide la supervivencia a una
> **recarga** de verdad. Pero cuatro cosas se le escapan por ser del entorno y no
> del código: **cerrar el navegador entero** y volver (§11.1, que es donde de verdad
> se ve si el perfil conserva o desaloja, y donde se comprueba que `persist()`
> —MEDIDO en `false`— no cumple lo que la ficha prometía), **dos pestañas a la vez**
> (§11.2), **abrir un `.json` desde el disco** y en otro perfil (§11.5), y sobre
> todo **abrir el DXF en un CAD** con las dos capas seleccionables por capa (§11.4,
> **BLOQUEANTE**, mismo reparto que el PDF en tres lectores del §10.1: en la fase 0
> se midió que nuestro propio parser aprueba ficheros que ningún CAD abre). La
> quinta es de lectura y HEREDA el carácter del 8.1, el 9.4 y el 10.5: si alguna
> frase de la lista de expedientes **se lee como un veredicto** (§11.6,
> BLOQUEANTE). **El punto 11 se firma junto con el 6, el 7, el 8, el 9 y el 10**;
> la cadena bloqueada pasa a ser **F03 → F05 → F06 → F07 → F08 → F09 → F10**.
>
> ⛔ **Y el punto 9 ya se ha recorrido una vez, el 2026-08-02, y encontró TRES
> DEFECTOS REALES — dos de los cuales ni siquiera eran de F08: venían de F03 y de
> F05.** Están corregidos, con guardián en la suite y **medidos desde entonces por
> el guion 10** (`GUION.md` §16). El detalle está al principio del punto 9. **La
> lista sigue SIN FIRMAR**: hay que volver a recorrerla con las correcciones
> puestas, que es exactamente lo que manda «Cuándo repetir esta lista».

> Regla de lectura: aquí NO se repite nada que ya esté medido. Cada punto existe
> porque el smoke **no puede** cubrirlo, y dice por qué. Si alguna vez un punto
> de esta lista se vuelve automatizable, se baja al guion y se borra de aquí.
> **Aplicada el 2026-08-02** sobre los tres hallazgos de arriba: no se han añadido
> como puntos manuales —los mide el guion— y se ha podado del 7.7 lo que el guion
> pasó a medir. Lo que queda de ellos aquí es el JUICIO, que no se automatiza.

## Cómo dejarlo listo

Contra la versión publicada, que es lo que ve el usuario:

**<https://jramirezbandera.github.io/concretagml/>**  ·  con hueco:
[`?demo=hueco`](https://jramirezbandera.github.io/concretagml/?demo=hueco)

O en local, sobre el bundle de verdad (no `npm run dev`):

```bash
npm run build && npx vite preview
```

⚠️ La app se sirve bajo el `base` de Pages, así que la URL local es
`http://localhost:4173/concretagml/` — **la raíz da 404**. Ábrela **en un
navegador normal, a pantalla completa** (no en el de `browse`).

Al terminar, parar el servidor **por PID verificado** — nunca por patrón
`node …vite`: hay servidores de otros proyectos en esta máquina. El
procedimiento está en `GUION.md` §7.

---

## 1 · El arrastre, con ratón de verdad ⟨criterio 3⟩

**Por qué está aquí.** `/browse` no tiene comando `drag` y su allowlist CDP no
incluye el dominio `Input`, así que `03-arrastre.js` sintetiza los eventos. Eso
prueba la maquinaria de `L.Draggable`, la proyección y la cadena marcador →
store → tabla → dibujo → ficha **con layout real**, pero se salta justo la capa
que un evento sintético no toca: **hit-testing, `pointer-events`, cursor y
tamaño del área de agarre**. El propio veredicto lo dice en
`esGestoDeRatonReal: false`.

- [ ] **Se agarra a la primera.** Apuntar a un vértice (el cuadradito amarillo,
      10 × 10 px) y arrastrar. ¿Hace falta apuntar con precisión molesta? Si
      cuesta agarrarlo, el área de agarre es pequeña y hay que anotarlo — F06
      convierte esto en la operación central del producto.
- [ ] **El cursor cambia** al pasar por encima del vértice y no engaña sobre
      dónde se puede pinchar.
- [ ] **La fila de la tabla y el polígono siguen al ratón mientras se arrastra**,
      no solo al soltar. Y la **superficie del pie** se actualiza al soltar.
- [ ] **Soltar fuera del mapa** (sobre el panel izquierdo, o fuera de la ventana)
      no deja el vértice pegado al puntero ni bloquea el siguiente arrastre.
      `Draggable._dragging` es global: un gesto sin `mouseup` deja el mapa mudo.
- [ ] **Arrastrar el mapa** (pan) pinchando sobre el polígono funciona y **no**
      mueve ningún vértice por accidente.
- [ ] **Dos arrastres seguidos** sobre el mismo vértice: el segundo engancha.

## 2 · Teclado y edición de celda

**Por qué está aquí.** La suite prueba el evento `change` sobre el `<input>`; lo
que no prueba es escribir de verdad con un teclado físico.

- [ ] Tabular por las celdas de coordenadas llega a todas y el **anillo de foco
      se ve** (debe verse solo en `.gml-input-coordenada`, no en todo el panel).
- [ ] Escribir una coordenada nueva y pulsar Tab o Enter **mueve el vértice en el
      mapa**.
- [ ] Escribir algo ilegible (`abc`, vacío, `12,,3`) **avisa en el panel,
      revierte la celda** y no mete `NaN` en el modelo (la superficie del pie no
      se vuelve `NaN m²`).
- [ ] La cabecera de la tabla **se queda pegada arriba** al hacer scroll con la
      rueda dentro de la caja de vértices.

## 3 · El fallo de red, provocado a mano ⟨regla de oro 1⟩

**Por qué está aquí.** `/browse` no tiene interceptación de red ni modo offline,
así que no hay forma de provocar el 404 desde el guion. Y este punto **no es
cosmético**: es la única comprobación de que el canal `alAvisar` llega a la UI
**en producción**. Si el aviso no aparece, la regla de oro 1 está rota donde
importa.

- [ ] Con la app abierta, **cortar la red** (modo avión, o «Offline» en la
      pestaña Network de las DevTools) y **mover el mapa** para forzar un
      encuadre nuevo.
- [ ] Aparece **al menos una tarjeta** en el panel de avisos y el chip de avisos
      deja de estar a cero.
- [ ] **No hay un muro de tarjetas**: las repeticiones se agrupan con `×N` y, si
      hay más de doce mensajes distintos, aparece la línea «…y N avisos más.».
      (Esto tiene test desde la fase 5, pero verlo con teselas reales es lo que
      cierra el riesgo R5.)
- [ ] Al **volver la red** y mover el mapa, la cartografía se recupera sola.

## 4 · Juicio visual

Lo único de esta lista que no tiene respuesta correcta: es criterio del autor.

- [ ] **Legibilidad del control de capas** (arriba a la derecha). Está en
      `--color-text-secondary` a 12 px sobre blanco y **se lee flojo en las
      capturas**. Decidir si sube de contraste o se queda: es cromo, y el spec
      pide cromo discreto — pero discreto no es ilegible.
- [ ] **El amarillo `#FFD600` sobre la ortofoto**: elegido en esta misma fase 5
      tras descartar violeta (desaparecía en las sombras), verde (el relleno se
      camufla con la vegetación) y magenta (le resta contraste al rojo
      catastral). Falta verlo en **las cinco bases**, conmutándolas una a una:
      «Topográfico IGN» es la más exigente, y sobre asfalto o cubierta muy clara
      es donde el amarillo tiene su punto débil — mirar si el borde blanco del
      vértice basta para sostenerlo.
- [ ] **El nº de vértice de la tabla**, en ámbar `#A16207`: es a propósito un
      valor distinto del amarillo del mapa (sobre blanco, el amarillo es
      ilegible). ¿Se lee como «el color de los vértices» o como un color suelto?
- [ ] **Densidad del panel**: 15 filas caben sin scroll; con `?demo=hueco` hay
      dos recintos. ¿La tabla respira o aprieta?
- [ ] **La zebra con dos recintos** ya está verificada por medida (cada `<tbody>`
      reinicia el patrón; la fila-rótulo no se pinta). Aquí solo queda si
      **agrada**.
- [ ] **El dot-grid como telón de carga**: recargar y mirar el instante antes de
      que llegue la primera imagen. ¿Lee como «mesa de trabajo» o como «esto no
      ha cargado»?
- [ ] **Zoom sin tope**: acercarse más allá del zoom nativo de la ortofoto (donde
      pixela). ¿Sigue siendo usable para calcar? Es el motivo por el que
      `zoomSnap: 0` y `maxZoom > maxNativeZoom` están puestos.

## 5 · Decisión pendiente que la fase 4 dejó escrita: **R2**

El plan de la fase 4 aplazó a la fase 5 la posición del control de opacidad, que
comparte la esquina `bottomright` con la atribución.

**Lo medido:** no se solapan. El control ocupa `y ∈ [830, 876]` y la atribución
`y ∈ [886, 900]`: **10 px de holgura**, `área de solape = 0`, y la atribución da
`visible: true` también con el motor de Playwright. Así que **no hay defecto que
corregir**; la pregunta es solo de gusto.

- [ ] Mirándolo a tamaño real: ¿el bloque «OPACIDAD DE LA CARTOGRAFÍA CATASTRAL»
      pesa demasiado en esa esquina? Si molesta, se mueve con `posicionOpacidad`
      y **no hace falta tocar nada más**.

---

## 6 · El Catastro en vivo ⟨F05⟩ — lo que ni `07-catastro-vivo.js` firma

**Por qué está aquí.** `07` es el guion más completo de la carpeta: llama al
servicio real, prueba CORS, abre la IndexedDB del navegador y recorre las dos
vías de entrada de punta a punta. Aun así solo puede afirmar que **la mecánica
funciona**. Todo lo de esta sección es o **juicio** (¿esto se entiende?) o
**condiciones que no se pueden provocar desde `/browse`** (no tiene modo offline
ni interceptación de red) o **casos que no se pueden pedir a voluntad sin
maltratar el servicio** (override O8: la denegación por abuso es de ~10 días).

⚠️ Antes de nada, léete el **régimen de uso de `GUION.md` §13**. Esta lista se
recorre a mano, sin prisa, y cada punto que consulta al Catastro cuesta una
petición. La mayoría **no** consultan nada.

### 6.1 · ¿Se entiende un fallo del servicio? ⟨no cuesta ninguna petición⟩

`07` comprueba que el renglón dice algo y que el panel recibe el mensaje íntegro.
**Que ese mensaje le sirva a un técnico que no ha leído el código no lo firma
ninguna máquina.** Los ocho textos están en `RESUMEN_POR_MOTIVO`
(`app/cableado-catastro.js`) y en los `mensaje` de `services/catastro.js`; se
pueden leer los ocho de un tirón.

- [ ] Léelos **en voz alta, en el papel de un arquitecto que acaba de abrir la
      app**. ¿Alguno dice lo que ha pasado sin decir qué hacer? ¿Alguno culpa al
      usuario de algo que no ha hecho?
- [ ] El de `NO_ENCONTRADO` lleva a propósito una cola larga («no encontrar nada
      es un estado válido…»). ¿Tranquiliza o suena a excusa?
- [ ] El de `SIN_RED` nombra **las cuatro** causas posibles (internet, DNS, TLS,
      CORS) porque el navegador no deja distinguirlas. ¿Es honesto o es ruido
      para quien solo quiere saber si tiene que reintentar?
- [ ] Con el renglón de 11 px a tamaño real: ¿cabe el resumen sin cortarse en las
      pantallas en que trabajas?

### 6.2 · La red caída **de verdad** ⟨regla de oro 1⟩

**Por qué está aquí.** `/browse` no tiene modo offline ni interceptación de red,
así que `SIN_RED`, `TIEMPO_AGOTADO` y `ESTADO_HTTP` **no se pueden provocar** sin
maltratar el servicio. Es la misma laguna que el punto 3 de esta lista deja para
la cartografía, y aquí importa más: es el camino que el usuario va a pisar en un
tren o en una obra.

- [ ] **Modo avión** (o «Offline» en la pestaña Network de las DevTools), escribe
      una referencia y pulsa «Traer del Catastro». Aparece el renglón de fallo
      **y** una tarjeta en el panel con el mensaje entero.
- [ ] **Nada se ha roto**: la geometría que había sigue en la tabla y en el mapa,
      la ficha no dice `NaN`, y `data-procedencia` **no se ha borrado** (una
      consulta fallida no toca la procedencia: lo que ya estaba sigue viniendo de
      donde venía).
- [ ] **«Generar GML» sigue funcionando** sin red. Es la razón de que los ocho
      motivos de F05 sean `AVISO` y ninguno `ERROR`: que el Catastro no conteste
      no bloquea el trabajo.
- [ ] **Vuelve la red** y repite: carga a la primera, sin recargar la página.
- [ ] Con la red cortada **a mitad de una consulta** (cortarla mientras el botón
      está apagado): el botón se vuelve a encender y el fallo se cuenta. Que la
      UI no se quede muerta y muda es justo lo que protege el `finally` de
      `operar`.

### 6.3 · Qué se ve **mientras** la petición está en vuelo

**Por qué está aquí.** `07` mide que los botones se apagan
(`bloqueoDuranteLaConsulta: true`) y cuánto tarda; **no puede juzgar si la espera
se entiende**. Y no es una espera despreciable: medido, **2.393 ms** el WFS en
frío y hasta **2.903 ms** el OVC en una sola llamada.

- [ ] Pulsa «Traer del Catastro» y **mira los tres segundos**. ¿Se entiende que
      la app está trabajando, o parece que el botón no ha hecho nada? Hoy la
      única señal es el botón apagado: no hay hilandera, ni texto de «buscando…»,
      ni el renglón dice nada hasta el final.
- [ ] ¿Merece la pena que el renglón `role="status"` diga algo al empezar? Ojo:
      lo **anuncia el lector de pantalla**, así que un «consultando…» se oiría en
      cada pulsación. Es una decisión, no un olvido.
- [ ] Lo mismo con «Deducir del mapa», que es el servicio lento de los dos.

### 6.4 · El campo de la referencia, con un teclado y un portapapeles de verdad

- [ ] **Pega una referencia copiada de la Sede**, con sus espacios
      (`9398516 VK3799 G`). ⚠️ Medido: `index.html` pone `maxlength="14"` en el
      campo, así que **el navegador la trunca al pegar** y lo que queda no es una
      referencia. `normalizarRefcat` sabe quitar espacios, pero desde esta
      pantalla **eso es inalcanzable**. ¿Es aceptable, o el campo tiene que dejar
      pegar y normalizar? Es la única decisión de producto que este checklist
      abre en F05.
- [ ] Escribir en minúsculas y pulsar: el campo se queda con la forma
      **canónica** en mayúsculas. (Esto sí lo mide `07`; aquí solo se mira si el
      cambio de lo tecleado a lo canónico **delante de los ojos** desconcierta.)
- [ ] **Enter** dentro del campo. Hoy no dispara nada —el manejador está en el
      botón—, y teclear una referencia y pulsar Enter es el gesto natural.
      ¿Falta?
- [ ] Tabulación: campo → «Traer del Catastro» → «Deducir del mapa», con el
      anillo de foco visible en los tres.

### 6.5 · La deducción, en los casos que no se pueden pedir a voluntad

- [ ] **Clic en el mapa** como segunda vía de deducción (con `?demo=hueco`, que
      es cuando está activa). `07` no lo prueba: necesitaría un punto del lienzo
      y una proyección que no puede validar sin importar Leaflet, y consultar por
      un punto arbitrario gastaría una petición para medir el mismo camino que ya
      mide el botón. Comprueba que un clic **dentro** de la parcela deduce, y que
      un clic normal del mapa (pan, zoom, deseleccionar) **no consulta nada**.
- [ ] **Varios candidatos.** No hay forma de pedirlo: no se sabe de antemano qué
      punto cae en un linde que devuelva dos referencias (la suite lo declara
      como hueco h5). Si alguna vez sale, mira que la lista traiga **el domicilio
      de cada uno** —es lo único que permite distinguirlos— y que el campo **no
      se rellene solo**.
- [ ] Elegir un candidato **con el ratón** y **con el teclado**: al elegirlo, el
      foco vuelve al campo.

### 6.6 · La copia local, con el tiempo de por medio

**Por qué está aquí.** `07` comprueba que la segunda consulta sale de IndexedDB
sin tocar la red, y lo hace **al instante**: la edad del registro es de
milisegundos. Lo que no se puede medir en una pasada es cómo se lee un dato de
hace días — y ese es justo el caso que el renglón de procedencia existe para
cubrir.

- [ ] En las DevTools (Application → IndexedDB → `concreta-gml` →
      `catastroCache`), **edita `guardadoEn`** de un registro para restarle 6
      días, recarga y vuelve a traer esa parcela. El renglón de procedencia tiene
      que decir «guardada **hace 6 días**» y el panel tiene que avisarlo.
      ¿Se ve? ¿Se entiende que se está trabajando sobre una copia?
- [ ] Con **8 días** (por encima del TTL): la consulta vuelve al servicio, y el
      renglón dice que el dato es de la Sede.
- [ ] **Navegación privada / almacenamiento denegado**: la app tiene que
      funcionar igual, solo que más lenta, y decirlo por el panel. La caché es una
      optimización, no un requisito.

### 6.7 · Sobre la URL publicada, que es donde vive el CORS de verdad

**Por qué está aquí.** `07` mide CORS desde `http://localhost:PUERTO`. La app
publicada corre desde **`https://jramirezbandera.github.io`**, que es **otro
origen y otro esquema**. El comodín `Access-Control-Allow-Origin: *` los cubre a
los dos, pero eso hay que verlo, no suponerlo.

- [ ] Abrir <https://jramirezbandera.github.io/concretagml/>, traer una parcela y
      comprobar que llega. Si no llegara, la consola del navegador dirá «blocked
      by CORS policy» — y ese texto **solo lo escribe el navegador**: desde el
      script el fallo es indistinguible de estar sin red.
- [ ] Mirar de paso que no haya avisos de **contenido mixto**: la página va por
      `https` y los tres servicios del Catastro también.

---

## 7 · La edición de la parcela ⟨F06⟩ — lo que ni `08-edicion.js` firma

**Por qué está aquí.** `08-edicion.js` conduce las cinco operaciones de F06 en un
navegador de verdad y mide lo que jsdom no puede: `L.Draggable` real, píxeles
reales, hit-testing real, el zoom real. Pero **sus gestos son sintéticos** —
`/browse` no tiene comando `drag` y su allowlist CDP no incluye el dominio `Input`
(§0)—, así que lo que no toca es exactamente la capa donde vive esta fase: **la
mano**. Y hay una segunda clase de cosas aquí, que no es de medida sino de
**juicio**: si un gesto se descubre, si un rótulo estorba, si un número cabe.

⚠️ De esta lista, **solo el punto 7.7 consulta al Catastro** (una petición). Todo
lo demás se recorre con la parcela de demostración y no cuesta nada. Antes de 7.7,
léete el régimen de uso de `GUION.md` §13.

Recuerda el mapa de gestos, que es lo que se está poniendo a prueba: **clic** =
selecciona lindero · **doble clic** = inserta vértice · **clic derecho sobre un
vértice** = lo elimina · **`Alt`** = arrastra sin ajustar.

⚠️ **Desde el 2026-07-29 las herramientas NO están en el panel: están en una barra
flotante sobre el mapa** (arriba a la izquierda, 285 × 36 px). Cinco: deshacer,
rehacer, ajuste al parcelario (botón partido — el imán conmuta, la flecha abre la
tolerancia), desplazar lindero (desplegable con la distancia) y **«?»**, que abre el
panel de ayuda con los ocho gestos. El bloque «Edición» del panel ya no existe, y la
caja de vértices ha pasado de **64 px a 303 px**. Eso mueve cuatro puntos de esta
sección (7.4 y 7.6 se han reescrito, 7.8 es nuevo): si vienes de una corrida
anterior, **no la copies**.

### 7.1 · El agarre, con un ratón de verdad ⟨criterios 1 y 2⟩

`08` demuestra que el punto exacto del centro del vértice le corresponde al
marcador (`document.elementFromPoint` devuelve su icono, con el `title` correcto) y
que la cota **no** roba el punto medio del lado. Lo que no dice es si una persona
acierta.

- [ ] **Agarrar un vértice a la primera**, con el ratón, sin apuntar con precisión
      molesta. El cuadradito son **10 × 10 px** y F06 convierte esto en la
      operación central del producto: si cuesta, hay que anotarlo con el número de
      intentos, no con un «va justito».
- [ ] **El cursor** cambia al pasar por encima del vértice, y **no** cambia sobre
      la cota (que no es agarrable) ni sobre el resalte del lindero.
- [ ] ⚠️ **¿Se puede enganchar con los 20 cm de verdad?** Medido por `08`: al
      encuadre de arranque la escala es **16,19 px/m**, o sea que τ = 20 cm son
      **3,24 px** — menos de un tercio del lado del vértice. Arrastra un vértice
      hacia el lindero rojo del Catastro **sin tocar el zoom** y mira si engancha o
      si hay que acercarse primero. Si hay que acercarse siempre, la tolerancia por
      defecto está bien elegida pero la app no lo está contando: es decisión de
      producto, no defecto.
- [ ] **El indicador de enganche se ve y se entiende**: ~~marca maciza / anillo
      hueco~~ **cuadrado** cuando captura un VÉRTICE, **reloj de arena** cuando
      desliza sobre un LINDERO (la convención OSNAP; se corrigió el 2026-07-28
      porque relleno y tamaño no se distinguen a mitad de arrastre — ver 7.3 bis).
      ¿Se distinguen de un vistazo sobre la ortofoto, o parecen lo mismo?
- [ ] **Soltar fuera del mapa** (sobre el panel, o fuera de la ventana) no deja el
      vértice pegado al puntero ni bloquea el arrastre siguiente
      (`Draggable._dragging` es global).

### 7.2 · La tecla `Alt` ⟨decisión de la fase — si falla, hay que saberlo⟩

**Este es el punto que más importa de la lista.** `08` mete `altKey: true` en el
evento sintético, y así el módulo la lee sin que el sistema operativo intervenga.
Con un teclado de verdad **puede no llegar nunca**: en Windows, `Alt` activa la
barra de menús del navegador y roba el foco; en algunos entornos abre el menú de la
ventana. `viewer/edicion.js` la eligió porque `Ctrl` colisiona con el zoom de rueda
y `Shift` con el `boxZoom` de Leaflet — o sea que si `Alt` no sirve, **no hay una
cuarta tecla obvia** y habría que decidir otra cosa (un botón, un cambio de
modificador). No es cosmético.

- [ ] Mantén `Alt` y arrastra un vértice **hacia el lindero oficial**. ¿Se salta el
      ajuste? Pruébalo en **los navegadores en los que trabajas**, no en uno.
- [ ] Al soltar `Alt`, ¿el arrastre siguiente vuelve a enganchar? (Hay una guarda en
      el `blur` de la ventana justo para que soltar `Alt` en otra aplicación no deje
      el ajuste apagado para siempre y en silencio: pruébalo cambiando de ventana
      con la tecla pulsada.)
- [ ] Con `Alt` pulsada, ¿el navegador hace algo más — abre menús, pone el foco en
      la barra, pinta un subrayado de acceso rápido? Anótalo aunque el arrastre
      funcione: es lo que hará dudar al usuario.
- [ ] Si `Alt` no sirve: la **casilla «Ajustar al parcelario»** hace lo mismo de
      forma permanente. ¿Basta como salida, o el gesto momentáneo es imprescindible?

### 7.3 · Las cotas sobre la ortofoto real ⟨criterio 4⟩

`08` mide que el número de rótulos visibles **cambia con el zoom en el sentido
correcto** (11 visibles de 15 al encuadre de arranque, 6 al alejar dos niveles, 14
al acercar dos). Que 44 px sea el umbral **correcto** no lo puede medir nadie: es
legibilidad.

- [ ] Mira las cotas sobre la ortofoto a tamaño real, con la cartografía catastral
      encendida al 60 %. ¿La píldora oscura las sostiene sobre asfalto claro **y**
      sobre arbolado en sombra?
- [ ] **¿Estorban?** En la parcela de demostración hay 11 rótulos a la vez. ¿Tapan
      el dibujo, los vértices o los rótulos del Catastro? Si tapan, la salida no es
      apagarlas: es subir el umbral.
- [ ] **El umbral de 44 px**: aleja el zoom despacio y mira **cuándo** desaparece
      cada cota. ¿Se van justo cuando dejan de leerse, antes, o demasiado tarde
      (cuando ya se pisan unas a otras)? El número vive en
      `config/operativos.json#acotacionMinimaPx` y cambiarlo no toca código.
- [ ] Con el zoom muy acercado aparecen las cotas de los lados diminutos (0,95 m,
      0,14 m). ¿Aportan o son ruido?
- [ ] **Al imprimir o al hacer captura**: ¿se leen? F09 va a acotar también sobre el
      informe, y este es el primer sitio donde se ve el aspecto que tendrán.

### 7.3 bis · El indicador de enganche ⟨criterio 2⟩

Sigue la **convención OSNAP de AutoCAD**: **cuadrado** = enganche a VÉRTICE (su
*Punto final*), **reloj de arena** = enganche a un punto cualquiera del LINDERO (su
*Cercano*). La distinción es por **silueta** y no por relleno, porque relleno y
tamaño es justo lo que se pierde a mitad de arrastre sobre una ortofoto.

Dos defectos ya corregidos mirándolo en el navegador el 2026-07-28 —los dos están
fijados por test, pero conviene volver a verlos con ojos—:

- [ ] **El enganche a lindero cae casi siempre en el punto medio del lado, que es
      donde vive su acotación.** Estaba tapado; ahora el indicador va por encima de
      la cota. Míralo: ¿se ve la pajarita, o el amontonamiento de silueta + número +
      píldora es ilegible? Si estorba, la salida no es bajar el indicador: es que la
      cota se aparte durante el gesto.
- [ ] **El cuadrado rodea al vértice con 4 px de aire por lado.** ¿Se distingue del
      cuadradito amarillo del vértice, o vuelve a leerse como «un cuadrado dentro de
      otro»?
- [ ] ¿Alguien que use AutoCAD **reconoce** las dos siluetas sin que se las
      expliquen? Es la única pregunta que decide si copiar la convención valió la
      pena.
- [ ] Con la **cartografía catastral encendida al 60 %** y sobre arbolado en sombra:
      ¿el trazo doble (halo oscuro + amarillo) aguanta?

### 7.4 · Descubrir los gestos ⟨criterio 1⟩ — **reescrito el 2026-07-29**

Un gesto que nadie descubre no existe. ~~El panel los cuenta en dos renglones de
ayuda de 11 px.~~ **Ya no.** Los ocho gestos viven ahora en el **panel de ayuda** del
botón «?» de la barra, en una tabla de tres columnas (gesto · dónde · qué hace) que
se genera del código y no de un texto escrito a mano. Eso cambia la pregunta: antes
era «¿se leen?», y ahora es **«¿alguien lo abre?»**.

- [ ] **Siéntate detrás de alguien que abre la app por primera vez y no digas
      nada.** ¿Pulsa el «?» por su cuenta, o se pone a probar gestos a ciegas? Si no
      lo pulsa, la ayuda no existe aunque esté escrita — y esa es la respuesta que
      importa, no si el texto es bueno.
- [ ] Si lo abre: ¿encuentra lo que buscaba en la tabla, o se pierde entre ocho
      filas? Ocho es más de lo que cabía en el panel, y ese es justo el motivo de que
      la ayuda tenga ahora sitio propio.
- [ ] **El icono «?» compite con cuatro herramientas más.** ¿Se lee como «ayuda», o
      como un botón más de la barra? Míralo sin pasar el ratón por encima: el `title`
      solo aparece al detenerse.
- [ ] **El clic derecho para eliminar**: ¿es descubrible, o la gente esperaba una
      tecla `Supr` con el vértice seleccionado? Hoy `Supr` no hace nada. Pruébalo
      con alguien que no haya visto la app.
- [ ] **El doble clic para insertar**: ¿se intenta primero sobre el *vértice* (para
      editarlo) en vez de sobre el *lindero*? Sobre un vértice no pasa nada.
- [ ] **El clic simple que selecciona**: al pinchar en el mapa lejos de todo lindero
      se DESELECCIONA (y el botón «Desplazar lindero» se apaga). ¿Se lee como «he
      soltado la selección» o como «se ha roto algo»?
- [ ] ¿Alguien intenta arrastrar **el lindero entero** para desplazarlo, en vez de
      teclear una distancia? Es el gesto que un CAD tendría, y aquí no existe.

### 7.5 · Lo que la app dice —y lo que se calla— al editar ⟨regla de oro 1⟩

Dos hallazgos MEDIDOS por `08` que no son fallos y que hay que decidir:

- [ ] **Insertar y eliminar no escriben nada en el renglón** `[data-estado="edicion"]`,
      aunque el comentario que lo fabrica (`viewer/barra-edicion.js`, antes
      `index.html`) lo describa como «el desenlace de
      deshacer, rehacer, insertar, eliminar y desplazar». La operación sí se ve
      (aparece el vértice, crece la tabla, cambia el recuento de la ficha) y el
      renglón es `role="status"`, o sea que lo **anuncia el lector de pantalla**:
      escribir en él en cada inserción se oiría en cada gesto. ¿Falta, o está bien
      callado? Es la misma decisión que F05 dejó abierta con «consultando…».
- [ ] **Desplazar el lindero 1 de la parcela de demostración siempre deja un
      aviso**: sus lados contiguos son casi su prolongación (0,03°), así que no hay
      esquina donde apoyar la intersección y `edit/offset.js` aplica su fallback. El
      lindero se mueve los 0,50 m pedidos, pero **degradado**. Lee la tarjeta del
      panel en voz alta: ¿un técnico entiende qué le ha pasado a su lindero y qué
      puede hacer? Es el texto que más veces se va a leer de toda la fase.
- [ ] **La distancia del offset admite negativos, y el signo no está escrito en
      ninguna parte de la pantalla.** La regla de `edit/offset.js` es inequívoca —
      `distancia > 0` aleja el lindero del interior de su propio anillo, o sea que
      el área de ese anillo crece— pero el campo solo dice «Distancia (m)». Prueba
      `0,5` y `−0,5` sobre el mismo lindero: ¿se adivina cuál va a ser antes de
      pulsar, o hay que probar y deshacer? (Con un HUECO la respuesta desconcierta
      más: el hueco se agranda y la superficie NETA baja.)
- [ ] Teclea una tolerancia ilegible (`abc`, vacío) y una distancia ilegible: el
      panel avisa, el renglón lo dice y **la tolerancia se revierte sola** (la
      distancia no, a propósito). ¿Se entiende la diferencia?

### 7.6 · ¿Bastan once filas de vértices? ⟨comprobación — reescrito el 2026-07-29⟩

Este punto **era una queja y ahora es una comprobación**. Lo que decía antes: «el
bloque «Edición» ocupa 241 px y la caja de vértices queda en **69 px**, o sea 2,8
filas a la vista de las 15». Eso se arregló sacando las herramientas del panel.
Medido en navegador a **1440 × 900**, en dev y en el build, con la lista de avisos
vacía:

| | Antes | Ahora |
|---|---|---|
| Caja `#tabla-vertices` | 64 px | **303 px** |
| Renglones bajo la cabecera fija (24 px) | 1,6 | **11,3** |
| Con una tarjeta de aviso (lo que deja `08`) | 69 px · 2,8 filas | **237 px · 9,6 filas** |

Los números están en el veredicto de `08` (`panel`), **sin juicio**: el umbral de
«bastan» sigue siendo humano (regla de oro 9). Lo que hay que confirmar es que el
arreglo sirve de verdad, no que exista.

- [ ] Con la app a pantalla completa en **la pantalla en la que trabajas**: ¿once
      filas bastan para trabajar una parcela de 15 vértices sin hacer scroll
      continuamente? Prueba también en un portátil de 900 px de alto y con dos
      recintos (`?demo=hueco`), que gasta un renglón más en su separador.
- [ ] **Con el panel de avisos lleno.** Provoca dos o tres avisos (desplaza el
      lindero 1 varias veces) y vuelve a mirar: la lista de avisos tiene su propio
      tope de 34vh y también come alto. ¿Aguanta la tabla, o vuelve el problema por
      otra puerta?
- [ ] La **cabecera de la tabla se queda pegada** al hacer scroll dentro de la caja
      (verificado en F03). Con 303 px ya no se come el espacio útil — confírmalo.
- [ ] ¿Se nota la diferencia **trabajando**, o solo en la captura? Es la pregunta
      que decide si el traslado valió el sitio que la barra ocupa sobre el mapa (ver
      7.8).

### 7.6 bis · La barra sobre el mapa ⟨juicio — nuevo el 2026-07-29⟩

Lo que ganó la tabla de vértices lo paga el mapa: la barra flota **encima de la
ortofoto**, y eso no lo puede juzgar ningún guion. Mide 285 × 36 px arriba a la
izquierda; el panel de ayuda abierto mide 460 × 558 px, o sea el **27 % del lienzo**
(1048 × 900 al viewport de referencia). Nada de esto es un defecto por sí solo — la
pregunta es si molesta cuando se está trabajando.

- [ ] **¿Estorba sobre la parcela?** La geometría se encuadra centrada y la barra
      vive en la esquina superior izquierda, que es donde debería tapar menos. Trae
      dos o tres parcelas distintas (una alargada, una en esquina) y mira si en
      alguna se come vértices que hay que agarrar. Si estorba, la salida es
      `posicionBarra` —admite las cuatro esquinas de Leaflet—, no quitar la barra.
- [ ] **¿Convive con los controles de Leaflet?** El zoom, el selector de capas y el
      control de opacidad están en el mismo mapa. ¿Se lee como una barra de
      herramientas de la app, o como cuatro cajas sueltas amontonadas?
- [ ] ⚠️ **El conmutador del ajuste: ¿se ve encendido de un vistazo?** Nace
      **marcado** (el estado que protege del error más caro de esta app: dejar
      milímetros de hueco entre dos parcelas que en el terreno son la misma línea).
      Es un `<input type="checkbox">` estilado como botón, así que su «encendido» es
      solo un cambio de fondo. Apágalo y enciéndelo mirando a otra parte entre medias:
      ¿sabrías decir en qué estado está **sin** pulsarlo? Si no, es un error
      silencioso de manual y **bloquea**, porque el usuario no puede saber si lo que
      acaba de arrastrar enganchó o no.
- [ ] **¿Se descubren los desplegables?** La tolerancia y la distancia del offset ya
      no están a la vista: se abren desde su herramienta. El ajuste es un **botón
      partido** (imán + flecha) y «Desplazar lindero» abre siempre. ¿Se entiende que
      la flecha abre algo, o parece parte del icono? ¿Alguien encuentra la tolerancia
      sin que se la enseñen?
- [ ] **«Desplazar lindero» no se apaga nunca** — el que se apaga es el botón de
      dentro, y su motivo («Elige antes un lindero en el mapa: basta un clic sobre
      él.») está en el desplegable. Ábrelo sin haber elegido lindero: ¿se lee el
      motivo, o parece que la herramienta está rota?
- [ ] **El panel de ayuda tapa el 27 % del mapa mientras está abierto.** ¿Es
      aceptable para leer una tabla, o hay que cerrarlo para consultar y volver a
      abrirlo? Comprueba las tres salidas: `Escape`, el botón «Cerrar» y **pinchar
      fuera** — y que ese clic de fuera **además** seleccione el lindero que hay
      debajo, en un solo gesto, que es como se diseñó a propósito.
- [ ] **Por teclado.** Tabula hasta la barra y muévete con las flechas: saltan las
      herramientas apagadas. Con un desplegable abierto, las flechas son del campo
      numérico y no de la barra. ¿Se puede deshacer, ajustar la tolerancia y
      desplazar un lindero **sin ratón**?
- [ ] **El renglón de estado arranca vacío**, a propósito: el texto que explicaba
      por qué los botones nacen apagados se fue al panel de ayuda porque sobre la
      ortofoto era un cartel de tres líneas. ¿Se echa de menos, o el motivo se
      encuentra donde ahora vive (el desplegable del offset y la primera línea de la
      ayuda)?

### 7.7 · El enganche a las COLINDANTES ⟨cuesta 1 petición al Catastro⟩

**Por qué está aquí.** Ningún guion lo cubre: `08` no toca servicios de datos a
propósito (override O8), así que mide el ajuste contra la `geometriaOficial` de la
parcela y **declara las colindantes como no cubiertas**. La suite lo prueba con
recintos de fixture. Que enganche a la parcela del vecino **de verdad** solo se ve
haciendo la consulta.

> ⛔ **Podado el 2026-08-02.** Dos medias frases de este apartado se han BAJADO AL
> GUION, que es la regla de esta lista: *«mira que el renglón diga cuántas han
> llegado y que la ficha las cuente»* y *«comprueba que las colindantes de la
> anterior se sueltan»* las mide ahora `10-comprobar-gml.js` (`colindantes.*` y
> `reencuadre.otraParcela.contornosDeVecinasDespues`, `GUION.md` §16). Lo que
> queda aquí es lo que sigue siendo de la mano y del ojo. **Y no es un detalle de
> mantenimiento: fue recorriendo esto cuando se vio que las vecinas no se
> dibujaban en ninguna parte** — ver el encabezado del punto 9.

- [ ] Pulsa **«Traer colindantes»** (una petición). El guion ya afirma que
      aparecen los contornos y que cuadran con la ficha; lo que se mira aquí es
      **si eso basta como acuse de recibo**: al encuadre de arranque las vecinas
      son grandes y el lado que comparten con la propia queda **debajo** del
      amarillo (decisión del pane 405), así que a primera vista solo se ven
      fragmentos por los bordes. ¿Se entiende que «han llegado», o hay que alejar
      dos niveles para creérselo?
- [ ] El **gris `#CBD5E1` a 1,5 px** sobre las cinco bases, y sobre todo con la
      **cartografía catastral encendida**, que dibuja EXACTAMENTE los mismos
      linderos en rojo: ¿se lee el contorno de la vecina, o produce un lindero
      doble y sucio? Y al revés: ¿desaparece sobre asfalto claro?
- [ ] El **emergente** con la referencia catastral: apunta a una vecina y mira si
      aparece donde el ojo lo busca. Es `sticky` a propósito (sigue al puntero en
      vez de plantarse en el centro geométrico, que en una parcela grande puede
      caer fuera de la pantalla).
- [ ] Arrastra un vértice hacia el **lindero de una vecina** y comprueba que
      engancha. Es el caso de uso que da sentido a la fase: cerrar la hendidura
      entre dos parcelas que en el terreno son la misma línea. **Y ahora se ve
      contra qué se engancha**, que antes de este arreglo era invisible.
- [ ] Trae una parcela **nueva** con «Traer del Catastro»: el mapa **viaja** a
      ella y las vecinas de la anterior desaparecen (las dos cosas las mide el
      guion). Lo que se juzga aquí es **el salto**: ¿se entiende que la vista se ha
      mudado, o desorienta? ¿Y «Deshacer» se apaga con su explicación?
- [ ] Con una parcela del Catastro cargada, la ficha ya tiene superficie declarada:
      **mira el Δ catastral moverse durante el arrastre**. Es la única parte del
      criterio 4 que `08` no puede medir, porque la parcela de demostración no trae
      superficie inscrita.

---

## 8 · El diagnóstico de encaje ⟨F07⟩ — lo que ni `09-diagnostico.js` firma

**Por qué está aquí.** `09-diagnostico.js` mide el mecanismo entero en un
navegador de verdad: el `<path>` de la diferencia con su `fill-rule="evenodd"` y
sus dos anillos, el cajón que flota sin cambiar el tamaño del mapa **y sin
quitarle un píxel a la caja de vértices al abrirse** (lo único que F07 le cuesta
al panel son los ~36 px del CTA del pie, medidos y deliberados), la banda del
margen que conserva sus metros al hacer zoom y el tiempo del recálculo (~7 ms).
Lo que NO puede firmar es de otra naturaleza: F07
es la fase cuyo riesgo de producto no es técnico, es que **una pantalla llena de
cifras se lea como un dictamen** — y «cómo se lee» no lo mide ninguna máquina.

Para recorrerla: trae `9398516VK3799G` con «Traer del Catastro» y pulsa
**«Diagnosticar encaje»** (una petición de colindantes al abrir — régimen del
§13). Mueve un vértice medio metro hacia una vecina para que haya algo que ver.

### 8.1 · El punto BLOQUEANTE: ¿algo se lee como un veredicto? ⟨regla de oro 9⟩

El guardián mecánico ya exige que no haya palabra, clase CSS ni color de mérito
(la suite de aceptación y el guion lo comprueban). Esto es lo que queda: la
LECTURA. Enséñale el cajón abierto a alguien que no haya visto la app —o míralo
tú con ojos de cliente— y pregunta:

- [ ] ¿Alguna cifra **parece un aprobado o un suspenso**? El % de solape es el
      candidato obvio: «99,80 % de la mayor» ¿se lee como una nota de examen?
      Si sí, el problema es de rotulación, no del número.
- [ ] La **banda del margen de identidad**: ¿se entiende como referencia
      informativa (eso es, y su etiqueta lo dice), o el trazo discontinuo
      alrededor del lindero oficial se lee como «carril bueno / zona permitida»?
- [ ] El **ámbar de la invasión**: ¿queda claro que ese color afirma un HECHO
      (hay superficie dentro de la vecina) y no una opinión? ¿Y queda claro que
      es el ÚNICO color que afirma algo?
- [ ] El titular «Contraste con el parcelario — Medición de X m² frente a los
      Y m² del parcelario vigente»: ¿alguien lo parafrasea como «está bien» o
      «está mal»? Si la paráfrasis natural es un dictamen, el texto no está
      haciendo su trabajo.

### 8.2 · La sombra de la diferencia ⟨`spec/SPEC.md` §10.5⟩

- [ ] Con un vértice movido medio metro, ¿la mancha gris **se entiende sin
      leyenda** como «lo que no coincide»? ¿O parece un error de pintado?
- [ ] Muévelo dos metros: ¿la sombra sigue leyéndose, o a ese tamaño se confunde
      con el relleno de la propia parcela?
- [ ] Sobre la **ortofoto** (no sobre el fondo blanco): ¿el gris al 22 % se ve, o
      desaparece sobre asfalto?
- [ ] El lindero de máxima desviación va resaltado con su cota y su línea guía:
      ¿se encuentra de un vistazo, o hay que buscarlo?

### 8.3 · El cajón sobre el mapa

- [ ] En `bottomleft`, con la parcela encuadrada: ¿tapa la parcela o la esquina
      que estorba menos? Muévele el zoom: ¿sigue sin estorbar?
- [ ] Ábrelo y edita: arrastra un vértice, selecciona un lindero, desplázalo.
      **Todo F06 tiene que seguir vivo con el cajón abierto** — el guion lo
      garantiza para el mecanismo; lo que aquí se mira es si el FLUJO se siente
      natural (diagnosticar → corregir → volver a mirar las cifras).
- [ ] Pincha fuera: se cierra Y el clic hace lo suyo (seleccionar lindero). ¿Se
      siente bien o sorprende? `Escape` también cierra.
- [ ] La tabla a tres bandas con la registral tecleada: ¿los signos se entienden
      («−» = medimos menos)? ¿La fila «Catastro − Registro» aporta o confunde?
- [ ] «No se ha consultado» frente a «ninguna» en la invasión: ¿la diferencia se
      percibe leyendo rápido, o las dos se leen como «no pasa nada»?

### 8.4 · La clase de suelo propuesta

- [ ] Con la parcela urbana cargada, el margen dice «Clase propuesta por la
      aplicación». ¿Se entiende que es una PROPUESTA que se puede cambiar en el
      `<select>`, o se lee como un dato oficial más?
- [ ] Cambia a «Rústica»: la banda pasa de ±0,50 m a ±2,00 m. ¿El cambio se ve en
      el mapa sin tener que releer el texto?

---

## 9 · Comprobar un GML existente ⟨F08⟩ — lo que ni `10-comprobar-gml.js` firma

**Por qué está aquí.** `10-comprobar-gml.js` recorre F08 entera en un navegador
de verdad y mide lo que jsdom no puede: los bytes reales del fichero, el velo con
su `opacity` calculada, el cajón que no tapa ninguno de los cinco controles del
mapa (0 px² de solape en los cinco), los dos cajones que no coinciden, el informe
que baja con **12.869 bytes** y el invariante de los **267 px** de la caja de
vértices. Lo que NO puede firmar son dos cosas de otra naturaleza: **la mano**
—`/browse` no tiene comando `drag` (§0), así que el arrastre es sintético— y **la
lectura**, que es donde vive el riesgo de producto de esta fase: F08 pone en
pantalla una medición sobre el trabajo de otro técnico, y «cómo se lee eso» no lo
mide ninguna máquina.

### ⛔ Lo que esta lista encontró la PRIMERA vez que se recorrió (2026-08-02)

**Tres defectos reales. Ninguno lo veía la suite. Ninguno lo veía el guion. Y dos
de los tres ni siquiera eran de F08.** Esto se deja escrito porque **es el
argumento entero de que este gate exista**: no es una formalidad de cierre, es el
único sitio donde alguien mira la pantalla sin una expectativa escrita de
antemano.

1. **El mapa no reencuadraba nunca** ⟨de F03⟩. `encuadrar()` se llamaba una sola
   vez, al construir el visor: se traía una parcela de Sevilla o se soltaba un GML
   de Cádiz y **el mapa seguía mirando la de demostración**. De rebote, «traer
   geometría del Catastro» **parecía no tener feedback visual**: el dibujo estaba
   hecho, a cientos de kilómetros de la vista.
   → Arreglado en `viewer/index.js` (paso 7): se reencuadra cuando entra una
   parcela con **otra identidad** (`refcat ?? idLocal`), **nunca al editar**.
   **La suite no podía verlo por construcción:** todas sus pruebas traen su
   geometría a mano y la app arranca ya encuadrada sobre ella.
2. **Las colindantes no se dibujaban en ningún sitio** ⟨de F05⟩. Se traían, se
   publicaban, las usaban el snap de F06 y la invasión de F07 — y **nadie las
   pintaba**: pulsar «Traer colindantes» dejaba el mapa exactamente igual mientras
   la ficha decía el número.
   → Arreglado con `viewer/colindantes.js` y el pane **405** (por debajo de la
   parcela propia: comparten lindero). **La suite no lo veía porque nadie
   afirmaba que se dibujaran** — no es que un test fallara: la afirmación no
   existía.
3. **La referencia del GML no llegaba al campo del panel** ⟨sí, de F08⟩, y los
   botones derivados se quedaban encendidos contradiciéndolo.
   → Arreglado en `app/cableado-comprobacion.js`: forma canónica, y el campo se
   **vacía** cuando el fichero no trae referencia utilizable.

**Los tres los mide desde el 2026-08-02 el guion 10** (`GUION.md` §16), así que
**no se han añadido como puntos manuales de esta lista**: la regla del fichero es
que lo automatizable baja al guion. Lo que sí se ha podado es el **7.7**, donde
había dos medias frases que el guion pasó a cubrir.

⚠️ **Antes de nada, lee el §16 del `GUION.md`.** El guion sale hoy en `ok:true`,
pero su **primera** corrida salió `ok:false` por **dos defectos reales** que él
mismo destapó (los botones de los dos cajones en `system-ui`, y la descarga del
informe cerrando el cajón de diagnóstico). **Ya están corregidos y con guardián**,
y su causa está descrita allí. Si al recorrer esta lista ves reaparecer cualquiera
de los dos —o cualquiera de los tres de arriba—, **es una regresión**: anótala como
bloqueante y mira `M17`–`M22` de `spec/feature-08-comprobar-gml.md`, que dicen
dónde vive cada arreglo y por qué está ahí y no donde se notaba.

Para recorrerla, con la app viva: suelta
`test/fixtures/gml/cp_parcela_9398516VK3799G.gml` sobre la ventana, pulsa
«Contrastar con el parcelario», y de ahí a «Diagnosticar encaje». Después repite
con `test/fixtures/gml/derivados/cp_huso_incoherente.gml` (8 notas y 4 hallazgos:
es el fichero «que va mal») y con `test/fixtures/gml/UTM_1.gml` (el 3.0 sin
referencia). **Solo el primero consulta al Catastro** (una petición; los otros dos
no gastan nada). Régimen de uso en `GUION.md` §13.

### 9.1 · El arrastre con un ratón de verdad ⟨criterio 1⟩

**Por qué está aquí.** El guion fabrica un `DataTransfer` y despacha
`dragenter`/`dragover`/`dragleave`/`drop` a mano, porque `/browse` no tiene
comando `drag` y su allowlist CDP no incluye el dominio `Input` (§0). Eso prueba
el módulo entero —el `preventDefault` que evita que el navegador abra el fichero,
el contador de profundidad, el velo— pero **no toca la capa que sí toca un
usuario**: el explorador de archivos, el cursor del sistema, la ventana perdiendo
el foco. El propio veredicto lo dice en `esGestoDeRatonReal: false`.

- [ ] **Arrastra un `.gml` desde el explorador de Windows** y suéltalo sobre la
      ventana. ¿Se abre el cajón? Prueba a soltarlo **sobre el panel izquierdo**,
      **sobre el mapa** y **sobre la tabla de vértices**: la zona es la ventana
      ENTERA a propósito, y las tres tienen que valer igual.
- [ ] **El cursor**: mientras arrastras, ¿dice «copiar» y no «mover»? Es lo que
      promete que no se va a tocar el fichero de origen.
- [ ] ⚠️ **Suéltalo FUERA de la ventana** (en el escritorio, en otra pestaña) y
      vuelve. ¿El velo se ha quitado? Un velo que se queda puesto deja la
      aplicación con una capa encima; el módulo tiene una red (el contador nunca
      baja de cero y el velo va con `pointer-events: none`), pero eso se ve al
      primer intento y no en un guion.
- [ ] **Entra y sal cruzando el panel** (que está lleno de celdas): el velo no
      puede **parpadear** al cruzar de un elemento a su hijo. Es el contador de
      `dragenter`/`dragleave`, y en sintético no se nota.
- [ ] **Suelta un `.dwg` o un `.pdf`.** Tiene que aparecer un aviso que nombre las
      extensiones que sí se aceptan, y NO puede pasar nada más. Y luego suelta
      **tres ficheros a la vez**: se abre el primero **y se dice cuál** y cuáles
      no.
- [ ] **El mismo fichero dos veces seguidas** por el botón «Abrir un GML…»: la
      segunda tiene que volver a abrirlo. (El módulo vacía el `value` del input
      justo para esto, y es el reintento más probable que hay: abrir un GML, ver
      que le falta algo, corregirlo fuera y volver.)
- [ ] **Con el teclado.** Tabula hasta «Abrir un GML…» y pulsa **Enter** y
      **Espacio**: los dos tienen que abrir el selector de ficheros del sistema.
      Ningún guion ve ese diálogo. Y el `<input type="file">` que el módulo
      fabrica **no** puede aparecer como una segunda parada muda en el tabulador.

### 9.2 · ¿Se entiende el cajón de comprobación, sin que nadie lo explique?

**Por qué está aquí.** El guion mide que el cajón cabe, que no tapa nada y que
dice lo que tiene que decir. Que se ENTIENDA es otra cosa. Enséñaselo a alguien
que no haya visto la app —o míralo tú con ojos de cliente— con el fichero del WFS
soltado:

- [ ] El titular es «Comprobación del fichero — Parcela catastral · formato 4.0,
      descarga del servicio». ¿Se entiende **qué le está diciendo la app**: que ha
      leído el fichero, o que lo está juzgando?
- [ ] El rótulo dice «declara «ISO-8859-1», leído como «utf-8»». Es un hecho real
      y bien medido (el fichero **miente sobre sí mismo**). ¿Le sirve a un
      arquitecto, o es ruido de programador? Si es ruido, la salida no es borrarlo
      —regla de oro 1— sino contarlo de otra manera.
- [ ] Las dos superficies, «que declara el fichero» (1536 m²) y «medida sobre sus
      coordenadas» (1535,87 m²): ¿queda claro que son **dos números del mismo
      fichero** y no el Catastro contra la medición? Es la confusión más cara de
      esta fase.
- [ ] **Los dos botones están abajo del todo y con el fichero malo hay que hacer
      scroll dentro del cajón para llegar a ellos** (medido: el cajón mide 420 ×
      468 px y su contenido, 937). ¿Se descubre que el cajón hace scroll, o parece
      que no hay salida? Si no se descubre, la salida no es acortar las notas.
- [ ] «Descartar»: ¿queda claro que **no cambia nada** y que el fichero
      simplemente se suelta?
- [ ] Con `cp_ejemplo_explicativo.gml` (la plantilla oficial, sin referencia
      catastral): el cajón dice que no hay nada que pedirle al Catastro y el CTA
      de F07 se queda apagado **con su motivo**. ¿Se lee como una explicación o
      como un fallo de la app?

### 9.3 · Las notas sobre el GML de otro técnico: ¿informan o regañan?

**Por qué está aquí.** El guion cuenta las notas (8 con el fichero del WFS, 8
notas y 4 hallazgos con el del huso incoherente) y comprueba que el recorrido
CONTINÚA. No puede leerlas. Y esa tanda es larga: es lo que un GML ajeno produce
en cuanto se le pasa la validación completa de F02.

- [ ] Suelta `cp_huso_incoherente.gml` y **lee las notas en voz alta**, en el
      papel del técnico que hizo ese fichero. ¿Suenan a «esto es lo que he
      medido» o a «lo has hecho mal»?
- [ ] La nota de los **15 vértices fuera del huso declarado** es la más dura que
      la app puede escribir. ¿Dice qué ha pasado sin decidir de quién es la culpa?
      ¿Y se entiende que el recorrido **sigue** —que el fichero se puede cargar
      igual— o parece que ahí se acabó?
- [ ] La orientación del contorno exterior sale como **informativa** («Horario»).
      Override O1: es convención, no requisito, y la plantilla del propio Catastro
      va antihoraria. ¿Se lee así, o parece un requisito incumplido?
- [ ] El bloque «Es lo que devuelve el servicio de descarga del Catastro […] tal
      cual NO se puede presentar en la Sede» es un hecho que costó un rechazo real.
      ¿Se entiende que el problema es la **envoltura** y no la geometría?
- [ ] Con `UTM_1.gml` (formato 3.0): dice que es de una versión que la Sede ya no
      admite **y enseña la parcela igualmente**. ¿Se percibe esa doble cosa, o el
      usuario cree que no puede hacer nada?

### 9.4 · ⛔ EL PUNTO BLOQUEANTE: ¿alguna nota se lee como un veredicto sobre el trabajo de otro técnico? ⟨regla de oro 9⟩

**Hereda el carácter bloqueante del 8.1, y por el mismo motivo.** El guardián
mecánico ya exige que en `comprobacion/` no haya ni una clave, ni una palabra, ni
una clase CSS de mérito (`test/comprobacion/aceptacion-f08.dom.test.js`), y el
guion lo comprueba sobre el DOM pintado. Esto es lo que queda: **la lectura**. Y
en F08 el sujeto no es una parcela: es el trabajo de una persona con nombre.

- [ ] Enséñale el cajón a alguien y pregúntale, sin darle pistas: **«¿qué te está
      diciendo esto del fichero?»** Si la respuesta natural es «que está mal» o
      «que está bien», el texto no está haciendo su trabajo, aunque no contenga
      ninguna palabra prohibida.
- [ ] **`puedeContinuar` es la única excepción autorizada de la regla 9, y es
      CAPACIDAD, no mérito**: vale `false` solo cuando no hay geometría legible,
      nunca porque la parcela «esté mal». Cuando el botón «Contrastar» está
      apagado, ¿el motivo escrito se lee como «la app no puede» o como «tu fichero
      no vale»?
- [ ] La palabra **ERROR** delante de un hallazgo de geometría. Es una
      **severidad**, no una nota de examen — y por eso lleva color, que es la otra
      excepción autorizada. ¿Se lee como el hecho que es?
- [ ] Con el fichero de edificio (`bu_building_9398516VK3799G.gml`): la app dice
      que es un GML de edificio, que el contraste de construcción **todavía no
      existe** (es F14) y no deja contrastar contra el lindero. ¿Suena a «tu
      fichero no sirve» o a «esto todavía no lo sé hacer»? La diferencia lo es
      todo: lo segundo es la verdad.
- [ ] Y el informe descargado, que es lo que puede acabar en manos de un tercero:
      léelo entero una vez. ¿Alguna línea **dictamina** algo? El documento dice por
      escrito que es provisional, sin pie de firma, y que **no** es la validación
      gráfica alternativa (VGA) ni el informe de validación gráfica (IVG) del
      Catastro. ¿Ese desmentido se ve, o hay que buscarlo?

### 9.5 · La tercera vía: pulsar «Diagnosticar encaje» con el cajón de comprobación abierto

**Por qué está aquí.** Los dos cajones comparten la esquina `bottomleft` y son
mutuamente excluyentes por diseño. T4.1 blindó **dos** de los tres caminos
(cualquier `estado.set` cierra el de comprobación; abrir el de comprobación
cierra el de diagnóstico) y **declaró por escrito el tercero**: pulsar el CTA del
pie con el cajón de comprobación abierto abre el de F07 sin tocar el store, así
que Leaflet los apila en vertical. No se resolvió porque la única forma sería
escuchar el clic del CTA de otra feature, y ese cable **se rompe en silencio** el
día que ese botón cambie de nombre.

Medido por el guion, para que lo juzgues con la cifra delante: los dos apilados
ocupan **946 px** de alto en un lienzo de **900**, así que **el de comprobación se
sale del mapa por arriba** (`y = −77`). No se solapan entre sí.

- [ ] Suelta un fichero y, **sin pulsar «Contrastar» ni «Descartar»**, pulsa
      «Diagnosticar encaje» en el pie. Míralo: ¿se lee como «dos cosas a la vez» o
      como que algo se ha roto? ¿Se puede seguir trabajando —cerrar uno, usar el
      otro— sin recargar?
- [ ] ¿Cuánto molesta de verdad, o es un camino que nadie recorre? Si molesta, la
      solución limpia está escrita: **que el cajón de F07 pregunte al de F08 al
      abrirse**, no un oyente cruzado sobre el clic del CTA.

### 9.6 · El sitio del cajón sobre el mapa ⟨juicio⟩

Lo que el guion mide (0 px² de solape con los cinco controles, el 20,8 % del
lienzo) dice que **cabe**. Si **estorba** es otra pregunta, y es la misma que el
7.6 bis le hace a la barra de edición.

- [ ] Con la parcela encuadrada: ¿el cajón tapa la geometría que hay que mirar
      mientras se decide si contrastar? Trae dos o tres parcelas distintas.
- [ ] Los dos cajones **se turnan en la misma esquina**. Con el recorrido
      completo (soltar → contrastar → diagnosticar), ¿se percibe que es el mismo
      sitio contando dos cosas distintas, o parece que uno «ha desaparecido»?
- [ ] El velo de arrastre cubre la ventana entera con el acento del sistema.
      ¿Ayuda, o tapa justo lo que se estaba mirando? Míralo también con el panel
      de avisos lleno.
- [ ] **Pantalla pequeña.** El cajón declara `min-width: min(300px, 42vw)` y a
      1440 × 900 mide 420 px. Ábrelo en un portátil de 900 px de alto y con la
      ventana estrecha: ¿sigue cabiendo, o se come el mapa entero?

### 9.7 · El presupuesto de altura, cuarta fase seguida ⟨comprobación⟩

El guion publica las cifras **sin juzgarlas** (regla de oro 9): la caja de
vértices arranca en **267 px** —los mismos que dejó F07, o sea que el botón
«Abrir un GML…» costó **0 px**, que era la Decisión 5—, **abrir el cajón no le
quita nada** (267 → 267 en el tick del `drop`) y tras contrastar baja a **222 px**
porque el renglón de procedencia pasa de vacío a **45 px** (tres líneas: ahora
cuenta dos procedencias, no una). Quien decide si eso basta es una persona.

- [ ] Con la parcela de un fichero cargada, ¿las ~9 filas que quedan bastan para
      trabajar una parcela de 15 vértices? Compáralo con lo que había antes de
      contrastar.
- [ ] **El renglón de procedencia doble ocupa tres líneas de 11 px.** ¿Se lee, o
      es un párrafo gris que nadie mira? Es el único sitio de la pantalla que dice
      que **la geometría no es del Catastro**, así que si no se lee, el error de
      producto de la fase sigue vivo aunque el texto sea correcto.
- [ ] Con el fichero del huso incoherente cargado y el panel de avisos con
      tarjetas: ¿aguanta la tabla?

---

## 10 · El informe firmable en PDF ⟨F09⟩ — lo que ni `11-informe-pdf.js` firma

**Por qué está aquí.** `11-informe-pdf.js` es el guion que más lejos llega de toda
la carpeta: es el **único** que mide un criterio de aceptación que la suite no
puede medir en absoluto (en jsdom no hay contexto 2D, así que el criterio 1 no
tiene dónde ejecutarse), y lo mide **con control negativo** —sin `crossOrigin` el
lienzo tiene que contaminarse y `toDataURL` tiene que lanzar—. Además afirma que
los bytes que bajan empiezan por `%PDF`, terminan en `%%EOF`, declaran 4 páginas y
llevan el plano dentro como imagen `/DCTDecode`; que componer no cierra el cajón
por debajo del modal; que el `<dialog>` está en la capa superior con el fondo
inerte; y el invariante de los 267 px. Cifras en `GUION.md` §17.

**Y aun así no puede firmar dos cosas, y las dos son de esta fase.** La primera es
que **el PDF ABRA**: este documento está escrito **a mano, byte a byte, sin
librería** (`report/pdf.js`, ~15 kB frente a los ~350 de jsPDF; fue la Decisión 1
de F09), y un guion solo puede mirar sus bytes. La segunda es **cómo se lee**: F09
pone en un papel que alguien va a firmar unas cifras sobre una finca y una
descripción de sus linderos, y «cómo se lee eso» no lo mide ninguna máquina.

⚠️ **Antes de nada, lee el §17 del `GUION.md`.** El guion sale hoy en `ok:true`,
pero su **primera** corrida salió `ok:false` — y esta vez **no era un defecto de
producción: era la MEDIDA**, y está contado allí porque la lección importa (medir
demasiado pronto es tan malo como medir demasiado tarde).

Para recorrerla, con la app viva: pulsa **«Diagnosticar encaje»** sobre la parcela
de demostración, mueve un vértice medio metro para que haya algo que ver, y de ahí
a **«Preparar informe (PDF)»** y **«Componer PDF»**. Cuesta **dos peticiones** al
Catastro (colindantes + descriptivos) y **una** al WMS por cada PDF que compongas
—~200 kB de plano a 300 ppp—, así que no compongas quince: régimen de uso en
`GUION.md` §13.

### 10.1 · ⛔ Abrir el PDF en TRES lectores distintos ⟨obligatorio⟩

**Por qué está aquí, y por qué no es una formalidad.** El escritor de PDF es
propio: `report/pdf.js` monta el `xref`, el `trailer`, los objetos, las fuentes
estándar, la codificación WinAnsi y el `/DCTDecode` **a mano**. Los visores son
notoriamente desiguales en lo que perdonan: Chrome reconstruye tablas de
referencias cruzadas rotas sin decir nada, Acrobat es el más estricto con el
`xref` y con los diccionarios de fuente, y los lectores ligeros son los que menos
heurísticas tienen. **Un PDF que abre en un solo lector no está escrito: está de
suerte.** La suite tiene snapshot de bytes, que garantiza que no cambian sin que
nadie se entere — no que sean correctos para un tercero.

- [ ] **Acrobat Reader** (el estricto). Que abra **sin diálogo de reparación** y
      sin advertencia de fichero dañado. Si repara, anótalo: reparar es abrir, pero
      no es estar bien.
- [ ] **El visor de PDF de Chrome** (el que va a usar la mayoría, porque es el que
      se abre solo al descargar).
- [ ] **Un lector ligero** (SumatraPDF, o el visor del sistema). Es el que menos
      perdona por tener menos código que adivine.
- [ ] En los tres: **las 4 páginas están**, la numeración corre, y **los acentos y
      la ñ se ven** («Diagnóstico», «Sudoeste», «línea quebrada», «número de
      colegiado»). La codificación es WinAnsi con las fuentes estándar, y ahí es
      donde se rompen los caracteres si algo va mal.
- [ ] **Buscar texto dentro del PDF** (`Ctrl+F`) y encontrar la referencia
      catastral. Si el texto no es buscable, el documento es una imagen con letras
      y no un documento.
- [ ] **Copiar y pegar** un párrafo del lindero a un editor: tiene que salir el
      texto, con sus acentos. Es lo que hará quien lo lleve a una escritura o a una
      instancia — y es, literalmente, el diferenciador que sostiene la fase.
- [ ] **Las propiedades del documento** (título, fecha de creación): que digan lo
      que tienen que decir y no «Untitled».

### 10.2 · El plano: ¿se lee? ⟨juicio⟩

El guion sabe que el plano entró (una imagen `/DCTDecode`, 194 kB de cartografía a
2126 × 1535 px) y que el `toDataURL` no lanzó. **No sabe si se ve nada.**

- [ ] **La parcela se reconoce sobre la cartografía catastral**: el contorno
      medido, el oficial y la diferencia entre los dos se distinguen a tamaño de
      papel, no ampliando al 400 %.
- [ ] **La escala gráfica**: ¿se lee su rótulo? ¿La barra tiene una longitud
      redonda (10 m, 20 m) o una cifra rara? El reparto lo decide
      `metrosDeBarra` y se puede ajustar sin tocar nada más.
- [ ] **El norte**: en UTM el norte de cuadrícula es +Y, o sea una flecha vertical.
      ¿Se entiende que es «norte de cuadrícula» y no norte geográfico? El rótulo lo
      dice; la pregunta es si alguien lo lee.
- [ ] **Las cotas de los lados**: ¿se pisan entre ellas en los lados cortos? En
      pantalla hay un umbral de píxeles que las esconde (F06); **en el plano del
      PDF no hay zoom que valga**, así que este es el único sitio donde se ve el
      resultado final.
- [ ] **Los números de vértice**: ¿se leen sobre la ortofoto oscura y sobre el
      asfalto claro? El halo es lo único que los sostiene.
- [ ] **El pie de atribución** del plano: está por obligación de licencia. ¿Está, y
      se lee?
- [ ] Con la parcela de **`?demo=hueco`** (dos recintos): ¿el hueco se entiende
      como hueco, o parece un error de dibujo?

### 10.3 · En papel ⟨juicio — no hay forma de automatizarlo⟩

- [ ] **Imprímelo en A4.** ¿Los márgenes de la impresora se comen algo? El
      documento se maqueta a 15 mm por lado y el plano ocupa los 180 mm útiles: es
      justo el ancho donde una impresora con márgenes generosos recorta.
- [ ] **En blanco y negro.** El gris de la diferencia y el ámbar de la invasión
      salen los dos grises. ¿Se sigue distinguiendo lo que dice el texto, o el
      plano se vuelve ilegible sin color? Si se vuelve ilegible, la salida no es
      quitar el color: es que el texto no dependa de él.
- [ ] **Firmado a mano encima del pie de firma**: ¿queda sitio? El pie imprime
      cuatro campos y «No consta» donde falte alguno; lo que no imprime es un
      espacio para la rúbrica.

### 10.4 · Lo que no se puede provocar desde el guion ⟨regla de oro 1⟩

**Por qué está aquí.** `/browse` no tiene modo offline ni interceptación de red
(§9 del GUION), así que la degradación del plano **no se puede provocar** desde el
guion. Y es la decisión de producto más delicada de la fase: si el WMS no
contesta, **el informe se compone igual, sin plano**, y se dice por **tres
canales** —el renglón del diálogo, el panel de avisos y **el propio PDF**—. El
tercero es el que importa: es el único que sobrevive a que alguien reenvíe el
fichero.

- [ ] **Modo avión** (o «Offline» en la pestaña Network de las DevTools) y
      «Componer PDF». Tiene que bajar un PDF **sin plano**, y el PDF tiene que
      **decirlo en su sitio**, no en una nota al pie que nadie lee. Ábrelo: ¿alguien
      que reciba ese fichero por correo se entera de que le falta el plano?
- [ ] ¿El renglón del diálogo y la tarjeta del panel dicen lo mismo, o se
      contradicen?
- [ ] Con la red cortada **a mitad de la composición**: el diálogo no se queda
      colgado, el botón se vuelve a encender y se puede reintentar.
- [ ] **Una sola capa caída** no es lo mismo que el plano caído: `componerPlano`
      apaga la capa que no sirva y lo anota bajo el plano. No hay forma cómoda de
      provocarlo; si alguna vez sale, mira que el aviso **nombre la capa**.

### 10.5 · ⛔ EL PUNTO BLOQUEANTE: ¿alguna frase se lee como un VEREDICTO? ⟨regla de oro 9⟩

**Hereda el carácter del 8.1 y del 9.4, y sube la apuesta.** En F07 el sujeto era
una parcela; en F08, el trabajo de otro técnico; **aquí es un papel que alguien
firma y entrega**. El guardián mecánico ya existe —hay un vocabulario prohibido en
`report/contraste-texto.js` y otro en `test/app/dialogo-informe.dom.test.js`, y el
guion publica el borrador del lindero entero para que se pueda leer—. Esto es lo
que queda, y no lo automatiza nadie: **la LECTURA**.

Léelo en voz alta, con el PDF impreso delante y en el papel de quien lo va a
firmar:

- [ ] El **titular** y el nombre legal: «Informe de contraste con el parcelario
      catastral». ¿Alguien lo parafrasea como «el informe de que la parcela está
      bien»? Si la paráfrasis natural es un dictamen, el texto no está haciendo su
      trabajo.
- [ ] ¿Se entiende que **esto no es la VGA ni el IVG**? Son un procedimiento y un
      documento **oficiales del Catastro, con código seguro de verificación**, y el
      desmentido está escrito arriba del todo — en el diálogo y en el PDF. La
      pregunta no es si está: es si **se lee antes** de teclear el número de
      colegiado, o después.
- [ ] La **tabla a tres bandas**: ¿los signos se entienden («−» = medimos menos)?
      ¿Alguna cifra parece un aprobado o un suspenso?
- [ ] ⛔ **LA PRESUNCIÓN DE VÍA PÚBLICA.** Es **el único sitio de toda la
      aplicación donde se PROPONE en vez de medir**, y está en el párrafo más
      copiable del documento: *«Linda al Noroeste, en línea quebrada de 9 lados que
      suman 47,21 m, presumiblemente con vía pública (ninguna parcela catastral
      colindante alcanza este lindero; dato NO verificado, confirme antes de
      firmar)»*. Preguntas, y las tres tienen que salir bien:
      - Con el PDF impreso y **sin haber visto el diálogo**, ¿se entiende que ese
        tramo **no está medido** y los otros tres sí? ¿O los cuatro se leen igual?
      - El paréntesis con el desmentido es lo único que lo distingue. **¿Qué pasa
        si alguien lo borra al maquetar?** El cuadro de edición está para
        reescribir el texto, así que va a pasar. La aplicación lo previó —la
        advertencia vive en el DATO (`tramos[].presuncionNoVerificada`) y no en la
        cadena—, pero **lo que se imprime es lo que quede escrito**. ¿Basta con
        eso, o el PDF debería marcar el tramo también fuera del párrafo?
      - La **nota técnica** final lo explica otra vez, y con todas las letras
        («Esta aplicación no ha consultado el callejero ni el inventario de bienes
        de dominio público: quien firma tiene que comprobarlo»). ¿Se lee, o es el
        párrafo gris del final que nadie mira?
- [ ] El **acuse** del diálogo dice «He repasado los tramos de arriba», no «He
      verificado». ¿Se entiende la diferencia? La aplicación mide y el colegiado
      firma; pedirle que jure algo sería invertir esa frase.
- [ ] El **pie de firma**: los rótulos no presuponen titulación y **no hay ningún
      desplegable de profesiones**, a propósito (quién puede firmar qué está en
      disputa jurídica). Léelos: ¿alguno insinúa una profesión? ¿«Colegio» como
      campo libre desconcierta, o se agradece?
- [ ] Y la pregunta de cierre, la misma de F07 y F08: **enséñaselo a alguien que no
      haya visto la app** y pregúntale qué dice el documento. Si la respuesta
      empieza por «que está bien» o «que está mal», **la fase no se cierra**.

### 10.6 · El diálogo, con teclado y con ojos ⟨juicio⟩

El guion mide que es un modal de verdad (capa superior, fondo inerte, `Escape`,
foco dentro) y que **tapa el 59,5 % del lienzo** —a propósito: esto no anota la
cartografía, prepara un documento (Decisión 3 de F09, que rompe la norma «nada de
modales» de F08 conscientemente)—. Lo que no puede decir es si se trabaja bien
dentro.

- [ ] **Tabula el formulario entero** con un teclado de verdad, de arriba abajo:
      encabezado → cuadro del lindero → «Regenerar» → firma → «Componer PDF». ¿El
      anillo de foco se ve en los tres tipos de control (`input`, `textarea`,
      `checkbox`)? ¿Se puede componer el PDF **sin ratón**?
      ⚠️ El guion **no** mide el ciclo de tabulación: mide su consecuencia (el
      fondo queda inerte). `app/dialogo-informe.js` declara por escrito que **no
      reimplementa el atrape de foco** porque cuenta con la capa superior. Este es
      el sitio donde se comprueba que esa apuesta era buena.
- [ ] **`Escape`** cierra el diálogo y **no** cierra el cajón de debajo — eso lo
      mide el guion. Lo que aquí se mira es si **sorprende**: cerrar **no borra
      nada** y volver a abrir devuelve lo tecleado, pero desde fuera un modal que
      desaparece se lee como «he perdido lo que había escrito». ¿Se nota que no?
- [ ] **El formulario no cabe entero** (1.336 px de contenido en 790 de caja): hay
      que hacer scroll. ¿Se ve que hay más abajo, o «Componer PDF» parece no
      existir hasta que alguien rueda? Es el botón primario de la fase.
- [ ] **Reescribe el lindero entero** y pulsa «Regenerar el borrador»: se pierde lo
      escrito, y lo avisa después de hacerlo. ¿Es el orden correcto, o hacía falta
      preguntar antes?
- [ ] **Deja campos del pie de firma en blanco.** Se imprimen como «No consta».
      ¿Se entiende antes de componer, o sorprende al abrir el PDF?
- [ ] **La casilla «Recordar»**: márcala, compón, cierra el navegador, vuelve.
      ¿Están los datos? Desmárcala y compón: **tienen que borrarse**.
- [ ] **En un portátil de 900 px de alto y con la ventana estrecha**: el diálogo
      declara `min(760px, 100vw − 2·space)` y `max-height: min(88vh, 900px)`.
      ¿Sigue siendo usable, o hay que rodar por todo?

### 10.7 · El presupuesto de altura, cuarta fase seguida ⟨comprobación⟩

F09 prometió **coste 0 px en el panel** porque su interfaz es un modal y dos
botones dentro del cajón, y el guion lo confirma: `perdidaImputableAlDialogoPx: 0`.

Pero la primera corrida sacó a la luz una cifra que **no estaba medida y que sí es
de mirar**: pedir el diagnóstico deja la caja de vértices en **234 px**, porque el
renglón de colindantes **de F05** crece a dos líneas y se lleva **33 px**. No es un
defecto —es la regla de oro 1 funcionando— pero es alto real que desaparece.

- [ ] Con el diagnóstico pedido y las 4 colindantes traídas, ¿las **~9 filas** que
      quedan bastan para trabajar una parcela de 15 vértices? Compáralo con las
      ~11 de antes de pedirlo.
- [ ] El renglón «El Catastro ha devuelto 4 colindantes de la parcela …» se queda
      puesto para siempre. **¿Sigue aportando algo diez minutos después**, o es un
      acuse de recibo caducado ocupando dos líneas del sitio más caro del panel?
      Si es lo segundo, la salida no es quitarlo: es que caduque.

---

## 11 · Persistencia y exportación ⟨F10⟩ — lo que ni `12-expedientes.js` firma

**Por qué está aquí.** `12-expedientes.js` es el guion más barato de la carpeta —no
toca la red ni una vez— y aun así es el que cierra el hueco más grande que ha
tenido nunca esta suite: **toda la de F10 corre sobre `fake-indexeddb`, que no es
una base de datos**, sino una implementación en memoria que muere con el proceso.
El guion mide la supervivencia a una **recarga** de verdad —comparando la marca de
tiempo del registro contra `performance.timeOrigin`, para que lanzarlo dos veces sin
recargar no dé un falso positivo—, lee los bytes por una **segunda conexión** a
IndexedDB, y afirma sobre los tres ficheros que bajan: `$ACADVER = AC1015` y las dos
capas **en la TABLA**, coma decimal en el listado, y el sobre
`concreta-gml/proyecto` con sus 15 vértices. Cifras en `GUION.md` §18.

**Y aun así no puede firmar cinco cosas.** Cuatro son de entorno —cerrar el
navegador, dos pestañas, abrir un fichero del disco, y abrir un DXF en un CAD— y la
quinta es de lectura, que no la mide ninguna máquina.

⚠️ **Antes de nada, lee el §18 del `GUION.md`.** El guion sale hoy en `ok:true`,
pero su primera corrida con un expediente ya guardado destapó **un defecto real de
producción** (un aviso del arranque que le quitaba 52 px a la caja de vértices, en
cada carga y para siempre) y, de paso, un falso positivo de su propia
instrumentación. Los dos están contados allí porque las dos lecciones importan.

Para recorrer esta lista, con la app viva: abre **«Expediente»** en la fila
«Origen de la parcela», guarda el trabajo con un nombre, exporta los tres ficheros
y recupera lo guardado. **Cuesta cero peticiones al Catastro**, así que aquí no hay
régimen de red que respetar (§13): repítela las veces que haga falta.

### 11.1 · ⛔ Cerrar el NAVEGADOR entero, no la pestaña ⟨obligatorio⟩

**Por qué está aquí, y por qué no es lo mismo que recargar.** El guion mide que un
expediente sobrevive a `$B reload`, que es volver a cargar el documento con el
proceso del navegador vivo. Lo que F10 promete es otra cosa: que el trabajo siga ahí
**mañana**. Entre las dos hay un mecanismo que ninguna máquina de este proyecto
puede provocar: el **desalojo** que el navegador hace por su cuenta cuando le falta
espacio, y que `navigator.storage.persist()` existe para evitar. Está MEDIDO que
`persist()` devuelve `false` en un perfil sin interacción previa —la ficha de F10
prometía que «evita el desalojo» y no lo evita—, así que esto es exactamente lo que
hay que ver con el ordenador delante.

- [ ] Guarda un expediente con un nombre reconocible. **Cierra el navegador
      entero** (no la pestaña: el proceso). Vuelve a abrirlo, entra en la app y abre
      «Expediente». ¿Está?
- [ ] ¿Y la geometría es la que era? Recupéralo y compara la superficie del pie con
      la que tenía.
- [ ] **Marca la página como favorita** (o instálala como aplicación) y repite. En
      DevTools → Application → Storage, ¿pone «Persistent» ahora? Si sí, apúntalo:
      es el único camino conocido para que `persist()` devuelva `true`, y ninguna
      máquina de este proyecto lo ha medido todavía.
- [ ] ⚠️ En **ventana privada / incógnito**: ¿la app dice que no puede guardar, o se
      queda callada? La regla de oro 1 exige que lo diga —y el mensaje existe
      (`storage/expedientes.js`, «Los expedientes no se pueden guardar en este
      navegador…»)—, pero **que ese camino se recorra de verdad solo se ve aquí**.

### 11.2 · Dos pestañas a la vez, y el `versionchange`

**Por qué está aquí.** `storage/bd.js` dejó anotado desde F05 el gancho de
`versionchange` «para F10», y F10 lo resolvió: la pestaña vieja cierra su conexión y
lo dice. En la fase 0 se provocó con **dos conexiones de la misma pestaña**, que es
lo más parecido que se puede hacer sin abrir dos de verdad.

- [ ] Abre la app en **dos pestañas**. Guarda un expediente en la primera. En la
      segunda, abre «Expediente»: ¿aparece? (Puede que no hasta reabrir el diálogo:
      no hay canal entre pestañas, y eso **no es un defecto** — es alcance que F10
      no abrió. Lo que sí sería defecto es que una pestaña **pisara** el trabajo de
      la otra sin decirlo.)
- [ ] Con las dos abiertas, edita en una y en la otra. **El borrador es UN registro
      con clave reservada**: la última que escriba gana. ¿Se nota? ¿Molesta?
      Anótalo: si molesta, la salida no es un candado, es que el borrador sepa de
      qué pestaña viene.
- [ ] Con las dos abiertas, fuerza una subida de versión (hoy no hay ninguna
      pendiente; se puede simular editando `MIGRACIONES` en local). ¿La pestaña
      vieja **dice** que se ha cerrado, o se queda muda hasta que algo falla?

### 11.3 · Recuperar, duplicar y **borrar**, con el ratón

**Por qué está aquí.** El guion pulsa los botones con `el.click()`, que no es un
gesto de ratón (§0). Y borrar es **irreversible**: el diálogo no tiene pantalla de
confirmación, así que la confirmación la pone el cableado en **dos tiempos** —el
primer clic arma y lo escribe en el renglón, el segundo borra, y un clic en otra
fila desarma—. ⚠️ **El rótulo del botón sigue diciendo «Borrar» mientras está
armado**, porque el marcado de la fila es del diálogo: es una limitación declarada y
esto es justo lo que hay que juzgar.

- [ ] Guarda dos expedientes. **Recupera** el primero: ¿cambia el mapa, la tabla y
      la ficha del pie? ¿El renglón de edición dice que el historial empieza de cero?
- [ ] **Duplica** uno: ¿aparece con «(copia)»? ¿El original sigue intacto?
- [ ] **Borra** uno con el ratón. Al primer clic, ¿**te enteras** de que hay que
      volver a pulsar? Lee el renglón: está debajo, en `role="status"`. **Si no te
      enteras, es un defecto** — un botón que parece no hacer nada es peor que uno
      que borra.
- [ ] Pulsa «Borrar» en una fila y luego «Borrar» en **otra**: ¿no se borra ninguna?
- [ ] Deja pasar más de cinco segundos entre los dos clics: ¿vuelve a armar en vez
      de borrar?
- [ ] ⚠️ **Juicio**: ¿te parece suficiente confirmación para una acción que se lleva
      el trabajo de una tarde? Si no, la salida no es quitar el botón: es que la
      fila lo diga (cambiar el rótulo a «¿Seguro?»), y eso es tocar
      `app/dialogo-expediente.js`.

### 11.4 · ⛔ Abrir el DXF en un CAD de verdad ⟨BLOQUEANTE⟩

**Por qué es bloqueante, y es el mismo argumento que el PDF en tres lectores del
§10.1.** En la fase 0 se escribió el DXF **exactamente como manda el override O12**
—sin los dos marcadores de subclase— y `ezdxf` lanzó `DXFStructureError`: el fichero
**no abría en ninguna parte**. Y `parsers/dxf.js`, nuestro propio lector, lo leyó tan
feliz: 2 anillos, coordenadas exactas, cero detecciones. O sea que **la prueba de
ida y vuelta habría salido verde con un DXF que no abre**. El oráculo de la suite es
`ezdxf`, que corre fuera; pero ezdxf tampoco es AutoCAD.

**Un DXF que valida contra nuestro parser y no abre en AutoCAD no está exportado:
está de suerte.** Esto no lo firma ninguna máquina de este proyecto (en este equipo
no hay `acad.exe`).

- [ ] Exporta el DXF y **ábrelo en un CAD** (AutoCAD, BricsCAD, LibreCAD,
      QCAD… apunta cuál).
- [ ] ¿Aparecen **las dos capas** en el árbol de capas, con sus nombres
      `PARCELA_OFICIAL` y `PARCELA_EDITADA`?
- [ ] ⭐ ¿Se pueden **seleccionar por capa** —apagar una y que desaparezca solo su
      contorno—? Es lo que pide el criterio 3, y es el punto entero del formato:
      llevar la oficial junto a la editada **para poder compararlas**.
- [ ] ¿Los dos contornos salen **cerrados**? (Emitimos `70=1` sin repetir el primer
      vértice; los DXF reales del repo hacen lo contrario y `ezdxf` lee los nuestros
      como `closed=True`.)
- [ ] Mide un lado en el CAD y compáralo con la tabla de vértices de la app:
      **¿coinciden los dos decimales?** (Es la misma constante que redondea el GML.)
- [ ] ¿El auditor del CAD dice algo? (En AutoCAD, `AUDIT`.) Apunta lo que salga,
      aunque «arregle» cosas sin quejarse: eso es exactamente lo que hay que saber.

### 11.5 · El fichero de proyecto, en **otro** perfil o en otra máquina

**Por qué está aquí.** Sin backend y sin cuentas, IndexedDB es una caja fuerte **sin
puerta**: borrar los datos del sitio se lo lleva todo y no hay forma de mandarle el
expediente a un compañero. El `.json` es esa puerta —y es alcance NUEVO, que no
estaba en la ficha, ni en `SPEC.md`, ni en el dossier—. El guion no puede probarlo
porque el selector de ficheros del sistema no se conduce desde `/browse`.

- [ ] Exporta el proyecto. **Arrastra el `.json` sobre la ventana**: ¿entra? ¿Dice
      por el panel que se ha abierto y que **todavía no está guardado** en este
      navegador?
- [ ] Prueba también con **«Abrir un proyecto…»** desde el diálogo: ¿abre el mismo
      selector de ficheros que «Abrir un GML…»? (Es la misma zona a propósito: dos
      zonas engancharían las dos el `drop` de la ventana entera.)
- [ ] ⭐ Ábrelo en **otro perfil del navegador, o en otra máquina**. ¿Sale la misma
      geometría, la misma referencia y el mismo huso?
- [ ] Arrastra un **`.gml`** y un **`.json`** en la misma sesión: ¿cada uno va a lo
      suyo? ¿El velo de arrastre dice «(.gml, .xml o .json)»?
- [ ] Ábrelo con un editor de texto. ¿Se entiende qué es? ¿Lleva el `formato` y la
      `version` a la vista, arriba?
- [ ] Rompe el fichero a mano (bórrale una llave) y ábrelo: **¿dice qué le pasa, o
      se queda callado?** Es la lección de F08 entera.

### 11.6 · ⛔ Cómo se lee la lista de expedientes ⟨BLOQUEANTE⟩

**Por qué es bloqueante, y hereda el carácter del 8.1, el 9.4 y el 10.5.** La regla
de oro 9 dice que la aplicación **mide** y el colegiado **interpreta y firma**. Esta
pantalla es nueva y escribe bastante texto: nombres, antigüedades, motivos de
botones apagados, avisos de durabilidad y una lista de «lo que NO se guarda».

- [ ] Lee la lista entera con ojos de técnico que no ha escrito el código. ¿Alguna
      frase **se lee como un veredicto** sobre la parcela, sobre el trabajo o sobre
      lo que hay que hacer?
- [ ] El bloque **«Lo que NO se guarda»**: ¿se entiende que el historial de deshacer,
      las colindantes, el diagnóstico y el pie de firma **no viajan**? ¿O parece
      letra pequeña?
- [ ] El aviso de durabilidad («Esto se guarda en este navegador y en este equipo,
      no en ningún servidor…»): ¿asusta de más, o de menos? Está pensado para decir
      **qué pasa y qué puede hacer el usuario**, sin dramatizar.
- [ ] La oferta del borrador al arrancar: ¿queda claro que **no se ha tocado nada**?
      ¿Se encuentra el botón «Expediente» con esa indicación?
- [ ] Las antigüedades («hace 6 días», «ahora»): ¿alguna se lee mal? (Las escribe
      `Intl.RelativeTimeFormat`, compartida con el renglón de procedencia de F05.)
- [ ] ⚠️ El acuse de guardado dice «**El navegador no garantiza conservarlo**…».
      ¿Lo lees como una advertencia útil o como ruido en cada guardado? Si es lo
      segundo, apúntalo: es la tercera vez que este proyecto tiene que decidir dónde
      cabe una verdad incómoda sin que estorbe.

### 11.7 · Juicio visual del diálogo y de la fila del rótulo

- [ ] La fila «Origen de la parcela» tiene ahora **dos botones**. ¿Se lee bien?
      ¿«Expediente» se entiende, o suena a algo administrativo que no es?
- [ ] ⚠️ **Quedan 21 px de holgura** antes de que la fila se parta en dos líneas
      (8 de ellos son el `gap`). Prueba a **estrechar la ventana**: ¿a qué anchura
      se parte? Cuando se parta, ¿pierde la caja de vértices los ~36 px?
- [ ] Abre el diálogo. ¿Tapa el mapa? (Sí, es un modal: eso es a propósito.) ¿Se
      llega a todos los controles sin que la ventana haga scroll horizontal?
- [ ] Con el teclado: `Tab` desde el botón, ¿aterriza dentro? `Escape`, ¿cierra y
      **devuelve el foco** al botón? ¿Se puede llegar a «Borrar» de una fila sin
      ratón?
- [ ] Con el zoom del navegador al **200 %**: ¿sigue cabiendo el diálogo?
- [ ] Con **«movimiento reducido»** activado en el sistema: ¿aparece sin animación?

---

## Qué hacer con el resultado

- **Todo conforme** → F03 se marca hecha (`README.md` §Estado y `spec/SPEC.md`).
- **Algo del punto 1, 2 o 3 falla** → es un defecto real del visor. Protocolo del
  plan: **no se parchea desde la app ni desde el test**; se abre tarea con
  propiedad exclusiva del módulo de `viewer/` y de su test unitario.
- **Algo del punto 4 o 5 no gusta** → es ajuste de presentación, vive en
  `estilos/app.css` o en una opción de `crearVisor`, y no bloquea F03.
- **Algo del punto 6.2 falla** → es un defecto real de F05 y bloquea: la regla de
  oro 1 dice que ningún error es silencioso, y ahí es donde se comprueba. Se
  arregla en `app/cableado-catastro.js` o en `services/`, no en la pantalla.
- **Algo del 6.1, 6.3, 6.4 o 6.5 no convence** → es redacción o producto. Se
  anota, se decide, y no bloquea F05: la mecánica ya está medida por
  `07-catastro-vivo.js`.
- **`Alt` no llega (7.2)** → **bloquea F06**, y no es cosmético: es la tecla
  modificadora que pide el criterio 2 y `viewer/edicion.js` ya descartó `Ctrl` y
  `Shift` por colisión con Leaflet. Si el navegador o Windows se la quedan, hay
  que decidir otro modificador o dar por buena la casilla como única vía — y eso
  se decide con el dato delante, no antes.
- **Algo del 7.1 o del 7.7 falla** → es un defecto real de la edición. Mismo
  protocolo que el punto 1: se abre tarea con propiedad exclusiva del módulo de
  `edit/` o de `viewer/` y de su test, nunca un parche desde la app.
- **Algo del 7.3, 7.4, 7.5, 7.6 o 7.6 bis no convence** → es presentación,
  redacción o producto. Se anota y se decide; **no bloquea F06**, porque la mecánica
  ya está medida por `08-edicion.js`. El 7.3 se corrige sin tocar código
  (`config/operativos.json#acotacionMinimaPx`); el 7.6 y casi todo el 7.6 bis, en
  `estilos/app.css`, y la esquina de la barra es la opción `edicion.posicionBarra`
  de `crearVisor`.
- **El conmutador del ajuste no se lee encendido (7.6 bis)** → eso sí **bloquea**, y
  no es presentación: si no se sabe si el enganche está activo, no se sabe si el
  vértice que se acaba de soltar cayó donde se ve o donde enganchó. Es la regla de
  oro 1. Se arregla en `estilos/app.css`, sobre `.gml-barra-conmutador`.
- **Algo se lee como un veredicto (8.1)** → **bloquea F07**, y es EL punto de la
  fase: la regla de oro 9 no se cumple con no escribir «apta» — se cumple cuando
  nadie LEE un apta donde no lo hay. La salida no es quitar la cifra: es rotularla
  mejor (los textos viven en `viewer/cajon-diagnostico.js` y
  `viewer/contraste.js`; la etiqueta del margen, en `diagnostico/margen.js` y es
  literal de la spec).
- **Algo del 8.2, 8.3 o 8.4 no convence** → es presentación o producto. Se anota
  y se decide; **no bloquea F07**: el mecanismo ya está medido por
  `09-diagnostico.js`. Los tonos y opacidades viven en `viewer/contraste.js`
  (constantes con su porqué) y el cromo del cajón en `estilos/app.css`; la esquina
  es la opción `diagnostico.posicion` de `crearVisor`.
- **Algo del 9.1 falla** → **bloquea F08**, y es un defecto real de la entrada por
  fichero: es la única vía de entrada que la fase estrena, y el guion solo puede
  sintetizarla. Mismo protocolo que el punto 1: se arregla en
  **`app/zona-fichero.js`** (y su test `.dom`), con propiedad exclusiva del
  módulo — nunca un parche desde `app/cableado-comprobacion.js`. Si lo que falla
  es el teclado sobre «Abrir un GML…», el dueño es el mismo módulo (el `<button>`
  vive en `index.html`, pero quien lo cablea al input es él).
- **Algo del 9.2, 9.3, 9.6 o 9.7 no convence** → es redacción, presentación o
  producto. Se anota y se decide; **no bloquea F08**, porque la mecánica ya está
  medida por `10-comprobar-gml.js`. Los textos del cajón viven en
  **`viewer/cajon-comprobacion.js`**; los de las notas y los hallazgos, en
  **`comprobacion/_comun.js`** (el catálogo `TIPO_COMPROBACION`) y en
  `gml/_comun.js#TIPO_GML`; el cromo del cajón y el velo, en **`estilos/app.css`**
  (tramo de F08); el renglón de procedencia doble, en
  **`app/cableado-comprobacion.js#textoProcedenciaDoble`**; y la esquina del
  cajón, en la opción `comprobacion` de `crearVisor`.
- **Algo del 9.4 se lee como un veredicto** → **BLOQUEA F08**, y es EL punto de la
  fase, igual que el 8.1 lo era de F07. Aquí el sujeto no es una parcela: es el
  trabajo de otro técnico con nombre. La regla de oro 9 no se cumple con no
  escribir «apta» — se cumple cuando nadie LEE un apta donde no lo hay. La salida
  no es quitar la nota (regla de oro 1: se dice todo): es **rotularla mejor**. Los
  textos están en **`comprobacion/_comun.js`**, **`viewer/cajon-comprobacion.js`**
  y **`report/contraste-texto.js`**; los mensajes del recorrido, en
  **`app/cableado-comprobacion.js`**.
- **El 9.5 (la tercera vía) molesta de verdad** → **no bloquea**: está declarado
  por escrito desde T4.1 y los otros dos caminos sí están blindados. Si se decide
  arreglar, la solución limpia está escrita y es **que el cajón de F07 pregunte al
  de F08 al abrirse** (`viewer/cajon-diagnostico.js`), NO un oyente cruzado sobre
  el clic del CTA: ese cable se rompe en silencio.
- **Los dos defectos que `10-comprobar-gml.js` ya destapó** (`GUION.md` §16) no se
  vuelven a levantar aquí: están medidos. El de la tipografía es presentación y
  **no bloquea**; el de la descarga cerrando el cajón de diagnóstico **sí**, porque
  la confirmación de que el fichero ha bajado se escribe donde nadie puede leerla
  —regla de oro 1— y se corrige en `viewer/cajon-diagnostico.js` o en
  `gml/descargar.js`.
- **Los TRES que encontró esta lista** (encabezado del punto 9) tampoco se vuelven
  a levantar: los mide el guion desde el 2026-08-02. Si alguno **reaparece**, es
  regresión y **bloquea**, porque los tres son la regla de oro 1 —«la app hizo el
  trabajo y no lo enseñó»— en tres sitios distintos. Dueños: el reencuadre,
  `viewer/index.js` (paso 7); las vecinas, `viewer/colindantes.js` más su pane en
  `viewer/_comun.js#PANES` y el suscriptor de `app/main.js`; el campo,
  `app/cableado-comprobacion.js`. **Nunca un parche desde otra capa**: es el mismo
  protocolo del punto 1.
- **El PDF no abre en alguno de los tres lectores (10.1)** → **BLOQUEA F09**, sin
  matices y sin «pero en Chrome se ve». El escritor es propio y a mano; un
  documento que depende de las heurísticas de reparación de un visor concreto no
  es entregable a un cliente ni a una administración. Se arregla en
  **`report/pdf.js`** (el `xref`, el `trailer`, los diccionarios de fuente, el
  `/DCTDecode`) con propiedad exclusiva del módulo y **con un caso nuevo en
  `test/report/pdf.test.js`**, que tiene snapshot de bytes: si el arreglo cambia el
  fichero, el snapshot lo dirá.
- **Algo del 10.2, 10.3 o 10.6 no convence** → es presentación o producto. Se anota
  y se decide; **no bloquea F09**, porque el mecanismo ya está medido por
  `11-informe-pdf.js`. El cromo del plano vive en `report/canvas.js`
  (`COLORES_PLANO`, `MEDIDAS_MM`, `metrosDeBarra`), la maqueta y sus márgenes en
  `report/pdf-parcela.js`, y el diálogo en `estilos/app.css` (tramo de F09) — el
  tamaño del plano son `ANCHO_PLANO_MM` / `ALTO_PLANO_MM` de
  `app/cableado-informe.js` y cambiarlos no toca ni una línea de dibujo.
- **Algo del 10.4 falla** → **bloquea**, y es la regla de oro 1 en su versión más
  cara: un informe **sin plano que no diga que le falta** es un documento que
  miente sobre sí mismo, y sobrevive a que alguien lo reenvíe. Se arregla en
  **`app/cableado-informe.js`** (los tres canales) o en
  **`report/pdf-parcela.js`** (lo que el PDF declara de sí mismo), nunca
  cancelando la composición: degradar no es quitar.
- **Algo del 10.5 se lee como un veredicto** → **BLOQUEA F09**, y es EL punto de la
  fase, igual que el 8.1 lo era de F07 y el 9.4 de F08. Aquí el sujeto es un papel
  que alguien firma y entrega a un tercero. **Y con mención expresa a la presunción
  de vía pública**: es el único sitio de toda la aplicación donde se PROPONE en vez
  de medir, así que es el único sitio donde una lectura descuidada convierte una
  hipótesis en un hecho firmado. La salida no es quitar la presunción —es útil y
  está razonada— ni quitar la cifra: es **rotularla mejor**. Los textos viven en
  **`report/literal.js`** (el párrafo y su `PRESUNCION`),
  **`app/dialogo-informe.js`** (el bloque de advertencia y el acuse) y
  **`report/pdf-parcela.js`** / **`report/firma.js`** (lo que se imprime).
- **El 10.7 (los 33 px del renglón de colindantes)** → **no bloquea**: es de F05,
  está medido y la caja sigue en 234 px, muy por encima del umbral de 220. Si se
  decide que el acuse caduque, el dueño es `app/cableado-catastro.js`.
- **Algo del 11.1 falla** → **BLOQUEA F10**, y es la fase entera: si un expediente
  no sobrevive a cerrar el navegador, F10 no ha hecho lo que promete. Ojo a la
  atribución antes de abrir tarea: **que el navegador DESALOJE no es un defecto de
  la aplicación** —`persist()` devuelve `false` y está medido—, así que lo primero
  es mirar si el perfil tenía la página marcada. Lo que sí sería defecto nuestro es
  que la app **no lo dijera**: el aviso existe (`storage/cuota.js#AVISO_SIN_PERSISTENCIA`)
  y el acuse de cada guardado lo repite. Si lo que falla es la escritura, el dueño
  es **`storage/expedientes.js`** (y su test), nunca un parche desde el cableado.
- **Algo del 11.4 falla** → **BLOQUEA F10**, y es el criterio de aceptación 3 en la
  mitad que ninguna máquina de este proyecto puede firmar. **Está medido que nuestro
  propio parser aprueba ficheros que ningún CAD abre** (fase 0), así que aquí un «no
  abre» manda sobre toda la suite. El dueño es **`export/dxf.js`**, y el arreglo va
  con su snapshot de bytes actualizado y pasado por `ezdxf` — nunca aflojando el
  test. Si lo que falla es que las capas no se pueden seleccionar por separado, mira
  primero la sección `TABLES`: sin ella el auditor da 0 errores y las capas **no
  existen**.
- **Algo del 11.2, 11.3 o 11.5 no convence** → es producto o presentación, y **no
  bloquea F10**: la mecánica ya está medida por `12-expedientes.js` y por la suite.
  La confirmación en dos tiempos del borrado vive en
  **`app/cableado-expediente.js#MS_CONFIRMAR_BORRADO`**; si se decide que la fila
  cambie de rótulo al armarse, el dueño es **`app/dialogo-expediente.js`**. El
  enrutado por extensión de la zona de fichero está en
  **`app/cableado-comprobacion.js#entradasExtra`** — y ⚠️ **no se arregla
  instanciando una segunda `crearZonaFichero`**: engancha el arrastre en la ventana
  entera y las dos se pisarían.
- **Algo del 11.6 se lee como un veredicto** → **BLOQUEA F10**, y hereda el carácter
  del 8.1, el 9.4 y el 10.5. Aquí el sujeto es más modesto —una lista de trabajos
  guardados— pero la regla es la misma: la app mide y el colegiado firma. Los textos
  viven en **`app/dialogo-expediente.js`** (la intro, los motivos de los botones
  apagados y el bloque «Lo que NO se guarda»), en
  **`storage/expedientes.js`** (`NO_SE_GUARDA`, `AVISO_DURABILIDAD`) y en
  **`app/cableado-expediente.js`** (los acuses). La salida no es callar: es rotular
  mejor.
- **El 11.7 (los 21 px de holgura de la fila del rótulo)** → **no bloquea**, pero se
  anota: es el margen que le queda a la decisión de «coste 0 px» antes de que la
  fila se parta y cueste ~36 px. Si hace falta un tercer botón ahí, **no cabe**, y
  esa conversación es de diseño, no de código.

## Cuándo repetir esta lista

Con el smoke automático (`GUION.md` §8): en **F06**, cuando cambie la maquinaria
de arrastre —el punto 1 es exactamente lo que F06 reescribe—, y en **F16**, sobre
la URL desplegada, cuando `base` cambie para GitHub Pages.

El punto **6** se repite cuando cambien `services/catastro.js`,
`app/cableado-catastro.js`, los textos de `RESUMEN_POR_MOTIVO` o el bloque de F05
de `index.html` — los mismos disparadores que `07-catastro-vivo.js` (`GUION.md`
§8), porque los dos cubren mitades de lo mismo. Y el **6.7**, cada vez que se
publique: el CORS que importa es el del origen desde el que trabaja la gente.

El punto **8** se repite cuando cambien los textos o los colores del diagnóstico
(`viewer/cajon-diagnostico.js`, `viewer/contraste.js`, la etiqueta de
`diagnostico/margen.js`) — el 8.1 es sobre la LECTURA, y la lectura cambia con
cada palabra. Los disparadores del mecanismo son los de `09-diagnostico.js`
(`GUION.md` §15).

El punto **9** se repite cuando cambien los textos del cajón de comprobación
(`viewer/cajon-comprobacion.js`), el catálogo de notas y hallazgos
(`comprobacion/_comun.js`, `gml/_comun.js#TIPO_GML`), el renglón de procedencia
doble (`app/cableado-comprobacion.js`) o el informe
(`report/contraste-texto.js`) — el 9.3 y el 9.4 son sobre la LECTURA, y la
lectura cambia con cada palabra. El **9.1** se repite además con cada
`app/zona-fichero.js` y **cada navegador o sistema operativo nuevos**: el
arrastre de ficheros no es de la app, es del entorno. Los disparadores del
mecanismo son los de `10-comprobar-gml.js` (`GUION.md` §8 y §16).

El punto **7** se repite con los mismos disparadores que `08-edicion.js`
(`GUION.md` §8 y §14): `viewer/edicion.js`, `viewer/acotaciones.js`,
**`viewer/barra-edicion.js`**, `cablearEdicion`, `edit/snap.js`, `edit/offset.js` y
los operativos `snapMetros` / `acotacionMinimaPx`. ~~El bloque «Edición» de
`index.html`~~ ya no existe: desde el 2026-07-29 los siete nodos los fabrica la
barra, y G16 exige que no vuelvan al marcado. Y el **7.2** además cada vez que se
pruebe en un navegador o un sistema operativo nuevos: la tecla no es de la app, es
del entorno. El **7.7** se repite además cuando cambie **`viewer/colindantes.js`**
o su pane (`viewer/_comun.js#PANES`): el color, el grosor y el emergente de las
vecinas son juicio visual, y la mecánica la mide el guion 10.

El punto **10** se repite cuando cambie cualquier texto que acabe **impreso**:
`report/literal.js` (el lindero y su presunción), `report/firma.js` (los rótulos
del encabezado y del pie), `report/pdf-parcela.js` (lo que el documento declara de
sí mismo) y `app/dialogo-informe.js` (lo que se lee antes de firmar) — el 10.5 es
sobre la LECTURA, y la lectura cambia con cada palabra. El **10.1** se repite
además **con cada cambio de `report/pdf.js`** y **con cada versión nueva de
cualquiera de los tres lectores**: la compatibilidad de un PDF escrito a mano no es
de la app, es del entorno. El **10.3**, con cada impresora distinta. Los
disparadores del mecanismo son los de `11-informe-pdf.js` (`GUION.md` §8 y §17).

El punto **11** se repite cuando cambie el ESQUEMA de la base —`MIGRACIONES` o
`ESQUEMA_ALMACENES` en `storage/bd.js`, que es donde una versión nueva puede
llevarse por delante los datos de quien ya tenía la aplicación—, cuando cambie
`export/dxf.js` (el **11.4** es sobre un formato que lee un programa ajeno: cada
byte cuenta), y cuando cambie cualquier texto de `app/dialogo-expediente.js` o de
`storage/expedientes.js` (el **11.6** es sobre la LECTURA). El **11.1** además cada
vez que se pruebe en un navegador o un perfil nuevos: el desalojo no es de la app,
es del entorno — y `persist()` puede empezar a devolver `true` el día que la página
esté marcada o instalada, que es justo lo que ese punto va a mirar. El **11.4**,
además, con cada CAD distinto: los visores perdonan cosas distintas, igual que los
lectores de PDF del 10.1. Los disparadores del mecanismo son los de
`12-expedientes.js` (`GUION.md` §8 y §18).

⛔ **Y toda la lista, ahora.** Se recorrió el 2026-08-02, salieron **tres defectos
reales** (encabezado del punto 9), se corrigieron los tres y **la lista no llegó a
firmarse**. Hay que volver a recorrerla entera con las correcciones puestas: es la
propia regla de esta sección, y esta vez con el motivo delante. La cadena
bloqueada es **F03 → F05 → F06 → F07 → F08 → F09 → F10**.
