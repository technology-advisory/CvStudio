import test from "node:test";
import assert from "node:assert/strict";
import { requireAdminAccess, verifyRequestOrigin } from "../src/access-auth.js";

test("Access se omite solo en loopback local", async () => {
  const request = new Request("http://127.0.0.1:10060/api/health");
  const auth = await requireAdminAccess(request, {});
  assert.equal(auth.local, true);
});

test("Origin mutador local debe ser el portal local", () => {
  const good = new Request("http://127.0.0.1:10060/api/links/revoke-all", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:10060" }
  });
  assert.doesNotThrow(() => verifyRequestOrigin(good, {}));

  const bad = new Request("http://127.0.0.1:10060/api/links/revoke-all", {
    method: "POST",
    headers: { origin: "https://evil.example" }
  });
  assert.throws(() => verifyRequestOrigin(bad, {}), /Origen no permitido/);
});
