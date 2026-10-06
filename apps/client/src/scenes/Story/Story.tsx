import { Grid, MenuItem, Select } from "@mui/material";
import { formatDistanceToNowStrict } from "date-fns";
import { useSearchParams } from "react-router-dom";

import AddToPlaylist from "../../components/AddToPlaylist";
import Header from "../../components/Header";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import ItemRow, { ArtistNames, RowsSkeleton } from "../../components/ItemRow";
import Masonry from "../../components/Masonry";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { useAPI } from "../../services/hooks/hooks";
import { plural } from "../../services/tools";
import Eras from "./Eras";

import s from "./index.module.css";

// How long a favourite has to be quiet, kept in the URL as ?since=
const SINCE = {
  "3m": { days: 91, label: "3 months" },
  "6m": { days: 182, label: "6 months" },
  "1y": { days: 365, label: "1 year" },
};
type Since = keyof typeof SINCE;
const DEFAULT_SINCE: Since = "6m";

// "last heard 4 months ago · most in Dec 2023"
const when = (item: { peak: string; last: string }) => {
  const [year, month] = item.peak.split("-").map(Number);
  return `last heard ${formatDistanceToNowStrict(new Date(item.last), { addSuffix: true })} · most in ${DateFormatter.toShortMonthYear(new Date(year!, month! - 1))}`;
};

export default function Story() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("since");
  const since: Since =
    asked && asked in SINCE ? (asked as Since) : DEFAULT_SINCE;
  const forgotten = useAPI(api.getForgotten, SINCE[since].days);

  const quiet = SINCE[since].label;
  const empty = (
    <Text size="normal">
      Nothing you played 10 times or more has been quiet for {quiet}.
    </Text>
  );

  return (
    <div>
      <Header
        title="Your story"
        subtitle="Your whole history, whatever the period"
        hideInterval
      />
      <div className={s.content}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Text element="h2" size="huge" className={s.section}>
              Forgotten favorites
            </Text>
            <Text element="div" size="normal" greyed>
              Your most played songs and artists that you have not played for{" "}
              <Select
                variant="standard"
                value={since}
                className={s.since}
                onChange={(event) =>
                  setParams((query) => {
                    query.set("since", event.target.value);
                    return query;
                  })
                }>
                {Object.entries(SINCE).map(([key, { label }]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </Text>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Masonry>
              {[
                <TitleCard
                  key="tracks"
                  title="Songs"
                  right={
                    forgotten &&
                    forgotten.tracks.length > 0 && (
                      <AddToPlaylist
                        context={{
                          type: "specific",
                          songIds: forgotten.tracks.map((t) => t.track.id),
                        }}
                      />
                    )
                  }>
                  {forgotten ? (
                    forgotten.tracks.length > 0 ? (
                      forgotten.tracks.map((item, index) => (
                        <ItemRow
                          key={item.track.id}
                          rank={index + 1}
                          image={item.track.full_album.images}
                          title={
                            <InlineTrack track={item.track} size="normal" />
                          }
                          subtitle={
                            <>
                              <ArtistNames artists={item.track.full_artists} />
                              <Text size="normal" greyed className={s.ellipsis}>
                                {when(item)}
                              </Text>
                            </>
                          }
                          right={plural(item.total, "play")}
                        />
                      ))
                    ) : (
                      empty
                    )
                  ) : (
                    <RowsSkeleton />
                  )}
                </TitleCard>,
                <TitleCard key="artists" title="Artists">
                  {forgotten ? (
                    forgotten.artists.length > 0 ? (
                      forgotten.artists.map((item, index) => (
                        <ItemRow
                          key={item.artist.id}
                          rank={index + 1}
                          image={item.artist.images}
                          round
                          title={
                            <InlineArtist artist={item.artist} size="normal" />
                          }
                          subtitle={when(item)}
                          right={plural(item.total, "play")}
                        />
                      ))
                    ) : (
                      empty
                    )
                  ) : (
                    <RowsSkeleton />
                  )}
                </TitleCard>,
              ]}
            </Masonry>
          </Grid>
          <Grid size={{ xs: 12 }} className={s.nextSection}>
            <Text element="h2" size="huge" className={s.section}>
              Eras
            </Text>
            <Text element="div" size="normal" greyed>
              Stretches of at least 3 months when one artist or genre clearly
              led your listening.
            </Text>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Eras />
          </Grid>
        </Grid>
      </div>
    </div>
  );
}
