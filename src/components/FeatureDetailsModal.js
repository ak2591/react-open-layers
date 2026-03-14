import './../styles/FeatureDetailsModal.css';

function FeatureDetailsModal({ feature, isOpen, onClose }) {
  if (!isOpen || !feature) {
    return null;
  }

  const properties =  feature.getProperties();

  const getStringAndNumberProps = (obj) => {
    const result = {};

    Object.keys(obj).forEach((key) => {
      const value = obj[key];

      if (typeof value === "string" || typeof value === "number") {
        result[key] = value;
      }
    });

    return result;
  };

// Usage
const filteredProps = getStringAndNumberProps(properties);

  return (
    <div className="feature-modal-overlay" onClick={onClose}>
      <div className="feature-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{properties.FULL_NAME || 'Feature Details'}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="properties-grid">
            {Object.entries(filteredProps).map(([key, value]) => (
              <div key={key} className="property-item">
                <div className="property-label">{key}</div>
                <div className="property-value">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-action-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeatureDetailsModal;
