---
title: "Validation Layers"
slug: "architecture/validation"
description: "Each Catalyst System order specifies which components are used for which aspects of the swap. Validation layers can be permissionlessly chosen by the issuer of an intent, and anyone can write a validation layer."
sidebar:
  order: 3
---

Any validation layer can be added to Catalyst as long as it supports validating a payload from a remote chain.

In the simplest implementation, a validation layer needs to support the following:

1. A submission interface where solvers can submit their filled outputs. The submission interface should take in arbitrary packages for validation and then call the associated output settlement contract to validate whether the payloads are valid.
    ```solidity
    interface IPayloadCreator {
        function arePayloadsValid(
            bytes[] calldata payloads
        ) external view returns (bool);
    }
    ```

2. Implement the associated validation interfaces so that Input Settlement implementations can accurately verify whether outputs have been filled.
   ```solidity
    interface IValidationLayer {
        /**
        * @notice Check if some data has been attested to.
        * @param remoteChainId Chain the data supposedly originated from.
        * @param remoteOracle Identifier for the remote attestation.
        * @param remoteApplication Identifier for the application that the attestation originated from.
        * @param dataHash Hash of data.
        */
        function isProven(uint256 remoteChainId, bytes32 remoteOracle, bytes32 remoteApplication, bytes32 dataHash) external view returns (bool);

        /**
        * @notice Check if a series of data has been attested to.
        * @dev More efficient implementation of isProven. Does not return a boolean; instead, reverts if false.
        * This function returns true if proofSeries is empty.
        * @param proofSeries remoteOracle, remoteChainId, and dataHash encoded in chunks of 32*4=128 bytes.
        */
        function efficientRequireProven(
            bytes calldata proofSeries
        ) external view;
    }
    ```

Importantly, the submission interface does not have to be standardized; as long as it is accurately documented for solvers to implement.

Notice! While this has been designed for explicit verification, optimistic validation layers are also supported when they can expose the above proof interfaces.

## Implemented Validation Interfaces

There are two types of validation interfaces:
1. Self-serve: Validation interfaces where the submission of the payload generates an off-chain proof that has to be collected and submitted on the input chain.
2. Automatic: Validation interfaces where the submission of the payload automatically delivers the associated proof on the input chain.

Currently, two self-serve validation interfaces are implemented, while no automatic interfaces are supported.

### [Wormhole](https://github.com/catalystsystem/catalyst-intent/blob/main/src/oracles/wormhole/WormholeOracle.sol) (self-serve)

The Wormhole implementation is based on the broadcast functionality of Wormhole. A group of payloads can be collected and [packed into a larger message](https://github.com/catalystsystem/catalyst-intent/blob/fcdbdc6a77734ddc56be0e5de737f324cbba670d/src/libs/MessageEncodingLib.sol#L30-L44):

```solidity
Common Structure (Repeated 0 times)
    SENDER_IDENTIFIER       0       (32 bytes)
    + NUM_PAYLOADS          32      (2 bytes)
Payloads (repeated NUM_PAYLOADS times)
    PAYLOAD_LENGTH          M_i+0   (2 bytes)
    PAYLOAD                 M_i+2   (PAYLOAD_LENGTH bytes)

where M_i = sum_0^(i-1) M_i and M_0 = 32
```

This message is then emitted to the Wormhole guardian set. Once the associated proof becomes available, the solver can submit the associated proof on the input chain and validate their intents.

Notice that the Wormhole implementation uses a more efficient validation algorithm than Wormhole's `Implementation.sol`.

Solvers wanting to support orders using the Wormhole validation layer need to listen to the Guardian gossip network to collect proofs.

### [Polymer](https://github.com/catalystsystem/catalyst-intent/blob/main/src/oracles/polymer/PolymerOracle.sol) (self-serve)

Polymer allows validating specific events. As a result, the fill event is parsed:
```solidity
event OutputFilled(bytes32 orderId, bytes32 solver, uint32 timestamp, OutputDescription output);
```

and converted into the appropriate payload for the input settlement layer:
```solidity
(bytes32 solver, uint32 timestamp, OutputDescription memory output) = abi.decode(unindexedData, (bytes32, uint32, OutputDescription));
bytes32 payloadHash = _proofPayloadHash(orderId, solver, timestamp, output);
```

Solvers wanting to support orders using the Polymer validation layer need to implement the Polymer API to collect relevant event proofs.

### [Bitcoin](https://github.com/catalystsystem/catalyst-intent/blob/main/src/oracles/bitcoin/BitcoinOracle.sol) (self-serve)

Catalyst has a Bitcoin Simplified Payment Validation (SPV) client implementation. The implementation works both as an Output Settlement implementation and as a validation layer.

The Bitcoin SPV client requires constant upkeep – the blockchain has to be updated approximately every 10 minutes or whenever a transaction needs to be proven – to properly validate transactions.

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