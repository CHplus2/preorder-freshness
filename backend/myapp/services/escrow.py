"""Sepolia-only, server-verified escrow invoices. Never trust browser payment claims."""
import json
import re
import uuid
from decimal import Decimal
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from django.db import transaction
from django.conf import settings
from django.utils import timezone
from Crypto.Hash import keccak
from ..models import PaymentEvent

CHAIN_ID = 11155111
ADDRESS = re.compile(r'^0x[0-9a-fA-F]{40}$')
HASH = re.compile(r'^0x[0-9a-fA-F]{64}$')
STATES = {1:'funded', 2:'dispatched', 3:'disputed', 4:'released', 5:'refunded'}

class EscrowError(Exception):
    def __init__(self, message='Escrow status could not be verified. Check again before paying.', code='provider_unavailable'):
        self.message, self.code = message, code
        super().__init__(message)

def digest(data):
    return '0x'+keccak.new(digest_bits=256, data=data).hexdigest()

def address(value):
    return isinstance(value, str) and bool(ADDRESS.fullmatch(value)) and int(value,16)!=0

def config():
    try:
        rpc = urlsplit(settings.ESCROW_RPC_URL)
        local = not settings.IS_VERCEL and rpc.scheme=='http' and rpc.hostname in ('localhost','127.0.0.1')
        rate = int(settings.ESCROW_WEI_PER_MYR)
        confirmations = int(settings.ESCROW_MIN_CONFIRMATIONS)
        if (not settings.ESCROW_SEPOLIA_ENABLED or not (rpc.scheme=='https' or local) or not rpc.hostname
                or rpc.username or rpc.password or rpc.fragment or rate<=0 or rate>10**16 or not 2<=confirmations<=64
                or not all(address(v) for v in [settings.ESCROW_CONTRACT_ADDRESS,settings.ESCROW_SELLER_ADDRESS,settings.ESCROW_ARBITER_ADDRESS])
                or settings.ESCROW_SELLER_ADDRESS.lower()==settings.ESCROW_ARBITER_ADDRESS.lower()):
            return None
        return dict(chain_id=CHAIN_ID, contract=settings.ESCROW_CONTRACT_ADDRESS.lower(),
            seller=settings.ESCROW_SELLER_ADDRESS.lower(),arbiter=settings.ESCROW_ARBITER_ADDRESS.lower(),
            wei_per_myr=rate,confirmations=confirmations)
    except (ValueError,TypeError):
        return None

def public_config():
    value=config()
    return {'enabled':bool(value),'chain_id':CHAIN_ID,'network':'Sepolia',
        'contract':value['contract'] if value else '', 'test_funds':True}

def total(order):
    return str((order.total_amount+order.shipping_fee).quantize(Decimal('0.01')))

def locked_delivery(order, target):
    if order.payment_method=='escrow' and order.payment_instructions.get('escrow_sepolia') and target!=order.delivery_at:
        raise EscrowError('The escrow deadline is fixed for this invoice. Contact the kitchen to resolve the payment and replace the booking for another delivery time.', 'invoice_locked')

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        return None

