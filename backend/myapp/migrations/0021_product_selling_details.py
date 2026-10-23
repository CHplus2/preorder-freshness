from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('myapp', '0020_fulfilment_options')]
    operations = [migrations.AddField(
        model_name='product', name='selling_details',
        field=models.JSONField(blank=True, db_default={}, default=dict),
    )]
