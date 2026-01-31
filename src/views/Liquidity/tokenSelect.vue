<template>
    <transition name="fade">
        <div class="token-modal" v-if="visible">
            <div class="modal-mask" @click="close"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <span>{{ $t('swap.selicons') }}</span>
                    <img src="./close.svg" alt="" class="modal-close" @click="close">
                    <!-- <span class="modal-close" @click="close">×</span> -->
                </div>
                <div class="search-box">
                    <input v-model="search" :placeholder="$t('swap.searchicons')" />
                </div>
                <div class="token-list">
                    <div class="token-list-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="17" viewBox="0 0 16 17" fill="none">
                            <path fill-rule="evenodd" clip-rule="evenodd"
                                d="M7.99931 11.86L4.4726 13.3541L4.80376 9.5383L2.29297 6.6459L6.02435 5.7817L7.99931 2.5L9.97427 5.7817L13.7056 6.6459L11.1949 9.5383L11.526 13.3541L7.99931 11.86Z"
                                fill="#8E8E92" />
                            <path
                                d="M7.99914 2C8.17452 2.00001 8.33709 2.09192 8.42752 2.24219L10.2934 5.34245L13.8181 6.15885C13.989 6.19843 14.1266 6.32473 14.1808 6.49154C14.2349 6.65833 14.1981 6.84153 14.0831 6.97396L11.7107 9.70573L12.0239 13.3105C12.039 13.4853 11.9613 13.6554 11.8195 13.7585C11.6776 13.8615 11.492 13.8829 11.3305 13.8145L7.99849 12.403L4.66711 13.8145C4.50567 13.8827 4.32 13.8615 4.17818 13.7585C4.03646 13.6553 3.95924 13.4852 3.9744 13.3105L4.28625 9.70508L1.91515 6.97396C1.80019 6.84152 1.76332 6.65833 1.8175 6.49154C1.8717 6.32473 2.00926 6.19843 2.18013 6.15885L5.70422 5.34245L7.57075 2.24219L7.60786 2.1888C7.70196 2.07047 7.84562 2 7.99914 2ZM6.45226 6.03971C6.38247 6.15553 6.26889 6.23832 6.13716 6.26888L3.21463 6.94531L5.18143 9.21029C5.27014 9.31249 5.31353 9.44655 5.30187 9.58138L5.04211 12.5697L7.80383 11.3997L7.85135 11.3822C7.96354 11.3475 8.08534 11.3535 8.19445 11.3997L10.9555 12.5697L10.6964 9.58138C10.6847 9.44655 10.7281 9.31249 10.8168 9.21029L12.783 6.94531L9.86112 6.26888C9.72927 6.23831 9.61516 6.15568 9.54536 6.03971L7.99849 3.4694L6.45226 6.03971Z"
                                fill="#8E8E92" />
                        </svg>
                        <span style="margin-left: 4px;">
                            {{ $t('swap.basicons') }}
                        </span>
                    
                    </div>
                    <div v-for="token in filteredTokens" :key="token.symbol" class="token-item" @click="select(token)">
                        <img :src="getIcon(token.icon)" class="token-icon" />
                        <div class="token-info">
                            <div class="token-symbol">{{ token.symbol }}</div>
                            <div class="token-address">{{ formatAddress(token.token?.address) }}</div>
                        </div>
                        <div class="token-balance">{{ trimTrailingZeros(token.balance ?? token.blance) }}</div>
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>
  
<script setup>
import { ref, computed } from 'vue'
const props = defineProps({
    visible: Boolean,
    tokens: Array, // 你的 allAcconts 列表即可
    excludeSymbol: String, // 新增，用于过滤
})
const emit = defineEmits(['close', 'select'])
const search = ref('')

