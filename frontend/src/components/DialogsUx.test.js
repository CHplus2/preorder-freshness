import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const load=path=>server.ssrLoadModule('/src/'+path);
 const {AuthContext}=await load('contexts/AuthContext.js'),{UIContext}=await load('contexts/UIContext.js'),{StoreContext}=await load('contexts/StorefrontContext.js');
 const {default:Account}=await load('components/AccountForm.jsx');
 const render=(node,auth={})=>renderToStaticMarkup(h(MemoryRouter,null,h(StoreContext.Provider,{value:{store:{ordering_mode:'simple'}}},h(AuthContext.Provider,{value:{isAuthenticated:false,clearAuthError:()=>{},...auth}},h(UIContext.Provider,{value:{setShowLogin:()=>{},setShowSignup:()=>{},openCustomerAccess:()=>{}}},node)))));
 const login=render(h(Account));assert.match(login,/Kitchen sign in/);assert.match(login,/KITCHEN STAFF/);assert.match(login,/Back to customer account/);assert.doesNotMatch(login,/New to the kitchen/);
 const pending=render(h(Account),{authPending:true});assert.match(pending,/<button[^>]*aria-label="Close account dialog"[^>]*disabled/);assert.match(pending,/<button[^>]*class="account-recovery-link"[^>]*disabled/);assert.match(pending,/Signing in…/);
 const {default:Recovery}=await load('pages/customer/RecoveryPage.jsx');const recovery=render(h(Recovery));assert.match(recovery,/Staff password recovery/);assert.match(recovery,/Customer sign-in/);assert.match(recovery,/name and phone number alone cannot restore/);assert.match(recovery,/Sign in with a passkey/);
 const {default:CustomerAccess}=await load('components/CustomerAccessForm.jsx');const customer=render(h(CustomerAccess),{isAuthenticated:true});assert.match(customer,/>Register<\/button>/);assert.doesNotMatch(customer,/type="password"|type="email"/);
 const {default:Help}=await load('components/KitchenHelp.jsx');const help=render(h(Help));assert.match(help,/aria-expanded="false"/);assert.doesNotMatch(help,/kitchen-chat-body|help-question/);
 console.log('Dialogs UX: staff/customer separation, blocked dismissal while signing in and accurate recovery guidance passed.');
}finally{await server.close()}
