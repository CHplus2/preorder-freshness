"""Read-only, date-based replenishment targets; never a stock receipt or reservation."""
from collections import defaultdict
from datetime import date,timedelta
from decimal import Decimal
from django.db.models import Prefetch,Sum
from django.utils import timezone
from rest_framework.decorators import api_view,permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from ..models import Product,ProductIngredient,ProductPackaging
from ..services.simple_ordering import eligible_stock
from ..services.selling import shipping_enquiry


@api_view(['GET'])
@permission_classes([IsAdminUser])
def stock_readiness(request):
    params=request.query_params
    if set(params)-{'date','quantity'} or any(len(params.getlist(k))!=1 for k in params):
        raise ValidationError('Use one date and one units-per-menu value.')
    today=timezone.localdate()
    try:
        day=date.fromisoformat(params.get('date',today.isoformat()))
        if day.isoformat()!=params.get('date',today.isoformat()) or not today<=day<=today+timedelta(days=90):raise ValueError
        raw=params.get('quantity','1')
        if not raw.isascii() or not raw.isdigit() or len(raw)>3 or not 1<=int(raw)<=100:raise ValueError
        units=int(raw)
    except (ValueError,TypeError):
        raise ValidationError('Choose a date from today through the next 90 days and 1–100 units per menu.')
    menus=list(Product.objects.filter(selling_status='active').order_by('name','id').prefetch_related(
        Prefetch('ingredients',queryset=ProductIngredient.objects.select_related('raw_material')),
        Prefetch('packaging_requirements',queryset=ProductPackaging.objects.select_related('packaging_item'))))
    if len(menus)>500:raise ValidationError('This check supports up to 500 active menus. Review the active catalogue first.')
    offered,excluded,issues=[],[],[]
    needs,labels,uses=defaultdict(Decimal),{},defaultdict(int)
    packs,pack_labels,pack_uses=defaultdict(int),{},defaultdict(int)
    for menu in menus:
        days,dates=menu.delivery_weekdays,menu.delivery_dates
        try:
            dates_valid=isinstance(dates,list) and all(isinstance(d,str) and date.fromisoformat(d).isoformat()==d for d in dates)
        except ValueError:
            dates_valid=False
        if not isinstance(days,list) or any(type(n)!=int or not 0<=n<=6 for n in days) or not dates_valid:
            issues.append(dict(id=menu.pk,name=menu.name,detail='Review this menu’s offered days or dates.'));continue
        if shipping_enquiry(menu) or days and day.weekday() not in days or dates and day.isoformat() not in dates:
            excluded.append(dict(id=menu.pk,name=menu.name));continue
        offered.append(dict(id=menu.pk,name=menu.name,units=units))
        ingredients=list(menu.ingredients.all())
        if not ingredients or any(row.quantity_required<=0 for row in ingredients):
            issues.append(dict(id=menu.pk,name=menu.name,detail='Complete the positive ingredient quantities before relying on this target.'));continue
        for row in ingredients:
            needs[row.raw_material_id]+=row.quantity_required*units
            labels[row.raw_material_id]=row.raw_material
            uses[row.raw_material_id]+=1
        for row in menu.packaging_requirements.all():
            packs[row.packaging_item_id]+=row.quantity_per_item*units
            pack_labels[row.packaging_item_id]=row.packaging_item
            pack_uses[row.packaging_item_id]+=1
    available=dict(eligible_stock(day).filter(raw_material_id__in=needs).values('raw_material_id').annotate(
        total=Sum('quantity')).values_list('raw_material_id','total'))
    ingredients=[]
    for pk in sorted(needs,key=lambda k:labels[k].name.casefold()):
        material=labels[pk];count=available.get(pk,Decimal(0))
        ingredients.append(dict(id=pk,name=material.name,unit=material.unit,required=format(needs[pk],'.3f'),
            available=format(count,'.3f'),shortfall=format(max(Decimal(0),needs[pk]-count),'.3f'),menu_count=uses[pk]))
    packaging=[]
    for pk in sorted(packs,key=lambda k:pack_labels[k].name.casefold()):
        item=pack_labels[pk]
        packaging.append(dict(id=pk,name=item.name,required=packs[pk],available=item.quantity,
            shortfall=max(0,packs[pk]-item.quantity),is_active=item.is_active,menu_count=pack_uses[pk]))
    state='review' if issues or any(not row['is_active'] for row in packaging) else 'shortages' if any(Decimal(row['shortfall'])>0 for row in ingredients+packaging) else 'covered' if offered else 'no_menus'
    return Response(dict(date=day.isoformat(),quantity_per_menu=units,checked_at=timezone.now().isoformat(),
        state=state,menus=offered,excluded_menus=excluded,issues=issues,ingredients=ingredients,packaging=packaging))
