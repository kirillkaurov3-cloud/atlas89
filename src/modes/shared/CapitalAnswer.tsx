import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { suggestCapitals } from '../../lib/quiz'
import s from './Quiz.module.css'

interface ChoicesProps {
  options: string[]
  /** выбранный вариант (после ответа) */
  chosen: string | null
  /** правильный вариант (показывается после ответа) */
  correct: string | null
  onPick: (value: string) => void
  disabled?: boolean
}

/** 4 крупные кнопки вариантов (горячие клавиши 1–4). */
export function Choices({ options, chosen, correct, onPick, disabled }: ChoicesProps) {
  const answered = correct != null
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled || answered) return
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const i = Number(e.key) - 1
      if (i >= 0 && i < options.length) {
        e.preventDefault()
        onPick(options[i])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [options, onPick, disabled, answered])

  return (
    <div className={s.choices} role="group" aria-label="Варианты ответа">
      {options.map((o, i) => {
        const state = !answered ? '' : o === correct ? s.right : o === chosen ? s.wrong : s.faded
        return (
          <motion.button
            key={o}
            className={`${s.choice} ${state}`}
            onClick={() => !answered && !disabled && onPick(o)}
            initial={{ opacity: 0, y: 12 }}
            animate={o === chosen && o !== correct ? { opacity: 1, y: 0, x: [0, -8, 8, -6, 6, 0] } : { opacity: 1, y: 0 }}
            transition={{ delay: answered ? 0 : i * 0.04, type: 'spring', stiffness: 420, damping: 30 }}
            whileTap={!answered ? { scale: 0.96 } : undefined}
            aria-keyshortcuts={String(i + 1)}
          >
            <span className="kbd" aria-hidden="true">
              {i + 1}
            </span>
            <span className={s.choiceText}>{o}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

interface TypingProps {
  onSubmit: (value: string) => void
  /** после ответа: правильно ли и правильный ответ */
  result: { ok: boolean; correct: string } | null
}

/** Ввод столицы с клавиатуры с автодополнением. */
export function CapitalTyping({ onSubmit, result }: TypingProps) {
  const [value, setValue] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const sugg = result ? [] : suggestCapitals(value, 4)

  useEffect(() => {
    input.current?.focus({ preventScroll: true })
  }, [])

  const submit = (v: string) => {
    if (result || !v.trim()) return
    onSubmit(v)
  }

  return (
    <div className={s.typing}>
      <form
        className={`glass ${s.typeField} ${result ? (result.ok ? s.right : s.wrong) : ''}`}
        onSubmit={(e) => {
          e.preventDefault()
          submit(sugg[active] && value.length >= 2 ? sugg[active] : value)
        }}
      >
        <input
          ref={input}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, Math.max(0, sugg.length - 1)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            }
          }}
          placeholder="Столица…"
          aria-label="Введите столицу"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          disabled={!!result}
        />
        <button className="btn btn-primary" type="submit" disabled={!!result || !value.trim()}>
          OK
        </button>
      </form>
      {result && !result.ok && (
        <p className={s.correction}>
          Правильно: <strong>{result.correct}</strong>
        </p>
      )}
      {sugg.length > 0 && value.length >= 1 && (
        <ul className={s.suggest} role="listbox">
          {sugg.map((c, i) => (
            <li key={c}>
              <button
                type="button"
                className={i === active ? s.suggestActive : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit(c)}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
