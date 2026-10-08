import clsx from "clsx";
import React from "react";
import { useSelector } from "react-redux";

import { selectPublicToken } from "../../services/redux/modules/user/selector";
import Text from "../Text";
import BottomBar from "./BottomBar";
import Sider from "./Sider";
import { useSider } from "./useSider";

import s from "./index.module.css";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { siderAllowed, siderIsDrawer, siderIsRail } = useSider();

  const publicToken = useSelector(selectPublicToken);

  return (
    <div className={s.root}>
      {siderAllowed && !siderIsDrawer && (
        <section className={s.sider}>
          <Sider rail={siderIsRail} />
        </section>
      )}
      <section
        className={clsx(s.content, {
          [s.withsider]: siderAllowed && !siderIsDrawer && !siderIsRail,
          [s.withrail]: siderAllowed && siderIsRail,
          [s.withbar]: siderAllowed && siderIsDrawer,
        })}>
        {publicToken && (
          <div className={s.publictoken}>
            <Text size="normal">You are viewing as guest</Text>
          </div>
        )}
        {children}
      </section>
      {siderAllowed && siderIsDrawer && <BottomBar />}
    </div>
  );
}
