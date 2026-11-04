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
    if user is not None and hasattr(user,'customer_account') and not user.is_staff:
        account = user.customer_account
        if customer != {'name':account.name,'phone':account.phone}:
            raise serializers.ValidationError('Your account contact details changed. Refresh checkout before placing your order.')
        customer = {'name':account.name,'phone':account.phone}
    address = {}
    if method != 'pickup':
        form = DeliveryAddressInput(data=data.get('delivery_address', {}));form.is_valid(raise_exception=True)
        address = dict(recipient_name=customer['name'],phone=customer['phone'],line1=form.validated_data['line1'],
            line2='',city='',state='',postal_code='',country='Malaysia')
    return customer,address
