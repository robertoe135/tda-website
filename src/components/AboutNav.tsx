import { NavLink } from './NavLink'

/** Profile | Team | Collaborators, under the About menu item, as on the current site. */
export function AboutNav() {
  return (
    <nav aria-label="About" className="sub-nav">
      <NavLink href="/about" exact>
        Profile
      </NavLink>
      <NavLink href="/about/team">Team</NavLink>
      <NavLink href="/about/collaborators">Collaborators</NavLink>
    </nav>
  )
}
