// 移动端模态框优化工具
export class MobileModalOptimizer {
  constructor() {
    this.activeModals = [];
    this.originalBodyStyles = {};
    this.init();
  }

  init() {
    this.setupModalObservers();
    this.setupKeyboardHandling();
  }

  // 设置模态框观察器
  setupModalObservers() {
    // 监听模态框的显示和隐藏
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.checkForModal(node);
          }
        });

        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.checkForModalRemoval(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 监听现有的模态框
    this.checkExistingModals();
  }

  // 检查是否为模态框
  checkForModal(element) {
    const modalSelectors = [
      '.modal', '.popup', '.drawer', '.dialog',
      '[role="dialog"]', '[role="alertdialog"]',
      '.el-dialog', '.el-drawer', '.el-message-box'
    ];

    const isModal = modalSelectors.some(selector => element.matches && element.matches(selector)) ||
                   element.classList && (
                     element.classList.contains('modal') ||
                     element.classList.contains('popup') ||
                     element.classList.contains('drawer')
                   );

    if (isModal && !this.activeModals.includes(element)) {
      this.optimizeModal(element);
    }

    // 检查子元素
    const childModals = element.querySelectorAll ?
      element.querySelectorAll(modalSelectors.join(', ')) : [];

    childModals.forEach(modal => {
      if (!this.activeModals.includes(modal)) {
        this.optimizeModal(modal);
      }
    });
  }

  // 检查模态框移除
  checkForModalRemoval(element) {
    const index = this.activeModals.indexOf(element);
    if (index > -1) {
      this.restoreBodyStyles();
      this.activeModals.splice(index, 1);
    }

    // 检查子元素
    const childModals = element.querySelectorAll ?
      element.querySelectorAll('.modal, .popup, .drawer, [role="dialog"]') : [];

    childModals.forEach(modal => {
      const modalIndex = this.activeModals.indexOf(modal);
      if (modalIndex > -1) {
        this.activeModals.splice(modalIndex, 1);
      }
    });
  }

  // 检查现有的模态框
  checkExistingModals() {
    const existingModals = document.querySelectorAll(
      '.modal, .popup, .drawer, [role="dialog"], .el-dialog, .el-drawer'
    );

    existingModals.forEach(modal => {
      if (!this.activeModals.includes(modal) &&
          window.getComputedStyle(modal).display !== 'none') {
        this.optimizeModal(modal);
      }
    });
  }

  // 优化模态框
  optimizeModal(modal) {
    if (this.activeModals.includes(modal)) return;

    this.activeModals.push(modal);
    this.saveBodyStyles();
    this.applyModalOptimizations(modal);

    // 监听模态框关闭事件
    this.setupModalCloseListeners(modal);
  }

  // 保存body原始样式
  saveBodyStyles() {
    if (Object.keys(this.originalBodyStyles).length === 0) {
      const body = document.body;
      const computedStyle = window.getComputedStyle(body);

      this.originalBodyStyles = {
        position: computedStyle.position,
        top: computedStyle.top,
        left: computedStyle.left,
        right: computedStyle.right,
        bottom: computedStyle.bottom,
        overflow: computedStyle.overflow,
        height: computedStyle.height,
        width: computedStyle.width
      };
    }
  }

  // 应用模态框优化
  applyModalOptimizations(modal) {
    // 添加移动端友好的类
    modal.classList.add('mobile-modal-optimized');

    // 设置模态框样式
    this.setModalStyles(modal);

    // 防止背景滚动
    this.preventBackgroundScroll();

    // 添加遮罩点击关闭功能（如果没有的话）
    this.addBackdropClose(modal);

    // 优化内部滚动
    this.optimizeModalScroll(modal);
  }

  // 设置模态框样式
  setModalStyles(modal) {
    const modalContent = this.findModalContent(modal);
    if (!modalContent) return;

    // 移动端样式
    if (window.innerWidth <= 768) {
      modalContent.style.cssText += `
        max-width: 100vw !important;
        max-height: 90vh !important;
        width: 100vw !important;
        margin: 0 !important;
        border-radius: 0 !important;
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        top: auto !important;
        transform: translateY(100%) !important;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      `;

      // 延迟显示动画
      setTimeout(() => {
        modalContent.style.transform = 'translateY(0) !important';
      }, 10);

      // 添加顶部指示器
      this.addTopIndicator(modalContent);
    } else {
      // 桌面端样式
      modalContent.style.cssText += `
        max-width: 90vw !important;
        max-height: 90vh !important;
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        border-radius: 16px !important;
      `;
    }
  }

  // 查找模态框内容区域
  findModalContent(modal) {
    // 常见的模态框内容选择器
    const contentSelectors = [
      '.modal-content', '.modal-body', '.drawer-body',
      '.el-dialog__body', '.el-drawer__body',
      '.content', '.body'
    ];

    for (const selector of contentSelectors) {
      const content = modal.querySelector(selector);
      if (content) return content;
    }

    // 如果没找到，返回模态框本身
    return modal;
  }

  // 添加顶部指示器（移动端）
  addTopIndicator(modalContent) {
    if (modalContent.querySelector('.modal-indicator')) return;

    const indicator = document.createElement('div');
    indicator.className = 'modal-indicator';
    indicator.style.cssText = `
      width: 40px;
      height: 4px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 2px;
      margin: 8px auto 16px;
      flex-shrink: 0;
    `;

    // 找到合适的位置插入
    const header = modalContent.querySelector('.modal-header, .drawer-header, .el-dialog__header');
    if (header) {
      header.insertBefore(indicator, header.firstChild);
    } else {
      modalContent.insertBefore(indicator, modalContent.firstChild);
    }
  }

  // 防止背景滚动
  preventBackgroundScroll() {
    const body = document.body;

    // 保存原始样式
    if (!body.hasAttribute('data-modal-open')) {
      body.setAttribute('data-modal-open', 'true');

      // 应用模态框打开时的样式
      body.style.position = 'fixed';
      body.style.top = '0';
      body.style.left = '0';
      body.style.right = '0';
      body.style.bottom = '0';
      body.style.overflow = 'hidden';
      body.style.height = '100vh';
      body.style.width = '100vw';
    }
  }

  // 添加遮罩点击关闭
  addBackdropClose(modal) {
    const backdrop = modal.querySelector('.modal-mask, .modal-backdrop, .el-overlay');
    if (!backdrop) return;

    // 检查是否已经有点击事件
    if (!backdrop.hasAttribute('data-backdrop-close')) {
      backdrop.setAttribute('data-backdrop-close', 'true');
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeModal(modal);
        }
      });
    }
  }

  // 优化模态框内部滚动
  optimizeModalScroll(modal) {
    const scrollableContent = this.findScrollableContent(modal);
    if (scrollableContent) {
      scrollableContent.style.cssText += `
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        max-height: calc(90vh - 120px);
        overflow-y: auto;
      `;
    }
  }

  // 查找可滚动内容
  findScrollableContent(modal) {
    const scrollSelectors = [
      '.modal-body', '.drawer-body', '.scroll-content',
      '.el-dialog__body', '.el-drawer__body'
    ];

    for (const selector of scrollSelectors) {
      const content = modal.querySelector(selector);
      if (content) return content;
    }

    return null;
  }

  // 设置键盘处理
  setupKeyboardHandling() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModals.length > 0) {
        const lastModal = this.activeModals[this.activeModals.length - 1];
        this.closeModal(lastModal);
      }
    });
  }

  // 设置模态框关闭监听器
  setupModalCloseListeners(modal) {
    // 监听常见的关闭按钮
    const closeButtons = modal.querySelectorAll(
      '.modal-close, .close-btn, .el-dialog__close, .el-drawer__close'
    );

    closeButtons.forEach(button => {
      if (!button.hasAttribute('data-close-listener')) {
        button.setAttribute('data-close-listener', 'true');
        button.addEventListener('click', () => {
          this.closeModal(modal);
        });
      }
    });

    // 监听自定义事件
    modal.addEventListener('close', () => {
      this.closeModal(modal);
    });
  }

  // 关闭模态框
  closeModal(modal) {
    const modalContent = this.findModalContent(modal);

    if (window.innerWidth <= 768 && modalContent) {
      // 移动端关闭动画
      modalContent.style.transform = 'translateY(100%) !important';

      setTimeout(() => {
        this.doCloseModal(modal);
      }, 300);
    } else {
      this.doCloseModal(modal);
    }
  }

  // 执行关闭操作
  doCloseModal(modal) {
    const index = this.activeModals.indexOf(modal);
    if (index > -1) {
      this.activeModals.splice(index, 1);
    }

    // 移除优化类
    modal.classList.remove('mobile-modal-optimized');

    // 如果没有其他模态框，恢复body样式
    if (this.activeModals.length === 0) {
      this.restoreBodyStyles();
    }

    // 触发关闭事件
    modal.dispatchEvent(new CustomEvent('closed'));
  }

  // 恢复body样式
  restoreBodyStyles() {
    const body = document.body;

    if (body.hasAttribute('data-modal-open')) {
      body.removeAttribute('data-modal-open');

      // 恢复原始样式
      Object.keys(this.originalBodyStyles).forEach(property => {
        body.style[property] = this.originalBodyStyles[property];
      });

      this.originalBodyStyles = {};
    }
  }

  // 手动优化模态框
  static optimizeModal(modal) {
    const optimizer = new MobileModalOptimizer();
    optimizer.optimizeModal(modal);
  }

  // 检查是否为移动设备
  static isMobile() {
    return window.innerWidth <= 768;
  }
}

// 自动初始化
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    new MobileModalOptimizer();
  });
}

