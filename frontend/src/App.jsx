import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Landing from './components/Landing';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const handleUserUpdate = (updatedUser) => {
    const freshUser = { ...user, ...updatedUser };
    setUser(freshUser);
    localStorage.setItem('user', JSON.stringify(freshUser));
  };

  useEffect(() => {
    if (user && user.theme && user.theme !== 'default') {
      document.documentElement.setAttribute('data-theme', user.theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [user]);

  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route 
          path="/login" 
          element={!token ? <Login onLogin={handleLogin} /> : <Navigate to="/chat" />} 
        />
        <Route 
          path="/chat" 
          element={token ? <Dashboard user={user} token={token} onLogout={handleLogout} onUserUpdate={handleUserUpdate} /> : <Navigate to="/login" />} 
        />
      </Routes>
    </div>
  );
}

export default App;
