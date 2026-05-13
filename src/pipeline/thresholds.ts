export const REPORT_THRESHOLDS = {
  movers: {
    minMoveAbs: 0.05,
    minValidMarkets: 5,
    topCount: 6,
    highConfidenceMinVolume24h: 1000,
    highConfidenceMinLiquidity: 5000,
  },
  sectors: {
    minMatchedMarkets: 5,
    minPricedMarkets: 3,
    minTotalVolume24h: 5000,
    maxIncludedSectors: 3,
    topMarketsPerSector: 5,
  },
  caseStudy: {
    minMarketCount: 3,
    minSnapshotCount: 10,
    minTotalVolume24h: 5000,
    minAverageAbsMove24h: 0.05,
  },
  marketStructure: {
    minResolvedCount: 20,
  },
  global: {
    minValidSectors: 2,
  },
} as const;
