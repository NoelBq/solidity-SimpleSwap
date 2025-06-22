const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleSwap", function () {
  let simpleSwap;
  let tokenA; // KaizenCoin
  let tokenB; // YureiCoin
  let owner;
  let user1;
  let user2;

  const DEADLINE = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy contracts
    const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
    simpleSwap = await SimpleSwap.deploy();

    // Deploy specific test tokens
    const KaizenCoin = await ethers.getContractFactory("KaizenCoin");
    const YureiCoin = await ethers.getContractFactory("YureiCoin");
    tokenA = await KaizenCoin.deploy(); // KaizenCoin - 1M supply
    tokenB = await YureiCoin.deploy(); // YureiCoin - 100K supply

    // Transfer tokens to users for testing
    await tokenA.transfer(user1.address, ethers.parseEther("50000")); // 50K KAIZEN
    await tokenB.transfer(user1.address, ethers.parseEther("25")); // 25 YUREI
    await tokenA.transfer(user2.address, ethers.parseEther("50000")); // 50K KAIZEN
    await tokenB.transfer(user2.address, ethers.parseEther("25")); // 25 YUREI
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await simpleSwap.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await tokenA.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await tokenB.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should set correct fee parameters", async function () {
      expect(await simpleSwap.SWAP_FEE()).to.equal(3);
      expect(await simpleSwap.FEE_DENOMINATOR()).to.equal(1000);
    });
  });

  describe("Add Liquidity", function () {
    it("Should add initial liquidity", async function () {
      // Using realistic amounts: 10K KAIZEN and 5 YUREI (2000:1 ratio)
      const amountA = ethers.parseEther("10000"); // 10K KAIZEN
      const amountB = ethers.parseEther("5"); // 5 YUREI

      // Approve tokens
      await tokenA.connect(user1).approve(simpleSwap.getAddress(), amountA);
      await tokenB.connect(user1).approve(simpleSwap.getAddress(), amountB);

      // Add liquidity
      const tx = await simpleSwap
        .connect(user1)
        .addLiquidity(
          tokenA.getAddress(),
          tokenB.getAddress(),
          amountA,
          amountB,
          amountA,
          amountB,
          user1.address,
          DEADLINE
        );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      // Check pool info
      const [reserveA, reserveB, totalSupply] = await simpleSwap.getPoolInfo(
        tokenA.getAddress(),
        tokenB.getAddress()
      );

      expect(reserveA).to.equal(amountA);
      expect(reserveB).to.equal(amountB);
      expect(totalSupply).to.be.gt(0);
    });

    it("Should revert with expired deadline", async function () {
      const amountA = ethers.parseEther("10000"); // 10K KAIZEN
      const amountB = ethers.parseEther("5"); // 5 YUREI
      const expiredDeadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      await tokenA.connect(user1).approve(simpleSwap.getAddress(), amountA);
      await tokenB.connect(user1).approve(simpleSwap.getAddress(), amountB);

      await expect(
        simpleSwap
          .connect(user1)
          .addLiquidity(
            tokenA.getAddress(),
            tokenB.getAddress(),
            amountA,
            amountB,
            amountA,
            amountB,
            user1.address,
            expiredDeadline
          )
      ).to.be.revertedWith("SimpleSwap: EXPIRED");
    });

    it("Should revert with identical tokens", async function () {
      const amount = ethers.parseEther("1000");

      await expect(
        simpleSwap.connect(user1).addLiquidity(
          tokenA.getAddress(),
          tokenA.getAddress(), // Same token
          amount,
          amount,
          amount,
          amount,
          user1.address,
          DEADLINE
        )
      ).to.be.revertedWith("SimpleSwap: IDENTICAL_ADDRESSES");
    });

    it("Should show correct token information", async function () {
      expect(await tokenA.name()).to.equal("KaizenCoin");
      expect(await tokenA.symbol()).to.equal("KAIZEN");
      expect(await tokenB.name()).to.equal("YureiCoin");
      expect(await tokenB.symbol()).to.equal("YUREI");
    });
  });

  describe("Remove Liquidity", function () {
    beforeEach(async function () {
      // Add initial liquidity with realistic amounts
      const amountA = ethers.parseEther("10000"); // 10K KAIZEN
      const amountB = ethers.parseEther("5"); // 5 YUREI

      await tokenA.connect(user1).approve(simpleSwap.getAddress(), amountA);
      await tokenB.connect(user1).approve(simpleSwap.getAddress(), amountB);

      await simpleSwap
        .connect(user1)
        .addLiquidity(
          tokenA.getAddress(),
          tokenB.getAddress(),
          amountA,
          amountB,
          amountA,
          amountB,
          user1.address,
          DEADLINE
        );
    });

    it("Should remove liquidity", async function () {
      const liquidity = await simpleSwap.getLiquidityBalance(
        user1.address,
        tokenA.getAddress(),
        tokenB.getAddress()
      );

      const tx = await simpleSwap.connect(user1).removeLiquidity(
        tokenA.getAddress(),
        tokenB.getAddress(),
        liquidity / 2n, // Remove half
        0,
        0,
        user1.address,
        DEADLINE
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("Should revert when removing more liquidity than available", async function () {
      const liquidity = await simpleSwap.getLiquidityBalance(
        user1.address,
        tokenA.getAddress(),
        tokenB.getAddress()
      );

      await expect(
        simpleSwap.connect(user1).removeLiquidity(
          tokenA.getAddress(),
          tokenB.getAddress(),
          liquidity + 1n, // More than available
          0,
          0,
          user1.address,
          DEADLINE
        )
      ).to.be.revertedWith("SimpleSwap: INSUFFICIENT_LIQUIDITY_BALANCE");
    });
  });

  describe("Swap Tokens", function () {
    beforeEach(async function () {
      // Add initial liquidity: 10K KAIZEN : 5 YUREI (2000:1 ratio)
      const amountA = ethers.parseEther("10000"); // 10K KAIZEN
      const amountB = ethers.parseEther("5"); // 5 YUREI

      await tokenA.connect(user1).approve(simpleSwap.getAddress(), amountA);
      await tokenB.connect(user1).approve(simpleSwap.getAddress(), amountB);

      await simpleSwap
        .connect(user1)
        .addLiquidity(
          tokenA.getAddress(),
          tokenB.getAddress(),
          amountA,
          amountB,
          amountA,
          amountB,
          user1.address,
          DEADLINE
        );
    });

    it("Should swap tokens", async function () {
      const amountIn = ethers.parseEther("100");
      const path = [tokenA.getAddress(), tokenB.getAddress()];

      await tokenA.connect(user2).approve(simpleSwap.getAddress(), amountIn);

      const balanceBefore = await tokenB.balanceOf(user2.address);

      const tx = await simpleSwap.connect(user2).swapExactTokensForTokens(
        amountIn,
        0, // Accept any amount of YUREI
        path,
        user2.address,
        DEADLINE
      );

      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);

      const balanceAfter = await tokenB.balanceOf(user2.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should revert with insufficient output amount", async function () {
      const amountIn = ethers.parseEther("100");
      const path = [tokenA.getAddress(), tokenB.getAddress()];

      await tokenA.connect(user2).approve(simpleSwap.getAddress(), amountIn);

      // Calculate expected output
      const [reserveA, reserveB] = await simpleSwap.getPoolInfo(
        tokenA.getAddress(),
        tokenB.getAddress()
      );
      const amountOut = await simpleSwap.getAmountOut(
        amountIn,
        reserveA,
        reserveB
      );

      await expect(
        simpleSwap.connect(user2).swapExactTokensForTokens(
          amountIn,
          amountOut + 1n, // Expect more than possible
          path,
          user2.address,
          DEADLINE
        )
      ).to.be.revertedWith("SimpleSwap: INSUFFICIENT_OUTPUT_AMOUNT");
    });
  });

  describe("Price and Amount Calculations", function () {
    beforeEach(async function () {
      // Add initial liquidity - use amounts that users actually have
      const amountA = ethers.parseEther("1000"); // 1K KAIZEN (user has 50K)
      const amountB = ethers.parseEther("20"); // 20 YUREI (user has 25)

      await tokenA.connect(user1).approve(simpleSwap.getAddress(), amountA);
      await tokenB.connect(user1).approve(simpleSwap.getAddress(), amountB);

      await simpleSwap
        .connect(user1)
        .addLiquidity(
          tokenA.getAddress(),
          tokenB.getAddress(),
          amountA,
          amountB,
          amountA,
          amountB,
          user1.address,
          DEADLINE
        );
    });

    it("Should calculate correct price", async function () {
      const price = await simpleSwap.getPrice(
        tokenA.getAddress(),
        tokenB.getAddress()
      );

      // Expected price: 20/1000 * 10^18 = 0.02 * 10^18
      expect(price).to.equal(ethers.parseEther("0.02"));
    });

    it("Should calculate correct amount out", async function () {
      const amountIn = ethers.parseEther("100");
      const [reserveA, reserveB] = await simpleSwap.getPoolInfo(
        tokenA.getAddress(),
        tokenB.getAddress()
      );

      const amountOut = await simpleSwap.getAmountOut(
        amountIn,
        reserveA,
        reserveB
      );
      expect(amountOut).to.be.gt(0);
    });

    it("Should revert getPrice for non-existent pool", async function () {
      const MockToken = await ethers.getContractFactory("MockToken");
      const tokenC = await MockToken.deploy("Token C", "TKNC", 1000000);

      await expect(
        simpleSwap.getPrice(tokenA.getAddress(), tokenC.getAddress())
      ).to.be.revertedWith("SimpleSwap: NO_LIQUIDITY");
    });
  });
});
