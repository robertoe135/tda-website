import * as migration_20261015_230956_initial from './20261015_230956_initial';
import * as migration_20261015_232427_typologies from './20261015_232427_typologies';
import * as migration_20261015_232557_locations from './20261015_232557_locations';
import * as migration_20261015_232728_firms from './20261015_232728_firms';

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
    name: '20261015_232728_firms'
  },
];
