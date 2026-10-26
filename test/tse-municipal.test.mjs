import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  UFS,
  assertNoSlugCollisions,
  municipalResultUrl,
  municipalitySlug,
  reconcileConfigs,
  writeMunicipalDatasetAtomically,
} from "../scripts/tse/municipal.mjs";

test("endereço municipal usa somente UF e código oficial de cinco dígitos", () => {
  assert.equal(
    municipalResultUrl("6258", "sp", { cd: "71072" }),
    "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/sp/sp71072-c0001-e006258-u.json",
  );
  assert.throws(
    () => municipalResultUrl("6258", "sp", { cd: "7107" }),
    /Código TSE municipal inválido/,
  );
  assert.throws(
    () => municipalResultUrl("6258", "zz", { cd: "71072" }),
    /UF fora da configuração brasileira/,
  );
});

test("nome para endereço remove acentos e pontuação", () => {
  assert.equal(municipalitySlug("São José d'Oeste"), "sao-jose-d-oeste");
  assert.equal(
    municipalitySlug("  Olho-d'Água  do  Borges "),
    "olho-d-agua-do-borges",
  );
});

test("colisão de nome para endereço dentro da UF recusa a coleta", () => {
  assert.throws(
    () =>
      assertNoSlugCollisions([
        {
          uf: "sp",
          ibgeCode: "3500001",
          name: "ÁGUA",
          slug: municipalitySlug("ÁGUA"),
        },
        {
          uf: "sp",
          ibgeCode: "3500002",
          name: "AGUA",
          slug: municipalitySlug("AGUA"),
        },
      ]),
    /Colisão de endereço em sp/,
  );
});

test("reconciliação informa mudanças entre configurações", () => {
  const first = {
    municipalities: [
      {
        uf: "sp",
        ibgeCode: "3550308",
        tseCode: "71072",
        name: "SÃO PAULO",
        slug: "sao-paulo",
      },
    ],
  };
  const second = {
    municipalities: [
      {
        uf: "sp",
        ibgeCode: "3550308",
        tseCode: "71080",
        name: "SÃO PAULO",
        slug: "sao-paulo",
      },
    ],
  };

  const reconciliation = reconcileConfigs(first, second);
  assert.equal(reconciliation.identical, false);
  assert.deepEqual(reconciliation.differences, [
    {
      type: "changed",
      key: "sp/3550308",
      field: "tseCode",
      first: "71072",
      second: "71080",
    },
  ]);
});

test("arquivo municipal inválido preserva a versão anterior", async () => {
  const root = await mkdtemp(join(tmpdir(), "municipal-atomic-"));
  const dataDirectory = join(root, "data");
  const mapDirectory = join(root, "maps");
  const previousPath = join(dataDirectory, "sp.json");
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(previousPath, '{"version":"anterior"}\n', "utf8");

  const ufPayloads = new Map(
    UFS.map((uf) => [
      uf,
      {
        uf,
        municipalities:
          uf === "sp"
            ? []
            : [
                {
                  tseCode: "00001",
                  ibgeCode: `${String(UFS.indexOf(uf) + 1).padStart(6, "0")}1`,
                  name: "MUNICÍPIO TESTE",
                  slug: "municipio-teste",
                  rounds: { "1": {}, "2": {} },
                },
              ],
      },
    ]),
  );
  const outlines = new Map(
    UFS.map((uf) => [uf, { raw: Buffer.from("<svg/>") }]),
  );

  try {
    await assert.rejects(
      writeMunicipalDatasetAtomically({
        dataDirectory,
        mapDirectory,
        ufPayloads,
        outlines,
        manifest: {},
      }),
      /Arquivo municipal por UF inválido/,
    );
    assert.equal(
      await readFile(previousPath, "utf8"),
      '{"version":"anterior"}\n',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
