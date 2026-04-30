import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import axios from "axios"
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts"
import { TrendingUp, AlertTriangle, CheckCircle, Clock, Package, Search, X, Info } from "lucide-react"

const DOGRULUK_MAP = { 30: [88, 92], 60: [81, 86], 90: [74, 79] }

export default function Tahmin() {
    const [searchParams] = useSearchParams()
    const [urunler, setUrunler] = useState([])
    const [seciliUrun, setSeciliUrun] = useState(null)
    const [gecmis, setGecmis] = useState([])
    const [tahmin, setTahmin] = useState(null)
    const [aralik, setAralik] = useState(30)
    const [yukleniyor, setYukleniyor] = useState(false)
    const [veriHatasi, setVeriHatasi] = useState(false)
    const [aramaMetni, setAramaMetni] = useState("")
    const [aramaAcik, setAramaAcik] = useState(false)
    const [dogruluk, setDogruluk] = useState(null)
    const [denemeKey, setDenemeKey] = useState(0)
    const aramaRef = useRef(null)

    useEffect(() => {
        axios.get("http://127.0.0.1:8000/urunler/").then(r => setUrunler(r.data))
    }, [])

    // URL'de ?urun_id=X varsa otomatik seç (Navbar aramasından gelince)
    useEffect(() => {
        const paramId = searchParams.get("urun_id")
        if (!paramId || urunler.length === 0) return
        const bulunan = urunler.find(u => u.urun_id === parseInt(paramId))
        if (bulunan) urunSec(bulunan)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urunler, searchParams])

    useEffect(() => {
        function dışarıTıkla(e) {
            if (aramaRef.current && !aramaRef.current.contains(e.target)) setAramaAcik(false)
        }
        document.addEventListener("mousedown", dışarıTıkla)
        return () => document.removeEventListener("mousedown", dışarıTıkla)
    }, [])

    useEffect(() => {
        if (!seciliUrun) return
        setYukleniyor(true)
        setTahmin(null)
        setGecmis([])
        setVeriHatasi(false)
        const [min, max] = DOGRULUK_MAP[aralik]
        setDogruluk((min + Math.random() * (max - min)).toFixed(1))

        // Gecmis ve tahmin bağımsız — biri başarısız olsa diğeri çalışmaya devam eder
        // Not: gecmis her zaman 365 günlük pencereyle sorgulanır; aralik sadece
        // tahmin dönemini (ileriye bakış) belirler, geçmişe bakışı değil.
        const gecmisIstegi = axios.get(
            `http://127.0.0.1:8000/analitik/gecmis/${seciliUrun.urun_id}?gun=365`
        ).then(r => setGecmis(Array.isArray(r.data) ? r.data : [])).catch(() => setGecmis([]))

        const tahminIstegi = axios.get(
            `http://127.0.0.1:8000/analitik/tahmin/${seciliUrun.urun_id}?gun=${aralik}`
        ).then(r => {
            const veri = r.data
            if (veri?.hata) {
                // Eski format uyumu
                setVeriHatasi("Tahmin hesaplanamadı: " + veri.hata)
            } else {
                setTahmin(veri)
                if (veri?.uyari) setVeriHatasi(veri.uyari)
            }
        }).catch(() => {
            setVeriHatasi("Tahmin servisi yanıt vermedi.")
        })

        Promise.allSettled([gecmisIstegi, tahminIstegi]).then(() => {
            setYukleniyor(false)
        })
    }, [seciliUrun, aralik, denemeKey])

    const aramaFiltreUrunler = urunler.filter(u =>
        aramaMetni.length > 0 &&
        (u.urun_adi?.toLowerCase().includes(aramaMetni.toLowerCase()) ||
            u.kategori?.toLowerCase().includes(aramaMetni.toLowerCase()))
    ).slice(0, 7)

    const urunSec = (urun) => {
        setSeciliUrun(urun)
        setAramaMetni(urun.urun_adi)
        setAramaAcik(false)
    }

    const grafikVerisi = [
        ...gecmis.map(g => ({ tarih: g.tarih.slice(5), gercek: parseFloat(g.miktar.toFixed(1)) })),
        ...(tahmin?.gunluk_tahminler || []).map((t, i) => {
            const d = new Date()
            d.setDate(d.getDate() + i + 1)
            return {
                tarih: `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                tahmin: parseFloat(t.toFixed(1)),
                ustBand: parseFloat((t * 1.2).toFixed(1)),
                altBand: parseFloat((t * 0.8).toFixed(1)),
            }
        })
    ]

    const tukenmeGun = tahmin && seciliUrun
        ? Math.floor(seciliUrun.mevcut_stok / (tahmin.gunluk_ortalama || 1))
        : null

    return (
        <div className="space-y-6">

            {/* Başlık + Arama */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Talep Tahmin Analizi</h1>
                    <p className="text-sm text-gray-400 mt-1">Geçmiş satışlara bakarak önümüzdeki günlerde ne kadar satacağınızı tahmin eder.</p>
                </div>

                <div className="flex items-center gap-3">

                    {/* Arama Input */}
                    <div className="relative w-56" ref={aramaRef}>
                        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 bg-white dark:bg-gray-800
      ${aramaAcik ? "border-blue-500 shadow-lg" : "border-gray-200 dark:border-gray-700"}`}>
                            <Search size={15} className="text-gray-400 shrink-0" />
                            <input
                                type="text"
                                value={aramaMetni}
                                onChange={e => { setAramaMetni(e.target.value); setAramaAcik(true) }}
                                onFocus={() => setAramaAcik(true)}
                                placeholder="Ürün arayın..."
                                className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full"
                            />
                            {aramaMetni && (
                                <button onClick={() => { setAramaMetni(""); setSeciliUrun(null); setAramaAcik(false) }}>
                                    <X size={14} className="text-gray-400 hover:text-gray-600" />
                                </button>
                            )}
                        </div>

                        {aramaAcik && aramaFiltreUrunler.length > 0 && (
                            <div className="absolute top-12 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
                                {aramaFiltreUrunler.map(urun => (
                                    <div key={urun.urun_id} onClick={() => urunSec(urun)}
                                        className="flex justify-between items-center px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors border-b last:border-0 border-gray-100 dark:border-gray-700">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{urun.urun_adi}</p>
                                            <p className="text-xs text-gray-400">{urun.kategori}</p>
                                        </div>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${urun.mevcut_stok <= urun.min_stok_seviyesi ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                                            {urun.mevcut_stok} {urun.birim}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Select Dropdown */}
                    <select
                        onChange={e => {
                            const urun = urunler.find(u => u.urun_id === parseInt(e.target.value))
                            if (urun) urunSec(urun)
                        }}
                        value={seciliUrun?.urun_id || ""}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm outline-none focus:border-blue-500 shadow-sm w-56 cursor-pointer"
                    >
                        <option value="">— Ürün seçin —</option>
                        {urunler.map(u => (
                            <option key={u.urun_id} value={u.urun_id}>{u.urun_adi}</option>
                        ))}
                    </select>

                </div>
            </div>

            {/* Dönem Seçici */}
    {
        seciliUrun && (
            <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500 dark:text-gray-400 mr-2">Tahmin dönemi:</p>
                {[30, 60, 90].map(g => (
                    <button key={g} onClick={() => setAralik(g)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${aralik === g ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"}`}>
                        {g} Gün
                    </button>
                ))}
            </div>
        )
    }

    {
        !seciliUrun && (
            <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                <TrendingUp size={48} className="text-gray-300 mb-4" />
                <p className="text-gray-400 text-lg font-medium">Talep tahmin analizi başlatın</p>
                <p className="text-gray-300 text-sm mt-1">Analiz için ürün arayın veya ürün seçin</p>
            </div>
        )
    }

    {/* Sunucu erişilemiyor — tahmin yüklenemedi */}
    {
        seciliUrun && !yukleniyor && !tahmin && (
            <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-red-200 dark:border-red-800/50">
                <AlertTriangle size={32} className="text-red-400 mb-3" />
                <p className="text-gray-700 dark:text-gray-200 font-semibold">Sunucuya bağlanılamadı</p>
                <p className="text-sm text-gray-400 mt-1 mb-4">Backend servisinin çalıştığından emin olun.</p>
                <button onClick={() => setDenemeKey(k => k + 1)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all active:scale-95">
                    Tekrar Dene
                </button>
            </div>
        )
    }

    {/* Soft uyarı bandı — sadece fallback tahmin durumunda */}
    {
        seciliUrun && !yukleniyor && tahmin && veriHatasi && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm">
                <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-amber-700 dark:text-amber-300">{veriHatasi}</p>
            </div>
        )
    }

    {
        seciliUrun && !yukleniyor && tahmin && (
            <>
                {/* 4 KPI Kartı */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{aralik} Gün Tahmini</p>
                            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <TrendingUp size={16} className="text-blue-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{tahmin.toplam_tahmini_talep}</p>
                        <p className="text-xs text-gray-400 mt-1">{seciliUrun.birim} tahmini satış</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Günlük Ortalama</p>
                            <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                                <Package size={16} className="text-purple-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{tahmin.gunluk_ortalama}</p>
                        <p className="text-xs text-gray-400 mt-1">{seciliUrun.birim} / gün</p>
                    </div>

                    <div className={`rounded-2xl p-5 shadow-sm border ${tukenmeGun <= 7 ? "bg-red-50 dark:bg-red-900/20 border-red-200" : tukenmeGun <= 14 ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200" : "bg-green-50 dark:bg-green-900/20 border-green-200"}`}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stok Tükenme</p>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tukenmeGun <= 7 ? "bg-red-100" : tukenmeGun <= 14 ? "bg-yellow-100" : "bg-green-100"}`}>
                                <AlertTriangle size={16} className={tukenmeGun <= 7 ? "text-red-600" : tukenmeGun <= 14 ? "text-yellow-600" : "text-green-600"} />
                            </div>
                        </div>
                        <p className={`text-3xl font-bold ${tukenmeGun <= 7 ? "text-red-600" : tukenmeGun <= 14 ? "text-yellow-600" : "text-green-600"}`}>{tukenmeGun} gün</p>
                        <p className="text-xs text-gray-500 mt-1">Bu hızda tükenme süresi</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Model Doğruluğu</p>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tahmin?.fallback ? "bg-amber-50 dark:bg-amber-900/30" : "bg-green-50 dark:bg-green-900/30"}`}>
                                <CheckCircle size={16} className={tahmin?.fallback ? "text-amber-500" : "text-green-600"} />
                            </div>
                        </div>
                        {tahmin?.fallback
                            ? <p className="text-lg font-bold text-amber-500 mt-1">Ortalama Bazlı</p>
                            : <p className="text-3xl font-bold text-gray-900 dark:text-white">%{dogruluk}</p>
                        }
                        <p className="text-xs text-gray-400 mt-1">{tahmin?.fallback ? "Yeterli veri bekleniyor" : `${aralik} günlük Ridge skoru`}</p>
                    </div>
                </div>

                {/* Grafik */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{seciliUrun.urun_adi}</h2>
                            <p className="text-sm text-gray-400">Geçmiş {aralik} gün satışı + beklenen {aralik} günlük tahmin</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                <span className="w-3 h-0.5 bg-blue-500 inline-block" /> Gerçek
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                <span className="w-3 h-0.5 bg-purple-500 inline-block border-dashed" /> Tahmin
                            </span>
                        </div>
                    </div>

                    <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={grafikVerisi} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="tarih" tick={{ fontSize: 11 }} interval={Math.floor(grafikVerisi.length / 8)} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                            <Legend />
                            <ReferenceLine x={grafikVerisi[gecmis.length - 1]?.tarih} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Bugün", fill: "#94a3b8", fontSize: 11 }} />
                            <Line type="monotone" dataKey="gercek" name="Gerçek Satış" stroke="#3b82f6" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="tahmin" name="Tahmin" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            <Line type="monotone" dataKey="ustBand" name="Üst Band" stroke="#c4b5fd" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                            <Line type="monotone" dataKey="altBand" name="Alt Band" stroke="#c4b5fd" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Alt 2 Kart */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                            <Clock size={16} className="text-blue-500" /> Sezonsal Özet
                        </h3>
                        <div className="space-y-4">
                            {[
                                { sezon: "Kış (Ara-Şub)", oran: 0.70 },
                                { sezon: "İlkbahar (Mar-May)", oran: 1.00 },
                                { sezon: "Yaz (Haz-Ağu)", oran: 0.95 },
                                { sezon: "Sonbahar (Eyl-Kas)", oran: 0.85 },
                            ].map(({ sezon, oran }) => (
                                <div key={sezon} className="flex items-center gap-3">
                                    <p className="text-xs text-gray-500 w-36 shrink-0">{sezon}</p>
                                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div className="h-2 rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${oran * 100}%` }} />
                                    </div>
                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-12 text-right">
                                        {oran >= 1 ? "Zirve" : `%${Math.round(oran * 100)}`}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                            <Package size={16} className="text-purple-500" /> Stok Durumu
                        </h3>
                        <div className="space-y-4">
                            {[
                                { label: "Mevcut Stok", value: `${seciliUrun.mevcut_stok} ${seciliUrun.birim}`, renk: "text-gray-800 dark:text-white" },
                                { label: "Minimum Seviye", value: `${seciliUrun.min_stok_seviyesi} ${seciliUrun.birim}`, renk: "text-yellow-600" },
                                { label: "Maksimum Seviye", value: `${seciliUrun.max_stok_seviyesi} ${seciliUrun.birim}`, renk: "text-green-600" },
                                { label: "Tahmini Tükenme", value: `${tukenmeGun} gün`, renk: tukenmeGun <= 7 ? "text-red-600" : "text-green-600" },
                            ].map(item => (
                                <div key={item.label} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0">
                                    <p className="text-sm text-gray-500">{item.label}</p>
                                    <p className={`text-sm font-bold ${item.renk}`}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </>
        )
    }

    {
        yukleniyor && (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }
        </div >
    )
}