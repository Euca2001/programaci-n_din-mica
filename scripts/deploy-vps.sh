#!/bin/bash
# Despliegue en VPS (AWS EC2 / GCP / Azure)
# Uso: bash scripts/deploy-vps.sh

set -e

echo "=========================================="
echo "  Cloud File Share — Despliegue en VPS"
echo "=========================================="

# 1. Instalar Docker si no existe
if ! command -v docker &> /dev/null; then
  echo "[1/4] Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "   Docker instalado. Si es la primera vez, cierra sesión y vuelve a entrar."
else
  echo "[1/4] Docker ya instalado ✓"
fi

# 2. Abrir puertos en firewall (UFW)
if command -v ufw &> /dev/null; then
  echo "[2/4] Configurando firewall (puertos 80, 443, 2222)..."
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw allow 2222/tcp
  sudo ufw --force enable 2>/dev/null || true
else
  echo "[2/4] UFW no disponible — abre manualmente 80, 443 y 2222 en el panel de tu nube"
fi

# 3. Construir y levantar contenedor
echo "[3/4] Construyendo e iniciando contenedor..."
docker compose up -d --build

# 4. Verificar
echo "[4/4] Verificando servicios..."
sleep 5
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "=========================================="
echo "  ✅ DESPLIEGUE COMPLETADO"
echo "=========================================="
echo "  Web:    https://${PUBLIC_IP}/"
echo "  Files:  https://${PUBLIC_IP}/files"
echo "  Admin:  https://${PUBLIC_IP}/admin"
echo "  SFTP:   sftp://${PUBLIC_IP}:2222"
echo ""
echo "  Web:   admin / SecurePass123!"
echo "  SFTP:  sftpuser / SftpPass123!"
echo "=========================================="

curl -sk "https://localhost/health" | python3 -m json.tool 2>/dev/null || curl -sk "https://localhost/health"
