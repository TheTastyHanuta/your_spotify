import { ExpandMore } from "@mui/icons-material";
import { Button } from "@mui/material";
import { ReactNode, useCallback, useEffect, useState } from "react";

import Dialog from "../../../components/Dialog";
import ItemRow from "../../../components/ItemRow";
import Loader from "../../../components/Loader";
import LoadingButton from "../../../components/LoadingButton";
import Section from "../../../components/Section";
import Text from "../../../components/Text";
import { api, IsrcMergeState } from "../../../services/apis/api";
import { DateFormatter } from "../../../services/date";
import { alertMessage } from "../../../services/redux/modules/message/reducer";
import { useAppDispatch } from "../../../services/redux/tools";
import SettingLine from "../SettingLine";

import s from "./index.module.css";

// Groups shown before "Show all"
const SHOWN = 50;
// The lookups take a few seconds per song, a refresh now and then is enough
const REFRESH_MS = 30_000;

const num = (value: number) => (
  <span className="num">{value.toLocaleString()}</span>
);

// "Paused until …", "12 of 300 songs checked", …
function lookupStatus({ job, progress, importRunning }: IsrcMergeState) {
  const total = progress.checked + progress.remaining;
  if (!job) {
    return "Not started";
  }
  if (job.stoppedReason === "reauth") {
    return "Stopped: the Spotify login of the admin who started it expired. Log in again, then restart";
  }
  if (job.stoppedReason === "user-missing") {
    return "Stopped: the admin who started it was deleted. Restart it";
  }
  if (progress.remaining === 0) {
    return <>All {num(total)} songs checked</>;
  }
  if (job.rateLimitedUntil && new Date(job.rateLimitedUntil) > new Date()) {
    return (
      <>
        Paused until {DateFormatter.toDateTime(new Date(job.rateLimitedUntil))},
        Spotify is blocking requests
      </>
    );
  }
  if (importRunning) {
    return "Waiting for an import to finish";
  }
  return (
    <>
      {num(progress.checked)} of {num(total)} songs checked
    </>
  );
}

function GroupRow({
  group: { primary, secondaries },
}: {
  group: IsrcMergeState["plan"]["groups"][number];
}) {
  const moved = secondaries.reduce((sum, track) => sum + track.plays, 0);
  return (
    <details className={s.group}>
      <summary className={s.head}>
        <ItemRow
          image={primary.albumImages}
          title={
            <Text element="div" size="normal" className={s.line}>
              {primary.name}
            </Text>
          }
          subtitle={`${primary.artist} · stays on ${primary.album}`}
          right={
            <span className={s.moved}>
              {num(moved)}
              <ExpandMore className={s.chevron} fontSize="small" />
            </span>
          }
        />
      </summary>
      <div className={s.body}>
        {[primary, ...secondaries].map((track) => (
          <ItemRow
            key={track.id}
            image={track.albumImages}
            title={
              <Text element="div" size="normal" className={s.line}>
                {track.album || track.name}
              </Text>
            }
            subtitle={
              track === primary ? "Stays" : `Merged into ${primary.album}`
            }
            right={<>{num(track.plays)} listens</>}
          />
        ))}
      </div>
    </details>
  );
}

