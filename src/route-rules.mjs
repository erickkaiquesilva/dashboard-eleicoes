export function pathForRoute(route) {
  if (route.place === "br") {
    return route.round === "2" ? "/" : "/brasil/1";
  }
  if (route.place === "zz") {
    return `/exterior/${route.round}`;
  }
  const municipality = route.municipality
    ? `/${route.municipality}`
    : "";
  return `/${route.place}/${route.round}${municipality}`;
}

export function parseElectionPath(pathname, validStates) {
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

  const exteriorMatch = pathname.match(/^\/exterior\/([12])$/);
  if (exteriorMatch) {
    const route = {
      place: "zz",
      round: exteriorMatch[1],
    };
    return {
      route,
      canonicalPath: pathForRoute(route),
      needsReplace: false,
    };
  }

  const match = pathname.match(/^\/([a-z]{2})\/([12])(?:\/([^/]+))?$/);
  if (match && validStates.has(match[1])) {
    const route = {
      place: match[1],
      round: match[2],
      ...(match[3] ? { municipality: match[3] } : {}),
    };
    return {
      route,
      canonicalPath: pathForRoute(route),
      needsReplace: false,
    };
  }

  return {
    route: { place: "br", round: "2" },
    canonicalPath: "/",
    needsReplace: true,
  };
}
