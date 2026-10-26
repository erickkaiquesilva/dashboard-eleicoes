import { useMemo, useState } from "react";

import ibgeSvg from "./assets/ibge-br-ufs.svg?raw";
import {
  STATES,
  inkFor,
  leaderLabel,
  resultFor,
  type ElectionSnapshot,
  type RoundNumber,
} from "./map-model";

type BrazilMapProps = {
  snapshot: ElectionSnapshot;
  round: RoundNumber;
  selectedState: string | null;
  onSelectState: (abbreviation: string) => void;
};

type Geometry = {
  viewBox: string;
  transform: string;
  paths: Array<{ code: string; data: string }>;
};

function readGeometry(): Geometry {
  const document = new DOMParser().parseFromString(ibgeSvg, "image/svg+xml");
  const svg = document.documentElement;
  const group = svg.querySelector("g");
  const paths = Array.from(svg.querySelectorAll("path")).map((path) => ({
    code: path.id,
    data: path.getAttribute("d") ?? "",
  }));
  const knownCodes = new Set(STATES.map((state) => state.code));

  if (
    svg.nodeName === "parsererror" ||
    paths.length !== STATES.length ||
    paths.some(
      ({ code, data }) => !knownCodes.has(code) || data.length === 0,
    )
  ) {
    throw new Error("A malha do IBGE não contém as 27 unidades esperadas.");
  }

  return {
    viewBox: svg.getAttribute("viewBox") ?? "0 0 1080 1080",
    transform: group?.getAttribute("transform") ?? "",
    paths,
  };
}

function Ring({ data }: { data: string }) {
  return (
    <g aria-hidden="true" className="state-ring">
      <path
        d={data}
        fill="none"
        stroke="#1D1D1F"
        strokeWidth="12"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={data}
        fill="none"
        stroke="#FFDF00"
        strokeWidth="8"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={data}
        fill="none"
        stroke="#F5F5F7"
        strokeWidth="4"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

export function BrazilMap({
  snapshot,
  round,
  selectedState,
  onSelectState,
}: BrazilMapProps) {
  const geometry = useMemo(readGeometry, []);
  const [focusedState, setFocusedState] = useState<string | null>(null);
  const stateByCode = useMemo(
    () => new Map(STATES.map((state) => [state.code, state])),
    [],
  );
  const activeCodes = new Set(
    [selectedState, focusedState]
      .filter((state): state is string => state !== null)
      .map(
        (abbreviation) =>
          STATES.find((state) => state.abbreviation === abbreviation)?.code,
      )
      .filter((code): code is string => code !== undefined),
  );

  return (
    <svg
      className="map-svg"
      viewBox={geometry.viewBox}
      role="group"
      aria-labelledby="map-title map-instructions"
    >
      <title id="map-title">Mapa eleitoral do Brasil</title>
      <desc id="map-instructions">
        Use Tab para percorrer as unidades e Enter ou Espaço para selecionar.
      </desc>

      <g transform={geometry.transform}>
        {geometry.paths.map(({ code, data }) => {
          const state = stateByCode.get(code);
          if (!state) return null;
          const result = resultFor(snapshot, state.abbreviation, round);

          return (
            <path
              aria-hidden="true"
              key={`shape-${code}`}
              d={data}
              fill={inkFor(result) ?? "transparent"}
              stroke="#F5F5F7"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          );
        })}

        {geometry.paths.map(({ code, data }) =>
          activeCodes.has(code) ? (
            <Ring data={data} key={`ring-${code}`} />
          ) : null,
        )}

        {geometry.paths.map(({ code, data }) => {
          const state = stateByCode.get(code);
          if (!state) return null;
          const result = resultFor(snapshot, state.abbreviation, round);
          const roundName = round === "1" ? "1º turno" : "2º turno";

          return (
            <path
              key={`button-${code}`}
              data-state={state.abbreviation}
              d={data}
              role="button"
              tabIndex={0}
              aria-pressed={selectedState === state.abbreviation}
              aria-label={`${state.name}: ${leaderLabel(result)} no ${roundName}`}
              fill="#F5F5F7"
              fillOpacity="0.001"
              stroke="transparent"
              strokeWidth="12"
              vectorEffect="non-scaling-stroke"
              onClick={() => onSelectState(state.abbreviation)}
              onFocus={() => setFocusedState(state.abbreviation)}
              onBlur={() =>
                setFocusedState((current) =>
                  current === state.abbreviation ? null : current,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectState(state.abbreviation);
                }
              }}
            />
          );
        })}
      </g>
    </svg>
  );
}
