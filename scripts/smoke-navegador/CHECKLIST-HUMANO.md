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

> Regla de lectura: aquí NO se repite nada que ya esté medido. Cada punto existe
> porque el smoke **no puede** cubrirlo, y dice por qué. Si alguna vez un punto
> de esta lista se vuelve automatizable, se baja al guion y se borra de aquí.

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

- [ ] Pulsa **«Traer colindantes»** (una petición) y mira que el renglón diga
      cuántas han llegado y que la ficha las cuente.
- [ ] Arrastra un vértice hacia el **lindero de una vecina** y comprueba que
      engancha. Es el caso de uso que da sentido a la fase: cerrar la hendidura
      entre dos parcelas que en el terreno son la misma línea.
- [ ] Trae una parcela **nueva** con «Traer del Catastro» y comprueba que las
      colindantes de la anterior **se sueltan** (deja de engancharse a linderos que
      ya no lindan con nada) y que «Deshacer» se apaga con su explicación.
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

### 8.2 · La sombra de la diferencia ⟨§10.5⟩

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

El punto **7** se repite con los mismos disparadores que `08-edicion.js`
(`GUION.md` §8 y §14): `viewer/edicion.js`, `viewer/acotaciones.js`,
**`viewer/barra-edicion.js`**, `cablearEdicion`, `edit/snap.js`, `edit/offset.js` y
los operativos `snapMetros` / `acotacionMinimaPx`. ~~El bloque «Edición» de
`index.html`~~ ya no existe: desde el 2026-07-29 los siete nodos los fabrica la
barra, y G16 exige que no vuelvan al marcado. Y el **7.2** además cada vez que se
pruebe en un navegador o un sistema operativo nuevos: la tecla no es de la app, es
del entorno.
