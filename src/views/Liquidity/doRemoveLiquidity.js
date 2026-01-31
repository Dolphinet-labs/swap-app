import { parseUnits, formatUnits, encodeFunctionData } from 'viem'
import { ElMessage } from 'element-plus'
import { readContract, estimateFeesPerGas, estimateGas, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import { config } from '../../wagmi.ts'

// Router ABI - Remove liquidity related functions
const routerAbi = [
  {
    name: 'removeLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'amountAMin', type: 'uint256' },
      { name: 'amountBMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    outputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' }
    ]
  },
  {
    name: 'removeLiquidityETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'amountTokenMin', type: 'uint256' },
      { name: 'amountETHMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    outputs: [
      { name: 'amountToken', type: 'uint256' },
      { name: 'amountETH', type: 'uint256' }
    ]
  },
  {
    name: 'factory',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '', type: 'address' }
    ]
  }
]

// ERC20 ABI - Token operation related functions
const erc20Abi = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  }
]

// Pair ABI - LP Token related functions
const pairAbi = [
  {
    name: 'getReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' }
    ]
  },
  {
    name: 'token0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'token1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
]

/**
 * Gas estimation function with 20% buffer
 * @param {Array} abi - Contract ABI
 * @param {string} functionName - Function name
 * @param {Array} args - Function parameters
 * @param {string} to - Contract address
 * @param {string} account - User address
 * @param {bigint} value - Amount of ETH to send (optional)
 * @returns {Promise<Object>} Gas estimation result
 */
async function computedGas(abi, functionName, args, to, account, value = undefined) {
  try {
    console.log('🔍 Estimating gas for:', { functionName, to, account, value: value?.toString() })

    // 1. Estimate gas fees
    const feeData = await estimateFeesPerGas(config)
    
    // 2. Estimate gas usage
    const gasEstimate = await estimateGas(config, {
      to,
      account,
      data: encodeFunctionData({
        abi,
        functionName,
        args
      }),
      value
    })

    // 3. Add 20% buffer to gas estimate
    const gasWithBuffer = (gasEstimate * 120n) / 100n

    const result = {
      gas: gasWithBuffer,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
    }

    console.log('⛽ Gas estimate with 20% buffer:', result)
    return result
  } catch (error) {
    console.error('❌ Gas estimation failed:', error)
    throw new Error('Gas estimation failed: ' + (error.message || error))
  }
}

/**
 * Check LP Token balance
 * @param {string} pairAddress - LP Token contract address
 * @param {string} userAddress - User address
 * @param {bigint} amount - Required amount
 * @returns {Promise<boolean>} Whether balance is sufficient
 */
async function checkLPTokenBalance(pairAddress, userAddress, amount) {
  try {
    const balance = await readContract(config, {
      address: pairAddress,
      abi: pairAbi,
      functionName: 'balanceOf',
      args: [userAddress]
    })

    const hasEnough = BigInt(balance) >= BigInt(amount)
    console.log('💰 LP Token balance check:', {
      pair: pairAddress,
      balance: balance.toString(),
      required: amount.toString(),
      hasEnough
    })

    return hasEnough
  } catch (error) {
    console.error('❌ LP Token balance check failed:', error)
    return false
  }
}

/**
 * Get liquidity pool reserves
 * @param {string} pairAddress - LP Token contract address
 * @returns {Promise<Object>} Reserve information
 */
async function getPoolReserves(pairAddress) {
  try {
    const [reserves, token0Address, token1Address] = await Promise.all([
      readContract(config, {
        address: pairAddress,
        abi: pairAbi,
        functionName: 'getReserves'
      }),
      readContract(config, {
        address: pairAddress,
        abi: pairAbi,
        functionName: 'token0'
      }),
      readContract(config, {
        address: pairAddress,
        abi: pairAbi,
        functionName: 'token1'
      })
    ])

    return {
      reserve0: reserves[0],
      reserve1: reserves[1],
      token0: token0Address,
      token1: token1Address
    }
  } catch (error) {
    console.error('❌ Get pool reserves failed:', error)
    throw new Error('Failed to get liquidity pool reserves')
  }
}

/**
 * Calculate token amounts to receive after removing liquidity
 * @param {bigint} liquidity - LP Token amount
 * @param {bigint} totalSupply - LP Token total supply
 * @param {bigint} reserve0 - Token0 reserves
 * @param {bigint} reserve1 - Token1 reserves
 * @returns {Object} Expected token amounts
 */
