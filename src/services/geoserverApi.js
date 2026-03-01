import { GEOSERVER_URL, GML_GEOM_MAP, getAuthHeaders } from '../config/geoserver';

export async function fetchWmsCapabilities() {
  const res = await fetch(
    `${GEOSERVER_URL}/wms?service=WMS&version=1.1.0&request=GetCapabilities`,
    { headers: getAuthHeaders() }
  );
  const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
  const layers = [];
  doc.querySelectorAll('Layer').forEach(el => {
    const nameEl  = el.querySelector(':scope > Name');
    const titleEl = el.querySelector(':scope > Title');
    if (nameEl && !el.querySelector(':scope > Layer')) {
      // WMS 1.1.0 uses <LatLonBoundingBox minx miny maxx maxy>
      const bboxEl = el.querySelector(':scope > LatLonBoundingBox');
      const bbox4326 = bboxEl ? [
        parseFloat(bboxEl.getAttribute('minx')),
        parseFloat(bboxEl.getAttribute('miny')),
        parseFloat(bboxEl.getAttribute('maxx')),
        parseFloat(bboxEl.getAttribute('maxy')),
      ] : null;
      layers.push({
        name:  nameEl.textContent.trim(),
        title: (titleEl?.textContent || nameEl.textContent).trim(),
        bbox4326,
      });
    }
  });
  return layers;
}

export async function fetchWfsCapabilities() {
  const res  = await fetch(
    `${GEOSERVER_URL}/wfs?service=WFS&version=1.0.0&request=GetCapabilities`,
    { headers: getAuthHeaders() }
  );
  const text = await res.text();
  // Extract xmlns:prefix="uri" namespace declarations
  const nsMap = {};
  for (const m of text.matchAll(/xmlns:(\w+)="([^"]+)"/g)) nsMap[m[1]] = m[2];
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const types = [];
  doc.querySelectorAll('FeatureType').forEach(el => {
    const fullName = el.querySelector('Name')?.textContent?.trim();
    const title    = el.querySelector('Title')?.textContent?.trim();
    if (!fullName) return;
    const colon         = fullName.indexOf(':');
    const featurePrefix = colon >= 0 ? fullName.slice(0, colon) : '';
    const typeName      = colon >= 0 ? fullName.slice(colon + 1) : fullName;
    // WFS 1.0.0 uses <LatLongBoundingBox minx miny maxx maxy>
    const bboxEl = el.querySelector('LatLongBoundingBox');
    const bbox4326 = bboxEl ? [
      parseFloat(bboxEl.getAttribute('minx')),
      parseFloat(bboxEl.getAttribute('miny')),
      parseFloat(bboxEl.getAttribute('maxx')),
      parseFloat(bboxEl.getAttribute('maxy')),
    ] : null;
    types.push({ fullName, typeName, title: title || fullName, featurePrefix, featureNS: nsMap[featurePrefix] || '', bbox4326 });
  });
  return types;
}

export async function fetchGeomField(fullTypeName) {
  try {
    const res  = await fetch(
      `${GEOSERVER_URL}/wfs?service=WFS&version=1.0.0&request=DescribeFeatureType&typeName=${encodeURIComponent(fullTypeName)}`,
      { headers: getAuthHeaders() }
    );
    const text = await res.text();
    for (const [gmlType, geomType] of Object.entries(GML_GEOM_MAP)) {
      const esc = gmlType.replace(':', '\\:');
      const m = text.match(new RegExp(`name="([^"]+)"[^>]+type="${esc}"`))
             || text.match(new RegExp(`type="${esc}"[^>]+name="([^"]+)"`));
      if (m) return { geometryName: m[1], geometryType: geomType };
    }
  } catch { /* ignore */ }
  return { geometryName: 'geom', geometryType: 'Geometry' };
}

// Sends a WFS-T XML body to GeoServer. Throws on HTTP error.
export async function sendWFST(xml) {
  const res = await fetch(`${GEOSERVER_URL}/wfs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      ...getAuthHeaders(),
    },
    body: xml,
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('WFS-T error:', errText);
    throw new Error(errText);
  }
}
