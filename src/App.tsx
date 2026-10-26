import { useEffect, useRef, useState } from "react";

import plans from "../data/government-plans.json";
import snapshotJson from "../data/tse-presidential-results.json";
import { BrazilMap } from "./BrazilMap";
import {
  INKS,
  STATES,
  hasOtherLeader,
  type ElectionSnapshot,
} from "./map-model";
import { Proposals } from "./Proposals";
import { ResultsPanel } from "./ResultsPanel";
import { parsePath, pathFor, type PageRoute } from "./route";
import { Sources } from "./Sources";

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
    route.place === "br" ? null : route.place.toUpperCase();
  const selectedName = STATES.find(
    (state) => state.abbreviation === selectedState,
  )?.name;

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
    const place =
      route.place === "br"
        ? "Brasil"
        : STATES.find(
            (state) =>
              state.abbreviation.toLowerCase() === route.place,
          )?.name;
    document.title = `${place ?? "Brasil"} · ${
      route.round === "1" ? "1º turno" : "2º turno"
    } · Eleição 2026`;
  }, [route]);

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
      </div>

      <section className="map-section" aria-labelledby="section-title">
        <div className="stage">
          <div className="map-column">
            <div className="map-heading">
              <h2 id="section-title">Mapa do Brasil</h2>
              <p>
                Quem ficou à frente no{" "}
                {route.round === "1" ? "1º turno" : "2º turno"}.
              </p>
            </div>
            <div className="map-frame">
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
            </div>

            <div className="map-key" aria-label="Legenda do mapa">
              <h3>Legenda</h3>
              <ul>
                <LegendItem color={INKS.lula}>Lula</LegendItem>
                <LegendItem color={INKS.flavio}>
                  Flávio Bolsonaro
                </LegendItem>
                {hasOtherLeader(snapshot, route.round) && (
                  <LegendItem color={INKS.other}>Outro candidato</LegendItem>
                )}
              </ul>
              <p className="selection-status" aria-live="polite">
                {selectedName
                  ? `Unidade selecionada: ${selectedName}.`
                  : "Brasil selecionado."}
              </p>
            </div>
          </div>

          <ResultsPanel
            ref={panelHeadingRef}
            placeCode={route.place}
            place={snapshot.places[route.place]}
            activeRound={route.round}
          />
        </div>
      </section>

      <Proposals />
      <Sources snapshot={snapshot} />

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
