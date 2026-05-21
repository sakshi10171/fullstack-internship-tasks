// Import required React hooks and components
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Import authentication context
import { useAuth } from '../context/AuthContext';

// Import CSS styles
import './Auth.css';

// Authentication page component
export default function AuthPage() {

  // Store current mode: login or register
  const [mode, setMode] = useState('login');

  // Store form input values
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: ''
  });

  // Store error messages
  const [error, setError] = useState('');

  // Store loading state during API calls
  const [loading, setLoading] = useState(false);

  // Access login and register functions from AuthContext
  const { login, register } = useAuth();

  // Hook for page navigation
  const navigate = useNavigate();

  // Handle form submission
  const handle = async (e) => {

    e.preventDefault();

    // Clear previous errors
    setError('');

    // Start loading
    setLoading(true);

    try {

      // Login existing user
      if (mode === 'login') {

        await login(form.email, form.password);

      } else {

        // Register new user
        await register(form.name, form.email, form.password);
      }

      // Redirect user to home page
      navigate('/');

    } catch (err) {

      // Show error message from backend
      setError(
        err.response?.data?.message || 'Something went wrong'
      );

    } finally {

      // Stop loading
      setLoading(false);
    }
  };

  return (

    <div className="auth-page">

      <div className="auth-card">

        {/* Application logo section */}
        <div className="auth-logo">

          <svg
            width="32"
            height="32"
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

        {/* Page heading */}
        <h1>
          {mode === 'login'
            ? 'Welcome back'
            : 'Create account'}
        </h1>

        {/* Subtitle text */}
        <p className="auth-subtitle">

          {mode === 'login'
            ? 'Sign in to access your documents'
            : 'Start collaborating on documents'}

        </p>

        {/* Display error message */}
        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        {/* Authentication form */}
        <form onSubmit={handle}>

          {/* Full name field only for register mode */}
          {mode === 'register' && (

            <div className="form-group">

              <label>Full name</label>

              <input
                type="text"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value
                  })
                }
                required
              />

            </div>
          )}

          {/* Email input field */}
          <div className="form-group">

            <label>Email</label>

            <input
              type="email"
              placeholder="jane@example.com"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value
                })
              }
              required
            />

          </div>

          {/* Password input field */}
          <div className="form-group">

            <label>Password</label>

            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) =>
                setForm({
                  ...form,
                  password: e.target.value
                })
              }
              required
              minLength={6}
            />

          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="auth-btn"
            disabled={loading}
          >

            {loading
              ? 'Please wait...'
              : mode === 'login'
              ? 'Sign in'
              : 'Create account'}

          </button>

        </form>

        {/* Switch between login and register */}
        <p className="auth-switch">

          {mode === 'login'
            ? "Don't have an account? "
            : 'Already have an account? '}

          <button
            onClick={() => {

              // Toggle authentication mode
              setMode(
                mode === 'login'
                  ? 'register'
                  : 'login'
              );

              // Clear error messages
              setError('');
            }}
          >

            {mode === 'login'
              ? 'Sign up'
              : 'Sign in'}

          </button>

        </p>

      </div>

    </div>
  );
}
