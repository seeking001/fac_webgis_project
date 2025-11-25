// 引入Pinia和Vue响应式API
import { defineStore } from "pinia";
import { ref } from "vue";

// 引入API服务-与后端通信
import { getFacilities } from "../services/api";

// 导出地图数据仓库
export const useMapDataStore = defineStore('mapData', () => {
  const facilities = ref([]);

  // 创建异步函数加载公共服务设施数据
  async function loadFacilities(bbox = null) {
    const response = await getFacilities(bbox);
    facilities.value = response.data;
  }

  return { facilities, loadFacilities };
})