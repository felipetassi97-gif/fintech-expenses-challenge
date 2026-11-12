import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <main><h1>Gestão financeira</h1><p>Aplicação em preparação.</p></main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
