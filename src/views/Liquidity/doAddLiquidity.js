
import { parseUnits, encodeFunctionData } from 'viem'
import { ElMessage } from 'element-plus'
import { readContract, estimateFeesPerGas, estimateGas, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import { config } from '../../wagmi.ts'

// Router ABI - Add liquidity related functions
const routerAbi = [
  {
    name: 'addLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'amountADesired', type: 'uint256' },
      { name: 'amountBDesired', type: 'uint256' },
      { name: 'amountAMin', type: 'uint256' },
      { name: 'amountBMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    outputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' }
    ]
  },
  {
    name: 'addLiquidityETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amountTokenDesired', type: 'uint256' },
      { name: 'amountTokenMin', type: 'uint256' },
      { name: 'amountETHMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    outputs: [
      { name: 'amountToken', type: 'uint256' },
      { name: 'amountETH', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' }
    ]
  },
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' }
    ],
    outputs: [
      { name: 'amounts', type: 'uint256[]' }
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
  },
  {
    name: 'WETH',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '', type: 'address' }
    ]
  },
  {
    name: 'getPair',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' }
    ],
    outputs: [
      { name: 'pair', type: 'address' }
    ]
  },
  {
    name: 'quote',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'reserveA', type: 'uint256' },
      { name: 'reserveB', type: 'uint256' }
    ],
    outputs: [
      { name: 'amountB', type: 'uint256' }
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
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
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
    const bufferPercentage = 20

    console.log('⛽ Gas estimate with buffer:', {
      original: gasEstimate.toString(),
      withBuffer: gasWithBuffer.toString(),
      bufferPercentage: `${bufferPercentage}%`
    })

    const result = {
      gas: gasWithBuffer,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
    }

    console.log('⛽ Final gas estimate:', result)
    return result
  } catch (error) {
    console.error('❌ Gas estimation failed:', error)
    
    // Fallback gas values with 20% buffer
    const fallbackGas = 300000n * 120n / 100n // 360000 gas with 20% buffer
    const fallbackMaxFeePerGas = 20000000000n // 20 gwei
    const fallbackMaxPriorityFeePerGas = 2000000000n // 2 gwei
    
    console.log('🔄 Using fallback gas values with 20% buffer:', {
      gas: fallbackGas.toString(),
      maxFeePerGas: fallbackMaxFeePerGas.toString(),
      maxPriorityFeePerGas: fallbackMaxPriorityFeePerGas.toString(),
      bufferPercentage: '20%'
    })
    
    return {
      gas: fallbackGas,
      maxFeePerGas: fallbackMaxFeePerGas,
      maxPriorityFeePerGas: fallbackMaxPriorityFeePerGas
    }
  }
}

/**
 * Check token balance
 * @param {string} tokenAddress - Token contract address
 * @param {string} userAddress - User address
 * @param {bigint} amount - Required amount
 * @param {boolean} isNative - Whether it's native coin
 * @returns {Promise<boolean>} Whether balance is sufficient
 */
async function checkTokenBalance(tokenAddress, userAddress, amount, isNative = false) {
  try {
    let balance
    
    if (isNative) {
      // Check native coin balance (via wagmi's getBalance)
      const { getBalance } = await import('@wagmi/core')
      const balanceResult = await getBalance(config, { address: userAddress })
      balance = balanceResult.value
    } else {
      // Check ERC20 token balance
      balance = await readContract(config, {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress]
      })
    }

    const hasEnough = BigInt(balance) >= BigInt(amount)
    console.log('💰 Balance check:', {
      token: tokenAddress,
      balance: balance.toString(),
      required: amount.toString(),
      hasEnough
    })

    return hasEnough
  } catch (error) {
    console.error('❌ Balance check failed:', error)
    return false
  }
}

/**
 * Check if liquidity pool exists
 * @param {string} factoryAddress - Factory contract address
 * @param {string} tokenA - Token A address
 * @param {string} tokenB - Token B address
 * @returns {Promise<Object>} Liquidity pool information
 */
