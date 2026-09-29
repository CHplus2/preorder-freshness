# FYP source catalog and complete application field declarations

Generated from the inspected repository on 29 September 2026. Companion to `FYP-TECHNICAL-HANDOFF.md`.

Paths in labels are repository-relative; clickable targets point to this local checkout. Source symbols remain useful if the documents are copied elsewhere.

## Complete custom model declarations

There are 18 custom models. All inherit an implicit `id` BigAutoField PK from project/app configuration. FK columns use `_id` suffixes; related names and deletion rules appear below. Declarations preserve exact types, defaults, limits, choices, nullability and explicit Meta constraints. Fields without `null=True` are non-null at the model level; `blank=True` governs validation and is not the same as SQL NULL. Serializer validation is documented separately in the handoff.

### Category

Source: [backend/myapp/models.py::Category](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:8>).

```python
name = models.CharField(max_length=100, unique=True)
created_at = models.DateTimeField(auto_now_add=True)
```

### Product

Source: [backend/myapp/models.py::Product](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:17>).

```python
packaging_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
lead_hours = models.PositiveIntegerField(default=24, validators=[MinValueValidator(1)])
preparation_minutes = models.PositiveIntegerField(default=60, validators=[MinValueValidator(1)])
preparation_tasks = models.JSONField(default=list, blank=True)
max_preparation_days = models.PositiveIntegerField(default=7)
batch_size = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
additional_batch_minutes = models.PositiveIntegerField(default=60, validators=[MinValueValidator(1)])
packing_minutes_per_portion = models.PositiveIntegerField(default=1)
max_early_minutes = models.PositiveIntegerField(default=120)
daily_capacity = models.PositiveIntegerField(default=30, validators=[MinValueValidator(1)])
social_url = models.URLField(blank=True)
name = models.CharField(max_length=200)
description = models.TextField(blank=True)
ai_summary = models.TextField(blank=True)
category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True
    )
price = models.DecimalField(max_digits=10, decimal_places=2)
image_url = models.URLField(blank=True)
created_at = models.DateTimeField(auto_now_add=True)
updated_at = models.DateTimeField(auto_now=True)
```

### RawMaterial

Source: [backend/myapp/models.py::RawMaterial](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:79>).

```python
estimated_unit_cost = models.DecimalField(max_digits=14, decimal_places=6, null=True, blank=True, validators=[MinValueValidator(0)])
UNIT_CHOICES = [
        ("g", "Gram"),
        ("kg", "Kilogram"),
        ("ml", "Millilitre"),
        ("l", "Litre"),
        ("unit", "Unit"),
    ]
name = models.CharField(max_length=100, unique=True)
unit = models.CharField(max_length=10, choices=UNIT_CHOICES)
created_at = models.DateTimeField(auto_now_add=True)
```

### ProductIngredient

Source: [backend/myapp/models.py::ProductIngredient](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:99>).

```python
product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="ingredients"
    )
raw_material = models.ForeignKey(
        RawMaterial,
        on_delete=models.CASCADE,
        related_name="product_ingredients"
    )
quantity_required = models.DecimalField(
        max_digits=10,
        decimal_places=3
    )
class Meta:
        unique_together = ("product", "raw_material")
```

### InventoryItem

Source: [backend/myapp/models.py::InventoryItem](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:129>).

```python
supplier = models.CharField(max_length=160, blank=True)
source_type = models.CharField(max_length=20, choices=[('packaged','Packaged retail'),('market','Wet market / unpackaged'),('other','Other / not recorded')], default='other')
label_date_type = models.CharField(max_length=20, choices=[('use_by','Use by / expiry'),('best_before','Best before'),('not_recorded','Not recorded')], default='not_recorded')
original_expiry_date = models.DateField(null=True, blank=True)
opened_date = models.DateField(null=True, blank=True)
after_open_days = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
thawed_date = models.DateField(null=True, blank=True)
after_thaw_days = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
handling_history = models.CharField(max_length=20, choices=[('not_recorded','Not recorded'),('documented','Storage history documented'),('unknown','Uncertain handling'),('breach','Known storage breach')], default='not_recorded')
handling_note = models.CharField(max_length=500, blank=True)
unit_cost = models.DecimalField(max_digits=14, decimal_places=6, null=True, blank=True, validators=[MinValueValidator(0)])
expiry_basis = models.CharField(max_length=20, choices=[("label", "Printed expiry"), ("manufactured", "Manufacture + shelf life"), ("storage", "Received + storage life")], default="label")
manufactured_date = models.DateField(null=True, blank=True)
shelf_life_days = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
storage_type = models.CharField(max_length=20, choices=[("chilled", "Chilled"), ("frozen", "Frozen"), ("ambient", "Ambient")], default="chilled")
guidance_note = models.CharField(max_length=300, blank=True)
quarantined = models.BooleanField(default=False)
raw_material = models.ForeignKey(
        RawMaterial,
        on_delete=models.PROTECT,
        related_name="inventory_items"
    )
quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3
    )
batch_code = models.CharField(
        max_length=100,
        blank=True
    )
storage_location = models.CharField(
        max_length=200,
        help_text="Example: Fridge A - Top Shelf - Left"
    )
received_date = models.DateField()
expiry_date = models.DateField()
created_at = models.DateTimeField(auto_now_add=True)
updated_at = models.DateTimeField(auto_now=True)
```

### Wallet

Source: [backend/myapp/models.py::Wallet](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:185>).

```python
user = models.OneToOneField(User, on_delete=models.CASCADE)
balance = models.DecimalField(
        max_digits=18,
        decimal_places=10,
        default=0
    )
wallet_address = models.CharField(
        max_length=255,
        unique=True
    )
is_external = models.BooleanField(default=False)
created_at = models.DateTimeField(auto_now_add=True)
updated_at = models.DateTimeField(auto_now=True)
```

### WalletTransaction

Source: [backend/myapp/models.py::WalletTransaction](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:204>).

