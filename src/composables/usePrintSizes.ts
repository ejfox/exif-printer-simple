export interface PrintSize {
  width: number
  height: number
}

export type PrintSizeKey = '4x6' | '5x7' | '8x10' | '8x12' | '11x14' | 'square' | 'contact'

export function usePrintSizes() {
  const sizes: Record<PrintSizeKey, PrintSize> = {
    '4x6': { width: 1800, height: 1200 },
    '5x7': { width: 2100, height: 1500 },
    '8x10': { width: 3000, height: 2400 },
    '8x12': { width: 3600, height: 2400 },
    '11x14': { width: 4200, height: 3300 },
    'square': { width: 1500, height: 1500 },
    'contact': { width: 3000, height: 2400 } // 8x10 for contact sheets
  }

  const getSizeConfig = (printSize: PrintSizeKey): PrintSize => {
    return sizes[printSize] || sizes['4x6']
  }

  const getAspectRatio = (printSize: PrintSizeKey): number => {
    const config = getSizeConfig(printSize)
    return config.width / config.height
  }

  const isSquare = (printSize: PrintSizeKey): boolean => {
    const config = getSizeConfig(printSize)
    return config.width === config.height
  }

  const getAllSizes = (): Record<PrintSizeKey, PrintSize> => {
    return Object.fromEntries(
      Object.entries(sizes).map(([key, value]) => [key, { ...value }])
    ) as Record<PrintSizeKey, PrintSize>
  }

  return {
    getSizeConfig,
    getAspectRatio,
    isSquare,
    getAllSizes
  }
}