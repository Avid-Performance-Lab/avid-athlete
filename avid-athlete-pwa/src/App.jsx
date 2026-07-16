import { useState, useEffect, useRef } from 'react'
import { db } from './firebase.js'
import { doc, onSnapshot, collection, query, where, setDoc } from 'firebase/firestore'

const uid = () => Math.random().toString(36).slice(2, 9)

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK = {
  bg: '#0A0A0A', panel: '#141414', card: '#1C1C1C', border: '#262626',
  inset: '#111111',
  red: '#EA4335', yellow: '#F2C94C', green: '#27AE60', blue: '#2F80ED',
  purple: '#9B51E0', navy: '#00194C', orange: '#F2994A',
  text: '#E8E8E8', muted: '#888', white: '#FFF',
}
const LIGHT = {
  bg: '#F4F5F7', panel: '#FFFFFF', card: '#FFFFFF', border: '#E5E7EB',
  inset: '#1C1E22',
  red: '#E5484D', yellow: '#D4A72C', green: '#1FA956', blue: '#3B7DDB',
  purple: '#8B5CF6', navy: '#1558B0', orange: '#E08A3C',
  text: '#16181D', muted: '#6B7280', white: '#FFFFFF',
}
// C est un objet global mutable — mis à jour avant chaque render dans App()
const C = Object.assign({}, DARK)

const CAT_COLORS = {
  JAMBES:      { bg: '#F2C94C', text: '#1a1000' },
  POUSSEE:     { bg: '#2F80ED', text: '#FFF' },
  TIRAGE:      { bg: '#27AE60', text: '#FFF' },
  'FULL BODY': { bg: '#9B51E0', text: '#FFF' },
  CARDIO:      { bg: '#EA4335', text: '#FFF' },
  AUTRES:      { bg: '#4A4A4A', text: '#FFF' },
}

const CARDIO_SUBTYPES = ['Course à pieds', 'Rameur', 'Vélo', 'Ski-Erg']
const CARDIO_EFFORT_TYPES = ['EF', 'Tempo', 'VMA', 'Fractionné']
const isCardio = cat => (cat || '').toUpperCase() === 'CARDIO'

function catColor(label = '') {
  const k = label.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')[0]
  return CAT_COLORS[k] || CAT_COLORS['FULL BODY']
}

// ── Logo AVID ─────────────────────────────────────────────────────────────────
function AvidLogo({ height = 28 }) {
  return (
    <img src="/icon_avid_A.svg" alt="AVID Performance Lab"
      style={{ height, width: 'auto', objectFit: 'contain' }} />
  )
}

