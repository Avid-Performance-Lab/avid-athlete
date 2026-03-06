import { useState, useEffect } from 'react'
import { db } from './firebase.js'
import { doc, onSnapshot, collection, query, where, setDoc } from 'firebase/firestore'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0A0A', panel: '#141414', card: '#1C1C1C', border: '#262626',
  red: '#EA4335', yellow: '#F2C94C', green: '#27AE60', blue: '#2F80ED',
  purple: '#9B51E0', navy: '#00194C', orange: '#F2994A',
  text: '#E8E8E8', muted: '#555', white: '#FFF',
}

const CAT_COLORS = {
  JAMBES:      { bg: '#F2C94C', text: '#1a1000' },
  POUSSEE:     { bg: '#2F80ED', text: '#FFF' },
  TIRAGE:      { bg: '#27AE60', text: '#FFF' },
  'FULL BODY': { bg: '#9B51E0', text: '#FFF' },
  CARDIO:      { bg: '#EA4335', text: '#FFF' },
}

function catColor(label = '') {
  const k = label.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')[0]
  return CAT_COLORS[k] || CAT_COLORS['FULL BODY']
}

// ── Logo AVID Performance Lab ────────────────────────────────────────────────
const LOGO_SRC = "data:image/png;base64,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AREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQf//Z"

function AvidLogo({ height = 32 }) {
  return (
    <img src={LOGO_SRC} alt="AVID Performance Lab"
      style={{ height, width: 'auto', objectFit: 'contain' }} />
  )
}