function calculateRemoveAmounts(liquidity, totalSupply, reserve0, reserve1) {
  try {
    if (totalSupply === 0n) {
      return { amount0: 0n, amount1: 0n }
    }

    const amount0 = (liquidity * reserve0) / totalSupply
    const amount1 = (liquidity * reserve1) / totalSupply

    console.log('📊 Remove liquidity calculation:', {
      liquidity: liquidity.toString(),
      totalSupply: totalSupply.toString(),
      reserve0: reserve0.toString(),
      reserve1: reserve1.toString(),
      amount0: amount0.toString(),
      amount1: amount1.toString()
    })

    return { amount0, amount1 }
  } catch (error) {
    console.error('❌ Calculate remove amounts failed:', error)
    return { amount0: 0n, amount1: 0n }
  }
}

/**
 * Check and approve LP Token
 * @param {string} pairAddress - LP Token contract address
 * @param {string} userAddress - User address
 * @param {string} routerAddress - Router address
 * @param {bigint} amount - Amount to approve
 * @param {Function} setApprovalHash - Callback to set approval hash
 * @param {Function} onProgress - Progress callback
 * @param {Object} messages - Message object for internationalization
 * @returns {Promise<Object>} Approval result
 */
async function checkAndApproveLPToken(pairAddress, userAddress, routerAddress, amount, setApprovalHash, onProgress, messages) {
  try {
    console.log('🔍 Checking LP Token allowance...')
    onProgress && onProgress('approval_check', messages?.approvalCheck || 'Checking LP Token approval status...')
    
    // 1. Check current allowance
    const allowanceResult = await readContract(config, {
      address: pairAddress,
      abi: pairAbi,
      functionName: 'allowance',
      args: [userAddress, routerAddress]
    })

    const allowance = BigInt(allowanceResult || 0)
    const amountBN = BigInt(amount)

    console.log('💰 LP Token allowance check:', {
      current: allowance.toString(),
      required: amountBN.toString(),
      needsApproval: allowance < amountBN
    })

    // 2. If allowance is insufficient, approve
    if (allowance < amountBN) {
      console.log('📝 Submitting LP Token approval for:', amountBN.toString())
      onProgress && onProgress('approval_pending', messages?.approvalPending || 'Approving LP Token...')

      // 3. Estimate gas for approval transaction
      const approveGasEstimate = await computedGas(
        pairAbi,
        'approve',
        [routerAddress, amountBN],
        pairAddress,
        userAddress
      )

      // 4. Submit approval transaction
      const approveHash = await writeContract(config, {
        abi: pairAbi,
        address: pairAddress,
        functionName: 'approve',
        args: [routerAddress, amountBN],
        gas: approveGasEstimate.gas,
        maxFeePerGas: approveGasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: approveGasEstimate.maxPriorityFeePerGas
      })

      setApprovalHash && setApprovalHash(approveHash)
      console.log('✅ LP Token approval submitted:', approveHash)

      // Show approval notification
      ElMessage({
        message: messages?.approvalSubmitted || 'LP Token approval submitted, waiting for confirmation...',
        type: 'info',
        duration: 3000,
        showClose: true
      })

      onProgress && onProgress('approval_confirming', messages?.approvalConfirming || 'Waiting for LP Token approval confirmation...')

      // Wait for approval transaction confirmation
      console.log('⏳ Waiting for LP Token approval confirmation...')
      const approvalReceipt = await waitForTransactionReceipt(config, {
        hash: approveHash,
        timeout: 60000 // 60 seconds timeout
      })

      if (approvalReceipt.status !== 'success') {
        throw new Error('LP Token approval transaction failed')
      }

      console.log('✅ LP Token approval confirmed:', approvalReceipt.transactionHash)
      ElMessage({
        message: messages?.approvalSuccess || 'LP Token approval confirmed successfully',
        type: 'success',
        duration: 2000
      })

      onProgress && onProgress('approval_success', messages?.approvalSuccessProgress || 'LP Token approval successful')

      return { approved: true, hash: approveHash }
    }

    onProgress && onProgress('approval_sufficient', messages?.approvalSufficient || 'LP Token allowance sufficient, no re-approval needed')
    return { approved: false, hash: null }
  } catch (error) {
    console.error('❌ LP Token approval error:', error)
    onProgress && onProgress('approval_error', `${messages?.approvalError || 'LP Token approval failed'}: ${error.message}`)
    
    if (error.message && error.message.includes('User rejected')) {
      throw new Error(messages?.userCancelledApproval || 'User cancelled the approval operation')
    }
    throw new Error(`${messages?.approvalFailed || 'LP Token approval failed'}: ${error.message || error}`)
  }
}


