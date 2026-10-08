interface Play {
  played_at: Date;
  durationMs: number;
}

// Plays sorted by played_at. A session ends when the next play starts more
// than `gap` ms after the previous one ended. Returns the `count` longest,
// measured from the first play's start to the end of the last one.
export function longestSessions<T extends Play>(
  plays: T[],
  gap: number,
  count: number,
) {
  const sessions: T[][] = [];
  let previousEnd = -Infinity;
  for (const play of plays) {
    const start = play.played_at.getTime();
    if (start - previousEnd > gap) {
      sessions.push([]);
    }
    sessions.at(-1)!.push(play);
    previousEnd = start + play.durationMs;
  }
  return sessions
    .map((session) => {
      const last = session.at(-1)!;
      return {
        plays: session,
        sessionLength:
          last.played_at.getTime() +
          last.durationMs -
          session[0]!.played_at.getTime(),
      };
    })
    .sort((a, b) => b.sessionLength - a.sessionLength)
    .slice(0, count);
}
