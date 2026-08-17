// scripts/smoke-navegador/23-fondo-catastral.js — las DOS PUERTAS del Catastro.
//
// ── POR QUÉ ESTE GUION EXISTE ───────────────────────────────────────────────
// Hasta el 2026-08-08, cargar una medición propia (DXF, TXT, GML) y después
// traer la parcela del Catastro **destruía la medición**: `aplicar()` construía
// la parcela desde cero y metía la geometría del WFS en `recintos` **y** en
// `geometriaOficial` a la vez. Y como el gancho de carga reiniciaba el
// historial, la pérdida tampoco volvía con Ctrl+Z: era irreversible dentro de la
// sesión.
//
// ⛔ **Y OCHENTA Y TRES PRUEBAS PASARON POR DELANTE SIN VERLO.**
// `test/app/catastro.dom.test.js` define `parcelaSinReferencia()` —una parcela
// DXF en el store— y la usa como `parcelaInicial` en unas veinte pruebas; una de
// ellas llama a `cargar()` con esa medición cargada. **Ninguna afirmaba sobre la
// geometría resultante**: afirmaban sobre botones, oyentes y transporte. El
// fichero pasó por delante del defecto veinte veces sin mirarlo.
//
// El arreglo son DOS PUERTAS con nombre propio, en vez de una que adivina:
//
//   | Puerta | Dónde | Qué hace |
//   |--------|-------|----------|
//   | «Traer del Catastro»            | Entrada    | Documento nuevo: el WFS ocupa `recintos` **y** `geometriaOficial`. |
//   | «Traer el parcelario de fondo»  | Validación | Solo el fondo: `recintos` intactos, entra `geometriaOficial`. |
//
// ── QUÉ MIDE, Y POR QUÉ NO LO PUEDE MEDIR LA SUITE ──────────────────────────
// La suite cubre los dos compositores, los dos ganchos, el reencuadre del
// historial y el estado de los botones (7.211 pruebas). Lo que jsdom **no**
// puede decir es lo que este guion mide, y son tres flujos ENTEROS:
//
//   1. **El flujo que rompía, de punta a punta y con el Catastro de verdad.**
//      Soltar un levantamiento → pulsar «Traer el parcelario de fondo» → que los
//      vértices sigan ahí, uno por uno, y que el parcelario aparezca debajo. En
//      jsdom la geometría se compara en memoria; aquí se cuenta lo que el
//      usuario ve en la tabla y en el mapa.
//   2. **Que el aviso ya no manda a la trampa.** El texto que decía «tráelo
//      desde Entrada» mandaba a la pantalla donde el único botón que había era
//      el que borra la medición. Se lee el texto RENDERIZADO, no la constante.
//   3. **Que se enciende lo que ya estaba construido.** Con el fondo puesto,
//      «Diagnosticar encaje» y «Rehacer el parcelario» dejan de estar grises. Son dos
//      features cerradas (F07 y F17) que desde el flujo «medición primero» eran
//      INALCANZABLES, y no por falta de código: por falta de contorno oficial.
//
// ⚠️ **Y la deducción encadenada, que es la mitad menos obvia.** Un `.dxf` no
// trae referencia catastral, así que el botón no tendría con qué pedir el
// parcelario. `cablearDiagnostico` encadena `catastro.deducir()` —punto INTERIOR
// de la geometría → OVC → referencia— antes de traer el fondo. Ese
// encadenamiento toca DOS servicios reales y solo se puede medir aquí.
//
// ── CÓMO SE LANZA ───────────────────────────────────────────────────────────
// Con la aplicación servida (vale `npm run dev` y vale `vite preview`: este
// guion no lee ningún fixture del disco) y la página RECIÉN CARGADA:
//
//   $B viewport 1280x720
//   $B goto http://localhost:PUERTO/concretagml/?demo=hueco   # ⛔ hueco, NO real
//   $B wait ".gml-rail-pasos"
//   $B console --clear
//   $B network --clear
//   $B eval scripts/smoke-navegador/23-fondo-catastral.js
//   $B console --errors
//
// ⛔ **`?demo=hueco` Y NO `?demo=real`, y la diferencia lo es todo.** El estado
// del que parte esta feature es «hay geometría de trabajo y NO hay parcelario», y
// el dataset `hueco` es exactamente eso: una parcela sintética con exterior y
// hueco, **sin `geometriaOficial` y sin referencia catastral**. `real` traería la
// parcela del Catastro con su contorno oficial ya dentro, y el guion mediría otro
// caso — el de traer un fondo sobre un fondo.
//
// ⚠️ **Y sus coordenadas no son un detalle**: el rectángulo sintético cae a unos
// 20 m de la parcela real 9398516VK3799G, o sea **en una manzana de verdad**. Eso
// es lo que permite que la deducción encadenada tenga a quién preguntarle: el OVC
// contesta con una parcela catastral real para ese punto.
//
// ── POR QUÉ NO SE CARGA UN FICHERO, QUE ERA EL PLAN ─────────────────────────
// La primera versión de este guion soltaba un `.txt`. Dos hallazgos, los dos
// medidos aquí y los dos útiles:
//   1. Un formato «Nº X Y» inventado en este fichero hizo que el parser leyera el
//      número de vértice como la coordenada Este: el panel avisó de que «el
//      centroide (8.00, 439244.38) no cae en la España peninsular» y entraron
//      CERO vértices. Es la lección que el guion 17 ya tenía escrita: un listado
//      escrito a mano en un guion es un segundo formato, y los segundos formatos
//      divergen.
//   2. Y usar el serializador REAL de la app tampoco vale: `esListadoDeReplanteo`
//      **rechaza a propósito** el `.txt` que la propia aplicación exporta —«su
//      primera columna es el número de vértice, no la X»—, que es un defecto
//      cazado en F18 y hoy es una guarda.
// La entrada por fichero ya tiene su guion (el 17). Aquí lo que se mide es lo que
// pasa DESPUÉS, y para eso el dataset sintético es un punto de partida más
// estable y sin formatos que adivinar.
//
// ⚠️ **Recarga entre pasadas.** Deja una parcela cargada, el historial sembrado
// y el parcelario traído. Una segunda corrida sin recargar empezaría desde ahí.
//
// ⚠️ **Toca la red de verdad** (OVC + WFS del Catastro), como el guion 07. Si el
// servicio está caído, el guion lo DICE y distingue «no se ha podido preguntar»
// de «la respuesta fue mala»: un fallo de red no puede leerse como un defecto de
// esta casa.
//
// ── ⭐ ESTE GUION SABE FALLAR, Y ESTÁ MEDIDO ────────────────────────────────
// Un guardián que nunca ha visto fallar no sabe fallar. Con el defecto original
// restaurado a mano en `app/cableado-catastro.js` (`conservaLaMedicion` fija en
// `false`), recargar y relanzar da `ok:false` con DOS problemas, y son el
// síntoma exacto que el autor tenía en sus capturas:
//
//   · «TRAER EL PARCELARIO HA CAMBIADO LA MEDICIÓN. La tabla tenía **8**
//     vértices y ahora tiene **37**» — los 8 del levantamiento sustituidos por
//     los 37 de la parcela catastral;
//   · «El rótulo de procedencia dice "Del Catastro…" sobre una geometría que NO
//     es del Catastro» — el defecto vuelto firmable.
//
// Y el resto del guion sigue verde con el defecto puesto: el botón existe, se
// enciende, los textos no mandan a Entrada y el diagnóstico se activa. Ésa es la
// razón de que la comparación vértice a vértice sea la afirmación central y no
// una comprobación más.
//
// ── QUÉ **NO** MIDE ─────────────────────────────────────────────────────────
//   · **La puerta 1.** Que «Traer del Catastro» siga sustituyendo el documento
//     es el guion 07, que ya existe y sigue en verde. Aquí se mide la 2.
//   · **Que el diagnóstico ACIERTE.** Se mide que el botón se enciende y que el
//     cajón abre, no las nueve métricas: eso es el guion 09.
//   · **Si el reparto de las dos puertas se ENTIENDE.** Que un colegiado sepa
//     cuál pulsar sin que nadie se lo explique no tiene número: checklist humano.

