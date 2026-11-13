import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, request } from "./api";
import type { Category } from "./api";
import type { WriteOperation } from "./write-operation";
import { Heading, Modal, State, errorText } from "./shared";
export function Categories({
  token,
  logout,
  data,
  loading,
  error,
  write,
}: {
  token: string;
  logout: () => void;
  data: Category[] | null;
  loading: boolean;
  error: string;
  write: WriteOperation;
}) {
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const busy = write.busy;
  const operation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  function edit(c: Category | "new") {
    if (operation.current || busy) return;
    setEditing(c);
    setName(c === "new" ? "" : c.name);
    setDescription(c === "new" ? "" : c.description || "");
    setMessage("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing || operation.current || !write.start()) return;
    operation.current = true;
    setMessage("");
    let changed: "categories" | null = null;
    try {
      await request(
        editing === "new" ? "/categories" : `/categories/${editing.id}`,
        {
          token,
          method: editing === "new" ? "POST" : "PATCH",
          body: { name: name.trim(), description: description.trim() || null },
        },
      );
      changed = "categories";
      if (mounted.current) {
        setEditing(null);
        setMessage("Categoria salva com sucesso.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && write.isActive()) logout();
      else if (mounted.current) setMessage(errorText(err));
    } finally {
      operation.current = false;
      write.finish(changed);
    }
  }
  async function remove(c: Category) {
    if (operation.current || busy) return;
    if (!window.confirm(`Excluir a categoria “${c.name}”?`)) return;
    if (!write.start()) return;
    operation.current = true;
    let changed: "categories" | null = null;
    try {
      await request(`/categories/${c.id}`, { method: "DELETE", token });
      changed = "categories";
      if (mounted.current) setMessage("Categoria excluída.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && write.isActive()) logout();
      else if (mounted.current) setMessage(errorText(err));
    } finally {
      operation.current = false;
      write.finish(changed);
    }
  }
  return (
    <>
      <Heading
        eyebrow="ORGANIZAÇÃO"
        title="Categorias"
        description="Organize suas movimentações da maneira que faz sentido para você."
        action={
          <button className="button primary" onClick={() => edit("new")} disabled={busy}>
            + Nova categoria
          </button>
        }
      />
      {message && (
        <p role="status" className="alert">
          {message}
        </p>
      )}
      <section className="panel workspace-panel">
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
                        <button onClick={() => edit(c)} disabled={busy}>Editar</button>
                        <button onClick={() => remove(c)} disabled={busy}>Excluir</button>
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
        <Modal
          titleId="category-title"
          onClose={() => {
            if (!busy && !operation.current) setEditing(null);
          }}
        >
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
                disabled={busy}
              />
            </label>
            <label>
              Descrição <span className="muted">(opcional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                disabled={busy}
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
                disabled={busy}
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
