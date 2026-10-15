import * as migration_20261015_230956_initial from './20261015_230956_initial';
import * as migration_20261015_232427_typologies from './20261015_232427_typologies';
import * as migration_20261015_232557_locations from './20261015_232557_locations';
import * as migration_20261015_232728_firms from './20261015_232728_firms';
import * as migration_20261015_232831_photographers from './20261015_232831_photographers';
import * as migration_20261015_233304_people from './20261015_233304_people';
import * as migration_20261015_233457_media_credits from './20261015_233457_media_credits';
import * as migration_20261015_233820_projects from './20261015_233820_projects';
import * as migration_20261015_233932_awards_press from './20261015_233932_awards_press';
import * as migration_20261015_234111_user_roles from './20261015_234111_user_roles';
import * as migration_20261015_234239_globals from './20261015_234239_globals';

export const migrations = [
  {
    up: migration_20261015_230956_initial.up,
    down: migration_20261015_230956_initial.down,
    name: '20261015_230956_initial',
  },
  {
    up: migration_20261015_232427_typologies.up,
    down: migration_20261015_232427_typologies.down,
    name: '20261015_232427_typologies',
  },
  {
    up: migration_20261015_232557_locations.up,
    down: migration_20261015_232557_locations.down,
    name: '20261015_232557_locations',
  },
  {
    up: migration_20261015_232728_firms.up,
    down: migration_20261015_232728_firms.down,
    name: '20261015_232728_firms',
  },
  {
    up: migration_20261015_232831_photographers.up,
    down: migration_20261015_232831_photographers.down,
    name: '20261015_232831_photographers',
  },
  {
    up: migration_20261015_233304_people.up,
    down: migration_20261015_233304_people.down,
    name: '20261015_233304_people',
  },
  {
    up: migration_20261015_233457_media_credits.up,
    down: migration_20261015_233457_media_credits.down,
    name: '20261015_233457_media_credits',
  },
  {
    up: migration_20261015_233820_projects.up,
    down: migration_20261015_233820_projects.down,
    name: '20261015_233820_projects',
  },
  {
    up: migration_20261015_233932_awards_press.up,
    down: migration_20261015_233932_awards_press.down,
    name: '20261015_233932_awards_press',
  },
  {
    up: migration_20261015_234111_user_roles.up,
    down: migration_20261015_234111_user_roles.down,
    name: '20261015_234111_user_roles',
  },
  {
    up: migration_20261015_234239_globals.up,
    down: migration_20261015_234239_globals.down,
    name: '20261015_234239_globals'
  },
];
