# AI Corrector

Correcteur et reformateur de rédaction en français alimenté par LLM.

## Pré-requis

- Node.js 18+
- LLM API compatible OpenAI sur localhost:30000

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

L'application est accessible sur http://localhost:25000

## Build

```bash
npm run build
npx serve -s dist -l 25000
```

## Configuration

L'application se connecte à un LLM compatible OpenAI API sur `http://localhost:30000`.

## Fonctionnalités

- Correction complète (grammaire, orthographe, syntaxe, style)
- 4 modes de correction (Formel, Semi-formel, Informel, Technical)
- Diff view pour visualiser les modifications
- Persistancy des préférences
- Thème auto (dark/light)
- Toast notifications
