# Prompt Claude Code — Sync Dashboard ↔ ClickUp

> Copie-colle ce prompt dans Claude Code (VS Code) pour qu'il modifie le dashboard.

---

```
Tu es un développeur full-stack senior spécialisé en intégration d'API. Tu dois modifier un dashboard HTML existant pour qu'il synchronise bidirectionnellement avec ClickUp via leur API v2.

<context>
Le fichier à modifier est :
`MJB CONSTRUCT/09 - IMMO/04 - Suivi & prospection/Dashboard_Prospection.html`

C'est un dashboard de prospection immobilière (entrepôts industriels en Belgique) pour l'entreprise MJB Construct. Il est actuellement 100% statique — les données sont en dur dans le JavaScript, et les changements de pipeline (dropdown) sont sauvegardés uniquement en localStorage.

L'objectif est de connecter ce dashboard à ClickUp pour que :
1. Au chargement de la page → les tâches sont lues depuis ClickUp
2. Quand l'utilisateur change un stage pipeline via le dropdown → le statut de la tâche ClickUp se met à jour en temps réel
3. Un indicateur visuel montre si la sync est active ou en erreur
</context>

<clickup_config>
- API v2 base URL : `https://api.clickup.com/api/v2`
- Token personnel : `{{CLICKUP_API_TOKEN}}`
  (L'utilisateur devra le renseigner dans un champ de config au premier lancement)
- Liste Pipeline Biens : `901522285748`
- Espace : `90154145032`
- Statuts disponibles sur la liste (dans cet ordre) :
  "à qualifier" → "visite planifiée" → "visité" → "négociation" → "signé" → "écarté"

Mapping dashboard stages → statuts ClickUp :
  - "new"      → "à qualifier"
  - "analyse"  → "à qualifier"
  - "preval"   → "à qualifier"
  - "visite"   → "visite planifiée"
  - "nego"     → "négociation"
  - "actif"    → "signé"
  - "ecarte"   → "écarté"

Tâches ClickUp existantes (task_id extraits des URLs clickup dans le code) :
  - Bien 1 (Manage) : 86c909h5z
  - Bien 2 (Seneffe) : 86c909h9k
  - Bien 3 (Gosselies) : 86c8ydjh8
  - Bien 4 (Genk) : 86c909hd4
  Les autres biens n'ont pas encore de tâche ClickUp.
</clickup_config>

<instructions>
1. PROBLÈME CORS : L'API ClickUp ne supporte pas les appels directs depuis le navigateur (CORS bloqué). Tu dois donc créer un micro-proxy local. Structure du projet :

   ```
   04 - Suivi & prospection/
   ├── Dashboard_Prospection.html   (modifié)
   ├── proxy-clickup.js             (nouveau — serveur Node.js)
   ├── package.json                 (nouveau)
   └── start.sh                     (nouveau — script de lancement)
   ```

2. PROXY NODE.JS (`proxy-clickup.js`) :
   - Express.js minimal (~50 lignes max)
   - Port 3847 (peu commun, évite les conflits)
   - CORS activé pour localhost
   - 3 routes seulement :
     - `GET /api/tasks` → proxy vers `GET /list/901522285748/task?include_closed=true`
     - `PUT /api/task/:id` → proxy vers `PUT /task/:id` (body JSON passé tel quel)
     - `GET /api/health` → retourne `{ status: "ok" }`
   - Le token ClickUp est lu depuis une variable d'environnement `CLICKUP_TOKEN` ou depuis un fichier `.env`
   - Ajoute dotenv pour lire le .env

3. PACKAGE.JSON : dépendances minimales — express, cors, dotenv, node-fetch (ou axios)

4. START.SH :
   ```bash
   #!/bin/bash
   cd "$(dirname "$0")"
   npm install --silent 2>/dev/null
   echo "Dashboard proxy démarré sur http://localhost:3847"
   echo "Ouvre Dashboard_Prospection.html dans ton navigateur"
   node proxy-clickup.js
   ```

5. MODIFICATIONS DU HTML — Dashboard_Prospection.html :

   a) Ajoute un bandeau de config en haut de la page (visible uniquement si le proxy n'est pas connecté) :
      - Champ pour saisir le token ClickUp (sauvegardé en localStorage, clé "mjb_clickup_token")
      - Bouton "Connecter"
      - Indicateur de statut : 🟢 Connecté / 🔴 Déconnecté / 🟡 Sync en cours

   b) Ajoute un module JS `ClickUpSync` en haut du script :
      ```javascript
      const CU = {
        base: 'http://localhost:3847/api',
        connected: false,

        async init() {
          // Vérifie si le proxy tourne (GET /health)
          // Si oui, charge les tâches (GET /tasks)
          // Met à jour l'indicateur de statut
        },

        async fetchTasks() {
          // GET /tasks → retourne les tâches de la liste
          // Pour chaque tâche qui a un match dans le tableau `biens` (via clickup URL) :
          //   - Met à jour le stage pipeline selon le statut ClickUp
          //   - Met à jour localStorage
          //   - Re-render le tableau
        },

        async updateTaskStatus(taskId, stage) {
          // PUT /task/:id avec body { status: mappedStatus }
          // Affiche un toast de confirmation ou d'erreur
          // En cas d'erreur réseau → sauvegarde le changement en localStorage
          //   et ajoute à une queue de retry
        }
      };
      ```

   c) Modifie `setPipelineStage()` pour appeler `CU.updateTaskStatus()` en plus de `savePipeline()` :
      ```javascript
      function setPipelineStage(id, stage, ev) {
        if (ev) ev.stopPropagation();
        pipeline[id] = stage;
        savePipeline();
        // Sync ClickUp si connecté
        const bien = biens.find(b => b.id === id);
        if (bien && bien.clickup && CU.connected) {
          const taskId = bien.clickup.split('/t/')[1];
          CU.updateTaskStatus(taskId, stage);
        }
        renderBiens(getFilteredBiens());
        updatePipelineCounters();
      }
      ```

   d) Ajoute un système de TOAST notifications (petit bandeau en bas à droite) :
      - "✅ Manage → Visite planifiée synchro ClickUp" (succès)
      - "❌ Erreur sync ClickUp — sauvegardé localement" (échec)
      - Auto-disparition après 3 secondes

   e) Ajoute un bouton "🔄 Sync maintenant" à côté du bouton "Ouvrir ClickUp" dans le header du dashboard — force un re-fetch des tâches ClickUp

   f) Pour les biens SANS tâche ClickUp : quand l'utilisateur change leur stage pour la première fois, propose (via un petit modal) de créer automatiquement la tâche dans ClickUp :
      - POST vers le proxy → `POST /api/task` → crée dans la liste 901522285748
      - Nom de la tâche : "[Type] Localité — Adresse (Surface)"
      - Description : toutes les infos du bien
      - Statut : selon le mapping
      - Sauvegarde le nouveau task_id dans le bien et en localStorage

