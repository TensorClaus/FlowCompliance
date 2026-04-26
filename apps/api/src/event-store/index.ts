export { EventEmitter } from './emitter.js'
export { ProjectionBuilder } from './projection-builder.js'
export { replayTo } from './replay.js'
export {
  PROJECTION_SYNC_QUEUE_NAME,
  createProjectionSyncQueue,
  createProjectionSyncWorker,
} from './sync-worker.js'
export type { EventStoreTx } from './emitter.js'
export type { AppendResult, EEAEvent } from '@simplifi/shared'
