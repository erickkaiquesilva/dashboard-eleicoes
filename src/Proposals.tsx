import plans from "../data/government-plans.json";

const CANDIDATE_NUMBERS = ["13", "22"] as const;

export function Proposals() {
  return (
    <section className="content-section proposals-section" aria-labelledby="proposals-title">
      <div className="section-heading">
        <p className="eyebrow">Documentos oficiais</p>
        <h2 id="proposals-title">Propostas de governo</h2>
        <p>
          Os planos são nacionais e não mudam conforme o estado. Os títulos
          abaixo reproduzem o sumário dos PDFs registrados no TSE, sem resumo
          ou reescrita.
        </p>
      </div>

      <div className="proposal-grid">
        {CANDIDATE_NUMBERS.map((number) => {
          const candidate = plans.candidates[number];
          return (
            <article className="proposal-card" key={number}>
              <p className="candidate-meta">
                {candidate.party} · {candidate.number}
              </p>
              <h3>{candidate.name}</h3>
              <a
                className="document-link"
                href={candidate.pdfUrl}
                target="_blank"
                rel="noreferrer"
              >
                {candidate.documentTitle}
              </a>
              <ol>
                {candidate.headings.map((heading) => (
                  <li key={heading.title}>
                    <a
                      href={`${candidate.pdfUrl}#page=${heading.page}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {heading.title}
                    </a>
                  </li>
                ))}
              </ol>
            </article>
          );
        })}
      </div>
    </section>
  );
}
