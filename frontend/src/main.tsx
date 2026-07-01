import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { init as i18nInit } from "@/lib/i18n";
import App from "./App";

i18nInit();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
