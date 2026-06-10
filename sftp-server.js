'use strict';

const { Server } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { generateKeyPairSync } = require('crypto');

const SFTP_PORT   = parseInt(process.env.SFTP_PORT || '2222', 10);
const SFTP_USER   = process.env.SFTP_USER || 'sftpuser';
const SFTP_PASS   = process.env.SFTP_PASS || 'SftpPass123!';
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const HOST_KEY    = path.join(__dirname, 'certs', 'sftp_host.key');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function ensureHostKey() {
  if (fs.existsSync(HOST_KEY)) return fs.readFileSync(HOST_KEY);

  const certsDir = path.dirname(HOST_KEY);
  if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding:  { type: 'pkcs1', format: 'pem' },
  });

  fs.writeFileSync(HOST_KEY, privateKey);
  console.log('🔑 Clave host SFTP generada en certs/sftp_host.key');
  return privateKey;
}

function safePath(base, relative) {
  const resolved = path.resolve(base, relative || '.');
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error('Ruta fuera del directorio permitido');
  }
  return resolved;
}

function startSftpServer() {
  const hostKey = ensureHostKey();

  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    client.on('authentication', (ctx) => {
      if (ctx.method === 'password'
          && ctx.username === SFTP_USER
          && ctx.password === SFTP_PASS) {
        ctx.accept();
      } else {
        ctx.reject(['password']);
      }
    });

    client.on('ready', () => {
      client.on('session', (accept) => {
        const session = accept();

        session.on('sftp', (acceptSftp) => {
          const sftp = acceptSftp();

          sftp.on('REALPATH', (reqid, reqPath) => {
            try {
              const p = safePath(UPLOADS_DIR, reqPath);
              sftp.name(reqid, [{ filename: p }]);
            } catch {
              sftp.status(reqid, 2);
            }
          });

          sftp.on('OPENDIR', (reqid, dirPath) => {
            try {
              const p = safePath(UPLOADS_DIR, dirPath);
              const handle = Buffer.from(`dir:${p}`);
              sftp.handle(reqid, handle);
            } catch {
              sftp.status(reqid, 2);
            }
          });

          sftp.on('READDIR', (reqid, handle) => {
            const dirPath = handle.toString().replace('dir:', '');
            try {
              const entries = fs.readdirSync(dirPath).map((name) => {
                const full = path.join(dirPath, name);
                const stat = fs.statSync(full);
                return {
                  filename: name,
                  longname: `${stat.isDirectory() ? 'd' : '-'}rwxr-xr-x 1 sftpuser sftpuser ${stat.size} Jan 1 2020 ${name}`,
                  attrs: {
                    size: stat.size,
                    mode: stat.isDirectory() ? 0o40755 : 0o100644,
                    mtime: Math.floor(stat.mtimeMs / 1000),
                  },
                };
              });
              sftp.name(reqid, entries);
            } catch {
              sftp.status(reqid, 2);
            }
          });

          sftp.on('OPEN', (reqid, filePath, flags) => {
            try {
              const p = safePath(UPLOADS_DIR, filePath);
              const handle = Buffer.from(`file:${p}`);
              if (flags & 0x8) fs.writeFileSync(p, '');
              sftp.handle(reqid, handle);
            } catch {
              sftp.status(reqid, 2);
            }
          });

          sftp.on('READ', (reqid, handle, offset, length) => {
            const filePath = handle.toString().replace('file:', '');
            try {
              const fd = fs.openSync(filePath, 'r');
              const buf = Buffer.alloc(length);
              const bytesRead = fs.readSync(fd, buf, 0, length, offset);
              fs.closeSync(fd);
              if (bytesRead === 0) sftp.status(reqid, 1);
              else sftp.data(reqid, buf.slice(0, bytesRead));
            } catch {
              sftp.status(reqid, 2);
            }
          });

          sftp.on('WRITE', (reqid, handle, offset, data) => {
            const filePath = handle.toString().replace('file:', '');
            try {
              let content = fs.existsSync(filePath) ? fs.readFileSync(filePath) : Buffer.alloc(0);
              const newBuf = Buffer.alloc(Math.max(content.length, offset + data.length));
              content.copy(newBuf);
              data.copy(newBuf, offset);
              fs.writeFileSync(filePath, newBuf);
              sftp.status(reqid, 0);
            } catch {
              sftp.status(reqid, 2);
            }
          });

          sftp.on('STAT', (reqid, filePath) => statFile(sftp, reqid, filePath));
          sftp.on('LSTAT', (reqid, filePath) => statFile(sftp, reqid, filePath));

          sftp.on('REMOVE', (reqid, filePath) => {
            try {
              fs.unlinkSync(safePath(UPLOADS_DIR, filePath));
              sftp.status(reqid, 0);
            } catch {
              sftp.status(reqid, 2);
            }
          });

          sftp.on('MKDIR', (reqid, dirPath) => {
            try {
              fs.mkdirSync(safePath(UPLOADS_DIR, dirPath), { recursive: true });
              sftp.status(reqid, 0);
            } catch {
              sftp.status(reqid, 2);
            }
          });

          sftp.on('RMDIR', (reqid, dirPath) => {
            try {
              fs.rmdirSync(safePath(UPLOADS_DIR, dirPath));
              sftp.status(reqid, 0);
            } catch {
              sftp.status(reqid, 2);
            }
          });

          sftp.on('CLOSE', (reqid) => sftp.status(reqid, 0));
        });
      });
    });
  });

  server.listen(SFTP_PORT, '0.0.0.0', () => {
    console.log(`📡 Servidor SFTP activo en puerto ${SFTP_PORT}`);
    console.log(`   Usuario: ${SFTP_USER}  |  Directorio: /uploads`);
  });

  return server;
}

function statFile(sftp, reqid, filePath) {
  try {
    const p = safePath(UPLOADS_DIR, filePath);
    const stat = fs.statSync(p);
    sftp.attrs(reqid, {
      size: stat.size,
      mode: stat.isDirectory() ? 0o40755 : 0o100644,
      mtime: Math.floor(stat.mtimeMs / 1000),
    });
  } catch {
    sftp.status(reqid, 2);
  }
}

module.exports = { startSftpServer, UPLOADS_DIR };
