// 基础API地址配置
const API_BASE_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3000/api'
  : '/api';

// 构建API请求函数
async function request(url, options = {}) {
  // 构建完整的请求URL
  const fullUrl = `${API_BASE_URL}${url}`;

  // 默认请求配置
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json'
    }
  };

  // 合并用户配置和默认配置
  const config = { ...defaultOptions, ...options };

  // 发送网络请求
  const response = await fetch(fullUrl, config);

  // 解析JSON格式的响应体
  const data = await response.json();

  return data;
}

// 获取公共服务设施api
export async function getFacilities(bbox = null) {
  let url = '/facilities';  // 默认的API路径，与app.js中app.use('/api/facilities', facilitiesRoutes);保持一致

  // 如果提供了边界框,就添加到URL参数中
  if (bbox && bbox.length === 4) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    // 构建查询参数：bbox=minLng,minLat,maxLng,maxLat
    url += `?bbox=${minLng},${minLat},${maxLng},${maxLat}`;
  }

  return request(url);
}

// 获取土地利用api
export async function getLandUse(bbox = null) {
  let url = '/landUse';
  if (bbox && bbox.length === 4) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    url += `?bbox=${minLng},${minLat},${maxLng},${maxLat}`;
  }
  return request(url);
}

// 创建公共设施
export async function createFacility(facilityData) {
  return request('/facilities', {
    method: 'POST',
    body: JSON.stringify(facilityData)
  });
}

// 更新公共设施
export async function updateFacility(id, facilityData) {
  return request(`/facilities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(facilityData)
  });
}

// 删除公共设施
export async function deleteFacility(id) {
  return request(`/facilities/${id}`, {
    method: 'DELETE'
  });
}

// 创建土地利用数据
export async function createLandUse(landUseData) {
  return request('/landUse', {
    method: 'POST',
    body: JSON.stringify(landUseData)
  });
}

// 更新土地利用数据
export async function updateLandUse(id, landUseData) {
  return request(`/landUse/${id}`, {
    method: 'PUT',
    body: JSON.stringify(landUseData)
  });
}

// 删除图形
export async function deleteLandUse(id) {
  return request(`/landUse/${id}`, {
    method: 'DELETE'
  });
}