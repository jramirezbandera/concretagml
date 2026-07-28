# Checklist humano — F03 · Fase 5

Lo que **ninguna máquina de este proyecto puede firmar**. El smoke automático
(`GUION.md`) mide los cinco criterios de aceptación en un navegador real y sale
`ok:true` en las dos pasadas; la suite (1.173 pruebas) cubre la lógica. Queda
esto, que es de otra naturaleza: **gestos de ratón de verdad** y **juicio
visual**.

> Desde F05 esta lista tiene un punto **6**, que no es de F03 y no es de la misma
> naturaleza que los cinco primeros: recoge lo que ni siquiera
> `07-catastro-vivo.js` —que llama al Catastro de verdad— puede firmar.

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

## Cuándo repetir esta lista

Con el smoke automático (`GUION.md` §8): en **F06**, cuando cambie la maquinaria
de arrastre —el punto 1 es exactamente lo que F06 reescribe—, y en **F16**, sobre
la URL desplegada, cuando `base` cambie para GitHub Pages.

El punto **6** se repite cuando cambien `services/catastro.js`,
`app/cableado-catastro.js`, los textos de `RESUMEN_POR_MOTIVO` o el bloque de F05
de `index.html` — los mismos disparadores que `07-catastro-vivo.js` (`GUION.md`
§8), porque los dos cubren mitades de lo mismo. Y el **6.7**, cada vez que se
publique: el CORS que importa es el del origen desde el que trabaja la gente.
