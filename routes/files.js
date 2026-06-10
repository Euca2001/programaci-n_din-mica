'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const db      = require('../database');
const { UPLOADS_DIR } = require('../sftp-server');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get('/', (_req, res) => {
  const files = db.getAllFiles().map((f) => ({
    id: f.id,
    name: f.original_name,
    size: f.size,
    mimeType: f.mime_type,
    uploadedBy: f.uploaded_by,
    uploadedAt: f.uploaded_at,
    isPublic: !!f.is_public,
    shareToken: f.share_token,
    downloadCount: f.download_count,
  }));
  res.json({ files, stats: db.getStats() });
});

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  const id = crypto.randomUUID();
  db.insertFile({
    id,
    original_name: req.file.originalname,
    stored_name: req.file.filename,
    mime_type: req.file.mimetype,
    size: req.file.size,
    uploaded_by: req.auth.user,
    uploaded_at: new Date().toISOString(),
    share_token: null,
    is_public: 0,
  });

  res.status(201).json({
    message: 'Archivo subido correctamente',
    file: {
      id,
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    },
  });
});

router.get('/:id/download', (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });

  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo físico no encontrado' });
  }

  db.incrementDownloads(file.id);
  res.download(filePath, file.original_name);
});

router.post('/:id/share', (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });

  const token = file.share_token || crypto.randomBytes(16).toString('hex');
  if (!file.share_token) db.enableSharing(file.id, token);

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    message: 'Enlace de compartición generado',
    shareUrl: `${baseUrl}/share/${token}`,
    token,
  });
});

router.delete('/:id', (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });

  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.deleteFile(file.id);

  res.json({ message: 'Archivo eliminado' });
});

module.exports = router;
