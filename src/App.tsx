import { AnimatePresence, domAnimation, LazyMotion, m as motion, MotionConfig } from 'framer-motion'
import { lazy, Suspense, type ReactNode } from 'react'
import { Background } from './components/Background'
import { useRoute } from './lib/router'
import { useThemeEffect } from './lib/theme'
import { HomeScreen } from './screens/HomeScreen'
import { Toasts } from './components/Toasts'

const Reference = lazy(() => import('./screens/Reference').then((m) => ({ default: m.Reference })))
const Board = lazy(() => import('./modes/board/Board').then((m) => ({ default: m.Board })))
const Capture = lazy(() => import('./modes/capture/Capture').then((m) => ({ default: m.Capture })))
const Speedrun = lazy(() => import('./modes/speedrun/Speedrun').then((m) => ({ default: m.Speedrun })))
const Stats = lazy(() => import('./screens/Stats').then((m) => ({ default: m.Stats })))
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })))
const Neighbors = lazy(() => import('./modes/neighbors/Neighbors').then((m) => ({ default: m.Neighbors })))
const Leaderboard = lazy(() => import('./screens/Leaderboard').then((m) => ({ default: m.Leaderboard })))

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
      return <Speedrun />
    case '/reference':
      return <Reference />
    case '/stats':
      return <Stats />
    case '/neighbors':
      return <Neighbors />
    case '/leaderboard':
      return <Leaderboard />
    case '/settings':
      return <Settings />
    default:
      return <HomeScreen />
  }
}


export default function App() {
  useThemeEffect()
  const route = useRoute()
  return (
    <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">
      <Background animated={route.path === '/'} />
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
    </LazyMotion>
  )
}
