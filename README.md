Sistema de inventario para pymes
con react, node, postgresql
desarrollado para IACC 2025
Autenticación y Roles:
Login como admin (ej: admin@test.com / admin123) → Acceso completo (agregar/editar/eliminar items, RFID updates).
Login como user → Vista de solo lectura (ve inventario y escanea RFID, pero no edita stock).

Gestión de Inventario:
Formulario: Agrega/edita items con campos obligatorios (SKU, Nombre, Cantidad, Stock Mínimo) + RFID Tag opcional (ej: "RFID-TEST1").
Tabla: Muestra todos los items con columnas nuevas (RFID Tag, Estado con chips). Búsqueda incluye RFID/SKU/Nombre. Filtro "Solo Bajo Stock".
Gráficos: Pie Chart (top 5 items por stock) y Bar Chart (bajo vs normal stock) – se actualizan automáticamente al cambiar stock.
Estadísticas: Cards con total items, stock total, bajo stock, promedio mínimo.

RFID con Emulación:
Sección Escáner: Input de texto – escribe tag (ej: "RFID-TEST1") + Enter → Simula lectura, muestra detalles del item (nombre, stock actual, estado bajo/normal).
Actualizaciones: Botones +1 (Entrada) / -1 (Salida) (solo admin) → Modifica stock en DB, previene negativos, refresca tabla/gráficos. Alertas para errores (ej: "Stock insuficiente", "Item no encontrado").
Fallback: Si no hay RFID, busca por SKU.
Logs: Consola muestra escaneos/updates (ej: "RFID Update: RFID-TEST1 - Stock de 5 a 6").

Seguridad y UX:
Tokens JWT (expiran en 1h), logout limpia todo.
Loaders (CircularProgress) y alertas (error/success/info) para feedback.
Responsive: Funciona en mobile/desktop (Material-UI).
Pruebas Rápidas para Confirmar (Si No las Hiciste)
Backend: node server.js → "Servidor corriendo en puerto 5000". Prueba en Postman: POST /api/auth/login → Token OK.
Frontend: npm start → Login admin → Agrega item con RFID → Escanea (escribe tag + Enter) → +1/-1 → Ver cambios en tabla/gráficos.
User Mode: Logout → Login user → Escanea RFID → Ve info pero sin botones (alerta "No autorizado").
Edge Cases: Intenta -1 en stock=0 → Error. Busca por RFID inexistente → "Item no encontrado".
