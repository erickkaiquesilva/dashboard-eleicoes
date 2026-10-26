const INTEGER_PATTERN = /^\d+$/;
const PERCENT_PATTERN = /^\d+,\d{2}$/;

export function isIntegerString(value) {
  return typeof value === "string" && INTEGER_PATTERN.test(value);
}

export function isTsePercentage(value) {
  return typeof value === "string" && PERCENT_PATTERN.test(value);
}

export function percentageToHundredths(value) {
  if (!isTsePercentage(value)) {
    throw new TypeError(`Percentual inválido: ${String(value)}`);
  }

  return Number(value.replace(",", ""));
}

export function formatHundredths(value) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Centésimos inválidos: ${String(value)}`);
  }

  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const integer = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${integer},${fraction}`;
}

export function calculateVariation(firstRoundPercentage, secondRoundPercentage) {
  const hundredths =
    percentageToHundredths(secondRoundPercentage) -
    percentageToHundredths(firstRoundPercentage);

  return {
    status: "available",
    hundredths,
    percentagePoints: formatHundredths(hundredths),
    direction:
      hundredths > 0 ? "subiu" : hundredths < 0 ? "caiu" : "ficou igual",
  };
}

export function determineLeader(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      status: "unavailable",
      reason: "candidate-list-missing",
    };
  }

  const normalized = [];

  for (const candidate of candidates) {
    if (
      candidate === null ||
      typeof candidate !== "object" ||
      typeof candidate.n !== "string" ||
      typeof candidate.nmu !== "string" ||
      candidate.nmu.length === 0 ||
      !isIntegerString(candidate.vap)
    ) {
      return {
        status: "unavailable",
        reason: "candidate-field-missing",
      };
    }

    const votes = Number(candidate.vap);
    if (!Number.isSafeInteger(votes)) {
      return {
        status: "unavailable",
        reason: "candidate-votes-out-of-range",
      };
    }

    normalized.push({
      candidateNumber: candidate.n,
      officialName: candidate.nmu,
      votes,
    });
  }

  const maximum = Math.max(...normalized.map((candidate) => candidate.votes));
  const leaders = normalized.filter((candidate) => candidate.votes === maximum);

  if (leaders.length > 1) {
    return {
      status: "tie",
      candidateNumbers: leaders.map((candidate) => candidate.candidateNumber),
      votes: maximum,
    };
  }

  return {
    status: "leader",
    ...leaders[0],
  };
}
