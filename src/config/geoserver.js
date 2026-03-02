export const GEOSERVER_URL = process.env.REACT_APP_GEOSERVER_URL || 'https://163.245.209.231/geoserver';

export const GML_SRS = 'http://www.opengis.net/gml/srs/epsg.xml#4326';

export const GML_GEOM_MAP = {
  'gml:PointPropertyType':            'Point',
  'gml:MultiPointPropertyType':       'MultiPoint',
  'gml:LineStringPropertyType':       'LineString',
  'gml:MultiLineStringPropertyType':  'MultiLineString',
  'gml:PolygonPropertyType':          'Polygon',
  'gml:MultiPolygonPropertyType':     'MultiPolygon',
  'gml:GeometryPropertyType':         'Geometry',
  'gml:AbstractGeometryType':         'Geometry',
};

export const getAuthHeaders = () => ({
  Authorization: 'Basic ' + (localStorage.getItem('gsAuth') || ''),
});
