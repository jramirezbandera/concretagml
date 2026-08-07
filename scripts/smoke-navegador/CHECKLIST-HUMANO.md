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
> Y desde F11 tiene un punto **12**, el de EDIFICIO, ENTRADA Y MODELO, y llega con
> una diferencia respecto a los seis anteriores: **el guion que lo precede encontró
> defectos**. `13-edificio.js` destapó **dos de producción** que la suite no ve
> porque jsdom no calcula un solo píxel — el panel de la rama Edificio **no cabía**
> (la lista de partes en 2 px, la de avisos en 0 y el pie recortado 48 px en
> silencio, con «Diagnosticar encaje» fuera de la pantalla) y la aplicación **se
> contradecía** al cargar un edificio («Cargadas 7 partes» y «No se construye la
> parcela», a la vez). **Los dos se corrigieron el mismo día**: el segundo está
> cerrado, y del primero se ganaron **164,99 px medidos** —el panel ya cabe y el
> recorte es 0—, pero **sus dos cajas encogibles siguen sin sitio con datos
> dentro**: faltan **32,70 px** para el mínimo decente y **569,31** para verlo todo.
> Así que el §12.1 es BLOQUEANTE y lo que se pide no es descubrirlo, es **decidir de
> dónde salen esos píxeles**. Se suman otros dos bloqueantes: que la huella **caiga
> donde está el edificio** (§12.3 — comparar la mancha violeta con el tejado de la
> ortofoto es la comprobación entera que justifica pintarlas, y ninguna máquina la
> hace) y el de lectura que HEREDA el carácter del 8.1, el 9.4, el 10.5 y el 11.6
> (§12.9). Más **la vía en vivo del `wfsBU`** (§12.7), que el guion no toca a
> propósito y que trae su propio régimen de red, y una comprobación que solo se
> puede hacer con los oídos: que el **segundo CTA no quede mudo** para un lector de
> pantalla, ahora que su motivo vive en el renglón del otro botón (§12.4). **El
> punto 12 se firma junto con el 6, el 7, el 8, el 9, el 10 y el 11**; la cadena
> bloqueada pasa a ser **F03 → F05 → F06 → F07 → F08 → F09 → F10 → F11**.
>
> ⭐ **Y una anotación de método que no es de F11**: los tres arreglos de arriba
> salieron de tres corridas del mismo guion, y **cada uno de una cifra que la
> corrida anterior había puesto encima de la mesa**. Ninguna de las tres la podía
> dar la suite —jsdom no calcula un píxel—, y el tercero ni siquiera era un defecto
> de maquetación: era **una advertencia dicha dos veces**, que solo se ve cuando
> alguien mide lo que ocupa. Es el argumento entero de esta carpeta.
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
- [ ] **«Ayuda» compite con cuatro herramientas más.** Desde el 2026-08-05 es una
      palabra y no un «?», y está detrás de un filete, al final de la barra: ¿se lee
      como la salida de auxilio, o como una herramienta más? Míralo sin pasar el
      ratón por encima.
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
      vive **centrada en el borde inferior** (desde el 2026-08-05; hasta entonces
      estaba arriba a la izquierda, apilada bajo el zoom, y el autor la rechazó
      ahí). Trae dos o tres parcelas distintas (una alargada, una en esquina) y mira
      si en alguna se come vértices que hay que agarrar — el borde de abajo es donde
      cae el lindero sur. Si estorba, la salida es `posicionBarra` —admite las
      cuatro esquinas de Leaflet más `bottomcenter`—, no quitar la barra.
- [ ] **¿Convive con los controles de Leaflet?** El zoom, el selector de capas, el
      control de opacidad, la escala y la atribución están en el mismo mapa. ¿Se lee
      como una barra de herramientas de la app, o como cajas sueltas amontonadas?
      Medido el 2026-08-05 a 1920×1080 y a 1440×900: centrada al píxel, 26 px por
      encima del suelo del mapa y sin tocar la atribución.
- [ ] ⚠️ **Los desplegables abren HACIA ARRIBA y la fila no se mueve.** Es lo que
      hace usable una barra pegada al suelo. Medido a 0 px de desplazamiento, pero
      lo que hay que mirar aquí es otra cosa: el panel de ayuda mide 558 px a
      1440×900 y tapa medio mapa mientras está abierto. ¿Molesta, o es lo esperable
      de una ayuda que se pide y se cierra?
- [ ] ⚠️ **El conmutador del ajuste: ¿se ve encendido de un vistazo?** Nace
      **marcado** (el estado que protege del error más caro de esta app: dejar
      milímetros de hueco entre dos parcelas que en el terreno son la misma línea).
      Es un `<input type="checkbox">` estilado como botón, así que su «encendido» es
      solo un cambio de fondo. Apágalo y enciéndelo mirando a otra parte entre medias:
      ¿sabrías decir en qué estado está **sin** pulsarlo? Si no, es un error
      silencioso de manual y **bloquea**, porque el usuario no puede saber si lo que
      acaba de arrastrar enganchó o no. ⚠️ Desde el 2026-08-05 el botón dice
      «Ajuste», así que ahora hay dos preguntas y no una: si se ve el estado, y si se
      lee QUÉ es lo que está encendido.
- [ ] **¿Se descubren los desplegables?** La tolerancia y la distancia del offset ya
      no están a la vista: se abren desde su herramienta. El ajuste es un **botón
      partido** («Ajuste» + flecha) y «Desplazar lindero» abre siempre y lleva su
      flecha al lado. ¿Se entiende que la flecha abre algo? ¿Alguien encuentra la
      tolerancia sin que se la enseñen? La flecha del ajuste es la única herramienta
      de la barra que sigue sin palabra, y es la que más cuesta encontrar.
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
IndexedDB, y afirma sobre los tres ficheros que bajan: que el DXF **cumple la
versión que declara** y trae las dos capas **en la TABLA**, coma decimal en el
listado, y el sobre `concreta-gml/proyecto` con sus 15 vértices. Cifras en
`GUION.md` §18.

⛔ **Y este guion ya se equivocó una vez, así que léelo con eso puesto.** Hasta el
**2026-08-05** comprobaba `$ACADVER === 'AC1015'` y daba verde a un fichero que
**dejaba ZWCAD 2023 en blanco y bloqueado**: declarábamos R2000 sin traer nada de
lo que R2000 exige. Lo destapó un usuario abriendo el fichero. La suite, `ezdxf` y
este guion decían los tres que estaba bien. Ver `GUION.md` §24.

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

## 12 · Edificio, entrada y modelo ⟨F11⟩ — lo que ni `13-edificio.js` firma

**Por qué está aquí.** F11 le da a esta aplicación **una segunda rama**. Once fases
hablando de parcelas y ahora hay un conmutador en la cabecera que cambia el panel
entero, un segundo store, huellas violetas sobre la ortofoto y un diálogo que
pregunta qué capas del dibujo entran. `13-edificio.js` mide lo que jsdom no puede
—píxeles, panes, ficheros soltados de verdad, el conmutador ida y vuelta con la
aplicación entera montada—, y de paso **destapó dos defectos de producción** que la
suite no veía. Cifras y detalle en `GUION.md` §19.

> ⛔ **LEE EL §19 ANTES DE EMPEZAR.** El guion encontró **dos defectos reales** el
> 2026-08-04 y se corrió **tres veces** ese día, cada una detrás de un arreglo:
> **4 problemas → 3 → 1**. Estado de hoy:
>
> - **el aviso que contradecía a la aplicación: CERRADO** (`avisoQueNiegaLaCarga:
>   null`), arreglado en su origen y con guardián puesto;
> - **el panel que no cabía: CABE.** El recorte de `.gml-panel` es **0 px** en
>   vacío y con datos, y «Diagnosticar encaje» y su motivo **se ven**;
> - **la advertencia del autoguardado se decía DOS VECES** —entera en el renglón y
>   entera otra vez como tarjeta—: ahora va **breve en el renglón** y **entera en la
>   tarjeta, una vez**. Con eso `#avisos` pasó de 6,69 a **24,84 px** y la lista, en
>   vacío, de 58,70 a **90,03 px (tres filas)**;
> - ⛔ **lo único que QUEDA**: con 7 partes cargadas la lista mide **7,06 px** para
>   184 de contenido, así que **no se ve ni una fila entera**. **Faltan 18,33 px**
>   (eran 32,70) y **546,10 px** para verlo todo.
>
> Si vienes a esta lista sin saberlo, vas a redescubrirlo en el punto 12.1 y a
> pensar que has roto algo. No lo has roto: está medido y está escrito. Lo que se
> te pide aquí **no es descubrirlo, es decidir de dónde salen esos 18,33 px** — y
> de ellos **8,84 están al lado**, en el margen que hoy tiene `#avisos`.

**Cómo prepararlo, y cuesta CERO peticiones al Catastro.** Con la app viva, pulsa
**«Edificio»** en la cabecera y suelta sobre la ventana
`test/fixtures/parsers/edificio_consulta_masiva_3515508VF0831N.dxf` (7 anillos en
`Construccion` + 1 en `Parcela`, descarga real de Consulta Masiva). Todo lo de los
puntos 12.1 a 12.6 se recorre con ficheros locales y se puede repetir las veces que
haga falta. **Solo el 12.7 toca la red**, y tiene su régimen.

