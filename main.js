'use strict';
const onFinished = require('on-finished'),
	MetaData = require('./lib/MetaData'),
	os = require('os');

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
	if(!options) options = {};
	this.concurrentWorkers = options.concurrentWorkers || os.cpus().length;
	this.queueMaxSize = options.maxSize || 1000;
	this.timeout = options.timeout || null;

	this.queue = [];
	this.inProgressQueue = [];
}

/**
 * Gets Middleware to use queue in an app.
 * @returns {function(this:Enqueue)}
 */
Enqueue.prototype.getMiddleware = function () {
	return function (req, res, next) {
		if ((this.queue.length + this.inProgressQueue.length) >= this.queueMaxSize) {
			return next(new QueueFullError('Too many in queue, overloaded'));
		}
		else {
			// Append our meta-data
			res._enqueue = new MetaData();
			this.queue.push({req, res, next});
			onFinished(res, (err, res) => {
				if(err) console.error(err);
				this._removeQueuedWorker(res);
				this._checkQueue();
			});
			if (this.inProgressQueue.length < this.concurrentWorkers) {
				this._checkQueue();
			}
		}
	}.bind(this);
};

/**
 * Gets error middleware to handle errors (timeout, too many in queue)
 *
 * @param {boolean} [json=true]
 * @returns {Function}
 */
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

/**
 * Gets the current state of the queue.
 * @returns {{total: number, inProgress: number, waiting: number}}
 */
Enqueue.prototype.getStats = function () {
	return {
		total:      this.queue.length + this.inProgressQueue.length,
		inProgress: this.inProgressQueue.length,
		waiting:    this.queue.length
	};
};

/**
 * Removes a result from the inProgress queue
 * @param {ServerResponse} res
 * @private
 */
Enqueue.prototype._removeQueuedWorker = function (res) {
	const elemInProgressId = this.inProgressQueue.findIndex((queueElem) => enqueueEquality(queueElem.res, res));
	if(elemInProgressId !== -1) {
		this.inProgressQueue.splice(elemInProgressId, 1);
	}
	else {
		// If this request never made it to "inProgress"
		const elemQueueId = this.queue.findIndex((queueElem) => enqueueEquality(queueElem.res, res));
		if(elemQueueId !== -1) {
			this.queue.splice(elemQueueId, 1);
		}
	}
};

/**
 * Checks the queue to see if we should start any more requests in the queue.
 * @private
 */
Enqueue.prototype._checkQueue = function () {
	while (this.inProgressQueue.length < this.concurrentWorkers && this.queue.length) {
		let reqToStart = this.queue.shift();
		if (this.timeout === null || (Date.now() - reqToStart.res._enqueue.startTime < this.timeout)) {
			this.inProgressQueue.push(reqToStart);
			reqToStart.next();
		}
		else {
			reqToStart.next(new TimeoutInQueueError());
		}
	}
};

function enqueueEquality(resA, resB) {
	return resA._enqueue.id === resB._enqueue.id
}

module.exports = Enqueue;

