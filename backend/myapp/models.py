from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.validators import MinValueValidator


# ============ CATEGORY ============
class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


# ============ PRODUCT / MENU ============
class Product(models.Model):
    lead_hours = models.PositiveIntegerField(default=24, validators=[MinValueValidator(1)])
    preparation_minutes = models.PositiveIntegerField(default=60, validators=[MinValueValidator(1)])
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

    def __str__(self):
        return self.name

    def get_available_quantity(self):
        """
        Calculate how many units of this product can currently
        be produced based on available raw materials.
        """

        ingredients = self.ingredients.select_related("raw_material")

        if not ingredients.exists():
            return 0

        available_quantities = []

        for ingredient in ingredients:
            total_stock = InventoryItem.objects.filter(
                raw_material=ingredient.raw_material,
                quantity__gt=0,
                expiry_date__gte=timezone.localdate(),
                received_date__lte=timezone.localdate(),
                quarantined=False
            ).aggregate(
                total=models.Sum("quantity")
            )["total"] or 0

            possible_units = total_stock // ingredient.quantity_required if ingredient.quantity_required > 0 else 0
            available_quantities.append(possible_units)

        return min(available_quantities)


# ============ RAW MATERIAL ============
class RawMaterial(models.Model):
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

    def __str__(self):
        return f"{self.name} ({self.unit})"


# ============ PRODUCT INGREDIENT / RECIPE ============
class ProductIngredient(models.Model):
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

    def __str__(self):
        return (
            f"{self.product.name} - "
            f"{self.raw_material.name}: "
            f"{self.quantity_required}{self.raw_material.unit}"
        )


# ============ INVENTORY ITEM / BATCH ============
class InventoryItem(models.Model):
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

    def __str__(self):
        return (
            f"{self.raw_material.name} - "
            f"{self.quantity}{self.raw_material.unit} - "
            f"Expires {self.expiry_date}"
        )


# ============ WALLET ============
class Wallet(models.Model):
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

    def __str__(self):
        return f"{self.user.username}'s Wallet - Balance: {self.balance}"


class WalletTransaction(models.Model):
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


# ============ USER ADDRESSES ============
class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default="Malaysia")
    phone = models.CharField(max_length=20)
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} - {self.line1}, {self.city}"


# ============ CART ============
class CartItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "product")

    def __str__(self):
        return (
            f"{self.user.username} - "
            f"{self.product.name} (x{self.quantity})"
        )


# ============ ORDER ============
class Order(models.Model):
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

    def __str__(self):
        return f"Order #{self.id} by {self.user.username}"


# ============ ORDER ITEMS ============
class OrderItem(models.Model):
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

    def __str__(self):
        return (
            f"Order #{self.order.id} - "
            f"{self.product_name} (x{self.quantity})"
        )


# ============ INVENTORY TRANSACTION LOG ============
class InventoryLog(models.Model):
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

    def __str__(self):
        return (
            f"{self.inventory_item}: "
            f"{self.change}"
        )

class Storefront(models.Model):
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


class Review(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField()
    comment = models.CharField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('product', 'user')


class OrderReminder(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    event = models.CharField(max_length=20)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('order', 'event')
