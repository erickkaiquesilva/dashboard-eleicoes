type CandidateNumber = "13" | "22";
type Percentages = Record<CandidateNumber, string>;

type RoundGap = {
  leader: CandidateNumber | null;
  gapHundredths: number;
  gap: string;
};

export function compareFinalistPercentages(
  firstRound: Percentages,
  secondRound: Percentages,
): {
  first: RoundGap;
  second: RoundGap;
  leaderSwapped: boolean;
  gapDirection: "caiu" | "aumentou" | "ficou igual";
};

type Comparison = ReturnType<typeof compareFinalistPercentages>;

export function describeGapComparison(
  comparison: Comparison,
  names?: Record<CandidateNumber, string>,
): string;
