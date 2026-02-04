<template>
  <div id="app">
    <h1>龙华区公共服务设施规划管理系统</h1>
    <Map/>
  </div>
</template>

<script setup>
import Map from './components/Map.vue';
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

h1 {
  position: absolute;
  top: 0;
  width: 35%;
  height: 45px;
  text-align: center;
  left: 50%;
  transform: translate(-50%, 0);
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 0 0 15px 15px;
  color: #306;
  font-size: 28px;
  font-weight: 800;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.9);
  z-index: 100;
}
</style>