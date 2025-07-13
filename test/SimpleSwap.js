const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleSwap", function () {
  let owner, user1, user2;
  let TokenA, TokenB, tokenA, tokenB;
  let SimpleSwap, simpleSwap;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    TokenA = await ethers.getContractFactory("MockToken");
    TokenB = await ethers.getContractFactory("MockToken");
    tokenA = await TokenA.deploy("TokenA", "TKA", 1000000); // 1M tokens initial supply
    tokenB = await TokenB.deploy("TokenB", "TKB", 1000000); // 1M tokens initial supply

    // Mint additional tokens to users
    await tokenA.mint(user1.address, ethers.parseEther("1000"));
    await tokenB.mint(user1.address, ethers.parseEther("1000"));
    await tokenA.mint(user2.address, ethers.parseEther("1000"));
    await tokenB.mint(user2.address, ethers.parseEther("1000"));

    // Deploy SimpleSwap
    SimpleSwap = await ethers.getContractFactory("SimpleSwap");
    simpleSwap = await SimpleSwap.deploy(tokenA.target, tokenB.target);
  });

  describe("Deployment", function () {
    it("should deploy with correct token addresses", async function () {
      expect(await simpleSwap.tokenA()).to.equal(tokenA.target);
      expect(await simpleSwap.tokenB()).to.equal(tokenB.target);
    });

    it("should revert if tokens are identical", async function () {
      await expect(
        SimpleSwap.deploy(tokenA.target, tokenA.target)
      ).to.be.revertedWithCustomError(simpleSwap, "IdenticalAddresses");
    });

    it("should revert if token address is zero", async function () {
      await expect(
        SimpleSwap.deploy(ethers.ZeroAddress, tokenB.target)
      ).to.be.revertedWithCustomError(simpleSwap, "ZeroAddress");
    });

    it("should initialize with zero reserves and total supply", async function () {
      expect(await simpleSwap.reserveA()).to.equal(0);
      expect(await simpleSwap.reserveB()).to.equal(0);
      expect(await simpleSwap.totalSupply()).to.equal(0);
    });
  });

  describe("Liquidity Management", function () {
    it("should allow adding initial liquidity", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await expect(
        simpleSwap.addLiquidity(
          tokenA.target,
          tokenB.target,
          amountA,
          amountB,
          amountA,
          amountB,
          owner.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.emit(simpleSwap, "LiquidityAdded");

      expect(await simpleSwap.reserveA()).to.equal(amountA);
      expect(await simpleSwap.reserveB()).to.equal(amountB);
      expect(await simpleSwap.totalSupply()).to.be.gt(0);
    });

    it("should calculate proportional amounts for subsequent liquidity", async function () {
      // Add initial liquidity
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        amountA,
        amountB,
        owner.address,
        Math.floor(Date.now() / 1000) + 1000
      );

      // Add more liquidity with user1
      const desiredA = ethers.parseEther("50");
      const desiredB = ethers.parseEther("150"); // Not proportional

      await tokenA.connect(user1).approve(simpleSwap.target, desiredA);
      await tokenB.connect(user1).approve(simpleSwap.target, desiredB);

      await expect(
        simpleSwap.connect(user1).addLiquidity(
          tokenA.target,
          tokenB.target,
          desiredA,
          desiredB,
          0, // minA
          0, // minB
          user1.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.emit(simpleSwap, "LiquidityAdded");
    });

    it("should allow removing liquidity", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        amountA,
        amountB,
        owner.address,
        Math.floor(Date.now() / 1000) + 1000
      );

      const liquidity = await simpleSwap.liquidityBalances(owner.address);

      await expect(
        simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          liquidity,
          0,
          0,
          owner.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.emit(simpleSwap, "LiquidityRemoved");
    });

    it("should revert when removing more liquidity than owned", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        amountA,
        amountB,
        owner.address,
        Math.floor(Date.now() / 1000) + 1000
      );

      const liquidity = await simpleSwap.liquidityBalances(owner.address);

      await expect(
        simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          liquidity + 1n,
          0,
          0,
          owner.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.be.revertedWithCustomError(
        simpleSwap,
        "InsufficientLiquidityBalance"
      );
    });
  });

  describe("Token Swapping", function () {
    beforeEach(async function () {
      // Add initial liquidity for swapping tests
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        amountA,
        amountB,
        owner.address,
        Math.floor(Date.now() / 1000) + 1000
      );
    });

    it("should allow swapping tokenA for tokenB", async function () {
      await tokenA
        .connect(user1)
        .approve(simpleSwap.target, ethers.parseEther("10"));

      await expect(
        simpleSwap
          .connect(user1)
          .swapExactTokensForTokens(
            ethers.parseEther("10"),
            1,
            [tokenA.target, tokenB.target],
            user1.address,
            Math.floor(Date.now() / 1000) + 1000
          )
      ).to.emit(simpleSwap, "TokensSwapped");
    });

    it("should allow swapping tokenB for tokenA", async function () {
      await tokenB
        .connect(user1)
        .approve(simpleSwap.target, ethers.parseEther("10"));

      await expect(
        simpleSwap
          .connect(user1)
          .swapExactTokensForTokens(
            ethers.parseEther("10"),
            1,
            [tokenB.target, tokenA.target],
            user1.address,
            Math.floor(Date.now() / 1000) + 1000
          )
      ).to.emit(simpleSwap, "TokensSwapped");
    });

    it("should revert with invalid path", async function () {
      await tokenA
        .connect(user1)
        .approve(simpleSwap.target, ethers.parseEther("10"));

      await expect(
        simpleSwap.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("10"),
          1,
          [tokenA.target], // Invalid path length
          user1.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.be.revertedWithCustomError(simpleSwap, "InvalidPath");
    });

    it("should revert with insufficient output amount", async function () {
      await tokenA
        .connect(user1)
        .approve(simpleSwap.target, ethers.parseEther("10"));

      await expect(
        simpleSwap.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("10"),
          ethers.parseEther("100"), // Too high minimum output
          [tokenA.target, tokenB.target],
          user1.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.be.revertedWithCustomError(simpleSwap, "InsufficientOutputAmount");
    });
  });

  describe("Price and Amount Calculations", function () {
    beforeEach(async function () {
      // Add initial liquidity
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        amountA,
        amountB,
        owner.address,
        Math.floor(Date.now() / 1000) + 1000
      );
    });

    it("should return correct price", async function () {
      const price = await simpleSwap.getPrice(tokenA.target, tokenB.target);
      expect(price).to.be.gt(0);
      // Price should be reserveB / reserveA = 200/100 = 2 (in 18 decimals)
      expect(price).to.equal(ethers.parseEther("2"));
    });

    it("should calculate correct amount out", async function () {
      const amountOut = await simpleSwap.getAmountOut(
        ethers.parseEther("10"),
        ethers.parseEther("100"), // reserveIn
        ethers.parseEther("200") // reserveOut
      );
      expect(amountOut).to.be.gt(0);
    });

    it("should revert getPrice when no liquidity", async function () {
      const newSwap = await SimpleSwap.deploy(tokenA.target, tokenB.target);
      await expect(
        newSwap.getPrice(tokenA.target, tokenB.target)
      ).to.be.revertedWithCustomError(newSwap, "NoLiquidity");
    });

    it("should revert getAmountOut with zero input", async function () {
      await expect(
        simpleSwap.getAmountOut(
          0,
          ethers.parseEther("100"),
          ethers.parseEther("200")
        )
      ).to.be.revertedWithCustomError(simpleSwap, "InsufficientInputAmount");
    });
  });

  describe("Pool Info and Balances", function () {
    it("should return correct pool info", async function () {
      const [reserveA, reserveB, totalSupply] = await simpleSwap.getPoolInfo();
      expect(reserveA).to.equal(0);
      expect(reserveB).to.equal(0);
      expect(totalSupply).to.equal(0);
    });

    it("should return correct liquidity balance", async function () {
      const balance = await simpleSwap.getLiquidityBalance(owner.address);
      expect(balance).to.equal(0);
    });
  });

  describe("Error Cases", function () {
    it("should revert with expired deadline", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await expect(
        simpleSwap.addLiquidity(
          tokenA.target,
          tokenB.target,
          amountA,
          amountB,
          amountA,
          amountB,
          owner.address,
          Math.floor(Date.now() / 1000) - 1000 // Expired deadline
        )
      ).to.be.revertedWithCustomError(simpleSwap, "Expired");
    });

    it("should revert when adding liquidity to zero address", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await expect(
        simpleSwap.addLiquidity(
          tokenA.target,
          tokenB.target,
          amountA,
          amountB,
          amountA,
          amountB,
          ethers.ZeroAddress, // Zero address
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.be.revertedWithCustomError(simpleSwap, "ZeroAddress");
    });

    it("should revert when removing liquidity with insufficient minimum amounts", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        amountA,
        amountB,
        owner.address,
        Math.floor(Date.now() / 1000) + 1000
      );

      const liquidity = await simpleSwap.liquidityBalances(owner.address);

      await expect(
        simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          liquidity,
          ethers.parseEther("200"), // Too high minimum for A
          0,
          owner.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.be.revertedWithCustomError(simpleSwap, "InsufficientAmountA");
    });

    it("should revert when removing zero liquidity", async function () {
      await expect(
        simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          0, // Zero liquidity
          0,
          0,
          owner.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.be.revertedWithCustomError(simpleSwap, "InsufficientLiquidity");
    });

    it("should revert when removing liquidity from empty pool", async function () {
      await expect(
        simpleSwap.removeLiquidity(
          tokenA.target,
          tokenB.target,
          1,
          0,
          0,
          owner.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.be.revertedWithCustomError(simpleSwap, "NoLiquidity");
    });

    it("should revert when swapping with zero amount", async function () {
      // Add some liquidity first
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        amountA,
        amountB,
        owner.address,
        Math.floor(Date.now() / 1000) + 1000
      );

      await expect(
        simpleSwap.connect(user1).swapExactTokensForTokens(
          0, // Zero amount
          1,
          [tokenA.target, tokenB.target],
          user1.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.be.revertedWithCustomError(simpleSwap, "InsufficientInputAmount");
    });

    it("should revert when swapping without liquidity", async function () {
      await tokenA
        .connect(user1)
        .approve(simpleSwap.target, ethers.parseEther("10"));

      await expect(
        simpleSwap
          .connect(user1)
          .swapExactTokensForTokens(
            ethers.parseEther("10"),
            1,
            [tokenA.target, tokenB.target],
            user1.address,
            Math.floor(Date.now() / 1000) + 1000
          )
      ).to.be.revertedWithCustomError(simpleSwap, "InsufficientLiquidity");
    });

    it("should revert when swapping identical tokens", async function () {
      await tokenA
        .connect(user1)
        .approve(simpleSwap.target, ethers.parseEther("10"));

      await expect(
        simpleSwap.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("10"),
          1,
          [tokenA.target, tokenA.target], // Identical tokens
          user1.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.be.revertedWithCustomError(simpleSwap, "IdenticalAddresses");
    });

    it("should revert when swapping to zero address", async function () {
      // Add some liquidity first
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        amountA,
        amountB,
        owner.address,
        Math.floor(Date.now() / 1000) + 1000
      );

      await tokenA
        .connect(user1)
        .approve(simpleSwap.target, ethers.parseEther("10"));

      await expect(
        simpleSwap.connect(user1).swapExactTokensForTokens(
          ethers.parseEther("10"),
          1,
          [tokenA.target, tokenB.target],
          ethers.ZeroAddress, // Zero address recipient
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.be.revertedWithCustomError(simpleSwap, "ZeroAddress");
    });
  });

  describe("Edge Cases for Coverage", function () {
    it("should handle the other branch of optimal amount calculation", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      // Add initial liquidity
      await tokenA.approve(simpleSwap.target, amountA);
      await tokenB.approve(simpleSwap.target, amountB);

      await simpleSwap.addLiquidity(
        tokenA.target,
        tokenB.target,
        amountA,
        amountB,
        amountA,
        amountB,
        owner.address,
        Math.floor(Date.now() / 1000) + 1000
      );

      // Add liquidity that will trigger the other branch
      const desiredA = ethers.parseEther("25"); // Small amount
      const desiredB = ethers.parseEther("200"); // Large amount

      await tokenA.connect(user1).approve(simpleSwap.target, desiredA);
      await tokenB.connect(user1).approve(simpleSwap.target, desiredB);

      await expect(
        simpleSwap.connect(user1).addLiquidity(
          tokenA.target,
          tokenB.target,
          desiredA,
          desiredB,
          0, // minA
          0, // minB
          user1.address,
          Math.floor(Date.now() / 1000) + 1000
        )
      ).to.emit(simpleSwap, "LiquidityAdded");
    });

    it("should test getAmountOut with insufficient reserves", async function () {
      await expect(
        simpleSwap.getAmountOut(
          ethers.parseEther("10"),
          0, // Zero reserve
          ethers.parseEther("100")
        )
      ).to.be.revertedWithCustomError(simpleSwap, "InsufficientLiquidity");
    });
  });
});
