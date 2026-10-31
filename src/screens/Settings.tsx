import { useRef, useState } from 'react'
import { REGION_BY_ID } from '../data/regions'
import { APP_NAME } from '../config'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { toast } from '../components/Toasts'
import { exportProgress, importProgress } from '../lib/backup'
import { navigate } from '../lib/router'
import { resetState, updateProfile, updateSettings, useStore, type Settings as S } from '../lib/store'
import { Seg } from '../components/Seg'
import s from './Settings.module.css'

const DISPUTED = ['moscow-oblast', 'leningrad', 'zaporozhye', 'kherson']

export function Settings() {
  const settings = useStore((st) => st.settings)
  const nickname = useStore((st) => st.profile.nickname)
  const [nick, setNick] = useState(nickname ?? '')
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const saveNick = () => {
    const v = nick.trim().slice(0, 20)
    if (v && v.length < 2) return toast({ title: 'Ник — от 2 символов', tone: 'coral' })
    updateProfile({ nickname: v || null, nickAsked: true })
    toast({ title: v ? `Привет, ${v}!` : 'Ник удалён', tone: 'violet', ttl: 1800 })
  }

  return (
    <div className={s.page}>
      <header className={s.head}>
        <button className="icon-btn" aria-label="Назад" onClick={() => navigate('/')}>
          <Icon name="back" size={20} />
        </button>
        <h1>Настройки</h1>
      </header>

      <Section title="Профиль">
        <form
          className={s.row}
          onSubmit={(e) => {
            e.preventDefault()
            saveNick()
          }}
        >
          <input
            className={s.input}
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="Ник (необязательно)"
            maxLength={20}
            aria-label="Ник"
          />
          <button className="btn btn-ghost" type="submit">
            Сохранить
          </button>
        </form>
        <p className={s.note}>Используется в ссылке-вызове и таблице лидеров.</p>
      </Section>

      <Section title="Оформление">
        <Label>Тема</Label>
        <Seg
          value={settings.theme}
          options={[
            { v: 'system' as const, label: 'Как в системе' },
            { v: 'dark' as const, label: 'Тёмная' },
            { v: 'light' as const, label: 'Светлая' },
          ]}
          onChange={(v) => updateSettings({ theme: v })}
        />
        <Label>Карта</Label>
        <Seg
          value={settings.mapStyle}
          options={[
            { v: 'study' as const, label: 'Учебная' },
            { v: 'board' as const, label: 'Как на доске' },
          ]}
          onChange={(v) => updateSettings({ mapStyle: v })}
        />
        <Label>Врезки с мелкими регионами</Label>
        <Seg
          value={settings.insetsCollapsed ? 'off' : 'on'}
          options={[
            { v: 'on' as const, label: 'Показывать' },
            { v: 'off' as const, label: 'Свернуть' },
          ]}
          onChange={(v) => updateSettings({ insetsCollapsed: v === 'off' })}
        />
      </Section>

      <Section title="Режим «У доски»">
        <Label>Таймер на поиск региона</Label>
        <Seg
          value={settings.timerSec}
          options={[
            { v: 5 as const, label: '5 с' },
            { v: 7 as const, label: '7 с' },
            { v: 10 as const, label: '10 с' },
            { v: 0 as const, label: 'Без таймера' },
          ]}
          onChange={(v) => updateSettings({ timerSec: v as S['timerSec'] })}
        />
        <Label>Ответ на «Назови столицу»</Label>
        <Seg
          value={settings.capitalInput}
          options={[
            { v: 'choice' as const, label: '4 варианта' },
            { v: 'typing' as const, label: 'Ввод с клавиатуры' },
          ]}
          onChange={(v) => updateSettings({ capitalInput: v })}
        />
      </Section>

      <Section title="Какую столицу считать правильной">
        <p className={s.note} style={{ marginTop: 0, marginBottom: 12 }}>
          Учителя спрашивают по-разному. Выбранный вариант показывается как ответ, но второй тоже засчитывается.
        </p>
        <div className={s.capList}>
          {DISPUTED.map((id) => {
            const r = REGION_BY_ID[id]
            const pref = settings.capitalPrefs[id] ?? 'main'
            return (
              <div key={id} className={s.capRow}>
                <div className={s.capName}>
                  {r.name}
                  <span>{r.capitalNote}</span>
                </div>
                <Seg
                  value={pref}
                  options={[
                    { v: 'main' as const, label: r.capital! },
                    { v: 'alt' as const, label: r.capitalAlt! },
                  ]}
                  onChange={(v) => updateSettings({ capitalPrefs: { ...settings.capitalPrefs, [id]: v } })}
                />
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Прогресс">
        <div className={s.actions}>
          <button className="btn btn-ghost" onClick={exportProgress}>
            <Icon name="download" size={18} /> Экспорт в файл
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> Импорт из файла
          </button>
          <button className={`btn ${s.danger}`} onClick={() => setConfirmReset(true)}>
            <Icon name="trash" size={18} /> Сбросить прогресс
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              await importProgress(f)
              toast({ title: 'Прогресс загружен', tone: 'lime' })
            } catch (err) {
              toast({ title: 'Не получилось', text: (err as Error).message, tone: 'coral' })
            }
          }}
        />
        <p className={s.note}>Прогресс хранится только в этом браузере. Сохрани файл, чтобы перенести его на другое устройство.</p>
      </Section>

      <Section title="О приложении">
        <p className={s.about}>
          {APP_NAME} — тренажёр к зачёту по географии: 89 субъектов РФ и их столицы.
          <br />
          Границы: © участники{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{' '}
          (ODbL) через{' '}
          <a href="https://github.com/hairymax/offline_russia_plotly" target="_blank" rel="noreferrer">
            offline_russia_plotly
          </a>
          ;{' '}
          <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">
            Natural Earth
          </a>{' '}
          (общественное достояние).
        </p>
      </Section>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Сбросить прогресс?">
        <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>
          Удалятся захваченные регионы, статистика, ачивки и рекорды. Настройки и ник останутся. Это нельзя отменить — сначала можно сделать экспорт.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button
            className={`btn ${s.dangerSolid}`}
            onClick={() => {
              resetState()
              setConfirmReset(false)
              toast({ title: 'Прогресс сброшен', tone: 'coral' })
            }}
          >
            Да, сбросить
          </button>
          <button className="btn btn-ghost" onClick={() => setConfirmReset(false)} autoFocus>
            Отмена
          </button>
        </div>
      </Modal>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`glass ${s.section}`}>
      <h2 className={s.title}>{title}</h2>
      {children}
    </section>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className={s.label}>{children}</div>
}
