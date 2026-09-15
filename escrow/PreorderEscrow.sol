// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Classroom prototype. Sepolia and local test chains ONLY; not audited.
/// No customer details or real order identifiers should be recorded on-chain.
contract PreorderEscrow {
    enum State { Missing, Funded, Dispatched, Disputed, Released, Refunded }
    struct Deal {
        address buyer;
        address seller;
        address arbiter;
        uint256 amount;
        uint256 dispatchBy;
        uint256 resolveBy;
        State state;
    }
    mapping(bytes32 => Deal) public deals;
    mapping(address => uint256) public credits;
    bool private withdrawing;
    event Changed(bytes32 indexed id, State state);

    constructor() {
        require(block.chainid == 11155111 || block.chainid == 31337, "Test networks only");
    }

    function fund(bytes32 id, address seller, address arbiter, uint256 dispatchBy) external payable {
        require(deals[id].state == State.Missing && id != bytes32(0), "ID already used or empty");
        require(seller != address(0) && arbiter != address(0), "Missing participant");
        require(seller != msg.sender && arbiter != msg.sender && arbiter != seller, "Distinct participants required");
        require(msg.value > 0 && msg.value <= 0.01 ether, "Demo limit: 0.01 test ETH");
        require(dispatchBy > block.timestamp && dispatchBy <= block.timestamp + 7 days, "Dispatch within 7 days");
        deals[id] = Deal(msg.sender, seller, arbiter, msg.value, dispatchBy, dispatchBy + 7 days, State.Funded);
        emit Changed(id, State.Funded);
    }

    function dispatch(bytes32 id) external {
        Deal storage d = deals[id];
        require(msg.sender == d.seller && d.state == State.Funded, "Seller / funded only");
        require(block.timestamp <= d.dispatchBy, "Dispatch deadline passed");
        d.state = State.Dispatched;
        emit Changed(id, d.state);
    }

    function confirmReceipt(bytes32 id) external {
        Deal storage d = deals[id];
        require(msg.sender == d.buyer && d.state == State.Dispatched, "Buyer / dispatched only");
        settle(id, false);
    }

    function refund(bytes32 id) external {
        Deal storage d = deals[id];
        require(d.state == State.Funded || d.state == State.Dispatched || d.state == State.Disputed, "Already closed");
        require(msg.sender == d.seller || (msg.sender == d.buyer &&
            ((d.state == State.Funded && block.timestamp > d.dispatchBy) || block.timestamp > d.resolveBy)), "Refund unavailable");
        settle(id, true);
    }

    function dispute(bytes32 id) external {
        Deal storage d = deals[id];
        require(msg.sender == d.buyer || msg.sender == d.seller, "Participant only");
        require(d.state == State.Dispatched && block.timestamp <= d.resolveBy, "Dispute unavailable");
        d.state = State.Disputed;
        emit Changed(id, d.state);
    }

    function resolve(bytes32 id, bool refundBuyer) external {
        Deal storage d = deals[id];
        require(msg.sender == d.arbiter && d.state == State.Disputed, "Arbiter / disputed only");
        require(block.timestamp <= d.resolveBy, "Resolution deadline passed");
        settle(id, refundBuyer);
    }

    function settle(bytes32 id, bool refundBuyer) private {
        Deal storage d = deals[id];
        d.state = refundBuyer ? State.Refunded : State.Released;
        credits[refundBuyer ? d.buyer : d.seller] += d.amount;
        emit Changed(id, d.state);
    }

    function withdraw() external {
        require(!withdrawing, "Reentrant withdrawal");
        uint256 amount = credits[msg.sender];
        require(amount > 0, "No credit");
        credits[msg.sender] = 0;
        withdrawing = true;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Withdrawal failed");
        withdrawing = false;
    }
}
