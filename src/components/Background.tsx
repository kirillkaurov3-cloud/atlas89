import s from './Background.module.css'

/** Глубокий фон с тремя размытыми цветными пятнами, медленно плавающими. */
export function Background() {
  return (
    <div className={s.root} aria-hidden="true">
      <div className={`${s.blob} ${s.a}`} />
      <div className={`${s.blob} ${s.b}`} />
      <div className={`${s.blob} ${s.c}`} />
      <div className={s.grain} />
    </div>
  )
}