```python
TRANSACTION_TYPES = [
        ("deposit", "Deposit"),
        ("withdrawal", "Withdrawal"),
        ("payment", "Payment"),
        ("refund", "Refund"),
    ]
wallet = models.ForeignKey(
        Wallet,
        on_delete=models.CASCADE,
        related_name="transactions"
    )
amount = models.DecimalField(
        max_digits=18,
        decimal_places=10
    )
type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPES
    )
reference = models.CharField(
        max_length=255,
        blank=True
    )
created_at = models.DateTimeField(auto_now_add=True)
```

### Address

Source: [backend/myapp/models.py::Address](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:237>).

```python
recipient_name = models.CharField(max_length=150, blank=True)
user = models.ForeignKey(User, on_delete=models.CASCADE)
line1 = models.CharField(max_length=255)
line2 = models.CharField(max_length=255, blank=True)
city = models.CharField(max_length=100)
state = models.CharField(max_length=100)
postal_code = models.CharField(max_length=20)
country = models.CharField(max_length=100, default="Malaysia")
phone = models.CharField(max_length=20)
is_default = models.BooleanField(default=False)
class Meta:
        constraints = [models.UniqueConstraint(fields=['user'], condition=models.Q(is_default=True), name='one_default_address_per_user')]
```

### CartItem

Source: [backend/myapp/models.py::CartItem](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:257>).

```python
user = models.ForeignKey(User, on_delete=models.CASCADE)
product = models.ForeignKey(Product, on_delete=models.CASCADE)
quantity = models.PositiveIntegerField(default=1)
added_at = models.DateTimeField(auto_now_add=True)
class Meta:
        unique_together = ("user", "product")
```

### Order

Source: [backend/myapp/models.py::Order](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:274>).

```python
payment_method = models.CharField(max_length=20, blank=True)
payment_instructions = models.JSONField(default=dict, blank=True)
preparation_end_at = models.DateTimeField(null=True, blank=True)
preparation_plan = models.JSONField(default=dict, blank=True)
delivery_address = models.JSONField(default=dict, blank=True)
delivery_at = models.DateTimeField(null=True, blank=True)
preparation_at = models.DateTimeField(null=True, blank=True)
delivery_method = models.CharField(max_length=20, choices=[("standard", "Owner delivery"), ("express", "Express request")], default="standard")
inventory_deducted = models.BooleanField(default=False)
STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("cooked", "Cooked"),
        ("shipped", "Shipped"),
        ("delivered", "Delivered"),
        ("cancelled", "Cancelled"),
    ]
PAYMENT_STATUS = [
        ("unpaid", "Unpaid"),
        ("paid", "Paid"),
        ("refunded", "Refunded"),
    ]
user = models.ForeignKey(User, on_delete=models.CASCADE)
address = models.ForeignKey(
        Address,
        on_delete=models.SET_NULL,
        null=True
    )
total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
shipping_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )
payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS,
        default="unpaid"
    )
created_at = models.DateTimeField(auto_now_add=True)
updated_at = models.DateTimeField(auto_now=True)
```

### OrderItem

Source: [backend/myapp/models.py::OrderItem](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:341>).

```python
order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items"
    )
product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True
    )
product_name = models.CharField(max_length=200)
unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
quantity = models.PositiveIntegerField()
subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
```

### InventoryLog

Source: [backend/myapp/models.py::InventoryLog](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:376>).

```python
inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.SET_NULL,
        null=True,
        related_name="logs"
    )
change = models.DecimalField(
        max_digits=12,
        decimal_places=3
    )
reason = models.CharField(
        max_length=255,
        blank=True
    )
reference = models.CharField(
        max_length=255,
        blank=True
    )
admin = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True
    )
created_at = models.DateTimeField(auto_now_add=True)
```

### Storefront

Source: [backend/myapp/models.py::Storefront](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:413>).

```python
manual_payment_enabled = models.BooleanField(default=False)
bank_transfer_instructions = models.TextField(blank=True, max_length=1000)
duitnow_qr_url = models.URLField(blank=True)
kitchen_open_hour = models.PositiveSmallIntegerField(default=8)
kitchen_close_hour = models.PositiveSmallIntegerField(default=20)
founder_name = models.CharField(max_length=100, blank=True)
founder_intro = models.CharField(max_length=250, blank=True)
founding_story = models.TextField(blank=True)
food_philosophy = models.TextField(blank=True)
signature_food = models.CharField(max_length=200, blank=True)
service_area = models.CharField(max_length=200, blank=True)
whatsapp_number = models.CharField(max_length=20, blank=True)
founder_image_url = models.URLField(blank=True)
name = models.CharField(max_length=100, default='Dapur Kita')
tagline = models.CharField(max_length=200, default='From our home kitchen to your table.')
story = models.TextField(default='Good food takes a little planning. Preorder your favourites from our home kitchen, and give us time to prepare your meal with care.')
social_url = models.URLField(blank=True)
contact_email = models.EmailField(blank=True)
delivery_buffer_minutes = models.PositiveIntegerField(default=90, validators=[MinValueValidator(1)])
bulk_minimum = models.PositiveIntegerField(default=10, validators=[MinValueValidator(1)])
bulk_discount_percent = models.PositiveIntegerField(default=0)
```

### Review

Source: [backend/myapp/models.py::Review](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:438>).

```python
product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
user = models.ForeignKey(User, on_delete=models.CASCADE)
rating = models.PositiveSmallIntegerField()
comment = models.CharField(max_length=1000)
created_at = models.DateTimeField(auto_now_add=True)
class Meta:
        unique_together = ('product', 'user')
```

### OrderReminder

Source: [backend/myapp/models.py::OrderReminder](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:449>).

```python
order = models.ForeignKey(Order, on_delete=models.CASCADE)
event = models.CharField(max_length=20)
sent_at = models.DateTimeField(auto_now_add=True)
class Meta:
        unique_together = ('order', 'event')
```

### KitchenBlock

Source: [backend/myapp/models.py::KitchenBlock](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:458>).

```python
start_at = models.DateTimeField()
end_at = models.DateTimeField()
reason = models.CharField(max_length=160, default='Kitchen unavailable')
class Meta:
        ordering = ['start_at']
        constraints = [models.CheckConstraint(condition=models.Q(end_at__gt=models.F('start_at')), name='kitchen_block_end_after_start')]
```

