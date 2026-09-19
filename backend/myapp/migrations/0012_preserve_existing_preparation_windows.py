from datetime import timedelta
from django.db import migrations


def preserve_windows(apps, schema_editor):
    Order = apps.get_model('myapp','Order')
    Storefront = apps.get_model('myapp','Storefront')
    store=Storefront.objects.filter(pk=1).first()
    buffer=store.delivery_buffer_minutes if store else 90
    for order in Order.objects.filter(preparation_end_at__isnull=True,preparation_at__isnull=False,delivery_at__isnull=False).iterator():
        order.preparation_end_at=max(order.delivery_at-timedelta(minutes=buffer),order.preparation_at+timedelta(minutes=1))
        order.preparation_plan={'legacy':True}
        order.save(update_fields=['preparation_end_at','preparation_plan'])

class Migration(migrations.Migration):
    dependencies=[('myapp','0011_order_preparation_end_at_order_preparation_plan_and_more')]
    operations=[migrations.RunPython(preserve_windows,migrations.RunPython.noop)]