const t0 = performance.now()
const problemas = []
const advertencias = []

const $ = (sel, raiz = document) => raiz.querySelector(sel)
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel))
const redondear = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null)
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

/** ¿Se ve de verdad? Caja con área y sin `visibility:hidden`. */
function visible(el) {
  if (!el) return false
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return false
  const cs = getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
}

const texto = (sel, raiz = document) => ($(sel, raiz)?.textContent ?? '').trim()

// ── Selectores del contrato ─────────────────────────────────────────────────

const SEL = {
  FONDO: '[data-accion="traer-fondo-catastral"]',
  ESTADO_FONDO: '[data-estado="traer-fondo-catastral"]',
  DIAGNOSTICAR: '[data-accion="diagnosticar"]',
  ESTADO_DIAGNOSTICAR: '[data-estado="diagnosticar"]',
  DERIVAR: '[data-accion="rehacer-parcelario"]',
  ESTADO_DERIVAR: '[data-estado="rehacer-parcelario"]',
  CARGAR_CATASTRO: '[data-accion="cargar-catastro"]',
  CAMPO_REFCAT: '[data-campo="refcat"]',
  PROCEDENCIA: '[data-procedencia="parcela"]',
  EYEBROW: '[data-eyebrow]',
  CAPA_MEDICION: '[data-capa="medicion"]',
  CAPA_OFICIAL: '[data-capa="oficial"]',
  // ⚠️ `.gml-fila-vertice` y NO «tbody tr»: cada recinto abre con una
  // `.gml-fila-recinto` de cabecera («EXTERIOR», «HUECO 1») que también es un
  // `<tr>`. Contarlas infla el recuento y la comparación de antes/después
  // compararía cabeceras además de vértices (`viewer/sincronizacion.js:448-452`).
  FILAS: '.gml-fila-vertice',
  RAIL: '.gml-rail-pasos',
  // ⚠️ El `data-paso` está en el `<li>`; el que se PULSA es el `<button>` de
  // dentro, y lleva `data-ir-a-paso` (`app/barra.js#ATRIBUTO_IR_A_PASO`).
  PELDANOS: '.gml-rail-pasos [data-ir-a-paso]',
}

