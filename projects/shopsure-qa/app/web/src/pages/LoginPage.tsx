import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../lib/api";
import { ErrorBanner } from "../components/Feedback";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("customer@example.com");
  const [password, setPassword] = useState("Customer#12345");
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDetails([]);
    try {
      await login(email, password);
      navigate(searchParams.get("redirect") ?? "/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setDetails(err.details.map((detail) => `${detail.field}: ${detail.message}`));
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page narrow">
      <h1>Log in</h1>
      <p className="muted">
        Demo accounts — customer: <code>customer@example.com / Customer#12345</code>, admin:{" "}
        <code>admin@example.com / Admin#12345</code>
      </p>

      {error && <ErrorBanner message={error} details={details} />}

      <form onSubmit={handleSubmit} className="form" noValidate>
        <label>
          Email
          <input
            type="email"
            value={email}
            required
            data-testid="login-email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            required
            data-testid="login-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy} data-testid="login-submit">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p>
        No account yet? <Link to="/register">Create one</Link>
      </p>
    </section>
  );
}
