// 移动端图片和资源优化工具
export class MobileAssetOptimizer {
  constructor() {
    this.imageObserver = null;
    this.lazyLoadObserver = null;
    this.webPSupported = null;
    this.connectionType = null;
    this.init();
  }

  init() {
    this.checkWebPSupport();
    this.detectConnectionType();
    this.setupLazyLoading();
    this.optimizeImages();
    this.setupPerformanceMonitoring();
  }

  // 检查WebP支持
  async checkWebPSupport() {
    if (this.webPSupported !== null) return this.webPSupported;

    try {
      const webP = new Image();
      webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';

      await new Promise((resolve, reject) => {
        webP.onload = () => resolve(true);
        webP.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 100);
      });

      this.webPSupported = webP.width === 2 && webP.height === 1;
    } catch (e) {
      this.webPSupported = false;
    }

    return this.webPSupported;
  }

  // 检测网络连接类型
  detectConnectionType() {
    if ('connection' in navigator) {
      this.connectionType = navigator.connection.effectiveType || 'unknown';

      // 监听连接变化
      navigator.connection.addEventListener('change', () => {
        this.connectionType = navigator.connection.effectiveType;
        this.adjustQualityBasedOnConnection();
      });
    } else {
      // 回退检测方法
      this.connectionType = this.estimateConnectionType();
    }
  }

  // 估算连接类型
  estimateConnectionType() {
    // 基于下载速度估算（简化版）
    const connection = navigator.connection;
    if (connection) {
      const downlink = connection.downlink;
      if (downlink >= 10) return '4g';
      if (downlink >= 2) return '3g';
      if (downlink >= 0.5) return '2g';
      return 'slow-2g';
    }
    return 'unknown';
  }

  // 根据连接类型调整质量
  adjustQualityBasedOnConnection() {
    const images = document.querySelectorAll('img[data-src], img[data-srcset]');
    const quality = this.getQualityForConnection();

    images.forEach(img => {
      this.updateImageQuality(img, quality);
    });
  }

  // 根据连接获取质量设置
  getQualityForConnection() {
    const qualityMap = {
      '4g': 'high',
      '3g': 'medium',
      '2g': 'low',
      'slow-2g': 'low',
      'unknown': 'medium'
    };

    return qualityMap[this.connectionType] || 'medium';
  }

  // 设置懒加载
  setupLazyLoading() {
    if (!('IntersectionObserver' in window)) {
      // 回退方案：简单的滚动监听
      this.setupFallbackLazyLoading();
      return;
    }

    this.lazyLoadObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          this.lazyLoadObserver.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });

    this.observeLazyImages();
  }

  // 设置回退懒加载
  setupFallbackLazyLoading() {
    const lazyImages = document.querySelectorAll('img[data-src]');

    const loadOnScroll = () => {
      lazyImages.forEach(img => {
        if (this.isElementInViewport(img)) {
          this.loadImage(img);
        }
      });
    };

    window.addEventListener('scroll', this.throttle(loadOnScroll, 100));
    window.addEventListener('resize', this.throttle(loadOnScroll, 100));

    // 初始加载
    loadOnScroll();
  }

  // 观察懒加载图片
  observeLazyImages() {
    const lazyImages = document.querySelectorAll('img[data-src], img[data-srcset]');
    lazyImages.forEach(img => {
      this.lazyLoadObserver.observe(img);
    });
  }

  // 加载图片
  loadImage(img) {
    const src = img.getAttribute('data-src');
    const srcset = img.getAttribute('data-srcset');

    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
    }

    if (srcset) {
      img.srcset = srcset;
      img.removeAttribute('data-srcset');
    }

    // 添加加载类
    img.classList.add('loaded');

    // 监听加载完成
    img.addEventListener('load', () => {
      img.classList.add('loaded');
      img.classList.remove('loading');
    });

    img.addEventListener('error', () => {
      img.classList.add('error');
      img.classList.remove('loading');
    });
  }

  // 检查元素是否在视口中
  isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // 节流函数
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // 优化图片
  async optimizeImages() {
    const images = document.querySelectorAll('img');
    const quality = this.getQualityForConnection();
    const webPSupported = await this.checkWebPSupport();

    images.forEach(img => {
      this.optimizeImage(img, quality, webPSupported);
    });

    // 监听新图片
    this.observeNewImages();
  }

  // 优化单个图片
  optimizeImage(img, quality, webPSupported) {
    // 添加加载类
    img.classList.add('loading');

    // 设置适当的尺寸
    this.setResponsiveSize(img);

    // WebP优化
    if (webPSupported) {
      this.convertToWebP(img);
    }

    // 质量优化
    this.updateImageQuality(img, quality);

    // 添加错误处理
    img.addEventListener('error', () => {
      this.handleImageError(img);
    });

    // 添加加载完成处理
    img.addEventListener('load', () => {
      img.classList.add('loaded');
      img.classList.remove('loading');
    });
  }

  // 设置响应式尺寸
  setResponsiveSize(img) {
    if (!img.hasAttribute('sizes')) {
      const width = img.offsetWidth || img.naturalWidth || 300;
      img.setAttribute('sizes', `(max-width: 768px) ${Math.min(width, 400)}px, ${Math.min(width, 800)}px`);
    }
  }

  // 转换为WebP
  convertToWebP(img) {
    const src = img.src;
    if (src && !src.includes('.webp') && !src.includes('data:')) {
      // 简单的WebP转换（实际项目中可能需要更复杂的逻辑）
      const webpSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      img.setAttribute('data-webp-src', webpSrc);
    }
  }

  // 更新图片质量
  updateImageQuality(img, quality) {
    const qualityMap = {
      high: 90,
      medium: 75,
      low: 60
    };

    const qualityValue = qualityMap[quality] || 75;

    // 对于支持的格式，可以设置quality属性
    if (img.src && img.src.startsWith('data:')) {
      // 对于data URL，可以重新编码
      this.compressDataURLImage(img, qualityValue);
    }
  }

  // 压缩data URL图片
  compressDataURLImage(img, quality) {
    // 这里可以实现data URL图片压缩逻辑
    // 简化版：仅设置一个标记
    img.setAttribute('data-quality', quality);
  }

  // 处理图片错误
  handleImageError(img) {
    img.classList.add('error');

    // 设置默认图片
    if (!img.hasAttribute('data-fallback-src')) {
      const fallbackSrc = this.getFallbackImage(img);
      if (fallbackSrc) {
        img.src = fallbackSrc;
        img.setAttribute('data-fallback-src', fallbackSrc);
      }
    }
  }

  // 获取默认图片
  getFallbackImage(img) {
    // 根据图片类型返回合适的默认图片
    const width = img.offsetWidth || 100;
    const height = img.offsetHeight || 100;

    // 返回一个小的占位符图片
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999" font-size="14">Image</text>
      </svg>
    `)}`;
  }

  // 观察新图片
  observeNewImages() {
    this.imageObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
            this.optimizeImage(node, this.getQualityForConnection(), this.webPSupported);
            if (node.hasAttribute('data-src')) {
              this.lazyLoadObserver.observe(node);
            }
          }
        });
      });
    });

    this.imageObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 设置性能监控
  setupPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      try {
        // 监控图片加载性能
        const imageObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.initiatorType === 'img') {
              this.trackImagePerformance(entry);
            }
          });
        });

        imageObserver.observe({ entryTypes: ['resource'] });
      } catch (e) {
        console.warn('Performance monitoring not supported');
      }
    }
  }

  // 跟踪图片性能
  trackImagePerformance(entry) {
    const loadTime = entry.responseEnd - entry.requestStart;

    // 根据加载时间调整策略
    if (loadTime > 3000 && this.connectionType !== 'slow-2g') {
      // 加载慢的图片，降低质量
      const img = document.querySelector(`img[src="${entry.name}"]`);
      if (img) {
        this.updateImageQuality(img, 'low');
      }
    }
  }

  // 预加载关键图片
  static preloadCriticalImages() {
    const criticalImages = document.querySelectorAll('img[loading="eager"], .critical-image img');
    const preloadLinks = [];

    criticalImages.forEach(img => {
      if (img.src) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = img.src;
        if (img.srcset) {
          link.setAttribute('imagesrcset', img.srcset);
        }
        if (img.sizes) {
          link.setAttribute('imagesizes', img.sizes);
        }
        document.head.appendChild(link);
        preloadLinks.push(link);
      }
    });

    return preloadLinks;
  }

  // 批量优化图片
  static optimizeImages(selector = 'img') {
    const optimizer = new MobileAssetOptimizer();
    const images = document.querySelectorAll(selector);
    images.forEach(img => optimizer.optimizeImage(img, 'medium', false));
  }
}

// 自动初始化
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // 预加载关键图片
    MobileAssetOptimizer.preloadCriticalImages();

    // 初始化优化器
    new MobileAssetOptimizer();
  });
}

