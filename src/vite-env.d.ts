/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL проекта Supabase (Project Settings → API). Пусто — таблица лидеров выключена. */
  readonly VITE_SUPABASE_URL?: string
  /** Публичный anon key Supabase. Пусто — таблица лидеров выключена. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