/** Navega a un paso del rail pulsando su botón. Devuelve si lo consiguió. */
function irAPaso(paso) {
  const boton = $$(SEL.PELDANOS).find((b) => b.getAttribute('data-ir-a-paso') === paso)
  if (!boton || boton.disabled) return false
  boton.click()
  return document.body.dataset.paso === paso
}

// ── 0 · ¿Estamos midiendo lo que creemos? ───────────────────────────────────
//
// El guion aborta si la aplicación no está en el estado del que parte. Sin esto,
// una corrida sobre un store ya poblado mediría otro caso y saldría verde.

const contexto = {
  url: location.href,
  demo: /[?&]demo=([^&]*)/.exec(location.search)?.[1] ?? null,
  paso: document.body.dataset.paso ?? null,
  rama: document.body.dataset.rama ?? null,
  vertices: $$(SEL.FILAS).length,
  capaMedicion: $(SEL.CAPA_MEDICION)?.dataset.presente ?? null,
  capaOficial: $(SEL.CAPA_OFICIAL)?.dataset.presente ?? null,
  refcatEnElCampo: $(SEL.CAMPO_REFCAT)?.value ?? null,
  viewport: { ancho: window.innerWidth, alto: window.innerHeight },
}

const abortar = (motivo, extra = {}) => ({
  guion: '23-fondo-catastral',
  ok: false,
  abortado: true,
  problemas: [motivo],
  contexto,
  ...extra,
})

