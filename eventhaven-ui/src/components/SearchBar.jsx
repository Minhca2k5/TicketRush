import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import './SearchBar.css';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/?search=${encodeURIComponent(query.trim())}`);
      setIsExpanded(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    navigate('/');
  };

  return (
    <div className={`search-bar ${isExpanded ? 'expanded' : ''}`}>
      <form onSubmit={handleSubmit} className="search-form">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          placeholder="Search events..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          onBlur={() => {
            // Delay to allow click on clear button
            setTimeout(() => setIsExpanded(false), 200);
          }}
          className="search-input"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="clear-btn"
            tabIndex={-1}
          >
            <X size={16} />
          </button>
        )}
      </form>
    </div>
  );
}
