/**
 * EIP-681 payment URI for an ERC-20 transfer.
 *
 *   ethereum:<token>@<chainId>/transfer?address=<deposit>&uint256=<baseUnits>
 *
 * Wallets that understand EIP-681 open pre-filled with the right chain, token,
 * recipient and amount, which is what makes "scan and pay" work without the
 * site ever touching a wallet connection.
 */
export function buildEip681Uri(params: {
  tokenAddress: string;
  chainId: number;
  depositAddress: string;
  amountBaseUnits: bigint;
}): string {
  const { tokenAddress, chainId, depositAddress, amountBaseUnits } = params;
  return `ethereum:${tokenAddress}@${chainId}/transfer?address=${depositAddress}&uint256=${amountBaseUnits.toString()}`;
}
