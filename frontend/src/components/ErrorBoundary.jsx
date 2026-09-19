import {Component} from 'react';
export default class ErrorBoundary extends Component {
  state = {failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed) return <main className="dk-workspace" role="alert"><h1>This page could not be displayed</h1><p>Please reload to try again. If you just placed an order, check My orders before submitting another one.</p><button onClick={()=>window.location.reload()}>Reload page</button> <a href="/orders">My orders</a></main>;
    return this.props.children;
  }
}
