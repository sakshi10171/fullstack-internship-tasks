import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

export default function Dashboard() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fetchDocs = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/documents');
      setDocs(data);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/auth');
      }
    } finally {
      setLoading(false);
    }
  }, [logout, navigate]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const createDoc = async () => {
    if (creating) return;
    setCreating(true);
    try {
      // Make sure the Authorization header is set from current user
      const stored = localStorage.getItem('user');
      if (!stored) {
        logout();
        navigate('/auth');
        return;
      }
      const parsed = JSON.parse(stored);
      axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.token}`;

      const { data } = await axios.post('/api/documents', {
        title: 'Untitled Document',
      });
      console.log('Created doc:', data._id, 'owner:', data.owner);
      // Navigate to the new document
      navigate(`/document/${data._id}`);
    } catch (err) {
      console.error('Create doc error:', err);
      if (err.response?.status === 401) {
        logout();
        navigate('/auth');
      }
      setCreating(false);
    }
  };

  const deleteDoc = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this document?')) return;
    try {
      await axios.delete(`/api/documents/${id}`);
      setDocs((prev) => prev.filter((d) => d._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const formatDate = (d) => {
    const date = new Date(d);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const initials = (name) =>
    name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  const filtered = docs.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#378ADD"/>
            <path d="M8 10h16M8 16h12M8 22h10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span>CollabDocs</span>
        </div>
        <div className="dash-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="dash-user">
          <div className="user-avatar" style={{ background: user?.color || '#378ADD' }}>
            {initials(user?.name)}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-top">
          <h1>My Documents</h1>
          <button className="new-doc-btn" onClick={createDoc} disabled={creating}>
            {creating ? 'Creating...' : '+ New document'}
          </button>
        </div>

        {loading ? (
          <div className="dash-loading">Loading your documents...</div>
        ) : filtered.length === 0 ? (
          <div className="dash-empty">
            <div className="empty-icon">📄</div>
            <h3>{searchQuery ? 'No documents match your search' : 'No documents yet'}</h3>
            <p>{!searchQuery && 'Create your first document to get started'}</p>
            {!searchQuery && (
              <button className="new-doc-btn" onClick={createDoc} disabled={creating}>
                {creating ? 'Creating...' : 'Create document'}
              </button>
            )}
          </div>
        ) : (
          <div className="doc-grid">
            {filtered.map((doc) => (
              <div
                key={doc._id}
                className="doc-card"
                onClick={() => navigate(`/document/${doc._id}`)}
              >
                <div className="doc-card-icon">📝</div>
                <div className="doc-card-body">
                  <h3 className="doc-card-title">{doc.title}</h3>
                  <p className="doc-card-meta">
                    Edited {formatDate(doc.updatedAt)}
                    {doc.owner._id === user?._id ? ' · Owner' : ` · ${doc.owner.name}`}
                  </p>
                  {doc.collaborators?.length > 0 && (
                    <div className="collab-row">
                      {[doc.owner, ...doc.collaborators.map((c) => c.user)]
                        .slice(0, 4)
                        .map((u, i) => (
                          <div
                            key={i}
                            className="collab-avatar"
                            style={{ background: u?.color || '#888', marginLeft: i ? -6 : 0 }}
                            title={u?.name}
                          >
                            {initials(u?.name)}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                {doc.owner._id === user?._id && (
                  <button
                    className="doc-delete-btn"
                    onClick={(e) => deleteDoc(doc._id, e)}
                    title="Delete"
                  >
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}