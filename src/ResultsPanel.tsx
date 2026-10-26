import { forwardRef } from "react";

import {
  STATES,
  leaderLabel,
  type PlaceResult,
  type RoundNumber,
  type RoundResult,
} from "./map-model";

type ResultsPanelProps = {
  placeCode: string;
  place: PlaceResult;
  activeRound: RoundNumber;
};

const NUMBER_FORMAT = new Intl.NumberFormat("pt-BR");
const CANDIDATES = [
  { number: "13" as const, name: "Lula" },
  { number: "22" as const, name: "Flávio Bolsonaro" },
];

function placeName(code: string) {
  if (code === "br") return "Brasil";
  return (
    STATES.find((state) => state.abbreviation.toLowerCase() === code)?.name ??
    code.toUpperCase()
  );
}

function roundName(round: RoundNumber) {
  return round === "1" ? "1º turno" : "2º turno";
}

function unavailable(round: RoundResult): round is Extract<
  RoundResult,
  { status: "unavailable" }
> {
  return round.status === "unavailable";
}

export const ResultsPanel = forwardRef<HTMLHeadingElement, ResultsPanelProps>(
  function ResultsPanel({ placeCode, place, activeRound }, headingRef) {
    const firstRound = place.rounds["1"];
    const secondRound = place.rounds["2"];
    const activeResult = place.rounds[activeRound];
    const name = placeName(placeCode);

    if (unavailable(firstRound) || unavailable(secondRound)) {
      const source = unavailable(activeResult)
        ? activeResult.source
        : unavailable(firstRound)
          ? firstRound.source
          : secondRound.source;

      return (
        <section className="results-panel" aria-labelledby="panel-title">
          <h2 id="panel-title" ref={headingRef} tabIndex={-1}>
            {name}
          </h2>
          <p className="leader-callout">
            Os números deste lugar estão indisponíveis.
          </p>
          <p>
            Consulte o{" "}
            <a href={source.url} target="_blank" rel="noreferrer">
              resultado oficial do TSE
            </a>
            .
          </p>
          <a className="source-jump" href="#fontes">
            De onde vêm estes números
          </a>
        </section>
      );
    }

    const availableActiveResult =
      activeRound === "1" ? firstRound : secondRound;
    const activeLeader = availableActiveResult.leader;
    const isOtherLeader =
      activeRound === "1" &&
      activeLeader.status === "leader" &&
      activeLeader.candidateNumber !== "13" &&
      activeLeader.candidateNumber !== "22";
    const leaderText =
      activeLeader.status === "tie"
        ? `Empate entre ${activeLeader.candidates
            .map((candidate) => candidate.officialName)
            .join(" e ")} no ${roundName(activeRound)}.`
        : `${leaderLabel(availableActiveResult)} no ${roundName(activeRound)}.`;

    return (
      <section
        className="results-panel"
        aria-labelledby="panel-title"
        aria-live="polite"
      >
        <h2 id="panel-title" ref={headingRef} tabIndex={-1}>
          {name}
        </h2>

        <p className="leader-callout">{leaderText}</p>

        {isOtherLeader && (
          <p className="other-leader-note">
            {activeLeader.officialName} liderou o 1º turno com{" "}
            {activeLeader.percentage}% dos votos válidos.
          </p>
        )}

        <div className="panel-section">
          <h3>Votos dos finalistas</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Candidato</th>
                  <th scope="col">1º turno</th>
                  <th scope="col">2º turno</th>
                </tr>
              </thead>
              <tbody>
                {CANDIDATES.map((candidate) => (
                  <tr key={candidate.number}>
                    <th scope="row">{candidate.name}</th>
                    {(["1", "2"] as const).map((round) => {
                      const result = place.rounds[round];
                      if (result.status !== "available") return <td key={round}>—</td>;
                      const value = result.candidates[candidate.number];
                      return (
                        <td key={round}>
                          <strong>{value.percentage}%</strong>
                          <span>{NUMBER_FORMAT.format(value.votes)} votos</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel-section">
          <h3>Variação do 1º para o 2º turno</h3>
          <ul className="metric-list">
            {CANDIDATES.map((candidate) => {
              const variation = place.variation[candidate.number];
              return (
                <li key={candidate.number}>
                  <span>{candidate.name}</span>
                  <strong>
                    {variation.status === "available"
                      ? `${variation.direction} ${variation.percentagePoints.replace(
                          /^-/,
                          "",
                        )} p.p.`
                      : "indisponível"}
                  </strong>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel-section">
          <h3>Comparecimento</h3>
          <ul className="metric-list">
            {(["1", "2"] as const).map((round) => {
              const result = place.rounds[round];
              return (
                <li key={round}>
                  <span>{roundName(round)}</span>
                  <strong>
                    {result.status === "available"
                      ? `${result.turnout.percentage}% · ${NUMBER_FORMAT.format(
                          result.turnout.votes,
                        )} pessoas`
                      : "indisponível"}
                  </strong>
                </li>
              );
            })}
          </ul>
        </div>

        {placeCode === "br" && (
          <p className="national-note">
            O total do Brasil é o arquivo nacional oficial do TSE. O mapa não
            desenha o voto do exterior como uma unidade.
          </p>
        )}

        <a className="source-jump" href="#fontes">
          De onde vêm estes números
        </a>
      </section>
    );
  },
);
