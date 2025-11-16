// 移动端输入框优化工具
export class MobileInputOptimizer {
  constructor() {
    this.activeInput = null;
    this.originalScrollTop = 0;
    this.keyboardHeight = 0;
    this.init();
  }

  init() {
    this.setupInputListeners();
    this.setupVisualViewportListener();
    this.preventZoomOnFocus();
  }

  // 设置输入框事件监听
  setupInputListeners() {
    const inputs = document.querySelectorAll('input, textarea, [contenteditable]');

    inputs.forEach(input => {
      input.addEventListener('focus', (e) => this.handleInputFocus(e));
      input.addEventListener('blur', (e) => this.handleInputBlur(e));
    });
  }

  // 处理输入框聚焦
  handleInputFocus(event) {
    const input = event.target;
    this.activeInput = input;

    // 保存当前滚动位置
    this.originalScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // 延迟执行，确保键盘已经弹出
    setTimeout(() => {
      this.scrollInputIntoView(input);
    }, 300);

    // 添加输入框激活样式
    input.classList.add('input-focused');

    // iOS Safari 特殊处理
    if (this.isIOS()) {
      // 防止页面缩放
      input.setAttribute('inputmode', input.type === 'number' ? 'decimal' : 'text');

      // 设置合适的视口
      this.adjustViewportForIOS();
    }
  }

  // 处理输入框失焦
  handleInputBlur(event) {
    const input = event.target;

    // 移除激活样式
    input.classList.remove('input-focused');

    // 延迟恢复滚动位置
    setTimeout(() => {
      if (!this.isAnyInputFocused()) {
        this.restoreScrollPosition();
        this.activeInput = null;
      }
    }, 300);

    // iOS Safari 特殊处理
    if (this.isIOS()) {
      this.restoreViewportForIOS();
    }
  }

  // 滚动输入框到可见区域
  scrollInputIntoView(input) {
    const rect = input.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const keyboardHeight = this.getKeyboardHeight();

    // 计算输入框应该在的位置（键盘上方100px）
    const targetTop = rect.top - 100;
    const targetBottom = rect.bottom + 100;

    let scrollTo = 0;

    if (targetTop < 0) {
      // 输入框被遮挡在顶部
      scrollTo = window.pageYOffset + targetTop;
    } else if (targetBottom > windowHeight - keyboardHeight) {
      // 输入框被遮挡在底部
      scrollTo = window.pageYOffset + (targetBottom - (windowHeight - keyboardHeight));
    }

    if (scrollTo !== 0) {
      window.scrollTo({
        top: scrollTo,
        behavior: 'smooth'
      });
    }
  }

  // 获取键盘高度
  getKeyboardHeight() {
    if (window.visualViewport) {
      const viewportHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      return Math.max(0, windowHeight - viewportHeight);
    }
    return 300; // 默认键盘高度
  }

  // 恢复滚动位置
  restoreScrollPosition() {
    // 只在必要时恢复
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const diff = Math.abs(currentScrollTop - this.originalScrollTop);

    if (diff > 100) {
      window.scrollTo({
        top: this.originalScrollTop,
        behavior: 'smooth'
      });
    }
  }

  // 检查是否有输入框处于聚焦状态
  isAnyInputFocused() {
    return document.activeElement &&
           (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA' ||
            document.activeElement.contentEditable === 'true');
  }

  // iOS Safari 视口调整
  adjustViewportForIOS() {
    if (!this.isIOS()) return;

    // 临时调整视口meta标签
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    }
  }

  // 恢复iOS Safari视口
  restoreViewportForIOS() {
    if (!this.isIOS()) return;

    setTimeout(() => {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content',
          'width=device-width, initial-scale=1.0, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover'
        );
      }
    }, 300);
  }

  // 设置Visual Viewport监听器
  setupVisualViewportListener() {
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        if (this.activeInput) {
          // 键盘高度改变时重新调整位置
          setTimeout(() => {
            this.scrollInputIntoView(this.activeInput);
          }, 100);
        }
      });
    }
  }

  // 防止聚焦时页面缩放
  preventZoomOnFocus() {
    // 监听所有输入框的focus事件
    document.addEventListener('focusin', (e) => {
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // 在iOS Safari上，设置font-size为16px可以防止缩放
        if (this.isIOS() && window.innerWidth < 768) {
          const originalFontSize = target.style.fontSize;
          target.style.fontSize = '16px';

          // 失焦时恢复原始字体大小
          const restoreFontSize = () => {
            target.style.fontSize = originalFontSize;
            target.removeEventListener('blur', restoreFontSize);
          };
          target.addEventListener('blur', restoreFontSize);
        }
      }
    });
  }

  // 检查是否为iOS设备
  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  // 手动滚动到指定输入框
  static scrollToInput(input) {
    if (input && typeof input.scrollIntoView === 'function') {
      setTimeout(() => {
        input.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 100);
    }
  }
}

// 自动初始化
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    new MobileInputOptimizer();
  });
}

