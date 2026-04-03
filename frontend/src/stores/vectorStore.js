// 引入Pinia和Vue响应式API
import { defineStore } from "pinia";
import { ref } from "vue";

// 引入API服务-与后端通信
import { getPoints, getLands } from "../services/api";

// 导出地图数据仓库
export const useVectorStore = defineStore('vectorStore', () => {
  const points = ref([]);
  const lands = ref([]);

  // 创建异步函数加载公共服务设施数据
  async function loadPoints() {
    // 调用API服务
    const response = await getPoints();

    // 接收后端返回的设施数据
    points.value = response.data;
  }

  // 创建异步函数加载土地利用数据
  async function loadLands() {
    const response = await getLands();
    lands.value = response.data;
  }

  return { points, loadPoints, lands, loadLands };
})