import { useState, useEffect } from "react"
import axios from "axios"
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts"
import { Package, AlertTriangle, TrendingUp, Download, ChevronUp, ChevronDown } from "lucide-react"

const KATEGORI_RENKLER = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#6366f1"]

function AbcRozeti({ sinif }) {
    const stil = { A: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400", B: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400", C: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" }
    return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${stil[sinif]}`}>{sinif}</span>
}

function abcHesapla(urunler) {
    const sirali = [...urunler]
        .map(u => ({ ...u, deger: (u.mevcut_stok || 0) * (u.maliyet_fiyati || 0) }))
        .sort((a, b) => b.deger - a.deger)
    const toplam = sirali.reduce((s, u) => s + u.deger, 0)
    let kumulatif = 0
    return sirali.map(u => {
        kumulatif += u.deger
        const oran = toplam > 0 ? (kumulatif / toplam) * 100 : 0
        return { ...u, sinif: oran <= 80 ? "A" : oran <= 95 ? "B" : "C", kumulatifYuzde: Math.round(oran * 10) / 10 }
    })
}

export default function StokRaporlar() {
    const [aktifTab, setAktifTab] = useState("abc")
    const [urunler, setUrunler] = useState([])
    const [kritikler, setKritikler] = useState([])
    const [dashboard, setDashboard] = useState(null)
    const [yukleniyor, setYukleniyor] = useState(true)
    const [siralamaAlan, setSiralamaAlan] = useState("deger")
    const [siralamaYon, setSiralamaYon] = useState("desc")
    const [abcFiltre, setAbcFiltre] = useState("Tümü")

    useEffect(() => {
        // Her endpoint'i bağımsız çek — biri hata verse diğerleri çalışsın
        const yukle = async () => {
            try {
                const ur = await axios.get("http://127.0.0.1:8000/urunler/")
                setUrunler(ur.data)
            } catch { /* ürünler yüklenemedi */ }

            try {
                const kr = await axios.get("http://127.0.0.1:8000/urunler/kritik")
                setKritikler(kr.data)
            } catch { /* kritikler yüklenemedi */ }

            try {
                const db = await axios.get("http://127.0.0.1:8000/analitik/dashboard")
                setDashboard(db.data)
            } catch { /* dashboard yüklenemedi — grafik kısmı gizlenir */ }

            setYukleniyor(false)
        }
        yukle()
    }, [])

    const abcUrunler = abcHesapla(urunler)
    const toplamDeger = abcUrunler.reduce((s, u) => s + u.deger, 0)

    const abcOzet = ["A", "B", "C"].map(sinif => {
        const grup = abcUrunler.filter(u => u.sinif === sinif)
        return {
            sinif,
            adet: grup.length,
            deger: grup.reduce((s, u) => s + u.deger, 0),
            yuzde: toplamDeger > 0 ? ((grup.reduce((s, u) => s + u.deger, 0) / toplamDeger) * 100).toFixed(1) : 0
        }
    })

    const abcGrafikVeri = abcOzet.map(o => ({ name: `Sınıf ${o.sinif}`, deger: Math.round(o.deger), adet: o.adet }))

    // Kategori dağılımı — doğrudan ürünlerden hesapla (dashboard bekleme)
    const kategoriDagilimi = Object.entries(
        urunler.reduce((acc, u) => {
            const k = u.kategori || "Diğer"
            if (!acc[k]) acc[k] = { urun_sayisi: 0, stok_degeri: 0 }
            acc[k].urun_sayisi += 1
            acc[k].stok_degeri += (u.mevcut_stok || 0) * (u.maliyet_fiyati || 0)
            return acc
        }, {})
    ).map(([kategori, d]) => ({ kategori, ...d }))
        .sort((a, b) => b.stok_degeri - a.stok_degeri)
        .slice(0, 7)

    // Raporlar tabı KPI'ları — urunler + kritikler'den
    const toplamStokDegeri = urunler.reduce((s, u) => s + (u.mevcut_stok || 0) * (u.maliyet_fiyati || 0), 0)
    const kategoriSayisi   = new Set(urunler.map(u => u.kategori).filter(Boolean)).size

    const filtreliUrunler = abcUrunler
        .filter(u => abcFiltre === "Tümü" || u.sinif === abcFiltre)
        .sort((a, b) => {
            const carp = siralamaYon === "desc" ? -1 : 1
            if (siralamaAlan === "deger") return carp * (a.deger - b.deger)
            if (siralamaAlan === "urun_adi") return carp * a.urun_adi.localeCompare(b.urun_adi)
            if (siralamaAlan === "mevcut_stok") return carp * (a.mevcut_stok - b.mevcut_stok)
            return 0
        })

    const siralamaToggle = (alan) => {
        if (siralamaAlan === alan) setSiralamaYon(y => y === "desc" ? "asc" : "desc")
        else { setSiralamaAlan(alan); setSiralamaYon("desc") }
    }

    const SiralamaIkon = ({ alan }) => {
        if (siralamaAlan !== alan) return <ChevronUp size={13} className="text-gray-300" />
        return siralamaYon === "desc" ? <ChevronDown size={13} className="text-blue-500" /> : <ChevronUp size={13} className="text-blue-500" />
    }

    const csvIndir = () => {
        const satirlar = [
            ["ABC Sınıfı", "Ürün Adı", "Kategori", "Mevcut Stok", "Birim", "Stok Değeri (₺)", "Kümülatif %"],
            ...filtreliUrunler.map(u => [u.sinif, u.urun_adi, u.kategori, u.mevcut_stok, u.birim, u.deger.toFixed(2), u.kumulatifYuzde])
        ]
        const csv = satirlar.map(r => r.join(",")).join("\n")
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a"); a.href = url; a.download = "abc_analizi.csv"; a.click()
    }

    const kritikCsvIndir = () => {
        const satirlar = [
            ["Ürün Adı", "Kategori", "Mevcut Stok", "Min Seviye", "Birim", "Açık (Eksik)"],
            ...kritikler.map(u => [u.urun_adi, u.kategori, u.mevcut_stok, u.min_stok_seviyesi, u.birim, (u.min_stok_seviyesi - u.mevcut_stok).toFixed(1)])
        ]
        const csv = satirlar.map(r => r.join(",")).join("\n")
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a"); a.href = url; a.download = "kritik_stok.csv"; a.click()
    }

    if (yukleniyor) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="space-y-6">

            {/* Başlık */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stok Analizi & Raporlar</h1>
                <p className="text-sm text-gray-400 mt-1">Ürünleri değerine göre sınıflandırır, kritik stokları ve kategori dağılımını gösterir.</p>
            </div>

            {/* Tab Seçici */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
                {[{ key: "abc", label: "ABC Analizi" }, { key: "raporlar", label: "Raporlar" }].map(t => (
                    <button key={t.key} onClick={() => setAktifTab(t.key)}
                        className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200
                            ${aktifTab === t.key ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── TAB 1: ABC ANALİZİ ── */}
            {aktifTab === "abc" && (
                <>
                    {/* 3 Özet Kart */}
                    <div className="grid grid-cols-3 gap-4">
                        {abcOzet.map(o => (
                            <div key={o.sinif} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-3">
                                    <AbcRozeti sinif={o.sinif} />
                                    <span className="text-xs text-gray-400">{o.adet} ürün</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    ₺{Math.round(o.deger).toLocaleString("tr-TR")}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Toplam stok değerinin %{o.yuzde}'i
                                </p>
                                <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className={`h-1.5 rounded-full ${o.sinif === "A" ? "bg-green-500" : o.sinif === "B" ? "bg-blue-500" : "bg-gray-400"}`}
                                        style={{ width: `${o.yuzde}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Grafikler */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Pasta Grafiği */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Değere Göre ABC Dağılımı</h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={abcGrafikVeri} dataKey="deger" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={3}>
                                        {abcGrafikVeri.map((_, i) => (
                                            <Cell key={i} fill={["#10b981", "#3b82f6", "#9ca3af"][i]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v) => `₺${v.toLocaleString("tr-TR")}`} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex justify-center gap-4 mt-2">
                                {abcGrafikVeri.map((d, i) => (
                                    <span key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: ["#10b981", "#3b82f6", "#9ca3af"][i] }} />
                                        {d.name} ({d.adet} ürün)
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Kategori Stok Değeri Bar */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Kategori Bazlı Stok Değeri</h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart
                                    data={kategoriDagilimi}
                                    layout="vertical"
                                    margin={{ left: 10, right: 20, top: 0, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₺${(v / 1000).toFixed(0)}k`} />
                                    <YAxis type="category" dataKey="kategori" tick={{ fontSize: 10 }} width={90} />
                                    <Tooltip formatter={v => `₺${v.toLocaleString("tr-TR")}`} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                                    <Bar dataKey="stok_degeri" name="Stok Değeri" radius={[0, 6, 6, 0]}>
                                        {kategoriDagilimi.map((_, i) => (
                                            <Cell key={i} fill={KATEGORI_RENKLER[i % KATEGORI_RENKLER.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ABC Tablosu */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ürün Listesi</h3>
                                <span className="text-xs text-gray-400">({filtreliUrunler.length} ürün)</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1">
                                    {["Tümü", "A", "B", "C"].map(f => (
                                        <button key={f} onClick={() => setAbcFiltre(f)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${abcFiltre === f ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                                            {f}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={csvIndir}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                                    <Download size={13} /> CSV İndir
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sınıf</th>
                                        <th className="px-6 py-3 text-left">
                                            <button onClick={() => siralamaToggle("urun_adi")} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300">
                                                Ürün <SiralamaIkon alan="urun_adi" />
                                            </button>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                                        <th className="px-6 py-3 text-right">
                                            <button onClick={() => siralamaToggle("mevcut_stok")} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 ml-auto">
                                                Stok <SiralamaIkon alan="mevcut_stok" />
                                            </button>
                                        </th>
                                        <th className="px-6 py-3 text-right">
                                            <button onClick={() => siralamaToggle("deger")} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 ml-auto">
                                                Stok Değeri <SiralamaIkon alan="deger" />
                                            </button>
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Kümülatif %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filtreliUrunler.slice(0, 50).map(urun => (
                                        <tr key={urun.urun_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-3"><AbcRozeti sinif={urun.sinif} /></td>
                                            <td className="px-6 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{urun.urun_adi}</td>
                                            <td className="px-6 py-3 text-sm text-gray-500">{urun.kategori}</td>
                                            <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300 text-right">{urun.mevcut_stok} {urun.birim}</td>
                                            <td className="px-6 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200 text-right">₺{Math.round(urun.deger).toLocaleString("tr-TR")}</td>
                                            <td className="px-6 py-3 text-right">
                                                <span className="text-xs font-medium text-gray-500">%{urun.kumulatifYuzde}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ── TAB 2: RAPORLAR ── */}
            {aktifTab === "raporlar" && (
                <>
                    {/* Özet KPI'lar */}
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            { label: "Toplam Ürün",       value: urunler.length,                                              ikon: <Package size={16} className="text-blue-600" />,   renk: "bg-blue-50 dark:bg-blue-900/30"   },
                            { label: "Kritik Stok",        value: kritikler.length,                                            ikon: <AlertTriangle size={16} className="text-red-500" />, renk: "bg-red-50 dark:bg-red-900/30"     },
                            { label: "Toplam Stok Değeri", value: `₺${Math.round(toplamStokDegeri).toLocaleString("tr-TR")}`, ikon: <TrendingUp size={16} className="text-green-600" />, renk: "bg-green-50 dark:bg-green-900/30"  },
                            { label: "Kategori Sayısı",    value: kategoriSayisi,                                              ikon: <Package size={16} className="text-purple-600" />,  renk: "bg-purple-50 dark:bg-purple-900/30" },
                        ].map(k => (
                            <div key={k.label} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{k.label}</p>
                                    <div className={`w-8 h-8 ${k.renk} rounded-lg flex items-center justify-center`}>{k.ikon}</div>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{k.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Kategori Özeti Tablosu */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Kategori Özeti</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün Sayısı</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Stok Değeri</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Pay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {kategoriDagilimi.map((kat, i) => {
                                        const pay = toplamStokDegeri > 0
                                            ? ((kat.stok_degeri / toplamStokDegeri) * 100).toFixed(1) : 0
                                        return (
                                            <tr key={kat.kategori} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                                            style={{ background: KATEGORI_RENKLER[i % KATEGORI_RENKLER.length] }} />
                                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{kat.kategori}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400 text-right">{kat.urun_sayisi}</td>
                                                <td className="px-6 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200 text-right">₺{Math.round(kat.stok_degeri).toLocaleString("tr-TR")}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                            <div className="h-1.5 rounded-full" style={{ width: `${pay}%`, background: KATEGORI_RENKLER[i % KATEGORI_RENKLER.length] }} />
                                                        </div>
                                                        <span className="text-xs text-gray-500 w-8 text-right">%{pay}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Kritik Stok Tablosu */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-500" />
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Kritik Stok Uyarıları</h3>
                                <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">{kritikler.length}</span>
                            </div>
                            <button onClick={kritikCsvIndir}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                                <Download size={13} /> CSV İndir
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Mevcut</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Minimum</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Açık</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {kritikler.length === 0 && (
                                        <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">Tüm ürünler yeterli stok seviyesinde</td></tr>
                                    )}
                                    {kritikler.map(urun => {
                                        const acik = urun.min_stok_seviyesi - urun.mevcut_stok
                                        const oran = urun.min_stok_seviyesi > 0 ? (urun.mevcut_stok / urun.min_stok_seviyesi) * 100 : 0
                                        return (
                                            <tr key={urun.urun_id} className="hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                                                <td className="px-6 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{urun.urun_adi}</td>
                                                <td className="px-6 py-3 text-sm text-gray-500">{urun.kategori}</td>
                                                <td className="px-6 py-3 text-sm font-semibold text-red-600 text-right">{urun.mevcut_stok} {urun.birim}</td>
                                                <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400 text-right">{urun.min_stok_seviyesi} {urun.birim}</td>
                                                <td className="px-6 py-3 text-sm font-semibold text-red-600 text-right">+{acik.toFixed(1)} {urun.birim}</td>
                                                <td className="px-6 py-3 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                            <div className="h-1.5 bg-red-500 rounded-full" style={{ width: `${Math.min(oran, 100)}%` }} />
                                                        </div>
                                                        <span className="text-xs text-red-500">%{Math.round(oran)}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

        </div>
    )
}
