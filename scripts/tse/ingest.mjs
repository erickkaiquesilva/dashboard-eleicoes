#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import { runIngest } from "./snapshot.mjs";

const outputPath = fileURLToPath(
  new URL("../../data/tse-presidential-results.json", import.meta.url),
);

try {
  const snapshot = await runIngest({ outputPath });
  console.log(
    `Snapshot gravado em ${outputPath} (${Object.keys(snapshot.places).length} lugares, 56 fontes).`,
  );
} catch (error) {
  console.error(error.message);
  if (error instanceof AggregateError) {
    for (const cause of error.errors) {
      console.error(`- ${cause.message}`);
    }
  }
  process.exitCode = 1;
}
