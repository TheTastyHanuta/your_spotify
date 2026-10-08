import { Tooltip } from "@mui/material";
import { Link } from "react-router-dom";

import IdealImage from "../../components/IdealImage";
import { RowsSkeleton } from "../../components/ItemRow";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { DiscoveryOverviewResponse } from "../../services/apis/api";
import { plural } from "../../services/tools";

import s from "./index.module.css";

const TITLE = "Did they stick?";
const INFO =
  "Artists first heard in this period and played at least 3 times. They stuck when you played them at least 3 times from 3 months after the first listen. Until 4 months after it, it is too early to tell.";

interface StickProps {
  stick: DiscoveryOverviewResponse["stick"] | undefined;
}

export default function Stick({ stick }: StickProps) {
  if (!stick) {
    return (
      <Section title={TITLE} info={INFO}>
        <RowsSkeleton />
      </Section>
    );
  }

  const { stuck, faded, early } = stick;
  const judged = stuck + faded;
  if (judged + early === 0) {
    return (
      <Section title={TITLE} info={INFO}>
        <Text size="normal" greyed>
          No artist discovered in this period was played 3 times or more.
        </Text>
      </Section>
    );
  }

  const groups = [
    { key: "stuck", label: "Stuck", count: stuck, className: s.stuck },
    { key: "faded", label: "Faded", count: faded, className: s.faded },
    {
      key: "early",
      label: "Too early to tell",
      count: early,
      className: s.early,
    },
  ].filter((group) => group.count > 0);

  const laterNote =
    early > 0
      ? ` ${plural(early, "more artist")} ${early === 1 ? "was" : "were"} first heard less than 4 months ago, too early to tell.`
      : "";

  return (
    <Section title={TITLE} info={INFO}>
      <Text element="div" size="normal" className={s.summary}>
        {judged > 0
          ? `${stuck.toLocaleString()} of the ${plural(judged, "artist")} you discovered stuck (${Math.round((stuck / judged) * 100)}%): you still played them 3 months or more after the first listen.${laterNote}`
          : `Too early to tell: the ${plural(early, "artist")} you discovered were first heard less than 4 months ago.`}
      </Text>
      <div className={s.stickBar}>
        {groups.map((group) => (
          <Tooltip
            key={group.key}
            disableInteractive
            title={`${group.label}: ${plural(group.count, "artist")}`}>
            <div
              className={group.className}
              style={{ flexGrow: group.count }}
            />
          </Tooltip>
        ))}
      </div>
      <div className={s.stickLegend}>
        {groups.map((group) => (
          <Text key={group.key} size="normal" greyed>
            <span className={`${s.swatch} ${group.className}`} />
            {group.label} {group.count.toLocaleString()}
          </Text>
        ))}
      </div>
      {stick.artists.length > 0 && (
        <div className={s.stuckArtists}>
          {stick.artists.map(({ artist, late }) => (
            <Tooltip
              key={artist.id}
              disableInteractive
              title={`${artist.name}: ${plural(late, "play")} from 3 months after the first listen`}>
              <Link to={`/artist/${artist.id}`} aria-label={artist.name}>
                <IdealImage
                  images={artist.images}
                  size={48}
                  className={s.avatar}
                />
              </Link>
            </Tooltip>
          ))}
        </div>
      )}
    </Section>
  );
}
