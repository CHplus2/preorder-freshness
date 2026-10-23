import {isAddress, parseEther, keccak256} from 'ethers';
import escrowManifest from '../contracts/preorderEscrow.json' with {type:'json'};

export const escrowAbi=escrowManifest.abi;
export function verifyEscrowCode(code){
  if(code==='0x')throw Error('No escrow contract was found at this address on Sepolia.');
  if(!/^0x[0-9a-f]+$/i.test(code) || keccak256(code)!==escrowManifest.runtime_keccak256){
    throw Error('This address does not match the supported escrow contract. Check the deployment address and compiled version before funding.');
  }
}

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
  if ([seller,arbiter,buyer].some(address=>/^0x0{40}$/i.test(address))) throw Error('A participant cannot use the zero address.');
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(String(amount))) throw Error('Enter a positive decimal amount in test ETH.');
  const value = parseEther(String(amount));
  if (value <= 0n || value > parseEther('0.01')) throw Error('Use more than zero and no more than 0.01 test ETH.');
  return value;
}

export function escrowError(error) {
  if(error?.receipt?.status===0)return 'The transaction failed on-chain. No escrow action was applied; your wallet may still have paid a network fee.';
  if(error?.code==='TRANSACTION_REPLACED' && error.cancelled)return 'The wallet cancelled or replaced this action. No escrow settlement was confirmed; refresh its current status.';
  if (error?.code === 'ACTION_REJECTED' || error?.code === 4001) return 'Wallet request cancelled. No new action was confirmed.';
  if (error?.code === 'INSUFFICIENT_FUNDS') return 'Your wallet needs Sepolia test ETH for the amount and gas fee.';
  if (error?.code === 'TIMEOUT' || error?.code === 'ESCROW_CONFIRMATION_UNAVAILABLE') return 'The transaction was submitted, but confirmation is not yet verified. Refresh its status before trying another transaction.';
  if (error?.code === 'CALL_EXCEPTION') return error.reason || 'The contract refused this action. Refresh the deal to check your role, status and deadlines.';
  return error?.shortMessage || error?.message || 'Could not complete the action. Check your wallet and refresh the deal.';
}

export async function waitForEscrowTransaction(tx, onHash) {
  onHash(tx.hash);
  try {
    const receipt=await tx.wait(1,120000);
    if(receipt?.status===0)throw Object.assign(Error('The transaction failed on-chain.'),{code:'CALL_EXCEPTION',receipt});
    if(receipt?.status!==1)throw Object.assign(Error('The transaction confirmation could not be verified.'),{code:'ESCROW_CONFIRMATION_UNAVAILABLE',receipt});
    return receipt;
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
