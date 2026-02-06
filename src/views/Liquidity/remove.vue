<template>
  <div v-if="visible" class="modal-mask">
    <div class="modal-box">
      <div class="modal-title">
        <span>{{ $t('liquidity.delliquidity') }}</span>
        <span class="close-btn" @click="close">×</span>
      </div>
      
      <!-- Percentage selection buttons -->
 
      
      <div class="modal-content">
        <input
          v-model="displayValue"
          type="text"
          class="modal-input"
          @input="handleInput"
          @blur="onBlur"
          @keydown.stop
          @keypress="onKeyPress"
          @paste.prevent
          placeholder=""
          autocomplete="off"
        />
        <!-- <span class="modal-unit">LP</span> -->
      </div>
      <div class="percentage-buttons">
        <div 
          v-for="percent in [10, 50,80, 100]" 
          :key="percent"
          :class="['percent-btn', { active: selectedPercent === percent }]"
          @click="selectPercent(percent)"
        >
          {{ percent }}%
        </div>
      </div>
      <div class="balance-info">
        <span> {{ $t('liquidity.balance') }}: {{ formattedMaxBalance }} </span>
      </div>
      
      <div v-if="warn" class="modal-warn">{{ warn }}</div>
      
      <button 
        class="modal-confirm" 
        @click="confirm"
        :disabled="!displayValue || parseFloat(displayValue) <= 0 || maxBalanceNum <= 0"
      >
      {{ $t('liquidity.delliquidity') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  visible: Boolean,
  maxBalance: {
    type: String,
    default: '0'
  }
})

const emits = defineEmits(['close', 'confirm'])

const displayValue = ref('')
const selectedPercent = ref(null)
const warn = ref('')

const maxBalanceNum = computed(() => {
  const balance = parseFloat(props.maxBalance) || 0
  console.log('🔍 删除流动性弹窗 - maxBalance:', props.maxBalance, 'parsed:', balance)
  return balance
})

// 改进格式化逻辑，让小数值更易读
const formattedMaxBalance = computed(() => {
  const balance = maxBalanceNum.value
  if (balance === 0) return '0.000000'
  
  // 对于非常小的数字，显示为完整小数而不是科学计数法
  if (balance < 0.000001) {
    // 转换科学计数法为完整小数字符串
    const str = balance.toFixed(18)
    // 移除尾部多余的0，但至少保留6位小数
    const trimmed = str.replace(/(\.\d{6,}?)0+$/, '$1')
    return trimmed
  }
  
  if (balance < 0.01) return balance.toFixed(8) // 8位小数
  return balance.toFixed(6) // 6位小数
})

watch(() => props.visible, (newVal) => {
  if (newVal) {
    displayValue.value = ''
    selectedPercent.value = null
    warn.value = ''
  }
})

function close() {
  emits('close')
}

function selectPercent(percent) {
  selectedPercent.value = percent
  const amount = maxBalanceNum.value * percent / 100
  console.log(`📊 选择百分比 ${percent}%:`, { maxBalance: maxBalanceNum.value, amount })
  
  // 根据数值大小选择合适的格式 - 避免科学计数法
  let formatted
  if (amount === 0) {
    formatted = '0'
  } else if (amount < 0.000001) {
    // 使用完整小数格式而不是科学计数法
    formatted = amount.toFixed(18).replace(/(\.\d{6,}?)0+$/, '$1')
  } else if (amount < 0.01) {
    formatted = amount.toFixed(8)
  } else {
    formatted = amount.toFixed(6)
  }
  
  displayValue.value = trimTrailingZeros(formatted)
  warn.value = ''
}

function trimTrailingZeros(str) {
  return str.replace(/\.?0+$/, '')
}

function handleInput(e) {
  warn.value = ''
  selectedPercent.value = null // Clear percentage selection when manually inputting
  
  let val = e.target.value
  
  // 支持科学计数法（如 1.23e-7）
  if (val.toLowerCase().includes('e')) {
    displayValue.value = val
    return
  }
  
  // Only allow numbers and decimal points
  val = val.replace(/[^\d.]/g, '')
  // Remove leading zeros
  val = val.replace(/^0+(\d)/, '$1')
  // Handle multiple decimal points
  val = val.replace(/\.{2,}/g, '.')
  val = val.replace('.', '$#$').replace(/\./g, '').replace('$#$', '.')
  
  // Limit decimal places to 18 (support very small values)
  const parts = val.split('.')
  if (parts[1] && parts[1].length > 18) {
    parts[1] = parts[1].slice(0, 18)
  }
  val = parts.join('.')
  
  // Check if exceeds maximum balance
  if (val && parseFloat(val) > maxBalanceNum.value) {
    warn.value = `${t('liquidity.removeModel.exceedsMaxBalance')} ${formattedMaxBalance.value}`
    val = String(maxBalanceNum.value)
  }
  
  displayValue.value = val
}

