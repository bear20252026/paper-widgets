import { useGameStore } from "../store/gameStore";
import { t } from "./index";

/** Subscribe the component to language changes and return the translator. */
export function useT(): typeof t {
  useGameStore((s) => s.lang);
  return t;
}
