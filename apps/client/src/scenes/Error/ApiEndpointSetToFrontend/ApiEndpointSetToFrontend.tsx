import Text from "../../../components/Text";
import { getApiEndpoint } from "../../../services/tools";

import s from "../../../styles/centered.module.css";

export default function ApiEndpointSetToFrontend() {
  return (
    <main className={s.root}>
      <h1 className={s.wordmark}>The API endpoint is set up wrong</h1>
      <Text element="p" size="normal" className={s.explain}>
        This request should have reached the server but reached the web client
        instead. Usually <code>API_ENDPOINT</code> points to the client instead
        of the server; check your configuration.
      </Text>
      <Text element="p" size="normal" className={s.explain}>
        Current setting: <code>API_ENDPOINT={getApiEndpoint()}</code>
      </Text>
    </main>
  );
}
