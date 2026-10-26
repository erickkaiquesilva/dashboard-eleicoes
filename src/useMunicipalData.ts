import { useEffect, useState } from "react";

import {
  readMunicipalGeometry,
  type MunicipalGeometry,
  type MunicipalUfData,
} from "./municipal-model";

type LoadedMunicipalData = {
  data: MunicipalUfData;
  geometry: MunicipalGeometry;
};

export type MunicipalLoadState =
  | { status: "idle"; loaded: null }
  | { status: "loading"; loaded: null; uf: string }
  | { status: "error"; loaded: null; message: string; uf: string }
  | { status: "success"; loaded: LoadedMunicipalData; uf: string };

const cache = new Map<string, LoadedMunicipalData>();

export function useMunicipalData(uf: string | null): MunicipalLoadState {
  const [state, setState] = useState<MunicipalLoadState>({
    status: "idle",
    loaded: null,
  });

  useEffect(() => {
    if (!uf) {
      setState({ status: "idle", loaded: null });
      return;
    }
    const activeUf = uf;

    const cached = cache.get(activeUf);
    if (cached) {
      setState({ status: "success", loaded: cached, uf: activeUf });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", loaded: null, uf: activeUf });

    async function load() {
      try {
        const [dataResponse, mapResponse] = await Promise.all([
          fetch(`/data/municipal/${activeUf}.json`, {
            signal: controller.signal,
          }),
          fetch(`/maps/municipal/${activeUf}.svg`, {
            signal: controller.signal,
          }),
        ]);
        if (!dataResponse.ok || !mapResponse.ok) {
          throw new Error(
            `Falha ao carregar os dados municipais (${dataResponse.status}/${mapResponse.status}).`,
          );
        }

        const data = (await dataResponse.json()) as MunicipalUfData;
        const mapText = await mapResponse.text();
        if (
          data.uf !== activeUf ||
          data.municipalityCount !== data.municipalities.length
        ) {
          throw new Error("O arquivo municipal não corresponde ao estado.");
        }

        const loaded = {
          data,
          geometry: readMunicipalGeometry(
            mapText,
            data.outline.pathCount,
          ),
        };
        cache.set(activeUf, loaded);
        setState({ status: "success", loaded, uf: activeUf });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          loaded: null,
          uf: activeUf,
          message:
            error instanceof Error
              ? error.message
              : "Falha ao carregar os municípios.",
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [uf]);

  if (!uf) {
    return { status: "idle", loaded: null };
  }
  if (state.status === "idle" || state.uf !== uf) {
    return { status: "loading", loaded: null, uf };
  }
  return state;
}
