export function normalizeMunicipalitySearch(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function summarizeMunicipalities(municipalities) {
  const perRound = {};

  for (const round of ["1", "2"]) {
    const leaders = {};
    const leaderNames = {};
    let ties = 0;
    let unavailable = 0;

    for (const municipality of municipalities) {
      const result = municipality.rounds[round];
      if (!result || result.status === "unavailable") {
        unavailable += 1;
      } else if (result.leader.status === "tie") {
        ties += 1;
      } else {
        const number = result.leader.candidateNumber;
        leaders[number] = (leaders[number] ?? 0) + 1;
        leaderNames[number] = result.leader.officialName;
      }
    }

    perRound[round] = {
      total: municipalities.length,
      leaders,
      leaderNames,
      ties,
      unavailable,
    };
  }

  const swaps = municipalities.reduce((count, municipality) => {
    const first = municipality.rounds["1"];
    const second = municipality.rounds["2"];
    if (
      first?.status !== "available" ||
      first.leader.status !== "leader" ||
      second?.status !== "available" ||
      second.leader.status !== "leader"
    ) {
      return count;
    }
    return count + Number(
      first.leader.candidateNumber !== second.leader.candidateNumber,
    );
  }, 0);

  return { perRound, swaps };
}
