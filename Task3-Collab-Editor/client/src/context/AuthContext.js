import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const stored = localStorage.getItem('user');
      if (!stored) {
        setLoading(false);
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(stored);
      } catch {
        localStorage.removeItem('user');
        setLoading(false);
        return;
      }

      if (!parsed?.token) {
        localStorage.removeItem('user');
        setLoading(false);
        return;
      }

      try {
        // Verify token with server — if server restarted with new JWT_SECRET this will fail
        const res = await axios.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${parsed.token}` }
        });
        // Token is valid — set user with fresh data from server
        const freshUser = { ...res.data, token: parsed.token };
        setUser(freshUser);
        localStorage.setItem('user', JSON.stringify(freshUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.token}`;
      } catch (err) {
        // Token rejected — clear everything and show login
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
      }

      setLoading(false);
    };

    verifyToken();
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password });
    setUser(data);
    localStorage.setItem('user', JSON.stringify(data));
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await axios.post('/api/auth/register', { name, email, password });
    setUser(data);
    localStorage.setItem('user', JSON.stringify(data));
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    return data;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);