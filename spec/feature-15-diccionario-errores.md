# F15 · Diccionario de errores del validador

**Fase:** 15 · **Prioridad:** P18 · **Riesgo:** Bajo · **Depende de:** F04 · **Habilita:** —.
**Ficheros:** `config/errores-ivg.json`.

## Objetivo

Traducir los mensajes crípticos del validador de la Sede a lenguaje accionable. **Es la única pieza cuyo valor crece con el uso** — por eso no se copia de nadie: se construye a base de rechazos acumulados.

## Alcance

Estructura desde el primer día, aunque empiece casi vacío:

```json
{
  "codigo_o_fragmento": {
    "traduccion": "...",
    "causaProbable": "...",
    "comoCorregir": "...",
    "fecha": "2026-07-22"
  }
}
```

- **Búsqueda por texto** del mensaje recibido (el usuario pega el error del IVG/ICUC y encuentra la entrada).
- Se llena con el tiempo; cada rechazo real que el usuario resuelve se documenta como una entrada nueva.
- Semillas iniciales desde el catálogo de errores conocidos (dossier §1.5): `gml:FeatureCollection` en parcela (es 3.0), srsName corto/URN equivocado, orientación, `gml:id` por dígito, anillo no cerrado/<4 puntos, `base:` en inspireId 4.0, `boundedBy`/`zoning` presentes, MultiPolygon, solapes, construcción a >100 m, "funtional".

## Criterios de aceptación

1. Buscar un fragmento de mensaje devuelve su traducción/causa/corrección.
2. El fichero valida como JSON con la estructura fijada y admite entradas nuevas sin cambio de código.
3. Las semillas de §1.5 están cargadas.

## Referencias

Plan §13.3, §18 Fase 15. Dossier §1.5 (errores que producen rechazo).

---

# Lo medido al hacerla (2026-08-11)

**7.618 pruebas / 180 ficheros** en verde. Aportación propia: **75 pruebas en 3
ficheros**. Hoja construida **60.213 B nuestros** (+2.307, con su asiento y su
subida de techo escrita a mano). Guion `26` en **`ok:true`** a 1280×720. ⏳ Falta
la firma humana.

## ⭐ El guion 26 destapó un defecto que la suite aprobaba en verde

Todo lo estructural salió bien a la primera —el diálogo mide **633,59 px** y cabe
en 720 con 43,2 de margen, «Cerrar» dentro de pantalla, 23 fichas con alto de
verdad y ninguna clave recortada, la lista scrollea por dentro (902 vs 331 px) y
**el campo se mueve 0,00 px** al bajarla, cero peticiones ajenas—. Lo que no
cuadraba era un número:

⛔ Pegado el mensaje real del IVG casaban **15 de 23**, y la cuenta decía «15 de
23 entradas casan con lo que has pegado». **Solo UNA casaba por el literal**; las
otras catorce compartían «archivo» o «esquema», que en un diccionario de errores
de esquema las comparte medio catálogo. La lista ya estaba ordenada y la fuerte ya
venía desplegada con su rótulo: **lo que mentía era el número**.

Ahora dice «1 entrada casa con el mensaje literal · 14 más comparten palabras».
Las 25 pruebas dom estaban en verde porque **ninguna afirmaba sobre la relación
entre el número y la fuerza del casamiento** — solo sobre el orden y el
despliegue, que ya eran correctos.

## ⛔ El criterio 3 se cumple, y tres de sus semillas hubo que reescribirlas

El criterio 3 pide que «las semillas de §1.5 estén cargadas». Están las trece.
**Tres no se pudieron copiar**, porque este proyecto ya las había refutado
midiendo, y una está del revés:

| §1.5 | Lo que dice | Lo medido |
|---|---|---|
| **nº 1** | `gml:FeatureCollection`/`featureMember` en parcela → *es 3.0, rechazado* | ⛔ **INVERTIDA.** Es la raíz de la **ENTREGA** en CP 4.0: la de `cp_ejemplo_explicativo.gml` (la plantilla que publica la D.G. del Catastro, `gml:id="ES.SDGC.CP"`, 3 `featureMember`), **VÁLIDA contra `cp/4.0` sola** (tabla de §3.1 del SPEC) y aceptada con **dos IVG positivos**. Lo rechazado el 2026-07-27 fue `wfs:FeatureCollection` — **override O3** |
| **nº 3** | orientación de anillos → rechazo | ⛔ **No es causa de rechazo** (**O1**): es una convención. La plantilla oficial es **antihoraria** (+236,05 m²). Y **contradecía a la propia aplicación**, que desde F08 la rotula como nota informativa y jamás como error |
| **nº 8** | `base:` en el `inspireId` 4.0 | ⚠️ **Culpa al prefijo.** Manda el **namespace** (INSPIRE base **3.3**): un prefijo no es información en XML, y la plantilla oficial usa `base:` y valida — **O4** |

