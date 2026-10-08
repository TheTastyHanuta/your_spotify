import { useMediaQuery } from "@mui/material";
import { useLocation } from "react-router-dom";

// Pages without the app around them, the centred column of scenes/Account
const hideSiderOnRoutes = [
  "/login",
  "/register",
  "/logout",
  "/registrations-disabled",
  "/oauth/spotify",
];

export function useSider() {
  const { pathname } = useLocation();
  const siderAllowed = !hideSiderOnRoutes.includes(pathname);
  // Phones get a bottom bar instead of the sidebar
  const siderIsDrawer = useMediaQuery("(max-width: 900px)");
  const siderIsRail = useMediaQuery(
    "(min-width: 901px) and (max-width: 1100px)",
  );

  return { siderAllowed, siderIsDrawer, siderIsRail };
}
