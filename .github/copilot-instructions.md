# Guía para agentes AI en el proyecto Inventario

## Arquitectura general
- El proyecto está dividido en dos carpetas principales:
  - `backend/`: API REST en Node.js con Express, conecta a PostgreSQL usando el paquete `pg`.
  - `frontend/`: Aplicación React creada con Create React App, utiliza Material UI y Axios para consumir la API.

## Flujos de desarrollo
- **Backend**
  - Ejecutar en modo desarrollo: `npm run dev` (usa nodemon)
  - Ejecutar en modo producción: `npm start`
  - Archivo principal: `backend/server.js`
  - Variables de entorno gestionadas con `dotenv`.
  - Endpoints y lógica principal en `server.js`.
- **Frontend**
  - Ejecutar en modo desarrollo: `npm start` dentro de `frontend/`
  - Ejecutar tests: `npm test` dentro de `frontend/`
  - Build de producción: `npm run build` dentro de `frontend/`

## Convenciones y patrones
- **Backend**
  - Uso de middlewares estándar: `body-parser`, `cors`.
  - Conexión a base de datos PostgreSQL mediante el paquete `pg`.
  - Estructura simple, toda la lógica en `server.js`.
- **Frontend**
  - Componentes React funcionales.
  - Uso de Material UI para estilos y componentes visuales.
  - Axios para llamadas HTTP al backend.
  - Tests con Testing Library y Jest.

## Integraciones y comunicación
- El frontend consume la API del backend usando Axios.
- El backend expone endpoints REST, configurados para aceptar CORS.
- No hay autenticación ni autorización implementada por defecto.

## Ejemplo de flujo de trabajo
1. Para desarrollar el backend, modifica `backend/server.js` y usa `npm run dev`.
2. Para desarrollar el frontend, modifica archivos en `frontend/src/` y usa `npm start`.
3. Para agregar dependencias, usa `npm install <paquete>` en la carpeta correspondiente.

## Archivos clave
- `backend/server.js`: lógica principal del servidor y endpoints.
- `frontend/src/App.js`: componente principal de la app React.
- `frontend/package.json` y `backend/package.json`: scripts y dependencias.

## Notas
- No hay configuración personalizada de ESLint, solo la estándar de Create React App en frontend.
- No hay dockerización ni CI/CD configurados por defecto.
- El README principal está vacío; la documentación relevante está en el README de frontend.

---
¿Hay algún flujo, convención o integración que no esté claro o que debamos documentar mejor para agentes AI?