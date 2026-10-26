import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

import { normalizeMunicipalitySearch } from "./municipal-rules.mjs";
import {
  displayMunicipalityName,
  type MunicipalityResult,
} from "./municipal-model";

type MunicipalitySearchProps = {
  municipalities: MunicipalityResult[];
  selectedMunicipality: MunicipalityResult | null;
  onSelectMunicipality: (municipality: MunicipalityResult) => void;
};

const VISIBLE_RESULT_LIMIT = 10;

export function MunicipalitySearch({
  municipalities,
  selectedMunicipality,
  onSelectMunicipality,
}: MunicipalitySearchProps) {
  const id = useId().replaceAll(":", "");
  const listboxId = `municipality-results-${id}`;
  const countId = `municipality-result-count-${id}`;
  const [query, setQuery] = useState(
    selectedMunicipality
      ? displayMunicipalityName(selectedMunicipality.name)
      : "",
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = normalizeMunicipalitySearch(query);
  const results = useMemo(
    () =>
      municipalities.filter((municipality) =>
        normalizeMunicipalitySearch(municipality.name).includes(
          normalizedQuery,
        ),
      ),
    [municipalities, normalizedQuery],
  );
  const visibleResults = results.slice(0, VISIBLE_RESULT_LIMIT);
  const activeResult = visibleResults[activeIndex];

  useEffect(() => {
    setQuery(
      selectedMunicipality
        ? displayMunicipalityName(selectedMunicipality.name)
        : "",
    );
    setOpen(false);
    setActiveIndex(0);
  }, [selectedMunicipality]);

  function select(municipality: MunicipalityResult) {
    setQuery(displayMunicipalityName(municipality.name));
    setOpen(false);
    onSelectMunicipality(municipality);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        visibleResults.length === 0
          ? 0
          : open
            ? (current + 1) % visibleResults.length
            : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        visibleResults.length === 0
          ? 0
          : open
            ? (current - 1 + visibleResults.length) %
              visibleResults.length
            : visibleResults.length - 1,
      );
    } else if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      select(activeResult);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="municipality-search">
      <label htmlFor={`municipality-search-${id}`}>Buscar município</label>
      <div className="combobox-shell">
        <input
          id={`municipality-search-${id}`}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-describedby={countId}
          aria-expanded={open && results.length > 0}
          aria-activedescendant={
            open && activeResult
              ? `municipality-option-${id}-${activeResult.ibgeCode}`
              : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
        {open && results.length > 0 && (
          <ul id={listboxId} role="listbox" aria-label="Municípios encontrados">
            {visibleResults.map((municipality, index) => (
              <li role="none" key={municipality.ibgeCode}>
                <button
                  id={`municipality-option-${id}-${municipality.ibgeCode}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(municipality)}
                >
                  {displayMunicipalityName(municipality.name)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id={countId} className="search-result-count" aria-live="polite">
        {results.length === 1
          ? "1 município encontrado."
          : `${results.length} municípios encontrados.`}
      </p>
    </div>
  );
}
