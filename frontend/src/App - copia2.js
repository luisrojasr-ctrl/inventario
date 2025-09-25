import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Login from './Login';
import {
  Container, Typography, Grid, Card, CardContent, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert, IconButton, InputAdornment, AppBar, Toolbar
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { jwtDecode } from 'jwt-decode';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
} from 'chart.js';

// Registrar componentes de Chart.js (una vez al inicio)
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

function App() {
  // Estados para autenticación (mismos de antes)
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser  ] = useState(null);
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
 
  // Nuevos estados para RFID
  const [rfidInput, setRfidInput] = useState('');
  const [currentItem, setCurrentItem] = useState(null);
  const [rfidLoading, setRfidLoading] = useState(false);
  const [rfidError, setRfidError] = useState('');
 
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
          const decoded = jwtDecode(token);
          if (decoded.exp * 1000 < Date.now()) {
            throw new Error('Token expirado');
          }
          setUser  (decoded);
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

  // Memoizar fetchInventario con useCallback
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
  }, [token]);

  // Cargar inventario solo si autenticado
  useEffect(() => {
    if (isAuthenticated) fetchInventario();
     }, [isAuthenticated, fetchInventario]);
 
   //filtros modificados para RFID en esta version
  useEffect(() => {
    let filtered = inventario;
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
        (item.rfid_tag && item.rfid_tag.toLowerCase().includes(searchTerm.toLowerCase())) //linea añadida para buscar por RFID
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
  const normalStock = totalItems - bajoStock;
  const promedioStockMinimo = totalItems > 0 ? Math.round(inventario.reduce((sum, item) => sum + item.stock_minimo, 0) / totalItems) : 0;

  // Datos para gráficos
  const pieData = {
    labels: inventario
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5)
      .map(item => item.nombre.length > 15 ? item.nombre.substring(0, 15) + '...' : item.nombre),
    datasets: [{
      label: 'Distribución de Stock (%)',
      data: inventario
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5)
        .map(item => item.cantidad),
      backgroundColor: [
        'rgba(255, 99, 132, 0.8)',
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 205, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)'
      ],
      borderWidth: 1,
    }],
  };

  const barData = {
    labels: ['Bajo Stock', 'Stock Normal'],
    datasets: [{
      label: 'Número de Items',
      data: [bajoStock, normalStock],
      backgroundColor: [
        'rgba(255, 99, 132, 0.8)',  // Rojo para bajo stock
        'rgba(75, 192, 192, 0.8)'   // Verde para normal
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(75, 192, 192, 1)'
      ],
      borderWidth: 1,
    }],
  };
// Opciones para gráficos (nuevas)
  const pieOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Distribución de Stock (Top 5 Items)' }
    }
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Items Bajo Stock vs Normal' }
    },
    scales: { y: { beginAtZero: true } }
  };

  // funciones para agregar, editar, eliminar items (mismas de antes)
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
      const payload = { nombre, cantidad: parseInt(cantidad), sku, stock_minimo: parseInt(stockMinimo),
        rfid_tag: rfidInput.trim() || null  // Nuevo: RFID opcional, Incluir RFID si se proporciona 
       };
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
    setRfidTag(item.rfid_tag || '');   // Nuevo: Cargar RFID si existe
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
// Reiniciar formulario
  const resetForm = () => {
    setNombre('');
    setCantidad('');
    setSku('');
    setStockMinimo('');
    setRfidTag('');  // Nuevo: Reiniciar campo RFID
    setEditandoId(null);
    setError('');
  };

 // Funciones para RFID
   const handleRfidScan = async () => {
    if (!rfidInput.trim()) return;
    setRfidLoading(true);
    setRfidError('');
    try {
      const response = await axios.get(`${API_URL}/inventario/rfid/${rfidInput.trim()}`);
      setCurrentItem(response.data);
      setRfidError('');
      console.log('RFID Escaneado:', response.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setRfidError(`Item no encontrado con tag/SKU: ${rfidInput}`);
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setRfidError('Sesión expirada. Inicia sesión como admin para editar.');       
      logout();
      } else {
        setRfidError('Error al escanear RFID');
      }
      console.error('Error RFID:', err);
      setCurrentItem(null);
    } finally {
      setRfidLoading(false);
      setRfidInput('');
    }
  };
  const updateStockRfid = async (delta) => {
    if (!currentItem || user.rol !== 'admin') {
      setRfidError('No autorizado para editar stock.');
      return;
    }
    setRfidLoading(true);
    try {
      const tag = currentItem.rfid_tag || currentItem.sku;
      const response = await axios.put(`${API_URL}/inventario/rfid/${tag}/stock`, { delta });
      setCurrentItem(response.data.item);
      fetchInventario();  // Refresca todo
      setRfidError(response.data.message);
    } catch (err) {
      setRfidError(err.response?.data?.error || 'Error al actualizar stock');
    } finally {
      setRfidLoading(false);
    }
  };
