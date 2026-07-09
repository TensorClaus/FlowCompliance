// happy-dom does not implement the 2D canvas API. SignatureStep only needs
// the drawing surface to exist — the strokes themselves are irrelevant to
// behaviour — so stub the canvas prototype with inert implementations.

export interface CanvasMockContext {
  scale: () => void
  beginPath: () => void
  moveTo: () => void
  lineTo: () => void
  stroke: () => void
  setTransform: () => void
  clearRect: () => void
  lineCap: string
  lineJoin: string
  strokeStyle: string
  lineWidth: number
}

export const MOCK_SIGNATURE_DATA_URL = 'data:image/png;base64,TESTSIGNATURE'

export function installCanvasMock(): void {
  const context: CanvasMockContext = {
    scale: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    setTransform: () => {},
    clearRect: () => {},
    lineCap: '',
    lineJoin: '',
    strokeStyle: '',
    lineWidth: 0,
  }

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => context,
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: () => MOCK_SIGNATURE_DATA_URL,
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => {},
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => true,
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: () => {},
  })
}
