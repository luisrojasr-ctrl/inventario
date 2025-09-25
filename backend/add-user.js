   const { Pool } = require('pg');
   const bcrypt = require('bcrypt');

   // Config DB (mismo que .env)
   const pool = new Pool({
     host: 'localhost',
     user: 'postgres',  // Tu usuario PG
     password: 'tesoro3515',  // Cambia por tu password real
     database: 'iacc',
     port: 5432,
   });

   async function addUser () {
     const email = 'user@test.com';
     const password = 'password123';  // Password en texto plano
     const rol = 'user';  // O 'admin' si quieres acceso completo

     try {
       // Genera hash bcrypt (salt 10)
       const hashedPassword = await bcrypt.hash(password, 10);
       console.log(`Hash generado para "${password}": ${hashedPassword}`);

       // Inserta en DB
       const query = `
         INSERT INTO usuarios (email, password, rol) 
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET 
           password = EXCLUDED.password, 
           rol = EXCLUDED.rol
       `;
       const result = await pool.query(query, [email, hashedPassword, rol]);
       console.log('Usuario agregado/actualizado exitosamente:', result.rows[0] || 'Nuevo usuario');
     } catch (err) {
       console.error('Error al agregar usuario:', err);
     } finally {
       await pool.end();
     }
   }

   addUser ();
   