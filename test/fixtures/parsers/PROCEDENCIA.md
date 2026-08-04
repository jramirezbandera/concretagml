# Procedencia de los fixtures de `parsers/`

Estos ficheros son **verdad externa** (regla de oro 8 de `spec/SPEC.md`): mandan sobre la
documentación, sobre el dossier y sobre nuestro criterio. Ninguno se edita para que un test
pase. Si uno de ellos contradice al código, se corrige el código.

Este documento existe porque un fixture sin procedencia es una opinión con formato de dato.

> ⚠️ **Creado el 2026-08-03, en F11 · T0.2, y llega tarde.** Esta carpeta era la única de
> `test/fixtures/` sin `PROCEDENCIA.md`, a diferencia de `gml/` y `catastro/`. La deuda se anotó
> en F10 · T0.2 · 8 y se paga aquí porque F11 añade un fixture. **Los cuatro ficheros de F01
> llevan su procedencia INCOMPLETA y así queda escrito**: se publica lo que hoy se puede
> verificar (hash de blob, tamaño, versión de DXF, contenido medido) y se declara como hueco lo
> que nadie anotó en su día. Rellenarlo es de quien tenga el correo o la descarga original.
>
> ✅ **Completado el 2026-08-04, al cerrar F11**, en dos puntos que estaban en futuro y ya
> están hechos: el **código de grupo 8** de `parsers/dxf.js` (que este fichero estrena como
> oráculo, con la trampa de la `POLYLINE` clásica sorteada) y el **`−390,45 m²`** de
> `parsers/importar.js`. **Los huecos declarados siguen declarados**: nadie ha anotado la URL
> del servicio de Consulta Masiva ni la procedencia de los cuatro ficheros de F01, y taparlos
> con una conjetura sería peor que el hueco.

## Finales de línea

Todos los `.dxf` y `.txt` de F01 están **sin regla en `.gitattributes`**, a propósito: son
ENTRADA, los lee un parser que tolera los dos finales de línea (`/\r?\n/`) y **ninguna prueba
compara sus bytes**. En el índice están en LF (`core.autocrlf` los convirtió al versionarlos) y
en un árbol de trabajo de Windows se ven en CRLF. Por eso aquí se publica su **hash de blob de
git**, que es estable en cualquier plataforma, y no un SHA-256 del fichero en disco, que no lo
es. El único con regla propia es el fixture de F11, y su motivo está en `.gitattributes` (4bis).

---

## `edificio_consulta_masiva_3515508VF0831N.dxf` — EL DXF DE EDIFICIO (F11)

Descarga real del servicio de **Consulta Masiva de la Sede Electrónica del Catastro**. Es la
verdad externa del criterio de aceptación 2 de F11: *«un DXF con N polilíneas produce N partes»*
y, sobre todo, del reparto **por capa**, que es lo que decide **cuáles** de esas polilíneas son
huellas de edificio.

| | |
|---|---|
| Origen | Servicio de Consulta Masiva de la Sede Electrónica del Catastro |
| URL exacta | ⚠️ **HUECO DECLARADO** — ver abajo |
| Descargado | 2026-03-19 (fecha del fichero en disco: 12:33:30) |
| Referencia catastral | `3515508VF0831N` (en la capa `RefCatastral`, como `TEXT`) |
| SHA-256 | `38efce08f5b49a29dad9fd0bed71ca931d5ceac6fdb408808dbe20637eed626b` |
| Tamaño | 8.162 B |
| Finales de línea | **CRLF** (1.080 CRLF, 0 LF sueltos). Fijado por `.gitattributes` (4bis) |
| Codificación | ASCII puro |
| Versión DXF | **sin `$ACADVER`** — la sección `HEADER` viene vacía |
| Huso | UTM 30N (lon −4,083 · lat 36,873 — provincia de Málaga) |

**Contenido medido** (F11 · T0.2, con `parseDXF` de producción, que lo lee sin tocar una línea):

| Capa | Anillos | Qué es |
|---|---|---|
| `Construccion` | **7** | las huellas del edificio |
| `Parcela` | **1** | la parcela de contexto (166,0 m²) |
| `txtConstru` | — | los rótulos de plantas por parte |
| `txtSubpa`, `Subparcela`, `RefCatastral`, `Busqueda` | — | anotación y referencia |

Las siete partes, con el rótulo de plantas que les corresponde en `txtConstru`:

| # | Vértices | Superficie | Rótulo |
|---|---|---|---|
| 0 | 25 | 76,3 m² | `I` |
| 1 | 5 | 4,6 m² | `III` |
| 2 | 5 | 6,1 m² | `III` |
| 3 | 9 | 32,1 m² | `II` |
| 4 | 7 | 9,4 m² | `I` |
| 5 | 13 | 27,6 m² | **`P`** (porche) |
| 6 | 5 | 10,0 m² | `I` |

