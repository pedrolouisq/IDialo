# 🛸 IDialo - Plataforma de Comunicación Privada v1.0

IDialo es una aplicación de chat moderna, cifrada de extremo a extremo (E2EE) y con persistencia en la nube mediante MongoDB. Diseñada para ofrecer una experiencia premium con glassmorphism, temas dinámicos y videollamadas.

## 🚀 Despliegue Oficial en la Nube

El proyecto ya está configurado y funcionando en:
- **Frontend (Interfaz):** [https://i-dialo.vercel.app/](https://i-dialo.vercel.app/)
- **Backend (API):** [https://idialo.onrender.com/](https://idialo.onrender.com/)
- **Código Fuente:** [https://github.com/pedrolouisq/IDialo.git](https://github.com/pedrolouisq/IDialo.git)

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React + Vite, Socket.io-client, Lucide Icons, CryptoJS (AES).
- **Backend:** Node.js, Express, Socket.io, Mongoose (MongoDB Atlas).
- **Seguridad:** Cifrado E2EE, JWT (JSON Web Tokens), BCrypt (Hasheo de contraseñas).
- **Aesthetics:** Glassmorphism, CSS Variables, Temas Dinámicos (Matrix, Cyberpunk, Ocean).

## 📁 Estructura del Proyecto Local

El código completo que tienes en esta carpeta contiene:
- `/frontend`: Código de la interfaz de usuario.
- `/backend`: Lógica del servidor y conexión con base de datos.
- `.env`: (Oculto) Contiene tus llaves maestras de MongoDB y JWT. ¡Mantenlo seguro!

## 🔧 Cómo ejecutarlo localmente

1. **Instalar dependencias:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
2. **Lanzar Backend:**
   ```bash
   cd backend && npm run dev
   ```
3. **Lanzar Frontend:**
   ```bash
   cd frontend && npm run dev
   ```

---
¡Disfruta de tu chat privado! 🚀🛸✨
