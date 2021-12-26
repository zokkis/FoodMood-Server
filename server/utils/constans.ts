const ROOT_PATH = '.';

const PUBLIC_PATH = ROOT_PATH + '/public';

export const DOCUMENT_PATH = PUBLIC_PATH + '/documents';

const PRIVATE_PATH = ROOT_PATH + '/private';

export const LOG_PATH = PRIVATE_PATH + '/logs';

export const KEY_PEM_PATH = ROOT_PATH + '/private_files/private.pem';

export const CERT_PEM_PATH = ROOT_PATH + '/private_files/cert.pem';

export const isProd = process.env.NODE_ENV === 'production';
