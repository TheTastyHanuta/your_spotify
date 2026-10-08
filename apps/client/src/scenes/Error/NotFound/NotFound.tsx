import { Link } from "react-router-dom";

import PageHero from "../../../components/PageHero";

// Unknown addresses, inside the app so the menu stays at hand
export default function NotFound() {
  return (
    <PageHero
      title="Page not found"
      hideInterval
      empty={
        <>
          There is no page at this address.{" "}
          <Link to="/">Go to the overview</Link>
        </>
      }
    />
  );
}
