const COOKIE_NAME = "healthpanel-token";

export function getToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));

  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
}

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    let errorMessage = "Invalid username or password";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error ?? errorData.message ?? errorMessage;
    } catch {
      // ignore parse errors
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error ?? "Login failed");
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
    });
  } catch {
    // ignore errors on logout
  }

  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
