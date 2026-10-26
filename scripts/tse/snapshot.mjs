import { createHash } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";

import {
  calculateVariation,
  determineLeader,
  isIntegerString,
  isTsePercentage,
} from "./rules.mjs";

export const PLACES = [
  "br",
  "ac",
  "al",
  "ap",
  "am",
  "ba",
  "ce",
  "df",
  "es",
  "go",
  "ma",
  "mt",
  "ms",
  "mg",
  "pa",
  "pb",
  "pr",
  "pe",
  "pi",
  "rj",
  "rn",
  "rs",
  "ro",
  "rr",
  "sc",
  "sp",
  "se",
  "to",
  "zz",
];

export const ELECTIONS = [
  { id: "6257", round: "1", date: "2026-10-04" },
  { id: "6258", round: "2", date: "2026-10-25" },
];

export const EXPECTED_FILE_COUNT = PLACES.length * ELECTIONS.length;

export const FINALISTS = {
  "13": { displayName: "Lula" },
  "22": { displayName: "Flávio Bolsonaro" },
};

const FINALIST_NUMBERS = Object.keys(FINALISTS);

export function sourceUrl(place, electionId) {
  return `https://resultados.tse.jus.br/oficial/ele2026/${electionId}/dados/${place}/${place}-c0001-e00${electionId}-u.json`;
}

function fail(context, message) {
  throw new Error(`${context}: ${message}`);
}

function assertNonEmptyString(value, context, field) {
  if (typeof value !== "string" || value.length === 0) {
    fail(context, `${field} ausente`);
  }
}

function assertSafeIntegerString(value, context, field) {
  if (!isIntegerString(value) || !Number.isSafeInteger(Number(value))) {
    fail(context, `${field} não é um inteiro seguro`);
  }
}

export function candidatesFromPayload(payload, context = "payload") {
  const office = payload?.carg?.[0];
  if (!office || !Array.isArray(office.agr)) {
    fail(context, "carg[0].agr ausente");
  }

  const candidates = [];
  for (const [allianceIndex, alliance] of office.agr.entries()) {
    if (!Array.isArray(alliance?.par)) {
      fail(context, `carg[0].agr[${allianceIndex}].par ausente`);
    }

    for (const [partyIndex, party] of alliance.par.entries()) {
      if (!Array.isArray(party?.cand)) {
        fail(
          context,
          `carg[0].agr[${allianceIndex}].par[${partyIndex}].cand ausente`,
        );
      }
      candidates.push(...party.cand);
    }
  }

  return candidates;
}

export function validateOfficialPayload(payload, expected) {
  const context = `${expected.place}/${expected.electionId}`;

  if (payload === null || typeof payload !== "object") {
    fail(context, "JSON não é um objeto");
  }
  if (payload.f !== "o") fail(context, 'f deve ser "o"');
  if (payload.and !== "f") fail(context, 'and deve ser "f"');
  if (payload.tf !== "s") fail(context, 'tf deve ser "s"');
  if (payload?.carg?.[0]?.cd !== "1") {
    fail(context, 'carg[0].cd deve ser "1"');
  }
  if (payload.ele !== expected.electionId) {
    fail(context, `ele deve ser "${expected.electionId}"`);
  }
  if (payload.cdabr?.toLowerCase() !== expected.place) {
    fail(context, `cdabr deve ser "${expected.place}"`);
  }

  assertSafeIntegerString(payload?.v?.vv, context, "v.vv");
  assertSafeIntegerString(payload?.e?.c, context, "e.c");
  assertNonEmptyString(payload.idg, context, "idg");
  assertNonEmptyString(payload.dg, context, "dg");
  assertNonEmptyString(payload.hg, context, "hg");

  const candidates = candidatesFromPayload(payload, context);
  for (const number of FINALIST_NUMBERS) {
    const matches = candidates.filter((candidate) => candidate?.n === number);
    if (matches.length !== 1) {
      fail(context, `candidato ${number} deve aparecer exatamente uma vez`);
    }

    const [candidate] = matches;
    assertSafeIntegerString(candidate.vap, context, `candidato ${number}.vap`);
    if (!isTsePercentage(candidate.pvap)) {
      fail(
        context,
        `candidato ${number}.pvap deve usar vírgula e duas casas`,
      );
    }
  }

  return candidates;
}

function unavailableRound(reason, source) {
  return {
    status: "unavailable",
    reason,
    source,
  };
}

