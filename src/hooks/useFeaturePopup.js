import { useState, useEffect } from 'react';
import { getAuthHeaders } from '../config/geoserver';
import { sendWFST } from '../services/geoserverApi';
import { buildWFSTUpdateProps } from '../utils/wfstBuilder';

export function useFeaturePopup(mapRef, layersRef, wfsLayerMetaRef, editLayerId) {
  const [popupInfo, setPopupInfo] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Feature-click popup: WFS vector hit then WMS GetFeatureInfo fallback
  useEffect(() => {
    if (!mapRef.current) return;

    const handler = async (e) => {
      // Don't intercept clicks while the WFS geometry-edit mode is active
      if (editLayerId) {
        setPopupInfo(null);
        return;
      }

      // 1. WFS vector feature — check all gs_wfs_* layers
      let found = false;
      mapRef.current.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
        if (found) return;
        const layerId = Object.keys(layersRef.current)
          .find((id) => layersRef.current[id] === layer);
        if (!layerId || !layerId.startsWith('gs_wfs_')) return;
        const props = { ...feature.getProperties() };
        const geomName = feature.getGeometryName?.() ?? 'geometry';
        delete props[geomName];
        delete props.boundedBy;
        setPopupInfo({ pixel: e.pixel, properties: props, layerGroup: 'wfs', feature, layerId });
        found = true;
      });
      if (found) return;

      // 2. WMS GetFeatureInfo — query each visible gs_wms_* layer
      const resolution = mapRef.current.getView().getResolution();
      const projection = mapRef.current.getView().getProjection();
      for (const [layerId, layer] of Object.entries(layersRef.current)) {
        if (!layerId.startsWith('gs_wms_') || !layer.getVisible()) continue;
        const source = layer.getSource();
        const url = source?.getFeatureInfoUrl?.(e.coordinate, resolution, projection, {
          INFO_FORMAT: 'application/json',
          FEATURE_COUNT: 1,
        });
        if (!url) continue;
        try {
          const res = await fetch(url, { headers: getAuthHeaders() });
          const data = await res.json();
          if (data.features?.length > 0) {
            const props = data.features[0].properties || {};
            setPopupInfo({ pixel: e.pixel, properties: props, layerGroup: 'wms', feature: null, layerId });
            return;
          }
        } catch { /* ignore */ }
      }

      // Nothing hit — close any open popup
      setPopupInfo(null);
    };

    mapRef.current.on('singleclick', handler);
    return () => mapRef.current?.un('singleclick', handler);
  }, [editLayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save feature attribute edits via WFS-T Update (properties only)
  const handleSaveFeatureProps = async (editedProps) => {
    if (!popupInfo?.feature || !popupInfo.layerId) return;
    const meta = wfsLayerMetaRef.current[popupInfo.layerId];
    if (!meta) return;
    const fid = popupInfo.feature.getId();
    if (!fid) { alert('Feature has no ID — cannot save.'); return; }

    setIsSaving(true);
    try {
      await sendWFST(buildWFSTUpdateProps(meta, fid, editedProps));
      layersRef.current[popupInfo.layerId]?.getSource().refresh();
      setPopupInfo(null);
    } catch {
      alert('WFS-T operation failed — check console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  return { popupInfo, setPopupInfo, handleSaveFeatureProps, isSaving };
}
