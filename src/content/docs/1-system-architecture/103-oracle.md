---
title: "Oracle systems"
slug: "architecture/oracle"
description: "LI.FI intent lets you plug in custom validation and oracle layers, empowering you to choose the optimal trust and speed tradeoffs for your cross-chain use case."
sidebar:
  order: 3
---

Any validation layer can be added as long as it supports validating a payload from the output chain.

In the simplest implementation, a validation layer needs to support the following:

1. A submission interface where solvers can submit their filled outputs. The submission interface should accept arbitrary packages for validation and then call the associated output settlement contract to check whether the payloads are valid.
    ```solidity
    interface IPayloadCreator {
        function arePayloadsValid(
            bytes[] calldata payloads
        ) external view returns (bool);
    }
    ```

2. Implement the associated validation interfaces so that Input Settlement implementations can accurately verify whether outputs have been filled.
   ```solidity
    interface IOracle {
        function efficientRequireProven(
            bytes calldata proofSeries
        ) external view;
    }
    ```

Importantly, the submission interface does not have to be standardized; it just needs to be accurately documented so solvers can implement it.

## Implemented Validation Interfaces

There are three types of validation interfaces:
1. Self-serve: Validation interfaces where submitting the payload generates an off-chain proof that must be collected and submitted on the input chain.
2. Automatic: Validation interfaces where submitting the payload automatically delivers the associated proof on the input chain.

Currently, all supported oracle systems are self-serve.

:::note[Speed & Price]
**Polymer** is significantly faster than most other oracle systems. While speed does not impact asset delivery for users, it matters for solvers. Choosing an oracle system with fast repayments results in cheaper intents, as solvers can rotate their capital faster.
:::

### Polymer

Polymer allows validation of emitted events. The target event for validation is the [`OutputFilled`](https://github.com/openintentsframework/oif-contracts/blob/main/src/output/BaseOutputSettler.sol#L95) event, emitted when an output has been filled.
```solidity
event OutputFilled(bytes32 indexed orderId, bytes32 solver, uint32 timestamp, MandateOutput output);
```

Using the Polymer [prove API](https://docs.polymerlabs.org/docs/build/prove-api-V2/api-endpoints#1-request-log-proof), a proof of the event can be generated. Once generated, it can be submitted to [`receivedMessage`](https://github.com/openintentsframework/oif-contracts/blob/main/src/oracles/polymer/PolymerOracle.sol#L63-L67).

For an example of such an integration, see the [lintent.org implementation](https://github.com/catalystsystem/lintent/blob/a4aa78cd058cade732b73d83aa2843dd4e9ea24d/src/lib/utils/lifiintent/tx.ts#L524-L577).

Polymer can only prove one filled output at a time.

### Wormhole

The Wormhole implementation is based on the broadcast functionality of Wormhole. Messages must be submitted to the Wormhole Implementation via the [`submit`](https://github.com/openintentsframework/oif-contracts/blob/daa8913e5803d8b62b646335d4c5130cdfacfec8/src/oracles/wormhole/WormholeOracle.sol#L43) interface. Messages must be encoded into [`FillDescription`](https://github.com/openintentsframework/oif-contracts/blob/main/src/libs/MandateOutputEncodingLib.sol#L21-L36)s and then submitted:
```solidity
function submit(address source, bytes[] calldata payloads) public payable returns (uint256 refund);
```

This message is then emitted to the Wormhole guardian set. Once the associated proof becomes available, the solver can submit the proof to [`receiveMessage`](https://github.com/openintentsframework/oif-contracts/blob/daa8913e5803d8b62b646335d4c5130cdfacfec8/src/oracles/wormhole/WormholeOracle.sol#L78-L80) on the input chain to validate their intents.

Note: The Wormhole implementation uses a more efficient validation algorithm than Wormhole's `Implementation.sol`.

### Bitcoin

LI.FI Intents has a Bitcoin Simplified Payment Validation (SPV) client implementation. This implementation works both as an Output Settlement implementation and as a validation layer.

The Bitcoin SPV client requires constant upkeep—the blockchain must be updated approximately every 10 minutes, or whenever a transaction needs to be proven—to properly validate transactions.

To generate a transaction proof, refer to the code below:

```typescript
import mempoolJS from "@catalabs/mempool.js";
const mainnet: boolean;
const {
  bitcoin: { transactions, blocks },
} = mempoolJS({
  hostname: "mempool.space",
  network: mainnet ? undefined : "testnet4",
});

export async function generateProof(
  txid: string,
): Promise<{ blockHeader: string; proof: Proof; rawTx: string }> {
  const tx = await transactions.getTx({ txid });

  const merkleProof = await transactions.getTxMerkleProof({ txid });
  // TODO: serialization version 1.
  const rawTx = await transactions.getTxHex({ txid });

  const blockHash = await blocks.getBlockHeight({
    height: merkleProof.block_height,
  });

  // Most endpoints provide transactions witness encoded.
  // The following function serves to strip the witness data.
  const rawTxWitnessStripped = removeWitnesses(rawTx);

  const blockHeader = await blocks.getBlockHeader({ hash: blockHash });

  return {
    blockHeader,
    proof: {
      txId: txid,
      txIndex: merkleProof.pos,
      siblings: merkleProof.merkle.reduce(
        (accumulator, currentValue) => accumulator + currentValue,
      ),
    },
    rawTx: rawTxWitnessStripped,
  };
}
```