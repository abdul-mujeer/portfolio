import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { ErrorBanner } from "../components/Feedback";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDetails([]);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setDetails(err.details.map((detail) => `${detail.field}: ${detail.message}`));
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page narrow">
      <h1>Create your account</h1>
      <p className="muted">Password must be 8+ characters and contain a letter and a digit.</p>

      {error && <ErrorBanner message={error} details={details} />}

      <form onSubmit={handleSubmit} className="form" noValidate>
        <label>
          Full name
          <input value={name} required data-testid="register-name" onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            required
            data-testid="register-email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            required
            data-testid="register-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy} data-testid="register-submit">
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </section>
  );
}
