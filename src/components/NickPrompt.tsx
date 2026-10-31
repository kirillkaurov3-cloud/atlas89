import { useEffect, useState } from 'react'
import { useStats } from '../lib/progress'
import { updateProfile, useStore } from '../lib/store'
import { Modal } from './Modal'

/** Мягко спрашивает ник один раз — после первого пройденного раунда. Можно пропустить. */
export function NickPrompt() {
  const profile = useStore((s) => s.profile)
  const stats = useStats()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const should = !profile.nickAsked && !profile.nickname && stats.sessions.length > 0

  useEffect(() => {
    if (!should) return
    const t = setTimeout(() => setOpen(true), 900)
    return () => clearTimeout(t)
  }, [should])

  const close = (nick: string | null) => {
    updateProfile({ nickAsked: true, ...(nick ? { nickname: nick } : {}) })
    setOpen(false)
  }

  const v = value.trim()
  return (
    <Modal open={open} onClose={() => close(null)} title="Как тебя зовут?">
      <p style={{ color: 'var(--text-dim)', marginBottom: 14 }}>
        Ник подпишет твои ссылки-вызовы друзьям. Необязательно — можно пропустить и указать потом в настройках.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (v.length >= 2) close(v.slice(0, 20))
        }}
        style={{ display: 'grid', gap: 10 }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Например, Кирилл"
          maxLength={20}
          autoFocus
          aria-label="Ник"
          style={{
            height: 50,
            padding: '0 18px',
            borderRadius: 999,
            border: '1px solid var(--stroke-strong)',
            background: 'var(--glass-strong)',
            color: 'var(--text)',
            font: 'inherit',
            fontSize: 17,
            fontWeight: 700,
            outline: 'none',
          }}
        />
        <button className="btn btn-primary" type="submit" disabled={v.length < 2}>
          Готово
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => close(null)}>
          Пропустить
        </button>
      </form>
    </Modal>
  )
}
