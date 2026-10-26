export type RuleRound = "1" | "2";

export interface RuleRoute {
  place: string;
  round: RuleRound;
  municipality?: string;
}

export interface RuleParseResult {
  route: RuleRoute;
  canonicalPath: string;
  needsReplace: boolean;
}

export function pathForRoute(route: RuleRoute): string;

export function parseElectionPath(
  pathname: string,
  validStates: ReadonlySet<string>,
): RuleParseResult;
