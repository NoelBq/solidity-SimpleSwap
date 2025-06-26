# SimpleSwap DEX

A minimal, secure decentralized exchange (DEX) smart contract for swapping between two tokens. Built following Solidity best practices with comprehensive NatSpec documentation, custom errors, and gas-optimized state management.

## Contract Overview

SimpleSwap is a streamlined AMM (Automated Market Maker) that uses the constant product formula (x \* y = k) to facilitate token swaps. It supports only two tokens and maintains a single liquidity pool.

## Development Setup

### Install Dependencies

```bash
bun install
```

### Compile Contracts

```bash
bun run compile
```

### Run Tests

```bash
bunx hardhat test
```

### Deploy Locally

```bash
# Start local blockchain
bunx hardhat node

# Deploy (in another terminal)
bun run deploy-localhost
```

### Deploy to Sepolia

```bash
bun run deploy-sepolia
```

## Frontend Integration Guide

### Contract Functions

#### `addLiquidity()`

Adds liquidity to the pool by depositing both tokens.

**Function Signature:**

```solidity
function addLiquidity(
    address tokenA,
    address tokenB,
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline
) external returns (uint256 amountA, uint256 amountB, uint256 liquidity)
```

**Parameters:**

- `tokenA`: Address of the first token (must be one of the pool's tokens)
- `tokenB`: Address of the second token (must be one of the pool's tokens)
- `amountADesired`: Maximum amount of tokenA to deposit
- `amountBDesired`: Maximum amount of tokenB to deposit
- `amountAMin`: Minimum amount of tokenA to deposit (slippage protection)
- `amountBMin`: Minimum amount of tokenB to deposit (slippage protection)
- `to`: Address to receive the LP tokens
- `deadline`: Unix timestamp after which the transaction will revert

**Returns:**

- `amountA`: Actual amount of tokenA deposited
- `amountB`: Actual amount of tokenB deposited
- `liquidity`: Amount of LP tokens minted

**Events Emitted:**

- `LiquidityAdded(address indexed to, uint256 amountA, uint256 amountB, uint256 liquidity)`

**Frontend Usage:**

```javascript
// Before calling, ensure user has approved the contract to spend their tokens
await tokenA.approve(simpleSwapAddress, amountADesired);
await tokenB.approve(simpleSwapAddress, amountBDesired);

// Add liquidity
const tx = await simpleSwap.addLiquidity(
  tokenAAddress,
  tokenBAddress,
  ethers.parseEther("1000"), // 1000 tokenA
  ethers.parseEther("2000"), // 2000 tokenB
  ethers.parseEther("950"), // min 950 tokenA (5% slippage)
  ethers.parseEther("1900"), // min 1900 tokenB (5% slippage)
  userAddress,
  Math.floor(Date.now() / 1000) + 300 // 5 minutes from now
);
```

#### `removeLiquidity()`

Removes liquidity by burning LP tokens and receiving both underlying tokens.

**Function Signature:**

```solidity
function removeLiquidity(
    address tokenA,
    address tokenB,
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline
) external returns (uint256 amountA, uint256 amountB)
```

**Parameters:**

- `tokenA`: Address of the first token
- `tokenB`: Address of the second token
- `liquidity`: Amount of LP tokens to burn
- `amountAMin`: Minimum amount of tokenA to receive (slippage protection)
- `amountBMin`: Minimum amount of tokenB to receive (slippage protection)
- `to`: Address to receive the tokens
- `deadline`: Unix timestamp after which the transaction will revert

**Returns:**

- `amountA`: Amount of tokenA received
- `amountB`: Amount of tokenB received

**Events Emitted:**

- `LiquidityRemoved(address indexed to, uint256 amountA, uint256 amountB, uint256 liquidity)`

**Frontend Usage:**

```javascript
// Get user's LP token balance first
const lpBalance = await simpleSwap.balanceOf(userAddress);

// Remove liquidity
const tx = await simpleSwap.removeLiquidity(
  tokenAAddress,
  tokenBAddress,
  ethers.parseEther("100"), // 100 LP tokens
  ethers.parseEther("450"), // min tokenA expected
  ethers.parseEther("900"), // min tokenB expected
  userAddress,
  Math.floor(Date.now() / 1000) + 300
);
```

#### `swapExactTokensForTokens()`

Swaps an exact amount of input tokens for as many output tokens as possible.

**Function Signature:**

```solidity
function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline
) external returns (uint256[] memory amounts)
```

**Parameters:**

- `amountIn`: Exact amount of input tokens to swap
- `amountOutMin`: Minimum amount of output tokens to receive (slippage protection)
- `path`: Array of token addresses [tokenIn, tokenOut] (must be exactly 2 addresses)
- `to`: Address to receive the output tokens
- `deadline`: Unix timestamp after which the transaction will revert

**Returns:**

- `amounts`: Array containing [amountIn, amountOut]

**Events Emitted:**

- `Swap(address indexed sender, uint256 amountIn, uint256 amountOut, address indexed tokenIn, address indexed tokenOut, address indexed to)`

**Frontend Usage:**

```javascript
// Before calling, approve the contract to spend input tokens
await tokenIn.approve(simpleSwapAddress, amountIn);

// Swap tokenA for tokenB
const tx = await simpleSwap.swapExactTokensForTokens(
  ethers.parseEther("100"), // 100 tokenA
  ethers.parseEther("190"), // min 190 tokenB (5% slippage)
  [tokenAAddress, tokenBAddress], // swap path
  userAddress,
  Math.floor(Date.now() / 1000) + 300
);
```

#### `getAmountOut()`

Calculates the amount of output tokens for a given input amount (read-only).

**Function Signature:**

```solidity
function getAmountOut(uint256 amountIn, address tokenIn, address tokenOut)
    external view returns (uint256 amountOut)
```

**Parameters:**

- `amountIn`: Amount of input tokens
- `tokenIn`: Address of the input token
- `tokenOut`: Address of the output token

**Returns:**

- `amountOut`: Amount of output tokens that would be received

**Frontend Usage:**

```javascript
// Get quote for swap (no transaction needed)
const amountOut = await simpleSwap.getAmountOut(
  ethers.parseEther("100"), // 100 tokenA
  tokenAAddress,
  tokenBAddress
);
console.log(`100 tokenA = ${ethers.formatEther(amountOut)} tokenB`);
```

#### `getReserves()`

Returns the current reserves of both tokens in the pool (read-only).

**Function Signature:**

```solidity
function getReserves() external view returns (uint256 reserveA, uint256 reserveB)
```

**Returns:**

- `reserveA`: Reserve amount of tokenA
- `reserveB`: Reserve amount of tokenB

**Frontend Usage:**

```javascript
// Get current pool reserves
const [reserveA, reserveB] = await simpleSwap.getReserves();
console.log(
  `Pool: ${ethers.formatEther(reserveA)} tokenA, ${ethers.formatEther(
    reserveB
  )} tokenB`
);
```

### Contract State Variables (Read-Only)

#### `tokenA` and `tokenB`

The two tokens supported by this DEX.

```javascript
const tokenAAddress = await simpleSwap.tokenA();
const tokenBAddress = await simpleSwap.tokenB();
```

#### `totalSupply()`

Total supply of LP tokens (inherited from ERC20).

```javascript
const totalLPTokens = await simpleSwap.totalSupply();
```

#### `balanceOf(address)`

LP token balance of a specific address (inherited from ERC20).

```javascript
const userLPBalance = await simpleSwap.balanceOf(userAddress);
```

### Events

#### `LiquidityAdded`

```solidity
event LiquidityAdded(address indexed to, uint256 amountA, uint256 amountB, uint256 liquidity);
```

#### `LiquidityRemoved`

```solidity
event LiquidityRemoved(address indexed to, uint256 amountA, uint256 amountB, uint256 liquidity);
```

#### `Swap`

```solidity
event Swap(address indexed sender, uint256 amountIn, uint256 amountOut, address indexed tokenIn, address indexed tokenOut, address indexed to);
```

### Custom Errors

The contract uses custom errors for gas efficiency:

- `ZeroAddress()`: When a zero address is provided
- `ZeroAmount()`: When a zero amount is provided
- `Expired()`: When the deadline has passed
- `InsufficientLiquidity()`: When there's not enough liquidity
- `InsufficientAmount()`: When received amount is below minimum
- `InvalidToken()`: When an unsupported token is provided
- `InvalidPath()`: When the swap path is invalid
- `SlippageExceeded()`: When slippage tolerance is exceeded

### Frontend Integration Tips

1. **Always check allowances** before calling functions that transfer tokens
2. **Use appropriate slippage tolerance** (typically 0.5-5%)
3. **Set reasonable deadlines** (5-30 minutes from current time)
4. **Listen for events** to update UI state
5. **Handle custom errors** for better user experience
6. **Use `getAmountOut()`** to show swap previews
7. **Monitor `getReserves()`** for pool state

### Security Features

- ✅ Reentrancy protection via OpenZeppelin's ReentrancyGuard
- ✅ Custom errors for gas efficiency and clarity
- ✅ Comprehensive input validation
- ✅ Slippage protection on all operations
- ✅ Deadline protection against MEV attacks
- ✅ Optimized state updates in single transactions
