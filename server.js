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

// Railway inyecta el puerto en process.env.PORT automáticamente
const PORT = process.env.PORT || 8080;
const SFTP_PORT = parseInt(process.env.SFTP_PORT || '2222', 10);

const USERS = {
  admin: process.env.WEB_PASS || 'SecurePass123!',
};

const keyPath  = path.join(__dirname, 'certs', 'server.key');
const certPath = path.join(__dirname, 'certs', 'server.cert');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
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

// NECESARIO para que Railway no cause conflictos con el protocolo
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/files', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'files.html')));

app.get('/health', (_req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString() });
});

const authMiddleware = basicAuth({
  users: USERS,
  challenge: false,
});

app.use('/api/files', authMiddleware, fileRoutes);
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'private', 'admin.html')));

// Levantar servidor vinculado a 0.0.0.0
https.createServer(sslOptions, app).listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor activo en puerto: ${PORT}`);
});

startSftpServer();