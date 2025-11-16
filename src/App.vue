
<script setup>
import  navBar  from "./components/navBar.vue"

</script>

<template>
  <navBar/>
  <RouterView />
  <!-- <bottomBar/> -->
</template>

<style scoped lang="scss">
/* 全局移动端适配样式 */
:global(body) {
  /* 防止页面水平滚动 */
  overflow-x: hidden;

  /* 确保在移动端正确显示 */
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;

  /* 移动端字体平滑 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 移动端视口适配 */
:global(#app) {
  min-height: 100vh;
  display: flex;
  flex-direction: column;

  /* 移动端安全区域适配 */
  @supports (padding: max(0px)) {
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}

/* 移动端响应式设计 */
@media (max-width: 768px) {
  :global(#app) {
    /* 移动端全屏布局 */
    width: 100vw;
    min-height: 100vh;
  }

  /* 确保导航栏在移动端正确显示 */
  :global(.header) {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;

    /* iOS Safari 安全区域适配 */
    @supports (padding: max(0px)) {
      padding-top: env(safe-area-inset-top);
    }
  }

  /* 内容区域适配 */
  :global(.contents) {
    /* 确保内容不会被导航栏遮挡 */
    padding-top: 80px; /* 根据导航栏高度调整 */

    /* iOS Safari 安全区域适配 */
    @supports (padding: max(0px)) {
      padding-top: calc(80px + env(safe-area-inset-top));
    }
  }
}

/* 小屏幕设备优化 */
@media (max-width: 480px) {
  :global(.contents) {
    padding-top: 70px;

    @supports (padding: max(0px)) {
      padding-top: calc(70px + env(safe-area-inset-top));
    }
  }
}

/* 防止iOS Safari的弹性滚动 */
@media screen and (max-width: 768px) {
  :global(body) {
    position: fixed;
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }

  :global(#app) {
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }
}

/* 横屏适配 */
@media screen and (orientation: landscape) and (max-height: 500px) {
  :global(.contents) {
    padding-top: 60px;

    @supports (padding: max(0px)) {
      padding-top: calc(60px + env(safe-area-inset-top));
    }
  }

  :global(.swap-card) {
    max-width: 90%;
    margin: 0 auto;
  }
}
</style>
