import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';

const GEOSERVER_URL = process.env.REACT_APP_GEOSERVER_URL //'https://163.245.209.231/geoserver';

function MI({ name, filled = false, className = '' }) {
  return (
    <span
      className={`material-symbols-outlined${className ? ' ' + className : ''}`}
      style={filled ? { fontVariationSettings: "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" } : undefined}
    >
      {name}
    </span>
  );
}

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
      setError('Could not reach GeoServer — make sure it is running');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">

        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand-icon">
            <MI name="travel_explore" filled />
          </div>
          <span className="login-brand-name">GeoLens</span>
          <span className="login-brand-sub">Precision Map Editor</span>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="form-input-wrap">
              <MI name="person" className="form-input-icon" />
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="GeoServer username"
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="form-input-wrap">
              <MI name="lock" className="form-input-icon" />
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="GeoServer password"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              <MI name="error" />
              {error}
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <>
                <MI name="progress_activity" />
                Verifying…
              </>
            ) : (
              <>
                <MI name="login" />
                Sign In
              </>
            )}
          </button>
        </form>

        <p className="login-footer">
          Connects to GeoServer via Basic Auth · Credentials stored locally
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