### 12.1 · ⛔ Los 18,33 px que faltan, con los ojos ⟨BLOQUEANTE⟩

**Por qué es bloqueante.** Es lo que queda del **defecto A** del §19, y lo que hay
que decidir aquí no es si existe —está medido— sino **de dónde salen los píxeles**,
que es una decisión de producto y no de máquina. Van **tres** ahorros aplicados, y
cada uno salió de una cifra que la corrida anterior del guion había medido:

| Ahorro | Ganancia | Qué cerró |
|---|---|---|
| Solo el apunte del modelo ELEGIDO | −97,62 px | |
| UN motivo para los dos CTA | −67,37 px | el recorte del panel: 48/115 → **0/0** |
| La advertencia del autoguardado **una vez** (breve en el renglón, entera en la tarjeta) | −44,53 / −29,68 px | `#avisos`: 6,69 → **24,84 px** · lista en vacío: 58,70 → **90,03 px (3 filas)** |

⛔ **Lo que no cerró ninguno**: con 7 partes cargadas la lista mide **7,06 px** para
184 de contenido. **Faltan 18,33 px** para que se vea UNA fila.

- [ ] Conmuta a **Edificio** sin cargar nada. La lista mide ahora **90,03 px** (tres
      filas). ¿Se lee entero el renglón de las cinco vías de entrada (ocupa 124 px),
      o se corta? ⚠️ **Ese renglón es lo PRIMERO que ve el usuario de esta rama.**
- [ ] Carga el DXF y mira otra vez: **7 partes en la ficha del pie y en el rótulo,
      y ninguna a la vista** (la lista cae a 7,06 px). ¿Se entiende que están ahí?
      ¿Buscarías la barra de scroll?
- [ ] ✅ Mira el rótulo «AVISOS»: ahora se ve la cabecera de una tarjeta. ¿Se lee
      lo suficiente como para saber que hay algo, o solo se intuye?
- [ ] ✅ Baja hasta el pie: **«Diagnosticar encaje» y su motivo tienen que verse
      enteros.** Si no se ven, el primer arreglo se ha deshecho: vuelve al §19.
- [ ] ⭐ **JUICIO, y es lo que se pide de verdad.** Faltan **18,33 px** para una
      fila (**176,94** para las siete, **546,10** para verlo todo). Y hay dos sitios
      de donde pueden salir, en orden de cercanía:
      · **8,84 px están AL LADO**: es el margen que `#avisos` tiene hoy por encima de
      su mínimo (24,84 contra los 16 de una línea). No hay que quitárselos a nadie,
      pero dejan a los avisos justo en el hueso. **¿Lo aceptas?**
      · los **9,49 px restantes** salen de los tres fijos, que con datos suman
      **772,23 px** de 900: `.gml-bloque--edificio` **397,19** (rótulo 15,94 +
      **selector 174,41** + refcat 54,94 + estado **44,53** + procedencia **59,38**;
      ⚠️ los dos últimos **solo aparecen con datos**, +74,22 px, o sea justo cuando la
      lista tiene algo que enseñar), `.gml-panel-pie` **257,91** (ficha 72,75 +
      acciones **140,16**) y la cabecera **117,13**.
      ¿Cuál cede? Apunta tu orden. La salida **NO** es subir
      `--gml-partes-alto-max`: el tope (234 px) **no muerde ni una vez**.
- [ ] ⚠️ **Y mira el margen antes de firmar**: hoy sobran **8,84 px** en `#avisos` y
      **0** en la lista. **F12 añade las plantas por parte** —más texto por fila y
      filas más altas—, o sea que entra en un panel sin holgura. Si crees que hay que
      ensanchar el panel o repensar la maqueta, **este es el momento de decirlo**.
- [ ] Prueba con la ventana más alta (pantalla completa, 1080 o 1440 de alto): ¿a
      partir de qué altura se ven las 7 filas? Apunta la cifra: es el dato que dice
      si esto es «se queda corto en portátiles» o «se queda corto siempre».

### 12.2 · Lo que la carga DICE, ahora que ya no se contradice

**Por qué está aquí.** Era el **defecto B** del §19 —el panel decía «Cargadas 7
partes» y a la vez una tarjeta decía «**No se construye la parcela**»— y **está
cerrado**: `edificio/entrada.js` filtra ahora las detecciones de parcela con la
misma lista publicada con la que ya filtraba los bloqueos, y el guion lo vigila. Lo
que queda aquí es de LECTURA, y hereda el carácter del 8.1, el 9.4, el 10.5 y el
11.6: la regla de oro 9 dice que la aplicación **mide** y el colegiado
**interpreta y firma**.

- [ ] Carga el DXF de edificio. Lee el renglón del panel: «Cargadas 7 partes… 62
      vértices en total. 4 nota(s) más en el detalle del fichero.»
- [ ] ✅ Vuelve a la rama **Parcela** (donde los avisos se ven) y comprueba que **NO
      hay ninguna tarjeta que hable de «la parcela» ni de metros negativos**. Si la
      hay, el arreglo se ha deshecho.
- [ ] Los tres avisos que sí deben estar: **huso ambiguo** (2 interpretaciones,
      30 y 31), **«esta rama se guarda sola pero todavía no se archiva»** (F12 · T4.3;
      hasta entonces decía «no se guarda sola», y dejó de ser verdad) y —si has soltado
      un dibujo en la rama Parcela— el que te manda a la otra rama. ¿Alguno se lee como
      un veredicto sobre tu trabajo?
- [ ] «4 nota(s) más en el detalle del fichero»: ¿sabes **dónde** está ese detalle?
      Si no lo encuentras, la frase promete algo que no entrega.
- [ ] ⚠️ El de **huso ambiguo** es el que de verdad importa y es el que enlaza con
      el 12.3: «se ofrece la 30 por defecto». ¿Te queda claro que **tienes que
      confirmarlo**, o parece que ya está resuelto?

### 12.3 · ⭐ Que la huella caiga DONDE ESTÁ EL EDIFICIO ⟨BLOQUEANTE⟩

**Por qué es bloqueante, y es la razón entera por la que las partes se pintan.** La
decisión 3 de la fase lo dice: «un edificio importado de un DXF que cae 40 m al
norte por un huso mal deducido es **indistinguible de uno bueno en la lista del
panel**, y salta a la vista en cuanto se pinta sobre la ortofoto». El guion mide que
el `<path>` existe, que cuelga del pane 422, que está por encima de la parcela y que
su caja cae dentro del lienzo. **Comparar la mancha violeta con el tejado de la
imagen no lo puede hacer ninguna máquina de este proyecto.**

- [ ] Con el DXF cargado: ¿las siete huellas violetas caen **sobre cubiertas**, o
      sobre un descampado / un tejado que no es? Mira con la ortofoto PNOA y con el
      parcelario catastral superpuesto.
- [ ] ⚠️ El fichero **dispara el aviso de huso ambiguo** («2 interpretaciones
      viables (30, 31). Se ofrece la 30 por defecto»). ¿Has visto ese aviso? ¿La 30
      es la buena? Es la comprobación entera: **la 31 pondría el edificio a cientos
      de kilómetros y la lista del panel diría exactamente lo mismo.**
- [ ] ¿Se distingue el **violeta** de la huella del **amarillo** de la parcela que
      queda justo debajo? ¿Y sobre una cubierta en sombra? (El violeta claro
      `#A78BFA` se eligió por descarte justamente para eso.)
- [ ] El relleno está al **25 %** a propósito, para que se siga viendo la cubierta
      debajo. ¿Tapa de más? ¿De menos? Es la comprobación que justifica pintarlas.
- [ ] Pasa el puntero por encima de una huella: ¿sale el rótulo con el nombre de la
      parte? ¿Sigue al puntero (es `sticky`) o se planta en un sitio raro?
- [ ] ⭐ **Con la huella delante, pincha en el mapa para «Deducir del mapa»** (rama
      Parcela). Las huellas van en el pane **422, por encima de la parcela**, y su
      `interactive: true` podría robarle el clic. El guion mide que el ratón burbujea;
      **que el gesto de verdad funcione se ve aquí**.

### 12.4 · El conmutador de rama, con el dedo y con el teclado

**Por qué está aquí.** El guion pulsa con `el.click()`, que no es un gesto de ratón
(§0). Y el conmutador tiene **45,12 px de holgura medidos** antes de que la fila de
chips se parta en dos líneas y se coma ~20–29 px de la tabla de vértices.

- [ ] Pulsa «Parcela» y «Edificio» con el ratón varias veces. ¿Se nota cuál está
      activo? El estado activo se pinta desde `data-rama` (no desde `aria-pressed`),
      y es lo único con color de toda la rama.
- [ ] Los botones miden **25,39 px** de alto (WCAG 2.5.8 pide 24), y ese estirón es
      un regalo del chip que tienen al lado. ¿Se aciertan sin apuntar dos veces?
- [ ] ⚠️ **Estrecha la ventana** hasta que la fila de chips se parta en dos líneas.
      ¿A qué anchura? Cuando se parte, ¿pierde la caja de vértices los ~20–29 px?
      (Con `flex-wrap: nowrap` esto no se vería: el elemento se saldría 102,53 px y
      el panel lo recortaría en silencio. Por eso se dejó `wrap`.)
