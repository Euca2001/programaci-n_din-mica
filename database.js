'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'files.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id            TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_name   TEXT NOT NULL,
    mime_type     TEXT,
    size          INTEGER NOT NULL DEFAULT 0,
    uploaded_by   TEXT NOT NULL,
    uploaded_at   TEXT NOT NULL,
    share_token   TEXT UNIQUE,
    is_public     INTEGER NOT NULL DEFAULT 0,
    download_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_files_share_token ON files(share_token);
  CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
`);

const stmts = {
  insert: db.prepare(`
    INSERT INTO files (id, original_name, stored_name, mime_type, size, uploaded_by, uploaded_at, share_token, is_public)
    VALUES (@id, @original_name, @stored_name, @mime_type, @size, @uploaded_by, @uploaded_at, @share_token, @is_public)
  `),
  all: db.prepare('SELECT * FROM files ORDER BY uploaded_at DESC'),
  byId: db.prepare('SELECT * FROM files WHERE id = ?'),
  byToken: db.prepare('SELECT * FROM files WHERE share_token = ? AND is_public = 1'),
  setShare: db.prepare('UPDATE files SET share_token = ?, is_public = 1 WHERE id = ?'),
  incrementDownloads: db.prepare('UPDATE files SET download_count = download_count + 1 WHERE id = ?'),
  remove: db.prepare('DELETE FROM files WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS total FROM files'),
  totalSize: db.prepare('SELECT COALESCE(SUM(size), 0) AS bytes FROM files'),
};

function insertFile(record) {
  return stmts.insert.run(record);
}

function getAllFiles() {
  return stmts.all.all();
}

function getFileById(id) {
  return stmts.byId.get(id);
}

function getFileByToken(token) {
  return stmts.byToken.get(token);
}

function enableSharing(id, token) {
  return stmts.setShare.run(token, id);
}

function incrementDownloads(id) {
  return stmts.incrementDownloads.run(id);
}

function deleteFile(id) {
  return stmts.remove.run(id);
}

function getStats() {
  return {
    totalFiles: stmts.count.get().total,
    totalBytes: stmts.totalSize.get().bytes,
  };
}

module.exports = {
  db,
  insertFile,
  getAllFiles,
  getFileById,
  getFileByToken,
  enableSharing,
  incrementDownloads,
  deleteFile,
  getStats,
};
