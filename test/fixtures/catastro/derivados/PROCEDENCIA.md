# Fixtures SINTÉTICOS del servicio del Catastro — fabricados a mano, NO descargados

**El fichero de este directorio no es una respuesta del Catastro.** Es una mutación deliberada de
un fixture real de [`..`](..), escrita para provocar un caso límite que ninguna captura real
cubre. **No vale como fuente de verdad de nada** —ni del formato del servicio, ni de su
comportamiento, ni de qué contesta a qué— y no puede usarse para derivar una decisión de diseño:
para eso están los de `..`, que sí son verdad externa (regla de oro 8 de `spec/SPEC.md`). Aquí,
si un fichero contradice al código, lo más probable es que el fichero esté mal, porque lo
escribimos nosotros.

Es el hermano de [`../../gml/derivados/PROCEDENCIA.md`](../../gml/derivados/PROCEDENCIA.md), y
existe por lo mismo: un fixture sin procedencia es una opinión con formato de dato, y uno
**sintético** sin procedencia es una opinión disfrazada de medición.

**Las tres barreras para que no se confundan con los reales**, las mismas de `gml/derivados/`:

1. **Directorio aparte.** Y aquí no es solo higiene: `scripts/sonda-catastro.mjs` lee
   [`../PROCEDENCIA.md`](../PROCEDENCIA.md) para sacar **la URL con la que se midió cada
   fixture**, y la sonda pide esas URL contra el servicio real. Un fixture sintético con una fila
   `| URL |` en aquel documento sería una petición inventada que la sonda emitiría de verdad — y
   una URL medida que nadie ha medido. Los sintéticos se documentan **aquí**, donde nadie los
   confunde con una medición, y sus fichas **no llevan fila de URL** porque no hubo petición.
2. **Aviso dentro del propio fichero.** JSON no tiene comentarios, así que el aviso va como
   **primera clave de primer nivel**, `_AVISO_FIXTURE_SINTETICO`. Quien abra el `.json` sin pasar
   por este documento se entera igual. `services/_catastro-dnp.js#leerDnprc` la ignora sin
   inmutarse —solo mira `consulta_dnprcResult`—, y hay un test que lo comprueba: si algún día el
   lector se volviera estricto con las claves de primer nivel, ese test cae y esta barrera se
   rediseña, en vez de descubrirse rota.
3. **Esta ficha**, con la receta exacta: original, su SHA-256, la mutación literal y qué caso
   justifica el fichero.

**SHA-256 del original** (tal como está versionado; los `.json` del OVC no tienen ni un salto de
línea, así que hay un solo hash y la normalización de finales de línea les es inocua):

| Original | SHA-256 | Bytes |
|---|---|---|
| [`../ovc-dnprc-urbana-9398516VK3799G.json`](../ovc-dnprc-urbana-9398516VK3799G.json) | `9dd04f1ec1a4434b787f04ba79d8d39fd24b05986f9c3d60c2d515a8008bc294` | 6.817 |

Fecha de fabricación: **2026-08-02** (F09, tarea T2.3).

---

## `ovc-dnprc-municipios-discordantes.json` — DOS MUNICIPIOS EN LA MISMA PARCELA

| | |
|---|---|
| Deriva de | [`../ovc-dnprc-urbana-9398516VK3799G.json`](../ovc-dnprc-urbana-9398516VK3799G.json) |
| SHA-256 del original | `9dd04f1ec1a4434b787f04ba79d8d39fd24b05986f9c3d60c2d515a8008bc294` |
| SHA-256 de este | `68bfc0e146b9476403b77e95b2f1c716628b3ea8896f25efd28f72f2c1d5833b` (7.051 B) |
| Caso que justifica el fichero | La **decisión A** de `services/_catastro-dnp.js`: en la rama `lrcdnp`, un campo solo se da por bueno si **todos** los inmuebles coinciden. **Ninguna captura real lo cubre**: en el fixture de 18 inmuebles los 18 dicen `MADRID`/`MADRID`, o sea que el camino de la discrepancia no se ejecutaría nunca. |

**Cómo se fabricó, exactamente** (reproducible con `node`, sin editar a mano ni un byte):

1. Se comprueba que el original **sobrevive al round-trip**: `JSON.stringify(JSON.parse(t)) === t`.
   Es cierto —el cuerpo del servicio viene compacto, sin espacios y sin saltos de línea, que es
   justo lo que emite `JSON.stringify`—, y es lo que permite derivar por mutación de objeto en vez
   de por sustitución de texto. Si algún día dejara de serlo, esta receta deja de valer y hay que
   reescribirla, no forzarla.
