import Link from 'next/link'

import type { ProjectCard } from '@/lib/projects'

/** A project's main image and name, linking to the project. Grey frame until photos arrive. */
export function ProjectTile({ project, priority }: { project: ProjectCard; priority?: boolean }) {
  return (
    <Link href={`/projects/${project.slug}`} className="tile">
      <div className="tile-image">
        {project.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.image.src} alt="" loading={priority ? 'eager' : 'lazy'} />
        )}
      </div>
      <span className="tile-name">{project.name}</span>
    </Link>
  )
}
