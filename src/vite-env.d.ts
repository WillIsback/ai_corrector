interface ImportMetaEnv {
  readonly VITE_LLM_API_BASE_URL?: string;
  readonly VITE_LLM_API_PATH?: string;
  readonly VITE_LLM_MODEL_NAME?: string;
  readonly VITE_LT_API_BASE?: string;
  readonly PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
