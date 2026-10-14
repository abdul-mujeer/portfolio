import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="page narrow">
      <h1 data-testid="not-found-title">Page not found</h1>
      <p className="muted">The page you requested does not exist in this demo store.</p>
      <Link className="btn btn-primary" to="/">
        Back to catalog
      </Link>
    </section>
  );
}
