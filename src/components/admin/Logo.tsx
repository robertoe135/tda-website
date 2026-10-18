import '@fontsource-variable/dm-sans'

/** The admin's logo (login screen): TDA's wordmark, the same file as the website header. */
export default function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/tda-logo.svg" alt="Tillotson Design Associates" width={1000} height={414} className="tda-logo" />
}
