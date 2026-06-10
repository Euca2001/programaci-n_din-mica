// generate-cert.js
// Genera un certificado SSL auto-firmado sin necesidad de OpenSSL

const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, 'certs');

// Crear directorio de certificados si no existe
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
  console.log('📁 Directorio /certs creado');
}

console.log('🔐 Generando certificado SSL auto-firmado...');

const attrs = [
  { name: 'commonName',       value: 'localhost' },
  { name: 'countryName',      value: 'DO' },
  { name: 'organizationName', value: 'Ejercicio2 SecureServer' },
  { name: 'organizationalUnitName', value: 'IT Security' },
];

const options = {
  keySize: 2048,
  days: 365,
  algorithm: 'sha256',
  extensions: [
    { name: 'subjectAltName', altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
    ]},
  ],
};

const pems = selfsigned.generate(attrs, options);

fs.writeFileSync(path.join(certsDir, 'server.key'),  pems.private);
fs.writeFileSync(path.join(certsDir, 'server.cert'), pems.cert);

console.log('✅ Certificado generado exitosamente:');
console.log('   📄 certs/server.key  → Clave privada');
console.log('   📄 certs/server.cert → Certificado SSL');
console.log('');
console.log('ℹ️  Este es un certificado AUTO-FIRMADO para desarrollo local.');
console.log('   Para producción, usa Let\'s Encrypt (ver README.md).');
