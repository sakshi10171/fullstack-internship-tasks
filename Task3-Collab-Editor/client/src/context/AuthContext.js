// Import required React hooks and axios
import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Create authentication context
const AuthContext = createContext(null);

// AuthProvider component to wrap the application
export const AuthProvider = ({ children }) => {

  // Store logged-in user data
  const [user, setUser] = useState(null);

  // Loading state while verifying authentication
  const [loading, setLoading] = useState(true);

  // Verify token when app loads
  useEffect(() => {

    const verifyToken = async () => {

      // Get stored user data from localStorage
      const stored = localStorage.getItem('user');

      // If no user found, stop loading
      if (!stored) {
        setLoading(false);
        return;
      }

      let parsed;

      try {

        // Parse stored JSON data
        parsed = JSON.parse(stored);

      } catch {

        // Remove invalid data from localStorage
        localStorage.removeItem('user');
        setLoading(false);
        return;
      }

      // Check if token exists
      if (!parsed?.token) {

        localStorage.removeItem('user');
        setLoading(false);
        return;
      }

      try {

        // Verify token with backend server
        const res = await axios.get('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${parsed.token}`
          }
        });

        // Store fresh user data from server
        const freshUser = {
          ...res.data,
          token: parsed.token
        };

        setUser(freshUser);

        // Update localStorage
        localStorage.setItem('user', JSON.stringify(freshUser));

        // Set default authorization header
        axios.defaults.headers.common['Authorization'] =
          `Bearer ${parsed.token}`;

      } catch (err) {

        // Clear invalid token and logout user
        localStorage.removeItem('user');

        delete axios.defaults.headers.common['Authorization'];

        setUser(null);
      }

      // Authentication check completed
      setLoading(false);
    };

    verifyToken();

  }, []);

  // Login function
  const login = async (email, password) => {

    // Send login request to backend
    const { data } = await axios.post('/api/auth/login', {
      email,
      password
    });

    // Save user data
    setUser(data);

    localStorage.setItem('user', JSON.stringify(data));

    // Set authorization token
    axios.defaults.headers.common['Authorization'] =
      `Bearer ${data.token}`;

    return data;
  };

  // Register function
  const register = async (name, email, password) => {

    // Send register request to backend
    const { data } = await axios.post('/api/auth/register', {
      name,
      email,
      password
    });

    // Save new user data
    setUser(data);

    localStorage.setItem('user', JSON.stringify(data));

    // Set authorization token
    axios.defaults.headers.common['Authorization'] =
      `Bearer ${data.token}`;

    return data;
  };

  // Logout function
  const logout = () => {

    // Clear user state
    setUser(null);

    // Remove stored user data
    localStorage.removeItem('user');

    // Remove authorization header
    delete axios.defaults.headers.common['Authorization'];
  };

  // Provide authentication data to entire app
  return (
    <AuthContext.Provider
      value={{ user, login, register, logout, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to access authentication context
export const useAuth = () => useContext(AuthContext);
