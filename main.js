const EventEmitter = require('events'),
	onFinished = require('on-finished'),
	MetaData = require('./lib/MetaData'),
	os = require('os'),
	util = require('util');

const AbstractEnqueue = require('./lib/Error/AbstractEnqueueError'),
	QueueFullError = require('./lib/Error/QueueFullError'),
	TimeoutInQueueError = require('./lib/Error/TimeoutInQueueError');

/**
 *
 * @param [options]
 * @param {number} [options.concurrentWorkers=# of CPUs]
 * @param {number} [options.maxSize=1000]
 * @param {number} [options.timeout=none]
 * @constructor
 */
function Enqueue(options) {
	EventEmitter.call(this);
	this.concurrentWorkers = options.concurrentWorkers || os.cpus().length;
	this.queueMaxSize = options.maxSize || 1000;
	this.timeout = options.timeout || null;
	this.queue = [];
	this.inProgressQueue = [];
}
util.inherits(Enqueue, EventEmitter);

Enqueue.EVENT_QUEUED = 'EVENT_PROCESSING_START';
Enqueue.EVENT_PROCESSING_START = 'EVENT_PROCESSING_START';

Enqueue.prototype.getMiddleware = function () {
	return function (req, res, next) {
		if (this.queue.length >= this.queueMaxSize) {
			return next(new QueueFullError('Too many in queue, overloaded'));
		}
		else {
			// Append our meta-data
			res._enqueue = new MetaData();
			this.queue.push({req, res, next});
			onFinished(res, (err, res) => {
				this._removeInProgressQueuedWorker(res);
				this._checkQueue();
			});
			this.emit(Enqueue.EVENT_QUEUED, {req, res, next});
			this._checkQueue();
		}
	}.bind(this);
};

Enqueue.prototype.getErrorMiddleware = function (json) {
	json = (json === undefined) ? true : json;
	return (err, req, res, next) => {
		if (err instanceof AbstractEnqueue) {
			res.status(err.statusCode);
			if (json) {
				res.json({error: err.message});
			}
			else {
				res.send(err.message);
			}
		}
		else {
			return next(err);
		}
	};
};


Enqueue.prototype._removeInProgressQueuedWorker = function (res) {
	for (var i = 0; i < this.queue; i++) {
		if (this.inProgressQueue[i].res._enqueue.id === res._enqueue.id) {
			this.inProgressQueue.splice(i, 1);
			return true;
		}
	}
	return false;
};

Enqueue.prototype._checkQueue = function () {
	while (this.inProgressQueue.length < this.concurrentWorkers && this.queue.length) {
		var reqToStart = this.queue.shift();
		if (this.timeout === null || (Date.now() - reqToStart.res._enqueue.startTime < this.timeout)) {
			this.inProgressQueue.push(reqToStart);
			reqToStart.next();
			this.emit(Enqueue.EVENT_PROCESSING_START, reqToStart);
		}
		else {
			reqToStart.next(new TimeoutInQueueError());
		}
	}
};

module.exports = Enqueue;

