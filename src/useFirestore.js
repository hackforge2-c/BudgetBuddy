import { useState, useEffect, useCallback } from 'react'
import {
  collection, doc, onSnapshot, setDoc, deleteDoc,
  serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { db } from './firebase'

export function useFirestore(uid) {
  const [expenses, setExpenses] = useState([])
  const [lentList, setLentList] = useState([])
  const [loans,    setLoans]    = useState([])
  const [schemes,  setSchemes]  = useState([])
  const [settings, setSettings] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [syncStatus, setSyncStatus] = useState('idle')

  useEffect(() => {
    // Don't do anything if no user
    if (!uid) {
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubs = []

    const listen = (name, setter) => {
      try {
        const q = query(collection(db, 'users', uid, name), orderBy('createdAt', 'desc'))
        const unsub = onSnapshot(q,
          snap => setter(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
          err  => { console.warn(name, err.code); setter([]) }
        )
        unsubs.push(unsub)
      } catch(e) { console.warn('listen error', name, e) }
    }

    listen('expenses', setExpenses)
    listen('lentList', setLentList)
    listen('loans',    setLoans)
    listen('schemes',  setSchemes)

    // Settings
    try {
      const settingsRef = doc(db, 'users', uid, 'meta', 'settings')
      const unsubSettings = onSnapshot(settingsRef,
        snap => { if (snap.exists()) setSettings(snap.data()); setLoading(false) },
        ()   => setLoading(false)
      )
      unsubs.push(unsubSettings)
    } catch(e) { setLoading(false) }

    return () => unsubs.forEach(u => { try { u() } catch(e){} })
  }, [uid])

  const save = useCallback(async (colName, record) => {
    if (!uid) return
    setSyncStatus('saving')
    try {
      const { id, ...data } = record
      await setDoc(
        doc(db, 'users', uid, colName, String(id)),
        { ...data, id: String(id), createdAt: data.createdAt || serverTimestamp(), updatedAt: serverTimestamp() }
      )
      setSyncStatus('saved')
      setTimeout(() => setSyncStatus('idle'), 2000)
    } catch(e) { setSyncStatus('error'); console.error(e) }
  }, [uid])

  const remove = useCallback(async (colName, id) => {
    if (!uid) return
    try { await deleteDoc(doc(db, 'users', uid, colName, String(id))) }
    catch(e) { console.error(e) }
  }, [uid])

  const saveSettings = useCallback(async (data) => {
    if (!uid) return
    try {
      await setDoc(
        doc(db, 'users', uid, 'meta', 'settings'),
        { ...data, updatedAt: serverTimestamp() },
        { merge: true }
      )
    } catch(e) { console.error(e) }
  }, [uid])

  return {
    expenses, lentList, loans, schemes, settings, loading, syncStatus,
    addExpense:    r  => save('expenses', r),
    updateExpense: r  => save('expenses', r),
    deleteExpense: id => remove('expenses', id),
    addLent:       r  => save('lentList', r),
    updateLent:    r  => save('lentList', r),
    deleteLent:    id => remove('lentList', id),
    addLoan:       r  => save('loans', r),
    updateLoan:    r  => save('loans', r),
    deleteLoan:    id => remove('loans', id),
    addScheme:     r  => save('schemes', r),
    updateScheme:  r  => save('schemes', r),
    deleteScheme:  id => remove('schemes', id),
    saveSettings,
  }
}
