"""Small-data baseline with a chronological holdout; no external AI service."""
def estimate(daily):
    def mean(values, count):
        return [sum(values[-28:])/min(28,len(values))]*count
    def linear(values, count):
        values = values[-28:]
        n=len(values); mx=(n-1)/2; my=sum(values)/n
        denominator=sum((x-mx)**2 for x in range(n))
        slope=sum((x-mx)*(v-my) for x,v in enumerate(values))/denominator if denominator else 0
        return [max(0,my+slope*(x-mx)) for x in range(n,n+count)]
    if not daily or sum(daily)==0:
        return {'next_7_days_portions': None, 'method': 'Not enough paid sales yet. Use confirmed bookings to plan stock.', 'validation_mae': None}
    chosen=mean; method='Trailing daily average'; error=None
    if len(daily)>=42 and sum(v>0 for v in daily)>=14:
        train,actual=daily[:-7],daily[-7:]
        scores=[(sum(abs(a-b) for a,b in zip(fn(train,7),actual))/7,fn,name) for fn,name in [(mean,'Trailing daily average'),(linear,'Linear trend')]]
        error,chosen,method=min(scores,key=lambda x:x[0])
    return {'next_7_days_portions': round(sum(chosen(daily,7)),1),
            'method': method+('. Selected using the latest 7 completed days as a holdout.' if error is not None else '. Limited history; treat this as a rough estimate.'),
            'validation_mae': round(error,1) if error is not None else None}
