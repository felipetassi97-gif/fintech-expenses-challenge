import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, request } from "./api";
import type { Category } from "./api";
import { Heading, Modal, State, errorText, useLoad } from "./shared";
export function Categories({
  token,
  logout,
}: {
  token: string;
  logout: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const { data, loading, error } = useLoad<Category[]>(
    "/categories",
    token,
    logout,
    revision,
  );
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  function edit(c: Category | "new") {
    setEditing(c);
    setName(c === "new" ? "" : c.name);
    setDescription(c === "new" ? "" : c.description || "");
    setMessage("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMessage("");
    try {
      await request(
        editing === "new" ? "/categories" : `/categories/${editing.id}`,
        {
          token,
          method: editing === "new" ? "POST" : "PATCH",
          body: { name: name.trim(), description: description.trim() || null },
        },
      );
      setEditing(null);
      setRevision((n) => n + 1);
      setMessage("Categoria salva com sucesso.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else if (err instanceof ApiError && err.status === 409)
        setMessage("Esta categoria possui transações e não pode ser excluída.");
      else setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: Category) {
    if (!window.confirm(`Excluir a categoria “${c.name}”?`)) return;
    try {
      await request(`/categories/${c.id}`, { method: "DELETE", token });
      setRevision((n) => n + 1);
      setMessage("Categoria excluída.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else setMessage(errorText(err));
    }
  }
  return (
    <>
      <Heading
        eyebrow="ORGANIZAÇÃO"
        title="Categorias"
        description="Organize suas movimentações da maneira que faz sentido para você."
        action={
          <button className="button primary" onClick={() => edit("new")}>
            + Nova categoria
          </button>
        }
      />
      {message && (
        <p role="status" className="alert">
          {message}
        </p>
      )}
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Suas categorias</h2>
            <p>Crie e gerencie os grupos dos seus lançamentos.</p>
          </div>
        </div>
        <State loading={loading} error={error} />
        {!loading &&
          data &&
          (data.length ? (
            <div
              className="table-wrap"
              role="region"
              aria-label="Tabela de categorias"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Descrição</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.description || "—"}</td>
                      <td className="actions">
                        <button onClick={() => edit(c)}>Editar</button>
                        <button onClick={() => remove(c)}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">
              Nenhuma categoria cadastrada. Crie uma para começar.
            </p>
          ))}
      </section>
      {editing && (
        <Modal titleId="category-title" onClose={() => setEditing(null)}>
          <h2 id="category-title">
            {editing === "new" ? "Nova categoria" : "Editar categoria"}
          </h2>
          <p>Use um nome que ajude a identificar suas movimentações.</p>
          <form onSubmit={save}>
            <label>
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                autoFocus
              />
            </label>
            <label>
              Descrição <span className="muted">(opcional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </label>
            {message && (
              <p role="alert" className="alert error">
                {message}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button disabled={busy} className="button primary">
                {busy ? "Salvando..." : "Salvar categoria"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
