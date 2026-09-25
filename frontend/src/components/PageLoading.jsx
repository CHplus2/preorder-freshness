import "./PageLoading.css";
export default function PageLoading({ label = "Loading page..." }) {
  return <div className="page-loading" role="status" aria-live="polite">
    <p>{label}</p>
    <div className="page-loading-preview" aria-hidden="true">
      <div className="page-loading-heading" />
      <div className="page-loading-cards">{[0, 1, 2].map(n => <div key={n} />)}</div>
      <div className="page-loading-rows">{[0, 1, 2, 3].map(n => <div key={n} />)}</div>
    </div>
  </div>;
}
