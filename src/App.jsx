import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Read from './pages/Read';
import Translations from './pages/Translations';
import Notes from './pages/Notes';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/read" element={<Read />} />
        <Route path="/read/:translationId/:bookId/:chapter" element={<Read />} />
        <Route path="/translations" element={<Translations />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
