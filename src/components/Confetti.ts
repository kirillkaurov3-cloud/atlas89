/**
 * Конфетти из маленьких «полигонов-регионов» (неровные 4–7-угольники).
 * Рисуется на canvas поверх всего, без React — дёшево и 60 fps.
 */
const COLORS = ['#C6FF3D', '#7C5CFF', '#FFC04D', '#3DD6FF', '#FF5C7A', '#A18CFF']

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  color: string
  shape: number[]
  life: number
}

let canvas: HTMLCanvasElement | null = null
let pieces: Piece[] = []
let raf = 0

function ensureCanvas() {
  if (canvas) return canvas
  canvas = document.createElement('canvas')
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '300' })
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)
  return canvas
}

function randomShape(): number[] {
  const n = 4 + Math.floor(Math.random() * 4)
  const pts: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5
    const r = 0.55 + Math.random() * 0.45
    pts.push(Math.cos(a) * r, Math.sin(a) * r)
  }
  return pts
}

export function burstConfetti(count = 70) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const c = ensureCanvas()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  c.width = innerWidth * dpr
  c.height = innerHeight * dpr
  const cx = innerWidth / 2
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6
    const sp = 6 + Math.random() * 9
    pieces.push({
      x: cx + (Math.random() - 0.5) * 80,
      y: 70,
      vx: Math.cos(ang) * sp * (Math.random() < 0.5 ? -1 : 1) * 0.7,
      vy: Math.sin(ang) * sp * -0.3 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      size: 5 + Math.random() * 7,
      color: COLORS[i % COLORS.length],
      shape: randomShape(),
      life: 0,
    })
  }
  if (!raf) raf = requestAnimationFrame(step)
}

function step() {
  const c = canvas!
  const ctx = c.getContext('2d')!
  const dpr = c.width / innerWidth
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, innerWidth, innerHeight)
  for (const p of pieces) {
    p.life++
    p.vy += 0.28
    p.vx *= 0.985
    p.x += p.vx
    p.y += p.vy
    p.rot += p.vr
    const alpha = Math.max(0, 1 - p.life / 110)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.scale(p.size, p.size * (0.6 + 0.4 * Math.abs(Math.cos(p.life * 0.15))))
    ctx.beginPath()
    for (let i = 0; i < p.shape.length; i += 2) {
      if (i === 0) ctx.moveTo(p.shape[i], p.shape[i + 1])
      else ctx.lineTo(p.shape[i], p.shape[i + 1])
    }
    ctx.closePath()
    ctx.fillStyle = p.color
    ctx.fill()
    ctx.restore()
  }
  pieces = pieces.filter((p) => p.life < 110 && p.y < innerHeight + 40)
  if (pieces.length) raf = requestAnimationFrame(step)
  else {
    raf = 0
    ctx.clearRect(0, 0, innerWidth, innerHeight)
  }
}