- [ ] Con el teclado: `Tab` hasta el conmutador, `Espacio`/`Intro`. ¿Conmuta? ¿El
      orden del foco coincide con el orden visual? (No hay ni un `order` en el CSS,
      a propósito, por WCAG 2.4.3.)
- [ ] Con un **lector de pantalla**: ¿anuncia el grupo («Qué se está preparando») y
      el estado pulsado? `aria-pressed` es lo único que oye, y ninguna máquina de
      este proyecto lo puede escuchar.
- [ ] ⭐ **Y con el lector, el segundo CTA del pie.** Desde el arreglo del defecto A
      los dos botones comparten **un solo motivo**, escrito debajo del primero; el
      renglón del segundo está **vacío a propósito** y lo que lo salva es un
      `aria-describedby`. Ve con el lector hasta «Diagnosticar encaje»: **¿lee el
      motivo?** El guion comprueba que el atributo, el nodo y el texto existen;
      **que el lector lo diga de verdad solo se oye aquí**. Si no lo dice, ese botón
      es mudo para quien no ve la pantalla, y la decisión de píxeles se ha llevado
      por delante a alguien.
- [ ] Escribe algo en la referencia catastral de **Parcela**, conmuta a Edificio y
      vuelve. ¿Sigue ahí lo que escribiste? (El guion lo mide: mismo nodo, mismo
      valor, oyentes vivos. Que además **se vea** es esto.)

### 12.5 · El diálogo de reparto por capas, con el ratón

**Por qué está aquí.** El reparto se **ofrece y no se impone**, y no es prudencia:
en `UTM.dxf` —el único plano real que tiene este proyecto— **la parcela de verdad
está en la capa `0` y NO en la que se llama `PARCELA`**. Elegir por el nombre falla
en el primer fichero real. Y hay una trampa medida: **marcar una casilla asignando
`.checked` no dispara `change`**, así que el guion tiene que despacharlo a mano; con
el ratón eso pasa solo, y es justo lo que hay que ver.

- [ ] Suelta el DXF de edificio. ¿Se abre el diálogo? ¿Ves las dos capas con sus
      nombres **literales** (`Construccion`, `Parcela`) y su recuento (7 y 1)?
- [ ] «Cargar las partes» **nace apagado**. ¿Se lee el motivo, ahí al lado? ¿Se
      entiende que ninguna venga marcada, o parece que la aplicación no ha hecho su
      trabajo?
- [ ] Marca `Construccion` **con el ratón**: ¿se enciende el botón al instante?
      ¿Desaparece el motivo? Desmárcala: ¿vuelve a apagarse con su motivo?
- [ ] Marca **las dos** capas y aplica: ¿entran 8 partes? ¿Los nombres se
      **renumeran** (Parte 1…Parte 8) o hay dos «Parte 1»?
- [ ] Cancela con **Escape** y con el botón «Cancelar». ¿Dice que no se ha cargado
      nada, y **cómo volver**? («No ha pasado nada» es lo único que el usuario no
      puede interpretar.)
- [ ] Con el teclado: `Tab` dentro del diálogo, `Espacio` sobre la casilla,
      `Escape`. ¿El foco vuelve a donde estaba? ¿Se puede llegar a todo sin ratón?
- [ ] Prueba con `test/fixtures/parsers/UTM.dxf` (**25 polilíneas en 5 capas**:
      FINO 16, LINDE 4, PARCELA 3, BLANCO 1 y `0` 1). ¿Se lee la lista? ¿Reconocerías
      tus capas ahí? ⭐ ¿Se entiende que **la capa `PARCELA` no es la parcela**?
- [ ] Con el zoom del navegador al **200 %**: ¿sigue cabiendo el diálogo?

### 12.6 · Soltar un dibujo en la rama que NO toca

**Por qué está aquí.** El destino de un `.dxf` se resuelve por la **rama activa**:
el mismo fichero son dos documentos distintos. Con la rama Parcela no hay a quién
dárselo —reabrir un dibujo como parcela es la otra mitad de la asimetría que dejó
F10— y la aplicación tiene que **decirlo, y decir por dónde sí entra**.

- [ ] Con la rama **Parcela**, suelta un `.dxf`. ¿Aparece el aviso? ¿Te dice que
      cambies de rama, o solo que no se puede?
- [ ] ¿La tabla de vértices se ha quedado **intacta**? ¿No ha aparecido ninguna
      huella en el mapa?
- [ ] Suelta un `.txt` de coordenadas en cada rama: ¿va a lo suyo?
- [ ] ⭐ Suelta un **GML de edificio** (`.gml`). La aplicación **conmuta de rama
      sola** y lo dice. ¿Te enteras de que la pantalla ha cambiado, o te parece un
      fallo? Un cambio de contexto que el usuario no ha pedido y que nadie explica se
      lee como un error.
- [ ] El velo de arrastre: ¿anuncia las extensiones que de verdad acepta?

### 12.7 · ⚠️ El `wfsBU` en vivo — RÉGIMEN DE RED, léelo antes

**Por qué está aquí, y por qué el guion NO lo toca.** F11 se puede cerrar entera con
ficheros locales, y el override **O8** pide **una pasada, sin bucles**. Así que la
vía en vivo del servicio de edificios del Catastro no la mide ninguna máquina de
este proyecto: se firma aquí, con la cabeza puesta.

> ⛔ **UNA pasada por punto, y sin repetir «a ver si ahora».** El coste medido es de
> **2 peticiones por edificio** (o **1** si la referencia no existe: se para en la
> primera). Mira el §13 de `GUION.md`: el régimen es el mismo.

- [ ] Escribe una referencia catastral real en la rama Edificio y pulsa «Traer del
      Catastro». ¿Llega el edificio? ¿Cuántas partes? ¿Se pintan donde deben?
- [ ] ⚠️ Con una referencia **que no existe**: medido en la fase 0, este endpoint
      contesta **`302` → `404` con HTML de ASP.NET** —justo al revés que el de
      parcela, donde todo error llega `200`—. ¿Qué te dice la aplicación? ⭐ El
      renglón bueno es el del panel de edificio; **el canal de avisos trae además un
      mensaje del transporte que dice «esa dirección no existe»**, hablando de una
      URL cuando tú has escrito una referencia catastral. ¿Confunde? Anótalo: no se
      arregla sin tocar `services/_red.js`.
- [ ] Con una parcela **sin construcción**: la colección vacía es `200 OK` y
      significa que la parcela existe y no tiene nada construido. **Es el punto de
      partida de una obra nueva, no un fallo.** ¿Se lee así?
- [ ] Con la referencia de la parcela del proyecto (`9398516VK3799G`): ⭐ **tiene una
      PISCINA** (`openAirPool`), y su geometría viene en un dialecto distinto al de
      los fixtures de F00. ¿Aparece? ¿Cuántas partes esperabas y cuántas hay?
- [ ] Deja la referencia en blanco y pulsa: ¿dice que hace falta escribirla, o que
      hace falta cargar una huella de la que deducirla? Son dos mensajes distintos a
      propósito.
- [ ] ⚠️ **El orden de apagado importa** (medido): destruir el cliente de parcela
      aborta el transporte compartido y a partir de ahí el de edificio devuelve
      «cancelada» sin que nadie lo haya destruido. No se puede provocar desde la
      interfaz, pero si ves una consulta cancelada sin motivo, **es este camino**.

### 12.8 · Los siete atributos, el modelo y lo que se pierde al cambiarlo

**Por qué está aquí.** El selector de modelo es el criterio de aceptación 1 de la
ficha, y F11 lo cumple **de una forma más fuerte de la que pedía**: en modo
Simplificado los siete atributos **no están ocultos, no existen** —ni el bloque ni el
botón que lo abre—. Y cambiar de modelo **borra datos**.

- [ ] En **Simplificado**: ¿ves el botón «Atributos» en la fila del rótulo? (No debe
      estar.) Cambia a **Completo**: ¿aparece?
- [ ] Abre «Atributos», rellena algunos y guarda. Vuelve a **Simplificado**: ¿te
      avisa de que **se borran los siete**? ¿Antes o después de borrarlos?
- [ ] Vuelve a **Completo**: los campos salen **vacíos**, no con los valores de
      antes. ¿Lo decía el apunte del radio? ¿Te ha pillado por sorpresa?
- [ ] Escribe «mil novecientos» en el año de construcción y guarda: ¿te dice **qué
      campo** no lleva un número, o se guarda como «sin indicar» en silencio? (Los
      campos son `type="text"` con `inputmode="numeric"` a propósito: con `number` el
      navegador vacía el valor y el dato se perdería mudo.)
- [ ] Escribe la superficie construida con **coma decimal** (`120,5`): ¿la acepta?
- [ ] ⭐ **JUICIO**: desde el arreglo del defecto A **solo se enseña el apunte del
      modelo ELEGIDO** (el otro va con `hidden`), y el `.gml-campo` del selector pasó
      de **272,03 a 174,41 px**. ¿Se echa de menos el otro? El apunte de la opción
      que **no** has elegido describe una decisión que no has tomado —pero el de
      SIMPLIFICADO dice **qué se pierde** al elegirlo, y eso sí hay que leerlo antes
      de pulsar. Con el arreglo, ese texto solo aparece **después** de elegir.
      ¿Llegas tarde? Es la pregunta que decide si este ahorro se queda.

