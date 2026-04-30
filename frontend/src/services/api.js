import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

export const urunlerAPI = {
  listele: ()          => api.get('/urunler/'),
  detay:   (id)        => api.get(`/urunler/${id}`),
}

export const analitikAPI = {
  dashboard: ()          => api.get('/analitik/dashboard'),
  tahmin:    (id, gun)   => api.get(`/analitik/tahmin/${id}?gun=${gun}`),
  eoq:       (id)        => api.get(`/analitik/eoq/${id}`),
}

export default api
