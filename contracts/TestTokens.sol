// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MockToken.sol";

/**
 * @title KaizenCoin
 * @dev Mock ERC20 token A for testing SimpleSwap
 * Represents KaizenCoin with 18 decimals
 */
contract KaizenCoin is MockToken {
    constructor() MockToken("KaizenCoin", "KAIZEN", 1000000) {
        // 1,000,000 KAIZEN initial supply
    }
}

/**
 * @title YureiCoin  
 * @dev Mock ERC20 token B for testing SimpleSwap
 * Represents YureiCoin with 18 decimals
 */
contract YureiCoin is MockToken {
    constructor() MockToken("YureiCoin", "YUREI", 100000) {
        // 100,000 YUREI initial supply (higher value per token)
    }
}
