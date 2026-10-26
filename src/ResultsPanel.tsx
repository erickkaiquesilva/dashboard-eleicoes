import { forwardRef } from "react";

import {
  compareFinalistPercentages,
  describeGapComparison,
} from "./comparison.mjs";
import {
  STATES,
  leaderLabel,
  type PlaceResult,
  type RoundNumber,
  type RoundResult,
} from "./map-model";
import type {
  MunicipalRoundSummary,
  MunicipalSummary,
} from "./municipal-rules.mjs";

type ResultsPanelProps = {
  placeCode: string;
  place: PlaceResult;
  activeRound: RoundNumber;
  onSelectExterior: () => void;
  displayName?: string;
  municipalSummary?: MunicipalSummary;
  officialResultUrl?: string;
};

const NUMBER_FORMAT = new Intl.NumberFormat("pt-BR");
const CANDIDATES = [
  { number: "13" as const, name: "Lula" },
  { number: "22" as const, name: "Flávio Bolsonaro" },
];

function placeName(code: string) {
  if (code === "br") return "Brasil";
  if (code === "zz") return "Exterior";
  return (
    STATES.find((state) => state.abbreviation.toLowerCase() === code)?.name ??
    code.toUpperCase()
  );
}

function roundName(round: RoundNumber) {
  return round === "1" ? "1º turno" : "2º turno";
}

function municipalityCount(count: number) {
  return `${NUMBER_FORMAT.format(count)} ${
    count === 1 ? "município" : "municípios"
  }`;
}

function MunicipalRoundSummaryView({
  round,
  summary,
}: {
  round: RoundNumber;
  summary: MunicipalRoundSummary;
}) {
  const otherLeaders = Object.entries(summary.leaders).filter(
    ([candidate]) => candidate !== "13" && candidate !== "22",
  );
  const otherTotal = otherLeaders.reduce(
    (total, [, count]) => total + count,
    0,
  );

  return (
    <div className="municipal-summary-round">
      <h4>{roundName(round)}</h4>
      <p>
        Lula liderou em {municipalityCount(summary.leaders["13"] ?? 0)} e
        Flávio Bolsonaro, em{" "}
        {municipalityCount(summary.leaders["22"] ?? 0)}.
      </p>
      {otherTotal > 0 && (
        <p>
          {otherLeaders.length === 1
            ? "Outro candidato liderou: "
            : "Outros candidatos lideraram: "}
          {otherLeaders
            .map(
              ([candidate, count]) =>
                `${summary.leaderNames[candidate] ?? `Candidato ${candidate}`} em ${municipalityCount(count)}`,
            )
            .join("; ")}
          .
        </p>
      )}
      {summary.ties > 0 && (
        <p>Houve empate em {municipalityCount(summary.ties)}.</p>
      )}
      {summary.unavailable > 0 && (
        <p>
          O resultado ficou indisponível em{" "}
          {municipalityCount(summary.unavailable)}.
        </p>
      )}
    </div>
  );
}

function unavailable(round: RoundResult): round is Extract<
  RoundResult,
  { status: "unavailable" }
> {
  return round.status === "unavailable";
}

export const ResultsPanel = forwardRef<HTMLHeadingElement, ResultsPanelProps>(
  function ResultsPanel(
    {
      placeCode,
      place,
      activeRound,
      onSelectExterior,
      displayName,
      municipalSummary,
      officialResultUrl,
    },
    headingRef,
  ) {
    const firstRound = place.rounds["1"];
    const secondRound = place.rounds["2"];
    const activeResult = place.rounds[activeRound];
    const name = displayName ?? placeName(placeCode);

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
    const comparison = compareFinalistPercentages(
      {
        "13": firstRound.candidates["13"].percentage,
        "22": firstRound.candidates["22"].percentage,
      },
      {
        "13": secondRound.candidates["13"].percentage,
        "22": secondRound.candidates["22"].percentage,
      },
    );
    const variations = CANDIDATES.map((candidate) => ({
      ...candidate,
      variation: place.variation[candidate.number],
    }));
    const variationSentence =
      variations.every(
        ({ variation }) => variation.status === "available",
      ) &&
      variations[0].variation.status === "available" &&
      variations[1].variation.status === "available"
        ? variations[0].variation.direction ===
            variations[1].variation.direction &&
          variations[0].variation.direction !== "ficou igual"
          ? `Lula ${variations[0].variation.direction} ${variations[0].variation.percentagePoints.replace(
              /^-/,
              "",
            )} pontos e Flávio Bolsonaro, ${variations[1].variation.percentagePoints.replace(
              /^-/,
              "",
            )}.`
          : variations
              .map(({ name: candidateName, variation }) =>
                variation.status === "available"
                  ? variation.direction === "ficou igual"
                    ? `${candidateName} ficou igual, em ${variation.percentagePoints} pontos`
                    : `${candidateName} ${variation.direction} ${variation.percentagePoints.replace(
                        /^-/,
                        "",
                      )} pontos`
                  : "",
              )
              .join("; ") + "."
        : "";
    const gapSentence = describeGapComparison(comparison);

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

        {municipalSummary && (
          <div className="panel-section municipal-summary">
            <h3>Resumo dos municípios</h3>
            <MunicipalRoundSummaryView
              round="1"
              summary={municipalSummary.perRound["1"]}
            />
            <MunicipalRoundSummaryView
              round="2"
              summary={municipalSummary.perRound["2"]}
            />
            <p className="swap-summary">
              O líder mudou entre os turnos em{" "}
              {municipalityCount(municipalSummary.swaps)}.
            </p>
          </div>
        )}

        <div className="panel-section">
          <h3>Votos dos finalistas</h3>
          <div className="candidate-bars">
            {CANDIDATES.map((candidate) => (
              <div className="candidate-bar-group" key={candidate.number}>
                {(["1", "2"] as const).map((round) => {
                  const result = place.rounds[round];
                  if (result.status !== "available") return null;
                  const value = result.candidates[candidate.number];
                  const width = Number(value.percentage.replace(",", "."));
                  return (
                    <div
                      className="bar-result"
                      key={round}
                      role="img"
                      aria-label={`${candidate.name}, ${roundName(round)}: ${
                        value.percentage
                      }% dos votos válidos, ${NUMBER_FORMAT.format(
                        value.votes,
                      )} votos`}
                    >
                      <div className="bar-label">
                        <span>
                          {candidate.name} · {roundName(round)}
                        </span>
                        <strong>{value.percentage}%</strong>
                        <span>{NUMBER_FORMAT.format(value.votes)} votos</span>
                      </div>
                      <div className="bar-track" aria-hidden="true">
                        <span
                          className="bar-fill"
                          style={{
                            width: `${width}%`,
                            backgroundColor:
                              candidate.number === "13"
                                ? "#002776"
                                : "#009C3B",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="comparison-summary">
            {variationSentence} {gapSentence}
          </p>
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
            desenha o{" "}
            <a
              href={`/exterior/${activeRound}`}
              onClick={(event) => {
                event.preventDefault();
                onSelectExterior();
              }}
            >
              voto do exterior
            </a>{" "}
            como uma unidade.
          </p>
        )}

        {officialResultUrl && (
          <a
            className="official-result-link"
            href={officialResultUrl}
            target="_blank"
            rel="noreferrer"
          >
            Abrir resultado oficial deste município no TSE
          </a>
        )}

        <a className="source-jump" href="#fontes">
          De onde vêm estes números
        </a>
      </section>
    );
  },
);