if (contexto.demo !== 'hueco') {
  return abortar(
    `Este guion se lanza con \`?demo=hueco\` y se ha lanzado con \`${contexto.demo ?? '(nada)'}\`. ` +
      'Necesita el estado exacto del que parte la feature: geometría de trabajo cargada y NINGÚN ' +
      'parcelario oficial. `real` traería la parcela del Catastro con su contorno ya dentro y se ' +
      'estaría midiendo otro caso; sin dataset no hay geometría que conservar y el botón nace ' +
      'apagado con motivo, que es correcto pero no es lo que este guion mide.',
  )
}

if (contexto.vertices === 0) {
  return abortar(
    'No hay ni un vértice en la tabla con `?demo=hueco` puesto. O el dataset ha dejado de ' +
      'cargarse, o la tabla no lo está pintando: sin geometría de trabajo no hay nada que ' +
      'conservar y todo lo que mide este guion es sobre conservarla.',
  )
}

// ⛔ El estado de partida se AFIRMA, no se supone. Sin esto, una corrida sobre una
// app que ya tuviera parcelario mediría el caso fácil y saldría verde.
if (contexto.capaOficial !== 'false') {
  return abortar(
    `Ya hay parcelario oficial cargado (\`data-presente="${contexto.capaOficial}"\`) antes de ` +
      'empezar. Este guion mide qué pasa al traer el PRIMER fondo sobre una medición desnuda; con ' +
      'uno ya puesto se estaría midiendo la sustitución de un fondo por otro. Recarga la página.',
  )
}

// ── 1 · El estado de partida, apuntado desde la pantalla ────────────────────
//
// Que hay geometría y NO hay parcelario ya está afirmado arriba. Aquí se apunta
// lo que el usuario tiene delante, que es contra lo que se comparará después.

const trasMedicion = {
  vertices: contexto.vertices,
  eyebrow: texto(SEL.EYEBROW),
  procedencia: texto(SEL.PROCEDENCIA),
  capaMedicion: contexto.capaMedicion,
  capaOficial: contexto.capaOficial,
  refcatEnElCampo: contexto.refcatEnElCampo,
}

if (trasMedicion.capaMedicion !== 'true') {
  problemas.push(
    `El indicador de levantamiento dice «${trasMedicion.capaMedicion}» con ${trasMedicion.vertices} ` +
      'vértices en la tabla. Los dos indicadores existen para decir qué se va a generar; uno que ' +
      'se calla es peor que no tenerlo.',
  )
}

// ⚠️ La parcela sintética NO trae referencia catastral, y eso es lo que hace que
// este guion mida la DEDUCCIÓN ENCADENADA y no solo la carga. Si algún día el
// dataset trajera una, el flujo seguiría saliendo verde pero por el camino corto,
// y esta advertencia es lo que impide que el cambio pase inadvertido.
if ((trasMedicion.refcatEnElCampo ?? '') !== '') {
  advertencias.push(
    `El campo de referencia catastral trae «${trasMedicion.refcatEnElCampo}» de partida. El botón ` +
      'lee el MODELO y no el campo, así que el flujo no cambia; pero si además la trajera el ' +
      'modelo, este guion dejaría de ejercitar la deducción encadenada sin decirlo.',
  )
}

// ── 2 · El aviso ya no manda a la trampa ────────────────────────────────────
//
// FLUJO 2. Es el defecto de producto, y se lee el texto RENDERIZADO y no la
// constante: lo que importa es lo que el usuario tiene delante.

irAPaso('edicion')
await dormir(200)

const aviso = {
  paso: document.body.dataset.paso ?? null,
  motivoDiagnosticar: texto(SEL.ESTADO_DIAGNOSTICAR),
  motivoDerivar: texto(SEL.ESTADO_DERIVAR),
  motivoFondo: texto(SEL.ESTADO_FONDO),
  procedencia: texto(SEL.PROCEDENCIA),
}
aviso.losTextos = [
  aviso.motivoDiagnosticar,
  aviso.motivoDerivar,
  aviso.procedencia,
].filter((t) => t !== '')

