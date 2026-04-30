import { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080'; // Use gateway

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
      if (response.data.success) {
        const token = response.data.data.token;
        localStorage.setItem('token', token);

        // Fetch profile to get role
        const profileResponse = await axios.get(`${API_BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const user = profileResponse.data.data;
        localStorage.setItem('role', user.role);

        alert('Login successful');
        // Redirect based on role
        if (user.role === 'ADMIN') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/';
        }
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
};

export default Login;