// 支持 balance 或 blance 字段兼容
const filteredTokens = computed(() => {
    let list = props.tokens
    if (props.excludeSymbol) {
        list = list.filter(token => token.symbol !== props.excludeSymbol)
    }
    if (!search.value) return list
    const keyword = search.value.trim().toLowerCase()
    return list.filter(token =>
        token.symbol.toLowerCase().includes(keyword) ||
        (token.token?.address && token.token.address.toLowerCase().includes(keyword))
    )
})
function trimTrailingZeros(valueStr) {
    return String(valueStr).replace(/\.?0+$/, '')
}
function select(token) {
    emit('select', token)
    emit('close')
}
function close() {
    emit('close')
}
function formatAddress(addr) {
    if (!addr) return ''
    return addr.slice(0, 6) + '...' + addr.slice(-4)
}
function getIcon(icon) {
    // 支持本地路径或线上路径
    try {
        return new URL(icon, import.meta.url).href
    } catch {
        return icon
    }
}
</script>
  
<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity .24s cubic-bezier(.4, 0, .2, 1);
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.fade-enter-to,
.fade-leave-from {
    opacity: 1;
}

.token-modal {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;

    .modal-mask {
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
    }

    .modal-content {
        overflow: hidden;
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        top: 20%;
        width: 350px;
        background: #18191a;
        color: #fff;
        border-radius: 18px;
        padding: 24px;
        height: 400px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0, 0, 0, .3);
        animation: slideInRight .2s;
    }

    @keyframes slideInRight {
        from {
            right: -400px;
        }

        to {
            right: 0;
        }
    }

   

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 24px;
        // padding: 0 20px;
        // height: 54px;
    }
  
    .modal-close {
        font-size: 28px;
        cursor: pointer;
        user-select: none;
        line-height: 1;
    }
    @media screen and (max-width: 768px) {
        .modal-header {
            font-size: 18px;
        }
        .modal-content {
            top: auto;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            max-width: 90vw;
            // width: auto;
            // max-width: 100%;
            height: 400px;
            padding:  20px;
            border-radius: 18px 18px 0 0;
            animation: slideUp 0.25s ease-out;
        }
        .modal-close {
        font-size: 20px;
        cursor: pointer;
        user-select: none;
        line-height: 1;
    }
        @keyframes slideUp {
            from {
                transform: translateX(-50%) translateY(100%);
            }

            to {
                transform: translateX(-50%) translateY(0);
            }
        }
    }
    .search-box {
        // padding: 0 20px;
        // height: 80px;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 24px;
    }

    .search-box input {
        width: 100%;
        height: 38px;
        border: none;
        outline: none;
        // color: #666868;
        // padding: 10px;
        padding: 0 20px;
        border-radius: 100px;
        background: #252629;
        border: none;
        color: #fff;
        font-size: 16px;
    }

    .search-box input::placeholder {
        color: #666868;
    }

    .token-list-title {
      
        // padding: 0 20px 5px 20px;
        // height: 35px;
        color:  #8E8E92;
        text-align: left;
        display: flex;
        //  padding-left: 30px;
        align-items: center;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: normal;
    }

    .token-item {
        display: flex;
        align-items: center;
        // padding: ;
        cursor: pointer;
        height: 64px;
        // border-bottom: 1px solid #22232a;
        transition: background .2s;

        &:hover {
            background: #212226;
        }

        .token-icon {
            width: 38px;
            height: 38px;
            margin-right: 8px;
            border-radius: 50%;
        }

        .token-info {
            flex: 1;
        }

        .token-symbol {
            font-weight: 600;
            text-align: left;
            font-size: 14px;
        }

        .token-address {
            color: var(---, #666868);


            font-size: 12px;
            font-style: normal;
            font-weight: 400;
            line-height: normal;
            text-align: left;
        }

        .token-balance {
            min-width: 56px;
            text-align: right;

            color: var(---, #FFF);
            text-align: center;

            font-size: 14px;
            font-style: normal;
            font-weight: 500;
            line-height: normal;
        }
    }
}</style>
  