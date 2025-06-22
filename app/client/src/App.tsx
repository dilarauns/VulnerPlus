import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import FalcoPage from './pages/FalcoPage';
import TrivyPage from './pages/TrivyPage';
import PmdPage from './pages/PmdPage';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navbar />
        <div className="container">
          <Routes>
            <Route path="/falco" element={<FalcoPage />} />
            <Route path="/trivy" element={<TrivyPage />} />
            <Route path="/pmd" element={<PmdPage />} />
            <Route path="/" element={<FalcoPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
