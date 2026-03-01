import LayerControl from './LayerControl';
import '../styles/Sidebar.css';

function Sidebar({ isOpen, availableLayers, onLayerToggle, editLayerId, onWfsEdit, layersLoading }) {
  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <nav className="sidebar-nav">
        <ul>
          <li><a href="#dashboard">Dashboard</a></li>
          <li><a href="#maps">Maps</a></li>
          <li><a href="#settings">Settings</a></li>
          <li><a href="#about">About</a></li>
        </ul>
      </nav>
      {availableLayers && (
        <LayerControl
          availableLayers={availableLayers}
          onLayerToggle={onLayerToggle}
          editLayerId={editLayerId}
          onWfsEdit={onWfsEdit}
          layersLoading={layersLoading}
        />
      )}
    </div>
  );
}

export default Sidebar;
