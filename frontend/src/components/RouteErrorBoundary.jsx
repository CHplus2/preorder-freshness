import {Component} from 'react';
import {Link} from 'react-router-dom';
import PageState from './PageState';

// A cached page can reference a removed chunk after deployment. Keep navigation
// and account controls usable, and reload the current shell without erasing data.
export default class RouteErrorBoundary extends Component {
  state = {failed:false, route:this.props.route};
  static getDerivedStateFromProps({route}, state) {
    return route === state.route ? null : {route, failed:false};
  }
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    if (this.state.failed) return <PageState error title="This page could not open." description="Check your connection and reload. If you just submitted an order or payment, check My orders before trying again.">
      <button type="button" onClick={()=>window.location.reload()}>Reload page</button><Link to="/orders">My orders</Link><Link to="/menu">Back to menu</Link>
    </PageState>;
    return this.props.children;
  }
}
