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

  // ==================== 地图交互共享状态 ====================
  // UI 控制状态
  const selectedFeature = ref(null);
  const popupPosition = ref(null);
  const showPointForm = ref(false);
  const showLandsForm = ref(false);
  const isDrawing = ref(false);
  const isEditing = ref(false);
  const originalGeometry = ref(null);

  // 表单数据
  const pointsForm = ref({ name: '', level: '', type: '', floor_area: null, scale: null });
  const landsForm = ref({ name: '', type: '', site_area: null });

  // 导入导出相关
  const importLayerType = ref(null);
  const importFeatures = ref([]);

  // 绘制过程临时变量（非响应式也可以用 ref，但不需要深层响应）
  const drawFeature = ref(null);
  const drawInteraction = ref(null);
  const drawLayer = ref(null);
  const drawHandlers = ref({ backspace: null, esc: null });

  // ==================== 地图交互 Actions ====================
  function setSelectedFeature(feature) {
    selectedFeature.value = feature;
  }

  function setPopupPosition(pos) {
    popupPosition.value = pos;
  }

  function closePopup() {
    selectedFeature.value = null;
    popupPosition.value = null;
  }

  function setShowPointForm(show) {
    showPointForm.value = show;
  }

  function setShowLandsForm(show) {
    showLandsForm.value = show;
  }

  function setIsDrawing(drawing) {
    isDrawing.value = drawing;
  }

  function setIsEditing(editing) {
    isEditing.value = editing;
  }

  function setOriginalGeometry(geom) {
    originalGeometry.value = geom;
  }

  function updatePointsForm(data) {
    pointsForm.value = { ...pointsForm.value, ...data };
  }

  function updateLandsForm(data) {
    landsForm.value = { ...landsForm.value, ...data };
  }

  function resetForms() {
    pointsForm.value = { name: '', level: '', type: '', floor_area: null, scale: null };
    landsForm.value = { name: '', type: '', site_area: null };
  }

  function setImportLayerType(type) {
    importLayerType.value = type;
  }

  function setImportFeatures(features) {
    importFeatures.value = features;
  }

  function clearImport() {
    importLayerType.value = null;
    importFeatures.value = [];
  }

  function setDrawFeature(feature) {
    drawFeature.value = feature;
  }

  function setDrawInteraction(interaction) {
    drawInteraction.value = interaction;
  }

  function setDrawLayer(layer) {
    drawLayer.value = layer;
  }

  function setDrawHandler(key, handler) {
    drawHandlers.value[key] = handler;
  }

  function clearDrawHandlers() {
    drawHandlers.value = { backspace: null, esc: null };
  }

  // 退出编辑模式（由 useFeature 调用后更新 Store）
  function exitEditMode() {
    isEditing.value = false;
    originalGeometry.value = null;
  }

  return {
    // 设施点与设施用地
    points,
    loadPoints,
    lands,
    loadLands,

    // UI状态
    selectedFeature,
    popupPosition,
    showPointForm,
    showLandsForm,
    isDrawing,
    isEditing,
    originalGeometry,

    // 表单数据
    pointsForm,
    landsForm,

    // 导入导出
    importLayerType,
    importFeatures,

    // 绘制临时变量
    drawFeature,
    drawInteraction,
    drawLayer,
    drawHandlers,

    // Actions
    setSelectedFeature,
    setPopupPosition,
    closePopup,
    setShowPointForm,
    setShowLandsForm,
    setIsDrawing,
    setIsEditing,
    setOriginalGeometry,
    updatePointsForm,
    updateLandsForm,
    resetForms,
    setImportLayerType,
    setImportFeatures,
    clearImport,
    setDrawFeature,
    setDrawInteraction,
    setDrawLayer,
    setDrawHandler,
    clearDrawHandlers,
    exitEditMode,
  }
})