import { useEffect, useRef } from 'react'

interface Props {
  className?: string
  /** Wave travel speed. Default 1. */
  speed?: number
  /** Dot base color as [r, g, b] 0-255. Default zinc-600 #52525b → [82,82,91]. */
  color?: [number, number, number]
  /** Mask: fade toward edges from center (default true). */
  radialFade?: boolean
}

const SPACING = 28
const DOT_R = 1

export function DotGrid({ className, speed = 1, color = [82, 82, 91], radialFade = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let t = 0

    function resize() {
      const pr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * pr
      canvas.height = canvas.offsetHeight * pr
      ctx.scale(pr, pr)
    }

    function draw() {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      ctx.clearRect(0, 0, W, H)

      const cx = W / 2
      const cy = H / 2
      const cols = Math.ceil(W / SPACING) + 2
      const rows = Math.ceil(H / SPACING) + 2

      const [r, g, b] = color

      for (let ri = 0; ri < rows; ri++) {
        for (let ci = 0; ci < cols; ci++) {
          const x = ci * SPACING
          const y = ri * SPACING

          // Primary: radial wave expanding from center
          const dx = x - cx
          const dy = y - cy
          const dist = Math.sqrt(dx * dx + dy * dy)
          const radialWave = Math.sin(dist * 0.018 - t * speed * 1.6) * 0.5 + 0.5

          // Secondary: slow cross-grid interference
          const xWave = Math.sin(x * 0.022 + t * speed * 0.5) * 0.15
          const yWave = Math.cos(y * 0.018 - t * speed * 0.4) * 0.15

          let alpha = radialWave * 0.75 + xWave + yWave + 0.05

          // Radial edge fade
          if (radialFade) {
            const normDist = dist / Math.max(W, H) / 0.5
            const fade = Math.max(0, 1 - normDist * normDist * 1.4)
            alpha *= fade
          }

          alpha = Math.max(0, Math.min(1, alpha))
          if (alpha < 0.01) continue

          ctx.beginPath()
          ctx.arc(x, y, DOT_R, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`
          ctx.fill()
        }
      }

      t += 0.016
      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [speed, color, radialFade])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
