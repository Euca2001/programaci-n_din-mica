# Evidencias de la Actividad — Cloud File Share

**Tipo de Actividad:** Desarrollo de Ejercicios  
**Título:** Aplicación Cliente-Servidor en la Nube con SFTP  
**Fecha:** _______________  
**Estudiante:** _______________  
**Institución:** _______________

---

## 1. Propósito de la Actividad

Desarrollar una aplicación cliente-servidor utilizando tecnologías en la nube para el almacenamiento y compartición de archivos, implementando un servidor web, base de datos y protocolo SFTP para garantizar la seguridad de los datos transferidos.

---

## 2. Plataforma en la Nube (15 pts)

### Proveedor seleccionado
- [ ] AWS EC2
- [ ] Google Cloud Platform (GCP)
- [ ] Microsoft Azure
- [x] Contenedor Docker (compatible con los tres proveedores)

### Evidencia
**Captura 1:** Panel de la instancia VPS / VM creada en la nube.  
**Captura 2:** Terminal ejecutando `docker compose up -d --build`

```
Comando de despliegue:
  git clone <repositorio>
  cd ejercicio2
  bash scripts/deploy-vps.sh

O manualmente:
  docker compose up -d --build
```

**URL del servidor:** `https://___________________/`

---

## 3. Servidor Web (15 pts)

### Tecnología
- **Framework:** Node.js + Express
- **Protocolo:** HTTPS (TLS 1.2/1.3)
- **Puerto:** 443 (producción) / 8443 (desarrollo)
- **Seguridad:** Helmet.js (HSTS, CSP, X-Frame-Options)

### Evidencia
**Captura 3:** Página principal en `https://TU-IP/`  
**Captura 4:** Resultado de `curl -k https://TU-IP/health`

```json
{
  "status": "OK",
  "https": true,
  "sftp": { "port": 2222, "active": true },
  "database": { "type": "SQLite", "files": 1, "totalBytes": 17 },
  "server": "CloudFileShare/1.0"
}
```

---

## 4. Aplicación Cliente-Servidor (15 pts)

### Componentes

| Capa | Tecnología | Archivo |
|------|-----------|---------|
| Cliente (frontend) | HTML + JavaScript | `public/files.html` |
| Servidor (backend) | Node.js + Express | `server.js` |
| API REST | Express Router | `routes/files.js` |
| Base de datos | SQLite | `database.js` |

### Evidencia
**Captura 5:** Gestor de archivos en `/files` mostrando la interfaz de subida.  
**Captura 6:** Archivo subido exitosamente con mensaje de confirmación.

### Comandos de prueba API
```bash
# Listar archivos (requiere auth)
curl -k -u admin:SecurePass123! https://TU-IP/api/files

# Subir archivo
curl -k -u admin:SecurePass123! -F "file=@documento.pdf" https://TU-IP/api/files/upload
```

---

## 5. Almacenamiento y Compartición de Archivos (20 pts)

### Funcionalidades implementadas
1. **Subir archivos** vía interfaz web (drag & drop) o API REST
2. **Listar archivos** con metadatos en base de datos SQLite
3. **Descargar archivos** autenticado vía `/api/files/:id/download`
4. **Compartir archivos** generando enlace público `/share/:token`
5. **Transferir archivos** vía SFTP al mismo directorio `/uploads`

### Evidencia
**Captura 7:** Lista de archivos en el gestor web.  
**Captura 8:** Enlace de compartición copiado al portapapeles.  
**Captura 9:** Descarga pública funcionando sin autenticación en `/share/TOKEN`.

---

## 6. Conexión Cliente-Servidor (10 pts)

### Tipos de conexión establecidos

| Conexión | Protocolo | Puerto | Estado |
|----------|-----------|--------|--------|
| Web → API | HTTPS + Basic Auth | 443 | ✅ |
| HTTP → HTTPS | Redirección 301 | 80→443 | ✅ |
| Cliente SFTP → Servidor | SSH/SFTP | 2222 | ✅ |
| Compartición pública | HTTPS | 443 | ✅ |

