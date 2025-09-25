import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Login from './Login';  // Importación usada correctamente
import {
  Container, Typography, Grid, Card, CardContent, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert, IconButton, InputAdornment, AppBar, Toolbar
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { jwtDecode } from 'jwt-decode';  // Named export corregido (no default)

function App() {
  // Estados para autenticación
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser ] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Estados para inventario (mismos de antes)
  const [inventario, setInventario] = useState([]);
  const [filteredInventario, setFilteredInventario] = useState([]);
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [sku, setSku] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroBajoStock, setFiltroBajoStock] = useState(false);

  const API_URL = 'http://localhost:5000/api';

  // Interceptor de Axios para agregar token automáticamente
  useEffect(() => {
    const interceptor = axios.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, [token]);

  // Verificar token al cargar la app
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          // Decodificar token para obtener user info y verificar expiración
          const decoded = jwtDecode(token);
          if (decoded.exp * 1000 < Date.now()) {
            throw new Error('Token expirado');
          }
          setUser (decoded);
          setIsAuthenticated(true);
        } catch (err) {
          console.error('Token inválido:', err);
          logout();
        }
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, [token]);

  // Memoizar fetchInventario con useCallback (fix para ESLint warning)
  const fetchInventario = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/inventario`);
      setInventario(response.data);
      setError('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Sesión expirada. Por favor, inicia sesión nuevamente.');
        logout();
      } else {
        setError('Error al cargar el inventario');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);  // Dependencia: token (para re-auth si cambia)

  // Cargar inventario solo si autenticado (con fetchInventario en deps para fix warning)
  useEffect(() => {
    if (isAuthenticated) {
      fetchInventario();
    }
  }, [isAuthenticated, fetchInventario]);

  useEffect(() => {
    let filtered = inventario;
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filtroBajoStock) {
      filtered = filtered.filter(item => item.cantidad < item.stock_minimo);
    }
    setFilteredInventario(filtered);
  }, [inventario, searchTerm, filtroBajoStock]);

  // Estadísticas (mismas de antes)
  const totalItems = inventario.length;
  const totalStock = inventario.reduce((sum, item) => sum + item.cantidad, 0);
  const bajoStock = inventario.filter(item => item.cantidad < item.stock_minimo).length;
  const promedioStockMinimo = totalItems > 0 ? Math.round(inventario.reduce((sum, item) => sum + item.stock_minimo, 0) / totalItems) : 0;

  const agregarItem = async () => {
    if (!nombre || !cantidad || !sku || stockMinimo === '') {
      setError('Todos los campos son requeridos');
      return;
    }
    if (parseInt(stockMinimo) < 0) {
      setError('El stock mínimo debe ser 0 o mayor');
      return;
    }
    setLoading(true);
    try {
      const payload = { nombre, cantidad: parseInt(cantidad), sku, stock_minimo: parseInt(stockMinimo) };
      if (editandoId) {
        await axios.put(`${API_URL}/inventario/${editandoId}`, payload);
        setEditandoId(null);
      } else {
        await axios.post(`${API_URL}/inventario`, payload);
      }
      resetForm();
      setError('');
      fetchInventario();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el item');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const editarItem = (item) => {
    setNombre(item.nombre);
    setCantidad(item.cantidad.toString());
    setSku(item.sku || '');
    setStockMinimo(item.stock_minimo.toString());
    setEditandoId(item.id);
  };

  const eliminarItem = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este item?')) {
      setLoading(true);
      try {
        await axios.delete(`${API_URL}/inventario/${id}`);
        fetchInventario();
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Error al eliminar el item');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setNombre('');
    setCantidad('');
    setSku('');
    setStockMinimo('');
    setEditandoId(null);
    setError('');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser (null);
    setIsAuthenticated(false);
    setInventario([]);
    setError('');
  };

  // Callback para Login
  const handleLogin = (userData) => {
    setUser (userData);
    setToken(localStorage.getItem('token'));
    setIsAuthenticated(true);
  };

  // Renderizado condicional
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      {/* AppBar con Usuario y Logout */}
      <AppBar position="static" sx={{ mb: 2 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Dashboard de Inventario - Bienvenido, {user.email} ({user.rol})
          </Typography>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={logout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center" color="primary">
          Dashboard de Inventario
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Sección de Estadísticas */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Total de Items</Typography>
                <Typography variant="h4" component="div">{totalItems}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Total de Stock</Typography>
                <Typography variant="h4" component="div">{totalStock}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card sx={{ bgcolor: bajoStock > 0 ? 'warning.light' : 'success.light' }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Items Bajo Stock Mínimo</Typography>
                <Typography variant="h4" component="div">{bajoStock}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Promedio Stock Mínimo</Typography>
                <Typography variant="h4" component="div">{promedioStockMinimo}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Formulario (solo visible para admin) */}
        {user.rol === 'admin' ? (
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>Agregar o Editar Item</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="SKU (Único)"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    variant="outlined"
                    helperText="Ej: LAP-001"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Nombre del Producto"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    label="Cantidad Actual"
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    variant="outlined"
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    label="Stock Mínimo"
                    type="number"
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(e.target.value)}
                    variant="outlined"
                    inputProps={{ min: 0 }}
                    helperText="Umbral para alerta de bajo stock"
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={agregarItem}
                    disabled={loading}
                    startIcon={editandoId ? <EditIcon /> : <AddIcon />}
                  >
                    {editandoId ? 'Actualizar' : 'Agregar'}
                  </Button>
                  {editandoId && (
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={resetForm}
                      sx={{ mt: 1 }}
                    >
                      Cancelar
                    </Button>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        ) : (
          <Alert severity="info" sx={{ mb: 4 }}>
            Modo solo lectura: Como usuario, puedes ver el inventario pero no editarlo. Contacta al admin para cambios.
          </Alert>
        )}

        {/* Controles de Búsqueda y Filtro */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Buscar por Nombre o SKU"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  fullWidth
                  variant={filtroBajoStock ? 'contained' : 'outlined'}
                  color="warning"
                  onClick={() => setFiltroBajoStock(!filtroBajoStock)}
                >
                  Solo Bajo Stock Mínimo ({bajoStock})
                </Button>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button fullWidth variant="outlined" onClick={fetchInventario} disabled={loading}>
                  {loading ? <CircularProgress size={24} /> : 'Actualizar Lista'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Lista de Items</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>SKU</TableCell>
                    <TableCell>Nombre</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell align="right">Stock Mínimo</TableCell>
                    <TableCell align="right">Estado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : filteredInventario.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No hay items para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInventario.map((item) => (
                      <TableRow key={item.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell component="th" scope="row">{item.sku || 'N/A'}</TableCell>
                        <TableCell>{item.nombre}</TableCell>
                        <TableCell align="right">{item.cantidad}</TableCell>
                        <TableCell align="right">{item.stock_minimo}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={item.cantidad < item.stock_minimo ? 'Bajo Stock' : 'Normal'}
                            color={item.cantidad < item.stock_minimo ? 'warning' : 'success'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          {user.rol === 'admin' && (
                            <>
                              <IconButton color="primary" onClick={() => editarItem(item)} size="small">
                                <EditIcon />
                              </IconButton>
                              <IconButton color="error" onClick={() => eliminarItem(item.id)} size="small">
                                <DeleteIcon />
                              </IconButton>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Container>
    </>
  );
}

export default App;
