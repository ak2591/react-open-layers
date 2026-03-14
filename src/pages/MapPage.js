import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fromLonLat, transformExtent } from 'ol/proj';
import Sidebar from '../components/Sidebar';
import SearchBar from '../components/SearchBar';
import FeaturePopup from '../components/FeaturePopup';
import { useMapInit } from '../hooks/useMapInit';
import { useLayerLoader } from '../hooks/useLayerLoader';
import { useFeaturePopup } from '../hooks/useFeaturePopup';
import { useDrawTools } from '../hooks/useDrawTools';
import { useWfsEdit } from '../hooks/useWfsEdit';
import '../styles/MapPage.css';

function MapPage() {
  const mapContainerRef = useRef(null);
  const wfsLayerMetaRef = useRef({});
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectMode, setSelectMode] = useState('none');

  // ── Hooks ────────────────────────────────────────────────────────────────
  const { mapRef, layersRef, terraDrawRef, doubleClickZoomRef } = useMapInit(mapContainerRef, setSelectMode);
  const { availableLayers, layersLoading } = useLayerLoader(mapRef, layersRef, wfsLayerMetaRef);

  const {
    editLayerId, hasUnsavedChanges, selectedWfsFeature, insertActive, isSaving: editSaving,
    activateWfsEdit, deactivateWfsEdit, saveWfsChanges, activateInsert, deleteSelectedFeature,
  } = useWfsEdit(mapRef, layersRef, wfsLayerMetaRef);

  const {
    popupInfo, setPopupInfo, handleSaveFeatureProps, isSaving: popupSaving,
  } = useFeaturePopup(mapRef, layersRef, wfsLayerMetaRef, editLayerId);

  const {
    activateCircleDraw, activateRectangleDraw, activateFreehandDraw,
    activatePolygonDraw, activateLineDraw, activatePointDraw, clearSelections,
  } = useDrawTools(terraDrawRef, setSelectMode, doubleClickZoomRef);

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem('gsAuth')) navigate('/');
  }, [navigate]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('gsAuth');
    localStorage.removeItem('gsUser');
    navigate('/');
  };

  const handleSearch = (location) => {
    mapRef.current?.getView().animate({
      center: fromLonLat([location.lon, location.lat]),
      zoom: 12,
      duration: 500,
    });
  };

  const handleLayerToggle = (layerId, isVisible) => {
    const layer = layersRef.current[layerId];
    if (!layer) return;
    layer.setVisible(isVisible);

    if (!isVisible || !mapRef.current) return;

    const layerEntry = availableLayers.find((l) => l.id === layerId);
    if (layerEntry?.bbox4326) {
      const bbox = layerEntry.bbox4326;
      if (bbox.every(isFinite)) {
        const extent = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857');
        mapRef.current.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 600, maxZoom: 18 });
      }
    } else {
      const src = layer.getSource?.();
      if (src?.getExtent) {
        const extent = src.getExtent();
        if (extent && extent.every(isFinite)) {
          mapRef.current.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 600, maxZoom: 18 });
        }
      }
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="map-page">
      <Sidebar
        isOpen={sidebarOpen}
        availableLayers={availableLayers}
        onLayerToggle={handleLayerToggle}
        editLayerId={editLayerId}
        onWfsEdit={activateWfsEdit}
        layersLoading={layersLoading}
      />
      <div className="map-content">
        <div className="map-header">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="sidebar-toggle-btn"
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>

          <h1>Map View</h1>

          <SearchBar onSearch={handleSearch} />

          <div className="select-controls">
            <button onClick={activateCircleDraw}     className={`control-btn ${selectMode === 'circle'     ? 'active' : ''}`} title="Circle Draw">⭕ Circle</button>
            <button onClick={activateRectangleDraw}  className={`control-btn ${selectMode === 'rectangle'  ? 'active' : ''}`} title="Rectangle Draw">▭ Rectangle</button>
            <button onClick={activateFreehandDraw}   className={`control-btn ${selectMode === 'freehand'   ? 'active' : ''}`} title="Freehand Draw">✏ Freehand</button>
            <button onClick={activatePolygonDraw}    className={`control-btn ${selectMode === 'polygon'    ? 'active' : ''}`} title="Polygon Draw">⬡ Polygon</button>
            <button onClick={activateLineDraw}       className={`control-btn ${selectMode === 'linestring' ? 'active' : ''}`} title="Line Draw">╱ Line</button>
            <button onClick={activatePointDraw}      className={`control-btn ${selectMode === 'point'      ? 'active' : ''}`} title="Point Draw">• Point</button>
            <button onClick={clearSelections}        className="control-btn clear-btn" title="Clear all drawings">✕ Clear</button>
          </div>

          {editLayerId && (
            <div className="wfs-edit-bar">
              <span className="wfs-edit-label">
                ✏ Editing: {availableLayers.find(l => l.id === editLayerId)?.name}
              </span>
              <button
                onClick={activateInsert}
                className={`control-btn ${insertActive ? 'active' : ''}`}
                disabled={editSaving}
                title={insertActive ? 'Click map to place feature…' : 'Add a new feature'}
              >
                ➕ Add
              </button>
              <button
                onClick={deleteSelectedFeature}
                className="control-btn clear-btn"
                disabled={!selectedWfsFeature || editSaving}
                title="Delete selected feature"
              >
                🗑 Delete
              </button>
              <button
                onClick={saveWfsChanges}
                className="control-btn save-btn"
                disabled={!hasUnsavedChanges || editSaving}
                title="Save changes to GeoServer"
              >
                {editSaving ? '⏳ Saving…' : '💾 Save'}
              </button>
              <button
                onClick={deactivateWfsEdit}
                className="control-btn clear-btn"
                disabled={editSaving}
                title="Exit edit mode"
              >
                ✕ Done
              </button>
            </div>
          )}

          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>

        <div ref={mapContainerRef} className="map-container">
          <FeaturePopup
            info={popupInfo}
            onClose={() => setPopupInfo(null)}
            onSave={handleSaveFeatureProps}
            isSaving={popupSaving}
          />
        </div>
      </div>
    </div>
  );
}

export default MapPage;
