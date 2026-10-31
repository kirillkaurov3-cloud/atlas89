import q from '../modes/shared/Quiz.module.css'

/** Сегментированный переключатель (кнопки-«таблетки»). */
export function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { v: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className={q.seg} role="group">
      {options.map((o) => (
        <button key={String(o.v)} className={q.segBtn} aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
