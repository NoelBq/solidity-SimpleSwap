# SimpleSwap DEX

A simple Uniswap-like decentralized exchange (DEX) smart contract that allows you to swap between **KaizenCoin (KAIZEN)** and **YureiCoin (YUREI)**.

## Features

- **Add Liquidity**: Provide KAIZEN/YUREI liquidity to earn fees
- **Remove Liquidity**: Withdraw your liquidity and earned fees  
- **Swap Tokens**: Exchange KAIZEN ↔ YUREI with 0.3% fees
- **Get Prices**: Real-time price quotes between tokens

## Quick Start

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

## Available Commands

- `bun run compile` - Compile contracts
- `bun run deploy` - Deploy to current network
- `bun run deploy-with-tokens` - Deploy with test tokens
- `bun run deploy-sepolia` - Deploy to Sepolia testnet
- `bun run deploy-localhost` - Deploy to local network
- `bun run node` - Start local Hardhat node

## Example Usage

```solidity
// Add liquidity: 1000 KAIZEN + 2000 YUREI
dex.addLiquidity(
    kaizenAddress,
    yureiAddress, 
    1000 * 10**18,  // 1000 KAIZEN
    2000 * 10**18,  // 2000 YUREI
    950 * 10**18,   // min KAIZEN
    1900 * 10**18,  // min YUREI
    msg.sender,
    block.timestamp + 300
);

// Swap: 100 KAIZEN → YUREI
address[] memory path = [kaizenAddress, yureiAddress];
dex.swapExactTokensForTokens(
    100 * 10**18,   // 100 KAIZEN in
    0,              // accept any YUREI out
    path,
    msg.sender,
    block.timestamp + 300
);
```

## Token Details

- **KaizenCoin (KAIZEN)**: 1,000,000 initial supply
- **YureiCoin (YUREI)**: 100,000 initial supply

## Security

- ✅ Reentrancy protection
- ✅ Slippage protection  
- ✅ Deadline protection
- ✅ Input validation
