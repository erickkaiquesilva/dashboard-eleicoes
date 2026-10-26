import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  compareFinalistPercentages,
  describeGapComparison,
} from "../src/comparison.mjs";
import {
  calculateVariation,
  determineLeader,
  formatHundredths,
  percentageToHundredths,
} from "../scripts/tse/rules.mjs";
import {
  buildSnapshot,
  collectAll,
  deriveRound,
  PLACES,
  runIngest,
  sourceUrl,
  validateOfficialPayload,
} from "../scripts/tse/snapshot.mjs";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/tse-result.json", import.meta.url), "utf8"),
);

function payloadFor(place, electionId) {
  const payload = structuredClone(fixture);
  payload.cdabr = place;
  payload.ele = electionId;
  payload.t = electionId === "6257" ? "1" : "2";
  payload.idg = `${place}-${electionId}`;

  if (electionId === "6258") {
    const candidates = payload.carg.flatMap((office) =>
      office.agr.flatMap((alliance) =>
        alliance.par.flatMap((party) => party.cand),
      ),
    );
    const lula = candidates.find((candidate) => candidate.n === "13");
    const flavio = candidates.find((candidate) => candidate.n === "22");
    lula.vap = "5179";
    lula.pvap = "51,79";
    flavio.vap = "4821";
    flavio.pvap = "48,21";
  }

  return payload;
}

function responseFor(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return {
    ok: true,
    status: 200,
    async arrayBuffer() {
      return bytes.buffer;
    },
  };
}

