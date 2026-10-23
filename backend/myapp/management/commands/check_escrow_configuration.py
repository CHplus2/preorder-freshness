import json
from django.core.management.base import BaseCommand,CommandError
from myapp.services.escrow import CHAIN_ID,config,SepoliaClient,digest,runtime_hash,quantity,EscrowError

class Command(BaseCommand):
    help='Verify escrow RPC chain and deployed code without sending a transaction or reading customer records.'
    def handle(self,*args,**options):
        cfg=config()
        if not cfg:raise CommandError('Configure the server-side Sepolia escrow settings first.')
        try:
            chain,code=SepoliaClient().batch([('eth_chainId',[]),('eth_getCode',[cfg['contract'],'latest'])])
            if quantity(chain)!=CHAIN_ID or digest(bytes.fromhex(code[2:]))!=runtime_hash():
                raise CommandError('The configured network or deployed contract does not match the supported Sepolia escrow.')
        except (EscrowError,ValueError,TypeError) as error:
            raise CommandError(error.message if isinstance(error,EscrowError) else 'Escrow configuration could not be verified.') from None
        self.stdout.write(json.dumps({'verified':True,'chain_id':CHAIN_ID,'contract':cfg['contract'],'minimum_confirmations':cfg['confirmations']}))
