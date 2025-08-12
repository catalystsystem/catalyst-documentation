---
title: "Input Settlement"
slug: "architecture/input"
description: "Built with resource locks in mind, LI.FI intents support a variety of input settlement schemes. The Compact and Rhinestone both allow for first-fill flows and sponsored transactions, assuming the user has existing deposits."
sidebar:
  order: 1
---

Two Single Chain Input Settlers are supported:
- [**InputSettlerEscrow**](https://github.com/openintentsframework/oif-contracts/blob/main/src/input/escrow/InputSettlerEscrow.sol)
- [**InputSettlerCompact**](https://github.com/openintentsframework/oif-contracts/blob/main/src/input/compact/InputSettlerCompact.sol)

[Work is in progress](https://github.com/openintentsframework/oif-contracts/pull/49) to support multi chain inpurts settlers.

The Compact uses resource locks and supports fill-first flows. For traditional flows without resource locks, the escrow settler can be used. Escrow flows are not safe in fill-first flows and have to be opened before fills.

#### Default Output
The default output for settlement schemes is [`MandateOutput`](https://github.com/openintentsframework/oif-contracts/blob/main/src/input/types/MandateOutputType.sol#L4-L18):
```solidity
struct MandateOutput {
    bytes32 oracle;
    bytes32 settler;
    uint256 chainId;
    bytes32 token;
    uint256 amount;
    bytes32 recipient;
    bytes call;
    bytes context;
}
```
To verify if the encoded output description has been validated, send the hashed encoded payload to the appropriate local oracle along with relevant resolution details, such as the solver's identity.

## Single Chain Inputs

Single Chain Input Settlers uses [`StandardOrder`](https://github.com/openintentsframework/oif-contracts/blob/main/src/input/types/StandardOrderType.sol#L6-L15):
```solidity
struct StandardOrder {
    address user;
    uint256 nonce;
    uint256 originChainId;
    uint32 expires;
    uint32 fillDeadline;
    address inputOracle;
    uint256[2][] inputs;
    MandateOutput[] outputs;
}
```

To finalise orders to get paid their inputs, the relevant finalise functions have to be called. 2 endpoints are available:
1. `finalise`: To be called by the solver, the caller can designate where to send assets and whether to make an external call. Note that the Escrow & Compact interfaces are different to optimise for gas.
2. `finaliseWithSignature`: Can be called by anyone with an [`AllowOpen`](https://github.com/openintentsframework/oif-contracts/blob/main/src/input/types/AllowOpenType.sol#L5-L9l) signature from the solver, containing the destination and call details.

### Compact Intent Registration

Intents are transferred as `StandardOrder`, within the Compact they are signed as a `BatchClaim` with the following structure:

```solidity
struct BatchCompact {
    address arbiter;
    address sponsor;
    uint256 nonce;
    uint256 expires;
    uint256[2][] idsAndAmounts;
    Mandate mandate;
}
// With the Mandate defined as:
struct Mandate {
    uint32 fillDeadline;
    address inputOracle;
    MandateOutput[] outputs;
}
```

Intents are EIP712-signed `BatchClaim`s using The Compact's domain separator.

Alternatively, intents can be registered on-chain. There are two ways to do this: either the sponsor (user) registers it, or someone pays for the entire claim and registers it on their behalf.

### Escrow Compact Registration 

Intents are transferred as `StandardOrder` but can be registered in several ways:
1. Registered by their owner through ERC-7683 `function open(bytes)`. This emits a ERC-7683 `event Open(bytes32 indexed orderId, bytes order)` and also sets its `function orderStatus(bytes)` to 1.
2. Registered through ERC-3009 with the orderId as the nonce.. For each input a signature has to be provided and then `0x01, abi.encode(bytes[])`.
3. Registered through Permit2 with the signature provided as `0x00, bytes` from the EIP-712 signed object `PermitBatchWitnessTransferFrom`:

    ```solidity
    struct PermitBatchWitnessTransferFrom {
        TokenPermissions[] permitted;
        address spender;
        uint256 nonce;
        uint256 deadline;
        Permit2Witness witness;
    }
    // With TokenPermissions as
    TokenPermissions(
        address token;
        uint256 amount;
    )
    // With Permit2Witness as
    Permit2Witness(
        uint32 expires;
        address inputOracle;
        MandateOutput[] outputs;
    )
    ```

#### Integration Examples

- For a smart contract example of registering intents on behalf of someone else, see [`RegisterIntentLib.sol`](https://github.com/catalystsystem/catalyst-intent/blob/27ce0972c150ed113f66ae91069eb953f23d920b/src/libs/RegisterIntentLib.sol#L100-L131).
- For a UI example of signing the Batch Compact, refer to the [lintent.org demo](https://github.com/catalystsystem/lintent/blob/a4aa78cd058cade732b73d83aa2843dd4e9ea24d/src/lib/utils/lifiintent/tx.ts#L144).
- For a UI example of depositing and registering the intent, see the [lintent.org demo](https://github.com/catalystsystem/lintent/blob/a4aa78cd058cade732b73d83aa2843dd4e9ea24d/src/lib/utils/lifiintent/tx.ts#L199).