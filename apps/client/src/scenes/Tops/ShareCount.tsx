import s from "./index.module.css";

interface ShareCountProps {
  value: number;
  // The whole period's plays or time
  total: number;
  // The number one's value: the bar is drawn relative to it
  max: number;
  label: string;
  of: string;
}

// A play count or time with a thin bar comparing it to the number one
export default function ShareCount({
  value,
  total,
  max,
  label,
  of,
}: ShareCountProps) {
  const percent = total ? Math.floor((value / total) * 10000) / 100 : 0;
  return (
    <div className={s.share} title={`${percent}% of your ${of}`}>
      <span className={s.track}>
        <span
          className={s.bar}
          style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%` }}
        />
      </span>
      <span className="num">{label}</span>
    </div>
  );
}