### 12.9 · ⛔ Cómo se lee la rama entera ⟨BLOQUEANTE⟩

**Por qué es bloqueante, y hereda el carácter del 8.1, el 9.4, el 10.5 y el 11.6.**
La regla de oro 9: la aplicación **mide** y el colegiado **interpreta y firma**. Esta
rama estrena mucho texto —apuntes de modelo, motivos de botones apagados, el renglón
de las cinco vías, la procedencia con el aviso del autoguardado, los mensajes de las
cinco entradas—.

- [ ] Léelo todo con ojos de técnico que no ha escrito el código. ¿Alguna frase **se
      lee como un veredicto** sobre el edificio, sobre el dibujo o sobre lo que hay
      que hacer?
- [ ] ⭐ Lo que esta rama **guarda y no guarda** se dice en **DOS SITIOS Y DOS
      FORMAS**, después de que el guion midiera que se estaba diciendo **dos veces
      entera** (y costaba 89 px): una **línea** permanente en el renglón de
      procedencia («Esta rama guarda el trabajo en curso, pero todavía no lo archiva
      con nombre») y la **tarjeta completa** en el panel de avisos, una sola vez,
      cuando ya hay algo en juego. Léelas las dos seguidas: **¿se leen como una
      advertencia que se concreta, o como dos avisos distintos?** ¿La línea corta
      basta para el que solo mire el renglón? ¿La tarjeta larga aporta lo suficiente
      para ocupar su sitio? Si la respuesta a alguna es que no, el reparto hay que
      rehacerlo — y ahí hay hasta 29,69 px en juego.
- [ ] ⛔ **F12 · T4.3 reescribió las dos, y esto es lo que hay que juzgar de nuevo.**
      Antes decían «esta rama **no se guarda sola**… exporta el dibujo desde tu CAD»,
      y las dos mitades caducaron en esa misma tarea: la rama pasó a autoguardarse y
      el recinto pasó a poderse dibujar aquí (no hay CAD del que reexportarlo). El
      texto de ahora distingue **guardar el trabajo en curso** de **archivarlo con
      nombre**. La pregunta para ti: **¿esa distinción se entiende sin haber leído el
      código?** Si alguien lee «se guarda sola» y da por hecho que su edificio estará
      en la lista de expedientes mañana, la frase no ha servido de nada.
- [ ] Los cuatro rótulos del estado de conservación —«Funcional», «En construcción»,
      «Ruinoso», «Derruido»— **no son un juicio de la aplicación**: son el vocabulario
      de INSPIRE y el valor de un campo que tú eliges. ¿Se lee así, o parece que la
      app está calificando el edificio?
- [ ] La ficha del pie en esta rama dice «Partes» y «Superficie en planta». ¿Se
      entiende que **no** es la superficie construida? Y si alguna parte no trae
      contorno, ¿se entiende el «(N sin contorno)»?
- [ ] El renglón de las **cinco vías** de la lista vacía: ¿se lee como una ayuda o
      como una lista de cosas que no funcionan? (Ojo: hoy solo se ven **58,70 px de
      los 124** que ocupa, por el residuo del defecto A. Míralo estirando la ventana.)
- [ ] El motivo **conjunto** de los dos CTA apagados: nombra los dos botones en una
      frase para no gastar dos párrafos (ver 12.1). ¿Se entiende que están apagados
      **los dos**, o parece que solo habla del de arriba? Los dos motivos por
      separado siguen escritos en `app/rama.js` y son lo que vuelve el día que el
      pie tenga sitio: **si esta frase corta no basta, dilo.**

### 12.10 · Abrir en un CAD el dibujo del que salen las huellas

**Por qué está aquí.** Es la otra mitad del §11.4, y el argumento es el mismo: **un
fichero que valida contra nuestro propio parser y no abre igual en un CAD no está
leído, está de suerte.**

- [ ] Abre `edificio_consulta_masiva_3515508VF0831N.dxf` en un CAD (apunta cuál).
      ¿Cuántas polilíneas ves en la capa `Construccion`? ¿Y en `Parcela`?
- [ ] ¿Coinciden con las **7 y 1** que ofrece el diálogo de reparto?
- [ ] Mide una huella en el CAD y compárala con la «Superficie en planta» del pie
      (medido: **165,99 m²** con las 7 partes de `Construccion`). ¿Cuadra?
- [ ] ⚠️ Ese fixture trae `POLYLINE`/`VERTEX`/`SEQEND`, que es **la misma forma que
      esta aplicación exporta desde el 2026-08-05** (ver `GUION.md` §24). Si tu CAD lo
      abre distinto, es un dato que no tenemos en ninguna parte: apúntalo.
- [ ] Prueba con un DXF **tuyo**, de un trabajo real: ¿entra? ¿Reconoces tus capas
      en el diálogo? ¿Cuántas partes salen y cuántas esperabas?

---
## 13 · Expediente de varias parcelas ⟨F17⟩ — lo que ni `16-derivar-cesion.js` firma

**Por qué está aquí, y por qué es la sección más corta y la más cara.** F17 cierra
el hueco que dejaba a esta aplicación sin poder entregar **más de 1 de cada 5**
expedientes de parcelario reales de su autor: mover un lindero hacia dentro obliga
a aportar TAMBIÉN la finca que se suelta, o el IVG vuelve negativo. La aplicación ya
sabe derivarla, medirla, validarla, componer el sobre de N `gml:featureMember` y
demostrar que el conjunto cierra sobre coordenadas ya redondeadas — y **nada de eso
prueba que la Sede lo acepte**.

`16-derivar-cesion.js` mide el recorrido y la maquetación, y ya encontró y cerró un
defecto real a 1280×720 (`GUION.md` §25). Lo que queda aquí son **dos puntos, los
dos BLOQUEANTES**, y ninguna máquina de este proyecto puede firmar ninguno.

> ⛔ **LEE EL §25 ANTES DE EMPEZAR.** El guion sale `ok:true` en las dos
> resoluciones, pero deja una cifra que hay que tener delante: a **1280×720** la
> tabla de vértices queda en **126,14 px** con dos piezas, y el suelo derivado son
> **124,57**. El margen es de **1,57 px**. Cualquier cosa que se le añada al bloque
> del sobrante lo revienta, y ⛔ **el síntoma seguirá siendo mudo**: el panel no
> desborda, la tabla encoge en silencio.

**Cómo prepararlo, y cuesta CERO peticiones al Catastro.** Con la app viva, ve a
**Validación**, mueve dos o tres vértices hacia dentro (tecleando en la tabla o
arrastrándolos) y pulsa **«Derivar sobrante»** en el pie del panel.

### 13.1 · ⛔ ¿Se entiende que las piezas se PROPONEN? ⟨BLOQUEANTE⟩

**Por qué es bloqueante.** Toda la decisión de fondo de F17 es que la aplicación
**mide y propone; quien firma decide**. Si el usuario lee la lista como «esto ya
está hecho» en vez de como «esto es lo que he encontrado, dime cuál va», entonces la
aplicación ha decidido por él qué fincas se segregan — y eso no lo arregla ningún
test, porque **en la suite las 3.925 pruebas de esa capa siguen verdes igual**.

Míralo con los ojos de quien no ha escrito el código:

- ¿Se entiende que **puedes quitar** una pieza? ¿O las casillas se leen como una
  confirmación de algo ya decidido?
- La marca **«estrecha»** — ¿se lee como «esto sobra, quítalo» (que sería un
  veredicto, y la regla de oro 9 lo prohíbe) o como «esto es muy fino, míralo»?
- El **número** de la fila y el del mapa: ¿sirven de verdad para saber qué mancha
  estás nombrando, o hay que buscarla? Prueba a nombrar la pieza 2 sin pasar el ratón
  por ninguna fila.
- El contador «se emitirán N de M»: con **más de cuatro piezas** hay scroll. ¿Se
  nota que hay más abajo, o parece que son cuatro?
- Y lo que **no** dice ninguna cifra: ¿te fiarías de firmar el papel que sale de
  aquí?

⛔ Hereda además el punto bloqueante de la §8 y de la §10.5: **ninguna cifra de esta
pantalla puede leerse como un veredicto**. Ni el área, ni el grosor, ni el residuo
del cierre.

### 13.2 · ⛔ VERDAD EXTERNA: un expediente REAL, y que el IVG vuelva POSITIVO ⟨BLOQUEANTE⟩

**Por qué es bloqueante, y por qué cierra la fase.** Es el criterio 4 de F17 y la
regla de oro 8 en su forma más literal: **ningún XSD expresa las reglas de negocio
del IVG**. El validador de esquema dice que el documento está bien formado; no dice
que la Sede lo acepte. Es la misma clase de gate que cerró F04 —y que ya destapó una
vez un fichero RECHAZADO con 1.784 pruebas en verde— y la que midió la fase 0 de esta
misma feature.

Lo que hay que hacer, y no vale una parte:

1. Coger un expediente **de verdad**, con un lindero que de verdad se mueve hacia
   dentro. No la parcela de demostración.
