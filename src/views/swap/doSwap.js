import { parseGwei, parseUnits, encodeFunctionData } from 'viem'
import { Percent } from '@uniswap/sdk-core'
import { ElMessage } from 'element-plus'
import { readContract, estimateFeesPerGas, estimateGas, writeContract } from '@wagmi/core'
import { config } from '../../wagmi.ts'

// 手动定义 maxUint256
const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

// Router ABI 定义
const routerAbi = [
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }]
  },
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }]
  },
  {
    name: 'swapExactTokensForETH',
    type: 'function',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }]
  }
]

// ERC20 ABI 定义
const erc20Abi = [
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
]

/**
 * 精确的 gas 预估函数
 */
async function computedGas(abi, functionName, args, to, account, value = undefined) {
  try {
    console.log('🔍 Starting gas estimation...', {
      functionName,
      to,
      account,
      hasValue: !!value
    })

    // Calculate gas fees
    const feesPerGas = await estimateFeesPerGas(config)

    // Prepare the transaction data
    const txData = encodeFunctionData({
      abi,
      functionName,
      args,
    })

    console.log('📦 Transaction data prepared:', {
      dataLength: txData.length,
      dataPreview: txData.substring(0, 66) + '...'
    })

    // Estimate gas for the transaction
    const estimatedGas = await estimateGas(config, {
      data: txData,
      to: to,
      account: account,
      maxFeePerGas: feesPerGas.maxFeePerGas,
      maxPriorityFeePerGas: feesPerGas.maxPriorityFeePerGas,
      ...(value && { value })
    })

    // 添加 20% 的 gas 缓冲
    const gasWithBuffer = (estimatedGas * BigInt(120)) / BigInt(100)

    // 打印预估gas值
    console.log('⛽ Gas Estimation:', {
      functionName,
      estimatedGas: estimatedGas.toString(),
      gasWithBuffer: gasWithBuffer.toString(),
      bufferPercentage: '20%',
      maxFeePerGas: feesPerGas.maxFeePerGas.toString(),
      maxPriorityFeePerGas: feesPerGas.maxPriorityFeePerGas.toString(),
      totalMaxCost: (gasWithBuffer * feesPerGas.maxFeePerGas).toString() + ' wei'
    })

    return {
      gas: gasWithBuffer,
      maxFeePerGas: feesPerGas.maxFeePerGas,
      maxPriorityFeePerGas: feesPerGas.maxPriorityFeePerGas
    }
  } catch (error) {
    console.error('❌ Gas estimation failed:', error)
    console.error('📋 Estimate Gas Arguments:', {
      functionName,
      args: args.map(arg => typeof arg === 'bigint' ? arg.toString() : arg),
      to,
      account,
      value: value?.toString()
    })

    // 尝试从错误中提取有用信息
    if (error.message) {
      if (error.message.includes('insufficient funds')) {
        console.error('💸 Insufficient funds for gas * price + value')
      } else if (error.message.includes('execution reverted')) {
        console.error('⚠️ Transaction would revert. Possible reasons:')
        console.error('  - Insufficient token balance')
        console.error('  - Insufficient allowance')
        console.error('  - Slippage too low')
        console.error('  - Insufficient liquidity')
        console.error('  - Invalid parameters')
      }
    }

    // 回退到默认值（也添加20%缓冲）
    const baseFallbackGas = BigInt(2000000)
    const fallbackGasWithBuffer = (baseFallbackGas * BigInt(120)) / BigInt(100)
    
    const fallbackGas = {
      gas: fallbackGasWithBuffer,
      maxFeePerGas: parseGwei('20'),
      maxPriorityFeePerGas: parseGwei('2')
    }

    console.log('⛽ Gas Estimation (Fallback):', {
      functionName,
      baseFallbackGas: baseFallbackGas.toString(),
      fallbackGasWithBuffer: fallbackGasWithBuffer.toString(),
      bufferPercentage: '20%',
      maxFeePerGas: fallbackGas.maxFeePerGas.toString(),
      maxPriorityFeePerGas: fallbackGas.maxPriorityFeePerGas.toString(),
      note: 'Using fallback values with 20% buffer due to estimation failure'
    })

    return fallbackGas
  }
}

/**
 * Unified doSwaps supporting DOL native coin or ERC20 tokens on Dolphinet chain.
 * Uses @wagmi/vue hooks for contract interactions
 * 使用精确授权金额来减少钱包警告提示
 */
