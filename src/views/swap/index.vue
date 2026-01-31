<template>
  <div id="container">

    <div class="contents">
      <h1>

        {{ $t('swap.title') }}
      </h1>
      <div class="swap-card">

        <!-- 出售 -->
        <div class="swap-row">
          <div class="swap-label">{{ $t('swap.sell') }}</div>
          <div class="swap-amount-row">

            <input type="number" v-model="amountIn" class="swap-amount-input" placeholder="0.00" :disabled="!address"
              @input="validateAndCorrectAmount" @blur="validateAndCorrectAmount" />
            <div class="swap-token-btn" @click="selIcon(1, fromSymbol)">
              <img :src="fromIcon" alt="">
              <span>{{ fromSymbol }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12.5 6L7.99998 10.5L3.5 6" stroke="#8E8E92" stroke-width="1.5" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
          </div>
          <div class="swap-balance">

            <div v-if="!prohibitSwap">
              {{ $t('swap.balance') }}:
              <img src="./loading.svg" alt="" style="width: 25px;
            animation: rotate 5s linear infinite;" v-if="isfromprocess">
              <span v-else> {{ trimTrailingZeros(fromBalance) }}</span>
            </div>
            <div v-else style="color: crimson;"> {{ prohibitReason }}</div>
          </div>


        </div>
        <!-- 方向切换 -->
        <div class="swap-switch-row" @click="reverseToken">
          <div class="swap-switch-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 9L8 6M8 6L11 9M8 6V18" stroke="#00CE7A" stroke-width="1.5" stroke-linecap="round"
                stroke-linejoin="round" />
              <path d="M19 15L16 18M16 18L13 15M16 18L16 6" stroke="#00CE7A" stroke-width="1.5" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </div>
        </div>
        <!-- 购买 -->
        <div class="swap-row">
          <div class="swap-label"> {{ $t('swap.buy') }}</div>
          <div class="swap-amount-row">
            <img src="./loading.svg" alt="" style="width: 25px;
            animation: rotate 5s linear infinite;" v-if="isestimateQuote">
            <input type="text" v-model="amountOut" class="swap-amount-input" placeholder="0.00" disabled v-else />
            <div class="swap-token-btn" @click="selIcon(2, toSymbol)">
              <img :src="toIcon" alt="">
              <span>{{ toSymbol }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12.5 6L7.99998 10.5L3.5 6" stroke="#8E8E92" stroke-width="1.5" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
          </div>
          <div class="swap-balance">

            {{ $t('swap.balance') }} :
            <img src="./loading.svg" alt="" style="width: 25px;
            animation: rotate 5s linear infinite;" v-if="tofromprocess">
            <span v-else> {{ trimTrailingZeros(toBalance) }}</span>


          </div>
          <!-- <div style="font-size:12px;color:#38e899;margin-top:2px;text-align: left;">
            {{ $t('swap.rateWarn') }}：
            <img src="./loading.svg" alt="" style="width: 25px;
            animation: rotate 5s linear infinite;" v-if="isestimateQuote">

            <b v-else>{{ minReceive }}{{ toSymbol }}</b>
          </div> -->
        </div>
        <div class="swap-setting-row" @click="showModal = true">
          <span class="setting-label"> {{ $t('swap.setSlip') }}</span>

          <span class="setting-label">
            {{ slippageInput }}

            %
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3.5L10.5 8.00002L6 12.5" stroke="#8E8E92" stroke-width="1.5" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </span>

        </div>
        <button class="swap-main-btn" v-if="status !== 'connected'" @click="connectWalleted()">
          {{ $t('swap.connectWallet') }}
        </button>

        <button class="swap-main-btn" v-else @click="sure()"
        :disabled="isprocess || doSwapprohibitSwap || !amountIn || isestimateQuote">
          <img src="./loading.svg" alt="" style="width: 30px;
            animation: rotate 5s linear infinite;" v-if="isprocess">
          <span v-else>
            {{ disableReason || $t('swap.doswaps') }}
          </span>
        </button>

      </div>
    </div>
    <!-- 选择币种弹框 -->
    <TokenModal :visible="tokenModalVisible" :tokens="allAcconts" @select="handleSelect"
      @close="tokenModalVisible = false" />
    <!-- 弹窗 -->
    <SlippageModal v-model:value="slippage" :visible="showModal" @close="showModal = false"
      @confirm="onSlippageConfirm" />
  </div>
</template>

<script setup>
import ethIcon from '@/assets/coin/eth.png'
import daiIcon from '@/assets/coin/dai.png'
import usdtIcon from '@/assets/coin/usdt.png'
import usdcIcon from '@/assets/coin/usdol.png'
import cpIcon from "@/assets/coin/Dolphinet.png"
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
// import { getWalletClient } from '@wagmi/core'
import { readContract, estimateFeesPerGas } from '@wagmi/core'
import { config } from '../../wagmi.ts'
const { t } = useI18n()

import { useCounterStore } from '@/stores/counter'
import { storeToRefs } from 'pinia'

// 拿到 store
const counterStore = useCounterStore()
const { visible, isLogin } = storeToRefs(counterStore)
import {
  useChainId, useConnect, useDisconnect, useAccount,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt
} from '@wagmi/vue'
// const transactionHash = ref(null)
// const approveHash = ref(null)

// const readContract = useReadContract()
// const readContractAsync = readContract.refetch




const txHash = ref('')
const approvalHash = ref('')
const setTxHash = (hash) => {
  txHash.value = hash
  transactionHash.value = hash  // 设置useWaitForTransactionReceipt监听的变量
  console.log('🎯 交易哈希:', hash)
}

// 授权哈希处理函数
const setApprovalHash = (hash) => {
  approvalHash.value = hash
  approveHash.value = hash  // 设置useWaitForTransactionReceipt监听的变量
  console.log('🔐 授权哈希:', hash)
}
const transactionHash = ref(null)
const approveHash = ref(null)

// 监听交易确认状态
const { isSuccess: txSuccess, isLoading: txLoading } = useWaitForTransactionReceipt({
  hash: computed(() => transactionHash.value),
  enabled: computed(() => !!transactionHash.value),
})

const { isSuccess: approveSuccess, isLoading: approveLoading } = useWaitForTransactionReceipt({
  hash: computed(() => approveHash.value),
  enabled: computed(() => !!approveHash.value),
})
// ...
// 监听交易成功后刷新余额
watch(txSuccess, async (success) => {
  if (success) {
    console.log('✅ 交易已确认，刷新余额')
    await fetchAllBalancesV6(provider, userAddress.value, allAcconts.value)
    amountIn.value = ''
    amountOut.value = ''
    eventBus.emit('custom-event', '发送的数据')
    ElMessage.success(t('swap.messages.swapSuccess'))
    transactionHash.value = null // 重置状态
    isprocess.value = false
  } else {
    isprocess.value = false
  }
})

watch(approveSuccess, (success) => {
  if (success) {
    console.log('✅ 授权已确认')
    // ElMessage.success('✅ Approve 成功')
    approveHash.value = null // 重置状态
  }
})


const { connect, connectors, error } = useConnect();
const { address, status } = useAccount()
import { eventBus } from '../../utils/eventBus'

import VConsole from 'vconsole';
const vConsole = new VConsole();
// const { connector } = useAccount()
// console.log(connector)

console.log(status)
import TokenModal from './tokenSelect.vue'
import { ref, onMounted, watch } from 'vue'
import SlippageModal from "./SlippageModal.vue"
import { BrowserProvider, Contract, parseUnits, formatUnits, MaxUint256, JsonRpcProvider } from 'ethers'
import { estimateQuotes, getPoolReserves, TOKEN_LIST } from './uniswapQuote'
import { doSwaps } from "./doSwap.js"
import { computed } from 'vue'
let provider, signer
const routerAddress = '0x84D95e5d767d10841387fba50B94534ffB5aeFab'
const wethAddress = '0xFEde7dF3dfdaaBeC24B0B41aEC75500A35C201fA'
const userAddress = ref('')
const connected = ref(false)
const tokenModalVisible = ref(false)
let fromSymbol = ref('DOL')
let toSymbol = ref("USDT")
const rate = ref("")
const isprocess = ref(false)
const isfromprocess = ref(false)
const tofromprocess = ref(false)

const isestimateQuote = ref(false)
const minReceive = ref()
const trade = ref(null)
const prohibitReason = ref('')
const prohibitSwap = computed(() => prohibitReason.value !== '')
const messages = computed(() => ({
  approvalSubmitted: t('swap.messages.approvalSubmitted'),
  userReject: t('swap.messages.userReject'),
  insufficientFunds: t('swap.messages.insufficientFunds'),
  slippageTooHigh: t('swap.messages.slippageTooHigh'),
  swapFail: t('swap.messages.swapFail'),

  // 错误消息
  userCancelledAuth: t('swap.messages.userCancelledAuth'),
  userCancelledTransaction: t('swap.messages.userCancelledTransaction'),
  insufficientBalance: t('swap.messages.insufficientBalance'),
  slippageError: t('swap.messages.slippageError'),
  swapFailed: t('swap.messages.swapFailed'),
  transactionSuccess: t('swap.messages.transactionSuccess'),

  // 错误类型
  tokenUndefined: t('swap.messages.tokenUndefined'),
  noValidTrade: t('swap.messages.noValidTrade'),
  tokenNotDefined: t('swap.messages.tokenNotDefined'),
  incompleteParams: t('swap.messages.incompleteParams'),
  invalidSlippage: t('swap.messages.invalidSlippage'),
  slippageTooLow: t('swap.messages.slippageTooLow'),
  sameTokenSwap: t('swap.messages.sameTokenSwap'),
  allowanceError: t('swap.messages.allowanceError')
}))



const disableReason = computed(() => {
  // 首先检查是否是禁止的交易对
  if (isProhibitedPair.value) {
    return t('swap.usdtUsdolProhibited') || 'USDT 和 USDOL 之间不允许互换'
  }
  
  const balance = parseFloat(fromBalance.value)
  const inputAmount = parseFloat(amountIn.value)

  if (balance <= 0) return t('swap.nofund')
  if (!amountIn.value || amountIn.value === '') return '' // 空值时不显示错误
  if (isNaN(inputAmount) || inputAmount <= 0) return '请输入有效金额'
  if (inputAmount > balance) return t('swap.nofund')
  
  return ''
})
function trimTrailingZeros(valueStr) {
  return String(valueStr).replace(/\.?0+$/, '')
}
const doSwapprohibitSwap = computed(() => disableReason.value !== '')

const showModal = ref(false)
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
]
const current = ref()
const skipWatch = ref(false)
const fromTokens = computed(() => TOKEN_LIST[fromSymbol.value])
const toTokens = computed(() => TOKEN_LIST[toSymbol.value])
const decimals = computed(() => fromTokens.value?.decimals)
const fromBalance = computed(() => {
  const acc = allAcconts.value.find(a => a.symbol === fromSymbol.value)
  return acc ? acc.blance : 0
})

//
const toBalance = computed(() => {
  const acc = allAcconts.value.find(a => a.symbol === toSymbol.value)
  return acc ? acc.blance : 0
})
const fromIcon = computed(() => {
  const acc = allAcconts.value.find(a => a.symbol === fromSymbol.value)
  return acc ? getIconUrl(acc.icon) : ''
})
// 验证和修正输入金额
function validateAndCorrectAmount() {
  if (!amountIn.value) return

  let value = amountIn.value.toString()

  // 移除非数字字符（除了小数点）
  value = value.replace(/[^0-9.]/g, '')

  // 确保只有一个小数点（保留第一个，移除后续的）
  const parts = value.split('.')
  if (parts.length > 2) {
    value = parts[0] + '.' + parts[1]
  }

  // 修复：更精确的前导零处理
  // 只处理类似 "000123" 或 "01" 这样的情况，但保留 "0.xxx" 格式
  if (value.match(/^0+[1-9]/)) {
    // 移除多余的前导零，但保留一个0（如果后面跟着小数点）
    value = value.replace(/^0+/, '')
  } else if (value.match(/^0{2,}$/)) {
    // 多个零的情况，只保留一个
    value = '0'
  }

  // 限制小数位数为8位
  if (value.includes('.')) {
    const [integer, decimal] = value.split('.')
    if (decimal && decimal.length > 8) {
      value = integer + '.' + decimal.substring(0, 8)
    }
  }

  // 确保不是负数（这个检查实际上不需要，因为我们已经过滤了非数字字符）
  if (value && !isNaN(parseFloat(value))) {
    const numValue = parseFloat(value)
    if (numValue < 0) {
      value = '0'
    }
  }

  // 如果值发生了变化，更新 amountIn
  if (value !== amountIn.value) {
    amountIn.value = value
  }
}
function handleSelect(token) {

  const selectedSymbol = token.symbol
  const state = current.value

  if (state === 1) {
    if (selectedSymbol === toSymbol.value) {
      // ⚠️ 交换 from ↔ to
      const temp = fromSymbol.value
      fromSymbol.value = toSymbol.value
      toSymbol.value = temp
      
      // 检查交换后是否是禁止的交易对
      checkProhibitedPair(fromSymbol.value, toSymbol.value)
      return
    }
    
    // 检查是否会形成禁止的交易对
    if (checkProhibitedPair(selectedSymbol, toSymbol.value)) {
      return // 如果是禁止的交易对，不进行选择
    }
    
    fromSymbol.value = selectedSymbol
  }

  if (state === 2) {
    if (selectedSymbol === fromSymbol.value) {
      // ⚠️ 交换 from ↔ to
      const temp = fromSymbol.value
      fromSymbol.value = toSymbol.value
      toSymbol.value = temp
      
      // 检查交换后是否是禁止的交易对
      checkProhibitedPair(fromSymbol.value, toSymbol.value)
      return
    }
    
    // 检查是否会形成禁止的交易对
    if (checkProhibitedPair(fromSymbol.value, selectedSymbol)) {
      return // 如果是禁止的交易对，不进行选择
    }
    
    toSymbol.value = selectedSymbol
  }
}
function connectWalleted() {

  if (!address.value) {

    isLogin.value = true


  }

}
function selIcon(state, symbol) {
  if (address.value) {
    tokenModalVisible.value = true
    current.value = state
  }
}
function onSlippageConfirm(newVal) {
  // 这里可以做额外的处理，比如保存、请求等
  slippageInput.value = newVal
  // console.log('用户设置的新滑点：', newVal)
}
// 动态返回购买币 icon 路径
const toIcon = computed(() => {
  const acc = allAcconts.value.find(a => a.symbol === toSymbol.value)
  return acc ? getIconUrl(acc.icon) : ''
})
function getIconUrl(icon) {
  // 这样写适配 Vite/Webpack
  return new URL(`${icon}`, import.meta.url).href
}

// const allAcconts = ref([
//   { symbol: 'ETH', decimals: 18, token: TOKEN_LIST.ETH, icon: ethIcon, blance: 0,isNative: true, },
//   { symbol: 'DAI', decimals: 18, token: TOKEN_LIST.DAI, icon: daiIcon, blance: 0,isNative: false,},
//   { symbol: 'USDT', decimals: 6, token: TOKEN_LIST.USDT, icon: usdtIcon, blance: 0 ,isNative: false,},
//   { symbol: 'USDC', decimals: 6, token: TOKEN_LIST.USDC, icon: usdcIcon, blance: 0 ,isNative: false,},
// ])
const allAcconts = ref([
  { symbol: 'DOL', decimals: 18, token: TOKEN_LIST.DOL, icon: cpIcon, blance: 0, isNative: true, },

  { symbol: 'USDT', decimals: 6, token: TOKEN_LIST.USDT, icon: usdtIcon, blance: 0, isNative: false },
  { symbol: 'USDOL', decimals: 6, token: TOKEN_LIST.USDOL, icon: usdcIcon, blance: 0, isNative: false },
])

// 检查是否是禁止的交易对，如果是则显示弹窗
function checkProhibitedPair(from, to) {
  const fromUpper = from.toUpperCase()
  const toUpper = to.toUpperCase()
  
  // 检查是否是 USDT 和 USDOL 之间的互换
  const isProhibited = (fromUpper === 'USDT' && toUpper === 'USDOL') || 
                       (fromUpper === 'USDOL' && toUpper === 'USDT')
  
  if (isProhibited) {
    // 显示警告弹窗
    ElMessageBox.alert(
      t('swap.usdtUsdolProhibited') || 'USDT 和 USDOL 之间不允许直接兑换，请通过 DOL 或其他代币进行中转',
      t('swap.prohibitedPairTitle') || '交易限制',
      {
        confirmButtonText: t('swap.sure') || '确定',
        type: 'warning',
        center: true
      }
    )
  }
  
  return isProhibited
}

function reverseToken() {
  // 先检查反转后是否会形成禁止的交易对
  if (checkProhibitedPair(toSymbol.value, fromSymbol.value)) {
    return // 如果是禁止的交易对，不进行反转
  }

  skipWatch.value = true // 本次切换跳过 watch
  // 对调币种
  // if(fromSymbol.value ==toSymbol.value) {
  //   return
  // }
  const temp = fromSymbol.value
  fromSymbol.value = toSymbol.value
  toSymbol.value = temp
  // 对调数量
  const tempAmount = amountIn.value
  amountIn.value = amountOut.value
  amountOut.value = tempAmount

}
const amountIn = ref()
const slippageInput = ref(0.5)
const amountOut = ref(0)
async function connectWallet() {

  //   const client = await getWalletClient()

  // if (!client) throw new Error('请先连接钱包')

  // const injectedProvider = client.transport?.value?.provider
  // if (!injectedProvider) throw new Error('未找到 provider')


  if (status.value == "connected") {


    // const rpcUrl = 'https://cpchain.com' // 或其他 JSON-RPC 地址
    // provider =  new JsonRpcProvider('https://rpc-testnet.cpchain.com', 86606)
    provider = new JsonRpcProvider('https://rpc.dolphinode.world', 1520)
    // await provider.send('eth_requestAccounts', [])

    // signer = await provider.getSigner()
    userAddress.value = address.value
    // userAddress.value = await signer.getAddress()
    connected.value = true
    var result = await fetchAllBalancesV6(provider, userAddress.value, allAcconts.value)
    console.log(result)
  }

}

// 批量查询余额
/**
 *
 * @param {Provider} provider ethers v6 provider
 * @param {string} address 钱包地址
 * @param {Array} tokenList 你的 token 数组，含 ETH/USDT/DAI等
 */
async function fetchAllBalancesV6(provider, address, tokenList) {
  // 返回 Promise 数组
  isfromprocess.value = true
  tofromprocess.value = true
  const promises = tokenList.map(async (token) => {
    try {
      let raw
      if (token.isNative) {
        console.log(1)
        raw = await provider.getBalance(address)
      } else {
        // alert(1)
        const erc20 = new Contract(token.token.address, ERC20_ABI, provider)
        // console.log(erc20)
        console.log("-------------------------------------------------xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx--------------------------------------")
        raw = await erc20.balanceOf(address)
       
        
      }
      token.blance = Number(formatUnits(raw, token.decimals)).toFixed(6)
    } catch (e) {
        console.error(e)
      token.blance = '0'
    }
  })
  await Promise.all(promises)
  // 强制响应式：重新赋值触发 UI 刷新
  allAcconts.value = [...allAcconts.value]
  console.log(allAcconts.value)
  isfromprocess.value = false
  tofromprocess.value = false
  return tokenList
}

const prohibitReasonText = computed(() => t('swap.prohibitReasons'))

// 检查是否是禁止的交易对
const isProhibitedPair = computed(() => {
  const from = fromSymbol.value.toUpperCase()
  const to = toSymbol.value.toUpperCase()
  // 禁止 USDT 和 USDOL 互换
  return (from === 'USDT' && to === 'USDOL') || (from === 'USDOL' && to === 'USDT')
})

watch(
  [amountIn, fromSymbol, toSymbol, slippageInput, status],
  async ([newAmount, newFrom, newTo, newSlippage, newState]) => {
    if (skipWatch.value) {
      skipWatch.value = false  // 重置
      return
    }
    if (status.value != "connected") {
      return
    }

    if (!connected.value) return
    
    // 检查是否是禁止的交易对
    if (isProhibitedPair.value) {
      amountOut.value = ''
      rate.value = ''
      prohibitReason.value = t('swap.usdtUsdolProhibited') || 'USDT 和 USDOL 之间不允许互换'
      return
    }
    
    if (!newAmount || Number(newAmount) <= 0) {
      amountOut.value = ''
      rate.value = ''
      return
    }
    isestimateQuote.value = true
    const quote = await estimateQuotes({
      fromSymbol: newFrom,
      toSymbol: newTo,
      amountIn: newAmount,
      slippageInput: newSlippage,
      provider
    })
    if (quote && quote.trade) {
      amountOut.value = Number(quote.outputAmount).toFixed(6)
      rate.value = quote.rate
      minReceive.value = Number(quote.minAmountOut).toFixed(6)
      trade.value = quote.trade
    }
    const { fromReserve, toReserve } = await getPoolReserves({
      fromSymbol: newFrom,
      toSymbol: newTo,
      provider
    })
    console.log(`${newFrom}池子储备:`, fromReserve)
    console.log(`${newTo} 池子储备:`, toReserve)

    const balance = parseFloat(fromBalance.value)
    // if (Number(newAmount) > balance) {
    //   prohibitReason.value = '输入金额超过余额'
    // }

    // 检查池子流动性限制（30% 示例）
    if (Number(newAmount) > fromReserve * 0.5) {
      prohibitReason.value = prohibitReasonText
    }

    // 可选：滑点检查，假设 estimateQuotes 返回 rate 可比较
    // 这里就不额外算滑点百分比了（也可以加）

    else {
      prohibitReason.value = ''
    }

    isestimateQuote.value = false
  }
)



async function sure() {
  isprocess.value = true

  // 1️⃣ 检查钱包连接状态
  if (status.value !== 'connected') {
    ElMessage({
      message: t('swap.connectWallet'),
      type: 'error',
      duration: 1000,
      showClose: true,
    })
    isprocess.value = false
    return
  }

  // 2️⃣ 合约构造：非原生币才构造 fromTokenContract


  try {


    const result = await doSwaps({
      fromToken: fromTokens.value,
      toToken: toTokens.value,
      amountIn: amountIn.value,
      slippageInput: slippageInput.value,
      trade: trade.value,
      userAddress: address.value,
      routerAddress: routerAddress,
      decimals: decimals.value,
      wcpAddress: wethAddress,
      nativeSymbol: 'DOL', // ✅ 修正：与 uniswapQuote.js 中的原生币符号保持一致

      setTxHash,
      setApprovalHash,
      useExactApproval: true,
      chainId: 86606,
      messages: messages.value
    })

    if (result.success) {

      // await fetchAllBalancesV6(provider, userAddress.value, allAcconts.value)
    } else {
      isprocess.value = false
      console.error('❌ 交换失败:', result.error)
    }

  } catch (error) {
    isprocess.value = false
    console.error('❌ 交换过程中出错:', error)
  } finally {
    // isSwapping.value = false
  }
  // 3️⃣ 调用 swap



}

watch(
  status,
  (newStatus) => {
    if (newStatus === "connected" || newStatus === "disconnected") {
      connectWallet()
    }
    if (newStatus === "disconnected") {

      amountIn.value = ''
      amountOut.value = ''
      allAcconts.value.forEach(account => {
        account.blance = 0
      })
    }
  }
)
onMounted(() => {
  // connectWallet()
})
</script>

<style lang="scss" scoped>
#container {
  background: #121212 url("../../assets/faucet_bg.png") no-repeat;
  background-size: 100% 100%;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  align-items: center;

  // padding-top: 100px;
  .contents {
    // background: red;
    padding-top: 80px;
    // height: 100vh;
    // width: h;

  }

  h1 {
    color: #FFF;
    text-align: center;

    font-size: 40px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    width: 100%;

    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 32px;
  }
}

