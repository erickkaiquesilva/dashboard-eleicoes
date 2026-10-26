const PERCENT_PATTERN = /^\d+,\d{2}$/;

function toHundredths(value) {
  if (typeof value !== "string" || !PERCENT_PATTERN.test(value)) {
    throw new TypeError(`Percentual inválido: ${String(value)}`);
  }
  return Number(value.replace(",", ""));
}

function formatHundredths(value) {
  const absolute = Math.abs(value);
  return `${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, "0")}`;
}

function analyzeRound(percentages) {
  const lula = toHundredths(percentages["13"]);
  const flavio = toHundredths(percentages["22"]);
  const difference = lula - flavio;

  return {
    leader: difference === 0 ? null : difference > 0 ? "13" : "22",
    gapHundredths: Math.abs(difference),
    gap: formatHundredths(difference),
  };
}

export function compareFinalistPercentages(firstRound, secondRound) {
  const first = analyzeRound(firstRound);
  const second = analyzeRound(secondRound);
  const gapChange = second.gapHundredths - first.gapHundredths;

  return {
    first,
    second,
    leaderSwapped:
      first.leader !== null &&
      second.leader !== null &&
      first.leader !== second.leader,
    gapDirection:
      gapChange < 0
        ? "caiu"
        : gapChange > 0
          ? "aumentou"
          : "ficou igual",
  };
}

export function describeGapComparison(
  comparison,
  names = { "13": "Lula", "22": "Flávio Bolsonaro" },
) {
  if (comparison.leaderSwapped) {
    return `${names[comparison.first.leader]} estava à frente por ${comparison.first.gap} pontos no 1º turno; no 2º, ${names[comparison.second.leader]} passou a liderar por ${comparison.second.gap} pontos.`;
  }

  if (comparison.gapDirection === "ficou igual") {
    return `A diferença entre eles ficou igual em ${comparison.first.gap} pontos.`;
  }

  return `A diferença entre eles ${comparison.gapDirection} de ${comparison.first.gap} para ${comparison.second.gap} pontos.`;
}