// ── Global styles ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; background: ${C.bg}; font-family: 'Barlow Condensed','Arial Narrow',sans-serif;
    color: ${C.text}; overscroll-behavior: none; -webkit-font-smoothing: antialiased; }
  input, select, textarea { font-family: inherit; }
  ::-webkit-scrollbar { width: 0; height: 0; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
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
  const [tab, setTab] = useState('profil')
  const [online, setOnline] = useState(true)
  const [cahiers, setCahiers] = useState({})
  const [nutri, setNutri] = useState({})
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const idFromUrl = params.get('id')
    if (idFromUrl) {
      try { localStorage.setItem('avid_athlete_id', idFromUrl) } catch(e) {}
      setAthleteId(idFromUrl); return
    }
    try {
      const saved = localStorage.getItem('avid_athlete_id')
      if (saved) { setAthleteId(saved); return }
    } catch(e) {}
    setError('no_id'); setLoading(false)
  }, [])

  useEffect(() => {
    if (!athleteId) return
    const unsub = onSnapshot(doc(db, 'athletes', athleteId), (snap) => {
      if (snap.exists()) { setAthlete({ id: snap.id, ...snap.data() }); setOnline(true) }
      else setError('not_found')
      setLoading(false)
    }, () => { setOnline(false); setLoading(false); setError('offline') })
    return unsub
  }, [athleteId])

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

  useEffect(() => {
    if (!athleteId) return
    const q = query(collection(db, 'nutrition'), where('athleteId', '==', athleteId))
    const unsub = onSnapshot(q, (snap) => {
      const data = {}
      snap.docs.forEach(d => { data[d.id] = d.data() })
      setNutri(data)
    }, () => {})
    return unsub
  }, [athleteId])

  function notify(msg, color = C.green) {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2800)
  }

  async function saveCahier(key, data) {
    try { await setDoc(doc(db, 'cahiers', key), { athleteId, data, updatedAt: Date.now() }) }
    catch (e) { notify('⚠ Erreur sauvegarde', C.red) }
  }

  async function saveNutri(key, data) {
    try { await setDoc(doc(db, 'nutrition', key), { athleteId, data, updatedAt: Date.now() }) }
    catch (e) { notify('⚠ Erreur sauvegarde', C.red) }
  }

  if (loading) return <LoadingScreen />
  if (error === 'no_id') return <ErrorScreen msg="Lien invalide" sub="Demande un nouveau lien à ton coach." />
  if (error === 'not_found') return <ErrorScreen msg="Athlète introuvable" sub="Ce lien ne correspond à aucun profil." />
  if (error === 'offline') return <ErrorScreen msg="Hors ligne" sub="Vérifie ta connexion et réessaie." />

  const TABS = [
    { id: 'profil',      icon: '👤', label: 'Profil' },
    { id: 'programme',   icon: '📋', label: 'Programme' },
    { id: 'stats',       icon: '📈', label: 'Stats' },
    { id: 'nutrition',   icon: '🥗', label: 'Nutrition' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <InjectStyles />

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>AVID PERFORMANCE LAB</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.white, letterSpacing: 1 }}>
            {athlete?.prenom} {athlete?.nom}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: online ? C.green : C.red }} />
          <AvidLogo height={28} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 80 }}>
        {tab === 'profil'    && <ProfilView athlete={athlete} cahiers={cahiers} />}
        {tab === 'programme' && <ProgrammeView athlete={athlete} cahiers={cahiers} saveCahier={saveCahier} notify={notify} />}
        {tab === 'stats'     && <StatsView athlete={athlete} cahiers={cahiers} />}
        {tab === 'nutrition' && <NutritionView athleteId={athleteId} nutri={nutri} saveNutri={saveNutri} notify={notify} />}
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
  const [openSea, setOpenSea] = useState(null)

  if (!athlete?.blocs?.length) return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
      <div style={{ fontSize: 14, color: C.muted }}>Aucun programme disponible</div>
    </div>
  )

  const bloc = athlete.blocs[blocIdx]
  const sem = bloc?.semaines?.[semIdx]

  if (openSea !== null) {
    const sea = sem?.seances?.[openSea.idx]
    if (!sea) { setOpenSea(null); return null }
    const key = `${athlete.id}-${bloc.id}-${sem.id}-${openSea.idx}`
    const readOnly = openSea.mode === 'prescrit'
    return (
      <SeanceDetail
        seance={sea} readOnly={readOnly}
        cahierData={readOnly ? null : cahiers[key]?.data}
        onBack={() => setOpenSea(null)} notify={notify}
        onSaveCahier={async (data) => { await saveCahier(key, data) }}
      />
    )
  }

  return (
    <div className="fade-in" style={{ padding: '16px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>BLOCS</div>
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

      {sem?.seances?.map((sea, i) => {
        const cc = catColor(sea.label)
        const key = `${athlete.id}-${bloc.id}-${sem.id}-${i}`
        const cahierSea = cahiers[key]?.data
        const isDone = cahierSea?.some(c => c.series?.some(s => s.kg))
        const exCount = sea.exercices?.length || 0
        return (
          <div key={sea.id || i} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ background: cc.bg, color: cc.text, fontSize: 9, fontWeight: 800,
                padding: '2px 10px', borderRadius: 3, letterSpacing: 1 }}>{sea.label}</div>
              <div style={{ fontSize: 10, color: C.muted }}>S{sea.num} · {exCount} exercice{exCount !== 1 ? 's' : ''}</div>
              {isDone && <div style={{ fontSize: 10, color: C.green, fontWeight: 700, marginLeft: 'auto' }}>✓ COMPLÉTÉ</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div onClick={() => setOpenSea({ idx: i, mode: 'prescrit' })}
                style={{ background: C.card, borderRadius: 10, padding: '12px 14px',
                  border: `1px solid ${C.border}`, borderTop: `3px solid ${cc.bg}`, cursor: 'pointer' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>📋 PRESCRIT</div>
                {sea.exercices?.slice(0, 3).map(ex => (
                  <div key={ex.id} style={{ fontSize: 10, color: C.muted, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.nom}</div>
                ))}
                {(sea.exercices?.length || 0) > 3 && (
                  <div style={{ fontSize: 10, color: C.muted }}>+{sea.exercices.length - 3} autres</div>
                )}
                <div style={{ fontSize: 10, color: cc.bg, fontWeight: 700, marginTop: 8 }}>Voir détail ›</div>
              </div>
              <div onClick={() => setOpenSea({ idx: i, mode: 'cahier' })}
                style={{ background: isDone ? '#0a1f0a' : C.card, borderRadius: 10, padding: '12px 14px',
                  border: `1px solid ${isDone ? C.green : C.border}`,
                  borderTop: `3px solid ${isDone ? C.green : C.muted}`, cursor: 'pointer' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: isDone ? C.green : C.muted,
                  letterSpacing: 1, marginBottom: 6 }}>✏️ MON CAHIER</div>
                {isDone ? cahierSea?.slice(0, 3).map((c, ci) => {
                  const kgs = c.series?.filter(s => parseFloat(s.kg) > 0).map(s => s.kg)
                  return kgs?.length > 0 ? (
                    <div key={ci} style={{ fontSize: 10, color: C.green, marginBottom: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sea.exercices?.[ci]?.nom?.split(' ')[0]} — {kgs.join(', ')} kg
                    </div>
                  ) : null
                }) : (
                  <div style={{ fontSize: 11, color: C.muted }}>Séance non remplie</div>
                )}
                <div style={{ fontSize: 10, color: isDone ? C.green : C.yellow,
                  fontWeight: 700, marginTop: 8 }}>{isDone ? 'Modifier ›' : 'Remplir ›'}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Séance Detail ─────────────────────────────────────────────────────────────
function SeanceDetail({ seance, onBack, readOnly = false, cahierData, onSaveCahier, notify }) {
  const [local, setLocal] = useState(() => {
    if (readOnly) return null
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

            <div style={{ padding: '10px 14px' }}>
              {/* Headers */}
              {readOnly ? (
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 6,
                  marginBottom: 6, fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>
                  <div>#</div>
                  <div style={{ textAlign: 'center' }}>REPS</div>
                  <div style={{ textAlign: 'center' }}>KG PRESCRIT</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 1fr 1fr 1fr', gap: 5,
                  marginBottom: 6, fontSize: 8, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>
                  <div>#</div>
                  <div style={{ textAlign: 'center' }}>REPS P.</div>
                  <div style={{ textAlign: 'center' }}>KG P.</div>
                  <div style={{ textAlign: 'center', color: C.yellow }}>REPS R.</div>
                  <div style={{ textAlign: 'center', color: C.yellow }}>KG R.</div>
                </div>
              )}

              {ex.series?.map((sr, si) => {
                const reps = Array.isArray(sr) ? sr[0] : sr.reps
                const kg = Array.isArray(sr) ? sr[1] : sr.kg
                return (
                  <div key={si} style={{ display: 'grid',
                    gridTemplateColumns: readOnly ? '28px 1fr 1fr' : '22px 1fr 1fr 1fr 1fr',
                    gap: readOnly ? 6 : 5, marginBottom: 6, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textAlign: 'center' }}>{si + 1}</div>
                    <div style={{ background: '#111', borderRadius: 4, padding: '6px 4px',
                      fontSize: 12, fontWeight: 700, color: C.text, textAlign: 'center' }}>
                      {reps || '—'}
                    </div>
                    <div style={{ background: '#111', borderRadius: 4, padding: '6px 4px',
                      fontSize: 12, fontWeight: 700,
                      color: parseFloat(kg) > 0 ? C.yellow : C.muted, textAlign: 'center' }}>
                      {parseFloat(kg) > 0 ? `${kg}kg` : '—'}
                    </div>
                    {!readOnly && (
                      <>
                        <input type="number" inputMode="decimal"
                          value={local?.[ei]?.series?.[si]?.reps || ''}
                          onChange={e => setLocal(prev => prev.map((x, xi) => xi !== ei ? x : {
                            ...x, series: x.series.map((s, si2) => si2 !== si ? s : { ...s, reps: e.target.value })
                          }))}
                          placeholder="reps"
                          style={{ background: '#1a1a1a', border: `1px solid ${C.green}`,
                            borderRadius: 4, padding: '6px 4px', fontSize: 12, fontWeight: 700,
                            color: C.green, textAlign: 'center', width: '100%', outline: 'none' }}
                        />
                        <input type="number" inputMode="decimal"
                          value={local?.[ei]?.series?.[si]?.kg || ''}
                          onChange={e => setLocal(prev => prev.map((x, xi) => xi !== ei ? x : {
                            ...x, series: x.series.map((s, si2) => si2 !== si ? s : { ...s, kg: e.target.value })
                          }))}
                          placeholder="kg"
                          style={{ background: '#1a1a1a', border: `1px solid ${C.yellow}`,
                            borderRadius: 4, padding: '6px 4px', fontSize: 12, fontWeight: 700,
                            color: C.yellow, textAlign: 'center', width: '100%', outline: 'none' }}
                        />
                      </>
                    )}
                  </div>
                )
              })}

              {!readOnly && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>RPE RESSENTI</div>
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

// ── Stats View ────────────────────────────────────────────────────────────────
function StatsView({ athlete, cahiers }) {
  const [selExo, setSelExo] = useState(null)

  // Build progression — sécurisé
  const progressData = {}
  try {
    athlete?.blocs?.forEach(bloc => {
      bloc.semaines?.forEach(sem => {
        sem.seances?.forEach((sea, seai) => {
          const key = `${athlete.id}-${bloc.id}-${sem.id}-${seai}`
          const cahier = cahiers[key]
          if (!cahier?.data) return
          const rpeValues = cahier.data.map(c => parseFloat(c.intensite)).filter(v => !isNaN(v) && v > 0)
          const rpeMoyenSeance = rpeValues.length
            ? Math.round((rpeValues.reduce((s, v) => s + v, 0) / rpeValues.length) * 10) / 10 : null
          sea.exercices?.forEach((ex, ei) => {
            if (!ex?.nom) return
            if (!progressData[ex.nom]) progressData[ex.nom] = []
            const cex = cahier.data[ei]
            if (!cex || !Array.isArray(cex.series)) return
            const validVol = cex.series.filter(s => parseFloat(s.kg) > 0 && parseFloat(s.reps) > 0)
            if (!validVol.length) return
            const vol = validVol.reduce((s, sr) => s + (parseFloat(sr.reps) || 0) * (parseFloat(sr.kg) || 0), 0)
            const rpeEx = parseFloat(cex.intensite) > 0 ? parseFloat(cex.intensite) : null
            progressData[ex.nom].push({
              label: `${(bloc.label || '').replace('BLOCK ', 'B')}/${sem.label || ''}`,
              vol, rpe: rpeEx, rpeMoyenSeance, date: cahier.updatedAt,
            })
          })
        })
      })
    })
  } catch(e) { console.error('Stats error:', e) }

  const exoNames = Object.keys(progressData).filter(k => progressData[k]?.length > 0)

  const totalPrescribed = athlete?.blocs?.reduce((s, b) =>
    s + (b.semaines?.reduce((ss, sem) => ss + (sem.seances?.length || 0), 0) || 0), 0) || 0
  const totalDone = Object.keys(cahiers).filter(k =>
    cahiers[k]?.data?.some(c => Array.isArray(c.series) && c.series.some(s => s.kg))
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
              width: `${Math.min(100, (totalDone / totalPrescribed) * 100)}%`, transition: 'width .5s ease' }} />
          </div>
        </div>
      )}

      {exoNames.length === 0 ? (
        <div style={{ background: C.card, borderRadius: 10, padding: '32px 20px', textAlign: 'center',
          border: `1px dashed ${C.border}` }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📈</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
            Remplis ton cahier d'entraînement<br />
            <span style={{ fontSize: 12 }}>pour voir tes statistiques ici.</span>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
            <button onClick={() => setSelExo(null)}
              style={{ flexShrink: 0, background: !selExo ? C.yellow : C.card,
                color: !selExo ? C.navy : C.muted, border: `1px solid ${!selExo ? C.yellow : C.border}`,
                borderRadius: 6, padding: '5px 12px', fontSize: 10, fontWeight: 800, cursor: 'pointer', letterSpacing: 1 }}>
              TOUS
            </button>
            {exoNames.map(n => (
              <button key={n} onClick={() => setSelExo(selExo === n ? null : n)}
                style={{ flexShrink: 0, background: selExo === n ? C.yellow : C.card,
                  color: selExo === n ? C.navy : C.muted, border: `1px solid ${selExo === n ? C.yellow : C.border}`,
                  borderRadius: 6, padding: '5px 12px', fontSize: 10, fontWeight: 800,
                  cursor: 'pointer', letterSpacing: 1, whiteSpace: 'nowrap' }}>
                {n}
              </button>
            ))}
          </div>

          {(selExo ? [selExo] : exoNames).map(nom => {
            const data = progressData[nom]
            if (!data || data.length === 0) return null
            const last = data[data.length - 1]
            return (
              <div key={nom} style={{ background: C.card, borderRadius: 10, padding: '14px 16px',
                marginBottom: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 4 }}>{nom}</div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 12 }}>
                  {data.length} séance{data.length > 1 ? 's' : ''}
                </div>

                <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
                  VOLUME PAR SÉANCE (kg)
                </div>
                <MiniBar data={data} field="vol" color={C.blue} />

                {last.rpeMoyenSeance && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      Intensité moy. séance :
                      <span style={{ marginLeft: 5, fontWeight: 800,
                        color: last.rpeMoyenSeance >= 9 ? C.red : last.rpeMoyenSeance >= 7 ? C.yellow : C.green }}>
                        {last.rpeMoyenSeance}/10
                      </span>
                    </div>
                    {last.rpe && (
                      <div style={{ fontSize: 11, color: C.muted }}>
                        Intensité exercice :
                        <span style={{ marginLeft: 5, fontWeight: 800,
                          color: last.rpe >= 9 ? C.red : last.rpe >= 7 ? C.yellow : C.green }}>
                          {last.rpe}/10
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

// ── Nutrition View ────────────────────────────────────────────────────────────
function NutritionView({ athleteId, nutri, saveNutri, notify }) {
  const today = new Date().toISOString().slice(0, 10)
  const key = `${athleteId}-${today}`
  const existing = nutri[key]?.data || {}

  const [form, setForm] = useState({
    glucides: existing.glucides || '',
    lipides: existing.lipides || '',
    proteines: existing.proteines || '',
    fatigue: existing.fatigue || '',
    notes: existing.notes || '',
  })
  const [saving, setSaving] = useState(false)

  // Sync when nutri data loads
  useEffect(() => {
    const d = nutri[key]?.data || {}
    setForm({
      glucides: d.glucides || '',
      lipides: d.lipides || '',
      proteines: d.proteines || '',
      fatigue: d.fatigue || '',
      notes: d.notes || '',
    })
  }, [key, JSON.stringify(nutri[key])])

  const g = parseFloat(form.glucides) || 0
  const l = parseFloat(form.lipides) || 0
  const p = parseFloat(form.proteines) || 0
  const kcal = Math.round(g * 4 + l * 9 + p * 4)

  async function handleSave() {
    setSaving(true)
    await saveNutri(key, form)
    setSaving(false)
    notify('✓ Nutrition sauvegardée !', C.green)
  }

  const macros = [
    { label: 'GLUCIDES', key: 'glucides', color: C.yellow, kcalPer: 4, unit: 'g' },
    { label: 'LIPIDES',  key: 'lipides',  color: C.orange, kcalPer: 9, unit: 'g' },
    { label: 'PROTÉINES',key: 'proteines',color: C.blue,   kcalPer: 4, unit: 'g' },
  ]

  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="fade-in" style={{ padding: '16px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>
        NUTRITION & SANTÉ
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, textTransform: 'capitalize' }}>{dateLabel}</div>

      {/* Kcal total */}
      <div style={{ background: C.card, borderRadius: 10, padding: '16px', marginBottom: 16,
        border: `1px solid ${C.border}`, textAlign: 'center', borderTop: `3px solid ${C.red}` }}>
        <div style={{ fontSize: 42, fontWeight: 900, color: C.red }}>{kcal}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>KCAL TOTALES</div>
        {kcal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
            {macros.map(m => {
              const val = parseFloat(form[m.key]) || 0
              const contrib = Math.round(val * m.kcalPer)
              return contrib > 0 ? (
                <div key={m.key} style={{ fontSize: 10, color: m.color }}>
                  {contrib} kcal <span style={{ color: C.muted }}>({m.label.slice(0,3)})</span>
                </div>
              ) : null
            })}
          </div>
        )}
      </div>

      {/* Macros inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {macros.map(m => (
          <div key={m.key} style={{ background: C.card, borderRadius: 8, padding: '12px 10px',
            border: `1px solid ${C.border}`, borderTop: `3px solid ${m.color}` }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: m.color, letterSpacing: 1, marginBottom: 6 }}>
              {m.label}
            </div>
            <input type="number" inputMode="decimal"
              value={form[m.key]}
              onChange={e => setForm(f => ({ ...f, [m.key]: e.target.value }))}
              placeholder="0"
              style={{ width: '100%', background: '#111', border: `1px solid ${C.border}`,
                borderRadius: 4, padding: '8px 6px', fontSize: 18, fontWeight: 800,
                color: m.color, textAlign: 'center', outline: 'none' }}
            />
            <div style={{ fontSize: 9, color: C.muted, textAlign: 'center', marginTop: 4 }}>
              grammes · {(parseFloat(form[m.key]) || 0) * m.kcalPer} kcal
            </div>
          </div>
        ))}
      </div>

      {/* Barre de répartition macro */}
      {kcal > 0 && (
        <div style={{ background: C.card, borderRadius: 8, padding: '12px 14px', marginBottom: 16,
          border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 8 }}>
            RÉPARTITION MACROS
          </div>
          <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', height: 10 }}>
            {macros.map(m => {
              const pct = Math.round(((parseFloat(form[m.key]) || 0) * m.kcalPer / kcal) * 100)
              return pct > 0 ? (
                <div key={m.key} style={{ width: `${pct}%`, background: m.color }} />
              ) : null
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {macros.map(m => {
              const pct = Math.round(((parseFloat(form[m.key]) || 0) * m.kcalPer / kcal) * 100)
              return (
                <div key={m.key} style={{ fontSize: 9, color: m.color }}>
                  {m.label.slice(0,3)} {pct}%
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Fatigue */}
      <div style={{ background: C.card, borderRadius: 10, padding: '14px 16px', marginBottom: 16,
        border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>
          FATIGUE JOURNALIÈRE (1 = reposé · 10 = épuisé)
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(v => (
            <button key={v}
              onClick={() => setForm(f => ({ ...f, fatigue: String(v) }))}
              style={{ width: 36, height: 36, borderRadius: 8, border: 'none',
                background: form.fatigue === String(v)
                  ? (v >= 8 ? C.red : v >= 5 ? C.yellow : C.green) : C.border,
                color: form.fatigue === String(v) ? (v >= 5 ? C.bg : C.white) : C.muted,
                fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              {v}
            </button>
          ))}
        </div>
        {form.fatigue && (
          <div style={{ marginTop: 8, fontSize: 11, color: C.muted }}>
            Fatigue saisie :
            <span style={{ marginLeft: 5, fontWeight: 800,
              color: parseInt(form.fatigue) >= 8 ? C.red : parseInt(form.fatigue) >= 5 ? C.yellow : C.green }}>
              {form.fatigue}/10
            </span>
          </div>
        )}
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>
          NOTES DU JOUR
        </div>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Sommeil, énergie, digestion, humeur..."
          rows={3}
          style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '10px 12px', fontSize: 13, color: C.text,
            resize: 'none', outline: 'none' }}
        />
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ width: '100%', background: saving ? C.muted : C.green, color: C.white,
          border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 800,
          cursor: saving ? 'default' : 'pointer', letterSpacing: 1 }}>
        {saving ? '⏳ SAUVEGARDE...' : '✓ SAUVEGARDER'}
      </button>
    </div>
  )
}

// ── Personal Records ──────────────────────────────────────────────────────────
function PersonalRecords({ athlete, cahiers }) {
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
            if (kg > 0 && (!prs[ex.nom] || kg > prs[ex.nom].kg)) {
              prs[ex.nom] = {
                kg, reps: parseFloat(s.reps) || null,
                label: `${bloc.label.replace('BLOCK ', 'B')} / ${sem.label}`,
                cat: ex.cat,
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
            <div key={nom} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
              borderBottom: i < prList.length - 1 ? `1px solid ${C.border}` : 'none',
              background: i === 0 ? '#1a1500' : 'transparent' }}>
              <div style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: 'center' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}
              </div>
              <div style={{ background: cc.bg, color: cc.text, fontSize: 8, fontWeight: 800,
                padding: '2px 7px', borderRadius: 3, letterSpacing: 1, flexShrink: 0 }}>
                {pr.cat || '—'}
              </div>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: i === 0 ? C.yellow : C.white }}>
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

  const totalSem = athlete.blocs?.reduce((s, b) => s + (b.semaines?.length || 0), 0) || 0
  const totalSea = athlete.blocs?.reduce((s, b) =>
    s + b.semaines?.reduce((ss, sem) => ss + (sem.seances?.length || 0), 0), 0) || 0

  return (
    <div className="fade-in" style={{ padding: '16px 14px' }}>
      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
        background: C.card, borderRadius: 12, padding: '16px 18px', border: `1px solid ${C.border}` }}>
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
          {athlete.sport && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{athlete.sport}</div>}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'TAILLE', v: athlete.taille ? `${athlete.taille} cm` : '—' },
          { l: 'POIDS',  v: athlete.poids  ? `${athlete.poids} kg`  : '—' },
          { l: 'SEXE',   v: athlete.sexe || '—' },
          { l: 'BLOCS',  v: athlete.blocs?.length || 0 },
        ].map(({ l, v }) => (
          <div key={l} style={{ background: C.card, borderRadius: 8, padding: '12px 14px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Programme summary */}
      <div style={{ background: C.card, borderRadius: 10, padding: '14px 16px',
        border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>PROGRAMME</div>
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

      {athlete.notes && (
        <div style={{ background: C.card, borderRadius: 10, padding: '14px 16px',
          border: `1px solid ${C.border}`, marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>
            NOTES DU COACH
          </div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{athlete.notes}</div>
        </div>
      )}

      <PersonalRecords athlete={athlete} cahiers={cahiers} />

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

// ── Loading & Error ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <InjectStyles />
      <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`,
        borderTop: `3px solid ${C.yellow}`, borderRadius: '50%',
        animation: 'spin 0.8s linear infinite', marginBottom: 20 }} />
      <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>CHARGEMENT...</div>
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
