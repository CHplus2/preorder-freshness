"""Customer details are order snapshots, not login credentials."""
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from .handover import contact_number


def is_guest(user):
    return user.is_authenticated and hasattr(user, 'guest_customer') and not hasattr(user, 'customer_account')


def require_customer_account(user):
    # Existing password-authenticated customers remain legitimate accounts. New
    # opaque browsing identities must first complete passkey registration.
    if is_guest(user):
        raise PermissionDenied('Create an account or sign in with your passkey before placing an order.')


class CustomerInput(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=30)

    def validate_phone(self, value):
        phone = contact_number(value)
        if not phone:
            raise serializers.ValidationError('Enter a phone number so the kitchen can reach you.')
        return phone


class DeliveryAddressInput(serializers.Serializer):
    line1 = serializers.CharField(max_length=500)


def customer_details(data, method, user=None):
    form = CustomerInput(data=data.get('customer', {}));form.is_valid(raise_exception=True)
    customer = dict(form.validated_data)
    # Contact details are editable order facts, never a way to choose an account.
    # Saving them back to the signed-in profile is a separate, explicit choice.
    address = {}
    if method != 'pickup':
        form = DeliveryAddressInput(data=data.get('delivery_address', {}));form.is_valid(raise_exception=True)
        address = dict(recipient_name=customer['name'],phone=customer['phone'],line1=form.validated_data['line1'],
            line2='',city='',state='',postal_code='',country='Malaysia')
    return customer,address


def save_checkout_contact(request, customer):
    """Called only inside a successful placement transaction, for this user."""
    from ..models import CustomerAccount
    save = serializers.BooleanField().run_validation(request.data.get('save_contact', False))
    if not save:
        return
    user = request.user
    if user.is_staff:
        CustomerAccount.objects.update_or_create(user=user, defaults=customer)
        first, _, last = customer['name'].partition(' ')
        user.first_name, user.last_name = first, last
        user.save(update_fields=['first_name', 'last_name'])
        return
    account = CustomerAccount.objects.select_for_update().filter(user=user).first()
    if not account:
        raise serializers.ValidationError('Use Account settings to save contact details for this existing account.')
    if customer == {'name': account.name, 'phone': account.phone}:
        return
    # Keep the existing passkey confirmation rule for customer profile changes.
    from ..views.passkeys import recent
    recent(request)
    account.name, account.phone = customer['name'], customer['phone']
    account.save(update_fields=['name', 'phone', 'updated_at'])
