import { Tab, Tabs } from "@mui/material";
import { Link, useLocation } from "react-router-dom";

import s from "./index.module.css";

export interface ButtonsHeaderItem {
  label: string;
  url: string;
}

interface ButtonsHeaderProps {
  items: ButtonsHeaderItem[];
}

// A page's tab bar under its hero, each tab a link
export default function ButtonsHeader({ items }: ButtonsHeaderProps) {
  const { pathname } = useLocation();
  const current = Math.max(
    0,
    items.findIndex((item) => pathname.startsWith(item.url)),
  );

  return (
    <div className={s.tabs}>
      <Tabs value={current}>
        {items.map((item, index) => (
          <Tab
            key={item.url}
            value={index}
            label={item.label}
            component={Link}
            to={item.url}
          />
        ))}
      </Tabs>
    </div>
  );
}
