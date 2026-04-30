import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
    BarChart2, Mail, Lock, Eye, EyeOff,
    TrendingUp, Package, ArrowLeftRight, Shield, CheckCircle2, AlertCircle
} from "lucide-react"

const KULLANICILAR = [
    {
        email:    "admin@smartstock.com",
        sifre:    "smartstock2024",
        ad:       "Berat Mert Kayacan",
        rol:      "Yönetici",
        initials: "BM",
    },
    {
        email:    "demo@smartstock.com",
        sifre:    "demo2024",
        ad:       "Demo Kullanıcı",
        rol:      "Görüntüleyici",
        initials: "DK",
    },
]

const OZELLIKLER = [
    { icon: <TrendingUp size={15} />,      label: "ML destekli talep tahmini" },
    { icon: <Package size={15} />,          label: "Çok kategorili ürün yönetimi" },
    { icon: <ArrowLeftRight size={15} />,   label: "Anlık stok giriş/çıkış takibi" },
    { icon: <Shield size={15} />,           label: "Kritik stok uyarı sistemi" },
]

export default function Login() {
    const navigate = useNavigate()

    const [email,       setEmail]       = useState("")
    const [sifre,       setSifre]       = useState("")
    const [goster,      setGoster]      = useState(false)
    const [hata,        setHata]        = useState("")
    const [yukleniyor,  setYukleniyor]  = useState(false)

    function girisYap(e) {
        e.preventDefault()
        if (!email.trim() || !sifre) { setHata("Lütfen tüm alanları doldurunuz."); return }
        setYukleniyor(true)
        setHata("")

        // Kısa gecikme ile "gerçek" login hissi ver
        setTimeout(() => {
            const kullanici = KULLANICILAR.find(
                k => k.email === email.trim().toLowerCase() && k.sifre === sifre
            )
            if (kullanici) {
                localStorage.setItem("smartstock_user", JSON.stringify({
                    ad:       kullanici.ad,
                    email:    kullanici.email,
                    rol:      kullanici.rol,
                    initials: kullanici.initials,
                }))
                navigate("/")
            } else {
                setHata("E-posta adresi veya şifre hatalı. Lütfen tekrar deneyin.")
                setYukleniyor(false)
            }
        }, 750)
    }

    function demoGiris(k) {
        setEmail(k.email)
        setSifre(k.sifre)
        setHata("")
    }

    return (
        <div className="min-h-screen flex bg-white">

            {/* ── Sol Panel — Branding ─────────────────────────────────────── */}
            <div className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12
                            bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 relative overflow-hidden">

                {/* Dekoratif daireler */}
                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute top-1/3 -left-16  w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -bottom-28 right-16 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute bottom-1/3 right-0  w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

                {/* Logo */}
                <div className="relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
                            <BarChart2 size={20} className="text-white" />
                        </div>
                        <div>
                            <span className="text-2xl font-bold text-white tracking-tight">
                                Smart<span className="text-blue-300">Stock</span>
                            </span>
                            <span className="ml-2 text-xs bg-white/20 text-white/90 px-2 py-0.5 rounded-full font-medium align-middle">
                                AI
                            </span>
                        </div>
                    </div>
                    <p className="text-blue-300 text-sm mt-2.5 font-medium">
                        Akıllı Stok &amp; Envanter Yönetimi
                    </p>
                </div>

                {/* Merkez içerik */}
                <div className="relative z-10 space-y-8">
                    <div>
                        <h2 className="text-4xl font-bold text-white leading-tight">
                            Stoğunuzu<br />
                            <span className="text-blue-300">akıllıca</span><br />
                            yönetin.
                        </h2>
                        <p className="text-blue-200/80 mt-4 text-sm leading-relaxed max-w-xs">
                            Gerçek zamanlı stok takibi, ML destekli talep tahmini ve EOQ hesaplamaları tek platformda.
                        </p>
                    </div>

                    {/* Özellik listesi */}
                    <div className="space-y-3">
                        {OZELLIKLER.map(item => (
                            <div key={item.label} className="flex items-center gap-3.5">
                                <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-blue-200 shrink-0">
                                    {item.icon}
                                </div>
                                <span className="text-sm text-blue-100">{item.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* İstatistik kartları */}
                    <div className="grid grid-cols-3 gap-3 pt-2">
                        {[
                            { sayi: "∞",  label: "Ürün" },
                            { sayi: "7/24", label: "Takip" },
                            { sayi: "AI",  label: "Tahmin" },
                        ].map(stat => (
                            <div key={stat.label} className="bg-white/10 border border-white/15 rounded-2xl p-3 text-center backdrop-blur-sm">
                                <p className="text-lg font-bold text-white">{stat.sayi}</p>
                                <p className="text-xs text-blue-300 mt-0.5">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Alt bilgi */}
                <div className="relative z-10 flex items-center gap-2.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-xs text-blue-300">Sistem aktif · SmartStock v1.0</span>
                </div>
            </div>

            {/* ── Sağ Panel — Form ─────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-gray-50">
                <div className="w-full max-w-md">

                    {/* Mobil logo */}
                    <div className="flex items-center gap-2.5 mb-10 lg:hidden">
                        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                            <BarChart2 size={17} className="text-white" />
                        </div>
                        <span className="text-xl font-bold text-gray-900 tracking-tight">
                            Smart<span className="text-blue-600">Stock</span>
                        </span>
                    </div>

                    {/* Başlık */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-gray-900">Tekrar hoşgeldiniz 👋</h1>
                        <p className="text-gray-500 text-sm mt-1.5">Devam etmek için hesabınıza giriş yapın</p>
                    </div>

                    <form onSubmit={girisYap} className="space-y-4">

                        {/* E-posta */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">E-posta adresi</label>
                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-white transition-all duration-200
                                ${hata
                                    ? "border-red-300 shadow-sm shadow-red-100"
                                    : "border-gray-200 focus-within:border-blue-500 focus-within:shadow-md focus-within:shadow-blue-100/60"
                                }`}>
                                <Mail size={15} className="text-gray-400 shrink-0" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setHata("") }}
                                    placeholder="ad@sirket.com"
                                    autoComplete="email"
                                    className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent" />
                            </div>
                        </div>

                        {/* Şifre */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Şifre</label>
                            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-white transition-all duration-200
                                ${hata
                                    ? "border-red-300 shadow-sm shadow-red-100"
                                    : "border-gray-200 focus-within:border-blue-500 focus-within:shadow-md focus-within:shadow-blue-100/60"
                                }`}>
                                <Lock size={15} className="text-gray-400 shrink-0" />
                                <input
                                    type={goster ? "text" : "password"}
                                    value={sifre}
                                    onChange={e => { setSifre(e.target.value); setHata("") }}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent" />
                                <button type="button" onClick={() => setGoster(v => !v)}
                                    tabIndex={-1}
                                    className="text-gray-400 hover:text-gray-600 transition-colors p-0.5">
                                    {goster ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {/* Hata mesajı */}
                        {hata && (
                            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                                <AlertCircle size={15} className="text-red-500 shrink-0" />
                                <p className="text-sm text-red-600">{hata}</p>
                            </div>
                        )}

                        {/* Giriş butonu */}
                        <button type="submit" disabled={yukleniyor}
                            className="w-full flex items-center justify-center gap-2.5 py-3.5 mt-2
                                       bg-blue-600 hover:bg-blue-700 active:scale-95
                                       disabled:opacity-60 disabled:cursor-not-allowed
                                       text-white font-semibold text-sm rounded-xl
                                       shadow-lg shadow-blue-200 transition-all duration-200">
                            {yukleniyor ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Giriş yapılıyor...
                                </>
                            ) : "Giriş Yap →"}
                        </button>
                    </form>

                    {/* Demo hesapları */}
                    <div className="mt-8 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                            <CheckCircle2 size={13} className="text-emerald-500" />
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Demo Hesapları</p>
                            <span className="ml-auto text-xs text-gray-400">tıkla → otomatik doldur</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {KULLANICILAR.map(k => (
                                <button key={k.email} type="button"
                                    onClick={() => demoGiris(k)}
                                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-blue-50 transition-colors group text-left">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                            {k.initials}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{k.ad}</p>
                                            <p className="text-xs text-gray-400">{k.rol}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-mono text-gray-400 group-hover:text-blue-600 transition-colors">{k.email}</p>
                                        <p className="text-xs font-mono text-gray-300">{k.sifre}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 text-center mt-6">
                        SmartStock · Berat Mert Kayacan tarafından geliştirilmiştir
                    </p>
                </div>
            </div>

        </div>
    )
}
