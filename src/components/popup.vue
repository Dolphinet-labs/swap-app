<template>
  <div class="overlay" :class="{ active: visible }" @click.self="closePopup">
    <div class="decorative-circle circle-1"></div>
    <div class="decorative-circle circle-2"></div>
    <div class="popup">
      <div class="loading-container">
        <div class="loading-circle"></div>
        <div class="loading-dot"></div>
      </div>
      <h1 class="title"> {{ $t('notice.title') }}</h1>
      <p class="subtitle">{{ $t('notice.subtitle') }}</p>
      <p class="coming-soon">{{ $t('notice.soon') }}</p>
      <button class="btn" @click="closePopup">{{ $t('notice.btn') }}</button>
    </div>
  </div>
</template>
  
  
<script setup lang="ts">
import { onMounted } from 'vue'
import { useCounterStore } from '@/stores/counter'
import { storeToRefs } from 'pinia'

// 拿到 store
const counterStore = useCounterStore()
const { visible } = storeToRefs(counterStore)

// 挂载后让它自动打开
onMounted(() => {

})

// 点击按钮／遮罩层的时候直接改 store.visible
function closePopup() {
  counterStore.visible = false
}
</script>
  
<style scoped>
/* 基础样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Microsoft YaHei', sans-serif;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  background-size: 400% 400%;
  animation: gradientAnimation 15s ease infinite;
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  visibility: hidden;
  transition: all 0.6s ease;
}

.overlay.active {
  opacity: 1;
  visibility: visible;
}

@keyframes gradientAnimation {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}

.popup {
  background: #000;
  border-radius: 20px;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
  padding: 40px;
  text-align: center;
  max-width: 500px;
  width: 90%;
  transform: scale(0.8);
  transition: transform 0.6s ease;
  position: relative;
  overflow: hidden;
}

.overlay.active .popup {
  transform: scale(1);
}

.decorative-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  z-index: 0;
}

.circle-1 {
  width: 300px;
  height: 300px;
  top: -150px;
  right: -150px;
}

.circle-2 {
  width: 200px;
  height: 200px;
  bottom: -100px;
  left: -100px;
}

.loading-container {
  width: 120px;
  height: 120px;
  margin: 0 auto 30px;
  position: relative;
  z-index: 1;
}

.loading-circle {
  width: 100%;
  height: 100%;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #5B9CF5;
  border-radius: 50%;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.loading-dot {
  position: absolute;
  width: 15px;
  height: 15px;
  background-color: #5B9CF5;
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: pulse 2s infinite;
}

@keyframes pulse {

  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }

  50% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0.7;
  }
}

.title {

  color: #fff;

  font-size: 20px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
  margin-bottom: 15px;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease 0.2s;
}

.subtitle {
  font-size: 16px;
  color: #8E8E92;
  margin-bottom: 30px;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease 0.4s;
}

.coming-soon {
  font-size: 16px;
  color: #5B9CF5;
  font-weight: 600;
  margin-bottom: 20px;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease 0.6s;
}

.btn {
  display: inline-block;
  padding: 12px 30px;
  background-color: #5B9CF5;
  width: 100%;
  color: white;
  border: none;
  border-radius: 30px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease 0.8s;
}

.overlay.active .title,
.overlay.active .subtitle,
.overlay.active .coming-soon,
.overlay.active .btn {
  opacity: 1;
  transform: translateY(0);
}

.btn:hover {
  background-color: #00C675;
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(255, 125, 0, 0.3);
}

/* 响应式调整 */
@media (max-width: 400px) {
  .popup {
    padding: 30px 20px;
  }

  .loading-container {
    width: 100px;
    height: 100px;
  }

  .title {
    font-size: 24px;
  }

  .subtitle {
    font-size: 14px;
  }
}</style>
  