function identifyRequest(url) {
  const match = url.match(/ele2026\/(\d+)\/dados\/([a-z]{2})\//);
  assert.ok(match, `URL inesperada: ${url}`);
  return { electionId: match[1], place: match[2] };
}

test("percentuais usam centésimos inteiros e preservam o sinal", () => {
  assert.equal(percentageToHundredths("51,79"), 5179);
  assert.equal(formatHundredths(-363), "-3,63");
  assert.throws(() => percentageToHundredths("51.79"), /Percentual inválido/);

  assert.deepEqual(calculateVariation("45,16", "51,79"), {
    status: "available",
    hundredths: 663,
    percentagePoints: "6,63",
    direction: "subiu",
  });
  assert.equal(calculateVariation("51,79", "45,16").direction, "caiu");
  assert.deepEqual(calculateVariation("10,00", "10,00"), {
    status: "available",
    hundredths: 0,
    percentagePoints: "0,00",
    direction: "ficou igual",
  });
});

test("líder considera todos os candidatos, detecta empate e dado ausente", () => {
  assert.deepEqual(
    determineLeader([
      { n: "13", nmu: "LULA", vap: "90" },
      { n: "70", nmu: "OUTRO CANDIDATO", vap: "100" },
      { n: "22", nmu: "FLAVIO BOLSONARO", vap: "80" },
    ]),
    {
      status: "leader",
      candidateNumber: "70",
      officialName: "OUTRO CANDIDATO",
      votes: 100,
    },
  );

  assert.deepEqual(
    determineLeader([
      { n: "13", nmu: "LULA", vap: "100" },
      { n: "22", nmu: "FLAVIO BOLSONARO", vap: "100" },
    ]),
    {
      status: "tie",
      candidateNumbers: ["13", "22"],
      votes: 100,
    },
  );

  assert.deepEqual(
    determineLeader([
      { n: "13", nmu: "LULA", vap: "100" },
      { n: "22", nmu: "FLAVIO BOLSONARO" },
    ]),
    {
      status: "unavailable",
      reason: "candidate-field-missing",
    },
  );
});

test("validação exige identidade, totalização e campos oficiais", () => {
  const valid = payloadFor("br", "6257");
  assert.doesNotThrow(() =>
    validateOfficialPayload(valid, { place: "br", electionId: "6257" }),
  );

  const invalid = structuredClone(valid);
  invalid.carg[0].agr[0].par[0].cand[0].pvap = "47.03";
  assert.throws(
    () =>
      validateOfficialPayload(invalid, {
        place: "br",
        electionId: "6257",
      }),
    /vírgula e duas casas/,
  );
});

test("campo local ausente marca somente o turno daquele lugar indisponível", () => {
  const payload = payloadFor("sp", "6257");
  delete payload.e.pc;
  const round = deriveRound({
    payload,
    place: "sp",
    electionId: "6257",
    url: sourceUrl("sp", "6257"),
    sha256: "fixture-sha",
  });

  assert.deepEqual(round, {
    status: "unavailable",
    reason: "turnout-percentage-missing",
    source: {
      url: sourceUrl("sp", "6257"),
      idg: "sp-6257",
      dg: fixture.dg,
      hg: fixture.hg,
      sha256: "fixture-sha",
    },
  });
});

test("coleta valida Brasil, 27 UFs e exterior nos dois turnos", async () => {
  const requested = [];
  const records = await collectAll(async (url) => {
    const identity = identifyRequest(url);
    requested.push(`${identity.place}/${identity.electionId}`);
    return responseFor(payloadFor(identity.place, identity.electionId));
  });

  assert.equal(records.length, 58);
  assert.equal(new Set(requested).size, 58);
  assert.equal(PLACES.length, 29);

  const snapshot = buildSnapshot(records, "2026-10-26T00:00:00.000Z");
  assert.equal(Object.keys(snapshot.places).length, 29);
  assert.equal(snapshot.places.zz.rounds["2"].status, "available");
  assert.equal(snapshot.places.br.rounds["1"].status, "available");
  assert.equal(
    snapshot.places.br.rounds["1"].leader.percentage,
    "47,03",
  );
  assert.equal(snapshot.places.br.variation["13"].hundredths, 663);
});

test("qualquer arquivo inválido preserva o snapshot anterior", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tse-snapshot-"));
  const outputPath = join(directory, "snapshot.json");
  const original = '{"snapshot":"anterior"}\n';
  await writeFile(outputPath, original, "utf8");

  try {
    await assert.rejects(
      runIngest({
        outputPath,
        generatedAt: "2026-10-26T00:00:00.000Z",
        fetchImpl: async (url) => {
          const identity = identifyRequest(url);
          const payload = payloadFor(identity.place, identity.electionId);
          if (identity.place === "sp" && identity.electionId === "6258") {
            payload.tf = "n";
          }
          return responseFor(payload);
        },
      }),
      /1 dos 58 arquivos falharam; snapshot preservado/,
    );

    assert.equal(await readFile(outputPath, "utf8"), original);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("diferença entre finalistas usa centésimos e detecta a direção", () => {
  assert.deepEqual(
    compareFinalistPercentages(
      { "13": "38,20", "22": "51,93" },
      { "13": "46,15", "22": "53,85" },
    ),
    {
      first: {
        leader: "22",
        gapHundredths: 1373,
        gap: "13,73",
      },
      second: {
        leader: "22",
        gapHundredths: 770,
        gap: "7,70",
      },
      leaderSwapped: false,
      gapDirection: "caiu",
    },
  );

  assert.equal(
    compareFinalistPercentages(
      { "13": "50,00", "22": "50,00" },
      { "13": "50,00", "22": "50,00" },
    ).gapDirection,
    "ficou igual",
  );
  assert.equal(
    compareFinalistPercentages(
      { "13": "51,00", "22": "49,00" },
      { "13": "54,00", "22": "46,00" },
    ).gapDirection,
    "aumentou",
  );
});

test("troca de líder entre os finalistas é explícita", () => {
  const comparison = compareFinalistPercentages(
    { "13": "55,00", "22": "45,00" },
    { "13": "48,00", "22": "52,00" },
  );

  assert.equal(comparison.leaderSwapped, true);
  assert.equal(comparison.first.leader, "13");
  assert.equal(comparison.first.gap, "10,00");
  assert.equal(comparison.second.leader, "22");
  assert.equal(comparison.second.gap, "4,00");
  assert.equal(
    describeGapComparison(comparison),
    "Lula estava à frente por 10,00 pontos no 1º turno; no 2º, Flávio Bolsonaro passou a liderar por 4,00 pontos.",
  );
});
