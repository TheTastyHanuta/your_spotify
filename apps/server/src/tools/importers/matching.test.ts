import { describe, expect, it } from "vitest";

import {
  ExportPlay,
  offlineStoppedAt,
  pairNearest,
  planImport,
  playsNearListens,
  StoredListen,
  StoredTrack,
} from "./matching";

const at = (iso: string) => Date.parse(iso);
const NONE = new Set<string>();

let index = 0;
const play = (
  time: string,
  trackId: string,
  extra: Partial<ExportPlay> = {},
): ExportPlay => ({
  index: index++,
  time: at(time),
  trackId,
  msPlayed: 200_000,
  reasonEnd: "trackdone",
  ...extra,
});
const listen = (_id: string, time: string, trackId: string): StoredListen => ({
  _id,
  time: at(time),
  trackId,
});
const tracksOf = (entries: [string, StoredTrack][]) => new Map(entries);

describe("offlineStoppedAt", () => {
  it("uses the start of an offline play the export gives the sync time for", () => {
    // Alive, played offline 2022-06-04, synced 2022-06-06 17:03:58
    expect(
      offlineStoppedAt(at("2022-06-06T17:03:58Z"), 1654345312029, 180220),
    ).toBe(at("2022-06-04T12:24:52.249Z"));
  });

  it("keeps the export's time when it is right", () => {
    // Paused for less than a minute
    expect(
      offlineStoppedAt(at("2022-06-04T12:25:40Z"), 1654345312029, 180220),
    ).toBeUndefined();
    // A start in seconds, as Spotify writes it since 2022
    expect(
      offlineStoppedAt(at("2024-03-01T12:00:00Z"), 1709290000, 180220),
    ).toBeUndefined();
    expect(
      offlineStoppedAt(at("2024-03-01T12:00:00Z"), null, 180220),
    ).toBeUndefined();
    // A start from 1973 is wrong, the phone synced within a week
    expect(
      offlineStoppedAt(at("2022-06-06T17:03:58Z"), 1e11, 180220),
    ).toBeUndefined();
  });
});

describe("pairNearest", () => {
  it("gives a listen to the nearest play only", () => {
    const pairs = pairNearest(
      [
        { i: 0, key: "a", time: 100 },
        { i: 1, key: "a", time: 130 },
      ],
      [{ i: 0, key: "a", time: 125 }],
      -60,
      60,
    );
    expect([...pairs]).toStrictEqual([[1, 0]]);
  });

  it("keeps to the offset range", () => {
    const pairs = pairNearest(
      [{ i: 0, key: "a", time: 100 }],
      [{ i: 0, key: "a", time: 90 }],
      0,
      60,
    );
    expect(pairs.size).toBe(0);
  });
});

describe("playsNearListens", () => {
  it("keeps the plays with a stored listen within two days of either time", () => {
    const plays = [
      play("2025-08-01T12:00:00Z", "a"),
      play("2025-08-10T12:00:00Z", "b"),
      play("2022-06-06T17:03:58Z", "c", {
        stoppedAt: at("2022-06-04T12:24:52Z"),
      }),
    ];
    const near = playsNearListens(plays, [
      listen("l1", "2025-08-03T11:00:00Z", "x"),
      listen("l2", "2022-06-02T13:00:00Z", "y"),
    ]);
    expect(near.map((p) => p.trackId)).toStrictEqual(["a", "c"]);
    expect(playsNearListens(plays, [])).toStrictEqual([]);
  });
});

