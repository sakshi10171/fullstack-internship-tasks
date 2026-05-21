// Import required React hooks and libraries
import { useState, useEffect, useRef, useCallback } from 'react';

// Import routing utilities
import { useParams, useNavigate } from 'react-router-dom';

// Import axios for API requests
import axios from 'axios';

// Import socket.io client for real-time collaboration
import { io } from 'socket.io-client';

// Import authentication context
import { useAuth } from '../context/AuthContext';

// Import custom components
import Toolbar from '../components/Toolbar';
import ShareModal from '../components/ShareModal';

// Import editor styles
import './Editor.css';

// Backend socket server URL
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

// Auto-save debounce delay
const SAVE_DEBOUNCE_MS = 1500;

// Generate initials from user name
const initials = (name) =>
  name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

// Main editor page component
export default function EditorPage() {

  // Get document ID from URL
  const { id } = useParams();

  // Navigation hook
  const navigate = useNavigate();

  // Get logged-in user and logout function
  const { user, logout } = useAuth();

  // Document title state
  const [title, setTitle] = useState('');

  // Save status state
  const [saveStatus, setSaveStatus] = useState('saved');

  // Active collaborators
  const [activeUsers, setActiveUsers] = useState([]);

  // Activity log state
  const [activity, setActivity] = useState([]);

  // Document statistics
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [readTime, setReadTime] = useState(0);

  // Modal and UI states
  const [showShare, setShowShare] = useState(false);
  const [docData, setDocData] = useState(null);
  const [accessError, setAccessError] = useState('');
  const [showFindReplace, setShowFindReplace] = useState(false);

  // Find and replace states
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  // Outline and heading states
  const [showOutline, setShowOutline] = useState(false);
  const [headings, setHeadings] = useState([]);

  // Editor appearance settings
  const [zoom, setZoom] = useState(100);
  const [pageWidth, setPageWidth] = useState('680px');
  const [darkMode, setDarkMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Version history states
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);

  // Save As modal states
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');

  // References
  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const saveTimerRef = useRef(null);

  // Track remote changes to avoid loops
  const isRemoteChange = useRef(false);

  // Add activity to activity panel
  const addActivity = useCallback((msg, color) => {

    setActivity((prev) => [

      {
        msg,
        color,
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      },

      ...prev.slice(0, 29),

    ]);

  }, []);

  // Socket connection setup
  useEffect(() => {

    // Get stored user data
    const stored = localStorage.getItem('user');

    // Redirect if user not found
    if (!stored) {

      navigate('/auth');
      return;
    }

    let parsed;

    try {

      parsed = JSON.parse(stored);

    } catch {

      localStorage.removeItem('user');
      navigate('/auth');
      return;
    }

    const token = parsed?.token;

    // Redirect if token missing
    if (!token) {

      navigate('/auth');
      return;
    }

    // Create socket connection
    const socket = io(SOCKET_URL, {

      transports: ['websocket', 'polling'],

      auth: { token }

    });

    socketRef.current = socket;

    // Join collaborative document room
    socket.on('connect', () => {

      socket.emit('join-document', {
        documentId: id,
        token
      });

    });

    // Load document content
    socket.on('load-document', ({ content, title: t }) => {

      if (editorRef.current)
        editorRef.current.innerHTML = content || '';

      setTitle(t || 'Untitled Document');

      updateStats();
      extractHeadings();
    });

    // Receive live edits from collaborators
    socket.on('receive-changes', ({ content, from }) => {

      if (!editorRef.current) return;

      isRemoteChange.current = true;

      editorRef.current.innerHTML = content;

      isRemoteChange.current = false;

      updateStats();
      extractHeadings();

      if (from)
        addActivity(`${from.name} made an edit`, from.color);
    });

    // Update document title in real-time
    socket.on('title-updated', ({ title: t, from }) => {

      setTitle(t);

      if (from)
        addActivity(`${from.name} renamed the document`, from.color);
    });

    // Update active collaborators
    socket.on('active-users', (users) =>
      setActiveUsers(users)
    );

    // User joined event
    socket.on('user-joined', ({ user: u, message }) =>
      addActivity(message, u?.color || '#378ADD')
    );

    // User left event
    socket.on('user-left', ({ user: u, message }) =>
      addActivity(message, u?.color || '#888')
    );

    // Document saved event
    socket.on('document-saved', () =>
      setSaveStatus('saved')
    );

    // Handle authentication errors
    socket.on('auth-error', () => {

      logout();
      navigate('/auth');
    });

    // Handle general errors
    socket.on('error', ({ message }) => {

      if (message === 'Access denied') {

        setAccessError(
          'You do not have access to this document.'
        );

      } else {

        setAccessError(message);
      }
    });

    // Cleanup socket connection
    return () => socket.disconnect();

  }, [id, navigate, addActivity, logout]);

  // Fetch document metadata
  useEffect(() => {

    axios.get(`/api/documents/${id}`)

      .then(({ data }) => setDocData(data))

      .catch((err) => {

        // Unauthorized access
        if (err.response?.status === 401) {

          logout();
          navigate('/auth');

        } else if (err.response?.status === 403) {

          setAccessError(
            'You do not have access to this document.'
          );

        } else if (err.response?.status === 404) {

          setAccessError('Document not found.');
        }
      });

  }, [id, navigate, logout]);

  // Apply dark mode background
  useEffect(() => {

    document.body.style.background =
      darkMode ? '#1a1a2e' : '';

    return () => {

      document.body.style.background = '';
    };

  }, [darkMode]);

  // Update document statistics
  const updateStats = () => {

    if (!editorRef.current) return;

    const text = editorRef.current.innerText || '';

    const words = text.trim()
      ? text.trim().split(/\s+/).length
      : 0;

    setWordCount(words);
    setCharCount(text.length);

    // Estimate reading time
    setReadTime(
      Math.max(1, Math.ceil(words / 200))
    );
  };

  // Extract document headings for outline
  const extractHeadings = () => {

    if (!editorRef.current) return;

    const els =
      editorRef.current.querySelectorAll('h1,h2,h3,h4');

    const h = Array.from(els).map((el, i) => ({

      id: `heading-${i}`,

      text: el.innerText,

      level: parseInt(el.tagName[1]),

    }));

    setHeadings(h);
  };

  // Handle editor content changes
  const handleEditorInput = () => {

    // Ignore remote updates
    if (isRemoteChange.current) return;

    const content =
      editorRef.current?.innerHTML || '';

    updateStats();
    extractHeadings();

    setSaveStatus('unsaved');

    // Send live updates to collaborators
    socketRef.current?.emit('send-changes', {
      documentId: id,
      content
    });

    // Debounced auto-save
    clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {

      setSaveStatus('saving');

      // Save version snapshot
      setVersions(prev => [

        {
          content,
          title,
          time: new Date().toLocaleTimeString()
        },

        ...prev.slice(0, 9)

      ]);

      // Save document to backend
      socketRef.current?.emit('save-document', {
        documentId: id,
        content,
        title
      });

    }, SAVE_DEBOUNCE_MS);
  };

  // Handle title updates
  const handleTitleChange = (e) => {

    const newTitle = e.target.value;

    setTitle(newTitle);

    setSaveStatus('unsaved');

    // Broadcast title change
    socketRef.current?.emit('title-change', {
      documentId: id,
      title: newTitle
    });

    clearTimeout(saveTimerRef.current);

    // Debounced save
    saveTimerRef.current = setTimeout(() => {

      setSaveStatus('saving');

      const content =
        editorRef.current?.innerHTML || '';

      socketRef.current?.emit('save-document', {
        documentId: id,
        content,
        title: newTitle
      });

    }, SAVE_DEBOUNCE_MS);
  };

 