2. Derivar el sobrante en la aplicación, revisarlo, nombrarlo y **descargar el
   `.gml`**. Comprobar que baja con prefijo **`expediente_`** y no `parcela_`.
3. Subirlo a la Sede, declarar el **«Tipo de operación»** que el informe propone
   —⚠️ y comprobar que es el que la Sede espera: es el único dato del expediente con
   redundancia cero— y **emitir el IVG**.
4. Anotar el **CSV** del certificado en `spec/SPEC.md` §7.1, junto a los dos que ya
   están.

**Si vuelve NEGATIVO**, lo que hay que traer no es «ha fallado»: es **el motivo
literal que da el IVG**, que es lo que alimenta el diccionario de errores de F15 y lo
que dice qué hipótesis de este proyecto era falsa.

⚠️ **Y una comprobación de más, que sale gratis y cierra una deuda declarada**:
mirar si el desplegable de «Tipo de operación» de la Sede ofrece **más de las dos
opciones** que este proyecto ha visto (Segregación y Subsanación), y si el IVG se
queja al emitir una combinación incoherente —Segregación con un solo miembro, o al
revés—. Las dos cosas están escritas como no medidas en la ficha de F17.

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

El punto **12** se repite cuando cambie cualquier texto de la rama Edificio
—`app/panel-edificio.js` (los dos `APUNTE_MODELO`, `SIN_PARTES`, `INTRO_CAPAS`,
`MOTIVO_SIN_CAPAS`), `app/cableado-edificio.js` (`MENSAJE_SIN_AUTOGUARDADO` y los
dos mapas de resumen) y `app/rama.js` (los dos motivos de los CTA apagados)—,
porque el **12.9** es sobre la LECTURA y **el 12.1 es sobre lo que esos textos
MIDEN**: cada línea que crezca sale de la lista de partes. Se repite además cuando
cambien `viewer/partes.js` o su pane (`viewer/_comun.js#PANES`): el color, la
opacidad del relleno y el emergente son juicio visual, y el **12.3** es lo que
justifica que las huellas se pinten. El **12.1**, con **cada altura de ventana
nueva** (el reparto no es de la app, es del entorno) y **obligatoriamente cuando se
arregle el defecto A**. El **12.7**, con cada cambio de `services/edificio.js` o de
`gml/parse-bu.js`, y respetando su régimen de red. El **12.10**, con cada CAD
distinto, igual que el 11.4. Los disparadores del mecanismo son los de
`13-edificio.js` (`GUION.md` §8 y §19).

⛔ **Y toda la lista, ahora.** Se recorrió el 2026-08-02, salieron **tres defectos
reales** (encabezado del punto 9), se corrigieron los tres y **la lista no llegó a
firmarse**. Hay que volver a recorrerla entera con las correcciones puestas: es la
propia regla de esta sección, y esta vez con el motivo delante. La cadena
bloqueada es **F03 → F05 → F06 → F07 → F08 → F09 → F10 → F11**.

⛔ **Y hay un motivo NUEVO para no firmar todavía**: el punto 12 llega con un
**residuo ya medido** (`GUION.md` §19). De los dos defectos que encontró el guion,
el contradictorio está cerrado y el panel ya cabe; y el tercer arreglo —la
advertencia del autoguardado, que se decía dos veces— cerró además los avisos en los
dos estados. Queda **una sola cosa**: con 7 partes cargadas la lista mide **7,06 px**
y **no se ve ni una fila**. Recorrer el §12.1 no es descubrirlo —eso ya está hecho—
sino **decidir de dónde salen los 18,33 px** que faltan (8,84 de ellos están al lado,
en el margen de `#avisos`), y esa decisión es de producto. ⚠️ Y hay que tomarla
**antes de F12**, que añade las plantas por parte y entra en un panel con **0 px** de
holgura en la lista.

⛔ **F17 añade su propia cadena, y es la más corta de firmar y la más cara de
saltarse.** El punto **13.1** se repite cuando cambie cualquier texto de la lista
del sobrante (`viewer/lista-sobrante.js`: `SIN_PIEZAS`, `MOTIVO_SIN_DERIVAR`,
`MOTIVO_NINGUNA_INCLUIDA`, `MOTIVO_FOTO_CADUCA`, `ROTULO_ESTRECHA` y el contador) o
los motivos de `app/cableado-derivacion.js`, **y con cada altura de ventana nueva**:
a 1280×720 el margen sobre el suelo es de **1,57 px** y el síntoma es mudo. El
**13.2** se repite **con cada cambio del serializador o de la identidad** —
`gml/serialize-cp.js`, `gml/ids.js`, `derivacion/identidad.js`—, porque lo que se
firma ahí no es la aplicación, es **lo que la Sede acepta**, y eso solo lo sabe la
Sede. Los disparadores del mecanismo son los de `16-derivar-cesion.js`
(`GUION.md` §8 y §25).

---

## 14 · Entrada de parcela por fichero ⟨F18⟩ — lo que `17-medicion-propia.js` no firma

**Por qué está aquí.** F18 no añade una función nueva: **abre una puerta que llevaba
doce fases con el cartel puesto**. La pantalla de Entrada anuncia tres formas de
empezar un expediente y una de ellas —«Medición propia · tu levantamiento en `.dxf`
o un volcado de coordenadas en `.txt`»— rechazaba el fichero con un aviso.

El guion 17 mide el modal, los píxeles, los `<path>` y el rechazo del listado propio,
y ya encontró y cerró un defecto real (`GUION.md` §26). Lo que queda aquí son **tres
puntos**, y el primero es **BLOQUEANTE**.

### 14.1 · ⛔ BLOQUEANTE · Un plano REAL de trabajo, y que el reparto por capas se entienda

Coge **un DXF tuyo de un encargo de verdad** —no `UTM.dxf`, que ya es fixture— y
suéltalo con la rama Parcela puesta.

- [ ] La lista de capas que se ofrece **te dice algo**: reconoces tus capas por el
      nombre y por cuántas polilíneas trae cada una.
- [ ] Eliges una y entra **la parcela que esperabas**, no otra cosa.
- [ ] La superficie que sale coincide con la que tú tienes medida.

⚠️ **Y la pregunta que solo puede contestar una persona:** ¿se entiende, sin que
nadie te lo explique, **por qué la aplicación te pregunta** en vez de elegir ella? La
decisión entera («ofrecer, no adivinar») se apoya en eso, y tiene detrás un hecho
medido en F11: en `UTM.dxf` la parcela de verdad está en la capa `0` y **no** en la
que se llama `PARCELA`. Elegir por el nombre falla en el único plano real que hay.
Si la pantalla se lee como un trámite, la decisión está mal presentada aunque sea
correcta.

### 14.2 · El recorrido que el guion no puede andar: medición contra parcelario

Exige red, así que no lo firma ninguna máquina de este proyecto.

- [ ] Trae una parcela **del Catastro** por su referencia.
- [ ] Suelta encima **tu levantamiento** de esa misma parcela.
- [ ] La geometría oficial **sigue ahí** (se ve por debajo) y la referencia catastral
      **no se ha perdido**.
- [ ] **El Diagnóstico de encaje se abre sin traer nada más**, y las cifras que da
      tienen sentido para ti.

Es el flujo real del perito —*traigo la oficial, meto mi levantamiento, contrasto*— y
es lo que hace que esta fase valga algo más que «ya se puede abrir un DXF».

### 14.3 · Que no se lea como un veredicto (heredado de F07, F08 y F09)

- [ ] Ninguna frase de la pantalla de revisión —ni las de las correcciones que se
      ofrecen, ni el motivo por el que algo no ha entrado— se lee como un **juicio
      sobre tu levantamiento**. La aplicación describe lo que ha visto y ofrece; no
      dictamina si tu medición está bien.
- [ ] El rótulo de la cabecera deja claro, de un vistazo, que lo que hay en pantalla
      **es tuyo y no del Catastro**. (Esto es lo que falló en la primera corrida del
      guion: decía «Parcela del Catastro». Míralo con tus ojos, no solo en verde.)

---

**14.1** se repite **con cada cambio de `parsers/dxf.js`, `parsers/importar.js` o del
diálogo de revisión**: lo que se firma ahí no es que el código funcione —eso lo dicen
6.339 pruebas— sino que **un técnico entiende lo que la aplicación le está
preguntando**, y eso solo lo sabe un técnico.

---

## §15 · F19 · El pegado, los grados y el rótulo del GML ajeno

Las tres deudas que F18 sacó de su alcance con casa escrita. El guion 18 sale
`ok:true` sobre las tres, pero lo de aquí abajo **ninguna máquina de este proyecto
lo puede firmar**.

### 15.1 · El `Ctrl+V` de verdad — ⛔ BLOQUEANTE

⚠️ **Medido el 2026-08-06: Chromium NO aplica el pegado por defecto de un
`ClipboardEvent` sintético**, así que el guion escribe el valor en el campo y lo dice
como advertencia. **El gesto real está sin medir por definición.**

- [ ] Abre AutoCAD (o ZWCAD) con un plano **de trabajo de verdad**, ejecuta `LISTA`
      sobre la polilínea de la parcela y **copia con `Ctrl+C`**.
