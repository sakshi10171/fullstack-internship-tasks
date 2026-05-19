import { useState, useRef } from 'react';
import './Toolbar.css';

const COLORS = ['#1a1a1a', '#ffffff', '#E24B4A', '#E67E22', '#F1C40F', '#2ECC71', '#3498DB', '#9B59B6', '#1ABC9C', '#E91E63', '#FF5722', '#607D8B'];
const BG_COLORS = ['transparent', '#FFF3CD', '#D1ECF1', '#D4EDDA', '#F8D7DA', '#E2D9F3', '#FCE4EC', '#E3F2FD', '#FFF8E1', '#F3E5F5', '#E8F5E9', '#FFEBEE'];
const FONT_FAMILIES = ['Default', 'Arial', 'Georgia', 'Courier New', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Impact', 'Comic Sans MS'];

export default function Toolbar({ onFormat }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgPicker, setShowBgPicker]       = useState(false);
  const [showTableMenu, setShowTableMenu]     = useState(false);
  const [activeColor, setActiveColor]         = useState('#1a1a1a');
  const [activeBg, setActiveBg]               = useState('transparent');
  const imageInputRef = useRef(null);

  // Save selection so we can restore it before applying color
  const savedSelection = useRef(null);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (savedSelection.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  };

  const exec = (cmd, val) => {
    document.execCommand(cmd, false, val || null);
    onFormat && onFormat();
  };

  const applyColor = (color) => {
    restoreSelection();           // ← restore what user had selected
    document.execCommand('foreColor', false, color);
    setActiveColor(color);
    setShowColorPicker(false);
    onFormat && onFormat();
  };

  const applyBgColor = (color) => {
    restoreSelection();
    document.execCommand('hiliteColor', false, color === 'transparent' ? 'rgba(0,0,0,0)' : color);
    setActiveBg(color);
    setShowBgPicker(false);
    onFormat && onFormat();
  };

  const closeAll = () => {
    setShowColorPicker(false);
    setShowBgPicker(false);
    setShowTableMenu(false);
  };

  const insertTable = (rows, cols) => {
    let html = '<table style="border-collapse:collapse;width:100%;margin:12px 0"><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += '<td style="border:1px solid #d1d5db;padding:8px 12px;min-width:80px">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    exec('insertHTML', html);
    setShowTableMenu(false);
  };

  const insertDivider = () => {
    exec('insertHTML', '<hr style="border:none;border-top:2px solid #e5e7eb;margin:16px 0"><p><br></p>');
  };

  const insertCodeBlock = () => {
    exec('insertHTML', '<pre style="background:#1e1e1e;color:#d4d4d4;padding:16px;border-radius:8px;font-family:Courier New;font-size:13px;overflow-x:auto;margin:12px 0"><code>// Your code here</code></pre><p><br></p>');
  };

  const insertCallout = (type) => {
    const styles = {
      info:    { bg: '#EFF6FF', border: '#3B82F6', icon: 'ℹ️' },
      warning: { bg: '#FFFBEB', border: '#F59E0B', icon: '⚠️' },
      success: { bg: '#F0FDF4', border: '#22C55E', icon: '✅' },
      danger:  { bg: '#FFF1F2', border: '#EF4444', icon: '🚨' },
    };
    const s = styles[type];
    exec('insertHTML', `<div style="background:${s.bg};border-left:4px solid ${s.border};padding:12px 16px;border-radius:0 8px 8px 0;margin:12px 0">${s.icon} <strong>Note:</strong> Add your text here</div><p><br></p>`);
  };

  const insertChecklist = () => {
    exec('insertHTML', `
      <div style="margin:8px 0">
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0"><input type="checkbox" style="width:16px;height:16px"> <span>Task 1</span></div>
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0"><input type="checkbox" style="width:16px;height:16px"> <span>Task 2</span></div>
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0"><input type="checkbox" style="width:16px;height:16px"> <span>Task 3</span></div>
      </div><p><br></p>
    `);
  };

  // Image from file picker — converts to base64 and embeds inline
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      exec('insertHTML', `<img src="${ev.target.result}" style="max-width:100%;border-radius:8px;margin:8px 0;display:block" alt="${file.name}"/><p><br></p>`);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be picked again
    e.target.value = '';
  };

  return (
    <div className="toolbar" onMouseDown={(e) => {
      // Don't steal focus from editor UNLESS clicking a color swatch
      const tag = e.target.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT') e.preventDefault();
    }}>

      {/* Hidden file input for images */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />

      {/* Font family */}
      <select className="tb-select tb-select-wide"
        onChange={(e) => { if (e.target.value !== 'Default') exec('fontName', e.target.value); }}
        defaultValue="Default" title="Font family">
        {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      {/* Font size */}
      <select className="tb-select"
        onChange={(e) => exec('fontSize', e.target.value)}
        defaultValue="3" title="Font size">
        <option value="1">Small</option>
        <option value="3">Normal</option>
        <option value="4">Medium</option>
        <option value="5">Large</option>
        <option value="6">X-Large</option>
        <option value="7">Huge</option>
      </select>

      <div className="tb-sep" />

      {/* Headings */}
      <button className="tb-btn tb-text" onClick={() => exec('formatBlock', 'H1')} title="Heading 1">H1</button>
      <button className="tb-btn tb-text" onClick={() => exec('formatBlock', 'H2')} title="Heading 2">H2</button>
      <button className="tb-btn tb-text" onClick={() => exec('formatBlock', 'H3')} title="Heading 3">H3</button>
      <button className="tb-btn tb-text" onClick={() => exec('formatBlock', 'P')}  title="Paragraph">¶</button>

      <div className="tb-sep" />

      {/* Text formatting */}
      <button className="tb-btn" onClick={() => exec('bold')}          title="Bold (Ctrl+B)"><b>B</b></button>
      <button className="tb-btn" onClick={() => exec('italic')}        title="Italic (Ctrl+I)"><i>I</i></button>
      <button className="tb-btn" onClick={() => exec('underline')}     title="Underline (Ctrl+U)"><u>U</u></button>
      <button className="tb-btn strike" onClick={() => exec('strikeThrough')} title="Strikethrough">S</button>
      <button className="tb-btn" onClick={() => exec('superscript')}   title="Superscript">x²</button>
      <button className="tb-btn" onClick={() => exec('subscript')}     title="Subscript">x₂</button>

      <div className="tb-sep" />

      {/* Alignment */}
      <button className="tb-btn" onClick={() => exec('justifyLeft')}   title="Align left">≡←</button>
      <button className="tb-btn" onClick={() => exec('justifyCenter')} title="Center">≡</button>
      <button className="tb-btn" onClick={() => exec('justifyRight')}  title="Align right">≡→</button>
      <button className="tb-btn" onClick={() => exec('justifyFull')}   title="Justify">≡≡</button>

      <div className="tb-sep" />

      {/* Lists */}
      <button className="tb-btn" onClick={() => exec('insertUnorderedList')} title="Bullet list">• —</button>
      <button className="tb-btn" onClick={() => exec('insertOrderedList')}   title="Numbered list">1.</button>
      <button className="tb-btn" onClick={() => exec('indent')}              title="Indent">→|</button>
      <button className="tb-btn" onClick={() => exec('outdent')}             title="Outdent">|←</button>

      <div className="tb-sep" />

      {/* ── TEXT COLOR — saves selection first ── */}
      <div className="tb-dropdown-wrap">
        <button
          className="tb-btn color-btn-preview"
          title="Text color"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();           // snapshot selection BEFORE dropdown opens
            closeAll();
            setShowColorPicker(v => !v);
          }}
        >
          <span style={{ borderBottom: `3px solid ${activeColor}`, paddingBottom: 1 }}>A</span>
          <span className="color-arrow">▾</span>
        </button>
        {showColorPicker && (
          <div className="tb-dropdown color-grid">
            <div className="color-grid-label">Text Color</div>
            {COLORS.map(c => (
              <div
                key={c}
                className="color-swatch"
                style={{ background: c, border: c === '#ffffff' ? '1.5px solid #e0dfd8' : 'none' }}
                title={c}
                onMouseDown={(e) => { e.preventDefault(); applyColor(c); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── HIGHLIGHT COLOR ── */}
      <div className="tb-dropdown-wrap">
        <button
          className="tb-btn color-btn-preview"
          title="Highlight color"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
            closeAll();
            setShowBgPicker(v => !v);
          }}
        >
          <span style={{ background: activeBg === 'transparent' ? '#FEF08A' : activeBg, padding: '1px 3px', borderRadius: 2 }}>H</span>
          <span className="color-arrow">▾</span>
        </button>
        {showBgPicker && (
          <div className="tb-dropdown color-grid">
            <div className="color-grid-label">Highlight Color</div>
            {BG_COLORS.map(c => (
              <div
                key={c}
                className="color-swatch"
                style={{ background: c === 'transparent' ? '#fff' : c, border: '1.5px solid #e0dfd8' }}
                title={c === 'transparent' ? 'None' : c}
                onMouseDown={(e) => { e.preventDefault(); applyBgColor(c); }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="tb-sep" />

      {/* Insert link */}
      <button className="tb-btn" title="Insert link" onClick={() => {
        const url = prompt('Enter URL (e.g. https://google.com):');
        if (url) exec('createLink', url);
      }}>🔗</button>

      {/* Insert image — FILE PICKER */}
      <button
        className="tb-btn"
        title="Insert image from your computer"
        onClick={() => imageInputRef.current?.click()}
      >
        🖼️
      </button>

      {/* Insert table */}
      <div className="tb-dropdown-wrap">
        <button className="tb-btn" title="Insert table"
          onMouseDown={(e) => { e.preventDefault(); closeAll(); setShowTableMenu(v => !v); }}>
          ⊞ Table
        </button>
        {showTableMenu && (
          <div className="tb-dropdown table-menu">
            <div className="table-menu-title">Choose table size</div>
            {[2, 3, 4, 5].map(r => (
              <div key={r} className="table-row-opt">
                {[2, 3, 4, 5].map(c => (
                  <button key={c} className="table-cell-btn" onClick={() => insertTable(r, c)}>
                    {r}×{c}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Code block */}
      <button className="tb-btn" onClick={insertCodeBlock} title="Code block">{'</>'}</button>

      {/* Divider */}
      <button className="tb-btn" onClick={insertDivider} title="Horizontal line">—</button>

      {/* Callouts */}
      <button className="tb-btn" onClick={() => insertCallout('info')}    title="Info box">💡</button>
      <button className="tb-btn" onClick={() => insertCallout('warning')} title="Warning box">⚠️</button>
      <button className="tb-btn" onClick={() => insertCallout('success')} title="Success box">✅</button>

      {/* Checklist */}
      <button className="tb-btn" onClick={insertChecklist} title="Checklist">☑️</button>

      <div className="tb-sep" />

      {/* Undo / Redo / Clear */}
      <button className="tb-btn" onClick={() => exec('undo')}         title="Undo (Ctrl+Z)">↩</button>
      <button className="tb-btn" onClick={() => exec('redo')}         title="Redo (Ctrl+Y)">↪</button>
      <button className="tb-btn" onClick={() => exec('removeFormat')} title="Clear formatting">🚫</button>
    </div>
  );
}