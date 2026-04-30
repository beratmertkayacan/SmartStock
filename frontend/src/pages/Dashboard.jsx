import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import {
    ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts"
import {
    Package, AlertTriangle, DollarSign, TrendingUp,
    ArrowLeftRight, ArrowDownCircle, ArrowUpCircle,
    ChevronRight, Zap, BarChart2, Calculator, RefreshCw
} from "lucide-react"

const API = "http://127.0.0.1:8000"

const AY_KISA = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"]

function selamlama() {
    const saat = new Date().getHours()
    if (saat < 12) return "Günaydın"
    if (saat < 18) return "İyi günler"
    return "İyi akşamlar"
}

function bugunTarih() {
    const d = new Date()
    const gunler = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"]
    return `${gunler[d.getDay()]}, ${d.getDate()} ${AY_KISA[d.getMonth()]} ${d.getFullYear()}`
}

function fmtPara(v) {
    if (!v && v !== 0) return "—"
    const abs  = Math.abs(v)
    const sign = v < 0 ? "-" : ""
    if (abs >= 1_000_000) return `${sign}₺${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000)     return `${sign}₺${(abs / 1_000).toFixed(0)}B`
    return `${sign}₺${Math.round(abs).toLocaleString("tr-TR")}`
}

function GrafikTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    const alim  = payload.find(p => p.dataKey === "Alım")?.value  || 0
    const satis = payload.find(p => p.dataKey === "Satış")?.value || 0
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 px-4 py-3 text-sm min-w-[160px]">
            <p className="font-bold text-gray-700 dark:text-gray-100 mb-2 pb-1.5 border-b border-gray-100 dark:border-gray-700">{label}</p>
            <div className="space-y-1.5">
                <div className="flex justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-gray-500"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />Alım</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">{fmtPara(alim)}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-gray-500"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" />Satış</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">{fmtPara(satis)}</span>
                </div>
            </div>
        </div>
    )
}

const KATEGORİ_RENKLER = [
    "#185FA5","#534AB7","#0F6E56","#BA7517","#993C1D","#993556"
]

export default function Dashboard() {
    const [veri, setVeri]           = useState(null)
    const [kritik, setKritik]       = useState([])
    const [yukleniyor, setYukleniyor] = useState(true)
    const navigate = useNavigate()

    const kullanici = (() => {
        try { return JSON.parse(localStorage.getItem("smartstock_user")) } catch { return null }
    })()

    useEffect(() => {
        Promise.allSettled([
            axios.get(`${API}/analitik/dashboard`),
            axios.get(`${API}/urunler/kritik`),
        ]).then(([dashRes, kritikRes]) => {
            if (dashRes.status === "fulfilled") setVeri(dashRes.value.data)
            if (kritikRes.status === "fulfilled") setKritik(kritikRes.value.data)
            setYukleniyor(false)
        })
    }, [])

    if (yukleniyor) return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Dashboard yükleniyor...</p>
            </div>
        </div>
    )

    if (!veri) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle size={26} className="text-red-400" />
            </div>
            <div className="text-center">
                <p className="text-gray-700 dark:text-gray-200 font-semibold">Sunucuya bağlanılamadı</p>
                <p className="text-sm text-gray-400 mt-1">Backend servisi çalışmıyor olabilir.</p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">uvicorn app.main:app --reload</p>
            </div>
            <button onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200 transition-all active:scale-95">
                Tekrar Dene
            </button>
        </div>
    )

    const maxKat = veri.kategori_dagilimi[0]?.stok_degeri || 1

    return (
        <div className="space-y-6">

            {/* ── Hoşgeldin Şeridi ────────────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm px-8 py-6 flex items-center justify-between">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-900/50 shrink-0">
                        <BarChart2 size={26} className="text-white" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 font-medium mb-0.5">{bugunTarih()}</p>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {selamlama()}, {kullanici?.ad?.split(" ")[0] || "Mert"} 👋
                        </h1>
                        <p className="text-sm text-gray-400 mt-0.5">
                            Genel Bakış — İşte bugünün envanter özeti.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => navigate("/hareketler")}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                        <ArrowLeftRight size={15} /> Hareket Ekle
                    </button>
                    <button onClick={() => navigate("/urunler")}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200 dark:shadow-blue-900/50 transition-all">
                        <Package size={15} /> Ürün Ekle
                    </button>
                </div>
            </div>

            {/* ── 5 KPI Kartı ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-5 gap-4">

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Toplam Ürün</p>
                        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <Package size={15} className="text-blue-600" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {veri.toplam_urun.toLocaleString("tr-TR")}
                    </p>
                    <p className="text-xs text-gray-400 mt-1.5">
                        {veri.kategori_dagilimi.length} kategori
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"
                     style={{ borderLeftWidth: veri.kritik_stok_sayisi > 0 ? 3 : undefined, borderLeftColor: veri.kritik_stok_sayisi > 0 ? "#ef4444" : undefined }}>
                    <div className="flex items-center justify-between mb-3">
                        <p className={`text-xs font-semibold uppercase tracking-wider ${veri.kritik_stok_sayisi > 0 ? "text-red-400" : "text-gray-400"}`}>
                            Kritik Stok
                        </p>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${veri.kritik_stok_sayisi > 0 ? "bg-red-50 dark:bg-red-900/30" : "bg-gray-50 dark:bg-gray-700"}`}>
                            <AlertTriangle size={15} className={veri.kritik_stok_sayisi > 0 ? "text-red-500" : "text-gray-400"} />
                        </div>
                    </div>
                    <p className={`text-3xl font-bold ${veri.kritik_stok_sayisi > 0 ? "text-red-500" : "text-gray-900 dark:text-white"}`}>
                        {veri.kritik_stok_sayisi}
                    </p>
                    <button onClick={() => navigate("/urunler")}
                        className={`text-xs mt-1.5 ${veri.kritik_stok_sayisi > 0 ? "text-red-400 hover:text-red-600" : "text-gray-400"} transition-colors`}>
                        {veri.kritik_stok_sayisi > 0 ? "Ürünleri gör →" : "Sorun yok"}
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stok Değeri</p>
                        <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                            <DollarSign size={15} className="text-emerald-600" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {fmtPara(veri.toplam_stok_degeri_tl)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1.5">maliyet fiyatı bazlı</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Bugün</p>
                        <div className="w-8 h-8 bg-violet-50 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                            <ArrowLeftRight size={15} className="text-violet-600" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {veri.bugun_toplam}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <ArrowDownCircle size={11} />{veri.bugun_giris} giriş
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 font-medium">
                            <ArrowUpCircle size={11} />{veri.bugun_cikis} çıkış
                        </span>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ort. Marj</p>
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                            <TrendingUp size={15} className="text-orange-500" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        %{veri.ortalama_kar_marji}
                    </p>
                    <p className="text-xs text-gray-400 mt-1.5">{veri.toplam_urun} ürün üzerinden</p>
                </div>
            </div>

            {/* ── Orta: Grafik + Kategoriler ──────────────────────────────── */}
            <div className="grid grid-cols-5 gap-5">

                {/* Grafik — 3 kolon */}
                <div className="col-span-3 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Son 30 Gün — Alım / Satış</h2>
                            <p className="text-xs text-gray-400 mt-0.5">günlük · tutar bazlı (₺)</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />Alım
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />Satış
                            </span>
                        </div>
                    </div>

                    <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={veri.son_30_gun_grafik} barGap={2}
                            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="dashGradAlim" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.7} />
                                </linearGradient>
                                <linearGradient id="dashGradSatis" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fb923c" stopOpacity={0.9} />
                                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.7} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: "#9ca3af" }}
                                axisLine={false} tickLine={false}
                                interval={4} />
                            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                                tickFormatter={v => v === 0 ? "0" : v >= 1000 ? `₺${(v/1000).toFixed(0)}B` : `₺${v}`}
                                width={48} />
                            <Tooltip content={<GrafikTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                            <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
                            <Bar dataKey="Alım"  fill="url(#dashGradAlim)"  radius={[3,3,0,0]} maxBarSize={10} />
                            <Bar dataKey="Satış" fill="url(#dashGradSatis)" radius={[3,3,0,0]} maxBarSize={10} />
                        </ComposedChart>
                    </ResponsiveContainer>

                    {/* Ay özeti */}
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Bu Ay Alım</p>
                            <p className="text-base font-bold text-gray-800 dark:text-gray-200">{fmtPara(veri.bu_ay_alim)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Bu Ay Satış</p>
                            <p className="text-base font-bold text-gray-800 dark:text-gray-200">{fmtPara(veri.bu_ay_satis)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Tahmini Kâr</p>
                            <p className={`text-base font-bold ${veri.bu_ay_kar >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                                {veri.bu_ay_kar >= 0 ? "+" : ""}{fmtPara(veri.bu_ay_kar)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Kategori Dağılımı — 2 kolon */}
                <div className="col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Kategori Dağılımı</h2>
                            <p className="text-xs text-gray-400 mt-0.5">stok değerine göre</p>
                        </div>
                        <button onClick={() => navigate("/urunler")}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1">
                            Tümü <ChevronRight size={12} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        {veri.kategori_dagilimi.map((kat, i) => (
                            <div key={kat.kategori}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[160px]">
                                        {kat.kategori}
                                    </span>
                                    <div className="text-right shrink-0 ml-2">
                                        <span className="text-xs text-gray-400">{kat.urun_sayisi} ürün</span>
                                        <span className="text-xs text-gray-300 dark:text-gray-600 mx-1">·</span>
                                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{fmtPara(kat.stok_degeri)}</span>
                                    </div>
                                </div>
                                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700"
                                         style={{
                                             width: `${kat.yuzde}%`,
                                             backgroundColor: KATEGORİ_RENKLER[i % KATEGORİ_RENKLER.length]
                                         }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Alt: Kritik Stok + Son Hareketler + Hızlı İşlemler ─────── */}
            <div className="grid grid-cols-3 gap-5">

                {/* Kritik Stok */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Kritik Stok</h2>
                        {kritik.length > 0 && (
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                {kritik.length} ürün
                            </span>
                        )}
                    </div>
                    <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700">
                        {kritik.length === 0 && (
                            <p className="text-sm text-gray-400 py-4 text-center">Kritik stok uyarısı yok</p>
                        )}
                        {kritik.slice(0, 5).map(u => (
                            <div key={u.urun_id} className="flex items-center justify-between py-2.5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{u.urun_adi}</p>
                                    <p className="text-xs text-gray-400">{u.kategori || "—"}</p>
                                </div>
                                <div className="text-right ml-3 shrink-0">
                                    <p className="text-sm font-bold text-red-500">
                                        {u.mevcut_stok ?? 0} <span className="text-xs font-normal">{u.birim}</span>
                                    </p>
                                    <p className="text-xs text-gray-400">min: {u.min_stok_seviyesi ?? 0}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {kritik.length > 0 && (
                        <button onClick={() => navigate("/urunler")}
                            className="w-full mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors text-center">
                            Tümünü Ürünler'de gör →
                        </button>
                    )}
                </div>

                {/* Son Hareketler */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Son Hareketler</h2>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            son 8
                        </span>
                    </div>
                    <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700">
                        {veri.son_hareketler.length === 0 && (
                            <p className="text-sm text-gray-400 py-4 text-center">Henüz hareket yok</p>
                        )}
                        {veri.son_hareketler.map(h => (
                            <div key={h.hareket_id} className="flex items-center justify-between py-2.5 gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{h.urun_adi}</p>
                                    <p className="text-xs text-gray-400 truncate">
                                        {h.tedarikci_musteri || h.kategori || "—"}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                                        ${h.hareket_tipi === "giris"
                                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                            : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"}`}>
                                        {h.hareket_tipi === "giris" ? "Giriş" : "Çıkış"}
                                    </span>
                                    <span className="text-xs text-gray-400">{h.tarih}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => navigate("/hareketler")}
                        className="w-full mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors text-center">
                        Tümünü Hareketler'de gör →
                    </button>
                </div>

                {/* Hızlı İşlemler */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Hızlı İşlemler</h2>
                    <div className="space-y-2.5">
                        {[
                            {
                                label: "Hareket Ekle",
                                desc:  "Stok giriş veya çıkışı kaydet",
                                icon:  <ArrowLeftRight size={16} />,
                                bg:    "bg-blue-50 dark:bg-blue-900/30",
                                renk:  "text-blue-600 dark:text-blue-400",
                                path:  "/hareketler",
                            },
                            {
                                label: "Ürün Ekle",
                                desc:  "Kataloğa yeni ürün tanımla",
                                icon:  <Package size={16} />,
                                bg:    "bg-emerald-50 dark:bg-emerald-900/30",
                                renk:  "text-emerald-600 dark:text-emerald-400",
                                path:  "/urunler",
                            },
                            {
                                label: "Talep Tahmini",
                                desc:  "ML ile gelecek stok tahmini yap",
                                icon:  <Zap size={16} />,
                                bg:    "bg-violet-50 dark:bg-violet-900/30",
                                renk:  "text-violet-600 dark:text-violet-400",
                                path:  "/analitik/tahmin",
                            },
                            {
                                label: "EOQ Hesaplama",
                                desc:  "Optimal sipariş miktarı bul",
                                icon:  <Calculator size={16} />,
                                bg:    "bg-amber-50 dark:bg-amber-900/30",
                                renk:  "text-amber-600 dark:text-amber-400",
                                path:  "/analitik/eoq",
                            },
                            {
                                label: "Stok & Raporlar",
                                desc:  "ABC analizi ve stok raporları",
                                icon:  <BarChart2 size={16} />,
                                bg:    "bg-orange-50 dark:bg-orange-900/30",
                                renk:  "text-orange-600 dark:text-orange-400",
                                path:  "/analitik/stok",
                            },
                        ].map(item => (
                            <button key={item.label} onClick={() => navigate(item.path)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all group text-left border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                                <div className={`w-9 h-9 rounded-xl ${item.bg} ${item.renk} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                                    {item.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.label}</p>
                                    <p className="text-xs text-gray-400 truncate">{item.desc}</p>
                                </div>
                                <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 shrink-0 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    )
}