6. IMPORTANT — ne casse rien de l'existant :
   - Le dashboard doit fonctionner SANS le proxy (mode offline avec localStorage uniquement)
   - Si le proxy ne répond pas → fallback silencieux sur localStorage
   - Le design existant (couleurs, layout, responsive) ne doit pas changer
   - Les données statiques dans `biens[]` restent comme fallback initial
</instructions>

<output_format>
Crée ou modifie les 4 fichiers dans l'ordre :
1. package.json
2. proxy-clickup.js
3. start.sh (avec chmod +x)
4. Dashboard_Prospection.html (édite le fichier existant, ne le réécris pas entièrement)

Après chaque fichier, explique brièvement ce que tu as fait.
À la fin, donne les instructions de lancement en 3 étapes max.
</output_format>

<constraints>
- Pas de framework frontend (React, Vue...) — reste en vanilla JS
- Pas de build step (webpack, vite...) — tout doit marcher en ouvrant le HTML
- Le proxy doit être le plus simple possible (<80 lignes)
- Pas de base de données — localStorage + ClickUp = les 2 sources de vérité
- Sécurité : le token n'est JAMAIS dans le code HTML, uniquement dans le .env côté serveur
- Node.js >= 18 (disponible sur le Mac de l'utilisateur)
</constraints>
```

---

## Notes d'utilisation

### Avant de lancer le prompt dans Claude Code :

1. **Récupère ton token ClickUp personnel** :
   - Va sur https://app.clickup.com/settings/apps
   - Copie ton "API Token"

2. **Crée le fichier `.env`** dans le dossier `04 - Suivi & prospection/` :
   ```
   CLICKUP_TOKEN=pk_xxxxxxxxxxxxxxx
   ```

3. **Lance le prompt** dans Claude Code (VS Code) en étant dans le dossier MJB CONSTRUCT

### Pour démarrer le dashboard connecté :
```bash
cd "MJB CONSTRUCT/09 - IMMO/04 - Suivi & prospection"
./start.sh
```
Puis ouvre `Dashboard_Prospection.html` dans ton navigateur.
