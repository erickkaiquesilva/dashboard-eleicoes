import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeMunicipalitySearch,
  summarizeMunicipalities,
} from "../src/municipal-rules.mjs";
import {
  parseElectionPath,
  pathForRoute,
} from "../src/route-rules.mjs";

function leader(candidateNumber, officialName = candidateNumber) {
  return {
    status: "available",
    leader: {
      status: "leader",
      candidateNumber,
      officialName,
    },
  };
}

const unavailable = { status: "unavailable" };
const tie = {
  status: "available",
  leader: { status: "tie" },
};

test("municipal summary counts every leader category and only candidate swaps", () => {
  const summary = summarizeMunicipalities([
    { rounds: { "1": leader("13", "Lula"), "2": leader("22", "Flávio") } },
    { rounds: { "1": leader("22", "Flávio"), "2": leader("22", "Flávio") } },
    { rounds: { "1": leader("30", "Outro"), "2": leader("13", "Lula") } },
    { rounds: { "1": tie, "2": leader("13", "Lula") } },
    { rounds: { "1": unavailable, "2": unavailable } },
  ]);

  assert.deepEqual(summary.perRound["1"].leaders, {
    "13": 1,
    "22": 1,
    "30": 1,
  });
  assert.equal(summary.perRound["1"].ties, 1);
  assert.equal(summary.perRound["1"].unavailable, 1);
  assert.deepEqual(summary.perRound["2"].leaders, {
    "13": 2,
    "22": 2,
  });
  assert.equal(summary.perRound["2"].unavailable, 1);
  assert.equal(summary.swaps, 2);
});

test("municipality search normalization ignores accents and case", () => {
  assert.equal(normalizeMunicipalitySearch("  SÃO Tomé  "), "sao tome");
});

test("route parsing and generation preserve a municipality slug", () => {
  const parsed = parseElectionPath(
    "/mg/2/belo-horizonte",
    new Set(["mg"]),
  );

  assert.deepEqual(parsed.route, {
    place: "mg",
    round: "2",
    municipality: "belo-horizonte",
  });
  assert.equal(parsed.needsReplace, false);
  assert.equal(pathForRoute(parsed.route), "/mg/2/belo-horizonte");
});
