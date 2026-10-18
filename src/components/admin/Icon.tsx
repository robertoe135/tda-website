import '@fontsource-variable/dm-sans'

/**
 * The admin's small mark (breadcrumb, top left). Payload fits it into a small square, where the
 * three-line wordmark can't be read, so it is TDA's initials in the logo's grey.
 */
export default function Icon() {
  return (
    <span className="tda-icon" aria-label="Tillotson Design Associates">
      TDA
    </span>
  )
}
