import { useState, useEffect } from 'react';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import TileWMS from 'ol/source/TileWMS';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle';
import { GEOSERVER_URL } from '../config/geoserver';
import { fetchWmsCapabilities, fetchWfsCapabilities, fetchGeomField } from '../services/geoserverApi';

const BASE_LAYERS = [
  { id: 'osm',       name: 'OpenStreetMap',   group: 'base', defaultVisible: true  },
  { id: 'satellite', name: 'Satellite',        group: 'base', defaultVisible: false },
  { id: 'toner',     name: 'Toner',            group: 'base', defaultVisible: false },
  { id: 'districts', name: 'Indian Districts', group: 'base', defaultVisible: false },
  { id: 'talukas',   name: 'Indian Talluka',   group: 'base', defaultVisible: false },
];

const WFS_COLORS = [
  '#FF6B35', '#9B5DE5', '#00BBF9', '#F15BB5',
  '#00F5D4', '#FEE440', '#FB5607', '#3A86FF',
];

export function useLayerLoader(mapRef, layersRef, wfsLayerMetaRef) {
  const [availableLayers, setAvailableLayers] = useState(BASE_LAYERS);
  const [layersLoading, setLayersLoading] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    const wfsGeoJSON = new GeoJSON({ dataProjection: 'EPSG:3857' });

    const loadLayers = async () => {
      setLayersLoading(true);
      try {
        const [wmsLayers, wfsTypes] = await Promise.all([
          fetchWmsCapabilities(),
          fetchWfsCapabilities(),
        ]);

        // Fetch geometry info for every WFS type in parallel
        const wfsWithGeom = await Promise.all(
          wfsTypes.map(async (t) => ({ ...t, ...(await fetchGeomField(t.fullName)) }))
        );

        // Insert point: just before the marker layer (always last)
        let insertIdx = mapRef.current.getLayers().getLength() - 1;

        // Build & register WMS tile layers
        const newWmsEntries = wmsLayers.map((wl) => {
          const id = `gs_wms_${wl.name.replace(':', '_')}`;
          const layer = new TileLayer({
            source: new TileWMS({
              url: `${GEOSERVER_URL}/wms`,
              params: { LAYERS: wl.name, TILED: true, FORMAT: 'image/png', TRANSPARENT: true },
              serverType: 'geoserver',
              crossOrigin: 'anonymous',
            }),
            visible: false,
          });
          layersRef.current[id] = layer;
          mapRef.current.getLayers().insertAt(insertIdx++, layer);
          const legendUrl = `${GEOSERVER_URL}/wms?SERVICE=WMS&VERSION=1.1.0&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${encodeURIComponent(wl.name)}`;
          return { id, name: wl.title, group: 'wms', defaultVisible: false, bbox4326: wl.bbox4326, legendUrl };
        });

        // Build & register WFS vector layers
        const newWfsEntries = wfsWithGeom.map((wt, idx) => {
          const id = `gs_wfs_${wt.fullName.replace(':', '_')}`;
          const color = WFS_COLORS[idx % WFS_COLORS.length];
          const isLine = wt.geometryType.includes('LineString');
          const style = isLine
            ? new Style({ stroke: new Stroke({ color, width: 2 }) })
            : new Style({
                image: new CircleStyle({
                  radius: 6,
                  fill: new Fill({ color }),
                  stroke: new Stroke({ color: '#fff', width: 1 }),
                }),
              });

          const layer = new VectorLayer({
            source: new VectorSource({
              format: wfsGeoJSON,
              url: (extent) =>
                `${GEOSERVER_URL}/wfs?service=WFS&version=1.1.0&request=GetFeature` +
                `&typeName=${wt.fullName}&outputFormat=application/json` +
                `&srsname=EPSG:3857&bbox=${extent.join(',')},EPSG:3857`,
              strategy: bboxStrategy,
            }),
            style,
            visible: false,
          });

          layersRef.current[id] = layer;
          mapRef.current.getLayers().insertAt(insertIdx++, layer);

          // Store WFS-T metadata for edit operations
          wfsLayerMetaRef.current[id] = {
            typeName:      wt.typeName,
            featurePrefix: wt.featurePrefix,
            featureNS:     wt.featureNS,
            geometryName:  wt.geometryName,
            geometryType:  wt.geometryType,
          };

          return { id, name: wt.title, group: 'wfs', defaultVisible: false, bbox4326: wt.bbox4326 };
        });

        setAvailableLayers([
          ...BASE_LAYERS,
          ...newWmsEntries,
          ...newWfsEntries,
        ]);
      } catch (err) {
        console.error('Failed to load GeoServer layers:', err);
      } finally {
        setLayersLoading(false);
      }
    };

    loadLayers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { availableLayers, layersLoading };
}
