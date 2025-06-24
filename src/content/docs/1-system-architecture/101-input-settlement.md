---
title: "Input Settlement"
slug: "architecture/input"
description: "Built with resource locks in mind, LI.FI intents supports a variety of input settlement schemes. TheCompact and Rhinestone both allow for first-fill flows and sponsored transactions, assuming the user has existing deposits."
sidebar:
  order: 1
---

Currently, one Input Settler is supported: 
- [**InputSettlerCompact**](https://github.com/openintentsframework/oif-contracts/blob/main/src/input/compact/InputSettlerCompact.sol)

The Compact is resource locks and thus support first-fill flows. However, LI.FI intent also supports escrow-like flows.

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
To check if the encoded output description has been validated, the hashed encoded payload should be sent to the appropriate local oracle along with relevant resolution details, such as who the solver was.

## InputSettlerCompact

The Compact Settler uses the [`StandardOrder`](https://github.com/openintentsframework/oif-contracts/blob/main/src/input/types/StandardOrderType.sol#L6-L15):
```solidity
struct StandardOrder {
    address user;
    uint256 nonce;
    uint256 originChainId;
    uint32 expires;
    uint32 fillDeadline;
    address localOracle;
    uint256[2][] inputs;
    MandateOutput[] outputs;
}
```

The CompactSettler supports two ways to resolve locks once the outputs have been made available for verification by the validation layer:

The two ways to finalize an intent:
1. [`finalise`](https://github.com/openintentsframework/oif-contracts/blob/main/src/input/compact/InputSettlerCompact.sol#L177-L184): Can only be called by the solver. The caller can designate where to send assets and whether an external call should be made.
2. [`finaliseWithSignature`](https://github.com/openintentsframework/oif-contracts/blob/main/src/input/compact/InputSettlerCompact.sol#L213-L221): Can be called by anyone with an [`AllowOpen`](https://github.com/openintentsframework/oif-contracts/blob/main/src/input/types/AllowOpenType.sol#L5-L9l) signature from the solver containing the destination and call.

### Intent Registration

While intents are transferred in the structure of `StandardOrder` they are signed as a `BatchClaim` with the following structure:

```solidity
struct BatchCompact {
    address arbiter;
    address sponsor;
    uint256 nonce;
    uint256 expires;
    uint256[2][] idsAndAmounts;
    Mandate mandate
}
```
With the Mandate being:
```solidity
struct Mandate {
    uint32 fillDeadline;
    address localOracle;
    MandateOutput[] outputs;
}
```

Intents are EIP712 signed `BatchClaim`s with The Compact's domain separator.

An alternative to signing the intent, is registering it on-chain. There are 2 ways to achieve this. Either by registering it by the sponsor (user) or paying for the entire claim and registering it on their behalf.

#### Integration examples:

For a smart contract implementation of how to register intents on behalf of someone else, see `RegisterIntentLib.sol`: https://github.com/catalystsystem/catalyst-intent/blob/27ce0972c150ed113f66ae91069eb953f23d920b/src/libs/RegisterIntentLib.sol#L100-L131

For a UI implementation of how to sign the Batch Compact, refer to the lintent.org demo: https://github.com/catalystsystem/lintent/blob/a4aa78cd058cade732b73d83aa2843dd4e9ea24d/src/lib/utils/lifiintent/tx.ts#L144

For a UI implementation of how to deposit and register the intent, refer to the lintent.org demo: https://github.com/catalystsystem/lintent/blob/a4aa78cd058cade732b73d83aa2843dd4e9ea24d/src/lib/utils/lifiintent/tx.ts#L199