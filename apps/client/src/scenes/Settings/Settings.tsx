import { CircularProgress } from "@mui/material";
import clsx from "clsx";
import { useSelector } from "react-redux";
import { Navigate, Route, Routes } from "react-router-dom";

import ButtonsHeader from "../../components/ButtonsHeader";
import FullscreenCentered from "../../components/FullscreenCentered";
import PageHero from "../../components/PageHero";
import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { useConditionalAPI } from "../../services/hooks/hooks";
import { selectSettings } from "../../services/redux/modules/settings/selector";
import {
  selectIsPublic,
  selectUser,
} from "../../services/redux/modules/user/selector";
import { compact, conditionalEntry } from "../../services/tools";
import AccountInfos from "./AccountInfos";
import AllowRegistration from "./AllowRegistration";
import BlacklistArtist from "./BlacklistArtist";
import DarkMode from "./DarkMode";
import DateFormat from "./DateFormat";
import DeleteUser from "./DeleteUser";
import EnableAffinity from "./EnableAffinity";
import Importer from "./Importer";
import PublicToken from "./PublicToken";
import RelogToSpotify from "./RelogToSpotify";
import SetAdmin from "./SetAdmin";
import SpotifyAccountInfos from "./SpotifyAccountInfos";
import { StatMeasurement } from "./StatMeasurement";
import Timezone from "./Timezone";

import s from "./index.module.css";

export default function Settings() {
  const settings = useSelector(selectSettings);
  const user = useSelector(selectUser);
  const isPublic = useSelector(selectIsPublic);
  // Needs a login: a guest's 401 would send them to the login page
  const [sme] = useConditionalAPI(!isPublic, api.sme);

  if (!settings) {
    return (
      <FullscreenCentered>
        <CircularProgress />
        <Text element="h3" size="big">
          Your settings are loading
        </Text>
      </FullscreenCentered>
    );
  }

  if (!user) {
    return null;
  }

  const tabs = compact([
    { url: "/settings/account", label: "Account" },
    conditionalEntry(
      { url: "/settings/statistics", label: "Statistics" },
      !isPublic,
    ),
    conditionalEntry(
      { url: "/settings/admin", label: "Admin" },
      user.admin && !isPublic,
    ),
  ]);

  return (
    <div>
      <PageHero
        title="Settings"
        hideInterval
        images={sme?.images}
        round
        name={user.username}
        nameText={user.username}
        meta={
          sme && !isPublic
            ? `Linked to ${sme.display_name} on Spotify · ${sme.product}`
            : undefined
        }
      />
      <ButtonsHeader items={tabs} />
      <div>
        <Routes>
          <Route
            path="/account"
            element={
              <div className={clsx("ruled-columns", s.panels)}>
                {!isPublic && (
                  <AccountInfos
                    user={user}
                    settings={settings}
                    isPublic={isPublic}
                  />
                )}
                {sme && !isPublic && (
                  <SpotifyAccountInfos spotifyAccount={sme} />
                )}
                <DarkMode />
                {!isPublic && <RelogToSpotify />}
                {!isPublic && <Importer />}
                {!isPublic && <PublicToken />}
              </div>
            }
          />
          <Route
            path="/admin"
            element={
              <div className={clsx("ruled-columns", s.panels)}>
                {user.admin && !isPublic && <SetAdmin />}
                {user.admin && !isPublic && <DeleteUser />}
                {user.admin && !isPublic && (
                  <AllowRegistration settings={settings} />
                )}
                {user.admin && !isPublic && (
                  <EnableAffinity settings={settings} />
                )}
              </div>
            }
          />
          <Route
            path="/statistics"
            element={
              <div className={clsx("ruled-columns", s.panels)}>
                {!isPublic && <BlacklistArtist />}
                {!isPublic && <Timezone />}
                {!isPublic && <DateFormat />}
                {!isPublic && <StatMeasurement />}
              </div>
            }
          />
          <Route
            path="*"
            element={<Navigate to="/settings/account" replace />}
          />
        </Routes>
      </div>
    </div>
  );
}
