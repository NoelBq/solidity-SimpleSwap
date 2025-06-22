// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SimpleSwap
 * @dev Smart contract that replicates Uniswap functionality
 * Allows adding/removing liquidity, swapping tokens and getting prices
 */
contract SimpleSwap is ReentrancyGuard {
    using Math for uint256;

    // Structure to store pool information
    struct Pool {
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 totalSupply; // Total liquidity tokens issued
        mapping(address => uint256) liquidityBalances; // Liquidity balance per user
    }

    // Pool mapping: hash(tokenA, tokenB) => Pool
    mapping(bytes32 => Pool) public pools;
    
    // Fee for swaps (0.3% = 3/1000)
    uint256 public constant SWAP_FEE = 3;
    uint256 public constant FEE_DENOMINATOR = 1000;

    // Events
    event LiquidityAdded(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    event LiquidityRemoved(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    event TokensSwapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    // Modifiers
    modifier validDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, "SimpleSwap: EXPIRED");
        _;
    }

    modifier validTokens(address tokenA, address tokenB) {
        require(tokenA != tokenB, "SimpleSwap: IDENTICAL_ADDRESSES");
        require(tokenA != address(0) && tokenB != address(0), "SimpleSwap: ZERO_ADDRESS");
        _;
    }

    /**
     * @dev Generates a unique hash for a token pair
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return Unique hash of the pair
     */
    function _getPoolKey(address tokenA, address tokenB) internal pure returns (bytes32) {
        if (tokenA > tokenB) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }
        return keccak256(abi.encodePacked(tokenA, tokenB));
    }

    /**
     * @dev Sorts tokens to maintain consistency
     * @param tokenA First token
     * @param tokenB Second token
     * @return token0 Token with lower address
     * @return token1 Token with higher address
     */
    function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "SimpleSwap: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "SimpleSwap: ZERO_ADDRESS");
    }

    /**
     * @dev Initializes a new pool if it doesn't exist
     * @param tokenA First token of the pair
     * @param tokenB Second token of the pair
     */
    function _initializePool(address tokenA, address tokenB) internal {
        bytes32 poolKey = _getPoolKey(tokenA, tokenB);
        Pool storage pool = pools[poolKey];
        
        if (pool.tokenA == address(0)) {
            (address token0, address token1) = _sortTokens(tokenA, tokenB);
            pool.tokenA = token0;
            pool.tokenB = token1;
        }
    }

    /**
     * @dev Calculates optimal token amounts to add liquidity
     * @param amountADesired Desired amount of token A
     * @param amountBDesired Desired amount of token B
     * @param amountAMin Minimum acceptable amount of token A
     * @param amountBMin Minimum acceptable amount of token B
     * @param reserveA Current reserve of token A
     * @param reserveB Current reserve of token B
     * @return amountA Final amount of token A
     * @return amountB Final amount of token B
     */
    function _calculateOptimalAmounts(
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 reserveA,
        uint256 reserveB
    ) internal pure returns (uint256 amountA, uint256 amountB) {
        if (reserveA == 0 && reserveB == 0) {
            // First liquidity deposit
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            // Calculate optimal amounts based on current ratio
            uint256 amountBOptimal = (amountADesired * reserveB) / reserveA;
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "SimpleSwap: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = (amountBDesired * reserveA) / reserveB;
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, "SimpleSwap: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    /**
     * @dev 1️⃣ Add Liquidity
     * Allows users to add liquidity to a token pool
     * @param tokenA Address of token A
     * @param tokenB Address of token B
     * @param amountADesired Desired amount of token A
     * @param amountBDesired Desired amount of token B
     * @param amountAMin Minimum acceptable amount of token A
     * @param amountBMin Minimum acceptable amount of token B
     * @param to Address that will receive the liquidity tokens
     * @param deadline Timestamp limit for the transaction
     * @return amountA Effective amount of token A added
     * @return amountB Effective amount of token B added
     * @return liquidity Amount of liquidity tokens issued
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        nonReentrant
        validDeadline(deadline)
        validTokens(tokenA, tokenB)
        returns (uint256 amountA, uint256 amountB, uint256 liquidity)
    {
        require(to != address(0), "SimpleSwap: ZERO_ADDRESS");
        
        // Initialize pool if it doesn't exist
        _initializePool(tokenA, tokenB);
        
        bytes32 poolKey = _getPoolKey(tokenA, tokenB);
        Pool storage pool = pools[poolKey];
        
        // Get correct token order
        (address token0,) = _sortTokens(tokenA, tokenB);
        bool isTokenAFirst = tokenA == token0;
        
        uint256 reserve0 = isTokenAFirst ? pool.reserveA : pool.reserveB;
        uint256 reserve1 = isTokenAFirst ? pool.reserveB : pool.reserveA;
        
        // Calculate optimal amounts
        (amountA, amountB) = _calculateOptimalAmounts(
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            reserve0,
            reserve1
        );
        
        // Transfer tokens from user to contract
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);
        
        // Calculate liquidity to mint
        if (pool.totalSupply == 0) {
            // First time adding liquidity
            liquidity = Math.sqrt(amountA * amountB);
            require(liquidity > 0, "SimpleSwap: INSUFFICIENT_LIQUIDITY_MINTED");
        } else {
            // Liquidity proportional to existing
            liquidity = Math.min(
                (amountA * pool.totalSupply) / reserve0,
                (amountB * pool.totalSupply) / reserve1
            );
        }
        
        require(liquidity > 0, "SimpleSwap: INSUFFICIENT_LIQUIDITY_MINTED");
        
        // Update reserves and balances
        if (isTokenAFirst) {
            pool.reserveA += amountA;
            pool.reserveB += amountB;
        } else {
            pool.reserveA += amountB;
            pool.reserveB += amountA;
        }
        
        pool.totalSupply += liquidity;
        pool.liquidityBalances[to] += liquidity;
        
        emit LiquidityAdded(to, tokenA, tokenB, amountA, amountB, liquidity);
    }

    /**
     * @dev 2️⃣ Remove Liquidity
     * Allows users to withdraw liquidity from a pool
     * @param tokenA Address of token A
     * @param tokenB Address of token B
     * @param liquidity Amount of liquidity tokens to burn
     * @param amountAMin Minimum acceptable amount of token A
     * @param amountBMin Minimum acceptable amount of token B
     * @param to Address that will receive the tokens
     * @param deadline Timestamp limit for the transaction
     * @return amountA Amount of token A received
     * @return amountB Amount of token B received
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        nonReentrant
        validDeadline(deadline)
        validTokens(tokenA, tokenB)
        returns (uint256 amountA, uint256 amountB)
    {
        require(to != address(0), "SimpleSwap: ZERO_ADDRESS");
        require(liquidity > 0, "SimpleSwap: INSUFFICIENT_LIQUIDITY");
        
        bytes32 poolKey = _getPoolKey(tokenA, tokenB);
        Pool storage pool = pools[poolKey];
        
        require(pool.totalSupply > 0, "SimpleSwap: NO_LIQUIDITY");
        require(pool.liquidityBalances[msg.sender] >= liquidity, "SimpleSwap: INSUFFICIENT_LIQUIDITY_BALANCE");
        
        // Get correct token order
        (address token0,) = _sortTokens(tokenA, tokenB);
        bool isTokenAFirst = tokenA == token0;
        
        uint256 reserve0 = isTokenAFirst ? pool.reserveA : pool.reserveB;
        uint256 reserve1 = isTokenAFirst ? pool.reserveB : pool.reserveA;
        
        // Calculate amounts to return proportionally
        uint256 amount0 = (liquidity * reserve0) / pool.totalSupply;
        uint256 amount1 = (liquidity * reserve1) / pool.totalSupply;
        
        amountA = isTokenAFirst ? amount0 : amount1;
        amountB = isTokenAFirst ? amount1 : amount0;
        
        require(amountA >= amountAMin, "SimpleSwap: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "SimpleSwap: INSUFFICIENT_B_AMOUNT");
        
        // Update balances
        pool.liquidityBalances[msg.sender] -= liquidity;
        pool.totalSupply -= liquidity;
        
        // Update reserves
        if (isTokenAFirst) {
            pool.reserveA -= amountA;
            pool.reserveB -= amountB;
        } else {
            pool.reserveA -= amountB;
            pool.reserveB -= amountA;
        }
        
        // Transfer tokens to user
        IERC20(tokenA).transfer(to, amountA);
        IERC20(tokenB).transfer(to, amountB);
        
        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }

    /**
     * @dev 3️⃣ Swap Tokens
     * Swaps an exact amount of input tokens for output tokens
     * @param amountIn Exact amount of input tokens
     * @param amountOutMin Minimum acceptable amount of output tokens
     * @param path Array with token addresses [tokenIn, tokenOut]
     * @param to Address that will receive the output tokens
     * @param deadline Timestamp limit for the transaction
     * @return amounts Array with amounts [amountIn, amountOut]
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    )
        external
        nonReentrant
        validDeadline(deadline)
        returns (uint256[] memory amounts)
    {
        require(path.length == 2, "SimpleSwap: INVALID_PATH");
        require(amountIn > 0, "SimpleSwap: INSUFFICIENT_INPUT_AMOUNT");
        require(to != address(0), "SimpleSwap: ZERO_ADDRESS");
        require(path[0] != path[1], "SimpleSwap: IDENTICAL_ADDRESSES");
        
        bytes32 poolKey = _getPoolKey(path[0], path[1]);
        Pool storage pool = pools[poolKey];
        require(pool.totalSupply > 0, "SimpleSwap: INSUFFICIENT_LIQUIDITY");
        
        // Calculate and execute swap
        amounts = _executeSwap(pool, path[0], path[1], amountIn, amountOutMin, to);
        
        emit TokensSwapped(msg.sender, path[0], path[1], amounts[0], amounts[1]);
    }

    /**
     * @dev Internal function to execute the swap logic
     * @param pool The pool storage reference
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param amountOutMin Minimum output amount
     * @param to Recipient address
     * @return amounts Array with [amountIn, amountOut]
     */
    function _executeSwap(
        Pool storage pool,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address to
    ) internal returns (uint256[] memory amounts) {
        // Get reserves
        (address token0,) = _sortTokens(tokenIn, tokenOut);
        bool isToken0 = tokenIn == token0;
        
        uint256 reserveIn = isToken0 ? pool.reserveA : pool.reserveB;
        uint256 reserveOut = isToken0 ? pool.reserveB : pool.reserveA;
        
        // Calculate output amount
        uint256 amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "SimpleSwap: INSUFFICIENT_OUTPUT_AMOUNT");
        
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
        
        // Transfer input tokens from user to contract
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        
        // Update reserves
        if (isToken0) {
            pool.reserveA += amountIn;
            pool.reserveB -= amountOut;
        } else {
            pool.reserveA -= amountOut;
            pool.reserveB += amountIn;
        }
        
        // Transfer output tokens to user
        IERC20(tokenOut).transfer(to, amountOut);
    }

    /**
     * @dev 4️⃣ Get Price
     * Calculates the price of one token in terms of another
     * @param tokenA Address of the token whose price is wanted
     * @param tokenB Address of the reference token
     * @return price Price of tokenA in terms of tokenB (with 18 decimals)
     */
    function getPrice(address tokenA, address tokenB) 
        external 
        view 
        validTokens(tokenA, tokenB)
        returns (uint256 price) 
    {
        bytes32 poolKey = _getPoolKey(tokenA, tokenB);
        Pool storage pool = pools[poolKey];
        
        require(pool.totalSupply > 0, "SimpleSwap: NO_LIQUIDITY");
        
        // Get reserves
        (address token0,) = _sortTokens(tokenA, tokenB);
        uint256 reserveA;
        uint256 reserveB;
        
        if (tokenA == token0) {
            reserveA = pool.reserveA;
            reserveB = pool.reserveB;
        } else {
            reserveA = pool.reserveB;
            reserveB = pool.reserveA;
        }
        
        require(reserveA > 0 && reserveB > 0, "SimpleSwap: INSUFFICIENT_LIQUIDITY");
        
        // Price = reserveB / reserveA * 10^18 to maintain precision
        price = (reserveB * 1e18) / reserveA;
    }

    /**
     * @dev 5️⃣ Calculate Output Amount
     * Calculates the amount of tokens that will be received in a swap
     * Applies a 0.3% fee similar to Uniswap
     * @param amountIn Amount of input tokens
     * @param reserveIn Reserve of input token
     * @param reserveOut Reserve of output token
     * @return amountOut Amount of tokens that will be received
     */
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public
        pure
        returns (uint256 amountOut)
    {
        require(amountIn > 0, "SimpleSwap: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "SimpleSwap: INSUFFICIENT_LIQUIDITY");
        
        // Apply 0.3% fee (997/1000)
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - SWAP_FEE);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        
        amountOut = numerator / denominator;
    }

    /**
     * @dev Gets pool information
     * @param tokenA First token of the pair
     * @param tokenB Second token of the pair
     * @return reserveA Reserve of token A
     * @return reserveB Reserve of token B
     * @return totalSupply Total liquidity tokens issued
     */
    function getPoolInfo(address tokenA, address tokenB)
        external
        view
        validTokens(tokenA, tokenB)
        returns (uint256 reserveA, uint256 reserveB, uint256 totalSupply)
    {
        bytes32 poolKey = _getPoolKey(tokenA, tokenB);
        Pool storage pool = pools[poolKey];
        
        (address token0,) = _sortTokens(tokenA, tokenB);
        
        if (tokenA == token0) {
            reserveA = pool.reserveA;
            reserveB = pool.reserveB;
        } else {
            reserveA = pool.reserveB;
            reserveB = pool.reserveA;
        }
        
        totalSupply = pool.totalSupply;
    }

    /**
     * @dev Gets user's liquidity balance
     * @param user User address
     * @param tokenA First token of the pair
     * @param tokenB Second token of the pair
     * @return balance User's liquidity token balance
     */
    function getLiquidityBalance(address user, address tokenA, address tokenB)
        external
        view
        validTokens(tokenA, tokenB)
        returns (uint256 balance)
    {
        bytes32 poolKey = _getPoolKey(tokenA, tokenB);
        Pool storage pool = pools[poolKey];
        balance = pool.liquidityBalances[user];
    }
}
