import { CircularProgress } from "@mui/material";
import { ReactNode, useEffect } from "react";
import { useSelector } from "react-redux";

import { useNavigate } from "../../services/hooks/useNavigate";
import { selectAccounts } from "../../services/redux/modules/admin/selector";
import {
  selectLoaded,
  selectUser,
} from "../../services/redux/modules/user/selector";
import FullscreenCentered from "../FullscreenCentered";
import Text from "../Text";

interface PrivateRouteProps {
  children: ReactNode;
  // For pages whose requests need a login, which a share-link guest lacks
  noGuests?: boolean;
}

export default function PrivateRoute({
  children,
  noGuests,
}: PrivateRouteProps): ReactNode {
  const user = useSelector(selectUser);
  const accounts = useSelector(selectAccounts);
  const loaded = useSelector(selectLoaded);
  const navigate = useNavigate();

  useEffect(() => {
    if (loaded && !user) {
      navigate("/login");
    }
  }, [loaded, navigate, user]);

  if (!loaded) {
    return <CircularProgress />;
  }
  if (!user || !accounts || accounts.length === 0) {
    return <div />;
  }
  if (noGuests && user.isGuest) {
    return (
      <FullscreenCentered>
        <Text element="h3" size="big">
          This page is not available when viewing as a guest
        </Text>
      </FullscreenCentered>
    );
  }
  return children;
}
