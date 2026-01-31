import { Pair, Route, Trade } from '@uniswap/v2-sdk'
import {
  CurrencyAmount, TradeType, Percent, Token
} from '@uniswap/sdk-core'
import { Contract, parseUnits, formatUnits } from 'ethers'
import { getCreate2Address } from '@ethersproject/address'
import { keccak256, pack } from '@ethersproject/solidity'

const FACTORY_ADDRESS = '0xf0D5b329e7A43dC014d46B79cd99b82EB26fbC37'
const INIT_CODE_HASH = '0xcaa2da3f024b3624669464e0d7cb4cd3ce62345cc347579fc16aecc3b020c722'

// ✅ Token 列表（原生币是 DOL）
const TOKEN_LIST = {
  DOL: {
    symbol: 'DOL',
    decimals: 18,
    address: '',
    isNative: true,
    chainId: 1520
  },
  CP: { // 别名，指向 DOL
    symbol: 'DOL',
    decimals: 18,
    address: '',
    isNative: true,
    chainId: 1520
  },
  USDT: new Token(1520, '0xF61C878b8116358BCfC5b6b45275035a658017Fa', 6, 'USDT', 'Tether USD'),
  USDOL: new Token(1520, '0xE1B7bEE68E1803A3Ba13E75dE1dEC117e4654500', 6, 'USDOL', 'USDOL'),
  WDOL: new Token(1520, '0xFEde7dF3dfdaaBeC24B0B41aEC75500A35C201fA', 18, 'WDOL', 'Wrapped DOL')
}

// ✅ 获取 SDK Token 实例（DOL 原生币转换为 WDOL 用于计算）
function getSdkToken(symbol) {
  const token = TOKEN_LIST[symbol]
  if (!token) throw new Error(`Token ${symbol} not found`)
  return token.isNative ? TOKEN_LIST.WDOL : token
}
// ✅ 计算 pair 地址（适配自定义工厂）
function getPairAddress({ tokenA, tokenB }) {
  const [token0, token1] = tokenA.sortsBefore(tokenB)
    ? [tokenA, tokenB]
    : [tokenB, tokenA]
  const salt = keccak256(
    ['bytes'],
    [pack(['address', 'address'], [token0.address, token1.address])]
  )
  return getCreate2Address(FACTORY_ADDRESS, salt, INIT_CODE_HASH)
}

// ✅ 判断 pair 是否存在且有流动性
// 修改：provider 参数可以是 JsonRpcProvider 或 signer
async function isPairAvailable(pairAddress, provider) {
  const abi = ["function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"]
  const pair = new Contract(pairAddress, abi, provider)
  try {
    const { reserve0, reserve1 } = await pair.getReserves()
    return BigInt(reserve0) > 0n && BigInt(reserve1) > 0n
  } catch (e) {
    return false
  }
}

/**
 * 💱 报价计算（含流动性判断）
 * 修改：provider 参数可以是 JsonRpcProvider 或 signer
 */
export async function estimateQuotes({
  fromSymbol,
  toSymbol,
  amountIn,
  slippageInput,
  provider // 修改：参数名从 signer 改为 provider，更通用
}) {
  const fromToken = getSdkToken(fromSymbol)
  const toToken = getSdkToken(toSymbol)
  const pairAddress = getPairAddress({ tokenA: fromToken, tokenB: toToken })
  console.log('[Pair Address]', pairAddress)

  const hasLiquidity = await isPairAvailable(pairAddress, provider)
  if (!hasLiquidity) throw new Error('Pair not deployed or no liquidity')

  const pairAbi = ["function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"]
  const pairContract = new Contract(pairAddress, pairAbi, provider)
  const { reserve0, reserve1 } = await pairContract.getReserves()

  const [token0, token1] = fromToken.sortsBefore(toToken)
    ? [fromToken, toToken]
    : [toToken, fromToken]

  const pairObj = new Pair(
    CurrencyAmount.fromRawAmount(token0, reserve0.toString()),
    CurrencyAmount.fromRawAmount(token1, reserve1.toString())
  )

  const amount = parseUnits(String(amountIn), fromToken.decimals)
  const route = new Route([pairObj], fromToken, toToken)
  const tradeTmp = new Trade(
    route,
    CurrencyAmount.fromRawAmount(fromToken, amount.toString()),
    TradeType.EXACT_INPUT
  )

  const outputAmount = formatUnits(tradeTmp.outputAmount.quotient.toString(), toToken.decimals)
  const rate = tradeTmp.executionPrice.toSignificant(6)

  // ✅ 支持高精度滑点：0.000001% ~ 任意小数精度
  const slippageDecimal = Number(slippageInput) / 100
  const slippage = new Percent(
    BigInt(Math.floor(slippageDecimal * 1e18)).toString(),
    '1000000000000000000' // denominator 为 1e18
  )

  const minOut = tradeTmp.minimumAmountOut(slippage)
  const minAmountOut = formatUnits(minOut.quotient.toString(), toToken.decimals)

  return { outputAmount, rate, minAmountOut, trade: tradeTmp }
}

/**
 * 📊 查询储备（含是否存在判断）
 * 修改：provider 参数可以是 JsonRpcProvider 或 signer
 */
export async function getPoolReserves({
  fromSymbol,
  toSymbol,
  provider // 修改：参数名从 signer 改为 provider，更通用
}) {
  const fromToken = getSdkToken(fromSymbol)
  const toToken = getSdkToken(toSymbol)

  const pairAddress = getPairAddress({ tokenA: fromToken, tokenB: toToken })
  const hasLiquidity = await isPairAvailable(pairAddress, provider)
  if (!hasLiquidity) return { fromReserve: 0, toReserve: 0 }

  const pairAbi = ["function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"]
  const pairContract = new Contract(pairAddress, pairAbi, provider)
  const { reserve0, reserve1 } = await pairContract.getReserves()

  const [token0, token1] = fromToken.sortsBefore(toToken)
    ? [fromToken, toToken]
    : [toToken, fromToken]

  const reserve0Formatted = Number(formatUnits(reserve0.toString(), token0.decimals))
  const reserve1Formatted = Number(formatUnits(reserve1.toString(), token1.decimals))

  return token0.address === fromToken.address
    ? { fromReserve: reserve0Formatted, toReserve: reserve1Formatted }
    : { fromReserve: reserve1Formatted, toReserve: reserve0Formatted }
}

// ✅ 导出
export {
  TOKEN_LIST,
  getSdkToken,
  getPairAddress,
  isPairAvailable,
  FACTORY_ADDRESS,
  INIT_CODE_HASH
}