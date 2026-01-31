import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
// https://vitejs.dev/config/
export default defineConfig({
  base:"./",
  plugins: [vue()],
  server: {
    host: '0.0.0.0', // 允许外部访问，通常用于 Docker 或云环境
    port: 3000,      // 配置服务器监听端口
    open: true,      // 自动打开浏览器
    allowedHosts: [
      'swap-testnet.cpchain.com', // 添加你要允许的 host
    ],
  },
  build: {
    assetsInlineLimit: 4096, //  小于 4kb 才 base64
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('element-plus')) {
            return 'element-plus'
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
