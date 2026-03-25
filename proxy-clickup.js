require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app      = express();
const PORT     = 3847;
const CU_BASE  = 'https://api.clickup.com/api/v2';
const LIST_ID  = '901522285748';
const TOKEN    = process.env.CLICKUP_TOKEN;

if (!TOKEN) {
  console.error('\n❌  CLICKUP_TOKEN manquant dans .env');
  console.error('   Crée le fichier .env avec : CLICKUP_TOKEN=pk_xxxxxxxxxxxxxxx\n');
  process.exit(1);
}

// Autorise toutes les origines y compris file:// (origin = null)
app.use(cors({ origin: (origin, cb) => cb(null, true) }));
app.use(express.json());

const cuHeaders = { Authorization: TOKEN, 'Content-Type': 'application/json' };

async function cu(path, opts = {}) {
  const res  = await fetch(`${CU_BASE}${path}`, { ...opts, headers: { ...cuHeaders, ...opts.headers } });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.err || `HTTP ${res.status}`), { status: res.status });
  return json;
}

// Santé du proxy
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Toutes les tâches de la liste pipeline
app.get('/api/tasks', async (_, res) => {
  try   { res.json(await cu(`/list/${LIST_ID}/task?include_closed=true`)); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// Mise à jour du statut d'une tâche
app.put('/api/task/:id', async (req, res) => {
  try   { res.json(await cu(`/task/${req.params.id}`, { method: 'PUT', body: JSON.stringify(req.body) })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// Création d'une nouvelle tâche dans la liste
app.post('/api/task', async (req, res) => {
  try   { res.json(await cu(`/list/${LIST_ID}/task`, { method: 'POST', body: JSON.stringify(req.body) })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`\n✅  Proxy ClickUp démarré → http://localhost:${PORT}`);
  console.log(`   Ouvre Dashboard_Prospection.html dans ton navigateur\n`);
});