aviso.mandanAEntrada = aviso.losTextos.filter((t) => /desde Entrada/i.test(t))
aviso.mandanATraerLaParcela = aviso.losTextos.filter((t) =>
  /tr[aá]e(?:la|r)?\s+(?:la\s+)?parcela\s+del\s+Catastro/i.test(t),
)
aviso.nombranElBoton = aviso.losTextos.filter((t) => /Traer el parcelario de fondo/i.test(t))

if (aviso.mandanAEntrada.length > 0) {
  problemas.push(
    `${aviso.mandanAEntrada.length} texto(s) de Validación siguen mandando «desde Entrada», que ` +
      'es la pantalla donde el único botón que hay SUSTITUYE la medición del usuario por la del ' +
      `Catastro: «${aviso.mandanAEntrada[0]}». Es el empujón a la trampa que esta feature cierra.`,
  )
}
if (aviso.mandanATraerLaParcela.length > 0) {
  problemas.push(
    `${aviso.mandanATraerLaParcela.length} texto(s) siguen diciendo «trae la parcela del ` +
      `Catastro», que es la acción destructiva: «${aviso.mandanATraerLaParcela[0]}».`,
  )
}
if (aviso.nombranElBoton.length === 0 && aviso.losTextos.length > 0) {
  problemas.push(
    'Ninguno de los textos que explican qué falta nombra «Traer el parcelario de fondo», que es ' +
      'la acción segura y está a unos píxeles. Decir qué falta sin decir cómo conseguirlo deja al ' +
      'usuario buscándolo en la pantalla equivocada.',
  )
}

// ── 3 · El botón de la puerta 2 existe, se ve y se puede pulsar ─────────────

const botonFondo = $(SEL.FONDO)
const puerta = {
  existe: botonFondo !== null,
  visible: visible(botonFondo),
  habilitado: botonFondo !== null && !botonFondo.disabled,
  rotulo: (botonFondo?.textContent ?? '').trim(),
  motivo: texto(SEL.ESTADO_FONDO),
  // Contrato K.1: su `data-accion` no puede repetir el de Entrada.
  accionesRepetidas: (() => {
    const todas = $$('[data-accion]').map((b) => b.dataset.accion)
    return todas.filter((a, i) => todas.indexOf(a) !== i)
  })(),
}

if (!puerta.existe) {
  return {
    guion: '23-fondo-catastral',
    ok: false,
    abortado: true,
    problemas: [
      `No existe el botón «${SEL.FONDO}» en el documento. Es la mitad de interfaz de la feature: ` +
        'sin él, el usuario con una medición cargada no tiene ninguna forma de traer el ' +
        'parcelario que no pase por borrarla.',
    ],
    contexto,
    trasMedicion,
    aviso,
    puerta,
  }
}
if (puerta.accionesRepetidas.length > 0) {
  problemas.push(
    `Hay \`data-accion\` REPETIDOS en el documento: ${puerta.accionesRepetidas.join(', ')}. Con ` +
      'las dos pantallas montadas a la vez `querySelector` devuelve la primera aunque esté ' +
      '`hidden`, así que los clics de una acaban en la otra — y en este caso concreto los del ' +
      'botón que conserva la medición irían al que la borra. Contrato K.1.',
  )
}
if (!puerta.visible) {
  problemas.push(
    'El botón «Traer el parcelario de fondo» existe pero NO se ve en Validación, que es la ' +
      'pantalla donde el usuario lee que le falta el parcelario.',
  )
}
if (!puerta.habilitado) {
  problemas.push(
    `El botón «Traer el parcelario de fondo» está APAGADO con una medición cargada, que es ` +
      `justo el estado para el que existe. Motivo escrito: «${puerta.motivo || '(ninguno)'}».`,
  )
}