**Se conservan como entradas propias, con campo `correccion`, en vez de
borrarse.** Es la decisión de diseño de la fase: quien llega buscando
«orientación» probablemente acaba de leer esa misma lista en un foro, y
encontrarse un hueco no le sirve — necesita leer que no es cierto y por qué. Un
diccionario que solo dice lo que SÍ falla deja intacto todo lo que la gente cree
que falla y no falla. Hay **un guardián por cada una** en
`test/config/errores-ivg.test.js`.

## ⭐ La fuente buena no era §1.5: era la tabla de overrides

Nueve de los 21 overrides de `spec/SPEC.md` son material de diccionario, y
**cuatro no están en §1.5**: el orden XSD de los elementos (O5), la
`nationalCadastralReference` de una segregada (O19), el «Tipo de operación»
(O20) y el `xmlns:xlink` del ICUC (F13). **23 entradas, 10 `MEDIDO`**, y cada
una de las medidas está atada por un test al sitio del repositorio donde consta
su medición — incluidos los dos mensajes literales que la Sede devolvió de
verdad.

## Lo que se construyó, y por qué son seis ficheros y no uno

La ficha nombra `config/errores-ivg.json`. Un JSON sin pantalla es una pieza sin
llamante, y este repositorio ya ha pagado tres (`model/edificio.js` diez fases,
`parsers/dxf.js` once, el pegado de LIST doce). Salieron:

- `config/errores-ivg.json` — el dato. Estructura de la ficha (`traduccion`,
  `causaProbable`, `comoCorregir`, `fecha`) **más** `validador`, `procedencia`,
  `mensajes` y `verMas`.
- `config/errores-ivg.js` — cargador congelado + `buscar()`. Módulo hoja, molde
  exacto de `config/operativos.js`, con su guardián de lector único.
- `app/dialogo-diccionario.js` — la pantalla.
- `index.html`, `estilos/app.css`, `app/main.js` — el `menuitem`, la maqueta y el
  montaje.

**Seis decisiones de la entrevista del 2026-08-11:** cuelga del menú de
Expediente (coste en píxeles de la barra: **cero**); semillas + rechazos reales
con procedencia; un fichero con campo `validador` (el segundo rechazo real fue
del **ICUC**, no del IVG que da nombre al fichero); crece editando el JSON del
repo; y **abre con el diccionario entero puesto**.

⭐ **Lo último no es preferencia de maqueta**: los dos únicos mensajes de rechazo
que se han medido son genéricos —«El archivo no cumple el esquema Inspire GML» y
«Los siguientes ficheros no se han cargado al no ser válidos: -⟨nombre⟩», que no
nombra causa—, así que una pantalla que exigiera una consulta precisa sería
inútil justo con ellos.

## ⛔ Dos colisiones que la fase destapó, y ninguna era suya

1. **`data-procedencia` ya estaba cogido.** Es uno de los cinco `data-*` que el
   cableado resuelve con `querySelector` **en singular**
   (`app/cableado-catastro.js:218`, `app/panel-edificio.js:396`). Lo cazó el
   contrato **K.1** sobre la aplicación entera montada. Renombrado a
   `data-diccionario-procedencia`; **no** se le declaró excepción, porque no era
   un grupo legítimo sino otro concepto con el mismo nombre.
2. **Tres propiedades de CSS usadas y nunca definidas.** `var(--x, fallback)`
   degrada en silencio y jsdom no resuelve `var()`. `--color-aviso` ×2 (F18 y
   F19, que además eran la misma regla escrita dos veces) y ⭐
   `--color-state-error` en **«Vaciarlo»** — la única acción irreversible del
   menú, pintada del color del texto normal e indistinguible de la opción de
   encima. Las tres corregidas, con `test/estilos/tokens-definidos.test.js` de
   guardián.
