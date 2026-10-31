import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// На GitHub Pages сайт живёт по адресу https://<user>.github.io/<repo>/,
// поэтому base должен совпадать с именем репозитория. В GitHub Actions
// имя берётся из переменной GITHUB_REPOSITORY автоматически.
function resolveBase(): string {
  if (process.env.VITE_BASE) return process.env.VITE_BASE
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (!repo) return '/'
  // Репозиторий вида <user>.github.io публикуется в корень домена
  if (repo.endsWith('.github.io')) return '/'
  return `/${repo}/`
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
})
