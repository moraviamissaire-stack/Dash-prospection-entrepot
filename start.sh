#!/bin/bash
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "⚠️  Fichier .env introuvable."
  echo "   Crée-le avec : echo 'CLICKUP_TOKEN=pk_xxxxxxx' > .env"
  exit 1
fi

echo "📦 Installation des dépendances..."
npm install --silent 2>/dev/null

# Arrêter les instances précédentes si elles tournent
pkill -f "node proxy-clickup.js" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 1

echo ""
echo "🚀 Démarrage du proxy ClickUp (port 3847)..."
node proxy-clickup.js &
PROXY_PID=$!
sleep 2

# Vérifier que le proxy est bien démarré
if ! curl -s http://localhost:3847/api/health > /dev/null 2>&1; then
  echo "❌ Le proxy n'a pas démarré. Vérifie le .env"
  exit 1
fi
echo "✅ Proxy actif sur http://localhost:3847"

echo ""
echo "🌐 Ouverture du tunnel Cloudflare (accès 4G/5G)..."
/opt/homebrew/bin/cloudflared tunnel --url http://localhost:3847 --no-autoupdate 2>&1 | while read -r line; do
  # Détecter l'URL du tunnel
  if echo "$line" | grep -q "trycloudflare.com"; then
    URL=$(echo "$line" | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com')
    if [ -n "$URL" ]; then
      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "📱 URL TUNNEL (iPhone 4G/5G) :"
      echo "   $URL"
      echo ""
      echo "   → Colle cette URL dans le dashboard"
      echo "     (champ 'IP Mac' dans le bandeau)"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo ""
      # Sauvegarder l'URL dans un fichier pour référence
      echo "$URL" > /tmp/mjb_tunnel_url.txt
    fi
  fi
  echo "$line"
done

# Nettoyage à l'arrêt (Ctrl+C)
trap "echo ''; echo '🛑 Arrêt...'; kill $PROXY_PID 2>/dev/null; pkill -f cloudflared 2>/dev/null" EXIT
wait