describe("planImport", () => {
  it("imports only plays no listen stands for", () => {
    const plays = [
      play("2025-07-29T22:16:06Z", "sweater"),
      play("2025-07-29T22:19:20Z", "again"),
    ];
    const plan = planImport(
      plays,
      [listen("l1", "2025-07-29T22:16:07.512Z", "sweater")],
      tracksOf([["sweater", {}]]),
      NONE,
    );
    expect([...plan.toImport]).toStrictEqual([plays[1]!.index]);
    expect(plan.moves).toStrictEqual([]);
  });

  it("matches a listen polled 109 s late and moves it to the export's time", () => {
    // Sweater Weather, 2025-07-29: the old ±60 s check stored it twice
    const plays = [play("2025-07-29T22:16:06Z", "sweater")];
    const plan = planImport(
      plays,
      [listen("l1", "2025-07-29T22:17:55.001Z", "sweater")],
      tracksOf([["sweater", {}]]),
      NONE,
    );
    expect(plan.toImport.size).toBe(0);
    expect(plan.moves).toStrictEqual([
      {
        _id: "l1",
        from: at("2025-07-29T22:17:55.001Z"),
        to: at("2025-07-29T22:16:06Z"),
      },
    ]);
  });

  it("matches a play cut off by closing the app that Spotify listed 16 h later", () => {
    // Money Trees: the app closed at 23:04, the listen is stamped 15:28
    const plays = [
      play("2025-07-30T23:04:45Z", "money", {
        msPlayed: 316_533,
        reasonEnd: "logout",
      }),
    ];
    const plan = planImport(
      plays,
      [listen("l1", "2025-07-31T15:28:56.498Z", "money")],
      tracksOf([["money", {}]]),
      NONE,
    );
    expect(plan.toImport.size).toBe(0);
    expect(plan.moves).toHaveLength(1);
  });

  it("does not match a skipped play with a listen of the same song hours later", () => {
    const plays = [
      play("2026-11-18T16:33:04Z", "feeling", {
        msPlayed: 106_833,
        reasonEnd: "fwdbtn",
      }),
    ];
    const plan = planImport(
      plays,
      [listen("l1", "2026-11-18T19:40:00.000Z", "feeling")],
      tracksOf([["feeling", {}]]),
      NONE,
    );
    expect([...plan.toImport]).toStrictEqual([plays[0]!.index]);
  });

  it("gives a late listen to the long play before a short one", () => {
    // A finished play Spotify lists 6 h late, and a 2 s play of the song
    // closer to that listen
    const plays = [
      play("2025-08-01T10:00:00Z", "a"),
      play("2025-08-01T15:00:00Z", "a", {
        msPlayed: 2_000,
        reasonEnd: "logout",
      }),
    ];
    const plan = planImport(
      plays,
      [listen("l1", "2025-08-01T16:00:00.000Z", "a")],
      tracksOf([["a", {}]]),
      NONE,
    );
    expect(plan.toImport.size).toBe(0);
    expect(plan.moves.map((move) => move.to)).toStrictEqual([plays[0]!.time]);
  });

  it("does not match a listen stamped before the export's late play", () => {
    // Another play between them, so the next-play rule doesn't apply either
    const plays = [
      play("2025-08-01T11:00:00Z", "other"),
      play("2025-08-01T12:00:00Z", "a", { reasonEnd: "logout" }),
    ];
    const plan = planImport(
      plays,
      [listen("l1", "2025-08-01T10:00:00.000Z", "a")],
      tracksOf([["a", {}]]),
      NONE,
    );
    expect(plan.toImport.size).toBe(2);
  });

  it("imports the second of two plays of a song when one listen is stored", () => {
    const plays = [
      play("2025-08-01T12:00:00Z", "a"),
      play("2025-08-01T12:04:00Z", "a"),
    ];
    const plan = planImport(
      plays,
      [listen("l1", "2025-08-01T12:00:01.200Z", "a")],
      tracksOf([["a", {}]]),
      NONE,
    );
    expect([...plan.toImport]).toStrictEqual([plays[1]!.index]);
  });

  it("matches another release of the same recording by ISRC or merge", () => {
    const plays = [
      play("2025-08-01T12:00:00Z", "dup"),
      play("2025-08-01T13:00:00Z", "other-release"),
    ];
    const plan = planImport(
      plays,
      [
        listen("l1", "2025-08-01T12:00:01.000Z", "canonical"),
        listen("l2", "2025-08-01T13:00:01.000Z", "canonical"),
      ],
      tracksOf([
        ["canonical", { isrc: "USX" }],
        ["dup", { mergedInto: "canonical" }],
        ["other-release", { isrc: "USX" }],
      ]),
      NONE,
    );
    expect(plan.toImport.size).toBe(0);
  });

  it("matches a track the database doesn't know by the ISRC Spotify gives", () => {
    // The export names another release than the one the poller stored
    const plays = [play("2025-08-01T12:00:00Z", "export-id")];
    const plan = planImport(
      plays,
      [listen("l1", "2025-08-01T12:00:02.000Z", "stored")],
      tracksOf([
        ["stored", { isrc: "USUM71900001" }],
        ["export-id", { isrc: "USUM71900001" }],
      ]),
      NONE,
    );
    expect(plan.matched).toBe(1);
    expect(plan.toImport.size).toBe(0);
  });

  it("treats releases with different ISRCs as different songs", () => {
    // The Dead Dance is stored under two ISRCs
    const plays = [play("2025-09-12T12:00:00Z", "single")];
    const plan = planImport(
      plays,
      [listen("l1", "2025-09-12T12:00:02.000Z", "album")],
      tracksOf([
        ["album", { isrc: "USUV72503814" }],
        ["single", { isrc: "USUM72407034" }],
      ]),
      NONE,
    );
    expect([...plan.toImport]).toStrictEqual([plays[0]!.index]);
  });

  it("matches a listen Spotify stamped before the export's next play", () => {
    // Stronger, 2025-08-02: stored 12:54, the export's next play is Stronger,
    // stopped by another device at 13:49
    const plays = [
      play("2025-08-02T11:47:36Z", "remember"),
      play("2025-08-02T13:49:08Z", "stronger", {
        msPlayed: 96_753,
        reasonEnd: "remote",
      }),
    ];
    const plan = planImport(
      plays,
      [
        listen("l1", "2025-08-02T11:47:37.000Z", "remember"),
        listen("l2", "2025-08-02T12:54:25.044Z", "stronger"),
      ],
      tracksOf([
        ["remember", {}],
        ["stronger", {}],
      ]),
      NONE,
    );
    expect(plan.toImport.size).toBe(0);
    expect(plan.moves).toStrictEqual([
      {
        _id: "l2",
        from: at("2025-08-02T12:54:25.044Z"),
        to: at("2025-08-02T13:49:08Z"),
      },
    ]);
  });

  it("doesn't match an early listen with a next play another device didn't stop", () => {
    // Lost It All, 2025-10-08: a 3 s play on the computer, hours after the listen
    const plays = [
      play("2025-10-08T18:42:00Z", "lost", {
        msPlayed: 3_000,
        reasonEnd: "endplay",
      }),
    ];
    const plan = planImport(
      plays,
      [listen("l1", "2025-10-08T11:47:00.000Z", "lost")],
      tracksOf([["lost", {}]]),
      NONE,
    );
    expect(plan.matched).toBe(0);
  });

  it("doesn't match an early listen when another play lies between", () => {
    const plays = [
      play("2025-08-02T13:00:00Z", "other", { reasonEnd: "remote" }),
      play("2025-08-02T13:49:08Z", "stronger", { reasonEnd: "remote" }),
    ];
    const plan = planImport(
      plays,
      [listen("l1", "2025-08-02T12:54:25.044Z", "stronger")],
      tracksOf([["stronger", {}]]),
      NONE,
    );
    expect(plan.toImport.size).toBe(2);
  });

  it("leaves a second listen of a play alone", () => {
    // Heavy, 2025-07-29: two listens a minute apart, one play
    const plays = [
      play("2025-07-29T16:30:00Z", "other", { msPlayed: 1_000 }),
      play("2025-07-29T16:34:54Z", "heavy", { msPlayed: 49_213 }),
    ];
    const plan = planImport(
      plays,
      [
        listen("l1", "2025-07-29T16:34:06.060Z", "heavy"),
        listen("l2", "2025-07-29T16:35:04.876Z", "heavy"),
      ],
      tracksOf([["heavy", {}]]),
      NONE,
    );
    expect(plan.matched).toBe(1);
    expect(plan.unmatched.map((stored) => stored._id)).toStrictEqual(["l1"]);
  });

  it("still pairs every play of a song on repeat with candidates capped", () => {
    const plays = Array.from({ length: 40 }, (_, i) =>
      play(
        new Date(at("2025-08-01T12:00:00Z") + i * 200_000).toISOString(),
        "loop",
      ),
    );
    const listens = plays.map((p, i) =>
      listen(`l${i}`, new Date(p.time + 1_500).toISOString(), "loop"),
    );
    const plan = planImport(plays, listens, tracksOf([["loop", {}]]), NONE);
    expect(plan.matched).toBe(40);
    expect(plan.toImport.size).toBe(0);
  });

  it("imports a play the export lists twice once", () => {
    // 57 groups of identical rows in a real export, mostly from 2022
    const twice = play("2022-06-12T13:05:55Z", "anybody");
    const plan = planImport(
      [twice, { ...twice, index: index++ }],
      [],
      new Map(),
      NONE,
    );
    expect([...plan.toImport]).toStrictEqual([twice.index]);
  });

  it("keeps the longest of the same song's rows ending seconds apart", () => {
    // Legends Are Made, 2018-12-08: one play logged as a crash and as finished
    const plays = [
      play("2018-12-08T14:31:07Z", "legends", {
        msPlayed: 150_000,
        reasonEnd: "unexpected-exit",
      }),
      play("2018-12-08T14:31:07Z", "legends", { msPlayed: 169_758 }),
      play("2018-12-08T14:31:40Z", "legends", { msPlayed: 33_000 }),
    ];
    const plan = planImport(plays, [], new Map(), NONE);
    expect([...plan.toImport].sort()).toStrictEqual(
      [plays[1]!.index, plays[2]!.index].sort(),
    );
  });

  it("moves an offline play's listen from the sync time to when it stopped", () => {
    // Alive, played twice offline 2022-06-04 and synced 2022-06-06 within a
    // second; an earlier import stored one listen at the sync time
    const plays = [
      play("2022-06-06T17:03:58Z", "alive", {
        stoppedAt: at("2022-06-04T12:24:52.249Z"),
      }),
      play("2022-06-06T17:03:59Z", "alive", {
        msPlayed: 140_867,
        reasonEnd: "fwdbtn",
        stoppedAt: at("2022-06-04T15:51:32.640Z"),
      }),
    ];
    const plan = planImport(
      plays,
      [listen("l1", "2022-06-06T17:03:58Z", "alive")],
      tracksOf([["alive", {}]]),
      NONE,
    );
    expect([...plan.toImport]).toStrictEqual([plays[1]!.index]);
    expect(plan.moves).toStrictEqual([
      {
        _id: "l1",
        from: at("2022-06-06T17:03:58Z"),
        to: at("2022-06-04T12:24:52.249Z"),
      },
    ]);
  });

  it("finds an offline play's listen again where an earlier run put it", () => {
    const offline = play("2022-06-06T17:03:58Z", "alive", {
      stoppedAt: at("2022-06-04T12:24:52.249Z"),
    });
    const plan = planImport(
      [offline],
      [listen("l1", "2022-06-04T12:24:52.249Z", "alive")],
      tracksOf([["alive", {}]]),
      NONE,
    );
    expect(plan.matched).toBe(1);
    expect(plan.toImport.size).toBe(0);
    expect(plan.moves).toStrictEqual([]);
  });

  it("counts listens from when the export's offline plays stopped", () => {
    const plays = [
      play("2022-06-06T17:03:58Z", "alive", {
        stoppedAt: at("2022-06-04T12:24:52.249Z"),
      }),
      play("2022-06-06T17:10:00Z", "other"),
    ];
    const plan = planImport(
      plays,
      [listen("l1", "2022-06-05T10:00:00Z", "unknown")],
      new Map(),
      NONE,
    );
    expect(plan.unmatched.map((stored) => stored._id)).toStrictEqual(["l1"]);
  });

  it("follows a merge chain to the recording", () => {
    const plays = [play("2025-08-01T12:00:00Z", "a")];
    const plan = planImport(
      plays,
      [listen("l1", "2025-08-01T12:00:01.000Z", "c")],
      tracksOf([
        ["a", { mergedInto: "b" }],
        ["b", { mergedInto: "c" }],
        ["c", { isrc: "USX" }],
      ]),
      NONE,
    );
    expect(plan.toImport.size).toBe(0);
  });

  it("lets a short play claim its listen without importing it", () => {
    // Ain't In LA: 23 ms in the export, a listen in the database
    const plays = [
      play("2026-11-18T21:51:52Z", "la", {
        msPlayed: 23,
        reasonEnd: "trackerror",
      }),
      play("2026-11-18T21:54:59Z", "la"),
    ];
    const plan = planImport(
      plays,
      [
        listen("l1", "2026-11-18T21:51:52.035Z", "la"),
        listen("l2", "2026-11-18T21:54:59.625Z", "la"),
      ],
      tracksOf([["la", {}]]),
      NONE,
    );
    expect(plan.toImport.size).toBe(0);
    expect(plan.matched).toBe(2);
  });

  it("keeps the time of listens Spotify may still list", () => {
    const plays = [play("2025-07-29T22:16:06Z", "sweater")];
    const plan = planImport(
      plays,
      [listen("l1", "2025-07-29T22:17:55.001Z", "sweater")],
      tracksOf([["sweater", {}]]),
      new Set(["l1"]),
    );
    expect(plan.moves).toStrictEqual([]);
  });

  it("moves a listen it imported earlier even if it is the newest", () => {
    // Only polled listens are protected; this one is not among them
    const plays = [play("2025-07-29T22:16:06Z", "sweater")];
    const plan = planImport(
      plays,
      [listen("l1", "2025-07-29T22:17:55.001Z", "sweater")],
      tracksOf([["sweater", {}]]),
      new Set(["l2"]),
    );
    expect(plan.moves).toHaveLength(1);
  });

  it("doesn't move a listen next to another listen of the same track", () => {
    // The startup cleanup would delete one of the two
    const plays = [
      play("2025-08-01T12:09:44Z", "a", { msPlayed: 35_000 }),
      play("2025-08-01T12:10:14Z", "a", {
        msPlayed: 30_000,
        reasonEnd: "logout",
      }),
    ];
    const plan = planImport(
      plays,
      [
        listen("l1", "2025-08-01T12:09:45.000Z", "a"),
        listen("l2", "2025-08-01T15:00:00.000Z", "a"),
      ],
      tracksOf([["a", {}]]),
      NONE,
    );
    expect(plan.matched).toBe(2);
    expect(plan.moves).toStrictEqual([]);
  });

  it("doesn't move a listen to where another one is before it moves away", () => {
    // Whatcha Say, 2025-10-01: the first listen leaves 13:51:00; moving the
    // second one to 13:50:49 would put two listens side by side until then
    const plays = [
      play("2025-10-01T13:47:32Z", "whatcha"),
      play("2025-10-01T13:50:49Z", "whatcha", {
        msPlayed: 5_996,
        reasonEnd: "remote",
      }),
    ];
    const plan = planImport(
      plays,
      [
        listen("l1", "2025-10-01T13:51:00.427Z", "whatcha"),
        listen("l2", "2025-10-01T13:54:31.004Z", "whatcha"),
      ],
      tracksOf([["whatcha", {}]]),
      NONE,
    );
    expect(plan.matched).toBe(2);
    expect(plan.moves.map((move) => [move._id, move.to])).toStrictEqual([
      ["l1", at("2025-10-01T13:47:32Z")],
    ]);
  });
});