### OperatingExpense

Source: [backend/myapp/models.py::OperatingExpense](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:468>).

```python
request_id = models.UUIDField(unique=True)
voided = models.BooleanField(default=False)
date = models.DateField()
category = models.CharField(max_length=20, choices=[('utilities','Utilities'),('delivery','Courier / transport'),('labour','Labour'),('marketing','Marketing'),('other','Other overhead')])
amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
note = models.CharField(max_length=300)
created_at = models.DateTimeField(auto_now_add=True)
```

### WasteRecord

Source: [backend/myapp/models.py::WasteRecord](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:477>).

```python
request_id = models.UUIDField(unique=True)
inventory_item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT)
quantity = models.DecimalField(max_digits=12, decimal_places=3)
estimated_cost = models.DecimalField(max_digits=14, decimal_places=2, null=True)
reason = models.CharField(max_length=300)
created_at = models.DateTimeField(auto_now_add=True)
```

## Python source symbol index

Includes application implementation, management commands, migration functions and tests. Framework-generated methods inherited by DRF generic views/viewsets are not duplicated here.

### build.py

[main](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/build.py:6>).

### backend/config/settings.py

[env_list](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/config/settings.py:64>).

### backend/manage.py

[main](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/manage.py:11>).

### backend/myapp/apps.py

[MyappConfig](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/apps.py:4>).

### backend/myapp/exceptions.py

[api_exception_handler](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/exceptions.py:11>).

### backend/myapp/management/commands/prepare_supabase.py

[Command](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/management/commands/prepare_supabase.py:18>); [Command.handle](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/management/commands/prepare_supabase.py:21>).

### backend/myapp/management/commands/send_order_reminders.py

[Command](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/management/commands/send_order_reminders.py:7>); [Command.add_arguments](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/management/commands/send_order_reminders.py:10>); [Command.handle](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/management/commands/send_order_reminders.py:13>).

### backend/myapp/migrations/0001_initial.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0001_initial.py:8>).

### backend/myapp/migrations/0002_product_ai_summary.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0002_product_ai_summary.py:6>).

### backend/myapp/migrations/0003_wallet_wallettransaction.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0003_wallet_wallettransaction.py:8>).

### backend/myapp/migrations/0004_order_shipping_fee.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0004_order_shipping_fee.py:6>).

### backend/myapp/migrations/0005_inventoryitem_rawmaterial_and_more.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0005_inventoryitem_rawmaterial_and_more.py:7>).

### backend/myapp/migrations/0006_inventoryitem_expiry_basis_and_more.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0006_inventoryitem_expiry_basis_and_more.py:7>); [mark_legacy_orders](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0006_inventoryitem_expiry_basis_and_more.py:92>).

### backend/myapp/migrations/0007_storefront_order_discount_amount_review.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0007_storefront_order_discount_amount_review.py:9>).

### backend/myapp/migrations/0008_orderreminder.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0008_orderreminder.py:7>).

### backend/myapp/migrations/0009_storefront_food_philosophy_and_more.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0009_storefront_food_philosophy_and_more.py:6>).

### backend/myapp/migrations/0010_address_recipient_name_order_delivery_address_and_more.py

[preserve_addresses](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0010_address_recipient_name_order_delivery_address_and_more.py:7>); [Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0010_address_recipient_name_order_delivery_address_and_more.py:22>).

### backend/myapp/migrations/0011_order_preparation_end_at_order_preparation_plan_and_more.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0011_order_preparation_end_at_order_preparation_plan_and_more.py:7>).

### backend/myapp/migrations/0012_preserve_existing_preparation_windows.py

[preserve_windows](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0012_preserve_existing_preparation_windows.py:5>); [Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0012_preserve_existing_preparation_windows.py:15>).

### backend/myapp/migrations/0013_order_payment_instructions_order_payment_method_and_more.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0013_order_payment_instructions_order_payment_method_and_more.py:6>).

### backend/myapp/migrations/0014_operatingexpense_inventoryitem_after_open_days_and_more.py

[Migration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/migrations/0014_operatingexpense_inventoryitem_after_open_days_and_more.py:8>).

### backend/myapp/models.py

[Category](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:8>); [Category.__str__](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:12>); [Product](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:17>); [Product.__str__](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:45>); [Product.get_available_quantity](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:48>); [RawMaterial](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:79>); [RawMaterial.__str__](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:94>); [ProductIngredient](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:99>); [ProductIngredient.__str__](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:120>); [InventoryItem](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:129>); [InventoryItem.__str__](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:176>); [Wallet](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:185>); [Wallet.__str__](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:200>); [WalletTransaction](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:204>); [Address](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:237>); [Address.__str__](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:252>); [CartItem](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:257>); [CartItem.__str__](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:266>); [Order](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:274>); [Order.__str__](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:336>); [OrderItem](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:341>); [OrderItem.__str__](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:368>); [InventoryLog](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:376>); [InventoryLog.__str__](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:407>); [Storefront](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:413>); [Review](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:438>); [OrderReminder](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:449>); [KitchenBlock](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:458>); [OperatingExpense](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:468>); [WasteRecord](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/models.py:477>).

### backend/myapp/serializers.py

[CategorySerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:9>); [RecipeSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:15>); [ProductSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:22>); [ProductSerializer.get_fields](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:23>); [ProductSerializer.get_stock](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:34>); [ProductSerializer.get_freshness](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:45>); [ProductSerializer.validate_preparation_tasks](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:52>); [ProductSerializer.validate_ingredients](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:56>); [ProductSerializer.create](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:81>); [ProductSerializer.update](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:90>); [CartItemSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:102>); [AddressSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:116>); [AddressSerializer.create](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:122>); [OrderItemSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:127>); [OrderSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:133>); [OrderSerializer.get_address](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:136>); [OrderSerializer.get_user](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:145>); [RawMaterialSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:148>); [RawMaterialSerializer.validate_unit](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:149>); [InventoryItemSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:160>); [InventoryItemSerializer.get_days_remaining](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:164>); [InventoryItemSerializer.validate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:168>); [UserSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/serializers.py:224>).

