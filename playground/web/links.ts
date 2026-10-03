/** Where an app link goes, typed against the router's routes. */
export type AppLink =
  | { to: "/" }
  | { to: "/p/$id"; params: { id: string } }
  | { to: "/e/$concept/$nn"; params: { concept: string; nn: string } }
  | { to: "/c/$slug"; params: { slug: string } };

/** Link to a problem (lc-0001) or an exercise (hash-map/01). */
export function targetLink(id: string): AppLink {
  const slash = id.indexOf("/");
  if (slash < 0) return { to: "/p/$id", params: { id } };
  return { to: "/e/$concept/$nn", params: { concept: id.slice(0, slash), nn: id.slice(slash + 1) } };
}
