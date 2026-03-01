import { useState, useRef } from 'react';
import Select from 'ol/interaction/Select';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import Draw from 'ol/interaction/Draw';
import VectorSource from 'ol/source/Vector';
import { Point, MultiLineString } from 'ol/geom';
import { toLonLat } from 'ol/proj';
import { sendWFST } from '../services/geoserverApi';
import { buildWFSTUpdate, buildWFSTInsert, buildWFSTDelete } from '../utils/wfstBuilder';

export function useWfsEdit(mapRef, layersRef, wfsLayerMetaRef) {
  const [editLayerId, setEditLayerId] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedWfsFeature, setSelectedWfsFeature] = useState(null);
  const [insertActive, setInsertActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const editSelectRef = useRef(null);
  const editModifyRef = useRef(null);
  const editSnapRef = useRef(null);
  const modifiedFeaturesRef = useRef(new Set());
  const insertDrawRef = useRef(null);
  const mapClickListenerRef = useRef(null);

  // Internal helper: send WFS-T XML, refresh layer source, handle errors
  const execWFST = async (xml, layerId) => {
    setIsSaving(true);
    try {
      await sendWFST(xml);
      layersRef.current[layerId]?.getSource().refresh();
    } catch {
      alert('WFS-T operation failed — check console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  const stopInsert = () => {
    if (mapClickListenerRef.current) {
      mapRef.current?.un('singleclick', mapClickListenerRef.current);
      mapClickListenerRef.current = null;
    }
    if (insertDrawRef.current) {
      mapRef.current?.removeInteraction(insertDrawRef.current);
      insertDrawRef.current = null;
    }
    setInsertActive(false);
  };

  const deactivateWfsEdit = () => {
    stopInsert();
    if (editSelectRef.current) {
      mapRef.current.removeInteraction(editSelectRef.current);
      editSelectRef.current = null;
    }
    if (editModifyRef.current) {
      mapRef.current.removeInteraction(editModifyRef.current);
      editModifyRef.current = null;
    }
    if (editSnapRef.current) {
      mapRef.current.removeInteraction(editSnapRef.current);
      editSnapRef.current = null;
    }
    modifiedFeaturesRef.current.clear();
    setEditLayerId(null);
    setHasUnsavedChanges(false);
    setSelectedWfsFeature(null);
  };

  const activateWfsEdit = (layerId) => {
    deactivateWfsEdit();
    const layer = layersRef.current[layerId];
    if (!layer) return;

    layer.setVisible(true);

    const selectInteraction = new Select({ layers: [layer] });
    selectInteraction.on('select', (e) => {
      setSelectedWfsFeature(e.selected[0] ?? null);
    });

    const modifyInteraction = new Modify({ features: selectInteraction.getFeatures() });
    modifyInteraction.on('modifyend', (e) => {
      e.features.forEach((f) => modifiedFeaturesRef.current.add(f));
      setHasUnsavedChanges(true);
    });

    const snapInteraction = new Snap({ source: layer.getSource() });

    mapRef.current.addInteraction(selectInteraction);
    mapRef.current.addInteraction(modifyInteraction);
    mapRef.current.addInteraction(snapInteraction);

    editSelectRef.current = selectInteraction;
    editModifyRef.current = modifyInteraction;
    editSnapRef.current = snapInteraction;
    setEditLayerId(layerId);
  };

  const saveWfsChanges = async () => {
    if (!editLayerId || modifiedFeaturesRef.current.size === 0) return;
    const meta = wfsLayerMetaRef.current[editLayerId];
    if (!meta) return;

    const updates = Array.from(modifiedFeaturesRef.current).map((f) => {
      const clone = f.clone();
      clone.setId(f.getId());
      clone.getGeometry().transform('EPSG:3857', 'EPSG:4326');
      return clone;
    });

    await execWFST(buildWFSTUpdate(meta, updates), editLayerId);
    modifiedFeaturesRef.current.clear();
    setHasUnsavedChanges(false);
  };

  const activateInsert = () => {
    if (!editLayerId) return;
    const meta = wfsLayerMetaRef.current[editLayerId];
    if (!meta) return;

    stopInsert();
    setInsertActive(true);

    if (meta.geometryType === 'Point') {
      const clickHandler = async (e) => {
        stopInsert();
        const [lon, lat] = toLonLat(e.coordinate);
        const geom = new Point([lon, lat]);
        await execWFST(buildWFSTInsert(meta, geom), editLayerId);
      };
      mapClickListenerRef.current = clickHandler;
      mapRef.current.on('singleclick', clickHandler);
    } else {
      // LineString / MultiLineString — use OL Draw
      const draw = new Draw({ source: new VectorSource(), type: 'LineString' });
      draw.on('drawend', async (e) => {
        stopInsert();
        const rawGeom = e.feature.getGeometry().clone();
        rawGeom.transform('EPSG:3857', 'EPSG:4326');
        const geom = meta.geometryType === 'MultiLineString'
          ? new MultiLineString([rawGeom.getCoordinates()])
          : rawGeom;
        await execWFST(buildWFSTInsert(meta, geom), editLayerId);
      });
      mapRef.current.addInteraction(draw);
      insertDrawRef.current = draw;
    }
  };

  const deleteSelectedFeature = async () => {
    if (!editLayerId || !selectedWfsFeature) return;
    const meta = wfsLayerMetaRef.current[editLayerId];
    if (!meta) return;

    const fid = selectedWfsFeature.getId();
    if (!fid) { alert('Feature has no ID — cannot delete.'); return; }

    editSelectRef.current?.getFeatures().clear();
    setSelectedWfsFeature(null);
    await execWFST(buildWFSTDelete(meta, fid), editLayerId);
  };

  return {
    editLayerId,
    hasUnsavedChanges,
    selectedWfsFeature,
    insertActive,
    isSaving,
    activateWfsEdit,
    deactivateWfsEdit,
    saveWfsChanges,
    activateInsert,
    deleteSelectedFeature,
  };
}
