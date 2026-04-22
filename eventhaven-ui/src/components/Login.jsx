import { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8081';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
      if (response.data.success) {
        localStorage.setItem('token', response.data.data.token);
        alert('Login successful');
        // Redirect to home
        window.location.href = '/';
      }
    } catch (error) {
      alert(error.response.data.error);
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