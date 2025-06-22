const { ethers } = require("hardhat");

async function main() {
  console.log("Starting SimpleSwap deployment...");

  // Get the contract factories
  const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
  const MockToken = await ethers.getContractFactory("MockToken");

  // Deploy SimpleSwap
  console.log("Deploying SimpleSwap...");
  const simpleSwap = await SimpleSwap.deploy();
  await simpleSwap.waitForDeployment();
  console.log("SimpleSwap deployed to:", await simpleSwap.getAddress());

  // Deploy test tokens
  console.log("Deploying MockTokens for testing...");

  const tokenA = await MockToken.deploy("KaizenCoin", "KAIZEN", 1000000); // 1M tokens
  await tokenA.waitForDeployment();
  console.log("KaizenCoin deployed to:", await tokenA.getAddress());

  const tokenB = await MockToken.deploy("YureiCoin", "YUREI", 100000); // 100K tokens
  await tokenB.waitForDeployment();
  console.log("YureiCoin deployed to:", await tokenB.getAddress());

  // Display deployment summary
  console.log("\n=== Deployment Summary ===");
  console.log("SimpleSwap address:", await simpleSwap.getAddress());
  console.log("KaizenCoin address:", await tokenA.getAddress());
  console.log("YureiCoin address:", await tokenB.getAddress());
  console.log("Deployment completed successfully!");

  // Optional: Verify contracts if on a testnet/mainnet
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await simpleSwap.deploymentTransaction().wait(6);
    await tokenA.deploymentTransaction().wait(6);
    await tokenB.deploymentTransaction().wait(6);

    console.log("Verifying contracts...");
    try {
      await hre.run("verify:verify", {
        address: await simpleSwap.getAddress(),
        constructorArguments: [],
      });

      await hre.run("verify:verify", {
        address: await tokenA.getAddress(),
        constructorArguments: ["Token A", "TKNA", 1000000],
      });

      await hre.run("verify:verify", {
        address: await tokenB.getAddress(),
        constructorArguments: ["Token B", "TKNB", 1000000],
      });

      console.log("Contracts verified successfully!");
    } catch (error) {
      console.log("Error verifying contracts:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