### backend/myapp/services/ai.py

[ai_summarize](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/ai.py:6>).

### backend/myapp/services/forecast.py

[estimate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/forecast.py:2>).

### backend/myapp/services/freshness.py

[inventory_summary](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/freshness.py:2>).

### backend/myapp/services/kitchen_help.py

[local_topic](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/kitchen_help.py:62>); [ai_topic](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/kitchen_help.py:66>).

### backend/myapp/services/recommendation.py

[get_user_top_categories](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/recommendation.py:8>); [get_user_bought_product_ids](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/recommendation.py:29>); [get_user_product_counts](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/recommendation.py:39>); [get_global_product_popularity](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/recommendation.py:52>); [get_score](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/recommendation.py:65>); [handle_recommendation](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/recommendation.py:89>); [recommend_for_user](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/recommendation.py:115>).

### backend/myapp/services/reminders.py

[email_ready](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/reminders.py:9>); [send_due_reminders](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/reminders.py:13>).

### backend/myapp/services/scheduling.py

[validate_tasks](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/scheduling.py:16>); [preparation_work](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/scheduling.py:45>); [order_interval](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/scheduling.py:62>); [booked_tasks](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/scheduling.py:69>); [schedule_order](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/scheduling.py:83>); [plan_snapshot](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/services/scheduling.py:150>).

### backend/myapp/test_costs_freshness.py

[CostsAndFreshnessTests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_costs_freshness.py:11>); [CostsAndFreshnessTests.setUp](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_costs_freshness.py:12>); [CostsAndFreshnessTests.test_costs_and_unknowns](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_costs_freshness.py:21>); [CostsAndFreshnessTests.test_waste_deducts_once_and_preserves_cost](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_costs_freshness.py:28>); [CostsAndFreshnessTests.test_waste_overdraw_rejected](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_costs_freshness.py:37>); [CostsAndFreshnessTests.test_expense_retry_and_void](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_costs_freshness.py:42>); [CostsAndFreshnessTests.test_earliest_deadline_and_original_preserved](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_costs_freshness.py:51>); [CostsAndFreshnessTests.test_uncertain_storage_forces_hold](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_costs_freshness.py:61>); [CostsAndFreshnessTests.test_event_requires_duration_and_evidence](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_costs_freshness.py:65>); [CostsAndFreshnessTests.test_owner_only_and_private_cost](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_costs_freshness.py:71>).

### backend/myapp/test_freshness.py

[FreshnessSummaryTests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_freshness.py:6>); [FreshnessSummaryTests.lot](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_freshness.py:7>); [FreshnessSummaryTests.test_remaining_is_calculated_from_dates](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_freshness.py:14>); [FreshnessSummaryTests.test_manufactured_uses_manufacturing_start](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_freshness.py:18>); [FreshnessSummaryTests.test_held_and_expired_are_not_hidden](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_freshness.py:23>); [FreshnessSummaryTests.test_unknown_and_empty_do_not_invent_scores](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_freshness.py:30>); [FreshnessSummaryTests.test_empty_inventory](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_freshness.py:37>).

### backend/myapp/test_help.py

[KitchenHelpTests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:11>); [KitchenHelpTests.setUp](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:12>); [KitchenHelpTests.ask](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:16>); [KitchenHelpTests.test_languages_and_no_key_fallback](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:19>); [KitchenHelpTests.test_multilingual_detection](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:29>); [KitchenHelpTests.test_external_ai_requires_consent_and_is_skipped_for_known_topics](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:34>); [KitchenHelpTests.test_budgets_are_calculated_from_database_not_model](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:43>); [KitchenHelpTests.test_orders_return_navigation_not_private_data](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:53>); [KitchenHelpTests.test_invalid_inputs](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:59>); [KitchenHelpTests.test_throttles_repeated_requests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:65>); [KitchenHelpTests.test_provider_timeout_and_untrusted_output_fall_back](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:72>); [KitchenHelpTests.test_provider_only_receives_redacted_question_and_fixed_prompt](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_help.py:85>).

### backend/myapp/test_integrations.py

[IntegrationTests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_integrations.py:10>); [IntegrationTests.setUp](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_integrations.py:11>); [IntegrationTests.checkout](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_integrations.py:19>); [IntegrationTests.test_disabled_manual_payment_rejected](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_integrations.py:25>); [IntegrationTests.test_manual_payment_stays_unpaid_and_snapshots_details](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_integrations.py:29>); [IntegrationTests.test_empty_payment_setup_rejected](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_integrations.py:42>); [IntegrationTests.test_reminder_trigger_requires_secret](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_integrations.py:47>); [IntegrationTests.test_reminder_status_is_owner_only](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_integrations.py:52>); [IntegrationTests.test_due_reminders_deduplicated_and_bounded](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_integrations.py:57>); [IntegrationTests.test_failed_email_can_retry_without_false_receipt](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_integrations.py:67>); [IntegrationTests.test_stale_and_cancelled_orders_are_not_notified](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_integrations.py:73>).

### backend/myapp/test_inventory_audit.py

[InventoryAuditTests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_inventory_audit.py:11>); [InventoryAuditTests.setUp](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_inventory_audit.py:12>); [InventoryAuditTests.patch](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_inventory_audit.py:19>); [InventoryAuditTests.test_stale_edit_cannot_restore_consumed_stock](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_inventory_audit.py:24>); [InventoryAuditTests.test_missing_or_invalid_version_rejected](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_inventory_audit.py:33>); [InventoryAuditTests.test_fresh_edit_accepted_and_version_advanced](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_inventory_audit.py:40>); [InventoryAuditTests.test_inventory_list_query_count_does_not_grow_with_batches](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_inventory_audit.py:48>); [InventoryAuditTests.test_sales_endpoint_retains_totals_without_operational_payload](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_inventory_audit.py:60>); [InventoryAuditTests.test_sales_endpoint_requires_owner](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_inventory_audit.py:72>).

