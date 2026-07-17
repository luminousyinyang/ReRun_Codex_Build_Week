/** Shared learner-input limits. Keep the client and both API routes in sync. */
export const MIN_STUDY_CHARS = 80;
export const MAX_STUDY_CHARS = 12_000;
export const MAX_AUDIO_VIDEO_BYTES = 25 * 1024 * 1024;
/** Netlify buffers binary function requests, so keep the hosted upload well
 * below its effective binary payload ceiling. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 6;
