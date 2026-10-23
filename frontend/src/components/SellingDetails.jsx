import {unitLabel,servingLabel} from '../utils/sellingDetails';
import './SellingDetails.css';

export default function SellingDetails({details,compact=false}){
 if(!details || !Object.keys(details).length)return null;
 const line=[details.size_label,...(compact?[]:[`Per ${unitLabel(details)}`]),servingLabel(details)].filter(Boolean).join(' · ');
 if(compact && !line && !details.no_substitutions)return null;
 return <div className={`selling-summary${compact?' selling-summary--compact':''}`}>
  {line && <p className="selling-summary-line">{line}</p>}
  {!compact && details.contents && <p className="selling-contents"><strong>In each {unitLabel(details)}</strong><span>{details.contents}</span></p>}
  {details.no_substitutions && <p className="selling-fixed">Fixed contents · no substitutions</p>}
 </div>;
}
