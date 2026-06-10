'use strict';

/**
 * Verifica todos los criterios de la actividad y genera reporte de evidencias.
 * Uso: node scripts/verify-app.js [baseUrl]
 * Ejemplo: node scripts/verify-app.js https://localhost:8443
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const BASE     = process.argv[2] || 'https://localhost:8443';
const WEB_USER = process.env.WEB_PASS ? 'admin' : 'admin';
const WEB_PASS = process.env.WEB_PASS || 'SecurePass123!';
const SFTP_PORT = process.env.SFTP_PORT || '2222';

const results = [];

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const reqOpts = { rejectUnauthorized: false, ...options };
    const req = lib.get(url, reqOpts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function postMultipart(url, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now();
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: text/plain\r\n\r\n`),
      fileContent,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const u = new URL(url);
    const auth = Buffer.from(`${WEB_USER}:${WEB_PASS}`).toString('base64');
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname,
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function postJson(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const auth = Buffer.from(`${WEB_USER}:${WEB_PASS}`).toString('base64');
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname,
      method: 'POST',
      rejectUnauthorized: false,
      headers: { Authorization: `Basic ${auth}`, 'Content-Length': 0 },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (detail) console.log(`   → ${detail}`);
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Verificación — Cloud File Share            ║');
  console.log(`║   URL: ${BASE.padEnd(35)}║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // 1. Servidor web HTTPS
  try {
    const home = await request(`${BASE}/`);
    check('Servidor web HTTPS activo', home.status === 200, `HTTP ${home.status}`);
  } catch (e) {
    check('Servidor web HTTPS activo', false, e.message);
  }

  // 2. Health — DB + SFTP
  try {
    const health = await request(`${BASE}/health`);
    const data = JSON.parse(health.body);
    check('Health check OK', data.status === 'OK', JSON.stringify(data));
    check('Base de datos SQLite', data.database?.type === 'SQLite', `${data.database?.files} archivos`);
    check('Servidor SFTP reportado', data.sftp?.active === true, `Puerto ${data.sftp?.port}`);
  } catch (e) {
    check('Health check', false, e.message);
  }

  // 3. Redirección HTTP→HTTPS
  try {
    const httpPort = BASE.includes(':8443') ? '8080' : '80';
    const httpUrl = BASE.replace('https://', 'http://').replace(/:\d+/, `:${httpPort}`);
    const redir = await request(`${httpUrl}/health`);
    const location = redir.headers.location || '';
    check('Redirección HTTP → HTTPS', redir.status === 301 && location.startsWith('https'), `${redir.status} → ${location}`);
  } catch (e) {
    check('Redirección HTTP → HTTPS', false, e.message);
  }

  // 4. Auth — sin credenciales
  try {
    const denied = await request(`${BASE}/api/files`);
    check('API protegida sin credenciales', denied.status === 401, `HTTP ${denied.status}`);
  } catch (e) {
    check('API protegida', false, e.message);
  }

  // 5. Subida de archivo
  const testFile = path.join(__dirname, '..', 'uploads', '_verify-test.txt');
  fs.writeFileSync(testFile, `Verificación ${new Date().toISOString()}`);
  let fileId = null;
  try {
    const upload = await postMultipart(`${BASE}/api/files/upload`, testFile);
    const data = JSON.parse(upload.body);
    fileId = data.file?.id;
    check('Subida de archivo (cliente→servidor)', upload.status === 201, `ID: ${fileId}`);
  } catch (e) {
    check('Subida de archivo', false, e.message);
  }

  // 6. Listar archivos
  try {
    const auth = Buffer.from(`${WEB_USER}:${WEB_PASS}`).toString('base64');
    const list = await request(`${BASE}/api/files`, { headers: { Authorization: `Basic ${auth}` } });
    const data = JSON.parse(list.body);
    check('Listado de archivos en BD', list.status === 200 && data.files?.length > 0, `${data.stats?.totalFiles} archivo(s)`);
  } catch (e) {
    check('Listado de archivos', false, e.message);
  }

  // 7. Compartir archivo
  let shareUrl = null;
  if (fileId) {
    try {
      const share = await postJson(`${BASE}/api/files/${fileId}/share`);
      const data = JSON.parse(share.body);
      shareUrl = data.shareUrl;
      check('Generar enlace de compartición', share.status === 200 && !!shareUrl, shareUrl);
    } catch (e) {
      check('Enlace de compartición', false, e.message);
    }
  }

  // 8. Descarga pública
  if (shareUrl) {
    try {
      const dl = await request(shareUrl);
      check('Descarga pública sin auth', dl.status === 200, `HTTP ${dl.status}`);
    } catch (e) {
      check('Descarga pública', false, e.message);
    }
  }

  // 9. SFTP puerto abierto
  try {
    const net = require('net');
    const host = new URL(BASE).hostname;
    const sftpOk = await new Promise((resolve) => {
      const sock = net.connect(parseInt(SFTP_PORT, 10), host, () => { sock.destroy(); resolve(true); });
      sock.on('error', () => resolve(false));
      sock.setTimeout(3000, () => { sock.destroy(); resolve(false); });
    });
    check(`Puerto SFTP ${SFTP_PORT} accesible`, sftpOk, `sftp -P ${SFTP_PORT} sftpuser@${host}`);
  } catch (e) {
    check('Puerto SFTP', false, e.message);
  }

  // 10. Security headers
  try {
    const res = await request(`${BASE}/health`);
    const hsts = res.headers['strict-transport-security'];
    check('Header HSTS (seguridad web)', !!hsts, hsts?.substring(0, 50));
  } catch (e) {
    check('Headers de seguridad', false, e.message);
  }

  // Resumen
  const passed = results.filter((r) => r.ok).length;
  const total  = results.length;
  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log(`  Resultado: ${passed}/${total} pruebas exitosas`);
  console.log('══════════════════════════════════════════════');

  // Guardar reporte JSON
  const reportPath = path.join(__dirname, '..', 'docs', 'reporte-verificacion.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    fecha: new Date().toISOString(),
    baseUrl: BASE,
    passed,
    total,
    results,
    shareUrl,
  }, null, 2));
  console.log(`\n📄 Reporte guardado en: docs/reporte-verificacion.json`);

  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error('Error fatal:', e.message); process.exit(1); });
