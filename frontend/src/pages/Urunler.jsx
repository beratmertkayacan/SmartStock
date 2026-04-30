import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import axios from "axios"
import {
    Plus, Search, X, Edit2, Trash2, Package,
    TrendingUp, AlertTriangle, DollarSign, ChevronLeft, ChevronRight,
    ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react"

const API = "http://127.0.0.1:8000"
const SAYFA_BOYUTU = 50

const BOŞ_FORM = {
    urun_adi: "", kategori: "", birim: "adet",
    maliyet_fiyati: "", satis_fiyati: "",
    min_stok_seviyesi: "", max_stok_seviyesi: "", mevcut_stok: ""
}

const BİRİMLER = ["adet", "kg", "ton", "m", "m2", "m3", "lt", "paket", "kutu", "rulo"]

// Kategori rengi — hash ile tutarlı renk atar
const KATEGORİ_RENKLER = [
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
]

function kategoriRenk(kategori) {
    if (!kategori) return "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
    let hash = 0
    for (let i = 0; i < kategori.length; i++) hash = kategori.charCodeAt(i) + ((hash << 5) - hash)
    return KATEGORİ_RENKLER[Math.abs(hash) % KATEGORİ_RENKLER.length]
}

function stokDurum(u) {
    const stok = u.mevcut_stok ?? 0
    const min  = u.min_stok_seviyesi ?? 0
    const max  = u.max_stok_seviyesi
    if (stok <= min)              return { kod: "kritik", barRenk: "#ef4444", etiket: "Kritik",     etiketCls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" }
    if (stok <= min * 1.4)        return { kod: "dusuk",  barRenk: "#f59e0b", etiket: "Düşük",      etiketCls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
    if (max && stok >= max * 0.9) return { kod: "fazla",  barRenk: "#3b82f6", etiket: "Max dolu",   etiketCls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" }
    return                               { kod: "normal", barRenk: "#22c55e", etiket: null,         etiketCls: null }
}

function stokPct(u) {
    const stok = u.mevcut_stok ?? 0
    const min  = u.min_stok_seviyesi ?? 0
    const max  = u.max_stok_seviyesi
    if (!max || max <= min) return Math.min(100, min > 0 ? (stok / min) * 60 : (stok > 0 ? 60 : 0))
    return Math.min(100, Math.max(0, ((stok - min) / (max - min)) * 100))
}

function marjHesapla(maliyet, satis) {
    if (!maliyet || !satis || satis === 0) return null
    return Math.round(((satis - maliyet) / satis) * 100)
}

export default function Urunler() {
    const [searchParams] = useSearchParams()

    const [urunler, setUrunler]           = useState([])
    const [yukleniyor, setYukleniyor]     = useState(true)
    const [refreshKey, setRefreshKey]     = useState(0)

    const [aramaMetni, setAramaMetni]     = useState("")
    const [stokFiltre, setStokFiltre]     = useState("tumu")
    const [kategoriFiltre, setKategoriFiltre] = useState("tumu")
    const [siralama, setSiralama]         = useState({ alan: "urun_adi", yon: "asc" })
    const [sayfa, setSayfa]               = useState(1)

    const [panelAcik, setPanelAcik]       = useState(false)
    const [duzenleMe, setDuzenleme]       = useState(null)
    const [form, setForm]                 = useState(BOŞ_FORM)
    const [kayitYukleniyor, setKayitYukleniyor] = useState(false)
    const [bildirim, setBildirim]         = useState(null)
    const [silOnay, setSilOnay]           = useState(null)

    // Navbar aramasından gelen ürün vurgusu
    const [vurgulananId, setVurgulananId] = useState(null)
    const vurgulananRef                   = useRef(null)

    const panelRef    = useRef(null)
    const scrollRef   = useRef(null)

    // ── Veri yükle ───────────────────────────────────────────────────────────
    useEffect(() => {
        setYukleniyor(true)
        axios.get(`${API}/urunler/`).then(r => {
            setUrunler(r.data)
            setYukleniyor(false)
        }).catch(() => setYukleniyor(false))
    }, [refreshKey])

    // ── Navbar aramasından gelen urun_id → ürünü bul, sayfaya git, vurgula ──
    useEffect(() => {
        const paramId = searchParams.get("urun_id")
        if (!paramId || urunler.length === 0) return
        const hedefId = parseInt(paramId)
        const urun    = urunler.find(u => u.urun_id === hedefId)
        if (!urun) return

        // Filtreleri sıfırla (ürün görünür olsun)
        setAramaMetni("")
        setStokFiltre("tumu")
        setKategoriFiltre("tumu")
        const siraliBulunan = [...urunler].sort((a, b) =>
            (a.urun_adi || "").localeCompare(b.urun_adi || "", "tr"))
        const index = siraliBulunan.findIndex(u => u.urun_id === hedefId)
        if (index >= 0) setSayfa(Math.floor(index / SAYFA_BOYUTU) + 1)

        // Vurgula ve 3 saniye sonra kaldır
        setVurgulananId(hedefId)
        setTimeout(() => setVurgulananId(null), 3000)
    }, [urunler, searchParams])

    // Vurgulanan satıra scroll
    useEffect(() => {
        if (vurgulananId && vurgulananRef.current) {
            setTimeout(() =>
                vurgulananRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
            , 120)
        }
    }, [vurgulananId])

    // Panel dışına tıklayınca kapat
    useEffect(() => {
        function dışarı(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) setPanelAcik(false)
        }
        if (panelAcik) document.addEventListener("mousedown", dışarı)
        return () => document.removeEventListener("mousedown", dışarı)
    }, [panelAcik])

    // Panel açılınca scroll sıfırla
    useEffect(() => {
        if (panelAcik && scrollRef.current) scrollRef.current.scrollTop = 0
    }, [panelAcik])

    // ── KPI hesapları ────────────────────────────────────────────────────────
    const kritikSayisi   = urunler.filter(u => (u.mevcut_stok ?? 0) <= (u.min_stok_seviyesi ?? 0)).length
    const stokDegeri     = urunler.reduce((s, u) => s + (u.mevcut_stok ?? 0) * (u.maliyet_fiyati ?? 0), 0)
    const marjlar        = urunler.map(u => marjHesapla(u.maliyet_fiyati, u.satis_fiyati)).filter(m => m !== null)
    const ortMarj        = marjlar.length ? Math.round(marjlar.reduce((a, b) => a + b, 0) / marjlar.length) : 0

    // ── Kategoriler ──────────────────────────────────────────────────────────
    const kategoriler = [...new Set(urunler.map(u => u.kategori).filter(Boolean))].sort()

    // ── Filtreleme + sıralama ────────────────────────────────────────────────
    const filtreliUrunler = urunler
        .filter(u => {
            const q = aramaMetni.toLowerCase()
            const aramaOk = !aramaMetni || u.urun_adi?.toLowerCase().includes(q) || u.kategori?.toLowerCase().includes(q)
            const katOk   = kategoriFiltre === "tumu" || u.kategori === kategoriFiltre
            const durum   = stokDurum(u).kod
            const stokOk  = stokFiltre === "tumu" || durum === stokFiltre
            return aramaOk && katOk && stokOk
        })
        .sort((a, b) => {
            const { alan, yon } = siralama
            let va = a[alan] ?? "", vb = b[alan] ?? ""
            if (typeof va === "string") va = va.toLowerCase()
            if (typeof vb === "string") vb = vb.toLowerCase()
            return yon === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
        })

    const toplamSayfa   = Math.max(1, Math.ceil(filtreliUrunler.length / SAYFA_BOYUTU))
    const sayfaUrunleri = filtreliUrunler.slice((sayfa - 1) * SAYFA_BOYUTU, sayfa * SAYFA_BOYUTU)

    // Filtre değişince sayfa 1'e dön
    useEffect(() => { setSayfa(1) }, [aramaMetni, stokFiltre, kategoriFiltre])

    // ── Sıralama toggle ──────────────────────────────────────────────────────
    const sırala = (alan) => setSiralama(s =>
        s.alan === alan ? { alan, yon: s.yon === "asc" ? "desc" : "asc" } : { alan, yon: "asc" }
    )
    const SiralaIcon = ({ alan }) => {
        if (siralama.alan !== alan) return <ArrowUpDown size={12} className="text-gray-300 ml-1" />
        return siralama.yon === "asc" ? <ArrowUp size={12} className="text-blue-500 ml-1" /> : <ArrowDown size={12} className="text-blue-500 ml-1" />
    }

    // ── Panel ─────────────────────────────────────────────────────────────────
    const panelAc = (urun = null) => {
        if (urun) {
            setDuzenleme(urun.urun_id)
            setForm({
                urun_adi:          urun.urun_adi || "",
                kategori:          urun.kategori || "",
                birim:             urun.birim || "adet",
                maliyet_fiyati:    urun.maliyet_fiyati ?? "",
                satis_fiyati:      urun.satis_fiyati ?? "",
                min_stok_seviyesi: urun.min_stok_seviyesi ?? "",
                max_stok_seviyesi: urun.max_stok_seviyesi ?? "",
                mevcut_stok:       urun.mevcut_stok ?? "",
            })
        } else {
            setDuzenleme(null)
            setForm(BOŞ_FORM)
        }
        setPanelAcik(true)
    }

    const bildirimGoster = (mesaj, tip = "basari") => {
        setBildirim({ mesaj, tip })
        setTimeout(() => setBildirim(null), 3000)
    }

    const kaydet = async () => {
        if (!form.urun_adi.trim()) { bildirimGoster("Ürün adı zorunludur", "hata"); return }
        setKayitYukleniyor(true)
        const payload = {
            urun_adi:          form.urun_adi.trim(),
            kategori:          form.kategori || null,
            birim:             form.birim || null,
            maliyet_fiyati:    form.maliyet_fiyati !== "" ? parseFloat(form.maliyet_fiyati) : null,
            satis_fiyati:      form.satis_fiyati   !== "" ? parseFloat(form.satis_fiyati)   : null,
            min_stok_seviyesi: form.min_stok_seviyesi !== "" ? parseInt(form.min_stok_seviyesi) : null,
            max_stok_seviyesi: form.max_stok_seviyesi !== "" ? parseInt(form.max_stok_seviyesi) : null,
            mevcut_stok:       form.mevcut_stok !== "" ? parseFloat(form.mevcut_stok) : null,
        }
        try {
            if (duzenleMe) {
                await axios.put(`${API}/urunler/${duzenleMe}`, payload)
                bildirimGoster("Ürün güncellendi")
            } else {
                await axios.post(`${API}/urunler/`, payload)
                bildirimGoster("Ürün eklendi")
            }
            setPanelAcik(false)
            setRefreshKey(k => k + 1)
        } catch (err) {
            const detail = err.response?.data?.detail
            let mesaj = "Kayıt sırasında hata oluştu"
            if (typeof detail === "string") {
                mesaj = detail
            } else if (Array.isArray(detail) && detail.length > 0) {
                mesaj = detail.map(d => d.msg || d.message || JSON.stringify(d)).join(", ")
            } else if (!err.response) {
                mesaj = "Sunucuya bağlanılamadı"
            }
            bildirimGoster(mesaj, "hata")
        }
        setKayitYukleniyor(false)
    }

    const sil = async (id) => {
        try {
            await axios.delete(`${API}/urunler/${id}`)
            setSilOnay(null)
            bildirimGoster("Ürün silindi")
            setRefreshKey(k => k + 1)
        } catch {
            bildirimGoster("Silinemedi", "hata")
        }
    }

    // Marj önizleme
    const onizMarj = marjHesapla(parseFloat(form.maliyet_fiyati), parseFloat(form.satis_fiyati))

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* Bildirim */}
            {bildirim && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-xl text-sm font-semibold
                    ${bildirim.tip === "hata" ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}>
                    {bildirim.mesaj}
                </div>
            )}

            {/* Başlık */}
            <div className="flex items-end gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ürün Kataloğu</h1>
                    <p className="text-sm text-gray-400 mt-1">Stok seviyelerini izleyin, ürün bilgilerini güncelleyin.</p>
                </div>
                <button onClick={() => panelAc()}
                    className="flex items-center gap-2.5 px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-blue-200 dark:shadow-blue-900/50 transition-all mb-0.5">
                    <Plus size={18} strokeWidth={2.5} />
                    <span>Ürün Ekle</span>
                </button>
            </div>

            {/* KPI Kartları */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Toplam Ürün</p>
                        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <Package size={15} className="text-blue-600" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{urunler.length.toLocaleString("tr-TR")}</p>
                    <p className="text-xs text-gray-400 mt-1">{kategoriler.length} kategori</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-red-100 dark:border-red-900/30"
                     style={{ borderLeftWidth: 3, borderLeftColor: kritikSayisi > 0 ? "#ef4444" : undefined }}>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Kritik Stok</p>
                        <div className="w-8 h-8 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                            <AlertTriangle size={15} className="text-red-500" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-red-500">{kritikSayisi}</p>
                    <p className="text-xs text-gray-400 mt-1">
                        {kritikSayisi > 0
                            ? <button onClick={() => setStokFiltre("kritik")} className="text-red-500 hover:underline">Filtrele →</button>
                            : "Min seviye altında ürün yok"}
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Toplam Stok Değeri</p>
                        <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                            <DollarSign size={15} className="text-emerald-600" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stokDegeri >= 1_000_000
                            ? `₺${(stokDegeri / 1_000_000).toFixed(1)}M`
                            : stokDegeri >= 1_000
                            ? `₺${(stokDegeri / 1_000).toFixed(0)}B`
                            : `₺${Math.round(stokDegeri).toLocaleString("tr-TR")}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">maliyet fiyatı bazlı</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ort. Kâr Marjı</p>
                        <div className="w-8 h-8 bg-violet-50 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                            <TrendingUp size={15} className="text-violet-600" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">%{ortMarj}</p>
                    <p className="text-xs text-gray-400 mt-1">{marjlar.length} ürün üzerinden</p>
                </div>
            </div>

            {/* Filtre Çubuğu + Tablo */}
            <div className="-mx-8">
                <div className="bg-white dark:bg-gray-800 shadow-sm border-y border-gray-100 dark:border-gray-700">

                    {/* Filtreler */}
                    <div className="flex items-center flex-wrap px-8 py-3 border-b border-gray-100 dark:border-gray-700 gap-3">

                        {/* Arama */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 w-64">
                            <Search size={14} className="text-gray-400 shrink-0" />
                            <input type="text" value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
                                placeholder="Ürün adı veya kategori..."
                                className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full" />
                            {aramaMetni && <button onClick={() => setAramaMetni("")}><X size={13} className="text-gray-400" /></button>}
                        </div>

                        {/* Stok Durumu Filtreleri */}
                        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                            {[
                                ["tumu",   "Tümü"],
                                ["kritik", "Kritik"],
                                ["dusuk",  "Düşük"],
                                ["normal", "Normal"],
                                ["fazla",  "Max Dolu"],
                            ].map(([val, label]) => (
                                <button key={val} onClick={() => setStokFiltre(val)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                        ${stokFiltre === val
                                            ? val === "kritik" ? "bg-red-500 text-white shadow-sm"
                                            : val === "dusuk"  ? "bg-amber-500 text-white shadow-sm"
                                            : val === "fazla"  ? "bg-blue-500 text-white shadow-sm"
                                            : "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                                            : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Kategori */}
                        <select value={kategoriFiltre} onChange={e => setKategoriFiltre(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 outline-none focus:border-blue-500 transition-colors">
                            <option value="tumu">Tüm Kategoriler</option>
                            {kategoriler.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>

                        <p className="text-xs text-gray-400 ml-auto">
                            {filtreliUrunler.length.toLocaleString("tr-TR")} ürün
                            {toplamSayfa > 1 && <span className="ml-1">· Sayfa {sayfa}/{toplamSayfa}</span>}
                        </p>
                    </div>

                    {/* Tablo */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                    <th className="px-3 py-3 text-left pl-8">
                                        <button onClick={() => sırala("urun_adi")}
                                            className="flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-blue-500 transition-colors">
                                            Ürün <SiralaIcon alan="urun_adi" />
                                        </button>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Kategori</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap w-52">Stok Durumu</th>
                                    <th className="px-3 py-3 text-left">
                                        <button onClick={() => sırala("mevcut_stok")}
                                            className="flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-blue-500 transition-colors whitespace-nowrap">
                                            Stok <SiralaIcon alan="mevcut_stok" />
                                        </button>
                                    </th>
                                    <th className="px-3 py-3 text-right">
                                        <button onClick={() => sırala("maliyet_fiyati")}
                                            className="flex items-center justify-end gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-blue-500 transition-colors whitespace-nowrap w-full">
                                            Maliyet <SiralaIcon alan="maliyet_fiyati" />
                                        </button>
                                    </th>
                                    <th className="px-3 py-3 text-right">
                                        <button onClick={() => sırala("satis_fiyati")}
                                            className="flex items-center justify-end gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-blue-500 transition-colors whitespace-nowrap w-full">
                                            Satış Fiyatı <SiralaIcon alan="satis_fiyati" />
                                        </button>
                                    </th>
                                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Marj</th>
                                    <th className="px-3 py-3 text-right pr-8 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {yukleniyor && (
                                    <tr><td colSpan={8} className="px-8 py-12 text-center">
                                        <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                    </td></tr>
                                )}
                                {!yukleniyor && sayfaUrunleri.length === 0 && (
                                    <tr><td colSpan={8} className="px-8 py-12 text-center text-sm text-gray-400">Ürün bulunamadı</td></tr>
                                )}
                                {sayfaUrunleri.map(u => {
                                    const durum = stokDurum(u)
                                    const pct   = stokPct(u)
                                    const marj  = marjHesapla(u.maliyet_fiyati, u.satis_fiyati)
                                    return (
                                        <tr key={u.urun_id}
                                            ref={u.urun_id === vurgulananId ? vurgulananRef : null}
                                            className={`transition-all duration-500
                                                ${u.urun_id === vurgulananId
                                                    ? "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-400 dark:ring-blue-500"
                                                    : durum.kod === "kritik"
                                                        ? "bg-red-50/40 dark:bg-red-900/10 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                                        : "hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                                }`}>

                                            <td className="px-3 py-3 pl-8 max-w-[220px]">
                                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{u.urun_adi}</p>
                                                <p className="text-xs text-gray-400">ÜRN-{String(u.urun_id).padStart(4, "0")}</p>
                                            </td>

                                            <td className="px-3 py-3">
                                                {u.kategori
                                                    ? <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${kategoriRenk(u.kategori)}`}>
                                                        {u.kategori}
                                                      </span>
                                                    : <span className="text-gray-300 text-xs">—</span>}
                                            </td>

                                            <td className="px-3 py-3 w-52">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-500"
                                                             style={{ width: `${pct}%`, backgroundColor: durum.barRenk }} />
                                                    </div>
                                                    {durum.etiket && (
                                                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${durum.etiketCls}`}>
                                                            {durum.etiket}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    min {u.min_stok_seviyesi ?? "—"} · max {u.max_stok_seviyesi ?? "—"}
                                                </p>
                                            </td>

                                            <td className="px-3 py-3">
                                                <span className={`text-sm font-bold ${durum.kod === "kritik" ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
                                                    {u.mevcut_stok != null ? u.mevcut_stok.toLocaleString("tr-TR") : "—"}
                                                </span>
                                                <span className="text-xs text-gray-400 ml-1">{u.birim}</span>
                                            </td>

                                            <td className="px-3 py-3 text-right text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {u.maliyet_fiyati != null ? `₺${u.maliyet_fiyati.toLocaleString("tr-TR")}` : "—"}
                                            </td>

                                            <td className="px-3 py-3 text-right text-sm font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                                {u.satis_fiyati != null ? `₺${u.satis_fiyati.toLocaleString("tr-TR")}` : "—"}
                                            </td>

                                            <td className="px-3 py-3 text-right">
                                                {marj != null
                                                    ? <span className={`text-sm font-bold ${marj >= 30 ? "text-emerald-600 dark:text-emerald-400" : marj >= 15 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}`}>
                                                        %{marj}
                                                      </span>
                                                    : <span className="text-gray-300 text-xs">—</span>}
                                            </td>

                                            <td className="px-3 py-3 pr-8">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => panelAc(u)}
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 transition-colors">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => setSilOnay(u.urun_id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {toplamSayfa > 1 && (
                        <div className="flex items-center justify-between px-8 py-3 border-t border-gray-100 dark:border-gray-700">
                            <span className="text-xs text-gray-400">
                                {(sayfa - 1) * SAYFA_BOYUTU + 1}–{Math.min(sayfa * SAYFA_BOYUTU, filtreliUrunler.length)} / {filtreliUrunler.length} ürün
                            </span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setSayfa(s => Math.max(1, s - 1))} disabled={sayfa === 1}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors text-gray-500">
                                    <ChevronLeft size={16} />
                                </button>
                                {Array.from({ length: Math.min(toplamSayfa, 7) }, (_, i) => {
                                    const p = toplamSayfa <= 7 ? i + 1
                                        : sayfa <= 4 ? i + 1
                                        : sayfa >= toplamSayfa - 3 ? toplamSayfa - 6 + i
                                        : sayfa - 3 + i
                                    return (
                                        <button key={p} onClick={() => setSayfa(p)}
                                            className={`w-7 h-7 rounded-lg text-xs font-medium transition-all
                                                ${p === sayfa ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
                                            {p}
                                        </button>
                                    )
                                })}
                                <button onClick={() => setSayfa(s => Math.min(toplamSayfa, s + 1))} disabled={sayfa === toplamSayfa}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors text-gray-500">
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Silme Onayı */}
            {silOnay && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-80">
                        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-2">Ürünü Sil</h3>
                        <p className="text-sm text-gray-500 mb-5">Bu ürün ve bağlı tüm stok hareketleri silinecek. Devam edilsin mi?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setSilOnay(null)}
                                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                                İptal
                            </button>
                            <button onClick={() => sil(silOnay)}
                                className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-all">
                                Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Backdrop */}
            <div className={`fixed top-16 left-0 right-0 bottom-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300
                ${panelAcik ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                onClick={() => setPanelAcik(false)} />

            {/* Slide-over Panel */}
            <div className={`fixed top-16 right-0 h-[calc(100vh-4rem)] z-[65] transition-all duration-300
                ${panelAcik ? "pointer-events-auto" : "pointer-events-none"}`}>
                <div ref={panelRef}
                    className={`h-full w-[520px] bg-white dark:bg-gray-900 shadow-[-12px_0_40px_rgba(0,0,0,0.14)] flex flex-col transition-transform duration-300 ease-out
                        ${panelAcik ? "translate-x-0" : "translate-x-full"}`}>

                    {/* Panel Başlık */}
                    <div className="px-7 pt-5 pb-5 border-b border-gray-100 dark:border-gray-700/80 bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-900">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                                    {duzenleMe ? "Düzenleme Modu" : "Yeni Kayıt"}
                                </p>
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                                    {duzenleMe ? "Ürünü Düzenle" : "Yeni Ürün Ekle"}
                                </h2>
                            </div>
                            <button onClick={() => setPanelAcik(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors mt-0.5">
                                <X size={17} className="text-gray-400" />
                            </button>
                        </div>
                    </div>

                    {/* Form */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 py-6 space-y-5">

                        {/* Ürün Adı */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ürün Adı *</label>
                            <input type="text" value={form.urun_adi} onChange={e => setForm(f => ({ ...f, urun_adi: e.target.value }))}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                                placeholder="Örn: Portland Çimento 42.5N" />
                        </div>

                        {/* Kategori + Birim */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Kategori</label>
                                <input type="text" value={form.kategori}
                                    onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}
                                    list="kategori-list"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                                    placeholder="Kategori seçin veya yazın" />
                                <datalist id="kategori-list">
                                    {kategoriler.map(k => <option key={k} value={k} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Birim</label>
                                <select value={form.birim} onChange={e => setForm(f => ({ ...f, birim: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all">
                                    {BİRİMLER.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Maliyet + Satış */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Maliyet Fiyatı (₺)</label>
                                <input type="number" min="0" step="0.01" value={form.maliyet_fiyati}
                                    onChange={e => setForm(f => ({ ...f, maliyet_fiyati: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                                    placeholder="0.00" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Satış Fiyatı (₺)</label>
                                <input type="number" min="0" step="0.01" value={form.satis_fiyati}
                                    onChange={e => setForm(f => ({ ...f, satis_fiyati: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                                    placeholder="0.00" />
                            </div>
                        </div>

                        {/* Marj Önizleme */}
                        {onizMarj !== null && (
                            <div className={`flex items-center justify-between rounded-2xl px-5 py-3.5 border
                                ${onizMarj >= 20 ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800/40"
                                : onizMarj >= 0  ? "bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/40"
                                :                  "bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800/40"}`}>
                                <span className="text-sm text-gray-500">Kâr Marjı</span>
                                <span className={`text-xl font-bold ${onizMarj >= 20 ? "text-emerald-600 dark:text-emerald-400" : onizMarj >= 0 ? "text-amber-600" : "text-red-500"}`}>
                                    %{onizMarj}
                                </span>
                            </div>
                        )}

                        {/* Stok Seviyeleri */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Min Stok</label>
                                <input type="number" min="0" value={form.min_stok_seviyesi}
                                    onChange={e => setForm(f => ({ ...f, min_stok_seviyesi: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                                    placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Max Stok</label>
                                <input type="number" min="0" value={form.max_stok_seviyesi}
                                    onChange={e => setForm(f => ({ ...f, max_stok_seviyesi: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                                    placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mevcut Stok</label>
                                <input type="number" min="0" step="0.01" value={form.mevcut_stok}
                                    onChange={e => setForm(f => ({ ...f, mevcut_stok: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                                    placeholder="0" />
                            </div>
                        </div>

                        {/* Stok Bar Önizleme */}
                        {(form.min_stok_seviyesi !== "" || form.max_stok_seviyesi !== "") && form.mevcut_stok !== "" && (
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl px-5 py-4">
                                <p className="text-xs text-gray-400 mb-2">Stok Bar Önizleme</p>
                                {(() => {
                                    const tmpU = {
                                        mevcut_stok: parseFloat(form.mevcut_stok) || 0,
                                        min_stok_seviyesi: parseInt(form.min_stok_seviyesi) || 0,
                                        max_stok_seviyesi: form.max_stok_seviyesi !== "" ? parseInt(form.max_stok_seviyesi) : null
                                    }
                                    const d = stokDurum(tmpU)
                                    const p = stokPct(tmpU)
                                    return (
                                        <div>
                                            <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                                <div className="h-full rounded-full transition-all"
                                                     style={{ width: `${p}%`, backgroundColor: d.barRenk }} />
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-xs text-gray-400">%{Math.round(p)}</span>
                                                {d.etiket && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${d.etiketCls}`}>{d.etiket}</span>}
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Alt Butonlar */}
                    <div className="px-7 py-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 flex gap-3">
                        <button onClick={() => setPanelAcik(false)}
                            className="px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                            İptal
                        </button>
                        <button onClick={kaydet} disabled={kayitYukleniyor}
                            className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/40
                                ${kayitYukleniyor ? "opacity-60 cursor-wait" : ""}`}>
                            {kayitYukleniyor ? "Kaydediliyor..." : duzenleMe ? "✓  Güncelle" : "✓  Ürünü Kaydet"}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    )
}
