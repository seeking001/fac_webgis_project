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
export async function getPoints() {
  // 默认的API路径，与app.js中app.use('/api/points', pointsRoutes)保持一致
  return request('/points')
}

// 创建公共设施
export async function createPoints(pointData) {
  return request('/points', {
    method: 'POST',
    body: JSON.stringify(pointData)
  });
}

// 更新公共设施
export async function updatePoints(id, pointData) {
  return request(`/points/${id}`, {
    method: 'PUT',
    body: JSON.stringify(pointData)
  });
}

// 删除公共设施
export async function deletePoints(id) {
  return request(`/points/${id}`, {
    method: 'DELETE'
  });
}


// 获取土地利用api
export async function getLands() {
  return request('/lands')
}

// 创建土地利用数据
export async function createLands(landsData) {
  return request('/lands', {
    method: 'POST',
    body: JSON.stringify(landsData)
  });
}

// 更新土地利用数据
export async function updateLands(id, landsData) {
  return request(`/lands/${id}`, {
    method: 'PUT',
    body: JSON.stringify(landsData)
  });
}

// 删除图形
export async function deleteLands(id) {
  return request(`/lands/${id}`, {
    method: 'DELETE'
  });
}