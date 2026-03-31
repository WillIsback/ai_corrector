#!/bin/bash

echo "🚀 Démarrage AI Corrector..."

# Démarrer LanguageTool
echo "📦 Démarrage LanguageTool..."
docker compose up -d

# Attendre que LT soit prêt
echo "⏳ Attente que LanguageTool soit prêt..."
sleep 5

# Lancer le serveur de développement
echo "🎮 Démarrage du serveur de développement..."
npm run dev