// Spotify gives one recording several ids (album, single, compilation). The
// server looks up their ISRCs in the background; this shows how far it got,
// which songs it would merge, and merges them on request.
export default function MergeDuplicates() {
  const dispatch = useAppDispatch();
  const [state, setState] = useState<IsrcMergeState | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.isrcMerge();
      setState(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // A merge runs on its own, also after the lookup stopped
  const active = Boolean(
    state?.job &&
    (state.job.applying ||
      (!state.job.stoppedReason && state.progress.remaining > 0)),
  );

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const interval = setInterval(() => {
      load().catch(console.error);
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [active, load]);

  const start = async () => {
    setSending(true);
    try {
      await api.startIsrcMerge();
    } catch (e) {
      console.error(e);
      dispatch(
        alertMessage({ level: "error", message: "Could not start the lookup" }),
      );
    }
    setSending(false);
    await load();
  };

  const apply = async () => {
    setSending(true);
    try {
      await api.applyIsrcMerge();
      setConfirming(false);
    } catch (e: any) {
      console.error(e);
      dispatch(
        alertMessage({
          level: "error",
          message:
            e?.response?.status === 409
              ? "A merge is already running"
              : "Could not start the merge",
        }),
      );
    }
    setSending(false);
    await load();
  };

  if (!state) {
    return (
      <Section title="Merge duplicate songs" className={s.root}>
        <Loader />
      </Section>
    );
  }

  const { job, progress, plan } = state;
  const canStart = !job || Boolean(job.stoppedReason);
  const hasWork = plan.groups.length > 0 || plan.isrcsToStore > 0;
  const groups = showAll ? plan.groups : plan.groups.slice(0, SHOWN);

  let applyLine: ReactNode = null;
  if (job?.applying) {
    applyLine = "Merging…";
  } else if (job?.lastApply) {
    applyLine = (
      <>
        Last merge {DateFormatter.toDateTime(new Date(job.lastApply.at))}:{" "}
        {num(job.lastApply.tracksMerged)} versions merged,{" "}
        {num(job.lastApply.listensRepointed)} listens moved
      </>
    );
  }

  return (
    <Section title="Merge duplicate songs" className={s.root}>
      <Text element="p" size="normal" className={s.intro}>
        Spotify gives a song a separate id on every release it appears on, like
        the album, a single or a compilation, so the stats can count one song
        several times. The server asks Spotify for each older song&apos;s ISRC,
        the code of the recording itself, one song every few seconds in the
        background. Merging then joins the versions of a recording into the one
        with the most listens, for every user on this server. Album stats keep
        the album each listen was played from.
      </Text>

      <SettingLine
        left="Lookup on Spotify"
        right={
          <span className={s.status}>
            {lookupStatus(state)}
            {canStart && (
              <Button onClick={() => void start()} disabled={sending}>
                {job ? "Restart" : "Start"}
              </Button>
            )}
          </span>
        }
      />
      {progress.checked > 0 && (
        <SettingLine
          left="Found"
          right={
            <>
              {num(progress.found)} with an ISRC, {num(progress.none)} without
            </>
          }
        />
      )}

      <h3 className={s.title}>Preview</h3>
      {!hasWork && (
        <Text element="p" size="normal" className={s.none}>
          {job
            ? `No duplicate songs found${progress.remaining > 0 ? " so far" : ""}.`
            : "Start the lookup to find duplicate songs."}
        </Text>
      )}
      {hasWork && (
        <>
          <SettingLine
            left="Songs with several versions"
            right={num(plan.groups.length)}
          />
          <SettingLine left="Versions merged" right={num(plan.tracksToMerge)} />
          <SettingLine
            left="Listens moved"
            right={num(plan.listensToRepoint)}
          />
          <SettingLine
            left={applyLine ?? "Apply the preview"}
            right={
              <Button
                onClick={() => setConfirming(true)}
                disabled={job?.applying || sending}>
                Merge
              </Button>
            }
          />
          <div className={s.header}>
            <span>Song and the version that stays</span>
            <span>Listens that move</span>
          </div>
          <div>
            {groups.map((group) => (
              <GroupRow key={group.isrc} group={group} />
            ))}
          </div>
          {!showAll && plan.groups.length > SHOWN && (
            <Button onClick={() => setShowAll(true)} className={s.more}>
              Show all {plan.groups.length.toLocaleString()}
            </Button>
          )}
        </>
      )}
      {!hasWork && applyLine && <SettingLine left="Merge" right={applyLine} />}

      <Dialog
        title={
          plan.groups.length > 0
            ? `Merge ${plan.groups.length.toLocaleString()} songs?`
            : "Store the ISRCs?"
        }
        open={confirming}
        onClose={() => setConfirming(false)}>
        <Text element="p" size="normal" className={s.dialogText}>
          {plan.groups.length > 0 && (
            <>
              {num(plan.tracksToMerge)} versions are merged into the version
              with the most listens, and their {num(plan.listensToRepoint)}{" "}
              listens move with them.{" "}
            </>
          )}
          The ISRCs found for {num(plan.isrcsToStore)} other songs are stored,
          so new listens of their other versions count for them. This changes
          the stats of every user on this server and can only be undone from a
          database backup.
        </Text>
        <div className={s.dialogButton}>
          <LoadingButton
            loading={sending}
            onClick={() => void apply()}
            variant="contained">
            Merge
          </LoadingButton>
        </div>
      </Dialog>
    </Section>
  );
}
