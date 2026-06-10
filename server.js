'use strict';

const https     = require('https');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const express   = require('express');
const basicAuth = require('express-basic-auth');
const helmet    = require('helmet');
const db        = require('./database');
const fileRoutes = require('./routes/files');
const { startSftpServer, UPLOADS_DIR } = require('./sftp-server');

const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '8443', 10);
const HTTP_PORT  = parseInt(process.env.HTTP_PORT  || '8080',  10);
const SFTP_PORT  = parseInt(process.env.SFTP_PORT  || '2222',  10);

const USERS = {
  admin: process.env.WEB_PASS || 'SecurePass123!',
};

const keyPath  = path.join(__dirname, 'certs', 'server.key');
const certPath = path.join(__dirname, 'certs', 'server.cert');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('❌ ERROR: No se encontraron los certificados SSL.');
  console.error('   Ejecuta primero: npm run generate-cert');
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

app.use((req, _res, next) => {
  const auth = req.headers.authorization ? '🔑 AUTH' : '🌐 OPEN';
  console.log(`[${new Date().toISOString()}] ${auth} ${req.method} ${req.path}`);
  next();
});

app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/files', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'files.html'));
});

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

app.get('/share/:token', (req, res) => {
  const file = db.getFileByToken(req.params.token);
  if (!file) {
    return res.status(404).sendFile(path.join(__dirname, 'public', 'share-not-found.html'));
  }

  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo no disponible' });
  }

  db.incrementDownloads(file.id);
  res.download(filePath, file.original_name);
});

const authMiddleware = basicAuth({
  users: USERS,
  challenge: false,
  unauthorizedResponse: (req) => ({
    error: 'Acceso denegado',
    message: 'Se requiere autenticación para acceder a esta ruta.',
    path: req.path,
  }),
});

app.use('/api/files', authMiddleware, fileRoutes);

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'admin.html'));
});

app.get('/private', (_req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'admin.html'));
});

app.get('/admin/api/info', authMiddleware, (req, res) => {
  const stats = db.getStats();
  res.json({
    user: req.auth.user,
    role: 'administrator',
    loginTime: new Date().toISOString(),
    serverInfo: {
      protocol: 'HTTPS/TLS',
      httpsPort: HTTPS_PORT,
      sftpPort: SFTP_PORT,
      database: 'SQLite',
      files: stats.totalFiles,
      totalBytes: stats.totalBytes,
    },
  });
});

const httpApp = express();
httpApp.use((req, res) => {
  const host = req.headers.host?.replace(`:${HTTP_PORT}`, '');
  res.redirect(301, `https://${host}:${HTTPS_PORT}${req.url}`);
});

https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  ☁️  CLOUD FILE SHARE — Aplicación Cliente-Servidor  ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  HTTPS:  https://localhost:${HTTPS_PORT}                      ║`);
  console.log(`║  SFTP:   sftp://localhost:${SFTP_PORT}                       ║`);
  console.log('║                                                      ║');
  console.log('║  Web:     /          → Inicio                        ║');
  console.log('║           /files     → Gestor de archivos (auth)     ║');
  console.log('║           /admin     → Panel administración          ║');
  console.log('║           /share/:id → Descarga pública              ║');
  console.log('║                                                      ║');
  console.log('║  Web Auth:  admin / SecurePass123!                   ║');
  console.log('║  SFTP Auth: sftpuser / SftpPass123!                  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});

http.createServer(httpApp).listen(HTTP_PORT, () => {
  console.log(`🔄 HTTP :${HTTP_PORT} → redirige a HTTPS :${HTTPS_PORT}`);
});

startSftpServer();
