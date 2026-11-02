"""Customer details are order snapshots, not login credentials."""
from rest_framework import serializers
from .handover import contact_number


def is_guest(user):
    return user.is_authenticated and hasattr(user, 'guest_customer')


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


def customer_details(data, method):
    form = CustomerInput(data=data.get('customer', {}));form.is_valid(raise_exception=True)
    customer = dict(form.validated_data)
    address = {}
    if method != 'pickup':
        form = DeliveryAddressInput(data=data.get('delivery_address', {}));form.is_valid(raise_exception=True)
        address = dict(recipient_name=customer['name'],phone=customer['phone'],line1=form.validated_data['line1'],
            line2='',city='',state='',postal_code='',country='Malaysia')
    return customer,address
