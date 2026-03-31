# AI Corrector Production Setup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Préparer AI Corrector pour la production avec Biome linting/formatting, build, script de démarrage et intégration à doctor

**Architecture:** 
- Installer Biome pour linting et formatting
- Exécuter les checks et corriger les erreurs
- Build l'application pour production
- Créer script de démarrage pour AI Corrector + LanguageTool
- Ajouter les services au binaire doctor avec --fix

**Tech Stack:** Biome, Vite, Bash, Docker

---

### Task 1: Install Biome and configure

**Files:**
- Modify: `package.json`
- Create: `biome.json`

- [ ] **Step 1: Add Biome to devDependencies**

```bash
cd /home/wderue/workspace/ai_corrector && npm install -D @biomejs/biome
```

- [ ] **Step 2: Create biome.json configuration**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

- [ ] **Step 3: Add Biome scripts to package.json**

```json
"scripts": {
  "lint": "biome lint .",
  "format": "biome format --write .",
  "check": "biome check ."
}
```

- [ ] **Step 4: Commit**

---

### Task 2: Run Biome checks and fix issues

**Files:**
- Modify: `{src files}`

- [ ] **Step 1: Run Biome check to see all issues**

```bash
cd /home/wderue/workspace/ai_corrector && npm run check
```

- [ ] **Step 2: Apply automatic fixes**

```bash
cd /home/wderue/workspace/ai_corrector && npm run format && npm run check -- --write
```

- [ ] **Step 3: Review remaining issues and fix manually if any**

- [ ] **Step 4: Run build to verify**

```bash
cd /home/wderue/workspace/ai_corrector && npm run build
```

- [ ] **Step 5: Commit**

---

### Task 3: Create startup script for AI Corrector + LanguageTool

**Files:**
- Create: `/home/wderue/workspace/ai_corrector/start-ai-corrector.sh`

- [ ] **Step 1: Create startup script**

```bash
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
```

- [ ] **Step 2: Make script executable**

```bash
chmod +x /home/wderue/workspace/ai_corrector/start-ai-corrector.sh
```

- [ ] **Step 3: Test startup script**

```bash
/home/wderue/workspace/ai_corrector/start-ai-corrector.sh all
```

- [ ] **Step 4: Verify services**

```bash
ss -tlnp | grep -E "25000|3002"
```

- [ ] **Step 5: Commit**

---

### Task 4: Add AI Corrector services to doctor binary

**Files:**
- Modify: `/home/wderue/.local/bin/doctor`

- [ ] **Step 1: Add AI Corrector and LanguageTool to fix_service function**

Find the `fix_service` function and add:

```bash
    "AI Corrector")
      pkill -f "serve.*dist.*25000" 2>/dev/null || true
      sleep 1
      nohup npx serve -s /home/wderue/workspace/ai_corrector/dist -l 25000 > /home/wderue/logs/ai-corrector.log 2>&1 &
      ;;
    "LanguageTool")
      cd /home/wderue/workspace/ai_corrector && docker compose up -d languagetool
      ;;
```

- [ ] **Step 2: Add services to health check section**

Add after the existing services:

```bash
# AI Corrector — served statically
print_service "AI Corrector" "http://localhost:25000" "AI corrector app" "25000"

# LanguageTool
print_service "LanguageTool" "http://localhost:3002/v2/languages" "Grammar checker" "3002"
```

- [ ] **Step 3: Test doctor with new services**

```bash
doctor
```

- [ ] **Step 4: Test --fix flag**

```bash
doctor --fix
```

- [ ] **Step 5: Commit**

---

### Task 5: Final verification

**Files:**
- Verify all changes

- [ ] **Step 1: Verify production build works**

```bash
cd /home/wderue/workspace/ai_corrector && npm run build
ls -la dist/
```

- [ ] **Step 2: Verify doctor shows new services**

```bash
doctor --full | grep -E "AI Corrector|LanguageTool"
```

- [ ] **Step 3: Verify --fix restarts services**

```bash
pkill -f "serve.*dist.*25000"
sleep 1
doctor --fix
sleep 2
curl -s -o /dev/null -w '%{http_code}' http://localhost:25000
```

- [ ] **Step 4: Commit final changes**

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Install Biome, configure, add scripts |
| 2 | Run checks, fix issues, verify build |
| 3 | Create startup script for AI Corrector + LT |
| 4 | Add services to doctor binary |
| 5 | Final verification |
