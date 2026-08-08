const form = document.querySelector("#login-form");
const errorBox = document.querySelector("#login-error");
const button = form.querySelector("button");

// Si ya hay sesión (o la instancia local no exige contraseña), entra directo.
fetch("/api/session", { credentials: "same-origin" })
  .then((r) => r.json())
  .then((data) => {
    if (data.authenticated || data.authDisabled) location.href = "/app.html";
  })
  .catch(() => {});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.classList.add("hidden");
  button.disabled = true;
  button.textContent = "Comprobando…";
  try {
    const response = await fetch("/api/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: document.querySelector("#password").value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo iniciar sesión.");
    location.href = "/app.html";
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.remove("hidden");
    button.disabled = false;
    button.textContent = "Entrar";
  }
});
