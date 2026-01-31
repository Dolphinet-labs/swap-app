



import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { Pair, Route, Trade } from '@uniswap/v2-sdk';
import { CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { getCreate2Address } from '@ethersproject/address';
import { keccak256, pack } from '@ethersproject/solidity';

// RPC URL 和工厂合约地址
const RPC_URL = 'https://rpc.dolphinode.world';
const FACTORY_ADDRESS = '0xf0D5b329e7A43dC014d46B79cd99b82EB26fbC37';
const INIT_CODE_HASH = '0xcaa2da3f024b3624669464e0d7cb4cd3ce62345cc347579fc16aecc3b020c722';

// 使用您指定的Token定义格式
const allLptoken = [
  {
    name: 'dol/usdt',
    token0: new Token(1520, '0xFEde7dF3dfdaaBeC24B0B41aEC75500A35C201fA', 18, 'WDOL', 'Wrapped DOL'),
    token1: new Token(1520, '0xF61C878b8116358BCfC5b6b45275035a658017Fa', 6, 'USDT', 'Tether USD'),
    pairAddress: '0x0b4dfb3bc7294bd89320F4d6686481a769587c9a',
    apr: "",
    lptokenPrice: "",
    lptokenNum: "",
    // 新增字段
    pairName: "",
    token0Symbol: "",
    token1Symbol: "",
    liquidityTokenAddress: "",
    userPoolBalance: "",
    token0Deposited: "",
    token1Deposited: "",
    userPoolTokens: "",
    poolTokenPercentage: ""
  },
  {
    name: 'dol/usdol',
    token0: new Token(1520, '0xFEde7dF3dfdaaBeC24B0B41aEC75500A35C201fA', 18, 'WDOL', 'Wrapped DOL'),
    token1: new Token(1520, '0xE1B7bEE68E1803A3Ba13E75dE1dEC117e4654500', 6, 'USDOL', 'USDOL'),
    pairAddress: '0x842a57bf05e9205D5bEcDCb3B201e08763853D17',
    apr: "",
    lptokenPrice: "",
    lptokenNum: "",
    // 新增字段
    pairName: "",
    token0Symbol: "",
    token1Symbol: "",
    liquidityTokenAddress: "",
    userPoolBalance: "",
    token0Deposited: "",
    token1Deposited: "",
    userPoolTokens: "",
    poolTokenPercentage: ""
  },
 
];

// ABI 定义
const PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function kLast() external view returns (uint256)"
];

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  "function allPairs(uint) external view returns (address pair)",
  "function allPairsLength() external view returns (uint)"
];

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)",
  "function transferFrom(address from, address to, uint amount) returns (bool)",
  "function approve(address spender, uint amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

/**
 * CPChain APR 计算器 - 优化版本（真实汇率计算）
 */
class CPChainAPRCalculator {
  constructor(config = {}) {
    this.config = {
      rpcUrl: config.rpcUrl || RPC_URL,
      rateLimitDelay: config.rateLimitDelay || 100,
      maxRetries: config.maxRetries || 3,
      enableLogging: config.enableLogging !== false,
      concurrentLimit: config.concurrentLimit || 3,
      ...config
    };
    
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, this.provider);
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.rateLimitDelay = this.config.rateLimitDelay;
    
