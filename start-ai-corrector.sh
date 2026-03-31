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

# AI Corrector (Bun server on port 25000)
start_ai_corrector() {
  log "Starting AI Corrector (Bun server on port 25000)..."

  # Build if dist doesn't exist
  if [ ! -d "$SCRIPT_DIR/dist" ]; then
    log "Building..."
    cd "$SCRIPT_DIR" && npm run build
  fi

  # Kill existing process on port 25000
  pkill -f "bun.*server.ts" 2>/dev/null || true
  pkill -f "serve.*dist.*25000" 2>/dev/null || true
  sleep 1

  # Start Bun server
  cd "$SCRIPT_DIR"
  export PATH="$HOME/.bun/bin:$PATH"
  nohup bun run server.ts > "$LOG_DIR/ai-corrector.log" 2>&1 &

  sleep 2
  if curl -sf http://localhost:25000/corrector/api/valid-words > /dev/null 2>&1; then
    log "AI Corrector started on http://localhost:25000"
  else
    warn "AI Corrector may not be ready yet, check $LOG_DIR/ai-corrector.log"
  fi
}

# Main
case "${1:-all}" in
  lt|languagetool)
    start_languagetool
    ;;
  app|ai-corrector)
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
