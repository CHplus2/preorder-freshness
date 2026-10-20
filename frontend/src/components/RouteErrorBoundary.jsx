import {Component} from 'react';
import {Link} from 'react-router-dom';

// A cached page can reference a removed chunk after deployment. Keep navigation
// and account controls usable, and reload the current shell without erasing data.
export default class RouteErrorBoundary extends Component {
  state = {failed:false, route:this.props.route};
  static getDerivedStateFromProps({route}, state) {
    return route === state.route ? null : {route, failed:false};
  }
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    if (this.state.failed) return <section className="page-loading" aria-labelledby="page-load-error">
      <h1 id="page-load-error">This page could not open.</h1>
      <p role="alert">Check your connection and reload. If you just submitted an order or payment, check My orders before trying again.</p>
      <div className="dk-actions"><button type="button" onClick={()=>window.location.reload()}>Reload page</button><Link to="/orders">My orders</Link><Link to="/menu">Back to menu</Link></div>
    </section>;
    return this.props.children;
  }
}
