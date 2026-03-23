import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import MapplsUI from './pages/MapPage1';
import ArcGISWebEditor from './pages/ArcGISWebEditor';
import GeoLens from './pages/GeoLens';

function App() {
  console.log('GeoServer URL:', process.env.REACT_APP_GEOSERVER_URL);
  console.log('App Port:', process.env.REACT_APP_PORT);
  const isProduction = process.env.REACT_APP_PORT === '4200';
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        {/* <Route
          path="/map"
          element={
            isProduction
              ? <GeoLens />
              : <MapPage />
          }
        /> */}
        {/* <Route path="/map" element={<ArcGISWebEditor />} /> */}
        <Route path="/map" element={<GeoLens />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
