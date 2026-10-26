#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import {
  collectMunicipalDataset,
  writeMunicipalDatasetAtomically,
} from "./municipal.mjs";

const dataDirectory = fileURLToPath(
  new URL("../../public/data/municipal/", import.meta.url),
);
const mapDirectory = fileURLToPath(
  new URL("../../public/maps/municipal/", import.meta.url),
);

try {
  const dataset = await collectMunicipalDataset({
    onProgress: ({ completed, total }) => {
      console.log(`Resultados municipais: ${completed}/${total}`);
    },
  });
  await writeMunicipalDatasetAtomically({
    dataDirectory,
    mapDirectory,
    ...dataset,
  });

  const { manifest } = dataset;
  console.log(
    JSON.stringify(
      {
        municipalityCount: manifest.municipalityCount,
        resultFileCount: manifest.resultFileCount,
        unavailableCount: manifest.unavailable.length,
        missingOutlineCount: manifest.missingOutlines.length,
        outlinesWithoutResultsCount:
          manifest.outlinesWithoutResults.length,
        configDifferences:
          manifest.configReconciliation.differences.length,
        totals: manifest.totals,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
