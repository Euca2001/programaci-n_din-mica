'use strict';

const https     = require('https');
const fs        = require('fs');
const path      = require('path');
const express   = require('express');
const basicAuth = require('express-basic-auth');
const helmet    = require('helmet');
const db        = require('./database');
const fileRoutes = require('./routes/files');
const { startSftpServer, UPLOADS_DIR } = require('./sftp-server');

// Usamos el puerto que Railway nos asigna, o 8443 por defecto
const PORT = process.env.PORT || 8443;
const SFTP_PORT = parseInt(process.env.SFTP_PORT || '2222', 10);

const USERS = {
  admin: process.env.WEB_PASS || 'SecurePass123!',
};

const keyPath  = path.join(__dirname, 'certs', 'server.key');
const certPath = path.join(__dirname, 'certs', 'server.cert');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('❌ ERROR: No se encontraron los certificados SSL.');
  process.exit(1);
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const sslOptions = {
  key:  fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

const app = express();

// NECESARIO para que Railway no cause bucles de redirección
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(express.json());

app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/files', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'files.html')));

app.get('/health', (_req, res) => {
  const stats = db.getStats();
  res.json({
    status: 'OK',
    https: true,
    sftp: { port: SFTP_PORT, active: true },
    database: { type: 'SQLite', files: stats.totalFiles, totalBytes: stats.totalBytes },
    time: new Date().toISOString(),
    server: 'CloudFileShare/1.0',
  });
});

const authMiddleware = basicAuth({
  users: USERS,
  challenge: false,
});

app.use('/api/files', authMiddleware, fileRoutes);
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'private', 'admin.html')));

// Servidor HTTPS escuchando en '0.0.0.0' para aceptar conexiones externas
https.createServer(sslOptions, app).listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor Cloud File Share activo en puerto: ${PORT}`);
});

startSftpServer();