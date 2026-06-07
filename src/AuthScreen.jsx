import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth'
import { auth } from './firebase'

export default function AuthScreen() {
  const [mode, setMode]         = useState('login') // login | register | reset
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password)
      } else if (mode === 'register') {
        if (password !== confirm) throw new Error('Passwords do not match')
        if (password.length < 6) throw new Error('Password must be at least 6 characters')
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() })
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email)
        setSuccess('Reset email sent! Check your inbox.')
        setLoading(false); return
      }
    } catch (err) {
      const msgs = {
        'auth/user-not-found':    'No account with this email.',
        'auth/wrong-password':    'Incorrect password.',
        'auth/email-already-in-use': 'Email already registered.',
        'auth/invalid-email':     'Invalid email address.',
        'auth/weak-password':     'Password too weak.',
        'auth/too-many-requests': 'Too many attempts. Try later.',
        'auth/invalid-credential':'Incorrect email or password.',
      }
      setError(msgs[err.code] || err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight:'100vh', background:'#080f1e',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:"'Plus Jakarta Sans',sans-serif", padding:'20px'
    }}>
      {/* Background blobs */}
      <div style={{position:'fixed',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
        <div style={{position:'absolute',width:'400px',height:'400px',borderRadius:'50%',background:'rgba(99,102,241,0.12)',filter:'blur(80px)',top:'-100px',left:'-100px'}}/>
        <div style={{position:'absolute',width:'300px',height:'300px',borderRadius:'50%',background:'rgba(29,233,182,0.08)',filter:'blur(60px)',bottom:'-80px',right:'-80px'}}/>
      </div>

      <div style={{
        position:'relative', zIndex:1,
        width:'100%', maxWidth:'420px',
        background:'#0f2137',
        border:'1px solid rgba(29,233,182,0.15)',
        borderRadius:'20px',
        padding:'36px 32px',
        boxShadow:'0 24px 64px rgba(0,0,0,0.5)'
      }}>
        {/* Logo */}
        <div style={{textAlign:'center', marginBottom:'28px'}}>
          <img src="./logo.png" alt="BudgetBuddy" style={{width:'72px',height:'72px',borderRadius:'18px',objectFit:'contain',marginBottom:'12px'}} onError={e=>e.target.style.display='none'}/>
          <div style={{fontSize:'24px',fontWeight:800}}>
            <span style={{color:'#e8f4f8'}}>Budget</span>
            <span style={{background:'linear-gradient(135deg,#1de9b6,#4dd0e1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Buddy</span>
          </div>
          <div style={{fontSize:'12px',color:'#6a9bb8',marginTop:'4px',fontWeight:500}}>
            {mode==='login'?'Sign in to your account':mode==='register'?'Create your account':'Reset your password'}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name field — register only */}
          {mode==='register'&&(
            <div style={{marginBottom:'14px'}}>
              <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#6a9bb8',textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:'6px'}}>Full Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Aman Verma"
                style={{width:'100%',padding:'11px 14px',background:'#0a1e32',border:'1.5px solid rgba(29,233,182,0.15)',borderRadius:'10px',color:'#e8f4f8',fontFamily:'inherit',fontSize:'14px',outline:'none',boxSizing:'border-box'}}
                onFocus={e=>e.target.style.borderColor='#1de9b6'} onBlur={e=>e.target.style.borderColor='rgba(29,233,182,0.15)'}/>
            </div>
          )}

          {/* Email */}
          <div style={{marginBottom:'14px'}}>
            <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#6a9bb8',textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:'6px'}}>Email Address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required
              style={{width:'100%',padding:'11px 14px',background:'#0a1e32',border:'1.5px solid rgba(29,233,182,0.15)',borderRadius:'10px',color:'#e8f4f8',fontFamily:'inherit',fontSize:'14px',outline:'none',boxSizing:'border-box'}}
              onFocus={e=>e.target.style.borderColor='#1de9b6'} onBlur={e=>e.target.style.borderColor='rgba(29,233,182,0.15)'}/>
          </div>

          {/* Password */}
          {mode!=='reset'&&(
            <div style={{marginBottom:'14px'}}>
              <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#6a9bb8',textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:'6px'}}>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required
                style={{width:'100%',padding:'11px 14px',background:'#0a1e32',border:'1.5px solid rgba(29,233,182,0.15)',borderRadius:'10px',color:'#e8f4f8',fontFamily:'inherit',fontSize:'14px',outline:'none',boxSizing:'border-box'}}
                onFocus={e=>e.target.style.borderColor='#1de9b6'} onBlur={e=>e.target.style.borderColor='rgba(29,233,182,0.15)'}/>
            </div>
          )}

          {/* Confirm Password */}
          {mode==='register'&&(
            <div style={{marginBottom:'14px'}}>
              <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#6a9bb8',textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:'6px'}}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••" required
                style={{width:'100%',padding:'11px 14px',background:'#0a1e32',border:'1.5px solid rgba(29,233,182,0.15)',borderRadius:'10px',color:'#e8f4f8',fontFamily:'inherit',fontSize:'14px',outline:'none',boxSizing:'border-box'}}
                onFocus={e=>e.target.style.borderColor='#1de9b6'} onBlur={e=>e.target.style.borderColor='rgba(29,233,182,0.15)'}/>
            </div>
          )}

          {/* Forgot password link */}
          {mode==='login'&&(
            <div style={{textAlign:'right',marginBottom:'16px',marginTop:'-6px'}}>
              <button type="button" onClick={()=>{setMode('reset');setError('');setSuccess('')}} style={{background:'none',border:'none',color:'#1de9b6',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                Forgot password?
              </button>
            </div>
          )}

          {/* Error */}
          {error&&(
            <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px',color:'#f87171',fontWeight:600}}>
              ⚠️ {error}
            </div>
          )}

          {/* Success */}
          {success&&(
            <div style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'13px',color:'#10b981',fontWeight:600}}>
              ✅ {success}
            </div>
          )}

          {/* Submit button */}
          <button type="submit" disabled={loading} style={{
            width:'100%', padding:'13px',
            background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color:'#fff', border:'none', borderRadius:'10px',
            fontSize:'15px', fontWeight:800, cursor: loading?'not-allowed':'pointer',
            fontFamily:'inherit', transition:'all 0.16s',
            boxShadow: loading?'none':'0 4px 16px rgba(99,102,241,0.35)',
            marginBottom:'16px'
          }}>
            {loading ? '⏳ Please wait...' : mode==='login' ? '🔐 Sign In' : mode==='register' ? '🚀 Create Account' : '📧 Send Reset Email'}
          </button>
        </form>

        {/* Switch mode */}
        <div style={{textAlign:'center',borderTop:'1px solid rgba(29,233,182,0.08)',paddingTop:'16px'}}>
          {mode==='login'&&(
            <span style={{fontSize:'13px',color:'#6a9bb8'}}>
              Don't have an account?{' '}
              <button onClick={()=>{setMode('register');setError('');setSuccess('')}} style={{background:'none',border:'none',color:'#1de9b6',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:'13px'}}>
                Sign up free
              </button>
            </span>
          )}
          {mode==='register'&&(
            <span style={{fontSize:'13px',color:'#6a9bb8'}}>
              Already have an account?{' '}
              <button onClick={()=>{setMode('login');setError('');setSuccess('')}} style={{background:'none',border:'none',color:'#1de9b6',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:'13px'}}>
                Sign in
              </button>
            </span>
          )}
          {mode==='reset'&&(
            <button onClick={()=>{setMode('login');setError('');setSuccess('')}} style={{background:'none',border:'none',color:'#1de9b6',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:'13px'}}>
              ← Back to Sign In
            </button>
          )}
        </div>

        <div style={{textAlign:'center',marginTop:'16px',fontSize:'11px',color:'#3d6e8a'}}>
          🔒 Your data is encrypted and stored securely
        </div>
      </div>
    </div>
  )
}
