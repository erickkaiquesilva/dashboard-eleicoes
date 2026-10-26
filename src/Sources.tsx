import plans from "../data/government-plans.json";
import { STATES, type ElectionSnapshot, type RoundNumber } from "./map-model";
import type { MunicipalUfData } from "./municipal-model";

const IBGE_URL =
  "https://servicodados.ibge.gov.br/api/v4/malhas/paises/BR?intrarregiao=UF&qualidade=minima&formato=image/svg+xml";
const PLACE_ORDER = [
  { code: "br", name: "Brasil" },
  ...STATES.map((state) => ({
    code: state.abbreviation.toLowerCase(),
    name: state.name,
  })),
  { code: "zz", name: "Exterior" },
];
const PLAN_READ_DATE = plans.readDate.split("-").reverse().join("/");

function roundName(round: RoundNumber) {
  return round === "1" ? "1º turno" : "2º turno";
}

export function Sources({
  snapshot,
  municipalData,
}: {
  snapshot: ElectionSnapshot;
  municipalData?: MunicipalUfData;
}) {
  const municipalResultFileCount = municipalData?.municipalities.reduce(
    (count, municipality) =>
      count +
      Number(municipality.rounds["1"].status === "available") +
      Number(municipality.rounds["2"].status === "available"),
    0,
  );

  return (
    <section className="content-section sources-section" id="fontes" aria-labelledby="sources-title">
      <div className="section-heading">
        <p className="eyebrow">Transparência</p>
        <h2 id="sources-title">Fontes</h2>
        <p>
          O mapa e o painel usam o snapshot dos resultados oficiais. As
          propostas apontam para os documentos registrados no TSE.
        </p>
      </div>

      <div className="source-groups">
        <article>
          <h3>Mapa e painel</h3>
          <p>
            Resultados por lugar publicados pelo TSE e gravados no snapshot em{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date(snapshot.generatedAt))}
            .
          </p>
          {(["1", "2"] as const).map((round) => (
            <details key={round}>
              <summary>
                Arquivos do {roundName(round)} · {PLACE_ORDER.length} lugares
              </summary>
              <ul className="file-list">
                {PLACE_ORDER.map(({ code, name }) => {
                  const result = snapshot.places[code].rounds[round];
                  return (
                    <li key={code}>
                      <a
                        href={result.source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {name}
                      </a>
                      <span>
                        Arquivo de {result.source.dg}, {result.source.hg} · ID{" "}
                        {result.source.idg}
                      </span>
                      <code>SHA-256 {result.source.sha256}</code>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </article>

        <article>
          <h3>Contorno do mapa</h3>
          <p>
            <a href={IBGE_URL} target="_blank" rel="noreferrer">
              Malha das unidades da federação, qualidade mínima — IBGE
            </a>
            . Arquivo lido em 26/10/2026 e incluído no site; o navegador não
            consulta o IBGE.
          </p>
        </article>

        {municipalData && (
          <article>
            <h3>Dados dos municípios de {municipalData.uf.toUpperCase()}</h3>
            <p>
              {new Intl.NumberFormat("pt-BR").format(
                municipalResultFileCount ?? 0,
              )}{" "}
              arquivos de resultado lidos para{" "}
              {new Intl.NumberFormat("pt-BR").format(
                municipalData.municipalityCount,
              )}{" "}
              municípios desta UF, carregados somente ao abrir o estado.
            </p>
            <ul className="municipal-source-list">
              {(["1", "2"] as const).map((round) => (
                <li key={round}>
                  <a
                    href={municipalData.configs[round].url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Configuração municipal do {roundName(round)} — TSE
                  </a>
                  <code>
                    SHA-256 {municipalData.configs[round].sha256}
                  </code>
                </li>
              ))}
              <li>
                <a
                  href={municipalData.outline.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Malha municipal de {municipalData.uf.toUpperCase()} — IBGE
                </a>
                <code>SHA-256 {municipalData.outline.sha256}</code>
              </li>
            </ul>
            <p>
              Cada resultado municipal segue o endereço oficial do TSE:
            </p>
            <code className="url-pattern">
              https://resultados.tse.jus.br/oficial/ele2026/
              {"{eleição}"}/dados/{"{uf}"}/{"{uf}{código-tse}"}
              -c0001-e00{"{eleição}"}-u.json
            </code>
          </article>
        )}

        <article>
          <h3>Planos de governo</h3>
          <p>
            <a href={plans.sourcePage} target="_blank" rel="noreferrer">
              Página de propostas do 2º turno — TSE
            </a>
            , consultada em {PLAN_READ_DATE}.
          </p>
          <ul className="plan-source-list">
            {(["13", "22"] as const).map((number) => {
              const candidate = plans.candidates[number];
              return (
                <li key={number}>
                  <a
                    href={candidate.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF de {candidate.name}
                  </a>
                  <code>SHA-256 {candidate.sha256}</code>
                </li>
              );
            })}
          </ul>
          <p>
            Cópias conferidas no{" "}
            <a href={plans.openDataArchive}>arquivo aberto oficial do TSE</a>.
          </p>
        </article>
      </div>

      <p className="minister-note">
        Nomes de ministros não constam do material oficial usado aqui; por
        isso, não há uma lista de equipe nesta página.
      </p>
    </section>
  );
}
