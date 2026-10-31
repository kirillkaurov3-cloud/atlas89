import s from './Background.module.css'

/** Глубокий фон с тремя размытыми цветными пятнами, медленно плавающими. */
/** На экранах с картой пятна замирают: стекло над движущимся фоном пришлось бы размывать каждый кадр. */
export function Background({ animated = true }: { animated?: boolean }) {
  return (
    <div className={`${s.root} ${animated ? '' : s.still}`} aria-hidden="true">
      <div className={`${s.blob} ${s.a}`} />
      <div className={`${s.blob} ${s.b}`} />
      <div className={`${s.blob} ${s.c}`} />
      <div className={s.grain} />
    </div>
  )
}
