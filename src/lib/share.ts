import { toast } from '../components/Toasts'

/** Формат времени м:сс,д */
export function formatTime(ms: number): string {
  const total = Math.max(0, ms) / 1000
  const m = Math.floor(total / 60)
  const s = total - m * 60
  const sec = s.toFixed(1).replace('.', ',')
  return `${m}:${s < 10 ? '0' : ''}${sec}`
}

/** Поделиться ссылкой: Web Share API на телефоне, копирование на ПК. */
export async function shareLink(url: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
  const coarse = window.matchMedia('(pointer: coarse)').matches
  if (nav.share && coarse) {
    try {
      await nav.share({ title: document.title, text, url })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'failed'
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`)
    toast({ title: 'Ссылка скопирована', text: 'Отправь её другу в мессенджере', tone: 'violet' })
    return 'copied'
  } catch {
    // запасной вариант для старых браузеров
    const ta = document.createElement('textarea')
    ta.value = `${text} ${url}`
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    if (ok) toast({ title: 'Ссылка скопирована', tone: 'violet' })
    return ok ? 'copied' : 'failed'
  }
}
