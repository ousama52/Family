import { useEffect } from 'react'
import { Landing } from './components/Landing'
import { TreeScreen } from './components/TreeScreen'
import { useTreeStore } from './state/useTreeStore'
import './styles/app.css'

export default function App() {
  const screen = useTreeStore((s) => s.screen)
  const openTree = useTreeStore((s) => s.openTree)
  const treeId = useTreeStore((s) => s.treeId)

  // Shared links carry the tree in the hash: #/tree/abcd-efgh
  useEffect(() => {
    const openFromHash = () => {
      const match = window.location.hash.match(/^#\/tree\/([\w-]+)$/)
      if (match && match[1] !== useTreeStore.getState().treeId) void openTree(match[1])
    }
    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    return () => window.removeEventListener('hashchange', openFromHash)
  }, [openTree])

  // Keep the address bar in step so the link stays copy-pasteable.
  useEffect(() => {
    const next = treeId ? `#/tree/${treeId}` : ''
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', `${window.location.pathname}${next}`)
    }
  }, [treeId])

  return screen === 'tree' ? <TreeScreen /> : <Landing />
}
