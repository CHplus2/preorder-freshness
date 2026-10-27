import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
import {emailChangeSettings,emailChangePreview,emailChangeToken} from '../utils/emailChange.js';
assert.deepEqual(emailChangeSettings({email:'buyer@example.test',available:true}),{email:'buyer@example.test',available:true,confirmationRequired:false,confirmationAvailable:false,pending:false});
const current={email:'buyer@example.test',available:true,email_change_confirmation_required:true,email_change_available:true,email_change_pending:true};
assert.equal(emailChangeSettings(current).pending,true);
for(const field of ['email_change_confirmation_required','email_change_available','email_change_pending'])assert.throws(()=>emailChangeSettings({...current,[field]:'true'}),{code:'INVALID_RESPONSE'});
assert.equal(emailChangeToken('#token=fixture'),'fixture');
for(const hash of ['','#token=','#token=a&token=b','#token='+('x'.repeat(4097))])assert.equal(emailChangeToken(hash),'');
const preview={current_email:'old@example.test',proposed_email:'new@example.test',already_applied:false};
assert.equal(emailChangePreview(preview).proposed_email,'new@example.test');
for(const data of [null,{}, {...preview,proposed_email:''},{...preview,current_email:'x\ny'},{...preview,already_applied:'true'}])assert.throws(()=>emailChangePreview(data),{code:'INVALID_RESPONSE'});
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:Page}=await server.ssrLoadModule('/src/pages/customer/ConfirmEmailPage.jsx');
 const {AuthContext}=await server.ssrLoadModule('/src/contexts/AuthContext.js');
 const {UIContext}=await server.ssrLoadModule('/src/contexts/UIContext.js');
 const render=(authenticated,path='/confirm-email#token=fixture')=>renderToStaticMarkup(h(MemoryRouter,{initialEntries:[path]},h(UIContext.Provider,{value:{setShowLogin:()=>{}}},h(AuthContext.Provider,{value:{isAuthenticated:authenticated,logout:()=>{}}},h(Page)))));
 assert.match(render(null),/Loading your account/);assert.doesNotMatch(render(null),/Confirm new email/);
 assert.match(render(false),/Sign in to continue/);assert.doesNotMatch(render(false),/Current email/);
 assert.match(render(true),/Checking the link/);assert.doesNotMatch(render(true),/Confirm new email/);
 assert.match(render(true,'/confirm-email'),/link is incomplete/);
 console.log('Email changes: strict rollout flags, bounded unique fragments, private sign-in gate and explicit-confirmation boundary passed.');
}finally{await server.close();}
