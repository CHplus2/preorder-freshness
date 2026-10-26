"""Customer-agreed contact and handover details, independent of scheduling."""
import re
from rest_framework import serializers


def contact_number(value):
    value = value.strip()
    if not value:
        return ''
    if not re.fullmatch(r'\+?[0-9 ()-]+', value):
        raise serializers.ValidationError('Use a phone number with digits and an optional country code.')
    digits = re.sub(r'\D', '', value)
    if not value.startswith('+') and digits.startswith('0'):
        digits = '60' + digits[1:]
    elif not value.startswith('+') and not digits.startswith('60'):
        raise serializers.ValidationError('Include the country code, for example +60123456789.')
    if not 8 <= len(digits) <= 15 or digits.startswith('0'):
        raise serializers.ValidationError('Enter a valid phone number, for example +60123456789.')
    return '+' + digits


class HandoverInput(serializers.Serializer):
    contact_phone = serializers.CharField(max_length=30, allow_blank=True, default='')
    contact_method = serializers.ChoiceField(choices=['phone', 'whatsapp'], default='phone')
    mode = serializers.ChoiceField(choices=['in_person', 'agreed_place'], default='in_person')
    location = serializers.CharField(max_length=150, allow_blank=True, default='')
    notes = serializers.CharField(max_length=500, allow_blank=True, default='')

    def validate_contact_phone(self, value):
        return contact_number(value)

    def validate(self, data):
        if data['contact_method'] == 'whatsapp' and not data['contact_phone']:
            raise serializers.ValidationError({'contact_phone': 'Add a phone number to choose WhatsApp contact.'})
        if self.context.get('pickup') and data['mode'] != 'in_person':
            raise serializers.ValidationError({'mode': 'Collection is handed to the person collecting.'})
        if data['mode'] == 'agreed_place' and not data['location']:
            raise serializers.ValidationError({'location': 'Specify the place you authorise for this delivery.'})
        if data['mode'] == 'in_person':
            data['location'] = ''
        return data
