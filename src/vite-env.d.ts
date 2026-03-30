interface ImportMetaEnv {
  readonly VITE_LLM_API_BASE_URL?: string
  readonly VITE_LLM_API_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
