import { ReactNode } from "react";

export interface SiderLink {
  label: string;
  link: string;
  icon: ReactNode;
  restrict?: "guest";
}

export interface SiderCategory {
  // Empty for the group without a heading
  label: string;
  items: SiderLink[];
}
