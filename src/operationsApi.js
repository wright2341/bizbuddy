export async function request(path, data, method = "POST") {
  const response = await fetch(`/api${path}`, {
    method: data === undefined ? "GET" : method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionStorage.getItem("bizbuddyToken") || ""}`,
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      typeof body.detail === "string"
        ? body.detail
        : "Please check the form and try again.",
    );
    error.status = response.status;
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("bizbuddy-session-expired"));
    throw error;
  }
  return body;
}
