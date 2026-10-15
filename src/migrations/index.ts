import * as migration_20261015_230956_initial from './20261015_230956_initial';
import * as migration_20261015_232427_typologies from './20261015_232427_typologies';
import * as migration_20261015_232557_locations from './20261015_232557_locations';
import * as migration_20261015_232728_firms from './20261015_232728_firms';
import * as migration_20261015_232831_photographers from './20261015_232831_photographers';
import * as migration_20261015_233304_people from './20261015_233304_people';
import * as migration_20261015_233457_media_credits from './20261015_233457_media_credits';

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
    name: '20261015_233457_media_credits'
  },
];
