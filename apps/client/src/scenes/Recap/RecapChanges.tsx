import { Link } from "react-router-dom";

import ListPage, { NB_ALL, useParamTab } from "../../components/ListPage";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { plural } from "../../services/tools";
import {
  DROPPED_FROM,
  droppedOut,
  Move,
  NB_TOP,
  RANKED,
  withMoves,
} from "./movers";
import {
  artistMoveRow,
  DroppedLine,
  KIND_TAB_VALUES,
  KIND_TABS,
  movesInfo,
  songMoveRow,
} from "./rows";
import { useRecapYear, YearSelect } from "./year";

// "#3 in 2025" or "not in your 2025 top 500", for the hero
const before = (move: Move<unknown>, previousYear: number) =>
  move.before
    ? `#${move.before} in ${previousYear}`
    : `not in your ${previousYear} top ${RANKED}`;

// The year's whole top with how each item moved, behind Recap's "See all"
export default function RecapChanges() {
  const yearState = useRecapYear();
  const { year, range } = yearState;
  const { start, end, previousStart, previousEnd } = range;
  const previousYear = year - 1;
  const [tab, setTab] = useParamTab("tab", KIND_TAB_VALUES, "artists");

  const artists = useAPI(api.getBestArtists, start, end, NB_ALL, 0);
  const songs = useAPI(api.getBestSongs, start, end, NB_ALL, 0);
  const artistRanks = useAPI(
    api.getRanks,
    previousStart,
    previousEnd,
    "artist",
    RANKED,
  );
  const songRanks = useAPI(
    api.getRanks,
    previousStart,
    previousEnd,
    "track",
    RANKED,
  );
  // The same requests as Recap's, so they come from its cache
  const previousArtists = useAPI(
    api.getBestArtists,
    previousStart,
    previousEnd,
    NB_TOP,
    0,
  );
  const previousSongs = useAPI(
    api.getBestSongs,
    previousStart,
    previousEnd,
    NB_TOP,
    0,
  );

  const droppedTitle = `Were in your ${previousYear} top ${DROPPED_FROM}, now out of your top ${NB_ALL}`;
  const nothingBefore = (ranks: string[] | null) =>
    ranks?.length === 0 && (
      <Text element="div" size="normal" greyed>
        You did not listen to anything in {previousYear}, so everything is new.
      </Text>
    );

  const common = {
    back: { to: `/recap?year=${year}`, label: `Recap ${year}` },
    info: movesInfo(year, previousYear, "top"),
    tabs: KIND_TABS,
    tab,
    onTab: setTab,
    hideInterval: true,
    actions: <YearSelect {...yearState} />,
  };

  if (tab === "songs") {
    const items =
      songs && songRanks
        ? withMoves(songs, songRanks, (a) => a.track.id)
        : null;
    return (
      <ListPage
        {...common}
        title={`Top songs since ${previousYear}`}
        items={items}
        count={(n) => plural(n, "song")}
        empty={`You did not listen to any song in ${year}.`}
        row={songMoveRow(previousYear)}
        intro={
          nothingBefore(songRanks) ||
          (songs && previousSongs && (
            <DroppedLine
              title={droppedTitle}
              items={droppedOut(
                previousSongs,
                songs.map((a) => a.track.id),
                (a) => a.track.id,
              ).map(({ item, before: rank }) => ({
                before: rank,
                item: {
                  id: item.track.id,
                  name: item.track.name,
                  images: item.album.images,
                  to: `/song/${item.track.id}`,
                },
              }))}
            />
          ))
        }
        lead={(move) => ({
          images: move.item.album.images,
          name: (
            <Link to={`/song/${move.item.track.id}`}>
              {move.item.track.name}
            </Link>
          ),
          nameText: move.item.track.name,
          meta: `Your top song of ${year} · ${before(move, previousYear)}`,
        })}
      />
    );
  }

  const items =
    artists && artistRanks
      ? withMoves(artists, artistRanks, (a) => a.artist.id)
      : null;
  return (
    <ListPage
      {...common}
      title={`Top artists since ${previousYear}`}
      items={items}
      count={(n) => plural(n, "artist")}
      empty={`You did not listen to any artist in ${year}.`}
      row={artistMoveRow(previousYear)}
      intro={
        nothingBefore(artistRanks) ||
        (artists && previousArtists && (
          <DroppedLine
            title={droppedTitle}
            items={droppedOut(
              previousArtists,
              artists.map((a) => a.artist.id),
              (a) => a.artist.id,
            ).map(({ item, before: rank }) => ({
              before: rank,
              item: {
                id: item.artist.id,
                name: item.artist.name,
                images: item.artist.images,
                to: `/artist/${item.artist.id}`,
                round: true,
              },
            }))}
          />
        ))
      }
      lead={(move) => ({
        images: move.item.artist.images,
        round: true,
        name: (
          <Link to={`/artist/${move.item.artist.id}`}>
            {move.item.artist.name}
          </Link>
        ),
        nameText: move.item.artist.name,
        meta: `Your top artist of ${year} · ${before(move, previousYear)}`,
      })}
    />
  );
}