**Por qué este fixture y no otro.** Cuatro razones, y las cuatro medidas:

1. **Es real y del Catastro**, no fabricado por nosotros. Probar el criterio 2 contra un DXF que
   escribimos nosotros mismos es autocomplacencia — el mismo defecto que F10 encontró al medir
   el DXF de salida contra nuestro propio parser en vez de contra `ezdxf`.
2. **El reparto por capas ES el criterio 2**: 7 partes de edificio y 1 parcela, que es
   literalmente `edificio.parcelaContexto` del modelo (`model/edificio.js:194`).
3. ⭐ **Es el primer fixture REAL con `POLYLINE`/`VERTEX`/`SEQEND` clásicos.** Hasta hoy esa vía
   del parser solo la cubría `poly_clasica.dxf`, que su propia cabecera declara sintético.
   ⚠️ En una `POLYLINE` clásica **la capa la lleva la cabecera, no los `VERTEX` ni el `SEQEND`**
   (aquí el `SEQEND` dice `0` mientras la `POLYLINE` dice `Construccion`): es la trampa que
   `parsers/dxf.js` tiene que sortear al leer el código de grupo 8.
   ✅ **Sorteada el 2026-08-03 (F11 · T1.1), y este fichero es su oráculo**: `parseDXF`
   devuelve ya `capas[]` en paralelo a `anillos[]` —**literal, sin bajar a minúsculas**: el
   usuario reconoce sus nombres de capa— y sobre este DXF da exactamente `Construccion 7 ·
   Parcela 1`. El cambio fue **estrictamente aditivo** (`finalizarLW` y `agregarVertice` solo
   miraban 10/20/30/42/70) y los cuatro fixtures de F01 siguen dando **los mismos anillos**.
4. **Los rótulos de plantas (`I`, `II`, `III`, `P`) son munición de F12**, que es quien asigna
   plantas por parte. F11 los deja donde están.

### ⚠️ Huecos declarados

- **La URL exacta del servicio de Consulta Masiva con que se descargó.** El fichero se conserva
  desde marzo de 2026 y nadie anotó la petición. El SHA-256 de arriba permite comprobar la copia
  del repo contra la descarga original byte a byte, pero **no permite reproducir la descarga**.
  Sin esa URL, este fichero es verificable pero no re-obtenible.
- **No se ha comprobado si el servicio sigue sirviendo el mismo fichero** para esa referencia.

---

## `UTM.dxf` — EL PLANO REAL DE UN TÉCNICO (F01)

El DXF de trabajo real contra el que se escribió el parser de F01. Es el fixture más grande del
repo y el que más trampas tiene.

| | |
|---|---|
| Origen | ⚠️ **HUECO DECLARADO** — plano real de un técnico; no se anotó de quién ni cuándo |
| Hash de blob | `8b9879db487608ca80d393a210c40cf7407068a4` |
| Tamaño | 471.661 B |
| Versión DXF | AC1024 |
| Anillos | **25** |

**Reparto por capa, medido** (F11 · T0.2, verificado contra `parseDXF`):

| Capa | Anillos |
|---|---|
| `FINO` | **16** (cajetín, marco, leyenda — mobiliario de dibujo) |
| `LINDE` | 4 |
| `PARCELA` | 3 |
| `BLANCO` | 1 |
| `0` | **1** |

⛔ **LA TRAMPA, medida y contraintuitiva: la parcela de verdad está en la capa `0`, NO en la capa
llamada `PARCELA`.** El anillo de la capa `0` (11 vértices, **61,05 m²**) comparte **12 de 12
vértices con `PARCELA.txt`**, que es la verdad externa de al lado. La capa literalmente llamada
`PARCELA` contiene **otros tres** anillos, de 107,9 / 65,7 / 71,3 m². Elegir la capa por su
nombre falla en el único plano real que tenemos: es el argumento medido de que el reparto por
capas hay que **ofrecerlo, no adivinarlo** (F11, decisión 5).

⛔ ~~**Y la segunda, que es un defecto vivo de `parsers/importar.js`:** hoy
`importar(UTM.dxf)` construye una parcela de **−390,45 m²** con `bloqueos: []` y
`construida: true`, porque `importar.js:455-459` asigna `recintos[0] = EXTERIOR` y **los otros
24 = HUECO**. La parcela real mide 61,05 m². Es un error silencioso de manual (regla de oro 1) y
lo arregla F11 · T1.1.~~

