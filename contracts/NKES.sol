// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NKES - Kenyan Shilling Stablecoin
 * @notice 1 NKES = 1 KES (pegged to Kenyan Shilling)
 * @dev ERC20 token with mint/burn controlled by owner (GUAP backend)
 */
contract NKES is ERC20, Ownable {
    // Minter role - can mint tokens (for deposits)
    mapping(address => bool) public minters;
    
    // Events
    event MinterAdded(address indexed account);
    event MinterRemoved(address indexed account);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);

    constructor() ERC20("Kenyan Shilling Stablecoin", "NKES") Ownable(msg.sender) {
        // Owner is automatically a minter
        minters[msg.sender] = true;
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "NKES: caller is not a minter");
        _;
    }

    /**
     * @notice Add a new minter
     * @param account Address to grant minting rights
     */
    function addMinter(address account) external onlyOwner {
        minters[account] = true;
        emit MinterAdded(account);
    }

    /**
     * @notice Remove a minter
     * @param account Address to revoke minting rights
     */
    function removeMinter(address account) external onlyOwner {
        minters[account] = false;
        emit MinterRemoved(account);
    }

    /**
     * @notice Mint NKES tokens (called when user deposits KES via Pretium)
     * @param to Recipient address (user's nTZS wallet)
     * @param amount Amount to mint (in KES, no decimals adjustment needed)
     */
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
        emit Mint(to, amount);
    }

    /**
     * @notice Burn NKES tokens (called when user withdraws to M-Pesa)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external onlyMinter {
        _burn(from, amount);
        emit Burn(from, amount);
    }

    /**
     * @notice Returns the number of decimals (2 for KES cents)
     */
    function decimals() public pure override returns (uint8) {
        return 2;
    }
}
