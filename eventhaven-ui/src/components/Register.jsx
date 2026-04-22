import { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8081';

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const handleRegister = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, { username, password, email });
      if (response.data.success) {
        alert('Register successful');
        // Redirect to login
        window.location.href = '/login';
      }
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  return (
    <div>
      <h2>Register</h2>
      <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button onClick={handleRegister}>Register</button>
    </div>
  );
};

export default Register;