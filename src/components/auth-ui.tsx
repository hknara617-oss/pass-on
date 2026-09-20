import Link from "next/link";
export function AuthFrame({
  title,
  description,
  children,
}: {
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth">
      <div className="auth-inner">
        <header className="auth-heading">
          <div className="brand">PASS ON</div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </header>
        {children}
        <p className="auth-footer">
          기록은 당신의 것입니다.
          <br />
          언제든 직접 가져갈 수 있어요.
        </p>
      </div>
    </main>
  );
}
export function Status({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="status" role="status">
          {message}
        </p>
      )}
    </>
  );
}
export function LoginLink() {
  return (
    <Link className="text-link centered" href="/login">
      로그인으로 돌아가기
    </Link>
  );
}
