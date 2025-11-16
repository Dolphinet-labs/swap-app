// 移动端触摸交互优化工具
export class TouchInteractions {
  constructor() {
    this.touchElements = new Set();
    this.init();
  }

  init() {
    this.setupTouchFeedback();
    this.preventGhostClicks();
    this.optimizeButtonInteractions();
  }

  // 设置触摸反馈
  setupTouchFeedback() {
    const interactiveElements = document.querySelectorAll(
      'button, .clickable, [role="button"], input[type="button"], input[type="submit"], .interactive'
    );

    interactiveElements.forEach(element => {
      this.addTouchFeedback(element);
    });

    // 监听动态添加的元素
    this.observeNewElements();
  }

  // 为元素添加触摸反馈
  addTouchFeedback(element) {
    if (this.touchElements.has(element)) return;

    this.touchElements.add(element);

    // 触摸开始
    element.addEventListener('touchstart', (e) => {
      this.handleTouchStart(e, element);
    }, { passive: false });

    // 触摸结束
    element.addEventListener('touchend', (e) => {
      this.handleTouchEnd(e, element);
    }, { passive: false });

    // 触摸取消
    element.addEventListener('touchcancel', (e) => {
      this.handleTouchCancel(e, element);
    }, { passive: false });

    // 鼠标事件兼容（桌面端）
    element.addEventListener('mousedown', (e) => {
      this.handleMouseDown(e, element);
    });

    element.addEventListener('mouseup', (e) => {
      this.handleMouseUp(e, element);
    });

    element.addEventListener('mouseleave', (e) => {
      this.handleMouseLeave(e, element);
    });
  }

  // 处理触摸开始
  handleTouchStart(event, element) {
    // 防止双击缩放
    if (event.touches.length > 1) {
      event.preventDefault();
    }

    // 添加触摸反馈样式
    element.classList.add('touch-active');

    // 防止文本选择
    element.style.userSelect = 'none';
    element.style.webkitUserSelect = 'none';

    // 震动反馈（如果支持）
    this.vibrate(50);
  }

  // 处理触摸结束
  handleTouchEnd(event, element) {
    // 移除触摸反馈样式
    setTimeout(() => {
      element.classList.remove('touch-active');
      element.style.userSelect = '';
      element.style.webkitUserSelect = '';
    }, 150);

    // 防止ghost clicks
    this.preventGhostClick(event);
  }

  // 处理触摸取消
  handleTouchCancel(event, element) {
    element.classList.remove('touch-active');
    element.style.userSelect = '';
    element.style.webkitUserSelect = '';
  }

  // 处理鼠标按下（桌面端兼容）
  handleMouseDown(event, element) {
    element.classList.add('touch-active');
  }

  // 处理鼠标释放
  handleMouseUp(event, element) {
    setTimeout(() => {
      element.classList.remove('touch-active');
    }, 150);
  }

  // 处理鼠标离开
  handleMouseLeave(event, element) {
    element.classList.remove('touch-active');
  }

  // 防止ghost clicks
  preventGhostClick(event) {
    const touch = event.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);

    if (target && target !== event.target) {
      // 如果触摸位置的元素与原始目标不同，阻止后续的click事件
      const preventClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.removeEventListener('click', preventClick, true);
      };

      document.addEventListener('click', preventClick, true);

      setTimeout(() => {
        document.removeEventListener('click', preventClick, true);
      }, 300);
    }
  }

  // 优化按钮交互
  optimizeButtonInteractions() {
    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');

    buttons.forEach(button => {
      // 确保按钮有足够的触摸目标大小
      this.ensureMinimumTouchTarget(button);

      // 添加更好的焦点处理
      button.addEventListener('focus', () => {
        if (window.innerWidth < 768) {
          // 移动端聚焦时滚动到可见区域
          setTimeout(() => {
            button.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }, 100);
        }
      });
    });
  }

  // 确保最小触摸目标大小
  ensureMinimumTouchTarget(element) {
    const styles = window.getComputedStyle(element);
    const width = parseFloat(styles.width);
    const height = parseFloat(styles.height);
    const minSize = 44; // iOS 人机界面指南推荐的最小触摸目标

    if (width < minSize || height < minSize) {
      // 如果元素太小，添加内边距或调整样式
      const paddingTop = parseFloat(styles.paddingTop) || 0;
      const paddingBottom = parseFloat(styles.paddingBottom) || 0;
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;

      if (width < minSize && height >= minSize) {
        // 宽度不够，增加左右内边距
        const additionalPadding = (minSize - width) / 2;
        element.style.paddingLeft = (paddingLeft + additionalPadding) + 'px';
        element.style.paddingRight = (paddingRight + additionalPadding) + 'px';
      } else if (height < minSize && width >= minSize) {
        // 高度不够，增加上下内边距
        const additionalPadding = (minSize - height) / 2;
        element.style.paddingTop = (paddingTop + additionalPadding) + 'px';
        element.style.paddingBottom = (paddingBottom + additionalPadding) + 'px';
      }
    }
  }

  // 监听新添加的元素
  observeNewElements() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查新添加的元素是否需要触摸反馈
            const interactiveElements = node.querySelectorAll ?
              node.querySelectorAll('button, .clickable, [role="button"], input[type="button"], input[type="submit"], .interactive') :
              [];

            if (node.matches && node.matches('button, .clickable, [role="button"], input[type="button"], input[type="submit"], .interactive')) {
              this.addTouchFeedback(node);
            }

            interactiveElements.forEach(element => {
              this.addTouchFeedback(element);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 震动反馈
  vibrate(duration = 50) {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }

  // 添加波纹效果
  static addRippleEffect(element) {
    element.addEventListener('touchstart', function(e) {
      const ripple = document.createElement('span');
      const rect = element.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.touches[0].clientX - rect.left - size / 2;
      const y = e.touches[0].clientY - rect.top - size / 2;

      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
        z-index: 1;
      `;

      element.style.position = element.style.position || 'relative';
      element.style.overflow = 'hidden';

      element.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  }

  // 检查是否为移动设备
  static isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768 && window.innerHeight <= 1024);
  }

  // 检查是否支持触摸
  static supportsTouch() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
}

// 添加波纹动画样式
const rippleStyles = `
  @keyframes ripple {
    to {
      transform: scale(2);
      opacity: 0;
    }
  }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = rippleStyles;
  document.head.appendChild(style);
}

// 自动初始化
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    new TouchInteractions();
  });
}

