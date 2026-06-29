import { AppQuery } from './components/impl1/AppQuery';

function App() {
  const mode = import.meta.env.VITE_STATE_MODE;
  if (mode === 'query') return <AppQuery />;
  return <p>State mode "{mode}" is not implemented yet.</p>;
}

export default App;
