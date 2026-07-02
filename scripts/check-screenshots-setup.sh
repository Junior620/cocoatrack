#!/bin/bash

# Script de vérification setup captures d'écran mémoire
# Usage: ./scripts/check-screenshots-setup.sh

echo "🔍 Vérification Setup Captures d'Écran Mémoire..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

checks_passed=0
checks_failed=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((checks_passed++))
    else
        echo -e "${RED}✗${NC} $2 - Fichier manquant: $1"
        ((checks_failed++))
    fi
}

# Function to check directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((checks_passed++))
    else
        echo -e "${RED}✗${NC} $2 - Dossier manquant: $1"
        ((checks_failed++))
    fi
}

echo "📁 Vérification Structure Fichiers..."
echo ""

# Check page exemples
check_file "app/(dashboard)/examples/yield-prediction/page.tsx" "Page exemples yield-prediction"
check_file "app/(dashboard)/examples/yield-prediction/README.md" "README page exemples"

# Check composants
check_file "components/satellite/YieldPredictionDisplay.tsx" "Component YieldPredictionDisplay"
check_file "components/satellite/YieldPredictionDisplay.examples.tsx" "Examples YieldPredictionDisplay"

# Check docs
check_file "docs/memoir/GUIDE_CAPTURES_ECRAN.md" "Guide captures d'écran"
check_dir "docs/memoir/captures" "Dossier captures"
check_file "docs/memoir/captures/README.md" "README dossier captures"

echo ""
echo "📦 Vérification Dépendances NPM..."
echo ""

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules installé"
    ((checks_passed++))
else
    echo -e "${RED}✗${NC} node_modules manquant - Exécuter: npm install"
    ((checks_failed++))
fi

echo ""
echo "🔧 Vérification Outils Système..."
echo ""

# Check screenshot tools
if command -v gnome-screenshot &> /dev/null; then
    echo -e "${GREEN}✓${NC} gnome-screenshot disponible"
    ((checks_passed++))
else
    echo -e "${YELLOW}⚠${NC} gnome-screenshot non trouvé - Installer: sudo apt install gnome-screenshot"
fi

if command -v gimp &> /dev/null; then
    echo -e "${GREEN}✓${NC} GIMP disponible (optionnel)"
else
    echo -e "${YELLOW}⚠${NC} GIMP non trouvé (optionnel) - Installer: sudo apt install gimp"
fi

echo ""
echo "📊 Résumé..."
echo ""
echo -e "Vérifications réussies: ${GREEN}$checks_passed${NC}"
echo -e "Vérifications échouées: ${RED}$checks_failed${NC}"
echo ""

if [ $checks_failed -eq 0 ]; then
    echo -e "${GREEN}✅ Setup complet ! Vous pouvez commencer les captures.${NC}"
    echo ""
    echo "🚀 Prochaines étapes:"
    echo "   1. Lancer l'app: npm run dev"
    echo "   2. Ouvrir: http://localhost:3000/examples/yield-prediction"
    echo "   3. Prendre captures: gnome-screenshot -a"
    echo "   4. Sauvegarder dans: docs/memoir/captures/"
    echo ""
    echo "📚 Guides disponibles:"
    echo "   - Guide complet: docs/memoir/GUIDE_CAPTURES_ECRAN.md"
    echo "   - README exemples: app/(dashboard)/examples/yield-prediction/README.md"
    exit 0
else
    echo -e "${RED}❌ Setup incomplet. Corriger les erreurs ci-dessus.${NC}"
    exit 1
fi
