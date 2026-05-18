// 基础 API 地址：开发环境用本地后端，生产环境用同域 /api
const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:3000/api'
  : '/api';

// 通用请求封装
async function request(url, options = {}) {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return response.json();
}

// ==================== 设施点 CRUD ====================
export async function getPoints() {
  return request('/points')
}
export async function createPoints(data) {
  return request('/points', { method: 'POST', body: JSON.stringify(data) })
}
export async function updatePoints(id, data) {
  return request(`/points/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}
export async function deletePoints(id) {
  return request(`/points/${id}`, { method: 'DELETE' })
}

// ==================== 设施用地 CRUD ====================
export async function getLands() {
  return request('/lands')
}
export async function createLands(data) {
  return request('/lands', { method: 'POST', body: JSON.stringify(data) })
}
export async function updateLands(id, data) {
  return request(`/lands/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}
export async function deleteLands(id) {
  return request(`/lands/${id}`, { method: 'DELETE' })
}

// ==================== 供需分析 ====================
export async function getEducationSupply() {
  return request('/analysis/education-supply')
}
export async function getRecommendedSites(type, radius) {
  return request(`/analysis/recommend-sites?type=${type}&radius=${radius}`)
}
