import { Link } from "react-router-dom";

import IdealImage from "../../components/IdealImage";
import InlineTrack from "../../components/InlineTrack";
import { RowsSkeleton } from "../../components/ItemRow";
import Section from "../../components/Section";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { DateFormatter, fromDay } from "../../services/date";
import { clickedText, weeksText } from "../../services/hooked";
import { useAPI } from "../../services/hooks/hooks";

import s from "./index.module.css";

const PER_YEAR = 3;

// The strongest hooks of each year, newest first; the bar is the weeks the
// song held you, against the longest hook shown
export default function Hooks() {
  const years = useAPI(api.getHooksPerYear, PER_YEAR);
  const longest = Math.max(
    1,
    ...(years ?? []).flatMap((y) => y.hooks.map((h) => h.weeks)),
  );

  return (
    <Section
      title="Your hooks over the years"
      info="The songs that suddenly took over each year, strongest first: at least 6 plays in 7 days, four times your usual for them. The bar is how many weeks each one held you"
      link={
        years && years.length > 0
          ? { to: "/story/hooks", label: "See all" }
          : undefined
      }>
      {years ? (
        years.length > 0 ? (
          <div className={s.hookYears}>
            {years.map(({ year, hooks }) => (
              <div key={year} className={s.hookYear}>
                <div className="num">{year}</div>
                <div className={s.hookList}>
                  {hooks.map((h) => {
                    const note = [
                      DateFormatter.toMonthString(fromDay(h.hook)),
                      h.track.full_artists.map((a) => a.name).join(", "),
                      clickedText(h.knownDays),
                    ].filter(Boolean);
                    return (
                      <div key={h.track.id} className={s.hook}>
                        <Link
                          to={`/song/${h.track.id}`}
                          tabIndex={-1}
                          className={s.hookCover}>
                          <IdealImage
                            images={h.track.full_album.images}
                            size={40}
                          />
                        </Link>
                        <div className={s.hookText}>
                          <InlineTrack track={h.track} size="normal" />
                          <Text
                            size="normal"
                            greyed
                            element="div"
                            className={s.ellipsis}>
                            {note.join(" · ")}
                          </Text>
                        </div>
                        <div className={s.hookWeeks}>
                          <span
                            style={{
                              width: `calc((100% - 64px) * ${h.weeks / longest})`,
                            }}
                          />
                          <span className="num">{weeksText(h.weeks)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Text size="normal" greyed>
            No song has hooked you yet.
          </Text>
        )
      ) : (
        <RowsSkeleton />
      )}
    </Section>
  );
}
