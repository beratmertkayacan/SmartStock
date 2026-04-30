import { useState, useEffect, useRef } from "react"
import axios from "axios"
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts"
import {
    Plus, Search, X, Edit2, Trash2, ArrowDownCircle,
    ArrowUpCircle, Package, TrendingUp, TrendingDown, ArrowLeftRight
} from "lucide-react"

const API = "http://127.0.0.1:8000"

const BOŞ_FORM = {
    urun_id: "", hareket_tipi: "giris", miktar: "",
    birim_fiyat: "", tarih: new Date().toISOString().slice(0, 10),
    fatura_no: "", tedarikci_musteri: "", aciklama: ""
}

function Rozet({ tip }) {
    return tip === "giris"
        ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
            <ArrowDownCircle size={11} /> Giriş
          </span>
        : <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
            <ArrowUpCircle size={11} /> Çıkış
          </span>
}

const fmtY = (v) => {
    const abs = Math.abs(v)
    const sign = v < 0 ? "-" : ""
    if (v === 0) return "0"
    if (abs >= 1_000_000) return `${sign}₺${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${sign}₺${(abs / 1_000).toFixed(0)}B`
    return `${sign}₺${abs}`
}

function GrafikTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    const giris  = payload.find(p => p.dataKey === "Alım")?.value  || 0
    const cikis  = payload.find(p => p.dataKey === "Satış")?.value || 0
    const net    = payload.find(p => p.dataKey === "Net")?.value   ?? (cikis - giris)
    const pozitif = net >= 0
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 px-4 py-3 text-sm min-w-[180px]">
            <p className="font-bold text-gray-700 dark:text-gray-100 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">{label}</p>
            <div className="space-y-1.5">
                <div className="flex justify-between items-center gap-4">
                    <span className="flex items-center gap-1.5 text-gray-500">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />Alım
                    </span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">₺{Math.round(giris).toLocaleString("tr-TR")}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                    <span className="flex items-center gap-1.5 text-gray-500">
                        <span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" />Satış
                    </span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">₺{Math.round(cikis).toLocaleString("tr-TR")}</span>
                </div>
                <div className="flex justify-between items-center gap-4 pt-1.5 border-t border-dashed border-gray-100 dark:border-gray-700">
                    <span className="text-gray-500 font-medium">Net Kâr</span>
                    <span className={`font-bold ${pozitif ? "text-emerald-500" : "text-red-500"}`}>
                        {pozitif ? "+" : ""}₺{Math.round(net).toLocaleString("tr-TR")}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default function Hareketler() {
    const [hareketler, setHareketler] = useState([])
    const [urunler, setUrunler] = useState([])
    const [istatistik, setIstatistik] = useState({ toplam: 0, giris_sayisi: 0, cikis_sayisi: 0, giris_miktar: 0, cikis_miktar: 0 })
    const [yukleniyor, setYukleniyor] = useState(true)
    const [refreshKey, setRefreshKey] = useState(0)
    const [panelAcik, setPanelAcik] = useState(false)
    const [duzenleMe, setDuzenleme] = useState(null)   // null = yeni kayıt
    const [form, setForm] = useState(BOŞ_FORM)
    const [kayıtYukleniyor, setKayitYukleniyor] = useState(false)
    const [bildirim, setBildirim] = useState(null)

    // filtreler
    const [aramaMetni, setAramaMetni] = useState("")
    const [tipFiltre, setTipFiltre] = useState("tumu")
    const [siralama, setSiralama] = useState("eklenme")
    const [silOnay, setSilOnay] = useState(null)

    // Grafik dönem seçici
    const [grafikDonem, setGrafikDonem] = useState("14g")

    // Tablo tarih filtresi
    const [tarihBaslangic, setTarihBaslangic] = useState("")
    const [tarihBitis, setTarihBitis]         = useState("")
    const [tarihDonem, setTarihDonem]         = useState("tumu")

    const tarihDonemUygula = (donem) => {
        const bugun = new Date()
        const fmt = d => d.toISOString().slice(0, 10)
        setTarihDonem(donem)
        if (donem === "tumu")  { setTarihBaslangic(""); setTarihBitis("") }
        else if (donem === "bugun") { setTarihBaslangic(fmt(bugun)); setTarihBitis(fmt(bugun)) }
        else if (donem === "hafta") {
            const d = new Date(bugun); d.setDate(d.getDate() - 6)
            setTarihBaslangic(fmt(d)); setTarihBitis(fmt(bugun))
        } else if (donem === "ay") {
            const d = new Date(bugun.getFullYear(), bugun.getMonth(), 1)
            setTarihBaslangic(fmt(d)); setTarihBitis(fmt(bugun))
        }
    }

    // KPI dönem seçici
    const bugunStr = new Date().toISOString().slice(0, 10)
    const [kartDonem, setKartDonem] = useState("bugun")   // "bugun" | "dun" | "hafta" | "ay" | "ozel"
    const [kartBaslangic, setKartBaslangic] = useState(bugunStr)
    const [kartBitis, setKartBitis]         = useState(bugunStr)

    const donemUygula = (donem) => {
        const bugun = new Date()
        const fmt = d => d.toISOString().slice(0, 10)
        setKartDonem(donem)
        if (donem === "bugun") {
            setKartBaslangic(fmt(bugun)); setKartBitis(fmt(bugun))
        } else if (donem === "dun") {
            const d = new Date(bugun); d.setDate(d.getDate() - 1)
            setKartBaslangic(fmt(d)); setKartBitis(fmt(d))
        } else if (donem === "hafta") {
            const d = new Date(bugun); d.setDate(d.getDate() - 6)
            setKartBaslangic(fmt(d)); setKartBitis(fmt(bugun))
        } else if (donem === "ay") {
            const d = new Date(bugun.getFullYear(), bugun.getMonth(), 1)
            setKartBaslangic(fmt(d)); setKartBitis(fmt(bugun))
        }
    }

    const panelRef = useRef(null)
    const formScrollRef = useRef(null)

    const veriYukle = () => {
        Promise.all([
            axios.get(`${API}/hareketler/?limit=2000`),
            axios.get(`${API}/urunler/`),
            axios.get(`${API}/hareketler/toplam`)
        ]).then(([hr, ur, top]) => {
            setHareketler(hr.data)
            setUrunler(ur.data)
            setIstatistik(top.data)
            setYukleniyor(false)
        })
    }

    useEffect(() => { veriYukle() }, [refreshKey])

    // Panel açılınca scroll'u sıfırla
    useEffect(() => {
        if (panelAcik && formScrollRef.current) {
            formScrollRef.current.scrollTop = 0
        }
    }, [panelAcik])

    // panel dışına tıklayınca kapat
    useEffect(() => {
        function dışarı(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) setPanelAcik(false)
        }
        if (panelAcik) document.addEventListener("mousedown", dışarı)
        return () => document.removeEventListener("mousedown", dışarı)
    }, [panelAcik])

    const panelAc = (hareket = null) => {
        if (hareket) {
            setDuzenleme(hareket.hareket_id)
            // Eski plain-text aciklama ("Satış" gibi) varsa form'a taşıma
            const yeniFormat = hareket.fatura_no || hareket.tedarikci_musteri
            setForm({
                urun_id: hareket.urun_id,
                hareket_tipi: hareket.hareket_tipi,
                miktar: hareket.miktar,
                birim_fiyat: hareket.birim_fiyat || "",
                tarih: hareket.tarih,
                fatura_no: hareket.fatura_no || "",
                tedarikci_musteri: hareket.tedarikci_musteri || "",
                aciklama: yeniFormat ? (hareket.aciklama || "") : ""
            })
        } else {
            setDuzenleme(null)
            setForm(BOŞ_FORM)
        }
        setPanelAcik(true)
    }

    const formDegistir = (alan, deger) => {
        setForm(f => {
            const yeni = { ...f, [alan]: deger }
            // Ürün seçilince birim fiyatı otomatik doldur
            if (alan === "urun_id" || alan === "hareket_tipi") {
                const urun = urunler.find(u => u.urun_id === parseInt(yeni.urun_id))
                if (urun) {
                    yeni.birim_fiyat = yeni.hareket_tipi === "cikis"
                        ? urun.satis_fiyati : urun.maliyet_fiyati
                }
            }
            return yeni
        })
    }

    const bildirimGoster = (mesaj, tip = "basari") => {
        setBildirim({ mesaj, tip })
        setTimeout(() => setBildirim(null), 3000)
    }

    const kaydet = async () => {
        if (!form.urun_id) { bildirimGoster("Lütfen bir ürün seçin", "hata"); return }
        if (!form.miktar || parseFloat(form.miktar) <= 0) { bildirimGoster("Geçerli bir miktar girin", "hata"); return }
        setKayitYukleniyor(true)
        try {
            if (duzenleMe) {
                await axios.put(`${API}/hareketler/${duzenleMe}`, {
                    hareket_tipi: form.hareket_tipi,
                    miktar: parseFloat(form.miktar),
                    birim_fiyat: parseFloat(form.birim_fiyat) || null,
                    tarih: form.tarih,
                    fatura_no: form.fatura_no,
                    tedarikci_musteri: form.tedarikci_musteri,
                    aciklama: form.aciklama
                })
                bildirimGoster("Hareket güncellendi")
            } else {
                await axios.post(`${API}/hareketler/`, {
                    urun_id: parseInt(form.urun_id),
                    hareket_tipi: form.hareket_tipi,
                    miktar: parseFloat(form.miktar),
                    birim_fiyat: parseFloat(form.birim_fiyat) || null,
                    tarih: form.tarih,
                    fatura_no: form.fatura_no,
                    tedarikci_musteri: form.tedarikci_musteri,
                    aciklama: form.aciklama
                })
                bildirimGoster("Hareket eklendi")
            }
            setPanelAcik(false)
            setRefreshKey(k => k + 1)
        } catch (err) {
            const detail = err.response?.data?.detail
            let msg = "Hata oluştu"
            if (typeof detail === "string") msg = detail
            else if (Array.isArray(detail)) msg = detail.map(d => d.msg).join(", ")
            else if (err.message) msg = err.message
            bildirimGoster(msg, "hata")
        }
        setKayitYukleniyor(false)
    }

    const sil = async (id) => {
        try {
            await axios.delete(`${API}/hareketler/${id}`)
            setSilOnay(null)
            bildirimGoster("Hareket silindi")
            setRefreshKey(k => k + 1)
        } catch {
            bildirimGoster("Silinemedi", "hata")
        }
    }

    // Filtrelenmiş + sıralı liste
    const filtreliHareketler = hareketler
        .filter(h => {
            const q = aramaMetni.toLowerCase()
            const aramaTamam = !aramaMetni ||
                h.urun_adi?.toLowerCase().includes(q) ||
                h.fatura_no?.toLowerCase().includes(q) ||
                h.tedarikci_musteri?.toLowerCase().includes(q)
            const tipTamam    = tipFiltre === "tumu" || h.hareket_tipi === tipFiltre
            const tarihTamam  = (!tarihBaslangic || h.tarih >= tarihBaslangic) &&
                                (!tarihBitis     || h.tarih <= tarihBitis)
            return aramaTamam && tipTamam && tarihTamam
        })
        .sort((a, b) => {
            if (siralama === "tarih_desc") return b.tarih.localeCompare(a.tarih) || b.hareket_id - a.hareket_id
            if (siralama === "tarih_asc") return a.tarih.localeCompare(b.tarih) || a.hareket_id - b.hareket_id
            if (siralama === "urun_asc") return a.urun_adi.localeCompare(b.urun_adi, "tr")
            if (siralama === "urun_desc") return b.urun_adi.localeCompare(a.urun_adi, "tr")
            return b.hareket_id - a.hareket_id
        })

    // KPI istatistikleri — seçili döneme göre
    const donemGiris = hareketler.filter(h => h.tarih >= kartBaslangic && h.tarih <= kartBitis && h.hareket_tipi === "giris")
    const donemCikis = hareketler.filter(h => h.tarih >= kartBaslangic && h.tarih <= kartBitis && h.hareket_tipi === "cikis")
    const bugunGiris      = donemGiris   // alias — geri kalan kod bugunGiris/bugunCikis kullanıyor
    const bugunCikis      = donemCikis
    const bugunGirisAdet  = donemGiris.reduce((s, h) => s + h.miktar, 0)
    const bugunCikisAdet  = donemCikis.reduce((s, h) => s + h.miktar, 0)
    const bugunAlimTutar  = donemGiris.reduce((s, h) => s + h.miktar * (h.birim_fiyat || 0), 0)
    const bugunSatisTutar = donemCikis.reduce((s, h) => s + h.miktar * (h.birim_fiyat || 0), 0)
    const bugunKar        = bugunSatisTutar - bugunAlimTutar

    // Ürün bazlı gruplama
    const grupla = (liste) => Object.values(
        liste.reduce((acc, h) => {
            if (!acc[h.urun_adi]) acc[h.urun_adi] = { urun_adi: h.urun_adi, birim: h.birim, miktar: 0, tutar: 0 }
            acc[h.urun_adi].miktar += h.miktar
            acc[h.urun_adi].tutar  += h.miktar * (h.birim_fiyat || 0)
            return acc
        }, {})
    ).sort((a, b) => b.miktar - a.miktar)

    const bugunGirisDetay = grupla(bugunGiris)
    const bugunCikisDetay = grupla(bugunCikis)

    // Hareketler kartı için: giriş ve çıkışları tip etiketiyle birleştir, ürün başına özet
    const bugunTumDetay = Object.values(
        [...bugunGiris, ...bugunCikis].reduce((acc, h) => {
            const key = `${h.urun_adi}-${h.hareket_tipi}`
            if (!acc[key]) acc[key] = { urun_adi: h.urun_adi, birim: h.birim, tip: h.hareket_tipi, miktar: 0 }
            acc[key].miktar += h.miktar
            return acc
        }, {})
    ).sort((a, b) => b.miktar - a.miktar)

    // Grafik verisi — döneme göre günlük / haftalık / aylık gruplama
    const grafikVerisi = (() => {
        const fmt      = d => d.toISOString().slice(0, 10)
        const ayKisa   = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"]
        const bugun    = new Date()

        const topla = (liste) => ({
            alim:  liste.filter(h => h.hareket_tipi === "giris").reduce((s, h) => s + h.miktar * (h.birim_fiyat || 0), 0),
            satis: liste.filter(h => h.hareket_tipi === "cikis").reduce((s, h) => s + h.miktar * (h.birim_fiyat || 0), 0),
        })

        // Günlük gruplama (3G, 7G, 14G, 1A)
        const gunlukVeri = (gunSayisi) => {
            const sonuc = []
            for (let i = gunSayisi - 1; i >= 0; i--) {
                const d = new Date(bugun); d.setDate(d.getDate() - i)
                const tarih = fmt(d)
                const gun = hareketler.filter(h => h.tarih === tarih)
                const { alim, satis } = topla(gun)
                const etiket = gunSayisi <= 14
                    ? `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`
                    : `${d.getDate()} ${ayKisa[d.getMonth()]}`
                sonuc.push({ tarih: etiket, Alım: Math.round(alim), Satış: Math.round(satis), Net: Math.round(satis - alim) })
            }
            return sonuc
        }

        // Haftalık gruplama (3A, 6A)
        const haftalikVeri = (haftaSayisi) => {
            const sonuc = []
            for (let i = haftaSayisi - 1; i >= 0; i--) {
                const haftaSonu = new Date(bugun); haftaSonu.setDate(haftaSonu.getDate() - i * 7)
                const haftaBas  = new Date(haftaSonu); haftaBas.setDate(haftaBas.getDate() - 6)
                const bas = fmt(haftaBas), son = fmt(haftaSonu)
                const hafta = hareketler.filter(h => h.tarih >= bas && h.tarih <= son)
                const { alim, satis } = topla(hafta)
                const etiket = `${haftaBas.getDate()} ${ayKisa[haftaBas.getMonth()]}`
                sonuc.push({ tarih: etiket, Alım: Math.round(alim), Satış: Math.round(satis), Net: Math.round(satis - alim) })
            }
            return sonuc
        }

        // Aylık gruplama (1Y)
        const aylikVeri = (aySayisi) => {
            const sonuc = []
            for (let i = aySayisi - 1; i >= 0; i--) {
                const d = new Date(bugun.getFullYear(), bugun.getMonth() - i, 1)
                const ayBas = fmt(d)
                const ayson = new Date(d.getFullYear(), d.getMonth() + 1, 0)
                const ay = hareketler.filter(h => h.tarih >= ayBas && h.tarih <= fmt(ayson))
                const { alim, satis } = topla(ay)
                const etiket = `${ayKisa[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
                sonuc.push({ tarih: etiket, Alım: Math.round(alim), Satış: Math.round(satis), Net: Math.round(satis - alim) })
            }
            return sonuc
        }

        switch (grafikDonem) {
            case "3g":  return gunlukVeri(3)
            case "7g":  return gunlukVeri(7)
            case "14g": return gunlukVeri(14)
            case "1a":  return gunlukVeri(30)
            case "3a":  return haftalikVeri(13)
            case "6a":  return haftalikVeri(26)
            case "1y":  return aylikVeri(12)
            default:    return gunlukVeri(14)
        }
    })()

    const seciliUrun = urunler.find(u => u.urun_id === parseInt(form.urun_id))

    return (
        <div className="space-y-6">

            {/* Bildirim */}
            {bildirim && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all
                    ${bildirim.tip === "hata" ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}>
                    {bildirim.mesaj}
                </div>
            )}

            {/* Başlık */}
            <div className="flex items-end justify-between">
                <div className="flex items-end gap-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stok Hareketleri</h1>
                        <p className="text-sm text-gray-400 mt-1">Stok giriş ve çıkışlarını kaydedin, geçmiş hareketleri yönetin.</p>
                    </div>
                    <button onClick={() => panelAc()}
                        className="flex items-center gap-2.5 px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-blue-200 dark:shadow-blue-900/50 transition-all mb-0.5">
                        <Plus size={18} strokeWidth={2.5} />
                        <span>Hareket Ekle</span>
                    </button>
                </div>
            </div>

            {/* Dönem seçici */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1 rounded-xl shadow-sm">
                    {[
                        ["bugun", "Bugün"],
                        ["dun",   "Dün"],
                        ["hafta", "Son 7 Gün"],
                        ["ay",    "Bu Ay"],
                    ].map(([val, label]) => (
                        <button key={val} onClick={() => donemUygula(val)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                ${kartDonem === val
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
                            {label}
                        </button>
                    ))}
                    <button onClick={() => setKartDonem("ozel")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                            ${kartDonem === "ozel"
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
                        Özel
                    </button>
                </div>

                {kartDonem === "ozel" && (
                    <div className="flex items-center gap-2">
                        <input type="date" value={kartBaslangic}
                            onChange={e => setKartBaslangic(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 transition-colors" />
                        <span className="text-xs text-gray-400">—</span>
                        <input type="date" value={kartBitis}
                            onChange={e => setKartBitis(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 transition-colors" />
                    </div>
                )}

                <span className="text-xs text-gray-400 ml-1">
                    {kartDonem === "ozel"
                        ? `${kartBaslangic} – ${kartBitis}`
                        : kartDonem === "bugun" ? new Date().toLocaleDateString("tr-TR", { weekday:"long", day:"numeric", month:"long" })
                        : kartDonem === "dun"   ? new Date(Date.now()-86400000).toLocaleDateString("tr-TR", { day:"numeric", month:"long" })
                        : kartDonem === "hafta" ? "Son 7 gün"
                        : new Date().toLocaleDateString("tr-TR", { month:"long", year:"numeric" })
                    }
                </span>
            </div>

            {/* 4 KPI kartı */}
            {(() => {
            const donemEtiketi = kartDonem === "bugun" ? "Bugün"
                : kartDonem === "dun"   ? "Dün"
                : kartDonem === "hafta" ? "Son 7 Gün"
                : kartDonem === "ay"    ? "Bu Ay"
                : "Seçilen Dönem"
            return (
            <div className="grid grid-cols-4 gap-4 items-start">

                {/* Dönem Hareketler */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{donemEtiketi} — Hareketler</p>
                        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <ArrowLeftRight size={15} className="text-blue-600" />
                        </div>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{bugunGiris.length + bugunCikis.length}</p>
                        <p className="text-xs text-gray-400 pb-0.5">işlem</p>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                            <ArrowDownCircle size={11} /> {Math.round(bugunGirisAdet).toLocaleString("tr-TR")} giriş
                        </span>
                        <span className="text-gray-200 dark:text-gray-700">·</span>
                        <span className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 font-medium">
                            <ArrowUpCircle size={11} /> {Math.round(bugunCikisAdet).toLocaleString("tr-TR")} çıkış
                        </span>
                    </div>
                    {bugunTumDetay.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1.5 max-h-36 overflow-y-auto">
                            {bugunTumDetay.slice(0, 6).map((r, i) => (
                                <div key={i} className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1">{r.urun_adi}</span>
                                    <span className={`text-xs font-semibold shrink-0 ${r.tip === "giris" ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                                        {r.tip === "giris" ? "↓" : "↑"} {Math.round(r.miktar).toLocaleString("tr-TR")} {r.birim}
                                    </span>
                                </div>
                            ))}
                            {bugunTumDetay.length > 6 && (
                                <p className="text-xs text-gray-400 pt-0.5">+{bugunTumDetay.length - 6} ürün daha</p>
                            )}
                        </div>
                    )}
                    {bugunTumDetay.length === 0 && (
                        <p className="text-xs text-gray-300 dark:text-gray-600 border-t border-gray-100 dark:border-gray-700 pt-3">Bugün hareket yok</p>
                    )}
                </div>

                {/* Bugün Alım */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{donemEtiketi} — Alım</p>
                        <div className="w-8 h-8 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <TrendingDown size={15} className="text-green-600" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                        {bugunAlimTutar > 0 ? `₺${Math.round(bugunAlimTutar).toLocaleString("tr-TR")}` : "—"}
                    </p>
                    <p className="text-xs text-gray-400 mb-3">
                        {bugunGiris.length} fatura · {Math.round(bugunGirisAdet).toLocaleString("tr-TR")} adet
                    </p>
                    {bugunGirisDetay.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1.5 max-h-36 overflow-y-auto">
                            {bugunGirisDetay.slice(0, 6).map((r, i) => (
                                <div key={i} className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1">{r.urun_adi}</span>
                                    <div className="text-right shrink-0">
                                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                                            {Math.round(r.miktar).toLocaleString("tr-TR")} {r.birim}
                                        </span>
                                        {r.tutar > 0 && (
                                            <span className="text-xs text-gray-400 ml-1.5">₺{Math.round(r.tutar).toLocaleString("tr-TR")}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {bugunGirisDetay.length > 6 && (
                                <p className="text-xs text-gray-400 pt-0.5">+{bugunGirisDetay.length - 6} ürün daha</p>
                            )}
                        </div>
                    )}
                    {bugunGirisDetay.length === 0 && (
                        <p className="text-xs text-gray-300 dark:text-gray-600 border-t border-gray-100 dark:border-gray-700 pt-3">Bugün alım yok</p>
                    )}
                </div>

                {/* Bugün Satış */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{donemEtiketi} — Satış</p>
                        <div className="w-8 h-8 bg-orange-50 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                            <TrendingUp size={15} className="text-orange-500" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                        {bugunSatisTutar > 0 ? `₺${Math.round(bugunSatisTutar).toLocaleString("tr-TR")}` : "—"}
                    </p>
                    <p className="text-xs text-gray-400 mb-3">
                        {bugunCikis.length} fatura · {Math.round(bugunCikisAdet).toLocaleString("tr-TR")} adet
                    </p>
                    {bugunCikisDetay.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1.5 max-h-36 overflow-y-auto">
                            {bugunCikisDetay.slice(0, 6).map((r, i) => (
                                <div key={i} className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1">{r.urun_adi}</span>
                                    <div className="text-right shrink-0">
                                        <span className="text-xs font-semibold text-orange-500 dark:text-orange-400">
                                            {Math.round(r.miktar).toLocaleString("tr-TR")} {r.birim}
                                        </span>
                                        {r.tutar > 0 && (
                                            <span className="text-xs text-gray-400 ml-1.5">₺{Math.round(r.tutar).toLocaleString("tr-TR")}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {bugunCikisDetay.length > 6 && (
                                <p className="text-xs text-gray-400 pt-0.5">+{bugunCikisDetay.length - 6} ürün daha</p>
                            )}
                        </div>
                    )}
                    {bugunCikisDetay.length === 0 && (
                        <p className="text-xs text-gray-300 dark:text-gray-600 border-t border-gray-100 dark:border-gray-700 pt-3">Bugün satış yok</p>
                    )}
                </div>

                {/* Tahmini Günlük Kar */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tahmini {donemEtiketi} Kâr</p>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                            ${bugunKar >= 0 ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-red-50 dark:bg-red-900/30"}`}>
                            <Package size={15} className={bugunKar >= 0 ? "text-emerald-600" : "text-red-500"} />
                        </div>
                    </div>
                    <p className={`text-2xl font-bold mb-1 ${bugunKar >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                        {(bugunAlimTutar + bugunSatisTutar) === 0
                            ? "—"
                            : `${bugunKar >= 0 ? "+" : ""}₺${Math.round(bugunKar).toLocaleString("tr-TR")}`
                        }
                    </p>
                    <p className="text-xs text-gray-400 mb-3">Satış − alım tutarı ({donemEtiketi.toLowerCase()})</p>
                    {(bugunAlimTutar + bugunSatisTutar) > 0 && (
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Alım maliyeti</span>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">−₺{Math.round(bugunAlimTutar).toLocaleString("tr-TR")}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Satış geliri</span>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">+₺{Math.round(bugunSatisTutar).toLocaleString("tr-TR")}</span>
                            </div>
                            {bugunAlimTutar > 0 && bugunSatisTutar > 0 && (
                                <div className="flex items-center justify-between pt-1 border-t border-dashed border-gray-100 dark:border-gray-700">
                                    <span className="text-xs text-gray-400">Kar marjı</span>
                                    <span className={`text-xs font-bold ${bugunKar >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                                        %{Math.round((bugunKar / bugunSatisTutar) * 100)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                    {(bugunAlimTutar + bugunSatisTutar) === 0 && (
                        <p className="text-xs text-gray-300 dark:text-gray-600 border-t border-gray-100 dark:border-gray-700 pt-3">{donemEtiketi} için işlem yok</p>
                    )}
                </div>

            </div>
            )})()}

            {/* Grafik */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                {/* Grafik başlık + dönem seçici */}
                <div className="flex items-start justify-between mb-5 gap-4">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Alım / Satış / Net Kâr
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {grafikDonem === "3g"  ? "Son 3 gün — günlük"  :
                             grafikDonem === "7g"  ? "Son 7 gün — günlük"  :
                             grafikDonem === "14g" ? "Son 14 gün — günlük" :
                             grafikDonem === "1a"  ? "Son 30 gün — günlük" :
                             grafikDonem === "3a"  ? "Son 3 ay — haftalık" :
                             grafikDonem === "6a"  ? "Son 6 ay — haftalık" :
                                                    "Son 1 yıl — aylık"}
                            {" "}· tutar bazlı (₺)
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {/* Dönem butonları */}
                        <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                            {[
                                ["3g","3G"], ["7g","7G"], ["14g","14G"],
                                ["1a","1A"], ["3a","3A"], ["6a","6A"], ["1y","1Y"]
                            ].map(([val, label]) => (
                                <button key={val} onClick={() => setGrafikDonem(val)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                                        ${grafikDonem === val
                                            ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                                            : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />Alım</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />Satış</span>
                            <span className="flex items-center gap-1.5"><span className="w-6 border-t-2 border-violet-500 border-dashed inline-block" />Net Kâr</span>
                        </div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={grafikVerisi} barGap={3} margin={{ top: 10, right: 64, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gradAlim" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.75} />
                            </linearGradient>
                            <linearGradient id="gradSatis" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fb923c" stopOpacity={0.95} />
                                <stop offset="100%" stopColor="#f97316" stopOpacity={0.75} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="tarih" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        {/* Sol eksen — Alım / Satış bar'ları */}
                        <YAxis
                            yAxisId="left"
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                            axisLine={false} tickLine={false}
                            tickFormatter={fmtY}
                            width={52}
                        />
                        {/* Sağ eksen — Net Kâr çizgisi (bağımsız ölçek) */}
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 10, fill: "#a78bfa" }}
                            axisLine={false} tickLine={false}
                            tickFormatter={fmtY}
                            width={60}
                        />
                        <Tooltip content={<GrafikTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                        <ReferenceLine yAxisId="left"  y={0} stroke="#e5e7eb" strokeWidth={1} />
                        <ReferenceLine yAxisId="right" y={0} stroke="#c4b5fd" strokeWidth={1} strokeDasharray="3 5" strokeOpacity={0.5} />
                        <Bar dataKey="Alım"  yAxisId="left" fill="url(#gradAlim)"  radius={[4, 4, 0, 0]} maxBarSize={grafikDonem === "1y" ? 18 : grafikDonem === "3g" ? 36 : 22} />
                        <Bar dataKey="Satış" yAxisId="left" fill="url(#gradSatis)" radius={[4, 4, 0, 0]} maxBarSize={grafikDonem === "1y" ? 18 : grafikDonem === "3g" ? 36 : 22} />
                        <Line
                            dataKey="Net"
                            yAxisId="right"
                            type="monotone"
                            stroke="#8b5cf6"
                            strokeWidth={2.5}
                            strokeDasharray="5 3"
                            dot={(props) => {
                                const { cx, cy, payload } = props
                                if (!payload.Alım && !payload.Satış) return null
                                return (
                                    <circle
                                        key={cx}
                                        cx={cx} cy={cy} r={4}
                                        fill={payload.Net >= 0 ? "#8b5cf6" : "#ef4444"}
                                        stroke="white" strokeWidth={1.5}
                                    />
                                )
                            }}
                            activeDot={{ r: 6, fill: "#8b5cf6", stroke: "white", strokeWidth: 2 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Filtre bar + Tablo — Layout padding'ini de kullan (-mx-8) */}
            <div className="-mx-8">
                <div className="bg-white dark:bg-gray-800 shadow-sm border-y border-gray-100 dark:border-gray-700">

                    {/* Filtre bar */}
                    <div className="flex items-center flex-wrap px-8 py-3 border-b border-gray-100 dark:border-gray-700 gap-3">

                        {/* Arama */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 w-64">
                            <Search size={14} className="text-gray-400 shrink-0" />
                            <input type="text" value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
                                placeholder="Ürün, fatura, tedarikçi..."
                                className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full" />
                            {aramaMetni && <button onClick={() => setAramaMetni("")}><X size={13} className="text-gray-400" /></button>}
                        </div>

                        {/* Tip filtresi */}
                        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                            {[["tumu", "Tümü"], ["giris", "Giriş"], ["cikis", "Çıkış"]].map(([val, label]) => (
                                <button key={val} onClick={() => setTipFiltre(val)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                        ${tipFiltre === val ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Tarih filtresi */}
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                                {[["tumu","Tümü"],["bugun","Bugün"],["hafta","7 Gün"],["ay","Bu Ay"]].map(([val, label]) => (
                                    <button key={val} onClick={() => tarihDonemUygula(val)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                            ${tarihDonem === val ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Özel tarih aralığı */}
                            <div className="flex items-center gap-1.5">
                                <input type="date" value={tarihBaslangic}
                                    onChange={e => { setTarihBaslangic(e.target.value); setTarihDonem("ozel") }}
                                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 outline-none focus:border-blue-500 transition-colors" />
                                <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                                <input type="date" value={tarihBitis}
                                    onChange={e => { setTarihBitis(e.target.value); setTarihDonem("ozel") }}
                                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 outline-none focus:border-blue-500 transition-colors" />
                                {(tarihBaslangic || tarihBitis) && tarihDonem !== "tumu" && (
                                    <button onClick={() => tarihDonemUygula("tumu")}
                                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors">
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <p className="text-xs text-gray-400 ml-auto">
                            {(aramaMetni || tipFiltre !== "tumu" || tarihDonem !== "tumu")
                                ? `${filtreliHareketler.length} kayıt`
                                : `${istatistik.toplam.toLocaleString("tr-TR")} kayıt`}
                        </p>
                    </div>

                    {/* Tablo */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap pl-8">
                                        <button onClick={() => setSiralama(s => s === "tarih_desc" ? "tarih_asc" : "tarih_desc")}
                                            className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                                            Tarih {siralama === "tarih_desc" ? "↓" : siralama === "tarih_asc" ? "↑" : ""}
                                        </button>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                        <button onClick={() => setSiralama(s => s === "urun_asc" ? "urun_desc" : "urun_asc")}
                                            className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                                            Ürün {siralama === "urun_asc" ? "A→Z" : siralama === "urun_desc" ? "Z→A" : ""}
                                        </button>
                                    </th>
                                    {[["Tip","w-16"], ["Miktar",""], ["Birim Fiyat",""], ["Tutar",""], ["Fatura No",""], ["Tedarikçi / Müşteri",""], ["Açıklama",""], ["","w-16"]].map(([label, w]) => (
                                        <th key={label} className={`px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${w}`}>{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {yukleniyor && (
                                    <tr><td colSpan={10} className="px-8 py-10 text-center">
                                        <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                    </td></tr>
                                )}
                                {!yukleniyor && filtreliHareketler.length === 0 && (
                                    <tr><td colSpan={10} className="px-8 py-10 text-center text-sm text-gray-400">Kayıt bulunamadı</td></tr>
                                )}
                                {filtreliHareketler.slice(0, 100).map(h => {
                                    const tutar = h.miktar * (h.birim_fiyat || 0)
                                    return (
                                        <tr key={h.hareket_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap pl-8">{h.tarih}</td>
                                            <td className="px-3 py-2.5 max-w-[200px]">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{h.urun_adi}</p>
                                                <p className="text-xs text-gray-400">{h.kategori}</p>
                                            </td>
                                            <td className="px-3 py-2.5"><Rozet tip={h.hareket_tipi} /></td>
                                            <td className="px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                {h.miktar} {h.birim}
                                            </td>
                                            <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                {h.birim_fiyat ? `₺${h.birim_fiyat.toLocaleString("tr-TR")}` : "—"}
                                            </td>
                                            <td className="px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                {tutar > 0 ? `₺${Math.round(tutar).toLocaleString("tr-TR")}` : "—"}
                                            </td>
                                            <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                                                {h.fatura_no || <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 max-w-[180px] truncate">
                                                {h.tedarikci_musteri || <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-sm text-gray-400 max-w-[180px] truncate">
                                                {h.aciklama || <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2.5 pr-8">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => panelAc(h)}
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 transition-colors">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => setSilOnay(h.hareket_id)}
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

                </div>
            </div>

            {/* Silme Onay Modalı */}
            {silOnay && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-80">
                        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-2">Hareketi Sil</h3>
                        <p className="text-sm text-gray-500 mb-5">Bu hareket silinecek ve stok miktarı geri alınacak. Devam edilsin mi?</p>
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

            {/* Slide-over Panel */}
            {/* Karartma — navbar altından, içerik alanını örter */}
            <div
                className={`fixed top-16 left-0 right-0 bottom-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300
                    ${panelAcik ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                onClick={() => setPanelAcik(false)}
            />

            {/* Panel — navbar altından tam flush başlar */}
            <div className={`fixed top-16 right-0 h-[calc(100vh-4rem)] z-[65] transition-all duration-300
                ${panelAcik ? "pointer-events-auto" : "pointer-events-none"}`}>
                <div ref={panelRef}
                    className={`h-full w-[520px] bg-white dark:bg-gray-900 shadow-[-12px_0_40px_rgba(0,0,0,0.14)] flex flex-col transition-transform duration-300 ease-out
                        ${panelAcik ? "translate-x-0" : "translate-x-full"}`}>

                    {/* Panel Başlık */}
                    <div className={`px-7 pt-5 pb-5 border-b border-gray-100 dark:border-gray-700/80
                        ${form.hareket_tipi === "giris"
                            ? "bg-gradient-to-r from-green-50 to-white dark:from-green-900/20 dark:to-gray-900"
                            : "bg-gradient-to-r from-red-50 to-white dark:from-red-900/20 dark:to-gray-900"}`}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                                    {duzenleMe ? "Düzenleme Modu" : "Yeni Kayıt"}
                                </p>
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                                    {duzenleMe ? "Hareketi Düzenle" : form.hareket_tipi === "giris" ? "Stok Girişi" : "Stok Çıkışı"}
                                </h2>
                            </div>
                            <button onClick={() => setPanelAcik(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors mt-0.5">
                                <X size={17} className="text-gray-400" />
                            </button>
                        </div>
                    </div>

                    {/* Form */}
                    <div ref={formScrollRef} className="flex-1 overflow-y-auto px-7 py-6 space-y-6">

                        {/* Hareket Tipi */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Hareket Tipi</label>
                            <div className="grid grid-cols-2 gap-2.5">
                                {[
                                    ["giris", "Stok Girişi", <ArrowDownCircle size={16} />, "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 dark:border-green-600"],
                                    ["cikis", "Stok Çıkışı", <ArrowUpCircle size={16} />,   "border-red-400 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 dark:border-red-500"]
                                ].map(([val, label, icon, aktifStil]) => (
                                    <button key={val} onClick={() => formDegistir("hareket_tipi", val)}
                                        className={`flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 text-sm font-semibold transition-all
                                            ${form.hareket_tipi === val ? aktifStil : "border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"}`}>
                                        {icon}{label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Ürün */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Ürün *</label>
                            <select value={form.urun_id} onChange={e => formDegistir("urun_id", e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all">
                                <option value="">— Ürün seçin —</option>
                                {urunler.map(u => (
                                    <option key={u.urun_id} value={u.urun_id}>{u.urun_adi}</option>
                                ))}
                            </select>
                            {seciliUrun && (
                                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <Package size={12} className="text-gray-400 shrink-0" />
                                    <p className="text-xs text-gray-400">
                                        Mevcut stok: <span className="font-semibold text-gray-600 dark:text-gray-300">{seciliUrun.mevcut_stok} {seciliUrun.birim}</span>
                                        <span className="mx-1.5 text-gray-300">·</span>
                                        <span className="text-gray-400">{seciliUrun.kategori}</span>
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Miktar + Birim Fiyat */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                                    Miktar * {seciliUrun ? <span className="normal-case font-normal text-gray-400">({seciliUrun.birim})</span> : ""}
                                </label>
                                <input type="number" min="0" step="0.01" value={form.miktar}
                                    onChange={e => formDegistir("miktar", e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                                    placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Birim Fiyat (₺)</label>
                                <input type="number" min="0" step="0.01" value={form.birim_fiyat}
                                    onChange={e => formDegistir("birim_fiyat", e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                                    placeholder="Otomatik" />
                            </div>
                        </div>

                        {/* Tutar Önizleme */}
                        {form.miktar && form.birim_fiyat && (
                            <div className={`flex items-center justify-between rounded-2xl px-5 py-4 border
                                ${form.hareket_tipi === "giris"
                                    ? "bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800/40"
                                    : "bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800/40"}`}>
                                <div>
                                    <p className="text-xs text-gray-400 mb-0.5">Toplam Tutar</p>
                                    <p className={`text-xl font-bold ${form.hareket_tipi === "giris" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                        ₺{(parseFloat(form.miktar) * parseFloat(form.birim_fiyat)).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 mb-0.5">{parseFloat(form.miktar).toLocaleString("tr-TR")} {seciliUrun?.birim || "adet"}</p>
                                    <p className="text-xs text-gray-400">× ₺{parseFloat(form.birim_fiyat).toLocaleString("tr-TR")}</p>
                                </div>
                            </div>
                        )}

                        {/* Tarih */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Tarih *</label>
                            <input type="date" value={form.tarih} onChange={e => formDegistir("tarih", e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all" />
                        </div>

                        {/* Ayırıcı */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                            <p className="text-xs font-semibold text-gray-300 dark:text-gray-600 uppercase tracking-wider">İsteğe Bağlı</p>
                            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                        </div>

                        {/* Fatura No */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Fatura / İrsaliye No</label>
                            <input type="text" value={form.fatura_no} onChange={e => formDegistir("fatura_no", e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                                placeholder="FAT-2026-001" />
                        </div>

                        {/* Tedarikçi / Müşteri */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                                {form.hareket_tipi === "giris" ? "Tedarikçi Firma" : "Müşteri / Proje"}
                            </label>
                            <input type="text" value={form.tedarikci_musteri} onChange={e => formDegistir("tedarikci_musteri", e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                                placeholder={form.hareket_tipi === "giris" ? "ABC Yapı Malzemeleri A.Ş." : "Ahmet Bey inşaatı"} />
                        </div>

                        {/* Açıklama */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Açıklama / Not</label>
                            <textarea value={form.aciklama} onChange={e => formDegistir("aciklama", e.target.value)} rows={3}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all resize-none"
                                placeholder="Hasar, iade, kampanya vb. notlar..." />
                        </div>
                    </div>

                    {/* Panel Alt Butonlar */}
                    <div className="px-7 py-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 flex gap-3">
                        <button onClick={() => setPanelAcik(false)}
                            className="px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                            İptal
                        </button>
                        <button onClick={kaydet}
                            className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all cursor-pointer active:scale-95
                                ${kayıtYukleniyor ? "opacity-60 cursor-wait" : ""}
                                ${form.hareket_tipi === "giris"
                                    ? "bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 dark:shadow-green-900/40"
                                    : "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 dark:shadow-red-900/40"}`}>
                            {kayıtYukleniyor ? "Kaydediliyor..." : duzenleMe ? "Güncelle" : form.hareket_tipi === "giris" ? "✓  Girişi Kaydet" : "✓  Çıkışı Kaydet"}
                        </button>
                    </div>

                </div>
            </div>

        </div>
    )
}
