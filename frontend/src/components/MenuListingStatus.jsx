export default function MenuListingStatus({loading,error,count,shown}){
  return <p role="status">{loading?(shown?'Updating menu…':'Loading menu…'):error?(shown?'Some menu items could not be loaded.':'Menu temporarily unavailable'): `${count} ${count===1?'item':'items'} found`}</p>;
}