// ── 4 · EL FLUJO QUE ROMPÍA, de punta a punta ───────────────────────────────
//
// FLUJO 1. Se pulsa el botón y se mide lo que el usuario ve: que los vértices
// siguen ahí uno por uno, y que el parcelario ha aparecido debajo.
//
// ⚠️ **Toca la red de verdad, y dos veces**: el `.txt` no trae referencia
// catastral, así que `cablearDiagnostico` encadena `deducir()` (OVC, por el punto
// interior) antes de `cargar({sustituir:false})` (WFS). Se espera con holgura y
// se distingue «no se ha podido preguntar» de «la respuesta fue mala».

const verticesAntes = $$(SEL.FILAS).map((tr) =>
  Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()),
)

if (puerta.habilitado) botonFondo.click()
await dormir(4000)

const fondo = {
  vertices: $$(SEL.FILAS).length,
  verticesAntes: verticesAntes.length,
  identicos: null,
  capaMedicion: $(SEL.CAPA_MEDICION)?.dataset.presente ?? null,
  capaOficial: $(SEL.CAPA_OFICIAL)?.dataset.presente ?? null,
  motivo: texto(SEL.ESTADO_FONDO),
  procedencia: texto(SEL.PROCEDENCIA),
  eyebrow: texto(SEL.EYEBROW),
  refcatEnElCampo: $(SEL.CAMPO_REFCAT)?.value ?? null,
}

const verticesDespues = $$(SEL.FILAS).map((tr) =>
  Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim()),
)
fondo.identicos = JSON.stringify(verticesAntes) === JSON.stringify(verticesDespues)

// ⚠️ Se distingue NO HABER PODIDO PREGUNTAR de haber preguntado mal. Un servicio
// del Catastro caído no puede leerse como un defecto de esta casa.
const seQuedoSinRed = /no se ha podido|servicio|red|conexi[oó]n|tiempo/i.test(fondo.motivo)

if (fondo.capaOficial !== 'true') {
  if (seQuedoSinRed) {
    advertencias.push(
      `El parcelario NO ha llegado, y el motivo dice que fue la consulta: «${fondo.motivo}». No ` +
        'es un defecto de la aplicación: es el Catastro (o la red). El resto de este guion mide ' +
        'sobre un estado incompleto — vuelve a lanzarlo cuando el servicio conteste.',
    )
  } else {
    problemas.push(
      'Se ha pulsado «Traer el parcelario de fondo» y el indicador de parcelario sigue apagado. ' +
        `Motivo escrito: «${fondo.motivo || '(ninguno)'}». Si no ha sido la red, es que el ` +
        'encadenamiento deducción → carga no ha llegado a completarse.',
    )
  }
}

// ⭐ LA AFIRMACIÓN CENTRAL DEL GUION. Antes del 2026-08-08, aquí la tabla se
// quedaba con los vértices del WFS y el levantamiento desaparecía.
if (!fondo.identicos) {
  problemas.push(
    `⛔ TRAER EL PARCELARIO HA CAMBIADO LA MEDICIÓN. La tabla tenía ${fondo.verticesAntes} ` +
      `vértices y ahora tiene ${fondo.vertices}, y su contenido NO es el mismo. Es exactamente el ` +
      'defecto que esta feature cierra: la geometría de trabajo es del usuario y el parcelario ' +
      'solo se pone debajo para comparar.',
  )
}
if (fondo.capaMedicion !== 'true') {
  problemas.push(
    'El indicador de levantamiento se ha apagado al traer el parcelario. Aunque la tabla tuviera ' +
      'los vértices, el panel estaría diciendo que ya no hay medición.',
  )
}

// El rótulo de procedencia, que es donde el defecto se volvía firmable.
fondo.procedenciaDiceDelCatastroASecas =
  /^Del Catastro/i.test(fondo.procedencia) && !/geometr[ií]a de trabajo/i.test(fondo.procedencia)
if (fondo.capaOficial === 'true' && fondo.procedenciaDiceDelCatastroASecas) {
  problemas.push(
    `El rótulo de procedencia dice «${fondo.procedencia}» sobre una geometría que NO es del ` +
      'Catastro: la midió el usuario. Es el renglón que existe para declarar de dónde viene el ' +
      'dato, convirtiendo un levantamiento propio en dato oficial — y a partir de ahí se firma.',
  )
}

