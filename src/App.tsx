import { useState } from "react";

import snapshotJson from "../data/tse-presidential-results.json";
import { BrazilMap } from "./BrazilMap";
import {
  INKS,
  STATES,
  hasOtherLeader,
  type ElectionSnapshot,
  type RoundNumber,
} from "./map-model";

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
  const [round, setRound] = useState<RoundNumber>("2");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const selectedName = STATES.find(
    (state) => state.abbreviation === selectedState,
  )?.name;

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">Eleição presidencial de 2026</p>
        <h1>Quem ficou à frente em cada estado</h1>
        <p className="introduction">
          Compare o desempenho de Lula e Flávio Bolsonaro no 1º e no 2º
          turno. Escolha uma unidade no mapa para marcá-la.
        </p>
      </header>

      <section className="map-section" aria-labelledby="section-title">
        <div className="map-toolbar">
          <div>
            <h2 id="section-title">Mapa do Brasil</h2>
            <p>Selecione o turno que deseja desenhar.</p>
          </div>

          <div className="round-control" role="group" aria-label="Turno do mapa">
            <button
              type="button"
              aria-pressed={round === "1"}
              onClick={() => setRound("1")}
            >
              1º turno
            </button>
            <button
              type="button"
              aria-pressed={round === "2"}
              onClick={() => setRound("2")}
            >
              2º turno
            </button>
          </div>
        </div>

        <div className="map-layout">
          <div className="map-frame">
            <BrazilMap
              snapshot={snapshot}
              round={round}
              selectedState={selectedState}
              onSelectState={setSelectedState}
            />
          </div>

          <aside className="map-key" aria-label="Legenda do mapa">
            <h3>Quem ficou à frente</h3>
            <ul>
              <LegendItem color={INKS.lula}>Lula</LegendItem>
              <LegendItem color={INKS.flavio}>
                Flávio Bolsonaro
              </LegendItem>
              {hasOtherLeader(snapshot, round) && (
                <LegendItem color={INKS.other}>Outro candidato</LegendItem>
              )}
            </ul>
            <p className="selection-status" aria-live="polite">
              {selectedName
                ? `Unidade selecionada: ${selectedName}.`
                : "Nenhuma unidade selecionada."}
            </p>
            <p className="keyboard-hint">
              Pelo teclado, use Tab para navegar e Enter ou Espaço para
              selecionar.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