- [ ] En la aplicación, «Pegar coordenadas…» → **`Ctrl+V`** con el teclado.
- [ ] El texto aparece en el campo **a la primera**, sin tener que hacer clic dentro.
- [ ] Debajo, sin pulsar nada más, aparece **cuántos vértices** se han entendido y
      **las dos superficies** (la que declara tu dibujo y la que calcula la app).
- [ ] Las dos cifras **cuadran con lo que sabes de esa parcela**. Si no cuadran, la
      aplicación lo dice y **te deja cancelar sin haber metido nada**.

### 15.2 · Que se entienda por qué se pregunta antes de proyectar

- [ ] Pega unas coordenadas **en grados** (lat/lon) de una parcela tuya.
- [ ] Lo que la pantalla dice —**dónde ha caído** y **en qué huso**— te basta para
      decidir, sin que nadie te lo explique, si eso es tu parcela o no.
- [ ] La opción marcada de salida es **no tocar el dato**, y eso te parece lo
      correcto y no un estorbo.
- [ ] Tras aceptar, la parcela cae **donde tenía que caer** sobre la cartografía.
      (Esto es lo único que de verdad prueba que la proyección es la buena: los
      números cuadran en un test, pero que el polígono se superponga al parcelario
      real solo lo ves tú.)

### 15.3 · El rótulo del GML ajeno

- [ ] Con el GML de otro técnico cargado, la cabecera dice que es **de otro técnico**
      y **no del Catastro**, y eso se entiende de un vistazo.
- [ ] Al pulsar «Tomar esta geometría y editarla», el rótulo cambia a **«tomado como
      tuyo»** — y esa frase **no se lee como si tú la hubieras medido**, porque no la
      mediste.
- [ ] Ninguna de las dos frases se lee como un **juicio sobre el trabajo del otro
      técnico** (heredado de §9).

---

**15.1 es BLOQUEANTE** y se repite **con cada cambio de `app/dialogo-pegado.js`**: lo
que se firma ahí no es que el código funcione —eso lo dicen 6.393 pruebas y el guion
18— sino que **el gesto más corto que tiene el técnico llega a alguna parte**, y ese
gesto no lo puede hacer una máquina de este proyecto.

---

## §16 · F12 · Partes, plantas y el recinto que se dibuja a mano

**Lo que `19-partes-plantas.js` NO firma.** El guion mide que quepa, que se
pinte, que se guarde y que los números salgan. Lo de aquí abajo es lo que solo
puede decir alguien que trabaje con edificios: si lo que sale **se entiende**, y
si es **lo que un técnico esperaba**.

Antes de empezar: abre la aplicación, conmuta a **Edificio** y suelta
`test/fixtures/gml/bu_buildingpart_9398516VK3799G.gml`. Son las trece partes
reales de la parcela 9398516VK3799G.

### 16.1 · La lista y su ficha: ¿es una lista con detalle, o dos cosas sueltas?

- [ ] Ve a **Edición**. Arriba hay una lista de partes y debajo un bloque con la
      parte elegida. **Léelos seguidos, sin tocar nada.** ¿Se entiende que el de
      abajo habla de la fila marcada? ¿O parecen dos secciones que no se hablan?
- [ ] Elige otra parte. ¿**Ves** que ha cambiado el bloque de abajo, o tienes que
      buscar la diferencia? Un cambio que hay que buscar es un cambio que en una
      sesión de dos horas se pasa por alto.
- [ ] ⭐ A 1280×720 la lista se queda en **tres filas** de las catorce (es un
      suelo puesto a propósito: sin él el reparto la aplasta a dos). **Trabaja
      así diez minutos**: elige partes, mira sus plantas, vuelve atrás. ¿Tres
      filas bastan para saber dónde estás, o te pierdes cada vez que te
      desplazas? Si te pierdes, el suelo tiene que subir — y lo paga el bloque de
      abajo, que es donde está la tabla de coordenadas.
- [ ] Si tienes pantalla grande, mira lo mismo a 1440×900 (allí caben cuatro).
      ¿La diferencia entre tres y cuatro filas cambia la sensación?

### 16.2 · Las plantas: el dato que distingue un volumen de otro

- [ ] Elige una parte principal. Salen **dos contadores**: plantas sobre rasante
      y bajo rasante, con la ayuda «bajo rasante = sótanos; rasante es la línea
      del terreno». ⭐ **¿Esa frase te hace falta, te sobra, o dice lo que no
      es?** Está escrita para alguien que no es topógrafo.
- [ ] Cambia el tipo de la parte a **«Otra»** (una piscina, un porche). Los dos
      contadores **desaparecen**: no se apagan, no se quedan en blanco — no
      están. ¿Se lee como «esto no aplica» o como «se ha roto algo»?
- [ ] ⛔ **Y ahora el juicio que ninguna máquina puede hacer.** El fichero real
      trae `Parte 10` con **0 plantas sobre rasante y 1 bajo**: es un sótano, y
      es la parte **MÁS GRANDE** del edificio (245,90 m² de 568,03 en total).
      Búscala en la lista. **¿Se ve que es un sótano sin abrirla?** Su rótulo en
      el mapa es `(−1)`, sin romano delante. Si tienes que abrir cada parte para
      saber cuáles cuentan, la lista no está diciendo lo que hace falta.
- [ ] Hasta esta fase las plantas del fichero **se tiraban** y la aplicación lo
      decía. Ahora entran. Lee el aviso que sale al cargar: enumera las trece
      («sobre rasante 1, 7, 7, 6…»). ¿Sirve de algo esa lista de números, o es
      ruido que te tapa un aviso que sí importa?

### 16.3 · El mapa: los romanos y la envolvente

- [ ] Mira las huellas. Cada una lleva su rótulo en romano (`VII`, `VI`,
      `VII (−1)`). **¿Se leen sobre el ortofoto?** Prueba con la capa aérea y con
      la del Catastro: el fondo cambia mucho.
- [ ] ¿**Estorban**? Trece rótulos sobre trece huellas pequeñas pueden ser más
      ruido que dato. Si te estorban, dilo: la alternativa es enseñarlos solo
      para la parte activa.
- [ ] ⭐ **La envolvente.** Con las plantas reales, la línea de «envolvente
      calculada» **deja fuera la parte más grande** —el sótano— y el edificio
      pasa de 568,03 m² a 322,13. Míralo en el mapa. **¿Se entiende POR QUÉ falta
      ese trozo?** Es correcto y es contraintuitivo: si a ti te chirría, a quien
      firme el GML también.
- [ ] Cambia a `0` las plantas sobre rasante de otra parte y mira cómo se
      redibuja la envolvente. ¿El cambio es visible? ¿Te avisa de algo, o la
      línea se mueve en silencio?

### 16.4 · Dibujar un recinto: el caso del encargo real

- [ ] Pulsa **«Añadir parte»**. Aparece al final de la lista, ya elegida, con el
      renglón «pendiente de dibujar el recinto». ¿Sabes **qué hacer a
      continuación** sin que nadie te lo diga?
- [ ] Pulsa **«Dibujar recinto»** en la barra sobre el mapa. Pincha cuatro
      esquinas y cierra con doble clic. ⭐ **¿El enganche al parcelario ayuda o
      estorba** al declarar un porche pegado a la fachada? Prueba con `Alt`
      sostenida, que lo apaga.
- [ ] Empieza otro y pulsa **`Escape`** a medias. ¿Queda claro que no se ha
      guardado nada?
- [ ] Abre la **Ayuda** de la barra **mientras dibujas**. Los cuatro gestos del
      dibujo están ahí desde esta fase (antes no estaban). ¿Los encuentras? ¿La
      columna «dónde» te deja claro que el mismo clic hace dos cosas distintas
      según si hay un trazo abierto?

### 16.5 · Lo que se guarda y lo que no — léelo con cuidado

- [ ] ⛔ **Esta rama estrena autoguardado en F12, y el mensaje cambió entero.**
      Antes decía «esta rama **no se guarda sola**… exporta el dibujo desde tu
      CAD»; ahora distingue **guardar el trabajo en curso** de **archivarlo con
      nombre**. Lee las dos versiones (el renglón de procedencia y la tarjeta del
      panel). **¿Esa distinción se entiende sin haber leído el código?**
- [ ] La prueba de fuego: **dibuja un recinto, recarga la página y recupera el
      trabajo cuando te lo ofrezca.** ¿Vuelve lo que habías hecho? ¿La oferta te
      dice **de qué** es —«de la parcela … y del edificio …»— o tienes que
      aceptarla para averiguarlo?
- [ ] Abre **«Expediente»** con la rama Edificio puesta. «Guardar» está apagado y
      el motivo dice que la lista de expedientes es de la rama Parcela. ⭐ ¿Ese
      motivo te parece **una limitación entendible** o **una avería**? Y lo que
      más importa: después de leerlo, **¿crees que tu edificio estará ahí
      mañana?** Si la respuesta es que sí, la frase no ha servido de nada.
- [ ] Trabaja con un edificio, carga **otro** encima y comprueba que el aviso te
      había advertido de que el trabajo en curso es UNO. ¿Te enteraste a tiempo?

### 16.6 · El pliegue del selector de modelo

