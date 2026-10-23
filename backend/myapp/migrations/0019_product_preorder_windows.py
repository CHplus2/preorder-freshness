from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('myapp', '0018_product_delivery_weekdays')]

    operations = [
        migrations.AddField(model_name='product', name='delivery_dates',
            field=models.JSONField(blank=True, default=list)),
        migrations.AddField(model_name='product', name='order_cutoff_time',
            field=models.TimeField(blank=True, null=True)),
        migrations.AddField(model_name='product', name='order_cutoff_days_before',
            field=models.PositiveSmallIntegerField(default=1)),
    ]
