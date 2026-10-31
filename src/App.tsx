import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Suspense, type ReactNode } from 'react'
import { Background } from './components/Background'
import { useRoute } from './lib/router'
import { useThemeEffect } from './lib/theme'
import { HomeScreen } from './screens/HomeScreen'
import { Placeholder } from './screens/Placeholder'
import { Reference } from './screens/Reference'
import { Board } from './modes/board/Board'
import { Capture } from './modes/capture/Capture'
import { Toasts } from './components/Toasts'

function screenFor(path: string): ReactNode {
  switch (path) {
    case '/':
      return <HomeScreen />
    case '/board':
      return <Board />
    case '/capture':
      return <Capture />
    case '/speedrun':
    case '/challenge':
      return <Placeholder title="Спидран 89" />
    case '/reference':
      return <Reference />
    case '/stats':
      return <Placeholder title="Статистика" />
    case '/settings':
      return <Placeholder title="Настройки" />
    default:
      return <HomeScreen />
  }
}


export default function App() {
  useThemeEffect()
  const route = useRoute()
  return (
    <MotionConfig reducedMotion="user">
      <Background />
      <Toasts />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={route.path}
          className="screen"
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.99 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.8 }}
          style={{ position: 'relative', zIndex: 1, minHeight: '100%' }}
        >
          <Suspense fallback={null}>{screenFor(route.path)}</Suspense>
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  )
}
