// Pairs the plays of an extended streaming history export with the listens
// already stored, so an import adds only the plays that are missing and moves
// listens Spotify stamped late to the time the export gives.
//
// The rules come from comparing a full export with a year of polled listens:
// - Polled times are a few seconds after the export's (which marks when the
//   play stopped), some up to 15 minutes, nearly all of them later.
// - When the app closed or crashed mid-track, or finished it, Spotify can list
//   the play hours later with that later time, up to about two days. For
//   skipped or stopped plays such late matches were no more frequent than
//   chance, so those only pair within the 15 minutes. Some plays are stamped
//   hours early instead, see pairNextPlay.
// - The same song can have another track id in the export (another release or
//   region), so plays pair by recording: the ISRC, or the track a duplicate
//   was merged into. Track ids the database doesn't know need their ISRC from
//   Spotify (tracks).
// - The export sometimes lists one play twice, as identical rows or as rows
//   of the same song ending seconds apart; only the longest one counts.
// - For plays made offline up to 2022, the export's time is when the phone
//   synced, often days later and shared by every play of that sync. Their
//   start (offline_timestamp, in ms then, in seconds later) is right: each
//   play starts seconds after the one before ends. Earlier imports stored them
//   at the sync time, so they pair there, and move to when they stopped.

import { primaryIdOf } from "../canonicalTracks";

export interface ExportPlay {
  // Position in the export, as the importer counts it
  index: number;
  // The export's time (ts) in ms: when the play stopped, and where earlier
  // imports stored it
  time: number;
  // When an offline play really stopped, if its time is the sync time
  stoppedAt?: number;
  trackId: string;
  msPlayed: number;
  reasonEnd?: string | null;
}

export interface StoredListen {
  _id: string;
  time: number;
  trackId: string;
}

export interface StoredTrack {
  isrc?: string;
  mergedInto?: string;
}

export interface ListenMove {
  _id: string;
  from: number;
  to: number;
}

export const MIN_PLAY_MS = 30_000;
// Later than this after the play's start and length, the export's time of an
// offline play is the sync time; a minute leaves room for short pauses
const SYNCED_LATE_MS = 60_000;
// Phones synced within a week in a real export; a start further back is wrong
const SYNCED_MAX_MS = 30 * 24 * 3600_000;
const ON_TIME_MS = 15 * 60_000;
export const LATE_MS = 48 * 3600_000;
// Nearest listens considered per play; a play rarely has more than a few
const MAX_CANDIDATES = 20;
// Closer than this, the stored time is kept: polled times are usually a second
// or two after the export's and keep their milliseconds
const MOVE_MIN_MS = 60_000;
// Two listens of the same track this close are removed as duplicates at
// startup (Database.deletePossibleDuplicates), so a move never ends there
export const DUPLICATE_MS = 30_000;
const LATE_REASONS = new Set([
  "logout",
  "trackdone",
  "unexpected-exit",
  "unexpected-exit-while-paused",
]);

const stoppedAt = (play: ExportPlay) => play.stoppedAt ?? play.time;

// When the play stopped: the export's time, except for offline plays it gives
// the sync time for, whose start is in ms (seconds since 2022 are left alone:
// those times are right, and a start in whole seconds is up to a second off)
export const offlineStoppedAt = (
  time: number,
  offlineTimestamp: number | null | undefined,
  msPlayed: number,
) => {
  if (!offlineTimestamp || offlineTimestamp < 1e11) {
    return undefined;
  }
  const stopped = offlineTimestamp + msPlayed;
  return time - stopped > SYNCED_LATE_MS && time - stopped <= SYNCED_MAX_MS
    ? stopped
    : undefined;
};

const recordingKey = (tracks: Map<string, StoredTrack>, trackId: string) => {
  const track = tracks.get(trackId);
  if (!track) {
    return `id:${trackId}`;
  }
  const primaryId = primaryIdOf(
    { id: trackId, mergedInto: track.mergedInto },
    tracks,
  );
  const isrc = tracks.get(primaryId)?.isrc ?? track.isrc;
  return isrc ? `isrc:${isrc}` : `id:${primaryId}`;
};

