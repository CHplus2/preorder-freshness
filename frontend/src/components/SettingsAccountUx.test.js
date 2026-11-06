import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {MemoryRouter} from 'react-router-dom';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:Disclosure}=await server.ssrLoadModule('/src/components/SettingsDisclosure.jsx');
 const closed=renderToStaticMarkup(h(Disclosure,{id:'reminders',title:'Email reminders',lazy:true},h('p',null,'Private contents')));
 assert.match(closed,/id="reminders"/);assert.doesNotMatch(closed,/Private contents|open=""/);
 const opened=renderToStaticMarkup(h(Disclosure,{id:'profile',title:'Kitchen profile',lazy:true,defaultOpen:true},h('p',null,'Profile contents')));
 assert.match(opened,/open=""/);assert.match(opened,/Profile contents/);
 const {default:Settings}=await server.ssrLoadModule('/src/pages/admin/StoreSettingsPage.jsx');
 const {UIContext}=await server.ssrLoadModule('/src/contexts/UIContext.js'),{AuthContext}=await server.ssrLoadModule('/src/contexts/AuthContext.js');
 const html=renderToStaticMarkup(h(MemoryRouter,null,h(UIContext.Provider,{value:{setAlert:()=>{}}},h(AuthContext.Provider,{value:{isSessionCurrent:()=>true}},h(Settings)))));
 assert.match(html,/Save each section separately/);assert.match(html,/Settings shortcuts/);assert.match(html,/Loading settings/);
 assert.doesNotMatch(html,/Worker authentication|REMINDER_CRON_SECRET|Checking email status|Reading saved settings and menus/);
 console.log('Settings/account UX: scoped-save guidance, discoverable sections and lazy diagnostic tools passed.');
}finally{await server.close()}