async function checkLiquidityPool(factoryAddress, tokenA, tokenB) {
  try {
    const factoryAbi = [
      {
        name: 'getPair',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'tokenA', type: 'address' },
          { name: 'tokenB', type: 'address' }
        ],
        outputs: [
          { name: 'pair', type: 'address' }
        ]
      }
    ]

    const pairAddress = await readContract(config, {
      address: factoryAddress,
      abi: factoryAbi,
      functionName: 'getPair',
      args: [tokenA, tokenB]
    })

    const exists = pairAddress !== '0x0000000000000000000000000000000000000000'
    
    console.log('🏊 Liquidity pool check:', {
      tokenA,
      tokenB,
      pairAddress,
      exists
    })

    return { exists, pairAddress }
  } catch (error) {
    console.error('❌ Pool check failed:', error)
    return { exists: false, pairAddress: null }
  }
}

/**
 * Check and approve token (exact approval)
 * @param {string} tokenAddress - Token contract address
 * @param {string} tokenSymbol - Token symbol
 * @param {string} userAddress - User address
 * @param {string} routerAddress - Router address
 * @param {bigint} amount - Exact amount to approve
 * @param {Function} setApprovalHash - Callback to set approval hash
 * @param {Function} onProgress - Progress callback
 * @param {Object} messages - Translation messages object
 * @returns {Promise<Object>} Approval result
 */
async function checkAndApproveToken(tokenAddress, tokenSymbol, userAddress, routerAddress, amount, setApprovalHash, onProgress, messages = {}) {
  try {
    console.log(`🔍 Checking ${tokenSymbol} allowance...`)
    onProgress && onProgress('approval_check', messages.approval_check ? `${tokenSymbol} ${messages.approval_check}` : `Checking ${tokenSymbol} authorization status...`)
    
    // 1. Check current allowance
    const allowanceResult = await readContract(config, {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [userAddress, routerAddress]
    })

    const allowance = BigInt(allowanceResult || 0)
    const amountBN = BigInt(amount)

    console.log(`💰 ${tokenSymbol} allowance check:`, {
      current: allowance.toString(),
      required: amountBN.toString(),
      needsApproval: allowance < amountBN
    })

    // 2. If allowance is insufficient, perform exact approval
    if (allowance < amountBN) {
      console.log(`📝 Submitting ${tokenSymbol} exact approval for:`, amountBN.toString())
      onProgress && onProgress('approval_pending', messages.approval_pending ? `${messages.approval_pending} ${tokenSymbol}...` : `Authorizing ${tokenSymbol}...`)

      // 3. Estimate gas for approval transaction
      const approveGasEstimate = await computedGas(
        erc20Abi,
        'approve',
        [routerAddress, amountBN], // Use exact amount
        tokenAddress,
        userAddress
      )

      // 4. Submit exact approval transaction
      const approveHash = await writeContract(config, {
        abi: erc20Abi,
        address: tokenAddress,
        functionName: 'approve',
        args: [routerAddress, amountBN], // Exact approval amount
        gas: approveGasEstimate.gas,
        maxFeePerGas: approveGasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: approveGasEstimate.maxPriorityFeePerGas
      })

      setApprovalHash && setApprovalHash(approveHash)
      console.log(`✅ ${tokenSymbol} exact approval submitted:`, approveHash)

      // Show approval notification
      ElMessage({
        message: messages.authorization_submitted ? `${tokenSymbol} ${messages.authorization_submitted}` : `${tokenSymbol} Authorization submitted, awaiting confirmation...`,
        type: 'info',
        duration: 3000,
        showClose: true
      })

      onProgress && onProgress('approval_confirming', messages.approval_confirming ? `${messages.approval_confirming} ${tokenSymbol}...` : `Waiting for ${tokenSymbol} authorization confirmation...`)

      // 🔥 Wait for approval transaction confirmation
      console.log(`⏳ Waiting for ${tokenSymbol} approval confirmation...`)
      const approvalReceipt = await waitForTransactionReceipt(config, {
        hash: approveHash,
        timeout: 60000 // 60 seconds timeout
      })

      if (approvalReceipt.status !== 'success') {
        throw new Error(`${tokenSymbol} authorization transaction failed`)
      }

      console.log(`✅ ${tokenSymbol} approval confirmed:`, approvalReceipt.transactionHash)
      ElMessage({
        message: messages.authorization_success ? `${tokenSymbol} ${messages.authorization_success}` : `${tokenSymbol} Authorization confirmation successful`,
        type: 'success',
        duration: 2000
      })

      onProgress && onProgress('approval_success', messages.approval_success ? `${tokenSymbol} ${messages.approval_success}` : `${tokenSymbol} Authorization confirmation successful`)

      return { approved: true, hash: approveHash }
    }

    onProgress && onProgress('approval_sufficient', messages.approval_sufficient ? `${tokenSymbol} ${messages.approval_sufficient}` : `${tokenSymbol} Sufficient authorization, no need for re-authorization`)
    return { approved: false, hash: null }
  } catch (error) {
    console.error(`❌ ${tokenSymbol} approval error:`, error)
    onProgress && onProgress('approval_error', messages.approval_error ? `${tokenSymbol} ${messages.approval_error}: ${error.message}` : `${tokenSymbol} Authorization failed: ${error.message}`)
    
    if (error.message && error.message.includes('User rejected')) {
      throw new Error(messages.error_authorization_canceled || 'The user canceled the authorization operation')
    }
    throw new Error(messages.error_authorization_failed ? `${tokenSymbol} ${messages.error_authorization_failed}: ${error.message}` : `${tokenSymbol} Authorization failed: ` + (error.message || error))
  }
}


