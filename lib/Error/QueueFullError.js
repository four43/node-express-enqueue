const AbstractEnqueueError = require('./AbstractEnqueueError'),
	util = require('util');

function QueueFullError(message) {
	AbstractEnqueueError.call(this);
	this.message = "Queue full, please try again later" || message;
	this.statusCode = 503;
}

util.inherits(QueueFullError, AbstractEnqueueError);

module.exports = QueueFullError;