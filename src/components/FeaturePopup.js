import { useState } from 'react';
import '../styles/FeaturePopup.css';

function FeaturePopup({ info, onClose, onSave, isSaving }) {
  const [editing, setEditing] = useState(false);
  const [editedProps, setEditedProps] = useState({});

  if (!info) return null;

  const { pixel, properties, layerGroup } = info;

  const propEntries = Object.entries(properties);

  const handleEditStart = () => {
    setEditedProps(Object.fromEntries(propEntries.map(([k, v]) => [k, String(v ?? '')])));
    setEditing(true);
  };

  const handleSave = async () => {
    await onSave(editedProps);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditedProps({});
  };

  // Offset the popup slightly from the click point
  const style = { left: pixel[0] + 14, top: pixel[1] + 14 };

  return (
    <div className="feature-popup" style={style}>
      {/* Header */}
      <div className="popup-header">
        <span className="popup-title">
          {layerGroup === 'wfs' ? '⚡ WFS Feature' : '🗺 WMS Feature'}
        </span>
        <button className="popup-close" onClick={onClose} title="Close">✕</button>
      </div>

      {/* Property table */}
      <div className="popup-body">
        {propEntries.length === 0 ? (
          <p className="popup-empty">No properties found</p>
        ) : (
          <table className="popup-table">
            <tbody>
              {propEntries.map(([key, value]) => (
                <tr key={key}>
                  <td className="popup-key" title={key}>{key}</td>
                  <td className="popup-value">
                    {editing ? (
                      <input
                        className="popup-input"
                        value={editedProps[key] ?? ''}
                        onChange={(e) =>
                          setEditedProps((p) => ({ ...p, [key]: e.target.value }))
                        }
                      />
                    ) : (
                      <span title={String(value ?? '')}>{String(value ?? '')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer — edit actions for WFS only */}
      {layerGroup === 'wfs' && (
        <div className="popup-footer">
          {!editing ? (
            <button className="popup-btn edit-props" onClick={handleEditStart}>
              ✏ Edit Properties
            </button>
          ) : (
            <>
              <button
                className="popup-btn save-props"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? '⏳ Saving…' : '💾 Save'}
              </button>
              <button
                className="popup-btn cancel-props"
                onClick={handleCancel}
                disabled={isSaving}
              >
                ✕ Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default FeaturePopup;