/* Chrome、Safari、Edge、Opera */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type="number"] {
  -moz-appearance: textfield;
}

/* 可选：让 input 看起来像普通文本框（不是数字框） */
input[type="number"] {
  appearance: textfield;
  /* 兼容性需要自行权衡 */
}

.swap-wrap {
  min-height: 100vh;
  background: #D9D9D9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.swap-card {
  max-width: 448px;
  border-radius: 24px;
  background: var(---, #1E1E1E);
  border: 1.5px solid #222326;
  padding: 16px;
  position: relative;

  .swap-row {
    border-radius: 20px;
    border: 1px solid #2E2F32;
    margin-bottom: 16px;
    padding: 16px;

    .swap-label {
      color: #FFF;
      font-size: 14px;
      margin-bottom: 10px;
      text-align: left;
    }

    .swap-amount-row {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .swap-amount-input {
        background: transparent;
        border: none;
        color: #fff;
        outline: none;
        font-size: 32px;
        font-weight: 600;
        width: 80%;
      }

      .swap-token-btn {
        display: flex;
        align-items: center;
        border-radius: 100px;
        border: 1px solid #2E2F32;
        background: #151517;
        padding: 8px 12px;
        cursor: pointer;
        // width: 81px;
        justify-content: center;

        img {
          width: 16px;
          margin: 0 2px;
        }

        span {
          color: #fff;
          font-size: 12px;
          margin: 0 2px;
        }
      }

      .swap-token-btn.select {
        background: #15e784;
        color: #fff;
      }
    }

    .swap-balance {
      font-size: 14px;
      color: #fff;
      margin-top: 5px;
      text-align: left;
      display: flex;
      align-items: center;
    }
  }

  .swap-switch-row {
    display: flex;
    justify-content: center;
    position: absolute;
    width: calc(100% - 32px);
    top: 125.4px;
    // bottom: 0px;
    // transform: translateY(-50%);

    .swap-switch-btn {
      border: 1px solid #2E2F32;
      background: #1E1E1E;
      border-radius: 50%;

      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
  }

  .swap-setting-row {
    display: flex;
    height: 48px;
    padding: 0 16px;
    justify-content: space-between;
    border-radius: 100px;
    border: 1px solid #2E2F32;
    align-items: center;
    margin-bottom: 16px;

    .setting-label {
      color: #fff;
      font-size: 15px;
      font-weight: 500;
      display: flex;
      align-items: center;
    }

    .slip-btn {
      background: none;
      color: #fff;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
  }

  .swap-main-btn {
    width: 100%;
    height: 48px;
    border: none;
    border-radius: 100px;
    background: #2E2F32;
    color: #8E8E92;
    font-size: 16px;
    font-weight: 700;
    cursor: not-allowed;
    opacity: 0.75;
    margin-top: 4px;
    outline: none;

    &:not([disabled]) {
      background: #00CE7A;
      color: #1A1E1D;
      cursor: pointer;
      opacity: 1;
    }
  }
}


@media (max-width: 768px) {
  #container {
    width: calc(100vw - 30px);
    padding: 0 15px;

    h1 {
      font-size: 24px;
      margin-bottom: 24px;
    }
  }
}
</style>
