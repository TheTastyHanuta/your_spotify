import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";

import App from "./App";
import store from "./services/redux";
import "@fontsource-variable/bricolage-grotesque";

import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "./index.css";

const element = document.getElementById("root");
const root = ReactDOM.createRoot(element!);

root.render(
  <Provider store={store}>
    <App />
  </Provider>,
);
