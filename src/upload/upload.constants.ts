export type UploadCategory = 'project' | 'avatar' | 'banner';

export type UploadedFilePayload = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

export const UPLOAD_MIME: Record<UploadCategory, string[]> = {
  project: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/ogg',
    'audio/x-wav',
  ],
  avatar: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  banner: ['image/jpeg', 'image/png', 'image/webp'],
};

export const UPLOAD_MAX_BYTES: Record<UploadCategory, number> = {
  project: 100 * 1024 * 1024,
  avatar: 5 * 1024 * 1024,
  banner: 10 * 1024 * 1024,
};

export type SavedUpload = {
  url: string;
  filename: string;
  mime_type: string;
  size: number;
  category: UploadCategory;
};
