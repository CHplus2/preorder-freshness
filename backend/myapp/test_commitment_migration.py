from datetime import timedelta
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class CommitmentMigrationTests(TransactionTestCase):
    def test_old_orders_are_labelled_without_invented_historical_costs(self):
        executor=MigrationExecutor(connection)
        latest=executor.loader.graph.leaf_nodes()
        try:
            executor.migrate([('myapp','0014_operatingexpense_inventoryitem_after_open_days_and_more')])
            apps=executor.loader.project_state([('myapp','0014_operatingexpense_inventoryitem_after_open_days_and_more')]).apps
            User=apps.get_model('auth','User');Product=apps.get_model('myapp','Product')
            Material=apps.get_model('myapp','RawMaterial');Recipe=apps.get_model('myapp','ProductIngredient')
            Order=apps.get_model('myapp','Order');Item=apps.get_model('myapp','OrderItem')
            user=User.objects.create(username='migration-buyer')
            product=Product.objects.create(name='Old meal',price=10,packaging_cost=2)
            material=Material.objects.create(name='Old rice',unit='g')
            Recipe.objects.create(product=product,raw_material=material,quantity_required=100)
            pending=Order.objects.create(user=user,total_amount=10,payment_status='paid')
            cooked=Order.objects.create(user=user,total_amount=10,status='delivered',payment_status='refunded',inventory_deducted=True)
            for order in (pending,cooked):Item.objects.create(order=order,product=product,product_name=product.name,quantity=1,unit_price=10,subtotal=10)
            executor=MigrationExecutor(connection);executor.migrate(latest)
            apps=executor.loader.project_state(latest).apps
            Item=apps.get_model('myapp','OrderItem');Payment=apps.get_model('myapp','PaymentEvent')
            Ingredient=apps.get_model('myapp','OrderIngredient');Consumption=apps.get_model('myapp','IngredientConsumption')
            first=Item.objects.get(order_id=pending.pk);second=Item.objects.get(order_id=cooked.pk)
            self.assertEqual(first.recipe_source,'legacy_baseline')
            self.assertEqual(second.recipe_source,'legacy_unknown')
            self.assertIsNone(first.packaging_unit_cost)
            self.assertEqual(Ingredient.objects.filter(order_item_id=first.pk).count(),1)
            self.assertFalse(Ingredient.objects.filter(order_item_id=second.pk).exists())
            self.assertFalse(Consumption.objects.exists())
            self.assertEqual(Payment.objects.filter(source='legacy_unverified').count(),3)
        finally:
            MigrationExecutor(connection).migrate(latest)
