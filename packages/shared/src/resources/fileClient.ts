import type { ApiClient } from '../api/client';
import type { ApiResult } from '../models/envelope';
import { ApiRequestError } from '../api/errors';

/** A local file to upload — the shape expo-image-picker / document-picker assets expose. */
export interface LocalFile {
  /** Local file URI (e.g. file:///... from the image picker). */
  readonly uri: string;
  /** File name to send; a sensible default is used when omitted. */
  readonly name?: string;
  /** MIME type; defaults to image/jpeg when omitted. */
  readonly mimeType?: string;
}

/** What to attach the uploaded file to (mirrors the backend StoreFileRequest owning fields). */
export interface UploadFileOptions {
  readonly owningResourceType: string;
  readonly communityId: string;
  readonly owningResourceId?: string;
}

/** The opaque stored-file reference the upload returns (a File_Service id). */
export interface StoredFileReference {
  readonly reference: string;
}

/**
 * Multipart file-upload client over `POST /api/v1/files` (Req 6.1, 7.1). The shared {@link ApiClient}
 * always sends a JSON body, so a file upload can't ride it — this builds its own `FormData` request
 * but reuses the client's base URL + bearer token (single source of truth; no hardcoded URL, no
 * duplicated auth). Returns the opaque reference to store on the owning entity's `*FileId`.
 *
 * <p>React Native's `fetch` accepts a `{ uri, name, type }` part for a local file; no bytes are read
 * into JS. The browser/Node path (tests) can pass a `Blob`/`File` the same way.</p>
 */
export class FileClient {
  constructor(
    private readonly api: ApiClient,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Upload a local file and return its stored reference. Throws {@link ApiRequestError} on failure. */
  async upload(file: LocalFile, options: UploadFileOptions): Promise<StoredFileReference> {
    // The minimal-API endpoint binds `IFormFile file` from the multipart body but the
    // owningResourceType / communityId / owningResourceId arguments from the QUERY STRING — so these
    // go on the URL, not as form fields (sending them as form fields yields "parameter not provided").
    const qs = new URLSearchParams({
      owningResourceType: options.owningResourceType,
      communityId: options.communityId,
      ...(options.owningResourceId ? { owningResourceId: options.owningResourceId } : {}),
    }).toString();
    const url = this.api.resolveUrl(`/api/v1/files?${qs}`);

    const form = new FormData();
    // RN FormData file part: { uri, name, type }. Cast through unknown — RN's FormData.append
    // accepts this object shape even though the DOM lib types only allow string | Blob.
    form.append('file', {
      uri: file.uri,
      name: file.name ?? 'photo.jpg',
      type: file.mimeType ?? 'image/jpeg',
    } as unknown as Blob);

    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = this.api.currentAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    // Deliberately NOT setting Content-Type — fetch sets the multipart boundary itself.

    let response: Response;
    try {
      response = await this.fetchImpl(url, { method: 'POST', headers, body: form });
    } catch (cause) {
      // eslint-disable-next-line no-console
      console.warn(`[API-NET] POST ${url} (upload) failed: ${String((cause as Error)?.message ?? cause)}`);
      throw new ApiRequestError({
        code: 'INTEGRATION_FAILURE',
        message: 'Photo upload failed. Check your connection and try again.',
        correlationId: '',
        httpStatus: 0,
      });
    }

    let envelope: ApiResult<StoredFileReference> | null = null;
    try {
      envelope = (await response.json()) as ApiResult<StoredFileReference>;
    } catch {
      envelope = null;
    }

    if (envelope?.success && response.ok && envelope.data) {
      return envelope.data;
    }
    if (envelope?.error) {
      throw ApiRequestError.fromApiError(envelope.error, envelope.correlationId ?? '', response.status);
    }
    throw new ApiRequestError({
      code: 'INTERNAL_ERROR',
      message: `Photo upload failed (HTTP ${response.status}).`,
      correlationId: '',
      httpStatus: response.status,
    });
  }
}
