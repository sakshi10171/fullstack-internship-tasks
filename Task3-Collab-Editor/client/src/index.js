// Import React library
import React from 'react';

// Import React DOM for rendering app in browser
import ReactDOM from 'react-dom/client';

// Import global CSS styles
import './index.css';

// Import main App component
import App from './App';

// Create React root element
const root = ReactDOM.createRoot(
  document.getElementById('root')
);

// Render application
root.render(

  // StrictMode helps detect potential issues during development
  <React.StrictMode>

    {/* Main application component */}
    <App />

  </React.StrictMode>
);
