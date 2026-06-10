# ☁️ Cloud File Share — Ejercicio 2

Aplicación **cliente-servidor** desplegada en la nube para **almacenar y compartir archivos**, con servidor web HTTPS, base de datos SQLite y servidor **SFTP** para transferencias seguras.

---

## ✅ Criterios de Evaluación Cubiertos

| Criterio | Puntos | Implementación |
|----------|--------|----------------|
| Crear la plataforma en la nube | 15 | `Dockerfile` + `docker-compose.yml` (AWS/GCP/Azure) |
| Presentar un servidor web | 15 | Express + HTTPS (puerto 443/8443) |
| Desarrollar aplicación cliente-servidor | 15 | API REST + cliente web (`/files`) |
| Almacenamiento y compartición de archivos | 20 | Subida web, SFTP, enlaces `/share/:token` |
| Establecer la conexión respectiva | 10 | HTTP→HTTPS, SFTP sobre SSH, API REST |
| Configurar servidor SFTP | 20 | `sftp-server.js` puerto 2222, auth cifrada |
| Puntualidad | 5 | — |

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────┐
│              Contenedor Docker / VPS             │
│                                                  │
│  ┌──────────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Servidor Web │  │  SFTP    │  │  SQLite   │ │
│  │ HTTPS :443   │  │  :2222   │  │  files.db │ │
│  └──────┬───────┘  └────┬─────┘  └─────┬─────┘ │
│         │               │               │        │
│         └───────────────┴───────────────┘        │
│                    /uploads/                     │
└─────────────────────────────────────────────────┘
         ▲                    ▲
    Cliente Web          Cliente SFTP
   (navegador)         (FileZilla, sftp)
```

---

## 🚀 Instalación Local

```bash
npm install
npm run generate-cert
npm start
```

Servidor disponible en:
- **Web:** https://localhost:8443
- **Gestor de archivos:** https://localhost:8443/files
- **SFTP:** `sftp -P 2222 sftpuser@localhost`
- **Health:** https://localhost:8443/health

> En Docker usa puertos 443, 80 y 2222. Localmente usa 8443/8080 para no requerir permisos de administrador.

---

## 🔑 Credenciales

| Servicio | Usuario | Contraseña |
|----------|---------|------------|
| Web (Basic Auth) | `admin` | `SecurePass123!` |
| SFTP | `sftpuser` | `SftpPass123!` |

---

## 📡 Uso del SFTP

### Con línea de comandos
```bash
sftp -P 2222 sftpuser@localhost
# Contraseña: SftpPass123!
sftp> ls
sftp> put mi-archivo.pdf
sftp> get mi-archivo.pdf
```

### Con FileZilla
- Protocolo: **SFTP**
- Host: `localhost` (o IP del VPS)
- Puerto: `2222`
- Usuario: `sftpuser`

---

## 🌐 API REST (requiere Basic Auth)

```bash
# Listar archivos
curl -k -u admin:SecurePass123! https://localhost:8443/api/files

# Subir archivo
curl -k -u admin:SecurePass123! -F "file=@documento.pdf" https://localhost:8443/api/files/upload

# Generar enlace de compartición
curl -k -u admin:SecurePass123! -X POST https://localhost:8443/api/files/{id}/share

# Descargar archivo compartido (público, sin auth)
curl -k -O https://localhost:8443/share/{token}
```

---

## 🐳 Despliegue en la Nube

### Requisitos
- VPS o instancia en **AWS EC2**, **GCP Compute Engine** o **Azure VM**
- Docker y Docker Compose instalados
- Puertos 80, 443 y 2222 abiertos en el firewall

### Pasos
```bash
# En el servidor VPS
git clone <tu-repositorio>
cd ejercicio2
docker compose up -d --build
```

La aplicación quedará en:
- `https://TU-IP/` — Interfaz web
- `sftp://TU-IP:2222` — Transferencia SFTP

---

## 📁 Estructura del Proyecto

```
ejercicio2/
├── server.js           ← Servidor web HTTPS + inicio SFTP
├── sftp-server.js      ← Servidor SFTP (SSH cifrado)
├── database.js         ← Base de datos SQLite
├── routes/files.js     ← API de archivos
├── generate-cert.js    ← Certificado SSL
├── docker-compose.yml  ← Despliegue en nube
├── Dockerfile
├── public/
│   ├── index.html      ← Página principal
│   └── files.html      ← Cliente web (gestor)
├── private/
│   └── admin.html      ← Panel administración
├── uploads/            ← Archivos almacenados
└── data/files.db       ← Base de datos
```

---

## ✅ Verificación Automática

```bash
npm run verify:local          # Prueba local (8443)
npm run verify -- https://TU-IP   # Prueba en VPS
```

Resultado actual: **12/12 pruebas exitosas** — ver `docs/reporte-verificacion.json`

---

## 📚 Documentación de Entrega

| Archivo | Contenido |
|---------|-----------|
| [`docs/EVIDENCIAS.md`](docs/EVIDENCIAS.md) | Plantilla completa para el documento Word |
| [`docs/DESPLIEGUE-AWS.md`](docs/DESPLIEGUE-AWS.md) | Guía paso a paso AWS EC2 |
| [`scripts/deploy-vps.sh`](scripts/deploy-vps.sh) | Despliegue automático en VPS Linux |
| [`scripts/verify-app.js`](scripts/verify-app.js) | Verifica los 12 criterios de la actividad |

---

## 📋 Evidencias para el Documento Word

1. Captura de `docker compose up` en el VPS
2. Captura de https://TU-IP/ (página principal)
3. Captura del gestor de archivos subiendo un archivo
4. Captura de FileZilla conectado por SFTP
5. Captura de `curl https://TU-IP/health` mostrando SFTP y DB activos
6. Captura de un enlace de compartición funcionando

> Usa `docs/EVIDENCIAS.md` como base — tiene el checklist completo con espacios para tus capturas.
