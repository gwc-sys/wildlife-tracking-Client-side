import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import GetInvolved from './pages/GetInvolved';
import Messages from './pages/Messages';
import Materials from './pages/Materials';
import Press from './pages/Press';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/get-involved" element={<GetInvolved />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/press" element={<Press />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;