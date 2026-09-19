from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum
from ..models import Product, OrderItem

num = 30

def get_user_top_categories(user, days=180, top_k=5):
    since = timezone.now() - timedelta(days=days)

    qs = (
        OrderItem.objects
        .exclude(order__status="cancelled").filter(order__user=user, order__created_at__gte=since, product__isnull=False)
        .values("product__category_id", "product__category__name")
        .annotate(qty=Sum("quantity"))
        .order_by("-qty")[:top_k]
    )

    top_category_ids = set()
    top_category_names = []

    for row in qs:
        if row["product__category_id"] is not None:
            top_category_ids.add(row["product__category_id"])
            top_category_names.append(row["product__category__name"])

    return top_category_ids, top_category_names

def get_user_bought_product_ids(user, days=365):
    since = timezone.now() - timedelta(days=days)

    return set(
        OrderItem.objects
        .exclude(order__status="cancelled").filter(order__user=user, order__created_at__gte=since, product__isnull=False)
        .values_list("product_id", flat=True)
        .distinct()
    )

def get_user_product_counts(user, days=365):
    since = timezone.now() - timedelta(days=days)

    qs = (
        OrderItem.objects
        .exclude(order__status="cancelled").filter(order__user=user, order__created_at__gte=since, product__isnull=False)
        .values("product_id")
        .annotate(qty=Sum("quantity"))
        .order_by("-qty")
    )

    return {row["product_id"]: int(row["qty"] or 0) for row in qs}

def get_global_product_popularity(days=30, top_n=num):
    since = timezone.now() - timedelta(days=days)

    qs = (
        OrderItem.objects
        .exclude(order__status="cancelled").filter(order__created_at__gte=since, product__isnull=False)
        .values("product_id")
        .annotate(qty=Sum("quantity"))
        .order_by("-qty")[:top_n]
    )

    return {row["product_id"]: row["qty"] or 0 for row in qs}

def get_score(p, top_category_ids=None, user_qty_by_product=None, global_qty=None):
    top_category_ids = top_category_ids or set()
    user_qty_by_product = user_qty_by_product or {}
    global_qty = global_qty or {}

    score = 0
    reasons = []

    if p.category_id in top_category_ids:
        score += 25
        reasons.append("You often buy items from this category")

    bought_qty = user_qty_by_product.get(p.id, 0)
    if bought_qty > 0:
        score += min(20, 5 * bought_qty)
        reasons.append(f"You bought this before (x{bought_qty})")

    pop = global_qty.get(p.id, 0)
    if pop > 0:
        score += min(15, int(pop ** 0.5))
        reasons.append("Popular recently")

    return score, reasons

def handle_recommendation(candidates, top_category_ids, user_qty_by_product, global_qty, excluded_ids, pre_limit=None):
    if excluded_ids:
        candidates = candidates.exclude(id__in=excluded_ids)

    if pre_limit is not None:
        candidates = candidates[:pre_limit]

    items = []
    for p in candidates:
        if p.get_available_quantity() < 1:
            continue
        score, reasons = get_score(p, top_category_ids, user_qty_by_product, global_qty)

        if score > 0 :
            items.append({
                "product_id": p.id,
                "product_name": p.name,
                "product_img": p.image_url,
                "product_price": p.price,
                "score": score,
                "reasons": reasons
            })

    items.sort(key=lambda x: (x["score"], global_qty.get(x["product_id"], 0)), reverse=True)
    return items

def recommend_for_user(user, limit=20, exclude_bought=True):
    categories, _ = get_user_top_categories(user)
    counts = get_user_product_counts(user)
    popularity = get_global_product_popularity()
    excluded = get_user_bought_product_ids(user) if exclude_bought else set()
    from ..serializers import ProductSerializer
    stock = ProductSerializer()
    results = []
    for product in Product.objects.select_related('category').prefetch_related('ingredients').order_by('id'):
        if product.id in excluded or stock.get_stock(product) < 1:
            continue
        score, reasons = get_score(product, categories, counts, popularity)
        results.append({'product_id': product.id, 'product_name': product.name,
            'product_img': product.image_url, 'product_price': product.price,
            'score': score, 'reasons': reasons or ['Explore something from our kitchen']})
    return sorted(results, key=lambda item: (-item['score'], item['product_id']))[:limit]