    // 价格缓存，避免重复计算
    this.priceCache = new Map();
    this.cacheExpiry = 30000; // 30秒缓存
  }

  /**
   * 结构化日志记录
   */
  log(level, message, data = {}) {
    if (!this.config.enableLogging) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };
    
    switch (level) {
      case 'error':
        console.error(`❌ [${timestamp}] ${message}`, data);
        break;
      case 'warn':
        console.warn(`⚠️ [${timestamp}] ${message}`, data);
        break;
      case 'info':
        console.log(`ℹ️ [${timestamp}] ${message}`, data);
        break;
      default:
        console.log(`📝 [${timestamp}] ${message}`, data);
    }
  }

  /**
   * 带重试的网络请求
   */
  async retryRequest(requestFn, maxRetries = this.config.maxRetries, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await requestFn();
      } catch (error) {
        this.log('warn', `请求失败，重试 ${i + 1}/${maxRetries}`, { error: error.message });
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  /**
   * 增强的地址验证
   */
  validateAddress(address) {
    if (!address || typeof address !== 'string') {
      return false;
    }
    try {
      return ethers.isAddress(address) && ethers.getAddress(address) === address;
    } catch {
      return ethers.isAddress(address);
    }
  }

  /**
   * 验证用户地址（排除零地址）
   */
  validateUserAddress(address) {
    return this.validateAddress(address) && 
           address !== '0x0000000000000000000000000000000000000000';
  }

  /**
   * 验证Token对象
   */
  validateToken(token) {
    return token &&
      this.validateAddress(token.address) &&
      typeof token.symbol === 'string' &&
      typeof token.decimals === 'number';
  }

  /**
   * 计算 pair 地址（基于 Uniswap V2 标准）
   */
  getPairAddress(tokenA, tokenB) {
    if (!this.validateToken(tokenA) || !this.validateToken(tokenB)) {
      throw new Error('无效的代币参数');
    }

    const [token0, token1] = tokenA.sortsBefore(tokenB)
      ? [tokenA, tokenB]
      : [tokenB, tokenA];
    const salt = keccak256(
      ['bytes'],
      [pack(['address', 'address'], [token0.address, token1.address])]
    );
    return getCreate2Address(FACTORY_ADDRESS, salt, INIT_CODE_HASH);
  }

  /**
   * 判断 pair 是否存在且有流动性
   */
  async isPairAvailable(pairAddress) {
    if (!this.validateAddress(pairAddress)) {
      return false;
    }

    try {
      return await this.retryRequest(async () => {
        const abi = ["function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"];
        const pair = new ethers.Contract(pairAddress, abi, this.provider);
        try {
          const { reserve0, reserve1 } = await pair.getReserves();
          return BigInt(reserve0) > 0n && BigInt(reserve1) > 0n;
        } catch (error) {
          // 如果调用失败（池子不存在或其他错误），返回 false
          this.log('warn', `检查池子流动性失败: ${pairAddress}`, { error: error.message });
          return false;
        }
      });
    } catch (error) {
      this.log('warn', `isPairAvailable 失败: ${pairAddress}`, { error: error.message });
      return false;
    }
  }

  /**
   * 获取真实的稳定币价格（通过池子计算）
   */
  async getRealStablecoinPrice(tokenSymbol, tokenAddress) {
    try {
      const cacheKey = `${tokenSymbol}_${Date.now()}`;
      const cached = this.priceCache.get(tokenSymbol);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.price;
      }

      // USDT作为基准价格1.0
      if (tokenSymbol.toUpperCase() === 'USDT') {
        this.priceCache.set(tokenSymbol, { price: 1.0, timestamp: Date.now() });
        return 1.0;
      }

      // USDOL通过USDT/USDOL池子计算真实汇率
      if (tokenSymbol.toUpperCase() === 'USDOL') {
        try {
          const usdtToken = new Token(1520, '0xF61C878b8116358BCfC5b6b45275035a658017Fa', 6, 'USDT', 'Tether USD');
          const usdolToken = new Token(1520, '0xE1B7bEE68E1803A3Ba13E75dE1dEC117e4654500', 6, 'USDOL', 'USDOL');
          
          const pairAddress = this.getPairAddress(usdtToken, usdolToken);
          this.log('info', `USDT/USDOL 池子地址: ${pairAddress}`);
          
          const hasLiquidity = await this.isPairAvailable(pairAddress);
          
          if (!hasLiquidity) {
            this.log('warn', 'USDT/USDOL 池子无流动性或不存在，使用默认汇率 0.999');
            this.priceCache.set(tokenSymbol, { price: 0.999, timestamp: Date.now() });
            return 0.999;
          }

          const pairAbi = ["function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"];
          const pairContract = new ethers.Contract(pairAddress, pairAbi, this.provider);
          const { reserve0, reserve1 } = await pairContract.getReserves();

          const [token0, token1] = usdtToken.sortsBefore(usdolToken)
            ? [usdtToken, usdolToken]
            : [usdolToken, usdtToken];

          const reserve0Formatted = Number(ethers.formatUnits(reserve0.toString(), token0.decimals));
          const reserve1Formatted = Number(ethers.formatUnits(reserve1.toString(), token1.decimals));

          if (reserve0Formatted === 0 || reserve1Formatted === 0) {
            this.log('warn', 'USDT/USDOL 池子储备量为零，使用默认汇率');
            this.priceCache.set(tokenSymbol, { price: 0.999, timestamp: Date.now() });
            return 0.999;
          }

          // 计算USDOL相对于USDT的价格
          const usdtReserve = token0.address === usdtToken.address ? reserve0Formatted : reserve1Formatted;
          const usdolReserve = token0.address === usdtToken.address ? reserve1Formatted : reserve0Formatted;
          
          if (usdolReserve === 0) {
            this.priceCache.set(tokenSymbol, { price: 0.999, timestamp: Date.now() });
            return 0.999;
          }
          
          const usdolPrice = usdtReserve / usdolReserve; // USDOL价格 = USDT储备量 / USDOL储备量
          
          this.log('info', `USDOL真实汇率计算`, {
            usdtReserve: usdtReserve.toFixed(2),
            usdolReserve: usdolReserve.toFixed(2),
            usdolPrice: usdolPrice.toFixed(6)
          });
          
          this.priceCache.set(tokenSymbol, { price: usdolPrice, timestamp: Date.now() });
          return usdolPrice;
        } catch (error) {
          this.log('error', 'USDOL价格计算异常，使用默认汇率', { error: error.message });
          this.priceCache.set(tokenSymbol, { price: 0.999, timestamp: Date.now() });
          return 0.999;
        }
      }

      // 其他稳定币默认价格
      if (['DAI', 'BUSD'].includes(tokenSymbol.toUpperCase())) {
        return 1.0;
      }

      return 1.0;
    } catch (error) {
      this.log('error', `获取 ${tokenSymbol} 真实价格失败`, { error: error.message });
      return tokenSymbol.toUpperCase() === 'USDOL' ? 0.999 : 1.0;
    }
  }

  /**
   * 实时获取代币价格（使用真实汇率）
   */
  async getTokenPriceRealtime(tokenAddress, tokenSymbol) {
    try {
      if (!this.validateAddress(tokenAddress) || !tokenSymbol) {
        throw new Error('无效的代币地址或符号');
      }

      this.log('info', `实时获取 ${tokenSymbol} 价格`);

      // 稳定币使用真实汇率
      if (['USDT', 'USDOL', 'DAI', 'BUSD'].includes(tokenSymbol.toUpperCase())) {
        const realPrice = await this.getRealStablecoinPrice(tokenSymbol, tokenAddress);
        this.log('info', `${tokenSymbol} 真实价格: $${realPrice.toFixed(6)}`);
        return realPrice;
      }

      // WDOL价格计算（通过USDT池子）- WDOL是DOL的包装币
      if (tokenSymbol.toUpperCase() === 'WDOL') {
        return this.retryRequest(async () => {
          const wdolToken = new Token(1520, '0xFEde7dF3dfdaaBeC24B0B41aEC75500A35C201fA', 18, 'WDOL', 'Wrapped DOL');
          const usdtToken = new Token(1520, '0xF61C878b8116358BCfC5b6b45275035a658017Fa', 6, 'USDT', 'Tether USD');

          const pairAddress = this.getPairAddress(wdolToken, usdtToken);
          const hasLiquidity = await this.isPairAvailable(pairAddress);

          if (!hasLiquidity) {
            this.log('warn', 'WDOL/USDT 池子无流动性，使用默认价格');
            return 0.01;
          }

          const pairAbi = ["function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"];
          const pairContract = new ethers.Contract(pairAddress, pairAbi, this.provider);
          const { reserve0, reserve1 } = await pairContract.getReserves();

          const [token0, token1] = wdolToken.sortsBefore(usdtToken)
            ? [wdolToken, usdtToken]
            : [usdtToken, wdolToken];

          const reserve0Formatted = Number(ethers.formatUnits(reserve0.toString(), token0.decimals));
          const reserve1Formatted = Number(ethers.formatUnits(reserve1.toString(), token1.decimals));

          if (reserve0Formatted === 0 || reserve1Formatted === 0) {
            this.log('warn', 'WDOL/USDT 池子储备量为零，使用默认价格');
            return 0.01;
          }

          const wdolReserve = token0.address === wdolToken.address ? reserve0Formatted : reserve1Formatted;
          const usdtReserve = token0.address === wdolToken.address ? reserve1Formatted : reserve0Formatted;

          if (wdolReserve === 0) {
            this.log('warn', 'WDOL储备量为零，使用默认价格');
            return 0.01;
          }

          const price = usdtReserve / wdolReserve;
          this.log('info', `WDOL实时价格: $${price.toFixed(6)}`, {
            wdolReserve: wdolReserve.toFixed(2),
            usdtReserve: usdtReserve.toFixed(2)
          });
          return price;
        });
      }

      this.log('warn', `无法获取 ${tokenSymbol} 实时价格，使用默认值 $0.01`);
      return 0.01;
    } catch (error) {
      this.log('error', `获取 ${tokenSymbol} 实时价格失败`, { error: error.message });
      return 0.01;
    }
  }

  /**
   * 获取代币信息
   */
  async getTokenInfo(tokenAddress) {
    try {
      if (!this.validateAddress(tokenAddress)) {
        throw new Error('无效的代币地址');
      }

      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        return { symbol: 'DOL', decimals: 18 };
      }

      return this.retryRequest(async () => {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
        const [symbol, decimals] = await Promise.all([
          tokenContract.symbol(),
          tokenContract.decimals()
        ]);
        return { symbol, decimals: Number(decimals) };
      });
    } catch (error) {
      this.log('error', '获取代币信息失败', { error: error.message });
      return { symbol: 'UNKNOWN', decimals: 18 };
    }
  }

  /**
   * 获取池子储备量信息（实时）
   */
  async getPoolReservesRealtime(token0, token1) {
    try {
      if (!this.validateToken(token0) || !this.validateToken(token1)) {
        throw new Error('无效的代币参数');
      }

      const pairAddress = this.getPairAddress(token0, token1);
      const hasLiquidity = await this.isPairAvailable(pairAddress);

      if (!hasLiquidity) {
        return { reserve0: 0, reserve1: 0, pairAddress, blockTimestampLast: 0 };
      }

      return this.retryRequest(async () => {
        const pairAbi = ["function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"];
        const pairContract = new ethers.Contract(pairAddress, pairAbi, this.provider);
        const { reserve0, reserve1, blockTimestampLast } = await pairContract.getReserves();

        const [sortedToken0, sortedToken1] = token0.sortsBefore(token1)
          ? [token0, token1]
          : [token1, token0];

        const reserve0Formatted = Number(ethers.formatUnits(reserve0.toString(), sortedToken0.decimals));
        const reserve1Formatted = Number(ethers.formatUnits(reserve1.toString(), sortedToken1.decimals));

        return sortedToken0.address === token0.address
          ? { reserve0: reserve0Formatted, reserve1: reserve1Formatted, pairAddress, blockTimestampLast }
          : { reserve0: reserve1Formatted, reserve1: reserve0Formatted, pairAddress, blockTimestampLast };
      });
    } catch (error) {
      this.log('error', '获取池子储备量失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 验证配对地址
   */
  async validatePairAddress(pairAddress) {
    try {
      if (!this.validateAddress(pairAddress)) {
        return false;
      }

      return this.retryRequest(async () => {
        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, this.provider);
        await pairContract.getReserves();
        return true;
      });
    } catch (error) {
      this.log('error', `无效的配对地址 ${pairAddress}`, { error: error.message });
      return false;
    }
  }

  /**
   * 优化的交易量估算算法（降低基础比例）
   */
  estimateVolume24h(tvl, token0Symbol, token1Symbol) {
    // 降低基础交易量比例
    let volumeRatio = 0.008; // 从5%降低到0.8%

    // 根据TVL大小调整（更保守）
    if (tvl > 100000) volumeRatio = 0.015; // 1.5%
    if (tvl > 500000) volumeRatio = 0.025; // 2.5%
    if (tvl > 1000000) volumeRatio = 0.035; // 3.5%

    // 根据代币类型调整（更保守的倍数）
    const stablecoins = ['USDT', 'USDOL', 'DAI'];
    const isStablePair = stablecoins.includes(token0Symbol.toUpperCase()) &&
      stablecoins.includes(token1Symbol.toUpperCase());

    if (isStablePair) {
      volumeRatio *= 1.1; // 从1.5倍降低到1.1倍
    }

    // 包含主要代币的池子交易更活跃（更保守）
    if (token0Symbol.toUpperCase() === 'WDOL' || token1Symbol.toUpperCase() === 'WDOL') {
      volumeRatio *= 1.05; // 从1.2倍降低到1.05倍
    }

    // 添加最大交易量限制
    const estimatedVolume = tvl * volumeRatio;
    const maxVolume = tvl * 0.025; // 最大不超过TVL的2.5%
    
    return Math.min(estimatedVolume, maxVolume);
  }

  /**
   * APR合理性检查
   */
  validateAPR(apr, tvl, token0Symbol, token1Symbol) {
    // APR合理性检查
    if (apr > 20) {
      this.log('warn', `APR过高 ${apr.toFixed(2)}%，使用保守算法重新计算`);
      
      // 使用更保守的算法
      const conservativeVolume = tvl * 0.005; // 0.5%
      const conservativeFees = conservativeVolume * 0.003;
      const conservativeAPR = tvl > 0 ? (conservativeFees * 365 / tvl) * 100 : 0;
      
      return Math.min(conservativeAPR, 15); // 最大15%
    }
    
    return apr;
  }

  /**
   * 计算池子 APR（使用真实汇率，优化版本）
   */
  async calculatePoolAPR(lpToken) {
    try {
      if (!lpToken || !lpToken.name || !this.validateToken(lpToken.token0) || !this.validateToken(lpToken.token1)) {
        throw new Error('无效的LP代币参数');
      }

      this.log('info', `实时计算 ${lpToken.name} 的APR`);

      // 验证配对地址
      const isValidPair = await this.validatePairAddress(lpToken.pairAddress);
      if (!isValidPair) {
        this.log('error', `无效的配对地址: ${lpToken.pairAddress}`);
        return {
          name: lpToken.name,
          pairAddress: lpToken.pairAddress,
          apr: '0',
          lptokenPrice: '0',
          tvl: 0,
          volume24h: 0,
          fees24h: 0,
          error: '无效的配对地址'
        };
      }

      // 频率控制
      const now = Date.now();
      if (now - this.lastRequestTime < this.rateLimitDelay) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
      this.lastRequestTime = Date.now();
      this.requestCount++;

      // 获取实时储备量信息
      const reservesInfo = await this.getPoolReservesRealtime(lpToken.token0, lpToken.token1);

      if (reservesInfo.reserve0 === 0 || reservesInfo.reserve1 === 0) {
        this.log('warn', `${lpToken.name} 池子无流动性`);
        return {
          name: lpToken.name,
          pairAddress: lpToken.pairAddress,
          apr: '0',
          lptokenPrice: '0',
          tvl: 0,
          volume24h: 0,
          fees24h: 0,
          token0Reserve: 0,
          token1Reserve: 0,
          token0Price: 0,
          token1Price: 0
        };
      }

      // 获取实时代币价格（使用真实汇率）
      const [token0Price, token1Price] = await Promise.all([
        this.getTokenPriceRealtime(lpToken.token0.address, lpToken.token0.symbol),
        this.getTokenPriceRealtime(lpToken.token1.address, lpToken.token1.symbol)
      ]);

      // 计算TVL
      const token0Value = reservesInfo.reserve0 * token0Price;
      const token1Value = reservesInfo.reserve1 * token1Price;
      const tvl = token0Value + token1Value;

      this.log('info', `${lpToken.name} 实时TVL分析`, {
        token0: `${lpToken.token0.symbol}: ${reservesInfo.reserve0.toFixed(4)} × $${token0Price.toFixed(6)} = $${token0Value.toFixed(2)}`,
        token1: `${lpToken.token1.symbol}: ${reservesInfo.reserve1.toFixed(4)} × $${token1Price.toFixed(6)} = $${token1Value.toFixed(2)}`,
        totalTVL: `$${tvl.toFixed(2)}`
      });

      // 使用优化的交易量估算
      const volume24h = this.estimateVolume24h(tvl, lpToken.token0.symbol, lpToken.token1.symbol);
      const feeRate = 0.003; // 0.3% 手续费
      const fees24h = volume24h * feeRate;

      // 计算年化收益率
      let apr = tvl > 0 ? (fees24h * 365 / tvl) * 100 : 0;
      
      // APR合理性检查
      apr = this.validateAPR(apr, tvl, lpToken.token0.symbol, lpToken.token1.symbol);

      this.log('info', `${lpToken.name} 优化APR计算`, {
        volume24h: `$${volume24h.toFixed(2)}`,
        fees24h: `$${fees24h.toFixed(2)}`,
        apr: `${apr.toFixed(2)}%`
      });

      return {
        name: lpToken.name,
        pairAddress: lpToken.pairAddress,
        apr: apr.toFixed(2),
        lptokenPrice: tvl.toFixed(2),
        tvl: tvl,
        volume24h: volume24h,
        fees24h: fees24h,
        token0Reserve: reservesInfo.reserve0,
        token1Reserve: reservesInfo.reserve1,
        token0Price: token0Price,
        token1Price: token1Price
      };
    } catch (error) {
      this.log('error', `计算 ${lpToken?.name || 'unknown'} APR失败`, { error: error.message });
      return {
        name: lpToken?.name || 'unknown',
        pairAddress: lpToken?.pairAddress || '',
        apr: '0',
        lptokenPrice: '0',
        tvl: 0,
        volume24h: 0,
        fees24h: 0,
        error: error.message
      };
    }
  }

  /**
   * 并发限制处理函数
   */
  async processConcurrently(tasks, limit = this.config.concurrentLimit) {
    const results = [];
    for (let i = 0; i < tasks.length; i += limit) {
      const batch = tasks.slice(i, i + limit);
      const batchResults = await Promise.allSettled(batch.map(task => task()));
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : {
          error: result.reason?.message || '处理失败'
        }
      ));
      
      // 批次间延迟
      if (i + limit < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
    }
    return results;
  }

  /**
   * 获取所有 LP 池的 APR（并发优化版本）
   */
  async getAllPoolAPRs() {
    this.log('info', '开始并发获取所有池子的APR');
    
    const tasks = allLptoken.map((lpToken, index) => () => {
      // 为每个任务添加随机延迟，避免同时请求
      return new Promise(resolve => {
        setTimeout(async () => {
          try {
            const result = await this.calculatePoolAPR(lpToken);
            resolve(result);
          } catch (error) {
            resolve({
              name: lpToken.name,
              apr: '0',
              error: error.message
            });
          }
        }, index * 50); // 每个任务间隔50ms
      });
    });

    const results = await this.processConcurrently(tasks);
    
    this.log('info', '所有池子APR计算完成');
    console.table(results);
    return results;
  }

  /**
   * 获取用户 LP 余额
   */
  async getUserLPBalance(userAddress, lpToken) {
    try {
      this.log('info', `获取用户LP余额: ${userAddress} in ${lpToken.name}`);

      if (!this.validateUserAddress(userAddress)) {
        this.log('error', '无效的用户地址');
        return '0';
      }

      if (!this.validateAddress(lpToken.pairAddress)) {
        this.log('error', '无效的配对地址');
        return '0';
      }

      return this.retryRequest(async () => {
        const pairContract = new ethers.Contract(lpToken.pairAddress, PAIR_ABI, this.provider);
        const balance = await pairContract.balanceOf(userAddress);
        const balanceBigInt = BigInt(balance.toString());
        const formattedBalance = ethers.formatEther(balance);
        
        this.log('info', `用户LP余额详情`, {
          raw: balance.toString(),
          bigInt: balanceBigInt.toString(),
          formatted: formattedBalance,
          hasBalance: balanceBigInt > 0n
        });
        
        // 如果余额非常小，保留更多小数位
        if (balanceBigInt > 0n && parseFloat(formattedBalance) === 0) {
          // 对于非常小的数字，返回科学计数法或更多小数位
          const significantBalance = parseFloat(formattedBalance).toFixed(18);
          this.log('warn', `LP余额很小，使用高精度: ${significantBalance}`);
          return significantBalance;
        }
        
        return formattedBalance;
      });
    } catch (error) {
      this.log('error', '获取用户LP余额失败', { error: error.message });
      return '0';
    }
  }

  /**
   * 获取用户在特定池子中的详细信息
   */
  async getUserPoolDetails(userAddress, lpToken) {
    try {
      this.log('info', `获取用户池子详情: ${userAddress} in ${lpToken.name}`);

      if (!this.validateUserAddress(userAddress)) {
        this.log('error', '无效的用户地址');
        return null;
      }

      if (!this.validateAddress(lpToken.pairAddress)) {
        this.log('error', '无效的配对地址');
        return null;
      }

      return this.retryRequest(async () => {
        const pairContract = new ethers.Contract(lpToken.pairAddress, PAIR_ABI, this.provider);
        const [userBalance, totalSupply, reserves] = await Promise.all([
          pairContract.balanceOf(userAddress),
          pairContract.totalSupply(),
          pairContract.getReserves()
        ]);

        const userBalanceFormatted = Number(ethers.formatEther(userBalance));
        const totalSupplyFormatted = Number(ethers.formatEther(totalSupply));
        const userPercentage = totalSupplyFormatted > 0 ? (userBalanceFormatted / totalSupplyFormatted) * 100 : 0;

        // 获取token0地址确定储备量顺序
        const token0Address = await pairContract.token0();
        const isToken0First = token0Address.toLowerCase() === lpToken.token0.address.toLowerCase();

        const reserve0Raw = isToken0First ? reserves.reserve0 : reserves.reserve1;
        const reserve1Raw = isToken0First ? reserves.reserve1 : reserves.reserve0;

        const reserve0 = Number(ethers.formatUnits(reserve0Raw, lpToken.token0.decimals));
        const reserve1 = Number(ethers.formatUnits(reserve1Raw, lpToken.token1.decimals));

        // 修复：计算用户在池子中的代币数量
        const userToken0Amount = reserve0 * (userPercentage / 100);
        const userToken1Amount = reserve1 * (userPercentage / 100);

        // 根据数值大小动态决定小数位数 - 避免科学计数法
        const formatAmount = (amount) => {
          if (amount === 0) return '0';
          if (amount < 0.000001) {
            // 使用完整小数格式，保留至少8位有效数字
            const str = amount.toFixed(18)
            // 移除尾部0，但至少保留8位小数
            return str.replace(/(\.\d{8,}?)0+$/, '$1')
          }
          if (amount < 0.01) return amount.toFixed(8); // 8位小数
          return amount.toFixed(6); // 6位小数
        };

        this.log('info', `用户池子详情`, {
          pool: lpToken.name,
          userBalance: userBalanceFormatted,
          percentage: userPercentage.toFixed(6),
          token0Amount: userToken0Amount,
          token1Amount: userToken1Amount
        });

        return {
          pairName: lpToken.name,
          token0Symbol: lpToken.token0.symbol,
          token1Symbol: lpToken.token1.symbol,
          liquidityTokenAddress: lpToken.pairAddress,
          userPoolBalance: formatAmount(userBalanceFormatted),
          token0Deposited: formatAmount(userToken0Amount),
          token1Deposited: formatAmount(userToken1Amount),
          poolTokenPercentage: userPercentage.toFixed(4)
        };
      });
    } catch (error) {
      this.log('error', '获取用户池子详情失败', { error: error.message });
      return null;
    }
  }

  /**
   * 获取用户所有 LP 余额 - 并发优化版本
   */
  async getUserAllLPBalances(userAddress) {
    try {
      this.log('info', `并发获取用户所有LP余额: ${userAddress}`);

      if (!this.validateUserAddress(userAddress)) {
        this.log('error', '无效的用户地址');
        return [];
      }

      // 并发获取APR和用户余额
      const [aprs, balances] = await Promise.all([
        this.getAllPoolAPRs(),
        Promise.all(allLptoken.map(lpToken => this.getUserLPBalance(userAddress, lpToken)))
      ]);

      // 并发获取用户详情
      const userDetailsTasks = allLptoken.map(lpToken => () => 
        this.getUserPoolDetails(userAddress, lpToken)
      );
      const userDetails = await this.processConcurrently(userDetailsTasks);

      const results = [];
      for (let index = 0; index < allLptoken.length; index++) {
        const lpToken = allLptoken[index];
        const userDetail = userDetails[index];

        const result = {
          // 原有字段
          ...aprs[index],
          lptokenNum: balances[index],

          // 新增字段 - 使用实际计算的值，移除重复的userPoolTokens字段
          pairName: userDetail ? userDetail.pairName : (lpToken.name || ""),
          token0Symbol: userDetail ? userDetail.token0Symbol : (lpToken.token0.symbol || ""),
          token1Symbol: userDetail ? userDetail.token1Symbol : (lpToken.token1.symbol || ""),
          liquidityTokenAddress: userDetail ? userDetail.liquidityTokenAddress : (lpToken.pairAddress || ""),
          userPoolBalance: userDetail ? userDetail.userPoolBalance : (balances[index] || "0"),
          token0Deposited: userDetail ? userDetail.token0Deposited : "0",
          token1Deposited: userDetail ? userDetail.token1Deposited : "0",
          poolTokenPercentage: userDetail ? userDetail.poolTokenPercentage : "0"
        };

        results.push(result);
      }

      // 打印完整结果摘要
      this.log('info', '所有字段获取完成摘要');
      console.table(results.map(r => ({
        池子: r.pairName,
        Token0: r.token0Symbol,
        Token1: r.token1Symbol,
        APR: r.apr + '%',
        TVL: '$' + r.lptokenPrice,
        用户余额: r.userPoolBalance,
        Token0存入: r.token0Deposited,
        Token1存入: r.token1Deposited,
        池子百分比: r.poolTokenPercentage + '%'
      })));

      this.log('info', '用户所有LP余额获取完成');
      return results;
    } catch (error) {
      this.log('error', '获取用户所有LP余额失败', { error: error.message });
      return [];
    }
  }

  /**
   * 获取用户所有池子的详细信息
   */
  async getUserAllPoolDetails(userAddress) {
    try {
      this.log('info', `获取用户所有池子详情: ${userAddress}`);

      if (!this.validateUserAddress(userAddress)) {
        this.log('error', '无效的用户地址');
        return [];
      }

      const tasks = allLptoken.map(lpToken => () => 
        this.getUserPoolDetails(userAddress, lpToken)
      );
      
      const results = await this.processConcurrently(tasks);
      const validResults = results.filter(result => result !== null);

      this.log('info', '用户所有池子详情获取完成');
      return validResults;
    } catch (error) {
      this.log('error', '获取用户所有池子详情失败', { error: error.message });
      return [];
    }
  }

  /**
   * 更新LP代币数组中的字段（实时）
   */
  async updateLPTokenFields(userAddress = null) {
    try {
      this.log('info', '实时更新LP代币字段');

      if (userAddress && !this.validateUserAddress(userAddress)) {
        this.log('error', '无效的用户地址');
        userAddress = null;
      }

      // 并发获取APR数据
      const aprTasks = allLptoken.map(lpToken => () => this.calculatePoolAPR(lpToken));
      const aprResults = await this.processConcurrently(aprTasks);

      // 如果提供了用户地址，并发获取用户详情
      let userDetails = [];
      if (userAddress) {
        const userTasks = allLptoken.map(lpToken => () => 
          this.getUserPoolDetails(userAddress, lpToken)
        );
        userDetails = await this.processConcurrently(userTasks);
      }

      const updatedTokens = allLptoken.map((lpToken, index) => {
        const aprData = aprResults[index];
        const userDetail = userDetails[index];

        return {
          ...lpToken,
          apr: aprData.apr,
          lptokenPrice: aprData.lptokenPrice,
          lptokenNum: userDetail ? userDetail.userPoolBalance : "0",
          pairName: lpToken.name,
          token0Symbol: lpToken.token0.symbol,
          token1Symbol: lpToken.token1.symbol,
          liquidityTokenAddress: lpToken.pairAddress,
          userPoolBalance: userDetail ? userDetail.userPoolBalance : "0",
          token0Deposited: userDetail ? userDetail.token0Deposited : "0",
          token1Deposited: userDetail ? userDetail.token1Deposited : "0",
          poolTokenPercentage: userDetail ? userDetail.poolTokenPercentage : "0"
        };
      });

      this.log('info', 'LP代币字段更新完成');
      return updatedTokens;
    } catch (error) {
      this.log('error', '更新LP代币字段失败', { error: error.message });
      return allLptoken;
    }
  }

  /**
   * 获取请求统计
   */
  getRequestStats() {
    const stats = {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      rateLimitDelay: this.rateLimitDelay,
      config: this.config
    };

    this.log('info', '请求统计', stats);
    return stats;
  }

  /**
   * 获取池子详细信息
   */
  async getPoolDetails(pairAddress) {
    try {
      if (!this.validateAddress(pairAddress)) {
        throw new Error('无效的配对地址');
      }

      return this.retryRequest(async () => {
        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, this.provider);
        const [reserves, token0Address, token1Address, totalSupply] = await Promise.all([
          pairContract.getReserves(),
          pairContract.token0(),
          pairContract.token1(),
          pairContract.totalSupply()
        ]);

        const [token0Info, token1Info] = await Promise.all([
          this.getTokenInfo(token0Address),
          this.getTokenInfo(token1Address)
        ]);

        return {
          pairAddress,
          token0: { address: token0Address, ...token0Info },
          token1: { address: token1Address, ...token1Info },
          reserves: {
            reserve0: ethers.formatUnits(reserves.reserve0, token0Info.decimals),
            reserve1: ethers.formatUnits(reserves.reserve1, token1Info.decimals),
            blockTimestampLast: reserves.blockTimestampLast
          },
          totalSupply: ethers.formatEther(totalSupply)
        };
      });
    } catch (error) {
      this.log('error', '获取池子详情失败', { error: error.message });
      throw error;
    }
  }
}

// 导出
export { CPChainAPRCalculator, allLptoken };