import {Component} from 'react';
import './ErrorBoundary.css';
export default class ErrorBoundary extends Component {
  state = {failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed) return <main className="page-error" role="alert"><h1>This page could not be displayed</h1><p>Reload the page to try again.</p><p>If you just placed an order, check My orders before submitting another one.</p><div className="page-error-actions"><button type="button" onClick={()=>window.location.reload()}>Reload page</button><a href="/orders">My orders</a></div></main>;
    return this.props.children;
  }
}
