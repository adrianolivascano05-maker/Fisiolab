// @ts-check
// Los tipos que comparten los módulos del servidor (solo JSDoc: no hay código).

/**
 * @typedef {object} D1Result
 * @property {Record<string, unknown>[]} [results]
 * @property {{ changes?: number, size_after?: number }} [meta]
 */
/**
 * @typedef {{
 *   bind(...values: unknown[]): D1Statement,
 *   run(): Promise<D1Result>,
 *   all(): Promise<D1Result>,
 *   first(): Promise<Record<string, unknown> | null>,
 * }} D1Statement
 */
/** @typedef {{ prepare(sql: string): D1Statement, batch(statements: D1Statement[]): Promise<D1Result[]> }} D1Database */
/**
 * Una subida por trozos a R2.
 * @typedef {{
 *   uploadId: string,
 *   uploadPart(partNumber: number, value: Uint8Array): Promise<{ partNumber: number, etag: string }>,
 *   complete(parts: { partNumber: number, etag: string }[]): Promise<{ size: number }>,
 *   abort(): Promise<void>,
 * }} R2MultipartUpload
 */
/**
 * La parte de un almacén R2 que se usa.
 * @typedef {{
 *   put(key: string, value: Uint8Array): Promise<unknown>,
 *   get(key: string): Promise<{ body: ReadableStream, size: number } | null>,
 *   delete(keys: string | string[]): Promise<void>,
 *   createMultipartUpload(key: string): Promise<R2MultipartUpload>,
 *   resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload,
 * }} R2Bucket
 */
/**
 * @typedef {object} Env
 * @property {D1Database} DB
 * @property {R2Bucket} [DOCS] el almacén de los documentos (R2, en la UE); sin él no hay documentos
 * @property {string} [GOOGLE_CLIENT_ID] el ID de cliente de Google de la app
 * @property {string} [ALLOWED_EMAILS] correos que pueden crear clínicas, separados por comas o espacios (vacío: nadie)
 * @property {string} [ALLOWED_ORIGINS] direcciones de la app, separadas por comas
 * @property {string} [OPERATOR_EMAILS] correos de quien gestiona el servidor (el panel del proveedor)
 * @property {string} [DOCS_CAP_GB] el tope del almacén R2, en GB (10 si no está)
 * @property {string} [D1_CAP_MB] lo que puede ocupar la base D1, en MB, para los avisos del panel (500 si no está)
 * @property {string} [CF_ACCOUNT_ID] el ID de la cuenta de Cloudflare, para leer sus estadísticas
 * @property {string} [CF_API_TOKEN] token de Cloudflare de solo lectura (Account Analytics: Read); un secreto
 * @property {string} [DAILY_REQUESTS] peticiones al día del plan (100 000 si no está; 0: sin límite al día)
 */
/**
 * Quién ha entrado. `expiresIn`: segundos que le quedan al token (para no guardarlo más tiempo).
 * @typedef {{ sub: string, email: string, expiresIn?: number }} Identity
 */
/**
 * Lo que las pruebas pueden cambiar. `verifyToken` rechaza si el token no vale (401); por defecto pregunta a Google.
 * @typedef {object} Deps
 * @property {(token: string, env: Env) => Promise<Identity>} [verifyToken]
 * @property {() => number} [now] milisegundos, como Date.now
 * @property {typeof fetch} [fetch] para preguntar a la API de Cloudflare (las pruebas la cambian)
 */
/**
 * La copia vigente de una cuenta. `chars`: caracteres de su texto base64 (la columna `size`). Con parts = 0, la
 * copia está en R2 y `chars` son sus bytes.
 * @typedef {{ version: string, parts: number, chars: number, updatedAt: string }} Head
 */

/**
 * @typedef {{ epoch: string, seq: number }} Base
 * La sincronización por cambios de una copia: desde qué cambio la copia entera ya lo lleva todo (seq) y su época.
 */

export {};
