import { Link, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect, useRef, useCallback } from "react"
import { Sun, Moon, BarChart2, Package, TrendingUp, ArrowLeftRight, Globe, Bell, Search, X, LogOut, User, Settings, ChevronDown, TrendingDown, FileText, AlertTriangle, Calculator } from "lucide-react"
import axios from "axios"

const API = "http://127.0.0.1:8000"

const çeviriler = {
  tr: { dashboard: "Genel Bakış", urunler: "Ürünler", analitik: "Analitik", hareketler: "Hareketler", tahmin: "Talep Tahmini", eoq: "EOQ Hesaplama", stok: "Stok & Raporlar" },
  en: { dashboard: "Overview",    urunler: "Products", analitik: "Analytics", hareketler: "Movements", tahmin: "Demand Forecast", eoq: "EOQ Calculator", stok: "Stock & Reports" },
  de: { dashboard: "Übersicht",   urunler: "Produkte", analitik: "Analytik", hareketler: "Bewegungen", tahmin: "Nachfrageprognose", eoq: "EOQ Rechner", stok: "Lager & Berichte" },
}

export default function Navbar() {
  const location  = useLocation()
  const navigate  = useNavigate()

  // Giriş yapmış kullanıcıyı localStorage'dan oku
  const kullanici = (() => {
    try { return JSON.parse(localStorage.getItem("smartstock_user")) } catch { return null }
  })()

  function cikisYap() {
    localStorage.removeItem("smartstock_user")
    navigate("/login")
  }

  const [dark, setDark]               = useState(false)
  const [dil, setDil]                 = useState("tr")
  const [dilMenu, setDilMenu]         = useState(false)
  const [profilMenu, setProfilMenu]   = useState(false)
  const [bildirimMenu, setBildirimMenu] = useState(false)
  const [analitikMenu, setAnalitikMenu] = useState(false)
  const [arama, setArama]             = useState("")
  const [aramaFocus, setAramaFocus]   = useState(false)
  const [kritikUrunler, setKritikUrunler] = useState([])
  const [aramaSonuclari, setAramaSonuclari] = useState([])

  // Her menü için ayrı ref
  const analitikRef  = useRef(null)
  const dilRef       = useRef(null)
  const bildirimRef  = useRef(null)
  const profilRef    = useRef(null)

  // ── Dark mode ──────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  // ── Kritik stok yükle + pencere odaklanınca yenile ────────────────────────
  const kritikYukle = useCallback(() => {
    axios.get(`${API}/urunler/kritik`).then(r => setKritikUrunler(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    kritikYukle()
    window.addEventListener("focus", kritikYukle)
    return () => window.removeEventListener("focus", kritikYukle)
  }, [kritikYukle])

  // ── Arama ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (arama.length < 2) { setAramaSonuclari([]); return }
    axios.get(`${API}/urunler/`).then(r => {
      const q = arama.toLowerCase()
      setAramaSonuclari(
        r.data.filter(u =>
          u.urun_adi?.toLowerCase().includes(q) ||
          u.kategori?.toLowerCase().includes(q)   // null-safe
        ).slice(0, 6)
      )
    }).catch(() => {})
  }, [arama])

  // ── Tek click-outside handler — tüm menüler ───────────────────────────────
  useEffect(() => {
    function dışarı(e) {
      if (analitikRef.current && !analitikRef.current.contains(e.target))  setAnalitikMenu(false)
      if (dilRef.current       && !dilRef.current.contains(e.target))       setDilMenu(false)
      if (bildirimRef.current  && !bildirimRef.current.contains(e.target))  setBildirimMenu(false)
      if (profilRef.current    && !profilRef.current.contains(e.target))    setProfilMenu(false)
    }
    document.addEventListener("mousedown", dışarı)
    return () => document.removeEventListener("mousedown", dışarı)
  }, [])

  const t = çeviriler[dil]
  const analitikAktif = location.pathname.startsWith("/analitik")

  const analitikAltSayfalar = [
    { path: "/analitik/tahmin", label: t.tahmin, icon: <TrendingUp size={16} />,   aciklama: "Regresyon ile gelecek talep tahmini", renk: "blue"   },
    { path: "/analitik/eoq",    label: t.eoq,    icon: <TrendingDown size={16} />, aciklama: "Optimal sipariş miktarı hesaplama",    renk: "purple" },
    { path: "/analitik/stok",   label: t.stok,   icon: <FileText size={16} />,     aciklama: "ABC analizi, kategori dağılımı ve raporlar", renk: "green" },
  ]

  const renkMap = {
    blue:   "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    green:  "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  }

  return (
    <nav className="h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-8 py-0 flex items-center justify-between shadow-sm sticky top-0 z-50 gap-6">

      {/* Logo */}
      <div className="flex items-center gap-3 py-4 shrink-0 group cursor-pointer" onClick={() => navigate("/")}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3">
          <BarChart2 size={16} className="text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
          Smart<span className="text-blue-600">Stock</span>
        </span>
        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">AI</span>
      </div>

      {/* Navigasyon */}
      <div className="flex items-center h-full shrink-0">

        <Link to="/"
          className={`flex items-center gap-2 px-4 py-5 text-sm font-medium transition-all duration-200 border-b-2 hover:scale-105
            ${location.pathname === "/" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300"}`}>
          <BarChart2 size={16} />{t.dashboard}
        </Link>

        <Link to="/urunler"
          className={`flex items-center gap-2 px-4 py-5 text-sm font-medium transition-all duration-200 border-b-2 hover:scale-105
            ${location.pathname === "/urunler" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300"}`}>
          <Package size={16} />{t.urunler}
        </Link>

        {/* Analitik Dropdown */}
        <div className="relative" ref={analitikRef}>
          <button onClick={() => setAnalitikMenu(v => !v)}
            className={`flex items-center gap-2 px-4 py-5 text-sm font-medium transition-all duration-200 border-b-2 hover:scale-105
              ${analitikAktif ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300"}`}>
            <TrendingUp size={16} />
            {t.analitik}
            <ChevronDown size={14} className={`transition-transform duration-200 ${analitikMenu ? "rotate-180" : ""}`} />
          </button>

          {analitikMenu && (
            <div className="absolute top-full left-0 mt-0 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Analitik Modülleri</p>
              </div>
              {analitikAltSayfalar.map(sayfa => (
                <Link key={sayfa.path} to={sayfa.path} onClick={() => setAnalitikMenu(false)}
                  className={`flex items-start gap-3 px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 border-b last:border-0 border-gray-100 dark:border-gray-700 group
                    ${location.pathname === sayfa.path ? "bg-gray-50 dark:bg-gray-700" : ""}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110 ${renkMap[sayfa.renk]}`}>
                    {sayfa.icon}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold transition-colors ${location.pathname === sayfa.path ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}>
                      {sayfa.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{sayfa.aciklama}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link to="/hareketler"
          className={`flex items-center gap-2 px-4 py-5 text-sm font-medium transition-all duration-200 border-b-2 hover:scale-105
            ${location.pathname === "/hareketler" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300"}`}>
          <ArrowLeftRight size={16} />{t.hareketler}
        </Link>
      </div>

      {/* Arama */}
      <div className="relative flex-1 max-w-sm">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200
          ${aramaFocus ? "border-blue-500 shadow-md shadow-blue-100 dark:shadow-blue-900" : "border-gray-200 dark:border-gray-700"}
          bg-gray-50 dark:bg-gray-800`}>
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={arama}
            onChange={e => setArama(e.target.value)}
            onFocus={() => setAramaFocus(true)}
            onBlur={() => setTimeout(() => setAramaFocus(false), 250)}
            placeholder="Ürün ara..."
            className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full" />
          {arama && (
            <button onClick={() => { setArama(""); setAramaSonuclari([]) }}>
              <X size={14} className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {aramaSonuclari.length > 0 && aramaFocus && (
          <div className="absolute top-12 left-0 w-[480px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50">

            {/* Başlık */}
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {aramaSonuclari.length} ürün bulundu
              </p>
              <p className="text-xs text-gray-400">Analitik için ikona tıkla</p>
            </div>

            {aramaSonuclari.map(urun => {
              const kritik = (urun.mevcut_stok ?? 0) <= (urun.min_stok_seviyesi ?? 0)
              return (
                <div key={urun.urun_id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b last:border-0 border-gray-100 dark:border-gray-700 group transition-colors">

                  {/* Ürün bilgisi — tıklayınca Ürünler'de bu ürünü bul */}
                  <div className="flex-1 min-w-0 cursor-pointer"
                    onMouseDown={() => { setArama(""); setAramaSonuclari([]); navigate(`/urunler?urun_id=${urun.urun_id}`) }}>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {urun.urun_adi}
                    </p>
                    <p className="text-xs text-gray-400">{urun.kategori || "—"}</p>
                  </div>

                  {/* Stok durumu */}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0
                    ${kritik
                      ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                      : "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"}`}>
                    {urun.mevcut_stok ?? 0} {urun.birim}
                  </span>

                  {/* Analitik kısayolları */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      title="Talep Tahmini aç"
                      onMouseDown={() => {
                        setArama(""); setAramaSonuclari([])
                        navigate(`/analitik/tahmin?urun_id=${urun.urun_id}`)
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                                 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 dark:text-blue-400
                                 transition-all hover:scale-105 active:scale-95">
                      <TrendingUp size={12} />
                      Tahmin
                    </button>
                    <button
                      title="EOQ Hesaplama aç"
                      onMouseDown={() => {
                        setArama(""); setAramaSonuclari([])
                        navigate(`/analitik/eoq?urun_id=${urun.urun_id}`)
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                                 bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:hover:bg-purple-800/40 dark:text-purple-400
                                 transition-all hover:scale-105 active:scale-95">
                      <Calculator size={12} />
                      EOQ
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sağ Araçlar */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Dil */}
        <div className="relative" ref={dilRef}>
          <button onClick={() => { setDilMenu(v => !v); setBildirimMenu(false); setProfilMenu(false) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-105">
            <Globe size={15} />
            <span className="uppercase font-medium text-xs">{dil}</span>
          </button>
          {dilMenu && (
            <div className="absolute right-0 top-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden w-36 z-50">
              {[{ kod: "tr", ad: "🇹🇷 Türkçe" }, { kod: "en", ad: "🇬🇧 English" }, { kod: "de", ad: "🇩🇪 Deutsch" }].map(d => (
                <button key={d.kod} onClick={() => { setDil(d.kod); setDilMenu(false) }}
                  className={`w-full text-left px-4 py-3 text-sm transition-all ${dil === d.kod ? "bg-blue-50 dark:bg-blue-900 text-blue-600 font-medium" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
                  {d.ad}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bildirim */}
        <div className="relative" ref={bildirimRef}>
          <button onClick={() => { setBildirimMenu(v => !v); setDilMenu(false); setProfilMenu(false) }}
            className="relative p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110">
            <Bell size={18} />
            {kritikUrunler.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                {kritikUrunler.length > 9 ? "9+" : kritikUrunler.length}
              </span>
            )}
          </button>

          {bildirimMenu && (
            <div className="absolute right-0 top-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl w-80 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  <p className="font-semibold text-gray-800 dark:text-white text-sm">Kritik Stok Uyarıları</p>
                </div>
                <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">
                  {kritikUrunler.length} ürün
                </span>
              </div>

              {kritikUrunler.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  Kritik stok uyarısı yok
                </div>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                    {kritikUrunler.slice(0, 8).map(urun => (
                      <div key={urun.urun_id}
                        className="flex justify-between items-center px-4 py-3 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{urun.urun_adi}</p>
                          <p className="text-xs text-gray-400">{urun.kategori || "—"}</p>
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          <p className="text-sm font-bold text-red-500">
                            {urun.mevcut_stok ?? 0} <span className="text-xs font-normal">{urun.birim}</span>
                          </p>
                          <p className="text-xs text-gray-400">min: {urun.min_stok_seviyesi ?? 0}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => { setBildirimMenu(false); navigate("/urunler") }}
                      className="w-full text-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors py-1">
                      Tümünü Ürünler sayfasında gör →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tema */}
        <button onClick={() => setDark(v => !v)}
          className={`relative w-14 h-7 rounded-full transition-all duration-300 hover:scale-105 ${dark ? "bg-blue-600" : "bg-gray-200"}`}>
          <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm flex items-center justify-center transition-all duration-300 ${dark ? "left-8" : "left-1"}`}>
            {dark ? <Moon size={11} className="text-blue-600" /> : <Sun size={11} className="text-yellow-500" />}
          </div>
        </button>

        {/* Avatar */}
        <div className="relative" ref={profilRef}>
          <button onClick={() => { setProfilMenu(v => !v); setDilMenu(false); setBildirimMenu(false) }}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm hover:scale-110 transition-all duration-200 shadow-md">
            {kullanici?.initials || "?"}
          </button>
          {profilMenu && (
            <div className="absolute right-0 top-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl w-52 z-50 overflow-hidden">
              <div className="px-4 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {kullanici?.initials || "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-white text-sm truncate">{kullanici?.ad || "Kullanıcı"}</p>
                  <p className="text-xs text-gray-400 truncate">{kullanici?.rol || ""}</p>
                </div>
              </div>
              <div className="py-1">
                {[
                  { icon: <User size={14} />,     label: "Profil",   action: () => setProfilMenu(false) },
                  { icon: <Settings size={14} />,  label: "Ayarlar",  action: () => setProfilMenu(false) },
                ].map(item => (
                  <button key={item.label} onClick={item.action}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    {item.icon}{item.label}
                  </button>
                ))}
                <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                <button onClick={() => { setProfilMenu(false); cikisYap() }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                  <LogOut size={14} />Çıkış Yap
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </nav>
  )
}
