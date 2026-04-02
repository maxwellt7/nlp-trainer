import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Learn from './pages/Learn';
import Lesson from './pages/Lesson';
import Practice from './pages/Practice';
import Reference from './pages/Reference';
import Hypnosis from './pages/Hypnosis';
import Audios from './pages/Audios';
import Sessions from './pages/Sessions';
import Insights from './pages/Insights';
import Identity from './pages/Identity';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/hypnosis" element={<Hypnosis />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/identity" element={<Identity />} />
          <Route path="/audios" element={<Audios />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/learn/:lessonId" element={<Lesson />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/reference" element={<Reference />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