// ── Global styles ─────────────────────────────────────────────────────────────
const STATIC_CSS = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; font-family: 'Barlow Condensed','Arial Narrow',sans-serif;
    overscroll-behavior: none; -webkit-font-smoothing: antialiased; }
  input, select, textarea { font-family: inherit; }
  ::-webkit-scrollbar { width: 0; height: 0; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .fade-in { animation: fadeIn .25s ease forwards; }
`

function InjectStyles() {
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = STATIC_CSS
    document.head.appendChild(el)
    return () => el.remove()
  }, [])
  return null
}

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(() => {
    try {
      const s = localStorage.getItem('avid_theme')
      return s !== 'light' // sombre par défaut
    } catch(e) { return true }
  })

  // Mettre à jour C AVANT le reste du render
  Object.assign(C, dark ? DARK : LIGHT)

  // Appliquer sur le body
  useEffect(() => {
    document.body.style.background = C.bg
    document.body.style.color = C.text
    try { localStorage.setItem('avid_theme', dark ? 'dark' : 'light') } catch(e) {}
  }, [dark])

  const [athleteId, setAthleteId] = useState(null)
  const [athlete, setAthlete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('profil')
  const [online, setOnline] = useState(true)
  const [cahiers, setCahiers] = useState({})
  const [nutri, setNutri] = useState({})
  const [toast, setToast] = useState(null)
  const [isSolo, setIsSolo] = useState(false)
  const [soloSetup, setSoloSetup] = useState(false) // true = affiche l'écran de création

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const idFromUrl = params.get('id')
    const isSoloUrl = window.location.pathname.includes('/solo') || params.get('mode') === 'solo'

    // ⚡ Mode solo — PRIORITAIRE sur tout le reste
    if (isSoloUrl) {
      setIsSolo(true)
      try {
        const savedSoloId = localStorage.getItem('avid_solo_id')
        if (savedSoloId) { setAthleteId(savedSoloId); return }
      } catch(e) {}
      setSoloSetup(true); setLoading(false); return
    }

    // Mode coach — ?id=xxx en priorité, sinon localStorage coach
    if (idFromUrl) {
      try { localStorage.setItem('avid_athlete_id', idFromUrl) } catch(e) {}
      setAthleteId(idFromUrl); return
    }
    try {
      const saved = localStorage.getItem('avid_athlete_id')
      // Ne pas utiliser le localStorage coach si on est en mode solo
      if (saved) { setAthleteId(saved); return }
    } catch(e) {}
    setError('no_id'); setLoading(false)
  }, [])

  useEffect(() => {
    if (!athleteId) return
    const colName = athleteId.startsWith('solo_') ? 'athletes_solo' : 'athletes'
    const unsub = onSnapshot(doc(db, colName, athleteId), (snap) => {
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

  async function saveAthlete(updatedAthlete) {
    try {
      const clean = JSON.parse(JSON.stringify(updatedAthlete))
      clean.blocs?.forEach(bloc => {
        bloc.semaines?.forEach(sem => {
          sem.seances?.forEach(sea => {
            sea.exercices?.forEach(ex => {
              ex.series = (ex.series || []).map(sr => {
                if (Array.isArray(sr)) return { reps: sr[1] ?? 0, kg: sr[0] ?? 0 }
                return { reps: parseFloat(sr.reps) || 0, kg: parseFloat(sr.kg) || 0 }
              })
            })
          })
        })
      })
      const collection_name = isSolo ? 'athletes_solo' : 'athletes'
      await setDoc(doc(db, collection_name, updatedAthlete.id), clean)
    } catch (e) { notify('⚠ Erreur sauvegarde', C.red) }
  }

  async function createSoloProfil(formData) {
    const newId = 'solo_' + uid() + uid()
    const newAthlete = {
      id: newId,
      prenom: formData.prenom,
      nom: formData.nom,
      objectif: formData.objectif,
      sport: formData.sport,
      taille: formData.taille || '',
      poids: formData.poids || '',
      sexe: formData.sexe || '',
      autonomie: true,
      isSolo: true,
      createdAt: Date.now(),
      blocs: [{
        id: uid(),
        label: 'Bloc 1',
        semaines: [{
          id: uid(),
          label: 'Semaine 1',
          seances: []
        }]
      }]
    }
    try {
      await setDoc(doc(db, 'athletes_solo', newId), newAthlete)
      try { localStorage.setItem('avid_solo_id', newId) } catch(e) {}
      setSoloSetup(false)
      setAthleteId(newId)
    } catch(e) { notify('⚠ Erreur création profil', C.red) }
  }

  if (loading) return <LoadingScreen />
  if (soloSetup) return <SoloSetupScreen onCreate={createSoloProfil} />
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
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column' }}>
      <InjectStyles />

      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            AVID PERFORMANCE LAB
            {isSolo && <span style={{ background: 'rgba(242,196,76,.12)', border: '1px solid rgba(242,196,76,.3)', color: C.yellow, fontSize: 9, fontWeight: 800, letterSpacing: 1, padding: '2px 7px', borderRadius: 3 }}>SOLO</span>}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: 1 }}>
            {athlete?.prenom} {athlete?.nom}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: online ? C.green : C.red }} />
          <button onClick={() => setDark(d => !d)}
            title={dark ? 'Mode clair' : 'Mode sombre'}
            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 20,
              width: 42, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center',
              padding: '0 3px', flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%',
              background: dark ? C.yellow : C.muted,
              transform: dark ? 'translateX(17px)' : 'translateX(0)',
              transition: 'transform 0.2s, background 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, lineHeight: 1 }}>
              {dark ? '☀' : '🌙'}
            </div>
          </button>
          <AvidLogo height={28} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 80 }}>
        {tab === 'profil'    && <ProfilView athlete={athlete} cahiers={cahiers} isSolo={isSolo} saveAthlete={saveAthlete} notify={notify} />}
        {tab === 'programme' && <ProgrammeView athlete={athlete} cahiers={cahiers} saveCahier={saveCahier} notify={notify} saveAthlete={saveAthlete} />}
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
function ProgrammeView({ athlete, cahiers, saveCahier, notify, saveAthlete }) {
  const [blocIdx, setBlocIdx] = useState(() => Math.max(0, (athlete?.blocs?.length || 1) - 1))
  const [semIdx, setSemIdx] = useState(() => {
    const lastBloc = athlete?.blocs?.[Math.max(0, (athlete?.blocs?.length || 1) - 1)]
    return Math.max(0, (lastBloc?.semaines?.length || 1) - 1)
  })
  const [openSea, setOpenSea] = useState(null)

  function dupliquerSemaine(blocI, semI) {
    const bloc = athlete.blocs[blocI]
    const sem = bloc.semaines[semI]
    // Copie avec structure prescrite, cahier vide (nouvelles IDs)
    const newSem = JSON.parse(JSON.stringify(sem))
    newSem.id = uid()
    newSem.label = sem.label + ' (copie)'
    newSem.seances = newSem.seances.map(sea => ({
      ...sea,
      id: uid(),
      exercices: (sea.exercices||[]).map(ex => ({
        ...ex,
        id: uid(),
        series: (ex.series||[]).map(sr => ({ reps: sr.reps ?? 0, kg: sr.kg ?? 0 }))
      }))
    }))
    const updated = JSON.parse(JSON.stringify(athlete))
    updated.blocs[blocI].semaines.push(newSem)
    saveAthlete(updated)
    notify('✓ Semaine dupliquée à la fin du programme', C.green)
    // Naviguer vers la nouvelle semaine
    setTimeout(() => setSemIdx(updated.blocs[blocI].semaines.length - 1), 300)
  }

  function dupliquerBloc(blocI) {
    const bloc = athlete.blocs[blocI]
    const newBloc = JSON.parse(JSON.stringify(bloc))
    newBloc.id = uid()
    newBloc.label = bloc.label + ' (copie)'
    newBloc.semaines = newBloc.semaines.map(sem => ({
      ...sem,
      id: uid(),
      seances: sem.seances.map(sea => ({
        ...sea,
        id: uid(),
        exercices: (sea.exercices||[]).map(ex => ({
          ...ex,
          id: uid(),
          series: (ex.series||[]).map(sr => ({ reps: sr.reps ?? 0, kg: sr.kg ?? 0 }))
        }))
      }))
    }))
    const updated = JSON.parse(JSON.stringify(athlete))
    updated.blocs.push(newBloc)
    saveAthlete(updated)
    notify('✓ Bloc dupliqué à la fin du programme', C.green)
    setTimeout(() => { setBlocIdx(updated.blocs.length - 1); setSemIdx(0) }, 300)
  }

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

      {athlete.autonomie && (
        <button onClick={() => dupliquerBloc(blocIdx)}
          style={{ marginBottom: 14, background: 'transparent', border: `1px dashed ${C.green}`,
            borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700,
            color: C.green, cursor: 'pointer', letterSpacing: 1 }}>
          + Dupliquer ce bloc
        </button>
      )}

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
          {athlete.autonomie && (
            <button onClick={() => dupliquerSemaine(blocIdx, semIdx)}
              style={{ marginTop: 4, marginBottom: 4, background: 'transparent',
                border: `1px dashed ${C.yellow}`, borderRadius: 6,
                padding: '5px 14px', fontSize: 11, fontWeight: 700,
                color: C.yellow, cursor: 'pointer', letterSpacing: 1 }}>
              + Dupliquer cette semaine
            </button>
          )}
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
    const base = (seance.exercices||[]).map((ex, ei) => {
      const existing = cahierData?.[ei]
      return {
        nom: ex.nom, cat: ex.cat,
        series: existing?.series?.length ? existing.series : (ex.series||[]).map(() => ({ reps: '', kg: '' })),
        intensite: existing?.intensite || '',
        remarques: existing?.remarques || '',
      }
    })
    // Restaurer les exercices ajoutés par l'athlète (au-delà des prescrits)
    if (cahierData && cahierData.length > (seance.exercices||[]).length) {
      for (let ei = (seance.exercices||[]).length; ei < cahierData.length; ei++) {
        const e = cahierData[ei]
        if (e) base.push({ nom: e.nom||'', cat: e.cat||'FULL BODY', series: e.series||[{reps:'',kg:''}], intensite: e.intensite||'', remarques: e.remarques||'', _added: true })
      }
    }
    return base
  })
  const [saving, setSaving] = useState(false)
  const [addExoCatPicker, setAddExoCatPicker] = useState(false)
  const cahierDataRef = useRef(null)

  // Resync quand cahierData arrive depuis Firebase (async)
  useEffect(() => {
    if (readOnly || !cahierData) return
    if (cahierDataRef.current === cahierData) return
    cahierDataRef.current = cahierData
    const base = (seance.exercices||[]).map((ex, ei) => {
      const existing = cahierData?.[ei]
      return {
        nom: ex.nom, cat: ex.cat,
        series: existing?.series?.length ? existing.series : (ex.series||[]).map(() => ({ reps: '', kg: '' })),
        intensite: existing?.intensite || '',
        remarques: existing?.remarques || '',
      }
    })
    if (cahierData.length > (seance.exercices||[]).length) {
      for (let ei = (seance.exercices||[]).length; ei < cahierData.length; ei++) {
        const e = cahierData[ei]
        if (e) base.push({ nom: e.nom||'', cat: e.cat||'FULL BODY', series: e.series||[{reps:'',kg:''}], intensite: e.intensite||'', remarques: e.remarques||'', _added: true })
      }
    }
    setLocal(base)
  }, [cahierData])

  async function handleSave() {
    setSaving(true)
    await onSaveCahier(local)
    setSaving(false)
    notify('✓ Séance sauvegardée !', C.green)
  }

  function addSerieToExo(ei) {
    setLocal(prev => prev.map((x, xi) => xi !== ei ? x : {
      ...x, series: [...x.series, { reps: '', kg: '' }]
    }))
  }

  function removeSerieFromExo(ei, si) {
    setLocal(prev => prev.map((x, xi) => xi !== ei ? x : {
      ...x, series: x.series.filter((_, i) => i !== si)
    }))
  }

  function addExoToSeance(cat) {
    setAddExoCatPicker(false)
    if (isCardio(cat)) {
      setLocal(prev => [...prev, {
        nom: '', cat: 'CARDIO',
        cardioType: '',
        blocs: [{ duree: '', allure: '', watt: '', kcal: '', effortType: 'EF' }],
        series: [], intensite: '', remarques: '', _added: true,
      }])
    } else {
      setLocal(prev => [...prev, {
        nom: '', cat: cat || 'FULL BODY',
        series: [{ reps: '', kg: '' }, { reps: '', kg: '' }, { reps: '', kg: '' }],
        intensite: '', remarques: '', _added: true,
      }])
    }
  }

  function removeExoFromSeance(ei) {
    setLocal(prev => prev.filter((_, i) => i !== ei))
  }

  function updateExoNom(ei, val) {
    setLocal(prev => prev.map((x, xi) => xi !== ei ? x : { ...x, nom: val }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: C.bg,
      display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

      {/* Header sticky avec flèche retour */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`,
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', color: C.muted,
            fontSize: 22, cursor: 'pointer', padding: '0 6px', lineHeight: 1,
            display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.yellow,
            letterSpacing: 1, whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis' }}>{seance.label}</div>
          <div style={{ fontSize: 9, color: C.muted }}>
            Séance {seance.num} · {seance.exercices?.length || 0} exercices
          </div>
        </div>
        {saving && (
          <div style={{ fontSize: 10, color: C.yellow, letterSpacing: 1, flexShrink: 0 }}>
            ↑ SYNC...
          </div>
        )}
      </div>

      <div style={{ padding: '14px', flex: 1 }}>

      {(readOnly ? (seance.exercices||[]) : (local || [])).map((exLocal, ei) => {
        const prescEx = seance.exercices?.[ei]
        const isAdded = !readOnly && ei >= (seance.exercices||[]).length
        const exDisp = readOnly ? exLocal : (local?.[ei] || exLocal)
        const cc = CAT_COLORS[(exDisp.cat||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(' ')[0]] || CAT_COLORS['FULL BODY']
        return (
          <div key={ei} style={{ background: C.card, borderRadius: 10, marginBottom: 12,
            border: `1px solid ${isAdded ? C.purple : C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 10, background: C.inset }}>
              <div style={{ background: cc.bg, color: cc.text, fontSize: 9, fontWeight: 800,
                padding: '2px 8px', borderRadius: 3, letterSpacing: 1, flexShrink: 0 }}>{exDisp.cat}</div>
              {(!readOnly && isAdded) ? (
                <input value={local?.[ei]?.nom || ''}
                  onChange={e => updateExoNom(ei, e.target.value)}
                  placeholder="Nom de l'exercice"
                  style={{ background: 'none', border: 'none', borderBottom: `1px solid ${C.yellow}`,
                    fontSize: 13, fontWeight: 800, color: C.white, flex: 1, outline: 'none' }}/>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 800, color: C.white, flex: 1 }}>
                  {readOnly ? exLocal.nom : (prescEx?.nom || exDisp.nom)}
                </div>
              )}
              {isAdded && !readOnly && (
                <button onClick={() => removeExoFromSeance(ei)}
                  style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
              )}
              <div style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                background: local?.[ei]?.intensite >= 9 ? C.red : local?.[ei]?.intensite >= 7 ? C.yellow : C.border,
                color: local?.[ei]?.intensite >= 7 ? C.bg : C.muted }}>
                {local?.[ei]?.intensite ? `RPE ${local[ei].intensite}` : 'RPE —'}
              </div>
            </div>

            <div style={{ padding: '10px 14px' }}>
              {isCardio(exDisp.cat) ? (
                /* ── CARDIO ── */
                !readOnly ? (
                  <div>
                    {/* Sous-type */}
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>TYPE D'ACTIVITÉ</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                      {CARDIO_SUBTYPES.map(t => (
                        <button key={t} onClick={() => setLocal(prev => prev.map((x, xi) => xi === ei ? { ...x, cardioType: t } : x))}
                          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid',
                            borderColor: local?.[ei]?.cardioType === t ? C.red : C.border,
                            background: local?.[ei]?.cardioType === t ? 'rgba(234,67,53,.15)' : C.card,
                            color: local?.[ei]?.cardioType === t ? C.red : C.muted,
                            fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {t}
                        </button>
                      ))}
                    </div>
                    {/* Blocs effort */}
                    <div style={{ display: 'grid', gridTemplateColumns: '18px 1fr 1fr 1fr 1fr 1fr 18px', gap: 5, marginBottom: 6, fontSize: 8, color: C.muted, fontWeight: 700, letterSpacing: 1 }}>
                      <div>#</div>
                      <div style={{ textAlign: 'center' }}>DURÉE</div>
                      <div style={{ textAlign: 'center' }}>ALLURE</div>
                      <div style={{ textAlign: 'center' }}>WATT</div>
                      <div style={{ textAlign: 'center' }}>KCAL</div>
                      <div style={{ textAlign: 'center' }}>EFFORT</div>
                      <div/>
                    </div>
                    {(local?.[ei]?.blocs || [{ duree: '', allure: '', watt: '', kcal: '', effortType: 'EF' }]).map((bloc, bi) => (
                      <div key={bi} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 1fr 1fr 1fr 1fr 18px', gap: 5, marginBottom: 6, alignItems: 'center' }}>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textAlign: 'center' }}>{bi+1}</div>
                        <input type="text" inputMode="decimal" value={bloc.duree || ''}
                          onChange={e => setLocal(prev => prev.map((x, xi) => xi !== ei ? x : { ...x, blocs: (x.blocs||[]).map((b, bj) => bj === bi ? { ...b, duree: e.target.value } : b) }))}
                          placeholder="min"
                          style={{ background: C.inset, border: `1px solid ${C.green}`, borderRadius: 5, padding: '7px 3px', fontSize: 11, fontWeight: 700, color: C.green, textAlign: 'center', width: '100%', outline: 'none' }}/>
                        <input type="text" value={bloc.allure || ''}
                          onChange={e => setLocal(prev => prev.map((x, xi) => xi !== ei ? x : { ...x, blocs: (x.blocs||[]).map((b, bj) => bj === bi ? { ...b, allure: e.target.value } : b) }))}
                          placeholder="5:30"
                          style={{ background: C.inset, border: `1px solid ${C.yellow}`, borderRadius: 5, padding: '7px 3px', fontSize: 11, fontWeight: 700, color: C.yellow, textAlign: 'center', width: '100%', outline: 'none' }}/>
                        <input type="text" inputMode="decimal" value={bloc.watt || ''}
                          onChange={e => setLocal(prev => prev.map((x, xi) => xi !== ei ? x : { ...x, blocs: (x.blocs||[]).map((b, bj) => bj === bi ? { ...b, watt: e.target.value } : b) }))}
                          placeholder="W"
                          style={{ background: C.inset, border: '1px solid #F2994A', borderRadius: 5, padding: '7px 3px', fontSize: 11, fontWeight: 700, color: '#F2994A', textAlign: 'center', width: '100%', outline: 'none' }}/>
                        <input type="text" inputMode="decimal" value={bloc.kcal || ''}
                          onChange={e => setLocal(prev => prev.map((x, xi) => xi !== ei ? x : { ...x, blocs: (x.blocs||[]).map((b, bj) => bj === bi ? { ...b, kcal: e.target.value } : b) }))}
                          placeholder="kcal"
                          style={{ background: C.inset, border: '1px solid #EB5757', borderRadius: 5, padding: '7px 3px', fontSize: 11, fontWeight: 700, color: '#EB5757', textAlign: 'center', width: '100%', outline: 'none' }}/>
                        <select value={bloc.effortType || 'EF'}
                          onChange={e => setLocal(prev => prev.map((x, xi) => xi !== ei ? x : { ...x, blocs: (x.blocs||[]).map((b, bj) => bj === bi ? { ...b, effortType: e.target.value } : b) }))}
                          style={{ background: C.inset, border: `1px solid ${C.orange}`, borderRadius: 5, padding: '7px 3px', fontSize: 10, fontWeight: 700, color: C.orange, width: '100%', outline: 'none' }}>
                          {CARDIO_EFFORT_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <button onClick={() => setLocal(prev => prev.map((x, xi) => xi !== ei ? x : { ...x, blocs: (x.blocs||[]).filter((_, bj) => bj !== bi) }))}
                          style={{ background: 'none', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                    <button onClick={() => setLocal(prev => prev.map((x, xi) => xi !== ei ? x : { ...x, blocs: [...(x.blocs||[]), { duree: '', allure: '', watt: '', kcal: '', effortType: 'EF' }] }))}
                      style={{ width: '100%', background: 'none', border: `1px dashed ${C.border}`, borderRadius: 5, color: C.muted, fontSize: 11, fontWeight: 700, padding: '5px', cursor: 'pointer', marginTop: 4, marginBottom: 14, letterSpacing: 1 }}>
                      + BLOC D'EFFORT
                    </button>
                    {/* RPE + remarques */}
                    <div style={{ paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>RPE RESSENTI</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                        {[1,2,3,4,5,6,7,8,9,10].map(v => (
                          <button key={v} onClick={() => setLocal(prev => prev.map((x, xi) => xi === ei ? { ...x, intensite: String(v) } : x))}
                            style={{ width: 32, height: 32, borderRadius: 6, border: 'none',
                              background: local?.[ei]?.intensite === String(v) ? (v >= 9 ? C.red : v >= 7 ? C.yellow : C.green) : C.border,
                              color: local?.[ei]?.intensite === String(v) ? (v >= 7 ? C.bg : C.white) : C.muted,
                              fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{v}</button>
                        ))}
                      </div>
                      <textarea value={local?.[ei]?.remarques || ''}
                        onChange={e => setLocal(prev => prev.map((x, xi) => xi === ei ? { ...x, remarques: e.target.value } : x))}
                        placeholder="Remarques (sensations, conditions...)" rows={2}
                        style={{ width: '100%', background: C.inset, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 12, color: C.text, resize: 'none', outline: 'none' }}/>
                    </div>
                  </div>
                ) : (
                  /* Cardio read-only */
                  <div style={{ fontSize: 12 }}>
                    {exDisp.cardioType && <div style={{ fontWeight: 700, color: C.red, marginBottom: 8 }}>🏃 {exDisp.cardioType}</div>}
                    {(exDisp.blocs || (exDisp.duree ? [{ duree: exDisp.duree, allure: exDisp.allure, effortType: exDisp.effortType }] : [])).map((b, bi) => (
                      <div key={bi} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6, padding: '6px 8px', background: C.inset, borderRadius: 6 }}>
                        <span style={{ color: C.muted, fontWeight: 700, fontSize: 10 }}>{bi+1}</span>
                        {b.duree && <span style={{ fontWeight: 700, color: C.green }}>⏱ {b.duree}min</span>}
                        {b.allure && <span style={{ fontWeight: 700, color: C.yellow }}>@ {b.allure}</span>}
                        {b.watt && <span style={{ fontWeight: 700, color: '#F2994A' }}>⚡ {b.watt}W</span>}
                        {b.kcal && <span style={{ fontWeight: 700, color: '#EB5757' }}>🔥 {b.kcal}kcal</span>}
                        {b.effortType && <span style={{ fontWeight: 700, color: C.orange, padding: '1px 6px', borderRadius: 3, background: 'rgba(242,153,74,.15)', fontSize: 11 }}>{b.effortType}</span>}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* ── MUSCULATION ── */
                <>
              {readOnly ? (
                <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 6,
                  marginBottom: 6, fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>
                  <div>#</div>
                  <div style={{ textAlign: 'center' }}>REPS</div>
                  <div style={{ textAlign: 'center' }}>KG PRESCRIT</div>
                </div>
              ) : isAdded ? (
                <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 1fr 24px', gap: 5,
                  marginBottom: 6, fontSize: 8, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>
                  <div>#</div>
                  <div style={{ textAlign: 'center', color: C.yellow }}>REPS</div>
                  <div style={{ textAlign: 'center', color: C.yellow }}>KG</div>
                  <div/>
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

              {(readOnly ? (exLocal.series||[]) : (local?.[ei]?.series || [])).map((sr, si) => {
                const prescSr = prescEx?.series?.[si]
                const prescReps = prescSr ? (Array.isArray(prescSr) ? prescSr[0] : prescSr.reps) : '—'
                const prescKg   = prescSr ? (Array.isArray(prescSr) ? prescSr[1] : prescSr.kg)   : '—'
                const reps = Array.isArray(sr) ? sr[0] : sr.reps
                const kg   = Array.isArray(sr) ? sr[1] : sr.kg
                const isExtra = !readOnly && !isAdded && si >= (prescEx?.series?.length || 0)
                return (
                  <div key={si} style={{ display: 'grid',
                    gridTemplateColumns: readOnly ? '28px 1fr 1fr' : '22px 1fr 1fr 1fr 1fr 24px',
                    gap: readOnly ? 6 : 4, marginBottom: 6, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: isExtra ? C.orange : C.muted,
                      fontWeight: 700, textAlign: 'center' }}>{si + 1}{isExtra ? '+' : ''}</div>
                    {readOnly ? (
                      <>
                        <div style={{ background: C.inset, borderRadius: 4, padding: '6px 4px',
                          fontSize: 12, fontWeight: 700, color: C.text, textAlign: 'center' }}>{reps || '—'}</div>
                        <div style={{ background: C.inset, borderRadius: 4, padding: '6px 4px',
                          fontSize: 12, fontWeight: 700,
                          color: parseFloat(kg) > 0 ? C.yellow : C.muted, textAlign: 'center' }}>
                          {parseFloat(kg) > 0 ? `${kg}kg` : '—'}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ background: C.inset, borderRadius: 4, padding: '5px 3px',
                          fontSize: 11, color: C.muted, textAlign: 'center' }}>{prescReps || '—'}</div>
                        <div style={{ background: C.inset, borderRadius: 4, padding: '5px 3px',
                          fontSize: 11, color: C.muted, textAlign: 'center' }}>
                          {parseFloat(prescKg) > 0 ? `${prescKg}` : '—'}
                        </div>
                        <input type="number" inputMode="decimal"
                          value={local?.[ei]?.series?.[si]?.reps || ''}
                          onChange={e => setLocal(prev => prev.map((x, xi) => xi !== ei ? x : {
                            ...x, series: x.series.map((s, si2) => si2 !== si ? s : { ...s, reps: e.target.value })
                          }))}
                          placeholder="reps"
                          style={{ background: C.inset, border: `1px solid ${C.green}`,
                            borderRadius: 4, padding: '6px 3px', fontSize: 12, fontWeight: 700,
                            color: C.green, textAlign: 'center', width: '100%', outline: 'none' }}
                        />
                        <input type="number" inputMode="decimal"
                          value={local?.[ei]?.series?.[si]?.kg || ''}
                          onChange={e => setLocal(prev => prev.map((x, xi) => xi !== ei ? x : {
                            ...x, series: x.series.map((s, si2) => si2 !== si ? s : { ...s, kg: e.target.value })
                          }))}
                          placeholder="kg"
                          style={{ background: C.inset, border: `1px solid ${C.yellow}`,
                            borderRadius: 4, padding: '6px 3px', fontSize: 12, fontWeight: 700,
                            color: C.yellow, textAlign: 'center', width: '100%', outline: 'none' }}
                        />
                        <button onClick={() => removeSerieFromExo(ei, si)}
                          style={{ background: 'none', border: 'none', color: C.muted,
                            fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                      </>
                    )}
                  </div>
                )
              })}
              {!readOnly && (
                <button onClick={() => addSerieToExo(ei)}
                  style={{ width: '100%', background: 'none', border: `1px dashed ${C.orange}`,
                    borderRadius: 5, color: C.orange, fontSize: 11, fontWeight: 700,
                    padding: '5px', cursor: 'pointer', marginTop: 4, letterSpacing: 1 }}>
                  + SÉRIE SUPPLÉMENTAIRE
                </button>
              )}

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
                    style={{ width: '100%', background: C.inset, border: `1px solid ${C.border}`,
                      borderRadius: 6, padding: '8px 10px', fontSize: 12, color: C.text,
                      resize: 'none', outline: 'none' }}
                  />
                </div>
              )}
              </>
              )}
            </div>
          </div>
        )
      })}

      {!readOnly && (
        <button onClick={() => setAddExoCatPicker(true)}
          style={{ width: '100%', background: 'none', border: `1px dashed ${C.purple}`,
            borderRadius: 8, color: C.purple, fontSize: 12, fontWeight: 700,
            padding: '10px', cursor: 'pointer', marginBottom: 80, letterSpacing: 1 }}>
          + AJOUTER UN EXERCICE
        </button>
      )}

      </div>

      {/* Modal picker catégorie — EN DEHORS du scroll container */}
      {!readOnly && addExoCatPicker && (
        <div
          onClick={() => setAddExoCatPicker(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div
            onClick={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            style={{ background: '#1C1C1C', borderRadius: 14, padding: 24, width: '100%', maxWidth: 340,
              border: `2px solid ${C.purple}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.purple, letterSpacing: 2, marginBottom: 16, textAlign: 'center' }}>
              CHOISIR LA CATÉGORIE
            </div>
            {[
              { cat: 'POUSSEE',   label: '🔵 POUSSÉE (Push)', bg: '#2F80ED', color: '#FFF' },
              { cat: 'TIRAGE',    label: '🟢 TIRAGE (Pull)',  bg: '#27AE60', color: '#FFF' },
              { cat: 'JAMBES',    label: '🟡 JAMBES (Legs)',  bg: '#F2C94C', color: '#1a1000' },
              { cat: 'FULL BODY', label: '🟣 FULL BODY',      bg: '#9B51E0', color: '#FFF' },
              { cat: 'CARDIO',    label: '🔴 CARDIO',         bg: '#EA4335', color: '#FFF' },
              { cat: 'AUTRES',    label: '⚫ AUTRES',          bg: '#4A4A4A', color: '#FFF' },
            ].map(({ cat, label, bg, color }) => (
              <button key={cat}
                onClick={() => addExoToSeance(cat)}
                style={{ display: 'block', width: '100%', padding: '14px 16px', borderRadius: 8,
                  border: 'none', background: bg, color,
                  fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: 1,
                  textAlign: 'left', marginBottom: 10 }}>
                {label}
              </button>
            ))}
            <button onClick={() => setAddExoCatPicker(false)}
              style={{ width: '100%', background: 'none', border: '1px solid #333',
                borderRadius: 8, color: '#888', fontSize: 12, cursor: 'pointer', padding: '10px', marginTop: 4 }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* FAB Sauvegarder — bulle verte flottante bas droite */}
      {!readOnly && (
        <button onClick={handleSave} disabled={saving}
          style={{ position: 'fixed', bottom: 16, right: 18, zIndex: 210,
            width: 52, height: 52, borderRadius: '50%',
            background: saving ? C.muted : C.green, border: 'none',
            cursor: saving ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: '#fff',
            boxShadow: saving ? 'none' : '0 4px 16px rgba(39,174,96,.5)',
            transition: 'background .2s, box-shadow .2s' }}
          title="Sauvegarder la séance">
          {saving ? '⏳' : '✓'}
        </button>
      )}
    </div>
  )
}

// ── Stats View ────────────────────────────────────────────────────────────────
// ── Mini graphique SVG propre ──────────────────────────────────────────────────
function MiniChart({ data, color, height = 80, showLabels = false, yMax = null, yMin = 0, unit = '' }) {
  const vals = data.map(d => d.v != null ? d.v : null)
  const valid = vals.filter(v => v !== null)
  if (valid.length === 0) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 11 }}>—</div>

  const maxV = yMax != null ? yMax : Math.max(...valid) * 1.12 || 1
  const minV = yMin != null ? yMin : Math.min(...valid) * 0.88
  const n = data.length
  const STEP = Math.max(32, Math.min(52, 320 / n))
  const PL = 2, PR = 8, PT = 18, PB = showLabels ? 22 : 6
  const W = n <= 1 ? 320 : (n - 1) * STEP + PL + PR
  const H = height + PT + PB
  const gW = W - PL - PR
  const gH = height

  const px = i => PL + (n <= 1 ? gW / 2 : (i / (n - 1)) * gW)
  const py = v => PT + gH - ((v - minV) / (maxV - minV || 1)) * gH

  const pts = vals.map((v, i) => v != null ? { x: px(i), y: py(v), v, lbl: data[i].lbl } : null)
  const lpts = pts.filter(p => p)

  const pathD = lpts.length > 1 ? lpts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : ''
  const fillD = pathD ? `${pathD} L${lpts[lpts.length-1].x.toFixed(1)},${(PT+gH).toFixed(1)} L${lpts[0].x.toFixed(1)},${(PT+gH).toFixed(1)} Z` : ''

  const maxPt = lpts.reduce((a, b) => b.v > a.v ? b : a, lpts[0])
  const lastPt = lpts[lpts.length - 1]
  const labeled = new Set([maxPt?.x, lastPt?.x].filter(Boolean))
  const xEvery = Math.max(1, Math.ceil(n / 6))

  const fmt = v => v >= 1000 ? `${Math.round(v/1000)}k` : unit === 'rpe' ? v.toFixed(1) : Math.round(v)

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={Math.max(W, 280)} height={H} style={{ display: 'block' }}>
        {/* Grille horizontale */}
        {[0, 0.5, 1].map(t => (
          <line key={t} x1={PL} x2={W - PR}
            y1={PT + (1-t)*gH} y2={PT + (1-t)*gH}
            stroke={C.border} strokeWidth="1" />
        ))}
        {/* Fill */}
        {fillD && <path d={fillD} fill={color} opacity="0.1" />}
        {/* Ligne */}
        {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {/* Points */}
        {lpts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={labeled.has(p.x) ? 4 : 2.5} fill={color} />
        ))}
        {/* Labels valeurs (max + dernier seulement) */}
        {lpts.filter(p => labeled.has(p.x)).map((p, i) => (
          <text key={i} x={p.x} y={p.y - 7} textAnchor="middle"
            fontSize="10" fill={color} fontWeight="800">{fmt(p.v)}{unit && unit !== 'rpe' ? unit : ''}</text>
        ))}
        {/* Labels axe X */}
        {showLabels && data.map((d, i) => (
          (i % xEvery === 0 || i === n - 1) && (
            <text key={i} x={px(i)} y={H - 4} textAnchor="middle"
              fontSize="9" fill={C.muted}>{d.lbl}</text>
          )
        ))}
      </svg>
    </div>
  )
}

