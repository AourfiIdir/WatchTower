import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Welcome from './pages/Welcome'
import Monitors from './pages/Monitors'
import Checks from './pages/Checks'
import Incidents from './pages/Incidents'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Welcome />} />
          <Route path="/monitors" element={<Monitors />} />
          <Route path="/checks" element={<Checks />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
