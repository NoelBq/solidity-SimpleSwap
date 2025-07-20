// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SimpleSwap
 * @dev A simple liquidity pool contract for swapping between two specific tokens
 * @notice This contract allows users to add/remove liquidity and swap between two tokens
 */
/**
 * @title SimpleSwap
 * @dev A simple liquidity pool contract for swapping between two specific tokens
 * @notice This contract allows users to add/remove liquidity and swap between two tokens
 */
contract SimpleSwap is ReentrancyGuard {
    using Math for uint256;

    /// @notice The first token in the pair
    /// @dev Immutable address of tokenA
    address public immutable tokenA;

    /// @notice The second token in the pair
    /// @dev Immutable address of tokenB
    address public immutable tokenB;

    /// @notice Reserve amount of tokenA in the pool
    /// @dev Internal accounting for tokenA reserves
    uint256 public reserveA;

    /// @notice Reserve amount of tokenB in the pool
    /// @dev Internal accounting for tokenB reserves
    uint256 public reserveB;

    /// @notice Total liquidity tokens issued
    /// @dev Internal accounting for total supply of LP tokens
    uint256 public totalSupply;

    /// @notice Mapping of user addresses to their liquidity token balances
    /// @dev Internal accounting for user LP token balances
    mapping(address => uint256) public liquidityBalances;

    // ------------------------------------------------------------------------
    // Custom Errors
    // ------------------------------------------------------------------------
    error Expired();
    error IdenticalAddresses();
    error ZeroAddress();
    error InsufficientInputAmount();
    error InsufficientLiquidity();
    error InsufficientOutputAmount();
    error InsufficientLiquidityMinted();
    error InsufficientAmountA();
    error InsufficientAmountB();
    error InsufficientLiquidityBalance();
    error NoLiquidity();
    error InvalidPath();


    /**
     * @notice Emitted when liquidity is added to the pool
     * @param user Address that added liquidity
     * @param amountA Amount of tokenA added
     * @param amountB Amount of tokenB added
     * @param liquidity Amount of liquidity tokens minted
     */
    event LiquidityAdded(
        address indexed user,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    /**
     * @notice Emitted when liquidity is removed from the pool
     * @param user Address that removed liquidity
     * @param amountA Amount of tokenA removed
     * @param amountB Amount of tokenB removed
     * @param liquidity Amount of liquidity tokens burned
     */
    event LiquidityRemoved(
        address indexed user,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    /**
     * @notice Emitted when tokens are swapped
     * @param user Address that performed the swap
     * @param tokenIn Address of input token
     * @param tokenOut Address of output token
     * @param amountIn Amount of input tokens
     * @param amountOut Amount of output tokens
     */
    event TokensSwapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    /**
     * @notice Modifier to check transaction deadline
     * @param deadline Timestamp deadline for the transaction
     */
    modifier validDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert Expired();
        _;
    }

    /**
     * @notice Constructor to initialize the token pair
     * @param _tokenA Address of the first token
     * @param _tokenB Address of the second token
     */
    constructor(address _tokenA, address _tokenB) {
        if (_tokenA == _tokenB) revert IdenticalAddresses();
        if (_tokenA == address(0) || _tokenB == address(0)) revert ZeroAddress();
        
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    /**
     * @notice Calculates optimal token amounts for adding liquidity
     * @param amountADesired Desired amount of tokenA
     * @param amountBDesired Desired amount of tokenB
     * @param amountAMin Minimum acceptable amount of tokenA
     * @param amountBMin Minimum acceptable amount of tokenB
     * @return amountA Final amount of tokenA to add
     * @return amountB Final amount of tokenB to add
     */
    /**
     * @dev Calculates optimal token amounts for adding liquidity
     * @param amountADesired Desired amount of tokenA
     * @param amountBDesired Desired amount of tokenB
     * @param amountAMin Minimum acceptable amount of tokenA
     * @param amountBMin Minimum acceptable amount of tokenB
     * @return amountA Final amount of tokenA to add
     * @return amountB Final amount of tokenB to add
     */
    function _calculateOptimalAmounts(
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal view returns (uint256 amountA, uint256 amountB) {
        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        if (_reserveA == 0 && _reserveB == 0) {
            // First liquidity deposit
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            // Calculate optimal amounts based on current ratio
            uint256 amountBOptimal = (amountADesired * _reserveB) / _reserveA;
            if (amountBOptimal <= amountBDesired) {
                if (amountBOptimal < amountBMin) revert InsufficientAmountB();
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = (amountBDesired * _reserveA) / _reserveB;
                assert(amountAOptimal <= amountADesired);
                if (amountAOptimal < amountAMin) revert InsufficientAmountA();
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    /**
     * @notice Add liquidity to the pool
     * @param amountADesired Desired amount of tokenA
     * @param amountBDesired Desired amount of tokenB
     * @param amountAMin Minimum acceptable amount of tokenA
     * @param amountBMin Minimum acceptable amount of tokenB
     * @param to Address that will receive the liquidity tokens
     * @param deadline Timestamp limit for the transaction
     * @return amountA Effective amount of tokenA added
     * @return amountB Effective amount of tokenB added
     * @return liquidity Amount of liquidity tokens issued
     */
    /**
     * @notice Add liquidity to the pool
     * @dev Transfers tokens from user and mints LP tokens
     * @param amountADesired Desired amount of tokenA
     * @param amountBDesired Desired amount of tokenB
     * @param amountAMin Minimum acceptable amount of tokenA
     * @param amountBMin Minimum acceptable amount of tokenB
     * @param to Address that will receive the liquidity tokens
     * @param deadline Timestamp limit for the transaction
     * @return amountA Effective amount of tokenA added
     * @return amountB Effective amount of tokenB added
     * @return liquidity Amount of liquidity tokens issued
     */
    function addLiquidity(
        address, // tokenA - ignored, uses immutable tokenA
        address, // tokenB - ignored, uses immutable tokenB  
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
        returns (uint256 amountA, uint256 amountB, uint256 liquidity)
    {
        if (to == address(0)) revert ZeroAddress();
        
        // Cache state variables
        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        uint256 _totalSupply = totalSupply;

        // Calculate optimal amounts
        (amountA, amountB) = _calculateOptimalAmounts(
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin
        );

        // Transfer tokens from user to contract
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

        // Calculate liquidity to mint
        if (_totalSupply == 0) {
            // First time adding liquidity
            liquidity = Math.sqrt(amountA * amountB);
            if (liquidity == 0) revert InsufficientLiquidityMinted();
        } else {
            // Liquidity proporcional a la existente
            liquidity = Math.min(
                (amountA * _totalSupply) / _reserveA,
                (amountB * _totalSupply) / _reserveB
            );
        }

        if (liquidity == 0) revert InsufficientLiquidityMinted();

        // Update all state variables in a single block to minimize gas costs
        unchecked {
            reserveA = _reserveA + amountA;
            reserveB = _reserveB + amountB;
            totalSupply = _totalSupply + liquidity;
            liquidityBalances[to] += liquidity;
        }

        emit LiquidityAdded(to, amountA, amountB, liquidity);
    }

    /**
     * @notice Remove liquidity from the pool
     * @param liquidity Amount of liquidity tokens to burn
     * @param amountAMin Minimum acceptable amount of tokenA
     * @param amountBMin Minimum acceptable amount of tokenB
     * @param to Address that will receive the tokens
     * @param deadline Timestamp limit for the transaction
     * @return amountA Amount of tokenA received
     * @return amountB Amount of tokenB received
     */
    /**
     * @notice Remove liquidity from the pool
     * @dev Burns LP tokens and transfers underlying tokens to user
     * @param liquidity Amount of liquidity tokens to burn
     * @param amountAMin Minimum acceptable amount of tokenA
     * @param amountBMin Minimum acceptable amount of tokenB
     * @param to Address that will receive the tokens
     * @param deadline Timestamp limit for the transaction
     * @return amountA Amount of tokenA received
     * @return amountB Amount of tokenB received
     */
    function removeLiquidity(
        address, // tokenA - ignored, uses immutable tokenA
        address, // tokenB - ignored, uses immutable tokenB
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        nonReentrant
        validDeadline(deadline)
        returns (uint256 amountA, uint256 amountB)
    {
        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        uint256 _totalSupply = totalSupply;
        uint256 _liquidityBalance = liquidityBalances[msg.sender];

        if (to == address(0)) revert ZeroAddress();
        if (liquidity == 0) revert InsufficientLiquidity();
        if (_totalSupply == 0) revert NoLiquidity();
        if (_liquidityBalance < liquidity) revert InsufficientLiquidityBalance();

        // Calculate amounts to return proportionally
        amountA = (liquidity * _reserveA) / _totalSupply;
        amountB = (liquidity * _reserveB) / _totalSupply;

        if (amountA < amountAMin) revert InsufficientAmountA();
        if (amountB < amountBMin) revert InsufficientAmountB();

        // Update all state variables in a single block to minimize gas costs
        unchecked {
            liquidityBalances[msg.sender] = _liquidityBalance - liquidity;
            totalSupply = _totalSupply - liquidity;
            reserveA = _reserveA - amountA;
            reserveB = _reserveB - amountB;
        }

        // Transfer tokens to user
        IERC20(tokenA).transfer(to, amountA);
        IERC20(tokenB).transfer(to, amountB);

        emit LiquidityRemoved(msg.sender, amountA, amountB, liquidity);
    }

    /**
     * @notice Swap exact amount of input tokens for output tokens
     * @param amountIn Exact amount of input tokens
     * @param amountOutMin Minimum acceptable amount of output tokens
     * @param path Array with token addresses [tokenIn, tokenOut]
     * @param to Address that will receive the output tokens
     * @param deadline Timestamp limit for the transaction
     * @return amounts Array with amounts [amountIn, amountOut]
     */
    /**
     * @notice Swap exact amount of input tokens for output tokens
     * @dev Transfers input tokens from user and sends output tokens
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
        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        uint256 _totalSupply = totalSupply;
        address _tokenA = tokenA;
        address _tokenB = tokenB;

        if (path.length != 2) revert InvalidPath();
        if (amountIn == 0) revert InsufficientInputAmount();
        if (to == address(0)) revert ZeroAddress();
        if (path[0] == path[1]) revert IdenticalAddresses();
        if (_totalSupply == 0) revert InsufficientLiquidity();

        // Validate path tokens match our pair
        if (!((path[0] == _tokenA && path[1] == _tokenB) || (path[0] == _tokenB && path[1] == _tokenA))) {
            revert InvalidPath();
        }

        // Determine input/output reserves
        bool isTokenAInput = path[0] == _tokenA;
        uint256 reserveIn = isTokenAInput ? _reserveA : _reserveB;
        uint256 reserveOut = isTokenAInput ? _reserveB : _reserveA;

        // Calculate output amount
        uint256 amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        if (amountOut < amountOutMin) revert InsufficientOutputAmount();

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;

        // Transfer input tokens from user to contract
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);

        // Update reserves in a single block to minimize gas costs
        unchecked {
            if (isTokenAInput) {
                reserveA = _reserveA + amountIn;
                reserveB = _reserveB - amountOut;
            } else {
                reserveB = _reserveB + amountIn;
                reserveA = _reserveA - amountOut;
            }
        }

        // Transfer output tokens to user
        IERC20(path[1]).transfer(to, amountOut);

        emit TokensSwapped(msg.sender, path[0], path[1], amountIn, amountOut);
    }

    /**
     * @notice Get the price of tokenA in terms of tokenB
     * @return price Price of tokenA in terms of tokenB (with 18 decimals)
     */
    /**
     * @notice Get the price of tokenA in terms of tokenB
     * @dev Returns price with 18 decimals
     * @param tokenA_ Address of tokenA (ignored, for interface compatibility)
     * @param tokenB_ Address of tokenB (ignored, for interface compatibility)
     * @return price Price of tokenA in terms of tokenB (with 18 decimals)
     */
    /**
     * @notice Get the price of tokenA in terms of tokenB
     * @dev Returns price with 18 decimals
     * @return price Price of tokenA in terms of tokenB (with 18 decimals)
     */
    function getPrice(address /*tokenA_*/, address /*tokenB_*/) external view returns (uint256 price) {
        uint256 _reserveA = reserveA;
        uint256 _reserveB = reserveB;
        uint256 _totalSupply = totalSupply;
        if (_totalSupply == 0) revert NoLiquidity();
        if (_reserveA == 0 || _reserveB == 0) revert InsufficientLiquidity();
        // Price = reserveB / reserveA * 10^18 to maintain precision
        price = (_reserveB * 1e18) / _reserveA;
    }

    /**
     * @notice Calculate the amount of tokens that will be received in a swap
     * @dev Simple constant product formula without fees: x * y = k
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
        if (amountIn == 0) revert InsufficientInputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        
        // Simple constant product formula: (x + dx) * (y - dy) = x * y
        // Solving for dy: dy = (y * dx) / (x + dx)
        amountOut = (reserveOut * amountIn) / (reserveIn + amountIn);
    }

    /**
     * @notice Get pool reserves and total supply
     * @dev Returns reserves and total supply for analytics/UI
     * @return _reserveA Reserve of tokenA
     * @return _reserveB Reserve of tokenB
     * @return _totalSupply Total liquidity tokens issued
     */
    function getPoolInfo()
        external
        view
        returns (uint256 _reserveA, uint256 _reserveB, uint256 _totalSupply)
    {
        _reserveA = reserveA;
        _reserveB = reserveB;
        _totalSupply = totalSupply;
    }

    /**
     * @notice Get user's liquidity balance
     * @dev Returns the LP token balance of a user
     * @param user User address
     * @return balance User's liquidity token balance
     */
    function getLiquidityBalance(address user)
        external
        view
        returns (uint256 balance)
    {
        balance = liquidityBalances[user];
    }
}
