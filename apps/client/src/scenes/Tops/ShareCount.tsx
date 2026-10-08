import s from "./index.module.css";

interface ShareCountProps {
  count: number;
  // All plays in the period
  total: number;
  // The number one's count: the bar is drawn relative to it
  max: number;
}

// A play count with a thin bar comparing it to the number one
export default function ShareCount({ count, total, max }: ShareCountProps) {
  const percent = total ? Math.floor((count / total) * 10000) / 100 : 0;
  return (
    <div className={s.share} title={`${percent}% of your plays`}>
      <span className={s.track}>
        <span
          className={s.bar}
          style={{ width: `${max ? Math.max(3, (count / max) * 100) : 0}%` }}
        />
      </span>
      <span className="num">{count.toLocaleString()}</span>
    </div>
  );
}