// ── 5 · Se enciende lo que ya estaba construido ─────────────────────────────
//
// FLUJO 3. F07 (diagnóstico) y F17 (derivar sobrante) están cerradas y probadas
// desde hace semanas, y desde el flujo «medición primero» eran INALCANZABLES: no
// por falta de código, sino porque nacen apagadas sin contorno oficial.

const encendido = {
  diagnosticar: (() => {
    const b = $(SEL.DIAGNOSTICAR)
    return { existe: b !== null, habilitado: b !== null && !b.disabled, motivo: texto(SEL.ESTADO_DIAGNOSTICAR) }
  })(),
  derivar: (() => {
    const b = $(SEL.DERIVAR)
    return { existe: b !== null, habilitado: b !== null && !b.disabled, motivo: texto(SEL.ESTADO_DERIVAR) }
  })(),
}

// ⚠️ Y el de la puerta 2 se ESCONDE en cuanto llega el parcelario, que es lo
// contrario de encenderse y también es correcto: es el botón que lo trae, y con
// uno ya puesto sobra. Cuesta 40,39 px del pie de Validación (medido con el guion
// 16 el 2026-08-08) y devolverlos es lo que mantiene la tabla de vértices por
// encima de su suelo. Se afirma, porque si dejara de esconderse el guion 16
// volvería a rojo y desde aquí no se entendería por qué.
encendido.fondoEscondido = (() => {
  const b = $(SEL.FONDO)
  return { existe: b !== null, oculto: b !== null && !visible(b), disabled: b?.disabled ?? null }
})()

if (fondo.capaOficial === 'true' && !encendido.fondoEscondido.oculto) {
  problemas.push(
    'Con el parcelario ya traído, «Traer el parcelario de fondo» sigue a la vista. Es el cuarto ' +
      'CTA de un pie que solo tiene sitio para tres: medido con el guion 16, deja la caja de ' +
      'vértices en 103,42 px por debajo de su suelo de 124,57 — y el panel NO desborda, así que ' +
      'la tabla encogería en silencio.',
  )
}

if (fondo.capaOficial === 'true') {
  for (const [nombre, cta] of Object.entries(encendido)) {
    if (nombre === 'fondoEscondido') continue
    if (!cta.existe) {
      problemas.push(`No existe el CTA «${nombre}» en el documento.`)
      continue
    }
    if (!cta.habilitado) {
      problemas.push(
        `«${nombre}» sigue APAGADO con el parcelario ya traído. Es una feature cerrada que este ` +
          `arreglo tenía que encender sin escribir código nuevo. Motivo: «${cta.motivo || '(ninguno)'}».`,
      )
    }
  }
}

// ── 6 · Regla de oro 1: nada apagado y mudo ────────────────────────────────

const mudez = (() => {
  const pares = [
    ['traer-fondo-catastral', SEL.FONDO, SEL.ESTADO_FONDO],
    ['diagnosticar', SEL.DIAGNOSTICAR, SEL.ESTADO_DIAGNOSTICAR],
    ['rehacer-parcelario', SEL.DERIVAR, SEL.ESTADO_DERIVAR],
  ]
  const mudos = []
  const ocultos = []
  for (const [nombre, selBoton, selEstado] of pares) {
    const b = $(selBoton)
    if (b === null || !b.disabled) continue
    // ⛔ **UN BOTÓN OCULTO NO PUEDE SER «GRIS Y MUDO»**, y esta distinción la
    // encontró el propio guion: tras esconder «Traer el parcelario de fondo» con
    // el parcelario ya puesto, esta sección lo acusó de mudo. La regla de oro 1
    // habla de lo que el usuario VE — un motivo escrito debajo de un nodo
    // invisible no lo lee nadie, y encima ocuparía sitio en el pie. Se apunta
    // aparte, que es distinto de callarlo.
    if (!visible(b)) {
      ocultos.push(nombre)
      continue
    }
    if (texto(selEstado) === '') mudos.push(nombre)
  }
  return { revisados: pares.length, mudos, ocultos }
})()

