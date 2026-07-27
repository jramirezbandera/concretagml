# Checklist humano — F03 · Fase 5

Lo que **ninguna máquina de este proyecto puede firmar**. El smoke automático
(`GUION.md`) mide los cinco criterios de aceptación en un navegador real y sale
`ok:true` en las dos pasadas; la suite (1.173 pruebas) cubre la lógica. Queda
esto, que es de otra naturaleza: **gestos de ratón de verdad** y **juicio
visual**.

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

## Qué hacer con el resultado

- **Todo conforme** → F03 se marca hecha (`README.md` §Estado y `spec/SPEC.md`).
- **Algo del punto 1, 2 o 3 falla** → es un defecto real del visor. Protocolo del
  plan: **no se parchea desde la app ni desde el test**; se abre tarea con
  propiedad exclusiva del módulo de `viewer/` y de su test unitario.
- **Algo del punto 4 o 5 no gusta** → es ajuste de presentación, vive en
  `estilos/app.css` o en una opción de `crearVisor`, y no bloquea F03.

## Cuándo repetir esta lista

Con el smoke automático (`GUION.md` §8): en **F06**, cuando cambie la maquinaria
de arrastre —el punto 1 es exactamente lo que F06 reescribe—, y en **F16**, sobre
la URL desplegada, cuando `base` cambie para GitHub Pages.