✅ **ARREGLADO el 2026-08-03 (F11 · T1.1), y este fichero es el test.** Era un error
silencioso de manual (regla de oro 1): la parcela real mide **61,05 m²** y salían **−390,45**
sin un solo bloqueo, porque `parsers/importar.js:455-459` asignaba `recintos[0] = EXTERIOR` y
**los otros 24 = HUECO**. Sin geometría oficial el mismo camino salía bien; lo rompía la
segunda capa, que es justo la que **F10 estrenó al escribir DXF**. Ahora `importar` reparte con
`capas[]` en la mano y, cuando los anillos vienen de más de una capa, **bloquea o avisa en vez
de adivinar por posición**: `resumen.bloqueos` pasa de tres códigos a **cinco**, con los dos
nuevos agrupados en `BLOQUEOS_SOLO_PARCELA = ['ANILLOS_EN_VARIAS_CAPAS',
'SUPERFICIE_NO_POSITIVA']`. ⚠️ Y ese grupo existe porque **hay que filtrarlo en la rama
edificio**: un DXF de vivienda + porche + piscina —el caso normal de F11— viene por definición
de varias capas y saldría bloqueado por el arreglo que protege a la otra rama.

Sus 3 bloques `LOGO` (`INSERT`) llevan `41`/`42`/`43` = 0.6011385410059346 (escalas X/Y/Z), que
un `grep` de «42» confundiría con tres arcos inexistentes: es el ejemplar que justifica que
`parsers/dxf.js` sea una máquina de estados y no un `grep` (ver su cabecera, líneas 10-15).

## `PARCELA.txt` — LA VERDAD NUMÉRICA DE `UTM.dxf` (F01)

Volcado de coordenadas de la misma parcela que `UTM.dxf`. **Es el oráculo cruzado**: los 12
vértices que trae coinciden uno a uno con el anillo de la capa `0` del DXF, y eso es lo que
permite afirmar cuál de los 25 anillos es la parcela sin preguntárselo a nadie.

| | |
|---|---|
| Origen | ⚠️ **HUECO DECLARADO** — mismo expediente que `UTM.dxf` |
| Hash de blob | `de6fac8183cf8a66093bf0a7c5a226a1475e092f` |
| Tamaño | 312 B |

## `LIST.txt` — VOLCADO DEL COMANDO `LIST` DE AUTOCAD (F01)

Salida literal del comando `LIST` de AutoCAD sobre una polilínea, que es una de las tres vías de
entrada de F01 (`parsers/list.js`).

| | |
|---|---|
| Origen | ⚠️ **HUECO DECLARADO** |
| Hash de blob | `75bda65b8c32e7da390a7f4e1087907dab6d2bff` |
| Tamaño | 1.291 B |

## `03_lwpolyline_bulge.dxf` y `05_no_soportado_insert_spline.dxf` (F01)

Los dos casos límite del parser: el primero para la **discretización de arcos** (`bulge`, código
de grupo 42 → `geo/arco.js#discretizarBulge`), el segundo para las **entidades no soportadas**
(`INSERT`, `SPLINE`), que producen un aviso por ocurrencia y nunca un fallo de programa.

| | `03_lwpolyline_bulge.dxf` | `05_no_soportado_insert_spline.dxf` |
|---|---|---|
| Origen | ⚠️ **HUECO DECLARADO** | ⚠️ **HUECO DECLARADO** |
| Hash de blob | `0f932183dd8c7bf1f3711a36e1390992f83679ab` | `058bfd292bd3bacd94ea02386e31267b80951403` |
| Tamaño | 71.481 B | 118.074 B |
| Versión DXF | AC1027 | AC1024 |
| Anillos | 1, en la capa `PARCELA` | 1, en la capa `PARCELA` |

## `poly_clasica.dxf` — SINTÉTICO, y lo dice

El único fichero de esta carpeta que **no es verdad externa**: se fabricó para cubrir la vía
`POLYLINE`/`VERTEX`/`SEQEND` cuando no había ningún ejemplar real. ⭐ **Desde F11 sí lo hay**
(`edificio_consulta_masiva_3515508VF0831N.dxf`), así que este pasa a ser el caso mínimo y aquel
el caso real.

| | |
|---|---|
| Origen | **fabricado por el proyecto** (F01) |
| Hash de blob | `49098be847a7c97d84fc0fe16a6e4f4db2bb4cb1` |
| Tamaño | 694 B |
| Versión DXF | AC1015 |
| Finales de línea | **LF** — es el único de la carpeta, y es coherente con haberlo escrito aquí |
| Anillos | 1, en la capa `0` · sin sección `TABLES` |
