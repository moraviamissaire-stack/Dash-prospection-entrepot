require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app     = express();
const PORT    = 3847;
const CU_BASE = 'https://api.clickup.com/api/v2';
const TOKEN   = process.env.CLICKUP_TOKEN;

if (!TOKEN) {
  console.error('\n❌  CLICKUP_TOKEN manquant dans .env');
  console.error('   Crée le fichier .env avec : CLICKUP_TOKEN=pk_xxxxxxxxxxxxxxx\n');
  process.exit(1);
}

app.use(cors({ origin: (origin, cb) => cb(null, true) }));
app.use(express.json());

const cuHeaders = { Authorization: TOKEN, 'Content-Type': 'application/json' };

async function cu(path, opts = {}) {
  const res  = await fetch(`${CU_BASE}${path}`, { ...opts, headers: { ...cuHeaders, ...opts.headers } });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.err || `HTTP ${res.status}`), { status: res.status });
  return json;
}

// ── Dashboard HTML (accès direct depuis iPhone via HTTP) ─────
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'Dashboard_Prospection.html')));

// ── Santé ────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// ── Workspace : toutes les spaces du team ────────────────────
app.get('/api/spaces', async (_, res) => {
  try   { res.json(await cu('/team/90151071241/space?archived=false')); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── Dossiers d'un space ──────────────────────────────────────
app.get('/api/space/:id/folders', async (req, res) => {
  try   { res.json(await cu(`/space/${req.params.id}/folder?archived=false`)); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── Listes d'un dossier ──────────────────────────────────────
app.get('/api/folder/:id/lists', async (req, res) => {
  try   { res.json(await cu(`/folder/${req.params.id}/list?archived=false`)); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── Méta d'une liste (nom, statuts…) ────────────────────────
app.get('/api/list/:id', async (req, res) => {
  try   { res.json(await cu(`/list/${req.params.id}`)); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── Tâches d'une liste (générique) ───────────────────────────
app.get('/api/list/:id/tasks', async (req, res) => {
  try   { res.json(await cu(`/list/${req.params.id}/task?include_closed=true&subtasks=true`)); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── Mise à jour d'une tâche ───────────────────────────────────
app.put('/api/task/:id', async (req, res) => {
  try   { res.json(await cu(`/task/${req.params.id}`, { method: 'PUT', body: JSON.stringify(req.body) })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── Création d'une tâche dans n'importe quelle liste ─────────
app.post('/api/list/:id/task', async (req, res) => {
  try   { res.json(await cu(`/list/${req.params.id}/task`, { method: 'POST', body: JSON.stringify(req.body) })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ── Suppression d'une tâche ───────────────────────────────────
app.delete('/api/task/:id', async (req, res) => {
  try   { res.json(await cu(`/task/${req.params.id}`, { method: 'DELETE' })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅  Proxy ClickUp actif sur toutes les interfaces → port ${PORT}`);
  console.log(`   Mac local   : http://localhost:${PORT}`);
  console.log(`   iPhone/iPad : http://100.118.200.47:${PORT}  (via Tailscale)\n`);
});
