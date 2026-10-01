import { useEffect, useState } from "react";
import { supabase, unwrap } from "./account";

export default function AccountPanel({ session, role, onClose, onError }) {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    try { setMembers(unwrap(await supabase.rpc("admin_members")) || []); }
    catch (e) { setMessage(e.message); }
  }
  useEffect(() => { if (role === "admin") load(); }, [role]);
  async function update(address, allowed) {
    setBusy(true); setMessage("");
    try {
      unwrap(await supabase.rpc("admin_set_member", { member_email: address.trim(), allow_access: allowed }));
      setEmail(""); await load();
      setMessage(allowed ? "Access approved. They can now sign in with Google. No email was sent." : "Access suspended.");
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  async function signIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + "/", queryParams: { prompt: "select_account" } },
    });
    if (error) { setMessage(error.message); setBusy(false); }
  }
  return <section className="account-panel">
    <h2>{role === "admin" ? "Manage access" : "Your account"}</h2>
    {!session ? <>
      <p>Sign in to save clips online and access your library on other devices.</p>
      <p>ClipQuote is invite-only. Ask the owner to approve your Google email address first.</p>
      <button className="primary" disabled={busy} onClick={signIn}>Continue with Google</button>
    </> : <>
      <p>{session.user.email}</p>
      {!role && <p role="alert">Your account does not currently have access. Contact the administrator.</p>}
      {role === "admin" && <>
        <form onSubmit={(e) => { e.preventDefault(); update(email, true); }}>
          <label>Email address<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} /></label>
          <button className="primary" disabled={busy}>Approve access</button>
        </form>
        <ul className="member-list">{members.map((m) => <li key={m.email}>
          <span>{m.email}<small>{m.role === "admin" ? "Admin" : m.approved ? "Approved" : "Suspended"}</small></span>
          {m.role !== "admin" && <button className="secondary" disabled={busy} onClick={() => update(m.email, !m.approved)}>{m.approved ? "Suspend" : "Approve"}</button>}
        </li>)}</ul>
      </>}
      <button className="secondary" disabled={busy} onClick={async () => {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) onError(error.message); else onClose();
      }}>Sign out</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