- [ ] Al entrar un edificio, el selector de modelo (Simplificado / Completo) se
      pliega a un renglón. Son **174,41 px** que vuelven al panel. ¿Echas de
      menos verlo? ¿Encuentras la forma de volver a abrirlo sin buscarla?
- [ ] Cámbialo a **Completo** con partes ya cargadas. ¿Entiendes qué acabas de
      cambiar y a qué afecta?

---

## §17 · F20 · El listado de coordenadas en Excel

**Ninguna máquina de este proyecto puede firmar esto.** La suite comprueba los
bytes, `npm run validar:xlsx` se los da a openpyxl y el guion `12` los mide en un
navegador real — y **openpyxl no es Excel**. Es literalmente la lección que costó
el DXF: `ezdxf` daba verde a un fichero que dejaba **ZWCAD 2023 en blanco y
bloqueado**, porque un lector tolerante rellena por su cuenta lo que falta y
responde por su modelo, no por el fichero. Lo destapó una persona.

### 17.1 · ⛔ BLOQUEANTE — que Excel lo abra, y sin una queja

- [ ] Trae una parcela, abre **«Expediente» → «Exportar coordenadas (.xlsx)»** y
      **ábrelo con Excel de verdad** (no con el visor del navegador, ni con Google
      Sheets, ni con LibreOffice: esos van después).
- [ ] ⛔ **¿Sale algún aviso al abrirlo?** «Hemos encontrado un problema con el
      contenido…», «formato no coincide», «vista protegida» con reparación. Si
      aparece cualquiera de ellos, **esto no está entregado**: apunta el texto
      literal y la versión de Excel.
- [ ] Ábrelo también en **LibreOffice Calc** y en **Google Sheets** (subiéndolo).
      Es el mismo reparto que F09 pidió para el PDF: un fichero que solo abre en
      un programa no está exportado, está de suerte.

### 17.2 · ⛔ Lo que de verdad justifica la fase: que se pueda CALCULAR

Esto es lo que el `.txt` no permitía, y por lo que existe F20. Si falla, la fase
no sirve para nada aunque el fichero abra.

- [ ] Ponte en una celda vacía y escribe `=SUMA(B10:B24)` sobre la columna de la X.
      **¿Da un número o da 0?** Si da 0, las coordenadas han entrado como TEXTO.
- [ ] Ordena la tabla por la columna Y. ¿Ordena por valor o alfabéticamente
      (`1.000` antes que `999`)? Lo segundo es el mismo defecto.
- [ ] Mira una coordenada: **¿la ves con coma decimal?** El fichero guarda
      `372516.02` y es Excel quien tiene que pintarlo `372516,02` en un equipo en
      español. Si ves el punto, el formato no ha llegado.
- [ ] La celda de **Superficie** enseña `1.510,87 m²`. Pincha en ella y mira la
      barra de fórmulas: **tiene que haber un número, sin el «m²» dentro**. La
      unidad va en el formato. Y ⚠️ verás la cifra COMPLETA
      (`1510,865149996761`): es correcto y está declarado — el redondeo es de la
      presentación, no del dato.

### 17.3 · Que sirva para lo que se pide un Excel

- [ ] **Copia las tres columnas y pégalas** donde de verdad las vayas a usar.
      ¿Llegan como números? ¿Hace falta tocar algo?
- [ ] Con una parcela **con huecos**: hay una pestaña por recinto. ¿Los nombres
      («Contorno exterior», «Hueco 1») te dicen lo que son? ⭐ Y la pregunta que
      solo contestas tú: **las medidas están solo en la primera pestaña**, porque
      la superficie es la NETA de la parcela entera. ¿Se entiende, o parece que a
      las otras les falta algo?
- [ ] ¿Las columnas tienen el ancho suficiente? **Una coordenada que se ve
      `#####` no está.**
- [ ] Imprímelo, o mira la vista previa. ¿Cabe? ¿Se lee?

### 17.4 · Lo que dice de sí mismo

- [ ] Al pie hay un aviso de que esta hoja **no se puede volver a cargar en la
      aplicación** y de que la primera columna es el número de vértice. ¿Lo
      encuentras sin buscarlo? ¿Te queda claro que para retomar el trabajo hay que
      usar el fichero de proyecto?
- [ ] Punto BLOQUEANTE heredado del 8.1, 9.4, 10.5 y 11: **¿alguna celda se lee
      como un veredicto?** Este libro enumera y suma; no dice si la parcela está
      bien. Si alguna frase suena a «esto está correcto», es un defecto.
- [ ] Baja **el `.txt` y el `.xlsx` de la misma parcela** y compáralos. Tienen el
      mismo prefijo y la misma marca de tiempo a propósito. ⭐ **¿Dicen lo mismo?**
      Misma superficie, mismo perímetro, y el vértice 7 de uno es el vértice 7 del
      otro. Si no coinciden, es el defecto más grave que puede tener esta fase.

---

## §18 · F13 · El GML de edificio, y el único juez que cuenta

✅ **HECHO, Y CON DOS DESENLACES.** El 2026-08-06 la Sede **rechazó** el fichero;
el 2026-08-07, corregido, salió **POSITIVO con CSV `E1HTN9QN6AKZB4XY`**. No es un
guion hipotético: es el que encontró el defecto. Queda aquí porque hay que
repetirlo **cada vez que se toque el serializador**, y porque de él salieron dos
hallazgos que siguen sin dueño (18.2 y 18.3).

**Lo que pasó, en una línea:** el ICUC contestó «*Los siguientes ficheros no se
han cargado al no ser válidos*», sin más detalle, a un fichero que **validaba
contra su propio esquema**. Faltaba `xmlns:xlink` en la raíz — que ningún
elemento usa, que el XSD no exige y que la ayuda no menciona. Se acotó bisecando
en cuatro rondas de subida y **está corregido**, con guardián en la suite y en el
guion 20. El relato entero: `spec/feature-13-edificio-gml.md`, «El rechazo del
ICUC».

**Y la lección para esta lista, que es la que justifica que exista:** las 6.899
pruebas estaban en verde, el guion 20 daba `ok:true`, `npm run validar:xsd` daba
OK contra el esquema oficial… y el fichero no se cargaba. **Ninguna máquina de
este proyecto podía verlo.** Es exactamente lo que pasó con el DXF que no abría
en ningún CAD y con el GML que el IVG rechazó en julio.

### 18.1 · ✅ HECHO — ICUC POSITIVO el 2026-08-07

| | |
|---|---|
| **Resultado** | ⭐ **POSITIVO** |
| **CSV** | `E1HTN9QN6AKZB4XY` |
| **Parcela** | `9398516VK3799G` — CL SAN RESTITUTO 72 (C), Madrid |
| **Fichero** | `edificio_9398516VK3799G_2026-08-07T08-14-11.gml`, 3.672 B |
| ⭐ **Superficie de huella** | el informe dice **322 m²**; la app dice **322,13** |

Ya no hay que repetirlo salvo que cambie el serializador. **Si lo cambias, esto
vuelve a ser bloqueante**: la suite daba verde y la Sede rechazó el fichero el día
anterior.

### 18.2 · ✅ CONTESTADO — el ICUC NO tiene «Tipo de operación»

Se preguntaba porque F17 entregó el desplegable Segregación / Subsanación para el
**IVG** (parcela) y el formulario del ICUC **no se había medido nunca**. Medido:
**ese campo no existe**. O20 no se propaga a edificio.

⚠️ **Lo que sí tiene su paso 1, y la app no sabe nada de ello:**

- **Datos del técnico**: NIF y nombre (del certificado), **email** y **teléfono**
  obligatorios, **identificación profesional** (titulación, lista cerrada) y
  **fecha de toma de datos del trabajo profesional**.
- **Especificaciones del trabajo profesional**: ⭐ **precisión del trabajo** en
  metros (obligatoria, 0,000–9,999), **metodología de captura** (GNSS…) y
  **¿existe desplazamiento de la cartografía?** con sus seis parámetros
  (`AX BX CX AY BY CY`).

Se teclea a mano y viaja en el XML adjunto al informe, no en el GML. **El ICUC no
es «subir un fichero»**: es un trámite con formulario, y la app cubre la mitad.

- [x] ⛔ ~~**Decisión pendiente del autor**: `horizontalGeometryEstimatedAccuracy`
      sale `xsi:nil` porque se decidió «no afirmar una precisión que no se ha
      medido»… y **la Sede la exige tres pantallas antes**.~~ ✅ **CONTESTADA y
      ENTREGADA por F21 el 2026-08-07**: sí merecía, y entró junto al otro hallazgo.
      La precisión se teclea en el `<dialog>` «Especificaciones del trabajo
      profesional» (botón **«Trabajo»** en la fila de «Origen del edificio»), **en
      los dos modelos**, y llega al GML con su `uom="m"`. Sin declararla sigue
      saliendo `xsi:nil`, que es verdad. ⚠️ **Solo la precisión**: el resto del paso
      1 del ICUC no cabe en el GML y la propia pantalla dice que no lo guarda.

### 18.3 · Lo que el fichero dice, y lo que se calla

