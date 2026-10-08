import { useMemo } from "react";
import { useSelector } from "react-redux";
import { Link, Navigate, useParams } from "react-router-dom";

import ListPage, { NB_ALL } from "../../components/ListPage";
import { api } from "../../services/apis/api";
import { useAPI } from "../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../services/redux/modules/user/selector";
import { percent, plural } from "../../services/tools";
import {
  byPlays,
  capitalize,
  genreRow,
  GENRES_EMPTY,
  GenresNote,
  TOP_YEARS_INFO,
  yearRow,
} from "./rows";

// The full Taste lists behind "See all", at /taste/<list>

const back = { to: "/taste", label: "Taste" };

export default function TasteList() {
  const { list } = useParams();
  switch (list) {
    case "genres":
      return <Genres />;
    case "release-years":
      return <ReleaseYears />;
    default:
      return <Navigate to="/taste" replace />;
  }
}

function Genres() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const genres = useAPI(api.getGenres, interval.start, interval.end, NB_ALL);
  // Not read inside lead: the React Compiler would read it before the load
  const totalPlays = genres?.totalPlays ?? 0;
  return (
    <ListPage
      title="Genres"
      back={back}
      items={genres?.genres ?? null}
      count={(n) => plural(n, "genre")}
      empty={GENRES_EMPTY}
      intro={genres && <GenresNote genres={genres} />}
      row={genres ? genreRow(genres) : () => null}
      lead={(genre) => {
        const artist = genre.artists[0];
        return {
          images: artist?.images,
          round: true,
          name: capitalize(genre.genre),
          nameText: genre.genre,
          meta: (
            <>
              <span className="num">{percent(genre.plays, totalPlays)}%</span>{" "}
              of your plays
              {artist && (
                <>
                  {" "}
                  · most played in it:{" "}
                  <Link to={`/artist/${artist.id}`}>{artist.name}</Link>
                </>
              )}
            </>
          ),
        };
      }}
    />
  );
}

function ReleaseYears() {
  const { interval } = useSelector(selectRawIntervalDetail);
  const taste = useAPI(api.getTaste, interval.start, interval.end);
  const years = useMemo(() => taste && byPlays(taste.years), [taste]);
  return (
    <ListPage
      title="Most played release years"
      back={back}
      items={years}
      info={TOP_YEARS_INFO}
      count={(n) => plural(n, "release year")}
      empty="Nothing played in this period."
      row={yearRow}
      lead={(year) => ({
        images: year.top.track?.full_album.images,
        name: String(year.year),
        nameText: String(year.year),
        meta: (
          <>
            <span className="num">{year.plays.toLocaleString()}</span> plays
            {year.top.track && (
              <>
                {" "}
                · most played:{" "}
                <Link to={`/song/${year.top.track.id}`}>
                  {year.top.track.name}
                </Link>
              </>
            )}
          </>
        ),
      })}
    />
  );
}
