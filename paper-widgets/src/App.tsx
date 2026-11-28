import { Batteries } from "./components/Batteries";
import { Calendar } from "./components/Calendar";
import { FocusMode } from "./components/FocusMode";
import { FocusTimer } from "./components/FocusTimer";
import { NowPlaying } from "./components/NowPlaying";
import { Stage } from "./components/Stage";
import { Steps } from "./components/Steps";
import { Weather } from "./components/Weather";
import { useLoop } from "./lib/useLoop";

const DESCRIPTION =
  "Seven paper-white widgets: weather in Lisbon with the sun climbing its arc, a music player changing track, " +
  "a focus timer counting down, a week of steps, three batteries charging, the day's calendar rolling to the " +
  "next event, and a focus-mode switch turning its tile dark.";

export function App() {
  useLoop();

  return (
    <Stage label={DESCRIPTION}>
      <Weather />
      <NowPlaying />
      <FocusTimer />
      <Steps />
      <Batteries />
      <Calendar />
      <FocusMode />
    </Stage>
  );
}
