import mongoose from 'mongoose';

/**
 * Audit Logger Service
 * Handles logging of authentication and authorization events for security monitoring
 */

// Audit Log Schema
const AuditLogSchema = new mongoose.Schema({
  event: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  username: {
    type: String,
    index: true
  },
  role: String,
  discipline: String,
  ip: {
    type: String,
    index: true
  },
  userAgent: String,
  path: String,
  method: String,
  reason: String,
  error: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Create indexes for efficient querying
AuditLogSchema.index({ event: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ ip: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

class AuditLoggerService {
  constructor() {
    this.eventSeverities = {
      // Authentication Events
      'AUTH_SUCCESS': 'low',
      'AUTH_FAILED': 'medium',
      'OPTIONAL_AUTH_SUCCESS': 'low',
      
      // Authorization Events
      'AUTHORIZATION_SUCCESS': 'low',
      'AUTHORIZATION_FAILED': 'medium',
      'AUTHORIZATION_ERROR': 'high',
      
      // Session Events
      'SESSION_CREATED': 'low',
      'SESSION_TIMEOUT': 'medium',
      'SESSION_DESTROYED': 'low',
      
      // Security Events
      'RATE_LIMIT_EXCEEDED': 'high',
      'SUSPICIOUS_ACTIVITY': 'high',
      'MULTIPLE_FAILED_LOGINS': 'high',
      'PRIVILEGE_ESCALATION_ATTEMPT': 'critical',
      
      // API Events
      'API_KEY_AUTH_SUCCESS': 'low',
      'API_KEY_INVALID': 'medium',
      
      // Access Control Events
      'DISCIPLINE_ACCESS_DENIED': 'medium',
      'ROLE_ACCESS_DENIED': 'medium',
      'PERMISSION_DENIED': 'medium',
      
      // Account Events
      'ACCOUNT_LOCKED': 'high',
      'ACCOUNT_UNLOCKED': 'medium',
      'PASSWORD_CHANGED': 'medium',
      'PROFILE_UPDATED': 'low',
      
      // System Events
      'SYSTEM_ERROR': 'high',
      'DATABASE_ERROR': 'critical'
    };

    this.maxLogAge = 90; // days
    this.batchSize = 100; // Increased to reduce database operations
    this.logQueue = [];
    this.maxQueueSize = 500; // Increased to allow more logs before forced flush
    this.flushInterval = 30000; // 30 seconds (not used, but kept for reference)
    this.lastGCTime = Date.now();
    this.gcInterval = 30000; // Force GC every 30 seconds

    // Start memory management only (no periodic flushing)
    this.startMemoryManagement();
  }

  /**
   * Log an authentication or authorization event
   * @param {Object} eventData - Event data to log
   */
  async logAuthEvent(eventData) {
    try {
      const logEntry = {
        event: eventData.event,
        userId: eventData.userId || null,
        username: eventData.username || null,
        role: eventData.role || null,
        discipline: eventData.discipline || null,
        ip: eventData.ip || null,
        userAgent: eventData.userAgent || null,
        path: eventData.path || null,
        method: eventData.method || null,
        reason: eventData.reason || null,
        error: eventData.error || null,
        metadata: this.sanitizeMetadata(eventData),
        severity: this.eventSeverities[eventData.event] || 'medium',
        timestamp: new Date()
      };

      // Add to queue for batch processing
      this.logQueue.push(logEntry);

      // Check if queue is getting too large and force flush
      if (this.logQueue.length >= this.maxQueueSize) {
        console.warn(`Audit log queue reached maximum size (${this.maxQueueSize}), forcing flush`);
        await this.flushLogs();
      }

      // Only flush for critical events or if queue is full
      if (logEntry.severity === 'critical' || this.logQueue.length >= this.maxQueueSize) {
        await this.flushLogs();
      }
      // Non-critical events are queued but not automatically flushed

      // Check for suspicious patterns (disabled temporarily to fix login hanging)
      // this.checkSuspiciousActivity(logEntry).catch(error => {
      //   console.error('Error checking suspicious activity:', error);
      // });

    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main application flow
    }
  }

  /**
   * Log a security event
   * @param {Object} eventData - Security event data
   */
  async logSecurityEvent(eventData) {
    const securityEvent = {
      ...eventData,
      event: eventData.event || 'SECURITY_EVENT',
      severity: 'high'
    };

    await this.logAuthEvent(securityEvent);
  }

  /**
   * Log a system event
   * @param {Object} eventData - System event data
   */
  async logSystemEvent(eventData) {
    const systemEvent = {
      ...eventData,
      event: eventData.event || 'SYSTEM_EVENT',
      severity: eventData.severity || 'medium'
    };

    await this.logAuthEvent(systemEvent);
  }

  /**
   * Flush queued logs to database in batches to prevent memory issues
   */
  async flushLogs() {
    if (this.logQueue.length === 0) {
      return;
    }

    try {
      const logsToFlush = [...this.logQueue];
      this.logQueue = [];

      const chunkSize = 100; // Process in batches matching batchSize
      for (let i = 0; i < logsToFlush.length; i += chunkSize) {
        const chunk = logsToFlush.slice(i, i + chunkSize);
        await AuditLog.insertMany(chunk);
        
        // Force garbage collection periodically during processing
        if (i > 0 && i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      console.log(`Flushed ${logsToFlush.length} audit logs to database`);
      
      // Clear references to help garbage collection
      logsToFlush.length = 0;
      
    } catch (error) {
      console.error('Failed to flush audit logs:', error);
      // Re-add logs to queue for retry with limit to prevent infinite growth
      const retryLogs = logsToFlush.slice(0, 50); // Only retry first 50 logs
      this.logQueue.unshift(...retryLogs);
    }
  }



  /**
   * Start memory management to prevent memory leaks
   */
  startMemoryManagement() {
    setInterval(() => {
      const now = Date.now();
      
      // Force garbage collection if available
      if (global.gc && now - this.lastGCTime > this.gcInterval) {
        try {
          global.gc();
          this.lastGCTime = now;
          console.log('Forced garbage collection for audit logger');
        } catch (error) {
          console.warn('Failed to force garbage collection:', error.message);
        }
      }
      
      // Monitor memory usage
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      
      // If memory usage is high, flush logs immediately
      if (heapUsedMB > 200 && this.logQueue.length > 0) {
        console.warn(`High memory usage detected (${heapUsedMB}MB), flushing audit logs`);
        this.flushLogs().catch(error => {
          console.error('Emergency flush failed:', error);
        });
      }
      
      // Log memory stats periodically
      if (now % 60000 < 5000) { // Every minute
        console.log(`Memory usage: ${heapUsedMB}MB/${heapTotalMB}MB, Audit queue: ${this.logQueue.length}`);
      }
      
    }, 5000); // Check every 5 seconds
  }

  /**
   * Check for suspicious activity patterns (with timeout protection)
   * @param {Object} logEntry - Current log entry
   */
  async checkSuspiciousActivity(logEntry) {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Suspicious activity check timeout')), 3000)
      );

      const checkPromise = this._performSuspiciousActivityCheck(logEntry);

      await Promise.race([checkPromise, timeoutPromise]);
    } catch (error) {
      if (error.message === 'Suspicious activity check timeout') {
        console.warn('Suspicious activity check timed out, skipping');
      } else {
        console.error('Failed to check suspicious activity:', error);
      }
    }
  }

  /**
   * Perform the actual suspicious activity checks
   * @param {Object} logEntry - Current log entry
   */
  async _performSuspiciousActivityCheck(logEntry) {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // Check for multiple failed login attempts
      if (logEntry.event === 'AUTH_FAILED') {
        const recentFailures = await AuditLog.countDocuments({
          event: 'AUTH_FAILED',
          $or: [
            { userId: logEntry.userId },
            { ip: logEntry.ip }
          ],
          timestamp: { $gte: fiveMinutesAgo }
        });

        if (recentFailures >= 5) {
          await this.logSecurityEvent({
            event: 'MULTIPLE_FAILED_LOGINS',
            userId: logEntry.userId,
            ip: logEntry.ip,
            metadata: {
              failureCount: recentFailures,
              timeWindow: '5 minutes'
            }
          });
        }
      }

      // Check for rapid role switching (potential privilege escalation)
      if (logEntry.event === 'AUTHORIZATION_SUCCESS' && logEntry.userId) {
        const recentAuths = await AuditLog.find({
          event: 'AUTHORIZATION_SUCCESS',
          userId: logEntry.userId,
          timestamp: { $gte: fiveMinutesAgo }
        }).distinct('metadata.requiredRoles');

        if (recentAuths.length > 3) {
          await this.logSecurityEvent({
            event: 'PRIVILEGE_ESCALATION_ATTEMPT',
            userId: logEntry.userId,
            ip: logEntry.ip,
            metadata: {
              rolesSwitched: recentAuths,
              timeWindow: '5 minutes'
            }
          });
        }
      }

      // Check for unusual access patterns
      if (logEntry.ip && logEntry.userId) {
        const userIPs = await AuditLog.find({
          userId: logEntry.userId,
          timestamp: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        }).distinct('ip');

        if (userIPs.length > 5) {
          await this.logSecurityEvent({
            event: 'SUSPICIOUS_ACTIVITY',
            userId: logEntry.userId,
            ip: logEntry.ip,
            metadata: {
              reason: 'Multiple IP addresses in 24 hours',
              ipCount: userIPs.length,
              ips: userIPs
            }
          });
        }
      }

    } catch (error) {
      console.error('Failed to perform suspicious activity check:', error);
      throw error;
    }
  }

  /**
   * Sanitize metadata to remove sensitive information
   * @param {Object} data - Raw event data
   * @returns {Object} - Sanitized metadata
   */
  sanitizeMetadata(data) {
    const metadata = { ...data };
    
    // Remove sensitive fields
    delete metadata.password;
    delete metadata.token;
    delete metadata.apiKey;
    delete metadata.sessionId;
    
    // Truncate long strings
    Object.keys(metadata).forEach(key => {
      if (typeof metadata[key] === 'string' && metadata[key].length > 1000) {
        metadata[key] = metadata[key].substring(0, 1000) + '...';
      }
    });

    return metadata;
  }

  /**
   * Get audit logs with filtering and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (limit, skip, sort)
   * @returns {Promise<Object>} - Paginated audit logs
   */
  async getAuditLogs(filters = {}, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { timestamp: -1 }
      } = options;

      const query = {};

      // Apply filters
      if (filters.event) {
        query.event = filters.event;
      }
      
      if (filters.userId) {
        query.userId = filters.userId;
      }
      
      if (filters.ip) {
        query.ip = filters.ip;
      }
      
      if (filters.severity) {
        query.severity = filters.severity;
      }
      
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) {
          query.timestamp.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.timestamp.$lte = new Date(filters.endDate);
        }
      }

      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .sort(sort)
          .limit(limit)
          .skip(skip)
          .populate('userId', 'username email primaryRole discipline'),
        AuditLog.countDocuments(query)
      ]);

      return {
        logs,
        total,
        page: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: skip > 0
      };
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} - Audit statistics
   */
  async getAuditStats(filters = {}) {
    try {
      const query = {};
      
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) {
          query.timestamp.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.timestamp.$lte = new Date(filters.endDate);
        }
      }

      const [
        totalEvents,
        eventsByType,
        eventsBySeverity,
        topUsers,
        topIPs
      ] = await Promise.all([
        AuditLog.countDocuments(query),
        
        AuditLog.aggregate([
          { $match: query },
          { $group: { _id: '$event', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        
        AuditLog.aggregate([
          { $match: query },
          { $group: { _id: '$severity', count: { $sum: 1 } } }
        ]),
        
        AuditLog.aggregate([
          { $match: { ...query, userId: { $ne: null } } },
          { $group: { _id: '$userId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } }
        ]),
        
        AuditLog.aggregate([
          { $match: { ...query, ip: { $ne: null } } },
          { $group: { _id: '$ip', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ])
      ]);

      return {
        totalEvents,
        eventsByType: eventsByType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        eventsBySeverity: eventsBySeverity.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topUsers: topUsers.map(item => ({
          userId: item._id,
          username: item.user[0]?.username || 'Unknown',
          count: item.count
        })),
        topIPs: topIPs.map(item => ({
          ip: item._id,
          count: item.count
        }))
      };
    } catch (error) {
      console.error('Failed to get audit stats:', error);
      throw error;
    }
  }

  /**
   * Clean up old audit logs
   * @param {number} maxAgeDays - Maximum age in days
   */
  async cleanupOldLogs(maxAgeDays = null) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (maxAgeDays || this.maxLogAge));

      const result = await AuditLog.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      console.log(`Cleaned up ${result.deletedCount} old audit logs`);
      return result.deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
      throw error;
    }
  }

  /**
   * Export audit logs to JSON
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} - Audit logs array
   */
  async exportLogs(filters = {}) {
    try {
      const query = {};
      
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) {
          query.timestamp.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.timestamp.$lte = new Date(filters.endDate);
        }
      }

      const logs = await AuditLog.find(query)
        .populate('userId', 'username email primaryRole discipline')
        .sort({ timestamp: -1 })
        .lean();

      return logs;
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  }
}

// Create singleton instance
const auditLogger = new AuditLoggerService();

export default auditLogger;
export { AuditLoggerService, AuditLog };