### backend/myapp/test_menu.py

[MenuPaginationTests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_menu.py:5>); [MenuPaginationTests.setUpTestData](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_menu.py:7>); [MenuPaginationTests.test_pages_are_bounded_stable_and_complete](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_menu.py:13>); [MenuPaginationTests.test_filters_apply_before_pagination](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_menu.py:24>); [MenuPaginationTests.test_invalid_page_and_category](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_menu.py:31>).

### backend/myapp/test_planning.py

[PlanningTests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:16>); [PlanningTests.setUp](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:17>); [PlanningTests.product](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:25>); [PlanningTests.item](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:27>); [PlanningTests.task](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:29>); [PlanningTests.book](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:31>); [PlanningTests.test_bulk_duration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:35>); [PlanningTests.test_distinct_unattended_resources_overlap](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:39>); [PlanningTests.test_same_equipment_cannot_overlap](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:43>); [PlanningTests.test_worker_cannot_overlap_different_equipment](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:47>); [PlanningTests.test_multiday_rest_dependencies](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:51>); [PlanningTests.test_block_rejects_booking_without_cancelling](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:58>); [PlanningTests.test_quote_capacity](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:62>); [PlanningTests.test_block_protected_by_permission_and_existing_order](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:66>); [PlanningTests.test_task_validation](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:73>); [PlanningTests.test_invalid_ids_and_dates_are_client_errors](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:77>); [PlanningTests.test_database_failure_does_not_leak_details](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:81>); [PlanningTests.test_planner_queries_do_not_grow_per_order](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:86>); [PlanningTests.test_review_eligibility](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:94>); [PlanningTests.test_forecast_sparse_and_trend](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:101>); [PlanningTests.test_quote_is_advisory_and_snapshot_is_immutable](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:108>); [PlanningTests.test_shortages_exclude_batch_expiring_during_multiday_preparation](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:121>); [PlanningTests.test_owner_preview_and_confirm_existing_order](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:133>); [PlanningTests.test_replan_rejects_stale_preview_or_started_order](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:147>); [PlanningTests.test_replan_requires_menu_steps](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:159>); [PlanningTests.test_planner_exposes_setup_and_hours](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/test_planning.py:165>).

### backend/myapp/tests.py

[KitchenTests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:10>); [KitchenTests.setUp](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:11>); [KitchenTests.batch](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:23>); [KitchenTests.order](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:26>); [KitchenTests.test_expiry_sources](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:31>); [KitchenTests.test_missing_guidance_rejected](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:39>); [KitchenTests.test_negative_batch_rejected](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:43>); [KitchenTests.test_available_excludes_expired_and_held](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:47>); [KitchenTests.test_cooking_fefo_and_idempotence](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:53>); [KitchenTests.test_shortage_rolls_back_every_deduction](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:67>); [KitchenTests.test_invalid_transition](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:76>); [KitchenTests.checkout](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:80>); [KitchenTests.test_preorder_does_not_deduct](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:85>); [KitchenTests.test_early_delivery_rejected](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:92>); [KitchenTests.test_capacity_enforced](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:97>); [KitchenTests.test_bulk_discount](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:102>); [KitchenTests.test_private_inventory](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:110>); [KitchenTests.test_verified_reviews](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:115>); [KitchenTests.test_shopping_does_not_double_allocate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:124>); [KitchenTests.test_recipe_validation](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:132>); [KitchenTests.test_settings_permission_and_discount_bounds](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:136>); [KitchenTests.test_reminders_preview_and_deduplication](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:141>); [KitchenTests.test_recommendation_cold_start](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:158>); [KitchenTests.test_used_material_unit_and_delete_protected](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:165>); [BrowserCartTests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:171>); [BrowserCartTests.test_authenticated_cart_from_vite_loopback_origin](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:172>); [BrowserCartTests.test_untrusted_origin_still_rejected](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:182>); [BrowserCartTests.test_bootstrap_sets_csrf_cookie](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:190>); [BrowserCartTests.test_business_story_roundtrip](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:195>); [BrowserCartTests.test_public_routes_resolve_to_spa](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:203>); [SavedAddressTests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:210>); [SavedAddressTests.setUp](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:211>); [SavedAddressTests.test_repeated_save_updates_single_address](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:217>); [SavedAddressTests.test_other_customer_cannot_read_or_overwrite_address](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:226>); [SavedAddressTests.test_order_snapshot_survives_saved_address_edit](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:236>); [SavedAddressTests.test_anonymous_address_access_denied](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/tests.py:248>).

### backend/myapp/views/admin.py

[admin_order_list](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/admin.py:15>); [admin_order_detail](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/admin.py:23>); [product_sales_report](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/admin.py:60>); [AdminCustomerViewSet](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/admin.py:76>); [admin_customers_list](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/admin.py:83>); [admin_customer_update](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/admin.py:90>).

### backend/myapp/views/auth.py

[signup_view](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/auth.py:9>); [login_view](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/auth.py:31>); [logout_view](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/auth.py:42>); [check_auth](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/auth.py:47>).

### backend/myapp/views/cart.py

[CartViewSet](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/cart.py:9>); [CartViewSet.list](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/cart.py:12>); [CartViewSet.create](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/cart.py:18>); [CartViewSet.partial_update](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/cart.py:46>); [CartViewSet.destroy](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/cart.py:71>).

### backend/myapp/views/costs.py

[ExpenseSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/costs.py:15>); [ExpenseSerializer.validate_date](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/costs.py:21>); [WasteInput](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/costs.py:26>); [expenses](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/costs.py:34>); [void_expense](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/costs.py:49>); [record_waste](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/costs.py:58>); [cost_report](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/costs.py:78>).

### backend/myapp/views/help.py

[HelpThrottle](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/help.py:12>); [HelpThrottle.get_cache_key](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/help.py:15>); [HelpInput](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/help.py:20>); [HelpInput.validate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/help.py:29>); [KitchenHelp](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/help.py:35>); [KitchenHelp.get](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/help.py:39>); [KitchenHelp.post](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/help.py:42>).

### backend/myapp/views/inventory.py

