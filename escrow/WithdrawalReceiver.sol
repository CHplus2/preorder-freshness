// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
// Local test harness only; not part of the supported deployed escrow bytecode.
interface EscrowForReceiver {
    function dispatch(bytes32 id) external;
    function withdraw() external;
}
contract WithdrawalReceiver {
    EscrowForReceiver immutable escrow;
    uint256 public mode;
    uint256 public receipts;
    constructor(address target) { escrow = EscrowForReceiver(target); }
    function setMode(uint256 value) external { mode = value; }
    function dispatch(bytes32 id) external { escrow.dispatch(id); }
    function withdraw() external { escrow.withdraw(); }
    receive() external payable {
        require(mode != 1, "Receiver rejected funds");
        receipts++;
        if (mode == 2) {
            (bool ok,) = address(escrow).call(abi.encodeWithSignature("withdraw()"));
            require(!ok, "Reentrant withdrawal succeeded");
        }
    }
}
