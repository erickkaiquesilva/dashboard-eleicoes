import type {
  PlaceResult,
  RoundNumber,
  SourceRecord,
} from "./map-model";

export type MunicipalityResult = PlaceResult & {
  tseCode: string;
  ibgeCode: string;
  name: string;
  slug: string;
};

export type MunicipalUfData = {
  schemaVersion: number;
  generatedAt: string;
  uf: string;
  municipalityCount: number;
  configs: Record<RoundNumber, SourceRecord>;
  outline: {
    url: string;
    sha256: string;
    pathCount: number;
    missingMunicipalityCodes: string[];
    pathsWithoutResults: string[];
  };
  municipalities: MunicipalityResult[];
};

export type MunicipalGeometry = {
  viewBox: string;
  transform: string;
  paths: Array<{ code: string; data: string }>;
};

export function displayMunicipalityName(name: string): string {
  const normalized = name.toLocaleLowerCase("pt-BR").replace(
    /(^|[\s'-])(\p{L})/gu,
    (_match, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase("pt-BR")}`,
  );
  return normalized.replace(
    /(\s)(Da|Das|De|Do|Dos|E)(?=\s)/g,
    (_match, space: string, particle: string) =>
      `${space}${particle.toLocaleLowerCase("pt-BR")}`,
  );
}

export function readMunicipalGeometry(
  svgText: string,
  expectedPathCount: number,
): MunicipalGeometry {
  const document = new DOMParser().parseFromString(
    svgText,
    "image/svg+xml",
  );
  const svg = document.documentElement;
  const group = svg.querySelector("g");
  const paths = Array.from(svg.querySelectorAll("path")).map((path) => ({
    code: path.id,
    data: path.getAttribute("d") ?? "",
  }));

  if (
    svg.nodeName === "parsererror" ||
    paths.length !== expectedPathCount ||
    paths.some(({ code, data }) => !/^\d{7}$/.test(code) || data.length === 0)
  ) {
    throw new Error("A malha municipal do IBGE está incompleta.");
  }

  return {
    viewBox: svg.getAttribute("viewBox") ?? "0 0 1080 1080",
    transform: group?.getAttribute("transform") ?? "",
    paths,
  };
}

export function hasOtherMunicipalLeader(
  data: MunicipalUfData,
  round: RoundNumber,
): boolean {
  return data.municipalities.some((municipality) => {
    const result = municipality.rounds[round];
    return (
      result.status === "available" &&
      result.leader.status === "leader" &&
      result.leader.candidateNumber !== "13" &&
      result.leader.candidateNumber !== "22"
    );
  });
}
