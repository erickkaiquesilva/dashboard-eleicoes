import { useMemo, useRef, useState } from "react";

import ibgeSvg from "./assets/ibge-br-ufs.svg?raw";
import {
  localBoxToViewBox,
  parseScaleTransform,
  type ViewBox,
} from "./map-camera.mjs";
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
  viewBox?: string;
  interactive?: boolean;
  fadeSelectedFill?: boolean;
  onSelectState: (abbreviation: string) => void;
  onStateBoxes?: (boxes: Record<string, ViewBox>) => void;
};

type Geometry = {
  viewBox: string;
  transform: string;
  paths: Array<{ code: string; data: string }>;
};

export function readGeometry(): Geometry {
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

export function OutsideRing({
  code,
  data,
  idPrefix = "state",
}: {
  code: string;
  data: string;
  idPrefix?: string;
}) {
  const maskId = `${idPrefix}-ring-outside-${code}`;

  return (
    <>
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x="-2000000"
        y="-2000000"
        width="4000000"
        height="4000000"
      >
        <rect
          x="-2000000"
          y="-2000000"
          width="4000000"
          height="4000000"
          fill="white"
        />
        <path d={data} fill="black" />
      </mask>
      <g
        aria-hidden="true"
        className="state-ring"
        mask={`url(#${maskId})`}
      >
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
    </>
  );
}

function measureStateBoxes(svg: SVGSVGElement, transform: string) {
  const scale = parseScaleTransform(transform);
  const boxes: Record<string, ViewBox> = {};

  for (const path of svg.querySelectorAll<SVGGraphicsElement>(
    "path[data-state]",
  )) {
    const abbreviation = path.getAttribute("data-state");
    if (!abbreviation) continue;
    boxes[abbreviation] = localBoxToViewBox(path.getBBox(), scale);
  }

  return boxes;
}

export function BrazilMap({
  snapshot,
  round,
  selectedState,
  viewBox,
  interactive = true,
  fadeSelectedFill = false,
  onSelectState,
  onStateBoxes,
}: BrazilMapProps) {
  const geometry = useMemo(readGeometry, []);
  const measuredRef = useRef(false);
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
      className="map-svg brazil-map-svg"
      viewBox={viewBox ?? geometry.viewBox}
      role="group"
      aria-labelledby="map-title map-instructions"
      aria-hidden={!interactive}
      ref={(node) => {
        if (!node || !onStateBoxes || measuredRef.current) return;
        measuredRef.current = true;
        onStateBoxes(measureStateBoxes(node, geometry.transform));
      }}
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

          const isSelected = selectedState === state.abbreviation;
          const hideFill = fadeSelectedFill && isSelected;

          return (
            <path
              aria-hidden="true"
              key={`shape-${code}`}
              className={
                selectedState && !isSelected ? "state-context" : "state-fill"
              }
              d={data}
              fill={hideFill ? "transparent" : inkFor(result) ?? "transparent"}
              stroke="#F5F5F7"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          );
        })}

        {!fadeSelectedFill &&
          geometry.paths.map(({ code, data }) =>
            activeCodes.has(code) ? (
              <OutsideRing code={code} data={data} key={`ring-${code}`} />
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
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : -1}
              aria-pressed={
                interactive ? selectedState === state.abbreviation : undefined
              }
              aria-label={
                interactive
                  ? `${state.name}: ${leaderLabel(result)} no ${roundName}`
                  : undefined
              }
              fill="#F5F5F7"
              fillOpacity="0.001"
              stroke="transparent"
              strokeWidth="12"
              vectorEffect="non-scaling-stroke"
              pointerEvents={interactive ? "auto" : "none"}
              onClick={() => {
                if (interactive) onSelectState(state.abbreviation);
              }}
              onFocus={() => {
                if (interactive) setFocusedState(state.abbreviation);
              }}
              onBlur={() =>
                setFocusedState((current) =>
                  current === state.abbreviation ? null : current,
                )
              }
              onKeyDown={(event) => {
                if (!interactive) return;
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
