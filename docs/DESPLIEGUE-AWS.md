# Guía de Despliegue en AWS EC2

Pasos detallados para desplegar Cloud File Share en un VPS de Amazon Web Services.

---

## Paso 1 — Crear instancia EC2

1. Inicia sesión en [AWS Console](https://console.aws.amazon.com/)
2. Ve a **EC2 → Launch Instance**
3. Configuración recomendada:
   - **Nombre:** `cloud-file-share`
   - **AMI:** Ubuntu Server 22.04 LTS
   - **Tipo:** `t2.micro` (capa gratuita) o `t3.small`
   - **Par de claves:** Crear o usar existente (.pem)
   - **Security Group — Reglas de entrada:**

   | Tipo | Puerto | Origen | Descripción |
   |------|--------|--------|-------------|
   | HTTP | 80 | 0.0.0.0/0 | Web |
   | HTTPS | 443 | 0.0.0.0/0 | Web seguro |
   | Custom TCP | 2222 | 0.0.0.0/0 | SFTP |
   | SSH | 22 | Tu IP | Administración |

4. Lanza la instancia y anota la **IP pública**

---

## Paso 2 — Conectar por SSH

```bash
ssh -i tu-clave.pem ubuntu@TU-IP-PUBLICA
```

---

## Paso 3 — Subir el proyecto

**Opción A — Git:**
```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/TU-USUARIO/ejercicio2.git
cd ejercicio2
```

**Opción B — SCP desde tu PC:**
```bash
scp -i tu-clave.pem -r c:\xamppNew\htdocs\ejercicio2 ubuntu@TU-IP:/home/ubuntu/
ssh -i tu-clave.pem ubuntu@TU-IP
cd ejercicio2
```

---

## Paso 4 — Desplegar con un comando

```bash
bash scripts/deploy-vps.sh
```

O manualmente:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker compose up -d --build
```

---

## Paso 5 — Verificar

```bash
# En el VPS
curl -sk https://localhost/health | python3 -m json.tool

# Desde tu PC
node scripts/verify-app.js https://TU-IP-PUBLICA
```

---

## Paso 6 — Capturas para el documento Word

| # | Qué capturar | URL / Comando |
|---|-------------|---------------|
| 1 | Consola AWS con instancia running | console.aws.amazon.com/ec2 |
| 2 | Security Group con puertos 80, 443, 2222 | EC2 → Security Groups |
| 3 | `docker compose ps` en terminal | SSH al VPS |
| 4 | Página principal | `https://TU-IP/` |
| 5 | Gestor de archivos | `https://TU-IP/files` |
| 6 | FileZilla conectado SFTP | Host: TU-IP, Puerto: 2222 |
| 7 | Health check JSON | `curl -sk https://TU-IP/health` |

---

## Alternativas

### Google Cloud Platform
- Crear VM en **Compute Engine**
- Misma configuración de firewall (reglas VPC)
- Mismos comandos de despliegue

### Microsoft Azure
- Crear **Virtual Machine** (Ubuntu 22.04)
- Configurar **Network Security Group** con puertos 80, 443, 2222
- Mismos comandos de despliegue

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| Puerto 443 no responde | Verificar Security Group y `docker compose ps` |
| SFTP no conecta | Abrir puerto 2222 en firewall de la nube |
| Certificado no confiable | Normal con certificado auto-firmado; aceptar excepción |
| `permission denied` Docker | `sudo usermod -aG docker $USER` y re-login |
