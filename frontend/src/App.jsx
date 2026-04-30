import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Layout from "./components/layout/Layout"
import Dashboard from "./pages/Dashboard"
import Urunler from "./pages/Urunler"
import Hareketler from "./pages/Hareketler"
import Tahmin from "./pages/analitik/Tahmin"
import EOQ from "./pages/analitik/EOQ"
import StokRaporlar from "./pages/analitik/StokRaporlar"
import Login from "./pages/Login"

// Giriş yapılmamışsa /login'e yönlendir
function GizliRoute({ children }) {
  const kullanici = localStorage.getItem("smartstock_user")
  if (!kullanici) return <Navigate to="/login" replace />
  return children
}

// Giriş yapılmışsa direkt dashboard'a yönlendir
function AcikRoute({ children }) {
  const kullanici = localStorage.getItem("smartstock_user")
  if (kullanici) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AcikRoute><Login /></AcikRoute>} />
        <Route path="/" element={<GizliRoute><Layout><Dashboard /></Layout></GizliRoute>} />
        <Route path="/urunler" element={<GizliRoute><Layout><Urunler /></Layout></GizliRoute>} />
        <Route path="/hareketler" element={<GizliRoute><Layout><Hareketler /></Layout></GizliRoute>} />
        <Route path="/analitik" element={<GizliRoute><Navigate to="/analitik/tahmin" /></GizliRoute>} />
        <Route path="/analitik/tahmin" element={<GizliRoute><Layout><Tahmin /></Layout></GizliRoute>} />
        <Route path="/analitik/eoq" element={<GizliRoute><Layout><EOQ /></Layout></GizliRoute>} />
        <Route path="/analitik/stok" element={<GizliRoute><Layout><StokRaporlar /></Layout></GizliRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
