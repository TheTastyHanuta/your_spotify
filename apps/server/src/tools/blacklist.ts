// A listen of a blacklisted artist is stored marked, by the listen's own
// primary artist: unblacklisting matches the same field
export const artistBlacklistMark = (
  blacklistedArtists: string[],
  primaryArtistId: string,
) =>
  blacklistedArtists.includes(primaryArtistId)
    ? { blacklistedBy: ["artist" as const] }
    : {};
