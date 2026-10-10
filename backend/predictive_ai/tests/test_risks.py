import unittest
import pandas as pd
from backend.predictive_ai.decision_engine import assess_risks


class RiskTests(unittest.TestCase):
    def run_risk(self,cost_b=10):
        forecasts=pd.DataFrame([dict(center_id=13,meal_id=1,predicted_orders=10)])
        recipes=pd.DataFrame([dict(meal_id=1,ingredient_id='rice',qty_per_order_kg=.5)])
        batches=pd.DataFrame([
            dict(batch_id='expired',center_id=13,ingredient_id='rice',quantity_kg=100,expiry_week=145,cost_per_kg_myr=5),
            dict(batch_id='b',center_id=13,ingredient_id='rice',quantity_kg=5,expiry_week=146,cost_per_kg_myr=cost_b),
            dict(batch_id='a',center_id=13,ingredient_id='rice',quantity_kg=3,expiry_week=146,cost_per_kg_myr=1),
            dict(batch_id='stock-only',center_id=13,ingredient_id='oil',quantity_kg=1,expiry_week=146,cost_per_kg_myr=50)])
        suppliers=pd.DataFrame(columns=['ingredient_id','safety_stock_kg'])
        return assess_risks(forecasts,recipes,batches,suppliers,13,146,details=True)

    def test_recipe_fefo_exclusions_costs_and_ranking(self):
        risks,allocations,_=self.run_risk()
        self.assertEqual(risks[0]['ingredient_id'],'oil')
        rice=next(r for r in risks if r['ingredient_id']=='rice')
        self.assertEqual(rice['forecast_demand_kg'],5)
        self.assertEqual(rice['available_kg'],8)
        self.assertEqual(rice['potential_waste_cost_myr'],30)
        lots={a['batch_id']:a for a in allocations}
        self.assertEqual(lots['a']['consumed_kg'],3)
        self.assertEqual(lots['b']['consumed_kg'],2)
        self.assertEqual(lots['expired']['consumed_kg'],0)
        self.assertEqual(lots['expired']['exclusion_reason'],'expired')

    def test_unknown_surplus_cost_stays_unknown(self):
        risks,_,warnings=self.run_risk(float('nan'))
        self.assertIsNone(next(r for r in risks if r['ingredient_id']=='rice')['potential_waste_cost_myr'])
        self.assertTrue(warnings)
