import { test as base, expect } from "@playwright/test";
export const userId = "11111111-1111-4111-8111-111111111111";
export async function mockAccount(context, state, signedIn = true) {
  if (signedIn) await context.addInitScript(({ userId }) => {
    if (sessionStorage.getItem("test-signed-out")) return;
    localStorage.setItem("sb-jiacjllvlnjeuzzlzhoc-auth-token", JSON.stringify({
      access_token: "test-token", refresh_token: "test-refresh", token_type: "bearer",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: userId, email: "test@example.com", app_metadata: {}, user_metadata: {}, aud: "authenticated" },
    }));
  }, { userId });
  await context.route("https://jiacjllvlnjeuzzlzhoc.supabase.co/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    let data = null;
    if (path.endsWith("/current_member_role")) data = state.role;
    else if (path.endsWith("/admin_members")) data = state.members || [];
    else if (path.endsWith("/admin_set_member")) {
      if (state.role !== "admin") return route.fulfill({ status: 403, json: { message: "Admin access required." } });
      state.members = [{ email: body.member_email, role: "member", approved: body.allow_access }];
    }
    else if (path.endsWith("/share_clip")) {
      const row = state.clips.find((c) => c.id === body.clip_id);
      data = "a".repeat(24);
      state.shared = { ...row.data, id: row.id };
    } else if (path.endsWith("/get_shared_clip")) data = state.shared;
    else if (path.endsWith("/clips")) {
      if (req.method() === "GET") data = state.clips;
      else if (req.method() === "POST") {
        if (state.failSave) return route.fulfill({ status: 503, json: { message: "Storage unavailable" } });
        state.clips.push(body);
      } else if (req.method() === "DELETE") {
        data = state.clips.filter((c) => c.id === url.searchParams.get("id").slice(3)).map((c) => ({id:c.id}));
        state.clips = state.clips.filter((c) => c.id !== url.searchParams.get("id").slice(3)); state.shared = null;
      }
    } else if (path.endsWith("/favorites")) {
      if (req.method() === "GET") data = state.favorites;
      else if (req.method() === "POST") state.favorites.push(...(Array.isArray(body) ? body : [body]));
      else state.favorites = state.favorites.filter((f) => f.clip_id !== url.searchParams.get("clip_id").slice(3));
    } else if (path.endsWith("/logout")) data = {};
    else return route.fulfill({ status: 400, json: { message: "Unexpected mocked endpoint" } });
    await route.fulfill({ status: 200, json: data });
  });
}
export const test = base.extend({
  accountState: [async ({ context }, use) => {
    const state = { role: "member", clips: [], favorites: [], shared: null };
    await mockAccount(context, state);
    await use(state);
  }, { auto: true }],
});
export { expect };
