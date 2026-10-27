"""Email sign-in without renaming historical Django accounts.

User.email is not unique in Django's existing schema. Public account writers
serialize their collision check with the existing single-kitchen lock. Imports
and direct database/admin writes must preserve this rule too; legacy ambiguity
is denied rather than resolved by choosing the first matching user.
"""
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import serializers
from ..models import Storefront


def email_address(value):
    return value.strip().lower()


def lock_account_writes():
    # Call in an atomic block, after any existing user row lock, like checkout.
    # Hash/validate passwords before taking this shared kitchen lock.
    Storefront.objects.get_or_create(pk=1)
    Storefront.objects.select_for_update().get(pk=1)


def require_available_email(email, excluding=None):
    if not email:
        return
    matches = User.objects.filter(Q(email__iexact=email) | Q(username__iexact=email))
    if excluding is not None:
        matches = matches.exclude(pk=excluding)
    if matches.exists():
        raise serializers.ValidationError({'email': 'This email cannot be used for this account. Try signing in or use another email.'})


def login_account(identifier, username_only=False):
    if username_only:
        return User.objects.filter(username=identifier).first()
    matches = list(User.objects.filter(Q(username=identifier) | Q(email__iexact=identifier)).order_by('pk')[:2])
    return matches[0] if len(matches) == 1 else None


def recovery_account(email, username=''):
    matches = User.objects.filter(email__iexact=email)
    if username:
        matches = matches.filter(username=username)
    # Include inactive/unusable accounts in ambiguity detection. Their presence
    # must not silently redirect an email-only request to another account.
    rows = list(matches.order_by('pk')[:2])
    if len(rows) != 1 or not rows[0].is_active or not rows[0].has_usable_password():
        return None
    return rows[0]
