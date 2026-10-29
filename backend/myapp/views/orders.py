from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from ..models import Product, Storefront
from decimal import Decimal
from ..models import CartItem, Address, Wallet, WalletTransaction, Order, OrderItem, InventoryItem, InventoryLog, IngredientConsumption, PaymentEvent
from ..serializers import OrderSerializer, AddressSerializer
from ..services.fulfilment import request_store, fee, snapshot

# ------------------------------------------
# ORDER
# ------------------------------------------

class OrderList(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user).select_related("user", "address").prefetch_related("items").order_by("-created_at")

def usable_stock():
    today = timezone.localdate()
    return InventoryItem.objects.filter(quantity__gt=0, expiry_date__gte=today,
        received_date__lte=today, quarantined=False)


def deduct_order_inventory(order, user):
    """Caller holds an atomic order lock; lock stock globally before any writes.

    Orders may list menus/ingredients in different orders. Acquiring each item's
    lots separately could deadlock two cooks on opposite ingredient sequences.
    """
    from collections import defaultdict
    items = list(order.items.prefetch_related('accepted_ingredients'))
    by_material = defaultdict(list)
    material_ids = {ingredient.raw_material_id for item in items for ingredient in item.accepted_ingredients.all()}
    for batch in usable_stock().select_for_update().filter(raw_material_id__in=material_ids).order_by(
            'raw_material_id', 'expiry_date', 'received_date', 'id'):
        by_material[batch.raw_material_id].append(batch)
    for item in items:
        deduct_inventory(item, user, order, by_material)