[IsAdminOrReadOnly](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/inventory.py:11>); [IsAdminOrReadOnly.has_permission](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/inventory.py:12>); [RawMaterialListCreate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/inventory.py:22>); [RawMaterialDetail](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/inventory.py:28>); [RawMaterialDetail.perform_destroy](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/inventory.py:29>); [InventoryItemListCreate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/inventory.py:43>); [InventoryItemDetail](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/inventory.py:49>); [InventoryItemDetail.update](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/inventory.py:51>); [InventoryItemDetail.perform_destroy](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/inventory.py:66>).

### backend/myapp/views/kitchen.py

[BlockSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/kitchen.py:10>); [BlockSerializer.validate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/kitchen.py:14>); [kitchen_blocks](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/kitchen.py:22>); [kitchen_block_detail](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/kitchen.py:39>); [review_order_plan](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/kitchen.py:49>).

### backend/myapp/views/orders.py

[OrderList](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/orders.py:19>); [OrderList.get_queryset](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/orders.py:23>); [deduct_inventory](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/orders.py:26>); [place_order](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/orders.py:82>); [AddressListCreate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/orders.py:195>); [AddressListCreate.get_queryset](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/orders.py:199>); [saved_address](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/orders.py:206>); [preparation_quote](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/orders.py:220>).

### backend/myapp/views/planning.py

[planning](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/planning.py:17>); [sales_summary](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/planning.py:59>); [sales_analytics](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/planning.py:88>).

### backend/myapp/views/products.py

[IsAdminOrReadOnly](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/products.py:13>); [IsAdminOrReadOnly.has_permission](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/products.py:14>); [CategoryListCreate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/products.py:24>); [CategoryDetail](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/products.py:30>); [ProductListCreate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/products.py:40>); [ProductDetail](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/products.py:46>); [recommend](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/products.py:58>); [MenuPagination](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/products.py:66>); [MenuCardSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/products.py:69>); [MenuList](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/products.py:76>); [MenuList.get_queryset](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/products.py:81>).

### backend/myapp/views/reminders.py

[reminder_status](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/reminders.py:10>); [run_reminders](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/reminders.py:17>).

### backend/myapp/views/storefront.py

[StoreSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/storefront.py:10>); [StoreSerializer.validate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/storefront.py:11>); [StoreSerializer.validate_whatsapp_number](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/storefront.py:23>); [storefront](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/storefront.py:34>); [ReviewSerializer](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/storefront.py:44>); [reviews](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/storefront.py:53>); [review_access](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/storefront.py:70>); [inventory_freshness](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/storefront.py:81>).

### backend/myapp/views/wallet.py

[get_wallet](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/wallet.py:11>); [create_wallet](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/wallet.py:25>); [topup_wallet](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/views/wallet.py:45>).

### tests/test_vercel_entrypoint.py

[EntrypointTests](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/tests/test_vercel_entrypoint.py:10>); [EntrypointTests.test_vercel_file_import_and_frontend_routes](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/tests/test_vercel_entrypoint.py:11>).

## Frontend component/function source index

Names and locations are extracted from declarations; existence in this index alone does not imply a component is routed or a function is called. The handoff distinguishes active and legacy paths.

