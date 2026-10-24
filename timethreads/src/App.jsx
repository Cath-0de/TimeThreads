import HistoryGraph from "./components/historygraph";
import SenatorGraph from "./components/SenatorGraph";

export default function App() {
  return (
    <main style={{ padding: "24px" }}>
      <h1>U.S. Senate Explorer</h1>
      <p>Explore senators by political party.</p>
      <HistoryGraph />
    </main>
  );
}