// ── Stats View ─────────────────────────────────────────────────────────────────
function StatsView({ athlete, cahiers }) {
  const [tab, setTab] = useState('overview') // 'overview' | 'exercices' | 'regularite'
  const [selExo, setSelExo] = useState(null)

  // ── Agrégation des données ──
  const seancesList = []   // { label, lbl, date, vol, rpe, seai }
  const weekMap = {}        // sem.id → { lbl, vol, rpe[], count }
  const prMap = {}          // ex.nom → { kg, reps, label }
  const exoData = {}        // ex.nom → [{ lbl, vol, rpe, kg }]
  const catVol = {}         // cat → tonnage total

  try {
    athlete?.blocs?.forEach(bloc => {
      bloc.semaines?.forEach(sem => {
        const semKey = sem.id
        sem.seances?.forEach((sea, seai) => {
          const key = `${athlete.id}-${bloc.id}-${sem.id}-${seai}`
          const cahier = cahiers[key]
          if (!cahier?.data) return

          const lbl = `${(bloc.label||'').replace('BLOCK ','B')}·${sem.label||''}`
          const date = cahier.updatedAt || 0

          // RPE moyen séance
          const rpeVals = cahier.data.map(c => parseFloat(c.intensite)).filter(v => !isNaN(v) && v >= 1 && v <= 10)
          const rpeMoyen = rpeVals.length ? Math.round((rpeVals.reduce((s,v)=>s+v,0)/rpeVals.length)*10)/10 : null

          // Volume séance
          let volSeance = 0
          sea.exercices?.forEach((ex, ei) => {
            if (!ex?.nom) return
            const cex = cahier.data[ei]
            if (!cex) return
            const series = Array.isArray(cex.series) ? cex.series : []
            const validS = series.filter(s => parseFloat(s.kg)>0 && parseFloat(s.reps)>0)
            const vol = validS.reduce((s,sr) => s+(parseFloat(sr.reps)||0)*(parseFloat(sr.kg)||0), 0)
            if (vol > 0) volSeance += vol

            // Tonnage par groupe musculaire
            if (vol > 0 && ex.cat) {
              const g = ex.cat.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(' ')[0]
              catVol[g] = (catVol[g] || 0) + vol
            }

            // PR
            validS.forEach(s => {
              const kg = parseFloat(s.kg), reps = parseFloat(s.reps)
              if (kg > 0 && (!prMap[ex.nom] || kg > prMap[ex.nom].kg)) {
                prMap[ex.nom] = { kg, reps: reps||null, label: lbl, cat: ex.cat }
              }
            })

            // Données par exercice
            const rpeEx = parseFloat(cex.intensite)
            const rpeExOk = (!isNaN(rpeEx) && rpeEx >= 1 && rpeEx <= 10) ? rpeEx : null
            const maxKg = validS.length ? Math.max(...validS.map(s=>parseFloat(s.kg)||0)) : 0
            if (vol > 0 || rpeExOk) {
              if (!exoData[ex.nom]) exoData[ex.nom] = []
              exoData[ex.nom].push({ lbl, date, v: vol, vol, rpe: rpeExOk, kg: maxKg })
            }
          })

          seancesList.push({ lbl, date, v: volSeance, vol: volSeance, rpe: rpeMoyen })

          // Agrégation par semaine
          if (!weekMap[semKey]) weekMap[semKey] = { lbl: `${sem.label}`, vol: 0, rpes: [], count: 0 }
          if (volSeance > 0) weekMap[semKey].vol += volSeance
          if (rpeMoyen) weekMap[semKey].rpes.push(rpeMoyen)
          weekMap[semKey].count++
        })
      })
    })
  } catch(e) { console.error('Stats:', e) }

  const weeklyData = Object.values(weekMap).map(w => ({
    lbl: w.lbl, v: w.vol, vol: w.vol,
    rpe: w.rpes.length ? Math.round((w.rpes.reduce((s,v)=>s+v,0)/w.rpes.length)*10)/10 : null,
    count: w.count
  }))

  const exoNames = Object.keys(exoData).sort()
  const totalDone = seancesList.length
  const totalPrescribed = athlete?.blocs?.reduce((s,b)=>s+(b.semaines?.reduce((ss,sem)=>ss+(sem.seances?.length||0),0)||0),0)||0
  const avgRpe = seancesList.filter(s=>s.rpe).length
    ? Math.round((seancesList.filter(s=>s.rpe).reduce((s,v)=>s+v.rpe,0)/seancesList.filter(s=>s.rpe).length)*10)/10
    : null
  const totalVol = Math.round(seancesList.reduce((s,v)=>s+v.vol,0))

  const prList = Object.entries(prMap).map(([nom,pr]) => {
    const oneRM = pr.reps && pr.reps > 1 ? Math.round(pr.kg * (1 + pr.reps / 30)) : pr.kg
    return { nom, ...pr, oneRM }
  }).sort((a,b) => b.kg - a.kg)

  // Top 3 PR par groupe musculaire principal
  const GROUP_KEYS = [
    { k: 'JAMBES',  label: 'Jambes',  color: '#F2C94C', textColor: '#1a1000' },
    { k: 'POUSSEE', label: 'Poussée', color: '#2F80ED', textColor: '#FFF' },
    { k: 'TIRAGE',  label: 'Tirage',  color: '#27AE60', textColor: '#FFF' },
  ]
  const prByGroup = GROUP_KEYS.map(g => {
    const top3 = prList.filter(pr => {
      const k = (pr.cat||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(' ')[0]
      return k === g.k
    }).slice(0, 3)
    return { ...g, top3 }
  }).filter(g => g.top3.length > 0)

  const currentExo = selExo && exoData[selExo] ? exoData[selExo] : null

  const TABS = [
    { k: 'overview', label: 'VUE GLOBALE' },
    { k: 'exercices', label: 'EXERCICES' },
    { k: 'regularite', label: 'RÉGULARITÉ' },
  ]

  return (
    <div style={{ padding: '16px 14px' }}>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none',
              background: tab === t.k ? C.yellow : C.card,
              color: tab === t.k ? '#1a1000' : C.muted,
              fontSize: 9, fontWeight: 800, cursor: 'pointer', letterSpacing: 0.5 }}>
            {t.label}
          </button>
        ))}
      </div>

      {totalDone === 0 ? (
        <div style={{ background: C.card, borderRadius: 10, padding: '40px 20px', textAlign: 'center', border: `1px dashed ${C.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>Remplis ton cahier d'entraînement<br/><span style={{fontSize:12}}>pour voir tes statistiques ici.</span></div>
        </div>
      ) : tab === 'overview' ? (

        // ════════════════════════════════
        // TAB VUE GLOBALE
        // ════════════════════════════════
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { l: 'SÉANCES', v: totalDone, sub: `/ ${totalPrescribed} prévues`, c: C.green },
              { l: 'TONNAGE TOTAL', v: totalVol >= 1000 ? `${Math.round(totalVol/1000)}k` : totalVol, sub: 'kg soulevés', c: C.blue },
              { l: 'RPE MOYEN', v: avgRpe || '—', sub: 'intensité /10', c: avgRpe >= 8 ? C.red : avgRpe >= 6 ? C.yellow : C.green },
              { l: 'EXERCICES', v: exoNames.length, sub: 'suivis', c: C.purple },
            ].map(({ l, v, sub, c }) => (
              <div key={l} style={{ background: C.card, borderRadius: 10, padding: '14px', borderTop: `3px solid ${c}` }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: C.muted, letterSpacing: 1, marginTop: 4 }}>{l}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Barre progression */}
          {totalPrescribed > 0 && (
            <div style={{ background: C.card, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>PROGRESSION DU PROGRAMME</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.yellow }}>{Math.round((totalDone/totalPrescribed)*100)}%</span>
              </div>
              <div style={{ background: C.border, borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ background: `linear-gradient(90deg, ${C.green}, ${C.blue})`, height: '100%', borderRadius: 4,
                  width: `${Math.min(100,(totalDone/totalPrescribed)*100)}%`, transition: 'width .5s ease' }} />
              </div>
            </div>
          )}

          {/* Volume par semaine */}
          {weeklyData.filter(w=>w.vol>0).length > 1 && (
            <div style={{ background: C.card, borderRadius: 10, padding: '14px', marginBottom: 12, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 2 }}>VOLUME HEBDOMADAIRE</div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>KG PAR SEMAINE</div>
              <MiniChart data={weeklyData.filter(w=>w.vol>0)} color={C.blue} height={70} showLabels />
            </div>
          )}

          {/* RPE par semaine */}
          {weeklyData.filter(w=>w.rpe).length > 1 && (
            <div style={{ background: C.card, borderRadius: 10, padding: '14px', marginBottom: 12, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 2 }}>INTENSITÉ MOYENNE</div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>RPE MOYEN PAR SEMAINE</div>
              <MiniChart data={weeklyData.filter(w=>w.rpe).map(w=>({...w, v:w.rpe}))} color={C.red} height={60} yMax={10} yMin={1} unit="rpe" showLabels />
            </div>
          )}

          {/* Tonnage par groupe musculaire */}
          {Object.keys(catVol).length > 0 && (() => {
            const groups = [
              { k: 'JAMBES',   label: 'Jambes',    color: '#F2C94C' },
              { k: 'POUSSEE',  label: 'Poussée',   color: '#2F80ED' },
              { k: 'TIRAGE',   label: 'Tirage',    color: '#27AE60' },
              { k: 'FULL',     label: 'Full Body', color: '#9B51E0' },
              { k: 'CARDIO',   label: 'Cardio',    color: '#EA4335' },
              { k: 'AUTRES',   label: 'Autres',    color: '#4A4A4A' },
            ].filter(g => catVol[g.k] > 0)
            const totalCat = groups.reduce((s,g) => s + (catVol[g.k]||0), 0)
            return (
              <div style={{ background: C.card, borderRadius: 10, padding: '14px', marginBottom: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 2 }}>TONNAGE PAR GROUPE MUSCULAIRE</div>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 14 }}>RÉPARTITION DU VOLUME TOTAL</div>
                {/* Barre empilée */}
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 14, marginBottom: 14 }}>
                  {groups.map(g => (
                    <div key={g.k} style={{
                      width: `${Math.round((catVol[g.k]/totalCat)*100)}%`,
                      background: g.color, height: '100%', minWidth: catVol[g.k] > 0 ? 2 : 0
                    }}/>
                  ))}
                </div>
                {/* Légende */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
                  {groups.map(g => {
                    const pct = Math.round((catVol[g.k]/totalCat)*100)
                    const kg = catVol[g.k] >= 1000 ? `${Math.round(catVol[g.k]/1000)}k` : Math.round(catVol[g.k])
                    return (
                      <div key={g.k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 9, height: 9, borderRadius: 2, background: g.color, flexShrink: 0 }}/>
                        <span style={{ fontSize: 11, color: C.text, fontWeight: 700 }}>{g.label}</span>
                        <span style={{ fontSize: 11, color: g.color, fontWeight: 800 }}>{pct}%</span>
                        <span style={{ fontSize: 10, color: C.muted }}>{kg} kg</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 3 podiums séparés par groupe musculaire */}
          {prByGroup.map(g => (
            <div key={g.k} style={{ background: C.card, borderRadius: 10, padding: '14px',
              border: `1px solid ${C.border}`, borderTop: `3px solid ${g.color}`, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ background: g.color, color: g.textColor, fontSize: 9, fontWeight: 800,
                  padding: '2px 8px', borderRadius: 3, letterSpacing: 1 }}>{g.label.toUpperCase()}</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.text }}>TOP CHARGES</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.top3.map((pr, i) => (
                  <div key={pr.nom} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    background: C.bg, borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 18, width: 24, flexShrink: 0, textAlign: 'center' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                    </div>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.nom}</div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: i === 0 ? g.color : C.text }}>
                        {pr.kg} kg
                        {pr.reps ? <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}> × {pr.reps}</span> : null}
                      </div>
                      {pr.oneRM && pr.oneRM !== pr.kg &&
                        <div style={{ fontSize: 9, color: C.purple }}>~{pr.oneRM} kg 1RM</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>

      ) : tab === 'exercices' ? (

        // ════════════════════════════════
        // TAB EXERCICES
        // ════════════════════════════════
        <>
          {/* Sélecteur exercice */}
          <div style={{ background: C.card, borderRadius: 8, padding: '12px 14px', marginBottom: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 8 }}>CHOISIR UN EXERCICE</div>
            <select value={selExo || ''} onChange={e => setSelExo(e.target.value || null)}
              style={{ width: '100%', background: C.inset, border: `1px solid ${C.yellow}`, borderRadius: 6,
                padding: '10px 12px', fontSize: 13, fontWeight: 700, color: '#FFF', outline: 'none',
                fontFamily: "'Barlow Condensed','Arial Narrow',sans-serif" }}>
              <option value="">— Sélectionner un exercice —</option>
              {exoNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {!selExo ? (
            /* Liste résumée de tous les PR */
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.text }}>🏆 TOUS LES RECORDS</div>
              </div>
              {prList.map((pr, i) => {
                const cc = CAT_COLORS[(pr.cat||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(' ')[0]] || CAT_COLORS['FULL BODY']
                return (
                  <div key={pr.nom} onClick={() => setSelExo(pr.nom)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
                    <div style={{ background: cc.bg, color: cc.text, fontSize: 7, fontWeight: 800, padding: '2px 5px', borderRadius: 3, flexShrink: 0 }}>{pr.cat||'—'}</div>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.nom}</div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.yellow }}>
                        {pr.kg} kg{pr.reps ? <span style={{ fontSize: 10, color: C.muted }}> ×{pr.reps}</span> : null}
                      </div>
                      {pr.oneRM && pr.oneRM !== pr.kg && <div style={{ fontSize: 10, color: C.purple }}>~{pr.oneRM} kg 1RM</div>}
                    </div>
                    <div style={{ color: C.muted, fontSize: 12 }}>›</div>
                  </div>
                )
              })}
            </div>
          ) : currentExo ? (
            <>
              {/* Résumé exercice */}
              {(() => {
                const last = currentExo[currentExo.length - 1]
                const first = currentExo[0]
                const bestKg = Math.max(...currentExo.map(d=>d.kg||0))
                const bestReps = prMap[selExo]?.reps
                const volDiff = first.vol > 0 ? Math.round(((last.vol-first.vol)/first.vol)*100) : null
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <div style={{ background: C.card, borderRadius: 10, padding: '12px', borderTop: `3px solid ${C.yellow}` }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow }}>{bestKg}<span style={{fontSize:10}}> kg</span></div>
                        {bestReps && <div style={{ fontSize: 9, color: C.muted }}>× {bestReps} reps</div>}
                        <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginTop: 4 }}>MEILLEURE CHARGE</div>
                      </div>
                      {last.rpe && (
                        <div style={{ background: C.card, borderRadius: 10, padding: '12px', borderTop: `3px solid ${last.rpe>=8?C.red:last.rpe>=6?C.yellow:C.green}` }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: last.rpe>=8?C.red:last.rpe>=6?C.yellow:C.green }}>{last.rpe}</div>
                          <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginTop: 4 }}>DERNIER RPE</div>
                        </div>
                      )}
                      {volDiff !== null && (
                        <div style={{ background: C.card, borderRadius: 10, padding: '12px', borderTop: `3px solid ${volDiff>=0?C.green:C.red}` }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: volDiff>=0?C.green:C.red }}>{volDiff>=0?'+':''}{volDiff}%</div>
                          <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginTop: 4 }}>ÉVOLUTION VOL.</div>
                        </div>
                      )}
                    </div>

                    {/* Courbe volume exo */}
                    {currentExo.length > 1 && (
                      <div style={{ background: C.card, borderRadius: 10, padding: '14px', marginBottom: 12, border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 2 }}>{selExo}</div>
                        <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>VOLUME PAR SÉANCE (kg)</div>
                        <MiniChart data={currentExo} color={C.blue} height={70} showLabels />
                      </div>
                    )}

                    {/* Courbe charge max exo */}
                    {currentExo.filter(d=>d.kg>0).length > 1 && (
                      <div style={{ background: C.card, borderRadius: 10, padding: '14px', marginBottom: 12, border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 2 }}>CHARGE MAXIMALE</div>
                        <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>KG PAR SÉANCE</div>
                        <MiniChart data={currentExo.filter(d=>d.kg>0).map(d=>({...d,v:d.kg}))} color={C.yellow} height={60} showLabels />
                      </div>
                    )}

                    {/* Courbe RPE exo */}
                    {currentExo.filter(d=>d.rpe).length > 1 && (
                      <div style={{ background: C.card, borderRadius: 10, padding: '14px', border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 2 }}>INTENSITÉ RESSENTIE</div>
                        <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>RPE PAR SÉANCE</div>
                        <MiniChart data={currentExo.filter(d=>d.rpe).map(d=>({...d,v:d.rpe}))} color={C.red} height={60} yMax={10} yMin={1} unit="rpe" showLabels />
                      </div>
                    )}
                  </>
                )
              })()}

              <button onClick={() => setSelExo(null)}
                style={{ width: '100%', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                  color: C.muted, fontSize: 11, padding: '10px', cursor: 'pointer', marginTop: 12 }}>
                ← Tous les exercices
              </button>
            </>
          ) : null}
        </>

      ) : (

        // ════════════════════════════════
        // TAB RÉGULARITÉ
        // ════════════════════════════════
        <>
          {/* Séances par semaine */}
          <div style={{ background: C.card, borderRadius: 10, padding: '14px', marginBottom: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 2 }}>SÉANCES PAR SEMAINE</div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>RÉGULARITÉ D'ENTRAÎNEMENT</div>
            <MiniChart data={Object.values(weekMap).map(w=>({lbl:w.lbl, v:w.count}))} color={C.green} height={70} showLabels />
          </div>

          {/* Volume par séance individuelle */}
          {seancesList.length > 1 && (
            <div style={{ background: C.card, borderRadius: 10, padding: '14px', marginBottom: 12, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 2 }}>VOLUME PAR SÉANCE</div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>KG SOULEVÉS (toutes séances)</div>
              <MiniChart data={seancesList.filter(s=>s.vol>0)} color={C.blue} height={70} showLabels />
            </div>
          )}

          {/* RPE par séance individuelle */}
          {seancesList.filter(s=>s.rpe).length > 1 && (
            <div style={{ background: C.card, borderRadius: 10, padding: '14px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 2 }}>INTENSITÉ PAR SÉANCE</div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>RPE RESSENTI</div>
              <MiniChart data={seancesList.filter(s=>s.rpe).map(s=>({...s,v:s.rpe}))} color={C.red} height={70} yMax={10} yMin={1} unit="rpe" showLabels />
            </div>
          )}
        </>
      )}
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
              style={{ width: '100%', background: C.inset, border: `1px solid ${C.border}`,
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

      {/* Historique nutrition */}
      <NutritionHistory nutri={nutri} />
    </div>
  )
}

// ── Nutrition History Chart ────────────────────────────────────────────────────
function NutritionHistory({ nutri }) {
  const [days, setDays] = useState(7)

  // Build sorted history from nutri collection
  const history = Object.entries(nutri)
    .map(([key, val]) => {
      const d = val?.data || {}
      const date = key.split('-').slice(-3).join('-') // extract YYYY-MM-DD
      return {
        date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        kcal: Math.round((parseFloat(d.glucides)||0)*4 + (parseFloat(d.lipides)||0)*9 + (parseFloat(d.proteines)||0)*4),
        glucides: parseFloat(d.glucides) || 0,
        lipides: parseFloat(d.lipides) || 0,
        proteines: parseFloat(d.proteines) || 0,
        fatigue: parseFloat(d.fatigue) || 0,
      }
    })
    .filter(e => e.date && e.date.match(/^\d{4}-\d{2}-\d{2}$/))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days)

  if (history.length < 2) return (
    <div style={{ marginTop: 24, background: C.card, borderRadius: 10, padding: '20px',
      border: `1px dashed ${C.border}`, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📈</div>
      <div style={{ fontSize: 12, color: C.muted }}>
        Sauvegarde au moins 2 jours pour voir l'évolution
      </div>
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>
          ÉVOLUTION — {days} DERNIERS JOURS
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 14].map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{ background: days === d ? C.yellow : C.card, color: days === d ? C.navy : C.muted,
                border: `1px solid ${days === d ? C.yellow : C.border}`,
                borderRadius: 4, padding: '3px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
              {d}J
            </button>
          ))}
        </div>
      </div>

      {/* Graphique Kcal */}
      <NutriLineChart data={history} field="kcal" label="KCAL" color={C.red} unit="kcal" />

      {/* Graphique Macros */}
      <div style={{ background: C.card, borderRadius: 10, padding: '14px', marginBottom: 10,
        border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 10 }}>
          MACROS (g)
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
          {[
            { f: 'glucides', label: 'GLUC', color: C.yellow },
            { f: 'lipides',  label: 'LIP',  color: C.orange },
            { f: 'proteines',label: 'PROT', color: C.blue },
          ].map(m => (
            <div key={m.f} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
              <span style={{ fontSize: 9, color: m.color, fontWeight: 700 }}>{m.label}</span>
            </div>
          ))}
        </div>
        <MultiLineChart data={history} fields={[
          { f: 'glucides', color: C.yellow },
          { f: 'lipides',  color: C.orange },
          { f: 'proteines',color: C.blue },
        ]} />
        <DateAxis data={history} />
      </div>

      {/* Graphique Fatigue */}
      <NutriLineChart data={history} field="fatigue" label="FATIGUE" color={C.red}
        unit="/10" yMax={10} zones={[
          { from: 0, to: 4, color: '#0a2010' },
          { from: 5, to: 7, color: '#1a1500' },
          { from: 8, to: 10, color: '#200a0a' },
        ]} />
    </div>
  )
}

function NutriLineChart({ data, field, label, color, unit = '', yMax, zones }) {
  const vals = data.map(d => d[field] || 0)
  const max = yMax || Math.max(...vals) || 1
  const min = 0
  const W = 280, H = 80, pad = 20

  const points = vals.map((v, i) => {
    const x = pad + (i / Math.max(1, vals.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v - min) / (max - min)) * (H - pad * 2)
    return { x, y, v }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = pathD + ` L${points[points.length-1].x},${H-pad} L${points[0].x},${H-pad} Z`

  return (
    <div style={{ background: C.card, borderRadius: 10, padding: '14px', marginBottom: 10,
      border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>{label} ({unit})</div>
        <div style={{ fontSize: 11, fontWeight: 800, color }}>
          {vals[vals.length - 1]}{unit === '/10' ? '/10' : ''}
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* Zone backgrounds */}
        {zones?.map((z, zi) => (
          <rect key={zi}
            x={pad} y={H - pad - (z.to / max) * (H - pad*2)}
            width={W - pad*2}
            height={((z.to - z.from) / max) * (H - pad*2)}
            fill={z.color} />
        ))}
        {/* Area fill */}
        <path d={areaD} fill={color} opacity={0.12} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots + values */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={color} />
            {(i === 0 || i === points.length - 1 || vals.length <= 7) && (
              <text x={p.x} y={p.y - 6} textAnchor="middle"
                fontSize={7} fill={color} fontWeight="700">
                {p.v > 0 ? Math.round(p.v) : ''}
              </text>
            )}
          </g>
        ))}
      </svg>
      <DateAxis data={data} />
    </div>
  )
}

function MultiLineChart({ data, fields }) {
  const allVals = fields.flatMap(({ f }) => data.map(d => d[f] || 0))
  const max = Math.max(...allVals) || 1
  const W = 280, H = 70, pad = 16

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {fields.map(({ f, color }) => {
        const vals = data.map(d => d[f] || 0)
        const points = vals.map((v, i) => ({
          x: pad + (i / Math.max(1, vals.length - 1)) * (W - pad * 2),
          y: H - pad - (v / max) * (H - pad * 1.5),
          v,
        }))
        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
        return (
          <g key={f}>
            <path d={pathD} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

function DateAxis({ data }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingLeft: 2, paddingRight: 2 }}>
      {data.map((d, i) => (
        (i === 0 || i === data.length - 1 || data.length <= 7) && (
          <div key={i} style={{ fontSize: 7, color: C.muted, textAlign: 'center',
            flex: i === 0 || i === data.length - 1 ? '0 0 auto' : 1 }}>
            {d.label}
          </div>
        )
      ))}
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
              background: i === 0 ? 'rgba(242,196,76,.12)' : 'transparent' }}>
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
function ProfilView({ athlete, cahiers, isSolo, saveAthlete, notify }) {
  if (!athlete) return null
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ prenom: athlete.prenom || '', nom: athlete.nom || '', objectif: athlete.objectif || '', sport: athlete.sport || '', taille: athlete.taille || '', poids: athlete.poids || '', sexe: athlete.sexe || '' })
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSaveProfil() {
    const updated = { ...athlete, ...form }
    await saveAthlete(updated)
    notify('✓ Profil mis à jour', '#27AE60')
    setEditing(false)
  }

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
        {isSolo && (
          <button onClick={() => setEditing(e => !e)}
            style={{ marginLeft: 'auto', background: editing ? C.border : 'rgba(242,196,76,.1)', border: '1px solid rgba(242,196,76,.3)', borderRadius: 6, color: '#F2C94C', fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: '6px 12px', cursor: 'pointer', flexShrink: 0 }}>
            {editing ? '✕ Annuler' : '✏ Modifier'}
          </button>
        )}
      </div>

      {/* Formulaire édition solo */}
      {editing && (
        <div className="fade-in" style={{ background: C.panel, borderRadius: 12, padding: '18px 16px', border: '1px solid rgba(242,196,76,.2)', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#F2C94C', letterSpacing: 2, marginBottom: 14 }}>MODIFIER LE PROFIL</div>
          {[
            { k: 'prenom', l: 'PRÉNOM', ph: 'Prénom' },
            { k: 'nom', l: 'NOM', ph: 'Nom' },
            { k: 'objectif', l: 'OBJECTIF', ph: 'Prise de masse, force...' },
            { k: 'sport', l: 'SPORT', ph: 'Musculation, CrossFit...' },
          ].map(({ k, l, ph }) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#555', letterSpacing: 2, marginBottom: 4 }}>{l}</div>
              <input value={form[k]} onChange={e => setF(k, e.target.value)} placeholder={ph}
                style={{ width: '100%', background: C.inset, border: '1px solid #333', borderRadius: 6, padding: '10px 12px', color: '#fff', fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#555', letterSpacing: 2, marginBottom: 4 }}>TAILLE (cm)</div>
              <input type="number" value={form.taille} onChange={e => setF('taille', e.target.value)}
                style={{ width: '100%', background: C.inset, border: '1px solid #333', borderRadius: 6, padding: '10px 12px', color: '#fff', fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#555', letterSpacing: 2, marginBottom: 4 }}>POIDS (kg)</div>
              <input type="number" value={form.poids} onChange={e => setF('poids', e.target.value)}
                style={{ width: '100%', background: C.inset, border: '1px solid #333', borderRadius: 6, padding: '10px 12px', color: '#fff', fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>
          <button onClick={handleSaveProfil}
            style={{ width: '100%', marginTop: 14, background: '#F2C94C', color: '#1a1000', border: 'none', borderRadius: 8, padding: '13px', fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer' }}>
            Sauvegarder →
          </button>
        </div>
      )}

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

      {/* ── Stats globales compactes ── */}
      {(() => {
        // Calcul rapide depuis cahiers
        let totalDone = 0, totalVol = 0, rpeVals = []
        const prMapLocal = {}
        try {
          athlete.blocs?.forEach(bloc => {
            bloc.semaines?.forEach(sem => {
              sem.seances?.forEach((sea, seai) => {
                const key = `${athlete.id}-${bloc.id}-${sem.id}-${seai}`
                const cahier = cahiers[key]
                if (!cahier?.data) return
                totalDone++
                cahier.data.forEach((cex, ei) => {
                  const ex = sea.exercices?.[ei]
                  ;(cex.series || []).filter(s => parseFloat(s.kg) > 0 && parseFloat(s.reps) > 0).forEach(s => {
                    const kg = parseFloat(s.kg), reps = parseFloat(s.reps)
                    totalVol += kg * reps
                    if (ex?.nom && (!prMapLocal[ex.nom] || kg > prMapLocal[ex.nom].kg))
                      prMapLocal[ex.nom] = { kg, reps, nom: ex.nom, cat: ex.cat }
                  })
                  const rpe = parseFloat(cex.intensite)
                  if (!isNaN(rpe) && rpe >= 1 && rpe <= 10) rpeVals.push(rpe)
                })
              })
            })
          })
        } catch(e) {}

        const avgRpe = rpeVals.length ? Math.round((rpeVals.reduce((s,v)=>s+v,0)/rpeVals.length)*10)/10 : null
        const volFmt = totalVol >= 1000000 ? `${Math.round(totalVol/1000000)}M` : totalVol >= 1000 ? `${Math.round(totalVol/1000)}k` : Math.round(totalVol)

        const GROUP_KEYS_P = [
          { k: 'JAMBES',  label: 'Jambes',  color: '#F2C94C', textColor: '#1a1000' },
          { k: 'POUSSEE', label: 'Poussée', color: '#2F80ED', textColor: '#FFF' },
          { k: 'TIRAGE',  label: 'Tirage',  color: '#27AE60', textColor: '#FFF' },
        ]
        const allPrs = Object.values(prMapLocal).sort((a,b) => b.kg - a.kg)
        const prByGroupP = GROUP_KEYS_P.map(g => {
          const best = allPrs.find(pr => {
            const k = (pr.cat||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(' ')[0]
            return k === g.k
          })
          return { ...g, pr: best || null }
        }).filter(g => g.pr)

        if (totalDone === 0) return null

        return (
          <div style={{ background: C.card, borderRadius: 12, padding: '16px', border: `1px solid ${C.border}`, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 14 }}>MES STATS</div>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
              {[
                { l: 'SÉANCES', v: totalDone, c: C.green },
                { l: 'TONNAGE', v: volFmt + ' kg', c: C.blue },
                { l: 'RPE MOY.', v: avgRpe || '—', c: avgRpe >= 8 ? C.red : C.yellow },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background: C.bg, borderRadius: 8, padding: '10px 12px', borderTop: `3px solid ${c}` }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: C.muted, letterSpacing: 1, marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
            {/* Podium par groupe */}
            {prByGroupP.length > 0 && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 8 }}>MEILLEURES CHARGES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {prByGroupP.map((g, i) => {
                    const oneRM = g.pr.reps > 1 ? Math.round(g.pr.kg * (1 + g.pr.reps / 30)) : g.pr.kg
                    return (
                      <div key={g.k} style={{ display: 'flex', alignItems: 'center', gap: 8,
                        background: C.bg, borderRadius: 7, padding: '8px 10px',
                        borderLeft: `3px solid ${g.color}` }}>
                        <div style={{ fontSize: 16, flexShrink: 0 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                        <div style={{ background: g.color, color: g.textColor, fontSize: 7, fontWeight: 800,
                          padding: '2px 6px', borderRadius: 3, letterSpacing: 1, flexShrink: 0 }}>{g.label.toUpperCase()}</div>
                        <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: C.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.pr.nom}</div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: g.color }}>
                            {g.pr.kg} kg<span style={{ fontSize: 9, color: C.muted }}> ×{g.pr.reps}</span>
                          </div>
                          {oneRM !== g.pr.kg && <div style={{ fontSize: 9, color: C.purple }}>~{oneRM} 1RM</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )
      })()}

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

// ── Solo Setup Screen ─────────────────────────────────────────────────────────
function SoloSetupScreen({ onCreate }) {
  const [form, setForm] = useState({ prenom: '', nom: '', objectif: '', sport: '', taille: '', poids: '', sexe: '' })
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleCreate() {
    if (!form.prenom.trim()) return
    setSaving(true)
    await onCreate(form)
  }

  const inputStyle = {
    width: '100%', background: C.inset, border: '1px solid #333',
    borderRadius: 8, padding: '13px 14px', color: '#fff',
    fontSize: 15, fontWeight: 600, outline: 'none',
    fontFamily: "'Barlow Condensed','Arial Narrow',sans-serif",
    boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: 2, marginBottom: 6, display: 'block' }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: '1px solid #222', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/icon_avid_A.svg" alt="AVID" style={{ height: 28, width: 'auto' }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: 2 }}>AVID PERFORMANCE LAB</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#F2C94C', letterSpacing: 1 }}>MODE SOLO</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '32px 20px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {[1,2].map(s => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? '#F2C94C' : '#222' }} />
          ))}
        </div>

        {step === 1 && (
          <div className="fade-in">
            <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
              Crée ton profil
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 32, lineHeight: 1.6 }}>
              Ces infos sont stockées dans ton app. Personne d'autre n'y a accès.
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>PRÉNOM *</label>
                <input style={inputStyle} placeholder="Ton prénom" value={form.prenom}
                  onChange={e => set('prenom', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>NOM</label>
                <input style={inputStyle} placeholder="Ton nom" value={form.nom}
                  onChange={e => set('nom', e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>OBJECTIF PRINCIPAL</label>
              <input style={inputStyle} placeholder="Ex: Prise de masse, force, endurance..." value={form.objectif}
                onChange={e => set('objectif', e.target.value)} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>SPORT / DISCIPLINE</label>
              <input style={inputStyle} placeholder="Ex: Musculation, CrossFit, Course..." value={form.sport}
                onChange={e => set('sport', e.target.value)} />
            </div>

            <button
              onClick={() => form.prenom.trim() && setStep(2)}
              disabled={!form.prenom.trim()}
              style={{ width: '100%', marginTop: 8, background: form.prenom.trim() ? '#F2C94C' : '#222',
                color: form.prenom.trim() ? '#1a1000' : '#444', border: 'none', borderRadius: 8,
                padding: '15px', fontSize: 14, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
                cursor: form.prenom.trim() ? 'pointer' : 'not-allowed', transition: 'all .2s' }}>
              Suivant →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="fade-in">
            <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>
              Infos physiques
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 32, lineHeight: 1.6 }}>
              Optionnel — utile pour le suivi de ta progression.
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>TAILLE (cm)</label>
                <input style={inputStyle} type="number" placeholder="178" value={form.taille}
                  onChange={e => set('taille', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>POIDS (kg)</label>
                <input style={inputStyle} type="number" placeholder="80" value={form.poids}
                  onChange={e => set('poids', e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>SEXE</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['Homme', 'Femme', 'Autre'].map(s => (
                  <button key={s} onClick={() => set('sexe', s)}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: '1px solid',
                      borderColor: form.sexe === s ? '#F2C94C' : '#333',
                      background: form.sexe === s ? 'rgba(242,196,76,.1)' : '#1a1a1a',
                      color: form.sexe === s ? '#F2C94C' : '#555',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .2s' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)}
                style={{ flex: 1, background: 'none', border: '1px solid #333', borderRadius: 8,
                  color: '#555', padding: '15px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                ← Retour
              </button>
              <button onClick={handleCreate} disabled={saving}
                style={{ flex: 2, background: '#F2C94C', color: '#1a1000', border: 'none', borderRadius: 8,
                  padding: '15px', fontSize: 14, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
                  cursor: 'pointer', opacity: saving ? .6 : 1 }}>
                {saving ? 'Création...' : 'Commencer →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
      <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8, textAlign: 'center' }}>{msg}</div>
      <div style={{ fontSize: 13, color: C.muted, textAlign: 'center' }}>{sub}</div>
    </div>
  )
}
