"""Read-only owner setup checks derived from current business records."""
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from ..models import Storefront, Product, InventoryItem
from ..services.scheduling import validate_tasks


@api_view(['GET'])
@permission_classes([IsAdminUser])
def setup_checklist(request):
    store = Storefront.objects.filter(pk=1).first()
    products = list(Product.objects.filter(selling_status='active').prefetch_related('ingredients__raw_material').order_by('pk'))
    missing_recipes, missing_steps, missing_costs = [], [], []
    for product in products:
        ingredients = list(product.ingredients.all())
        if not ingredients or any(i.quantity_required <= 0 for i in ingredients):
            missing_recipes.append(product)
        try:
            steps = validate_tasks(product.preparation_tasks)
        except ValidationError:
            steps = []
        if not steps:
            missing_steps.append(product)
        if product.packaging_cost is None or not ingredients or any(
                i.raw_material.estimated_unit_cost is None for i in ingredients):
            missing_costs.append(product)

    def menu_check(key, title, missing, detail):
        return {'id': key, 'title': title, 'complete': bool(products) and not missing,
            'detail': detail if products else 'Add or resume a menu to start this step.',
            'href': f'/admin/products?review={key}', 'action': {'recipes':'Review menu ingredients', 'preparation':'Review preparation steps', 'costs':'Review menu costs'}[key],
            'affected_count': len(missing),
            'examples': [{'id': p.pk, 'name': p.name} for p in missing[:10]]}

    steps = [
        {'id': 'identity', 'title': 'Introduce your kitchen',
         'complete': bool(store and store.name.strip() and store.tagline.strip() and store.founder_name.strip()),
         'detail': 'Save a kitchen name, introduction and owner name so customers know who prepares their food.',
         'href': '/admin/settings#store-identity', 'action': 'Edit identity'},
        {'id': 'contact', 'title': 'Explain your service area and contact route',
         'complete': bool(store and store.service_area.strip() and (store.contact_email.strip() or store.whatsapp_number.strip())),
         'detail': 'Add a service area and either an email or WhatsApp number. This describes your area; it does not enforce delivery zones.',
         'href': '/admin/settings#store-contact', 'action': 'Edit contact details'},
        menu_check('recipes', 'Record ingredients for every active menu', missing_recipes,
                   'Each menu needs a recipe with positive quantities to support shopping and ingredient deductions.'),
        menu_check('preparation', 'Describe actual preparation steps', missing_steps,
                   'Add explicit tasks, equipment and timings for each menu. Menus without tasks use the simpler fallback schedule.'),
        menu_check('costs', 'Complete menu cost estimates', missing_costs,
                   'Record ingredient unit-cost estimates and packaging costs, including an explicit zero where appropriate. These are estimates; actual order contribution uses batch costs.'),
    ]
    if not store or store.ordering_mode == 'simple':
        steps = [step for step in steps if step['id'] != 'preparation']
    today = timezone.localdate()
    active = InventoryItem.objects.filter(quantity__gt=0, received_date__lte=today)
    usable = active.filter(expiry_date__gte=today, quarantined=False)
    checks = {
        'received_batches': active.count(), 'usable_by_recorded_date': usable.count(),
        'expired_batches': active.filter(expiry_date__lt=today).count(),
        'held_batches': active.filter(quarantined=True).count(),
        'usable_batches_missing_cost': usable.filter(unit_cost__isnull=True).count(),
    }
    qr_status = 'ready' if store and store.manual_payment_enabled and store.duitnow_qr_url else 'missing_image' if not store or not store.duitnow_qr_url else 'disabled'
    return Response({'checked_at': timezone.now(), 'menu_count': len(products),
        'checkout': {'ordering_mode': store.ordering_mode if store else 'simple', 'qr_status': qr_status, 'bank_transfer_ready': bool(store and store.manual_payment_enabled and store.bank_transfer_instructions.strip()),
                     'delivery_area_count': len(store.delivery_areas) if store else 0},
        'completed': sum(int(s['complete']) for s in steps), 'total': len(steps),
        'steps': steps, 'inventory': checks,
        'note': ('New orders need enough received ingredient and packaging stock for the chosen date. Check the saved QR or bank-transfer details before asking customers to pay. Collection needs a receiving QR image. These checks describe recorded setup; they do not verify a bank transfer or food safety.'
                 if not store or store.ordering_mode == 'simple' else
                 'These checks describe recorded setup only. They do not certify food safety, test email or payments, or guarantee production readiness. Future preorders can require procurement even with no stock today.')})
