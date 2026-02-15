export const extractFingerprint = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  req.fingerprint = Buffer.from(
    `${userAgent}${acceptLanguage}${acceptEncoding}`
  ).toString('base64').substring(0, 32);
  
  next();
};

export const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         'unknown';
};