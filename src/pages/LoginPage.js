import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';

const GEOSERVER_URL = 'https://163.245.209.231:8080/geoserver';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter your GeoServer username and password');
      return;
    }

    setLoading(true);
    const authToken = btoa(`${username}:${password}`);

    try {
      // Validate credentials against GeoServer REST API.
      // 200  → valid (admin role)
      // 403  → valid credentials, insufficient role for REST — still accepted
      // 401  → wrong username / password
      const res = await fetch(`${GEOSERVER_URL}/rest/about/version.json`, {
        headers: { Authorization: `Basic ${authToken}` },
      });

      if (res.status === 401) {
        setError('Invalid GeoServer username or password');
        return;
      }

      // Accept 200 (admin) or 403 (authenticated non-admin)
      localStorage.setItem('gsAuth', authToken);
      localStorage.setItem('gsUser', username);
      navigate('/map');
    } catch {
      setError('Could not reach GeoServer — make sure it is running on localhost:8080');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>GeoServer Login</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter GeoServer username"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter GeoServer password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Verifying…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
