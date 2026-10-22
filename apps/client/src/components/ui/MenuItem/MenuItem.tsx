import clsx from "clsx";
import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";

import s from "./index.module.css";

export interface MenuItemProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value"
> {
  children: ReactNode;
  value?: unknown;
  selected?: boolean;
  // Removes something, set in --down
  destructive?: boolean;
}

export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(
  function MenuItem(
    {
      className,
      children,
      disabled,
      selected,
      destructive,
      value: _value,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={clsx(
          s.item,
          selected && s.selected,
          destructive && s.destructive,
          className,
        )}
        {...props}>
        {children}
      </button>
    );
  },
);
