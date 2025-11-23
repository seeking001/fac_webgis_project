// 引入Vue核心库
import { createApp } from 'vue'
// 引入根组件
import App from './App.vue'
// 引入pinia
import { createPinia } from 'pinia'
// 引入全局样式
import './style.css'

const app = createApp(App)
app.use(createPinia())

app.mount('#app')