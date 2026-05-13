// SignatureStep — EEA1 form section D: statutory declaration + handwritten signature.
//
// STATUTORY WORDING (EEA 55/1998):
//   Verbatim text rendered in a <blockquote><strong> above the canvas. Do not
//   paraphrase, shorten, or split this string.
//
// PII RULES (non-negotiable):
//
//   1. signatureDataUrl never touches browser storage. The base64 PNG flows
//      directly from the canvas through onSubmit() to the server. There are
//      no localStorage / sessionStorage / IndexedDB writes anywhere in this
//      component.
//
//   2. declarationDate is computed ONCE via useMemo and rendered through a
//      `readOnly` HTML input. The server overwrites this value on insert
//      from `new Date().toISOString().split('T')[0]` to prevent backdating.
//
//   3. react-signature-canvas is not installed in apps/web. We render a
//      plain <canvas> and handle pointer events directly.

import {
  useRef,
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ReactElement,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '@/lib/utils'

export interface SignatureStepProps {
  /** EEA form instance identifier — present so the parent can scope the submit. */
  formId: string
  /**
   * Called once the user clicks "Sign and submit". Receives the base64
   * PNG data URL exported from the canvas. The caller is responsible for
   * POSTing the value through the consent-gated submit endpoint where the
   * KMS encryption middleware will encrypt it before insert.
   */
  onSubmit: (signatureDataUrl: string) => void
}

const CANVAS_HEIGHT_PX = 200
const STROKE_COLOR = '#0f172a' // slate-900
const STROKE_WIDTH = 2

const CANVAS_BOX = cn(
  'block w-full rounded-md border border-slate-300 bg-white',
  'touch-none select-none',
)

const BUTTON_PRIMARY = cn(
  'inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white',
  'hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
  'disabled:cursor-not-allowed disabled:bg-slate-300',
)

const BUTTON_SECONDARY = cn(
  'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700',
  'hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
)

const DATE_INPUT = cn(
  'block w-44 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500',
  'cursor-default focus:outline-none focus:ring-0',
)

export function SignatureStep({ formId, onSubmit }: SignatureStepProps): ReactElement {
  void formId // currently unused — exposed for the parent's scoping needs.

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(false)

  // Computed once on mount — the displayed date never changes during the
  // session. The server authoritatively re-derives this value on insert,
  // so any client-side drift is irrelevant.
  const declarationDate = useMemo<string>(
    () => new Date().toISOString().split('T')[0] as string,
    [],
  )

  // Size the canvas backing store to the rendered CSS width so strokes are
  // crisp on high-DPI displays. Re-run if the window resizes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return

    const sizeCanvas = (): void => {
      const cssWidth = canvas.clientWidth
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(cssWidth * dpr)
      canvas.height = Math.floor(CANVAS_HEIGHT_PX * dpr)
      const ctx = canvas.getContext('2d')
      if (ctx !== null) {
        ctx.scale(dpr, dpr)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = STROKE_COLOR
        ctx.lineWidth = STROKE_WIDTH
      }
    }

    sizeCanvas()
    window.addEventListener('resize', sizeCanvas)
    return () => {
      window.removeEventListener('resize', sizeCanvas)
    }
  }, [])

  const getCanvasPoint = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const canvas = canvasRef.current
      if (canvas === null) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    },
    [],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): void => {
      event.preventDefault()
      const canvas = canvasRef.current
      if (canvas === null) return
      canvas.setPointerCapture(event.pointerId)
      isDrawingRef.current = true
      lastPointRef.current = getCanvasPoint(event)
    },
    [getCanvasPoint],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): void => {
      if (!isDrawingRef.current) return
      const canvas = canvasRef.current
      const last = lastPointRef.current
      if (canvas === null || last === null) return

      const ctx = canvas.getContext('2d')
      if (ctx === null) return

      const point = getCanvasPoint(event)
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
      lastPointRef.current = point
      if (!hasInk) setHasInk(true)
    },
    [getCanvasPoint, hasInk],
  )

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): void => {
    isDrawingRef.current = false
    lastPointRef.current = null
    const canvas = canvasRef.current
    if (canvas !== null && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handleClear = useCallback((): void => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    // Reset transform before clearing so the full backing store is wiped,
    // then restore the DPR scale and stroke style.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const dpr = window.devicePixelRatio || 1
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = STROKE_COLOR
    ctx.lineWidth = STROKE_WIDTH
    setHasInk(false)
  }, [])

  const handleSubmit = useCallback((): void => {
    const canvas = canvasRef.current
    if (canvas === null || !hasInk) return
    const dataUrl = canvas.toDataURL('image/png')
    // dataUrl is passed directly to the parent. It is NEVER written to
    // localStorage, sessionStorage, or any other browser-side store.
    onSubmit(dataUrl)
  }, [hasInk, onSubmit])

  return (
    <section
      aria-labelledby="signature-step-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      data-testid="signature-step"
    >
      <h2 className="mb-4 text-base font-semibold text-slate-900" id="signature-step-heading">
        Declaration and signature
      </h2>

      {/* ---- Statutory declaration — verbatim wording, EEA 55/1998 ---- */}
      <blockquote
        className="mb-5 rounded-md border-l-4 border-slate-900 bg-slate-50 px-4 py-3 text-sm text-slate-900"
        data-testid="statutory-declaration"
      >
        <strong>
          I declare that the information furnished on this form is true and correct and that I am
          aware that furnishing false information is a contravention of the Employment Equity Act 55
          of 1998.
        </strong>
      </blockquote>

      {/* ---- Signature canvas ---- */}
      <div className="mb-4 flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="signature-canvas">
          Signature
        </label>
        <canvas
          aria-label="Signature canvas"
          className={CANVAS_BOX}
          data-testid="signature-canvas"
          id="signature-canvas"
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerLeave={handlePointerUp}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={canvasRef}
          style={{ width: '100%', height: CANVAS_HEIGHT_PX }}
        />
        <div className="flex justify-end">
          <button
            className={BUTTON_SECONDARY}
            data-testid="signature-clear"
            onClick={handleClear}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>

      {/* ---- Declaration date — display-only, server overwrites on insert ---- */}
      <div className="mb-5 flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700" htmlFor="declaration-date">
          Declaration date
        </label>
        <input
          className={DATE_INPUT}
          data-testid="declaration-date"
          id="declaration-date"
          readOnly
          type="date"
          value={declarationDate}
        />
        <p className="text-xs text-slate-400">
          Today&apos;s date is recorded by the system on submission.
        </p>
      </div>

      {/* ---- Submit ---- */}
      <div className="flex justify-end">
        <button
          className={BUTTON_PRIMARY}
          data-testid="signature-submit"
          disabled={!hasInk}
          onClick={handleSubmit}
          type="button"
        >
          Sign and submit
        </button>
      </div>
    </section>
  )
}
