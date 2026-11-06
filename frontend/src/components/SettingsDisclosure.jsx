import {useState} from 'react';
export default function SettingsDisclosure({id,title,description,children,lazy=false,defaultOpen=false}){
 const [opened,setOpened]=useState(defaultOpen);
 return <details id={id} className="settings-group settings-disclosure" open={defaultOpen||undefined} onToggle={event=>{if(event.target===event.currentTarget&&event.currentTarget.open)setOpened(true)}}>
  <summary><span>{title}</span>{description&&<small>{description}</small>}</summary>
  {(opened||!lazy)&&<div className="settings-disclosure-body">{children}</div>}
 </details>;
}
