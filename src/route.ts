import { STATES, type RoundNumber } from "./map-model";

export type PageRoute = {
  place: "br" | string;
  round: RoundNumber;
};

const VALID_STATES = new Set(
  STATES.map((state) => state.abbreviation.toLowerCase()),
);

export function pathFor(route: PageRoute): string {
  if (route.place === "br") {
    return route.round === "2" ? "/" : "/brasil/1";
  }
  return `/${route.place}/${route.round}`;
}

export function parsePath(pathname: string): {
  route: PageRoute;
  canonicalPath: string;
  needsReplace: boolean;
} {
  if (pathname === "/") {
    return {
      route: { place: "br", round: "2" },
      canonicalPath: "/",
      needsReplace: false,
    };
  }

  if (pathname === "/brasil/1") {
    return {
      route: { place: "br", round: "1" },
      canonicalPath: "/brasil/1",
      needsReplace: false,
    };
  }

  if (pathname === "/brasil/2") {
    return {
      route: { place: "br", round: "2" },
      canonicalPath: "/",
      needsReplace: true,
    };
  }

  const match = pathname.match(/^\/([a-z]{2})\/([12])$/);
  if (match && VALID_STATES.has(match[1])) {
    const route = {
      place: match[1],
      round: match[2] as RoundNumber,
    };
    return {
      route,
      canonicalPath: pathFor(route),
      needsReplace: false,
    };
  }

  return {
    route: { place: "br", round: "2" },
    canonicalPath: "/",
    needsReplace: true,
  };
}
