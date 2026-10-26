import { createHash } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import { calculateVariation } from "./rules.mjs";
import {
  ELECTIONS,
  PLACES,
  deriveRound,
  validateOfficialPayload,
} from "./snapshot.mjs";

export const UFS = PLACES.filter(
  (place) => place !== "br" && place !== "zz",
);
export const DEFAULT_CONCURRENCY = 12;
export const DEFAULT_REQUESTS_PER_SECOND = 15;

export function configUrl(electionId) {
  return `https://resultados.tse.jus.br/oficial/ele2026/${electionId}/config/mun-e00${electionId}-cm.json`;
}

export function municipalResultUrl(electionId, uf, municipality) {
  if (!UFS.includes(uf)) {
    throw new Error(`UF fora da configuração brasileira: ${uf}`);
  }
  if (!municipality || !/^\d{5}$/.test(municipality.cd)) {
    throw new Error(`Código TSE municipal inválido para ${uf}`);
  }
  return `https://resultados.tse.jus.br/oficial/ele2026/${electionId}/dados/${uf}/${uf}${municipality.cd}-c0001-e00${electionId}-u.json`;
}

export function outlineUrl(uf) {
  if (!UFS.includes(uf)) {
    throw new Error(`UF inválida para a malha do IBGE: ${uf}`);
  }
  return `https://servicodados.ibge.gov.br/api/v4/malhas/estados/${uf.toUpperCase()}?intrarregiao=municipio&qualidade=minima&formato=image/svg+xml`;
}

export function municipalitySlug(name) {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new TypeError("Nome municipal ausente");
  }
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length === 0) {
    throw new Error(`Nome municipal não gera endereço: ${name}`);
  }
  return slug;
}

