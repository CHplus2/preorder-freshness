export default function PlannerSnapshot({loading,error,hasPlan,loadedAt,onRetry,children}) {
  if (loading) return <div className="admin-empty" role="status"><h2>Loading your kitchen plan…</h2><p>Wait for the latest orders and ingredient needs before preparing, shopping or exporting.</p></div>;
  if (error || !hasPlan) return <div className="admin-empty" role="alert"><h2>Kitchen plan unavailable</h2><p>{error || 'No plan was received. Please try again.'}</p><p>Preparation, shopping, packing and calendar export are unavailable until the plan loads successfully.</p><button type="button" onClick={onRetry}>Retry loading plan</button></div>;
  return <><p role="status">Plan loaded {new Date(loadedAt).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})} (Malaysia). Refresh after orders or stock change.</p>{children}</>;
}