/**
 * Add liquidity main function
 * @param {Object} params - Parameter object
 * @param {Object} params.tokenA - Token A object (includes address, symbol, decimals)
 * @param {Object} params.tokenB - Token B object (includes address, symbol, decimals)
 * @param {string} params.amountA - Token A amount (user input format)
 * @param {string} params.amountB - Token B amount (user input format)
 * @param {number} params.slippageInput - Slippage tolerance (percentage, e.g., 0.5 means 0.5%)
 * @param {string} params.userAddress - User wallet address
 * @param {string} params.routerAddress - Router contract address
 * @param {string} params.wcpAddress - Wrapped CP address
 * @param {string} [params.nativeSymbol='DOL'] - Native coin symbol
 * @param {Function} [params.setTxHash] - Callback to set transaction hash
 * @param {Function} [params.setApprovalHash] - Callback to set approval hash
 * @param {Function} [params.onProgress] - Progress callback function
 * @param {Object} [params.messages={}] - Translation messages object
 * @returns {Promise<Object>} Transaction result
 */
export async function doAddLiquidity({
  tokenA,
  tokenB,
  amountA,
  amountB,
  slippageInput = 0.5,
  userAddress,
  routerAddress,
  wcpAddress,
  nativeSymbol = 'DOL',
  setTxHash,
  setApprovalHash,
  onProgress,
  messages = {}
}) {
  let txHash = null
  let error = null
  let didApprove = false
  const approvalHashes = []
  let priceImpact = 0

  // Progress update function
  const updateProgress = (stage, message, data = {}) => {
    console.log(`📊 Progress [${stage}]:`, message, data)
    onProgress && onProgress(stage, message, data)
  }

  try {
    console.log('🚀 Starting add liquidity process...')
    updateProgress('start', messages.progress_start || 'Starting to add liquidity...')

    // 1. Parameter validation
    if (!userAddress || !routerAddress) throw new Error('Incomplete params')
    if (!tokenA || !tokenB) throw new Error('Incomplete token information')
    if (!amountA || !amountB) throw new Error('Please enter valid amounts')

    console.log('📋 Add liquidity params:', {
      tokenA: { symbol: tokenA.symbol, address: tokenA.address },
      tokenB: { symbol: tokenB.symbol, address: tokenB.address },
      amountA,
      amountB,
      slippageInput,
      userAddress,
      routerAddress
    })

    // 2. Slippage calculation and validation
    const slippageBN = BigInt(Math.floor(slippageInput * 100)) // Convert to basis points
    if (slippageBN < 1n || slippageBN > 5000n) { // 0.01% to 50%
      throw new Error('Invalid slippage setting, please set between 0.01% and 50%')
    }

    console.log('📊 Slippage settings:', {
      input: slippageInput,
      basisPoints: slippageBN.toString()
    })

    // 3. Parse amounts
    const amountAParsed = parseUnits(amountA.toString(), tokenA.decimals)
    const amountBParsed = parseUnits(amountB.toString(), tokenB.decimals)

    console.log('💰 Parsed amounts:', {
      amountA: amountAParsed.toString(),
      amountB: amountBParsed.toString()
    })

    // 4. Calculate minimum acceptable amounts (considering slippage)
    const amountAMinBN = (amountAParsed * (10000n - slippageBN)) / 10000n
    const amountBMinBN = (amountBParsed * (10000n - slippageBN)) / 10000n

    console.log('📉 Minimum amounts (with slippage):', {
      amountAMin: amountAMinBN.toString(),
      amountBMin: amountBMinBN.toString()
    })

    // 5. Set transaction deadline (15 minutes later)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 900)

    // 6. Helper function to get token address
    const getTokenAddress = (token) => {
      // 原生币(DOL)使用WDOL地址
      if (token.symbol === nativeSymbol || token.isNative) {
        return wcpAddress // Native coin uses wrapped address
      }
      return token.address
    }

    // 7. Determine liquidity type
    const isNativeA = tokenA.symbol === nativeSymbol || tokenA.isNative
    const isNativeB = tokenB.symbol === nativeSymbol || tokenB.isNative
    const hasNative = isNativeA || isNativeB

    console.log('🔍 Liquidity type analysis:', {
      tokenA: { symbol: tokenA.symbol, address: tokenA.address, isNative: tokenA.isNative },
      tokenB: { symbol: tokenB.symbol, address: tokenB.address, isNative: tokenB.isNative },
      isNativeA,
      isNativeB,
      hasNative,
      nativeSymbol,
      type: hasNative ? 'Native + ERC20' : 'ERC20 + ERC20'
    })

    // 8. Check liquidity pool (optional)
    try {
      const factoryAddress = await readContract(config, {
        address: routerAddress,
        abi: routerAbi,
        functionName: 'factory'
      })
      
      const poolInfo = await checkLiquidityPool(
        factoryAddress,
        getTokenAddress(tokenA),
        getTokenAddress(tokenB)
      )
      
      updateProgress('pool_check', poolInfo.exists ? 
        (messages.progress_pool_check_exists || 'Liquidity pool already exists') : 
        (messages.progress_pool_check_new || 'New liquidity pools will be created'), 
        poolInfo)
    } catch (error) {
      console.warn('⚠️ Pool check failed, continuing...', error)
    }

    // 9. Balance validation
    updateProgress('validation', messages.progress_validation || 'Verify token balance...')
    
    const balanceCheckA = await checkTokenBalance(
      getTokenAddress(tokenA),
      userAddress,
      amountAParsed,
      isNativeA
    )
    
    const balanceCheckB = await checkTokenBalance(
      getTokenAddress(tokenB),
      userAddress,
      amountBParsed,
      isNativeB
    )

    if (!balanceCheckA) {
      throw new Error(messages.error_insufficient_token_balance ? `${tokenA.symbol} ${messages.error_insufficient_token_balance}` : `${tokenA.symbol} insufficient balance`)
    }
    if (!balanceCheckB) {
      throw new Error(messages.error_insufficient_token_balance ? `${tokenB.symbol} ${messages.error_insufficient_token_balance}` : `${tokenB.symbol} insufficient balance`)
    }

    let hash

    if (hasNative) {
      // Native + ERC20 liquidity
      console.log('🔄 Processing Native + ERC20 liquidity')
      const erc20Token = isNativeA ? tokenB : tokenA
      const nativeAmount = isNativeA ? amountAParsed : amountBParsed
      const tokenAmount = isNativeA ? amountBParsed : amountAParsed
      const nativeAmountMin = isNativeA ? amountAMinBN : amountBMinBN
      const tokenAmountMin = isNativeA ? amountBMinBN : amountAMinBN

      console.log('📋 Native + ERC20 params:', {
        erc20Token: { symbol: erc20Token.symbol, address: erc20Token.address },
        tokenAmount: tokenAmount.toString(),
        tokenAmountMin: tokenAmountMin.toString(),
        nativeAmount: nativeAmount.toString(),
        nativeAmountMin: nativeAmountMin.toString()
      })

      // 10. Check and approve ERC20 token (exact approval)
      updateProgress('approval', messages.progress_approval ? `${messages.progress_approval} ${erc20Token.symbol}...` : `Check ${erc20Token.symbol} authorization...`)

      const approvalResult = await checkAndApproveToken(
        erc20Token.address,
        erc20Token.symbol,
        userAddress,
        routerAddress,
        tokenAmount,
        setApprovalHash,
        updateProgress,
        messages
      )

      if (approvalResult.approved) {
        didApprove = true
        approvalHashes.push(approvalResult.hash)
      }

      updateProgress('transaction', messages.progress_transaction || 'Submit a transaction to add liquidity...')

      // 11. Execute add liquidity
      console.log('🔄 Submitting add liquidity ETH transaction...')
      const addLiquidityGasEstimate = await computedGas(
        routerAbi,
        'addLiquidityETH',
        [erc20Token.address, tokenAmount, tokenAmountMin, nativeAmountMin, userAddress, deadline],
        routerAddress,
        userAddress,
        nativeAmount
      )

      hash = await writeContract(config, {
        abi: routerAbi,
        address: routerAddress,
        functionName: 'addLiquidityETH',
        args: [
          erc20Token.address,
          tokenAmount,
          tokenAmountMin,
          nativeAmountMin,
          userAddress,
          deadline
        ],
        value: nativeAmount,
        gas: addLiquidityGasEstimate.gas,
        maxFeePerGas: addLiquidityGasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: addLiquidityGasEstimate.maxPriorityFeePerGas
      })

      txHash = hash
      setTxHash && setTxHash(hash)
      console.log('✅ Native + Token liquidity submitted:', hash)
    }
    else {
      // ERC20 + ERC20 liquidity
      console.log('🔄 Processing ERC20 + ERC20 liquidity')
      const tokenAAddress = getTokenAddress(tokenA)
      const tokenBAddress = getTokenAddress(tokenB)

      console.log('📋 ERC20 + ERC20 params:', {
        tokenA: { symbol: tokenA.symbol, address: tokenAAddress },
        tokenB: { symbol: tokenB.symbol, address: tokenBAddress },
        amountA: amountAParsed.toString(),
        amountB: amountBParsed.toString(),
        amountAMin: amountAMinBN.toString(),
        amountBMin: amountBMinBN.toString()
      })

      // 12. 🔥 Optimization: Approve in interface display order to ensure consistent user experience
      const tokensToApprove = [
        { token: tokenA, amount: amountAParsed, address: tokenAAddress },
        { token: tokenB, amount: amountBParsed, address: tokenBAddress }
      ]

      console.log('🔄 Token approval order:', tokensToApprove.map(t => t.token.symbol))

      for (const { token, amount, address } of tokensToApprove) {
        updateProgress('approval', messages.progress_approval ? `${messages.progress_approval} ${token.symbol}...` : `Check ${token.symbol} authorization...`)

        const approvalResult = await checkAndApproveToken(
          address,
          token.symbol,
          userAddress,
          routerAddress,
          amount,
          setApprovalHash,
          updateProgress,
          messages
        )

        if (approvalResult.approved) {
          didApprove = true
          approvalHashes.push(approvalResult.hash)
        }
      }

      updateProgress('transaction', messages.progress_transaction || 'Submit a transaction to add liquidity...')

      // 13. Execute add liquidity
      console.log('🔄 Submitting add liquidity transaction...')
      const addLiquidityGasEstimate = await computedGas(
        routerAbi,
        'addLiquidity',
        [tokenAAddress, tokenBAddress, amountAParsed, amountBParsed, amountAMinBN, amountBMinBN, userAddress, deadline],
        routerAddress,
        userAddress
      )

      hash = await writeContract(config, {
        abi: routerAbi,
        address: routerAddress,
        functionName: 'addLiquidity',
        args: [
          tokenAAddress,
          tokenBAddress,
          amountAParsed,
          amountBParsed,
          amountAMinBN,
          amountBMinBN,
          userAddress,
          deadline
        ],
        gas: addLiquidityGasEstimate.gas,
        maxFeePerGas: addLiquidityGasEstimate.maxFeePerGas,
        maxPriorityFeePerGas: addLiquidityGasEstimate.maxPriorityFeePerGas
      })

      txHash = hash
      setTxHash && setTxHash(hash)
      console.log('✅ ERC20 + ERC20 liquidity submitted:', hash)
    }

    // 🔥 Critical fix: Wait for transaction confirmation
    updateProgress('pending', messages.progress_pending || 'Waiting for transaction confirmation...', { txHash })
    console.log('⏳ Waiting for transaction confirmation:', txHash)

    const receipt = await waitForTransactionReceipt(config, {
      hash: txHash,
      timeout: 120000 // 2 minutes timeout
    })

    if (receipt.status === 'success') {
      updateProgress('success', messages.progress_success || 'Transaction confirmation successful', { 
        txHash, 
        priceImpact,
        gasUsed: receipt.gasUsed?.toString()
      })
      console.log('✅ Transaction confirmed successfully:', receipt.transactionHash)
      
      // Show success notification
      ElMessage({
        message: messages.liquidity_added_success || 'Liquidity added successfully!',
        type: 'success',
        duration: 5000,
        showClose: true
      })

      return {
        success: true,
        transactionHash: txHash,
        receipt,
        approvalHashes,
        didApprove,
        priceImpact,
        error: null
      }
    } else {
      throw new Error(messages.error_transaction_failed || 'Transaction execution failed')
    }

  } catch (e) {
    console.error('❌ Add liquidity failed:', e)
    error = e

    updateProgress('error', messages.progress_error || 'Transaction failed', { error: e.message })

    // Provide more friendly error messages
    let errorMessage = e.message
    if (e.message && e.message.includes('User rejected')) {
      errorMessage = messages.error_user_canceled || 'User canceled the transaction'
    } else if (e.message && e.message.includes('insufficient funds')) {
      errorMessage = messages.error_insufficient_balance || 'Insufficient balance'
    } else if (e.message && e.message.includes('INSUFFICIENT_A_AMOUNT')) {
      errorMessage = messages.error_insufficient_a_amount || 'Insufficient token A amount, please adjust slippage or input amount'
    } else if (e.message && e.message.includes('INSUFFICIENT_B_AMOUNT')) {
      errorMessage = messages.error_insufficient_b_amount || 'Insufficient token B amount, please adjust slippage or input amount'
    } else if (e.message && e.message.includes('EXPIRED')) {
      errorMessage = messages.error_expired || 'Transaction expired, please try again'
    } else if (e.message && e.message.includes('IDENTICAL_ADDRESSES')) {
      errorMessage = messages.error_identical_addresses || 'Cannot add liquidity for the same token'
    } else if (e.message && e.message.includes('ZERO_ADDRESS')) {
      errorMessage = messages.error_zero_address || 'Invalid token address'
    } else if (e.message && e.message.includes('timeout')) {
      errorMessage = messages.error_timeout || 'Transaction confirmation timeout, please check blockchain explorer'
    } else if (e.message && e.message.includes('Gas estimation failed')) {
      errorMessage = messages.error_gas_estimation || 'Gas estimation failed, please check network connection or contract address'
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
      approvalHashes,
      didApprove,
      priceImpact,
      error: errorMessage
    }
  }
}

export default doAddLiquidity