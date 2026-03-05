import { useState, useEffect, useRef } from 'react'
import { db } from './firebase.js'
import { doc, onSnapshot, collection, query, where, setDoc, getDoc } from 'firebase/firestore'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0A0A', panel: '#141414', card: '#1C1C1C', border: '#262626',
  red: '#EA4335', yellow: '#F2C94C', green: '#27AE60', blue: '#2F80ED',
  purple: '#9B51E0', navy: '#00194C',
  text: '#E8E8E8', muted: '#555', white: '#FFF',
}

const CAT_COLORS = {
  JAMBES:    { bg: '#F2C94C', text: '#1a1000' },
  POUSSEE:   { bg: '#2F80ED', text: '#FFF' },
  TIRAGE:    { bg: '#27AE60', text: '#FFF' },
  'FULL BODY': { bg: '#9B51E0', text: '#FFF' },
  CARDIO:    { bg: '#EA4335', text: '#FFF' },
}

function catColor(label = '') {
  const k = label.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')[0]
  return CAT_COLORS[k] || CAT_COLORS['FULL BODY']
}

function uid() { return Math.random().toString(36).slice(2, 9) }

// ── Global styles injected once ───────────────────────────────────────────────
const GLOBAL_CSS = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; background: ${C.bg}; font-family: 'Barlow Condensed','Arial Narrow',sans-serif;
    color: ${C.text}; overscroll-behavior: none; -webkit-font-smoothing: antialiased; }
  input, select, textarea { font-family: inherit; }
  ::-webkit-scrollbar { width: 0; height: 0; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
  .fade-in { animation: fadeIn .25s ease forwards; }
`

function InjectStyles() {
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = GLOBAL_CSS
    document.head.appendChild(el)
    return () => el.remove()
  }, [])
  return null
}

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [athleteId, setAthleteId] = useState(null)
  const [athlete, setAthlete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('programme')
  const [online, setOnline] = useState(true)
  const [cahiers, setCahiers] = useState({})
  const [toast, setToast] = useState(null)

  // Read athlete ID from URL — or from localStorage (needed when PWA launched from home screen)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const idFromUrl = params.get('id')
    if (idFromUrl) {
      try { localStorage.setItem('avid_athlete_id', idFromUrl) } catch(e) {}
      setAthleteId(idFromUrl)
      return
    }
    // No URL param — try saved ID (PWA standalone mode)
    try {
      const saved = localStorage.getItem('avid_athlete_id')
      if (saved) { setAthleteId(saved); return }
    } catch(e) {}
    setError('no_id')
    setLoading(false)
  }, [])

  // Subscribe to athlete data
  useEffect(() => {
    if (!athleteId) return
    const unsub = onSnapshot(
      doc(db, 'athletes', athleteId),
      (snap) => {
        if (snap.exists()) { setAthlete({ id: snap.id, ...snap.data() }); setOnline(true) }
        else setError('not_found')
        setLoading(false)
      },
      () => { setOnline(false); setLoading(false); setError('offline') }
    )
    return unsub
  }, [athleteId])

  // Subscribe to cahier data
  useEffect(() => {
    if (!athleteId) return
    const q = query(collection(db, 'cahiers'), where('athleteId', '==', athleteId))
    const unsub = onSnapshot(q, (snap) => {
      const data = {}
      snap.docs.forEach(d => { data[d.id] = d.data() })
      setCahiers(data)
    }, () => {})
    return unsub
  }, [athleteId])

  function notify(msg, color = C.green) {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2800)
  }

  async function saveCahier(key, data) {
    try {
      await setDoc(doc(db, 'cahiers', key), { athleteId, data, updatedAt: Date.now() })
    } catch (e) { notify('⚠ Erreur sauvegarde', C.red) }
  }

  if (loading) return <LoadingScreen />
  if (error === 'no_id') return <ErrorScreen msg="Lien invalide" sub="Demande un nouveau lien à ton coach." />
  if (error === 'not_found') return <ErrorScreen msg="Athlète introuvable" sub="Ce lien ne correspond à aucun profil." />
  if (error === 'offline') return <ErrorScreen msg="Hors ligne" sub="Vérifie ta connexion et réessaie." />

  const TABS = [
    { id: 'programme', icon: '📋', label: 'Programme' },
    { id: 'stats',     icon: '📈',  label: 'Stats' },
    { id: 'profil',    icon: '👤',  label: 'Profil' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <InjectStyles />

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`,
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>AVID PERFORMANCE LAB</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.white, letterSpacing: 1 }}>
            {athlete?.prenom} {athlete?.nom}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: online ? C.green : C.red }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 80 }}>
        {tab === 'programme' && <ProgrammeView athlete={athlete} cahiers={cahiers} saveCahier={saveCahier} notify={notify} />}
        {tab === 'stats'     && <StatsView athlete={athlete} cahiers={cahiers} />}
        {tab === 'profil'    && <ProfilView athlete={athlete} cahiers={cahiers} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: C.panel, borderTop: `1px solid ${C.border}`,
        display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, border: 'none', background: 'none', padding: '10px 4px 8px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 20, filter: tab === t.id ? 'none' : 'grayscale(1) opacity(.5)' }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1,
              color: tab === t.id ? C.yellow : C.muted }}>{t.label.toUpperCase()}</span>
            {tab === t.id && <div style={{ width: 20, height: 2, background: C.yellow, borderRadius: 1 }} />}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: toast.color, color: C.white, padding: '10px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 700, letterSpacing: 1, zIndex: 999,
          boxShadow: '0 4px 24px rgba(0,0,0,.6)', animation: 'fadeIn .2s ease' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── Programme View ────────────────────────────────────────────────────────────
