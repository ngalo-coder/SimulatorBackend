import responseTime from 'response-time';

// Simple in-memory metrics store (we'll upgrade to Redis later)
const metrics = {
  requests: new Map(),
  responses: new Map(),
  errors: new Map(),
  activeConnections: 0
};

// Request counter middleware
export function requestCounter(req, res, next) {
  const key = `${req.method}:${req.route?.path || req.path}`;
  metrics.requests.set(key, (metrics.requests.get(key) || 0) + 1);
  
  // Track active connections
  metrics.activeConnections++;
  
  // Cleanup on response finish
  res.on('finish', () => {
    metrics.activeConnections--;
    
    // Track response status codes
    const statusKey = `${key}:${res.statusCode}`;
    metrics.responses.set(statusKey, (metrics.responses.get(statusKey) || 0) + 1);
  });
  
  next();
}

// Response time tracking
export const responseTimeTracker = responseTime((req, res, time) => {
  const key = `${req.method}:${req.route?.path || req.path}`;
  
  // Log slow requests (>1000ms)
  if (time > 1000) {
    req.log.warn({
      method: req.method,
      path: req.path,
      responseTime: time,
      statusCode: res.statusCode
    }, 'Slow request detected');
  }
  
  // Store response time (keep last 100 measurements per endpoint)
  if (!metrics.responseTimes) metrics.responseTimes = new Map();
  if (!metrics.responseTimes.has(key)) metrics.responseTimes.set(key, []);
  
  const times = metrics.responseTimes.get(key);
  times.push(time);
  if (times.length > 100) times.shift(); // Keep only last 100
});

// Error tracking middleware
export function errorTracker(err, req, res, next) {
  const key = `${req.method}:${req.route?.path || req.path}`;
  metrics.errors.set(key, (metrics.errors.get(key) || 0) + 1);
  
  // Log error with context
  req.log.error({
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  }, 'Request error');
  
  next(err);
}

// Metrics endpoint
export function getMetrics(req, res) {
  const now = Date.now();
  const uptime = process.uptime();
  
  // Calculate average response times
  const avgResponseTimes = {};
  if (metrics.responseTimes) {
    for (const [key, times] of metrics.responseTimes.entries()) {
      if (times.length > 0) {
        avgResponseTimes[key] = times.reduce((a, b) => a + b, 0) / times.length;
      }
    }
  }
  
  res.json({
    timestamp: now,
    uptime: uptime,
    activeConnections: metrics.activeConnections,
    requests: Object.fromEntries(metrics.requests),
    responses: Object.fromEntries(metrics.responses),
    errors: Object.fromEntries(metrics.errors),
    averageResponseTimes: avgResponseTimes,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  });
}

export { metrics };