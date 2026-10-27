import { useMemo } from "react";

import { OutsideRing } from "./BrazilMap";
import { inkFor, type RoundNumber } from "./map-model";
import type {
  MunicipalGeometry,
  MunicipalUfData,
  MunicipalityResult,
} from "./municipal-model";

type MunicipalMapProps = {
  data: MunicipalUfData;
  geometry: MunicipalGeometry;
  round: RoundNumber;
  selectedMunicipality: MunicipalityResult | null;
  stateName: string;
  viewBox?: string;
  visible?: boolean;
  onSelectMunicipality: (municipality: MunicipalityResult) => void;
};

export function MunicipalMap({
  data,
  geometry,
  round,
  selectedMunicipality,
  stateName,
  viewBox,
  visible = true,
  onSelectMunicipality,
}: MunicipalMapProps) {
  const municipalityByCode = useMemo(
    () =>
      new Map(
        data.municipalities.map((municipality) => [
          municipality.ibgeCode,
          municipality,
        ]),
      ),
    [data],
  );
  const selectedCode = selectedMunicipality?.ibgeCode;

  return (
    <svg
      className={
        visible
          ? "map-svg municipal-map-svg is-visible"
          : "map-svg municipal-map-svg"
      }
      viewBox={viewBox ?? geometry.viewBox}
      role="img"
      aria-labelledby="municipal-map-title municipal-map-description"
      aria-hidden={!visible}
    >
      <title id="municipal-map-title">
        Mapa eleitoral dos municípios de {stateName}
      </title>
      <desc id="municipal-map-description">
        Selecione pelo mapa com mouse ou toque. Para usar o teclado, use a
        busca de município acima do mapa.
      </desc>

      <g transform={geometry.transform}>
        {geometry.paths.map(({ code, data: pathData }) => {
          const municipality = municipalityByCode.get(code);
          if (!municipality) return null;
          return (
            <path
              aria-hidden="true"
              key={`shape-${code}`}
              d={pathData}
              fill={inkFor(municipality.rounds[round]) ?? "transparent"}
              stroke="#F5F5F7"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          );
        })}

        {selectedCode
          ? geometry.paths
              .filter(({ code }) => code === selectedCode)
              .map(({ code, data: pathData }) => (
                <OutsideRing
                  code={code}
                  data={pathData}
                  idPrefix="municipality"
                  key={`ring-${code}`}
                />
              ))
          : null}

        {geometry.paths.map(({ code, data: pathData }) => {
          const municipality = municipalityByCode.get(code);
          if (!municipality) return null;
          return (
            <path
              aria-hidden="true"
              className="municipality-pointer-target"
              data-municipality={municipality.slug}
              key={`pointer-${code}`}
              d={pathData}
              fill="#F5F5F7"
              fillOpacity="0.001"
              stroke="transparent"
              strokeWidth="6"
              vectorEffect="non-scaling-stroke"
              onClick={() => onSelectMunicipality(municipality)}
            />
          );
        })}
      </g>
    </svg>
  );
}