def deduct_inventory(item, user, order, by_material=None):
    """
    Deduct raw materials required to produce the ordered quantity
    of a product using FEFO (First Expired, First Out).
    """

    ingredients = sorted(item.accepted_ingredients.all(), key=lambda ingredient: ingredient.raw_material_id)
    if not ingredients:
        raise ValidationError("This order has no recorded recipe. Review its accepted recipe before cooking.")
    for ingredient in ingredients:

        required_quantity = (
            ingredient.quantity_per_portion * item.quantity
        )

        inventory_items = (by_material[ingredient.raw_material_id] if by_material is not None else
            usable_stock().select_for_update().filter(raw_material_id=ingredient.raw_material_id)
                .order_by('expiry_date', 'received_date', 'id'))

        remaining = required_quantity

        for inventory_item in inventory_items:

            if remaining <= 0:
                break
            if inventory_item.quantity <= 0:
                continue

            deduction = min(
                inventory_item.quantity,
                remaining
            )

            inventory_item.quantity -= deduction
            inventory_item.save(
                update_fields=["quantity", "updated_at"]
            )

            InventoryLog.objects.create(
                inventory_item=inventory_item,
                change=-deduction,
                reason=f"Used for {item.product_name}",
                reference=f"Order #{order.id}",
                admin=user,
            )
            IngredientConsumption.objects.create(order_item=item, inventory_item=inventory_item,
                material_name=ingredient.material_name, unit=ingredient.unit,
                batch_code=inventory_item.batch_code, quantity=deduction,
                unit_cost=inventory_item.unit_cost, recorded_expiry=inventory_item.expiry_date)

            remaining -= deduction

        if remaining > 0:
            raise ValidationError(
                f"Insufficient {ingredient.material_name} "
                f"for {item.product_name}: short by {remaining.normalize():f} {ingredient.unit}. "
                "Add usable stock or review the batch records, then try again. "
                "Expired, held and not-yet-received batches cannot be used."
            )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def place_order(request):
    from django.contrib.auth.models import User
    user = User.objects.select_for_update().get(pk=request.user.pk)
    request_id = serializers.UUIDField(required=False).run_validation(request.data['request_id']) if 'request_id' in request.data else None
    if request_id:
        previous = Order.objects.filter(checkout_request_id=request_id).first()
        if previous:
            if previous.user_id != user.pk:
                raise ValidationError('This checkout reference is unavailable. Start a new checkout.')
            return Response({'detail': 'Order already placed', 'order_id': previous.pk, 'needs_review': previous.preparation_plan.get('needs_review', False), 'payment_method': previous.payment_method, 'payment_status': previous.payment_status})
    payment = request.data.get("payment")

    cart_items = CartItem.objects.filter(user=user).select_related("product")
    if not cart_items.exists():
        return Response({"detail": "Cart empty"}, status=status.HTTP_400_BAD_REQUEST)

    if payment not in ('cod', 'wallet', 'paypal', 'manual', 'escrow', 'deferred'):
        raise ValidationError('Choose a supported payment method.')
    # One lock serialises scheduling across different menus in this single kitchen.
    Storefront.objects.get_or_create(pk=1)
    store = Storefront.objects.select_for_update().get(pk=1)
    store, method, area = request_store(store, request.data, require_area=True)
    if payment == 'cod' and method != 'pickup':
        raise ValidationError('Cash is available for self-collection only. Choose another payment method for delivery.')
    address = None
    if method != 'pickup':
        address_id = serializers.IntegerField(min_value=1).run_validation(request.data.get('address_id'))
        try:
            address = Address.objects.get(id=address_id, user=user)
        except Address.DoesNotExist:
            return Response({'detail': 'Invalid address'}, status=status.HTTP_404_NOT_FOUND)
    if method == 'pickup' and payment == 'escrow':
        raise ValidationError('Escrow currently supports delivery orders. Choose another payment method for self-collection.')
    # Lock menus so simultaneous bookings cannot exceed their daily capacity.
    list(Product.objects.select_for_update().filter(id__in=cart_items.values('product_id')).order_by('id'))
    delivery_at = serializers.DateTimeField().run_validation(request.data.get('delivery_at'))
    from ..services.scheduling import schedule_order, plan_snapshot
    plan = schedule_order(cart_items, delivery_at, store, allow_manual_review=True, allow_request_exceptions=True)
    needs_review = plan.get('needs_review', False)
    if needs_review:
        # Review requests never debit credits or invite an advance transfer.
        payment = 'deferred'
    elif payment == 'deferred':
        raise ValidationError('This time can now be scheduled. Refresh availability and choose a payment method.')
    if payment == 'manual' and not (store.manual_payment_enabled and (store.bank_transfer_instructions.strip() or store.duitnow_qr_url)):
        raise ValidationError('Manual payment is unavailable. Choose another payment method.')
    if payment == 'paypal':
        from ..services.paypal import enabled
        if not enabled():
            raise ValidationError('PayPal is unavailable. Choose another payment method.')
    if payment == 'escrow':
        from ..services.escrow import config
        if not config():
            raise ValidationError('Sepolia escrow is unavailable. Choose another payment method.')
    # The store/menu locks above protect schedule_order's authoritative capacity
    # check. Review-only requests reserve neither task time nor a daily quota.
    cart_total = sum(item.quantity * item.product.price for item in cart_items)
    portions = sum(item.quantity for item in cart_items)
    discount = (cart_total * Decimal(store.bulk_discount_percent) / 100).quantize(Decimal('0.01')) if portions >= store.bulk_minimum else Decimal('0.00')
    shipping_fee = fee(cart_total, store, method)
    is_paid = 'unpaid'
    if payment == 'wallet':
        wallet = Wallet.objects.select_for_update().filter(user=user).first()
        if not wallet or wallet.balance < cart_total - discount + shipping_fee:
            raise ValidationError('Insufficient wallet balance.')
        wallet.balance -= cart_total - discount + shipping_fee
        wallet.save()
        is_paid = 'paid'
    # PayPal must be verified server-side before an owner marks it paid.

    from ..services.reminders import reminder_preference
    from django.core.exceptions import ValidationError as EmailValidationError
    email_reminder = serializers.BooleanField().run_validation(request.data.get('email_reminder', False))
    try:
        updates = serializers.BooleanField().run_validation(request.data.get('email_dispatch_updates', False))
        if updates and not email_reminder:
            raise ValidationError('Enable email reminders before choosing dispatch updates.')
        time_updates = serializers.BooleanField().run_validation(request.data.get('email_time_updates', False))
        if time_updates and not email_reminder:
            raise ValidationError('Enable email reminders before choosing time-change updates.')
        preference = reminder_preference(user, email_reminder, dispatch_updates=updates, time_updates=time_updates)
    except EmailValidationError:
        raise ValidationError('Add a valid email in Account settings before enabling reminders.')

    from ..services.handover import HandoverInput
    handover = HandoverInput(data=request.data.get('handover', {}), context={'pickup': method == 'pickup'})
    handover.is_valid(raise_exception=True)

    # --- Create order ---
    order = Order.objects.create(
        checkout_request_id=request_id,
        user=user,
        delivery_at=delivery_at,
        preparation_at=plan['start'],
        preparation_end_at=plan['end'],
        preparation_plan=plan_snapshot(plan),
        delivery_method=method,
        fulfilment_snapshot=dict(snapshot(store, method, area), customer_reminder=preference, handover=dict(handover.validated_data)),
        address=address,
        delivery_address=dict(AddressSerializer(address).data) if address else {},
        total_amount=0,
        status="pending",
        payment_status=is_paid,
        payment_method=payment,
        payment_instructions={'instructions': store.bank_transfer_instructions, 'qr_url': store.duitnow_qr_url} if payment == 'manual' else {},
    )

    total = 0
    for item in cart_items:

        subtotal = item.quantity * item.product.price

        OrderItem.objects.create(
            order=order,
            product=item.product,
            product_name=item.product.name,
            unit_price=item.product.price,
            quantity=item.quantity,
            subtotal=subtotal,
        )
        total += subtotal

    shipping_fee = fee(total, store, method)

    order.discount_amount = discount
    order.total_amount = total - discount
    order.shipping_fee = shipping_fee
    order.save()

    cart_items.delete()

    if payment == "wallet":
        import uuid
        PaymentEvent.objects.create(order=order, request_id=uuid.uuid4(), kind='receipt',
            outcome='completed', amount=order.total_amount+order.shipping_fee,
            method='wallet', reference=f'Order #{order.pk} demo wallet debit',
            source='demo_wallet', actor=user)
        WalletTransaction.objects.create(
            wallet=wallet,
            amount=order.total_amount + order.shipping_fee,
            type="payment",
            reference=f"Order #{order.id}"
        )

    from ..services.discovery import attribute_order
    attribute_order(request, order)
    return Response({"detail": "Order placed", "order_id": order.id, "needs_review": needs_review, "payment_method": order.payment_method, "payment_status": order.payment_status}, status=status.HTTP_201_CREATED)


