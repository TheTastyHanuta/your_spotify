import { Skeleton, Tab, Tabs } from "@mui/material";
import clsx from "clsx";
import { ReactNode } from "react";
import { Link } from "react-router-dom";

import { ITooltip } from "../iTooltip/iTooltip";

import s from "./index.module.css";

interface SectionProps {
  title: string;
  // Explains the section, in a tooltip next to the title
  info?: string;
  tabs?: { value: string; label: string }[];
  tab?: string;
  onTab?: (value: string) => void;
  link?: { to: string; label: string };
  // Extra controls on the right of the heading
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}

// A titled part of a page. It draws no border: the page grid draws the rules
// between sections.
export default function Section({
  title,
  info,
  tabs,
  tab,
  onTab,
  link,
  right,
  children,
  className,
}: SectionProps) {
  return (
    <section className={clsx(s.root, className)}>
      <div className={s.head}>
        <div className={s.titleWrap}>
          <h2 className={s.title}>{title}</h2>
          <ITooltip content={info} />
        </div>
        {tabs && (
          <Tabs
            value={tab}
            onChange={(_, value: string) => onTab?.(value)}
            className={s.tabs}>
            {tabs.map((t) => (
              <Tab key={t.value} value={t.value} label={t.label} />
            ))}
          </Tabs>
        )}
        {(link || right) && (
          <div className={s.right}>
            {right}
            {link && (
              <Link to={link.to} className={s.link}>
                {link.label}
              </Link>
            )}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

// A chart's section while its data loads
export function ChartSkeleton({ title }: { title: string }) {
  return (
    <Section title={title}>
      <Skeleton variant="rectangular" height={300} />
    </Section>
  );
}