if (mudez.ocultos.length > 0) {
  advertencias.push(
    `${mudez.ocultos.length} botón(es) ocultos en este estado: ${mudez.ocultos.join(', ')}. No es ` +
      'un fallo —esconder un control que sobra devuelve sitio al panel— pero se apunta: si algún ' +
      'día desaparece uno que hacía falta, el síntoma sería que no pasa nada al buscarlo.',
  )
}

if (mudez.mudos.length > 0) {
  problemas.push(
    `${mudez.mudos.length} botón(es) apagado(s) y MUDOS: ${mudez.mudos.join(', ')}. Un botón gris ` +
      'sin motivo al lado es un error silencioso (regla de oro 1).',
  )
}

// ── 7 · El deshacer sobrevive al fondo ─────────────────────────────────────
//
// El agravante 1 del defecto: el gancho de carga REINICIABA el historial, así
// que la medición borrada tampoco volvía con Ctrl+Z. Aquí se mide que traer el
// fondo no ha dejado la pila a cero.

const historial = (() => {
  const deshacer = $('[data-accion="deshacer"]')
  const rehacer = $('[data-accion="rehacer"]')
  return {
    hayBotones: deshacer !== null && rehacer !== null,
    deshacerHabilitado: deshacer !== null && !deshacer.disabled,
  }
})()

// ⚠️ No es un problema: con una sola operación en la pila (la importación) no hay
// nada que deshacer, y eso es correcto. Se APUNTA para el registro, y lo que sí
// se mediría con un arrastre por medio es del guion 08.
advertencias.push(
  `Estado del «deshacer» tras traer el fondo: ${historial.deshacerHabilitado ? 'encendido' : 'apagado'}. ` +
    'Con una sola operación en la pila lo correcto es apagado; que el fondo NO reinicie la pila lo ' +
    'mide la suite (`main-edicion.dom.test.js`), porque hace falta editar antes y eso es un gesto.',
)

// ── 8 · La red: qué se ha consultado de verdad ─────────────────────────────

const red = (() => {
  const rec = performance.getEntriesByType('resource').map((r) => r.name)
  return {
    ovc: rec.filter((u) => /ovc\.catastro|Consulta_RCCOOR/i.test(u)).length,
    wfs: rec.filter((u) => /ovc\.catastro.*wfs|INSPIRE|GetParcel/i.test(u)).length,
    total: rec.length,
  }
})()

if (fondo.capaOficial === 'true' && red.ovc === 0 && trasMedicion.refcatEnElCampo === '') {
  advertencias.push(
    'Ha llegado parcelario sin que conste ninguna consulta al OVC, y la medición no traía ' +
      'referencia catastral. O la deducción salió de la caché, o el parcelario vino de otro sitio. ' +
      'No es un fallo; es que este guion no puede afirmar POR DÓNDE llegó.',
  )
}

return {
  guion: '23-fondo-catastral',
  ok: problemas.length === 0,
  msTotal: redondear(performance.now() - t0),
  problemas,
  advertencias,
  noCubierto: [
    'LA PUERTA 1. Que «Traer del Catastro» siga SUSTITUYENDO el documento es el guion 07, que ya existe. Aquí se mide la 2.',
    'QUE EL DIAGNÓSTICO ACIERTE. Se mide que el botón se enciende y nada más; las nueve métricas son del guion 09.',
    'EL DESHACER CON UNA EDICIÓN POR MEDIO. Exige un arrastre; lo cubre la suite y el guion 08.',
    'SI EL REPARTO DE LAS DOS PUERTAS SE ENTIENDE. Que un colegiado sepa cuál pulsar sin que nadie se lo explique no tiene número: checklist humano.',
  ],
  contexto,
  trasMedicion,
  aviso,
  puerta,
  fondo,
  encendido,
  mudez,
  historial,
  red,
}
