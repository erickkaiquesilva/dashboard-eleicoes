import { STATES, type RoundNumber } from "./map-model";
import {
  parseElectionPath,
  pathForRoute,
  type RuleRoute,
} from "./route-rules.mjs";

export type PageRoute = {
  place: "br" | string;
  round: RoundNumber;
  municipality?: string;
};

const VALID_STATES = new Set(
  STATES.map((state) => state.abbreviation.toLowerCase()),
);

export function pathFor(route: PageRoute): string {
  return pathForRoute(route);
}

export function parsePath(pathname: string): {
  route: PageRoute;
  canonicalPath: string;
  needsReplace: boolean;
} {
  return parseElectionPath(
    pathname,
    VALID_STATES,
  ) as {
    route: RuleRoute & PageRoute;
    canonicalPath: string;
    needsReplace: boolean;
  };
}
