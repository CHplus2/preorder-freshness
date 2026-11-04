import asyncio,json
from pathlib import Path
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
from playwright.async_api import async_playwright
BASE='http://localhost:8081';OUT=Path('/tmp/fc-passkeys-evidence');OUT.mkdir(exist_ok=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  errors=[]
  async def context():
   ctx=await browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce')
   await ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) or r.request.url.startswith('data:') else r.abort())
   page=await ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   cdp=await ctx.new_cdp_session(page);await cdp.send('WebAuthn.enable')
   aid=(await cdp.send('WebAuthn.addVirtualAuthenticator',{'options':{'protocol':'ctap2','transport':'internal','hasResidentKey':True,'hasUserVerification':True,'isUserVerified':True,'automaticPresenceSimulation':True}}))['authenticatorId']
   return ctx,page,cdp,aid
  ctx,page,cdp,aid=await context()
  await page.goto(BASE+'/menu');await page.locator('.menu-food-card .menu-add').first.click()
  await page.goto(BASE+'/checkout');await page.get_by_role('heading',name='Sign in to place your preorder',exact=True).wait_for()
  assert await page.get_by_label('Payment receipt image',exact=True).count()==0
  await page.screenshot(path=str(OUT/'desktop-checkout-account-required.png'))
  guest=(await (await ctx.request.get(BASE+'/api/check-auth/')).json())['user_id']
  await page.get_by_role('link',name='Create account or sign in',exact=True).click()
  await page.get_by_label('Your name',exact=True).fill('Local passkey customer')
  await page.get_by_label('Phone number',exact=True).fill('0123456789')
  await page.get_by_role('button',name='Create account with a passkey',exact=True).click()
  try:await page.wait_for_url(BASE+'/checkout',timeout=15000)
  except Exception:print('Registration UI:',await page.locator('main').inner_text());raise
  await page.locator('.client-checkout .client-contact-fields input[readonly]').first.wait_for()
  data=await (await ctx.request.get(BASE+'/api/check-auth/')).json()
  assert data['user_id']==guest and not data['is_guest']
  assert await page.get_by_label('Your name',exact=True).input_value()=='Local passkey customer'
  assert (await (await ctx.request.get(BASE+'/api/cart/')).json())[0]['quantity']==1
  await page.get_by_label('Full delivery address',exact=True).fill('House 1, Local street, Kuching 93000')
  await page.get_by_label('Delivery area',exact=False).select_option('North')
  day=(datetime.now(ZoneInfo('Asia/Kuala_Lumpur'))+timedelta(days=2)).date().isoformat()
  await page.locator('.simple-time-picker input[type=date]').fill(day)
  await page.locator('.simple-time-picker input[type=time]').fill('07:30')
  await page.get_by_text('Your order details are ready',exact=True).wait_for()
  await page.get_by_label('Cash on delivery',exact=False).check()
  async with page.expect_response(lambda r:'/api/orders/place/' in r.url) as placed:
   await page.get_by_role('button',name='Place preorder',exact=False).click()
  response=await placed.value;assert response.status==201,await response.text()
  order=(await response.json())['order_id']
  await page.wait_for_url(BASE+'/orders');await page.locator('.customer-orders').wait_for()
  await page.goto(BASE+'/account');await page.get_by_role('heading',name='Your account',exact=True).wait_for()
  await page.get_by_role('button',name='Add another passkey',exact=True).wait_for()
  # Reauthenticate with the real virtual credential before updating contact.
  await page.get_by_label('Your name',exact=True).fill('Updated local customer')
  await page.get_by_role('button',name='Save contact details',exact=True).click()
  await page.get_by_text('Contact details saved.',exact=False).wait_for()
  await page.locator('.app-notification').wait_for(state='hidden')
  await page.screenshot(path=str(OUT/'desktop-passkey-account.png'))
  await page.set_viewport_size({'width':390,'height':844})
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  await page.screenshot(path=str(OUT/'mobile-passkey-account.png'))
  credentials=(await cdp.send('WebAuthn.getCredentials',{'authenticatorId':aid}))['credentials']
  assert len(credentials)==1
  second,sp,scdp,sa=await context()
  # Test-only key material stays in memory; no credential export is persisted.
  for credential in credentials:await scdp.send('WebAuthn.addCredential',{'authenticatorId':sa,'credential':credential})
  async def delayed(route):
   await asyncio.sleep(.4);await route.continue_()
  await second.route(BASE+'/api/storefront/',delayed)
  await sp.goto(BASE+'/account')
  signin=sp.get_by_role('button',name='Sign in with a passkey',exact=True);await signin.wait_for()
  assert await sp.locator('dialog[open]').count()==0
  await signin.click();await sp.get_by_role('heading',name='Your account',exact=True).wait_for()
  again=await (await second.request.get(BASE+'/api/check-auth/')).json()
  assert again['user_id']==guest
  assert again['customer_account']['name']=='Updated local customer'
  orders=await (await second.request.get(BASE+'/api/orders/')).json()
  assert order in [o['id'] for o in orders['results']]
  saved=next(o for o in orders['results'] if o['id']==order)
  assert saved['fulfilment_snapshot']['customer']['name']=='Local passkey customer'
  await sp.goto(BASE+'/orders');await sp.locator('.customer-orders').wait_for()
  await sp.screenshot(path=str(OUT/'second-device-own-orders.png'))
  assert not errors,errors
  print(json.dumps({'checks':['account gate before payment','native passkey registration','same user and basket','account contact checkout','cash order','passkey reauthentication and profile edit','historical contact preserved','responsive account page','synced passkey sign-in','same-account orders on second browser'],'browser_errors':errors}))
  await browser.close()
asyncio.run(main())
