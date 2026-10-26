import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {contactNumber,handoverDetails,orderContact} from '../utils/handover.js';
assert.equal(contactNumber('012-345 6789'),'+60123456789');assert.equal(contactNumber('+44 7700 900123'),'+447700900123');
for(const bad of ['123','javascript:12345678','+60123;456789','+0123456789','60123456789012345'])assert.equal(contactNumber(bad),'');
const order={id:7,status:'pending',delivery_method:'standard',delivery_at:'2030-01-02T12:00:00+08:00',address:{phone:'0123456789'},preparation_plan:{needs_review:false},fulfilment_snapshot:{}};
assert.equal(handoverDetails(order).mode,'in_person');assert.equal(orderContact(order).whatsapp,null);
const whatsapp={...order,fulfilment_snapshot:{handover:{contact_method:'whatsapp',contact_phone:'+60123456789'}}};
const contact=orderContact(whatsapp);assert.ok(contact.whatsapp.startsWith('https://wa.me/60123456789?text='));assert.ok(decodeURIComponent(contact.whatsapp).includes('order #7'));assert.match(contact.text,/Malaysia time/);
assert.match(orderContact({...order,preparation_plan:{needs_review:true}}).text,/still needs kitchen confirmation/);
assert.match(orderContact({...order,status:'shipped'}).text,/marked order #7 out for delivery/);
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:Fields}=await server.ssrLoadModule('/src/components/HandoverFields.jsx');
 const {default:Details}=await server.ssrLoadModule('/src/components/HandoverDetails.jsx');
 const {default:Actions}=await server.ssrLoadModule('/src/components/OrderContactActions.jsx');
 const render=(Component,props)=>renderToStaticMarkup(h(Component,props));
 const value={contact_phone:'',contact_method:'phone',mode:'in_person',location:'',notes:''};
 const standard=render(Fields,{value,onChange:()=>{}});assert.match(standard,/Contact me; hand to a person/);assert.doesNotMatch(standard,/Place you authorise/);
 assert.doesNotMatch(render(Fields,{value,onChange:()=>{},pickup:true}),/If nobody answers/);
 assert.match(render(Fields,{value:{...value,mode:'agreed_place'},onChange:()=>{}}),/Place you authorise/);
 const unsafe={...order,fulfilment_snapshot:{handover:{notes:'<script>alert(1)</script>'}}};assert.doesNotMatch(render(Details,{order:unsafe}),/<script>/);assert.match(render(Details,{order:unsafe}),/&lt;script&gt;/);
 assert.doesNotMatch(render(Actions,{order}),/WhatsApp buyer/);assert.match(render(Actions,{order:whatsapp}),/Review it and press Send/);
 assert.equal(render(Actions,{order:{...whatsapp,status:'delivered'}}),'');
 console.log('Handover: explicit drop-off permission, validated contact links, non-sending drafts and escaped instructions passed.');
}finally{await server.close();}