- [ ] Abre el `.gml` descargado con un editor de texto. **¿Ves un solo
      `Building`, y ninguna `BuildingPart`?** Es a propósito: la ayuda oficial del
      ICUC dice que solo procesa `Building` con `footPrint` u `OtherConstruction`,
      así que emitir trece partes sería meter en un documento firmado trece
      afirmaciones que nadie comprueba. **¿Te parece bien esa decisión ahora que
      la ves?** Si el ICUC las necesitara, esto habría que rehacerlo.
- [x] ⛔ ~~**La piscina, y aquí hay un defecto MEDIDO (2026-08-07).** Si la
      construcción entró por un GML del Catastro que la trae, `edificio/entrada.js`
      la convierte en parte **PRINCIPAL**… cámbiale el tipo a «Otra» antes de
      generar, o la superficie que declares será mayor que la real.~~
      ✅ **ARREGLADO por F21 el mismo día.** Entra con su tipo, sin tocar nada.
      Y el enunciado de arriba se quedaba corto: **no había forma de que saliera
      bien** — tal cual entraba, «Generar GML» estaba APAGADO porque la validación
      le exigía a la piscina unas plantas que una piscina no tiene, así que para
      desbloquearlo había que teclear un dato falso. Con «1 planta» la huella salía
      **406,69 m²** (84,56 de más); con «0», salía 322,13 pero **declarando la
      piscina sótano** y sin emitirla. Ahora: **322,13 m² + su `OtherConstruction`**,
      que es lo que el ICUC aceptó.
- [ ] ⭐ **Compruébalo tú una vez, que esto no lo ha visto la Sede.** Carga el
      edificio de `9398516VK3799G` **desde el Catastro en vivo** (no por fichero) y
      mira la lista de partes: la última tiene que decir **«Otra construcción»**.
      Abre el `.gml` y comprueba que hay **un `OtherConstruction` con `openAirPool`**
      y que la huella del `Building` **no** lo incluye. ⚠️ **El fichero que la Sede
      aceptó era el de F13, sin piscina**: que un GML CON `OtherConstruction` cargue
      en el ICUC **está sin medir**.
- [ ] `numberOfFloorsAboveGround` lleva **el máximo** de las partes sobre rasante.
      Míralo contra el edificio real: ¿es el número de plantas que declararías?
- [x] ~~`horizontalGeometryEstimatedAccuracy` va **nulo**… **¿Estás de acuerdo, o
      prefieres poder declararla?**~~ ✅ **F21 la hace declarable** y mantiene el
      nulo como valor por defecto: seguimos sin copiar el `0,1 m` del Catastro —eso
      es una afirmación suya sobre SU dato—, pero ahora el técnico puede poner la
      suya. Sin tocar nada, el fichero sigue saliendo exactamente igual que antes.
- [ ] ⭐ **Y míralo con tu número puesto.** Pulsa **«Trabajo»**, teclea la
      precisión que declaraste en la Sede (en el envío real fueron **0,010 m,
      GNSS**), genera el GML y comprueba que dentro pone
      `<bu-core2d:horizontalGeometryEstimatedAccuracy uom="m">0.01</…>`. **¿Es el
      número que firmarías?** Y al revés: bórralo, vuelve a generar, y comprueba que
      vuelve el `xsi:nil` — no declarar tiene que seguir siendo posible.

### 18.4 · ⛔ El resalte que la ficha pide y que NO está

La ficha §16.1 dice: «*el resalte del aviso "parte fuera de la parcela" rodea la
parte que se sale, no otra*». **Eso no está entregado.** La capa de validación
agrupa los hallazgos por parte (`porParte`) desde la fase 1, y **no hay nadie que
los pinte**: en el mapa, una parte con aviso se ve igual que las demás. Está
anotado con dueño (**F14**) en §30 del `GUION.md`.

- [ ] Con una construcción que se salga de su parcela, ¿echas de menos el resalte,
      o el aviso de texto te basta? La respuesta decide si F14 lo trae o si el
      requisito se reescribe.

### 18.5 · Lo que se ve, y solo lo firma una persona

- [ ] Con la rama **Edificio vacía**, el botón «Generar GML» está apagado y su
      motivo dice «no hay ninguna construcción cargada»… pero **no hay forma de
      llegar a esa pantalla**: sin datos, el peldaño «Validación» está apagado.
      **¿Te has encontrado buscándolo?** Si a ti no te ha estorbado, no es urgente;
      si has ido a buscar el botón y no estaba, dilo.
- [ ] Rompe el edificio a propósito (añade una parte y no le dibujes el recinto).
      El renglón dice «*1 error bloquea la generación del GML: Parte N no tiene
      recinto…*». **¿Se lee entero?** ¿Sabes qué hacer a continuación?
- [ ] Con el edificio roto, vete a la rama **Parcela** y vuelve. El botón tiene
      **dos dueños** desde F13. ¿Contesta siempre el de la rama en la que estás, o
      alguna vez te ha dado un motivo que hablaba de la otra cosa?
- [ ] Punto BLOQUEANTE heredado del 8.1, 9.4, 10.5, 11 y 17: **¿algo de lo que
      sale se lee como un veredicto?** La app mide y declara; no dice si la
      construcción está bien. Si alguna frase suena a «esto está correcto», es un
      defecto.

---

## §19 · F14 · El contraste de la construcción y su informe

**Qué está medido ya y no hace falta que repitas:** que la pantalla de Diagnóstico
de la rama Edificio monta **su** cajón y no el de parcela, que las cifras salen
(322,13 m² · 2 piezas contra el `Building` del Catastro, solape 100,00 %), que el
PDF **baja** con su nombre legal, que el resalte por parte se ve con trazo
discontinuo y del mismo color, y que nada de esto ha tocado la rama de parcela.
Todo eso lo firma `21-contraste-edificio.js`, `ok:true` en las dos ventanas.

Lo que sigue **no lo puede firmar ninguna máquina de esta carpeta**.

### 19.1 · ⭐ ¿La pantalla honesta TRANQUILIZA? — BLOQUEANTE

Es la razón de ser del estado `SIN_CONSTRUCCIONES`, y lo único que no se puede
comprobar con una aserción: **que un técnico que lee «no consta construcción
registrada» no crea que ha hecho algo mal.**

1. Carga en la rama Edificio un dibujo tuyo de una **obra nueva** (una parcela sin
   nada construido en el Catastro), escribe su referencia catastral y ve a
   Diagnóstico.
2. Pulsa **«Consultar el Catastro»**.
3. Lee el renglón de arriba entero, tal y como te lo encuentras.

> No consta construcción registrada en el Catastro para esta parcela, así que no
> hay nada con lo que contrastar. No es un problema: el contraste es un paso
> opcional y el GML que se genera es plenamente válido sin él — es justo lo que se
> espera de una obra nueva.

**Lo que hay que decidir:** ¿te deja tranquilo, o te deja con la duda de si te
falta un paso? Si es lo segundo, la frase está mal y hay que reescribirla: es el
caso NORMAL de un ICUC, no una degradación.

⚠️ Y comprueba que las celdas de debajo dicen **«No consta ninguna»** y no «Sin
consultar»: son dos cosas distintas y la aplicación las escribe distinto a
propósito.

### 19.2 · El informe, abierto en un lector de PDF de verdad

El guion mide que baja y cuántas páginas trae. Lo que tienes que mirar tú:

- **La ficha de partes**: ¿las plantas son las que declaraste? ¿Las partes de tipo
  **Otra** (una piscina) salen con **`—`** en las dos columnas de plantas, y no con
  un «0»? Un cero ahí sería mentira; el guion no sabe cuál de los dos es correcto.
- **La nota al pie de la envolvente**: ¿se entiende por qué el sótano no cuenta?
- **El nombre del documento en la portada**: con contraste tiene que decir «Informe
  de contraste con la construcción catastral»; sin contrastar, «Informe de
  construcción para la Sede Electrónica». Que cambie está medido; **que el nombre
  sea el correcto para lo que vas a presentar es tu criterio**.
- **El plano**: ¿se ven las DOS huellas —la tuya y la del Catastro— y se distinguen?

### 19.3 · ⛔ El pie de firma: límite conocido de esta fase

**En la rama Edificio no hay diálogo de firma.** El informe toma el pie que el
navegador recuerde de haber marcado «Recordar mis datos» en el informe de
**parcela** (F09); si no hay ninguno guardado, sale con **«No consta»** en los
cuatro campos y la aplicación **lo dice** en el renglón y en el panel de avisos.

**Lo que hay que decidir:** ¿te vale así, o hace falta capturar la firma desde esta
rama? No es un olvido: está declarado en la ficha de F14 con sus tres motivos —el
diálogo de F09 exige un lindero, ofrece un «Tipo de operación» que el ICUC no pide,
y una segunda instancia colisionaría por selector con la primera—. Si lo quieres,
es alcance de otra fase.

### 19.4 · El resalte por parte, con tus ojos

El guion comprueba que existe y que no cambia de color. Míralo tú con un edificio
de verdad: **¿el trazo discontinuo rodea la parte de la que habla el aviso, y no
otra?** Es literalmente lo que la ficha §16.1 pidió, y lo que no se puede afirmar
sin mirar el mapa y el renglón a la vez.

### 19.5 · Lo que NO es de esta lista

El **ICUC no ve este informe**: es papel del colegiado. El GML sí pasó, y su CSV
está en §18. Aquí no hay verdad externa que buscar — hay criterio profesional.
