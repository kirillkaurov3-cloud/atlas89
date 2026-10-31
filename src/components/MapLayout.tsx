import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { navigate } from '../lib/router'
import s from './MapLayout.module.css'

interface Props {
  title: string
  /** Справа в шапке */
  headerRight?: ReactNode
  /** Плашка с вопросом / поиском (сверху на мобильном, в панели на ПК) */
  top?: ReactNode
  map: ReactNode
  insets?: ReactNode
  /** Нижняя часть (кнопки в зоне большого пальца) / правая панель на ПК */
  panel?: ReactNode
  onBack?: () => void
}

/** Общий каркас экранов с картой: мобильный — колонка, ПК — карта слева, панель справа. */
export function MapLayout({ title, headerRight, top, map, insets, panel, onBack }: Props) {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <button className="icon-btn" aria-label="Назад" onClick={onBack ?? (() => navigate('/'))}>
          <Icon name="back" size={20} />
        </button>
        <h1 className={s.title}>{title}</h1>
        <div className={s.headerRight}>{headerRight}</div>
      </header>
      {top && <div className={s.top}>{top}</div>}
      <main className={`glass ${s.map}`}>{map}</main>
      {insets && <div className={s.insets}>{insets}</div>}
      {panel && <div className={s.panel}>{panel}</div>}
    </div>
  )
}
