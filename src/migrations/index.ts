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
import * as migration_20261016_021837_credits_clients_area from './20261016_021837_credits_clients_area';
import * as migration_20261016_022300_location_world_region from './20261016_022300_location_world_region';
import * as migration_20261016_035226_media_blob_prefix from './20261016_035226_media_blob_prefix';
import * as migration_20261016_043020_team_roles from './20261016_043020_team_roles';
import * as migration_20261016_050937_media_source_hash from './20261016_050937_media_source_hash';
import * as migration_20261016_052641_pages_home_about_contact from './20261016_052641_pages_home_about_contact';
import * as migration_20261016_123730_home_rows_videos from './20261016_123730_home_rows_videos';
import * as migration_20261016_130037_about_lede_facts from './20261016_130037_about_lede_facts';
import * as migration_20261016_141302_firm_aliases from './20261016_141302_firm_aliases';
import * as migration_20261016_144302_leads_careers_email from './20261016_144302_leads_careers_email';
import * as migration_20261016_182004_block_ai_crawlers from './20261016_182004_block_ai_crawlers';
import * as migration_20261017_015936_home_row_height from './20261017_015936_home_row_height';
import * as migration_20261017_061737_firm_collaborators from './20261017_061737_firm_collaborators';
import * as migration_20261019_152914_newsletters from './20261019_152914_newsletters';
import * as migration_20261019_204447_year_of_light from './20261019_204447_year_of_light';

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
    name: '20261015_234239_globals',
  },
  {
    up: migration_20261016_021837_credits_clients_area.up,
    down: migration_20261016_021837_credits_clients_area.down,
    name: '20261016_021837_credits_clients_area',
  },
  {
    up: migration_20261016_022300_location_world_region.up,
    down: migration_20261016_022300_location_world_region.down,
    name: '20261016_022300_location_world_region',
  },
  {
    up: migration_20261016_035226_media_blob_prefix.up,
    down: migration_20261016_035226_media_blob_prefix.down,
    name: '20261016_035226_media_blob_prefix',
  },
  {
    up: migration_20261016_043020_team_roles.up,
    down: migration_20261016_043020_team_roles.down,
    name: '20261016_043020_team_roles',
  },
  {
    up: migration_20261016_050937_media_source_hash.up,
    down: migration_20261016_050937_media_source_hash.down,
    name: '20261016_050937_media_source_hash',
  },
  {
    up: migration_20261016_052641_pages_home_about_contact.up,
    down: migration_20261016_052641_pages_home_about_contact.down,
    name: '20261016_052641_pages_home_about_contact',
  },
  {
    up: migration_20261016_123730_home_rows_videos.up,
    down: migration_20261016_123730_home_rows_videos.down,
    name: '20261016_123730_home_rows_videos',
  },
  {
    up: migration_20261016_130037_about_lede_facts.up,
    down: migration_20261016_130037_about_lede_facts.down,
    name: '20261016_130037_about_lede_facts',
  },
  {
    up: migration_20261016_141302_firm_aliases.up,
    down: migration_20261016_141302_firm_aliases.down,
    name: '20261016_141302_firm_aliases',
  },
  {
    up: migration_20261016_144302_leads_careers_email.up,
    down: migration_20261016_144302_leads_careers_email.down,
    name: '20261016_144302_leads_careers_email',
  },
  {
    up: migration_20261016_182004_block_ai_crawlers.up,
    down: migration_20261016_182004_block_ai_crawlers.down,
    name: '20261016_182004_block_ai_crawlers',
  },
  {
    up: migration_20261017_015936_home_row_height.up,
    down: migration_20261017_015936_home_row_height.down,
    name: '20261017_015936_home_row_height',
  },
  {
    up: migration_20261017_061737_firm_collaborators.up,
    down: migration_20261017_061737_firm_collaborators.down,
    name: '20261017_061737_firm_collaborators',
  },
  {
    up: migration_20261019_152914_newsletters.up,
    down: migration_20261019_152914_newsletters.down,
    name: '20261019_152914_newsletters',
  },
  {
    up: migration_20261019_204447_year_of_light.up,
    down: migration_20261019_204447_year_of_light.down,
    name: '20261019_204447_year_of_light'
  },
];
