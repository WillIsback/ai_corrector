#!/bin/bash
# AI Corrector + LanguageTool Startup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/home/wderue/logs"
mkdir -p "$LOG_DIR"

# Colors
G='\033[0;32m'
R='\033[0;31m'
Y='\033[0;33m'
N='\033[0m'

log() { echo -e "${G}[$(date '+%H:%M:%S')]${N} $*"; }
warn() { echo -e "${Y}[$(date '+%H:%M:%S')] WARN:${N} $*"; }
error() { echo -e "${R}[$(date '+%H:%M:%S')] ERROR:${N} $*"; }

# LanguageTool Docker
start_languagetool() {
  log "Starting LanguageTool..."
  cd "$SCRIPT_DIR"
  docker compose up -d languagetool
}

# AI Corrector (production build)
start_ai_corrector() {
  log "Starting AI Corrector..."
  
  # Kill existing process
  pkill -f "serve.*dist.*25000" 2>/dev/null || true
  sleep 1
  
  # Start serve in background
  nohup npx serve -s "$SCRIPT_DIR/dist" -l 25000 > "$LOG_DIR/ai-corrector.log" 2>&1 &
  
  log "AI Corrector started on port 25000"
}

# Main
case "${1:-all}" in
  lt| languagetool)
    start_languagetool
    ;;
  app| ai-corrector)
    start_ai_corrector
    ;;
  all)
    start_languagetool
    start_ai_corrector
    ;;
  *)
    echo "Usage: $0 [lt|app|all]"
    exit 1
    ;;
esac

log "Done!"