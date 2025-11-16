// 移动端性能优化工具
export class MobilePerformanceOptimizer {
  constructor() {
    this.metrics = {};
    this.observers = [];
    this.isMobile = this.detectMobile();
    this.init();
  }

  init() {
    if (!this.isMobile) return;

    this.setupPerformanceMonitoring();
    this.optimizeRendering();
    this.setupMemoryManagement();
    this.optimizeNetworkRequests();
    this.setupBatteryOptimization();
  }

  // 检测是否为移动设备
  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768 && window.innerHeight <= 1024);
  }

  // 设置性能监控
  setupPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      try {
        // 监控长任务
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) { // 超过50ms的长任务
              this.handleLongTask(entry);
            }
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);

        // 监控布局偏移
        const layoutShiftObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.value > 0.1) { // 显著的布局偏移
              this.handleLayoutShift(entry);
            }
          });
        });
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutShiftObserver);

        // 监控首次内容绘制和最大内容绘制
        const paintObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.trackPaintMetric(entry.name, entry.startTime);
          });
        });
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);

      } catch (e) {
        console.warn('Performance monitoring not fully supported');
      }
    }

    // 监控页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.onPageHidden();
      } else {
        this.onPageVisible();
      }
    });

    // 监控页面卸载
    window.addEventListener('beforeunload', () => {
      this.onPageUnload();
    });
  }

  // 处理长任务
  handleLongTask(entry) {
    console.warn('Long task detected:', entry.duration, 'ms');

    // 在长任务期间降低动画帧率
    this.reduceFrameRate();

    // 通知用户
    this.showPerformanceWarning();
  }

  // 处理布局偏移
  handleLayoutShift(entry) {
    console.warn('Layout shift detected:', entry.value);

    // 记录布局偏移以便优化
    this.metrics.layoutShifts = (this.metrics.layoutShifts || 0) + entry.value;
  }

  // 跟踪绘制指标
  trackPaintMetric(name, time) {
    this.metrics[name] = time;

    if (name === 'first-contentful-paint') {
      console.log('First Contentful Paint:', time, 'ms');
    } else if (name === 'largest-contentful-paint') {
      console.log('Largest Contentful Paint:', time, 'ms');
    }
  }

  // 优化渲染性能
  optimizeRendering() {
    // 使用被动事件监听器
    this.usePassiveListeners();

    // 优化动画
    this.optimizeAnimations();

    // 减少重绘和重排版
    this.reduceReflows();

    // 使用GPU加速
    this.enableGPUAcceleration();
  }

  // 使用被动事件监听器
  usePassiveListeners() {
    // 替换现有的滚动事件监听器为被动模式
    const scrollElements = document.querySelectorAll('[data-scroll-optimized]');
    scrollElements.forEach(element => {
      const listeners = element._listeners || [];
      listeners.forEach(listener => {
        if (listener.type === 'scroll') {
          element.removeEventListener('scroll', listener.handler);
          element.addEventListener('scroll', listener.handler, { passive: true });
        }
      });
    });
  }

  // 优化动画
  optimizeAnimations() {
    // 使用transform和opacity进行动画，这些属性不会触发重排版
    const animatedElements = document.querySelectorAll('.animated, [style*="animation"], [style*="transition"]');
    animatedElements.forEach(element => {
      // 确保使用GPU加速
      const computedStyle = window.getComputedStyle(element);
      if (!computedStyle.transform || computedStyle.transform === 'none') {
        element.style.transform = 'translateZ(0)';
      }
    });
  }

  // 减少重绘和重排版
  reduceReflows() {
    // 批量更新DOM
    this.batchDOMUpdates();

    // 使用DocumentFragment进行批量插入
    this.useDocumentFragment();

    // 缓存计算样式
    this.cacheComputedStyles();
  }

  // 启用GPU加速
  enableGPUAcceleration() {
    const elementsToAccelerate = document.querySelectorAll(
      '.gpu-accelerated, .modal-content, .card, .button'
    );

    elementsToAccelerate.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      if (!computedStyle.willChange) {
        element.style.willChange = 'transform';
      }
      if (!computedStyle.transform || computedStyle.transform === 'none') {
        element.style.transform = 'translateZ(0)';
      }
    });
  }

  // 设置内存管理
  setupMemoryManagement() {
    // 监听内存压力
    if ('memory' in performance) {
      this.monitorMemoryUsage();
    }

    // 清理不必要的DOM元素
    this.setupDOMCleanup();

    // 优化事件监听器
    this.optimizeEventListeners();
  }

  // 监控内存使用
  monitorMemoryUsage() {
    setInterval(() => {
      const memInfo = performance.memory;
      const usedPercent = (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100;

      if (usedPercent > 80) {
        console.warn('High memory usage detected:', usedPercent.toFixed(2), '%');
        this.performMemoryCleanup();
      }
    }, 30000); // 每30秒检查一次
  }

  // 执行内存清理
  performMemoryCleanup() {
    // 清理缓存
    this.clearCaches();

    // 移除不必要的DOM元素
    this.removeUnusedElements();

    // 强制垃圾回收（如果可用）
    if (window.gc) {
      window.gc();
    }
  }

  // 设置DOM清理
  setupDOMCleanup() {
    // 监听页面卸载时清理
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // 定期清理隐藏的元素
    setInterval(() => {
      this.cleanupHiddenElements();
    }, 60000); // 每分钟清理一次
  }

  // 优化网络请求
  optimizeNetworkRequests() {
    // 实现请求去重
    this.deduplicateRequests();

    // 使用HTTP/2服务端推送
    this.optimizeResourceHints();

    // 缓存策略
    this.implementCachingStrategy();
  }

  // 设置电池优化
  setupBatteryOptimization() {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        this.monitorBattery(battery);
      });
    }
  }

  // 监控电池状态
  monitorBattery(battery) {
    const updateBatteryStatus = () => {
      if (battery.level < 0.2 && !battery.charging) {
        // 电池电量低，启用省电模式
        this.enablePowerSavingMode();
      } else if (battery.charging || battery.level > 0.3) {
        // 电池充足，恢复正常模式
        this.disablePowerSavingMode();
      }
    };

    battery.addEventListener('levelchange', updateBatteryStatus);
    battery.addEventListener('chargingchange', updateBatteryStatus);

    updateBatteryStatus(); // 初始检查
  }

  // 启用省电模式
  enablePowerSavingMode() {
    console.log('Enabling power saving mode');

    // 降低动画帧率
    this.reduceFrameRate();

    // 禁用非必要的动画
    this.disableNonEssentialAnimations();

    // 减少网络请求频率
    this.reduceNetworkActivity();
  }

  // 禁用省电模式
  disablePowerSavingMode() {
    console.log('Disabling power saving mode');

    // 恢复正常帧率
    this.restoreFrameRate();

    // 重新启用动画
    this.enableAnimations();

    // 恢复网络活动
    this.restoreNetworkActivity();
  }

  // 降低帧率
  reduceFrameRate() {
    if (this.normalFrameRate === undefined) {
      this.normalFrameRate = 60;
    }

    // 简单地通过增加动画间隔来降低帧率
    document.documentElement.style.setProperty('--animation-duration-multiplier', '2');
  }

  // 恢复帧率
  restoreFrameRate() {
    document.documentElement.style.setProperty('--animation-duration-multiplier', '1');
  }

  // 页面隐藏时的处理
  onPageHidden() {
    // 暂停非必要的活动
    this.pauseNonEssentialActivities();

    // 降低更新频率
    this.reduceUpdateFrequency();
  }

  // 页面显示时的处理
  onPageVisible() {
    // 恢复活动
    this.resumeActivities();

    // 恢复更新频率
    this.restoreUpdateFrequency();

    // 检查是否有需要重新加载的内容
    this.checkForUpdates();
  }

  // 页面卸载时的清理
  onPageUnload() {
    this.cleanup();
  }

  // 清理资源
  cleanup() {
    // 清理观察器
    this.observers.forEach(observer => {
      if (observer.disconnect) {
        observer.disconnect();
      }
    });
    this.observers = [];

    // 清理定时器
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    if (this.domCleanupInterval) {
      clearInterval(this.domCleanupInterval);
    }
  }

  // 工具方法
  batchDOMUpdates() {
    // 批量DOM更新的实现
    let updateQueue = [];
    let updateTimeout = null;

    window.batchUpdate = (callback) => {
      updateQueue.push(callback);

      if (!updateTimeout) {
        updateTimeout = setTimeout(() => {
          updateQueue.forEach(cb => cb());
          updateQueue = [];
          updateTimeout = null;
        }, 0);
      }
    };
  }

  useDocumentFragment() {
    // DocumentFragment工具
    window.createFragment = (children) => {
      const fragment = document.createDocumentFragment();
      children.forEach(child => fragment.appendChild(child));
      return fragment;
    };
  }

  cacheComputedStyles() {
    // 缓存计算样式的工具
    const styleCache = new Map();

    window.getCachedStyle = (element, property) => {
      const key = element + property;
      if (!styleCache.has(key)) {
        styleCache.set(key, window.getComputedStyle(element)[property]);
      }
      return styleCache.get(key);
    };
  }

  clearCaches() {
    // 清理各种缓存
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
  }

  removeUnusedElements() {
    // 移除隐藏的、不必要的元素
    const hiddenElements = document.querySelectorAll('.hidden, [style*="display: none"], [style*="visibility: hidden"]');
    hiddenElements.forEach(element => {
      if (!element.hasAttribute('data-keep-hidden')) {
        element.remove();
      }
    });
  }

  optimizeEventListeners() {
    // 优化事件监听器，移除重复的监听器
    const elements = document.querySelectorAll('*');
    const eventListeners = new Map();

    elements.forEach(element => {
      const listeners = element._listeners || [];
      listeners.forEach(listener => {
        const key = `${element}-${listener.type}`;
        if (eventListeners.has(key)) {
          // 移除重复的监听器
          element.removeEventListener(listener.type, listener.handler);
        } else {
          eventListeners.set(key, listener);
        }
      });
    });
  }

  deduplicateRequests() {
    // 请求去重逻辑
    const pendingRequests = new Set();

    // 重写fetch
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = args[0];
      if (pendingRequests.has(url)) {
        return Promise.reject(new Error('Request deduplicated'));
      }

      pendingRequests.add(url);
      return originalFetch.apply(this, args).finally(() => {
        pendingRequests.delete(url);
      });
    };
  }

  optimizeResourceHints() {
    // 添加资源提示
    const criticalResources = [
      // 添加关键资源的URL
    ];

    criticalResources.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      link.as = 'script'; // 或其他类型
      document.head.appendChild(link);
    });
  }

  implementCachingStrategy() {
    // 实现缓存策略
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        console.log('ServiceWorker registered');
      });
    }
  }

  pauseNonEssentialActivities() {
    // 暂停动画、轮询等
    document.documentElement.classList.add('page-hidden');
  }

  resumeActivities() {
    document.documentElement.classList.remove('page-hidden');
  }

  reduceUpdateFrequency() {
    // 降低更新频率
    document.documentElement.style.setProperty('--update-frequency', '0.5');
  }

  restoreUpdateFrequency() {
    document.documentElement.style.setProperty('--update-frequency', '1');
  }

  checkForUpdates() {
    // 检查是否有内容更新
    // 实现内容更新检查逻辑
  }

  cleanupHiddenElements() {
    // 清理隐藏元素
    const hiddenElements = document.querySelectorAll('.temp-hidden:not(.keep-alive)');
    hiddenElements.forEach(element => {
      element.remove();
    });
  }

  disableNonEssentialAnimations() {
    document.documentElement.classList.add('reduce-animations');
  }

  enableAnimations() {
    document.documentElement.classList.remove('reduce-animations');
  }

  reduceNetworkActivity() {
    // 减少网络请求频率
    document.documentElement.classList.add('reduce-network');
  }

  restoreNetworkActivity() {
    document.documentElement.classList.remove('reduce-network');
  }

  showPerformanceWarning() {
    // 显示性能警告（可选）
    const warning = document.createElement('div');
    warning.className = 'performance-warning';
    warning.textContent = '页面响应较慢，请稍候...';
    warning.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff6b6b;
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
    `;

    document.body.appendChild(warning);

    setTimeout(() => {
      warning.remove();
    }, 3000);
  }

  // 获取性能指标
  getMetrics() {
    return {
      ...this.metrics,
      memoryUsage: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null,
      isMobile: this.isMobile
    };
  }

  // 静态方法：快速性能检查
  static quickPerformanceCheck() {
    const optimizer = new MobilePerformanceOptimizer();
    return optimizer.getMetrics();
  }
}

// 自动初始化
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    new MobilePerformanceOptimizer();
  });

  // 暴露全局API
  window.MobilePerformanceOptimizer = MobilePerformanceOptimizer;
}

