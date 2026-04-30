import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import axios from "axios"
import {
    LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts"
import { Package, ShoppingCart, TrendingDown, AlertTriangle, CheckCircle, Search, X, Truck } from "lucide-react"

export default function EOQ() {
    const [searchParams] = useSearchParams()
    const [urunler, setUrunler] = useState([])
    const [seciliUrun, setSeciliUrun] = useState(null)
    const [eoqData, setEoqData] = useState(null)
    const [yukleniyor, setYukleniyor] = useState(false)
    const [aramaMetni, setAramaMetni] = useState("")
    const [aramaAcik, setAramaAcik] = useState(false)
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
        setEoqData(null)
        axios.get(`http://127.0.0.1:8000/analitik/eoq/${seciliUrun.urun_id}`)
            .then(r => { setEoqData(r.data); setYukleniyor(false) })
            .catch(() => { setYukleniyor(false) })
    }, [seciliUrun])

    const aramaFiltreUrunler = urunler.filter(u =>
        aramaMetni.length > 0 &&
        (u.urun_adi.toLowerCase().includes(aramaMetni.toLowerCase()) ||
            (u.kategori || "").toLowerCase().includes(aramaMetni.toLowerCase()))
    ).slice(0, 7)

    const urunSec = (urun) => {
        setSeciliUrun(urun)
        setAramaMetni(urun.urun_adi)
        setAramaAcik(false)
    }

    // Maliyet eğrisi veri noktaları
    const maliyetEgrisiVerisi = eoqData ? (() => {
        const D = eoqData.aciklama.D_yillik_talep
        const S = eoqData.aciklama.S_siparis_maliyeti
        const H = eoqData.aciklama.H_tutma_maliyeti
        const Q = eoqData.optimal_siparis_miktari
        const minQ = Math.max(1, Math.floor(Q * 0.1))
        const maxQ = Math.ceil(Q * 3)
        const step = Math.max(1, Math.floor((maxQ - minQ) / 60))
        const points = []
        for (let q = minQ; q <= maxQ; q += step) {
            points.push({
                miktar: q,
                siparisM: Math.round((D / q) * S),
                tutmaM: Math.round((q / 2) * H),
                toplamM: Math.round((D / q) * S + (q / 2) * H),
            })
        }
        return points
    })() : []

    // Türetilmiş değerler
    const hesapla = eoqData ? (() => {
        const D = eoqData.aciklama.D_yillik_talep
        const S = eoqData.aciklama.S_siparis_maliyeti
        const H = eoqData.aciklama.H_tutma_maliyeti
        const Q = eoqData.optimal_siparis_miktari
        const gunlukTalep = D / 365
        const yillikSiparisSayisi = D / Q
        const siparisAraligiGun = Math.round(365 / yillikSiparisSayisi)
        const yillikSiparisM = Math.round((D / Q) * S)
        const yillikTutmaM = Math.round((Q / 2) * H)
        const toplamYillikM = yillikSiparisM + yillikTutmaM
        const teminSuresi = gunlukTalep > 0 ? Math.round(eoqData.siparis_noktasi / gunlukTalep) : 5
        return { yillikSiparisSayisi: Math.round(yillikSiparisSayisi), siparisAraligiGun, yillikSiparisM, yillikTutmaM, toplamYillikM, teminSuresi }
    })() : null

    // Testere dişi stok simülasyonu
    const stokSimulasyonu = eoqData && hesapla ? (() => {
        const D = eoqData.aciklama.D_yillik_talep
        const Q = eoqData.optimal_siparis_miktari
        const gunlukTalep = D / 365
        const reorderPoint = eoqData.siparis_noktasi
        const safetyStock = eoqData.guvenlik_stogu
        const leadTime = hesapla.teminSuresi

        const simGun = Math.min(365, Math.ceil(hesapla.siparisAraligiGun * 5 + leadTime))
        let stok = Q + reorderPoint
        let siparisGelecek = []
        const points = []

        for (let gun = 0; gun <= simGun; gun++) {
            siparisGelecek = siparisGelecek.filter(s => {
                if (s.gun === gun) { stok = Math.min(stok + Q, Q + reorderPoint + Q); return false }
                return true
            })
            stok = Math.max(safetyStock * 0.3, stok)
            points.push({ gun, stok: Math.round(stok * 10) / 10 })
            stok -= gunlukTalep
            if (stok <= reorderPoint && siparisGelecek.length === 0) {
                siparisGelecek.push({ gun: gun + leadTime })
            }
        }
        return points
    })() : []

    return (
        <div className="space-y-6">

            {/* Başlık + Arama */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EOQ Analizi</h1>
                    <p className="text-sm text-gray-400 mt-1">Her ürün için en az maliyetle ne kadar, ne zaman sipariş vereceğinizi hesaplar.</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Arama */}
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
                        {aramaAcik && aramaMetni.length > 0 && aramaFiltreUrunler.length === 0 && (
                            <div className="absolute top-12 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 z-50">
                                <p className="text-sm text-gray-400 text-center">Ürün bulunamadı</p>
                            </div>
                        )}
                    </div>

                    {/* Select */}
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

            {/* Boş durum */}
            {!seciliUrun && (
                <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <ShoppingCart size={48} className="text-gray-300 mb-4" />
                    <p className="text-gray-400 text-lg font-medium">EOQ Analizi Başlatın</p>
                    <p className="text-gray-300 text-sm mt-1">Optimum sipariş miktarını hesaplamak için ürün arayın veya ürün seçin</p>
                </div>
            )}

            {/* Yükleniyor */}
            {yukleniyor && (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {seciliUrun && !yukleniyor && eoqData && hesapla && (
                <>
                    {/* Sipariş Gerekli Banner */}
                    {eoqData.siparis_gerekli_mi && (
                        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-5 py-4">
                            <AlertTriangle size={20} className="text-red-500 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Sipariş Gerekli!</p>
                                <p className="text-xs text-red-500 mt-0.5">
                                    Mevcut stok ({eoqData.mevcut_stok} {seciliUrun.birim}), yeniden sipariş noktasının ({eoqData.siparis_noktasi} {seciliUrun.birim}) altına düştü. {eoqData.optimal_siparis_miktari} {seciliUrun.birim} sipariş verin.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 4 KPI Kartı */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Optimum Sipariş</p>
                                <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                    <ShoppingCart size={16} className="text-blue-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{eoqData.optimal_siparis_miktari}</p>
                            <p className="text-xs text-gray-400 mt-1">{seciliUrun.birim} / sipariş (Q*)</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sipariş Noktası</p>
                                <div className="w-8 h-8 bg-orange-50 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                                    <AlertTriangle size={16} className="text-orange-500" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{eoqData.siparis_noktasi}</p>
                            <p className="text-xs text-gray-400 mt-1">{seciliUrun.birim} altında sipariş ver</p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Güvenlik Stoğu</p>
                                <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                                    <Package size={16} className="text-purple-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{eoqData.guvenlik_stogu}</p>
                            <p className="text-xs text-gray-400 mt-1">{seciliUrun.birim} minimum tampon</p>
                        </div>

                        <div className={`rounded-2xl p-5 shadow-sm border ${eoqData.siparis_gerekli_mi ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"}`}>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stok Durumu</p>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${eoqData.siparis_gerekli_mi ? "bg-red-100 dark:bg-red-900/50" : "bg-green-100 dark:bg-green-900/50"}`}>
                                    {eoqData.siparis_gerekli_mi
                                        ? <AlertTriangle size={16} className="text-red-500" />
                                        : <CheckCircle size={16} className="text-green-600" />}
                                </div>
                            </div>
                            <p className={`text-3xl font-bold ${eoqData.siparis_gerekli_mi ? "text-red-600" : "text-green-600"}`}>
                                {eoqData.siparis_gerekli_mi ? "Kritik" : "Yeterli"}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Mevcut: {eoqData.mevcut_stok} {seciliUrun.birim}</p>
                        </div>
                    </div>

                    {/* Maliyet Eğrisi */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Maliyet Eğrisi</h2>
                                <p className="text-sm text-gray-400">Sipariş miktarına göre yıllık maliyet — Q* = {eoqData.optimal_siparis_miktari} {seciliUrun.birim}'de minimum</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> Sipariş Maliyeti
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <span className="w-3 h-0.5 bg-orange-400 inline-block rounded" /> Tutma Maliyeti
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Toplam Maliyet
                                </span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={maliyetEgrisiVerisi} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="miktar"
                                    tick={{ fontSize: 11 }}
                                    label={{ value: `Sipariş Miktarı (${seciliUrun.birim})`, position: "insideBottom", offset: -10, fontSize: 11, fill: "#9ca3af" }}
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={v => `₺${(v / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    formatter={(val, name) => [`₺${val.toLocaleString("tr-TR")}`, name]}
                                    labelFormatter={l => `Sipariş Miktarı: ${l} ${seciliUrun.birim}`}
                                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                                />
                                <ReferenceLine
                                    x={eoqData.optimal_siparis_miktari}
                                    stroke="#8b5cf6"
                                    strokeDasharray="5 5"
                                    label={{ value: `Q* = ${eoqData.optimal_siparis_miktari}`, fill: "#8b5cf6", fontSize: 11, position: "top" }}
                                />
                                <Line type="monotone" dataKey="siparisM" name="Sipariş Maliyeti" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="tutmaM" name="Tutma Maliyeti" stroke="#fb923c" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="toplamM" name="Toplam Maliyet" stroke="#10b981" strokeWidth={2.5} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Stok Seviyesi Simülasyonu */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Stok Seviyesi Simülasyonu</h2>
                                <p className="text-sm text-gray-400 mt-0.5">
                                    Stok sipariş noktasına ({eoqData.siparis_noktasi} {seciliUrun.birim}) düşünce sipariş verilir,
                                    {hesapla.teminSuresi} gün sonra Q* = {eoqData.optimal_siparis_miktari} {seciliUrun.birim} gelir.
                                </p>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 ml-4">
                                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <span className="w-3 h-3 rounded-sm bg-blue-100 inline-block border border-blue-300" /> Stok Seviyesi
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <span className="w-3 h-0.5 bg-orange-400 inline-block" /> Sipariş Noktası
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <span className="w-3 h-0.5 bg-red-400 inline-block border-dashed" /> Güvenlik Stoğu
                                </span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={stokSimulasyonu} margin={{ top: 15, right: 20, left: 10, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="stokGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="gun"
                                    tick={{ fontSize: 11 }}
                                    label={{ value: "Gün", position: "insideBottom", offset: -10, fontSize: 11, fill: "#9ca3af" }}
                                    interval={Math.floor(stokSimulasyonu.length / 8)}
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    label={{ value: seciliUrun.birim, angle: -90, position: "insideLeft", fontSize: 11, fill: "#9ca3af" }}
                                />
                                <Tooltip
                                    formatter={(val) => [`${val} ${seciliUrun.birim}`, "Stok"]}
                                    labelFormatter={l => `${l}. Gün`}
                                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                                />
                                <ReferenceLine y={eoqData.siparis_noktasi} stroke="#fb923c" strokeWidth={1.5} strokeDasharray="6 3"
                                    label={{ value: `Sipariş Noktası (${eoqData.siparis_noktasi})`, fill: "#fb923c", fontSize: 10, position: "right" }} />
                                <ReferenceLine y={eoqData.guvenlik_stogu} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3"
                                    label={{ value: `Güvenlik Stoğu (${eoqData.guvenlik_stogu})`, fill: "#ef4444", fontSize: 10, position: "right" }} />
                                <Area type="monotone" dataKey="stok" name="Stok" stroke="#3b82f6" strokeWidth={2} fill="url(#stokGradient)" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Alt 2 Kart */}
                    <div className="grid grid-cols-2 gap-4">

                        {/* Sipariş Takvimi */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                                <Truck size={16} className="text-blue-500" /> Sipariş Takvimi
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { label: "Yıllık Sipariş Sayısı", value: `${hesapla.yillikSiparisSayisi} kez` },
                                    { label: "Sipariş Aralığı", value: `${hesapla.siparisAraligiGun} günde bir` },
                                    { label: "Temin Süresi", value: `${hesapla.teminSuresi} gün` },
                                    { label: "Yıllık Sipariş Maliyeti", value: `₺${hesapla.yillikSiparisM.toLocaleString("tr-TR")}` },
                                    { label: "Yıllık Tutma Maliyeti", value: `₺${hesapla.yillikTutmaM.toLocaleString("tr-TR")}` },
                                    { label: "Toplam Yıllık Maliyet", value: `₺${hesapla.toplamYillikM.toLocaleString("tr-TR")}`, vurgu: true },
                                ].map(item => (
                                    <div key={item.label} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2.5 last:border-0">
                                        <p className="text-sm text-gray-500">{item.label}</p>
                                        <p className={`text-sm font-semibold ${item.vurgu ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Model Parametreleri */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                                <TrendingDown size={16} className="text-purple-500" /> Model Parametreleri
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { label: "Yıllık Talep (D)", value: `${Math.round(eoqData.aciklama.D_yillik_talep).toLocaleString("tr-TR")} ${seciliUrun.birim}` },
                                    { label: "Sipariş Maliyeti (S)", value: `₺${eoqData.aciklama.S_siparis_maliyeti}` },
                                    { label: "Birim Tutma Maliyeti (H)", value: `₺${eoqData.aciklama.H_tutma_maliyeti}` },
                                    { label: "Mevcut Stok", value: `${eoqData.mevcut_stok} ${seciliUrun.birim}` },
                                    { label: "Min Stok Seviyesi", value: `${seciliUrun.min_stok_seviyesi} ${seciliUrun.birim}` },
                                    { label: "EOQ Formülü", value: "Q* = √(2 × D × S / H)", vurgu: true },
                                ].map(item => (
                                    <div key={item.label} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2.5 last:border-0">
                                        <p className="text-sm text-gray-500">{item.label}</p>
                                        <p className={`text-sm font-semibold ${item.vurgu ? "text-purple-600 dark:text-purple-400 font-mono" : "text-gray-700 dark:text-gray-300"}`}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </>
            )}

        </div>
    )
}
