"""Private uploaded evidence, bound to the server-priced checkout, not a receipt."""
import hashlib,json
from datetime import timedelta, timezone as dt_timezone
from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from ..models import CheckoutProof


def checkout_pricing(items, store, method):
    from .fulfilment import fee
    items=list(items)
    subtotal=sum((row.product.price*row.quantity for row in items),Decimal('0'))
    discount=(subtotal*Decimal(store.bulk_discount_percent)/100).quantize(Decimal('.01')) if sum(r.quantity for r in items)>=store.bulk_minimum else Decimal('0')
    shipping=fee(subtotal,store,method)
    return {key:format(value.quantize(Decimal('.01')),'.2f') for key,value in dict(food_subtotal=subtotal,discount=discount,delivery_fee=shipping,total=subtotal-discount+shipping).items()}


def price_scope(items, store, delivery_at, method, area):
    items=list(items)
    amount=Decimal(checkout_pricing(items,store,method)['total'])
    values=[sorted((r.product_id,r.quantity,str(r.product.price)) for r in items),
        delivery_at.astimezone(dt_timezone.utc).isoformat(),method,area,getattr(store,'arrival_window_minutes',0),str(amount),
        [store.manual_payment_enabled,store.bank_transfer_instructions,store.duitnow_qr_url]]
    return amount,hashlib.sha256(json.dumps(values,separators=(',',':')).encode()).hexdigest()


def claim_proof(user, value, items, store, delivery_at, method, area):
    key=serializers.UUIDField().run_validation(value)
    proof=CheckoutProof.objects.select_for_update().filter(pk=key,user=user,order__isnull=True,
        created_at__gte=timezone.now()-timedelta(hours=24)).first()
    if not proof:
        raise serializers.ValidationError({'payment_proof_id':'Upload payment proof for this checkout. It may have expired or already been used.'})
    amount,digest=price_scope(items,store,delivery_at,method,area)
    if proof.scope_digest != digest or proof.amount != amount:
        raise serializers.ValidationError({'payment_proof_id':'Your basket or delivery details changed. Review the amount and upload matching proof. Do not pay twice; contact the kitchen if you already paid another amount.'})
    if CheckoutProof.objects.filter(digest=proof.digest,order__isnull=False).exists():
        raise serializers.ValidationError({'payment_proof_id':'This receipt image has already been submitted for an order. Check your orders or contact the kitchen.'})
    return proof