- frontend/src/App.jsx: [AnimatedRoutes](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/App.jsx:41>); [AppContent](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/App.jsx:185>); [closeMenu](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/App.jsx:194>); [AppProvider](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/App.jsx:267>); [App](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/App.jsx:283>).
- frontend/src/components/BusinessLayout.jsx: [Reveal](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/BusinessLayout.jsx:7>); [PageMeta](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/BusinessLayout.jsx:11>); [PrimaryLink](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/BusinessLayout.jsx:20>); [FAQ](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/BusinessLayout.jsx:30>); [BusinessFooter](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/BusinessLayout.jsx:34>).
- frontend/src/components/CostPanel.jsx: [money](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/CostPanel.jsx:6>); [CostPanel](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/CostPanel.jsx:7>); [mutate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/CostPanel.jsx:16>).
- frontend/src/components/DeleteProductModal/DeleteProduct.jsx: [DeleteProduct](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/DeleteProductModal/DeleteProduct.jsx:8>).
- frontend/src/components/DialogFeedback.jsx: [DialogFeedback](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/DialogFeedback.jsx:5>).
- frontend/src/components/ExpiryFields.jsx: [ExpiryFields](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/ExpiryFields.jsx:1>); [set](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/ExpiryFields.jsx:2>).
- frontend/src/components/InventoryFreshness.jsx: [InventoryFreshness](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/InventoryFreshness.jsx:3>).
- frontend/src/components/KitchenAvailability.jsx: [KitchenAvailability](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/KitchenAvailability.jsx:5>); [save](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/KitchenAvailability.jsx:8>); [remove](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/KitchenAvailability.jsx:9>).
- frontend/src/components/KitchenHelp.jsx: [KitchenHelp](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/KitchenHelp.jsx:14>); [close](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/KitchenHelp.jsx:29>); [reset](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/KitchenHelp.jsx:30>); [ask](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/KitchenHelp.jsx:31>).
- frontend/src/components/KitchenStory.jsx: [KitchenHero](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/KitchenStory.jsx:3>); [KitchenFooter](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/KitchenStory.jsx:9>).
- frontend/src/components/LoginModal/GroceryLogin.jsx: [GroceryLogin](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/LoginModal/GroceryLogin.jsx:8>); [handleChange](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/LoginModal/GroceryLogin.jsx:18>); [handleSubmit](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/LoginModal/GroceryLogin.jsx:22>).
- frontend/src/components/ManualPayment.jsx: [ManualPayment](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/ManualPayment.jsx:1>).
- frontend/src/components/MenuPhotoField.jsx: [MenuPhotoField](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/MenuPhotoField.jsx:4>).
- frontend/src/components/MenuReviews.jsx: [MenuReviews](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/MenuReviews.jsx:6>); [submit](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/MenuReviews.jsx:10>).
- frontend/src/components/ModalDialog.jsx: [ModalDialog](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/ModalDialog.jsx:5>).
- frontend/src/components/PageLoading.jsx: [PageLoading](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/PageLoading.jsx:2>).
- frontend/src/components/PlannerCalendar.jsx: [PlannerCalendar](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/PlannerCalendar.jsx:2>); [changeMonth](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/PlannerCalendar.jsx:17>).
- frontend/src/components/PlanReview.jsx: [when](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/PlanReview.jsx:5>); [PlanReview](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/PlanReview.jsx:6>); [request](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/PlanReview.jsx:8>).
- frontend/src/components/PreparationTasks.jsx: [PreparationTasks](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/PreparationTasks.jsx:3>); [change](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/PreparationTasks.jsx:5>); [update](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/PreparationTasks.jsx:6>); [move](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/PreparationTasks.jsx:7>).
- frontend/src/components/RecipeEditor.jsx: [RecipeEditor](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/RecipeEditor.jsx:5>); [update](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/RecipeEditor.jsx:9>).
- frontend/src/components/ReminderStatus.jsx: [ReminderStatus](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/ReminderStatus.jsx:3>).
- frontend/src/components/SignupModal/GrocerySignup.jsx: [GrocerySignup](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/SignupModal/GrocerySignup.jsx:8>); [handleChange](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/SignupModal/GrocerySignup.jsx:21>); [handleSubmit](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/components/SignupModal/GrocerySignup.jsx:25>).
- frontend/src/contexts/AuthProvider.jsx: [useAuth](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/AuthProvider.jsx:9>); [AuthProvider](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/AuthProvider.jsx:11>); [signup](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/AuthProvider.jsx:35>); [login](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/AuthProvider.jsx:53>); [logout](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/AuthProvider.jsx:70>).
- frontend/src/contexts/CartProvider.jsx: [useCart](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/CartProvider.jsx:11>); [CartProvider](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/CartProvider.jsx:21>); [addToCart](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/CartProvider.jsx:109>); [removeFromCart](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/CartProvider.jsx:133>); [updateQuantity](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/CartProvider.jsx:148>).
- frontend/src/contexts/OrderProvider.jsx: [useOrder](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/OrderProvider.jsx:9>); [OrderProvider](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/OrderProvider.jsx:11>); [updateOrder](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/OrderProvider.jsx:61>).
- frontend/src/contexts/ProductProvider.jsx: [useProduct](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/ProductProvider.jsx:11>); [ProductProvider](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/ProductProvider.jsx:13>); [addProduct](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/ProductProvider.jsx:73>); [updateProduct](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/ProductProvider.jsx:91>); [deleteProduct](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/ProductProvider.jsx:108>).
- frontend/src/contexts/StorefrontProvider.jsx: [useStorefront](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/StorefrontProvider.jsx:4>); [StorefrontProvider](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/StorefrontProvider.jsx:5>); [load](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/StorefrontProvider.jsx:10>).
- frontend/src/contexts/UIProvider.jsx: [useUI](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/UIProvider.jsx:4>); [UIProvider](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/UIProvider.jsx:6>); [formatOrderNumber](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/UIProvider.jsx:22>); [convertToUSD](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/UIProvider.jsx:26>); [formatPrice](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/contexts/UIProvider.jsx:30>).
- frontend/src/hoc/RequireAuth.jsx: [RequireAuth](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/hoc/RequireAuth.jsx:6>).
- frontend/src/pages/admin/AdminCustomersPage.jsx: [AdminCustomersPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminCustomersPage.jsx:6>); [toggle](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminCustomersPage.jsx:9>).
- frontend/src/pages/admin/AdminInventoryPage.jsx: [AdminInventoryPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:26>); [getAuthConfig](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:49>); [fetchRawMaterials](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:56>); [fetchInventoryItems](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:69>); [getFreshnessStatus](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:122>); [handleCreateRawMaterial](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:182>); [handleUpdateRawMaterial](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:211>); [handleDeleteRawMaterial](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:238>); [handleCreateInventory](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:259>); [handleUpdateInventory](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:283>); [handleDeleteInventory](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:307>); [getUnit](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminInventoryPage.jsx:326>).
- frontend/src/pages/admin/AdminOrdersPage.jsx: [AdminOrdersPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminOrdersPage.jsx:8>); [startEdit](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminOrdersPage.jsx:21>); [saveEdit](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminOrdersPage.jsx:27>).
- frontend/src/pages/admin/AdminProductsPage.jsx: [AdminProductsPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminProductsPage.jsx:10>); [validateInput](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminProductsPage.jsx:40>); [handleAddProduct](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminProductsPage.jsx:48>); [handleUpdateProduct](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminProductsPage.jsx:62>).
- frontend/src/pages/admin/AdminReportsPage.jsx: [AdminReportsPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/AdminReportsPage.jsx:6>).
- frontend/src/pages/admin/PlannerPage.jsx: [time](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/PlannerPage.jsx:9>); [full](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/PlannerPage.jsx:10>); [stamp](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/PlannerPage.jsx:11>); [PlannerPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/PlannerPage.jsx:12>); [openReview](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/PlannerPage.jsx:17>); [refresh](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/PlannerPage.jsx:20>); [move](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/PlannerPage.jsx:21>); [exportCalendar](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/PlannerPage.jsx:22>).
- frontend/src/pages/admin/StoreSettingsPage.jsx: [StoreSettingsPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/StoreSettingsPage.jsx:13>); [save](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/StoreSettingsPage.jsx:16>); [fields](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/admin/StoreSettingsPage.jsx:17>).
- frontend/src/pages/customer/BusinessPages.jsx: [HomePage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/BusinessPages.jsx:7>); [Steps](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/BusinessPages.jsx:23>); [StoryPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/BusinessPages.jsx:24>); [HowItWorksPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/BusinessPages.jsx:28>); [ContactPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/BusinessPages.jsx:29>).
- frontend/src/pages/customer/CartPage.jsx: [CartPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/CartPage.jsx:8>).
- frontend/src/pages/customer/CheckoutPage.jsx: [CheckoutPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/CheckoutPage.jsx:14>); [localInput](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/CheckoutPage.jsx:22>); [checkPlan](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/CheckoutPage.jsx:25>); [saveAddress](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/CheckoutPage.jsx:26>); [submit](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/CheckoutPage.jsx:27>).
- frontend/src/pages/customer/EscrowDemoPage.jsx: [fund](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:7>); [deals](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:8>); [credits](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:9>); [dispatch](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:10>); [confirmReceipt](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:10>); [refund](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:10>); [dispute](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:11>); [resolve](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:11>); [withdraw](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:11>); [EscrowDemoPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:15>); [connection](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:21>); [load](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:31>); [perform](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:35>); [transact](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/EscrowDemoPage.jsx:41>).
- frontend/src/pages/customer/OrdersPage.jsx: [OrdersPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/OrdersPage.jsx:8>).
- frontend/src/pages/customer/PaymentPage.jsx: [PaymentPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/PaymentPage.jsx:8>); [handlePay](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/PaymentPage.jsx:28>); [handleSubmit](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/PaymentPage.jsx:43>).
- frontend/src/pages/customer/ProductDetailPage.jsx: [ProductDetailPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/ProductDetailPage.jsx:11>); [ProductContent](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/ProductDetailPage.jsx:32>).
- frontend/src/pages/customer/ProductsPage.jsx: [ProductsPage](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/ProductsPage.jsx:13>); [update](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/ProductsPage.jsx:24>); [scrollRecommendations](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/ProductsPage.jsx:29>); [changeFilter](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/ProductsPage.jsx:47>); [showInventory](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/pages/customer/ProductsPage.jsx:49>).
- frontend/src/utils/apiError.js: [apiError](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/utils/apiError.js:1>); [flatten](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/utils/apiError.js:10>).
- frontend/src/utils/cookieUtils.jsx: [getCookie](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/utils/cookieUtils.jsx:1>).
- frontend/src/utils/planner.js: [malaysiaDate](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/utils/planner.js:1>); [duration](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/utils/planner.js:2>); [overlap](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/utils/planner.js:3>); [unionMinutes](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/utils/planner.js:4>); [dailyWork](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/utils/planner.js:9>); [blocks](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/utils/planner.js:19>).
- frontend/src/utils/planner.test.js: [task](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/utils/planner.test.js:5>); [plan](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/utils/planner.test.js:6>).