//fin funcion RFID
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser  (null);
    setIsAuthenticated(false);
    setInventario([]);
    setCurrentItem(null);  // Nuevo: Limpia RFID
    setError('');
  };

  const handleLogin = (userData) => {
    setUser  (userData);
    setToken(localStorage.getItem('token'));
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }
  return (
    <>
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

        {/* Sección de Estadísticas (mismas de antes) */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Total de Items</Typography>
                <Typography variant="h4">{totalItems}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Total de Stock</Typography>
                <Typography variant="h4">{totalStock}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card sx={{ bgcolor: bajoStock > 0 ? 'warning.light' : 'success.light' }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Items Bajo Stock Mínimo</Typography>
                <Typography variant="h4">{bajoStock}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Promedio Stock Mínimo</Typography>
                <Typography variant="h4">{promedioStockMinimo}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        {/* Nueva Sección: Gráficos Visuales */}
        <Typography variant="h4" gutterBottom align="center" sx={{ mb: 3 }}>
          Gráficos de Inventario
        </Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Distribución de Stock (Pie Chart)</Typography>
                <div style={{ position: 'relative', height: '400px' }}>
                  {totalItems > 0 ? (
                    <Pie data={pieData} options={pieOptions} />
                  ) : (
                    <Alert severity="info">Agrega items para ver la distribución.</Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Items Bajo Stock vs Normal (Bar Chart)</Typography>
                <div style={{ position: 'relative', height: '400px' }}>
                  {totalItems > 0 ? (
                    <Bar data={barData} options={barOptions} />
                  ) : (
                    <Alert severity="info">Agrega items para ver la comparación.</Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Nueva Sección: Escáner RFID con Emulación */}
        <Typography variant="h4" gutterBottom align="center" sx={{ mb: 3 }}>
          Escáner RFID (Emulación: Escribe tag + Enter)
        </Typography>
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Instrucciones: Escribe el RFID tag (ej: RFID-12345) y presiona Enter para simular escaneo.</Typography>
            <TextField
              fullWidth
              label="Input RFID (Emulación)"
              value={rfidInput}
              onChange={(e) => setRfidInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRfidScan();
                }
              }}
              variant="outlined"
              placeholder="Ej: RFID-12345"
              disabled={rfidLoading}
              sx={{ mb: 2 }}
            />
            {rfidLoading && <CircularProgress sx={{ mb: 2 }} />}
            {rfidError && <Alert severity="error" sx={{ mb: 2 }}>{rfidError}</Alert>}
            {currentItem && (
              <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, mb: 2 }}>
                <Typography variant="h6">Item Escaneado: {currentItem.nombre}</Typography>
                <Typography>SKU/RFID: {currentItem.sku || 'N/A'} / {currentItem.rfid_tag || 'N/A'}</Typography>
                <Typography>Stock Actual: {currentItem.cantidad} (Mínimo: {currentItem.stock_minimo})</Typography>
                <Typography color={currentItem.cantidad < currentItem.stock_minimo ? 'warning.main' : 'success.main'}>
                  Estado: {currentItem.cantidad < currentItem.stock_minimo ? 'Bajo Stock' : 'Normal'}
                </Typography>
                {user.rol === 'admin' && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => updateStockRfid(1)}
                      disabled={rfidLoading}
                      sx={{ mr: 1 }}
                    >
                      +1 (Entrada)
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      onClick={() => updateStockRfid(-1)}
                      disabled={rfidLoading || currentItem.cantidad === 0}
                    >
                      -1 (Salida)
                    </Button>
                  </Box>
                )}
              </Box>
            )}
            {!currentItem && !rfidError && (
              <Alert severity="info">Escanea un tag para ver detalles y actualizar stock.</Alert>
            )}
          </CardContent>
        </Card>

        {/* Formulario (solo admin) */}
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
                <Grid item xs={12} md={2.4}>
                  <TextField
                    fullWidth
                    label="RFID Tag (Opcional)"
                    value={rfidTag}
                    onChange={(e) => setRfidTag(e.target.value)}
                    variant="outlined"
                    helperText="Ej: RFID-12345 (único)"
                  />
                </Grid>
                <Grid item xs={12} md={1.2}>
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
                  label="Buscar por Nombre, SKU o RFID"
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
                      <TableCell colSpan={7} align="center">
                        No hay items para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInventario.map((item) => (
                      <TableRow key={item.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell>{item.sku || 'N/A'}</TableCell>
                        <TableCell>{item.rfid_tag || 'N/A'}</TableCell>
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