export async function doSwaps({
  fromToken,
  toToken,
  amountIn,
  slippageInput,
  trade,
  userAddress,
  routerAddress,
  decimals,
  wcpAddress,       // 👈 Dolphinet 链上的 Wrapped DOL 地址
  nativeSymbol = 'DOL', // 👈 原生币符号

  setTxHash,          // 👈 设置交易哈希的回调
  setApprovalHash,    // 👈 设置授权哈希的回调
  useExactApproval = true, // 👈 是否使用精确授权（减少钱包警告）
  
  // 👈 新增：国际化提示语对象
  messages = {}
}) {
  let error = null
  let txHash = null
  let didApprove = false

  function isNative(token) {
    if (!token) return false
    return token.symbol === nativeSymbol || token.isNative
  }

  function getTokenAddress(token) {
    if (!token) throw new Error(messages.tokenUndefined || 'Token undefined')
    return isNative(token) ? wcpAddress : token.address
  }

  try {
    // 参数验证
    if (!trade) throw new Error(messages.noValidTrade || 'No valid Trade object')
    if (!fromToken || !toToken) throw new Error(messages.tokenNotDefined || 'Token not defined')
    if (!userAddress || !routerAddress) throw new Error(messages.incompleteParams || 'Incomplete params')

    console.log('🔄 Starting swap:', {
      from: fromToken.symbol,
      to: toToken.symbol,
      amount: amountIn,
      slippage: slippageInput
    })

    // ✅ 高精度滑点支持：18 位
    const slippageDecimal = Number(slippageInput)
    if (isNaN(slippageDecimal) || slippageDecimal < 0) {
      throw new Error(messages.invalidSlippage || 'Invalid slippage input')
    }

    // ✅ 可选：滑点最小限制（防止用户设成0）
    if (slippageDecimal < 0.00000001) {
      throw new Error(messages.slippageTooLow || 'Slippage too low, may cause transaction to revert')
    }

    const numerator = BigInt(Math.floor(slippageDecimal * 1e18))
    const slippage = new Percent(numerator.toString(), '1000000000000000000') // 1e18 精度
    const minAmount = trade.minimumAmountOut(slippage).quotient.toString()
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20) // 20 分钟有效

    console.log('📊 Swap parameters:', {
      minAmount,
      deadline: deadline.toString(),
      slippagePercent: slippageDecimal
    })

    // 1️⃣ Native DOL → Token
    if (isNative(fromToken)) {
      if (isNative(toToken)) throw new Error(`${nativeSymbol} to ${nativeSymbol} ${messages.sameTokenSwap || 'swap not allowed'}`)

      console.log('🔄 Native to Token swap')
      const path = [wcpAddress, getTokenAddress(toToken)]
      const amountInParsed = parseUnits(amountIn.toString(), 18)

      console.log('📋 Native swap params:', {
        path,
        amountIn: amountInParsed.toString(),
        minAmount
      })

      // 精确 gas 预估
      console.log('⛽ Estimating gas for Native to Token swap...')
      const gasEstimate = await computedGas(
        routerAbi,
        'swapExactETHForTokens',
        [BigInt(minAmount), path, userAddress, deadline],
        routerAddress,
        userAddress,
        amountInParsed
      )

      const hash = await writeContract(config, {
        abi: routerAbi,
        address: routerAddress,
        functionName: 'swapExactETHForTokens',
        args: [
          BigInt(minAmount),
          path,
          userAddress,
          deadline
        ],
        value: amountInParsed,
        gas: gasEstimate.gas,
        maxFeePerGas: gasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas
      })

      txHash = hash
      setTxHash && setTxHash(hash)
      console.log('✅ Native swap submitted:', hash)
    }

    // 2️⃣ Token → Native DOL
    else if (isNative(toToken)) {
      console.log('🔄 Token to Native swap')
      const fromTokenAddress = getTokenAddress(fromToken)
      const path = [fromTokenAddress, wcpAddress]
      const amountInParsed = parseUnits(amountIn.toString(), decimals)

      console.log('📋 Token to Native params:', {
        fromToken: fromTokenAddress,
        path,
        amountIn: amountInParsed.toString(),
        minAmount
      })

      // 检查授权
      try {
        console.log('🔍 Checking allowance...')
        const allowanceResult = await readContract(config, {
          address: fromTokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [userAddress, routerAddress]
        })

        const allowance = BigInt(allowanceResult || 0)
        const amountInBigInt = BigInt(amountInParsed)

        console.log('💰 Allowance check:', {
          current: allowance.toString(),
          required: amountInBigInt.toString(),
          needsApproval: allowance < amountInBigInt
        })

        if (allowance < amountInBigInt) {
          // 根据配置选择授权金额
          const approvalAmount = useExactApproval ? amountInBigInt : maxUint256

          console.log('📝 Submitting approval for:', approvalAmount.toString())

          // 精确 gas 预估 - 授权
          console.log('⛽ Estimating gas for Token approval...')
          const approveGasEstimate = await computedGas(
            erc20Abi,
            'approve',
            [routerAddress, approvalAmount],
            fromTokenAddress,
            userAddress
          )

          const approveHash = await writeContract(config, {
            abi: erc20Abi,
            address: fromTokenAddress,
            functionName: 'approve',
            args: [routerAddress, approvalAmount],
            gas: approveGasEstimate.gas,
            maxFeePerGas: approveGasEstimate.maxFeePerGas,
            maxPriorityFeePerGas: approveGasEstimate.maxPriorityFeePerGas
          })

          setApprovalHash && setApprovalHash(approveHash)
          didApprove = true
          console.log('✅ Approval submitted:', approveHash)

          // 显示授权提示
          ElMessage({
            message: messages.approvalSubmitted || 'Approval submitted, waiting for confirmation...',
            type: 'info',
            duration: 3000,
            showClose: true
          })

          // ⚠️ 重要：等待授权交易确认，否则 gas 预估会失败
          console.log('⏳ Waiting for approval confirmation before swap...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (e) {
        console.error('❌ Approval error:', e)
        if (e.message && e.message.includes('User rejected')) {
          throw new Error(messages.userCancelledAuth || 'User cancelled the authorization operation')
        }
        throw new Error((messages.allowanceError || 'Failed to check/set allowance: ') + (e.message || e))
      }

      // 执行交换
      console.log('🔄 Submitting swap transaction...')

      // 精确 gas 预估 - 交换
      console.log('⛽ Estimating gas for Token to Native swap...')
      console.log('📋 Swap parameters for gas estimation:', {
        amountIn: amountInParsed.toString(),
        minAmount,
        path,
        userAddress,
        deadline: deadline.toString()
      })
      const swapGasEstimate = await computedGas(
        routerAbi,
        'swapExactTokensForETH',
        [amountInParsed, BigInt(minAmount), path, userAddress, deadline],
        routerAddress,
        userAddress
      )

      const hash = await writeContract(config, {
        abi: routerAbi,
        address: routerAddress,
        functionName: 'swapExactTokensForETH',
        args: [
          amountInParsed,
          BigInt(minAmount),
          path,
          userAddress,
          deadline
        ],
        gas: swapGasEstimate.gas,
        maxFeePerGas: swapGasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: swapGasEstimate.maxPriorityFeePerGas
      })

      txHash = hash
      setTxHash && setTxHash(hash)
      console.log('✅ Token to Native swap submitted:', hash)
    }

    // 3️⃣ ERC20 → ERC20
    else {
      console.log('🔄 ERC20 to ERC20 swap')
      const fromTokenAddress = getTokenAddress(fromToken)
      const toTokenAddress = getTokenAddress(toToken)

      // ✅ 验证地址格式
      if (!fromTokenAddress || !toTokenAddress) {
        throw new Error('Invalid token address')
      }
      if (fromTokenAddress.length !== 42 || toTokenAddress.length !== 42) {
        throw new Error(`Invalid address length: from=${fromTokenAddress.length}, to=${toTokenAddress.length}`)
      }
      if (!fromTokenAddress.startsWith('0x') || !toTokenAddress.startsWith('0x')) {
        throw new Error('Address must start with 0x')
      }

      const path = [fromTokenAddress, toTokenAddress]
      const amountInParsed = parseUnits(amountIn.toString(), decimals)

      console.log('📋 ERC20 to ERC20 params:', {
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        path,
        amountIn: amountInParsed.toString(),
        minAmount,
        deadline: deadline.toString(),
        userAddress,
        routerAddress
      })

      // ✅ 检查用户余额
      try {
        const balanceAbi = [{
          name: 'balanceOf',
          type: 'function',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }]
        }]
        const userBalance = await readContract(config, {
          address: fromTokenAddress,
          abi: balanceAbi,
          functionName: 'balanceOf',
          args: [userAddress]
        })
        console.log('💰 User token balance:', {
          balance: userBalance.toString(),
          required: amountInParsed.toString(),
          sufficient: BigInt(userBalance) >= BigInt(amountInParsed)
        })
        
        if (BigInt(userBalance) < BigInt(amountInParsed)) {
          throw new Error(messages.insufficientBalance || 'Insufficient token balance')
        }
      } catch (balanceError) {
        console.error('⚠️ Balance check failed:', balanceError)
      }

      // 检查授权
      try {
        console.log('🔍 Checking allowance...')
        const allowanceResult = await readContract(config, {
          address: fromTokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [userAddress, routerAddress]
        })

        const allowance = BigInt(allowanceResult || 0)
        const amountInBigInt = BigInt(amountInParsed)

        console.log('💰 Allowance check:', {
          current: allowance.toString(),
          required: amountInBigInt.toString(),
          needsApproval: allowance < amountInBigInt
        })

        if (allowance < amountInBigInt) {
          // 根据配置选择授权金额
          const approvalAmount = useExactApproval ? amountInBigInt : maxUint256

          console.log('📝 Submitting approval for:', approvalAmount.toString())

          // 精确 gas 预估 - 授权
          console.log('⛽ Estimating gas for ERC20 approval...')
          const approveGasEstimate = await computedGas(
            erc20Abi,
            'approve',
            [routerAddress, approvalAmount],
            fromTokenAddress,
            userAddress
          )

          const approveHash = await writeContract(config, {
            abi: erc20Abi,
            address: fromTokenAddress,
            functionName: 'approve',
            args: [routerAddress, approvalAmount],
            gas: approveGasEstimate.gas,
            maxFeePerGas: approveGasEstimate.maxFeePerGas,
            maxPriorityFeePerGas: approveGasEstimate.maxPriorityFeePerGas
          })

          setApprovalHash && setApprovalHash(approveHash)
          didApprove = true
          console.log('✅ Approval submitted:', approveHash)

          // 显示授权提示
          ElMessage({
            message: messages.approvalSubmitted || 'Approval submitted, waiting for confirmation...',
            type: 'info',
            duration: 3000,
            showClose: true
          })

          // ⚠️ 重要：等待授权交易确认，否则 gas 预估会失败
          console.log('⏳ Waiting for approval confirmation before swap...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (e) {
        console.error('❌ Approval error:', e)

        if (e.message && e.message.includes('User rejected')) {
          throw new Error(messages.userCancelledAuth || 'User cancelled the authorization operation')
        }
        throw new Error((messages.allowanceError || 'Failed to check/set allowance: ') + (e.message || e))
      }

      // 执行交换
      console.log('🔄 Submitting swap transaction...')

      // 精确 gas 预估 - 交换
      console.log('⛽ Estimating gas for ERC20 to ERC20 swap...')
      console.log('📋 Swap parameters for gas estimation:', {
        amountIn: amountInParsed.toString(),
        minAmount,
        path,
        userAddress,
        deadline: deadline.toString()
      })
      const swapGasEstimate = await computedGas(
        routerAbi,
        'swapExactTokensForTokens',
        [amountInParsed, BigInt(minAmount), path, userAddress, deadline],
        routerAddress,
        userAddress
      )

      const hash = await writeContract(config, {
        abi: routerAbi,
        address: routerAddress,
        functionName: 'swapExactTokensForTokens',
        args: [
          amountInParsed,
          BigInt(minAmount),
          path,
          userAddress,
          deadline
        ],
        gas: swapGasEstimate.gas,
        maxFeePerGas: swapGasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: swapGasEstimate.maxPriorityFeePerGas
      })

      txHash = hash
      setTxHash && setTxHash(hash)
      console.log('✅ ERC20 to ERC20 swap submitted:', hash)
    }

    console.log('✅ Swap transaction submitted successfully')

    return {
      success: true,
      txHash,
      didApprove,
      message: messages.transactionSuccess || 'Transaction submitted successfully'
    }

  } catch (e) {
    console.error('❌ Swap error details:', {
      message: e.message,
      code: e.code,
      data: e.data,
      fromToken: fromToken?.symbol,
      toToken: toToken?.symbol,
      amountIn
    })

    // 根据错误类型显示不同消息
    if (e.message && e.message.includes('User rejected')) {
      ElMessage({
        message: messages.userReject || 'User Reject!',
        type: 'warning',
        duration: 2000,
        showClose: true
      })
      error = messages.userCancelledTransaction || 'User cancelled the transaction operation'
    } else if (e.message && e.message.includes('insufficient funds')) {
      ElMessage({
        message: messages.insufficientFunds || 'Insufficient funds!',
        type: 'error',
        duration: 2000,
        showClose: true
      })
      error = messages.insufficientBalance || 'Insufficient balance'
    } else if (e.message && e.message.includes('slippage')) {
      ElMessage({
        message: messages.slippageTooHigh || 'Slippage too high, try increasing slippage tolerance!',
        type: 'error',
        duration: 3000,
        showClose: true
      })
      error = messages.slippageError || 'Slippage too high, please increase slippage tolerance'
    }
    else if (e.message && e.message.includes('User cancelled the authorization operation')) {
      ElMessage({
        message: messages.userReject || 'User Reject!',
        type: 'warning',
        duration: 2000,
        showClose: true
      })
      error = messages.userCancelledTransaction || 'User cancelled the transaction operation'
    }
    else {
      ElMessage({
        message: messages.swapFail || 'Swap Fail!',
        type: 'error',
        duration: 2000,
        showClose: true
      })
      error = messages.swapFailed || 'Swap failed: Please try again later!'
    }

    return { success: false, error, details: e.message }
  }
}