import React, { useEffect, useState } from "react";
import {
  exportState,
  hashPassword,
  initialState,
  loadState,
  saveState,
  uid,
} from "./storage";
import { languages } from "./i18n";
import { adminCount, createFirstAdmin, loginUser } from "./supabase";

const nav = [
  ["dashboard", "⌂"],
  ["users", "♙"],
  ["games", "▣"],
  ["currencies", "◈"],
  ["accounts", "◎"],
  ["transactions", "↔"],
  ["debts", "◫"],
  ["cards", "▤"],
  ["permissions", "⚿"],
  ["settings", "⚙"],
  ["backup", "⇩"],
];

function useDB() {
  const [s, setS] = useState(loadState);
  useEffect(() => {
    saveState(s);
    const lang = languages[s.settings.language] || languages.en;
    document.documentElement.lang = s.settings.language;
    document.documentElement.dir = lang.dir;
    document.documentElement.dataset.theme = s.settings.theme;
  }, [s]);
  return [s, setS];
}

function Field(props) {
  return <input {...props} />;
}

export default function App() {
  const [db, setDb] = useDB();
  const [page, setPage] = useState("dashboard");
  const [open, setOpen] = useState(false);
  const [cloudAdmin, setCloudAdmin] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(true);
  const lang = languages[db.settings.language] || languages.en;
  const t = lang.t;

  // Restore cloud session from localStorage session id + cloudAdmin snapshot
  useEffect(() => {
    (async () => {
      try {
        const count = await adminCount();
        setHasAdmin(count > 0);
        if (db.session && db.cloudUser && db.cloudUser.id === db.session) {
          setCloudAdmin(db.cloudUser);
        }
      } catch (e) {
        console.error(e);
        // fallback: treat as no admin if network fails on first load
        setHasAdmin(false);
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  const admin = cloudAdmin;

  if (!authReady) {
    return (
      <div className="auth">
        <div className="authCard" style={{ textAlign: "center" }}>
          <div className="logo">₥</div>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <Auth
        t={t}
        langs={languages}
        lang={db.settings.language}
        setLang={(v) =>
          setDb((x) => ({
            ...x,
            settings: { ...x.settings, language: v },
          }))
        }
        hasAdmin={hasAdmin}
        login={async (u, p) => {
          try {
            const hash = await hashPassword(p);
            const res = await loginUser(u, hash);
            if (res?.error === "wrong" || !res?.id) return t.wrong;
            const user = {
              id: res.id,
              username: res.username,
              role: res.role,
              status: res.status,
              email: res.email || "",
            };
            setCloudAdmin(user);
            setDb({ ...db, session: user.id, cloudUser: user });
            return "";
          } catch {
            return t.wrong;
          }
        }}
        create={async (u, p, c) => {
          if (hasAdmin) return t.adminLocked;
          if (p.length < 8) return t.passwordRule;
          if (p !== c) return t.passwordMismatch;
          try {
            const hash = await hashPassword(p);
            const res = await createFirstAdmin(u, hash);
            if (res?.error === "admin_exists") {
              setHasAdmin(true);
              return t.adminLocked;
            }
            if (res?.error === "exists") return t.exists;
            if (!res?.id) return t.wrong;
            const user = {
              id: res.id,
              username: res.username,
              role: res.role || "admin",
              status: res.status || "active",
              email: "",
            };
            setHasAdmin(true);
            setCloudAdmin(user);
            setDb({ ...db, session: user.id, cloudUser: user });
            return "";
          } catch (e) {
            console.error(e);
            return String(e.message || e);
          }
        }}
      />
    );
  }

  const go = (p) => {
    setPage(p);
    setOpen(false);
  };

  return (
    <div className="shell">
      {open && (
        <button className="backdrop" onClick={() => setOpen(false)} />
      )}

      <header className="topbar">
        <button className="iconBtn" onClick={() => setOpen(!open)}>
          ☰
        </button>
        <div className="brand">
          <b>₥</b>
          <span>
            <strong>{db.settings.bankName}</strong>
            <small>Administration</small>
          </span>
        </div>
        <span className="admin">● {admin.username}</span>
        <button
          className="iconBtn"
          onClick={() => {
            setCloudAdmin(null);
            setDb({ ...db, session: null, cloudUser: null });
          }}
          title={t.logout}
        >
          ↪
        </button>
      </header>

      <aside className={"sidebar " + (open ? "open" : "")}>
        {nav.map(([k, i]) => (
          <button
            key={k}
            className={"nav " + (page === k ? "sel" : "")}
            onClick={() => go(k)}
          >
            <i>{i}</i>
            {t[k]}
          </button>
        ))}
      </aside>

      <main className="content">
        <div className="notice">
          ◆{" "}
          <span>
            <b>{t.localOnly}</b>
            <small>{t.localWarning}</small>
          </span>
        </div>

        {page === "dashboard" && <Dashboard db={db} t={t} go={go} />}
        {page === "users" && <Users db={db} setDb={setDb} t={t} />}
        {page === "games" && (
          <Crud db={db} setDb={setDb} t={t} type="games" title={t.games} />
        )}
        {page === "currencies" && (
          <Crud
            db={db}
            setDb={setDb}
            t={t}
            type="currencies"
            title={t.currencies}
          />
        )}
        {page === "accounts" && (
          <Crud db={db} setDb={setDb} t={t} type="accounts" title={t.accounts} />
        )}
        {page === "transactions" && (
          <List db={db} t={t} type="transactions" title={t.transactions} />
        )}
        {page === "debts" && (
          <Crud db={db} setDb={setDb} t={t} type="debts" title={t.debts} />
        )}
        {page === "cards" && (
          <Crud db={db} setDb={setDb} t={t} type="cards" title={t.cards} />
        )}
        {page === "permissions" && (
          <Permissions db={db} setDb={setDb} t={t} />
        )}
        {page === "settings" && <Settings db={db} setDb={setDb} t={t} />}
        {page === "backup" && <Backup db={db} setDb={setDb} t={t} />}
      </main>
    </div>
  );
}

function Auth({ t, langs, lang, setLang, hasAdmin, login, create }) {
  const canCreateAdmin = !hasAdmin;
  const [m, setM] = useState(canCreateAdmin ? "create" : "login");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [e, setE] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canCreateAdmin && m === "create") setM("login");
  }, [canCreateAdmin, m]);

  return (
    <div className="auth">
      <form
        className="authCard"
        onSubmit={async (x) => {
          x.preventDefault();
          setBusy(true);
          setE("");
          try {
            const err =
              m === "login" ? await login(u, p) : await create(u, p, c);
            if (err) setE(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="logo">₥</div>
        <h1>{t.bank}</h1>
        <p>{m === "login" ? t.login : t.createAdmin}</p>

        <Field
          required
          placeholder={t.username}
          value={u}
          onChange={(x) => setU(x.target.value)}
          autoComplete="username"
        />
        <Field
          required
          type="password"
          placeholder={t.password}
          value={p}
          onChange={(x) => setP(x.target.value)}
          autoComplete={m === "login" ? "current-password" : "new-password"}
        />

        {m === "create" && canCreateAdmin && (
          <Field
            required
            type="password"
            placeholder={t.confirm}
            value={c}
            onChange={(x) => setC(x.target.value)}
            autoComplete="new-password"
          />
        )}

        <button className="primary" type="submit" disabled={busy}>
          {busy ? "…" : m === "login" ? t.login : t.createAdmin}
        </button>

        {e && <div className="error">{e}</div>}

        <select value={lang} onChange={(x) => setLang(x.target.value)}>
          {Object.entries(langs).map(([k, v]) => (
            <option key={k} value={k}>
              {v.name}
            </option>
          ))}
        </select>

        {canCreateAdmin && m === "login" && (
          <button type="button" className="link" onClick={() => setM("create")}>
            {t.createAdmin}
          </button>
        )}

        <small className="legal">
          {t.localWarning}
          <br />
          {t.realMoney}
        </small>
      </form>
    </div>
  );
}

function Header({ title, sub }) {
  return (
    <div className="head">
      <div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
    </div>
  );
}

function Dashboard({ db, t, go }) {
  const stats = [
    ["users", db.users.length],
    ["games", db.games.length],
    ["currencies", db.currencies.length],
    ["accounts", db.accounts.length],
    ["transactions", db.transactions.length],
    ["permissions", db.permissions.length],
  ];

  return (
    <>
      <Header title={t.dashboard} sub={t.localWarning} />
      <div className="stats">
        {stats.map((x) => (
          <div className="stat" key={x[0]}>
            <small>{t[x[0]]}</small>
            <strong>{x[1]}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <h2>{t.quick}</h2>
        <div className="quick">
          {[
            ["users", t.newUser],
            ["games", t.newGame],
            ["currencies", t.newCurrency],
            ["accounts", t.newAccount],
            ["debts", t.newDebt],
            ["cards", t.newCard],
          ].map((x) => (
            <button key={x[0]} onClick={() => go(x[0])}>
              {x[1]} ＋
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function Users({ db, setDb, t }) {
  const [f, setF] = useState({ username: "", email: "", password: "" });

  return (
    <>
      <Header title={t.users} sub="Manage ecosystem accounts." />
      <section className="panel">
        <h2>{t.newUser}</h2>
        <div className="form">
          <input
            placeholder={t.username}
            value={f.username}
            onChange={(e) => setF({ ...f, username: e.target.value })}
          />
          <input
            placeholder={t.email}
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
          <input
            type="password"
            placeholder={t.password}
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />
          <button
            className="primary"
            onClick={async () => {
              if (!f.username || f.password.length < 8) return;
              if (db.users.some((x) => x.username === f.username)) return;
              const x = {
                id: uid("usr"),
                ...f,
                hash: await hashPassword(f.password),
                role: "user",
                status: "active",
              };
              delete x.password;
              setDb({ ...db, users: [...db.users, x] });
              setF({ username: "", email: "", password: "" });
            }}
          >
            {t.add}
          </button>
        </div>
      </section>
      <List db={db} setDb={setDb} t={t} type="users" title={t.users} />
    </>
  );
}

function Crud({ db, setDb, t, type, title }) {
  const [f, setF] = useState({
    name: "",
    code: "",
    symbol: "",
    amount: 0,
    description: "",
  });
  const arr = db[type] || [];

  return (
    <>
      <Header title={title} sub="Manage virtual Modren ecosystem data." />
      <section className="panel">
        <h2>{t.add}</h2>
        <div className="form">
          <input
            placeholder={t.name}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
          <input
            placeholder={t.code}
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value })}
          />
          <input
            placeholder={t.symbol}
            value={f.symbol}
            onChange={(e) => setF({ ...f, symbol: e.target.value })}
          />
          <input
            type="number"
            placeholder={t.amount}
            value={f.amount}
            onChange={(e) => setF({ ...f, amount: e.target.value })}
          />
          <button
            className="primary"
            onClick={() => {
              setDb({
                ...db,
                [type]: [
                  ...arr,
                  {
                    id: uid(type.slice(0, -1) || "item"),
                    ...f,
                    status: "active",
                  },
                ],
              });
              setF({
                name: "",
                code: "",
                symbol: "",
                amount: 0,
                description: "",
              });
            }}
          >
            {t.add}
          </button>
        </div>
      </section>
      <List db={db} setDb={setDb} t={t} type={type} title={title} />
    </>
  );
}

function List({ db, setDb, t, type, title }) {
  const arr = db[type] || [];

  return (
    <section className="panel">
      <h2>{title}</h2>
      {!arr.length ? (
        <div className="empty">{t.noData}</div>
      ) : (
        <div className="list">
          {arr.map((x) => (
            <article key={x.id}>
              <div>
                <b>{x.name || x.username || x.symbol || x.id}</b>
                <small>
                  {x.email || x.code || x.description || x.amount || x.status || ""}
                </small>
              </div>
              {type === "users" && x.role !== "admin" && (
                <div className="actions">
                  <button
                    onClick={() =>
                      setDb({
                        ...db,
                        users: db.users.map((u) =>
                          u.id === x.id
                            ? {
                                ...u,
                                status:
                                  u.status === "active" ? "frozen" : "active",
                              }
                            : u
                        ),
                      })
                    }
                  >
                    {x.status === "active" ? t.freeze : t.unfreeze}
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      setDb({
                        ...db,
                        users: db.users.filter((u) => u.id !== x.id),
                      })
                    }
                  >
                    {t.delete}
                  </button>
                </div>
              )}
              {type !== "users" && (
                <button
                  className="danger"
                  onClick={() =>
                    setDb({
                      ...db,
                      [type]: arr.filter((a) => a.id !== x.id),
                    })
                  }
                >
                  {t.delete}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Permissions({ db, setDb, t }) {
  const [u, setU] = useState("");
  const [g, setG] = useState("");

  return (
    <>
      <Header title={t.permissions} sub="Targeted permissions." />
      <section className="panel">
        <h2>{t.grant}</h2>
        <div className="form">
          <select value={u} onChange={(e) => setU(e.target.value)}>
            <option value="">{t.targetUser}</option>
            {db.users.map((x) => (
              <option key={x.id} value={x.id}>
                {x.username}
              </option>
            ))}
          </select>
          <select value={g} onChange={(e) => setG(e.target.value)}>
            <option value="">{t.targetGame}</option>
            {db.games.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <button
            className="primary"
            onClick={() => {
              if (u && g)
                setDb({
                  ...db,
                  permissions: [
                    ...db.permissions,
                    {
                      id: uid("perm"),
                      userId: u,
                      gameId: g,
                      unlimited: true,
                    },
                  ],
                });
            }}
          >
            {t.grant}
          </button>
        </div>
      </section>
      <List db={db} setDb={setDb} t={t} type="permissions" title={t.permissions} />
    </>
  );
}

function Settings({ db, setDb, t }) {
  return (
    <>
      <Header
        title={t.settings}
        sub="Language, appearance and update configuration."
      />
      <section className="panel">
        <div className="form">
          <label>
            {t.language}
            <select
              value={db.settings.language}
              onChange={(e) =>
                setDb({
                  ...db,
                  settings: { ...db.settings, language: e.target.value },
                })
              }
            >
              {Object.entries(languages).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.theme}
            <select
              value={db.settings.theme}
              onChange={(e) =>
                setDb({
                  ...db,
                  settings: { ...db.settings, theme: e.target.value },
                })
              }
            >
              <option value="dark">{t.dark}</option>
              <option value="light">{t.light}</option>
            </select>
          </label>
          <label>
            {t.bank}
            <input
              value={db.settings.bankName}
              onChange={(e) =>
                setDb({
                  ...db,
                  settings: { ...db.settings, bankName: e.target.value },
                })
              }
            />
          </label>
          <label>
            {t.updateUrl}
            <input
              value={db.settings.updateUrl}
              onChange={(e) =>
                setDb({
                  ...db,
                  settings: { ...db.settings, updateUrl: e.target.value },
                })
              }
            />
          </label>
        </div>
      </section>
    </>
  );
}

function Backup({ db, setDb, t }) {
  return (
    <>
      <Header title={t.backup} sub="Portable local backup and restore." />
      <section className="panel">
        <button className="primary" onClick={() => exportState(db)}>
          {t.export}
        </button>
        <label className="file">
          {t.import}
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const f = e.target.files[0];
              if (!f) return;
              const r = new FileReader();
              r.onload = () => {
                try {
                  const x = JSON.parse(r.result);
                  setDb({ ...initialState(), ...x, session: db.session, cloudUser: db.cloudUser });
                } catch {}
              };
              r.readAsText(f);
            }}
          />
        </label>
      </section>
      <section className="panel">
        <h2>{t.deleteAccount}</h2>
        <button
          className="danger"
          onClick={() => {
            if (confirm(t.deleteAccount)) {
              localStorage.clear();
              location.reload();
            }
          }}
        >
          {t.deleteAccount}
        </button>
      </section>
    </>
  );
}
