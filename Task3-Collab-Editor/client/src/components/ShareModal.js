import { useState } from 'react';
import axios from 'axios';
import './ShareModal.css';

export default function ShareModal({ docId, docData, onClose }) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('edit');
  const [shareLink, setShareLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const generateLink = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(`/api/documents/${docId}/share`, { isPublic: true });
      const link = `${window.location.origin}/document/${docId}?token=${data.shareToken}`;
      setShareLink(link);
      setMessage('Share link generated!');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to generate link');
    } finally {
      setLoading(false);
    }
  };

  const inviteUser = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      await axios.post(`/api/documents/${docId}/collaborators`, { email: email.trim(), permission });
      setMessage(`✓ ${email} added as collaborator`);
      setEmail('');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to invite user');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setMessage('Link copied to clipboard!');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share document</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-section">
          <label className="modal-label">Invite by email</label>
          <div className="invite-row">
            <input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && inviteUser()}
            />
            <select value={permission} onChange={(e) => setPermission(e.target.value)}>
              <option value="edit">Can edit</option>
              <option value="view">Can view</option>
            </select>
            <button className="invite-btn" onClick={inviteUser} disabled={loading || !email}>
              {loading ? '...' : 'Invite'}
            </button>
          </div>
        </div>

        <div className="modal-section">
          <label className="modal-label">Share link</label>
          {shareLink ? (
            <div className="link-row">
              <input type="text" readOnly value={shareLink} />
              <button className="copy-btn" onClick={copyLink}>Copy</button>
            </div>
          ) : (
            <button className="gen-link-btn" onClick={generateLink} disabled={loading}>
              {loading ? 'Generating...' : 'Generate share link'}
            </button>
          )}
        </div>

        {docData?.collaborators?.length > 0 && (
          <div className="modal-section">
            <label className="modal-label">Current collaborators</label>
            {docData.collaborators.map((c) => (
              <div key={c.user._id} className="collab-row-item">
                <div
                  className="collab-av-sm"
                  style={{ background: c.user.color || '#888' }}
                >
                  {c.user.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="collab-name">{c.user.name}</div>
                  <div className="collab-email">{c.user.email}</div>
                </div>
                <span className="collab-perm">{c.permission}</span>
              </div>
            ))}
          </div>
        )}

        {message && <div className="modal-message">{message}</div>}
      </div>
    </div>
  );
}
