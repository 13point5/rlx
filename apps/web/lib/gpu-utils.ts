import type { GpuInstance } from "./types";

/**
 * Computed price info for a GPU type + count combination.
 * Calculated from actual availability data instead of the summary endpoint.
 */
export interface ComputedGpuPrice {
  /** Cheapest on-demand price (non-spot, secure_cloud) */
  onDemand: number | null;
  /** Cheapest community price (community_cloud) */
  communityPrice: number | null;
  /** Cheapest spot price (isSpot: true) */
  spotPrice: number | null;
}

/**
 * Summary data for a specific GPU type + count.
 */
export interface ComputedGpuCountData {
  cheapest: ComputedGpuPrice;
  instanceCount: number;
  spotInstanceCount: number;
}

/**
 * Summary data grouped by GPU type, then by count.
 */
export type ComputedGpuSummary = Record<string, Record<string, ComputedGpuCountData>>;

/**
 * Compute GPU summary from raw availability data.
 * Groups instances by GPU type and count, calculating the cheapest prices.
 * 
 * This matches what Prime Intellect does on their website - they fetch all
 * availability data and compute the summary client-side.
 */
export function computeGpuSummary(instances: GpuInstance[]): ComputedGpuSummary {
  const summary: ComputedGpuSummary = {};

  for (const instance of instances) {
    const gpuType = instance.gpuType;
    const gpuCount = String(instance.gpuCount);

    // Initialize GPU type if not exists
    if (!summary[gpuType]) {
      summary[gpuType] = {};
    }

    // Initialize count data if not exists
    if (!summary[gpuType][gpuCount]) {
      summary[gpuType][gpuCount] = {
        cheapest: {
          onDemand: null,
          communityPrice: null,
          spotPrice: null,
        },
        instanceCount: 0,
        spotInstanceCount: 0,
      };
    }

    const countData = summary[gpuType][gpuCount];
    countData.instanceCount++;

    const isSpot = Boolean(instance.isSpot);
    const price = instance.prices.onDemand;
    const communityPrice = instance.prices.communityPrice;

    if (isSpot) {
      countData.spotInstanceCount++;
      // For spot instances, check onDemand first, then communityPrice as fallback
      const spotPrice = price ?? communityPrice;
      if (spotPrice !== null) {
        if (countData.cheapest.spotPrice === null || spotPrice < countData.cheapest.spotPrice) {
          countData.cheapest.spotPrice = spotPrice;
        }
      }
    } else {
      // Non-spot instance
      if (price !== null) {
        if (countData.cheapest.onDemand === null || price < countData.cheapest.onDemand) {
          countData.cheapest.onDemand = price;
        }
      }
      if (communityPrice !== null) {
        if (countData.cheapest.communityPrice === null || communityPrice < countData.cheapest.communityPrice) {
          countData.cheapest.communityPrice = communityPrice;
        }
      }
    }
  }

  // Sort GPU types by name for consistent ordering
  const sortedSummary: ComputedGpuSummary = {};
  const sortedTypes = Object.keys(summary).sort();
  
  for (const gpuType of sortedTypes) {
    sortedSummary[gpuType] = {};
    // Sort counts numerically
    const sortedCounts = Object.keys(summary[gpuType]).sort((a, b) => Number(a) - Number(b));
    for (const count of sortedCounts) {
      sortedSummary[gpuType][count] = summary[gpuType][count];
    }
  }

  return sortedSummary;
}
