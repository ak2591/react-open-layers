import { useState, useRef } from 'react';
import Select from 'ol/interaction/Select';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import Draw from 'ol/interaction/Draw';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
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
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const editSelectRef = useRef(null);
  const editModifyRef = useRef(null);
  const editSnapRef = useRef(null);
  const modifiedFeaturesRef = useRef(new Set());
  const pendingInsertsRef = useRef([]);   // OL Features added locally, not yet saved
  const pendingDeletesRef = useRef([]);   // { fid, feature } — removed locally, not yet saved
  const insertDrawRef = useRef(null);
  const mapClickListenerRef = useRef(null);
  const undoStackRef = useRef([]);        // { type, feature, geomBefore?, geomAfter?, source?, fid? }
  const redoStackRef = useRef([]);
  const beforeSnapshotsRef = useRef(new Map()); // feature → geom clone captured at modifystart
  const editLayerIdRef = useRef(null);    // sync ref so async callbacks always see current value

  /* ── helpers ─────────────────────────────────────────────── */

  const syncUndoRedoState = () => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  };

  const syncHasChanges = () => {
    const has =
      modifiedFeaturesRef.current.size > 0 ||
      pendingInsertsRef.current.length > 0 ||
      pendingDeletesRef.current.length > 0;
    setHasUnsavedChanges(has);
  };

  const pushUndo = (action) => {
    undoStackRef.current.push(action);
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  /* ── stop insert mode ────────────────────────────────────── */

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

  /* ── deactivate ──────────────────────────────────────────── */

  const deactivateWfsEdit = () => {
    stopInsert();
    if (editSelectRef.current) {
      mapRef.current?.removeInteraction(editSelectRef.current);
      editSelectRef.current = null;
    }
    if (editModifyRef.current) {
      mapRef.current?.removeInteraction(editModifyRef.current);
      editModifyRef.current = null;
    }
    if (editSnapRef.current) {
      mapRef.current?.removeInteraction(editSnapRef.current);
      editSnapRef.current = null;
    }

    // Refresh source to discard any unsaved local changes
    const lid = editLayerIdRef.current;
    if (lid) layersRef.current[lid]?.getSource().refresh();

    modifiedFeaturesRef.current.clear();
    pendingInsertsRef.current = [];
    pendingDeletesRef.current = [];
    undoStackRef.current = [];
    redoStackRef.current = [];
    beforeSnapshotsRef.current.clear();

    setEditLayerId(null);
    editLayerIdRef.current = null;
    setHasUnsavedChanges(false);
    setSelectedWfsFeature(null);
    setCanUndo(false);
    setCanRedo(false);
  };

  /* ── activate ────────────────────────────────────────────── */

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

    modifyInteraction.on('modifystart', (e) => {
      e.features.forEach((f) => {
        if (!beforeSnapshotsRef.current.has(f)) {
          beforeSnapshotsRef.current.set(f, f.getGeometry().clone());
        }
      });
    });

    modifyInteraction.on('modifyend', (e) => {
      e.features.forEach((f) => {
        const geomBefore = beforeSnapshotsRef.current.get(f);
        beforeSnapshotsRef.current.delete(f);
        if (geomBefore) {
          pushUndo({ type: 'modify', feature: f, geomBefore, geomAfter: f.getGeometry().clone() });
        }
        modifiedFeaturesRef.current.add(f);
      });
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
    editLayerIdRef.current = layerId;
  };

  /* ── save ────────────────────────────────────────────────── */

  const saveWfsChanges = async () => {
    const lid = editLayerIdRef.current;
    if (!lid) return;
    const meta = wfsLayerMetaRef.current[lid];
    if (!meta) return;

    const hasModify  = modifiedFeaturesRef.current.size > 0;
    const hasInserts = pendingInsertsRef.current.length > 0;
    const hasDeletes = pendingDeletesRef.current.length > 0;
    if (!hasModify && !hasInserts && !hasDeletes) return;

    setIsSaving(true);
    try {
      if (hasModify) {
        const updates = Array.from(modifiedFeaturesRef.current).map((f) => {
          const clone = f.clone();
          clone.setId(f.getId());
          clone.getGeometry().transform('EPSG:3857', 'EPSG:4326');
          return clone;
        });
        await sendWFST(buildWFSTUpdate(meta, updates));
      }
      if (hasInserts) {
        for (const feat of pendingInsertsRef.current) {
          const geom = feat.getGeometry().clone();
          geom.transform('EPSG:3857', 'EPSG:4326');
          await sendWFST(buildWFSTInsert(meta, geom));
        }
      }
      if (hasDeletes) {
        for (const { fid } of pendingDeletesRef.current) {
          await sendWFST(buildWFSTDelete(meta, fid));
        }
      }
      layersRef.current[lid]?.getSource().refresh();
    } catch {
      alert('WFS-T operation failed — check console for details.');
    } finally {
      setIsSaving(false);
    }

    modifiedFeaturesRef.current.clear();
    pendingInsertsRef.current = [];
    pendingDeletesRef.current = [];
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHasUnsavedChanges(false);
    setCanUndo(false);
    setCanRedo(false);
  };

  /* ── insert ──────────────────────────────────────────────── */

  const activateInsert = () => {
    const lid = editLayerIdRef.current;
    if (!lid) return;
    const meta = wfsLayerMetaRef.current[lid];
    if (!meta) return;

    stopInsert();
    setInsertActive(true);

    const source = layersRef.current[lid]?.getSource();

    if (meta.geometryType === 'Point') {
      const clickHandler = (e) => {
        stopInsert();
        const feat = new Feature(new Point(e.coordinate)); // stored in EPSG:3857
        source.addFeature(feat);
        pendingInsertsRef.current.push(feat);
        pushUndo({ type: 'insert', feature: feat, source });
        setHasUnsavedChanges(true);
      };
      mapClickListenerRef.current = clickHandler;
      mapRef.current.on('singleclick', clickHandler);
    } else {
      // LineString / MultiLineString — use OL Draw
      const draw = new Draw({ source: new VectorSource(), type: 'LineString' });
      draw.on('drawend', (e) => {
        stopInsert();
        const feat = e.feature;
        source.addFeature(feat);
        pendingInsertsRef.current.push(feat);
        pushUndo({ type: 'insert', feature: feat, source });
        setHasUnsavedChanges(true);
      });
      mapRef.current.addInteraction(draw);
      insertDrawRef.current = draw;
    }
  };

  /* ── delete ──────────────────────────────────────────────── */

  const deleteSelectedFeature = () => {
    const lid = editLayerIdRef.current;
    if (!lid || !selectedWfsFeature) return;

    const feature = selectedWfsFeature;
    const source = layersRef.current[lid]?.getSource();

    // If it's a pending (unsaved) insert, just remove it — no server delete needed
    const insertIdx = pendingInsertsRef.current.indexOf(feature);
    if (insertIdx !== -1) {
      pendingInsertsRef.current.splice(insertIdx, 1);
      source?.removeFeature(feature);
      editSelectRef.current?.getFeatures().clear();
      setSelectedWfsFeature(null);
      // Remove the matching insert action from undo stack
      const undoIdx = undoStackRef.current.reduce(
        (found, a, i) => (a.type === 'insert' && a.feature === feature ? i : found), -1
      );
      if (undoIdx !== -1) undoStackRef.current.splice(undoIdx, 1);
      syncUndoRedoState();
      syncHasChanges();
      return;
    }

    const fid = feature.getId();
    if (!fid) { alert('Feature has no ID — cannot delete.'); return; }

    source?.removeFeature(feature);
    pendingDeletesRef.current.push({ fid, feature });
    pushUndo({ type: 'delete', feature, source, fid });
    editSelectRef.current?.getFeatures().clear();
    setSelectedWfsFeature(null);
    setHasUnsavedChanges(true);
  };

  /* ── undo ────────────────────────────────────────────────── */

  const undoEdit = () => {
    const action = undoStackRef.current.pop();
    if (!action) return;

    if (action.type === 'modify') {
      action.feature.setGeometry(action.geomBefore.clone());
      // Keep in modifiedFeaturesRef — the reverted geometry still differs from server state
    } else if (action.type === 'insert') {
      action.source.removeFeature(action.feature);
      const idx = pendingInsertsRef.current.indexOf(action.feature);
      if (idx !== -1) pendingInsertsRef.current.splice(idx, 1);
    } else if (action.type === 'delete') {
      action.source.addFeature(action.feature);
      const idx = pendingDeletesRef.current.findIndex((d) => d.fid === action.fid);
      if (idx !== -1) pendingDeletesRef.current.splice(idx, 1);
    }

    redoStackRef.current.push(action);
    syncUndoRedoState();
    syncHasChanges();
  };

  /* ── redo ────────────────────────────────────────────────── */

  const redoEdit = () => {
    const action = redoStackRef.current.pop();
    if (!action) return;

    if (action.type === 'modify') {
      action.feature.setGeometry(action.geomAfter.clone());
      modifiedFeaturesRef.current.add(action.feature);
    } else if (action.type === 'insert') {
      action.source.addFeature(action.feature);
      pendingInsertsRef.current.push(action.feature);
    } else if (action.type === 'delete') {
      action.source.removeFeature(action.feature);
      pendingDeletesRef.current.push({ fid: action.fid, feature: action.feature });
    }

    undoStackRef.current.push(action);
    syncUndoRedoState();
    setHasUnsavedChanges(true);
  };

  return {
    editLayerId,
    hasUnsavedChanges,
    selectedWfsFeature,
    insertActive,
    isSaving,
    canUndo,
    canRedo,
    activateWfsEdit,
    deactivateWfsEdit,
    saveWfsChanges,
    activateInsert,
    deleteSelectedFeature,
    undoEdit,
    redoEdit,
  };
}
