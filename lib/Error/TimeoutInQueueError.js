const AbstractEnqueueError = require('./AbstractEnqueueError'),
	util = require('util');

function TimeoutInQueueError(message) {
	AbstractEnqueueError.call(this);
	this.message = "Request timed out while waiting in queue to be handled" || message;
	this.statusCode = 503;
}

util.inherits(TimeoutInQueueError, AbstractEnqueueError);

module.exports = TimeoutInQueueError;