import { useEffect, useMemo, useRef, useState } from "react";

import plans from "../data/government-plans.json";
import snapshotJson from "../data/tse-presidential-results.json";
import { BrazilMap } from "./BrazilMap";
import { MunicipalMap } from "./MunicipalMap";
import { MunicipalitySearch } from "./MunicipalitySearch";
import {
  INKS,
  STATES,
  hasOtherLeader,
  type ElectionSnapshot,
} from "./map-model";
import {
  displayMunicipalityName,
  hasOtherMunicipalLeader,
} from "./municipal-model";
import { summarizeMunicipalities } from "./municipal-rules.mjs";
import { Proposals } from "./Proposals";
import { ResultsPanel } from "./ResultsPanel";
import { parsePath, pathFor, type PageRoute } from "./route";
import { Sources } from "./Sources";
import { useMunicipalData } from "./useMunicipalData";

const snapshot = snapshotJson as ElectionSnapshot;

function LegendItem({ color, children }: { color: string; children: string }) {
  return (
    <li>
      <span
        className="legend-swatch"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {children}
    </li>
  );
}

export default function App() {
  const initial = parsePath(window.location.pathname);
  const [route, setRoute] = useState<PageRoute>(initial.route);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);
  const selectedState =
    route.place === "br" || route.place === "zz"
      ? null
      : route.place.toUpperCase();
  const selectedName = STATES.find(
    (state) => state.abbreviation === selectedState,
  )?.name;
  const stateUf = selectedState?.toLowerCase() ?? null;
  const municipalLoad = useMunicipalData(stateUf);
  const municipalData =
    municipalLoad.status === "success"
      ? municipalLoad.loaded.data
      : undefined;
  const municipalGeometry =
    municipalLoad.status === "success"
      ? municipalLoad.loaded.geometry
      : undefined;
  const selectedMunicipality =
    route.municipality && municipalData
      ? municipalData.municipalities.find(
          (municipality) => municipality.slug === route.municipality,
        ) ?? null
      : null;
  const selectedMunicipalityName = selectedMunicipality
    ? displayMunicipalityName(selectedMunicipality.name)
    : undefined;
  const municipalSummary = useMemo(
    () =>
      municipalData
        ? summarizeMunicipalities(municipalData.municipalities)
        : undefined,
    [municipalData],
  );

  useEffect(() => {
    const current = parsePath(window.location.pathname);
    if (current.needsReplace) {
      window.history.replaceState(null, "", current.canonicalPath);
    }
    setRoute(current.route);

    const restoreRoute = () => {
      const restored = parsePath(window.location.pathname);
      if (restored.needsReplace) {
        window.history.replaceState(null, "", restored.canonicalPath);
      }
      setRoute(restored.route);
    };
    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  }, []);

  useEffect(() => {
    if (
      !route.municipality ||
      municipalLoad.status !== "success" ||
      selectedMunicipality
    ) {
      return;
    }
    const stateRoute: PageRoute = {
      place: route.place,
      round: route.round,
    };
    window.history.replaceState(null, "", pathFor(stateRoute));
    setRoute(stateRoute);
  }, [
    municipalLoad.status,
    route.municipality,
    route.place,
    route.round,
    selectedMunicipality,
  ]);

  useEffect(() => {
    const place =
      selectedMunicipalityName ??
      (route.place === "br"
        ? "Brasil"
        : route.place === "zz"
          ? "Exterior"
        : STATES.find(
            (state) =>
              state.abbreviation.toLowerCase() === route.place,
          )?.name);
    document.title = `${place ?? "Brasil"} · ${
      route.round === "1" ? "1º turno" : "2º turno"
    } · Eleição 2026`;
  }, [route, selectedMunicipalityName]);

  function navigate(next: PageRoute, focusPanel = false) {
    const nextPath = pathFor(next);
    if (nextPath !== pathFor(route)) {
      window.history.pushState(null, "", nextPath);
      setRoute(next);
    }

    if (
      focusPanel &&
      window.matchMedia("(max-width: 900px)").matches
    ) {
      window.requestAnimationFrame(() => panelHeadingRef.current?.focus());
    }
  }

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">Eleição presidencial de 2026</p>
        <h1>Como cada estado votou para presidente</h1>
        <p className="introduction">
          Compare Lula (PT, 13) e Flávio Bolsonaro (PL, 22) no 1º turno,
          em 4 de outubro, e no 2º turno, em 25 de outubro de 2026. Os
          números são votos apurados pelo TSE.
        </p>
      </header>

      <div className="page-controls" aria-label="Controles da leitura">
        <div className="round-control" role="group" aria-label="Turno do mapa">
          <button
            type="button"
            aria-pressed={route.round === "1"}
            onClick={() => navigate({ ...route, round: "1" })}
          >
            1º turno
          </button>
          <button
            type="button"
            aria-pressed={route.round === "2"}
            onClick={() => navigate({ ...route, round: "2" })}
          >
            2º turno
          </button>
        </div>
        <div className="place-controls" role="group" aria-label="Lugar">
          <button
            className="brazil-control"
            type="button"
            aria-pressed={route.place === "br"}
            onClick={() =>
              navigate({ place: "br", round: route.round }, true)
            }
          >
            Brasil
          </button>
          <button
            className="brazil-control"
            type="button"
            aria-pressed={route.place === "zz"}
            onClick={() =>
              navigate({ place: "zz", round: route.round }, true)
            }
          >
            Exterior
          </button>
        </div>
      </div>

      <section className="map-section" aria-labelledby="section-title">
        <div className="stage">
          <div className="map-column">
            {selectedState && selectedName && (
              <nav className="breadcrumb" aria-label="Navegação por lugar">
                <ol>
                  <li>
                    <a
                      href={pathFor({ place: "br", round: route.round })}
                      onClick={(event) => {
                        event.preventDefault();
                        navigate({ place: "br", round: route.round });
                      }}
                    >
                      Brasil
                    </a>
                  </li>
                  <li>
                    <a
                      href={pathFor({
                        place: route.place,
                        round: route.round,
                      })}
                      aria-current={
                        selectedMunicipality ? undefined : "page"
                      }
                      onClick={(event) => {
                        event.preventDefault();
                        navigate({
                          place: route.place,
                          round: route.round,
                        });
                      }}
                    >
                      {selectedName}
                    </a>
                  </li>
                  {selectedMunicipality && (
                    <li>
                      <a
                        href={pathFor(route)}
                        aria-current="page"
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(route);
                        }}
                      >
                        {selectedMunicipalityName}
                      </a>
                    </li>
                  )}
                </ol>
              </nav>
            )}

            <div className="map-heading">
              <h2 id="section-title">
                {selectedName
                  ? `Municípios de ${selectedName}`
                  : "Mapa do Brasil"}
              </h2>
              <p>
                Quem ficou à frente no{" "}
                {route.round === "1" ? "1º turno" : "2º turno"}.
              </p>
            </div>

            {municipalData && (
              <MunicipalitySearch
                municipalities={municipalData.municipalities}
                selectedMunicipality={selectedMunicipality}
                onSelectMunicipality={(municipality) =>
                  navigate(
                    {
                      ...route,
                      municipality: municipality.slug,
                    },
                    true,
                  )
                }
              />
            )}

            <div className="map-frame">
              {selectedName ? (
                municipalLoad.status === "loading" ? (
                  <div className="map-load-state" role="status">
                    <span className="loading-indicator" aria-hidden="true" />
                    Carregando os municípios de {selectedName}…
                  </div>
                ) : municipalLoad.status === "error" ? (
                  <div className="map-load-state map-load-error" role="alert">
                    <strong>Não foi possível carregar o mapa municipal.</strong>
                    <span>
                      O total de {selectedName} continua disponível no painel.
                    </span>
                  </div>
                ) : municipalData && municipalGeometry ? (
                  <MunicipalMap
                    data={municipalData}
                    geometry={municipalGeometry}
                    round={route.round}
                    selectedMunicipality={selectedMunicipality}
                    stateName={selectedName}
                    onSelectMunicipality={(municipality) =>
                      navigate(
                        {
                          ...route,
                          municipality: municipality.slug,
                        },
                        true,
                      )
                    }
                  />
                ) : null
              ) : (
                <BrazilMap
                  snapshot={snapshot}
                  round={route.round}
                  selectedState={selectedState}
                  onSelectState={(abbreviation) =>
                    navigate(
                      {
                        place: abbreviation.toLowerCase(),
                        round: route.round,
                      },
                      true,
                    )
                  }
                />
              )}
            </div>

            <div className="map-key" aria-label="Legenda do mapa">
              <h3>Legenda</h3>
              <ul>
                <LegendItem color={INKS.lula}>Lula</LegendItem>
                <LegendItem color={INKS.flavio}>
                  Flávio Bolsonaro
                </LegendItem>
                {(municipalData
                  ? hasOtherMunicipalLeader(municipalData, route.round)
                  : hasOtherLeader(snapshot, route.round)) && (
                  <LegendItem color={INKS.other}>Outro candidato</LegendItem>
                )}
              </ul>
              <p className="selection-status" aria-live="polite">
                {selectedMunicipality
                  ? `Município selecionado: ${selectedMunicipalityName}.`
                  : selectedName
                  ? `Unidade selecionada: ${selectedName}.`
                  : route.place === "zz"
                    ? "Exterior selecionado."
                    : "Brasil selecionado."}
              </p>
            </div>
          </div>

          <ResultsPanel
            ref={panelHeadingRef}
            placeCode={route.place}
            place={
              selectedMunicipality ?? snapshot.places[route.place]
            }
            displayName={selectedMunicipalityName}
            activeRound={route.round}
            municipalSummary={
              selectedState && !selectedMunicipality
                ? municipalSummary
                : undefined
            }
            officialResultUrl={
              selectedMunicipality?.rounds[route.round].source.url
            }
            onSelectExterior={() =>
              navigate({ place: "zz", round: route.round }, true)
            }
          />
        </div>
      </section>

      <Proposals />
      <Sources snapshot={snapshot} municipalData={municipalData} />

      <footer>
        <p>
          Dados eleitorais e documentos: Tribunal Superior Eleitoral. Malha:
          IBGE.
        </p>
        <a href={plans.sourcePage}>Consultar propostas no TSE</a>
      </footer>
    </main>
  );
}
