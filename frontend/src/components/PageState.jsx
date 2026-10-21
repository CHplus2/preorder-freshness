import './PageState.css';
export default function PageState({title,description,children,error=false}){
 return <main className="page-state"><h1>{title}</h1><p role={error?'alert':undefined}>{description}</p>{children && <div className="page-state-actions">{children}</div>}</main>;
}