export function deriveRound(record) {
  const { payload, place, electionId, url, sha256 } = record;
  const source = {
    url,
    idg: payload.idg,
    dg: payload.dg,
    hg: payload.hg,
    sha256,
  };
  const candidates = candidatesFromPayload(
    payload,
    `${place}/${electionId}`,
  );
  const finalists = Object.fromEntries(
    FINALIST_NUMBERS.map((number) => [
      number,
      candidates.find((candidate) => candidate?.n === number),
    ]),
  );

  if (!isTsePercentage(payload?.e?.pc)) {
    return unavailableRound("turnout-percentage-missing", source);
  }
  if (
    FINALIST_NUMBERS.some(
      (number) =>
        typeof finalists[number]?.nmu !== "string" ||
        finalists[number].nmu.length === 0,
    )
  ) {
    return unavailableRound("finalist-name-missing", source);
  }

  const leader = determineLeader(candidates);
  if (leader.status === "unavailable") {
    return unavailableRound(leader.reason, source);
  }

  let enrichedLeader;
  if (leader.status === "leader") {
    const leaderCandidate = candidates.find(
      (candidate) => candidate.n === leader.candidateNumber,
    );
    if (!isTsePercentage(leaderCandidate?.pvap)) {
      return unavailableRound("leader-percentage-missing", source);
    }
    enrichedLeader = {
      ...leader,
      percentage: leaderCandidate.pvap,
    };
  } else {
    enrichedLeader = {
      ...leader,
      candidates: leader.candidateNumbers.map((candidateNumber) => {
        const candidate = candidates.find(
          (item) => item.n === candidateNumber,
        );
        return {
          candidateNumber,
          officialName: candidate.nmu,
        };
      }),
    };
  }

  return {
    status: "available",
    candidates: Object.fromEntries(
      FINALIST_NUMBERS.map((number) => [
        number,
        {
          votes: Number(finalists[number].vap),
          percentage: finalists[number].pvap,
          officialName: finalists[number].nmu,
        },
      ]),
    ),
    validVotes: Number(payload.v.vv),
    turnout: {
      votes: Number(payload.e.c),
      percentage: payload.e.pc,
    },
    leader: enrichedLeader,
    source,
  };
}

function derivePlace(firstRound, secondRound) {
  const rounds = {
    "1": deriveRound(firstRound),
    "2": deriveRound(secondRound),
  };

  const variation = Object.fromEntries(
    FINALIST_NUMBERS.map((number) => {
      if (
        rounds["1"].status !== "available" ||
        rounds["2"].status !== "available"
      ) {
        return [
          number,
          {
            status: "unavailable",
            reason: "round-unavailable",
          },
        ];
      }

      return [
        number,
        calculateVariation(
          rounds["1"].candidates[number].percentage,
          rounds["2"].candidates[number].percentage,
        ),
      ];
    }),
  );

  return { rounds, variation };
}

export function buildSnapshot(records, generatedAt = new Date().toISOString()) {
  if (!Array.isArray(records) || records.length !== EXPECTED_FILE_COUNT) {
    throw new Error(
      `Esperados ${EXPECTED_FILE_COUNT} arquivos, recebidos ${records?.length ?? 0}`,
    );
  }

  const byKey = new Map(
    records.map((record) => [`${record.place}/${record.electionId}`, record]),
  );
  const places = {};

  for (const place of PLACES) {
    const firstRound = byKey.get(`${place}/6257`);
    const secondRound = byKey.get(`${place}/6258`);
    if (!firstRound || !secondRound) {
      throw new Error(`Turno ausente para ${place}`);
    }
    places[place] = derivePlace(firstRound, secondRound);
  }

  return {
    schemaVersion: 1,
    generatedAt,
    elections: {
      "1": { id: "6257", date: "2026-10-04" },
      "2": { id: "6258", date: "2026-10-25" },
    },
    candidates: FINALISTS,
    places,
  };
}

export async function fetchOfficialRecord(
  place,
  electionId,
  fetchImpl = globalThis.fetch,
) {
  const url = sourceUrl(place, electionId);
  const response = await fetchImpl(url, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`${place}/${electionId}: HTTP ${response.status}`);
  }

  const raw = Buffer.from(await response.arrayBuffer());
  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    throw new Error(`${place}/${electionId}: JSON inválido`, { cause: error });
  }

  validateOfficialPayload(payload, { place, electionId });

  return {
    place,
    electionId,
    url,
    sha256: createHash("sha256").update(raw).digest("hex"),
    payload,
  };
}

export async function collectAll(fetchImpl = globalThis.fetch) {
  const requests = PLACES.flatMap((place) =>
    ELECTIONS.map(({ id }) => fetchOfficialRecord(place, id, fetchImpl)),
  );
  const results = await Promise.allSettled(requests);
  const errors = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `${errors.length} dos ${EXPECTED_FILE_COUNT} arquivos falharam; snapshot preservado`,
    );
  }

  return results.map((result) => result.value);
}

export async function writeJsonAtomically(outputPath, value) {
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  let handle;

  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await handle?.close();
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function runIngest({
  outputPath,
  fetchImpl = globalThis.fetch,
  generatedAt = new Date().toISOString(),
}) {
  const records = await collectAll(fetchImpl);
  const snapshot = buildSnapshot(records, generatedAt);
  await writeJsonAtomically(outputPath, snapshot);
  return snapshot;
}