class SepoliaClient:
    def __init__(self):
        if not config():raise EscrowError('Sepolia escrow is not configured.', 'not_configured')
        self.opener=build_opener(NoRedirect())
    def batch(self, calls):
        payload=[{'jsonrpc':'2.0','id':i,'method':method,'params':params} for i,(method,params) in enumerate(calls)]
        try:
            req=Request(settings.ESCROW_RPC_URL,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'},method='POST')
            with self.opener.open(req,timeout=8) as response:
                raw=response.read(1_000_001)
            if len(raw)>1_000_000:raise ValueError()
            rows=json.loads(raw)
            if not isinstance(rows,list) or len(rows)!=len(calls):raise ValueError()
            indexed={r['id']:r for r in rows if isinstance(r,dict) and type(r.get('id')) is int and 'error' not in r and 'result' in r}
            if set(indexed)!=set(range(len(calls))):raise ValueError()
            return [indexed[i]['result'] for i in range(len(calls))]
        except (OSError,ValueError,KeyError,TypeError):
            raise EscrowError() from None

def quantity(value):
    if not isinstance(value,str) or not re.fullmatch(r'0x[0-9a-fA-F]+',value):raise ValueError()
    return int(value,16)

def calldata(invoice):
    return (digest(b'fund(bytes32,address,address,uint256)')[:10]+invoice['reference'][2:]
        +invoice['seller'][2:].zfill(64)+invoice['arbiter'][2:].zfill(64)+hex(invoice['dispatch_by'])[2:].zfill(64)).lower()

def runtime_hash():
    try:
        return json.loads((settings.BASE_DIR.parent/'frontend/src/contracts/preorderEscrow.json').read_text())['runtime_keccak256']
    except (OSError,ValueError,KeyError):
        raise EscrowError('The escrow contract verification manifest is unavailable. Contact the kitchen.','not_configured') from None

def verify(invoice, tx_hash, client):
    """Verify canonical mined funding, event, parameters and a confirmed state read."""
    try:
        chain,head,receipt,tx=client.batch([('eth_chainId',[]),('eth_blockNumber',[]),
            ('eth_getTransactionReceipt',[tx_hash]),('eth_getTransactionByHash',[tx_hash])])
        if quantity(chain)!=CHAIN_ID:raise ValueError()
        if receipt is None or tx is None:return {'state':'pending','observed_confirmations':0}
        if quantity(receipt['status'])!=1:raise EscrowError('The funding transaction failed on-chain. No payment was recorded.','transaction_failed')
        block=quantity(receipt['blockNumber']); confirmations=quantity(head)-block+1
        if confirmations<invoice['confirmations']:return {'state':'pending','observed_confirmations':max(0,confirmations)}
        safe=quantity(head)-invoice['confirmations']+1;tag=hex(safe)
        funded_block,safe_block,code,result=client.batch([('eth_getBlockByNumber',[hex(block),False]),
            ('eth_getBlockByNumber',[tag,False]),('eth_getCode',[invoice['contract'],hex(block)]),
            ('eth_call',[{'to':invoice['contract'],'data':digest(b'deals(bytes32)')[:10]+invoice['reference'][2:]},tag])])
        if (not HASH.fullmatch(receipt['blockHash']) or receipt['blockHash'].lower()!=funded_block['hash'].lower()
                or tx['blockHash'].lower()!=receipt['blockHash'].lower() or quantity(tx['blockNumber'])!=block
                or quantity(funded_block['number'])!=block or quantity(safe_block['number'])!=safe or not HASH.fullmatch(safe_block['hash'])
                or digest(bytes.fromhex(code[2:]))!=runtime_hash()
                or tx_hash.lower()!=receipt['transactionHash'].lower() or tx_hash.lower()!=tx['hash'].lower()
                or tx['to'].lower()!=invoice['contract'] or receipt['to'].lower()!=invoice['contract']
                or tx['from'].lower()!=invoice['buyer'] or receipt['from'].lower()!=invoice['buyer']
                or quantity(tx['value'])!=int(invoice['amount_wei']) or tx['input'].lower()!=calldata(invoice)
                or quantity(funded_block['timestamp'])>=invoice['dispatch_by']):raise ValueError()
        topic=digest(b'Changed(bytes32,uint8)')
        events=[e for e in receipt['logs'] if e.get('address','').lower()==invoice['contract'] and
            e.get('topics')==[topic,invoice['reference']] and quantity(e['data'])==1 and not e.get('removed',False)]
        if len(events)!=1:raise ValueError()
        if not isinstance(result,str) or not re.fullmatch(r'0x[0-9a-fA-F]{448}',result):raise ValueError()
        words=[int(result[2+i*64:2+(i+1)*64],16) for i in range(7)]
        if (words[:3]!=[int(invoice[k],16) for k in ['buyer','seller','arbiter']]
                or words[3]!=int(invoice['amount_wei']) or words[4]!=invoice['dispatch_by']
                or words[5]!=invoice['dispatch_by']+7*86400 or words[6] not in STATES):
            raise ValueError()
        return {'state':STATES[words[6]],'observed_confirmations':confirmations,'block':safe,'block_hash':safe_block['hash']}
    except EscrowError:
        raise
    except (ValueError,KeyError,TypeError,IndexError,AttributeError):
        raise EscrowError('The chain evidence does not match this order invoice. No payment status was changed.','verification_failed') from None

@transaction.atomic
def reconcile(order, actor, client):
    invoice=dict(order.payment_instructions['escrow_sepolia'])
    if invoice['amount_myr']!=total(order):raise EscrowError('The order total changed; review the escrow invoice.','verification_failed')
    evidence=verify(invoice,invoice['funding_hash'],client)
    if ((order.payment_status!='unpaid' and evidence['state']=='pending') or (order.payment_status=='refunded' and evidence['state']!='refunded')):
        raise EscrowError('A previously recorded payment has contradictory chain evidence. Owner review is required; prior records were retained.','verification_failed')
    if evidence['state']!='pending':
        event_id=uuid.uuid5(uuid.NAMESPACE_URL,f"sepolia-funding:{invoice['contract']}:{invoice['funding_hash']}")
        row,_=PaymentEvent.objects.get_or_create(request_id=event_id,defaults=dict(order=order,kind='receipt',outcome='completed',
            amount=Decimal(invoice['amount_myr']),method='escrow',reference=invoice['funding_hash'],source='escrow_sepolia',actor=actor,
            note=f"Server-verified Sepolia funding: {invoice['amount_wei']} wei held for this order. Test funds; MYR is the recorded order value."))
        if row.order_id!=order.pk or row.amount!=Decimal(invoice['amount_myr']) or row.source!='escrow_sepolia' or row.kind!='receipt' or row.outcome!='completed' or row.method!='escrow':
            raise EscrowError('This funding receipt belongs to another payment record.','verification_failed')
        if order.payment_status=='unpaid':order.payment_status='paid'
        if evidence['state']=='refunded':
            refund,_=PaymentEvent.objects.get_or_create(request_id=uuid.uuid5(uuid.NAMESPACE_URL,f"sepolia-refund:{invoice['contract']}:{invoice['reference']}"),
                defaults=dict(order=order,kind='refund',outcome='completed',amount=Decimal(invoice['amount_myr']),method='escrow',
                    reference=f"{invoice['reference']}@{evidence['block']}",source='escrow_sepolia',actor=actor,
                    note='Server-verified buyer refund credit on Sepolia. Buyer withdraws separately; this is not real-money MYR settlement.'))
            if refund.order_id!=order.pk or refund.kind!='refund' or refund.source!='escrow_sepolia' or refund.amount!=Decimal(invoice['amount_myr']) or refund.outcome!='completed' or refund.method!='escrow':
                raise EscrowError('This refund reference belongs to another payment record.','verification_failed')
            order.payment_status='refunded'
        order.save(update_fields=['payment_status','updated_at'])
    invoice.update(evidence,last_checked_at=timezone.now().isoformat());invoice.pop('check_error',None)
    order.payment_instructions={**order.payment_instructions,'escrow_sepolia':invoice}
    order.save(update_fields=['payment_instructions','updated_at'])
    return invoice


def record_check_error(order, error):
    invoice=dict(order.payment_instructions['escrow_sepolia'],check_error=error.message)
    if order.payment_status=='unpaid':invoice['state']=error.code
    order.payment_instructions={**order.payment_instructions,'escrow_sepolia':invoice}
    order.save(update_fields=['payment_instructions','updated_at'])
