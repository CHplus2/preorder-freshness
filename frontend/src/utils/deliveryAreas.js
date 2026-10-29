export function deliveryAreasError(areas) {
  if (!Array.isArray(areas)) return 'Enter area names on separate lines.';
  if (areas.length > 30) return 'Keep up to 30 delivery areas. Put one area name on each line.';
  if (areas.some(area => typeof area !== 'string' || !area.trim())) return 'Enter a name for each delivery area, or leave the list empty.';
  const long = areas.findIndex(area => [...area.trim()].length > 80);
  if (long >= 0) return `Area ${long + 1}: use 80 characters or fewer.`;
  const names = areas.map(area => area.trim().toLocaleLowerCase());
  if (new Set(names).size !== names.length) return 'Remove repeated delivery areas. Each area only needs to appear once.';
  return '';
}
