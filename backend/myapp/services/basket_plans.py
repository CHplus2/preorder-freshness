"""Bounded, deterministic mixed-menu candidates; never a claim of exhaustive search."""
from itertools import combinations

POOL_LIMIT=12
CAPACITY_CHECK_LIMIT=30


def mixed_additions(ranked, existing, quantity):
    """Preserve existing units and distribute only the remaining target units.

    Seed with personal favourites and both price extremes. Common 1–3-menu
    mixes and larger balanced groups cover useful alternatives without
    enumerating every integer partition of a large order.
    """
    remaining=quantity-sum(existing.values())
    if remaining<0:return []
    if remaining==0:return [{}]
    eligible=[row for row in ranked if row[1].daily_capacity>existing.get(row[1].pk,0)]
    by_price=sorted(eligible,key=lambda row:(row[1].price,row[1].pk))
    seeds=eligible[:8]+by_price[:2]+list(reversed(by_price[-2:]))
    pool=list({row[1].pk:row for row in seeds}.values())[:POOL_LIMIT]
    caps={row[1].pk:row[1].daily_capacity-existing.get(row[1].pk,0) for row in pool}
    groups=[]
    for size in range(1,min(3,remaining,len(pool))+1):
        for group in combinations(pool,size):
            groups.append(group)
            if remaining%size:
                groups.extend(group[offset:]+group[:offset] for offset in range(1,size))
    for ordered in [pool,sorted(pool,key=lambda row:(row[1].price,row[1].pk)),sorted(pool,key=lambda row:(-row[1].price,row[1].pk))]:
        for size in range(4,min(remaining,len(ordered))+1):groups.append(ordered[:size])
    found={}
    for group in groups:
        amounts={row[1].pk:1 for row in group};left=remaining-len(group)
        while left>0:
            used=0
            for row in group:
                pk=row[1].pk
                if amounts[pk]<caps[pk] and left:
                    amounts[pk]+=1;left-=1;used+=1
            if not used:break
        if left:continue
        key=tuple(sorted(amounts.items()))
        found[key]=amounts
    return list(found.values())
