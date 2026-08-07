import {PointerEvent, RefObject, useCallback, useRef, useState} from 'react'

/**
 * Panning the table with the middle mouse button - the way a spreadsheet does
 * it. With full-width columns the scrollbar sits right at the bottom, and
 * reaching for it every time takes longer than grabbing the table anywhere.
 *
 * `setPointerCapture` instead of listening on `window`: a cursor leaving the
 * pane then does not drop the drag, and the browser does the cleanup.
 */
export function usePanScroll(ref: RefObject<HTMLDivElement | null>) {
  const [panning, setPanning] = useState(false)
  const origin = useRef({x: 0, y: 0, left: 0, top: 0})

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 1 || !ref.current) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      origin.current = {
        x: event.clientX,
        y: event.clientY,
        left: ref.current.scrollLeft,
        top: ref.current.scrollTop,
      }
      setPanning(true)
    },
    [ref],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!panning || !ref.current) return
      const {x, y, left, top} = origin.current
      ref.current.scrollLeft = left - (event.clientX - x)
      ref.current.scrollTop = top - (event.clientY - y)
    },
    [panning, ref],
  )

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!panning) return
      event.currentTarget.releasePointerCapture(event.pointerId)
      setPanning(false)
    },
    [panning],
  )

  return {
    panning,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  }
}
