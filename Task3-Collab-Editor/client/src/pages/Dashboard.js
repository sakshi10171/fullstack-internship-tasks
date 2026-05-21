// Import required React hooks and libraries
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Import authentication context
import { useAuth } from '../context/AuthContext';

// Import dashboard styles
import './Dashboard.css';

// Dashboard component
export default function Dashboard() {

  // Store all documents
  const [docs, setDocs] = useState([]);

  // Loading state for fetching documents
  const [loading, setLoading] = useState(true);

  // Loading state while creating new document
  const [creating, setCreating] = useState(false);

  // Store search input value
  const [searchQuery, setSearchQuery] = useState('');

  // Get authenticated user and logout function
  const { user, logout } = useAuth();

  // Navigation hook
  const navigate = useNavigate();

  // Fetch all documents from backend
  const fetchDocs = useCallback(async () => {

    try {

      // Request documents from API
      const { data } = await axios.get('/api/documents');

      // Store documents in state
      setDocs(data);

    } catch (err) {

      // Logout user if token is invalid
      if (err.response?.status === 401) {

        logout();
        navigate('/auth');
      }

    } finally {

      // Stop loading after request completes
      setLoading(false);
    }

  }, [logout, navigate]);

  // Fetch documents when component loads
  useEffect(() => {

    fetchDocs();

  }, [fetchDocs]);

  // Create a new document
  const createDoc = async () => {

    // Prevent multiple clicks
    if (creating) return;

    setCreating(true);

    try {

      // Get stored user data
      const stored = localStorage.getItem('user');

      // Redirect if user not found
      if (!stored) {

        logout();
        navigate('/auth');
        return;
      }

      // Parse stored user data
      const parsed = JSON.parse(stored);

      // Set authorization token
      axios.defaults.headers.common['Authorization'] =
        `Bearer ${parsed.token}`;

      // Create new document
      const { data } = await axios.post('/api/documents', {
        title: 'Untitled Document',
      });

      console.log(
        'Created doc:',
        data._id,
        'owner:',
        data.owner
      );

      // Navigate to newly created document
      navigate(`/document/${data._id}`);

    } catch (err) {

      console.error('Create doc error:', err);

      // Handle unauthorized user
      if (err.response?.status === 401) {

        logout();
        navigate('/auth');
      }

      setCreating(false);
    }
  };

  // Delete selected document
  const deleteDoc = async (id, e) => {

    // Prevent card click event
    e.stopPropagation();

    // Confirm delete action
    if (!window.confirm('Delete this document?')) return;

    try {

      // Send delete request
      await axios.delete(`/api/documents/${id}`);

      // Remove deleted document from UI
      setDocs((prev) =>
        prev.filter((d) => d._id !== id)
      );

    } catch (err) {

      // Show delete error message
      alert(
        err.response?.data?.message ||
        'Failed to delete'
      );
    }
  };

  // Format document update date
  const formatDate = (d) => {

    const date = new Date(d);
    const now = new Date();

    // Calculate time difference in seconds
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';

    if (diff < 3600)
      return `${Math.floor(diff / 60)}m ago`;

    if (diff < 86400)
      return `${Math.floor(diff / 3600)}h ago`;

    return date.toLocaleDateString();
  };

  // Generate user initials from name
  const initials = (name) =>

    name
      ? name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '?';

  // Filter documents using search query
  const filtered = docs.filter((d) =>
    d.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (

    <div className="dashboard">

      {/* Dashboard header */}
      <header className="dash-header">

        {/* Logo section */}
        <div className="dash-logo">

          <svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
          >

            <rect
              width="32"
              height="32"
              rx="8"
              fill="#378ADD"
            />

            <path
              d="M8 10h16M8 16h12M8 22h10"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

          </svg>

          <span>CollabDocs</span>

        </div>

        {/* Search bar */}
        <div className="dash-search">

          <span className="search-icon">🔍</span>

          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(e.target.value)
            }
          />

        </div>

        {/* User information section */}
        <div className="dash-user">

          {/* User avatar */}
          <div
            className="user-avatar"
            style={{
              background:
                user?.color || '#378ADD'
            }}
          >

            {initials(user?.name)}

          </div>

          {/* User details */}
          <div className="user-info">

            <span className="user-name">
              {user?.name}
            </span>

            <span className="user-email">
              {user?.email}
            </span>

          </div>

          {/* Logout button */}
          <button
            className="logout-btn"
            onClick={logout}
          >

            Sign out

          </button>

        </div>

      </header>

      {/* Main dashboard content */}
      <main className="dash-main">

        {/* Top action bar */}
        <div className="dash-top">

          <h1>My Documents</h1>

          {/* Create document button */}
          <button
            className="new-doc-btn"
            onClick={createDoc}
            disabled={creating}
          >

            {creating
              ? 'Creating...'
              : '+ New document'}

          </button>

        </div>

        {/* Loading state */}
        {loading ? (

          <div className="dash-loading">
            Loading your documents...
          </div>

        ) : filtered.length === 0 ? (

          // Empty document state
          <div className="dash-empty">

            <div className="empty-icon">📄</div>

            <h3>

              {searchQuery
                ? 'No documents match your search'
                : 'No documents yet'}

            </h3>

            <p>

              {!searchQuery &&
                'Create your first document to get started'}

            </p>

            {/* Create document button for empty state */}
            {!searchQuery && (

              <button
                className="new-doc-btn"
                onClick={createDoc}
                disabled={creating}
              >

                {creating
                  ? 'Creating...'
                  : 'Create document'}

              </button>
            )}

          </div>

        ) : (

          // Document cards grid
          <div className="doc-grid">

            {filtered.map((doc) => (

              <div
                key={doc._id}
                className="doc-card"
                onClick={() =>
                  navigate(`/document/${doc._id}`)
                }
              >

                {/* Document icon */}
                <div className="doc-card-icon">
                  📝
                </div>

                {/* Document details */}
                <div className="doc-card-body">

                  <h3 className="doc-card-title">
                    {doc.title}
                  </h3>

                  {/* Document metadata */}
                  <p className="doc-card-meta">

                    Edited {formatDate(doc.updatedAt)}

                    {doc.owner._id === user?._id
                      ? ' · Owner'
                      : ` · ${doc.owner.name}`}

                  </p>

                  {/* Collaborators section */}
                  {doc.collaborators?.length > 0 && (

                    <div className="collab-row">

                      {[doc.owner,
                        ...doc.collaborators.map(
                          (c) => c.user
                        )]
                        .slice(0, 4)
                        .map((u, i) => (

                          <div
                            key={i}
                            className="collab-avatar"
                            style={{
                              background:
                                u?.color || '#888',
                              marginLeft:
                                i ? -6 : 0
                            }}
                            title={u?.name}
                          >

                            {initials(u?.name)}

                          </div>
                        ))}

                    </div>
                  )}

                </div>

                {/* Delete button only for owner */}
                {doc.owner._id === user?._id && (

                  <button
                    className="doc-delete-btn"
                    onClick={(e) =>
                      deleteDoc(doc._id, e)
                    }
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
