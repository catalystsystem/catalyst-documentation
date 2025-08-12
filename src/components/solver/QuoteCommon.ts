export type DutchAuctionData = {
  type: "DutchAuction"; // should not be submitted on-chain but can be used to differentiate order types.
  proofDeadline: number;
  challengeDeadline: number;
  collateralToken: string;
  fillerCollateralAmount: string;
  challengerCollateralAmount: string;
  inputOracle: string;
  oracle: string;
  slopeStartingTime: number;
  inputSlope: string;
  outputSlope: string;
  inputs: {}[]; // Even though `inputs` is provided as an array, to submit on-chain it needs to be provided as a single input named `input`
  outputs: {}[];
};

export type LimitOrderData = {
  type: "LimitOrder"; // should not be submitted on-chain but can be used to differentiate order types.
  proofDeadline: number;
  challengeDeadline: number;
  collateralToken: string;
  fillerCollateralAmount: string;
  challengerCollateralAmount: string;
  inputOracle: string;
  oracle: string;
  inputs: {}[];
  outputs: {}[];
};

// Then the CrossChainOrder is defined as such:
export type CrossChainOrder = {
  settlementContract: string;
  swapper: string;
  nonce: string;
  originChainId: number;
  initiateDeadline: number;
  fillDeadline: number;
  orderContext: DutchAuctionData | LimitOrderData;
};

export type GetOrderData = {
  order: CrossChainOrder;
  orderKeyHash: string | undefined; // initially but will become always defined.
  quote: {
    fromAssets: string[];
    toAssets: string[];
    toPrices: string[];
    fromPrices: string[];
    intermediary: "USD" | "EUR" | "BTC" | string; // explicit string types here are examples.
    discount: string;
  };
  signature: string;
  submitTime: number;
};

export type GetOrdersEvent = {
  orders: GetOrderData[];
  pagination: any;
};