## Routing, configuration, prototype and evaluation source files

- [backend/myapp/urls.py](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/urls.py:1>)
- [backend/config/urls.py](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/config/urls.py:1>)
- [backend/config/settings.py](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/config/settings.py:1>)
- [backend/myapp/apps.py](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/myapp/apps.py:1>)
- [frontend/src/App.jsx](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/App.jsx:1>)
- [frontend/src/main.jsx](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/src/main.jsx:1>)
- [frontend/package.json](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/package.json:1>)
- [frontend/vite.config.js](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/vite.config.js:1>)
- [frontend/eslint.config.js](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/frontend/eslint.config.js:1>)
- [pyproject.toml](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/pyproject.toml:1>)
- [requirements.txt](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/requirements.txt:1>)
- [backend/requirements.txt](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/backend/requirements.txt:1>)
- [vercel.json](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/vercel.json:1>)
- [escrow/PreorderEscrow.sol](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/escrow/PreorderEscrow.sol:1>)
- [escrow/escrow.test.mjs](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/escrow/escrow.test.mjs:1>)
- [escrow/compile.mjs](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/escrow/compile.mjs:1>)
- [escrow/package.json](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/escrow/package.json:1>)
- [docs/TESTING.md](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/docs/TESTING.md:1>)
- [docs/PREPARATION-PLANNING.md](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/docs/PREPARATION-PLANNING.md:1>)
- [docs/OPERATIONS-AND-FEATURE-STATUS.md](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/docs/OPERATIONS-AND-FEATURE-STATUS.md:1>)
- [docs/AUDIT-2026-09-28.md](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/docs/AUDIT-2026-09-28.md:1>)
- [docs/KITCHEN-HELP.md](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/docs/KITCHEN-HELP.md:1>)
- [DEPLOYMENT.md](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/DEPLOYMENT.md:1>)
- [.github/workflows/checks.yml](<C:/Users/DELL/Documents/IT Personal Projects/preorder-freshness/.github/workflows/checks.yml:1>)

## Built-in Django User fields (runtime metadata; no database query)

Source: Django 6.0.3 `django.contrib.auth.models.User` / `AbstractUser` / `AbstractBaseUser` / `PermissionsMixin`; referenced in `backend/myapp/models.py`. The built-in table is `auth_user`. This is framework schema metadata, not observed user data.

- `id`: AutoField; column `id`; primary_key=True; null=False; blank=True; unique=True; max_length=None.
- `password`: CharField; column `password`; primary_key=False; null=False; blank=False; unique=False; max_length=128.
- `last_login`: DateTimeField; column `last_login`; primary_key=False; null=True; blank=True; unique=False; max_length=None.
- `is_superuser`: BooleanField; column `is_superuser`; primary_key=False; null=False; blank=False; unique=False; max_length=None.
- `username`: CharField; column `username`; primary_key=False; null=False; blank=False; unique=True; max_length=150.
- `first_name`: CharField; column `first_name`; primary_key=False; null=False; blank=True; unique=False; max_length=150.
- `last_name`: CharField; column `last_name`; primary_key=False; null=False; blank=True; unique=False; max_length=150.
- `email`: CharField; column `email`; primary_key=False; null=False; blank=True; unique=False; max_length=254.
- `is_staff`: BooleanField; column `is_staff`; primary_key=False; null=False; blank=False; unique=False; max_length=None.
- `is_active`: BooleanField; column `is_active`; primary_key=False; null=False; blank=False; unique=False; max_length=None.
- `date_joined`: DateTimeField; column `date_joined`; primary_key=False; null=False; blank=False; unique=False; max_length=None.
- `groups`: many-to-many to `auth.Group`, through `auth_user_groups`.
- `user_permissions`: many-to-many to `auth.Permission`, through `auth_user_user_permissions`.
