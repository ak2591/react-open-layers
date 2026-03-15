import { useState, useEffect } from 'react';
import '../styles/LayerControl.css';

const GROUP_META = {
  base: { label: 'Base Layers',      color: '#3d5a80' },
  wms:  { label: 'GeoServer WMS',    color: '#1a6b3c' },
  wfs:  { label: 'GeoServer WFS',    color: '#7b3f9e' },
};

function LayerControl({ availableLayers, onLayerToggle, editLayerId, onWfsEdit, layersLoading }) {
  const [expandedGroups, setExpandedGroups] = useState({ base: true, wms: false, wfs: false });
  const [expandedLegends, setExpandedLegends] = useState({});

  const toggleLegend = (layerId) => {
    setExpandedLegends((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };
  const [activeLayers, setActiveLayers] = useState(
    () => Object.fromEntries(availableLayers.map((l) => [l.id, l.defaultVisible ?? false]))
  );

  // Merge newly arrived layers into activeLayers and auto-expand their group
  useEffect(() => {
    setActiveLayers((prev) => {
      const next = { ...prev };
      let changed = false;
      availableLayers.forEach((l) => {
        if (!(l.id in next)) {
          next[l.id] = l.defaultVisible ?? false;
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    // Auto-expand WMS / WFS groups the first time layers arrive in them
    setExpandedGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      availableLayers.forEach((l) => {
        const g = l.group || 'base';
        if (g !== 'base' && !prev[g]) {
          next[g] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [availableLayers]);

  const handleLayerToggle = (layerId) => {
    const newVisible = !activeLayers[layerId];
    setActiveLayers((prev) => ({ ...prev, [layerId]: newVisible }));
    onLayerToggle(layerId, newVisible);
  };

  const toggleGroup = (group) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  // Group layers by their `group` field, preserving declaration order
  const grouped = availableLayers.reduce((acc, layer) => {
    const g = layer.group || 'base';
    if (!acc[g]) acc[g] = [];
    acc[g].push(layer);
    return acc;
  }, {});

  // Groups that stream from GeoServer and may still be loading
  const remoteGroups = ['wms', 'wfs'];

  return (
    <div className="layer-control">
      {/* Show GeoServer groups with a loading placeholder while fetching */}
      {layersLoading && remoteGroups.map((g) => {
        if (grouped[g]) return null; // already rendered below
        const meta = GROUP_META[g];
        return (
          <div key={`loading-${g}`} className="layer-group">
            <div className="layer-menu-item" style={{ backgroundColor: meta.color }}>
              <span className="layer-menu-label">{meta.label}</span>
              <span className="layer-menu-icon">⏳</span>
            </div>
            <div className="layer-list">
              <div className="layer-loading-row">Loading layers…</div>
            </div>
          </div>
        );
      })}

      {Object.entries(grouped).map(([group, layers]) => {
        const meta = GROUP_META[group] || { label: group, color: '#3d5a80' };
        return (
          <div key={group} className="layer-group">
            <div
              className="layer-menu-item"
              style={{ backgroundColor: meta.color }}
              onClick={() => toggleGroup(group)}
            >
              <span className="layer-menu-label">{meta.label}</span>
              <span className="layer-menu-icon">{expandedGroups[group] ? '▼' : '▶'}</span>
            </div>

            {expandedGroups[group] && (
              <div className="layer-list">
                {layers.map((layer) => {
                  const isEditActive = editLayerId === layer.id;
                  const legendOpen = expandedLegends[layer.id] ?? false;
                  return (
                    <div key={layer.id} className="layer-item-wrapper">
                      <div className="layer-item">
                        <label className="layer-label">
                          <input
                            type="checkbox"
                            checked={activeLayers[layer.id] ?? false}
                            onChange={() => handleLayerToggle(layer.id)}
                            className="layer-checkbox"
                          />
                          <span className="layer-name">{layer.name}</span>
                        </label>
                        <div className="layer-actions">
                          {layer.legendUrl && (
                            <button
                              className={`legend-btn ${legendOpen ? 'active' : ''}`}
                              title="Toggle legend"
                              onClick={() => toggleLegend(layer.id)}
                            >
                              ▤
                            </button>
                          )}
                          {group === 'wfs' && (
                            <button
                              className={`edit-btn ${isEditActive ? 'active' : ''}`}
                              title={isEditActive ? 'Editing…' : 'Edit features'}
                              onClick={() => onWfsEdit(layer.id)}
                            >
                              ✏
                            </button>
                          )}
                          <span className={`layer-toggle ${activeLayers[layer.id] ? 'on' : 'off'}`}>
                            {activeLayers[layer.id] ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>
                      {layer.legendUrl && legendOpen && (
                        <div className="layer-legend">
                          <img
                            src={layer.legendUrl}
                            alt={`${layer.name} legend`}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default LayerControl;
