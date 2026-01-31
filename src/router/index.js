import { createRouter, createWebHistory } from 'vue-router'



import   swap   from "../views/swap/index.vue"
import   Liquidity  from "../views/Liquidity/index.vue"
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'swap',
      component: swap,
    },
    {
      path: '/Liquidity',
      name: 'Liquidity',
      component: Liquidity,
    },

  ],
  scrollBehavior(to, from, savedPosition) {
    // 处理滚动行为：如果有保存的滚动位置，则恢复到该位置，否则滚动到顶部
  
      return { top: 0 }; // 跳转时滚动到顶部
    
  },
});
export default router
