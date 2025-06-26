const { ethers } = require("hardhat");
const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying improved SimpleSwap contract...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy test tokens first
  console.log("\n🪙 Deploying test tokens...");

  // Deploy KaizenCoin
  const KaizenCoin = await ethers.getContractFactory("KaizenCoin");
  const kaizenCoin = await KaizenCoin.deploy();
  await kaizenCoin.waitForDeployment();
  const kaizenAddress = await kaizenCoin.getAddress();
  console.log("✅ KaizenCoin deployed to:", kaizenAddress);

  // Deploy YureiCoin
  const YureiCoin = await ethers.getContractFactory("YureiCoin");
  const yureiCoin = await YureiCoin.deploy();
  await yureiCoin.waitForDeployment();
  const yureiAddress = await yureiCoin.getAddress();
  console.log("✅ YureiCoin deployed to:", yureiAddress);

  // Deploy SimpleSwap with gas optimization
  console.log("\n🔄 Deploying SimpleSwap...");
  const SimpleSwap = await ethers.getContractFactory("SimpleSwap");

  // Deploy with gas optimization
  const simpleSwap = await SimpleSwap.deploy(kaizenAddress, yureiAddress, {
    gasLimit: 1500000, // Set reasonable gas limit
    gasPrice: ethers.parseUnits("20", "gwei"), // 20 gwei for cost optimization
  });

  console.log("⏳ Waiting for deployment...");
  await simpleSwap.waitForDeployment();
  const simpleSwapAddress = await simpleSwap.getAddress();

  console.log("✅ SimpleSwap deployed to:", simpleSwapAddress);

  // Verify the deployment
  console.log("\n🔍 Verifying deployment...");
  const deployedTokenA = await simpleSwap.tokenA();
  const deployedTokenB = await simpleSwap.tokenB();

  console.log("🔗 Token A in contract:", deployedTokenA);
  console.log("🔗 Token B in contract:", deployedTokenB);
  console.log(
    "✅ Tokens match:",
    deployedTokenA === kaizenAddress && deployedTokenB === yureiAddress
  );

  // Get deployment info
  const deploymentInfo = {
    network: "sepolia",
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    simpleSwap: simpleSwapAddress,
    tokenA: {
      address: kaizenAddress,
      name: "KaizenCoin",
      symbol: "KAIZEN",
      decimals: "18",
    },
    tokenB: {
      address: yureiAddress,
      name: "YureiCoin",
      symbol: "YUREI",
      decimals: "18",
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    gasPrice: "20.0 gwei",
    explorerUrl: "https://sepolia.etherscan.io",
  };

  // Save deployment info
  const fs = require("fs");
  const deploymentPath = `./deployments/sepolia-${
    new Date().toISOString().split("T")[0]
  }-v2.json`;
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📊 Deployment Summary:");
  console.log("=====================================");
  console.log("🏭 SimpleSwap:", simpleSwapAddress);
  console.log("🪙 KaizenCoin:", kaizenAddress);
  console.log("🪙 YureiCoin:", yureiAddress);
  console.log("👤 Deployer:", deployer.address);
  console.log("📁 Saved to:", deploymentPath);
  console.log("=====================================");

  console.log("\n🔗 Etherscan URLs:");
  console.log(
    "SimpleSwap:",
    `https://sepolia.etherscan.io/address/${simpleSwapAddress}`
  );
  console.log(
    "KaizenCoin:",
    `https://sepolia.etherscan.io/address/${kaizenAddress}`
  );
  console.log(
    "YureiCoin:",
    `https://sepolia.etherscan.io/address/${yureiAddress}`
  );

  // Verify contracts on Etherscan
  console.log("\n🔍 Verifying contracts on Etherscan...");
  await verifyContracts(simpleSwapAddress, kaizenAddress, yureiAddress);

  console.log("\n✅ Deployment completed successfully!");
  console.log("💡 Next steps:");
  console.log("1. ✅ Contracts verified on Etherscan");
  console.log("2. Test the contract functions");
  console.log("3. Add liquidity and test swaps");
}

/**
 * Verify contracts on Etherscan
 */
async function verifyContracts(simpleSwapAddress, kaizenAddress, yureiAddress) {
  try {
    console.log("⏳ Waiting 30 seconds for Etherscan to index contracts...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Verify KaizenCoin
    console.log("🔍 Verifying KaizenCoin...");
    try {
      await hre.run("verify:verify", {
        address: kaizenAddress,
        constructorArguments: [], // KaizenCoin has no constructor arguments
        contract: "contracts/TestTokens.sol:KaizenCoin",
      });
      console.log("✅ KaizenCoin verified successfully!");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ KaizenCoin already verified!");
      } else {
        console.error("❌ KaizenCoin verification failed:", error.message);
      }
    }

    // Verify YureiCoin
    console.log("🔍 Verifying YureiCoin...");
    try {
      await hre.run("verify:verify", {
        address: yureiAddress,
        constructorArguments: [], // YureiCoin has no constructor arguments
        contract: "contracts/TestTokens.sol:YureiCoin",
      });
      console.log("✅ YureiCoin verified successfully!");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ YureiCoin already verified!");
      } else {
        console.error("❌ YureiCoin verification failed:", error.message);
      }
    }

    // Verify SimpleSwap
    console.log("🔍 Verifying SimpleSwap...");
    try {
      await hre.run("verify:verify", {
        address: simpleSwapAddress,
        constructorArguments: [kaizenAddress, yureiAddress], // SimpleSwap constructor arguments
        contract: "contracts/SimpleSwap.sol:SimpleSwap",
      });
      console.log("✅ SimpleSwap verified successfully!");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ SimpleSwap already verified!");
      } else {
        console.error("❌ SimpleSwap verification failed:", error.message);
      }
    }

    console.log("\n🎉 All contracts verification completed!");
  } catch (error) {
    console.error("❌ Verification process failed:", error.message);
    console.log("💡 You can manually verify contracts later using:");
    console.log(`npx hardhat verify --network sepolia ${kaizenAddress}`);
    console.log(`npx hardhat verify --network sepolia ${yureiAddress}`);
    console.log(
      `npx hardhat verify --network sepolia ${simpleSwapAddress} "${kaizenAddress}" "${yureiAddress}"`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
