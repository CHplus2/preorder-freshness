"""Storage boundary for fictional credits, not real-money funds."""
from decimal import Decimal

# Wallet has eight integer digits. Keep new credits within the cent-based limit.
MAX_BALANCE = Decimal('99999999.99')
