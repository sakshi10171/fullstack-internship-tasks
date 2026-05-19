import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import Toolbar from '../components/Toolbar';
import ShareModal from '../components/ShareModal';
import './Editor.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
const SAVE_DEBOUNCE_MS = 1500;

const initials = (name) =>
  name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [title, setTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [activeUsers, setActiveUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [readTime, setReadTime] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [docData, setDocData] = useState(null);
  const [accessError, setAccessError] = useState('');
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showOutline, setShowOutline] = useState(false);
  const [headings, setHeadings] = useState([]);
  const [zoom, setZoom] = useState(100);
  const [pageWidth, setPageWidth] = useState('680px');
  const [darkMode, setDarkMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');

  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const saveTimerRef = useRef(null);
  const isRemoteChange = useRef(false);

  const addActivity = useCallback((msg, color) => {
    setActivity((prev) => [
      { msg, color, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ...prev.slice(0, 29),
    ]);
  }, []);

  // Socket setup
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { navigate('/auth'); return; }
    let parsed;
    try { parsed = JSON.parse(stored); } catch { localStorage.removeItem('user'); navigate('/auth'); return; }
    const token = parsed?.token;
    if (!token) { navigate('/auth'); return; }

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-document', { documentId: id, token });
    });

    socket.on('load-document', ({ content, title: t }) => {
      if (editorRef.current) editorRef.current.innerHTML = content || '';
      setTitle(t || 'Untitled Document');
      updateStats();
      extractHeadings();
    });

    socket.on('receive-changes', ({ content, from }) => {
      if (!editorRef.current) return;
      isRemoteChange.current = true;
      editorRef.current.innerHTML = content;
      isRemoteChange.current = false;
      updateStats();
      extractHeadings();
      if (from) addActivity(`${from.name} made an edit`, from.color);
    });

    socket.on('title-updated', ({ title: t, from }) => {
      setTitle(t);
      if (from) addActivity(`${from.name} renamed the document`, from.color);
    });

    socket.on('active-users', (users) => setActiveUsers(users));
    socket.on('user-joined', ({ user: u, message }) => addActivity(message, u?.color || '#378ADD'));
    socket.on('user-left', ({ user: u, message }) => addActivity(message, u?.color || '#888'));
    socket.on('document-saved', () => setSaveStatus('saved'));
    socket.on('auth-error', () => { logout(); navigate('/auth'); });
    socket.on('error', ({ message }) => {
      if (message === 'Access denied') setAccessError('You do not have access to this document.');
      else setAccessError(message);
    });

    return () => socket.disconnect();
  }, [id, navigate, addActivity, logout]);

  // Fetch doc metadata
  useEffect(() => {
    axios.get(`/api/documents/${id}`)
      .then(({ data }) => setDocData(data))
      .catch((err) => {
        if (err.response?.status === 401) { logout(); navigate('/auth'); }
        else if (err.response?.status === 403) setAccessError('You do not have access to this document.');
        else if (err.response?.status === 404) setAccessError('Document not found.');
      });
  }, [id, navigate, logout]);

  // Dark mode on body
  useEffect(() => {
    document.body.style.background = darkMode ? '#1a1a2e' : '';
    return () => { document.body.style.background = ''; };
  }, [darkMode]);

  const updateStats = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
    setCharCount(text.length);
    setReadTime(Math.max(1, Math.ceil(words / 200)));
  };

  const extractHeadings = () => {
    if (!editorRef.current) return;
    const els = editorRef.current.querySelectorAll('h1,h2,h3,h4');
    const h = Array.from(els).map((el, i) => ({
      id: `heading-${i}`,
      text: el.innerText,
      level: parseInt(el.tagName[1]),
    }));
    setHeadings(h);
  };

  const handleEditorInput = () => {
    if (isRemoteChange.current) return;
    const content = editorRef.current?.innerHTML || '';
    updateStats();
    extractHeadings();
    setSaveStatus('unsaved');
    socketRef.current?.emit('send-changes', { documentId: id, content });
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      // Save version snapshot
      setVersions(prev => [
        { content, title, time: new Date().toLocaleTimeString() },
        ...prev.slice(0, 9)
      ]);
      socketRef.current?.emit('save-document', { documentId: id, content, title });
    }, SAVE_DEBOUNCE_MS);
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    setSaveStatus('unsaved');
    socketRef.current?.emit('title-change', { documentId: id, title: newTitle });
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      const content = editorRef.current?.innerHTML || '';
      socketRef.current?.emit('save-document', { documentId: id, content, title: newTitle });
    }, SAVE_DEBOUNCE_MS);
  };

  // Find & Replace
  const handleFind = () => {
    if (!findText || !editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const highlighted = content.replace(
      new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      (match) => `<mark style="background:#FEF08A;border-radius:2px">${match}</mark>`
    );
    editorRef.current.innerHTML = highlighted;
  };

  const handleReplace = () => {
    if (!findText || !editorRef.current) return;
    const text = editorRef.current.innerHTML;
    editorRef.current.innerHTML = text.replace(
      new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
      replaceText
    );
    handleEditorInput();
  };

  // Export as HTML
  const exportHTML = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:sans-serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.7}
    h1,h2,h3{margin-top:24px}table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #ddd;padding:8px}pre{background:#1e1e1e;color:#d4d4d4;padding:16px;border-radius:8px}</style>
    </head><body><h1>${title}</h1>${editorRef.current?.innerHTML || ''}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title || 'document'}.html`;
    a.click();
  };

  // Export as plain text
  const exportTXT = () => {
    const text = `${title}\n${'='.repeat(title.length)}\n\n${editorRef.current?.innerText || ''}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title || 'document'}.txt`;
    a.click();
  };

  // Copy content
  const copyAsMarkdown = () => {
    const text = editorRef.current?.innerText || '';
    navigator.clipboard.writeText(text);
    alert('Content copied to clipboard!');
  };

  // Save As — rename document with custom name and save
  const openSaveAs = () => {
    setSaveAsName(title);
    setShowRenameModal(true);
  };

  const handleSaveAs = () => {
    if (!saveAsName.trim()) return;
    const newTitle = saveAsName.trim();
    setTitle(newTitle);
    setSaveStatus('saving');
    const content = editorRef.current?.innerHTML || '';
    // Broadcast title change to collaborators
    socketRef.current?.emit('title-change', { documentId: id, title: newTitle });
    // Persist to DB
    socketRef.current?.emit('save-document', { documentId: id, content, title: newTitle });
    setShowRenameModal(false);
    addActivity(`Document renamed to "${newTitle}"`, user?.color || '#378ADD');
  };

  // Export as HTML
  const exportWithName = (type) => {
    const name = saveAsName.trim() || title || 'document';

    if (type === 'html') {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name}</title>
      <style>body{font-family:sans-serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.7}
      h1,h2,h3{margin-top:24px}table{border-collapse:collapse;width:100%}
      td,th{border:1px solid #ddd;padding:8px}pre{background:#1e1e1e;color:#d4d4d4;padding:16px;border-radius:8px}</style>
      </head><body><h1>${name}</h1>${editorRef.current?.innerHTML || ''}</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.html`; a.click();

    } else if (type === 'txt') {
      const text = `${name}\n${'='.repeat(name.length)}\n\n${editorRef.current?.innerText || ''}`;
      const blob = new Blob([text], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.txt`; a.click();

    } else if (type === 'pdf') {
      // Use browser print-to-PDF with a styled print window
      const content = editorRef.current?.innerHTML || '';
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`<!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${name}</title>
            <style>
              @page { margin: 2cm; size: A4; }
              body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.8; color: #1a1a1a; max-width: 100%; }
              h1 { font-size: 24pt; border: none; margin-bottom: 16px; }
              h2 { font-size: 18pt; margin-top: 24px; }
              h3 { font-size: 14pt; margin-top: 20px; }
              table { border-collapse: collapse; width: 100%; margin: 12px 0; }
              td, th { border: 1px solid #d1d5db; padding: 8px 12px; }
              th { background: #f9fafb; font-weight: 600; }
              pre { background: #f4f4f4; padding: 12px; border-radius: 6px; font-size: 10pt; }
              a { color: #2563eb; }
              img { max-width: 100%; }
              hr { display: none; }
              .doc-title { font-size: 28pt; font-weight: 700; margin-bottom: 4px; }
              .doc-meta { font-size: 10pt; color: #6b7280; margin-bottom: 32px; }
            </style>
          </head>
          <body>
            <div class="doc-title">${name}</div>
            <div class="doc-meta">Exported from CollabDocs · ${new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })}</div>
            ${content}
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() { window.close(); };
              };
            </script>
          </body>
        </html>`);
      printWindow.document.close();

    } else if (type === 'docx') {
      // Generate a proper .docx-compatible RTF-based Word document
      const content = editorRef.current?.innerHTML || '';
      const plainText = editorRef.current?.innerText || '';

      // Build Word XML (DOCX via HTML Word-compatible format)
      const wordHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>${name}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>90</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            @page WordSection1 { size: 595.3pt 841.9pt; margin: 72pt 72pt 72pt 72pt; }
            div.WordSection1 { page: WordSection1; }
            body { font-family: Calibri, sans-serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; }
            h1 { font-size: 20pt; font-weight: bold; color: #1a1a1a; border-bottom: 1px solid #e5e7eb; padding-bottom: 4pt; }
            h2 { font-size: 16pt; font-weight: bold; color: #374151; }
            h3 { font-size: 13pt; font-weight: bold; color: #374151; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #d1d5db; padding: 6pt; font-size: 11pt; }
            th { background: #f3f4f6; font-weight: bold; }
            pre { font-family: Courier New; font-size: 10pt; background: #f4f4f4; padding: 8pt; }
            a { color: #2563eb; }
          </style>
        </head>
        <body>
          <div class="WordSection1">
            <h1>${name}</h1>
            <p style="color:#6b7280;font-size:10pt;border-bottom:1px solid #e5e7eb;padding-bottom:8pt;margin-bottom:16pt">
              Exported from CollabDocs &middot; ${new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })}
            </p>
            ${content}
          </div>
        </body>
        </html>`;

      const blob = new Blob(['\ufeff', wordHtml], {
        type: 'application/msword'
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.doc`;
      a.click();
    }

    setShowRenameModal(false);
  };

  const restoreVersion = (v) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = v.content;
      handleEditorInput();
      setShowVersions(false);
    }
  };

  const saveBadge = {
    saved: { icon: '✓', label: 'Saved', cls: 'saved' },
    saving: { icon: '⟳', label: 'Saving...', cls: 'saving' },
    unsaved: { icon: '●', label: 'Unsaved', cls: 'unsaved' },
  }[saveStatus];

  if (accessError) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f5f3', padding:24 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:40, maxWidth:420, textAlign:'center', border:'0.5px solid #e0dfd8' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
          <h2 style={{ fontSize:20, fontWeight:600, marginBottom:8 }}>Access Denied</h2>
          <p style={{ color:'#6b7280', fontSize:14, marginBottom:24, lineHeight:1.6 }}>{accessError}</p>
          <button onClick={() => navigate('/')} style={{ padding:'10px 24px', background:'#378ADD', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:500, cursor:'pointer', marginRight:10 }}>← Back to Dashboard</button>
          <button onClick={() => { logout(); navigate('/auth'); }} style={{ padding:'10px 24px', background:'transparent', color:'#6b7280', border:'0.5px solid #e0dfd8', borderRadius:8, fontSize:14, cursor:'pointer' }}>Switch Account</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`editor-page ${darkMode ? 'dark' : ''} ${focusMode ? 'focus-mode' : ''}`}>

      {/* Top Bar */}
      <header className="editor-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Docs</button>
        <div className="header-center">
          <input className="doc-title-input" value={title} onChange={handleTitleChange} placeholder="Untitled Document" spellCheck={false} />
          <span className={`save-badge ${saveBadge.cls}`}>{saveBadge.icon} {saveBadge.label}</span>
        </div>
        <div className="header-right">
          {/* Zoom */}
          <select className="zoom-select" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} title="Zoom">
            {[75,90,100,110,125,150].map(z => <option key={z} value={z}>{z}%</option>)}
          </select>
          {/* Page width */}
          <select className="zoom-select" value={pageWidth} onChange={(e) => setPageWidth(e.target.value)} title="Page width">
            <option value="580px">Narrow</option>
            <option value="680px">Normal</option>
            <option value="820px">Wide</option>
            <option value="100%">Full</option>
          </select>

          {/* Action buttons */}
          <button className="hdr-icon-btn" onClick={() => setShowFindReplace(!showFindReplace)} title="Find & Replace">🔍</button>
          <button className="hdr-icon-btn" onClick={() => setShowOutline(!showOutline)} title="Document Outline">📋</button>
          <button className="hdr-icon-btn" onClick={() => setDarkMode(!darkMode)} title="Dark Mode">{darkMode ? '☀️' : '🌙'}</button>
          <button className="hdr-icon-btn" onClick={() => setFocusMode(!focusMode)} title="Focus Mode">🎯</button>
          <button className="hdr-icon-btn" onClick={() => setShowVersions(!showVersions)} title="Version History">🕐</button>
          <button className="hdr-icon-btn" onClick={exportHTML} title="Export HTML">⬇️ HTML</button>
          <button className="hdr-icon-btn" onClick={exportTXT} title="Export TXT">⬇️ TXT</button>
          <button className="hdr-icon-btn save-as-btn" onClick={openSaveAs} title="Save As / Rename">💾 Save As</button>
          <button className="hdr-icon-btn" onClick={() => window.print()} title="Print">🖨️</button>

          <div className="collab-avatars">
            {activeUsers.map((u) => (
              <div key={u.socketId} className="collab-av" style={{ background: u.color || '#888' }}
                title={u.name + (u.userId === user?._id?.toString() ? ' (you)' : '')}>
                {initials(u.name)}
              </div>
            ))}
          </div>
          <button className="share-btn" onClick={() => setShowShare(true)}>Share</button>
        </div>
      </header>

      {/* Find & Replace Bar */}
      {showFindReplace && (
        <div className="find-bar">
          <span className="find-label">Find & Replace</span>
          <input className="find-input" placeholder="Find..." value={findText} onChange={(e) => setFindText(e.target.value)} />
          <input className="find-input" placeholder="Replace with..." value={replaceText} onChange={(e) => setReplaceText(e.target.value)} />
          <button className="find-btn" onClick={handleFind}>Find</button>
          <button className="find-btn" onClick={handleReplace}>Replace All</button>
          <button className="find-btn find-close" onClick={() => setShowFindReplace(false)}>✕</button>
        </div>
      )}

      <Toolbar onFormat={() => { updateStats(); extractHeadings(); }} />

      <div className="editor-body">
        {/* Outline sidebar */}
        {showOutline && (
          <aside className="outline-sidebar">
            <div className="sidebar-label">Document Outline</div>
            {headings.length === 0 ? (
              <p className="sidebar-empty">No headings yet.<br/>Use H1/H2/H3 to create an outline.</p>
            ) : (
              <ul className="outline-list">
                {headings.map((h, i) => (
                  <li key={i} className="outline-item" style={{ paddingLeft: (h.level - 1) * 12 }}>
                    <span className="outline-tag">H{h.level}</span> {h.text}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        {/* Activity sidebar */}
        <aside className="editor-sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">Online Now</div>
            {activeUsers.length === 0 ? <p className="sidebar-empty">Just you</p> : activeUsers.map((u) => (
              <div key={u.socketId} className="online-user">
                <div className="online-dot" style={{ background: u.color || '#1D9E75' }} />
                <div>
                  <div className="online-name">{u.name}{u.userId === user?._id?.toString() ? ' (you)' : ''}</div>
                  <div className="online-status">Active</div>
                </div>
              </div>
            ))}
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">Activity</div>
            {activity.length === 0 ? <p className="sidebar-empty">No activity yet</p> : (
              <ul className="activity-list">
                {activity.map((a, i) => (
                  <li key={i} className="activity-item">
                    <span className="act-dot" style={{ background: a.color }} />
                    <div><span className="act-msg">{a.msg}</span><span className="act-time">{a.time}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Quick actions */}
          <div className="sidebar-section">
            <div className="sidebar-label">Quick Export</div>
            <button className="sidebar-action-btn" onClick={exportHTML}>📄 Export as HTML</button>
            <button className="sidebar-action-btn" onClick={exportTXT}>📝 Export as TXT</button>
            <button className="sidebar-action-btn" onClick={copyAsMarkdown}>📋 Copy Content</button>
          </div>
        </aside>

        {/* Main editor */}
        <main className="editor-main">
          {/* Version history panel */}
          {showVersions && (
            <div className="versions-panel">
              <div className="versions-header">
                <span>Version History</span>
                <button onClick={() => setShowVersions(false)}>✕</button>
              </div>
              {versions.length === 0 ? (
                <p style={{ padding:16, color:'#9ca3af', fontSize:13 }}>No versions saved yet. Start editing!</p>
              ) : versions.map((v, i) => (
                <div key={i} className="version-item">
                  <div className="version-time">Version {versions.length - i} — {v.time}</div>
                  <button className="version-restore" onClick={() => restoreVersion(v)}>Restore</button>
                </div>
              ))}
            </div>
          )}

          <div className="page-sheet" style={{ maxWidth: pageWidth, fontSize: `${zoom}%` }}>
            <div
              ref={editorRef}
              id="editor"
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              data-placeholder="Start writing here... Use the toolbar above to format your document."
              spellCheck
            />
          </div>
        </main>
      </div>

      {/* Status bar */}
      <footer className="editor-statusbar">
        <span>📝 {wordCount} words</span>
        <span>🔤 {charCount} characters</span>
        <span>⏱ ~{readTime} min read</span>
        <span>👥 {activeUsers.length} online</span>
        <span style={{ marginLeft:'auto', color: saveStatus === 'saved' ? '#1D9E75' : '#EF9F27' }}>
          {saveBadge.icon} {saveBadge.label}
        </span>
      </footer>

      {showShare && <ShareModal docId={id} docData={docData} onClose={() => setShowShare(false)} />}

      {/* Save As Modal */}
      {showRenameModal && (
        <div className="modal-overlay" onClick={() => setShowRenameModal(false)}>
          <div className="saveas-modal" onClick={(e) => e.stopPropagation()}>
            <div className="saveas-header">
              <h2>💾 Save As</h2>
              <button className="saveas-close" onClick={() => setShowRenameModal(false)}>✕</button>
            </div>
            <p className="saveas-subtitle">Enter a name for your document</p>
            <input
              className="saveas-input"
              type="text"
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              placeholder="Document name..."
              onKeyDown={(e) => e.key === 'Enter' && handleSaveAs()}
              autoFocus
            />
            <div className="saveas-actions">
              <div className="saveas-exports">
                <span className="saveas-label">Export as:</span>
                <div className="saveas-export-grid">
                  <button className="saveas-export-btn html-btn" onClick={() => exportWithName('html')}>
                    <span className="export-icon">🌐</span> HTML
                  </button>
                  <button className="saveas-export-btn txt-btn" onClick={() => exportWithName('txt')}>
                    <span className="export-icon">📄</span> TXT
                  </button>
                  <button className="saveas-export-btn pdf-btn" onClick={() => exportWithName('pdf')}>
                    <span className="export-icon">📕</span> PDF
                  </button>
                  <button className="saveas-export-btn docx-btn" onClick={() => exportWithName('docx')}>
                    <span className="export-icon">📘</span> Word
                  </button>
                </div>
              </div>
              <div className="saveas-right">
                <button className="saveas-cancel" onClick={() => setShowRenameModal(false)}>Cancel</button>
                <button className="saveas-save" onClick={handleSaveAs} disabled={!saveAsName.trim()}>
                  💾 Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}