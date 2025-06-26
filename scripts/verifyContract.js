const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🔍 Starting contract verification...");

  // Load the latest deployment info
  const deploymentInfo = JSON.parse(
    fs.readFileSync("./deployments/sepolia-2025-06-26-v2.json", "utf8")
  );

  const { simpleSwap, tokenA, tokenB } = deploymentInfo;

  console.log("📊 Contract addresses:");
  console.log("🏭 SimpleSwap:", simpleSwap);
  console.log("🪙 TokenA (KaizenCoin):", tokenA.address);
  console.log("🪙 TokenB (YureiCoin):", tokenB.address);

  await verifyContracts(simpleSwap, tokenA.address, tokenB.address);
}

/**
 * Verify contracts on Etherscan
 */
async function verifyContracts(simpleSwapAddress, kaizenAddress, yureiAddress) {
  try {
    console.log("\n⏳ Waiting 30 seconds for Etherscan to index contracts...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Verify KaizenCoin
    console.log("\n🔍 Verifying KaizenCoin...");
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
    console.log("\n🔍 Verifying YureiCoin...");
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
    console.log("\n🔍 Verifying SimpleSwap...");
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
  } catch (error) {
    console.error("❌ Verification process failed:", error.message);
    console.log("\n💡 Manual verification commands:");
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
    console.error("❌ Verification failed:");
    console.error(error);
    process.exit(1);
  });