export async function doRemoveLiquidity({
  tokenA,
  tokenB,
  pairAddress,
  liquidityAmount,
  slippageInput = 0.5,
  userAddress,
  routerAddress,
  wcpAddress,
  nativeSymbol = 'DOL',
  setTxHash,
  setApprovalHash,
  onProgress,
  messages
}) {
  let txHash = null
  let error = null
  let didApprove = false
  let approvalHash = null
  let expectedAmounts = { amount0: 0n, amount1: 0n }

  // Progress update function
  const updateProgress = (stage, message, data = {}) => {
    console.log(`📊 Progress [${stage}]:`, message, data)
    onProgress && onProgress(stage, message, data)
  }

  try {
    console.log('🚀 Starting remove liquidity process...')
    updateProgress('start', messages?.startProgress || 'Starting remove liquidity...')

    // 1. Parameter validation
    if (!userAddress || !routerAddress || !pairAddress) throw new Error(messages?.incompleteParams || 'Incomplete parameters')
    if (!tokenA || !tokenB) throw new Error(messages?.incompleteTokenInfo || 'Incomplete token information')
    if (!liquidityAmount || liquidityAmount === '0') throw new Error(messages?.invalidLPAmount || 'Please enter a valid LP Token amount')

    console.log('📋 Remove liquidity params:', {
      tokenA: { symbol: tokenA.symbol, address: tokenA.address },
      tokenB: { symbol: tokenB.symbol, address: tokenB.address },
      pairAddress,
      liquidityAmount,
      slippageInput,
      userAddress,
      routerAddress
    })

    // 2. Slippage calculation and validation
    const slippageBN = BigInt(Math.floor(slippageInput * 100)) // Convert to basis points
    if (slippageBN < 1n || slippageBN > 5000n) { // 0.01% to 50%
      throw new Error(messages?.invalidSlippage || 'Invalid slippage setting, please set between 0.01% and 50%')
    }

    console.log('📊 Slippage settings:', {
      input: slippageInput,
      basisPoints: slippageBN.toString()
    })

    // 3. Parse LP Token amount (LP Token usually has 18 decimals)
    const liquidityParsed = parseUnits(liquidityAmount.toString(), 18)

    console.log('💰 Parsed liquidity amount:', {
      liquidity: liquidityParsed.toString()
    })

    // 4. Check LP Token balance
    updateProgress('validation', messages?.validationProgress || 'Validating LP Token balance...')
    
    const balanceCheck = await checkLPTokenBalance(
      pairAddress,
      userAddress,
      liquidityParsed
    )

    if (!balanceCheck) {
      throw new Error(messages?.insufficientLPBalance || 'Insufficient LP Token balance')
    }

    // 5. Get liquidity pool information
    updateProgress('pool_info', messages?.poolInfoProgress || 'Getting liquidity pool information...')
    
    const [poolReserves, totalSupply] = await Promise.all([
      getPoolReserves(pairAddress),
      readContract(config, {
        address: pairAddress,
        abi: pairAbi,
        functionName: 'totalSupply'
      })
    ])

    console.log('🏊 Pool info:', {
      reserves: {
        reserve0: poolReserves.reserve0.toString(),
        reserve1: poolReserves.reserve1.toString(),
        token0: poolReserves.token0,
        token1: poolReserves.token1
      },
      totalSupply: totalSupply.toString()
    })

    // 6. Calculate expected token amounts
    expectedAmounts = calculateRemoveAmounts(
      liquidityParsed,
      totalSupply,
      poolReserves.reserve0,
      poolReserves.reserve1
    )

    // 7. Determine token order (whether token0 corresponds to tokenA or tokenB)
    const getTokenAddress = (token) => {
      // 原生币使用包装币地址
      if (token.symbol === nativeSymbol || token.isNative) {
        return wcpAddress // Native coin uses wrapped address
      }
      return token.address
    }

    const tokenAAddress = getTokenAddress(tokenA)
    const tokenBAddress = getTokenAddress(tokenB)
    
    // Determine token order in the pool
    const isTokenAFirst = tokenAAddress.toLowerCase() === poolReserves.token0.toLowerCase()
    const amountAExpected = isTokenAFirst ? expectedAmounts.amount0 : expectedAmounts.amount1
    const amountBExpected = isTokenAFirst ? expectedAmounts.amount1 : expectedAmounts.amount0

    console.log('🔄 Token order analysis:', {
      tokenA: { symbol: tokenA.symbol, address: tokenAAddress, isNative: tokenA.isNative, isFirst: isTokenAFirst },
      tokenB: { symbol: tokenB.symbol, address: tokenBAddress, isNative: tokenB.isNative, isFirst: !isTokenAFirst },
      expectedAmounts: {
        amountA: amountAExpected.toString(),
        amountB: amountBExpected.toString()
      }
    })

    // 8. Calculate minimum acceptable amounts (considering slippage)
    const amountAMinBN = (amountAExpected * (10000n - slippageBN)) / 10000n
    const amountBMinBN = (amountBExpected * (10000n - slippageBN)) / 10000n

    console.log('📉 Minimum amounts (with slippage):', {
      amountAMin: amountAMinBN.toString(),
      amountBMin: amountBMinBN.toString()
    })

    // 9. Set transaction deadline (15 minutes later)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 900)

    // 10. Determine liquidity type
    const isNativeA = tokenA.symbol === nativeSymbol || tokenA.isNative
    const isNativeB = tokenB.symbol === nativeSymbol || tokenB.isNative
    const hasNative = isNativeA || isNativeB

    console.log('🔍 Liquidity type analysis:', {
      tokenA: { symbol: tokenA.symbol, isNative: tokenA.isNative },
      tokenB: { symbol: tokenB.symbol, isNative: tokenB.isNative },
      isNativeA,
      isNativeB,
      hasNative,
      nativeSymbol,
      type: hasNative ? 'Native + ERC20' : 'ERC20 + ERC20'
    })

    // 11. Check and approve LP Token
    updateProgress('approval', messages?.approvalProgress || 'Checking LP Token approval...')

    const approvalResult = await checkAndApproveLPToken(
      pairAddress,
      userAddress,
      routerAddress,
      liquidityParsed,
      setApprovalHash,
      updateProgress,
      messages
    )

    if (approvalResult.approved) {
      didApprove = true
      approvalHash = approvalResult.hash
    }

    updateProgress('transaction', messages?.transactionProgress || 'Submitting remove liquidity transaction...')

    let hash

    if (hasNative) {
      // Native + ERC20 liquidity removal
      console.log('🔄 Processing Native + ERC20 liquidity removal')
      const erc20Token = isNativeA ? tokenB : tokenA
      const tokenAmountMin = isNativeA ? amountBMinBN : amountAMinBN
      const nativeAmountMin = isNativeA ? amountAMinBN : amountBMinBN

      console.log('📋 Native + ERC20 remove params:', {
        erc20Token: { symbol: erc20Token.symbol, address: erc20Token.address },
        liquidity: liquidityParsed.toString(),
        tokenAmountMin: tokenAmountMin.toString(),
        nativeAmountMin: nativeAmountMin.toString()
      })

      // Execute remove liquidity
      console.log('🔄 Submitting remove liquidity ETH transaction...')
      const removeLiquidityGasEstimate = await computedGas(
        routerAbi,
        'removeLiquidityETH',
        [erc20Token.address, liquidityParsed, tokenAmountMin, nativeAmountMin, userAddress, deadline],
        routerAddress,
        userAddress
      )

      hash = await writeContract(config, {
        abi: routerAbi,
        address: routerAddress,
        functionName: 'removeLiquidityETH',
        args: [
          erc20Token.address,
          liquidityParsed,
          tokenAmountMin,
          nativeAmountMin,
          userAddress,
          deadline
        ],
        gas: removeLiquidityGasEstimate.gas,
        maxFeePerGas: removeLiquidityGasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: removeLiquidityGasEstimate.maxPriorityFeePerGas
      })

      txHash = hash
      setTxHash && setTxHash(hash)
      console.log('✅ Native + Token liquidity removal submitted:', hash)
    }
    else {
      // ERC20 + ERC20 liquidity removal
      console.log('🔄 Processing ERC20 + ERC20 liquidity removal')

      console.log('📋 ERC20 + ERC20 remove params:', {
        tokenA: { symbol: tokenA.symbol, address: tokenAAddress },
        tokenB: { symbol: tokenB.symbol, address: tokenBAddress },
        liquidity: liquidityParsed.toString(),
        amountAMin: amountAMinBN.toString(),
        amountBMin: amountBMinBN.toString()
      })

      // Execute remove liquidity
      console.log('🔄 Submitting remove liquidity transaction...')
      const removeLiquidityGasEstimate = await computedGas(
        routerAbi,
        'removeLiquidity',
        [tokenAAddress, tokenBAddress, liquidityParsed, amountAMinBN, amountBMinBN, userAddress, deadline],
        routerAddress,
        userAddress
      )

      hash = await writeContract(config, {
        abi: routerAbi,
        address: routerAddress,
        functionName: 'removeLiquidity',
        args: [
          tokenAAddress,
          tokenBAddress,
          liquidityParsed,
          amountAMinBN,
          amountBMinBN,
          userAddress,
          deadline
        ],
        gas: removeLiquidityGasEstimate.gas,
        maxFeePerGas: removeLiquidityGasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: removeLiquidityGasEstimate.maxPriorityFeePerGas
      })

      txHash = hash
      setTxHash && setTxHash(hash)
      console.log('✅ ERC20 + ERC20 liquidity removal submitted:', hash)
    }

    // Wait for transaction confirmation
    updateProgress('pending', messages?.pendingProgress || 'Waiting for transaction confirmation...', { txHash })
    console.log('⏳ Waiting for transaction confirmation:', txHash)

    const receipt = await waitForTransactionReceipt(config, {
      hash: txHash,
      timeout: 120000 // 2 minutes timeout
    })

    if (receipt.status === 'success') {
      updateProgress('success', messages?.successProgress || 'Transaction confirmed successfully', { 
        txHash,
        expectedAmounts: {
          amountA: formatUnits(amountAExpected, tokenA.decimals),
          amountB: formatUnits(amountBExpected, tokenB.decimals)
        },
        gasUsed: receipt.gasUsed?.toString()
      })
      console.log('✅ Transaction confirmed successfully:', receipt.transactionHash)
      
      // Show success notification
      ElMessage({
        message: messages?.successMessage || 'Remove liquidity successful!',
        type: 'success',
        duration: 5000,
        showClose: true
      })

      return {
        success: true,
        transactionHash: txHash,
        receipt,
        approvalHash,
        didApprove,
        expectedAmounts: {
          amountA: formatUnits(amountAExpected, tokenA.decimals),
          amountB: formatUnits(amountBExpected, tokenB.decimals)
        },
        error: null
      }
    } else {
      throw new Error(messages?.transactionFailed || 'Transaction execution failed')
    }

  } catch (e) {
    console.error('❌ Remove liquidity failed:', e)
    error = e

    updateProgress('error', messages?.errorProgress || 'Transaction failed', { error: e.message })

    // Provide more user-friendly error messages
    let errorMessage = e.message
    if (e.message && e.message.includes('User rejected')) {
      errorMessage = messages?.userCancelled || 'User cancelled the transaction'
    } else if (e.message && e.message.includes('insufficient funds')) {
      errorMessage = messages?.insufficientBalance || 'Insufficient balance'
    } else if (e.message && e.message.includes('INSUFFICIENT_LIQUIDITY_BURNED')) {
      errorMessage = messages?.insufficientLiquidity || 'Insufficient LP Token amount'
    } else if (e.message && e.message.includes('INSUFFICIENT_A_AMOUNT')) {
      errorMessage = messages?.insufficientAmountA || 'Insufficient tokenA amount, please adjust slippage'
    } else if (e.message && e.message.includes('INSUFFICIENT_B_AMOUNT')) {
      errorMessage = messages?.insufficientAmountB || 'Insufficient tokenB amount, please adjust slippage'
    } else if (e.message && e.message.includes('EXPIRED')) {
      errorMessage = messages?.transactionExpired || 'Transaction expired, please retry'
    } else if (e.message && e.message.includes('timeout')) {
      errorMessage = messages?.transactionTimeout || 'Transaction confirmation timeout, please check blockchain explorer'
    } else if (e.message && e.message.includes('Gas estimation failed')) {
      errorMessage = messages?.gasEstimationFailed || 'Gas estimation failed, please check network connection or contract address'
    }

    // Show error notification
    ElMessage({
      message: errorMessage,
      type: 'error',
      duration: 5000,
      showClose: true
    })

    return {
      success: false,
      transactionHash: txHash,
      receipt: null,
      approvalHash,
      didApprove,
      expectedAmounts: {
        amountA: '0',
        amountB: '0'
      },
      error: errorMessage
    }
  }
}

export default doRemoveLiquidity