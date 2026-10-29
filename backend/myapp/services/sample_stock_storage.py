"""Plausible locations for explicitly fictional inventory, not storage evidence."""

PLACEHOLDER_LOCATIONS = (
    'FICTIONAL DEMO stock - storage unverified',
    'Fictional demo stock — not a physical stock count',
)


def sample_storage_location(material_name, storage_type):
    name = str(material_name).casefold()
    poultry = 'chicken' in name
    if storage_type == 'frozen':
        return 'Freezer A - Lower basket - Poultry box' if poultry else 'Freezer A - Upper basket - Ingredient box'
    if storage_type == 'chilled':
        if poultry:
            return 'Fridge A - Bottom shelf - Poultry box'
        if any(word in name for word in ('butter', 'milk', 'chocolate')):
            return 'Fridge A - Middle shelf - Chilled ingredients tray'
        if name in ('egg', 'eggs'):
            return 'Fridge A - Middle shelf - Egg tray'
        if any(word in name for word in ('cabbage', 'bean', 'carrot', 'cucumber', 'leaf', 'pandan', 'ginger')):
            return 'Fridge A - Vegetable drawer - Labelled box'
        return 'Fridge A - Upper shelf - Sealed ingredient box'
    if storage_type == 'ambient':
        if poultry:
            return 'Receiving area - Poultry box - Storage review'
        if name in ('onion', 'garlic'):
            return 'Pantry A - Ventilated produce basket'
        if any(word in name for word in ('oil', 'sauce')):
            return 'Pantry A - Middle shelf - Bottles tray'
        return 'Pantry A - Dry goods shelf - Sealed container'
    return None
