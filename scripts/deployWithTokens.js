const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Network configurations
const NETWORK_CONFIG = {
  sepolia: {
    confirmations: 6,
    gasPrice: ethers.parseUnits("20", "gwei"),
    explorerUrl: "https://sepolia.etherscan.io",
    verify: true,
  },
  mainnet: {
    confirmations: 6,
    gasPrice: ethers.parseUnits("30", "gwei"),
    explorerUrl: "https://etherscan.io",
    verify: true,
  },
  localhost: {
    confirmations: 1,
    gasPrice: ethers.parseUnits("20", "gwei"),
    explorerUrl: null,
    verify: false,
  },
  hardhat: {
    confirmations: 1,
    gasPrice: ethers.parseUnits("20", "gwei"),
    explorerUrl: null,
    verify: false,
  },
};

async function main() {
  console.log("🚀 Starting SimpleSwap and Test Tokens deployment...");
  console.log("==========================================");

  const currentNetwork = network.name;
  const config = NETWORK_CONFIG[currentNetwork] || NETWORK_CONFIG.localhost;

  console.log(`🌐 Network: ${currentNetwork.toUpperCase()}`);
  console.log(`⚙️  Confirmations required: ${config.confirmations}`);
  console.log(
    `⛽ Gas Price: ${ethers.formatUnits(config.gasPrice, "gwei")} gwei`
  );
  if (config.explorerUrl) {
    console.log(`🔍 Explorer: ${config.explorerUrl}`);
  }

  const [deployer] = await ethers.getSigners();
  console.log("\n📍 Deploying contracts with account:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  // Check if we have enough balance for deployment (especially on testnets)
  const minBalance = ethers.parseEther("0.01"); // 0.01 ETH minimum
  if (balance < minBalance) {
    console.log(
      "⚠️  WARNING: Low balance detected. You may need more ETH for deployment."
    );
  }

  // Deploy SimpleSwap
  console.log("\n📦 Deploying SimpleSwap...");
  const SimpleSwap = await ethers.getContractFactory("SimpleSwap");

  const deploymentOptions = {
    gasPrice: config.gasPrice,
  };

  const simpleSwap = await SimpleSwap.deploy(deploymentOptions);
  console.log("⏳ Transaction sent, waiting for confirmation...");
  await simpleSwap.waitForDeployment();

  const simpleSwapAddress = await simpleSwap.getAddress();
  console.log("✅ SimpleSwap deployed to:", simpleSwapAddress);

  if (config.explorerUrl) {
    console.log(
      `🔗 View on explorer: ${config.explorerUrl}/address/${simpleSwapAddress}`
    );
  }

  // Deploy KaizenCoin
  console.log("\n🪙 Deploying KaizenCoin...");
  const KaizenCoin = await ethers.getContractFactory("KaizenCoin");
  const tokenA = await KaizenCoin.deploy(deploymentOptions);
  console.log("⏳ Transaction sent, waiting for confirmation...");
  await tokenA.waitForDeployment();

  const tokenAAddress = await tokenA.getAddress();
  console.log("✅ TokenA (KAIZEN) deployed to:", tokenAAddress);

  if (config.explorerUrl) {
    console.log(
      `🔗 View on explorer: ${config.explorerUrl}/address/${tokenAAddress}`
    );
  }

  // Deploy YureiCoin
  console.log("\n🪙 Deploying YureiCoin...");
  const YureiCoin = await ethers.getContractFactory("YureiCoin");
  const tokenB = await YureiCoin.deploy(deploymentOptions);
  console.log("⏳ Transaction sent, waiting for confirmation...");
  await tokenB.waitForDeployment();

  const tokenBAddress = await tokenB.getAddress();
  console.log("✅ TokenB (YUREI) deployed to:", tokenBAddress);

  if (config.explorerUrl) {
    console.log(
      `🔗 View on explorer: ${config.explorerUrl}/address/${tokenBAddress}`
    );
  }

  // Get token details
  console.log("\n📊 Token Details:");
  console.log("==================");

  const tokenAName = await tokenA.name();
  const tokenASymbol = await tokenA.symbol();
  const tokenASupply = await tokenA.totalSupply();
  const tokenADecimals = await tokenA.decimals();

  const tokenBName = await tokenB.name();
  const tokenBSymbol = await tokenB.symbol();
  const tokenBSupply = await tokenB.totalSupply();
  const tokenBDecimals = await tokenB.decimals();

  console.log(`🔵 TokenA: ${tokenAName} (${tokenASymbol})`);
  console.log(`   📍 Address: ${tokenAAddress}`);
  console.log(`   🔢 Decimals: ${tokenADecimals}`);
  console.log(
    `   💰 Supply: ${ethers.formatEther(tokenASupply)} ${tokenASymbol}`
  );

  console.log(`🟢 TokenB: ${tokenBName} (${tokenBSymbol})`);
  console.log(`   📍 Address: ${tokenBAddress}`);
  console.log(`   🔢 Decimals: ${tokenBDecimals}`);
  console.log(
    `   💰 Supply: ${ethers.formatEther(tokenBSupply)} ${tokenBSymbol}`
  );

  // Distribute tokens to deployer for testing
  console.log("\n💸 Distributing tokens for testing...");
  const deployerBalance = await deployer.provider.getBalance(deployer.address);
  console.log(
    `📈 Deployer ${tokenASymbol} balance:`,
    ethers.formatEther(await tokenA.balanceOf(deployer.address))
  );
  console.log(
    `📈 Deployer ${tokenBSymbol} balance:`,
    ethers.formatEther(await tokenB.balanceOf(deployer.address))
  );

  // Display deployment summary
  console.log("\n🎉 DEPLOYMENT SUMMARY");
  console.log("=====================");
  console.log("📦 SimpleSwap:", simpleSwapAddress);
  console.log(`🔵 ${tokenASymbol} (${tokenAName}):`, tokenAAddress);
  console.log(`🟢 ${tokenBSymbol} (${tokenBName}):`, tokenBAddress);
  console.log("✨ All contracts deployed successfully!");

  // Display interaction examples
  console.log("\n🛠️  INTERACTION EXAMPLES");
  console.log("========================");
  console.log("// Add initial liquidity:");
  console.log(
    `// 1. Approve tokens: tokenA.approve("${simpleSwapAddress}", amount)`
  );
  console.log(
    `// 2. Add liquidity: simpleSwap.addLiquidity("${tokenAAddress}", "${tokenBAddress}", ...)`
  );
  console.log("\n// Swap tokens:");
  console.log(
    `// 1. Approve input token: tokenA.approve("${simpleSwapAddress}", amount)`
  );
  console.log(
    `// 2. Swap: simpleSwap.swapExactTokensForTokens(amount, 0, ["${tokenAAddress}", "${tokenBAddress}"], to, deadline)`
  );
  console.log("\n// Get price:");
  console.log(`// simpleSwap.getPrice("${tokenAAddress}", "${tokenBAddress}")`);

  // Optional: Verify contracts if on a testnet/mainnet
  if (
    config.verify &&
    currentNetwork !== "hardhat" &&
    currentNetwork !== "localhost"
  ) {
    console.log(
      `\n⏳ Waiting for ${config.confirmations} block confirmations before verification...`
    );

    try {
      await simpleSwap.deploymentTransaction().wait(config.confirmations);
      await tokenA.deploymentTransaction().wait(config.confirmations);
      await tokenB.deploymentTransaction().wait(config.confirmations);

      console.log("🔍 Verifying contracts on Etherscan...");

      // Verify SimpleSwap
      try {
        await hre.run("verify:verify", {
          address: simpleSwapAddress,
          constructorArguments: [],
          contract: "contracts/SimpleSwap.sol:SimpleSwap",
        });
        console.log("✅ SimpleSwap verified successfully!");
      } catch (error) {
        console.log("❌ Error verifying SimpleSwap:", error.message);
      }

      // Verify KaizenCoin
      try {
        await hre.run("verify:verify", {
          address: tokenAAddress,
          constructorArguments: [],
          contract: "contracts/TestTokens.sol:KaizenCoin",
        });
        console.log("✅ KaizenCoin verified successfully!");
      } catch (error) {
        console.log("❌ Error verifying KaizenCoin:", error.message);
      }

      // Verify YureiCoin
      try {
        await hre.run("verify:verify", {
          address: tokenBAddress,
          constructorArguments: [],
          contract: "contracts/TestTokens.sol:YureiCoin",
        });
        console.log("✅ YureiCoin verified successfully!");
      } catch (error) {
        console.log("❌ Error verifying YureiCoin:", error.message);
      }
    } catch (error) {
      console.log("❌ Error during verification process:", error.message);
    }
  } else {
    console.log(`\n💡 Skipping verification (network: ${currentNetwork})`);
  }

  // Save deployment addresses to a file for easy access
  const deploymentInfo = {
    network: currentNetwork,
    chainId: network.config.chainId
      ? network.config.chainId.toString()
      : "unknown",
    simpleSwap: simpleSwapAddress,
    tokenA: {
      address: tokenAAddress,
      name: tokenAName,
      symbol: tokenASymbol,
      decimals: tokenADecimals.toString(),
    },
    tokenB: {
      address: tokenBAddress,
      name: tokenBName,
      symbol: tokenBSymbol,
      decimals: tokenBDecimals.toString(),
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    gasPrice: ethers.formatUnits(config.gasPrice, "gwei") + " gwei",
    explorerUrl: config.explorerUrl,
  };

  // Save to file
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `${currentNetwork}-${
    new Date().toISOString().split("T")[0]
  }.json`;
  const filepath = path.join(deploymentsDir, filename);

  try {
    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n💾 Deployment info saved to: ${filepath}`);
  } catch (error) {
    console.log("❌ Error saving deployment info:", error.message);
  }

  console.log("\n📄 Deployment Info JSON:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Network-specific post-deployment instructions
  if (currentNetwork === "sepolia") {
    console.log("\n🎯 SEPOLIA TESTNET DEPLOYMENT COMPLETE!");
    console.log("=============================================");
    console.log("💡 Next steps:");
    console.log("1. Get Sepolia ETH from faucets if needed");
    console.log("2. Interact with contracts using the addresses above");
    console.log("3. Check transactions on Sepolia Etherscan");
    console.log("4. Test the DEX functionality with the mock tokens");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
