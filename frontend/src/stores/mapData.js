// 引入Pinia和Vue响应式API
import { defineStore } from "pinia";
import { ref } from "vue";

// 引入API服务-与后端通信
import { getFacilities, getLandUse } from "../services/api";

// 导出地图数据仓库
export const useMapDataStore = defineStore('mapData', () => {
  const facilities = ref([]);
  const landUse = ref([]);

  // 创建异步函数加载公共服务设施数据
  async function loadFacilities(bbox = null) {
    // 调用API服务，传递bbox参数
    const response = await getFacilities(bbox);

    // 接收后端返回的设施数据
    facilities.value = response.data;
  }

  // 创建异步函数加载土地利用数据
  async function loadLandUse(bbox = null) {
    const response = await getLandUse(bbox);
    landUse.value = response.data;
  }

  return { facilities, loadFacilities, landUse, loadLandUse };
})