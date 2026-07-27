<?xml version="1.0" encoding="utf-8"?>
<!--Empleo la información grafíca catastral en el tráfico inmobiliario. Formato INSPIRE GML Cadastral Parcel v4. -->
<gml:FeatureCollection gml:id="ES.SDGC.CP" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:cp="http://inspire.ec.europa.eu/schemas/cp/4.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://inspire.ec.europa.eu/schemas/cp/4.0 http://inspire.ec.europa.eu/schemas/cp/4.0/CadastralParcels.xsd">
<gml:featureMember>
      <cp:CadastralParcel gml:id="ES.LOCAL.CP.1A">
<!-- Superficie de la parcela en metros cuadrados. Tiene que coincidir con la calculada con las coordenadas.-->
         <cp:areaValue uom="m2">236</cp:areaValue>
         <cp:beginLifespanVersion xsi:nil="true" nilReason="other:unpopulated"></cp:beginLifespanVersion>
<!-- Geometria en formato GML       -->
         <cp:geometry>
<!-- srs Name código del sistema de referencia en el que se dan las coordenadas, que debe coincidir con el de la cartografía catastral -->
<!-- El sistema de referencia de la cartografía catastral varía según provincia, siendo accesible desde la consulta de cartografía en Sede -->  
           <gml:MultiSurface gml:id="MultiSurface_ES.LOCAL.CP.1A" srsName="urn:ogc:def:crs:EPSG::25830"> 
             <gml:surfaceMember>
               <gml:Surface gml:id="Surface_ES.LOCAL.CP.1A" srsName="urn:ogc:def:crs:EPSG::25830">
                  <gml:patches>
                    <gml:PolygonPatch>
                      <gml:exterior>
                        <gml:LinearRing>
<!-- Lista de coordenadas separadas por espacios o en líneas diferentes. El recinto debe cerrarse, el pimer par de coordenadas debe ser igual al último    -->
                          <gml:posList srsDimension="2">269218.83 4805295.18 269214.33 4805297.84 269208.93 4805301.04 269202.03 4805287.35 269213.26 4805280.82 269217.22 4805282.12 269220.90 4805290.06 269222.32 4805293.13 269218.83 4805295.18</gml:posList>
                        </gml:LinearRing>
                      </gml:exterior>
                    </gml:PolygonPatch>
                  </gml:patches>
                </gml:Surface>
              </gml:surfaceMember>
            </gml:MultiSurface>
         </cp:geometry>
         <cp:inspireId xmlns:base="http://inspire.ec.europa.eu/schemas/base/3.3">
           <base:Identifier >
<!-- Identificativo local de la parcela. Solo puede tener letras y números. Se recomienda (pero no es necesario) poner siempre un dígito de control, por ejemplo utilizando el algoritmo del NIF.-->
             <base:localId>1A</base:localId>
             <base:namespace>ES.LOCAL.CP</base:namespace>
           </base:Identifier>
         </cp:inspireId>
         <cp:label/>
<!--Siempre en blanco, ya que todavíaa no ha sido dada de alta en las bases de datos catastrales.-->
         <cp:nationalCadastralReference/>
      </cp:CadastralParcel>
 </gml:featureMember>
<!-- Si se desea incluir varias parcelas en un mismo fichero, se pondrá un nuevo grupo featureMember para cada parcela -->
</gml:FeatureCollection>