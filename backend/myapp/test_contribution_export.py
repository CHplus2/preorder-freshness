import csv
import io
from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Order, OrderItem, Product, RawMaterial, ProductIngredient, InventoryItem, IngredientConsumption


class ContributionExportTests(TestCase):
    def setUp(self):
        self.owner=User.objects.create_user('owner',is_staff=True)
        self.buyer=User.objects.create_user('private-customer',email='private@example.test')
        self.client=APIClient();self.client.force_authenticate(self.owner)
        self.url='/api/admin/contribution/export/'

    def rows(self,response):
        return list(csv.DictReader(io.StringIO(response.content.decode('utf-8-sig'))))

    def test_permissions(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self.url).status_code,[401,403])
        self.client.force_authenticate(self.buyer)
        self.assertEqual(self.client.get(self.url).status_code,403)

    def test_empty_export_has_headers_and_download_metadata(self):
        response=self.client.get(self.url)
        self.assertEqual(response.status_code,200)
        self.assertEqual(self.rows(response),[])
        self.assertIn('attachment;',response['Content-Disposition'])
        self.assertEqual(response['Cache-Control'],'private, no-store')
        self.assertIn('food_contribution',response.content.decode())

    def test_all_matching_orders_export_beyond_dashboard_limit(self):
        Order.objects.bulk_create([Order(user=self.buyer) for _ in range(205)])
        response=self.client.get(self.url)
        self.assertEqual(len(self.rows(response)),205)
        self.assertNotIn('private-customer',response.content.decode())
        self.assertNotIn('private@example.test',response.content.decode())
        self.assertTrue(all(r['food_contribution']=='' for r in self.rows(response)))

    def test_oversized_export_rejected_instead_of_truncated(self):
        Order.objects.bulk_create([Order(user=self.buyer) for _ in range(5001)])
        response=self.client.get(self.url)
        self.assertEqual(response.status_code,400)
        self.assertIn('shorter date range',str(response.data))

    def test_date_validation_and_cohort(self):
        today=timezone.localdate()
        order=Order.objects.create(user=self.buyer)
        Order.objects.filter(pk=order.pk).update(created_at=timezone.now()-timedelta(days=100))
        self.assertEqual(self.rows(self.client.get(self.url)),[])
        for query in [{'start':'bad'}, {'start':str(today),'end':str(today-timedelta(days=1))},
                      {'start':str(today-timedelta(days=400)),'end':str(today)}]:
            self.assertEqual(self.client.get(self.url,query).status_code,400)

    def test_csv_formula_text_is_escaped_and_missing_stays_unknown(self):
        product=Product.objects.create(name='=HYPERLINK("bad"),\nmenu',price=12)
        order=Order.objects.create(user=self.buyer,status='delivered',payment_status='paid')
        OrderItem.objects.create(order=order,product=product,product_name=product.name,unit_price=12,subtotal=12,quantity=1)
        row=self.rows(self.client.get(self.url))[0]
        self.assertTrue(row['missing_data'].startswith("'="))
        self.assertEqual(row['food_contribution'],'')
        self.assertIn('\nmenu',row['missing_data'])

    def test_realised_contribution_matches_dashboard_and_cooked_loss(self):
        material=RawMaterial.objects.create(name='Rice',unit='g')
        product=Product.objects.create(name='Lunch',price=12,packaging_cost=1)
        ProductIngredient.objects.create(product=product,raw_material=material,quantity_required=100)
        batch=InventoryItem.objects.create(raw_material=material,quantity=0,
            received_date=timezone.localdate(),expiry_date=timezone.localdate()+timedelta(days=1),unit_cost='0.02')
        order=Order.objects.create(user=self.buyer,status='delivered',payment_status='paid',total_amount=12,inventory_deducted=True)
        item=OrderItem.objects.create(order=order,product=product,product_name=product.name,unit_price=12,subtotal=12,quantity=1)
        IngredientConsumption.objects.create(order_item=item,inventory_item=batch,material_name='Rice',unit='g',quantity=100,unit_cost='0.02',recorded_expiry=batch.expiry_date)
        row=self.rows(self.client.get(self.url))[0]
        self.assertEqual(row['food_contribution'],'9.00')
        self.assertEqual(row['currency'],'MYR')
        self.assertTrue(row['placed_at_malaysia'].endswith('+08:00'))
        self.assertEqual(row['food_contribution'],self.client.get('/api/admin/contribution/').data['rows'][0]['food_contribution'])
        order.status='cancelled';order.save()
        self.assertEqual(self.rows(self.client.get(self.url))[0]['food_contribution'],'-3.00')