# ------------------------------------------
# ADDRESS
# ------------------------------------------

class AddressListCreate(generics.ListAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user, is_default=True)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def saved_address(request):
    from django.contrib.auth.models import User
    if request.method != 'GET':
        User.objects.select_for_update().get(pk=request.user.pk)
    address = Address.objects.filter(user=request.user, is_default=True).first()
    if request.method == 'GET':
        return Response(AddressSerializer(address).data if address else None)
    serializer = AddressSerializer(address, data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    address = serializer.save(user=request.user, is_default=True)
    return Response(AddressSerializer(address).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def preparation_quote(request):
    from ..services.scheduling import schedule_order, plan_snapshot
    delivery = serializers.DateTimeField().run_validation(request.data.get('delivery_at'))
    store = Storefront.objects.filter(pk=1).first() or Storefront()
    store, method, area = request_store(store, request.data, require_area=True)
    items = list(CartItem.objects.filter(user=request.user).select_related('product'))
    plan = schedule_order(items, delivery, store, allow_manual_review=True, allow_request_exceptions=True)
    from ..services.arrival_windows import window, duration
    timing = {'arrival_window': window(delivery, duration(store)), 'arrival_window_minutes': duration(store)}
    if plan.get('needs_review'):
        return Response(dict(**timing, preparation_at=None, preparation_end_at=None, **plan_snapshot(plan)))
    from ..services.discovery import shopping_preview
    return Response(dict(**timing, preparation_at=plan['start'], preparation_end_at=plan['end'],
        procurement_required=bool(shopping_preview(items, plan['start'], plan['end'])), **plan_snapshot(plan)))
