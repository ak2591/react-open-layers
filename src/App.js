import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import MapplsUI from './pages/MapPage1';

function App() {
  console.log('GeoServer URL:', process.env.REACT_APP_GEOSERVER_URL);
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/map"
          element={
            process.env.REACT_APP_GEOSERVER_URL === 'https://163.245.209.231/geoserver'
              ? <MapPage />
              : <MapplsUI />
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
