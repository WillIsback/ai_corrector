# LanguageTool-Enhanced AI Corrector - Design Spec

## 1. Overview

Add LanguageTool (LT) as a rule-based pre/post-corrector to the existing AI Corrector app. LT runs locally via Docker and acts as a fast grammar/spell checker to catch LLM under-corrections (e.g., missing plural 's' on nouns).

### 1.1 Goals
- **Post-fire guard-rail**: Catch LLM under-corrections
- **Pre-fire enhancement**: Clean obvious errors before LLM inference
- **Visual debugging**: Differentiate LLM vs LT corrections in diff view
- **Reliability**: LLM required; LT is an enhancement layer

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Port 25000)                        │
│                                                                      │
│   Input ──► Pre-fire LT ──► LLM ──► Post-fire LT ──► Final Output   │
│             (~50-100ms)      API        (~50-100ms)                 │
│                                                                      │
│   Diff View: 🔵 LLM corrections  🟠 LT corrections  ⬜ Unchanged   │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LLM API (localhost:30000)                              │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LanguageTool (localhost:3001)                          │
│              Self-hosted via Docker                                 │
│              Checked on startup; shows setup guide if missing      │
└─────────────────────────────────────────────────────────────────────┘
```

## 3. Pipeline Flow

### 3.1 Sequential Pipeline

```
User Input
    │
    ▼
┌────────────────────────┐
│   Pre-fire LT Check    │  POST http://localhost:3001/v2/check
│   - Grammar/spell       │  { text, language: "fr" }
│   - Punctuation        │
│   - Basic syntax       │  Returns: matches[]
└────────────┬───────────┘
             │ Cleaned text (auto-fixed matches)
             ▼
┌────────────────────────┐
│      LLM Inference     │  POST localhost:30000/v1/chat/completions
│   - Style refinement    │  { messages, temperature: 0.3 }
│   - Context-aware       │
│   - Tone preservation   │
└────────────┬───────────┘
             │ LLM-corrected text
             ▼
┌────────────────────────┐
│  Post-fire LT Check    │  POST http://localhost:3001/v2/check
│   - Guard-rail         │  { text, language: "fr" }
│   - Catch under-corr   │
│   - Safety net         │
└────────────┬───────────┘
             │ Final corrected text
             ▼
      Final Output
```

### 3.2 Priority Rule
When LT and LLM disagree, **LT wins** — LT's rule-based check is authoritative for grammar/spelling.

## 4. LanguageTool API Integration

### 4.1 API Call
```
POST http://localhost:3001/v2/check
Content-Type: application/json

{
  "text": "Le texte à corriger",
  "language": "fr"
}
```

### 4.2 Response Structure
```ts
interface LTResponse {
  matches: LTMatches[];
}

interface LTMatches {
  message: string;        // e.g., "Missing plural form"
  shortMessage: string;   // e.g., "Agreement error"
  offset: number;        // character position
  length: number;        // length of error
  replacements: string[];
  rule: { id: string; };
}
```

### 4.3 Auto-fix Behavior
- Apply all matches where `replacements.length > 0`
- Skip matches with no suggested replacements
- Sort by offset descending (fix from end to start to preserve positions)

## 5. Diff View Model

```ts
type CorrectionSource = 'llm' | 'lt_pre' | 'lt_post';
type DiffChunkType = 'unchanged' | 'added' | 'removed' | 'modified';

interface DiffChunk {
  type: DiffChunkType;
  text: string;
  source?: CorrectionSource;  // undefined for unchanged
  ltMatchId?: string;         // for LT matches, for debugging
}
```

### 5.1 Visual Styling
| Source | Color | Tailwind Class |
|--------|-------|----------------|
| LLM corrections | Blue | `text-blue-500` |
| LT corrections | Orange | `text-orange-500` |
| Unchanged | Gray | `text-gray-500` |
| Removals | Red | `line-through text-red-500` |

## 6. Error Handling & Startup Detection

### 6.1 Startup Check
1. Check LT: `GET http://localhost:3001/v2/languages`
2. If fails → show setup banner with Docker command:
   ```bash
   docker run --rm -p 3001:3001 erik.UUID/languagetool:latest
   ```

### 6.2 Runtime Error Behavior
| Error | Behavior |
|-------|----------|
| LT pre-fire fails | Skip pre-fire, continue with LLM only, log warning |
| LLM fails | Show error toast, stop pipeline |
| LT post-fire fails | Skip post-fire, return LLM output, log warning |
| All fail | Show error with retry button |

## 7. Settings

New settings (localStorage persistence):
| Setting | Default | Description |
|---------|---------|-------------|
| `ltEnabled` | `true` | Toggle LT enhancement entirely |
| `ltPreFire` | `true` | Pre-fire correction before LLM |
| `ltPostFire` | `true` | Post-fire guard-rail after LLM |

## 8. File Changes

### 8.1 New Files
- `src/services/languagetool.ts` — LT API client with auto-fix logic
- `src/hooks/useLanguageTool.ts` — LT connection check hook

### 8.2 Modified Files
- `src/hooks/useCorrector.ts` — integrate pre/post LT pipeline
- `src/utils/diff.ts` — include source info in diff chunks
- `src/components/Output.tsx` — apply source-based coloring
- `src/components/Sidebar.tsx` — add LT settings toggles

### 8.3 Docker Setup
No changes to app code. User runs LT manually:
```bash
docker run --rm -p 3001:3001 erik.UUID/languagetool:latest
```

## 9. Performance Considerations

- LT inference: ~50-100ms per check
- Total LT overhead: ~100-200ms (pre + post)
- Non-blocking: LT runs sequentially, adds to total latency
- Target total latency: < 5s for typical inputs
