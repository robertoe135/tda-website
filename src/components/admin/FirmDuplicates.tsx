'use client'

import { Button } from '@payloadcms/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { MergePreview } from './MergeFirm'

type Firm = { id: number; name: string }
type Pair = { a: Firm; b: Firm }

const box: React.CSSProperties = {
  margin: '0 0 var(--base)',
  padding: 'calc(var(--base) * 0.75)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-m)',
}
const small: React.CSSProperties = { margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--theme-elevation-650)' }

/**
 * Above the Firms & clients list: records that look like the same firm ("Foster + Partners"
 * and "Foster and Partners Ltd"), in pairs. Pick the one to keep; the other merges into it.
 * Suggestions only: two firms with similar names stay apart unless someone merges them.
 */
export function FirmDuplicates() {
  const router = useRouter()
  const [pairs, setPairs] = useState<Pair[]>()
  const [busy, setBusy] = useState(false)
  const [merging, setMerging] = useState<{ keep: Firm; merge: Firm }>()
  const [done, setDone] = useState<string>()

  const find = async () => {
    setBusy(true)
    const res = await fetch('/api/firms/duplicates', { credentials: 'include' })
    setPairs(((await res.json().catch(() => ({}))) as { pairs?: Pair[] }).pairs ?? [])
    setBusy(false)
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <Button buttonStyle="secondary" size="small" margin={false} disabled={busy} onClick={find}>
          {busy ? 'Looking…' : pairs ? 'Look again' : 'Find possible duplicates'}
        </Button>
        <span style={{ ...small, margin: 0 }}>Records that look like the same firm or client. Choose which to keep; the other merges into it.</span>
      </div>
      {done && <p style={{ ...small, color: 'var(--theme-success-500)' }}>{done}</p>}
      {pairs && !pairs.length && <p style={small}>No likely duplicates. Others can be merged from a record&rsquo;s own page.</p>}
      {pairs && pairs.length > 0 && (
        <table style={{ width: '100%', marginTop: '0.75rem', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <caption style={{ ...small, textAlign: 'left', margin: '0 0 0.4rem' }}>
            {pairs.length} possible duplicate{pairs.length === 1 ? '' : 's'}
          </caption>
          <tbody>
            {pairs.map((p) => {
              const key = `${p.a.id}-${p.b.id}`
              const open = merging && [merging.keep.id, merging.merge.id].sort().join() === [p.a.id, p.b.id].sort().join()
              return (
                <tr key={key} style={{ borderTop: '1px solid var(--theme-elevation-100)', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.45rem 0.5rem 0.45rem 0', width: '35%' }}>
                    <Link href={`/admin/collections/firms/${p.a.id}`}>{p.a.name}</Link>
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', width: '35%' }}>
                    <Link href={`/admin/collections/firms/${p.b.id}`}>{p.b.name}</Link>
                  </td>
                  <td style={{ padding: '0.45rem 0' }}>
                    {open ? (
                      <MergePreview
                        keep={merging.keep}
                        merge={merging.merge}
                        onCancel={() => setMerging(undefined)}
                        onDone={(plan) => {
                          setDone(`Merged ${plan.merge} into ${plan.keep}.`)
                          setMerging(undefined)
                          // Pairs with the removed record are gone; the others stay.
                          setPairs((list) => list?.filter((q) => ![q.a.id, q.b.id].includes(merging.merge.id)))
                          router.refresh()
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <Button size="small" buttonStyle="secondary" margin={false} onClick={() => setMerging({ keep: p.a, merge: p.b })}>
                          Keep {p.a.name}
                        </Button>
                        <Button size="small" buttonStyle="secondary" margin={false} onClick={() => setMerging({ keep: p.b, merge: p.a })}>
                          Keep {p.b.name}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
