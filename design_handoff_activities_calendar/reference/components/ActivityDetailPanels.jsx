/* global React */
// ActivityDetailPanels.jsx — NotesPanel, ExpensesPanel, AttachmentsPanel


const DT = window.DRAWER_TOKENS;

function fmtRelative(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 86400*7) return `${Math.floor(diff/86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ────────────────────────────────────────────────────────────────────────────
// NotesPanel — conversational log (existing notes + add-new composer)
// ────────────────────────────────────────────────────────────────────────────
function NotesPanel({ notes, onAdd, onDelete, readOnly, owner }) {
  const [draft, setDraft] = React.useState('');
  const [focused, setFocused] = React.useState(false);

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    onAdd?.({ id: 'n_' + Date.now(), body, author: 'You', createdAt: new Date().toISOString() });
    setDraft('');
    setFocused(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Composer */}
      {!readOnly && (
        <div style={{
          border: `1px solid ${focused ? DT.plum : DT.borderMid}`,
          borderRadius: 10,
          background: DT.bgWhite,
          transition: 'border-color 120ms',
          overflow: 'hidden',
        }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
            }}
            placeholder="Log a note… what was discussed, key takeaways, blockers."
            rows={focused || draft ? 4 : 2}
            style={{
              width: '100%', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5,
              color: DT.ink, padding: 12, border: 'none', outline: 'none',
              resize: 'vertical', background: 'transparent',
              boxSizing: 'border-box',
            }}
          />
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px 8px',
            borderTop: `1px solid ${DT.border}`,
            background: DT.bgSurf,
          }}>
            <span style={{ fontSize: 10, color: DT.inkMuted, fontWeight: 500 }}>
              ⌘↵ to save · markdown supported
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setDraft('')} disabled={!draft}
                style={{
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                  padding: '5px 10px', borderRadius: 6,
                  border: `1px solid ${DT.border}`, background: DT.bgWhite, color: DT.inkBody,
                  cursor: draft ? 'pointer' : 'not-allowed', opacity: draft ? 1 : 0.5,
                }}>Clear</button>
              <button onClick={submit} disabled={!draft.trim()}
                style={{
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                  padding: '5px 12px', borderRadius: 6,
                  border: 'none', background: draft.trim() ? DT.plum : DT.borderMid,
                  color: DT.bgWhite, cursor: draft.trim() ? 'pointer' : 'not-allowed',
                }}>Add note</button>
            </div>
          </div>
        </div>
      )}

      {/* Existing notes */}
      {notes.length === 0 && readOnly && (
        <div style={{ fontSize: 12, color: DT.inkMuted, fontStyle: 'italic', padding: '12px 0' }}>
          No notes yet.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes.map(n => (
          <div key={n.id} style={{
            padding: 12, borderRadius: 10,
            border: `1px solid ${DT.border}`,
            background: DT.bgSurf,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 999,
                background: DT.plum, color: DT.bgWhite,
                fontSize: 10, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{(n.author || 'U').split(' ').map(s => s[0]).slice(0,2).join('')}</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: DT.ink }}>{n.author}</span>
              <span style={{ fontSize: 11, color: DT.inkSub }}>· {fmtRelative(n.createdAt)}</span>
              {!readOnly && n.author === 'You' && (
                <button onClick={() => onDelete?.(n.id)}
                  style={{
                    marginLeft: 'auto', fontFamily: 'inherit', fontSize: 11,
                    padding: '2px 6px', borderRadius: 4, border: 'none',
                    background: 'transparent', color: DT.inkMuted, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = DT.coral}
                  onMouseLeave={(e) => e.currentTarget.style.color = DT.inkMuted}
                >Delete</button>
              )}
            </div>
            <div style={{
              fontSize: 13, color: DT.inkStrong, lineHeight: 1.55, whiteSpace: 'pre-wrap',
            }}>{n.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ExpensesPanel — line items with category, amount, receipt
// ────────────────────────────────────────────────────────────────────────────
const EXPENSE_CATS = [
  { id: 'travel',  label: 'Travel',  tint: '#e8f1f5', ink: '#4d7285' },
  { id: 'meals',   label: 'Meals',   tint: '#fffaf1', ink: '#997c43' },
  { id: 'lodging', label: 'Lodging', tint: '#EDFFE3', ink: '#5f665b' },
  { id: 'swag',    label: 'Swag',    tint: '#fef1f0', ink: '#c25a52' },
  { id: 'other',   label: 'Other',   tint: '#F7F5FA', ink: '#6E6390' },
];

function ExpensesPanel({ expenses, onChange, readOnly }) {
  const [adding, setAdding] = React.useState(false);
  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const add = (row) => {
    onChange?.([...expenses, { id: 'e_' + Date.now(), ...row }]);
    setAdding(false);
  };
  const remove = (id) => onChange?.(expenses.filter(e => e.id !== id));
  const patch = (id, p) => onChange?.(expenses.map(e => e.id === id ? { ...e, ...p } : e));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Summary strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderRadius: 10,
        background: DT.bgRaised, border: `1px solid ${DT.border}`,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: DT.inkSub, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Total expenses
          </div>
          <div style={{
            fontSize: 24, fontWeight: 700, color: DT.ink, letterSpacing: '-0.015em',
            fontVariantNumeric: 'tabular-nums', marginTop: 2,
          }}>
            ${total.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: DT.inkSub }}>{expenses.length} item{expenses.length !== 1 ? 's' : ''}</div>
          {expenses.some(e => !e.receipt) && (
            <div style={{
              fontSize: 10, fontWeight: 600, color: DT.goldInk,
              background: DT.goldSoft, border: `1px solid ${DT.gold}`,
              padding: '2px 8px', borderRadius: 999, marginTop: 4, display: 'inline-block',
            }}>
              {expenses.filter(e => !e.receipt).length} missing receipt
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {expenses.map(ex => {
          const cat = EXPENSE_CATS.find(c => c.id === ex.category) || EXPENSE_CATS[4];
          return (
            <div key={ex.id} style={{
              display: 'grid', gridTemplateColumns: '92px 1fr auto auto',
              gap: 10, alignItems: 'center',
              padding: '10px 12px',
              borderRadius: 8, border: `1px solid ${DT.border}`, background: DT.bgWhite,
            }}>
              <span style={{
                padding: '3px 8px', borderRadius: 999,
                background: cat.tint, color: cat.ink,
                fontSize: 11, fontWeight: 600, textAlign: 'center',
              }}>{cat.label}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: DT.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ex.description}
                </div>
                <div style={{ fontSize: 11, color: DT.inkSub, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {ex.date && <span>{new Date(ex.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  {ex.receipt ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: DT.mintDot }}>
                      <window.PaperclipIcon size={10} /> receipt
                    </span>
                  ) : (
                    <span style={{ color: DT.goldInk, fontWeight: 500 }}>No receipt</span>
                  )}
                </div>
              </div>
              <span style={{
                fontSize: 14, fontWeight: 700, color: DT.ink,
                fontVariantNumeric: 'tabular-nums',
              }}>${Number(ex.amount).toFixed(2)}</span>
              {!readOnly && (
                <button onClick={() => remove(ex.id)}
                  style={{
                    width: 28, height: 28, border: 'none', background: 'transparent',
                    borderRadius: 6, color: DT.inkMuted, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = DT.coral; e.currentTarget.style.background = DT.coralSoft; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = DT.inkMuted; e.currentTarget.style.background = 'transparent'; }}
                >
                  <window.TrashIcon size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add row */}
      {!readOnly && (adding ? (
        <ExpenseEditor onSave={add} onCancel={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)}
          style={{
            fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
            padding: '10px 12px', borderRadius: 8,
            border: `1px dashed ${DT.borderStrong}`,
            background: 'transparent', color: DT.inkBody, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = DT.bgHover; e.currentTarget.style.color = DT.plum; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = DT.inkBody; }}
        >
          <window.PlusIcon size={14} /> Add expense
        </button>
      ))}
    </div>
  );
}

function ExpenseEditor({ onSave, onCancel }) {
  const [cat, setCat] = React.useState('meals');
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = React.useState(null);
  const fileRef = React.useRef(null);

  const save = () => {
    if (!description.trim() || !amount) return;
    onSave({ category: cat, amount: Number(amount), description: description.trim(), date, receipt: receipt?.name || null });
  };

  return (
    <div style={{
      padding: 14, borderRadius: 10,
      border: `1px solid ${DT.plum}`, background: DT.bgWhite,
      boxShadow: '0 4px 12px rgba(64,55,112,0.08)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: DT.plum, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        New expense
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <window.FieldLabel>Category</window.FieldLabel>
          <select value={cat} onChange={(e) => setCat(e.target.value)}
            style={inputStyle}>
            {EXPENSE_CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <window.FieldLabel>Amount</window.FieldLabel>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: DT.inkMuted, fontSize: 13,
            }}>$</span>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" step="0.01"
              style={{ ...inputStyle, paddingLeft: 20 }} />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <window.FieldLabel>Description</window.FieldLabel>
        <input value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Coffee with Westfield ISD principal"
          style={inputStyle} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div>
          <window.FieldLabel>Date</window.FieldLabel>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={inputStyle} />
        </div>
        <div>
          <window.FieldLabel optional>Receipt</window.FieldLabel>
          <input ref={fileRef} type="file" accept="image/*,application/pdf"
            onChange={(e) => setReceipt(e.target.files?.[0] || null)}
            style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', fontFamily: 'inherit', fontSize: 12,
              padding: '6px 10px', borderRadius: 6,
              border: `1px solid ${DT.borderMid}`, background: DT.bgWhite, color: DT.inkBody,
              cursor: 'pointer', textAlign: 'left',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
            <window.PaperclipIcon size={12} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {receipt ? receipt.name : 'Attach receipt'}
            </span>
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onCancel} style={expBtnGhost}>Cancel</button>
        <button onClick={save}
          disabled={!description.trim() || !amount}
          style={{
            ...expBtnPrimary,
            opacity: (!description.trim() || !amount) ? 0.5 : 1,
            cursor: (!description.trim() || !amount) ? 'not-allowed' : 'pointer',
          }}>Save expense</button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', fontFamily: 'inherit', fontSize: 13,
  padding: '7px 10px', borderRadius: 6,
  border: `1px solid ${DT.borderMid}`, background: DT.bgWhite, color: DT.ink,
  boxSizing: 'border-box',
};
const expBtnGhost = {
  fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
  padding: '6px 12px', borderRadius: 6,
  border: `1px solid ${DT.border}`, background: DT.bgWhite, color: DT.inkBody,
  cursor: 'pointer',
};
const expBtnPrimary = {
  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
  padding: '6px 14px', borderRadius: 6,
  border: 'none', background: DT.plum, color: DT.bgWhite, cursor: 'pointer',
};

// ────────────────────────────────────────────────────────────────────────────
// AttachmentsPanel — grid for photos + list for files + drop zone
// ────────────────────────────────────────────────────────────────────────────
function AttachmentsPanel({ attachments, onChange, readOnly }) {
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef(null);
  const camRef = React.useRef(null);

  const photos = attachments.filter(a => a.kind === 'photo');
  const files  = attachments.filter(a => a.kind !== 'photo');

  const addFiles = (fileList) => {
    const next = Array.from(fileList || []).map(f => ({
      id: 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      kind: f.type.startsWith('image/') ? 'photo' : 'file',
      name: f.name,
      size: f.size,
      mime: f.type,
      url: URL.createObjectURL(f),
      uploadedBy: 'You',
      uploadedAt: new Date().toISOString(),
    }));
    onChange?.([...attachments, ...next]);
  };

  const remove = (id) => {
    const a = attachments.find(x => x.id === id);
    if (a?.url?.startsWith('blob:')) URL.revokeObjectURL(a.url);
    onChange?.(attachments.filter(x => x.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Drop zone */}
      {!readOnly && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          style={{
            padding: '20px 16px', borderRadius: 12,
            border: `2px dashed ${dragging ? DT.coral : DT.borderStrong}`,
            background: dragging ? DT.coralSoft : DT.bgSurf,
            textAlign: 'center',
            transition: 'all 120ms',
          }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38, borderRadius: 999,
            background: DT.bgWhite, border: `1px solid ${DT.border}`,
            color: DT.plum, marginBottom: 8,
          }}>
            <window.PaperclipIcon size={18} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: DT.ink }}>
            {dragging ? 'Drop to attach' : 'Drag files here'}
          </div>
          <div style={{ fontSize: 11, color: DT.inkSub, marginTop: 3 }}>
            Photos, PDFs, docs up to 20MB
          </div>
          <div style={{ display: 'inline-flex', gap: 8, marginTop: 10 }}>
            <input ref={fileRef} type="file" multiple
              onChange={(e) => addFiles(e.target.files)}
              style={{ display: 'none' }} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" multiple
              onChange={(e) => addFiles(e.target.files)}
              style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()}
              style={{
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                padding: '6px 12px', borderRadius: 6,
                border: `1px solid ${DT.borderMid}`, background: DT.bgWhite, color: DT.ink,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              <window.PaperclipIcon size={12} /> Browse files
            </button>
            <button onClick={() => camRef.current?.click()}
              style={{
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                padding: '6px 12px', borderRadius: 6,
                border: 'none', background: DT.plum, color: DT.bgWhite, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              <window.CameraIcon size={12} /> Take photo
            </button>
          </div>
        </div>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: DT.inkSub, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Photos · {photos.length}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
          }}>
            {photos.map(p => (
              <div key={p.id} style={{
                position: 'relative', aspectRatio: '1 / 1', borderRadius: 8,
                overflow: 'hidden', background: DT.bgHover,
                border: `1px solid ${DT.border}`,
              }}>
                <img src={p.url} alt={p.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                {/* Gradient + name overlay */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.55))',
                  padding: '10px 8px 6px',
                  color: '#fff', fontSize: 10, fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{p.name}</div>
                {!readOnly && (
                  <button onClick={() => remove(p.id)}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 22, height: 22, borderRadius: 999,
                      border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff',
                      cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <window.XIcon size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: DT.inkSub, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Files · {files.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${DT.border}`, background: DT.bgWhite,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                  background: DT.bgHover, color: DT.plum,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <window.FileIcon size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: DT.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: 11, color: DT.inkSub, marginTop: 2 }}>
                    {fmtBytes(f.size)} · {f.uploadedBy} · {fmtRelative(f.uploadedAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <IconBtn title="Download"><window.DownloadIcon size={14} /></IconBtn>
                  {!readOnly && (
                    <IconBtn onClick={() => remove(f.id)} title="Remove" danger>
                      <window.TrashIcon size={14} />
                    </IconBtn>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {attachments.length === 0 && readOnly && (
        <div style={{ fontSize: 12, color: DT.inkMuted, fontStyle: 'italic', padding: '12px 0' }}>
          Nothing attached.
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, danger, title }) {
  return (
    <button onClick={onClick} title={title}
      style={{
        width: 28, height: 28, borderRadius: 6, border: 'none',
        background: 'transparent', color: DT.inkBody, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? DT.coralSoft : DT.bgHover;
        e.currentTarget.style.color = danger ? DT.coral : DT.plum;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = DT.inkBody;
      }}
    >{children}</button>
  );
}

function fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  return (b/(1024*1024)).toFixed(1) + ' MB';
}

Object.assign(window, { NotesPanel, ExpensesPanel, AttachmentsPanel });
