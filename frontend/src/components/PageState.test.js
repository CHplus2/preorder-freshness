import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:RequireAuth}=await server.ssrLoadModule('/src/hoc/RequireAuth.jsx');
 const {default:PageState}=await server.ssrLoadModule('/src/components/PageState.jsx');
 const {AuthContext}=await server.ssrLoadModule('/src/contexts/AuthContext.js');
 const {UIContext}=await server.ssrLoadModule('/src/contexts/UIContext.js');
 const render=auth=>renderToStaticMarkup(h(MemoryRouter,null,h(UIContext.Provider,{value:{setShowLogin:()=>{}}},h(AuthContext.Provider,{value:auth},h(RequireAuth,{message:'Admin access required'},'PRIVATE KITCHEN')))));
 const signedOut=render({isAuthenticated:false,isAdmin:false});assert.match(signedOut,/<h1>Sign in to continue/);assert.match(signedOut,/<button[^>]*>Sign in<\/button>/);assert.doesNotMatch(signedOut,/PRIVATE KITCHEN/);
 const denied=render({isAuthenticated:true,isAdmin:false});assert.match(denied,/Kitchen access required/);assert.match(denied,/My account/);assert.doesNotMatch(denied,/PRIVATE KITCHEN/);
 assert.match(render({isAuthenticated:true,isAdmin:true}),/PRIVATE KITCHEN/);
 assert.match(render({isAuthenticated:null,isAdmin:null}),/Checking account access/);
 const failed=renderToStaticMarkup(h(PageState,{title:'Page unavailable',description:'Reload to retry.',error:true},h('button',null,'Reload')));assert.match(failed,/<main/);assert.match(failed,/role="alert"/);assert.match(failed,/<h1>Page unavailable/);
 console.log('Page states: recoverable sign-in, staff-only access, verified content and consistent failure presentation passed.');
}finally{await server.close();}
