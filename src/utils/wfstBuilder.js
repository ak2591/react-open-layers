import { GML_SRS } from '../config/geoserver';

const gml2Coords = (coords) =>
  coords.map(([lon, lat]) => `${lon},${lat}`).join(' ');

export const geomToGML = (geometry) => {
  const type = geometry.getType();
  if (type === 'Point') {
    const [lon, lat] = geometry.getCoordinates();
    return `<gml:Point srsName="${GML_SRS}"><gml:coordinates>${lon},${lat}</gml:coordinates></gml:Point>`;
  }
  if (type === 'LineString') {
    return `<gml:LineString srsName="${GML_SRS}"><gml:coordinates>${gml2Coords(geometry.getCoordinates())}</gml:coordinates></gml:LineString>`;
  }
  if (type === 'MultiLineString') {
    const members = geometry.getCoordinates()
      .map(line =>
        `<gml:lineStringMember><gml:LineString><gml:coordinates>${gml2Coords(line)}</gml:coordinates></gml:LineString></gml:lineStringMember>`)
      .join('');
    return `<gml:MultiLineString srsName="${GML_SRS}">${members}</gml:MultiLineString>`;
  }
  if (type === 'Polygon') {
    const ring = geometry.getCoordinates()[0];
    return `<gml:Polygon srsName="${GML_SRS}"><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>${gml2Coords(ring)}</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs></gml:Polygon>`;
  }
  throw new Error('geomToGML: unsupported type ' + type);
};

const wfstHeader = (meta) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.0.0"
  xmlns:wfs="http://www.opengis.net/wfs"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:gml="http://www.opengis.net/gml"
  xmlns:${meta.featurePrefix}="${meta.featureNS}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/wfs.xsd">`;

export const buildWFSTUpdate = (meta, features) => {
  const updates = features.map(f => {
    const geomGML = geomToGML(f.getGeometry());
    return `  <wfs:Update typeName="${meta.featurePrefix}:${meta.typeName}">
    <wfs:Property>
      <wfs:Name>${meta.geometryName}</wfs:Name>
      <wfs:Value>${geomGML}</wfs:Value>
    </wfs:Property>
    <ogc:Filter><ogc:FeatureId fid="${f.getId()}"/></ogc:Filter>
  </wfs:Update>`;
  }).join('\n');
  return `${wfstHeader(meta)}\n${updates}\n</wfs:Transaction>`;
};

export const buildWFSTInsert = (meta, geometry) => {
  const geomGML = geomToGML(geometry);
  const ns = meta.featurePrefix;
  return `${wfstHeader(meta)}
  <wfs:Insert>
    <${ns}:${meta.typeName}>
      <${ns}:${meta.geometryName}>${geomGML}</${ns}:${meta.geometryName}>
    </${ns}:${meta.typeName}>
  </wfs:Insert>
</wfs:Transaction>`;
};

export const buildWFSTDelete = (meta, featureId) =>
  `${wfstHeader(meta)}
  <wfs:Delete typeName="${meta.featurePrefix}:${meta.typeName}">
    <ogc:Filter><ogc:FeatureId fid="${featureId}"/></ogc:Filter>
  </wfs:Delete>
</wfs:Transaction>`;

export const buildWFSTUpdateProps = (meta, featureId, props) => {
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const propXml = Object.entries(props)
    .filter(([k]) => k !== meta.geometryName && k !== 'boundedBy')
    .map(([k, v]) =>
      `  <wfs:Property>\n    <wfs:Name>${k}</wfs:Name>\n    <wfs:Value>${esc(v)}</wfs:Value>\n  </wfs:Property>`
    )
    .join('\n');
  return `${wfstHeader(meta)}
  <wfs:Update typeName="${meta.featurePrefix}:${meta.typeName}">
${propXml}
    <ogc:Filter><ogc:FeatureId fid="${featureId}"/></ogc:Filter>
  </wfs:Update>
</wfs:Transaction>`;
};
