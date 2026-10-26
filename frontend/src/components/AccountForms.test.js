import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:AccountForm}=await server.ssrLoadModule('/src/components/AccountForm.jsx');
 const {default:AppNotification}=await server.ssrLoadModule('/src/components/AppNotification.jsx');
 const {AuthContext}=await server.ssrLoadModule('/src/contexts/AuthContext.js');
 const {UIContext}=await server.ssrLoadModule('/src/contexts/UIContext.js');
 const auth=(create=false,changes={})=>renderToStaticMarkup(h(MemoryRouter,null,h(UIContext.Provider,{value:{setAlert:()=>{},setShowLogin:()=>{},setShowSignup:()=>{}}},h(AuthContext.Provider,{value:{login:()=>{},signup:()=>{},clearAuthError:()=>{},authError:'',authPending:false,...changes}},h(AccountForm,{create})))));
 const login=auth();
 assert.match(login,/aria-label="Sign in"/);assert.match(login,/autoComplete="current-password"/);assert.match(login,/Show password/);
 assert.match(login,/maxLength="150"/);assert.doesNotMatch(login,/minLength="8"/);
 const signup=auth(true);assert.match(signup,/Email \(optional\)/);assert.match(signup,/minLength="8"/);assert.match(signup,/Show confirm password/);assert.match(signup,/password-hint/);
 const error=auth(false,{authError:'Invalid credentials'});assert.equal((error.match(/role="alert"/g)||[]).length,1);assert.match(error,/tabindex="-1"/);
 const pending=auth(true,{authPending:true});assert.match(pending,/<fieldset disabled/);assert.match(pending,/Creating account…/);
 for(const type of ['success','error']){
  const notice=renderToStaticMarkup(h(AppNotification,{alert:{type,message:'Saved fixture'},onDismiss:()=>{}}));
  assert.match(notice,type==='error'?/role="alert"/:/role="status"/);assert.match(notice,/Dismiss notification/);
 }
 const {default:RecoveryPage}=await server.ssrLoadModule('/src/pages/customer/RecoveryPage.jsx');
 const recovery=(authenticated,fragment='#uid=abc&token=def')=>renderToStaticMarkup(h(MemoryRouter,{initialEntries:['/recover'+fragment]},h(UIContext.Provider,{value:{setShowLogin:()=>{}}},h(AuthContext.Provider,{value:{isAuthenticated:authenticated}},h(RecoveryPage)))));
 assert.match(recovery(null),/Loading account help/);assert.doesNotMatch(recovery(null),/New password/);
 assert.match(recovery(false),/Choose a new password/);assert.match(recovery(false),/autoComplete="new-password"/);
 assert.match(recovery(false,'#uid=abc'),/reset link is incomplete/);
 assert.match(recovery(false,''),/Recovery email/);
 console.log('Account forms: new/existing password rules, visibility controls, one error surface and pending guards passed.');
 console.log('Notifications: severity semantics and accessible dismissal passed.');
}finally{await server.close();}
