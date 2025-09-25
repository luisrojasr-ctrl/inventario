import React, { useState } from 'react';
import { Container, Typography, TextField, Button, Alert, Grid, Link } from '@mui/material';
import { Login as LoginIcon } from '@mui/icons-material';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);  // Toggle entre login/register
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/register' : '/login';
      const payload = isRegister 
        ? { email, password, rol: 'admin' }  // Por defecto admin para simplicidad; ajusta
        : { email, password };

      const response = await axios.post(`${API_URL}${endpoint}`, payload);
      const { token, user } = response.data;

      // Guardar en localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      onLogin(user);  // Callback para actualizar estado en App
    } catch (err) {
      setError(err.response?.data?.error || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <LoginIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
      <Typography variant="h4" gutterBottom align="center">
        {isRegister ? 'Registro' : 'Iniciar Sesión'}
      </Typography>

        {/* Nuevo: Alert con Credenciales de Prueba */}
        <Alert severity="info" sx={{ mb: 2, width: '100%' }}>
          <Typography variant="body2">
            <strong>Credenciales de Prueba:</strong><br />
            • Admin: admin@test.com / 123456 (acceso completo)<br />
            • Usuario: user@test.com / password123 (solo lectura)
          </Typography>
        </Alert>

      {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          sx={{ mb: 3 }}
        />
        <Button
          fullWidth
          type="submit"
          variant="contained"
          color="primary"
          disabled={loading}
          startIcon={<LoginIcon />}
          sx={{ mb: 2 }}
        >
          {loading ? 'Cargando...' : (isRegister ? 'Registrarse' : 'Iniciar Sesión')}
        </Button>
      </form>

      <Grid container justifyContent="center">
        <Grid item>
          <Link href="#" onClick={() => setIsRegister(!isRegister)} variant="body2">
            {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </Link>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Login;
