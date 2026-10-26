export type RoundNumber = "1" | "2";

type AvailableLeader =
  | {
      status: "leader";
      candidateNumber: string;
      officialName: string;
      votes: number;
    }
  | {
      status: "tie";
      candidateNumbers: string[];
      votes: number;
    };

type RoundResult =
  | {
      status: "available";
      leader: AvailableLeader;
    }
  | {
      status: "unavailable";
      reason: string;
    };

type PlaceResult = {
  rounds: Record<RoundNumber, RoundResult>;
};

export type ElectionSnapshot = {
  places: Record<string, PlaceResult>;
};

export type StateDefinition = {
  code: string;
  abbreviation: string;
  name: string;
};

export const STATES: StateDefinition[] = [
  { code: "11", abbreviation: "RO", name: "Rondônia" },
  { code: "12", abbreviation: "AC", name: "Acre" },
  { code: "13", abbreviation: "AM", name: "Amazonas" },
  { code: "14", abbreviation: "RR", name: "Roraima" },
  { code: "15", abbreviation: "PA", name: "Pará" },
  { code: "16", abbreviation: "AP", name: "Amapá" },
  { code: "17", abbreviation: "TO", name: "Tocantins" },
  { code: "21", abbreviation: "MA", name: "Maranhão" },
  { code: "22", abbreviation: "PI", name: "Piauí" },
  { code: "23", abbreviation: "CE", name: "Ceará" },
  { code: "24", abbreviation: "RN", name: "Rio Grande do Norte" },
  { code: "25", abbreviation: "PB", name: "Paraíba" },
  { code: "26", abbreviation: "PE", name: "Pernambuco" },
  { code: "27", abbreviation: "AL", name: "Alagoas" },
  { code: "28", abbreviation: "SE", name: "Sergipe" },
  { code: "29", abbreviation: "BA", name: "Bahia" },
  { code: "31", abbreviation: "MG", name: "Minas Gerais" },
  { code: "32", abbreviation: "ES", name: "Espírito Santo" },
  { code: "33", abbreviation: "RJ", name: "Rio de Janeiro" },
  { code: "35", abbreviation: "SP", name: "São Paulo" },
  { code: "41", abbreviation: "PR", name: "Paraná" },
  { code: "42", abbreviation: "SC", name: "Santa Catarina" },
  { code: "43", abbreviation: "RS", name: "Rio Grande do Sul" },
  { code: "50", abbreviation: "MS", name: "Mato Grosso do Sul" },
  { code: "51", abbreviation: "MT", name: "Mato Grosso" },
  { code: "52", abbreviation: "GO", name: "Goiás" },
  { code: "53", abbreviation: "DF", name: "Distrito Federal" },
];

export const INKS = {
  lula: "#002776",
  flavio: "#009C3B",
  other: "#6E6E73",
} as const;

export function resultFor(
  snapshot: ElectionSnapshot,
  abbreviation: string,
  round: RoundNumber,
): RoundResult {
  const place = snapshot.places[abbreviation.toLowerCase()];
  return (
    place?.rounds[round] ?? {
      status: "unavailable",
      reason: "place-or-round-missing",
    }
  );
}

export function inkFor(result: RoundResult): string | undefined {
  if (result.status !== "available" || result.leader.status !== "leader") {
    return undefined;
  }

  if (result.leader.candidateNumber === "13") return INKS.lula;
  if (result.leader.candidateNumber === "22") return INKS.flavio;
  return INKS.other;
}

export function leaderLabel(result: RoundResult): string {
  if (result.status === "unavailable") return "resultado indisponível";
  if (result.leader.status === "tie") return "empate";

  if (result.leader.candidateNumber === "13") {
    return "Lula ficou à frente";
  }
  if (result.leader.candidateNumber === "22") {
    return "Flávio Bolsonaro ficou à frente";
  }
  return `${result.leader.officialName} ficou à frente`;
}

export function hasOtherLeader(
  snapshot: ElectionSnapshot,
  round: RoundNumber,
): boolean {
  return STATES.some((state) => {
    const result = resultFor(snapshot, state.abbreviation, round);
    return (
      result.status === "available" &&
      result.leader.status === "leader" &&
      result.leader.candidateNumber !== "13" &&
      result.leader.candidateNumber !== "22"
    );
  });
}
