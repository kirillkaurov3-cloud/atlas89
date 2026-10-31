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

/** Полный адрес сайта для Open Graph (превью ссылки в мессенджерах требует абсолютный URL). */
function siteUrl(base: string): string {
  if (process.env.VITE_SITE_URL) return process.env.VITE_SITE_URL
  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0]
  return owner ? `https://${owner.toLowerCase()}.github.io${base}` : base
}

const base = resolveBase()

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: 'site-url',
      transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl(base)),
    },
  ],
  build: {
    target: 'es2020',
    cssTarget: ['chrome90', 'safari14', 'firefox90'],
    assetsInlineLimit: 0,
  },
})
