import { PlayArrow } from "@mui/icons-material";
import {
  Button,
  IconButton,
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { ReactNode, useState } from "react";
import { useSelector } from "react-redux";

import Header from "../../components/Header";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import { api } from "../../services/apis/api";
import {
  selectRawIntervalDetail,
  selectUser,
} from "../../services/redux/modules/user/selector";
import { Timesplit } from "../../services/types";

interface Request<T> {
  title: string;
  prepare?: () => Promise<T>;
  request: (prepared: T) => Promise<any>;
}

const NOT_FINISHED_REQUEST = -1;
const FAILED_REQUEST = -2;

export default function Benchmarks() {
  const { interval } = useSelector(selectRawIntervalDetail);

  const [elapsedTime, setElapsedTime] = useState<Record<string, number>>({});

  const user = useSelector(selectUser);

  if (!user) {
    return null;
  }

  const NB = 30;
  const OFFSET = 0;

  const requests = [
    {
      title: "Get tracks",
      request: () => api.getTracks(interval.start, interval.end, 20, OFFSET),
    },
    {
      title: "Get most listened",
      request: () =>
        api.mostListened(interval.start, interval.end, Timesplit.all),
    },
    {
      title: "Get songs per",
      request: () => api.songsPer(interval.start, interval.end, Timesplit.all),
    },
    {
      title: "Get time per",
      request: () => api.timePer(interval.start, interval.end, Timesplit.all),
    },
    {
      title: "Get time per hour of day",
      request: () => api.timePerHourOfDay(interval.start, interval.end),
    },
    {
      title: "Get best songs",
      request: () => api.getBestSongs(interval.start, interval.end, NB, OFFSET),
    },
    {
      title: "Get best artists",
      request: () =>
        api.getBestArtists(interval.start, interval.end, NB, OFFSET),
    },
    {
      title: "Get best albums",
      request: () =>
        api.getBestAlbums(interval.start, interval.end, NB, OFFSET),
    },
    {
      title: "Get artist shares",
      request: () =>
        api.getArtistShares(interval.start, interval.end, Timesplit.month),
    },
    {
      title: "Get release years per",
      request: () =>
        api.getReleaseYearsPer(interval.start, interval.end, Timesplit.month),
    },
    {
      title: "Get best artists of part of day",
      request: () =>
        api.getBestOfPartOfDay(interval.start, interval.end, "artists"),
    },
    {
      title: "Get best songs of part of day",
      request: () =>
        api.getBestOfPartOfDay(interval.start, interval.end, "tracks"),
    },
    {
      title: "Get discoveries",
      request: () => api.getDiscoveries(interval.start, interval.end, 10),
    },
    {
      title: "Get discovery overview",
      request: () => api.getDiscoveryOverview(interval.start, interval.end),
    },
    {
      title: "Get songs on repeat",
      request: () => api.getOnRepeat(interval.start, interval.end),
    },
    {
      title: "Get new plays per",
      request: () =>
        api.getNewPlaysPer(interval.start, interval.end, Timesplit.month),
    },
    {
      title: "Get longest sessions",
      request: () => api.getLongestSessions(interval.start, interval.end),
    },
    {
      title: "Get artist page",
      prepare: async () => {
        const { data: bestArtists } = await api.getBestArtists(
          interval.start,
          interval.end,
          1,
          0,
        );
        const [bestArtist] = bestArtists;
        return bestArtist?.artist.id;
      },
      request: async (bestArtistId: string) => api.getArtistStats(bestArtistId),
    },
    {
      title: "Get album page",
      prepare: async () => {
        const { data: bestAlbums } = await api.getBestAlbums(
          interval.start,
          interval.end,
          1,
          0,
        );
        const [bestAlbum] = bestAlbums;
        return bestAlbum?.album.id;
      },
      request: async (bestAlbumId: string) => api.getAlbumStats(bestAlbumId),
    },
    {
      title: "Get track page",
      prepare: async () => {
        const { data: bestTracks } = await api.getBestSongs(
          interval.start,
          interval.end,
          1,
          0,
        );
        const [bestTrack] = bestTracks;
        return bestTrack?.track.id;
      },
      request: async (bestTrackId: string) => api.getTrackStats(bestTrackId),
    },
  ] as const satisfies Request<any>[];

  const run = async (req: Request<any>) => {
    setElapsedTime((prev) => ({ ...prev, [req.title]: NOT_FINISHED_REQUEST }));
    let prepared = undefined;
    if (req.prepare) {
      prepared = await req.prepare();
    }
    if (!prepared && req.prepare) {
      setElapsedTime((prev) => ({ ...prev, [req.title]: FAILED_REQUEST }));
      return;
    }
    const start = Date.now();
    const { data: result } = await req.request(prepared);
    console.log("Result", result);
    const end = Date.now();
    setElapsedTime((prev) => ({ ...prev, [req.title]: end - start }));
  };

  const runAll = async () => {
    // We need to run the requests in sequence to get a more
    // accurate measure of the time it takes to run each request separately.
    for (const req of requests) {
      await run(req);
    }
  };

  return (
    <div>
      <Header title="Benchmarks" subtitle="Analyze server queries time" />
      <TitleCard
        title="Benchmarks"
        right={
          <Button variant="contained" onClick={runAll}>
            Run All
          </Button>
        }>
        <Table>
          <TableHead>
            <TableCell>Request</TableCell>
            <TableCell align="right">Elapsed time</TableCell>
            <TableCell
              padding="none"
              align="right"
              style={{ paddingRight: 24 }}>
              Actions
            </TableCell>
          </TableHead>
          {requests.map((req) => {
            let elapsed: ReactNode;
            const requestTimeElapsed = elapsedTime[req.title];
            if (requestTimeElapsed === NOT_FINISHED_REQUEST) {
              elapsed = <i>Loading...</i>;
            } else if (requestTimeElapsed === FAILED_REQUEST) {
              elapsed = <i>Failed</i>;
            } else if (requestTimeElapsed) {
              elapsed = `${requestTimeElapsed}ms`;
            }

            return (
              <TableRow key={req.title}>
                <TableCell component="th" scope="row">
                  <Text size="normal">{req.title}</Text>
                </TableCell>
                <TableCell align="right">
                  <Text size="normal">{elapsed}</Text>
                </TableCell>
                <TableCell
                  padding="none"
                  align="right"
                  style={{ paddingRight: 12 }}>
                  <IconButton color="success" onClick={() => run(req)}>
                    <PlayArrow />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </Table>
      </TitleCard>
    </div>
  );
}
