import { useEffect, useMemo, useState } from 'react'

interface DominantColor {
  borderColor: string
  glowColor: string
  baseColor: string
  isDark: boolean
  isNearBlack: boolean
  isNearWhite: boolean
}

const DEFAULT_COLOR: DominantColor = {
  borderColor: 'rgba(148, 163, 184, 0.45)',
  glowColor: 'rgba(15, 23, 42, 0.25)',
  baseColor: 'rgb(148, 163, 184)',
  isDark: false,
  isNearBlack: false,
  isNearWhite: false,
}

function sampleDominantColor(img: HTMLImageElement): DominantColor {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return DEFAULT_COLOR

  const sampleSize = 12
  canvas.width = sampleSize
  canvas.height = sampleSize
  context.drawImage(img, 0, 0, sampleSize, sampleSize)
  const { data } = context.getImageData(0, 0, sampleSize, sampleSize)

  let r = 0
  let g = 0
  let b = 0
  let count = 0

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]
    if (alpha < 10) continue
    r += data[index]
    g += data[index + 1]
    b += data[index + 2]
    count += 1
  }

  if (!count) return DEFAULT_COLOR

  const avgR = Math.round(r / count)
  const avgG = Math.round(g / count)
  const avgB = Math.round(b / count)
  const baseColor = `rgb(${avgR}, ${avgG}, ${avgB})`
  const borderColor = `rgba(${avgR}, ${avgG}, ${avgB}, 0.55)`
  const glowColor = `rgba(${avgR}, ${avgG}, ${avgB}, 0.35)`
  const luminance = 0.2126 * (avgR / 255) + 0.7152 * (avgG / 255) + 0.0722 * (avgB / 255)

  return {
    baseColor,
    borderColor,
    glowColor,
    isDark: luminance < 0.55,
    isNearBlack: luminance < 0.15,
    isNearWhite: luminance > 0.9,
  }
}

export function useDominantColor(imageUrl?: string | null): DominantColor {
  const [color, setColor] = useState<DominantColor>(DEFAULT_COLOR)

  useEffect(() => {
    if (!imageUrl) {
      setColor(DEFAULT_COLOR)
      return
    }

    let isCancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl

    const handleLoad = () => {
      if (isCancelled) return
      try {
        setColor(sampleDominantColor(img))
      } catch {
        setColor(DEFAULT_COLOR)
      }
    }

    const handleError = () => {
      if (!isCancelled) {
        setColor(DEFAULT_COLOR)
      }
    }

    img.addEventListener('load', handleLoad)
    img.addEventListener('error', handleError)

    return () => {
      isCancelled = true
      img.removeEventListener('load', handleLoad)
      img.removeEventListener('error', handleError)
    }
  }, [imageUrl])

  return useMemo(() => color, [color])
}

export function useDominantColorFromImage(
  imageElement: HTMLImageElement | null,
): DominantColor {
  const [color, setColor] = useState<DominantColor>(DEFAULT_COLOR)

  useEffect(() => {
    if (!imageElement) {
      setColor(DEFAULT_COLOR)
      return
    }

    try {
      setColor(sampleDominantColor(imageElement))
    } catch {
      setColor(DEFAULT_COLOR)
    }
  }, [imageElement])

  return useMemo(() => color, [color])
}
