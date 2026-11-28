import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PipLogin } from "./components/PipLogin";
import "./styles/tokens.css";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PipLogin />
  </StrictMode>,
);