// Positions of plays that repeat another one: the same recording ending less
// than DUPLICATE_MS after the play kept, of which the longer one stays
const repeatedPlays = (plays: ExportPlay[], keys: string[]) => {
  const byKey = new Map<string, number[]>();
  plays.forEach((_, i) => {
    const list = byKey.get(keys[i]!) ?? [];
    list.push(i);
    byKey.set(keys[i]!, list);
  });
  const repeated = new Set<number>();
  for (const list of byKey.values()) {
    list.sort((a, b) => stoppedAt(plays[a]!) - stoppedAt(plays[b]!));
    let kept = list[0]!;
    for (const i of list.slice(1)) {
      if (stoppedAt(plays[i]!) - stoppedAt(plays[kept]!) >= DUPLICATE_MS) {
        kept = i;
      } else if (plays[i]!.msPlayed > plays[kept]!.msPlayed) {
        repeated.add(kept);
        kept = i;
      } else {
        repeated.add(i);
      }
    }
  }
  return repeated;
};

interface Keyed {
  i: number;
  key: string;
  time: number;
}

// Pairs each play with the nearest listen of the same key whose offset
// (listen - play) lies in [lo, hi], closest pairs first, each side used once
export const pairNearest = (
  plays: Keyed[],
  listens: Keyed[],
  lo: number,
  hi: number,
) => {
  const byKey = new Map<string, Keyed[]>();
  for (const listen of listens) {
    const list = byKey.get(listen.key) ?? [];
    list.push(listen);
    byKey.set(listen.key, list);
  }
  for (const list of byKey.values()) {
    list.sort((a, b) => a.time - b.time);
  }
  const candidates: { distance: number; play: number; listen: number }[] = [];
  for (const play of plays) {
    const own: typeof candidates = [];
    const list = byKey.get(play.key);
    if (!list) {
      continue;
    }
    let low = 0;
    let high = list.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (list[mid]!.time < play.time + lo) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    for (let j = low; j < list.length; j += 1) {
      const listen = list[j]!;
      if (listen.time > play.time + hi) {
        break;
      }
      own.push({
        distance: Math.abs(listen.time - play.time),
        play: play.i,
        listen: listen.i,
      });
    }
    // Keeps memory bounded for a song played over and over
    own.sort((a, b) => a.distance - b.distance);
    candidates.push(...own.slice(0, MAX_CANDIDATES));
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const pairs = new Map<number, number>();
  const usedListens = new Set<number>();
  for (const { play, listen } of candidates) {
    if (pairs.has(play) || usedListens.has(listen)) {
      continue;
    }
    pairs.set(play, listen);
    usedListens.add(listen);
  }
  return pairs;
};

// Spotify can also stamp a play hours before the export does: a song that
// started after the one before finished and that another device stopped
// ("remote") when the next session began, which Spotify lists about an hour
// after the song before. A listen left over pairs with the export's next play
// if that is such a play of the same recording: nothing may lie between them,
// so chance pairs are unlikely.
const pairNextPlay = (
  plays: ExportPlay[],
  listens: StoredListen[],
  playKeys: string[],
  listenKeys: string[],
  paired: Map<number, number>,
) => {
  const order = plays
    .map((_, i) => i)
    .sort((a, b) => plays[a]!.time - plays[b]!.time);
  const usedListens = new Set(paired.values());
  const candidates: { distance: number; play: number; listen: number }[] = [];
  listens.forEach((listen, l) => {
    if (usedListens.has(l)) {
      return;
    }
    // First play that stopped after the listen
    let low = 0;
    let high = order.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (plays[order[mid]!]!.time <= listen.time) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    const p = order[low];
    if (
      p === undefined ||
      plays[p]!.reasonEnd !== "remote" ||
      plays[p]!.time - listen.time > LATE_MS ||
      playKeys[p] !== listenKeys[l]
    ) {
      return;
    }
    candidates.push({
      distance: plays[p]!.time - listen.time,
      play: p,
      listen: l,
    });
  });
  candidates.sort((a, b) => a.distance - b.distance);
  for (const { play, listen } of candidates) {
    if (!paired.has(play)) {
      paired.set(play, listen);
    }
  }
};

// Plays some stored listen could stand for: one within LATE_MS of either of
// its times. Only their tracks are worth asking Spotify about before planning.
export const playsNearListens = (
  plays: ExportPlay[],
  listens: StoredListen[],
) => {
  const times = listens.map((listen) => listen.time).sort((a, b) => a - b);
  const near = (time: number) => {
    let low = 0;
    let high = times.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (times[mid]! < time - LATE_MS) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low < times.length && times[low]! <= time + LATE_MS;
  };
  return plays.filter((play) => near(play.time) || near(stoppedAt(play)));
};

// tracks: the stored tracks of the plays and listens, the tracks they were
// merged into, and the plays' tracks the database doesn't know, with the ISRC
// Spotify gives. newestPolled: ids of listens that keep their time. Spotify
// still lists them, and the poller would store them again at the old time.
export const planImport = (
  exportPlays: ExportPlay[],
  listens: StoredListen[],
  tracks: Map<string, StoredTrack>,
  newestPolled: Set<string>,
) => {
  const repeated = repeatedPlays(
    exportPlays,
    exportPlays.map((play) => recordingKey(tracks, play.trackId)),
  );
  const plays = exportPlays.filter((_, i) => !repeated.has(i));
  const playKeys = plays.map((play) => recordingKey(tracks, play.trackId));
  const listenKeys = listens.map((listen) =>
    recordingKey(tracks, listen.trackId),
  );
  // play position -> listen position
  const paired = new Map<number, number>();
  const run = (
    selected: (play: ExportPlay) => boolean,
    lo: number,
    hi: number,
  ) => {
    const usedListens = new Set(paired.values());
    const pairs = pairNearest(
      // An offline play's listen is at the sync time, or where an earlier run
      // of this import moved or stored it
      plays.flatMap((play, i) =>
        !paired.has(i) && selected(play)
          ? [...new Set([play.time, stoppedAt(play)])].map((time) => ({
              i,
              key: playKeys[i]!,
              time,
            }))
          : [],
      ),
      listens.flatMap((listen, i) =>
        usedListens.has(i)
          ? []
          : [{ i, key: listenKeys[i]!, time: listen.time }],
      ),
      lo,
      hi,
    );
    for (const [play, listen] of pairs) {
      paired.set(play, listen);
    }
  };
  run((play) => play.msPlayed >= MIN_PLAY_MS, -ON_TIME_MS, ON_TIME_MS);
  run((play) => play.msPlayed < MIN_PLAY_MS, -ON_TIME_MS, ON_TIME_MS);
  // Long plays first here too: a short play closer to a late listen would
  // take it from the play it stands for
  const late = (play: ExportPlay) => LATE_REASONS.has(play.reasonEnd ?? "");
  run((play) => play.msPlayed >= MIN_PLAY_MS && late(play), 0, LATE_MS);
  run((play) => play.msPlayed < MIN_PLAY_MS && late(play), 0, LATE_MS);
  pairNextPlay(plays, listens, playKeys, listenKeys, paired);

  // listen position -> new time
  let moved = new Map<number, number>();
  for (const [p, l] of paired) {
    const to = stoppedAt(plays[p]!);
    if (
      Math.abs(listens[l]!.time - to) > MOVE_MIN_MS &&
      !newestPolled.has(listens[l]!._id)
    ) {
      moved.set(l, to);
    }
  }
  // Drops the moves that would end next to another listen of the same track,
  // where it is now or where it moves, until none is left. Where it is now
  // too: the moves are written one by one, and the startup cleanup could
  // delete one of two listens a crash left side by side.
  while (moved.size > 0) {
    const byTrack = new Map<string, { l: number; time: number }[]>();
    listens.forEach((listen, l) => {
      const list = byTrack.get(listen.trackId) ?? [];
      list.push({ l, time: listen.time });
      const to = moved.get(l);
      if (to !== undefined) {
        list.push({ l, time: to });
      }
      byTrack.set(listen.trackId, list);
    });
    const kept = new Map(
      [...moved].filter(
        ([l, to]) =>
          !byTrack
            .get(listens[l]!.trackId)!
            .some(
              (other) =>
                other.l !== l && Math.abs(other.time - to) < DUPLICATE_MS,
            ),
      ),
    );
    if (kept.size === moved.size) {
      break;
    }
    moved = kept;
  }
  const moves: ListenMove[] = [...moved].map(([l, to]) => ({
    _id: listens[l]!._id,
    from: listens[l]!.time,
    to,
  }));
  const toImport = new Set(
    plays
      .filter((play, i) => !paired.has(i) && play.msPlayed >= MIN_PLAY_MS)
      .map((play) => play.index),
  );
  const pairedListens = new Set(paired.values());
  // Listens from the export's time span that no play stands for
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const play of plays) {
    first = Math.min(first, stoppedAt(play));
    last = Math.max(last, play.time);
  }
  const unmatched = listens.filter(
    (listen, l) =>
      !pairedListens.has(l) && listen.time >= first && listen.time <= last,
  );
  return { matched: paired.size, moves, toImport, unmatched };
};
