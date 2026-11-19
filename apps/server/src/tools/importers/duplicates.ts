// Seconds around an imported play in which a listen of the same track counts
// as the same play. Wider than the 30 s a play needs to count because polled
// times can be well off the export's, which marks when the play stopped; some
// are over a minute off, and those still end up stored twice.
export const IMPORT_DUPLICATE_SECONDS = 60;

// Whether a play is already among the listens accepted from the same batch,
// with the same bounds as getCloseTrackId. Other tracks never match: a song
// ending shortly after another one is a play of its own.
export const isCloseListen = (
  listens: { id: string; played_at: Date }[],
  trackId: string,
  playedAt: Date,
  secondsPlusMinus: number,
) =>
  listens.some(
    (listen) =>
      listen.id === trackId &&
      Math.abs(listen.played_at.getTime() - playedAt.getTime()) <
        secondsPlusMinus * 1000,
  );
