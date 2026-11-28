import GameScreen from "./components/GameScreen";
import MainMenu from "./components/MainMenu";
import { useUI } from "./store";

export default function App() {
  const screen = useUI((s) => s.screen);
  return screen === "menu" ? <MainMenu /> : <GameScreen />;
}
