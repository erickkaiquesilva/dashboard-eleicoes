import type { RoundNumber, RoundResult } from "./map-model";

type MunicipalityForSummary = {
  rounds: Record<RoundNumber, RoundResult>;
};

export type MunicipalRoundSummary = {
  total: number;
  leaders: Record<string, number>;
  leaderNames: Record<string, string>;
  ties: number;
  unavailable: number;
};

export type MunicipalSummary = {
  perRound: Record<RoundNumber, MunicipalRoundSummary>;
  swaps: number;
};

export function normalizeMunicipalitySearch(value: string): string;

export function summarizeMunicipalities(
  municipalities: MunicipalityForSummary[],
): MunicipalSummary;
