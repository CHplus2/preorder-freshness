# Dapur Kita frontend

React + Vite customer storefront and owner dashboard. See the [root README](../README.md)
for the complete application and [feature status](../docs/OPERATIONS-AND-FEATURE-STATUS.md)
for what is implemented versus proposed.

## Development

From this directory, run npm install, then npm run dev. Start the Django backend separately.
Check vite.config.js for the development API proxy. Production hosting is documented in
[DEPLOYMENT.md](../DEPLOYMENT.md).

Commands:
- npm run build: production compilation.
- npm test: API-error and planner utility checks.
- npm run lint: ESLint checks.

## Main UI locations

- src/pages/customer: storefront/menu/checkout/customer pages.
- src/pages/admin: owner menus, orders, planner, inventory, reports and settings.
- src/components/PreparationTasks.jsx: ordered preparation-step editor.
- src/components/RecipeEditor.jsx: recipes, costs and production limits.
- src/components/MenuPhotoField.jsx and .css: shared create/edit photo URL preview.
- src/components/CostPanel.jsx: contribution estimates, expenses and wastage.
- src/admin.css: shared admin layout and responsive styles.

For planning behaviour, read [PREPARATION-PLANNING.md](../docs/PREPARATION-PLANNING.md);
the backend is authoritative for availability and validation.

## Manual UI checks after changes

Check phone, tablet and desktop widths. In menu create/edit, try an empty photo URL,
a working public image, a broken link and a long URL. The preview must remain inside
the dialog, retain its spacing and show a useful error instead of silently substituting
another food photo. Check keyboard focus, scrollable dialogs and Save/Cancel access.

A successful build does not replace browser checks. Preview feedback is not server-side
image verification; a remote host can block or remove a photo later.
