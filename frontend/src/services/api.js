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
    Headers: {
      'Content-Type': 'application/json'
    }
  };

  // 合并用户配置和默认配置
  const config = { ...defaultOptions, ...options };

  // 发送网络请求
  const response = await fatch(fullUrl, config);

  // 解析JSON格式的响应体
  const data = await response.json();

  return data;
}

// 导出公共服务设施的api
export async function getFacilities(bbox = null) {
  let url = '/facilities';

  // 如果提供了边界框,就添加到URL参数中
  if (bbox && bbox.length === 4) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    url += `?bbox=${minLng},${minLat},${maxLng},${maxLat}`;
  }

  return request(usr);
}