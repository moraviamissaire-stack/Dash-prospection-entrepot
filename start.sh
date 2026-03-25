#!/bin/bash
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "⚠️  Fichier .env introuvable."
  echo "   Crée-le avec : echo 'CLICKUP_TOKEN=pk_xxxxxxx' > .env"
  exit 1
fi

echo "📦 Installation des dépendances..."
npm install --silent 2>/dev/null

echo "🚀 Proxy ClickUp démarré sur http://localhost:3847"
echo "   Ouvre Dashboard_Prospection.html dans ton navigateur"
echo "   (Ctrl+C pour arrêter)"
echo ""
node proxy-clickup.js
