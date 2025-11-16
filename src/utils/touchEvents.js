// iOS Safari 触摸事件优化工具
export class TouchEventManager {
  constructor() {
    this.init();
  }

  init() {
    this.preventDoubleTapZoom();
    this.preventOverscroll();
    this.optimizeInputFocus();
    this.addTouchFeedback();
  }

  // 防止双击缩放
  preventDoubleTapZoom() {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  }

  // 防止过度滚动
  preventOverscroll() {
    document.addEventListener('touchmove', (event) => {
      // 防止在非滚动容器上的过度滚动
      if (event.target.closest('.prevent-scroll')) {
        return;
      }

      const scrollable = event.target.closest('.scroll-container') ||
                        event.target.closest('[data-scrollable]');

      if (!scrollable) {
        // 检查是否在页面顶部或底部
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );

        if ((scrollTop <= 0 && event.touches[0].clientY > 0) ||
            (scrollTop + windowHeight >= documentHeight && event.touches[0].clientY < windowHeight)) {
          event.preventDefault();
        }
      }
    }, { passive: false });
  }

  // 优化输入框聚焦体验
  optimizeInputFocus() {
    const inputs = document.querySelectorAll('input, textarea');

    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        // iOS Safari 聚焦时自动滚动到可见区域
        setTimeout(() => {
          input.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, 300);
      });

      // 防止iOS Safari的自动缩放
      input.addEventListener('focus', () => {
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', () => {
            setTimeout(() => {
              input.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });
            }, 100);
          });
        }
      });
    });
  }

  // 添加触摸反馈
  addTouchFeedback() {
    const touchableElements = document.querySelectorAll('button, .clickable, [role="button"]');

    touchableElements.forEach(element => {
      element.addEventListener('touchstart', () => {
        element.classList.add('touch-active');
      }, { passive: true });

      element.addEventListener('touchend', () => {
        setTimeout(() => {
          element.classList.remove('touch-active');
        }, 150);
      }, { passive: true });

      element.addEventListener('touchcancel', () => {
        element.classList.remove('touch-active');
      }, { passive: true });
    });
  }

  // 手动触发页面重新计算（解决iOS Safari的渲染问题）
  static forceReflow(element = document.body) {
    element.offsetHeight;
  }

  // 检查是否为iOS设备
  static isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  // 检查是否为iOS Safari
  static isIOSSafari() {
    const iOS = this.isIOS();
    const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    return iOS && safari;
  }

  // 获取iOS版本
  static getIOSVersion() {
    if (!this.isIOS()) return null;

    const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3] || 0, 10)
      };
    }
    return null;
  }
}

// 自动初始化（仅在客户端）
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    new TouchEventManager();
  });
}
