import {isAddress, parseEther} from 'ethers';

export function escrowActions(deal, account, timestamp) {
  const state = Number(deal?.state ?? 0);
  const role = account?.toLowerCase();
  const buyer = Boolean(role && role === deal?.buyer?.toLowerCase());
  const seller = Boolean(role && role === deal?.seller?.toLowerCase());
  const arbiter = Boolean(role && role === deal?.arbiter?.toLowerCase());
  const now = Number(timestamp);
  const ready = Number.isFinite(now) && now > 0;
  const open = [1, 2, 3].includes(state);
  return {
    role: buyer ? 'Buyer' : seller ? 'Seller' : arbiter ? 'Arbiter' : 'Observer',
    dispatch: ready && seller && state === 1 && now <= Number(deal.dispatchBy),
    confirm: buyer && state === 2,
    dispute: ready && (buyer || seller) && state === 2 && now <= Number(deal.resolveBy),
    refund: ready && open && (seller || (buyer &&
      ((state === 1 && now > Number(deal.dispatchBy)) || now > Number(deal.resolveBy)))),
    resolve: ready && arbiter && state === 3 && now <= Number(deal.resolveBy),
  };
}

export function escrowFunding(seller, arbiter, buyer, amount) {
  if (![seller, arbiter, buyer].every(isAddress)) throw Error('Enter valid seller and arbiter wallet addresses.');
  if (new Set([seller, arbiter, buyer].map(value => value.toLowerCase())).size !== 3) {
    throw Error('Buyer, seller and arbiter must use three different wallets.');
  }
  if (/^0x0{40}$/i.test(seller) || /^0x0{40}$/i.test(arbiter)) throw Error('A participant cannot use the zero address.');
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(String(amount))) throw Error('Enter a positive decimal amount in test ETH.');
  const value = parseEther(String(amount));
  if (value <= 0n || value > parseEther('0.01')) throw Error('Use more than zero and no more than 0.01 test ETH.');
  return value;
}

export function escrowError(error) {
  if (error?.code === 'ACTION_REJECTED' || error?.code === 4001) return 'Wallet request cancelled. No new action was confirmed.';
  if (error?.code === 'INSUFFICIENT_FUNDS') return 'Your wallet needs Sepolia test ETH for the amount and gas fee.';
  if (error?.code === 'CALL_EXCEPTION') return error.reason || 'The contract refused this action. Refresh the deal to check your role, status and deadlines.';
  return error?.shortMessage || error?.message || 'Could not complete the action. Check your wallet and refresh the deal.';
}

export async function waitForEscrowTransaction(tx, onHash) {
  onHash(tx.hash);
  try {
    return await tx.wait();
  } catch (error) {
    // A wallet can replace a pending transaction when the user speeds it up.
    // Cancellation or a reverted replacement must never appear as success.
    if (error.code === 'TRANSACTION_REPLACED' && !error.cancelled && error.receipt?.status === 1) {
      onHash(error.replacement.hash);
      return error.receipt;
    }
    throw error;
  }
}
