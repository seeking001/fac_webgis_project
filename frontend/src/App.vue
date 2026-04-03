<template>
  <div id="app">
    <h1>龙华区公共设施规划管理系统</h1>
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
  position: fixed;
  top: 0;
  width: 400px;
  height: 45px;
  text-align: center;
  left: 50%;
  transform: translate(-50%, 0);
  color: #306;
  font-size: 28px;
  font-weight: 600;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
  z-index: 10;
}
</style>