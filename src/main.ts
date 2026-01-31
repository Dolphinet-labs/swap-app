import { Buffer } from 'buffer'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { WagmiPlugin } from '@wagmi/vue'
import { createApp } from 'vue'
import router from './router'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/display.css'
import './styles/global.scss'
import i18n from "./languages"
// `@coinbase-wallet/sdk` uses `Buffer`
globalThis.Buffer = Buffer
import Vue3Marquee from 'vue3-marquee'
import App from './App.vue'
// import './style.css'
import { config } from './wagmi'

// import "./utils/font.js"


let loadingPercent = 1
const percentDom = document.getElementById('loading-percent')
const mask = document.getElementById('global-loading-mask')
let loadingInterval = setInterval(() => {
  loadingPercent += 1
  if (loadingPercent > 100) loadingPercent = 100
  percentDom.textContent = loadingPercent + '%'
  if (loadingPercent >= 100) {
    clearInterval(loadingInterval)
    // 等待进度到 100% 后，允许下面的 Vue 挂载
    afterLoadingReady = true
    checkMount()
  }
}, 2)

let afterLoadingReady = false
let vueMounted = false
function checkMount() {
  // 只有两个条件都满足，才执行遮罩隐藏
  if (afterLoadingReady && vueMounted) {
    mask.style.transition = 'opacity .36s'
    mask.style.opacity = '0'
    setTimeout(() => mask.remove(), 380)
  }
}

// 模拟递增

const app = createApp(App)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}
app.use(ElementPlus)
app.use(WagmiPlugin, { config }).use(VueQueryPlugin, {})
app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(Vue3Marquee)

app.mount('#app')


new WOW({
    boxClass: 'wow',              // 动画元素的类
    animateClass: 'animate__animated',  // 动画效果类名
    offset: 100,                  // 设置触发动画的滚动偏移量
    mobile: true,                 // 是否启用移动端动画
    live: true,                   // 动态加载的内容是否启用动画
}).init();

vueMounted = true
checkMount()