2. Se comprueba que la lista trae **18** inmuebles y que el **decimoctavo** (`rc.car` = `"0018"`)
   dice `dt.nm` = `"MADRID"`.
3. `rcdnp[17].dt.nm` → **`"MOSTOLES"`**. **Nada más.** Ni `np` (provincia), ni `loine`, ni `cmc`,
   ni las otras 17 entradas, ni `control.cudnp`.
4. Se antepone la clave `_AVISO_FIXTURE_SINTETICO` (barrera 2) y se serializa compacto, sin salto
   de línea final.

**Por qué esa mutación y no otra:**

- **Se cambia UN inmueble de 18, no la mitad.** El caso interesante no es «dos bloques
  empatados», es el que de verdad rompería un lector ingenuo: *el primer elemento dice lo que
  todos esperan y hay uno, al final, que no*. Un lector que leyera `rcdnp[0].dt.nm` y se fuera
  daría `MADRID` con toda la confianza del mundo, sin enterarse de nada. Con este fichero,
  `datos.municipio` sale **`null`** y la discrepancia se declara.
- **Se cambia el municipio y no la provincia** porque una parcela a caballo de dos términos
  municipales es la situación real que esto modela; y se deja `np` intacto para que el fichero
  demuestre a la vez las dos mitades de la regla: **`provincia` sigue valiendo `"MADRID"`** (los
  18 coinciden) mientras `municipio` se cae. Un fixture que rompiera los dos campos no
  distinguiría «la regla funciona» de «la regla se lo carga todo».
- **`MOSTOLES` va sin tilde y en mayúsculas** porque así escribe el servicio los nombres de
  municipio (medido: `"ALCAZAR DE SAN JUAN"` en el fixture rústico, con `Polígono` y `LABRADÍO`
  acentuados en el mismo fichero y en UTF-8 correcto). Un `MÓSTOLES` acentuado sería un dato con
  una convención que el Catastro no usa.
- **`control.cudnp` se deja en 18** y sigue cuadrando con los inmuebles contados: este fichero
  prueba UNA cosa. Mezclar aquí el contador que miente haría que un rojo no dijera cuál de los dos
  caminos se ha roto.

**Medido** (con `services/_catastro-dnp.js#leerDnprc`, no a ojo; lo afirma
[`../../../services/catastro-dnp.test.js`](../../../services/catastro-dnp.test.js)):

| | |
|---|---|
| `tipo` | **`DESCRIPTIVOS`** — una discrepancia **no** invalida la respuesta |
| `rama` / `inmuebles` / `declarados` | `lrcdnp` · 18 · 18 |
| `datos.municipio` | **`null`** |
| `datos.provincia` | `"MADRID"` — intacto, y es la mitad anti-vacuidad |
| `datos.clase` | `"URBANA"` (los 18 siguen trayendo el subárbol `lous`) |
| `discrepancias` | **1**: `{campo: 'municipio', valores: [{valor: 'MADRID', inmuebles: 17}, {valor: 'MOSTOLES', inmuebles: 1}]}` |
| `avisos` | 1, y `services/catastro.js` lo saca por el canal `alAvisar` |

## Lo que NO se ha fabricado, y por qué

- **La diagonal `lrcdnp` + rústica.** Es el hueco declarado en
  [`../PROCEDENCIA.md`](../PROCEDENCIA.md): nadie ha medido si una parcela rústica con varios
  inmuebles trae el subárbol `lors`, que es la única vía que quedaría para saber que es rústica
  sin el `cn`. **Fabricarla sería inventarse la respuesta del Catastro** justo en el punto donde
  el código tiene que decidir, y el fichero pasaría a «demostrar» una forma que nadie ha visto. El
  código hace lo honesto con ese hueco —`clase: null` cuando no es concluyente— y eso se prueba
  con un cuerpo mínimo fabricado **dentro del test** y rotulado como tal, no con un fichero que
  pareciera una captura.
- **Una referencia inexistente.** Mismo motivo, con más razón: es el hueco que impide que
  `descriptivosPorRefcat` pueda devolver `NO_ENCONTRADO`, y un fixture inventado lo cerraría en
  falso.
- **El servicio caído (5xx, timeout, DNS) y el bloqueo por abuso.** No son capturables sin
  provocarlos, y provocarlos cuesta ~10 días de denegación (override O8). Se prueban con el
  `fetch` doblado, que ya está declarado como fabricado en
  [`../../../services/_casos-catastro.js`](../../../services/_casos-catastro.js).
