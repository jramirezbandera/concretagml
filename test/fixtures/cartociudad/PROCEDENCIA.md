# Procedencia de los fixtures de CartoCiudad

Respuestas **reales** del geocodificador de CartoCiudad (IGN), descargadas el
**2026-09-25** con `curl`, sin cabeceras propias y sin retocar ni un byte. Las
consume `test/services/cartociudad.test.js`.

Base: `https://www.cartociudad.es/geocoder/api/geocoder`

| fichero | petición | por qué está |
|---|---|---|
| `candidatos-portal.json` | `candidates?q=calle san restituto 72 madrid&limit=8` | Portales: llegan CON `lat`/`lng`. El primero es el portal de la parcela de demostración (9398516VK3799G) |
| `candidatos-zonas.json` | `candidates?q=alhaurin&limit=8` | Poblaciones, municipios y calles: llegan con `lat: 0, lng: 0` y hay que pedirlos con `find` |
| `candidatos-vacio.json` | `candidates?q=zzqxwv&limit=8` | Sin coincidencias: `[]`, con HTTP 200 |
| `find-callejero.json` | `find?id=290070001102&type=callejero` | Una calle: `geom` en `MULTILINESTRING` |
| `find-municipio.json` | `find?id=29007&type=Municipio` | Un municipio: `geom` en `MULTIPOLYGON` (8,5 KB) |

Medido además ese día, y escrito en la cabecera de `services/cartociudad.js`:

- `Access-Control-Allow-Origin: *` en las dos llamadas, sin clave.
- `find` sin coincidencia contesta **HTTP 204 sin cuerpo**, no 404.
- Un código postal (`type=Codpost`) llega a `find` con `geom: POINT(…)`, o sea sin
  caja que encuadrar.
- Los tipos llegan con mayúsculas irregulares: `portal`, `refcatastral`,
  `callejero`, `poblacion`, **`Municipio`**, **`Codpost`**.

No se guarda el `find` de una población: pesa ~37 KB y no prueba nada que no
pruebe ya el del municipio.
