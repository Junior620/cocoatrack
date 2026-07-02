#!/bin/bash
# Script de redémarrage propre du serveur de développement
# Arrête tous les processus Next.js, nettoie les caches, et démarre proprement

set -e

echo "🛑 Arrêt des serveurs Next.js existants..."
pkill -f "next dev" 2>/dev/null || echo "   Aucun serveur en cours"

echo ""
echo "🧹 Nettoyage des caches..."
rm -rf /home/lagauche/Bureau/app-suivi/v2/.next
echo "   ✓ Cache .next supprimé"

# Attendre que les processus soient vraiment terminés
sleep 2

echo ""
echo "✅ Nettoyage terminé !"
echo ""
echo "📋 Prochaines étapes :"
echo "   1. Lancer le serveur manuellement : npm run dev"
echo "   2. Attendre le message 'compiled successfully'"
echo "   3. Ouvrir : http://localhost:3000/examples/yield-prediction"
echo "   4. Prendre les 3 captures essentielles :"
echo "      • Figure 3.X.1 (État initial)"
echo "      • Figure 3.X.2 (Résultat complet)"
echo "      • Figure 3.X.4 (Comparaison 3 niveaux)"
echo ""
echo "💡 En cas d'erreur persistante :"
echo "   • Vérifier que port 3000 est libre : lsof -i :3000"
echo "   • Nettoyer node_modules : rm -rf node_modules && npm install"
echo ""
