import { useState } from 'react';
import '../styles/SearchBar.css';

function SearchBar({ onSearch }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      setError('Please enter a location');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Using Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const results = await response.json();

      if (results.length === 0) {
        setError('Location not found');
        setIsLoading(false);
        return;
      }

      const { lat, lon, display_name } = results[0];

      // Call the parent callback with the location
      onSearch({
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        name: display_name,
      });

      setSearchQuery('');
    } catch (err) {
      setError('Error searching location. Try again.');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="search-bar">
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search location..."
          className="search-input"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="search-btn"
          disabled={isLoading}
          title="Search"
        >
          {isLoading ? '...' : '🔍'}
        </button>
      </form>
      {error && <div className="search-error">{error}</div>}
    </div>
  );
}

export default SearchBar;
