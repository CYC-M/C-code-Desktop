import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app.tsx";
import "./theme.css";

const rootEl = document.querySelector("#root");
if (rootEl !== null) {
  createRoot(rootEl).render(React.createElement(App));
}