function ProgrammeView({ athlete, cahiers, saveCahier, notify }) {
  const [blocIdx, setBlocIdx] = useState(0)
  const [semIdx, setSemIdx] = useState(0)
  const [openSea, setOpenSea] = useState(null)   // { idx, mode: 'prescrit'|'cahier' }

  if (!athlete?.blocs?.length) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
      <div style={{ fontSize: 14, color: C.muted }}>Aucun programme disponible</div>
    </div>
  )

  const bloc = athlete.blocs[blocIdx]
  const sem = bloc?.semaines[semIdx]

  if (openSea !== null) {
    const sea = sem?.seances[openSea.idx]
    if (!sea) { setOpenSea(null); return null }
    const key = `${athlete.id}-${bloc.id}-${sem.id}-${openSea.idx}`
    const readOnly = openSea.mode === 'prescrit'
    return (
      <SeanceDetail
        seance={sea}
        readOnly={readOnly}
        cahierData={readOnly ? null : cahiers[key]?.data}
        onBack={() => setOpenSea(null)}
        notify={notify}
        onSaveCahier={async (data) => { await saveCahier(key, data) }}
      />
    )
  }

  return (
    <div className="fade-in" style={{ padding: '16px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>BLOCS</div>

      {/* Bloc selector */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 14 }}>
        {athlete.blocs.map((b, i) => (
          <button key={b.id} onClick={() => { setBlocIdx(i); setSemIdx(0) }}
            style={{ flexShrink: 0, background: blocIdx === i ? C.yellow : C.card,
              color: blocIdx === i ? C.navy : C.muted,
              border: `1px solid ${blocIdx === i ? C.yellow : C.border}`,
              borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 800,
              cursor: 'pointer', letterSpacing: 1 }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Semaine selector */}
      {bloc?.semaines?.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>SEMAINE</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
            {bloc.semaines.map((s, i) => (
              <button key={s.id} onClick={() => setSemIdx(i)}
                style={{ flexShrink: 0, background: semIdx === i ? C.white : C.card,
                  color: semIdx === i ? C.bg : C.muted,
                  border: `1px solid ${semIdx === i ? C.white : C.border}`,
                  borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', letterSpacing: 1 }}>
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Séances — double carte prescrit + cahier */}
      {sem?.seances?.map((sea, i) => {
        const cc = catColor(sea.label)
        const key = `${athlete.id}-${bloc.id}-${sem.id}-${i}`
        const cahierSea = cahiers[key]?.data
        const isDone = cahierSea?.some(c => c.series?.some(s => s.kg))
        const exCount = sea.exercices?.length || 0

        return (
          <div key={sea.id || i} style={{ marginBottom: 14 }}>
            {/* Étiquette séance */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ background: cc.bg, color: cc.text, fontSize: 9, fontWeight: 800,
                padding: '2px 10px', borderRadius: 3, letterSpacing: 1 }}>{sea.label}</div>
              <div style={{ fontSize: 10, color: C.muted }}>S{sea.num} · {exCount} exercice{exCount !== 1 ? 's' : ''}</div>
              {isDone && <div style={{ fontSize: 10, color: C.green, fontWeight: 700, marginLeft: 'auto' }}>✓ COMPLÉTÉ</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {/* Carte PRESCRIT */}
              <div onClick={() => setOpenSea({ idx: i, mode: 'prescrit' })}
                style={{ background: C.card, borderRadius: 10, padding: '12px 14px',
                  border: `1px solid ${C.border}`, borderTop: `3px solid ${cc.bg}`,
                  cursor: 'pointer' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>
                  📋 PRESCRIT
                </div>
                <div style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>
                  {sea.exercices?.slice(0, 3).map(ex => (
                    <div key={ex.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', color: C.muted, fontSize: 10 }}>
                      {ex.nom}
                    </div>
                  ))}
                  {(sea.exercices?.length || 0) > 3 && (
                    <div style={{ fontSize: 10, color: C.muted }}>+{sea.exercices.length - 3} autres</div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: cc.bg, fontWeight: 700, marginTop: 8 }}>Voir détail ›</div>
              </div>

              {/* Carte CAHIER */}
              <div onClick={() => setOpenSea({ idx: i, mode: 'cahier' })}
                style={{ background: isDone ? '#0a1f0a' : C.card, borderRadius: 10, padding: '12px 14px',
                  border: `1px solid ${isDone ? C.green : C.border}`,
                  borderTop: `3px solid ${isDone ? C.green : C.muted}`,
                  cursor: 'pointer' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: isDone ? C.green : C.muted,
                  letterSpacing: 1, marginBottom: 6 }}>
                  ✏️ MON CAHIER
                </div>
                {isDone ? (
                  <div>
                    {cahierSea?.slice(0, 3).map((c, ci) => {
                      const kgs = c.series?.filter(s => parseFloat(s.kg) > 0).map(s => s.kg)
                      return kgs?.length > 0 ? (
                        <div key={ci} style={{ fontSize: 10, color: C.green, marginBottom: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sea.exercices?.[ci]?.nom?.split(' ')[0]} — {kgs.join(', ')} kg
                        </div>
                      ) : null
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                    Séance non remplie
                  </div>
                )}
                <div style={{ fontSize: 10, color: isDone ? C.green : C.yellow,
                  fontWeight: 700, marginTop: 8 }}>
                  {isDone ? 'Modifier ›' : 'Remplir ›'}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Séance Detail (lecture seule ou cahier) ───────────────────────────────────
function SeanceDetail({ seance, onBack, readOnly = false, cahierData, onSaveCahier, notify }) {
  const [local, setLocal] = useState(() => {
    if (readOnly) return null
    // Initialize cahier from existing data or create empty
    return seance.exercices.map((ex, ei) => {
      const existing = cahierData?.[ei]
      return {
        series: existing?.series?.length
          ? existing.series
          : ex.series.map(() => ({ reps: '', kg: '' })),
        intensite: existing?.intensite || '',
        remarques: existing?.remarques || '',
      }
    })
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSaveCahier(local)
    setSaving(false)
    notify('✓ Séance sauvegardée !', C.green)
  }

  return (
    <div className="fade-in" style={{ padding: '14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack}
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted,
            borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
          ← Retour
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.yellow, letterSpacing: 1 }}>{seance.label}</div>
          <div style={{ fontSize: 10, color: C.muted }}>Séance {seance.num} · {seance.exercices?.length || 0} exercices</div>
        </div>
      </div>

      {seance.exercices?.map((ex, ei) => {
        const cc = CAT_COLORS[ex.cat] || CAT_COLORS['FULL BODY']
        return (
          <div key={ex.id || ei} style={{ background: C.card, borderRadius: 10, marginBottom: 12,
            border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {/* Exercise header */}
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 10, background: '#111' }}>
              <div style={{ background: cc.bg, color: cc.text, fontSize: 9, fontWeight: 800,
                padding: '2px 8px', borderRadius: 3, letterSpacing: 1, flexShrink: 0 }}>{ex.cat}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white, flex: 1 }}>{ex.nom}</div>
              <div style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                background: ex.intensite >= 9 ? C.red : ex.intensite >= 7 ? C.yellow : C.green,
                color: ex.intensite >= 7 ? C.bg : C.white }}>
                RPE {ex.intensite}
              </div>
            </div>

            {/* Series table */}
            <div style={{ padding: '10px 14px' }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr', gap: 6,
                marginBottom: 6, fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>
                <div>#</div>
                <div style={{ textAlign: 'center' }}>REPS PRESCRITES</div>
                <div style={{ textAlign: 'center' }}>KG PRESCRIT</div>
                {!readOnly && <div style={{ textAlign: 'center', color: C.yellow }}>KG RÉEL</div>}
              </div>

              {ex.series?.map((sr, si) => {
                const reps = Array.isArray(sr) ? sr[0] : sr.reps
                const kg = Array.isArray(sr) ? sr[1] : sr.kg
                return (
                  <div key={si} style={{ display: 'grid',
                    gridTemplateColumns: readOnly ? '28px 1fr 1fr' : '28px 1fr 1fr 1fr',
                    gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textAlign: 'center' }}>{si + 1}</div>
                    <div style={{ background: '#111', borderRadius: 4, padding: '6px 8px',
                      fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'center' }}>
                      {reps || '—'}
                    </div>
                    <div style={{ background: '#111', borderRadius: 4, padding: '6px 8px',
                      fontSize: 13, fontWeight: 700,
                      color: parseFloat(kg) > 0 ? C.yellow : C.muted, textAlign: 'center' }}>
                      {parseFloat(kg) > 0 ? `${kg} kg` : '—'}
                    </div>
                    {!readOnly && (
                      <input
                        type="number" inputMode="decimal"
                        value={local?.[ei]?.series?.[si]?.kg || ''}
                        onChange={e => {
                          setLocal(prev => {
                            const n = prev.map((ex, xi) => xi !== ei ? ex : {
                              ...ex, series: ex.series.map((s, si2) =>
                                si2 !== si ? s : { ...s, kg: e.target.value }
                              )
                            })
                            return n
                          })
                        }}
                        placeholder="kg"
                        style={{ background: '#1a1a1a', border: `1px solid ${C.yellow}`,
                          borderRadius: 4, padding: '6px 8px', fontSize: 13, fontWeight: 700,
                          color: C.yellow, textAlign: 'center', width: '100%',
                          outline: 'none' }}
                      />
                    )}
                  </div>
                )
              })}

              {/* RPE + remarques for cahier */}
              {!readOnly && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>
                    RPE RESSENTI
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(v => (
                      <button key={v}
                        onClick={() => setLocal(prev => prev.map((x, xi) => xi === ei ? { ...x, intensite: String(v) } : x))}
                        style={{ width: 32, height: 32, borderRadius: 6, border: 'none',
                          background: local?.[ei]?.intensite === String(v)
                            ? (v >= 9 ? C.red : v >= 7 ? C.yellow : C.green) : C.border,
                          color: local?.[ei]?.intensite === String(v) ? (v >= 7 ? C.bg : C.white) : C.muted,
                          fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={local?.[ei]?.remarques || ''}
                    onChange={e => setLocal(prev => prev.map((x, xi) => xi === ei ? { ...x, remarques: e.target.value } : x))}
                    placeholder="Remarques (douleurs, sensations...)"
                    rows={2}
                    style={{ width: '100%', background: '#111', border: `1px solid ${C.border}`,
                      borderRadius: 6, padding: '8px 10px', fontSize: 12, color: C.text,
                      resize: 'none', outline: 'none' }}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}

      {!readOnly && (
        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', background: saving ? C.muted : C.green, color: C.white,
            border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 800,
            cursor: saving ? 'default' : 'pointer', letterSpacing: 1, marginTop: 4 }}>
          {saving ? '⏳ SAUVEGARDE...' : '✓ SAUVEGARDER LA SÉANCE'}
        </button>
      )}
    </div>
  )
}

// ── Cahier View ───────────────────────────────────────────────────────────────
function CahierView({ athlete, cahiers, saveCahier, notify }) {
  const [blocIdx, setBlocIdx] = useState(0)
  const [semIdx, setSemIdx] = useState(0)
  const [openSea, setOpenSea] = useState(null)

  if (!athlete?.blocs?.length) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✏️</div>
      <div style={{ fontSize: 14, color: C.muted }}>Aucun programme à remplir</div>
    </div>
  )

  const bloc = athlete.blocs[blocIdx]
  const sem = bloc?.semaines[semIdx]

  if (openSea !== null) {
    const sea = sem?.seances[openSea]
    if (!sea) { setOpenSea(null); return null }
    const key = `${athlete.id}-${bloc.id}-${sem.id}-${openSea}`
    const cahierData = cahiers[key]?.data
    return (
      <SeanceDetail
        seance={sea}
        readOnly={false}
        cahierData={cahierData}
        onBack={() => setOpenSea(null)}
        notify={notify}
        onSaveCahier={async (data) => {
          await saveCahier(key, data)
        }}
      />
    )
  }

  return (
    <div className="fade-in" style={{ padding: '16px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>
        CAHIER D'ENTRAÎNEMENT
      </div>

      {/* Bloc selector */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 14 }}>
        {athlete.blocs.map((b, i) => (
          <button key={b.id} onClick={() => { setBlocIdx(i); setSemIdx(0) }}
            style={{ flexShrink: 0, background: blocIdx === i ? C.yellow : C.card,
              color: blocIdx === i ? C.navy : C.muted,
              border: `1px solid ${blocIdx === i ? C.yellow : C.border}`,
              borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 800,
              cursor: 'pointer', letterSpacing: 1 }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Semaine selector */}
      {bloc?.semaines?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
          {bloc.semaines.map((s, i) => {
            const semKey = `${athlete.id}-${bloc.id}-${s.id}`
            const doneSea = s.seances.filter((_, si) => {
              const k = `${semKey}-${si}`
              return cahiers[k]?.data?.some(c => c.series?.some(sr => sr.reps || sr.kg))
            }).length
            return (
              <button key={s.id} onClick={() => setSemIdx(i)}
                style={{ flexShrink: 0, background: semIdx === i ? C.white : C.card,
                  color: semIdx === i ? C.bg : C.muted,
                  border: `1px solid ${semIdx === i ? C.white : C.border}`,
                  borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', letterSpacing: 1, position: 'relative' }}>
                {s.label}
                {doneSea > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, background: C.green,
                    color: C.white, fontSize: 8, fontWeight: 800, width: 14, height: 14,
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {doneSea}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Séances */}
      {sem?.seances?.map((sea, i) => {
        const key = `${athlete.id}-${bloc.id}-${sem.id}-${i}`
        const cahierSea = cahiers[key]?.data
        const isDone = cahierSea?.some(c => c.series?.some(s => s.reps || s.kg))
        const cc = catColor(sea.label)
        const exCount = sea.exercices?.length || 0
        return (
          <div key={sea.id} onClick={() => setOpenSea(i)}
            style={{ background: C.card, borderRadius: 10, padding: '14px 16px',
              marginBottom: 10, cursor: 'pointer',
              border: `1px solid ${isDone ? C.green : C.border}`,
              borderLeft: `4px solid ${isDone ? C.green : cc.bg}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ background: cc.bg, color: cc.text, fontSize: 9, fontWeight: 800,
                    padding: '2px 8px', borderRadius: 3, letterSpacing: 1 }}>{sea.label}</div>
                  {isDone && <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>✓ COMPLÉTÉ</span>}
                </div>
                <div style={{ fontSize: 13, color: C.text }}>{exCount} exercice{exCount !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ fontSize: 20, color: isDone ? C.green : C.muted }}>
                {isDone ? '✓' : '›'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Stats View ────────────────────────────────────────────────────────────────
function StatsView({ athlete, cahiers }) {
  const [selExo, setSelExo] = useState(null)
  const [statsError, setStatsError] = useState(null)

  // Build progression per exercise — wrapped in try/catch to prevent white screen
  let progressData = {}
  let exoNames = []
  try {
    athlete?.blocs?.forEach((bloc) => {
      bloc.semaines?.forEach((sem) => {
        sem.seances?.forEach((sea, seai) => {
          const key = `${athlete.id}-${bloc.id}-${sem.id}-${seai}`
          const cahier = cahiers[key]
          if (!cahier?.data) return
          const rpeValues = cahier.data
            .map(c => parseFloat(c.intensite))
            .filter(v => !isNaN(v) && v > 0)
          const rpeMoyenSeance = rpeValues.length
            ? Math.round((rpeValues.reduce((s, v) => s + v, 0) / rpeValues.length) * 10) / 10
            : null
          sea.exercices?.forEach((ex, ei) => {
            const nom = ex.nom
            if (!nom) return
            if (!progressData[nom]) progressData[nom] = []
            const cex = cahier.data[ei]
            if (!cex || !Array.isArray(cex.series)) return
            const validReps = cex.series.filter(s => parseFloat(s.reps) > 0)
            const validVol  = cex.series.filter(s => parseFloat(s.kg) > 0 && parseFloat(s.reps) > 0)
            const validKg   = cex.series.filter(s => parseFloat(s.kg) > 0)
            if (!validReps.length && !validKg.length) return
            const totalReps = validReps.reduce((s, sr) => s + (parseFloat(sr.reps) || 0), 0)
            const maxKg     = validKg.length ? Math.max(...validKg.map(s => parseFloat(s.kg) || 0)) : 0
            const vol       = validVol.reduce((s, sr) => s + (parseFloat(sr.reps) || 0) * (parseFloat(sr.kg) || 0), 0)
            const rpeEx     = parseFloat(cex.intensite) > 0 ? parseFloat(cex.intensite) : rpeMoyenSeance
            progressData[nom].push({
              label: `${(bloc.label || '').replace('BLOCK ', 'B')}/${sem.label || ''}`,
              totalReps, maxKg, vol,
              rpe: rpeEx,
              rpeMoyenSeance,
              date: cahier.updatedAt,
            })
          })
        })
      })
    })
    exoNames = Object.keys(progressData).filter(k => Array.isArray(progressData[k]) && progressData[k].length > 0)
  } catch(e) {
    console.error('StatsView build error:', e)
    setStatsError(e.message)
  }

  if (statsError) return (
    <div style={{ padding: 24, color: C.red, fontSize: 13 }}>
      Erreur stats : {statsError}
    </div>
  )

  const totalPrescribed = athlete?.blocs?.reduce((s, b) =>
    s + (b.semaines?.reduce((ss, sem) => ss + (sem.seances?.length || 0), 0) || 0), 0) || 0
  const totalDone = Object.keys(cahiers).filter(k =>
    cahiers[k]?.data?.some(c => Array.isArray(c.series) && c.series.some(s => s.reps || s.kg))
  ).length

  return (
    <div className="fade-in" style={{ padding: '16px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 16 }}>
        MES STATISTIQUES
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { l: 'SÉANCES FAITES', v: totalDone, c: C.green },
          { l: 'EXERCICES SUIVIS', v: exoNames.length, c: C.blue },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background: C.card, borderRadius: 8, padding: '14px 16px', borderTop: `3px solid ${c}` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>{l}</div>
          </div>
        ))}
      </div>

      {totalPrescribed > 0 && (
        <div style={{ background: C.card, borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>PROGRESSION GLOBALE</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.yellow }}>{totalDone}/{totalPrescribed}</span>
          </div>
          <div style={{ background: C.border, borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ background: C.green, height: '100%', borderRadius: 4,
              width: `${Math.min(100, (totalDone / totalPrescribed) * 100)}%`,
              transition: 'width .5s ease' }} />
          </div>
        </div>
      )}

      {exoNames.length === 0 && (
        <div style={{ background: C.card, borderRadius: 10, padding: '32px 20px', textAlign: 'center',
          border: `1px dashed ${C.border}` }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📈</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
            Remplis ton cahier d'entraînement<br />
            <span style={{ fontSize: 12 }}>pour voir tes statistiques ici.</span>
          </div>
        </div>
      )}

      {exoNames.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
            <button onClick={() => setSelExo(null)}
              style={{ flexShrink: 0, background: !selExo ? C.yellow : C.card,
                color: !selExo ? C.navy : C.muted,
                border: `1px solid ${!selExo ? C.yellow : C.border}`,
                borderRadius: 6, padding: '5px 12px', fontSize: 10, fontWeight: 800,
                cursor: 'pointer', letterSpacing: 1 }}>
              TOUS
            </button>
            {exoNames.map(n => (
              <button key={n} onClick={() => setSelExo(selExo === n ? null : n)}
                style={{ flexShrink: 0, background: selExo === n ? C.yellow : C.card,
                  color: selExo === n ? C.navy : C.muted,
                  border: `1px solid ${selExo === n ? C.yellow : C.border}`,
                  borderRadius: 6, padding: '5px 12px', fontSize: 10, fontWeight: 800,
                  cursor: 'pointer', letterSpacing: 1, whiteSpace: 'nowrap' }}>
                {n}
              </button>
            ))}
          </div>

          {(selExo ? [selExo] : exoNames).map(nom => {
            const data = progressData[nom]
            if (!data || data.length === 0) return null
            const last  = data[data.length - 1]
            const first = data[0]
            const prog  = (last.maxKg || 0) - (first.maxKg || 0)
            return (
              <div key={nom} style={{ background: C.card, borderRadius: 10, padding: '14px 16px',
                marginBottom: 12, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>{nom}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                      {data.length} séance{data.length > 1 ? 's' : ''}
                    </div>
                  </div>
                  {prog !== 0 && (
                    <div style={{ background: prog > 0 ? '#0a1f0a' : '#1f0a0a',
                      border: `1px solid ${prog > 0 ? C.green : C.red}`,
                      borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 800,
                      color: prog > 0 ? C.green : C.red }}>
                      {prog > 0 ? '+' : ''}{prog} kg
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                  REPS TOTALES PAR SÉANCE
                </div>
                <MiniBar data={data} field="totalReps" color={C.yellow} />
                <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: 1,
                  marginBottom: 6, marginTop: 12 }}>
                  VOLUME TOTAL (kg)
                </div>
                <MiniBar data={data} field="vol" color={C.blue} />
                {(last.rpe || last.rpeMoyenSeance) && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {last.rpe && (
                      <div style={{ fontSize: 11, color: C.muted }}>
                        RPE exercice :
                        <span style={{ marginLeft: 5, fontWeight: 800,
                          color: last.rpe >= 9 ? C.red : last.rpe >= 7 ? C.yellow : C.green }}>
                          {last.rpe}/10
                        </span>
                      </div>
                    )}
                    {last.rpeMoyenSeance && (
                      <div style={{ fontSize: 11, color: C.muted }}>
                        Moy. séance :
                        <span style={{ marginLeft: 5, fontWeight: 800,
                          color: last.rpeMoyenSeance >= 9 ? C.red : last.rpeMoyenSeance >= 7 ? C.yellow : C.green }}>
                          {last.rpeMoyenSeance}/10
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function MiniBar({ data, field, color }) {
  const vals = data.map(d => d[field] || 0)
  const max = Math.max(...vals) || 1
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 56 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ fontSize: 8, color, fontWeight: 700 }}>{vals[i] > 0 ? Math.round(vals[i]) : ''}</div>
          <div style={{ width: '100%', background: color, borderRadius: '2px 2px 0 0',
            height: `${Math.max(3, (vals[i] / max) * 36)}px`,
            opacity: 0.5 + (0.5 * i / Math.max(1, data.length - 1)) }} />
          <div style={{ fontSize: 7, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis', maxWidth: 30, textAlign: 'center' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}


// ── Personal Records ──────────────────────────────────────────────────────────
function PersonalRecords({ athlete, cahiers }) {
  // Calcule le PR (charge max historique) par exercice sur tous les cahiers
  const prs = {}
  athlete?.blocs?.forEach(bloc => {
    bloc.semaines?.forEach(sem => {
      sem.seances?.forEach((sea, seai) => {
        const key = `${athlete.id}-${bloc.id}-${sem.id}-${seai}`
        const cahier = cahiers[key]
        if (!cahier?.data) return
        sea.exercices?.forEach((ex, ei) => {
          const cex = cahier.data[ei]
          if (!cex?.series) return
          cex.series.forEach(s => {
            const kg = parseFloat(s.kg)
            const reps = parseFloat(s.reps)
            if (kg > 0) {
              if (!prs[ex.nom] || kg > prs[ex.nom].kg) {
                prs[ex.nom] = {
                  kg,
                  reps: reps || null,
                  label: `${bloc.label.replace('BLOCK ', 'B')} / ${sem.label}`,
                  cat: ex.cat,
                }
              }
            }
          })
        })
      })
    })
  })

  const prList = Object.entries(prs).sort((a, b) => b[1].kg - a[1].kg)
  if (!prList.length) return null

  return (
    <div style={{ marginTop: 20, marginBottom: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>
        🏆 RECORDS PERSONNELS — CHARGE MAX
      </div>
      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        {prList.map(([nom, pr], i) => {
          const cc = CAT_COLORS[pr.cat] || CAT_COLORS['FULL BODY']
          return (
            <div key={nom} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px',
              borderBottom: i < prList.length - 1 ? `1px solid ${C.border}` : 'none',
              background: i === 0 ? '#1a1500' : 'transparent',
            }}>
              {/* Médaille pour le premier */}
              <div style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: 'center' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}
              </div>
              {/* Catégorie */}
              <div style={{ background: cc.bg, color: cc.text, fontSize: 8, fontWeight: 800,
                padding: '2px 7px', borderRadius: 3, letterSpacing: 1, flexShrink: 0 }}>
                {pr.cat || '—'}
              </div>
              {/* Nom */}
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nom}
              </div>
              {/* PR value */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800,
                  color: i === 0 ? C.yellow : C.white }}>
                  {pr.kg} kg
                  {pr.reps ? <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>× {pr.reps}</span> : null}
                </div>
                <div style={{ fontSize: 8, color: C.muted }}>{pr.label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Profil View ───────────────────────────────────────────────────────────────
function ProfilView({ athlete, cahiers }) {
  if (!athlete) return null

  const stats = [
    { l: 'TAILLE', v: athlete.taille ? `${athlete.taille} cm` : '—' },
    { l: 'POIDS', v: athlete.poids ? `${athlete.poids} kg` : '—' },
    { l: 'SEXE', v: athlete.sexe || '—' },
    { l: 'BLOCS', v: athlete.blocs?.length || 0 },
  ]

  const totalSem = athlete.blocs?.reduce((s, b) => s + (b.semaines?.length || 0), 0) || 0
  const totalSea = athlete.blocs?.reduce((s, b) =>
    s + b.semaines?.reduce((ss, sem) => ss + (sem.seances?.length || 0), 0), 0) || 0

  return (
    <div className="fade-in" style={{ padding: '16px 14px' }}>
      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24,
        background: C.card, borderRadius: 12, padding: '16px 18px',
        border: `1px solid ${C.border}` }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.border,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 800, color: C.yellow, flexShrink: 0 }}>
          {(athlete.prenom || '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>
            {athlete.prenom} {athlete.nom}
          </div>
          <div style={{ fontSize: 12, color: C.yellow, fontWeight: 700, marginTop: 2 }}>
            {athlete.objectif || 'Objectif non défini'}
          </div>
          {athlete.sport && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{athlete.sport}</div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {stats.map(({ l, v }) => (
          <div key={l} style={{ background: C.card, borderRadius: 8, padding: '12px 14px',
            border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Programme summary */}
      <div style={{ background: C.card, borderRadius: 10, padding: '14px 16px',
        border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
          PROGRAMME
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          {[
            { l: 'Blocs', v: athlete.blocs?.length || 0, c: C.yellow },
            { l: 'Semaines', v: totalSem, c: C.blue },
            { l: 'Séances', v: totalSea, c: C.green },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {athlete.notes && (
        <div style={{ background: C.card, borderRadius: 10, padding: '14px 16px',
          border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>
            NOTES DU COACH
          </div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{athlete.notes}</div>
        </div>
      )}

      {/* PR — Records personnels */}
      <PersonalRecords athlete={athlete} cahiers={cahiers} />

      {/* Install PWA hint */}
      <div style={{ marginTop: 20, background: '#0a1020', borderRadius: 10, padding: '14px 16px',
        border: `1px solid ${C.blue}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, letterSpacing: 2, marginBottom: 6 }}>
          📲 INSTALLER L'APPLICATION
        </div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>iPhone/iPad</strong> — Safari → Partager → "Sur l'écran d'accueil"<br />
          <strong style={{ color: C.text }}>Android</strong> — Chrome → Menu → "Ajouter à l'écran d'accueil"
        </div>
      </div>
    </div>
  )
}

// ── Loading & Error screens ───────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <InjectStyles />
      <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`,
        borderTop: `3px solid ${C.yellow}`, borderRadius: '50%',
        animation: 'spin 0.8s linear infinite', marginBottom: 20 }} />
      <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>
        CHARGEMENT...
      </div>
    </div>
  )
}

function ErrorScreen({ msg, sub }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 32 }}>
      <InjectStyles />
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 8, textAlign: 'center' }}>{msg}</div>
      <div style={{ fontSize: 13, color: C.muted, textAlign: 'center' }}>{sub}</div>
    </div>
  )
}
