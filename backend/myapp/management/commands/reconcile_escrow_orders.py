"""Read-only on-chain checks; writes only independently verified payment records."""
import json
from django.core.management.base import BaseCommand
from django.db import transaction
from myapp.models import Order
from myapp.services.escrow import SepoliaClient,EscrowError,reconcile,record_check_error

class Command(BaseCommand):
    help='Recheck submitted Sepolia funding and refunds; never sends a blockchain transaction.'
    def add_arguments(self,parser):
        parser.add_argument('--order-id',type=int,action='append')
        parser.add_argument('--limit',type=int,default=20)
    def handle(self,*args,**options):
        orders=Order.objects.filter(payment_method='escrow',payment_instructions__escrow_sepolia__funding_hash__isnull=False).exclude(
            payment_instructions__escrow_sepolia__state__in=['released','refunded']).exclude(payment_instructions__escrow_sepolia__funding_hash=None).order_by('updated_at','pk')
        if options['order_id']:orders=orders.filter(pk__in=options['order_id'])
        results=[]
        for pk in orders.values_list('pk',flat=True)[:max(1,min(options['limit'],100))]:
            with transaction.atomic():
                order=Order.objects.select_for_update().get(pk=pk)
                try:
                    invoice=reconcile(order,None,SepoliaClient())
                    results.append({'order_id':pk,'payment_status':order.payment_status,'state':invoice['state']})
                except EscrowError as error:
                    order.refresh_from_db()
                    record_check_error(order,error)
                    results.append({'order_id':pk,'error':error.code})
        self.stdout.write(json.dumps({'checked':len(results),'orders':results}))
