import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {contactNumber,handoverDetails,orderContact} from '../utils/handover.js';
import {recipientDetails,trackingSaved} from '../utils/courierHandover.js';
assert.equal(contactNumber('012-345 6789'),'+60123456789');assert.equal(contactNumber('+44 7700 900123'),'+447700900123');
for(const bad of ['123','javascript:12345678','+60123;456789','+0123456789','60123456789012345'])assert.equal(contactNumber(bad),'');
const order={id:7,status:'pending',delivery_method:'standard',delivery_at:'2030-01-02T12:00:00+08:00',address:{phone:'0123456789'},preparation_plan:{needs_review:false},fulfilment_snapshot:{}};
assert.equal(handoverDetails(order).mode,'in_person');assert.equal(orderContact(order).whatsapp,null);
const whatsapp={...order,fulfilment_snapshot:{handover:{contact_method:'whatsapp',contact_phone:'+60123456789'}}};
const contact=orderContact(whatsapp);assert.ok(contact.whatsapp.startsWith('https://wa.me/60123456789?text='));assert.ok(decodeURIComponent(contact.whatsapp).includes('order #7'));assert.match(contact.text,/Malaysia/);
assert.match(orderContact({...order,preparation_plan:{needs_review:true}}).text,/still needs kitchen confirmation/);
assert.match(orderContact({...order,status:'shipped'}).text,/marked order #7 out for delivery/);
const delivery={...order,payment_status:'unpaid',updated_at:'2026-10-27T00:00:00Z',
 delivery_address:{recipient_name:'Accepted recipient',phone:'0123456789',line1:'Accepted street',city:'Kuala Lumpur',state:'Kuala Lumpur',postal_code:'50000',country:'Malaysia'},
 address:{recipient_name:'Changed recipient',phone:'0199999999',line1:'Edited street'},
 fulfilment_snapshot:{handover:{contact_method:'whatsapp',mode:'in_person'},courier:{url:'https://private.example/do-not-copy'}}};
const recipient=recipientDetails(delivery);
assert.equal(recipient.phone,'+60123456789');assert.equal(recipient.name,'Accepted recipient');assert.deepEqual(recipient.missing,[]);
assert.match(recipient.text,/Accepted street/);assert.doesNotMatch(recipient.text,/Edited street|Changed recipient|private\.example|unpaid/);
assert.match(recipient.text,/no unattended drop-off is authorised/);
assert.match(orderContact(delivery).whatsapp,/wa\.me\/60123456789/);
assert.equal(recipientDetails({...delivery,fulfilment_snapshot:{handover:{contact_phone:'+60112223333'}}}).phone,'+60112223333');
assert.equal(recipientDetails({...delivery,delivery_address:{line1:'Incomplete snapshot'}}).phone,'');
assert.match(recipientDetails({...delivery,delivery_address:{line1:'Incomplete snapshot'}}).text,/confirm name with customer/);
const requested=recipientDetails({...delivery,preparation_plan:{needs_review:true},fulfilment_snapshot:{handover:{mode:'agreed_place',location:'Reception',notes:'Call first'}}});
assert.match(requested.text,/Requested arrival \(not confirmed\)/);assert.match(requested.text,/customer-authorised place: Reception/);
const input={carrier:' Fixture courier ',reference:' REF-123 ',url:'',contact_phone:'0123456789'};
const response={order:{...delivery,fulfilment_snapshot:{courier:{carrier:'Fixture courier',reference:'REF-123',url:'',contact_phone:'+60123456789'}}}};
assert.equal(trackingSaved(response,delivery,input).id,7);
for(const bad of [{}, {order:{...response.order,id:8}}, {order:{...response.order,status:'shipped'}}, {order:{...response.order,payment_status:'paid'}}, {order:{...response.order,fulfilment_snapshot:{courier:{}}}}])assert.throws(()=>trackingSaved(bad,delivery,input));
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {default:Fields}=await server.ssrLoadModule('/src/components/HandoverFields.jsx');
 const {default:Details}=await server.ssrLoadModule('/src/components/HandoverDetails.jsx');
 const {default:Actions}=await server.ssrLoadModule('/src/components/OrderContactActions.jsx');
 const {default:Courier}=await server.ssrLoadModule('/src/components/CourierHandover.jsx');
 const render=(Component,props)=>renderToStaticMarkup(h(Component,props));
 const value={contact_phone:'',contact_method:'phone',mode:'in_person',location:'',notes:''};
 const standard=render(Fields,{value,onChange:()=>{}});assert.match(standard,/Contact me; hand to a person/);assert.doesNotMatch(standard,/Place you authorise/);
 assert.doesNotMatch(render(Fields,{value,onChange:()=>{},pickup:true}),/If nobody answers/);
 assert.match(render(Fields,{value:{...value,mode:'agreed_place'},onChange:()=>{}}),/Place you authorise/);
 const unsafe={...order,fulfilment_snapshot:{handover:{notes:'<script>alert(1)</script>'}}};assert.doesNotMatch(render(Details,{order:unsafe}),/<script>/);assert.match(render(Details,{order:unsafe}),/&lt;script&gt;/);
 assert.doesNotMatch(render(Actions,{order}),/WhatsApp buyer/);assert.match(render(Actions,{order:whatsapp}),/Review it and press Send/);
 assert.equal(render(Actions,{order:{...whatsapp,status:'delivered'}}),'');
 const courier=render(Courier,{order:delivery});assert.match(courier,/Arrange courier handover/);assert.match(courier,/Copy recipient details/);assert.match(courier,/Accepted recipient/);assert.doesNotMatch(courier,/Edited street/);
 assert.match(courier,/does not book a rider or receive live courier events/);assert.match(courier,/Tracking reference/);
 assert.match(render(Courier,{order:{...delivery,fulfilment_snapshot:{courier:{contact_phone:'+60112223333'}}}}),/href="tel:\+60112223333"/);
 assert.equal(render(Courier,{order:{...delivery,delivery_method:'pickup'}}),'');assert.equal(render(Courier,{order:{...delivery,status:'cancelled'}}),'');
 assert.doesNotMatch(render(Courier,{order:{...delivery,status:'delivered'}}),/Copy recipient details/);
 assert.match(render(Courier,{order:{...delivery,delivery_address:{recipient_name:'<script>unsafe</script>'}}}),/&lt;script&gt;unsafe/);
 assert.doesNotMatch(render(Fields,{value,onChange:()=>{},pickup:true}),/share your delivery address/);
 assert.match(standard,/share your delivery address and contact details with the courier/);
 console.log('Handover: explicit drop-off permission, validated contact links, non-sending drafts and escaped instructions passed.');
 console.log('Courier handover: accepted recipient snapshot, honest missing data, customer contact preference, manual booking and strict tracking responses passed.');
}finally{await server.close();}
