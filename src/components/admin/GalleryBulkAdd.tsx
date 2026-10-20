'use client'

import { BulkUploadProvider, Button, useBulkUpload, useForm, useModal } from '@payloadcms/ui'
import { useRef } from 'react'

type Props = { path?: string; schemaPath?: string }

/**
 * Above a project's gallery: choose or drop many photos at once. Payload's bulk upload drawer
 * opens with every file, so each one gets its description (required) and photographer before
 * saving; the saved photos are added to the gallery in the order chosen. Save the project after.
 */
export function GalleryBulkAdd(props: Props) {
  return (
    <BulkUploadProvider drawerSlugPrefix="gallery-bulk">
      <Picker path={props.path ?? 'gallery'} schemaPath={props.schemaPath ?? props.path ?? 'gallery'} />
    </BulkUploadProvider>
  )
}

function Picker({ path, schemaPath }: { path: string; schemaPath: string }) {
  const { addFieldRow, getField } = useForm()
  const { drawerSlug, setCollectionSlug, setInitialFiles, setOnSuccess } = useBulkUpload()
  const { openModal } = useModal()
  const input = useRef<HTMLInputElement>(null)

  const open = (chosen: FileList | null) => {
    if (!chosen?.length) return
    // A copy: the browser empties the picker's own list when it is reset for the next choice.
    const copy = new DataTransfer()
    for (const f of Array.from(chosen)) if (f.type.startsWith('image/')) copy.items.add(f)
    if (!copy.files.length) return
    setCollectionSlug('media')
    setInitialFiles(copy.files)
    setOnSuccess((uploaded) => {
      // Rows the gallery has now (read when the upload finishes): new photos go after them.
      const field = getField(path)
      const start = field?.rows?.length ?? (typeof field?.value === 'number' ? field.value : 0)
      uploaded.forEach((u, i) =>
        addFieldRow({
          path,
          schemaPath,
          rowIndex: start + i,
          subFieldState: { image: { initialValue: u.doc.id, value: u.doc.id, valid: true } },
        }),
      )
    })
    openModal(drawerSlug)
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        open(e.dataTransfer.files)
      }}
      style={{
        margin: '0 0 calc(var(--base) * 0.75)',
        padding: 'calc(var(--base) * 0.75)',
        border: '1px dashed var(--theme-elevation-250)',
        borderRadius: 'var(--style-radius-m)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
      }}
    >
      <Button buttonStyle="secondary" size="small" margin={false} onClick={() => input.current?.click()}>
        Add several photos
      </Button>
      <span style={{ fontSize: '0.85rem', color: 'var(--theme-elevation-650)' }}>
        Or drop them here. Each photo gets its description and photographer before it is saved; then save the project.
      </span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          open(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