function sha256(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

function assertString(value, context) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} ausente`);
  }
}

export function parseMunicipalConfig(payload, electionId, raw) {
  const context = `configuração ${electionId}`;
  if (!payload || typeof payload !== "object") {
    throw new Error(`${context}: JSON não é objeto`);
  }
  if (payload.f !== "o") {
    throw new Error(`${context}: f deve ser "o"`);
  }
  if (!Array.isArray(payload.abr)) {
    throw new Error(`${context}: abr ausente`);
  }

  const municipalities = [];
  const seenUfs = new Set();
  for (const state of payload.abr) {
    assertString(state?.cd, `${context}: abr.cd`);
    const uf = state.cd.toLowerCase();
    if (uf === "zz") continue;
    if (!UFS.includes(uf) || seenUfs.has(uf) || !Array.isArray(state.mu)) {
      throw new Error(`${context}: UF inválida ou repetida: ${uf}`);
    }
    seenUfs.add(uf);

    for (const municipality of state.mu) {
      if (!/^\d{5}$/.test(municipality?.cd ?? "")) {
        throw new Error(`${context}: código TSE inválido em ${uf}`);
      }
      if (!/^\d{7}$/.test(municipality?.cdi ?? "")) {
        throw new Error(`${context}: código IBGE inválido em ${uf}`);
      }
      assertString(municipality.nm, `${context}: nome em ${uf}`);
      municipalities.push({
        uf,
        tseCode: municipality.cd,
        ibgeCode: municipality.cdi,
        name: municipality.nm,
        slug: municipalitySlug(municipality.nm),
      });
    }
  }

  if (seenUfs.size !== UFS.length) {
    throw new Error(
      `${context}: esperadas ${UFS.length} UFs, recebidas ${seenUfs.size}`,
    );
  }
  assertString(payload.idg, `${context}: idg`);
  assertString(payload.dg, `${context}: dg`);
  assertString(payload.hg, `${context}: hg`);

  assertNoSlugCollisions(municipalities);

  return {
    electionId,
    source: {
      url: configUrl(electionId),
      idg: payload.idg,
      dg: payload.dg,
      hg: payload.hg,
      sha256: sha256(raw),
    },
    municipalities,
  };
}

export function assertNoSlugCollisions(municipalities) {
  const seen = new Map();
  for (const municipality of municipalities) {
    const key = `${municipality.uf}/${municipality.slug}`;
    const previous = seen.get(key);
    if (previous && previous.ibgeCode !== municipality.ibgeCode) {
      throw new Error(
        `Colisão de endereço em ${municipality.uf}: ${previous.name} e ${municipality.name} geram ${municipality.slug}`,
      );
    }
    seen.set(key, municipality);
  }
}

export function reconcileConfigs(first, second) {
  const byKey = (config) =>
    new Map(
      config.municipalities.map((municipality) => [
        `${municipality.uf}/${municipality.ibgeCode}`,
        municipality,
      ]),
    );
  const firstByKey = byKey(first);
  const secondByKey = byKey(second);
  const keys = new Set([...firstByKey.keys(), ...secondByKey.keys()]);
  const differences = [];

  for (const key of [...keys].sort()) {
    const firstMunicipality = firstByKey.get(key);
    const secondMunicipality = secondByKey.get(key);
    if (!firstMunicipality) {
      differences.push({
        type: "missing-in-6257",
        key,
        second: secondMunicipality,
      });
      continue;
    }
    if (!secondMunicipality) {
      differences.push({
        type: "missing-in-6258",
        key,
        first: firstMunicipality,
      });
      continue;
    }
    for (const field of ["tseCode", "name", "slug"]) {
      if (firstMunicipality[field] !== secondMunicipality[field]) {
        differences.push({
          type: "changed",
          key,
          field,
          first: firstMunicipality[field],
          second: secondMunicipality[field],
        });
      }
    }
  }

  return {
    identical: differences.length === 0,
    firstCount: first.municipalities.length,
    secondCount: second.municipalities.length,
    differences,
  };
}

class StartRateLimiter {
  constructor(requestsPerSecond) {
    this.interval = Math.ceil(1000 / requestsPerSecond);
    this.nextStart = 0;
  }

  async wait() {
    const now = Date.now();
    const scheduled = Math.max(now, this.nextStart);
    this.nextStart = scheduled + this.interval;
    const wait = scheduled - now;
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

function retryDelay(response, attempt) {
  const retryAfter = response?.headers?.get?.("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }
  return Math.min(30_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
}

function isTemporaryStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

async function fetchRaw(url, fetchImpl, limiter, attempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await limiter.wait();
    try {
      const response = await fetchImpl(url, {
        headers: { accept: "application/json, image/svg+xml" },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
      const error = new Error(`${url}: HTTP ${response.status}`);
      if (!isTemporaryStatus(response.status)) throw error;
      lastError = error;
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay(response, attempt)),
      );
    } catch (error) {
      lastError = error;
      if (
        error.message.includes("HTTP") &&
        !isTemporaryStatus(Number(error.message.match(/HTTP (\d+)/)?.[1]))
      ) {
        throw error;
      }
      if (attempt + 1 < attempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay(undefined, attempt)),
        );
      }
    }
  }
  throw new Error(`Falha após ${attempts} tentativas: ${url}`, {
    cause: lastError,
  });
}

async function fetchConfig(electionId, fetchImpl, limiter) {
  const raw = await fetchRaw(configUrl(electionId), fetchImpl, limiter);
  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    throw new Error(`Configuração ${electionId}: JSON inválido`, {
      cause: error,
    });
  }
  return parseMunicipalConfig(payload, electionId, raw);
}

function buildJobs(configs) {
  return configs.flatMap((config) =>
    config.municipalities.map((municipality) => ({
      electionId: config.electionId,
      round: config.electionId === "6257" ? "1" : "2",
      municipality,
      url: municipalResultUrl(
        config.electionId,
        municipality.uf,
        { cd: municipality.tseCode },
      ),
    })),
  );
}

async function runWorkers(jobs, workerCount, worker) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < jobs.length) {
        const index = cursor;
        cursor += 1;
        await worker(jobs[index], index);
      }
    }),
  );
}

async function fetchMunicipalRecord(job, fetchImpl, limiter) {
  const raw = await fetchRaw(job.url, fetchImpl, limiter);
  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    throw new Error(
      `${job.municipality.uf}/${job.municipality.tseCode}/${job.electionId}: JSON inválido`,
      { cause: error },
    );
  }
  if (payload.tpabr !== "mu") {
    throw new Error(`${job.url}: tpabr deve ser "mu"`);
  }
  validateOfficialPayload(payload, {
    place: job.municipality.tseCode,
    electionId: job.electionId,
  });

  return {
    place: `${job.municipality.uf}/${job.municipality.tseCode}`,
    electionId: job.electionId,
    url: job.url,
    sha256: sha256(raw),
    payload,
  };
}

function unavailableRound(config, reason) {
  return {
    status: "unavailable",
    reason,
    source: config.source,
  };
}

function deriveMunicipality(firstMunicipality, secondMunicipality, records, configs) {
  const identity = secondMunicipality ?? firstMunicipality;
  const firstRecord = firstMunicipality
    ? records.get(`1/${identity.uf}/${identity.ibgeCode}`)
    : undefined;
  const secondRecord = secondMunicipality
    ? records.get(`2/${identity.uf}/${identity.ibgeCode}`)
    : undefined;
  const rounds = {
    "1": firstRecord
      ? deriveRound(firstRecord)
      : unavailableRound(configs["1"], "not-in-election-config"),
    "2": secondRecord
      ? deriveRound(secondRecord)
      : unavailableRound(configs["2"], "not-in-election-config"),
  };
  const variation = {};

  for (const number of ["13", "22"]) {
    variation[number] =
      rounds["1"].status === "available" &&
      rounds["2"].status === "available"
        ? calculateVariation(
            rounds["1"].candidates[number].percentage,
            rounds["2"].candidates[number].percentage,
          )
        : { status: "unavailable", reason: "round-unavailable" };
  }

  return {
    tseCode:
      secondMunicipality?.tseCode ?? firstMunicipality?.tseCode ?? null,
    ibgeCode: identity.ibgeCode,
    name: secondMunicipality?.name ?? firstMunicipality.name,
    slug: secondMunicipality?.slug ?? firstMunicipality.slug,
    rounds,
    variation,
  };
}

function extractOutlineIds(raw, uf) {
  const source = raw.toString("utf8");
  const ids = [
    ...source.matchAll(/<path\b[^>]*\bid=["'](\d{7})["']/gi),
  ].map((match) => match[1]);
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error(`Malha do IBGE inválida ou com ids repetidos: ${uf}`);
  }
  return new Set(ids);
}

async function fetchOutlines(fetchImpl) {
  const limiter = new StartRateLimiter(4);
  const outlines = new Map();
  await runWorkers(UFS, 4, async (uf) => {
    const url = outlineUrl(uf);
    const raw = await fetchRaw(url, fetchImpl, limiter);
    outlines.set(uf, {
      url,
      raw,
      sha256: sha256(raw),
      ids: extractOutlineIds(raw, uf),
    });
  });
  return outlines;
}

function validateUfPayload(payload) {
  if (
    !payload ||
    !UFS.includes(payload.uf) ||
    !Array.isArray(payload.municipalities) ||
    payload.municipalities.length === 0
  ) {
    throw new Error("Arquivo municipal por UF inválido");
  }
  const tseCodes = new Set();
  const ibgeCodes = new Set();
  for (const municipality of payload.municipalities) {
    if (
      !/^\d{5}$/.test(municipality.tseCode) ||
      !/^\d{7}$/.test(municipality.ibgeCode) ||
      typeof municipality.name !== "string" ||
      municipalitySlug(municipality.name) !== municipality.slug ||
      tseCodes.has(municipality.tseCode) ||
      ibgeCodes.has(municipality.ibgeCode) ||
      !municipality.rounds?.["1"] ||
      !municipality.rounds?.["2"]
    ) {
      throw new Error(`Arquivo municipal inválido: ${payload.uf}`);
    }
    tseCodes.add(municipality.tseCode);
    ibgeCodes.add(municipality.ibgeCode);
  }
}

async function writeTemporary(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporaryPath, "wx");
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return temporaryPath;
}

export async function writeMunicipalDatasetAtomically({
  dataDirectory,
  mapDirectory,
  ufPayloads,
  outlines,
  manifest,
}) {
  for (const payload of ufPayloads.values()) validateUfPayload(payload);
  for (const uf of UFS) {
    if (!outlines.get(uf)?.raw) {
      throw new Error(`Malha ausente: ${uf}`);
    }
  }

  const staged = [];
  try {
    for (const uf of UFS) {
      const dataPath = join(dataDirectory, `${uf}.json`);
      const mapPath = join(mapDirectory, `${uf}.svg`);
      staged.push({
        temporary: await writeTemporary(
          dataPath,
          `${JSON.stringify(ufPayloads.get(uf))}\n`,
        ),
        target: dataPath,
      });
      staged.push({
        temporary: await writeTemporary(mapPath, outlines.get(uf).raw),
        target: mapPath,
      });
    }
    const manifestPath = join(dataDirectory, "index.json");
    staged.push({
      temporary: await writeTemporary(
        manifestPath,
        `${JSON.stringify(manifest, null, 2)}\n`,
      ),
      target: manifestPath,
    });

    for (const file of staged) {
      await rename(file.temporary, file.target);
    }
  } catch (error) {
    await Promise.all(
      staged.map((file) => rm(file.temporary, { force: true })),
    );
    throw error;
  }
}

export async function collectMunicipalDataset({
  fetchImpl = globalThis.fetch,
  concurrency = DEFAULT_CONCURRENCY,
  requestsPerSecond = DEFAULT_REQUESTS_PER_SECOND,
  onProgress = () => {},
}) {
  const limiter = new StartRateLimiter(requestsPerSecond);
  const configs = {};
  for (const election of ELECTIONS) {
    configs[election.round] = await fetchConfig(
      election.id,
      fetchImpl,
      limiter,
    );
  }
  const reconciliation = reconcileConfigs(configs["1"], configs["2"]);
  const jobs = buildJobs([configs["1"], configs["2"]]);
  const records = new Map();
  let completed = 0;

  await runWorkers(jobs, concurrency, async (job) => {
    const record = await fetchMunicipalRecord(job, fetchImpl, limiter);
    records.set(
      `${job.round}/${job.municipality.uf}/${job.municipality.ibgeCode}`,
      record,
    );
    completed += 1;
    if (completed % 250 === 0 || completed === jobs.length) {
      onProgress({ completed, total: jobs.length });
    }
  });

  const outlines = await fetchOutlines(fetchImpl);
  const ufPayloads = new Map();
  const generatedAt = new Date().toISOString();
  const unavailable = [];
  const missingOutlines = [];
  const outlinesWithoutResults = [];
  const sizes = {};

  for (const uf of UFS) {
    const first = configs["1"].municipalities.filter(
      (municipality) => municipality.uf === uf,
    );
    const second = configs["2"].municipalities.filter(
      (municipality) => municipality.uf === uf,
    );
    const firstByIbge = new Map(
      first.map((municipality) => [municipality.ibgeCode, municipality]),
    );
    const secondByIbge = new Map(
      second.map((municipality) => [municipality.ibgeCode, municipality]),
    );
    const ibgeCodes = new Set([
      ...firstByIbge.keys(),
      ...secondByIbge.keys(),
    ]);
    const municipalities = [...ibgeCodes]
      .map((ibgeCode) =>
        deriveMunicipality(
          firstByIbge.get(ibgeCode),
          secondByIbge.get(ibgeCode),
          records,
          configs,
        ),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const resultCodes = new Set(
      municipalities.map((municipality) => municipality.ibgeCode),
    );
    const outline = outlines.get(uf);
    const missing = [...resultCodes]
      .filter((code) => !outline.ids.has(code))
      .sort();
    const extra = [...outline.ids]
      .filter((code) => !resultCodes.has(code))
      .sort();
    for (const code of missing) missingOutlines.push({ uf, ibgeCode: code });
    for (const code of extra)
      outlinesWithoutResults.push({ uf, ibgeCode: code });

    for (const municipality of municipalities) {
      const unavailableRounds = ["1", "2"].filter(
        (round) => municipality.rounds[round].status === "unavailable",
      );
      if (unavailableRounds.length > 0) {
        unavailable.push({
          uf,
          ibgeCode: municipality.ibgeCode,
          name: municipality.name,
          rounds: unavailableRounds,
        });
      }
    }

    const payload = {
      schemaVersion: 1,
      generatedAt,
      uf,
      municipalityCount: municipalities.length,
      configs: {
        "1": configs["1"].source,
        "2": configs["2"].source,
      },
      outline: {
        url: outline.url,
        sha256: outline.sha256,
        pathCount: outline.ids.size,
        missingMunicipalityCodes: missing,
        pathsWithoutResults: extra,
      },
      municipalities,
    };
    validateUfPayload(payload);
    ufPayloads.set(uf, payload);
    sizes[uf] = {
      municipalities: municipalities.length,
      dataBytes: Buffer.byteLength(`${JSON.stringify(payload)}\n`),
      svgBytes: outline.raw.length,
    };
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt,
    municipalityCount: new Set(
      [...ufPayloads.values()].flatMap((payload) =>
        payload.municipalities.map(
          (municipality) => `${payload.uf}/${municipality.ibgeCode}`,
        ),
      ),
    ).size,
    resultFileCount: jobs.length,
    unavailable,
    missingOutlines,
    outlinesWithoutResults,
    configReconciliation: reconciliation,
    configs: {
      "1": configs["1"].source,
      "2": configs["2"].source,
    },
    sizes,
    totals: {
      dataBytes: Object.values(sizes).reduce(
        (total, size) => total + size.dataBytes,
        0,
      ),
      svgBytes: Object.values(sizes).reduce(
        (total, size) => total + size.svgBytes,
        0,
      ),
    },
  };

  return { ufPayloads, outlines, manifest };
}