### Evidencia
**Captura 10:** Redirección HTTP a HTTPS (`curl -I http://TU-IP/`).  
**Captura 11:** Respuesta 401 sin credenciales y 200 con credenciales.

---

## 7. Configuración del Servidor SFTP (20 pts)

### Configuración de seguridad SFTP

| Parámetro | Valor |
|-----------|-------|
| Protocolo | SSH-2 / SFTP |
| Puerto | 2222 |
| Cifrado | RSA 2048-bit (clave host) |
| Autenticación | Usuario + contraseña |
| Usuario | `sftpuser` |
| Contraseña | `SftpPass123!` |
| Directorio raíz | `/uploads` (chroot lógico) |
| Archivo servidor | `sftp-server.js` |

### Medidas de seguridad
- Transferencia cifrada end-to-end vía SSH
- Autenticación obligatoria (rechaza conexiones anónimas)
- Restricción de rutas (no permite salir del directorio uploads)
- Clave host RSA generada automáticamente

### Evidencia
**Captura 12:** Conexión SFTP con FileZilla o WinSCP.  
**Captura 13:** Transferencia de archivo vía SFTP (`put archivo.txt`).  
**Captura 14:** Archivo visible en la interfaz web después de subirlo por SFTP.

### Comandos SFTP
```bash
# Conectar
sftp -P 2222 sftpuser@TU-IP

# Subir archivo
sftp> put mi-archivo.pdf

# Listar
sftp> ls

# Descargar
sftp> get mi-archivo.pdf
```

### Configuración FileZilla
- Protocolo: **SFTP - SSH File Transfer Protocol**
- Host: `TU-IP`
- Puerto: `2222`
- Tipo de acceso: Normal
- Usuario: `sftpuser`
- Contraseña: `SftpPass123!`

---

## 8. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────┐
│                  VPS / Contenedor Docker             │
│                                                      │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────┐ │
│  │ Servidor Web│   │ Servidor SFTP│   │ SQLite  │ │
│  │ HTTPS :443  │   │ SSH   :2222  │   │files.db │ │
│  └──────┬──────┘   └──────┬───────┘   └────┬────┘ │
│         └─────────────────┴────────────────┘        │
│                    /uploads/ (volúmenes)            │
└─────────────────────────────────────────────────────┘
          ▲                        ▲
     Navegador Web           Cliente SFTP
    (cliente HTML/JS)      (FileZilla, CLI)
```

---

## 9. Verificación Automática

Ejecutar antes de entregar:

```bash
node scripts/verify-app.js https://TU-IP
# o en local:
node scripts/verify-app.js https://localhost:8443
```

Resultado esperado: **10/10 pruebas exitosas**

---

## 10. Checklist de Entrega

- [ ] Portada institucional (1 página)
- [ ] Captura plataforma en la nube / VPS
- [ ] Captura servidor web funcionando
- [ ] Captura gestor de archivos (cliente web)
- [ ] Captura subida y listado de archivos
- [ ] Captura enlace de compartición
- [ ] Captura conexión SFTP (FileZilla)
- [ ] Captura transferencia SFTP
- [ ] Captura health check con JSON
- [ ] Enlaces activos al servidor desplegado

---

## 11. Credenciales de Acceso

| Servicio | URL / Host | Usuario | Contraseña |
|----------|-----------|---------|------------|
| Web | `https://TU-IP/` | admin | SecurePass123! |
| Gestor | `https://TU-IP/files` | admin | SecurePass123! |
| SFTP | `TU-IP:2222` | sftpuser | SftpPass123! |

> ⚠️ Cambiar contraseñas en producción editando `.env` o `docker-compose.yml`

---

*Documento generado para la entrega de evidencias — Ejercicio 2 Cloud File Share*