function onBlur() {
  let val = displayValue.value
  if (val === '' || isNaN(Number(val))) {
    displayValue.value = ''
    return
  }
  
  let num = Number(val)
  if (num < 0) {
    warn.value = t('liquidity.removeModel.amountCannotBeNegative')
    num = 0
  } else if (num > maxBalanceNum.value) {
    warn.value = `${t('liquidity.removeModel.exceedsMaxBalance')} ${formattedMaxBalance.value}`
    num = maxBalanceNum.value
  }
  
  // 格式化输出，避免科学计数法，使用完整小数
  if (num > 0) {
    if (num < 0.000001) {
      const str = num.toFixed(18).replace(/(\.\d{6,}?)0+$/, '$1')
      displayValue.value = trimTrailingZeros(str)
    } else if (num < 0.01) {
      displayValue.value = trimTrailingZeros(num.toFixed(8))
    } else {
      displayValue.value = trimTrailingZeros(num.toFixed(6))
    }
  } else {
    displayValue.value = ''
  }
}

function onKeyPress(e) {
  const char = String.fromCharCode(e.which)
  if (!/[0-9.]/.test(char)) {
    e.preventDefault()
  }
}

function confirm() {
  let val = displayValue.value
  if (val === '' || isNaN(Number(val))) {
    warn.value = t('liquidity.removeModel.pleaseEnterValidAmount')
    return
  }
  
  let num = Number(val)
  if (num <= 0) {
    warn.value = t('liquidity.removeModel.amountMustBeGreaterThanZero')
    return
  }
  
  if (num > maxBalanceNum.value) {
    warn.value = `${t('liquidity.removeModel.exceedsMaxBalance')} ${formattedMaxBalance.value}`
    return
  }
  
  // 传递字符串而不是数字，保持精度（对于非常小的值很重要）
  emits('confirm', val)
  emits('close')
}
</script>

<style lang="scss" scoped>
.modal-mask {
  position: fixed;
  z-index: 9999;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  
  .modal-box {
    background: #151517;
    border-radius: 16px;
    min-width: 280px;
    min-height: 180px;
    box-shadow: 0 6px 40px #0009;
    padding: 20px 18px 16px 18px;
    display: flex;
    flex-direction: column;
    
    .modal-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 15px;
      color: #fff;
      margin-bottom: 18px;
      
      .close-btn {
        font-size: 20px;
        color: #888;
        cursor: pointer;
        line-height: 1;
        
        &:hover {
          color: #fff;
        }
      }
    }
    
    .percentage-buttons {
      display: flex;
      gap: 4px;
      padding-top: 15px;
      margin-bottom: 16px;
      
      .percent-btn {
        color: #8E8E92;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: normal;
        padding: 4px 8px;
        border-radius: 100px;
        border: 1px solid #2E2F32;
        background: transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        flex: 1;
        
        &:hover {
          border-color: #5B9CF5;
          color: #5B9CF5;
        }
        
        &.active {
          border: 1px solid #5B9CF5;
          color: #5B9CF5;
          background: rgba(0, 206, 122, 0.1);
        }
      }
    }
    
    .modal-content {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      background: #101012;
      border-radius: 8px;
      padding: 0 10px;
      border: 1px solid #222;
      
      .modal-input {
        flex: 1;
        background: transparent;
        border: none;
        color: #fff;
        font-size: 18px;
        outline: none;
        padding: 12px 0;
        text-align: left;
        
        &::placeholder {
          color: #555;
        }
      }
      
      .modal-unit {
        color: #555;
        margin-left: 4px;
        font-size: 16px;
      }
    }
    
    .balance-info {
      color: #888;
      font-size: 12px;
      margin-bottom: 10px;
      text-align: right;
    }
    
    .modal-warn {
      color: #ffca6f;
      font-size: 13px;
      padding: 2px 0 8px 0;
      min-height: 16px;
      text-align: left;
    }
    
    .modal-confirm {
      width: 100%;
      border-radius: 999px;
      border: none;
      height: 38px;
      background: #5B9CF5;
      color: #111;
      font-weight: bold;
      font-size: 16px;
      margin-top: 2px;
      cursor: pointer;
      transition: background 0.2s;
      
      &:hover:not(:disabled) {
        background: #5B9CF5;
      }
      
      &:disabled {
        background: #333;
        color: #666;
        cursor: not-allowed;
      }
    }
  }
}
</style>