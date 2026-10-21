export const publicNavigation=[['/','Home'],['/story','Our story'],['/menu','Menu'],['/how-it-works','How it works'],['/contact','Contact']];
export const kitchenNavigation=[['/admin/planner','Planner'],['/admin/products','Menus'],['/admin/inventory','Inventory'],['/admin/orders','Orders'],['/admin/reports','Sales'],['/admin/ai/decisions','FreshCast'],['/admin/settings','Settings'],['/admin/customers','Customers'],['/','View storefront']];
export function isCurrentSection(path,url){
 if(url==='/menu')return path==='/menu' || /^\/products\/[^/]+$/.test(path);
 if(url==='/admin/ai/decisions')return /^\/admin\/ai\/(forecast|inventory|decisions)$/.test(path);
 return path===url;
}
const pages={
 '/':['Food worth planning for','Explore the home-kitchen menu and choose a delivery time.'],
 '/story':['Our story','Meet the people and food behind the kitchen.'],
 '/menu':['The menu','Choose food and check delivery times for your basket.'],
 '/how-it-works':['How preordering works','Learn how to preorder, arrange delivery and follow your order.'],
 '/contact':['Contact the kitchen','Ask about orders, ingredients or delivery arrangements.'],
 '/cart':['Your basket','Review food, quantities, delivery times and order totals.'],
 '/checkout':['Checkout','Confirm your delivery address, time and payment method.'],
 '/orders':['My orders','Follow delivery progress and payment status for your preorders.'],
 '/account':['Account settings','Manage your saved account and delivery details.'],
 '/recover':['Account recovery','Recover access to your kitchen account.'],
 '/payment/paypal':['PayPal payment','Review your saved preorder and its verified Sandbox payment status.'],
 '/payment/wallet':['Demo credit payment','Review a preorder using demonstration credits.'],
 '/escrow-demo':['Testnet escrow demo','An illustrative testnet payment walkthrough.'],
 '/admin/planner':['Planner','Review kitchen preparation, delivery work and requests needing attention.'],
 '/admin/products':['Menus','Manage menu availability, recipes and cooking steps.'],
 '/admin/inventory':['Inventory','Review ingredient batches, stock levels and expiry dates.'],
 '/admin/orders':['Orders','Manage kitchen requests, preparation progress and delivery status.'],
 '/admin/reports':['Sales analytics','Review recorded sales, costs and forecast evidence.'],
 '/admin/customers':['Customers','Manage customer accounts and store access.'],
 '/admin/settings':['Kitchen settings','Manage storefront information and kitchen operating settings.'],
 '/admin/ai/forecast':['FreshCast · Demand analytics','Review sales forecasts and their supporting evidence.'],
 '/admin/ai/inventory':['FreshCast · Stock and expiry','Compare dated demand with recorded ingredient stock.'],
 '/admin/ai/decisions':['FreshCast · Decisions','Explore expiry risks, action options and decision evidence.'],
};
export function pageMetadata(path){
 const [title,description]=pages[path] || (/^\/products\/[^/]+$/.test(path)?['Menu details','Review food, preparation notice and delivery options.']:['Page not found','Return to the kitchen menu or your saved orders.']);
 return {title,description};
}
