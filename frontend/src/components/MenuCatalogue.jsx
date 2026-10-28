import {useSyncExternalStore} from 'react';
import MenuFoodCard from './MenuFoodCard';
const queries=['(max-width: 480px)','(max-width: 700px)','(max-width: 1050px)'];
const columns=()=>window.matchMedia(queries[0]).matches?1:window.matchMedia(queries[1]).matches?2:window.matchMedia(queries[2]).matches?3:4;
const subscribe=listener=>{const media=queries.map(query=>window.matchMedia(query));media.forEach(query=>query.addEventListener('change',listener));return()=>media.forEach(query=>query.removeEventListener('change',listener));};
export default function MenuCatalogue({menus,recommendations}){
 const count=useSyncExternalStore(subscribe,columns,()=>4)*2;
 return <>{menus.slice(0,count).map(menu=><MenuFoodCard key={menu.id} product={menu}/>)}{recommendations && <div className="menu-recommendations-inset">{recommendations}</div>}{menus.slice(count).map(menu=><MenuFoodCard key={menu.id} product={menu}/>)}</>;
}
