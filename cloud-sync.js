"use strict";

(() => {
  const SUPABASE_URL = "https://yizaozplxvcnypijybee.supabase.co";
  const SUPABASE_KEY = "sb_publishable_kZiBUgvokbWqGzYkxvF-Eg_6fBlIzsd";
  const STORAGE_KEY = "rupeeflow_data_v1";
  const TABLE = "rupeeflow_data";

  const style = document.createElement("style");
  style.textContent = `
    #rf-cloud { margin: 24px 0; padding: 22px; border: 1px solid var(--border, #ddd);
      border-radius: 18px; background: var(--panel, #fff); color: var(--text, #222); }
    #rf-cloud h2 { margin: 0 0 8px; font-size: 1.3rem; }
    #rf-cloud p { line-height: 1.5; }
    #rf-cloud .rf-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 12px; }
    #rf-cloud input { box-sizing: border-box; width: 100%; padding: 12px; margin: 5px 0 12px;
      border: 1px solid #aaa; border-radius: 9px; background: transparent; color: inherit; }
    #rf-cloud button { cursor: pointer; padding: 10px 14px; margin: 4px 5px 4px 0;
      border: 1px solid #888; border-radius: 9px; font: inherit; }
    #rf-cloud button:disabled { opacity: .5; cursor: not-allowed; }
    #rf-cloud .rf-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    #rf-cloud-status { overflow-wrap: anywhere; }
    #rf-cloud-message { white-space: pre-wrap; overflow-wrap: anywhere; }
  `;
  document.head.appendChild(style);

  const panel = document.createElement("section");
  panel.id = "rf-cloud";
  panel.innerHTML = `
    <h2>Cloud sync</h2>
    <p>Sign in to access your RupeeFlow data on your other devices. Sync is manual; downloading replaces this device's current data.</p>
    <div class="rf-grid">
      <label>Email address
        <input id="rf-cloud-email" type="email" autocomplete="email" placeholder="you@example.com">
      </label>
      <label>Password
        <input id="rf-cloud-password" type="password" autocomplete="current-password" placeholder="At least 8 characters">
      </label>
    </div>
    <div class="rf-actions">
      <button type="button" id="rf-cloud-signup">Create account</button>
      <button type="button" id="rf-cloud-login">Sign in</button>
      <button type="button" id="rf-cloud-logout" disabled>Sign out</button>
    </div>
    <p id="rf-cloud-status" role="status">Checking cloud connection…</p>
    <div class="rf-actions">
      <button type="button" id="rf-cloud-upload" disabled>Upload this device to cloud</button>
      <button type="button" id="rf-cloud-download" disabled>Download cloud to this device</button>
    </div>
    <p id="rf-cloud-message" role="status" aria-live="polite"></p>
    <p><strong>Safety:</strong> Downloading replaces this browser's finance data. Export a JSON backup first if you have records you need to keep.</p>
  `;

  const footer = document.querySelector(".footer");
  if (footer) footer.insertAdjacentElement("beforebegin", panel);
  else document.querySelector("main")?.appendChild(panel);

  const el = id => document.getElementById(id);
  const message = text => { el("rf-cloud-message").textContent = text; };
  const setBusy = busy => {
    ["rf-cloud-signup", "rf-cloud-login", "rf-cloud-logout",
     "rf-cloud-upload", "rf-cloud-download"].forEach(id => {
      el(id).disabled = busy || (
        ["rf-cloud-logout", "rf-cloud-upload", "rf-cloud-download"].includes(id)
        && !session
      );
    });
  };

  let client;
  let session = null;

  function updateStatus() {
    el("rf-cloud-status").textContent = session
      ? "Signed in as " + session.user.email
      : "Not signed in. Enter your email and password.";
    el("rf-cloud-logout").disabled = !session;
    el("rf-cloud-upload").disabled = !session;
    el("rf-cloud-download").disabled = !session;
  }

  async function run(action) {
    if (!client) return;
    message("");
    setBusy(true);
    try {
      await action();
    } catch (error) {
      console.error("RupeeFlow cloud sync error:", error);
      message(error?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      updateStatus();
    }
  }

  function credentials() {
    return {
      email: el("rf-cloud-email").value.trim(),
      password: el("rf-cloud-password").value
    };
  }

  el("rf-cloud-signup").addEventListener("click", () => run(async () => {
    const { email, password } = credentials();
    if (!email || password.length < 8) {
      throw new Error("Enter a valid email and a password of at least 8 characters.");
    }
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    if (error) throw error;
    if (data.session) {
      session = data.session;
      message("Account created and signed in.");
    } else {
      message("Account request submitted. Check your email to confirm your account, then sign in.");
    }
  }));

  el("rf-cloud-login").addEventListener("click", () => run(async () => {
    const { email, password } = credentials();
    if (!email || !password) throw new Error("Enter your email and password.");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
    el("rf-cloud-password").value = "";
    message("Signed in successfully.");
  }));

  el("rf-cloud-logout").addEventListener("click", () => run(async () => {
    const { error } = await client.auth.signOut();
    if (error) throw error;
    session = null;
    message("Signed out. Your existing local data has not been changed.");
  }));

  el("rf-cloud-upload").addEventListener("click", () => run(async () => {
    if (!session) throw new Error("Sign in first.");
    if (!confirm("Upload this browser's current RupeeFlow data to your cloud account? If cloud data already exists, it will be replaced.")) return;

    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {
      transactions: [], budget: 0,
      goal: { name: "My savings goal", target: 0, saved: 0 },
      budgets: {}
    };

    if (!data || typeof data !== "object" || !Array.isArray(data.transactions)) {
      throw new Error("Local data looks invalid. Upload cancelled.");
    }

    const { error } = await client.from(TABLE).upsert({
      user_id: session.user.id,
      data,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

    if (error) throw error;
    message("Upload complete. Your current device data is now saved to the cloud.");
  }));

  el("rf-cloud-download").addEventListener("click", () => run(async () => {
    if (!session) throw new Error("Sign in first.");
    if (!confirm("Download cloud data and replace this browser's current RupeeFlow data? Export a JSON backup first if needed.")) return;

    const { data: row, error } = await client
      .from(TABLE)
      .select("data, updated_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      throw new Error("No cloud backup exists yet. Upload data from the device that has your records first.");
    }
    if (!row.data || typeof row.data !== "object" || !Array.isArray(row.data.transactions)) {
      throw new Error("Cloud data has an unexpected format. Local data was not changed.");
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(row.data));
    message("Download complete. Reloading RupeeFlow with the cloud data…");
    location.reload();
  }));

  try {
    if (!window.supabase?.createClient) {
      throw new Error("Supabase library did not load. Check your internet connection and reload.");
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    client.auth.onAuthStateChange((_event, nextSession) => {
      session = nextSession;
      updateStatus();
    });
    client.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      session = data.session;
      updateStatus();
      message(session ? "Cloud connection ready." : "Cloud connection ready. Sign in to begin.");
    }).catch(error => message(error.message || "Could not check your sign-in status."));
  } catch (error) {
    el("rf-cloud-status").textContent = "Cloud sync could not initialize.";
    message(error.message || "Check your Supabase configuration.");
  }
})();

